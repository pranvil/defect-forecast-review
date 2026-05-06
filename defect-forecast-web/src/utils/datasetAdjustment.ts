import type { ForecastDataset } from '@/services/forecastService'

export function cloneDataset(dataset: ForecastDataset): ForecastDataset {
  return JSON.parse(JSON.stringify(dataset))
}

function distributeToWeeks(originalValues: number[], newTotal: number): number[] {
  const oldTotal = originalValues.reduce((a, b) => a + b, 0)
  if (oldTotal === 0) {
    // If old total is 0, we can't scale. Just put everything in the middle week.
    const mid = Math.floor(originalValues.length / 2)
    const newValues = new Array(originalValues.length).fill(0)
    newValues[mid] = newTotal
    return newValues
  }
  
  const ratio = newTotal / oldTotal
  const newValues = originalValues.map(v => Math.round(v * ratio))
  const newSum = newValues.reduce((a, b) => a + b, 0)
  const diff = newTotal - newSum
  
  if (diff !== 0) {
    // Add/subtract diff to the week with the highest value to minimize impact
    let maxIdx = 0
    let maxVal = -1
    for (let i = 0; i < newValues.length; i++) {
      if (newValues[i] > maxVal) {
        maxVal = newValues[i]
        maxIdx = i
      }
    }
    newValues[maxIdx] += diff
    if (newValues[maxIdx] < 0) {
        newValues[maxIdx] -= diff
        for(let i=0; i<newValues.length; i++) {
           if (newValues[i] + diff >= 0) {
              newValues[i] += diff
              break
           }
        }
    }
  }
  return newValues
}

export function adjustGrandTotal(dataset: ForecastDataset, newTotal: number): ForecastDataset {
  const d = cloneDataset(dataset)
  const oldTotal = d.weekly[d.weekly.length - 1]?.cumCreated ?? 0
  if (oldTotal === 0 || newTotal < 0) return d
  
  const ratio = newTotal / oldTotal
  
  for (const team of d.createdTeams) {
    const teamOldTotal = team.values.reduce((a, b) => a + b, 0)
    const teamNewTotal = Math.round(teamOldTotal * ratio)
    team.values = distributeToWeeks(team.values, teamNewTotal)
  }
  
  for (const team of d.fixedTeams) {
    const teamOldTotal = team.values.reduce((a, b) => a + b, 0)
    const teamNewTotal = Math.round(teamOldTotal * ratio)
    team.values = distributeToWeeks(team.values, teamNewTotal)
  }
  
  return recomputeWeekly(d)
}

export function adjustTeamTotal(dataset: ForecastDataset, teamName: string, newTotal: number, type: 'created' | 'fixed'): ForecastDataset {
  const d = cloneDataset(dataset)
  const teams = type === 'created' ? d.createdTeams : d.fixedTeams
  
  const targetTeam = teams.find(t => t.team === teamName)
  if (!targetTeam || newTotal < 0) return d
  
  const oldTeamTotal = targetTeam.values.reduce((a, b) => a + b, 0)
  const diff = newTotal - oldTeamTotal
  if (diff === 0) return d
  
  // Lock total scheme: steal from other teams
  const otherTeams = teams.filter(t => t.team !== teamName)
  const otherTeamsSum = otherTeams.reduce((sum, t) => sum + t.values.reduce((a, b) => a + b, 0), 0)
  
  if (otherTeamsSum > 0) {
    const newOtherTeamsSum = Math.max(0, otherTeamsSum - diff)
    const otherRatio = newOtherTeamsSum / otherTeamsSum
    
    for (const ot of otherTeams) {
      const otOldTotal = ot.values.reduce((a, b) => a + b, 0)
      const otNewTotal = Math.round(otOldTotal * otherRatio)
      ot.values = distributeToWeeks(ot.values, otNewTotal)
    }
  }
  
  targetTeam.values = distributeToWeeks(targetTeam.values, newTotal)
  
  return recomputeWeekly(d)
}

export function adjustCell(dataset: ForecastDataset, teamName: string, weekIndex: number, newValue: number, type: 'created' | 'fixed'): ForecastDataset {
  const d = cloneDataset(dataset)
  const teams = type === 'created' ? d.createdTeams : d.fixedTeams
  const targetTeam = teams.find(t => t.team === teamName)
  if (targetTeam && targetTeam.values[weekIndex] !== undefined) {
    targetTeam.values[weekIndex] = Math.max(0, newValue)
  }
  return recomputeWeekly(d)
}

export function recomputeWeekly(dataset: ForecastDataset): ForecastDataset {
  const numWeeks = dataset.weekly.length
  
  let cumCreated = 0
  let cumFixed = 0
  
  for (let i = 0; i < numWeeks; i++) {
    const created = dataset.createdTeams.reduce((sum, t) => sum + (t.values[i] ?? 0), 0)
    const fixed = dataset.fixedTeams.reduce((sum, t) => sum + (t.values[i] ?? 0), 0)
    
    cumCreated += created
    cumFixed += fixed
    
    dataset.weekly[i].created = created
    dataset.weekly[i].fixed = fixed
    dataset.weekly[i].cumCreated = cumCreated
    dataset.weekly[i].cumFixed = cumFixed
    dataset.weekly[i].backlog = cumCreated - cumFixed
  }
  return dataset
}
