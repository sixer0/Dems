/**
 * Test support of the sessions module (plan row W34; not a test file). Nothing here imports
 * Vitest's `expect`.
 *
 * Database tests (`*.db.test.ts`, project `db`): the real app factory on a clone, connected as
 * `dems_app`, BOOTED, so the engine host is rehydrated and runs. The engine is on a manual timer
 * and the server on a manual clock (the engine row's `engineApp`): it ticks exactly when a test
 * drives it. Every stage of the request pipeline is the real one: a caller is a seeded operator
 * who signed in on the web console through `POST /api/v1/auth/sign-in`, and every request of a
 * test is `app.inject` with that operator's cookie. No listener.
 *
 * A session cookie is taken from a sign-in answer and handed on in a header; it is never
 * printed, logged or put into a test name (P19).
 */
import { OPERATORS, type AuditRow, type OperatorRole, type SessionCreateInput, type SimOperator } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { readHead, readTrail } from '../../../../test/support/core';
import { engineApp, type EngineApp, type EngineAppOptions, type EngineAppTarget } from '../../../../test/support/engine';
import { WEB_ORIGIN, cookieValue, webSignIn, type Headers } from '../../../../test/support/identity';

export const SESSION = '/api/v1/session';
export const CURRENT = `${SESSION}/current`;
export const HISTORY = `${SESSION}/history`;
export const CASE_NUMBER = `${SESSION}/case-number`;

/** The path of an operation on a session: `on('SES-…', 'start')`. */
export const on = (sessionId: string, operation: string): string => `${SESSION}/${sessionId}/${operation}`;

/** A session ID of the right form that is never the open session of a test. */
export const OTHER_SESSION = 'SES-20200101-0001';

/** The seeded operator of a role (`@dems/shared/sim` `OPERATORS`: one per role). */
export function seeded(role: OperatorRole): SimOperator {
  const operator = OPERATORS.find((candidate) => candidate.role === role);
  if (operator === undefined) throw new Error(`no seeded operator with role ${role}`);
  return operator;
}

/** A signed-in operator of the web console. */
export interface Caller {
  readonly operator: SimOperator;
  /** `{ cookie: 'dems_session_<port>=…' }`. */
  readonly cookie: Headers;
}

export interface SessionsApp extends EngineApp {
  /** Role `dems_owner` on the clone: assertions only. */
  readonly owner: Pool;
  /** Signs the seeded operator of a role in on the web console. */
  signIn(role: OperatorRole): Promise<Caller>;
  /** A POST of the web console: the caller's cookie and the web console `Origin`. */
  post(caller: Caller | null, url: string, payload?: object | string): Promise<LightMyRequestResponse>;
  /** A GET as a same-origin browser read sends it: the cookie and no `Origin`. */
  get(caller: Caller | null, url: string): Promise<LightMyRequestResponse>;
  /** The audit rows stored by `work`, in sequence order. */
  written(work: () => Promise<unknown>): Promise<AuditRow[]>;
}

export interface SessionsTarget extends EngineAppTarget {
  ownerPool(): Pool;
}

export interface SessionsAppOptions extends EngineAppOptions {
  /**
   * False: the app is ready but not booted, so the engine is stopped; the two readiness flags
   * are set by hand. For a test of the history read, which needs no engine. Default: booted.
   */
  readonly boot?: boolean;
}

/**
 * The real app on a clone, as `dems_app`, on a manual clock and a manual timer, booted (a
 * process start: the epoch moves on by 1 and the tablet link is OFFLINE). It is closed before
 * the clone is dropped.
 */
export async function sessionsApp(target: SessionsTarget, dataDir: string, options: SessionsAppOptions = {}): Promise<SessionsApp> {
  const host = await engineApp(target, dataDir, options);
  if (options.boot === false) {
    // A test of a read that needs no engine: the database answers, and stage 2 lets requests pass.
    if (!(await host.app.db.probe({ fresh: true }))) throw new Error('the clone does not answer as dems_app');
    host.app.readiness.set('engine', true);
  } else {
    await host.app.readiness.boot();
  }
  const owner = target.ownerPool();
  const cookieName = host.app.config.sessionCookieName;
  const { app } = host;

  return {
    ...host,
    owner,
    async signIn(role) {
      const operator = seeded(role);
      const response = await webSignIn(app, operator.username);
      const token = response.statusCode === 200 ? cookieValue(response, cookieName) : null;
      if (token === null) throw new Error(`the web sign-in of the ${role} answered ${response.statusCode}`);
      return { operator, cookie: { cookie: `${cookieName}=${token}` } };
    },
    post(caller, url, payload) {
      return app.inject({
        method: 'POST',
        url,
        headers: { origin: WEB_ORIGIN, ...caller?.cookie, ...(typeof payload === 'string' ? { 'content-type': 'application/json' } : {}) },
        ...(payload === undefined ? {} : { payload }),
      });
    },
    get(caller, url) {
      return app.inject({ method: 'GET', url, headers: { ...caller?.cookie } });
    },
    async written(work) {
      const before = await readHead(owner);
      await work();
      return (await readTrail(owner)).filter((row) => row.seq > before.seq);
    },
  };
}

/** A valid create input for an investigator; `caseNumber` tells two inputs apart. */
export function sessionInput(investigatorId: string, caseNumber = 'LP/2026/1001-0099'): Required<Pick<SessionCreateInput, 'room'>> & SessionCreateInput {
  return {
    caseNumber,
    subjectType: 'SAKSI',
    subjectName: 'Test Subject',
    investigatorId,
    room: 'Interview Room 1',
    profileId: 'STANDARD_1080P25',
  };
}

export interface ErrorOf {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, string | number | boolean | null>;
  readonly requestId?: string;
}

/** The error of an envelope answer. */
export function errorOf(response: LightMyRequestResponse): ErrorOf {
  return (response.json() as { error: ErrorOf }).error;
}

/** `[status, error code]` of an answer; the code is null for an answer that is no error envelope. */
export function outcome(response: LightMyRequestResponse): [number, string | null] {
  if (response.body === '') return [response.statusCode, null];
  return [response.statusCode, (response.json() as { error?: { code?: string } }).error?.code ?? null];
}

/** The body of an answer as the contract's validator takes it: undefined for an empty body. */
export function bodyOf(response: LightMyRequestResponse): unknown {
  return response.body === '' ? undefined : response.json();
}

/** The audit types of rows, in order. */
export const typesOf = (rows: readonly AuditRow[]): string[] => rows.map((row) => row.type);

/**
 * The integrity stream of a recording (`sim/generator.ts`): rows that arrive at random moments
 * drawn from the engine's random streams. A process start re-derives those streams from the
 * epoch, so two runs agree on everything BUT the arrivals of these three types.
 */
export const INTEGRITY_STREAM: readonly string[] = ['FRAME_HASH', 'WRITE_VERIFIED', 'TIMESTAMP_CONFIRMED'];

/** The rows that are no arrival of the integrity stream. */
export const withoutIntegrityStream = <Row extends { readonly type: string }>(rows: readonly Row[]): Row[] =>
  rows.filter((row) => !INTEGRITY_STREAM.includes(row.type));
