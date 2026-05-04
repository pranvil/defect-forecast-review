import { compareColors } from '@/data/mock/compareColors'
import { weekLabels } from '@/data/mock/calendar'
import { getProjectHistory, projectLibrary, projectNames } from '@/data/mock/projects'
import { delay } from '@/services/delay'
import type { CompareBuildOptions, ProjectService, ProjectSummary } from '@/services/projectService'

const CACHE_KEY = 'defectForecast.cachedProjects.v1'

function loadCache(): ProjectSummary[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const rows = parsed
      .map((x) => x as Partial<ProjectSummary>)
      .filter(
        (x) =>
          typeof x.name === 'string' &&
          typeof x.cycle === 'string' &&
          typeof x.defects === 'number' &&
          typeof x.teams === 'number',
      )
      .map((x) => ({
        name: x.name!,
        displayName: typeof x.displayName === 'string' && x.displayName.trim() ? x.displayName.trim() : undefined,
        cycle: x.cycle!,
        defects: x.defects!,
        teams: x.teams!,
        similarity: typeof x.similarity === 'number' ? x.similarity : undefined,
        projectCategory: typeof x.projectCategory === 'string' ? x.projectCategory : undefined,
        region: typeof x.region === 'string' ? x.region : undefined,
        os: typeof x.os === 'string' ? x.os : undefined,
        deviceType: typeof x.deviceType === 'string' ? x.deviceType : undefined,
        chipsetStatus: typeof x.chipsetStatus === 'string' ? x.chipsetStatus : undefined,
        pipeline: typeof x.pipeline === 'string' ? x.pipeline : undefined,
        operators: Array.isArray(x.operators) ? x.operators.filter((v): v is string => typeof v === 'string') : undefined,
        userPrograms: Array.isArray(x.userPrograms) ? x.userPrograms.filter((v): v is string => typeof v === 'string') : undefined,
        idhVendor: typeof x.idhVendor === 'string' ? x.idhVendor : undefined,
        frQuantity: typeof x.frQuantity === 'number' ? x.frQuantity : undefined,
        mm: typeof x.mm === 'number' ? x.mm : undefined,
        supportSim:
          x.supportSim === 'No' ? ('No' as const) : x.supportSim === 'Yes' ? ('Yes' as const) : undefined,
        validStartDate: typeof x.validStartDate === 'string' ? x.validStartDate : undefined,
        validEndDate: typeof x.validEndDate === 'string' ? x.validEndDate : undefined,
      }))
    return rows.length ? rows : null
  } catch {
    return null
  }
}

function persistCache(rows: ProjectSummary[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows))
  } catch {
    // ignore
  }
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

let cachedProjects: ProjectSummary[] =
  loadCache() ??
  projectNames.map((name) => ({
    name,
    cycle: projectLibrary[name]!.cycle,
    defects: projectLibrary[name]!.defects,
    teams: projectLibrary[name]!.teams,
    similarity: projectLibrary[name]!.similarity,
    projectCategory: projectLibrary[name]!.projectCategory,
    region: projectLibrary[name]!.region,
    os: projectLibrary[name]!.os,
    deviceType: projectLibrary[name]!.deviceType,
    chipsetStatus: projectLibrary[name]!.chipsetStatus,
    pipeline: projectLibrary[name]!.pipeline,
    operators: projectLibrary[name]!.operators,
    userPrograms: projectLibrary[name]!.userPrograms,
    idhVendor: projectLibrary[name]!.idhVendor,
    frQuantity: projectLibrary[name]!.frQuantity,
    mm: projectLibrary[name]!.mm,
    supportSim: projectLibrary[name]!.supportSim,
    validStartDate: projectLibrary[name]!.validStartDate,
    validEndDate: projectLibrary[name]!.validEndDate,
  }))

export const projectServiceMock: ProjectService = {
  async listCachedProjects(): Promise<ProjectSummary[]> {
    await delay(120)
    return cachedProjects.slice()
  },

  async getProjectHistory(projectName: string) {
    await delay(120)
    return getProjectHistory(projectName)
  },

  async buildCreatedCompareData(selected: string[], options?: CompareBuildOptions) {
    await delay(80)
    if (!selected.length) return []

    const axisMode = options?.axisMode ?? 'calendar'
    const calendarWindow = options?.calendarWindow ?? 'full'
    const relativeLength = options?.relativeLength ?? 'full'
    const datasets = selected.map((name) => getProjectHistory(name))

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
      labels = weekLabels.slice()
      if (!labels.length) {
        const all = new Set<string>()
        weekSets.forEach((s) => s.forEach((w) => all.add(w)))
        labels = Array.from(all)
      }
    }
    labels = sortWeekLabels(labels)

    return labels.map((label) => {
      const row: Record<string, string | number | null> = { week: label }
      datasets.forEach((dataset) => {
        const matched = dataset.weekly.find((w) => w.weekLabel === label)
        row[dataset.name] = matched?.created ?? null
      })
      return row
    })
  },

  async getCompareColors() {
    await delay(10)
    return compareColors
  },

  async upsertCachedProjects(projects: ProjectSummary[]) {
    await delay(80)
    const byName = new Map(cachedProjects.map((p) => [p.name, p]))
    projects.forEach((p) => {
      const existing = byName.get(p.name)
      byName.set(p.name, { ...existing, ...p })
    })
    cachedProjects = Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
    persistCache(cachedProjects)
  },
  async deleteCachedProject(projectName: string) {
    await delay(60)
    cachedProjects = cachedProjects.filter((x) => x.name !== projectName)
    persistCache(cachedProjects)
  },
  async getProjectCompare(projectName) {
    await delay(80)
    const history = getProjectHistory(projectName)
    const weekly = history.weekly.map((w) => ({
      weekLabel: w.weekLabel,
      historyCreated: w.created,
      historyFixed: w.fixed,
      jiraCreated: Math.max(0, w.created - 3),
      jiraFixed: Math.max(0, w.fixed - 2),
      forecastCreated: Math.max(0, w.created + 4),
      forecastFixed: Math.max(0, w.fixed + 1),
      backlogHistory: w.backlog,
      backlogJira: Math.max(0, w.backlog - 8),
      backlogForecast: w.backlog + 12,
    }))
    const totalHistoryCreated = weekly.reduce((s, r) => s + r.historyCreated, 0)
    const totalJiraCreated = weekly.reduce((s, r) => s + r.jiraCreated, 0)
    const totalForecastCreated = weekly.reduce((s, r) => s + r.forecastCreated, 0)
    return {
      projectName,
      metrics: {
        totalHistoryCreated,
        totalJiraCreated,
        totalForecastCreated,
        jiraVsForecastGap: totalJiraCreated - totalForecastCreated,
        historyVsForecastGap: totalHistoryCreated - totalForecastCreated,
      },
      weekly,
    }
  },
}
