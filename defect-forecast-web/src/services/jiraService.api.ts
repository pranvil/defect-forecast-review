import type { JiraFetchRequest, JiraFetchResult, JiraService } from '@/services/jiraService'
import type { ProjectSummary } from '@/services/projectService'
import { httpGet, httpPost } from '@/services/http'

export const jiraServiceApi: JiraService = {
  async fetchByJql(req: JiraFetchRequest): Promise<JiraFetchResult> {
    return httpPost<JiraFetchRequest & { mode?: 'normal' | 'incremental' | 'overwrite' }, JiraFetchResult>(
      '/api/jira/fetch',
      req,
    )
  },
  async listCachedProjects(): Promise<ProjectSummary[]> {
    return httpGet<ProjectSummary[]>('/api/projects/cached')
  },
}
