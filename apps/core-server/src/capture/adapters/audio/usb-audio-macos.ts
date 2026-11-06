/**
 * THE PRODUCTION MICROPHONE ADAPTER OF macOS, adapter kind `USB_AUDIO` (task 4 row N9;
 * `masterplan/06_design_macos_microphone.md` revision 3, sections 4.6, 4.7, 6, 7.1, 8.1, 8.3, 9.2;
 * security addendum 08b, SM-04, SM-14, SM-16, SM-34 (4) (6), SM-35, SM-39; decisions U23, U25,
 * C104, C107, C110, C112, C118, C119).
 *
 * THE BENCH FORM OF THIS MAC: NOT THE HARDENED LINUX FORM; THE AUDIO OF THIS PATH IS NOT
 * SAMPLE-CONTINUOUS. About a tenth of the samples never reach the pipe (row MM3: 89.4 to 91.8 %,
 * whole packets of 512 samples, and the helper never says so). This file is where the code says
 * it (design 8.1, decision U25 (3)): it exports the two words `MACOS_CAPTURE_LAYER` and
 * `MACOS_SAMPLE_CONTINUITY`, states them with the capture group in the source facts of every
 * microphone it opens, and no other file of the adapter layer builds them (static rule A-12). The
 * worker counts what did not arrive (the pipe kind `PCM_FIFO_GAPPED`, row N13); what the Core does
 * with the counts is row N11's.
 *
 * BUILT BY THE LOADER ON `darwin` ONLY, AND ONLY WITH ITS OPENER ADMITTED (row N10; decision C135
 * (3)): until the M2b gate row admits it (`MACOS_MICROPHONE_OPENER_ADMITTED` of the fence) a
 * `darwin` host still gets the adapter WITHOUT an opener. Named by the loader and, for its pure
 * match of the loss watch, by the fence's boot step (static rule A-9).
 *
 * ONE HELPER PER DEVICE, TWO HANDLES (design 6.1; MF13: two helpers cannot hold the device). The
 * handles of one device in one session form a GROUP, and the group owns the one helper:
 *
 *   open      the stored row, ONE listing (the three lists of row N6, tied by name), the match of
 *             the stored identity (`identifyRegisteredCard`, unchanged), the input and the rate
 *             the system states; the pipe is made; the handle JOINS the group of (session,
 *             device). No helper starts, and NO INDEX IS KEPT (an index is valid for ONE start
 *             only: three values in two days, decision C118 (3)).
 *   start     THE FIRST `start` of a group LAUNCHES THE HELPER, ONCE, with one output per handle
 *             that is open in the group at that instant; every later `start` of the group JOINS
 *             that launch; each settles with the launch's outcome. A launch: the pause of the
 *             device, a SECOND listing (the device word `none:<n>` is taken from it and from no
 *             other), the push template of row N4, the guard through the production door with an
 *             empty environment, the helper's own lines read until the gate of
 *             `macos-launch-gate.ts` passes or refuses (bound 3,000 ms), the settle time, a THIRD
 *             listing that must state the same ordered list, the same identity and the same tie.
 *   close     of one handle while another records: the handle leaves the group, its input is free,
 *             and ITS PIPE STAYS OPEN AND IS DRAINED until the group ends. A reader that closes its
 *             pipe ends the WHOLE helper (exit status 224, decision C118 (1)): so the adapter holds
 *             its own reader on every pipe of a launch from before the helper starts to after it
 *             has ended (`MacosPipeKeeper`), idle while the worker reads, draining once the handle
 *             is closed. Of the last handle: the helper is stopped, then the readers are let go,
 *             then the pipes are removed, and the instant starts the pause of the device.
 *   end       the helper ends by itself: EVERY live handle of the group is told once,
 *             `AUDIO_HELPER_EXITED` - both microphones are lost in the same instant (design 6.2:
 *             the standby guards a microphone and its cable, not the device; D61, 2026-11-04: the
 *             failover concept is superseded - every numbered channel records on its own).
 *
 * STOPPING A HELPER. The end of the guard's input; the guard sends SIGTERM and, 2,000 ms later, a
 * SIGKILL (its `GUARD_TERM_BOUND_MS`). A helper whose pipe was never opened by a reader IGNORES
 * SIGTERM (decision C118 (2)): the SIGKILL is what ends it. This adapter signals the guard itself
 * only past that bound (SIGTERM at 3,000 ms, SIGKILL at 5,000 ms), because a guard killed first
 * would leave its child alive on macOS (the parent-death signal is Linux-only). A start that fails
 * returns only after the guard has ended, and the guard ends only after its child: no helper is
 * left.
 *
 * UNRELIABLE OPENS (design 4.7, SM-39). A pause of 1,000 ms after the end of the last helper of a
 * DEVICE before the next one starts, kept per device and not per session (a pre-check, then a
 * session; a session after a session). ONE retry, inside the one `start`, only when the helper
 * ended by itself with status 251, said `audio format is not supported` and stated no stream: the
 * pause, a FRESH full listing, a new index, one more launch; a second refusal ends it
 * (`FORMAT_NOT_SUPPORTED`). A helper that fed a worker is never started again.
 *
 * THE PRE-CHECK of one input: the pre-check template, one second of the SELECTED channel to the
 * door's standard output, counted in memory (`createSampleCounter`) and stored nowhere; the same
 * gate on the helper's lines; every sample exactly zero is `AUDIO_HELPER_ENDED_AT_START` /
 * `INPUT_SILENT`. The start table of the shared package makes a silent PRIMARY block and a silent
 * STANDBY warn (decision U25 (1)): this file states the refusal and decides nothing about roles.
 *
 * It does not log (the capture folder logs in one place): a refusal is a `UsbAudioError` with a
 * code and a short detail word, never a value; what is not an error is told to `onNotice`. No
 * text of a helper's line is kept on a handle, an error, a notice or a reading (SM-12 (3)).
 *
 * NOT PROVEN WITHOUT THE DEVICE (row N15, on the user's word, decision C112): the gate on a real
 * start (row N8b's request: the first device start's lines are put through the reader before the
 * gate is trusted - `launchReading` below holds what the reader made of them, no text), the
 * pause and the retry against the real refusals, the permission's forms, an unplug.
 */
import { CaptureMicInputKind } from '@dems/capture-protocol';
import type { CaptureTimers } from '../../types';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { CaptureAdapterKind, sourceClassOf } from '../kinds';
import { helperProgramRefusal } from '../local/helper-program';
import { macMicPrecheckArguments, macMicPushArguments } from '../local/mic-helper-args';
import { preparePipe, removePipe } from '../local/mic-pipe';
import { createPipeFiles, type PipeFiles } from '../local/pipe-files';
import { inspectProgram, type HelperDoor, type ProgramInspector } from '../local/process-door';
import { micTransportOf, type MicTransportStatement } from '../mic-transport';
import { startProductionProcess, type ProductionDiagnosticsEvent, type ProductionDoor, type ProductionExit, type ProductionProcess } from '../production-door';
import { AudioInputBeyondCardError, AudioInputErrorCode, type AudioInputAdapter, type AudioInputDescriptor, type AudioOpenTarget, type AudioStreamHandle, type CaptureDeviceEntry } from '../types';
import { CardFactsSource, type CaptureCard, type CardListing } from './card-listing';
import type { MacosCardEnumerator, MacosTiedListing } from './macos-card-listing';
import type { MacosUndecidedDevice } from './macos-card-tie';
import { HELPER_EXIT_STATUS_OPEN_REFUSED, readHelperLine, startHelperLines, type HelperLinesState } from './macos-helper-lines';
import { MACOS_MIC_RATE_HZ, createSampleCounter, judgeHelperStart, type MacosGateVerdict, type MacosSampleCount } from './macos-launch-gate';
import { UsbAudioError, UsbAudioRefusal, guardedArguments, identifyRegisteredCard, isRegisteredAudioInput, type CardIdentification, type RegisteredAudioInput } from './usb-audio-production';

// ── The bench-form marking (design 8.1; decision U25 (3)) ────────────────────────────────────────

/** Which capture layer delivered the microphone. A closed set of one word; Linux states nothing (U25 (5)). */
export const MACOS_CAPTURE_LAYER = 'AVFOUNDATION';
/** THE PATH IS NOT SAMPLE-CONTINUOUS: the anchor the seal reads (design 8.4a). A closed set of one word. */
export const MACOS_SAMPLE_CONTINUITY = 'NOT_CONTINUOUS';

/**
 * THE PIPE KIND of this path and what the worker is told to expect: the protocol's member
 * `CaptureMicInputKind.PCM_FIFO_GAPPED` (protocol 5, design 8.2 (b), rows N13 / N1) and ITS
 * statement in `mic-transport.ts` (row N11a) - "the same bytes as `PCM_FIFO`; the writer does NOT
 * promise every sample; the worker neither resamples nor follows the writer's clock (0 ppm), and
 * accounts for every sample". Never `PCM_FIFO`. Row N10 (request line 553 (1)) replaced the earlier
 * constant and its cast by these two names.
 */
export const MACOS_MIC_TRANSPORT: MicTransportStatement = micTransportOf(CaptureMicInputKind.PCM_FIFO_GAPPED);

// ── Refusals: the Linux adapter's codes, with the sentences this path needs ─────────────────────

/** Detail words of this adapter, beside the gate's (`MacosGateDetail`) and the listing's undecided reasons. */
export const MacosAudioDetail = {
  /** The system list states another current rate than 48,000 Hz for the device. */
  SYSTEM_STATES_OTHER_RATE: 'SYSTEM_STATES_OTHER_RATE',
  /** The group of the device has launched its helper: an output cannot be added to a running helper. */
  DEVICE_HELPER_RUNNING: 'DEVICE_HELPER_RUNNING',
  /** The helper ended twice with the refused open (design 4.7). */
  FORMAT_NOT_SUPPORTED: 'FORMAT_NOT_SUPPORTED',
  /** The helper stated no stream line within its bound. */
  NO_STREAM_LINE: 'NO_STREAM_LINE',
  /** Lines of the helper were dropped by the door's bounds before the gate had read enough. */
  LINES_DROPPED: 'LINES_DROPPED',
  /** The pre-check delivered samples, every one exactly zero. */
  INPUT_SILENT: 'INPUT_SILENT',
  /** The pre-check delivered no sample at all. */
  NO_SAMPLE: 'NO_SAMPLE',
  /** The third listing of a launch is not the second (order, identity, tie, rate or count). */
  LIST_CHANGED: 'LIST_CHANGED',
  /** `FIFO queue full` without `FIFO queue flushed` within 10,000 ms: the reader never came back. */
  QUEUE_NOT_FLUSHED: 'QUEUE_NOT_FLUSHED',
  /** Two handles of one launch name the same input, or a group would hold three. */
  INPUT_REPEATED: 'INPUT_REPEATED',
} as const;

/** The operator's sentences of this path. Fixed text: no name, number, path or line of a device. */
export const MACOS_AUDIO_SENTENCES = Object.freeze({
  /** Decision C118: the rate does not survive a restart on the user's set-up, so the sentence says what to do. */
  RATE: 'the microphone device does not run at 48,000 Hz: set its rate to 48,000 Hz in Audio MIDI Setup and start again (on this Mac the setting can be lost when the Mac restarts)',
  /** SM-34 (6), design 6.2. */
  JOINS_LATER: "Both microphones of one device are started together. This microphone joins at the next start of the session's microphones.",
  /** SM-34 (4), design 6.2: asked for the switch to the second channel when the group's helper has ended. */
  GROUP_ENDED: 'The capture program of this device has ended. Both of its channels are gone; the second channel cannot bring the audio back.',
});

/** A refusal of this adapter: a `UsbAudioError` (so every reader of the Linux adapter's refusals reads it), with the macOS sentence where the path has one. */
export class MacosUsbAudioError extends UsbAudioError {
  constructor(code: UsbAudioRefusal, deviceId: string | null = null, detail?: string) {
    super(code, deviceId, detail);
    this.name = 'MacosUsbAudioError';
    if (code === UsbAudioRefusal.CARD_RATE_UNSUPPORTED) this.message = MACOS_AUDIO_SENTENCES.RATE;
    else if (code === UsbAudioRefusal.ALREADY_OPEN && this.detail === MacosAudioDetail.DEVICE_HELPER_RUNNING) this.message = MACOS_AUDIO_SENTENCES.JOINS_LATER;
  }
}

const DETAIL_WORD = /^[A-Z][A-Z0-9_]{0,47}$/;
const NO_DETAIL = 'NONE';

/** The short code an error of another unit carries (`what`, `failure`, `reason` or `code`), as a detail word. Never its message. */
function detailOf(error: unknown): string {
  const carried = error as { what?: unknown; failure?: unknown; reason?: unknown; code?: unknown } | null;
  for (const word of [carried?.what, carried?.failure, carried?.reason, carried?.code]) if (typeof word === 'string' && DETAIL_WORD.test(word)) return word;
  return NO_DETAIL;
}

function detailOfExit(exit: ProductionExit): string {
  if (exit.spawnFailed) return 'NOT_STARTED';
  if (typeof exit.signal === 'string' && DETAIL_WORD.test(exit.signal)) return exit.signal;
  return typeof exit.exitCode === 'number' && Number.isInteger(exit.exitCode) && exit.exitCode >= 0 && exit.exitCode <= 255 ? `EXIT_${String(exit.exitCode)}` : NO_DETAIL;
}

// ── Notices ───────────────────────────────────────────────────────────────────────────────────

export const MacosAudioNoticeCode = {
  CARD_RENAMED: 'AUDIO_CARD_RENAMED',
  CARD_CHANNELS_DIFFER: 'AUDIO_CARD_CHANNELS_DIFFER',
  /** The guard did not end within its own escalation: this adapter signalled it. */
  HELPER_SIGNALLED: 'AUDIO_HELPER_SIGNALLED',
  PIPE_NOT_REMOVED: 'AUDIO_PIPE_NOT_REMOVED',
  /** Design 4.7: the open was refused once and is tried again (the microphones of the launch). */
  OPEN_RETRIED: 'AUDIO_OPEN_RETRIED',
  /** Design 4.6 row 5: the helper's queue dropped packets. The AMOUNT is the worker's (`insertedSamples`), never this line's. */
  QUEUE_FULL: 'CAPTURE_MIC_HELPER_QUEUE_FULL',
  QUEUE_FLUSHED: 'CAPTURE_MIC_HELPER_QUEUE_FLUSHED',
  /** SM-35 (4): a `full` line without `flushed` within 10,000 ms. The microphones are also told lost. */
  QUEUE_NOT_FLUSHED: 'CAPTURE_MIC_HELPER_QUEUE_NOT_FLUSHED',
  /** The door's observer read the helper's life bound of lines: nothing more of it is read. Said once. */
  DIAGNOSTICS_QUIET: 'AUDIO_HELPER_DIAGNOSTICS_QUIET',
} as const;
export type MacosAudioNoticeCode = (typeof MacosAudioNoticeCode)[keyof typeof MacosAudioNoticeCode];

export interface MacosAudioNotice {
  readonly code: MacosAudioNoticeCode;
  readonly deviceId: string;
}

// ── Seams, limits, the handle ─────────────────────────────────────────────────────────────────

/**
 * A reader of a named pipe that the ADAPTER holds (decision C118 (1)). `hold` opens the pipe for
 * reading without waiting for a writer and reads NOTHING; `drain` starts reading and dropping what
 * arrives; `release` closes it. The one file that touches a named pipe is `local/pipe-files.ts`
 * (static rule G-R2): the product's keeper belongs there and is a REQUEST LINE (row N10 wires it);
 * this file only asks for the shape. `hold` may reject; `drain` and `release` never throw.
 */
export interface MacosPipeKeeper {
  hold(path: string): Promise<MacosHeldPipe>;
}
export interface MacosHeldPipe {
  drain(): void;
  release(): void;
}

export interface MacosAudioLimits {
  /** The device must keep its helper this long after the gate passed before the third listing. */
  readonly settleMs: number;
  /** From the helper's start to the gate's verdict (design 4.6 row 4). */
  readonly streamLineMs: number;
  /** After the end of a helper on a device, before the next one starts on it (design 4.7). */
  readonly pauseMs: number;
  /** After the end of the guard's input: this long, then SIGTERM to the guard. Above the guard's own escalation (2,000 ms). */
  readonly stopGraceMs: number;
  /** After SIGTERM: this long, then SIGKILL to the guard. */
  readonly killGraceMs: number;
  /** A pre-check run (design 4.7: 8,000 ms on macOS). */
  readonly precheckTimeoutMs: number;
  /** A `FIFO queue full` line without `flushed` within this is a fault of the group (SM-35 (4)). */
  readonly queueFlushMs: number;
}

export const MACOS_AUDIO_LIMITS: MacosAudioLimits = Object.freeze({ settleMs: 1_500, streamLineMs: 3_000, pauseMs: 1_000, stopGraceMs: 3_000, killGraceMs: 2_000, precheckTimeoutMs: 8_000, queueFlushMs: 10_000 });

export interface UsbAudioMacosOptions {
  readonly devices: readonly CaptureDeviceEntry[];
  /** The stored row of a microphone, read at every open and launch; null when it has none. */
  readonly registered: (deviceId: string) => Promise<RegisteredAudioInput | null>;
  /** The listing of row N6 over the runner of row N7. Every call of `listTied` reads the host again. */
  readonly cards: MacosCardEnumerator;
  /** The helper program (`DEMS_CAPTURE_AUDIO_HELPER`): an absolute path of the configuration. */
  readonly helperProgram: string;
  /** The guard program (`DEMS_CAPTURE_GUARD`). The helper is started by it, never directly. */
  readonly guardProgram: string;
  /** `<dataDir>/run/capture`: the pipes of the sessions live below it. */
  readonly runDir: string;
  readonly timers: CaptureTimers;
  /** The reader the adapter holds on every pipe of a launch (see `MacosPipeKeeper`). */
  readonly pipes: MacosPipeKeeper;
  readonly limits?: Partial<MacosAudioLimits>;
  readonly door?: ProductionDoor;
  readonly inspect?: ProgramInspector;
  readonly files?: PipeFiles;
  readonly level?: (inputId: string) => number | null;
  /** Told once per microphone when its group's helper ends during a session, or its queue never flushes. */
  readonly onSourceLost?: (deviceId: string, error: UsbAudioError) => void;
  /** Told what is no refusal. The observer must not throw; a throw is dropped. */
  readonly onNotice?: (notice: MacosAudioNotice) => void;
}

/**
 * What the adapter states of the device behind ONE open input, for the session's source facts
 * (design 8.1, verbatim keys): the values of the listing (equal at the open and the launch, else
 * the launch is refused), `sampleBits` LEFT OUT as null (no list states it; the helper's float is
 * not the device's width), and the three keys of this path.
 */
export interface MacosAudioSourceStatement {
  readonly product: string;
  readonly usbId: string | null;
  readonly usbSerial: string | null;
  readonly usbPort: string | null;
  readonly cardId: string;
  readonly cardDevice: number;
  readonly inputNumber: number;
  readonly nativeChannels: number;
  readonly sampleRateHz: number;
  readonly sampleBits: null;
  readonly captureLayer: typeof MACOS_CAPTURE_LAYER;
  readonly sampleContinuity: typeof MACOS_SAMPLE_CONTINUITY;
  /** 1 or 2: microphones of one session with the same number were captured by ONE process from ONE device (design 6.2). */
  readonly captureGroup: number;
}

/**
 * What the reader of the helper's lines made of the launch, for the device run of row N15 (row
 * N8b's request): kinds, whole numbers and closed words of `HelperLinesState`, never a line. Null
 * until a launch of the input's group has read its first line.
 */
export type MacosLaunchReading = HelperLinesState;

export interface UsbAudioMacosStream extends AudioStreamHandle {
  start(signal?: AbortSignal): Promise<void>;
  started(): boolean;
  onLost(listener: (error: UsbAudioError) => void): () => void;
  /** The process id of the group's guard once launched, for the leftover check; null otherwise. */
  guardPid(): number | null;
  /** The input of the device the handle selects (numbered from 1). */
  readonly inputNumber: number;
}

export interface UsbAudioMacosAdapter extends AudioInputAdapter {
  open(inputId: string, target: AudioOpenTarget): Promise<UsbAudioMacosStream>;
  precheck(inputId: string, signal?: AbortSignal): Promise<UsbAudioError | AudioInputBeyondCardError | null>;
  sourceFacts(inputId: string): MacosAudioSourceStatement | null;
  /** The group of an open input: its number and whether its helper has ended (SM-34 (4): the switch is then refused with `MACOS_AUDIO_SENTENCES.GROUP_ENDED`). */
  groupOf(inputId: string): { readonly captureGroup: number; readonly helperEnded: boolean } | null;
  launchReading(inputId: string): MacosLaunchReading | null;
  openSources(): readonly string[];
  livePids(): ReadonlySet<number>;
  closeAll(): Promise<void>;
  admitDevice(entry: CaptureDeviceEntry): void;
  admittedDevices(): readonly CaptureDeviceEntry[];
}

interface Located {
  readonly stored: RegisteredAudioInput;
  readonly card: CaptureCard;
  readonly renamed: boolean;
}

interface Member {
  readonly deviceId: string;
  readonly located: Located;
  readonly pipePath: string;
  state: 'OPEN' | 'CLOSED';
  pipeRemoved: boolean;
  held: MacosHeldPipe | null;
  told: boolean;
  readonly listeners: Set<(error: UsbAudioError) => void>;
  /** The handle's own `close`, so that `closeAll` closes by every rule of it. */
  close: (() => Promise<void>) | null;
}

/** What the gate said of a start, or that lines were dropped before it could say it. */
type StartVerdict = MacosGateVerdict | { readonly verdict: 'DROPPED' };

/** One run of the pre-check: how it ended, what the gate made of its lines, and the count of its samples. */
interface PrecheckRun {
  readonly exit: ProductionExit;
  readonly verdict: StartVerdict;
  readonly state: HelperLinesState;
  readonly count: MacosSampleCount;
  readonly outcome: 'OTHER' | 'ENDED' | 'BOUND' | 'ABORTED';
}

/** Why a launch failed: one code and one word, the same for every microphone of it. */
interface LaunchRefusal {
  readonly code: UsbAudioRefusal;
  readonly detail: string;
}

interface Group {
  readonly key: string;
  readonly sessionId: string;
  readonly cardId: string;
  readonly number: number;
  readonly members: Member[];
  launch: Promise<LaunchRefusal | null> | null;
  running: ProductionProcess | null;
  stopping: boolean;
  helperEnded: boolean;
  /** The reader's fold of the launch's lines (no text), as it stands now. */
  reading: (() => HelperLinesState) | null;
  readonly abort: AbortController;
  cancelQueue: (() => void) | null;
  quietSaid: boolean;
}

const MIC_ID = /^MIC-[0-9]{2,}$/;
const abortedNow = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;
const identityText = (value: string | null | undefined): string | null => (typeof value === 'string' && value !== '' ? value : null);
/** The current rate the system list states for a card of this path: its one rate. */
const rateOf = (card: CaptureCard): number | null => (card.ratesHz.length === 1 ? (card.ratesHz[0] ?? null) : null);

/** The undecided device of the listing that carries the stored identity (row N6's request: the unchanged match answers CARD_ABSENT for it). */
function undecidedOf(undecided: readonly MacosUndecidedDevice[], stored: RegisteredAudioInput): MacosUndecidedDevice | null {
  const serial = identityText(stored.usbSerial);
  const port = identityText(stored.usbPort);
  if (stored.usbId === null || (serial === null && port === null)) return null;
  return undecided.find((device) => device.usbId === stored.usbId && (serial !== null ? identityText(device.usbSerial) === serial : identityText(device.usbPort) === port)) ?? null;
}

/** One listing as the loss watch of `darwin` reads it: the cards, and the devices that are connected and could not be tied. */
export interface MacosWatchedListing extends CardListing {
  readonly undecided: readonly MacosUndecidedDevice[];
}

/**
 * THE MATCH OF THE MICROPHONE LOSS WATCH ON `darwin` (row N10; review SM-06; DRIVER DECISION of its
 * record: shared AS CODE, as the Linux match is, so that `undecidedOf` has no twin). The unchanged
 * match on the listing's cards; where it finds no card, the undecided devices of the SAME listing: a
 * registered device that is connected and could not be tied is NOT absent (design 3.3) - it answers
 * `AUDIO_CARD_AMBIGUOUS` with the tie's reason, as `open` does, so the watch raises no
 * "disconnected" for it and the fence counts a pass that could not confirm the device. Pure.
 */
export function identifyMacosRegisteredCard(listing: MacosWatchedListing, stored: RegisteredAudioInput): CardIdentification | { readonly ok: false; readonly refusal: typeof UsbAudioRefusal.CARD_AMBIGUOUS; readonly detail: MacosUndecidedDevice['reason'] } {
  const found = identifyRegisteredCard(listing, stored);
  if (found.ok) return found;
  const undecided = undecidedOf(listing.undecided, stored);
  return undecided === null ? found : Object.freeze({ ok: false, refusal: UsbAudioRefusal.CARD_AMBIGUOUS, detail: undecided.reason });
}

/** Two cards of two listings are the same device in the same state: identity, tie, count and rate. The index is NOT compared (it is the launch's own). */
function sameDevice(a: CaptureCard, b: CaptureCard): boolean {
  return a.cardId === b.cardId && a.usbId === b.usbId && identityText(a.usbSerial) === identityText(b.usbSerial) && identityText(a.usbPort) === identityText(b.usbPort) && a.channelCount === b.channelCount && rateOf(a) === rateOf(b);
}

export function createUsbAudioMacosAdapter(options: UsbAudioMacosOptions): UsbAudioMacosAdapter {
  const limits: MacosAudioLimits = { ...MACOS_AUDIO_LIMITS, ...options.limits };
  const door = options.door ?? startProductionProcess;
  const inspect = options.inspect ?? inspectProgram;
  const files = options.files ?? createPipeFiles();
  const { timers, helperProgram, guardProgram, runDir } = options;
  const devices: readonly CaptureDeviceEntry[] = Object.freeze([...options.devices]);
  const admittedLater: CaptureDeviceEntry[] = [];
  const servedDevices = (): readonly CaptureDeviceEntry[] => [...devices, ...admittedLater];
  /** Open inputs: the member each one is. An input leaves when its handle closes, also while its pipe is still drained. */
  const members = new Map<string, { group: Group; member: Member }>();
  /** Groups by (session, device). A group leaves when its last handle has closed. */
  const groups = new Map<string, Group>();
  /** PER DEVICE (card id), not per session: the pause after the end of its last helper, while it runs. */
  const quiet = new Map<string, Promise<void>>();
  /** Per device: a pre-check that runs. A launch waits for it; a second pre-check is refused. */
  const prechecks = new Map<string, Promise<unknown>>();
  const processes = new Set<ProductionProcess>();

  const served = (inputId: string): void => {
    if (!servedDevices().some((entry) => entry.id === inputId)) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
  };

  /** Row 85d, by the shape of the Linux adapter: see `UsbAudioProductionAdapter.admitDevice`. Every refusal stands before the one change. */
  function admitDevice(entry: CaptureDeviceEntry): void {
    const given = entry as unknown as Readonly<Record<string, unknown>> | null;
    if (typeof given !== 'object' || given === null || typeof given['id'] !== 'string') throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
    const id = given['id'];
    if (given['deviceClass'] !== 'MIC' || !MIC_ID.test(id)) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_CLASS_MISMATCH);
    if (Object.hasOwn(given, 'adapterKind') && given['adapterKind'] !== CaptureAdapterKind.USB_AUDIO) throw new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_KIND_NOT_ALLOWED);
    if (Object.hasOwn(given, 'sourceClass') && given['sourceClass'] !== sourceClassOf(CaptureAdapterKind.USB_AUDIO)) throw new CaptureAdapterError(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED);
    const capabilities = given['capabilities'];
    const profiles = given['profiles'];
    if (typeof given['label'] !== 'string' || !Array.isArray(capabilities) || capabilities.length !== 1 || capabilities[0] !== 'AUDIO' || !Array.isArray(profiles) || profiles.length !== 0) {
      throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_CLASS_MISMATCH);
    }
    if (servedDevices().some((known) => known.id === id)) return;
    admittedLater.push(Object.freeze({ id, deviceClass: 'MIC' as const, label: given['label'], capabilities: Object.freeze(['AUDIO'] as const), profiles: Object.freeze([]) }));
  }

  const notice = (code: MacosAudioNoticeCode, deviceId: string): void => {
    try {
      options.onNotice?.(Object.freeze({ code, deviceId }));
    } catch {
      // An observer never changes what the adapter does.
    }
  };

  function assertPrograms(deviceId: string): void {
    const helper = helperProgramRefusal(inspect(helperProgram));
    if (helper !== null) throw new MacosUsbAudioError(UsbAudioRefusal.PROGRAM_REFUSED, deviceId, `HELPER_${helper}`);
    const guard = helperProgramRefusal(inspect(guardProgram));
    if (guard !== null) throw new MacosUsbAudioError(UsbAudioRefusal.PROGRAM_REFUSED, deviceId, `GUARD_${guard}`);
  }

  /** ONE listing of the host. An unreadable list is the listing's failure, never "no card" (row N6). */
  async function listNow(deviceId: string | null): Promise<Extract<MacosTiedListing, { ok: true }>> {
    let tied: MacosTiedListing;
    try {
      tied = await options.cards.listTied();
    } catch (error) {
      throw new MacosUsbAudioError(UsbAudioRefusal.LISTING_FAILED, deviceId, detailOf(error));
    }
    if (!tied.ok) throw new MacosUsbAudioError(UsbAudioRefusal.LISTING_FAILED, deviceId, tied.failure);
    return tied;
  }

  async function storedRow(deviceId: string): Promise<RegisteredAudioInput> {
    let row: RegisteredAudioInput | null;
    try {
      row = await options.registered(deviceId);
    } catch (error) {
      throw new MacosUsbAudioError(UsbAudioRefusal.INPUT_NOT_REGISTERED, deviceId, detailOf(error));
    }
    if (!isRegisteredAudioInput(row) || row.deviceId !== deviceId) throw new MacosUsbAudioError(UsbAudioRefusal.INPUT_NOT_REGISTERED, deviceId);
    return row;
  }

  /** The stored row matched to a card of ONE listing, with every refusal that needs no device. */
  function locateIn(tied: Extract<MacosTiedListing, { ok: true }>, stored: RegisteredAudioInput): Located {
    const found = identifyRegisteredCard(tied.listing, stored);
    if (!found.ok) {
      // A connected device that could not be tied is not "absent": the operator is told it is there and undecided (design 3.3).
      const undecided = undecidedOf(tied.undecided, stored);
      if (undecided !== null) throw new MacosUsbAudioError(UsbAudioRefusal.CARD_AMBIGUOUS, stored.deviceId, undecided.reason);
      throw new MacosUsbAudioError(found.refusal, stored.deviceId, found.detail);
    }
    const { card } = found;
    if (card.factsSource !== CardFactsSource.SYSTEM_PROFILE || !card.usb) throw new MacosUsbAudioError(UsbAudioRefusal.CARD_FACTS_UNKNOWN, stored.deviceId);
    if (stored.inputNumber > card.channelCount) throw new AudioInputBeyondCardError(stored.deviceId);
    // The system's own current rate. The helper's stream line is the second control (the gate); this one refuses before anything starts.
    if (rateOf(card) !== MACOS_MIC_RATE_HZ) throw new MacosUsbAudioError(UsbAudioRefusal.CARD_RATE_UNSUPPORTED, stored.deviceId, MacosAudioDetail.SYSTEM_STATES_OTHER_RATE);
    return { stored, card, renamed: found.renamed };
  }

  /** Waits for the pause of a device and for a pre-check on it; the caller's signal ends the wait. */
  async function turnOf(cardId: string, signal: AbortSignal | undefined): Promise<void> {
    for (;;) {
      const waiting = prechecks.get(cardId) ?? quiet.get(cardId);
      if (waiting === undefined) return;
      await new Promise<void>((resolve) => {
        const onAbort = (): void => resolve();
        signal?.addEventListener('abort', onAbort, { once: true });
        void waiting.then(
          () => resolve(),
          () => resolve(),
        );
      });
      if (abortedNow(signal)) return;
    }
  }

  /** The instant a helper of the device ended starts its pause (design 4.7; SM-39 (5)). */
  function ended(cardId: string): void {
    const pause = new Promise<void>((resolve) => timers.after(limits.pauseMs, resolve));
    quiet.set(cardId, pause);
    void pause.then(() => {
      if (quiet.get(cardId) === pause) quiet.delete(cardId);
    });
  }

  /**
   * THE ONE WAY a helper is stopped: the end of the guard's input, which the guard answers with
   * SIGTERM and, after its own bound, SIGKILL to the helper. The guard is signalled by this adapter
   * only past that bound.
   */
  async function stop(running: ProductionProcess, deviceIds: readonly string[]): Promise<void> {
    if (!running.alive()) return;
    running.endInput();
    const cancelTerm = timers.after(limits.stopGraceMs, () => {
      for (const deviceId of deviceIds) notice(MacosAudioNoticeCode.HELPER_SIGNALLED, deviceId);
      running.kill('SIGTERM');
    });
    const cancelKill = timers.after(limits.stopGraceMs + limits.killGraceMs, () => running.kill('SIGKILL'));
    await running.ended;
    cancelTerm();
    cancelKill();
  }

  /** The production door for the pipe maker: a short program, no start message, an empty environment. */
  const shortDoor: HelperDoor = (asked) => {
    const running = door({ command: asked.command, args: asked.args, env: {}, message: null, timers });
    return {
      get pid() {
        return running.pid;
      },
      ended: running.ended,
      alive: () => running.alive(),
      kill: (signal) => running.kill(signal),
    };
  };

  /** Starts one guarded helper and reads its lines through the gate. The caller decides what an outcome means. */
  function startGuarded(
    args: readonly string[],
    expectedIndex: number,
    gate: (state: HelperLinesState) => MacosGateVerdict,
    onOutput: ((chunk: Buffer) => void) | undefined,
    afterVerdict: (reading: ReturnType<typeof readHelperLine>) => void,
  ): { running: ProductionProcess; verdict: Promise<StartVerdict>; state(): HelperLinesState; dropped(): boolean; sayQuiet(listener: () => void): void } {
    let state = startHelperLines(expectedIndex);
    let decided = false;
    let droppedBefore = false;
    let quietListener: (() => void) | null = null;
    let settle: (verdict: StartVerdict) => void = () => {};
    const verdict = new Promise<StartVerdict>((resolve) => {
      settle = resolve;
    });
    const decide = (value: StartVerdict): void => {
      if (decided) return;
      decided = true;
      if (value.verdict === 'DROPPED') droppedBefore = true;
      settle(value);
    };
    const onDiagnostics = (event: ProductionDiagnosticsEvent): void => {
      if (event.kind === 'line') {
        // The text goes to the reader and nowhere else: what is kept is its fold.
        const reading = readHelperLine(state, { text: event.text, cut: event.cut });
        state = reading.state;
        if (!decided) {
          const judged = gate(state);
          if (judged.verdict !== 'WAIT') decide(judged);
        } else afterVerdict(reading);
        return;
      }
      // Lines the door did not hand on may have held a second statement: before the verdict that is no start to believe.
      if (!decided) decide({ verdict: 'DROPPED' });
      else if (event.kind === 'quiet') quietListener?.();
    };
    const running = door({ command: guardProgram, args: guardedArguments(helperProgram, args), env: {}, message: null, timers, onDiagnostics, ...(onOutput === undefined ? {} : { onOutput }) });
    processes.add(running);
    void running.ended.then(() => processes.delete(running));
    return {
      running,
      verdict,
      state: () => state,
      dropped: () => droppedBefore,
      sayQuiet: (listener) => {
        quietListener = listener;
      },
    };
  }

  /** Whichever comes first: `other` settled, the helper ended, the bound, the caller's signal. Every timer and listener it set is let go. */
  async function firstOf(running: ProductionProcess, boundMs: number | null, signal: AbortSignal | undefined, other: Promise<unknown> | null): Promise<'OTHER' | 'ENDED' | 'BOUND' | 'ABORTED'> {
    if (abortedNow(signal)) return 'ABORTED';
    return new Promise((resolve) => {
      let over = false;
      const done = (value: 'OTHER' | 'ENDED' | 'BOUND' | 'ABORTED'): void => {
        if (over) return;
        over = true;
        cancel();
        signal?.removeEventListener('abort', onAbort);
        resolve(value);
      };
      const cancel = boundMs === null ? () => {} : timers.after(boundMs, () => done('BOUND'));
      const onAbort = (): void => done('ABORTED');
      signal?.addEventListener('abort', onAbort, { once: true });
      void running.ended.then(() => done('ENDED'));
      if (other !== null) void other.then(() => done('OTHER'));
    });
  }

  const refusalOf = (code: UsbAudioRefusal, detail: string): LaunchRefusal => Object.freeze({ code, detail });

  /** The members of a launch, in the ascending order of their inputs: what the list's sections are made from. */
  const liveMembers = (group: Group): Member[] => group.members.filter((member) => member.state === 'OPEN').sort((a, b) => a.located.stored.inputNumber - b.located.stored.inputNumber);

  /** Tells every live handle of the group once that its microphone is lost. */
  function tellLost(group: Group, code: UsbAudioRefusal, detail: string): void {
    for (const member of group.members) {
      if (member.state !== 'OPEN' || member.told) continue;
      member.told = true;
      const lost = new MacosUsbAudioError(code, member.deviceId, detail);
      for (const listener of member.listeners) {
        try {
          listener(lost);
        } catch {
          // A listener never stops the others from being told.
        }
      }
    }
  }

  /** The queue lines of a live helper: notices, and the fault of a queue that never flushes (SM-35 (4)). */
  function queueLine(group: Group, kind: string): void {
    const ids = liveMembers(group).map((member) => member.deviceId);
    if (kind === 'QUEUE_FULL') {
      for (const id of ids) notice(MacosAudioNoticeCode.QUEUE_FULL, id);
      group.cancelQueue ??= timers.after(limits.queueFlushMs, () => {
        group.cancelQueue = null;
        if (group.stopping || group.helperEnded) return;
        for (const id of liveMembers(group).map((member) => member.deviceId)) notice(MacosAudioNoticeCode.QUEUE_NOT_FLUSHED, id);
        tellLost(group, UsbAudioRefusal.NO_SAMPLE, MacosAudioDetail.QUEUE_NOT_FLUSHED);
      });
    } else if (kind === 'QUEUE_FLUSHED') {
      for (const id of ids) notice(MacosAudioNoticeCode.QUEUE_FLUSHED, id);
      group.cancelQueue?.();
      group.cancelQueue = null;
    }
  }

  /**
   * THE ONE LAUNCH of a group (design 6.1, 3.3, 4.6, 4.7). Answers null when the helper lives and
   * every check passed, else the refusal of every microphone of the launch. It never throws.
   */
  async function launchGroup(group: Group, signal: AbortSignal): Promise<LaunchRefusal | null> {
    const launched = liveMembers(group);
    const ids = launched.map((member) => member.deviceId);
    const first = launched[0];
    if (first === undefined) return refusalOf(UsbAudioRefusal.ABORTED, NO_DETAIL);
    try {
      // The adapter's own reader on every pipe, BEFORE the helper exists: no reader can be the last one to close (C118 (1)).
      for (const member of launched) member.held = await options.pipes.hold(member.pipePath);
    } catch (error) {
      for (const member of launched) {
        member.held?.release();
        member.held = null;
      }
      return refusalOf(UsbAudioRefusal.PIPE_REFUSED, detailOf(error));
    }
    for (let attempt = 1; ; attempt += 1) {
      await turnOf(group.cardId, signal);
      if (abortedNow(signal)) return refusalOf(UsbAudioRefusal.ABORTED, NO_DETAIL);
      // THE SECOND LISTING: the device word is taken from it, and from no other (at a retry, from the retry's own).
      let launch: Extract<MacosTiedListing, { ok: true }>;
      let card: CaptureCard;
      try {
        launch = await listNow(first.deviceId);
        const now = launched.map((member) => locateIn(launch, member.located.stored));
        const [one] = now;
        if (one === undefined || now.some((located, at) => !sameDevice(located.card, one.card) || !sameDevice(located.card, launched[at]?.located.card ?? one.card))) return refusalOf(UsbAudioRefusal.CARD_MOVED, NO_DETAIL);
        card = one.card;
        assertPrograms(first.deviceId);
      } catch (error) {
        if (error instanceof UsbAudioError) return refusalOf(error.code, error.detail);
        if (error instanceof AudioInputBeyondCardError) return refusalOf(UsbAudioRefusal.CARD_MOVED, 'CHANNELS_DIFFER');
        throw error;
      }
      if (abortedNow(signal)) return refusalOf(UsbAudioRefusal.ABORTED, NO_DETAIL);
      let args: readonly string[];
      try {
        // ONE call per launch: the index of THIS listing, the live count, the stored inputs, the pipes and the registry ids. Integers and pipes only.
        args = macMicPushArguments({ audioIndex: card.cardIndex, channelCount: card.channelCount, sections: launched.map((member) => ({ inputNumber: member.located.stored.inputNumber, pipePath: member.pipePath, deviceId: member.deviceId })) });
      } catch (error) {
        return refusalOf(UsbAudioRefusal.ARGUMENT_REFUSED, detailOf(error));
      }
      const expected = { channelCount: card.channelCount, outputs: launched.length };
      const helper = startGuarded(args, card.cardIndex, (state) => judgeHelperStart(state, expected), undefined, (reading) => queueLine(group, reading.fact.kind));
      const { running } = helper;
      group.running = running;
      void running.ended.then(() => ended(group.cardId));
      try {
        await running.started;
      } catch (error) {
        await running.ended;
        return refusalOf(UsbAudioRefusal.HELPER_NOT_STARTED, detailOf(error));
      }
      group.reading = helper.state;
      const outcome = await firstOf(running, limits.streamLineMs, signal, helper.verdict);
      if (outcome === 'ENDED') {
        const exit = await running.ended;
        const state = helper.state();
        // The ONE retry (design 4.7): status 251, the refusal line, and no stream stated.
        const refusedOpen = exit.exitCode === HELPER_EXIT_STATUS_OPEN_REFUSED && state.counts.openRefused > 0 && state.stream === null;
        if (refusedOpen && attempt === 1) {
          for (const id of ids) notice(MacosAudioNoticeCode.OPEN_RETRIED, id);
          continue;
        }
        if (refusedOpen) return refusalOf(UsbAudioRefusal.HELPER_ENDED_AT_START, MacosAudioDetail.FORMAT_NOT_SUPPORTED);
        return refusalOf(exit.spawnFailed ? UsbAudioRefusal.HELPER_NOT_STARTED : UsbAudioRefusal.HELPER_ENDED_AT_START, detailOfExit(exit));
      }
      if (outcome === 'ABORTED' || outcome === 'BOUND') {
        await stop(running, ids);
        return outcome === 'ABORTED' ? refusalOf(UsbAudioRefusal.ABORTED, NO_DETAIL) : refusalOf(UsbAudioRefusal.HELPER_ENDED_AT_START, MacosAudioDetail.NO_STREAM_LINE);
      }
      const verdict = await helper.verdict;
      if (verdict.verdict === 'DROPPED') {
        await stop(running, ids);
        return refusalOf(UsbAudioRefusal.HELPER_ENDED_AT_START, MacosAudioDetail.LINES_DROPPED);
      }
      if (verdict.verdict === 'REFUSE') {
        await stop(running, ids);
        return refusalOf(verdict.code, verdict.detail);
      }
      // The gate passed. The settle time, then the THIRD listing (design 3.3): the same ordered list, identity, tie, rate and count.
      const settled = await firstOf(running, limits.settleMs, signal, null);
      if (settled === 'ENDED') return refusalOf(UsbAudioRefusal.HELPER_ENDED_AT_START, detailOfExit(await running.ended));
      if (settled === 'ABORTED') {
        await stop(running, ids);
        return refusalOf(UsbAudioRefusal.ABORTED, NO_DETAIL);
      }
      let third: Extract<MacosTiedListing, { ok: true }>;
      try {
        third = await listNow(first.deviceId);
        const again = launched.map((member) => locateIn(third, member.located.stored));
        const same = third.captureOrderMark === launch.captureOrderMark && third.captureEntries === launch.captureEntries && again.every((located) => sameDevice(located.card, card) && located.card.cardIndex === card.cardIndex);
        if (!same) throw new MacosUsbAudioError(UsbAudioRefusal.CARD_MOVED, first.deviceId, MacosAudioDetail.LIST_CHANGED);
      } catch (error) {
        await stop(running, ids);
        if (error instanceof UsbAudioError) return refusalOf(error.code === UsbAudioRefusal.LISTING_FAILED ? error.code : UsbAudioRefusal.CARD_MOVED, error.code === UsbAudioRefusal.LISTING_FAILED ? error.detail : MacosAudioDetail.LIST_CHANGED);
        return refusalOf(UsbAudioRefusal.CARD_MOVED, MacosAudioDetail.LIST_CHANGED);
      }
      if (!running.alive()) return refusalOf(UsbAudioRefusal.HELPER_ENDED_AT_START, detailOfExit(await running.ended));
      // It lives and every check passed. From here an end that nobody asked for is the loss of every microphone of the group.
      helper.sayQuiet(() => {
        if (group.quietSaid) return;
        group.quietSaid = true;
        for (const member of liveMembers(group)) notice(MacosAudioNoticeCode.DIAGNOSTICS_QUIET, member.deviceId);
      });
      void running.ended.then((exit) => {
        group.helperEnded = true;
        group.cancelQueue?.();
        group.cancelQueue = null;
        if (group.stopping) return;
        tellLost(group, UsbAudioRefusal.HELPER_EXITED, detailOfExit(exit));
      });
      return null;
    }
  }

  /** The end of a group: the helper stopped, then the adapter's readers let go, then the pipes removed. */
  async function endGroup(group: Group): Promise<void> {
    group.stopping = true;
    group.cancelQueue?.();
    group.cancelQueue = null;
    const running = group.running;
    if (running !== null) await stop(running, group.members.map((member) => member.deviceId));
    for (const member of group.members) {
      member.held?.release();
      member.held = null;
      if (!member.pipeRemoved) {
        member.pipeRemoved = true;
        if (!removePipe(files, member.pipePath)) notice(MacosAudioNoticeCode.PIPE_NOT_REMOVED, member.deviceId);
      }
    }
    if (groups.get(group.key) === group) groups.delete(group.key);
  }

  async function open(inputId: string, target: AudioOpenTarget): Promise<UsbAudioMacosStream> {
    served(inputId);
    if (target.signal.aborted) throw new MacosUsbAudioError(UsbAudioRefusal.ABORTED, inputId);
    if (members.has(inputId)) throw new MacosUsbAudioError(UsbAudioRefusal.ALREADY_OPEN, inputId);
    assertPrograms(inputId);
    const stored = await storedRow(inputId);
    const located = locateIn(await listNow(inputId), stored);
    if (target.signal.aborted) throw new MacosUsbAudioError(UsbAudioRefusal.ABORTED, inputId);
    // Checked again after every await: two opens of one session come one after the other, but nothing holds them to it.
    if (members.has(inputId)) throw new MacosUsbAudioError(UsbAudioRefusal.ALREADY_OPEN, inputId);
    const key = `${target.sessionId}\u0000${located.card.cardId}`;
    const existing = groups.get(key);
    // SM-34 (6): an output cannot be added to a running helper; the microphone joins at the next start of the session's microphones.
    if (existing !== undefined && existing.launch !== null) throw new MacosUsbAudioError(UsbAudioRefusal.ALREADY_OPEN, inputId, MacosAudioDetail.DEVICE_HELPER_RUNNING);
    const openInGroup = existing?.members.filter((member) => member.state === 'OPEN') ?? [];
    if (openInGroup.length >= 2 || openInGroup.some((member) => member.located.stored.inputNumber === stored.inputNumber)) {
      throw new MacosUsbAudioError(UsbAudioRefusal.ALREADY_OPEN, inputId, MacosAudioDetail.INPUT_REPEATED);
    }
    const sessionGroups = [...groups.values()].filter((group) => group.sessionId === target.sessionId);
    if (existing === undefined && sessionGroups.length >= 2) throw new MacosUsbAudioError(UsbAudioRefusal.ALREADY_OPEN, inputId, MacosAudioDetail.INPUT_REPEATED);
    const group: Group = existing ?? {
      key,
      sessionId: target.sessionId,
      cardId: located.card.cardId,
      // DRIVER DECISION: the group of the session's first open is 1 (the session opens the PRIMARY first); the other device's is 2.
      number: sessionGroups.some((other) => other.number === 1) ? 2 : 1,
      members: [],
      launch: null,
      running: null,
      stopping: false,
      helperEnded: false,
      reading: null,
      abort: new AbortController(),
      cancelQueue: null,
      quietSaid: false,
    };
    groups.set(key, group);
    // The input is claimed in this turn, before the pipe is made.
    const listeners = new Set<(error: UsbAudioError) => void>();
    const placeholder: Member = { deviceId: inputId, located, pipePath: '', state: 'OPEN', pipeRemoved: true, held: null, told: false, listeners, close: null };
    members.set(inputId, { group, member: placeholder });
    let pipePath: string;
    try {
      pipePath = await preparePipe({ runDir, sessionId: target.sessionId, deviceId: inputId, files, door: shortDoor, timers, inspector: inspect });
    } catch (error) {
      members.delete(inputId);
      if (group.members.length === 0 && groups.get(key) === group) groups.delete(key);
      throw new MacosUsbAudioError(UsbAudioRefusal.PIPE_REFUSED, inputId, detailOf(error));
    }
    if (group.launch !== null || target.signal.aborted) {
      // The group launched (or the caller gave up) while the pipe was made: this input does not join it.
      removePipe(files, pipePath);
      members.delete(inputId);
      if (group.members.length === 0 && groups.get(key) === group) groups.delete(key);
      throw target.signal.aborted ? new MacosUsbAudioError(UsbAudioRefusal.ABORTED, inputId) : new MacosUsbAudioError(UsbAudioRefusal.ALREADY_OPEN, inputId, MacosAudioDetail.DEVICE_HELPER_RUNNING);
    }
    const member: Member = { deviceId: inputId, located, pipePath, state: 'OPEN', pipeRemoved: false, held: null, told: false, listeners, close: null };
    group.members.push(member);
    members.set(inputId, { group, member });
    if (located.renamed) notice(MacosAudioNoticeCode.CARD_RENAMED, inputId);
    if (located.card.channelCount !== stored.nativeChannels) notice(MacosAudioNoticeCode.CARD_CHANNELS_DIFFER, inputId);

    let startCalled = false;
    let closing: Promise<void> | null = null;
    const stream: UsbAudioMacosStream = {
      deviceId: inputId,
      // The gapped pipe kind, the protocol's member (see `MACOS_MIC_TRANSPORT`).
      input: Object.freeze({ kind: MACOS_MIC_TRANSPORT.kind, path: pipePath }),
      transport: MACOS_MIC_TRANSPORT,
      inputNumber: stored.inputNumber,
      started: () => startCalled,
      guardPid: () => group.running?.pid ?? null,
      onLost(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },

      async start(signal) {
        if (closing !== null || abortedNow(signal)) throw new MacosUsbAudioError(UsbAudioRefusal.ABORTED, inputId);
        if (startCalled) throw new MacosUsbAudioError(UsbAudioRefusal.ALREADY_OPEN, inputId);
        startCalled = true;
        // THE FIRST start of the group launches; every later one joins that launch.
        if (group.launch === null) {
          if (signal !== undefined) signal.addEventListener('abort', () => group.abort.abort(), { once: true });
          group.launch = launchGroup(group, group.abort.signal);
          void group.launch.then((refusal) => {
            if (refusal === null) return;
            group.helperEnded = true;
            // A launch that failed holds no reader and no helper (the helper was stopped and has ended).
            for (const each of group.members) {
              each.held?.release();
              each.held = null;
            }
          });
        }
        const refusal = await group.launch;
        if (refusal !== null) throw new MacosUsbAudioError(closing !== null ? UsbAudioRefusal.ABORTED : refusal.code, inputId, closing !== null ? NO_DETAIL : refusal.detail);
        if (closing !== null) throw new MacosUsbAudioError(UsbAudioRefusal.ABORTED, inputId);
      },

      close() {
        closing ??= (async () => {
          member.state = 'CLOSED';
          listeners.clear();
          if (members.get(inputId)?.member === member) members.delete(inputId);
          const live = group.members.filter((each) => each.state === 'OPEN');
          if (group.launch !== null && live.length === 0) group.abort.abort();
          if (group.launch !== null) await group.launch;
          if (live.length > 0) {
            if (group.running !== null && group.running.alive() && !group.helperEnded) {
              // The helper records for the other handle: this pipe stays, read by the adapter and dropped (C118 (1)).
              member.held?.drain();
              return;
            }
            // No helper writes into it: the pipe can go now.
            member.held?.release();
            member.held = null;
            member.pipeRemoved = true;
            if (!removePipe(files, member.pipePath)) notice(MacosAudioNoticeCode.PIPE_NOT_REMOVED, inputId);
            return;
          }
          await endGroup(group);
        })();
        return closing;
      },
    };
    const frozen = Object.freeze(stream);
    member.close = () => frozen.close();
    frozen.onLost((error) => options.onSourceLost?.(inputId, error));
    return frozen;
  }

  /** One pre-check run of the helper: answers the exit, the gate's verdict and the count. */
  async function precheckRun(located: Located, signal: AbortSignal | undefined): Promise<PrecheckRun | LaunchRefusal> {
    let args: readonly string[];
    try {
      // ONE call per pre-check run (and once more for its one retry): the index of THIS listing, the live count, the stored input.
      args = macMicPrecheckArguments({ audioIndex: located.card.cardIndex, channelCount: located.card.channelCount, inputNumber: located.stored.inputNumber, deviceId: located.stored.deviceId });
    } catch (error) {
      if (error instanceof AudioInputBeyondCardError) throw error;
      return refusalOf(UsbAudioRefusal.ARGUMENT_REFUSED, detailOf(error));
    }
    // The selected channel arrives on standard output: counted here, in memory, and dropped (SR-15 (3)).
    const counter = createSampleCounter();
    const expected = { channelCount: located.card.channelCount, outputs: 1 };
    const helper = startGuarded(args, located.card.cardIndex, (state) => judgeHelperStart(state, expected), (chunk) => counter.push(chunk), () => {});
    const { running } = helper;
    void running.ended.then(() => ended(located.card.cardId));
    try {
      await running.started;
    } catch (error) {
      await running.ended;
      return refusalOf(UsbAudioRefusal.HELPER_NOT_STARTED, detailOf(error));
    }
    // A refusal of the gate stops the run at once; a pass lets it end by itself after its one second.
    const refused = helper.verdict.then((verdict) => (verdict.verdict === 'PASS' ? new Promise<never>(() => {}) : verdict));
    const outcome = await firstOf(running, limits.precheckTimeoutMs, signal, refused);
    if (outcome !== 'ENDED') await stop(running, [located.stored.deviceId]);
    const exit = await running.ended;
    // The door tells every line before `ended` settles: the fold is final here.
    const state = helper.state();
    const verdict: StartVerdict = helper.dropped() ? { verdict: 'DROPPED' } : judgeHelperStart(state, expected);
    return { exit, verdict, state, count: counter.count(), outcome };
  }

  async function precheck(inputId: string, signal?: AbortSignal): Promise<UsbAudioError | AudioInputBeyondCardError | null> {
    served(inputId);
    try {
      if (abortedNow(signal)) return new MacosUsbAudioError(UsbAudioRefusal.ABORTED, inputId);
      assertPrograms(inputId);
      const stored = await storedRow(inputId);
      let located = locateIn(await listNow(inputId), stored);
      const cardId = located.card.cardId;
      // Two helpers cannot hold one device (MF13): not beside a group that launched, and not beside another pre-check.
      if ([...groups.values()].some((group) => group.cardId === cardId && group.launch !== null && !group.helperEnded) || prechecks.has(cardId)) {
        return new MacosUsbAudioError(UsbAudioRefusal.ALREADY_OPEN, inputId, MacosAudioDetail.DEVICE_HELPER_RUNNING);
      }
      let finish: () => void = () => {};
      prechecks.set(
        cardId,
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
      try {
        for (let attempt = 1; ; attempt += 1) {
          await turnOfQuiet(cardId, signal);
          if (abortedNow(signal)) return new MacosUsbAudioError(UsbAudioRefusal.ABORTED, inputId);
          if (attempt > 1) located = locateIn(await listNow(inputId), stored);
          const run = await precheckRun(located, signal);
          if (!('exit' in run)) return new MacosUsbAudioError(run.code, inputId, run.detail);
          if (run.outcome === 'ABORTED') return new MacosUsbAudioError(UsbAudioRefusal.ABORTED, inputId);
          if (run.outcome === 'BOUND') return new MacosUsbAudioError(UsbAudioRefusal.PRECHECK_TIMEOUT, inputId);
          const refusedOpen = run.exit.exitCode === HELPER_EXIT_STATUS_OPEN_REFUSED && run.state.counts.openRefused > 0 && run.state.stream === null;
          if (refusedOpen && attempt === 1) {
            notice(MacosAudioNoticeCode.OPEN_RETRIED, inputId);
            continue;
          }
          if (refusedOpen) return new MacosUsbAudioError(UsbAudioRefusal.HELPER_ENDED_AT_START, inputId, MacosAudioDetail.FORMAT_NOT_SUPPORTED);
          // The gate on what the helper said of the input and the output, whatever the exit.
          const { verdict } = run;
          if (verdict.verdict === 'DROPPED') return new MacosUsbAudioError(UsbAudioRefusal.HELPER_ENDED_AT_START, inputId, MacosAudioDetail.LINES_DROPPED);
          if (verdict.verdict === 'REFUSE') return new MacosUsbAudioError(verdict.code, inputId, verdict.detail);
          if (run.exit.spawnFailed) return new MacosUsbAudioError(UsbAudioRefusal.HELPER_NOT_STARTED, inputId, detailOfExit(run.exit));
          if (verdict.verdict === 'WAIT') return new MacosUsbAudioError(UsbAudioRefusal.HELPER_ENDED_AT_START, inputId, run.exit.exitCode === 0 ? MacosAudioDetail.NO_STREAM_LINE : detailOfExit(run.exit));
          if (run.exit.exitCode !== 0) return new MacosUsbAudioError(UsbAudioRefusal.HELPER_ENDED_AT_START, inputId, detailOfExit(run.exit));
          // AT LEAST ONE NON-ZERO SAMPLE (design 4.6; SM-14): judged for one sample, never against 48,000.
          if (run.count.samples === 0) return new MacosUsbAudioError(UsbAudioRefusal.HELPER_ENDED_AT_START, inputId, MacosAudioDetail.NO_SAMPLE);
          if (run.count.nonZero === 0) return new MacosUsbAudioError(UsbAudioRefusal.HELPER_ENDED_AT_START, inputId, MacosAudioDetail.INPUT_SILENT);
          return null;
        }
      } finally {
        prechecks.delete(cardId);
        finish();
      }
    } catch (error) {
      if (error instanceof UsbAudioError || error instanceof AudioInputBeyondCardError) return error;
      throw error;
    }
  }

  /** The pause of a device only (a pre-check holds the device's turn itself). */
  async function turnOfQuiet(cardId: string, signal: AbortSignal | undefined): Promise<void> {
    for (let waiting = quiet.get(cardId); waiting !== undefined && !abortedNow(signal); waiting = quiet.get(cardId)) {
      const current = waiting;
      await new Promise<void>((resolve) => {
        signal?.addEventListener('abort', () => resolve(), { once: true });
        void current.then(() => resolve());
      });
    }
  }

  return {
    seam: 'AUDIO',
    kind: CaptureAdapterKind.USB_AUDIO,
    devices,
    hasOpener: true,

    /** One listing for all served microphones. It opens no device and starts no helper. */
    async enumerate(): Promise<AudioInputDescriptor[]> {
      let tied: Extract<MacosTiedListing, { ok: true }> | null = null;
      try {
        tied = await listNow(null);
      } catch (error) {
        if (!(error instanceof UsbAudioError)) throw error;
      }
      const answers: AudioInputDescriptor[] = [];
      for (const entry of servedDevices()) {
        let errorCode: AudioInputErrorCode | null = tied === null ? AudioInputErrorCode.OPEN_FAILED : null;
        if (tied !== null) {
          try {
            locateIn(tied, await storedRow(entry.id));
          } catch (error) {
            if (error instanceof UsbAudioError) errorCode = error.wireCode;
            else if (error instanceof AudioInputBeyondCardError) errorCode = AudioInputErrorCode.OPEN_FAILED;
            else throw error;
          }
        }
        answers.push({ inputId: entry.id, present: errorCode === null, errorCode });
      }
      return answers;
    },

    open,

    async level(inputId: string): Promise<number | null> {
      served(inputId);
      const reading = options.level?.(inputId) ?? null;
      return typeof reading === 'number' && Number.isFinite(reading) ? Math.min(reading, 0) : null;
    },

    precheck,

    sourceFacts(inputId: string): MacosAudioSourceStatement | null {
      const held = members.get(inputId);
      if (held === undefined || held.member.pipePath === '') return null;
      const { card, stored } = held.member.located;
      return Object.freeze({
        product: card.product,
        usbId: card.usbId,
        usbSerial: identityText(card.usbSerial),
        usbPort: identityText(card.usbPort),
        cardId: card.cardId,
        cardDevice: card.deviceIndex,
        inputNumber: stored.inputNumber,
        nativeChannels: card.channelCount,
        sampleRateHz: MACOS_MIC_RATE_HZ,
        sampleBits: null,
        captureLayer: MACOS_CAPTURE_LAYER,
        sampleContinuity: MACOS_SAMPLE_CONTINUITY,
        captureGroup: held.group.number,
      });
    },

    groupOf(inputId: string) {
      const held = members.get(inputId);
      return held === undefined ? null : Object.freeze({ captureGroup: held.group.number, helperEnded: held.group.helperEnded });
    },

    launchReading(inputId: string): MacosLaunchReading | null {
      const reading = members.get(inputId)?.group.reading;
      return reading === undefined || reading === null ? null : reading();
    },

    openSources: () => [...members.entries()].filter(([, held]) => held.member.pipePath !== '').map(([id]) => id).sort(),
    livePids: () => new Set([...processes].filter((running) => running.alive()).map((running) => running.pid).filter((pid): pid is number => pid !== null)),
    /** The shutdown hook: every open handle is closed by its own `close`; the last close of a group ends it. */
    async closeAll() {
      const open = [...groups.values()].flatMap((group) => group.members).filter((member) => member.state === 'OPEN' && member.close !== null);
      await Promise.all(open.map((member) => member.close?.()));
    },
    admitDevice,
    admittedDevices: () => Object.freeze([...admittedLater]),
  };
}
