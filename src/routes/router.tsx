import { Navigate, Route, Routes } from 'react-router'
import { LoginPage } from '@/auth/LoginPage'
import { RequireAuth } from '@/auth/RequireAuth'
import { NotFoundState } from '@/components/feedback/NotFoundState'
import { AppShell } from '@/components/layout/AppShell'
import { PeoplePage } from '@/features/employees/pages/PeoplePage'
import { paths } from './paths'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.login} element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path={paths.home} element={<Navigate to={paths.people} replace />} />
          <Route path={paths.people} element={<PeoplePage />} />
          {/* Inside the shell: only /login and /invites/accept are public, so a signed-out typo goes to login first. */}
          <Route path="*" element={<NotFoundState />} />
        </Route>
      </Route>
    </Routes>
  )
}
