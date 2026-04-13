import {
  BarChart3,
  Database,
  FileSpreadsheet,
  Filter,
  History,
  LayoutGrid,
  List,
  Plus,
  Check,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Kpi } from '@/components/common/Kpi'
import { ExcelTemplatePreview } from '@/components/excel-preview/ExcelTemplatePreview'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { services } from '@/services'
import type { ForecastDataset } from '@/services/forecastService'
import type { ProjectHistory } from '@/types/project'
import type {
  CompareAxisMode,
  CompareCalendarWindow,
  CompareRelativeLength,
  ProjectCompareResult,
  ProjectSummary,
} from '@/services/projectService'
import { useProjectStore } from '@/stores/projectStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { addCalendarDaysIso, businessWeekBoundsIso, firstDayDateOfWeek } from '@/utils/week'

const PROJECT_PAGE_SIZE = 40
const HISTORY_COMPARE_PREFS_KEY = 'drp.history.compare.prefs.v1'
const DEFAULT_JIRA_BASE_URL = 'https://jira.tcl.com'

function isCompareAxisMode(value: unknown): value is CompareAxisMode {
  return value === 'calendar' || value === 'relative'
}

function isCompareCalendarWindow(value: unknown): value is CompareCalendarWindow {
  return value === 'full' || value === 'overlap'
}

function isCompareRelativeLength(value: unknown): value is CompareRelativeLength {
  return value === 'full' || value === 'shortest'
}

type WeekDateTickProps = {
  value?: string
  payload?: {
    value?: string
  }
  x?: number | string
  y?: number | string
  dateText?: string
}

type TeamAxisTickProps = {
  value?: string
  payload?: {
    value?: string
  }
  x?: number | string
  y?: number | string
}

function wrapTeamName(text: string, maxCharsPerLine: number) {
  const segments = text.split(/([\\s/_-]+)/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  if (segments.length <= 1) {
    for (let i = 0; i < text.length; i += maxCharsPerLine) {
      lines.push(text.slice(i, i + maxCharsPerLine))
    }
    return lines
  }

  segments.forEach((segment) => {
    const trimmed = segment.trimStart()
    if (!trimmed) return
    if (!current.length || current.length + trimmed.length <= maxCharsPerLine) {
      current += trimmed
      return
    }
    lines.push(current)
    current = trimmed
  })

  if (current.length) lines.push(current)

  return lines.flatMap((line) => {
    if (line.length <= maxCharsPerLine) return [line]
    const chunks: string[] = []
    for (let i = 0; i < line.length; i += maxCharsPerLine) {
      chunks.push(line.slice(i, i + maxCharsPerLine))
    }
    return chunks
  })
}

function WeekDateTick({ x = 0, y = 0, value, payload, dateText = '' }: WeekDateTickProps) {
  const xNum = typeof x === 'number' ? x : Number(x) || 0
  const yNum = typeof y === 'number' ? y : Number(y) || 0
  const week = value ?? payload?.value ?? ''
  const date = dateText
  return (
    <g transform={`translate(${xNum},${yNum})`}>
      <text x={0} y={0} dy={13} textAnchor="middle" className="fill-slate-600 text-[11px]">
        <tspan x={0}>{week}</tspan>
        {date ? <tspan x={0} dy={13}>{date}</tspan> : null}
      </text>
    </g>
  )
}

function TeamAxisTick({ x = 0, y = 0, value, payload }: TeamAxisTickProps) {
  const xNum = typeof x === 'number' ? x : Number(x) || 0
  const yNum = typeof y === 'number' ? y : Number(y) || 0
  const teamName = value ?? payload?.value ?? ''
  const lines = wrapTeamName(teamName, 20)
  const lineHeight = 13
  const startDy = -((lines.length - 1) * lineHeight) / 2

  return (
    <g transform={`translate(${xNum},${yNum})`}>
      <text x={0} y={0} textAnchor="end" className="fill-slate-600 text-xs">
        {lines.map((line, idx) => (
          <tspan key={`${line}-${idx}`} x={0} dy={idx === 0 ? startDy : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  )
}

export function HistoryPage() {
  const selectedProjects = useProjectStore((s) => s.selectedProjects)
  const setSelectedProjects = useProjectStore((s) => s.setSelectedProjects)
  const focusProject = useProjectStore((s) => s.focusProject)
  const setFocusProject = useProjectStore((s) => s.setFocusProject)
  const toggleSelectedProject = useProjectStore((s) => s.toggleSelectedProject)
  const jiraConnection = useSettingsStore((s) => s.jiraConnection)

  const [projects, setProjects] = React.useState<ProjectSummary[]>([])
  const [compareData, setCompareData] = React.useState<Record<string, string | number | null>[]>([])
  const [compareColors, setCompareColors] = React.useState<string[]>([])
  const [focusDataset, setFocusDataset] = React.useState<ProjectHistory | null>(null)
  const [projectFilter, setProjectFilter] = React.useState('')
  const [projectListMode, setProjectListMode] = React.useState<'cards' | 'table'>('table')
  const [projectPage, setProjectPage] = React.useState(1)
  const [compareAxisMode, setCompareAxisMode] = React.useState<CompareAxisMode>('relative')
  const [calendarWindow, setCalendarWindow] = React.useState<CompareCalendarWindow>('overlap')
  const [relativeLength, setRelativeLength] = React.useState<CompareRelativeLength>('shortest')
  const [projectCompare, setProjectCompare] = React.useState<ProjectCompareResult | null>(null)
  const [versionId, setVersionId] = React.useState('')
  const [forecastVersions, setForecastVersions] = React.useState<{ id: string; createdAt: string }[]>([])
  const [focusLineVisible, setFocusLineVisible] = React.useState({
    created: true,
    fixed: true,
    backlog: true,
  })
  const [projectCompareLineVisible, setProjectCompareLineVisible] = React.useState({
    historyCreated: true,
    jiraCreated: true,
    forecastCreated: true,
  })
  const [historyCompareLineVisible, setHistoryCompareLineVisible] = React.useState<Record<string, boolean>>({})
  const refreshProjects = React.useCallback(async () => {
    const rows = await services.projectService.listCachedProjects()
    setProjects(rows)
    return rows
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void refreshProjects().then((rows) => {
      if (cancelled) return
      setProjects(rows)
    })
    void services.projectService.getCompareColors().then((colors) => {
      if (cancelled) return
      setCompareColors(colors)
    })
    return () => {
      cancelled = true
    }
  }, [refreshProjects])

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_COMPARE_PREFS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        axisMode?: unknown
        calendarWindow?: unknown
        relativeLength?: unknown
      }
      if (isCompareAxisMode(parsed.axisMode)) setCompareAxisMode(parsed.axisMode)
      if (isCompareCalendarWindow(parsed.calendarWindow)) setCalendarWindow(parsed.calendarWindow)
      if (isCompareRelativeLength(parsed.relativeLength)) setRelativeLength(parsed.relativeLength)
    } catch {
      // ignore malformed local cache
    }
  }, [])

  React.useEffect(() => {
    try {
      localStorage.setItem(
        HISTORY_COMPARE_PREFS_KEY,
        JSON.stringify({
          axisMode: compareAxisMode,
          calendarWindow,
          relativeLength,
        }),
      )
    } catch {
      // ignore write failure
    }
  }, [compareAxisMode, calendarWindow, relativeLength])

  React.useEffect(() => {
    let cancelled = false
    void services.projectService
      .buildCreatedCompareData(selectedProjects, {
        axisMode: compareAxisMode,
        calendarWindow,
        relativeLength,
      })
      .then((rows) => {
      if (cancelled) return
      setCompareData(rows)
    })
    return () => {
      cancelled = true
    }
  }, [selectedProjects, compareAxisMode, calendarWindow, relativeLength])

  React.useEffect(() => {
    let cancelled = false
    void services.projectService
      .getProjectHistory(focusProject)
      .then((p) => {
        if (cancelled) return
        setFocusDataset(p)
      })
      .catch(() => {
        if (cancelled) return
        setFocusDataset(null)
      })
    return () => {
      cancelled = true
    }
  }, [focusProject])

  React.useEffect(() => {
    let cancelled = false
    void services.forecastService.listForecastVersions(focusProject).then((rows) => {
      if (cancelled) return
      setForecastVersions(rows.map((x) => ({ id: x.id, createdAt: x.createdAt })))
    })
    return () => {
      cancelled = true
    }
  }, [focusProject])

  React.useEffect(() => {
    let cancelled = false
    void services.projectService
      .getProjectCompare(focusProject, versionId || undefined)
      .then((res) => {
        if (cancelled) return
        setProjectCompare(res)
      })
      .catch(() => {
        if (cancelled) return
        setProjectCompare(null)
      })
    return () => {
      cancelled = true
    }
  }, [focusProject, versionId])

  const focus = focusDataset
  const safeWeekly = focus?.weekly ?? []
  const weeklyWithDate = React.useMemo(
    () =>
      safeWeekly.map((row) => ({
        ...row,
        date: row.date || firstDayDateOfWeek(row.weekLabel),
      })),
    [safeWeekly],
  )
  const historyExportDataset = React.useMemo<ForecastDataset | null>(() => {
    if (!focus) return null
    return {
      weekly: focus.weekly,
      createdTeams: (focus.createdTeams ?? []).map((row) => ({
        team: row.team,
        group: '测试团队',
        values: row.values,
      })),
      fixedTeams: (focus.fixedTeams ?? []).map((row) => ({
        team: row.team,
        group: '开发团队',
        values: row.values,
      })),
      milestones: focus.milestones ?? [],
    }
  }, [focus])
  const jiraBaseUrl = React.useMemo(() => {
    const raw = jiraConnection.baseUrl.trim()
    if (!raw) return DEFAULT_JIRA_BASE_URL
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/+$/, '')
    return `https://${raw.replace(/\/+$/, '')}`
  }, [jiraConnection.baseUrl])

  const lastWeekly = safeWeekly.at(-1)
  const backlogPeak = safeWeekly.length ? Math.max(...safeWeekly.map((x) => x.backlog)) : 0
  const testingTopTeams = (focus?.createdTeams ?? [])
    .map((t) => ({
      team: t.team,
      total: t.values.reduce((a, b) => a + b, 0),
      group: '测试',
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
  const devTopTeams = (focus?.fixedTeams ?? [])
    .map((t) => ({
      team: t.team,
      total: t.values.reduce((a, b) => a + b, 0),
      group: '开发',
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
  const topTeamDistribution = [...testingTopTeams, ...devTopTeams]
  const compareDataWithDate = React.useMemo(
    () =>
      compareData.map((row) => ({
        ...row,
        weekDate: typeof row.week === 'string' ? firstDayDateOfWeek(row.week) : '',
      })),
    [compareData],
  )
  const projectCompareWithDate = React.useMemo(
    () =>
      (projectCompare?.weekly ?? []).map((row) => ({
        ...row,
        date: firstDayDateOfWeek(row.weekLabel),
      })),
    [projectCompare],
  )
  const focusWeekDateMap = React.useMemo(() => {
    const out: Record<string, string> = {}
    weeklyWithDate.forEach((row) => {
      out[row.weekLabel] = row.date
    })
    return out
  }, [weeklyWithDate])
  const projectCompareWeekDateMap = React.useMemo(() => {
    const out: Record<string, string> = {}
    projectCompareWithDate.forEach((row) => {
      out[row.weekLabel] = row.date
    })
    return out
  }, [projectCompareWithDate])
  const historyCompareWeekDateMap = React.useMemo(() => {
    const out: Record<string, string> = {}
    compareDataWithDate.forEach((row: Record<string, string | number | null>) => {
      const week = row['week']
      const weekDate = row['weekDate']
      if (typeof week === 'string') out[week] = typeof weekDate === 'string' ? weekDate : ''
    })
    return out
  }, [compareDataWithDate])
  const focusWeekLabels = safeWeekly.map((x) => x.weekLabel)
  const teamWeeklyRows = [
    ...(focus?.createdTeams ?? []).map((t) => ({
      team: t.team,
      group: '测试提报',
      values: t.values,
      issueKeysByWeek: t.issueKeysByWeek ?? [],
      total: t.values.reduce((a, b) => a + b, 0),
    })),
    ...(focus?.fixedTeams ?? []).map((t) => ({
      team: t.team,
      group: '开发解决',
      values: t.values,
      issueKeysByWeek: t.issueKeysByWeek ?? [],
      total: t.values.reduce((a, b) => a + b, 0),
    })),
  ].sort((a, b) => b.total - a.total)
  const visibleProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectFilter.trim().toLowerCase()),
  )
  const projectTotalPages = Math.max(1, Math.ceil(visibleProjects.length / PROJECT_PAGE_SIZE))
  const safeProjectPage = Math.max(1, Math.min(projectPage, projectTotalPages))
  const paginatedProjects = visibleProjects.slice(
    (safeProjectPage - 1) * PROJECT_PAGE_SIZE,
    safeProjectPage * PROJECT_PAGE_SIZE,
  )

  React.useEffect(() => {
    setProjectPage(1)
  }, [projectFilter])

  React.useEffect(() => {
    setProjectPage((p) => Math.max(1, Math.min(p, projectTotalPages)))
  }, [projectTotalPages])

  React.useEffect(() => {
    if (!projects.length) return
    const names = new Set(projects.map((p) => p.name))
    const nextSelected = selectedProjects.filter((p) => names.has(p))
    if (nextSelected.length !== selectedProjects.length) {
      setSelectedProjects(nextSelected.length ? nextSelected : [projects[0]!.name])
    }
    if (!names.has(focusProject)) {
      setFocusProject(projects[0]!.name)
    }
  }, [projects, selectedProjects, focusProject, setSelectedProjects, setFocusProject])

  React.useEffect(() => {
    setHistoryCompareLineVisible((prev) => {
      const next: Record<string, boolean> = {}
      selectedProjects.forEach((name) => {
        next[name] = prev[name] ?? true
      })
      return next
    })
  }, [selectedProjects])
  const addCachedProject = async () => {
    const name = window.prompt('请输入项目名（唯一）')
    if (!name || !name.trim()) return
    const cycle = window.prompt('请输入周期（例如 26W2-26W27）', '26W2-26W27') ?? '26W2-26W27'
    const defectsRaw = window.prompt('请输入 Defect 总数', '0') ?? '0'
    const teamsRaw = window.prompt('请输入团队数', '1') ?? '1'
    const defects = Number.parseInt(defectsRaw, 10)
    const teams = Number.parseInt(teamsRaw, 10)
    if (!Number.isFinite(defects) || defects < 0 || !Number.isFinite(teams) || teams <= 0) {
      toast('新增失败', { description: 'Defect 和团队数必须是有效数字' })
      return
    }
    try {
      await services.projectService.upsertCachedProjects([
        {
          name: name.trim(),
          cycle: cycle.trim() || '26W2-26W27',
          defects,
          teams,
        },
      ])
      await refreshProjects()
      setFocusProject(name.trim())
      if (!selectedProjects.includes(name.trim())) {
        setSelectedProjects([...selectedProjects, name.trim()])
      }
      toast('已新增项目', { description: name.trim() })
    } catch (e: unknown) {
      toast('新增失败', { description: e instanceof Error ? e.message : '服务调用失败' })
    }
  }

  const removeCachedProject = async (projectName: string) => {
    if (projects.length <= 1) {
      toast('无法删除', { description: '至少保留 1 个历史项目' })
      return
    }
    if (!window.confirm(`确认删除项目 ${projectName} 吗？`)) return
    try {
      await services.projectService.deleteCachedProject(projectName)
      const rows = await refreshProjects()
      const names = new Set(rows.map((x) => x.name))
      const nextSelected = selectedProjects.filter((x) => names.has(x))
      if (nextSelected.length) {
        setSelectedProjects(nextSelected)
      } else if (rows[0]) {
        setSelectedProjects([rows[0].name])
      }
      if (!names.has(focusProject) && rows[0]) {
        setFocusProject(rows[0].name)
      }
      toast('已删除项目', { description: projectName })
    } catch (e: unknown) {
      toast('删除失败', { description: e instanceof Error ? e.message : '服务调用失败' })
    }
  }

  const openJiraByJql = React.useCallback(
    (jql: string) => {
      const normalized = jql.trim()
      if (!normalized) return
      const url = `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(normalized)}`
      window.open(url, '_blank', 'noopener,noreferrer')
    },
    [jiraBaseUrl],
  )

  const escapeJqlValue = React.useCallback((value: string) => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"'), [])

  const buildTeamClause = React.useCallback(
    (group: string, team: string) => {
      const testingField = '"Reporter Team-New"'
      const devField = '"Assignee Team"'
      const isTesting = group === '测试提报'
      const field = isTesting ? testingField : devField
      const unknown = isTesting ? '测试未知团队' : '软件-未知团队'
      if (team === unknown) return `${field} is EMPTY`
      return `${field} = "${escapeJqlValue(team)}"`
    },
    [escapeJqlValue],
  )

  const buildFixedTimeRangeClause = React.useCallback((start: string, end: string) => {
    const endExclusive = addCalendarDaysIso(end, 1)
    const upper = (field: string) =>
      endExclusive
        ? `(${field} >= "${start}" AND ${field} < "${endExclusive}")`
        : `(${field} >= "${start}" AND ${field} <= "${end}")`
    return [
      upper('"last time to set verified_sw"'),
      upper('"1st time to set closed"'),
      upper('"1st time to set postponed"'),
      upper('"1st time to set deleted"'),
    ].join(' OR ')
  }, [])

  const buildTeamWeekJql = React.useCallback(
    (group: string, team: string, weekLabel: string) => {
      const bounds = businessWeekBoundsIso(weekLabel)
      if (!bounds) return ''
      const projectClause = `project = "${escapeJqlValue(focusProject)}"`
      const teamClause = buildTeamClause(group, team)
      if (group === '测试提报') {
        const createdEndExclusive = addCalendarDaysIso(bounds.end, 1)
        const createdUpper = createdEndExclusive
          ? `created < "${createdEndExclusive}"`
          : `created <= "${bounds.end}"`
        return `${projectClause} AND (${teamClause}) AND created >= "${bounds.start}" AND ${createdUpper}`
      }
      return `${projectClause} AND (${teamClause}) AND (${buildFixedTimeRangeClause(bounds.start, bounds.end)})`
    },
    [buildFixedTimeRangeClause, buildTeamClause, escapeJqlValue, focusProject],
  )

  const buildTeamTotalJql = React.useCallback(
    (group: string, team: string) => {
      const projectClause = `project = "${escapeJqlValue(focusProject)}"`
      const teamClause = buildTeamClause(group, team)
      if (group === '测试提报') return `${projectClause} AND (${teamClause})`
      return `${projectClause} AND (${teamClause}) AND ("last time to set verified_sw" is not EMPTY OR "1st time to set closed" is not EMPTY OR "1st time to set postponed" is not EMPTY OR "1st time to set deleted" is not EMPTY)`
    },
    [buildTeamClause, escapeJqlValue, focusProject],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="text-2xl font-semibold">历史项目</h2>
          <p className="mt-1 text-sm text-slate-500">
            选择一个或多个项目做趋势对比；聚焦某个项目时，下方 KPI、团队分布和 Excel 预览会切到该项目。
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <Filter className="h-4 w-4 text-slate-500" />
            <input
              className="h-9 w-48 bg-transparent text-sm outline-none"
              placeholder="筛选项目名"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => void addCachedProject()}
          >
            <Plus className="mr-2 h-4 w-4" />
            新增项目
          </Button>
          <Button
            className="rounded-2xl"
            onClick={() => {
              const csvRows = [
                ['project', 'cycle', 'defects', 'teams'],
                ...projects.map((p) => [p.name, p.cycle, String(p.defects), String(p.teams)]),
              ]
              const content = csvRows.map((x) => x.join(',')).join('\n')
              const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `history-summary.${new Date().toISOString().slice(0, 10)}.csv`
              document.body.appendChild(a)
              a.click()
              a.remove()
              URL.revokeObjectURL(url)
            }}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            导出汇总
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>项目选择</CardTitle>
              <CardDescription>
                可多选做趋势对比，点击“设为当前查看项目”切换下方 KPI 与图表。项目很多时建议用「列表」并配合顶部筛选。
              </CardDescription>
            </div>
            <div className="flex shrink-0 gap-1 rounded-xl border bg-slate-50 p-1">
              <Button
                type="button"
                variant={projectListMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-lg"
                onClick={() => setProjectListMode('table')}
              >
                <List className="mr-1.5 h-4 w-4" />
                列表
              </Button>
              <Button
                type="button"
                variant={projectListMode === 'cards' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-lg"
                onClick={() => setProjectListMode('cards')}
              >
                <LayoutGrid className="mr-1.5 h-4 w-4" />
                卡片
              </Button>
            </div>
          </div>
          {projectTotalPages > 1 && (
            <p className="text-xs text-slate-500">
              共 {visibleProjects.length} 个项目，每页 {PROJECT_PAGE_SIZE} 条（第 {safeProjectPage} / {projectTotalPages}{' '}
              页）
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {projectListMode === 'table' ? (
            <div className="max-h-[min(60vh,520px)] overflow-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 text-center">对比</TableHead>
                    <TableHead>项目</TableHead>
                    <TableHead className="hidden sm:table-cell">周期</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Defect</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">团队</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProjects.map((p) => (
                    <TableRow
                      key={p.name}
                      className={focusProject === p.name ? 'bg-slate-50' : undefined}
                    >
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={selectedProjects.includes(p.name)}
                            onCheckedChange={(checked) => {
                              const on = checked === true
                              const has = selectedProjects.includes(p.name)
                              if (on !== has) toggleSelectedProject(p.name)
                            }}
                            aria-label={`加入对比：${p.name}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="font-medium text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900"
                          onClick={() => setFocusProject(p.name)}
                        >
                          {p.name}
                        </button>
                        <div className="text-xs text-slate-500 sm:hidden">{p.cycle}</div>
                      </TableCell>
                      <TableCell className="hidden text-slate-600 sm:table-cell">{p.cycle}</TableCell>
                      <TableCell className="hidden text-right md:table-cell">{p.defects}</TableCell>
                      <TableCell className="hidden text-right lg:table-cell">{p.teams}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg"
                            onClick={() => void removeCachedProject(p.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="max-h-[min(60vh,520px)] overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-3">
                {paginatedProjects.map((p) => (
                  <div
                    key={p.name}
                    className={`rounded-2xl border px-4 py-3 ${
                      selectedProjects.includes(p.name)
                        ? 'bg-slate-900 text-white'
                        : 'bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      className={`font-medium underline decoration-dotted underline-offset-2 ${
                        selectedProjects.includes(p.name) ? 'text-white' : 'text-sky-700 hover:text-sky-900'
                      }`}
                      onClick={() => setFocusProject(p.name)}
                    >
                      {p.name}
                    </button>
                    <div
                      className={`mt-1 text-xs ${
                        selectedProjects.includes(p.name) ? 'text-slate-200' : 'text-slate-500'
                      }`}
                    >
                      {p.cycle}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant={selectedProjects.includes(p.name) ? 'secondary' : 'outline'}
                        className="h-8 rounded-xl"
                        onClick={() => toggleSelectedProject(p.name)}
                      >
                        {selectedProjects.includes(p.name) ? '已选中' : '加入对比'}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 rounded-xl bg-white text-slate-900"
                        onClick={() => void removeCachedProject(p.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {projectTotalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-slate-600">
              <span>
                显示 {(safeProjectPage - 1) * PROJECT_PAGE_SIZE + 1}–
                {Math.min(safeProjectPage * PROJECT_PAGE_SIZE, visibleProjects.length)} / {visibleProjects.length}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={safeProjectPage <= 1}
                  onClick={() => setProjectPage((p) => Math.max(1, Math.min(p, projectTotalPages) - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={safeProjectPage >= projectTotalPages}
                  onClick={() =>
                    setProjectPage((p) => Math.min(projectTotalPages, Math.max(1, Math.min(p, projectTotalPages)) + 1))
                  }
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title="当前项目总 Created"
          value={lastWeekly?.cumCreated ?? 0}
          sub={focusProject}
          icon={Database}
        />
        <Kpi
          title="当前项目总 Fixed"
          value={lastWeekly?.cumFixed ?? 0}
          sub={focusProject}
          icon={Sparkles}
        />
        <Kpi
          title="当前项目最终 Backlog"
          value={lastWeekly?.backlog ?? 0}
          sub="累计创建 - 累计解决"
          icon={History}
        />
        <Kpi
          title="当前项目 Backlog 峰值"
          value={backlogPeak}
          sub={focusProject}
          icon={BarChart3}
        />
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>当前项目每周创建 / 解决趋势</CardTitle>
          <CardDescription>解决时间按 verified_sw 及 closed/postponed/deleted 字段回退统计</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[320px] flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`rounded-lg ${focusLineVisible.created ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
              onClick={() => setFocusLineVisible((s) => ({ ...s, created: !s.created }))}
            >
              {focusLineVisible.created ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
              每周创建
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`rounded-lg ${focusLineVisible.fixed ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
              onClick={() => setFocusLineVisible((s) => ({ ...s, fixed: !s.fixed }))}
            >
              {focusLineVisible.fixed ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
              每周解决
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`rounded-lg ${focusLineVisible.backlog ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
              onClick={() => setFocusLineVisible((s) => ({ ...s, backlog: !s.backlog }))}
            >
              {focusLineVisible.backlog ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
              Backlog
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyWithDate} margin={{ bottom: 14 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="weekLabel"
                  height={56}
                  tick={(props) => (
                    <WeekDateTick
                      {...props}
                      dateText={
                        focusWeekDateMap[
                          ((props as { value?: string; payload?: { value?: string } }).value ??
                            (props as { value?: string; payload?: { value?: string } }).payload?.value ??
                            '') as string
                        ] ?? ''
                      }
                    />
                  )}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                {focusLineVisible.created ? (
                  <Line type="monotone" dataKey="created" name="每周创建" stroke="#0f172a" dot={false} />
                ) : null}
                {focusLineVisible.fixed ? (
                  <Line type="monotone" dataKey="fixed" name="每周解决" stroke="#16a34a" dot={false} />
                ) : null}
                {focusLineVisible.backlog ? (
                  <Line type="monotone" dataKey="backlog" name="Backlog" stroke="#f59e0b" dot={false} />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>历史 / 预测 / JIRA 实际对比</CardTitle>
          <CardDescription>默认按当前项目对比；可选择预测版本参与比较</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-slate-500" />
            <select
              className="h-9 rounded-xl border px-3 text-sm"
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
            >
              <option value="">不指定预测版本</option>
              {forecastVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id.slice(0, 8)} - {new Date(v.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          {projectCompare ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Kpi
                  title="历史累计Created"
                  value={projectCompare.metrics.totalHistoryCreated}
                  sub={focusProject}
                  icon={History}
                />
                <Kpi
                  title="JIRA累计Created"
                  value={projectCompare.metrics.totalJiraCreated}
                  sub={focusProject}
                  icon={Database}
                />
                <Kpi
                  title="预测累计Created"
                  value={projectCompare.metrics.totalForecastCreated}
                  sub={focusProject}
                  icon={Sparkles}
                />
              </div>
              <div className="flex h-[320px] flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={`rounded-lg ${projectCompareLineVisible.historyCreated ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
                    onClick={() =>
                      setProjectCompareLineVisible((s) => ({ ...s, historyCreated: !s.historyCreated }))
                    }
                  >
                    {projectCompareLineVisible.historyCreated ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
                    历史 Created
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={`rounded-lg ${projectCompareLineVisible.jiraCreated ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
                    onClick={() =>
                      setProjectCompareLineVisible((s) => ({ ...s, jiraCreated: !s.jiraCreated }))
                    }
                  >
                    {projectCompareLineVisible.jiraCreated ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
                    JIRA Created
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={`rounded-lg ${projectCompareLineVisible.forecastCreated ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
                    onClick={() =>
                      setProjectCompareLineVisible((s) => ({ ...s, forecastCreated: !s.forecastCreated }))
                    }
                  >
                    {projectCompareLineVisible.forecastCreated ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
                    预测 Created
                  </Button>
                </div>
                <div className="min-h-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={projectCompareWithDate} margin={{ bottom: 14 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="weekLabel"
                        height={56}
                        tick={(props) => (
                          <WeekDateTick
                            {...props}
                            dateText={
                              projectCompareWeekDateMap[
                                ((props as { value?: string; payload?: { value?: string } }).value ??
                                  (props as { value?: string; payload?: { value?: string } }).payload?.value ??
                                  '') as string
                              ] ?? ''
                            }
                          />
                        )}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {projectCompareLineVisible.historyCreated ? (
                        <Line type="monotone" dataKey="historyCreated" name="历史 Created" stroke="#0f172a" dot={false} />
                      ) : null}
                      {projectCompareLineVisible.jiraCreated ? (
                        <Line type="monotone" dataKey="jiraCreated" name="JIRA Created" stroke="#0284c7" dot={false} />
                      ) : null}
                      {projectCompareLineVisible.forecastCreated ? (
                        <Line type="monotone" dataKey="forecastCreated" name="预测 Created" stroke="#16a34a" dot={false} />
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">当前项目暂无可对比数据</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>历史项目趋势对比</CardTitle>
              <CardDescription>
                多个项目同图对比，支持按「日历周」或「相对周序」对齐。相对周序更适合跨年份与长短周期不一致场景。
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-xl border px-3 text-sm"
                value={compareAxisMode}
                onChange={(e) => setCompareAxisMode(e.target.value as CompareAxisMode)}
              >
                <option value="relative">横轴：相对周序</option>
                <option value="calendar">横轴：日历周</option>
              </select>
              {compareAxisMode === 'calendar' ? (
                <select
                  className="h-9 rounded-xl border px-3 text-sm"
                  value={calendarWindow}
                  onChange={(e) => setCalendarWindow(e.target.value as CompareCalendarWindow)}
                >
                  <option value="overlap">窗口：仅重叠区间</option>
                  <option value="full">窗口：全部时间区间</option>
                </select>
              ) : (
                <select
                  className="h-9 rounded-xl border px-3 text-sm"
                  value={relativeLength}
                  onChange={(e) => setRelativeLength(e.target.value as CompareRelativeLength)}
                >
                  <option value="shortest">长度：按最短项目</option>
                  <option value="full">长度：按最长项目</option>
                </select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex h-[360px] flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {selectedProjects.map((project, idx) => (
              <Button
                key={`toggle-${project}`}
                type="button"
                size="sm"
                variant="outline"
                className={`rounded-lg ${(historyCompareLineVisible[project] ?? true) ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
                onClick={() =>
                  setHistoryCompareLineVisible((s) => ({ ...s, [project]: !(s[project] ?? true) }))
                }
              >
                {(historyCompareLineVisible[project] ?? true) ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
                <span
                  className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: compareColors[idx % Math.max(1, compareColors.length)] ?? '#0f172a' }}
                />
                {project}
              </Button>
            ))}
          </div>
          {compareData.length ? (
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={compareDataWithDate} margin={{ bottom: 14 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week"
                    height={compareAxisMode === 'calendar' ? 56 : 24}
                    tick={
                      compareAxisMode === 'calendar'
                        ? (props) => (
                            <WeekDateTick
                              {...props}
                              dateText={
                                historyCompareWeekDateMap[
                                  ((props as { value?: string; payload?: { value?: string } }).value ??
                                    (props as { value?: string; payload?: { value?: string } }).payload?.value ??
                                    '') as string
                                ] ?? ''
                              }
                            />
                          )
                        : undefined
                    }
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {selectedProjects.map((project, idx) => (
                    (historyCompareLineVisible[project] ?? true) ? (
                      <Line
                        key={project}
                        type="monotone"
                        dataKey={project}
                        stroke={compareColors[idx % Math.max(1, compareColors.length)] ?? '#0f172a'}
                        strokeWidth={2.5}
                        dot={false}
                        connectNulls={false}
                      />
                    ) : null
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {compareAxisMode === 'calendar' && calendarWindow === 'overlap'
                ? '所选项目没有重叠周期，请切换到“全部时间区间”或“相对周序”。'
                : '当前没有可展示的趋势数据。'}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{focusProject} 团队分布（测试/开发 Top3）</CardTitle>
          <CardDescription>按周累计量统计：测试看 Created Top3，开发看 Fixed Top3</CardDescription>
        </CardHeader>
        <CardContent className="h-[340px]">
          {topTeamDistribution.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTeamDistribution} layout="vertical" margin={{ top: 8, right: 24, bottom: 24, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="team" width={220} tick={<TeamAxisTick />} interval={0} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="累计量">
                  {topTeamDistribution.map((row, idx) => (
                    <Cell key={`${row.group}-${row.team}-${idx}`} fill={row.group === '测试' ? '#0284c7' : '#16a34a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              当前项目暂无足够团队数据
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{focusProject} 团队周数据</CardTitle>
          <CardDescription>按 Reporter Team-New（测试提报）与 Assignee Team（开发解决）统计</CardDescription>
        </CardHeader>
        <CardContent>
          {teamWeeklyRows.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">团队</TableHead>
                    <TableHead className="min-w-[100px]">类型</TableHead>
                    <TableHead className="min-w-[80px]">总量</TableHead>
                    {focusWeekLabels.map((week) => (
                      <TableHead key={week} className="min-w-[78px]">
                        {week}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamWeeklyRows.map((row) => (
                    <TableRow key={`${row.group}-${row.team}`}>
                      <TableCell className="font-medium">{row.team}</TableCell>
                      <TableCell>{row.group}</TableCell>
                      <TableCell>
                        {(() => {
                          const jql = buildTeamTotalJql(row.group, row.team)
                          if (row.total > 0 && jql) {
                            return (
                              <button
                                type="button"
                                className="cursor-pointer text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900"
                                title="按团队条件在 Jira 打开问题列表"
                                onClick={() => openJiraByJql(jql)}
                              >
                                {row.total}
                              </button>
                            )
                          }
                          return row.total
                        })()}
                      </TableCell>
                      {focusWeekLabels.map((_, idx) => (
                        <TableCell key={`${row.group}-${row.team}-${idx}`}>
                          {(() => {
                            const value = row.values[idx] ?? 0
                            const jql = buildTeamWeekJql(row.group, row.team, focusWeekLabels[idx] ?? '')
                            if (value > 0 && jql) {
                              return (
                                <button
                                  type="button"
                                  className="cursor-pointer text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900"
                                  title="按该周+团队条件在 Jira 打开问题列表"
                                  onClick={() => openJiraByJql(jql)}
                                >
                                  {value}
                                </button>
                              )
                            }
                            return value
                          })()}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              当前项目暂无团队周数据。请先完成 Jira 抓取，并确保字段 `Reporter Team-New`、`Assignee Team` 可读。
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Excel 预览</CardTitle>
            <CardDescription>
              当前展示项目：{focusProject}。这个预览会尽量贴近你的模板结构，最终导出按模板文件落地。
            </CardDescription>
          </div>
          <Button
            type="button"
            className="rounded-2xl"
            disabled={!historyExportDataset}
            onClick={() => {
              if (!historyExportDataset) return
              void services.exportService
                .exportForecastToExcel({
                  projectName: focusProject,
                  dataset: historyExportDataset,
                })
                .then(() => {
                  toast('已导出', { description: '已生成并下载 xlsx 文件' })
                })
                .catch((e: unknown) => {
                  toast('导出失败', {
                    description: e instanceof Error ? e.message : '请确认本地导出服务已启动',
                  })
                })
            }}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            导出 Excel
          </Button>
        </CardHeader>
        <CardContent>
          {focus ? (
            <ExcelTemplatePreview projectName={focusProject} dataset={focus} />
          ) : (
            <div className="text-sm text-slate-500">当前项目暂无历史数据可预览</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
