/**
 * The named errors of a local-device source (blueprint row 134; capture spec §A.6.4 HL-10, HL-11;
 * R-11 AC-5).
 *
 * FIVE codes, the same five the microphone side names (`AudioInputErrorCode` of `../types`). A
 * local device that cannot be used is reported with one of them and NEVER replaced by a fake
 * source (HL-11; static rule G-R14: no file of this folder imports the fake adapters).
 *
 * The `reason` says, from a closed list, at which step the code was decided. Neither field ever
 * carries text of the helper, a device name, an address or a path: the error is safe in every
 * log, error-log and audit path, and the layer above decides what to raise (spec §A.6.5 row 5).
 */
export const LocalSourceErrorCode = {
  /** Decided BEFORE any open, from the device list: the name is absent, ambiguous, or not a usable name. */
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  /** The open failed and the helper's output matches the pinned pattern of a refused permission. */
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  /** The open failed and the helper's output matches the pinned pattern of a device in use. */
  DEVICE_BUSY: 'DEVICE_BUSY',
  /** The source could not be opened and no pattern matches: an unknown failure is never guessed into another code. */
  OPEN_FAILED: 'OPEN_FAILED',
  /** The helper had started and ended early. */
  HELPER_EXITED: 'HELPER_EXITED',
} as const;
export type LocalSourceErrorCode = (typeof LocalSourceErrorCode)[keyof typeof LocalSourceErrorCode];

export const LocalSourceErrorReason = {
  /** No listed entry equals the configured name. */
  NAME_ABSENT: 'NAME_ABSENT',
  /** More than one listed entry equals the name, or another entry begins with it (the device layer matches by prefix). */
  NAME_AMBIGUOUS: 'NAME_AMBIGUOUS',
  /** The configured name is not one the helper can be given: an index, a keyword, a screen capture, a separator. */
  NAME_NOT_ALLOWED: 'NAME_NOT_ALLOWED',
  /** The device list could not be read. */
  LIST_UNAVAILABLE: 'LIST_UNAVAILABLE',
  /** The helper program is refused by the path rule (SEC35-43), or could not be started. */
  PROGRAM_REFUSED: 'PROGRAM_REFUSED',
  /** The speech fixture of the development speech microphone is absent or refused by the path rule (fix wave H). */
  FIXTURE_REFUSED: 'FIXTURE_REFUSED',
  /** The push target is not the loopback listener of a plan. */
  TARGET_REFUSED: 'TARGET_REFUSED',
  /** A helper of this device is running already. */
  ALREADY_OPEN: 'ALREADY_OPEN',
  /** The call was aborted. */
  ABORTED: 'ABORTED',
  /** The worker's listener refused the connection, also after the one retry (HL-5). */
  INGEST_REFUSED: 'INGEST_REFUSED',
  /** The helper ended while it was being started. */
  EXIT_AT_START: 'EXIT_AT_START',
  /** The helper ended during the session, not on our request. */
  EXIT_IN_SESSION: 'EXIT_IN_SESSION',
  /** The short open of the pre-check did not end within its bound. */
  PRECHECK_TIMEOUT: 'PRECHECK_TIMEOUT',
  /** The helper's output matched a pinned pattern. */
  PATTERN: 'PATTERN',
  /** The camera helper lived but put out no frame within 8 s of its start (H-18, D118): it was stopped. Never a silent wait. */
  NO_FRAME_WITHIN_8S: 'NO_FRAME_WITHIN_8S',
  /** The microphone helper lived but wrote no sample within 8 s of its start: it was stopped. */
  NO_SAMPLE_WITHIN_8S: 'NO_SAMPLE_WITHIN_8S',
  /** No pattern matched. */
  UNCLASSIFIED: 'UNCLASSIFIED',
} as const;
export type LocalSourceErrorReason = (typeof LocalSourceErrorReason)[keyof typeof LocalSourceErrorReason];

const TEXT: Readonly<Record<LocalSourceErrorCode, string>> = Object.freeze({
  DEVICE_NOT_FOUND: 'the local device is not in the device list under exactly its name',
  PERMISSION_DENIED: 'the operating system refused access to the local device',
  DEVICE_BUSY: 'the local device is in use',
  OPEN_FAILED: 'the local device could not be opened',
  HELPER_EXITED: 'the helper of the local device ended early',
});

export class LocalSourceError extends Error {
  readonly code: LocalSourceErrorCode;
  readonly reason: LocalSourceErrorReason;
  /** The registry ID of the device (`CAM-NN`), or null. Never a device name. */
  readonly deviceId: string | null;
  constructor(code: LocalSourceErrorCode, reason: LocalSourceErrorReason, deviceId: string | null = null) {
    super(TEXT[code]);
    this.name = 'LocalSourceError';
    this.code = code;
    this.reason = reason;
    this.deviceId = deviceId;
  }
}
