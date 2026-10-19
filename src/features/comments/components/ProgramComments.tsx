import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useProgramComments } from '../api'
import { CommentForm } from './CommentForm'
import { CommentThread } from './CommentThread'

const SKELETON_COMMENTS = 3

// Program-level comments: a box for a new comment, then the threads, newest first.
export function ProgramComments({ programId }: { programId: string }) {
  const comments = useProgramComments(programId)

  return (
    <section aria-labelledby="program-comments-heading" className="flex flex-col gap-4">
      <h2 id="program-comments-heading" className="text-lg font-semibold">
        Comments
      </h2>
      <CommentForm programId={programId} />
      <CommentThreads programId={programId} query={comments} />
    </section>
  )
}

function CommentThreads({ programId, query }: { programId: string; query: ReturnType<typeof useProgramComments> }) {
  if (query.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading comments" className="flex flex-col gap-6">
        {Array.from({ length: SKELETON_COMMENTS }, (_, i) => (
          <div key={i} className="flex gap-3">
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
    return <EmptyState title="No comments yet" description="Start the discussion. Everyone in FlowDesk can comment on a program." />
  }

  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Comment threads" className="flex flex-col gap-6">
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
          className="self-center"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Show older comments'}
        </Button>
      )}
    </div>
  )
}
