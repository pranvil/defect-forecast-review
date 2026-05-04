from __future__ import annotations

import hashlib
import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable
from uuid import uuid4

from app.db import get_conn, json_dumps
from app.jira_client import list_issue_search_fields, search_issues_paged
from app.models import (
    CompareMetrics,
    CompareResponse,
    CompareSeriesPoint,
    FieldMappingRow,
    ForecastResult,
    JiraFetchDebugInfo,
    JiraFetchRequest,
    JiraFetchResult,
    JiraIssueDebugRow,
    ProjectHistory,
    ProjectSummary,
    TeamWeeklyRow,
    WeeklyPoint,
)

logger = logging.getLogger("drp.issue_fact")

FIELD_MAPPINGS_KEY = "field_mappings"
TEAM_WEEKLY_KEY_PREFIX = "jira_team_weekly::"
JIRA_DEBUG_KEY_PREFIX = "jira_debug::"
DEFAULT_ISSUE_TYPE_CLAUSE = 'issuetype in (defect, defect_new)'
DEFAULT_STATUS_CLAUSE = 'status in ("MORE INFO", "ASSIGNED", "OPENED", "RESOLVE", "VERIFIED_SW", "DELIVERED", "VERIFIED", "CLOSED")'
DEFAULT_SUMMARY_EXCLUSION_CLAUSE = '(summary !~ "MAIN2MP" AND summary !~ "MP2SMR")'
DEFAULT_FETCH_FILTER_CLAUSE = (
    f"{DEFAULT_ISSUE_TYPE_CLAUSE} AND {DEFAULT_STATUS_CLAUSE} AND {DEFAULT_SUMMARY_EXCLUSION_CLAUSE}"
)
DEFAULT_REPORTER_TEAM_FIELD = "customfield_15319"
DEFAULT_ASSIGNEE_TEAM_FIELD = "customfield_15320"
DEFAULT_VERIFIED_SW_FIELD = "customfield_13228"
DEFAULT_CLOSED_FIELD = "customfield_13221"
DEFAULT_DELETED_FIELD = "customfield_13222"
DEFAULT_POSTPONED_FIELD = "customfield_13225"
UNKNOWN_CREATED_TEAM = "测试未知团队"
UNKNOWN_FIXED_TEAM = "软件-未知团队"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _normalize_project_key(project_key: str) -> str:
    return project_key.strip().upper()


def _parse_jira_datetime(raw: str) -> datetime | None:
    value = raw.strip()
    if not value:
        return None
    candidates = (
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    )
    for fmt in candidates:
        try:
            parsed = datetime.strptime(value, fmt)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed
        except ValueError:
            continue
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


def _coerce_jira_datetime_string(raw: Any) -> str:
    """将 Jira 各类时间字段规范成可写入 SQLite / 再解析的字符串。"""
    if raw is None or isinstance(raw, bool):
        return ""
    if isinstance(raw, (int, float)):
        ts = float(raw)
        if ts > 1e12:
            ts /= 1000.0
        if ts <= 0 or ts > 2e10:
            return ""
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc).replace(microsecond=0).isoformat()
        except (OSError, ValueError, OverflowError):
            return ""
    if isinstance(raw, dict):
        for key in ("iso8601", "formatted", "value", "epochMillis"):
            if key in raw:
                inner = _coerce_jira_datetime_string(raw.get(key))
                if inner:
                    return inner
        return ""
    return str(raw).strip()


def _enrich_issue_row_from_stored_raw(issue: dict[str, Any]) -> dict[str, Any]:
    """从入库的 raw_fields_json 补回 created/reporter 等派生字段。"""
    out = dict(issue)
    has_created = _parse_jira_datetime(str(out.get("created_at") or "").strip()) is not None
    rfj = out.get("raw_fields_json")
    if not rfj or not isinstance(rfj, str) or not rfj.strip():
        return out
    try:
        fields = json.loads(rfj)
    except json.JSONDecodeError:
        return out
    if not isinstance(fields, dict):
        return out
    if not has_created:
        created = _coerce_jira_datetime_string(fields.get("created"))
        if created and _parse_jira_datetime(created):
            out["created_at"] = created
    if not str(out.get("reporter") or "").strip():
        reporter = _extract_actor_identity(fields.get("reporter"))
        if reporter:
            out["reporter"] = reporter
    return out


def _created_time_for_week_bucket(issue: dict[str, Any]) -> str:
    """用于周桶：优先 created，其次 updated（避免 Jira 未返回 created 时周序列为空）。"""
    for key in ("created_at", "updated_at"):
        raw = str(issue.get(key) or "").strip()
        if raw and _parse_jira_datetime(raw):
            return raw
    return ""


def _first_non_empty(*values: str) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _extract_named_value(raw: Any) -> str:
    if isinstance(raw, str):
        return raw.strip()
    if isinstance(raw, (int, float)):
        return str(raw)
    if isinstance(raw, list):
        for item in raw:
            value = _extract_named_value(item)
            if value:
                return value
        return ""
    if isinstance(raw, dict):
        for key in ("value", "name", "displayName", "key"):
            value = raw.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return ""


def _extract_actor_identity(raw: Any) -> str:
    if not isinstance(raw, dict):
        return ""
    for key in ("name", "key", "accountId", "emailAddress", "displayName"):
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            text = value.strip()
            if key == "emailAddress" and "@" in text:
                return text.split("@", 1)[0].strip() or text
            return text
    return ""


def _is_unknown_team_name(team_name: str) -> bool:
    normalized = team_name.strip().lower()
    if not normalized:
        return True
    if normalized in {"(empty)", "(none)", "unknown", "unk", "未知"}:
        return True
    return "未知团队" in normalized or "unknown team" in normalized


def _resolve_unknown_team_bucket(team_name: str, reporter: str, unknown_label: str) -> str:
    team = team_name.strip()
    if not _is_unknown_team_name(team):
        return team
    actor = reporter.strip()
    if actor:
        return f"{unknown_label}-{actor}"
    return f"{unknown_label}-(unknown-reporter)"


def _extract_project_key(raw: Any) -> str:
    """
    Jira 的 fields.project 通常同时包含 key/name。
    项目关联必须使用稳定的 key，不能优先用 name。
    """
    if isinstance(raw, dict):
        key = raw.get("key")
        if isinstance(key, str) and key.strip():
            return _normalize_project_key(key)
        # 兼容少量非标准返回
        for alt in ("projectKey", "project_key"):
            value = raw.get(alt)
            if isinstance(value, str) and value.strip():
                return _normalize_project_key(value)
    if isinstance(raw, str) and raw.strip():
        return _normalize_project_key(raw)
    return ""


def _extract_components(fields: dict[str, Any]) -> list[str]:
    raw = fields.get("components")
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        name = _extract_named_value(item)
        if name and name not in out:
            out.append(name)
    return out


def _parse_field_mappings() -> list[FieldMappingRow]:
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM app_config WHERE key = ?", (FIELD_MAPPINGS_KEY,)).fetchone()
    if not row or not isinstance(row["value"], str) or not row["value"].strip():
        return []
    try:
        payload = json.loads(row["value"])
    except json.JSONDecodeError:
        return []
    if not isinstance(payload, list):
        return []
    out: list[FieldMappingRow] = []
    for item in payload:
        try:
            out.append(FieldMappingRow.model_validate(item))
        except Exception:
            continue
    return out


def _field_mapping_index() -> dict[str, str]:
    rows = _parse_field_mappings()
    mapping: dict[str, str] = {}
    for row in rows:
        if not row.enabled:
            continue
        key = row.businessName.strip().upper()
        value = row.jiraFieldPath.strip()
        if key and value:
            mapping[key] = value
    return mapping


def _mapping_version(mapping_index: dict[str, str]) -> str:
    payload = json.dumps(mapping_index, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8", errors="ignore")).hexdigest()[:16]


def _mapping_path(mapping_index: dict[str, str], business_name: str, default: str) -> str:
    return mapping_index.get(business_name.strip().upper(), default)


def _build_fetch_plan(req: JiraFetchRequest) -> tuple[str, str, str]:
    project_key = _normalize_project_key(req.projectKey)
    if req.jql.strip():
        return "advanced_jql", req.jql.strip(), req.jql.strip()
    if req.startDate.strip() and req.endDate.strip():
        end_exclusive = _add_days(req.endDate.strip(), 1)
        upper = f'created < "{end_exclusive}"' if end_exclusive else f'created <= "{req.endDate.strip()}"'
        bounded = (
            f'project = "{project_key}" AND {DEFAULT_FETCH_FILTER_CLAUSE} '
            f'AND created >= "{req.startDate.strip()}" AND {upper} ORDER BY created DESC'
        )
        return "advanced_range", bounded, bounded
    bounded = f'project = "{project_key}" AND {DEFAULT_FETCH_FILTER_CLAUSE} ORDER BY created DESC'
    return "full", bounded, bounded


def _add_days(ymd: str, days: int) -> str:
    try:
        d = date.fromisoformat(ymd)
    except ValueError:
        return ""
    return (d + timedelta(days=days)).isoformat()


def _requested_issue_fields(mapping_index: dict[str, str]) -> list[str]:
    extra = {
        "components",
        "issuetype",
        "reporter",
        "status",
        "project",
        "updated",
        "summary",
        _mapping_path(mapping_index, "Reporter Team-New", DEFAULT_REPORTER_TEAM_FIELD),
        _mapping_path(mapping_index, "Assignee Team", DEFAULT_ASSIGNEE_TEAM_FIELD),
        _mapping_path(mapping_index, "last time to set verified_sw", DEFAULT_VERIFIED_SW_FIELD),
        _mapping_path(mapping_index, "1st time to set closed", DEFAULT_CLOSED_FIELD),
        _mapping_path(mapping_index, "1st time to set deleted", DEFAULT_DELETED_FIELD),
        _mapping_path(mapping_index, "1st time to set postponed", DEFAULT_POSTPONED_FIELD),
    }
    return list_issue_search_fields(sorted(extra))


def _normalize_issue(issue: dict[str, Any], mapping_index: dict[str, str], fallback_project_key: str) -> dict[str, Any]:
    fields = issue.get("fields") if isinstance(issue.get("fields"), dict) else {}
    reporter_team_field = _mapping_path(mapping_index, "Reporter Team-New", DEFAULT_REPORTER_TEAM_FIELD)
    assignee_team_field = _mapping_path(mapping_index, "Assignee Team", DEFAULT_ASSIGNEE_TEAM_FIELD)
    verified_sw_field = _mapping_path(mapping_index, "last time to set verified_sw", DEFAULT_VERIFIED_SW_FIELD)
    closed_field = _mapping_path(mapping_index, "1st time to set closed", DEFAULT_CLOSED_FIELD)
    deleted_field = _mapping_path(mapping_index, "1st time to set deleted", DEFAULT_DELETED_FIELD)
    postponed_field = _mapping_path(mapping_index, "1st time to set postponed", DEFAULT_POSTPONED_FIELD)
    project_value = fields.get("project")
    project_key = _extract_project_key(project_value) or _normalize_project_key(fallback_project_key)
    return {
        "issue_key": _normalize_project_key(str(issue.get("key", "")).replace(" ", "")),
        "project_key": _normalize_project_key(project_key),
        "issue_type": _extract_named_value(fields.get("issuetype")),
        "status": _extract_named_value(fields.get("status")),
        "created_at": _coerce_jira_datetime_string(fields.get("created")),
        "updated_at": _coerce_jira_datetime_string(fields.get("updated")),
        "resolved_at": _first_non_empty(str(fields.get("resolutiondate") or "").strip(), str(fields.get("resolved") or "").strip()),
        "verified_sw_at": _extract_named_value(fields.get(verified_sw_field)),
        "closed_at": _extract_named_value(fields.get(closed_field)),
        "postponed_at": _extract_named_value(fields.get(postponed_field)),
        "deleted_at": _extract_named_value(fields.get(deleted_field)),
        "reporter_team": _extract_named_value(fields.get(reporter_team_field)),
        "assignee_team": _extract_named_value(fields.get(assignee_team_field)),
        "components": _extract_components(fields),
        "raw_fields_json": json_dumps(fields),
        "summary": str(fields.get("summary") or "").strip(),
        "reporter": _extract_actor_identity(fields.get("reporter")),
        "assignee": _extract_named_value(fields.get("assignee")),
    }


def _repair_issue_project_key(project_name: str) -> int:
    """
    兼容旧版本数据：jira_issue.project_key 误写成项目名称而不是 key。
    通过 raw_fields_json.fields.project.key 回写正确 project_key。
    """
    target_key = _normalize_project_key(project_name)
    if not target_key:
        return 0
    repaired = 0
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT issue_key, project_key, raw_fields_json
            FROM jira_issue
            WHERE IFNULL(removed_at, '') = ''
            """
        ).fetchall()
        for row in rows:
            issue_key = str(row["issue_key"] or "").strip()
            current_key = _normalize_project_key(str(row["project_key"] or ""))
            raw_fields_json = str(row["raw_fields_json"] or "").strip()
            if not issue_key or not raw_fields_json:
                continue
            try:
                payload = json.loads(raw_fields_json)
            except json.JSONDecodeError:
                continue
            if not isinstance(payload, dict):
                continue
            repaired_key = _extract_project_key(payload.get("project"))
            if not repaired_key or repaired_key != target_key or current_key == repaired_key:
                continue
            conn.execute("UPDATE jira_issue SET project_key = ? WHERE issue_key = ?", (repaired_key, issue_key))
            repaired += 1
    return repaired


def _business_week_from_date(d: date) -> tuple[int, int]:
    year = d.year
    jan1 = date(year, 1, 1)
    first_sunday = jan1 + timedelta(days=(6 - jan1.weekday()) % 7)
    if d <= first_sunday:
        return year, 1
    first_monday = first_sunday + timedelta(days=1)
    diff_days = (d - first_monday).days
    return year, 2 + diff_days // 7


def _business_week_label(raw: str) -> str:
    parsed = _parse_jira_datetime(raw)
    if not parsed:
        return ""
    year, week = _business_week_from_date(parsed.date())
    return f"{str(year)[-2:]}W{week}"


def _parse_year_week(label: str) -> tuple[int, int]:
    cleaned = label.strip().upper().replace(" ", "")
    parts = cleaned.split("W", 1)
    if len(parts) != 2:
        return (9999, 9999)
    try:
        year = int(parts[0]) if len(parts[0]) == 4 else 2000 + int(parts[0])
        week = int(parts[1])
    except ValueError:
        return (9999, 9999)
    return (year, week)


def _sort_week_labels(labels: Iterable[str]) -> list[str]:
    return sorted({label for label in labels if label}, key=lambda x: (*_parse_year_week(x), x))


def _business_week_start(year: int, week: int) -> date | None:
    if week < 1:
        return None
    if week == 1:
        return date(year, 1, 1)
    jan1 = date(year, 1, 1)
    first_sunday = jan1 + timedelta(days=(6 - jan1.weekday()) % 7)
    first_monday = first_sunday + timedelta(days=1)
    out = first_monday + timedelta(days=(week - 2) * 7)
    if out.year != year:
        return None
    return out


def _week_first_day_md(label: str) -> str:
    year, week = _parse_year_week(label)
    if year == 9999:
        return ""
    start = _business_week_start(year, week)
    if not start:
        return ""
    return f"{start.month}/{start.day}"


def _fixed_time(issue: dict[str, Any]) -> str:
    return _first_non_empty(
        issue.get("verified_sw_at", ""),
        issue.get("closed_at", ""),
        issue.get("postponed_at", ""),
        issue.get("deleted_at", ""),
        issue.get("resolved_at", ""),
    )


def _build_weekly_rows(issues: list[dict[str, Any]]) -> tuple[list[WeeklyPoint], dict[str, Any]]:
    created_counts: dict[str, int] = {}
    fixed_counts: dict[str, int] = {}
    created_team_counts: dict[str, dict[str, int]] = {}
    fixed_team_counts: dict[str, dict[str, int]] = {}
    created_issue_keys: dict[str, dict[str, list[str]]] = {}
    fixed_issue_keys: dict[str, dict[str, list[str]]] = {}

    for issue in issues:
        created_week = _business_week_label(_created_time_for_week_bucket(issue))
        if created_week:
            created_counts[created_week] = created_counts.get(created_week, 0) + 1
            reporter = str(issue.get("reporter") or "").strip()
            created_team = _resolve_unknown_team_bucket(str(issue.get("reporter_team") or ""), reporter, UNKNOWN_CREATED_TEAM)
            created_team_counts.setdefault(created_week, {})[created_team] = created_team_counts.get(created_week, {}).get(created_team, 0) + 1
            created_issue_keys.setdefault(created_week, {}).setdefault(created_team, []).append(issue["issue_key"])

        fixed_week = _business_week_label(_fixed_time(issue))
        if fixed_week:
            fixed_counts[fixed_week] = fixed_counts.get(fixed_week, 0) + 1
            reporter = str(issue.get("reporter") or "").strip()
            fixed_team = _resolve_unknown_team_bucket(str(issue.get("assignee_team") or ""), reporter, UNKNOWN_FIXED_TEAM)
            fixed_team_counts.setdefault(fixed_week, {})[fixed_team] = fixed_team_counts.get(fixed_week, {}).get(fixed_team, 0) + 1
            fixed_issue_keys.setdefault(fixed_week, {}).setdefault(fixed_team, []).append(issue["issue_key"])

    week_labels = _sort_week_labels([*created_counts.keys(), *fixed_counts.keys()])
    weekly_points: list[WeeklyPoint] = []
    cum_created = 0
    cum_fixed = 0
    for week_label in week_labels:
        created = created_counts.get(week_label, 0)
        fixed = fixed_counts.get(week_label, 0)
        cum_created += created
        cum_fixed += fixed
        weekly_points.append(
            WeeklyPoint(
                week=week_label,
                weekLabel=week_label,
                date=_week_first_day_md(week_label),
                created=created,
                fixed=fixed,
                cumCreated=cum_created,
                cumFixed=cum_fixed,
                backlog=max(0, cum_created - cum_fixed),
            )
        )
    team_cache = {
        "created": created_team_counts,
        "fixed": fixed_team_counts,
        "createdIssueKeys": created_issue_keys,
        "fixedIssueKeys": fixed_issue_keys,
    }
    return weekly_points, team_cache


def _created_period_bounds(issues: list[dict[str, Any]]) -> tuple[str, str]:
    created_times: list[datetime] = []
    for issue in issues:
        raw_created = str(issue.get("created_at") or "").strip()
        parsed = _parse_jira_datetime(raw_created)
        if parsed:
            created_times.append(parsed)
    if not created_times:
        return ("", "")
    created_times.sort()
    return (
        created_times[0].astimezone(timezone.utc).replace(microsecond=0).isoformat(),
        created_times[-1].astimezone(timezone.utc).replace(microsecond=0).isoformat(),
    )


def _team_rows_from_cache(cache: dict[str, Any], week_labels: list[str], group: str) -> list[TeamWeeklyRow]:
    counts_key = "created" if group == "created" else "fixed"
    issue_key_key = "createdIssueKeys" if group == "created" else "fixedIssueKeys"
    counts_by_week = cache.get(counts_key) if isinstance(cache, dict) else {}
    issue_keys_by_week = cache.get(issue_key_key) if isinstance(cache, dict) else {}
    if not isinstance(counts_by_week, dict):
        counts_by_week = {}
    if not isinstance(issue_keys_by_week, dict):
        issue_keys_by_week = {}

    totals: dict[str, int] = {}
    for week_label in week_labels:
        week_counts = counts_by_week.get(week_label)
        if not isinstance(week_counts, dict):
            continue
        for team, count in week_counts.items():
            if isinstance(team, str):
                totals[team] = totals.get(team, 0) + int(count or 0)

    ordered_teams = sorted(totals.keys(), key=lambda team: (-totals[team], team))
    out: list[TeamWeeklyRow] = []
    for team in ordered_teams:
        values: list[int] = []
        issue_keys: list[list[str]] = []
        for week_label in week_labels:
            week_counts = counts_by_week.get(week_label)
            count = 0
            if isinstance(week_counts, dict):
                count = int(week_counts.get(team, 0) or 0)
            values.append(count)
            week_issue_keys = issue_keys_by_week.get(week_label)
            if isinstance(week_issue_keys, dict):
                raw_keys = week_issue_keys.get(team, [])
                if isinstance(raw_keys, list):
                    issue_keys.append([str(item) for item in raw_keys if isinstance(item, str)])
                    continue
            issue_keys.append([])
        out.append(TeamWeeklyRow(team=team, values=values, issueKeysByWeek=issue_keys))
    return out


def _upsert_project_summary(project_key: str, cycle_label: str, issues: list[dict[str, Any]]) -> None:
    active_issues = [issue for issue in issues if not issue.get("removed_at", "").strip()]
    teams = set()
    for issue in active_issues:
        reporter = str(issue.get("reporter") or "").strip()
        teams.add(_resolve_unknown_team_bucket(str(issue.get("reporter_team") or ""), reporter, UNKNOWN_CREATED_TEAM))
        teams.add(_resolve_unknown_team_bucket(str(issue.get("assignee_team") or ""), reporter, UNKNOWN_FIXED_TEAM))
    synced_at = _utcnow_iso()
    with get_conn() as conn:
        existing = conn.execute("SELECT display_name, similarity FROM project_summary WHERE name = ?", (project_key,)).fetchone()
        display_name = existing["display_name"] if existing else ""
        similarity = existing["similarity"] if existing else None
        conn.execute(
            """
            INSERT INTO project_summary(name, display_name, cycle, defects, teams, similarity, source, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
              display_name = excluded.display_name,
              cycle = excluded.cycle,
              defects = excluded.defects,
              teams = excluded.teams,
              similarity = excluded.similarity,
              source = excluded.source,
              updated_at = excluded.updated_at
            """,
            (
                project_key,
                display_name or "",
                cycle_label,
                len(active_issues),
                len(teams),
                similarity,
                "jira",
                synced_at,
            ),
        )


def _replace_project_weekly(project_key: str, weekly_rows: list[WeeklyPoint]) -> None:
    synced_at = _utcnow_iso()
    with get_conn() as conn:
        conn.execute("DELETE FROM project_weekly WHERE project_name = ? AND source IN ('history', 'jira')", (project_key,))
        for source in ("history", "jira"):
            for row in weekly_rows:
                conn.execute(
                    """
                    INSERT INTO project_weekly(
                      project_name, source, forecast_version_id, week_label, week, date,
                      created_count, fixed_count, cum_created, cum_fixed, backlog
                    ) VALUES(?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        project_key,
                        source,
                        row.weekLabel,
                        row.week,
                        row.date,
                        row.created,
                        row.fixed,
                        row.cumCreated,
                        row.cumFixed,
                        row.backlog,
                    ),
                )


def _store_team_weekly(project_key: str, team_cache: dict[str, Any]) -> None:
    synced_at = _utcnow_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO app_config(key, value, updated_at)
            VALUES(?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (f"{TEAM_WEEKLY_KEY_PREFIX}{project_key}", json_dumps(team_cache), synced_at),
        )


def _load_team_weekly(project_key: str) -> dict[str, Any]:
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM app_config WHERE key = ?", (f"{TEAM_WEEKLY_KEY_PREFIX}{project_key}",)).fetchone()
    if not row:
        return {}
    try:
        payload = json.loads(row["value"])
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _write_project_import_state(
    project_key: str,
    *,
    request_kind: str,
    bounded_jql: str,
    mode: str,
    mapping_index: dict[str, str],
    active_issue_count: int,
) -> None:
    synced_at = _utcnow_iso()
    last_full_sync_at = synced_at if request_kind == "full" else ""
    last_incremental_sync_at = synced_at if mode == "incremental" else ""
    snapshot_version = hashlib.sha256(f"{project_key}:{synced_at}:{active_issue_count}".encode("utf-8")).hexdigest()[:16]
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT last_full_sync_at, last_incremental_sync_at FROM project_import_state WHERE project_key = ?",
            (project_key,),
        ).fetchone()
        if existing and not last_full_sync_at:
            last_full_sync_at = str(existing["last_full_sync_at"] or "")
        if existing and not last_incremental_sync_at:
            last_incremental_sync_at = str(existing["last_incremental_sync_at"] or "")
        conn.execute(
            """
            INSERT INTO project_import_state(
              project_key, last_sync_at, last_full_sync_at, last_incremental_sync_at, last_mode,
              last_request_kind, last_jql, field_mapping_version, issue_snapshot_version, issue_count, updated_at
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_key) DO UPDATE SET
              last_sync_at = excluded.last_sync_at,
              last_full_sync_at = excluded.last_full_sync_at,
              last_incremental_sync_at = excluded.last_incremental_sync_at,
              last_mode = excluded.last_mode,
              last_request_kind = excluded.last_request_kind,
              last_jql = excluded.last_jql,
              field_mapping_version = excluded.field_mapping_version,
              issue_snapshot_version = excluded.issue_snapshot_version,
              issue_count = excluded.issue_count,
              updated_at = excluded.updated_at
            """,
            (
                project_key,
                synced_at,
                last_full_sync_at,
                last_incremental_sync_at,
                mode,
                request_kind,
                bounded_jql,
                _mapping_version(mapping_index),
                snapshot_version,
                active_issue_count,
                synced_at,
            ),
        )


def _record_jira_sync(project_key: str, req: JiraFetchRequest, fetched_count: int, written_count: int) -> None:
    synced_at = _utcnow_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO jira_sync(id, project_name, start_week, end_week, jql, mode, fetched_count, written_count, synced_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                uuid4().hex,
                project_key,
                req.startWeek,
                req.endWeek,
                req.jql,
                req.mode,
                fetched_count,
                written_count,
                synced_at,
            ),
        )


def _write_debug_snapshot(
    req: JiraFetchRequest,
    *,
    project_key: str,
    request_jql: str,
    bounded_jql: str,
    requested_fields: list[str],
    fetched_count: int,
    written_count: int,
    cycle_label: str,
    issues: list[dict[str, Any]],
    error: str = "",
) -> None:
    sample = []
    for issue in issues[:8]:
        sample.append(
            JiraIssueDebugRow(
                key=issue["issue_key"],
                created=issue.get("created_at", ""),
                resolved=_fixed_time(issue),
                assignee=issue.get("assignee", ""),
                summary=issue.get("summary", ""),
                reporterTeam=issue.get("reporter_team", ""),
                assigneeTeam=issue.get("assignee_team", ""),
                verifiedSw=issue.get("verified_sw_at", ""),
            )
        )
    payload = JiraFetchDebugInfo(
        projectKey=project_key,
        pullMode=req.pullMode,
        mode=req.mode,
        cycleLabel=cycle_label,
        requestJql=request_jql,
        boundedJql=bounded_jql,
        fetchedCount=fetched_count,
        writtenCount=written_count,
        syncedAt=_utcnow_iso(),
        requestedFields=requested_fields,
        sampleIssues=sample,
        error=error,
    )
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO app_config(key, value, updated_at)
            VALUES(?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (f"{JIRA_DEBUG_KEY_PREFIX}{project_key}", payload.model_dump_json(), _utcnow_iso()),
        )


def get_jira_fetch_debug(project_key: str) -> JiraFetchDebugInfo | None:
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM app_config WHERE key = ?", (f"{JIRA_DEBUG_KEY_PREFIX}{_normalize_project_key(project_key)}",)).fetchone()
    if not row:
        return None
    try:
        return JiraFetchDebugInfo.model_validate_json(row["value"])
    except Exception:
        return None


def record_jira_fetch_error(req: JiraFetchRequest, error: str) -> None:
    project_key = _normalize_project_key(req.projectKey)
    request_kind, request_jql, bounded_jql = _build_fetch_plan(req)
    _write_debug_snapshot(
        req,
        project_key=project_key,
        request_jql=request_jql,
        bounded_jql=bounded_jql,
        requested_fields=[],
        fetched_count=0,
        written_count=0,
        cycle_label="",
        issues=[],
        error=error,
    )


def jira_sync(req: JiraFetchRequest) -> JiraFetchResult:
    project_key = _normalize_project_key(req.projectKey)
    if not project_key:
        raise ValueError("请填写项目 Key")
    mapping_index = _field_mapping_index()
    request_kind, request_jql, bounded_jql = _build_fetch_plan(req)
    requested_fields = _requested_issue_fields(mapping_index)
    raw_issues = search_issues_paged(
        req,
        jql=bounded_jql,
        fields=requested_fields,
        page_sizes=[5000, 1000, 200],
    )
    normalized_issues = [_normalize_issue(issue, mapping_index, project_key) for issue in raw_issues]
    issue_keys = [issue["issue_key"] for issue in normalized_issues if issue.get("issue_key")]
    if not issue_keys:
        cycle_label = ""
        _upsert_project_summary(project_key, cycle_label, [])
        _replace_project_weekly(project_key, [])
        _store_team_weekly(project_key, {"created": {}, "fixed": {}, "createdIssueKeys": {}, "fixedIssueKeys": {}})
        _write_project_import_state(
            project_key,
            request_kind=request_kind,
            bounded_jql=bounded_jql,
            mode=req.mode,
            mapping_index=mapping_index,
            active_issue_count=0,
        )
        _record_jira_sync(project_key, req, 0, 0)
        _write_debug_snapshot(
            req,
            project_key=project_key,
            request_jql=request_jql,
            bounded_jql=bounded_jql,
            requested_fields=requested_fields,
            fetched_count=0,
            written_count=0,
            cycle_label="",
            issues=[],
        )
        return JiraFetchResult(
            syncedAt=_utcnow_iso(),
            cycleLabel="",
            fetchedCount=0,
            writtenCount=0,
            status="success",
            periodStart="",
            periodEnd="",
        )

    with get_conn() as conn:
        for issue in normalized_issues:
            conn.execute(
                """
                INSERT INTO jira_issue(
                  issue_key, project_key, issue_type, status, created_at, updated_at, resolved_at,
                  verified_sw_at, closed_at, postponed_at, deleted_at, removed_at,
                  reporter_team, assignee_team, raw_fields_json
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(issue_key) DO UPDATE SET
                  project_key = excluded.project_key,
                  issue_type = excluded.issue_type,
                  status = excluded.status,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at,
                  resolved_at = excluded.resolved_at,
                  verified_sw_at = excluded.verified_sw_at,
                  closed_at = excluded.closed_at,
                  postponed_at = excluded.postponed_at,
                  deleted_at = excluded.deleted_at,
                  removed_at = '',
                  reporter_team = excluded.reporter_team,
                  assignee_team = excluded.assignee_team,
                  raw_fields_json = excluded.raw_fields_json
                """,
                (
                    issue["issue_key"],
                    issue["project_key"],
                    issue["issue_type"],
                    issue["status"],
                    issue["created_at"],
                    issue["updated_at"],
                    issue["resolved_at"],
                    issue["verified_sw_at"],
                    issue["closed_at"],
                    issue["postponed_at"],
                    issue["deleted_at"],
                    "",
                    issue["reporter_team"],
                    issue["assignee_team"],
                    issue["raw_fields_json"],
                ),
            )
            conn.execute("DELETE FROM jira_issue_component WHERE issue_key = ?", (issue["issue_key"],))
            for order, component_name in enumerate(issue["components"]):
                conn.execute(
                    """
                    INSERT INTO jira_issue_component(issue_key, component_name, component_order)
                    VALUES(?, ?, ?)
                    """,
                    (issue["issue_key"], component_name, order),
                )

        if issue_keys and (request_kind == "full" or req.mode == "overwrite"):
            placeholders = ",".join("?" for _ in issue_keys)
            conn.execute(
                f"UPDATE jira_issue SET removed_at = ? WHERE project_key = ? AND issue_key NOT IN ({placeholders})",
                (_utcnow_iso(), project_key, *issue_keys),
            )

        active_issue_rows = conn.execute(
            """
            SELECT issue_key, project_key, issue_type, status, created_at, updated_at, resolved_at,
                   verified_sw_at, closed_at, postponed_at, deleted_at, removed_at,
                   reporter_team, assignee_team, raw_fields_json
            FROM jira_issue
            WHERE project_key = ? AND IFNULL(removed_at, '') = ''
            ORDER BY created_at
            """,
            (project_key,),
        ).fetchall()

    active_issues: list[dict[str, Any]] = []
    created_fixes: list[tuple[str, str]] = []
    for row in active_issue_rows:
        base = dict(row)
        before = str(base.get("created_at") or "").strip()
        d = _enrich_issue_row_from_stored_raw(base)
        after = str(d.get("created_at") or "").strip()
        if after and after != before and d.get("issue_key"):
            created_fixes.append((str(d["issue_key"]), after))
        d.pop("raw_fields_json", None)
        active_issues.append(d)
    if created_fixes:
        with get_conn() as conn:
            for issue_key, created_at in created_fixes:
                conn.execute("UPDATE jira_issue SET created_at = ? WHERE issue_key = ?", (created_at, issue_key))
    weekly_rows, team_cache = _build_weekly_rows(active_issues)
    cycle_label = f"{weekly_rows[0].weekLabel} - {weekly_rows[-1].weekLabel}" if weekly_rows else ""
    period_start, period_end = _created_period_bounds(active_issues)
    _upsert_project_summary(project_key, cycle_label, active_issues)
    _replace_project_weekly(project_key, weekly_rows)
    _store_team_weekly(project_key, team_cache)
    _write_project_import_state(
        project_key,
        request_kind=request_kind,
        bounded_jql=bounded_jql,
        mode=req.mode,
        mapping_index=mapping_index,
        active_issue_count=len(active_issues),
    )
    _record_jira_sync(project_key, req, len(normalized_issues), len(active_issues))
    _write_debug_snapshot(
        req,
        project_key=project_key,
        request_jql=request_jql,
        bounded_jql=bounded_jql,
        requested_fields=requested_fields,
        fetched_count=len(normalized_issues),
        written_count=len(active_issues),
        cycle_label=cycle_label,
        issues=normalized_issues,
    )
    return JiraFetchResult(
        syncedAt=_utcnow_iso(),
        cycleLabel=cycle_label,
        fetchedCount=len(normalized_issues),
        writtenCount=len(active_issues),
        status="success",
        periodStart=period_start,
        periodEnd=period_end,
    )


def list_project_summaries() -> list[ProjectSummary]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT name, display_name, cycle, defects, teams, similarity
            FROM project_summary
            ORDER BY datetime(updated_at) DESC, name ASC
            """
        ).fetchall()
    return [
        ProjectSummary(
            name=str(row["name"]),
            displayName=str(row["display_name"] or "").strip() or None,
            cycle=str(row["cycle"] or ""),
            defects=int(row["defects"] or 0),
            teams=int(row["teams"] or 0),
            similarity=float(row["similarity"]) if row["similarity"] is not None else None,
        )
        for row in rows
    ]


def upsert_cached_projects(projects: list[ProjectSummary]) -> list[ProjectSummary]:
    now = _utcnow_iso()
    with get_conn() as conn:
        for project in projects:
            key = _normalize_project_key(project.name)
            existing = conn.execute("SELECT source, updated_at FROM project_summary WHERE name = ?", (key,)).fetchone()
            source = str(existing["source"] or "history") if existing else "history"
            conn.execute(
                """
                INSERT INTO project_summary(name, display_name, cycle, defects, teams, similarity, source, updated_at)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                  display_name = CASE
                    WHEN excluded.display_name <> '' THEN excluded.display_name
                    ELSE project_summary.display_name
                  END,
                  cycle = CASE WHEN excluded.cycle <> '' THEN excluded.cycle ELSE project_summary.cycle END,
                  defects = excluded.defects,
                  teams = excluded.teams,
                  similarity = excluded.similarity,
                  source = excluded.source,
                  updated_at = excluded.updated_at
                """,
                (
                    key,
                    project.displayName or "",
                    project.cycle,
                    project.defects,
                    project.teams,
                    project.similarity,
                    source,
                    now,
                ),
            )
    return list_project_summaries()


def delete_cached_project(project_name: str) -> bool:
    key = _normalize_project_key(project_name)
    with get_conn() as conn:
        existed = conn.execute("SELECT 1 FROM project_summary WHERE name = ?", (key,)).fetchone()
        if not existed:
            return False
        issue_keys = [row["issue_key"] for row in conn.execute("SELECT issue_key FROM jira_issue WHERE project_key = ?", (key,)).fetchall()]
        conn.execute("DELETE FROM project_summary WHERE name = ?", (key,))
        conn.execute("DELETE FROM project_weekly WHERE project_name = ?", (key,))
        conn.execute("DELETE FROM jira_issue WHERE project_key = ?", (key,))
        conn.execute("DELETE FROM project_import_state WHERE project_key = ?", (key,))
        conn.execute("DELETE FROM jira_sync WHERE project_name = ?", (key,))
        conn.execute("DELETE FROM app_config WHERE key IN (?, ?, ?)", (f"{TEAM_WEEKLY_KEY_PREFIX}{key}", f"{JIRA_DEBUG_KEY_PREFIX}{key}", f"jira_team_weekly::{project_name}"))
        for issue_key in issue_keys:
            conn.execute("DELETE FROM jira_issue_component WHERE issue_key = ?", (issue_key,))
    return True


def _load_summary(project_name: str) -> ProjectSummary | None:
    key = _normalize_project_key(project_name)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT name, display_name, cycle, defects, teams, similarity FROM project_summary WHERE name = ?",
            (key,),
        ).fetchone()
    if not row:
        return None
    return ProjectSummary(
        name=str(row["name"]),
        displayName=str(row["display_name"] or "").strip() or None,
        cycle=str(row["cycle"] or ""),
        defects=int(row["defects"] or 0),
        teams=int(row["teams"] or 0),
        similarity=float(row["similarity"]) if row["similarity"] is not None else None,
    )


def _load_weekly_source(project_name: str, source: str) -> list[WeeklyPoint]:
    key = _normalize_project_key(project_name)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT week_label, week, date, created_count, fixed_count, cum_created, cum_fixed, backlog
            FROM project_weekly
            WHERE project_name = ? AND source = ? AND (forecast_version_id IS NULL OR forecast_version_id = '')
            """,
            (key, source),
        ).fetchall()
    weekly = [
        WeeklyPoint(
            week=str(row["week"]),
            weekLabel=str(row["week_label"]),
            date=str(row["date"] or ""),
            created=int(row["created_count"] or 0),
            fixed=int(row["fixed_count"] or 0),
            cumCreated=int(row["cum_created"] or 0),
            cumFixed=int(row["cum_fixed"] or 0),
            backlog=int(row["backlog"] or 0),
        )
        for row in rows
    ]
    weekly.sort(key=lambda row: (*_parse_year_week(row.weekLabel), row.weekLabel))
    return weekly


def _count_active_issues(project_name: str) -> int:
    key = _normalize_project_key(project_name)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM jira_issue WHERE project_key = ? AND IFNULL(removed_at, '') = ''",
            (key,),
        ).fetchone()
    return int(row["n"] or 0) if row else 0


def _try_refresh_weekly_if_empty(project_name: str) -> bool:
    """
    project_weekly 为空但 jira_issue 仍有活跃缺陷时，从本地事实表重新聚合并写回周表与团队缓存。
    用于修复历史同步中 created 未写入列、或仅依赖周表导致详情全空的项目。
    """
    key = _normalize_project_key(project_name)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM jira_issue WHERE project_key = ? AND IFNULL(removed_at, '') = ''",
            (key,),
        ).fetchone()
        if not row or int(row["n"] or 0) == 0:
            return False
        issue_rows = conn.execute(
            """
            SELECT issue_key, project_key, issue_type, status, created_at, updated_at, resolved_at,
                   verified_sw_at, closed_at, postponed_at, deleted_at, removed_at,
                   reporter_team, assignee_team, raw_fields_json
            FROM jira_issue
            WHERE project_key = ? AND IFNULL(removed_at, '') = ''
            ORDER BY created_at, issue_key
            """,
            (key,),
        ).fetchall()

    active_issues: list[dict[str, Any]] = []
    created_fixes: list[tuple[str, str]] = []
    for r in issue_rows:
        base = dict(r)
        before = str(base.get("created_at") or "").strip()
        d = _enrich_issue_row_from_stored_raw(base)
        after = str(d.get("created_at") or "").strip()
        if after and after != before and d.get("issue_key"):
            created_fixes.append((str(d["issue_key"]), after))
        d.pop("raw_fields_json", None)
        active_issues.append(d)

    weekly_rows, team_cache = _build_weekly_rows(active_issues)
    if not weekly_rows:
        return False

    cycle_label = f"{weekly_rows[0].weekLabel} - {weekly_rows[-1].weekLabel}"
    _upsert_project_summary(key, cycle_label, active_issues)
    _replace_project_weekly(key, weekly_rows)
    _store_team_weekly(key, team_cache)
    if created_fixes:
        with get_conn() as conn:
            for issue_key, created_at in created_fixes:
                conn.execute("UPDATE jira_issue SET created_at = ? WHERE issue_key = ?", (created_at, issue_key))
    return True


def get_project_history(project_name: str) -> ProjectHistory:
    summary = _load_summary(project_name)
    weekly_rows = _load_weekly_source(project_name, "history")
    if not weekly_rows:
        weekly_rows = _load_weekly_source(project_name, "jira")
    if not weekly_rows and summary is not None and summary.defects > 0:
        repaired = _repair_issue_project_key(summary.name)
        if repaired:
            logger.info("repaired issue project_key by raw project.key, project=%s repaired=%s", summary.name, repaired)
        if _try_refresh_weekly_if_empty(summary.name):
            summary = _load_summary(project_name)
            weekly_rows = _load_weekly_source(project_name, "history")
            if not weekly_rows:
                weekly_rows = _load_weekly_source(project_name, "jira")
    if weekly_rows and summary is not None:
        active_issue_count = _count_active_issues(summary.name)
        weekly_total_created = int(weekly_rows[-1].cumCreated if weekly_rows else 0)
        # 自愈历史脏数据：当周聚合总创建量与当前活跃 issue 数不一致时，按事实表重建周聚合。
        if active_issue_count > 0 and weekly_total_created != active_issue_count:
            logger.warning(
                "weekly/source drift detected, project=%s weekly_cum_created=%s active_issue_count=%s; rebuilding weekly",
                summary.name,
                weekly_total_created,
                active_issue_count,
            )
            if _try_refresh_weekly_if_empty(summary.name):
                summary = _load_summary(project_name)
                weekly_rows = _load_weekly_source(project_name, "history")
                if not weekly_rows:
                    weekly_rows = _load_weekly_source(project_name, "jira")
    if not summary and not weekly_rows:
        raise ValueError(f"Project not found: {project_name}")
    if not summary:
        cycle = f"{weekly_rows[0].weekLabel} - {weekly_rows[-1].weekLabel}" if weekly_rows else ""
        summary = ProjectSummary(name=_normalize_project_key(project_name), displayName=None, cycle=cycle, defects=0, teams=0)
    team_cache = _load_team_weekly(summary.name)
    week_labels = [row.weekLabel for row in weekly_rows]
    created_teams = _team_rows_from_cache(team_cache, week_labels, "created")
    fixed_teams = _team_rows_from_cache(team_cache, week_labels, "fixed")
    return ProjectHistory(
        name=summary.name,
        displayName=summary.displayName,
        cycle=summary.cycle,
        defects=summary.defects,
        teams=summary.teams,
        similarity=summary.similarity,
        weekly=weekly_rows,
        createdTeams=created_teams,
        fixedTeams=fixed_teams,
        milestones=[],
    )


def _load_forecast_result(project_name: str, forecast_version_id: str | None) -> tuple[str | None, ForecastResult | None]:
    key = _normalize_project_key(project_name)
    with get_conn() as conn:
        if forecast_version_id:
            row = conn.execute(
                """
                SELECT id, result_json
                FROM forecast_version
                WHERE id = ? AND project_name = ? AND deleted_at IS NULL
                """,
                (forecast_version_id, key),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT id, result_json
                FROM forecast_version
                WHERE project_name = ? AND deleted_at IS NULL
                ORDER BY datetime(created_at) DESC
                LIMIT 1
                """,
                (key,),
            ).fetchone()
    if not row:
        return (forecast_version_id, None)
    try:
        payload = json.loads(row["result_json"])
        return (str(row["id"]), ForecastResult.model_validate(payload))
    except Exception:
        return (str(row["id"]), None)


def build_compare(project_name: str, forecastVersionId: str | None = None) -> CompareResponse:
    summary = _load_summary(project_name)
    history_rows = _load_weekly_source(project_name, "history")
    jira_rows = _load_weekly_source(project_name, "jira")
    if not history_rows and jira_rows:
        history_rows = jira_rows
    if not jira_rows and history_rows:
        jira_rows = history_rows
    if not history_rows and not jira_rows and not summary:
        raise ValueError(f"Project not found: {project_name}")

    effective_version_id, forecast = _load_forecast_result(project_name, forecastVersionId)
    history_map = {row.weekLabel: row for row in history_rows}
    jira_map = {row.weekLabel: row for row in jira_rows}
    forecast_map = {row.weekLabel: row for row in (forecast.dataset.weekly if forecast else [])}
    week_labels = _sort_week_labels([*history_map.keys(), *jira_map.keys(), *forecast_map.keys()])
    weekly: list[CompareSeriesPoint] = []
    for week_label in week_labels:
        history_row = history_map.get(week_label)
        jira_row = jira_map.get(week_label)
        forecast_row = forecast_map.get(week_label)
        weekly.append(
            CompareSeriesPoint(
                weekLabel=week_label,
                historyCreated=history_row.created if history_row else 0,
                historyFixed=history_row.fixed if history_row else 0,
                jiraCreated=jira_row.created if jira_row else 0,
                jiraFixed=jira_row.fixed if jira_row else 0,
                forecastCreated=forecast_row.created if forecast_row else 0,
                forecastFixed=forecast_row.fixed if forecast_row else 0,
                backlogHistory=history_row.backlog if history_row else 0,
                backlogJira=jira_row.backlog if jira_row else 0,
                backlogForecast=forecast_row.backlog if forecast_row else 0,
            )
        )
    metrics = CompareMetrics(
        totalHistoryCreated=sum(row.historyCreated for row in weekly),
        totalJiraCreated=sum(row.jiraCreated for row in weekly),
        totalForecastCreated=sum(row.forecastCreated for row in weekly),
        jiraVsForecastGap=sum(row.forecastCreated for row in weekly) - sum(row.jiraCreated for row in weekly),
        historyVsForecastGap=sum(row.forecastCreated for row in weekly) - sum(row.historyCreated for row in weekly),
    )
    return CompareResponse(
        projectName=summary.name if summary else _normalize_project_key(project_name),
        forecastVersionId=effective_version_id,
        metrics=metrics,
        weekly=weekly,
    )
