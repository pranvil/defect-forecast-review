from __future__ import annotations

import hashlib
from datetime import date, datetime, timedelta
import json
import re
from typing import Iterable
from uuid import uuid4

from app.db import get_conn, json_dumps
from app.jira_client import list_issue_search_fields, search_issues
from app.models import (
    CompareColorsConfig,
    CompareMetrics,
    CompareResponse,
    CompareSeriesPoint,
    FieldMappingRow,
    ForecastDefaults,
    ForecastInput,
    ForecastParams,
    ForecastResult,
    ForecastVersionRow,
    JiraFetchRequest,
    JiraFetchResult,
    JiraFetchDebugInfo,
    JiraIssueDebugRow,
    MilestoneLabel,
    MilestoneParam,
    ProjectHistory,
    ProjectSummary,
    RefProjectRow,
    TeamConfigRow,
    TeamWeeklyRow,
    WeeklyPoint,
)

DEFAULT_PROJECTS = [
    ("Monet NP Dish", "26W2-26W27", 980, 8, 91.0),
    ("Beryl TMO", "26W4-26W29", 1126, 9, 84.0),
    ("Goldfinch TMO", "26W3-26W26", 865, 8, 79.0),
    ("Atlas VZW", "26W6-26W30", 1038, 8, 68.0),
]

SIMILARITY_WEIGHTS = (
    ("projectCategory", 0.25),
    ("region", 0.20),
    ("os", 0.15),
    ("chipsetVendor", 0.10),
    ("operatorOverlap", 0.20),
    ("frQuantityBand", 0.10),
)

IDH_SIMILARITY_WEIGHTS = (
    ("projectCategory", 0.20),
    ("idhVendor", 0.25),
    ("region", 0.15),
    ("os", 0.10),
    ("chipsetVendor", 0.10),
    ("operatorOverlap", 0.15),
    ("frQuantityBand", 0.05),
)

IDH_PROJECT_CATEGORIES = {"idh联合项目", "idh全o"}
FR_QUANTITY_BANDS = (500, 1000, *range(1500, 20001, 500))
PIPELINE_FACTORS = {
    "全部": 1.08,
    "冒烟": 1.01,
    "无冒烟": 0.99,
    "不部署": 0.92,
    "无": 0.92,
}

DEFAULT_TEAMS: list[TeamConfigRow] = [
    TeamConfigRow(id="testing-google-xts", name="Google XTS", type="testing", enabled=True, note="软件质量保障二中心-系统质量三部-Google测试组"),
    TeamConfigRow(id="testing-system", name="系统测试组", type="testing", enabled=True, note="软件质量保障二中心-系统质量三部-系统测试一组，软件质量保障二中心-系统质量二部-运营商系统测试二组，软件质量保障二中心-系统质量二部-运营商系统测试三组，软件质量保障二中心-系统质量三部-系统测试二组，软件质量保障二中心-系统质量二部-运营商系统测试组，软件质量保障二中心-系统质量三部-应用测试组"),
    TeamConfigRow(id="testing-na-delivery", name="北美需求交付组", type="testing", enabled=True, note="软件质量保障二中心-系统质量二部-北美需求交付组"),
    TeamConfigRow(id="testing-na", name="北美测试部", type="testing", enabled=True, note="软件质量保障二中心-北美测试部"),
    TeamConfigRow(id="testing-special", name="专项测试组", type="testing", enabled=True, note="软件质量保障二中心-专项与协议测试部-专项自动化组，软件质量保障二中心-专项与协议测试部-运营商专项测试二组，软件质量保障二中心-专项与协议测试部-运营商专项测试一组"),
    TeamConfigRow(id="testing-protocol", name="协议测试组", type="testing", enabled=True, note="软件质量保障二中心-专项与协议测试部-运营商协议测试一组，软件质量保障二中心-专项与协议测试部-运营商协议测试二组"),
    TeamConfigRow(id="testing-pipeline", name="流水线", type="testing", enabled=True, note="软件质量保障二中心-系统质量二部-质效自动化组，测试未知团队-swtc_devops"),
    TeamConfigRow(id="testing-hera-user-apruut", name="Hera/Usersupport/APRUUT", type="testing", enabled=True, note="MP PL-PQ-QPM Team，MP PL-Q&CC-PQ&NPS，MP BU-Q&CC-PQ&NPS，测试未知团队-usersupport，测试未知团队-devops.tms"),
    TeamConfigRow(id="development-protocol", name="协议技术部", type="development", enabled=True, note="移动解决方案中心-协议技术部-协议开发一组，移动解决方案中心-协议技术部-协议开发二组，系统应用开发中心-协议技术部-协议开发一组，移动解决方案二中心-协议技术部-协议开发一组，移动解决方案二中心-协议技术部-协议开发四组，移动解决方案二中心-协议技术部-协议开发二组"),
    TeamConfigRow(id="development-bsp", name="底软技术部", type="development", enabled=True, note="移动解决方案中心-底软技术部-系统开发二组，移动解决方案中心-底软技术部-设备安全组，移动解决方案中心-底软技术部-充电方案组，移动解决方案中心-底软技术部-工业生产组，移动解决方案中心-底软技术部-系统开发一组，移动解决方案中心-底软技术部-系统开发三组，移动解决方案中心-底软技术部-机芯平台组，移动解决方案中心-底软技术部，移动解决方案中心-底软技术部-功耗充电组，移动解决方案一中心-底软技术部-机芯预研组，移动解决方案一中心-底软技术部-设备安全组，移动解决方案一中心-底软技术部-系统开发一组，移动解决方案一中心-底软技术部-功耗充电组，移动解决方案一中心-底软技术部-系统开发二组，移动解决方案一中心-底软技术部-DFX组，移动解决方案一中心-底软技术部-ODC一组"),
    TeamConfigRow(id="development-system", name="系统技术部", type="development", enabled=True, note="移动解决方案中心-系统技术部-交互窗口组，移动解决方案中心-系统技术部-多媒体连接组，移动解决方案中心-系统技术部-框架开发一组，移动解决方案中心-系统技术部-框架开发二组，移动解决方案中心-系统技术部-显示技术组，移动解决方案中心-系统技术部-核心服务组，移动解决方案中心-系统技术部-续航优化组，移动解决方案中心-系统技术部-系统稳定性组，移动解决方案中心-系统技术部，移动解决方案一中心-系统技术部-多媒体连接组，移动解决方案一中心-系统技术部-性能解决方案组，移动解决方案一中心-系统技术部-核心服务组，移动解决方案一中心-系统技术部-框架开发一组，移动解决方案一中心-系统技术部-交互窗口组，移动解决方案一中心-系统技术部-竞争力技术组，移动解决方案一中心-系统技术部-框架开发二组，移动解决方案一中心-系统技术部-系统稳定性组"),
    TeamConfigRow(id="development-carrier-app", name="运营商应用开发部", type="development", enabled=True, note="系统应用开发中心-运营商应用开发部-通话应用组，系统应用开发中心-运营商应用开发部-通话服务组，系统应用开发中心-运营商应用开发部-运营商服务组，系统应用开发中心-运营商应用开发部-信息应用组，系统应用开发中心-运营商应用开发部，移动解决方案二中心-运营商应用开发部-通信应用组，移动解决方案二中心-运营商应用开发部-武汉ODC组，移动解决方案二中心-运营商应用开发部-通话服务组，系统应用开发中心-运营商应用开发部-通信应用组，移动解决方案二中心-运营商应用开发部-工具应用组，移动解决方案二中心-运营商应用开发部-系统更新服务组"),
    TeamConfigRow(id="development-basic-app", name="基础应用开发部", type="development", enabled=True, note="系统应用开发中心-基础应用开发部-系统基础应用组，系统应用开发中心-基础应用开发部-门户基础应用组，系统应用开发中心-基础应用开发部-多媒体基础应用组，系统应用开发中心-基础应用开发部-应用技术组，系统应用开发中心-基础应用开发部，移动解决方案二中心-基础应用开发部-系统基础应用组，移动解决方案二中心-基础应用开发部-应用技术组，移动解决方案二中心-基础应用开发部-多媒体基础应用组，移动解决方案二中心-基础应用开发部-三方与平台应用组"),
    TeamConfigRow(id="development-independent-app", name="独立应用开发部", type="development", enabled=True, note="系统应用开发中心-独立应用开发部-网络服务组，系统应用开发中心-独立应用开发部-工具服务组，系统应用开发中心-独立应用开发部-桌面应用组，系统应用开发中心-独立应用开发部-武汉ODC组，系统应用开发中心-独立应用开发部-穿戴服务组，系统应用开发中心-独立应用开发部-内容平台组，互联网应用开发中心-独立应用开发部-桌面应用组，互联网应用开发中心-独立应用开发部-AI应用组，互联网应用开发中心-独立应用开发部-运营业务组，互联网应用开发中心-独立应用开发部-创新应用组"),
    TeamConfigRow(id="development-engineering-efficiency", name="工程效能部", type="development", enabled=True, note="系统技术中心-工程效能部-WSL工具开发组，系统技术中心-工程效能部-通讯项目交付组，系统技术中心-工程效能部-FCM平台开发组，系统技术中心-工程效能部-通讯交付组"),
    TeamConfigRow(id="development-terminal-os", name="终端OS部", type="development", enabled=True, note="系统技术中心-终端OS部-性能解决方案组"),
    TeamConfigRow(id="development-camera", name="Camera", type="development", enabled=True, note="MP PL-Tech.&Inno.-Camera LAB-APP Team，MP PL-R&D-Camera LAB-APP Team，MP PL-Tech.&Inno.-Camera LAB-HAL Team，MP PL-R&D-Camera LAB-HAL Team，MP PL-Tech.&Inno.-Camera LAB，MP PL-R&D-Camera LAB，MP PL-Tech.&Inno.-Camera LAB-Tuning Team，MP PL-R&D-Camera LAB-IQA Team，MP PL-R&D-Camera LAB-Tuning Team"),
]

FIXED_TESTING_TEAMS = [row for row in DEFAULT_TEAMS if row.type == "testing"]
FIXED_DEVELOPMENT_TEAMS = [row for row in DEFAULT_TEAMS if row.type == "development"]

DEFAULT_FIELD_MAPPINGS: list[FieldMappingRow] = [
    FieldMappingRow(
        id="fm-1",
        businessName="团队字段",
        jiraFieldPath="customfield_12345",
        purpose="按团队统计 Created / Fixed；供团队配置和预测拆分使用",
        exampleValue="系统质量二部-运营商系统测试组",
        enabled=True,
    ),
    FieldMappingRow(
        id="fm-2",
        businessName="创建时间",
        jiraFieldPath="created",
        purpose="按业务周统计每周创建量",
        exampleValue="2026-01-12",
        enabled=True,
    ),
    FieldMappingRow(
        id="fm-3",
        businessName="解决时间",
        jiraFieldPath="resolved",
        purpose="按业务周统计每周解决量",
        exampleValue="2026-03-09",
        enabled=True,
    ),
    FieldMappingRow(
        id="fm-4",
        businessName="Issue Type",
        jiraFieldPath="issuetype.name",
        purpose="过滤 defect / bug / defect_new 等类型",
        exampleValue="Defect",
        enabled=True,
    ),
    FieldMappingRow(
        id="fm-5",
        businessName="项目字段",
        jiraFieldPath="project.key",
        purpose="拉取指定项目，生成历史项目汇总",
        exampleValue="MONETNPDISH",
        enabled=True,
    ),
    FieldMappingRow(
        id="fm-6",
        businessName="last time to set verified_sw",
        jiraFieldPath="customfield_13228",
        purpose="开发侧验证/解决时间（按周统计 fixed；仅使用该字段，不回退 resolved）",
        exampleValue="2026-03-09T13:40:21.000+0800",
        enabled=True,
    ),
    FieldMappingRow(
        id="fm-7",
        businessName="Reporter Team-New",
        jiraFieldPath="customfield_15319",
        purpose="测试提报团队（按周统计 created）",
        exampleValue="系统质量二部-运营商系统测试组",
        enabled=True,
    ),
    FieldMappingRow(
        id="fm-8",
        businessName="Assignee Team",
        jiraFieldPath="customfield_15320",
        purpose="开发团队（按周统计 fixed）",
        exampleValue="基础应用开发部",
        enabled=True,
    ),
]

DEFAULT_FORECAST_DEFAULTS = ForecastDefaults(
    refProjects=[
        RefProjectRow(project="Monet NP Dish", similarity=91, source="自动识别"),
        RefProjectRow(project="Beryl TMO", similarity=84, source="自动识别"),
        RefProjectRow(project="Goldfinch TMO", similarity=79, source="手工添加"),
    ],
    milestones=[
        MilestoneParam(name="FC checklist", week="26W4", date="2026-01-19"),
        MilestoneParam(name="M1-1", week="26W5", date="2026-01-26"),
        MilestoneParam(name="M1-2", week="26W6", date="2026-02-02"),
        MilestoneParam(name="M1-3", week="26W7", date="2026-02-09"),
        MilestoneParam(name="V1", week="26W17", date="2026-04-20"),
        MilestoneParam(name="V4", week="26W23", date="2026-06-01"),
    ],
    params=ForecastParams(newProjectName="Aurora NP TMO", startWeek="26W2", endWeek="26W27"),
)

DEFAULT_COMPARE_COLORS = CompareColorsConfig(
    colors=["#0f172a", "#0284c7", "#16a34a", "#f59e0b", "#7c3aed"]
)

TESTING_TEAM_UNKNOWN = "测试未知团队"
DEV_TEAM_UNKNOWN = "软件-未知团队"


def _extract_reporter_identity(issue: dict[str, object]) -> str:
    reporter = _get_issue_fields(issue).get("reporter")
    if not isinstance(reporter, dict):
        return ""
    for key in ("name", "key", "accountId", "emailAddress", "displayName"):
        value = reporter.get(key)
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


def _normalize_reporter_team(issue: dict[str, object], field_path: str) -> str:
    t = _extract_issue_team(issue, field_path).strip()
    return _resolve_unknown_team_bucket(t, _extract_reporter_identity(issue), TESTING_TEAM_UNKNOWN)


def _normalize_assignee_team(issue: dict[str, object], field_path: str) -> str:
    t = _extract_issue_team(issue, field_path).strip()
    return _resolve_unknown_team_bucket(t, _extract_reporter_identity(issue), DEV_TEAM_UNKNOWN)


def _hash_to_int(seed: str) -> int:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return int(digest[:12], 16)


def _parse_week_label(label: str) -> tuple[int, int]:
    clean = label.strip().upper().replace(" ", "")
    if "W" not in clean:
        return (2026, 1)
    left, right = clean.split("W", 1)
    year = 2000 + int(left[-2:]) if left else 2026
    week = int(right) if right.isdigit() else 1
    week = max(1, min(53, week))
    return (year, week)


def _normalize_week(year: int, week: int) -> str:
    return f"{str(year)[-2:]}W{week}"


def _first_sunday_of_year(year: int) -> date:
    jan1 = date(year, 1, 1)
    offset = (6 - jan1.weekday()) % 7
    return jan1 + timedelta(days=offset)


def _weeks_in_business_year(year: int) -> int:
    return _business_week_from_date(date(year, 12, 31))[1]


def _business_week_from_date(d: date) -> tuple[int, int]:
    year = d.year
    jan1 = date(year, 1, 1)
    first_sunday = _first_sunday_of_year(year)
    if d <= first_sunday:
        return (year, 1)
    first_monday = first_sunday + timedelta(days=1)
    diff_days = (d - first_monday).days
    return (year, 2 + (diff_days // 7))


def _business_week_bounds(year: int, week: int) -> tuple[date, date]:
    if week <= 1:
        start = date(year, 1, 1)
        end = _first_sunday_of_year(year)
        return (start, end)
    first_monday = _first_sunday_of_year(year) + timedelta(days=1)
    start = first_monday + timedelta(days=(week - 2) * 7)
    end = min(start + timedelta(days=6), date(year, 12, 31))
    return (start, end)


def _advance_business_week(year: int, week: int) -> tuple[int, int]:
    max_week = _weeks_in_business_year(year)
    if week < max_week:
        return (year, week + 1)
    return (year + 1, 1)


def _week_range(start_label: str, end_label: str) -> list[str]:
    start_year, start_week = _parse_week_label(start_label)
    end_year, end_week = _parse_week_label(end_label)
    cursor = (start_year, start_week)
    target = (end_year, end_week)
    if cursor > target:
        cursor, target = target, cursor
    out: list[str] = []
    while cursor <= target:
        out.append(_normalize_week(cursor[0], cursor[1]))
        cursor = _advance_business_week(cursor[0], cursor[1])
    return out


def _date_label_from_week(week: str) -> str:
    year, week_num = _parse_week_label(week)
    start, _ = _business_week_bounds(year, week_num)
    return f"{start.month}/{start.day}"


def _safe_int(value: object, fallback: int = 0) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    try:
        return int(str(value))
    except Exception:
        return fallback


def _parse_jira_datetime(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    normalized = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        try:
            return datetime.strptime(text, "%Y-%m-%dT%H:%M:%S.%f%z")
        except Exception:
            return None


def _to_week_label(dt: datetime) -> str:
    year, week = _business_week_from_date(dt.date())
    return _normalize_week(year, week)


def _norm(s: str) -> str:
    return s.strip().lower()


def _resolve_jira_team_field_paths() -> dict[str, str]:
    rows = get_field_mappings()
    by_name = {_norm(r.businessName): r.jiraFieldPath.strip() for r in rows if r.enabled and r.jiraFieldPath.strip()}
    verified = (
        by_name.get(_norm("last time to set verified_sw"))
        or by_name.get(_norm("1st Time To Set Verified_SW"))
        or "customfield_13228"
    )
    closed = by_name.get(_norm("1st time to set closed"), "customfield_13221")
    deleted = by_name.get(_norm("1st time to set deleted"), "customfield_13222")
    postponed = by_name.get(_norm("1st time to set postponed"), "customfield_13225")
    reporter_team = by_name.get(_norm("Reporter Team-New"), "customfield_15319")
    assignee_team = by_name.get(_norm("Assignee Team"), "customfield_15320")
    return {
        "verified": verified,
        "closed": closed,
        "deleted": deleted,
        "postponed": postponed,
        "reporterTeam": reporter_team,
        "assigneeTeam": assignee_team,
    }


def _get_issue_fields(issue: dict[str, object]) -> dict[str, object]:
    fields = issue.get("fields")
    if isinstance(fields, dict):
        return fields
    return {}


def _lookup_path(data: object, path: str) -> object:
    if not path.strip():
        return None
    current: object = data
    for part in [p.strip() for p in path.split(".") if p.strip()]:
        if not isinstance(current, dict):
            return None
        if part not in current:
            return None
        current = current.get(part)
    return current


def _value_to_string(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, dict):
        for key in ("value", "name", "displayName"):
            v = value.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()
        return ""
    if isinstance(value, list):
        parts = [_value_to_string(v) for v in value]
        parts = [x for x in parts if x]
        return ",".join(parts)
    return ""


def _extract_issue_team(issue: dict[str, object], field_path: str) -> str:
    raw = _lookup_path(_get_issue_fields(issue), field_path)
    return _value_to_string(raw)


def _extract_issue_resolved_dt(
    issue: dict[str, object],
    verified_field_path: str,
    closed_field_path: str,
    postponed_field_path: str,
    deleted_field_path: str,
) -> datetime | None:
    fields = _get_issue_fields(issue)
    for path in [verified_field_path, closed_field_path, postponed_field_path, deleted_field_path]:
        dt = _parse_jira_datetime(_lookup_path(fields, path))
        if dt is not None:
            return dt
    return None


def _week_bounds_iso(week_label: str) -> tuple[str, str]:
    year, week = _parse_week_label(week_label)
    begin, finish = _business_week_bounds(year, week)
    return begin.isoformat(), finish.isoformat()


def _parse_date_ymd(text: str) -> date | None:
    try:
        return datetime.strptime(text.strip(), "%Y-%m-%d").date()
    except Exception:
        return None


def _next_calendar_day_iso(d: date) -> str:
    """Calendar day after ``d``, as YYYY-MM-DD (exclusive upper bound for JQL date windows)."""
    return (d + timedelta(days=1)).isoformat()


def _build_bounded_jql(jql: str, start_week: str, end_week: str, start_date_raw: str = "", end_date_raw: str = "") -> str:
    start_dt = _parse_date_ymd(start_date_raw)
    end_dt = _parse_date_ymd(end_date_raw)
    if start_dt and end_dt:
        low, high = min(start_dt, end_dt), max(start_dt, end_dt)
        begin = low.isoformat()
        finish_exclusive = _next_calendar_day_iso(high)
    else:
        begin, _ = _week_bounds_iso(start_week)
        _, finish = _week_bounds_iso(end_week)
        finish_exclusive = _next_calendar_day_iso(date.fromisoformat(finish))
    bound = f"(created >= '{begin}' AND created < '{finish_exclusive}')"
    # ORDER BY 必须出现在 JQL 末尾，拼接窗口条件前需要先移除它。
    base = re.sub(r"\border\s+by\b[\s\S]*$", "", jql, flags=re.IGNORECASE).strip()
    if not base:
        return bound
    return f"({base}) AND {bound}"


def _build_effective_query(req: JiraFetchRequest) -> str:
    if req.pullMode == "jql":
        query = req.jql.strip()
        if not query:
            raise ValueError("JQL 模式下请填写 JQL")
        return query
    if req.pullMode == "projectStart":
        if not req.startDate.strip() or not req.endDate.strip():
            raise ValueError("项目+日期模式下请填写开始日期和结束日期")
        return f"project = {req.projectKey} AND issuetype in (defect, bug)"
    raise ValueError(f"Unsupported pullMode: {req.pullMode}")


def _load_existing_jira_counts(project_name: str) -> dict[str, tuple[int, int]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT week_label, created_count, fixed_count
            FROM project_weekly
            WHERE project_name = ? AND source = 'jira' AND forecast_version_id = ''
            """,
            (project_name,),
        ).fetchall()
    return {r["week_label"]: (_safe_int(r["created_count"]), _safe_int(r["fixed_count"])) for r in rows}


def _merge_jira_week_counts(
    existing: dict[str, tuple[int, int]],
    updates: dict[str, tuple[int, int]],
    requested_labels: list[str],
    mode: str,
) -> tuple[dict[str, tuple[int, int]], set[str]]:
    next_counts: dict[str, tuple[int, int]] = dict(existing)
    touched: set[str] = set()
    if mode == "overwrite":
        next_counts = {}
        for label, pair in updates.items():
            next_counts[label] = pair
            touched.add(label)
        return next_counts, touched
    if mode == "normal":
        for label in requested_labels:
            next_counts.pop(label, None)
            touched.add(label)
        for label, pair in updates.items():
            next_counts[label] = pair
            touched.add(label)
        return next_counts, touched
    if mode == "incremental":
        for label, pair in updates.items():
            if label in next_counts:
                continue
            next_counts[label] = pair
            touched.add(label)
        return next_counts, touched
    raise ValueError(f"Unsupported mode: {mode}")


def _counts_to_weekly_rows(counts: dict[str, tuple[int, int]]) -> list[WeeklyPoint]:
    labels = sorted(counts.keys(), key=_parse_week_label)
    out: list[WeeklyPoint] = []
    cum_created = 0
    cum_fixed = 0
    for label in labels:
        created, fixed = counts[label]
        cum_created += created
        cum_fixed += fixed
        week_num = _parse_week_label(label)[1]
        out.append(
            WeeklyPoint(
                week=f"W{week_num}",
                weekLabel=label,
                date=_date_label_from_week(label),
                created=created,
                fixed=fixed,
                cumCreated=cum_created,
                cumFixed=cum_fixed,
                backlog=cum_created - cum_fixed,
            )
        )
    return out


def _extract_assignee(issue: dict[str, object]) -> str:
    fields = issue.get("fields")
    if not isinstance(fields, dict):
        return ""
    assignee = fields.get("assignee")
    if not isinstance(assignee, dict):
        return ""
    display_name = assignee.get("displayName")
    if isinstance(display_name, str) and display_name.strip():
        return display_name.strip()
    account = assignee.get("accountId")
    if isinstance(account, str):
        return account
    return ""


def _extract_issue_key(issue: dict[str, object]) -> str:
    key = issue.get("key")
    return str(key) if key is not None else ""


def _extract_issue_summary(issue: dict[str, object]) -> str:
    fields = issue.get("fields")
    if not isinstance(fields, dict):
        return ""
    summary = fields.get("summary")
    return str(summary) if summary is not None else ""


def _build_issue_samples(
    issues: list[dict[str, object]],
    limit: int,
    reporter_team_path: str,
    assignee_team_path: str,
    verified_field_path: str,
) -> list[JiraIssueDebugRow]:
    out: list[JiraIssueDebugRow] = []
    for issue in issues[: max(0, limit)]:
        fields = _get_issue_fields(issue)
        created = ""
        resolved = ""
        if fields.get("created") is not None:
            created = str(fields.get("created"))
        if fields.get("resolutiondate") is not None:
            resolved = str(fields.get("resolutiondate"))
        elif fields.get("resolved") is not None:
            resolved = str(fields.get("resolved"))
        verified_raw = _lookup_path(fields, verified_field_path)
        verified_sw = ""
        if verified_raw is not None:
            verified_sw = str(verified_raw).strip()
        out.append(
            JiraIssueDebugRow(
                key=_extract_issue_key(issue),
                created=created,
                resolved=resolved,
                assignee=_extract_assignee(issue),
                summary=_extract_issue_summary(issue),
                reporterTeam=_normalize_reporter_team(issue, reporter_team_path),
                assigneeTeam=_normalize_assignee_team(issue, assignee_team_path),
                verifiedSw=verified_sw,
            )
        )
    return out


def _aggregate_issues_to_counts(
    issues: list[dict[str, object]],
    target_labels: set[str] | None,
    verified_field_path: str,
    closed_field_path: str,
    postponed_field_path: str,
    deleted_field_path: str,
) -> dict[str, tuple[int, int]]:
    buckets: dict[str, dict[str, int]] = {}
    if target_labels is not None:
        buckets = {label: {"created": 0, "fixed": 0} for label in target_labels}
    for issue in issues:
        fields = _get_issue_fields(issue)
        created_dt = _parse_jira_datetime(fields.get("created"))
        if created_dt:
            created_label = _to_week_label(created_dt)
            if target_labels is None:
                bucket = buckets.setdefault(created_label, {"created": 0, "fixed": 0})
                bucket["created"] += 1
            elif created_label in buckets:
                buckets[created_label]["created"] += 1
        resolved_dt = _extract_issue_resolved_dt(
            issue,
            verified_field_path,
            closed_field_path,
            postponed_field_path,
            deleted_field_path,
        )
        if resolved_dt:
            resolved_label = _to_week_label(resolved_dt)
            if target_labels is None:
                bucket = buckets.setdefault(resolved_label, {"created": 0, "fixed": 0})
                bucket["fixed"] += 1
            elif resolved_label in buckets:
                buckets[resolved_label]["fixed"] += 1
    return {label: (bucket["created"], bucket["fixed"]) for label, bucket in buckets.items()}


def _aggregate_issue_team_week_maps(
    issues: list[dict[str, object]],
    target_labels: set[str] | None,
    reporter_team_field: str,
    assignee_team_field: str,
    verified_field_path: str,
    closed_field_path: str,
    postponed_field_path: str,
    deleted_field_path: str,
) -> tuple[dict[str, dict[str, int]], dict[str, dict[str, int]]]:
    created_by_week: dict[str, dict[str, int]] = {}
    fixed_by_week: dict[str, dict[str, int]] = {}
    for issue in issues:
        fields = _get_issue_fields(issue)
        created_dt = _parse_jira_datetime(fields.get("created"))
        if created_dt:
            label = _to_week_label(created_dt)
            if target_labels is None or label in target_labels:
                team = _normalize_reporter_team(issue, reporter_team_field)
                created_by_week.setdefault(label, {})
                created_by_week[label][team] = created_by_week[label].get(team, 0) + 1

        resolved_dt = _extract_issue_resolved_dt(
            issue,
            verified_field_path,
            closed_field_path,
            postponed_field_path,
            deleted_field_path,
        )
        if resolved_dt:
            label = _to_week_label(resolved_dt)
            if target_labels is None or label in target_labels:
                team = _normalize_assignee_team(issue, assignee_team_field)
                fixed_by_week.setdefault(label, {})
                fixed_by_week[label][team] = fixed_by_week[label].get(team, 0) + 1
    return created_by_week, fixed_by_week


def _aggregate_issue_team_week_issue_keys(
    issues: list[dict[str, object]],
    target_labels: set[str] | None,
    reporter_team_field: str,
    assignee_team_field: str,
    verified_field_path: str,
    closed_field_path: str,
    postponed_field_path: str,
    deleted_field_path: str,
) -> tuple[dict[str, dict[str, list[str]]], dict[str, dict[str, list[str]]]]:
    created_keys_by_week: dict[str, dict[str, list[str]]] = {}
    fixed_keys_by_week: dict[str, dict[str, list[str]]] = {}
    for issue in issues:
        issue_key = _extract_issue_key(issue).strip()
        if not issue_key:
            continue

        fields = _get_issue_fields(issue)
        created_dt = _parse_jira_datetime(fields.get("created"))
        if created_dt:
            label = _to_week_label(created_dt)
            if target_labels is None or label in target_labels:
                team = _normalize_reporter_team(issue, reporter_team_field)
                created_keys_by_week.setdefault(label, {})
                created_keys_by_week[label].setdefault(team, [])
                if issue_key not in created_keys_by_week[label][team]:
                    created_keys_by_week[label][team].append(issue_key)

        resolved_dt = _extract_issue_resolved_dt(
            issue,
            verified_field_path,
            closed_field_path,
            postponed_field_path,
            deleted_field_path,
        )
        if resolved_dt:
            label = _to_week_label(resolved_dt)
            if target_labels is None or label in target_labels:
                team = _normalize_assignee_team(issue, assignee_team_field)
                fixed_keys_by_week.setdefault(label, {})
                fixed_keys_by_week[label].setdefault(team, [])
                if issue_key not in fixed_keys_by_week[label][team]:
                    fixed_keys_by_week[label][team].append(issue_key)
    return created_keys_by_week, fixed_keys_by_week


def _merge_team_week_maps(
    existing_map: dict[str, dict[str, int]],
    updates_map: dict[str, dict[str, int]],
    requested_labels: list[str],
    mode: str,
    existing_count_labels: set[str],
) -> dict[str, dict[str, int]]:
    merged = {label: dict(team_counts) for label, team_counts in existing_map.items()}
    if mode == "overwrite":
        return {label: dict(team_counts) for label, team_counts in updates_map.items()}
    if mode == "normal":
        for label in requested_labels:
            merged.pop(label, None)
        for label, team_counts in updates_map.items():
            merged[label] = dict(team_counts)
        return merged
    if mode == "incremental":
        for label, team_counts in updates_map.items():
            if label in existing_count_labels:
                continue
            merged[label] = dict(team_counts)
        return merged
    raise ValueError(f"Unsupported mode: {mode}")


def _merge_team_week_issue_key_maps(
    existing_map: dict[str, dict[str, list[str]]],
    updates_map: dict[str, dict[str, list[str]]],
    requested_labels: list[str],
    mode: str,
    existing_count_labels: set[str],
) -> dict[str, dict[str, list[str]]]:
    merged = {
        label: {team: list(keys) for team, keys in team_map.items()}
        for label, team_map in existing_map.items()
    }
    if mode == "overwrite":
        return {
            label: {team: list(keys) for team, keys in team_map.items()}
            for label, team_map in updates_map.items()
        }
    if mode == "normal":
        for label in requested_labels:
            merged.pop(label, None)
        for label, team_map in updates_map.items():
            merged[label] = {team: list(keys) for team, keys in team_map.items()}
        return merged
    if mode == "incremental":
        for label, team_map in updates_map.items():
            if label in existing_count_labels:
                continue
            merged[label] = {team: list(keys) for team, keys in team_map.items()}
        return merged
    raise ValueError(f"Unsupported mode: {mode}")


def _team_week_map_to_rows(
    team_week_map: dict[str, dict[str, int]],
    labels: list[str],
    issue_keys_map: dict[str, dict[str, list[str]]] | None = None,
) -> list[TeamWeeklyRow]:
    team_names: set[str] = set()
    for bucket in team_week_map.values():
        team_names.update(bucket.keys())
    ordered_teams = sorted(team_names)
    rows: list[TeamWeeklyRow] = []
    for team in ordered_teams:
        values = [team_week_map.get(label, {}).get(team, 0) for label in labels]
        issue_keys_by_week = [
            list((issue_keys_map or {}).get(label, {}).get(team, []))
            for label in labels
        ]
        rows.append(TeamWeeklyRow(team=team, values=values, issueKeysByWeek=issue_keys_by_week))
    return rows


def _record_jira_sync(req: JiraFetchRequest, stored_jql: str, fetched: int, written: int, synced_at: str) -> None:
    sync_id = str(uuid4())
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO jira_sync(id, project_name, start_week, end_week, jql, mode, fetched_count, written_count, synced_at)
            VALUES(?,?,?,?,?,?,?,?,?)
            """,
            (sync_id, req.projectKey, req.startWeek, req.endWeek, stored_jql, req.mode, fetched, written, synced_at),
        )


def _jira_debug_key(project_key: str) -> str:
    safe = project_key.strip() or "_"
    return f"jira_debug::{safe}"


def _jira_team_weekly_key(project_key: str) -> str:
    safe = project_key.strip() or "_"
    return f"jira_team_weekly::{safe}"


def _load_jira_team_weekly_maps(
    project_key: str,
) -> tuple[
    dict[str, dict[str, int]],
    dict[str, dict[str, int]],
    dict[str, dict[str, list[str]]],
    dict[str, dict[str, list[str]]],
]:
    raw = _load_app_config(_jira_team_weekly_key(project_key))
    if not raw:
        return {}, {}, {}, {}
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return {}, {}, {}, {}
        created_raw = data.get("created")
        fixed_raw = data.get("fixed")
        created_issue_keys_raw = data.get("createdIssueKeys")
        fixed_issue_keys_raw = data.get("fixedIssueKeys")
        created: dict[str, dict[str, int]] = {}
        fixed: dict[str, dict[str, int]] = {}
        created_issue_keys: dict[str, dict[str, list[str]]] = {}
        fixed_issue_keys: dict[str, dict[str, list[str]]] = {}
        if isinstance(created_raw, dict):
            for label, teams in created_raw.items():
                if not isinstance(label, str) or not isinstance(teams, dict):
                    continue
                created[label] = {}
                for team, count in teams.items():
                    if isinstance(team, str) and team.strip():
                        created[label][team] = _safe_int(count)
        if isinstance(fixed_raw, dict):
            for label, teams in fixed_raw.items():
                if not isinstance(label, str) or not isinstance(teams, dict):
                    continue
                fixed[label] = {}
                for team, count in teams.items():
                    if isinstance(team, str) and team.strip():
                        fixed[label][team] = _safe_int(count)
        if isinstance(created_issue_keys_raw, dict):
            for label, teams in created_issue_keys_raw.items():
                if not isinstance(label, str) or not isinstance(teams, dict):
                    continue
                created_issue_keys[label] = {}
                for team, keys in teams.items():
                    if not isinstance(team, str) or not team.strip():
                        continue
                    if isinstance(keys, list):
                        created_issue_keys[label][team] = [str(k).strip() for k in keys if str(k).strip()]
                    else:
                        created_issue_keys[label][team] = []
        if isinstance(fixed_issue_keys_raw, dict):
            for label, teams in fixed_issue_keys_raw.items():
                if not isinstance(label, str) or not isinstance(teams, dict):
                    continue
                fixed_issue_keys[label] = {}
                for team, keys in teams.items():
                    if not isinstance(team, str) or not team.strip():
                        continue
                    if isinstance(keys, list):
                        fixed_issue_keys[label][team] = [str(k).strip() for k in keys if str(k).strip()]
                    else:
                        fixed_issue_keys[label][team] = []
        return created, fixed, created_issue_keys, fixed_issue_keys
    except Exception:
        return {}, {}, {}, {}


def _save_jira_team_weekly_maps(
    project_key: str,
    created_by_week: dict[str, dict[str, int]],
    fixed_by_week: dict[str, dict[str, int]],
    created_issue_keys_by_week: dict[str, dict[str, list[str]]],
    fixed_issue_keys_by_week: dict[str, dict[str, list[str]]],
) -> None:
    _save_app_config(
        _jira_team_weekly_key(project_key),
        {
            "created": created_by_week,
            "fixed": fixed_by_week,
            "createdIssueKeys": created_issue_keys_by_week,
            "fixedIssueKeys": fixed_issue_keys_by_week,
        },
    )


def save_jira_fetch_debug(payload: JiraFetchDebugInfo) -> None:
    _save_app_config(_jira_debug_key(payload.projectKey), payload.model_dump())


def get_jira_fetch_debug(project_key: str) -> JiraFetchDebugInfo | None:
    raw = _load_app_config(_jira_debug_key(project_key))
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return None
        return JiraFetchDebugInfo(**data)
    except Exception:
        return None


def record_jira_fetch_error(req: JiraFetchRequest, error: str) -> None:
    request_query = ""
    bounded_query = ""
    try:
        request_query = _build_effective_query(req)
        if req.pullMode == "projectStart" and req.startWeek and req.endWeek:
            bounded_query = _build_bounded_jql(
                request_query,
                req.startWeek,
                req.endWeek,
                req.startDate,
                req.endDate,
            )
        else:
            bounded_query = request_query
    except Exception:
        # best effort only
        pass

    cycle = f"{req.startWeek} - {req.endWeek}" if req.startWeek and req.endWeek else "-"
    save_jira_fetch_debug(
        JiraFetchDebugInfo(
            projectKey=req.projectKey,
            pullMode=req.pullMode,
            mode=req.mode,
            cycleLabel=cycle,
            requestJql=request_query,
            boundedJql=bounded_query,
            fetchedCount=0,
            writtenCount=0,
            syncedAt=datetime.utcnow().isoformat(),
            requestedFields=[],
            sampleIssues=[],
            error=error,
        )
    )


def _make_weekly(seed: str, start_week: str, end_week: str) -> list[WeeklyPoint]:
    labels = _week_range(start_week, end_week)
    base = _hash_to_int(seed)
    out: list[WeeklyPoint] = []
    cum_created = 0
    cum_fixed = 0
    for idx, label in enumerate(labels):
        peak_factor = max(1, 18 - abs(idx - (len(labels) // 3)))
        created = ((base >> (idx % 12)) + peak_factor * 9 + idx * 3) % 140
        fixed = max(0, created - ((idx * 5 + base) % 22))
        cum_created += created
        cum_fixed += fixed
        out.append(
            WeeklyPoint(
                week=f"W{_parse_week_label(label)[1]}",
                weekLabel=label,
                date=_date_label_from_week(label),
                created=created,
                fixed=fixed,
                cumCreated=cum_created,
                cumFixed=cum_fixed,
                backlog=cum_created - cum_fixed,
            )
        )
    return out


def _normalize_comparable(value: object) -> str:
    return str(value or "").strip().lower()


def _is_idh_category(value: object) -> bool:
    return _normalize_comparable(value) in IDH_PROJECT_CATEGORIES


def _split_legacy_chipset_status(value: object) -> tuple[str, str]:
    raw = str(value or "").strip()
    if "_" not in raw:
        return "", ""
    newness, vendor = raw.split("_", 1)
    return vendor.strip(), newness.strip()


def _chipset_vendor_from(value: object, legacy_status: object = "") -> str:
    explicit = str(value or "").strip()
    if explicit:
        return explicit
    vendor, _ = _split_legacy_chipset_status(legacy_status)
    return vendor


def _chipset_newness_from(value: object, legacy_status: object = "") -> str:
    explicit = str(value or "").strip()
    if explicit:
        return explicit
    _, newness = _split_legacy_chipset_status(legacy_status)
    return newness


def _operator_overlap(input_values: list[str], project_values: list[str]) -> float | None:
    input_set = {_normalize_comparable(x) for x in input_values if _normalize_comparable(x)}
    project_set = {_normalize_comparable(x) for x in project_values if _normalize_comparable(x)}
    if not input_set or not project_set:
        return None
    return len(input_set & project_set) / len(input_set | project_set)


def _fr_band_index(value: object) -> int | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number <= 0:
        return None
    for idx, upper in enumerate(FR_QUANTITY_BANDS):
        if number <= upper:
            return idx
    return len(FR_QUANTITY_BANDS)


def _fr_band_similarity(input_value: object, project_value: object) -> float | None:
    input_band = _fr_band_index(input_value)
    project_band = _fr_band_index(project_value)
    if input_band is None or project_band is None:
        return None
    diff = abs(input_band - project_band)
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.75
    if diff == 2:
        return 0.4
    return 0.0


def _field_similarity(input_data: ForecastInput, project: ProjectSummary, field_name: str) -> float | None:
    if field_name == "operatorOverlap":
        return _operator_overlap(input_data.params.operators, project.operators)
    if field_name == "frQuantityBand":
        return _fr_band_similarity(input_data.params.frQuantity, project.frQuantity)
    if field_name == "chipsetVendor":
        input_value = _normalize_comparable(
            _chipset_vendor_from(input_data.params.chipsetVendor, input_data.params.chipsetStatus)
        )
        project_value = _normalize_comparable(_chipset_vendor_from(project.chipsetVendor, project.chipsetStatus))
    else:
        input_value = _normalize_comparable(getattr(input_data.params, field_name))
        project_value = _normalize_comparable(getattr(project, field_name))
    if not input_value or not project_value:
        return None
    return 1.0 if input_value == project_value else 0.0


def _score_similar_project(input_data: ForecastInput, project: ProjectSummary) -> float | None:
    input_device = _normalize_comparable(input_data.params.deviceType)
    project_device = _normalize_comparable(project.deviceType)
    if input_device and project_device and input_device != project_device:
        return None

    is_idh = _is_idh_category(input_data.params.projectCategory)
    project_is_idh = _is_idh_category(project.projectCategory)
    if _normalize_comparable(input_data.params.projectCategory) and _normalize_comparable(project.projectCategory):
        if is_idh != project_is_idh:
            return None
    if is_idh and not _normalize_comparable(input_data.params.idhVendor):
        raise ValueError("IDH 项目必须填写外包商，才能预测 Defect 总数")

    weights = IDH_SIMILARITY_WEIGHTS if is_idh else SIMILARITY_WEIGHTS
    usable: list[tuple[float, float]] = []
    for field_name, weight in weights:
        similarity = _field_similarity(input_data, project, field_name)
        if similarity is not None:
            usable.append((similarity, weight))
    if not usable:
        return None

    total_weight = sum(weight for _, weight in usable)
    return sum(similarity * (weight / total_weight) for similarity, weight in usable)


def _top_similar_projects(input_data: ForecastInput, limit: int = 3) -> list[tuple[ProjectSummary, float]]:
    scored: list[tuple[ProjectSummary, float]] = []
    for project in list_project_summaries():
        if project.name.strip() == input_data.params.newProjectName.strip():
            continue
        if not isinstance(project.defects, int) or project.defects <= 0:
            continue
        score = _score_similar_project(input_data, project)
        if score is None or score <= 0:
            continue
        scored.append((project, score))

    scored.sort(key=lambda row: (-row[1], -row[0].defects, row[0].name))
    return scored[:limit]


def _clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def _forecast_factors(input_data: ForecastInput, top_projects: list[tuple[ProjectSummary, float]]) -> dict[str, float]:
    params = input_data.params
    chipset_newness = _chipset_newness_from(params.chipsetNewness, params.chipsetStatus)
    chipset = 1.2 if _normalize_comparable(chipset_newness) == "new" else 1.0
    operators = min(1.0 + len(params.operators) * 0.1, 1.5)
    user_program_count = len(params.userPrograms)
    user_program_increase = (
        0.0
        if user_program_count <= 0
        else min(0.25, 0.1 + max(0, user_program_count - 1) * 0.05)
    )
    support_sim = 0.8 if params.supportSim == "No" else 1.0
    pipeline = PIPELINE_FACTORS.get(str(params.pipeline or "").strip(), 1.0)

    historical_mm = [
        float(project.mm)
        for project, _ in top_projects
        if project.mm is not None and float(project.mm) > 0
    ]
    if params.mm and params.mm > 0 and historical_mm:
        avg_mm = sum(historical_mm) / len(historical_mm)
        mm = 1.0 + _clamp((float(params.mm) / avg_mm - 1.0) * 0.8, -0.2, 0.2)
    else:
        mm = 1.0

    return {
        "chipset": chipset,
        "operators": operators,
        "userPrograms": 1.0 + user_program_increase,
        "supportSim": support_sim,
        "mm": mm,
        "pipeline": pipeline,
    }


def _predict_defect_total(input_data: ForecastInput) -> tuple[int, int, list[dict[str, object]], dict[str, float]]:
    top_projects = _top_similar_projects(input_data)
    if not top_projects:
        raise ValueError("没有相似度大于 0 的历史项目，无法预测 Defect 总数")

    similarity_sum = sum(score for _, score in top_projects)
    if similarity_sum <= 0:
        raise ValueError("相似项目相似度总和为 0，无法计算基准值")

    base_value = sum(project.defects * score for project, score in top_projects) / similarity_sum
    factors = _forecast_factors(input_data, top_projects)
    estimated = round(
        base_value
        * factors["chipset"]
        * factors["operators"]
        * factors["userPrograms"]
        * factors["supportSim"]
        * factors["mm"]
        * factors["pipeline"]
    )
    reference_projects = [
        {
            "name": project.name,
            "displayName": project.displayName,
            "defects": project.defects,
            "mm": project.mm,
            "similarity": round(score * 100, 2),
        }
        for project, score in top_projects
    ]
    return max(0, estimated), round(base_value), reference_projects, factors


def _scale_weekly_created_total(weekly: list[WeeklyPoint], target_total: int) -> list[WeeklyPoint]:
    if not weekly:
        return weekly
    target = max(0, int(target_total))
    current_total = sum(max(0, row.created) for row in weekly)
    if current_total <= 0:
        base = target // len(weekly)
        remainder = target % len(weekly)
        created_values = [base + (1 if idx < remainder else 0) for idx in range(len(weekly))]
        fixed_values = [0 for _ in weekly]
    else:
        raw_created = [max(0, row.created) * target / current_total for row in weekly]
        created_values = [int(value) for value in raw_created]
        remainder = target - sum(created_values)
        order = sorted(range(len(raw_created)), key=lambda idx: raw_created[idx] - created_values[idx], reverse=True)
        for idx in order[:remainder]:
            created_values[idx] += 1
        scale = target / current_total
        fixed_values = [min(created_values[idx], max(0, round(weekly[idx].fixed * scale))) for idx in range(len(weekly))]

    out: list[WeeklyPoint] = []
    cum_created = 0
    cum_fixed = 0
    for row, created, fixed in zip(weekly, created_values, fixed_values):
        cum_created += created
        cum_fixed += fixed
        out.append(
            WeeklyPoint(
                week=row.week,
                weekLabel=row.weekLabel,
                date=row.date,
                created=created,
                fixed=fixed,
                cumCreated=cum_created,
                cumFixed=cum_fixed,
                backlog=max(0, cum_created - cum_fixed),
            )
        )
    return out


def ensure_seed_data() -> None:
    with get_conn() as conn:
        count = conn.execute("SELECT COUNT(*) AS c FROM project_summary").fetchone()["c"]
        if count > 0:
            return
        now = datetime.utcnow().isoformat()
        for name, cycle, defects, teams, similarity in DEFAULT_PROJECTS:
            conn.execute(
                """
                INSERT INTO project_summary(name, cycle, defects, teams, similarity, source, updated_at)
                VALUES(?,?,?,?,?,'history',?)
                """,
                (name, cycle, defects, teams, similarity, now),
            )
            weekly = _make_weekly(name, cycle.split("-")[0], cycle.split("-")[1])
            for row in weekly:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO project_weekly(
                      project_name, source, forecast_version_id, week_label, week, date,
                      created_count, fixed_count, cum_created, cum_fixed, backlog
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        name,
                        "history",
                        "",
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


def _project_summary_from_row(row: sqlite3.Row) -> ProjectSummary:
    data = dict(row)
    data["operators"] = json.loads(data.pop("operatorsJson") or "[]")
    data["userPrograms"] = json.loads(data.pop("userProgramsJson") or "[]")
    legacy_vendor, legacy_newness = _split_legacy_chipset_status(data.get("chipsetStatus"))
    data["chipsetVendor"] = data.get("chipsetVendor") or legacy_vendor or None
    data["chipsetNewness"] = data.get("chipsetNewness") or legacy_newness or None
    return ProjectSummary(**data)


def list_project_summaries() -> list[ProjectSummary]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT
              name,
              display_name as displayName,
              cycle,
              defects,
              teams,
              similarity,
              project_category as projectCategory,
              region,
              os,
              device_type as deviceType,
              chipset_status as chipsetStatus,
              chipset_vendor as chipsetVendor,
              chipset_newness as chipsetNewness,
              pipeline,
              operators_json as operatorsJson,
              user_programs_json as userProgramsJson,
              idh_vendor as idhVendor,
              fr_quantity as frQuantity,
              mm,
              support_sim as supportSim,
              valid_start_date as validStartDate,
              valid_end_date as validEndDate
            FROM project_summary
            ORDER BY name
            """
        ).fetchall()
    return [_project_summary_from_row(r) for r in rows]


def _zero_weekly_for_cycle(cycle: str) -> list[WeeklyPoint]:
    parts = [x.strip() for x in cycle.split("-") if x.strip()]
    if len(parts) != 2:
        return []
    labels = _week_range(parts[0], parts[1])
    out: list[WeeklyPoint] = []
    for label in labels:
        week_num = _parse_week_label(label)[1]
        out.append(
            WeeklyPoint(
                week=f"W{week_num}",
                weekLabel=label,
                date=_date_label_from_week(label),
                created=0,
                fixed=0,
                cumCreated=0,
                cumFixed=0,
                backlog=0,
            )
        )
    return out


def upsert_cached_projects(projects: list[ProjectSummary]) -> list[ProjectSummary]:
    for project in projects:
        upsert_project_summary(project, source="manual")
        history_weekly = _load_weekly(project.name, "history", "")
        if not history_weekly:
            _replace_weekly(project.name, "history", _zero_weekly_for_cycle(project.cycle), "")
    return list_project_summaries()


def delete_cached_project(project_name: str) -> bool:
    with get_conn() as conn:
        row = conn.execute("SELECT name FROM project_summary WHERE name = ?", (project_name,)).fetchone()
        if not row:
            return False
        conn.execute("DELETE FROM project_summary WHERE name = ?", (project_name,))
        conn.execute("DELETE FROM project_weekly WHERE project_name = ?", (project_name,))
        conn.execute("DELETE FROM jira_sync WHERE project_name = ?", (project_name,))
        conn.execute("DELETE FROM forecast_version WHERE project_name = ?", (project_name,))
    _save_app_config(
        _jira_team_weekly_key(project_name),
        {"created": {}, "fixed": {}, "createdIssueKeys": {}, "fixedIssueKeys": {}},
    )
    return True


def get_project_history(project_name: str) -> ProjectHistory:
    with get_conn() as conn:
        summary = conn.execute(
            """
            SELECT
              name,
              display_name as displayName,
              cycle,
              defects,
              teams,
              similarity,
              project_category as projectCategory,
              region,
              os,
              device_type as deviceType,
              chipset_status as chipsetStatus,
              chipset_vendor as chipsetVendor,
              chipset_newness as chipsetNewness,
              pipeline,
              operators_json as operatorsJson,
              user_programs_json as userProgramsJson,
              idh_vendor as idhVendor,
              fr_quantity as frQuantity,
              mm,
              support_sim as supportSim,
              valid_start_date as validStartDate,
              valid_end_date as validEndDate
            FROM project_summary
            WHERE name = ?
            """,
            (project_name,),
        ).fetchone()
        if not summary:
            raise ValueError(f"Project not found: {project_name}")
        history_rows = conn.execute(
            """
            SELECT week_label, week, date, created_count, fixed_count, cum_created, cum_fixed, backlog
            FROM project_weekly
            WHERE project_name = ? AND source = 'history'
            ORDER BY rowid
            """,
            (project_name,),
        ).fetchall()
        jira_rows = conn.execute(
            """
            SELECT week_label, week, date, created_count, fixed_count, cum_created, cum_fixed, backlog
            FROM project_weekly
            WHERE project_name = ? AND source = 'jira'
            ORDER BY rowid
            """,
            (project_name,),
        ).fetchall()
    effective_rows = jira_rows if jira_rows else history_rows
    weekly = [
        WeeklyPoint(
            week=r["week"],
            weekLabel=r["week_label"],
            date=r["date"],
            created=r["created_count"],
            fixed=r["fixed_count"],
            cumCreated=r["cum_created"],
            cumFixed=r["cum_fixed"],
            backlog=r["backlog"],
        )
        for r in effective_rows
    ]
    created_team_rows: list[TeamWeeklyRow] = []
    fixed_team_rows: list[TeamWeeklyRow] = []
    if jira_rows:
        created_map, fixed_map, created_issue_keys_map, fixed_issue_keys_map = _load_jira_team_weekly_maps(project_name)
        ordered_labels = [row.weekLabel for row in weekly]
        created_team_rows = _team_week_map_to_rows(created_map, ordered_labels, created_issue_keys_map)
        fixed_team_rows = _team_week_map_to_rows(fixed_map, ordered_labels, fixed_issue_keys_map)
    summary_model = _project_summary_from_row(summary)
    return ProjectHistory(
        **summary_model.model_dump(),
        weekly=weekly,
        createdTeams=created_team_rows,
        fixedTeams=fixed_team_rows,
        milestones=[],
    )


def generate_forecast(input_data: ForecastInput) -> ForecastResult:
    estimated_defects, base_value, reference_projects, factors = _predict_defect_total(input_data)

    seed_parts = [
        input_data.params.newProjectName,
        input_data.params.startWeek,
        input_data.params.endWeek,
        str(estimated_defects),
    ]
    seed = "|".join(seed_parts)
    weekly = _scale_weekly_created_total(
        _make_weekly(seed, input_data.params.startWeek, input_data.params.endWeek),
        estimated_defects,
    )

    created_teams = []
    for team in input_data.enabledTestingTeams:
        values = [max(0, int(row.created * (0.4 + (_hash_to_int(team) % 30) / 100))) for row in weekly]
        created_teams.append({"team": team, "group": "测试团队", "values": values})
    fixed_teams = []
    for team in input_data.enabledDevTeams:
        values = [max(0, int(row.fixed * (0.4 + (_hash_to_int(team) % 25) / 100))) for row in weekly]
        fixed_teams.append({"team": team, "group": "开发团队", "values": values})

    milestones = [
        MilestoneLabel(label=m.name, week=m.week.replace("26", "W") if m.week.startswith("26") else m.week)
        for m in input_data.milestones
    ]
    team_summary = [
        {
            "group": "测试团队",
            "created": sum(sum(x["values"]) for x in created_teams),
            "fixed": 0,
        },
        {
            "group": "开发团队",
            "created": 0,
            "fixed": sum(sum(x["values"]) for x in fixed_teams),
        },
    ]
    return ForecastResult(
        dataset={
            "weekly": weekly,
            "createdTeams": created_teams,
            "fixedTeams": fixed_teams,
            "milestones": milestones,
        },
        teamSummary=team_summary,
        estimatedDefects=estimated_defects,
        baseValue=base_value,
        referenceProjects=reference_projects,
        factors=factors,
    )


def upsert_project_summary(project: ProjectSummary, source: str = "jira") -> None:
    normalized_source = "jira" if source == "jira" else "manual"
    chipset_vendor = _chipset_vendor_from(project.chipsetVendor, project.chipsetStatus)
    chipset_newness = _chipset_newness_from(project.chipsetNewness, project.chipsetStatus)
    chipset_status = (project.chipsetStatus or "").strip()
    if not chipset_status and chipset_vendor and chipset_newness:
        chipset_status = f"{chipset_newness}_{chipset_vendor}"
    metadata_values = (
        (project.projectCategory or "").strip() or None,
        (project.region or "").strip() or None,
        (project.os or "").strip() or None,
        (project.deviceType or "").strip() or None,
        chipset_status or None,
        chipset_vendor or None,
        chipset_newness or None,
        (project.pipeline or "").strip() or None,
        json.dumps(project.operators, ensure_ascii=False),
        json.dumps(project.userPrograms, ensure_ascii=False),
        (project.idhVendor or "").strip() or None,
        project.frQuantity,
        project.mm,
        project.supportSim,
        (project.validStartDate or "").strip() or None,
        (project.validEndDate or "").strip() or None,
    )
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO project_summary(
              name,
              display_name,
              cycle,
              defects,
              teams,
              similarity,
              project_category,
              region,
              os,
              device_type,
              chipset_status,
              chipset_vendor,
              chipset_newness,
              pipeline,
              operators_json,
              user_programs_json,
              idh_vendor,
              fr_quantity,
              mm,
              support_sim,
              valid_start_date,
              valid_end_date,
              source,
              updated_at
            )
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(name) DO UPDATE SET
              display_name = CASE WHEN excluded.source = 'jira' AND excluded.display_name = '' THEN project_summary.display_name ELSE excluded.display_name END,
              cycle = excluded.cycle,
              defects = excluded.defects,
              teams = excluded.teams,
              similarity = excluded.similarity,
              project_category = CASE WHEN excluded.source = 'jira' THEN project_summary.project_category ELSE excluded.project_category END,
              region = CASE WHEN excluded.source = 'jira' THEN project_summary.region ELSE excluded.region END,
              os = CASE WHEN excluded.source = 'jira' THEN project_summary.os ELSE excluded.os END,
              device_type = CASE WHEN excluded.source = 'jira' THEN project_summary.device_type ELSE excluded.device_type END,
              chipset_status = CASE WHEN excluded.source = 'jira' THEN project_summary.chipset_status ELSE excluded.chipset_status END,
              chipset_vendor = CASE WHEN excluded.source = 'jira' THEN project_summary.chipset_vendor ELSE excluded.chipset_vendor END,
              chipset_newness = CASE WHEN excluded.source = 'jira' THEN project_summary.chipset_newness ELSE excluded.chipset_newness END,
              pipeline = CASE WHEN excluded.source = 'jira' THEN project_summary.pipeline ELSE excluded.pipeline END,
              operators_json = CASE WHEN excluded.source = 'jira' THEN project_summary.operators_json ELSE excluded.operators_json END,
              user_programs_json = CASE WHEN excluded.source = 'jira' THEN project_summary.user_programs_json ELSE excluded.user_programs_json END,
              idh_vendor = CASE WHEN excluded.source = 'jira' THEN project_summary.idh_vendor ELSE excluded.idh_vendor END,
              fr_quantity = CASE WHEN excluded.source = 'jira' THEN project_summary.fr_quantity ELSE excluded.fr_quantity END,
              mm = CASE WHEN excluded.source = 'jira' THEN project_summary.mm ELSE excluded.mm END,
              support_sim = CASE WHEN excluded.source = 'jira' THEN project_summary.support_sim ELSE excluded.support_sim END,
              valid_start_date = CASE WHEN excluded.source = 'jira' THEN project_summary.valid_start_date ELSE excluded.valid_start_date END,
              valid_end_date = CASE WHEN excluded.source = 'jira' THEN project_summary.valid_end_date ELSE excluded.valid_end_date END,
              source = excluded.source,
              updated_at = excluded.updated_at
            """,
            (
                project.name,
                (project.displayName or "").strip(),
                project.cycle,
                project.defects,
                project.teams,
                project.similarity,
                *metadata_values,
                normalized_source,
                datetime.utcnow().isoformat(),
            ),
        )


def _replace_weekly(project_name: str, source: str, weekly: Iterable[WeeklyPoint], forecast_version_id: str = "") -> None:
    with get_conn() as conn:
        conn.execute(
            """
            DELETE FROM project_weekly
            WHERE project_name = ? AND source = ? AND forecast_version_id = ?
            """,
            (project_name, source, forecast_version_id),
        )
        for row in weekly:
            conn.execute(
                """
                INSERT INTO project_weekly(
                  project_name, source, forecast_version_id, week_label, week, date,
                  created_count, fixed_count, cum_created, cum_fixed, backlog
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    project_name,
                    source,
                    forecast_version_id,
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


def jira_sync(req: JiraFetchRequest) -> JiraFetchResult:
    requested_labels: list[str] = []
    if req.pullMode == "projectStart":
        if not req.startWeek.strip() or not req.endWeek.strip():
            raise ValueError("项目+日期模式下缺少开始/结束周期")
        requested_labels = _week_range(req.startWeek, req.endWeek)
    existing = _load_existing_jira_counts(req.projectKey)
    target_labels = requested_labels
    if req.mode == "incremental":
        target_labels = [label for label in requested_labels if label not in existing]

    issue_fields = _resolve_jira_team_field_paths()
    verified_field = issue_fields["verified"]
    closed_field = issue_fields["closed"]
    deleted_field = issue_fields["deleted"]
    postponed_field = issue_fields["postponed"]
    reporter_team_field = issue_fields["reporterTeam"]
    assignee_team_field = issue_fields["assigneeTeam"]
    fetch_fields = {
        "summary",
        "reporter",
        verified_field,
        closed_field,
        deleted_field,
        postponed_field,
        reporter_team_field,
        assignee_team_field,
    }
    (
        existing_created_team_map,
        existing_fixed_team_map,
        existing_created_issue_keys_map,
        existing_fixed_issue_keys_map,
    ) = _load_jira_team_weekly_maps(req.projectKey)

    issues: list[dict[str, object]] = []
    updates: dict[str, tuple[int, int]] = {}
    created_team_updates: dict[str, dict[str, int]] = {}
    fixed_team_updates: dict[str, dict[str, int]] = {}
    created_team_issue_keys_updates: dict[str, dict[str, list[str]]] = {}
    fixed_team_issue_keys_updates: dict[str, dict[str, list[str]]] = {}
    assignees: set[str] = set()
    effective_query = _build_effective_query(req)
    last_fetch_jql = ""
    if req.pullMode == "projectStart":
        if target_labels:
            fetch_jql = _build_bounded_jql(
                effective_query,
                target_labels[0],
                target_labels[-1],
                req.startDate,
                req.endDate,
            )
            last_fetch_jql = fetch_jql
            issues = [x for x in search_issues(req, fetch_jql, fields=fetch_fields) if isinstance(x, dict)]
            updates = _aggregate_issues_to_counts(
                issues,
                set(target_labels),
                verified_field,
                closed_field,
                postponed_field,
                deleted_field,
            )
            created_team_updates, fixed_team_updates = _aggregate_issue_team_week_maps(
                issues,
                set(target_labels),
                reporter_team_field,
                assignee_team_field,
                verified_field,
                closed_field,
                postponed_field,
                deleted_field,
            )
            created_team_issue_keys_updates, fixed_team_issue_keys_updates = _aggregate_issue_team_week_issue_keys(
                issues,
                set(target_labels),
                reporter_team_field,
                assignee_team_field,
                verified_field,
                closed_field,
                postponed_field,
                deleted_field,
            )
            assignees = {name for name in (_extract_assignee(issue) for issue in issues) if name}
    else:
        last_fetch_jql = effective_query
        issues = [x for x in search_issues(req, effective_query, fields=fetch_fields) if isinstance(x, dict)]
        updates = _aggregate_issues_to_counts(
            issues,
            None,
            verified_field,
            closed_field,
            postponed_field,
            deleted_field,
        )
        created_team_updates, fixed_team_updates = _aggregate_issue_team_week_maps(
            issues,
            None,
            reporter_team_field,
            assignee_team_field,
            verified_field,
            closed_field,
            postponed_field,
            deleted_field,
        )
        created_team_issue_keys_updates, fixed_team_issue_keys_updates = _aggregate_issue_team_week_issue_keys(
            issues,
            None,
            reporter_team_field,
            assignee_team_field,
            verified_field,
            closed_field,
            postponed_field,
            deleted_field,
        )
        requested_labels = sorted(updates.keys(), key=_parse_week_label)
        assignees = {name for name in (_extract_assignee(issue) for issue in issues) if name}

    merged_counts, touched_labels = _merge_jira_week_counts(existing, updates, requested_labels, req.mode)
    merged_weekly = _counts_to_weekly_rows(merged_counts)
    _replace_weekly(req.projectKey, "jira", merged_weekly, "")
    merged_created_team_map = _merge_team_week_maps(
        existing_created_team_map,
        created_team_updates,
        requested_labels,
        req.mode,
        set(existing.keys()),
    )
    merged_fixed_team_map = _merge_team_week_maps(
        existing_fixed_team_map,
        fixed_team_updates,
        requested_labels,
        req.mode,
        set(existing.keys()),
    )
    merged_created_issue_keys_map = _merge_team_week_issue_key_maps(
        existing_created_issue_keys_map,
        created_team_issue_keys_updates,
        requested_labels,
        req.mode,
        set(existing.keys()),
    )
    merged_fixed_issue_keys_map = _merge_team_week_issue_key_maps(
        existing_fixed_issue_keys_map,
        fixed_team_issue_keys_updates,
        requested_labels,
        req.mode,
        set(existing.keys()),
    )
    ordered_labels = sorted(merged_counts.keys(), key=_parse_week_label)
    created_team_rows = _team_week_map_to_rows(merged_created_team_map, ordered_labels, merged_created_issue_keys_map)
    fixed_team_rows = _team_week_map_to_rows(merged_fixed_team_map, ordered_labels, merged_fixed_issue_keys_map)
    _save_jira_team_weekly_maps(
        req.projectKey,
        merged_created_team_map,
        merged_fixed_team_map,
        merged_created_issue_keys_map,
        merged_fixed_issue_keys_map,
    )

    if merged_counts:
        labels = sorted(merged_counts.keys(), key=_parse_week_label)
        cycle = f"{labels[0]}-{labels[-1]}"
    else:
        cycle = f"{req.startWeek}-{req.endWeek}" if req.startWeek and req.endWeek else "-"
    defects = sum(created for created, _ in merged_counts.values())
    team_names = {r.team for r in created_team_rows} | {r.team for r in fixed_team_rows}
    teams = len(team_names) if team_names else (len(assignees) if assignees else max(1, defects // 220) if defects > 0 else 1)
    upsert_project_summary(
        ProjectSummary(name=req.projectKey, cycle=cycle, defects=defects, teams=teams, similarity=None),
        source="jira",
    )

    fetched = len(issues)
    written = len(touched_labels)
    synced_at = datetime.utcnow().isoformat()
    _record_jira_sync(req, effective_query, fetched, written, synced_at)
    requested_fields_list = list_issue_search_fields(fetch_fields)
    save_jira_fetch_debug(
        JiraFetchDebugInfo(
            projectKey=req.projectKey,
            pullMode=req.pullMode,
            mode=req.mode,
            cycleLabel=cycle.replace("-", " - ", 1) if "-" in cycle else cycle,
            requestJql=effective_query,
            boundedJql=last_fetch_jql,
            fetchedCount=fetched,
            writtenCount=written,
            syncedAt=synced_at,
            requestedFields=requested_fields_list,
            sampleIssues=_build_issue_samples(
                issues,
                20,
                reporter_team_field,
                assignee_team_field,
                verified_field,
            ),
            error="",
        )
    )
    return JiraFetchResult(
        syncedAt=synced_at,
        cycleLabel=cycle.replace("-", " - ", 1) if "-" in cycle else cycle,
        fetchedCount=fetched,
        writtenCount=written,
        status="success",
    )


def save_forecast_version(project_name: str, input_data: ForecastInput, result: ForecastResult, note: str) -> ForecastVersionRow:
    version_id = str(uuid4())
    created_at = datetime.utcnow().isoformat()
    cycle = f"{input_data.params.startWeek}-{input_data.params.endWeek}"
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO forecast_version(id, project_name, cycle, note, input_json, result_json, created_at, deleted_at)
            VALUES(?,?,?,?,?,?,?,NULL)
            """,
            (version_id, project_name, cycle, note, json_dumps(input_data.model_dump()), json_dumps(result.model_dump()), created_at),
        )
    _replace_weekly(project_name, "forecast", result.dataset.weekly, version_id)
    return ForecastVersionRow(id=version_id, projectName=project_name, cycle=cycle, note=note, createdAt=created_at)


def list_forecast_versions(project_name: str | None = None) -> list[ForecastVersionRow]:
    sql = """
      SELECT id, project_name, cycle, note, created_at
      FROM forecast_version
      WHERE deleted_at IS NULL
    """
    params: list[str] = []
    if project_name:
        sql += " AND project_name = ?"
        params.append(project_name)
    sql += " ORDER BY created_at DESC"
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [
        ForecastVersionRow(
            id=r["id"],
            projectName=r["project_name"],
            cycle=r["cycle"],
            note=r["note"],
            createdAt=r["created_at"],
        )
        for r in rows
    ]


def soft_delete_forecast_version(version_id: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE forecast_version SET deleted_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), version_id),
        )


def _load_weekly(project_name: str, source: str, forecast_version_id: str = "") -> list[WeeklyPoint]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT week_label, week, date, created_count, fixed_count, cum_created, cum_fixed, backlog
            FROM project_weekly
            WHERE project_name = ? AND source = ? AND forecast_version_id = ?
            ORDER BY rowid
            """,
            (project_name, source, forecast_version_id),
        ).fetchall()
    return [
        WeeklyPoint(
            week=r["week"],
            weekLabel=r["week_label"],
            date=r["date"],
            created=r["created_count"],
            fixed=r["fixed_count"],
            cumCreated=r["cum_created"],
            cumFixed=r["cum_fixed"],
            backlog=r["backlog"],
        )
        for r in rows
    ]


def build_compare(project_name: str, forecast_version_id: str | None) -> CompareResponse:
    history = _load_weekly(project_name, "history", "")
    jira = _load_weekly(project_name, "jira", "")
    forecast = _load_weekly(project_name, "forecast", forecast_version_id or "")
    if not history and not jira and not forecast:
        raise ValueError(f"No compare data for project {project_name}")

    by_week: dict[str, dict[str, WeeklyPoint]] = {}
    for source_name, rows in [("history", history), ("jira", jira), ("forecast", forecast)]:
        for row in rows:
            by_week.setdefault(row.weekLabel, {})[source_name] = row

    ordered_labels = sorted(by_week.keys(), key=_parse_week_label)
    series: list[CompareSeriesPoint] = []
    for label in ordered_labels:
        bucket = by_week[label]
        h = bucket.get("history")
        j = bucket.get("jira")
        f = bucket.get("forecast")
        series.append(
            CompareSeriesPoint(
                weekLabel=label,
                historyCreated=h.created if h else 0,
                historyFixed=h.fixed if h else 0,
                jiraCreated=j.created if j else 0,
                jiraFixed=j.fixed if j else 0,
                forecastCreated=f.created if f else 0,
                forecastFixed=f.fixed if f else 0,
                backlogHistory=h.backlog if h else 0,
                backlogJira=j.backlog if j else 0,
                backlogForecast=f.backlog if f else 0,
            )
        )

    total_h = sum(p.historyCreated for p in series)
    total_j = sum(p.jiraCreated for p in series)
    total_f = sum(p.forecastCreated for p in series)
    metrics = CompareMetrics(
        totalHistoryCreated=total_h,
        totalJiraCreated=total_j,
        totalForecastCreated=total_f,
        jiraVsForecastGap=total_j - total_f,
        historyVsForecastGap=total_h - total_f,
    )
    return CompareResponse(
        projectName=project_name,
        forecastVersionId=forecast_version_id,
        metrics=metrics,
        weekly=series,
    )


def _load_app_config(key: str) -> str | None:
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM app_config WHERE key = ?", (key,)).fetchone()
    if not row:
        return None
    return str(row["value"])


def _save_app_config(key: str, payload: object) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO app_config(key, value, updated_at)
            VALUES(?,?,?)
            ON CONFLICT(key) DO UPDATE SET
              value = excluded.value,
              updated_at = excluded.updated_at
            """,
            (key, json_dumps(payload), datetime.utcnow().isoformat()),
        )


def list_teams() -> list[TeamConfigRow]:
    return [*FIXED_TESTING_TEAMS, *FIXED_DEVELOPMENT_TEAMS]


def save_teams(rows: list[TeamConfigRow]) -> list[TeamConfigRow]:
    rows_to_save = [*FIXED_TESTING_TEAMS, *FIXED_DEVELOPMENT_TEAMS]
    with get_conn() as conn:
        conn.execute("DELETE FROM team_config")
        now = datetime.utcnow().isoformat()
        for row in rows_to_save:
            conn.execute(
                """
                INSERT INTO team_config(id, name, team_type, enabled, note, updated_at)
                VALUES(?,?,?,?,?,?)
                """,
                (
                    row.id,
                    row.name,
                    row.type,
                    1 if row.enabled else 0,
                    row.note,
                    now,
                ),
            )
    return list_teams()


def get_field_mappings() -> list[FieldMappingRow]:
    raw = _load_app_config("field_mappings")
    if not raw:
        return DEFAULT_FIELD_MAPPINGS
    try:
        data = json.loads(raw)
        if not isinstance(data, list):
            return DEFAULT_FIELD_MAPPINGS
        out = []
        for item in data:
            if not isinstance(item, dict):
                continue
            out.append(FieldMappingRow(**item))
        return out or DEFAULT_FIELD_MAPPINGS
    except Exception:
        return DEFAULT_FIELD_MAPPINGS


def save_field_mappings(rows: list[FieldMappingRow]) -> list[FieldMappingRow]:
    _save_app_config("field_mappings", [x.model_dump() for x in rows])
    return get_field_mappings()


def get_forecast_defaults() -> ForecastDefaults:
    raw = _load_app_config("forecast_defaults")
    if not raw:
        return DEFAULT_FORECAST_DEFAULTS
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return DEFAULT_FORECAST_DEFAULTS
        return ForecastDefaults(**data)
    except Exception:
        return DEFAULT_FORECAST_DEFAULTS


def save_forecast_defaults(payload: ForecastDefaults) -> ForecastDefaults:
    _save_app_config("forecast_defaults", payload.model_dump())
    return get_forecast_defaults()


def get_compare_colors() -> list[str]:
    raw = _load_app_config("compare_colors")
    if not raw:
        return DEFAULT_COMPARE_COLORS.colors
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return DEFAULT_COMPARE_COLORS.colors
        parsed = CompareColorsConfig(**data)
        return parsed.colors or DEFAULT_COMPARE_COLORS.colors
    except Exception:
        return DEFAULT_COMPARE_COLORS.colors


def save_compare_colors(payload: CompareColorsConfig) -> list[str]:
    _save_app_config("compare_colors", payload.model_dump())
    return get_compare_colors()
