import { useSearchParams } from 'react-router'
import { useHasRole } from '@/auth/useAuth'
import { Pagination } from '@/components/data/Pagination'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { useTeamDirectory, type TeamDirectory } from '@/features/teams'
import { usePrograms } from '../api'
import { CreateProgramDialog } from '../components/CreateProgramDialog'
import { ProgramTable } from '../components/ProgramTable'
import { parseProgramOffset, PROGRAM_PAGE_SIZE, toProgramListParams, toProgramSearchParams } from '../searchParams'

// UX hint only (POST /programs allows ADMIN or MANAGER); a 403 is still handled in the dialog.
const CREATE_PROGRAM_ROLES = ['ADMIN', 'MANAGER'] as const

export function ProgramsPage() {
  const canCreate = useHasRole(CREATE_PROGRAM_ROLES)
  const [searchParams, setSearchParams] = useSearchParams()
  const offset = parseProgramOffset(searchParams)
  const programs = usePrograms(toProgramListParams(offset))
  const directory = useTeamDirectory()
  const goTo = (next: number) => setSearchParams(toProgramSearchParams(next))
  // The list is newest first, so a new program is the first row of page 1.
  const showNewest = () => {
    if (offset > 0) goTo(0)
  }

  return (
    <>
      <PageHeader
        title="Programs"
        description="Each program groups related tasks and is owned by a team."
        actions={canCreate && <CreateProgramDialog onCreated={showNewest} />}
      />
      <ProgramsContent
        query={programs}
        teams={directory.data}
        teamsLoading={directory.isPending}
        canCreate={canCreate}
        onOffsetChange={goTo}
        onCreated={showNewest}
      />
    </>
  )
}

interface ProgramsContentProps {
  query: ReturnType<typeof usePrograms>
  teams?: TeamDirectory
  teamsLoading: boolean
  canCreate: boolean
  onOffsetChange: (offset: number) => void
  onCreated: () => void
}

function ProgramsContent({ query, teams, teamsLoading, canCreate, onOffsetChange, onCreated }: ProgramsContentProps) {
  if (query.isPending) return <ProgramTable />

  if (query.isError) {
    return (
      <ErrorState error={query.error} title="Couldn't load programs" onRetry={() => query.refetch()} retrying={query.isFetching} />
    )
  }

  const { data, meta } = query.data

  if (data.length === 0) {
    if (meta.total > 0) {
      return (
        <EmptyState
          title="This page is empty"
          description="There are fewer programs than this page needs."
          action={
            <Button type="button" variant="outline" onClick={() => onOffsetChange(0)}>
              Go to first page
            </Button>
          }
        />
      )
    }
    return canCreate ? (
      <EmptyState title="No programs yet" action={<CreateProgramDialog onCreated={onCreated} />} />
    ) : (
      <EmptyState title="No programs yet" description="Ask an admin or manager to create one." />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ProgramTable programs={data} teams={teams} teamsLoading={teamsLoading} busy={query.isPlaceholderData} />
      <Pagination
        offset={meta.offset}
        limit={PROGRAM_PAGE_SIZE}
        total={meta.total}
        pageSize={data.length}
        disabled={query.isPlaceholderData}
        onOffsetChange={onOffsetChange}
      />
    </div>
  )
}
