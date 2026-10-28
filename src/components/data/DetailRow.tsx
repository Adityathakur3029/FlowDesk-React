import type { ReactNode, Ref } from 'react'
import { Pencil, type LucideIcon } from 'lucide-react'

// Rows of a details card: a <dl className="grid grid-cols-[auto_minmax(0,1fr)] …"> of icon + label and value.

function DetailTerm({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <dt className="flex items-center gap-2 text-muted-foreground">
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </dt>
  )
}

export function Detail({ icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <>
      <DetailTerm icon={icon} label={label} />
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

interface EditableDetailProps {
  icon: LucideIcon
  label: string
  // Shown, and clickable when canEdit.
  children: ReactNode
  canEdit: boolean
  editing: boolean
  // The inline editor; it takes the full row width.
  editor: ReactNode
  onEdit: () => void
  // The value button's accessible name, e.g. "Edit start date, 1 Oct 2026".
  editLabel: string
  triggerRef: Ref<HTMLButtonElement>
}

// A row whose value is clicked to edit it in place, Jira-style.
export function EditableDetail({ icon, label, children, canEdit, editing, editor, onEdit, editLabel, triggerRef }: EditableDetailProps) {
  return (
    <>
      <DetailTerm icon={icon} label={label} />
      {editing ? (
        <dd className="col-span-2">{editor}</dd>
      ) : (
        <dd className="min-w-0 break-words">
          {canEdit ? (
            <button
              ref={triggerRef}
              type="button"
              onClick={onEdit}
              aria-label={editLabel}
              className="group/detail -mx-1.5 -my-0.5 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="min-w-0">{children}</span>
              <Pencil
                className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/detail:opacity-100 group-focus-visible/detail:opacity-100"
                aria-hidden="true"
              />
            </button>
          ) : (
            children
          )}
        </dd>
      )}
    </>
  )
}

export function NotSet({ children = 'Not set' }: { children?: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>
}
