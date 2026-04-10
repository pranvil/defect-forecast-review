from __future__ import annotations

import os
import socket
import threading
import time
import urllib.error
import urllib.request
import webbrowser
import logging

import uvicorn
from app.logging_utils import configure_logging


def _wait_for_server_and_open(url: str, host: str, port: int, timeout_sec: int = 30) -> None:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            if sock.connect_ex((host, port)) == 0:
                webbrowser.open(url)
                return
        time.sleep(0.2)


def _is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def _is_drp_server_running(url: str) -> bool:
    health_url = f"{url}/api/health"
    try:
        with urllib.request.urlopen(health_url, timeout=1.0) as resp:
            return 200 <= getattr(resp, "status", 0) < 300
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def main() -> None:
    # Avoid plugin entry-point scanning in frozen environment, which can fail
    # on malformed/non-utf8 metadata from third-party packages.
    os.environ.setdefault("PYDANTIC_DISABLE_PLUGINS", "__all__")
    log_file = configure_logging()
    logger = logging.getLogger("drp.launcher")

    from app.main import app as fastapi_app

    host = os.environ.get("DRP_HOST", "127.0.0.1")
    port = int(os.environ.get("DRP_PORT", "8000"))
    url = f"http://{host}:{port}"
    logger.info("launcher starting, host=%s port=%s log=%s", host, port, log_file)

    if _is_port_open(host, port):
        if _is_drp_server_running(url):
            logger.info("existing DRP instance detected, opening browser only")
            webbrowser.open(url)
            print(f"检测到 DRP 已在运行，已打开: {url}")
            return
        logger.error("port already in use: %s:%s", host, port)
        print(f"端口已被占用: {host}:{port}，请先关闭占用进程后重试")
        return

    threading.Thread(
        target=_wait_for_server_and_open,
        args=(url, host, port),
        daemon=True,
    ).start()

    # Use direct object import so PyInstaller can reliably collect app package.
    logger.info("starting uvicorn server")
    uvicorn.run(fastapi_app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
