import {
  BarChart3,
  LayoutPanelLeft,
  FolderKanban,
  Settings,
  Wand2,
} from 'lucide-react'
import type { AppSection } from '@/stores/projectStore'

const items: { key: AppSection; label: string; Icon: typeof Settings }[] = [
  { key: 'projectHub', label: '项目库', Icon: FolderKanban },
  { key: 'forecastInput', label: '新项目预测', Icon: Wand2 },
  { key: 'forecastResult', label: '预测结果', Icon: BarChart3 },
  { key: 'config', label: '系统配置', Icon: Settings },
]

type SidebarProps = {
  current: AppSection
  onNavigate: (key: AppSection) => void
}

export function Sidebar({ current, onNavigate }: SidebarProps) {
  return (
    <div className="w-64 shrink-0 border-r bg-white/70 backdrop-blur">
      <div className="border-b p-5">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <LayoutPanelLeft className="h-5 w-5" />
          Defect Forecast
        </div>
        <div className="mt-1 text-xs text-slate-500">React 桌面风格 UI Demo</div>
      </div>
      <div className="space-y-1 p-3">
        {items.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
              current === key
                ? 'bg-slate-900 text-white shadow'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
