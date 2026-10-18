import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginationProps {
  offset: number
  limit: number
  total: number
  pageSize: number // rows on the current page
  disabled?: boolean
  onOffsetChange: (offset: number) => void
}

export function Pagination({ offset, limit, total, pageSize, disabled = false, onOffsetChange }: PaginationProps) {
  if (total <= limit && offset === 0) return null

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground" aria-live="polite">
        Showing {offset + 1}–{offset + pageSize} of {total}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || offset === 0}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft aria-hidden="true" />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || offset + limit >= total}
          onClick={() => onOffsetChange(offset + limit)}
        >
          Next
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
