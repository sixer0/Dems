/**
 * Evidence view model (04_mobile_specs §4.10, §4.11; D50, D51, D61, D67; P13). Pure TypeScript:
 * no React, no hooks, so every rule here is unit-tested directly (T-M15 companions).
 *
 * - List: status filter (All, Recorded, Sealed, Exported, Under Review), search over the evidence
 *   ID, session ID, subject and case number, sort by recording time.
 * - Status chips: Sealed is violet with a lock (D28/Q4), Recorded success, Exported info with an
 *   upload arrow, Under Review warning with an eye, Archived default.
 * - Join to the DEMO packages by the evidence number suffix (D61; `@dems/shared/demo-data`), never
 *   by hard-coded hashes (P13).
 * - Integrity: the package's precomputed report, which the UI labels "verified by the Core" (D51).
 *   Items without a package fall back to the simulator's own (synthetic) integrity, labelled
 *   SIMULATED (04 §4.11 D5c as first written).
 * - Playback: the excerpt rule (a recording position p plays the clip at p mod the clip length;
 *   64_demo_media §5, 45_mobile_brand_media §3.1).
 */
import type { TrackId } from '@dems/shared/domain';
import {
  DEMO_EVIDENCE_INDEX,
  demoIdSuffix,
  getDemoEvidenceDocuments,
  getDemoEvidencePackage,
  precomputedReport,
  type DemoCheckId,
  type DemoCheckResult,
  type DemoEvidencePackage,
} from '@dems/shared/demo-data';
import {
  EVIDENCE_STATUS_STAGE,
  EvidenceStatus,
  TRACK_ORDER,
  verifyEvidenceItem,
  type EpochMs,
  type EvidenceItem,
  type EvidenceVerifyResult,
} from '@dems/shared/sim';
import type { StatusTone } from '@dems/shared/tokens';

// ---------------------------------------------------------------------------------------------
// List: filters, search, sort
// ---------------------------------------------------------------------------------------------

/** E3 filter chips in MB 5 order; the fifth scrolls into view on a phone (04 §4.10). */
export const EVIDENCE_FILTERS = ['ALL', 'RECORDED', 'SEALED', 'EXPORTED', 'UNDER_REVIEW'] as const;
export type EvidenceFilter = (typeof EVIDENCE_FILTERS)[number];

export type EvidenceSort = 'newest' | 'oldest';
export type EvidenceDensity = 'comfortable' | 'compact';

/** Search input cap (the shared 64-character ID/case limit, D61). */
export const SEARCH_MAX_LENGTH = 64;

export function isEvidenceFilter(value: unknown): value is EvidenceFilter {
  return typeof value === 'string' && (EVIDENCE_FILTERS as readonly string[]).includes(value);
}

export function matchesFilter(item: Pick<EvidenceItem, 'status'>, filter: EvidenceFilter): boolean {
  return filter === 'ALL' || item.status === filter;
}

/** Normalised search text: trimmed, lower-case, inner whitespace collapsed, capped. */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').slice(0, SEARCH_MAX_LENGTH).toLowerCase();
}

/**
 * E2 search: "session ID, subject, or case number" (MB 5 placeholder), plus the evidence ID.
 * Case-insensitive substring match on each field; an empty query matches everything.
 */
export function matchesQuery(
  item: Pick<EvidenceItem, 'id' | 'sessionId' | 'caseNumber' | 'subjectName'>,
  query: string,
): boolean {
  const q = normalizeQuery(query);
  if (q.length === 0) return true;
  return [item.id, item.sessionId, item.caseNumber, item.subjectName].some((field) => field.toLowerCase().includes(q));
}

export interface EvidenceQuery {
  filter: EvidenceFilter;
  query: string;
  sort: EvidenceSort;
}

export const DEFAULT_EVIDENCE_QUERY: EvidenceQuery = { filter: 'ALL', query: '', sort: 'newest' };

/** The visible rows for a filter, search and sort (stable: ties keep ID order). */
export function filterEvidence<T extends Pick<EvidenceItem, 'id' | 'sessionId' | 'caseNumber' | 'subjectName' | 'status' | 'recordedAt'>>(
  items: readonly T[],
  { filter, query, sort }: EvidenceQuery,
): T[] {
  const rows = items.filter((item) => matchesFilter(item, filter) && matchesQuery(item, query));
  const direction = sort === 'newest' ? -1 : 1;
  return rows.sort((a, b) => (a.recordedAt === b.recordedAt ? a.id.localeCompare(b.id) : (a.recordedAt - b.recordedAt) * direction));
}

/** True when the list shows a subset because of a filter or a search (the empty state's "Clear filters"). */
export function isFiltered({ filter, query }: EvidenceQuery): boolean {
  return filter !== 'ALL' || normalizeQuery(query).length > 0;
}

// ---------------------------------------------------------------------------------------------
// Status and subject chips
// ---------------------------------------------------------------------------------------------

export type EvidenceStatusIcon = 'lock' | 'dot' | 'upload' | 'eye' | 'archive';

export interface EvidenceStatusSpec {
  tone: StatusTone;
  icon: EvidenceStatusIcon;
  /** Fill the icon with the tone colour (the Recorded dot). */
  filled: boolean;
}

/** E4 status chips (04 §4.10; D28/Q4: Sealed is violet with `Lock`, not the mockup's gold). */
export const EVIDENCE_STATUS_SPEC = {
  RECORDED: { tone: 'success', icon: 'dot', filled: true },
  SEALED: { tone: 'sealed', icon: 'lock', filled: false },
  EXPORTED: { tone: 'info', icon: 'upload', filled: false },
  UNDER_REVIEW: { tone: 'warning', icon: 'eye', filled: false },
  ARCHIVED: { tone: 'default', icon: 'archive', filled: false },
} as const satisfies Record<EvidenceStatus, EvidenceStatusSpec>;

// ---------------------------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------------------------

export interface SizeParts {
  /** The `common.units.*` key. */
  unit: 'tb' | 'gb' | 'mb';
  value: string;
}

/** Decimal units, one decimal place, as the simulator counts storage (804 GB of 4.0 TB). */
export function fileSizeParts(bytes: number): SizeParts {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safe >= 1e12) return { unit: 'tb', value: (safe / 1e12).toFixed(1) };
  if (safe >= 1e9) return { unit: 'gb', value: (safe / 1e9).toFixed(1) };
  return { unit: 'mb', value: (safe / 1e6).toFixed(1) };
}

/** `a1b2c3d4…e5f6a7b8`: a hash shortened for a row, both ends kept (the full value stays selectable). */
export function shortHash(hash: string | null | undefined, keep = 8): string {
  if (!hash) return '—';
  return hash.length <= keep * 2 + 1 ? hash : `${hash.slice(0, keep)}…${hash.slice(-keep)}`;
}

// ---------------------------------------------------------------------------------------------
// Join to the DEMO packages (D61)
// ---------------------------------------------------------------------------------------------

/** The evidence number suffix (`EV-20261001-0007` → `0007`), or null for an unknown format. */
export function evidenceSuffixOf(evidenceId: string): string | null {
  return demoIdSuffix(evidenceId, 'EV');
}

/** The DEMO package of an evidence item (joined by suffix), or null (for example a second live recording). */
export function packageFor(evidenceId: string): DemoEvidencePackage | null {
  return getDemoEvidencePackage(evidenceId);
}

/**
 * The time source the sealed manifest records (`timeSource.source`, §11.3 field 7), e.g. `GNSS`;
 * null without a package or when the manifest text cannot be read.
 */
export function packageTimeSource(evidenceId: string): string | null {
  const documents = getDemoEvidenceDocuments(evidenceId);
  if (!documents) return null;
  try {
    const manifest = JSON.parse(documents.manifestJson) as { timeSource?: { source?: unknown } };
    return typeof manifest.timeSource?.source === 'string' ? manifest.timeSource.source : null;
  } catch {
    return null;
  }
}

/** The recording scenario's item (evidence 0014) plays the live loops (65 §2). */
export function isLiveLoopEvidence(suffix: string | null): boolean {
  return suffix !== null && suffix === DEMO_EVIDENCE_INDEX.liveSession.evidenceSuffixWhenSealed;
}

// ---------------------------------------------------------------------------------------------
// Playback: the excerpt rule
// ---------------------------------------------------------------------------------------------

/** The clip offset for a recording position: p mod the clip length (both in ms; never negative). */
export function excerptOffsetMs(positionMs: number, clipMs: number): number {
  if (!Number.isFinite(positionMs) || !Number.isFinite(clipMs) || clipMs <= 0) return 0;
  const p = Math.max(0, positionMs);
  return p % clipMs;
}

/** A position clamped to the recording, `[0, durationMs]`. */
export function clampPosition(positionMs: number, durationMs: number): number {
  if (!Number.isFinite(positionMs)) return 0;
  return Math.min(Math.max(0, positionMs), Math.max(0, durationMs));
}

/** How far a player may drift from the expected clip offset before it is re-seeked (seconds). */
export const PLAYBACK_DRIFT_TOLERANCE_S = 0.35;

/**
 * Whether a player at `actualS` should be re-seeked to `expectedS` within a looping clip of
 * `clipS` seconds (the distance wraps: 0.1 s and 39.9 s of a 40 s clip are 0.2 s apart).
 */
export function needsResync(actualS: number, expectedS: number, clipS: number, tolerance = PLAYBACK_DRIFT_TOLERANCE_S): boolean {
  if (!Number.isFinite(actualS) || !Number.isFinite(expectedS) || clipS <= 0) return false;
  const raw = Math.abs(actualS - expectedS) % clipS;
  return Math.min(raw, clipS - raw) > tolerance;
}

// ---------------------------------------------------------------------------------------------
// Integrity (D51: the package's precomputed result, "verified by the Core")
// ---------------------------------------------------------------------------------------------

export type IntegritySource = 'package' | 'simulated';
export type IntegrityVerdict = 'PASS' | 'FAIL';

export interface IntegrityRow {
  /** `track:VIDEO-01`, `manifest`, `signature`, … */
  id: string;
  trackId: TrackId | null;
  ok: boolean;
  expected: string | null;
  actual: string | null;
  detail?: string;
}

export interface IntegrityModel {
  source: IntegritySource;
  verdict: IntegrityVerdict;
  /** "DEMO - precomputed" for a package; "SIMULATED" for the simulator fallback. */
  label: string;
  /** Failed check IDs, e.g. `['track:AUDIO-02']`. */
  failed: string[];
  tracks: IntegrityRow[];
  /** The non-track checks (manifest, signature, certificate, audit chain, export). */
  checks: IntegrityRow[];
  manifestHash: string;
  signature: { value: string; keyId: string; algorithm: 'Ed25519' | 'SIMULATED-SHA256' };
  certificate: { subject: string; sha256: string } | null;
  audit: { rows: number; firstSeq: number; lastSeq: number } | null;
}

export const SIMULATED_INTEGRITY_LABEL = 'SIMULATED';

function trackIdOf(checkId: string): TrackId | null {
  return checkId.startsWith('track:') ? (checkId.slice('track:'.length) as TrackId) : null;
}

function rowOf(check: DemoCheckResult): IntegrityRow {
  return {
    id: check.id,
    trackId: trackIdOf(check.id),
    ok: check.ok,
    expected: check.expected,
    actual: check.actual,
    ...(check.detail ? { detail: check.detail } : {}),
  };
}

/** Integrity of a DEMO package: the generator's precomputed report (D51), tracks in TRACK_ORDER. */
export function packageIntegrity(pkg: DemoEvidencePackage): IntegrityModel {
  const report = precomputedReport(pkg);
  const rows = report.checks.map(rowOf);
  const order = (row: IntegrityRow) => (row.trackId ? TRACK_ORDER.indexOf(row.trackId as (typeof TRACK_ORDER)[number]) : 99);
  return {
    source: 'package',
    verdict: report.result,
    label: report.label,
    failed: [...report.failed],
    tracks: rows.filter((row) => row.trackId !== null).sort((a, b) => order(a) - order(b)),
    checks: rows.filter((row) => row.trackId === null),
    manifestHash: pkg.signature.signedDigest,
    signature: { value: pkg.signature.signatureHex, keyId: pkg.signature.keyId, algorithm: pkg.signature.algorithm },
    certificate: { subject: DEMO_EVIDENCE_INDEX.certificate.subject, sha256: DEMO_EVIDENCE_INDEX.certificate.sha256 },
    audit: { rows: pkg.audit.rows, firstSeq: pkg.audit.firstSeq, lastSeq: pkg.audit.lastSeq },
  };
}

/** Integrity from the simulator's own synthetic record (no package on this device). */
export function simulatedIntegrity(item: EvidenceItem, at: EpochMs): IntegrityModel {
  const result = verifyEvidenceItem(item, at);
  const tracks: IntegrityRow[] = result.tracks.map((track) => ({
    id: `track:${track.trackId}`,
    trackId: track.trackId,
    ok: track.ok,
    expected: track.expected,
    actual: track.actual,
  }));
  const checks: IntegrityRow[] = [
    { id: 'manifest', trackId: null, ok: result.manifestOk, expected: item.manifestHash, actual: null },
    { id: 'signature', trackId: null, ok: result.signatureOk, expected: item.signature.value, actual: null },
  ];
  return {
    source: 'simulated',
    verdict: result.ok ? 'PASS' : 'FAIL',
    label: SIMULATED_INTEGRITY_LABEL,
    failed: [...tracks, ...checks].filter((row) => !row.ok).map((row) => row.id),
    tracks,
    checks,
    manifestHash: item.manifestHash,
    signature: { value: item.signature.value, keyId: item.signature.keyId, algorithm: item.signature.algorithm },
    certificate: null,
    audit: null,
  };
}

/** The integrity model the detail shows: the package when one exists, else the simulator's own. */
export function integrityFor(item: EvidenceItem, at: EpochMs): IntegrityModel {
  const pkg = packageFor(item.id);
  return pkg ? packageIntegrity(pkg) : simulatedIntegrity(item, at);
}

/** Display names of failed checks: `track:AUDIO-02` → `AUDIO-02`, others unchanged. */
export function failedCheckNames(failed: readonly string[]): string[] {
  return failed.map((id) => trackIdOf(id) ?? id);
}

// ---------------------------------------------------------------------------------------------
// Live mode: the Core server's verdict of record (backend task W74; 04_client_integration_spec
// §14 point 7, §8.5 "verify"; AC-C-61)
// ---------------------------------------------------------------------------------------------

/** What the Core's verification answered: operation 41 `verifyEvidence`, the simulator's own shape. */
export type CoreVerdict = EvidenceVerifyResult;

/**
 * What the Live integrity tab shows: the Core's sealed record of the item (the replica's hashes)
 * and, once the Core answered, its verdict. Nothing here is computed on the tablet: `verdict`,
 * `failed`, every `actual` and every `ok` come from the Core's answer, and are `null`, empty or
 * `false` until there is one (a row's `ok` is never shown before a verdict is revealed).
 */
export interface CoreIntegrityView {
  verdict: IntegrityVerdict | null;
  /** Failed check IDs of the Core's verdict (`track:AUDIO-02`, `manifest`, `signature`). */
  failed: string[];
  /** When the Core ran the verification, on its clock; null before an answer. */
  at: EpochMs | null;
  /** The four tracks in TRACK_ORDER: the sealed hash, and the hash the Core computed. */
  tracks: IntegrityRow[];
  /** Manifest and signature, as the Core judged them. */
  checks: IntegrityRow[];
  manifestHash: string;
  signature: { value: string; keyId: string; algorithm: string };
}

/** The Core's sealed record and, when given, the Core's verdict of it (never the tablet's). */
export function coreIntegrityView(item: EvidenceItem, verdict: CoreVerdict | null): CoreIntegrityView {
  const answered = new Map((verdict?.tracks ?? []).map((track) => [track.trackId, track]));
  const tracks: IntegrityRow[] = TRACK_ORDER.map((trackId) => {
    const answer = answered.get(trackId);
    const sealed = item.tracks.find((track) => track.trackId === trackId);
    return {
      id: `track:${trackId}`,
      trackId,
      ok: answer?.ok ?? false,
      expected: answer?.expected ?? sealed?.sha256 ?? null,
      actual: answer?.actual ?? null,
    };
  });
  const checks: IntegrityRow[] = [
    { id: 'manifest', trackId: null, ok: verdict?.manifestOk ?? false, expected: item.manifestHash, actual: null },
    { id: 'signature', trackId: null, ok: verdict?.signatureOk ?? false, expected: item.signature.value, actual: null },
  ];
  return {
    verdict: verdict === null ? null : verdict.ok ? 'PASS' : 'FAIL',
    failed: verdict === null ? [] : [...tracks, ...checks].filter((row) => !row.ok).map((row) => row.id),
    at: verdict?.at ?? null,
    tracks,
    checks,
    manifestHash: item.manifestHash,
    signature: { value: item.signature.value, keyId: item.signature.keyId, algorithm: item.signature.algorithm },
  };
}

// ---------------------------------------------------------------------------------------------
// Stored verification (closing-fix CF-M2, defect R-T-2): the card reads the verification the record
// holds, like the web console after E2E-W1-3 (apps/core-web/src/features/evidence/model.ts
// `storedVerification`, the same rule).
// ---------------------------------------------------------------------------------------------

/** The custody action each verdict writes (simulator `verifyEvidenceTransition`; the Core's operation 41). */
const VERIFY_CUSTODY_ACTION = { PASS: 'VERIFIED', FAIL: 'VERIFY_FAILED' } as const;

/** The record's last verification: its verdict, when, and who ran it. */
export interface StoredVerification {
  status: IntegrityVerdict;
  at: EpochMs | null;
  /** The operator of the verification's custody entry; null for the system. */
  actorId: string | null;
  /** False when the custody list holds no entry of that verification (who ran it is then not known). */
  actorKnown: boolean;
}

/**
 * The verification the record holds (`item.verification`, kept by the Core server in Live mode), with
 * the actor of its custody entry: the entry of the same verdict at the SAME instant. Null when the record
 * holds none (`NOT_RUN`). Post-review fix FXR-M (W93-25): without an exact match the actor is not known
 * (`actorKnown: false`, the "no actor" copy); it used to name the operator of the newest entry of that
 * verdict, which can be an older verification's.
 */
export function storedVerification(item: Pick<EvidenceItem, 'verification' | 'custody'>): StoredVerification | null {
  const { status, at } = item.verification;
  if (status !== 'PASS' && status !== 'FAIL') return null;
  const action = VERIFY_CUSTODY_ACTION[status];
  const entries = item.custody.filter((entry) => entry.action === action);
  // Newest first, without `findLast` (kept off the device's JS engine on purpose).
  const newestFirst = entries.slice().reverse();
  const matched = newestFirst.find((candidate) => candidate.at === at) ?? null;
  return { status, at, actorId: matched?.actorId ?? null, actorKnown: matched !== null };
}

/** What the Live card says about the item: the record's verdict, or that the Core has not verified it. */
export type CoreVerificationState = IntegrityVerdict | 'NOT_RUN';

/**
 * The state the Live card's heading names: this screen's verdict once it is revealed (a new Verify
 * replaces the record's), else the verdict the record holds, else `NOT_RUN`.
 */
export function coreVerificationState(stored: Pick<StoredVerification, 'status'> | null, revealed: IntegrityVerdict | null): CoreVerificationState {
  return revealed ?? stored?.status ?? 'NOT_RUN';
}

/** The heading of the Live card per state (`features.evidence.integrity.*`). */
export const CORE_HEADING_KEYS: Readonly<Record<CoreVerificationState, string>> = {
  PASS: 'features.evidence.integrity.verifiedByCore',
  FAIL: 'features.evidence.integrity.failedOnCore',
  NOT_RUN: 'features.evidence.integrity.notVerifiedYet',
};

/**
 * Whether the bundled demo package's result differs from the Core's verdict (§14 point 7): another
 * verdict, or other failed tracks. The checks only a package has (certificate, audit extract, export
 * package) are not compared: the Core's verdict has no such check.
 */
export function bundledDiffers(bundled: Pick<IntegrityModel, 'verdict' | 'failed'>, verdict: CoreVerdict): boolean {
  if (bundled.verdict !== (verdict.ok ? 'PASS' : 'FAIL')) return true;
  const bundledTracks = bundled.failed.map(trackIdOf).filter((trackId): trackId is TrackId => trackId !== null).sort();
  const coreTracks = verdict.tracks.filter((track) => !track.ok).map((track) => track.trackId).sort();
  return bundledTracks.join(',') !== coreTracks.join(',');
}

/** Every precomputed check ID a package report can carry (typed for the i18n lookups). */
export type IntegrityCheckId = DemoCheckId;

// ---------------------------------------------------------------------------------------------
// Lifecycle (§19.1) and export rules
// ---------------------------------------------------------------------------------------------

/** The 12 lifecycle stages in order (C-4 horizontal lifecycle). */
export const LIFECYCLE_STAGES = [
  'CAPTURE',
  'RECORDING',
  'FINALIZING',
  'HASH',
  'MANIFEST',
  'ENCRYPT',
  'SIGN',
  'SEALED_LOCAL_EVIDENCE',
  'AUTHORIZED_REVIEW',
  'AUTHORIZED_EXPORT_TRANSFER',
  'DESTINATION_VERIFICATION',
  'RETENTION_ARCHIVE_DISPOSITION',
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

/** Stepper statuses for an item's stage: earlier stages done, the current one active, later pending. */
export function lifecycleStatuses(stage: string): ('done' | 'active' | 'pending')[] {
  const index = LIFECYCLE_STAGES.indexOf(stage as LifecycleStage);
  return LIFECYCLE_STAGES.map((_, i) => (index < 0 ? 'pending' : i < index ? 'done' : i === index ? 'active' : 'pending'));
}

/** Statuses the Core exports (sim `exportEvidenceTransition` EXPORTABLE). */
export const EXPORTABLE_STATUSES: readonly EvidenceStatus[] = [
  EvidenceStatus.SEALED,
  EvidenceStatus.UNDER_REVIEW,
  EvidenceStatus.EXPORTED,
];

export function isExportable(status: EvidenceStatus): boolean {
  return EXPORTABLE_STATUSES.includes(status);
}

/** Archive is offered for sealed, reviewed and exported items (never RECORDED or ARCHIVED). */
export function isArchivable(status: EvidenceStatus): boolean {
  return status !== EvidenceStatus.RECORDED && status !== EvidenceStatus.ARCHIVED;
}

/** Export reason: at least 5 characters after trimming (S21, §19.2 item 8); the UI caps input at 500. */
export const EXPORT_REASON_MIN = 5;
export const EXPORT_REASON_MAX = 500;

export interface ReasonCheck {
  value: string;
  length: number;
  valid: boolean;
}

export function checkExportReason(raw: string): ReasonCheck {
  const value = raw.trim();
  return { value, length: value.length, valid: value.length >= EXPORT_REASON_MIN && value.length <= EXPORT_REASON_MAX };
}

/** The two simulated destinations (the shared `evidence.exportWizard.destination*` copy). */
export const EXPORT_DESTINATIONS = ['usb', 'network'] as const;
export type ExportDestination = (typeof EXPORT_DESTINATIONS)[number];

/** The wizard's C-4 steps in order (04 §4.11 D6). */
export const EXPORT_STEPS = ['authorize', 'verify', 'destination', 'reason', 'build', 'done'] as const;
export type ExportStep = (typeof EXPORT_STEPS)[number];

/** The lifecycle stage a status maps to (re-exported for the detail's lifecycle strip). */
export const STATUS_STAGE = EVIDENCE_STATUS_STAGE;
