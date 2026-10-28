import { describe, expect, it } from 'vitest'
import { parseProgramSearch, toProgramListParams, toProgramSearchParams } from './searchParams'

const parse = (query: string) => parseProgramSearch(new URLSearchParams(query))

describe('parseProgramSearch', () => {
  it('reads valid params', () => {
    expect(parse('status=ACTIVE&offset=20')).toEqual({ status: 'ACTIVE', offset: 20 })
  })

  it.each(['status=done&offset=-1', 'status=active&offset=abc', 'status=&offset=1.5', ''])(
    'falls back to defaults for %j',
    (query) => {
      expect(parse(query)).toEqual({ status: undefined, offset: 0 })
    },
  )

  it('round-trips into the URL and the API params', () => {
    const search = parse('offset=20&status=COMPLETED')
    expect(toProgramSearchParams(search).toString()).toBe('status=COMPLETED&offset=20')
    expect(toProgramListParams(search)).toEqual({ status: 'COMPLETED', limit: 20, offset: 20 })
  })

  it('leaves the defaults out of the URL and the API params', () => {
    expect(toProgramSearchParams({ offset: 0 }).toString()).toBe('')
    expect(toProgramListParams({ offset: 0 })).toEqual({ limit: 20, offset: 0 })
  })
})
