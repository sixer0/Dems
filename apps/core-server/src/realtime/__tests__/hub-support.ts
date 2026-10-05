/**
 * Test support of the realtime hub (plan row W42; not a test file). Nothing here opens a socket
 * or a database: a transport that records what it was sent, an engine that holds a real state
 * of the shared simulator and turns what the simulator did into state changes, a manual clock
 * and a recording log.
 */
import { WsServerMessageSchema, type WsServerMessage } from '@dems/shared/api';
import {
  AUDIT_RING_SIZE,
  EVENT_RING_SIZE,
  OperatorRole,
  ROLE_PERMISSIONS,
  createManualClock,
  type ScenarioName,
  type TabletLinkState,
} from '@dems/shared/sim';
import type { FastifyBaseLogger } from 'fastify';
import { pickDurable, type DurableSlices } from '../../db/mapping';
import { createHost, type Host } from '../../../test/support/seed';
import { changesRecords, deltaOps, type EngineChangeCause, type EngineStateChange } from '../../engine';
import { createDevicePresence, type DevicePresence } from '../../modules/pairing/presence';
import type { ErrorLog, ErrorLogEntry } from '../../plugins/logger';
import type { Admission, OperatorAdmission } from '../admission';
import { createRealtimeHub } from '../hub';
import type { ConnectionHandle, HubEngine, RealtimeHub, RealtimeTransport } from '../hub-types';
import { REALTIME_LIMITS, type RealtimeLimits } from '../limits';

/** 2031-01-01T00:00:00Z: no wall clock of this decade gives it. */
export const CLOCK_START = Date.UTC(2031, 0, 1);
export type ManualClock = ReturnType<typeof createManualClock>;

// ── A transport that records ───────────────────────────────────────────────────────────────────

export interface FakeTransport extends RealtimeTransport {
  /** Every text frame, in the order it was queued. */
  readonly sent: string[];
  /** What the test says the send buffer holds. */
  buffered: number;
  /** The close frame the hub sent, or null. */
  closed: { code: number; reason: string } | null;
  terminated: boolean;
  pings: number;
  /** Makes the next `send` throw, as a socket that is gone does. */
  failNextSend: boolean;
  /** The frames as messages of the contract; a frame that is not one fails the test. */
  messages(): WsServerMessage[];
  types(): string[];
  /** Forgets what was sent so far. */
  clear(): void;
}

export function fakeTransport(): FakeTransport {
  const sent: string[] = [];
  const transport: FakeTransport = {
    sent,
    buffered: 0,
    closed: null,
    terminated: false,
    pings: 0,
    failNextSend: false,
    send(text) {
      if (transport.failNextSend) {
        transport.failNextSend = false;
        throw new Error('the socket is gone');
      }
      sent.push(text);
    },
    get bufferedAmount() {
      return transport.buffered;
    },
    close(code, reason) {
      transport.closed = { code, reason };
    },
    terminate() {
      transport.terminated = true;
    },
    ping() {
      transport.pings += 1;
    },
    messages() {
      return sent.map((text) => WsServerMessageSchema.parse(JSON.parse(text)));
    },
    types() {
      return sent.map((text) => (JSON.parse(text) as { type: string }).type);
    },
    clear() {
      sent.length = 0;
    },
  };
  return transport;
}

// ── An engine with a real state ────────────────────────────────────────────────────────────────

export interface FakeEngine extends HubEngine {
  readonly host: Host;
  /** Every `setTabletLink` call, in order. */
  readonly linkCalls: TabletLinkState[];
  /** Makes the next `setTabletLink` reject. */
  failNextLink: boolean;
  /** Where the engine's own changes go (`setTabletLink`): the hub's `publish`, as in the server. */
  sink: ((change: EngineStateChange) => void) | null;
  /**
   * Takes what the simulator did since the last commit as ONE committed change, as the engine
   * host does after a unit: the next revision, the ops of the difference. Null when nothing
   * replicated changed.
   */
  commit(cause: EngineChangeCause, at: number): EngineStateChange | null;
  /** A new epoch: revision 0, the simulator's state as the committed one, and the `start` change. */
  start(at: number): EngineStateChange;
  stop(): void;
}

/**
 * A real state of the shared simulator behind the members the hub reads. The tablet link starts
 * OFFLINE, as after a process start (spec §8.6).
 */
export async function fakeEngine(now: () => number, scenario: ScenarioName = 'idle', epoch = 3): Promise<FakeEngine> {
  const host = await createHost({ scenario });
  host.sim.actions.setTabletLink('OFFLINE');
  let committed: DurableSlices = pickDurable(host.state());
  let currentEpoch = epoch;
  let revision = 0;
  let running = true;
  const linkCalls: TabletLinkState[] = [];
  const engine: FakeEngine = {
    host,
    linkCalls,
    failNextLink: false,
    sink: null,
    get epoch() {
      return currentEpoch;
    },
    get revision() {
      return revision;
    },
    get running() {
      return running;
    },
    state() {
      if (!running) throw new Error('the engine is not running');
      return committed;
    },
    slice(name) {
      if (!running) throw new Error('the engine is not running');
      return committed[name];
    },
    async setTabletLink(state) {
      if (!running) throw new Error('the engine is not running');
      linkCalls.push(state);
      if (engine.failNextLink) {
        engine.failNextLink = false;
        throw new Error('the unit was not committed');
      }
      // The hosted action, then the commit and its publication, as the engine host does.
      host.sim.actions.setTabletLink(state);
      const change = engine.commit('command', now());
      if (change !== null) engine.sink?.(change);
      return { value: undefined, epoch: currentEpoch, revision };
    },
    commit(cause, at) {
      const next = pickDurable(host.state());
      const ops = deltaOps(committed, next);
      committed = next;
      if (ops.length === 0) return null;
      revision += 1;
      return { epoch: currentEpoch, revision, at, cause, records: changesRecords(ops), ops };
    },
    start(at) {
      running = true;
      currentEpoch += 1;
      revision = 0;
      committed = pickDurable(host.state());
      return { epoch: currentEpoch, revision: 0, at, cause: 'start', records: false, ops: [] };
    },
    stop() {
      running = false;
    },
  };
  return engine;
}

// ── A log that records ─────────────────────────────────────────────────────────────────────────

export interface LogLine {
  readonly level: string;
  readonly fields: Record<string, unknown>;
  readonly message: string;
}

export interface RecordingLog {
  readonly logger: FastifyBaseLogger;
  readonly lines: LogLine[];
  readonly errorLog: ErrorLog;
  readonly persisted: ErrorLogEntry[];
}

export function recordingLog(): RecordingLog {
  const lines: LogLine[] = [];
  const persisted: ErrorLogEntry[] = [];
  const write =
    (level: string) =>
    (fields: unknown, message?: string): void => {
      lines.push(typeof fields === 'string' ? { level, fields: {}, message: fields } : { level, fields: fields as Record<string, unknown>, message: message ?? '' });
    };
  const logger = {
    level: 'debug',
    fatal: write('fatal'),
    error: write('error'),
    warn: write('warn'),
    info: write('info'),
    debug: write('debug'),
    trace: write('trace'),
    silent: () => {},
    child: () => logger,
  } as unknown as FastifyBaseLogger;
  return { logger, lines, persisted, errorLog: { file: null, append: (entry) => void persisted.push(entry) } };
}

// ── The hub under test ─────────────────────────────────────────────────────────────────────────

export interface TestHub {
  readonly hub: RealtimeHub;
  readonly clock: ManualClock;
  readonly engine: FakeEngine;
  readonly presence: DevicePresence;
  readonly log: RecordingLog;
  /** Admits a socket and returns its transport and handle. */
  open(admission: Admission): { transport: FakeTransport; handle: ConnectionHandle };
  /** Publishes what the simulator did since the last commit, as the engine host would. */
  commit(cause?: EngineChangeCause): EngineStateChange | null;
}

export interface TestHubOptions {
  readonly scenario?: ScenarioName;
  readonly limits?: Partial<RealtimeLimits>;
}

export async function testHub(options: TestHubOptions = {}): Promise<TestHub> {
  const clock = createManualClock(CLOCK_START);
  const engine = await fakeEngine(() => clock.now(), options.scenario ?? 'idle');
  const presence = createDevicePresence();
  const log = recordingLog();
  let next = 0;
  const hub = createRealtimeHub({
    clock,
    engine: () => engine,
    presence: () => presence,
    log: log.logger,
    errorLog: log.errorLog,
    newId: () => `00000000-0000-4000-8000-${String((next += 1)).padStart(12, '0')}`,
    limits: { ...REALTIME_LIMITS, ...options.limits },
  });
  engine.sink = (change) => hub.publish({ kind: 'state', change });
  return {
    hub,
    clock,
    engine,
    presence,
    log,
    open(admission) {
      const transport = fakeTransport();
      const handle = hub.admit(admission, transport);
      return { transport, handle };
    },
    commit(cause = 'command') {
      const change = engine.commit(cause, clock.now());
      if (change !== null) hub.publish({ kind: 'state', change });
      return change;
    },
  };
}

// ── Admissions ─────────────────────────────────────────────────────────────────────────────────

export const ANONYMOUS: Admission = { kind: 'ANONYMOUS', reason: null, closeCode: null };

export function operatorAdmission(overrides: Partial<Omit<OperatorAdmission, 'kind'>> = {}): OperatorAdmission {
  const role = overrides.role ?? OperatorRole.INVESTIGATOR;
  return {
    kind: 'OPERATOR',
    operatorId: 'OPR-001',
    sessionId: 'session-1',
    deviceId: null,
    role,
    permissions: ROLE_PERMISSIONS[role],
    ...overrides,
  };
}

export const deviceAdmission = (deviceId = 'DEV-0001'): Admission => ({ kind: 'DEVICE', deviceId });

/** A text frame as the socket library hands it over. */
export const frame = (message: unknown): Buffer => Buffer.from(typeof message === 'string' ? message : JSON.stringify(message), 'utf8');

// ── What a client does with state messages ─────────────────────────────────────────────────────

type StateMessage = Extract<WsServerMessage, { type: 'snapshot' | 'delta' }>;

/**
 * Applies state messages as a client does (spec §9.3): a `snapshot` replaces everything, a
 * `delta` must be the last revision plus 1 in the same epoch; `replace` sets a slice, `append`
 * adds rows to the ring of `audit` or `events`. Throws at the first delta that does not
 * continue, so a gap or a reordering fails the test that replays a socket.
 */
export function replay(messages: readonly WsServerMessage[]): { epoch: number; revision: number; state: Record<string, unknown>; revisions: number[] } {
  let epoch = -1;
  let revision = -1;
  let state: Record<string, unknown> | null = null;
  const revisions: number[] = [];
  for (const message of messages.filter((entry): entry is StateMessage => entry.type === 'snapshot' || entry.type === 'delta')) {
    if (message.type === 'snapshot') {
      epoch = message.epoch;
      revision = message.revision;
      state = { ...message.state };
      revisions.push(revision);
      continue;
    }
    if (state === null) throw new Error(`delta ${message.revision} before any snapshot`);
    if (message.epoch !== epoch || message.revision !== revision + 1) {
      throw new Error(`delta ${message.epoch}/${message.revision} does not continue ${epoch}/${revision}`);
    }
    revision = message.revision;
    revisions.push(revision);
    for (const op of message.ops) {
      if (op.op === 'replace') {
        state[op.slice] = op.value;
      } else if (op.slice === 'audit') {
        const audit = state['audit'] as { rows: unknown[] };
        const rows = [...audit.rows, ...op.rows];
        state['audit'] = { rows: rows.slice(Math.max(0, rows.length - AUDIT_RING_SIZE)), head: op.head, total: op.total, dropped: op.dropped };
      } else {
        const events = [...(state['events'] as unknown[]), ...op.rows];
        state['events'] = events.slice(Math.max(0, events.length - EVENT_RING_SIZE));
      }
    }
  }
  if (state === null) throw new Error('no snapshot among the messages');
  return { epoch, revision, state, revisions };
}

/** A value as it arrives over the wire. */
export const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
