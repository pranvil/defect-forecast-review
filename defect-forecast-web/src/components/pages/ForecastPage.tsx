import {
  AlertTriangle,
  Check,
  Database,
  FileSpreadsheet,
  History,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Kpi } from '@/components/common/Kpi'
import { ExcelTemplatePreview } from '@/components/excel-preview/ExcelTemplatePreview'
import { services } from '@/services'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useForecastStore } from '@/stores/forecastStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { ForecastVersionRow } from '@/services/forecastService'
import type { ProjectCompareResult } from '@/services/projectService'
import { isReviewMode } from '@/runtime/mode'
import { firstDayDateOfWeek } from '@/utils/week'

type ActualCompareMetricKey =
  | 'actualCreated'
  | 'forecastCreated'
  | 'actualFixed'
  | 'forecastFixed'
  | 'actualBacklog'
  | 'forecastBacklog'

type ActualCompareChartRow = {
  weekLabel: string
  date: string
} & Record<ActualCompareMetricKey, number | null>

const actualCompareMetricStyles: Record<ActualCompareMetricKey, { label: string; color: string; dash?: string }> = {
  actualCreated: { label: '实际 Created', color: '#2563eb' },
  forecastCreated: { label: '预测 Created', color: '#16a34a' },
  actualFixed: { label: '实际 Fixed', color: '#9333ea' },
  forecastFixed: { label: '预测 Fixed', color: '#d97706' },
  actualBacklog: { label: '实际 Backlog', color: '#0891b2', dash: '5 4' },
  forecastBacklog: { label: '预测 Backlog', color: '#65a30d', dash: '5 4' },
}

export function ForecastPage() {
  const params = useForecastStore((s) => s.params)
  const jiraConnection = useSettingsStore((s) => s.jiraConnection)
  const [error, setError] = React.useState('')
  const [versions, setVersions] = React.useState<ForecastVersionRow[]>([])
  const [projectFilter, setProjectFilter] = React.useState('__all__')
  const [versionId, setVersionId] = React.useState('')
  const [actualProjectKey, setActualProjectKey] = React.useState('')
  const [actualCompare, setActualCompare] = React.useState<ProjectCompareResult | null>(null)
  const [actualCompareError, setActualCompareError] = React.useState('')
  const [isPullingActual, setIsPullingActual] = React.useState(false)
  const [actualChartType, setActualChartType] = React.useState<'bar' | 'line'>('bar')
  const [actualVisible, setActualVisible] = React.useState<Record<ActualCompareMetricKey, boolean>>({
    actualCreated: true,
    forecastCreated: true,
    actualFixed: false,
    forecastFixed: false,
    actualBacklog: false,
    forecastBacklog: false,
  })

  const refreshVersions = React.useCallback(() => {
    return services.forecastService.listForecastVersions().then((rows) => {
      setVersions(rows)
      setVersionId((current) => {
        if (current && rows.some((row) => row.id === current)) return current
        const preferred = rows.find((row) => row.projectName === params.newProjectName)
        return (preferred ?? rows[0])?.id ?? ''
      })
    })
  }, [params.newProjectName])

  React.useEffect(() => {
    setError('')
    void refreshVersions().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : '预测版本加载失败')
    })
  }, [refreshVersions])

  const projectOptions = React.useMemo(
    () => Array.from(new Set(versions.map((row) => row.projectName))).sort((a, b) => a.localeCompare(b)),
    [versions],
  )
  const displayedVersions = React.useMemo(
    () => versions.filter((row) => projectFilter === '__all__' || row.projectName === projectFilter),
    [projectFilter, versions],
  )
  const selectedVersion = React.useMemo(
    () => versions.find((row) => row.id === versionId) ?? displayedVersions[0] ?? versions[0],
    [displayedVersions, versionId, versions],
  )
  const result = selectedVersion?.result ?? null

  React.useEffect(() => {
    if (!displayedVersions.length) return
    if (displayedVersions.some((row) => row.id === versionId)) return
    setVersionId(displayedVersions[0]!.id)
  }, [displayedVersions, versionId])

  const deleteForecastVersion = React.useCallback(
    (row: ForecastVersionRow) => {
      if (!window.confirm(`确认删除预测版本 ${row.projectName} · ${row.id.slice(0, 8)} 吗？`)) return
      void services.forecastService
        .deleteForecastVersion(row.id)
        .then(() => {
          toast('已删除版本')
          return refreshVersions()
        })
        .catch((e: unknown) => {
          toast('删除失败', {
            description: e instanceof Error ? e.message : '服务调用失败',
          })
        })
    },
    [refreshVersions],
  )

  const loadActualCompare = React.useCallback(
    async (projectKey: string, selectedForecastVersionId = selectedVersion?.id) => {
      const key = projectKey.trim().toUpperCase()
      if (!key || !selectedForecastVersionId) {
        setActualCompare(null)
        return null
      }
      const compare = await services.projectService.getProjectCompare(key, selectedForecastVersionId)
      setActualCompare(compare)
      return compare
    },
    [selectedVersion?.id],
  )

  React.useEffect(() => {
    let cancelled = false
    const key = actualProjectKey.trim()
    if (!key || !selectedVersion?.id) {
      setActualCompare(null)
      setActualCompareError('')
      return () => {
        cancelled = true
      }
    }
    setActualCompareError('')
    void services.projectService
      .getProjectCompare(key.toUpperCase(), selectedVersion.id)
      .then((compare) => {
        if (cancelled) return
        setActualCompare(compare)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setActualCompare(null)
        setActualCompareError(e instanceof Error ? e.message : '实际数据对比加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [actualProjectKey, selectedVersion?.id])

  const pullActualProjectData = React.useCallback(async () => {
    const key = actualProjectKey.trim().toUpperCase()
    if (!key) {
      toast('请输入 Jira Project Key')
      return
    }
    if (!selectedVersion?.id) {
      toast('请先选择预测版本')
      return
    }
    setIsPullingActual(true)
    setActualCompareError('')
    try {
      const res = await services.jiraService.fetchByJql({
        projectKey: key,
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
          name: key,
          displayName: selectedVersion.projectName,
          cycle: res.cycleLabel.replace(' - ', '-'),
          defects: res.fetchedCount,
          teams: Math.max(1, Math.round(res.fetchedCount / 200)),
        },
      ])
      await loadActualCompare(key, selectedVersion.id)
      toast('实际数据已更新', { description: `${key} 共拉取 ${res.fetchedCount} 条 Defect` })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Jira 实际数据拉取失败'
      setActualCompareError(message)
      toast('实际数据拉取失败', { description: message })
    } finally {
      setIsPullingActual(false)
    }
  }, [actualProjectKey, jiraConnection, loadActualCompare, selectedVersion])

  const actualCompareRows = React.useMemo<ActualCompareChartRow[]>(
    () =>
      (actualCompare?.weekly ?? []).map((row) => ({
        weekLabel: row.weekLabel,
        date: firstDayDateOfWeek(row.weekLabel),
        actualCreated: row.jiraCreated,
        forecastCreated: row.forecastCreated,
        actualFixed: row.jiraFixed,
        forecastFixed: row.forecastFixed,
        actualBacklog: row.backlogJira,
        forecastBacklog: row.backlogForecast,
      })),
    [actualCompare],
  )

  const renderActualCompareSeries = React.useCallback(
    (key: ActualCompareMetricKey) => {
      if (!actualVisible[key]) return null
      const style = actualCompareMetricStyles[key]
      if (actualChartType === 'bar') {
        return <Bar key={key} dataKey={key} name={style.label} fill={style.color} radius={[3, 3, 0, 0]} maxBarSize={28} />
      }
      const isBacklog = key === 'actualBacklog' || key === 'forecastBacklog'
      return (
        <Line
          key={key}
          type={isBacklog ? 'linear' : 'monotone'}
          dataKey={key}
          name={style.label}
          stroke={style.color}
          strokeWidth={3}
          strokeDasharray={style.dash}
          dot={isBacklog ? { r: 4, strokeWidth: 2, fill: '#fff' } : false}
          activeDot={isBacklog ? { r: 6 } : undefined}
        >
          {isBacklog ? <LabelList dataKey={key} position="top" fontSize={11} fill="#334155" /> : null}
        </Line>
      )
    },
    [actualChartType, actualVisible],
  )

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">预测结果</h2>
          <p className="mt-1 text-sm text-rose-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">预测结果</h2>
            <p className="mt-1 text-sm text-slate-500">管理在“新项目预测”页保存过的所有预测版本。</p>
          </div>
          <select
            className="h-9 rounded-xl border px-3 text-sm"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="__all__">全部项目</option>
            {projectOptions.map((project) => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
        </div>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>预测版本记录</CardTitle>
          </CardHeader>
          <CardContent>
            {displayedVersions.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>项目</TableHead>
                    <TableHead>版本ID</TableHead>
                    <TableHead>周期</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedVersions.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.projectName}</TableCell>
                      <TableCell className="font-mono text-xs">{v.id}</TableCell>
                      <TableCell>{v.cycle}</TableCell>
                      <TableCell>{v.note || '-'}</TableCell>
                      <TableCell>{new Date(v.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-xl px-3"
                            onClick={() => setVersionId(v.id)}
                          >
                            查看
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-xl px-3"
                            onClick={() => deleteForecastVersion(v)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-slate-500">暂无保存的预测结果。</div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const dataset = result.dataset
  const finalRow = dataset.weekly[dataset.weekly.length - 1]!
  const estimatedDefects = result.estimatedDefects ?? finalRow.cumCreated
  const trendRows: ActualCompareChartRow[] = actualCompareRows.length
    ? actualCompareRows
    : dataset.weekly.map((row) => ({
        weekLabel: row.weekLabel,
        date: row.date || firstDayDateOfWeek(row.weekLabel),
        actualCreated: null,
        forecastCreated: row.created,
        actualFixed: null,
        forecastFixed: row.fixed,
        actualBacklog: null,
        forecastBacklog: row.backlog,
      }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="text-2xl font-semibold">预测结果</h2>
          <p className="mt-1 text-sm text-slate-500">查看和管理已保存的预测版本，并与新项目 Jira 实际数据对比。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            className="h-10 rounded-2xl border px-3 text-sm"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="__all__">全部项目</option>
            {projectOptions.map((project) => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
          <select
            className="h-10 max-w-[280px] rounded-2xl border px-3 text-sm"
            value={selectedVersion?.id ?? ''}
            onChange={(e) => setVersionId(e.target.value)}
          >
            {displayedVersions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.projectName} · {v.cycle} · {v.note || v.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            disabled={!selectedVersion}
            onClick={() => {
              if (selectedVersion) deleteForecastVersion(selectedVersion)
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除当前版本
          </Button>
          <Button
            type="button"
            className="rounded-2xl"
            disabled={isReviewMode}
            onClick={() => {
              if (isReviewMode) {
                toast('评审版暂未开放', { description: 'Excel 导出在评审版中已禁用' })
                return
              }
              void services.exportService
                .exportForecastToExcel({
                  projectName: selectedVersion?.projectName ?? params.newProjectName,
                  dataset,
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title="预估 Bug 总数"
          value={estimatedDefects}
          sub={result.baseValue ? `Base ${result.baseValue}` : selectedVersion?.projectName ?? params.newProjectName}
          icon={Sparkles}
        />
        <Kpi
          title="预测总 Fixed"
          value={finalRow.cumFixed}
          sub={selectedVersion?.cycle ?? `${params.startWeek} - ${params.endWeek}`}
          icon={Database}
        />
        <Kpi title="最终 Backlog" value={finalRow.backlog} sub="累计创建 - 累计解决" icon={History} />
        <Kpi
          title="参考项目数"
          value={result.referenceProjects?.length ?? 0}
          sub="相似度 Top 3 / 手工确认"
          icon={Wand2}
        />
      </div>

      {!!result.warnings?.length && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              预测约束提醒
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-900">
            {result.warnings.map((warning, index) => (
              <div key={`${warning.type}-${warning.milestone ?? ''}-${index}`}>
                {warning.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6">
        <Card className="rounded-2xl">
          <Tabs value={actualChartType} onValueChange={(value) => setActualChartType(value === 'line' ? 'line' : 'bar')} className="w-full">
            <CardHeader className="flex flex-col gap-4 pb-2">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Created / Fixed / Backlog 预测趋势</CardTitle>
                  <CardDescription>
                    输入新项目 Jira Project Key 拉取实际数据，在同一张图里对比实际与预测偏差。
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="h-10 w-[220px] rounded-xl"
                    value={actualProjectKey}
                    onChange={(e) => setActualProjectKey(e.target.value)}
                    placeholder="Jira Project Key"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={isPullingActual || !selectedVersion?.id}
                    onClick={() => void pullActualProjectData()}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isPullingActual ? 'animate-spin' : ''}`} />
                    拉取实际数据
                  </Button>
                  <TabsList className="rounded-2xl">
                    <TabsTrigger value="bar">柱状图</TabsTrigger>
                    <TabsTrigger value="line">折线图</TabsTrigger>
                  </TabsList>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Kpi
                  title="实际累计 Created"
                  value={actualCompare?.metrics.totalJiraCreated ?? 0}
                  sub={actualProjectKey.trim() ? actualProjectKey.trim().toUpperCase() : '请输入 Jira Key'}
                  icon={Database}
                />
                <Kpi
                  title="预测累计 Created"
                  value={actualCompare?.metrics.totalForecastCreated ?? estimatedDefects}
                  sub={selectedVersion ? `版本 ${selectedVersion.id.slice(0, 8)}` : '未选择版本'}
                  icon={Sparkles}
                />
                <Kpi
                  title="Created 偏差"
                  value={actualCompare ? actualCompare.metrics.jiraVsForecastGap : 0}
                  sub="实际 - 预测"
                  icon={History}
                />
              </div>
              {actualCompareError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {actualCompareError}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {(Object.keys(actualCompareMetricStyles) as ActualCompareMetricKey[]).map((key) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant="outline"
                    className={`rounded-lg ${actualVisible[key] ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
                    onClick={() => setActualVisible((current) => ({ ...current, [key]: !current[key] }))}
                  >
                    {actualVisible[key] ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
                    <span
                      className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: actualCompareMetricStyles[key].color }}
                    />
                    {actualCompareMetricStyles[key].label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="h-[380px]">
              <TabsContent value="line" className="mt-0 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendRows} margin={{ bottom: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weekLabel" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {(Object.keys(actualCompareMetricStyles) as ActualCompareMetricKey[]).map(renderActualCompareSeries)}
                  </ComposedChart>
                </ResponsiveContainer>
              </TabsContent>
              <TabsContent value="bar" className="mt-0 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendRows} margin={{ bottom: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weekLabel" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {(Object.keys(actualCompareMetricStyles) as ActualCompareMetricKey[]).map(renderActualCompareSeries)}
                  </ComposedChart>
                </ResponsiveContainer>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

      </div>

      <Tabs defaultValue="weekly" className="w-full">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="weekly">按周结果</TabsTrigger>
          <TabsTrigger value="team">开发/测试拆分</TabsTrigger>
          <TabsTrigger value="versions">预测版本</TabsTrigger>
          <TabsTrigger value="excel">Excel 模板预览</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="mt-4">
          <Card className="rounded-2xl">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>周期</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Fixed</TableHead>
                    <TableHead>累计创建</TableHead>
                    <TableHead>累计解决</TableHead>
                    <TableHead>Backlog</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.weekly.map((r) => (
                    <TableRow key={r.week}>
                      <TableCell className="font-medium">{r.weekLabel}</TableCell>
                      <TableCell>{r.created}</TableCell>
                      <TableCell>{r.fixed}</TableCell>
                      <TableCell>{r.cumCreated}</TableCell>
                      <TableCell>{r.cumFixed}</TableCell>
                      <TableCell>{r.backlog}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>预测版本记录</CardTitle>
              <CardDescription>用于后续与新项目 Jira 实际数据做偏差分析</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>项目</TableHead>
                    <TableHead>版本ID</TableHead>
                    <TableHead>周期</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedVersions.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.projectName}</TableCell>
                      <TableCell className="font-mono text-xs">{v.id}</TableCell>
                      <TableCell>{v.cycle}</TableCell>
                      <TableCell>{v.note || '-'}</TableCell>
                      <TableCell>{new Date(v.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-xl px-3"
                            onClick={() => {
                              if (!v.result) {
                                toast('该版本没有结果数据')
                                return
                              }
                              setVersionId(v.id)
                            }}
                          >
                            查看
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-xl px-3"
                            onClick={() => deleteForecastVersion(v)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!displayedVersions.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-slate-500">
                        暂无版本记录
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>测试团队</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>团队</TableHead>
                      <TableHead>预测 Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataset.createdTeams
                      .filter((x) => x.group === '测试团队')
                      .map((r) => (
                        <TableRow key={r.team}>
                          <TableCell className="font-medium">{r.team}</TableCell>
                          <TableCell>{r.values.reduce((a, b) => a + b, 0)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>开发团队</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>团队</TableHead>
                      <TableHead>预测 Fixed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataset.fixedTeams
                      .filter((x) => x.group === '开发团队')
                      .map((r) => (
                        <TableRow key={r.team}>
                          <TableCell className="font-medium">{r.team}</TableCell>
                          <TableCell>{r.values.reduce((a, b) => a + b, 0)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="excel" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Excel 模板预览</CardTitle>
              <CardDescription>
                这里按你提供的模板结构做了更接近的预览。最终导出时会以模板文件为准，尽量做到完全一致。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExcelTemplatePreview
                projectName={params.newProjectName}
                dataset={dataset}
                milestoneTargetMode={params.milestoneTargetMode ?? 'currentWeek'}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
