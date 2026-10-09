/**
 * The four `session_capture_sources` rows of a session, and what a client is told about a source
 * (blueprint row 136; `dbc-4` §N.3 rules MR-S1, MR-S3, MR-S6; capture spec §A.1.1 rules RG-2,
 * RG-3; SEC35-40 (1), (2), (4); decisions D82, D86 C-5, D91 R-2; checks `M4-LOCAL-PLAN-1`,
 * `M4-DEVSRC-*` data half).
 *
 * PURE: no statement, no clock, no flag. The WRITE of the four rows is the session start's (row
 * 71), in the transaction that persists `RECORDING`; this file builds what it writes and checks
 * what it reads back.
 *
 * NO LISTENER AND NO SESSION START FOR A SOURCE KIND WITHOUT AN OPENER (SEC35-40). The session
 * start calls `assertRecordableSelector` of the plan builder (row 66) and hands its result - the
 * four slots with the descriptor of each device - to `buildSessionCaptureSources`. The builder
 * TRUSTS NONE OF IT: it holds every rule again on what it was given (four slots, an opener behind
 * each, one source class, the class of the running operation), so a caller that skipped row 66's
 * check, or a registry that was talked into something, still gets a refusal and no row.
 * Beyond row 66:
 *   - `assertOperationRecordable`: `REAL_PRODUCTION` is refused outright while no production kind
 *     is opener-capable, so no all-`PRODUCTION` package can be produced in this phase;
 *   - `assertSessionSourcesOfOperation`: the re-read of MR-S6 (the fence is otherwise checked at
 *     boot only).
 *
 * Refusals are `CaptureAdapterError`s of the adapter layer: `SOURCE_KIND_NOT_RECORDABLE` (no
 * opener, a mixed selector, a shape that is not four slots) and `DEVELOPMENT_SOURCE_NOT_ALLOWED`
 * (a class that is not the running operation's). This unit imports nothing of a module: the
 * capture-config module imports the adapter layer, never the other way round.
 */
import { CaptureAdapterError, CaptureAdapterRefusal } from '../adapters/errors';
import { CaptureAdapterKind, CaptureOperation, CaptureSourceClass, sourceClassOf, sourceClassOfOperation, type CaptureDeviceClass } from '../adapters/kinds';
import { OPENER_CAPABLE_KINDS } from '../adapters/registry';
import type { CaptureDeviceDescriptor } from '../adapters/types';

/** The value set `CAPTURE_SOURCE_SLOT` (`session_capture_sources_slot_check`). */
export const CAPTURE_SOURCE_SLOTS = ['VIDEO-01', 'VIDEO-02', 'MIC-PRIMARY', 'MIC-STANDBY'] as const;
export type CaptureSourceSlot = (typeof CAPTURE_SOURCE_SLOTS)[number];

/** One row of `session_capture_sources`, plus the class derived from its kind (never stored). */
export interface SessionCaptureSource {
  readonly sessionId: string;
  readonly slot: CaptureSourceSlot;
  readonly deviceId: string;
  readonly adapterKind: CaptureAdapterKind;
  readonly recordedAt: number;
  readonly sourceClass: CaptureSourceClass;
}

/** One slot as `assertRecordableSelector` answers it (`RecordableSlot` of the plan builder, read structurally). */
export interface RecordedSlot {
  readonly slot: 'VIDEO-01' | 'VIDEO-02' | 'PRIMARY' | 'STANDBY';
  readonly descriptor: Pick<CaptureDeviceDescriptor, 'id' | 'deviceClass' | 'adapterKind' | 'hasOpener'>;
}

export interface SessionCaptureSourcesInput {
  readonly sessionId: string;
  /** The capture operation of the running Core: the result of the one function. */
  readonly operation: CaptureOperation;
  /** The four slots: `assertRecordableSelector(selector, registry).slots`. In `SIMULATED` only the device ids are read. */
  readonly slots: readonly RecordedSlot[];
  /** The server clock at the write. */
  readonly recordedAt: number;
}

const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;
const SLOT_OF = Object.freeze({ 'VIDEO-01': 'VIDEO-01', 'VIDEO-02': 'VIDEO-02', PRIMARY: 'MIC-PRIMARY', STANDBY: 'MIC-STANDBY' } as const);
/** `session_capture_sources_pairing_check`: the device class and the kinds a slot may carry. */
const RULE_OF_SLOT: Readonly<Record<CaptureSourceSlot, { readonly deviceClass: CaptureDeviceClass; readonly kinds: readonly CaptureAdapterKind[] }>> = Object.freeze({
  'VIDEO-01': { deviceClass: 'CAMERA', kinds: [CaptureAdapterKind.ONVIF_RTSP, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE] },
  'VIDEO-02': { deviceClass: 'CAMERA', kinds: [CaptureAdapterKind.ONVIF_RTSP, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE] },
  'MIC-PRIMARY': { deviceClass: 'MIC', kinds: [CaptureAdapterKind.USB_AUDIO, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE] },
  'MIC-STANDBY': { deviceClass: 'MIC', kinds: [CaptureAdapterKind.USB_AUDIO, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE] },
});

function notRecordable(deviceId: string | null = null): never {
  throw new CaptureAdapterError(CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE, deviceId);
}

/**
 * SEC35-40 (2), D86 C-5: whether the running operation can record at all in this phase. True for
 * `REAL_DEVELOPMENT`; `SIMULATED` records nothing real and is not asked. `REAL_PRODUCTION` is
 * refused while no production kind is opener-capable - read from the registry's own list, so
 * that the day a production opener lands this function follows without an edit.
 */
export function assertOperationRecordable(operation: CaptureOperation): void {
  const wanted = sourceClassOfOperation(operation);
  if (wanted === null) return;
  if (!OPENER_CAPABLE_KINDS.some((kind) => sourceClassOf(kind) === wanted)) notRecordable();
}

/**
 * The four rows of a session, in slot order. Throws `CaptureAdapterError`.
 *
 * MR-S3: in a real operation the kind is the kind of the adapter that serves the device; in
 * `SIMULATED` it is `FAKE` for all four whatever the registry holds (the simulator generates the
 * media, the stored kinds are inert).
 */
export function buildSessionCaptureSources(input: SessionCaptureSourcesInput): readonly SessionCaptureSource[] {
  if (!SESSION_ID.test(input.sessionId) || !Number.isSafeInteger(input.recordedAt) || input.recordedAt < 0) notRecordable();
  const simulated = input.operation === CaptureOperation.SIMULATED;
  if (!simulated) assertOperationRecordable(input.operation);
  const rows = input.slots.map(({ slot, descriptor }): SessionCaptureSource => {
    const name: CaptureSourceSlot | undefined = Object.hasOwn(SLOT_OF, slot) ? SLOT_OF[slot] : undefined;
    if (name === undefined) return notRecordable();
    const adapterKind = simulated ? CaptureAdapterKind.FAKE : descriptor.adapterKind;
    const rule = RULE_OF_SLOT[name];
    // No opener, no row: nothing is ever listened for on behalf of a kind the Core cannot open (SEC35-40 (1)).
    if (!simulated && (descriptor.hasOpener !== true || !OPENER_CAPABLE_KINDS.includes(adapterKind))) return notRecordable(descriptor.id);
    if (descriptor.deviceClass !== rule.deviceClass || !rule.kinds.includes(adapterKind)) return notRecordable(descriptor.id);
    return Object.freeze({ sessionId: input.sessionId, slot: name, deviceId: descriptor.id, adapterKind, recordedAt: input.recordedAt, sourceClass: sourceClassOf(adapterKind) });
  });
  const order = (slot: CaptureSourceSlot): number => CAPTURE_SOURCE_SLOTS.indexOf(slot);
  const sorted = rows.sort((left, right) => order(left.slot) - order(right.slot));
  assertSessionSourcesOfOperation(sorted, input.operation);
  return Object.freeze(sorted);
}

/**
 * MR-S6 (SEC35-40 (4)): the rows a session start wrote, read back, are exactly the four slots, of
 * ONE source class, and of the class the running operation records. Called by the session start
 * with what it re-read; also the builder's own last step.
 */
export function assertSessionSourcesOfOperation(rows: readonly Pick<SessionCaptureSource, 'slot' | 'deviceId' | 'adapterKind'>[], operation: CaptureOperation): void {
  if (rows.length !== CAPTURE_SOURCE_SLOTS.length || !CAPTURE_SOURCE_SLOTS.every((slot) => rows.filter((row) => row.slot === slot).length === 1)) notRecordable();
  // A mixed session is refused whatever the operation (D82): one session is never both.
  if (new Set(rows.map((row) => sourceClassOf(row.adapterKind))).size !== 1) notRecordable();
  // `SIMULATED` records the simulator's media only: all four rows are `FAKE` (MR-S3).
  const wanted = sourceClassOfOperation(operation) ?? CaptureSourceClass.DEVELOPMENT;
  const stray = rows.find((row) => sourceClassOf(row.adapterKind) !== wanted || (operation === CaptureOperation.SIMULATED && row.adapterKind !== CaptureAdapterKind.FAKE));
  if (stray !== undefined) throw new CaptureAdapterError(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED, stray.deviceId);
}

// ── What a client is told about a source (C3 §2.6 "Device shapes"; UX flow 12) ────────────────────

/** The two members a device shape gains (C3 §2.6), and whether the device is listed at all (rule RG-2). */
export interface DeviceSourceFields {
  readonly adapter: CaptureAdapterKind;
  readonly sourceClass: CaptureSourceClass;
  /** False for a development device in `REAL_PRODUCTION`: operations 76 / 77 list 0 of them. */
  readonly listed: boolean;
}

/**
 * THE mapping from a stored adapter kind to the members of a device shape. One function, so that
 * the day the shared slice gains `adapter` / `sourceClass` (the contract of operations 93 to 97,
 * row 132) one caller changes. In `SIMULATED` the stored kinds are inert: every device is listed,
 * as today.
 */
export function deviceSourceFieldsOf(operation: CaptureOperation, adapterKind: CaptureAdapterKind): DeviceSourceFields {
  const sourceClass = sourceClassOf(adapterKind);
  return Object.freeze({ adapter: adapterKind, sourceClass, listed: !(operation === CaptureOperation.REAL_PRODUCTION && sourceClass === CaptureSourceClass.DEVELOPMENT) });
}

/** What the development badge says under the device's name. The clients own the words (`ux` §8f). */
export const DevelopmentSourceLabel = { LOCAL_CAMERA: 'LOCAL_CAMERA', LOCAL_MICROPHONE: 'LOCAL_MICROPHONE', TEST_SOURCE: 'TEST_SOURCE' } as const;
export type DevelopmentSourceLabel = (typeof DevelopmentSourceLabel)[keyof typeof DevelopmentSourceLabel];

/**
 * The development-source label of a device, or null for "draw no badge". Ruling R-2 (D91): the
 * badge is drawn ONLY IN REAL CAPTURE - never while the Core runs `SIMULATED` (the mode banner
 * says it there) - and a production configuration shows none (it lists no development device).
 * So the answer is non-null in `REAL_DEVELOPMENT` alone, for a development source.
 */
export function developmentSourceLabelOf(operation: CaptureOperation, deviceClass: CaptureDeviceClass, adapterKind: CaptureAdapterKind): DevelopmentSourceLabel | null {
  if (operation !== CaptureOperation.REAL_DEVELOPMENT || sourceClassOf(adapterKind) !== CaptureSourceClass.DEVELOPMENT) return null;
  if (adapterKind !== CaptureAdapterKind.LOCAL_DEVICE) return DevelopmentSourceLabel.TEST_SOURCE;
  if (deviceClass === 'CAMERA') return DevelopmentSourceLabel.LOCAL_CAMERA;
  return deviceClass === 'MIC' ? DevelopmentSourceLabel.LOCAL_MICROPHONE : DevelopmentSourceLabel.TEST_SOURCE;
}
