import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { isApiError, type ApiError } from '@/api/errors'
import { taskKeys } from '@/features/tasks'
import type { Board, BoardList, BoardListParams, CreateBoardRequest, UpdateBoardRequest } from './types'

export const boardKeys = {
  all: ['boards'] as const,
  lists: () => [...boardKeys.all, 'list'] as const,
  list: (params: BoardListParams) => [...boardKeys.lists(), params] as const,
  detail: (boardId: string) => [...boardKeys.all, 'detail', boardId] as const,
}

// GET /boards: one page of active boards, newest first. Any active employee.
export function useBoards(params: BoardListParams) {
  return useQuery({
    queryKey: boardKeys.list(params),
    queryFn: ({ signal }): Promise<BoardList> => unwrap(apiClient.GET('/boards', { params: { query: params }, signal })),
    placeholderData: keepPreviousData,
  })
}

// GET /boards/{boardId}: one active board. 404 when it's unknown or soft-deleted, 400 for a non-UUID id.
export function useBoard(boardId: string) {
  return useQuery({
    queryKey: boardKeys.detail(boardId),
    queryFn: async ({ signal }) => (await unwrap(apiClient.GET('/boards/{boardId}', { params: { path: { boardId } }, signal }))).data,
  })
}

// POST /boards, ADMIN or MANAGER. The key only has to be unique among boards: a program may have it too.
export function useCreateBoard() {
  const queryClient = useQueryClient()
  return useMutation<Board, ApiError, CreateBoardRequest>({
    mutationFn: async (body) => (await unwrap(apiClient.POST('/boards', { body }))).data,
    onSuccess: (board) => {
      // The dialog goes to the new board's page, which can show it straight away.
      queryClient.setQueryData(boardKeys.detail(board.id), board)
      void queryClient.invalidateQueries({ queryKey: boardKeys.lists() })
    },
  })
}

// PATCH /boards/{boardId}, ADMIN or MANAGER: name and/or description (the key is immutable). The page sends only
// the field being edited, so it can't overwrite someone else's change to the other one.
export function useUpdateBoard(boardId: string) {
  const queryClient = useQueryClient()
  return useMutation<Board, ApiError, UpdateBoardRequest>({
    mutationFn: async (body) => (await unwrap(apiClient.PATCH('/boards/{boardId}', { params: { path: { boardId } }, body }))).data,
    onSuccess: (board) => {
      queryClient.setQueryData(boardKeys.detail(boardId), board)
      void queryClient.invalidateQueries({ queryKey: boardKeys.lists() })
    },
    onError: (error) => {
      // Deleted meanwhile: refetch, so the page shows "Board not found".
      if (isApiError(error) && error.status === 404) void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) })
    },
  })
}

// DELETE /boards/{boardId}, ADMIN only (403 for anyone else). A soft delete that hides only the board: its page,
// task list and task creation answer 404, but its tasks stay live at /tasks/{taskRef} (their parent.isActive
// turns false) and still count in the Overview. The key stays taken; there's no restore endpoint yet.
export function useDeleteBoard(boardId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, ApiError, void>({
    mutationFn: async () => {
      await unwrap(apiClient.DELETE('/boards/{boardId}', { params: { path: { boardId } } }))
    },
    onSuccess: () => {
      // The Boards page loads fresh, so the deleted row doesn't flash. Nothing showing a list is mounted here.
      queryClient.removeQueries({ queryKey: boardKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId), refetchType: 'none' })
      // Cached task pages of this board still name it as an active parent.
      void queryClient.invalidateQueries({ queryKey: taskKeys.details(), refetchType: 'none' })
    },
  })
}
