import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage, isApiError } from '@/api/errors'
import { ConfirmDeleteDialog } from '@/components/feedback/ConfirmDeleteDialog'
import { useDeleteComment } from '../api'
import type { Comment, CommentReply, CommentTarget } from '../types'
import { CommentActionButton } from './CommentActionButton'

interface DeleteCommentButtonProps {
  comment: Comment | CommentReply
  target: CommentTarget
}

// Shown to ADMIN, MANAGER and the author (contract); a 403 is still handled.
export function DeleteCommentButton({ comment, target }: DeleteCommentButtonProps) {
  const [errors, setErrors] = useState<string[]>([])
  const deleteComment = useDeleteComment(target)
  const isReply = comment.parentId !== null
  const hasReplies = 'replies' in comment && (comment.replies?.length ?? 0) > 0

  function confirm() {
    setErrors([])
    // mutateAsync, not mutate: the refetch that ends the request removes this comment, and with it this
    // component, and mutate's callbacks don't run once it's unmounted.
    deleteComment.mutateAsync(comment.id).then(
      () => toast.success(isReply ? 'Reply deleted' : 'Comment deleted'),
      (error: unknown) => {
        // Someone deleted it first; the list refetches without it.
        if (isApiError(error) && error.status === 404) toast.info('This comment has already been deleted.')
        else setErrors([getErrorMessage(error)])
      },
    )
  }

  return (
    <ConfirmDeleteDialog
      trigger={
        <CommentActionButton>
          <Trash2 aria-hidden="true" />
          Delete
        </CommentActionButton>
      }
      title={isReply ? 'Delete this reply?' : 'Delete this comment?'}
      description={hasReplies ? 'Its replies stay, under “This comment was deleted.”' : "This can't be undone."}
      confirmLabel={isReply ? 'Delete reply' : 'Delete comment'}
      pending={deleteComment.isPending}
      errors={errors}
      onConfirm={confirm}
      onClose={() => setErrors([])}
    />
  )
}
