import { describe, expect, it } from 'vitest'
import { safeRedirect } from './redirect'

describe('safeRedirect', () => {
  it.each([
    ['/teams', '/teams'],
    ['/tasks/MKT-3?tab=comments', '/tasks/MKT-3?tab=comments'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['https://evil.com', '/'],
    ['/login?redirect=%2Fteams', '/'],
    ['', '/'],
    [null, '/'],
  ])('%s → %s', (param, expected) => {
    expect(safeRedirect(param)).toBe(expected)
  })
})
