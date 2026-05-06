import type { ProjectSummary } from '@/services/projectService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TabsContent } from '@/components/ui/tabs'
import { PROJECT_METADATA_COLUMNS, formatProjectMetadataCell } from '@/utils/projectMetadataColumns'

type ProjectInfoTabProps = {
  focusProjectSummary?: ProjectSummary | null
  focusProjectIsFavorite: boolean
}

export function ProjectInfoTab({ focusProjectSummary, focusProjectIsFavorite }: ProjectInfoTabProps) {
  const infoRows = PROJECT_METADATA_COLUMNS.map((column) => ({
    ...column,
    value: focusProjectSummary ? formatProjectMetadataCell(focusProjectSummary, column.id) : '-',
  }))

  return (
    <TabsContent value="info" className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>项目信息</CardTitle>
          <CardDescription>统一查看当前项目的识别信息、统计范围和当前分析状态。</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {infoRows.map((row) => (
            <div key={row.id}>
              <div className="text-sm text-slate-500">{row.label}</div>
              <div className="mt-1 font-medium">{row.value}</div>
            </div>
          ))}
          <div>
            <div className="text-sm text-slate-500">状态</div>
            <div className="mt-1 font-medium">{focusProjectIsFavorite ? '已收藏 / 常用项目' : '普通项目'}</div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}
