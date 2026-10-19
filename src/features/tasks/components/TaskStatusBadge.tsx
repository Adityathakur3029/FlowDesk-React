import { ToneBadge } from '@/components/data/ToneBadge'
import { TASK_STATUS_LABELS, TASK_STATUS_TONES } from '../taskDisplay'
import type { TaskStatus } from '../types'

// The label is always shown, so colour is never the only signal.
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <ToneBadge tone={TASK_STATUS_TONES[status]}>{TASK_STATUS_LABELS[status]}</ToneBadge>
}
