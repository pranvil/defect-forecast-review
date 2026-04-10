import { BarChart3, Database, FileSpreadsheet, Filter, History, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import {
  CartesianGrid,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { services } from '@/services'
import type { ProjectHistory } from '@/types/project'
import type { ProjectCompareResult, ProjectSummary } from '@/services/projectService'
import { useProjectStore } from '@/stores/projectStore'

export function HistoryPage() {
  const selectedProjects = useProjectStore((s) => s.selectedProjects)
  const setSelectedProjects = useProjectStore((s) => s.setSelectedProjects)
  const focusProject = useProjectStore((s) => s.focusProject)
  const setFocusProject = useProjectStore((s) => s.setFocusProject)
  const toggleSelectedProject = useProjectStore((s) => s.toggleSelectedProject)

  const [projects, setProjects] = React.useState<ProjectSummary[]>([])
  const [compareData, setCompareData] = React.useState<Record<string, string | number>[]>([])
  const [compareColors, setCompareColors] = React.useState<string[]>([])
  const [focusDataset, setFocusDataset] = React.useState<ProjectHistory | null>(null)
  const [projectFilter, setProjectFilter] = React.useState('')
  const [projectCompare, setProjectCompare] = React.useState<ProjectCompareResult | null>(null)
  const [versionId, setVersionId] = React.useState('')
  const [forecastVersions, setForecastVersions] = React.useState<{ id: string; createdAt: string }[]>([])
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
    let cancelled = false
    void services.projectService.buildCreatedCompareData(selectedProjects).then((rows) => {
      if (cancelled) return
      setCompareData(rows)
    })
    return () => {
      cancelled = true
    }
  }, [selectedProjects])

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

  const lastWeekly = safeWeekly.at(-1)
  const backlogPeak = safeWeekly.length ? Math.max(...safeWeekly.map((x) => x.backlog)) : 0
  const teamDistribution = (focus?.createdTeams ?? [])
    .map((t) => ({
      team: t.team,
      created: t.values.reduce((a, b) => a + b, 0),
    }))
    .slice(0, 6)
  const focusWeekLabels = safeWeekly.map((x) => x.weekLabel)
  const teamWeeklyRows = [
    ...(focus?.createdTeams ?? []).map((t) => ({
      team: t.team,
      group: '测试提报',
      values: t.values,
      total: t.values.reduce((a, b) => a + b, 0),
    })),
    ...(focus?.fixedTeams ?? []).map((t) => ({
      team: t.team,
      group: '开发解决',
      values: t.values,
      total: t.values.reduce((a, b) => a + b, 0),
    })),
  ].sort((a, b) => b.total - a.total)
  const visibleProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectFilter.trim().toLowerCase()),
  )
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
        <CardHeader>
          <CardTitle>项目选择</CardTitle>
          <CardDescription>
            可多选做趋势对比，点击“设为当前查看项目”切换右侧详细信息和 Excel 预览。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {visibleProjects.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border px-4 py-3 ${
                  selectedProjects.includes(p.name)
                    ? 'bg-slate-900 text-white'
                    : 'bg-white'
                }`}
              >
                <div className="font-medium">{p.name}</div>
                <div
                  className={`mt-1 text-xs ${
                    selectedProjects.includes(p.name) ? 'text-slate-200' : 'text-slate-500'
                  }`}
                >
                  {p.cycle}
                </div>
                <div className="mt-3 flex gap-2">
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
                    onClick={() => setFocusProject(p.name)}
                  >
                    设为当前查看项目
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
          <CardDescription>解决时间仅按字段映射中的 verified 时间（如 customfield_13228 / last time to set verified_sw）统计</CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={safeWeekly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="weekLabel" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" name="每周创建" stroke="#0f172a" dot={false} />
              <Line type="monotone" dataKey="fixed" name="每周解决" stroke="#16a34a" dot={false} />
            </LineChart>
          </ResponsiveContainer>
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
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projectCompare.weekly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weekLabel" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="historyCreated" name="历史 Created" stroke="#0f172a" dot={false} />
                    <Line type="monotone" dataKey="jiraCreated" name="JIRA Created" stroke="#0284c7" dot={false} />
                    <Line type="monotone" dataKey="forecastCreated" name="预测 Created" stroke="#16a34a" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">当前项目暂无可对比数据</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="rounded-2xl xl:col-span-3">
          <CardHeader>
            <CardTitle>历史项目趋势对比</CardTitle>
            <CardDescription>多个项目同图对比，线条颜色区分不同项目</CardDescription>
          </CardHeader>
          <CardContent className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                {selectedProjects.map((project, idx) => (
                  <Line
                    key={project}
                    type="monotone"
                    dataKey={project}
                    stroke={compareColors[idx % Math.max(1, compareColors.length)] ?? '#0f172a'}
                    strokeWidth={2.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl xl:col-span-2">
          <CardHeader>
            <CardTitle>{focusProject} 团队分布</CardTitle>
          </CardHeader>
          <CardContent className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamDistribution} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="team" width={120} />
                <Tooltip />
                <Bar dataKey="created" fill="#0f172a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

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
                      <TableCell>{row.total}</TableCell>
                      {focusWeekLabels.map((_, idx) => (
                        <TableCell key={`${row.group}-${row.team}-${idx}`}>{row.values[idx] ?? 0}</TableCell>
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
        <CardHeader>
          <CardTitle>Excel 预览</CardTitle>
          <CardDescription>
            当前展示项目：{focusProject}。这个预览会尽量贴近你的模板结构，最终导出按模板文件落地。
          </CardDescription>
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
