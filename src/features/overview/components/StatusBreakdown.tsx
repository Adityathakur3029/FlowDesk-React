import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TONE_CHART_CLASSES, type Tone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { percent } from '../format'

export interface BreakdownItem {
  key: string
  label: string
  tone: Tone
  count: number
}

interface StatusBreakdownProps {
  title: string
  description: string
  // In the validated colour order (StatusBreakdown's callers say which).
  items: readonly BreakdownItem[]
  emptyText: string
}

// Part-to-whole: one thin bar with a 2 px surface gap between segments, and a legend that always shows each
// count and percent, so no value needs a hover (amber and green are below 3:1 against the card).
export function StatusBreakdown({ title, description, items, emptyText }: StatusBreakdownProps) {
  const total = items.reduce((sum, item) => sum + item.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          // The legend below states every value, so screen readers skip the bar.
          <div aria-hidden="true" className="flex h-3 w-full gap-0.5">
            {items
              .filter((item) => item.count > 0)
              .map((item) => (
                <Tooltip key={item.key}>
                  <TooltipTrigger asChild>
                    <div
                      style={{ flexGrow: item.count }}
                      className={cn(
                        'min-w-1 basis-0 transition-opacity first:rounded-l last:rounded-r hover:opacity-80',
                        TONE_CHART_CLASSES[item.tone],
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="font-semibold">{item.count}</span> {item.label} · {percent(item.count, total)}%
                  </TooltipContent>
                </Tooltip>
              ))}
          </div>
        )}
        <ul aria-label={title} className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-sm">
              <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', TONE_CHART_CLASSES[item.tone])} />
              <span className="mr-auto">{item.label}</span>
              <span className="font-medium tabular-nums">{item.count}</span>
              <span className="w-10 text-right text-muted-foreground tabular-nums">{percent(item.count, total)}%</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
