import type {
  ForecastProjectParams,
  ForecastTeamRow,
  MilestoneParam,
  RefProjectRow,
} from '@/types/forecast'
import type { MilestoneLabel, WeeklyPoint } from '@/types/project'
import type { TeamItem } from '@/types/team'

export type ForecastParams = ForecastProjectParams

export interface ForecastInput {
  params: ForecastParams
  milestoneTargetMode?: 'currentWeek' | 'previousWeek'
  enabledTestingTeams: string[]
  enabledDevTeams: string[]
  testingTeamConfigs?: TeamItem[]
  devTeamConfigs?: TeamItem[]
  milestones: MilestoneParam[]
  refProjects: RefProjectRow[]
}

export interface ForecastDataset {
  weekly: WeeklyPoint[]
  createdTeams: ForecastTeamRow[]
  fixedTeams: ForecastTeamRow[]
  milestones: MilestoneLabel[]
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

export interface ForecastFactors {
  chipset: number
  operators: number
  userPrograms: number
  supportSim: number
  mm: number
  pipeline: number
  frQuantity: number
}

export interface ForecastWarning {
  type: 'milestone_conflict' | 'team_allocation'
  severity: 'warning' | 'info'
  message: string
  milestone?: string
  metric?: 'testSubmissionRate' | 'devResolutionRate'
  currentRate?: number
  suggestedRate?: number
  currentWeek?: string
  suggestedWeek?: string
}

export interface ForecastResult {
  dataset: ForecastDataset
  teamSummary: ForecastTeamSummaryRow[]
  estimatedDefects?: number
  baseValue?: number
  referenceProjects?: ForecastReferenceProjectRow[]
  factors?: ForecastFactors
  warnings?: ForecastWarning[]
}

export interface ForecastVersionRow {
  id: string
  projectName: string
  cycle: string
  note: string
  createdAt: string
  result?: ForecastResult
}

export interface ForecastService {
  getForecastResult(input: ForecastInput): Promise<ForecastResult>
  saveForecastVersion(req: { projectName: string; input: ForecastInput; result: ForecastResult; note?: string }): Promise<ForecastVersionRow>
  listForecastVersions(projectName?: string): Promise<ForecastVersionRow[]>
  deleteForecastVersion(id: string): Promise<void>
}
