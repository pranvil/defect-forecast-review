from __future__ import annotations

from datetime import date
from io import BytesIO

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi import HTTPException

from app.excel.fill_forecast import fill_forecast_into_template
from app.excel.template_io import load_template_workbook, workbook_to_bytes
from app.models import ExportError, ExportForecastRequest

app = FastAPI(title="DRP Export Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post(
    "/api/export/forecast-xlsx",
    responses={
        400: {"model": ExportError},
        500: {"model": ExportError},
    },
)
def export_forecast_xlsx(req: ExportForecastRequest):
    try:
        wb = load_template_workbook()
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail={"detail": "Template not found", "code": "TEMPLATE_NOT_FOUND", "extra": {"path": str(e)}},
        )

    try:
        fill_forecast_into_template(wb, req)
        data = workbook_to_bytes(wb)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"detail": "Export failed", "code": "EXPORT_FAILED", "extra": {"error": repr(e)}},
        )

    filename = f"DefectForecast_{req.projectName}_{date.today().isoformat()}.xlsx".replace(" ", "_")
    return StreamingResponse(
        BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

