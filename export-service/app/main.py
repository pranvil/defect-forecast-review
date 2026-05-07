from __future__ import annotations

import logging
from datetime import date
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi import Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi import HTTPException
from fastapi.staticfiles import StaticFiles

from app.bug_dist import create_task as create_bug_dist_task
from app.bug_dist import export_tab_as_csv, export_tab_as_xlsx, get_task_status as get_bug_dist_task_status
from app.block_issues import batch_mark_block_issues, build_block_template, mark_block_issue, search_block_issues
from app.db import backup_database, get_db_path, migrate
from app.excel.fill_forecast import fill_forecast_into_template
from app.excel.template_io import load_template_workbook, workbook_to_bytes
from app.jira_client import test_jira_connection
from app.issue_fact import (
    build_compare,
    delete_cached_project,
    get_jira_fetch_debug,
    get_project_history,
    jira_sync,
    list_project_summaries,
    record_jira_fetch_error,
    upsert_cached_projects,
)
from app.logic import (
    ensure_seed_data,
    generate_forecast,
    get_compare_colors,
    get_field_mappings,
    get_forecast_defaults,
    list_teams,
    list_forecast_versions,
    save_compare_colors,
    save_field_mappings,
    save_forecast_defaults,
    save_forecast_version,
    save_teams,
    soft_delete_forecast_version,
)
from app.models import (
    BugDistCreateTaskRequest,
    BugDistTaskStatus,
    BlockIssueBatchResult,
    BlockIssueMarkRequest,
    BlockIssueMarkResult,
    BlockIssueSearchRequest,
    BlockIssueSearchResult,
    CompareColorsConfig,
    CompareResponse,
    ExportError,
    ExportForecastRequest,
    FieldMappingRow,
    ForecastDefaults,
    ForecastInput,
    ForecastResult,
    ForecastVersionRow,
    JiraFetchRequest,
    JiraFetchResult,
    JiraConnectionTestRequest,
    JiraConnectionTestResult,
    JiraFetchDebugInfo,
    ProjectHistory,
    ProjectSummary,
    SaveForecastVersionRequest,
    TeamConfigRow,
)
from app.logging_utils import configure_logging

app = FastAPI(title="DRP Export Service", version="0.1.0")
logger = logging.getLogger("drp.api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WEB_DIST_DIR = Path(__file__).resolve().parents[1] / "web_dist"
WEB_DIST_INDEX = WEB_DIST_DIR / "index.html"
WEB_ASSETS_DIR = WEB_DIST_DIR / "assets"

if WEB_ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(WEB_ASSETS_DIR)), name="assets")


def _index_html_response() -> FileResponse:
    resp = FileResponse(str(WEB_DIST_INDEX))
    # Avoid stale UI in browsers (notably Chrome) after packaging/upgrades.
    # Assets are fingerprinted; index.html must be revalidated.
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


@app.on_event("startup")
def on_startup() -> None:
    log_file = configure_logging()
    migrate()
    ensure_seed_data()
    logger.info("startup complete, db=%s, web_dist=%s, log=%s", get_db_path(), WEB_DIST_DIR, log_file)


@app.middleware("http")
async def log_requests(request, call_next):
    try:
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            logger.info("%s %s -> %s", request.method, request.url.path, response.status_code)
        return response
    except Exception:
        logger.exception("unhandled request error, path=%s method=%s", request.url.path, request.method)
        raise


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "dbPath": str(get_db_path())}


@app.post("/api/jira/fetch", response_model=JiraFetchResult)
def jira_fetch(req: JiraFetchRequest) -> JiraFetchResult:
    try:
        return jira_sync(req)
    except ValueError as e:
        record_jira_fetch_error(req, str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("jira fetch unexpected error, project=%s", req.projectKey)
        record_jira_fetch_error(req, f"服务异常: {e}")
        raise HTTPException(status_code=500, detail="Jira 拉取过程中发生服务异常，请稍后重试")


@app.get("/api/jira/fetch-debug/{project_key}", response_model=JiraFetchDebugInfo)
def jira_fetch_debug(project_key: str) -> JiraFetchDebugInfo:
    payload = get_jira_fetch_debug(project_key)
    if not payload:
        raise HTTPException(status_code=404, detail=f"No debug snapshot for project {project_key}")
    return payload


@app.post("/api/jira/test-connection", response_model=JiraConnectionTestResult)
def jira_test_connection(req: JiraConnectionTestRequest) -> JiraConnectionTestResult:
    return test_jira_connection(req)


@app.post("/api/block-issues/search", response_model=BlockIssueSearchResult)
def block_issues_search(req: BlockIssueSearchRequest) -> BlockIssueSearchResult:
    try:
        return search_block_issues(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("block issue search unexpected error, project=%s", req.projectKey)
        raise HTTPException(status_code=500, detail="Block 问题拉取过程中发生服务异常，请稍后重试")


@app.post("/api/block-issues/mark", response_model=BlockIssueMarkResult)
def block_issue_mark(req: BlockIssueMarkRequest) -> BlockIssueMarkResult:
    try:
        return mark_block_issue(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("block issue mark unexpected error, issue=%s", req.issueKey)
        raise HTTPException(status_code=500, detail="Block 标记提交过程中发生服务异常，请稍后重试")


@app.post("/api/block-issues/batch", response_model=BlockIssueBatchResult)
async def block_issue_batch(
    file: UploadFile = File(...),
    projectKey: str = Form(...),
    baseUrl: str = Form(...),
    authType: str = Form("pat"),
    username: str = Form(""),
    token: str = Form(...),
    verifySsl: bool = Form(True),
    timeoutSec: int = Form(10),
    allowExistingMainCeaComment: bool = Form(False),
    allowOtherStatuses: bool = Form(False),
) -> BlockIssueBatchResult:
    try:
        content = await file.read()
        req = JiraFetchRequest(
            projectKey=projectKey,
            baseUrl=baseUrl,
            authType=authType,  # type: ignore[arg-type]
            username=username,
            token=token,
            verifySsl=verifySsl,
            timeoutSec=timeoutSec,
        )
        return batch_mark_block_issues(
            req,
            content,
            allow_existing_main_cea_comment=allowExistingMainCeaComment,
            allow_other_statuses=allowOtherStatuses,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("block issue batch unexpected error, project=%s, filename=%s", projectKey, file.filename)
        raise HTTPException(status_code=500, detail="批量 Block 标记过程中发生服务异常，请稍后重试")


@app.get("/api/block-issues/template")
def block_issue_template():
    data = build_block_template()
    filename = f"block-issues-template.{date.today().isoformat()}.xlsx"
    return StreamingResponse(
        BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/projects/cached", response_model=list[ProjectSummary])
def cached_projects() -> list[ProjectSummary]:
    return list_project_summaries()


@app.put("/api/projects/cached", response_model=list[ProjectSummary])
def cached_projects_upsert(rows: list[ProjectSummary]) -> list[ProjectSummary]:
    return upsert_cached_projects(rows)


@app.delete("/api/projects/cached/{project_name:path}")
def cached_projects_delete(project_name: str) -> dict[str, str]:
    ok = delete_cached_project(project_name)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Project not found: {project_name}")
    return {"status": "deleted", "projectName": project_name}


@app.get("/api/teams", response_model=list[TeamConfigRow])
def teams_list() -> list[TeamConfigRow]:
    return list_teams()


@app.put("/api/teams", response_model=list[TeamConfigRow])
def teams_save(rows: list[TeamConfigRow]) -> list[TeamConfigRow]:
    return save_teams(rows)


@app.get("/api/config/field-mappings", response_model=list[FieldMappingRow])
def config_field_mappings() -> list[FieldMappingRow]:
    return get_field_mappings()


@app.put("/api/config/field-mappings", response_model=list[FieldMappingRow])
def config_save_field_mappings(rows: list[FieldMappingRow]) -> list[FieldMappingRow]:
    return save_field_mappings(rows)


@app.get("/api/config/forecast-defaults", response_model=ForecastDefaults)
def config_forecast_defaults() -> ForecastDefaults:
    return get_forecast_defaults()


@app.put("/api/config/forecast-defaults", response_model=ForecastDefaults)
def config_save_forecast_defaults(payload: ForecastDefaults) -> ForecastDefaults:
    return save_forecast_defaults(payload)


@app.get("/api/config/compare-colors", response_model=list[str])
def config_compare_colors() -> list[str]:
    return get_compare_colors()


@app.put("/api/config/compare-colors", response_model=list[str])
def config_save_compare_colors(payload: CompareColorsConfig) -> list[str]:
    return save_compare_colors(payload)


@app.get("/api/projects/{project_name:path}/history", response_model=ProjectHistory)
def project_history(project_name: str) -> ProjectHistory:
    try:
        return get_project_history(project_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/forecast/generate", response_model=ForecastResult)
def forecast_generate(input_data: ForecastInput) -> ForecastResult:
    try:
        return generate_forecast(input_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/forecast/versions", response_model=ForecastVersionRow)
def forecast_save_version(req: SaveForecastVersionRequest) -> ForecastVersionRow:
    return save_forecast_version(req.projectName, req.input, req.result, req.note)


@app.get("/api/forecast/versions", response_model=list[ForecastVersionRow])
def forecast_versions(projectName: str | None = None) -> list[ForecastVersionRow]:
    return list_forecast_versions(projectName)


@app.delete("/api/forecast/versions/{version_id}")
def forecast_delete_version(version_id: str) -> dict[str, str]:
    soft_delete_forecast_version(version_id)
    return {"status": "deleted", "id": version_id}


@app.get("/api/compare/{project_name:path}", response_model=CompareResponse)
def compare_project(project_name: str, forecastVersionId: str | None = None) -> CompareResponse:
    try:
        return build_compare(project_name, forecastVersionId)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/admin/backup")
def admin_backup() -> dict[str, str]:
    path = backup_database()
    return {"status": "ok", "path": str(path)}


@app.post(
    "/api/export/forecast-xlsx",
    responses={
        400: {"model": ExportError},
        500: {"model": ExportError},
    },
)
def export_forecast_xlsx(req: ExportForecastRequest):
    try:
        wb = load_template_workbook()
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail={"detail": "Template not found", "code": "TEMPLATE_NOT_FOUND", "extra": {"path": str(e)}},
        )

    try:
        fill_forecast_into_template(wb, req)
        data = workbook_to_bytes(wb)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"detail": "Export failed", "code": "EXPORT_FAILED", "extra": {"error": repr(e)}},
        )

    filename = f"DefectForecast_{req.projectName}_{date.today().isoformat()}.xlsx".replace(" ", "_")
    return StreamingResponse(
        BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/bug-dist/tasks", response_model=dict[str, str])
def bug_dist_create_task(req: BugDistCreateTaskRequest) -> dict[str, str]:
    task_id = create_bug_dist_task(req)
    return {"taskId": task_id}


@app.get("/api/bug-dist/tasks/{task_id}", response_model=BugDistTaskStatus)
def bug_dist_task_status(task_id: str) -> BugDistTaskStatus:
    return get_bug_dist_task_status(task_id)


@app.get("/api/bug-dist/export")
def bug_dist_export(
    taskId: str = Query(min_length=1),
    tab: str = Query("module"),
    format: str = Query("csv"),
):
    status = get_bug_dist_task_status(taskId)
    if status.status != "success" or not status.result:
        raise HTTPException(status_code=400, detail="任务尚未完成，无法导出")
    normalized_tab = tab.strip().lower()
    if normalized_tab not in ("module", "team"):
        raise HTTPException(status_code=400, detail="tab 参数必须为 module 或 team")
    normalized_format = format.strip().lower()
    if normalized_format == "csv":
        data = export_tab_as_csv(status.result, normalized_tab)  # type: ignore[arg-type]
        filename = f"bug-dist.{status.result.primaryProjectKey}.{normalized_tab}.{date.today().isoformat()}.csv"
        return StreamingResponse(
            BytesIO(data),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    if normalized_format == "xlsx":
        data = export_tab_as_xlsx(status.result, normalized_tab)  # type: ignore[arg-type]
        filename = f"bug-dist.{status.result.primaryProjectKey}.{normalized_tab}.{date.today().isoformat()}.xlsx"
        return StreamingResponse(
            BytesIO(data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    raise HTTPException(status_code=400, detail="format 参数必须为 csv 或 xlsx")


@app.get("/", include_in_schema=False)
def web_root():
    if WEB_DIST_INDEX.exists():
        return _index_html_response()
    raise HTTPException(status_code=404, detail="Web UI not bundled")


@app.get("/{full_path:path}", include_in_schema=False)
def web_spa_fallback(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")

    if WEB_DIST_DIR.exists():
        candidate = WEB_DIST_DIR / full_path
        if candidate.exists() and candidate.is_file():
            return FileResponse(str(candidate))
        if WEB_DIST_INDEX.exists():
            return _index_html_response()

    raise HTTPException(status_code=404, detail="Not found")
