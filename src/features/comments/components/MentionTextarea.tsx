import { useCallback, useId, useRef, useState, type ComponentProps, type KeyboardEvent, type Ref } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { useEmployeeSearch, type Employee } from '@/features/employees'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { initials } from '@/lib/initials'
import { cn } from '@/lib/utils'
import { findMentionQuery, insertMention } from '../mentions'
import type { MentionedPerson } from '../types'

const SEARCH_DEBOUNCE_MS = 200
const MAX_SUGGESTIONS = 6

interface MentionTextareaProps extends Omit<ComponentProps<'textarea'>, 'value' | 'onChange' | 'ref'> {
  value: string
  onChange: (value: string) => void
  // Someone was picked from the list; their "@Name" is now in the text.
  onMention: (person: MentionedPerson) => void
  ref?: Ref<HTMLTextAreaElement>
}

// A textarea where typing "@" and a name lists matching people (GET /employees?q=, active employees only).
// Arrow keys move, Enter or Tab picks, Escape closes; a click picks too. The pick is inserted as "@Name".
export function MentionTextarea({ value, onChange, onMention, ref, onKeyDown, onBlur, disabled, className, ...props }: MentionTextareaProps) {
  const listId = useId()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  // null while the textarea isn't focused, which closes the list.
  const [caret, setCaret] = useState<number | null>(null)
  // The "@" whose list was closed (Escape or a pick), so it doesn't reopen while the caret stays in it.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [active, setActive] = useState(0)

  const mention = caret === null || disabled ? null : findMentionQuery(value, caret)
  if (dismissedAt !== null && mention?.start !== dismissedAt) setDismissedAt(null)
  const open = mention !== null && mention.start !== dismissedAt

  const q = useDebouncedValue(open ? mention.query.trim() : '', SEARCH_DEBOUNCE_MS)
  const search = useEmployeeSearch(q)
  const people = open && q !== '' ? (search.data?.data ?? []).slice(0, MAX_SUGGESTIONS) : []

  // A new query starts at the top of its list.
  const [shownQ, setShownQ] = useState(q)
  if (shownQ !== q) {
    setShownQ(q)
    setActive(0)
  }
  const activeIndex = Math.min(active, people.length - 1)

  const setRefs = useCallback(
    (element: HTMLTextAreaElement | null) => {
      textareaRef.current = element
      if (typeof ref === 'function') ref(element)
      else if (ref) ref.current = element
    },
    [ref],
  )

  function pick(person: Employee) {
    if (!mention || caret === null) return
    const next = insertMention(value, mention.start, caret, person.name)
    onChange(next.text)
    onMention({ id: person.id, name: person.name })
    setDismissedAt(mention.start)
    setCaret(next.caret)
    // Put the caret after the name once React has rendered the new text.
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(next.caret, next.caret)
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      const modified = event.ctrlKey || event.metaKey || event.altKey
      if (event.key === 'Escape') {
        event.preventDefault()
        setDismissedAt(mention.start)
        return
      }
      if (people.length > 0 && !modified) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const step = event.key === 'ArrowDown' ? 1 : -1
          setActive((activeIndex + step + people.length) % people.length)
          return
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault()
          pick(people[activeIndex])
          return
        }
      }
    }
    onKeyDown?.(event)
  }

  let status: string | null = null
  if (open) {
    if (q === '') status = 'Type a name to mention someone.'
    else if (search.isError) status = "Couldn't search people. Try again."
    else if (search.isPending) status = 'Searching…'
    else if (people.length === 0) status = `No one matches “${q}”.`
  }

  const optionId = (index: number) => `${listId}-option-${index}`

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={setRefs}
        value={value}
        disabled={disabled}
        className={className}
        onChange={(event) => {
          onChange(event.target.value)
          setCaret(event.target.selectionStart)
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onBlur={(event) => {
          setCaret(null)
          onBlur?.(event)
        }}
        onKeyDown={handleKeyDown}
        aria-autocomplete="list"
        aria-controls={people.length > 0 ? listId : undefined}
        aria-activedescendant={people.length > 0 ? optionId(activeIndex) : undefined}
      />

      {open && (
        // preventDefault keeps focus in the textarea, so the list doesn't close before a click lands.
        <div
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full left-0 z-50 mt-1 w-72 max-w-full rounded-lg border border-blue-200 bg-popover p-1 text-popover-foreground shadow-md dark:border-blue-900"
        >
          {status ? (
            <p role="status" className="px-2 py-1.5 text-sm text-muted-foreground">
              {status}
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="People to mention">
              {people.map((person, index) => (
                <li
                  key={person.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => pick(person)}
                  onMouseMove={() => setActive(index)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                    index === activeIndex && 'bg-blue-50 text-blue-900 dark:bg-blue-500/20 dark:text-blue-100',
                  )}
                >
                  <Avatar size="sm" aria-hidden="true">
                    <AvatarFallback className="bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200">
                      {initials(person.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{person.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{person.emailId}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
