import * as React from 'react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTeamStore } from '@/stores/teamStore'

export function TeamsPage() {
  const teams = useTeamStore((s) => s.teams)
  const hydrateFromServer = useTeamStore((s) => s.hydrateFromServer)
  const testingTeams = teams.filter((x) => x.type === 'testing')
  const devTeams = teams.filter((x) => x.type === 'development')

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
          预测模型使用固定团队分类；原始 Jira 团队仍保留在历史数据与详情模块中。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>测试团队</CardTitle>
            <CardDescription>Created 侧预测拆分使用的固定测试分类</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>开发团队</CardTitle>
            <CardDescription>Fixed 侧预测拆分使用的开发团队清单</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>分类</TableHead>
                  <TableHead>覆盖范围</TableHead>
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
