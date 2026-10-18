import { useMutation } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { ApiError } from '@/api/errors'
import type { CreateInviteRequest, EmployeeInvite } from './types'

// No invite queries exist yet (the API has no GET /invites); kept so later specs have one key root.
export const inviteKeys = { all: ['invites'] as const }

// POST /invites: records the invite and emails the link. Nothing to invalidate: an invite doesn't
// create an employee until it's accepted.
export function useCreateInvite() {
  return useMutation<EmployeeInvite, ApiError, CreateInviteRequest>({
    mutationFn: async (body) => {
      const result = await unwrap(apiClient.POST('/invites', { body }))
      return result.data
    },
  })
}
