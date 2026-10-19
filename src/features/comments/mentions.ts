import type { MentionedPerson } from './types'

// While typing, a mention shows as "@Jane Doe" in the box; it becomes the contract's token
// @[Jane Doe](mention:<uuid>) only when the comment is posted (toMentionTokens). Editing the name in the box
// turns it back into plain text, which is how a mention is removed.

const MAX_MENTION_QUERY = 50
// First and last name, plus one more word.
const MAX_QUERY_SPACES = 2

export interface MentionQuery {
  // Index of the "@".
  start: number
  // What's typed after it, up to the caret.
  query: string
}

// The "@name" being typed at the caret, if any. The "@" must start the text or follow whitespace or "(",
// so an email address doesn't open the list.
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret)
  const start = before.lastIndexOf('@')
  if (start === -1) return null
  if (start > 0 && !/[\s(]/.test(before[start - 1])) return null
  const query = before.slice(start + 1)
  if (query.length > MAX_MENTION_QUERY || /[\n@[\]()]/.test(query) || /^\s/.test(query) || /\s\s/.test(query)) return null
  if ((query.match(/\s/g)?.length ?? 0) > MAX_QUERY_SPACES) return null
  return { start, query }
}

// The name as shown after "@" and used as the token's label. Brackets would end the label early.
export function mentionLabel(name: string): string {
  return name.replace(/[[\]]/g, '').trim()
}

// Replaces the "@query" from `start` to the caret with "@Name " and returns the new text and caret.
export function insertMention(text: string, start: number, caret: number, name: string): { text: string; caret: number } {
  const after = text.slice(caret)
  const inserted = `@${mentionLabel(name)}${after.startsWith(' ') ? '' : ' '}`
  return { text: text.slice(0, start) + inserted + after, caret: start + inserted.length + (after.startsWith(' ') ? 1 : 0) }
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Matches "@Label" for each picked person, longest label first so "@Jane Doe" wins over "@Jane", and only
// as a whole word. If two picked people share a name, the first one picked wins.
function mentionMatcher(people: readonly MentionedPerson[]): { pattern: RegExp; byLabel: Map<string, MentionedPerson> } | null {
  const byLabel = new Map<string, MentionedPerson>()
  for (const person of people) {
    const label = mentionLabel(person.name)
    if (label && !byLabel.has(label)) byLabel.set(label, person)
  }
  if (byLabel.size === 0) return null
  const labels = [...byLabel.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp)
  return { pattern: new RegExp(`(?<![\\p{L}\\p{N}_])@(${labels.join('|')})(?![\\p{L}\\p{N}_])`, 'gu'), byLabel }
}

// Turns every "@Name" of a picked person into @[Name](mention:<uuid>). Anything else is left as typed.
export function toMentionTokens(body: string, people: readonly MentionedPerson[]): string {
  const matcher = mentionMatcher(people)
  if (!matcher) return body
  return body.replace(matcher.pattern, (_, label: string) => `@[${label}](mention:${matcher.byLabel.get(label)!.id})`)
}

// The picked people whose "@Name" is still in the body, in the order they appear.
export function mentionedIn(body: string, people: readonly MentionedPerson[]): MentionedPerson[] {
  const matcher = mentionMatcher(people)
  if (!matcher) return []
  const found = new Map<string, MentionedPerson>()
  for (const match of body.matchAll(matcher.pattern)) {
    const person = matcher.byLabel.get(match[1])!
    found.set(person.id, person)
  }
  return [...found.values()]
}
