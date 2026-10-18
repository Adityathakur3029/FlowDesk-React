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

describe('parseEmployeeSearch teamId', () => {
  it.each([
    ['teamId=none', 'none'],
    ['teamId=3f2c8b1e-6d4a-4b7e-9c21-5a8e7d0f1b23', '3f2c8b1e-6d4a-4b7e-9c21-5a8e7d0f1b23'],
    ['teamId=abc', undefined],
    ['teamId=', undefined],
  ])('%s → %s', (query, teamId) => {
    expect(parse(query).teamId).toBe(teamId)
  })

  it('round-trips into the URL and the API params', () => {
    const search = parse('teamId=none&offset=20')
    expect(toEmployeeSearchParams(search).toString()).toBe('teamId=none&offset=20')
    expect(toEmployeeListParams(search)).toEqual({ teamId: 'none', limit: 20, offset: 20 })
  })
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
