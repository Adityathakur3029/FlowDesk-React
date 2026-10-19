import type { ProgramListParams } from './types'

export const PROGRAM_PAGE_SIZE = 20

// URL hygiene only: a missing or invalid offset means the first page.
export function parseProgramOffset(params: URLSearchParams): number {
  const offset = params.get('offset')
  return offset !== null && /^\d+$/.test(offset) ? Number(offset) : 0
}

export function toProgramSearchParams(offset: number): URLSearchParams {
  return new URLSearchParams(offset > 0 ? { offset: String(offset) } : {})
}

export const toProgramListParams = (offset: number): ProgramListParams => ({ limit: PROGRAM_PAGE_SIZE, offset })
