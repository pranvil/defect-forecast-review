import type { ProjectSummary } from '@/services/projectService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TabsContent } from '@/components/ui/tabs'

type ProjectInfoTabProps = {
  focusProjectSummary?: ProjectSummary | null
  focusProjectIsFavorite: boolean
}

export function ProjectInfoTab({ focusProjectSummary, focusProjectIsFavorite }: ProjectInfoTabProps) {
  return (
    <TabsContent value="info" className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>项目信息</CardTitle>
          <CardDescription>统一查看当前项目的识别信息、统计范围和当前分析状态。</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm text-slate-500">显示名称</div>
            <div className="mt-1 font-medium">{focusProjectSummary?.displayName?.trim() || '未设置'}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Project Key</div>
            <div className="mt-1 font-medium">{focusProjectSummary?.name || '—'}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">周期</div>
            <div className="mt-1 font-medium">{focusProjectSummary?.cycle || '—'}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">累计 Defect</div>
            <div className="mt-1 font-medium">{focusProjectSummary?.defects ?? 0}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">团队数</div>
            <div className="mt-1 font-medium">{focusProjectSummary?.teams ?? 0}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">状态</div>
            <div className="mt-1 font-medium">{focusProjectIsFavorite ? '已收藏 / 常用项目' : '普通项目'}</div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}
