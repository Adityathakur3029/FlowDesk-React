import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Form-level errors: what applyServerErrors() couldn't put on a field, or a 403/409/5xx message.
export function FormErrorAlert({ errors }: { errors: readonly string[] }) {
  if (errors.length === 0) return null
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertDescription>
        {errors.length === 1 ? (
          errors[0]
        ) : (
          <ul className="list-disc pl-4">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  )
}
