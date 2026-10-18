import type { EmployeeListParams, EmployeeRole } from './types'

export const EMPLOYEE_PAGE_SIZE = 20

const ROLES: readonly EmployeeRole[] = ['ADMIN', 'MANAGER', 'MEMBER']

export interface EmployeeSearch {
  role?: EmployeeRole
  includeInactive: boolean
  offset: number
}

// URL hygiene only: an invalid or hand-edited value falls back to its default instead of producing a 400.
export function parseEmployeeSearch(params: URLSearchParams): EmployeeSearch {
  const role = params.get('role')
  const offset = params.get('offset')
  return {
    role: ROLES.find((r) => r === role),
    includeInactive: params.get('includeInactive') === 'true',
    offset: offset !== null && /^\d+$/.test(offset) ? Number(offset) : 0,
  }
}

// Defaults are left out, so the URL only shows what the user changed.
export function toEmployeeSearchParams(search: EmployeeSearch): URLSearchParams {
  const params = new URLSearchParams()
  if (search.role) params.set('role', search.role)
  if (search.includeInactive) params.set('includeInactive', 'true')
  if (search.offset > 0) params.set('offset', String(search.offset))
  return params
}

export function toEmployeeListParams(search: EmployeeSearch): EmployeeListParams {
  return {
    ...(search.role && { role: search.role }),
    ...(search.includeInactive && { includeInactive: 'true' }),
    limit: EMPLOYEE_PAGE_SIZE,
    offset: search.offset,
  }
}

export const hasEmployeeFilters = (search: EmployeeSearch) => search.role !== undefined || search.includeInactive
