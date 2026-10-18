import { z } from 'zod'

// The only module that reads import.meta.env. Everything here ships to the browser: no secrets.
const envSchema = z.object({
  VITE_API_BASE_URL: z
    .url({ protocol: /^https?$/ })
    .transform((url) => url.replace(/\/+$/, '')),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    throw new Error(
      'Invalid environment: VITE_API_BASE_URL must be an absolute http(s) URL. Copy .env.example to .env.local.',
    )
  }
  return result.data
}

export const env = parseEnv(import.meta.env)
