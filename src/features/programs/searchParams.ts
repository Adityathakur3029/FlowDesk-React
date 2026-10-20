import { PROGRAM_STATUSES } from './programStatus'
import type { ProgramListParams, ProgramStatus } from './types'

export const PROGRAM_PAGE_SIZE = 20

export interface ProgramSearch {
  status?: ProgramStatus
  offset: number
}

export const DEFAULT_PROGRAM_SEARCH: ProgramSearch = { offset: 0 }

// URL hygiene only: an invalid or hand-edited value falls back to its default instead of producing a 400.
export function parseProgramSearch(params: URLSearchParams): ProgramSearch {
  const status = params.get('status')
  const offset = params.get('offset')
  return {
    status: PROGRAM_STATUSES.find((s) => s === status),
    offset: offset !== null && /^\d+$/.test(offset) ? Number(offset) : 0,
  }
}

// Defaults are left out, so the URL only shows what the user changed.
export function toProgramSearchParams(search: ProgramSearch): URLSearchParams {
  const params = new URLSearchParams()
  if (search.status) params.set('status', search.status)
  if (search.offset > 0) params.set('offset', String(search.offset))
  return params
}

export const toProgramListParams = (search: ProgramSearch): ProgramListParams => ({
  ...(search.status && { status: search.status }),
  limit: PROGRAM_PAGE_SIZE,
  offset: search.offset,
})

export const hasProgramFilters = (search: ProgramSearch) => search.status !== undefined
