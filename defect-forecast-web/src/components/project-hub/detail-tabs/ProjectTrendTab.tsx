import type { Dispatch, SetStateAction } from 'react'
import { Check } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TabsContent } from '@/components/ui/tabs'
import { WeekDateTick } from '@/components/project-hub/detail-tabs/shared'

type FocusLineVisibleState = {
  created: boolean
  fixed: boolean
  backlog: boolean
}

type WeeklyTrendRow = {
  weekLabel: string
  date: string
  created: number
  fixed: number
  backlog: number
}

type ProjectTrendTabProps = {
  focusLineVisible: FocusLineVisibleState
  setFocusLineVisible: Dispatch<SetStateAction<FocusLineVisibleState>>
  weeklyWithDate: WeeklyTrendRow[]
  focusWeekDateMap: Record<string, string>
}

export function ProjectTrendTab({
  focusLineVisible,
  setFocusLineVisible,
  weeklyWithDate,
  focusWeekDateMap,
}: ProjectTrendTabProps) {
  return (
    <TabsContent value="trend" className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>当前项目每周创建 / 解决趋势</CardTitle>
          <CardDescription>解决时间按 verified_sw 及 closed/postponed/deleted 字段回退统计</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[320px] flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`rounded-lg ${focusLineVisible.created ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
              onClick={() => setFocusLineVisible((s) => ({ ...s, created: !s.created }))}
            >
              {focusLineVisible.created ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
              每周创建
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`rounded-lg ${focusLineVisible.fixed ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
              onClick={() => setFocusLineVisible((s) => ({ ...s, fixed: !s.fixed }))}
            >
              {focusLineVisible.fixed ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
              每周解决
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`rounded-lg ${focusLineVisible.backlog ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-600'}`}
              onClick={() => setFocusLineVisible((s) => ({ ...s, backlog: !s.backlog }))}
            >
              {focusLineVisible.backlog ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
              Backlog
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyWithDate} margin={{ bottom: 14 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="weekLabel"
                  height={56}
                  tick={(props) => (
                    <WeekDateTick
                      {...props}
                      dateText={
                        focusWeekDateMap[
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
                {focusLineVisible.created ? <Line type="monotone" dataKey="created" name="每周创建" stroke="#0f172a" dot={false} /> : null}
                {focusLineVisible.fixed ? <Line type="monotone" dataKey="fixed" name="每周解决" stroke="#16a34a" dot={false} /> : null}
                {focusLineVisible.backlog ? <Line type="monotone" dataKey="backlog" name="Backlog" stroke="#f59e0b" dot={false} /> : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}
