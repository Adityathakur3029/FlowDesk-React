import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { getErrorMessage, hasErrorCode } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import { ToneDot } from '@/components/data/ToneBadge'
import { FormErrorAlert } from '@/components/feedback/FormErrorAlert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useTeamDirectory } from '@/features/teams'
import { applyServerErrors } from '@/lib/formErrors'
import { paths } from '@/routes/paths'
import { keyHint, suggestKey } from '@/lib/keys'
import { useCreateProgram } from '../api'
import { programFields, programSchema, type ProgramFormValues } from '../programSchema'
import { PROGRAM_STATUSES, PROGRAM_STATUS_LABELS, PROGRAM_STATUS_TONES } from '../programStatus'
import type { CreateProgramRequest, Program } from '../types'

const defaultValues = (ownerTeamId: string): ProgramFormValues => ({
  name: '',
  key: '',
  ownerTeamId,
  status: 'PLANNED',
  startDate: '',
  endDate: '',
  description: '',
})

// The shared INVALID_DATE_RANGE message is worded for tasks (start and due date).
const END_BEFORE_START = 'The end date must be on or after the start date.'

interface CreateProgramDialogProps {
  // Called after the program is created, e.g. to show the first page, where the newest program is.
  onCreated?: (program: Program) => void
}

// Callers render this only for ADMIN and MANAGER. The backend still decides: a 403 shows here.
export function CreateProgramDialog({ onCreated }: CreateProgramDialogProps) {
  const [open, setOpen] = useState(false)
  const [formErrors, setFormErrors] = useState<string[]>([])
  // The key last suggested from the name. The name only fills the key while it's empty or still this.
  const lastSuggestion = useRef('')
  const { employee } = useAuth()
  const directory = useTeamDirectory()
  const createProgram = useCreateProgram()
  const form = useForm<ProgramFormValues>({ resolver: zodResolver(programSchema), defaultValues: defaultValues('') })
  const key = useWatch({ control: form.control, name: 'key' })
  const pending = createProgram.isPending

  // The signed-in employee's own team, when it's an active team.
  const ownTeamId = employee?.teamId && directory.data?.byId.has(employee.teamId) ? employee.teamId : ''
  const teams = directory.data?.teams ?? []
  const noTeams = directory.isSuccess && teams.length === 0
  const ownerDisabled = pending || directory.isPending || directory.isError || noTeams

  // The directory can finish loading after the dialog opened: preselect the user's team unless they picked one.
  useEffect(() => {
    if (open && ownTeamId && form.getValues('ownerTeamId') === '') form.setValue('ownerTeamId', ownTeamId)
  }, [open, ownTeamId, form])

  // Fields are disabled while the request is pending, and onError runs before they're enabled again,
  // so focusing the first field with a server error waits for the render that shows the new error.
  const submitError = createProgram.error
  useEffect(() => {
    if (!submitError) return
    const invalid = programFields.find((name) => form.getFieldState(name).invalid)
    if (invalid) form.setFocus(invalid)
  }, [submitError, form])

  function close() {
    setOpen(false)
    setFormErrors([])
    createProgram.reset()
  }

  function handleOpenChange(next: boolean) {
    // A closed dialog must never hide a request still in flight.
    if (pending) return
    if (next) {
      form.reset(defaultValues(ownTeamId))
      lastSuggestion.current = ''
      setOpen(true)
    } else {
      close()
    }
  }

  const onSubmit = form.handleSubmit((values) => {
    setFormErrors([])
    // status is always sent, so what the select showed is what's stored. Blank dates and a blank
    // description are left out.
    const body: CreateProgramRequest = {
      ownerTeamId: values.ownerTeamId,
      key: values.key,
      name: values.name,
      status: values.status,
      ...(values.startDate && { startDate: values.startDate }),
      ...(values.endDate && { endDate: values.endDate }),
      ...(values.description.trim() && { description: values.description }),
    }
    createProgram.mutate(body, {
      onSuccess: (program) => {
        // The server's trimmed, uppercased values. Task numbers are global, so only the prefix is promised.
        toast.success(`Program “${program.name}” created`, { description: `Its task keys will start with ${program.key}-.` })
        close()
        onCreated?.(program)
      },
      onError: (error) => {
        // Coded errors carry no field details, so applyServerErrors would put them in the form alert.
        if (hasErrorCode(error, 'OWNER_TEAM_NOT_FOUND')) {
          form.setValue('ownerTeamId', '')
          form.setError('ownerTeamId', { type: 'server', message: getErrorMessage(error) })
          return
        }
        if (hasErrorCode(error, 'PROGRAM_KEY_EXISTS')) {
          form.setError('key', { type: 'server', message: getErrorMessage(error) })
          return
        }
        if (hasErrorCode(error, 'INVALID_DATE_RANGE')) {
          form.setError('endDate', { type: 'server', message: END_BEFORE_START })
          return
        }
        setFormErrors(applyServerErrors(error, programFields, form.setError))
      },
    })
  })

  let ownerHint = 'The owner team is for information; anyone can work on the program.'
  if (directory.isError) ownerHint = "Couldn't load teams."
  else if (noTeams) ownerHint = 'There are no teams yet. A program needs an owner team, so'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus aria-hidden="true" />
          Create program
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a program</DialogTitle>
          <DialogDescription>Programs group related tasks. Each one is owned by a team.</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="create-program-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
            <FormErrorAlert errors={formErrors} />

            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="program-name">Name</FieldLabel>
                    <Input
                      {...field}
                      onChange={(event) => {
                        field.onChange(event)
                        const suggestion = suggestKey(event.target.value)
                        const current = form.getValues('key')
                        if (current === '' || current === lastSuggestion.current) {
                          form.setValue('key', suggestion, { shouldValidate: form.formState.isSubmitted })
                        }
                        lastSuggestion.current = suggestion
                      }}
                      id="program-name"
                      autoComplete="off"
                      placeholder="Marketing Research"
                      aria-invalid={fieldState.invalid}
                      aria-describedby="program-name-error"
                      disabled={pending}
                    />
                    <FieldError id="program-name-error" errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="key"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="program-key">Key</FieldLabel>
                    <Input
                      {...field}
                      onChange={(event) => {
                        // Uppercase in the DOM first, keeping the caret where it was, so React doesn't move it to the end.
                        const input = event.target
                        const { selectionStart, selectionEnd } = input
                        input.value = input.value.toUpperCase()
                        input.setSelectionRange(selectionStart, selectionEnd)
                        field.onChange(input.value)
                      }}
                      id="program-key"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="MKT"
                      className="font-mono uppercase"
                      aria-invalid={fieldState.invalid}
                      aria-describedby="program-key-hint program-key-error"
                      disabled={pending}
                    />
                    <FieldDescription id="program-key-hint">{keyHint(key)}</FieldDescription>
                    <FieldError id="program-key-error" errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  name="ownerTeamId"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} data-disabled={ownerDisabled && !pending ? true : undefined}>
                      <FieldLabel htmlFor="program-owner-team">Owner team</FieldLabel>
                      <Select name={field.name} value={field.value} onValueChange={field.onChange} disabled={ownerDisabled}>
                        <SelectTrigger
                          id="program-owner-team"
                          ref={field.ref}
                          onBlur={field.onBlur}
                          className="w-full"
                          aria-invalid={fieldState.invalid}
                          aria-describedby="program-owner-team-hint program-owner-team-error"
                        >
                          <SelectValue placeholder={directory.isPending ? 'Loading teams…' : 'Pick a team'} />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldDescription id="program-owner-team-hint">
                        {ownerHint}
                        {directory.isError && (
                          <>
                            {' '}
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0"
                              onClick={() => void directory.refetch()}
                              disabled={directory.isFetching}
                            >
                              Try again
                            </Button>
                          </>
                        )}
                        {noTeams && (
                          <>
                            {' '}
                            <Link to={paths.teams} onClick={close}>
                              create a team
                            </Link>{' '}
                            first.
                          </>
                        )}
                      </FieldDescription>
                      <FieldError id="program-owner-team-error" errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <Controller
                  name="status"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="program-status">Status</FieldLabel>
                      <Select name={field.name} value={field.value} onValueChange={field.onChange} disabled={pending}>
                        <SelectTrigger
                          id="program-status"
                          ref={field.ref}
                          onBlur={field.onBlur}
                          className="w-full"
                          aria-invalid={fieldState.invalid}
                          aria-describedby="program-status-error"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROGRAM_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              <ToneDot tone={PROGRAM_STATUS_TONES[status]} />
                              {PROGRAM_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError id="program-status-error" errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  name="startDate"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="program-start-date">Start date (optional)</FieldLabel>
                      <Input
                        {...field}
                        id="program-start-date"
                        type="date"
                        aria-invalid={fieldState.invalid}
                        aria-describedby="program-start-date-error"
                        disabled={pending}
                      />
                      <FieldError id="program-start-date-error" errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <Controller
                  name="endDate"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="program-end-date">End date (optional)</FieldLabel>
                      <Input
                        {...field}
                        id="program-end-date"
                        type="date"
                        aria-invalid={fieldState.invalid}
                        aria-describedby="program-end-date-error"
                        disabled={pending}
                      />
                      <FieldError id="program-end-date-error" errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="program-description">Description (optional)</FieldLabel>
                    <Textarea
                      {...field}
                      id="program-description"
                      rows={4}
                      placeholder="What the program is for"
                      aria-invalid={fieldState.invalid}
                      aria-describedby="program-description-error"
                      disabled={pending}
                    />
                    <FieldError id="program-description-error" errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="create-program-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {pending ? 'Creating program…' : 'Create program'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
