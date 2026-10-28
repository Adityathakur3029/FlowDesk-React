import { shiftCalendarDate } from '@/lib/dates'
import { TASK_STATUSES } from './taskDisplay'
import type { TaskListParams, TaskStatus } from './types'

export const TASK_PAGE_SIZE = 20
const MAX_QUERY_LENGTH = 100 // GET …/tasks `q` is 1-100 characters

// "Created" presets: today and the days before it, by the task's creation date.
export const CREATED_FILTERS = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
] as const

export type CreatedFilter = (typeof CREATED_FILTERS)[number]['value']

export interface TaskSearch {
  q?: string
  status?: TaskStatus
  // Left out: All time.
  created?: CreatedFilter
  offset: number
}

// URL hygiene only: an invalid or hand-edited value falls back to its default instead of producing a 400.
export function parseTaskSearch(params: URLSearchParams): TaskSearch {
  const q = params.get('q')?.trim().slice(0, MAX_QUERY_LENGTH)
  const status = params.get('status')
  const created = CREATED_FILTERS.find((filter) => filter.value === params.get('created'))?.value
  const offset = params.get('offset')
  return {
    ...(q && { q }),
    ...(TASK_STATUSES.some((s) => s === status) && { status: status as TaskStatus }),
    ...(created && { created }),
    offset: offset !== null && /^\d+$/.test(offset) ? Number(offset) : 0,
  }
}

// The task list shares its page's URL, so this keeps every other parameter (e.g. the program page's ?tab).
// A patch without `offset` goes back to the first page. Defaults are left out of the URL.
export function updateTaskSearch(prev: URLSearchParams, patch: Partial<TaskSearch>): URLSearchParams {
  const next: TaskSearch = { ...parseTaskSearch(prev), offset: 0, ...patch }
  const params = new URLSearchParams(prev)
  for (const key of ['q', 'status', 'created', 'offset']) params.delete(key)
  if (next.q) params.set('q', next.q)
  if (next.status) params.set('status', next.status)
  if (next.created) params.set('created', next.created)
  if (next.offset > 0) params.set('offset', String(next.offset))
  return params
}

// `today` is the browser's calendar date (localToday). Only createdFrom is sent, so tasks created later today
// still show up. The server compares the UTC date of createdAt, so near midnight the window can be off by a day.
export function toTaskListParams(search: TaskSearch, today: string): TaskListParams {
  const created = CREATED_FILTERS.find((filter) => filter.value === search.created)
  return {
    ...(search.q && { q: search.q }),
    ...(search.status && { status: search.status }),
    ...(created && { createdFrom: shiftCalendarDate(today, 1 - created.days) }),
    limit: TASK_PAGE_SIZE,
    offset: search.offset,
  }
}

export const hasTaskFilters = (search: TaskSearch) =>
  search.q !== undefined || search.status !== undefined || search.created !== undefined
