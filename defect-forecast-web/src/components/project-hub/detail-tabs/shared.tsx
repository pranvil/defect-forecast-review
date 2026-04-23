type WeekDateTickProps = {
  value?: string
  payload?: {
    value?: string
  }
  x?: number | string
  y?: number | string
  dateText?: string
}

type TeamAxisTickProps = {
  value?: string
  payload?: {
    value?: string
  }
  x?: number | string
  y?: number | string
}

function wrapTeamName(text: string, maxCharsPerLine: number) {
  const segments = text.split(/([\s/_-]+)/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  if (segments.length <= 1) {
    for (let i = 0; i < text.length; i += maxCharsPerLine) {
      lines.push(text.slice(i, i + maxCharsPerLine))
    }
    return lines
  }

  segments.forEach((segment) => {
    const trimmed = segment.trimStart()
    if (!trimmed) return
    if (!current.length || current.length + trimmed.length <= maxCharsPerLine) {
      current += trimmed
      return
    }
    lines.push(current)
    current = trimmed
  })

  if (current.length) lines.push(current)

  return lines.flatMap((line) => {
    if (line.length <= maxCharsPerLine) return [line]
    const chunks: string[] = []
    for (let i = 0; i < line.length; i += maxCharsPerLine) {
      chunks.push(line.slice(i, i + maxCharsPerLine))
    }
    return chunks
  })
}

export function WeekDateTick({ x = 0, y = 0, value, payload, dateText = '' }: WeekDateTickProps) {
  const xNum = typeof x === 'number' ? x : Number(x) || 0
  const yNum = typeof y === 'number' ? y : Number(y) || 0
  const week = value ?? payload?.value ?? ''
  const date = dateText
  return (
    <g transform={`translate(${xNum},${yNum})`}>
      <text x={0} y={0} dy={13} textAnchor="middle" className="fill-slate-600 text-[11px]">
        <tspan x={0}>{week}</tspan>
        {date ? <tspan x={0} dy={13}>{date}</tspan> : null}
      </text>
    </g>
  )
}

export function TeamAxisTick({ x = 0, y = 0, value, payload }: TeamAxisTickProps) {
  const xNum = typeof x === 'number' ? x : Number(x) || 0
  const yNum = typeof y === 'number' ? y : Number(y) || 0
  const teamName = value ?? payload?.value ?? ''
  const lines = wrapTeamName(teamName, 20)
  const lineHeight = 13
  const startDy = -((lines.length - 1) * lineHeight) / 2

  return (
    <g transform={`translate(${xNum},${yNum})`}>
      <text x={0} y={0} textAnchor="end" className="fill-slate-600 text-xs">
        {lines.map((line, idx) => (
          <tspan key={`${line}-${idx}`} x={0} dy={idx === 0 ? startDy : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  )
}
