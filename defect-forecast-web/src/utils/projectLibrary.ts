import type { ProjectSummary } from '@/services/projectService'

const FAVORITES_KEY = 'drp.projectLibrary.favorites.v1'
const RECENTS_KEY = 'drp.projectLibrary.recents.v1'
const MAX_RECENTS = 12

type ProjectLike = {
  name: string
  displayName?: string
}

function normalizeProjectKey(projectKey: string) {
  return projectKey.trim().toUpperCase()
}

function readStringArray(key: string) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x) => (typeof x === 'string' ? normalizeProjectKey(x) : ''))
      .filter(Boolean)
  } catch {
    return []
  }
}

function writeStringArray(key: string, values: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(values))
  } catch {
    // ignore persistence failures
  }
}

export function formatProjectLabel(projectKey: string, displayName?: string) {
  const key = normalizeProjectKey(projectKey)
  const name = displayName?.trim()
  return name ? `${name}（${key}）` : key
}

export function buildProjectDisplayMap(projects: ProjectLike[]) {
  const map: Record<string, string> = {}
  projects.forEach((project) => {
    const key = normalizeProjectKey(project.name)
    const displayName = project.displayName?.trim()
    if (key && displayName) map[key] = displayName
  })
  return map
}

export function getProjectSearchText(project: ProjectSummary) {
  return [
    normalizeProjectKey(project.name),
    project.displayName?.trim() ?? '',
    project.cycle,
    String(project.defects),
    String(project.teams),
    project.projectCategory ?? '',
    project.region ?? '',
    project.os ?? '',
    project.deviceType ?? '',
    project.chipsetStatus ?? '',
    project.pipeline ?? '',
    project.operators?.join(' ') ?? '',
    project.userPrograms?.join(' ') ?? '',
    project.idhVendor ?? '',
    project.frQuantity == null ? '' : String(project.frQuantity),
    project.mm == null ? '' : String(project.mm),
    project.supportSim ?? '',
    project.validStartDate ?? '',
    project.validEndDate ?? '',
  ]
    .join(' ')
    .toLowerCase()
}

export function loadFavoriteProjectKeys() {
  return readStringArray(FAVORITES_KEY)
}

export function saveFavoriteProjectKeys(keys: string[]) {
  const normalized = Array.from(new Set(keys.map((x) => normalizeProjectKey(x)).filter(Boolean)))
  writeStringArray(FAVORITES_KEY, normalized)
  return normalized
}

export function toggleFavoriteProjectKey(projectKey: string) {
  const key = normalizeProjectKey(projectKey)
  if (!key) return loadFavoriteProjectKeys()
  const current = loadFavoriteProjectKeys()
  const next = current.includes(key) ? current.filter((x) => x !== key) : [key, ...current]
  return saveFavoriteProjectKeys(next)
}

export function loadRecentProjectKeys() {
  return readStringArray(RECENTS_KEY)
}

export function recordRecentProjectKey(projectKey: string) {
  const key = normalizeProjectKey(projectKey)
  if (!key) return loadRecentProjectKeys()
  const current = loadRecentProjectKeys().filter((x) => x !== key)
  const next = [key, ...current].slice(0, MAX_RECENTS)
  writeStringArray(RECENTS_KEY, next)
  return next
}

export function normalizeProjectSummary(project: ProjectSummary): ProjectSummary {
  return {
    ...project,
    name: normalizeProjectKey(project.name),
    displayName: project.displayName?.trim() || undefined,
  }
}
