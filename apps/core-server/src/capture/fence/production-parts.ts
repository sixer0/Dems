/**
 * THE CAPTURE UNIT'S OWN PARTS OF PRODUCTION CAPTURE (task 4 row 85b; decision C55).
 *
 * The composition of production capture stands ABOVE the modules (`src/capture-composition.ts`) and
 * may not reach into the adapter layer: its importers are a closed list (static rule A-5), and the
 * fence is on it. This file is what the fence offers that composition - each part made from the
 * capture unit's own files, with everything of the host INJECTED:
 *
 *   - the binding of the destination rule for a STORED camera address (AD-02), on the network
 *     facts an injected reader answers. No reader, no answer or a reader that throws: the facts of
 *     a host of which nothing is known, on which the rule refuses every address. This file states
 *     no admission of its own - what the binding returns is the rule's answer, unchanged;
 *   - the card enumerator of the host: the product's reader where the platform has one AND the
 *     text of the listing program is handed in, else an enumerator that says why and lists nothing;
 *   - the production door and the locator read of the ONVIF session, as the production camera
 *     adapter takes them;
 *   - a stored camera row as the candidate the ONVIF session takes.
 *
 * Since task 4 row 85c (decision C60 (3)) also:
 *
 *   - THE RUNNER OF THE CARD LISTING PROGRAM: the fixed row of the helper table (one program, one
 *     argument, no parameter) handed to the production door, its text handed back to the reader;
 *   - THE FAULT SINK OF THE TWO WATCHES (decision C60 (2)): a watch raises its fault and clears
 *     only the fault it raised itself - never one another part raised, never one without its cause;
 *   - the stored facts of a production device beyond its label (its profile list; its capability).
 *
 * Since task 4 row N7 (masterplan/06 revision 3 sections 2.2, 2.3, 3.3; review SM-10, SM-21) also:
 *
 *   - THE PLATFORM SEAM OF THE CARD LISTING: `linux` the reader of the sound directory (unchanged),
 *     `darwin` the listing of a macOS host (three fixed rows of the helper table - the USB tree in
 *     its property-list form, the system's audio list, the capture program's own device list - read
 *     by the strict readers of row N6), any other platform the named "not available" answer. The
 *     platform is the one the entry point states; no key of the configuration chooses a reader.
 *
 * It builds no adapter, names no built adapter file (static rule A-9), registers nothing, opens no
 * socket, reads no file but the facts of the path rule on the configured audio helper (ownership
 * and mode bits, before every start of the device-list row), no environment and no clock, and it
 * does not log. It starts no process itself: the programs it knows are started by the door it is
 * handed, each with its table's row.
 */
import { CaptureWarningCode, CaptureWarningReason } from '@dems/capture-protocol';
import { createCardEnumerator, type CardEnumerator } from '../adapters/audio/card-listing';
import { createCardListingReader, type CardListingPrograms } from '../adapters/audio/card-listing-reader';
import { MacosCardListingError, createMacosCardEnumerator, type MacosCardEnumerator, type MacosListingSource, type MacosTiedListing } from '../adapters/audio/macos-card-listing';
import { MACOS_USB_TREE_TEXT_BYTES } from '../adapters/audio/macos-plist';
import { helperProgramRefusal } from '../adapters/local/helper-program';
import { MACOS_LISTING_HELPER_TABLE, MACOS_SYSTEM_AUDIO_PROGRAM, MACOS_USB_TREE_PROGRAM, macMicDeviceListArguments, macSystemAudioArguments, macUsbTreeArguments } from '../adapters/local/mic-helper-args';
import { inspectProgram, type ProgramInspector } from '../adapters/local/process-door';
import { createOnvifNetworkSetter, type OnvifNetworkSetResult } from '../adapters/camera/onvif-network';
import { createOnvifStreamLocator, createOnvifTimeReader, type OnvifStreamLocator } from '../adapters/camera/onvif-session';
import { storedCameraCandidate, type StoredCameraAddressRule } from '../adapters/camera/stored-address';
import { CaptureAdapterKind, CaptureOperation } from '../adapters/kinds';
import { LINUX_CARD_LISTING_PROGRAM, linuxCardListingArguments } from '../adapters/local/mic-helper-args';
import { LINUX_ECHO_PROGRAM, LINUX_NEIGHBOUR_PROGRAM, linuxEchoArguments, linuxNeighbourArguments } from '../adapters/local/mic-helper-args';
import { PRODUCTION_OUTPUT_CAP_BYTES, startProductionProcess, type ProductionDoor } from '../adapters/production-door';
import type { CameraCandidate, CaptureCapability, CaptureDeviceEntry } from '../adapters/types';
import type { SealedCredential } from '../adapters/credential';
import { DestinationPurpose, decideDestination, type DestinationContext, type DestinationDecision } from '../destination-rule';
import { decideNewCameraAddress, type NewCameraAddress, type NewCameraAddressContext, type NewCameraAddressDecision, type NewCameraAddressRequest } from '../destination-rule';
import type { CaptureTimers } from '../types';

export type { CameraCandidate, CardEnumerator, CardListingPrograms, DestinationContext, MacosCardEnumerator, MacosListingSource, MacosTiedListing, OnvifStreamLocator, ProductionDoor, ProgramInspector, StoredCameraAddressRule };

/** True for the one capture operation production capture is composed in. */
export const isProductionCaptureOperation = (operation: CaptureOperation): boolean => operation === CaptureOperation.REAL_PRODUCTION;

// ── The destination rule on a stored camera address ────────────────────────────────────────────

/** The host's network facts as the rule takes them, or null: not configured. Read at EVERY judgement; it must not block. */
export type CaptureNetworkFactsReader = () => DestinationContext | null;

/** The facts of a host of which nothing is known. The rule refuses every address on them (`NOT_CONFIGURED`, after the class of the address). */
const HOST_NOT_CONFIGURED: DestinationContext = Object.freeze({ cameraSubnet: null, cameraAddresses: Object.freeze([]), otherInterfaceSubnets: Object.freeze([]), hostAddresses: Object.freeze([]) });

/**
 * THE BINDING. `decideDestination` with the purpose `STORED_CAMERA` on what the injected reader
 * answers NOW. `unreadable` is told when the reader threw; nothing of what was thrown travels.
 */
export function storedCameraAddressRuleOf(network: CaptureNetworkFactsReader | undefined, unreadable?: () => void): StoredCameraAddressRule {
  return (host, port) => {
    let facts: DestinationContext | null = null;
    if (network !== undefined) {
      try {
        facts = network();
      } catch {
        facts = null;
        unreadable?.();
      }
    }
    return decideDestination({ purpose: DestinationPurpose.STORED_CAMERA, address: host, ...(port === undefined ? {} : { port }) }, facts ?? HOST_NOT_CONFIGURED);
  };
}

/** The destination rule for ONE address the technician typed (operation 93): the rule's own answer, as it came. */
export type TypedProbeRule = (address: string) => DestinationDecision;

/**
 * THE BINDING FOR A TYPED ADDRESS (integration pass I-9a; records 095 and 096). `decideDestination`
 * with the purpose `TYPED_PROBE` - the rule kind record 095 names for it: held to the configured
 * camera subnet, never an alias - on what the SAME injected reader answers NOW. No reader, a reader
 * that answers nothing or one that throws: the facts of a host of which nothing is known, and every
 * address is refused. `unreadable` is told when the reader threw; nothing of what was thrown travels.
 */
export function typedProbeRuleOf(network: CaptureNetworkFactsReader | undefined, unreadable?: () => void): TypedProbeRule {
  return (address) => {
    let facts: DestinationContext | null = null;
    if (network !== undefined) {
      try {
        facts = network();
      } catch {
        facts = null;
        unreadable?.();
      }
    }
    return decideDestination({ purpose: DestinationPurpose.TYPED_PROBE, address }, facts ?? HOST_NOT_CONFIGURED);
  };
}

// ── The commissioning scan and the alias of the camera port (task 4 row 106b; decisions C74, C78) ──

/**
 * THE ALIAS FOLDER OF THE CAPTURE UNIT, as far as the composition of production capture and the
 * routes of operations 104 / 105 take it (the capture unit is closed: this index is their one way
 * in). The lifecycle is MADE by the composition, once per app; the plain read of the state is what
 * operation 104 answers on every Core; the port of a job is what the scan (and the set-IP job of
 * row 111) is handed.
 */
export {
  HostAliasLifecycleRefusal,
  aliasCandidatesOfConfiguration,
  createHostAliasLifecycle,
  hostAliasInterfaceFileSourceOf,
  hostAliasJobPortOf,
  readHostAliasState,
  type HostAliasFactSources,
  type HostAliasHost,
  type HostAliasJobPort,
  type HostAliasLifecycle,
  type HostAliasRecord,
  type HostAliasReleased,
  type HostAliasSweepReport,
  type HostAliasTransport,
} from '../host-alias';

/** The destination rule for ONE address of a commissioning scan, on the facts THE SCAN states: the rule's own answer, as it came. */
export type FactoryScanRuleBinding = (address: string, facts: DestinationContext) => DestinationDecision;

/**
 * THE BINDING FOR THE COMMISSIONING SCAN (operation 103; request line `row 107`, (a); S13-11).
 * `decideDestination` with the purpose `COMMISSIONING_SCAN`. Unlike the two bindings above it takes
 * the facts as an argument: the scan judges every address twice - once with ONE alias address
 * supposed, once on what the host states after the helper said "in place" - and states both. This
 * file states no admission of its own.
 */
export function factoryScanRuleOf(): FactoryScanRuleBinding {
  return (address, facts) => decideDestination({ purpose: DestinationPurpose.COMMISSIONING_SCAN, address }, facts);
}

/** An address the rule admitted, as the scan hands it on unchanged: where to ask, and the source the rule named. */
export interface FactoryScanProbeTarget {
  readonly address: string;
  readonly port: number;
  readonly sourceAddress?: unknown;
}

const SCAN_NOT_ANSWERED = Object.freeze({ answered: false, onvifReachable: false });
/** The rule's default port: a stored address of that port is written without it. */
const ONVIF_DEFAULT_PORT = 80;

/**
 * THE SCAN'S OWN PROBE CALL in production (request line `row 107`, (c)): the UNAUTHENTICATED clock
 * read of the ONVIF session - one request, no credential, no device text in the answer - made FROM
 * the source address the rule named. A target without a source, or of another form than a stored
 * address, is not asked. Never the camera search (static rule G-R13).
 */
export function factoryScanProbeOf(timers: CaptureTimers): (destination: FactoryScanProbeTarget, signal: AbortSignal) => Promise<{ readonly answered: boolean; readonly onvifReachable: boolean }> {
  const reader = createOnvifTimeReader({ timers });
  return async (destination, signal) => {
    const from = destination.sourceAddress;
    const stored = destination.port === ONVIF_DEFAULT_PORT ? destination.address : `${destination.address}:${String(destination.port)}`;
    const candidate = storedCameraCandidate({ adapterKind: CaptureAdapterKind.ONVIF_RTSP, address: stored, endpointRef: null });
    if (candidate === null || typeof from !== 'string') return SCAN_NOT_ANSWERED;
    const { answered } = await reader.read(candidate, signal, from);
    return Object.freeze({ answered, onvifReachable: answered });
  };
}

// ── The set-IP job (task 4 row 111; decisions C1, C7; S13-04, S13-11, S13-12 (d)) ───────────────

export type { NewCameraAddress, NewCameraAddressContext, NewCameraAddressDecision, NewCameraAddressRequest, OnvifNetworkSetResult };

/** The destination rule for ONE address the set-IP job dials, on the facts THE JOB states: the rule's own answer, as it came. */
export type CameraNetworkDialRule = (address: string, facts: DestinationContext) => DestinationDecision;

/**
 * THE BINDING FOR THE SET-IP JOB (operation 106; record 095: only the scan and this job may dial
 * from an alias). `decideDestination` with the purpose `SET_IP`, the facts as an argument: the job
 * judges the camera's present address with ONE alias address supposed and again on what the host
 * states once the helper said "in place", and the NEW address from the camera port's own address.
 */
export function cameraNetworkDialRuleOf(): CameraNetworkDialRule {
  return (address, facts) => decideDestination({ purpose: DestinationPurpose.SET_IP, address }, facts);
}

/** THE RULE OF THE ADDRESS A CAMERA IS GIVEN (`decideNewCameraAddress`): the rule's own function, handed on. */
export function cameraNewAddressRuleOf(): (request: NewCameraAddressRequest, context: NewCameraAddressContext) => NewCameraAddressDecision {
  return (request, context) => decideNewCameraAddress(request, context);
}

/**
 * THE UNAUTHENTICATED POLL of the set-IP job (S13-04 (a)): the clock read of the ONVIF session, one
 * request, NO credential in its reach, made FROM the source address the rule named. A target
 * without a source, or of another form than a stored address, is not asked.
 */
export function cameraNetworkPollOf(timers: CaptureTimers): (destination: FactoryScanProbeTarget, signal: AbortSignal) => Promise<{ readonly answered: boolean }> {
  const reader = createOnvifTimeReader({ timers });
  return async (destination, signal) => {
    const from = destination.sourceAddress;
    const stored = destination.port === ONVIF_DEFAULT_PORT ? destination.address : `${destination.address}:${String(destination.port)}`;
    const candidate = storedCameraCandidate({ adapterKind: CaptureAdapterKind.ONVIF_RTSP, address: stored, endpointRef: null });
    if (candidate === null || typeof from !== 'string') return Object.freeze({ answered: false });
    const { answered } = await reader.read(candidate, signal, from);
    return Object.freeze({ answered });
  };
}

/** ONE set call of the set-IP job. The credential is a parameter of this call and is kept by nothing here. */
export interface CameraNetworkSetCall {
  /** The camera's present address, as the rule rebuilt it. */
  readonly address: string;
  /** The facts of the host the job read for THIS call. */
  readonly facts: DestinationContext;
  /** What `decideNewCameraAddress` made. */
  readonly assignment: NewCameraAddress;
  readonly credential: SealedCredential;
  /** The job's judgement of the hardware address the device reports BEFORE the set: false sends no set request. */
  readonly admitHwAddress: (reported: string | null) => boolean;
  readonly signal: AbortSignal;
}

/**
 * THE SET CALL of the set-IP job: the set-network file (row 110), with the destination rule of the
 * job standing before every request - the file dials the address THE RULE returns for the camera's
 * present address on the facts handed in, from the source it names - and the job's judgement of
 * the reported hardware address standing between the interface read and the set. `rule` is the
 * binding above; a test under `test/` hands in its own (AD-02 (2): no permissive value lives here).
 * It rejects only before any request (an aborted signal; an address that is no stored form).
 */
export function cameraNetworkSetterOf(timers: CaptureTimers, rule: CameraNetworkDialRule = cameraNetworkDialRuleOf()): (call: CameraNetworkSetCall) => Promise<OnvifNetworkSetResult> {
  return (call) => {
    const candidate = storedCameraCandidate({ adapterKind: CaptureAdapterKind.ONVIF_RTSP, address: call.address, endpointRef: null });
    if (candidate === null) return Promise.reject(new Error('the present address of the camera is not of the stored form: nothing was sent'));
    return createOnvifNetworkSetter({ timers, destination: (host) => rule(host, call.facts), admitHwAddress: call.admitHwAddress }).setAddress(candidate, call.assignment, call.credential, call.signal);
  };
}

/** THE CAMERA of the set-IP job, as the composition of production capture hands it in: the two rules and the two calls above, each the product's. */
export function cameraNetworkCameraOf(timers: CaptureTimers) {
  return Object.freeze({ rule: cameraNetworkDialRuleOf(), newAddress: cameraNewAddressRuleOf(), poll: cameraNetworkPollOf(timers), set: cameraNetworkSetterOf(timers) });
}

// ── The card enumerator ────────────────────────────────────────────────────────────────────────

/** `code` of a card listing that cannot be read on this host. */
export const AUDIO_CARD_LISTING_NOT_AVAILABLE = 'AUDIO_CARD_LISTING_NOT_AVAILABLE';

/** Why: the `reason` of that code. */
export const CardListingUnavailable = {
  /** The sound directory of the kernel is read on Linux only. */
  NOT_AVAILABLE_ON_THIS_PLATFORM: 'NOT_AVAILABLE_ON_THIS_PLATFORM',
  /** The text of the listing program was not handed in: no runner of that program is wired. */
  LISTING_PROGRAM_NOT_HANDED_IN: 'LISTING_PROGRAM_NOT_HANDED_IN',
} as const;
export type CardListingUnavailable = (typeof CardListingUnavailable)[keyof typeof CardListingUnavailable];

/** A code, a reason of the closed set and a fixed sentence. */
export class CardListingNotAvailableError extends Error {
  readonly code: typeof AUDIO_CARD_LISTING_NOT_AVAILABLE = AUDIO_CARD_LISTING_NOT_AVAILABLE;
  readonly reason: CardListingUnavailable;
  constructor(reason: CardListingUnavailable) {
    super('the card listing is not available on this host');
    this.name = 'CardListingNotAvailableError';
    this.reason = reason;
  }
}

/** The platform whose sound directory the card listing reader reads. */
export const CARD_LISTING_PLATFORM = 'linux';

/** An enumerator that lists nothing and says why: its `list` rejects with the named code and the reason. No card is ever made up. */
export function unavailableCardEnumerator(reason: CardListingUnavailable): CardEnumerator {
  return Object.freeze({
    async list(): Promise<never> {
      throw new CardListingNotAvailableError(reason);
    },
  });
}

/** The enumerator of this host: the product's reader where the platform has one and the program's text is handed in, else the named refusal. */
export function cardEnumeratorOf(platform: string, programs: CardListingPrograms | undefined): { readonly enumerator: CardEnumerator; readonly unavailable: CardListingUnavailable | null } {
  if (platform !== CARD_LISTING_PLATFORM) return { enumerator: unavailableCardEnumerator(CardListingUnavailable.NOT_AVAILABLE_ON_THIS_PLATFORM), unavailable: CardListingUnavailable.NOT_AVAILABLE_ON_THIS_PLATFORM };
  if (programs === undefined) return { enumerator: unavailableCardEnumerator(CardListingUnavailable.LISTING_PROGRAM_NOT_HANDED_IN), unavailable: CardListingUnavailable.LISTING_PROGRAM_NOT_HANDED_IN };
  return { enumerator: createCardEnumerator(createCardListingReader(programs)), unavailable: null };
}

// ── The runner of the card listing program (row 85c; decision C60 (3); rules G-R12 / SR-4) ─────

/** `code` of a card listing program that gave no usable text. */
export const AUDIO_CARD_LISTING_PROGRAM_FAILED = 'AUDIO_CARD_LISTING_PROGRAM_FAILED';

/** Why: the `reason` of that code. Fixed words; nothing the program wrote is in one. */
export const CardListingProgramFailure = {
  /** The door refused the start, or the program does not exist or may not be executed. */
  NOT_STARTED: 'NOT_STARTED',
  /** The program did not end within its bound. It was killed. */
  TIMED_OUT: 'TIMED_OUT',
  /** The program ended with another exit code than 0, or by a signal. */
  ENDED_NONZERO: 'ENDED_NONZERO',
  /** The program wrote as much as the door keeps: the text may be cut, and a cut text is no listing. */
  OUTPUT_TOO_LONG: 'OUTPUT_TOO_LONG',
} as const;
export type CardListingProgramFailure = (typeof CardListingProgramFailure)[keyof typeof CardListingProgramFailure];

/** The row of a macOS listing that failed (row N7): a closed word, never a program path. */
export const MacosListingRow = {
  /** L1: the USB tree, property-list form, standard output. */
  USB_TREE: 'USB_TREE',
  /** L2: the system's audio list, JSON, standard output. */
  SYSTEM_AUDIO: 'SYSTEM_AUDIO',
  /** L3: the capture program's own device list, its diagnostics. */
  CAPTURE_DEVICES: 'CAPTURE_DEVICES',
} as const;
export type MacosListingRow = (typeof MacosListingRow)[keyof typeof MacosListingRow];

/** A code, a reason of the closed set and a fixed sentence: no path, no output, no cause. `row`: which macOS row failed (null on Linux: one row). */
export class CardListingProgramError extends Error {
  readonly code: typeof AUDIO_CARD_LISTING_PROGRAM_FAILED = AUDIO_CARD_LISTING_PROGRAM_FAILED;
  readonly reason: CardListingProgramFailure;
  readonly row: MacosListingRow | null;
  constructor(reason: CardListingProgramFailure, row: MacosListingRow | null = null) {
    super('the card listing program gave no usable list');
    this.name = 'CardListingProgramError';
    this.reason = reason;
    this.row = row;
  }
}

/** How long the listing program may run. It reads the kernel's table and ends. */
export const CARD_LISTING_PROGRAM_BOUND_MS = 5_000;

export interface CardListingRunnerParts {
  /** The production door: the one file that starts a production program. */
  readonly door: ProductionDoor;
  readonly timers: CaptureTimers;
  /** Default: the program of the helper table. A TEST hands in a stand-in that prints listing fixtures; production code hands in nothing. */
  readonly program?: string;
  /** Default: `CARD_LISTING_PROGRAM_BOUND_MS`. */
  readonly boundMs?: number;
}

/**
 * THE RUNNER. The text of the list of capture hardware, from ONE run of the listing program: the
 * fixed row of the helper table through the production door - no shell, an empty environment, no
 * start message, NO ARGUMENT FROM DATA (the row takes no parameter at all). The program's input is
 * ended at once; it is killed when it outlives its bound. Anything but "started, ended by itself
 * with exit code 0, wrote less than the door keeps" is the named refusal: nothing is answered from
 * a half list. The hardware parameter dump is NOT offered: its arguments would be two integers of
 * a listing, and the row admitted here is the fixed one.
 */
export function cardListingProgramsOf(parts: CardListingRunnerParts): CardListingPrograms {
  const program = parts.program ?? LINUX_CARD_LISTING_PROGRAM;
  const boundMs = typeof parts.boundMs === 'number' && Number.isFinite(parts.boundMs) && parts.boundMs > 0 ? parts.boundMs : CARD_LISTING_PROGRAM_BOUND_MS;
  return Object.freeze({
    async captureDevices(): Promise<string> {
      const running = parts.door({ command: program, args: linuxCardListingArguments(), env: {}, message: null, timers: parts.timers });
      let timedOut = false;
      const cancel = parts.timers.after(boundMs, () => {
        timedOut = true;
        running.kill('SIGKILL');
      });
      // The program takes nothing on its input: it is ended as soon as the start settled, either way.
      void running.started.then(
        () => running.endInput(),
        () => undefined,
      );
      const exit = await running.ended;
      cancel();
      if (exit.spawnFailed) throw new CardListingProgramError(CardListingProgramFailure.NOT_STARTED);
      if (timedOut) throw new CardListingProgramError(CardListingProgramFailure.TIMED_OUT);
      if (exit.exitCode !== 0) throw new CardListingProgramError(CardListingProgramFailure.ENDED_NONZERO);
      if (Buffer.byteLength(exit.output, 'utf8') >= PRODUCTION_OUTPUT_CAP_BYTES) throw new CardListingProgramError(CardListingProgramFailure.OUTPUT_TOO_LONG);
      return exit.output;
    },
  });
}

/**
 * The enumerator of THIS host, with the runner of the listing program behind it - THE PLATFORM SEAM
 * (row N7; SM-21: chosen by the platform alone, never both, no key of the configuration):
 *   `linux`   the product's enumerator over the product's runner (unchanged);
 *   `darwin`  the listing of a macOS host over the runner of its three rows (`macosCardEnumeratorOf`).
 *             Its third row is started by the configured audio helper: without one the named
 *             answer `LISTING_PROGRAM_NOT_HANDED_IN`, and nothing is ever started;
 *   any other the named "not available" answer, and no program is ever started.
 * `helperProgram` is read on `darwin` only; the Linux runner never sees it.
 */
export function hostCardEnumeratorOf(host: { readonly platform: string; readonly helperProgram?: string | null } & CardListingRunnerParts): { readonly enumerator: CardEnumerator; readonly unavailable: CardListingUnavailable | null } {
  if (host.platform === MACOS_CARD_LISTING_PLATFORM) {
    if (typeof host.helperProgram !== 'string') return { enumerator: unavailableCardEnumerator(CardListingUnavailable.LISTING_PROGRAM_NOT_HANDED_IN), unavailable: CardListingUnavailable.LISTING_PROGRAM_NOT_HANDED_IN };
    return { enumerator: macosCardEnumeratorOf({ door: host.door, timers: host.timers, helperProgram: host.helperProgram }), unavailable: null };
  }
  if (host.platform !== CARD_LISTING_PLATFORM) return cardEnumeratorOf(host.platform, undefined);
  return cardEnumeratorOf(host.platform, cardListingProgramsOf(host));
}

// ── The card listing of a macOS host (task 4 row N7; masterplan/06 revision 3 sections 2.2, 2.3, 3.3; SM-10) ──
//
// THREE FIXED ROWS of the helper table, each through the production door with an empty environment,
// no start message, its input ended at once, and each held to its own bound and cap. The texts go
// UNCHANGED to the strict readers of row N6 (`createMacosCardEnumerator`); this file reads none of
// them. What makes a row's text UNREADABLE (review SM-10 (1), (2)) - never an empty list, never a
// guess - is the named refusal `CardListingProgramError` with the row:
//
//   row               read from        ends                                               cap of each stream
//   USB tree          standard output  by itself, exit code 0                             512 KiB (row N5b, C131)
//   system audio      standard output  by itself, exit code 0                             32 KiB
//   capture devices   diagnostics      by itself with an exit code (non-zero by design),  32 KiB
//                                      not by a signal; the audio section line is the
//                                      reader's to require (exactly once)
//
// A row killed at its bound is `TIMED_OUT` and the wait ends THEN: a descendant that holds a stream
// open does not hold the caller. AN INDEX IS NEVER KEPT: every listing is three new runs, and what
// a listing answered is dropped once it has settled (`macosCardEnumeratorOf`).

/** The platform whose listing is the three rows below. */
export const MACOS_CARD_LISTING_PLATFORM = 'darwin';

/** Which stream of a row is its text. */
type MacosListingStream = 'output' | 'diagnostics';

/**
 * THE LIMITS OF THE THREE ROWS. The bounds are the table's (SR-15 (6)). The caps, against the sizes
 * measured on this Mac on 2026-10-14 (record `implementation/n7_macos_platform_seam.md` section 3):
 *   USB tree       45,342 bytes for 5 devices (6,722 to 12,435 each). Row N5b (decision C131 (2)):
 *                  512 KiB, `MACOS_USB_TREE_TEXT_BYTES` of the property-list reader - ONE constant
 *                  for this cap and the reader's bound - handed to the door as the call's cap (the
 *                  door's default 64 KiB left about two more devices). It holds the listing's 32
 *                  devices of the largest measured size (397,920 bytes). A longer text is refused,
 *                  never cut. The row is not narrowed: every narrower form measured loses the
 *                  interface class the audio rule rests on, and its words are pinned (SR-15 (6)).
 *   system audio   1,471 bytes for 3 items (at most 445 each); the reader takes 32 items: 32 KiB is
 *                  32 items of 1 KiB, more than twice the largest measured item.
 *   capture list   613 bytes for 6 entries and 3 closing lines (68 characters at most); the reader
 *                  takes lines of 512 characters and 32 audio entries: 32 KiB is 64 such lines.
 */
export const MACOS_LISTING_ROW_LIMITS: Readonly<Record<MacosListingRow, { readonly boundMs: number; readonly capBytes: number; readonly read: MacosListingStream }>> = Object.freeze({
  USB_TREE: Object.freeze({ boundMs: MACOS_LISTING_HELPER_TABLE.usbTree.boundMs, capBytes: MACOS_USB_TREE_TEXT_BYTES, read: 'output' as const }),
  SYSTEM_AUDIO: Object.freeze({ boundMs: MACOS_LISTING_HELPER_TABLE.systemAudio.boundMs, capBytes: 32 * 1024, read: 'output' as const }),
  CAPTURE_DEVICES: Object.freeze({ boundMs: MACOS_LISTING_HELPER_TABLE.deviceList.boundMs, capBytes: 32 * 1024, read: 'diagnostics' as const }),
});

export interface MacosListingRunnerParts {
  /** The production door: the one file that starts a production program. */
  readonly door: ProductionDoor;
  readonly timers: CaptureTimers;
  /** The audio helper of the configuration (`DEMS_CAPTURE_AUDIO_HELPER`): the program of the device-list row. */
  readonly helperProgram: string;
  /** Default: the path rule's own inspector. A TEST hands in facts; production code hands in nothing. */
  readonly inspect?: ProgramInspector;
  /** Defaults: the two programs of the table. A TEST hands in stand-ins; production code hands in nothing. */
  readonly usbTreeProgram?: string;
  readonly systemAudioProgram?: string;
  /** Defaults: `MACOS_LISTING_ROW_LIMITS`. A TEST hands in short bounds or small caps; production code hands in nothing. */
  readonly limits?: Partial<Readonly<Record<MacosListingRow, { readonly boundMs: number; readonly capBytes: number }>>>;
}

/** ONE run of ONE row: the text of the row's stream, or the named refusal with the row. */
async function macosListingRowText(parts: MacosListingRunnerParts, row: MacosListingRow, program: string, args: readonly string[]): Promise<string> {
  const given = parts.limits?.[row];
  const { read } = MACOS_LISTING_ROW_LIMITS[row];
  const boundMs = boundOf(given?.boundMs, MACOS_LISTING_ROW_LIMITS[row].boundMs);
  const capBytes = boundOf(given?.capBytes, MACOS_LISTING_ROW_LIMITS[row].capBytes);
  const { door, timers } = parts;
  // Row N5b (decision C131): the door keeps the row's own cap of each stream, and the row's program leads a process group of its
  // own, so the kill at the bound below ends a descendant it forked as well (SM-10 (3)).
  const running = door({ command: program, args, env: {}, message: null, timers, outputCapBytes: capBytes, processGroup: true });
  let tellHalted: () => void = () => undefined;
  const halted = new Promise<null>((resolve) => {
    tellHalted = () => resolve(null);
  });
  let timedOut = false;
  const cancel = timers.after(boundMs, () => {
    timedOut = true;
    running.kill('SIGKILL');
    tellHalted();
  });
  // The program takes nothing on its input: it is ended as soon as the start settled, either way.
  void running.started.then(
    () => running.endInput(),
    () => undefined,
  );
  const exit = await Promise.race([running.ended, halted]);
  cancel();
  if (exit !== null && exit.spawnFailed) throw new CardListingProgramError(CardListingProgramFailure.NOT_STARTED, row);
  if (timedOut || exit === null) throw new CardListingProgramError(CardListingProgramFailure.TIMED_OUT, row);
  const endedByItself = exit.signal === null && exit.exitCode !== null;
  if (!endedByItself || (read === 'output' && exit.exitCode !== 0)) throw new CardListingProgramError(CardListingProgramFailure.ENDED_NONZERO, row);
  // BOTH streams are held to the cap (SM-10 (1)); the text is the stream the row is read from.
  const text = read === 'output' ? exit.output : exit.diagnostics;
  const other = read === 'output' ? exit.diagnostics : exit.output;
  if (Buffer.byteLength(text, 'utf8') >= capBytes || Buffer.byteLength(other, 'utf8') >= capBytes) throw new CardListingProgramError(CardListingProgramFailure.OUTPUT_TOO_LONG, row);
  return text;
}

/**
 * THE RUNNER OF THE THREE ROWS: the source of row N6's listing. Each method is ONE new run of its
 * fixed row; no method takes an argument, so nothing a device announced can become part of a
 * question. The audio helper is vouched for by the path rule before EVERY start of its row (SM-10
 * (6)): a refused path starts nothing and is `NOT_STARTED`.
 */
export function macosListingSourceOf(parts: MacosListingRunnerParts): MacosListingSource {
  const inspect = parts.inspect ?? inspectProgram;
  const usbTreeProgram = parts.usbTreeProgram ?? MACOS_USB_TREE_PROGRAM;
  const systemAudioProgram = parts.systemAudioProgram ?? MACOS_SYSTEM_AUDIO_PROGRAM;
  return Object.freeze({
    usbTree: () => macosListingRowText(parts, MacosListingRow.USB_TREE, usbTreeProgram, macUsbTreeArguments()),
    systemAudio: () => macosListingRowText(parts, MacosListingRow.SYSTEM_AUDIO, systemAudioProgram, macSystemAudioArguments()),
    async captureDevices(): Promise<string> {
      let refusal: string | null;
      try {
        refusal = helperProgramRefusal(inspect(parts.helperProgram));
      } catch {
        refusal = 'NOT_INSPECTED';
      }
      if (refusal !== null) throw new CardListingProgramError(CardListingProgramFailure.NOT_STARTED, MacosListingRow.CAPTURE_DEVICES);
      return macosListingRowText(parts, MacosListingRow.CAPTURE_DEVICES, parts.helperProgram, macMicDeviceListArguments());
    },
  });
}

/**
 * THE ENUMERATOR OF A macOS HOST: row N6's enumerator over the runner above, SINGLE-FLIGHT (review
 * SM-10 (4)): a search, an open, a start and a watch pass that fall together share the ONE listing
 * in flight; none queues a second. NOTHING IS KEPT once a listing has settled: the next call is
 * three new runs, so an index of the capture list is never answered from an earlier listing (it
 * was 0, then 1, then 2 on this Mac across restarts). Residual, stated for the adapter (row N9): a
 * caller that joins a listing in flight gets texts read from the moment that listing began, at
 * most one listing's time before its own call.
 * `list` raises `MacosCardListingError` for a list its reader refused and the runner's
 * `CardListingProgramError` for a row that failed: never a listing of no card.
 */
export function macosCardEnumeratorOf(parts: MacosListingRunnerParts): MacosCardEnumerator {
  const reader = createMacosCardEnumerator(macosListingSourceOf(parts));
  let inFlight: Promise<MacosTiedListing> | null = null;
  const listTied = (): Promise<MacosTiedListing> => {
    if (inFlight !== null) return inFlight;
    const reading = reader.listTied();
    inFlight = reading;
    const settled = (): void => {
      if (inFlight === reading) inFlight = null;
    };
    reading.then(settled, settled);
    return reading;
  };
  return Object.freeze({
    listTied,
    async list() {
      const tied = await listTied();
      if (!tied.ok) throw new MacosCardListingError(tied.failure, tied.detail);
      return tied.listing;
    },
  });
}

// ── The host's own observations of the commissioning functions (task 4 row 111b; decisions C78, C87) ──
//
// What the set-IP job and the factory scan must know of the host and cannot read from a camera:
// THE HARDWARE ADDRESS THE HOST HAS LEARNT for one address (the kernel's neighbour table), and
// WHETHER ANYTHING ANSWERS at one address. Each is the answer of a row of the helper table
// (`adapters/local/mic-helper-args.ts`: fixed literals and ONE address made from four integers),
// started through the production door with an empty environment and no start message, on `linux`
// only. Before a program is started the address goes through THE DESTINATION RULE on the facts the
// host states now, and the argument is made from the address the rule returned; a refused address
// starts nothing. What a program wrote is read by a bound and a strict form: one line form, a
// closed set of states, a hardware address of six pairs. Anything else is "unknown" - a thrown
// code of a closed set, never a guess, never a text of the program.

/** `code` of an observation of the host that gave no usable answer. */
export const COMMISSIONING_INPUT_FAILED = 'COMMISSIONING_INPUT_FAILED';

/** Why: the `reason` of that code. Fixed words; nothing a program wrote is in one. */
export const CommissioningInputFailure = {
  /** The destination rule refused the address on the facts of the host, or the table refused its form. Nothing was started. */
  ADDRESS_REFUSED: 'ADDRESS_REFUSED',
  /** No camera interface is stored, or its name is not of the form of an interface name. Nothing was started. */
  INTERFACE_UNKNOWN: 'INTERFACE_UNKNOWN',
  /** The door refused the start, or the program does not exist or may not be executed. */
  NOT_STARTED: 'NOT_STARTED',
  /** The program did not end within its bound. It was killed. */
  TIMED_OUT: 'TIMED_OUT',
  /** The caller's signal ended the question. The program was killed. */
  STOPPED: 'STOPPED',
  /** The program ended by a signal, or with an exit code its row does not know. */
  ENDED_UNEXPECTEDLY: 'ENDED_UNEXPECTEDLY',
  /** The program wrote more than its reader takes. */
  OUTPUT_TOO_LONG: 'OUTPUT_TOO_LONG',
  /** The text is not of the one form, or states what the reader does not know. */
  OUTPUT_MALFORMED: 'OUTPUT_MALFORMED',
  /** No echo came back and the neighbour table holds no entry for the address on the camera interface: the host never asked there. */
  NOT_OBSERVED: 'NOT_OBSERVED',
} as const;
export type CommissioningInputFailure = (typeof CommissioningInputFailure)[keyof typeof CommissioningInputFailure];

/** A code, a reason of the closed set and a fixed sentence: no address, no output, no cause. */
export class CommissioningInputError extends Error {
  readonly code: typeof COMMISSIONING_INPUT_FAILED = COMMISSIONING_INPUT_FAILED;
  readonly reason: CommissioningInputFailure;
  constructor(reason: CommissioningInputFailure) {
    super('an observation of the host gave no usable answer');
    this.name = 'CommissioningInputError';
    this.reason = reason;
  }
}

/** How long the neighbour program may run. It reads one entry of the kernel's table and ends. */
export const NEIGHBOUR_PROGRAM_BOUND_MS = 1_500;
/** How long the echo program may run: one request and the one second of its row, with a margin. */
export const ECHO_PROGRAM_BOUND_MS = 2_500;
/** The most text the reader of the neighbour row takes, and the most lines (one address on a few interfaces). */
export const NEIGHBOUR_OUTPUT_MAX_CHARS = 1_024;
export const NEIGHBOUR_OUTPUT_MAX_LINES = 8;

/** What the neighbour table says of ONE address on the camera interface. */
export type NeighbourReading = { readonly kind: 'LEARNT'; readonly mac: string } | { readonly kind: 'SILENT' } | { readonly kind: 'ABSENT' } | { readonly kind: 'UNKNOWN' };

const NEIGHBOUR_UNKNOWN: NeighbourReading = Object.freeze({ kind: 'UNKNOWN' });
const NEIGHBOUR_SILENT: NeighbourReading = Object.freeze({ kind: 'SILENT' });
const NEIGHBOUR_ABSENT: NeighbourReading = Object.freeze({ kind: 'ABSENT' });
/** ONE line of the neighbour program: the address, the interface, an optional hardware address, an optional router mark, the state. */
const NEIGHBOUR_LINE = /^(\S+) dev (\S+)(?: lladdr (\S+))?(?: router)? ([A-Z]+)$/;
const NEIGHBOUR_HW_ADDRESS = /^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/;
/** The form of an interface name (the form the address helper's interface file is held to). */
const CAMERA_INTERFACE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$/;
/** The states in which the kernel holds a hardware address it was told by the neighbour itself. */
const NEIGHBOUR_LEARNT_STATES: readonly string[] = Object.freeze(['REACHABLE', 'STALE', 'DELAY', 'PROBE']);
/** The states that say "asked, no answer (yet)". */
const NEIGHBOUR_SILENT_STATES: readonly string[] = Object.freeze(['FAILED', 'INCOMPLETE']);

/**
 * THE READER OF THE NEIGHBOUR ROW. Pure. `address` is the argument the program was given;
 * `cameraInterface` the stored interface name. LEARNT: exactly one entry of that address on that
 * interface, in a state of a learnt address, with a unicast hardware address that is not all
 * zero - answered as six upper-case pairs. SILENT: one entry on that interface that says "asked,
 * no answer" (`FAILED`, `INCOMPLETE`). ABSENT: no entry on that interface. UNKNOWN: anything else - too long, too many lines, a line of another form, another
 * address, an entry set by hand, a state this reader does not know, two entries.
 */
export function neighbourReadingOf(output: unknown, address: string, cameraInterface: string): NeighbourReading {
  if (typeof output !== 'string' || output.length > NEIGHBOUR_OUTPUT_MAX_CHARS || !CAMERA_INTERFACE_NAME.test(cameraInterface)) return NEIGHBOUR_UNKNOWN;
  const lines = output.split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).filter((line) => line !== '');
  if (lines.length > NEIGHBOUR_OUTPUT_MAX_LINES) return NEIGHBOUR_UNKNOWN;
  let found: NeighbourReading | null = null;
  for (const line of lines) {
    const match = NEIGHBOUR_LINE.exec(line);
    if (match === null) return NEIGHBOUR_UNKNOWN;
    const [, stated, device, hardware, state] = match;
    if (stated !== address || device === undefined || !CAMERA_INTERFACE_NAME.test(device) || state === undefined) return NEIGHBOUR_UNKNOWN;
    if (hardware !== undefined && !NEIGHBOUR_HW_ADDRESS.test(hardware)) return NEIGHBOUR_UNKNOWN;
    const learnt = NEIGHBOUR_LEARNT_STATES.includes(state);
    if (!learnt && !NEIGHBOUR_SILENT_STATES.includes(state)) return NEIGHBOUR_UNKNOWN;
    // An entry of another interface is not the camera port's: compared, never used.
    if (device !== cameraInterface) continue;
    if (found !== null) return NEIGHBOUR_UNKNOWN;
    if (!learnt) {
      found = NEIGHBOUR_SILENT;
      continue;
    }
    // A learnt state without an address, the all-zero address, and a group address are no address of one device.
    if (hardware === undefined || hardware === '00:00:00:00:00:00' || (Number.parseInt(hardware.slice(0, 2), 16) & 1) === 1) return NEIGHBOUR_UNKNOWN;
    found = Object.freeze({ kind: 'LEARNT', mac: hardware.toUpperCase() });
  }
  return found ?? NEIGHBOUR_ABSENT;
}

/** The most text the reader of the echo row takes, and the most lines. */
export const ECHO_OUTPUT_MAX_CHARS = 1_024;
export const ECHO_OUTPUT_MAX_LINES = 8;
const ECHO_SUMMARY = /^1 packets transmitted, ([01]) received, (?:\+1 errors, )?(0|100)% packet loss, time \d{1,5}ms$/;

/**
 * THE READER OF THE ECHO ROW. Pure. true: the program states that its ONE request to `address` was
 * answered; false: that it was sent and nothing came back; null: not known - too long, too many
 * lines, no statistics line naming exactly this address, no or more than one summary line, a
 * summary of another form, or counts that contradict each other. The other lines are not read.
 */
export function echoReadingOf(output: unknown, address: string): boolean | null {
  if (typeof output !== 'string' || output.length > ECHO_OUTPUT_MAX_CHARS) return null;
  const lines = output.split('\n').map((line) => line.trim()).filter((line) => line !== '');
  if (lines.length > ECHO_OUTPUT_MAX_LINES) return null;
  if (lines.filter((line) => line === `--- ${address} ping statistics ---`).length !== 1 || lines.filter((line) => line.endsWith('ping statistics ---')).length !== 1) return null;
  const summaries = lines.filter((line) => line.includes('packets transmitted'));
  const match = summaries.length === 1 ? ECHO_SUMMARY.exec(summaries[0] ?? '') : null;
  if (match === null) return null;
  const received = match[1] === '1';
  if ((match[2] === '0') !== received) return null;
  return received;
}

/** The platform on which the two rows exist. */
export const COMMISSIONING_INPUTS_PLATFORM = 'linux';

export interface CommissioningHostParts {
  /** The platform of this process. On any other than `linux` nothing is made and nothing is ever started. */
  readonly platform: string;
  readonly timers: CaptureTimers;
  /** The host's network facts, read at EVERY question: the facts the destination rule judges the address on. */
  readonly network: CaptureNetworkFactsReader | undefined;
  /** The stored camera interface, read at every question. null: not chosen. */
  readonly cameraInterface: () => string | null;
  /** Default: the production door. A TEST hands in a door that starts nothing or answers the core-file limit; production code hands in nothing. */
  readonly door?: ProductionDoor;
  /** Default: the programs of the helper table. A TEST hands in stand-ins; production code hands in nothing. */
  readonly neighbourProgram?: string;
  readonly echoProgram?: string;
  /** Defaults: `NEIGHBOUR_PROGRAM_BOUND_MS`, `ECHO_PROGRAM_BOUND_MS`. */
  readonly neighbourBoundMs?: number;
  readonly echoBoundMs?: number;
}

/** The observations as the two commissioning functions take them. Each throws a `CommissioningInputError` when the answer is not known. */
export interface CommissioningHostInputs {
  /** The set-IP job (`CameraNetworkInputs`). */
  readonly job: {
    neighbour(address: string, signal: AbortSignal): Promise<string | null>;
    answers(address: string, signal: AbortSignal): Promise<boolean>;
  };
  /** The factory scan: the hardware address of an address that answered its probe. */
  readonly scan: { mac(address: string, signal: AbortSignal): Promise<string | null> };
}

const boundOf = (value: number | undefined, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback);

/**
 * The end of ONE run of a row: the program's input is ended at once; it is killed when it outlives
 * its bound or when the caller's signal fires, and the wait ends THEN (a program that cannot be
 * reaped does not hold the caller). Answers the exit code and the text; every other end is thrown.
 */
async function endOfCommissioningRow(timers: CaptureTimers, running: ReturnType<ProductionDoor>, boundMs: number, signal: AbortSignal): Promise<{ readonly exitCode: number; readonly output: string }> {
  const halt: { why: CommissioningInputFailure | null; tell: () => void } = { why: null, tell: () => undefined };
  const halted = new Promise<null>((resolve) => {
    halt.tell = () => resolve(null);
  });
  const stop = (why: CommissioningInputFailure) => (): void => {
    if (halt.why !== null) return;
    halt.why = why;
    running.kill('SIGKILL');
    halt.tell();
  };
  const stopped = stop(CommissioningInputFailure.STOPPED);
  const cancel = timers.after(boundMs, stop(CommissioningInputFailure.TIMED_OUT));
  signal.addEventListener('abort', stopped, { once: true });
  if (signal.aborted) stopped();
  // The program takes nothing on its input: it is ended as soon as the start settled, either way.
  void running.started.then(
    () => running.endInput(),
    () => undefined,
  );
  const exit = await Promise.race([running.ended, halted]);
  cancel();
  signal.removeEventListener('abort', stopped);
  if (halt.why !== null || exit === null) throw new CommissioningInputError(halt.why ?? CommissioningInputFailure.STOPPED);
  if (exit.spawnFailed) throw new CommissioningInputError(CommissioningInputFailure.NOT_STARTED);
  if (exit.exitCode === null) throw new CommissioningInputError(CommissioningInputFailure.ENDED_UNEXPECTEDLY);
  if (Buffer.byteLength(exit.output, 'utf8') >= PRODUCTION_OUTPUT_CAP_BYTES) throw new CommissioningInputError(CommissioningInputFailure.OUTPUT_TOO_LONG);
  return { exitCode: exit.exitCode, output: exit.output };
}

/**
 * THE OBSERVATIONS OF THIS HOST, or null on a platform without the two rows (then nothing is ever
 * started, and the commissioning functions keep their named "not available" refusal).
 *
 *   neighbour / mac   the neighbour row once: LEARNT -> the six upper-case pairs; SILENT and ABSENT
 *                     -> null; everything else is thrown.
 *   answers           the echo row once, judged by its STATED result in a strict form that must
 *                     agree with its exit code: one request sent, one back -> true. None back ->
 *                     the neighbour row: true when the host LEARNT a hardware address for it (a
 *                     device that answers the address question but not the echo); false ONLY when
 *                     the entry is SILENT (the host asked on the camera interface, nobody
 *                     answered). No entry, and every other end or text of either program, is
 *                     thrown: "not known" is never "free", and the caller refuses the address.
 */
export function hostCommissioningInputsOf(host: CommissioningHostParts): CommissioningHostInputs | null {
  if (host.platform !== COMMISSIONING_INPUTS_PLATFORM) return null;
  const door = host.door ?? startProductionProcess;
  const neighbourProgram = host.neighbourProgram ?? LINUX_NEIGHBOUR_PROGRAM;
  const echoProgram = host.echoProgram ?? LINUX_ECHO_PROGRAM;
  const neighbourBoundMs = boundOf(host.neighbourBoundMs, NEIGHBOUR_PROGRAM_BOUND_MS);
  const echoBoundMs = boundOf(host.echoBoundMs, ECHO_PROGRAM_BOUND_MS);

  /** The address as the destination rule returned it on the facts of the host NOW. A refusal, unreadable facts, a stopped question: thrown, nothing started. */
  const admitted = (purpose: DestinationPurpose, address: string, signal: AbortSignal): string => {
    if (signal.aborted) throw new CommissioningInputError(CommissioningInputFailure.STOPPED);
    let facts: DestinationContext | null = null;
    try {
      facts = host.network?.() ?? null;
    } catch {
      facts = null;
    }
    const decision = decideDestination({ purpose, address }, facts ?? HOST_NOT_CONFIGURED);
    if (!decision.allowed) throw new CommissioningInputError(CommissioningInputFailure.ADDRESS_REFUSED);
    return decision.destination.address;
  };
  const interfaceNow = (): string => {
    let name: string | null = null;
    try {
      name = host.cameraInterface();
    } catch {
      name = null;
    }
    if (typeof name !== 'string' || !CAMERA_INTERFACE_NAME.test(name)) throw new CommissioningInputError(CommissioningInputFailure.INTERFACE_UNKNOWN);
    return name;
  };
  const argumentsOf = (make: (address: string) => readonly string[], target: string): readonly string[] => {
    try {
      return make(target);
    } catch {
      throw new CommissioningInputError(CommissioningInputFailure.ADDRESS_REFUSED);
    }
  };

  const readNeighbour = async (target: string, cameraInterface: string, signal: AbortSignal): Promise<NeighbourReading> => {
    const running = door({ command: neighbourProgram, args: argumentsOf(linuxNeighbourArguments, target), env: {}, message: null, timers: host.timers });
    const ended = await endOfCommissioningRow(host.timers, running, neighbourBoundMs, signal);
    if (ended.exitCode !== 0) throw new CommissioningInputError(CommissioningInputFailure.ENDED_UNEXPECTEDLY);
    if (ended.output.length > NEIGHBOUR_OUTPUT_MAX_CHARS) throw new CommissioningInputError(CommissioningInputFailure.OUTPUT_TOO_LONG);
    const reading = neighbourReadingOf(ended.output, target, cameraInterface);
    if (reading.kind === 'UNKNOWN') throw new CommissioningInputError(CommissioningInputFailure.OUTPUT_MALFORMED);
    return reading;
  };
  const echoed = async (target: string, signal: AbortSignal): Promise<boolean> => {
    const running = door({ command: echoProgram, args: argumentsOf(linuxEchoArguments, target), env: {}, message: null, timers: host.timers });
    const ended = await endOfCommissioningRow(host.timers, running, echoBoundMs, signal);
    if (ended.exitCode !== 0 && ended.exitCode !== 1) throw new CommissioningInputError(CommissioningInputFailure.ENDED_UNEXPECTEDLY);
    // AN EXIT CODE ALONE IS NO ANSWER (container finding of record 079: a tool can end with 0 without having asked). The
    // program must also STATE, in its one strict form, that it sent one request to this address and how many came back,
    // and the statement must agree with the exit code. Anything else is "not known".
    const stated = echoReadingOf(ended.output, target);
    if (stated === null || stated !== (ended.exitCode === 0)) throw new CommissioningInputError(CommissioningInputFailure.OUTPUT_MALFORMED);
    return stated;
  };

  const learnt = async (purpose: DestinationPurpose, address: string, signal: AbortSignal): Promise<string | null> => {
    const target = admitted(purpose, address, signal);
    const reading = await readNeighbour(target, interfaceNow(), signal);
    return reading.kind === 'LEARNT' ? reading.mac : null;
  };
  return Object.freeze({
    job: Object.freeze({
      neighbour: (address: string, signal: AbortSignal) => learnt(DestinationPurpose.SET_IP, address, signal),
      async answers(address: string, signal: AbortSignal): Promise<boolean> {
        const target = admitted(DestinationPurpose.SET_IP, address, signal);
        const cameraInterface = interfaceNow();
        if (await echoed(target, signal)) return true;
        const reading = await readNeighbour(target, cameraInterface, signal);
        if (reading.kind === 'LEARNT') return true;
        // "FREE" NEEDS EVIDENCE: the entry that says the host ASKED this address on the camera interface and got no
        // answer. No entry at all means the question was never asked there (a port that is down, another route): not known.
        if (reading.kind !== 'SILENT') throw new CommissioningInputError(CommissioningInputFailure.NOT_OBSERVED);
        return false;
      },
    }),
    scan: Object.freeze({ mac: (address: string, signal: AbortSignal) => learnt(DestinationPurpose.COMMISSIONING_SCAN, address, signal) }),
  });
}

// ── The door, the locator read, the stored candidate ───────────────────────────────────────────

/** The production door and the locator read of the ONVIF session, as the production camera adapter takes them. Nothing is started or contacted here. */
export function productionCameraDoors(timers: CaptureTimers): { readonly door: ProductionDoor; readonly locator: OnvifStreamLocator } {
  return Object.freeze({ door: startProductionProcess, locator: createOnvifStreamLocator({ timers }) });
}

/**
 * A stored camera row as the candidate the ONVIF session takes; null for another adapter kind than
 * the production camera's and for an address that is absent or not of the stored form. It decides
 * NOTHING about the address: the judgement stands in front of every use of the candidate.
 */
export function productionCameraCandidateOf(stored: { readonly adapterKind: unknown; readonly address: string | null; readonly endpointRef: string | null }): CameraCandidate | null {
  if (stored.adapterKind !== CaptureAdapterKind.ONVIF_RTSP) return null;
  return storedCameraCandidate({ adapterKind: CaptureAdapterKind.ONVIF_RTSP, address: stored.address, endpointRef: stored.endpointRef });
}

// ── The fault sink of the two watches (row 85c; decision C60 (2)) ──────────────────────────────

/**
 * The fault of a watch: one of the two EXISTING keys - a camera whose stream ended, a microphone
 * that stopped delivering - about one registered device, ALWAYS with its cause. A clear without a
 * cause would clear every cause of the kind on that device (ruling D146); this type has none.
 */
export interface WatchFault {
  readonly code: typeof CaptureWarningCode.CAPTURE_FAULT;
  /** The registry id of the device (`CAM-NN`, `MIC-NN`). */
  readonly subject: string;
  readonly reason: typeof CaptureWarningReason.CAMERA_STREAM_ENDED | typeof CaptureWarningReason.MIC_DISCONNECTED;
}

/** What the sink needs of the engine: whether that fault is active now, whoever raised it, and the two internal actions. */
export interface WatchFaultEngine {
  active(fault: WatchFault): boolean;
  raise(fault: WatchFault): Promise<unknown>;
  clear(fault: WatchFault): Promise<unknown>;
}

export const WatchFaultRefusal = {
  /** No engine is running: nothing was written. The watch is told, so that it may ask again. */
  ENGINE_NOT_AVAILABLE: 'CAPTURE_WATCH_FAULT_ENGINE_NOT_AVAILABLE',
  /** The fault is not one of the two a watch raises about a device of its class: nothing was written. */
  NOT_OF_A_WATCH: 'CAPTURE_WATCH_FAULT_NOT_OF_A_WATCH',
} as const;
export type WatchFaultRefusal = (typeof WatchFaultRefusal)[keyof typeof WatchFaultRefusal];

export class WatchFaultError extends Error {
  readonly code: WatchFaultRefusal;
  constructor(code: WatchFaultRefusal) {
    super('the fault sink of the capture watches wrote nothing');
    this.name = 'WatchFaultError';
    this.code = code;
  }
}

/** What the sink did NOT write, said to whoever logs. Code words and the device id only. */
export const WatchFaultNote = {
  /** A raise for a fault that is active already: another part raised it. The watch does not own it and will not clear it. */
  HELD_BY_ANOTHER: 'CAPTURE_WATCH_FAULT_HELD_BY_ANOTHER',
  /** A clear of a fault this sink did not raise: nothing is cleared. */
  CLEAR_NOT_OWNED: 'CAPTURE_WATCH_FAULT_CLEAR_NOT_OWNED',
  /** A clear of a fault this sink raised that is no longer active: another part ended it (a new session, the boot). */
  ENDED_BY_ANOTHER: 'CAPTURE_WATCH_FAULT_ENDED_BY_ANOTHER',
} as const;
export type WatchFaultNote = (typeof WatchFaultNote)[keyof typeof WatchFaultNote];

export interface WatchFaultSink {
  raise(fault: WatchFault): Promise<void>;
  clear(fault: WatchFault): Promise<void>;
  /** The devices whose fault this sink raised and has not ended, as `<reason>:<device>`, sorted. */
  owned(): readonly string[];
}

const WATCH_FAULT_SUBJECT: Readonly<Record<WatchFault['reason'], RegExp>> = Object.freeze({
  [CaptureWarningReason.CAMERA_STREAM_ENDED]: /^CAM-[0-9]{2,}$/,
  [CaptureWarningReason.MIC_DISCONNECTED]: /^MIC-[0-9]{2,}$/,
});

/**
 * THE SINK (decision C60 (2)). A watch RAISES its fault and CLEARS ONLY THE FAULT IT RAISED ITSELF:
 *
 *   raise   the fault is active already -> another part raised it (the capture worker says the same
 *           key for the same event): nothing is written and the sink does NOT own it;
 *           otherwise the engine's raise, and the sink owns the fault;
 *   clear   not owned -> nothing is cleared, whatever is active;
 *           owned and no longer active -> another part ended it; nothing is written;
 *           owned and active -> the engine's clear of THAT cause on THAT device.
 *
 * It takes the two faults of a watch and no other (no other kind, no other cause, no fault without
 * a device), so it can never end a fault an operator must acknowledge or one of another cause. Per
 * fault its steps run one after the other. `engine` is asked at every step: null (no engine runs)
 * is the named refusal, and what the sink owns stays as it was. It keeps what it owns in memory
 * only: after a restart of the Core it owns nothing, and the boot's own rule ends stale faults.
 *
 * NOT CLOSED BY THIS FILE: a raise of the worker that arrives while the sink's own raise is on its
 * way is not seen (the engine does not say who was first); the sink then owns that fault.
 */
export function watchFaultSinkOf(engine: () => WatchFaultEngine | null, note?: (code: WatchFaultNote, fault: WatchFault) => void): WatchFaultSink {
  const owned = new Set<string>();
  const queues = new Map<string, Promise<void>>();
  const keyOf = (fault: WatchFault): string => `${fault.reason}:${fault.subject}`;
  const tell = (code: WatchFaultNote, fault: WatchFault): void => {
    try {
      note?.(code, fault);
    } catch {
      // A note never changes what the sink does.
    }
  };
  const checked = (fault: WatchFault): WatchFault => {
    // An OWN member of the table only: a word such as `constructor` is no cause of a watch.
    const subject = typeof fault?.reason === 'string' && Object.hasOwn(WATCH_FAULT_SUBJECT, fault.reason) ? (WATCH_FAULT_SUBJECT as Readonly<Record<string, RegExp | undefined>>)[fault.reason] : undefined;
    if (fault?.code !== CaptureWarningCode.CAPTURE_FAULT || subject === undefined || typeof fault.subject !== 'string' || !subject.test(fault.subject)) throw new WatchFaultError(WatchFaultRefusal.NOT_OF_A_WATCH);
    // Only the three members travel: nothing else a caller put on the object reaches the engine.
    return Object.freeze({ code: fault.code, subject: fault.subject, reason: fault.reason });
  };
  const inTurn = (fault: WatchFault, work: (engine: WatchFaultEngine, key: string) => Promise<void>): Promise<void> => {
    const key = keyOf(fault);
    const run = (queues.get(key) ?? Promise.resolve()).then(async () => {
      const host = engine();
      if (host === null) throw new WatchFaultError(WatchFaultRefusal.ENGINE_NOT_AVAILABLE);
      await work(host, key);
    });
    const tail = run.catch(() => undefined);
    queues.set(key, tail);
    void tail.then(() => {
      if (queues.get(key) === tail) queues.delete(key);
    });
    return run;
  };
  return Object.freeze({
    async raise(given: WatchFault): Promise<void> {
      const fault = checked(given);
      await inTurn(fault, async (host, key) => {
        if (owned.has(key)) return;
        if (host.active(fault)) {
          tell(WatchFaultNote.HELD_BY_ANOTHER, fault);
          return;
        }
        await host.raise(fault);
        owned.add(key);
      });
    },
    async clear(given: WatchFault): Promise<void> {
      const fault = checked(given);
      await inTurn(fault, async (host, key) => {
        if (!owned.has(key)) {
          tell(WatchFaultNote.CLEAR_NOT_OWNED, fault);
          return;
        }
        if (!host.active(fault)) {
          owned.delete(key);
          tell(WatchFaultNote.ENDED_BY_ANOTHER, fault);
          return;
        }
        await host.clear(fault);
        owned.delete(key);
      });
    },
    owned: () => Object.freeze([...owned].sort()),
  });
}

// ── The stored facts of a production device beyond its label (row 85c; decision C60 (3)) ───────

/**
 * The profile list of every registered device, in id order. The boot's own read of the registry
 * (`READ_STORED_DEVICES`) is pinned and selects neither; this is the wider read beside it. The
 * registry table has no capabilities column: a capability is the device class's (below).
 */
export const READ_STORED_DEVICE_PROFILES = 'SELECT d.id, d.profiles FROM public.capture_devices d ORDER BY d.id';
/** The same for ONE device: what the admission of a device registered after the boot reads. One row or none. */
export const READ_STORED_DEVICE_PROFILES_OF = 'SELECT d.id, d.kind, d.adapter_kind AS "adapterKind", d.model, d.profiles FROM public.capture_devices d WHERE d.id = $1';

/** A profile code as the stored CHECK holds it (`capture_devices_profiles_code_check`). */
const PROFILE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
/** More profiles than this on one device is no camera this Core records (a dual-lens camera has two). */
export const STORED_PROFILES_MAX = 16;

/**
 * The stored profile list of a row, or null when the value is not a list of profile codes within
 * the bound. Nothing is cut, cleaned or guessed: a list that is not of the form is no list.
 */
export function storedProfilesOf(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length > STORED_PROFILES_MAX) return null;
  const profiles: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !PROFILE_CODE.test(entry) || profiles.includes(entry)) return null;
    profiles.push(entry);
  }
  return Object.freeze(profiles);
}

/** Tells an observer and drops what it throws: an observer never changes what its caller did. */
export function tellQuietly(tell: () => void): void {
  try {
    tell();
  } catch {
    // Nowhere to say it: the caller's own outcome stands.
  }
}

/**
 * What a registered PRODUCTION device can do, by its class - the same statement the registration
 * actions make and the mapping reads back (`registerCaptureDevice`: a camera `VIDEO`;
 * `registerCaptureMicrophone`: a microphone `AUDIO`; a switch states none). Not stored: derived.
 */
const PRODUCTION_CAPABILITIES: Readonly<Record<CaptureDeviceEntry['deviceClass'], readonly CaptureCapability[]>> = Object.freeze({
  CAMERA: Object.freeze(['VIDEO'] as const),
  MIC: Object.freeze(['AUDIO'] as const),
  POE: Object.freeze([] as const),
});

/**
 * THE DEVICE ENTRY OF A STORED PRODUCTION DEVICE: label, capability and - for a camera - its
 * stored profile list in the stored order. A camera whose stored list is not of its form gets an
 * EMPTY list (no profile is assumed, decision C36), and `malformed` says so; every other class has
 * no profile.
 */
export function productionDeviceEntryOf(stored: { readonly id: string; readonly kind: CaptureDeviceEntry['deviceClass']; readonly model: string | null }, profiles: unknown): { readonly entry: CaptureDeviceEntry; readonly malformed: boolean } {
  const read = stored.kind === 'CAMERA' ? storedProfilesOf(profiles) : Object.freeze([]);
  return {
    entry: Object.freeze({ id: stored.id, deviceClass: stored.kind, label: stored.model ?? stored.id, capabilities: PRODUCTION_CAPABILITIES[stored.kind], profiles: read ?? Object.freeze([]) }),
    malformed: read === null,
  };
}
