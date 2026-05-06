import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import * as React from 'react'
import { toast } from 'sonner'
import type { ProjectSummary } from '@/services/projectService'
import { services } from '@/services'
import type { JiraFetchResult } from '@/services/jiraService'
import { useProjectStore } from '@/stores/projectStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { extractProjectKeyFromJql } from '@/utils/jiraJql'
import { toBusinessWeekLabel } from '@/utils/week'

const JIRA_FETCH_FORM_KEY = 'drp.jira.fetch.form.v1'
const JIRA_FETCH_LAST_RESULT_KEY = 'drp.jira.fetch.last-result.v1'
const DEFAULT_PROJECT_KEY = 'MNTNPOM'
const LEGACY_DEFAULT_JQL =
  `project = MNTNPOM\nAND issuetype in (defect, defect_new)\nAND status in ("MORE INFO", "ASSIGNED", "OPENED", "RESOLVE", "VERIFIED_SW", "DELIVERED", "VERIFIED", "CLOSED")\nAND summary !~ "MAIN2MP"\nAND summary !~ "MP2SMR"\nAND summary !~ "CloneMP"\nAND (resolution is EMPTY OR resolution not in ("Needn't Fixed", "Duplicate", "Duplicated"))\nAND created >= 2026-01-01\nAND created < 2026-07-01`

function buildIssueFetchJql(projectKey: string): string {
  const key = projectKey.trim().toUpperCase() || DEFAULT_PROJECT_KEY
  return `project = ${key}\nAND issuetype in (defect, bug)\nAND status in ("MORE INFO", "ASSIGNED", "OPENED", "RESOLVE", "VERIFIED_SW", "DELIVERED", "VERIFIED", "CLOSED")\nAND summary !~ "MAIN2MP"\nAND summary !~ "MP2SMR"\nAND summary !~ "CloneMP"\nAND (resolution is EMPTY OR resolution not in ("Needn't Fixed", "Duplicate", "Duplicated"))`
}

function isGeneratedIssueFetchJql(jql: string, projectKey: string): boolean {
  return jql.trim() === buildIssueFetchJql(projectKey).trim()
}

function isLegacyBoundedIssueFetchJql(jql: string): boolean {
  const compact = jql.replace(/\s+/g, ' ').trim()
  return /^project\s*=\s*("?)[A-Za-z][A-Za-z0-9_]*\1\s+AND\s+issuetype\s+in\s*\(\s*defect\s*,\s*bug\s*\)\s+AND\s+created\s*>=\s*['"]?\d{4}-\d{2}-\d{2}['"]?\s+AND\s+created\s*(?:<=|<)\s*['"]?\d{4}-\d{2}-\d{2}['"]?$/i.test(compact)
}

function isLegacySimpleIssueFetchJql(jql: string): boolean {
  const compact = jql.replace(/\s+/g, ' ').trim()
  return /^project\s*=\s*("?)[A-Za-z][A-Za-z0-9_]*\1\s+AND\s+issuetype\s+in\s*\(\s*defect\s*,\s*bug\s*\)$/i.test(compact)
}

type JiraPageProps = {
  embedded?: boolean
}

export function JiraPage({ embedded = false }: JiraPageProps) {
  const [cachedProjects, setCachedProjects] = React.useState<ProjectSummary[]>([])
  const [projectKey, setProjectKey] = React.useState(DEFAULT_PROJECT_KEY)
  const [projectDisplayName, setProjectDisplayName] = React.useState('')
  const [showAdvanced, setShowAdvanced] = React.useState(false)
  const [pullMode, setPullMode] = React.useState<'jql' | 'projectStart'>('jql')
  const [startDate, setStartDate] = React.useState('2026-01-01')
  const [endDate, setEndDate] = React.useState('2026-06-30')
  const [jql, setJql] = React.useState(() => buildIssueFetchJql(DEFAULT_PROJECT_KEY))
  const [isFetching, setIsFetching] = React.useState(false)
  const [lastResult, setLastResult] = React.useState<JiraFetchResult | null>(null)
  const [isFormHydrated, setIsFormHydrated] = React.useState(false)
  const shouldSyncJqlWithProjectKey = React.useRef(true)
  const jiraConnection = useSettingsStore((s) => s.jiraConnection)
  const openProjectDetail = useProjectStore((s) => s.openProjectDetail)
  const openProjectHub = useProjectStore((s) => s.openProjectHub)
  const selectedProjects = useProjectStore((s) => s.selectedProjects)
  const setSelectedProjects = useProjectStore((s) => s.setSelectedProjects)
  const setFocusProject = useProjectStore((s) => s.setFocusProject)
  const startWeek = React.useMemo(() => toBusinessWeekLabel(startDate), [startDate])
  const endWeek = React.useMemo(() => toBusinessWeekLabel(endDate), [endDate])
  const jqlParsedProjectKey = React.useMemo(() => extractProjectKeyFromJql(jql), [jql])

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(JIRA_FETCH_FORM_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        projectKey?: unknown
        projectDisplayName?: unknown
        pullMode?: unknown
        startDate?: unknown
        endDate?: unknown
        jql?: unknown
      }
      const nextProjectKey =
        typeof parsed.projectKey === 'string' && parsed.projectKey.trim()
          ? parsed.projectKey.trim()
          : DEFAULT_PROJECT_KEY
      if (parsed.pullMode === 'jql' || parsed.pullMode === 'projectStart') {
        setPullMode(parsed.pullMode)
      }
      setProjectKey(nextProjectKey)
      if (typeof parsed.projectDisplayName === 'string') {
        setProjectDisplayName(parsed.projectDisplayName)
      }
      if (typeof parsed.startDate === 'string') {
        setStartDate(parsed.startDate)
      }
      if (typeof parsed.endDate === 'string') {
        setEndDate(parsed.endDate)
      }
      if (typeof parsed.jql === 'string') {
        const isLegacyGeneratedJql =
          parsed.jql.trim() === LEGACY_DEFAULT_JQL.trim() ||
          isLegacyBoundedIssueFetchJql(parsed.jql) ||
          isLegacySimpleIssueFetchJql(parsed.jql)
        const savedJql = isLegacyGeneratedJql ? buildIssueFetchJql(nextProjectKey) : parsed.jql
        setJql(savedJql)
        shouldSyncJqlWithProjectKey.current = isLegacyGeneratedJql || isGeneratedIssueFetchJql(savedJql, nextProjectKey)
      }
    } catch {
      // ignore malformed local cache
    } finally {
      setIsFormHydrated(true)
    }
  }, [])

  React.useEffect(() => {
    if (!isFormHydrated || !shouldSyncJqlWithProjectKey.current) return
    setJql(buildIssueFetchJql(projectKey))
  }, [isFormHydrated, projectKey])

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(JIRA_FETCH_LAST_RESULT_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<JiraFetchResult>
      if (!parsed || typeof parsed !== 'object') return
      if (typeof parsed.syncedAt !== 'string') return
      if (typeof parsed.status !== 'string') return
      if (typeof parsed.fetchedCount !== 'number') return
      if (typeof parsed.writtenCount !== 'number') return
      if (typeof parsed.cycleLabel !== 'string') return
      setLastResult({
        syncedAt: parsed.syncedAt,
        cycleLabel: parsed.cycleLabel,
        fetchedCount: parsed.fetchedCount,
        writtenCount: parsed.writtenCount,
        status: parsed.status === 'success' ? 'success' : 'failed',
        periodStart: typeof parsed.periodStart === 'string' ? parsed.periodStart : '',
        periodEnd: typeof parsed.periodEnd === 'string' ? parsed.periodEnd : '',
      })
    } catch {
      // ignore malformed local cache
    }
  }, [])

  React.useEffect(() => {
    if (!isFormHydrated) return
    try {
      const raw = localStorage.getItem(JIRA_FETCH_FORM_KEY)
      const prev = raw
        ? (JSON.parse(raw) as { projectKey?: unknown })
        : null
      const persistedProjectKey =
        projectKey.trim() ||
        (typeof prev?.projectKey === 'string' ? prev.projectKey.trim() : '') ||
        DEFAULT_PROJECT_KEY
      localStorage.setItem(
        JIRA_FETCH_FORM_KEY,
        JSON.stringify({
          projectKey: persistedProjectKey,
          projectDisplayName,
          pullMode,
          startDate,
          endDate,
          jql,
        }),
      )
    } catch {
      // ignore write failure
    }
  }, [isFormHydrated, projectKey, projectDisplayName, pullMode, startDate, endDate, jql])

  React.useEffect(() => {
    let cancelled = false
    void services.jiraService.listCachedProjects().then((rows) => {
      if (cancelled) return
      setCachedProjects(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const refreshCache = async () => {
    const rows = await services.jiraService.listCachedProjects()
    setCachedProjects(rows)
  }

  const persistLastResult = React.useCallback((res: JiraFetchResult) => {
    setLastResult(res)
    try {
      localStorage.setItem(JIRA_FETCH_LAST_RESULT_KEY, JSON.stringify(res))
    } catch {
      // ignore write failure
    }
  }, [])

  const resolvePeriodLabel = React.useCallback((res: JiraFetchResult | null): string => {
    if (!res) return '-'
    if (res.periodStart && res.periodEnd) {
      return `${new Date(res.periodStart).toLocaleString()} - ${new Date(res.periodEnd).toLocaleString()}`
    }
    return res.cycleLabel || '-'
  }, [])

  const finishSync = async (keyForRequest: string, res: JiraFetchResult, modeLabel: string) => {
    persistLastResult(res)
    const normalizedKey = keyForRequest.trim().toUpperCase()
    const existing =
      cachedProjects.find((project) => project.name.toUpperCase() === normalizedKey) ??
      (await services.projectService
        .listCachedProjects()
        .then((projects) => projects.find((project) => project.name.toUpperCase() === normalizedKey))
        .catch(() => undefined))
    await services.projectService.upsertCachedProjects([
      {
        ...existing,
        name: normalizedKey,
        displayName: projectDisplayName.trim() ? projectDisplayName.trim() : existing?.displayName,
        cycle: res.cycleLabel.replace(' - ', '-'),
        defects: res.fetchedCount,
        teams: Math.max(1, Math.round(res.fetchedCount / 200)),
        validStartDate: res.periodStart ? res.periodStart.slice(0, 10) : startDate || undefined,
        validEndDate: res.periodEnd ? res.periodEnd.slice(0, 10) : endDate || undefined,
      },
    ])
    await refreshCache()
    toast('同步成功', {
      description: `${modeLabel}，共同步 ${res.fetchedCount} 条 Defect`,
    })
  }

  const runFullSync = async () => {
    const keyForRequest = projectKey.trim().toUpperCase()
    if (!keyForRequest) {
      toast('同步失败', { description: '请填写项目 Key' })
      return
    }
    setIsFetching(true)
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
      await finishSync(keyForRequest, res, '已完成全量历史同步')
    } catch (e: unknown) {
      persistLastResult({
        syncedAt: new Date().toISOString(),
        cycleLabel: '',
        fetchedCount: 0,
        writtenCount: 0,
        status: 'failed',
        periodStart: '',
        periodEnd: '',
      })
      toast('同步失败', { description: e instanceof Error ? e.message : '服务调用失败' })
    } finally {
      setIsFetching(false)
    }
  }

  const runFetch = async (mode: 'normal' | 'incremental' | 'overwrite') => {
    if (pullMode === 'jql' && !jql.trim()) {
      toast('同步失败', { description: '请选择 JQL 模式并填写 JQL 条件' })
      return
    }
    const effectiveProjectKey = (jqlParsedProjectKey ?? projectKey).trim()
    if (pullMode === 'jql' && !effectiveProjectKey) {
      toast('同步失败', {
        description: 'JQL 中未识别到 project，请填写项目 Key，或在 JQL 中写明 project = KEY',
      })
      return
    }
    if (pullMode === 'projectStart') {
      if (!projectKey.trim()) {
        toast('同步失败', { description: '请填写项目 Key' })
        return
      }
      if (!startDate || !endDate) {
        toast('同步失败', { description: '请选择开始日期和结束日期' })
        return
      }
      if (startDate > endDate) {
        toast('同步失败', { description: '开始日期不能晚于结束日期' })
        return
      }
      if (!startWeek || !endWeek) {
        toast('同步失败', { description: '日期换算业务周失败，请检查日期格式' })
        return
      }
    }
    const keyForRequest = pullMode === 'jql' ? effectiveProjectKey : projectKey.trim()
    setIsFetching(true)
    try {
      const res = await services.jiraService.fetchByJql({
        projectKey: keyForRequest,
        startWeek: pullMode === 'projectStart' ? startWeek : '',
        endWeek: pullMode === 'projectStart' ? endWeek : '',
        pullMode,
        jql: pullMode === 'jql' ? jql : '',
        startDate: pullMode === 'projectStart' ? startDate : '',
        endDate: pullMode === 'projectStart' ? endDate : '',
        mode,
        ...jiraConnection,
      })
      await finishSync(
        keyForRequest,
        res,
        mode === 'normal' ? '高级模式同步完成' : mode === 'incremental' ? '高级模式增量同步完成' : '高级模式覆盖同步完成',
      )
    } catch (e: unknown) {
      persistLastResult({
        syncedAt: new Date().toISOString(),
        cycleLabel: '',
        fetchedCount: 0,
        writtenCount: 0,
        status: 'failed',
        periodStart: '',
        periodEnd: '',
      })
      toast('同步失败', { description: e instanceof Error ? e.message : '服务调用失败' })
    } finally {
      setIsFetching(false)
    }
  }

  const openCachedProject = React.useCallback(
    (name: string) => {
      const projectName = name.trim()
      if (!projectName) return
      setFocusProject(projectName)
      if (!selectedProjects.includes(projectName)) {
        setSelectedProjects(selectedProjects.length ? [...selectedProjects, projectName] : [projectName])
      } else if (!selectedProjects.length) {
        setSelectedProjects([projectName])
      }
      openProjectDetail(projectName)
    },
    [openProjectDetail, selectedProjects, setFocusProject, setSelectedProjects],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{embedded ? '导入项目' : 'JIRA 数据获取'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {embedded
              ? '导入主流程始终同步该项目全部历史 Defect，本地事实数据会被项目详情、Team 分析和模块分布统一复用。'
              : '主流程默认按项目 Key 同步全部历史 Defect；高级条件仅用于排障或调试。'}
          </p>
        </div>
        {embedded ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => openProjectHub('library')}>
              返回项目列表
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl xl:col-span-2">
          <CardHeader>
            <CardTitle>{embedded ? '项目全量导入' : '主流程：全量同步项目历史'}</CardTitle>
            <CardDescription>
              {embedded
                ? '导入完成后会自动写入项目库，并保留在当前页展示最近一次抓取结果。'
                : '项目库只保留一条 Jira 主入口：同步该项目全部历史 Defect 数据。'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>项目 Key</Label>
                <Input
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                  placeholder="例如 MNTNPOM"
                  className="rounded-2xl font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>{embedded ? '显示名称（推荐填写）' : '项目显示名称（推荐填写）'}</Label>
                <Input
                  value={projectDisplayName}
                  onChange={(e) => setProjectDisplayName(e.target.value)}
                  placeholder="例如：墨水屏项目 / 智能电视 App"
                  className="rounded-2xl"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              主流程会忽略日期范围和 JQL，直接拉取该项目全部历史 Defect，并统一写入本地原始 issue 数据层。
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-2xl" disabled={isFetching} onClick={() => void runFullSync()}>
                {embedded ? '同步并导入项目' : '同步全部历史'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                disabled={isFetching}
                onClick={() => setShowAdvanced((value) => !value)}
              >
                {showAdvanced ? '收起高级/调试入口' : '展开高级/调试入口'}
              </Button>
            </div>
            {showAdvanced ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  高级入口仅用于排障或临时验证，不建议作为常规导入方式。
                </div>
                <div className="space-y-2">
                  <Label>调试方式（二选一）</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={pullMode === 'jql' ? 'default' : 'outline'}
                      className="rounded-2xl"
                      onClick={() => setPullMode('jql')}
                    >
                      调试 JQL
                    </Button>
                    <Button
                      type="button"
                      variant={pullMode === 'projectStart' ? 'default' : 'outline'}
                      className="rounded-2xl"
                      onClick={() => setPullMode('projectStart')}
                    >
                      调试日期范围
                    </Button>
                  </div>
                </div>
                {pullMode === 'jql' ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>JQL 输入</Label>
                      <textarea
                        className="min-h-[140px] w-full rounded-2xl border bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                        value={jql}
                        onChange={(e) => {
                          shouldSyncJqlWithProjectKey.current = false
                          setJql(e.target.value)
                        }}
                      />
                    </div>
                    {jqlParsedProjectKey ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        已从 JQL 识别项目 Key（将用于存储与调试接口）：{' '}
                        <span className="font-mono font-medium">{jqlParsedProjectKey}</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>项目 Key（JQL 未包含 project 时必填）</Label>
                        <Input
                          value={projectKey}
                          onChange={(e) => setProjectKey(e.target.value)}
                          placeholder="例如 DVW"
                          className="rounded-2xl font-mono"
                        />
                        <p className="text-xs text-slate-500">
                          多项目 JQL（如 project in (A, B)）无法自动识别时，请手动填写用于落库与调试快照的项目 Key。
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <div className="space-y-2">
                        <Label>项目 Key</Label>
                        <Input value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>开始日期</Label>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>结束日期</Label>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>说明</Label>
                        <Input value="仅用于调试，不建议常规使用" readOnly />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>开始周期（自动换算）</Label>
                        <Input value={startWeek} readOnly />
                      </div>
                      <div className="space-y-2">
                        <Label>结束周期（自动换算）</Label>
                        <Input value={endWeek} readOnly />
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{embedded ? '显示名称（推荐填写）' : '项目显示名称（推荐填写）'}</Label>
                  <Input value={projectDisplayName} onChange={(e) => setProjectDisplayName(e.target.value)} className="rounded-2xl" />
                  <p className="text-xs text-slate-500">
                    该名称会作为项目库默认显示名，唯一标识仍然是项目 Key。
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    className="rounded-2xl"
                    disabled={isFetching}
                    title="仅用于调试当前筛选条件，不建议替代主流程导入。"
                    onClick={() => void runFetch('normal')}
                  >
                    执行高级同步
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    disabled={isFetching}
                    title="只补充高级条件命中的新数据。"
                    onClick={() => void runFetch('incremental')}
                  >
                    高级增量
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    disabled={isFetching}
                    title="按当前高级条件覆盖同步。"
                    onClick={() => void runFetch('overwrite')}
                  >
                    高级覆盖
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>抓取结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-slate-500">拉取时间</div>
              <div className="mt-1 font-medium">
                {lastResult ? new Date(lastResult.syncedAt).toLocaleString() : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">数量（Issue 条数）</div>
              <div className="mt-1 font-medium">
                {lastResult ? `${lastResult.fetchedCount} 条` : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">拉取状态</div>
              <div className="mt-1 font-medium">
                {lastResult ? (lastResult.status === 'success' ? '成功' : '失败') : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">周期（首个~最后一个 Defect 创建时间）</div>
              <div className="mt-1 font-medium">
                {resolvePeriodLabel(lastResult)}
              </div>
            </div>
            {isFetching ? <Progress value={60} /> : null}
            {isFetching ? <Badge className="rounded-xl">同步中</Badge> : null}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{embedded ? '项目库中的已导入项目' : '历史项目缓存'}</CardTitle>
          <CardDescription>{embedded ? '点击任一项目可直接打开项目详情。' : '给后续历史项目对比和相似项目识别使用'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>项目名称</TableHead>
                <TableHead>项目 Key</TableHead>
                <TableHead>周期</TableHead>
                <TableHead>Defect 数</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cachedProjects.map((p) => (
                <TableRow
                  key={p.name}
                  className="cursor-pointer hover:bg-slate-50"
                  role="button"
                  tabIndex={0}
                  onClick={() => openCachedProject(p.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openCachedProject(p.name)
                    }
                  }}
                >
                  <TableCell className="text-slate-700">{p.displayName?.trim() || '-'}</TableCell>
                  <TableCell className="font-medium text-sky-700 underline decoration-dotted underline-offset-2">
                    {p.name}
                  </TableCell>
                  <TableCell>{p.cycle}</TableCell>
                  <TableCell>{p.defects}</TableCell>
                  <TableCell>
                    <Badge variant="outline">已缓存</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
