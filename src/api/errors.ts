import type { components } from './schema'

type ErrorResponse = components['schemas']['ErrorResponse']
type ValidationErrorResponse = components['schemas']['ValidationErrorResponse']

// Source: components.schemas.ErrorResponse.code description in /openapi.json — keep in sync.
// The contract types `code` as a plain string, so this list is copied by hand (spec 01, contract gap 1).
const BACKEND_ERROR_CODES = [
  'INVALID_INVITE_TOKEN',
  'INVITE_REVOKED',
  'INVITE_ALREADY_ACCEPTED',
  'INVITE_PENDING',
  'INVITE_EXPIRED',
  'EMPLOYEE_EXISTS',
  'EMAIL_DELIVERY_FAILED',
  'AUTH_REQUIRED',
  'INVALID_AUTH_TOKEN',
  'FORBIDDEN',
  'INVALID_GOOGLE_TOKEN',
  'GOOGLE_EMAIL_NOT_VERIFIED',
  'EMAIL_DOMAIN_NOT_ALLOWED',
  'NOT_INVITED',
  'ACCOUNT_INACTIVE',
  'GOOGLE_ACCOUNT_MISMATCH',
  'GOOGLE_UNAVAILABLE',
  'PROGRAM_KEY_EXISTS',
  'ASSIGNEE_NOT_FOUND',
  'INVALID_DATE_RANGE',
  'TASK_BLOCKED',
  'TASK_DONE',
  'DEPENDENCY_TASK_NOT_FOUND',
  'DEPENDENCY_OTHER_PROGRAM',
  'SELF_DEPENDENCY',
  'DEPENDENCY_EXISTS',
  'DEPENDENCY_LIMIT_REACHED',
  'DEPENDENCY_CYCLE',
  'PARENT_COMMENT_NOT_FOUND',
  'PARENT_TARGET_MISMATCH',
  'NESTED_REPLY',
  'TOO_MANY_MENTIONS',
  'MENTION_NOT_FOUND',
  'TEAM_NAME_EXISTS',
  'TEAM_OWNS_PROGRAMS',
  'OWNER_TEAM_NOT_FOUND',
  'SELF_LOCKOUT',
  'LAST_ADMIN',
] as const

// NETWORK_ERROR is frontend-only (status 0): the request never got a response.
export const KNOWN_ERROR_CODES = [...BACKEND_ERROR_CODES, 'NETWORK_ERROR'] as const

export type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number]

// One user-facing message per code. `null` = the backend's message is more specific (it names the
// task, key or id), so show that instead.
export const ERROR_MESSAGES: Record<KnownErrorCode, string | null> = {
  INVALID_INVITE_TOKEN: "This invite link isn't valid. Ask for a new invite.",
  INVITE_REVOKED:
    "This invite was replaced by a newer one or couldn't be delivered. Use the latest invite email or ask for a new invite.",
  INVITE_ALREADY_ACCEPTED: 'This invite has already been accepted. Sign in with Google.',
  INVITE_PENDING: 'An invite for this email is already being created. Try again in a moment.',
  INVITE_EXPIRED: 'This invite has expired. Ask for a new invite.',
  EMPLOYEE_EXISTS: 'An employee with this email already exists.',
  EMAIL_DELIVERY_FAILED: "The invite email couldn't be sent, so the invite was cancelled. Try again.",
  AUTH_REQUIRED: 'Sign in to continue.',
  INVALID_AUTH_TOKEN: 'Your session has expired. Sign in again.',
  FORBIDDEN: "You don't have permission to do that.",
  INVALID_GOOGLE_TOKEN: 'Google sign-in failed. Try again.',
  GOOGLE_EMAIL_NOT_VERIFIED: "Your Google email address isn't verified.",
  EMAIL_DOMAIN_NOT_ALLOWED: 'Sign in with your @saajha.org Google account.',
  NOT_INVITED: "You haven't been invited to FlowDesk, or haven't accepted your invite yet.",
  ACCOUNT_INACTIVE: 'Your FlowDesk account has been deactivated.',
  GOOGLE_ACCOUNT_MISMATCH: 'This FlowDesk account is linked to a different Google account.',
  GOOGLE_UNAVAILABLE: 'Google sign-in is temporarily unavailable. Try again shortly.',
  PROGRAM_KEY_EXISTS: 'A program with this key already exists.',
  OWNER_TEAM_NOT_FOUND: "The owner team doesn't exist or has been deleted.",
  ASSIGNEE_NOT_FOUND: "The assignee doesn't exist or is inactive.",
  INVALID_DATE_RANGE: 'The due date must be on or after the start date.',
  TASK_BLOCKED: 'This task is blocked by unfinished dependencies.',
  TASK_DONE: null,
  DEPENDENCY_TASK_NOT_FOUND: null,
  DEPENDENCY_OTHER_PROGRAM: null,
  SELF_DEPENDENCY: "A task can't depend on itself.",
  DEPENDENCY_EXISTS: null,
  DEPENDENCY_LIMIT_REACHED: null,
  DEPENDENCY_CYCLE: 'Adding this dependency would create a cycle.',
  PARENT_COMMENT_NOT_FOUND: "The comment you're replying to no longer exists.",
  PARENT_TARGET_MISMATCH: 'A reply must be on the same task or program as its parent.',
  NESTED_REPLY: "Replies can't have replies. Reply to the top-level comment.",
  TOO_MANY_MENTIONS: null,
  MENTION_NOT_FOUND: null,
  TEAM_NAME_EXISTS: 'A team with this name already exists.',
  TEAM_OWNS_PROGRAMS: 'This team still owns programs. Move them to another team first.',
  SELF_LOCKOUT: "You can't change your own role or deactivate yourself.",
  LAST_ADMIN: 'There has to be at least one active admin. Make someone else an admin first.',
  NETWORK_ERROR: "Can't reach the FlowDesk server. Check your connection and try again.",
}

interface ApiErrorInit {
  status: number
  code?: string
  fieldErrors?: Record<string, string>
  formErrors?: string[]
  details?: unknown
  serverMessage?: string
}

export class ApiError extends Error {
  readonly status: number // HTTP status; 0 = network failure
  readonly code?: string // backend `code`, or 'NETWORK_ERROR'
  readonly fieldErrors: Record<string, string> // validation: path → first message
  readonly formErrors: string[] // validation issues with path ''
  readonly details?: unknown // ErrorResponse.details, e.g. { blockers } or { programs }
  readonly serverMessage?: string // backend `error` string, verbatim

  constructor(init: ApiErrorInit, options?: { cause?: unknown }) {
    // `message` is for logs; the UI uses getErrorMessage().
    super(init.serverMessage ?? `HTTP ${init.status}`, options)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fieldErrors = init.fieldErrors ?? {}
    this.formErrors = init.formErrors ?? []
    this.details = init.details
    this.serverMessage = init.serverMessage
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function hasErrorCode(error: unknown, code: KnownErrorCode): boolean {
  return isApiError(error) && error.code === code
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidationErrorResponse(body: Record<string, unknown>): body is ValidationErrorResponse {
  return typeof body.error === 'string' && Array.isArray(body.details) && body.code === undefined
}

function isErrorResponse(body: Record<string, unknown>): body is ErrorResponse {
  return typeof body.error === 'string'
}

// Turns any non-2xx response body into an ApiError. `body` is what openapi-fetch gives back:
// parsed JSON, or the raw text when the body isn't JSON (e.g. Express's HTML 404 for unknown routes).
export function toApiError(status: number, body: unknown): ApiError {
  if (!isRecord(body)) return new ApiError({ status })

  if (isValidationErrorResponse(body)) {
    const fieldErrors: Record<string, string> = {}
    const formErrors: string[] = []
    for (const issue of body.details as unknown[]) {
      if (!isRecord(issue) || typeof issue.path !== 'string' || typeof issue.message !== 'string') continue
      if (issue.path === '') formErrors.push(issue.message)
      else if (!(issue.path in fieldErrors)) fieldErrors[issue.path] = issue.message
    }
    return new ApiError({ status, fieldErrors, formErrors, serverMessage: body.error })
  }

  if (isErrorResponse(body)) {
    return new ApiError({
      status,
      code: typeof body.code === 'string' ? body.code : undefined,
      details: body.details ?? undefined,
      serverMessage: body.error,
    })
  }

  return new ApiError({ status })
}

// Statuses whose backend `error` is a safe, human-readable message (per the contract).
// 500 is deliberately absent: its body is always the generic "Internal server error".
const SERVER_MESSAGE_STATUSES = new Set([400, 404, 409, 410])

const GENERIC_MESSAGE = 'Something went wrong. Try again.'

function statusMessage(status: number): string {
  switch (status) {
    case 0:
      return "Can't reach the FlowDesk server. Check your connection and try again."
    case 400:
      return 'Some of the information is invalid. Check it and try again.'
    case 401:
      return 'Your session has expired. Sign in again.'
    case 403:
      return "You don't have permission to do that."
    case 404:
      return 'Not found.'
    case 409:
      return 'That conflicts with the current state. Refresh and try again.'
    case 410:
      return 'This link has expired.'
    case 502:
    case 503:
    case 504:
      return 'The service is temporarily unavailable. Try again shortly.'
    default:
      return status >= 500 ? 'Something went wrong on our side. Try again.' : GENERIC_MESSAGE
  }
}

export function getErrorMessage(error: unknown): string {
  if (!isApiError(error)) return GENERIC_MESSAGE

  if (error.code !== undefined && Object.hasOwn(ERROR_MESSAGES, error.code)) {
    const mapped = ERROR_MESSAGES[error.code as KnownErrorCode]
    if (mapped !== null) return mapped
  }

  if (SERVER_MESSAGE_STATUSES.has(error.status) && error.serverMessage) return error.serverMessage

  return statusMessage(error.status)
}
