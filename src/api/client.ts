import createClient, { type Middleware } from 'openapi-fetch'
import { getAccessToken } from '@/auth/tokenStorage'
import { env } from '@/config/env'
import { emitUnauthorized } from './authEvents'
import { ApiError, toApiError } from './errors'
import type { paths } from './schema'

// 401s from these endpoints are login errors to show on the page, not an expired session.
const UNAUTHORIZED_EXEMPT_PATHS = new Set<string>(['/auth/google'])

export const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = getAccessToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  onResponse({ response, schemaPath }) {
    // Report only; the caller still gets its 401 ApiError from unwrap().
    if (response.status === 401 && !UNAUTHORIZED_EXEMPT_PATHS.has(schemaPath)) emitUnauthorized()
    return response
  },
}

export const apiClient = createClient<paths>({
  baseUrl: env.VITE_API_BASE_URL,
  // Look fetch up per request instead of capturing it at startup, so anything that wraps
  // globalThis.fetch later (MSW in tests) still sees the calls.
  fetch: (request) => globalThis.fetch(request),
})

apiClient.use(authMiddleware)

interface FetchResult<T> {
  data?: T
  error?: unknown
  response: Response
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

// The only way feature code reads an API result: returns `data` on 2xx (undefined for 204),
// throws ApiError otherwise. AbortError passes through so TanStack Query can cancel.
export async function unwrap<T>(promise: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>
  try {
    result = await promise
  } catch (cause) {
    if (isAbortError(cause)) throw cause
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR' }, { cause })
  }

  if (result.response.ok) return result.data as T
  throw toApiError(result.response.status, result.error)
}
