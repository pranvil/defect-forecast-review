import { delay } from '@/services/delay'
import type {
  BlockIssueBatchResult,
  BlockIssueMarkRequest,
  BlockIssueMarkResult,
  BlockIssueSearchResult,
  BlockIssueService,
} from '@/services/blockIssueService'

export const blockIssueServiceMock: BlockIssueService = {
  async search(req): Promise<BlockIssueSearchResult> {
    await delay(250)
    const key = req.projectKey.trim().toUpperCase() || 'MNTNPOM'
    return {
      projectKey: key,
      jql: `project = ${key} AND issuetype in (Defect, defect_new) AND status in ("MORE INFO", "ASSIGNED", "OPENED")`,
      total: 2,
      issues: [
        {
          key: `${key}-101`,
          summary: '关键验证路径阻塞',
          status: 'OPENED',
          ipr: 640,
          mainCeaComment: 'BLOCK',
          additionalCeaComment: 'LE1',
          deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        },
        {
          key: `${key}-128`,
          summary: '版本合入后回归失败',
          status: 'ASSIGNED',
          ipr: 420,
          mainCeaComment: 'TOP',
          additionalCeaComment: 'LE2',
          deadline: new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10),
        },
      ],
    }
  },
  async mark(req: BlockIssueMarkRequest): Promise<BlockIssueMarkResult> {
    await delay(250)
    return {
      issueKey: req.issueKey.trim().toUpperCase(),
      status: 'updated',
      message: '已添加 BLOCK 标记',
      commentStatus: req.comment.trim() ? 'added' : 'not_requested',
    }
  },
  async batchMark(): Promise<BlockIssueBatchResult> {
    await delay(500)
    return {
      totalRows: 3,
      updated: 2,
      skipped: 1,
      failed: 0,
      results: [
        { issueKey: 'MNTNPOM-101', status: 'updated', message: '已添加 BLOCK 标记', commentStatus: 'added' },
        { issueKey: 'MNTNPOM-102', status: 'skipped', message: '已有 BLOCK 标记，已跳过', commentStatus: 'not_requested' },
        { issueKey: 'MNTNPOM-103', status: 'updated', message: '已添加 BLOCK 标记', commentStatus: 'added' },
      ],
    }
  },
  getTemplateUrl() {
    return '#'
  },
}
