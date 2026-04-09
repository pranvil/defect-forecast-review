import { httpGet, httpPut } from '@/services/http'
import type { TeamService } from '@/services/teamService'
import type { TeamItem } from '@/types/team'

export const teamServiceApi: TeamService = {
  async listTeams(): Promise<TeamItem[]> {
    return httpGet<TeamItem[]>('/api/teams')
  },
  async saveTeams(teams: TeamItem[]): Promise<TeamItem[]> {
    return httpPut<TeamItem[], TeamItem[]>('/api/teams', teams)
  },
}
