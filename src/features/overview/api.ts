import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { OverviewParams, OverviewReport } from './types'

export const overviewKeys = {
  all: ['overview'] as const,
  report: (params: OverviewParams) => [...overviewKeys.all, 'report', params] as const,
}

// GET /reports/overview: the organisation's numbers for a period, computed by the server on every request.
export async function fetchOverview(params: OverviewParams, signal?: AbortSignal): Promise<OverviewReport> {
  const { data } = await unwrap(apiClient.GET('/reports/overview', { params: { query: params }, signal }))
  return data
}

// The previous period's report stays on screen (dimmed) while the next one loads.
export function useOverview(params: OverviewParams) {
  return useQuery({
    queryKey: overviewKeys.report(params),
    queryFn: ({ signal }) => fetchOverview(params, signal),
    placeholderData: keepPreviousData,
  })
}
