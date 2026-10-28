import { ArrowLeft, Clock, History, KeyRound, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { isApiError } from '@/api/errors'
import { useHasRole } from '@/auth/useAuth'
import { Detail } from '@/components/data/DetailRow'
import { KeyBadge } from '@/components/data/KeyBadge'
import { ErrorState } from '@/components/feedback/ErrorState'
import { NotFoundState } from '@/components/feedback/NotFoundState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskListSection } from '@/features/tasks'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { useBoard } from '../api'
import { BoardFieldEditor } from '../components/BoardFieldEditor'
import { DeleteBoardButton } from '../components/DeleteBoardButton'
import type { Board } from '../types'

const timestampFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

// PATCH and DELETE /boards/{boardId} (contract). UX only: the server still answers 403 to anyone else. Every
// role works with the board's tasks.
const EDIT_BOARD_ROLES = ['ADMIN', 'MANAGER'] as const
const DELETE_BOARD_ROLES = ['ADMIN'] as const

export function BoardPage() {
  const { boardId = '' } = useParams()
  const board = useBoard(boardId)

  if (board.isPending) return <BoardPageSkeleton />

  if (board.isError) {
    // 404: unknown or soft-deleted. 400: the id in the URL isn't a UUID, which is just as missing.
    if (isApiError(board.error) && (board.error.status === 404 || board.error.status === 400)) {
      return <NotFoundState title="Board not found" description="This board doesn't exist or has been deleted." />
    }
    return <ErrorState error={board.error} title="Couldn't load the board" onRetry={() => board.refetch()} retrying={board.isFetching} />
  }

  return <BoardView board={board.data} />
}

function BackToBoards() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
      <Link to={paths.boards}>
        <ArrowLeft aria-hidden="true" />
        Boards
      </Link>
    </Button>
  )
}

function BoardView({ board }: { board: Board }) {
  const canEdit = useHasRole(EDIT_BOARD_ROLES)
  const canDelete = useHasRole(DELETE_BOARD_ROLES)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackToBoards />
        <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
          <div className="flex items-start gap-4">
            {/* The board key colour, as KeyBadge's. */}
            <span className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-xl bg-violet-700 px-2 font-mono text-sm font-semibold text-white shadow-sm">
              {board.key}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <PageHeader title={board.name} heading={<BoardName board={board} canEdit={canEdit} />} />
            </div>
            {canDelete && (
              <div className="shrink-0">
                <DeleteBoardButton board={board} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details come first in the DOM so they're on top on narrow screens; from lg up they sit on the right. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside aria-label="Board details" className="flex flex-col gap-6 lg:col-start-2 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Details</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3">
                <Detail icon={KeyRound} label="Key">
                  <KeyBadge kind="board">{board.key}</KeyBadge>
                </Detail>
                <Detail icon={Clock} label="Created">{timestampFormat.format(new Date(board.createdAt))}</Detail>
                <Detail icon={History} label="Updated">{timestampFormat.format(new Date(board.updatedAt))}</Detail>
              </dl>
            </CardContent>
          </Card>
        </aside>

        <div className="flex min-w-0 flex-col gap-8 lg:col-start-1 lg:row-start-1">
          <BoardDescription board={board} canEdit={canEdit} />
          <TaskListSection parent={{ type: 'BOARD', id: board.id }} parentName={board.name} />
        </div>
      </div>
    </div>
  )
}

// The h1. Editors click it (or the pencil, for keyboard users) to rename the board in place.
function BoardName({ board, canEdit }: { board: Board; canEdit: boolean }) {
  const { editing, open, close, triggerRef } = useInlineEdit()
  if (editing) return <BoardFieldEditor board={board} field="name" onClose={close} />

  return (
    <div className="group flex items-start gap-1">
      <h1
        onClick={canEdit ? open : undefined}
        className={cn(
          'text-2xl font-semibold tracking-tight break-words',
          canEdit && '-mx-1.5 cursor-text rounded-md px-1.5 transition-colors hover:bg-muted',
        )}
      >
        {board.name}
      </h1>
      {canEdit && (
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Edit name"
          onClick={open}
          // Shown on hover from sm up; always shown on small (touch) screens.
          className="mt-0.5 text-muted-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Pencil aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

function BoardDescription({ board, canEdit }: { board: Board; canEdit: boolean }) {
  const { editing, open, close, triggerRef } = useInlineEdit()
  // A click edits, unless it ended a text selection.
  const openUnlessSelecting = () => {
    if (!window.getSelection()?.toString()) open()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Description</h2>
        </CardTitle>
        {canEdit && !editing && (
          <CardAction>
            <Button
              ref={triggerRef}
              type="button"
              variant="ghost"
              size="sm"
              aria-label={board.description ? 'Edit description' : 'Add description'}
              onClick={open}
            >
              <Pencil aria-hidden="true" />
              {board.description ? 'Edit' : 'Add'}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <BoardFieldEditor board={board} field="description" onClose={close} />
        ) : (
          <div
            onClick={canEdit ? openUnlessSelecting : undefined}
            className={cn(canEdit && '-m-2 cursor-text rounded-md p-2 transition-colors hover:bg-muted/60')}
          >
            {board.description ? (
              <p className="leading-relaxed break-words whitespace-pre-wrap">{board.description}</p>
            ) : (
              <p className="text-muted-foreground italic">No description.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BoardPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading board" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackToBoards />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-40 lg:col-start-2 lg:row-start-1" />
        <Skeleton className="h-64 lg:col-start-1 lg:row-start-1" />
      </div>
    </div>
  )
}
