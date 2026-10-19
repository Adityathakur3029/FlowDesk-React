import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { TeamDirectory } from '@/features/teams'
import { cn } from '@/lib/utils'
import { programPath } from '@/routes/paths'
import { formatProgramDates } from '../programDates'
import type { Program } from '../types'
import { OwnerTeamName } from './OwnerTeamName'
import { ProgramStatusBadge } from './ProgramStatusBadge'

const createdFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const SKELETON_ROWS = 5
const COLUMNS = 6

interface ProgramTableProps {
  programs?: readonly Program[]
  // undefined while the team directory loads; a failed load shows "Unknown team" without blocking the table.
  teams?: TeamDirectory
  teamsLoading?: boolean
  // A newer page is loading while this one stays on screen.
  busy?: boolean
}

export function ProgramTable({ programs, teams, teamsLoading = false, busy = false }: ProgramTableProps) {
  return (
    // The table scrolls sideways inside its container on narrow screens, never the page.
    <div className="overflow-x-auto rounded-lg border">
      <Table aria-label="Programs" aria-busy={busy || programs === undefined} className={cn(busy && 'opacity-60 transition-opacity')}>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Owner team</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {programs === undefined
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: COLUMNS }, (_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : programs.map((program) => (
                <TableRow key={program.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {program.key}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex max-w-md flex-col gap-0.5">
                      <Link to={programPath(program.id)} className="font-medium underline-offset-4 hover:underline">
                        {program.name}
                      </Link>
                      {program.description && (
                        <span className="line-clamp-2 text-sm text-muted-foreground">{program.description}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ProgramStatusBadge status={program.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <OwnerTeamName teamId={program.ownerTeamId} teams={teams} loading={teamsLoading} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatProgramDates(program) ?? <span className="text-muted-foreground">Not set</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{createdFormat.format(new Date(program.createdAt))}</TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  )
}
