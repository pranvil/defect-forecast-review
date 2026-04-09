import { Plus } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSettingsStore } from '@/stores/settingsStore'
import type { FieldMapping } from '@/types/settings'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { isReviewMode } from '@/runtime/mode'
import { httpPost } from '@/services/http'
import type { JiraAuthType } from '@/types/settings'

export function ConfigPage() {
  const fieldMappings = useSettingsStore((s) => s.fieldMappings)
  const hydrateFieldMappingsFromServer = useSettingsStore((s) => s.hydrateFieldMappingsFromServer)
  const addFieldMapping = useSettingsStore((s) => s.addFieldMapping)
  const updateFieldMapping = useSettingsStore((s) => s.updateFieldMapping)
  const removeFieldMapping = useSettingsStore((s) => s.removeFieldMapping)
  const jiraConnection = useSettingsStore((s) => s.jiraConnection)
  const setJiraConnection = useSettingsStore((s) => s.setJiraConnection)

  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<Omit<FieldMapping, 'id'>>({
    businessName: '',
    jiraFieldPath: '',
    purpose: '',
    exampleValue: '',
    enabled: true,
  })

  React.useEffect(() => {
    void hydrateFieldMappingsFromServer().catch((e: unknown) => {
      toast('字段映射加载失败', { description: e instanceof Error ? e.message : '服务不可用' })
    })
  }, [hydrateFieldMappingsFromServer])

  const openCreate = () => {
    setEditingId(null)
    setDraft({
      businessName: '',
      jiraFieldPath: '',
      purpose: '',
      exampleValue: '',
      enabled: true,
    })
    setIsDialogOpen(true)
  }

  const openEdit = (row: FieldMapping) => {
    setEditingId(row.id)
    setDraft({
      businessName: row.businessName,
      jiraFieldPath: row.jiraFieldPath,
      purpose: row.purpose,
      exampleValue: row.exampleValue,
      enabled: row.enabled,
    })
    setIsDialogOpen(true)
  }

  const submit = () => {
    if (!draft.businessName.trim()) return
    if (!draft.jiraFieldPath.trim()) return
    if (editingId) {
      updateFieldMapping({ id: editingId, ...draft })
    } else {
      addFieldMapping(draft)
    }
    setIsDialogOpen(false)
  }

  const exportJson = () => {
    const json = JSON.stringify(fieldMappings, null, 2)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `field-mappings.${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const importJson = async (file: File) => {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    if (!Array.isArray(parsed)) return
    const rows: FieldMapping[] = parsed
      .map((x) => x as Partial<FieldMapping>)
      .filter(
        (x) =>
          typeof x.businessName === 'string' &&
          typeof x.jiraFieldPath === 'string' &&
          typeof x.purpose === 'string' &&
          typeof x.exampleValue === 'string' &&
          typeof x.enabled === 'boolean',
      )
      .map((x) => ({
        id: typeof x.id === 'string' ? x.id : `fm-import-${crypto.randomUUID()}`,
        businessName: x.businessName!,
        jiraFieldPath: x.jiraFieldPath!,
        purpose: x.purpose!,
        exampleValue: x.exampleValue!,
        enabled: x.enabled!,
      }))

    if (!rows.length) return
    useSettingsStore.getState().setFieldMappings(rows)
    toast('已导入', { description: `已从文件导入 ${rows.length} 条映射（并自动保存到本机）` })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">系统配置</h2>
        <p className="mt-1 text-sm text-slate-500">
          这里主要配置 Jira 连接、字段映射，以及导入导出一套可复用的映射方案给其他人使用。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl xl:col-span-2">
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
            <CardTitle>字段映射说明</CardTitle>
            <CardDescription>这张表决定系统拿 Jira 的哪个字段去做统计和预测</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
            <div>字段映射会被以下模块使用：</div>
            <div>1. JIRA 数据获取时决定拉哪些字段</div>
            <div>2. 历史项目汇总时决定按哪个字段统计团队 / 周 / 类型</div>
            <div>3. 预测时决定参考哪些字段口径生成结果</div>
            <Separator />
            <div className="text-xs text-slate-500">
              字段映射在本机自动保存；需要跨机器/共享请使用“导出/导入”。
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <CardTitle>字段映射表</CardTitle>
              <CardDescription>
                可以人为添加、修改、删除。当前生效表示这一行会参与实际拉数和统计。
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                新增映射
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={exportJson}
              >
                导出映射
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => fileInputRef.current?.click()}
              >
                导入映射
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void importJson(f)
                  e.target.value = ''
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>业务含义</TableHead>
                <TableHead>Jira 字段 ID / 路径</TableHead>
                <TableHead>用途</TableHead>
                <TableHead>示例值</TableHead>
                <TableHead>当前生效</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fieldMappings.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.businessName}</TableCell>
                  <TableCell>{row.jiraFieldPath}</TableCell>
                  <TableCell className="text-slate-500">{row.purpose}</TableCell>
                  <TableCell>{row.exampleValue}</TableCell>
                  <TableCell>
                    <Badge variant={row.enabled ? 'default' : 'outline'}>
                      {row.enabled ? '是' : '否'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="h-8 rounded-xl px-3" onClick={() => openEdit(row)}>
                        编辑
                      </Button>
                      <Button type="button" variant="outline" className="h-8 rounded-xl px-3" onClick={() => removeFieldMapping(row.id)}>
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑映射' : '新增映射'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>业务含义</Label>
              <Input
                value={draft.businessName}
                onChange={(e) => setDraft((s) => ({ ...s, businessName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Jira 字段路径</Label>
              <Input
                value={draft.jiraFieldPath}
                onChange={(e) => setDraft((s) => ({ ...s, jiraFieldPath: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>用途</Label>
              <Textarea
                value={draft.purpose}
                onChange={(e) => setDraft((s) => ({ ...s, purpose: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>示例值</Label>
              <Input
                value={draft.exampleValue}
                onChange={(e) => setDraft((s) => ({ ...s, exampleValue: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <Checkbox
                checked={draft.enabled}
                onCheckedChange={(v) =>
                  setDraft((s) => ({ ...s, enabled: v === true }))
                }
              />
              <div className="text-sm">当前生效</div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" className="rounded-2xl" onClick={submit}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
