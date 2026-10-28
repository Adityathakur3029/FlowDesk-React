import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { setSession } from '@/auth/tokenStorage'
import { env } from '@/config/env'
import { server } from '@/test/server'
import { onUnauthorized } from './authEvents'
import { apiClient, unwrap } from './client'
import { ApiError } from './errors'

const api = (path: string) => `${env.VITE_API_BASE_URL}${path}`

const employee = {
  id: 'baac08e5-eaef-46f0-ac9e-f8b7266c71e0',
  createdAt: '2026-10-15T14:13:43.757Z',
  updatedAt: '2026-10-15T14:13:43.757Z',
  isActive: true,
  emailId: 'jane.doe@saajha.org',
  name: 'Jane Doe',
  role: 'MANAGER',
  teamId: null,
}

function captureAuthHeader() {
  const seen: { authorization: string | null } = { authorization: null }
  server.use(
    http.get(api('/auth/me'), ({ request }) => {
      seen.authorization = request.headers.get('authorization')
      return HttpResponse.json({ data: employee })
    }),
  )
  return seen
}

describe('authMiddleware', () => {
  it('sends the stored token as a bearer token', async () => {
    const seen = captureAuthHeader()
    setSession({ accessToken: 'token-123', expiresIn: 3600 })

    const result = await unwrap(apiClient.GET('/auth/me'))

    expect(seen.authorization).toBe('Bearer token-123')
    expect(result.data.emailId).toBe('jane.doe@saajha.org')
  })

  it('sends no Authorization header without a token', async () => {
    const seen = captureAuthHeader()

    await unwrap(apiClient.GET('/auth/me'))

    expect(seen.authorization).toBeNull()
  })

  it('drops an expired token instead of sending it', async () => {
    const seen = captureAuthHeader()
    localStorage.setItem('flowdesk.session', JSON.stringify({ accessToken: 'old', expiresAt: Date.now() - 1000 }))

    await unwrap(apiClient.GET('/auth/me'))

    expect(seen.authorization).toBeNull()
    expect(localStorage.getItem('flowdesk.session')).toBeNull()
  })

  it('reports a 401 from a protected endpoint once and still rejects', async () => {
    server.use(
      http.get(api('/auth/me'), () =>
        HttpResponse.json({ error: 'Invalid or expired access token', code: 'INVALID_AUTH_TOKEN' }, { status: 401 }),
      ),
    )
    const listener = vi.fn()
    const unsubscribe = onUnauthorized(listener)

    const error = await unwrap(apiClient.GET('/auth/me')).catch((e: unknown) => e)
    unsubscribe()

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'INVALID_AUTH_TOKEN' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not report a 401 from POST /auth/google', async () => {
    server.use(
      http.post(api('/auth/google'), () =>
        HttpResponse.json({ error: 'Invalid Google ID token', code: 'INVALID_GOOGLE_TOKEN' }, { status: 401 }),
      ),
    )
    const listener = vi.fn()
    const unsubscribe = onUnauthorized(listener)

    const error = await unwrap(apiClient.POST('/auth/google', { body: { idToken: 'bad' } })).catch((e: unknown) => e)
    unsubscribe()

    expect(error).toMatchObject({ status: 401, code: 'INVALID_GOOGLE_TOKEN' })
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('unwrap', () => {
  it('turns a validation 400 into fieldErrors', async () => {
    server.use(
      http.post(api('/invites'), () =>
        HttpResponse.json(
          { error: 'Validation failed', details: [{ path: 'email', message: 'Invalid email address' }] },
          { status: 400 },
        ),
      ),
    )

    const error = await unwrap(
      apiClient.POST('/invites', { body: { email: 'nope', name: 'Jane Doe', role: 'MEMBER' } }),
    ).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).fieldErrors).toEqual({ email: 'Invalid email address' })
  })

  it('turns a network failure into NETWORK_ERROR', async () => {
    server.use(http.get(api('/health-check'), () => HttpResponse.error()))

    const error = await unwrap(apiClient.GET('/health-check')).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })

  it('resolves a 204 to undefined', async () => {
    server.use(http.delete(api('/teams/:teamId'), () => new HttpResponse(null, { status: 204 })))

    const result = await unwrap(
      apiClient.DELETE('/teams/{teamId}', { params: { path: { teamId: '5b1f6a3e-8c1d-4f8e-9a51-2a7c3d9e0b14' } } }),
    )

    expect(result).toBeUndefined()
  })

  it('lets an AbortError through untouched', async () => {
    server.use(http.get(api('/health-check'), () => HttpResponse.json({ status: 'ok', dbTime: '2026-10-18T00:00:00.000Z' })))
    const controller = new AbortController()
    controller.abort()

    const error = await unwrap(apiClient.GET('/health-check', { signal: controller.signal })).catch((e: unknown) => e)

    expect(error).not.toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ name: 'AbortError' })
  })
})
