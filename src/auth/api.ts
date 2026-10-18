import { useMutation } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { ApiError } from '@/api/errors'
import type { Employee, LoginResult } from './types'

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
}

// GET /auth/me: the employee behind the stored token, re-read by the backend so the role is current.
export async function fetchMe(signal?: AbortSignal): Promise<Employee> {
  const body = await unwrap(apiClient.GET('/auth/me', { signal }))
  return body.data
}

// POST /auth/google: exchanges a Google ID token for a FlowDesk session. Storing the result
// is AuthProvider.signIn's job, so this hook only makes the request.
export function useSignInWithGoogle() {
  return useMutation<LoginResult, ApiError, string>({
    mutationFn: async (idToken) => {
      const body = await unwrap(apiClient.POST('/auth/google', { body: { idToken } }))
      return body.data
    },
  })
}
