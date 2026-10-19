import { parseCommentBody } from '../commentBody'
import type { EmployeeSummary } from '../types'

interface CommentBodyProps {
  body: string
  mentions: readonly EmployeeSummary[]
}

// The body is Markdown stored as sent. It's shown as plain text, which React escapes, so nothing in it
// can run; rendering the Markdown needs a sanitising renderer (follow-up). Mention tokens become "@Name",
// with the person's current name from `mentions` (the label in the token can be out of date).
export function CommentBody({ body, mentions }: CommentBodyProps) {
  const names = new Map(mentions.map((person) => [person.id.toLowerCase(), person.name]))
  return (
    <p className="text-sm break-words whitespace-pre-wrap">
      {parseCommentBody(body).map((part, i) =>
        part.type === 'text' ? (
          part.text
        ) : (
          <span key={i} className="font-medium text-primary">
            @{names.get(part.employeeId) ?? part.label}
          </span>
        ),
      )}
    </p>
  )
}
