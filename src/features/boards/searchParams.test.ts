import { describe, expect, it } from 'vitest'
import { parseBoardSearch, toBoardListParams, toBoardSearchParams } from './searchParams'

describe('board search params', () => {
  it.each([
    ['offset=20', 20],
    ['offset=-1', 0],
    ['offset=abc', 0],
    ['', 0],
  ])('?%s → offset %i', (query, offset) => {
    expect(parseBoardSearch(new URLSearchParams(query))).toEqual({ offset })
  })

  it('leaves the first page out of the URL and sends the page size', () => {
    expect(toBoardSearchParams({ offset: 0 }).toString()).toBe('')
    expect(toBoardSearchParams({ offset: 40 }).toString()).toBe('offset=40')
    expect(toBoardListParams({ offset: 40 })).toEqual({ limit: 20, offset: 40 })
  })
})
