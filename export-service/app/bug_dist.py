from __future__ import annotations

import hashlib
import json
import logging
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

import pandas as pd

from app.db import DEFAULT_DATA_DIR, ensure_data_dir
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
BUG_DIST_FIELD_VERSION = "components/customfield_15319"


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
    payload = {
        "baseUrl": base,
        "projectKey": project_key.strip().upper(),
        "compareProjectKey": compare,
        "fieldVersion": BUG_DIST_FIELD_VERSION,
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
        startDate="",
        endDate="",
        mode="normal",
        baseUrl=req.baseUrl,
        authType=req.authType,
        username=req.username,
        token=req.token,
        verifySsl=req.verifySsl,
        timeoutSec=req.timeoutSec,
    )


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


def _extract_reporter_team(issue: dict[str, Any]) -> str:
    fields = issue.get("fields") if isinstance(issue, dict) else None
    if not isinstance(fields, dict):
        return "(Empty)"
    raw = fields.get("customfield_15319")
    if not isinstance(raw, dict):
        return "(Empty)"
    value = raw.get("value")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return "(Empty)"


def _to_counts_df(issues: list[dict[str, Any]]) -> pd.DataFrame:
    rows = [{"module": _extract_module(i), "team": _extract_reporter_team(i)} for i in issues]
    return pd.DataFrame(rows)


def _align_counts(
    primary: pd.Series,
    compare: pd.Series | None,
) -> list[BugDistCountRow]:
    p = primary.astype("int64")
    c = (compare.astype("int64") if compare is not None else pd.Series(dtype="int64"))
    df = pd.DataFrame({"primary": p, "compare": c}).fillna(0).astype("int64")
    df["gap"] = df["compare"] - df["primary"]
    df = df.reset_index(names=["name"])
    # 主项目降序；主项目为 0 的（副项目多出项）统一排在最后，再按 compare 降序
    df["__p0"] = (df["primary"] == 0).astype("int64")
    df = df.sort_values(by=["__p0", "primary", "compare", "name"], ascending=[True, False, False, True])
    out: list[BugDistCountRow] = []
    for row in df.itertuples(index=False):
        out.append(
            BugDistCountRow(
                name=str(row.name),
                primary=int(row.primary),
                compare=int(row.compare),
                gap=int(row.gap),
            )
        )
    return out


def _build_tab_result(primary_df: pd.DataFrame, compare_df: pd.DataFrame | None, kind: Literal["module", "team"]) -> BugDistTabResult:
    if kind == "module":
        p = primary_df.groupby("module").size()
        c = compare_df.groupby("module").size() if compare_df is not None else None
    else:
        p = primary_df.groupby("team").size()
        c = compare_df.groupby("team").size() if compare_df is not None else None
    rows = _align_counts(p, c)
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
    try:
        if not req.forceRefresh:
            cached = _read_cache(req, primary_key)
            if cached and (not compare_key or cached.compareProjectKey.strip().upper() == compare_key):
                cached.generatedAt = _utcnow_iso()
                _set_done(task_id, cached, cached=True)
                return

        def progress_cb(start_at: int, page_size: int, fetched: int, total: int):
            _set_progress(task_id, start_at=start_at, page_size=page_size, fetched=fetched, total=total, message="拉取主项目中…")

        jira_req = _jira_fetch_req_from_bug_req(req, primary_key)
        jql = f'project = "{primary_key}" AND issuetype = Defect ORDER BY created DESC'
        primary_issues = search_issues_paged(
            jira_req,
            jql=jql,
            fields=["components", "customfield_15319"],
            page_sizes=[5000, 1000, 200],
            on_progress=progress_cb,
        )
        primary_df = _to_counts_df(primary_issues)
        primary_issue_n = len(primary_issues)

        compare_df: pd.DataFrame | None = None
        compare_issue_n = 0
        if compare_key:
            def progress_cb2(start_at: int, page_size: int, fetched: int, total: int):
                _set_progress(task_id, start_at=start_at, page_size=page_size, fetched=fetched, total=total, message="拉取对比项目中…")

            jira_req2 = _jira_fetch_req_from_bug_req(req, compare_key)
            jql2 = f'project = "{compare_key}" AND issuetype = Defect ORDER BY created DESC'
            compare_issues = search_issues_paged(
                jira_req2,
                jql=jql2,
                fields=["components", "customfield_15319"],
                page_sizes=[5000, 1000, 200],
                on_progress=progress_cb2,
            )
            compare_df = _to_counts_df(compare_issues)
            compare_issue_n = len(compare_issues)

        _set_progress(task_id, start_at=0, page_size=0, fetched=len(primary_df), total=len(primary_df), message="聚合统计中…")
        module_res = _build_tab_result(primary_df, compare_df, "module")
        team_res = _build_tab_result(primary_df, compare_df, "team")
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

