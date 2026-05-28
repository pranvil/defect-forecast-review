import type { ForecastWarning } from '@/services/forecastService'
import type { ForecastTeamRow, MilestoneParam } from '@/types/forecast'
import type { ProjectHistory, WeeklyPoint } from '@/types/project'
import type { TeamItem } from '@/types/team'
import { compareWeekAsc } from '@/utils/week'

const USER_PROGRAM_TEST_TEAM = 'IUT'

const FINAL_BACKLOG_RATIO = 0.002
const EARLY_TEAM_WEEKLY_CAP = 6

type RateMetric = 'testSubmissionRate' | 'devResolutionRate'
type MilestoneTargetMode = 'currentWeek' | 'previousWeek'

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

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function isFixedHoliday(date: Date): boolean {
  const month = date.getMonth() + 1
  const day = date.getDate()
  return (month === 5 && day >= 1 && day <= 5) || (month === 10 && day >= 1 && day <= 7)
}

function workdayRatioForWeek(row: WeeklyPoint): number {
  const start = parseIsoDate(row.date)
  if (!start) return 1
  let workdays = 0
  for (let offset = 0; offset < 5; offset += 1) {
    const day = addDays(start, offset)
    if (!isFixedHoliday(day)) workdays += 1
  }
  return workdays <= 0 ? 0.02 : workdays / 5
}

function findWeekIndex(weekly: WeeklyPoint[], week: string): number {
  const normalized = week.trim()
  if (!normalized) return -1
  return weekly.findIndex((row) => row.weekLabel === normalized || row.week === normalized.replace(/^26/i, ''))
}

function previousWeekIndex(index: number): number {
  return index > 0 ? index - 1 : index
}

function targetWeekIndex(index: number, mode: MilestoneTargetMode): number {
  return mode === 'previousWeek' ? previousWeekIndex(index) : index
}

function collectConstraints(
  weekly: WeeklyPoint[],
  milestones: MilestoneParam[],
  metric: RateMetric,
  targetMode: MilestoneTargetMode,
): Constraint[] {
  return milestones
    .map((m) => ({
      milestone: m.name,
      week: m.week,
      index: targetWeekIndex(findWeekIndex(weekly, m.week), targetMode),
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

function isVersionMilestone(name: string): boolean {
  return /^v\d*$/i.test(name.trim())
}

function finalBacklogTarget(totalCreated: number): number {
  const total = Math.max(0, Math.round(totalCreated))
  return Math.max(1, Math.round(total * FINAL_BACKLOG_RATIO))
}

function createdLifecycleWeight(index: number, length: number, versionStartIndex: number): number {
  if (length <= 1) return 1
  const ratio = index / (length - 1)
  let weight: number
  if (ratio < 0.16) {
    weight = 0.72 + 0.42 * (ratio / 0.16)
  } else if (ratio < 0.34) {
    weight = 1.14 - 0.12 * ((ratio - 0.16) / 0.18)
  } else if (ratio < 0.72) {
    weight = 1.02 + (0.28 - 1.02) * ((ratio - 0.34) / 0.38)
  } else {
    weight = Math.max(0.03, 0.28 + (0.03 - 0.28) * ((ratio - 0.72) / 0.28))
  }
  if (versionStartIndex < length && index >= versionStartIndex) {
    const afterVersionRatio = (index - versionStartIndex) / Math.max(1, length - 1 - versionStartIndex)
    weight *= Math.max(0.12, 0.38 * (1 - afterVersionRatio))
  }
  return Math.max(0.01, weight)
}

function fixedLifecycleWeight(index: number, length: number): number {
  if (length <= 1) return 1
  const ratio = index / (length - 1)
  if (ratio < 0.2) return 0.55 + 0.45 * (ratio / 0.2)
  if (ratio < 0.75) return 1.08
  return 1.08 + (0.72 - 1.08) * ((ratio - 0.75) / 0.25)
}

function distributeByCumulativeTargets(
  total: number,
  length: number,
  constraints: Constraint[],
  weightForIndex: (index: number) => number,
): number[] {
  const values = Array.from({ length }, () => 0)
  if (length <= 0 || total <= 0) return values
  const points = new Map<number, number>()
  constraints.forEach((constraint) => {
    const idx = Math.max(0, Math.min(length - 1, constraint.index))
    const target = constraint.targetCum ?? Math.round((total * constraint.rate) / 100)
    points.set(idx, Math.max(points.get(idx) ?? 0, target))
  })
  points.set(length - 1, total)

  let prevIndex = -1
  let prevCum = 0
  Array.from(points.entries())
    .map(([index, cum]) => ({ index, cum }))
    .sort((a, b) => a.index - b.index)
    .forEach((point) => {
      const end = Math.min(length - 1, Math.max(prevIndex + 1, point.index))
      const targetCum = Math.max(prevCum, Math.min(total, point.cum))
      const amount = targetCum - prevCum
      const span = Array.from({ length: end - prevIndex }, (_, i) => prevIndex + 1 + i)
      if (!span.length) {
        prevIndex = end
        prevCum = targetCum
        return
      }
      const weights = span.map(weightForIndex)
      const weightTotal = weights.reduce((sum, value) => sum + value, 0) || span.length
      const rounded = roundToTotal(weights.map((weight) => (amount * weight) / weightTotal), amount)
      span.forEach((idx, offset) => {
        values[idx] = rounded[offset] ?? 0
      })
      prevIndex = end
      prevCum = targetCum
    })
  return values
}

function smoothCreatedPostPeak(values: number[], peakIndex: number): number[] {
  const out = values.slice()
  const start = Math.max(1, Math.min(out.length - 1, peakIndex + 1))
  let changed = true
  let passes = 0
  while (changed && passes < 50) {
    changed = false
    passes += 1
    for (let source = start; source < out.length; source += 1) {
      let guard = 0
      while (source > 0 && (out[source] ?? 0) > (out[source - 1] ?? 0) && guard < 10000) {
        guard += 1
        const candidates = Array.from({ length: source }, (_, idx) => idx)
          .sort((a, b) => (out[a] ?? 0) - (out[b] ?? 0) || b - a)
        const target = candidates[0]
        if (target === undefined) break
        out[source] = (out[source] ?? 0) - 1
        out[target] = (out[target] ?? 0) + 1
        changed = true
      }
    }
  }
  return out
}

function inferVersionStartIndex(weekly: WeeklyPoint[], milestones: MilestoneParam[]): number {
  const versionWeeks = milestones
    .filter((m) => isVersionMilestone(m.name) && m.week.trim())
    .map((m) => m.week.trim())
  if (!versionWeeks.length) return weekly.length
  const earliest = versionWeeks.slice().sort(compareWeekAsc)[0]!
  const idx = findWeekIndex(weekly, earliest)
  return idx >= 0 ? idx : weekly.length
}

function cumulativeSlackFrom(created: number[], fixed: number[], startIndex: number): number {
  const createdCum = cumulative(created)
  const fixedCum = cumulative(fixed)
  let slack = Number.POSITIVE_INFINITY
  for (let idx = startIndex; idx < created.length; idx += 1) {
    slack = Math.min(slack, (createdCum[idx] ?? 0) - (fixedCum[idx] ?? 0))
  }
  return Number.isFinite(slack) ? Math.max(0, slack) : 0
}

function enforceFixedMinimumConstraints(
  fixed: number[],
  created: number[],
  constraints: Constraint[],
): { fixed: number[]; warnings: ForecastWarning[] } {
  const out = fixed.slice()
  const warnings: ForecastWarning[] = []
  for (const constraint of constraints) {
    const idx = Math.max(0, Math.min(out.length - 1, constraint.index))
    let currentCum = cumulative(out)[idx] ?? 0
    const targetCum = Math.max(0, constraint.targetCum ?? 0)
    let deficit = Math.max(0, targetCum - currentCum)
    let guard = 0
    while (deficit > 0 && guard < 100000) {
      guard += 1
      const candidates = Array.from({ length: idx + 1 }, (_, i) => i)
        .filter((candidate) => cumulativeSlackFrom(created, out, candidate) > 0)
        .sort((a, b) => (out[a] ?? 0) - (out[b] ?? 0) || b - a)
      const target = candidates[0]
      if (target === undefined) break
      out[target] = (out[target] ?? 0) + 1
      deficit -= 1
      currentCum += 1
    }
    if (deficit > 0) {
      warnings.push({
        type: 'milestone_conflict',
        severity: 'warning',
        milestone: constraint.milestone,
        metric: constraint.metric,
        currentRate: constraint.rate,
        suggestedRate: Math.round((currentCum / Math.max(1, targetCum)) * constraint.rate),
        currentWeek: constraint.week,
        message: `${constraint.milestone} 的开发解决率 ${constraint.rate}% 与 created 可用量冲突，已尽量补足到 ${currentCum}/${targetCum}。`,
      })
    }
  }
  return { fixed: out, warnings }
}

function hardConstraintWarnings(
  weekly: WeeklyPoint[],
  constraints: Constraint[],
  metric: RateMetric,
  totalCreated: number,
): ForecastWarning[] {
  return constraints.flatMap((constraint) => {
    const idx = Math.max(0, Math.min(weekly.length - 1, constraint.index))
    const row = weekly[idx]
    if (!row) return []
    const actual = metric === 'testSubmissionRate' ? row.cumCreated : row.cumFixed
    const target = constraint.targetCum ?? Math.round((totalCreated * constraint.rate) / 100)
    if (actual >= target) return []
    return [{
      type: 'milestone_conflict' as const,
      severity: 'warning' as const,
      milestone: constraint.milestone,
      metric,
      currentRate: constraint.rate,
      suggestedRate: Math.round((actual / Math.max(1, target)) * constraint.rate),
      currentWeek: constraint.week,
      message: `${constraint.milestone} 的${metric === 'testSubmissionRate' ? '测试提交率' : '开发解决率'}未达硬指标：${actual}/${target}。`,
    }]
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
  options: { milestoneTargetMode?: MilestoneTargetMode } = {},
): DistributionResult {
  const total = Math.max(0, Math.round(totalDefects))
  const targetMode = options.milestoneTargetMode ?? 'currentWeek'
  const createdConstraints = collectConstraints(baseWeekly, milestones, 'testSubmissionRate', targetMode)
  const versionStartIndex = inferVersionStartIndex(baseWeekly, milestones)
  const holidayWeights = baseWeekly.map(workdayRatioForWeek)
  const created = smoothCreatedPostPeak(
    distributeByCumulativeTargets(
      total,
      baseWeekly.length,
      createdConstraints,
      (index) => createdLifecycleWeight(index, baseWeekly.length, versionStartIndex) * (holidayWeights[index] ?? 1),
    ),
    Math.round((baseWeekly.length - 1) / 3),
  )

  const fixedConstraints = collectConstraints(baseWeekly, milestones, 'devResolutionRate', targetMode)
  const createdCum = cumulative(created)
  const fixedConstraintsByCreated = fixedConstraints.map((constraint) => ({
    ...constraint,
    targetCum: Math.round(((createdCum[constraint.index] ?? 0) * constraint.rate) / 100),
  }))
  const lastFixedConstraint = fixedConstraints.at(-1)
  const finalBacklog = lastFixedConstraint && lastFixedConstraint.rate >= 100 ? 0 : finalBacklogTarget(total)
  const fixedTargetTotal = Math.max(
    Math.min(total, total - finalBacklog),
    fixedConstraintsByCreated.reduce((max, constraint) => Math.max(max, constraint.targetCum ?? 0), 0),
  )
  const fixedInitial = enforceFixedAvailability(
    distributeByCumulativeTargets(
      fixedTargetTotal,
      baseWeekly.length,
      fixedConstraintsByCreated,
      (index) => fixedLifecycleWeight(index, baseWeekly.length) * (holidayWeights[index] ?? 1),
    ),
    created,
  )
  const enforced = enforceFixedMinimumConstraints(fixedInitial, created, fixedConstraintsByCreated)
  const fixed = enforceFixedAvailability(enforced.fixed, created)

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
      ...enforced.warnings,
      ...hardConstraintWarnings(weekly, createdConstraints, 'testSubmissionRate', total),
      ...hardConstraintWarnings(weekly, fixedConstraintsByCreated, 'devResolutionRate', total),
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

function manualForecastRatio(team: string, configs: TeamItem[]): number | null {
  const ratio = configs.find((config) => config.name === team)?.forecastRatio
  if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio <= 0) return null
  return Math.min(100, ratio)
}

function splitWeeklyByRatios(
  teams: string[],
  weeklyValues: number[],
  ratios: number[],
  group: string,
): ForecastTeamRow[] {
  const ratioTotal = ratios.reduce((sum, ratio) => sum + ratio, 0)
  return teams.map((team, teamIndex) => ({
    team,
    group,
    values: weeklyValues.map((total) => {
      if (ratioTotal <= 0) return 0
      const raw = ratios.map((ratio) => total * ratio)
      return roundToTotal(raw, total)[teamIndex] ?? 0
    }),
  }))
}

function normalizedTeamName(team: string): string {
  return team.trim().toLowerCase().replace(/\s+/g, '')
}

function teamGate(team: string, index: number, length: number): { weight: number; cap: number } {
  const name = normalizedTeamName(team)
  const ratio = length <= 1 ? 1 : index / (length - 1)
  const isProtocol = team.includes('协议测试组') || name.includes('protocol')
  const isSpecial = team.includes('专项测试组') || name.includes('special')
  const isIut = name === 'iut' || name.includes('iut')
  const isGoogleXts = name.includes('googlexts')
  const isHera = name.includes('hera/usersupport/apruut') || name.includes('hera') || name.includes('apruut')

  if (isGoogleXts && ratio < 1 / 6) return { weight: 0, cap: 0 }
  if (isHera && ratio < 0.4) return { weight: 0, cap: 0 }
  if (isIut) {
    if (ratio < 0.3) return { weight: 0, cap: 0 }
    if (ratio < 0.5) return { weight: 0.08, cap: EARLY_TEAM_WEEKLY_CAP }
    return { weight: 1, cap: Number.POSITIVE_INFINITY }
  }
  if (isProtocol && ratio < 1 / 6) return { weight: 0.08, cap: EARLY_TEAM_WEEKLY_CAP }
  if (isSpecial && ratio < 1 / 3) return { weight: 0.08, cap: EARLY_TEAM_WEEKLY_CAP }
  return { weight: 1, cap: Number.POSITIVE_INFINITY }
}

function distributeWithCaps(total: number, weights: number[], caps: number[]): number[] {
  const weightTotal = weights.reduce((sum, value) => sum + value, 0)
  const values = roundToTotal(weights.map((weight) => (total * weight) / weightTotal), total)
  let overflow = 0
  values.forEach((value, index) => {
    const cap = caps[index] ?? Number.POSITIVE_INFINITY
    if (value > cap) {
      overflow += value - cap
      values[index] = cap
    }
  })
  let guard = 0
  while (overflow > 0 && guard < 100000) {
    guard += 1
    const candidates = values
      .map((value, index) => ({ index, value, cap: caps[index] ?? Number.POSITIVE_INFINITY, weight: weights[index] ?? 0 }))
      .filter((item) => item.value < item.cap && item.weight > 0)
      .sort((a, b) => a.value - b.value || b.weight - a.weight)
    const target = candidates[0]
    if (!target) break
    values[target.index] += 1
    overflow -= 1
  }
  return values
}

function distributeTeamTotal(team: string, total: number, weeklyCreated: number[]): number[] {
  const gates = weeklyCreated.map((_, index) => teamGate(team, index, weeklyCreated.length))
  const weights = weeklyCreated.map((value, index) => value * (gates[index]?.weight ?? 1))
  const caps = gates.map((gate) => gate.cap)
  if (weights.reduce((sum, value) => sum + value, 0) <= 0) {
    return Array.from({ length: weeklyCreated.length }, () => 0)
  }
  return distributeWithCaps(total, weights, caps)
}

function reconcileWeeklyTeamTotals(
  rows: ForecastTeamRow[],
  weeklyTotals: number[],
  rowTargets: number[],
  warnings: ForecastWarning[],
): ForecastTeamRow[] {
  const out = rows.map((row) => ({ ...row, values: row.values.slice() }))
  const columnTotal = (weekIndex: number) => out.reduce((sum, row) => sum + (row.values[weekIndex] ?? 0), 0)
  const findWeek = (direction: 'deficit' | 'surplus') =>
    weeklyTotals.findIndex((targetTotal, weekIndex) => {
      const diff = targetTotal - columnTotal(weekIndex)
      return direction === 'deficit' ? diff > 0 : diff < 0
    })
  let guard = 0
  while (guard < 200000) {
    guard += 1
    const deficitWeek = findWeek('deficit')
    if (deficitWeek < 0) break
    const candidates = out
      .flatMap((row, rowIndex) =>
        weeklyTotals.map((_, sourceWeek) => {
          const gate = teamGate(row.team, deficitWeek, weeklyTotals.length)
          return {
            rowIndex,
            sourceWeek,
            sourceValue: row.values[sourceWeek] ?? 0,
            targetValue: row.values[deficitWeek] ?? 0,
            sourceSurplus: columnTotal(sourceWeek) - weeklyTotals[sourceWeek]!,
            cap: gate.cap,
            weight: gate.weight,
            rowTarget: rowTargets[rowIndex] ?? 0,
          }
        }),
      )
      .filter(
        (item) =>
          item.sourceWeek !== deficitWeek &&
          item.sourceSurplus > 0 &&
          item.sourceValue > 0 &&
          item.weight > 0 &&
          item.targetValue < item.cap,
      )
      .sort((a, b) => b.sourceSurplus - a.sourceSurplus || b.sourceValue - a.sourceValue || b.rowTarget - a.rowTarget)
    const move = candidates[0]
    if (!move) break
    out[move.rowIndex]!.values[move.sourceWeek] = (out[move.rowIndex]!.values[move.sourceWeek] ?? 0) - 1
    out[move.rowIndex]!.values[deficitWeek] = (out[move.rowIndex]!.values[deficitWeek] ?? 0) + 1
  }

  weeklyTotals.forEach((targetTotal, weekIndex) => {
    const currentTotal = columnTotal(weekIndex)
    if (currentTotal !== targetTotal) {
      warnings.push({
        type: 'team_allocation',
        severity: 'warning',
        message: `第 ${weekIndex + 1} 周测试团队启动规则过严，团队提报合计 ${currentTotal} 未能对齐项目提报 ${targetTotal}。`,
      })
    }
  })
  return out
}

export function allocateTeamsFromHistory(
  histories: ProjectHistory[],
  testingTeamConfigs: TeamItem[],
  devTeamConfigs: TeamItem[],
  selectedTestingTeams: string[],
  selectedDevTeams: string[],
  weekly: WeeklyPoint[],
  hasUserPrograms = true,
): { createdTeams: ForecastTeamRow[]; fixedTeams: ForecastTeamRow[]; warnings: ForecastWarning[] } {
  const warnings: ForecastWarning[] = []
  const effectiveTestingTeams = selectedTestingTeams.filter(
    (team) => hasUserPrograms || team.trim() !== USER_PROGRAM_TEST_TEAM,
  )
  const buildRatios = (
    teams: string[],
    field: 'createdTeams' | 'fixedTeams',
    configs: TeamItem[],
  ) => {
    if (!teams.length) return []
    const totals = teamTotals(histories, field, configs)
    const manualRatios = new Map(
      teams
        .map((team) => [team, manualForecastRatio(team, configs)] as const)
        .filter((entry): entry is readonly [string, number] => entry[1] !== null),
    )
    const manualSum = Array.from(manualRatios.values()).reduce((sum, ratio) => sum + ratio, 0)
    if (manualSum > 0) {
      const remainingTeams = teams.filter((team) => !manualRatios.has(team))
      const remainingTotal = remainingTeams.reduce((sum, team) => sum + (totals.get(team) ?? 0), 0)
      const remainingShare = Math.max(0, 100 - manualSum)
      const weights = teams.map((team) => {
        const manual = manualRatios.get(team)
        if (manual !== undefined) return manual
        if (remainingTotal <= 0) return 0
        return remainingShare * ((totals.get(team) ?? 0) / remainingTotal)
      })
      const weightTotal = weights.reduce((sum, value) => sum + value, 0)
      if (weightTotal > 0) return weights.map((value) => value / weightTotal)
    }
    const selectedTotal = teams.reduce((sum, team) => sum + (totals.get(team) ?? 0), 0)
    if (selectedTotal <= 0) return teams.map(() => 0)
    return teams.map((team) => (totals.get(team) ?? 0) / selectedTotal)
  }

  const createdRatios = buildRatios(effectiveTestingTeams, 'createdTeams', testingTeamConfigs)
  const fixedRatios = buildRatios(selectedDevTeams, 'fixedTeams', devTeamConfigs)
  const createdTotals = roundToTotal(
    createdRatios.map((ratio) => weekly.reduce((sum, row) => sum + row.created, 0) * ratio),
    weekly.reduce((sum, row) => sum + row.created, 0),
  )
  const createdRows = effectiveTestingTeams.map((team, index) => ({
    team,
    group: '测试团队',
    values: distributeTeamTotal(team, createdTotals[index] ?? 0, weekly.map((row) => row.created)),
  }))
  return {
    createdTeams: reconcileWeeklyTeamTotals(createdRows, weekly.map((row) => row.created), createdTotals, warnings),
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
