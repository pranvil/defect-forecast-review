import type { ProjectSummary } from '@/services/projectService'

export type ProjectMetadataColumnId =
  | 'name'
  | 'displayName'
  | 'cycle'
  | 'defects'
  | 'teams'
  | 'projectCategory'
  | 'region'
  | 'os'
  | 'deviceType'
  | 'chipsetStatus'
  | 'pipeline'
  | 'operators'
  | 'userPrograms'
  | 'idhVendor'
  | 'frQuantity'
  | 'mm'
  | 'supportSim'
  | 'validWindow'

export type ProjectMetadataColumn = {
  id: ProjectMetadataColumnId
  label: string
  align?: 'left' | 'right'
}

export const PROJECT_METADATA_COLUMNS: ProjectMetadataColumn[] = [
  { id: 'name', label: '项目 Key' },
  { id: 'displayName', label: '项目名' },
  { id: 'cycle', label: '周期' },
  { id: 'defects', label: 'Defects', align: 'right' },
  { id: 'teams', label: '团队', align: 'right' },
  { id: 'projectCategory', label: '项目类别' },
  { id: 'region', label: '区域' },
  { id: 'os', label: 'OS' },
  { id: 'deviceType', label: '设备类型' },
  { id: 'chipsetStatus', label: '芯片状态' },
  { id: 'pipeline', label: '流水线' },
  { id: 'operators', label: '运营商' },
  { id: 'userPrograms', label: '用户测试' },
  { id: 'idhVendor', label: '外包商' },
  { id: 'frQuantity', label: 'FR 数量', align: 'right' },
  { id: 'mm', label: 'MM', align: 'right' },
  { id: 'supportSim', label: '支持 SIM' },
  { id: 'validWindow', label: '有效统计时间' },
]

export const DEFAULT_PROJECT_METADATA_COLUMN_IDS = PROJECT_METADATA_COLUMNS.map((column) => column.id)

function joinValues(values?: string[]) {
  return values?.filter(Boolean).join(', ') || '-'
}

export function formatProjectMetadataCell(project: ProjectSummary, id: ProjectMetadataColumnId) {
  switch (id) {
    case 'name':
      return project.name || '-'
    case 'displayName':
      return project.displayName || '-'
    case 'cycle':
      return project.cycle || '-'
    case 'defects':
      return String(project.defects ?? 0)
    case 'teams':
      return String(project.teams ?? 0)
    case 'projectCategory':
      return project.projectCategory || '-'
    case 'region':
      return project.region || '-'
    case 'os':
      return project.os || '-'
    case 'deviceType':
      return project.deviceType || '-'
    case 'chipsetStatus':
      return project.chipsetStatus || '-'
    case 'pipeline':
      return project.pipeline || '-'
    case 'operators':
      return joinValues(project.operators)
    case 'userPrograms':
      return joinValues(project.userPrograms)
    case 'idhVendor':
      return project.idhVendor || '-'
    case 'frQuantity':
      return project.frQuantity == null ? '-' : String(project.frQuantity)
    case 'mm':
      return project.mm == null ? '-' : String(project.mm)
    case 'supportSim':
      return project.supportSim || '-'
    case 'validWindow':
      return project.validStartDate || project.validEndDate
        ? `${project.validStartDate || '?'} - ${project.validEndDate || '?'}`
        : '-'
    default:
      return '-'
  }
}
