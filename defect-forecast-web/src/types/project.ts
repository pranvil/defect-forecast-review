export interface WeeklyPoint {
  week: string
  weekLabel: string
  date: string
  created: number
  fixed: number
  cumCreated: number
  cumFixed: number
  backlog: number
}

export interface TeamWeeklyRow {
  team: string
  values: number[]
  issueKeysByWeek?: string[][]
}

export interface MilestoneLabel {
  label: string
  week: string
}

export interface ProjectHistory {
  name: string
  displayName?: string
  cycle: string
  defects: number
  teams: number
  similarity?: number
  projectCategory?: string
  region?: string
  os?: string
  deviceType?: string
  chipsetStatus?: string
  chipsetVendor?: string
  chipsetNewness?: string
  pipeline?: string
  operators?: string[]
  userPrograms?: string[]
  idhVendor?: string
  frQuantity?: number
  mm?: number
  supportSim?: 'Yes' | 'No'
  validStartDate?: string
  validEndDate?: string
  weekly: WeeklyPoint[]
  createdTeams?: TeamWeeklyRow[]
  fixedTeams?: TeamWeeklyRow[]
  milestones?: MilestoneLabel[]
}
