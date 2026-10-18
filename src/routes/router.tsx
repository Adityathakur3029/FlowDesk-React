import { Route, Routes } from 'react-router'
import { LoginPage } from '@/auth/LoginPage'
import { RequireAuth } from '@/auth/RequireAuth'
import { NotFoundState } from '@/components/feedback/NotFoundState'
import { HomePage } from './HomePage'
import { paths } from './paths'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.login} element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path={paths.home} element={<HomePage />} />
      </Route>
      {/* Public, so a mistyped URL doesn't force a sign-in. */}
      <Route
        path="*"
        element={
          <main className="flex min-h-svh items-center justify-center">
            <NotFoundState />
          </main>
        }
      />
    </Routes>
  )
}
