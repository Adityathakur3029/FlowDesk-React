// Calendar dates (YYYY-MM-DD, `format: date` in the contract) have no time zone. new Date('2026-10-01') is
// UTC midnight, so they're formatted in UTC too; in the viewer's zone they'd show a day early west of Greenwich.
export const calendarDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

export const formatCalendarDate = (date: string) => calendarDateFormat.format(new Date(date))
