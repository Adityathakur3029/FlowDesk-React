import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { END_BEFORE_START, isCalendarDate, PERIOD_PRESETS, type OverviewPeriod, type PeriodPreset } from '../period'
import type { OverviewParams } from '../types'

const CUSTOM = 'custom'
const ERROR_ID = 'overview-range-error'

interface PeriodFilterProps {
  period: OverviewPeriod
  // The dates the report is for; they prefill the custom range.
  range: OverviewParams
  // A 400 for the custom range, shown under its inputs.
  error: string | null
  onChange: (period: OverviewPeriod) => void
}

// One row above the whole report. A preset applies at once; a custom range waits for Apply, so a half-edited
// range never fires a request. The page remounts this (key) whenever the period in the URL changes.
export function PeriodFilter({ period, range, error, onChange }: PeriodFilterProps) {
  const [customOpen, setCustomOpen] = useState(period.preset === CUSTOM)

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="overview-period">Period</Label>
        <Select
          value={customOpen ? CUSTOM : period.preset}
          onValueChange={(value) => {
            if (value === CUSTOM) {
              setCustomOpen(true)
              return
            }
            setCustomOpen(false)
            onChange({ preset: value as PeriodPreset })
          }}
        >
          <SelectTrigger id="overview-period" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM}>Custom range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {customOpen && <CustomRange range={range} error={error} onApply={(from, to) => onChange({ preset: CUSTOM, from, to })} />}
    </div>
  )
}

interface CustomRangeProps {
  range: OverviewParams
  error: string | null
  onApply: (from: string, to: string) => void
}

function CustomRange({ range, error, onApply }: CustomRangeProps) {
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const [localError, setLocalError] = useState<string | null>(null)
  const message = localError ?? error

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!isCalendarDate(from) || !isCalendarDate(to)) {
      setLocalError('Pick a start and an end date.')
      return
    }
    if (from > to) {
      setLocalError(END_BEFORE_START)
      return
    }
    setLocalError(null)
    onApply(from, to)
  }

  const inputProps = {
    type: 'date',
    className: 'w-40',
    'aria-invalid': message !== null || undefined,
    'aria-describedby': message !== null ? ERROR_ID : undefined,
  } as const

  return (
    <form noValidate onSubmit={submit} aria-label="Custom range" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="overview-from">From</Label>
        <Input {...inputProps} id="overview-from" value={from} onChange={(event) => setFrom(event.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="overview-to">To</Label>
        <Input {...inputProps} id="overview-to" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <Button type="submit" variant="outline">
        Apply
      </Button>
      {message !== null && (
        <p id={ERROR_ID} role="alert" className="basis-full text-sm text-destructive">
          {message}
        </p>
      )}
    </form>
  )
}
