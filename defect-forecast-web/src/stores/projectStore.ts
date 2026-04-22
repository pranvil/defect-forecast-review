import { create } from 'zustand'

export type AppSection =
  | 'config'
  | 'jira'
  | 'history'
  | 'bugBoard'
  | 'params'
  | 'forecast'

type ProjectState = {
  activeSection: AppSection
  setActiveSection: (section: AppSection) => void
  selectedProjects: string[]
  setSelectedProjects: (projects: string[]) => void
  focusProject: string
  setFocusProject: (project: string) => void
  toggleSelectedProject: (name: string) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  activeSection: 'history',
  setActiveSection: (activeSection) => set({ activeSection }),
  selectedProjects: [],
  setSelectedProjects: (selectedProjects) => set({ selectedProjects }),
  focusProject: '',
  setFocusProject: (focusProject) => set({ focusProject }),
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
