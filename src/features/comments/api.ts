import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { hasErrorCode, type ApiError } from '@/api/errors'
import type { Comment, CommentList, CreateCommentRequest } from './types'

export const commentKeys = {
  all: ['comments'] as const,
  program: (programId: string) => [...commentKeys.all, 'program', programId] as const,
}

export const COMMENT_PAGE_SIZE = 20

// GET /programs/{programId}/comments: program-level threads, newest first, each with every active reply
// (oldest first). limit/offset page threads, and "Show older comments" loads the next page.
export function useProgramComments(programId: string) {
  return useInfiniteQuery({
    queryKey: commentKeys.program(programId),
    queryFn: ({ pageParam, signal }): Promise<CommentList> =>
      unwrap(
        apiClient.GET('/programs/{programId}/comments', {
          params: { path: { programId }, query: { order: 'desc', limit: COMMENT_PAGE_SIZE, offset: pageParam } },
          signal,
        }),
      ),
    initialPageParam: 0,
    getNextPageParam: ({ data, meta }) => {
      const next = meta.offset + data.length
      return data.length > 0 && next < meta.total ? next : undefined
    },
  })
}

// POST /programs/{programId}/comments: a new thread, or a reply when parentId is set. Any active employee.
export function useCreateProgramComment(programId: string) {
  const queryClient = useQueryClient()
  const refetch = () => queryClient.invalidateQueries({ queryKey: commentKeys.program(programId) })
  return useMutation<Comment, ApiError, CreateCommentRequest>({
    mutationFn: async (body) =>
      (await unwrap(apiClient.POST('/programs/{programId}/comments', { params: { path: { programId } }, body }))).data,
    onSuccess: refetch,
    onError: (error) => {
      // The comment being replied to was deleted meanwhile: refetch so its thread shows what's left of it.
      if (hasErrorCode(error, 'PARENT_COMMENT_NOT_FOUND')) void refetch()
    },
  })
}
