import type { ReactNode } from 'react'
import { Outlet } from 'react-router'
import { ForbiddenState } from '@/components/feedback/ForbiddenState'
import type { Role } from './types'
import { useHasRole } from './useAuth'

interface RequireRoleProps {
  roles: readonly Role[]
  children?: ReactNode
  fallback?: ReactNode
}

// UX only, inside RequireAuth. The role comes from /auth/me (or the login response), never the JWT.
export function RequireRole({ roles, children, fallback }: RequireRoleProps) {
  const allowed = useHasRole(roles)
  if (!allowed) return fallback ?? <ForbiddenState />
  return children ?? <Outlet />
}
