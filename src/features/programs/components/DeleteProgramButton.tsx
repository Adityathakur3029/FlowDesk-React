import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getErrorMessage, isApiError } from '@/api/errors'
import { ConfirmDeleteDialog } from '@/components/feedback/ConfirmDeleteDialog'
import { paths } from '@/routes/paths'
import { useDeleteProgram } from '../api'
import type { Program } from '../types'

// The page only shows this to ADMIN (contract); a 403 is still handled.
export function DeleteProgramButton({ program }: { program: Program }) {
  const navigate = useNavigate()
  const [errors, setErrors] = useState<string[]>([])
  const deleteProgram = useDeleteProgram(program.id)

  function confirm() {
    setErrors([])
    deleteProgram.mutate(undefined, {
      onSuccess: () => {
        toast.success(`${program.name} deleted`)
        void navigate(paths.programs)
      },
      onError: (error) => {
        // Someone else deleted it first: the outcome is the same.
        if (isApiError(error) && error.status === 404) {
          toast.info('This program has already been deleted.')
          void navigate(paths.programs)
          return
        }
        setErrors([getErrorMessage(error)])
      },
    })
  }

  return (
    <ConfirmDeleteDialog
      triggerLabel={`Delete program ${program.name}`}
      title={`Delete ${program.name}?`}
      description={`The program, its tasks and its comments will be hidden. Its key ${program.key} stays taken, and there's no way to restore it yet.`}
      confirmLabel="Delete program"
      pending={deleteProgram.isPending}
      errors={errors}
      onConfirm={confirm}
      onClose={() => setErrors([])}
    />
  )
}
