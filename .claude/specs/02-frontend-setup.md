# 02 — Frontend setup (UI kit, routing, feedback states)

**Status:** Implemented (2026-10-18); browser checks pending, see Verified
**Branch:** `login` (implemented together with spec 03)
**Depends on:** [01-api-client-and-errors](./01-api-client-and-errors.md) (`apiClient`, `unwrap`, `ApiError`, `getErrorMessage`, `queryClient`, `@/` alias)

## Goal

Install and wire the pieces every screen needs, so feature specs only add screens:

1. **Tailwind CSS v4 + shadcn/ui** with a Saajha theme (the logo's orange as the primary colour, its charcoal as the foreground).
2. **React Router v7** in declarative mode, with route path constants and a catch-all not-found page.
3. **Feedback components** for the states in CLAUDE.md §2: `PageLoader`, `EmptyState`, `ErrorState`, `ForbiddenState`, `NotFoundState`.
4. **Toasts** (sonner, via shadcn) mounted once at the root.
5. **Branding:** Saajha logo as favicon and in the page title.
6. **React Testing Library**, so later specs can test components.

No login and no layout. The temporary API status screen from spec 01 moves to `/` unchanged in behaviour, restyled with shadcn. Spec 03 puts it behind sign-in; spec 04 replaces it with the AppShell.

## Packages

| Package | Kind | Version | Purpose |
|---|---|---|---|
| `tailwindcss` | dependency | ^4.3 | Styling |
| `@tailwindcss/vite` | dev | ^4.3 | Tailwind's Vite plugin (no PostCSS config needed) |
| `react-router` | dependency | **^7.18** | Routing, declarative mode. Pinned to v7 as CLAUDE.md says; v8 exists but isn't adopted without asking. |
| `class-variance-authority`, `cn`, `radix-ui`, `lucide-react`, `tw-animate-css`, `shadcn`, `@fontsource-variable/geist`, `next-themes` | dependency | as installed | Installed by `npx shadcn init` / `add` (see Implementation notes) |
| `sonner` | dependency | ^2.0 | Toasts (installed by `npx shadcn add sonner`) |
| `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom` | dev | latest | Component tests in Vitest |

`npx shadcn init` (style: default for shadcn 4, base colour **neutral**, CSS variables **on**) writes `components.json`, `src/lib/utils.ts` (`cn()`) and the theme block in `src/index.css`. Then add exactly these components:

```
npx shadcn add button card alert skeleton sonner badge separator
```

If `shadcn init` wants to install a different Tailwind major, or fails under TypeScript 6 / Vite 8, **stop and report it**.

## Config changes

| File | Change |
|---|---|
| `vite.config.ts` | Add `tailwindcss()` from `@tailwindcss/vite` to `plugins`. |
| `tsconfig.json` (root) | Already has `paths`; add `"baseUrl": "."` only if `shadcn init` asks for it. |
| `src/test/setup.ts` | `import '@testing-library/jest-dom/vitest'`; call RTL `cleanup()` in `afterEach`. |
| `index.html` | `<title>FlowDesk · Saajha</title>`; favicon `<link rel="icon" type="image/png" href="/logo.png" />`. |

## Theme (`src/index.css`)

Replace the Vite demo CSS with `@import "tailwindcss"; @import "tw-animate-css";` plus the shadcn variable block. Override these light-mode tokens with the Saajha brand (sampled from `public/logo.png`):

| Token | Value | Why |
|---|---|---|
| `--brand` (new) | `#E07B12` | the logo's orange, for decoration only (accent bar, background tint), never behind text |
| `--primary` | `#B45309` | deep Saajha orange: white text on it is 5.0:1 (WCAG AA) |
| `--primary-foreground` | `#FFFFFF` | |
| `--ring` | `#B45309` | keyboard focus in brand colour, ≥ 3:1 against white |
| `--foreground` | `#2F2F31` | close to the logo's charcoal (`#4A4A4D`) but darker for body-text contrast |

`--brand` is exposed to Tailwind with `@theme inline { --color-brand: var(--brand); }` so `bg-brand` works.

> White on the logo's own orange `#E07B12` is only about 2.9:1, which fails AA for button text. That's why buttons use the darker `#B45309` and the bright orange is decorative only.

Dark mode keeps shadcn's neutral dark palette with the same `--primary`/`--brand`. No theme toggle (spec 04 may add one).

`App.css` is deleted.

## Folder layout (new and changed)

```
components.json                 NEW      shadcn config (aliases @/components, @/lib/utils)
index.html                      CHANGED  title, favicon
vite.config.ts                  CHANGED  tailwind plugin
src/
  index.css                     CHANGED  tailwind + shadcn theme with Saajha tokens
  App.css                       DELETED
  App.tsx                       CHANGED  <BrowserRouter><AppRoutes /></BrowserRouter> + <Toaster />
  main.tsx                      unchanged except imports (QueryClientProvider stays)
  lib/
    utils.ts                    NEW      cn() (shadcn)
  components/
    ui/                         NEW      shadcn: button, card, alert, skeleton, sonner, badge, separator
    brand/
      SaajhaLogo.tsx            NEW      <img src="/logo.png" alt="Saajha"> with size prop
    feedback/
      PageLoader.tsx            NEW
      EmptyState.tsx            NEW
      ErrorState.tsx            NEW
      ForbiddenState.tsx        NEW
      NotFoundState.tsx         NEW
      feedback.test.tsx         NEW
  routes/
    paths.ts                    NEW      route path constants
    router.tsx                  NEW      AppRoutes (declarative <Routes>)
    HomePage.tsx                NEW      the spec-01 API status screen, moved from App.tsx (temporary)
```

`components/brand/` is a small addition to the CLAUDE.md layout: the logo is shared by the login page and (later) the sidebar, so it isn't a feature internal.

## Routing (`src/routes/`)

`paths.ts`:

```ts
export const paths = {
  home: '/',
  login: '/login',          // spec 03
  acceptInvite: '/invites/accept', // spec 05
} as const
```

`router.tsx` exports `AppRoutes`, a declarative `<Routes>`:

| Path | Element | Notes |
|---|---|---|
| `/` | `HomePage` | public in this spec; spec 03 wraps it in `RequireAuth` |
| `*` | `NotFoundState` | full page, with a "Go home" link |

Declarative mode (`<BrowserRouter>` + `<Routes>`) as CLAUDE.md specifies, so no loaders/actions: data loading stays in TanStack Query.

## Feedback components (`src/components/feedback/`)

All are presentational, take no data-fetching props, and use shadcn primitives + lucide icons.

| Component | Props | Renders |
|---|---|---|
| `PageLoader` | `label?: string` (default "Loading…") | Centered spinner (`Loader2` with `animate-spin`) and the label; `role="status"`, `aria-live="polite"`. `fullScreen?: boolean` → `min-h-svh`. |
| `EmptyState` | `title`, `description?`, `action?: ReactNode` | Icon, title, description, optional action (caller passes it only if the role allows). |
| `ErrorState` | `error: unknown`, `onRetry?: () => void`, `retrying?: boolean`, `title?` (default "Something went wrong") | `getErrorMessage(error)` in a destructive `Alert`; a **Retry** button when `onRetry` is given, disabled and labelled "Retrying…" while `retrying`. `role="alert"`. |
| `ForbiddenState` | `description?` | "You don't have access to this page" + default text "Ask an admin or manager if you think you should." No retry. |
| `NotFoundState` | `title?`, `description?` | "Page not found" + a `Link` to `paths.home`. |

`ErrorState` never prints a 500's server text; that rule already lives in `getErrorMessage` (spec 01).

## Toasts

`<Toaster richColors closeButton position="top-right" />` from `@/components/ui/sonner`, mounted once in `App.tsx`. Mutation code calls `toast.success(...)` / `toast.error(getErrorMessage(err))`. No global `onError` toast on the query client: screens render query errors with `ErrorState` instead, and a global toast would double them.

## HomePage (temporary)

Moves spec 01's status screen into `routes/HomePage.tsx`, restyled: a `Card` with the Saajha logo, "FlowDesk", and the API status (`Skeleton` while pending, `Badge` "API ok · database time …" on success, `ErrorState` with retry on error). Same `['health']` query as before.

## Tests

| File | Case | Expected |
|---|---|---|
| `feedback.test.tsx` | `ErrorState` with `ApiError(0, NETWORK_ERROR)` and `onRetry` | connection message shown; clicking Retry calls `onRetry` |
| | `ErrorState` with `ApiError(500, serverMessage "boom")` | shows the 5xx fallback, not "boom" |
| | `ErrorState` with `retrying` | Retry button disabled, reads "Retrying…" |
| | `NotFoundState` inside `MemoryRouter` | has a link to `/` |
| | `PageLoader` | has `role="status"` and the label |

## Acceptance checklist

- [x] `npm install` works without `--legacy-peer-deps`; `react-router` resolves to 7.x
- [x] `npx shadcn add …` components exist under `src/components/ui`, importable via `@/components/ui/*`
- [ ] Tailwind utilities apply in dev and in `npm run build` output (the build emits 32 kB of CSS; not yet looked at in a browser)
- [ ] Buttons and focus rings use the Saajha orange; focus ring visible on keyboard Tab
- [ ] Tab title "FlowDesk · Saajha" and the logo favicon
- [ ] `/` shows the status card; stopping the backend shows `ErrorState` with a working Retry
- [ ] `/does-not-exist` shows `NotFoundState` with a link home
- [ ] `toast.success('x')` from the console-equivalent (temporary button or test) renders a toast
- [x] `npm run typecheck`, `npm run build`, `npm run lint`, `npm test` pass

## Verified

- `npm install`: no peer-dependency errors; `react-router@7.18.4`, `tailwindcss@4.3.3`.
- `npm run typecheck`, `npm run build` and `npm test` pass (feedback tests 5/5). `npm run lint` has 0 errors and 2 `only-export-components` warnings, both in generated shadcn files (`button.tsx`, `badge.tsx`), left as generated.
- **Not yet checked in a browser:** theme colours, focus ring, tab title/favicon, toast rendering, the not-found page. Check them together with spec 03's manual checks.

## Implementation notes

- `shadcn@4.22.0 init -t vite -b radix -p nova`. The CLI requires a preset; **Nova** (Lucide icons, Geist font) is its default. Style `radix-nova`, base colour neutral.
- shadcn 4 uses the official `cn` package (github.com/shadcn-ui/cn, a compiled clsx + tailwind-merge) instead of `clsx` + `tailwind-merge`. Generated components import from `"cn"`; `src/lib/utils.ts` re-exports it, and our own code imports `@/lib/utils`.
- shadcn also added `radix-ui`, `shadcn` (for `@import "shadcn/tailwind.css"`), `@fontsource-variable/geist` and `next-themes` (the sonner wrapper calls `useTheme()`; without a ThemeProvider it falls back to `"system"`).
- Dark-mode `--ring` is `#d97706`, brighter than light mode's `#b45309`, so focus stays visible on the dark background.
- The temporary HomePage was written straight in its spec-03 form (signed-in card plus API status), skipping an intermediate public version.

## Out of scope / follow-ups

- Login, `RequireAuth`, `RequireRole`: spec 03.
- AppShell, sidebar, header, user menu, global error boundary, theme toggle: spec 04.
- Form components (`input`, `label`, `form`, `select`, …) and the `ApiError` → react-hook-form helper: added by the first spec with a form (05, invitations).
