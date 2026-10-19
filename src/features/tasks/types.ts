import type { components, paths } from '@/api/schema'

export type Task = components['schemas']['Task']
export type TaskStatus = components['schemas']['TaskStatus']
export type TaskType = components['schemas']['TaskType']
export type TaskPriority = components['schemas']['TaskPriority']
export type TaskList = components['schemas']['TaskListResponse']
export type TaskListParams = NonNullable<paths['/programs/{programId}/tasks']['get']['parameters']['query']>
export type CreateTaskRequest = components['schemas']['CreateTaskRequest']
// The statuses a client may set on create (DEPENDENT is server-only).
export type CreatableTaskStatus = NonNullable<CreateTaskRequest['status']>
