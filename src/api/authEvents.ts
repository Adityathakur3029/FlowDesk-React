type Listener = () => void

const unauthorizedListeners = new Set<Listener>()

// Subscribe to "the backend rejected our token" (any 401 except POST /auth/google).
// Returns an unsubscribe function.
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener)
  return () => {
    unauthorizedListeners.delete(listener)
  }
}

export function emitUnauthorized(): void {
  for (const listener of [...unauthorizedListeners]) {
    try {
      listener()
    } catch (error) {
      console.error('onUnauthorized listener failed', error)
    }
  }
}
