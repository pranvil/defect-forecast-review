import { Columns3, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
import type { ProjectSummary } from '@/services/projectService'
import {
  DEFAULT_PROJECT_METADATA_COLUMN_IDS,
  PROJECT_METADATA_COLUMNS,
  type ProjectMetadataColumnId,
  formatProjectMetadataCell,
} from '@/utils/projectMetadataColumns'
import {
  CHIPSET_STATUS_OPTIONS,
  DEVICE_TYPE_OPTIONS,
  IDH_VENDOR_OPTIONS,
  OPERATOR_OPTIONS,
  OS_OPTIONS,
  PIPELINE_OPTIONS,
  PROJECT_CATEGORY_OPTIONS,
  REGION_OPTIONS,
  SUPPORT_SIM_OPTIONS,
  USER_PROGRAM_OPTIONS,
} from '@/utils/projectOptions'
import { useSettingsStore } from '@/stores/settingsStore'
import { isWeekVisibleInRange } from '@/utils/week'

const emptyDraft = (): ProjectSummary => ({
  name: '',
  displayName: '',
  cycle: '',
  defects: 0,
  teams: 1,
  similarity: undefined,
  projectCategory: '',
  region: '',
  os: '',
  deviceType: '',
  chipsetStatus: '',
  pipeline: '',
  operators: [],
  userPrograms: [],
  idhVendor: '',
  frQuantity: undefined,
  mm: undefined,
  supportSim: undefined,
  validStartDate: '',
  validEndDate: '',
})

function normalizeRow(row: ProjectSummary): ProjectSummary {
  return {
    ...row,
    name: row.name.trim().toUpperCase(),
    displayName: row.displayName?.trim() || undefined,
    cycle: row.cycle.trim() || '-',
    defects: Number.isFinite(row.defects) ? Math.max(0, Math.round(row.defects)) : 0,
    teams: Number.isFinite(row.teams) ? Math.max(1, Math.round(row.teams)) : 1,
    operators: row.operators?.filter(Boolean) ?? [],
    userPrograms: row.userPrograms?.filter(Boolean) ?? [],
    frQuantity:
      typeof row.frQuantity === 'number' && Number.isFinite(row.frQuantity)
        ? Math.max(0, Math.round(row.frQuantity))
        : undefined,
    mm: typeof row.mm === 'number' && Number.isFinite(row.mm) ? Math.max(0, row.mm) : undefined,
  }
}

function getValue(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const hit = raw[key]
    if (typeof hit === 'string' && hit.trim()) return hit.trim()
    if (typeof hit === 'number' && Number.isFinite(hit)) return String(hit)
  }
  return ''
}

function splitList(value: string): string[] {
  return value
    .split(/[;,，、]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function parseNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const n = Number(value.trim())
  return Number.isFinite(n) ? n : undefined
}

function parseDelimited(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) return []
  const delimiter = lines[0]!.includes('\t') ? '\t' : ','
  const headers = lines[0]!.split(delimiter).map((x) => x.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((x) => x.trim())
    return Object.fromEntries(headers.map((header, idx) => [header, cells[idx] ?? '']))
  })
}

function rowsFromImport(text: string): ProjectSummary[] {
  const trimmed = text.trim()
  const rawRows = trimmed.startsWith('[')
    ? (JSON.parse(trimmed) as Record<string, unknown>[])
    : parseDelimited(trimmed)

  return rawRows
    .map((raw) => {
      const name = getValue(raw, ['name', 'projectKey', 'project_key', '项目Key', '项目KEY', '项目'])
      if (!name) return null
      const row: ProjectSummary = {
        name,
        displayName: getValue(raw, ['displayName', 'display_name', '项目名称', '显示名称']) || undefined,
        cycle: getValue(raw, ['cycle', '周期']) || '-',
        defects: parseNumber(getValue(raw, ['defects', 'Defects_amount', 'bug总量', '缺陷总量'])) ?? 0,
        teams: parseNumber(getValue(raw, ['teams', '团队数'])) ?? 1,
        projectCategory: getValue(raw, ['projectCategory', 'Project_category', '项目类别']) || undefined,
        region: getValue(raw, ['region', 'Region', '目标区域']) || undefined,
        os: getValue(raw, ['os', 'OS', '操作系统']) || undefined,
        deviceType: getValue(raw, ['deviceType', 'Device_Type', '设备类型']) || undefined,
        chipsetStatus: getValue(raw, ['chipsetStatus', 'Chipset Status', '芯片状态']) || undefined,
        pipeline: getValue(raw, ['pipeline', '流水线']) || undefined,
        operators: splitList(getValue(raw, ['operators', 'Operators', '运营商'])),
        userPrograms: splitList(getValue(raw, ['userPrograms', 'User Programs', '用户测试'])),
        idhVendor: getValue(raw, ['idhVendor', 'IDH Vendor', '外包商']) || undefined,
        frQuantity: parseNumber(getValue(raw, ['frQuantity', 'FR Quantity', '需求量'])),
        mm: parseNumber(getValue(raw, ['mm', 'MM', '投入人力'])),
        supportSim: getValue(raw, ['supportSim', 'Support_SIM', '支持SIM卡']) === 'No' ? 'No' : undefined,
        validStartDate: getValue(raw, ['validStartDate', '有效开始日期', '开始日期']) || undefined,
        validEndDate: getValue(raw, ['validEndDate', '有效结束日期', '结束日期']) || undefined,
      }
      return normalizeRow(row)
    })
    .filter((row): row is ProjectSummary => row !== null)
}

function exportCsv(rows: ProjectSummary[]): string {
  const headers = [
    'name',
    'displayName',
    'cycle',
    'defects',
    'teams',
    'projectCategory',
    'region',
    'os',
    'deviceType',
    'chipsetStatus',
    'pipeline',
    'operators',
    'userPrograms',
    'idhVendor',
    'frQuantity',
    'mm',
    'supportSim',
    'validStartDate',
    'validEndDate',
  ]
  const escapeCell = (value: unknown) => {
    const text = Array.isArray(value) ? value.join(';') : String(value ?? '')
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [headers.join(','), ...rows.map((row) => headers.map((key) => escapeCell(row[key as keyof ProjectSummary])).join(','))].join('\n')
}

export function HistoricalProjectMetadataCard() {
  const [rows, setRows] = React.useState<ProjectSummary[]>([])
  const [draft, setDraft] = React.useState<ProjectSummary>(emptyDraft())
  const [isOpen, setIsOpen] = React.useState(false)
  const [editingName, setEditingName] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isImporting, setIsImporting] = React.useState(false)
  const [visibleColumnIds, setVisibleColumnIds] = React.useState<ProjectMetadataColumnId[]>(
    DEFAULT_PROJECT_METADATA_COLUMN_IDS,
  )
  const jiraConnection = useSettingsStore((s) => s.jiraConnection)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const visibleColumns = React.useMemo(
    () => PROJECT_METADATA_COLUMNS.filter((column) => visibleColumnIds.includes(column.id)),
    [visibleColumnIds],
  )

  const toggleColumn = (columnId: ProjectMetadataColumnId, checked: boolean) => {
    setVisibleColumnIds((current) => {
      if (checked) return current.includes(columnId) ? current : [...current, columnId]
      return current.filter((id) => id !== columnId)
    })
  }

  const refresh = React.useCallback(() => {
    return services.projectService.listCachedProjects().then(setRows)
  }, [])

  React.useEffect(() => {
    void refresh().catch((e: unknown) => {
      toast('历史项目元数据加载失败', { description: e instanceof Error ? e.message : '服务不可用' })
    })
  }, [refresh])

  const openEdit = (row?: ProjectSummary) => {
    setEditingName(row?.name ?? null)
    setDraft(row ? { ...emptyDraft(), ...row } : emptyDraft())
    setIsOpen(true)
  }

  const saveDraft = () => {
    const next = normalizeRow(draft)
    if (!next.name) {
      toast('保存失败', { description: '请填写项目 Key' })
      return
    }
    if (!editingName && !next.validStartDate?.trim()) {
      toast('保存失败', { description: '请填写有效开始日期（用于统计 Defect 数）' })
      return
    }
    if (!editingName && next.validStartDate?.trim() && next.validEndDate?.trim() && next.validStartDate > next.validEndDate) {
      toast('保存失败', { description: '有效开始日期不能晚于有效结束日期' })
      return
    }
    if (isSaving) return

    const todayIso = new Date().toISOString().slice(0, 10)
    const effectiveEndDate = next.validEndDate?.trim() || todayIso

    const rowsToSave =
      editingName && editingName !== next.name
        ? rows.filter((row) => row.name !== editingName).concat(next)
        : [next]
    setIsSaving(true)
    void (async () => {
      try {
        // 仅新增时自动复用“导入项目”逻辑从 Jira 拉取数据并按有效开始日期统计缺陷数
        if (!editingName) {
          let res: Awaited<ReturnType<typeof services.jiraService.fetchByJql>>
          try {
            res = await services.jiraService.fetchByJql({
              projectKey: next.name,
              startWeek: '',
              endWeek: '',
              pullMode: 'projectStart',
              jql: '',
              startDate: '',
              endDate: '',
              mode: 'normal',
              ...jiraConnection,
            })
          } catch (err: unknown) {
            toast('Jira 同步失败', { description: err instanceof Error ? err.message : '服务调用失败' })
            return
          }

          let defectsFromRange: number | null = null
          try {
            const history = await services.projectService.getProjectHistory(next.name)
            const weekly = history.weekly ?? []
            const startDate = next.validStartDate?.trim() || ''
            if (startDate) {
              defectsFromRange = weekly.reduce((acc, row) => {
                if (isWeekVisibleInRange(row.weekLabel, startDate, effectiveEndDate)) {
                  return acc + (Number.isFinite(row.created) ? row.created : 0)
                }
                return acc
              }, 0)
            }
          } catch {
            // ignore history aggregation failure; fall back to Jira fetchedCount
          }

          const defects = defectsFromRange ?? res.fetchedCount
          rowsToSave[0] = {
            ...rowsToSave[0],
            cycle: res.cycleLabel.replace(' - ', '-'),
            defects,
            teams: Math.max(1, Math.round(defects / 200)),
          }
        }

        await services.projectService.upsertCachedProjects(rowsToSave)
        await refresh()
        if (editingName && editingName !== next.name) {
          await services.projectService.deleteCachedProject(editingName)
          await refresh()
        }
        toast('已保存历史项目元数据', { description: next.name })
        setIsOpen(false)
      } catch (e: unknown) {
        toast('保存失败', { description: e instanceof Error ? e.message : '服务不可用' })
      } finally {
        setIsSaving(false)
      }
    })()
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>历史项目元数据</CardTitle>
            <CardDescription>
              项目 Key 为主键；Jira 或导入结果负责统计 Defect、周期和团队数，项目参数在这里手工维护。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-10 items-center justify-center rounded-2xl border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <Columns3 className="mr-2 h-4 w-4" />
                显示字段
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>列表字段</DropdownMenuLabel>
                  {PROJECT_METADATA_COLUMNS.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={visibleColumnIds.includes(column.id)}
                      onCheckedChange={(checked) => toggleColumn(column.id, checked === true)}
                    >
                      {column.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" className="rounded-2xl" onClick={() => openEdit()}>
              <Plus className="mr-2 h-4 w-4" />
              新增项目
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? '同步中...' : '导入'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => {
                const blob = new Blob([exportCsv(rows)], { type: 'text/csv;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `historical-project-metadata.${new Date().toISOString().slice(0, 10)}.csv`
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              导出
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,.tsv,text/csv,text/tab-separated-values,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (isImporting) return
                setIsImporting(true)
                void file
                  .text()
                  .then(async (text) => {
                    const imported = rowsFromImport(text)
                    if (!imported.length) {
                      toast('导入失败', { description: '没有识别到有效项目行' })
                      return
                    }

                    const todayIso = new Date().toISOString().slice(0, 10)
                    const processed: ProjectSummary[] = []
                    const failures: string[] = []

                    toast('开始批量同步 Jira', { description: `共 ${imported.length} 行` })

                    for (let idx = 0; idx < imported.length; idx += 1) {
                      const row = imported[idx]!
                      const key = row.name.trim().toUpperCase()
                      if (!key) continue
                      if (row.validStartDate?.trim() && row.validEndDate?.trim() && row.validStartDate > row.validEndDate) {
                        failures.push(`${key}: 有效开始日期不能晚于有效结束日期`)
                        processed.push(row)
                        continue
                      }
                      try {
                        const res = await services.jiraService.fetchByJql({
                          projectKey: key,
                          startWeek: '',
                          endWeek: '',
                          pullMode: 'projectStart',
                          jql: '',
                          startDate: '',
                          endDate: '',
                          mode: 'normal',
                          ...jiraConnection,
                        })

                        const startDate = row.validStartDate?.trim() || ''
                        const endDate = row.validEndDate?.trim() || todayIso

                        let defects = res.fetchedCount
                        let validStartDate = row.validStartDate
                        let validEndDate = row.validEndDate

                        if (startDate) {
                          const history = await services.projectService.getProjectHistory(key)
                          defects = (history.weekly ?? []).reduce((acc, w) => {
                            if (isWeekVisibleInRange(w.weekLabel, startDate, endDate)) {
                              return acc + (Number.isFinite(w.created) ? w.created : 0)
                            }
                            return acc
                          }, 0)
                        } else {
                          // 若导入行未提供有效开始日期，则对齐导入项目逻辑：用 Jira 返回的周期反填
                          validStartDate = res.periodStart ? res.periodStart.slice(0, 10) : row.validStartDate
                          validEndDate = res.periodEnd ? res.periodEnd.slice(0, 10) : row.validEndDate
                        }

                        processed.push(
                          normalizeRow({
                            ...row,
                            name: key,
                            cycle: res.cycleLabel.replace(' - ', '-'),
                            defects,
                            teams: Math.max(1, Math.round(defects / 200)),
                            validStartDate,
                            validEndDate,
                          }),
                        )
                      } catch (err: unknown) {
                        failures.push(`${key}: ${err instanceof Error ? err.message : 'Jira 同步失败'}`)
                        processed.push(row)
                      }
                    }

                    await services.projectService.upsertCachedProjects(processed)
                    await refresh()

                    if (failures.length) {
                      toast('批量导入完成（有失败）', {
                        description: `成功 ${processed.length - failures.length} / 失败 ${failures.length}；示例：${failures[0]}`,
                      })
                    } else {
                      toast('已导入历史项目元数据', { description: `共 ${processed.length} 行` })
                    }
                  })
                  .catch((err: unknown) => {
                    toast('导入失败', { description: err instanceof Error ? err.message : '文件解析失败' })
                  })
                  .finally(() => {
                    setIsImporting(false)
                  })
                e.target.value = ''
              }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map((column) => (
                  <TableHead key={column.id} className={column.align === 'right' ? 'text-right' : undefined}>
                    {column.label}
                  </TableHead>
                ))}
                <TableHead className="w-[96px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.name}>
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={[
                        column.id === 'name' ? 'font-mono text-xs' : '',
                        column.id === 'validWindow' ? 'whitespace-nowrap text-slate-500' : '',
                        column.align === 'right' ? 'text-right' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {formatProjectMetadataCell(row, column.id)}
                    </TableCell>
                  ))}
                  <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" className="h-8 rounded-xl px-3" onClick={() => openEdit(row)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-xl px-3"
                      onClick={() => {
                        void services.projectService
                          .deleteCachedProject(row.name)
                          .then(refresh)
                          .then(() => toast('已删除历史项目', { description: row.name }))
                          .catch((e: unknown) => {
                            toast('删除失败', { description: e instanceof Error ? e.message : '服务不可用' })
                          })
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[840px]">
          <DialogHeader>
            <DialogTitle>{editingName ? '编辑历史项目元数据' : '新增历史项目元数据'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>项目 Key</Label>
              <Input value={draft.name} onChange={(e) => setDraft((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>项目名称</Label>
              <Input value={draft.displayName ?? ''} onChange={(e) => setDraft((s) => ({ ...s, displayName: e.target.value }))} />
            </div>
            <SelectField label="项目类别" value={draft.projectCategory ?? ''} options={PROJECT_CATEGORY_OPTIONS} onChange={(v) => setDraft((s) => ({ ...s, projectCategory: v }))} />
            <SelectField label="目标区域" value={draft.region ?? ''} options={REGION_OPTIONS} onChange={(v) => setDraft((s) => ({ ...s, region: v }))} />
            <SelectField label="操作系统" value={draft.os ?? ''} options={OS_OPTIONS} onChange={(v) => setDraft((s) => ({ ...s, os: v }))} />
            <SelectField label="设备类型" value={draft.deviceType ?? ''} options={DEVICE_TYPE_OPTIONS} onChange={(v) => setDraft((s) => ({ ...s, deviceType: v }))} />
            <SelectField label="芯片状态" value={draft.chipsetStatus ?? ''} options={CHIPSET_STATUS_OPTIONS} onChange={(v) => setDraft((s) => ({ ...s, chipsetStatus: v }))} />
            <SelectField label="流水线" value={draft.pipeline ?? ''} options={PIPELINE_OPTIONS} onChange={(v) => setDraft((s) => ({ ...s, pipeline: v }))} />
            <SelectField label="外包商" value={draft.idhVendor ?? ''} options={IDH_VENDOR_OPTIONS} onChange={(v) => setDraft((s) => ({ ...s, idhVendor: v }))} />
            <div className="space-y-2">
              <Label>投入人力 MM</Label>
              <Input type="number" value={draft.mm ?? ''} onChange={(e) => setDraft((s) => ({ ...s, mm: parseNumber(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>需求量</Label>
              <Input type="number" value={draft.frQuantity ?? ''} onChange={(e) => setDraft((s) => ({ ...s, frQuantity: parseNumber(e.target.value) }))} />
            </div>
            <SelectField label="支持SIM卡" value={draft.supportSim ?? ''} options={SUPPORT_SIM_OPTIONS} onChange={(v) => setDraft((s) => ({ ...s, supportSim: v === 'No' ? 'No' : v === 'Yes' ? 'Yes' : undefined }))} />
            <div className="space-y-2">
              <Label>有效开始日期</Label>
              <Input type="date" value={draft.validStartDate ?? ''} onChange={(e) => setDraft((s) => ({ ...s, validStartDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>有效结束日期</Label>
              <Input type="date" value={draft.validEndDate ?? ''} onChange={(e) => setDraft((s) => ({ ...s, validEndDate: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label>运营商</Label>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border p-3 text-sm md:grid-cols-4">
                {OPERATOR_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-2">
                    <Checkbox
                      checked={(draft.operators ?? []).includes(option)}
                      onCheckedChange={(checked) =>
                        setDraft((s) => {
                          const current = s.operators ?? []
                          return {
                            ...s,
                            operators:
                              checked === true
                                ? current.includes(option)
                                  ? current
                                  : [...current, option]
                                : current.filter((x) => x !== option),
                          }
                        })
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label>用户测试</Label>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border p-3 text-sm md:grid-cols-4">
                {USER_PROGRAM_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-2">
                    <Checkbox
                      checked={(draft.userPrograms ?? []).includes(option)}
                      onCheckedChange={(checked) =>
                        setDraft((s) => {
                          const current = s.userPrograms ?? []
                          return {
                            ...s,
                            userPrograms:
                              checked === true
                                ? current.includes(option)
                                  ? current
                                  : [...current, option]
                                : current.filter((x) => x !== option),
                          }
                        })
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>周期</Label>
              <Input value={draft.cycle || '-'} readOnly className="bg-slate-50 text-slate-500" />
            </div>
            <div className="space-y-2">
              <Label>Defects 总量</Label>
              <Input type="number" value={draft.defects} readOnly className="bg-slate-50 text-slate-500" />
            </div>
            <div className="space-y-2">
              <Label>团队数</Label>
              <Input type="number" value={draft.teams} readOnly className="bg-slate-50 text-slate-500" />
            </div>
            <p className="text-xs text-slate-500 md:col-span-3">
              周期、Defects 总量和团队数来自 Jira 同步或导入统计；修改有效统计日期后，请重新同步该项目的 Jira 数据以刷新统计值。
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsOpen(false)}>
              取消
            </Button>
            <Button type="button" className="rounded-2xl" onClick={saveDraft} disabled={isSaving}>
              {isSaving ? '同步中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' || !v ? '' : v)}>
        <SelectTrigger className="w-full rounded-2xl">
          <span data-slot="select-value" className="flex flex-1 truncate text-left">
            {value || '未填写'}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">未填写</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
