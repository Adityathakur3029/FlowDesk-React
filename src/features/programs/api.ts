import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { hasErrorCode, type ApiError } from '@/api/errors'
import { teamKeys } from '@/features/teams'
import type { CreateProgramRequest, Program, ProgramList, ProgramListParams } from './types'

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
