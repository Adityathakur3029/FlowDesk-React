import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { useAuth, useHasRole } from '@/auth/useAuth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import { initials } from '@/lib/initials'
import type { Comment, CommentReply, CommentTarget } from '../types'
import { CommentActionButton } from './CommentActionButton'
import { CommentBody } from './CommentBody'
import { CommentForm } from './CommentForm'
import { DeleteCommentButton } from './DeleteCommentButton'

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

// DELETE /programs/{programId}/comments/{commentId} (contract): ADMIN or MANAGER, or the author. Editing is
// the author's only, ADMIN included. UX only: the server still answers 403 to anyone else.
const DELETE_ANY_COMMENT_ROLES = ['ADMIN', 'MANAGER'] as const

interface CommentItemProps {
  comment: Comment | CommentReply
  target: CommentTarget
  // Shown under the body before Edit and Delete, e.g. the thread's Reply button.
  actions?: ReactNode
}

export function CommentItem({ comment, target, actions }: CommentItemProps) {
  const { employee } = useAuth()
  const canDeleteAny = useHasRole(DELETE_ANY_COMMENT_ROLES)
  const { editing, open, close, triggerRef } = useInlineEdit()
  const kind = comment.parentId === null ? 'Comment' : 'Reply'

  // A tombstone: a deleted top-level comment kept because it still has replies. Its author and body are
  // null, although the generated type says otherwise (contract note), so check isActive first.
  if (!comment.isActive) {
    return (
      <article aria-label="Deleted comment" className="flex items-center gap-3">
        <Avatar aria-hidden="true">
          <AvatarFallback />
        </Avatar>
        <p className="text-sm text-muted-foreground italic">This comment was deleted.</p>
      </article>
    )
  }

  const { author } = comment
  const isAuthor = employee !== null && employee.id === author.id
  const canDelete = isAuthor || canDeleteAny

  return (
    <article aria-label={`${kind} by ${author.name}`} className="flex gap-3">
      <Avatar aria-hidden="true">
        <AvatarFallback className="bg-blue-100 font-medium text-blue-800 dark:bg-blue-500/20 dark:text-blue-200">
          {initials(author.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold">{author.name}</span>
          <time dateTime={comment.createdAt} className="text-xs text-muted-foreground">
            {timeFormat.format(new Date(comment.createdAt))}
          </time>
          {comment.editedAt && (
            <span className="text-xs text-muted-foreground" title={`Edited ${timeFormat.format(new Date(comment.editedAt))}`}>
              (edited)
            </span>
          )}
        </div>
        {editing ? (
          <CommentForm target={target} editing={comment} onDone={close} onCancel={close} />
        ) : (
          <>
            <CommentBody body={comment.body ?? ''} mentions={comment.mentions} />
            {(actions || isAuthor || canDelete) && (
              // Lines the first button's text up with the body.
              <div className="-ml-2 flex flex-wrap gap-1">
                {actions}
                {isAuthor && (
                  <CommentActionButton ref={triggerRef} onClick={open}>
                    <Pencil aria-hidden="true" />
                    Edit
                  </CommentActionButton>
                )}
                {canDelete && <DeleteCommentButton comment={comment} target={target} />}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  )
}
