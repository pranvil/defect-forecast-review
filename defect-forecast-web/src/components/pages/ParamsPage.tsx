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
import { firstDayDateOfWeek } from '@/utils/week'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { MilestoneParam, RefProjectRow } from '@/types/forecast'


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
  const [allProjects, setAllProjects] = React.useState<string[]>([])
  const milestoneFileInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void services.projectService.listCachedProjects().then((rows) => {
      if (cancelled) return
      const map: Record<string, string> = {}
      rows.forEach((p) => {
        map[p.name] = p.cycle
      })
      setProjectCycleByName(map)
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
                    <TableCell className="font-medium">{row.project}</TableCell>
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
            <CardDescription>不同项目节点数量和名称都不同，所以作为基础参数单独维护</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>节点名</TableHead>
                  <TableHead>周期</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones.map((m, idx) => (
                  <TableRow key={m.name + m.week + String(idx)}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>{m.week}</TableCell>
                    <TableCell className="text-slate-500">{m.date}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-xl px-3"
                          onClick={() => {
                            setEditingMilestoneIndex(idx)
                            setMilestoneEditDraft({
                              ...m,
                              date: firstDayDateOfWeek(m.week),
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
                      .map((x) => ({
                        name: x.name!.trim(),
                        week: x.week!.trim(),
                        date: typeof x.date === 'string' && x.date ? x.date : firstDayDateOfWeek(x.week!.trim()),
                      }))
                      .filter((x) => x.name && x.week)
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

      <Dialog open={isAddMilestoneOpen} onOpenChange={setIsAddMilestoneOpen}>
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
                onChange={(e) =>
                  setMilestoneDraft((s) => {
                    const week = e.target.value
                    return { ...s, week, date: firstDayDateOfWeek(week) }
                  })
                }
                placeholder="例如 26W12"
              />
            </div>
            <div className="space-y-2">
              <Label>日期（该周第一天）</Label>
              <Input
                value={milestoneDraft.date}
                readOnly
                placeholder="随周期自动计算"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>备注（占位）</Label>
              <Textarea placeholder="第二轮后续可扩展" />
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
                addMilestone({
                  name: milestoneDraft.name.trim(),
                  week: milestoneDraft.week.trim(),
                  date: firstDayDateOfWeek(milestoneDraft.week),
                })
                setMilestoneDraft({ name: '', week: '', date: '' })
                setIsAddMilestoneOpen(false)
              }}
            >
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditMilestoneOpen} onOpenChange={setIsEditMilestoneOpen}>
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
                onChange={(e) =>
                  setMilestoneEditDraft((s) => {
                    const week = e.target.value
                    return { ...s, week, date: firstDayDateOfWeek(week) }
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>日期（该周第一天）</Label>
              <Input
                value={milestoneEditDraft.date}
                readOnly
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
                updateMilestone(editingMilestoneIndex, {
                  name: milestoneEditDraft.name.trim(),
                  week: milestoneEditDraft.week.trim(),
                  date: firstDayDateOfWeek(milestoneEditDraft.week),
                })
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
