import { useState } from 'react'
import { Reply } from 'lucide-react'
import type { Comment, CommentTarget } from '../types'
import { CommentActionButton } from './CommentActionButton'
import { CommentForm } from './CommentForm'
import { CommentItem } from './CommentItem'

// A top-level comment, its replies (oldest first) and an inline reply form. Replies can't have replies.
export function CommentThread({ target, comment }: { target: CommentTarget; comment: Comment }) {
  const [replying, setReplying] = useState(false)
  const replies = comment.replies ?? []
  // A deleted comment can't be replied to (contract).
  const canReply = comment.isActive && !replying

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-background p-4 shadow-xs dark:border-blue-900/60">
      <CommentItem
        comment={comment}
        target={target}
        actions={
          canReply && (
            <CommentActionButton onClick={() => setReplying(true)}>
              <Reply aria-hidden="true" />
              Reply
            </CommentActionButton>
          )
        }
      />
      {(replies.length > 0 || replying) && (
        // Lines replies up with the parent's body: avatar (size-8) + gap-3.
        <div className="ml-11 flex flex-col gap-3 border-l-2 border-blue-200 pl-4 dark:border-blue-800">
          {replies.length > 0 && (
            <ul aria-label="Replies" className="flex flex-col gap-3">
              {replies.map((reply) => (
                <li key={reply.id}>
                  <CommentItem comment={reply} target={target} />
                </li>
              ))}
            </ul>
          )}
          {replying && (
            <CommentForm
              target={target}
              parentId={comment.id}
              autoFocus
              onDone={() => setReplying(false)}
              onCancel={() => setReplying(false)}
            />
          )}
        </div>
      )}
    </li>
  )
}
