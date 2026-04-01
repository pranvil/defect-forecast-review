import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import * as React from 'react'
import { toast } from 'sonner'
import type { ProjectSummary } from '@/services/projectService'
import { services } from '@/services'
import type { JiraFetchResult } from '@/services/jiraService'

export function JiraPage() {
  const [cachedProjects, setCachedProjects] = React.useState<ProjectSummary[]>([])
  const [projectKey, setProjectKey] = React.useState('MONETNPDISH')
  const [startWeek, setStartWeek] = React.useState('26W2')
  const [endWeek, setEndWeek] = React.useState('26W27')
  const [jql, setJql] = React.useState(
    `project = MONETNPDISH\nAND issuetype in (defect, bug)\nAND created >= 2026-01-01\nAND created <= 2026-06-30`,
  )
  const [isFetching, setIsFetching] = React.useState(false)
  const [lastResult, setLastResult] = React.useState<JiraFetchResult | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void services.jiraService.listCachedProjects().then((rows) => {
      if (cancelled) return
      setCachedProjects(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const refreshCache = async () => {
    const rows = await services.jiraService.listCachedProjects()
    setCachedProjects(rows)
  }

  const runFetch = async (mode: 'normal' | 'incremental' | 'overwrite') => {
    setIsFetching(true)
    try {
      const res = await services.jiraService.fetchByJql({
        projectKey,
        startWeek,
        endWeek,
        jql,
      })
      setLastResult(res)

      await services.projectService.upsertCachedProjects([
        {
          name: projectKey,
          cycle: `${startWeek}-${endWeek}`,
          defects: res.fetchedCount,
          teams: Math.max(1, Math.round(res.fetchedCount / 200)),
        },
      ])
      await refreshCache()

      toast('同步成功', {
        description:
          mode === 'normal'
            ? `抓取 ${res.fetchedCount} 条`
            : mode === 'incremental'
              ? `增量更新 ${res.fetchedCount} 条（mock）`
              : `覆盖重拉 ${res.fetchedCount} 条（mock）`,
      })
    } catch {
      toast('同步失败', { description: 'mock service 调用失败' })
    } finally {
      setIsFetching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">JIRA 数据获取</h2>
        <p className="mt-1 text-sm text-slate-500">
          支持直接输入 JQL。周期统一显示成业务周格式，例如 26W2-26W27。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl xl:col-span-2">
          <CardHeader>
            <CardTitle>拉数条件</CardTitle>
            <CardDescription>
              用户可以直接输入 JQL，也可以通过项目周期辅助理解当前抓取范围
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>项目 Key</Label>
                <Input value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>开始周期</Label>
                <Input value={startWeek} onChange={(e) => setStartWeek(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>结束周期</Label>
                <Input value={endWeek} onChange={(e) => setEndWeek(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>JQL 输入</Label>
              <textarea
                className="min-h-[140px] w-full rounded-2xl border bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={jql}
                onChange={(e) => setJql(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button className="rounded-2xl" disabled={isFetching} onClick={() => void runFetch('normal')}>
                抓取数据
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                disabled={isFetching}
                onClick={() => void runFetch('incremental')}
              >
                增量更新
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                disabled={isFetching}
                onClick={() => void runFetch('overwrite')}
              >
                覆盖重拉
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>抓取结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-slate-500">最近一次同步</div>
              <div className="mt-1 font-medium">
                {lastResult ? new Date(lastResult.syncedAt).toLocaleString() : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">周期</div>
              <div className="mt-1 font-medium">
                {lastResult ? lastResult.cycleLabel : `${startWeek} - ${endWeek}`}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">本次抓取</div>
              <div className="mt-1 font-medium">
                {lastResult ? `${lastResult.fetchedCount} 条` : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">写入数据库</div>
              <div className="mt-1 font-medium">
                {lastResult ? `${lastResult.writtenCount} / ${lastResult.fetchedCount}` : '-'}
              </div>
            </div>
            <Progress value={isFetching ? 60 : lastResult?.status === 'success' ? 100 : 0} />
            <Badge className="rounded-xl">
              {isFetching ? '同步中' : lastResult?.status === 'success' ? '同步成功' : '未同步'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>历史项目缓存</CardTitle>
          <CardDescription>给后续历史项目对比和相似项目识别使用</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>项目</TableHead>
                <TableHead>周期</TableHead>
                <TableHead>Defect 数</TableHead>
                <TableHead>团队数</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cachedProjects.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.cycle}</TableCell>
                  <TableCell>{p.defects}</TableCell>
                  <TableCell>{p.teams}</TableCell>
                  <TableCell>
                    <Badge variant="outline">已缓存</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
