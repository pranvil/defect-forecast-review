import type { ProjectHistory } from '@/types/project'

export interface ProjectSummary {
  name: string
  cycle: string
  defects: number
  teams: number
  similarity?: number
}

export interface ProjectService {
  listCachedProjects(): Promise<ProjectSummary[]>
  getProjectHistory(projectName: string): Promise<ProjectHistory>
  /**
   * For history compare chart (Created trends) by week label.
   * Each row has a `week` field plus a key per selected project.
   */
  buildCreatedCompareData(projectNames: string[]): Promise<Record<string, string | number>[]>
  getCompareColors(): Promise<string[]>
  upsertCachedProjects(projects: ProjectSummary[]): Promise<void>
}

