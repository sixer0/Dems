/**
 * Ambient-loop registry (03_motion_spec P3, R10, §9.4, §9.5).
 *
 * Every ambient loop that wants to run acquires a slot here. At most `ambientMaxPerViewport` (4)
 * slots run at once. Page loops come before shell loops, so a page that already shows four loops
 * pauses the shell's topographic drift (§9.4). Entries that share a `group` share one slot (the
 * shell's drift and SECURE dot count as one loop). The debug overlay reads the snapshot.
 *
 * Escalation reserve (step 45b, F45-02, D96; R8, M-SH-05, D-42-11): an `escalation` entry (the
 * shell's SECURE BorderBeam while the pill is ATTENTION or CRITICAL) outranks every page loop,
 * so its slot is always granted and the cap of 4 still holds: the slot comes from the page's
 * lowest-ranked loop. Pages mark pure decoration (hero Ken Burns, the procedural camera
 * Ken Burns) as `decor`, so decoration yields first and information-carrying loops (REC pulse, ring
 * breathing) keep running. `idle` is for optional flourishes that run only in a slot nobody else
 * wants (the camera standby sweep). Rank: escalation < page < decor < shell < idle (lower wins);
 * ties keep acquisition order.
 *
 * Plain external store (no React), consumed through `useSyncExternalStore`.
 */
import { motion as tokens } from '@dems/shared/tokens'

/**
 * Slot priority, best first: `escalation` (an attention signal that must be seen, F45-02) →
 * `page` (the default) → `decor` (page decoration that yields first) → `shell` (idle shell loops,
 * which pause when the page holds four slots, §9.4) → `idle` (an optional flourish that only
 * takes a slot nobody else wants).
 */
export type AmbientPriority = 'escalation' | 'page' | 'decor' | 'shell' | 'idle'

export interface AmbientLoopRequest {
  /** Human-readable name for the debug overlay (for example `ring-rotate`). */
  label: string
  priority?: AmbientPriority
  /** Loops with the same group share one slot. */
  group?: string
}

export interface AmbientLoopInfo {
  id: string
  label: string
  priority: AmbientPriority
  slot: string
}

export interface AmbientSnapshot {
  cap: number
  /** Distinct slots wanting to run (may exceed `cap`; the overlay flags that). */
  slotsRequested: number
  /** Slots running (≤ cap). */
  slotsGranted: number
  granted: readonly AmbientLoopInfo[]
  suppressed: readonly AmbientLoopInfo[]
  /** Ids of granted entries, for O(1) lookups. */
  grantedIds: ReadonlySet<string>
}

export interface AmbientRegistry {
  readonly cap: number
  /** Declares that loop `id` wants to run now. Returns the release function. */
  acquire(id: string, request: AmbientLoopRequest): () => void
  getSnapshot(): AmbientSnapshot
  subscribe(listener: () => void): () => void
}

const PRIORITY_RANK: Record<AmbientPriority, number> = { escalation: 0, page: 1, decor: 2, shell: 3, idle: 4 }

export function createAmbientRegistry(
  cap: number = tokens.threshold.ambientMaxPerViewport,
): AmbientRegistry {
  const entries = new Map<string, AmbientLoopInfo>()
  const listeners = new Set<() => void>()
  let snapshot = computeSnapshot()

  function computeSnapshot(): AmbientSnapshot {
    // A slot's rank is its best entry's priority; ties keep acquisition order (Map order).
    const slots = new Map<string, { rank: number; order: number }>()
    let order = 0
    for (const entry of entries.values()) {
      const rank = PRIORITY_RANK[entry.priority]
      const existing = slots.get(entry.slot)
      if (!existing) slots.set(entry.slot, { rank, order: order++ })
      else if (rank < existing.rank) existing.rank = rank
    }
    const ordered = [...slots.entries()].sort((a, b) => a[1].rank - b[1].rank || a[1].order - b[1].order)
    const grantedSlots = new Set(ordered.slice(0, cap).map(([slot]) => slot))
    const granted: AmbientLoopInfo[] = []
    const suppressed: AmbientLoopInfo[] = []
    for (const entry of entries.values()) {
      if (grantedSlots.has(entry.slot)) granted.push(entry)
      else suppressed.push(entry)
    }
    return {
      cap,
      slotsRequested: slots.size,
      slotsGranted: grantedSlots.size,
      granted,
      suppressed,
      grantedIds: new Set(granted.map((entry) => entry.id)),
    }
  }

  function publish() {
    snapshot = computeSnapshot()
    for (const listener of listeners) listener()
  }

  return {
    cap,
    acquire(id, request) {
      entries.set(id, {
        id,
        label: request.label,
        priority: request.priority ?? 'page',
        slot: request.group ?? id,
      })
      publish()
      return () => {
        if (entries.delete(id)) publish()
      }
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
