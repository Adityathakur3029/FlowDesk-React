import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { ApiError } from '@/api/errors'
import type { Employee, EmployeeList, EmployeeListParams, UpdateEmployeeRequest } from './types'

export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (params: EmployeeListParams) => [...employeeKeys.lists(), params] as const,
}

// Pickers ask for more than they show, so already-picked people can be hidden without emptying the list.
export const EMPLOYEE_SEARCH_LIMIT = 20

// GET /employees: one page of employees plus pagination meta. Newest first, or best match first with `q`.
export function fetchEmployees(params: EmployeeListParams, signal?: AbortSignal): Promise<EmployeeList> {
  return unwrap(apiClient.GET('/employees', { params: { query: params }, signal }))
}

export function useEmployees(params: EmployeeListParams) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: ({ signal }) => fetchEmployees(params, signal),
    // Keep the current page on screen while the next page or filter loads.
    placeholderData: keepPreviousData,
  })
}

// Type-ahead search for pickers. `q` must already be trimmed; an empty `q` sends nothing.
export function useEmployeeSearch(q: string) {
  const params: EmployeeListParams = { q, limit: EMPLOYEE_SEARCH_LIMIT }
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: ({ signal }) => fetchEmployees(params, signal),
    enabled: q !== '',
    placeholderData: keepPreviousData,
  })
}

// PATCH /employees/{id}: ADMIN only. Callers invalidate, since a save may also change the team.
export function useUpdateEmployee() {
  return useMutation<Employee, ApiError, { id: string; body: UpdateEmployeeRequest }>({
    mutationFn: async ({ id, body }) => {
      const result = await unwrap(apiClient.PATCH('/employees/{id}', { params: { path: { id } }, body }))
      return result.data
    },
  })
}
