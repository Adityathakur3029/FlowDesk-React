import { useState } from 'react'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { AlertCircle, Clock, Loader2 } from 'lucide-react'
import { Navigate, useSearchParams } from 'react-router'
import { ApiError, getErrorMessage, isApiError } from '@/api/errors'
import { SaajhaLogo } from '@/components/brand/SaajhaLogo'
import { PageLoader } from '@/components/feedback/PageLoader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { env } from '@/config/env'
import { useSignInWithGoogle } from './api'
import { safeRedirect } from './redirect'
import { useAuth } from './useAuth'

const GOOGLE_FAILED_MESSAGE = getErrorMessage(new ApiError({ status: 401, code: 'INVALID_GOOGLE_TOKEN' }))
const SCRIPT_FAILED_MESSAGE =
  "Couldn't load Google sign-in. Check your connection or disable content blockers for this site, then reload."

function loginErrorMessage(error: unknown): string {
  // A 400 without a code means the credential was empty or missing, which is a failed Google sign-in.
  if (isApiError(error) && error.status === 400 && !error.code) return GOOGLE_FAILED_MESSAGE
  return getErrorMessage(error)
}

export function LoginPage() {
  const { status, sessionExpired, signIn } = useAuth()
  const [searchParams] = useSearchParams()
  const signInWithGoogle = useSignInWithGoogle()
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [scriptFailed, setScriptFailed] = useState(false)

  // A stored token is being checked; don't flash the sign-in form.
  if (status === 'loading') return <PageLoader fullScreen label="Checking your session…" />
  // Also how a successful sign-in leaves this page.
  if (status === 'authenticated') return <Navigate to={safeRedirect(searchParams.get('redirect'))} replace />

  function handleCredential(credential: string | undefined) {
    setGoogleError(null)
    if (!credential) {
      setGoogleError(GOOGLE_FAILED_MESSAGE)
      return
    }
    signInWithGoogle.mutate(credential, { onSuccess: signIn })
  }

  const errorMessage =
    (scriptFailed ? SCRIPT_FAILED_MESSAGE : null) ??
    googleError ??
    (signInWithGoogle.isError ? loginErrorMessage(signInWithGoogle.error) : null)
  const pending = signInWithGoogle.isPending

  return (
    <main className="flex min-h-svh items-center justify-center bg-brand/5 p-4">
      <Card className="w-full max-w-sm border-t-4 border-t-brand">
        <CardHeader className="items-center text-center">
          <SaajhaLogo size={64} className="mx-auto mb-2" />
          <CardTitle>
            <h1 className="text-xl font-semibold">Sign in to FlowDesk</h1>
          </CardTitle>
          <CardDescription>Use your @saajha.org Google account.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : (
            sessionExpired && (
              <Alert>
                <Clock aria-hidden="true" />
                <AlertDescription>Your session has expired. Sign in again.</AlertDescription>
              </Alert>
            )
          )}

          {pending ? (
            <div role="status" aria-live="polite" className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
              Signing you in…
            </div>
          ) : (
            // Google's button can't be disabled, so it's removed while a sign-in is pending.
            <GoogleOAuthProvider clientId={env.VITE_GOOGLE_CLIENT_ID} onScriptLoadError={() => setScriptFailed(true)}>
              <div className="flex min-h-10 justify-center">
                <GoogleLogin
                  onSuccess={({ credential }) => handleCredential(credential)}
                  onError={() => setGoogleError(GOOGLE_FAILED_MESSAGE)}
                  text="signin_with"
                  shape="pill"
                  theme="outline"
                  size="large"
                  width={320}
                />
              </div>
            </GoogleOAuthProvider>
          )}
        </CardContent>

        <p className="pb-4 text-center text-xs text-muted-foreground">Saajha · FlowDesk</p>
      </Card>
    </main>
  )
}
