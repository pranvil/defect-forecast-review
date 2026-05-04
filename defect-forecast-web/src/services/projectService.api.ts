import type {
  CompareBuildOptions,
  ProjectCompareResult,
  ProjectService,
  ProjectSummary,
} from '@/services/projectService'
import type { ProjectHistory } from '@/types/project'
import { httpDelete, httpGet, httpPut } from '@/services/http'

const PROJECT_METADATA_OVERLAY_KEY = 'drp.projectMetadata.overlay.v1'

type ProjectMetadataOverlay = Partial<
  Pick<
    ProjectSummary,
    | 'displayName'
    | 'projectCategory'
    | 'region'
    | 'os'
    | 'deviceType'
    | 'chipsetStatus'
    | 'chipsetVendor'
    | 'chipsetNewness'
    | 'pipeline'
    | 'operators'
    | 'userPrograms'
    | 'idhVendor'
    | 'frQuantity'
    | 'mm'
    | 'supportSim'
    | 'validStartDate'
    | 'validEndDate'
  >
>

function normalizeProjectKey(projectName: string) {
  return projectName.trim().toUpperCase()
}

function readMetadataOverlay(): Record<string, ProjectMetadataOverlay> {
  try {
    const raw = localStorage.getItem(PROJECT_METADATA_OVERLAY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, ProjectMetadataOverlay>
  } catch {
    return {}
  }
}

function writeMetadataOverlay(rows: Record<string, ProjectMetadataOverlay>) {
  try {
    localStorage.setItem(PROJECT_METADATA_OVERLAY_KEY, JSON.stringify(rows))
  } catch {
    // ignore local cache failures
  }
}

function pickMetadata(project: ProjectSummary): ProjectMetadataOverlay {
  return {
    displayName: project.displayName,
    projectCategory: project.projectCategory,
    region: project.region,
    os: project.os,
    deviceType: project.deviceType,
    chipsetStatus: project.chipsetStatus,
    chipsetVendor: project.chipsetVendor,
    chipsetNewness: project.chipsetNewness,
    pipeline: project.pipeline,
    operators: project.operators,
    userPrograms: project.userPrograms,
    idhVendor: project.idhVendor,
    frQuantity: project.frQuantity,
    mm: project.mm,
    supportSim: project.supportSim,
    validStartDate: project.validStartDate,
    validEndDate: project.validEndDate,
  }
}

function hasMetadataValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && value !== ''
}

function saveMetadataOverlay(projects: ProjectSummary[]) {
  const overlay = readMetadataOverlay()
  projects.forEach((project) => {
    const key = normalizeProjectKey(project.name)
    if (!key) return
    const metadata = pickMetadata(project)
    const hasAny = Object.values(metadata).some(hasMetadataValue)
    if (hasAny) {
      overlay[key] = { ...overlay[key], ...metadata }
    }
  })
  writeMetadataOverlay(overlay)
}

function mergeMetadataOverlay<T extends ProjectSummary | ProjectHistory>(project: T): T {
  const overlay = readMetadataOverlay()[normalizeProjectKey(project.name)]
  if (!overlay) return project
  return { ...project, ...overlay }
}

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
    const projects = await httpGet<ProjectSummary[]>('/api/projects/cached')
    return projects.map(mergeMetadataOverlay)
  },
  async getProjectHistory(projectName: string): Promise<ProjectHistory> {
    const project = await httpGet<ProjectHistory>(`/api/projects/${encodeURIComponent(projectName)}/history`)
    return mergeMetadataOverlay(project)
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
    saveMetadataOverlay(projects)
    await httpPut<ProjectSummary[], ProjectSummary[]>('/api/projects/cached', projects)
  },
  async deleteCachedProject(projectName: string): Promise<void> {
    const overlay = readMetadataOverlay()
    delete overlay[normalizeProjectKey(projectName)]
    writeMetadataOverlay(overlay)
    await httpDelete(`/api/projects/cached/${encodeURIComponent(projectName)}`)
  },
  async getProjectCompare(projectName: string, forecastVersionId?: string): Promise<ProjectCompareResult> {
    const query = forecastVersionId ? `?forecastVersionId=${encodeURIComponent(forecastVersionId)}` : ''
    return httpGet<ProjectCompareResult>(`/api/compare/${encodeURIComponent(projectName)}${query}`)
  },
}
