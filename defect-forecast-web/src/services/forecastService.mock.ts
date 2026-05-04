import { forecastCreatedTeams, forecastFixedTeams, forecastWeeklyBase } from '@/data/mock/forecast'
import { delay } from '@/services/delay'
import type { ForecastResult, ForecastService } from '@/services/forecastService'
import { calculate_defects } from '@/utils/defectCalculation'
import { compareWeekAsc, firstDayDateOfWeek, parseYearWeek, weekIndex } from '@/utils/week'

export const forecastServiceMock: ForecastService = {
  async getForecastResult(input): Promise<ForecastResult> {
    await delay(180)
    calculate_defects({
      Project_category: input.params.projectCategory,
      Operators: input.params.operators,
      Chipset_Status: input.params.chipsetStatus,
      User_Programs: input.params.userPrograms,
      Support_SIM: input.params.supportSim,
      MM: input.params.mm,
      FR_Quantity: input.params.frQuantity,
    })

    const startParsed = parseYearWeek(input.params.startWeek)
    const endParsed = parseYearWeek(input.params.endWeek)
    const startInMock = weekIndex(input.params.startWeek)
    const endInMock = weekIndex(input.params.endWeek)

    const startWeekNum = startParsed?.week ?? (startInMock >= 0 ? startInMock + 2 : 2)
    const endWeekNum = endParsed?.week ?? (endInMock >= 0 ? endInMock + 2 : 27)

    const from = Math.min(startWeekNum, endWeekNum)
    const to = Math.max(startWeekNum, endWeekNum)

    const createdByWeek = new Map<number, number>()
    const fixedByWeek = new Map<number, number>()
    for (const p of forecastWeeklyBase) {
      const w = parseYearWeek(p.weekLabel)?.week
      if (!w) continue
      createdByWeek.set(w, p.created)
      fixedByWeek.set(w, p.fixed)
    }

    const weekly = Array.from({ length: to - from + 1 }, (_, i) => {
      const weekNum = from + i
      const created = createdByWeek.get(weekNum) ?? 0
      const fixed = fixedByWeek.get(weekNum) ?? 0
      const weekLabel = `26W${weekNum}`
      return {
        week: `W${weekNum}`,
        weekLabel,
        date: firstDayDateOfWeek(weekLabel),
        created,
        fixed,
        cumCreated: 0,
        cumFixed: 0,
        backlog: 0,
      }
    }).reduce<{ out: typeof forecastWeeklyBase; cumCreated: number; cumFixed: number }>(
      (acc, p) => {
        const nextCumCreated = acc.cumCreated + p.created
        const nextCumFixed = acc.cumFixed + p.fixed
        return {
          out: acc.out.concat({
            ...p,
            cumCreated: nextCumCreated,
            cumFixed: nextCumFixed,
            backlog: nextCumCreated - nextCumFixed,
          }),
          cumCreated: nextCumCreated,
          cumFixed: nextCumFixed,
        }
      },
      { out: [], cumCreated: 0, cumFixed: 0 },
    ).out

    const sliceStart = Math.max(0, from - 2)
    const sliceEnd = Math.min(forecastWeeklyBase.length - 1, to - 2)
    const len = weekly.length
    const zeros = Array.from({ length: len }, () => 0)

    const createdByName = new Map(forecastCreatedTeams.map((r) => [r.team, r]))
    const fixedByName = new Map(forecastFixedTeams.map((r) => [r.team, r]))

    const createdTeams = input.enabledTestingTeams.map((team) => {
      const row = createdByName.get(team)
      const slicedRaw = row?.values.slice(sliceStart, sliceEnd + 1)
      const values = slicedRaw ? slicedRaw.concat(zeros).slice(0, len) : zeros
      return { team, group: '测试团队', values }
    })

    const fixedTeams = input.enabledDevTeams.map((team) => {
      const row = fixedByName.get(team)
      const slicedRaw = row?.values.slice(sliceStart, sliceEnd + 1)
      const values = slicedRaw ? slicedRaw.concat(zeros).slice(0, len) : zeros
      return { team, group: '开发团队', values }
    })

    const milestones = input.milestones
      .slice()
      .map((m) => ({ label: m.name, week: m.week.replace('26', '') }))
      .sort((a, b) => compareWeekAsc(a.week, b.week))

    const teamSummary = [
      {
        group: '测试团队',
        created: createdTeams.flatMap((x) => x.values).reduce((s, x) => s + x, 0),
        fixed: fixedTeams
          .filter((x) => x.group === '测试团队')
          .flatMap((x) => x.values)
          .reduce((s, x) => s + x, 0),
      },
      {
        group: '开发团队',
        created: createdTeams
          .filter((x) => x.group === '开发团队')
          .flatMap((x) => x.values)
          .reduce((s, x) => s + x, 0),
        fixed: fixedTeams
          .filter((x) => x.group === '开发团队')
          .flatMap((x) => x.values)
          .reduce((s, x) => s + x, 0),
      },
    ]

    return {
      dataset: {
        weekly,
        createdTeams,
        fixedTeams,
        milestones,
      },
      teamSummary,
    }
  },
  async saveForecastVersion(req) {
    await delay(80)
    return {
      id: `mock-${crypto.randomUUID()}`,
      projectName: req.projectName,
      cycle: `${req.input.params.startWeek}-${req.input.params.endWeek}`,
      note: req.note ?? '',
      createdAt: new Date().toISOString(),
    }
  },
  async listForecastVersions(projectName) {
    await delay(60)
    if (!projectName) return []
    return [
      {
        id: `mock-${projectName}`,
        projectName,
        cycle: '26W2-26W27',
        note: 'mock version',
        createdAt: new Date().toISOString(),
      },
    ]
  },
  async deleteForecastVersion() {
    await delay(40)
  },
}
