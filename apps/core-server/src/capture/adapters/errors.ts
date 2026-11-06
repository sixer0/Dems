/**
 * Refusals of the adapter layer (blueprint row 65; capture spec §A.1 "Failure modes", §A.1.1 rules
 * RG-1 to RG-5, §A.6.3 rule CR-4).
 *
 * An adapter error carries a machine code and, at most, a device ID. Its text is one of the fixed
 * sentences below: no value a caller passed in (an address, a locator, a credential) is ever put
 * into a message, so that the error is safe in every log, error-log and audit path (CR-4).
 */
export const CaptureAdapterRefusal = {
  /** No registered adapter serves this device ID. A discovery candidate is never one (rule RG-4). */
  DEVICE_UNKNOWN: 'CAPTURE_DEVICE_UNKNOWN',
  /** A second adapter names a device ID that is registered already. */
  DEVICE_DUPLICATE: 'CAPTURE_DEVICE_DUPLICATE',
  /** The device exists, but it is not of the class that was asked for. */
  DEVICE_CLASS_MISMATCH: 'CAPTURE_DEVICE_CLASS_MISMATCH',
  /** The adapter's kind may not be registered in the running capture operation (rule RG-1). */
  ADAPTER_KIND_NOT_ALLOWED: 'CAPTURE_ADAPTER_KIND_NOT_ALLOWED',
  /**
   * An adapter that says it has an opener for a kind not on the opener list (D86 C-5 as amended by AM-1: `SNMP_POE` and any
   * later kind), or an opener of another source class than the running operation records (task 4 row 88; addendum 1.4 #7).
   */
  ADAPTER_INVALID: 'CAPTURE_ADAPTER_INVALID',
  /** The configuration is locked while a session is open (OD-10). */
  REGISTRY_LOCKED: 'CAPTURE_REGISTRY_LOCKED',
  /** The device's source class is not the class of the running operation (rule RG-3). */
  SOURCE_CLASS_NOT_ALLOWED: 'DEVELOPMENT_SOURCE_NOT_ALLOWED',
  /** No listener and no session for a source whose adapter states no opener (D86 C-5; since AM-1 the adapter's own word decides for the two lifted kinds). */
  SOURCE_KIND_NOT_RECORDABLE: 'SOURCE_KIND_NOT_RECORDABLE',
  /** The device has no such media profile. */
  PROFILE_UNKNOWN: 'CAPTURE_PROFILE_UNKNOWN',
  /** A locator that is not the host-and-path form: it carries a user part, or is not a stream locator at all (SEC35-04). */
  LOCATOR_INVALID: 'CAPTURE_LOCATOR_INVALID',
  /** A start message that cannot be made into bytes: a member that is not a plain value or the one stream access (task 4 row 147; AD-03 point 6). */
  START_MESSAGE_INVALID: 'CAPTURE_START_MESSAGE_INVALID',
  /** The PoE port is not one this controller serves. */
  POE_PORT_UNKNOWN: 'CAPTURE_POE_PORT_UNKNOWN',
  /** The source was asked for after the call was aborted. */
  ABORTED: 'CAPTURE_ADAPTER_ABORTED',
  /** A member of an adapter that builds nothing: the switch stub, the microphone adapter of a host without an opener, the retired camera stub (task 4 row 88). */
  CLASS_C_NOT_BUILT: 'CAPTURE_ADAPTER_CLASS_C',
  /** The production adapters were asked for in an operation that never loads them. */
  REAL_ADAPTERS_REFUSED: 'CAPTURE_REAL_ADAPTERS_REFUSED',
} as const;
export type CaptureAdapterRefusal = (typeof CaptureAdapterRefusal)[keyof typeof CaptureAdapterRefusal];

const TEXT: Readonly<Record<CaptureAdapterRefusal, string>> = Object.freeze({
  CAPTURE_DEVICE_UNKNOWN: 'no registered capture adapter serves this device',
  CAPTURE_DEVICE_DUPLICATE: 'a capture adapter for this device is registered already',
  CAPTURE_DEVICE_CLASS_MISMATCH: 'the capture device is not of the class that was asked for',
  CAPTURE_ADAPTER_KIND_NOT_ALLOWED: 'this adapter kind is not registered in the running capture operation',
  CAPTURE_ADAPTER_INVALID: 'the adapter states an opener for a kind that has none in this phase',
  CAPTURE_REGISTRY_LOCKED: 'the capture configuration is locked while a session is open',
  DEVELOPMENT_SOURCE_NOT_ALLOWED: 'the source class of the device is not the class of the running capture operation',
  SOURCE_KIND_NOT_RECORDABLE: 'no opener exists for this source kind',
  CAPTURE_PROFILE_UNKNOWN: 'the capture device has no such media profile',
  CAPTURE_LOCATOR_INVALID: 'a stream locator must be the host-and-path form without a user part',
  CAPTURE_START_MESSAGE_INVALID: 'a start message must be a flat object of plain values and at most one stream access',
  CAPTURE_POE_PORT_UNKNOWN: 'the PoE controller does not serve this port',
  CAPTURE_ADAPTER_ABORTED: 'the call was aborted',
  CAPTURE_ADAPTER_CLASS_C: 'this adapter member is class C: specified, not built in this phase',
  CAPTURE_REAL_ADAPTERS_REFUSED: 'the class-C adapters are not loaded in this capture operation',
});

export class CaptureAdapterError extends Error {
  readonly code: CaptureAdapterRefusal;
  /** The device the refusal is about (a registry ID such as `CAM-01`), or null. Never an address. */
  readonly deviceId: string | null;
  constructor(code: CaptureAdapterRefusal, deviceId: string | null = null) {
    super(TEXT[code]);
    this.name = 'CaptureAdapterError';
    this.code = code;
    this.deviceId = deviceId;
  }
}
