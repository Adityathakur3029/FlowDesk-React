import { cn } from '@/lib/utils'
import { TONE_SOLID_CLASSES } from '@/lib/tones'
import { TASK_TYPE_ICONS, TASK_TYPE_LABELS, TASK_TYPE_TONES } from '../taskDisplay'
import type { TaskType } from '../types'

// Jira-style: a coloured icon square plus the label, so the icon is never the only signal.
export function TaskTypeLabel({ type }: { type: TaskType }) {
  const Icon = TASK_TYPE_ICONS[type]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded', TONE_SOLID_CLASSES[TASK_TYPE_TONES[type]])}>
        {/* Important: a focused SelectItem recolours every descendant, which would darken the icon on its fill. */}
        <Icon className="size-3.5 text-white!" />
      </span>
      {TASK_TYPE_LABELS[type]}
    </span>
  )
}
