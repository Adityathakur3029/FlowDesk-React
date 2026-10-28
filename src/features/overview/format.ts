import { formatCalendarDate } from '@/lib/dates'
import type { ReportGranularity } from './types'

// "1 program", "3 programs". English only, like the rest of the UI.
export const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

// Whole percent of a total, 0 when the total is 0.
export const percent = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : 0)

export const formatRange = (from: string, to: string) => `${formatCalendarDate(from)} – ${formatCalendarDate(to)}`

// Trend axis ticks, in UTC like every calendar date: "Oct 25" for months, "6 Oct" for weeks.
const monthTick = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' })
const weekTick = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })

export const formatBucketTick = (start: string, granularity: ReportGranularity) =>
  (granularity === 'month' ? monthTick : weekTick).format(new Date(start))
