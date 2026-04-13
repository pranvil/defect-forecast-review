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
const DEFAULT_PROJECT_KEY = 'MNTNPOM'

export function JiraPage() {
  const [cachedProjects, setCachedProjects] = React.useState<ProjectSummary[]>([])
  const [projectKey, setProjectKey] = React.useState(DEFAULT_PROJECT_KEY)
  const [projectDisplayName, setProjectDisplayName] = React.useState('')
  const [pullMode, setPullMode] = React.useState<'jql' | 'projectStart'>('jql')
  const [startDate, setStartDate] = React.useState('2026-01-01')
  const [endDate, setEndDate] = React.useState('2026-06-30')
  const [jql, setJql] = React.useState(
    `project = MNTNPOM\nAND issuetype in (defect, defect_new)\nAND created >= 2026-01-01\nAND created < 2026-07-01`,
  )
  const [isFetching, setIsFetching] = React.useState(false)
  const [lastResult, setLastResult] = React.useState<JiraFetchResult | null>(null)
  const [isFormHydrated, setIsFormHydrated] = React.useState(false)
  const jiraConnection = useSettingsStore((s) => s.jiraConnection)
  const setActiveSection = useProjectStore((s) => s.setActiveSection)
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
      if (parsed.pullMode === 'jql' || parsed.pullMode === 'projectStart') {
        setPullMode(parsed.pullMode)
      }
      if (typeof parsed.projectKey === 'string' && parsed.projectKey.trim()) {
        setProjectKey(parsed.projectKey.trim())
      }
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
        setJql(parsed.jql)
      }
    } catch {
      // ignore malformed local cache
    } finally {
      setIsFormHydrated(true)
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
      setLastResult(res)

      await services.projectService.upsertCachedProjects([
        {
          name: keyForRequest,
          displayName: projectDisplayName.trim() ? projectDisplayName.trim() : undefined,
          cycle: res.cycleLabel.replace(' - ', '-'),
          defects: res.fetchedCount,
          teams: Math.max(1, Math.round(res.fetchedCount / 200)),
        },
      ])
      await refreshCache()

      toast('同步成功', {
        description:
          mode === 'normal'
            ? `抓取 ${res.fetchedCount} 条`
            : mode === 'incremental'
              ? `增量更新 ${res.fetchedCount} 条`
              : `覆盖重拉 ${res.fetchedCount} 条`,
      })
    } catch (e: unknown) {
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
      setActiveSection('history')
    },
    [selectedProjects, setActiveSection, setFocusProject, setSelectedProjects],
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">JIRA 数据获取</h2>
        <p className="mt-1 text-sm text-slate-500">
          可使用两种拉取方式：直接 JQL，或按项目 Key + 日期范围拉取。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl xl:col-span-2">
          <CardHeader>
            <CardTitle>拉数条件</CardTitle>
            <CardDescription>请选择一种方式拉取 Jira 数据，避免混用条件造成歧义</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2 md:col-span-3">
                <Label>拉取方式（二选一）</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={pullMode === 'jql' ? 'default' : 'outline'}
                    className="rounded-2xl"
                    onClick={() => setPullMode('jql')}
                  >
                    方式一：JQL
                  </Button>
                  <Button
                    type="button"
                    variant={pullMode === 'projectStart' ? 'default' : 'outline'}
                    className="rounded-2xl"
                    onClick={() => setPullMode('projectStart')}
                  >
                    方式二：项目 Key + 日期范围
                  </Button>
                </div>
              </div>
            </div>
            {pullMode === 'jql' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>JQL 输入</Label>
                  <textarea
                    className="min-h-[140px] w-full rounded-2xl border bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    value={jql}
                    onChange={(e) => setJql(e.target.value)}
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
                <div className="space-y-2">
                  <Label>项目名称（可选，用于展示）</Label>
                  <Input
                    value={projectDisplayName}
                    onChange={(e) => setProjectDisplayName(e.target.value)}
                    placeholder="例如：墨水屏项目 / 智能电视 App"
                    className="rounded-2xl"
                  />
                  <p className="text-xs text-slate-500">
                    该字段仅用于界面展示，便于区分项目；唯一标识仍以项目 Key 为准。
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>项目 Key</Label>
                    <Input value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>项目名称（可选，用于展示）</Label>
                    <Input value={projectDisplayName} onChange={(e) => setProjectDisplayName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>开始日期</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>结束日期</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
                <div className="text-xs text-slate-500">
                  W1 为每年 1 月 1 日到当周周日；第二周起每周固定从周一开始。
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                className="rounded-2xl"
                disabled={isFetching}
                title="用本轮 Jira 结果覆盖「本次拉取条件所涉及的业务周」在库中的数据；其它周保持不变。适合同步到最新。"
                onClick={() => void runFetch('normal')}
              >
                抓取数据
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                disabled={isFetching}
                title="只补充库中尚不存在的业务周；已有周不覆盖、不刷新。按项目+日期拉取时也会跳过已有周以减少请求。"
                onClick={() => void runFetch('incremental')}
              >
                增量更新
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                disabled={isFetching}
                title="清空该项目在库内的全部 Jira 周数据，再仅写入本次拉取结果中出现的周。慎用。"
                onClick={() => void runFetch('overwrite')}
              >
                覆盖重拉
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>抓取结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-slate-500">最近一次同步</div>
              <div className="mt-1 font-medium">
                {lastResult ? new Date(lastResult.syncedAt).toLocaleString() : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">周期</div>
              <div className="mt-1 font-medium">
                {lastResult ? lastResult.cycleLabel : `${startWeek} - ${endWeek}`}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">本次抓取（Issue 条数）</div>
              <div className="mt-1 font-medium">
                {lastResult ? `${lastResult.fetchedCount} 条` : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">涉及业务周（聚合后写入/更新的周行数）</div>
              <div className="mt-1 font-medium">
                {lastResult ? `${lastResult.writtenCount} 周` : '-'}
              </div>
            </div>
            <Progress value={isFetching ? 60 : lastResult?.status === 'success' ? 100 : 0} />
            <Badge className="rounded-xl">
              {isFetching ? '同步中' : lastResult?.status === 'success' ? '同步成功' : '未同步'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>历史项目缓存</CardTitle>
          <CardDescription>给后续历史项目对比和相似项目识别使用</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>项目名称</TableHead>
                <TableHead>项目 Key</TableHead>
                <TableHead>周期</TableHead>
                <TableHead>Defect 数</TableHead>
                <TableHead>团队数</TableHead>
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
                  <TableCell>{p.teams}</TableCell>
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
