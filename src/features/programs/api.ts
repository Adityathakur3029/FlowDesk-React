import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { hasErrorCode, isApiError, type ApiError } from '@/api/errors'
import { teamKeys } from '@/features/teams'
import type { CreateProgramRequest, Program, ProgramList, ProgramListParams, UpdateProgramRequest } from './types'

export const programKeys = {
  all: ['programs'] as const,
  lists: () => [...programKeys.all, 'list'] as const,
  list: (params: ProgramListParams) => [...programKeys.lists(), params] as const,
  detail: (programId: string) => [...programKeys.all, 'detail', programId] as const,
}

// GET /programs: one page of active programs, newest first.
export function fetchPrograms(params: ProgramListParams, signal?: AbortSignal): Promise<ProgramList> {
  return unwrap(apiClient.GET('/programs', { params: { query: params }, signal }))
}

export function usePrograms(params: ProgramListParams) {
  return useQuery({
    queryKey: programKeys.list(params),
    queryFn: ({ signal }) => fetchPrograms(params, signal),
    placeholderData: keepPreviousData,
  })
}

// GET /programs/{programId}: one active program. 404 when it's unknown or soft-deleted, 400 for a non-UUID id.
export function useProgram(programId: string) {
  return useQuery({
    queryKey: programKeys.detail(programId),
    queryFn: async ({ signal }) =>
      (await unwrap(apiClient.GET('/programs/{programId}', { params: { path: { programId } }, signal }))).data,
  })
}

// POST /programs, ADMIN or MANAGER. One call, so it's atomic: the program exists or nothing changed.
export function useCreateProgram() {
  const queryClient = useQueryClient()
  return useMutation<Program, ApiError, CreateProgramRequest>({
    mutationFn: async (body) => (await unwrap(apiClient.POST('/programs', { body }))).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: programKeys.all }),
    onError: (error) => {
      // The picked owner team was deleted meanwhile: refetch the directory so it leaves the select.
      if (hasErrorCode(error, 'OWNER_TEAM_NOT_FOUND')) void queryClient.invalidateQueries({ queryKey: teamKeys.all })
    },
  })
}

// PATCH /programs/{programId}, ADMIN or MANAGER. The page sends only the field being edited, so it can't
// overwrite someone else's change to another field. The date range is checked on the merged values.
export function useUpdateProgram(programId: string) {
  const queryClient = useQueryClient()
  return useMutation<Program, ApiError, UpdateProgramRequest>({
    mutationFn: async (body) =>
      (await unwrap(apiClient.PATCH('/programs/{programId}', { params: { path: { programId } }, body }))).data,
    onSuccess: (program) => {
      queryClient.setQueryData(programKeys.detail(programId), program)
      void queryClient.invalidateQueries({ queryKey: programKeys.lists() })
    },
    onError: (error) => {
      // Deleted meanwhile: refetch, so the page shows "Program not found".
      if (isApiError(error) && error.status === 404) void queryClient.invalidateQueries({ queryKey: programKeys.detail(programId) })
    },
  })
}

// DELETE /programs/{programId}, ADMIN only (403 for anyone else). A soft delete: the program and every route
// under it answer 404 afterwards, its key stays taken, and there's no restore endpoint yet.
export function useDeleteProgram(programId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, ApiError, void>({
    mutationFn: async () => {
      await unwrap(apiClient.DELETE('/programs/{programId}', { params: { path: { programId } } }))
    },
    onSuccess: () => {
      // The Programs page loads fresh, so the deleted row doesn't flash. Nothing showing a list is mounted here.
      queryClient.removeQueries({ queryKey: programKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: programKeys.detail(programId), refetchType: 'none' })
    },
  })
}
