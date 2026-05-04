import type {
  ForecastProjectParams,
  ForecastTeamRow,
  MilestoneParam,
  RefProjectRow,
} from '@/types/forecast'
import type { WeeklyPoint } from '@/types/project'

export type ForecastParams = ForecastProjectParams

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

export interface ForecastReferenceProjectRow {
  name: string
  displayName?: string
  defects: number
  mm?: number
  similarity: number
}

export interface ForecastResult {
  dataset: ForecastDataset
  teamSummary: ForecastTeamSummaryRow[]
  estimatedDefects?: number
  baseValue?: number
  referenceProjects?: ForecastReferenceProjectRow[]
}

export interface ForecastVersionRow {
  id: string
  projectName: string
  cycle: string
  note: string
  createdAt: string
}

export interface ForecastService {
  getForecastResult(input: ForecastInput): Promise<ForecastResult>
  saveForecastVersion(req: { projectName: string; input: ForecastInput; result: ForecastResult; note?: string }): Promise<ForecastVersionRow>
  listForecastVersions(projectName?: string): Promise<ForecastVersionRow[]>
  deleteForecastVersion(id: string): Promise<void>
}
