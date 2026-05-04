import type { ForecastProjectParams, RefProjectRow, MilestoneParam } from '@/types/forecast'
import type { FieldMapping } from '@/types/settings'

export interface ForecastDefaultsPayload {
  refProjects: RefProjectRow[]
  milestones: MilestoneParam[]
  params: ForecastProjectParams
}

export interface ConfigService {
  listFieldMappings(): Promise<FieldMapping[]>
  saveFieldMappings(rows: FieldMapping[]): Promise<FieldMapping[]>
  getForecastDefaults(): Promise<ForecastDefaultsPayload>
  saveForecastDefaults(payload: ForecastDefaultsPayload): Promise<ForecastDefaultsPayload>
  getCompareColors(): Promise<string[]>
}
