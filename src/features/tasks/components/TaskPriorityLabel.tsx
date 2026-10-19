import { cn } from '@/lib/utils'
import { TONE_TEXT_CLASSES } from '@/lib/tones'
import { TASK_PRIORITY_ICONS, TASK_PRIORITY_LABELS, TASK_PRIORITY_TONES } from '../taskDisplay'
import type { TaskPriority } from '../types'

// Icon plus label, so the icon is never the only signal.
export function TaskPriorityLabel({ priority }: { priority: TaskPriority }) {
  const Icon = TASK_PRIORITY_ICONS[priority]
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className={cn('size-4', TONE_TEXT_CLASSES[TASK_PRIORITY_TONES[priority]])} aria-hidden="true" />
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  )
}
