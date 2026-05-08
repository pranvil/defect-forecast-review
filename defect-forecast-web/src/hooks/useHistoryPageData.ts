import * as React from 'react'
import { toast } from 'sonner'
import { fixedDevelopmentTeams, fixedTestingTeams } from '@/data/mock/teams'
import { services } from '@/services'
import type { ForecastDataset } from '@/services/forecastService'
import type {
  CompareAxisMode,
  CompareCalendarWindow,
  CompareRelativeLength,
  ProjectCompareResult,
  ProjectSummary,
} from '@/services/projectService'
import { useProjectStore } from '@/stores/projectStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { ProjectHistory } from '@/types/project'
import {
  formatProjectLabel as formatProjectDisplayLabel,
  getProjectSearchText,
  loadFavoriteProjectKeys,
  loadRecentProjectKeys,
  recordRecentProjectKey,
  toggleFavoriteProjectKey,
} from '@/utils/projectLibrary'
import { PROJECT_METADATA_COLUMNS, formatProjectMetadataCell } from '@/utils/projectMetadataColumns'
import {
  addCalendarDaysIso,
  businessWeekBoundsIso,
  firstDayDateOfWeek,
  isWeekVisibleInRange,
} from '@/utils/week'
import type { TeamItem } from '@/types/team'

const PROJECT_PAGE_SIZE = 40
const HISTORY_COMPARE_PREFS_KEY = 'drp.history.compare.prefs.v1'
const DEFAULT_JIRA_BASE_URL = 'https://jira.tcl.com'
const TESTING_OTHER_TEAM = '其他测试团队'
const DEVELOPMENT_OTHER_TEAM = '其他开发团队'
const JIRA_PROJECT_FETCH_FILTER_CLAUSE =
  'issuetype in (defect, defect_new) AND (summary !~ "MAIN2MP" AND summary !~ "MP2SMR" AND summary !~ "CloneMP")'
const SPECIAL_GOOGLE_XTS_TEAM = 'Google XTS'
const SPECIAL_PIPELINE_TEAM = '流水线'
const SPECIAL_HERA_TEAM = 'Hera/Usersupport/APRUUT'
const SPECIAL_GOOGLE_XTS_REPORTER = 'swtc_devops'
const SPECIAL_GOOGLE_XTS_COMPONENTS = ['google XTs', 'Google XTS']
const SPECIAL_PIPELINE_REPORTER_TEAM = '软件质量保障二中心-系统质量二部-质效自动化组'
const SPECIAL_HERA_REPORTERS = ['usersupport', 'devops.tms']
const SPECIAL_UNKNOWN_TESTING_REPORTERS = ['devops.tms', 'swtc_devops', 'usersupport']

function isCompareAxisMode(value: unknown): value is CompareAxisMode {
  return value === 'calendar' || value === 'relative'
}

function isCompareCalendarWindow(value: unknown): value is CompareCalendarWindow {
  return value === 'full' || value === 'overlap'
}

function isCompareRelativeLength(value: unknown): value is CompareRelativeLength {
  return value === 'full' || value === 'shortest'
}

function addOneYearIso(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!m) return ''
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return ''
  dt.setFullYear(dt.getFullYear() + 1)
  const yy = `${dt.getFullYear()}`
  const mm = `${dt.getMonth() + 1}`.padStart(2, '0')
  const dd = `${dt.getDate()}`.padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function normalizeTeamName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function splitTeamAliases(note: string): string[] {
  return note
    .split(/[，,;；\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildTeamAliasMap(teams: TeamItem[], includeDisplayName = true) {
  return teams.map((team) => {
    const aliases = [...(includeDisplayName ? [team.name] : []), ...splitTeamAliases(team.note ?? '')]
    const normalizedAliases = new Set(aliases.map(normalizeTeamName).filter(Boolean))
    return { team: team.name, aliases, normalizedAliases }
  })
}

const TESTING_TEAM_ALIAS_MAP = buildTeamAliasMap(fixedTestingTeams)
const DEVELOPMENT_TEAM_ALIAS_MAP = buildTeamAliasMap(fixedDevelopmentTeams)
const TESTING_JQL_TEAM_ALIAS_MAP = buildTeamAliasMap(fixedTestingTeams, false)
const DEVELOPMENT_JQL_TEAM_ALIAS_MAP = buildTeamAliasMap(fixedDevelopmentTeams, false)
const TESTING_KNOWN_ALIASES = TESTING_JQL_TEAM_ALIAS_MAP.flatMap((row) => row.aliases)
const DEVELOPMENT_KNOWN_ALIASES = DEVELOPMENT_JQL_TEAM_ALIAS_MAP.flatMap((row) => row.aliases)

function resolveTeamCategory(team: string, kind: 'testing' | 'development'): string {
  const normalized = normalizeTeamName(team)
  const aliasMap = kind === 'testing' ? TESTING_TEAM_ALIAS_MAP : DEVELOPMENT_TEAM_ALIAS_MAP
  const fallback = kind === 'testing' ? TESTING_OTHER_TEAM : DEVELOPMENT_OTHER_TEAM
  if (!normalized) return fallback
  const matched = aliasMap.find((row) =>
    [...row.normalizedAliases].some((alias) => normalized === alias || normalized.endsWith(alias) || alias.endsWith(normalized)),
  )
  return matched?.team ?? fallback
}

function aggregateTeamWeeklyRows(
  rows: Array<{ team: string; values: number[]; issueKeysByWeek?: string[][] }>,
  visibleWeekIndexes: number[],
  group: string,
  kind: 'testing' | 'development',
) {
  const buckets = new Map<string, { team: string; group: string; values: number[]; issueKeysByWeek: string[][]; total: number }>()
  rows.forEach((source) => {
    const team = resolveTeamCategory(source.team, kind)
    const bucket =
      buckets.get(team) ??
      {
        team,
        group,
        values: visibleWeekIndexes.map(() => 0),
        issueKeysByWeek: visibleWeekIndexes.map(() => []),
        total: 0,
      }
    visibleWeekIndexes.forEach((index, idx) => {
      const value = source.values[index] ?? 0
      bucket.values[idx] = (bucket.values[idx] ?? 0) + value
      bucket.total += value
      bucket.issueKeysByWeek[idx] = [
        ...(bucket.issueKeysByWeek[idx] ?? []),
        ...(source.issueKeysByWeek?.[index] ?? []),
      ]
    })
    buckets.set(team, bucket)
  })
  return [...buckets.values()]
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.team.localeCompare(b.team))
}

export function useHistoryPageData() {
  const selectedProjects = useProjectStore((s) => s.selectedProjects)
  const setSelectedProjects = useProjectStore((s) => s.setSelectedProjects)
  const focusProject = useProjectStore((s) => s.focusProject)
  const setFocusProject = useProjectStore((s) => s.setFocusProject)
  const toggleSelectedProject = useProjectStore((s) => s.toggleSelectedProject)
  const setProjectHubView = useProjectStore((s) => s.setProjectHubView)
  const detailTab = useProjectStore((s) => s.projectDetailTab)
  const setDetailTab = useProjectStore((s) => s.setProjectDetailTab)
  const jiraConnection = useSettingsStore((s) => s.jiraConnection)

  const [projects, setProjects] = React.useState<ProjectSummary[]>([])
  const [compareData, setCompareData] = React.useState<Record<string, string | number | null>[]>([])
  const [compareColors, setCompareColors] = React.useState<string[]>([])
  const [focusDataset, setFocusDataset] = React.useState<ProjectHistory | null>(null)
  const [projectFilter, setProjectFilter] = React.useState('')
  const [projectFilterMode, setProjectFilterMode] = React.useState<'all' | 'favorites' | 'recent'>('all')
  const [projectListMode, setProjectListMode] = React.useState<'cards' | 'table'>('table')
  const [projectPage, setProjectPage] = React.useState(1)
  const [compareAxisMode, setCompareAxisMode] = React.useState<CompareAxisMode>('relative')
  const [calendarWindow, setCalendarWindow] = React.useState<CompareCalendarWindow>('overlap')
  const [relativeLength, setRelativeLength] = React.useState<CompareRelativeLength>('shortest')
  const [projectCompare, setProjectCompare] = React.useState<ProjectCompareResult | null>(null)
  const [versionId, setVersionId] = React.useState('')
  const [forecastVersions, setForecastVersions] = React.useState<{ id: string; projectName: string; cycle: string; note: string; createdAt: string }[]>([])
  const [focusLineVisible, setFocusLineVisible] = React.useState({
    created: true,
    fixed: true,
    backlog: true,
  })
  const [projectCompareLineVisible, setProjectCompareLineVisible] = React.useState({
    historyCreated: true,
    jiraCreated: true,
    forecastCreated: true,
    historyFixed: false,
    jiraFixed: false,
    forecastFixed: false,
    backlogHistory: false,
    backlogJira: false,
    backlogForecast: false,
  })
  const [historyCompareLineVisible, setHistoryCompareLineVisible] = React.useState<Record<string, boolean>>({})
  const [favoriteProjects, setFavoriteProjects] = React.useState<string[]>(() => loadFavoriteProjectKeys())
  const [recentProjects, setRecentProjects] = React.useState<string[]>(() => loadRecentProjectKeys())
  const [analysisStartDateOverride, setAnalysisStartDateOverride] = React.useState('')
  const [analysisEndDateOverride, setAnalysisEndDateOverride] = React.useState('')
  const [isRefreshingProjectData, setIsRefreshingProjectData] = React.useState(false)
  const [historyReloadToken, setHistoryReloadToken] = React.useState(0)

  const projectLabelByKey = React.useMemo(() => {
    const map = new Map<string, string>()
    projects.forEach((p) => {
      const label = p.displayName?.trim()
      if (label) map.set(p.name, label)
    })
    return map
  }, [projects])

  const formatProjectLabel = React.useCallback(
    (key: string) => {
      const label = projectLabelByKey.get(key)
      return formatProjectDisplayLabel(key, label)
    },
    [projectLabelByKey],
  )

  const focusProjectLabel = React.useMemo(() => formatProjectLabel(focusProject), [focusProject, formatProjectLabel])

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
  }, [focusProject, historyReloadToken])

  React.useEffect(() => {
    let cancelled = false
    void services.forecastService.listForecastVersions().then((rows) => {
      if (cancelled) return
      setForecastVersions(rows.map((x) => ({ id: x.id, projectName: x.projectName, cycle: x.cycle, note: x.note, createdAt: x.createdAt })))
      setVersionId((current) => {
        if (current && rows.some((row) => row.id === current)) return current
        const byCurrentProject = rows.find((row) => row.projectName.toUpperCase() === focusProject.toUpperCase())
        return (byCurrentProject ?? rows[0])?.id ?? ''
      })
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
  const safeWeekly = React.useMemo(() => focus?.weekly ?? [], [focus])
  const defaultAnalysisStartDate = React.useMemo(() => {
    const meta = focus?.validStartDate?.trim()
    if (meta) return meta
    let minStart = ''
    safeWeekly.forEach((row) => {
      const start = businessWeekBoundsIso(row.weekLabel)?.start ?? ''
      if (!start) return
      if (!minStart || start < minStart) minStart = start
    })
    return minStart
  }, [focus?.validStartDate, safeWeekly])
  const defaultAnalysisEndDate = React.useMemo(() => {
    const meta = focus?.validEndDate?.trim()
    if (meta) return meta
    return defaultAnalysisStartDate ? addOneYearIso(defaultAnalysisStartDate) : ''
  }, [focus?.validEndDate, defaultAnalysisStartDate])
  const effectiveAnalysisStartDate = analysisStartDateOverride.trim() || defaultAnalysisStartDate
  const effectiveAnalysisEndDate =
    analysisEndDateOverride.trim() ||
    focus?.validEndDate?.trim() ||
    addOneYearIso(effectiveAnalysisStartDate)
  const visibleWeekIndexes = React.useMemo(() => {
    if (!safeWeekly.length) return []
    return safeWeekly.reduce<number[]>((acc, row, idx) => {
      if (isWeekVisibleInRange(row.weekLabel, effectiveAnalysisStartDate, effectiveAnalysisEndDate)) acc.push(idx)
      return acc
    }, [])
  }, [effectiveAnalysisEndDate, effectiveAnalysisStartDate, safeWeekly])
  const visibleWeekly = React.useMemo(
    () =>
      safeWeekly
        .map((row) => ({
          ...row,
          date: row.date || firstDayDateOfWeek(row.weekLabel),
        }))
        .filter((row) => isWeekVisibleInRange(row.weekLabel, effectiveAnalysisStartDate, effectiveAnalysisEndDate)),
    [effectiveAnalysisEndDate, effectiveAnalysisStartDate, safeWeekly],
  )
  const weeklyWithDate = React.useMemo(
    () => visibleWeekly,
    [visibleWeekly],
  )

  const historyExportDataset = React.useMemo<ForecastDataset | null>(() => {
    if (!focus || !visibleWeekly.length) return null
    const visibleWeekSet = new Set(visibleWeekly.map((row) => row.week))
    return {
      weekly: visibleWeekly,
      createdTeams: aggregateTeamWeeklyRows(
        focus.createdTeams ?? [],
        visibleWeekIndexes,
        '测试团队',
        'testing'
      ),
      fixedTeams: aggregateTeamWeeklyRows(
        focus.fixedTeams ?? [],
        visibleWeekIndexes,
        '开发团队',
        'development'
      ),
      milestones: (focus.milestones ?? []).filter((milestone) => visibleWeekSet.has(milestone.week)),
    }
  }, [focus, visibleWeekIndexes, visibleWeekly])

  const jiraBaseUrl = React.useMemo(() => {
    const raw = jiraConnection.baseUrl.trim()
    if (!raw) return DEFAULT_JIRA_BASE_URL
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/+$/, '')
    return `https://${raw.replace(/\/+$/, '')}`
  }, [jiraConnection.baseUrl])

  const lastWeekly = React.useMemo(() => {
    const tail = safeWeekly.at(-1)
    if (!tail) {
      const createdOnly = Math.max(0, Number(focus?.defects ?? 0))
      return createdOnly
        ? {
            cumCreated: createdOnly,
            cumFixed: 0,
            backlog: createdOnly,
          }
        : undefined
    }
    const createdTotal = Math.max(0, Number(focus?.defects ?? tail.cumCreated ?? 0))
    const fixedTotal = Math.max(0, Math.min(Number(tail.cumFixed ?? 0), createdTotal))
    return {
      cumCreated: createdTotal,
      cumFixed: fixedTotal,
      backlog: Math.max(0, createdTotal - fixedTotal),
    }
  }, [focus?.defects, safeWeekly])
  const backlogPeak = React.useMemo(() => {
    const peakFromSeries = safeWeekly.length ? Math.max(...safeWeekly.map((x) => x.backlog)) : 0
    const finalBacklog = lastWeekly?.backlog ?? 0
    return Math.max(peakFromSeries, finalBacklog)
  }, [lastWeekly?.backlog, safeWeekly])
  const analysisRangeSummary = React.useMemo(() => {
    const created = visibleWeekly.reduce((sum, row) => sum + (Number.isFinite(row.created) ? row.created : 0), 0)
    const fixed = visibleWeekly.reduce((sum, row) => sum + (Number.isFinite(row.fixed) ? row.fixed : 0), 0)
    const backlog = Math.max(0, created - fixed)
    const backlogPeakInRange = visibleWeekly.length ? Math.max(...visibleWeekly.map((row) => row.backlog)) : 0
    return {
      created,
      fixed,
      backlog,
      backlogPeak: backlogPeakInRange,
    }
  }, [visibleWeekly])
  const testingTopTeams = (focus?.createdTeams ?? [])
    .map((t) => ({
      team: t.team,
      total: visibleWeekIndexes.reduce((sum, index) => sum + (t.values[index] ?? 0), 0),
      group: '测试',
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
  const devTopTeams = (focus?.fixedTeams ?? [])
    .map((t) => ({
      team: t.team,
      total: visibleWeekIndexes.reduce((sum, index) => sum + (t.values[index] ?? 0), 0),
      group: '开发',
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
  const topTeamDistribution = [...testingTopTeams, ...devTopTeams]

  const compareDataWithDate = React.useMemo(
    () =>
      compareData
        .filter(
          (row) =>
            typeof row.week !== 'string' ||
            isWeekVisibleInRange(row.week, effectiveAnalysisStartDate, effectiveAnalysisEndDate),
        )
        .map((row) => ({
          ...row,
          weekDate: typeof row.week === 'string' ? firstDayDateOfWeek(row.week) : '',
        })),
    [compareData, effectiveAnalysisEndDate, effectiveAnalysisStartDate],
  )

  const projectCompareWithDate = React.useMemo(
    () =>
      (projectCompare?.weekly ?? [])
        .map((row) => ({
          ...row,
          date: firstDayDateOfWeek(row.weekLabel),
        }))
        .filter((row) => isWeekVisibleInRange(row.weekLabel, effectiveAnalysisStartDate, effectiveAnalysisEndDate)),
    [effectiveAnalysisEndDate, effectiveAnalysisStartDate, projectCompare],
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

  const focusWeekLabels = visibleWeekIndexes.map((index) => safeWeekly[index]!.weekLabel)
  const testingTeamWeeklyRows = aggregateTeamWeeklyRows(
    focus?.createdTeams ?? [],
    visibleWeekIndexes,
    '测试提报',
    'testing'
  )
  const devTeamWeeklyRows = aggregateTeamWeeklyRows(
    focus?.fixedTeams ?? [],
    visibleWeekIndexes,
    '开发解决',
    'development'
  )

  const visibleProjects = projects.filter((p) => {
    const q = projectFilter.trim().toLowerCase()
    const isFavorite = favoriteProjects.includes(p.name)
    const isRecent = recentProjects.includes(p.name)
    if (projectFilterMode === 'favorites' && !isFavorite) return false
    if (projectFilterMode === 'recent' && !isRecent) return false
    if (!q) return true
    return getProjectSearchText(p).includes(q)
  })
  const projectTotalPages = Math.max(1, Math.ceil(visibleProjects.length / PROJECT_PAGE_SIZE))
  const safeProjectPage = Math.max(1, Math.min(projectPage, projectTotalPages))
  const paginatedProjects = visibleProjects.slice(
    (safeProjectPage - 1) * PROJECT_PAGE_SIZE,
    safeProjectPage * PROJECT_PAGE_SIZE,
  )

  React.useEffect(() => {
    setProjectPage(1)
  }, [projectFilter, projectFilterMode])

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

  React.useEffect(() => {
    if (!focusProject) return
    setRecentProjects(recordRecentProjectKey(focusProject))
  }, [focusProject])

  const openProjectDetailView = React.useCallback(
    (projectName: string) => {
      const name = projectName.trim()
      if (!name) return
      setFocusProject(name)
      if (!selectedProjects.includes(name)) {
        setSelectedProjects(selectedProjects.length ? [...selectedProjects, name] : [name])
      } else if (!selectedProjects.length) {
        setSelectedProjects([name])
      }
      setRecentProjects(recordRecentProjectKey(name))
      setProjectHubView('detail')
    },
    [selectedProjects, setFocusProject, setProjectHubView, setSelectedProjects],
  )

  const toggleFavorite = React.useCallback((projectName: string) => {
    setFavoriteProjects(toggleFavoriteProjectKey(projectName))
  }, [])

  const addCachedProject = React.useCallback(async () => {
    const name = window.prompt('请输入项目名（唯一）')
    if (!name || !name.trim()) return
    const displayName = window.prompt('请输入项目名称（可选，用于展示）', '') ?? ''
    const cycle = window.prompt('请输入周期（例如 26W2-26W27）', '26W2-26W27') ?? '26W2-26W27'
    const defectsRaw = window.prompt('请输入 Defect 总数', '0') ?? '0'
    const defects = Number.parseInt(defectsRaw, 10)
    if (!Number.isFinite(defects) || defects < 0) {
      toast('新增失败', { description: 'Defect 必须是有效数字' })
      return
    }
    try {
      await services.projectService.upsertCachedProjects([
        {
          name: name.trim(),
          displayName: displayName.trim() ? displayName.trim() : undefined,
          cycle: cycle.trim() || '26W2-26W27',
          defects,
          teams: 1,
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
  }, [refreshProjects, selectedProjects, setFocusProject, setSelectedProjects])

  const removeCachedProject = React.useCallback(
    async (projectName: string) => {
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
        } else {
          setSelectedProjects([])
        }
        if (!names.has(focusProject)) {
          setFocusProject(rows[0] ? rows[0].name : '')
        }
        toast('已删除项目', { description: projectName })
      } catch (e: unknown) {
        toast('删除失败', { description: e instanceof Error ? e.message : '服务调用失败' })
      }
    },
    [focusProject, projects.length, refreshProjects, selectedProjects, setFocusProject, setSelectedProjects],
  )

  // URL 长度阈值：超出后通过后端 create-filter 绕过 414
  const JIRA_URL_MAX_LENGTH = 2000

  const openJiraByJql = React.useCallback(
    (jql: string) => {
      const normalized = jql.trim()
      if (!normalized) return
      const url = `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(normalized)}`
      if (url.length <= JIRA_URL_MAX_LENGTH) {
        window.open(url, '_blank', 'noopener,noreferrer')
        return
      }
      // JQL URL 超长，通过后端创建 Jira saved filter 绕过 414
      void services.jiraService
        .createFilter({
          jql: normalized,
          filterName: `DRP-temp-${Date.now()}`,
          baseUrl: jiraConnection.baseUrl,
          authType: jiraConnection.authType,
          username: jiraConnection.username,
          token: jiraConnection.token,
          verifySsl: jiraConnection.verifySsl,
          timeoutSec: jiraConnection.timeoutSec,
        })
        .then(({ filterUrl }) => {
          if (filterUrl) {
            window.open(filterUrl, '_blank', 'noopener,noreferrer')
          } else {
            toast('无法打开 Jira', { description: '创建 Filter 失败，请检查 Jira 连接配置' })
          }
        })
        .catch((e: unknown) => {
          toast('无法打开 Jira', { description: e instanceof Error ? e.message : '创建 Filter 时发生错误' })
        })
    },
    [jiraBaseUrl, jiraConnection],
  )

  const escapeJqlValue = React.useCallback((value: string) => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"'), [])

  const buildTeamClause = React.useCallback(
    (group: string, team: string) => {
      const testingField = '"Reporter Team-New"'
      const devField = '"Assignee Team"'
      const isTesting = group === '测试提报'
      const field = isTesting ? testingField : devField

      const isOther = isTesting ? team === TESTING_OTHER_TEAM : team === DEVELOPMENT_OTHER_TEAM
      if (isOther) {
        const knownAliases = isTesting ? TESTING_KNOWN_ALIASES : DEVELOPMENT_KNOWN_ALIASES
        const knownRealAliases = isTesting
          ? knownAliases.filter((alias) => !SPECIAL_UNKNOWN_TESTING_REPORTERS.some((reporter) => normalizeTeamName(alias) === normalizeTeamName(`测试未知团队-${reporter}`)))
          : knownAliases
        const excludeList = knownRealAliases.map(a => `"${escapeJqlValue(a)}"`).join(', ')
        if (!excludeList) return `(${field} is EMPTY OR ${field} is not EMPTY)`
        const reporterList = SPECIAL_UNKNOWN_TESTING_REPORTERS.map((reporter) => `"${escapeJqlValue(reporter)}"`).join(', ')
        const reporterClause = isTesting ? ` AND reporter not in (${reporterList})` : ''
        return `(${field} not in (${excludeList}) OR ${field} is EMPTY)${reporterClause}`
      }

      const aliasMap = isTesting ? TESTING_JQL_TEAM_ALIAS_MAP : DEVELOPMENT_JQL_TEAM_ALIAS_MAP
      const matchedCategory = aliasMap.find((row) => row.team === team)

      if (matchedCategory) {
        const componentList = SPECIAL_GOOGLE_XTS_COMPONENTS.map((component) => `"${escapeJqlValue(component)}"`).join(', ')
        const aliases = matchedCategory.aliases.filter((alias) => {
          const normalizedAlias = normalizeTeamName(alias)
          if (isTesting && team === SPECIAL_PIPELINE_TEAM) {
            return normalizedAlias === normalizeTeamName(SPECIAL_PIPELINE_REPORTER_TEAM)
          }
          if (isTesting && team === SPECIAL_HERA_TEAM) {
            return !SPECIAL_HERA_REPORTERS.some((reporter) => normalizedAlias === normalizeTeamName(`测试未知团队-${reporter}`))
          }
          return true
        })
        const includeList = aliases.map((a) => `"${escapeJqlValue(a)}"`).join(', ')
        if (!includeList) return `${field} is EMPTY AND ${field} is not EMPTY`
        const clauses = [`${field} in (${includeList})`]
        if (isTesting && team === SPECIAL_GOOGLE_XTS_TEAM) {
          clauses.push(`(reporter = "${escapeJqlValue(SPECIAL_GOOGLE_XTS_REPORTER)}" AND component in (${componentList}))`)
        }
        if (isTesting && team === SPECIAL_PIPELINE_TEAM) {
          clauses.push(`(reporter = "${escapeJqlValue(SPECIAL_GOOGLE_XTS_REPORTER)}" AND (component not in (${componentList}) OR component is EMPTY))`)
        }
        if (isTesting && team === SPECIAL_HERA_TEAM) {
          const reporterList = SPECIAL_HERA_REPORTERS.map((reporter) => `"${escapeJqlValue(reporter)}"`).join(', ')
          clauses.push(`reporter in (${reporterList})`)
        }
        return clauses.length === 1 ? clauses[0] : `(${clauses.join(' OR ')})`
      }

      const unknown = isTesting ? '测试未知团队' : '软件-未知团队'
      const unknownPrefix = `${unknown}-`
      if (team === unknown) return `${field} is EMPTY`
      if (team.startsWith(unknownPrefix)) {
        const reporter = team.slice(unknownPrefix.length).trim()
        if (reporter && reporter !== '(unknown-reporter)') {
          return `${field} is EMPTY AND reporter = "${escapeJqlValue(reporter)}"`
        }
        return `${field} is EMPTY`
      }
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
        const createdUpper = createdEndExclusive ? `created < "${createdEndExclusive}"` : `created <= "${bounds.end}"`
        return `${projectClause} AND ${JIRA_PROJECT_FETCH_FILTER_CLAUSE} AND (${teamClause}) AND created >= "${bounds.start}" AND ${createdUpper}`
      }
      return `${projectClause} AND ${JIRA_PROJECT_FETCH_FILTER_CLAUSE} AND (${teamClause}) AND (${buildFixedTimeRangeClause(bounds.start, bounds.end)})`
    },
    [buildFixedTimeRangeClause, buildTeamClause, escapeJqlValue, focusProject],
  )

  const buildTeamTotalJql = React.useCallback(
    (group: string, team: string) => {
      const projectClause = `project = "${escapeJqlValue(focusProject)}"`
      const teamClause = buildTeamClause(group, team)
      if (group === '测试提报') return `${projectClause} AND ${JIRA_PROJECT_FETCH_FILTER_CLAUSE} AND (${teamClause})`
      return `${projectClause} AND ${JIRA_PROJECT_FETCH_FILTER_CLAUSE} AND (${teamClause}) AND ("last time to set verified_sw" is not EMPTY OR "1st time to set closed" is not EMPTY OR "1st time to set postponed" is not EMPTY OR "1st time to set deleted" is not EMPTY)`
    },
    [buildTeamClause, escapeJqlValue, focusProject],
  )

  const buildJiraSearchUrl = React.useCallback(
    (jql: string) => `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(jql.trim())}`,
    [jiraBaseUrl],
  )

  const exportHistoryToExcel = React.useCallback(() => {
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
  }, [focusProject, historyExportDataset])

  const exportTeamWeeklyToExcel = React.useCallback(() => {
    if (!testingTeamWeeklyRows.length && !devTeamWeeklyRows.length) {
      toast('无可导出数据', { description: '当前项目暂无团队周数据' })
      return
    }
    const escapeHtml = (value: string) =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
    const renderSection = (
      title: string,
      rows: Array<{ team: string; group: string; values: number[]; total: number }>,
    ) => {
      if (!rows.length) return ''
      const headerCells = ['团队', '总量', ...focusWeekLabels]
        .map((col) => `<th style="border:1px solid #d1d5db;padding:6px 8px;background:#f8fafc;">${escapeHtml(col)}</th>`)
        .join('')
      const bodyRows = rows
        .map((row) => {
          const totalJql = buildTeamTotalJql(row.group, row.team)
          const totalUrl = totalJql ? buildJiraSearchUrl(totalJql) : ''
          const totalCell = row.total > 0 && totalUrl ? `<a href="${escapeHtml(totalUrl)}">${row.total}</a>` : String(row.total)
          const weekCells = focusWeekLabels
            .map((week, idx) => {
              const value = row.values[idx] ?? 0
              const jql = buildTeamWeekJql(row.group, row.team, week)
              const url = jql ? buildJiraSearchUrl(jql) : ''
              const valueCell = value > 0 && url ? `<a href="${escapeHtml(url)}">${value}</a>` : String(value)
              return `<td style="border:1px solid #d1d5db;padding:6px 8px;">${valueCell}</td>`
            })
            .join('')
          return `<tr><td style="border:1px solid #d1d5db;padding:6px 8px;">${escapeHtml(row.team)}</td><td style="border:1px solid #d1d5db;padding:6px 8px;">${totalCell}</td>${weekCells}</tr>`
        })
        .join('')
      return `<h3 style="margin:16px 0 8px;font-size:16px;">${escapeHtml(title)}</h3><table style="border-collapse:collapse;font-size:12px;">${`<thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody>`}</table>`
    }
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><h2 style="margin:0 0 12px;">${escapeHtml(focusProjectLabel)} 团队周数据</h2>${renderSection('测试团队（提报 / Created）', testingTeamWeeklyRows)}${renderSection('开发团队（解决 / Fixed）', devTeamWeeklyRows)}</body></html>`
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-weekly.${focusProject}.${new Date().toISOString().slice(0, 10)}.xls`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast('已导出', { description: '团队周数据已导出（含 Jira 超链接）' })
  }, [
    buildJiraSearchUrl,
    buildTeamTotalJql,
    buildTeamWeekJql,
    devTeamWeeklyRows,
    focusProject,
    focusProjectLabel,
    focusWeekLabels,
    testingTeamWeeklyRows,
  ])

  const exportProjectSummary = React.useCallback(() => {
    const csvRows = [
      PROJECT_METADATA_COLUMNS.map((column) => column.label),
      ...projects.map((p) =>
        PROJECT_METADATA_COLUMNS.map((column) => formatProjectMetadataCell(p, column.id).replaceAll(',', '，')),
      ),
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
  }, [projects])

  const focusProjectSummary = React.useMemo((): ProjectSummary | null => {
    const key = focusProject.trim()
    if (!key) return null
    const exact = projects.find((p) => p.name === key)
    if (exact) return exact
    const ci = projects.find((p) => p.name.toUpperCase() === key.toUpperCase())
    if (ci) return ci
    const ds = focusDataset
    if (ds && ds.name.toUpperCase() === key.toUpperCase()) {
      return {
        name: ds.name,
        displayName: ds.displayName,
        cycle: ds.cycle,
        defects: ds.defects,
        teams: ds.teams,
        similarity: ds.similarity,
      }
    }
    return null
  }, [focusProject, projects, focusDataset])

  const focusProjectIsFavorite = favoriteProjects.includes(focusProject)
  /** 项目库列表与「项目详情」分两个 HistoryPage 实例时，进详情会先 mount 且 projects 尚未拉取，不能仅用 list.length 判断 */
  const hasAnyProject = projects.length > 0 || Boolean(focusProject.trim())

  const openImportView = React.useCallback(() => setProjectHubView('import'), [setProjectHubView])
  const openLibraryView = React.useCallback(() => setProjectHubView('library'), [setProjectHubView])
  const refreshProjectDataByKey = React.useCallback(async (projectKey: string) => {
    const keyForRequest = projectKey.trim().toUpperCase()
    if (!keyForRequest) {
      toast('更新失败', { description: '请输入项目 Key' })
      return
    }
    setIsRefreshingProjectData(true)
    try {
      const res = await services.jiraService.fetchByJql({
        projectKey: keyForRequest,
        startWeek: '',
        endWeek: '',
        pullMode: 'projectStart',
        jql: '',
        startDate: '',
        endDate: '',
        mode: 'normal',
        ...jiraConnection,
      })
      await services.projectService.upsertCachedProjects([
        {
          ...focusProjectSummary,
          name: keyForRequest,
          displayName: keyForRequest === focusProject.trim().toUpperCase() ? focusProjectSummary?.displayName : undefined,
          cycle: res.cycleLabel.replace(' - ', '-'),
          defects: res.fetchedCount,
          teams: Math.max(1, Math.round(res.fetchedCount / 200)),
        },
      ])
      await refreshProjects()
      setFocusProject(keyForRequest)
      if (!selectedProjects.includes(keyForRequest)) {
        setSelectedProjects(selectedProjects.length ? [...selectedProjects, keyForRequest] : [keyForRequest])
      }
      setHistoryReloadToken((x) => x + 1)
      toast('数据更新成功', {
        description: `已更新 ${keyForRequest}，共 ${res.fetchedCount} 条 Defect`,
      })
    } catch (e: unknown) {
      toast('数据更新失败', {
        description: e instanceof Error ? e.message : '服务调用失败',
      })
    } finally {
      setIsRefreshingProjectData(false)
    }
  }, [focusProject, focusProjectSummary, jiraConnection, refreshProjects, selectedProjects, setFocusProject, setSelectedProjects])

  const refreshCurrentProjectData = React.useCallback(async () => {
    await refreshProjectDataByKey(focusProject)
  }, [focusProject, refreshProjectDataByKey])

  return {
    addCachedProject,
    analysisStartDateOverride,
    analysisEndDateOverride,
    analysisRangeSummary,
    backlogPeak,
    defaultAnalysisStartDate,
    defaultAnalysisEndDate,
    buildTeamTotalJql,
    buildTeamWeekJql,
    calendarWindow,
    compareAxisMode,
    compareColors,
    compareData,
    compareDataWithDate,
    detailTab,
    devTeamWeeklyRows,
    exportHistoryToExcel,
    exportProjectSummary,
    exportTeamWeeklyToExcel,
    favoriteProjects,
    focus,
    focusDataset,
    focusLineVisible,
    focusProject,
    focusProjectIsFavorite,
    focusProjectLabel,
    focusProjectSummary,
    focusWeekDateMap,
    focusWeekLabels,
    forecastVersions,
    formatProjectLabel,
    hasAnyProject,
    historyCompareLineVisible,
    historyCompareWeekDateMap,
    historyExportDataset,
    lastWeekly,
    openImportView,
    openJiraByJql,
    openLibraryView,
    openProjectDetailView,
    isRefreshingProjectData,
    paginatedProjects,
    projectCompare,
    projectCompareLineVisible,
    projectCompareWeekDateMap,
    projectCompareWithDate,
    projectCount: projects.length,
    projectFilter,
    projectFilterMode,
    projectListMode,
    projectPage: safeProjectPage,
    projectTotalPages,
    recentProjects,
    relativeLength,
    removeCachedProject,
    refreshProjects,
    selectedProjects,
    setAnalysisStartDateOverride,
    setAnalysisEndDateOverride,
    setCalendarWindow,
    setCompareAxisMode,
    setDetailTab,
    setFocusLineVisible,
    setHistoryCompareLineVisible,
    setProjectCompareLineVisible,
    setProjectFilter,
    setProjectFilterMode,
    setProjectListMode,
    setProjectPage,
    setRelativeLength,
    setVersionId,
    testingTeamWeeklyRows,
    toggleFavorite,
    toggleSelectedProject,
    topTeamDistribution,
    refreshCurrentProjectData,
    refreshProjectDataByKey,
    versionId,
    visibleProjects,
    weeklyWithDate,
    effectiveAnalysisStartDate,
    effectiveAnalysisEndDate,
  }
}
