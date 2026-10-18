import { describe, expect, it } from 'vitest'
import {
  ApiError,
  ERROR_MESSAGES,
  KNOWN_ERROR_CODES,
  getErrorMessage,
  hasErrorCode,
  isApiError,
  toApiError,
} from './errors'

// Bodies are the contract's own examples (/openapi.json) or captured from the running backend.
const blockedBody = {
  error: 'Task is blocked by unfinished dependencies',
  code: 'TASK_BLOCKED',
  details: {
    blockers: [
      { id: '0e6c1f2a-4b8d-4c3e-9f7a-1d2b3c4d5e6f', key: 'MKT-3', title: 'Finalise sample', status: 'IN_PROGRESS' },
    ],
  },
}

describe('toApiError', () => {
  it('maps validation issues to fieldErrors, first message per path', () => {
    const error = toApiError(400, {
      error: 'Validation failed',
      details: [
        { path: 'email', message: 'Invalid email address' },
        { path: 'email', message: 'Too long' },
        { path: 'name', message: 'Required' },
      ],
    })

    expect(error.status).toBe(400)
    expect(error.code).toBeUndefined()
    expect(error.fieldErrors).toEqual({ email: 'Invalid email address', name: 'Required' })
    expect(error.formErrors).toEqual([])
    expect(error.serverMessage).toBe('Validation failed')
  })

  it('puts issues with an empty path (malformed JSON) in formErrors', () => {
    const error = toApiError(400, {
      error: 'Malformed JSON body',
      details: [{ path: '', message: "Expected property name or '}' in JSON at position 1 (line 1 column 2)" }],
    })

    expect(error.formErrors).toEqual(["Expected property name or '}' in JSON at position 1 (line 1 column 2)"])
    expect(error.fieldErrors).toEqual({})
  })

  it('keeps code and details of a coded error intact', () => {
    const error = toApiError(409, blockedBody)

    expect(error.code).toBe('TASK_BLOCKED')
    expect(error.details).toEqual(blockedBody.details)
    expect(hasErrorCode(error, 'TASK_BLOCKED')).toBe(true)
    expect(getErrorMessage(error)).toBe('This task is blocked by unfinished dependencies.')
  })

  it('treats a 404 without a code as a plain ErrorResponse', () => {
    const error = toApiError(404, { error: 'Team not found' })

    expect(error.code).toBeUndefined()
    expect(getErrorMessage(error)).toBe('Team not found')
  })

  it('treats a non-JSON body (Express HTML 404) as status only', () => {
    const error = toApiError(404, '<!DOCTYPE html><html><body><pre>Cannot GET /nope</pre></body></html>')

    expect(error.status).toBe(404)
    expect(error.code).toBeUndefined()
    expect(error.serverMessage).toBeUndefined()
    expect(getErrorMessage(error)).toBe('Not found.')
  })

  it('treats an empty or wrongly shaped body as status only', () => {
    expect(toApiError(500, undefined).serverMessage).toBeUndefined()
    expect(toApiError(500, { status: 'error', message: 'db down' }).serverMessage).toBeUndefined()
  })
})

describe('getErrorMessage', () => {
  it('never shows the server message of a 500', () => {
    expect(getErrorMessage(toApiError(500, { error: 'Internal server error' }))).toBe(
      'Something went wrong on our side. Try again.',
    )
  })

  it('uses the server message for an unknown code on a 409', () => {
    expect(getErrorMessage(toApiError(409, { error: 'Something new happened', code: 'BRAND_NEW_CODE' }))).toBe(
      'Something new happened',
    )
  })

  it('uses the server message for codes mapped to null', () => {
    expect(getErrorMessage(toApiError(409, { error: 'MKT-7 already depends on MKT-3', code: 'DEPENDENCY_EXISTS' }))).toBe(
      'MKT-7 already depends on MKT-3',
    )
  })

  it('prefers the code message over the status fallback', () => {
    expect(getErrorMessage(toApiError(502, { error: 'Bad gateway', code: 'GOOGLE_UNAVAILABLE' }))).toBe(
      'Google sign-in is temporarily unavailable. Try again shortly.',
    )
    expect(getErrorMessage(toApiError(502, 'Bad gateway'))).toBe(
      'The service is temporarily unavailable. Try again shortly.',
    )
  })

  it('falls back by status', () => {
    expect(getErrorMessage(new ApiError({ status: 0, code: 'NETWORK_ERROR' }))).toBe(
      "Can't reach the FlowDesk server. Check your connection and try again.",
    )
    expect(getErrorMessage(new ApiError({ status: 403 }))).toBe("You don't have permission to do that.")
    expect(getErrorMessage(new ApiError({ status: 418 }))).toBe('Something went wrong. Try again.')
  })

  it('handles values that are not ApiErrors', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('Something went wrong. Try again.')
    expect(getErrorMessage(undefined)).toBe('Something went wrong. Try again.')
    expect(isApiError(new Error('boom'))).toBe(false)
  })

  it('has a message entry for every known code', () => {
    for (const code of KNOWN_ERROR_CODES) {
      expect(Object.hasOwn(ERROR_MESSAGES, code), code).toBe(true)
    }
    expect(Object.keys(ERROR_MESSAGES)).toHaveLength(KNOWN_ERROR_CODES.length)
  })
})
