import { Plus, X } from 'lucide-react'
import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface TagInputProps {
  value: string[]
  onChange: (val: string[]) => void
  suggestions?: readonly string[]
  placeholder?: string
}

export function TagInput({ value, onChange, suggestions = [], placeholder = '输入并按回车添加...' }: TagInputProps) {
  const [inputValue, setInputValue] = React.useState('')

  const handleAdd = (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed) return
    if (!value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInputValue('')
  }

  const handleRemove = (tag: string) => {
    onChange(value.filter((t) => t !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd(inputValue)
    }
  }

  const availableSuggestions = suggestions.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase())
  )

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border p-2">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="flex items-center gap-1 rounded-xl px-3 py-1 font-normal bg-slate-100 hover:bg-slate-200">
            {tag}
            <button
              type="button"
              className="text-slate-400 hover:text-slate-700 ml-1"
              onClick={() => handleRemove(tag)}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-8 min-w-[140px] flex-1 border-0 shadow-none focus-visible:ring-0 px-2 placeholder:text-slate-400 bg-transparent"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-slate-500 hover:text-slate-900"
          onClick={() => handleAdd(inputValue)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {availableSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-500 py-1">预置推荐：</span>
          {availableSuggestions.slice(0, 15).map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full bg-slate-50 border px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => handleAdd(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
