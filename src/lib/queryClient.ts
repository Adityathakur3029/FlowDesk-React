import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/errors'

const MAX_QUERY_RETRIES = 2

// 4xx gives the same answer every time, so never retry it. Network (0) and 5xx get two more tries.
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false
  return failureCount < MAX_QUERY_RETRIES
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    // Never retry writes: a retried POST /invites sends a second email and revokes the first invite.
    mutations: { retry: false },
  },
})
