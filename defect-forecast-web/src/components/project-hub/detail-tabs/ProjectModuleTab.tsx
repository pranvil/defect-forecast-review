import { lazy, Suspense } from 'react'
import { TabsContent } from '@/components/ui/tabs'

const BugBoardPage = lazy(async () => {
  const mod = await import('@/components/pages/BugBoardPage')
  return { default: mod.BugBoardPage }
})

type ProjectModuleTabProps = {
  focusProject: string
}

export function ProjectModuleTab({ focusProject }: ProjectModuleTabProps) {
  return (
    <TabsContent value="module" className="space-y-4">
      <Suspense fallback={<div className="rounded-2xl border bg-white px-4 py-6 text-sm text-slate-500">模块分布加载中...</div>}>
        <BugBoardPage embedded defaultPrimaryProjectKey={focusProject} />
      </Suspense>
    </TabsContent>
  )
}
