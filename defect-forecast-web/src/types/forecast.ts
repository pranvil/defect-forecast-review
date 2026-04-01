export interface RefProjectRow {
  project: string
  similarity: number
  source: string
}

export interface MilestoneParam {
  name: string
  week: string
  date: string
}

export interface ForecastTeamRow {
  team: string
  group: string
  values: number[]
}
