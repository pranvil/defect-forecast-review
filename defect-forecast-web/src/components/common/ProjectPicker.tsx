import * as React from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { formatProjectLabel } from '@/utils/projectLibrary'

export type ProjectPickerOption = {
  key: string
  displayName?: string
}

type ProjectPickerProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: ProjectPickerOption[]
  placeholder?: string
  emptyOptionLabel?: string
  allowEmpty?: boolean
  searchPlaceholder?: string
  className?: string
}

export function ProjectPicker({
  label,
  value,
  onChange,
  options,
  placeholder = '请选择项目',
  emptyOptionLabel = '不选择',
  allowEmpty = false,
  searchPlaceholder = '搜索项目名或 Key',
  className,
}: ProjectPickerProps) {
  const [query, setQuery] = React.useState('')

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => {
      const text = `${option.key} ${option.displayName ?? ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [options, query])

  const currentLabel = React.useMemo(() => {
    const hit = options.find((option) => option.key === value)
    return hit ? formatProjectLabel(hit.key, hit.displayName) : placeholder
  }, [options, placeholder, value])

  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-2 space-y-2">
        <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <Select
          value={value || (allowEmpty ? '__none__' : '')}
          onValueChange={(next) => onChange(next === '__none__' || next == null ? '' : next)}
        >
          <SelectTrigger className="rounded-2xl">
            <span data-slot="select-value" className="flex flex-1 truncate text-left">
              {currentLabel}
            </span>
          </SelectTrigger>
          <SelectContent>
            {allowEmpty ? <SelectItem value="__none__">{emptyOptionLabel}</SelectItem> : null}
            {filtered.length ? (
              filtered.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {formatProjectLabel(option.key, option.displayName)}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="__empty__" disabled>
                没有匹配的项目
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
