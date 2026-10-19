import type { ReactNode } from 'react'
import { ArrowLeft, ChartColumn } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { isApiError } from '@/api/errors'
import { ErrorState } from '@/components/feedback/ErrorState'
import { NotFoundState } from '@/components/feedback/NotFoundState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ProgramComments } from '@/features/comments'
import { useTeamDirectory } from '@/features/teams'
import { paths } from '@/routes/paths'
import { useProgram } from '../api'
import { OwnerTeamName } from '../components/OwnerTeamName'
import { ProgramStatusBadge } from '../components/ProgramStatusBadge'
import { formatProgramDate } from '../programDates'
import type { Program } from '../types'

const timestampFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function ProgramPage() {
  const { programId = '' } = useParams()
  const program = useProgram(programId)

  if (program.isPending) return <ProgramPageSkeleton />

  if (program.isError) {
    // 404: unknown or soft-deleted. 400: the id in the URL isn't a UUID, which is just as missing.
    if (isApiError(program.error) && (program.error.status === 404 || program.error.status === 400)) {
      return <NotFoundState title="Program not found" description="This program doesn't exist or has been deleted." />
    }
    return (
      <ErrorState error={program.error} title="Couldn't load the program" onRetry={() => program.refetch()} retrying={program.isFetching} />
    )
  }

  return <ProgramView program={program.data} />
}

function BackToPrograms() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
      <Link to={paths.programs}>
        <ArrowLeft aria-hidden="true" />
        Programs
      </Link>
    </Button>
  )
}

function ProgramView({ program }: { program: Program }) {
  const directory = useTeamDirectory()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackToPrograms />
        <PageHeader title={program.name} />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {program.key}
          </Badge>
          <ProgramStatusBadge status={program.status} />
        </div>
      </div>

      {/* Details come first in the DOM so they're on top on narrow screens; from lg up they sit on the right. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside aria-label="Program details" className="flex flex-col gap-6 lg:col-start-2 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Details</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
                <Detail label="Owner team">
                  <OwnerTeamName teamId={program.ownerTeamId} teams={directory.data} loading={directory.isPending} />
                </Detail>
                <Detail label="Start date">{program.startDate ? formatProgramDate(program.startDate) : <NotSet />}</Detail>
                <Detail label="End date">{program.endDate ? formatProgramDate(program.endDate) : <NotSet />}</Detail>
                <Detail label="Created">{timestampFormat.format(new Date(program.createdAt))}</Detail>
                <Detail label="Updated">{timestampFormat.format(new Date(program.updatedAt))}</Detail>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Analytics &amp; reports</h2>
              </CardTitle>
              <CardDescription>Progress charts and reports for this program.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
                <ChartColumn className="size-6 text-muted-foreground" aria-hidden="true" />
                <p className="font-medium">Coming soon</p>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="flex min-w-0 flex-col gap-8 lg:col-start-1 lg:row-start-1">
          <section aria-labelledby="program-description-heading" className="flex flex-col gap-2">
            <h2 id="program-description-heading" className="text-lg font-semibold">
              Description
            </h2>
            {program.description ? (
              <p className="text-sm break-words whitespace-pre-wrap">{program.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No description.</p>
            )}
          </section>

          <ProgramComments programId={program.id} />
        </div>
      </div>
    </div>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

const NotSet = () => <span className="text-muted-foreground">Not set</span>

function ProgramPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading program" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackToPrograms />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-40 lg:col-start-2 lg:row-start-1" />
        <Skeleton className="h-64 lg:col-start-1 lg:row-start-1" />
      </div>
    </div>
  )
}
