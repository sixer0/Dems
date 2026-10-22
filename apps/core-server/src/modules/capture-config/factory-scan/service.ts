/**
 * What operation 103 `scanFactoryCameras` does (task 4 blueprint row 107, package WP-19c; contract
 * `packages/shared/src/api/capture-commissioning.ts`, row 102; decisions U9 (an ACTIVE scan, once,
 * because an operator asked), U10, C19 (one temporary address at a time); security requirements
 * S13-11 (the one destination rule), S13-12 (b) (device text), S13-10 (the temporary address is
 * taken away again); design rule DR-6).
 *
 * THE SCAN asks the STORED factory addresses and at most ONE typed address whether a camera
 * answers there. Nothing else can be scanned: no range, no subnet, no port, no interface.
 *
 * EVERYTHING THAT TOUCHES THE HOST OR THE NETWORK IS A PORT (`FactoryScanParts`), handed in by the
 * composition of production capture. This file opens nothing, starts nothing, reads no clock of
 * its own and logs through its host:
 *   rule    `decideDestination` of the capture unit with the purpose of a commissioning scan, on
 *           the facts this file states. It is the ONLY judge of an address;
 *   alias   the temporary host address: `helper` (dials nothing), `add`, `remove` - the shape of
 *           the Core's one caller of the address helper (row 105), behind its lifecycle (row 106);
 *   probe   THE SCAN'S OWN PROBE CALL (static rule G-R13 kept: never the camera search): one
 *           question to ONE address the rule admitted, from the source the rule named;
 *   mac     the host's neighbour table, optional: asked once for an address that answered.
 *
 * THE ORDER. Each refusal sends NOTHING to any address, asks for NO temporary address and writes
 * NO audit entry:
 *
 *   409 CAPTURE_CONFIG_LOCKED                             a session is open (idle only)
 *   409 INVALID_STATE  COMMISSIONING_NOT_AVAILABLE        this Core is not in production capture, was
 *                                                         handed no parts, the helper does not exist on
 *                                                         this platform, or the host cannot be read
 *   409 INVALID_STATE  COMMISSIONING_JOB_IN_PROGRESS      a scan runs (one at a time per Core)
 *   409 INVALID_STATE  COMMISSIONING_HELPER_NOT_CONFIGURED the helper cannot be reached as installed
 *   409 INVALID_STATE  COMMISSIONING_NOT_CONFIGURED       no interface or subnet is chosen, or the host
 *                                                         has no such interface
 *   422 INVALID_INPUT  COMMISSIONING_ADDRESS_NOT_ALLOWED  the rule refuses the TYPED address
 *   429 RATE_LIMITED   COMMISSIONING_SCAN_RATE_LIMITED    sooner than the spacing after the last scan
 *
 * A STORED address the rule refuses is not asked and not counted; the scan goes on with the others.
 *
 * THE TEMPORARY ADDRESS. An address outside the camera subnet is reached only from a temporary
 * address in its own /24 (`<its /24>.<aliasHost>`). An address is judged TWICE: first on the facts
 * with that temporary address supposed (so that a refusal is known before anything is asked of the
 * helper), then - after the helper said the address is in place - on the facts the host states
 * NOW. Only a target the second judgement admits FROM THAT TEMPORARY ADDRESS is dialled. An
 * address that is already on the camera port and was not added by this scan is never a source.
 * Whatever happens after `add` was called - an answer that is no confirmation, no answer at all, a
 * probe that throws - `remove` is asked for that address before the next step; only an `add` that
 * itself answered "certainly nothing was changed" is followed by no removal, because nothing of
 * this scan is there and the address may be another operation's. The groups that need a
 * temporary address run first: when the first cannot be put in place, nothing was asked of any
 * device. An `add` that is not confirmed ends the scan (409 HOST_ALIAS_FAILED): a partial list
 * would read as "no camera there".
 *
 * THE RESULT IS IN MEMORY ONLY. Nothing of it is stored, no candidate and no capture device is
 * made. ONE audit entry says that a scan ran: counts and codes, never an address, never a text.
 *
 * DEVICE TEXT (vendor, model, name) is untrusted. It leaves this file in the answer only, after
 * the rule of `announcedTextOf` (bounded, control characters taken out). It is in no log line, no
 * audit detail, no error and no persisted failure; what a probe THROWS is never read for a text.
 */
import {
  ApiErrorCode,
  CAPTURE_CANDIDATE_TEXT_MAX_LENGTH,
  CAPTURE_COMMISSIONING_REFUSAL_SENTENCES,
  CAPTURE_DISCOVERY_MIN_INTERVAL_MS,
  CAPTURE_MAC_ADDRESS_PATTERN,
  CAPTURE_NETWORK_CONFIG_LIMITS,
  CaptureCommissioningReason,
  FactoryCameraDeviceCount,
  HostAliasReason,
  HostAliasSchema,
  RETRY_AFTER_HEADER_NAME,
  type CameraFactoryScan,
  type CameraFactoryScanRequest,
  type FactoryCamera,
  type HostAlias,
} from '@dems/shared/api';
import { AuditType, Permission } from '@dems/shared/sim';
import type { DestinationContext } from '../../../capture/fence';
import type { AuditEntry } from '../../../core';
import { ApiFailure } from '../../../plugins/error-envelope';

// ── The ports ──────────────────────────────────────────────────────────────────────────────────

/** The operator behind a request, as stage 4 resolved it. */
export interface FactoryScanCaller {
  readonly operatorId: string;
  readonly deviceId: string | null;
}

/**
 * An address the rule admitted, BY SHAPE (`AllowedDestination` of the capture unit fits it): the
 * rule's own rebuilt text, the port, the source the dial leaves from and whether that source is a
 * temporary address. THE RULE'S OBJECT IS HANDED ON UNCHANGED: this file makes no such answer
 * (static rule SR-2 (2) of the capture unit), it reads the two source members - held to a text and
 * a truth value in `judged` before anything is done with them - and gives the same object to the
 * probe, which binds its dial to `sourceAddress` under its own form rule.
 */
export interface FactoryScanDestination {
  readonly address: string;
  readonly port: number;
  readonly sourceAddress?: unknown;
  readonly viaAlias?: unknown;
}

/** The decision of the capture unit's destination rule, as far as this file reads it. */
export type FactoryScanRuleDecision = { readonly allowed: true; readonly destination: FactoryScanDestination } | { readonly allowed: false; readonly refusal?: unknown };

/** THE RULE: `decideDestination` with the purpose of a commissioning scan, on the facts stated. */
export type FactoryScanRule = (address: string, facts: DestinationContext) => FactoryScanRuleDecision;

/** Who asks for a temporary address, and why: passed through to the journal of the lifecycle, unread here. */
export interface FactoryScanAliasSubject {
  readonly operatorId: string;
  readonly deviceId: string | null;
  readonly reason: typeof HostAliasReason.FACTORY_SCAN;
  readonly operationId: 'scanFactoryCameras';
  readonly permission: typeof Permission.CAPTURE_COMMISSION;
}

/** What `add` and `remove` answer: the two members of the caller's outcome this file decides on. */
export interface FactoryScanAliasOutcome {
  /** null: done as asked. Else a word of a closed set. */
  readonly refusal: string | null;
  /** `DONE`, `NOT_DONE` or `UNKNOWN`. Only `DONE` with no refusal is a confirmation. */
  readonly effect: string;
}

/** THE TEMPORARY ADDRESS of the camera port (rows 105 and 106). */
export interface FactoryScanAlias {
  /** Whether the helper can be asked at all. Dials nothing. null: yes; else the word of the check before dialling. */
  helper(): Promise<string | null>;
  add(request: { readonly address: string; readonly minutes: number; readonly subject: FactoryScanAliasSubject }): Promise<FactoryScanAliasOutcome>;
  remove(request: { readonly address: string; readonly subject: FactoryScanAliasSubject }): Promise<FactoryScanAliasOutcome>;
  /**
   * The alias in place as the lifecycle states it, or null (task 4 row 106b; decision C78 DD-3): a
   * plain read, asked ONCE when a scan ends, for the member `alias` of the answer. Left out: null.
   */
  state?(): Promise<unknown>;
}

/** What ONE address answered. The three texts are the device's own words: untrusted, of any type and length. */
export interface FactoryScanProbeAnswer {
  /** Something answered at the address. False: the address is not listed. */
  readonly answered: boolean;
  /** The unauthenticated ONVIF check was answered. */
  readonly onvifReachable: boolean;
  /** How many distinct devices answered from the address, WHEN THE PROBE COUNTED THEM. Left out: not counted - the answer says `NOT_KNOWN`, never one. */
  readonly endpointCount?: unknown;
  readonly vendor?: unknown;
  readonly model?: unknown;
  readonly name?: unknown;
}

/** THE SCAN'S OWN PROBE CALL: one question to one admitted address, from `destination.sourceAddress`, under `signal`. */
export type FactoryScanProbe = (destination: FactoryScanDestination, signal: AbortSignal) => Promise<FactoryScanProbeAnswer>;

/** Everything the composition hands in. Without it every scan is refused. */
export interface FactoryScanParts {
  readonly rule: FactoryScanRule;
  readonly alias: FactoryScanAlias;
  readonly probe: FactoryScanProbe;
  /**
   * The hardware address the host's neighbour table holds for an address, or null. Asked ONCE per
   * address that answered its probe, inside that address's own time (`signal` is the same one);
   * what it throws, and an answer that is not six upper-case pairs, is "not known" (null). Since
   * task 4 row 111b the production value runs a program, so the answer may be a promise.
   */
  readonly mac?: (address: string, signal: AbortSignal) => Promise<string | null> | string | null;
}

/** The stored settings a scan reads (the one row of `capture_network_config`, or the contract's defaults). */
export interface FactoryScanSettings {
  /** True when both the interface and the subnet are chosen. */
  readonly configured: boolean;
  readonly factoryAddresses: readonly string[];
  readonly aliasHost: number;
  readonly aliasMinutes: number;
}

export interface FactoryScanHost {
  now(): number;
  /** True while a session is open. Throws the engine's own refusal when the engine does not run. */
  sessionOpen(): boolean;
  settings(): Promise<FactoryScanSettings>;
  /** The network facts of the host NOW (the reader of row 108). null: not configured. May throw. */
  facts(): DestinationContext | null;
  /** ONE audit entry, in a unit of its own. Rejects when it could not be written. */
  audit(entry: AuditEntry): Promise<void>;
  /** Calls `callback` once after `delayMs` unless the returned function was called first. */
  after(delayMs: number, callback: () => void): () => void;
  /** A line of the log: codes and counts only. */
  note(fields: Record<string, unknown>, message: string): void;
  /** A failure for the log AND the persistent error log: a fixed message, codes and counts. */
  failed(source: string, message: string, code: string, context: Record<string, string | number | boolean | null>): void;
}

/** One scan at a time per Core, and the spacing between two scans. */
export interface FactoryScanGate {
  /** The release function, or null while a scan runs. */
  claim(): (() => void) | null;
  /** How long a scan that would start at `now` has to wait, or 0. */
  waitMs(now: number): number;
  /** A scan starts at `now`: the spacing counts from here. */
  started(now: number): void;
  busy(): boolean;
}

export interface FactoryScanSeams {
  readonly host: FactoryScanHost;
  readonly gate: FactoryScanGate;
  /** True on a Core in production capture. */
  available(): boolean;
  /** The parts the composition handed in, or null. */
  parts(): FactoryScanParts | null;
  /**
   * Told the answer of a scan that ENDED WITH ONE (task 4 row 111; design rule DR-6): the folder's
   * mount keeps the last in memory, for the set-network job to ask what the last scan said of an
   * address. Nothing is stored. Left out: nothing is kept.
   */
  readonly remember?: (scan: CameraFactoryScan) => void;
}

// ── Bounds ─────────────────────────────────────────────────────────────────────────────────────

/** The spacing of two scans of a Core: the camera search's own number (destination rule, point 4). */
export const FACTORY_SCAN_MIN_INTERVAL_MS = CAPTURE_DISCOVERY_MIN_INTERVAL_MS;
/** How long ONE address is given to answer. */
export const FACTORY_SCAN_PROBE_TIMEOUT_MS = 2_000;
/** How many addresses of one group are asked at the same time. */
export const FACTORY_SCAN_PARALLEL_PROBES = 8;
/** The most distinct devices one address is said to hold. */
export const FACTORY_SCAN_MAX_ENDPOINTS = 16;
/** How much of a device's text is looked at at all. */
const DEVICE_TEXT_READ_LIMIT = 1_024;

export const FACTORY_SCAN_OPERATION_ID = 'scanFactoryCameras';
export const FACTORY_SCAN_SETTINGS_LABEL = 'captureFactoryScan.settings';
export const FACTORY_SCAN_AUDIT_LABEL = 'captureFactoryScan.scanned';
export const FACTORY_SCANNED_MESSAGE = 'Factory addresses scanned for cameras';
const SOURCE = 'captureFactoryScan';

/** The codes this file writes to the log and the error log. Never beside an address or a text. */
export const FactoryScanCode = {
  HOST_FACTS_UNREADABLE: 'COMMISSIONING_SCAN_HOST_FACTS_UNREADABLE',
  HELPER_NOT_ASKED: 'COMMISSIONING_SCAN_HELPER_NOT_ASKED',
  PROBE_FAILED: 'COMMISSIONING_SCAN_PROBE_FAILED',
  ALIAS_NOT_CONFIRMED: 'COMMISSIONING_SCAN_ALIAS_NOT_CONFIRMED',
  ALIAS_REMOVAL_NOT_CONFIRMED: 'COMMISSIONING_SCAN_ALIAS_REMOVAL_NOT_CONFIRMED',
} as const;

/** `details.cause` of 409 HOST_ALIAS_FAILED when the helper's word cannot be handed on, or there is none. */
export const FactoryScanAliasCause = {
  /** `add` threw, or answered what is no outcome. */
  CALL_FAILED: 'ALIAS_CALL_FAILED',
  /** The helper answered, and not with "done". */
  NOT_CONFIRMED: 'ALIAS_NOT_CONFIRMED',
  /** The helper said "done", and the host does not state the address on the camera port. */
  NOT_IN_PLACE: 'ALIAS_NOT_IN_PLACE',
} as const;

const HOST_UNREADABLE_TEXT = 'the network facts of the host could not be read: the commissioning scan was refused and nothing was asked of any address';
const HELPER_NOT_ASKED_TEXT = 'the address helper could not be asked whether it is available: the commissioning scan was refused';
const PROBE_FAILED_TEXT = 'a probe of the commissioning scan failed: the address is treated as not answering';
// (The two texts say "alias address": the word for a short-lived object is kept out of the server's strings by static rule F53.)
const ALIAS_NOT_CONFIRMED_TEXT = 'the alias address of the commissioning scan was not confirmed in place: nothing was asked from it';
const REMOVAL_NOT_CONFIRMED_TEXT = 'the removal of the alias address of the commissioning scan was not confirmed: the address may still be on the camera port';

// ── Refusals: fixed texts that quote nothing of the request and nothing of a device ────────────

const R = CaptureCommissioningReason;
const sentence = (reason: CaptureCommissioningReason): string => CAPTURE_COMMISSIONING_REFUSAL_SENTENCES[reason];
const locked = (): ApiFailure => new ApiFailure(409, ApiErrorCode.CAPTURE_CONFIG_LOCKED, 'The camera network cannot be scanned while a session is open.');
const invalidState = (reason: CaptureCommissioningReason): ApiFailure => new ApiFailure(409, ApiErrorCode.INVALID_STATE, sentence(reason), { details: { reason } });
const aliasFailed = (cause: string): ApiFailure => new ApiFailure(409, ApiErrorCode.INVALID_STATE, sentence(R.HOST_ALIAS_FAILED), { details: { reason: R.HOST_ALIAS_FAILED, cause } });
const addressNotAllowed = (): ApiFailure =>
  new ApiFailure(422, ApiErrorCode.INVALID_INPUT, sentence(R.COMMISSIONING_ADDRESS_NOT_ALLOWED), { details: { in: 'body', reason: R.COMMISSIONING_ADDRESS_NOT_ALLOWED } });
const rateLimited = (retryAfterMs: number): ApiFailure =>
  new ApiFailure(429, ApiErrorCode.RATE_LIMITED, sentence(R.COMMISSIONING_SCAN_RATE_LIMITED), {
    details: { reason: R.COMMISSIONING_SCAN_RATE_LIMITED, retryInMs: retryAfterMs },
    headers: { [RETRY_AFTER_HEADER_NAME]: String(Math.max(1, Math.ceil(retryAfterMs / 1_000))) },
  });

/** The word of the helper's check for "no such helper on this platform" (`HostAliasTransportFailure`, row 105). */
const NOT_THIS_PLATFORM = 'NOT_AVAILABLE_ON_THIS_PLATFORM';
const DONE = 'DONE';
const NOT_DONE = 'NOT_DONE';
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
/** A word of a closed set as it may travel in `details.cause` and in a log line; anything else is the fallback. */
const codeOr = (value: unknown, fallback: string): string => (typeof value === 'string' && CODE.test(value) ? value : fallback);

// ── The gate ───────────────────────────────────────────────────────────────────────────────────

/** One scan at a time per Core and the spacing between two. A clock that went back is refused for the whole interval. */
export function createFactoryScanGate(intervalMs: number = FACTORY_SCAN_MIN_INTERVAL_MS): FactoryScanGate {
  let running = false;
  let lastStartedAt: number | null = null;
  return {
    claim() {
      if (running) return null;
      running = true;
      let released = false;
      return () => {
        if (!released) running = false;
        released = true;
      };
    },
    waitMs(now) {
      if (lastStartedAt === null) return 0;
      if (!Number.isFinite(now) || now < lastStartedAt) return intervalMs;
      return Math.max(0, intervalMs - (now - lastStartedAt));
    },
    started(now) {
      lastStartedAt = now;
    },
    busy: () => running,
  };
}

// ── Device text ────────────────────────────────────────────────────────────────────────────────

/** A character that is taken out of a device's text: controls, line and paragraph separators, direction marks, invisible marks, an unpaired surrogate. */
function dropped(point: number): boolean {
  return (
    point <= 0x1f ||
    (point >= 0x7f && point <= 0x9f) ||
    (point >= 0x200b && point <= 0x200f) ||
    (point >= 0x2028 && point <= 0x202e) ||
    (point >= 0x2060 && point <= 0x2069) ||
    point === 0xfeff ||
    (point >= 0xd800 && point <= 0xdfff) ||
    (point >= 0xfff9 && point <= 0xfffb)
  );
}

/**
 * THE TEXT RULE of this file for what a device announced: a string only; at most the first 1,024
 * units are looked at; control and invisible characters are taken out; white space is made one
 * space; at most 120 characters are kept. Nothing left: null. Markup is NOT interpreted and not
 * taken out - the contract says the text is drawn as text only.
 */
export function announcedTextOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const kept: string[] = [];
  let space = false;
  for (const character of value.slice(0, DEVICE_TEXT_READ_LIMIT)) {
    const point = character.codePointAt(0) ?? 0;
    if (point === 0x09 || point === 0x0a || point === 0x0d || point === 0x20 || point === 0xa0) {
      space = kept.length > 0;
      continue;
    }
    if (dropped(point)) continue;
    if (kept.length >= CAPTURE_CANDIDATE_TEXT_MAX_LENGTH) break;
    if (space && kept.length < CAPTURE_CANDIDATE_TEXT_MAX_LENGTH - 1) kept.push(' ');
    space = false;
    kept.push(character);
  }
  // 120 CHARACTERS may be more than 120 units (a character outside the basic plane is two): cut to the contract's length.
  let text = kept.join('');
  while (text.length > CAPTURE_CANDIDATE_TEXT_MAX_LENGTH) {
    kept.pop();
    text = kept.join('');
  }
  return text.length === 0 ? null : text;
}

/**
 * How many devices the PROBE COUNTED at an address, or null: it did not count (security review of
 * row 119, caution R119-03; decision C94 (a)). A member left out, and anything that is no whole
 * number from 1, is "NOT COUNTED" - never one. The production probe asks one address once and
 * leaves the member out (the count is amendment SR-13, not built), so a production scan answers
 * `NOT_KNOWN` for every device.
 */
function endpointCountOf(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null;
  return Math.min(value, FACTORY_SCAN_MAX_ENDPOINTS);
}

/** The closed three-state member of the answer: what the Core KNOWS of the number of devices. */
export function deviceCountOf(endpointCount: number | null): FactoryCameraDeviceCount {
  if (endpointCount === null) return FactoryCameraDeviceCount.NOT_KNOWN;
  return endpointCount > 1 ? FactoryCameraDeviceCount.MORE_THAN_ONE : FactoryCameraDeviceCount.ONE;
}

/** Never rejects and never outlives `signal`: a port that throws, answers another form or does not settle is "not known". */
async function macOf(parts: FactoryScanParts, address: string, signal: AbortSignal): Promise<string | null> {
  if (parts.mac === undefined || signal.aborted) return null;
  let giveUp: () => void = () => undefined;
  const over = new Promise<null>((resolve) => {
    giveUp = () => resolve(null);
  });
  signal.addEventListener('abort', giveUp, { once: true });
  try {
    const stated = await Promise.race([Promise.resolve(parts.mac(address, signal)), over]);
    return typeof stated === 'string' && CAPTURE_MAC_ADDRESS_PATTERN.test(stated) ? stated : null;
  } catch {
    // What was thrown is NOT read.
    return null;
  } finally {
    signal.removeEventListener('abort', giveUp);
  }
}

// ── The plan: which address from where ─────────────────────────────────────────────────────────

const QUAD = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/;

/** `a.b.c` of a strict dotted quad, or null. Only to NAME the temporary address of a target; the rule judges it. */
function firstThreeOf(address: string): string | null {
  const match = QUAD.exec(address);
  if (match === null) return null;
  const parts = [match[1], match[2], match[3], match[4]].map(Number);
  return parts.every((part) => part <= 255) ? parts.slice(0, 3).join('.') : null;
}

/** The rule's answer, or a refusal for a rule that throws or answers what is no decision. */
function judged(rule: FactoryScanRule, address: string, facts: DestinationContext): FactoryScanDestination | null {
  let decision: FactoryScanRuleDecision;
  try {
    decision = rule(address, facts);
  } catch {
    return null;
  }
  if (decision === null || typeof decision !== 'object' || decision.allowed !== true) return null;
  const { destination } = decision;
  if (destination === null || typeof destination !== 'object') return null;
  if (typeof destination.address !== 'string' || typeof destination.sourceAddress !== 'string' || typeof destination.viaAlias !== 'boolean' || !Number.isInteger(destination.port)) return null;
  return destination;
}

/** The facts with ONE temporary address supposed on the camera port, and no other. */
function supposing(facts: DestinationContext, alias: string): DestinationContext {
  return {
    ...facts,
    cameraAddresses: [...facts.cameraAddresses.filter((held) => !held.alias), { address: alias, alias: true }],
    hostAddresses: [...facts.hostAddresses.filter((held) => held !== alias), alias],
  };
}

interface Planned {
  /** The place of the address in the answer: the stored list's order, the typed address last. */
  readonly order: number;
  readonly address: string;
}
interface Plan {
  /** Addresses inside the camera subnet: asked from the camera port's own address. */
  readonly direct: readonly Planned[];
  /** Per temporary address, the addresses asked from it. In the order of their first address. */
  readonly groups: ReadonlyMap<string, Planned[]>;
  readonly refusedStored: number;
  /** True when the typed address was refused. */
  readonly typedRefused: boolean;
}

function planOf(rule: FactoryScanRule, facts: DestinationContext, stored: readonly string[], typed: string | undefined, aliasHost: number): Plan {
  const direct: Planned[] = [];
  const groups = new Map<string, Planned[]>();
  const seen = new Set<string>();
  let refusedStored = 0;
  let typedRefused = false;
  const place = (address: unknown, order: number): boolean => {
    if (typeof address !== 'string') return false;
    // The camera port's own address reaches it: no temporary address is asked for.
    const own = judged(rule, address, { ...facts, cameraAddresses: facts.cameraAddresses.filter((held) => !held.alias) });
    if (own !== null && own.viaAlias === false) {
      if (!seen.has(own.address)) direct.push({ order, address: own.address });
      seen.add(own.address);
      return true;
    }
    const firstThree = firstThreeOf(address);
    if (firstThree === null) return false;
    const alias = `${firstThree}.${String(aliasHost)}`;
    const through = judged(rule, address, supposing(facts, alias));
    if (through === null || through.viaAlias !== true || through.sourceAddress !== alias) return false;
    if (!seen.has(through.address)) groups.set(alias, [...(groups.get(alias) ?? []), { order, address: through.address }]);
    seen.add(through.address);
    return true;
  };
  stored.forEach((address, index) => {
    if (!place(address, index)) refusedStored += 1;
  });
  if (typed !== undefined && !place(typed, stored.length)) typedRefused = true;
  return { direct, groups, refusedStored, typedRefused };
}

// ── Operation 103 ──────────────────────────────────────────────────────────────────────────────

interface Run {
  asked: number;
  probeFailures: number;
  removalsNotConfirmed: number;
  readonly devices: Map<number, FactoryCamera>;
}

/** Asks the targets, at most `FACTORY_SCAN_PARALLEL_PROBES` at a time. It never rejects: a probe that throws is an address that did not answer. */
async function ask(seams: FactoryScanSeams, parts: FactoryScanParts, targets: readonly { readonly order: number; readonly destination: FactoryScanDestination }[], run: Run): Promise<void> {
  const { host } = seams;
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const target = targets[next];
      next += 1;
      if (target === undefined) return;
      const deadline = new AbortController();
      const cancel = host.after(FACTORY_SCAN_PROBE_TIMEOUT_MS, () => deadline.abort());
      run.asked += 1;
      try {
        const answer = await parts.probe(target.destination, deadline.signal);
        if (answer === null || typeof answer !== 'object' || answer.answered !== true) continue;
        const endpointCount = endpointCountOf(answer.endpointCount);
        // The neighbour table is asked AFTER the answer (the host has just spoken with the address), in what is left of this address's time.
        const mac = await macOf(parts, target.destination.address, deadline.signal);
        run.devices.set(target.order, {
          address: target.destination.address,
          mac,
          onvifReachable: answer.onvifReachable === true,
          endpointCount,
          deviceCount: deviceCountOf(endpointCount),
          vendor: announcedTextOf(answer.vendor),
          model: announcedTextOf(answer.model),
          name: announcedTextOf(answer.name),
          // Not built in this row: the match of a hardware address with a registered camera (see the row's record).
          registeredDeviceId: null,
        });
      } catch {
        // What was thrown is NOT read: it may hold a device's words. The count is reported once, below.
        run.probeFailures += 1;
      } finally {
        cancel();
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(FACTORY_SCAN_PARALLEL_PROBES, targets.length) }, () => worker()));
}

export async function scanFactoryCameras(seams: FactoryScanSeams, caller: FactoryScanCaller, body: CameraFactoryScanRequest | undefined): Promise<CameraFactoryScan> {
  const { host, gate } = seams;
  if (host.sessionOpen()) throw locked();
  if (!seams.available()) throw invalidState(R.COMMISSIONING_NOT_AVAILABLE);
  const parts = seams.parts();
  if (parts === null) throw invalidState(R.COMMISSIONING_NOT_AVAILABLE);
  const release = gate.claim();
  if (release === null) throw invalidState(R.COMMISSIONING_JOB_IN_PROGRESS);
  try {
    return await scan(seams, parts, caller, body);
  } finally {
    release();
  }
}

async function scan(seams: FactoryScanSeams, parts: FactoryScanParts, caller: FactoryScanCaller, body: CameraFactoryScanRequest | undefined): Promise<CameraFactoryScan> {
  const { host, gate } = seams;

  // The helper: asked whether it CAN be asked. Nothing is dialled.
  let helper: string | null;
  try {
    helper = await parts.alias.helper();
  } catch {
    host.failed(`${SOURCE}.helper`, HELPER_NOT_ASKED_TEXT, FactoryScanCode.HELPER_NOT_ASKED, {});
    throw invalidState(R.COMMISSIONING_NOT_AVAILABLE);
  }
  if (helper === NOT_THIS_PLATFORM) throw invalidState(R.COMMISSIONING_NOT_AVAILABLE);
  if (helper !== null) throw invalidState(R.COMMISSIONING_HELPER_NOT_CONFIGURED);

  // The stored settings and the facts of the host.
  const settings = await host.settings();
  if (!settings.configured || settings.factoryAddresses.length > CAPTURE_NETWORK_CONFIG_LIMITS.factoryAddressesMax) throw invalidState(R.COMMISSIONING_NOT_CONFIGURED);
  const facts = (): DestinationContext | null => {
    try {
      return host.facts();
    } catch {
      host.failed(`${SOURCE}.facts`, HOST_UNREADABLE_TEXT, FactoryScanCode.HOST_FACTS_UNREADABLE, {});
      throw invalidState(R.COMMISSIONING_NOT_AVAILABLE);
    }
  };
  const before = facts();
  // Since R-FLEX row 105 the reader answers a context without a camera subnet - not null - for a choice on an
  // interface this host does not have; the scan stays bound to the camera interface (Q96-04 a). Row 143.
  if (before === null || before.cameraSubnet === null) throw invalidState(R.COMMISSIONING_NOT_CONFIGURED);

  // Every address through the rule, BEFORE anything is asked of the helper or of an address.
  const plan = planOf(parts.rule, before, settings.factoryAddresses, body?.address, settings.aliasHost);
  if (plan.typedRefused) throw addressNotAllowed();

  const startedAt = host.now();
  const waitMs = gate.waitMs(startedAt);
  if (waitMs > 0) throw rateLimited(waitMs);
  // A session that opened meanwhile: the addresses of the camera port are not touched during a recording.
  if (host.sessionOpen()) throw locked();
  gate.started(startedAt);

  const subject: FactoryScanAliasSubject = { operatorId: caller.operatorId, deviceId: caller.deviceId, reason: HostAliasReason.FACTORY_SCAN, operationId: FACTORY_SCAN_OPERATION_ID, permission: Permission.CAPTURE_COMMISSION };
  const run: Run = { asked: 0, probeFailures: 0, removalsNotConfirmed: 0, devices: new Map() };
  let aliasCause: string | null = null;
  let aliasCount = 0;
  let sessionOpened = false;

  // 1. The groups that need a temporary address: one address at a time, each taken away before the next.
  for (const [alias, planned] of plan.groups) {
    if (aliasCause !== null) break;
    if (host.sessionOpen()) {
      sessionOpened = true;
      break;
    }
    let certainlyNotAdded = false;
    aliasCount += 1;
    try {
      let outcome: FactoryScanAliasOutcome | null = null;
      try {
        outcome = await parts.alias.add({ address: alias, minutes: settings.aliasMinutes, subject });
      } catch {
        outcome = null;
      }
      if (outcome === null || typeof outcome !== 'object') aliasCause = FactoryScanAliasCause.CALL_FAILED;
      else if (outcome.refusal !== null || outcome.effect !== DONE) {
        aliasCause = codeOr(outcome.refusal, FactoryScanAliasCause.NOT_CONFIRMED);
        certainlyNotAdded = outcome.effect === NOT_DONE;
      } else {
        // The helper said "in place". The host must say so too: the rule, on the facts the host states NOW.
        const live = facts();
        const targets = live === null ? [] : planned.flatMap((entry) => {
          const destination = judged(parts.rule, entry.address, live);
          return destination !== null && destination.viaAlias === true && destination.sourceAddress === alias ? [{ order: entry.order, destination }] : [];
        });
        if (targets.length !== planned.length) aliasCause = FactoryScanAliasCause.NOT_IN_PLACE;
        else await ask(seams, parts, targets, run);
      }
      if (aliasCause !== null) host.failed(`${SOURCE}.alias`, ALIAS_NOT_CONFIRMED_TEXT, FactoryScanCode.ALIAS_NOT_CONFIRMED, { aliasWord: aliasCause });
    } finally {
      // On EVERY way out once `add` was called - "done", "unknown", no answer, an `add` or a probe that threw - the
      // address is asked away. The ONE exception: `add` itself answered that it certainly changed nothing. Then nothing
      // of this scan is on the camera port, and a removal could only take away an address ANOTHER operation holds at
      // the same place (a set-network job in that /24, an address the operator has not removed yet).
      if (!certainlyNotAdded) {
        let removed: FactoryScanAliasOutcome | null = null;
        try {
          removed = await parts.alias.remove({ address: alias, subject });
        } catch {
          removed = null;
        }
        if (!(removed !== null && typeof removed === 'object' && removed.refusal === null && removed.effect === DONE)) {
          run.removalsNotConfirmed += 1;
          host.failed(`${SOURCE}.alias`, REMOVAL_NOT_CONFIRMED_TEXT, FactoryScanCode.ALIAS_REMOVAL_NOT_CONFIRMED, { aliasWord: codeOr(removed?.refusal, FactoryScanAliasCause.CALL_FAILED) });
        }
      }
    }
  }

  // 2. The addresses inside the camera subnet, from the camera port's own address: judged again on the facts of NOW.
  if (aliasCause === null && !sessionOpened && plan.direct.length > 0) {
    if (host.sessionOpen()) sessionOpened = true;
    else {
      const live = facts();
      const targets = live === null ? [] : plan.direct.flatMap((entry) => {
        const destination = judged(parts.rule, entry.address, live);
        return destination !== null && destination.viaAlias === false ? [{ order: entry.order, destination }] : [];
      });
      await ask(seams, parts, targets, run);
    }
  }

  if (run.probeFailures > 0) host.failed(`${SOURCE}.probe`, PROBE_FAILED_TEXT, FactoryScanCode.PROBE_FAILED, { probeFailures: run.probeFailures });

  const devices = [...run.devices.entries()].sort(([left], [right]) => left - right).map(([, device]) => device);
  const failureReason = aliasCause !== null ? R.HOST_ALIAS_FAILED : sessionOpened ? ApiErrorCode.CAPTURE_CONFIG_LOCKED : null;
  // ONE entry: that a scan ran, with counts and codes. Never an address, never what a device said.
  await host.audit({
    type: AuditType.CAMERA_FACTORY_SCANNED,
    message: FACTORY_SCANNED_MESSAGE,
    actorId: caller.operatorId,
    deviceId: caller.deviceId,
    details: {
      outcome: failureReason === null ? 'COMPLETE' : 'FAILED',
      addressCount: run.asked,
      responderCount: devices.length,
      ...(failureReason === null ? {} : { failureReason }),
      operationId: FACTORY_SCAN_OPERATION_ID,
      permission: Permission.CAPTURE_COMMISSION,
    },
  });
  host.note(
    {
      code: AuditType.CAMERA_FACTORY_SCANNED,
      source: SOURCE,
      outcome: failureReason === null ? 'COMPLETE' : 'FAILED',
      addressCount: run.asked,
      responderCount: devices.length,
      refusedCount: plan.refusedStored,
      aliasCount,
      probeFailures: run.probeFailures,
      removalsNotConfirmed: run.removalsNotConfirmed,
    },
    'commissioning scan ended',
  );

  if (aliasCause !== null) throw aliasFailed(aliasCause);
  if (sessionOpened) throw locked();
  // `alias` (task 4 row 106b; decision C78 DD-3): THE LIFECYCLE'S OWN STATE at the end of the scan, not a guess of this
  // file. This scan asked every address it added away again, so the state is null - unless a removal was not confirmed:
  // then the answer names the address that is still on the camera port, with the code of the removal that failed.
  const answer: CameraFactoryScan = { scannedAt: startedAt, addressCount: run.asked, devices, alias: await aliasInPlace(parts.alias), synthetic: false };
  seams.remember?.(answer);
  return answer;
}

/** The member `alias`: what the lifecycle states, held to the contract's form; null for none, for no reader, and for a state that cannot be read (operation 104 then says why). */
async function aliasInPlace(alias: FactoryScanAlias): Promise<HostAlias | null> {
  if (typeof alias.state !== 'function') return null;
  try {
    const stated = HostAliasSchema.safeParse(await alias.state());
    return stated.success ? stated.data : null;
  } catch {
    return null;
  }
}
