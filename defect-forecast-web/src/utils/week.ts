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

/** 以周一为一周起点，返回该日期所在自然周的周一（本地日历日）。 */
export function mondayOfCalendarWeek(d: Date): Date {
  const day = d.getDay()
  const delta = day === 0 ? -6 : 1 - day
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  out.setDate(out.getDate() + delta)
  return out
}

export function formatIsoDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIsoDateLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}

function parseMdSlash(md: string, year: number): Date | null {
  const m = /^(\d{1,2})[\/\-](\d{1,2})$/.exec(md.trim())
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}

function parseYmdSlash(s: string): Date | null {
  const m = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/.exec(s.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}

function firstMondayInBusinessWeekSpan(year: number, week: number): Date | null {
  const start = businessWeekStartDate(year, week)
  const end = businessWeekEndDate(year, week)
  if (!start || !end) return null
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endAt = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cur <= endAt) {
    if (cur.getDay() === 1) {
      return new Date(cur.getFullYear(), cur.getMonth(), cur.getDate())
    }
    cur.setDate(cur.getDate() + 1)
  }
  return mondayOfCalendarWeek(start)
}

export function inferYearFromWeekHint(week: string): number {
  return parseYearWeek(week)?.year ?? 2026
}

/** 根据周次标签得到该节点对应的「周一」日期（YYYY-MM-DD），与业务周/内置周表一致。 */
export function milestoneWeekToMondayIso(week: string): string {
  const wk = week.trim()
  if (!wk) return ''
  const idx = weekIndex(wk)
  if (idx >= 0) {
    const md = dates[idx]
    const y = inferYearFromWeekHint(wk)
    const d = parseMdSlash(md, y)
    if (!d) return ''
    return formatIsoDateLocal(mondayOfCalendarWeek(d))
  }
  const parsed = parseYearWeek(wk)
  if (!parsed) return ''
  const mon = firstMondayInBusinessWeekSpan(parsed.year, parsed.week)
  if (!mon) return ''
  return formatIsoDateLocal(mon)
}

/** 由「周一」的 YYYY-MM-DD 反推周次标签（与 milestoneWeekToMondayIso 同一套周定义）。 */
export function milestoneMondayIsoToWeekLabel(iso: string): string {
  const d = parseIsoDateLocal(iso)
  if (!d) return ''
  const mon = mondayOfCalendarWeek(d)
  const { year, week } = businessWeekFromDate(mon)
  return `${String(year).slice(-2)}W${week}`
}

/**
 * 将用户输入或旧版「M/D」数据规范为周一的 YYYY-MM-DD；无法解析时返回空字符串。
 * @param raw 用户输入或历史 date 字段
 * @param weekHint 用于推断 M/D 缺省年份，并与周次保持一致
 */
export function normalizeMilestoneDateToIso(raw: string, weekHint: string): string {
  const s = raw.trim()
  if (!s) return ''
  const yHint = inferYearFromWeekHint(weekHint)
  let d: Date | null = parseIsoDateLocal(s)
  if (!d) d = parseYmdSlash(s)
  if (!d) d = parseMdSlash(s, yHint)
  if (!d) {
    const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s)
    if (m) {
      const month = Number(m[1])
      const day = Number(m[2])
      const year = Number(m[3])
      if (Number.isFinite(month) && Number.isFinite(day) && Number.isFinite(year)) {
        const t = new Date(year, month - 1, day)
        if (t.getFullYear() === year && t.getMonth() === month - 1 && t.getDate() === day) d = t
      }
    }
  }
  if (!d) return ''
  const mon = mondayOfCalendarWeek(d)
  return formatIsoDateLocal(mon)
}

/** 将节点 date 规范为带年份的 ISO 周一；若无有效 date 则按 week 推算。 */
export function ensureMilestoneDateIso(m: { date: string; week: string }): string {
  const fromRaw = normalizeMilestoneDateToIso(m.date, m.week)
  if (fromRaw) return fromRaw
  return milestoneWeekToMondayIso(m.week)
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

/** Next calendar day as YYYY-MM-DD; for JQL `field < exclusive` so the prior day is fully included. */
export function addCalendarDaysIso(ymd: string, deltaDays: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (
    d.getFullYear() !== Number(m[1]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[3])
  ) {
    return null
  }
  d.setDate(d.getDate() + deltaDays)
  return formatIsoDateLocal(d)
}

export function businessWeekBoundsIso(week: string): { start: string; end: string } | null {
  const parsed = parseYearWeek(week)
  if (!parsed) return null
  const start = businessWeekStartDate(parsed.year, parsed.week)
  const end = businessWeekEndDate(parsed.year, parsed.week)
  if (!start || !end) return null
  return { start: formatIsoDateLocal(start), end: formatIsoDateLocal(end) }
}

export function listYearWeekLabels(year = 2026): string[] {
  const labels: string[] = []
  for (let w = 1; w <= 53; w += 1) {
    labels.push(`${String(year).slice(-2)}W${w}`)
  }
  return labels
}

