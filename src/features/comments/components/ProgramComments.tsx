import { MessagesSquare } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useProgramComments } from '../api'
import { CommentForm } from './CommentForm'
import { CommentThread } from './CommentThread'

const SKELETON_COMMENTS = 3

// Program-level comments: a box for a new comment, then the threads, newest first. The section is blue
// (spec 09): theme-comments makes its buttons and focus rings blue, and the surfaces are tinted here.
export function ProgramComments({ programId }: { programId: string }) {
  const comments = useProgramComments(programId)
  // meta.total counts threads, not comments (contract).
  const threadCount = comments.data?.pages[0]?.meta.total

  return (
    <section
      aria-labelledby="program-comments-heading"
      className="theme-comments flex flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:p-5 dark:border-blue-900 dark:bg-blue-950/30"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
          <MessagesSquare className="size-5" />
        </span>
        <div className="flex flex-col">
          <h2 id="program-comments-heading" className="font-semibold text-blue-950 dark:text-blue-50">
            Comments
          </h2>
          <p className="text-sm text-blue-900/70 dark:text-blue-100/70">
            {threadCount === undefined ? 'Questions, updates and decisions' : `${threadCount} ${threadCount === 1 ? 'thread' : 'threads'}`}
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-blue-200 bg-background p-3 shadow-xs sm:p-4 dark:border-blue-900/60">
        <CommentForm programId={programId} />
      </div>
      <CommentThreads programId={programId} query={comments} />
    </section>
  )
}

function CommentThreads({ programId, query }: { programId: string; query: ReturnType<typeof useProgramComments> }) {
  if (query.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading comments" className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_COMMENTS }, (_, i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-blue-100 bg-background p-4 dark:border-blue-900/60">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // A failed refetch keeps the threads on screen; only a first load without data shows the error.
  if (!query.data) {
    return (
      <ErrorState error={query.error} title="Couldn't load comments" onRetry={() => query.refetch()} retrying={query.isFetching} />
    )
  }

  const threads = query.data.pages.flatMap((page) => page.data)
  if (threads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-blue-200 bg-background/60 dark:border-blue-900/60">
        <EmptyState title="No comments yet" description="Start the discussion. Everyone in FlowDesk can comment on a program." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Comment threads" className="flex flex-col gap-3">
        {threads.map((comment) => (
          <CommentThread key={comment.id} programId={programId} comment={comment} />
        ))}
      </ul>
      {query.isFetchNextPageError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn't load older comments. Try again.
        </p>
      )}
      {query.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          className="self-center border-blue-200 bg-background text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-900 dark:text-blue-300"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Show older comments'}
        </Button>
      )}
    </div>
  )
}
