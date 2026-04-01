import {
  BarChart3,
  Database,
  FileSpreadsheet,
  History,
  Search,
  Sparkles,
} from 'lucide-react'
import * as React from 'react'
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
import { services } from '@/services'
import type { ProjectHistory } from '@/types/project'
import type { ProjectSummary } from '@/services/projectService'
import { useProjectStore } from '@/stores/projectStore'

export function HistoryPage() {
  const selectedProjects = useProjectStore((s) => s.selectedProjects)
  const focusProject = useProjectStore((s) => s.focusProject)
  const setFocusProject = useProjectStore((s) => s.setFocusProject)
  const toggleSelectedProject = useProjectStore((s) => s.toggleSelectedProject)

  const [projects, setProjects] = React.useState<ProjectSummary[]>([])
  const [compareData, setCompareData] = React.useState<Record<string, string | number>[]>([])
  const [compareColors, setCompareColors] = React.useState<string[]>([])
  const [focusDataset, setFocusDataset] = React.useState<ProjectHistory | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void services.projectService.listCachedProjects().then((rows) => {
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
  }, [])

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
    void services.projectService.getProjectHistory(focusProject).then((p) => {
      if (cancelled) return
      setFocusDataset(p)
    })
    return () => {
      cancelled = true
    }
  }, [focusProject])

  const focus = focusDataset
  if (!focus) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">历史项目</h2>
          <p className="mt-1 text-sm text-slate-500">加载中...</p>
        </div>
      </div>
    )
  }

  const lastWeekly = focus.weekly.at(-1)
  const backlogPeak = Math.max(...focus.weekly.map((x) => x.backlog))
  const teamDistribution = (focus.createdTeams ?? [])
    .map((t) => ({
      team: t.team,
      created: t.values.reduce((a, b) => a + b, 0),
    }))
    .slice(0, 6)

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
          <Button variant="outline" className="rounded-2xl">
            <Search className="mr-2 h-4 w-4" />
            筛选项目
          </Button>
          <Button className="rounded-2xl">
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
            {projects.map((p) => (
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
          <CardTitle>Excel 预览</CardTitle>
          <CardDescription>
            当前展示项目：{focusProject}。这个预览会尽量贴近你的模板结构，最终导出按模板文件落地。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExcelTemplatePreview projectName={focusProject} dataset={focus} />
        </CardContent>
      </Card>
    </div>
  )
}
