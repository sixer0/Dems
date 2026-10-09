/**
 * Pure model of the camera search on the tablet and the phone (task 3, blueprint row 138;
 * `masterplan/08_client_ux_spec.md` §8c flow 9, §8d.10 flow 10 on these clients; specs R-9 AC-1..4,
 * AC-11..13; decisions D80(3), D80(4), D86 C-4). No React, no simulator instance, no clock of its
 * own: every function is a plain function of what operations 93 / 94 answered and of the instant the
 * caller hands in.
 *
 * | What | Function | Spec |
 * |---|---|---|
 * | What an answer of operation 93 or 94 means | `classifySearchAnswer` | §8c.2 S8-S11, S13, S14 |
 * | Which of the fourteen states the panel draws | `searchPanelState` | §8c.2 |
 * | The bar of a running search | `searchProgress` (forward-only, from Core instants) | §8c.2 S3, §8c.8 |
 * | The rows of the list, in the order the Core answered | `candidateGroups` | §8c.3 (never re-sorted, filtered or merged) |
 *
 * Never drawn and never returned by a function here: `candidateId` (a key and a test id only),
 * `searchId`, `endpointRef`, `failureReason`, and `lastTest` (always null on these clients: a test
 * can only be run by the web session that owns its own list, §8c.3).
 */
import {
  CAPTURE_DISCOVERY_MAX_CANDIDATES,
  CaptureDiscoveryReason,
  CaptureDiscoveryStateSchema,
  type CaptureCandidate,
  type CaptureDiscoverySearch,
  type CaptureDiscoveryStateBody,
} from '@dems/shared/api';

// ── Answers of operations 93 and 94 ──────────────────────────────────────────────────────

/** What an operation answered, reduced to the members both sources carry. */
export interface SearchAnswerFacts {
  /** The HTTP status; null when there was no answer. */
  readonly status: number | null;
  /** The envelope's `error.code`, or null. */
  readonly code: string | null;
  /** The envelope's `error.details.reason`, or null. */
  readonly reason: string | null;
  /** Whole seconds of `retry-after` (or of `details.retryInMs`), or null. */
  readonly retryAfterS: number | null;
}

/**
 * | Class | Answer | Presentation (§8c.2) |
 * |---|---|---|
 * | `ok` | 200, 202 | the state of the answer |
 * | `busy` | 409 `DISCOVERY_IN_PROGRESS` | S10: an inline note; the button stays enabled |
 * | `recording` | 409 `DISCOVERY_NOT_ALLOWED_WHILE_RECORDING` | S14: disabled with its sentence |
 * | `limited` | 429 | S11: the fixed seconds, disabled until then |
 * | `unavailable` | 503 | S9: "not available on this Core yet" + Retry |
 * | `denied` | 403 | S13: the role sentence, no list |
 * | `signedOut` | 401 | the app's own signed-out handling |
 * | `offline` | no answer | S8 with the waiting sentence |
 * | `failed` | anything else | S8 |
 */
export type SearchAnswerClass = 'ok' | 'busy' | 'recording' | 'limited' | 'unavailable' | 'denied' | 'signedOut' | 'offline' | 'failed';

export function classifySearchAnswer(facts: SearchAnswerFacts): SearchAnswerClass {
  const { status, reason } = facts;
  if (status === null) return 'offline';
  if (status >= 200 && status < 300) return 'ok';
  if (status === 401) return 'signedOut';
  if (status === 403) return 'denied';
  if (status === 409 && reason === CaptureDiscoveryReason.DISCOVERY_NOT_ALLOWED_WHILE_RECORDING) return 'recording';
  if (status === 409) return 'busy';
  if (status === 429) return 'limited';
  if (status === 503) return 'unavailable';
  return 'failed';
}

/** A refusal the Core is expected to give: a warning in the runtime log, not an error. */
export function isExpectedSearchRefusal(result: SearchAnswerClass): boolean {
  return result === 'busy' || result === 'recording' || result === 'limited' || result === 'unavailable' || result === 'denied';
}

/** Reads the facts out of an error envelope (`{ error: { code, details? } }`), defensively. */
export function searchFactsOf(status: number | null, body: unknown, retryAfterS: number | null = null): SearchAnswerFacts {
  const error = typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : null;
  if (typeof error !== 'object' || error === null) return { status, code: null, reason: null, retryAfterS };
  const { code, details } = error as { code?: unknown; details?: unknown };
  const bag = typeof details === 'object' && details !== null ? (details as { reason?: unknown; retryInMs?: unknown }) : {};
  const retryInMs = typeof bag.retryInMs === 'number' && Number.isFinite(bag.retryInMs) && bag.retryInMs > 0 ? bag.retryInMs : null;
  return {
    status,
    code: typeof code === 'string' ? code : null,
    reason: typeof bag.reason === 'string' ? bag.reason : null,
    retryAfterS: retryAfterS ?? (retryInMs === null ? null : Math.max(1, Math.ceil(retryInMs / 1000))),
  };
}

/** Operation 94's body, or null when it is not one (the panel then reads "could not be completed"). */
export function discoveryStateOf(body: unknown): CaptureDiscoveryStateBody | null {
  const parsed = CaptureDiscoveryStateSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

// ── The gate of G13 and the state of the panel (§8c.2, §8c.6) ────────────────────────────

/**
 * | Gate | When | The Search button |
 * |---|---|---|
 * | `checking` | the role is not known yet | disabled, "Checking your permissions…" (S1) |
 * | `waiting` | the Core link is down (Live mode) | disabled, the waiting sentence |
 * | `denied` | the role lacks `CAPTURE_CONFIG` | disabled, the role sentence; NO list is requested (S13) |
 * | `recording` | the session records (D86 C-4, until the lift) | disabled, the S14 sentence |
 * | `allowed` | none of the above | enabled |
 *
 * An OPEN session that does not record does not close the gate: a search is allowed then (D80(4)).
 */
export type SearchGateState = 'checking' | 'waiting' | 'denied' | 'recording' | 'allowed';

export interface SearchGateInput {
  readonly roleKnown: boolean;
  readonly permitted: boolean;
  readonly linkDown: boolean;
  /** The store's session is in RECORDING. */
  readonly recording: boolean;
  /** The Core answered `409 DISCOVERY_NOT_ALLOWED_WHILE_RECORDING` and the session is still open. */
  readonly refusedWhileRecording: boolean;
}

export function searchGate(input: SearchGateInput): SearchGateState {
  if (!input.roleKnown) return 'checking';
  if (input.linkDown) return 'waiting';
  if (!input.permitted) return 'denied';
  if (input.recording || input.refusedWhileRecording) return 'recording';
  return 'allowed';
}

/** The gated control of flow 9 on these clients (§11; check `M4-DISC-RBAC-T` / `-P`). */
export const SEARCH_GATED_CONTROLS = ['G13'] as const;

/**
 * The body of the panel. `checking` and `denied` come from the gate; the others from operation 94's
 * answer, never from a client clock:
 *
 * | State | From |
 * |---|---|
 * | `loading` | S1: the gated read of operation 94 has not answered yet |
 * | `idle` | S2: `search: null` and no result was drawn before |
 * | `searching` | S3: `state: RUNNING` |
 * | `results` | S4, S6, S7: `COMPLETE` with at least one candidate |
 * | `empty` | S5: `COMPLETE` with none |
 * | `failed` | S8: `state: FAILED`, or the read failed |
 * | `expired` | S12: `search: null` after a result was drawn |
 */
export type SearchPanelState = 'checking' | 'denied' | 'loading' | 'idle' | 'searching' | 'results' | 'empty' | 'failed' | 'expired';

export interface SearchPanelInput {
  readonly gate: SearchGateState;
  /** Operation 94 answered at least once in this visit. */
  readonly read: boolean;
  /** The last answer of operation 94, or null before the first. */
  readonly view: CaptureDiscoveryStateBody | null;
  /** A result (S4-S7) was drawn in this visit before the current answer. */
  readonly hadResult: boolean;
  /** The last read or start failed without a named refusal. */
  readonly readFailed: boolean;
}

export function searchPanelState(input: SearchPanelInput): SearchPanelState {
  if (input.gate === 'checking') return 'checking';
  if (input.gate === 'denied') return 'denied';
  if (input.readFailed) return 'failed';
  // With the link down nothing can be read: the idle body with the disabled button and its sentence, not an endless skeleton.
  if (!input.read || input.view === null) return input.gate === 'waiting' ? 'idle' : 'loading';
  const { search, candidates } = input.view;
  if (search === null) return input.hadResult ? 'expired' : 'idle';
  if (search.state === 'RUNNING') return 'searching';
  if (search.state === 'FAILED') return 'failed';
  return candidates.length === 0 ? 'empty' : 'results';
}

/** True for the states that count as "a result was drawn" (S12 follows only these). */
export function isDrawnResult(state: SearchPanelState): boolean {
  return state === 'results' || state === 'empty';
}

/**
 * The bar of a running search: `(Core now − startedAt) / windowMs` in percent, clamped to 0..100 and
 * never below `previous` (§8c.8). It reads two Core instants and the Core's own clock; at 100 the
 * text becomes "Finishing the search…" and the END is still operation 94's answer, never the bar.
 */
export function searchProgress(search: Pick<CaptureDiscoverySearch, 'startedAt' | 'windowMs'>, coreNow: number, previous = 0): number {
  const raw = search.windowMs <= 0 ? 100 : ((coreNow - search.startedAt) / search.windowMs) * 100;
  const clamped = Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.round(raw))) : 0;
  return Math.max(clamped, Math.min(100, Math.max(0, previous)));
}

/** The fixed number of the hint "This takes up to N seconds." — never a countdown. */
export function searchWindowSeconds(search: Pick<CaptureDiscoverySearch, 'windowMs'>): number {
  return Math.max(1, Math.ceil(search.windowMs / 1000));
}

// ── The list (§8c.3) ─────────────────────────────────────────────────────────────────────

/**
 * | Mark | When | Chip and sentence |
 * |---|---|---|
 * | `registered` | `status: REGISTERED` | "Already registered" + the device; "View device", no Connect |
 * | `conflict` | `conflict: true` | "Cannot be connected" + the two-devices sentence |
 * | `notTestable` | `testable: false` | "Cannot be connected" + the not-its-own-address sentence |
 * | `new` | `status: NEW`, testable | "New"; Connect drawn DISABLED with the web-console sentence |
 */
export type CandidateMark = 'registered' | 'conflict' | 'notTestable' | 'new';

export interface CandidateRow {
  /** A React key and a test id only; never drawn. */
  readonly key: string;
  /** The address the answer came from: plain text, never a link. */
  readonly address: string;
  /** "{{vendor}} {{model}}" with a missing part left out; null when both are missing. */
  readonly makeModel: string | null;
  /** The announced name; null when none. Untrusted device text: a text node only. */
  readonly name: string | null;
  readonly mark: CandidateMark;
  /** The registered capture device of a `registered` row, or null. */
  readonly deviceId: string | null;
  readonly addressChanged: boolean;
  /** `sourceClass: DEVELOPMENT`: the row sits in the "Development sources" group. */
  readonly development: boolean;
  /** The adapter code the Core sent (`FAKE`, `ONVIF_RTSP`): decides the kind text of the badge. */
  readonly adapter: string;
}

function markOf(candidate: CaptureCandidate): CandidateMark {
  if (candidate.status === 'REGISTERED') return 'registered';
  if (candidate.conflict) return 'conflict';
  if (!candidate.testable) return 'notTestable';
  return 'new';
}

function rowOf(candidate: CaptureCandidate): CandidateRow {
  const parts = [candidate.vendor, candidate.model].filter((part): part is string => part !== null && part.trim() !== '');
  return {
    key: candidate.candidateId,
    address: candidate.host,
    makeModel: parts.length === 0 ? null : parts.join(' '),
    name: candidate.name,
    mark: markOf(candidate),
    deviceId: candidate.status === 'REGISTERED' ? candidate.deviceId : null,
    addressChanged: candidate.addressChanged,
    development: candidate.sourceClass === 'DEVELOPMENT',
    adapter: candidate.adapter,
  };
}

export interface CandidateGroups {
  /** The network cameras, in the order operation 94 answered. */
  readonly network: readonly CandidateRow[];
  /** The development sources, in the order operation 94 answered; the group is drawn only when it holds a row. */
  readonly development: readonly CandidateRow[];
}

/**
 * The two groups of the list. Inside each group the order IS the answer's order: nothing is sorted,
 * filtered or merged here (§8c.3; check `M4-UX-UNIT` "the list order equals the answer order").
 */
export function candidateGroups(candidates: readonly CaptureCandidate[]): CandidateGroups {
  const rows = candidateRows(candidates);
  return { network: rows.filter((row) => !row.development), development: rows.filter((row) => row.development) };
}

/** Every row, in the answer's order: the one list of a client that draws no group (Simulated mode, D91). */
export function candidateRows(candidates: readonly CaptureCandidate[]): CandidateRow[] {
  return candidates.map(rowOf);
}

/** `CAPTURE_DISCOVERY_MAX_CANDIDATES` for the S7 line. */
export const SEARCH_MAX_CANDIDATES = CAPTURE_DISCOVERY_MAX_CANDIDATES;

/** How often operation 94 is read while a search is RUNNING: never faster than once per second (§8c.2 S3). */
export const SEARCH_POLL_MS = 1_000;
/** How often the bar is redrawn while a search is RUNNING. It moves no state. */
export const SEARCH_PROGRESS_TICK_MS = 250;
