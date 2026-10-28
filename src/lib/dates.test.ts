import { describe, expect, it } from 'vitest'
import { isCalendarDate, localToday, shiftCalendarDate } from './dates'

describe('dates', () => {
  it('checks real calendar dates', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true)
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isCalendarDate('2026-13-01')).toBe(false)
    expect(isCalendarDate(null)).toBe(false)
  })

  it("uses the browser's own calendar date for today", () => {
    expect(localToday(new Date(2026, 9, 20, 23, 59))).toBe('2026-10-20')
    expect(localToday(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01')
  })

  it.each([
    ['2026-10-28', -6, '2026-10-22'],
    ['2026-10-28', -29, '2026-09-29'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-10-28', 0, '2026-10-28'],
  ])('shifts %s by %i days to %s', (date, days, shifted) => {
    expect(shiftCalendarDate(date, days)).toBe(shifted)
  })
})
