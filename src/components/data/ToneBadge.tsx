import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { TONE_BADGE_CLASSES, TONE_DOT_CLASSES, type Tone } from '@/lib/tones'

// A coloured pill with a leading dot, for statuses. The text says what the colour means.
export function ToneBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn('border-transparent', TONE_BADGE_CLASSES[tone], className)}>
      <ToneDot tone={tone} />
      {children}
    </Badge>
  )
}

// The dot alone, e.g. in a select option next to its label.
export function ToneDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT_CLASSES[tone], className)} />
}
