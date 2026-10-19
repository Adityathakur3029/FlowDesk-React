import { describe, expect, it } from 'vitest'
import { parseTaskSearch, toTaskListParams, updateTaskSearch } from './searchParams'

describe('parseTaskSearch', () => {
  it('trims q and drops an unknown status and a bad offset', () => {
    expect(parseTaskSearch(new URLSearchParams('q=%20x%20&status=NOPE&offset=-1'))).toEqual({ q: 'x', offset: 0 })
  })

  it('reads every field', () => {
    expect(parseTaskSearch(new URLSearchParams('q=draft&status=DEPENDENT&offset=40'))).toEqual({
      q: 'draft',
      status: 'DEPENDENT',
      offset: 40,
    })
  })

  it('treats a blank q as none and cuts a long one to 100 characters', () => {
    expect(parseTaskSearch(new URLSearchParams('q=%20%20'))).toEqual({ offset: 0 })
    expect(parseTaskSearch(new URLSearchParams(`q=${'a'.repeat(120)}`)).q).toHaveLength(100)
  })
})

describe('updateTaskSearch', () => {
  it('keeps other parameters and goes back to the first page', () => {
    const next = updateTaskSearch(new URLSearchParams('tab=comments&offset=40'), { status: 'DONE' })
    expect(next.toString()).toBe('tab=comments&status=DONE')
  })

  it('sets the offset when the patch has one', () => {
    expect(updateTaskSearch(new URLSearchParams('q=x'), { offset: 20 }).toString()).toBe('q=x&offset=20')
  })

  it('removes cleared filters', () => {
    expect(updateTaskSearch(new URLSearchParams('q=x&status=DONE'), { q: undefined, status: undefined }).toString()).toBe('')
  })
})

describe('toTaskListParams', () => {
  it('sends only what is set, with the page size', () => {
    expect(toTaskListParams({ offset: 0 })).toEqual({ limit: 20, offset: 0 })
    expect(toTaskListParams({ q: 'x', status: 'DONE', offset: 20 })).toEqual({ q: 'x', status: 'DONE', limit: 20, offset: 20 })
  })
})
