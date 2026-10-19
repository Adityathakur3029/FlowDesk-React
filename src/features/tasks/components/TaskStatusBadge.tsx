import { Badge } from '@/components/ui/badge'
import { TASK_STATUS_LABELS, TASK_STATUS_VARIANTS } from '../taskDisplay'
import type { TaskStatus } from '../types'

// The label is always shown, so colour is never the only signal.
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={TASK_STATUS_VARIANTS[status]}>{TASK_STATUS_LABELS[status]}</Badge>
}
