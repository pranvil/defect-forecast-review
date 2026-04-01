import type { ForecastDataset } from '@/services/forecastService'

export interface ExportForecastRequest {
  projectName: string
  dataset: ForecastDataset
}

export interface ExportService {
  exportForecastToExcel(req: ExportForecastRequest): Promise<void>
}

