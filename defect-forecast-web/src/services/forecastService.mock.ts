import { forecastWeeklyBase } from '@/data/mock/forecast'
import { delay } from '@/services/delay'
import { projectServiceMock } from '@/services/projectService.mock'
import type { ForecastResult, ForecastService } from '@/services/forecastService'
import { calculate_defects, defectInputFromParams } from '@/utils/defectCalculation'
import {
  allocateTeamsFromHistory,
  buildForecastWeeklyDistribution,
  milestoneLabelsFromParams,
} from '@/utils/forecastDistribution'
import { compareWeekAsc, firstDayDateOfWeek, parseYearWeek, weekIndex } from '@/utils/week'

function effectiveEndWeek(paramEndWeek: string, milestones: { week: string }[]): string {
  return milestones
    .map((m) => m.week.trim())
    .filter(Boolean)
    .reduce((endWeek, week) => (compareWeekAsc(week, endWeek) > 0 ? week : endWeek), paramEndWeek)
}

function effectiveStartWeek(paramStartWeek: string, milestones: { week: string }[]): string {
  const firstMilestoneWeek = milestones
    .map((m) => m.week.trim())
    .filter(Boolean)
    .sort(compareWeekAsc)[0]
  return firstMilestoneWeek || paramStartWeek
}

export const forecastServiceMock: ForecastService = {
  async getForecastResult(input): Promise<ForecastResult> {
    await delay(180)
    const historyProjects = await projectServiceMock.listCachedProjects()
    const selectedProjectNames = new Set(input.refProjects.map((row) => row.project))
    const calculation = calculate_defects(
      defectInputFromParams(input.params),
      selectedProjectNames.size
        ? historyProjects.filter((project) => selectedProjectNames.has(project.name))
        : historyProjects,
    )

    const startWeek = effectiveStartWeek(input.params.startWeek, input.milestones)
    const endWeek = effectiveEndWeek(input.params.endWeek, input.milestones)
    const startParsed = parseYearWeek(startWeek)
    const endParsed = parseYearWeek(endWeek)
    const startInMock = weekIndex(startWeek)
    const endInMock = weekIndex(endWeek)

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

    const baseWeekly = Array.from({ length: to - from + 1 }, (_, i) => {
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

    const distribution = buildForecastWeeklyDistribution(
      baseWeekly,
      input.milestones,
      calculation?.estimatedDefects ?? baseWeekly.reduce((sum, row) => sum + row.created, 0),
      { milestoneTargetMode: input.milestoneTargetMode ?? input.params.milestoneTargetMode },
    )
    const weekly = distribution.weekly
    const selectedHistoryNames = input.refProjects.map((row) => row.project)
    const historyNames = selectedHistoryNames.length ? selectedHistoryNames : historyProjects.map((p) => p.name)
    const histories = (
      await Promise.all(
        historyNames.map((name) =>
          projectServiceMock.getProjectHistory(name).catch(() => null),
        ),
      )
    ).filter((history): history is Awaited<ReturnType<typeof projectServiceMock.getProjectHistory>> =>
      history !== null,
    )
    const teamAllocation = allocateTeamsFromHistory(
      histories,
      input.testingTeamConfigs ?? [],
      input.devTeamConfigs ?? [],
      input.enabledTestingTeams,
      input.enabledDevTeams,
      weekly,
      input.params.userPrograms.length > 0,
    )
    const createdTeams = teamAllocation.createdTeams
    const fixedTeams = teamAllocation.fixedTeams
    const milestones = milestoneLabelsFromParams(input.milestones)

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
      estimatedDefects: calculation?.estimatedDefects,
      baseValue: calculation?.baseValue,
      referenceProjects: calculation?.topProjects.map(({ project, score }) => ({
        name: project.name,
        displayName: project.displayName,
        defects: project.defects,
        mm: project.mm,
        similarity: Math.round(score * 100),
      })),
      warnings: [...distribution.warnings, ...teamAllocation.warnings],
    }
  },
  async saveForecastVersion(req) {
    await delay(80)
    const row = {
      id: `mock-${crypto.randomUUID()}`,
      projectName: req.projectName,
      cycle: `${req.input.params.startWeek}-${req.input.params.endWeek}`,
      note: req.note ?? '',
      createdAt: new Date().toISOString(),
      result: req.result,
    }
    const rows = JSON.parse(localStorage.getItem('defectForecast.forecastVersions.v1') || '[]') as unknown[]
    localStorage.setItem('defectForecast.forecastVersions.v1', JSON.stringify([row, ...rows]))
    return row
  },
  async listForecastVersions(projectName) {
    await delay(60)
    const rows = JSON.parse(localStorage.getItem('defectForecast.forecastVersions.v1') || '[]') as Array<{
      id: string
      projectName: string
      cycle: string
      note: string
      createdAt: string
      result?: ForecastResult
    }>
    return projectName ? rows.filter((row) => row.projectName === projectName) : rows
  },
  async deleteForecastVersion(id) {
    await delay(40)
    const rows = JSON.parse(localStorage.getItem('defectForecast.forecastVersions.v1') || '[]') as Array<{ id: string }>
    localStorage.setItem('defectForecast.forecastVersions.v1', JSON.stringify(rows.filter((row) => row.id !== id)))
  },
}
