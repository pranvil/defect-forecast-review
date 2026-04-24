# DRP（缺陷预测与对比）

仓库包含：

- `export-service`：Python FastAPI 后端（Jira 拉取、历史/预测/对比 API、Excel 导出）
- `defect-forecast-web`：React + Vite 前端

## 一键启动本地开发（Windows）

在仓库根目录 `c:\code\DRP` 打开 **PowerShell**，执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\drp-dev.ps1
```

会打开两个新窗口：分别运行 **uvicorn（默认端口 8000）** 与 **npm run dev / Vite（默认端口 5173）**。首次运行若不存在 `export-service\.venv`，脚本会自动创建并安装 `requirements.txt`。脚本控制台输出为英文，避免旧版 Windows PowerShell 在 UTF-8 无 BOM 下解析异常。

**停止**（结束占用上述端口的监听进程）：

```powershell
powershell -ExecutionPolicy Bypass -File .\drp-dev.ps1 -Stop
```

自定义端口示例：

```powershell
.\drp-dev.ps1 -BackendPort 8000 -FrontendPort 5174
.\drp-dev.ps1 -BackendPort 8000 -FrontendPort 5174 -Stop
```

前端默认请求后端地址见 `defect-forecast-web` 的 `.env`（`VITE_API_BASE_URL`，一般为 `http://127.0.0.1:8000`）。

## 一键启动本地开发（macOS）

在仓库根目录执行：

```bash
chmod +x ./drp-dev-mac.sh
./drp-dev-mac.sh
```

脚本会自动：

- 创建 `export-service/.venv`
- 安装 `export-service/requirements.txt`
- 首次安装前端依赖 `defect-forecast-web/node_modules`
- 若不存在 `.env`，则从 `.env.example` 复制
- 打开两个新的 Terminal 窗口，分别启动后端和前端

停止方式：

```bash
./drp-dev-mac.sh -Stop
```

自定义端口示例：

```bash
./drp-dev-mac.sh --backend-port 8000 --frontend-port 5174
./drp-dev-mac.sh -Stop --backend-port 8000 --frontend-port 5174
```

## 分模块说明

| 目录 | 说明 |
|------|------|
| [export-service/README.md](export-service/README.md) | 后端单独启动、API 列表、Jira 字段映射、数据目录 |
| [defect-forecast-web/README.md](defect-forecast-web/README.md) | 前端环境变量、mock 开关 |
| [export-service/PACKAGING.md](export-service/PACKAGING.md) | Windows 一键打包分发（`build-drp-release.ps1`） |

## 打包给其他人用

```powershell
powershell -ExecutionPolicy Bypass -File .\build-drp-release.ps1
```

产物与使用方式见 [export-service/PACKAGING.md](export-service/PACKAGING.md)。
