import { z } from 'zod';
import { SessionState } from '../domain/enums';

/** Server → client heartbeat, one JSON object per WS text frame (masterplan/01_specs.md §2.5). */
export interface Heartbeat {
  type: 'heartbeat';
  /** Message schema version. */
  v: 1;
  /** Global tick counter since server start; the connect-time message carries the current value (0 before the first tick). */
  seq: number;
  /** ISO-8601 UTC. */
  serverTime: string;
  /** Integer, >= 0. */
  uptimeMs: number;
  intervalMs: 1000;
  /** Connected WS clients at send time. */
  clients: number;
  /** Always null in this phase (D4: no simulator in mock-core). */
  sessionState: SessionState | null;
}

/** Discriminated on `type`; the feature phase adds members. */
export type WsServerMessage = Heartbeat;

export const HeartbeatSchema = z.object({
  type: z.literal('heartbeat'),
  v: z.literal(1),
  seq: z.int().nonnegative(),
  serverTime: z.iso.datetime(),
  uptimeMs: z.int().nonnegative(),
  intervalMs: z.literal(1000),
  clients: z.int().nonnegative(),
  sessionState: z.enum(SessionState).nullable(),
});

export const WsServerMessageSchema = z.discriminatedUnion('type', [HeartbeatSchema]);

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const heartbeatSchemaMatches: Exact<z.infer<typeof HeartbeatSchema>, Heartbeat> = true;
const wsSchemaMatches: Exact<z.infer<typeof WsServerMessageSchema>, WsServerMessage> = true;
void heartbeatSchemaMatches;
void wsSchemaMatches;
