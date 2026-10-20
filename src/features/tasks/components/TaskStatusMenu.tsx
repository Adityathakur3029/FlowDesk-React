import { ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ToneBadge, ToneDot } from '@/components/data/ToneBadge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUpdateTask } from '../api'
import { SETTABLE_TASK_STATUSES, TASK_STATUS_LABELS, TASK_STATUS_TONES } from '../taskDisplay'
import { toastTaskUpdateError } from '../taskErrors'
import type { SettableTaskStatus, TaskDetail } from '../types'

interface TaskStatusMenuProps {
  task: TaskDetail
  // As in the URL (key or id): the task's cache entry.
  taskRef: string
}

// Jira-style: the status badge opens a menu, and picking a status saves it right away (PATCH { status }).
// Every role may change it (contract). DEPENDENT is never offered: the server sets it while a blocker is
// open, and answers 409 TASK_BLOCKED to any change until then.
export function TaskStatusMenu({ task, taskRef }: TaskStatusMenuProps) {
  const update = useUpdateTask(task.programId, taskRef)
  // Shows the picked status while it saves; a failed save falls back to the stored one.
  const status = update.isPending ? (update.variables.status ?? task.status) : task.status
  const label = TASK_STATUS_LABELS[status]

  function change(value: string) {
    const next = value as SettableTaskStatus
    if (next === task.status) return
    update.mutate(
      { status: next },
      {
        onSuccess: (saved) => {
          // Reopening a DONE task that has open blockers saves it as DEPENDENT and remembers the pick (contract).
          if (saved.status === 'DEPENDENT') {
            toast.success('Status changed to Dependent', {
              description: `It has unfinished blockers. It moves to ${TASK_STATUS_LABELS[next]} once they're done.`,
            })
          } else {
            toast.success(`Status changed to ${TASK_STATUS_LABELS[saved.status]}`)
          }
        },
        onError: toastTaskUpdateError,
      },
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={update.isPending}
          aria-label={`Status: ${label}. Change status`}
          className="rounded-4xl outline-none hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-progress"
        >
          <ToneBadge tone={TASK_STATUS_TONES[status]}>
            {label}
            {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </ToneBadge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Change status</DropdownMenuLabel>
        {task.status === 'DEPENDENT' && (
          <p className="px-2 pb-1.5 text-xs text-muted-foreground">
            Waiting for its blockers. The status comes back by itself once they're done.
          </p>
        )}
        <DropdownMenuRadioGroup value={status} onValueChange={change}>
          {SETTABLE_TASK_STATUSES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              <ToneDot tone={TASK_STATUS_TONES[option]} className="size-2" />
              {TASK_STATUS_LABELS[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
