import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { getErrorMessage, isApiError } from '@/api/errors'
import { authKeys } from '@/auth/api'
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
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { teamKeys, useSetEmployeeTeam, useTeamDirectory } from '@/features/teams'
import { applyServerErrors } from '@/lib/formErrors'
import { ROLE_LABELS } from '@/lib/roles'
import { employeeKeys, useUpdateEmployee } from '../api'
import {
  editEmployeeFields,
  editEmployeeSchema,
  NO_TEAM,
  toEditValues,
  toTeamId,
  type EditEmployeeValues,
} from '../employeeSchema'
import type { Employee, UpdateEmployeeRequest } from '../types'

const ROLE_OPTIONS = ['MEMBER', 'MANAGER', 'ADMIN'] as const

// The fields that differ from the employee as last saved. Only these go in the PATCH.
function changedDetails(values: EditEmployeeValues, saved: Employee): UpdateEmployeeRequest {
  const name = values.name.trim()
  return {
    ...(name !== saved.name && { name }),
    ...(values.role !== saved.role && { role: values.role }),
    ...(values.isActive !== saved.isActive && { isActive: values.isActive }),
  }
}

interface EditEmployeeDialogProps {
  employee: Employee
  // ADMIN: name, role and active status (PATCH /employees/{id} is ADMIN only). Otherwise only the team.
  canEditDetails: boolean
  isSelf: boolean
}

// Rendered for ADMIN and MANAGER. Every disabled field is a UX hint: the backend still answers
// 403 FORBIDDEN, 409 SELF_LOCKOUT or 409 LAST_ADMIN, and those show here.
export function EditEmployeeDialog({ employee, canEditDetails, isSelf }: EditEmployeeDialogProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [formErrors, setFormErrors] = useState<string[]>([])
  // The employee as last saved. After a PATCH succeeds and the team change fails, a retry only resends the team.
  const [saved, setSaved] = useState(employee)
  const updateEmployee = useUpdateEmployee()
  const setTeam = useSetEmployeeTeam()
  const directory = useTeamDirectory()
  const form = useForm<EditEmployeeValues>({ resolver: zodResolver(editEmployeeSchema), defaultValues: toEditValues(employee) })
  const values = useWatch({ control: form.control }) as EditEmployeeValues
  const pending = form.formState.isSubmitting

  const details = changedDetails(values, saved)
  const teamChanged = toTeamId(values.teamId) !== saved.teamId
  const hasChanges = Object.keys(details).length > 0 || teamChanged

  const detailsHint = canEditDetails ? undefined : 'Only admins can change this.'
  const selfHint = detailsHint ?? (isSelf ? "You can't change your own role or deactivate yourself." : undefined)
  let teamHint: string | undefined
  if (!values.isActive) teamHint = 'Reactivate them to change their team.'
  else if (directory.isPending) teamHint = 'Loading teams…'
  else if (directory.isError) teamHint = "Couldn't load teams."
  const teams = directory.data?.teams ?? []
  const savedTeamUnknown = saved.teamId !== null && directory.data !== undefined && !directory.data.byId.has(saved.teamId)

  function handleOpenChange(next: boolean) {
    // A closed dialog must never hide a request still in flight.
    if (pending) return
    if (next) {
      setSaved(employee)
      form.reset(toEditValues(employee))
      setFormErrors([])
    }
    setOpen(next)
  }

  function invalidateSaved() {
    void queryClient.invalidateQueries({ queryKey: employeeKeys.all })
    // Deactivating or reactivating changes member counts.
    void queryClient.invalidateQueries({ queryKey: teamKeys.all })
    // The user menu shows the signed-in employee's name.
    if (isSelf) void queryClient.invalidateQueries({ queryKey: authKeys.me() })
  }

  const onSubmit = form.handleSubmit(async (submitted) => {
    setFormErrors([])
    const patch = changedDetails(submitted, saved)
    const toTeamIdValue = toTeamId(submitted.teamId)
    let current = saved

    // PATCH first: reactivating someone and moving them in one save needs them active before the PUT.
    if (Object.keys(patch).length > 0) {
      try {
        current = await updateEmployee.mutateAsync({ id: employee.id, body: patch })
      } catch (error) {
        if (isApiError(error) && error.status === 404) invalidateSaved()
        setFormErrors(applyServerErrors(error, editEmployeeFields, form.setError))
        return
      }
      setSaved(current)
      form.reset({ ...toEditValues(current), teamId: submitted.teamId })
      invalidateSaved()
    }

    if (toTeamIdValue !== current.teamId) {
      try {
        await setTeam.mutateAsync({ employeeId: employee.id, fromTeamId: current.teamId, toTeamId: toTeamIdValue })
      } catch (error) {
        const message = getErrorMessage(error)
        setFormErrors([
          current === saved ? message : `Saved ${current.name}'s details, but their team couldn't be changed: ${message}`,
        ])
        return
      }
    }

    toast.success(`Saved changes to ${current.name}`)
    setOpen(false)
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${employee.name}`}>
          <Pencil aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {saved.name}</DialogTitle>
          <DialogDescription>{saved.emailId}</DialogDescription>
        </DialogHeader>

        <form id="edit-employee-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormErrorAlert errors={formErrors} />

          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} data-disabled={!canEditDetails || undefined}>
                  <FieldLabel htmlFor="edit-employee-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="edit-employee-name"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                    aria-describedby="edit-employee-name-hint edit-employee-name-error"
                    disabled={pending || !canEditDetails}
                  />
                  {detailsHint && <FieldDescription id="edit-employee-name-hint">{detailsHint}</FieldDescription>}
                  <FieldError id="edit-employee-name-error" errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="role"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} data-disabled={selfHint ? true : undefined}>
                  <FieldLabel htmlFor="edit-employee-role">Role</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={pending || selfHint !== undefined}
                  >
                    <SelectTrigger
                      id="edit-employee-role"
                      ref={field.ref}
                      onBlur={field.onBlur}
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                      aria-describedby="edit-employee-role-hint edit-employee-role-error"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selfHint && <FieldDescription id="edit-employee-role-hint">{selfHint}</FieldDescription>}
                  <FieldError id="edit-employee-role-error" errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="isActive"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field
                  orientation="horizontal"
                  data-invalid={fieldState.invalid}
                  data-disabled={selfHint ? true : undefined}
                >
                  <Switch
                    id="edit-employee-active"
                    ref={field.ref}
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked)
                      // An inactive employee can't be moved (PUT …/members needs an active one).
                      if (!checked) form.setValue('teamId', saved.teamId ?? NO_TEAM)
                    }}
                    onBlur={field.onBlur}
                    disabled={pending || selfHint !== undefined}
                    aria-invalid={fieldState.invalid}
                    aria-describedby="edit-employee-active-hint edit-employee-active-error"
                  />
                  <FieldContent>
                    <FieldLabel htmlFor="edit-employee-active">Active</FieldLabel>
                    <FieldDescription id="edit-employee-active-hint">
                      {selfHint ?? "Inactive people can't sign in and are hidden from lists."}
                    </FieldDescription>
                    <FieldError id="edit-employee-active-error" errors={[fieldState.error]} />
                  </FieldContent>
                </Field>
              )}
            />

            <Controller
              name="teamId"
              control={form.control}
              render={({ field }) => (
                <Field data-disabled={teamHint ? true : undefined}>
                  <FieldLabel htmlFor="edit-employee-team">Team</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={pending || teamHint !== undefined}
                  >
                    <SelectTrigger
                      id="edit-employee-team"
                      ref={field.ref}
                      onBlur={field.onBlur}
                      className="w-full"
                      aria-describedby="edit-employee-team-hint"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TEAM}>No team</SelectItem>
                      {savedTeamUnknown && <SelectItem value={saved.teamId!}>Unknown team</SelectItem>}
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {teamHint && <FieldDescription id="edit-employee-team-hint">{teamHint}</FieldDescription>}
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="edit-employee-form" disabled={pending || !hasChanges}>
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
