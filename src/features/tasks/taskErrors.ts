import { toast } from 'sonner'
import { getErrorMessage, hasErrorCode, isApiError } from '@/api/errors'
import { TASK_STATUS_LABELS } from './taskDisplay'
import type { TaskSummary } from './types'

function isTaskSummary(value: unknown): value is TaskSummary {
  if (typeof value !== 'object' || value === null) return false
  const { key, title, status } = value as Record<string, unknown>
  return typeof key === 'string' && typeof title === 'string' && typeof status === 'string' && status in TASK_STATUS_LABELS
}

// The open blockers a 409 TASK_BLOCKED carries in details.blockers (contract); [] for anything else.
export function blockersOf(error: unknown): TaskSummary[] {
  if (!isApiError(error) || !hasErrorCode(error, 'TASK_BLOCKED')) return []
  const blockers = (error.details as { blockers?: unknown } | undefined)?.blockers
  return Array.isArray(blockers) ? blockers.filter(isTaskSummary) : []
}

// "Waiting for MKT-3 Finalise sample (In progress)."
function waitingFor(blockers: readonly TaskSummary[]): string | undefined {
  if (blockers.length === 0) return undefined
  return `Waiting for ${blockers.map((b) => `${b.key} ${b.title} (${TASK_STATUS_LABELS[b.status]})`).join(', ')}.`
}

// A failed save from a task page menu (status, type, priority). Editors with an input show most errors
// inline instead and use this only for the 404.
export function toastTaskUpdateError(error: unknown) {
  if (isApiError(error) && error.status === 404) {
    // The page refetches the task (useUpdateTask) and shows "Task not found".
    toast.error('This task has been deleted.')
    return
  }
  toast.error(getErrorMessage(error), { description: waitingFor(blockersOf(error)) })
}
