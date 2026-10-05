// The session registry without a database (plan row W24): the two paths that PostgreSQL cannot
// be made to take in a test. A read that fails, and a session that is past its limit although
// the expiry statement ended nothing. The registry runs on stand-ins for the pool and the
// pipeline; everything else about sessions is proven against PostgreSQL in `sessions.db.test.ts`.
import { OperatorRole } from '@dems/shared/sim';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordingErrorLog, testLogger, type RecordingErrorLog, type TestLogger } from '../../../../test/support/core';
import { dbPlugin, type Database } from '../../../plugins/db';
import { ApiFailure } from '../../../plugins/error-envelope';
import type { ErrorLog } from '../../../plugins/logger';
import { SESSION_IDLE_TIMEOUT_MS } from '../limits';
import { createSessionRegistry, readDatabase, type SessionRegistry } from '../sessions';

const NOW = Date.UTC(2031, 0, 1);
const TOKEN = `ses_${'S'.repeat(43)}`;

/** A row as the lookup of stage 4 returns it: an open web session whose last activity is `lastSeenAt`. */
function sessionRow(lastSeenAt: number, endedAt: number | null = null): Record<string, unknown> {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    operator_id: 'OPR-002',
    device_id: null,
    method: 'PASSWORD',
    issued_at: String(lastSeenAt),
    last_seen_at: String(lastSeenAt),
    absolute_expires_at: String(lastSeenAt + 8 * 60 * 60_000),
    ended_at: endedAt === null ? null : String(endedAt),
    end_reason: endedAt === null ? null : 'SIGNED_OUT',
    username: 'andi.pratama',
    rank: 'AKP',
    name: 'Andi Pratama',
    display_name: 'AKP Andi Pratama',
    initials: 'AP',
    role_id: OperatorRole.SUPERVISOR,
    enabled: true,
    permissions: ['USER_ADMIN'],
  };
}

interface Harness {
  readonly registry: SessionRegistry;
  readonly app: FastifyInstance;
  readonly logger: TestLogger;
  readonly errorLog: RecordingErrorLog;
  readonly query: ReturnType<typeof vi.fn>;
  readonly run: ReturnType<typeof vi.fn>;
  readonly probe: ReturnType<typeof vi.fn>;
  readonly publish: ReturnType<typeof vi.fn>;
}

let logger: TestLogger | undefined;

afterEach(async () => {
  await logger?.close();
  logger = undefined;
});

/**
 * `app.db` as the pool plugin itself builds it, over a stand-in pool: its `read` is the plugin's
 * own (`app.db.read`, review finding CPB1-8), which the module's reads go through since fix
 * round B1, so a read that fails is reported here exactly as in the server. The plugin function
 * runs on a host that has what it asks for and nothing else; the probe is the test's spy.
 */
function poolPluginDatabase(query: Pool['query'], probe: Database['probe'], log: FastifyBaseLogger, errorLog: ErrorLog): Database {
  const host: Record<string, unknown> = {
    config: { database: { database: 'stand-in' } },
    readiness: { set: () => undefined, snapshot: () => ({ database: true, engine: true }), addBootStep: () => undefined },
    log,
    errorLog,
    decorate: (name: string, value: unknown) => void (host[name] = value),
    addHook: () => undefined,
  };
  const pool = { query, on: () => pool };
  void dbPlugin(host as unknown as FastifyInstance, { createPool: () => pool as unknown as Pool });
  return Object.assign(host['db'] as Database, { probe });
}

/** The registry on stand-ins: `query` answers the pool's reads, `run` is the pipeline. */
function harness(query: (text: string) => Promise<unknown>, run: () => Promise<unknown> = async () => null): Harness {
  logger = testLogger('trace');
  const errorLog = recordingErrorLog();
  const spies = { query: vi.fn(query), run: vi.fn(run), probe: vi.fn(async () => false), publish: vi.fn() };
  const app = {
    db: poolPluginDatabase(spies.query as unknown as Pool['query'], spies.probe, logger.log, errorLog),
    pipeline: { run: spies.run },
    clock: { now: () => NOW },
    log: logger.log,
    errorLog,
    publish: spies.publish,
  } as unknown as FastifyInstance;
  return { registry: createSessionRegistry(app), app, logger, errorLog, ...spies };
}

describe('a read that fails', () => {
  const failure = Object.assign(new Error('connection terminated: marker-w24-driver-message'), { code: '57P01' });

  it('answers 503 NOT_READY, logs the code and never the message, persists one entry and asks for a fresh probe', async () => {
    const test = harness(async () => {
      throw failure;
    });
    const refused = await test.registry.resolve(TOKEN, 'COOKIE').catch((error: unknown) => error);

    expect(refused).toBeInstanceOf(ApiFailure);
    expect(refused).toMatchObject({ statusCode: 503, code: 'NOT_READY' });
    expect(test.probe).toHaveBeenCalledWith({ fresh: true });

    const line = test.logger.captured.lines().find((entry) => entry['msg'] === 'a read on the pool failed');
    expect(line).toMatchObject({ level: 50, source: 'identity.sessions.resolve', err: { code: '57P01' } });
    expect(test.errorLog.entries).toEqual([
      expect.objectContaining({ level: 'error', source: 'identity.sessions.resolve', message: 'a read on the pool failed', code: '57P01' }),
    ]);
    const everything = test.logger.captured.text() + JSON.stringify(test.errorLog.entries);
    expect(everything.includes('marker-w24-driver-message')).toBe(false);
    expect(everything.includes(TOKEN)).toBe(false);
    // Nothing was decided from a failed read: no unit ran.
    expect(test.run).not.toHaveBeenCalled();
  });

  it('the sweeper\'s read fails the same way: no unit, and the failure is the caller\'s to report', async () => {
    const test = harness(async () => {
      throw failure;
    });
    await expect(test.registry.sweep()).rejects.toMatchObject({ statusCode: 503, code: 'NOT_READY' });
    expect(test.run).not.toHaveBeenCalled();
    expect(test.errorLog.entries.map((entry) => entry.source)).toEqual(['identity.sessions.sweep']);
  });

  it('an ApiFailure thrown inside a read is handed on as it is', async () => {
    const test = harness(async () => ({ rows: [] }));
    const own = new ApiFailure(503, 'NOT_READY', 'x');
    await expect(readDatabase(test.app, 'identity.test', async () => Promise.reject(own))).rejects.toBe(own);
    expect(test.errorLog.entries).toEqual([]);
  });
});

describe('a session past its limit never resolves', () => {
  it('ended by this request: ENDED with the reason the statement gave', async () => {
    const test = harness(
      async () => ({ rows: [sessionRow(NOW - SESSION_IDLE_TIMEOUT_MS)] }),
      async () => ({ id: '11111111-1111-4111-8111-111111111111', operatorId: 'OPR-002', deviceId: null, endReason: 'IDLE_EXPIRED' }),
    );
    expect(await test.registry.resolve(TOKEN, 'COOKIE')).toEqual({
      status: 'ENDED',
      sessionId: '11111111-1111-4111-8111-111111111111',
      deviceId: null,
      endReason: 'IDLE_EXPIRED',
    });
    expect(test.run).toHaveBeenCalledTimes(1);
    expect(test.run.mock.calls[0]?.[0]).toBe('identity.expireSession');
    expect(test.query).toHaveBeenCalledTimes(1);
  });

  it('the statement ended nothing because activity arrived first: the session is read again and is open', async () => {
    const rows = [sessionRow(NOW - SESSION_IDLE_TIMEOUT_MS), sessionRow(NOW - 1)];
    const test = harness(async () => ({ rows: [rows.shift()] }));
    expect(await test.registry.resolve(TOKEN, 'COOKIE')).toMatchObject({ status: 'OPEN', session: { lastSeenAt: NOW - 1 } });
    expect(test.query).toHaveBeenCalledTimes(2);
  });

  it('the statement ended nothing because another unit ended it: ENDED with that unit\'s reason', async () => {
    const rows = [sessionRow(NOW - SESSION_IDLE_TIMEOUT_MS), sessionRow(NOW - SESSION_IDLE_TIMEOUT_MS, NOW - 5)];
    const test = harness(async () => ({ rows: [rows.shift()] }));
    expect(await test.registry.resolve(TOKEN, 'COOKIE')).toMatchObject({ status: 'ENDED', endReason: 'SIGNED_OUT' });
  });

  it('still open and still past the limit after the statement ended nothing (which cannot be): it fails closed', async () => {
    const test = harness(async () => ({ rows: [sessionRow(NOW - SESSION_IDLE_TIMEOUT_MS)] }));
    expect(await test.registry.resolve(TOKEN, 'COOKIE')).toMatchObject({ status: 'ENDED', endReason: 'IDLE_EXPIRED' });
    expect(test.query).toHaveBeenCalledTimes(2);
  });

  it('one millisecond before the idle limit it is open, and no unit runs', async () => {
    const test = harness(async () => ({ rows: [sessionRow(NOW - SESSION_IDLE_TIMEOUT_MS + 1)] }));
    expect(await test.registry.resolve(TOKEN, 'COOKIE')).toMatchObject({ status: 'OPEN' });
    expect(test.run).not.toHaveBeenCalled();
  });

  it('the lookup is given the hash of the token, 32 bytes, never the token', async () => {
    const seen: unknown[][] = [];
    const test = harness(async () => ({ rows: [] }));
    test.query.mockImplementation(async (_text: string, values: unknown[]) => {
      seen.push(values);
      return { rows: [] };
    });
    expect(await test.registry.resolve(TOKEN, 'BEARER')).toEqual({ status: 'UNKNOWN' });
    expect(seen).toHaveLength(1);
    const parameter: unknown = seen[0]?.[0];
    expect(Buffer.isBuffer(parameter) ? parameter.length : -1).toBe(32);
    expect(JSON.stringify(seen).includes(TOKEN)).toBe(false);
  });
});
