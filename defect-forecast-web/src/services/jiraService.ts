import type { ProjectSummary } from '@/services/projectService'

export interface JiraFetchRequest {
  projectKey: string
  startWeek: string
  endWeek: string
  pullMode: 'jql' | 'projectStart'
  jql: string
  startDate: string
  endDate: string
  mode?: 'normal' | 'incremental' | 'overwrite'
  baseUrl: string
  authType: 'pat' | 'basic'
  username: string
  token: string
  verifySsl: boolean
  timeoutSec: number
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

