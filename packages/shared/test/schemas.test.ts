// S-2 (masterplan/01_specs.md §8): the REST and WS contract schemas accept valid samples and reject bad ones.
import { describe, expect, it } from 'vitest';
import {
  HealthResponseSchema,
  HeartbeatSchema,
  WsServerMessageSchema,
  type HealthResponse,
  type Heartbeat,
} from '../src/api';

const heartbeat: Heartbeat = {
  type: 'heartbeat',
  v: 1,
  seq: 7,
  serverTime: '2026-09-30T16:41:00.000Z',
  uptimeMs: 7012,
  intervalMs: 1000,
  clients: 2,
  sessionState: null,
};

const health: HealthResponse = {
  status: 'ok',
  service: 'dems-mock-core',
  version: '0.1.0',
  apiVersion: 'v1',
  serverTime: '2026-09-30T16:41:00.000Z',
  uptimeMs: 12034,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 2 },
};

describe('contract schemas', () => {
  it('parses a sample Heartbeat and HealthResponse', () => {
    expect(HeartbeatSchema.parse(heartbeat)).toEqual(heartbeat);
    expect(WsServerMessageSchema.parse(heartbeat)).toEqual(heartbeat);
    expect(HealthResponseSchema.parse(health)).toEqual(health);
  });

  it('accepts a SessionState value in a heartbeat', () => {
    expect(HeartbeatSchema.safeParse({ ...heartbeat, sessionState: 'RECORDING' }).success).toBe(true);
  });

  it("rejects type: 'nope'", () => {
    expect(WsServerMessageSchema.safeParse({ ...heartbeat, type: 'nope' }).success).toBe(false);
  });

  it('rejects seq: -1', () => {
    expect(WsServerMessageSchema.safeParse({ ...heartbeat, seq: -1 }).success).toBe(false);
  });

  it('rejects a non-ISO serverTime and a wrong service name', () => {
    expect(HeartbeatSchema.safeParse({ ...heartbeat, serverTime: 'yesterday' }).success).toBe(false);
    expect(HealthResponseSchema.safeParse({ ...health, service: 'other' }).success).toBe(false);
  });
});
