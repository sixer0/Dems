/**
 * The types of the realtime hub (plan row W42; HB-8). Types and one closed value set; `hub.ts`
 * holds the behaviour.
 */
import type { RealtimePrincipal } from '@dems/shared/api';
import type { OperatorRole, Permission } from '@dems/shared/sim';
import type { FastifyBaseLogger } from 'fastify';
import type { Clock } from '../core';
import type { EngineHost } from '../engine';
import type { DevicePresence } from '../modules/pairing';
import type { ErrorLog } from '../plugins/logger';
import type { Admission } from './admission';
import type { RealtimeLimits } from './limits';
import type { Publication } from './publication';
import type { TabletLink } from './tablet-link';

// ── What the hub is given ──────────────────────────────────────────────────────────────────────

/** One socket, as the hub needs it. The adapter over the socket library is in `index.ts`. */
export interface RealtimeTransport {
  /** Queues one text frame. It may throw when the socket is gone. */
  send(text: string): void;
  /** Bytes queued and not yet handed to the network. */
  readonly bufferedAmount: number;
  /** Sends the close frame; frames queued before it still leave first. */
  close(code: number, reason: string): void;
  /** Destroys the socket at once; nothing queued leaves. */
  terminate(): void;
  /** A protocol ping (RT-P3). */
  ping(): void;
}

export type HubEngine = Pick<EngineHost, 'epoch' | 'revision' | 'running' | 'state' | 'slice' | 'setTabletLink'>;

export interface HubDependencies {
  readonly clock: Clock;
  /** Read through the seam at each use: what a test puts in place after `ready()` is what runs. */
  readonly engine: () => HubEngine;
  /** The pairing module's presence counter; null when another object is behind its seam. */
  readonly presence: () => DevicePresence | null;
  readonly log: FastifyBaseLogger;
  readonly errorLog: ErrorLog;
  /** A new connection ID: letters, digits and hyphens (a UUID). It is not a credential. */
  readonly newId: () => string;
  readonly limits?: RealtimeLimits;
}

// ── What the hub answers ───────────────────────────────────────────────────────────────────────

/** What the socket route calls for one socket. */
export interface ConnectionHandle {
  readonly connectionId: string;
  /** One frame from the client. */
  receive(data: Buffer, isBinary: boolean): void;
  /** The client answered a ping. */
  pong(): void;
  /** The socket reported an error: it is closing, or it is destroyed at the close deadline. */
  failed(): void;
  /** The socket is closed; `code` is what the socket library reports. */
  closed(code: number): void;
}

/** Why a client message closed its socket with 1008. Never the message. */
export const ClientMessageRefusal = {
  /** More than 30 messages in 10 s (RT-P5). */
  RATE: 'RATE',
  /** A binary frame: a message is one JSON object per text frame. */
  NOT_TEXT: 'NOT_TEXT',
  NOT_JSON: 'NOT_JSON',
  /** Not a member of `WsClientMessageSchema`. */
  NOT_A_CLIENT_MESSAGE: 'NOT_A_CLIENT_MESSAGE',
  /** A message this principal may not send. */
  NOT_ALLOWED: 'NOT_ALLOWED',
} as const;
export type ClientMessageRefusal = (typeof ClientMessageRefusal)[keyof typeof ClientMessageRefusal];

/** A connection as a test, the health of the channel and the log may see it. No secret is in it. */
export interface ConnectionSummary {
  readonly connectionId: string;
  readonly principal: RealtimePrincipal;
  readonly operatorId: string | null;
  readonly sessionId: string | null;
  readonly deviceId: string | null;
  readonly role: OperatorRole | null;
  readonly permissions: readonly Permission[];
  readonly meters: boolean;
  /** Epoch and revision of the last state message sent; null before the first snapshot. */
  readonly position: { readonly epoch: number; readonly revision: number } | null;
  /** The close code the server sent, 0 for a socket that failed; null while open. */
  readonly closing: number | null;
  /** False from a protocol ping until its pong (RT-P3). */
  readonly alive: boolean;
  readonly bufferedAmount: number;
  readonly sent: ConnectionCounters;
}

export interface ConnectionCounters {
  readonly snapshots: number;
  readonly deltas: number;
  readonly meters: number;
  /** Meter frames not sent because the buffer was above `meterSkipBytes` (RT-P9). */
  readonly metersSkipped: number;
}

export interface HubStats {
  /** Open connections that are not being closed. */
  readonly connections: number;
  readonly anonymous: number;
  readonly devices: number;
  readonly operators: number;
  /** Sockets the hub still knows, those being closed included. */
  readonly sockets: number;
  readonly beats: number;
  /** Paced deltas waiting for the pace step. */
  readonly heldDeltas: number;
  /** Connections closed with 1013 at admission: beyond the total cap or the anonymous cap. */
  readonly refusedByCap: number;
  /** Sockets closed with 1013 because a newer socket of the same principal took their place. */
  readonly displaced: number;
  /** Connections closed with 4408. */
  readonly slowConsumers: number;
  /** Meter frames beyond the wire rate (RT-P8). */
  readonly metersOverRate: number;
  /** Snapshots sent because a socket's position did not fit the next delta. Expected: 0. */
  readonly healed: number;
  /** Sockets destroyed at the close deadline because the peer did not answer the close frame. */
  readonly terminated: number;
}

export interface RealtimeHub {
  /** The seam `app.publish`: returns at once and never throws. */
  publish(publication: Publication): void;
  /** Takes a socket whose upgrade passed stages 3 to 6. */
  admit(admission: Admission, transport: RealtimeTransport): ConnectionHandle;
  /** One heartbeat to every socket (the 1 Hz timer). */
  beat(): void;
  /** The pace step: waiting deltas, close deadlines, buffers, a waiting `resync`, the tablet link. */
  pace(): void;
  /** One protocol ping to every socket; a socket that did not answer the previous one is destroyed. */
  ping(): void;
  /** Closes every socket with 1001 and admits no other (spec §8.6 "Stop"). */
  shutdown(): void;
  /** Destroys every socket the hub still knows. */
  terminateAll(): void;
  connections(): ConnectionSummary[];
  stats(): HubStats;
  /** Called after a socket was admitted, closed or forgotten. Returns the way to stop listening. */
  onChange(listener: () => void): () => void;
  readonly tabletLink: TabletLink;
  readonly limits: RealtimeLimits;
}
