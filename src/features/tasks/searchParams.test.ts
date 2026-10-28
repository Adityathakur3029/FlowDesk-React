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

  it('reads the Created filter and ignores an unknown one', () => {
    expect(parseTaskSearch(new URLSearchParams('created=7d'))).toEqual({ created: '7d', offset: 0 })
    expect(parseTaskSearch(new URLSearchParams('created=30d'))).toEqual({ created: '30d', offset: 0 })
    expect(parseTaskSearch(new URLSearchParams('created=yesterday'))).toEqual({ offset: 0 })
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
    const prev = new URLSearchParams('q=x&status=DONE&created=7d')
    expect(updateTaskSearch(prev, { q: undefined, status: undefined, created: undefined }).toString()).toBe('')
  })

  it('keeps the Created filter when paging', () => {
    expect(updateTaskSearch(new URLSearchParams('created=7d'), { offset: 20 }).toString()).toBe('created=7d&offset=20')
  })
})

describe('toTaskListParams', () => {
  const TODAY = '2026-10-28'

  it('sends only what is set, with the page size', () => {
    expect(toTaskListParams({ offset: 0 }, TODAY)).toEqual({ limit: 20, offset: 0 })
    expect(toTaskListParams({ q: 'x', status: 'DONE', offset: 20 }, TODAY)).toEqual({ q: 'x', status: 'DONE', limit: 20, offset: 20 })
  })

  it('sends createdFrom for today and the days before it', () => {
    expect(toTaskListParams({ created: '7d', offset: 0 }, TODAY)).toEqual({ createdFrom: '2026-10-22', limit: 20, offset: 0 })
    expect(toTaskListParams({ created: '30d', offset: 0 }, TODAY)).toEqual({ createdFrom: '2026-09-29', limit: 20, offset: 0 })
  })
})
