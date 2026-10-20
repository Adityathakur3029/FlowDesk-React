import { useState, type ReactElement, type ReactNode } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { FormErrorAlert } from './FormErrorAlert'

interface ConfirmDeleteDialogProps {
  // Accessible name of the default "Delete" trigger, e.g. "Delete task MKT-7".
  triggerLabel?: string
  // Replaces the default outline "Delete" button, e.g. a small ghost one under a comment.
  trigger?: ReactElement
  title: string
  description: ReactNode
  // The confirm button, e.g. "Delete task".
  confirmLabel: string
  pending: boolean
  // A failed delete that keeps the dialog open (403, 5xx, network).
  errors: readonly string[]
  onConfirm: () => void
  // Called when the dialog closes, e.g. to clear the errors.
  onClose: () => void
}

// A "Delete" button that asks first. The caller runs the request; on success it leaves the page or removes
// what was deleted, which unmounts the dialog. Until then it stays open and can't be closed.
export function ConfirmDeleteDialog({
  triggerLabel,
  trigger,
  title,
  description,
  confirmLabel,
  pending,
  errors,
  onConfirm,
  onClose,
}: ConfirmDeleteDialogProps) {
  const [open, setOpen] = useState(false)

  function handleOpenChange(next: boolean) {
    // A closed dialog must never hide a request still in flight.
    if (pending) return
    setOpen(next)
    if (!next) onClose()
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm" aria-label={triggerLabel}>
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <FormErrorAlert errors={errors} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {/* Not AlertDialogAction: that closes the dialog on click, before the request has answered. */}
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
            {pending ? 'Deleting…' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
