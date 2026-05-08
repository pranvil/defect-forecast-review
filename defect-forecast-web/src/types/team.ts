export type TeamKind = 'testing' | 'development'

export interface TeamItem {
  id: string
  name: string
  type: TeamKind
  enabled: boolean
  note?: string
  /** 预测拆分占比（%）；填写后优先于历史项目占比。 */
  forecastRatio?: number | null
}

export function teamKindLabel(type: TeamKind): string {
  return type === 'testing' ? '测试团队' : '开发团队'
}
