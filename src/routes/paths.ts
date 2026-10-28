import { generatePath } from 'react-router'

export const paths = {
  home: '/',
  login: '/login',
  people: '/people',
  teams: '/teams',
  programs: '/programs',
  boards: '/boards', // spec 15
  overview: '/overview', // spec 14
  program: '/programs/:programId',
  board: '/boards/:boardId',
  // Every task, in a program or on a board: task keys are unique across FlowDesk (spec 15).
  task: '/tasks/:taskRef',
  // Links from before spec 15; LegacyTaskRedirect sends them to `task`.
  legacyProgramTask: '/programs/:programId/tasks/:taskRef',
  acceptInvite: '/invites/accept', // spec 05
} as const

export const programPath = (programId: string) => generatePath(paths.program, { programId })

export const boardPath = (boardId: string) => generatePath(paths.board, { boardId })

// taskRef is the task's key (MKT-7) or id; links use the key, as Jira does.
export const taskPath = (taskRef: string) => generatePath(paths.task, { taskRef })
