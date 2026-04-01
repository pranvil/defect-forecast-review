from __future__ import annotations

import os
from io import BytesIO
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.workbook.workbook import Workbook


def get_template_path() -> Path:
    # Allow override for future environments.
    env = os.environ.get("DRP_EXPORT_TEMPLATE_PATH", "").strip()
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[2] / "templates" / "DRP_template.xlsx"


def load_template_workbook() -> Workbook:
    template_path = get_template_path()
    if not template_path.exists():
        raise FileNotFoundError(str(template_path))
    return load_workbook(filename=str(template_path))


def workbook_to_bytes(wb: Workbook) -> bytes:
    bio = BytesIO()
    wb.save(bio)
    return bio.getvalue()

