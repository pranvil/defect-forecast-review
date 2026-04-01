import { exportServiceMock } from '@/services/exportService.mock'
import { exportServiceReview } from '@/services/exportService.review'
import { forecastServiceMock } from '@/services/forecastService.mock'
import { jiraServiceMock } from '@/services/jiraService.mock'
import { projectServiceMock } from '@/services/projectService.mock'
import { isReviewMode } from '@/runtime/mode'

export const services = {
  jiraService: jiraServiceMock,
  projectService: projectServiceMock,
  forecastService: forecastServiceMock,
  exportService: isReviewMode ? exportServiceReview : exportServiceMock,
}

