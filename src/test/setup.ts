import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { toast } from 'sonner'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './server'

// jsdom lacks these browser APIs. The sidebar's useIsMobile needs matchMedia (desktop layout here);
// Radix Select needs pointer capture and scrollIntoView; cmdk's list needs ResizeObserver.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// The first full-app render in each file can take over a second while all files run in parallel.
configure({ asyncUtilTimeout: 3000 })

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))

afterEach(() => {
  // sonner keeps toasts in a module-level store; without this, one test's toast shows up in the next.
  toast.dismiss()
  cleanup()
  server.resetHandlers()
  localStorage.clear()
})

afterAll(() => server.close())
