/**
 * How the shell arrives (03_motion_spec §4): which app-level entrance the AppShell plays on mount.
 *
 * - `handoff` (M-APP-01, shell side): the previous top-level route was `/login` in this page
 *   lifetime, so the operator just signed in. The top bar drops in, the sidebar slides in with its
 *   items staggered, then the page enters; the emblem arrives through the shared `layoutId`.
 * - `cold` (M-APP-03): the first shell of this browser session without a Login before it (for
 *   example a reload while signed in). The emblem strokes draw, the wordmark rack-focuses and the
 *   shell fades in. Shown once per session (`sessionStorage['dems.shell.intro']`).
 * - `plain`: every later arrival. The shell is simply there and the page runs its R1 enter.
 *
 * The root route records the top-level route (`/login` or `/_app`) per router instance, after its
 * children commit, so the shell's first render still sees the route it replaced.
 */
import type { AnyRouter } from '@tanstack/react-router'

export type ShellEntrance = 'handoff' | 'cold' | 'plain'

/** Session flag: the M-APP-03 intro (or a hand-off) has played in this browser session. */
export const SHELL_INTRO_STORAGE_KEY = 'dems.shell.intro'

const LOGIN_ROUTE_ID = '/login'

const topLevelByRouter = new WeakMap<AnyRouter, string>()

/** Called by the root route whenever the committed top-level route changes. */
export function noteTopLevelRoute(router: AnyRouter, routeId: string | undefined): void {
  if (routeId) topLevelByRouter.set(router, routeId)
}

/** The last committed top-level route of this router (`undefined` before the first commit). */
export function lastTopLevelRoute(router: AnyRouter): string | undefined {
  return topLevelByRouter.get(router)
}

function sessionStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

function introShown(storage: Storage | null): boolean {
  try {
    return storage?.getItem(SHELL_INTRO_STORAGE_KEY) === '1'
  } catch {
    return true // unreadable storage: never replay the intro
  }
}

/**
 * Marks the session so the M-APP-03 intro plays at most once. Call it from an effect after the
 * shell mounted (idempotent, so StrictMode's double effects are harmless).
 */
export function markShellIntroShown(storage: Storage | null = sessionStore()): void {
  try {
    storage?.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  } catch {
    // Private mode or storage disabled: the intro may play again on the next reload; harmless.
  }
}

/**
 * Decides the entrance for a shell that is mounting now. Pure (reads only), so it is safe as a
 * `useState` initialiser that StrictMode calls twice.
 */
export function resolveShellEntrance(
  router: AnyRouter,
  storage: Storage | null = sessionStore(),
): ShellEntrance {
  const previous = lastTopLevelRoute(router)
  if (previous === LOGIN_ROUTE_ID) return 'handoff'
  if (previous === undefined && !introShown(storage)) return 'cold'
  return 'plain'
}
