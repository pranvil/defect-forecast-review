import type { BugDistService, BugDistTaskStatus } from '@/services/bugDistService'
import { delay } from '@/services/delay'

function pseudoCountFromString(s: string): number {
  let acc = 0
  for (let i = 0; i < s.length; i += 1) acc = (acc + s.charCodeAt(i) * (i + 1)) % 2000
  return 80 + acc
}

function makeRows(prefix: string, n: number, seed: string) {
  const rows = Array.from({ length: n }).map((_, idx) => {
    const primary = Math.max(0, Math.round((pseudoCountFromString(`${seed}|p|${idx}`) * (n - idx)) / n))
    const compare = Math.max(0, Math.round((pseudoCountFromString(`${seed}|c|${idx}`) * (n - idx)) / n))
    return { name: `${prefix}-${idx + 1}`, primary, compare, gap: compare - primary }
  })
  rows.sort((a, b) => b.primary - a.primary)
  return rows
}

const store = new Map<string, BugDistTaskStatus>()

export const bugDistServiceMock: BugDistService = {
  async createTask(req) {
    await delay(200)
    const taskId = `mock-${crypto.randomUUID()}`
    store.set(taskId, {
      taskId,
      status: 'running',
      progress: { pageSize: 200, startAt: 0, fetched: 0, total: 5000, message: '拉取主项目中…' },
      error: '',
    })
    // simulate async completion
    void (async () => {
      await delay(500)
      store.set(taskId, {
        taskId,
        status: 'success',
        progress: { pageSize: 200, startAt: 5000, fetched: 5000, total: 5000, message: '完成' },
        error: '',
        result: {
          primaryProjectKey: req.primaryProjectKey,
          compareProjectKey: req.compareProjectKey,
          generatedAt: new Date().toISOString(),
          cached: false,
          module: {
            rows: makeRows('Component', 30, `${req.primaryProjectKey}|${req.compareProjectKey}`),
            top15: makeRows('Component', 30, `${req.primaryProjectKey}|${req.compareProjectKey}`).slice(0, 15),
          },
          team: {
            rows: makeRows('Team', 18, `${req.primaryProjectKey}|${req.compareProjectKey}`),
            top15: [],
          },
        },
      })
    })()
    return { taskId }
  },
  async getTaskStatus(taskId) {
    await delay(100)
    return (
      store.get(taskId) ?? {
        taskId,
        status: 'failed',
        progress: { pageSize: 0, startAt: 0, fetched: 0, total: 0, message: '' },
        error: '任务不存在',
      }
    )
  },
  getExportUrl({ taskId, tab, format }) {
    // mock mode: just point to API endpoint (may not exist), caller can ignore
    return `/api/bug-dist/export?taskId=${encodeURIComponent(taskId)}&tab=${tab}&format=${format}`
  },
}

