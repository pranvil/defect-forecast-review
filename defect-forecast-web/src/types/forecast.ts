export interface RefProjectRow {
  project: string
  similarity: number
  source: string
}

export interface MilestoneParam {
  name: string
  week: string
  date: string
  /** 开发解决率（%），可选 */
  devResolutionRate?: number | null
  /** 测试完成率（%），可选 */
  testCompletionRate?: number | null
  /** 测试提交率（%），可选 */
  testSubmissionRate?: number | null
}

export interface ForecastTeamRow {
  team: string
  group: string
  values: number[]
}

export interface ForecastProjectParams {
  newProjectName: string
  startWeek: string
  endWeek: string
  milestoneTargetMode?: 'currentWeek' | 'previousWeek'
  projectCategory: string
  region: string
  os: string
  deviceType: string
  chipsetStatus: string
  chipsetVendor: string
  chipsetNewness: string
  pipeline: string
  operators: string[]
  userPrograms: string[]
  idhVendor: string
  frQuantity: number
  mm: number
  supportSim: 'Yes' | 'No'
}

export interface ForecastTeamSelection {
  testing: string[]
  development: string[]
}
