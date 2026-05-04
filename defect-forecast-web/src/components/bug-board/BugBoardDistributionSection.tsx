import * as React from 'react'
import ReactECharts from 'echarts-for-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const PRIMARY_COLOR = '#6366f1'
const COMPARE_COLOR = '#22c55e'

type DistributionRow = {
  name: string
  primary: number
  compare: number
  gap: number
}

type BugBoardDistributionSectionProps = {
  activeTab: 'module' | 'team'
  onActiveTabChange: (tab: 'module' | 'team') => void
  topN: number
  onTopNChange: (value: number) => void
  clampedTopN: number
  moduleTop: DistributionRow[]
  teamTop: DistributionRow[]
  rows: DistributionRow[]
  hasResult: boolean
  viewPrimaryProjectKey: string
  viewCompareProjectKey: string
  displayProject: (key: string) => string
}

export function BugBoardDistributionSection({
  activeTab,
  onActiveTabChange,
  topN,
  onTopNChange,
  clampedTopN,
  moduleTop,
  teamTop,
  rows,
  hasResult,
  viewPrimaryProjectKey,
  viewCompareProjectKey,
  displayProject,
}: BugBoardDistributionSectionProps) {
  const moduleChartOption = React.useMemo(() => {
    const items = moduleTop
    const categories = items.map((x) => x.name)
    const primary = items.map((x) => x.primary)
    const compare = items.map((x) => x.compare)
    const hasCompare = viewCompareProjectKey.trim().length > 0
    const primaryName = viewPrimaryProjectKey.trim() ? `${displayProject(viewPrimaryProjectKey)}（主）` : '主项目'
    const compareName = viewCompareProjectKey.trim() ? `${displayProject(viewCompareProjectKey)}（对比）` : '对比项目'
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
        ...(hasCompare ? [{ name: compareName, type: 'bar', data: compare, itemStyle: { color: COMPARE_COLOR } }] : []),
      ],
    }
  }, [displayProject, moduleTop, viewCompareProjectKey, viewPrimaryProjectKey])

  const teamChartOption = React.useMemo(() => {
    const items = teamTop
    const categories = items.map((x) => x.name)
    const primary = items.map((x) => x.primary)
    const compare = items.map((x) => x.compare)
    const hasCompare = viewCompareProjectKey.trim().length > 0
    const showSlider = categories.length > 10
    const primaryName = viewPrimaryProjectKey.trim() ? `${displayProject(viewPrimaryProjectKey)}（主）` : '主项目'
    const compareName = viewCompareProjectKey.trim() ? `${displayProject(viewCompareProjectKey)}（对比）` : '对比项目'
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
        ...(hasCompare ? [{ name: compareName, type: 'bar', data: compare, itemStyle: { color: COMPARE_COLOR } }] : []),
      ],
    }
  }, [displayProject, teamTop, viewCompareProjectKey, viewPrimaryProjectKey])

  return (
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
            onChange={(e) => onTopNChange(Number(e.target.value))}
            className="h-9 w-28 rounded-2xl"
          />
          <div className="text-xs text-slate-500">最大 30，当前 {clampedTopN}</div>
        </div>
        <Tabs value={activeTab} onValueChange={(v) => onActiveTabChange(v as 'module' | 'team')} className="space-y-4">
          <div className="text-sm font-medium text-slate-700">模块&Team分布查看</div>
          <TabsList variant="default" className="w-full justify-start rounded-xl border border-slate-200 bg-slate-100 p-1">
            <TabsTrigger value="module" className="min-w-[108px] rounded-lg data-active:bg-slate-900 data-active:text-white">
              模块
            </TabsTrigger>
            <TabsTrigger value="team" className="min-w-[108px] rounded-lg data-active:bg-slate-900 data-active:text-white">
              Team
            </TabsTrigger>
          </TabsList>
          <TabsContent value="module" className="space-y-4">
            <div className="h-[360px]">
              {moduleTop.length ? (
                <ReactECharts option={moduleChartOption} style={{ height: '100%', width: '100%' }} notMerge />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  {hasResult ? '暂无模块 Top15 数据' : '请先点击“获取”'}
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
                  {hasResult
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
                    {hasResult ? '暂无数据（返回空结果）' : '请先点击“获取”'}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
