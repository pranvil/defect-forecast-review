import { delay } from '@/services/delay'
import type { TeamService } from '@/services/teamService'
import type { TeamItem } from '@/types/team'
import { fixedDevelopmentTeams, fixedTestingTeams } from '@/data/mock/teams'

const KEY = 'defectForecast.teams.v1'

function saveLocal(teams: TeamItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(teams))
  } catch {
    // ignore
  }
}

function normalizeTeams() {
  return [...fixedTestingTeams, ...fixedDevelopmentTeams]
}

let teamsCache: TeamItem[] = normalizeTeams()

export const teamServiceMock: TeamService = {
  async listTeams(): Promise<TeamItem[]> {
    await delay(80)
    return teamsCache.slice()
  },
  async saveTeams(_teams: TeamItem[]): Promise<TeamItem[]> {
    await delay(80)
    void _teams
    teamsCache = normalizeTeams()
    saveLocal(teamsCache)
    return teamsCache.slice()
  },
}
