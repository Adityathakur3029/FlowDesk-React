import { useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation, type Location } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '@/config/env'
import { HomePage } from '@/routes/HomePage'
import { AppRoutes } from '@/routes/router'
import { server } from '@/test/server'
import { AuthProvider } from './AuthProvider'
import { LoginPage } from './LoginPage'
import { RequireAuth } from './RequireAuth'
import { RequireRole } from './RequireRole'
import { setSession } from './tokenStorage'

const { googleLogout } = vi.hoisted(() => ({ googleLogout: vi.fn() }))

// Google Identity Services can't run in jsdom: the mock button hands back a fixed credential.
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: ReactNode }) => children,
  GoogleLogin: ({ onSuccess }: { onSuccess: (response: { credential?: string }) => void }) => (
    <button type="button" onClick={() => onSuccess({ credential: 'google-id-token' })}>
      Mock Google
    </button>
  ),
  googleLogout,
}))

const api = (path: string) => `${env.VITE_API_BASE_URL}${path}`
const SESSION_KEY = 'flowdesk.session'

const employee = {
  id: 'baac08e5-eaef-46f0-ac9e-f8b7266c71e0',
  createdAt: '2026-10-15T14:13:43.757Z',
  updatedAt: '2026-10-15T14:13:43.757Z',
  isActive: true,
  emailId: 'jane.doe@saajha.org',
  name: 'Jane Doe',
  role: 'MANAGER',
  teamId: null,
} as const

const loginResponse = {
  data: { accessToken: 'flowdesk-token', tokenType: 'Bearer', expiresIn: 28800, employee },
}

const location: { current?: Location } = {}
function LocationSpy() {
  const current = useLocation()
  useEffect(() => {
    location.current = current
  }, [current])
  return null
}

function renderWithProviders(path: string, routes: ReactNode) {
  // Same defaults as the app, minus retries so error cases settle immediately.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          {routes}
          <LocationSpy />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { queryClient }
}

const renderApp = (path: string) => renderWithProviders(path, <AppRoutes />)

// A protected route tree with more paths than the app has today.
const renderGuarded = (path: string) =>
  renderWithProviders(
    path,
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/teams" element={<p>Teams page</p>} />
        <Route element={<RequireRole roles={['ADMIN']} />}>
          <Route path="/admin" element={<p>Admin page</p>} />
        </Route>
      </Route>
    </Routes>,
  )

const currentUrl = () => `${location.current?.pathname}${location.current?.search}`

beforeEach(() => {
  server.use(http.get(api('/health-check'), () => HttpResponse.json({ status: 'ok', dbTime: '2026-10-18T10:00:00.000Z' })))
})

afterEach(() => {
  googleLogout.mockClear()
})

describe('RequireAuth', () => {
  it('sends a signed-out visitor at / to /login without a redirect param', async () => {
    renderApp('/')
    expect(await screen.findByRole('button', { name: 'Mock Google' })).toBeInTheDocument()
    expect(currentUrl()).toBe('/login')
    expect(screen.queryByText(/session has expired/)).not.toBeInTheDocument()
  })

  it('keeps the requested location in ?redirect=', async () => {
    renderGuarded('/teams?x=1')
    await screen.findByRole('button', { name: 'Mock Google' })
    expect(currentUrl()).toBe('/login?redirect=%2Fteams%3Fx%3D1')
  })

  it('revalidates a stored token with /auth/me before rendering', async () => {
    let authorization: string | null = null
    server.use(
      http.get(api('/auth/me'), ({ request }) => {
        authorization = request.headers.get('authorization')
        return HttpResponse.json({ data: employee })
      }),
    )
    setSession({ accessToken: 'stored-token', expiresIn: 3600 })

    renderApp('/')
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session…')
    expect(await screen.findByText('Welcome, Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('MANAGER')).toBeInTheDocument()
    expect(authorization).toBe('Bearer stored-token')
  })

  it('ends the session on a 401 from /auth/me', async () => {
    server.use(
      http.get(api('/auth/me'), () =>
        HttpResponse.json({ error: 'Invalid or expired access token', code: 'INVALID_AUTH_TOKEN' }, { status: 401 }),
      ),
    )
    setSession({ accessToken: 'revoked', expiresIn: 3600 })

    renderApp('/')
    expect(await screen.findByText('Your session has expired. Sign in again.')).toBeInTheDocument()
    expect(currentUrl()).toBe('/login')
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('shows the expired message without calling /auth/me when the stored token has expired', async () => {
    const me = vi.fn(() => HttpResponse.json({ data: employee }))
    server.use(http.get(api('/auth/me'), me))
    localStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: 'old', expiresAt: Date.now() - 1000 }))

    renderApp('/')
    expect(await screen.findByText('Your session has expired. Sign in again.')).toBeInTheDocument()
    expect(me).not.toHaveBeenCalled()
  })

  it('keeps the token when /auth/me fails with a 5xx, and retries', async () => {
    let fail = true
    server.use(
      http.get(api('/auth/me'), () =>
        fail
          ? HttpResponse.json({ error: 'Internal server error' }, { status: 500 })
          : HttpResponse.json({ data: employee }),
      ),
    )
    setSession({ accessToken: 'stored-token', expiresIn: 3600 })

    renderApp('/')
    expect(await screen.findByText("Couldn't check your session")).toBeInTheDocument()
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull()

    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Welcome, Jane Doe')).toBeInTheDocument()
  })

  it('ends the session when the token expires', async () => {
    server.use(http.get(api('/auth/me'), () => HttpResponse.json({ data: employee })))
    setSession({ accessToken: 'short-lived', expiresIn: 0.3 })

    renderApp('/')
    expect(await screen.findByText('Welcome, Jane Doe')).toBeInTheDocument()
    expect(await screen.findByText('Your session has expired. Sign in again.', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })
})

describe('LoginPage', () => {
  it('exchanges the Google credential and lands on home', async () => {
    let body: unknown
    server.use(
      http.post(api('/auth/google'), async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(loginResponse)
      }),
    )

    renderApp('/login')
    await userEvent.click(await screen.findByRole('button', { name: 'Mock Google' }))

    expect(await screen.findByText('Welcome, Jane Doe')).toBeInTheDocument()
    expect(body).toEqual({ idToken: 'google-id-token' })
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).accessToken).toBe('flowdesk-token')
    expect(currentUrl()).toBe('/')
  })

  it('returns to the ?redirect= path after sign-in', async () => {
    server.use(http.post(api('/auth/google'), () => HttpResponse.json(loginResponse)))
    renderGuarded('/login?redirect=%2Fteams')
    await userEvent.click(await screen.findByRole('button', { name: 'Mock Google' }))
    expect(await screen.findByText('Teams page')).toBeInTheDocument()
  })

  it('ignores an off-site redirect', async () => {
    server.use(http.post(api('/auth/google'), () => HttpResponse.json(loginResponse)))
    renderApp('/login?redirect=%2F%2Fevil.com')
    await userEvent.click(await screen.findByRole('button', { name: 'Mock Google' }))
    expect(await screen.findByText('Welcome, Jane Doe')).toBeInTheDocument()
    expect(currentUrl()).toBe('/')
  })

  it.each([
    [403, 'NOT_INVITED', "You haven't been invited to FlowDesk, or haven't accepted your invite yet."],
    [401, 'EMAIL_DOMAIN_NOT_ALLOWED', 'Sign in with your @saajha.org Google account.'],
    [403, 'ACCOUNT_INACTIVE', 'Your FlowDesk account has been deactivated.'],
    [502, 'GOOGLE_UNAVAILABLE', 'Google sign-in is temporarily unavailable. Try again shortly.'],
  ])('shows the message for %i %s and stays on /login', async (status, code, message) => {
    server.use(http.post(api('/auth/google'), () => HttpResponse.json({ error: 'x', code }, { status })))

    renderApp('/login')
    await userEvent.click(await screen.findByRole('button', { name: 'Mock Google' }))

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mock Google' })).toBeInTheDocument()
    expect(currentUrl()).toBe('/login')
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('replaces the Google button with a status while signing in', async () => {
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.post(api('/auth/google'), async () => {
        await released
        return HttpResponse.json(loginResponse)
      }),
    )

    renderApp('/login')
    await userEvent.click(await screen.findByRole('button', { name: 'Mock Google' }))

    expect(await screen.findByText('Signing you in…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mock Google' })).not.toBeInTheDocument()
    release()
    expect(await screen.findByText('Welcome, Jane Doe')).toBeInTheDocument()
  })

  it('redirects a signed-in user away from /login', async () => {
    server.use(http.get(api('/auth/me'), () => HttpResponse.json({ data: employee })))
    setSession({ accessToken: 'stored-token', expiresIn: 3600 })
    renderApp('/login')
    expect(await screen.findByText('Welcome, Jane Doe')).toBeInTheDocument()
    expect(currentUrl()).toBe('/')
  })
})

describe('signOut', () => {
  it('clears the session and cache and returns to /login without the expired message', async () => {
    server.use(http.get(api('/auth/me'), () => HttpResponse.json({ data: employee })))
    setSession({ accessToken: 'stored-token', expiresIn: 3600 })

    const { queryClient } = renderApp('/')
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('button', { name: 'Mock Google' })).toBeInTheDocument()
    expect(currentUrl()).toBe('/login')
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    // The mounted (now disabled) /auth/me observer re-registers an empty entry; no data may survive.
    expect(queryClient.getQueryCache().getAll().every((query) => query.state.data === undefined)).toBe(true)
    expect(googleLogout).toHaveBeenCalledOnce()
    expect(screen.queryByText(/session has expired/)).not.toBeInTheDocument()
  })
})

describe('RequireRole', () => {
  it.each([
    ['MEMBER', "You don't have access to this page"],
    ['ADMIN', 'Admin page'],
  ] as const)('as %s shows "%s"', async (role, text) => {
    server.use(http.get(api('/auth/me'), () => HttpResponse.json({ data: { ...employee, role } })))
    setSession({ accessToken: 'stored-token', expiresIn: 3600 })
    renderGuarded('/admin')
    expect(await screen.findByText(text)).toBeInTheDocument()
  })
})
