import { z } from 'zod'

// The only module that reads import.meta.env. Everything here ships to the browser: no secrets.
const envSchema = z.object({
  VITE_API_BASE_URL: z
    .url({ protocol: /^https?$/, error: 'must be an absolute http(s) URL' })
    .transform((url) => url.replace(/\/+$/, '')),
  // Public OAuth client ID; must be the same client as the backend's GOOGLE_CLIENT_ID.
  VITE_GOOGLE_CLIENT_ID: z
    .string({ error: 'must be set to a Google OAuth client ID' })
    .trim()
    .regex(/^\S+\.apps\.googleusercontent\.com$/, 'must be a Google OAuth client ID (….apps.googleusercontent.com)'),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`)
    throw new Error(`Invalid environment: ${problems.join('; ')}. Copy .env.example to .env.local.`)
  }
  return result.data
}

export const env = parseEnv(import.meta.env)
