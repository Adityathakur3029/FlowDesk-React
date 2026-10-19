import type { Program } from './types'

// startDate and endDate are calendar dates (YYYY-MM-DD). new Date('2026-10-01') is UTC midnight, so they're
// formatted in UTC too; in the viewer's zone they'd show a day early anywhere west of Greenwich.
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

export const formatProgramDate = (date: string) => dateFormat.format(new Date(date))

// "1 Oct 2026 – 31 Dec 2026", "From 1 Oct 2026", "Until 31 Dec 2026", or null when neither is set.
export function formatProgramDates({ startDate, endDate }: Pick<Program, 'startDate' | 'endDate'>): string | null {
  if (startDate && endDate) return dateFormat.formatRange(new Date(startDate), new Date(endDate))
  if (startDate) return `From ${formatProgramDate(startDate)}`
  if (endDate) return `Until ${formatProgramDate(endDate)}`
  return null
}
