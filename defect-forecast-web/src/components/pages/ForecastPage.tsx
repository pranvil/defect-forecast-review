import { Database, Download, FileSpreadsheet, History, Sparkles, Wand2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
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
import { useTeamStore } from '@/stores/teamStore'
import type { ForecastResult } from '@/services/forecastService'
import { isReviewMode } from '@/runtime/mode'

export function ForecastPage() {
  const params = useForecastStore((s) => s.params)
  const refProjects = useForecastStore((s) => s.refProjects)
  const milestones = useForecastStore((s) => s.milestones)
  const teams = useTeamStore((s) => s.teams)

  const enabledTestingTeams = React.useMemo(() => {
    return teams.filter((t) => t.enabled && t.type === 'testing').map((t) => t.name)
  }, [teams])

  const enabledDevTeams = React.useMemo(() => {
    return teams
      .filter((t) => t.enabled && t.type === 'development')
      .map((t) => t.name)
  }, [teams])

  const [result, setResult] = React.useState<ForecastResult | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void services.forecastService
      .getForecastResult({
        params,
        enabledTestingTeams,
        enabledDevTeams,
        milestones,
        refProjects,
      })
      .then((r) => {
        if (cancelled) return
        setResult(r)
      })
    return () => {
      cancelled = true
    }
  }, [params, enabledTestingTeams, enabledDevTeams, milestones, refProjects])

  if (!result) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">预测结果</h2>
          <p className="mt-1 text-sm text-slate-500">加载中...</p>
        </div>
      </div>
    )
  }

  const dataset = result.dataset
  const teamSummary = result.teamSummary
  const finalRow = dataset.weekly[dataset.weekly.length - 1]!

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="text-2xl font-semibold">预测结果</h2>
          <p className="mt-1 text-sm text-slate-500">
            点击“开始预测”后跳转到这里。结果页重点展示总量、趋势、开发/测试两大类拆分，以及按模板导出的 Excel 预览。
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            onClick={() => toast('本轮未实现', { description: '保存预测记录 Coming soon' })}
          >
            <Download className="mr-2 h-4 w-4" />
            保存预测记录
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
                  projectName: params.newProjectName,
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
          title="预测总 Created"
          value={finalRow.cumCreated}
          sub={params.newProjectName}
          icon={Sparkles}
        />
        <Kpi
          title="预测总 Fixed"
          value={finalRow.cumFixed}
          sub={`${params.startWeek} - ${params.endWeek}`}
          icon={Database}
        />
        <Kpi title="最终 Backlog" value={finalRow.backlog} sub="累计创建 - 累计解决" icon={History} />
        <Kpi
          title="参考项目数"
          value={refProjects.length}
          sub="自动识别 + 手工补充"
          icon={Wand2}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="rounded-2xl xl:col-span-3">
          <CardHeader>
            <CardTitle>Created / Fixed / Backlog 预测趋势</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dataset.weekly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="weekLabel" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="created"
                  stroke="#0284c7"
                  fill="#7dd3fc"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="fixed"
                  stroke="#16a34a"
                  fill="#86efac"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="backlog"
                  stroke="#0f172a"
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl xl:col-span-2">
          <CardHeader>
            <CardTitle>开发 / 测试两大类拆分</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamSummary}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="group" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="created" fill="#0284c7" />
                <Bar dataKey="fixed" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="weekly" className="w-full">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="weekly">按周结果</TabsTrigger>
          <TabsTrigger value="team">开发/测试拆分</TabsTrigger>
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
              <ExcelTemplatePreview projectName={params.newProjectName} dataset={dataset} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
