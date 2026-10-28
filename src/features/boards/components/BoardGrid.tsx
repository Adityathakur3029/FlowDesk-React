import { ArrowRight, CalendarDays } from 'lucide-react'
import { Link } from 'react-router'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { boardPath } from '@/routes/paths'
import type { Board } from '../types'

const createdFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
// Two rows of the grid on a laptop.
const SKELETON_CARDS = 4

// A soft violet wash (the board colour) that fades into the card. Hover lifts the card; keyboard focus on its link
// rings the whole card.
const CARD_CLASSES =
  'group relative h-full rounded-2xl bg-linear-to-br from-violet-50 via-card to-card shadow-xs ring-violet-200/70 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-violet-300 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:from-violet-500/10 dark:ring-violet-500/20 dark:hover:ring-violet-500/40'

const KEY_CLASSES =
  'flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 px-2 font-mono text-xs font-semibold text-violet-800 dark:bg-violet-500/20 dark:text-violet-200'

interface BoardGridProps {
  boards?: readonly Board[]
  // A newer page is loading while this one stays on screen.
  busy?: boolean
}

// One card per board: a single column on phones and tablets, two from lg (laptops) up, where the sidebar leaves
// room for both.
export function BoardGrid({ boards, busy = false }: BoardGridProps) {
  return (
    <ul
      aria-label="Boards"
      aria-busy={busy || boards === undefined}
      className={cn('grid gap-4 lg:grid-cols-2', busy && 'opacity-60 transition-opacity')}
    >
      {boards === undefined
        ? Array.from({ length: SKELETON_CARDS }, (_, i) => (
            <li key={i}>
              <BoardCardSkeleton />
            </li>
          ))
        : boards.map((board) => (
            <li key={board.id}>
              <BoardCard board={board} />
            </li>
          ))}
    </ul>
  )
}

function BoardCard({ board }: { board: Board }) {
  return (
    <Card className={CARD_CLASSES}>
      <CardHeader className="flex items-start gap-3">
        <span className={KEY_CLASSES}>{board.key}</span>
        <CardTitle className="min-w-0 flex-1 self-center">
          <h2 className="font-semibold break-words">
            {/* The link stretches over the card, so the whole card is one click target named after the board. */}
            <Link to={boardPath(board.id)} className="outline-none after:absolute after:inset-0">
              {board.name}
            </Link>
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {board.description ? (
          <p className="line-clamp-2 text-muted-foreground">{board.description}</p>
        ) : (
          <p className="text-muted-foreground/70 italic">No description</p>
        )}
      </CardContent>
      <CardFooter className="justify-between gap-3 border-violet-100 bg-transparent py-3 text-xs text-muted-foreground dark:border-violet-500/15">
        <span className="flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" className="size-3.5" />
          Created <time dateTime={board.createdAt}>{createdFormat.format(new Date(board.createdAt))}</time>
        </span>
        <ArrowRight
          aria-hidden="true"
          className="size-4 text-violet-400 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-700 motion-reduce:transition-none dark:group-hover:text-violet-300"
        />
      </CardFooter>
    </Card>
  )
}

function BoardCardSkeleton() {
  return (
    <Card className="h-full rounded-2xl">
      <CardHeader className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
      <CardFooter className="bg-transparent py-3">
        <Skeleton className="h-3.5 w-32" />
      </CardFooter>
    </Card>
  )
}
