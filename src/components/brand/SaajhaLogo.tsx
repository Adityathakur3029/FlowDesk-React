import { cn } from '@/lib/utils'

interface SaajhaLogoProps {
  size?: number
  className?: string
}

export function SaajhaLogo({ size = 40, className }: SaajhaLogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Saajha"
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', className)}
    />
  )
}
