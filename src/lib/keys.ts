import { z } from 'zod'

// Program and board keys follow the same rules: CreateProgramRequest.key's and CreateBoardRequest.key's
// pattern, which the server applies after trimming and uppercasing.
export const KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/

const MAX_KEY_LENGTH = 10

// Mirrors the key rule for instant feedback only; the server's details win.
export const keySchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Enter a key.')
  .regex(KEY_PATTERN, 'Use 2–10 letters or digits, starting with a letter.')

// A typing convenience for the Create program and Create board dialogs, not a rule: the server trims,
// uppercases and validates the key. Initials of a multi-word name, or the first 3 characters of a single word.
// Returns '' when nothing usable is left, so the user types a key.
export function suggestKey(name: string): string {
  const words = name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)
  const raw = words.length >= 2 ? words.map((word) => word[0]).join('') : (words[0] ?? '').slice(0, 3)
  // A key starts with a letter.
  const key = raw.replace(/^[0-9]+/, '').slice(0, MAX_KEY_LENGTH)
  return key.length >= 2 ? key : ''
}

// The key field's hint. Task numbers are global (one counter across every program and board), so it shows
// the prefix only, not PRO-1, PRO-2… The key is immutable and stays taken after a delete, so a typo is permanent.
export function keyHint(key: string): string {
  const trimmed = key.trim()
  return KEY_PATTERN.test(trimmed)
    ? `Task keys will start with ${trimmed}-. The key can't be changed later.`
    : "2–10 letters or digits, starting with a letter. It can't be changed later."
}
