const MAX_KEY_LENGTH = 10

// A typing convenience for the Create program dialog, not a rule: the server trims, uppercases and
// validates the key. Initials of a multi-word name, or the first 3 characters of a single word.
// Returns '' when nothing usable is left, so the user types a key.
export function suggestProgramKey(name: string): string {
  const words = name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)
  const raw = words.length >= 2 ? words.map((word) => word[0]).join('') : (words[0] ?? '').slice(0, 3)
  // A key starts with a letter.
  const key = raw.replace(/^[0-9]+/, '').slice(0, MAX_KEY_LENGTH)
  return key.length >= 2 ? key : ''
}
