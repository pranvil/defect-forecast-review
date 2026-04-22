from __future__ import annotations

import base64
import json
import logging
import ssl
from dataclasses import dataclass
from typing import Any, Callable, Iterable
import urllib.error
import urllib.parse
import urllib.request

from app.models import JiraConnectionTestRequest, JiraConnectionTestResult, JiraFetchRequest

logger = logging.getLogger("drp.jira")


def _normalize_base_url(base_url: str) -> str:
    url = base_url.strip().rstrip("/")
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"
    return url


def _build_auth_header(req: JiraConnectionTestRequest) -> str:
    token = req.token.strip()
    if req.authType == "basic":
        credentials = f"{req.username.strip()}:{token}".encode("utf-8")
        return f"Basic {base64.b64encode(credentials).decode('ascii')}"
    return f"Bearer {token}"


@dataclass
class JiraRequestContext:
    base_url: str
    auth_header: str
    verify_ssl: bool
    timeout_sec: int


def _context_from_fetch(req: JiraFetchRequest) -> JiraRequestContext:
    test_req = JiraConnectionTestRequest(
        baseUrl=req.baseUrl,
        authType=req.authType,
        username=req.username,
        token=req.token,
        verifySsl=req.verifySsl,
        timeoutSec=req.timeoutSec,
    )
    return JiraRequestContext(
        base_url=_normalize_base_url(req.baseUrl),
        auth_header=_build_auth_header(test_req),
        verify_ssl=req.verifySsl,
        timeout_sec=req.timeoutSec,
    )


def _do_json_request(ctx: JiraRequestContext, target: str, payload: dict[str, Any]) -> dict[str, Any]:
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": ctx.auth_header,
        "User-Agent": "DRP-Jira-Connector/0.1",
    }
    request = urllib.request.Request(
        target,
        headers=headers,
        method="POST",
        data=json.dumps(payload).encode("utf-8"),
    )
    ssl_context = None
    if not ctx.verify_ssl:
        ssl_context = ssl._create_unverified_context()
    logger.info(
        "jira request, target=%s, timeout=%s, verify_ssl=%s",
        target,
        ctx.timeout_sec,
        ctx.verify_ssl,
    )
    try:
        with urllib.request.urlopen(request, timeout=ctx.timeout_sec, context=ssl_context) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            if not raw:
                return {}
            data = json.loads(raw)
            if isinstance(data, dict):
                return data
            return {}
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8", errors="replace").strip()
        except Exception:
            detail = ""
        msg = f"Jira search 请求失败: HTTP {e.code}"
        if detail:
            msg = f"{msg} {detail[:260]}"
        logger.warning("jira http error, status=%s, target=%s, detail=%s", e.code, target, detail[:260])
        raise ValueError(msg) from e
    except urllib.error.URLError as e:
        reason = str(e.reason) if getattr(e, "reason", None) else str(e)
        logger.warning("jira network error, target=%s, reason=%s", target, reason)
        raise ValueError(f"Jira 网络错误: {reason}") from e


def _build_field_names(extra_fields: Iterable[str] | None) -> list[str]:
    fields = {"created", "resolutiondate", "resolved", "assignee"}
    if extra_fields:
        fields.update([f.strip() for f in extra_fields if isinstance(f, str) and f.strip()])
    return sorted(fields)


def list_issue_search_fields(extra_fields: Iterable[str] | None = None) -> list[str]:
    """与 search_issues 实际请求的 fields 列表一致，供调试/文档展示。"""
    return _build_field_names(extra_fields)


def search_issues(req: JiraFetchRequest, bounded_jql: str, fields: Iterable[str] | None = None) -> list[dict[str, Any]]:
    if req.authType == "basic" and not req.username.strip():
        raise ValueError("Basic Auth 需要用户名")
    ctx = _context_from_fetch(req)
    target = urllib.parse.urljoin(f"{ctx.base_url}/", "rest/api/2/search")
    max_results = 200
    start_at = 0
    total = None
    out: list[dict[str, Any]] = []
    field_names = _build_field_names(fields)
    while total is None or start_at < total:
        body = {
            "jql": bounded_jql,
            "fields": field_names,
            "maxResults": max_results,
            "startAt": start_at,
        }
        data = _do_json_request(ctx, target, body)
        issues = data.get("issues")
        if not isinstance(issues, list):
            break
        for issue in issues:
            if isinstance(issue, dict):
                out.append(issue)
        total_val = data.get("total")
        if isinstance(total_val, int):
            total = total_val
        else:
            total = start_at + len(issues)
        if len(issues) < max_results:
            break
        start_at += len(issues)
    return out


def search_issues_paged(
    req: JiraFetchRequest,
    jql: str,
    fields: Iterable[str] | None = None,
    page_sizes: Iterable[int] | None = None,
    on_progress: Callable[[int, int, int, int], None] | None = None,
) -> list[dict[str, Any]]:
    """
    分页拉取 Jira issues（按 startAt/maxResults），并支持在实例限制下自动降级分页大小。

    on_progress(start_at, page_size, fetched, total) 可用于前端展示进度。
    """
    if req.authType == "basic" and not req.username.strip():
        raise ValueError("Basic Auth 需要用户名")
    ctx = _context_from_fetch(req)
    target = urllib.parse.urljoin(f"{ctx.base_url}/", "rest/api/2/search")
    field_names = _build_field_names(fields)
    candidates = [5000, 1000, 200] if page_sizes is None else [int(x) for x in page_sizes if int(x) > 0]
    last_error: Exception | None = None
    for max_results in candidates:
        start_at = 0
        total: int | None = None
        out: list[dict[str, Any]] = []
        try:
            while total is None or start_at < total:
                body = {
                    "jql": jql,
                    "fields": field_names,
                    "maxResults": max_results,
                    "startAt": start_at,
                }
                data = _do_json_request(ctx, target, body)
                issues = data.get("issues")
                if not isinstance(issues, list):
                    break
                for issue in issues:
                    if isinstance(issue, dict):
                        out.append(issue)
                total_val = data.get("total")
                if isinstance(total_val, int):
                    total = total_val
                else:
                    total = start_at + len(issues)
                if on_progress:
                    on_progress(start_at, max_results, len(out), total or 0)
                if len(issues) < max_results:
                    break
                start_at += len(issues)
            if on_progress:
                on_progress(start_at, max_results, len(out), total or len(out))
            return out
        except ValueError as e:
            # 常见原因：maxResults 超上限、JQL/字段权限问题等。若是分页大小导致的，后续候选会更小。
            last_error = e
            logger.warning("jira paged search failed, page_size=%s, error=%s", max_results, str(e)[:200])
            continue
    if last_error:
        raise last_error
    return []


def test_jira_connection(req: JiraConnectionTestRequest) -> JiraConnectionTestResult:
    if req.authType == "basic" and not req.username.strip():
        return JiraConnectionTestResult(
            ok=False,
            statusCode=400,
            message="Basic Auth 需要用户名",
            site=req.baseUrl.strip(),
            account="",
        )

    base_url = _normalize_base_url(req.baseUrl)
    target = urllib.parse.urljoin(f"{base_url}/", "rest/api/2/myself")
    headers = {
        "Accept": "application/json",
        "Authorization": _build_auth_header(req),
        "User-Agent": "DRP-Jira-Connector/0.1",
    }
    request = urllib.request.Request(target, headers=headers, method="GET")
    ssl_context = None
    if not req.verifySsl:
        ssl_context = ssl._create_unverified_context()
    logger.info(
        "jira connection test, site=%s, auth_type=%s, timeout=%s, verify_ssl=%s",
        base_url,
        req.authType,
        req.timeoutSec,
        req.verifySsl,
    )
    try:
        with urllib.request.urlopen(request, timeout=req.timeoutSec, context=ssl_context) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            payload = json.loads(raw) if raw else {}
            account = payload.get("displayName") or payload.get("name") or payload.get("emailAddress") or ""
            return JiraConnectionTestResult(
                ok=True,
                statusCode=resp.status,
                message="Jira 连接成功",
                site=base_url,
                account=str(account),
            )
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8", errors="replace")[:240]
        except Exception:
            detail = ""
        msg = f"HTTP {e.code}"
        if detail:
            msg = f"{msg}: {detail}"
        logger.warning("jira test http error, status=%s, site=%s, detail=%s", e.code, base_url, detail)
        return JiraConnectionTestResult(
            ok=False,
            statusCode=e.code,
            message=msg,
            site=base_url,
            account="",
        )
    except urllib.error.URLError as e:
        reason = str(e.reason) if getattr(e, "reason", None) else str(e)
        logger.warning("jira test network error, site=%s, reason=%s", base_url, reason)
        return JiraConnectionTestResult(
            ok=False,
            statusCode=0,
            message=f"网络错误: {reason}",
            site=base_url,
            account="",
        )
    except Exception as e:
        logger.exception("jira test unexpected error, site=%s", base_url)
        return JiraConnectionTestResult(
            ok=False,
            statusCode=0,
            message=f"连接异常: {e}",
            site=base_url,
            account="",
        )
