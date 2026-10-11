/**
 * Fix wave L (G89c-02): what THE CORE's own verification runs say, read from its audit rows.
 *
 * On a Core in its own capture the Tamper & Integrity panel must not print the bundled
 * demonstration index ("12 PASS • 1 FAIL / AUDIO-02 hash mismatch / DEMO - precomputed"): those are
 * the dataset's constants, and the Core's own verification of the same item names another file.
 * The Core writes one row per verify run (operation 41): `EVIDENCE_VERIFIED`, or
 * `EVIDENCE_VERIFY_FAILED` with `details.failedFragments` ("VIDEO-02:3") / `details.failedTracks`.
 * This reader keeps the NEWEST such row of each item among the rows the page holds. An item with no
 * row in that view is not counted: nothing is said about it.
 */
export interface VerifyRowLike {
  readonly at: number
  readonly type: string
  readonly evidenceId?: string | null
  readonly details?: Readonly<Record<string, unknown>> | null
}

export interface CoreVerifyFailure {
  readonly evidenceId: string
  /** The places the Core named, as "VIDEO-02 fragment 3" parts: `{ trackId, seq }`; `seq: null` where the row names a file only. */
  readonly places: readonly { readonly trackId: string; readonly seq: number | null }[]
}

export interface CoreVerifyOutcomes {
  /** Items whose newest verify row in the view passed / failed. */
  readonly pass: number
  readonly fail: number
  readonly failures: readonly CoreVerifyFailure[]
}

const VERIFIED = 'EVIDENCE_VERIFIED'
const VERIFY_FAILED = 'EVIDENCE_VERIFY_FAILED'
const TRACK = /^[A-Z]+-\d{2}$/

const listOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')

function placesOf(details: Readonly<Record<string, unknown>> | null | undefined): CoreVerifyFailure['places'] {
  const places: { trackId: string; seq: number | null }[] = []
  for (const entry of listOf(details?.failedFragments)) {
    const [trackId = '', seq = ''] = entry.split(':')
    if (TRACK.test(trackId) && /^\d+$/.test(seq)) places.push({ trackId, seq: Number(seq) })
  }
  for (const trackId of listOf(details?.failedTracks)) {
    if (TRACK.test(trackId) && !places.some((place) => place.trackId === trackId)) places.push({ trackId, seq: null })
  }
  return places
}

/**
 * Fix wave M (G89d-02): how many of the items THE CORE lists have no verify row among `rows`. The tile
 * counts verify runs ("27 PASS • 1 FAIL"); a reader may take that sum for the item count. `itemIds` is
 * the Core's own evidence list (the replicated `evidence` slice); an id listed twice counts once.
 */
export function itemsWithoutVerifyRow(rows: readonly VerifyRowLike[], itemIds: readonly string[]): { readonly total: number; readonly notVerified: number } {
  const verified = new Set<string>()
  for (const row of rows) {
    if ((row.type === VERIFIED || row.type === VERIFY_FAILED) && typeof row.evidenceId === 'string' && row.evidenceId !== '') verified.add(row.evidenceId)
  }
  const items = new Set(itemIds)
  let notVerified = 0
  for (const id of items) if (!verified.has(id)) notVerified += 1
  return { total: items.size, notVerified }
}

export function coreVerifyOutcomes(rows: readonly VerifyRowLike[]): CoreVerifyOutcomes {
  const newest = new Map<string, VerifyRowLike>()
  for (const row of rows) {
    if ((row.type !== VERIFIED && row.type !== VERIFY_FAILED) || typeof row.evidenceId !== 'string' || row.evidenceId === '') continue
    const held = newest.get(row.evidenceId)
    if (held === undefined || row.at >= held.at) newest.set(row.evidenceId, row)
  }
  let pass = 0
  const failures: CoreVerifyFailure[] = []
  for (const [evidenceId, row] of newest) {
    if (row.type === VERIFIED) pass += 1
    else failures.push({ evidenceId, places: placesOf(row.details) })
  }
  failures.sort((a, b) => a.evidenceId.localeCompare(b.evidenceId))
  return { pass, fail: failures.length, failures }
}
