/**
 * Events and the audit hash chain (masterplan/01_specs.md §14.7 `events.ts`).
 *
 * - Audit chain: `hash = sha256(prevHash ‖ canonicalJSON(body))` with `@noble/hashes`
 *   (pure JS, identical on web, Node and Hermes). The first row links to the genesis hash.
 * - Ring buffers: events 500, audit 1000. When the audit ring drops old rows, the oldest
 *   kept row's `prevHash` becomes the trusted anchor for verification.
 * - Everything here is a pure function over plain data: it returns new arrays and never
 *   mutates its input, so zustand sees new references.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { AUDIT_RING_SIZE, EVENT_RING_SIZE, GENESIS_HASH } from './constants';
import type {
  AuditEventBody,
  AuditLogSlice,
  AuditRow,
  ChainVerifyResult,
  Details,
  EpochMs,
  SimEvent,
  SimState,
} from './types';
import { AUDIT_TYPE_CATEGORY, type AuditType, type Severity, type SimEventType } from './vocabulary';

// ── Canonical JSON and hashing ───────────────────────────────────────────────────────────

/**
 * Deterministic JSON: object keys sorted by UTF-16 code unit, no whitespace, `undefined`
 * properties dropped, `-0` written as `0`. Throws on values JSON cannot represent exactly
 * (non-finite numbers, bigint, functions, symbols), so a hash never covers a lossy encoding.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError('canonicalJSON: non-finite number');
      return Object.is(value, -0) ? '0' : JSON.stringify(value);
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map((item) => (item === undefined ? 'null' : canonicalJSON(item))).join(',')}]`;
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort();
      return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJSON(record[key])}`).join(',')}}`;
    }
    default:
      throw new TypeError(`canonicalJSON: unsupported ${typeof value}`);
  }
}

/** Lowercase hex SHA-256 of a UTF-8 string. */
export function sha256Hex(text: string): string {
  return bytesToHex(sha256(utf8ToBytes(text)));
}

/** The chain step: `sha256(prevHash ‖ canonicalJSON(body))`. */
export function chainHash(prevHash: string, body: AuditEventBody): string {
  return sha256Hex(prevHash + canonicalJSON(body));
}

/** The hashed part of a row (drops `prevHash` and `hash`). */
export function auditBody(row: AuditRow): AuditEventBody {
  return {
    seq: row.seq,
    id: row.id,
    at: row.at,
    type: row.type,
    category: row.category,
    severity: row.severity,
    actorId: row.actorId,
    message: row.message,
    sessionId: row.sessionId,
    evidenceId: row.evidenceId,
    deviceId: row.deviceId,
    details: row.details,
  };
}

// ── Ring buffers ─────────────────────────────────────────────────────────────────────────

/** Appends `items` and keeps the newest `max` (oldest first). */
export function pushRing<T>(ring: readonly T[], items: readonly T[], max: number): T[] {
  const next = ring.concat(items);
  return next.length > max ? next.slice(next.length - max) : next;
}

// ── Audit log ────────────────────────────────────────────────────────────────────────────

export function emptyAuditLog(): AuditLogSlice {
  return { rows: [], head: GENESIS_HASH, total: 0, dropped: 0 };
}

/** What a caller supplies for a new audit row; the log fills seq, id, category and hashes. */
export interface AuditInput {
  type: AuditType;
  message: string;
  severity?: Severity;
  actorId?: string | null;
  sessionId?: string | null;
  evidenceId?: string | null;
  deviceId?: string | null;
  details?: Details;
}

export function auditId(seq: number): string {
  return `AUD-${String(seq).padStart(6, '0')}`;
}

/** Appends one hash-chained row at time `at`. Returns the new log and the row. */
export function appendAudit(
  log: AuditLogSlice,
  input: AuditInput,
  at: EpochMs,
  max: number = AUDIT_RING_SIZE,
): { log: AuditLogSlice; row: AuditRow } {
  const seq = log.total + 1;
  const body: AuditEventBody = {
    seq,
    id: auditId(seq),
    at,
    type: input.type,
    category: AUDIT_TYPE_CATEGORY[input.type],
    severity: input.severity ?? 'INFO',
    actorId: input.actorId ?? null,
    message: input.message,
    sessionId: input.sessionId ?? null,
    evidenceId: input.evidenceId ?? null,
    deviceId: input.deviceId ?? null,
    details: input.details ?? {},
  };
  const prevHash = log.head;
  const row: AuditRow = { ...body, prevHash, hash: chainHash(prevHash, body) };
  const kept = pushRing(log.rows, [row], max);
  const droppedNow = log.rows.length + 1 - kept.length;
  return {
    log: { rows: kept, head: row.hash, total: seq, dropped: log.dropped + droppedNow },
    row,
  };
}

/** Appends several rows in order (all share the caller's timestamp unless they carry one). */
export function appendAuditMany(
  log: AuditLogSlice,
  inputs: readonly (AuditInput & { at: EpochMs })[],
  max: number = AUDIT_RING_SIZE,
): AuditLogSlice {
  let next = log;
  for (const input of inputs) next = appendAudit(next, input, input.at, max).log;
  return next;
}

/**
 * Recomputes the chain over the kept rows.
 * - Row 0 links to its own `prevHash` (the anchor: genesis, or the hash of a dropped row).
 * - Row i > 0 must link to row i-1's hash (else PREV_LINK_BROKEN), carry seq + 1 (else
 *   SEQ_GAP), and its stored hash must equal the recomputed one (else HASH_MISMATCH).
 * - The last row's hash must equal `head`.
 */
export function verifyAuditChain(log: AuditLogSlice): ChainVerifyResult {
  const { rows } = log;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] as AuditRow;
    if (index > 0) {
      const previous = rows[index - 1] as AuditRow;
      if (row.prevHash !== previous.hash) {
        return { ok: false, checked: index, index, seq: row.seq, reason: 'PREV_LINK_BROKEN' };
      }
      if (row.seq !== previous.seq + 1) {
        return { ok: false, checked: index, index, seq: row.seq, reason: 'SEQ_GAP' };
      }
    } else if (log.dropped === 0 && row.prevHash !== GENESIS_HASH) {
      return { ok: false, checked: 0, index: 0, seq: row.seq, reason: 'PREV_LINK_BROKEN' };
    }
    if (chainHash(row.prevHash, auditBody(row)) !== row.hash) {
      return { ok: false, checked: index, index, seq: row.seq, reason: 'HASH_MISMATCH' };
    }
  }
  const last = rows[rows.length - 1];
  if (last && last.hash !== log.head) {
    const index = rows.length - 1;
    return { ok: false, checked: index, index, seq: last.seq, reason: 'HASH_MISMATCH' };
  }
  return { ok: true, checked: rows.length, head: log.head };
}

/**
 * The AUDIT_TAMPER hook (EVT-30): rewrites one row's message **without** re-hashing, the way
 * an attacker editing storage would. `verifyAuditChain` then fails at exactly `index`.
 */
export function tamperAuditRow(log: AuditLogSlice, index: number): AuditLogSlice {
  const target = log.rows[index];
  if (!target) return log;
  const rows = log.rows.slice();
  rows[index] = { ...target, message: `${target.message} [altered]` };
  return { ...log, rows };
}

// ── Operational events ───────────────────────────────────────────────────────────────────

export interface EventInput {
  type: SimEventType;
  message: string;
  severity?: Severity;
  params?: Details;
  sessionId?: string | null;
  deviceId?: string | null;
}

export function eventId(seq: number): string {
  return `LOG-${String(seq).padStart(6, '0')}`;
}

/**
 * Appends one event. `seq` comes from `meta.counters.event` (the caller advances it).
 */
export function appendEvent(
  events: readonly SimEvent[],
  input: EventInput,
  at: EpochMs,
  seq: number,
  max: number = EVENT_RING_SIZE,
): { events: SimEvent[]; event: SimEvent } {
  const event: SimEvent = {
    id: eventId(seq),
    seq,
    at,
    type: input.type,
    severity: input.severity ?? 'INFO',
    message: input.message,
    params: input.params ?? {},
    sessionId: input.sessionId ?? null,
    deviceId: input.deviceId ?? null,
  };
  return { events: pushRing(events, [event], max), event };
}

// ── State helper ─────────────────────────────────────────────────────────────────────────

/** One thing that happened: an audit row, an operational event, or both. */
export interface ActivityInput {
  audit?: AuditInput;
  event?: EventInput;
}

export type ActivitySlices = Pick<SimState, 'audit' | 'events' | 'meta'>;

/**
 * Appends audit rows and events to the state at time `at` and advances the event counter.
 * Returns only the three changed slices, ready for `store.setState`.
 */
export function appendActivity(
  state: ActivitySlices,
  at: EpochMs,
  items: ActivityInput | readonly ActivityInput[],
): ActivitySlices {
  const list: readonly ActivityInput[] = Array.isArray(items) ? items : [items as ActivityInput];
  let audit = state.audit;
  let events = state.events;
  let nextEventSeq = state.meta.counters.event;
  for (const item of list) {
    if (item.audit) audit = appendAudit(audit, item.audit, at).log;
    if (item.event) {
      events = appendEvent(events, item.event, at, nextEventSeq).events;
      nextEventSeq += 1;
    }
  }
  const meta =
    nextEventSeq === state.meta.counters.event
      ? state.meta
      : { ...state.meta, counters: { ...state.meta.counters, event: nextEventSeq } };
  return { audit, events, meta };
}

/**
 * `appendActivity` with a monotonic clock (step 32): rows never go back in time, even when
 * the engine processes a scheduled transition (time `t`) after a user action already wrote a
 * later row. Audit and event lists therefore stay sorted by `at`.
 */
export function recordActivity(
  state: ActivitySlices,
  t: EpochMs,
  items: ActivityInput | readonly ActivityInput[],
): ActivitySlices {
  const lastAudit = state.audit.rows[state.audit.rows.length - 1]?.at ?? Number.NEGATIVE_INFINITY;
  const lastEvent = state.events[state.events.length - 1]?.at ?? Number.NEGATIVE_INFINITY;
  return appendActivity(state, Math.max(t, lastAudit, lastEvent), items);
}

/** `PREFIX-000001` item IDs (timeline items, notes, alerts, runs, exports) from `meta.counters.item`. */
export function nextItemId(
  meta: SimState['meta'],
  prefix: string,
): { id: string; meta: SimState['meta'] } {
  const seq = meta.counters.item;
  return {
    id: `${prefix}-${String(seq).padStart(6, '0')}`,
    meta: { ...meta, counters: { ...meta.counters, item: seq + 1 } },
  };
}
