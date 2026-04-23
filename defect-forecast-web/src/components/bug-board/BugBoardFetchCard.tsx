import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'

type BugBoardFetchCardProps = {
  embedded: boolean
  fetchKeysRaw: string
  onFetchKeysRawChange: (value: string) => void
  fetchKeysLength: number
  mixName: string
  onMixNameChange: (value: string) => void
  forceRefresh: boolean
  onForceRefreshChange: (checked: boolean) => void
  polling: boolean
  disableFetch: boolean
  onFetch: () => void
  progressMessage: string
  progressLabel: string
  progressValue: number
  showProgress: boolean
  statusContent?: ReactNode
}

export function BugBoardFetchCard({
  embedded,
  fetchKeysRaw,
  onFetchKeysRawChange,
  fetchKeysLength,
  mixName,
  onMixNameChange,
  forceRefresh,
  onForceRefreshChange,
  polling,
  disableFetch,
  onFetch,
  progressMessage,
  progressLabel,
  progressValue,
  showProgress,
  statusContent,
}: BugBoardFetchCardProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>{embedded ? '模块 / Team 分布数据获取' : '数据获取'}</CardTitle>
        <CardDescription>
          {embedded
            ? '当前项目详情中的模块分布会优先复用项目导入时保存的本地 issue 事实数据；这里主要负责重算统计结果与项目对比。'
            : '优先基于本地已导入的项目 issue 数据重算模块 / Team 分布，支持主副项目对比，以及多 Key 混合项目。'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>项目 Key（可多行，逗号/空格/换行分隔）</Label>
            <Textarea
              className="min-h-[84px] rounded-2xl font-mono"
              value={fetchKeysRaw}
              onChange={(e) => onFetchKeysRawChange(e.target.value)}
            />
            {fetchKeysLength > 1 ? (
              <div className="space-y-2 rounded-2xl border bg-white p-3">
                <div className="text-xs text-slate-500">
                  已识别 {fetchKeysLength} 个项目 Key。将合并为一个“混合项目”，请先为这个混合项目命名（必填）。
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className="h-9 rounded-xl"
                    placeholder="例如：26W2-26W27 组合项目 / 某系列混合"
                    value={mixName}
                    onChange={(e) => onMixNameChange(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>
          <div className="space-y-2" />
          <div className="space-y-2">
            <Label>缓存</Label>
            <div className="flex h-10 items-center gap-3 rounded-2xl border bg-white px-4 text-sm">
              <input id="forceRefresh" type="checkbox" checked={forceRefresh} onChange={(e) => onForceRefreshChange(e.target.checked)} />
              <label htmlFor="forceRefresh" className="text-slate-700">
                强制重算（忽略已有本地统计缓存）
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button className="rounded-2xl" disabled={disableFetch} onClick={onFetch}>
            重算统计
          </Button>
        </div>

        {showProgress ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>{progressMessage}</span>
              <span className="font-mono">{progressLabel}</span>
            </div>
            <Progress value={progressValue} className="text-sky-700" />
          </div>
        ) : null}

        {polling ? null : statusContent ?? null}
      </CardContent>
    </Card>
  )
}
