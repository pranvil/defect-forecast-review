# DRP Export Service (MVP)

本目录提供一个 **最小 Python 本地服务**，仅负责“基于真实模板导出 Excel”。

## 启动

在 Windows PowerShell / CMD 中：

```bash
cd c:\code\DRP\export-service

py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

服务启动后：

- `POST http://127.0.0.1:8000/api/export/forecast-xlsx`

## 模板

默认模板路径：

- `export-service/templates/DRP_template.xlsx`

可通过环境变量覆盖：

- `DRP_EXPORT_TEMPLATE_PATH`

