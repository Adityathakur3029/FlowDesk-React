import { describe, expect, it } from 'vitest'
import { parseEmployeeSearch, toEmployeeListParams, toEmployeeSearchParams } from './searchParams'

const parse = (query: string) => parseEmployeeSearch(new URLSearchParams(query))

describe('parseEmployeeSearch', () => {
  it('reads valid params', () => {
    expect(parse('role=MANAGER&offset=20&includeInactive=true')).toEqual({
      role: 'MANAGER',
      includeInactive: true,
      offset: 20,
    })
  })

  it.each(['role=BOSS&offset=-1&includeInactive=yes', 'offset=abc&role=manager', 'offset=1.5', ''])(
    'falls back to defaults for %j',
    (query) => {
      expect(parse(query)).toEqual({ role: undefined, includeInactive: false, offset: 0 })
    },
  )
})

describe('toEmployeeSearchParams', () => {
  it('leaves defaults out of the URL', () => {
    expect(toEmployeeSearchParams({ includeInactive: false, offset: 0 }).toString()).toBe('')
    expect(toEmployeeSearchParams({ role: 'MEMBER', includeInactive: true, offset: 40 }).toString()).toBe(
      'role=MEMBER&includeInactive=true&offset=40',
    )
  })
})

describe('toEmployeeListParams', () => {
  it('always sends limit and offset, and filters only when set', () => {
    expect(toEmployeeListParams({ includeInactive: false, offset: 0 })).toEqual({ limit: 20, offset: 0 })
    expect(toEmployeeListParams({ role: 'ADMIN', includeInactive: true, offset: 20 })).toEqual({
      role: 'ADMIN',
      includeInactive: 'true',
      limit: 20,
      offset: 20,
    })
  })
})
