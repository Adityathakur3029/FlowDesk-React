import { isCalendarDate, toIsoDate } from '@/lib/dates'
import type { OverviewParams } from './types'

export const PERIOD_PRESETS = [
  { value: '12m', label: 'Last 12 months', months: 12 },
  { value: '3m', label: 'Last 3 months', months: 3 },
  { value: '1m', label: 'Last month', months: 1 },
] as const

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]['value']

export type OverviewPeriod = { preset: PeriodPreset } | { preset: 'custom'; from: string; to: string }

export const DEFAULT_PERIOD: OverviewPeriod = { preset: '12m' }

const DAY_MS = 86_400_000

// The server's INVALID_DATE_RANGE, worded for a period (the shared message is about a task's due date). The
// custom-range form also checks it before sending, for instant feedback only.
export const END_BEFORE_START = 'The start date must be on or before the end date.'

// URL hygiene only: an unknown preset or a malformed custom date falls back to the default. Whether a valid
// custom range is acceptable (order, length) is the server's call.
export function parsePeriod(params: URLSearchParams): OverviewPeriod {
  const period = params.get('period')
  const preset = PERIOD_PRESETS.find((p) => p.value === period)
  if (preset) return { preset: preset.value }
  if (period === 'custom') {
    const from = params.get('from')
    const to = params.get('to')
    if (isCalendarDate(from) && isCalendarDate(to)) return { preset: 'custom', from, to }
  }
  return DEFAULT_PERIOD
}

// The default is left out, so /overview means the last 12 months.
export function toPeriodSearchParams(period: OverviewPeriod): URLSearchParams {
  if (period.preset === 'custom') return new URLSearchParams({ period: 'custom', from: period.from, to: period.to })
  return new URLSearchParams(period.preset === DEFAULT_PERIOD.preset ? {} : { period: period.preset })
}

// A preset ends today and starts the day after the same date `months` earlier (clamped to that month's last
// day), so 12 months from 2026-10-20 is 2025-10-21 – 2026-10-20 and one month from 2026-03-31 starts 2026-03-01.
export function resolvePeriod(period: OverviewPeriod, today: string): OverviewParams {
  if (period.preset === 'custom') return { from: period.from, to: period.to }
  const { months } = PERIOD_PRESETS.find((p) => p.value === period.preset)!
  const [y, m, d] = today.split('-').map(Number)
  const lastDayOfTarget = new Date(Date.UTC(y, m - 1 - months + 1, 0)).getUTCDate()
  const sameDayEarlier = Date.UTC(y, m - 1 - months, Math.min(d, lastDayOfTarget))
  return { from: toIsoDate(sameDayEarlier + DAY_MS), to: today }
}
