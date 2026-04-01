import { compareColors } from '@/data/mock/compareColors'
import { weekLabels, weeks } from '@/data/mock/calendar'
import { getProjectHistory, projectLibrary, projectNames } from '@/data/mock/projects'
import { delay } from '@/services/delay'
import type { ProjectService, ProjectSummary } from '@/services/projectService'

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
        cycle: x.cycle!,
        defects: x.defects!,
        teams: x.teams!,
        similarity: typeof x.similarity === 'number' ? x.similarity : undefined,
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

let cachedProjects: ProjectSummary[] =
  loadCache() ??
  projectNames.map((name) => ({
    name,
    cycle: projectLibrary[name]!.cycle,
    defects: projectLibrary[name]!.defects,
    teams: projectLibrary[name]!.teams,
    similarity: projectLibrary[name]!.similarity,
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

  async buildCreatedCompareData(selected: string[]) {
    await delay(80)
    return weeks.map((_, idx) => {
      const row: Record<string, string | number> = {
        week: weekLabels[idx] ?? '',
      }
      selected.forEach((project) => {
        row[project] = projectLibrary[project]?.weekly[idx]?.created ?? 0
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
}

