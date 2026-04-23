import { ProjectPicker } from '@/components/common/ProjectPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type ProjectOption = {
  key: string
  displayName?: string
}

type BugBoardProjectViewCardProps = {
  viewPrimaryProjectKey: string
  onPrimaryChange: (value: string) => void
  primaryOptions: ProjectOption[]
  viewCompareProjectKey: string
  onCompareChange: (value: string) => void
  compareOptions: ProjectOption[]
  polling: boolean
  exporting: boolean
  canExport: boolean
  onExportCsv: () => void
  onExportXlsx: () => void
}

export function BugBoardProjectViewCard({
  viewPrimaryProjectKey,
  onPrimaryChange,
  primaryOptions,
  viewCompareProjectKey,
  onCompareChange,
  compareOptions,
  polling,
  exporting,
  canExport,
  onExportCsv,
  onExportXlsx,
}: BugBoardProjectViewCardProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>项目查看</CardTitle>
        <CardDescription>选择主项目并可选对比项目，统计结果会自动更新到下方图表与表格。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <ProjectPicker
              label="主项目"
              value={viewPrimaryProjectKey}
              onChange={onPrimaryChange}
              options={primaryOptions}
              placeholder="请选择一个已缓存项目"
              className="min-w-0"
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <ProjectPicker
              label="对比项目（可选）"
              value={viewCompareProjectKey}
              onChange={onCompareChange}
              options={compareOptions}
              placeholder="不对比"
              emptyOptionLabel="不对比"
              allowEmpty
              className="min-w-0"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">导出基于当前统计结果，对比基于主项目 + 对比项目。</div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="shrink-0 rounded-2xl"
              disabled={polling || exporting || !canExport}
              onClick={onExportCsv}
            >
              导出 CSV
            </Button>
            <Button
              variant="outline"
              className="shrink-0 rounded-2xl"
              disabled={polling || exporting || !canExport}
              onClick={onExportXlsx}
            >
              导出 Excel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
