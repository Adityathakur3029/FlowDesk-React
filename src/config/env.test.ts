import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

const valid = {
  VITE_API_BASE_URL: 'http://localhost:3001',
  VITE_GOOGLE_CLIENT_ID: '1234-abc.apps.googleusercontent.com',
}

describe('parseEnv', () => {
  it('throws a clear error when VITE_API_BASE_URL is missing or not http(s)', () => {
    const message = /VITE_API_BASE_URL must be an absolute http\(s\) URL/
    expect(() => parseEnv({ ...valid, VITE_API_BASE_URL: undefined })).toThrow(message)
    expect(() => parseEnv({ ...valid, VITE_API_BASE_URL: 'localhost:3001' })).toThrow(message)
    expect(() => parseEnv({ ...valid, VITE_API_BASE_URL: 'ftp://example.com' })).toThrow(message)
  })

  it('throws an error naming VITE_GOOGLE_CLIENT_ID when it is missing or malformed', () => {
    expect(() => parseEnv({ ...valid, VITE_GOOGLE_CLIENT_ID: undefined })).toThrow(/VITE_GOOGLE_CLIENT_ID/)
    expect(() => parseEnv({ ...valid, VITE_GOOGLE_CLIENT_ID: 'abc' })).toThrow(/VITE_GOOGLE_CLIENT_ID/)
  })

  it('does not blame the API URL when only the client ID is wrong', () => {
    expect(() => parseEnv({ ...valid, VITE_GOOGLE_CLIENT_ID: '' })).not.toThrow(/VITE_API_BASE_URL/)
  })

  it('strips trailing slashes and trims the client ID', () => {
    const env = parseEnv({ VITE_API_BASE_URL: 'http://localhost:3001/', VITE_GOOGLE_CLIENT_ID: ` ${valid.VITE_GOOGLE_CLIENT_ID} ` })
    expect(env.VITE_API_BASE_URL).toBe('http://localhost:3001')
    expect(env.VITE_GOOGLE_CLIENT_ID).toBe(valid.VITE_GOOGLE_CLIENT_ID)
  })
})
