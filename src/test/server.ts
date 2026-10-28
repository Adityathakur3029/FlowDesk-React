import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { env } from '@/config/env'

// Each test declares the exact contract responses it needs. The one fallback is GET /teams: the People
// page loads the team directory in the background, and most tests don't care about it. It's an initial
// handler, so a test's own server.use() always takes precedence, and resetHandlers() keeps it.
export const server = setupServer(
  http.get(`${env.VITE_API_BASE_URL}/teams`, () => HttpResponse.json({ data: [], meta: { total: 0, limit: 100, offset: 0 } })),
)
