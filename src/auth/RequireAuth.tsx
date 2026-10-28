import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PageLoader } from '@/components/feedback/PageLoader'
import { Button } from '@/components/ui/button'
import { paths } from '@/routes/paths'
import { useAuth } from './useAuth'

// UX guard: protected content renders only for a revalidated session. The backend still checks every request.
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { status, error, retry, retrying, signOut, signedOut } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <PageLoader fullScreen label="Checking your session…" />

  if (status === 'error') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center">
        <ErrorState error={error} title="Couldn't check your session" onRetry={retry} retrying={retrying} />
        <Button type="button" variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    const from = location.pathname + location.search + location.hash
    // A deliberate sign-out isn't an interruption, so there's nothing to return to.
    const to = signedOut || from === paths.home ? paths.login : `${paths.login}?redirect=${encodeURIComponent(from)}`
    return <Navigate to={to} replace />
  }

  return children ?? <Outlet />
}
