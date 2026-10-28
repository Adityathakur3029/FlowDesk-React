import { useSearchParams } from 'react-router'
import { useHasRole } from '@/auth/useAuth'
import { Pagination } from '@/components/data/Pagination'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { useBoards } from '../api'
import { BoardGrid } from '../components/BoardGrid'
import { CreateBoardDialog } from '../components/CreateBoardDialog'
import { BOARD_PAGE_SIZE, parseBoardSearch, toBoardListParams, toBoardSearchParams } from '../searchParams'

// UX hint only (POST /boards allows ADMIN or MANAGER); a 403 is still handled in the dialog.
const CREATE_BOARD_ROLES = ['ADMIN', 'MANAGER'] as const

export function BoardsPage() {
  const canCreate = useHasRole(CREATE_BOARD_ROLES)
  const [searchParams, setSearchParams] = useSearchParams()
  const search = parseBoardSearch(searchParams)
  const boards = useBoards(toBoardListParams(search))
  // Each page change pushes a history entry, so Back undoes it.
  const goToOffset = (offset: number) => setSearchParams(toBoardSearchParams({ offset }))

  return (
    <>
      <PageHeader
        title="Boards"
        description="Lightweight lists of tasks, without dates or status."
        actions={canCreate && <CreateBoardDialog />}
      />
      <BoardsContent query={boards} canCreate={canCreate} onOffsetChange={goToOffset} />
    </>
  )
}

interface BoardsContentProps {
  query: ReturnType<typeof useBoards>
  canCreate: boolean
  onOffsetChange: (offset: number) => void
}

function BoardsContent({ query, canCreate, onOffsetChange }: BoardsContentProps) {
  if (query.isPending) return <BoardGrid />

  if (query.isError) {
    return <ErrorState error={query.error} title="Couldn't load boards" onRetry={() => query.refetch()} retrying={query.isFetching} />
  }

  const { data, meta } = query.data

  if (data.length === 0) {
    if (meta.total > 0) {
      return (
        <EmptyState
          title="This page is empty"
          description="There are fewer boards than this page needs."
          action={
            <Button type="button" variant="outline" onClick={() => onOffsetChange(0)}>
              Go to first page
            </Button>
          }
        />
      )
    }
    return canCreate ? (
      <EmptyState title="No boards yet" action={<CreateBoardDialog />} />
    ) : (
      <EmptyState title="No boards yet" description="Ask an admin or manager to create one." />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <BoardGrid boards={data} busy={query.isPlaceholderData} />
      <Pagination
        offset={meta.offset}
        limit={BOARD_PAGE_SIZE}
        total={meta.total}
        pageSize={data.length}
        disabled={query.isPlaceholderData}
        onOffsetChange={onOffsetChange}
      />
    </div>
  )
}
