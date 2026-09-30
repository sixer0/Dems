/**
 * Framework-free heartbeat client (masterplan/01_specs.md §2.6).
 *
 * State machine:
 *   start()                          → CONNECTING (open socket)
 *   CONNECTING --valid heartbeat-->  LIVE (store fields; if reconnectAttempt > 0: onResync(), reset to 0)
 *   LIVE/STALE --valid heartbeat-->  LIVE (update fields)
 *   LIVE --no beat for 2,500 ms-->   STALE (checked by a 500 ms timer)
 *   any --socket close/error-->      OFFLINE (reconnect after backoff[min(attempt, 4)] + jitter; attempt++)
 *   OFFLINE --timer-->               CONNECTING (open a new socket)
 *   stop()                           → clear timers, close socket with code 1000
 *
 * Works in browsers, React Native and Node (>= 22 global WebSocket, or an injected factory).
 */
import {
  HEARTBEAT_STALE_AFTER_MS,
  RECONNECT_BACKOFF_MS,
  RECONNECT_JITTER_MS,
} from '../api/constants';
import { WsServerMessageSchema } from '../api/realtime-messages';
import { HeartbeatState } from '../domain/enums';

/** The subset of the WHATWG WebSocket API this client uses (browser, React Native and `ws` all match). */
export interface SocketLike {
  readonly readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  close(code?: number, reason?: string): void;
}

export type SocketFactory = (url: string) => SocketLike;

export interface HeartbeatSnapshot {
  state: HeartbeatState;
  seq: number | null;
  serverTime: string | null;
  lastBeatAt: number | null;
  clients: number | null;
  reconnectAttempt: number;
}

export interface HeartbeatClientOptions {
  url: string;
  /** Defaults to the global `WebSocket` constructor. */
  socketFactory?: SocketFactory;
  /** Clock used for `lastBeatAt` and the stale check. */
  now?: () => number;
  /** Called after a reconnect delivers its first valid heartbeat. */
  onResync?: () => void;
  /** Random source for reconnect jitter, in [0, 1). */
  random?: () => number;
  /** Called when an inbound message is dropped. Defaults to a `console.warn` outside production. */
  onInvalidMessage?: (reason: string, raw: unknown) => void;
}

export interface HeartbeatClient {
  subscribe(listener: () => void): () => void;
  getSnapshot(): HeartbeatSnapshot;
  start(): void;
  stop(): void;
}

export const STALE_CHECK_INTERVAL_MS = 500;
export const NORMAL_CLOSURE = 1000;

const INITIAL_SNAPSHOT: HeartbeatSnapshot = {
  state: HeartbeatState.CONNECTING,
  seq: null,
  serverTime: null,
  lastBeatAt: null,
  clients: null,
  reconnectAttempt: 0,
};

function isProduction(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.NODE_ENV === 'production';
}

function warnDev(message: string, detail: unknown): void {
  if (!isProduction()) {
    console.warn(`[heartbeat] ${message}`, detail);
  }
}

function defaultInvalidMessage(reason: string, raw: unknown): void {
  warnDev(`dropped inbound message: ${reason}`, raw);
}

function defaultSocketFactory(url: string): SocketLike {
  const Ctor = (globalThis as { WebSocket?: new (u: string) => SocketLike }).WebSocket;
  if (!Ctor) {
    throw new Error('No global WebSocket available; pass socketFactory to createHeartbeatClient().');
  }
  return new Ctor(url);
}

/** Delay before reconnect attempt `attempt` (0-based): backoff[min(attempt, 4)] + jitter in [0, 250]. */
export function reconnectDelayMs(attempt: number, random: () => number = Math.random): number {
  const index = Math.min(Math.max(attempt, 0), RECONNECT_BACKOFF_MS.length - 1);
  const base: number = RECONNECT_BACKOFF_MS[index] ?? RECONNECT_BACKOFF_MS[4];
  return base + Math.floor(random() * (RECONNECT_JITTER_MS + 1));
}

export function createHeartbeatClient(options: HeartbeatClientOptions): HeartbeatClient {
  const {
    url,
    socketFactory = defaultSocketFactory,
    now = Date.now,
    onResync,
    random = Math.random,
    onInvalidMessage = defaultInvalidMessage,
  } = options;

  const listeners = new Set<() => void>();
  let snapshot: HeartbeatSnapshot = INITIAL_SNAPSHOT;
  let socket: SocketLike | null = null;
  let running = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let staleTimer: ReturnType<typeof setInterval> | null = null;

  function update(patch: Partial<HeartbeatSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }

  function detach(target: SocketLike): void {
    target.onopen = null;
    target.onmessage = null;
    target.onclose = null;
    target.onerror = null;
  }

  function handleDisconnect(target: SocketLike): void {
    // Ignore late events from a socket that was already replaced or stopped.
    if (!running || target !== socket) return;
    detach(target);
    socket = null;
    const attempt = snapshot.reconnectAttempt;
    const delay = reconnectDelayMs(attempt, random);
    update({ state: HeartbeatState.OFFLINE, reconnectAttempt: attempt + 1 });
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function handleMessage(target: SocketLike, data: unknown): void {
    if (!running || target !== socket) return;
    if (typeof data !== 'string') {
      onInvalidMessage('non-text frame', data);
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      onInvalidMessage('invalid JSON', data);
      return;
    }
    const parsed = WsServerMessageSchema.safeParse(json);
    if (!parsed.success) {
      onInvalidMessage('schema mismatch', json);
      return;
    }
    const message = parsed.data;
    if (message.type === 'heartbeat') {
      const resynced = snapshot.state === HeartbeatState.CONNECTING && snapshot.reconnectAttempt > 0;
      update({
        state: HeartbeatState.LIVE,
        seq: message.seq,
        serverTime: message.serverTime,
        clients: message.clients,
        lastBeatAt: now(),
        ...(resynced ? { reconnectAttempt: 0 } : {}),
      });
      if (resynced) onResync?.();
    }
  }

  function connect(): void {
    if (!running) return;
    update({ state: HeartbeatState.CONNECTING });
    let next: SocketLike;
    try {
      next = socketFactory(url);
    } catch (error) {
      warnDev('socket factory failed; scheduling reconnect', error);
      // Treat as an immediate disconnect so the backoff loop continues.
      const placeholder: SocketLike = {
        readyState: 3,
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
        close: () => undefined,
      };
      socket = placeholder;
      handleDisconnect(placeholder);
      return;
    }
    socket = next;
    next.onmessage = (event) => handleMessage(next, event.data);
    next.onclose = () => handleDisconnect(next);
    next.onerror = () => handleDisconnect(next);
  }

  function checkStale(): void {
    if (snapshot.state !== HeartbeatState.LIVE || snapshot.lastBeatAt === null) return;
    if (now() - snapshot.lastBeatAt >= HEARTBEAT_STALE_AFTER_MS) {
      update({ state: HeartbeatState.STALE });
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    start() {
      if (running) return;
      running = true;
      staleTimer = setInterval(checkStale, STALE_CHECK_INTERVAL_MS);
      connect();
    },
    stop() {
      if (!running) return;
      running = false;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      if (staleTimer !== null) clearInterval(staleTimer);
      reconnectTimer = null;
      staleTimer = null;
      const current = socket;
      socket = null;
      if (current) {
        detach(current);
        try {
          current.close(NORMAL_CLOSURE, 'client stopped');
        } catch {
          // Closing a socket that never opened can throw in some runtimes; nothing to recover.
        }
      }
      update({ state: HeartbeatState.OFFLINE });
    },
  };
}
