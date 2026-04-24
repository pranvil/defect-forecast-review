#!/bin/zsh

set -euo pipefail

BACKEND_PORT=8000
FRONTEND_PORT=5173
STOP_MODE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -Stop|--stop)
      STOP_MODE=1
      shift
      ;;
    -BackendPort|--backend-port)
      BACKEND_PORT="$2"
      shift 2
      ;;
    -FrontendPort|--frontend-port)
      FRONTEND_PORT="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
Usage:
  ./drp-dev-mac.sh
  ./drp-dev-mac.sh -Stop
  ./drp-dev-mac.sh --backend-port 8000 --frontend-port 5174

Description:
  Start or stop the DRP dev stack on macOS:
  - backend: FastAPI + uvicorn
  - frontend: React + Vite
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/export-service"
FRONTEND_DIR="$ROOT_DIR/defect-forecast-web"
BACKEND_VENV_DIR="$BACKEND_DIR/.venv"
BACKEND_PYTHON="$BACKEND_VENV_DIR/bin/python"
REQ_FILE="$BACKEND_DIR/requirements.txt"
FRONTEND_ENV_EXAMPLE="$FRONTEND_DIR/.env.example"
FRONTEND_ENV_FILE="$FRONTEND_DIR/.env"

stop_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti tcp:"$port" || true)

  if [[ -z "$pids" ]]; then
    echo "No listener found on port $port."
    return
  fi

  for pid in ${(f)pids}; do
    local name
    name=$(ps -p "$pid" -o comm= | xargs || true)
    echo "Stopping listener on port $port PID=$pid ${name:+($name)}"
    kill -9 "$pid" || true
  done
}

open_in_terminal() {
  local title="$1"
  local command="$2"

  osascript <<EOF >/dev/null
tell application "Terminal"
  activate
  do script "printf '\\\\e]1;${title}\\\\a'; cd '$ROOT_DIR'; $command"
end tell
EOF
}

if [[ "$STOP_MODE" -eq 1 ]]; then
  stop_port "$BACKEND_PORT"
  stop_port "$FRONTEND_PORT"
  echo
  echo "Stop attempted for ports $BACKEND_PORT (API) and $FRONTEND_PORT (Vite)."
  exit 0
fi

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "Backend folder not found: $BACKEND_DIR"
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "Frontend folder not found: $FRONTEND_DIR"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found. Please install Python 3 first."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Please install Node.js first."
  exit 1
fi

if [[ ! -d "$BACKEND_VENV_DIR" ]]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$BACKEND_VENV_DIR"
fi

if [[ -f "$REQ_FILE" ]]; then
  echo "Installing Python dependencies if needed..."
  "$BACKEND_PYTHON" -m pip install -q -r "$REQ_FILE"
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm install)
fi

if [[ -f "$FRONTEND_ENV_EXAMPLE" && ! -f "$FRONTEND_ENV_FILE" ]]; then
  echo "Creating frontend .env from .env.example..."
  cp "$FRONTEND_ENV_EXAMPLE" "$FRONTEND_ENV_FILE"
fi

for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  if lsof -i tcp:"$port" >/dev/null 2>&1; then
    echo "Port $port is already in use. Run ./drp-dev-mac.sh -Stop first."
    exit 1
  fi
done

BACKEND_CMD="cd '$BACKEND_DIR' && '$BACKEND_PYTHON' -m uvicorn app.main:app --reload --port $BACKEND_PORT"
FRONTEND_CMD="cd '$FRONTEND_DIR' && npm run dev -- --port $FRONTEND_PORT"

open_in_terminal "DRP Backend" "$BACKEND_CMD"
sleep 1
open_in_terminal "DRP Frontend" "$FRONTEND_CMD"

echo
echo "Started in new Terminal windows:"
echo "  Backend  http://127.0.0.1:$BACKEND_PORT"
echo "  Frontend http://127.0.0.1:$FRONTEND_PORT"
echo
echo "Stop:"
echo "  ./drp-dev-mac.sh -Stop"
