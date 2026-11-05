/**
 * THE SEGMENT SWEEP OF SMART ATTACH (decision D62, ratified 2026-11-05; the third trigger of the
 * contract, `CaptureDiscoveryTrigger.AUTO`; rule G-R13 amended by delta, its teeth unchanged).
 *
 * WHAT IT IS. Behind `DEMS_CAMERA_AUTOATTACH=1` the Core owns the attaching: every 60 seconds it
 * reads the HOST'S OWN neighbour table (`ip -4 neigh show`, one fixed row over the host-command
 * seam style of the capture boot), keeps the addresses of `DEMS_CAMERA_SEGMENT_CIDR` that are not
 * itself, not a registered camera and not already a live candidate, probes each of them with the
 * ONVIF HTTP handshake and an RTSP OPTIONS (any answer at all counts: presence without
 * WS-Discovery consent, the UNIVIEW class of silent devices), and merges what answers into the
 * ordinary candidate store as ONE search per sweep - trigger `AUTO`, owner session `SYSTEM` -
 * through the SAME `begin`/`complete` door of `store.ts` that the two operator triggers use. The
 * read and adopt surfaces of operations 94 to 96 are unchanged; only the trigger enum grew.
 *
 * THE RULE KEEPS ITS TEETH (R-9 AC-10 stands). No caller supplies a target to this file: it reads
 * no request, no address, no subnet beyond the ONE /24 the configuration names, and it sends NO
 * WS-Discovery probe - the static rule G-R13 still pins the one call site of `discover` to
 * `search.ts` (see the guard's control in `src/capture/__tests__/static.test.ts`). Its targets are
 * the Core's OWN ARP observations. The sweep is single-flight, skips while any search runs, and
 * skips while a session RECORDS unless the lift of D86 C-4 is on (the same lift as everywhere).
 *
 * WHAT IT THEN DOES WITH A FRESH CANDIDATE (D62 point 4) - only when the bench pair
 * `DEMS_CAMERA_DEFAULT_USER` + `DEMS_CAMERA_DEFAULT_PASSWORD` is configured: it runs the EXISTING
 * connection-test path (operation 95's own flow, the credential sealed, never logged), and on
 * `REACHABLE` the EXISTING adoption flow (operation 96: device, credential row and audit rows in
 * one transaction), then assigns the new camera to the FIRST EMPTY video track through the
 * EXISTING selector action (operation 78's hosted action). A filled track is NEVER touched; a
 * camera that already holds a slot is skipped and said (pairwise C93); at most four devices are
 * adopted per sweep. Without the pair the sweep still lists what answers - nothing is tested,
 * adopted or assigned.
 *
 * ACTOR SYSTEM. The search's own audit row is written by this file with `actorId: null`: the
 * convention of the system-written rows, the `FAULT_CLEARED` precedent (the audit writer takes an
 * operator id or null and never a name). The test, adoption and selector rows are written by the
 * services themselves under the SYSTEM caller the wiring hands them.
 *
 * NOTHING HERE THROWS INTO A TIMER. Every failure - the neighbour table unreadable, a probe that
 * dies, a refused test, a locked selector - is a warn line with a code and counts only, never an
 * address, never a credential, and never an exception out of `sweep` or the tick.
 *
 * TESTABILITY. Every outside world is a parameter: `listNeighbours`, `probeAddress`,
 * `ownAddresses`, `registeredAddresses`, `store`, `audit`, `attach`, `schedule`. The unit tests
 * (`__tests__/segment-scan.test.ts`) drive the sweep over fakes; the production implementations
 * (`listNeighboursOver`, `ownInterfaceAddresses` here and `probeSegmentAddress` in
 * `src/segment-probe-socket.ts`, the file of no unit that holds the two raw probes) are wired by
 * the module's plugin behind the configuration flag and nowhere else.
 */
import { networkInterfaces } from 'node:os';
import {
  CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN,
  CaptureCandidateStatus,
  CaptureConnectionOutcome,
  CaptureDiscoveryScope,
  CaptureDiscoveryState,
  CaptureDiscoveryTrigger,
  captureDiscoverySearchedDetails,
  type CaptureCandidate,
  type CaptureConnectionTest,
  type CaptureDiscoverySearch,
} from '@dems/shared/api';
import { SessionState, VIDEO_TRACK_IDS, type VideoTrackId } from '@dems/shared/domain';
import { sourceClassOf, type CameraCandidate, type CaptureAdapterKind } from '../../capture/adapters';
import type { HostCommandRunner } from '../../capture';
import type { AuditEntry } from '../../core';
import type { CandidateStore, FoundCandidate } from './store';

// ── The bounds of the sweep (decision D62) ──────────────────────────────────────────────────────

/** D62: the sweep period. One timer, started at module registration only while `DEMS_CAMERA_AUTOATTACH=1`. */
export const AUTOATTACH_SWEEP_INTERVAL_MS = 60_000;
/** D62: at most four devices are auto-adopted per sweep; the rest wait for the next one. */
export const AUTOATTACH_MAX_ADOPTS_PER_SWEEP = 4;
/** The owner key of the AUTO searches in the candidate store: no auth session is `SYSTEM`, so no read can reach it but the wiring's own. */
export const SYSTEM_OWNER_SESSION_ID = 'SYSTEM';
/** The model text a segment-probe candidate carries: says by itself how it was found; no device text is trusted. */
export const SEGMENT_PROBE_MODEL = 'segment probe';
/** The ONE fixed row the sweep asks the host: the kernel's neighbour table, IPv4, read-only. No value of data reaches it (the style of the boot's table, SR-4). The row's form is the parameter type of the injected runner, held to the capture unit's own shape. */
export const SEGMENT_NEIGHBOUR_COMMAND: Parameters<HostCommandRunner>[0] = Object.freeze({
  program: '/usr/sbin/ip',
  args: Object.freeze(['-4', 'neigh', 'show']) as readonly string[],
});

// ── The shapes of the seams ─────────────────────────────────────────────────────────────────────

/** One live entry of the neighbour table: an IPv4 literal and the hardware address the kernel learnt. */
export interface SegmentNeighbour {
  readonly ip: string;
  readonly mac: string | null;
}

/** What the two probes answered for one address. ANY HTTP response counts as `onvif` (even a 4xx, a 5xx or a SOAP fault); ANY RTSP status reply counts as `rtsp`. */
export interface AddressProbe {
  readonly onvif: boolean;
  readonly rtsp: boolean;
}

/** Why a sweep did not run. `FAILED` is any unexpected throw: logged at warn, never handed on. */
export type SweepSkip = 'BUSY' | 'RECORDING' | 'SEARCH_RUNNING' | 'LIST_UNREADABLE' | 'FAILED';

/** What one sweep says when it ends. Counts and ids only - never an address, never a credential. */
export interface SweepResult {
  readonly ran: boolean;
  readonly skipped: SweepSkip | null;
  readonly probed: number;
  readonly found: number;
  readonly adopted: readonly string[];
}

/** The outcome of the first-empty-track assignment of D62: assigned, or skipped with a closed reason word. */
export interface SegmentTrackAssignment {
  readonly assigned: boolean;
  readonly trackId: VideoTrackId | null;
  readonly reason: 'NO_EMPTY_TRACK' | 'PAIRWISE' | 'LOCKED' | 'REFUSED' | null;
}

/**
 * The attach steps of D62 point 4, as seams. The production wiring implements them over the
 * EXISTING flows: `testCandidate` and `adoptCandidate` are operations 95 and 96 of the connect
 * flow run as the SYSTEM caller with the bench credential, and `assignFirstEmptyTrack` runs the
 * hosted action of operation 78 under the same caller. They may throw; the sweep catches every
 * throw at warn and moves on to the next candidate.
 */
export interface SegmentAttach {
  testCandidate(candidateId: string): Promise<CaptureConnectionTest | CaptureConnectionOutcome>;
  adoptCandidate(candidateId: string): Promise<string | null>;
  assignFirstEmptyTrack(deviceId: string): Promise<SegmentTrackAssignment>;
}

/** Codes and counts: the log of the sweep. A failure never carries an address or a credential. */
export interface SegmentScanLog {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}

export interface SegmentSweepOptions {
  /** The one `/24` the sweep reads (`DEMS_CAMERA_SEGMENT_CIDR`), already parsed by the configuration. */
  readonly segmentCidr: string;
  /** The server clock. */
  readonly now: () => number;
  /** The host's neighbour table, filtered to the segment; null when the host could not be asked (fail-closed: no sweep). */
  readonly listNeighbours: () => Promise<readonly SegmentNeighbour[] | null>;
  /** The two probes of one address. Must resolve; a dead probe resolves `{onvif:false, rtsp:false}`. */
  readonly probeAddress: (ip: string) => Promise<AddressProbe>;
  /** The IPv4 addresses of this host's own interfaces: never a target. */
  readonly ownAddresses: () => readonly string[];
  /** The stored `capture_devices.address` values: a registered camera is never re-listed. */
  readonly registeredAddresses: () => Promise<readonly string[]>;
  /** The candidate store: the sweep enters through `begin`/`complete`, the same door as the two operator triggers. */
  readonly store: CandidateStore;
  /** Mints the search id of one sweep (13-digit clock form, the `rescanSearchId` idiom: no counter, excluded from the chain read). */
  readonly nextSearchId: () => string;
  /** Writes the ONE `CAPTURE_DISCOVERY_SEARCHED` row of the sweep, actor SYSTEM (`actorId: null`, the FAULT_CLEARED precedent). */
  readonly audit: (entry: AuditEntry) => Promise<void>;
  readonly log: SegmentScanLog;
  /** The open session of the engine, or null: the sweep skips while it RECORDS (the lift of D86 C-4 applies, as everywhere). */
  readonly openSession: () => { readonly id: string; readonly state: string } | null;
  /** The lift of D86 C-4: `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` of the contract. */
  readonly duringRecordingEnabled: boolean;
  /** D62 point 4: present exactly when the bench pair is configured. Absent: candidates are listed, nothing is attached. */
  readonly attach?: SegmentAttach;
  /** The scheduler of the timer: production uses a 60 s interval; a test hands in its own and asserts the period. */
  readonly schedule?: (tick: () => void) => () => void;
  /** The listening window the merged search states; 0: the sweep's answers are complete when it begins it. */
  readonly windowMs?: number;
  readonly maxAdoptsPerSweep?: number;
}

export interface SegmentSweeper {
  /** One sweep. Never rejects; the result says what ran, was skipped or found. */
  sweep(): Promise<SweepResult>;
  /** Starts the 60 s timer (idempotent). The wiring calls it only while `DEMS_CAMERA_AUTOATTACH=1`. */
  start(): void;
  stop(): void;
}

// ── The neighbour table: parsing and the fixed row ──────────────────────────────────────────────

/** The neighbour states in which the kernel holds a live entry with a hardware address it learnt (the fence's rule, same words). */
const LIVE_NEIGHBOUR_STATES: ReadonlySet<string> = new Set(['REACHABLE', 'STALE', 'DELAY', 'PROBE']);
const NO_PROBE: AddressProbe = Object.freeze({ onvif: false, rtsp: false });

/** The three leading octets of the segment, or null for a text that is not the strict `/24` the configuration promises. */
export function segmentCidrOctets(cidr: string): readonly [number, number, number] | null {
  const [address = '', prefix = ''] = cidr.split('/');
  if (prefix !== '24' || !CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN.test(address)) return null;
  const parts = address.split('.').map(Number);
  return parts.length === 4 ? [parts[0] as number, parts[1] as number, parts[2] as number] : null;
}

/** True when `ip` is a strict dotted quad INSIDE the segment of the three leading octets. */
export function ipInSegment(ip: string, octets: readonly [number, number, number]): boolean {
  if (!CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN.test(ip)) return false;
  const parts = ip.split('.').map(Number);
  return parts[0] === octets[0] && parts[1] === octets[1] && parts[2] === octets[2];
}

/**
 * The rows of `ip -4 neigh show` that say "a host of our segment is there": one strict quad inside
 * the segment, a live state and a learnt `lladdr`. A line without a hardware address, a FAILED or
 * INCOMPLETE entry, a router line and anything that is not a quad are dropped. Duplicates by ip
 * collapse to the first. NEVER logs: the table is the host's, the parse is a pure function.
 */
export function parseNeighbourTable(output: string, octets: readonly [number, number, number]): SegmentNeighbour[] {
  const found: SegmentNeighbour[] = [];
  const seen = new Set<string>();
  for (const line of output.split('\n')) {
    const parts = line.trim().split(/\s+/);
    const ip = parts[0] ?? '';
    if (parts.length < 2 || !ipInSegment(ip, octets) || seen.has(ip)) continue;
    const state = parts[parts.length - 1] ?? '';
    if (!LIVE_NEIGHBOUR_STATES.has(state)) continue;
    const at = parts.indexOf('lladdr');
    const mac = at === -1 ? null : (parts[at + 1] ?? null);
    if (mac === undefined || mac === null || !/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) continue;
    seen.add(ip);
    found.push({ ip, mac });
  }
  return found;
}

/**
 * The production `listNeighbours`: ONE fixed row over the injected host-command runner (the style
 * of the boot's table; the runner is the door's, made by `captureHostRunnerOf`), read through
 * `parseNeighbourTable`. Anything the host cannot answer - not started, timed out, a code but 0, a
 * throw - is null: the sweep fails CLOSED and says so at warn. It never retries and never caches.
 */
export function listNeighboursOver(run: HostCommandRunner, cidr: string): () => Promise<readonly SegmentNeighbour[] | null> {
  const octets = segmentCidrOctets(cidr);
  return async () => {
    if (octets === null) return null;
    let answer: Awaited<ReturnType<HostCommandRunner>>;
    try {
      answer = await run(SEGMENT_NEIGHBOUR_COMMAND);
    } catch {
      return null;
    }
    if (answer.outcome !== 'RAN' || answer.exitCode !== 0) return null;
    return parseNeighbourTable(answer.output, octets);
  };
}

/** The IPv4 addresses of this host's own interfaces: the sweep never dials itself. */
export function ownInterfaceAddresses(): readonly string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) if (entry.family === 'IPv4' && typeof entry.address === 'string') addresses.push(entry.address);
  }
  return addresses;
}

/** The search id of one sweep (decision D62): the 13-digit clock form of `rescanSearchId` - no counter of its own, and the camera chain's read of six to nine digits (`search-ids.ts`) never counts it. The sweep number rides as the last digit, so two sweeps in one millisecond still differ. */
export const autoSearchIdOf = (atMs: number, sweepNumber: number): string => `DSC-${String(Math.trunc(atMs)).padStart(12, '0')}${String(Math.abs(Math.trunc(sweepNumber)) % 10)}`;

// ── The two probes of one address ───────────────────────────────────────────────────────────────
//
// The production implementation is NOT here: the server's network rules (SR-03/P5/P21 in
// `test/static/network.test.ts`, G-R1 in this folder's guard family) let no file of the host units
// open a socket or call the global fetch. The probe lives in `src/segment-probe-socket.ts` - a
// file of no unit beside `host-alias-socket.ts`, the D62 named entry of the outbound-module rule -
// and the wiring hands it in as the `probeAddress` seam below. ANY HTTP response counts as `onvif`
// (even a 4xx, a 5xx or a SOAP fault); ANY RTSP status reply counts as `rtsp`; each probe is bound
// to `SEGMENT_PROBE_BOUND_MS` (2 s) in that file and neither ever throws.

// ── The candidate the sweep synthesises (foundOf-style, `search.ts` the shape teacher) ─────────

/**
 * One probed address as the store's `FoundCandidate`: adapter `ONVIF_RTSP` when the ONVIF handshake
 * answered else `LOCAL_DEVICE` (a development class - the Core saw life, not an identity); the
 * connection target the Core itself would dial, `http://ip:80/onvif/device_service`; the model
 * `segment probe` and no other announced text (nothing a device said is believed here); scopes
 * empty and `onvifUuid` null - an AUTO candidate carries NO endpoint identity, so it matches no
 * registered camera by reference and the registry's whole-address rule alone decides `REGISTERED`.
 * A candidate whose only answer was RTSP is listed but not testable (no service address qualifies).
 */
export function foundOfProbe(ip: string, probe: AddressProbe): FoundCandidate {
  const adapterKind: CaptureAdapterKind = probe.onvif ? 'ONVIF_RTSP' : 'LOCAL_DEVICE';
  const serviceAddress = probe.onvif ? `http://${ip}:80/onvif/device_service` : null;
  const camera: CameraCandidate = {
    adapterKind,
    host: ip,
    serviceAddress,
    endpointRef: null,
    vendor: null,
    model: SEGMENT_PROBE_MODEL,
    name: null,
    testable: probe.onvif,
    conflict: false,
  };
  return {
    adapter: adapterKind,
    // Derived by the Core from the adapter kind by the ONE function (C3 §2.6); a client never sets it.
    sourceClass: sourceClassOf(adapterKind),
    host: ip,
    endpointRef: null,
    vendor: null,
    model: SEGMENT_PROBE_MODEL,
    name: null,
    status: CaptureCandidateStatus.NEW,
    deviceId: null,
    testable: probe.onvif,
    ...(serviceAddress === null ? {} : { connectionTarget: serviceAddress }),
    conflict: false,
    addressChanged: false,
    camera,
  };
}

/** The hosts every live candidate list holds now, over ALL sessions - the sweep never re-probes what is already on somebody's list. */
export function liveCandidateHosts(store: CandidateStore, now: number): ReadonlySet<string> {
  const hosts = new Set<string>();
  for (const sessionId of store.sessionIds()) {
    for (const candidate of store.stateOf(sessionId, now).candidates) hosts.add(candidate.host);
  }
  return hosts;
}

// ── The selector rules of D62 point 4 (the assignment is the service's; the choice is here) ────

/** The FIRST video track that holds no line (an unassigned slot is an absent line, C14); null when all four are filled. */
export function firstEmptyVideoTrack(cameras: readonly { readonly trackId: VideoTrackId }[]): VideoTrackId | null {
  const filled = new Set(cameras.map((camera) => camera.trackId));
  return VIDEO_TRACK_IDS.find((trackId) => !filled.has(trackId)) ?? null;
}

/** Pairwise C93 in the sweep's own words: a camera that already holds a slot gets no second one from the auto path. */
export function holdsAlready(cameras: readonly { readonly deviceId: string }[], deviceId: string): boolean {
  return cameras.some((camera) => camera.deviceId === deviceId);
}

// ── The sweep ───────────────────────────────────────────────────────────────────────────────────

const SOURCE = 'captureDiscovery.segmentScan';
const SWEEP_SKIPPED = 'segment sweep skipped';
const SWEEP_CLOSED = 'segment sweep closed';
const ATTACH_FAILED = 'the SMART ATTACH step failed; the candidate stays as it is';

const skipped = (reason: SweepSkip): SweepResult => ({ ran: false, skipped: reason, probed: 0, found: 0, adopted: [] });

/** The ONE audit row of a sweep: `CAPTURE_DISCOVERY_SEARCHED`, trigger AUTO, actor SYSTEM (`actorId: null` - the FAULT_CLEARED precedent for system-written rows). Counts and codes, never an address. */
export function autoSearchedEntry(search: CaptureDiscoverySearch): AuditEntry {
  const failed = search.state === CaptureDiscoveryState.FAILED;
  return {
    type: 'CAPTURE_DISCOVERY_SEARCHED',
    message: failed ? 'Camera search could not run' : `Camera search performed (${search.responderCount} answered)`,
    severity: failed ? 'WARNING' : 'INFO',
    // Actor SYSTEM: the convention of the system-written rows (the FAULT_CLEARED precedent) - null, never a typed name (SR-54).
    actorId: null,
    deviceId: null,
    details: captureDiscoverySearchedDetails({
      searchId: search.searchId,
      scope: CaptureDiscoveryScope.CAMERA_NETWORK,
      trigger: CaptureDiscoveryTrigger.AUTO,
      outcome: failed ? 'FAILED' : 'COMPLETE',
      responderCount: search.responderCount,
      newCount: search.newCount,
      registeredCount: search.registeredCount,
      interfaceCount: search.interfaceCount,
      failureReason: search.failureReason,
      sessionId: null,
      operationId: null,
      permission: null,
    }),
  };
}

export function createSegmentSweeper(options: SegmentSweepOptions): SegmentSweeper {
  const { store, log } = options;
  const windowMs = options.windowMs ?? 0;
  const maxAdopts = options.maxAdoptsPerSweep ?? AUTOATTACH_MAX_ADOPTS_PER_SWEEP;
  let busy = false;
  let stopSchedule: (() => void) | null = null;

  /** D62 point 4, over the fresh testable candidates of THIS sweep's list, capped at four adopts. Every step may fail; none may stop the next or the timer. */
  const attachFresh = async (adopted: string[]): Promise<void> => {
    const attach = options.attach;
    if (attach === undefined) return;
    const fresh = store
      .stateOf(SYSTEM_OWNER_SESSION_ID, options.now())
      .candidates.filter((candidate: CaptureCandidate) => candidate.status === CaptureCandidateStatus.NEW && candidate.testable);
    for (const candidate of fresh) {
      if (adopted.length >= maxAdopts) {
        log.warn({ code: 'CAPTURE_AUTOATTACH_CAP', source: SOURCE, left: fresh.length - adopted.length }, 'the SMART ATTACH cap of four adopts per sweep is reached; the rest wait for the next sweep');
        return;
      }
      try {
        const tested = await attach.testCandidate(candidate.candidateId);
        const outcome = typeof tested === 'string' ? tested : tested.outcome;
        if (outcome !== CaptureConnectionOutcome.REACHABLE) {
          log.warn({ code: 'CAPTURE_AUTOATTACH_NOT_REACHABLE', source: SOURCE, candidateId: candidate.candidateId, outcome }, 'the SMART ATTACH connection test did not reach the candidate; it is not adopted');
          continue;
        }
        const deviceId = await attach.adoptCandidate(candidate.candidateId);
        if (deviceId === null) continue;
        adopted.push(deviceId);
        const assignment = await attach.assignFirstEmptyTrack(deviceId);
        if (assignment.assigned && assignment.trackId !== null) {
          log.info({ code: 'CAPTURE_AUTOATTACH_ASSIGNED', source: SOURCE, deviceId, trackId: assignment.trackId }, 'a probe-backed camera was auto-adopted and put on its first empty video track');
        } else {
          log.warn({ code: 'CAPTURE_AUTOATTACH_TRACK_SKIPPED', source: SOURCE, deviceId, skipReason: assignment.reason }, 'the auto-adopted camera holds no track: a filled track is never moved and a pairwise collision is never made');
        }
      } catch (error) {
        const code = typeof (error as { code?: unknown } | null)?.code === 'string' ? String((error as { code: string }).code) : 'UNKNOWN';
        log.warn({ code: 'CAPTURE_AUTOATTACH_FAILED', source: SOURCE, candidateId: candidate.candidateId, failureCode: code }, ATTACH_FAILED);
      }
    }
  };

  const sweep = async (): Promise<SweepResult> => {
    // Single-flight, in both directions: no second sweep while one runs, and none while ANY search - operator, pre-check or sweep - holds the one socket-place of the store.
    if (busy) return skipped('BUSY');
    if (!options.duringRecordingEnabled && options.openSession()?.state === SessionState.RECORDING) {
      log.info({ code: 'CAPTURE_AUTOATTACH_SKIPPED_RECORDING', source: SOURCE }, SWEEP_SKIPPED);
      return skipped('RECORDING');
    }
    if (store.running() !== null) return skipped('SEARCH_RUNNING');
    busy = true;
    const startedAt = options.now();
    try {
      const neighbours = await options.listNeighbours();
      if (neighbours === null) {
        log.warn({ code: 'CAPTURE_AUTOATTACH_LIST_UNREADABLE', source: SOURCE }, 'the host\'s neighbour table could not be read; this sweep asks nothing');
        return skipped('LIST_UNREADABLE');
      }
      const registered = new Set((await options.registeredAddresses()).map((address) => (address.includes(':') && !address.includes('::') ? address.slice(0, address.lastIndexOf(':')) : address)));
      const own = new Set(options.ownAddresses());
      const live = liveCandidateHosts(store, options.now());
      const targets = neighbours.filter((entry) => !own.has(entry.ip) && !registered.has(entry.ip) && !live.has(entry.ip));
      // The probes run side by side; a probe that dies says nothing and fails to "no".
      const probes = await Promise.all(targets.map(async (entry): Promise<{ readonly ip: string; readonly probe: AddressProbe }> => ({ ip: entry.ip, probe: await options.probeAddress(entry.ip).catch(() => NO_PROBE) })));
      const found = probes.filter((entry) => entry.probe.onvif || entry.probe.rtsp).map((entry) => foundOfProbe(entry.ip, entry.probe));
      // ONE AUTO search per sweep, through the store's own door: begin, complete, the row. The list replaces the sweep's previous one, as any new search replaces its owner's.
      const searchId = options.nextSearchId();
      store.begin({ sessionId: SYSTEM_OWNER_SESSION_ID, searchId, trigger: CaptureDiscoveryTrigger.AUTO, startedAt, windowMs, interfaceCount: 1 });
      const search = store.complete(searchId, found, { responderCount: found.length, interfaceCount: 1, truncated: false, completedAt: options.now() });
      if (search === null) return skipped('FAILED');
      try {
        await options.audit(autoSearchedEntry(search));
      } catch {
        // The sweep itself stands; a missing row is a fault for tomorrow's team, said once at warn.
        log.warn({ code: 'CAPTURE_DISCOVERY_AUDIT_FAILED', source: SOURCE, searchId }, 'the audit row of a segment sweep could not be written');
      }
      const adopted: string[] = [];
      await attachFresh(adopted);
      log.info({ code: 'CAPTURE_AUTOATTACH_SWEEP', source: SOURCE, searchId, probed: probes.length, found: found.length, adopted: adopted.length, durationMs: options.now() - startedAt }, SWEEP_CLOSED);
      return { ran: true, skipped: null, probed: probes.length, found: found.length, adopted };
    } catch (error) {
      const code = typeof (error as { code?: unknown } | null)?.code === 'string' ? String((error as { code: string }).code) : 'UNKNOWN';
      log.warn({ code: 'CAPTURE_AUTOATTACH_SWEEP_FAILED', source: SOURCE, failureCode: code }, 'the segment sweep failed; the timer keeps its place');
      return skipped('FAILED');
    } finally {
      busy = false;
    }
  };

  return {
    sweep,
    start() {
      if (stopSchedule !== null) return;
      const tick = (): void => {
        // Never throws into the timer: sweep() itself never rejects, and the catch is the belt.
        void sweep().catch(() => undefined);
      };
      const schedule =
        options.schedule ??
        ((run: () => void) => {
          const handle = setInterval(run, AUTOATTACH_SWEEP_INTERVAL_MS);
          handle.unref();
          return () => clearInterval(handle);
        });
      stopSchedule = schedule(tick);
    },
    stop() {
      stopSchedule?.();
      stopSchedule = null;
    },
  };
}
