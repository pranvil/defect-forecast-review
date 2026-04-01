import type { ProjectSummary } from '@/services/projectService'

export interface JiraFetchRequest {
  projectKey: string
  startWeek: string
  endWeek: string
  jql: string
}

export interface JiraFetchResult {
  syncedAt: string
  cycleLabel: string
  fetchedCount: number
  writtenCount: number
  status: 'success' | 'failed'
}

export interface JiraService {
  fetchByJql(req: JiraFetchRequest): Promise<JiraFetchResult>
  listCachedProjects(): Promise<ProjectSummary[]>
}

