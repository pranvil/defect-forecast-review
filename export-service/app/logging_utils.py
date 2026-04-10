from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.db import DEFAULT_DATA_DIR, ensure_data_dir

LOG_DIR = DEFAULT_DATA_DIR / "logs"
LOG_FILE = LOG_DIR / "drp.log"


def get_log_file_path() -> Path:
    ensure_data_dir()
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    return LOG_FILE


def configure_logging() -> Path:
    log_file = get_log_file_path()
    root = logging.getLogger()

    if getattr(configure_logging, "_configured", False):
        return log_file

    root.setLevel(logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        "%Y-%m-%d %H:%M:%S",
    )

    file_handler = RotatingFileHandler(
        filename=log_file,
        maxBytes=2 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)

    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(logging.INFO)
    stream_handler.setFormatter(formatter)

    root.addHandler(file_handler)
    root.addHandler(stream_handler)
    configure_logging._configured = True
    root.info("DRP logging initialized, file=%s", log_file)
    return log_file
