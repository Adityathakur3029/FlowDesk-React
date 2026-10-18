import { createContext } from 'react'
import type { Employee, LoginResult } from './types'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error'

export interface AuthState {
  status: AuthStatus
  // Set only when status is 'authenticated'.
  employee: Employee | null
  // The /auth/me failure when status is 'error' (network or 5xx; a 401 ends the session instead).
  error: unknown
  retrying: boolean
  // True after the session ran out or a 401; cleared by the next sign-in or sign-out.
  sessionExpired: boolean
  signIn(result: LoginResult): void
  signOut(): void
  retry(): void
}

export const AuthContext = createContext<AuthState | null>(null)
