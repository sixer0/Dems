/**
 * Source class of every recorded source (spec §B.12, fields 124-126; database contract N.2, N.3).
 *
 * THE RULES THIS FILE HOLDS.
 *   1. The three manifest values are fixed: PRODUCTION | LOCAL_DEVICE | FAKE.
 *   2. The class comes from the ADAPTER KIND recorded for the session at its start
 *      (`session_capture_sources`, the session's own planned slot set — four rows before migration
 *      0039, six after; D60 of 2026-11-04), by ONE closed mapping. A kind without a
 *      class is refused; it is never written as PRODUCTION (rule 2, "fails closed").
 *   3. `developmentSources` is derived: true when at least one class is not PRODUCTION.
 *   4. Absence is never read as PRODUCTION: there is no default anywhere in this unit.
 *
 * Reading the rows from PostgreSQL is the sealing pipeline's (rows 82 / 129); this file takes
 * them as a typed value.
 */
import { EvidencePackageError, EvidencePackageRefusal } from './errors';
import { VIDEO_TRACK_IDS, type PackageVideoTrackId } from './layout';

export const ManifestSourceClass = { PRODUCTION: 'PRODUCTION', LOCAL_DEVICE: 'LOCAL_DEVICE', FAKE: 'FAKE' } as const;
export type ManifestSourceClass = (typeof ManifestSourceClass)[keyof typeof ManifestSourceClass];
export const MANIFEST_SOURCE_CLASSES = Object.freeze(Object.values(ManifestSourceClass)) as readonly ManifestSourceClass[];

/**
 * Adapter kind -> manifest class (database contract N.2). The five kinds of
 * `capture_devices.adapter_kind`; row 141 adds the compile-time check against the Core's kind
 * registry.
 */
export const MANIFEST_SOURCE_CLASS_OF_ADAPTER_KIND = Object.freeze({
  ONVIF_RTSP: ManifestSourceClass.PRODUCTION,
  USB_AUDIO: ManifestSourceClass.PRODUCTION,
  SNMP_POE: ManifestSourceClass.PRODUCTION,
  FAKE: ManifestSourceClass.FAKE,
  LOCAL_DEVICE: ManifestSourceClass.LOCAL_DEVICE,
} as const);
export type MappedAdapterKind = keyof typeof MANIFEST_SOURCE_CLASS_OF_ADAPTER_KIND;

/** Fails closed: an unknown kind throws `SOURCE_CLASS_UNMAPPED`. */
export function manifestSourceClassOfAdapterKind(kind: string): ManifestSourceClass {
  if (!Object.prototype.hasOwnProperty.call(MANIFEST_SOURCE_CLASS_OF_ADAPTER_KIND, kind)) {
    throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_CLASS_UNMAPPED, ['adapterKind']);
  }
  return MANIFEST_SOURCE_CLASS_OF_ADAPTER_KIND[kind as MappedAdapterKind];
}

/** The eight slots of `session_capture_sources` (D61 of 2026-11-04: four video tracks and four numbered microphone channels; the two roles of the earlier eras became `MIC-01`/`MIC-02` in the 0040 data migration (value set `CAPTURE_SOURCE_SLOT`; D60 of 2026-11-04: four video tracks). */
export const CAPTURE_SOURCE_SLOTS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const; // D61 (2026-11-04): four numbered channels
export type CaptureSourceSlot = (typeof CAPTURE_SOURCE_SLOTS)[number];

/** One row of `session_capture_sources` as the manifest builder needs it. */
export interface SessionCaptureSourceRow {
  readonly slot: string;
  readonly deviceId: string;
  readonly adapterKind: string;
}

export interface SessionSourceClasses {
  /**
   * Class by recorded video track. ONLY the tracks the session's own start record carries: a
   * session planned before D60 has two, one planned after has four (D60 backward compatibility, below).
   * A manifest track without a row is refused downstream as `SOURCE_NOT_RECORDED` (`build.ts`), never
   * defaulted.
   */
  readonly video: Readonly<Partial<Record<PackageVideoTrackId, ManifestSourceClass>>>;
  /** Class by microphone device id (both `MIC-` rows; a never-selected standby has no interval). */
  readonly micByDeviceId: ReadonlyMap<string, ManifestSourceClass>;
}

/** The two microphone slots EVERY session plan carries, in both eras (the value set's `MIC-` pair). */
const MIC_SOURCE_SLOTS = ['MIC-01', 'MIC-02'] as const satisfies readonly CaptureSourceSlot[]; // D61: the roles became the first two channels
/** The full D61 microphone prefix: a plan carrying a later channel carries its predecessor too. */
const MIC_PREFIX_SLOTS = ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const satisfies readonly CaptureSourceSlot[];

/**
 * The classes of one session from its start record. The requirement is the session's OWN planned
 * slot set, never a fixed count (D60 backward compatibility, 2026-11-04): migration 0039 widened the
 * plan from four rows to six, and a session started BEFORE that migration keeps its four stored rows
 * forever — demanding six would refuse to seal or verify every legacy session for a shape that was
 * complete when it was written. So the rows themselves are the plan, held to its rules:
 *
 *   - every row names a slot of the value set, and no slot twice (a duplicate is a broken plan);
 *   - at least one `VIDEO-` row (a session records no camera at all is not a start record);
 *   - both microphone rows, PRIMARY and STANDBY, exactly as in every plan of both eras;
 *
 * and a video slot named WITHOUT its predecessors of the recorded order (a gap, e.g. VIDEO-03 with
 * no VIDEO-02) is a torn plan, refused like a missing one. Two `MIC-` rows that name the same device
 * with different kinds are refused as well (the same-class union rule is UNCHANGED by D60). Anything
 * the plan lacks is `SOURCE_RECORD_MISSING` (MR-S4: the step fails and nothing is signed).
 */
export function sessionSourceClasses(rows: readonly SessionCaptureSourceRow[], options: { readonly pairedAudio?: boolean } = {}): SessionSourceClasses {
  const bySlot = new Map<string, SessionCaptureSourceRow>();
  for (const row of rows) {
    if (!(CAPTURE_SOURCE_SLOTS as readonly string[]).includes(row.slot)) throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_RECORD_MISSING, [row.slot]);
    if (bySlot.has(row.slot)) throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_RECORD_MISSING, [row.slot]);
    bySlot.set(row.slot, row);
  }
  const videoSlots = VIDEO_TRACK_IDS.filter((track) => bySlot.has(track));
  if (videoSlots.length === 0) throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_RECORD_MISSING, ['video']);
  // D60 (2026-11-04): a recorded track without a recorded track before it is a torn start record.
  for (let index = 0; index < videoSlots.length; index += 1) {
    if (videoSlots[index] !== VIDEO_TRACK_IDS[index]) {
      throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_RECORD_MISSING, [VIDEO_TRACK_IDS[index] ?? 'video']);
    }
  }
  // D5 (audit row 153; D30 K-3, D45 hand-off): a `/2.1` package's plan is ONE microphone per camera, by number, and a
  // channel may be unassigned at the start (its pair is stated missing, NOT_ASSIGNED): the plan requires no mic slot. A
  // `/2` package keeps the rule of both eras exactly: MIC-01 and MIC-02 are always there.
  const missing = options.pairedAudio === true ? [] : MIC_SOURCE_SLOTS.filter((slot) => !bySlot.has(slot));
  if (missing.length > 0) {
    throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_RECORD_MISSING, [...missing]);
  }
  const classOf = (slot: CaptureSourceSlot): ManifestSourceClass => manifestSourceClassOfAdapterKind(bySlot.get(slot)?.adapterKind ?? '');
  const video = Object.freeze(Object.fromEntries(videoSlots.map((track) => [track, classOf(track)]))) as Readonly<Partial<Record<PackageVideoTrackId, ManifestSourceClass>>>;
  const micByDeviceId = new Map<string, ManifestSourceClass>();
  for (const slot of MIC_PREFIX_SLOTS.filter((micSlot) => bySlot.has(micSlot))) { // D61: whichever channels the plan carries
    const deviceId = bySlot.get(slot)?.deviceId ?? '';
    const sourceClass = classOf(slot);
    const seen = micByDeviceId.get(deviceId);
    if (seen !== undefined && seen !== sourceClass) throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_RECORD_MISSING, [slot]);
    micByDeviceId.set(deviceId, sourceClass);
  }
  return Object.freeze({ video, micByDeviceId });
}

/** Field 126: true when at least one class of field 124 or 125 is not PRODUCTION. */
export function deriveDevelopmentSources(classes: Iterable<ManifestSourceClass>): boolean {
  for (const sourceClass of classes) if (sourceClass !== ManifestSourceClass.PRODUCTION) return true;
  return false;
}
