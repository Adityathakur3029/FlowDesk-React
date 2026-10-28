// Calendar dates (YYYY-MM-DD, `format: date` in the contract) have no time zone. new Date('2026-10-01') is
// UTC midnight, so they're formatted in UTC too; in the viewer's zone they'd show a day early west of Greenwich.
export const calendarDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

export const formatCalendarDate = (date: string) => calendarDateFormat.format(new Date(date))

const DAY_MS = 86_400_000

export const toIsoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

// A real calendar date in the contract's YYYY-MM-DD form (2026-02-30 isn't one).
export function isCalendarDate(value: string | null): value is string {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

// The browser's own calendar date: "last month" or "last 7 days" end today where the reader is.
export function localToday(now = new Date()): string {
  return toIsoDate(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

// The calendar date `days` after `date` (before it when negative).
export const shiftCalendarDate = (date: string, days: number) => toIsoDate(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS)
