import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  Clock,
  FolderKanban,
  Gauge,
  History,
  Pencil,
  Shapes,
  SquareKanban,
  Tags,
  Timer,
  UserRound,
  UserRoundPen,
  type LucideIcon,
} from 'lucide-react'
import { Link, useParams } from 'react-router'
import { isApiError } from '@/api/errors'
import { useAuth, useHasRole } from '@/auth/useAuth'
import { Detail, EditableDetail, NotSet } from '@/components/data/DetailRow'
import { KeyBadge } from '@/components/data/KeyBadge'
import { ErrorState } from '@/components/feedback/ErrorState'
import { NotFoundState } from '@/components/feedback/NotFoundState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskComments } from '@/features/comments'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import { formatCalendarDate } from '@/lib/dates'
import { TONE_DOT_CLASSES } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { useTask } from '../api'
import { DeleteTaskButton } from '../components/DeleteTaskButton'
import { TaskAssigneeEditor } from '../components/TaskAssigneeEditor'
import { TaskDependencies } from '../components/TaskDependencies'
import { TaskFieldEditor, type EditableTaskField } from '../components/TaskFieldEditor'
import { TaskOptionMenu } from '../components/TaskOptionMenu'
import { TaskStatusMenu } from '../components/TaskStatusMenu'
import { formatEstimate, TASK_STATUS_TONES } from '../taskDisplay'
import { parentPath } from '../taskParent'
import type { TaskDetail, TaskParent } from '../types'

const timestampFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

// DELETE …/tasks/{taskRef}: ADMIN or MANAGER, or the task's reporter (contract). UX only: the server
// still answers 403 to anyone else. Editing is open to every role, so it isn't gated.
const DELETE_ANY_TASK_ROLES = ['ADMIN', 'MANAGER'] as const

export function TaskPage() {
  const { taskRef = '' } = useParams()
  const task = useTask(taskRef)

  if (task.isPending) return <TaskPageSkeleton />

  if (task.isError) {
    // 404: unknown or deleted task, or a task of a deleted program. 400: the id or key in the URL isn't valid,
    // which is just as missing.
    if (isApiError(task.error) && (task.error.status === 404 || task.error.status === 400)) {
      return <NotFoundState title="Task not found" description="This task doesn't exist or has been deleted." />
    }
    return <ErrorState error={task.error} title="Couldn't load the task" onRetry={() => task.refetch()} retrying={task.isFetching} />
  }

  return <TaskView task={task.data} taskRef={taskRef} />
}

// "← Marketing Research": back to the task's program or board, named by the task itself (parent). A deleted
// board's page is gone, so its tasks go back to Boards.
function BackToParent({ parent }: { parent: TaskParent }) {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
      <Link to={parentPath(parent)}>
        <ArrowLeft aria-hidden="true" />
        {parent.type === 'BOARD' && !parent.isActive ? 'Boards' : parent.name}
      </Link>
    </Button>
  )
}

// The Program or Board row in Details, linking to it. A deleted board has no page to link to.
function ParentDetail({ parent }: { parent: TaskParent }) {
  const board = parent.type === 'BOARD'
  const badge = <KeyBadge kind={board ? 'board' : 'program'}>{parent.key}</KeyBadge>
  return (
    <Detail icon={board ? SquareKanban : FolderKanban} label={board ? 'Board' : 'Program'}>
      {board && !parent.isActive ? (
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {badge} {parent.name} <NotSet>(deleted)</NotSet>
        </span>
      ) : (
        <Link to={parentPath(parent)} className="inline-flex max-w-full items-center gap-2 underline-offset-4 hover:underline">
          {badge} <span className="truncate">{parent.name}</span>
        </Link>
      )}
    </Detail>
  )
}

interface TaskViewProps {
  task: TaskDetail
  // As in the URL (key or id): the task's cache entry, which every editor updates.
  taskRef: string
}

function TaskView({ task, taskRef }: TaskViewProps) {
  const { employee } = useAuth()
  const canDeleteAny = useHasRole(DELETE_ANY_TASK_ROLES)
  const canDelete = canDeleteAny || (employee !== null && employee.id === task.reporter.id)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackToParent parent={task.parent} />
        <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
          {/* A strip in the status colour; the badge below says what it means. */}
          <div aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1', TONE_DOT_CLASSES[TASK_STATUS_TONES[task.status]])} />
          <div className="flex items-start gap-4">
            <span className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-xl bg-blue-800 px-2 font-mono text-sm font-semibold text-white shadow-sm">
              {task.key}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <PageHeader title={`${task.key} ${task.title}`} heading={<TaskTitle task={task} taskRef={taskRef} />} />
              <div className="flex flex-wrap items-center gap-2">
                <TaskStatusMenu task={task} taskRef={taskRef} />
              </div>
            </div>
            {canDelete && (
              <div className="shrink-0">
                <DeleteTaskButton task={task} taskRef={taskRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details come first in the DOM so they're on top on narrow screens; from lg up they sit on the right. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside aria-label="Task details" className="flex flex-col gap-6 lg:col-start-2 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Details</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3">
                <ParentDetail parent={task.parent} />
                <AssigneeDetail task={task} taskRef={taskRef} />
                <Detail icon={UserRoundPen} label="Reporter">
                  {task.reporter.name}
                </Detail>
                <Detail icon={Shapes} label="Type">
                  <TaskOptionMenu task={task} taskRef={taskRef} field="type" />
                </Detail>
                <Detail icon={Gauge} label="Priority">
                  <TaskOptionMenu task={task} taskRef={taskRef} field="priority" />
                </Detail>
                <FieldDetail task={task} taskRef={taskRef} field="startDate" icon={CalendarDays} label="Start date" />
                <FieldDetail task={task} taskRef={taskRef} field="dueDate" icon={CalendarClock} label="Due date" />
                <FieldDetail task={task} taskRef={taskRef} field="estimate" icon={Timer} label="Estimate" />
                <FieldDetail task={task} taskRef={taskRef} field="labels" icon={Tags} label="Labels" />
                <Detail icon={Clock} label="Created">{timestampFormat.format(new Date(task.createdAt))}</Detail>
                <Detail icon={History} label="Updated">{timestampFormat.format(new Date(task.updatedAt))}</Detail>
                {task.completedAt && (
                  <Detail icon={CircleCheck} label="Completed">{timestampFormat.format(new Date(task.completedAt))}</Detail>
                )}
              </dl>
            </CardContent>
          </Card>
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1">
          <TaskDescription task={task} taskRef={taskRef} />
          <TaskDependencies task={task} taskRef={taskRef} />
          <TaskComments taskId={task.id} />
        </div>
      </div>
    </div>
  )
}

// The h1. Anyone clicks it (or the pencil, for keyboard users) to rename the task in place.
function TaskTitle({ task, taskRef }: TaskViewProps) {
  const { editing, open, close, triggerRef } = useInlineEdit()
  if (editing) return <TaskFieldEditor task={task} taskRef={taskRef} field="title" onClose={close} />

  return (
    <div className="group flex items-start gap-1">
      <h1
        onClick={open}
        className="-mx-1.5 cursor-text rounded-md px-1.5 text-2xl font-semibold tracking-tight break-words transition-colors hover:bg-muted"
      >
        {task.title}
      </h1>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Edit title"
        onClick={open}
        // Shown on hover from sm up; always shown on small (touch) screens.
        className="mt-0.5 text-muted-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Pencil aria-hidden="true" />
      </Button>
    </div>
  )
}

function TaskDescription({ task, taskRef }: TaskViewProps) {
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
        {!editing && (
          <CardAction>
            <Button
              ref={triggerRef}
              type="button"
              variant="ghost"
              size="sm"
              aria-label={task.description ? 'Edit description' : 'Add description'}
              onClick={open}
            >
              <Pencil aria-hidden="true" />
              {task.description ? 'Edit' : 'Add'}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <TaskFieldEditor task={task} taskRef={taskRef} field="description" onClose={close} />
        ) : (
          <div onClick={openUnlessSelecting} className="-m-2 cursor-text rounded-md p-2 transition-colors hover:bg-muted/60">
            {task.description ? (
              <p className="leading-relaxed break-words whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="text-muted-foreground italic">No description.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AssigneeDetail({ task, taskRef }: TaskViewProps) {
  const { editing, open, close, triggerRef } = useInlineEdit()
  // null when unassigned, although the generated type says otherwise (spec 08, contract note 1).
  const name = task.assignee ? task.assignee.name : null

  return (
    <EditableDetail
      icon={UserRound}
      label="Assignee"
      canEdit
      editing={editing}
      editor={<TaskAssigneeEditor task={task} taskRef={taskRef} onClose={close} />}
      onEdit={open}
      editLabel={`Edit assignee, ${name ?? 'unassigned'}`}
      triggerRef={triggerRef}
    >
      {name ?? <NotSet>Unassigned</NotSet>}
    </EditableDetail>
  )
}

interface FieldDetailProps extends TaskViewProps {
  field: Extract<EditableTaskField, 'startDate' | 'dueDate' | 'estimate' | 'labels'>
  icon: LucideIcon
  label: string
}

// A Details row edited in place with TaskFieldEditor.
function FieldDetail({ task, taskRef, field, icon, label }: FieldDetailProps) {
  const { editing, open, close, triggerRef } = useInlineEdit()
  const { shown, spoken } = describeField(task, field)

  return (
    <EditableDetail
      icon={icon}
      label={label}
      canEdit
      editing={editing}
      editor={<TaskFieldEditor task={task} taskRef={taskRef} field={field} onClose={close} />}
      onEdit={open}
      editLabel={`Edit ${label.toLowerCase()}, ${spoken}`}
      triggerRef={triggerRef}
    >
      {shown}
    </EditableDetail>
  )
}

// What a Details row shows, and how its edit button says it.
function describeField(task: TaskDetail, field: FieldDetailProps['field']) {
  switch (field) {
    case 'startDate':
    case 'dueDate': {
      const date = task[field]
      return date ? { shown: formatCalendarDate(date), spoken: formatCalendarDate(date) } : { shown: <NotSet />, spoken: 'not set' }
    }
    case 'estimate': {
      const minutes = task.estimateMinutes
      return minutes === null ? { shown: <NotSet />, spoken: 'not set' } : { shown: formatEstimate(minutes), spoken: formatEstimate(minutes) }
    }
    case 'labels':
      if (task.labels.length === 0) return { shown: <NotSet>None</NotSet>, spoken: 'none' }
      return {
        shown: (
          <span className="flex flex-wrap gap-1">
            {task.labels.map((label) => (
              <Badge key={label} variant="outline" className="font-normal">
                {label}
              </Badge>
            ))}
          </span>
        ),
        spoken: task.labels.join(', '),
      }
  }
}

// The parent (program or board) is only known once the task loads, so the back link is a placeholder too.
function TaskPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading task" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-72 lg:col-start-2 lg:row-start-1" />
        <Skeleton className="h-64 lg:col-start-1 lg:row-start-1" />
      </div>
    </div>
  )
}
