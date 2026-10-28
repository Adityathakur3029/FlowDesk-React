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
import { ProgramFilters } from '../components/ProgramFilters'
import { ProgramTable } from '../components/ProgramTable'
import { PROGRAM_STATUS_LABELS } from '../programStatus'
import {
  DEFAULT_PROGRAM_SEARCH,
  parseProgramSearch,
  PROGRAM_PAGE_SIZE,
  toProgramListParams,
  toProgramSearchParams,
  type ProgramSearch,
} from '../searchParams'
import type { Program } from '../types'

// UX hint only (POST /programs allows ADMIN or MANAGER); a 403 is still handled in the dialog.
const CREATE_PROGRAM_ROLES = ['ADMIN', 'MANAGER'] as const

export function ProgramsPage() {
  const canCreate = useHasRole(CREATE_PROGRAM_ROLES)
  const [searchParams, setSearchParams] = useSearchParams()
  const search = parseProgramSearch(searchParams)
  const programs = usePrograms(toProgramListParams(search))
  const directory = useTeamDirectory()

  // Each change pushes a history entry, so Back undoes it.
  const updateSearch = (next: ProgramSearch) => setSearchParams(toProgramSearchParams(next))
  // The list is newest first, so a new program is the first row of page 1, unless the status filter hides it.
  const showNew = (program: Program) => {
    const status = search.status === program.status ? search.status : undefined
    if (search.offset > 0 || status !== search.status) updateSearch({ status, offset: 0 })
  }

  return (
    <>
      <PageHeader
        title="Programs"
        description="Each program groups related tasks and is owned by a team."
        actions={canCreate && <CreateProgramDialog onCreated={showNew} />}
      />
      <ProgramFilters search={search} onChange={updateSearch} />
      <ProgramsContent
        query={programs}
        search={search}
        teams={directory.data}
        teamsLoading={directory.isPending}
        canCreate={canCreate}
        onSearchChange={updateSearch}
        onCreated={showNew}
      />
    </>
  )
}

interface ProgramsContentProps {
  query: ReturnType<typeof usePrograms>
  search: ProgramSearch
  teams?: TeamDirectory
  teamsLoading: boolean
  canCreate: boolean
  onSearchChange: (search: ProgramSearch) => void
  onCreated: (program: Program) => void
}

function ProgramsContent({ query, search, teams, teamsLoading, canCreate, onSearchChange, onCreated }: ProgramsContentProps) {
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
            <Button type="button" variant="outline" onClick={() => onSearchChange({ ...search, offset: 0 })}>
              Go to first page
            </Button>
          }
        />
      )
    }
    if (search.status) {
      return (
        <EmptyState
          title={`No ${PROGRAM_STATUS_LABELS[search.status].toLowerCase()} programs`}
          action={
            <Button type="button" variant="outline" onClick={() => onSearchChange(DEFAULT_PROGRAM_SEARCH)}>
              Clear filter
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
        onOffsetChange={(offset) => onSearchChange({ ...search, offset })}
      />
    </div>
  )
}
