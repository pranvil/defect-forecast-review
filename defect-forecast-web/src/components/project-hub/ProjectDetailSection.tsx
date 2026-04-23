import type { ReactNode } from 'react'
import { Database, RefreshCw, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ProjectDetailTab } from '@/stores/projectStore'

type ProjectDetailSectionProps = {
  focusProjectLabel: string
  hasAnyProject: boolean
  focusProject: string
  focusProjectIsFavorite: boolean
  onBackToLibrary: () => void
  onRefreshProjectData: () => void
  onOpenImport: () => void
  onToggleFavorite: () => void
  isRefreshingProjectData: boolean
  analysisStartDateOverride: string
  analysisEndDateOverride: string
  defaultAnalysisStartDate: string
  defaultAnalysisEndDate: string
  effectiveAnalysisStartDate: string
  effectiveAnalysisEndDate: string
  onAnalysisStartDateChange: (value: string) => void
  onAnalysisEndDateChange: (value: string) => void
  onResetAnalysisDateRange: () => void
  detailTab: ProjectDetailTab
  onDetailTabChange: (tab: ProjectDetailTab) => void
  content: ReactNode
}

export function ProjectDetailSection({
  focusProjectLabel,
  hasAnyProject,
  focusProject,
  focusProjectIsFavorite,
  onBackToLibrary,
  onRefreshProjectData,
  onOpenImport,
  onToggleFavorite,
  isRefreshingProjectData,
  analysisStartDateOverride,
  analysisEndDateOverride,
  defaultAnalysisStartDate,
  defaultAnalysisEndDate,
  effectiveAnalysisStartDate,
  effectiveAnalysisEndDate,
  onAnalysisStartDateChange,
  onAnalysisEndDateChange,
  onResetAnalysisDateRange,
  detailTab,
  onDetailTabChange,
  content,
}: ProjectDetailSectionProps) {
  return (
    <>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="text-2xl font-semibold">项目详情</h2>
          <p className="mt-1 text-sm text-slate-500">
            当前项目：{focusProjectLabel || '未选择项目'}。在这里统一查看趋势、Team、模块分布和对比分析。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-2xl" onClick={onBackToLibrary}>
            返回项目列表
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={onRefreshProjectData} disabled={isRefreshingProjectData || !focusProject}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshingProjectData ? 'animate-spin' : ''}`} />
            数据更新
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={onOpenImport}>
            <Database className="mr-2 h-4 w-4" />
            导入项目
          </Button>
          {focusProject ? (
            <Button variant="outline" className="rounded-2xl" onClick={onToggleFavorite}>
              <Star className={`mr-2 h-4 w-4 ${focusProjectIsFavorite ? 'fill-amber-400 text-amber-500' : ''}`} />
              {focusProjectIsFavorite ? '取消收藏' : '收藏项目'}
            </Button>
          ) : null}
        </div>
      </div>

      {hasAnyProject ? (
        <Tabs value={detailTab} onValueChange={(value) => onDetailTabChange(value as ProjectDetailTab)} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-3">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">分析起始日期</div>
              <Input
                type="date"
                value={analysisStartDateOverride || effectiveAnalysisStartDate}
                onChange={(e) => onAnalysisStartDateChange(e.target.value)}
                className="h-9 w-[180px] rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500">分析结束日期</div>
              <Input
                type="date"
                value={analysisEndDateOverride || effectiveAnalysisEndDate}
                onChange={(e) => onAnalysisEndDateChange(e.target.value)}
                className="h-9 w-[180px] rounded-xl"
              />
            </div>
            {analysisStartDateOverride || analysisEndDateOverride ? (
              <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={onResetAnalysisDateRange}>
                恢复全局默认（{defaultAnalysisStartDate || '全部历史'} ~ {defaultAnalysisEndDate || '全部历史'}）
              </Button>
            ) : null}
          </div>
          <TabsList variant="default" className="w-full justify-start overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-1">
            <TabsTrigger value="overview" className="min-w-[92px] rounded-xl data-active:bg-slate-900 data-active:text-white">
              概览
            </TabsTrigger>
            <TabsTrigger value="trend" className="min-w-[92px] rounded-xl data-active:bg-slate-900 data-active:text-white">
              趋势
            </TabsTrigger>
            <TabsTrigger value="team" className="min-w-[108px] rounded-xl data-active:bg-slate-900 data-active:text-white">
              Team分析
            </TabsTrigger>
            <TabsTrigger value="module" className="min-w-[108px] rounded-xl data-active:bg-slate-900 data-active:text-white">
              模块分布
            </TabsTrigger>
            <TabsTrigger value="compare" className="min-w-[108px] rounded-xl data-active:bg-slate-900 data-active:text-white">
              对比分析
            </TabsTrigger>
            <TabsTrigger value="info" className="min-w-[108px] rounded-xl data-active:bg-slate-900 data-active:text-white">
              项目信息
            </TabsTrigger>
          </TabsList>
          {content}
        </Tabs>
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="py-10 text-center text-sm text-slate-500">项目库中还没有项目，请先导入项目或手工新增。</CardContent>
        </Card>
      )}
    </>
  )
}
