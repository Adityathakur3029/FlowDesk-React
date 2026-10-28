import type { ReactNode } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUpdateTask } from '../api'
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_TYPES, TASK_TYPE_LABELS } from '../taskDisplay'
import { toastTaskUpdateError } from '../taskErrors'
import type { TaskDetail, TaskPriority, TaskType, UpdateTaskRequest } from '../types'
import { TaskPriorityLabel } from './TaskPriorityLabel'
import { TaskTypeLabel } from './TaskTypeLabel'

export type TaskOptionField = 'type' | 'priority'

interface OptionConfig {
  label: string
  options: readonly string[]
  labels: Record<string, string>
  render: (value: string) => ReactNode
  toBody: (value: string) => UpdateTaskRequest
}

const FIELDS: Record<TaskOptionField, OptionConfig> = {
  // The type is informational and can change at any time, even on DONE and DEPENDENT tasks (contract).
  type: {
    label: 'Type',
    options: TASK_TYPES,
    labels: TASK_TYPE_LABELS,
    render: (value) => <TaskTypeLabel type={value as TaskType} />,
    toBody: (value) => ({ type: value as TaskType }),
  },
  priority: {
    label: 'Priority',
    options: TASK_PRIORITIES,
    labels: TASK_PRIORITY_LABELS,
    render: (value) => <TaskPriorityLabel priority={value as TaskPriority} />,
    toBody: (value) => ({ priority: value as TaskPriority }),
  },
}

interface TaskOptionMenuProps {
  task: TaskDetail
  // As in the URL (key or id): the task's cache entry.
  taskRef: string
  field: TaskOptionField
}

// The type or priority in Details as a menu: picking one saves it right away, like the status.
export function TaskOptionMenu({ task, taskRef, field }: TaskOptionMenuProps) {
  const config = FIELDS[field]
  const update = useUpdateTask(taskRef)
  // Shows the picked value while it saves; a failed save falls back to the stored one.
  const value = (update.isPending ? update.variables[field] : undefined) ?? task[field]

  function change(next: string) {
    if (next === task[field]) return
    update.mutate(config.toBody(next), {
      onSuccess: (saved) => toast.success(`${config.label} changed to ${config.labels[saved[field]]}`),
      onError: toastTaskUpdateError,
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={update.isPending}
          aria-label={`${config.label}: ${config.labels[value]}. Change ${config.label.toLowerCase()}`}
          className="-mx-1.5 -my-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-progress"
        >
          {config.render(value)}
          {update.isPending ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuLabel>Change {config.label.toLowerCase()}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={change}>
          {config.options.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {config.render(option)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
