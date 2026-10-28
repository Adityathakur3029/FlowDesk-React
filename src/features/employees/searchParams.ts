import type { EmployeeListParams, EmployeeRole } from './types'

export const EMPLOYEE_PAGE_SIZE = 20

const ROLES: readonly EmployeeRole[] = ['ADMIN', 'MANAGER', 'MEMBER']

// The two shapes GET /employees accepts for teamId: a team's UUID, or `none` for people without a team.
const TEAM_ID_PATTERN = /^(none|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export interface EmployeeSearch {
  role?: EmployeeRole
  teamId?: string
  includeInactive: boolean
  offset: number
}

export const DEFAULT_EMPLOYEE_SEARCH: EmployeeSearch = { includeInactive: false, offset: 0 }

// URL hygiene only: an invalid or hand-edited value falls back to its default instead of producing a 400.
export function parseEmployeeSearch(params: URLSearchParams): EmployeeSearch {
  const role = params.get('role')
  const teamId = params.get('teamId')
  const offset = params.get('offset')
  return {
    role: ROLES.find((r) => r === role),
    teamId: teamId !== null && TEAM_ID_PATTERN.test(teamId) ? teamId : undefined,
    includeInactive: params.get('includeInactive') === 'true',
    offset: offset !== null && /^\d+$/.test(offset) ? Number(offset) : 0,
  }
}

// Defaults are left out, so the URL only shows what the user changed.
export function toEmployeeSearchParams(search: EmployeeSearch): URLSearchParams {
  const params = new URLSearchParams()
  if (search.role) params.set('role', search.role)
  if (search.teamId) params.set('teamId', search.teamId)
  if (search.includeInactive) params.set('includeInactive', 'true')
  if (search.offset > 0) params.set('offset', String(search.offset))
  return params
}

export function toEmployeeListParams(search: EmployeeSearch): EmployeeListParams {
  return {
    ...(search.role && { role: search.role }),
    ...(search.teamId && { teamId: search.teamId }),
    ...(search.includeInactive && { includeInactive: 'true' }),
    limit: EMPLOYEE_PAGE_SIZE,
    offset: search.offset,
  }
}

export const hasEmployeeFilters = (search: EmployeeSearch) =>
  search.role !== undefined || search.teamId !== undefined || search.includeInactive
