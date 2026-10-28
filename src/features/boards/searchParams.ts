import type { BoardListParams } from './types'

export const BOARD_PAGE_SIZE = 20

export interface BoardSearch {
  offset: number
}

// URL hygiene only: an invalid or hand-edited offset falls back to the first page instead of producing a 400.
export function parseBoardSearch(params: URLSearchParams): BoardSearch {
  const offset = params.get('offset')
  return { offset: offset !== null && /^\d+$/.test(offset) ? Number(offset) : 0 }
}

// The first page is left out, so the URL only shows what the user changed.
export function toBoardSearchParams(search: BoardSearch): URLSearchParams {
  return new URLSearchParams(search.offset > 0 ? { offset: String(search.offset) } : {})
}

export const toBoardListParams = (search: BoardSearch): BoardListParams => ({ limit: BOARD_PAGE_SIZE, offset: search.offset })
