import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Mail, UserPlus } from 'lucide-react'
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { applyServerErrors } from '@/lib/formErrors'
import { ROLE_LABELS } from '@/lib/roles'
import { useCreateInvite } from '../api'
import { inviteFields, inviteSchema, type InviteFormValues } from '../inviteSchema'

const DEFAULT_VALUES: InviteFormValues = { email: '', name: '', role: 'MEMBER' }

// Member first: it's the default and the most common invite.
const ROLE_OPTIONS = ['MEMBER', 'MANAGER', 'ADMIN'] as const

const formatExpiry = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

// Callers render this only for roles that may invite (ADMIN, MANAGER). The backend still decides: a 403 shows here.
export function InviteMemberDialog() {
  const [open, setOpen] = useState(false)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const createInvite = useCreateInvite()
  const form = useForm<InviteFormValues>({ resolver: zodResolver(inviteSchema), defaultValues: DEFAULT_VALUES })
  const pending = createInvite.isPending

  function handleOpenChange(next: boolean) {
    // A closed dialog must never hide a request still in flight.
    if (pending) return
    setOpen(next)
    if (!next) {
      form.reset(DEFAULT_VALUES)
      setFormErrors([])
      createInvite.reset()
    }
  }

  const onSubmit = form.handleSubmit((values) => {
    setFormErrors([])
    createInvite.mutate(values, {
      onSuccess: (invite) => {
        toast.success(`Invite sent to ${invite.emailId}`, {
          description: `The link expires ${formatExpiry(invite.expiresAt)}.`,
        })
        setOpen(false)
        form.reset(DEFAULT_VALUES)
        createInvite.reset()
      },
      onError: (error) => {
        if (hasErrorCode(error, 'EMPLOYEE_EXISTS')) {
          form.setError('email', { type: 'server', message: getErrorMessage(error) }, { shouldFocus: true })
          return
        }
        setFormErrors(applyServerErrors(error, inviteFields, form.setError))
      },
    })
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button">
          <UserPlus aria-hidden="true" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            They'll get an email with a link to join FlowDesk. The link works for 72 hours.
          </DialogDescription>
        </DialogHeader>

        <form id="invite-member-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormErrorAlert errors={formErrors} />

          <FieldGroup>
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="invite-email"
                    type="email"
                    autoComplete="off"
                    placeholder="jane.doe@saajha.org"
                    aria-invalid={fieldState.invalid}
                    aria-describedby="invite-email-hint invite-email-error"
                    disabled={pending}
                  />
                  <FieldDescription id="invite-email-hint">Must be an @saajha.org address.</FieldDescription>
                  <FieldError id="invite-email-error" errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="invite-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="invite-name"
                    autoComplete="off"
                    placeholder="Jane Doe"
                    aria-invalid={fieldState.invalid}
                    aria-describedby="invite-name-error"
                    disabled={pending}
                  />
                  <FieldError id="invite-name-error" errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="role"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="invite-role">Role</FieldLabel>
                  <Select name={field.name} value={field.value} onValueChange={field.onChange} disabled={pending}>
                    <SelectTrigger
                      id="invite-role"
                      ref={field.ref}
                      onBlur={field.onBlur}
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                      aria-describedby="invite-role-error"
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
                  <FieldError id="invite-role-error" errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="invite-member-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Mail aria-hidden="true" />}
            {pending ? 'Sending invite…' : 'Send invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
