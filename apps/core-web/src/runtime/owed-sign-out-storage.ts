/**
 * The web console's storage of a sign-out the Core has not heard of (decisions D90, D100; brief
 * list rows 2, 28, 29 and 33 of implementation/44_live_source.md §17.4; plan row W50).
 *
 * Why it exists. The web session is the browser's `HttpOnly` cookie, which this page cannot
 * drop. When an operator locks the console while the Core cannot be reached, the Live source ends
 * the session HERE and owes the Core a sign-out (a "debt"). Without a record that outlives the
 * page, a reload would find the cookie still valid and sign the console back in: the Lock would
 * be undone by pressing reload. The record lives in the origin's `localStorage`, so a reloaded
 * tab and a NEW tab both find it; the Live source then settles it before it takes any session.
 *
 * | Rule | Why |
 * |------|-----|
 * | `read`, `write` and `clear` are SYNCHRONOUS: each has done its work when it returns | Only then does "a reload cannot forget a local Lock" hold (finding CPC1-34): the debt is stored before the end is reported |
 * | `read` returns `null` when the key is absent, and ONLY then | `null` means "nothing is owed": the session the cookie names is taken |
 * | `read` THROWS when the storage throws, when the text is not JSON, and when the JSON is `null` | A Lock may be recorded there. The Live source then starts CLOSED: the session is not taken and a fresh sign-in is required |
 * | `read` returns any other parsed value as it is | The Live source takes only the exact shape of a debt; another value is dropped by it and the start is closed |
 * | `write` stores exactly the four members of the debt | The record holds no credential: no token, no cookie value. Nothing else is ever stored under the key |
 * | The port is created only for a storage that passed `hasUsableStorage` | A later failure of `read` then really means "a stored Lock may be unreadable" (row 28) |
 *
 * Residual, stated: a text under the key that is not JSON stays there until the next debt is
 * written, and closes every start of the page until then. It can only come from an edit of the
 * storage by hand; the remedy is to remove the key (or to sign in, which each start then needs).
 *
 * `watchOwedSignOut` is the optional part of row 29: a tab that is already open does not read the
 * storage again, so it would keep showing the last Core data after a Lock in another tab while
 * the Core is unreachable. The browser's `storage` event tells it; when the debt that appeared
 * names this tab's own session and was asked for by the operator (USER or LOCK), this tab ends
 * its session too. A reckoned expiry of another tab is NOT followed: one tab's reckoning does not
 * end the shared session (brief list row 7).
 */
import { settle } from '@dems/shared/live'
import type { LiveOwedSignOut, LiveOwedSignOutPort, LiveSim } from '@dems/shared/live/source'
import { selectIsSignedIn, SignOutReason } from '@dems/shared/sim'

/** `localStorage` key of the debt. One record; nothing else is stored under it. */
export const OWED_SIGN_OUT_STORAGE_KEY = 'dems.live.owedSignOut.v1'

/** Key of the write-and-remove probe. It never stays. */
export const STORAGE_PROBE_KEY = 'dems.live.storageProbe'

/** `read` could not tell whether a debt is stored. The message never holds the stored text. */
export class OwedSignOutUnreadableError extends Error {
  constructor(reason: 'NOT_JSON' | 'JSON_NULL') {
    super(`The stored sign-out debt cannot be read (${reason}).`)
    this.name = 'OwedSignOutUnreadableError'
  }
}

/**
 * Whether the origin has a storage that takes and gives back a value (brief list row 28). Asked
 * ONCE, before the Live source is created. It writes one probe key and removes it again.
 */
export function hasUsableStorage(storage: Storage | null | undefined): storage is Storage {
  if (storage === null || storage === undefined) return false
  try {
    storage.setItem(STORAGE_PROBE_KEY, '1')
    const kept = storage.getItem(STORAGE_PROBE_KEY) === '1'
    storage.removeItem(STORAGE_PROBE_KEY)
    return kept
  } catch {
    return false
  }
}

/** The port the Live source is given. Every call is synchronous. */
export function createOwedSignOutPort(storage: Storage, key: string = OWED_SIGN_OUT_STORAGE_KEY): LiveOwedSignOutPort {
  return {
    read(): LiveOwedSignOut | null {
      // A storage that throws here is "a debt may exist": the exception goes to the Live source.
      const text = storage.getItem(key)
      if (text === null) return null
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new OwedSignOutUnreadableError('NOT_JSON')
      }
      // A stored `null` must not read as "nothing is stored".
      if (parsed === null) throw new OwedSignOutUnreadableError('JSON_NULL')
      // The Live source takes it only when it has the exact shape of a debt.
      return parsed as LiveOwedSignOut
    },
    write(debt: LiveOwedSignOut): void {
      const record: LiveOwedSignOut = { operatorId: debt.operatorId, issuedAt: debt.issuedAt, reason: debt.reason, at: debt.at }
      storage.setItem(key, JSON.stringify(record))
    },
    clear(): void {
      storage.removeItem(key)
    },
  }
}

/** The `storage` event, as far as the watcher reads it. */
export interface OwedSignOutStorageEvent {
  readonly key: string | null
  readonly newValue: string | null
  readonly storageArea?: Storage | null
}

/** Where `storage` events come from: the window. */
export interface StorageEventTarget {
  addEventListener(type: 'storage', listener: (event: OwedSignOutStorageEvent) => void): void
  removeEventListener(type: 'storage', listener: (event: OwedSignOutStorageEvent) => void): void
}

/** A debt another tab wrote that this tab follows, or `null`. */
export function operatorSignOutOf(text: string | null): { operatorId: string; issuedAt: number; reason: SignOutReason } | null {
  if (text === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object') return null
  const { operatorId, issuedAt, reason } = parsed as Partial<LiveOwedSignOut>
  if (typeof operatorId !== 'string' || typeof issuedAt !== 'number') return null
  // Only what an operator asked for is followed; a reckoned expiry of another tab is not.
  if (reason !== SignOutReason.USER && reason !== SignOutReason.LOCK) return null
  return { operatorId, issuedAt, reason }
}

export interface WatchOwedSignOutOptions {
  readonly live: LiveSim
  readonly storage: Storage
  readonly target: StorageEventTarget
  readonly key?: string
}

/**
 * Brief list row 29: follows a Lock or a sign-out that another tab of this origin made while the
 * Core could not be told. Returns the function that ends the watch.
 */
export function watchOwedSignOut({ live, storage, target, key = OWED_SIGN_OUT_STORAGE_KEY }: WatchOwedSignOutOptions): () => void {
  const onStorage = (event: OwedSignOutStorageEvent): void => {
    if (event.key !== key) return
    if (event.storageArea !== undefined && event.storageArea !== null && event.storageArea !== storage) return
    const debt = operatorSignOutOf(event.newValue)
    if (debt === null) return
    const session = live.session
    if (session === null || !selectIsSignedIn(live.store.getState())) return
    // Another session than this tab's: the debt is not about what this tab shows.
    if (session.operator.id !== debt.operatorId || session.issuedAt !== debt.issuedAt) return
    // `signOut` always resolves while somebody is signed in; a failure is reported by the Live source.
    settle(() => live.actions.signOut(debt.reason), { fail: () => undefined })
  }
  target.addEventListener('storage', onStorage)
  return () => target.removeEventListener('storage', onStorage)
}
