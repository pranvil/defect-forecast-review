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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HistoricalProjectMetadataCard } from '@/components/config/HistoricalProjectMetadataCard'
import { httpPost } from '@/services/http'
import { isReviewMode } from '@/runtime/mode'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTeamStore } from '@/stores/teamStore'
import type { JiraAuthType } from '@/types/settings'

export function ConfigPage() {
  const jiraConnection = useSettingsStore((s) => s.jiraConnection)
  const setJiraConnection = useSettingsStore((s) => s.setJiraConnection)
  const teams = useTeamStore((s) => s.teams)
  const hydrateTeamsFromServer = useTeamStore((s) => s.hydrateFromServer)
  const testingTeams = teams.filter((x) => x.type === 'testing')
  const devTeams = teams.filter((x) => x.type === 'development')

  React.useEffect(() => {
    void hydrateTeamsFromServer().catch((e: unknown) => {
      toast('团队配置加载失败', { description: e instanceof Error ? e.message : '服务不可用' })
    })
  }, [hydrateTeamsFromServer])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">系统配置</h2>
        <p className="mt-1 text-sm text-slate-500">这里主要配置 Jira 连接。</p>
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
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
              <Checkbox
                id="jira-verify-ssl"
                checked={jiraConnection.verifySsl}
                onCheckedChange={(checked) => setJiraConnection({ verifySsl: checked === true })}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="jira-verify-ssl">校验 HTTPS 证书</Label>
                <p className="text-xs leading-5 text-slate-500">
                  公司内网 Jira 或代理证书未被当前 Python 环境信任时，可临时关闭后再测试连接。
                </p>
              </div>
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

        <HistoricalProjectMetadataCard />

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>团队配置</CardTitle>
            <CardDescription>预测模型使用固定团队分类；原始 Jira 团队仍保留在历史数据与详情模块中。</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="space-y-3">
              <div className="text-sm font-medium">测试团队</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>分类</TableHead>
                    <TableHead>覆盖范围</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testingTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell className="text-slate-500">{team.note || '-'}</TableCell>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell className="text-slate-500">{team.note || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
