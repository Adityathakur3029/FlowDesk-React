import { paths } from '@/routes/paths'

// Only same-origin paths are allowed after sign-in, so ?redirect=//evil.com or
// ?redirect=https://evil.com can't turn the login page into an open redirect.
export function safeRedirect(param: string | null): string {
  if (
    !param ||
    !param.startsWith('/') ||
    param.startsWith('//') ||
    param.startsWith('/\\') ||
    param.startsWith(paths.login)
  ) {
    return paths.home
  }
  return param
}
