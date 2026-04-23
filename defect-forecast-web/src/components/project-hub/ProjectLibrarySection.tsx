import type { ReactNode } from 'react'
import { Database, FileSpreadsheet, Filter, LayoutGrid, List, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type ProjectLibrarySectionProps = {
  projectFilter: string
  onProjectFilterChange: (value: string) => void
  onOpenImport: () => void
  onAddProject: () => void
  onExportSummary: () => void
  projectFilterMode: 'all' | 'favorites' | 'recent'
  onProjectFilterModeChange: (mode: 'all' | 'favorites' | 'recent') => void
  projectCount: number
  favoriteCount: number
  recentCount: number
  projectListMode: 'table' | 'cards'
  onProjectListModeChange: (mode: 'table' | 'cards') => void
  visibleProjectCount: number
  projectPage: number
  projectTotalPages: number
  listContent: ReactNode
  paginationContent?: ReactNode
}

export function ProjectLibrarySection({
  projectFilter,
  onProjectFilterChange,
  onOpenImport,
  onAddProject,
  onExportSummary,
  projectFilterMode,
  onProjectFilterModeChange,
  projectCount,
  favoriteCount,
  recentCount,
  projectListMode,
  onProjectListModeChange,
  visibleProjectCount,
  projectPage,
  projectTotalPages,
  listContent,
  paginationContent,
}: ProjectLibrarySectionProps) {
  return (
    <>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="text-2xl font-semibold">项目库</h2>
          <p className="mt-1 text-sm text-slate-500">
            统一管理已导入的历史项目、Jira 实际与缺陷分布分析。项目很多时可通过搜索、收藏和最近使用快速定位。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <Filter className="h-4 w-4 text-slate-500" />
            <input
              className="h-9 w-48 bg-transparent text-sm outline-none"
              placeholder="搜索显示名 / Key / 周期"
              value={projectFilter}
              onChange={(e) => onProjectFilterChange(e.target.value)}
            />
          </div>
          <Button variant="outline" className="rounded-2xl" onClick={onOpenImport}>
            <Database className="mr-2 h-4 w-4" />
            导入项目
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={onAddProject}>
            <Plus className="mr-2 h-4 w-4" />
            手工新增
          </Button>
          <Button className="rounded-2xl" onClick={onExportSummary}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            导出汇总
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>项目列表</CardTitle>
              <CardDescription>
                可多选加入趋势对比；“打开详情”会切换到项目详情页并保留当前所选项目。收藏和最近使用可帮助快速定位常看的项目。
              </CardDescription>
            </div>
            <div className="flex shrink-0 gap-1 rounded-xl border bg-slate-50 p-1">
              <Button
                type="button"
                variant={projectListMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-lg"
                onClick={() => onProjectListModeChange('table')}
              >
                <List className="mr-1.5 h-4 w-4" />
                列表
              </Button>
              <Button
                type="button"
                variant={projectListMode === 'cards' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-lg"
                onClick={() => onProjectListModeChange('cards')}
              >
                <LayoutGrid className="mr-1.5 h-4 w-4" />
                卡片
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={projectFilterMode === 'all' ? 'secondary' : 'outline'}
              className="rounded-xl"
              onClick={() => onProjectFilterModeChange('all')}
            >
              全部 {projectCount}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={projectFilterMode === 'favorites' ? 'secondary' : 'outline'}
              className="rounded-xl"
              onClick={() => onProjectFilterModeChange('favorites')}
            >
              收藏 {favoriteCount}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={projectFilterMode === 'recent' ? 'secondary' : 'outline'}
              className="rounded-xl"
              onClick={() => onProjectFilterModeChange('recent')}
            >
              最近使用 {recentCount}
            </Button>
          </div>
          {projectTotalPages > 1 ? (
            <p className="text-xs text-slate-500">
              共 {visibleProjectCount} 个项目，每页 40 条（第 {projectPage} / {projectTotalPages} 页）
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {listContent}
          {paginationContent ?? null}
        </CardContent>
      </Card>
    </>
  )
}
