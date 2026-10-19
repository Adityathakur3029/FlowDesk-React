import { useSearchParams } from 'react-router'
import { Pagination } from '@/components/data/Pagination'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/button'
import { useProgramTasks } from '../api'
import { hasTaskFilters, parseTaskSearch, TASK_PAGE_SIZE, toTaskListParams, updateTaskSearch, type TaskSearch } from '../searchParams'
import { CreateTaskDialog } from './CreateTaskDialog'
import { TaskFilters, type UpdateTaskSearch } from './TaskFilters'
import { TaskTable } from './TaskTable'

interface ProgramTasksProps {
  programId: string
  programName: string
}

// The program page's Tasks tab: search and status filter, Create task, the table and paging.
// Its q, status and offset live in the page's URL next to the page's own ?tab.
export function ProgramTasks({ programId, programName }: ProgramTasksProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = parseTaskSearch(searchParams)
  const tasks = useProgramTasks(programId, toTaskListParams(search))

  const update: UpdateTaskSearch = (patch, options) => setSearchParams((prev) => updateTaskSearch(prev, patch), options)
  const clearFilters = () => update({ q: undefined, status: undefined })
  // The list is newest first, so a new task is on page 1 (if it matches the filters).
  const showNewest = () => {
    if (search.offset > 0) update({})
  }

  return (
    <section aria-labelledby="program-tasks-heading" className="flex flex-col gap-4">
      {/* The tab is the visible heading. */}
      <h2 id="program-tasks-heading" className="sr-only">
        Tasks
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TaskFilters search={search} onChange={update} />
        <CreateTaskDialog programId={programId} programName={programName} onCreated={showNewest} />
      </div>
      <TasksContent
        query={tasks}
        search={search}
        programId={programId}
        programName={programName}
        onOffsetChange={(offset) => update({ offset })}
        onClearFilters={clearFilters}
        onCreated={showNewest}
      />
    </section>
  )
}

interface TasksContentProps {
  query: ReturnType<typeof useProgramTasks>
  search: TaskSearch
  programId: string
  programName: string
  onOffsetChange: (offset: number) => void
  onClearFilters: () => void
  onCreated: () => void
}

function TasksContent({ query, search, programId, programName, onOffsetChange, onClearFilters, onCreated }: TasksContentProps) {
  if (query.isPending) return <TaskTable />

  if (query.isError) {
    return <ErrorState error={query.error} title="Couldn't load tasks" onRetry={() => query.refetch()} retrying={query.isFetching} />
  }

  const { data, meta } = query.data

  if (data.length === 0) {
    if (meta.total > 0) {
      return (
        <EmptyState
          title="This page is empty"
          description="There are fewer tasks than this page needs."
          action={
            <Button type="button" variant="outline" onClick={() => onOffsetChange(0)}>
              Go to first page
            </Button>
          }
        />
      )
    }
    if (hasTaskFilters(search)) {
      return (
        <EmptyState
          title="No tasks match these filters"
          action={
            <Button type="button" variant="outline" onClick={onClearFilters}>
              Clear filters
            </Button>
          }
        />
      )
    }
    return (
      <EmptyState
        title="No tasks yet"
        description="Add the first task to plan the work."
        action={<CreateTaskDialog programId={programId} programName={programName} onCreated={onCreated} />}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <TaskTable tasks={data} busy={query.isPlaceholderData} />
      <Pagination
        offset={meta.offset}
        limit={TASK_PAGE_SIZE}
        total={meta.total}
        pageSize={data.length}
        disabled={query.isPlaceholderData}
        onOffsetChange={onOffsetChange}
      />
    </div>
  )
}
