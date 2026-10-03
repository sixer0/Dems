/**
 * The Realtime panel's own heartbeat feed (01_specs §14.9; 03_motion_spec M-C-06, M-C-07).
 *
 * The app-wide `HeartbeatProvider` keeps ONE socket for the shell and the banner; its snapshot has
 * no raw messages and no uptime, and the panel's Connect switch must never cut the shell's link.
 * So the panel runs a second, panel-scoped `createHeartbeatClient` (same state machine, backoff and
 * stale check) over a tapping socket factory that also records each raw text frame. mock-core then
 * reports `clients: 2` while the panel is connected, which the panel shows.
 *
 * Origins: mock-core accepts WS upgrades only from the dev origins (`WEB_DEV_ORIGINS`, SPEC-C1);
 * the packaged launcher accepts its own origin. `allowedPageOrigins()` (lib/core-endpoint) gives
 * the list for this build, and `coreWsUrl()` the socket URL. On any other origin (the shared
 * page-coder Vite 127.0.0.1:5178, for example) the panel starts disconnected and says why,
 * instead of looping on refused upgrades; Connect still tries.
 * Tests inject the router-context `socketFactory`, so no real socket opens in jsdom.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { HeartbeatSchema, type Heartbeat } from '@dems/shared/api'
import { HeartbeatState } from '@dems/shared/domain'
import {
  createHeartbeatClient,
  type HeartbeatClient,
  type HeartbeatSnapshot,
  type SocketFactory,
  type SocketLike,
} from '@dems/shared/realtime'
import { allowedPageOrigins, coreWsUrl } from '@/lib/core-endpoint'
import { logApiReference } from './log'

/** How many raw messages the panel lists (01_specs §14.9: "the last 5 messages"). */
export const REALTIME_MESSAGE_LIMIT = 5

export type RealtimeChipState = 'ONLINE' | 'CONNECTING' | 'OFFLINE'

export interface RealtimeMessage {
  /** The heartbeat `seq` (unique per message on one server). */
  id: string
  /** Pretty-printed JSON of the frame. */
  json: string
}

export interface RealtimeFeed {
  chip: RealtimeChipState
  snapshot: HeartbeatSnapshot
  /** The newest valid heartbeat (uptime, interval, session state), or null. */
  last: Heartbeat | null
  /** Newest first, at most `REALTIME_MESSAGE_LIMIT`. */
  messages: readonly RealtimeMessage[]
  connected: boolean
  setConnected: (on: boolean) => void
  /** True when this page's origin is on mock-core's WS allowlist. */
  originAllowed: boolean
  origin: string
}

/** LIVE → ONLINE; CONNECTING and STALE (waiting for a beat) → CONNECTING; OFFLINE → OFFLINE. */
export function chipStateOf(state: HeartbeatState, connected: boolean): RealtimeChipState {
  if (!connected) return 'OFFLINE'
  if (state === HeartbeatState.LIVE) return 'ONLINE'
  if (state === HeartbeatState.OFFLINE) return 'OFFLINE'
  return 'CONNECTING'
}

interface Tap {
  record(raw: unknown): void
  subscribe(listener: () => void): () => void
  getMessages(): readonly RealtimeMessage[]
  getLast(): Heartbeat | null
}

function createTap(): Tap {
  let messages: readonly RealtimeMessage[] = []
  let last: Heartbeat | null = null
  const listeners = new Set<() => void>()
  return {
    record(raw) {
      if (typeof raw !== 'string') return
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return // the client logs invalid frames itself
      }
      const result = HeartbeatSchema.safeParse(parsed)
      if (!result.success) return
      last = result.data
      const entry: RealtimeMessage = { id: String(result.data.seq), json: JSON.stringify(result.data, null, 2) }
      messages = [entry, ...messages.filter((m) => m.id !== entry.id)].slice(0, REALTIME_MESSAGE_LIMIT)
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getMessages: () => messages,
    getLast: () => last,
  }
}

function browserSocket(url: string): SocketLike {
  const Ctor = (globalThis as { WebSocket?: new (u: string) => SocketLike }).WebSocket
  if (!Ctor) throw new Error('No WebSocket in this environment')
  return new Ctor(url)
}

/** Wraps a socket factory so every inbound frame is also handed to `onFrame`. */
export function tappingSocketFactory(base: SocketFactory | undefined, onFrame: (data: unknown) => void): SocketFactory {
  return (url) => {
    const socket = (base ?? browserSocket)(url)
    const proxy: SocketLike = {
      get readyState() {
        return socket.readyState
      },
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      close: (code, reason) => socket.close(code, reason),
    }
    socket.onopen = (event) => proxy.onopen?.(event)
    socket.onmessage = (event) => {
      onFrame(event.data)
      proxy.onmessage?.(event)
    }
    socket.onclose = (event) => proxy.onclose?.(event)
    socket.onerror = (event) => proxy.onerror?.(event)
    return proxy
  }
}

function currentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin
}

export function useRealtimeFeed(socketFactory?: SocketFactory): RealtimeFeed {
  const origin = currentOrigin()
  const originAllowed = allowedPageOrigins().includes(origin)
  const [tap] = useState(createTap)
  // The factory is read once: the client (and its socket factory) lives as long as the panel.
  const [client] = useState<HeartbeatClient>(() =>
    createHeartbeatClient({
      url: coreWsUrl(),
      socketFactory: tappingSocketFactory(socketFactory, (data) => tap.record(data)),
      onInvalidMessage: (reason) => logApiReference('warn', 'realtime.invalidMessage', new Error(reason)),
    }),
  )
  // Injected sockets (tests) and allowed origins connect at once; other origins wait for Connect.
  const [connected, setConnectedState] = useState(() => originAllowed || socketFactory !== undefined)

  useEffect(() => {
    if (!connected) return undefined
    try {
      client.start()
    } catch (error) {
      logApiReference('error', 'realtime.start', error)
    }
    return () => client.stop()
  }, [client, connected])

  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot)
  const messages = useSyncExternalStore(tap.subscribe, tap.getMessages, tap.getMessages)
  const last = useSyncExternalStore(tap.subscribe, tap.getLast, tap.getLast)
  const setConnected = useCallback((on: boolean) => setConnectedState(on), [])

  return useMemo(
    () => ({
      chip: chipStateOf(snapshot.state, connected),
      snapshot,
      last,
      messages,
      connected,
      setConnected,
      originAllowed,
      origin,
    }),
    [snapshot, last, messages, connected, setConnected, originAllowed, origin],
  )
}
