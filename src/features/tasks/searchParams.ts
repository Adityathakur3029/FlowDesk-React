import { TASK_STATUSES } from './taskDisplay'
import type { TaskListParams, TaskStatus } from './types'

export const TASK_PAGE_SIZE = 20
const MAX_QUERY_LENGTH = 100 // GET …/tasks `q` is 1-100 characters

export interface TaskSearch {
  q?: string
  status?: TaskStatus
  offset: number
}

// URL hygiene only: an invalid or hand-edited value falls back to its default instead of producing a 400.
export function parseTaskSearch(params: URLSearchParams): TaskSearch {
  const q = params.get('q')?.trim().slice(0, MAX_QUERY_LENGTH)
  const status = params.get('status')
  const offset = params.get('offset')
  return {
    ...(q && { q }),
    ...(TASK_STATUSES.some((s) => s === status) && { status: status as TaskStatus }),
    offset: offset !== null && /^\d+$/.test(offset) ? Number(offset) : 0,
  }
}

// The task list shares the program page's URL, so this keeps every other parameter (e.g. ?tab).
// A patch without `offset` goes back to the first page. Defaults are left out of the URL.
export function updateTaskSearch(prev: URLSearchParams, patch: Partial<TaskSearch>): URLSearchParams {
  const next: TaskSearch = { ...parseTaskSearch(prev), offset: 0, ...patch }
  const params = new URLSearchParams(prev)
  for (const key of ['q', 'status', 'offset']) params.delete(key)
  if (next.q) params.set('q', next.q)
  if (next.status) params.set('status', next.status)
  if (next.offset > 0) params.set('offset', String(next.offset))
  return params
}

export function toTaskListParams(search: TaskSearch): TaskListParams {
  return {
    ...(search.q && { q: search.q }),
    ...(search.status && { status: search.status }),
    limit: TASK_PAGE_SIZE,
    offset: search.offset,
  }
}

export const hasTaskFilters = (search: TaskSearch) => search.q !== undefined || search.status !== undefined
