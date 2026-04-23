import { create } from 'zustand'

export type AppSection = 'projectHub' | 'forecastInput' | 'forecastResult' | 'config'

export type ProjectHubView = 'library' | 'import' | 'detail'
export type ProjectDetailTab = 'overview' | 'trend' | 'team' | 'module' | 'compare' | 'info'

type ProjectState = {
  activeSection: AppSection
  setActiveSection: (section: AppSection) => void
  projectHubView: ProjectHubView
  setProjectHubView: (view: ProjectHubView) => void
  openProjectHub: (view?: ProjectHubView) => void
  projectDetailTab: ProjectDetailTab
  setProjectDetailTab: (tab: ProjectDetailTab) => void
  selectedProjects: string[]
  setSelectedProjects: (projects: string[]) => void
  focusProject: string
  setFocusProject: (project: string) => void
  openProjectDetail: (project: string, options?: { ensureSelected?: boolean; tab?: ProjectDetailTab }) => void
  toggleSelectedProject: (name: string) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  activeSection: 'projectHub',
  setActiveSection: (activeSection) => set({ activeSection }),
  projectHubView: 'library',
  setProjectHubView: (projectHubView) => set({ projectHubView }),
  openProjectHub: (view = 'library') =>
    set({
      activeSection: 'projectHub',
      projectHubView: view,
    }),
  projectDetailTab: 'overview',
  setProjectDetailTab: (projectDetailTab) => set({ projectDetailTab }),
  selectedProjects: [],
  setSelectedProjects: (selectedProjects) => set({ selectedProjects }),
  focusProject: '',
  setFocusProject: (focusProject) => set({ focusProject }),
  openProjectDetail: (project, options) => {
    const projectName = project.trim()
    if (!projectName) return
    const ensureSelected = options?.ensureSelected ?? true
    const { selectedProjects } = get()
    const nextSelected =
      ensureSelected && !selectedProjects.includes(projectName)
        ? selectedProjects.length
          ? [...selectedProjects, projectName]
          : [projectName]
        : selectedProjects.length
          ? selectedProjects
          : [projectName]
    set({
      activeSection: 'projectHub',
      projectHubView: 'detail',
      projectDetailTab: options?.tab ?? 'overview',
      focusProject: projectName,
      selectedProjects: nextSelected,
    })
  },
  toggleSelectedProject: (name) => {
    const { selectedProjects, focusProject } = get()
    if (selectedProjects.includes(name)) {
      const next = selectedProjects.filter((x) => x !== name)
      const nextSelected = next.length ? next : [name]
      set({ selectedProjects: nextSelected })
      if (focusProject === name && next.length) {
        set({ focusProject: next[0]! })
      }
    } else {
      set({ selectedProjects: [...selectedProjects, name] })
    }
  },
}))
