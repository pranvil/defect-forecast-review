import * as React from 'react'
import { toast } from 'sonner'
import { BugBoardFetchCard } from '@/components/bug-board/BugBoardFetchCard'
import { BugBoardProjectViewCard } from '@/components/bug-board/BugBoardProjectViewCard'
import { services } from '@/services'
import { useProjectStore } from '@/stores/projectStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { BugDistTaskStatus } from '@/services/bugDistService'
import type { ProjectSummary } from '@/services/projectService'
import { formatProjectLabel } from '@/utils/projectLibrary'
import type { FieldMapping } from '@/types/settings'

const DEFAULT_PRIMARY = 'MNTNPOM'
const BUG_BOARD_CACHE_KEY = 'drp.bugBoard.cachedProjects.v1'
const BUG_BOARD_RESULT_CACHE_KEY = 'drp.bugBoard.results.v1'
const BUG_BOARD_PROJECT_NAMES_KEY = 'drp.bugBoard.projectNames.v1'
const BUG_BOARD_MIX_MAP_KEY = 'drp.bugBoard.mixMap.v1'
const BugBoardDistributionSection = React.lazy(async () => {
  const mod = await import('@/components/bug-board/BugBoardDistributionSection')
  return { default: mod.BugBoardDistributionSection }
})

function loadCachedProjects(): string[] {
  try {
    const raw = localStorage.getItem(BUG_BOARD_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x) => (typeof x === 'string' ? x.trim().toUpperCase() : ''))
      .filter(Boolean)
      .slice(0, 50)
  } catch {
    return []
  }
}

function persistCachedProjects(keys: string[]) {
  try {
    localStorage.setItem(BUG_BOARD_CACHE_KEY, JSON.stringify(keys))
  } catch {
    // ignore
  }
}

function loadProjectNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BUG_BOARD_PROJECT_NAMES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const obj = parsed as Record<string, unknown>
    const out: Record<string, string> = {}
    Object.entries(obj).forEach(([k, v]) => {
      if (typeof k === 'string' && typeof v === 'string' && k.trim() && v.trim()) {
        out[k.trim().toUpperCase()] = v.trim()
      }
    })
    return out
  } catch {
    return {}
  }
}

function persistProjectNames(map: Record<string, string>) {
  try {
    localStorage.setItem(BUG_BOARD_PROJECT_NAMES_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function loadMixMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(BUG_BOARD_MIX_MAP_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const obj = parsed as Record<string, unknown>
    const out: Record<string, string[]> = {}
    Object.entries(obj).forEach(([k, v]) => {
      if (!k.trim()) return
      if (!Array.isArray(v)) return
      const keys = v
        .map((x) => (typeof x === 'string' ? x.trim().toUpperCase() : ''))
        .filter(Boolean)
        .filter((x, idx, arr) => arr.indexOf(x) === idx)
      if (keys.length) out[k.trim().toUpperCase()] = keys
    })
    return out
  } catch {
    return {}
  }
}

function persistMixMap(map: Record<string, string[]>) {
  try {
    localStorage.setItem(BUG_BOARD_MIX_MAP_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

type BugBoardResultCacheV1 = {
  version: 1
  updatedAt: string
  results: Record<string, unknown>
}

type BugBoardResultCacheV2 = {
  version: 2
  updatedAt: string
  results: Record<string, { taskId: string; result: unknown }>
}

function resultCacheKey(primary: string, compare: string, startDate = '', endDate = '') {
  return `${primary.trim().toUpperCase()}::${compare.trim().toUpperCase()}::${startDate.trim()}::${endDate.trim()}`
}

function resolvedPrimaryIssueCount(r: NonNullable<BugDistTaskStatus['result']>): number {
  const n = r.primaryIssueCount
  if (typeof n === 'number' && n > 0) return n
  const rows = r.module?.rows ?? []
  return rows.reduce((s, x) => s + (typeof x.primary === 'number' ? x.primary : 0), 0)
}

function resolvedCompareIssueCount(r: NonNullable<BugDistTaskStatus['result']>): number {
  if (!(r.compareProjectKey ?? '').trim()) return 0
  const n = r.compareIssueCount
  if (typeof n === 'number' && n > 0) return n
  const rows = r.module?.rows ?? []
  return rows.reduce((s, x) => s + (typeof x.compare === 'number' ? x.compare : 0), 0)
}

function loadResultFromCache(primary: string, compare: string, startDate = '', endDate = '') {
  try {
    const raw = localStorage.getItem(BUG_BOARD_RESULT_CACHE_KEY)
    if (!raw) return null
    const key = resultCacheKey(primary, compare, startDate, endDate)
    const parsed = JSON.parse(raw) as BugBoardResultCacheV1 | BugBoardResultCacheV2
    if (!parsed || typeof parsed !== 'object') return null

    if ((parsed as BugBoardResultCacheV2).version === 2) {
      const v2 = parsed as BugBoardResultCacheV2
      const entry = v2.results?.[key]
      if (!entry || typeof entry !== 'object') return null
      const maybeResult = entry.result as BugDistTaskStatus['result']
      if (!maybeResult?.primaryProjectKey) return null
      return { taskId: String(entry.taskId || ''), result: maybeResult }
    }

    if ((parsed as BugBoardResultCacheV1).version === 1) {
      const v1 = parsed as BugBoardResultCacheV1
      const value = v1.results?.[key]
      if (!value || typeof value !== 'object') return null
      const maybeResult = value as BugDistTaskStatus['result']
      if (!maybeResult?.primaryProjectKey) return null
      return { taskId: '', result: maybeResult }
    }

    return null
  } catch {
    return null
  }
}

function saveResultToCache(taskId: string, result: NonNullable<BugDistTaskStatus['result']>, startDate = '', endDate = '') {
  try {
    const raw = localStorage.getItem(BUG_BOARD_RESULT_CACHE_KEY)
    const parsed = raw ? (JSON.parse(raw) as BugBoardResultCacheV1 | BugBoardResultCacheV2) : null
    const existingResults: BugBoardResultCacheV2['results'] = {}

    // migrate v1 -> v2 when needed
    if (parsed && typeof parsed === 'object') {
      if ((parsed as BugBoardResultCacheV2).version === 2) {
        Object.assign(existingResults, (parsed as BugBoardResultCacheV2).results ?? {})
      } else if ((parsed as BugBoardResultCacheV1).version === 1) {
        const v1 = parsed as BugBoardResultCacheV1
        Object.entries(v1.results ?? {}).forEach(([k, v]) => {
          existingResults[k] = { taskId: '', result: v }
        })
      }
    }

    const base: BugBoardResultCacheV2 = {
      version: 2,
      updatedAt: new Date().toISOString(),
      results: existingResults,
    }
    const key = resultCacheKey(result.primaryProjectKey, result.compareProjectKey ?? '', startDate, endDate)
    const nextResults: BugBoardResultCacheV2['results'] = {
      ...base.results,
      [key]: { taskId: taskId || '', result },
    }
    // simple cap to avoid unlimited growth
    const keys = Object.keys(nextResults)
    if (keys.length > 80) {
      keys.slice(0, keys.length - 80).forEach((k) => {
        delete (nextResults as Record<string, unknown>)[k]
      })
    }
    const next: BugBoardResultCacheV2 = { version: 2, updatedAt: new Date().toISOString(), results: nextResults }
    localStorage.setItem(BUG_BOARD_RESULT_CACHE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

function formatPercent(done: number, total: number) {
  if (!total) return 0
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)))
}

function downloadUrl(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function parseProjectKeys(raw: string): string[] {
  return raw
    .split(/[\s,;]+/g)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean)
    .filter((x, idx, arr) => arr.indexOf(x) === idx)
    .slice(0, 30)
}

function aggregateCountRows(
  lists: Array<Array<{ name: string; primary: number }>>,
): Array<{ name: string; primary: number }> {
  const acc = new Map<string, number>()
  lists.forEach((rows) => {
    rows.forEach((r) => {
      const key = r.name
      acc.set(key, (acc.get(key) ?? 0) + (Number.isFinite(r.primary) ? r.primary : 0))
    })
  })
  const out = Array.from(acc.entries()).map(([name, primary]) => ({ name, primary }))
  out.sort((a, b) => b.primary - a.primary || a.name.localeCompare(b.name))
  return out
}

function buildCompareRows(
  primaryRows: Array<{ name: string; primary: number }>,
  compareRows: Array<{ name: string; primary: number }>,
): Array<{ name: string; primary: number; compare: number; gap: number }> {
  const pMap = new Map(primaryRows.map((r) => [r.name, r.primary]))
  const cMap = new Map(compareRows.map((r) => [r.name, r.primary]))
  const names = new Set<string>([...pMap.keys(), ...cMap.keys()])
  const merged = Array.from(names).map((name) => {
    const p = pMap.get(name) ?? 0
    const c = cMap.get(name) ?? 0
    return { name, primary: p, compare: c, gap: c - p }
  })
  merged.sort((a, b) => {
    const aP0 = a.primary === 0 ? 1 : 0
    const bP0 = b.primary === 0 ? 1 : 0
    if (aP0 !== bP0) return aP0 - bP0
    if (b.primary !== a.primary) return b.primary - a.primary
    if (b.compare !== a.compare) return b.compare - a.compare
    return a.name.localeCompare(b.name)
  })
  return merged
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function exportRowsToCsv(rows: Array<{ name: string; primary: number; compare: number; gap: number }>) {
  const header = ['name', 'primary', 'compare', 'gap']
  const data = rows.map((r) => [r.name, String(r.primary), String(r.compare), String(r.gap)])
  const all = [header, ...data]
  const csv = all
    .map((line) =>
      line
        .map((cell) => {
          const s = String(cell ?? '')
          if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`
          return s
        })
        .join(','),
    )
    .join('\n')
  return new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
}

function exportRowsToXlsHtml(title: string, rows: Array<{ name: string; primary: number; compare: number; gap: number }>) {
  const header = ['名称', '主项目数', '对比项目数', 'Gap']
  const th = header
    .map((h) => `<th style="border:1px solid #d1d5db;padding:6px 8px;background:#f8fafc;">${escapeHtml(h)}</th>`)
    .join('')
  const body = rows
    .map(
      (r) =>
        `<tr>${[
          `<td style="border:1px solid #d1d5db;padding:6px 8px;">${escapeHtml(r.name)}</td>`,
          `<td style="border:1px solid #d1d5db;padding:6px 8px;text-align:right;">${r.primary}</td>`,
          `<td style="border:1px solid #d1d5db;padding:6px 8px;text-align:right;">${r.compare}</td>`,
          `<td style="border:1px solid #d1d5db;padding:6px 8px;text-align:right;">${r.gap}</td>`,
        ].join('')}</tr>`,
    )
    .join('')
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><h3 style="margin:0 0 10px;">${escapeHtml(title)}</h3><table style="border-collapse:collapse;font-size:12px;"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></body></html>`
  return new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
}

type BugBoardPageProps = {
  embedded?: boolean
  defaultPrimaryProjectKey?: string
  analysisStartDate?: string
  analysisEndDate?: string
}

export function BugBoardPage({
  embedded = false,
  defaultPrimaryProjectKey = '',
  analysisStartDate = '',
  analysisEndDate = '',
}: BugBoardPageProps) {
  const jiraConnection = useSettingsStore((s) => s.jiraConnection)
  const setActiveSection = useProjectStore((s) => s.setActiveSection)
  const [fetchKeysRaw, setFetchKeysRaw] = React.useState(DEFAULT_PRIMARY)
  const fetchKeys = React.useMemo(() => parseProjectKeys(fetchKeysRaw), [fetchKeysRaw])
  const [viewPrimaryProjectKey, setViewPrimaryProjectKey] = React.useState(defaultPrimaryProjectKey || DEFAULT_PRIMARY)
  const [viewCompareProjectKey, setViewCompareProjectKey] = React.useState('')
  const [forceRefresh, setForceRefresh] = React.useState(false)
  const [exportTaskId, setExportTaskId] = React.useState('')
  const [status, setStatus] = React.useState<BugDistTaskStatus | null>(null)
  const [activeTab, setActiveTab] = React.useState<'module' | 'team'>('module')
  const [polling, setPolling] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [cachedProjects, setCachedProjects] = React.useState<string[]>(() => loadCachedProjects())
  const [projectNames, setProjectNames] = React.useState<Record<string, string>>(() => loadProjectNames())
  const [projectSummaries, setProjectSummaries] = React.useState<ProjectSummary[]>([])
  const [fieldMappings, setFieldMappings] = React.useState<FieldMapping[]>([])
  const [mixName, setMixName] = React.useState('')
  const [mixMap, setMixMap] = React.useState<Record<string, string[]>>(() => loadMixMap())
  const [topN, setTopN] = React.useState(15)
  const normalizedRangeStart = React.useMemo(() => analysisStartDate.trim(), [analysisStartDate])
  const normalizedRangeEnd = React.useMemo(() => analysisEndDate.trim(), [analysisEndDate])
  const summaryProjectKeys = React.useMemo(
    () => projectSummaries.map((item) => item.name.trim().toUpperCase()).filter(Boolean),
    [projectSummaries],
  )
  const pickerProjectKeys = React.useMemo(() => {
    if (embedded) return summaryProjectKeys
    const summarySet = new Set(summaryProjectKeys)
    const merged = [
      ...summaryProjectKeys,
      ...cachedProjects.filter((key) => key.startsWith('MIX:') || summarySet.has(key)),
    ]
    return Array.from(new Set(merged))
  }, [embedded, summaryProjectKeys, cachedProjects])

  const displayProject = React.useCallback(
    (key: string) => {
      const k = key.trim().toUpperCase()
      const summary = projectSummaries.find((item) => item.name === k)
      const name = summary?.displayName?.trim() || projectNames[k]?.trim()
      if (!name) return k
      // 混合项目的 key 可能很长（MIX:A+B+...），下拉与图例仅展示用户输入名称
      if (k.startsWith('MIX:')) return name
      return formatProjectLabel(k, name)
    },
    [projectNames, projectSummaries],
  )

  React.useEffect(() => {
    let cancelled = false
    void services.projectService.listCachedProjects().then((rows) => {
      if (cancelled) return
      setProjectSummaries(rows)
      setCachedProjects((prev) => {
        const merged = Array.from(new Set([...rows.map((row) => row.name), ...prev]))
        persistCachedProjects(merged)
        return merged
      })
      setProjectNames((prev) => {
        const next = { ...prev }
        rows.forEach((row) => {
          if (row.displayName?.trim()) next[row.name] = row.displayName.trim()
        })
        persistProjectNames(next)
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void services.configService.listFieldMappings().then((rows) => {
      if (!cancelled) setFieldMappings(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    const key = defaultPrimaryProjectKey.trim().toUpperCase()
    if (!key) return
    setViewPrimaryProjectKey(key)
    setFetchKeysRaw(key)
  }, [defaultPrimaryProjectKey])

  React.useEffect(() => {
    if (!embedded) return
    if (!pickerProjectKeys.length) return
    const current = viewPrimaryProjectKey.trim().toUpperCase()
    if (current && pickerProjectKeys.includes(current)) return
    setViewPrimaryProjectKey(pickerProjectKeys[0] ?? '')
    setViewCompareProjectKey('')
  }, [embedded, pickerProjectKeys, viewPrimaryProjectKey])

  const reporterTeamFieldPath = React.useMemo(
    () =>
      fieldMappings.find((item) => item.businessName === 'Reporter Team-New')?.jiraFieldPath?.trim() ||
      'customfield_15319',
    [fieldMappings],
  )
  const issueTypeClause = 'issuetype in (defect, defect_new)'
  const importedProjectKeys = React.useMemo(
    () => new Set(projectSummaries.map((item) => item.name.trim().toUpperCase()).filter(Boolean)),
    [projectSummaries],
  )

  const ensureJiraConfigOk = () => {
    if (!jiraConnection.baseUrl.trim()) {
      toast('获取失败', { description: '请先在“系统配置”填写 Jira Base URL' })
      setActiveSection('config')
      return false
    }
    if (!jiraConnection.token.trim()) {
      toast('获取失败', { description: '请先在“系统配置”填写 Jira Token / 密码' })
      setActiveSection('config')
      return false
    }
    if (jiraConnection.authType === 'basic' && !jiraConnection.username.trim()) {
      toast('获取失败', { description: 'Basic Auth 需要用户名（请去“系统配置”填写）' })
      setActiveSection('config')
      return false
    }
    return true
  }

  const runTaskAndWait = React.useCallback(
    async (primary: string, compare: string, force: boolean) => {
      setPolling(true)
      try {
        const res = await services.bugDistService.createTask({
          primaryProjectKey: primary,
          compareProjectKey: compare,
          forceRefresh: force,
          startDate: normalizedRangeStart,
          endDate: normalizedRangeEnd,
          teamFieldPath: reporterTeamFieldPath,
          issueTypeClause,
          ...jiraConnection,
        })
        const id = res.taskId
        const deadline = Date.now() + 5 * 60_000
        while (Date.now() < deadline) {
          const s = await services.bugDistService.getTaskStatus(id)
          setStatus(s)
          if (s.status === 'failed') throw new Error(s.error || '任务失败')
          if (s.status === 'success' && s.result) {
            saveResultToCache(id, s.result, normalizedRangeStart, normalizedRangeEnd)
            setExportTaskId(id)
            const key = s.result.primaryProjectKey.trim().toUpperCase()
            setCachedProjects((prev) => {
              const next = [key, ...prev.filter((x) => x !== key)].slice(0, 50)
              persistCachedProjects(next)
              return next
            })
            return { taskId: id, result: s.result }
          }
          await new Promise((r) => setTimeout(r, 900))
        }
        throw new Error('任务超时')
      } finally {
        setPolling(false)
      }
    },
    [issueTypeClause, jiraConnection, normalizedRangeStart, normalizedRangeEnd, reporterTeamFieldPath],
  )

  const fetchData = async () => {
    if (!fetchKeys.length) {
      toast('获取失败', { description: '请填写项目 Key' })
      return
    }
    const allImported = fetchKeys.every((key) => importedProjectKeys.has(key))
    if (!allImported && !ensureJiraConfigOk()) return
    if (fetchKeys.length === 1) {
      const key = fetchKeys[0]!
      setViewPrimaryProjectKey(key)
      setViewCompareProjectKey('')
      await runTaskAndWait(key, '', forceRefresh)
      toast('已完成', { description: `已获取项目 ${key}` })
      return
    }

    const mixLabel = mixName.trim()
    if (!mixLabel) {
      toast('请先命名', { description: '输入了多个项目 Key，请先为这个混合项目填写名称（必填）' })
      return
    }

    // 逐个拉取子项目（复用后端缓存；forceRefresh 生效）
    const childResults: Array<NonNullable<BugDistTaskStatus['result']>> = []
    for (const key of fetchKeys) {
      const done = await runTaskAndWait(key, '', forceRefresh)
      childResults.push(done.result)
    }

    // 聚合成“混合项目”结果（仅单项目形态：compare=0）
    const modules = aggregateCountRows(childResults.map((r) => r.module.rows.map((x) => ({ name: x.name, primary: x.primary }))))
    const teams = aggregateCountRows(childResults.map((r) => r.team.rows.map((x) => ({ name: x.name, primary: x.primary }))))

    const mixKey = `MIX:${fetchKeys.join('+')}`
    const moduleRows = modules.map((x) => ({ name: x.name, primary: x.primary, compare: 0, gap: -x.primary }))
    const teamRows = teams.map((x) => ({ name: x.name, primary: x.primary, compare: 0, gap: -x.primary }))
    const mixIssueTotal = childResults.reduce((s, r) => s + resolvedPrimaryIssueCount(r), 0)

    const mixResult: NonNullable<BugDistTaskStatus['result']> = {
      primaryProjectKey: mixKey,
      compareProjectKey: '',
      generatedAt: new Date().toISOString(),
      cached: true,
      primaryIssueCount: mixIssueTotal,
      compareIssueCount: 0,
      module: { rows: moduleRows, top15: moduleRows.slice(0, 15) },
      team: { rows: teamRows, top15: teamRows.slice(0, 15) },
    }

    // 写入本地缓存（无 taskId），并登记名称与 mix 组成
    saveResultToCache('', mixResult, normalizedRangeStart, normalizedRangeEnd)
    const nextNames = { ...projectNames, [mixKey]: mixLabel }
    setProjectNames(nextNames)
    persistProjectNames(nextNames)
    const nextMix = { ...mixMap, [mixKey]: fetchKeys }
    setMixMap(nextMix)
    persistMixMap(nextMix)
    setCachedProjects((prev) => {
      const next = [mixKey, ...prev.filter((x) => x !== mixKey)].slice(0, 50)
      persistCachedProjects(next)
      return next
    })
    setViewPrimaryProjectKey(mixKey)
    setViewCompareProjectKey('')
    setExportTaskId('')
    setStatus({
      taskId: 'local-mix',
      status: 'success',
      progress: { pageSize: 0, startAt: 0, fetched: 0, total: 0, message: '' },
      result: mixResult,
      error: '',
    })
    toast('已完成', { description: `已生成混合项目：${mixLabel}` })
  }

  const buildCompare = async (compareOverride?: string) => {
    const primary = viewPrimaryProjectKey.trim().toUpperCase()
    const compare = (compareOverride ?? viewCompareProjectKey).trim().toUpperCase()
    if (!primary) {
      toast('对比失败', { description: '请选择一个主项目' })
      return
    }
    if (!compare) {
      toast('对比失败', { description: '请选择一个对比项目' })
      return
    }
    // 对比优先本地构建；若缺缓存则自动补算对应项目，避免用户必须先手动“获取”
    let primaryCached = loadResultFromCache(primary, '', normalizedRangeStart, normalizedRangeEnd)
    let compareCached = loadResultFromCache(compare, '', normalizedRangeStart, normalizedRangeEnd)
    const canUseImportedData =
      importedProjectKeys.has(primary) &&
      importedProjectKeys.has(compare)
    if ((!primaryCached || !compareCached) && !canUseImportedData && !ensureJiraConfigOk()) return
    if (!primaryCached) {
      const done = await runTaskAndWait(primary, '', false)
      primaryCached = { taskId: done.taskId, result: done.result }
    }
    if (!compareCached) {
      const done = await runTaskAndWait(compare, '', false)
      compareCached = { taskId: done.taskId, result: done.result }
    }
    if (!primaryCached || !compareCached) {
      toast('对比失败', { description: '主项目或对比项目统计结果不可用，请稍后重试' })
      return
    }
    const moduleRows = buildCompareRows(
      primaryCached.result.module.rows.map((x) => ({ name: x.name, primary: x.primary })),
      compareCached.result.module.rows.map((x) => ({ name: x.name, primary: x.primary })),
    )
    const teamRows = buildCompareRows(
      primaryCached.result.team.rows.map((x) => ({ name: x.name, primary: x.primary })),
      compareCached.result.team.rows.map((x) => ({ name: x.name, primary: x.primary })),
    )
    const merged: NonNullable<BugDistTaskStatus['result']> = {
      primaryProjectKey: primary,
      compareProjectKey: compare,
      generatedAt: new Date().toISOString(),
      cached: true,
      primaryIssueCount: moduleRows.reduce((s, x) => s + x.primary, 0),
      compareIssueCount: moduleRows.reduce((s, x) => s + x.compare, 0),
      module: { rows: moduleRows, top15: moduleRows.slice(0, 15) },
      team: { rows: teamRows, top15: teamRows.slice(0, 15) },
    }
    saveResultToCache('', merged, normalizedRangeStart, normalizedRangeEnd)
    setExportTaskId('')
    setStatus({
      taskId: 'local-compare',
      status: 'success',
      progress: { pageSize: 0, startAt: 0, fetched: 0, total: 0, message: '' },
      result: merged,
      error: '',
    })
  }

  React.useEffect(() => {
    const primary = viewPrimaryProjectKey.trim().toUpperCase()
    if (!primary) return
    const cached = loadResultFromCache(primary, '', normalizedRangeStart, normalizedRangeEnd)
    if (!cached) {
      setStatus(null)
      setExportTaskId('')
      return
    }
    setExportTaskId(cached.taskId)
    setStatus({
      taskId: 'local-cache',
      status: 'success',
      progress: { pageSize: 0, startAt: 0, fetched: 0, total: 0, message: '' },
      result: cached.result,
      error: '',
    })
  }, [normalizedRangeEnd, normalizedRangeStart, viewPrimaryProjectKey])

  React.useEffect(() => {
    if (!embedded) return
    const primary = viewPrimaryProjectKey.trim().toUpperCase()
    if (!primary) return
    const cached = loadResultFromCache(primary, '', normalizedRangeStart, normalizedRangeEnd)
    if (cached?.result) return
    const canUseImportedData = importedProjectKeys.has(primary)
    if (!canUseImportedData && !ensureJiraConfigOk()) return
    void runTaskAndWait(primary, '', false).catch((e: unknown) => {
      toast('自动统计失败', { description: e instanceof Error ? e.message : '模块分布自动统计失败' })
    })
  }, [
    embedded,
    importedProjectKeys,
    normalizedRangeEnd,
    normalizedRangeStart,
    runTaskAndWait,
    viewPrimaryProjectKey,
  ])

  const exportCurrent = (format: 'csv' | 'xlsx') => {
    if (exporting) return
    const effectiveTaskId = exportTaskId
    const current = status?.result
    const isVirtualProject = Boolean(current?.primaryProjectKey?.toUpperCase().startsWith('MIX:')) || status?.taskId?.startsWith('local-') === true
    const canUseBackendExport = Boolean(effectiveTaskId && !isVirtualProject)

    const exportLocal = () => {
      if (!current) {
        toast('无法导出', { description: '当前项目没有可导出的统计结果，请先获取/对比一次' })
        return
      }
      const tab = activeTab
      const rows = (tab === 'module' ? current.module.rows : current.team.rows) as Array<{
        name: string
        primary: number
        compare: number
        gap: number
      }>
      const baseName = (projectNames[current.primaryProjectKey?.toUpperCase?.() ? current.primaryProjectKey.toUpperCase() : current.primaryProjectKey] ?? current.primaryProjectKey)
        .replaceAll(/[\\/:*?"<>|]/g, '_')
      const suffix = tab === 'module' ? 'module' : 'team'
      const date = new Date().toISOString().slice(0, 10)
      if (format === 'csv') {
        const blob = exportRowsToCsv(rows)
        downloadBlob(`bug-dist.${baseName}.${suffix}.${date}.csv`, blob)
        return
      }
      const blob = exportRowsToXlsHtml(`${baseName} ${suffix} 分布`, rows)
      downloadBlob(`bug-dist.${baseName}.${suffix}.${date}.xls`, blob)
    }

    if (canUseBackendExport) {
      const url = services.bugDistService.getExportUrl({
        taskId: effectiveTaskId,
        tab: activeTab,
        format,
      })
      downloadUrl(url)
      return
    }

    // MIX/本地对比/无 taskId：前端本地导出
    if (isVirtualProject || !effectiveTaskId) {
      exportLocal()
      return
    }

    // 单项目但缺 taskId：生成导出任务（命中后端缓存）再导出
    if (!current?.primaryProjectKey) {
      toast('无法导出', { description: '当前项目没有可导出的统计结果，请先获取/对比一次' })
      return
    }
    const canUseImportedData =
      importedProjectKeys.has(current.primaryProjectKey.trim().toUpperCase()) &&
      (!current.compareProjectKey || importedProjectKeys.has(current.compareProjectKey.trim().toUpperCase()))
    if (!canUseImportedData && !ensureJiraConfigOk()) return

    setExporting(true)
    toast('准备导出', { description: '正在生成导出任务（首次可能稍慢）' })
    void services.bugDistService
      .createTask({
        primaryProjectKey: current.primaryProjectKey,
        compareProjectKey: current.compareProjectKey ?? '',
        forceRefresh: false,
        startDate: normalizedRangeStart,
        endDate: normalizedRangeEnd,
        teamFieldPath: reporterTeamFieldPath,
        issueTypeClause,
        ...jiraConnection,
      })
      .then(async (res) => {
        const id = res.taskId
        // poll until success
        const deadline = Date.now() + 60_000
        while (Date.now() < deadline) {
          const s = await services.bugDistService.getTaskStatus(id)
          if (s.status === 'failed') throw new Error(s.error || '导出任务失败')
          if (s.status === 'success' && s.result) {
            saveResultToCache(id, s.result, normalizedRangeStart, normalizedRangeEnd)
            setExportTaskId(id)
            const url = services.bugDistService.getExportUrl({ taskId: id, tab: activeTab, format })
            downloadUrl(url)
            return
          }
          await new Promise((r) => setTimeout(r, 800))
        }
        throw new Error('导出任务超时，请稍后重试')
      })
      .catch((e: unknown) => {
        toast('导出失败', { description: e instanceof Error ? e.message : '导出失败' })
      })
      .finally(() => {
        setExporting(false)
      })
  }

  const progress = status?.progress
  const percent = progress ? formatPercent(progress.fetched, progress.total) : 0
  const result = status?.result
  const tabResult = activeTab === 'module' ? result?.module : result?.team
  const rows = tabResult?.rows ?? []
  const clampedTopN = Math.max(1, Math.min(30, Math.round(topN)))
  const moduleTop = (result?.module?.rows ?? []).slice(0, clampedTopN)
  const teamTop = (result?.team?.rows ?? []).slice(0, clampedTopN)

  const showFetchDiskCacheHint =
    status?.status === 'success' &&
    Boolean(result) &&
    Boolean(result?.cached) &&
    !String(result?.primaryProjectKey ?? '')
      .trim()
      .toUpperCase()
      .startsWith('MIX:') &&
    status?.taskId !== 'local-compare'

  return (
    <div className="space-y-6">
      {embedded ? null : (
        <div>
          <h2 className="text-2xl font-semibold">项目bug分布</h2>
          <p className="mt-1 text-sm text-slate-500">获取指定项目的 Defect，并按模块（Component）与提报 Team 做分布统计与对比。</p>
        </div>
      )}

      {!embedded ? (
        <BugBoardFetchCard
          embedded={embedded}
          fetchKeysRaw={fetchKeysRaw}
          onFetchKeysRawChange={setFetchKeysRaw}
          fetchKeysLength={fetchKeys.length}
          mixName={mixName}
          onMixNameChange={setMixName}
          forceRefresh={forceRefresh}
          onForceRefreshChange={setForceRefresh}
          polling={polling}
          disableFetch={polling || !fetchKeys.length || (fetchKeys.length > 1 && !mixName.trim())}
          onFetch={() => void fetchData()}
          showProgress={polling}
          progressMessage={progress?.message || '任务执行中…'}
          progressLabel={progress ? `${progress.fetched}${progress.total ? `/${progress.total}` : ''}` : '-'}
          progressValue={progress?.total ? percent : 60}
          statusContent={
            status?.status === 'success' && result ? (
              <div className="space-y-2">
                <div className="text-sm text-slate-600">
                  已完成（{result.cached ? '命中缓存' : '已拉取并聚合'}），生成时间：
                  {result.generatedAt ? new Date(result.generatedAt).toLocaleString() : '-'}
                </div>
                {showFetchDiskCacheHint ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    当前数据来自<strong>本地缓存</strong>，本次获取未向 Jira 发起全量拉取。若需与 Jira 保持一致，请勾选「强制刷新」后重新点击获取。
                  </div>
                ) : null}
                <div className="text-sm text-slate-700">
                  {(result.compareProjectKey ?? '').trim() ? (
                    <>
                      主项目 Defect 条数：<span className="font-mono tabular-nums">{resolvedPrimaryIssueCount(result)}</span>
                      ；对比项目：
                      <span className="font-mono tabular-nums">{resolvedCompareIssueCount(result)}</span>
                    </>
                  ) : String(result.primaryProjectKey ?? '').trim().toUpperCase().startsWith('MIX:') ? (
                    <>
                      各子项目 Defect 条数合计（用于混合统计）：
                      <span className="font-mono tabular-nums">{resolvedPrimaryIssueCount(result)}</span>
                    </>
                  ) : (
                    <>
                      本次统计 Defect 总条数：
                      <span className="font-mono tabular-nums">{resolvedPrimaryIssueCount(result)}</span>
                    </>
                  )}
                </div>
              </div>
            ) : null
          }
        />
      ) : null}

      <BugBoardProjectViewCard
        viewPrimaryProjectKey={viewPrimaryProjectKey}
        onPrimaryChange={(next) => {
          setViewPrimaryProjectKey(next.trim().toUpperCase())
          setViewCompareProjectKey('')
        }}
        primaryOptions={pickerProjectKeys.map((key) => ({
          key,
          displayName: projectSummaries.find((summary) => summary.name === key)?.displayName || projectNames[key],
        }))}
        viewCompareProjectKey={viewCompareProjectKey}
        onCompareChange={(next) => {
          const nextCompare = next.trim().toUpperCase()
          setViewCompareProjectKey(nextCompare)
          if (!nextCompare) {
            const primary = viewPrimaryProjectKey.trim().toUpperCase()
            const cached = loadResultFromCache(primary, '', normalizedRangeStart, normalizedRangeEnd)
            if (!cached) {
              setStatus(null)
              setExportTaskId('')
              return
            }
            setExportTaskId(cached.taskId)
            setStatus({
              taskId: 'local-cache',
              status: 'success',
              progress: { pageSize: 0, startAt: 0, fetched: 0, total: 0, message: '' },
              result: cached.result,
              error: '',
            })
            return
          }
          void buildCompare(nextCompare)
        }}
        compareOptions={pickerProjectKeys
          .filter((key) => key && key !== viewPrimaryProjectKey.trim().toUpperCase())
          .map((key) => ({
            key,
            displayName: projectSummaries.find((summary) => summary.name === key)?.displayName || projectNames[key],
          }))}
        polling={polling}
        exporting={exporting}
        canExport={Boolean(exportTaskId || status?.result)}
        onExportCsv={() => exportCurrent('csv')}
        onExportXlsx={() => exportCurrent('xlsx')}
      />

      <React.Suspense fallback={<div className="rounded-2xl border bg-white px-4 py-6 text-sm text-slate-500">分布统计加载中...</div>}>
        <BugBoardDistributionSection
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          topN={topN}
          onTopNChange={setTopN}
          clampedTopN={clampedTopN}
          moduleTop={moduleTop}
          teamTop={teamTop}
          rows={rows}
          hasResult={Boolean(result)}
          viewPrimaryProjectKey={viewPrimaryProjectKey}
          viewCompareProjectKey={viewCompareProjectKey}
          displayProject={displayProject}
        />
      </React.Suspense>
    </div>
  )
}
