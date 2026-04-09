import type { RefProjectRow, MilestoneParam } from '@/types/forecast'
import type { FieldMapping } from '@/types/settings'

export interface ForecastDefaultsPayload {
  refProjects: RefProjectRow[]
  milestones: MilestoneParam[]
  params: {
    newProjectName: string
    startWeek: string
    endWeek: string
  }
}

export interface ConfigService {
  listFieldMappings(): Promise<FieldMapping[]>
  saveFieldMappings(rows: FieldMapping[]): Promise<FieldMapping[]>
  getForecastDefaults(): Promise<ForecastDefaultsPayload>
  saveForecastDefaults(payload: ForecastDefaultsPayload): Promise<ForecastDefaultsPayload>
  getCompareColors(): Promise<string[]>
}
