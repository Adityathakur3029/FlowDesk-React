import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Program keys are brand amber, task keys dark blue; white text clears 4.5:1 on both.
const KIND_CLASSES = {
  program: 'bg-primary text-primary-foreground',
  task: 'bg-blue-800 text-white',
}

// A program or task key (MKT, MKT-3) on a solid fill. Square corners keep it apart from the
// rounded status pills next to it.
export function KeyBadge({
  kind,
  children,
  className,
}: {
  kind: keyof typeof KIND_CLASSES
  children: ReactNode
  className?: string
}) {
  return <Badge className={cn('rounded-md font-mono font-semibold', KIND_CLASSES[kind], className)}>{children}</Badge>
}
