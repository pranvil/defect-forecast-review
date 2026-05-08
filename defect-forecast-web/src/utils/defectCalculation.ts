import type { ForecastProjectParams } from '@/types/forecast'

export type DefectCalculationInput = {
  Project_category: string
  Region: string
  OS: string
  Device_Type: string
  Chipset_Vendor: string
  Operators: string[]
  Chipset_Status: string
  Chipset_Newness: string
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
    Chipset_Vendor: params.chipsetVendor || params.chipsetStatus.split('_')[1] || '',
    Operators: params.operators,
    Chipset_Status: params.chipsetStatus,
    Chipset_Newness: params.chipsetNewness || params.chipsetStatus.split('_')[0] || '',
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
  chipsetVendor?: string
  chipsetStatus?: string
  chipsetNewness?: string
  pipeline?: string
  mm?: number
  frQuantity?: number
  operators?: string[]
  userPrograms?: string[]
  idhVendor?: string
  supportSim?: 'Yes' | 'No'
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
    pipeline: number
    frQuantity: number
  }
}

const SIMILARITY_WEIGHTS = [
  { key: 'projectCategory', weight: 0.25 },
  { key: 'region', weight: 0.2 },
  { key: 'os', weight: 0.15 },
  { key: 'chipsetVendor', weight: 0.1 },
  { key: 'operatorOverlap', weight: 0.2 },
  { key: 'frQuantityBand', weight: 0.1 },
] as const

const IDH_SIMILARITY_WEIGHTS = [
  { key: 'projectCategory', weight: 0.2 },
  { key: 'idhVendor', weight: 0.25 },
  { key: 'region', weight: 0.15 },
  { key: 'os', weight: 0.1 },
  { key: 'chipsetVendor', weight: 0.1 },
  { key: 'operatorOverlap', weight: 0.15 },
  { key: 'frQuantityBand', weight: 0.05 },
] as const

const IDH_PROJECT_CATEGORIES = new Set(['idh联合项目', 'idh全o'])
const FR_QUANTITY_BANDS = [500, 1000, ...Array.from({ length: 38 }, (_, i) => 1500 + i * 500)]
const FR_QUANTITY_RATIO_DELTAS = [
  { upper: 0.5, delta: -0.1 },
  { upper: 0.6, delta: -0.08 },
  { upper: 0.7, delta: -0.06 },
  { upper: 0.8, delta: -0.04 },
  { upper: 0.9, delta: -0.025 },
  { upper: 0.95, delta: -0.01 },
  { upper: 1.05, delta: 0 },
  { upper: 1.1, delta: 0.01 },
  { upper: 1.2, delta: 0.025 },
  { upper: 1.35, delta: 0.04 },
  { upper: 1.5, delta: 0.06 },
  { upper: 1.75, delta: 0.08 },
] as const
const PIPELINE_FACTORS: Record<string, number> = {
  全部: 1.08,
  冒烟: 1.01,
  无冒烟: 0.99,
  不部署: 0.92,
  无: 0.92,
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function normalizeComparable(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function operatorOverlap(inputValues: string[], projectValues?: string[]): number | null {
  const inputSet = new Set(inputValues.map(normalizeComparable).filter(Boolean))
  const projectSet = new Set((projectValues ?? []).map(normalizeComparable).filter(Boolean))
  if (!inputSet.size || !projectSet.size) return null
  const intersection = [...inputSet].filter((x) => projectSet.has(x)).length
  const union = new Set([...inputSet, ...projectSet]).size
  return union ? intersection / union : null
}

function frBandIndex(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const index = FR_QUANTITY_BANDS.findIndex((upper) => value <= upper)
  return index >= 0 ? index : FR_QUANTITY_BANDS.length
}

function frBandSimilarity(inputValue: number, projectValue?: number): number | null {
  const inputBand = frBandIndex(inputValue)
  const projectBand = frBandIndex(projectValue)
  if (inputBand == null || projectBand == null) return null
  const diff = Math.abs(inputBand - projectBand)
  if (diff === 0) return 1
  if (diff === 1) return 0.75
  if (diff === 2) return 0.4
  return 0
}

function frQuantityDelta(inputValue: number, referenceAverage: number): number {
  if (!Number.isFinite(inputValue) || inputValue <= 0) return 0
  if (!Number.isFinite(referenceAverage) || referenceAverage <= 0) return 0
  const ratio = inputValue / referenceAverage
  return FR_QUANTITY_RATIO_DELTAS.find((band) => ratio <= band.upper)?.delta ?? 0.1
}

function fieldSimilarity(
  input: DefectCalculationInput,
  project: DefectHistoricalProject,
  key: string,
): number | null {
  if (key === 'operatorOverlap') return operatorOverlap(input.Operators, project.operators)
  if (key === 'frQuantityBand') return frBandSimilarity(input.FR_Quantity, project.frQuantity)
  const inputValue =
    key === 'projectCategory'
      ? input.Project_category
      : key === 'region'
        ? input.Region
        : key === 'os'
          ? input.OS
          : key === 'chipsetVendor'
            ? input.Chipset_Vendor
            : ''
  const projectValue = String(project[key as keyof DefectHistoricalProject] ?? '')
  if (!normalizeComparable(inputValue) || !normalizeComparable(projectValue)) return null
  return normalizeComparable(inputValue) === normalizeComparable(projectValue) ? 1 : 0
}

export function scoreSimilarProject(
  input: DefectCalculationInput,
  project: DefectHistoricalProject,
): number | null {
  const inputDevice = normalizeComparable(input.Device_Type)
  const projectDevice = normalizeComparable(project.deviceType)
  if (inputDevice && projectDevice && inputDevice !== projectDevice) return null

  const inputCategory = normalizeComparable(input.Project_category)
  const projectCategory = normalizeComparable(project.projectCategory)
  const inputIsIdh = IDH_PROJECT_CATEGORIES.has(inputCategory)
  const projectIsIdh = IDH_PROJECT_CATEGORIES.has(projectCategory)
  if (inputCategory && projectCategory && inputIsIdh !== projectIsIdh) return null

  const weights = inputIsIdh
    ? IDH_SIMILARITY_WEIGHTS
    : SIMILARITY_WEIGHTS
  const usable: Array<{ score: number; weight: number }> = []
  weights.forEach((field) => {
    const score = fieldSimilarity(input, project, field.key)
    if (score !== null) usable.push({ score, weight: field.weight })
  })
  const totalWeight = usable.reduce((sum, field) => sum + field.weight, 0)
  if (!totalWeight) return 0

  return usable.reduce((sum, field) => {
    return sum + field.score * (field.weight / totalWeight)
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
    .filter((row): row is SimilarProjectScore => row.score !== null && row.score > 0)
    .sort((a, b) => b.score - a.score || b.project.defects - a.project.defects || a.project.name.localeCompare(b.project.name))
    .filter((row, index) => row.score >= 0.995 || index < limit)
}

export function calculate_defects(
  input: DefectCalculationInput,
  historyProjects: DefectHistoricalProject[],
): DefectCalculationResult | null {
  const topProjects = findTopSimilarProjects(input, historyProjects, 3)
  if (!topProjects.length) return null

  const baseValue =
    topProjects.reduce((sum, row) => sum + row.project.defects, 0) / topProjects.length
  const chipsetInput = input.Chipset_Newness === 'New' || input.Chipset_Status.includes('New') ? 1.2 : 1
  const operatorCountInput = input.Operators.length
  const operatorIncreaseInput = Math.max(0, operatorCountInput - 1) * 0.1
  const operatorsInput = Math.min(1.5, 1 + operatorIncreaseInput)
  const userProgramIncreaseInput =
    input.User_Programs.length <= 0
      ? 0
      : Math.min(0.25, 0.1 + Math.max(0, input.User_Programs.length - 1) * 0.05)
  const userProgramsInput = 1 + userProgramIncreaseInput
  const supportSimInput = input.Support_SIM === 'No' ? 0.8 : 1
  const pipelineInput = PIPELINE_FACTORS[input.Pipeline] ?? 1

  const refChipsetAvg =
    topProjects.reduce((sum, row) => {
      const n = row.project.chipsetNewness ?? row.project.chipsetStatus?.split('_')[0] ?? ''
      return sum + (n === 'New' ? 1.2 : 1)
    }, 0) / topProjects.length
  const refOperatorsAvg =
    topProjects.reduce((sum, row) => {
      const n = row.project.operators?.length ?? 0
      const inc = Math.max(0, n - 1) * 0.1
      return sum + Math.min(1.5, 1 + inc)
    }, 0) / topProjects.length
  const refUserProgramsAvg =
    topProjects.reduce((sum, row) => {
      const n = row.project.userPrograms?.length ?? 0
      const inc = n <= 0 ? 0 : Math.min(0.25, 0.1 + Math.max(0, n - 1) * 0.05)
      return sum + (1 + inc)
    }, 0) / topProjects.length
  const refSupportSimAvg =
    topProjects.reduce((sum, row) => sum + (row.project.supportSim === 'No' ? 0.8 : 1), 0) / topProjects.length
  const refPipelineAvg =
    topProjects.reduce((sum, row) => sum + (PIPELINE_FACTORS[row.project.pipeline ?? ''] ?? 1), 0) / topProjects.length
  const historicalFrQuantities = topProjects
    .map((row) => row.project.frQuantity)
    .filter((fr): fr is number => typeof fr === 'number' && Number.isFinite(fr) && fr > 0)
  const refFrQuantityAvg =
    historicalFrQuantities.length > 0
      ? historicalFrQuantities.reduce((sum, fr) => sum + fr, 0) / historicalFrQuantities.length
      : 1
  const historicalMm = topProjects
    .map((row) => row.project.mm)
    .filter((mm): mm is number => typeof mm === 'number' && Number.isFinite(mm) && mm > 0)
  const avgMm =
    historicalMm.length > 0 ? historicalMm.reduce((sum, mm) => sum + mm, 0) / historicalMm.length : 0
  const mmIncrease =
    avgMm > 0 && input.MM > 0
      ? clamp((input.MM / avgMm - 1) * 0.4, -0.2, 0.2)
      : 0
  const chipsetRelative = (chipsetInput - 1) - (refChipsetAvg - 1)
  const operatorsRelative = (operatorsInput - 1) - (refOperatorsAvg - 1)
  const userProgramsRelative = (userProgramsInput - 1) - (refUserProgramsAvg - 1)
  const supportSimRelative = (supportSimInput - 1) - (refSupportSimAvg - 1)
  const pipelineRelative = (pipelineInput - 1) - (refPipelineAvg - 1)
  const frQuantityRelative = frQuantityDelta(input.FR_Quantity, refFrQuantityAvg)
  const factors = {
    chipset: 1 + chipsetRelative,
    operators: 1 + operatorsRelative,
    userPrograms: 1 + userProgramsRelative,
    supportSim: 1 + supportSimRelative,
    mm: 1 + mmIncrease,
    pipeline: 1 + pipelineRelative,
    frQuantity: 1 + frQuantityRelative,
  }

  return {
    estimatedDefects: Math.round(
      baseValue *
        Math.max(
          0.1,
          1 +
            (factors.chipset - 1) +
            (factors.operators - 1) +
            (factors.userPrograms - 1) +
            (factors.supportSim - 1) +
            (factors.mm - 1) +
            (factors.pipeline - 1) +
            (factors.frQuantity - 1),
        ),
    ),
    baseValue: Math.round(baseValue),
    topProjects,
    factors,
  }
}
