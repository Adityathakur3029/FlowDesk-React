import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { ApiError } from '@/api/errors'
import type { CreateTaskRequest, Task, TaskList, TaskListParams } from './types'

export const taskKeys = {
  all: ['tasks'] as const,
  program: (programId: string) => [...taskKeys.all, 'program', programId] as const,
  list: (programId: string, params: TaskListParams) => [...taskKeys.program(programId), 'list', params] as const,
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
