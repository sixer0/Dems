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

// Backend task 2026-10-04, plan row W19 (01_specs §7.4): the health body is widened additively.
describe('HealthResponse, widened for the Core server', () => {
  const core: HealthResponse = {
    ...health,
    service: 'dems-core-server',
    version: '0.2.0',
    ready: { database: true, engine: true },
  };

  it('accepts the Core server\'s answer: its service name and `ready`', () => {
    expect(HealthResponseSchema.parse(core)).toEqual(core);
    // A stopped database still answers 200; it shows in `ready`.
    expect(HealthResponseSchema.safeParse({ ...core, ready: { database: false, engine: false } }).success).toBe(true);
  });

  it('`ready` is optional: mock-core\'s and the launcher\'s answers stay valid and gain nothing', () => {
    expect(HealthResponseSchema.parse(health)).toEqual(health);
    expect('ready' in HealthResponseSchema.parse(health)).toBe(false);
    expect(HealthResponseSchema.safeParse({ ...health, service: 'dems-core-server' }).success).toBe(true);
  });

  it('rejects a `ready` that is incomplete or not boolean', () => {
    expect(HealthResponseSchema.safeParse({ ...core, ready: { database: true } }).success).toBe(false);
    expect(HealthResponseSchema.safeParse({ ...core, ready: { database: 'yes', engine: true } }).success).toBe(false);
    expect(HealthResponseSchema.safeParse({ ...core, ready: true }).success).toBe(false);
  });
});
