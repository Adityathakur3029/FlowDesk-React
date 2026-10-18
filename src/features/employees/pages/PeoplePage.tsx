import { useSearchParams } from 'react-router'
import { useAuth, useHasRole } from '@/auth/useAuth'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { InviteMemberDialog } from '@/features/invites'
import { useEmployees } from '../api'
import { EmployeeFilters } from '../components/EmployeeFilters'
import { EmployeeTable } from '../components/EmployeeTable'
import { Pagination } from '../components/Pagination'
import {
  EMPLOYEE_PAGE_SIZE,
  hasEmployeeFilters,
  parseEmployeeSearch,
  toEmployeeListParams,
  toEmployeeSearchParams,
  type EmployeeSearch,
} from '../searchParams'

// UX hint only (POST /invites allows ADMIN or MANAGER); a 403 is still handled in the dialog.
const INVITE_ROLES = ['ADMIN', 'MANAGER'] as const

export function PeoplePage() {
  const { employee } = useAuth()
  const canInvite = useHasRole(INVITE_ROLES)
  const [searchParams, setSearchParams] = useSearchParams()
  const search = parseEmployeeSearch(searchParams)
  const employees = useEmployees(toEmployeeListParams(search))

  // Each change pushes a history entry, so Back undoes it.
  const updateSearch = (next: EmployeeSearch) => setSearchParams(toEmployeeSearchParams(next))
  const clearFilters = () => updateSearch({ includeInactive: false, offset: 0 })

  return (
    <>
      <PageHeader
        title="People"
        description="Everyone in your organisation."
        actions={canInvite && <InviteMemberDialog />}
      />
      <EmployeeFilters search={search} onChange={updateSearch} />
      <PeopleContent
        query={employees}
        search={search}
        currentEmployeeId={employee?.id}
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
  canInvite: boolean
  onClearFilters: () => void
  onOffsetChange: (offset: number) => void
}

function PeopleContent({ query, search, currentEmployeeId, canInvite, onClearFilters, onOffsetChange }: PeopleContentProps) {
  if (query.isPending) return <EmployeeTable />

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
      <EmployeeTable employees={data} currentEmployeeId={currentEmployeeId} busy={query.isPlaceholderData} />
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
