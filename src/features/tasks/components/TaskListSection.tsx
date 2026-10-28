import { useId } from 'react'
import { useSearchParams } from 'react-router'
import { Pagination } from '@/components/data/Pagination'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/button'
import { localToday } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useParentTasks } from '../api'
import { hasTaskFilters, parseTaskSearch, TASK_PAGE_SIZE, toTaskListParams, updateTaskSearch, type TaskSearch } from '../searchParams'
import type { TaskParentRef } from '../types'
import { CreateTaskDialog } from './CreateTaskDialog'
import { TaskFilters, type UpdateTaskSearch } from './TaskFilters'
import { TaskTable } from './TaskTable'

interface TaskListSectionProps {
  parent: TaskParentRef
  // The program's or board's name, for the Create task dialog.
  parentName: string
  // The program page's tab is the visible heading, so its "Tasks" heading is for screen readers only.
  headingHidden?: boolean
}

// A program's or board's tasks: search, status and Created filters, Create task, the table and paging.
// Its q, status, created and offset live in the page's URL, next to anything else there (the program's ?tab).
export function TaskListSection({ parent, parentName, headingHidden = false }: TaskListSectionProps) {
  const headingId = useId()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = parseTaskSearch(searchParams)
  const tasks = useParentTasks(parent, toTaskListParams(search, localToday()))

  const update: UpdateTaskSearch = (patch, options) => setSearchParams((prev) => updateTaskSearch(prev, patch), options)
  const clearFilters = () => update({ q: undefined, status: undefined, created: undefined })
  // The list is newest first, so a new task is on page 1 (if it matches the filters).
  const showNewest = () => {
    if (search.offset > 0) update({})
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className={cn(headingHidden ? 'sr-only' : 'text-lg font-semibold tracking-tight')}>
        Tasks
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TaskFilters search={search} onChange={update} />
        <CreateTaskDialog parent={parent} parentName={parentName} onCreated={showNewest} />
      </div>
      <TasksContent
        query={tasks}
        search={search}
        parent={parent}
        parentName={parentName}
        onOffsetChange={(offset) => update({ offset })}
        onClearFilters={clearFilters}
        onCreated={showNewest}
      />
    </section>
  )
}

interface TasksContentProps {
  query: ReturnType<typeof useParentTasks>
  search: TaskSearch
  parent: TaskParentRef
  parentName: string
  onOffsetChange: (offset: number) => void
  onClearFilters: () => void
  onCreated: () => void
}

function TasksContent({ query, search, parent, parentName, onOffsetChange, onClearFilters, onCreated }: TasksContentProps) {
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
        description={parent.type === 'BOARD' ? 'Add the first task to this board.' : 'Add the first task to plan the work.'}
        action={<CreateTaskDialog parent={parent} parentName={parentName} onCreated={onCreated} />}
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
