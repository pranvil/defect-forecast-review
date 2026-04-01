import type { FieldMapping } from '@/types/settings'

export const initialFieldMappings: FieldMapping[] = [
  {
    id: 'fm-1',
    businessName: '团队字段',
    jiraFieldPath: 'customfield_12345',
    purpose: '按团队统计 Created / Fixed；供团队配置和预测拆分使用',
    exampleValue: '系统质量二部-运营商系统测试组',
    enabled: true,
  },
  {
    id: 'fm-2',
    businessName: '创建时间',
    jiraFieldPath: 'created',
    purpose: '按业务周统计每周创建量',
    exampleValue: '2026-01-12',
    enabled: true,
  },
  {
    id: 'fm-3',
    businessName: '解决时间',
    jiraFieldPath: 'resolved',
    purpose: '按业务周统计每周解决量',
    exampleValue: '2026-03-09',
    enabled: true,
  },
  {
    id: 'fm-4',
    businessName: 'Issue Type',
    jiraFieldPath: 'issuetype.name',
    purpose: '过滤 defect / bug / defect_new 等类型',
    exampleValue: 'Defect',
    enabled: true,
  },
  {
    id: 'fm-5',
    businessName: '项目字段',
    jiraFieldPath: 'project.key',
    purpose: '拉取指定项目，生成历史项目汇总',
    exampleValue: 'MONETNPDISH',
    enabled: true,
  },
]
