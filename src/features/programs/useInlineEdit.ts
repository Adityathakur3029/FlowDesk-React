import { useRef, useState } from 'react'

// Open/closed state of one inline editor on the program page. Closing (saved or cancelled) puts focus
// back on the button that opened it, which is back in the DOM once the editor is gone.
export function useInlineEdit() {
  const [editing, setEditing] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return {
    editing,
    triggerRef,
    open: () => setEditing(true),
    close: () => {
      setEditing(false)
      requestAnimationFrame(() => triggerRef.current?.focus())
    },
  }
}
