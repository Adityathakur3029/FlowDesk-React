import type { ComponentProps } from 'react'
import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, Equal, type LucideIcon } from 'lucide-react'
import type { Badge } from '@/components/ui/badge'
import type { CreatableTaskStatus, TaskPriority, TaskStatus, TaskType } from './types'

// Display only. Every list keeps the contract's enum order, which is also the order in the selects.

export const TASK_STATUSES = ['DISCUSSION', 'ON_HOLD', 'IN_PROGRESS', 'DONE', 'DEPENDENT'] as const satisfies readonly TaskStatus[]

// DEPENDENT is set by the server when a task has an unfinished blocker, so clients can't pick it.
export const CREATABLE_TASK_STATUSES = ['DISCUSSION', 'ON_HOLD', 'IN_PROGRESS', 'DONE'] as const satisfies readonly CreatableTaskStatus[]

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  DISCUSSION: 'Discussion',
  ON_HOLD: 'On hold',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  DEPENDENT: 'Dependent',
}

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>

export const TASK_STATUS_VARIANTS: Record<TaskStatus, BadgeVariant> = {
  DISCUSSION: 'outline',
  ON_HOLD: 'secondary',
  IN_PROGRESS: 'default',
  DONE: 'secondary',
  DEPENDENT: 'destructive',
}

export const TASK_TYPES = ['PRE', 'TASK', 'POST', 'BUG', 'ISSUE'] as const satisfies readonly TaskType[]

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  PRE: 'Pre',
  TASK: 'Task',
  POST: 'Post',
  BUG: 'Bug',
  ISSUE: 'Issue',
}

export const TASK_PRIORITIES = ['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST'] as const satisfies readonly TaskPriority[]

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOWEST: 'Lowest',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  HIGHEST: 'Highest',
}

export const TASK_PRIORITY_ICONS: Record<TaskPriority, LucideIcon> = {
  LOWEST: ChevronsDown,
  LOW: ChevronDown,
  MEDIUM: Equal,
  HIGH: ChevronUp,
  HIGHEST: ChevronsUp,
}
