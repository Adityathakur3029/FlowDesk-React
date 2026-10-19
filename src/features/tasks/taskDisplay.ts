import { Bug, ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, CircleAlert, ClipboardList, Equal, Flag, SquareCheck, type LucideIcon } from 'lucide-react'
import type { Tone } from '@/lib/tones'
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

// Same meaning as the program statuses' colours (lib/tones.ts); DEPENDENT is blocked, so red.
export const TASK_STATUS_TONES: Record<TaskStatus, Tone> = {
  DISCUSSION: 'violet',
  ON_HOLD: 'amber',
  IN_PROGRESS: 'blue',
  DONE: 'green',
  DEPENDENT: 'red',
}

export const TASK_TYPES = ['PRE', 'TASK', 'POST', 'BUG', 'ISSUE'] as const satisfies readonly TaskType[]

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  PRE: 'Pre',
  TASK: 'Task',
  POST: 'Post',
  BUG: 'Bug',
  ISSUE: 'Issue',
}

export const TASK_TYPE_TONES: Record<TaskType, Tone> = {
  PRE: 'sky',
  TASK: 'blue',
  POST: 'violet',
  BUG: 'red',
  ISSUE: 'orange',
}

export const TASK_TYPE_ICONS: Record<TaskType, LucideIcon> = {
  PRE: ClipboardList,
  TASK: SquareCheck,
  POST: Flag,
  BUG: Bug,
  ISSUE: CircleAlert,
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

// Cool to hot, as in Jira.
export const TASK_PRIORITY_TONES: Record<TaskPriority, Tone> = {
  LOWEST: 'sky',
  LOW: 'blue',
  MEDIUM: 'amber',
  HIGH: 'orange',
  HIGHEST: 'red',
}
