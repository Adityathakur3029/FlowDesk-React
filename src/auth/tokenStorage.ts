// Storage for the FlowDesk access token. Login itself lives in the auth feature (spec 03).
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
export function setSession({ accessToken, expiresIn }: { accessToken: string; expiresIn: number }): void {
  const session: StoredSession = { accessToken, expiresAt: Date.now() + expiresIn * 1000 }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Storage unavailable: the session lasts only until the next 401.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // Nothing stored if storage is unavailable.
  }
}

// Returns the token, or null (clearing the key) when it's missing, corrupt or expired.
export function getAccessToken(): string | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
  if (raw === null) return null

  let session: unknown
  try {
    session = JSON.parse(raw)
  } catch {
    session = null
  }

  if (!isStoredSession(session) || session.expiresAt <= Date.now()) {
    clearSession()
    return null
  }
  return session.accessToken
}
