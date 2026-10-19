import { useState } from 'react'
import { Reply } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Comment } from '../types'
import { CommentForm } from './CommentForm'
import { CommentItem } from './CommentItem'

// A top-level comment, its replies (oldest first) and an inline reply form. Replies can't have replies.
export function CommentThread({ programId, comment }: { programId: string; comment: Comment }) {
  const [replying, setReplying] = useState(false)
  const replies = comment.replies ?? []
  // A deleted comment can't be replied to (contract).
  const canReply = comment.isActive && !replying

  return (
    <li className="flex flex-col gap-3">
      <CommentItem
        comment={comment}
        actions={
          canReply && (
            <Button type="button" variant="ghost" size="sm" className="-ml-2 h-7" onClick={() => setReplying(true)}>
              <Reply aria-hidden="true" />
              Reply
            </Button>
          )
        }
      />
      {(replies.length > 0 || replying) && (
        // Lines replies up with the parent's body: avatar (size-8) + gap-3.
        <div className="ml-11 flex flex-col gap-3 border-l pl-4">
          {replies.length > 0 && (
            <ul aria-label="Replies" className="flex flex-col gap-3">
              {replies.map((reply) => (
                <li key={reply.id}>
                  <CommentItem comment={reply} />
                </li>
              ))}
            </ul>
          )}
          {replying && (
            <CommentForm
              programId={programId}
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
