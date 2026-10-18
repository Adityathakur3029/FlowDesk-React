import { AlertCircle } from 'lucide-react'
import { getErrorMessage } from '@/api/errors'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  error: unknown
  title?: string
  onRetry?: () => void
  retrying?: boolean
}

export function ErrorState({ error, title = 'Something went wrong', onRetry, retrying = false }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{getErrorMessage(error)}</AlertDescription>
      </Alert>
      {onRetry && (
        <Button type="button" variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying ? 'Retrying…' : 'Retry'}
        </Button>
      )}
    </div>
  )
}
