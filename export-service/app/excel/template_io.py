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
    wb = load_workbook(filename=str(template_path))
    sanitize_template_workbook(wb)
    return wb


def sanitize_template_workbook(wb: Workbook) -> None:
    """
    The source DRP template carries many legacy external workbook links and
    named ranges that point to missing sheets (#REF!). They are not used by the
    export sheet, and Excel may prompt to repair the generated file if they are
    preserved after dynamic row edits.
    """
    if hasattr(wb, "_external_links"):
        wb._external_links = []  # type: ignore[attr-defined]
    wb.defined_names.clear()
    try:
        wb.calculation.fullCalcOnLoad = True
        wb.calculation.forceFullCalc = True
    except Exception:
        pass


def workbook_to_bytes(wb: Workbook) -> bytes:
    bio = BytesIO()
    wb.save(bio)
    return bio.getvalue()
