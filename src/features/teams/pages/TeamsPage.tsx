import { useSearchParams } from 'react-router'
import { useHasRole } from '@/auth/useAuth'
import { Pagination } from '@/components/data/Pagination'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { useTeams } from '../api'
import { CreateTeamDialog } from '../components/CreateTeamDialog'
import { TeamList } from '../components/TeamList'
import { parseTeamOffset, TEAM_PAGE_SIZE, toTeamListParams, toTeamSearchParams } from '../searchParams'

// UX hint only (POST /teams allows ADMIN or MANAGER); a 403 is still handled in the dialog.
const CREATE_TEAM_ROLES = ['ADMIN', 'MANAGER'] as const

export function TeamsPage() {
  const canCreate = useHasRole(CREATE_TEAM_ROLES)
  const [searchParams, setSearchParams] = useSearchParams()
  const offset = parseTeamOffset(searchParams)
  const teams = useTeams(toTeamListParams(offset))
  const goTo = (next: number) => setSearchParams(toTeamSearchParams(next))

  return (
    <>
      <PageHeader title="Teams" description="Groups of people who own programs." actions={canCreate && <CreateTeamDialog />} />
      <TeamsContent query={teams} canCreate={canCreate} onOffsetChange={goTo} />
    </>
  )
}

interface TeamsContentProps {
  query: ReturnType<typeof useTeams>
  canCreate: boolean
  onOffsetChange: (offset: number) => void
}

function TeamsContent({ query, canCreate, onOffsetChange }: TeamsContentProps) {
  if (query.isPending) return <TeamList />

  if (query.isError) {
    return (
      <ErrorState error={query.error} title="Couldn't load teams" onRetry={() => query.refetch()} retrying={query.isFetching} />
    )
  }

  const { data, meta } = query.data

  if (data.length === 0) {
    if (meta.total > 0) {
      return (
        <EmptyState
          title="This page is empty"
          description="There are fewer teams than this page needs."
          action={
            <Button type="button" variant="outline" onClick={() => onOffsetChange(0)}>
              Go to first page
            </Button>
          }
        />
      )
    }
    return canCreate ? (
      <EmptyState title="No teams yet" action={<CreateTeamDialog />} />
    ) : (
      <EmptyState title="No teams yet" description="Ask an admin or manager to create one." />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <TeamList teams={data} busy={query.isPlaceholderData} />
      <Pagination
        offset={meta.offset}
        limit={TEAM_PAGE_SIZE}
        total={meta.total}
        pageSize={data.length}
        disabled={query.isPlaceholderData}
        onOffsetChange={onOffsetChange}
      />
    </div>
  )
}
