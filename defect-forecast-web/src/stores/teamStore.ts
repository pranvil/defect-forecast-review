import { create } from 'zustand'
import { initialTeams } from '@/data/mock/teams'
import type { TeamItem } from '@/types/team'

type TeamState = {
  teams: TeamItem[]
  setTeams: (teams: TeamItem[]) => void
  toggleTeamEnabled: (id: string) => void
  addTeam: (row: Omit<TeamItem, 'id'>) => void
  updateTeam: (row: TeamItem) => void
  removeTeam: (id: string) => void
}

export const useTeamStore = create<TeamState>((set) => ({
  teams: initialTeams,
  setTeams: (teams) => set({ teams }),
  toggleTeamEnabled: (id) =>
    set((s) => ({
      teams: s.teams.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)),
    })),
  addTeam: (row) =>
    set((s) => ({
      teams: [...s.teams, { id: `t-${crypto.randomUUID()}`, ...row }],
    })),
  updateTeam: (row) =>
    set((s) => ({
      teams: s.teams.map((t) => (t.id === row.id ? row : t)),
    })),
  removeTeam: (id) =>
    set((s) => ({
      teams: s.teams.filter((t) => t.id !== id),
    })),
}))
