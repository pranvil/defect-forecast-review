import type { ProjectHistory } from '@/types/project'

export interface ProjectSummary {
  name: string
  cycle: string
  defects: number
  teams: number
  similarity?: number
}

export interface ProjectService {
  listCachedProjects(): Promise<ProjectSummary[]>
  getProjectHistory(projectName: string): Promise<ProjectHistory>
  /**
   * For history compare chart (Created trends) by week label.
   * Each row has a `week` field plus a key per selected project.
   */
  buildCreatedCompareData(projectNames: string[]): Promise<Record<string, string | number>[]>
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

