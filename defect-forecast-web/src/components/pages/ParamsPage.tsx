import { Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import * as React from 'react'
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
import { services } from '@/services'
import { useForecastStore } from '@/stores/forecastStore'
import { useProjectStore } from '@/stores/projectStore'
import { useTeamStore } from '@/stores/teamStore'
import {
  ensureMilestoneDateIso,
  formatIsoDateLocal,
  milestoneMondayIsoToWeekLabel,
  milestoneWeekToMondayIso,
  mondayOfCalendarWeek,
  normalizeMilestoneDateToIso,
  parseIsoDateLocal,
} from '@/utils/week'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { MilestoneParam, RefProjectRow } from '@/types/forecast'

type MilestoneRatesForm = { dev: string; testComplete: string; testSubmit: string }

const emptyMilestoneRates = (): MilestoneRatesForm => ({
  dev: '',
  testComplete: '',
  testSubmit: '',
})

function optionalRateFromForm(s: string): number | undefined {
  const t = s.trim().replace(/%/g, '')
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

function formatOptionalPercent(n: number | undefined): string {
  return n === undefined ? '—' : `${n}%`
}

/** 由周期与日期输入得到规范化的周次 + 周一 ISO 日期；无法推算则返回 null。 */
function resolveMilestoneWeekAndDate(
  weekRaw: string,
  dateTextRaw: string,
): { week: string; date: string } | null {
  const weekTrim = weekRaw.trim()
  const dateT = dateTextRaw.trim()
  const fromText = dateT ? normalizeMilestoneDateToIso(dateT, weekTrim) : ''
  const fromWeek = milestoneWeekToMondayIso(weekTrim)
  const dateIso = fromText || fromWeek
  if (!dateIso) return null
  const weekFromDate = milestoneMondayIsoToWeekLabel(dateIso)
  const week = weekFromDate || weekTrim
  if (!week) return null
  return { week, date: dateIso }
}

function milestoneRowFromRates(
  base: Pick<MilestoneParam, 'name' | 'week' | 'date'>,
  rates: MilestoneRatesForm,
): MilestoneParam {
  const devResolutionRate = optionalRateFromForm(rates.dev)
  const testCompletionRate = optionalRateFromForm(rates.testComplete)
  const testSubmissionRate = optionalRateFromForm(rates.testSubmit)
  return {
    ...base,
    ...(devResolutionRate !== undefined ? { devResolutionRate } : {}),
    ...(testCompletionRate !== undefined ? { testCompletionRate } : {}),
    ...(testSubmissionRate !== undefined ? { testSubmissionRate } : {}),
  }
}

export function ParamsPage() {
  const hydrateDefaultsFromServer = useForecastStore((s) => s.hydrateDefaultsFromServer)
  const refProjects = useForecastStore((s) => s.refProjects)
  const removeRefProject = useForecastStore((s) => s.removeRefProject)
  const milestones = useForecastStore((s) => s.milestones)
  const addRefProject = useForecastStore((s) => s.addRefProject)
  const updateRefProject = useForecastStore((s) => s.updateRefProject)
  const addMilestone = useForecastStore((s) => s.addMilestone)
  const updateMilestone = useForecastStore((s) => s.updateMilestone)
  const removeMilestone = useForecastStore((s) => s.removeMilestone)
  const params = useForecastStore((s) => s.params)
  const setParams = useForecastStore((s) => s.setParams)
  const setActiveSection = useProjectStore((s) => s.setActiveSection)
  const teams = useTeamStore((s) => s.teams)
  const hydrateTeamsFromServer = useTeamStore((s) => s.hydrateFromServer)
  const toggleTeamEnabled = useTeamStore((s) => s.toggleTeamEnabled)

  const testingTeams = teams.filter((x) => x.type === 'testing')
  const devTeams = teams.filter((x) => x.type === 'development')

  const [projectCycleByName, setProjectCycleByName] = React.useState<Record<string, string>>({})
  const [projectDisplayNameByKey, setProjectDisplayNameByKey] = React.useState<Record<string, string>>({})
  const [allProjects, setAllProjects] = React.useState<string[]>([])
  const milestoneFileInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void services.projectService.listCachedProjects().then((rows) => {
      if (cancelled) return
      const map: Record<string, string> = {}
      const displayMap: Record<string, string> = {}
      rows.forEach((p) => {
        map[p.name] = p.cycle
        if (p.displayName?.trim()) displayMap[p.name] = p.displayName.trim()
      })
      setProjectCycleByName(map)
      setProjectDisplayNameByKey(displayMap)
      setAllProjects(rows.map((p) => p.name))
    })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    void hydrateDefaultsFromServer().catch((e: unknown) => {
      toast('预测默认参数加载失败', { description: e instanceof Error ? e.message : '服务不可用' })
    })
    void hydrateTeamsFromServer().catch((e: unknown) => {
      toast('团队数据加载失败', { description: e instanceof Error ? e.message : '服务不可用' })
    })
  }, [hydrateDefaultsFromServer, hydrateTeamsFromServer])

  const [isAddRefOpen, setIsAddRefOpen] = React.useState(false)
  const [refDraft, setRefDraft] = React.useState<RefProjectRow>({
    project: '',
    similarity: 75,
    source: '手工添加',
  })
  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = React.useState(false)
  const [milestoneDraft, setMilestoneDraft] = React.useState<MilestoneParam>({
    name: '',
    week: '',
    date: '',
  })
  const [isEditMilestoneOpen, setIsEditMilestoneOpen] = React.useState(false)
  const [editingMilestoneIndex, setEditingMilestoneIndex] = React.useState<number | null>(null)
  const [milestoneEditDraft, setMilestoneEditDraft] = React.useState<MilestoneParam>({
    name: '',
    week: '',
    date: '',
  })
  const [milestoneDraftRates, setMilestoneDraftRates] = React.useState<MilestoneRatesForm>(
    emptyMilestoneRates(),
  )
  const [milestoneEditRates, setMilestoneEditRates] = React.useState<MilestoneRatesForm>(
    emptyMilestoneRates(),
  )
  const [milestoneDateTextAdd, setMilestoneDateTextAdd] = React.useState('')
  const [milestoneDateTextEdit, setMilestoneDateTextEdit] = React.useState('')

  const [isReplaceRefOpen, setIsReplaceRefOpen] = React.useState(false)
  const [refEditingProjectKey, setRefEditingProjectKey] = React.useState<string | null>(null)
  const [refEditDraft, setRefEditDraft] = React.useState<RefProjectRow>({
    project: '',
    similarity: 75,
    source: '手工添加',
  })

  const autoIdentifyRefProjects = () => {
    const target = params.newProjectName.trim().toLowerCase()
    const byScore = allProjects
      .map((name) => {
        const normalized = name.toLowerCase()
        const overlap = normalized
          .split(/\s+/)
          .filter(Boolean)
          .filter((token) => target.includes(token)).length
        const base = overlap * 18 + (normalized[0] === target[0] ? 12 : 0)
        const score = Math.max(40, Math.min(96, base + (name.length % 11)))
        return { project: name, similarity: score, source: '系统识别' }
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4)
    if (!byScore.length) {
      toast('暂无可识别项目', { description: '请先在历史项目中准备缓存项目' })
      return
    }
    useForecastStore.getState().setRefProjects(byScore)
    toast('已识别相似项目', { description: `已更新 ${byScore.length} 条参考项目` })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">预测参数</h2>
        <p className="mt-1 text-sm text-slate-500">
          先填基础参数，再自动识别相似项目或手工维护参考项目；节点信息也作为基础参数单独维护。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>基础参数</CardTitle>
              <Button
                type="button"
                className="rounded-2xl px-6"
                onClick={() => setActiveSection('forecast')}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                开始预测
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>新项目名称</Label>
              <Input
                value={params.newProjectName}
                onChange={(e) => setParams({ newProjectName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>开始周期</Label>
              <Input
                value={params.startWeek}
                onChange={(e) => setParams({ startWeek: e.target.value })}
                placeholder="例如 26W2"
              />
            </div>
            <div className="space-y-2">
              <Label>结束周期</Label>
              <Input
                value={params.endWeek}
                onChange={(e) => setParams({ endWeek: e.target.value })}
                placeholder="例如 26W27"
              />
            </div>
            <div className="space-y-2">
              <Label>测试团队范围</Label>
              <Select defaultValue="default">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">默认测试团队</SelectItem>
                  <SelectItem value="subset">自定义子集</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>开发团队范围</Label>
              <Select defaultValue="default">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">默认开发团队</SelectItem>
                  <SelectItem value="subset">自定义子集</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>系统建议</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span>自动识别相似项目</span>
              <Badge>可执行</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>建议目标总量</span>
              <Badge variant="secondary">890 ~ 940</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>团队拆分方式</span>
              <Badge variant="secondary">开发 / 测试两大类</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>节点信息</span>
              <Badge variant="outline">按项目单独维护</Badge>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                className="w-full rounded-2xl"
                onClick={autoIdentifyRefProjects}
              >
                <Search className="mr-2 h-4 w-4" />
                自动识别
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl"
                onClick={() => setIsAddRefOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                手工添加
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="rounded-2xl xl:col-span-3">
          <CardHeader>
            <CardTitle>参考项目</CardTitle>
            <CardDescription>可以自动识别，也可以完全手工添加/删除</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目</TableHead>
                  <TableHead>周期</TableHead>
                  <TableHead>相似度</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refProjects.map((row) => (
                  <TableRow key={row.project}>
                    <TableCell className="font-medium">
                      {projectDisplayNameByKey[row.project]
                        ? `${projectDisplayNameByKey[row.project]}（${row.project}）`
                        : row.project}
                    </TableCell>
                    <TableCell>
                      {projectCycleByName[row.project] ?? '26W?-26W?'}
                    </TableCell>
                    <TableCell>{row.similarity}%</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.source}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-xl px-3"
                          onClick={() => {
                            setRefEditingProjectKey(row.project)
                            setRefEditDraft(row)
                            setIsReplaceRefOpen(true)
                          }}
                        >
                          替换
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 rounded-xl px-3"
                          onClick={() => removeRefProject(row.project)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl xl:col-span-2">
          <CardHeader>
            <CardTitle>节点信息</CardTitle>
            <CardDescription>
              不同项目节点数量和名称都不同，所以作为基础参数单独维护。日期保存为每周周一的
              YYYY-MM-DD（含年份），与周期联动；旧数据仅有月/日时会按周期补全年份。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>节点名</TableHead>
                  <TableHead>周期</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead className="whitespace-nowrap">开发解决率</TableHead>
                  <TableHead className="whitespace-nowrap">测试完成率</TableHead>
                  <TableHead className="whitespace-nowrap">测试提交率</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones.map((m, idx) => (
                  <TableRow key={m.name + m.week + String(idx)}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>{m.week}</TableCell>
                    <TableCell className="text-slate-500">{ensureMilestoneDateIso(m)}</TableCell>
                    <TableCell className="text-slate-600">{formatOptionalPercent(m.devResolutionRate)}</TableCell>
                    <TableCell className="text-slate-600">{formatOptionalPercent(m.testCompletionRate)}</TableCell>
                    <TableCell className="text-slate-600">{formatOptionalPercent(m.testSubmissionRate)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-xl px-3"
                          onClick={() => {
                            setEditingMilestoneIndex(idx)
                            const dateIso = ensureMilestoneDateIso(m)
                            const weekSync = milestoneMondayIsoToWeekLabel(dateIso) || m.week
                            setMilestoneEditDraft({
                              ...m,
                              week: weekSync,
                              date: dateIso,
                            })
                            setMilestoneDateTextEdit(dateIso)
                            setMilestoneEditRates({
                              dev: m.devResolutionRate !== undefined ? String(m.devResolutionRate) : '',
                              testComplete:
                                m.testCompletionRate !== undefined ? String(m.testCompletionRate) : '',
                              testSubmit:
                                m.testSubmissionRate !== undefined ? String(m.testSubmissionRate) : '',
                            })
                            setIsEditMilestoneOpen(true)
                          }}
                        >
                          编辑
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-xl px-3"
                          onClick={() => removeMilestone(idx)}
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => setIsAddMilestoneOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                新增节点
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => milestoneFileInputRef.current?.click()}
              >
                批量导入节点
              </Button>
              <input
                ref={milestoneFileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  void file.text().then((text) => {
                    const parsed = JSON.parse(text) as unknown
                    if (!Array.isArray(parsed)) return
                    const rows = parsed
                      .map((x) => x as Partial<MilestoneParam>)
                      .filter((x) => typeof x.name === 'string' && typeof x.week === 'string')
                      .map((x) => {
                        const name = x.name!.trim()
                        const week = x.week!.trim()
                        const dateRaw = typeof x.date === 'string' ? x.date : ''
                        const resolved = resolveMilestoneWeekAndDate(week, dateRaw)
                        if (!resolved) return null
                        const { week: weekOut, date } = resolved
                        const row: MilestoneParam = { name, week: weekOut, date }
                        const dr = x.devResolutionRate
                        if (typeof dr === 'number' && Number.isFinite(dr)) row.devResolutionRate = dr
                        const tc = x.testCompletionRate
                        if (typeof tc === 'number' && Number.isFinite(tc)) row.testCompletionRate = tc
                        const ts = x.testSubmissionRate
                        if (typeof ts === 'number' && Number.isFinite(ts)) row.testSubmissionRate = ts
                        return row
                      })
                      .filter(
                        (x): x is MilestoneParam =>
                          x !== null && Boolean(x.name) && Boolean(x.week),
                      )
                    if (!rows.length) {
                      toast('导入失败', { description: '文件中没有有效节点' })
                      return
                    }
                    useForecastStore.getState().setMilestones(rows)
                    toast('已导入节点', { description: `共 ${rows.length} 条` })
                  }).catch((err: unknown) => {
                    toast('导入失败', { description: err instanceof Error ? err.message : '解析失败' })
                  })
                  e.target.value = ''
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  const json = JSON.stringify(milestones, null, 2)
                  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `milestones.${new Date().toISOString().slice(0, 10)}.json`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  URL.revokeObjectURL(url)
                  toast('已导出', { description: '节点信息已导出为 JSON' })
                }}
              >
                导出节点
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>测试团队拆分</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>团队</TableHead>
                  <TableHead>默认来源</TableHead>
                  <TableHead>启用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testingTeams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>按历史项目自动识别</TableCell>
                    <TableCell>
                      <Checkbox
                        checked={t.enabled}
                        onCheckedChange={() => toggleTeamEnabled(t.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>开发团队拆分</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>团队</TableHead>
                  <TableHead>默认来源</TableHead>
                  <TableHead>启用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devTeams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>按历史项目自动识别</TableCell>
                    <TableCell>
                      <Checkbox
                        checked={t.enabled}
                        onCheckedChange={() => toggleTeamEnabled(t.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddRefOpen} onOpenChange={setIsAddRefOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>手工添加参考项目</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>项目名</Label>
              <Input
                value={refDraft.project}
                onChange={(e) =>
                  setRefDraft((s) => ({ ...s, project: e.target.value }))
                }
                placeholder="例如 Monet NP Dish"
              />
            </div>
            <div className="space-y-2">
              <Label>相似度（%）</Label>
              <Input
                value={String(refDraft.similarity)}
                onChange={(e) =>
                  setRefDraft((s) => ({
                    ...s,
                    similarity: Number(e.target.value || 0),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>来源</Label>
              <Input
                value={refDraft.source}
                onChange={(e) =>
                  setRefDraft((s) => ({ ...s, source: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => setIsAddRefOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              onClick={() => {
                if (!refDraft.project.trim()) return
                addRefProject({
                  project: refDraft.project.trim(),
                  similarity: Number.isFinite(refDraft.similarity)
                    ? refDraft.similarity
                    : 0,
                  source: refDraft.source || '手工添加',
                })
                setRefDraft({ project: '', similarity: 75, source: '手工添加' })
                setIsAddRefOpen(false)
              }}
            >
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddMilestoneOpen}
        onOpenChange={(open) => {
          setIsAddMilestoneOpen(open)
          if (open) {
            setMilestoneDraft({ name: '', week: '', date: '' })
            setMilestoneDraftRates(emptyMilestoneRates())
            setMilestoneDateTextAdd('')
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>新增节点</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>节点名</Label>
              <Input
                value={milestoneDraft.name}
                onChange={(e) =>
                  setMilestoneDraft((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="例如 M2"
              />
            </div>
            <div className="space-y-2">
              <Label>周期</Label>
              <Input
                value={milestoneDraft.week}
                onChange={(e) => {
                  const week = e.target.value
                  const iso = milestoneWeekToMondayIso(week)
                  setMilestoneDraft((s) => ({ ...s, week, ...(iso ? { date: iso } : {}) }))
                  if (iso) setMilestoneDateTextAdd(iso)
                }}
                placeholder="例如 26W12"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>日期（每周周一）</Label>
              <p className="text-xs text-slate-500">
                手输 YYYY-MM-DD、YYYY/M/D 或 M/D；非周一会按自然周对齐到周一。也可用日历选择。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="min-w-[9.5rem] flex-1"
                  value={milestoneDateTextAdd}
                  onChange={(e) => setMilestoneDateTextAdd(e.target.value)}
                  onBlur={() => {
                    if (!milestoneDateTextAdd.trim()) {
                      const iso = milestoneWeekToMondayIso(milestoneDraft.week)
                      if (iso) {
                        setMilestoneDraft((s) => ({ ...s, date: iso }))
                        setMilestoneDateTextAdd(iso)
                      }
                      return
                    }
                    const iso = normalizeMilestoneDateToIso(
                      milestoneDateTextAdd.trim(),
                      milestoneDraft.week,
                    )
                    if (!iso) {
                      toast('日期无效', {
                        description: '请使用 YYYY-MM-DD、YYYY/M/D 或 M/D（缺省年份按周期推断）',
                      })
                      setMilestoneDateTextAdd(milestoneDraft.date)
                      return
                    }
                    const w = milestoneMondayIsoToWeekLabel(iso)
                    setMilestoneDraft((s) => ({ ...s, date: iso, week: w }))
                    setMilestoneDateTextAdd(iso)
                  }}
                  placeholder="2026-01-05 或 1/5"
                />
                <Input
                  type="date"
                  className="w-auto shrink-0 rounded-xl"
                  value={milestoneDraft.date}
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    const parsed = parseIsoDateLocal(v)
                    if (!parsed) return
                    const mon = mondayOfCalendarWeek(parsed)
                    const iso = formatIsoDateLocal(mon)
                    const w = milestoneMondayIsoToWeekLabel(iso)
                    setMilestoneDraft((s) => ({ ...s, date: iso, week: w }))
                    setMilestoneDateTextAdd(iso)
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>开发解决率（%，可选）</Label>
              <Input
                value={milestoneDraftRates.dev}
                onChange={(e) =>
                  setMilestoneDraftRates((s) => ({ ...s, dev: e.target.value }))
                }
                placeholder="例如 85"
              />
            </div>
            <div className="space-y-2">
              <Label>测试完成率（%，可选）</Label>
              <Input
                value={milestoneDraftRates.testComplete}
                onChange={(e) =>
                  setMilestoneDraftRates((s) => ({ ...s, testComplete: e.target.value }))
                }
                placeholder="例如 90"
              />
            </div>
            <div className="space-y-2">
              <Label>测试提交率（%，可选）</Label>
              <Input
                value={milestoneDraftRates.testSubmit}
                onChange={(e) =>
                  setMilestoneDraftRates((s) => ({ ...s, testSubmit: e.target.value }))
                }
                placeholder="例如 70"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => setIsAddMilestoneOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              onClick={() => {
                if (!milestoneDraft.name.trim()) return
                const resolved = resolveMilestoneWeekAndDate(
                  milestoneDraft.week,
                  milestoneDateTextAdd,
                )
                if (!resolved) {
                  toast('请填写有效周期或日期', {
                    description: '至少填写其一；日期须能解析为有效日历日',
                  })
                  return
                }
                addMilestone(
                  milestoneRowFromRates(
                    {
                      name: milestoneDraft.name.trim(),
                      week: resolved.week,
                      date: resolved.date,
                    },
                    milestoneDraftRates,
                  ),
                )
                setIsAddMilestoneOpen(false)
              }}
            >
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditMilestoneOpen}
        onOpenChange={(open) => {
          setIsEditMilestoneOpen(open)
          if (!open) setEditingMilestoneIndex(null)
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>编辑节点</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>节点名</Label>
              <Input
                value={milestoneEditDraft.name}
                onChange={(e) =>
                  setMilestoneEditDraft((s) => ({ ...s, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>周期</Label>
              <Input
                value={milestoneEditDraft.week}
                onChange={(e) => {
                  const week = e.target.value
                  const iso = milestoneWeekToMondayIso(week)
                  setMilestoneEditDraft((s) => ({ ...s, week, ...(iso ? { date: iso } : {}) }))
                  if (iso) setMilestoneDateTextEdit(iso)
                }}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>日期（每周周一）</Label>
              <p className="text-xs text-slate-500">
                手输 YYYY-MM-DD、YYYY/M/D 或 M/D；非周一会按自然周对齐到周一。也可用日历选择。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="min-w-[9.5rem] flex-1"
                  value={milestoneDateTextEdit}
                  onChange={(e) => setMilestoneDateTextEdit(e.target.value)}
                  onBlur={() => {
                    if (!milestoneDateTextEdit.trim()) {
                      const iso = milestoneWeekToMondayIso(milestoneEditDraft.week)
                      if (iso) {
                        setMilestoneEditDraft((s) => ({ ...s, date: iso }))
                        setMilestoneDateTextEdit(iso)
                      }
                      return
                    }
                    const iso = normalizeMilestoneDateToIso(
                      milestoneDateTextEdit.trim(),
                      milestoneEditDraft.week,
                    )
                    if (!iso) {
                      toast('日期无效', {
                        description: '请使用 YYYY-MM-DD、YYYY/M/D 或 M/D（缺省年份按周期推断）',
                      })
                      setMilestoneDateTextEdit(milestoneEditDraft.date)
                      return
                    }
                    const w = milestoneMondayIsoToWeekLabel(iso)
                    setMilestoneEditDraft((s) => ({ ...s, date: iso, week: w }))
                    setMilestoneDateTextEdit(iso)
                  }}
                  placeholder="2026-01-05 或 1/5"
                />
                <Input
                  type="date"
                  className="w-auto shrink-0 rounded-xl"
                  value={milestoneEditDraft.date}
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    const parsed = parseIsoDateLocal(v)
                    if (!parsed) return
                    const mon = mondayOfCalendarWeek(parsed)
                    const iso = formatIsoDateLocal(mon)
                    const w = milestoneMondayIsoToWeekLabel(iso)
                    setMilestoneEditDraft((s) => ({ ...s, date: iso, week: w }))
                    setMilestoneDateTextEdit(iso)
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>开发解决率（%，可选）</Label>
              <Input
                value={milestoneEditRates.dev}
                onChange={(e) =>
                  setMilestoneEditRates((s) => ({ ...s, dev: e.target.value }))
                }
                placeholder="例如 85"
              />
            </div>
            <div className="space-y-2">
              <Label>测试完成率（%，可选）</Label>
              <Input
                value={milestoneEditRates.testComplete}
                onChange={(e) =>
                  setMilestoneEditRates((s) => ({ ...s, testComplete: e.target.value }))
                }
                placeholder="例如 90"
              />
            </div>
            <div className="space-y-2">
              <Label>测试提交率（%，可选）</Label>
              <Input
                value={milestoneEditRates.testSubmit}
                onChange={(e) =>
                  setMilestoneEditRates((s) => ({ ...s, testSubmit: e.target.value }))
                }
                placeholder="例如 70"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => setIsEditMilestoneOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              onClick={() => {
                if (editingMilestoneIndex === null) return
                if (!milestoneEditDraft.name.trim()) return
                const resolved = resolveMilestoneWeekAndDate(
                  milestoneEditDraft.week,
                  milestoneDateTextEdit,
                )
                if (!resolved) {
                  toast('请填写有效周期或日期', {
                    description: '至少填写其一；日期须能解析为有效日历日',
                  })
                  return
                }
                updateMilestone(
                  editingMilestoneIndex,
                  milestoneRowFromRates(
                    {
                      name: milestoneEditDraft.name.trim(),
                      week: resolved.week,
                      date: resolved.date,
                    },
                    milestoneEditRates,
                  ),
                )
                setIsEditMilestoneOpen(false)
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReplaceRefOpen} onOpenChange={setIsReplaceRefOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>替换参考项目</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>项目名</Label>
              <Input
                value={refEditDraft.project}
                onChange={(e) =>
                  setRefEditDraft((s) => ({ ...s, project: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>相似度（%）</Label>
              <Input
                value={String(refEditDraft.similarity)}
                onChange={(e) =>
                  setRefEditDraft((s) => ({
                    ...s,
                    similarity: Number(e.target.value || 0),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>来源</Label>
              <Input
                value={refEditDraft.source}
                onChange={(e) =>
                  setRefEditDraft((s) => ({ ...s, source: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => setIsReplaceRefOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              onClick={() => {
                if (!refEditDraft.project.trim()) return
                if (refEditingProjectKey && refEditingProjectKey !== refEditDraft.project) {
                  useForecastStore.getState().removeRefProject(refEditingProjectKey)
                }
                updateRefProject({
                  project: refEditDraft.project.trim(),
                  similarity: Number.isFinite(refEditDraft.similarity)
                    ? refEditDraft.similarity
                    : 0,
                  source: refEditDraft.source || '手工添加',
                })
                setIsReplaceRefOpen(false)
                setRefEditingProjectKey(null)
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
