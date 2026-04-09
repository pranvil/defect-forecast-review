import type { TeamItem } from '@/types/team'

export interface TeamService {
  listTeams(): Promise<TeamItem[]>
  saveTeams(teams: TeamItem[]): Promise<TeamItem[]>
}
