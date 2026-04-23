import type { Dispatch, SetStateAction } from 'react'
import { Check, Database, History, Search, Sparkles } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Kpi } from '@/components/common/Kpi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TabsContent } from '@/components/ui/tabs'
import { WeekDateTick } from '@/components/project-hub/detail-tabs/shared'
import type { CompareAxisMode, CompareCalendarWindow, CompareRelativeLength, ProjectCompareResult } from '@/services/projectService'

type ProjectCompareLineVisibleState = {
  historyCreated: boolean
  jiraCreated: boolean
  forecastCreated: boolean
}

type CompareWeeklyRow = {
  weekLabel: string
  date: string
  historyCreated: number | null
  jiraCreated: number | null
  forecastCreated: number | null
}

type ProjectCompareTabProps = {
  focusProjectLabel: string
  versionId: string
  setVersionId: (value: string) => void
  forecastVersions: Array<{ id: string; createdAt: string }>
  projectCompare: ProjectCompareResult | null
  projectCompareLineVisible: ProjectCompareLineVisibleState
  setProjectCompareLineVisible: Dispatch<SetStateAction<ProjectCompareLineVisibleState>>
  projectCompareWithDate: CompareWeeklyRow[]
  projectCompareWeekDateMap: Record<string, string>
  compareAxisMode: CompareAxisMode
  setCompareAxisMode: (value: CompareAxisMode) => void
  calendarWindow: CompareCalendarWindow
  setCalendarWindow: (value: CompareCalendarWindow) => void
  relativeLength: CompareRelativeLength
  setRelativeLength: (value: CompareRelativeLength) => void
  selectedProjects: string[]
  historyCompareLineVisible: Record<string, boolean>
  setHistoryCompareLineVisible: Dispatch<SetStateAction<Record<string, boolean>>>
  compareColors: string[]
  compareDataWithDate: Array<Record<string, string | number | null>>
  historyCompareWeekDateMap: Record<string, string>
}

export function ProjectCompareTab({
  focusProjectLabel,
  versionId,
  setVersionId,
  forecastVersions,
  projectCompare,
  projectCompareLineVisible,
  setProjectCompareLineVisible,
  projectCompareWithDate,
  projectCompareWeekDateMap,
  compareAxisMode,
  setCompareAxisMode,
  calendarWindow,
  setCalendarWindow,
  relativeLength,
  setRelativeLength,
  selectedProjects,
  historyCompareLineVisible,
  setHistoryCompareLineVisible,
  compareColors,
  compareDataWithDate,
  historyCompareWeekDateMap,
}: ProjectCompareTabProps) {
  return (
    <TabsContent value="compare" className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>历史 / 预测 / JIRA 实际对比</CardTitle>
          <CardDescription>默认按当前项目对比；可选择预测版本参与比较</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-slate-500" />
            <select className="h-9 rounded-xl border px-3 text-sm" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
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
                <Kpi title="历史累计Created" value={projectCompare.metrics.totalHistoryCreated} sub={focusProjectLabel} icon={History} />
                <Kpi title="JIRA累计Created" value={projectCompare.metrics.totalJiraCreated} sub={focusProjectLabel} icon={Database} />
                <Kpi title="预测累计Created" value={projectCompare.metrics.totalForecastCreated} sub={focusProjectLabel} icon={Sparkles} />
              </div>
              <div className="flex h-[320px] flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={`rounded-lg ${projectCompareLineVisible.historyCreated ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
                    onClick={() => setProjectCompareLineVisible((s) => ({ ...s, historyCreated: !s.historyCreated }))}
                  >
                    {projectCompareLineVisible.historyCreated ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
                    历史 Created
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={`rounded-lg ${projectCompareLineVisible.jiraCreated ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
                    onClick={() => setProjectCompareLineVisible((s) => ({ ...s, jiraCreated: !s.jiraCreated }))}
                  >
                    {projectCompareLineVisible.jiraCreated ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
                    JIRA Created
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={`rounded-lg ${projectCompareLineVisible.forecastCreated ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
                    onClick={() => setProjectCompareLineVisible((s) => ({ ...s, forecastCreated: !s.forecastCreated }))}
                  >
                    {projectCompareLineVisible.forecastCreated ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
                    预测 Created
                  </Button>
                </div>
                <div className="min-h-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={projectCompareWithDate} margin={{ bottom: 14 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="weekLabel"
                        height={56}
                        tick={(props) => (
                          <WeekDateTick
                            {...props}
                            dateText={
                              projectCompareWeekDateMap[
                                ((props as { value?: string; payload?: { value?: string } }).value ??
                                  (props as { value?: string; payload?: { value?: string } }).payload?.value ??
                                  '') as string
                              ] ?? ''
                            }
                          />
                        )}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {projectCompareLineVisible.historyCreated ? <Line type="monotone" dataKey="historyCreated" name="历史 Created" stroke="#0f172a" dot={false} /> : null}
                      {projectCompareLineVisible.jiraCreated ? <Line type="monotone" dataKey="jiraCreated" name="JIRA Created" stroke="#0284c7" dot={false} /> : null}
                      {projectCompareLineVisible.forecastCreated ? <Line type="monotone" dataKey="forecastCreated" name="预测 Created" stroke="#16a34a" dot={false} /> : null}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">当前项目暂无可对比数据</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>历史项目趋势对比</CardTitle>
              <CardDescription>多个项目同图对比，支持按「日历周」或「相对周序」对齐。</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="h-9 rounded-xl border px-3 text-sm" value={compareAxisMode} onChange={(e) => setCompareAxisMode(e.target.value as CompareAxisMode)}>
                <option value="relative">横轴：相对周序</option>
                <option value="calendar">横轴：日历周</option>
              </select>
              {compareAxisMode === 'calendar' ? (
                <select className="h-9 rounded-xl border px-3 text-sm" value={calendarWindow} onChange={(e) => setCalendarWindow(e.target.value as CompareCalendarWindow)}>
                  <option value="overlap">窗口：仅重叠区间</option>
                  <option value="full">窗口：全部时间区间</option>
                </select>
              ) : (
                <select className="h-9 rounded-xl border px-3 text-sm" value={relativeLength} onChange={(e) => setRelativeLength(e.target.value as CompareRelativeLength)}>
                  <option value="shortest">长度：按最短项目</option>
                  <option value="full">长度：按最长项目</option>
                </select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex h-[360px] flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {selectedProjects.map((project, idx) => (
              <Button
                key={`toggle-${project}`}
                type="button"
                size="sm"
                variant="outline"
                className={`rounded-lg ${(historyCompareLineVisible[project] ?? true) ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
                onClick={() => setHistoryCompareLineVisible((s) => ({ ...s, [project]: !(s[project] ?? true) }))}
              >
                {(historyCompareLineVisible[project] ?? true) ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: compareColors[idx % Math.max(1, compareColors.length)] ?? '#0f172a' }} />
                {project}
              </Button>
            ))}
          </div>
          {compareDataWithDate.length ? (
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={compareDataWithDate} margin={{ bottom: 14 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week"
                    height={compareAxisMode === 'calendar' ? 56 : 24}
                    tick={
                      compareAxisMode === 'calendar'
                        ? (props) => (
                            <WeekDateTick
                              {...props}
                              dateText={
                                historyCompareWeekDateMap[
                                  ((props as { value?: string; payload?: { value?: string } }).value ??
                                    (props as { value?: string; payload?: { value?: string } }).payload?.value ??
                                    '') as string
                                ] ?? ''
                              }
                            />
                          )
                        : undefined
                    }
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {selectedProjects.map((project, idx) =>
                    historyCompareLineVisible[project] ?? true ? (
                      <Line
                        key={project}
                        type="monotone"
                        dataKey={project}
                        stroke={compareColors[idx % Math.max(1, compareColors.length)] ?? '#0f172a'}
                        strokeWidth={2.5}
                        dot={false}
                        connectNulls={false}
                      />
                    ) : null,
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {compareAxisMode === 'calendar' && calendarWindow === 'overlap'
                ? '所选项目没有重叠周期，请切换到“全部时间区间”或“相对周序”。'
                : '当前没有可展示的趋势数据。'}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  )
}
