import { cn } from '@/lib/utils'
import { TASK_PRIORITY_ICONS, TASK_PRIORITY_LABELS } from '../taskDisplay'
import type { TaskPriority } from '../types'

// Icon plus label, so the icon is never the only signal.
export function TaskPriorityLabel({ priority }: { priority: TaskPriority }) {
  const Icon = TASK_PRIORITY_ICONS[priority]
  const urgent = priority === 'HIGH' || priority === 'HIGHEST'
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className={cn('size-4', urgent ? 'text-destructive' : 'text-muted-foreground')} aria-hidden="true" />
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  )
}
