import type { TeamListParams } from './types'

export const TEAM_PAGE_SIZE = 20

// URL hygiene only: a missing or invalid offset means the first page.
export function parseTeamOffset(params: URLSearchParams): number {
  const offset = params.get('offset')
  return offset !== null && /^\d+$/.test(offset) ? Number(offset) : 0
}

export function toTeamSearchParams(offset: number): URLSearchParams {
  return new URLSearchParams(offset > 0 ? { offset: String(offset) } : {})
}

export const toTeamListParams = (offset: number): TeamListParams => ({ limit: TEAM_PAGE_SIZE, offset })
