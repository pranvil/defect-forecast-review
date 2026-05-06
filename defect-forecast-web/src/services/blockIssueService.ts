import { API_BASE, httpPost } from '@/services/http'
import type { JiraFetchRequest } from '@/services/jiraService'

export interface BlockIssueRow {
  key: string
  summary: string
  status: string
  ipr?: number | null
  mainCeaComment: string
  additionalCeaComment: string
  deadline: string
}

export interface BlockIssueSearchResult {
  projectKey: string
  jql: string
  total: number
  issues: BlockIssueRow[]
}

export interface BlockIssueMarkRequest extends JiraFetchRequest {
  issueKey: string
  mainCeaComment: string
  additionalCeaComment: string
  deadline: string
  comment: string
  allowExistingMainCeaComment?: boolean
  allowOtherStatuses?: boolean
}

export interface BlockIssueMarkResult {
  issueKey: string
  status: 'updated' | 'skipped' | 'failed'
  message: string
  commentStatus: 'not_requested' | 'added' | 'failed'
}

export interface BlockIssueBatchResult {
  totalRows: number
  updated: number
  skipped: number
  failed: number
  results: BlockIssueMarkResult[]
}

export interface BlockIssueService {
  search(req: JiraFetchRequest): Promise<BlockIssueSearchResult>
  mark(req: BlockIssueMarkRequest): Promise<BlockIssueMarkResult>
  batchMark(params: { req: JiraFetchRequest; file: File; allowExistingMainCeaComment?: boolean; allowOtherStatuses?: boolean }): Promise<BlockIssueBatchResult>
  getTemplateUrl(): string
}

export const blockIssueServiceApi: BlockIssueService = {
  async search(req) {
    return httpPost<JiraFetchRequest, BlockIssueSearchResult>('/api/block-issues/search', req)
  },
  async mark(req) {
    return httpPost<BlockIssueMarkRequest, BlockIssueMarkResult>('/api/block-issues/mark', req)
  },
  async batchMark({ req, file, allowExistingMainCeaComment = false, allowOtherStatuses = false }) {
    const form = new FormData()
    form.set('file', file)
    form.set('projectKey', req.projectKey || 'BLOCK')
    form.set('baseUrl', req.baseUrl)
    form.set('authType', req.authType)
    form.set('username', req.username)
    form.set('token', req.token)
    form.set('verifySsl', String(req.verifySsl))
    form.set('timeoutSec', String(req.timeoutSec))
    form.set('allowExistingMainCeaComment', String(allowExistingMainCeaComment))
    form.set('allowOtherStatuses', String(allowOtherStatuses))
    const res = await fetch(`${API_BASE}/api/block-issues/batch`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `批量提交失败: ${res.status}`)
    }
    return (await res.json()) as BlockIssueBatchResult
  },
  getTemplateUrl() {
    return `${API_BASE}/api/block-issues/template`
  },
}
