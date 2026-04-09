import type { ConfigService, ForecastDefaultsPayload } from '@/services/configService'
import { httpGet, httpPut } from '@/services/http'
import type { FieldMapping } from '@/types/settings'

export const configServiceApi: ConfigService = {
  async listFieldMappings(): Promise<FieldMapping[]> {
    return httpGet<FieldMapping[]>('/api/config/field-mappings')
  },
  async saveFieldMappings(rows: FieldMapping[]): Promise<FieldMapping[]> {
    return httpPut<FieldMapping[], FieldMapping[]>('/api/config/field-mappings', rows)
  },
  async getForecastDefaults(): Promise<ForecastDefaultsPayload> {
    return httpGet<ForecastDefaultsPayload>('/api/config/forecast-defaults')
  },
  async saveForecastDefaults(payload: ForecastDefaultsPayload): Promise<ForecastDefaultsPayload> {
    return httpPut<ForecastDefaultsPayload, ForecastDefaultsPayload>('/api/config/forecast-defaults', payload)
  },
  async getCompareColors(): Promise<string[]> {
    return httpGet<string[]>('/api/config/compare-colors')
  },
}
