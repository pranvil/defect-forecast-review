import { dates, weekLabels, weeks } from '@/data/mock/calendar'
import type { WeeklyPoint } from '@/types/project'

export function cumulative(arr: number[]): number[] {
  return arr.map((_, idx) => arr.slice(0, idx + 1).reduce((s, x) => s + x, 0))
}

export function makeWeekly(created: number[], fixed: number[]): WeeklyPoint[] {
  const cumCreated = cumulative(created)
  const cumFixed = cumulative(fixed)
  return weeks.map((week, i) => ({
    week,
    weekLabel: weekLabels[i] ?? week,
    date: dates[i] ?? '',
    created: created[i] ?? 0,
    fixed: fixed[i] ?? 0,
    cumCreated: cumCreated[i] ?? 0,
    cumFixed: cumFixed[i] ?? 0,
    backlog: (cumCreated[i] ?? 0) - (cumFixed[i] ?? 0),
  }))
}

export function scaleSeries(
  arr: number[],
  ratio: number,
  shifts: Record<number, number> = {},
): number[] {
  return arr.map((value, idx) =>
    Math.max(0, Math.round(value * ratio + (shifts[idx] ?? 0))),
  )
}
