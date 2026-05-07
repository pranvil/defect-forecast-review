import { FolderKanban, LayoutList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HistoryPage } from '@/components/pages/HistoryPage'
import { useProjectStore } from '@/stores/projectStore'

export function ProjectHubPage() {
  const projectHubView = useProjectStore((s) => s.projectHubView)
  const setProjectHubView = useProjectStore((s) => s.setProjectHubView)
  const focusProject = useProjectStore((s) => s.focusProject)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">项目库</h2>
          <p className="mt-1 text-sm text-slate-500">
            统一管理本地项目、Jira 导入、单项目分析与对比分析。当前所有历史项目、Jira 实际与缺陷分布能力都从这里进入。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-2xl border bg-white p-1">
          <Button
            type="button"
            size="sm"
            variant={projectHubView === 'library' ? 'secondary' : 'ghost'}
            className="rounded-xl"
            onClick={() => setProjectHubView('library')}
          >
            <LayoutList className="mr-1.5 h-4 w-4" />
            项目列表
          </Button>
          <Button
            type="button"
            size="sm"
            variant={projectHubView === 'detail' ? 'secondary' : 'ghost'}
            className="rounded-xl"
            onClick={() => setProjectHubView('detail')}
          >
            <FolderKanban className="mr-1.5 h-4 w-4" />
            {focusProject ? '项目详情' : '当前项目'}
          </Button>
        </div>
      </div>

      {projectHubView === 'library' || projectHubView === 'import' ? <HistoryPage mode="library" /> : null}
      {projectHubView === 'detail' ? <HistoryPage mode="detail" /> : null}
    </div>
  )
}
