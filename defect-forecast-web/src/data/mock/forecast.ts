import { initialMilestones } from '@/data/mock/milestones'
import { makeWeekly } from '@/utils/series'
import type { ForecastTeamRow } from '@/types/forecast'
import type { MilestoneLabel, WeeklyPoint } from '@/types/project'

export const forecastWeeklyBase: WeeklyPoint[] = makeWeekly(
  [0,4,18,71,105,122,96,87,73,62,50,40,34,26,20,15,11,8,6,4,3,2,2,1,1,0],
  [0,0,5,28,54,70,83,95,91,80,73,61,52,46,38,31,25,19,14,10,7,4,3,2,2,1],
)

export const forecastCreatedTeams: ForecastTeamRow[] = [
  { team: '系统质量二部-运营商系统测试组', group: '测试团队', values: [0,2,10,31,43,49,40,34,28,20,17,11,9,6,5,4,3,2,2,1,1,0,0,0,0,0] },
  { team: '北美测试部', group: '测试团队', values: [0,1,5,19,28,31,24,20,17,13,10,8,6,5,4,3,2,2,1,1,0,0,0,0,0,0] },
  { team: '专项与协议测试部-运营商协议测试一组', group: '测试团队', values: [0,1,3,15,22,24,18,17,14,12,8,7,5,4,3,2,2,1,1,1,0,0,0,0,0,0] },
]

export const forecastFixedTeams: ForecastTeamRow[] = [
  { team: '协议技术部', group: '开发团队', values: [0,0,1,5,8,10,13,14,13,12,11,9,8,7,6,5,4,3,2,2,1,1,1,1,1,0] },
  { team: '系统技术部', group: '开发团队', values: [0,0,1,6,12,16,17,19,18,15,13,11,10,9,7,6,5,4,3,2,2,1,1,0,0,0] },
  { team: '运营商应用开发部', group: '开发团队', values: [0,0,1,8,14,18,21,24,22,19,18,15,12,10,8,6,5,4,3,2,1,1,1,1,1,1] },
]

export const forecastResultMilestones: MilestoneLabel[] = initialMilestones
  .filter((m) => m.week.trim())
  .map((m) => ({
    label: m.name,
    week: m.week.replace('26', ''),
  }))
