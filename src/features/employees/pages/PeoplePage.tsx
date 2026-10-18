import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth, useHasRole } from '@/auth/useAuth'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/data/Pagination'
import { InviteMemberDialog } from '@/features/invites'
import { useTeamDirectory } from '@/features/teams'
import { useEmployees } from '../api'
import { EditEmployeeDialog } from '../components/EditEmployeeDialog'
import { EmployeeFilters } from '../components/EmployeeFilters'
import { EmployeeTable } from '../components/EmployeeTable'
import {
  DEFAULT_EMPLOYEE_SEARCH,
  EMPLOYEE_PAGE_SIZE,
  hasEmployeeFilters,
  parseEmployeeSearch,
  toEmployeeListParams,
  toEmployeeSearchParams,
  type EmployeeSearch,
} from '../searchParams'
import type { Employee } from '../types'

// UX hints only; the backend still answers 403, and the dialogs show it.
// POST /invites and team membership changes: ADMIN or MANAGER. PATCH /employees/{id}: ADMIN.
const INVITE_ROLES = ['ADMIN', 'MANAGER'] as const
const EDIT_ROLES = ['ADMIN', 'MANAGER'] as const
const EDIT_DETAILS_ROLES = ['ADMIN'] as const

export function PeoplePage() {
  const { employee } = useAuth()
  const canInvite = useHasRole(INVITE_ROLES)
  const canEdit = useHasRole(EDIT_ROLES)
  const canEditDetails = useHasRole(EDIT_DETAILS_ROLES)
  const [searchParams, setSearchParams] = useSearchParams()
  const search = parseEmployeeSearch(searchParams)
  const employees = useEmployees(toEmployeeListParams(search))
  const teams = useTeamDirectory()

  // Each change pushes a history entry, so Back undoes it.
  const updateSearch = (next: EmployeeSearch) => setSearchParams(toEmployeeSearchParams(next))
  const clearFilters = () => updateSearch(DEFAULT_EMPLOYEE_SEARCH)

  const renderActions = canEdit
    ? (row: Employee) => (
        <EditEmployeeDialog employee={row} canEditDetails={canEditDetails} isSelf={row.id === employee?.id} />
      )
    : undefined

  return (
    <>
      <PageHeader
        title="People"
        description="Everyone in your organisation."
        actions={canInvite && <InviteMemberDialog />}
      />
      <EmployeeFilters search={search} teams={teams.data} onChange={updateSearch} />
      <PeopleContent
        query={employees}
        search={search}
        currentEmployeeId={employee?.id}
        teams={teams}
        renderActions={renderActions}
        canInvite={canInvite}
        onClearFilters={clearFilters}
        onOffsetChange={(offset) => updateSearch({ ...search, offset })}
      />
    </>
  )
}

interface PeopleContentProps {
  query: ReturnType<typeof useEmployees>
  search: EmployeeSearch
  currentEmployeeId?: string
  teams: ReturnType<typeof useTeamDirectory>
  renderActions?: (employee: Employee) => ReactNode
  canInvite: boolean
  onClearFilters: () => void
  onOffsetChange: (offset: number) => void
}

function PeopleContent({
  query,
  search,
  currentEmployeeId,
  teams,
  renderActions,
  canInvite,
  onClearFilters,
  onOffsetChange,
}: PeopleContentProps) {
  if (query.isPending) return <EmployeeTable renderActions={renderActions} />

  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="Couldn't load people"
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    )
  }

  const { data, meta } = query.data

  if (data.length === 0) {
    if (meta.total > 0) {
      return (
        <EmptyState
          title="This page is empty"
          description="There are fewer people than this page needs."
          action={
            <Button type="button" variant="outline" onClick={() => onOffsetChange(0)}>
              Go to first page
            </Button>
          }
        />
      )
    }
    if (hasEmployeeFilters(search)) {
      return (
        <EmptyState
          title="No people match these filters"
          action={
            <Button type="button" variant="outline" onClick={onClearFilters}>
              Clear filters
            </Button>
          }
        />
      )
    }
    return <EmptyState title="No people yet" action={canInvite ? <InviteMemberDialog /> : undefined} />
  }

  return (
    <div className="flex flex-col gap-4">
      <EmployeeTable
        employees={data}
        currentEmployeeId={currentEmployeeId}
        teams={teams.data}
        teamsLoading={teams.isPending}
        renderActions={renderActions}
        busy={query.isPlaceholderData}
      />
      <Pagination
        offset={meta.offset}
        limit={EMPLOYEE_PAGE_SIZE}
        total={meta.total}
        pageSize={data.length}
        disabled={query.isPlaceholderData}
        onOffsetChange={onOffsetChange}
      />
    </div>
  )
}
