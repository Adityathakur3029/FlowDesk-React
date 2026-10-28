import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getErrorMessage, isApiError } from '@/api/errors'
import { ConfirmDeleteDialog } from '@/components/feedback/ConfirmDeleteDialog'
import { paths } from '@/routes/paths'
import { useDeleteBoard } from '../api'
import type { Board } from '../types'

// The page only shows this to ADMIN (contract); a 403 is still handled.
export function DeleteBoardButton({ board }: { board: Board }) {
  const navigate = useNavigate()
  const [errors, setErrors] = useState<string[]>([])
  const deleteBoard = useDeleteBoard(board.id)

  function confirm() {
    setErrors([])
    deleteBoard.mutate(undefined, {
      onSuccess: () => {
        toast.success(`${board.name} deleted`)
        void navigate(paths.boards)
      },
      onError: (error) => {
        // Someone else deleted it first: the outcome is the same.
        if (isApiError(error) && error.status === 404) {
          toast.info('This board has already been deleted.')
          void navigate(paths.boards)
          return
        }
        setErrors([getErrorMessage(error)])
      },
    })
  }

  return (
    <ConfirmDeleteDialog
      triggerLabel={`Delete board ${board.name}`}
      title={`Delete ${board.name}?`}
      // Only the board is hidden (contract): its tasks stay live and keep counting in the Overview.
      description={`The board will be hidden. Its tasks stay open at their own links, with their comments, and still count in the Overview. Its key ${board.key} stays taken, and there's no way to restore the board yet.`}
      confirmLabel="Delete board"
      pending={deleteBoard.isPending}
      errors={errors}
      onConfirm={confirm}
      onClose={() => setErrors([])}
    />
  )
}
