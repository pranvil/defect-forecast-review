import { delay } from '@/services/delay'
import type { JiraFetchRequest, JiraFetchResult, JiraService } from '@/services/jiraService'
import { projectServiceMock } from '@/services/projectService.mock'

function pseudoCountFromString(s: string): number {
  let acc = 0
  for (let i = 0; i < s.length; i += 1) acc = (acc + s.charCodeAt(i) * (i + 1)) % 5000
  return 300 + acc
}

export const jiraServiceMock: JiraService = {
  async fetchByJql(req: JiraFetchRequest): Promise<JiraFetchResult> {
    await delay(450)
    const fetched = pseudoCountFromString(`${req.projectKey}|${req.startWeek}|${req.endWeek}|${req.jql}`)
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
}

