import type { ProjectHistory } from '@/types/project'

export interface ProjectSummary {
  name: string
  /** 人类可读项目名，用于展示；name 仍作为唯一 key（例如 Jira Project Key） */
  displayName?: string
  cycle: string
  defects: number
  teams: number
  similarity?: number
}

export type CompareAxisMode = 'calendar' | 'relative'
export type CompareCalendarWindow = 'full' | 'overlap'
export type CompareRelativeLength = 'full' | 'shortest'

export interface CompareBuildOptions {
  axisMode?: CompareAxisMode
  calendarWindow?: CompareCalendarWindow
  relativeLength?: CompareRelativeLength
}

export interface ProjectService {
  listCachedProjects(): Promise<ProjectSummary[]>
  getProjectHistory(projectName: string): Promise<ProjectHistory>
  /**
   * For history compare chart (Created trends).
   * Each row has an x-axis `week` label plus a key per selected project.
   * Missing points are null so lines break naturally instead of forcing 0.
   */
  buildCreatedCompareData(
    projectNames: string[],
    options?: CompareBuildOptions,
  ): Promise<Record<string, string | number | null>[]>
  getCompareColors(): Promise<string[]>
  upsertCachedProjects(projects: ProjectSummary[]): Promise<void>
  deleteCachedProject(projectName: string): Promise<void>
  getProjectCompare(projectName: string, forecastVersionId?: string): Promise<ProjectCompareResult>
}

export interface ProjectComparePoint {
  weekLabel: string
  historyCreated: number
  historyFixed: number
  jiraCreated: number
  jiraFixed: number
  forecastCreated: number
  forecastFixed: number
  backlogHistory: number
  backlogJira: number
  backlogForecast: number
}

export interface ProjectCompareResult {
  projectName: string
  forecastVersionId?: string
  metrics: {
    totalHistoryCreated: number
    totalJiraCreated: number
    totalForecastCreated: number
    jiraVsForecastGap: number
    historyVsForecastGap: number
  }
  weekly: ProjectComparePoint[]
}

