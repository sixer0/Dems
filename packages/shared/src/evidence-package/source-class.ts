/**
 * Source class of every recorded source (spec §B.12, fields 124-126; database contract N.2, N.3).
 *
 * THE RULES THIS FILE HOLDS.
 *   1. The three manifest values are fixed: PRODUCTION | LOCAL_DEVICE | FAKE.
 *   2. The class comes from the ADAPTER KIND recorded for the session at its start
 *      (`session_capture_sources`, four rows per session), by ONE closed mapping. A kind without a
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

/** The four slots of `session_capture_sources` (value set `CAPTURE_SOURCE_SLOT`). */
export const CAPTURE_SOURCE_SLOTS = ['VIDEO-01', 'VIDEO-02', 'MIC-PRIMARY', 'MIC-STANDBY'] as const;
export type CaptureSourceSlot = (typeof CAPTURE_SOURCE_SLOTS)[number];

/** One row of `session_capture_sources` as the manifest builder needs it. */
export interface SessionCaptureSourceRow {
  readonly slot: string;
  readonly deviceId: string;
  readonly adapterKind: string;
}

export interface SessionSourceClasses {
  readonly video: Readonly<Record<PackageVideoTrackId, ManifestSourceClass>>;
  /** Class by microphone device id (both `MIC-` rows; a never-selected standby has no interval). */
  readonly micByDeviceId: ReadonlyMap<string, ManifestSourceClass>;
}

/**
 * The classes of one session from its start record. Exactly four rows, one per slot, or
 * `SOURCE_RECORD_MISSING` (MR-S4: the step fails and nothing is signed). Two `MIC-` rows that
 * name the same device with different kinds are refused as well.
 */
export function sessionSourceClasses(rows: readonly SessionCaptureSourceRow[]): SessionSourceClasses {
  const bySlot = new Map<string, SessionCaptureSourceRow>();
  for (const row of rows) {
    if (bySlot.has(row.slot)) throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_RECORD_MISSING, [row.slot]);
    bySlot.set(row.slot, row);
  }
  const missing = CAPTURE_SOURCE_SLOTS.filter((slot) => !bySlot.has(slot));
  if (missing.length > 0 || bySlot.size !== CAPTURE_SOURCE_SLOTS.length) {
    throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_RECORD_MISSING, missing);
  }
  const classOf = (slot: CaptureSourceSlot): ManifestSourceClass => manifestSourceClassOfAdapterKind(bySlot.get(slot)?.adapterKind ?? '');
  const video = Object.freeze({ 'VIDEO-01': classOf(VIDEO_TRACK_IDS[0]), 'VIDEO-02': classOf(VIDEO_TRACK_IDS[1]) });
  const micByDeviceId = new Map<string, ManifestSourceClass>();
  for (const slot of ['MIC-PRIMARY', 'MIC-STANDBY'] as const) {
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
