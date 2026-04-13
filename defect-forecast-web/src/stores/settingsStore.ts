import { create } from 'zustand'
import { initialFieldMappings } from '@/data/mock/fieldMappings'
import { services } from '@/services'
import type { FieldMapping, JiraConnectionConfig } from '@/types/settings'

const LOCAL_KEY = 'defectForecast.fieldMappings.v1'
const JIRA_CONN_KEY = 'defectForecast.jiraConnection.v1'

function persistFieldMappings(fieldMappings: FieldMapping[]) {
  try {
    const payload = {
      savedAt: new Date().toISOString(),
      count: fieldMappings.length,
      mappings: fieldMappings,
    }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

function loadFieldMappings(): FieldMapping[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const obj = parsed as { mappings?: unknown }
    if (!Array.isArray(obj.mappings)) return null
    const rows = obj.mappings
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
        id: typeof x.id === 'string' ? x.id : `fm-load-${crypto.randomUUID()}`,
        businessName: x.businessName!,
        jiraFieldPath: x.jiraFieldPath!,
        purpose: x.purpose!,
        exampleValue: x.exampleValue!,
        enabled: x.enabled!,
      }))
    return rows.length ? rows : null
  } catch {
    return null
  }
}

function persistJiraConnection(jiraConnection: JiraConnectionConfig) {
  try {
    localStorage.setItem(JIRA_CONN_KEY, JSON.stringify(jiraConnection))
  } catch {
    // ignore
  }
}

function loadJiraConnection(): JiraConnectionConfig | null {
  try {
    const raw = localStorage.getItem(JIRA_CONN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<JiraConnectionConfig>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.baseUrl !== 'string') return null
    if (parsed.authType !== 'pat' && parsed.authType !== 'basic') return null
    return {
      baseUrl: parsed.baseUrl,
      authType: parsed.authType,
      username: typeof parsed.username === 'string' ? parsed.username : '',
      token: typeof parsed.token === 'string' ? parsed.token : '',
      verifySsl: parsed.verifySsl !== false,
      timeoutSec:
        typeof parsed.timeoutSec === 'number' && Number.isFinite(parsed.timeoutSec)
          ? Math.max(3, Math.min(60, Math.round(parsed.timeoutSec)))
          : 10,
    }
  } catch {
    return null
  }
}

type SettingsState = {
  fieldMappings: FieldMapping[]
  hydrateFieldMappingsFromServer: () => Promise<void>
  setFieldMappings: (fieldMappings: FieldMapping[]) => void
  addFieldMapping: (row: Omit<FieldMapping, 'id'>) => void
  updateFieldMapping: (row: FieldMapping) => void
  removeFieldMapping: (id: string) => void
  jiraConnection: JiraConnectionConfig
  setJiraConnection: (next: Partial<JiraConnectionConfig>) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  fieldMappings: loadFieldMappings() ?? initialFieldMappings,
  hydrateFieldMappingsFromServer: async () => {
    const rows = await services.configService.listFieldMappings()
    // 后端抓数逻辑对标准字段（created/issuetype/project 等）是写死读取的；
    // 默认映射里保留这些行会让用户误以为“必须配置”，因此在前端侧剔除。
    const filtered = rows.filter(
      (x) =>
        !['created', 'resolved', 'resolutiondate', 'issuetype.name', 'project.key'].includes(
          x.jiraFieldPath.trim(),
        ),
    )
    persistFieldMappings(filtered)
    set({ fieldMappings: filtered })
  },
  setFieldMappings: (fieldMappings) => {
    persistFieldMappings(fieldMappings)
    void services.configService.saveFieldMappings(fieldMappings).catch(() => {
      // keep local cache when backend save fails
    })
    set({ fieldMappings })
  },
  addFieldMapping: (row) =>
    set((s) => {
      const next = [
        ...s.fieldMappings,
        {
          id: `fm-${crypto.randomUUID()}`,
          ...row,
        },
      ]
      persistFieldMappings(next)
      void services.configService.saveFieldMappings(next).catch(() => {
        // keep local cache when backend save fails
      })
      return { fieldMappings: next }
    }),
  updateFieldMapping: (row) =>
    set((s) => {
      const next = s.fieldMappings.map((x) => (x.id === row.id ? row : x))
      persistFieldMappings(next)
      void services.configService.saveFieldMappings(next).catch(() => {
        // keep local cache when backend save fails
      })
      return { fieldMappings: next }
    }),
  removeFieldMapping: (id) =>
    set((s) => {
      const next = s.fieldMappings.filter((x) => x.id !== id)
      persistFieldMappings(next)
      void services.configService.saveFieldMappings(next).catch(() => {
        // keep local cache when backend save fails
      })
      return { fieldMappings: next }
    }),
  jiraConnection: loadJiraConnection() ?? {
    baseUrl: 'https://jira.tcl.com',
    authType: 'pat',
    username: '',
    token: '',
    verifySsl: true,
    timeoutSec: 10,
  },
  setJiraConnection: (next) =>
    set((s) => {
      const merged = { ...s.jiraConnection, ...next }
      persistJiraConnection(merged)
      return { jiraConnection: merged }
    }),
}))
