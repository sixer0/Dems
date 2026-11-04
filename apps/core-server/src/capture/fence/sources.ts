/**
 * The eight `session_capture_sources` rows of a session (D61, 2026-11-04: four video tracks and
 * four numbered microphone channels; D60: six rows, two mic roles; was four rows), and what a
 * client is told about a source
 * (blueprint row 136; `dbc-4` §N.3 rules MR-S1, MR-S3, MR-S6; capture spec §A.1.1 rules RG-2,
 * RG-3; SEC35-40 (1), (2), (4); decisions D82, D86 C-5, D91 R-2; checks `M4-LOCAL-PLAN-1`,
 * `M4-DEVSRC-*` data half).
 *
 * PURE: no statement, no clock, no flag. The WRITE of the eight rows is the session start's (row
 * 71), in the transaction that persists `RECORDING`; this file builds what it writes and checks
 * what it reads back.
 *
 * NO LISTENER AND NO SESSION START FOR A SOURCE KIND WITHOUT AN OPENER (SEC35-40). The session
 * start calls `assertRecordableSelector` of the plan builder (row 66) and hands its result - the
 * eight slots (D61) with the descriptor of each device - to `buildSessionCaptureSources`. The
 * builder TRUSTS NONE OF IT: it holds every rule again on what it was given (eight slots, an
 * opener behind each, one source class, the class of the running operation), so a caller that
 * skipped row 66's check, or a registry that was talked into something, still gets a refusal and
 * no row. Beyond row 66:
 *   - `assertOperationRecordable`: `REAL_PRODUCTION` is refused outright while no production kind
 *     is opener-capable, so no all-`PRODUCTION` package can be produced in this phase;
 *   - `assertSessionSourcesOfOperation`: the re-read of MR-S6 (the fence is otherwise checked at
 *     boot only).
 *
 * Refusals are `CaptureAdapterError`s of the adapter layer: `SOURCE_KIND_NOT_RECORDABLE` (no
 * opener, a mixed selector, a shape that is not eight slots (D61)) and `DEVELOPMENT_SOURCE_NOT_ALLOWED`
 * (a class that is not the running operation's). This unit imports nothing of a module: the
 * capture-config module imports the adapter layer, never the other way round.
 */
import { CARD_ASSUMED_RATE_RANGE, CARD_LISTING_LIMITS, CardStringKind, cardListingText } from '../adapters/audio/card-listing';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../adapters/errors';
import { CaptureAdapterKind, CaptureOperation, CaptureSourceClass, sourceClassOf, sourceClassOfOperation, type CaptureDeviceClass } from '../adapters/kinds';
import { OPENER_CAPABLE_KINDS } from '../adapters/registry';
import type { CaptureDeviceDescriptor } from '../adapters/types';

/** The value set `CAPTURE_SOURCE_SLOT` (`session_capture_sources_slot_check`). D61 (2026-11-04): the two mic roles became four numbered channels, so the set carries eight slots (D60: six). */
export const CAPTURE_SOURCE_SLOTS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const;
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

/** One slot as `assertRecordableSelector` answers it (`RecordableSlot` of the plan builder, read structurally). D61 (2026-11-04): four video slots and the four numbered microphone channels (was the two mic roles). */
export interface RecordedSlot {
  readonly slot: 'VIDEO-01' | 'VIDEO-02' | 'VIDEO-03' | 'VIDEO-04' | 'MIC-01' | 'MIC-02' | 'MIC-03' | 'MIC-04'; // D61
  readonly descriptor: Pick<CaptureDeviceDescriptor, 'id' | 'deviceClass' | 'adapterKind' | 'hasOpener'>;
}

export interface SessionCaptureSourcesInput {
  readonly sessionId: string;
  /** The capture operation of the running Core: the result of the one function. */
  readonly operation: CaptureOperation;
  /** The eight slots (D61, 2026-11-04): `assertRecordableSelector(selector, registry).slots`. In `SIMULATED` only the device ids are read. */
  readonly slots: readonly RecordedSlot[];
  /** The server clock at the write. */
  readonly recordedAt: number;
}

const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;
// D61 (2026-11-04): the plan names the stored slots directly - all eight map to themselves (the two mic roles of the earlier eras became `MIC-01`/`MIC-02` in the 0040 data migration).
const SLOT_OF = Object.freeze({ 'VIDEO-01': 'VIDEO-01', 'VIDEO-02': 'VIDEO-02', 'VIDEO-03': 'VIDEO-03', 'VIDEO-04': 'VIDEO-04', 'MIC-01': 'MIC-01', 'MIC-02': 'MIC-02', 'MIC-03': 'MIC-03', 'MIC-04': 'MIC-04' } as const);
/** `session_capture_sources_pairing_check`: the device class and the kinds a slot may carry. D61 (2026-11-04): the four numbered channels pair like the two roles did. */
const RULE_OF_SLOT: Readonly<Record<CaptureSourceSlot, { readonly deviceClass: CaptureDeviceClass; readonly kinds: readonly CaptureAdapterKind[] }>> = Object.freeze({
  'VIDEO-01': { deviceClass: 'CAMERA', kinds: [CaptureAdapterKind.ONVIF_RTSP, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE] },
  'VIDEO-02': { deviceClass: 'CAMERA', kinds: [CaptureAdapterKind.ONVIF_RTSP, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE] },
  // D60 (2026-11-04): the third and fourth recorded track pair like the first two (`session_capture_sources_pairing_check` of migration 0039).
  'VIDEO-03': { deviceClass: 'CAMERA', kinds: [CaptureAdapterKind.ONVIF_RTSP, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE] },
  'VIDEO-04': { deviceClass: 'CAMERA', kinds: [CaptureAdapterKind.ONVIF_RTSP, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE] },
  // D61 (2026-11-04): the roles became four numbered channels; each takes a microphone kind (`session_capture_sources_pairing_check` of migration 0040).
  'MIC-01': { deviceClass: 'MIC', kinds: [CaptureAdapterKind.USB_AUDIO, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE] },
  'MIC-02': { deviceClass: 'MIC', kinds: [CaptureAdapterKind.USB_AUDIO, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE] },
  'MIC-03': { deviceClass: 'MIC', kinds: [CaptureAdapterKind.USB_AUDIO, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE] },
  'MIC-04': { deviceClass: 'MIC', kinds: [CaptureAdapterKind.USB_AUDIO, CaptureAdapterKind.FAKE, CaptureAdapterKind.LOCAL_DEVICE] },
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
 * The eight rows of a session (D61), in slot order. Throws `CaptureAdapterError`.
 *
 * MR-S3: in a real operation the kind is the kind of the adapter that serves the device; in
 * `SIMULATED` it is `FAKE` for all eight whatever the registry holds (the simulator generates the
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
 * MR-S6 (SEC35-40 (4)): the rows a session start wrote, read back, are exactly the eight slots
 * (D61, 2026-11-04; D60: six), of ONE source class, and of the class the running operation records.
 * Called by the session start with what it re-read; also the builder's own last step.
 */
export function assertSessionSourcesOfOperation(rows: readonly Pick<SessionCaptureSource, 'slot' | 'deviceId' | 'adapterKind'>[], operation: CaptureOperation): void {
  if (rows.length !== CAPTURE_SOURCE_SLOTS.length || !CAPTURE_SOURCE_SLOTS.every((slot) => rows.filter((row) => row.slot === slot).length === 1)) notRecordable();
  // A mixed session is refused whatever the operation (D82): one session is never both.
  if (new Set(rows.map((row) => sourceClassOf(row.adapterKind))).size !== 1) notRecordable();
  // `SIMULATED` records the simulator's media only: all six rows are `FAKE` (MR-S3).
  const wanted = sourceClassOfOperation(operation) ?? CaptureSourceClass.DEVELOPMENT;
  const stray = rows.find((row) => sourceClassOf(row.adapterKind) !== wanted || (operation === CaptureOperation.SIMULATED && row.adapterKind !== CaptureAdapterKind.FAKE));
  if (stray !== undefined) throw new CaptureAdapterError(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED, stray.deviceId);
}

// ── The source facts of a session start (task 4 row 71; schema design 2.3; AD-07 (1), S13-13) ────
// `session_capture_sources.source_facts`: a point-in-time copy of WHICH physical device fed a
// slot when the session started (input-av kept it per session as `audio_devices`). Written once,
// in the INSERT of the eight rows (D61; D60: six); the runtime role cannot update it (`0016`).
//
// NO FREE JSON (S13-13). The keys are the closed list below and nothing else is ever a key. Every
// TEXT value has passed `cardListingText` of the card listing (row 155) HERE, whatever the adapter
// did before: a text that fails is the rule's fixed word, or the key is left out where the rule
// has no word. A text is never cut to fit (a cut name is a name the device did not announce), so
// an over-long product name is stored as the fixed word. Every NUMBER is an integer inside the
// bound of its column of `capture_audio_inputs`, or the key is left out. The builder never throws:
// a session start is not refused for a fact.

/** The keys of a microphone slot's facts (schema design 2.3, plus the rate the card was registered at). CLOSED. */
// Task 4 row 85b (row 200's request; decision C56): `usbSerial` and `usbPort` - the serial and the port path of the card
// that was ACTUALLY opened, so that the stored row of a session says which of two same-model cards fed the slot.
export const MIC_SOURCE_FACT_KEYS = ['model', 'usbId', 'cardId', 'cardDevice', 'inputNumber', 'nativeChannels', 'sampleRate', 'sampleBits', 'usbSerial', 'usbPort'] as const;
export type MicSourceFactKey = (typeof MIC_SOURCE_FACT_KEYS)[number];

/** THE TYPE of `source_facts` as the Core writes it (asked for by row 17): a flat map of the closed keys; `{}` says "nothing stated". */
export type SessionSourceFacts = Readonly<Partial<Record<MicSourceFactKey, string | number>>>;
export const NO_SOURCE_FACTS: SessionSourceFacts = Object.freeze({});
/** The bound of the column (`session_capture_sources_source_facts_bound_check`): the whole map, in bytes. */
export const SOURCE_FACTS_MAX_BYTES = 2_048;

/**
 * What an audio adapter states of the card behind ONE registered input: the stored identity of
 * the card and the input, rate and format it is opened with. Every member is read as untrusted.
 */
export interface AudioCardStatement {
  /** The product name of the card: device text. */
  readonly product: unknown;
  /** Vendor and product id of a USB card; null for a card that is not USB. */
  readonly usbId: unknown;
  /** The card's short name, in the kernel's own form. */
  readonly cardId: unknown;
  readonly cardDevice: unknown;
  /** The selected input of the card, numbered from 1. */
  readonly inputNumber: unknown;
  readonly nativeChannels: unknown;
  readonly sampleRateHz: unknown;
  readonly sampleBits: unknown;
  /** The serial number of the card that was opened (row 200); null or absent: it stated none. */
  readonly usbSerial?: unknown;
  /** The USB port path of the card that was opened (row 200); null or absent: none. */
  readonly usbPort?: unknown;
}

/**
 * The member of an audio adapter the session start reads the statement through. OPTIONAL on an
 * adapter and found by its name, as `start` of a handle was before row 20 declared it: the fakes,
 * the generated and the local sources have none and their slots store `{}`. It answers from what
 * the adapter already holds - it opens no device, starts no process and reads no file, because it
 * is called inside the unit of work of the start. (Requested for `adapters/types.ts` by row 71.)
 */
export interface AudioCardFactsSource {
  sourceFacts(inputId: string): AudioCardStatement | null;
}

/** The statement of an adapter for one input, or null when the adapter has no such member or states nothing. Throws what the adapter throws. */
export function audioCardStatementOf(adapter: unknown, inputId: string): AudioCardStatement | null {
  if (typeof adapter !== 'object' || adapter === null) return null;
  const member = (adapter as Partial<AudioCardFactsSource>).sourceFacts;
  if (typeof member !== 'function') return null;
  const stated: unknown = member.call(adapter, inputId);
  return typeof stated === 'object' && stated !== null ? (stated as AudioCardStatement) : null;
}

const SAMPLE_BITS: readonly number[] = [16, 24, 32];
const integerOf = (value: unknown, min: number, max: number): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null);

/** The facts of a microphone slot from an adapter's statement. Pure; never throws; `{}` for no statement. */
export function micSourceFactsOf(statement: AudioCardStatement | null | undefined): SessionSourceFacts {
  if (typeof statement !== 'object' || statement === null) return NO_SOURCE_FACTS;
  const facts: Partial<Record<MicSourceFactKey, string | number>> = {};
  const put = (key: MicSourceFactKey, value: string | number | null): void => {
    if (value !== null) facts[key] = value;
  };
  // The three texts, each through the one function with the kind of its member.
  put('model', cardListingText(CardStringKind.NAME, statement.product));
  put('usbId', statement.usbId === null || statement.usbId === undefined ? null : cardListingText(CardStringKind.USB_ID, statement.usbId));
  put('cardId', cardListingText(CardStringKind.CARD_ID, statement.cardId));
  // The numbers, each inside the bound its column has in `capture_audio_inputs`.
  put('cardDevice', integerOf(statement.cardDevice, 0, CARD_LISTING_LIMITS.deviceIndexMax));
  put('inputNumber', integerOf(statement.inputNumber, 1, CARD_LISTING_LIMITS.channels));
  put('nativeChannels', integerOf(statement.nativeChannels, 1, CARD_LISTING_LIMITS.channels));
  put('sampleRate', integerOf(statement.sampleRateHz, CARD_ASSUMED_RATE_RANGE.minHz, CARD_ASSUMED_RATE_RANGE.maxHz));
  put('sampleBits', typeof statement.sampleBits === 'number' && SAMPLE_BITS.includes(statement.sampleBits) ? statement.sampleBits : null);
  // The identity of the card that was opened (row 200): each through the listing's rule for its kind; a text that fails has no word and the key is left out.
  put('usbSerial', statement.usbSerial === null || statement.usbSerial === undefined ? null : cardListingText(CardStringKind.USB_SERIAL, statement.usbSerial));
  put('usbPort', statement.usbPort === null || statement.usbPort === undefined ? null : cardListingText(CardStringKind.USB_PORT, statement.usbPort));
  // Unreachable with the bounds above (the largest map is under 200 bytes); held all the same, so the column's CHECK is never what refuses a start.
  if (Buffer.byteLength(JSON.stringify(facts), 'utf8') > SOURCE_FACTS_MAX_BYTES) return NO_SOURCE_FACTS;
  return Object.freeze(facts);
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

/**
 * THE device-list rule of a running Core, for the reader of the STORED registry (review row 69,
 * finding R69-03; decision D178): the one caller of `deviceSourceFieldsOf(...).listed`. A stored
 * camera or microphone of a development kind (`LOCAL_DEVICE`, `FAKE`) is in no device list of a
 * `REAL_PRODUCTION` Core - a database that once booted `REAL_DEVELOPMENT` keeps the rows of this
 * Mac's camera and microphone, and they must not be offered there. The row stays stored: a
 * development boot lists it again.
 *
 * Cameras and microphones only: the switch is no capture source, carries no class and no badge
 * (`sourceFactsOf` of the devices module classes the same two), so it is listed as stored. A kind
 * outside the closed set cannot be classed and is not listed in `REAL_PRODUCTION` (fail closed).
 * `SIMULATED`: every stored kind is inert and listed (D83 O-2) - the rule is `null`, nothing is
 * filtered.
 */
export function storedDeviceListingOf(operation: CaptureOperation): ((device: { readonly kind: string; readonly adapterKind: string }) => boolean) | null {
  if (operation === CaptureOperation.SIMULATED) return null;
  const kinds: readonly string[] = Object.values(CaptureAdapterKind);
  return (device) => {
    if (device.kind !== 'CAMERA' && device.kind !== 'MIC') return true;
    if (!kinds.includes(device.adapterKind)) return operation !== CaptureOperation.REAL_PRODUCTION;
    return deviceSourceFieldsOf(operation, device.adapterKind as CaptureAdapterKind).listed;
  };
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

// ── The open local sources: who is told, and the short pre-check open (row 140; SEC35-44 (4)) ─────
// Kept in this file, not in the registry's: the file that builds the test sources holds no error
// path at all (static rule G-R14: a local device is never replaced by a fake in one).

/** Calls every listener. One that throws is handed to `failed` and the others are still told: an open or a close of a source is never stopped by a listener. */
export function tellEach(listeners: Iterable<() => void>, failed: (err: unknown) => void): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      failed(err);
    }
  }
}

/**
 * Runs `work` with `deviceId` in the set of short opens, telling `changed` when it enters and when
 * it leaves - also when `work` rejects: a local device never stays "on" after its short open ended.
 */
export async function whileShortOpen<Value>(open: Set<string>, deviceId: string, changed: () => void, work: () => Promise<Value>): Promise<Value> {
  open.add(deviceId);
  changed();
  try {
    return await work();
  } finally {
    open.delete(deviceId);
    changed();
  }
}

