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
  mm?: number
  frQuantity?: number
  operators?: string[]
  idhVendor?: string
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
const PIPELINE_FACTORS: Record<string, number> = {
  全部: 1.08,
  冒烟: 1.01,
  无冒烟: 0.99,
  不部署: 0.92,
  无: 0.92,
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
  const chipset = input.Chipset_Newness === 'New' || input.Chipset_Status.includes('New') ? 1.2 : 1
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
  const pipeline = PIPELINE_FACTORS[input.Pipeline] ?? 1
  const factors = {
    chipset,
    operators,
    userPrograms: 1 + userProgramIncrease,
    supportSim,
    mm: 1 + mmIncrease,
    pipeline,
  }

  return {
    estimatedDefects: Math.round(
      baseValue * Math.max(0.1, 1 +
        (chipset - 1) +
        (operators - 1) +
        (factors.userPrograms - 1) +
        (supportSim - 1) +
        (factors.mm - 1) +
        (pipeline - 1)
      )
    ),
    baseValue: Math.round(baseValue),
    topProjects,
    factors,
  }
}
