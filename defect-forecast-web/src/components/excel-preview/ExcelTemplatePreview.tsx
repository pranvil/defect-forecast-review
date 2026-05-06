import { ScrollArea } from '@/components/ui/scroll-area'
import type { ProjectHistory } from '@/types/project'

type ExcelTemplatePreviewProps = {
  projectName: string
  dataset: Pick<
    ProjectHistory,
    'weekly' | 'createdTeams' | 'fixedTeams' | 'milestones'
  >
  compact?: boolean
}

export function ExcelTemplatePreview({
  projectName,
  dataset,
  compact = false,
}: ExcelTemplatePreviewProps) {
  const createdRows = dataset.createdTeams ?? []
  const fixedRows = dataset.fixedTeams ?? []
  const totalCreated = dataset.weekly.map((x) => x.created)
  const totalFixed = dataset.weekly.map((x) => x.fixed)
  const cumCreated = dataset.weekly.map((x) => x.cumCreated)
  const cumFixed = dataset.weekly.map((x) => x.cumFixed)
  const backlog = dataset.weekly.map((x) => x.backlog)
  const dates = dataset.weekly.map((x) => x.date)
  const weekLabels = dataset.weekly.map((x) => x.weekLabel)
  const weeks = dataset.weekly.map((x) => x.week)
  const rateByWeek = (
    metric: 'devResolutionRate' | 'testCompletionRate' | 'testSubmissionRate',
  ) => {
    const map = new Map<string, string>()
    for (const milestone of dataset.milestones ?? []) {
      const value = milestone[metric]
      if (typeof value !== 'number' || !Number.isFinite(value)) continue
      const current = map.get(milestone.week)
      map.set(milestone.week, current ? `${current} / ${value}%` : `${value}%`)
    }
    return map
  }
  const testSubmissionRateByWeek = rateByWeek('testSubmissionRate')
  const devResolutionRateByWeek = rateByWeek('devResolutionRate')
  const testCompletionRateByWeek = rateByWeek('testCompletionRate')

  const monthColor: Record<number, string> = {
    1: 'bg-sky-100',
    2: 'bg-orange-100',
    3: 'bg-stone-100',
    4: 'bg-lime-200',
    5: 'bg-blue-200',
    6: 'bg-yellow-200',
  }

  const monthSegments = (() => {
    const segments: { label: string; span: number; color: string }[] = []
    for (const d of dates) {
      const m = Number(d.split('/')[0])
      const month = Number.isFinite(m) ? m : 0
      const label = month ? `2026年${month}月` : '未知月份'
      const last = segments.at(-1)
      if (!last || last.label !== label) {
        segments.push({
          label,
          span: 1,
          color: monthColor[month] ?? 'bg-slate-100',
        })
      } else {
        last.span += 1
      }
    }
    return segments
  })()

  return (
    <ScrollArea className="w-full whitespace-nowrap rounded-xl border">
      <div className="min-w-[1800px] bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border bg-slate-100 p-2 text-left">项目名</th>
              <th className="border bg-slate-100 p-2 text-left">Month</th>
              {monthSegments.map((m) => (
                <th
                  key={m.label}
                  colSpan={m.span}
                  className={`border p-2 text-center font-semibold ${m.color}`}
                >
                  {m.label}
                </th>
              ))}
            </tr>
            <tr>
              <th className="border bg-white p-2 text-left text-red-600">
                {projectName}
              </th>
              <th className="border bg-slate-50 p-2 text-left">Date</th>
              {dates.map((d) => (
                <th key={d} className="border bg-slate-50 p-2 text-center">
                  {d}
                </th>
              ))}
            </tr>
            <tr>
              <th className="border bg-white p-2 text-left">部门</th>
              <th className="border bg-slate-50 p-2 text-left">Week</th>
              {weekLabels.map((w) => (
                <th key={w} className="border bg-slate-50 p-2 text-center">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {createdRows.map((row) => (
              <tr key={row.team}>
                <td className="border p-2">Created</td>
                <td className="border p-2">{row.team}</td>
                {row.values.map((value, idx) => (
                  <td key={idx} className="border p-2 text-center">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-yellow-200 font-semibold">
              <td className="border p-2">Created</td>
              <td className="border p-2">Total Created</td>
              {totalCreated.map((value, idx) => (
                <td key={idx} className="border p-2 text-center">
                  {value}
                </td>
              ))}
            </tr>
            <tr className="bg-sky-400 font-semibold text-slate-900">
              <td className="border p-2">Created</td>
              <td className="border p-2">累计创建</td>
              {cumCreated.map((value, idx) => (
                <td key={idx} className="border p-2 text-center">
                  {value}
                </td>
              ))}
            </tr>
            {fixedRows.map((row) => (
              <tr key={row.team}>
                <td className="border p-2">Fixed</td>
                <td className="border p-2">{row.team}</td>
                {row.values.map((value, idx) => (
                  <td key={idx} className="border p-2 text-center">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-yellow-200 font-semibold">
              <td className="border p-2">Fixed</td>
              <td className="border p-2">Total Fixed</td>
              {totalFixed.map((value, idx) => (
                <td key={idx} className="border p-2 text-center">
                  {value}
                </td>
              ))}
            </tr>
            <tr className="bg-sky-400 font-semibold text-slate-900">
              <td className="border p-2">Fixed</td>
              <td className="border p-2">累计解决</td>
              {cumFixed.map((value, idx) => (
                <td key={idx} className="border p-2 text-center">
                  {value}
                </td>
              ))}
            </tr>
            <tr className="bg-cyan-400 font-semibold text-slate-900">
              <td className="border p-2">遗留</td>
              <td className="border p-2">Backlog</td>
              {backlog.map((value, idx) => (
                <td key={idx} className="border p-2 text-center">
                  {value}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border p-2">MV 版本</td>
              <td className="border p-2" />
              {weeks.map((w) => {
                const m = (dataset.milestones ?? []).find((x) => x.week === w)
                return (
                  <td key={w} className="border p-2 text-center">
                    {m ? m.label : ''}
                  </td>
                )
              })}
            </tr>
            {!compact && (
              <>
                <tr className="bg-violet-50">
                  <td className="border p-2">问题提交率</td>
                  <td className="border p-2" />
                  {weeks.map((w) => (
                    <td key={w} className="border p-2 text-center">
                      {testSubmissionRateByWeek.get(w) ?? ''}
                    </td>
                  ))}
                </tr>
                <tr className="bg-rose-50">
                  <td className="border p-2">问题解决率</td>
                  <td className="border p-2" />
                  {weeks.map((w) => (
                    <td key={w} className="border p-2 text-center">
                      {devResolutionRateByWeek.get(w) ?? ''}
                    </td>
                  ))}
                </tr>
                <tr className="bg-emerald-50">
                  <td className="border p-2">测试完成率</td>
                  <td className="border p-2" />
                  {weeks.map((w) => (
                    <td key={w} className="border p-2 text-center">
                      {testCompletionRateByWeek.get(w) ?? ''}
                    </td>
                  ))}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </ScrollArea>
  )
}
