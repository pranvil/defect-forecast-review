import type { ForecastWarning } from '@/services/forecastService'
import type { ForecastTeamRow, MilestoneParam } from '@/types/forecast'
import type { ProjectHistory, WeeklyPoint } from '@/types/project'
import type { TeamItem } from '@/types/team'
import { compareWeekAsc } from '@/utils/week'

const CONFLICT_THRESHOLD_PERCENT = 12

type RateMetric = 'testSubmissionRate' | 'devResolutionRate'

type Constraint = {
  milestone: string
  week: string
  index: number
  rate: number
  metric: RateMetric
  targetCum?: number
}

type DistributionResult = {
  weekly: WeeklyPoint[]
  warnings: ForecastWarning[]
}

function inverseNormalCdf(p: number): number {
  const a1 = -39.69683028665376
  const a2 = 220.9460984245205
  const a3 = -275.9285104469687
  const a4 = 138.357751867269
  const a5 = -30.66479806614716
  const a6 = 2.506628277459239
  const b1 = -54.47609879822406
  const b2 = 161.5858368580409
  const b3 = -155.6989798598866
  const b4 = 66.80131188771972
  const b5 = -13.28068155288572
  const c1 = -0.007784894002430293
  const c2 = -0.3223964580411365
  const c3 = -2.400758277161838
  const c4 = -2.549732539343734
  const c5 = 4.374664141464968
  const c6 = 2.938163982698783
  const d1 = 0.007784695709041462
  const d2 = 0.3224671290700398
  const d3 = 2.445134137142996
  const d4 = 3.754408661907416
  const plow = 0.02425
  const phigh = 1 - plow
  const safeP = Math.min(0.999, Math.max(0.001, p))
  if (safeP < plow) {
    const q = Math.sqrt(-2 * Math.log(safeP))
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
  }
  if (safeP > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - safeP))
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
  }
  const q = safeP - 0.5
  const r = q * q
  return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
    (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
}

function roundToTotal(raw: number[], targetTotal: number): number[] {
  const floored = raw.map((v) => Math.max(0, Math.floor(v)))
  let remainder = targetTotal - floored.reduce((sum, v) => sum + v, 0)
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)
  for (const item of order) {
    if (remainder <= 0) break
    floored[item.index] += 1
    remainder -= 1
  }
  return floored
}

function cumulative(values: number[]): number[] {
  let total = 0
  return values.map((v) => {
    total += v
    return total
  })
}

function findWeekIndex(weekly: WeeklyPoint[], week: string): number {
  const normalized = week.trim()
  if (!normalized) return -1
  return weekly.findIndex((row) => row.weekLabel === normalized || row.week === normalized.replace(/^26/i, ''))
}

function previousWeekIndex(index: number): number {
  return index > 0 ? index - 1 : index
}

function collectConstraints(
  weekly: WeeklyPoint[],
  milestones: MilestoneParam[],
  metric: RateMetric,
): Constraint[] {
  return milestones
    .map((m) => ({
      milestone: m.name,
      week: m.week,
      index: previousWeekIndex(findWeekIndex(weekly, m.week)),
      rate: m[metric],
      metric,
    }))
    .filter(
      (x): x is Constraint =>
        x.index >= 0 && typeof x.rate === 'number' && Number.isFinite(x.rate),
    )
    .map((x) => ({ ...x, rate: Math.min(100, Math.max(0, x.rate)) }))
    .sort((a, b) => a.index - b.index)
}

function inferPeakIndex(length: number, constraints: Constraint[]): number {
  if (!constraints.length) return (length - 1) / 2
  const sigma = Math.max(1.5, length / 5)
  const estimates = constraints.map((c) => c.index - sigma * inverseNormalCdf(c.rate / 100))
  return Math.min(length - 1, Math.max(0, estimates.reduce((sum, v) => sum + v, 0) / estimates.length))
}

function gaussianWeights(length: number, peakIndex: number): number[] {
  const sigma = Math.max(1.5, length / 5)
  return Array.from({ length }, (_, idx) => Math.exp(-0.5 * ((idx - peakIndex) / sigma) ** 2))
}

function suggestedWeekForRate(weekly: WeeklyPoint[], cumulativeRates: number[], rate: number): string {
  const target = rate / 100
  const idx = cumulativeRates
    .map((v, index) => ({ index, delta: Math.abs(v - target) }))
    .sort((a, b) => a.delta - b.delta)[0]?.index
  return idx === undefined ? '' : weekly[idx]?.weekLabel ?? ''
}

function buildMetricWarnings(
  weekly: WeeklyPoint[],
  constraints: Constraint[],
  weights: number[],
  denominatorByIndex?: number[],
): ForecastWarning[] {
  const totalWeight = weights.reduce((sum, v) => sum + v, 0) || 1
  const cdf = cumulative(weights).map((v) => v / totalWeight)
  return constraints.flatMap((constraint) => {
    const denominator = denominatorByIndex?.[constraint.index]
    const suggestedRate = denominator
      ? Math.round((((cdf[constraint.index] ?? 0) * (denominatorByIndex?.at(-1) ?? denominator)) / denominator) * 100)
      : Math.round((cdf[constraint.index] ?? 0) * 100)
    const delta = Math.abs(suggestedRate - constraint.rate)
    if (delta <= CONFLICT_THRESHOLD_PERCENT) return []
    const metricLabel = constraint.metric === 'testSubmissionRate' ? '测试提交率' : '开发解决率'
    const suggestedWeek = suggestedWeekForRate(weekly, cdf, constraint.rate)
    return [
      {
        type: 'milestone_conflict' as const,
        severity: 'warning' as const,
        milestone: constraint.milestone,
        metric: constraint.metric,
        currentRate: constraint.rate,
        suggestedRate,
        currentWeek: constraint.week,
        suggestedWeek,
        message: `${constraint.milestone} 的${metricLabel} ${constraint.rate}% 与钟形分布偏离 ${Math.round(delta)} 个百分点，建议指标调整到 ${suggestedRate}% 或将节点周期调整到 ${suggestedWeek}`,
      },
    ]
  })
}

function distributeByConstraints(
  total: number,
  weights: number[],
  constraints: Constraint[],
  maxCumByIndex?: number[],
  warnings?: ForecastWarning[],
): number[] {
  const length = weights.length
  const values = Array.from({ length }, () => 0)
  let prevIndex = -1
  let prevCum = 0
  const pointsByIndex = new Map<number, number>()
  constraints.forEach((c) => {
      const requestedCum = c.targetCum ?? Math.round((total * c.rate) / 100)
      const cappedCum = maxCumByIndex ? Math.min(requestedCum, maxCumByIndex[c.index] ?? requestedCum) : requestedCum
      if (warnings && cappedCum < requestedCum) {
        warnings.push({
          type: 'milestone_conflict',
          severity: 'warning',
          milestone: c.milestone,
          metric: c.metric,
          currentRate: c.rate,
          suggestedRate: Math.round((cappedCum / Math.max(1, total)) * 100),
          currentWeek: c.week,
          message: `${c.milestone} 的开发解决率 ${c.rate}% 会让 Backlog 过低，已按保留合理 Backlog 的上限 ${Math.round((cappedCum / Math.max(1, total)) * 100)}% 计算。`,
        })
      }
      pointsByIndex.set(c.index, Math.max(pointsByIndex.get(c.index) ?? 0, cappedCum))
    })
  pointsByIndex.set(length - 1, total)
  const points = Array.from(pointsByIndex.entries())
    .map(([index, cum]) => ({ index, cum }))
    .sort((a, b) => a.index - b.index)

  for (const point of points) {
    const end = Math.min(length - 1, Math.max(prevIndex + 1, point.index))
    const targetCum = Math.max(prevCum, Math.min(total, point.cum))
    const amount = targetCum - prevCum
    const span = Array.from({ length: end - prevIndex }, (_, i) => prevIndex + 1 + i)
    const spanWeights = span.map((idx) => weights[idx] ?? 0)
    const totalWeight = spanWeights.reduce((sum, v) => sum + v, 0) || span.length || 1
    const raw = spanWeights.map((w) => (amount * w) / totalWeight)
    const rounded = roundToTotal(raw, amount)
    span.forEach((idx, i) => {
      values[idx] = rounded[i] ?? 0
    })
    prevIndex = end
    prevCum = targetCum
  }
  return values
}

function backlogReserveByIndex(total: number, length: number): number[] {
  if (length <= 1 || total <= 0) return Array.from({ length }, () => 0)
  const peakReserve = Math.max(1, Math.round(total * 0.1))
  return Array.from({ length }, (_, index) => {
    if (index === 0 || index === length - 1) return 0
    return Math.round(peakReserve * Math.sin((Math.PI * index) / (length - 1)))
  })
}

function enforceFixedAvailability(fixed: number[], created: number[]): number[] {
  const out = fixed.slice()
  const createdCum = cumulative(created)
  let fixedCum = 0
  let carry = 0
  for (let idx = 0; idx < out.length; idx += 1) {
    const desired = out[idx] + carry
    const available = Math.max(0, (createdCum[idx] ?? 0) - fixedCum)
    const value = Math.min(desired, available)
    out[idx] = value
    fixedCum += value
    carry = desired - value
  }
  return out
}

export function buildForecastWeeklyDistribution(
  baseWeekly: WeeklyPoint[],
  milestones: MilestoneParam[],
  totalDefects: number,
): DistributionResult {
  const total = Math.max(0, Math.round(totalDefects))
  const createdConstraints = collectConstraints(baseWeekly, milestones, 'testSubmissionRate')
  const peakIndex = inferPeakIndex(baseWeekly.length, createdConstraints)
  const createdWeights = gaussianWeights(baseWeekly.length, peakIndex)
  const created = distributeByConstraints(total, createdWeights, createdConstraints)

  const fixedConstraints = collectConstraints(baseWeekly, milestones, 'devResolutionRate')
  const capWarnings: ForecastWarning[] = []
  const createdCum = cumulative(created)
  const fixedConstraintsByCreated = fixedConstraints.map((constraint) => ({
    ...constraint,
    targetCum: Math.round(((createdCum[constraint.index] ?? 0) * constraint.rate) / 100),
  }))
  const reserve = backlogReserveByIndex(total, baseWeekly.length)
  const fixedMaxCum = createdCum.map((cum, index) => {
    if (index === baseWeekly.length - 1) return cum
    return Math.max(0, cum - (reserve[index] ?? 0))
  })
  const fixedWeights = created.map((_, index) => (created[index - 1] ?? 0) + (created[index - 2] ?? 0) * 0.8 + 1)
  const fixedRaw = distributeByConstraints(total, fixedWeights, fixedConstraintsByCreated, fixedMaxCum, capWarnings)
  const fixed = enforceFixedAvailability(fixedRaw, created)

  let cumCreated = 0
  let cumFixed = 0
  const weekly = baseWeekly.map((row, index) => {
    cumCreated += created[index] ?? 0
    cumFixed += fixed[index] ?? 0
    return {
      ...row,
      created: created[index] ?? 0,
      fixed: fixed[index] ?? 0,
      cumCreated,
      cumFixed,
      backlog: cumCreated - cumFixed,
    }
  })
  return {
    weekly,
    warnings: [
      ...buildMetricWarnings(baseWeekly, createdConstraints, createdWeights),
      ...buildMetricWarnings(baseWeekly, fixedConstraintsByCreated, fixedWeights, createdCum),
      ...capWarnings,
    ],
  }
}

function splitAliases(team: TeamItem): string[] {
  return [team.name, ...(team.note ?? '').split(/[，,;；]/)]
    .map((alias) => alias.trim())
    .filter(Boolean)
}

function resolveAggregatedTeam(rawTeam: string, teamConfigs: TeamItem[]): string {
  const raw = rawTeam.trim()
  const matched = teamConfigs.find((team) =>
    splitAliases(team).some((alias) => alias === raw || alias.endsWith(`-${raw}`) || alias.includes(raw)),
  )
  return matched?.name ?? raw
}

function teamTotals(
  histories: ProjectHistory[],
  field: 'createdTeams' | 'fixedTeams',
  teamConfigs: TeamItem[],
): Map<string, number> {
  const totals = new Map<string, number>()
  histories.forEach((history) => {
    ;(history[field] ?? []).forEach((row) => {
      const aggregatedTeam = resolveAggregatedTeam(row.team, teamConfigs)
      totals.set(aggregatedTeam, (totals.get(aggregatedTeam) ?? 0) + row.values.reduce((sum, v) => sum + v, 0))
    })
  })
  return totals
}

function splitWeeklyByRatios(
  teams: string[],
  weeklyValues: number[],
  ratios: number[],
  group: string,
): ForecastTeamRow[] {
  return teams.map((team, teamIndex) => ({
    team,
    group,
    values: weeklyValues.map((total) => {
      const raw = ratios.map((ratio) => total * ratio)
      return roundToTotal(raw, total)[teamIndex] ?? 0
    }),
  }))
}

export function allocateTeamsFromHistory(
  histories: ProjectHistory[],
  testingTeamConfigs: TeamItem[],
  devTeamConfigs: TeamItem[],
  selectedTestingTeams: string[],
  selectedDevTeams: string[],
  weekly: WeeklyPoint[],
): { createdTeams: ForecastTeamRow[]; fixedTeams: ForecastTeamRow[]; warnings: ForecastWarning[] } {
  const warnings: ForecastWarning[] = []
  const buildRatios = (
    teams: string[],
    field: 'createdTeams' | 'fixedTeams',
    configs: TeamItem[],
    label: string,
  ) => {
    if (!teams.length) return []
    const totals = teamTotals(histories, field, configs)
    const selectedTotal = teams.reduce((sum, team) => sum + (totals.get(team) ?? 0), 0)
    if (selectedTotal <= 0) {
      warnings.push({
        type: 'team_allocation',
        severity: 'warning',
        message: `当前参考项目没有可用的${label}历史占比，已在当前勾选的 ${teams.length} 个${label}内均分，请确认是否接受该分配方式。`,
      })
      return teams.map(() => 1 / teams.length)
    }
    return teams.map((team) => (totals.get(team) ?? 0) / selectedTotal)
  }

  const createdRatios = buildRatios(selectedTestingTeams, 'createdTeams', testingTeamConfigs, '测试团队')
  const fixedRatios = buildRatios(selectedDevTeams, 'fixedTeams', devTeamConfigs, '开发团队')
  return {
    createdTeams: splitWeeklyByRatios(
      selectedTestingTeams,
      weekly.map((row) => row.created),
      createdRatios,
      '测试团队',
    ),
    fixedTeams: splitWeeklyByRatios(
      selectedDevTeams,
      weekly.map((row) => row.fixed),
      fixedRatios,
      '开发团队',
    ),
    warnings,
  }
}

export function milestoneLabelsFromParams(milestones: MilestoneParam[]) {
  return milestones
    .filter((m) => m.week.trim())
    .slice()
    .sort((a, b) => compareWeekAsc(a.week, b.week))
    .map((m) => ({
      label: m.name,
      week: m.week.replace('26', ''),
      devResolutionRate: m.devResolutionRate,
      testCompletionRate: m.testCompletionRate,
      testSubmissionRate: m.testSubmissionRate,
    }))
}
