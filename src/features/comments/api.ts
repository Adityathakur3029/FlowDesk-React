import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { hasErrorCode, isApiError, type ApiError } from '@/api/errors'
import type { Comment, CommentList, CommentTarget, CreateCommentRequest } from './types'

export const commentKeys = {
  all: ['comments'] as const,
  program: (programId: string) => [...commentKeys.all, 'program', programId] as const,
  task: (programId: string, taskId: string) => [...commentKeys.all, 'task', programId, taskId] as const,
  target: ({ programId, taskId }: CommentTarget) =>
    taskId === undefined ? commentKeys.program(programId) : commentKeys.task(programId, taskId),
}

export const COMMENT_PAGE_SIZE = 20

type CommentPageQuery = { order: 'desc'; limit: number; offset: number }

// GET /programs/{programId}/comments or GET /programs/{programId}/tasks/{taskRef}/comments.
function fetchComments({ programId, taskId }: CommentTarget, query: CommentPageQuery, signal: AbortSignal) {
  return taskId === undefined
    ? unwrap(apiClient.GET('/programs/{programId}/comments', { params: { path: { programId }, query }, signal }))
    : unwrap(
        apiClient.GET('/programs/{programId}/tasks/{taskRef}/comments', {
          params: { path: { programId, taskRef: taskId }, query },
          signal,
        }),
      )
}

// The target's threads, newest first, each with every active reply (oldest first). limit/offset page
// threads, and "Show older comments" loads the next page.
export function useComments(target: CommentTarget) {
  return useInfiniteQuery({
    queryKey: commentKeys.target(target),
    queryFn: ({ pageParam, signal }): Promise<CommentList> =>
      fetchComments(target, { order: 'desc', limit: COMMENT_PAGE_SIZE, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: ({ data, meta }) => {
      const next = meta.offset + data.length
      return data.length > 0 && next < meta.total ? next : undefined
    },
  })
}

// POST …/comments on the program or the task: a new thread, or a reply when parentId is set. Any active employee.
export function useCreateComment(target: CommentTarget) {
  const queryClient = useQueryClient()
  const refetch = () => queryClient.invalidateQueries({ queryKey: commentKeys.target(target) })
  const { programId, taskId } = target
  return useMutation<Comment, ApiError, CreateCommentRequest>({
    mutationFn: async (body) =>
      (
        await (taskId === undefined
          ? unwrap(apiClient.POST('/programs/{programId}/comments', { params: { path: { programId } }, body }))
          : unwrap(
              apiClient.POST('/programs/{programId}/tasks/{taskRef}/comments', {
                params: { path: { programId, taskRef: taskId } },
                body,
              }),
            ))
      ).data,
    onSuccess: refetch,
    onError: (error) => {
      // The comment being replied to was deleted meanwhile: refetch so its thread shows what's left of it.
      if (hasErrorCode(error, 'PARENT_COMMENT_NOT_FOUND')) void refetch()
    },
  })
}

// Program and task comments alike are addressed by program and id.
interface UpdateCommentVariables {
  commentId: string
  body: string
}

// PATCH /programs/{programId}/comments/{commentId}: the author only (403 for anyone else, ADMIN included).
// It stays pending until the list has refetched, so the form never closes onto the old text.
export function useUpdateComment(target: CommentTarget) {
  const queryClient = useQueryClient()
  const refetch = () => queryClient.invalidateQueries({ queryKey: commentKeys.target(target) })
  const { programId } = target
  return useMutation<Comment, ApiError, UpdateCommentVariables>({
    mutationFn: async ({ commentId, body }) =>
      (await unwrap(apiClient.PATCH('/programs/{programId}/comments/{commentId}', { params: { path: { programId, commentId } }, body: { body } })))
        .data,
    onSuccess: refetch,
    onError: (error) => {
      // Deleted meanwhile: the refetch takes it off the list.
      if (isApiError(error) && error.status === 404) void refetch()
    },
  })
}

// DELETE /programs/{programId}/comments/{commentId}: ADMIN, MANAGER or the author (403 for another MEMBER).
// A top-level comment with active replies stays as a tombstone. Pending until the list has refetched, which
// removes the comment (and the dialog with it).
export function useDeleteComment(target: CommentTarget) {
  const queryClient = useQueryClient()
  const refetch = () => queryClient.invalidateQueries({ queryKey: commentKeys.target(target) })
  const { programId } = target
  return useMutation<void, ApiError, string>({
    mutationFn: async (commentId) => {
      await unwrap(apiClient.DELETE('/programs/{programId}/comments/{commentId}', { params: { path: { programId, commentId } } }))
    },
    onSuccess: refetch,
    onError: (error) => {
      if (isApiError(error) && error.status === 404) void refetch()
    },
  })
}
