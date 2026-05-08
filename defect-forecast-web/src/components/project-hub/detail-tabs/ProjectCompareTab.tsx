import type { Dispatch, SetStateAction } from 'react'
import { Check } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TabsContent } from '@/components/ui/tabs'
import { WeekDateTick } from '@/components/project-hub/detail-tabs/shared'
import type { CompareAxisMode, CompareCalendarWindow, CompareRelativeLength } from '@/services/projectService'

type ProjectCompareTabProps = {
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
