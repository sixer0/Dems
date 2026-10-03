/**
 * Shell layout state (masterplan/01_specs.md §14.3; research/04 §2.4–§2.5).
 *
 * | Tier | Width       | Sidebar                                   | Top bar | Pad / gutter |
 * |------|-------------|-------------------------------------------|---------|--------------|
 * | xl   | ≥ 1600      | full 232 (or rail 72 when collapsed)      | 80      | 16 / 16      |
 * | lg   | 1280–1599   | full 216 (or rail 72 when collapsed)      | 72      | 12 / 12      |
 * | md   | 1024–1279   | rail 72 (forced)                          | 72      | 12 / 12      |
 * | sm   | 768–1023    | hidden; Drawer from the hamburger         | 64      | 12 / 12      |
 * | xs   | < 768       | hidden; bottom tab bar (More → Drawer)    | 64      | 12 / 8       |
 *
 * Sizes live in `shell.css` (CSS variables keyed on `data-shell-tier` and `data-sidebar`); this
 * hook only decides the tier and the sidebar mode. The collapse preference persists in
 * `localStorage['dems.shell.rail']` and the `[` key toggles it (xl and lg only).
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

export type ShellTier = 'xl' | 'lg' | 'md' | 'sm' | 'xs'
export type SidebarMode = 'full' | 'rail' | 'drawer' | 'tabs'

export const SHELL_RAIL_STORAGE_KEY = 'dems.shell.rail'

/** Min-width queries, widest first; the first match names the tier. */
const TIER_QUERIES: ReadonlyArray<readonly [Exclude<ShellTier, 'xs'>, string]> = [
  ['xl', '(min-width: 1600px)'],
  ['lg', '(min-width: 1280px)'],
  ['md', '(min-width: 1024px)'],
  ['sm', '(min-width: 768px)'],
]

function readTier(): ShellTier {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'xl'
  for (const [tier, query] of TIER_QUERIES) {
    if (window.matchMedia(query).matches) return tier
  }
  return 'xs'
}

function subscribeTier(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined
  const lists = TIER_QUERIES.map(([, query]) => window.matchMedia(query))
  for (const list of lists) list.addEventListener?.('change', onChange)
  window.addEventListener('resize', onChange)
  return () => {
    for (const list of lists) list.removeEventListener?.('change', onChange)
    window.removeEventListener('resize', onChange)
  }
}

export function useShellTier(): ShellTier {
  return useSyncExternalStore(subscribeTier, readTier, () => 'xl')
}

function readRailPreference(): boolean {
  try {
    return window.localStorage.getItem(SHELL_RAIL_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeRailPreference(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SHELL_RAIL_STORAGE_KEY, collapsed ? '1' : '0')
  } catch (error) {
    // Private mode or storage disabled: the preference simply does not persist.
    if (import.meta.env.DEV) {
      console.warn('[core-web] rail preference not saved', {
        level: 'warn',
        source: 'shell.writeRailPreference',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export function sidebarModeFor(tier: ShellTier, railCollapsed: boolean): SidebarMode {
  switch (tier) {
    case 'xl':
    case 'lg':
      return railCollapsed ? 'rail' : 'full'
    case 'md':
      return 'rail'
    case 'sm':
      return 'drawer'
    case 'xs':
      return 'tabs'
  }
}

/** True for keys typed into a field, where `[` is text, not a shortcut. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]') !== null
}

export interface ShellLayout {
  tier: ShellTier
  mode: SidebarMode
  /** The stored collapse preference (applies at xl and lg). */
  railCollapsed: boolean
  /** Whether the rail toggle does anything at this tier. */
  canToggleRail: boolean
  toggleRail: () => void
}

export function useShellLayout(): ShellLayout {
  const tier = useShellTier()
  const [railCollapsed, setRailCollapsed] = useState(readRailPreference)
  const canToggleRail = tier === 'xl' || tier === 'lg'

  const toggleRail = useCallback(() => {
    setRailCollapsed((current) => {
      const next = !current
      writeRailPreference(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (!canToggleRail) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '[' || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.defaultPrevented || isEditableTarget(event.target)) return
      event.preventDefault()
      toggleRail()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [canToggleRail, toggleRail])

  return { tier, mode: sidebarModeFor(tier, railCollapsed), railCollapsed, canToggleRail, toggleRail }
}
