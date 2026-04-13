import { Sidebar } from '@/components/layout/Sidebar'
import { ConfigPage } from '@/components/pages/ConfigPage'
import { ForecastPage } from '@/components/pages/ForecastPage'
import { HistoryPage } from '@/components/pages/HistoryPage'
import { JiraPage } from '@/components/pages/JiraPage'
import { ParamsPage } from '@/components/pages/ParamsPage'
import { Toaster } from '@/components/ui/sonner'
import { useProjectStore } from '@/stores/projectStore'

export default function App() {
  const activeSection = useProjectStore((s) => s.activeSection)
  const setActiveSection = useProjectStore((s) => s.setActiveSection)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar current={activeSection} onNavigate={setActiveSection} />
        <main className="flex-1 p-6 lg:p-8">
          {activeSection === 'config' && <ConfigPage />}
          {activeSection === 'jira' && <JiraPage />}
          {activeSection === 'history' && <HistoryPage />}
          {activeSection === 'params' && <ParamsPage />}
          {activeSection === 'forecast' && <ForecastPage />}
        </main>
      </div>
      <Toaster richColors />
    </div>
  )
}
