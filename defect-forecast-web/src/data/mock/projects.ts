import { makeWeekly, scaleSeries } from '@/utils/series'
import type { ProjectHistory } from '@/types/project'

const baseCreated = [
  0, 2, 21, 158, 220, 206, 35, 121, 84, 55, 27, 17, 12, 7, 5, 4, 2, 1, 2, 1, 0, 0, 0, 0, 0, 0,
]
const baseFixed = [
  0, 0, 10, 78, 115, 152, 3, 187, 132, 101, 86, 53, 15, 7, 6, 6, 6, 5, 5, 3, 1, 0, 0, 0, 0, 0,
]

export const projectLibrary: Record<string, Omit<ProjectHistory, 'name'>> = {
  'Monet NP Dish': {
    cycle: '26W2-26W27',
    defects: 980,
    teams: 8,
    similarity: 91,
    projectCategory: 'NPI leading',
    region: 'US',
    os: 'Android',
    deviceType: 'Smart phone',
    chipsetStatus: 'Old_MTK',
    pipeline: '全部',
    operators: ['US_DISH'],
    userPrograms: ['IUT', 'FUT'],
    idhVendor: '麦博',
    frQuantity: 58,
    mm: 24,
    supportSim: 'Yes',
    validStartDate: '2026-01-05',
    validEndDate: '2026-07-05',
    weekly: makeWeekly(baseCreated, baseFixed),
    createdTeams: [
      { team: 'Google XTS', values: [0,0,6,5,5,4,0,3,2,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0] },
      { team: '系统质量二部-运营商系统测试组', values: [0,0,4,75,84,77,0,64,52,38,19,15,11,5,4,2,2,1,1,1,0,0,0,0,0,0] },
      { team: '系统质量二部-北美需求交付组', values: [0,0,2,5,8,6,0,4,2,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
      { team: '北美测试部', values: [0,0,3,32,42,36,0,7,6,3,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
      { team: '专项与协议测试部-运营商专项测试二组', values: [0,0,0,0,22,26,0,4,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
      { team: '专项与协议测试部-运营商协议测试一组', values: [0,2,5,41,58,56,35,37,21,10,5,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0] },
      { team: '流水线', values: [0,0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0] },
      { team: 'Hera/Usersupport/APRUUT', values: [0,0,0,0,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    ],
    fixedTeams: [
      { team: '协议技术部', values: [0,0,1,8,12,23,3,28,20,15,13,8,2,1,1,1,1,1,1,1,0,0,0,0,0,0] },
      { team: '底软技术部', values: [0,0,1,8,12,15,0,19,13,6,4,3,1,1,0,0,0,0,0,0,0,0,0,0,0,0] },
      { team: '系统技术部', values: [0,0,1,8,12,23,0,28,20,20,17,10,3,1,1,1,1,1,1,1,1,0,0,0,0,0] },
      { team: '运营商应用开发部', values: [0,0,2,16,22,23,0,28,20,20,17,11,3,1,1,1,1,1,1,1,1,0,0,0,0,0] },
      { team: '基础应用开发部', values: [0,0,3,23,34,30,0,37,26,15,13,8,2,1,1,1,1,1,1,1,0,0,0,0,0,0] },
      { team: '独立应用开发部', values: [0,0,2,15,23,15,0,19,13,10,9,5,2,1,1,1,1,1,1,1,0,0,0,0,0,0] },
      { team: '工程效能部', values: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
      { team: '终端OS部', values: [0,0,0,0,0,8,0,9,7,10,9,5,1,1,1,1,1,0,0,0,0,0,0,0,0,0] },
      { team: 'Camera', values: [0,0,0,0,0,15,0,19,13,5,4,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    ],
    milestones: [
      { label: 'FC checklist', week: 'W4' },
      { label: 'M1-1', week: 'W5' },
      { label: 'M1-2', week: 'W6' },
      { label: 'M1-3', week: 'W7' },
      { label: 'M1-4', week: 'W9' },
      { label: 'M1-5', week: 'W10' },
      { label: 'M2', week: 'W11' },
      { label: 'M3', week: 'W12' },
      { label: 'M4', week: 'W13' },
      { label: 'M5-1', week: 'W14' },
      { label: 'M5-L', week: 'W15' },
      { label: 'V1', week: 'W17' },
      { label: 'V2', week: 'W18' },
      { label: 'V3', week: 'W22' },
      { label: 'V4', week: 'W23' },
    ],
  },
  'Beryl TMO': {
    cycle: '26W4-26W29',
    defects: 1126,
    teams: 9,
    similarity: 84,
    projectCategory: 'NPI leading',
    region: 'US',
    os: 'Android',
    deviceType: 'Smart phone',
    chipsetStatus: 'New_MTK',
    pipeline: '冒烟',
    operators: ['US_TMO'],
    userPrograms: ['IUT'],
    idhVendor: '驰腾',
    frQuantity: 64,
    mm: 28,
    supportSim: 'Yes',
    validStartDate: '2026-01-19',
    validEndDate: '2026-07-19',
    weekly: makeWeekly(
      scaleSeries(baseCreated, 1.12, { 4: 25, 5: 16, 10: 8 }),
      scaleSeries(baseFixed, 1.08, { 8: 12, 9: 8 }),
    ),
  },
  'Goldfinch TMO': {
    cycle: '26W3-26W26',
    defects: 865,
    teams: 8,
    similarity: 79,
    projectCategory: 'Variant',
    region: 'US',
    os: 'Android',
    deviceType: 'Smart phone',
    chipsetStatus: 'Old_Qualcomm',
    pipeline: '无',
    operators: ['US_TMO'],
    userPrograms: ['内测'],
    idhVendor: '传佳音',
    frQuantity: 46,
    mm: 20,
    supportSim: 'Yes',
    validStartDate: '2026-01-12',
    validEndDate: '2026-06-28',
    weekly: makeWeekly(
      scaleSeries(baseCreated, 0.9, { 4: -20, 5: -18 }),
      scaleSeries(baseFixed, 0.92, { 7: 6 }),
    ),
  },
  'Atlas VZW': {
    cycle: '26W6-26W30',
    defects: 1038,
    teams: 8,
    similarity: 68,
    projectCategory: 'NPI leading',
    region: 'US',
    os: 'Android',
    deviceType: 'Smart phone',
    chipsetStatus: 'New_Qualcomm',
    pipeline: '全部',
    operators: ['US_VZW'],
    userPrograms: ['IUT', '体验'],
    idhVendor: '英卡',
    frQuantity: 62,
    mm: 26,
    supportSim: 'Yes',
    validStartDate: '2026-02-02',
    validEndDate: '2026-07-26',
    weekly: makeWeekly(
      scaleSeries(baseCreated, 1.03, { 6: 28, 7: -10, 12: 6 }),
      scaleSeries(baseFixed, 1.01, { 9: 6, 10: 5 }),
    ),
  },
}

export const projectNames = Object.keys(projectLibrary)

export function getProjectHistory(projectName: string): ProjectHistory {
  const row = projectLibrary[projectName]
  if (!row) {
    throw new Error(`Unknown project: ${projectName}`)
  }
  return { name: projectName, ...row }
}
