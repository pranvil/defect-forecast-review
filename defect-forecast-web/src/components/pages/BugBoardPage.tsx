import * as React from 'react'
import { toast } from 'sonner'
import ReactECharts from 'echarts-for-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { services } from '@/services'
import { useProjectStore } from '@/stores/projectStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { BugDistTaskStatus } from '@/services/bugDistService'

const DEFAULT_PRIMARY = 'MNTNPOM'
const BUG_BOARD_CACHE_KEY = 'drp.bugBoard.cachedProjects.v1'
const BUG_BOARD_RESULT_CACHE_KEY = 'drp.bugBoard.results.v1'
const BUG_BOARD_PROJECT_NAMES_KEY = 'drp.bugBoard.projectNames.v1'
const BUG_BOARD_MIX_MAP_KEY = 'drp.bugBoard.mixMap.v1'
const PRIMARY_COLOR = '#6366f1'
const COMPARE_COLOR = '#22c55e'

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

function resultCacheKey(primary: string, compare: string) {
  return `${primary.trim().toUpperCase()}::${compare.trim().toUpperCase()}`
}

function loadResultFromCache(primary: string, compare: string) {
  try {
    const raw = localStorage.getItem(BUG_BOARD_RESULT_CACHE_KEY)
    if (!raw) return null
    const key = resultCacheKey(primary, compare)
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

function saveResultToCache(taskId: string, result: NonNullable<BugDistTaskStatus['result']>) {
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
    const key = resultCacheKey(result.primaryProjectKey, result.compareProjectKey ?? '')
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

export function BugBoardPage() {
  const jiraConnection = useSettingsStore((s) => s.jiraConnection)
  const setActiveSection = useProjectStore((s) => s.setActiveSection)
  const [fetchKeysRaw, setFetchKeysRaw] = React.useState(DEFAULT_PRIMARY)
  const fetchKeys = React.useMemo(() => parseProjectKeys(fetchKeysRaw), [fetchKeysRaw])
  const [viewPrimaryProjectKey, setViewPrimaryProjectKey] = React.useState(DEFAULT_PRIMARY)
  const [viewCompareProjectKey, setViewCompareProjectKey] = React.useState('')
  const [forceRefresh, setForceRefresh] = React.useState(false)
  const [exportTaskId, setExportTaskId] = React.useState('')
  const [status, setStatus] = React.useState<BugDistTaskStatus | null>(null)
  const [activeTab, setActiveTab] = React.useState<'module' | 'team'>('module')
  const [polling, setPolling] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [cachedProjects, setCachedProjects] = React.useState<string[]>(() => loadCachedProjects())
  const [projectNames, setProjectNames] = React.useState<Record<string, string>>(() => loadProjectNames())
  const [mixName, setMixName] = React.useState('')
  const [mixMap, setMixMap] = React.useState<Record<string, string[]>>(() => loadMixMap())
  const [topN, setTopN] = React.useState(15)

  const displayProject = React.useCallback(
    (key: string) => {
      const k = key.trim().toUpperCase()
      const name = projectNames[k]?.trim()
      if (!name) return k
      // 混合项目的 key 可能很长（MIX:A+B+...），下拉与图例仅展示用户输入名称
      if (k.startsWith('MIX:')) return name
      return `${name}（${k}）`
    },
    [projectNames],
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
          ...jiraConnection,
        })
        const id = res.taskId
        const deadline = Date.now() + 5 * 60_000
        while (Date.now() < deadline) {
          // eslint-disable-next-line no-await-in-loop
          const s = await services.bugDistService.getTaskStatus(id)
          setStatus(s)
          if (s.status === 'failed') throw new Error(s.error || '任务失败')
          if (s.status === 'success' && s.result) {
            saveResultToCache(id, s.result)
            setExportTaskId(id)
            const key = s.result.primaryProjectKey.trim().toUpperCase()
            setCachedProjects((prev) => {
              const next = [key, ...prev.filter((x) => x !== key)].slice(0, 50)
              persistCachedProjects(next)
              return next
            })
            return { taskId: id, result: s.result }
          }
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 900))
        }
        throw new Error('任务超时')
      } finally {
        setPolling(false)
      }
    },
    [jiraConnection],
  )

  const fetchData = async () => {
    if (!fetchKeys.length) {
      toast('获取失败', { description: '请填写项目 Key' })
      return
    }
    if (!ensureJiraConfigOk()) return
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
      // eslint-disable-next-line no-await-in-loop
      const done = await runTaskAndWait(key, '', forceRefresh)
      childResults.push(done.result)
    }

    // 聚合成“混合项目”结果（仅单项目形态：compare=0）
    const modules = aggregateCountRows(childResults.map((r) => r.module.rows.map((x) => ({ name: x.name, primary: x.primary }))))
    const teams = aggregateCountRows(childResults.map((r) => r.team.rows.map((x) => ({ name: x.name, primary: x.primary }))))

    const mixKey = `MIX:${fetchKeys.join('+')}`
    const moduleRows = modules.map((x) => ({ name: x.name, primary: x.primary, compare: 0, gap: -x.primary }))
    const teamRows = teams.map((x) => ({ name: x.name, primary: x.primary, compare: 0, gap: -x.primary }))

    const mixResult: NonNullable<BugDistTaskStatus['result']> = {
      primaryProjectKey: mixKey,
      compareProjectKey: '',
      generatedAt: new Date().toISOString(),
      cached: true,
      module: { rows: moduleRows, top15: moduleRows.slice(0, 15) },
      team: { rows: teamRows, top15: teamRows.slice(0, 15) },
    }

    // 写入本地缓存（无 taskId），并登记名称与 mix 组成
    saveResultToCache('', mixResult)
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

  const buildCompare = async () => {
    const primary = viewPrimaryProjectKey.trim().toUpperCase()
    const compare = viewCompareProjectKey.trim().toUpperCase()
    if (!primary) {
      toast('对比失败', { description: '请选择一个主项目' })
      return
    }
    if (!compare) {
      toast('对比失败', { description: '请选择一个对比项目' })
      return
    }
    // 对比优先本地构建（尤其是混合项目无法后端直接拉）
    const primaryCached = loadResultFromCache(primary, '')
    const compareCached = loadResultFromCache(compare, '')
    if (!primaryCached || !compareCached) {
      toast('对比失败', { description: '请确保主项目与对比项目都已获取并生成结果（可在数据获取里先获取）' })
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
      module: { rows: moduleRows, top15: moduleRows.slice(0, 15) },
      team: { rows: teamRows, top15: teamRows.slice(0, 15) },
    }
    saveResultToCache('', merged)
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
    const cached = loadResultFromCache(primary, '')
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
  }, [viewPrimaryProjectKey])

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
    if (!ensureJiraConfigOk()) return

    setExporting(true)
    toast('准备导出', { description: '正在生成导出任务（首次可能稍慢）' })
    void services.bugDistService
      .createTask({
        primaryProjectKey: current.primaryProjectKey,
        compareProjectKey: current.compareProjectKey ?? '',
        forceRefresh: false,
        ...jiraConnection,
      })
      .then(async (res) => {
        const id = res.taskId
        // poll until success
        const deadline = Date.now() + 60_000
        while (Date.now() < deadline) {
          // eslint-disable-next-line no-await-in-loop
          const s = await services.bugDistService.getTaskStatus(id)
          if (s.status === 'failed') throw new Error(s.error || '导出任务失败')
          if (s.status === 'success' && s.result) {
            saveResultToCache(id, s.result)
            setExportTaskId(id)
            const url = services.bugDistService.getExportUrl({ taskId: id, tab: activeTab, format })
            downloadUrl(url)
            return
          }
          // eslint-disable-next-line no-await-in-loop
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

  const moduleChartOption = React.useMemo(() => {
    const items = moduleTop
    const categories = items.map((x) => x.name)
    const primary = items.map((x) => x.primary)
    const compare = items.map((x) => x.compare)
    const hasCompare = viewCompareProjectKey.trim().length > 0
    const primaryName = viewPrimaryProjectKey.trim()
      ? `${displayProject(viewPrimaryProjectKey)}（主）`
      : '主项目'
    const compareName = viewCompareProjectKey.trim()
      ? `${displayProject(viewCompareProjectKey)}（对比）`
      : '对比项目'
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      toolbox: { feature: { saveAsImage: {}, dataZoom: {} } },
      legend: { top: 8, left: 12, right: 12 },
      grid: { left: 56, right: 24, top: 48, bottom: 120, containLabel: true },
      xAxis: {
        type: 'category',
        name: '模块',
        nameGap: 44,
        data: categories,
        axisLabel: {
          interval: 0,
          rotate: 35,
          overflow: 'truncate',
          width: 110,
          margin: 18,
        },
      },
      yAxis: {
        type: 'value',
        name: '数量',
        nameLocation: 'middle',
        nameGap: 54,
        nameRotate: 90,
        nameTextStyle: { color: '#64748b' },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        {
          type: 'slider',
          xAxisIndex: 0,
          bottom: 18,
          height: 22,
        },
      ],
      series: [
        { name: primaryName, type: 'bar', data: primary, itemStyle: { color: PRIMARY_COLOR } },
        ...(hasCompare
          ? [{ name: compareName, type: 'bar', data: compare, itemStyle: { color: COMPARE_COLOR } }]
          : []),
      ],
    }
  }, [moduleTop, viewPrimaryProjectKey, viewCompareProjectKey, displayProject])

  const teamChartOption = React.useMemo(() => {
    const items = teamTop
    const categories = items.map((x) => x.name)
    const primary = items.map((x) => x.primary)
    const compare = items.map((x) => x.compare)
    const hasCompare = viewCompareProjectKey.trim().length > 0
    const showSlider = categories.length > 10
    const primaryName = viewPrimaryProjectKey.trim()
      ? `${displayProject(viewPrimaryProjectKey)}（主）`
      : '主项目'
    const compareName = viewCompareProjectKey.trim()
      ? `${displayProject(viewCompareProjectKey)}（对比）`
      : '对比项目'
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      toolbox: { feature: { saveAsImage: {}, dataZoom: {} } },
      legend: { top: 8, left: 12, right: 12 },
      grid: { left: 56, right: 24, top: 48, bottom: showSlider ? 130 : 120, containLabel: true },
      xAxis: {
        type: 'category',
        name: 'Team',
        nameGap: 44,
        data: categories,
        axisLabel: {
          interval: 0,
          rotate: 35,
          overflow: 'truncate',
          width: 130,
          margin: 18,
        },
      },
      yAxis: {
        type: 'value',
        name: '数量',
        nameLocation: 'middle',
        nameGap: 54,
        nameRotate: 90,
        nameTextStyle: { color: '#64748b' },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        {
          type: 'slider',
          xAxisIndex: 0,
          bottom: 18,
          height: 22,
        },
      ],
      series: [
        { name: primaryName, type: 'bar', data: primary, itemStyle: { color: PRIMARY_COLOR } },
        ...(hasCompare
          ? [{ name: compareName, type: 'bar', data: compare, itemStyle: { color: COMPARE_COLOR } }]
          : []),
      ],
    }
  }, [teamTop, viewPrimaryProjectKey, viewCompareProjectKey, displayProject])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">项目bug分布</h2>
        <p className="mt-1 text-sm text-slate-500">获取指定项目的 Defect，并按模块（Component）与提报 Team 做分布统计与对比。</p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>数据获取</CardTitle>
          <CardDescription>专门用于从 Jira 拉取指定项目的 Defect 数据，并缓存到本地（便于后续对比）。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>项目 Key（可多行，逗号/空格/换行分隔）</Label>
              <Textarea
                className="min-h-[84px] rounded-2xl font-mono"
                value={fetchKeysRaw}
                onChange={(e) => {
                  setFetchKeysRaw(e.target.value)
                  const keys = parseProjectKeys(e.target.value)
                  if (keys.length <= 1) return
                }}
              />
              {fetchKeys.length > 1 ? (
                <div className="space-y-2 rounded-2xl border bg-white p-3">
                  <div className="text-xs text-slate-500">
                    已识别 {fetchKeys.length} 个项目 Key。将合并为一个“混合项目”，请先为这个混合项目命名（必填）。
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-9 rounded-xl"
                      placeholder="例如：26W2-26W27 组合项目 / 某系列混合"
                      value={mixName}
                      onChange={(e) => setMixName(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-2" />
            <div className="space-y-2">
              <Label>缓存</Label>
              <div className="flex h-10 items-center gap-3 rounded-2xl border bg-white px-4 text-sm">
                <input id="forceRefresh" type="checkbox" checked={forceRefresh} onChange={(e) => setForceRefresh(e.target.checked)} />
                <label htmlFor="forceRefresh" className="text-slate-700">
                  强制刷新（仅对获取生效）
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              className="rounded-2xl"
              disabled={
                polling ||
                !fetchKeys.length ||
                (fetchKeys.length > 1 && !mixName.trim())
              }
              onClick={() => void fetchData()}
            >
              获取
            </Button>
          </div>

          {polling ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>{progress?.message || '任务执行中…'}</span>
                <span className="font-mono">
                  {progress ? `${progress.fetched}${progress.total ? `/${progress.total}` : ''}` : '-'}
                </span>
              </div>
              <Progress value={progress?.total ? percent : 60} className="text-sky-700" />
            </div>
          ) : status?.status === 'success' ? (
            <div className="text-sm text-slate-600">
              已完成（{result?.cached ? '命中缓存' : '已拉取并聚合'}），生成时间：{result?.generatedAt ? new Date(result.generatedAt).toLocaleString() : '-'}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>项目查看</CardTitle>
          <CardDescription>选择一个已缓存项目作为主项目，查看其模块/Team 分布结果。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <div className="space-y-2 md:col-span-3">
              <Label>选择查看的项目</Label>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    value={viewPrimaryProjectKey}
                    onValueChange={(v) => {
                      const next = (v ?? '').trim()
                      setViewPrimaryProjectKey(next)
                      setViewCompareProjectKey('')
                    }}
                  >
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue placeholder="请选择一个已缓存项目" />
                      <span className="truncate text-left">
                        {viewPrimaryProjectKey ? displayProject(viewPrimaryProjectKey) : ''}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {cachedProjects.map((x) => (
                        <SelectItem key={x} value={x}>
                          {displayProject(x)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0 rounded-2xl"
                  disabled={polling || exporting || !(exportTaskId || status?.result)}
                  onClick={() => exportCurrent('csv')}
                >
                  导出 CSV
                </Button>
                <Button
                  variant="outline"
                  className="shrink-0 rounded-2xl"
                  disabled={polling || exporting || !(exportTaskId || status?.result)}
                  onClick={() => exportCurrent('xlsx')}
                >
                  导出 Excel
                </Button>
              </div>
            </div>
            <div className="hidden md:block md:col-span-3" />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <div className="space-y-2 md:col-span-3">
              <Label>选择要对比的项目</Label>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    value={viewCompareProjectKey || '__none__'}
                    onValueChange={(v) => {
                      const next = (v ?? '').trim()
                      setViewCompareProjectKey(next === '__none__' ? '' : next)
                    }}
                  >
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue placeholder="不对比" />
                      <span className="truncate text-left">
                        {viewCompareProjectKey ? displayProject(viewCompareProjectKey) : '不对比'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">不对比</SelectItem>
                      {cachedProjects
                        .filter((x) => x && x !== viewPrimaryProjectKey.trim().toUpperCase())
                        .map((x) => (
                          <SelectItem key={x} value={x}>
                            {displayProject(x)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="secondary"
                  className="shrink-0 rounded-2xl"
                  disabled={polling || exporting || !viewPrimaryProjectKey.trim() || !viewCompareProjectKey.trim()}
                  onClick={() => void buildCompare()}
                  title={!viewCompareProjectKey.trim() ? '请选择一个对比项目' : '生成对比结果'}
                >
                  对比
                </Button>
              </div>
            </div>
            <div className="hidden md:block md:col-span-3" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>分布统计</CardTitle>
          <CardDescription>默认 Top15，可设置 1–30。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Label className="text-sm text-slate-600">图表显示条数</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="h-9 w-28 rounded-2xl"
            />
            <div className="text-xs text-slate-500">最大 30，当前 {clampedTopN}</div>
          </div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'module' | 'team')} className="space-y-4">
            <TabsList variant="line" className="w-full justify-start">
              <TabsTrigger value="module">模块分布</TabsTrigger>
              <TabsTrigger value="team">Team 分布</TabsTrigger>
            </TabsList>
            <TabsContent value="module" className="space-y-4">
              <div className="h-[360px]">
                {moduleTop.length ? (
                  <ReactECharts option={moduleChartOption} style={{ height: '100%', width: '100%' }} notMerge />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    {result ? '暂无模块 Top15 数据' : '请先点击“获取”'}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="team" className="space-y-4">
              <div className="h-[420px]">
                {teamTop.length ? (
                  <ReactECharts option={teamChartOption} style={{ height: '100%', width: '100%' }} notMerge />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    {result
                      ? '当前结果缺少 Team 分布数据（可能是旧缓存或后端返回缺字段），请在“数据获取”里勾选强制刷新后重新获取。'
                      : '请先点击“获取”'}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-4 overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">{activeTab === 'module' ? '模块' : 'Team'}</TableHead>
                  <TableHead className="min-w-[120px] text-right">主项目数</TableHead>
                  <TableHead className="min-w-[120px] text-right">对比项目数</TableHead>
                  <TableHead className="min-w-[120px] text-right">Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{r.primary}</TableCell>
                    <TableCell className="text-right">{r.compare}</TableCell>
                    <TableCell className={`text-right ${r.gap > 0 ? 'text-rose-700' : r.gap < 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {r.gap}
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">
                      {result ? '暂无数据（返回空结果）' : '请先点击“获取”'}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

