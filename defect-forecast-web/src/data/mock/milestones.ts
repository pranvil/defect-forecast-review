import type { MilestoneParam } from '@/types/forecast'
import { firstDayDateOfWeek } from '@/utils/week'

export const initialMilestones: MilestoneParam[] = [
  { name: 'FC checklist', week: '26W4', date: firstDayDateOfWeek('26W4') },
  { name: 'M1-1', week: '26W5', date: firstDayDateOfWeek('26W5') },
  { name: 'M1-2', week: '26W6', date: firstDayDateOfWeek('26W6') },
  { name: 'M1-3', week: '26W7', date: firstDayDateOfWeek('26W7') },
  { name: 'V1', week: '26W17', date: firstDayDateOfWeek('26W17') },
  { name: 'V4', week: '26W23', date: firstDayDateOfWeek('26W23') },
]
