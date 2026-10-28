import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/errors'
import { queryClient, shouldRetryQuery } from './queryClient'

describe('query retry policy', () => {
  it('never retries 4xx', () => {
    expect(shouldRetryQuery(0, new ApiError({ status: 404 }))).toBe(false)
    expect(shouldRetryQuery(0, new ApiError({ status: 401, code: 'INVALID_AUTH_TOKEN' }))).toBe(false)
  })

  it('retries network failures and 5xx at most twice', () => {
    expect(shouldRetryQuery(0, new ApiError({ status: 0, code: 'NETWORK_ERROR' }))).toBe(true)
    expect(shouldRetryQuery(1, new ApiError({ status: 500 }))).toBe(true)
    expect(shouldRetryQuery(2, new ApiError({ status: 500 }))).toBe(false)
  })

  it('never retries mutations', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false)
  })
})
