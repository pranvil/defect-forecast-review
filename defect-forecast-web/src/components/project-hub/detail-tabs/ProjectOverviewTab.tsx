import { BarChart3, Database, History, Sparkles } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Kpi } from '@/components/common/Kpi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TabsContent } from '@/components/ui/tabs'
import { TeamAxisTick } from '@/components/project-hub/detail-tabs/shared'

type TopTeamDistributionRow = {
  team: string
  total: number
  group: string
}

type ProjectOverviewTabProps = {
  focusProjectLabel: string
  lastWeekly?: {
    cumCreated: number
    cumFixed: number
    backlog: number
  }
  analysisRangeSummary: {
    created: number
    fixed: number
    backlog: number
    backlogPeak: number
  }
  backlogPeak: number
  topTeamDistribution: TopTeamDistributionRow[]
}

export function ProjectOverviewTab({
  focusProjectLabel,
  lastWeekly,
  analysisRangeSummary,
  backlogPeak,
  topTeamDistribution,
}: ProjectOverviewTabProps) {
  return (
    <TabsContent value="overview" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title="当前时间范围 Created"
          value={analysisRangeSummary.created}
          sub={`项目总量 ${lastWeekly?.cumCreated ?? 0}`}
          icon={Database}
        />
        <Kpi
          title="当前时间范围 Fixed"
          value={analysisRangeSummary.fixed}
          sub={`项目总量 ${lastWeekly?.cumFixed ?? 0}`}
          icon={Sparkles}
        />
        <Kpi
          title="当前时间范围 Backlog"
          value={analysisRangeSummary.backlog}
          sub={`项目最终 ${lastWeekly?.backlog ?? 0}`}
          icon={History}
        />
        <Kpi
          title="当前时间范围 Backlog 峰值"
          value={analysisRangeSummary.backlogPeak}
          sub={`项目峰值 ${backlogPeak}`}
          icon={BarChart3}
        />
      </div>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{focusProjectLabel} 团队分布（测试/开发 Top3）</CardTitle>
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
            <div className="flex h-full items-center justify-center text-sm text-slate-500">当前项目暂无足够团队数据</div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  )
}
