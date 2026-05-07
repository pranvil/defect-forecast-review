param(
    [switch]$SkipNpmInstall,
    [switch]$SkipPipInstall,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "未找到命令: $Name"
    }
}

$repoRoot = (Resolve-Path $PSScriptRoot).Path
$frontendDir = Join-Path $repoRoot "defect-forecast-web"
$serviceDir = Join-Path $repoRoot "export-service"
$frontendDistDir = Join-Path $frontendDir "dist"
$webDistDir = Join-Path $serviceDir "web_dist"
$venvDir = Join-Path $serviceDir ".venv-pack"
$pythonExe = Join-Path $venvDir "Scripts\python.exe"
$releaseRoot = Join-Path $repoRoot "release"
$bundleDir = Join-Path $releaseRoot "DRP-win64"
$zipPath = Join-Path $releaseRoot "DRP-win64.zip"
$templatePath = Join-Path $serviceDir "templates\DRP_template.xlsx"
$specPath = Join-Path $serviceDir "DRP.spec"

Require-Command "npm"
Require-Command "py"

if (-not (Test-Path $frontendDir)) { throw "未找到目录: $frontendDir" }
if (-not (Test-Path $serviceDir)) { throw "未找到目录: $serviceDir" }
if (-not (Test-Path $templatePath)) { throw "未找到 Excel 模板: $templatePath" }
if (-not (Test-Path $specPath)) { throw "未找到 PyInstaller 配置: $specPath" }

if ($Clean) {
    Write-Host "[1/7] 清理旧产物..."
    if (Test-Path $webDistDir) { Remove-Item $webDistDir -Recurse -Force }
    if (Test-Path (Join-Path $serviceDir "build")) { Remove-Item (Join-Path $serviceDir "build") -Recurse -Force }
    if (Test-Path (Join-Path $serviceDir "dist")) { Remove-Item (Join-Path $serviceDir "dist") -Recurse -Force }
    if (Test-Path $bundleDir) { Remove-Item $bundleDir -Recurse -Force }
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
}

Write-Host "[2/7] 构建前端..."
Push-Location $frontendDir
try {
    if (-not $SkipNpmInstall) {
        if (Test-Path (Join-Path $frontendDir "package-lock.json")) {
            npm ci
        }
        else {
            npm install
        }
    }
    npm run build
}
finally {
    Pop-Location
}

if (-not (Test-Path $frontendDistDir)) {
    throw "前端构建失败: 未生成 $frontendDistDir"
}

Write-Host "[3/7] 复制前端静态文件到后端..."
if (Test-Path $webDistDir) { Remove-Item $webDistDir -Recurse -Force }
New-Item -ItemType Directory -Path $webDistDir | Out-Null
Copy-Item (Join-Path $frontendDistDir "*") $webDistDir -Recurse -Force
if (-not (Test-Path (Join-Path $webDistDir "index.html"))) {
    throw "前端静态文件复制失败: 未找到 $webDistDir\index.html"
}

Write-Host "[4/7] 准备 Python 打包环境..."
if (-not (Test-Path $pythonExe)) {
    py -3 -m venv $venvDir
}

if (-not $SkipPipInstall) {
    & $pythonExe -m pip install --upgrade pip
    & $pythonExe -m pip install -r (Join-Path $serviceDir "requirements.txt")
    & $pythonExe -m pip install pyinstaller
}
else {
    & $pythonExe -c "import PyInstaller, fastapi, uvicorn, openpyxl, pandas"
}

Write-Host "[5/7] 生成 exe (PyInstaller)..."
Push-Location $serviceDir
try {
    & $pythonExe -m PyInstaller `
        --noconfirm `
        --clean `
        "DRP.spec"
}
finally {
    Pop-Location
}

$distDir = Join-Path $serviceDir "dist\DRP"
if (-not (Test-Path $distDir)) {
    throw "后端打包失败: 未生成 $distDir"
}

Write-Host "[6/7] 组织分发目录..."
if (-not (Test-Path $releaseRoot)) { New-Item -ItemType Directory -Path $releaseRoot | Out-Null }
if (Test-Path $bundleDir) { Remove-Item $bundleDir -Recurse -Force }
New-Item -ItemType Directory -Path $bundleDir | Out-Null
Copy-Item (Join-Path $distDir "*") $bundleDir -Recurse -Force

$readmeText = @"
DRP 本地版使用说明
==================

1) 双击 DRP.exe 启动服务
2) 程序会自动打开浏览器页面
3) 如未自动打开，请手动访问 http://127.0.0.1:8000
4) 关闭服务：在 DRP.exe 窗口按 Ctrl + C，或直接关闭窗口

数据目录:
- %USERPROFILE%\.drp
"@
Set-Content -Path (Join-Path $bundleDir "README.txt") -Value $readmeText -Encoding UTF8

Write-Host "[7/7] 生成压缩包..."
if (-not (Test-Path $bundleDir)) { throw "分发目录不存在: $bundleDir" }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $bundleDir "*") -DestinationPath $zipPath -Force

Write-Host ""
Write-Host "打包完成:"
Write-Host "目录: $bundleDir"
Write-Host "压缩包: $zipPath"
