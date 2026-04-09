import { MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useTeamStore } from '@/stores/teamStore'
import type { TeamKind } from '@/types/team'

export function TeamsPage() {
  const teams = useTeamStore((s) => s.teams)
  const hydrateFromServer = useTeamStore((s) => s.hydrateFromServer)
  const addTeam = useTeamStore((s) => s.addTeam)
  const removeTeam = useTeamStore((s) => s.removeTeam)
  const setTeams = useTeamStore((s) => s.setTeams)
  const testingTeams = teams.filter((x) => x.type === 'testing')
  const devTeams = teams.filter((x) => x.type === 'development')

  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [addKind, setAddKind] = React.useState<TeamKind>('testing')
  const [name, setName] = React.useState('')
  const [note, setNote] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    void hydrateFromServer().catch((e: unknown) => {
      toast('团队配置加载失败', { description: e instanceof Error ? e.message : '服务不可用' })
    })
  }, [hydrateFromServer])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">团队配置</h2>
        <p className="mt-1 text-sm text-slate-500">
          这里只维护一个统一的团队名称，并区分开发团队和测试团队，不再放权重或多套名字。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>测试团队</CardTitle>
            <CardDescription>主要用于 Created 侧的测试分布与预测拆分</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>团队名称</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead className="w-[72px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {testingTeams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-slate-500">{t.note}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-8 rounded-xl p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
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
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>开发团队</CardTitle>
            <CardDescription>主要用于 Fixed 侧的开发修复团队统计与预测拆分</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>团队名称</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead className="w-[72px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {devTeams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-slate-500">{t.note}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-8 rounded-xl p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
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
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>团队操作</CardTitle>
          <CardDescription>
            后续如果确实需要别名映射，可以作为高级功能再补，不放在 MVP 的主界面里。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            type="button"
            className="rounded-2xl"
            onClick={() => {
              setAddKind('testing')
              setName('')
              setNote('')
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
            导出团队配置
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
        </CardContent>
      </Card>

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
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>说明</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
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
                if (!name.trim()) return
                addTeam({
                  name: name.trim(),
                  note: note.trim(),
                  type: addKind,
                  enabled: true,
                })
                toast('已添加', { description: name.trim() })
                setIsAddOpen(false)
              }}
            >
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
