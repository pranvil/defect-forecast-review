import { create } from 'zustand'
import { initialMilestones } from '@/data/mock/milestones'
import { initialRefProjects } from '@/data/mock/refProjects'
import { services } from '@/services'
import type {
  ForecastProjectParams,
  ForecastTeamSelection,
  MilestoneParam,
  RefProjectRow,
} from '@/types/forecast'

export const defaultForecastParams: ForecastProjectParams = {
  newProjectName: 'Aurora NP TMO',
  startWeek: '26W2',
  endWeek: '26W27',
  milestoneTargetMode: 'currentWeek',
  projectCategory: 'NPI leading',
  region: 'US',
  os: 'Android',
  deviceType: 'Smart phone',
  chipsetStatus: 'Old_MTK',
  chipsetVendor: 'MTK',
  chipsetNewness: 'Old',
  pipeline: '不部署',
  operators: [],
  userPrograms: [],
  idhVendor: '',
  frQuantity: 0,
  mm: 0,
  supportSim: 'Yes',
}

const legacyInitialMilestones: Array<Pick<MilestoneParam, 'name' | 'week' | 'date'>> = [
  { name: 'FC checklist', week: '26W4', date: '2026-01-19' },
  { name: 'M1-1', week: '26W5', date: '2026-01-26' },
  { name: 'M1-2', week: '26W6', date: '2026-02-02' },
  { name: 'M1-3', week: '26W7', date: '2026-02-09' },
  { name: 'V1', week: '26W17', date: '2026-04-20' },
  { name: 'V4', week: '26W23', date: '2026-06-01' },
]

const milestoneNameCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
})

function normalizeForecastParams(params: Partial<ForecastProjectParams>): ForecastProjectParams {
  const legacyStatus = params.chipsetStatus ?? defaultForecastParams.chipsetStatus
  const [legacyNewness = '', legacyVendor = ''] = legacyStatus.split('_')
  return {
    ...defaultForecastParams,
    ...params,
    chipsetVendor: params.chipsetVendor || legacyVendor || defaultForecastParams.chipsetVendor,
    chipsetNewness: params.chipsetNewness || legacyNewness || defaultForecastParams.chipsetNewness,
    operators: Array.isArray(params.operators) ? params.operators : [],
    userPrograms: Array.isArray(params.userPrograms) ? params.userPrograms : [],
    supportSim: params.supportSim === 'No' ? 'No' : 'Yes',
    milestoneTargetMode: params.milestoneTargetMode === 'previousWeek' ? 'previousWeek' : 'currentWeek',
    frQuantity: Number.isFinite(params.frQuantity) ? Number(params.frQuantity) : 0,
    mm: Number.isFinite(params.mm) ? Number(params.mm) : 0,
  }
}

function isLegacyInitialMilestones(milestones: MilestoneParam[]): boolean {
  return (
    milestones.length === legacyInitialMilestones.length &&
    milestones.every((m, index) => {
      const legacy = legacyInitialMilestones[index]
      return m.name === legacy.name && m.week === legacy.week && m.date === legacy.date
    })
  )
}

function compareMilestoneAsc(a: MilestoneParam, b: MilestoneParam): number {
  return milestoneNameCollator.compare(a.name, b.name)
}

function normalizeMilestones(milestones: MilestoneParam[]): MilestoneParam[] {
  const rows = isLegacyInitialMilestones(milestones) ? initialMilestones : milestones
  return rows.slice().sort(compareMilestoneAsc)
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
  resetMilestonesToSystemPreset: () => void
  addMilestone: (row: MilestoneParam) => void
  updateMilestone: (index: number, row: MilestoneParam) => void
  removeMilestone: (index: number) => void
  teamSelection: ForecastTeamSelection
  setTeamSelection: (next: Partial<ForecastTeamSelection>) => void
  toggleSelectedTeam: (type: keyof ForecastTeamSelection, team: string, checked: boolean) => void
  ensureDefaultTeamSelection: (testingTeams: string[], devTeams: string[]) => void
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
      milestones: normalizeMilestones(payload.milestones),
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
  milestones: normalizeMilestones(initialMilestones),
  setMilestones: (milestones) => {
    set({ milestones: normalizeMilestones(milestones) })
    saveForecastDefaults(get)
  },
  resetMilestonesToSystemPreset: () => {
    set({ milestones: normalizeMilestones(initialMilestones) })
    saveForecastDefaults(get)
  },
  addMilestone: (row) =>
    set((s) => {
      const next = normalizeMilestones([...s.milestones, row])
      queueMicrotask(() => saveForecastDefaults(get))
      return { milestones: next }
    }),
  updateMilestone: (index, row) =>
    set((s) => {
      const next = s.milestones
        .map((x, i) => (i === index ? row : x))
      const sorted = normalizeMilestones(next)
      queueMicrotask(() => saveForecastDefaults(get))
      return { milestones: sorted }
    }),
  removeMilestone: (index) =>
    set((s) => {
      const next = s.milestones.filter((_, i) => i !== index)
      queueMicrotask(() => saveForecastDefaults(get))
      return { milestones: next }
    }),
  teamSelection: { testing: [], development: [] },
  setTeamSelection: (next) =>
    set((s) => ({
      teamSelection: {
        testing: next.testing ?? s.teamSelection.testing,
        development: next.development ?? s.teamSelection.development,
      },
    })),
  toggleSelectedTeam: (type, team, checked) =>
    set((s) => {
      const current = new Set(s.teamSelection[type])
      if (checked) current.add(team)
      else current.delete(team)
      return {
        teamSelection: {
          ...s.teamSelection,
          [type]: Array.from(current),
        },
      }
    }),
  ensureDefaultTeamSelection: (testingTeams, devTeams) =>
    set((s) => {
      if (s.teamSelection.testing.length && s.teamSelection.development.length) return s
      return {
        teamSelection: {
          testing: s.teamSelection.testing.length ? s.teamSelection.testing : testingTeams,
          development: s.teamSelection.development.length ? s.teamSelection.development : devTeams,
        },
      }
    }),
  params: defaultForecastParams,
  setParams: (next) =>
    set((s) => {
      const merged = { ...s.params, ...next }
      queueMicrotask(() => saveForecastDefaults(get))
      return { params: merged }
    }),
}))
