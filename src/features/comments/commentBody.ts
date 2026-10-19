// The contract's mention token: @[Display Name](mention:<employee uuid>). The label is display text only.
const MENTION_TOKEN = /@\[([^\]]*)\]\(mention:([0-9a-fA-F-]{36})\)/g

export type CommentBodyPart = { type: 'text'; text: string } | { type: 'mention'; employeeId: string; label: string }

// Splits a comment body into text and mention tokens, in order.
export function parseCommentBody(body: string): CommentBodyPart[] {
  const parts: CommentBodyPart[] = []
  let last = 0
  for (const match of body.matchAll(MENTION_TOKEN)) {
    if (match.index > last) parts.push({ type: 'text', text: body.slice(last, match.index) })
    parts.push({ type: 'mention', employeeId: match[2].toLowerCase(), label: match[1] })
    last = match.index + match[0].length
  }
  if (last < body.length) parts.push({ type: 'text', text: body.slice(last) })
  return parts
}
