// Storage for the FlowDesk access token. Session state lives in AuthProvider.
// Every localStorage access is guarded: blocked storage behaves as "no session". Never log tokens.

const SESSION_KEY = 'flowdesk.session'

interface StoredSession {
  accessToken: string
  expiresAt: number
}

function isStoredSession(value: unknown): value is StoredSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredSession).accessToken === 'string' &&
    (value as StoredSession).accessToken.length > 0 &&
    typeof (value as StoredSession).expiresAt === 'number'
  )
}

// `expiresIn` is in seconds, as returned by POST /auth/google (LoginResponse.data.expiresIn).
// Returns the computed expiresAt (epoch ms).
export function setSession({ accessToken, expiresIn }: { accessToken: string; expiresIn: number }): number {
  const session: StoredSession = { accessToken, expiresAt: Date.now() + expiresIn * 1000 }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Storage unavailable: the session lasts only until the next 401.
  }
  return session.expiresAt
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // Nothing stored if storage is unavailable.
  }
}

export type SessionRead =
  | { state: 'none' }
  | { state: 'expired' }
  | { state: 'valid'; accessToken: string; expiresAt: number }

// 'none': nothing usable stored (missing, corrupt, or storage blocked). 'expired': there was a
// session but its expiresAt has passed; the key is cleared. Lets the caller tell the two apart.
export function readSession(): SessionRead {
  let raw: string | null
  try {
    raw = localStorage.getItem(SESSION_KEY)
  } catch {
    return { state: 'none' }
  }
  if (raw === null) return { state: 'none' }

  let session: unknown
  try {
    session = JSON.parse(raw)
  } catch {
    session = null
  }

  if (!isStoredSession(session)) {
    clearSession()
    return { state: 'none' }
  }
  if (session.expiresAt <= Date.now()) {
    clearSession()
    return { state: 'expired' }
  }
  return { state: 'valid', accessToken: session.accessToken, expiresAt: session.expiresAt }
}

// Returns the token, or null (clearing the key) when it is missing, corrupt or expired.
export function getAccessToken(): string | null {
  const session = readSession()
  return session.state === 'valid' ? session.accessToken : null
}
