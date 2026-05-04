import type { ForecastProjectParams } from '@/types/forecast'

export type DefectCalculationInput = {
  Project_category: string
  Region: string
  OS: string
  Device_Type: string
  Operators: string[]
  Chipset_Status: string
  Pipeline: string
  User_Programs: string[]
  Support_SIM: 'Yes' | 'No'
  MM: number
  FR_Quantity: number
}

export function defectInputFromParams(params: ForecastProjectParams): DefectCalculationInput {
  return {
    Project_category: params.projectCategory,
    Region: params.region,
    OS: params.os,
    Device_Type: params.deviceType,
    Operators: params.operators,
    Chipset_Status: params.chipsetStatus,
    Pipeline: params.pipeline,
    User_Programs: params.userPrograms,
    Support_SIM: params.supportSim,
    MM: params.mm,
    FR_Quantity: params.frQuantity,
  }
}

export type DefectHistoricalProject = {
  name: string
  displayName?: string
  defects: number
  projectCategory?: string
  region?: string
  os?: string
  deviceType?: string
  mm?: number
}

export type SimilarProjectScore = {
  project: DefectHistoricalProject
  score: number
}

export type DefectCalculationResult = {
  estimatedDefects: number
  baseValue: number
  topProjects: SimilarProjectScore[]
  factors: {
    chipset: number
    operators: number
    userPrograms: number
    supportSim: number
    mm: number
  }
}

const SIMILARITY_FIELDS = [
  { inputKey: 'Project_category', historyKey: 'projectCategory', weight: 0.4 },
  { inputKey: 'Region', historyKey: 'region', weight: 0.3 },
  { inputKey: 'OS', historyKey: 'os', weight: 0.2 },
  { inputKey: 'Device_Type', historyKey: 'deviceType', weight: 0.1 },
] as const

function normalizeComparable(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function scoreSimilarProject(
  input: DefectCalculationInput,
  project: DefectHistoricalProject,
): number {
  const usable = SIMILARITY_FIELDS.filter(({ inputKey, historyKey }) => {
    return normalizeComparable(input[inputKey]) && normalizeComparable(project[historyKey])
  })
  const totalWeight = usable.reduce((sum, field) => sum + field.weight, 0)
  if (!totalWeight) return 0

  return usable.reduce((sum, field) => {
    const matched = normalizeComparable(input[field.inputKey]) === normalizeComparable(project[field.historyKey])
    return sum + (matched ? field.weight / totalWeight : 0)
  }, 0)
}

export function findTopSimilarProjects(
  input: DefectCalculationInput,
  historyProjects: DefectHistoricalProject[],
  limit = 3,
): SimilarProjectScore[] {
  return historyProjects
    .filter((project) => Number.isFinite(project.defects) && project.defects > 0)
    .map((project) => ({ project, score: scoreSimilarProject(input, project) }))
    .sort((a, b) => b.score - a.score || b.project.defects - a.project.defects || a.project.name.localeCompare(b.project.name))
    .slice(0, limit)
}

export function calculate_defects(
  input: DefectCalculationInput,
  historyProjects: DefectHistoricalProject[],
): DefectCalculationResult | null {
  const topProjects = findTopSimilarProjects(input, historyProjects, 3)
  if (!topProjects.length) return null

  const baseValue =
    topProjects.reduce((sum, row) => sum + row.project.defects, 0) / topProjects.length
  const chipset = input.Chipset_Status.includes('New') ? 1.2 : 1
  const operators = 1 + input.Operators.length * 0.1
  const userProgramIncrease =
    input.User_Programs.length <= 0
      ? 0
      : Math.min(0.25, 0.1 + Math.max(0, input.User_Programs.length - 1) * 0.05)
  const supportSim = input.Support_SIM === 'No' ? 0.8 : 1
  const historicalMm = topProjects
    .map((row) => row.project.mm)
    .filter((mm): mm is number => typeof mm === 'number' && Number.isFinite(mm) && mm > 0)
  const avgMm =
    historicalMm.length > 0 ? historicalMm.reduce((sum, mm) => sum + mm, 0) / historicalMm.length : 0
  const mmIncrease = avgMm > 0 && input.MM > 0 ? Math.min(0.2, Math.max(0, (input.MM / avgMm - 1) * 0.8)) : 0
  const factors = {
    chipset,
    operators,
    userPrograms: 1 + userProgramIncrease,
    supportSim,
    mm: 1 + mmIncrease,
  }

  return {
    estimatedDefects: Math.round(baseValue * chipset * operators * factors.userPrograms * supportSim * factors.mm),
    baseValue: Math.round(baseValue),
    topProjects,
    factors,
  }
}
