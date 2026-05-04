from __future__ import annotations

import hashlib
import json
import logging
import threading
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

import pandas as pd

from app.db import DEFAULT_DATA_DIR, ensure_data_dir, get_conn
from app.jira_client import search_issues_paged
from app.models import (
    BugDistCountRow,
    BugDistCreateTaskRequest,
    BugDistTabResult,
    BugDistTaskProgress,
    BugDistTaskResult,
    BugDistTaskStatus,
    JiraFetchRequest,
)

logger = logging.getLogger("drp.bug_dist")

BUG_DIST_CACHE_DIRNAME = "bug_dist_cache"
BUG_DIST_FIELD_VERSION = "issue-fact-v3"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _cache_dir() -> Path:
    ensure_data_dir()
    path = DEFAULT_DATA_DIR / BUG_DIST_CACHE_DIRNAME
    path.mkdir(parents=True, exist_ok=True)
    return path


def _hash_key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()[:24]


def _cache_key(req: BugDistCreateTaskRequest, project_key: str) -> str:
    base = req.baseUrl.strip().rstrip("/").lower()
    compare = (req.compareProjectKey or "").strip().upper()
    local_state = {
        "primarySnapshot": _project_snapshot_version(project_key.strip().upper()),
        "compareSnapshot": _project_snapshot_version(compare) if compare else "",
    }
    payload = {
        "baseUrl": base,
        "projectKey": project_key.strip().upper(),
        "compareProjectKey": compare,
        "startDate": req.startDate.strip(),
        "endDate": req.endDate.strip(),
        "fieldVersion": BUG_DIST_FIELD_VERSION,
        "teamFieldPath": req.teamFieldPath.strip() or "customfield_15319",
        "issueTypeClause": req.issueTypeClause.strip() or 'issuetype in (defect, defect_new)',
        "localState": local_state,
    }
    return _hash_key(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def _cache_path(req: BugDistCreateTaskRequest, project_key: str) -> Path:
    return _cache_dir() / f"bug_dist_{_cache_key(req, project_key)}.json"


def _infer_issue_counts(result: BugDistTaskResult) -> None:
    """旧版缓存 JSON 不含条数字段时，从聚合行回填。"""
    if result.primaryIssueCount <= 0 and result.module.rows:
        result.primaryIssueCount = int(sum(r.primary for r in result.module.rows))
    if result.compareProjectKey.strip() and result.compareIssueCount <= 0 and result.module.rows:
        result.compareIssueCount = int(sum(r.compare for r in result.module.rows))


def _read_cache(req: BugDistCreateTaskRequest, project_key: str) -> BugDistTaskResult | None:
    path = _cache_path(req, project_key)
    if not path.exists() or not path.is_file():
        return None
    try:
        raw = path.read_text(encoding="utf-8")
        payload = json.loads(raw) if raw else {}
        parsed = BugDistTaskResult.model_validate(payload)
        _infer_issue_counts(parsed)
        return parsed
    except Exception as e:
        logger.warning("bug dist cache read failed, path=%s, error=%s", path, repr(e))
        return None


def _write_cache(req: BugDistCreateTaskRequest, project_key: str, result: BugDistTaskResult) -> None:
    path = _cache_path(req, project_key)
    try:
        path.write_text(result.model_dump_json(indent=0, by_alias=True), encoding="utf-8")
    except Exception as e:
        logger.warning("bug dist cache write failed, path=%s, error=%s", path, repr(e))


def _jira_fetch_req_from_bug_req(req: BugDistCreateTaskRequest, project_key: str) -> JiraFetchRequest:
    return JiraFetchRequest(
        projectKey=project_key.strip(),
        startWeek="",
        endWeek="",
        pullMode="jql",
        jql="",
        startDate=req.startDate.strip(),
        endDate=req.endDate.strip(),
        mode="normal",
        baseUrl=req.baseUrl,
        authType=req.authType,
        username=req.username,
        token=req.token,
        verifySsl=req.verifySsl,
        timeoutSec=req.timeoutSec,
    )


def _parse_iso_date(raw: str) -> datetime | None:
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
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


def _is_created_in_range(created_at: str, start_date: str, end_date: str) -> bool:
    start = start_date.strip()
    end = end_date.strip()
    if not start and not end:
        return True
    parsed = _parse_iso_date(created_at)
    if not parsed:
        return False
    created_day = parsed.date().isoformat()
    if start and created_day < start:
        return False
    if end and created_day > end:
        return False
    return True


def _build_bug_dist_jql(project_key: str, issue_type_clause: str, start_date: str, end_date: str) -> str:
    clauses: list[str] = [f'project = "{project_key}"', issue_type_clause]
    start = start_date.strip()
    end = end_date.strip()
    if start:
        clauses.append(f'created >= "{start}"')
    if end:
        clauses.append(f'created <= "{end}"')
    return " AND ".join(clauses) + " ORDER BY created DESC"


def _extract_module(issue: dict[str, Any]) -> str:
    fields = issue.get("fields") if isinstance(issue, dict) else None
    if not isinstance(fields, dict):
        return "(None)"
    components = fields.get("components")
    if not isinstance(components, list) or not components:
        return "(None)"
    first = components[0]
    if not isinstance(first, dict):
        return "(None)"
    name = first.get("name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    return "(None)"


def _extract_reporter_team(issue: dict[str, Any], team_field_path: str) -> str:
    fields = issue.get("fields") if isinstance(issue, dict) else None
    if not isinstance(fields, dict):
        return "(Empty)"
    raw = fields.get(team_field_path)
    if not isinstance(raw, dict):
        return "(Empty)"
    value = raw.get("value")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return "(Empty)"


def _extract_reporter_name(issue: dict[str, Any]) -> str:
    fields = issue.get("fields") if isinstance(issue, dict) else None
    if not isinstance(fields, dict):
        return ""
    reporter = fields.get("reporter")
    if not isinstance(reporter, dict):
        return ""
    for key in ("name", "key", "accountId", "emailAddress", "displayName"):
        value = reporter.get(key)
        if isinstance(value, str) and value.strip():
            raw = value.strip()
            if key == "emailAddress" and "@" in raw:
                return raw.split("@", 1)[0].strip() or raw
            return raw
    return ""


def _is_unknown_team(team_name: str) -> bool:
    normalized = team_name.strip().lower()
    if not normalized:
        return True
    unknown_markers = {
        "(empty)",
        "(none)",
        "unknown",
        "unk",
        "未知",
    }
    if normalized in unknown_markers:
        return True
    return "未知团队" in normalized or "unknown team" in normalized


def _resolve_team_bucket(team_name: str, reporter_name: str) -> str:
    team = team_name.strip()
    if not _is_unknown_team(team):
        return team
    reporter = reporter_name.strip()
    if reporter:
        return f"测试未知团队-{reporter}"
    return "测试未知团队-(unknown-reporter)"


def _build_counters_from_remote_issues(issues: list[dict[str, Any]], team_field_path: str) -> tuple[Counter[str], Counter[str], int]:
    module_counter: Counter[str] = Counter()
    team_counter: Counter[str] = Counter()
    for issue in issues:
        raw_team = _extract_reporter_team(issue, team_field_path)
        reporter = _extract_reporter_name(issue)
        team_counter[_resolve_team_bucket(raw_team, reporter)] += 1
        fields = issue.get("fields") if isinstance(issue, dict) else None
        components = fields.get("components") if isinstance(fields, dict) else None
        names: list[str] = []
        if isinstance(components, list):
            for item in components:
                if isinstance(item, dict):
                    name = item.get("name")
                    if isinstance(name, str) and name.strip():
                        names.append(name.strip())
        if not names:
            names = ["(None)"]
        for name in dict.fromkeys(names):
            module_counter[name] += 1
    return module_counter, team_counter, len(issues)


def _project_snapshot_version(project_key: str) -> str:
    if not project_key:
        return ""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT issue_snapshot_version, last_sync_at FROM project_import_state WHERE project_key = ?",
            (project_key,),
        ).fetchone()
    if not row:
        return ""
    return str(row["issue_snapshot_version"] or row["last_sync_at"] or "")


def _build_counters_from_local(project_key: str, *, start_date: str = "", end_date: str = "") -> tuple[Counter[str], Counter[str], int]:
    normalized = project_key.strip().upper()
    if not normalized:
        return Counter(), Counter(), 0
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT i.issue_key, i.reporter_team, c.component_name, c.component_order
                   , i.created_at, i.raw_fields_json
            FROM jira_issue i
            LEFT JOIN jira_issue_component c ON c.issue_key = i.issue_key
            WHERE i.project_key = ? AND IFNULL(i.removed_at, '') = ''
            ORDER BY i.issue_key ASC, c.component_order ASC, c.component_name ASC
            """,
            (normalized,),
        ).fetchall()
    if not rows:
        return Counter(), Counter(), 0

    module_counter: Counter[str] = Counter()
    team_counter: Counter[str] = Counter()
    issue_count = 0
    current_key = ""
    current_team = ""
    current_reporter = ""
    current_created_at = ""
    current_components: list[str] = []

    def flush() -> None:
        nonlocal issue_count, current_key, current_team, current_reporter, current_components, current_created_at
        if not current_key:
            return
        if not _is_created_in_range(current_created_at, start_date, end_date):
            current_key = ""
            current_team = ""
            current_reporter = ""
            current_created_at = ""
            current_components = []
            return
        issue_count += 1
        team_counter[_resolve_team_bucket(current_team, current_reporter)] += 1
        modules = current_components or ["(None)"]
        for name in dict.fromkeys(modules):
            module_counter[name] += 1
        current_key = ""
        current_team = ""
        current_reporter = ""
        current_created_at = ""
        current_components = []

    for row in rows:
        issue_key = str(row["issue_key"] or "")
        if issue_key != current_key:
            flush()
            current_key = issue_key
            current_team = str(row["reporter_team"] or "").strip()
            current_created_at = str(row["created_at"] or "").strip()
            raw_fields = str(row["raw_fields_json"] or "").strip()
            if raw_fields:
                try:
                    parsed = json.loads(raw_fields)
                except Exception:
                    parsed = {}
                current_reporter = _extract_reporter_name({"fields": parsed if isinstance(parsed, dict) else {}})
            else:
                current_reporter = ""
        component_name = str(row["component_name"] or "").strip()
        if component_name:
            current_components.append(component_name)
    flush()
    return module_counter, team_counter, issue_count


def _align_counts(primary: Counter[str], compare: Counter[str] | None) -> list[BugDistCountRow]:
    compare_counter = compare or Counter()
    names = sorted(set(primary.keys()) | set(compare_counter.keys()))
    rows = [
        BugDistCountRow(
            name=name,
            primary=int(primary.get(name, 0)),
            compare=int(compare_counter.get(name, 0)),
            gap=int(compare_counter.get(name, 0) - primary.get(name, 0)),
        )
        for name in names
    ]
    rows.sort(key=lambda row: (row.primary == 0, -row.primary, -row.compare, row.name))
    return rows


def _build_tab_result(primary_counts: Counter[str], compare_counts: Counter[str] | None) -> BugDistTabResult:
    rows = _align_counts(primary_counts, compare_counts)
    top15 = rows[:15]
    return BugDistTabResult(rows=rows, top15=top15)


@dataclass
class _TaskState:
    status: Literal["running", "success", "failed"]
    progress: BugDistTaskProgress
    result: BugDistTaskResult | None
    error: str


_TASKS_LOCK = threading.Lock()
_TASKS: dict[str, _TaskState] = {}


def create_task(req: BugDistCreateTaskRequest) -> str:
    task_id = uuid4().hex
    with _TASKS_LOCK:
        _TASKS[task_id] = _TaskState(status="running", progress=BugDistTaskProgress(), result=None, error="")
    thread = threading.Thread(target=_run_task, args=(task_id, req), daemon=True)
    thread.start()
    return task_id


def get_task_status(task_id: str) -> BugDistTaskStatus:
    with _TASKS_LOCK:
        state = _TASKS.get(task_id)
    if not state:
        return BugDistTaskStatus(taskId=task_id, status="failed", error="任务不存在或已过期")
    return BugDistTaskStatus(
        taskId=task_id,
        status=state.status,
        progress=state.progress,
        result=state.result,
        error=state.error,
    )


def _set_progress(task_id: str, *, start_at: int, page_size: int, fetched: int, total: int, message: str = "") -> None:
    with _TASKS_LOCK:
        state = _TASKS.get(task_id)
        if not state:
            return
        state.progress = BugDistTaskProgress(
            pageSize=page_size,
            startAt=start_at,
            fetched=fetched,
            total=total,
            message=message,
        )


def _set_done(task_id: str, result: BugDistTaskResult, cached: bool) -> None:
    result.cached = cached
    with _TASKS_LOCK:
        state = _TASKS.get(task_id)
        if not state:
            return
        state.status = "success"
        state.result = result
        state.error = ""


def _set_failed(task_id: str, error: str) -> None:
    with _TASKS_LOCK:
        state = _TASKS.get(task_id)
        if not state:
            return
        state.status = "failed"
        state.error = error


def _run_task(task_id: str, req: BugDistCreateTaskRequest) -> None:
    primary_key = req.primaryProjectKey.strip().upper()
    compare_key = req.compareProjectKey.strip().upper() if req.compareProjectKey.strip() else ""
    team_field_path = req.teamFieldPath.strip() or "customfield_15319"
    issue_type_clause = req.issueTypeClause.strip() or 'issuetype in (defect, defect_new)'
    start_date = req.startDate.strip()
    end_date = req.endDate.strip()
    try:
        if not req.forceRefresh:
            cached = _read_cache(req, primary_key)
            if cached and (not compare_key or cached.compareProjectKey.strip().upper() == compare_key):
                cached.generatedAt = _utcnow_iso()
                _set_done(task_id, cached, cached=True)
                return

        _set_progress(task_id, start_at=0, page_size=0, fetched=0, total=0, message="读取本地项目事实数据…")
        primary_module_counts, primary_team_counts, primary_issue_n = _build_counters_from_local(
            primary_key,
            start_date=start_date,
            end_date=end_date,
        )
        if primary_issue_n <= 0:
            def progress_cb(start_at: int, page_size: int, fetched: int, total: int):
                _set_progress(task_id, start_at=start_at, page_size=page_size, fetched=fetched, total=total, message="主项目本地无数据，回退 Jira 拉取中…")

            jira_req = _jira_fetch_req_from_bug_req(req, primary_key)
            jql = _build_bug_dist_jql(primary_key, issue_type_clause, start_date, end_date)
            primary_issues = search_issues_paged(
                jira_req,
                jql=jql,
                fields=["components", "reporter", team_field_path],
                page_sizes=[5000, 1000, 200],
                on_progress=progress_cb,
            )
            primary_module_counts, primary_team_counts, primary_issue_n = _build_counters_from_remote_issues(primary_issues, team_field_path)

        compare_module_counts: Counter[str] | None = None
        compare_team_counts: Counter[str] | None = None
        compare_issue_n = 0
        if compare_key:
            _set_progress(task_id, start_at=0, page_size=0, fetched=0, total=0, message="读取对比项目本地事实数据…")
            compare_module_counts, compare_team_counts, compare_issue_n = _build_counters_from_local(
                compare_key,
                start_date=start_date,
                end_date=end_date,
            )
            if compare_issue_n <= 0:
                def progress_cb2(start_at: int, page_size: int, fetched: int, total: int):
                    _set_progress(task_id, start_at=start_at, page_size=page_size, fetched=fetched, total=total, message="对比项目本地无数据，回退 Jira 拉取中…")

                jira_req2 = _jira_fetch_req_from_bug_req(req, compare_key)
                jql2 = _build_bug_dist_jql(compare_key, issue_type_clause, start_date, end_date)
                compare_issues = search_issues_paged(
                    jira_req2,
                    jql=jql2,
                    fields=["components", "reporter", team_field_path],
                    page_sizes=[5000, 1000, 200],
                    on_progress=progress_cb2,
                )
                compare_module_counts, compare_team_counts, compare_issue_n = _build_counters_from_remote_issues(compare_issues, team_field_path)

        _set_progress(task_id, start_at=0, page_size=0, fetched=primary_issue_n, total=primary_issue_n, message="聚合统计中…")
        module_res = _build_tab_result(primary_module_counts, compare_module_counts)
        team_res = _build_tab_result(primary_team_counts, compare_team_counts)
        result = BugDistTaskResult(
            primaryProjectKey=primary_key,
            compareProjectKey=compare_key,
            generatedAt=_utcnow_iso(),
            cached=False,
            primaryIssueCount=primary_issue_n,
            compareIssueCount=compare_issue_n,
            module=module_res,
            team=team_res,
        )
        _write_cache(req, primary_key, result)
        _set_done(task_id, result, cached=False)
    except Exception as e:
        logger.exception("bug dist task failed, task=%s", task_id)
        _set_failed(task_id, str(e))


def export_tab_as_csv(result: BugDistTaskResult, tab: Literal["module", "team"]) -> bytes:
    rows = result.module.rows if tab == "module" else result.team.rows
    df = pd.DataFrame([r.model_dump() for r in rows])
    return df.to_csv(index=False).encode("utf-8-sig")


def export_tab_as_xlsx(result: BugDistTaskResult, tab: Literal["module", "team"]) -> bytes:
    rows = result.module.rows if tab == "module" else result.team.rows
    df = pd.DataFrame([r.model_dump() for r in rows])
    bio = BytesIO()
    with pd.ExcelWriter(bio, engine="openpyxl") as writer:
        sheet = "module" if tab == "module" else "team"
        df.to_excel(writer, index=False, sheet_name=sheet)
    return bio.getvalue()
