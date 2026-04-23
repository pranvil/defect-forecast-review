import * as React from 'react'
import { useProjectStore, type AppSection, type ProjectDetailTab, type ProjectHubView } from '@/stores/projectStore'

const APP_SECTIONS: AppSection[] = ['projectHub', 'forecastInput', 'forecastResult', 'config']
const PROJECT_HUB_VIEWS: ProjectHubView[] = ['library', 'import', 'detail']
const PROJECT_DETAIL_TABS: ProjectDetailTab[] = ['overview', 'trend', 'team', 'module', 'compare', 'info']

function isAppSection(value: string | null): value is AppSection {
  return value != null && APP_SECTIONS.includes(value as AppSection)
}

function isProjectHubView(value: string | null): value is ProjectHubView {
  return value != null && PROJECT_HUB_VIEWS.includes(value as ProjectHubView)
}

function isProjectDetailTab(value: string | null): value is ProjectDetailTab {
  return value != null && PROJECT_DETAIL_TABS.includes(value as ProjectDetailTab)
}

function parseHash(hash: string) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) return null
  const query = raw.startsWith('?') ? raw.slice(1) : raw
  const params = new URLSearchParams(query)
  const sectionValue = params.get('section')
  const section = isAppSection(sectionValue) ? sectionValue : null
  if (!section) return null
  const viewValue = params.get('view')
  const view = isProjectHubView(viewValue) ? viewValue : 'library'
  const tabValue = params.get('tab')
  const tab = isProjectDetailTab(tabValue) ? tabValue : 'overview'
  const project = params.get('project')?.trim() ?? ''
  return { section, view, tab, project }
}

function buildHash(state: {
  activeSection: AppSection
  projectHubView: ProjectHubView
  focusProject: string
  projectDetailTab: ProjectDetailTab
}) {
  const params = new URLSearchParams()
  params.set('section', state.activeSection)
  if (state.activeSection === 'projectHub') {
    params.set('view', state.projectHubView)
    if (state.projectHubView === 'detail') {
      params.set('tab', state.projectDetailTab)
      if (state.focusProject.trim()) {
        params.set('project', state.focusProject.trim())
      }
    }
  }
  return `#${params.toString()}`
}

export function AppUrlStateSync() {
  const activeSection = useProjectStore((s) => s.activeSection)
  const projectHubView = useProjectStore((s) => s.projectHubView)
  const focusProject = useProjectStore((s) => s.focusProject)
  const projectDetailTab = useProjectStore((s) => s.projectDetailTab)
  const shouldReplaceNextRef = React.useRef(true)
  const isApplyingHashRef = React.useRef(false)

  React.useEffect(() => {
    const applyHash = () => {
      const parsed = parseHash(window.location.hash)
      if (!parsed) return
      isApplyingHashRef.current = true
      const state = useProjectStore.getState()

      if (state.activeSection !== parsed.section) {
        state.setActiveSection(parsed.section)
      }
      if (parsed.section !== 'projectHub') return

      if (state.projectHubView !== parsed.view) {
        state.setProjectHubView(parsed.view)
      }
      if (parsed.view === 'detail') {
        if (state.projectDetailTab !== parsed.tab) {
          state.setProjectDetailTab(parsed.tab)
        }
        if (parsed.project && state.focusProject !== parsed.project) {
          state.setFocusProject(parsed.project)
        }
      }
    }

    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  React.useEffect(() => {
    const nextHash = buildHash({
      activeSection,
      projectHubView,
      focusProject,
      projectDetailTab,
    })
    if (window.location.hash === nextHash) {
      isApplyingHashRef.current = false
      shouldReplaceNextRef.current = false
      return
    }
    if (isApplyingHashRef.current) return

    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`
    if (shouldReplaceNextRef.current || !window.location.hash) {
      window.history.replaceState(null, '', nextUrl)
      shouldReplaceNextRef.current = false
      return
    }
    window.history.pushState(null, '', nextUrl)
  }, [activeSection, projectHubView, focusProject, projectDetailTab])

  return null
}
