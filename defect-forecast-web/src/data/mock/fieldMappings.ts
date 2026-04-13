import type { FieldMapping } from '@/types/settings'

export const initialFieldMappings: FieldMapping[] = [
  {
    id: 'fm-1',
    businessName: 'Reporter Team-New',
    jiraFieldPath: 'customfield_15319',
    purpose: '创建团队字段：用于按团队聚合 Created（reporter team）',
    exampleValue: '系统质量二部-运营商系统测试组',
    enabled: true,
  },
  {
    id: 'fm-2',
    businessName: 'Assignee Team',
    jiraFieldPath: 'customfield_15320',
    purpose: '解决团队字段：用于按团队聚合 Fixed（assignee team）',
    exampleValue: '运营应用开发组',
    enabled: true,
  },
  {
    id: 'fm-3',
    businessName: 'last time to set verified_sw',
    jiraFieldPath: 'customfield_13228',
    purpose: '解决时间字段：优先用该字段作为“解决/验证时间”口径（用于 fixed 归档到周）',
    exampleValue: '2026-03-09T13:40:21.000+0800',
    enabled: true,
  },
  {
    id: 'fm-4',
    businessName: '1st time to set closed',
    jiraFieldPath: 'customfield_13221',
    purpose: '解决时间候选字段：当 verified_sw 为空时作为候选（按你们实例实际字段 ID 调整）',
    exampleValue: '2026-03-09T13:40:21.000+0800',
    enabled: true,
  },
  {
    id: 'fm-5',
    businessName: '1st time to set deleted',
    jiraFieldPath: 'customfield_13222',
    purpose: '解决时间候选字段：当 verified_sw/closed 为空时作为候选（按你们实例实际字段 ID 调整）',
    exampleValue: '2026-03-09T13:40:21.000+0800',
    enabled: true,
  },
  {
    id: 'fm-6',
    businessName: '1st time to set postponed',
    jiraFieldPath: 'customfield_13225',
    purpose: '解决时间候选字段：当 verified_sw/closed/deleted 为空时作为候选（按你们实例实际字段 ID 调整）',
    exampleValue: '2026-03-09T13:40:21.000+0800',
    enabled: true,
  },
]
