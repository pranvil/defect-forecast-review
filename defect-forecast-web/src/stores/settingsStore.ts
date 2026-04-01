import { create } from 'zustand'
import { initialFieldMappings } from '@/data/mock/fieldMappings'
import type { FieldMapping } from '@/types/settings'

const LOCAL_KEY = 'defectForecast.fieldMappings.v1'

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

type SettingsState = {
  fieldMappings: FieldMapping[]
  setFieldMappings: (fieldMappings: FieldMapping[]) => void
  addFieldMapping: (row: Omit<FieldMapping, 'id'>) => void
  updateFieldMapping: (row: FieldMapping) => void
  removeFieldMapping: (id: string) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  fieldMappings: loadFieldMappings() ?? initialFieldMappings,
  setFieldMappings: (fieldMappings) => {
    persistFieldMappings(fieldMappings)
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
      return { fieldMappings: next }
    }),
  updateFieldMapping: (row) =>
    set((s) => {
      const next = s.fieldMappings.map((x) => (x.id === row.id ? row : x))
      persistFieldMappings(next)
      return { fieldMappings: next }
    }),
  removeFieldMapping: (id) =>
    set((s) => {
      const next = s.fieldMappings.filter((x) => x.id !== id)
      persistFieldMappings(next)
      return { fieldMappings: next }
    }),
}))
