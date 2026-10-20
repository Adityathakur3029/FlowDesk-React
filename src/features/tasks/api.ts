import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { hasErrorCode, isApiError, type ApiError } from '@/api/errors'
import type { CreateTaskRequest, Task, TaskDetail, TaskList, TaskListParams, TaskSummary, UpdateTaskRequest } from './types'

export const taskKeys = {
  all: ['tasks'] as const,
  program: (programId: string) => [...taskKeys.all, 'program', programId] as const,
  lists: (programId: string) => [...taskKeys.program(programId), 'list'] as const,
  list: (programId: string, params: TaskListParams) => [...taskKeys.lists(programId), params] as const,
  details: (programId: string) => [...taskKeys.program(programId), 'detail'] as const,
  // taskRef as in the URL: the key (MKT-7) or the id.
  detail: (programId: string, taskRef: string) => [...taskKeys.details(programId), taskRef] as const,
}

// GET /programs/{programId}/tasks: one page of the program's active tasks, newest first (number desc).
export function useProgramTasks(programId: string, params: TaskListParams) {
  return useQuery({
    queryKey: taskKeys.list(programId, params),
    queryFn: ({ signal }): Promise<TaskList> =>
      unwrap(apiClient.GET('/programs/{programId}/tasks', { params: { path: { programId }, query: params }, signal })),
    placeholderData: keepPreviousData,
  })
}

// POST /programs/{programId}/tasks: any active employee. The signed-in employee becomes the reporter,
// and the server picks the next key.
export function useCreateTask(programId: string) {
  const queryClient = useQueryClient()
  return useMutation<Task, ApiError, CreateTaskRequest>({
    mutationFn: async (body) =>
      (await unwrap(apiClient.POST('/programs/{programId}/tasks', { params: { path: { programId } }, body }))).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.program(programId) }),
  })
}

// GET /programs/{programId}/tasks/{taskRef}: one active task with both sides of its dependency links.
// 404 when the program or task is unknown or deleted, or the task is in another program.
export function useTask(programId: string, taskRef: string) {
  return useQuery({
    queryKey: taskKeys.detail(programId, taskRef),
    queryFn: async ({ signal }) =>
      (await unwrap(apiClient.GET('/programs/{programId}/tasks/{taskRef}', { params: { path: { programId, taskRef } }, signal })))
        .data,
  })
}

// A task saved by PATCH or a dependency change, which all answer with the whole task: it replaces the cached
// one, and the lists refetch. The other tasks' pages refetch when opened, because their status or links can
// follow this one (moving into or out of DONE re-evaluates the tasks it blocks; a new blocker gains a `blocks`).
function useTaskSaved(programId: string, taskRef: string) {
  const queryClient = useQueryClient()
  return (task: TaskDetail) => {
    queryClient.setQueryData(taskKeys.detail(programId, taskRef), task)
    void queryClient.invalidateQueries({ queryKey: taskKeys.lists(programId) })
    void queryClient.invalidateQueries({ queryKey: taskKeys.details(programId), refetchType: 'none' })
  }
}

// PATCH /programs/{programId}/tasks/{taskRef}: any active employee. The page sends only the field being
// edited, so it can't overwrite someone else's change to another field.
export function useUpdateTask(programId: string, taskRef: string) {
  const queryClient = useQueryClient()
  const refetchTask = () => queryClient.invalidateQueries({ queryKey: taskKeys.detail(programId, taskRef) })
  return useMutation<TaskDetail, ApiError, UpdateTaskRequest>({
    mutationFn: async (body) =>
      (await unwrap(apiClient.PATCH('/programs/{programId}/tasks/{taskRef}', { params: { path: { programId, taskRef } }, body })))
        .data,
    onSuccess: useTaskSaved(programId, taskRef),
    onError: (error) => {
      // Deleted meanwhile (the page then shows "Task not found"), or blocked by tasks it didn't list yet.
      if ((isApiError(error) && error.status === 404) || hasErrorCode(error, 'TASK_BLOCKED')) void refetchTask()
    },
  })
}

export const TASK_SEARCH_LIMIT = 20

// GET /programs/{programId}/tasks?q= for the blocker picker: a title substring or an exact key, newest first.
// Without q it lists the newest tasks. Same key as the Tasks tab's first page, so they share the cache.
export function useTaskSearch(programId: string, q: string) {
  const params: TaskListParams = { ...(q && { q }), limit: TASK_SEARCH_LIMIT, offset: 0 }
  return useProgramTasks(programId, params)
}

// A failed dependency change: refetch the task when it was deleted (404) or changed meanwhile (409), and the
// lists when the picked blocker was deleted.
function useDependencyError(programId: string, taskRef: string) {
  const queryClient = useQueryClient()
  return (error: ApiError) => {
    if (isApiError(error) && (error.status === 404 || error.status === 409)) {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(programId, taskRef) })
    }
    if (hasErrorCode(error, 'DEPENDENCY_TASK_NOT_FOUND')) void queryClient.invalidateQueries({ queryKey: taskKeys.lists(programId) })
  }
}

// POST /programs/{programId}/tasks/{taskRef}/dependencies: the task is blocked by `blocker` from now on, and
// becomes DEPENDENT if the blocker isn't DONE. Any active employee. Self, cycle, duplicate, DONE-task and
// limit rules are the server's (400/409 with a code).
export function useAddBlocker(programId: string, taskRef: string) {
  return useMutation<TaskDetail, ApiError, TaskSummary>({
    mutationFn: async (blocker) =>
      (
        await unwrap(
          apiClient.POST('/programs/{programId}/tasks/{taskRef}/dependencies', {
            params: { path: { programId, taskRef } },
            body: { dependsOnTaskId: blocker.id },
          }),
        )
      ).data,
    onSuccess: useTaskSaved(programId, taskRef),
    onError: useDependencyError(programId, taskRef),
  })
}

// DELETE /programs/{programId}/tasks/{taskRef}/dependencies/{dependsOnTaskId}: answers 200 with the task,
// whose previous status comes back if that was its last open blocker. Any active employee.
export function useRemoveBlocker(programId: string, taskRef: string) {
  return useMutation<TaskDetail, ApiError, TaskSummary>({
    mutationFn: async (blocker) =>
      (
        await unwrap(
          apiClient.DELETE('/programs/{programId}/tasks/{taskRef}/dependencies/{dependsOnTaskId}', {
            params: { path: { programId, taskRef, dependsOnTaskId: blocker.id } },
          }),
        )
      ).data,
    onSuccess: useTaskSaved(programId, taskRef),
    onError: useDependencyError(programId, taskRef),
  })
}

// DELETE /programs/{programId}/tasks/{taskRef}: ADMIN, MANAGER or the task's reporter; 403 for anyone else.
// It also removes the task's dependency links, so the tasks it blocked may change status.
export function useDeleteTask(programId: string, taskRef: string) {
  const queryClient = useQueryClient()
  return useMutation<void, ApiError, void>({
    mutationFn: async () => {
      await unwrap(apiClient.DELETE('/programs/{programId}/tasks/{taskRef}', { params: { path: { programId, taskRef } } }))
    },
    onSuccess: () => {
      // The Tasks tab loads fresh, so the deleted row doesn't flash. Nothing showing a list is mounted here.
      queryClient.removeQueries({ queryKey: taskKeys.lists(programId) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.details(programId), refetchType: 'none' })
    },
  })
}
