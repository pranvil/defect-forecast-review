import type { ForecastWarning } from '@/services/forecastService'
import type { ForecastTeamRow, MilestoneParam } from '@/types/forecast'
import type { ProjectHistory, WeeklyPoint } from '@/types/project'
import type { TeamItem } from '@/types/team'
import { compareWeekAsc } from '@/utils/week'

const USER_PROGRAM_TEST_TEAM = 'Hera/Usersupport/APRUUT'

const FINAL_BACKLOG_RATIO = 0.002

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

function tailReserveFromActualBacklog(
  created: number[],
  fixed: number[],
  tailStartIndex: number,
  finalBacklog: number,
): number[] {
  const n = Math.max(created.length, fixed.length)
  if (n <= 0) return []
  const createdCum = cumulative(created.slice(0, n))
  const fixedCum = cumulative(fixed.slice(0, n))
  const tail = Math.max(0, Math.min(n - 1, tailStartIndex))
  const backlogAtTail = Math.max(0, (createdCum[tail] ?? 0) - (fixedCum[tail] ?? 0))
  const end = Math.max(tail + 1, n - 1)
  const span = Math.max(1, end - tail)
  const reserve = Array.from({ length: n }, (_, idx) => {
    if (idx < tail) return 0
    const t = (idx - tail) / span
    const v = Math.round(backlogAtTail + (finalBacklog - backlogAtTail) * t)
    return Math.max(finalBacklog, v)
  })
  for (let i = tail + 1; i < n; i += 1) {
    reserve[i] = Math.min(reserve[i] ?? finalBacklog, reserve[i - 1] ?? finalBacklog)
  }
  return reserve
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
    .map((x) => ({ ...x, rate: Math.min(100, Math.max(1, x.rate)) }))
    .sort((a, b) => a.index - b.index)
}

function isVersionMilestone(name: string): boolean {
  return /^v\d*$/i.test(name.trim())
}

function isConvergenceMilestone(name: string): boolean {
  return /^m5(?:-\d+)?$/i.test(name.trim()) || isVersionMilestone(name)
}

function inferTailStartIndex(weekly: WeeklyPoint[], milestones: MilestoneParam[]): number {
  const convergenceWeeks = milestones
    .filter((m) => isConvergenceMilestone(m.name) && m.week.trim())
    .map((m) => m.week.trim())
  if (!convergenceWeeks.length) return Math.max(0, weekly.length - 2)
  const earliest = convergenceWeeks.slice().sort(compareWeekAsc)[0]!
  const idx = findWeekIndex(weekly, earliest)
  return idx >= 0 ? idx : Math.max(0, weekly.length - 2)
}

function finalBacklogTarget(totalCreated: number): number {
  const total = Math.max(0, Math.round(totalCreated))
  return Math.max(1, Math.round(total * FINAL_BACKLOG_RATIO))
}

function backlogReserveByIndex(totalCreated: number, length: number, tailStartIndex: number, finalTarget: number): number[] {
  if (length <= 1 || totalCreated <= 0) return Array.from({ length }, () => 0)
  const tail = Math.max(0, Math.min(length - 1, tailStartIndex))
  const peak = Math.max(finalTarget, Math.round(totalCreated * 0.1))
  const out = Array.from({ length }, (_, idx) => {
    if (idx <= 0) return 0
    if (idx >= length - 1) return finalTarget
    if (idx <= tail) {
      const ratio = tail <= 0 ? 0 : idx / tail
      return Math.round(peak * Math.sin((Math.PI / 2) * ratio))
    }
    const span = Math.max(1, (length - 1) - tail)
    const ratio = (idx - tail) / span
    return Math.round(peak + (finalTarget - peak) * ratio)
  })
  for (let i = Math.max(1, tail + 1); i < length - 1; i += 1) {
    out[i] = Math.min(out[i] ?? 0, out[i - 1] ?? 0)
  }
  return out.map((x) => Math.max(0, x))
}

function distributeIncreasingByConstraints(
  total: number,
  length: number,
  constraints: Constraint[],
  maxCumByIndex?: number[],
  warnings?: ForecastWarning[],
): number[] {
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
    const spanLength = end - prevIndex
    if (spanLength <= 0) {
      prevIndex = end
      prevCum = targetCum
      continue
    }
    const base = Math.floor(amount / spanLength)
    const remainder = amount - base * spanLength
    for (let i = 0; i < spanLength; i += 1) {
      const idx = prevIndex + 1 + i
      values[idx] = base + (i >= spanLength - remainder ? 1 : 0)
    }
    prevIndex = end
    prevCum = targetCum
  }
  return values
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

function enforceTailBacklogNonIncreasing(fixed: number[], created: number[], tailStartIndex: number): number[] {
  const out = fixed.slice()
  let backlog = 0
  for (let idx = 0; idx < out.length; idx += 1) {
    const previousBacklog = backlog
    backlog += (created[idx] ?? 0) - (out[idx] ?? 0)
    if (idx <= tailStartIndex || backlog <= previousBacklog) continue
    const needed = backlog - previousBacklog
    let pulled = 0
    for (let j = idx + 1; j < out.length && pulled < needed; j += 1) {
      const available = out[j] ?? 0
      if (available <= 0) continue
      const take = Math.min(available, needed - pulled)
      out[j] = available - take
      out[idx] = (out[idx] ?? 0) + take
      pulled += take
    }
    backlog -= pulled
  }
  return enforceFixedAvailability(out, created)
}

function frontLoadFixed(
  fixed: number[],
  created: number[],
  reserveByIndex: number[],
  tailStartIndex: number,
): number[] {
  const out = fixed.slice()
  const start = Math.max(1, tailStartIndex + 1)
  for (let source = start; source < out.length; source += 1) {
    let movable = out[source] ?? 0
    while (movable > 0) {
      const candidate = out.slice()
      candidate[source] = (candidate[source] ?? 0) - 1
      const createdCum = cumulative(created)
      let fixedCum = 0
      let target = -1
      for (let idx = 0; idx < source; idx += 1) {
        const reserve = reserveByIndex[idx] ?? 0
        const backlogBefore = (createdCum[idx] ?? 0) - fixedCum
        if (backlogBefore <= reserve) {
          fixedCum += candidate[idx] ?? 0
          continue
        }
        if (idx < tailStartIndex) {
          fixedCum += candidate[idx] ?? 0
          continue
        }
        if (fixedCum + (candidate[idx] ?? 0) + 1 <= Math.max(0, (createdCum[idx] ?? 0) - reserve)) {
          target = idx
          break
        }
        fixedCum += candidate[idx] ?? 0
      }
      if (target < 0) break
      candidate[target] = (candidate[target] ?? 0) + 1
      const normalized = enforceFixedAvailability(candidate, created)
      if (normalized[source] !== candidate[source] || normalized[target] !== candidate[target]) break
      out[source] -= 1
      out[target] = (out[target] ?? 0) + 1
      movable -= 1
    }
  }
  return out
}

function tailBacklogIsValid(fixed: number[], created: number[], tailStartIndex: number): boolean {
  let backlog = 0
  for (let idx = 0; idx < fixed.length; idx += 1) {
    const previousBacklog = backlog
    backlog += (created[idx] ?? 0) - (fixed[idx] ?? 0)
    if (backlog < 0) return false
    if (idx > tailStartIndex && backlog > previousBacklog) return false
  }
  return true
}

function smoothTailFixedSpikes(fixed: number[], created: number[], tailStartIndex: number): number[] {
  const out = fixed.slice()
  const start = Math.max(0, tailStartIndex)
  for (let source = out.length - 1; source > start; source -= 1) {
    let guard = 0
    while (guard < 200) {
      guard += 1
      const targets = Array.from({ length: source - start }, (_, i) => start + i)
        .sort((a, b) => (out[a] ?? 0) - (out[b] ?? 0) || b - a)
      const target = targets[0]
      if (target === undefined) break
      if ((out[source] ?? 0) <= (out[target] ?? 0)) break
      const candidate = out.slice()
      candidate[source] = (candidate[source] ?? 0) - 1
      candidate[target] = (candidate[target] ?? 0) + 1
      if (!tailBacklogIsValid(candidate, created, tailStartIndex)) break
      out[source] = candidate[source]!
      out[target] = candidate[target]!
    }
  }
  return out
}

function smoothConvergenceBoundaryFixedSpike(fixed: number[], created: number[], tailStartIndex: number, window = 2): number[] {
  const out = fixed.slice()
  const source = tailStartIndex
  if (source <= 0 || source >= out.length) return out
  const start = Math.max(1, source - window + 1)
  let guard = 0
  while (guard < 400) {
    guard += 1
    if ((out[source] ?? 0) <= (out[source - 1] ?? 0) + 1) break
    const target = source - 1
    if (target < start) break
    const candidate = out.slice()
    candidate[source] = (candidate[source] ?? 0) - 1
    candidate[target] = (candidate[target] ?? 0) + 1
    const normalized = enforceFixedAvailability(candidate, created)
    if (normalized[source] !== candidate[source] || normalized[target] !== candidate[target]) break
    out[source] = normalized[source]!
    out[target] = normalized[target]!
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
  const tailStartIndex = inferTailStartIndex(baseWeekly, milestones)
  const created = distributeIncreasingByConstraints(total, baseWeekly.length, createdConstraints)

  const fixedConstraints = collectConstraints(baseWeekly, milestones, 'devResolutionRate', targetMode)
  const capWarnings: ForecastWarning[] = []
  const createdCum = cumulative(created)
  const fixedConstraintsByCreated = fixedConstraints.map((constraint) => ({
    ...constraint,
    targetCum: Math.round(((createdCum[constraint.index] ?? 0) * constraint.rate) / 100),
  }))
  const lastFixedConstraint = fixedConstraints.at(-1)
  const finalBacklog = lastFixedConstraint && lastFixedConstraint.rate >= 100 ? 0 : finalBacklogTarget(total)
  const defaultFixedTotal = Math.max(0, total - finalBacklog)
  const fixedTotal = Math.min(
    total,
    fixedConstraintsByCreated.reduce(
      (max, constraint) => Math.max(max, constraint.targetCum ?? 0),
      defaultFixedTotal,
    ),
  )
  const reserve = backlogReserveByIndex(total, baseWeekly.length, tailStartIndex, finalBacklog)
  const fixedWeights = created.map((_, index) => (created[index - 1] ?? 0) + (created[index - 2] ?? 0) * 0.8 + 1)
  tailStartIndex >= 0 && reserve.length && fixedWeights.forEach((_, index) => {
    if (index < tailStartIndex) return
    const reservePressure = 1 + Math.max(0, (reserve[tailStartIndex] ?? 0) - (reserve[index] ?? 0)) / Math.max(1, total)
    fixedWeights[index] *= reservePressure
  })
  const fixedRaw = distributeIncreasingByConstraints(fixedTotal, baseWeekly.length, fixedConstraintsByCreated, createdCum, capWarnings)
  const fixedAvail = enforceFixedAvailability(fixedRaw, created)
  const tailReserve = tailReserveFromActualBacklog(created, fixedAvail, tailStartIndex, finalBacklog)
  const fixed = smoothConvergenceBoundaryFixedSpike(
    smoothTailFixedSpikes(
      enforceTailBacklogNonIncreasing(frontLoadFixed(fixedAvail, created, tailReserve, tailStartIndex), created, tailStartIndex),
    created,
    tailStartIndex,
    ),
    created,
    tailStartIndex,
    2,
  )

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
    label: string,
  ) => {
    if (!teams.length) return []
    const totals = teamTotals(histories, field, configs)
    const manualRatios = new Map(
      teams
        .map((team) => [team, manualForecastRatio(team, configs)] as const)
        .filter((entry): entry is readonly [string, number] => entry[1] !== null),
    )
    const missingTeams = teams.filter((team) => (totals.get(team) ?? 0) === 0 && !manualRatios.has(team))
    if (missingTeams.length > 0) {
      throw new Error(`勾选的${label} "${missingTeams.join(', ')}" 在历史参考项目中没有占比数据，请手动输入预估占比后再进行预测。`)
    }
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
    return teams.map((team) => (totals.get(team) ?? 0) / selectedTotal)
  }

  const createdRatios = buildRatios(effectiveTestingTeams, 'createdTeams', testingTeamConfigs, '测试团队')
  const fixedRatios = buildRatios(selectedDevTeams, 'fixedTeams', devTeamConfigs, '开发团队')
  return {
    createdTeams: splitWeeklyByRatios(
      effectiveTestingTeams,
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
