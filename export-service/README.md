# DRP Export Service (MVP+)

> **本地联调**：可在仓库根目录用 `powershell -ExecutionPolicy Bypass -File .\drp-dev.ps1` 同时启动本服务与前端；停止用同一脚本加 `-Stop`。说明见根目录 [README.md](../README.md)。

本目录提供一个本地 Python 服务，负责：

- Jira 真实拉取并按业务周入库（`/api/jira/fetch`）
- 历史/预测/对比相关 API
- 团队与配置类 API（字段映射、预测默认参数、对比色）
- 基于模板导出 Excel（`/api/export/forecast-xlsx`）

## 启动

在 Windows PowerShell / CMD 中：

```bash
cd c:\code\DRP\export-service

py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

服务启动后：
http://127.0.0.1:8000/api/jira/fetch-debug/MNTNPOM   # 上次的获取的jira内容
- `POST http://127.0.0.1:8000/api/export/forecast-xlsx`
- `GET http://127.0.0.1:8000/api/health`
- `POST http://127.0.0.1:8000/api/jira/fetch`
- `POST http://127.0.0.1:8000/api/jira/test-connection`
- `GET http://127.0.0.1:8000/api/projects/cached`
- `GET http://127.0.0.1:8000/api/projects/{project_name}/history`
- `GET http://127.0.0.1:8000/api/teams`
- `PUT http://127.0.0.1:8000/api/teams`
- `GET http://127.0.0.1:8000/api/config/field-mappings`
- `PUT http://127.0.0.1:8000/api/config/field-mappings`
- `GET http://127.0.0.1:8000/api/config/forecast-defaults`
- `PUT http://127.0.0.1:8000/api/config/forecast-defaults`
- `GET http://127.0.0.1:8000/api/config/compare-colors`
- `PUT http://127.0.0.1:8000/api/config/compare-colors`
- `POST http://127.0.0.1:8000/api/forecast/generate`
- `POST http://127.0.0.1:8000/api/forecast/versions`
- `GET http://127.0.0.1:8000/api/forecast/versions?projectName=xxx`
- `DELETE http://127.0.0.1:8000/api/forecast/versions/{id}`
- `GET http://127.0.0.1:8000/api/compare/{project_name}?forecastVersionId=xxx`
- `POST http://127.0.0.1:8000/api/admin/backup`

## Jira 拉取说明

`POST /api/jira/fetch` 需要在请求体中携带 Jira 连接信息与抓取参数：

- `projectKey/startWeek/endWeek/jql/mode`
- `baseUrl/authType/username/token/verifySsl/timeoutSec`

`mode` 语义：

- `normal`: 覆盖更新本次周期窗口的数据
- `incremental`: 只写入当前窗口中数据库尚不存在的周
- `overwrite`: 重建该项目 Jira 周数据

自定义字段在 Jira REST API 中必须用 **字段 ID**（`customfield_xxxxx`）。在 Web「系统配置 → 字段映射」里把 `jiraFieldPath` 配成你实例的 ID（示例：`Reporter Team-New` → `customfield_15319`，`Assignee Team` → `customfield_15320`，`last time to set verified_sw` → `customfield_13228`）。抓取后可在 `GET /api/jira/fetch-debug/{projectKey}` 的 `requestedFields` 与 `sampleIssues` 中核对。

## 数据目录（工程化）

- 默认数据目录：`%USERPROFILE%\\.drp`
- 默认数据库：`%USERPROFILE%\\.drp\\drp.sqlite3`
- 备份目录：`%USERPROFILE%\\.drp\\backups`
- 可通过环境变量 `DRP_DATA_DIR` 覆盖数据根目录

## 迁移/备份/恢复

```bash
cd c:\code\DRP\export-service
.\.venv\Scripts\python.exe scripts\migrate.py
.\.venv\Scripts\python.exe scripts\backup.py
.\.venv\Scripts\python.exe scripts\restore.py "C:\path\to\backup.sqlite3"
```

## 模板

默认模板路径：

- `export-service/templates/DRP_template.xlsx`

可通过环境变量覆盖：

- `DRP_EXPORT_TEMPLATE_PATH`

## 一键打包（给其他人本地使用）

详见同目录 [PACKAGING.md](PACKAGING.md)。在仓库根目录执行 `.\build-drp-release.ps1` 即可。

