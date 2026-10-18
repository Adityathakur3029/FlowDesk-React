import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

describe('parseEnv', () => {
  it('throws a clear error when VITE_API_BASE_URL is missing or not http(s)', () => {
    const message = /VITE_API_BASE_URL must be an absolute http\(s\) URL/
    expect(() => parseEnv({})).toThrow(message)
    expect(() => parseEnv({ VITE_API_BASE_URL: 'localhost:3001' })).toThrow(message)
    expect(() => parseEnv({ VITE_API_BASE_URL: 'ftp://example.com' })).toThrow(message)
  })

  it('strips trailing slashes', () => {
    expect(parseEnv({ VITE_API_BASE_URL: 'http://localhost:3001/' }).VITE_API_BASE_URL).toBe('http://localhost:3001')
  })
})
