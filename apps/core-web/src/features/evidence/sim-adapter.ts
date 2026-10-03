/**
 * Evidence page reads and writes over the simulator (step 47; step 54 closed W47-1..4 in
 * `packages/shared/src/sim`).
 *
 * - **Integrity (W47-1, review 40 §5.c).** The simulator now carries the DEMO packages' sealed
 *   hashes on the dataset items and seeds EV 0005 as tampered on AUDIO-02, so its `verify()` agrees
 *   with the real package verification. The page still shows the REAL package verification and
 *   records it in the simulator (`recordPackageVerification`); the mirror below only acts when the
 *   two still differ:
 *   1. package FAIL on one track while the sim item is not tampered on that track (an item without a
 *      seeded tamper) → the sim's own tamper hook (`inject('TAMPER', { evidenceId, trackId })`,
 *      EVT-13/14) mirrors the finding before `verify(id)` records it;
 *   2. the sim item tampered through the Demo Control Panel while the package is pristine → the
 *      loader alters that track's bytes in memory (one byte flipped), so the real hash check fails
 *      on exactly that track, as the tamper hook describes ("the media is altered after sealing").
 * - **Case type (W47-2).** `EvidenceItem.caseType` (the examination type: TERSANGKA, SAKSI,
 *   LAINNYA) backs the route's `caseType` search; `subjectTypeFromSearch` parses it.
 * - **Markers and notes (W47-3).** `EvidenceItem.markers` / `notes` hold what the session recorded
 *   (the dataset items have none). Showing them on the scrub bar and in the Metadata tab is a UI
 *   follow-up (step 91 hand-over).
 * - **Export IDs (W47-4).** The simulator's export counter continues after EV 0004's prebuilt
 *   EXP-000031, so a re-export gets EXP-000032 onwards; the wizard downloads the prebuilt archive,
 *   labelled as the prebuilt DEMO package, and the audit trail records the new ID.
 */
import type { TrackId } from '@dems/shared/domain'
import type { DemoAssetLoader, DemoEvidencePackage, DemoVerificationReport } from '@dems/shared/demo-data'
import {
  FaultKind,
  SubjectType,
  type AuditRow,
  type EvidenceItem,
  type EvidenceVerifyResult,
  type Sim,
  type SimState,
} from '@dems/shared/sim'

// ── Integrity (W47-1) ───────────────────────────────────────────────────────────────────────

/** The track the sim's tamper hook altered on this item, or null. */
export function simTamperedTrack(item: Pick<EvidenceItem, 'tampered' | 'tamperedTrackId'>): TrackId | null {
  if (!item.tampered) return null
  return item.tamperedTrackId ?? 'AUDIO-02'
}

/** Byte offset flipped by the in-memory alteration (the middle of the file, never the header). */
function alteredOffset(length: number): number {
  return Math.max(0, Math.floor(length / 2))
}

/**
 * A loader that serves `trackId`'s stored media of `pkg` with one byte flipped (case 2 above). Every
 * other file is served unchanged. With `trackId` null the original loader is returned.
 */
export function withSimulatedTamper(
  load: DemoAssetLoader,
  pkg: DemoEvidencePackage,
  trackId: TrackId | null,
): DemoAssetLoader {
  if (!trackId) return load
  const track = pkg.tracks.find((entry) => entry.trackId === trackId)
  if (!track || track.altered) return load // the package already carries the altered copy
  const alteredPath = track.stored.path
  return async (assetPath) => {
    const bytes = await load(assetPath)
    if (assetPath !== alteredPath || bytes.length === 0) return bytes
    const copy = new Uint8Array(bytes)
    const offset = alteredOffset(copy.length)
    copy[offset] = (copy[offset] ?? 0) ^ 0xff
    return copy
  }
}

/** Track IDs of the failed `track:<ID>` checks of a report. */
export function failedTracksOf(report: Pick<DemoVerificationReport, 'failed'>): TrackId[] {
  return report.failed
    .filter((id) => id.startsWith('track:'))
    .map((id) => id.slice('track:'.length) as TrackId)
}

/**
 * Records a finished package verification in the simulator (custody entry + audit row), mirroring a
 * package-level tamper into the sim first so both agree (case 1 above). Returns the sim's result.
 */
export function recordPackageVerification(
  sim: Sim,
  evidenceId: string,
  report: Pick<DemoVerificationReport, 'failed' | 'result'>,
): EvidenceVerifyResult {
  const state = sim.store.getState()
  const item = state.evidence.find((entry) => entry.id === evidenceId)
  const failedTracks = failedTracksOf(report)
  if (item && failedTracks.length === 1) {
    const trackId = failedTracks[0] as TrackId
    if (simTamperedTrack(item) !== trackId) sim.actions.inject(FaultKind.TAMPER, { evidenceId, trackId })
  }
  return sim.actions.verify(evidenceId)
}

// ── Case type (W47-2) ───────────────────────────────────────────────────────────────────────

const SUBJECT_TYPE_VALUES = new Set<string>(Object.values(SubjectType))

/** The route's `caseType` search value as a subject type, or null (unknown or empty). */
export function subjectTypeFromSearch(caseType: string | undefined): SubjectType | null {
  const value = (caseType ?? '').trim().toUpperCase()
  return SUBJECT_TYPE_VALUES.has(value) ? (value as SubjectType) : null
}

// ── Audit helpers (read-only) ───────────────────────────────────────────────────────────────

/** The newest audit row of `type` that names `evidenceId`, or null. */
export function latestAuditRowFor(state: Pick<SimState, 'audit'>, evidenceId: string, type: AuditRow['type']): AuditRow | null {
  const rows = state.audit.rows
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]
    if (row && row.evidenceId === evidenceId && row.type === type) return row
  }
  return null
}
