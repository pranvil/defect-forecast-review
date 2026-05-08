import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExcelTemplatePreview } from '@/components/excel-preview/ExcelTemplatePreview'
import type { ForecastDataset } from '@/services/forecastService'

type TeamWeeklyRow = {
  team: string
  group: string
  values: number[]
  issueKeysByWeek: string[][]
  total: number
}

type ProjectTeamTabProps = {
  focusProjectLabel: string
  focusProject: string
  historyExportDataset: ForecastDataset | null
  onExportHistoryExcel: () => void
  onExportTeamWeeklyToExcel: () => void
  testingTeamWeeklyRows: TeamWeeklyRow[]
  devTeamWeeklyRows: TeamWeeklyRow[]
  focusWeekLabels: string[]
  buildTeamTotalJql: (group: string, team: string) => string
  buildTeamWeekJql: (group: string, team: string, weekLabel: string) => string
  openJiraByJql: (jql: string) => void
}

export function ProjectTeamTab({
  focusProjectLabel,
  focusProject,
  historyExportDataset,
  onExportHistoryExcel,
  onExportTeamWeeklyToExcel,
  testingTeamWeeklyRows,
  devTeamWeeklyRows,
  focusWeekLabels,
  buildTeamTotalJql,
  buildTeamWeekJql,
  openJiraByJql,
}: ProjectTeamTabProps) {
  return (
    <TabsContent value="team" className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>明细与预览</CardTitle>
          <CardDescription>当前展示项目：{focusProjectLabel}。可切换查看团队周数据或 Excel 预览，并分别导出。</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="excel" className="space-y-4">
            <TabsList variant="line" className="w-full justify-start">
              <TabsTrigger value="excel">Excel 预览</TabsTrigger>
              <TabsTrigger value="team">团队周数据</TabsTrigger>
            </TabsList>

            <TabsContent value="excel" className="space-y-3">
              <div className="flex justify-end">
                <Button type="button" className="rounded-2xl" disabled={!historyExportDataset} onClick={onExportHistoryExcel}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  导出 Excel
                </Button>
              </div>
              {historyExportDataset ? (
                <ExcelTemplatePreview projectName={focusProject} dataset={historyExportDataset} />
              ) : (
                <div className="text-sm text-slate-500">当前时间范围内暂无历史数据可预览</div>
              )}
            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  disabled={!testingTeamWeeklyRows.length && !devTeamWeeklyRows.length}
                  onClick={onExportTeamWeeklyToExcel}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  导出团队周数据 Excel
                </Button>
              </div>
              {testingTeamWeeklyRows.length || devTeamWeeklyRows.length ? (
                <div className="space-y-6">
                  {testingTeamWeeklyRows.length ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-slate-700">测试团队（提报 / Created）</div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[220px]">团队</TableHead>
                              <TableHead className="min-w-[80px]">总量</TableHead>
                              {focusWeekLabels.map((week) => (
                                <TableHead key={`test-${week}`} className="min-w-[78px]">
                                  {week}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {testingTeamWeeklyRows.map((row) => (
                              <TableRow key={`testing-${row.team}`}>
                                <TableCell className="font-medium">{row.team}</TableCell>
                                <TableCell>
                                  {(() => {
                                    const jql = buildTeamTotalJql(row.group, row.team)
                                    if (row.total > 0 && jql) {
                                      return (
                                        <button type="button" className="cursor-pointer text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900" title="按团队条件在 Jira 打开问题列表" onClick={() => openJiraByJql(jql)}>
                                          {row.total}
                                        </button>
                                      )
                                    }
                                    return row.total
                                  })()}
                                </TableCell>
                                {focusWeekLabels.map((_, idx) => (
                                  <TableCell key={`testing-${row.team}-${idx}`}>
                                    {(() => {
                                      const value = row.values[idx] ?? 0
                                      const jql = buildTeamWeekJql(row.group, row.team, focusWeekLabels[idx] ?? '')
                                      if (value > 0 && jql) {
                                        return (
                                          <button type="button" className="cursor-pointer text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900" title="按该周+团队条件在 Jira 打开问题列表" onClick={() => openJiraByJql(jql)}>
                                            {value}
                                          </button>
                                        )
                                      }
                                      return value
                                    })()}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : null}

                  {devTeamWeeklyRows.length ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-slate-700">开发团队（解决 / Fixed）</div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[220px]">团队</TableHead>
                              <TableHead className="min-w-[80px]">总量</TableHead>
                              {focusWeekLabels.map((week) => (
                                <TableHead key={`dev-${week}`} className="min-w-[78px]">
                                  {week}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {devTeamWeeklyRows.map((row) => (
                              <TableRow key={`dev-${row.team}`}>
                                <TableCell className="font-medium">{row.team}</TableCell>
                                <TableCell>
                                  {(() => {
                                    const jql = buildTeamTotalJql(row.group, row.team)
                                    if (row.total > 0 && jql) {
                                      return (
                                        <button type="button" className="cursor-pointer text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900" title="按团队条件在 Jira 打开问题列表" onClick={() => openJiraByJql(jql)}>
                                          {row.total}
                                        </button>
                                      )
                                    }
                                    return row.total
                                  })()}
                                </TableCell>
                                {focusWeekLabels.map((_, idx) => (
                                  <TableCell key={`dev-${row.team}-${idx}`}>
                                    {(() => {
                                      const value = row.values[idx] ?? 0
                                      const jql = buildTeamWeekJql(row.group, row.team, focusWeekLabels[idx] ?? '')
                                      if (value > 0 && jql) {
                                        return (
                                          <button type="button" className="cursor-pointer text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900" title="按该周+团队条件在 Jira 打开问题列表" onClick={() => openJiraByJql(jql)}>
                                            {value}
                                          </button>
                                        )
                                      }
                                      return value
                                    })()}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-slate-500">当前项目暂无团队周数据。请先完成 Jira 抓取，并确保字段 `Reporter Team-New`、`Assignee Team` 可读。</div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </TabsContent>
  )
}
