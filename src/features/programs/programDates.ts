import { calendarDateFormat, formatCalendarDate } from '@/lib/dates'
import type { Program } from './types'

// "1 Oct 2026 – 31 Dec 2026", "From 1 Oct 2026", "Until 31 Dec 2026", or null when neither is set.
export function formatProgramDates({ startDate, endDate }: Pick<Program, 'startDate' | 'endDate'>): string | null {
  if (startDate && endDate) return calendarDateFormat.formatRange(new Date(startDate), new Date(endDate))
  if (startDate) return `From ${formatCalendarDate(startDate)}`
  if (endDate) return `Until ${formatCalendarDate(endDate)}`
  return null
}
