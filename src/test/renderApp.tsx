import { useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, useLocation, type Location } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { setSession } from '@/auth/tokenStorage'
import type { Employee, Role } from '@/auth/types'
import { Toaster } from '@/components/ui/sonner'
import { env } from '@/config/env'
import { AppRoutes } from '@/routes/router'
import { server } from './server'

export const api = (path: string) => `${env.VITE_API_BASE_URL}${path}`

// The contract's Employee example.
export const janeDoe: Employee = {
  id: 'baac08e5-eaef-46f0-ac9e-f8b7266c71e0',
  createdAt: '2026-10-15T14:13:43.757Z',
  updatedAt: '2026-10-15T14:13:43.757Z',
  isActive: true,
  emailId: 'jane.doe@saajha.org',
  name: 'Jane Doe',
  role: 'MANAGER',
  teamId: null,
}

const location: { current?: Location } = {}
function LocationSpy() {
  const current = useLocation()
  useEffect(() => {
    location.current = current
  }, [current])
  return null
}

export const currentUrl = () => `${location.current?.pathname}${location.current?.search}`

interface RenderSignedInOptions {
  role?: Role
  routes?: ReactNode
}

// Renders the app with a stored token and /auth/me answering as Jane Doe with the given role.
export function renderSignedIn(path: string, { role = 'MANAGER', routes = <AppRoutes /> }: RenderSignedInOptions = {}) {
  server.use(http.get(api('/auth/me'), () => HttpResponse.json({ data: { ...janeDoe, role } })))
  setSession({ accessToken: 'stored-token', expiresIn: 3600 })
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
      <Toaster />
    </QueryClientProvider>,
  )
  return { queryClient }
}
