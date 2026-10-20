import type { components, paths } from '@/api/schema'

export type Task = components['schemas']['Task']
export type TaskDetail = components['schemas']['TaskDetail']
export type TaskSummary = components['schemas']['TaskSummary']
export type TaskStatus = components['schemas']['TaskStatus']
export type TaskType = components['schemas']['TaskType']
export type TaskPriority = components['schemas']['TaskPriority']
export type TaskList = components['schemas']['TaskListResponse']
export type TaskListParams = NonNullable<paths['/programs/{programId}/tasks']['get']['parameters']['query']>
export type CreateTaskRequest = components['schemas']['CreateTaskRequest']
export type UpdateTaskRequest = components['schemas']['UpdateTaskRequest']
export type EmployeeSummary = components['schemas']['EmployeeSummary']
// The statuses a client may set on create (DEPENDENT is server-only).
export type CreatableTaskStatus = NonNullable<CreateTaskRequest['status']>
// The statuses a client may set on update: the same four.
export type SettableTaskStatus = NonNullable<UpdateTaskRequest['status']>
