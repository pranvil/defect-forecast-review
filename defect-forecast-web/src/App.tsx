import { lazy, Suspense } from 'react'
import { AppUrlStateSync } from '@/components/app/AppUrlStateSync'
import { Sidebar } from '@/components/layout/Sidebar'
import { Toaster } from '@/components/ui/sonner'
import { useProjectStore } from '@/stores/projectStore'

const ProjectHubPage = lazy(async () => {
  const mod = await import('@/components/pages/ProjectHubPage')
  return { default: mod.ProjectHubPage }
})

const ConfigPage = lazy(async () => {
  const mod = await import('@/components/pages/ConfigPage')
  return { default: mod.ConfigPage }
})

const ForecastPage = lazy(async () => {
  const mod = await import('@/components/pages/ForecastPage')
  return { default: mod.ForecastPage }
})

const ParamsPage = lazy(async () => {
  const mod = await import('@/components/pages/ParamsPage')
  return { default: mod.ParamsPage }
})

const BlockIssuesPage = lazy(async () => {
  const mod = await import('@/components/pages/BlockIssuesPage')
  return { default: mod.BlockIssuesPage }
})

export default function App() {
  const activeSection = useProjectStore((s) => s.activeSection)
  const setActiveSection = useProjectStore((s) => s.setActiveSection)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppUrlStateSync />
      <div className="flex min-h-screen">
        <Sidebar current={activeSection} onNavigate={setActiveSection} />
        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <Suspense fallback={<div className="rounded-2xl border bg-white px-4 py-6 text-sm text-slate-500">页面加载中...</div>}>
            {activeSection === 'config' && <ConfigPage />}
            {activeSection === 'projectHub' && <ProjectHubPage />}
            {activeSection === 'forecastInput' && <ParamsPage />}
            {activeSection === 'forecastResult' && <ForecastPage />}
            {activeSection === 'blockIssues' && <BlockIssuesPage />}
          </Suspense>
        </main>
      </div>
      <Toaster richColors />
    </div>
  )
}
