import { AlertTriangle, Database, Download, FileSpreadsheet, History, Plus, Search, Sparkles, Trash2, Wand2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Kpi } from '@/components/common/Kpi'
import { ExcelTemplatePreview } from '@/components/excel-preview/ExcelTemplatePreview'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { services } from '@/services'
import { ProjectPicker } from '@/components/common/ProjectPicker'
import { useForecastStore } from '@/stores/forecastStore'
import { useTeamStore } from '@/stores/teamStore'
import { adjustCell, adjustGrandTotal, adjustTeamTotal } from '@/utils/datasetAdjustment'
import {
  ensureMilestoneDateIso,
  formatIsoDateLocal,
  milestoneMondayIsoToWeekLabel,
  milestoneWeekToMondayIso,
  mondayOfCalendarWeek,
  normalizeMilestoneDateToIso,
  parseIsoDateLocal,
  compareWeekAsc,
} from '@/utils/week'
import { isReviewMode } from '@/runtime/mode'
import { formatProjectLabel } from '@/utils/projectLibrary'
import { defectInputFromParams, findTopSimilarProjects } from '@/utils/defectCalculation'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ForecastResult } from '@/services/forecastService'
import type { MilestoneLabel } from '@/types/project'
import type { MilestoneParam, RefProjectRow } from '@/types/forecast'

function AdjustableInput({ value, onChange, className }: { value: number, onChange: (val: number) => void, className?: string }) {
  const [local, setLocal] = React.useState<string>(String(value))
  
  React.useEffect(() => {
    setLocal(String(value))
  }, [value])
  
  return (
    <Input
      type="number"
      className={className}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => {
        const val = Math.trunc(Number(local))
        if (!isNaN(val) && val >= 0) {
          onChange(val)
        } else {
          setLocal(String(value))
        }
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        }
      }}
    />
  )
}

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

function formatOptionalPercent(n: number | null | undefined): string {
  return n == null ? '—' : `${n}%`
}

/** 由周期与日期输入得到规范化的周次 + 周一 ISO 日期；无法推算则返回 null。 */
function resolveMilestoneWeekAndDate(
  weekRaw: string,
  dateTextRaw: string,
): { week: string; date: string } | null {
  const weekTrim = weekRaw.trim()
  const dateT = dateTextRaw.trim()
  if (!weekTrim && !dateT) return { week: '', date: '' }
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

function firstScheduledMilestone(milestones: MilestoneParam[]): MilestoneParam | null {
  return milestones
    .filter((milestone) => milestone.week.trim())
    .slice()
    .sort((a, b) => compareWeekAsc(a.week, b.week))[0] ?? null
}

function milestoneWeekForDataset(week: string): string {
  const trimmed = week.trim().toUpperCase()
  const parsed = /(?:\d{2}|\d{4})?W(\d{1,2})/.exec(trimmed)
  return parsed ? `W${Number(parsed[1])}` : trimmed
}

function milestoneLabelsFromCurrentNodes(milestones: MilestoneParam[]): MilestoneLabel[] {
  return milestones
    .filter((milestone) => milestone.week.trim())
    .slice()
    .sort((a, b) => compareWeekAsc(a.week, b.week))
    .map((milestone) => ({
      label: milestone.name,
      week: milestoneWeekForDataset(milestone.week),
      devResolutionRate: milestone.devResolutionRate,
      testCompletionRate: milestone.testCompletionRate,
      testSubmissionRate: milestone.testSubmissionRate,
    }))
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
  const teamSelection = useForecastStore((s) => s.teamSelection)
  const toggleSelectedTeam = useForecastStore((s) => s.toggleSelectedTeam)
  const ensureDefaultTeamSelection = useForecastStore((s) => s.ensureDefaultTeamSelection)
  const params = useForecastStore((s) => s.params)
  const setParams = useForecastStore((s) => s.setParams)
  const teams = useTeamStore((s) => s.teams)
  const hydrateTeamsFromServer = useTeamStore((s) => s.hydrateFromServer)

  const testingTeams = React.useMemo(() => teams.filter((x) => x.type === 'testing'), [teams])
  const devTeams = React.useMemo(() => teams.filter((x) => x.type === 'development'), [teams])

  React.useEffect(() => {
    ensureDefaultTeamSelection(
      testingTeams.map((t) => t.name),
      devTeams.map((t) => t.name),
    )
  }, [devTeams, ensureDefaultTeamSelection, testingTeams])

  const [projectCycleByName, setProjectCycleByName] = React.useState<Record<string, string>>({})
  const [projectDisplayNameByKey, setProjectDisplayNameByKey] = React.useState<Record<string, string>>({})
  const [allProjects, setAllProjects] = React.useState<string[]>([])
  const projectPickerOptions = React.useMemo(
    () =>
      allProjects.map((projectKey) => ({
        key: projectKey,
        displayName: projectDisplayNameByKey[projectKey],
      })),
    [allProjects, projectDisplayNameByKey],
  )
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
  const [forecastResult, setForecastResult] = React.useState<ForecastResult | null>(null)
  const [originalDataset, setOriginalDataset] = React.useState<ForecastDataset | null>(null)
  const [forecastError, setForecastError] = React.useState('')
  const [isForecasting, setIsForecasting] = React.useState(false)
  const [shouldScrollToForecast, setShouldScrollToForecast] = React.useState(false)
  const forecastResultRef = React.useRef<HTMLDivElement | null>(null)

  const enabledTestingTeams = React.useMemo(
    () => (teamSelection.testing.length ? teamSelection.testing : testingTeams.map((t) => t.name)),
    [teamSelection.testing, testingTeams],
  )
  const enabledDevTeams = React.useMemo(
    () => (teamSelection.development.length ? teamSelection.development : devTeams.map((t) => t.name)),
    [devTeams, teamSelection.development],
  )

  const forecastInput = React.useMemo(
    () => ({
      params,
      enabledTestingTeams,
      enabledDevTeams,
      testingTeamConfigs: testingTeams,
      devTeamConfigs: devTeams,
      milestones,
      refProjects,
    }),
    [devTeams, enabledDevTeams, enabledTestingTeams, milestones, params, refProjects, testingTeams],
  )

  const runForecast = React.useCallback(() => {
    const firstMilestone = firstScheduledMilestone(milestones)
    const startWeek = params.startWeek.trim()
    if (firstMilestone && startWeek && compareWeekAsc(firstMilestone.week, startWeek) !== 0) {
      const message = `项目开始时间是 ${startWeek}，但第一个有周期的节点 ${firstMilestone.name} 是 ${firstMilestone.week}。请先修改项目开始时间或节点周期，保持两者一致。`
      setForecastResult(null)
      setOriginalDataset(null)
      setForecastError(message)
      toast('开始时间冲突', { description: message })
      return
    }
    setIsForecasting(true)
    setForecastError('')
    void services.forecastService
      .getForecastResult(forecastInput)
      .then((result) => {
        setForecastResult(result)
        setOriginalDataset(result.dataset)
        setShouldScrollToForecast(true)
        toast('预测已完成', { description: `预估总数 ${result.estimatedDefects ?? result.dataset.weekly.at(-1)?.cumCreated ?? 0}` })
      })
      .catch((e: unknown) => {
        setForecastResult(null)
        setOriginalDataset(null)
        setForecastError(e instanceof Error ? e.message : '预测服务调用失败')
      })
      .finally(() => setIsForecasting(false))
  }, [forecastInput, milestones, params.startWeek])

  React.useEffect(() => {
    if (!forecastResult || !shouldScrollToForecast) return
    const frame = window.requestAnimationFrame(() => {
      forecastResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setShouldScrollToForecast(false)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [forecastResult, shouldScrollToForecast])

  const toggleParamValue = (
    key: 'operators' | 'userPrograms',
    value: string,
    checked: boolean,
  ) => {
    const current = params[key]
    setParams({
      [key]: checked ? Array.from(new Set([...current, value])) : current.filter((x) => x !== value),
    })
  }

  const updateInlineMilestone = React.useCallback(
    (index: number, patch: Partial<MilestoneParam>) => {
      const current = milestones[index]
      if (!current) return
      updateMilestone(index, { ...current, ...patch })
    },
    [milestones, updateMilestone],
  )

  const updateInlineMilestoneSchedule = React.useCallback(
    (index: number, weekRaw: string, dateRaw: string) => {
      const resolved = resolveMilestoneWeekAndDate(weekRaw, dateRaw)
      if (!resolved) {
        toast('请填写有效周期或日期', {
          description: '日期须能解析为有效日历日，或清空周期和日期',
        })
        return
      }
      updateInlineMilestone(index, { week: resolved.week, date: resolved.date })
    },
    [updateInlineMilestone],
  )

  const updateInlineMilestoneRate = React.useCallback(
    (index: number, key: 'devResolutionRate' | 'testCompletionRate' | 'testSubmissionRate', raw: string) => {
      const value = optionalRateFromForm(raw)
      updateInlineMilestone(index, { [key]: value } as Partial<MilestoneParam>)
    },
    [updateInlineMilestone],
  )

  const autoIdentifyRefProjects = () => {
    void services.projectService
      .listCachedProjects()
      .then((projects) => {
        const byScore = findTopSimilarProjects(defectInputFromParams(params), projects, 3).map(
          ({ project, score }) => ({
            project: project.name,
            similarity: Math.round(score * 100),
            source: '系统识别',
          }),
        )
        if (!byScore.length) {
          toast('暂无可识别项目', { description: '请先在项目库中准备缓存项目' })
          return
        }
        useForecastStore.getState().setRefProjects(byScore)
        toast('已识别相似项目', { description: `已更新 ${byScore.length} 条参考项目` })
      })
      .catch((e: unknown) => {
        toast('识别失败', { description: e instanceof Error ? e.message : '历史项目读取失败' })
      })
  }

  const forecastDataset = React.useMemo(() => {
    if (!forecastResult) return undefined
    const currentMilestoneLabels = milestoneLabelsFromCurrentNodes(milestones)
    return {
      ...forecastResult.dataset,
      milestones: currentMilestoneLabels.length ? currentMilestoneLabels : forecastResult.dataset.milestones,
    }
  }, [forecastResult, milestones])
  const forecastFinalRow = forecastDataset?.weekly.at(-1)
  const forecastEstimatedDefects = forecastResult
    ? forecastResult.estimatedDefects ?? forecastFinalRow?.cumCreated ?? 0
    : 0
  const enrichedForecastResult = React.useMemo(
    () => (forecastResult && forecastDataset ? { ...forecastResult, dataset: forecastDataset } : forecastResult),
    [forecastDataset, forecastResult],
  )

  const saveForecastRecord = React.useCallback(() => {
    if (!enrichedForecastResult) return
    void services.forecastService
      .saveForecastVersion({
        projectName: params.newProjectName,
        input: forecastInput,
        result: enrichedForecastResult,
      })
      .then((saved) => {
        toast('已保存预测版本', { description: `版本 ${saved.id.slice(0, 8)}` })
      })
      .catch((e: unknown) => {
        toast('保存失败', { description: e instanceof Error ? e.message : '服务调用失败' })
      })
  }, [enrichedForecastResult, forecastInput, params.newProjectName])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">新项目预测</h2>
        <p className="mt-1 text-sm text-slate-500">
          先填基础参数，再自动识别相似项目或手工维护参考项目；节点信息也作为基础参数单独维护。
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold">新项目信息</h3>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl px-6"
              onClick={autoIdentifyRefProjects}
            >
              <Search className="mr-2 h-4 w-4" />
              自动识别
            </Button>
              <Button
                type="button"
                className="rounded-2xl px-6"
                disabled={isForecasting}
                onClick={runForecast}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {isForecasting ? '预测中...' : '开始预测'}
              </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-12 xl:auto-rows-fr">
          <Card className="h-full rounded-2xl xl:col-span-3">
            <CardHeader>
              <CardTitle>项目基础信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>新项目名称</Label>
                    <Input
                      value={params.newProjectName}
                      onChange={(e) => setParams({ newProjectName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>开始时间</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={params.startWeek}
                        onChange={(e) => setParams({ startWeek: e.target.value })}
                        placeholder="例如 26W2"
                      />
                      <Input
                        type="date"
                        className="w-[9.5rem] shrink-0 rounded-xl"
                        value={milestoneWeekToMondayIso(params.startWeek)}
                        onChange={(e) => {
                          const week = milestoneMondayIsoToWeekLabel(e.target.value)
                          if (week) setParams({ startWeek: week })
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>结束时间</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={params.endWeek}
                        onChange={(e) => setParams({ endWeek: e.target.value })}
                        placeholder="例如 26W27"
                      />
                      <Input
                        type="date"
                        className="w-[9.5rem] shrink-0 rounded-xl"
                        value={milestoneWeekToMondayIso(params.endWeek)}
                        onChange={(e) => {
                          const week = milestoneMondayIsoToWeekLabel(e.target.value)
                          if (week) setParams({ endWeek: week })
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>项目类别</Label>
                    <Select
                      value={params.projectCategory}
                      onValueChange={(v) => setParams({ projectCategory: v ?? params.projectCategory })}
                    >
                      <SelectTrigger className="w-full rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_CATEGORY_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>目标区域</Label>
                    <Select value={params.region} onValueChange={(v) => setParams({ region: v ?? params.region })}>
                      <SelectTrigger className="w-full rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REGION_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>操作系统</Label>
                    <Select value={params.os} onValueChange={(v) => setParams({ os: v ?? params.os })}>
                      <SelectTrigger className="w-full rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>设备类型</Label>
                    <Select
                      value={params.deviceType}
                      onValueChange={(v) => setParams({ deviceType: v ?? params.deviceType })}
                    >
                      <SelectTrigger className="w-full rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEVICE_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="h-full rounded-2xl xl:col-span-4">
              <CardHeader>
                <CardTitle>技术变量</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>芯片平台</Label>
                    <Select
                      value={params.chipsetVendor}
                      onValueChange={(v) =>
                        setParams({
                          chipsetVendor: v ?? params.chipsetVendor,
                          chipsetStatus: `${params.chipsetNewness}_${v ?? params.chipsetVendor}`,
                        })
                      }
                    >
                      <SelectTrigger className="w-full rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHIPSET_VENDOR_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>芯片新旧</Label>
                    <Select
                      value={params.chipsetNewness}
                      onValueChange={(v) =>
                        setParams({
                          chipsetNewness: v ?? params.chipsetNewness,
                          chipsetStatus: `${v ?? params.chipsetNewness}_${params.chipsetVendor}`,
                        })
                      }
                    >
                      <SelectTrigger className="w-full rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHIPSET_NEWNESS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>流水线</Label>
                    <Select
                      value={params.pipeline}
                      onValueChange={(v) => setParams({ pipeline: v ?? params.pipeline })}
                    >
                      <SelectTrigger className="w-full rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PIPELINE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>外包商</Label>
                    <Select
                      value={params.idhVendor || '__none__'}
                      onValueChange={(v) => setParams({ idhVendor: v === '__none__' || !v ? '' : v })}
                    >
                      <SelectTrigger className="w-full rounded-2xl">
                        <span data-slot="select-value" className="flex flex-1 truncate text-left">
                          {params.idhVendor || '未选择'}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">未选择</SelectItem>
                        {IDH_VENDOR_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>需求量</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step={1}
                      value={String(params.frQuantity)}
                      onChange={(e) => setParams({ frQuantity: Math.trunc(Number(e.target.value || 0)) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>投入人力</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step={1}
                      value={String(params.mm)}
                      onChange={(e) => setParams({ mm: Math.trunc(Number(e.target.value || 0)) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>支持SIM卡</Label>
                    <Select
                      value={params.supportSim}
                      onValueChange={(v) => setParams({ supportSim: v as (typeof SUPPORT_SIM_OPTIONS)[number] })}
                    >
                      <SelectTrigger className="w-full rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORT_SIM_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>运营商</Label>
                    <div className="grid grid-cols-2 gap-2 rounded-2xl border p-3 text-sm md:grid-cols-3">
                      {OPERATOR_OPTIONS.map((option) => (
                        <label key={option} className="flex items-center gap-2">
                          <Checkbox
                            checked={params.operators.includes(option)}
                            onCheckedChange={(checked) => toggleParamValue('operators', option, checked === true)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>用户测试</Label>
                    <div className="grid grid-cols-2 gap-2 rounded-2xl border p-3 text-sm md:grid-cols-4">
                      {USER_PROGRAM_OPTIONS.map((option) => (
                        <label key={option} className="flex items-center gap-2">
                          <Checkbox
                            checked={params.userPrograms.includes(option)}
                            onCheckedChange={(checked) => toggleParamValue('userPrograms', option, checked === true)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="h-full rounded-2xl xl:col-span-5">
              <CardHeader>
                <CardTitle>节点信息</CardTitle>
                <CardDescription>默认节点已预置；周期为空的节点只作为模板。</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[455px] rounded-xl border">
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[96px]">节点名</TableHead>
                        <TableHead className="w-[92px]">周期</TableHead>
                        <TableHead className="w-[132px]">日期</TableHead>
                        <TableHead className="whitespace-nowrap">测试提交率</TableHead>
                        <TableHead className="whitespace-nowrap">开发解决率</TableHead>
                        <TableHead className="whitespace-nowrap">测试完成率</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {milestones.map((m, idx) => (
                        <TableRow key={m.name + m.week + String(idx)}>
                          <TableCell>
                            <Input
                              defaultValue={m.name}
                              className="h-8 min-w-[80px] rounded-lg px-2"
                              onBlur={(e) => {
                                const name = e.target.value.trim()
                                if (!name) {
                                  toast('节点名不能为空')
                                  e.target.value = m.name
                                  return
                                }
                                if (name !== m.name) updateInlineMilestone(idx, { name })
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              defaultValue={m.week}
                              className="h-8 min-w-[78px] rounded-lg px-2"
                              placeholder="26W20"
                              onBlur={(e) => {
                                const week = e.target.value.trim()
                                if (week === m.week) return
                                updateInlineMilestoneSchedule(idx, week, '')
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              defaultValue={m.date}
                              className="h-8 min-w-[120px] rounded-lg px-2"
                              onBlur={(e) => {
                                const dateText = e.target.value.trim()
                                if (dateText === m.date) return
                                updateInlineMilestoneSchedule(idx, '', dateText)
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              defaultValue={formatOptionalPercent(m.testSubmissionRate) === '—' ? '' : formatOptionalPercent(m.testSubmissionRate)}
                              className="h-8 min-w-[84px] rounded-lg px-2"
                              onBlur={(e) => updateInlineMilestoneRate(idx, 'testSubmissionRate', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              defaultValue={formatOptionalPercent(m.devResolutionRate) === '—' ? '' : formatOptionalPercent(m.devResolutionRate)}
                              className="h-8 min-w-[84px] rounded-lg px-2"
                              onBlur={(e) => updateInlineMilestoneRate(idx, 'devResolutionRate', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              defaultValue={formatOptionalPercent(m.testCompletionRate) === '—' ? '' : formatOptionalPercent(m.testCompletionRate)}
                              className="h-8 min-w-[84px] rounded-lg px-2"
                              onBlur={(e) => updateInlineMilestoneRate(idx, 'testCompletionRate', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
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
                </ScrollArea>
                <div className="mt-4 flex flex-wrap gap-3">
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
                    批量导入
                  </Button>
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
      </div>

      <div className={`grid grid-cols-1 items-stretch gap-6 xl:grid-cols-3 xl:auto-rows-fr ${forecastResult ? 'order-last' : ''}`}>
        <Card className="h-full rounded-2xl">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>参考项目</CardTitle>
                <CardDescription>可以自动识别，也可以完全手工添加/删除</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => setIsAddRefOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                手工添加
              </Button>
            </div>
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
                      {formatProjectLabel(row.project, projectDisplayNameByKey[row.project])}
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

        <Card className="h-full rounded-2xl">
          <CardHeader>
            <CardTitle>测试团队拆分</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>启用</TableHead>
                    <TableHead>聚合团队</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testingTeams.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Checkbox
                          checked={teamSelection.testing.includes(t.name)}
                          onCheckedChange={(checked) =>
                            toggleSelectedTeam('testing', t.name, checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="h-full rounded-2xl">
          <CardHeader>
            <CardTitle>开发团队拆分</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>启用</TableHead>
                    <TableHead>聚合团队</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devTeams.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Checkbox
                          checked={teamSelection.development.includes(t.name)}
                          onCheckedChange={(checked) =>
                            toggleSelectedTeam('development', t.name, checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="hidden">
          <CardHeader>
            <CardTitle>节点信息</CardTitle>
            <CardDescription>
              默认节点已预置，可按项目维护周期和日期；填写日期时会保存为每周周一的
              YYYY-MM-DD（含年份），并与周期联动。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>节点名</TableHead>
                  <TableHead>周期</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead className="whitespace-nowrap">测试提交率</TableHead>
                  <TableHead className="whitespace-nowrap">开发解决率</TableHead>
                  <TableHead className="whitespace-nowrap">测试完成率</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones.map((m, idx) => (
                  <TableRow key={m.name + m.week + String(idx)}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>{m.week}</TableCell>
                    <TableCell className="text-slate-500">{ensureMilestoneDateIso(m)}</TableCell>
                    <TableCell className="text-slate-600">{formatOptionalPercent(m.testSubmissionRate)}</TableCell>
                    <TableCell className="text-slate-600">{formatOptionalPercent(m.devResolutionRate)}</TableCell>
                    <TableCell className="text-slate-600">{formatOptionalPercent(m.testCompletionRate)}</TableCell>
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
                              dev: m.devResolutionRate != null ? String(m.devResolutionRate) : '',
                              testComplete:
                                m.testCompletionRate != null ? String(m.testCompletionRate) : '',
                              testSubmit:
                                m.testSubmissionRate != null ? String(m.testSubmissionRate) : '',
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
                          x !== null && Boolean(x.name),
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

      <div className="hidden">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>测试团队拆分</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>启用</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>覆盖范围</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testingTeams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Checkbox
                        checked={teamSelection.testing.includes(t.name)}
                        onCheckedChange={(checked) =>
                          toggleSelectedTeam('testing', t.name, checked === true)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-slate-500">{t.note || '固定分类'}</TableCell>
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
                  <TableHead>启用</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>覆盖范围</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devTeams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Checkbox
                        checked={teamSelection.development.includes(t.name)}
                        onCheckedChange={(checked) =>
                          toggleSelectedTeam('development', t.name, checked === true)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-slate-500">{t.note || '固定分类'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {forecastError && (
        <Card className="rounded-2xl border-rose-200 bg-rose-50">
          <CardContent className="pt-6 text-sm text-rose-700">{forecastError}</CardContent>
        </Card>
      )}

      {forecastResult && forecastDataset && forecastFinalRow && (
        <div ref={forecastResultRef} className="space-y-6 scroll-mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold">预测结果</h3>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={saveForecastRecord}
              >
                <Download className="mr-2 h-4 w-4" />
                保存预测记录
              </Button>
              <Button
                type="button"
                className="rounded-2xl"
                disabled={isReviewMode}
                onClick={() => {
                  if (isReviewMode) {
                    toast('评审版暂未开放', { description: 'Excel 导出在评审版中已禁用' })
                    return
                  }
                  void services.exportService
                    .exportForecastToExcel({
                      projectName: params.newProjectName,
                      dataset: forecastDataset,
                    })
                    .then(() => {
                      toast('已导出', { description: '已生成并下载 xlsx 文件' })
                    })
                    .catch((e: unknown) => {
                      toast('导出失败', {
                        description: e instanceof Error ? e.message : '请确认本地导出服务已启动',
                      })
                    })
                }}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                导出 Excel
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Kpi title="预估 Bug 总数" value={forecastEstimatedDefects} sub={params.newProjectName} icon={Sparkles} />
            <Kpi title="预测总 Fixed" value={forecastFinalRow.cumFixed} sub={`${params.startWeek} - ${params.endWeek}`} icon={Database} />
            <Kpi title="最终 Backlog" value={forecastFinalRow.backlog} sub="累计创建 - 累计解决" icon={History} />
            <Kpi title="参考项目数" value={forecastResult.referenceProjects?.length ?? refProjects.length} sub="当前参考项目列表" icon={Wand2} />
          </div>

          {!!forecastResult.warnings?.length && (
            <Card className="rounded-2xl border-amber-200 bg-amber-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  预测约束提醒
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-amber-900">
                {forecastResult.warnings.map((warning, index) => (
                  <div key={`${warning.type}-${warning.milestone ?? ''}-${index}`}>
                    {warning.message}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl">
            <Tabs defaultValue="area" className="w-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Created / Fixed / Backlog 预测趋势</CardTitle>
                <TabsList className="rounded-2xl">
                  <TabsTrigger value="area">面积图</TabsTrigger>
                  <TabsTrigger value="bar">柱形图</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="h-[340px]">
                <TabsContent value="area" className="mt-0 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={forecastDataset.weekly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="weekLabel" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="created" name="Arrive_forecast" stroke="#0284c7" fill="#7dd3fc" fillOpacity={0.25} strokeWidth={2} />
                      <Area type="monotone" dataKey="fixed" name="Resolve plan" stroke="#16a34a" fill="#86efac" fillOpacity={0.2} strokeWidth={2} />
                      <Line type="monotone" dataKey="backlog" name="Backlog_plan" stroke="#0f172a" strokeWidth={2.5} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </TabsContent>
                <TabsContent value="bar" className="mt-0 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={forecastDataset.weekly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="weekLabel" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="created" name="Arrive_forecast" fill="#0284c7" />
                      <Bar dataKey="fixed" name="Resolve plan" fill="#eab308" />
                      <Line type="monotone" dataKey="backlog" name="Backlog_plan" stroke="#0ea5e9" strokeWidth={2.5} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          <Tabs defaultValue="excel" className="w-full">
            <TabsList className="rounded-2xl">
              <TabsTrigger value="weekly">按周结果</TabsTrigger>
              <TabsTrigger value="team">开发/测试拆分</TabsTrigger>
              <TabsTrigger value="excel">Excel 模板预览</TabsTrigger>
            </TabsList>
            <TabsContent value="weekly" className="mt-4">
              <Card className="rounded-2xl">
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>周期</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Fixed</TableHead>
                        <TableHead>累计创建</TableHead>
                        <TableHead>累计解决</TableHead>
                        <TableHead>Backlog</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forecastDataset.weekly.map((row) => (
                        <TableRow key={row.week}>
                          <TableCell className="font-medium">{row.weekLabel}</TableCell>
                          <TableCell>{row.created}</TableCell>
                          <TableCell>{row.fixed}</TableCell>
                          <TableCell>{row.cumCreated}</TableCell>
                          <TableCell>{row.cumFixed}</TableCell>
                          <TableCell>{row.backlog}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="team" className="mt-4">
              <div className="mb-4 flex items-center justify-between rounded-2xl border bg-white p-4">
                <div>
                  <h3 className="font-semibold">微调全局参数</h3>
                  <p className="text-xs text-slate-500">修改总数会自动等比缩放所有团队和周期的数据。</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label>预测 Bug 总数</Label>
                  <AdjustableInput
                    value={forecastDataset.weekly[forecastDataset.weekly.length - 1]?.cumCreated ?? 0}
                    onChange={(val) => {
                      if (forecastResult && originalDataset) {
                        setForecastResult({ ...forecastResult, dataset: adjustGrandTotal(originalDataset, val) })
                      }
                    }}
                    className="w-32"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle>测试团队预测 Created</CardTitle>
                    <CardDescription>修改单个团队总数时，将自动从同类团队扣补，保持总数不变。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>聚合团队</TableHead>
                          <TableHead>预测 Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {forecastDataset.createdTeams.map((row) => (
                          <TableRow key={row.team}>
                            <TableCell className="font-medium">{row.team}</TableCell>
                            <TableCell>
                              <AdjustableInput
                                className="w-24"
                                value={row.values.reduce((sum, value) => sum + value, 0)}
                                onChange={(val) => {
                                  if (forecastResult) {
                                    setForecastResult({
                                      ...forecastResult,
                                      dataset: adjustTeamTotal(forecastDataset, row.team, val, 'created'),
                                    })
                                  }
                                }}
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
                    <CardTitle>开发团队预测 Fixed</CardTitle>
                    <CardDescription>修改单个团队总数时，将自动从同类团队扣补，保持总数不变。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>聚合团队</TableHead>
                          <TableHead>预测 Fixed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {forecastDataset.fixedTeams.map((row) => (
                          <TableRow key={row.team}>
                            <TableCell className="font-medium">{row.team}</TableCell>
                            <TableCell>
                              <AdjustableInput
                                className="w-24"
                                value={row.values.reduce((sum, value) => sum + value, 0)}
                                onChange={(val) => {
                                  if (forecastResult) {
                                    setForecastResult({
                                      ...forecastResult,
                                      dataset: adjustTeamTotal(forecastDataset, row.team, val, 'fixed'),
                                    })
                                  }
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="excel" className="mt-4">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Excel 模板预览与极致调整</CardTitle>
                  <CardDescription>在这里可以直接修改单元格的数据，所有更改将自动汇总至团队和项目总计中。</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelTemplatePreview
                    projectName={params.newProjectName}
                    dataset={forecastDataset}
                    onCellChange={(team, weekIndex, newValue, type) => {
                      if (forecastResult) {
                        setForecastResult({
                          ...forecastResult,
                          dataset: adjustCell(forecastDataset, team, weekIndex, newValue, type),
                        })
                      }
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <Dialog open={isAddRefOpen} onOpenChange={setIsAddRefOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>手工添加参考项目</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <ProjectPicker
                label="项目名"
                value={refDraft.project}
                onChange={(value) => setRefDraft((s) => ({ ...s, project: value }))}
                options={projectPickerOptions}
                placeholder="例如 Monet NP Dish"
                searchPlaceholder="搜索项目库中的项目"
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
                    description: '日期须能解析为有效日历日，或清空周期和日期',
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
                    description: '日期须能解析为有效日历日，或清空周期和日期',
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
              <ProjectPicker
                label="项目名"
                value={refEditDraft.project}
                onChange={(value) => setRefEditDraft((s) => ({ ...s, project: value }))}
                options={projectPickerOptions}
                searchPlaceholder="搜索项目库中的项目"
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
