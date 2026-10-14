/**
 * The seams of the adapter layer (blueprint row 65 / M4-W1; register NM-01, NM-09, NM-10; capture
 * spec §A.1, §A.1.1, §A.6, §A.6.0, §A.7, §A.7.1; contract C3 §2.4, §2.6).
 *
 * Adapters are Core-process code (spec §A.1.1; D82(b)): nothing here is compiled into or loaded
 * by the capture worker. An adapter serves one or more registered devices and states its KIND;
 * the registry (`registry.ts`) derives everything else from that.
 *
 * WHAT IS BUILT AND WHAT IS NOT. This row builds the interfaces, the in-memory fakes
 * (`fake/`), the registry and the class-C stubs. It builds no socket, no process and no file:
 *   - `discover` on a real network     -> row 131 (`camera/ws-discovery.ts`);
 *   - `testConnection` toward a device -> row 142 (`camera/onvif-session.ts`);
 *   - the local camera and microphone  -> rows 134 to 136 (`local-device/`);
 *   - a real camera's recording path, a real microphone's transport, a real PoE switch -> class C.
 *     ERRATUM (task 4 row 88, the lift, AM-1): the first two are BUILT since task 4 - the camera
 *     `camera/onvif-relay.ts`, the microphone `audio/usb-audio-production.ts` (linux) - and the
 *     production registry registers them with their opener; the PoE switch stays class C.
 *
 * "HAS AN OPENER" (D86 C-5, amended by AM-1). A source adapter states `hasOpener`. A source whose
 * adapter has none gets no listener and no session: the plan builder (row 66) and the session start
 * (row 71) ask `CaptureDeviceRegistry.assertRecordable` before `app.capture.start`, and row 136
 * registers the local-device adapters that have one.
 */
import type { CapturePlanMic } from '@dems/capture-protocol';
import type { CameraCredential, SealedCredential } from './credential';
import type { CaptureAdapterKind, CaptureDeviceClass, CaptureOperation, CaptureSourceClass } from './kinds';
import type { MicTransportStatement } from './mic-transport';

export type { CameraCredential, SealedCredential };

/** A capability code an adapter reports for a device (the open set of the `captureDevices` slice). */
export type CaptureCapability = 'VIDEO' | 'AUDIO' | 'PULL' | 'SNMP';

/** What an adapter says about a device it serves. The source class is NOT here: it is derived (rule of §A.1.1). */
export interface CaptureDeviceEntry {
  /** The registry ID: `CAM-NN`, `MIC-NN`, `POE-…`. The wire subject of every frame about the device (D72(g)). */
  readonly id: string;
  readonly deviceClass: CaptureDeviceClass;
  readonly label: string;
  readonly capabilities: readonly CaptureCapability[];
  /** The media profiles of a camera, in the device's order; empty for other classes. Two entries make a dual-lens camera (OD-05). */
  readonly profiles: readonly string[];
}

/** A registered device as the registry lists it. */
export interface CaptureDeviceDescriptor extends CaptureDeviceEntry {
  readonly adapterKind: CaptureAdapterKind;
  /** `sourceClassOf(adapterKind)`: computed when the descriptor is made, never kept by an adapter. */
  readonly sourceClass: CaptureSourceClass;
  /** True when the device's adapter can open it as a source for a recording (D86 C-5). Always false for a PoE controller. */
  readonly hasOpener: boolean;
}

// ── Cameras (NM-09) ───────────────────────────────────────────────────────────────────────────

/** One search (spec §A.6.1). The request carries no address, port or filter: a search probes the fixed group (C3 op 93). */
export interface DiscoverySearch {
  /** The search window in milliseconds (`CAPTURE_DISCOVERY_WINDOW_MS`, C3 §7; row 132 lands the constant). */
  readonly windowMs: number;
  readonly signal: AbortSignal;
}

/**
 * One answer of a search, as an adapter hands it to the search state (row 132). NOT a descriptor
 * and never registered (rule RG-4). Built from the probe answer only (D80(1)); every text is
 * untrusted device text that the adapter has sanitised and capped (spec §A.6.1 DS-16).
 */
export interface CameraCandidate {
  /** `FAKE` when the answer came through the injected loopback target or from a loopback address, else `ONVIF_RTSP` (SEC35-41 (a)). */
  readonly adapterKind: CaptureAdapterKind;
  /** The address the answer came from: an IP literal, never a locator, never a user part (C-N8). */
  readonly host: string;
  /** The announced service address when its host equals `host`, else null. Never returned by the API; row 142 dials it. */
  readonly serviceAddress: string | null;
  readonly endpointRef: string | null;
  readonly vendor: string | null;
  readonly model: string | null;
  readonly name: string | null;
  readonly testable: boolean;
  readonly conflict: boolean;
}

export interface DiscoveryResult {
  readonly candidates: readonly CameraCandidate[];
  /** How many devices answered; may exceed `candidates.length` when `truncated`. */
  readonly responderCount: number;
  /** Interfaces probed: a count, never a name or an address. */
  readonly interfaceCount: number;
  readonly truncated: boolean;
}

/** The five outcomes of a connection test (C3 §2.6 "Connection test: outcomes"). A failed test is a result, not an error. */
export const ConnectionTestOutcome = {
  REACHABLE: 'REACHABLE',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  WRONG_PROFILE: 'WRONG_PROFILE',
  NOT_H264: 'NOT_H264',
  UNREACHABLE: 'UNREACHABLE',
} as const;
export type ConnectionTestOutcome = (typeof ConnectionTestOutcome)[keyof typeof ConnectionTestOutcome];

/** No device text, no locator, no credential member (C3 op 95). */
export interface ConnectionTestResult {
  readonly outcome: ConnectionTestOutcome;
  /** Whether a credential was supplied: a fact, never a value. */
  readonly authenticated: boolean;
  /** The usable profile codes the test read; empty unless `REACHABLE`. */
  readonly usableProfiles: readonly string[];
}

export interface MediaProfile {
  readonly code: string;
  /** The video codec, in the words of manifest field 43 (`H264` | `HEVC`, erratum PE-D9-03): one vocabulary with what the capture reads from an init segment. */
  readonly codec: 'H264' | 'HEVC' | 'OTHER';
}

/** An opened source: something that now feeds the worker. Closing it stops the feed; closing twice is safe. */
export interface SourceHandle {
  readonly deviceId: string;
  close(): Promise<void>;
}

/** Where an opened camera source pushes: the worker's loopback listener of the plan (`CapturePlanCamera.ingestUrl`). */
export interface CameraSourceTarget {
  readonly ingestUrl: string;
  /**
   * The media profile to pull: the code of the plan's camera line (task 4 row 20; design addendum
   * 2.3 and 4.1 e). One camera may fill both slots with two profiles, so an adapter that pulls
   * from a device keys an open source by device AND profile. The fake, generated and local
   * adapters ignore the member: their source has one stream.
   *
   * Optional: the session start passes the plan's value (since task 4 row 47), and it is absent
   * when the plan's line states none. An adapter that needs a profile refuses an open without
   * one by a named code (`CaptureAdapterRefusal.PROFILE_UNKNOWN`); it never chooses one itself.
   */
  readonly profile?: string;
  /**
   * The session the open is for: the session the PLAN was built for, never a request field (task
   * 4 row 46, on the request of row 145). The production camera adapter names it to its
   * credential reader, which writes it into the audit row of the reveal (AD-03 (3)), and in the
   * report of its relay (`RelayIngestReport.sessionId`). Optional, as `profile` is: the fake,
   * generated and local adapters ignore it; the production adapter refuses an open without it.
   */
  readonly sessionId?: string;
  /**
   * The attempt of the worker the open is for (`supervisor.status().attempt`; task 4 row 46, on
   * the request of rows 179 and 48). The production adapter hands it to its relay, and the
   * relay's report names it (`RelayIngestReport.attempt`), so that a report of a superseded
   * attempt can be told from one of the attempt in force (C37). Optional and refused when absent,
   * as `sessionId` is.
   */
  readonly attempt?: number;
}

export interface CameraAdapter {
  readonly seam: 'CAMERA';
  readonly kind: CaptureAdapterKind;
  /** The registered cameras this adapter serves. An adapter that only searches and tests serves none. */
  readonly devices: readonly CaptureDeviceEntry[];
  /** True when `openSource` can feed the worker for this adapter's devices (D86 C-5). */
  readonly hasOpener: boolean;
  /** Probe only (spec §A.6.1). Call sites: the search operation and the pre-check, nothing else (static rule G-R13). */
  discover(search: DiscoverySearch): Promise<DiscoveryResult>;
  /**
   * One read-only attempt (spec §A.6.2). The credential is a parameter of this one call (CR-1): it
   * is no member of the candidate, the adapter or the result, and nothing keeps it for a retry.
   */
  testConnection(candidate: CameraCandidate, credential: SealedCredential | null, signal: AbortSignal): Promise<ConnectionTestResult>;
  /** Starts the source of a device toward the worker's listener. Rejects with `SOURCE_KIND_NOT_RECORDABLE` when `hasOpener` is false. */
  openSource(deviceId: string, target: CameraSourceTarget, signal: AbortSignal): Promise<SourceHandle>;
  profiles(deviceId: string): Promise<MediaProfile[]>;
  /** The host-and-path locator of a profile: never a user part (SEC35-04). The credential joins it at `credentialAtInjection` only. */
  pullUrl(deviceId: string, profile: string): string;
  /** The camera clock minus the Core clock, in milliseconds. A read; setting a camera clock is class C. */
  ntpOffsetMs(deviceId: string): Promise<number>;
}

// ── PoE (NM-09) ───────────────────────────────────────────────────────────────────────────────

export const PoePortStatus = { POWERED: 'POWERED', OFF: 'OFF', UNKNOWN: 'UNKNOWN' } as const;
export type PoePortStatus = (typeof PoePortStatus)[keyof typeof PoePortStatus];

export interface PoeController {
  readonly seam: 'POE';
  readonly kind: CaptureAdapterKind;
  /** The switch itself (`POE-…`). */
  readonly devices: readonly CaptureDeviceEntry[];
  /** `port` is the port code a camera's registry row names (`poePort`). */
  status(port: string): Promise<PoePortStatus>;
  /**
   * Power-cycles one port. The adapter does what it is told: WHETHER a cycle is allowed (a lost
   * camera only, confirmed, audited, never a healthy one — OD-22) is decided by the devices
   * module (CS-06) before it calls this, with the command the contract table names.
   */
  cycle(port: string): Promise<void>;
}

// ── Microphones (NM-10) ───────────────────────────────────────────────────────────────────────

/** The named causes of a local input that cannot be used (C3 op 97; spec §A.6.4 HL-11). */
export const AudioInputErrorCode = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  DEVICE_BUSY: 'DEVICE_BUSY',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  OPEN_FAILED: 'OPEN_FAILED',
  HELPER_EXITED: 'HELPER_EXITED',
} as const;
export type AudioInputErrorCode = (typeof AudioInputErrorCode)[keyof typeof AudioInputErrorCode];

/** What `enumerate` says about one registered microphone. It opens no device (ML-8). */
export interface AudioInputDescriptor {
  /** The microphone's registry ID (`MIC-NN`). */
  readonly inputId: string;
  readonly present: boolean;
  readonly errorCode: AudioInputErrorCode | null;
}

export interface AudioOpenTarget {
  /** The session the stream is opened for: a transport's path lives below a directory of that session (ML-2). */
  readonly sessionId: string;
  readonly signal: AbortSignal;
}

/**
 * An opened microphone. `input` goes into the plan UNCHANGED (`CapturePlanMic.input`): the plan
 * builder takes a microphone's input from here and from nowhere else (D72(e)).
 */
export interface AudioStreamHandle extends SourceHandle {
  readonly input: CapturePlanMic['input'];
  /** What the transport promises about format, timing and clock (`mic-transport.ts`). */
  readonly transport: MicTransportStatement;
  /**
   * Launches what feeds `input`, when the transport has something to launch (a helper process).
   * Declared here (task 4 row 20; design addendum 4.1 d) because the session start already calls
   * it on every handle that has one, all in the same turn, with the session's signal; until this
   * row it found the member by its name only. A handle without it delivers from `open` on (the
   * fakes). Rejects when the launch fails; `close()` is still called after a failure.
   */
  start?(signal?: AbortSignal): Promise<void>;
}

/**
 * The named refusal of an input number that the sound card does not have (task 4 row 20; specs
 * S3-2; design addendum 4.2 "Refusals"). Its own name, NOT a sixth member of
 * `AudioInputErrorCode`: those five are the causes of a registered input that cannot be used and
 * are a closed wire vocabulary (C3 op 97), while this one refuses a registration or an open
 * before any device is touched. Nothing raises it yet: the card listing (task 4 row 64) does.
 */
export const AUDIO_INPUT_BEYOND_CARD = 'AUDIO_INPUT_BEYOND_CARD';

/**
 * Carries the code and, at most, a registry ID. The text is one fixed sentence: no card name, no
 * USB id, no input number and no channel count is put into it (the rule of `errors.ts`, CR-4).
 */
export class AudioInputBeyondCardError extends Error {
  readonly code: typeof AUDIO_INPUT_BEYOND_CARD = AUDIO_INPUT_BEYOND_CARD;
  /** The microphone the refusal is about (`MIC-NN`), or null when no device is registered yet. */
  readonly deviceId: string | null;
  constructor(deviceId: string | null = null) {
    super('the sound card has no such input');
    this.name = 'AudioInputBeyondCardError';
    this.deviceId = deviceId;
  }
}

/**
 * What an audio adapter states of the card behind ONE registered input (task 4 row 71, declared
 * here by integration pass I-7): the identity of the card and the input, rate and format it is
 * opened with. Every member is `unknown`: the reader - the session start, through the capture
 * fence - holds each to its own rule again and trusts none of them (device text, AD-07 (1)).
 *
 * The capture fence states the SAME shape as `AudioCardStatement` (`capture/fence/sources.ts`)
 * and still finds the member by its name; the fence imports this layer, never the other way
 * round, so the one declaration belongs here. Its move (the fence's interface becoming a
 * re-export of this one, `audioCardStatementOf` a plain call) is left to a pass that may edit the
 * fence's source files.
 */
export interface AudioSourceStatement {
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
  /** The serial number of the card that was opened (task 4 rows 200, 85b); null or absent: it stated none. */
  readonly usbSerial?: unknown;
  /** The USB port path of the card that was opened; null or absent: none. */
  readonly usbPort?: unknown;
}

export interface AudioInputAdapter {
  readonly seam: 'AUDIO';
  readonly kind: CaptureAdapterKind;
  readonly devices: readonly CaptureDeviceEntry[];
  /** True when `open` can feed the worker for this adapter's devices (D86 C-5). */
  readonly hasOpener: boolean;
  enumerate(): Promise<AudioInputDescriptor[]>;
  /** Rejects with `SOURCE_KIND_NOT_RECORDABLE` when `hasOpener` is false. */
  open(inputId: string, target: AudioOpenTarget): Promise<AudioStreamHandle>;
  /** dBFS at most 0, or null when the input delivers nothing (NO SIGNAL; D72(i)). */
  level(inputId: string): Promise<number | null>;
  /**
   * The card behind an input the adapter holds OPEN, or null when it states nothing for that
   * input (task 4 row 71; the production adapter `audio/usb-audio-production.ts` implements it
   * since row 67). OPTIONAL, as `start` of a handle is: the fakes, the generated and the local
   * sources have none, and their session rows store `{}`. It answers from what the adapter
   * already holds - no listing, no process, no file - because the session start calls it inside
   * its unit of work.
   */
  sourceFacts?(inputId: string): AudioSourceStatement | null;
}

export type CaptureAdapter = CameraAdapter | AudioInputAdapter | PoeController;
export type CaptureAdapterOf<Class extends CaptureDeviceClass> = Class extends 'CAMERA' ? CameraAdapter : Class extends 'MIC' ? AudioInputAdapter : PoeController;

// ── The registry (NM-01) ──────────────────────────────────────────────────────────────────────

export interface CaptureDeviceRegistry {
  /** The operation the registry was built for (rule RG-1). */
  readonly operation: CaptureOperation;
  /** Refuses a kind the operation does not register, a duplicate device ID, and an opener the phase has none for. */
  register(adapter: CaptureAdapter): void;
  /** Every registered device, in ID order. Never a development source outside `REAL_DEVELOPMENT` (rule RG-2). */
  list(): readonly CaptureDeviceDescriptor[];
  describe(deviceId: string): CaptureDeviceDescriptor;
  /** The adapter of a device. Refused while a session is open (OD-10). */
  resolve<Class extends CaptureDeviceClass>(deviceClass: Class, deviceId: string): CaptureAdapterOf<Class>;
  /** The camera adapters that search and test (rule RG-1), by kind. No device is needed for those two calls. */
  cameraAdapters(): readonly CameraAdapter[];
  /** The adapter kinds that have an opener, of the registered source adapters (rule RG-1; D86 C-5). */
  openerKinds(): readonly CaptureAdapterKind[];
  /** Refuses with `SOURCE_KIND_NOT_RECORDABLE` a device whose adapter has no opener. */
  assertRecordable(deviceId: string): CaptureDeviceDescriptor;
  /**
   * Refuses an assignment to a track or a microphone role (rule RG-3): an unknown ID (a discovery
   * candidate is always unknown, rule RG-4), a device of another class, a source class that is
   * not the class of the running operation, or a locked configuration.
   */
  assertAssignable(deviceClass: Extract<CaptureDeviceClass, 'CAMERA' | 'MIC'>, deviceId: string): CaptureDeviceDescriptor;
}
