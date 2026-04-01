import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type KpiProps = {
  title: string
  value: string | number
  sub: string
  icon: LucideIcon
}

export function Kpi({ title, value, sub, icon: Icon }: KpiProps) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <div className="text-sm text-slate-500">{title}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
          <div className="mt-1 text-xs text-slate-500">{sub}</div>
        </div>
        <div className="rounded-2xl bg-slate-100 p-2">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </CardContent>
    </Card>
  )
}
