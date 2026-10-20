import { generatePath } from 'react-router'

export const paths = {
  home: '/',
  login: '/login',
  people: '/people',
  teams: '/teams',
  programs: '/programs',
  overview: '/overview', // spec 14
  program: '/programs/:programId',
  task: '/programs/:programId/tasks/:taskRef',
  acceptInvite: '/invites/accept', // spec 05
} as const

export const programPath = (programId: string) => generatePath(paths.program, { programId })

// taskRef is the task's key (MKT-7) or id; links use the key, as Jira does.
export const taskPath = (programId: string, taskRef: string) => generatePath(paths.task, { programId, taskRef })
