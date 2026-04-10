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

function parseDateInput(input: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}

function firstSundayOfYear(year: number): Date {
  const jan1 = new Date(year, 0, 1)
  const offset = (7 - jan1.getDay()) % 7
  const firstSunday = new Date(jan1)
  firstSunday.setDate(jan1.getDate() + offset)
  return firstSunday
}

function businessWeekFromDate(date: Date): { year: number; week: number } {
  const year = date.getFullYear()
  const firstSunday = firstSundayOfYear(year)
  if (date <= firstSunday) return { year, week: 1 }
  const firstMonday = new Date(firstSunday)
  firstMonday.setDate(firstSunday.getDate() + 1)
  const diffDays = Math.floor((date.getTime() - firstMonday.getTime()) / 86400000)
  return { year, week: 2 + Math.floor(diffDays / 7) }
}

function businessWeekStartDate(year: number, week: number): Date | null {
  if (week < 1) return null
  if (week === 1) return new Date(year, 0, 1)
  const firstSunday = firstSundayOfYear(year)
  const firstMonday = new Date(firstSunday)
  firstMonday.setDate(firstSunday.getDate() + 1)
  const out = new Date(firstMonday)
  out.setDate(firstMonday.getDate() + (week - 2) * 7)
  if (out.getFullYear() !== year) return null
  return out
}

function businessWeekEndDate(year: number, week: number): Date | null {
  const start = businessWeekStartDate(year, week)
  if (!start) return null
  if (week === 1) {
    const firstSunday = firstSundayOfYear(year)
    return firstSunday.getFullYear() === year ? firstSunday : new Date(year, 11, 31)
  }
  const out = new Date(start)
  out.setDate(start.getDate() + 6)
  if (out.getFullYear() !== year) return new Date(year, 11, 31)
  return out
}

export function toBusinessWeekLabel(dateInput: string): string {
  const d = parseDateInput(dateInput)
  if (!d) return ''
  const { year, week } = businessWeekFromDate(d)
  return `${String(year).slice(-2)}W${week}`
}

export function weekIndex(input: string): number {
  const key = normalizeWeekKey(input)
  return weeks.indexOf(key as (typeof weeks)[number])
}

export function compareWeekAsc(a: string, b: string): number {
  const ap = parseYearWeek(a)
  const bp = parseYearWeek(b)
  if (ap && bp) {
    if (ap.year !== bp.year) return ap.year - bp.year
    return ap.week - bp.week
  }
  const ai = weekIndex(a)
  const bi = weekIndex(b)
  if (ai !== -1 && bi !== -1) return ai - bi
  return a.localeCompare(b)
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
  const start = businessWeekStartDate(parsed.year, parsed.week)
  if (!start) return ''
  return formatMD(start)
}

function formatISODate(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function businessWeekBoundsIso(week: string): { start: string; end: string } | null {
  const parsed = parseYearWeek(week)
  if (!parsed) return null
  const start = businessWeekStartDate(parsed.year, parsed.week)
  const end = businessWeekEndDate(parsed.year, parsed.week)
  if (!start || !end) return null
  return { start: formatISODate(start), end: formatISODate(end) }
}

export function listYearWeekLabels(year = 2026): string[] {
  const labels: string[] = []
  for (let w = 1; w <= 53; w += 1) {
    labels.push(`${String(year).slice(-2)}W${w}`)
  }
  return labels
}

