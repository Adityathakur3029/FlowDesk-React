import { useState } from 'react'
import { ChartLine, Table2 } from 'lucide-react'
import { CartesianGrid, LabelList, Legend, Line, LineChart, XAxis, YAxis, type LabelProps } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCalendarDate } from '@/lib/dates'
import { formatBucketTick, formatRange } from '../format'
import type { OverviewTotals, ReportGranularity, TrendBucket } from '../types'

// Emphasis: Completed is the point (green, as Done is everywhere), Created is context (recessive slate).
// Validated with the dataviz checker on the light and dark card surfaces (spec 14).
const chartConfig = {
  created: { label: 'Created', theme: { light: '#94a3b8', dark: '#475569' } },
  completed: { label: 'Completed', theme: { light: '#059669', dark: '#059669' } },
} satisfies ChartConfig

const SERIES = ['created', 'completed'] as const

// End labels are skipped when the two last values are this close (as a share of the largest value): stacked
// labels would detach from their lines, and the legend and tooltip carry them instead.
const END_LABEL_MIN_GAP = 0.1

const bucketLabel = (bucket: TrendBucket) =>
  bucket.start === bucket.end ? formatCalendarDate(bucket.start) : formatRange(bucket.start, bucket.end)

interface TrendChartProps {
  trend: readonly TrendBucket[]
  granularity: ReportGranularity
  totals: OverviewTotals
}

export function TrendChart({ trend, granularity, totals }: TrendChartProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const showTable = view === 'table'

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Tasks created vs completed</h2>
        </CardTitle>
        <CardDescription>Per {granularity}, across all programs. Dates are in UTC.</CardDescription>
        <CardAction>
          <Button type="button" variant="outline" size="sm" aria-pressed={showTable} onClick={() => setView(showTable ? 'chart' : 'table')}>
            {showTable ? <ChartLine aria-hidden="true" /> : <Table2 aria-hidden="true" />}
            {showTable ? 'Show chart' : 'Show table'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {showTable ? <TrendTable trend={trend} granularity={granularity} totals={totals} /> : <TrendLines trend={trend} granularity={granularity} />}
      </CardContent>
    </Card>
  )
}

function TrendLines({ trend, granularity }: { trend: readonly TrendBucket[]; granularity: ReportGranularity }) {
  const last = trend.at(-1)
  const largest = Math.max(1, ...trend.flatMap((bucket) => [bucket.created, bucket.completed]))
  const labelEnds = last !== undefined && Math.abs(last.created - last.completed) / largest >= END_LABEL_MIN_GAP
  const lastIndex = trend.length - 1

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
      <LineChart data={[...trend]} margin={{ top: 8, right: labelEnds ? 36 : 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="start"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
          tickFormatter={(start: string) => formatBucketTick(start, granularity)}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(_, payload) => {
                const bucket = payload[0]?.payload as TrendBucket | undefined
                return bucket ? bucketLabel(bucket) : null
              }}
            />
          }
        />
        <Legend verticalAlign="top" align="left" content={<TrendLegend />} />
        {SERIES.map((key) => (
          <Line
            key={key}
            dataKey={key}
            name={chartConfig[key].label}
            type="linear"
            stroke={`var(--color-${key})`}
            strokeWidth={2}
            // One bucket has no line to draw, so it gets a dot.
            dot={trend.length === 1 ? { r: 4, fill: `var(--color-${key})` } : false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          >
            {labelEnds && <LabelList dataKey={key} content={(props) => <EndLabel {...props} lastIndex={lastIndex} />} />}
          </Line>
        ))}
      </LineChart>
    </ChartContainer>
  )
}

// The value at the end of a line, in text ink (never the series colour).
function EndLabel({ x, y, value, index, lastIndex }: LabelProps & { lastIndex: number }) {
  if (index !== lastIndex || typeof x !== 'number' || typeof y !== 'number') return null
  return (
    <text x={x + 8} y={y} dy={4} className="fill-foreground text-xs font-medium">
      {value}
    </text>
  )
}

// Line keys, as the marks are lines. Rendered inside the chart, where the --color-* variables are set.
function TrendLegend() {
  return (
    <ul className="flex items-center gap-4 pb-3 text-xs text-muted-foreground">
      {SERIES.map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ backgroundColor: `var(--color-${key})` }} />
          {chartConfig[key].label}
        </li>
      ))}
    </ul>
  )
}

function TrendTable({ trend, granularity, totals }: TrendChartProps) {
  return (
    <Table>
      <caption className="sr-only">Tasks created and completed per {granularity}</caption>
      <TableHeader>
        <TableRow>
          <TableHead>{granularity === 'month' ? 'Month' : 'Week'}</TableHead>
          <TableHead className="text-right">Created</TableHead>
          <TableHead className="text-right">Completed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trend.map((bucket) => (
          <TableRow key={bucket.start}>
            <TableCell>{bucketLabel(bucket)}</TableCell>
            <TableCell className="text-right tabular-nums">{bucket.created}</TableCell>
            <TableCell className="text-right tabular-nums">{bucket.completed}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      {/* The contract guarantees the buckets add up to these totals. */}
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell className="text-right tabular-nums">{totals.tasksCreated}</TableCell>
          <TableCell className="text-right tabular-nums">{totals.tasksCompleted}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}
