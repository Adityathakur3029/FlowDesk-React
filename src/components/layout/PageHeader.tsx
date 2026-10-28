import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  // Replaces the default <h1>, e.g. with an inline editor. It must render the page's <h1> itself.
  heading?: ReactNode
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, heading, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      {/* React 19 hoists this into <head>. */}
      <title>{`${title} · FlowDesk`}</title>
      <div className="flex grow flex-col gap-1">
        {heading ?? <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
