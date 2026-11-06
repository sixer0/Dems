/**
 * Test support (not a test file) for the request guards of plan row W23: an app built by the
 * real factory with scratch routes, no database and no listener, and the assertions every
 * refusal of the guards has to pass (AC-B-14 in unit form).
 *
 * The app has the real stages 3, 4 and 5. A request that presents no credential resolves to
 * ANONYMOUS through the real stage 4; a test that wants a particular caller replaces stage 4
 * there with `authenticateAs` or `authenticateBySpecification`.
 */
import { ApiErrorSchema, CREDENTIAL_CONFLICT_REASON, REQUEST_ID_HEADER_NAME } from '@dems/shared/api';
import { OperatorRole, createManualClock } from '@dems/shared/sim';
import type { FastifyInstance, FastifyRequest, LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';
import { buildApp } from '../../../app';
import type { CoreServerConfig } from '../../../config';
import type { Principal } from '../../authenticate';
import { createFakePool, unitTestConfig } from '../../../../test/support/config';
import { ApiFailure } from '../../error-envelope';
import type { LogStream } from '../../logger';
import { FORBIDDEN_RESPONSE_HEADERS, RESPONSE_HEADERS } from '../../response-headers';

/** The main instance's values (`unitTestConfig()` listens on 4420). */
export const SESSION_COOKIE = 'dems_session_4420';
export const WEB_CONSOLE_ORIGIN = 'http://127.0.0.1:5173';
export const OWN_ORIGIN = 'http://127.0.0.1:4420';
export const FOREIGN_ORIGIN = 'http://evil.example';

/** A fixed start for the manual clock: 2026-10-04T00:00:00Z. */
export const CLOCK_START = Date.UTC(2026, 9, 4);

/** What a response may carry besides the five headers of OR-9: the request ID (decision D55), and the scaffold's own list. */
const TRANSPORT_HEADERS = [REQUEST_ID_HEADER_NAME, 'content-type', 'content-length', 'date', 'connection', 'allow', 'retry-after'];

export const SCRATCH_READ = '/api/v1/scratch/1';
export const SCRATCH_COMMAND = '/api/v1/scratch/1';
export const SCRATCH_PATTERN = '/api/v1/scratch/:id';

export interface GuardAppOptions {
  readonly config?: CoreServerConfig;
  readonly logStream?: LogStream;
  readonly errorLogFile?: string;
  /** More routes, added before `ready()`. */
  readonly routes?: (app: FastifyInstance) => void;
  /** Leave the server not ready (stage 2 then refuses everything but health). */
  readonly notReady?: boolean;
}

export interface GuardApp {
  readonly app: FastifyInstance;
  /** The server clock of this app: it moves only when the test moves it (ENG-16). */
  readonly clock: ReturnType<typeof createManualClock>;
  /** How often each scratch handler ran: a refusal by a stage leaves it unchanged. */
  readonly handled: { read: number; command: number };
}

/** An app with `GET` and `POST /api/v1/scratch/:id`, ready, on a manual clock. */
export async function buildGuardApp(options: GuardAppOptions = {}): Promise<GuardApp> {
  const app = buildApp({
    config: options.config ?? unitTestConfig(),
    // A pool that answers: the health operation then leaves `ready.database` alone.
    createPool: () => createFakePool().pool,
    ...(options.logStream === undefined ? {} : { logStream: options.logStream }),
    ...(options.errorLogFile === undefined ? {} : { errorLogFile: options.errorLogFile }),
  });
  const handled = { read: 0, command: 0 };
  app.get(SCRATCH_PATTERN, { config: { operationId: 'scratchRead' } }, async () => {
    handled.read += 1;
    return { ok: true };
  });
  app.post(SCRATCH_PATTERN, { config: { operationId: 'scratchCommand' } }, async () => {
    handled.command += 1;
    return { ok: true };
  });
  options.routes?.(app);
  await app.ready();
  // By-design change (plan row W28): not about stage 6; a scratch route is no registry operation.
  app.stages.replace('accessRule', () => {});
  const clock = createManualClock(CLOCK_START);
  app.seams.replace('clock', clock);
  if (options.notReady !== true) {
    app.readiness.set('database', true);
    app.readiness.set('engine', true);
  }
  return { app, clock, handled };
}

// ── Principals, as stage 4 will resolve them (spec §4.1) ───────────────────────────────────────

export function operatorPrincipal(operatorId: string, sessionId = 'AS-0001', deviceId: string | null = null): Principal {
  return { kind: 'OPERATOR', operatorId, sessionId, deviceId, role: OperatorRole.TECHNICIAN, permissions: [] };
}

export function devicePrincipal(deviceId: string): Principal {
  return { kind: 'DEVICE', deviceId };
}

/** A retired device credential: not a principal; stage 4 keeps only the device ID (RB-6). */
export function retiredDevice(deviceId: string): Principal {
  return { kind: 'ANONYMOUS', retiredDeviceId: deviceId };
}

/** Puts a stand-in at stage 4 that resolves every request to what `pick` returns. */
export function authenticateAs(app: FastifyInstance, pick: (request: FastifyRequest) => Principal): void {
  app.stages.replace('authenticate', (request) => {
    request.principal = pick(request);
  });
}

/**
 * Puts a stand-in at stage 4 that does what spec §4.1 and ID-12 say about the credentials that
 * are PRESENT: a cookie and an `Authorization` header together are refused with 401
 * `NOT_SIGNED_IN` and `details.reason: CREDENTIAL_CONFLICT`; a cookie alone resolves to a web
 * operator, a bearer alone to a device. The real stage 4 is plan row W24's; this stand-in lets
 * the decision table be read end to end before it exists.
 */
export function authenticateBySpecification(app: FastifyInstance): void {
  app.stages.replace('authenticate', (request) => {
    const { hasCookie, hasBearer } = app.originDecision(request);
    if (hasCookie && hasBearer) {
      throw new ApiFailure(401, 'NOT_SIGNED_IN', 'Send one credential per request.', {
        details: { reason: CREDENTIAL_CONFLICT_REASON },
      });
    }
    if (hasCookie) request.principal = operatorPrincipal('OP-0001');
    else if (hasBearer) request.principal = devicePrincipal('DEV-0001');
  });
}

// ── Assertions ─────────────────────────────────────────────────────────────────────────────────

export function errorOf(response: LightMyRequestResponse): { code: string; message: string; details?: unknown; requestId?: string } {
  return ApiErrorSchema.parse(response.json()).error;
}

/** No CORS header of any kind, whatever the answer (OR-5, SR-04). */
export function expectNoCorsHeader(response: LightMyRequestResponse): void {
  const names = Object.keys(response.headers).map((name) => name.toLowerCase());
  expect(names.filter((name) => name.startsWith('access-control-'))).toEqual([]);
}

/** The five headers of OR-9 with their values, and no header that OR-9 does not list. */
export function expectResponseHeaders(response: LightMyRequestResponse): void {
  for (const [name, value] of Object.entries(RESPONSE_HEADERS)) expect(response.headers[name], name).toBe(value);
  for (const name of FORBIDDEN_RESPONSE_HEADERS) expect(response.headers[name], name).toBeUndefined();
  const others = Object.keys(response.headers).filter(
    (name) => !(name in RESPONSE_HEADERS) && !TRANSPORT_HEADERS.includes(name),
  );
  expect(others).toEqual([]);
  expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
  expectNoCorsHeader(response);
}

/**
 * A refusal in the form AC-B-14 asks for: the status, a body that validates against `ApiError`
 * with the code, no stack trace, the header set of OR-9 and nothing else.
 */
export function expectRefusal(response: LightMyRequestResponse, status: number, code: string): void {
  expect(response.statusCode).toBe(status);
  const error = errorOf(response);
  expect(error.code).toBe(code);
  expect(typeof error.requestId).toBe('string');
  expect(response.body).not.toMatch(/\n\s+at /);
  expect(response.body).not.toContain('node_modules');
  expectResponseHeaders(response);
}
