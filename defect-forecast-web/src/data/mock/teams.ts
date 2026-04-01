import type { TeamItem } from '@/types/team'

export const initialTeams: TeamItem[] = [
  {
    id: 't1',
    name: '系统质量二部-运营商系统测试组',
    type: 'testing',
    enabled: true,
    note: '主要承担系统测试',
  },
  {
    id: 't2',
    name: '系统质量二部-北美需求交付组',
    type: 'testing',
    enabled: true,
    note: '需求交付与验证',
  },
  {
    id: 't3',
    name: '北美测试部',
    type: 'testing',
    enabled: true,
    note: '实网及专项验证',
  },
  {
    id: 't4',
    name: '专项与协议测试部-运营商专项测试二组',
    type: 'testing',
    enabled: true,
    note: '专项测试',
  },
  {
    id: 't5',
    name: '专项与协议测试部-运营商协议测试一组',
    type: 'testing',
    enabled: true,
    note: '协议测试',
  },
  {
    id: 't6',
    name: '协议技术部',
    type: 'development',
    enabled: true,
    note: '开发修复',
  },
  {
    id: 't7',
    name: '系统技术部',
    type: 'development',
    enabled: true,
    note: '平台与系统修复',
  },
  {
    id: 't8',
    name: '运营商应用开发部',
    type: 'development',
    enabled: true,
    note: '运营商功能修复',
  },
  {
    id: 't9',
    name: '基础应用开发部',
    type: 'development',
    enabled: true,
    note: '应用侧修复',
  },
]
