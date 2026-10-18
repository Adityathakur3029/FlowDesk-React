import { setupServer } from 'msw/node'

// No default handlers: each test declares the exact contract responses it needs.
export const server = setupServer()
