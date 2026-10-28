import { cn } from '@/lib/utils'

interface HBarProps {
  value: number
  // The largest value in the list: its bar fills the track.
  max: number
  // One hue for the whole list (a single series).
  className: string
  // Read after the value by screen readers, e.g. "tasks completed".
  unit: string
}

// A single-series bar with its value at the tip: square at the baseline, 4 px rounded data end. The track
// keeps 3rem for the value, so the longest bar's label still fits.
export function HBar({ value, max, className, unit }: HBarProps) {
  const ratio = max > 0 ? value / max : 0
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {value > 0 && (
        <div
          aria-hidden="true"
          className={cn('h-2 min-w-0.5 rounded-r', className)}
          style={{ width: `calc((100% - 3rem) * ${ratio})` }}
        />
      )}
      <span className="text-sm font-medium tabular-nums">
        {value}
        <span className="sr-only"> {unit}</span>
      </span>
    </div>
  )
}
