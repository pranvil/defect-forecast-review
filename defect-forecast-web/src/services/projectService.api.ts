import type {
  ProjectCompareResult,
  ProjectService,
  ProjectSummary,
} from '@/services/projectService'
import type { ProjectHistory } from '@/types/project'
import { httpDelete, httpGet, httpPut } from '@/services/http'

export const projectServiceApi: ProjectService = {
  async listCachedProjects(): Promise<ProjectSummary[]> {
    return httpGet<ProjectSummary[]>('/api/projects/cached')
  },
  async getProjectHistory(projectName: string): Promise<ProjectHistory> {
    return httpGet<ProjectHistory>(`/api/projects/${encodeURIComponent(projectName)}/history`)
  },
  async buildCreatedCompareData(projectNames: string[]): Promise<Record<string, string | number>[]> {
    const datasets = await Promise.all(
      projectNames.map((name) => httpGet<ProjectHistory>(`/api/projects/${encodeURIComponent(name)}/history`)),
    )
    const weeks = new Set<string>()
    datasets.forEach((d) => d.weekly.forEach((w) => weeks.add(w.weekLabel)))
    const labels = Array.from(weeks).sort()
    return labels.map((week) => {
      const row: Record<string, string | number> = { week }
      datasets.forEach((dataset) => {
        const matched = dataset.weekly.find((w) => w.weekLabel === week)
        row[dataset.name] = matched?.created ?? 0
      })
      return row
    })
  },
  async getCompareColors(): Promise<string[]> {
    return httpGet<string[]>('/api/config/compare-colors')
  },
  async upsertCachedProjects(projects: ProjectSummary[]): Promise<void> {
    await httpPut<ProjectSummary[], ProjectSummary[]>('/api/projects/cached', projects)
  },
  async deleteCachedProject(projectName: string): Promise<void> {
    await httpDelete(`/api/projects/cached/${encodeURIComponent(projectName)}`)
  },
  async getProjectCompare(projectName: string, forecastVersionId?: string): Promise<ProjectCompareResult> {
    const query = forecastVersionId ? `?forecastVersionId=${encodeURIComponent(forecastVersionId)}` : ''
    return httpGet<ProjectCompareResult>(`/api/compare/${encodeURIComponent(projectName)}${query}`)
  },
}
