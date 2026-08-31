import clsx from 'clsx'
import { Plus } from 'lucide-react'
import type { ClassData } from '../types'

interface ClassTabsProps {
  classes: ClassData[]
  activeClassId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
}

export function ClassTabs({ classes, activeClassId, onSelect, onCreate }: ClassTabsProps) {
  return (
    <div className="flex h-full items-center gap-1.5 overflow-x-auto">
      {classes.map((cls) => (
        <button
          key={cls.id}
          type="button"
          onClick={() => onSelect(cls.id)}
          className={clsx(
            'shrink-0 rounded-lg border-2 px-3 py-1.5 font-bold transition-all active:scale-95',
            cls.id === activeClassId
              ? 'border-indigo-600 bg-indigo-600 text-white shadow'
              : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100',
          )}
          style={{ fontSize: 'clamp(0.75rem, 1.6vmin, 1.05rem)' }}
        >
          {cls.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onCreate}
        title="Create new class"
        className="flex shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 p-2 text-neutral-500 hover:bg-neutral-100 active:scale-95"
      >
        <Plus size={18} />
      </button>
    </div>
  )
}
