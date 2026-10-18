import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageLoaderProps {
  label?: string
  fullScreen?: boolean
}

export function PageLoader({ label = 'Loading…', fullScreen = false }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-3 p-8 text-sm text-muted-foreground',
        fullScreen && 'min-h-svh',
      )}
    >
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
