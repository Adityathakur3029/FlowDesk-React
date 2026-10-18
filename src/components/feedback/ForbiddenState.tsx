import { ShieldX } from 'lucide-react'

interface ForbiddenStateProps {
  description?: string
}

export function ForbiddenState({
  description = 'Ask an admin or manager if you think you should.',
}: ForbiddenStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
      <ShieldX className="size-8 text-muted-foreground" aria-hidden="true" />
      <h2 className="font-medium">You don't have access to this page</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
