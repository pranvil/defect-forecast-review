import type { ExportService } from '@/services/exportService'
import { API_BASE } from '@/services/http'

export const exportServiceMock: ExportService = {
  async exportForecastToExcel(req) {
    const res = await fetch(`${API_BASE}/api/export/forecast-xlsx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })

    if (!res.ok) {
      throw new Error(`export failed: ${res.status}`)
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = url
      const safe = req.projectName.replaceAll(' ', '_')
      a.download = `DefectForecast_${safe}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      URL.revokeObjectURL(url)
    }
  },
}

