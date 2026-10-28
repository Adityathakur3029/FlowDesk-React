import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { paths } from '@/routes/paths'
import { cn } from '@/lib/utils'
import type { Team } from '../types'

const SKELETON_ROWS = 5

const memberCountLabel = (n: number) => `${n} ${n === 1 ? 'member' : 'members'}`

interface TeamListProps {
  teams?: readonly Team[]
  // A newer page is loading while this one stays on screen.
  busy?: boolean
}

export function TeamList({ teams, busy = false }: TeamListProps) {
  return (
    <ul
      aria-label="Teams"
      aria-busy={busy || teams === undefined}
      className={cn('divide-y rounded-lg border', busy && 'opacity-60 transition-opacity')}
    >
      {teams === undefined
        ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <li key={i} className="flex flex-col gap-2 p-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full max-w-md" />
            </li>
          ))
        : teams.map((team) => (
            <li key={team.id} className="flex flex-col gap-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`${paths.people}?teamId=${team.id}`}
                  className="rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {team.name}
                </Link>
                <Badge variant="secondary">{memberCountLabel(team.memberCount)}</Badge>
              </div>
              {team.description && <p className="line-clamp-2 text-sm text-muted-foreground">{team.description}</p>}
            </li>
          ))}
    </ul>
  )
}
