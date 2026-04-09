import type {
  ForecastInput,
  ForecastResult,
  ForecastService,
  ForecastVersionRow,
} from '@/services/forecastService'
import { httpDelete, httpGet, httpPost } from '@/services/http'

type SaveForecastReq = {
  projectName: string
  input: ForecastInput
  result: ForecastResult
  note?: string
}

export const forecastServiceApi: ForecastService = {
  async getForecastResult(input: ForecastInput): Promise<ForecastResult> {
    return httpPost<ForecastInput, ForecastResult>('/api/forecast/generate', input)
  },
  async saveForecastVersion(req: SaveForecastReq): Promise<ForecastVersionRow> {
    return httpPost<SaveForecastReq, ForecastVersionRow>('/api/forecast/versions', req)
  },
  async listForecastVersions(projectName?: string): Promise<ForecastVersionRow[]> {
    const query = projectName ? `?projectName=${encodeURIComponent(projectName)}` : ''
    return httpGet<ForecastVersionRow[]>(`/api/forecast/versions${query}`)
  },
  async deleteForecastVersion(id: string): Promise<void> {
    await httpDelete(`/api/forecast/versions/${encodeURIComponent(id)}`)
  },
}
