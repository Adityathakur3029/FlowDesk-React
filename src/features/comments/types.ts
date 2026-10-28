import type { components } from '@/api/schema'

export type Comment = components['schemas']['Comment']
export type CommentReply = components['schemas']['CommentReply']
export type CommentList = components['schemas']['CommentListResponse']
export type CreateCommentRequest = components['schemas']['CreateCommentRequest']
export type EmployeeSummary = components['schemas']['EmployeeSummary']
// Someone picked from the @-mention list: all a mention token needs.
export type MentionedPerson = Pick<EmployeeSummary, 'id' | 'name'>
// What the comments are on: a program itself, or a task (in a program or on a board). Boards have no
// board-level comments.
export type CommentTarget = { programId: string } | { taskId: string }
