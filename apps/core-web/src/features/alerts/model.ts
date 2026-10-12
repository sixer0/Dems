import type { SimAlert } from '@dems/shared/sim'

/** Newest first; the active ones before the cleared ones. Pure. */
export function alertRows(alerts: readonly SimAlert[]): SimAlert[] {
  return [...alerts].sort((a, b) => Number(b.active) - Number(a.active) || b.at - a.at)
}

