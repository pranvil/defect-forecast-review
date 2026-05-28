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
import { Progress, ProgressLabel } from '@/components/ui/progress'
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
import { TagInput } from '@/components/common/TagInput'
import { services } from '@/services'
import type { ProjectSummary } from '@/services/projectService'
import {
  DEFAULT_PROJECT_METADATA_COLUMN_IDS,
  PROJECT_METADATA_COLUMNS,
  type ProjectMetadataColumnId,
  formatProjectMetadataCell,
} from '@/utils/projectMetadataColumns'
import {
  CHIPSET_NEWNESS_OPTIONS,
  CHIPSET_VENDOR_OPTIONS,
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
import type { JiraConnectionConfig } from '@/types/settings'
import { toBusinessWeekLabel } from '@/utils/week'

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
  chipsetVendor: '',
  chipsetNewness: '',
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

interface ImportStatus {
  total: number
  current: number
  success: number
  failed: number
  skipped: number
  currentKey: string
  message: string
  failures: string[]
  skippedProjects: string[]
  done: boolean
}

type ProjectMetadataAction = 'add' | 'edit' | 'import' | 'export'

type HistoricalProjectMetadataCardProps = {
  variant?: 'card' | 'controller'
  action?: ProjectMetadataAction | null
  editProjectKey?: string
  overwriteExistingOnImport?: boolean
  onOverwriteExistingOnImportChange?: (value: boolean) => void
  onActionHandled?: () => void
  onRowsChanged?: () => void
}

function normalizeRow(row: ProjectSummary): ProjectSummary {
  const [legacyNewness = '', legacyVendor = ''] = (row.chipsetStatus ?? '').split('_')
  const chipsetVendor = row.chipsetVendor?.trim() || legacyVendor || undefined
  const chipsetNewness = row.chipsetNewness?.trim() || legacyNewness || undefined
  return {
    ...row,
    name: row.name.trim().toUpperCase(),
    displayName: row.displayName?.trim() || undefined,
    cycle: row.cycle.trim() || '-',
    defects: Number.isFinite(row.defects) ? Math.max(0, Math.round(row.defects)) : 0,
    teams: Number.isFinite(row.teams) ? Math.max(1, Math.round(row.teams)) : 1,
    chipsetVendor,
    chipsetNewness,
    chipsetStatus: chipsetVendor && chipsetNewness ? `${chipsetNewness}_${chipsetVendor}` : row.chipsetStatus,
    operators: row.operators?.filter(Boolean) ?? [],
    userPrograms: row.userPrograms?.filter(Boolean) ?? [],
    frQuantity:
      typeof row.frQuantity === 'number' && Number.isFinite(row.frQuantity)
        ? Math.max(0, Math.round(row.frQuantity))
        : undefined,
    mm: typeof row.mm === 'number' && Number.isFinite(row.mm) ? Math.max(0, row.mm) : undefined,
  }
}

function normalizeImportDate(value: string): string | undefined {
  const text = value.trim()
  if (!text) return undefined
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(text)
  if (!match) return text
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return text
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return text
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
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

function parseSupportSim(value: string): ProjectSummary['supportSim'] | undefined {
  if (value === 'Yes' || value === 'No') return value
  return undefined
}

function parseDelimited(text: string): Record<string, string>[] {
  const normalizedText = text.replace(/^\uFEFF/, '')
  const firstLineEnd = normalizedText.indexOf('\n')
  const firstLine = firstLineEnd === -1 ? normalizedText : normalizedText.slice(0, firstLineEnd)
  const delimiter = firstLine.includes('\t') ? '\t' : ','
  
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false
  
  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i]
    if (char === '"') {
      if (inQuotes && normalizedText[i + 1] === '"') {
        currentCell += '"'
        i++ // Skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ''
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentCell)
      if (currentRow.some(c => c.trim())) rows.push(currentRow)
      currentRow = []
      currentCell = ''
    } else if (char !== '\r') {
      currentCell += char
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell)
    if (currentRow.some(c => c.trim())) rows.push(currentRow)
  }

  if (rows.length < 2) return []
  
  const headers = rows[0]!.map((x) =>
    x
      .split('(')[0]!
      .split('（')[0]!
      .trim(),
  )
  return rows.slice(1).map(row => {
    return Object.fromEntries(headers.map((header, idx) => [header, (row[idx] ?? '').trim()]))
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
        projectCategory: (() => {
          let v = getValue(raw, ['projectCategory', 'Project_category', '项目类别'])
          if (v === 'IDH 全O') v = 'IDH全O'
          return v || undefined
        })(),
        region: getValue(raw, ['region', 'Region', '目标区域']) || undefined,
        os: (() => {
          let v = getValue(raw, ['os', 'OS', '操作系统'])
          if (v.toUpperCase() === 'ANDROID') v = 'Android'
          if (v.toUpperCase() === 'KAIOS') v = 'Kaios'
          return v || undefined
        })(),
        deviceType: getValue(raw, ['deviceType', 'Device_Type', '设备类型']) || undefined,
        chipsetStatus: getValue(raw, ['chipsetStatus', 'Chipset Status', '芯片状态']) || undefined,
        chipsetVendor: getValue(raw, ['chipsetVendor', 'Chipset Vendor', '芯片平台']) || undefined,
        chipsetNewness: getValue(raw, ['chipsetNewness', 'Chipset Newness', '芯片新旧']) || undefined,
        pipeline: (() => {
          let v = getValue(raw, ['pipeline', '流水线'])
          if (v.toLowerCase() === 'no') v = '不部署'
          return v || undefined
        })(),
        operators: splitList(getValue(raw, ['operators', 'Operators', '运营商'])),
        userPrograms: splitList(getValue(raw, ['userPrograms', 'User Programs', '用户测试'])),
        idhVendor: getValue(raw, ['idhVendor', 'IDH Vendor', '外包商']) || undefined,
        frQuantity: parseNumber(getValue(raw, ['frQuantity', 'FR Quantity', '需求量'])),
        mm: parseNumber(getValue(raw, ['mm', 'MM', '投入人力'])),
        supportSim: (() => {
          const v = getValue(raw, ['supportSim', 'Support_SIM', '支持SIM卡'])
          return parseSupportSim(v)
        })(),
        validStartDate: normalizeImportDate(getValue(raw, ['validStartDate', '有效开始日期', '开始日期'])),
        validEndDate: normalizeImportDate(getValue(raw, ['validEndDate', '有效结束日期', '结束日期'])),
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
    'chipsetVendor',
    'chipsetNewness',
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
  return [headers.join(','), ...rows.map((row) => headers.map((key) => escapeCell(row[key as keyof ProjectSummary])).join(','))].join('\r\n')
}

function validateJiraConnection(config: JiraConnectionConfig): string | null {
  if (!config.baseUrl.trim()) return '请先在“系统配置”填写 Jira Base URL'
  if (!config.token.trim()) return '请先在“系统配置”填写 Jira Token / 密码'
  if (config.authType === 'basic' && !config.username.trim()) return 'Basic Auth 需要先在“系统配置”填写用户名'
  if (!Number.isFinite(config.timeoutSec) || config.timeoutSec < 3 || config.timeoutSec > 60) {
    return 'Jira 超时时间需在 3-60 秒之间'
  }
  return null
}

export function HistoricalProjectMetadataCard({
  variant = 'card',
  action = null,
  editProjectKey,
  overwriteExistingOnImport: overwriteExistingOnImportProp,
  onOverwriteExistingOnImportChange,
  onActionHandled,
  onRowsChanged,
}: HistoricalProjectMetadataCardProps = {}) {
  const [rows, setRows] = React.useState<ProjectSummary[]>([])
  const [draft, setDraft] = React.useState<ProjectSummary>(emptyDraft())
  const [isOpen, setIsOpen] = React.useState(false)
  const [editingName, setEditingName] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isImporting, setIsImporting] = React.useState(false)
  const [localOverwriteExistingOnImport, setLocalOverwriteExistingOnImport] = React.useState(false)
  const [importStatus, setImportStatus] = React.useState<ImportStatus | null>(null)
  const [visibleColumnIds, setVisibleColumnIds] = React.useState<ProjectMetadataColumnId[]>(
    DEFAULT_PROJECT_METADATA_COLUMN_IDS,
  )
  const jiraConnection = useSettingsStore((s) => s.jiraConnection)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const visibleColumns = React.useMemo(
    () => PROJECT_METADATA_COLUMNS.filter((column) => visibleColumnIds.includes(column.id)),
    [visibleColumnIds],
  )
  const existingProjectKeys = React.useMemo(
    () => new Set(rows.map((row) => row.name.trim().toUpperCase()).filter(Boolean)),
    [rows],
  )
  const overwriteExistingOnImport = overwriteExistingOnImportProp ?? localOverwriteExistingOnImport
  const setOverwriteExistingOnImport = React.useCallback(
    (value: boolean) => {
      if (onOverwriteExistingOnImportChange) {
        onOverwriteExistingOnImportChange(value)
        return
      }
      setLocalOverwriteExistingOnImport(value)
    },
    [onOverwriteExistingOnImportChange],
  )

  const toggleColumn = (columnId: ProjectMetadataColumnId, checked: boolean) => {
    setVisibleColumnIds((current) => {
      if (checked) return current.includes(columnId) ? current : [...current, columnId]
      return current.filter((id) => id !== columnId)
    })
  }

  const refresh = React.useCallback(() => {
    return services.projectService.listCachedProjects().then((nextRows) => {
      setRows(nextRows)
      onRowsChanged?.()
      return nextRows
    })
  }, [onRowsChanged])

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
      toast('保存失败', { description: '请填写开始日期（用于统计 Defect 数）' })
      return
    }
    if (!editingName && next.validStartDate?.trim() && next.validEndDate?.trim() && next.validStartDate > next.validEndDate) {
      toast('保存失败', { description: '开始日期不能晚于结束日期' })
      return
    }
    if (isSaving) return

    if (!editingName) {
      const connectionError = validateJiraConnection(jiraConnection)
      if (connectionError) {
        toast('Jira 同步失败', { description: connectionError })
        return
      }
    }

    const rowsToSave =
      editingName && editingName !== next.name
        ? rows.filter((row) => row.name !== editingName).concat(next)
        : [next]
    setIsSaving(true)
    void (async () => {
      try {
        // 仅新增时自动复用“导入项目”逻辑从 Jira 拉取全量数据；日期只作为默认分析窗口。
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

          const defects = res.fetchedCount
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

  const exportCurrentRows = React.useCallback(() => {
    const blob = new Blob([`\uFEFF${exportCsv(rows)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `historical-project-metadata.${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [rows])

  React.useEffect(() => {
    if (!action) return
    if (action === 'add') {
      openEdit()
    } else if (action === 'edit') {
      const key = editProjectKey?.trim().toUpperCase()
      if (key) {
        const row = rows.find((r) => r.name.trim().toUpperCase() === key)
        if (row) openEdit(row)
        else toast('未找到项目元数据', { description: `项目 ${key} 不存在或尚未加载` })
      }
    } else if (action === 'import') {
      fileInputRef.current?.click()
    } else if (action === 'export') {
      exportCurrentRows()
    }
    onActionHandled?.()
  }, [action, editProjectKey, exportCurrentRows, onActionHandled, rows])

  return (
    <Card
      className={
        variant === 'controller'
          ? 'fixed -left-[10000px] top-0 h-px w-px overflow-hidden'
          : 'flex h-[760px] flex-col rounded-2xl'
      }
    >
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>历史项目元数据</CardTitle>
            <CardDescription>
              项目 Key 为主键；Jira 或导入结果负责统计 Defect 和周期，项目参数在这里手工维护。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex h-10 items-center gap-2 rounded-2xl border px-3 text-sm text-slate-600">
              <Checkbox
                checked={overwriteExistingOnImport}
                disabled={isImporting}
                onCheckedChange={(checked) => setOverwriteExistingOnImport(checked === true)}
              />
              <span>覆盖已有项目</span>
            </label>
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
              {isImporting && importStatus?.total ? `同步 ${importStatus.current}/${importStatus.total}` : isImporting ? '同步中...' : '导入'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={exportCurrentRows}
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
                const connectionError = validateJiraConnection(jiraConnection)
                if (connectionError) {
                  toast('导入失败', { description: connectionError })
                  e.target.value = ''
                  return
                }
                let batchToastId: string | number | undefined
                setIsImporting(true)
                setImportStatus({
                  total: 0,
                  current: 0,
                  success: 0,
                  failed: 0,
                  skipped: 0,
                  currentKey: '',
                  message: '正在读取导入文件...',
                  failures: [],
                  skippedProjects: [],
                  done: false,
                })
                void file
                  .text()
                  .then(async (text) => {
                    const imported = rowsFromImport(text)
                    if (!imported.length) {
                      toast('导入失败', { description: '没有识别到有效项目行' })
                      setImportStatus((status) =>
                        status
                          ? { ...status, message: '导入失败：没有识别到有效项目行', done: true }
                          : status,
                      )
                      return
                    }
                    setImportStatus({
                      total: imported.length,
                      current: 0,
                      success: 0,
                      failed: 0,
                      skipped: 0,
                      currentKey: '',
                      message: '文件解析完成，准备同步 Jira...',
                      failures: [],
                      skippedProjects: [],
                      done: false,
                    })

                    const validationErrors: string[] = []
                    for (const row of imported) {
                      const k = row.name
                      if (row.projectCategory && !(PROJECT_CATEGORY_OPTIONS as readonly string[]).includes(row.projectCategory)) {
                        validationErrors.push(`${k}:项目类别[${row.projectCategory}]`)
                      }
                      if (row.region && !(REGION_OPTIONS as readonly string[]).includes(row.region)) {
                        validationErrors.push(`${k}:目标区域[${row.region}]`)
                      }
                      if (row.os && !(OS_OPTIONS as readonly string[]).includes(row.os)) {
                        validationErrors.push(`${k}:操作系统[${row.os}]`)
                      }
                      if (row.deviceType && !(DEVICE_TYPE_OPTIONS as readonly string[]).includes(row.deviceType)) {
                        validationErrors.push(`${k}:设备类型[${row.deviceType}]`)
                      }
                      if (row.chipsetVendor && !(CHIPSET_VENDOR_OPTIONS as readonly string[]).includes(row.chipsetVendor)) {
                        validationErrors.push(`${k}:芯片平台[${row.chipsetVendor}]`)
                      }
                      if (row.chipsetNewness && !(CHIPSET_NEWNESS_OPTIONS as readonly string[]).includes(row.chipsetNewness)) {
                        validationErrors.push(`${k}:芯片新旧[${row.chipsetNewness}]`)
                      }
                      if (row.pipeline && !(PIPELINE_OPTIONS as readonly string[]).includes(row.pipeline)) {
                        validationErrors.push(`${k}:流水线[${row.pipeline}]`)
                      }
                      if (row.idhVendor && !(IDH_VENDOR_OPTIONS as readonly string[]).includes(row.idhVendor)) {
                        validationErrors.push(`${k}:外包商[${row.idhVendor}]`)
                      }
                      if (row.supportSim && !['Yes', 'No'].includes(row.supportSim as string)) {
                        validationErrors.push(`${k}:支持SIM卡[${row.supportSim}]`)
                      }
                    }

                    if (validationErrors.length > 0) {
                      toast('导入失败：存在不合法的选项值', {
                        description: validationErrors.slice(0, 5).join('; ') + (validationErrors.length > 5 ? ' 等' : ''),
                      })
                      setImportStatus((status) =>
                        status
                          ? {
                              ...status,
                              failed: imported.length,
                              skipped: 0,
                              message: `导入失败：${validationErrors.length} 个选项值不合法`,
                              failures: validationErrors,
                              skippedProjects: [],
                              done: true,
                            }
                          : status,
                      )
                      return
                    }

                    const processed: ProjectSummary[] = []
                    const failures: string[] = []
                    const skippedProjects: string[] = []

                    batchToastId = toast.loading('开始批量同步 Jira', { description: `共 ${imported.length} 行` })

                    for (let idx = 0; idx < imported.length; idx += 1) {
                      const row = imported[idx]!
                      const key = row.name.trim().toUpperCase()
                      if (!key) continue
                      if (existingProjectKeys.has(key) && !overwriteExistingOnImport) {
                        skippedProjects.push(key)
                        setImportStatus((status) =>
                          status
                            ? {
                                ...status,
                                current: idx + 1,
                                skipped: status.skipped + 1,
                                currentKey: key,
                                message: `${key} 已存在，已跳过`,
                                skippedProjects: [...status.skippedProjects, key],
                              }
                            : status,
                        )
                        toast.loading(`跳过已存在项目：${key}`, {
                          id: batchToastId,
                          description: `${idx + 1} / ${imported.length}`,
                        })
                        continue
                      }
                      setImportStatus((status) =>
                        status
                          ? {
                              ...status,
                              current: idx + 1,
                              currentKey: key,
                              message: `正在同步 ${key}`,
                            }
                          : status,
                      )
                      toast.loading(`正在同步 Jira：${key}`, {
                        id: batchToastId,
                        description: `${idx + 1} / ${imported.length}`,
                      })
                      if (row.validStartDate?.trim() && row.validEndDate?.trim() && row.validStartDate > row.validEndDate) {
                        const message = `${key}: 开始日期不能晚于结束日期`
                        failures.push(message)
                        setImportStatus((status) =>
                          status
                            ? {
                                ...status,
                                failed: status.failed + 1,
                                message,
                                failures: [...status.failures, message],
                              }
                            : status,
                        )
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

                        let validStartDate = row.validStartDate
                        let validEndDate = row.validEndDate

                        if (!validStartDate?.trim()) {
                          validStartDate = res.periodStart ? res.periodStart.slice(0, 10) : row.validStartDate
                        }
                        if (!validEndDate?.trim()) {
                          validEndDate = res.periodEnd ? res.periodEnd.slice(0, 10) : row.validEndDate
                        }

                        processed.push(
                          normalizeRow({
                            ...row,
                            name: key,
                            cycle: res.cycleLabel.replace(' - ', '-'),
                            defects: res.fetchedCount,
                            teams: Math.max(1, Math.round(res.fetchedCount / 200)),
                            validStartDate,
                            validEndDate,
                          }),
                        )
                        setImportStatus((status) =>
                          status
                            ? {
                                ...status,
                                success: status.success + 1,
                                message: `${key} 同步完成，Defects=${res.fetchedCount}`,
                              }
                            : status,
                        )
                      } catch (err: unknown) {
                        const message = `${key}: ${err instanceof Error ? err.message : 'Jira 同步失败'}`
                        failures.push(message)
                        setImportStatus((status) =>
                          status
                            ? {
                                ...status,
                                failed: status.failed + 1,
                                message,
                                failures: [...status.failures, message],
                              }
                            : status,
                        )
                      }
                    }

                    setImportStatus((status) =>
                      status ? { ...status, message: '正在写入项目元数据...', currentKey: '' } : status,
                    )
                    if (processed.length > 0) {
                      await services.projectService.upsertCachedProjects(processed)
                    }
                    await refresh()

                    if (failures.length) {
                      if (batchToastId !== undefined) toast.dismiss(batchToastId)
                      toast.warning('批量导入完成（有失败）', {
                        description: `成功 ${processed.length} / 失败 ${failures.length} / 跳过 ${skippedProjects.length}；示例：${failures[0]}`,
                      })
                      setImportStatus((status) =>
                        status
                          ? {
                              ...status,
                              current: imported.length,
                              currentKey: '',
                              message: `批量导入完成：成功 ${processed.length}，失败 ${failures.length}，跳过 ${skippedProjects.length}`,
                              done: true,
                            }
                          : status,
                      )
                    } else {
                      if (batchToastId !== undefined) toast.dismiss(batchToastId)
                      toast.success('已导入历史项目元数据', {
                        description: `成功 ${processed.length} / 失败 0 / 跳过 ${skippedProjects.length}`,
                      })
                      setImportStatus((status) =>
                        status
                          ? {
                              ...status,
                              current: imported.length,
                              currentKey: '',
                              message: `批量导入完成：成功 ${processed.length}，失败 0，跳过 ${skippedProjects.length}`,
                              done: true,
                            }
                          : status,
                      )
                    }
                  })
                  .catch((err: unknown) => {
                    if (batchToastId !== undefined) toast.dismiss(batchToastId)
                    toast('导入失败', { description: err instanceof Error ? err.message : '文件解析失败' })
                    setImportStatus((status) =>
                      status
                        ? {
                            ...status,
                            message: err instanceof Error ? err.message : '文件解析失败',
                            done: true,
                          }
                        : status,
                    )
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
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {importStatus ? (
          <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-sm text-slate-700">
            <Progress
              value={importStatus.total ? Math.round((importStatus.current / importStatus.total) * 100) : 0}
              className="gap-2"
            >
              <ProgressLabel>
                {importStatus.done ? '批量导入完成' : importStatus.currentKey ? `正在同步 ${importStatus.currentKey}` : '批量导入'}
              </ProgressLabel>
              <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                {importStatus.total ? `${importStatus.current}/${importStatus.total}` : '准备中'}
              </span>
            </Progress>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span>{importStatus.message}</span>
              <span className="text-emerald-700">成功 {importStatus.success}</span>
              <span className="text-rose-700">失败 {importStatus.failed}</span>
              <span className="text-slate-500">跳过 {importStatus.skipped}</span>
            </div>
            {importStatus.failures.length > 0 ? (
              <div className="mt-3 max-h-28 overflow-y-auto rounded-lg border border-rose-100 bg-white/75 p-2 text-xs text-rose-700">
                <div className="mb-1 font-medium">失败项目</div>
                {importStatus.failures.map((failure) => (
                  <div key={failure} className="py-0.5">
                    {failure}
                  </div>
                ))}
              </div>
            ) : null}
            {importStatus.done && importStatus.skippedProjects.length > 0 ? (
              <div className="mt-2 max-h-20 overflow-y-auto rounded-lg border border-slate-200 bg-white/75 p-2 text-xs text-slate-600">
                <span className="font-medium">已跳过已有项目：</span>
                {importStatus.skippedProjects.join('、')}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
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
            <SelectField
              label="芯片平台"
              value={draft.chipsetVendor ?? draft.chipsetStatus?.split('_')[1] ?? ''}
              options={CHIPSET_VENDOR_OPTIONS}
              onChange={(v) =>
                setDraft((s) => ({
                  ...s,
                  chipsetVendor: v,
                  chipsetStatus: `${s.chipsetNewness || s.chipsetStatus?.split('_')[0] || ''}_${v}`,
                }))
              }
            />
            <SelectField
              label="芯片新旧"
              value={draft.chipsetNewness ?? draft.chipsetStatus?.split('_')[0] ?? ''}
              options={CHIPSET_NEWNESS_OPTIONS}
              onChange={(v) =>
                setDraft((s) => ({
                  ...s,
                  chipsetNewness: v,
                  chipsetStatus: `${v}_${s.chipsetVendor || s.chipsetStatus?.split('_')[1] || ''}`,
                }))
              }
            />
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
              <Label>开始日期</Label>
              <Input
                type="date"
                value={draft.validStartDate ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  setDraft((s) => {
                    const startLabel = val ? toBusinessWeekLabel(val) : ''
                    const endLabel = s.validEndDate ? toBusinessWeekLabel(s.validEndDate) : ''
                    const autoCycle = startLabel || endLabel ? `${startLabel}-${endLabel}`.replace(/^-|-$/, '') : s.cycle
                    return { ...s, validStartDate: val, cycle: autoCycle }
                  })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>结束日期</Label>
              <Input
                type="date"
                value={draft.validEndDate ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  setDraft((s) => {
                    const startLabel = s.validStartDate ? toBusinessWeekLabel(s.validStartDate) : ''
                    const endLabel = val ? toBusinessWeekLabel(val) : ''
                    const autoCycle = startLabel || endLabel ? `${startLabel}-${endLabel}`.replace(/^-|-$/, '') : s.cycle
                    return { ...s, validEndDate: val, cycle: autoCycle }
                  })
                }}
              />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label>运营商</Label>
              <TagInput 
                value={draft.operators ?? []} 
                onChange={(val) => setDraft((s) => ({ ...s, operators: val }))} 
                suggestions={OPERATOR_OPTIONS} 
              />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label>用户测试</Label>
              <TagInput 
                value={draft.userPrograms ?? []} 
                onChange={(val) => setDraft((s) => ({ ...s, userPrograms: val }))} 
                suggestions={USER_PROGRAM_OPTIONS} 
              />
            </div>
            <div className="space-y-2">
              <Label>周期</Label>
              <Input value={draft.cycle || '-'} readOnly className="bg-slate-50 text-slate-500" />
            </div>
            <div className="space-y-2">
              <Label>Defects 总量</Label>
              <Input type="number" value={draft.defects} readOnly className="bg-slate-50 text-slate-500" />
            </div>
            <p className="text-xs text-slate-500 md:col-span-3">
              周期和 Defects 总量来自 Jira 同步或导入统计；修改开始/结束日期后，将自动计算周期。请重新同步 Jira 数据以刷新缺陷总量。
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
