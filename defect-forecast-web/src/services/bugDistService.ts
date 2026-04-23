import { API_BASE, httpGet, httpPost } from '@/services/http'

export interface BugDistCreateTaskRequest {
  primaryProjectKey: string
  compareProjectKey: string
  forceRefresh: boolean
  startDate?: string
  endDate?: string
  teamFieldPath?: string
  issueTypeClause?: string
  baseUrl: string
  authType: 'pat' | 'basic'
  username: string
  token: string
  verifySsl: boolean
  timeoutSec: number
}

export type BugDistStatus = 'running' | 'success' | 'failed'

export interface BugDistTaskProgress {
  pageSize: number
  startAt: number
  fetched: number
  total: number
  message: string
}

export interface BugDistCountRow {
  name: string
  primary: number
  compare: number
  gap: number
}

export interface BugDistTabResult {
  rows: BugDistCountRow[]
  top15: BugDistCountRow[]
}

export interface BugDistTaskResult {
  primaryProjectKey: string
  compareProjectKey: string
  generatedAt: string
  cached: boolean
  /** 主项目拉取到的 Defect 条数（旧缓存可能缺省，由前端从 module 行汇总兜底） */
  primaryIssueCount?: number
  /** 对比项目 Defect 条数（无对比项目时为 0） */
  compareIssueCount?: number
  module: BugDistTabResult
  team: BugDistTabResult
}

export interface BugDistTaskStatus {
  taskId: string
  status: BugDistStatus
  progress: BugDistTaskProgress
  result?: BugDistTaskResult
  error: string
}

export interface BugDistService {
  createTask(req: BugDistCreateTaskRequest): Promise<{ taskId: string }>
  getTaskStatus(taskId: string): Promise<BugDistTaskStatus>
  getExportUrl(params: { taskId: string; tab: 'module' | 'team'; format: 'csv' | 'xlsx' }): string
}

export const bugDistServiceApi: BugDistService = {
  async createTask(req) {
    return httpPost<BugDistCreateTaskRequest, { taskId: string }>('/api/bug-dist/tasks', req)
  },
  async getTaskStatus(taskId) {
    return httpGet<BugDistTaskStatus>(`/api/bug-dist/tasks/${encodeURIComponent(taskId)}`)
  },
  getExportUrl({ taskId, tab, format }) {
    const query = new URLSearchParams({
      taskId,
      tab,
      format,
    })
    return `${API_BASE}/api/bug-dist/export?${query.toString()}`
  },
}
