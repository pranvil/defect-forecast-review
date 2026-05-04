import { delay } from '@/services/delay'
import type { TeamService } from '@/services/teamService'
import type { TeamItem } from '@/types/team'
import { fixedDevelopmentTeams, fixedTestingTeams, initialTeams } from '@/data/mock/teams'

const KEY = 'defectForecast.teams.v1'

function loadLocal(): TeamItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return initialTeams
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return initialTeams
    return parsed
      .map((x) => x as Partial<TeamItem>)
      .filter((x) => typeof x.id === 'string' && typeof x.name === 'string' && (x.type === 'testing' || x.type === 'development'))
      .map((x) => ({
        id: x.id!,
        name: x.name!,
        type: x.type!,
        enabled: x.enabled !== false,
        note: typeof x.note === 'string' ? x.note : '',
      }))
  } catch {
    return initialTeams
  }
}

function saveLocal(teams: TeamItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(teams))
  } catch {
    // ignore
  }
}

function normalizeTeams(_teams: TeamItem[]) {
  return [...fixedTestingTeams, ...fixedDevelopmentTeams]
}

let teamsCache: TeamItem[] = normalizeTeams(loadLocal())

export const teamServiceMock: TeamService = {
  async listTeams(): Promise<TeamItem[]> {
    await delay(80)
    return teamsCache.slice()
  },
  async saveTeams(teams: TeamItem[]): Promise<TeamItem[]> {
    await delay(80)
    teamsCache = normalizeTeams(teams)
    saveLocal(teamsCache)
    return teamsCache.slice()
  },
}
