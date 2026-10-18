import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { EmployeeList, EmployeeListParams } from './types'

export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (params: EmployeeListParams) => [...employeeKeys.lists(), params] as const,
}

// GET /employees: one page of employees, newest first, plus pagination meta.
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
