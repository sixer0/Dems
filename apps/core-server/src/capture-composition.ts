/**
 * THE COMPOSITION OF PRODUCTION CAPTURE (task 4 row 85b; decision C55; design addendum 6.4;
 * security addendum AD-02, AD-03; decisions C34, C56, C58).
 *
 * WHERE THIS FILE STANDS, AND WHY. The members of the production capture path live in units that
 * may not import each other: the credential holders in the module `capture-config`, the
 * stored-credential connection test in `capture-discovery`, the card listing's door in
 * `capture-inputs`, the session in `capture-session`, the destination rule and the adapters'
 * parts in the capture unit - and a unit below the modules imports no module (imports rule 5).
 * This file is in NONE of them: a file of no unit, beside `app.ts` and `config.ts`, ABOVE the
 * modules. It builds nothing of its own: it takes each member where its owner offers it and hands
 * it to its taker, once per app. Two list entries admit it (decision C55, SR-7): rule R-6 of the
 * capture-config module (the one importer of the credential wiring) and one path of `EXPOSED`.
 *
 * WHAT IT HANDS IN, IN `REAL_PRODUCTION` ONLY (any other capture operation: nothing is built, no
 * door is opened, no reader exists):
 *
 *   1. ONE binding of the destination rule for a STORED camera address, given unchanged to its four
 *      takers: the credential wiring, the stored-credential connection test, and - in the bundles
 *      below - the production camera adapter and the camera watch. The host's facts come from an
 *      INJECTED reader (`network`). SINCE R-FLEX (D10 ruling 2, RF-N1, RM-N4) the rule for a stored
 *      camera (and for a typed probe) is GLOBAL: an address is reached from whichever ELIGIBLE
 *      interface of the host holds its subnet (`interfaceSubnets`, NW-C1), the camera interface,
 *      the office network or Wi-Fi alike; off-link is `NO_SOURCE_INTERFACE`, two interfaces at one
 *      prefix `SOURCE_INTERFACE_AMBIGUOUS`. NO READER, OR AN UNREADABLE HOST (a reader that throws,
 *      answers nothing, or states no eligible interfaces): EVERY ADDRESS IS REFUSED (`NOT_CONFIGURED`).
 *      Fail-closed, by decision C55. "Not configured" no longer means refused for a stored camera:
 *      no stored camera interface, no camera subnet, no camera-interface address refuse nothing
 *      (the commissioning scan and set-IP stay bound to the camera interface).
 *      SINCE INTEGRATION PASS I-9a the entry point hands that reader in (`captureNetworkFacts(app)`),
 *      and the app-bound function below gives THE SAME reader to its two other takers: the
 *      confirmed re-address (operation 100) and, bound by the fence for the purpose of a typed
 *      probe, the typed address of operation 93. The reader is never called here.
 *   2. The two credential readers, taken ONCE from the closed wiring: the connection test's goes
 *      to `adoptedCameraTestControl(app).provide`, the camera adapter's into the camera bundle.
 *   3. The relay report source of the session (decision C34): a hub this file owns. The session
 *      subscribes to it; the production camera adapter's own source is attached to it at the lift.
 *      With nothing attached it reports nothing, so no camera is ever paired: fail-closed.
 *   4. The card enumerator of operations 98 and 99. Where the platform has a reader AND the text
 *      of the listing program is handed in, it is the product's enumerator; otherwise it is an
 *      enumerator that states a NAMED reason and lists nothing - never a made-up card. The module
 *      answers op 98 from it, each card with `boundTo` (the `MIC-nn` that holds it BY IDENTITY, or
 *      null; R-FLEX AU-L1), and refuses a new binding of a bound card in op 99; this file hands the
 *      enumerator over and judges nothing of the binding.
 *   5. The stored facts: the camera at its stored address with the stream token of a profile, and
 *      the stored row of a microphone INCLUDING its serial and its port path (row 200). SINCE R-FLEX
 *      (row 107, RQ-A1 d) there is NO PORT LOCK: a bound card is the same card on any USB port (USB
 *      id plus serial where one exists, else the one unit of its model); a port move keeps the
 *      binding, and the stored port is read only as the tie-break of two units with one serial. A
 *      row without the two columns reads as "no serial", not as refused.
 *
 * WHAT IT DOES NOT DO. It registers no adapter and names no built adapter file (static rule A-9):
 * the two bundles are stated here BY SHAPE. SINCE THE LIFT (task 4 row 88, AM-1) it hands them,
 * with the watch bundles, the hub and the two attach doors, to the fence (member 11 below); the
 * fence's boot step builds the registry from them, so the production kinds record there.
 *
 * THE REMAINDER (task 4 row 85c; decision C60 (2), (3)):
 *
 *   6. THE RUNNER OF THE CARD LISTING PROGRAM. On the platform whose sound directory is read, the
 *      enumerator of member 4 now has the product's runner behind it (the fixed row of the helper
 *      table through the production door): operations 98 and 99 no longer answer
 *      `LISTING_PROGRAM_NOT_HANDED_IN` there. On every other platform the named "not available"
 *      answer stays, and the program is never started. SINCE ROW N7: on `darwin` the enumerator is
 *      the listing of a macOS host (three fixed rows through the production door; the third is
 *      started by the configured audio helper of member 7 - without one, the named answer
 *      `LISTING_PROGRAM_NOT_HANDED_IN` and nothing is started). The platform alone chooses.
 *   7. THE AUDIO HELPER PROGRAM of the configuration (`DEMS_CAPTURE_AUDIO_HELPER`) in the audio
 *      bundle. The configuration writer and the run directory stay the capture unit's own.
 *   8. THE FAULT SINK of the two watches (decision C60 (2)): ONE sink, built by the fence on the
 *      engine's two internal actions and its fault list. A watch raises its fault and clears ONLY
 *      the fault it raised itself; a fault another part raised is neither owned nor cleared.
 *   9. `superseded` for the microphone loss watch: true while the session is replacing its worker,
 *      so that the end of a helper of the earlier attempt raises nothing (row 191).
 *
 * It logs codes and device ids only: never an address, a path or a credential.
 */
import { isSessionActive } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { CapturePhase, INTERFACE_FILE_COMMAND, createSystemTimers, type CaptureTimers, type HostCommandRunner } from './capture';
import {
  aliasCandidatesOfConfiguration,
  cameraNetworkCameraOf,
  captureFenceControl,
  cardEnumeratorOf,
  createHostAliasLifecycle,
  factoryScanProbeOf,
  factoryScanRuleOf,
  hostAliasInterfaceFileSourceOf,
  hostAliasJobPortOf,
  hostCardEnumeratorOf,
  hostCommissioningInputsOf,
  isProductionCaptureOperation,
  productionCameraCandidateOf,
  productionCameraDoors,
  storedCameraAddressRuleOf,
  typedProbeRuleOf,
  watchFaultSinkOf,
  type CameraCandidate,
  type CaptureFenceControl,
  type CaptureNetworkFactsReader,
  type CardEnumerator,
  type CardListingPrograms,
  type CardListingUnavailable,
  type CommissioningHostInputs,
  type HostAliasHost,
  type HostAliasJobPort,
  type HostAliasLifecycle,
  type HostAliasTransport,
  type OnvifStreamLocator,
  type ProductionCaptureParts,
  type ProductionDoor,
  type StoredCameraAddressRule,
  type WatchFaultEngine,
  type WatchFaultSink,
} from './capture/fence';
import { sessionCapture, type RelayIngestReport, type RelayIngestReports } from './capture-session';
import { coreCredentialStore } from './credential-store';
import { hostAliasSocketTransportOf } from './host-alias-socket';
import { captureCameraNetworkControl, captureFactoryScanControl, captureHostAliasControl, captureNetworkConfigControl } from './modules/capture-config';
import { wireCaptureCredentialHolders, type CaptureCredentialHolders, type CaptureCredentialHoldersDependencies } from './modules/capture-config/credential-holders';
import { adoptedCameraTestControl, captureConnectControl, captureReaddressControl, typedAddressControl } from './modules/capture-discovery';
import { captureAudioCardsControl } from './modules/capture-inputs';

// ── Codes ──────────────────────────────────────────────────────────────────────────────────────

export const CaptureCompositionCode = {
  /** The composition was asked for twice on one app. */
  COMPOSED_TWICE: 'CAPTURE_COMPOSITION_TWICE',
  /** A late member (a watch, the adapter's report source) was attached twice. */
  ATTACHED_TWICE: 'CAPTURE_COMPOSITION_ATTACHED_TWICE',
  /** The Core credential store is not ready: no credential is opened. */
  CREDENTIAL_STORE_NOT_READY: 'CAPTURE_COMPOSITION_CREDENTIAL_STORE_NOT_READY',
  /** The clock of a camera was asked, or a camera loss arrived (row B2: it is KEPT for the watch), before the camera watch was attached. */
  CAMERA_WATCH_NOT_ATTACHED: 'CAPTURE_COMPOSITION_CAMERA_WATCH_NOT_ATTACHED',
  /** Row B2 (review follow-up S-02): a microphone loss arrived before the microphone loss watch was attached. It is KEPT for the watch. */
  MIC_LOSS_WATCH_NOT_ATTACHED: 'CAPTURE_COMPOSITION_MIC_LOSS_WATCH_NOT_ATTACHED',
  /** Row B2 (S-02): a loss that arrived before its watch did NOT reach it (`reason`: more than the composition keeps, or the watch threw at the hand-over). */
  EARLY_LOSS_NOT_DELIVERED: 'CAPTURE_COMPOSITION_EARLY_LOSS_NOT_DELIVERED',
  /** The reader of the host's network facts threw: the address is refused. */
  NETWORK_FACTS_UNREADABLE: 'CAPTURE_COMPOSITION_NETWORK_FACTS_UNREADABLE',
  /** The card listing cannot be read on this host. */
  CARD_LISTING_NOT_AVAILABLE: 'AUDIO_CARD_LISTING_NOT_AVAILABLE',
  /** A listener of the relay report hub threw. */
  RELAY_REPORT_LISTENER_FAILED: 'CAPTURE_COMPOSITION_RELAY_REPORT_LISTENER_FAILED',
  /** A note of the camera adapter (its own code is in the context). */
  CAMERA_RELAY_NOTE: 'CAPTURE_COMPOSITION_CAMERA_RELAY_NOTE',
  /** What the fault sink of the watches did NOT write (its own code is in the context): a fault another part holds, a clear of a fault not its own. */
  WATCH_FAULT_NOTE: 'CAPTURE_COMPOSITION_WATCH_FAULT_NOTE',
  /** Decision C154: a report of the microphone loss watch (its own `MIC_LOSS_*` code and a closed detail word are in the context). */
  MIC_LOSS_WATCH_REPORT: 'CAPTURE_COMPOSITION_MIC_LOSS_WATCH_REPORT',
} as const;
export type CaptureCompositionCode = (typeof CaptureCompositionCode)[keyof typeof CaptureCompositionCode];

/** A code and a fixed sentence; never a cause, an address or a path. */
export class CaptureCompositionError extends Error {
  readonly code: CaptureCompositionCode;
  readonly reason: string | null;
  constructor(code: CaptureCompositionCode, reason: string | null = null) {
    super('the composition of production capture refused a step');
    this.name = 'CaptureCompositionError';
    this.code = code;
    this.reason = reason;
  }
}

/** The capture operation of an app, as the fence states it. */
type CaptureOperation = CaptureFenceControl['operation'];

// ── 1. The destination rule on a stored camera address: `storedCameraAddressRuleOf` of the fence ──
// (the rule's file lies inside the capture unit; this file hands the injected reader to that binding and
// gives the ONE function it gets back to the four takers).

// ── 3. The relay report hub (decision C34) ─────────────────────────────────────────────────────

/** The report source the session is given: it reports what the attached source reports, and nothing before one is attached. */
export interface RelayReportHub extends RelayIngestReports {
  /** Attaches the production camera adapter's own report source. Once. Returns the function that ends it. */
  attach(source: RelayIngestReports): () => void;
  /** True when a source is attached: before that no camera of a session can be paired. */
  attached(): boolean;
}

export function createRelayReportHub(failed: (error: unknown) => void): RelayReportHub {
  const listeners = new Set<(report: RelayIngestReport) => void>();
  let source: RelayIngestReports | null = null;
  return Object.freeze({
    subscribe(listener: (report: RelayIngestReport) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    attach(next: RelayIngestReports): () => void {
      if (source !== null) throw new CaptureCompositionError(CaptureCompositionCode.ATTACHED_TWICE, 'RELAY_REPORTS');
      source = next;
      return next.subscribe((report) => {
        // One listener that throws does not keep the report from the others (the session and the camera watch both listen).
        for (const listener of listeners) {
          try {
            listener(report);
          } catch (error) {
            failed(error);
          }
        }
      });
    },
    attached: () => source !== null,
  });
}

// ── 4. The card enumerator: `cardEnumeratorOf` of the fence (the reader's files lie inside the capture unit). ──

// ── 5. The stored facts ────────────────────────────────────────────────────────────────────────

/** A registered camera as stored: its adapter kind, its address (`host` or `host:port`) and its endpoint reference. One row or none. */
export const READ_STORED_CAMERA = `SELECT adapter_kind AS "adapterKind", address, onvif_uuid AS "endpointRef" FROM public.capture_devices WHERE id = $1 AND kind = 'CAMERA'`;
/** The ONVIF token stored for one profile code of one camera. One row or none: the pair is the primary key. */
export const READ_STORED_STREAM_TOKEN = 'SELECT onvif_profile_token AS "onvifProfileToken" FROM public.capture_device_streams WHERE device_id = $1 AND profile = $2';
/**
 * The stored row of a microphone, WITH the serial and the port path it was registered on (row 200,
 * decision C56). Since R-FLEX (row 107) the port is no lock: the matcher reads it only as the
 * tie-break of two units with one serial, and a row without the serial matches by model.
 */
export const READ_STORED_MICROPHONE =
  'SELECT device_id AS "deviceId", usb_id AS "usbId", card_id AS "cardId", card_device AS "cardDevice", input_number AS "inputNumber", native_channels AS "nativeChannels", usb_serial AS "usbSerial", usb_port AS "usbPort" ' +
  'FROM public.capture_audio_inputs WHERE device_id = $1';

/** The stored stream of a camera profile, as the production camera adapter takes it (`StoredCameraStream`, by shape). */
export interface StoredProductionStream {
  readonly candidate: CameraCandidate;
  readonly onvifProfileToken: string;
}

/** The stored row of a microphone, as the production microphone adapter takes it (`RegisteredAudioInput`, by shape). */
export interface StoredProductionMicrophone {
  readonly deviceId: string;
  readonly usbId: string | null;
  readonly cardId: string;
  readonly cardDevice: number;
  readonly inputNumber: number;
  readonly nativeChannels: number;
  readonly usbSerial: string | null;
  readonly usbPort: string | null;
}

type Query = CaptureCredentialHoldersDependencies['query'];
const rowOf = (rows: readonly unknown[]): Record<string, unknown> | null => (rows.length === 1 && typeof rows[0] === 'object' && rows[0] !== null ? (rows[0] as Record<string, unknown>) : null);
const textOrNull = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

export interface StoredProductionFacts {
  /** The camera at its STORED address, in the form the ONVIF session takes; null for no camera, another adapter kind, or an address not of the stored form. It decides nothing: the judgement stands in front of every use. */
  candidate(deviceId: string): Promise<CameraCandidate | null>;
  /** The candidate with the stored token of one profile code; null when either is missing. No profile is ever assumed (decision C36). */
  stream(deviceId: string, profile: string): Promise<StoredProductionStream | null>;
  /** The stored row of a microphone; null when it has none or a column is not of its type. */
  microphone(deviceId: string): Promise<StoredProductionMicrophone | null>;
}

export function storedProductionFactsOf(query: Query): StoredProductionFacts {
  const candidate = async (deviceId: string): Promise<CameraCandidate | null> => {
    const row = rowOf((await query(READ_STORED_CAMERA, [deviceId])).rows);
    if (row === null) return null;
    return productionCameraCandidateOf({ adapterKind: row['adapterKind'], address: textOrNull(row['address']), endpointRef: textOrNull(row['endpointRef']) });
  };
  return Object.freeze({
    candidate,
    async stream(deviceId: string, profile: string): Promise<StoredProductionStream | null> {
      const camera = await candidate(deviceId);
      if (camera === null) return null;
      const token = textOrNull(rowOf((await query(READ_STORED_STREAM_TOKEN, [deviceId, profile])).rows)?.['onvifProfileToken']);
      return token === null ? null : Object.freeze({ candidate: camera, onvifProfileToken: token });
    },
    async microphone(deviceId: string): Promise<StoredProductionMicrophone | null> {
      const row = rowOf((await query(READ_STORED_MICROPHONE, [deviceId])).rows);
      if (row === null) return null;
      const { deviceId: id, cardId, cardDevice, inputNumber, nativeChannels } = row;
      if (typeof id !== 'string' || typeof cardId !== 'string' || typeof cardDevice !== 'number' || typeof inputNumber !== 'number' || typeof nativeChannels !== 'number') return null;
      return Object.freeze({ deviceId: id, usbId: textOrNull(row['usbId']), cardId, cardDevice, inputNumber, nativeChannels, usbSerial: textOrNull(row['usbSerial']), usbPort: textOrNull(row['usbPort']) });
    },
  });
}

// ── The bundles, by shape (static rule A-9: no built adapter file is named before the lift) ─────

/** Row B2 (S-02): how many losses per watch the composition keeps before the attach. Beyond it a loss is reported as not delivered, never dropped unsaid. */
export const EARLY_LOSSES_KEPT = 64;
const EARLY_LOSS_ID = /^[A-Z][A-Z0-9]{0,15}-[0-9]{1,6}$/;

/** What the camera watch gives the composition when it is attached (the watch's `relayEnded`, `clockOffsetMs` and - finding E-03 - `captureEnded`). */
export interface AttachedCameraWatch {
  relayEnded(end: unknown): void;
  clockOffsetMs(deviceId: string): Promise<number>;
  /** Called by the composition at every end of a capture (finding E-03). */
  captureEnded(): void;
}

/** What the microphone loss watch gives the composition when it is attached (the watch's `sourceLost`). */
export interface AttachedMicLossWatch {
  sourceLost(deviceId: string, error: unknown): void;
}

/** A note of the camera adapter, as far as it is logged: its code and its three identifiers. */
interface CameraRelayNoteShape {
  readonly code: string;
  readonly sessionId: string;
  readonly deviceId: string;
  readonly attempt: number;
}

/** What `createOnvifRelayCameraAdapter(devices, <this>)` takes: every member of its dependencies. */
export interface ProductionCameraBundle {
  readonly door: ProductionDoor;
  readonly relayProgram: string | null;
  readonly timers: CaptureTimers;
  readonly credentials: CaptureCredentialHolders['cameraAdapter'];
  readonly locator: OnvifStreamLocator;
  readonly stream: (deviceId: string, profile: string) => Promise<StoredProductionStream | null>;
  readonly storedAddress: StoredCameraAddressRule;
  readonly relayEnded: (end: unknown) => void;
  readonly tell: (note: CameraRelayNoteShape) => void;
  readonly clock: (deviceId: string) => Promise<number>;
}

/**
 * What `createUsbAudioProductionAdapter({ devices, ...<this>, configWriter, runDir })` takes of this
 * file. The two members named in that call are NOT here: the configuration writer and the run
 * directory are the capture unit's own, and the row that lifts class C adds them where it builds
 * the adapter. `helperProgram` (row 85c) and `guardProgram` are the configuration's keys and may be
 * null: the adapter takes a path, so the lift REFUSES a null of either before it builds one.
 */
export interface ProductionAudioBundle {
  readonly registered: (deviceId: string) => Promise<StoredProductionMicrophone | null>;
  readonly cards: CardEnumerator;
  readonly helperProgram: string | null;
  readonly guardProgram: string | null;
  readonly timers: CaptureTimers;
  readonly onSourceLost: (deviceId: string, error: unknown) => void;
}

/** What `createCameraWatch({ ...<this>, reader })` takes of this file: everything but the time reader. */
export interface CameraWatchBundle {
  readonly timers: CaptureTimers;
  readonly now: () => number;
  readonly candidate: (deviceId: string) => Promise<CameraCandidate | null>;
  readonly storedAddress: StoredCameraAddressRule;
  /** THE fault sink (decision C60 (2)): the same object the microphone loss watch is given. */
  readonly faults: WatchFaultSink;
}

/** What `createMicLossWatch({ ...<this>, devices, identify, isRow, held })` takes of this file. */
export interface MicLossWatchBundle {
  readonly registered: (deviceId: string) => Promise<StoredProductionMicrophone | null>;
  readonly cards: CardEnumerator;
  readonly timers: CaptureTimers;
  /** THE fault sink (decision C60 (2)): the same object the camera watch is given. */
  readonly faults: WatchFaultSink;
  /** True while the session is replacing its worker: a word about a handle of the superseded attempt raises nothing (row 191). */
  readonly superseded: (deviceId: string) => boolean;
  /** Decision C154: where the watch tells what went wrong (its `MIC_LOSS_*` code, the device or null, a closed detail word; never a message). */
  readonly report: (entry: { readonly code: string; readonly deviceId: string | null; readonly detail: string }) => void;
}

// ── The composition ────────────────────────────────────────────────────────────────────────────

/** What the entry point states of its own process, and what a later row injects. */
export interface ProductionCaptureInput {
  /** The platform of this process (`process.platform`): this file reads no process fact itself. */
  readonly platform: string;
  /**
   * The reader of the host's network facts for the destination rule: the stored network
   * configuration (camera interface, camera subnet) with the host's interface list. NOT BUILT
   * (row 108): left out, every stored camera address is refused.
   */
  readonly network?: CaptureNetworkFactsReader;
  /**
   * The texts of the listing program, IN THE PLACE OF the product's runner (row 85c). The entry point
   * hands in nothing: the runner is the fence's, over the production door, with the fixed row of the
   * helper table. A test hands in a runner over a stand-in program that prints listing fixtures.
   */
  readonly cardPrograms?: CardListingPrograms;
  /**
   * The transport of the address helper, IN THE PLACE OF the platform's (task 4 row 106b). The entry
   * point hands in nothing: the transport is the platform seam of `src/host-alias-socket.ts` on the
   * configured socket. A test hands in a double that answers from a script - the real client refuses
   * any socket root did not make, so no test can stand one up.
   */
  readonly aliasTransport?: HostAliasTransport;
  /**
   * The ONE name the helper's interface file holds, asked at every `add` (review finding F-07), IN
   * THE PLACE OF the product's source. The entry point hands in nothing here: the product's source
   * is `hostRunner` below with the fixed row (row 106c). Unreadable: every `add` is refused
   * `INTERFACE_FILE_UNREADABLE` before the helper is asked - fail closed. A removal never asks it.
   */
  readonly aliasInterfaceFile?: () => Promise<unknown> | unknown;
  /**
   * THE RUNNER OF THE HOST'S QUESTIONS (task 4 row 106c; decision C82, named amendment SR-11), handed in
   * by the entry point: of the same make as the one of its host facts. ONE USE in this file: the fixed
   * question of the address helper's interface file (`hostAliasInterfaceFileOf` below). It is asked on
   * `linux` only; left out, or on another platform, nothing is run and the file is "unreadable".
   */
  readonly hostRunner?: HostCommandRunner;
  /**
   * The host's own observations of the commissioning functions (task 4 row 111b), IN THE PLACE OF the
   * product's: the neighbour table and "does anything answer". The entry point hands in nothing: the
   * product's are the fence's (`hostCommissioningInputsOf`), over the production door with the two
   * fixed rows of the helper table, on `linux` only. A test hands in the same function over stand-in
   * programs.
   */
  readonly commissioningInputs?: CommissioningHostInputs;
}

/** The doors and facts of ONE app, as this file uses them. The app-bound function below makes them; a test hands in doubles. */
export interface ProductionCapturePorts extends Pick<CaptureCredentialHoldersDependencies, 'unit' | 'open' | 'errorLog' | 'query'> {
  /** The capture operation of the app (the fence's one decision). */
  readonly operation: CaptureOperation;
  readonly timers: CaptureTimers;
  /** The server clock, in milliseconds. */
  readonly now: () => number;
  /** `config.captureRelayPath` and `config.captureGuardPath`. */
  readonly relayProgram: string | null;
  readonly guardProgram: string | null;
  /** `config.captureAudioHelperPath` (row 85c). */
  readonly audioHelperProgram: string | null;
  /** The engine as the fault sink of the watches needs it, asked at every raise and clear; null while no engine runs (row 85c). */
  faultEngine(): WatchFaultEngine | null;
  /** True while the capture supervisor is replacing the worker of the open session (row 85c; row 191). */
  workerSuperseded(): boolean;
  /** `adoptedCameraTestControl(app).provide`. */
  provideConnectionTest(parts: { readonly reader: CaptureCredentialHolders['connectionTest']; readonly storedAddress: StoredCameraAddressRule }): void;
  /** `captureAudioCardsControl(app).provideEnumerator`. */
  provideEnumerator(enumerator: CardEnumerator): void;
  /** `sessionCapture(app).replace({ relayReports })`. */
  provideRelayReports(reports: RelayIngestReports): void;
  /** `captureFenceControl(app).provideProductionParts` (task 4 row 88, the lift). */
  provideProductionParts(parts: ProductionCaptureParts): void;
  /** Calls `listener` at every end of a capture: the session's events `STOPPED`, `INTERRUPTED`, `FAILED_START` (finding E-03). */
  onCaptureEnd(listener: () => void): () => void;
  /** One line of the log and of the persistent error log: a code and identifiers. */
  report(level: 'warn' | 'error', code: CaptureCompositionCode, context: Readonly<Record<string, string | number | null>>): void;
}

export interface ComposedProductionCapture {
  readonly composed: true;
  /** THE binding: the same function in the wiring, the connection test and the two bundles that carry it. */
  readonly storedAddress: StoredCameraAddressRule;
  /** True when a reader of the network facts was handed in. False: every stored camera address is refused. */
  readonly networkFactsInjected: boolean;
  readonly relayReports: RelayReportHub;
  /** The enumerator handed to operations 98 and 99, and why it is not the product's reader (null: it is). */
  readonly cards: CardEnumerator;
  readonly cardListingUnavailable: CardListingUnavailable | null;
  readonly stored: StoredProductionFacts;
  /** The two bundles of the loader (`ProductionAdapterDependencies`): `camera` complete, `audio` as far as this file reaches. */
  readonly dependencies: { readonly camera: ProductionCameraBundle; readonly audio: ProductionAudioBundle };
  readonly watches: { readonly camera: CameraWatchBundle; readonly microphone: MicLossWatchBundle };
  /** THE fault sink of both watches (decision C60 (2)): what it owns is what a watch raised and has not ended. */
  readonly faults: WatchFaultSink;
  /** The camera watch, once it is built: the adapter's loss callback and clock read then reach it. Once. */
  attachCameraWatch(watch: AttachedCameraWatch): void;
  /** The microphone loss watch, once it is built. Once. */
  attachMicLossWatch(watch: AttachedMicLossWatch): void;
}

export type ProductionCaptureComposition = ComposedProductionCapture | { readonly composed: false; readonly operation: CaptureOperation };

/**
 * Composes production capture on the ports of one app. Anything but `REAL_PRODUCTION`: nothing is
 * built and no door is opened (no reader of a credential exists in a development or simulated
 * Core). A door that refuses (provided twice, another operation) throws to the caller: a
 * composition that could not finish is no composition.
 */
export function composeProductionCapture(ports: ProductionCapturePorts, input: ProductionCaptureInput): ProductionCaptureComposition {
  if (!isProductionCaptureOperation(ports.operation)) return Object.freeze({ composed: false, operation: ports.operation });

  // 1. The one binding.
  const storedAddress: StoredCameraAddressRule = storedCameraAddressRuleOf(input.network, () => ports.report('error', CaptureCompositionCode.NETWORK_FACTS_UNREADABLE, {}));

  // 2. The two readers, taken once; each goes to its holder as a parameter.
  const { unit, open, errorLog, query } = ports;
  const holders = wireCaptureCredentialHolders({ unit, open, errorLog, query, storedAddress });
  ports.provideConnectionTest({ reader: holders.connectionTest, storedAddress });

  // 3. The report source of the session.
  const relayReports = createRelayReportHub(() => ports.report('error', CaptureCompositionCode.RELAY_REPORT_LISTENER_FAILED, {}));
  ports.provideRelayReports(relayReports);

  const { timers } = ports;
  const { door, locator } = productionCameraDoors(timers);

  // 4 and 6. The card enumerator, with the runner of the listing program behind it: the fence's own over the production
  // door, unless a runner was handed in. On a platform without a listing nothing is ever started. Row N7: on `darwin` the
  // fence's seam answers the listing of a macOS host, whose third row is started by the configured audio helper.
  const { enumerator: cards, unavailable } = input.cardPrograms === undefined ? hostCardEnumeratorOf({ platform: input.platform, door, timers, helperProgram: ports.audioHelperProgram }) : cardEnumeratorOf(input.platform, input.cardPrograms);
  ports.provideEnumerator(cards);
  if (unavailable !== null) ports.report('warn', CaptureCompositionCode.CARD_LISTING_NOT_AVAILABLE, { reason: unavailable });

  // 5. The stored facts.
  const stored = storedProductionFactsOf(query);

  // The watches are built at the lift; until one is attached a clock read is refused by name and a LOSS IS KEPT, never
  // dropped (row B2; review follow-up S-02): it is reported by code when it arrives and handed to the watch, in the order
  // of arrival, in the turn the watch is attached. Nothing is invented: only what an adapter said is handed over, once.
  let cameraWatch: AttachedCameraWatch | null = null;
  let micLossWatch: AttachedMicLossWatch | null = null;
  const earlyCameraLosses: unknown[] = [];
  const earlyMicLosses: { readonly deviceId: string; readonly error: unknown; readonly superseded: () => boolean }[] = [];
  /** While a kept microphone loss is handed over: the answer `superseded` had IN THE TURN THE ADAPTER SPOKE (row 191: the answer is about that moment). */
  let supersededThen: (() => boolean) | null = null;
  /** A device id for a log line: only a text of the id form, else null (an adapter's `end` is not typed here). */
  const loggedId = (value: unknown): string | null => (typeof value === 'string' && EARLY_LOSS_ID.test(value) ? value : null);
  const keepEarlyLoss = <Loss>(kept: Loss[], loss: Loss, code: CaptureCompositionCode, deviceId: string | null): void => {
    if (kept.length >= EARLY_LOSSES_KEPT) {
      ports.report('error', CaptureCompositionCode.EARLY_LOSS_NOT_DELIVERED, { reason: 'MORE_THAN_KEPT', watch: code, deviceId });
      return;
    }
    kept.push(loss);
    ports.report('error', code, { deviceId, kept: kept.length });
  };
  const handOverEarlyLosses = <Loss>(kept: Loss[], code: CaptureCompositionCode, give: (loss: Loss) => void): void => {
    for (const loss of kept.splice(0)) {
      try {
        give(loss);
      } catch {
        ports.report('error', CaptureCompositionCode.EARLY_LOSS_NOT_DELIVERED, { reason: 'WATCH_THREW', watch: code, deviceId: null });
      }
    }
  };

  // 8. The fault sink of the two watches (decision C60 (2)): one object, asked the engine at every step.
  const faults = watchFaultSinkOf(
    () => ports.faultEngine(),
    (note, fault) => ports.report('warn', CaptureCompositionCode.WATCH_FAULT_NOTE, { note, deviceId: fault.subject, reason: fault.reason }),
  );
  // 9. Asked in the turn the adapter speaks; the port's own failure is the watch's to report (it then counts the word).
  // Row B2: for a loss kept before the attach it answers what the port answered (or threw) when the adapter spoke, not what it says at the hand-over.
  const superseded = (): boolean => (supersededThen !== null ? supersededThen() : ports.workerSuperseded());
  const supersededNow = (): (() => boolean) => {
    try {
      const answer = ports.workerSuperseded();
      return () => answer;
    } catch (error) {
      return () => {
        throw error;
      };
    }
  };

  const camera: ProductionCameraBundle = Object.freeze({
    door,
    relayProgram: ports.relayProgram,
    timers,
    credentials: holders.cameraAdapter,
    locator,
    stream: stored.stream,
    storedAddress,
    relayEnded: (end: unknown): void =>
      cameraWatch !== null
        ? cameraWatch.relayEnded(end)
        : keepEarlyLoss(earlyCameraLosses, end, CaptureCompositionCode.CAMERA_WATCH_NOT_ATTACHED, loggedId((end as { readonly deviceId?: unknown } | null)?.deviceId)),
    tell: (note: CameraRelayNoteShape): void => ports.report('warn', CaptureCompositionCode.CAMERA_RELAY_NOTE, { note: note.code, sessionId: note.sessionId, deviceId: note.deviceId, attempt: note.attempt }),
    clock: (deviceId: string): Promise<number> => (cameraWatch === null ? Promise.reject(new CaptureCompositionError(CaptureCompositionCode.CAMERA_WATCH_NOT_ATTACHED)) : cameraWatch.clockOffsetMs(deviceId)),
  });
  const audio: ProductionAudioBundle = Object.freeze({
    registered: stored.microphone,
    cards,
    helperProgram: ports.audioHelperProgram,
    guardProgram: ports.guardProgram,
    timers,
    onSourceLost: (deviceId: string, error: unknown): void =>
      micLossWatch !== null
        ? micLossWatch.sourceLost(deviceId, error)
        : keepEarlyLoss(earlyMicLosses, { deviceId, error, superseded: supersededNow() }, CaptureCompositionCode.MIC_LOSS_WATCH_NOT_ATTACHED, loggedId(deviceId)),
  });

  const watches = Object.freeze({
    camera: Object.freeze({ timers, now: ports.now, candidate: stored.candidate, storedAddress, faults }),
    // Decision C154 (request line 584): the loss watch's reports (`MIC_LOSS_LISTING_FAILED`, `..._CARD_UNDECIDED`, `..._ROW_UNREADABLE`,
    // `..._SINK_FAILED`, ...) reach the log as a warning: its own code, the device id and the closed detail word, as the camera's notes do.
    microphone: Object.freeze({
      registered: stored.microphone,
      cards,
      timers,
      faults,
      superseded,
      report: (entry: { readonly code: string; readonly deviceId: string | null; readonly detail: string }): void => ports.report('warn', CaptureCompositionCode.MIC_LOSS_WATCH_REPORT, { note: entry.code, deviceId: entry.deviceId, detail: entry.detail }),
    }),
  });
  const attachCameraWatch = (watch: AttachedCameraWatch): void => {
    if (cameraWatch !== null) throw new CaptureCompositionError(CaptureCompositionCode.ATTACHED_TWICE, 'CAMERA_WATCH');
    cameraWatch = watch;
    // Row B2 (S-02): what arrived before the attach, in its order, once. A loss of a superseded relay is the watch's and the adapter's to judge, as it is after the attach.
    handOverEarlyLosses(earlyCameraLosses, CaptureCompositionCode.CAMERA_WATCH_NOT_ATTACHED, (end) => watch.relayEnded(end));
  };
  const attachMicLossWatch = (watch: AttachedMicLossWatch): void => {
    if (micLossWatch !== null) throw new CaptureCompositionError(CaptureCompositionCode.ATTACHED_TWICE, 'MIC_LOSS_WATCH');
    micLossWatch = watch;
    // Row B2 (S-02): each kept loss with the `superseded` answer of ITS moment - a word of a superseded attempt is still dropped by the watch (rows 191, 85c).
    handOverEarlyLosses(earlyMicLosses, CaptureCompositionCode.MIC_LOSS_WATCH_NOT_ATTACHED, (loss) => {
      supersededThen = loss.superseded;
      try {
        watch.sourceLost(loss.deviceId, loss.error);
      } finally {
        supersededThen = null;
      }
    });
  };

  // 11. THE LIFT (task 4 row 88; decision AM-1): the parts of the production registry go to the fence through its door,
  // once; the fence's boot step builds the registry, the camera watch (attached here BEFORE the registry is built) and,
  // where the host has a production microphone opener, the microphone loss watch. The platform word decides the microphone.
  ports.provideProductionParts({ platform: input.platform, dependencies: { camera, audio }, watches, cards, relayReports, attachCameraWatch, attachMicLossWatch });
  // FINDING E-03: AT EVERY END OF A CAPTURE (a stop, an interruption, a failed start - the session's three end events) the
  // camera watch forgets the losses of that capture and ends the faults it raised itself. The watch is attached before the
  // registry exists, so before any start. WHO READS `lost()`: no product file today (a test, and the watch's own state);
  // the session states a camera's absence from the relay's reports, not from the watch.
  ports.onCaptureEnd(() => cameraWatch?.captureEnded());

  return Object.freeze({
    composed: true,
    storedAddress,
    networkFactsInjected: input.network !== undefined,
    relayReports,
    cards,
    cardListingUnavailable: unavailable,
    stored,
    dependencies: Object.freeze({ camera, audio }),
    watches,
    faults,
    attachCameraWatch,
    attachMicLossWatch,
  });
}

// ── On an app ──────────────────────────────────────────────────────────────────────────────────

const SOURCE = 'captureComposition';
const REPORTED = 'the composition of production capture reports';
const COMPOSED = 'production capture composed';

// Keyed by the app's stage registry: one composition per app (the `captureFenceControl(app)` idiom).
const compositions = new WeakMap<object, ProductionCaptureComposition>();

/** The composition of an app, or null when the entry point did not compose it. */
export function productionCaptureComposition(app: { readonly stages: object }): ProductionCaptureComposition | null {
  return compositions.get(app.stages) ?? null;
}

// ── 10. The alias of the camera port (task 4 row 106b; decisions C19, C53 (4), C74, C76, C78) ───
//
// IN `REAL_PRODUCTION` ONLY AND ONLY WITH THE READER OF THE NETWORK FACTS (the facts are production-only, decision C76;
// a development or simulated Core states no camera network and gets no lifecycle: its operation 105 and its scan answer
// `COMMISSIONING_NOT_AVAILABLE`, its operation 104 the plain read). ONE lifecycle per app, handed:
//
//   transport        the platform seam of `src/host-alias-socket.ts` on the configured socket. Off Linux it answers the
//                    named `NOT_AVAILABLE_ON_THIS_PLATFORM` and touches nothing;
//   host             the Core's clock, session state, read on the pool, unit of work with the audit chain, and a report
//                    to the log and the persistent error log (codes and counts);
//   the three facts  the reader of the network facts (the SAME function the destination rule is bound to); the stored
//                    camera interface (the network folder's memory); the interface file (`hostAliasInterfaceFileOf`:
//                    since row 106c the entry's runner with the fixed row, on `linux` only - SR-11, decision C82);
//   the candidates   what the stored factory list can produce, read at the sweep.
//
// AND IT HANDS THE LIFECYCLE ON, through the doors that exist:
//   - to the routes of operations 104 / 105 (`captureHostAliasControl(app).provide`), whose mount registered the
//     `preClose` hook that calls `shutdown()` when the app closes;
//   - as the port of a job (`hostAliasJobPortOf`: decision C78 DD-2 in ONE place) to the commissioning scan, with the
//     rule bound to the purpose of a scan and the scan's own probe call (`captureFactoryScanControl(app).provide`);
//   - with it, since row 111b, THE HOST'S OWN OBSERVATIONS (`hostCommissioningInputsOf`: the neighbour table and "does
//     anything answer", two fixed rows through the production door, `linux` only) to the scan (`mac`) and to the set-IP
//     job (`inputs`). This is NOT the runner of SR-11: that runner keeps its one use;
//   - `boot()` as a boot step added HERE (the readiness plugin takes a step until `boot()` runs): it runs after every
//     step a unit registered - so after `capture.config` loaded the network choice - and before the listener opens.
//
// OF THE ENTRY STATEMENT this takes ONE member (row 106c, SR-11): the runner of the host's questions, used once.

export const HOST_ALIAS_BOOT_STEP = 'capture.hostAlias';
const ALIAS_SOURCE = 'hostAlias';
const ALIAS_REPORTED = 'alias lifecycle';
const ALIAS_SWEEP_ENDED = 'alias boot sweep ended';
const ALIAS_SWEEP_NOT_HERE = 'the address helper does not exist on this platform: the alias boot sweep asked nothing';
const HELPER_NOT_ON_THIS_PLATFORM = 'NOT_AVAILABLE_ON_THIS_PLATFORM';
export const HOST_ALIAS_READ_UNIT = 'hostAlias.read';

/** The alias of the camera port as the composition mounted it: the ONE lifecycle, and the port a job is handed (rows 107, 111). */
export interface MountedHostAlias {
  readonly lifecycle: HostAliasLifecycle;
  readonly jobs: HostAliasJobPort;
}

// Keyed by the app's stage registry, as the composition itself.
const hostAliases = new WeakMap<object, MountedHostAlias>();

/** The mounted alias of an app, or null: not production capture, no network facts handed in, or not composed. */
export function productionHostAlias(app: { readonly stages: object }): MountedHostAlias | null {
  return hostAliases.get(app.stages) ?? null;
}

/** THE BINDING of the lifecycle's host to one app (request line `row 106`, (1)). */
function hostAliasHostOf(app: FastifyInstance): HostAliasHost {
  return {
    now: () => app.clock.now(),
    sessionOpen: () => isSessionActive(app.engine.state().session),
    read: (label, work) => app.db.read(label, (pool) => work({ query: (text, values) => pool.query(text, values) })),
    async unit(label, work) {
      if (app.engine.running) {
        const outcome = await app.engine.run(label, (scope) =>
          work({
            db: { query: (text, values) => scope.unit.query(text, values) },
            // The state THIS unit sees: a session that opened since the lifecycle looked is seen here.
            sessionOpen: () => isSessionActive(scope.pending().session),
            audit: async (entry) => {
              await scope.unit.audit.append(entry);
            },
          }),
        );
        return outcome.value;
      }
      // THE ENGINE HAS STOPPED (the close of the app: its `preClose` hook runs before this lifecycle's). The removal at
      // shutdown still writes its two entries, in a unit of the pipeline, which closes after every `preClose` hook. No
      // session state can be read then, so it is NOT idle: an `add` and the technician's removal are refused in the unit.
      return app.pipeline.run(label, (unit) =>
        work({
          db: { query: (text, values) => unit.query(text, values) },
          sessionOpen: () => true,
          audit: async (entry) => {
            await unit.audit.append(entry);
          },
        }),
      );
    },
    report(code, facts) {
      app.log.warn({ code, source: ALIAS_SOURCE, ...facts }, ALIAS_REPORTED);
      app.errorLog.append({ level: 'warn', source: ALIAS_SOURCE, message: ALIAS_REPORTED, code, context: { ...facts } });
    },
  };
}

/**
 * THE THIRD FACT SOURCE OF THE ALIAS LIFECYCLE (task 4 row 106c; decision C82, named amendment SR-11): the ONE name the
 * address helper's interface file holds. THE ONE USE OF THE HOST'S RUNNER IN THIS FILE: the runner the entry point handed
 * in is given, unchanged, to the source of the capture unit together with the FIXED row of the boot's program checks
 * (one program literal, one argument literal, nothing from data: rules G-R12 / SR-4). It is asked at every `add`, never
 * here. On any platform but `linux`, or with no runner, NOTHING IS RUN and the source answers "unreadable": every `add`
 * is then refused `INTERFACE_FILE_UNREADABLE` before the helper is asked. A test's own source stands in its place.
 */
export function hostAliasInterfaceFileOf(input: ProductionCaptureInput): () => Promise<unknown> | unknown {
  return input.aliasInterfaceFile ?? hostAliasInterfaceFileSourceOf(input.platform === 'linux' ? (input.hostRunner ?? null) : null, INTERFACE_FILE_COMMAND);
}

function mountHostAliasOf(app: FastifyInstance, input: ProductionCaptureInput, network: CaptureNetworkFactsReader): MountedHostAlias {
  const timers = createSystemTimers();
  const transport: HostAliasTransport = input.aliasTransport ?? hostAliasSocketTransportOf({ platform: input.platform, socketPath: app.config.captureAliasSocketPath });
  const stored = captureNetworkConfigControl(app);
  const lifecycle = createHostAliasLifecycle({
    transport,
    host: hostAliasHostOf(app),
    sources: {
      network,
      storedInterface: () => stored.storedInterface(),
      fileInterface: hostAliasInterfaceFileOf(input),
    },
    timers,
    configuredCandidates: async () => {
      const list = await stored.factoryList();
      return list === null ? [] : aliasCandidatesOfConfiguration(list.factoryAddresses, list.aliasHost);
    },
  });
  const jobs = hostAliasJobPortOf(lifecycle, transport);

  // Operations 104 / 105 and the shutdown hook; then operation 103. A door that refuses throws: then nothing was composed.
  captureHostAliasControl(app).provide(lifecycle);
  // Task 4 row 111b (decisions C78, C87): THE HOST'S OWN OBSERVATIONS - the neighbour table and "does anything answer" - made by the fence over the production door with the two fixed rows of the helper table. On `linux` only: on any other platform the fence answers null, NOTHING IS EVER STARTED, the scan states no hardware address and every job keeps its refusal `COMMISSIONING_NOT_AVAILABLE`.
  const observed = input.commissioningInputs ?? hostCommissioningInputsOf({ platform: input.platform, timers, network, cameraInterface: () => stored.storedInterface() });
  captureFactoryScanControl(app).provide({ rule: factoryScanRuleOf(), alias: jobs, probe: factoryScanProbeOf(timers), ...(observed === null ? {} : { mac: observed.scan.mac }) });
  // Task 4 row 111 (decisions C78, C82): the set-IP job - the capture unit's rules and calls, the SAME alias port, and the ONE lock-out guard of the connection tests. Its `inputs` are the observations above; without them (not `linux`) every job is refused.
  captureCameraNetworkControl(app).provide({ camera: cameraNetworkCameraOf(timers), alias: jobs, guard: () => captureConnectControl(app).limits, ...(observed === null ? {} : { inputs: observed.job }) });

  // THE BOOT SWEEP. It never rejects and never stops a start; counts and codes only, never an address.
  app.readiness.addBootStep({
    id: HOST_ALIAS_BOOT_STEP,
    async run() {
      let helper: string | null;
      try {
        helper = await transport.preflight();
      } catch {
        helper = null;
      }
      if (helper === HELPER_NOT_ON_THIS_PLATFORM) {
        // SAID ONCE: on this platform nothing can be on the camera port through the helper, and nothing is asked of it.
        app.log.info({ code: 'HOST_ALIAS_BOOT_SWEEP_NOT_ON_THIS_PLATFORM', source: ALIAS_SOURCE, asked: 0 }, ALIAS_SWEEP_NOT_HERE);
        return;
      }
      const sweep = await lifecycle.boot();
      const counts = {
        code: 'HOST_ALIAS_BOOT_SWEEP',
        source: ALIAS_SOURCE,
        stateRead: sweep.stateRead,
        interfaceTableRead: sweep.interfaceTableRead,
        asked: sweep.swept.length,
        attempted: sweep.swept.filter((entry) => entry.attempted).length,
        stillOpen: sweep.stillOpen,
      };
      if (sweep.stateRead && !sweep.stillOpen) app.log.info(counts, ALIAS_SWEEP_ENDED);
      else {
        app.log.warn(counts, ALIAS_SWEEP_ENDED);
        app.errorLog.append({ level: 'warn', source: ALIAS_SOURCE, message: ALIAS_SWEEP_ENDED, code: counts.code, context: { stateRead: counts.stateRead, interfaceTableRead: counts.interfaceTableRead, asked: counts.asked, attempted: counts.attempted, stillOpen: counts.stillOpen } });
      }
    },
  });
  return Object.freeze({ lifecycle, jobs });
}

/**
 * COMPOSES PRODUCTION CAPTURE ON AN APP. Called ONCE, by the entry point, after `app.ready()` and
 * before the boot steps; a second call is refused. In any operation but `REAL_PRODUCTION` it opens
 * no door and builds nothing.
 */
export function composeProductionCaptureOf(app: FastifyInstance, input: ProductionCaptureInput): ProductionCaptureComposition {
  if (compositions.has(app.stages)) throw new CaptureCompositionError(CaptureCompositionCode.COMPOSED_TWICE);
  const report: ProductionCapturePorts['report'] = (level, code, context) => {
    app.log[level]({ code, ...context }, REPORTED);
    app.errorLog.append({ level, source: SOURCE, message: REPORTED, code, context: { ...context } });
  };
  const composition = composeProductionCapture(
    {
      operation: captureFenceControl(app).operation,
      timers: createSystemTimers(),
      now: () => app.clock.now(),
      relayProgram: app.config.captureRelayPath,
      guardProgram: app.config.captureGuardPath,
      audioHelperProgram: app.config.captureAudioHelperPath,
      // The engine behind its seam, asked at every raise and clear: a fault is "active" when the engine's own list holds
      // that kind, that device AND that cause - whoever raised it.
      faultEngine: () => {
        if (!app.seams.has('engine') || !app.engine.running) return null;
        const host = app.engine;
        return {
          active: (fault) => host.state().faults.active.some((held) => held.kind === fault.code && held.target === fault.subject && (held.reason ?? null) === fault.reason),
          raise: (fault) => host.raiseCaptureWarning(fault),
          clear: (fault) => host.clearCaptureWarning(fault),
        };
      },
      // The supervisor's own phase: `RESTARTING` is "the worker of the open session went down; the next one starts".
      workerSuperseded: () => app.seams.has('capture') && app.capture.status().phase === CapturePhase.RESTARTING,
      unit: (label, work) => app.pipeline.run(label, work),
      // The store is asked at each read: a store that is not ready opens nothing, and the reader answers its own failure code.
      open: (deviceId, sealed) => {
        const opened = coreCredentialStore(app);
        if (opened.status !== 'READY') {
          report('error', CaptureCompositionCode.CREDENTIAL_STORE_NOT_READY, { deviceId, store: opened.status });
          throw new CaptureCompositionError(CaptureCompositionCode.CREDENTIAL_STORE_NOT_READY);
        }
        return opened.store.capture.open(deviceId, sealed);
      },
      errorLog: app.errorLog,
      query: (text, values) => app.db.read(`${SOURCE}.read`, (pool) => pool.query(text, values)),
      provideConnectionTest: (parts) => {
        adoptedCameraTestControl(app).provide(parts);
        // Task 4 row 143c (decision C65): the SAME binding to its fifth taker - the connection test of a candidate that is
        // not stored yet (operations 95 and 96), which in production is bound to the camera interface or is not made.
        const { storedAddress } = parts;
        captureConnectControl(app).provideCandidateRule(storedAddress);
      },
      provideEnumerator: (enumerator) => captureAudioCardsControl(app).provideEnumerator(enumerator),
      provideRelayReports: (relayReports) => sessionCapture(app).replace({ relayReports }),
      provideProductionParts: (parts) => captureFenceControl(app).provideProductionParts(parts),
      onCaptureEnd: (listener) =>
        sessionCapture(app).on((event) => {
          if (event.type === 'STOPPED' || event.type === 'INTERRUPTED' || event.type === 'FAILED_START') listener();
        }),
      report,
    },
    input,
  );
  // Integration pass I-9a (rows 108 and 197; decisions C55, C60 (4)): THE SAME READER TO ITS TWO OTHER TAKERS, once per
  // app, in production only and only when a reader was handed in. Neither statement CALLS the reader: each taker asks it
  // at its own judgement. Without them a confirmed re-address (operation 100) and a typed address (operation 93) stay
  // refused, as on every other Core. A door that refuses (handed in already) throws: then nothing was composed.
  if (composition.composed && input.network !== undefined) {
    captureReaddressControl(app).provideNetworkFacts(input.network);
    typedAddressControl(app).provideRule(typedProbeRuleOf(input.network, () => report('error', CaptureCompositionCode.NETWORK_FACTS_UNREADABLE, {})));
    // Task 4 row 106b (decisions C74, C78): the alias lifecycle, its routes, its boot sweep, and the parts of the scan.
    hostAliases.set(app.stages, mountHostAliasOf(app, input, input.network));
  }
  compositions.set(app.stages, composition);
  if (composition.composed) {
    app.log.info({ code: 'CAPTURE_COMPOSITION_DONE', networkFactsInjected: composition.networkFactsInjected, cardListing: composition.cardListingUnavailable ?? 'AVAILABLE' }, COMPOSED);
  }
  return composition;
}
