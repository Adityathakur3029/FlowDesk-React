import type { ReactNode } from 'react'
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  ChartColumn,
  Clock,
  History,
  ListChecks,
  MessagesSquare,
  Pencil,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { isApiError } from '@/api/errors'
import { useHasRole } from '@/auth/useAuth'
import { ErrorState } from '@/components/feedback/ErrorState'
import { NotFoundState } from '@/components/feedback/NotFoundState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProgramComments } from '@/features/comments'
import { ProgramTasks } from '@/features/tasks'
import { useTeamDirectory } from '@/features/teams'
import { formatCalendarDate } from '@/lib/dates'
import { TONE_DOT_CLASSES } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { useProgram } from '../api'
import { OwnerTeamName } from '../components/OwnerTeamName'
import { ProgramFieldEditor } from '../components/ProgramFieldEditor'
import { ProgramStatusBadge } from '../components/ProgramStatusBadge'
import { ProgramStatusMenu } from '../components/ProgramStatusMenu'
import { PROGRAM_STATUS_TONES } from '../programStatus'
import type { Program } from '../types'
import { useInlineEdit } from '../useInlineEdit'

const timestampFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

// PATCH /programs/{programId} (contract). UX only: the server still answers 403 to anyone else.
const EDIT_PROGRAM_ROLES = ['ADMIN', 'MANAGER'] as const

// ?tab=comments selects Comments; anything else is Tasks, the default.
type ProgramTab = 'tasks' | 'comments'
const COMMENTS_TAB = 'comments'

export function ProgramPage() {
  const { programId = '' } = useParams()
  const program = useProgram(programId)

  if (program.isPending) return <ProgramPageSkeleton />

  if (program.isError) {
    // 404: unknown or soft-deleted. 400: the id in the URL isn't a UUID, which is just as missing.
    if (isApiError(program.error) && (program.error.status === 404 || program.error.status === 400)) {
      return <NotFoundState title="Program not found" description="This program doesn't exist or has been deleted." />
    }
    return (
      <ErrorState error={program.error} title="Couldn't load the program" onRetry={() => program.refetch()} retrying={program.isFetching} />
    )
  }

  return <ProgramView program={program.data} />
}

function BackToPrograms() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
      <Link to={paths.programs}>
        <ArrowLeft aria-hidden="true" />
        Programs
      </Link>
    </Button>
  )
}

function ProgramView({ program }: { program: Program }) {
  const directory = useTeamDirectory()
  const canEdit = useHasRole(EDIT_PROGRAM_ROLES)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: ProgramTab = searchParams.get('tab') === COMMENTS_TAB ? 'comments' : 'tasks'
  // Only ?tab changes, so the Tasks tab's search, status and page survive a visit to Comments.
  // It pushes a history entry, so Back returns to the previous tab.
  const changeTab = (next: string) =>
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === COMMENTS_TAB) params.set('tab', COMMENTS_TAB)
      else params.delete('tab')
      return params
    })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackToPrograms />
        <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
          {/* A strip in the status colour; the badge below says what it means. */}
          <div aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1', TONE_DOT_CLASSES[PROGRAM_STATUS_TONES[program.status]])} />
          <div className="flex items-start gap-4">
            <span className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 px-2 font-mono text-sm font-semibold text-primary ring-1 ring-primary/20">
              {program.key}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <PageHeader title={program.name} heading={<ProgramName program={program} canEdit={canEdit} />} />
              <div className="flex flex-wrap items-center gap-2">
                {canEdit ? <ProgramStatusMenu program={program} /> : <ProgramStatusBadge status={program.status} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details come first in the DOM so they're on top on narrow screens; from lg up they sit on the right. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside aria-label="Program details" className="flex flex-col gap-6 lg:col-start-2 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Details</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3">
                <Detail icon={UsersRound} label="Owner team">
                  <OwnerTeamName teamId={program.ownerTeamId} teams={directory.data} loading={directory.isPending} />
                </Detail>
                <DateDetail program={program} field="startDate" icon={CalendarDays} label="Start date" canEdit={canEdit} />
                <DateDetail program={program} field="endDate" icon={CalendarCheck} label="End date" canEdit={canEdit} />
                <Detail icon={Clock} label="Created">{timestampFormat.format(new Date(program.createdAt))}</Detail>
                <Detail icon={History} label="Updated">{timestampFormat.format(new Date(program.updatedAt))}</Detail>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Analytics &amp; reports</h2>
              </CardTitle>
              <CardDescription>Progress charts and reports for this program.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/40 p-6 text-center">
                <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ChartColumn className="size-5" />
                </span>
                <p className="font-medium">Coming soon</p>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="flex min-w-0 flex-col gap-8 lg:col-start-1 lg:row-start-1">
          <ProgramDescription program={program} canEdit={canEdit} />

          {/* Radix mounts only the active tab, so comments load when that tab is first opened. */}
          <Tabs value={tab} onValueChange={changeTab}>
            <TabsList aria-label="Program sections">
              <TabsTrigger value="tasks" className="px-3">
                <ListChecks aria-hidden="true" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="comments" className="px-3 data-active:text-blue-700 dark:data-active:text-blue-300">
                <MessagesSquare aria-hidden="true" />
                Comments
              </TabsTrigger>
            </TabsList>
            <TabsContent value="tasks" className="pt-2">
              <ProgramTasks programId={program.id} programName={program.name} />
            </TabsContent>
            <TabsContent value="comments" className="pt-2">
              <ProgramComments programId={program.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

// The h1. Editors click it (or the pencil, for keyboard users) to rename the program in place.
function ProgramName({ program, canEdit }: { program: Program; canEdit: boolean }) {
  const { editing, open, close, triggerRef } = useInlineEdit()
  if (editing) return <ProgramFieldEditor program={program} field="name" onClose={close} />

  return (
    <div className="group flex items-start gap-1">
      <h1
        onClick={canEdit ? open : undefined}
        className={cn(
          'text-2xl font-semibold tracking-tight break-words',
          canEdit && '-mx-1.5 cursor-text rounded-md px-1.5 transition-colors hover:bg-muted',
        )}
      >
        {program.name}
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

function ProgramDescription({ program, canEdit }: { program: Program; canEdit: boolean }) {
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
              aria-label={program.description ? 'Edit description' : 'Add description'}
              onClick={open}
            >
              <Pencil aria-hidden="true" />
              {program.description ? 'Edit' : 'Add'}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <ProgramFieldEditor program={program} field="description" onClose={close} />
        ) : (
          <div
            onClick={canEdit ? openUnlessSelecting : undefined}
            className={cn(canEdit && '-m-2 cursor-text rounded-md p-2 transition-colors hover:bg-muted/60')}
          >
            {program.description ? (
              <p className="leading-relaxed break-words whitespace-pre-wrap">{program.description}</p>
            ) : (
              <p className="text-muted-foreground italic">No description.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface DateDetailProps {
  program: Program
  field: 'startDate' | 'endDate'
  icon: LucideIcon
  label: string
  canEdit: boolean
}

// A date row in Details. Editors click the date to change or clear it; the editor takes the full row width.
function DateDetail({ program, field, icon: Icon, label, canEdit }: DateDetailProps) {
  const { editing, open, close, triggerRef } = useInlineEdit()
  const date = program[field]
  const shown = date ? formatCalendarDate(date) : <NotSet />

  return (
    <>
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      {editing ? (
        <dd className="col-span-2">
          <ProgramFieldEditor program={program} field={field} onClose={close} />
        </dd>
      ) : (
        <dd className="min-w-0">
          {canEdit ? (
            <button
              ref={triggerRef}
              type="button"
              onClick={open}
              aria-label={`Edit ${label.toLowerCase()}, ${date ? formatCalendarDate(date) : 'not set'}`}
              className="group/date -mx-1.5 -my-0.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {shown}
              <Pencil
                className="size-3.5 text-muted-foreground opacity-0 group-hover/date:opacity-100 group-focus-visible/date:opacity-100"
                aria-hidden="true"
              />
            </button>
          ) : (
            shown
          )}
        </dd>
      )}
    </>
  )
}

function Detail({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

const NotSet = () => <span className="text-muted-foreground">Not set</span>

function ProgramPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading program" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackToPrograms />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-40 lg:col-start-2 lg:row-start-1" />
        <Skeleton className="h-64 lg:col-start-1 lg:row-start-1" />
      </div>
    </div>
  )
}
