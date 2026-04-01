import { dates, weeks } from '@/data/mock/calendar'

export function normalizeWeekKey(input: string): string {
  const s = input.trim()
  const m = /W(\d{1,2})/i.exec(s)
  if (!m) return s
  return `W${Number(m[1])}`
}

export function parseYearWeek(input: string): { year: number; week: number } | null {
  const s = input.trim()
  const m = /(?:(\d{2}|\d{4})\s*)?W(\d{1,2})/i.exec(s)
  if (!m) return null
  const yearRaw = m[1]
  const week = Number(m[2])
  if (!Number.isFinite(week) || week <= 0) return null

  let year = 2026
  if (yearRaw) {
    const y = Number(yearRaw)
    if (Number.isFinite(y)) {
      year = yearRaw.length === 2 ? 2000 + y : y
    }
  }

  return { year, week }
}

export function weekIndex(input: string): number {
  const key = normalizeWeekKey(input)
  return weeks.indexOf(key as (typeof weeks)[number])
}

export function compareWeekAsc(a: string, b: string): number {
  const ai = weekIndex(a)
  const bi = weekIndex(b)
  if (ai === -1 && bi === -1) return a.localeCompare(b)
  if (ai === -1) return 1
  if (bi === -1) return -1
  return ai - bi
}

function isoWeekMonday(year: number, week: number): Date {
  // ISO week date: week 1 is the week with Jan 4th.
  // Monday is day 1.
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() === 0 ? 7 : jan4.getDay() // 1..7
  const week1Monday = new Date(year, 0, 4 - (jan4Day - 1))
  const d = new Date(week1Monday)
  d.setDate(week1Monday.getDate() + (week - 1) * 7)
  return d
}

function formatMD(d: Date): string {
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}/${day}`
}

export function firstDayDateOfWeek(week: string): string {
  const idx = weekIndex(week)
  if (idx >= 0) return dates[idx] ?? ''

  const parsed = parseYearWeek(week)
  if (!parsed) return ''
  // Guard: accept 1..53
  if (parsed.week < 1 || parsed.week > 53) return ''
  return formatMD(isoWeekMonday(parsed.year, parsed.week))
}

export function listYearWeekLabels(year = 2026): string[] {
  const labels: string[] = []
  for (let w = 1; w <= 53; w += 1) {
    labels.push(`${String(year).slice(-2)}W${w}`)
  }
  return labels
}

