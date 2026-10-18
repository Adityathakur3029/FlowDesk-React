import { useContext } from 'react'
import { AuthContext, type AuthState } from './authContext'
import type { Role } from './types'

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}

// UX only: hides or disables what the role can't do. The backend still enforces, so 403s are handled anyway.
export function useHasRole(roles: readonly Role[]): boolean {
  const { status, employee } = useAuth()
  return status === 'authenticated' && employee !== null && roles.includes(employee.role)
}
