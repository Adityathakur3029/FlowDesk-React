import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { getErrorMessage, hasErrorCode } from '@/api/errors'
import { FormErrorAlert } from '@/components/feedback/FormErrorAlert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmployeeMultiPicker } from '@/features/employees'
import { applyServerErrors } from '@/lib/formErrors'
import { useCreateTeamWithMembers, useTeamDirectory, type CreateTeamResult } from '../api'
import { teamFields, teamSchema, type TeamFormValues } from '../teamSchema'
import type { CreateTeamRequest } from '../types'

const DEFAULT_VALUES: TeamFormValues = { name: '', description: '', members: [] }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function announce({ team, added, failed }: CreateTeamResult) {
  if (failed.length === 0) {
    toast.success(`Team “${team.name}” created`, {
      description: added === 0 ? 'No members yet.' : `${plural(added, 'member')} added.`,
    })
    return
  }
  const names = failed.map(({ employee, error }) => `${employee.name} (${getErrorMessage(error)})`).join(', ')
  toast.warning(`Team “${team.name}” created, but ${failed.length} of ${added + failed.length} people weren't added`, {
    description: `${names}. Add them from People with Edit.`,
    duration: 10_000,
  })
}

// Callers render this only for ADMIN and MANAGER. The backend still decides: a 403 shows here.
export function CreateTeamDialog() {
  const [open, setOpen] = useState(false)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const createTeam = useCreateTeamWithMembers()
  const directory = useTeamDirectory()
  const form = useForm<TeamFormValues>({ resolver: zodResolver(teamSchema), defaultValues: DEFAULT_VALUES })
  const pending = createTeam.isPending

  function close() {
    setOpen(false)
    form.reset(DEFAULT_VALUES)
    setFormErrors([])
    createTeam.reset()
  }

  function handleOpenChange(next: boolean) {
    // A closed dialog must never hide a request still in flight.
    if (pending) return
    if (next) setOpen(true)
    else close()
  }

  const onSubmit = form.handleSubmit((values) => {
    setFormErrors([])
    // A blank description is left out rather than sent; the team starts without one.
    const body: CreateTeamRequest = { name: values.name, ...(values.description.trim() && { description: values.description }) }
    createTeam.mutate(
      { body, members: values.members },
      {
        // Also on partial failure: the team exists, so resubmitting would only hit TEAM_NAME_EXISTS.
        onSuccess: (result) => {
          announce(result)
          close()
        },
        onError: (error) => {
          if (hasErrorCode(error, 'TEAM_NAME_EXISTS')) {
            form.setError('name', { type: 'server', message: getErrorMessage(error) }, { shouldFocus: true })
            return
          }
          setFormErrors(applyServerErrors(error, teamFields, form.setError))
        },
      },
    )
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus aria-hidden="true" />
          Create team
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-lg"
        // Escape inside an open suggestion list closes the list, not the dialog.
        onEscapeKeyDown={(event) => {
          if (event.target instanceof Element && event.target.closest('[data-picker-open="true"]')) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>Name the team and pick who's in it. You can add more people later.</DialogDescription>
        </DialogHeader>

        <form id="create-team-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormErrorAlert errors={formErrors} />

          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="team-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="team-name"
                    autoComplete="off"
                    placeholder="Research"
                    aria-invalid={fieldState.invalid}
                    aria-describedby="team-name-error"
                    disabled={pending}
                  />
                  <FieldError id="team-name-error" errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="team-description">Description (optional)</FieldLabel>
                  <Textarea
                    {...field}
                    id="team-description"
                    rows={3}
                    placeholder="What the team works on"
                    aria-invalid={fieldState.invalid}
                    aria-describedby="team-description-error"
                    disabled={pending}
                  />
                  <FieldError id="team-description-error" errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="members"
              control={form.control}
              render={({ field }) => (
                <Field>
                  {/* The picker's input gets its accessible name from `label`; this is the visible one. */}
                  <FieldTitle>Members</FieldTitle>
                  <EmployeeMultiPicker
                    label="Members"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={pending}
                    teamName={(teamId) => directory.data?.byId.get(teamId)?.name}
                    aria-describedby="team-members-hint"
                  />
                  <FieldDescription id="team-members-hint">
                    Adding someone who's already in a team moves them to this one.
                  </FieldDescription>
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="create-team-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {pending ? 'Creating team…' : 'Create team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
