import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { googleLogout } from '@react-oauth/google'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { onUnauthorized } from '@/api/authEvents'
import { isApiError } from '@/api/errors'
import { authKeys, fetchMe } from './api'
import { AuthContext, type AuthState, type AuthStatus } from './authContext'
import { clearSession, readSession, setSession } from './tokenStorage'
import type { LoginResult } from './types'

// setTimeout's maximum delay (~24.8 days); tokens last 8 hours, so this never cuts one short.
const MAX_TIMEOUT_MS = 2_147_483_647

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const [initial] = useState(readSession)
  const [hasSession, setHasSession] = useState(initial.state === 'valid')
  const [expiresAt, setExpiresAt] = useState(initial.state === 'valid' ? initial.expiresAt : null)
  const [sessionExpired, setSessionExpired] = useState(initial.state === 'expired')
  const [signedOut, setSignedOut] = useState(false)
  const hasSessionRef = useRef(hasSession)

  // Revalidate a stored token and get the current role. The employee is never read from storage.
  const me = useQuery({
    queryKey: authKeys.me(),
    queryFn: ({ signal }) => fetchMe(signal),
    enabled: hasSession,
    staleTime: Infinity,
  })

  const endSession = useCallback(
    (expired: boolean) => {
      const hadSession = hasSessionRef.current
      hasSessionRef.current = false
      clearSession()
      queryClient.clear()
      setHasSession(false)
      setExpiresAt(null)
      setSignedOut(!expired)
      // A stray 401 while already signed out shouldn't announce an expired session.
      if (!expired) setSessionExpired(false)
      else if (hadSession) setSessionExpired(true)
    },
    [queryClient],
  )

  // Any 401 except POST /auth/google (exempted in the client middleware) ends the session.
  // RequireAuth then redirects to /login with the current location.
  useEffect(() => onUnauthorized(() => endSession(true)), [endSession])

  useEffect(() => {
    if (expiresAt === null) return
    const delay = Math.min(Math.max(expiresAt - Date.now(), 0), MAX_TIMEOUT_MS)
    const timer = setTimeout(() => endSession(true), delay)
    return () => clearTimeout(timer)
  }, [expiresAt, endSession])

  const signIn = useCallback(
    (result: LoginResult) => {
      const sessionExpiresAt = setSession({ accessToken: result.accessToken, expiresIn: result.expiresIn })
      // The login response's employee is current, so seed the cache instead of calling /auth/me again.
      queryClient.setQueryData(authKeys.me(), result.employee)
      hasSessionRef.current = true
      setHasSession(true)
      setExpiresAt(sessionExpiresAt)
      setSessionExpired(false)
      setSignedOut(false)
    },
    [queryClient],
  )

  // The backend has no logout endpoint: forgetting the token is the whole sign-out. RequireAuth then
  // sends the user to /login. Navigating here as well would race it: React Router runs navigate() as a
  // transition, so RequireAuth renders first with the old location and adds ?redirect=.
  const signOut = useCallback(() => {
    endSession(false)
    googleLogout()
  }, [endSession])

  const { refetch } = me
  const retry = useCallback(() => {
    void refetch()
  }, [refetch])

  let status: AuthStatus
  if (!hasSession) status = 'unauthenticated'
  else if (me.data) status = 'authenticated'
  else if (me.isError && !(isApiError(me.error) && me.error.status === 401)) status = 'error'
  else status = 'loading'

  const value = useMemo<AuthState>(
    () => ({
      status,
      employee: status === 'authenticated' ? (me.data ?? null) : null,
      error: status === 'error' ? me.error : null,
      retrying: me.isFetching,
      sessionExpired,
      signedOut,
      signIn,
      signOut,
      retry,
    }),
    [status, me.data, me.error, me.isFetching, sessionExpired, signedOut, signIn, signOut, retry],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
