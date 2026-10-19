import type { ReactNode } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/initials'
import type { Comment, CommentReply } from '../types'
import { CommentBody } from './CommentBody'

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

interface CommentItemProps {
  comment: Comment | CommentReply
  // Shown under the body, e.g. the thread's Reply button.
  actions?: ReactNode
}

export function CommentItem({ comment, actions }: CommentItemProps) {
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
        <CommentBody body={comment.body ?? ''} mentions={comment.mentions} />
        {actions && <div className="flex gap-1">{actions}</div>}
      </div>
    </article>
  )
}
