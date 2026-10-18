import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { ApiError } from '@/api/errors'
import { employeeKeys, type Employee } from '@/features/employees'
import type { CreateTeamRequest, Team, TeamList, TeamListParams } from './types'

export const teamKeys = {
  all: ['teams'] as const,
  lists: () => [...teamKeys.all, 'list'] as const,
  list: (params: TeamListParams) => [...teamKeys.lists(), params] as const,
  directory: () => [...teamKeys.all, 'directory'] as const,
}

const DIRECTORY_PAGE_SIZE = 100 // GET /teams maximum

// Member counts and employees' teamId both change when someone joins or leaves a team.
export function invalidateMembership(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: teamKeys.all }),
    queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
  ])
}

// GET /teams: one page of active teams, sorted by name, each with its memberCount.
export function fetchTeams(params: TeamListParams, signal?: AbortSignal): Promise<TeamList> {
  return unwrap(apiClient.GET('/teams', { params: { query: params }, signal }))
}

export function useTeams(params: TeamListParams) {
  return useQuery({
    queryKey: teamKeys.list(params),
    queryFn: ({ signal }) => fetchTeams(params, signal),
    placeholderData: keepPreviousData,
  })
}

export interface TeamDirectory {
  teams: Team[]
  byId: ReadonlyMap<string, Team>
}

// Every active team, for turning an employee's teamId into a name. Employee only carries the id
// (spec 06, contract note 1), and teams are few, so this follows pages of 100 until meta.total.
async function fetchAllTeams(signal?: AbortSignal): Promise<Team[]> {
  const teams: Team[] = []
  for (;;) {
    const page = await fetchTeams({ limit: DIRECTORY_PAGE_SIZE, offset: teams.length }, signal)
    teams.push(...page.data)
    if (page.data.length === 0 || teams.length >= page.meta.total) return teams
  }
}

export function useTeamDirectory() {
  return useQuery({
    queryKey: teamKeys.directory(),
    queryFn: ({ signal }) => fetchAllTeams(signal),
    select: (teams): TeamDirectory => ({ teams, byId: new Map(teams.map((team) => [team.id, team])) }),
  })
}

function addMember(teamId: string, employeeId: string) {
  return unwrap(apiClient.PUT('/teams/{teamId}/members/{employeeId}', { params: { path: { teamId, employeeId } } }))
}

export interface CreateTeamInput {
  body: CreateTeamRequest
  members: readonly Employee[]
}

export interface CreateTeamResult {
  team: Team
  added: number
  failed: { employee: Employee; error: unknown }[]
}

// The API has no "create with members": POST /teams makes an empty team, then one PUT per member.
// A failed POST throws (nothing was created). Failed PUTs don't: the team exists, so they're reported.
export function useCreateTeamWithMembers() {
  const queryClient = useQueryClient()
  return useMutation<CreateTeamResult, ApiError, CreateTeamInput>({
    mutationFn: async ({ body, members }) => {
      const { data: team } = await unwrap(apiClient.POST('/teams', { body }))
      const results = await Promise.allSettled(members.map((member) => addMember(team.id, member.id)))
      const failed = members.flatMap((employee, i) => {
        const result = results[i]
        return result.status === 'rejected' ? [{ employee, error: result.reason as unknown }] : []
      })
      return { team, added: members.length - failed.length, failed }
    },
    onSettled: () => invalidateMembership(queryClient),
  })
}

export interface SetEmployeeTeamInput {
  employeeId: string
  fromTeamId: string | null
  toTeamId: string | null
}

// Moves an employee: PUT into the new team (which also takes them out of the old one), or DELETE
// from the old team when the new one is "No team". ADMIN or MANAGER.
export function useSetEmployeeTeam() {
  const queryClient = useQueryClient()
  return useMutation<void, ApiError, SetEmployeeTeamInput>({
    mutationFn: async ({ employeeId, fromTeamId, toTeamId }) => {
      if (toTeamId !== null) {
        await addMember(toTeamId, employeeId)
      } else if (fromTeamId !== null) {
        await unwrap(
          apiClient.DELETE('/teams/{teamId}/members/{employeeId}', {
            params: { path: { teamId: fromTeamId, employeeId } },
          }),
        )
      }
    },
    onSettled: () => invalidateMembership(queryClient),
  })
}
