import { useRef, useState, type KeyboardEvent } from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CommandItem, CommandList } from '@/components/ui/command'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'
import { useEmployeeSearch } from '../api'
import type { Employee } from '../types'

const SEARCH_DEBOUNCE_MS = 250
const MAX_QUERY_LENGTH = 100 // GET /employees `q` is 1-100 characters
const MAX_SUGGESTIONS = 8

// What a chip needs. A picked person is an Employee from the search; an existing value can be less, such as
// a task's assignee (an EmployeeSummary).
type PickedPerson = Pick<Employee, 'id' | 'name' | 'emailId'>

interface EmployeeMultiPickerProps<T extends PickedPerson> {
  // Accessible name of the search input (cmdk gives the input its own id, so a visible <label> can't point at it).
  label: string
  value: readonly T[]
  onChange: (value: (T | Employee)[]) => void
  disabled?: boolean
  invalid?: boolean
  placeholder?: string
  // Team name for a suggestion's "In {team}" hint; the picker doesn't load teams itself.
  teamName?: (teamId: string) => string | undefined
  // Most people that can be picked, e.g. 1 for an assignee. Once reached, the search input is hidden.
  max?: number
  'aria-describedby'?: string
}

// Gmail-style recipient box: type to search GET /employees?q=, pick with Enter or a click, and each pick
// becomes a chip with a remove button. Already-picked people aren't suggested again.
export function EmployeeMultiPicker<T extends PickedPerson = Employee>({
  label,
  value,
  onChange,
  disabled = false,
  invalid = false,
  placeholder = 'Search by name or email',
  teamName,
  max = Infinity,
  'aria-describedby': describedBy,
}: EmployeeMultiPickerProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const q = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS)
  const search = useEmployeeSearch(q)

  const full = value.length >= max
  const open = focused && !disabled && !full && text.trim() !== ''
  const pickedIds = new Set(value.map((employee) => employee.id))
  const suggestions = (search.data?.data ?? []).filter((e) => !pickedIds.has(e.id)).slice(0, MAX_SUGGESTIONS)

  function pick(employee: Employee) {
    onChange([...value, employee])
    setText('')
    if (value.length + 1 < max) {
      inputRef.current?.focus()
    } else {
      // The input goes away once the picker is full, so keep focus in the box on the new chip's remove button.
      requestAnimationFrame(() => boxRef.current?.querySelector<HTMLButtonElement>('li:last-child button')?.focus())
    }
  }

  function remove(id: string) {
    onChange(value.filter((employee) => employee.id !== id))
    // When the picker was full, the input isn't rendered yet; it comes back on the next render.
    if (inputRef.current) inputRef.current.focus()
    else requestAnimationFrame(() => inputRef.current?.focus())
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      // The dialog ignores this Escape (see data-picker-open), so it only closes the list.
      setText('')
    } else if (event.key === 'Backspace' && text === '' && value.length > 0) {
      remove(value[value.length - 1].id)
    }
  }

  let status: string | null = null
  if (search.isError) status = "Couldn't search people. Try again."
  else if (search.isPending) status = 'Searching…'
  else if (suggestions.length === 0) status = `No one matches “${q}”.`

  return (
    <CommandPrimitive
      shouldFilter={false}
      label={label}
      onKeyDown={handleKeyDown}
      data-picker-open={open}
      className="relative"
    >
      {/* Clicking anywhere in the box focuses the input, like a single text field. */}
      <div
        ref={boxRef}
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'flex max-h-32 min-h-8 w-full flex-wrap items-center gap-1.5 overflow-y-auto rounded-lg border border-input px-1.5 py-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30',
          invalid && 'border-destructive ring-3 ring-destructive/20',
          disabled && 'cursor-not-allowed bg-input/50 opacity-50',
        )}
      >
        {value.length > 0 && (
          <ul aria-label={`Selected ${label.toLowerCase()}`} className="contents">
            {value.map((employee) => (
              <li
                key={employee.id}
                title={employee.emailId}
                className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-secondary py-0.5 pr-0.5 pl-2.5 text-sm text-secondary-foreground"
              >
                <span className="truncate">{employee.name}</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    remove(employee.id)
                  }}
                  disabled={disabled}
                  aria-label={`Remove ${employee.name}`}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {!full && (
          <CommandPrimitive.Input
            ref={inputRef}
            value={text}
            onValueChange={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={MAX_QUERY_LENGTH}
            disabled={disabled}
            placeholder={value.length === 0 ? placeholder : undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className="h-6 min-w-32 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
          />
        )}
      </div>

      {open && (
        // preventDefault keeps focus in the input, so the list doesn't close before a click lands.
        <div
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full z-50 mt-1 w-full rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {status ? (
            <p role="status" className="px-2 py-1.5 text-sm text-muted-foreground">
              {status}
            </p>
          ) : (
            <CommandList label="People">
              {suggestions.map((employee) => {
                const team = employee.teamId ? teamName?.(employee.teamId) : undefined
                return (
                  <CommandItem key={employee.id} value={employee.id} onSelect={() => pick(employee)}>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{employee.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{employee.emailId}</span>
                    </div>
                    {team && <Badge variant="outline">In {team}</Badge>}
                  </CommandItem>
                )
              })}
            </CommandList>
          )}
        </div>
      )}
    </CommandPrimitive>
  )
}
