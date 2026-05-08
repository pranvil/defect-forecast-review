import { delay } from '@/services/delay'
import type { JiraCreateFilterRequest, JiraCreateFilterResult, JiraFetchRequest, JiraFetchResult, JiraService } from '@/services/jiraService'
import { projectServiceMock } from '@/services/projectService.mock'

function pseudoCountFromString(s: string): number {
  let acc = 0
  for (let i = 0; i < s.length; i += 1) acc = (acc + s.charCodeAt(i) * (i + 1)) % 5000
  return 300 + acc
}

export const jiraServiceMock: JiraService = {
  async fetchByJql(req: JiraFetchRequest): Promise<JiraFetchResult> {
    await delay(450)
    const source =
      req.pullMode === 'jql'
        ? req.jql
        : `${req.projectKey}|${req.startDate}|${req.endDate}`
    const fetched = pseudoCountFromString(`${req.projectKey}|${req.startWeek}|${req.endWeek}|${source}`)
    return {
      syncedAt: new Date().toISOString(),
      cycleLabel: `${req.startWeek} - ${req.endWeek}`,
      fetchedCount: fetched,
      writtenCount: fetched,
      status: 'success',
    }
  },

  async listCachedProjects() {
    await delay(80)
    return projectServiceMock.listCachedProjects()
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createFilter(_req: JiraCreateFilterRequest): Promise<JiraCreateFilterResult> {
    await delay(50)
    return { filterId: '', filterUrl: '' }
  },
}

