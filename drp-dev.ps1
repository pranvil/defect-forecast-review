<#
.SYNOPSIS
  Start or stop DRP dev stack: backend (uvicorn) + frontend (Vite).

.DESCRIPTION
  Start: opens two PowerShell windows (export-service, defect-forecast-web).
  Stop: kills listeners on backend/frontend ports (default 8000 / 5173).

.EXAMPLE
  .\drp-dev.ps1

.EXAMPLE
  .\drp-dev.ps1 -Stop
#>
param(
    [switch]$Stop,
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173
)

$Root = $PSScriptRoot
$BackendRoot = Join-Path $Root "export-service"
$FrontendRoot = Join-Path $Root "defect-forecast-web"
$VenvPy = Join-Path $BackendRoot ".venv\Scripts\python.exe"
$ReqFile = Join-Path $BackendRoot "requirements.txt"

function Stop-DrpDevPorts {
    param([int[]]$Ports)
    foreach ($port in $Ports) {
        $pids = @()
        $conns = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
        foreach ($c in $conns) {
            if ($c.OwningProcess -and $c.OwningProcess -ne 0) {
                $pids += [int]$c.OwningProcess
            }
        }
        $netstatRows = @(netstat -ano | Select-String -Pattern "LISTENING\s+(\d+)$" | Where-Object { $_.Line -match "[:.]$port\s+" })
        foreach ($row in $netstatRows) {
            if ($row.Line -match "LISTENING\s+(\d+)$") {
                $pids += [int]$Matches[1]
            }
        }
        foreach ($owningPid in ($pids | Sort-Object -Unique)) {
            try {
                $p = Get-Process -Id $owningPid -ErrorAction SilentlyContinue
                $name = if ($p) { $p.ProcessName } else { "?" }
                Write-Host "Stopping listener on port $port PID=$owningPid ($name)"
                Stop-Process -Id $owningPid -Force -ErrorAction Stop
            }
            catch {
                Write-Warning "Could not stop PID ${owningPid}: $_"
            }
        }
    }
}

if ($Stop) {
    Stop-DrpDevPorts -Ports @($BackendPort, $FrontendPort)
    Write-Host ""
    Write-Host "Stop attempted for ports $BackendPort (API) and $FrontendPort (Vite)."
    exit 0
}

if (-not (Test-Path -LiteralPath $BackendRoot)) {
    Write-Error "Backend folder not found: $BackendRoot"
    exit 1
}
if (-not (Test-Path -LiteralPath $FrontendRoot)) {
    Write-Error "Frontend folder not found: $FrontendRoot"
    exit 1
}

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    Write-Error "Python launcher 'py' not found. Install Python 3 and add to PATH."
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm not found. Install Node.js and add to PATH."
    exit 1
}

if (-not (Test-Path -LiteralPath $VenvPy)) {
    Write-Host "Creating venv: $(Join-Path $BackendRoot '.venv')"
    & py -m venv (Join-Path $BackendRoot ".venv")
    if (-not (Test-Path -LiteralPath $VenvPy)) {
        Write-Error "Failed to create virtual environment."
        exit 1
    }
}

if (Test-Path -LiteralPath $ReqFile) {
    Write-Host "Installing Python dependencies (if needed)..."
    & $VenvPy -m pip install -q -r $ReqFile
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "pip install returned non-zero; check requirements.txt"
    }
}

$busy = @()
foreach ($p in @($BackendPort, $FrontendPort)) {
    if (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) {
        $busy += $p
    }
}
if ($busy.Count -gt 0) {
    Write-Warning "Ports in use: $($busy -join ', '). Run: .\drp-dev.ps1 -Stop"
}

$beCmd = "Set-Location -LiteralPath '$BackendRoot'; & '$VenvPy' -m uvicorn app.main:app --reload --port $BackendPort"
Start-Process powershell -ArgumentList @("-NoExit", "-Command", $beCmd)

$feCmd = "Set-Location -LiteralPath '$FrontendRoot'; npm run dev -- --port $FrontendPort"
Start-Process powershell -ArgumentList @("-NoExit", "-Command", $feCmd)

Write-Host ""
Write-Host "Started in new windows:"
Write-Host "  Backend  http://127.0.0.1:$BackendPort"
Write-Host "  Frontend http://127.0.0.1:$FrontendPort"
Write-Host ""
Write-Host "Stop: .\drp-dev.ps1 -Stop"
Write-Host "If Vite uses another port, use that port with -FrontendPort when stopping."
