import { create } from 'zustand'
import { initialMilestones } from '@/data/mock/milestones'
import { initialRefProjects } from '@/data/mock/refProjects'
import type { MilestoneParam, RefProjectRow } from '@/types/forecast'
import { compareWeekAsc } from '@/utils/week'

type ForecastState = {
  refProjects: RefProjectRow[]
  setRefProjects: (refProjects: RefProjectRow[]) => void
  removeRefProject: (project: string) => void
  addRefProject: (row: RefProjectRow) => void
  updateRefProject: (row: RefProjectRow) => void
  milestones: MilestoneParam[]
  setMilestones: (milestones: MilestoneParam[]) => void
  addMilestone: (row: MilestoneParam) => void
  updateMilestone: (index: number, row: MilestoneParam) => void
  removeMilestone: (index: number) => void
  params: {
    newProjectName: string
    startWeek: string
    endWeek: string
  }
  setParams: (next: Partial<ForecastState['params']>) => void
}

export const useForecastStore = create<ForecastState>((set) => ({
  refProjects: initialRefProjects,
  setRefProjects: (refProjects) => set({ refProjects }),
  removeRefProject: (project) =>
    set((s) => ({
      refProjects: s.refProjects.filter((x) => x.project !== project),
    })),
  addRefProject: (row) =>
    set((s) => ({
      refProjects: [...s.refProjects, row],
    })),
  updateRefProject: (row) =>
    set((s) => {
      const exists = s.refProjects.some((x) => x.project === row.project)
      return {
        refProjects: exists
          ? s.refProjects.map((x) => (x.project === row.project ? row : x))
          : [...s.refProjects, row],
      }
    }),
  milestones: initialMilestones,
  setMilestones: (milestones) => set({ milestones }),
  addMilestone: (row) =>
    set((s) => ({
      milestones: [...s.milestones, row].slice().sort((a, b) => compareWeekAsc(a.week, b.week)),
    })),
  updateMilestone: (index, row) =>
    set((s) => ({
      milestones: s.milestones
        .map((x, i) => (i === index ? row : x))
        .slice()
        .sort((a, b) => compareWeekAsc(a.week, b.week)),
    })),
  removeMilestone: (index) =>
    set((s) => ({
      milestones: s.milestones.filter((_, i) => i !== index),
    })),
  params: {
    newProjectName: 'Aurora NP TMO',
    startWeek: '26W2',
    endWeek: '26W27',
  },
  setParams: (next) =>
    set((s) => ({
      params: { ...s.params, ...next },
    })),
}))
