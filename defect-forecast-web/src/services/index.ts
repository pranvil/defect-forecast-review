import { configServiceApi } from '@/services/configService.api'
import { configServiceMock } from '@/services/configService.mock'
import { blockIssueServiceApi } from '@/services/blockIssueService'
import { blockIssueServiceMock } from '@/services/blockIssueService.mock'
import { bugDistServiceApi } from '@/services/bugDistService'
import { bugDistServiceMock } from '@/services/bugDistService.mock'
import { exportServiceMock } from '@/services/exportService.mock'
import { exportServiceReview } from '@/services/exportService.review'
import { forecastServiceApi } from '@/services/forecastService.api'
import { forecastServiceMock } from '@/services/forecastService.mock'
import { jiraServiceApi } from '@/services/jiraService.api'
import { jiraServiceMock } from '@/services/jiraService.mock'
import { projectServiceApi } from '@/services/projectService.api'
import { projectServiceMock } from '@/services/projectService.mock'
import { isReviewMode } from '@/runtime/mode'
import { teamServiceApi } from '@/services/teamService.api'
import { teamServiceMock } from '@/services/teamService.mock'

const useMock = (() => {
  const raw = import.meta.env.VITE_USE_MOCK
  if (raw === true) return true
  if (typeof raw === 'string') return raw.toLowerCase() === 'true' || raw === '1'
  return false
})()

export const services = {
  jiraService: useMock ? jiraServiceMock : jiraServiceApi,
  blockIssueService: useMock ? blockIssueServiceMock : blockIssueServiceApi,
  bugDistService: useMock ? bugDistServiceMock : bugDistServiceApi,
  projectService: useMock ? projectServiceMock : projectServiceApi,
  forecastService: useMock ? forecastServiceMock : forecastServiceApi,
  teamService: useMock ? teamServiceMock : teamServiceApi,
  configService: useMock ? configServiceMock : configServiceApi,
  exportService: isReviewMode ? exportServiceReview : exportServiceMock,
}
