import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { hasErrorCode, isApiError, type ApiError } from '@/api/errors'
import type {
  CreateTaskRequest,
  Task,
  TaskDetail,
  TaskList,
  TaskListParams,
  TaskParentRef,
  TaskSummary,
  UpdateTaskRequest,
} from './types'

export const taskKeys = {
  all: ['tasks'] as const,
  // Takes a whole TaskParent too (task.parent): only its type and id are in the key.
  parent: ({ type, id }: TaskParentRef) => [...taskKeys.all, type, id] as const,
  lists: (parent: TaskParentRef) => [...taskKeys.parent(parent), 'list'] as const,
  list: (parent: TaskParentRef, params: TaskListParams) => [...taskKeys.lists(parent), params] as const,
  // One task is addressed without its parent (/tasks/{taskRef}), so its cache entry is too.
  details: () => [...taskKeys.all, 'detail'] as const,
  // taskRef as in the URL: the key (MKT-7) or the id.
  detail: (taskRef: string) => [...taskKeys.details(), taskRef] as const,
}

// GET /programs/{programId}/tasks or GET /boards/{boardId}/tasks: same filters, sort and paging.
function fetchTasks(parent: TaskParentRef, query: TaskListParams, signal: AbortSignal): Promise<TaskList> {
  return parent.type === 'PROGRAM'
    ? unwrap(apiClient.GET('/programs/{programId}/tasks', { params: { path: { programId: parent.id }, query }, signal }))
    : unwrap(apiClient.GET('/boards/{boardId}/tasks', { params: { path: { boardId: parent.id }, query }, signal }))
}

// One page of the program's or board's active tasks, newest first (number desc).
export function useParentTasks(parent: TaskParentRef, params: TaskListParams) {
  return useQuery({
    queryKey: taskKeys.list(parent, params),
    queryFn: ({ signal }) => fetchTasks(parent, params, signal),
    placeholderData: keepPreviousData,
  })
}

// POST /programs/{programId}/tasks or POST /boards/{boardId}/tasks: any active employee. The signed-in
// employee becomes the reporter, and the server picks the next (global) number.
export function useCreateTask(parent: TaskParentRef) {
  const queryClient = useQueryClient()
  return useMutation<Task, ApiError, CreateTaskRequest>({
    mutationFn: async (body) =>
      (
        await (parent.type === 'PROGRAM'
          ? unwrap(apiClient.POST('/programs/{programId}/tasks', { params: { path: { programId: parent.id } }, body }))
          : unwrap(apiClient.POST('/boards/{boardId}/tasks', { params: { path: { boardId: parent.id } }, body })))
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.parent(parent) }),
  })
}

// GET /tasks/{taskRef}: any task, in a program or on a board, with its parent and both sides of its
// dependency links. 404 when it's unknown or deleted, or its program is deleted.
export function useTask(taskRef: string) {
  return useQuery({
    queryKey: taskKeys.detail(taskRef),
    queryFn: async ({ signal }) => (await unwrap(apiClient.GET('/tasks/{taskRef}', { params: { path: { taskRef } }, signal }))).data,
  })
}

// A task saved by PATCH or a dependency change, which all answer with the whole task: it replaces the cached
// one, and its parent's lists refetch. The other tasks' pages refetch when opened, because their status or links
// can follow this one (moving into or out of DONE re-evaluates the tasks it blocks; a new blocker gains a `blocks`).
function useTaskSaved(taskRef: string) {
  const queryClient = useQueryClient()
  return (task: TaskDetail) => {
    queryClient.setQueryData(taskKeys.detail(taskRef), task)
    void queryClient.invalidateQueries({ queryKey: taskKeys.lists(task.parent) })
    void queryClient.invalidateQueries({ queryKey: taskKeys.details(), refetchType: 'none' })
  }
}

// PATCH /tasks/{taskRef}: any active employee. The page sends only the field being edited, so it can't
// overwrite someone else's change to another field.
export function useUpdateTask(taskRef: string) {
  const queryClient = useQueryClient()
  const refetchTask = () => queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskRef) })
  return useMutation<TaskDetail, ApiError, UpdateTaskRequest>({
    mutationFn: async (body) => (await unwrap(apiClient.PATCH('/tasks/{taskRef}', { params: { path: { taskRef } }, body }))).data,
    onSuccess: useTaskSaved(taskRef),
    onError: (error) => {
      // Deleted meanwhile (the page then shows "Task not found"), or blocked by tasks it didn't list yet.
      if ((isApiError(error) && error.status === 404) || hasErrorCode(error, 'TASK_BLOCKED')) void refetchTask()
    },
  })
}

export const TASK_SEARCH_LIMIT = 20

// The parent's tasks ?q= for the blocker picker: a title substring or an exact key, newest first. Without q it
// lists the newest tasks. Same key as the task list's first page, so they share the cache.
export function useTaskSearch(parent: TaskParentRef, q: string) {
  const params: TaskListParams = { ...(q && { q }), limit: TASK_SEARCH_LIMIT, offset: 0 }
  return useParentTasks(parent, params)
}

// A failed dependency change: refetch the task when it was deleted (404) or changed meanwhile (409), and the
// lists when the picked blocker was deleted.
function useDependencyError(task: TaskDetail, taskRef: string) {
  const queryClient = useQueryClient()
  return (error: ApiError) => {
    if (isApiError(error) && (error.status === 404 || error.status === 409)) {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskRef) })
    }
    if (hasErrorCode(error, 'DEPENDENCY_TASK_NOT_FOUND')) void queryClient.invalidateQueries({ queryKey: taskKeys.lists(task.parent) })
  }
}

// POST /tasks/{taskRef}/dependencies: the task is blocked by `blocker` from now on, and becomes DEPENDENT if
// the blocker isn't DONE. Any active employee. Same-parent, self, cycle, duplicate, DONE-task and limit rules
// are the server's (400/409 with a code).
export function useAddBlocker(task: TaskDetail, taskRef: string) {
  return useMutation<TaskDetail, ApiError, TaskSummary>({
    mutationFn: async (blocker) =>
      (
        await unwrap(
          apiClient.POST('/tasks/{taskRef}/dependencies', { params: { path: { taskRef } }, body: { dependsOnTaskId: blocker.id } }),
        )
      ).data,
    onSuccess: useTaskSaved(taskRef),
    onError: useDependencyError(task, taskRef),
  })
}

// DELETE /tasks/{taskRef}/dependencies/{dependsOnTaskId}: answers 200 with the task, whose previous status
// comes back if that was its last open blocker. Any active employee.
export function useRemoveBlocker(task: TaskDetail, taskRef: string) {
  return useMutation<TaskDetail, ApiError, TaskSummary>({
    mutationFn: async (blocker) =>
      (
        await unwrap(
          apiClient.DELETE('/tasks/{taskRef}/dependencies/{dependsOnTaskId}', {
            params: { path: { taskRef, dependsOnTaskId: blocker.id } },
          }),
        )
      ).data,
    onSuccess: useTaskSaved(taskRef),
    onError: useDependencyError(task, taskRef),
  })
}

// DELETE /tasks/{taskRef}: ADMIN, MANAGER or the task's reporter; 403 for anyone else. It also removes the
// task's dependency links, so the tasks it blocked may change status.
export function useDeleteTask(task: TaskDetail, taskRef: string) {
  const queryClient = useQueryClient()
  return useMutation<void, ApiError, void>({
    mutationFn: async () => {
      await unwrap(apiClient.DELETE('/tasks/{taskRef}', { params: { path: { taskRef } } }))
    },
    onSuccess: () => {
      // The parent's task list loads fresh, so the deleted row doesn't flash. Nothing showing a list is mounted here.
      queryClient.removeQueries({ queryKey: taskKeys.lists(task.parent) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.details(), refetchType: 'none' })
    },
  })
}
