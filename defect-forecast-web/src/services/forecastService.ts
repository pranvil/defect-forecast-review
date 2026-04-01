import type { ForecastTeamRow, MilestoneParam, RefProjectRow } from '@/types/forecast'
import type { WeeklyPoint } from '@/types/project'

export interface ForecastParams {
  newProjectName: string
  startWeek: string
  endWeek: string
}

export interface ForecastInput {
  params: ForecastParams
  enabledTestingTeams: string[]
  enabledDevTeams: string[]
  milestones: MilestoneParam[]
  refProjects: RefProjectRow[]
}

export interface ForecastDataset {
  weekly: WeeklyPoint[]
  createdTeams: ForecastTeamRow[]
  fixedTeams: ForecastTeamRow[]
  milestones: { label: string; week: string }[]
}

export interface ForecastTeamSummaryRow {
  group: string
  created: number
  fixed: number
}

export interface ForecastResult {
  dataset: ForecastDataset
  teamSummary: ForecastTeamSummaryRow[]
}

export interface ForecastService {
  getForecastResult(input: ForecastInput): Promise<ForecastResult>
}

