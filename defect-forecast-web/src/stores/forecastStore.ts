import { create } from 'zustand'
import { initialMilestones } from '@/data/mock/milestones'
import { initialRefProjects } from '@/data/mock/refProjects'
import { services } from '@/services'
import type { ForecastProjectParams, MilestoneParam, RefProjectRow } from '@/types/forecast'
import { compareWeekAsc } from '@/utils/week'

export const defaultForecastParams: ForecastProjectParams = {
  newProjectName: 'Aurora NP TMO',
  startWeek: '26W2',
  endWeek: '26W27',
  projectCategory: 'NPI leading',
  region: 'US',
  os: 'Android',
  deviceType: 'Smart phone',
  chipsetStatus: 'Old_MTK',
  operators: [],
  userPrograms: [],
  idhVendor: '',
  frQuantity: 0,
  mm: 0,
  supportSim: 'Yes',
}

function normalizeForecastParams(params: Partial<ForecastProjectParams>): ForecastProjectParams {
  return {
    ...defaultForecastParams,
    ...params,
    operators: Array.isArray(params.operators) ? params.operators : [],
    userPrograms: Array.isArray(params.userPrograms) ? params.userPrograms : [],
    supportSim: params.supportSim === 'No' ? 'No' : 'Yes',
    frQuantity: Number.isFinite(params.frQuantity) ? Number(params.frQuantity) : 0,
    mm: Number.isFinite(params.mm) ? Number(params.mm) : 0,
  }
}

type ForecastState = {
  hydrateDefaultsFromServer: () => Promise<void>
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
  params: ForecastProjectParams
  setParams: (next: Partial<ForecastState['params']>) => void
}

function saveForecastDefaults(getState: () => ForecastState) {
  const state = getState()
  void services.configService
    .saveForecastDefaults({
      refProjects: state.refProjects,
      milestones: state.milestones,
      params: state.params,
    })
    .catch(() => {
      // keep in-memory state even when backend save fails
    })
}

export const useForecastStore = create<ForecastState>((set, get) => ({
  hydrateDefaultsFromServer: async () => {
    const payload = await services.configService.getForecastDefaults()
    set({
      refProjects: payload.refProjects,
      milestones: payload.milestones.slice().sort((a, b) => compareWeekAsc(a.week, b.week)),
      params: normalizeForecastParams(payload.params),
    })
  },
  refProjects: initialRefProjects,
  setRefProjects: (refProjects) => {
    set({ refProjects })
    saveForecastDefaults(get)
  },
  removeRefProject: (project) =>
    set((s) => {
      const next = s.refProjects.filter((x) => x.project !== project)
      queueMicrotask(() => saveForecastDefaults(get))
      return { refProjects: next }
    }),
  addRefProject: (row) =>
    set((s) => {
      const next = [...s.refProjects, row]
      queueMicrotask(() => saveForecastDefaults(get))
      return { refProjects: next }
    }),
  updateRefProject: (row) =>
    set((s) => {
      const exists = s.refProjects.some((x) => x.project === row.project)
      const next = {
        refProjects: exists
          ? s.refProjects.map((x) => (x.project === row.project ? row : x))
          : [...s.refProjects, row],
      }
      queueMicrotask(() => saveForecastDefaults(get))
      return next
    }),
  milestones: initialMilestones,
  setMilestones: (milestones) => {
    set({ milestones })
    saveForecastDefaults(get)
  },
  addMilestone: (row) =>
    set((s) => {
      const next = [...s.milestones, row].slice().sort((a, b) => compareWeekAsc(a.week, b.week))
      queueMicrotask(() => saveForecastDefaults(get))
      return { milestones: next }
    }),
  updateMilestone: (index, row) =>
    set((s) => {
      const next = s.milestones
        .map((x, i) => (i === index ? row : x))
        .slice()
        .sort((a, b) => compareWeekAsc(a.week, b.week))
      queueMicrotask(() => saveForecastDefaults(get))
      return { milestones: next }
    }),
  removeMilestone: (index) =>
    set((s) => {
      const next = s.milestones.filter((_, i) => i !== index)
      queueMicrotask(() => saveForecastDefaults(get))
      return { milestones: next }
    }),
  params: defaultForecastParams,
  setParams: (next) =>
    set((s) => {
      const merged = { ...s.params, ...next }
      queueMicrotask(() => saveForecastDefaults(get))
      return { params: merged }
    }),
}))
