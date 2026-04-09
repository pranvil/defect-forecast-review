import { initialFieldMappings } from '@/data/mock/fieldMappings'
import { initialMilestones } from '@/data/mock/milestones'
import { compareColors } from '@/data/mock/compareColors'
import { initialRefProjects } from '@/data/mock/refProjects'
import type { ConfigService, ForecastDefaultsPayload } from '@/services/configService'
import { delay } from '@/services/delay'
import type { FieldMapping } from '@/types/settings'

const FIELD_KEY = 'defectForecast.fieldMappings.v1'
const FORECAST_KEY = 'defectForecast.forecastDefaults.v1'

function readFieldMappings(): FieldMapping[] {
  try {
    const raw = localStorage.getItem(FIELD_KEY)
    if (!raw) return initialFieldMappings
    const parsed = JSON.parse(raw) as { mappings?: unknown } | unknown
    if (!parsed || typeof parsed !== 'object') return initialFieldMappings
    const mappings = (parsed as { mappings?: unknown }).mappings
    return Array.isArray(mappings) ? (mappings as FieldMapping[]) : initialFieldMappings
  } catch {
    return initialFieldMappings
  }
}

function writeFieldMappings(rows: FieldMapping[]) {
  try {
    localStorage.setItem(
      FIELD_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        count: rows.length,
        mappings: rows,
      }),
    )
  } catch {
    // ignore
  }
}

function readForecastDefaults(): ForecastDefaultsPayload {
  try {
    const raw = localStorage.getItem(FORECAST_KEY)
    if (!raw) {
      return {
        refProjects: initialRefProjects,
        milestones: initialMilestones,
        params: {
          newProjectName: 'Aurora NP TMO',
          startWeek: '26W2',
          endWeek: '26W27',
        },
      }
    }
    const parsed = JSON.parse(raw) as ForecastDefaultsPayload
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid')
    return parsed
  } catch {
    return {
      refProjects: initialRefProjects,
      milestones: initialMilestones,
      params: {
        newProjectName: 'Aurora NP TMO',
        startWeek: '26W2',
        endWeek: '26W27',
      },
    }
  }
}

function writeForecastDefaults(payload: ForecastDefaultsPayload) {
  try {
    localStorage.setItem(FORECAST_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

export const configServiceMock: ConfigService = {
  async listFieldMappings(): Promise<FieldMapping[]> {
    await delay(60)
    return readFieldMappings()
  },
  async saveFieldMappings(rows: FieldMapping[]): Promise<FieldMapping[]> {
    await delay(60)
    writeFieldMappings(rows)
    return rows
  },
  async getForecastDefaults(): Promise<ForecastDefaultsPayload> {
    await delay(80)
    return readForecastDefaults()
  },
  async saveForecastDefaults(payload: ForecastDefaultsPayload): Promise<ForecastDefaultsPayload> {
    await delay(80)
    writeForecastDefaults(payload)
    return payload
  },
  async getCompareColors(): Promise<string[]> {
    await delay(20)
    return compareColors
  },
}
