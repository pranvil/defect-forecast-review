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
  weekly: WeeklyPoint[]
  createdTeams?: TeamWeeklyRow[]
  fixedTeams?: TeamWeeklyRow[]
  milestones?: MilestoneLabel[]
}
