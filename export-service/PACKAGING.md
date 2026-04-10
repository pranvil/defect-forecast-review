# DRP 本地版打包与分发说明

开发者日常联调可在仓库根目录使用 `drp-dev.ps1` 启动/停止前后端，说明见根目录 [README.md](../README.md)。

本文档说明如何将当前项目一键打包为可分发给其他同事本地使用的 Windows 版本。

## 1. 适用范围

- 仓库根目录：`c:\code\DRP`
- 前端目录：`defect-forecast-web`
- 后端目录：`export-service`
- 一键打包脚本：`build-drp-release.ps1`

## 2. 环境准备

打包机需要安装并可在命令行使用：

- Node.js（含 `npm`）
- Python 3（含 `py` 启动器）

建议首次先验证：

```powershell
npm -v
py --version
```

## 3. 一键打包

在仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\build-drp-release.ps1
```

脚本会自动执行以下步骤：

1. 构建前端（`defect-forecast-web/dist`）
2. 将前端静态文件复制到后端（`export-service/web_dist`）
3. 在 `export-service` 下使用 PyInstaller 打包 `run_local.py` 为 `DRP.exe`
4. 打包时附带模板文件与前端静态文件
5. 生成分发目录与压缩包

## 4. 打包产物

打包完成后会生成：

- 目录：`release/DRP-win64`
- 压缩包：`release/DRP-win64.zip`

对外分发建议直接发送 `release/DRP-win64.zip`。

## 5. 接收方如何使用

1. 解压 `DRP-win64.zip`
2. 双击 `DRP.exe`
3. 程序会自动打开浏览器；若未自动打开，手动访问 `http://127.0.0.1:8000`
4. 如需停止服务，在 `DRP.exe` 黑色窗口按 `Ctrl + C` 或直接关闭窗口

数据默认保存在本机：

- `%USERPROFILE%\.drp`

日志默认保存在：

- `%USERPROFILE%\.drp\logs\drp.log`

## 6. 常用参数

脚本支持以下可选参数：

- `-Clean`：打包前清理旧产物
- `-SkipNpmInstall`：跳过前端依赖安装
- `-SkipPipInstall`：跳过 Python 依赖安装

示例（增量打包加速）：

```powershell
powershell -ExecutionPolicy Bypass -File .\build-drp-release.ps1 -SkipNpmInstall -SkipPipInstall
```

## 7. 常见问题

- `npm` 或 `py` 未找到  
  说明系统环境变量未配置好，先安装并重开终端。

- 双击 `DRP.exe` 后页面打不开  
  先看控制台是否有报错；再确认端口 `8000` 未被占用。

- 点击“测试 Jira 连接”显示 `Failed to fetch`  
  先确认 `DRP.exe` 窗口还在运行，再查看日志 `%USERPROFILE%\.drp\logs\drp.log` 中是否有 `drp.jira` 错误。

- 新版覆盖后打不开  
  若旧版仍在运行，端口会被占用。先关闭旧窗口，再覆盖文件并启动新版。

- 导出时报模板缺失  
  需要确认打包产物内包含 `templates/DRP_template.xlsx`（脚本默认会带上）。

- Jira 连接失败  
  优先检查 URL、用户名/Token、证书校验选项与网络可达性。
