import * as React from 'react'
import { AlertCircle, Download, FileSpreadsheet, RefreshCw, Search, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { services } from '@/services'
import type { BlockIssueBatchResult, BlockIssueRow } from '@/services/blockIssueService'
import { useSettingsStore } from '@/stores/settingsStore'

const DEFAULT_PROJECT_KEY = ''
const MAIN_CEA_OPTIONS = ['ShowStopper', 'TOP', 'BLOCK', 'BUGASS'] as const

function defaultDeadline() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function downloadUrl(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = ''
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function downloadExcelHtml(filename: string, title: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escapeHtml = (value: string | number | null | undefined) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  const headerHtml = headers
    .map((h) => `<th style="border:1px solid #d1d5db;padding:6px 8px;background:#f8fafc;">${escapeHtml(h)}</th>`)
    .join('')
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td style="border:1px solid #d1d5db;padding:6px 8px;">${escapeHtml(cell)}</td>`)
          .join('')}</tr>`,
    )
    .join('')
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><h2>${escapeHtml(title)}</h2><table style="border-collapse:collapse;font-size:12px;"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></body></html>`
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function resultTone(status: string) {
  if (status === 'updated') return 'text-emerald-700'
  if (status === 'skipped') return 'text-amber-700'
  return 'text-rose-700'
}

export function BlockIssuesPage() {
  const jiraConnection = useSettingsStore((s) => s.jiraConnection)
  const [projectKey, setProjectKey] = React.useState(DEFAULT_PROJECT_KEY)
  const [issues, setIssues] = React.useState<BlockIssueRow[]>([])
  const [issueTotal, setIssueTotal] = React.useState(0)
  const [lastJql, setLastJql] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [issueKey, setIssueKey] = React.useState('')
  const [mainCea, setMainCea] = React.useState<(typeof MAIN_CEA_OPTIONS)[number]>('BLOCK')
  const [additional, setAdditional] = React.useState('')
  const [deadline, setDeadline] = React.useState(defaultDeadline())
  const [comment, setComment] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const [batching, setBatching] = React.useState(false)
  const [batchResult, setBatchResult] = React.useState<BlockIssueBatchResult | null>(null)
  const [allowExistingMainCeaComment, setAllowExistingMainCeaComment] = React.useState(false)
  const [allowOtherStatuses, setAllowOtherStatuses] = React.useState(false)

  const requestBase = React.useMemo(
    () => ({
      projectKey: projectKey.trim().toUpperCase(),
      startWeek: '',
      endWeek: '',
      pullMode: 'jql' as const,
      jql: '',
      startDate: '',
      endDate: '',
      mode: 'normal' as const,
      ...jiraConnection,
    }),
    [jiraConnection, projectKey],
  )

  const search = async () => {
    const key = projectKey.trim().toUpperCase()
    if (!key) {
      toast('拉取失败', { description: '请填写项目 Key' })
      return
    }
    setLoading(true)
    try {
      const res = await services.blockIssueService.search({ ...requestBase, projectKey: key })
      setIssues(res.issues)
      setIssueTotal(res.total)
      setLastJql(res.jql)
      toast('拉取完成', { description: `共找到 ${res.total} 条 Block 问题` })
    } catch (e) {
      toast('拉取失败', { description: e instanceof Error ? e.message : '服务调用失败' })
    } finally {
      setLoading(false)
    }
  }

  const submitSingle = async () => {
    const key = issueKey.trim().toUpperCase()
    if (!key) {
      toast('提交失败', { description: '请填写 Issue Key' })
      return
    }
    setSubmitting(true)
    try {
      const res = await services.blockIssueService.mark({
        ...requestBase,
        projectKey: requestBase.projectKey || key.split('-')[0] || 'BLOCK',
        issueKey: key,
        mainCeaComment: mainCea,
        additionalCeaComment: additional,
        deadline: deadline || defaultDeadline(),
        comment,
        allowExistingMainCeaComment,
        allowOtherStatuses,
      })
      toast(res.status === 'updated' ? '提交完成' : res.status === 'skipped' ? '已跳过' : '提交失败', {
        description: `${res.issueKey}: ${res.message}`,
      })
      if (res.status === 'updated') {
        setIssueKey('')
        setComment('')
        if (projectKey.trim()) void search()
      }
    } catch (e) {
      toast('提交失败', { description: e instanceof Error ? e.message : '服务调用失败' })
    } finally {
      setSubmitting(false)
    }
  }

  const submitBatch = async () => {
    if (!file) {
      toast('批量提交失败', { description: '请先选择 Excel 文件' })
      return
    }
    setBatching(true)
    try {
      const res = await services.blockIssueService.batchMark({
        req: requestBase,
        file,
        allowExistingMainCeaComment,
        allowOtherStatuses,
      })
      setBatchResult(res)
      toast('批量处理完成', {
        description: `总计 ${res.totalRows} 条，更新 ${res.updated}，跳过 ${res.skipped}，失败 ${res.failed}`,
      })
      if (projectKey.trim()) void search()
    } catch (e) {
      toast('批量提交失败', { description: e instanceof Error ? e.message : '服务调用失败' })
    } finally {
      setBatching(false)
    }
  }

  const exportIssues = () => {
    if (!issues.length) {
      toast('无可导出数据', { description: '请先拉取 Block 问题列表' })
      return
    }
    const key = projectKey.trim().toUpperCase() || 'block'
    downloadExcelHtml(
      `block-issues.${key}.${new Date().toISOString().slice(0, 10)}.xls`,
      `${key} Block 问题列表`,
      ['Defect Key', 'Summary', 'Status', 'IPR', 'Main CEA Comment', 'Additional CEA Comment', 'Deadline'],
      issues.map((issue) => [
        issue.key,
        issue.summary,
        issue.status,
        issue.ipr ?? '',
        issue.mainCeaComment,
        issue.additionalCeaComment,
        issue.deadline,
      ]),
    )
    toast('已导出', { description: `共导出 ${issues.length} 条 Block 问题` })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Block问题</h2>
          <p className="mt-1 text-sm text-slate-500">
            拉取指定项目当前已标记阻塞类 Main CEA Comment 的 Defect，并支持单个或批量追加标记与 Jira comment。
          </p>
        </div>
        <Button type="button" variant="outline" className="rounded-2xl" onClick={() => downloadUrl(services.blockIssueService.getTemplateUrl())}>
          <Download className="h-4 w-4" />
          下载模板
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Block 问题列表</CardTitle>
          <CardDescription>查询 Defect/defect_new，状态为 MORE INFO、ASSIGNED、OPENED，且 Main CEA Comment 为 ShowStopper、TOP、BLOCK、BUGASS 的问题。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[280px_auto_auto]">
            <div className="space-y-2">
              <Label>项目 Key</Label>
              <Input value={projectKey} onChange={(e) => setProjectKey(e.target.value.toUpperCase())} className="rounded-2xl font-mono" />
            </div>
            <div className="flex items-end gap-2">
              <Button className="rounded-2xl" disabled={loading} onClick={() => void search()}>
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                拉取列表
              </Button>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" className="rounded-2xl" disabled={!issues.length} onClick={exportIssues}>
                <FileSpreadsheet className="h-4 w-4" />
                导出 Excel
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm text-slate-600">当前列表 Issue 总数</div>
            <div className="text-2xl font-semibold text-slate-900">{issueTotal}</div>
          </div>
          {lastJql ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-600">
              {lastJql}
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[130px]">Defect Key</TableHead>
                  <TableHead className="min-w-[320px]">Summary</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                  <TableHead className="min-w-[100px] text-right">IPR</TableHead>
                  <TableHead className="min-w-[170px]">Main CEA Comment</TableHead>
                  <TableHead className="min-w-[180px]">Additional CEA Comment</TableHead>
                  <TableHead className="min-w-[120px]">Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.key}>
                    <TableCell className="font-mono font-medium">{issue.key}</TableCell>
                    <TableCell>{issue.summary || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{issue.status || '-'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{issue.ipr ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{issue.mainCeaComment || '-'}</Badge>
                    </TableCell>
                    <TableCell>{issue.additionalCeaComment || '-'}</TableCell>
                    <TableCell>{issue.deadline || '-'}</TableCell>
                  </TableRow>
                ))}
                {!issues.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500">
                      {loading ? '正在拉取...' : '暂无数据'}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>单个添加阻塞标记</CardTitle>
            <CardDescription>提交前会检查 Main CEA Comment，已有阻塞类标记的 issue 会跳过。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Issue Key</Label>
                <Input value={issueKey} onChange={(e) => setIssueKey(e.target.value.toUpperCase())} placeholder="例如 MNTNPOM-123" className="rounded-2xl font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Main CEA Comment</Label>
                <Select value={mainCea} onValueChange={(v) => setMainCea(v as (typeof MAIN_CEA_OPTIONS)[number])}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAIN_CEA_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Additional CEA Comment</Label>
                <Input value={additional} onChange={(e) => setAdditional(e.target.value)} placeholder="例如 LE1" className="rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="rounded-2xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Comment</Label>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="写入 Jira 标准 comment" className="min-h-[110px] rounded-2xl" />
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="single-allow-existing-main-cea"
                  checked={allowExistingMainCeaComment}
                  onCheckedChange={(checked) => setAllowExistingMainCeaComment(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="single-allow-existing-main-cea">不跳过已有 Main CEA Comment 的问题</Label>
                  <p className="text-xs leading-5 text-slate-500">勾选后即使当前 Main CEA Comment 已有阻塞类值，也会按本次输入覆盖提交。</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="single-allow-other-statuses"
                  checked={allowOtherStatuses}
                  onCheckedChange={(checked) => setAllowOtherStatuses(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="single-allow-other-statuses">不跳过非 MORE INFO / ASSIGNED / OPENED 状态的问题</Label>
                  <p className="text-xs leading-5 text-slate-500">勾选后状态不在默认范围内也允许提交 Block 标记。</p>
                </div>
              </div>
            </div>
            <Button className="rounded-2xl" disabled={submitting} onClick={() => void submitSingle()}>
              <Tag className="h-4 w-4" />
              提交阻塞标记
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>批量标记 Block</CardTitle>
            <CardDescription>Excel 列顺序：KEY、Summary、Block理由、Main CEA Comment、Additional CEA Comment、Deadline；Deadline 为空时默认当天加一周。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="flex items-center gap-2 font-medium">
                <FileSpreadsheet className="h-4 w-4" />
                Excel 批量文件
              </div>
              <div className="mt-2 text-xs text-slate-500">
                C 列会作为 Jira comment，D 列写入 Main CEA Comment，E 列写入 Additional CEA Comment。
              </div>
            </div>
            <Input type="file" accept=".xlsx,.xlsm" className="rounded-2xl" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="batch-allow-existing-main-cea"
                  checked={allowExistingMainCeaComment}
                  onCheckedChange={(checked) => setAllowExistingMainCeaComment(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="batch-allow-existing-main-cea">不跳过已有 Main CEA Comment 的问题</Label>
                  <p className="text-xs leading-5 text-slate-500">勾选后批量处理会覆盖已有阻塞类 Main CEA Comment。</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="batch-allow-other-statuses"
                  checked={allowOtherStatuses}
                  onCheckedChange={(checked) => setAllowOtherStatuses(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="batch-allow-other-statuses">不跳过非 MORE INFO / ASSIGNED / OPENED 状态的问题</Label>
                  <p className="text-xs leading-5 text-slate-500">勾选后批量处理不再因状态超出默认范围而跳过。</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-2xl" disabled={batching} onClick={() => void submitBatch()}>
                {batching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                执行批量标记
              </Button>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => downloadUrl(services.blockIssueService.getTemplateUrl())}>
                <Download className="h-4 w-4" />
                下载 Excel 模板
              </Button>
            </div>
            {batchResult ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div className="rounded-2xl border bg-white p-3"><div className="text-slate-500">总计</div><div className="text-lg font-semibold">{batchResult.totalRows}</div></div>
                  <div className="rounded-2xl border bg-white p-3"><div className="text-slate-500">更新</div><div className="text-lg font-semibold text-emerald-700">{batchResult.updated}</div></div>
                  <div className="rounded-2xl border bg-white p-3"><div className="text-slate-500">跳过</div><div className="text-lg font-semibold text-amber-700">{batchResult.skipped}</div></div>
                  <div className="rounded-2xl border bg-white p-3"><div className="text-slate-500">失败</div><div className="text-lg font-semibold text-rose-700">{batchResult.failed}</div></div>
                </div>
                <div className="max-h-64 overflow-auto rounded-2xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Issue</TableHead>
                        <TableHead>结果</TableHead>
                        <TableHead>说明</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchResult.results.map((r) => (
                        <TableRow key={`${r.issueKey}-${r.status}-${r.message}`}>
                          <TableCell className="font-mono">{r.issueKey}</TableCell>
                          <TableCell className={resultTone(r.status)}>{r.status}</TableCell>
                          <TableCell>{r.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                已有 BLOCK 标记的问题会自动跳过，并在结果里汇总。
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
