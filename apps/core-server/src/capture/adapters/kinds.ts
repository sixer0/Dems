/**
 * The vocabulary of the adapter layer (blueprint row 65 / M4-W1; register NM-01; capture spec
 * §A.1, §A.1.1, §A.1.2; contract C3 §2.6 "Device shapes").
 *
 * Three axes, never mixed:
 *   - the DEVICE CLASS (`CAMERA` | `MIC` | `POE`): what a device is. It is the `kind` of the
 *     `captureDevices` slice and of `capture_devices`, read from `@dems/shared`, not restated;
 *   - the ADAPTER KIND: which adapter stands behind a device. Written at INSERT, never updated;
 *   - the SOURCE CLASS: derived from the adapter kind by ONE function (`sourceClassOf`), never
 *     stored twice.
 *
 * TODO(row 129): the five adapter kinds are the value set of `capture_devices.adapter_kind`
 * (`dbc-4` §N.2, D83). That column is not in the typed schema until row 129 lands; when it is, the
 * schema's check and this object are held to each other by a test, and this stays the one value
 * set of the Core process.
 * TODO(row 61): `CaptureOperation` is the result of the ONE function that defines the capture
 * operation (`captureOperationOf(config)`, spec §A.1.2). Row 61 builds the function; the adapter
 * layer only takes its result as an argument and reads no flag itself (static rule G-R15).
 */
import type { CaptureDeviceStatus } from '@dems/shared/sim';

/** The device class: `CAMERA`, `MIC` or `POE` (the slice's own member type). */
export type CaptureDeviceClass = CaptureDeviceStatus['kind'];

export const CaptureAdapterKind = {
  ONVIF_RTSP: 'ONVIF_RTSP',
  USB_AUDIO: 'USB_AUDIO',
  SNMP_POE: 'SNMP_POE',
  FAKE: 'FAKE',
  LOCAL_DEVICE: 'LOCAL_DEVICE',
} as const;
export type CaptureAdapterKind = (typeof CaptureAdapterKind)[keyof typeof CaptureAdapterKind];
export const CAPTURE_ADAPTER_KINDS: readonly CaptureAdapterKind[] = Object.freeze(Object.values(CaptureAdapterKind));

export const CaptureSourceClass = { PRODUCTION: 'PRODUCTION', DEVELOPMENT: 'DEVELOPMENT' } as const;
export type CaptureSourceClass = (typeof CaptureSourceClass)[keyof typeof CaptureSourceClass];

const SOURCE_CLASS_OF_KIND = Object.freeze({
  ONVIF_RTSP: CaptureSourceClass.PRODUCTION,
  USB_AUDIO: CaptureSourceClass.PRODUCTION,
  SNMP_POE: CaptureSourceClass.PRODUCTION,
  FAKE: CaptureSourceClass.DEVELOPMENT,
  LOCAL_DEVICE: CaptureSourceClass.DEVELOPMENT,
} as const satisfies Record<CaptureAdapterKind, CaptureSourceClass>);

/** THE derivation of the source class (D80(9)). Every reader asks this function. */
export function sourceClassOf(kind: CaptureAdapterKind): CaptureSourceClass {
  return SOURCE_CLASS_OF_KIND[kind];
}

/** The capture operation of a running Core (spec §A.1.2). Decided once, at boot, by row 61's function. */
export const CaptureOperation = {
  SIMULATED: 'SIMULATED',
  REAL_PRODUCTION: 'REAL_PRODUCTION',
  REAL_DEVELOPMENT: 'REAL_DEVELOPMENT',
} as const;
export type CaptureOperation = (typeof CaptureOperation)[keyof typeof CaptureOperation];

/** The source class an operation records, or null for the operation that records nothing. */
export function sourceClassOfOperation(operation: CaptureOperation): CaptureSourceClass | null {
  if (operation === CaptureOperation.REAL_PRODUCTION) return CaptureSourceClass.PRODUCTION;
  if (operation === CaptureOperation.REAL_DEVELOPMENT) return CaptureSourceClass.DEVELOPMENT;
  return null;
}

/**
 * Which adapter kinds may be registered in an operation (rule RG-1). In `REAL_DEVELOPMENT` the
 * production camera kind is registered too, for its search and connection-test half only: it is
 * never assignable there (rule RG-3) and it has no opener (D86 C-5).
 */
export function registrableKindsOf(operation: CaptureOperation): readonly CaptureAdapterKind[] {
  if (operation === CaptureOperation.REAL_PRODUCTION) return CAPTURE_ADAPTER_KINDS.filter((kind) => sourceClassOf(kind) === CaptureSourceClass.PRODUCTION);
  if (operation === CaptureOperation.REAL_DEVELOPMENT) return [...CAPTURE_ADAPTER_KINDS.filter((kind) => sourceClassOf(kind) === CaptureSourceClass.DEVELOPMENT), CaptureAdapterKind.ONVIF_RTSP];
  return [];
}
