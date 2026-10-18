import type { ReactNode } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { Shield, Users } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from '@/auth/LoginPage'
import { RequireAuth } from '@/auth/RequireAuth'
import { api, currentUrl, janeDoe, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'
import { AppShell } from './AppShell'
import type { NavItem } from './navItems'

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: ReactNode }) => children,
  GoogleLogin: () => <button type="button">Mock Google</button>,
  googleLogout: vi.fn(),
}))

beforeEach(() => {
  server.use(http.get(api('/employees'), () => HttpResponse.json({ data: [janeDoe], meta: { total: 1, limit: 20, offset: 0 } })))
})

function Crash(): never {
  throw new Error('boom')
}

const testNav: NavItem[] = [
  { label: 'People', to: '/people', icon: Users },
  { label: 'Admin area', to: '/admin', icon: Shield, roles: ['ADMIN'] },
]

// A shell with a test-only nav list and a page that crashes while rendering.
const testRoutes = (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<RequireAuth />}>
      <Route element={<AppShell navItems={testNav} />}>
        <Route path="/people" element={<h1>People page</h1>} />
        <Route path="/admin" element={<Crash />} />
      </Route>
    </Route>
  </Routes>
)

const mainNav = () => within(screen.getByRole('navigation', { name: 'Main' }))

describe('AppShell', () => {
  it('sends / to /people and marks People as the current page', async () => {
    renderSignedIn('/')
    expect(await screen.findByRole('heading', { name: 'People' })).toBeInTheDocument()
    expect(currentUrl()).toBe('/people')
    expect(mainNav().getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page')
  })

  it.each([
    ['MEMBER', false],
    ['ADMIN', true],
  ] as const)('as %s, a nav item limited to ADMIN is shown: %s', async (role, shown) => {
    renderSignedIn('/people', { role, routes: testRoutes })
    await screen.findByRole('heading', { name: 'People page' })
    expect(mainNav().queryByRole('link', { name: 'Admin area' }) !== null).toBe(shown)
  })

  it('shows who is signed in and signs out from the user menu', async () => {
    renderSignedIn('/people')
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu for Jane Doe' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Jane Doe')).toBeInTheDocument()
    expect(within(menu).getByText('jane.doe@saajha.org')).toBeInTheDocument()
    expect(within(menu).getByText('Manager')).toBeInTheDocument()

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))
    expect(await screen.findByRole('button', { name: 'Mock Google' })).toBeInTheDocument()
    expect(currentUrl()).toBe('/login')
    expect(localStorage.length).toBe(0)
  })

  it('shows the 404 inside the shell for an unknown path', async () => {
    renderSignedIn('/typo')
    expect(await screen.findByText('Page not found')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  })

  it('contains a crashing page and recovers on navigation', async () => {
    // React reports the caught error to the console; keep the test output clean.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderSignedIn('/admin', { role: 'ADMIN', routes: testRoutes })
    expect(await screen.findByText('This page crashed')).toBeInTheDocument()

    await userEvent.click(mainNav().getByRole('link', { name: 'People' }))
    expect(await screen.findByRole('heading', { name: 'People page' })).toBeInTheDocument()
    expect(screen.queryByText('This page crashed')).not.toBeInTheDocument()
    consoleError.mockRestore()
  })
})
