import { create } from 'zustand'
import { initialTeams } from '@/data/mock/teams'
import { services } from '@/services'
import type { TeamItem } from '@/types/team'

type TeamState = {
  teams: TeamItem[]
  hydrateFromServer: () => Promise<void>
  setTeams: (teams: TeamItem[]) => void
  toggleTeamEnabled: (id: string) => void
  addTeam: (row: Omit<TeamItem, 'id'>) => void
  updateTeam: (row: TeamItem) => void
  removeTeam: (id: string) => void
}

function persistTeams(teams: TeamItem[]) {
  void services.teamService.saveTeams(teams).catch(() => {
    // ignore background persistence errors in store layer
  })
}

export const useTeamStore = create<TeamState>((set) => ({
  teams: initialTeams,
  hydrateFromServer: async () => {
    const rows = await services.teamService.listTeams()
    set({ teams: rows })
  },
  setTeams: (teams) => {
    persistTeams(teams)
    set({ teams })
  },
  toggleTeamEnabled: (id) =>
    set((s) => {
      const next = s.teams.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
      persistTeams(next)
      return { teams: next }
    }),
  addTeam: (row) =>
    set((s) => {
      const next = [...s.teams, { id: `t-${crypto.randomUUID()}`, ...row }]
      persistTeams(next)
      return { teams: next }
    }),
  updateTeam: (row) =>
    set((s) => {
      const next = s.teams.map((t) => (t.id === row.id ? row : t))
      persistTeams(next)
      return { teams: next }
    }),
  removeTeam: (id) =>
    set((s) => {
      const next = s.teams.filter((t) => t.id !== id)
      persistTeams(next)
      return { teams: next }
    }),
}))
