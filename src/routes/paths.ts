import { generatePath } from 'react-router'

export const paths = {
  home: '/',
  login: '/login',
  people: '/people',
  teams: '/teams',
  programs: '/programs',
  program: '/programs/:programId',
  acceptInvite: '/invites/accept', // spec 05
} as const

export const programPath = (programId: string) => generatePath(paths.program, { programId })
