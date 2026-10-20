import { describe, expect, it } from 'vitest'
import { isCalendarDate, localToday, parsePeriod, resolvePeriod, toPeriodSearchParams } from './period'

const parse = (query: string) => parsePeriod(new URLSearchParams(query))

describe('resolvePeriod', () => {
  it.each([
    ['12m', '2026-10-20', '2025-10-21'],
    ['3m', '2026-10-20', '2026-07-21'],
    ['1m', '2026-10-20', '2026-09-21'],
    // The same date a month earlier doesn't exist: clamp to that month's last day, then start the day after.
    ['1m', '2026-03-31', '2026-03-01'],
    ['3m', '2026-05-31', '2026-03-01'],
    ['12m', '2028-02-29', '2027-03-01'],
    ['1m', '2026-01-15', '2025-12-16'],
  ] as const)('%s ending %s starts %s', (preset, today, from) => {
    expect(resolvePeriod({ preset }, today)).toEqual({ from, to: today })
  })

  it('sends a custom range as given', () => {
    expect(resolvePeriod({ preset: 'custom', from: '2026-01-01', to: '2026-03-31' }, '2026-10-20')).toEqual({
      from: '2026-01-01',
      to: '2026-03-31',
    })
  })
})

describe('parsePeriod', () => {
  it('reads presets and custom ranges', () => {
    expect(parse('period=3m')).toEqual({ preset: '3m' })
    expect(parse('period=custom&from=2026-01-01&to=2026-03-31')).toEqual({ preset: 'custom', from: '2026-01-01', to: '2026-03-31' })
  })

  it.each(['', 'period=6m', 'period=custom', 'period=custom&from=2026-02-30&to=2026-03-31', 'period=custom&from=2026-1-1&to=2026-03-31'])(
    'falls back to the last 12 months for %j',
    (query) => {
      expect(parse(query)).toEqual({ preset: '12m' })
    },
  )

  // Order and length are the server's call (INVALID_DATE_RANGE, DATE_RANGE_TOO_LONG), shown under the inputs.
  it('keeps a reversed custom range for the server to answer', () => {
    expect(parse('period=custom&from=2026-03-31&to=2026-01-01')).toEqual({ preset: 'custom', from: '2026-03-31', to: '2026-01-01' })
  })

  it('round-trips, leaving the default out of the URL', () => {
    expect(toPeriodSearchParams({ preset: '12m' }).toString()).toBe('')
    expect(toPeriodSearchParams({ preset: '1m' }).toString()).toBe('period=1m')
    const custom = parse('period=custom&from=2026-01-01&to=2026-03-31')
    expect(toPeriodSearchParams(custom).toString()).toBe('period=custom&from=2026-01-01&to=2026-03-31')
  })
})

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
})
