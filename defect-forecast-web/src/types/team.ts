export type TeamKind = 'testing' | 'development'

export interface TeamItem {
  id: string
  name: string
  type: TeamKind
  enabled: boolean
  note?: string
}

export function teamKindLabel(type: TeamKind): string {
  return type === 'testing' ? '测试团队' : '开发团队'
}
