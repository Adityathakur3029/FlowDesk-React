import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { hasTaskFilters, type TaskSearch } from '../searchParams'
import { TASK_STATUSES, TASK_STATUS_LABELS } from '../taskDisplay'
import type { TaskStatus } from '../types'

const ALL = 'ALL'
const SEARCH_DEBOUNCE_MS = 300
const MAX_QUERY_LENGTH = 100 // GET …/tasks `q` is 1-100 characters

export type UpdateTaskSearch = (patch: Partial<TaskSearch>, options?: { replace?: boolean }) => void

interface TaskFiltersProps {
  search: TaskSearch
  // A functional URL update, so a late search can't undo a status change made meanwhile.
  onChange: UpdateTaskSearch
}

// Every filter change goes back to the first page (updateTaskSearch drops offset).
export function TaskFilters({ search, onChange }: TaskFiltersProps) {
  const [text, setText] = useState(search.q ?? '')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // The URL's q can change by itself (Clear filters, Back): show it, unless it's what's being typed.
  const [shownQ, setShownQ] = useState(search.q)
  if (search.q !== shownQ) {
    setShownQ(search.q)
    if ((search.q ?? '') !== text.trim()) setText(search.q ?? '')
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  function handleSearch(value: string) {
    setText(value)
    clearTimeout(timer.current)
    // replace: typing shouldn't add a history entry per pause.
    timer.current = setTimeout(() => onChange({ q: value.trim() || undefined }, { replace: true }), SEARCH_DEBOUNCE_MS)
  }

  function clearFilters() {
    clearTimeout(timer.current)
    setText('')
    onChange({ q: undefined, status: undefined })
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="relative">
        <Label htmlFor="task-search" className="sr-only">
          Search tasks
        </Label>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="task-search"
          type="search"
          value={text}
          onChange={(event) => handleSearch(event.target.value)}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Search by title or key"
          autoComplete="off"
          className="w-64 pl-8"
        />
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="task-status-filter">Status</Label>
        <Select
          value={search.status ?? ALL}
          onValueChange={(value) => onChange({ status: value === ALL ? undefined : (value as TaskStatus) })}
        >
          <SelectTrigger id="task-status-filter" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {TASK_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasTaskFilters(search) && (
        <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
