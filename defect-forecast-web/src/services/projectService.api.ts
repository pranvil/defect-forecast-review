import type {
  CompareBuildOptions,
  ProjectCompareResult,
  ProjectService,
  ProjectSummary,
} from '@/services/projectService'
import type { ProjectHistory } from '@/types/project'
import { httpDelete, httpGet, httpPut } from '@/services/http'

function parseWeekLabel(label: string): [number, number] {
  const clean = label.trim().toUpperCase().replaceAll(' ', '')
  const match = /^(\d{2})W(\d{1,2})$/.exec(clean)
  if (!match) return [9999, 9999]
  return [Number.parseInt(match[1]!, 10), Number.parseInt(match[2]!, 10)]
}

function sortWeekLabels(labels: string[]): string[] {
  return labels.sort((a, b) => {
    const [ay, aw] = parseWeekLabel(a)
    const [by, bw] = parseWeekLabel(b)
    if (ay !== by) return ay - by
    if (aw !== bw) return aw - bw
    return a.localeCompare(b)
  })
}

export const projectServiceApi: ProjectService = {
  async listCachedProjects(): Promise<ProjectSummary[]> {
    return httpGet<ProjectSummary[]>('/api/projects/cached')
  },
  async getProjectHistory(projectName: string): Promise<ProjectHistory> {
    return httpGet<ProjectHistory>(`/api/projects/${encodeURIComponent(projectName)}/history`)
  },
  async buildCreatedCompareData(
    projectNames: string[],
    options?: CompareBuildOptions,
  ): Promise<Record<string, string | number | null>[]> {
    if (!projectNames.length) return []

    const axisMode = options?.axisMode ?? 'calendar'
    const calendarWindow = options?.calendarWindow ?? 'full'
    const relativeLength = options?.relativeLength ?? 'full'
    const datasets = await Promise.all(
      projectNames.map((name) => httpGet<ProjectHistory>(`/api/projects/${encodeURIComponent(name)}/history`)),
    )

    if (axisMode === 'relative') {
      const lengths = datasets.map((d) => d.weekly.length).filter((n) => n > 0)
      if (!lengths.length) return []
      const totalLen = relativeLength === 'shortest' ? Math.min(...lengths) : Math.max(...lengths)

      return Array.from({ length: totalLen }, (_, idx) => {
        const row: Record<string, string | number | null> = { week: `第${idx + 1}周` }
        datasets.forEach((dataset) => {
          row[dataset.name] = dataset.weekly[idx]?.created ?? null
        })
        return row
      })
    }

    const weekSets = datasets.map((d) => new Set(d.weekly.map((w) => w.weekLabel)))
    let labels: string[] = []
    if (calendarWindow === 'overlap') {
      const [head, ...tail] = weekSets
      if (!head) return []
      labels = Array.from(head).filter((w) => tail.every((s) => s.has(w)))
    } else {
      const all = new Set<string>()
      weekSets.forEach((s) => s.forEach((w) => all.add(w)))
      labels = Array.from(all)
    }
    labels = sortWeekLabels(labels)

    const weekCreatedByProject = new Map<string, Map<string, number>>()
    datasets.forEach((dataset) => {
      const m = new Map<string, number>()
      dataset.weekly.forEach((w) => m.set(w.weekLabel, w.created))
      weekCreatedByProject.set(dataset.name, m)
    })

    return labels.map((week) => {
      const row: Record<string, string | number | null> = { week }
      datasets.forEach((dataset) => {
        row[dataset.name] = weekCreatedByProject.get(dataset.name)?.get(week) ?? null
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
