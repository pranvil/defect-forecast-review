import {
  Columns3,
  FolderKanban,
  Star,
  Trash2,
} from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { ProjectCompareTab } from '@/components/project-hub/detail-tabs/ProjectCompareTab'
import { ProjectInfoTab } from '@/components/project-hub/detail-tabs/ProjectInfoTab'
import { ProjectModuleTab } from '@/components/project-hub/detail-tabs/ProjectModuleTab'
import { ProjectOverviewTab } from '@/components/project-hub/detail-tabs/ProjectOverviewTab'
import { ProjectTeamTab } from '@/components/project-hub/detail-tabs/ProjectTeamTab'
import { ProjectTrendTab } from '@/components/project-hub/detail-tabs/ProjectTrendTab'
import { HistoricalProjectMetadataCard } from '@/components/config/HistoricalProjectMetadataCard'
import { ProjectDetailSection } from '@/components/project-hub/ProjectDetailSection'
import { ProjectLibrarySection } from '@/components/project-hub/ProjectLibrarySection'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useHistoryPageData } from '@/hooks/useHistoryPageData'
import {
  LIBRARY_DEFAULT_COLUMN_IDS,
  PROJECT_METADATA_COLUMNS,
  type ProjectMetadataColumnId,
  formatProjectMetadataCell,
} from '@/utils/projectMetadataColumns'

type HistoryPageProps = {
  mode?: 'full' | 'library' | 'detail'
}

export function HistoryPage({ mode = 'full' }: HistoryPageProps) {
  const {
    analysisStartDateOverride,
    analysisEndDateOverride,
    analysisRangeSummary,
    backlogPeak,
    defaultAnalysisStartDate,
    defaultAnalysisEndDate,
    buildTeamTotalJql,
    buildTeamWeekJql,
    calendarWindow,
    compareAxisMode,
    compareColors,
    compareDataWithDate,
    detailTab,
    devTeamWeeklyRows,
    exportHistoryToExcel,
    exportTeamWeeklyToExcel,
    favoriteProjects,
    focusLineVisible,
    focusProject,
    focusProjectIsFavorite,
    focusProjectLabel,
    focusProjectSummary,
    focusWeekDateMap,
    focusWeekLabels,
    forecastVersions,
    formatProjectLabel,
    hasAnyProject,
    historyCompareLineVisible,
    historyCompareWeekDateMap,
    historyExportDataset,
    isRefreshingProjectData,
    lastWeekly,
    openJiraByJql,
    openLibraryView,
    openProjectDetailView,
    paginatedProjects,
    projectCompare,
    projectCompareLineVisible,
    projectCompareWeekDateMap,
    projectCompareWithDate,
    projectCount,
    projectFilter,
    projectFilterMode,
    projectListMode,
    projectPage,
    projectTotalPages,
    recentProjects,
    relativeLength,
    removeCachedProject,
    refreshProjects,
    selectedProjects,
    setAnalysisStartDateOverride,
    setAnalysisEndDateOverride,
    setCalendarWindow,
    setCompareAxisMode,
    setDetailTab,
    setFocusLineVisible,
    setHistoryCompareLineVisible,
    setProjectCompareLineVisible,
    setProjectFilter,
    setProjectFilterMode,
    setProjectListMode,
    setProjectPage,
    setRelativeLength,
    setVersionId,
    testingTeamWeeklyRows,
    toggleFavorite,
    toggleSelectedProject,
    topTeamDistribution,
    refreshCurrentProjectData,
    versionId,
    visibleProjects,
    weeklyWithDate,
    effectiveAnalysisStartDate,
    effectiveAnalysisEndDate,
  } = useHistoryPageData()
  const [projectMetadataAction, setProjectMetadataAction] = React.useState<'add' | 'import' | 'export' | null>(null)
  const [overwriteExistingOnImport, setOverwriteExistingOnImport] = React.useState(false)
  const handleProjectMetadataActionHandled = React.useCallback(() => setProjectMetadataAction(null), [])
  const handleProjectMetadataRowsChanged = React.useCallback(() => {
    void refreshProjects()
  }, [refreshProjects])
  const showLibrary = mode !== 'detail'
  const showDetail = mode !== 'library'
  const [visibleProjectColumnIds, setVisibleProjectColumnIds] = React.useState<ProjectMetadataColumnId[]>(
    LIBRARY_DEFAULT_COLUMN_IDS,
  )
  const visibleProjectColumns = React.useMemo(
    () => PROJECT_METADATA_COLUMNS.filter((column) => visibleProjectColumnIds.includes(column.id)),
    [visibleProjectColumnIds],
  )
  const toggleProjectColumn = (columnId: ProjectMetadataColumnId, checked: boolean) => {
    setVisibleProjectColumnIds((current) => {
      if (checked) return current.includes(columnId) ? current : [...current, columnId]
      return current.filter((id) => id !== columnId)
    })
  }

  return (
    <div className="space-y-6">
      <HistoricalProjectMetadataCard
        variant="controller"
        action={projectMetadataAction}
        overwriteExistingOnImport={overwriteExistingOnImport}
        onOverwriteExistingOnImportChange={setOverwriteExistingOnImport}
        onActionHandled={handleProjectMetadataActionHandled}
        onRowsChanged={handleProjectMetadataRowsChanged}
      />
      {showLibrary ? (
        <ProjectLibrarySection
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
          onOpenImport={() => setProjectMetadataAction('import')}
          onAddProject={() => setProjectMetadataAction('add')}
          onExportSummary={() => setProjectMetadataAction('export')}
          overwriteExistingOnImport={overwriteExistingOnImport}
          onOverwriteExistingOnImportChange={setOverwriteExistingOnImport}
          projectFilterMode={projectFilterMode}
          onProjectFilterModeChange={setProjectFilterMode}
          projectCount={projectCount}
          favoriteCount={favoriteProjects.length}
          recentCount={recentProjects.length}
          projectListMode={projectListMode}
          onProjectListModeChange={setProjectListMode}
          visibleProjectCount={visibleProjects.length}
          projectPage={projectPage}
          projectTotalPages={projectTotalPages}
          listContent={
            projectListMode === 'table' ? (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-8 items-center justify-center rounded-xl border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <Columns3 className="mr-2 h-4 w-4" />
                      显示字段
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>项目列表字段</DropdownMenuLabel>
                        {PROJECT_METADATA_COLUMNS.map((column) => (
                          <DropdownMenuCheckboxItem
                            key={column.id}
                            checked={visibleProjectColumnIds.includes(column.id)}
                            onCheckedChange={(checked) => toggleProjectColumn(column.id, checked === true)}
                          >
                            {column.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="max-h-[min(60vh,520px)] overflow-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10 text-center">对比</TableHead>
                        {visibleProjectColumns.map((column) => (
                          <TableHead key={column.id} className={column.align === 'right' ? 'text-right' : undefined}>
                            {column.label}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProjects.map((p) => {
                        const isFavorite = favoriteProjects.includes(p.name)
                        const isRecent = recentProjects.includes(p.name)
                        return (
                          <TableRow key={p.name} className={focusProject === p.name ? 'bg-slate-50' : undefined}>
                            <TableCell className="text-center">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={selectedProjects.includes(p.name)}
                                  onCheckedChange={(checked) => {
                                    const on = checked === true
                                    const has = selectedProjects.includes(p.name)
                                    if (on !== has) toggleSelectedProject(p.name)
                                  }}
                                  aria-label={`加入对比：${p.name}`}
                                />
                              </div>
                            </TableCell>
                            {visibleProjectColumns.map((column) => (
                              <TableCell
                                key={column.id}
                                className={[
                                  column.id === 'name' ? 'font-mono text-xs' : '',
                                  column.id === 'validWindow' ? 'whitespace-nowrap text-slate-500' : '',
                                  column.align === 'right' ? 'text-right' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                {column.id === 'name' ? (
                                  <>
                                    <button
                                      type="button"
                                      className="font-medium text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900"
                                      onClick={() => openProjectDetailView(p.name)}
                                    >
                                      {formatProjectMetadataCell(p, column.id)}
                                    </button>
                                    <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
                                      {isFavorite ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">已收藏</span> : null}
                                      {isRecent ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">最近使用</span> : null}
                                    </div>
                                  </>
                                ) : column.id === 'displayName' ? (
                                  p.displayName ? formatProjectMetadataCell(p, column.id) : formatProjectLabel(p.name)
                                ) : (
                                  formatProjectMetadataCell(p, column.id)
                                )}
                              </TableCell>
                            ))}
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg"
                                  onClick={() => toggleFavorite(p.name)}
                                  title={isFavorite ? '取消收藏' : '收藏项目'}
                                >
                                  <Star className={`h-4 w-4 ${isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg"
                                  onClick={() => openProjectDetailView(p.name)}
                                >
                                  <FolderKanban className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg"
                                  onClick={() => void removeCachedProject(p.name)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
              ) : (
                <div className="max-h-[min(60vh,520px)] overflow-y-auto pr-1">
                  <div className="flex flex-wrap gap-3">
                    {paginatedProjects.map((p) => {
                      const isFavorite = favoriteProjects.includes(p.name)
                      const isSelected = selectedProjects.includes(p.name)
                      return (
                        <div
                          key={p.name}
                          className={`rounded-2xl border px-4 py-3 ${isSelected ? 'bg-slate-900 text-white' : 'bg-white'}`}
                        >
                          <button
                            type="button"
                            className={`font-medium underline decoration-dotted underline-offset-2 ${isSelected ? 'text-white' : 'text-sky-700 hover:text-sky-900'}`}
                            onClick={() => openProjectDetailView(p.name)}
                          >
                            {formatProjectLabel(p.name)}
                          </button>
                          <div className={`mt-1 text-xs ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>{p.cycle}</div>
                          <div className="mt-1 flex flex-wrap gap-1 text-xs">
                            {isFavorite ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">已收藏</span> : null}
                            {recentProjects.includes(p.name) ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">最近使用</span> : null}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              variant={isSelected ? 'secondary' : 'outline'}
                              className="h-8 rounded-xl"
                              onClick={() => toggleSelectedProject(p.name)}
                            >
                              {isSelected ? '已选中' : '加入对比'}
                            </Button>
                            <Button
                              variant="outline"
                              className="h-8 rounded-xl bg-white text-slate-900"
                              onClick={() => openProjectDetailView(p.name)}
                            >
                              详情
                            </Button>
                            <Button
                              variant="outline"
                              className="h-8 rounded-xl bg-white text-slate-900"
                              onClick={() => toggleFavorite(p.name)}
                            >
                              <Star className={`h-4 w-4 ${isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
          }
          paginationContent={
            projectTotalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-slate-600">
                <span>
                  显示 {(projectPage - 1) * 40 + 1}–
                  {Math.min(projectPage * 40, visibleProjects.length)} / {visibleProjects.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={projectPage <= 1}
                    onClick={() => setProjectPage((p) => Math.max(1, Math.min(p, projectTotalPages) - 1))}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={projectPage >= projectTotalPages}
                    onClick={() =>
                      setProjectPage((p) => Math.min(projectTotalPages, Math.max(1, Math.min(p, projectTotalPages)) + 1))
                    }
                  >
                    下一页
                  </Button>
                </div>
              </div>
            ) : null
          }
        />
      ) : null}

      {showDetail ? (
        <ProjectDetailSection
          focusProjectLabel={focusProjectLabel}
          hasAnyProject={hasAnyProject}
          focusProject={focusProject}
          focusProjectIsFavorite={focusProjectIsFavorite}
          onBackToLibrary={openLibraryView}
          onRefreshProjectData={() => void refreshCurrentProjectData()}
          onOpenImport={() => setProjectMetadataAction('import')}
          onToggleFavorite={() => toggleFavorite(focusProject)}
          isRefreshingProjectData={isRefreshingProjectData}
          analysisStartDateOverride={analysisStartDateOverride}
          analysisEndDateOverride={analysisEndDateOverride}
          defaultAnalysisStartDate={defaultAnalysisStartDate}
          defaultAnalysisEndDate={defaultAnalysisEndDate}
          effectiveAnalysisStartDate={effectiveAnalysisStartDate}
          effectiveAnalysisEndDate={effectiveAnalysisEndDate}
          onAnalysisStartDateChange={setAnalysisStartDateOverride}
          onAnalysisEndDateChange={setAnalysisEndDateOverride}
          onResetAnalysisDateRange={() => {
            setAnalysisStartDateOverride('')
            setAnalysisEndDateOverride('')
          }}
          detailTab={detailTab}
          onDetailTabChange={setDetailTab}
          content={
            <>
              <ProjectOverviewTab
                focusProjectLabel={focusProjectLabel}
                lastWeekly={lastWeekly}
                analysisRangeSummary={analysisRangeSummary}
                backlogPeak={backlogPeak}
                topTeamDistribution={topTeamDistribution}
              />
              <ProjectTrendTab focusLineVisible={focusLineVisible} setFocusLineVisible={setFocusLineVisible} weeklyWithDate={weeklyWithDate} focusWeekDateMap={focusWeekDateMap} />
              <ProjectTeamTab
                focusProjectLabel={focusProjectLabel}
                focusProject={focusProject}
                historyExportDataset={historyExportDataset}
                onExportHistoryExcel={exportHistoryToExcel}
                onExportTeamWeeklyToExcel={exportTeamWeeklyToExcel}
                testingTeamWeeklyRows={testingTeamWeeklyRows}
                devTeamWeeklyRows={devTeamWeeklyRows}
                focusWeekLabels={focusWeekLabels}
                buildTeamTotalJql={buildTeamTotalJql}
                buildTeamWeekJql={buildTeamWeekJql}
                openJiraByJql={openJiraByJql}
              />
              <ProjectModuleTab focusProject={focusProject} />
              <ProjectCompareTab
                focusProjectLabel={focusProjectLabel}
                versionId={versionId}
                setVersionId={setVersionId}
                forecastVersions={forecastVersions}
                projectCompare={projectCompare}
                projectCompareLineVisible={projectCompareLineVisible}
                setProjectCompareLineVisible={setProjectCompareLineVisible}
                projectCompareWithDate={projectCompareWithDate}
                projectCompareWeekDateMap={projectCompareWeekDateMap}
                compareAxisMode={compareAxisMode}
                setCompareAxisMode={setCompareAxisMode}
                calendarWindow={calendarWindow}
                setCalendarWindow={setCalendarWindow}
                relativeLength={relativeLength}
                setRelativeLength={setRelativeLength}
                selectedProjects={selectedProjects}
                historyCompareLineVisible={historyCompareLineVisible}
                setHistoryCompareLineVisible={setHistoryCompareLineVisible}
                compareColors={compareColors}
                compareDataWithDate={compareDataWithDate}
                historyCompareWeekDateMap={historyCompareWeekDateMap}
              />
              <ProjectInfoTab
                focusProjectSummary={focusProjectSummary}
                focusProjectIsFavorite={focusProjectIsFavorite}
              />
            </>
          }
        />
      ) : null}
    </div>
  )
}
