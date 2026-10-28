import { describe, expect, it } from 'vitest'
import { parseScope, withScope } from './scope'

describe('report scope', () => {
  it.each([
    ['scope=programs', 'programs'],
    ['scope=boards', 'boards'],
    ['scope=all', 'all'],
    ['scope=tasks', 'all'],
    ['', 'all'],
  ])('?%s → %s', (query, scope) => {
    expect(parseScope(new URLSearchParams(query))).toBe(scope)
  })

  it('keeps the period and leaves All out of the URL', () => {
    expect(withScope(new URLSearchParams('period=1m'), 'boards').toString()).toBe('period=1m&scope=boards')
    expect(withScope(new URLSearchParams('period=1m&scope=boards'), 'all').toString()).toBe('period=1m')
  })
})
