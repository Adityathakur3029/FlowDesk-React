import type { ReportScope } from './types'

// The Overview's "Show" filter: which tasks the report's task numbers cover (GET /reports/overview?scope).
export const REPORT_SCOPES = [
  { value: 'all', label: 'All' },
  { value: 'programs', label: 'Programs' },
  { value: 'boards', label: 'Boards' },
] as const satisfies readonly { value: ReportScope; label: string }[]

export const DEFAULT_SCOPE: ReportScope = 'all'

// URL hygiene only: an unknown value falls back to All.
export function parseScope(params: URLSearchParams): ReportScope {
  return REPORT_SCOPES.find((scope) => scope.value === params.get('scope'))?.value ?? DEFAULT_SCOPE
}

// Adds ?scope to the period's parameters. All is the default, so it's left out.
export function withScope(params: URLSearchParams, scope: ReportScope): URLSearchParams {
  const next = new URLSearchParams(params)
  if (scope === DEFAULT_SCOPE) next.delete('scope')
  else next.set('scope', scope)
  return next
}

// Where the task numbers come from, for card descriptions: "across programs and boards".
export const SCOPE_TASKS_WHERE: Record<ReportScope, string> = {
  all: 'across programs and boards',
  programs: 'across all programs',
  boards: 'across all boards',
}
