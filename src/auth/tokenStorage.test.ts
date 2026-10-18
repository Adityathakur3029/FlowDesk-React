import { describe, expect, it } from 'vitest'
import { getAccessToken, readSession, setSession } from './tokenStorage'

const KEY = 'flowdesk.session'

describe('readSession', () => {
  it('returns none when nothing is stored', () => {
    expect(readSession()).toEqual({ state: 'none' })
  })

  it('returns none and clears the key for garbage', () => {
    localStorage.setItem(KEY, '{not json')
    expect(readSession()).toEqual({ state: 'none' })
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('returns expired and clears the key once expiresAt has passed', () => {
    localStorage.setItem(KEY, JSON.stringify({ accessToken: 't', expiresAt: Date.now() - 1 }))
    expect(readSession()).toEqual({ state: 'expired' })
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  it('returns the token and expiry for a live session', () => {
    const expiresAt = setSession({ accessToken: 'token-123', expiresIn: 3600 })
    expect(readSession()).toEqual({ state: 'valid', accessToken: 'token-123', expiresAt })
    expect(getAccessToken()).toBe('token-123')
  })
})
