import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSettingsStore } from '@/stores/settingsStore'
import { isReviewMode } from '@/runtime/mode'
import { httpPost } from '@/services/http'
import type { JiraAuthType } from '@/types/settings'
import { useTeamStore } from '@/stores/teamStore'
import type { TeamItem, TeamKind } from '@/types/team'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { initialTeams } from '@/data/mock/teams'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ConfigPage() {
  const jiraConnection = useSettingsStore((s) => s.jiraConnection)
  const setJiraConnection = useSettingsStore((s) => s.setJiraConnection)
  const teams = useTeamStore((s) => s.teams)
  const hydrateTeamsFromServer = useTeamStore((s) => s.hydrateFromServer)
  const toggleTeamEnabled = useTeamStore((s) => s.toggleTeamEnabled)
  const addTeam = useTeamStore((s) => s.addTeam)
  const updateTeam = useTeamStore((s) => s.updateTeam)
  const removeTeam = useTeamStore((s) => s.removeTeam)
  const setTeams = useTeamStore((s) => s.setTeams)

  const testingTeams = teams.filter((x) => x.type === 'testing')
  const devTeams = teams.filter((x) => x.type === 'development')

  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [addKind, setAddKind] = React.useState<TeamKind>('testing')
  const [addName, setAddName] = React.useState('')
  const [addNote, setAddNote] = React.useState('')

  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [editDraft, setEditDraft] = React.useState<TeamItem | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    void hydrateTeamsFromServer().catch((e: unknown) => {
      toast('团队配置加载失败', { description: e instanceof Error ? e.message : '服务不可用' })
    })
  }, [hydrateTeamsFromServer])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">系统配置</h2>
        <p className="mt-1 text-sm text-slate-500">
          这里主要配置 Jira 连接。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Jira 连接配置</CardTitle>
            <CardDescription>支持 PAT / Basic Auth，两种方式都可以保留</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Jira Base URL</Label>
              <Input
                value={jiraConnection.baseUrl}
                onChange={(e) => setJiraConnection({ baseUrl: e.target.value })}
                placeholder="https://your-jira.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>认证方式</Label>
              <Select
                value={jiraConnection.authType}
                onValueChange={(v) => setJiraConnection({ authType: v as JiraAuthType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pat">PAT</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input
                value={jiraConnection.username}
                onChange={(e) => setJiraConnection({ username: e.target.value })}
                placeholder={jiraConnection.authType === 'basic' ? '邮箱或用户名' : 'PAT 模式可留空'}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Token / 密码</Label>
              <Input
                type="password"
                value={jiraConnection.token}
                onChange={(e) => setJiraConnection({ token: e.target.value })}
                placeholder="输入 PAT 或密码"
              />
            </div>
            <div className="flex gap-3 md:col-span-2">
              <Button
                type="button"
                className="rounded-2xl"
                onClick={() => {
                  if (isReviewMode) {
                    toast('评审版暂未开放', { description: '评审版不连接真实 Jira / 本机服务' })
                    return
                  }
                  if (!jiraConnection.baseUrl.trim()) {
                    toast('连接失败', { description: '请填写 Jira Base URL' })
                    return
                  }
                  if (!jiraConnection.token.trim()) {
                    toast('连接失败', { description: '请填写 Token / 密码' })
                    return
                  }
                  if (jiraConnection.authType === 'basic' && !jiraConnection.username.trim()) {
                    toast('连接失败', { description: 'Basic Auth 需要用户名' })
                    return
                  }
                  void httpPost<
                    {
                      baseUrl: string
                      authType: 'pat' | 'basic'
                      username: string
                      token: string
                      verifySsl: boolean
                      timeoutSec: number
                    },
                    { ok: boolean; statusCode: number; message: string; site: string; account: string }
                  >('/api/jira/test-connection', jiraConnection)
                    .then((res) => {
                      if (!res.ok) {
                        toast('连接失败', { description: `${res.message}` })
                        return
                      }
                      toast('连接成功', {
                        description: res.account
                          ? `站点 ${res.site}，账号 ${res.account}`
                          : `站点 ${res.site}`,
                      })
                    })
                    .catch((e: unknown) => {
                      toast('连接失败', { description: e instanceof Error ? e.message : '服务不可用' })
                    })
                }}
              >
                测试连接
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <CardTitle>团队配置</CardTitle>
                <CardDescription>
                  统一维护团队名称与类型（测试/开发）。用于 Created / Fixed 按团队聚合与预测拆分。
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="rounded-2xl"
                  onClick={() => {
                    setAddKind('testing')
                    setAddName('')
                    setAddNote('')
                    setIsAddOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  新增团队
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => fileInputRef.current?.click()}
                >
                  导入团队
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    setTeams(initialTeams)
                    toast('已重置', { description: '已恢复为预置团队名单（并自动保存）' })
                  }}
                  title="将当前团队配置覆盖为内置预置名单（用于你刚配置的候选团队）。"
                >
                  重置为预置
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    const payload = JSON.stringify(teams, null, 2)
                    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `teams.${new Date().toISOString().slice(0, 10)}.json`
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    URL.revokeObjectURL(url)
                    toast('已导出', { description: `共 ${teams.length} 个团队` })
                  }}
                >
                  导出团队
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    void file
                      .text()
                      .then((text) => {
                        const parsed = JSON.parse(text) as unknown
                        if (!Array.isArray(parsed)) {
                          toast('导入失败', { description: '文件格式错误' })
                          return
                        }
                        const rows = parsed
                          .map((x) => x as Partial<{ id: string; name: string; type: TeamKind; enabled: boolean; note: string }>)
                          .filter((x) => typeof x.name === 'string' && (x.type === 'testing' || x.type === 'development'))
                          .map((x) => ({
                            id: typeof x.id === 'string' ? x.id : `t-import-${crypto.randomUUID()}`,
                            name: x.name!,
                            type: x.type!,
                            enabled: typeof x.enabled === 'boolean' ? x.enabled : true,
                            note: typeof x.note === 'string' ? x.note : '',
                          }))
                        if (!rows.length) {
                          toast('导入失败', { description: '无有效团队数据' })
                          return
                        }
                        setTeams(rows)
                        toast('已导入', { description: `共 ${rows.length} 个团队` })
                      })
                      .catch((err: unknown) => {
                        toast('导入失败', { description: err instanceof Error ? err.message : '解析失败' })
                      })
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="space-y-3">
              <div className="text-sm font-medium">测试团队</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>团队名称</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead className="w-[92px] whitespace-nowrap">参与分布</TableHead>
                    <TableHead className="w-[72px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testingTeams.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-slate-500">{t.note}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={t.enabled}
                            onCheckedChange={() => toggleTeamEnabled(t.id)}
                          />
                          <span className="text-xs text-slate-500">{t.enabled ? '是' : '否'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button type="button" variant="ghost" className="h-8 w-8 rounded-xl p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditDraft(t)
                                setIsEditOpen(true)
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                removeTeam(t.id)
                                toast('已删除', { description: t.name })
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">开发团队</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>团队名称</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead className="w-[92px] whitespace-nowrap">参与分布</TableHead>
                    <TableHead className="w-[72px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devTeams.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-slate-500">{t.note}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={t.enabled}
                            onCheckedChange={() => toggleTeamEnabled(t.id)}
                          />
                          <span className="text-xs text-slate-500">{t.enabled ? '是' : '否'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button type="button" variant="ghost" className="h-8 w-8 rounded-xl p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditDraft(t)
                                setIsEditOpen(true)
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                removeTeam(t.id)
                                toast('已删除', { description: t.name })
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>新增团队</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>团队类型</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={addKind === 'testing' ? 'default' : 'outline'}
                  className="rounded-2xl"
                  onClick={() => setAddKind('testing')}
                >
                  测试团队
                </Button>
                <Button
                  type="button"
                  variant={addKind === 'development' ? 'default' : 'outline'}
                  className="rounded-2xl"
                  onClick={() => setAddKind('development')}
                >
                  开发团队
                </Button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>团队名称</Label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>说明</Label>
              <Input value={addNote} onChange={(e) => setAddNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsAddOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              onClick={() => {
                if (!addName.trim()) return
                addTeam({
                  name: addName.trim(),
                  note: addNote.trim(),
                  type: addKind,
                  enabled: true,
                })
                toast('已添加', { description: addName.trim() })
                setIsAddOpen(false)
              }}
            >
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open)
          if (!open) setEditDraft(null)
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>编辑团队</DialogTitle>
          </DialogHeader>
          {editDraft ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>团队类型</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={editDraft.type === 'testing' ? 'default' : 'outline'}
                    className="rounded-2xl"
                    onClick={() => setEditDraft((s) => (s ? { ...s, type: 'testing' } : s))}
                  >
                    测试团队
                  </Button>
                  <Button
                    type="button"
                    variant={editDraft.type === 'development' ? 'default' : 'outline'}
                    className="rounded-2xl"
                    onClick={() => setEditDraft((s) => (s ? { ...s, type: 'development' } : s))}
                  >
                    开发团队
                  </Button>
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>团队名称</Label>
                <Input
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((s) => (s ? { ...s, name: e.target.value } : s))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>说明</Label>
                <Input
                  value={editDraft.note ?? ''}
                  onChange={(e) => setEditDraft((s) => (s ? { ...s, note: e.target.value } : s))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>是否启用</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={editDraft.enabled ? 'default' : 'outline'}
                    className="rounded-2xl"
                    onClick={() => setEditDraft((s) => (s ? { ...s, enabled: true } : s))}
                  >
                    启用
                  </Button>
                  <Button
                    type="button"
                    variant={!editDraft.enabled ? 'default' : 'outline'}
                    className="rounded-2xl"
                    onClick={() => setEditDraft((s) => (s ? { ...s, enabled: false } : s))}
                  >
                    禁用
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsEditOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              disabled={!editDraft || !editDraft.name.trim()}
              onClick={() => {
                if (!editDraft) return
                if (!editDraft.name.trim()) return
                updateTeam({
                  ...editDraft,
                  name: editDraft.name.trim(),
                  note: (editDraft.note ?? '').trim(),
                })
                toast('已保存', { description: editDraft.name.trim() })
                setIsEditOpen(false)
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
