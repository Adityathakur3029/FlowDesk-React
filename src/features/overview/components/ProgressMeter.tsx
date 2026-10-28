import { percent } from '../format'

// Done out of all live tasks, as a meter: the track is a lighter step of the fill's hue. Used by the Program and
// Board reports.
export function ProgressMeter({ done, total }: { done: number; total: number }) {
  if (total === 0) return <span className="text-xs text-muted-foreground">No tasks</span>
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="h-1.5 w-20 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
        <span className="block h-full rounded-full bg-emerald-500 dark:bg-emerald-600" style={{ width: `${percent(done, total)}%` }} />
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        <span aria-hidden="true">
          {done}/{total}
        </span>
        <span className="sr-only">
          {done} of {total} tasks done
        </span>
      </span>
    </span>
  )
}
