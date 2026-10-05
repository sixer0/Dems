/**
 * Test support of the pairing module (plan row W32; not a test file). Other rows import it:
 * `pairDevice` gives a later row a REAL paired device with a credential the server issued.
 *
 * NEUTRAL TEST SUPPORT (fix round B1, review finding CPB1-12). This file lives in
 * `apps/core-server/test/support/` because tests of several rows use it; it moved here from
 * `src/modules/pairing/__tests__/support.ts`, which re-exports it for one round. No production source imports
 * anything under `test/` (static test `test/static/imports.test.ts`).
 *
 * Database tests (`*.db.test.ts`, project `db`): the real app factory on the file's own clone,
 * connected as `dems_app`, on a manual clock, with every stage as the server has it and the
 * REAL device resolver behind its seam. No listener: every request is `app.inject`. The engine
 * is not booted (a booted engine ticks); one file boots it on a manual timer.
 *
 * Secrets. A pairing code and a device credential are taken from an answer and handed on; none
 * is ever written to a log, a test name, a snapshot or the message of an assertion (P19). What
 * a test prints are counts, statuses, audit types and identifiers.
 */
import { validateCoreApiResponse } from '@dems/shared/api';
import { OPERATORS } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';
import {
  WEB_ORIGIN,
  bearer,
  identityApp,
  signInOnWeb,
  type Headers,
  type IdentityApp,
  type IdentityAppOptions,
  type IdentityTarget,
} from './identity';
import { throttleControl } from '../../src/plugins/throttle';
import type { Publication } from '../../src/realtime';
import { pairingControl, type PairingControl } from '../../src/modules/pairing';

export const PAIRING = '/api/v1/pairing';
export const CODE = `${PAIRING}/code`;
export const CODE_CANCEL = `${PAIRING}/code/cancel`;
export const REDEEM = `${PAIRING}/redeem`;
export const DEVICES = `${PAIRING}/devices`;
export const DEVICE = `${PAIRING}/device`;
export const UNPAIR = `${PAIRING}/device/unpair`;
export const ROTATE = `${PAIRING}/device/credential`;
export const revokeUrl = (deviceId: string): string => `${DEVICES}/${deviceId}/revoke`;

export const INVESTIGATOR = OPERATORS[0]!;
/** The seeded operator who holds `PAIRING_MANAGE`. */
export const SUPERVISOR = OPERATORS[1]!;
export const TECHNICIAN = OPERATORS[2]!;

/** What a device sends with its code (client specification MP-5). No hardware identifier. */
export const TABLET = { deviceName: 'Interview tablet 01', platform: 'android', appVersion: '0.2.0' } as const;

export interface PairingApp extends IdentityApp {
  /** What the module put behind the seam `deviceResolver`. */
  readonly pairing: PairingControl;
  /** Everything the module, the identity module and the guard published, in order. */
  readonly published: Publication[];
}

/** The real app on a clone, ready, on a manual clock, with the publications recorded. */
export async function pairingApp(target: IdentityTarget, options: IdentityAppOptions = {}): Promise<PairingApp> {
  const identity = await identityApp(target, options);
  const published: Publication[] = [];
  identity.app.seams.replace('publish', (publication) => void published.push(publication));
  return { ...identity, pairing: pairingControl(identity.app), published };
}

/** Starts the redeem lock, every console lockout, throttle window and denial budget afresh. */
export function forgetLimits(pairing: PairingApp): void {
  pairing.pairing.lock.reset();
  pairing.control.lockout.reset();
  throttleControl(pairing.app).reset();
}

/** The cookie header of the seeded supervisor, signed in on the web console. */
export async function supervisorCookie(pairing: PairingApp): Promise<Headers> {
  return (await signInOnWeb(pairing, SUPERVISOR.username)).cookie;
}

/** A POST of the web console: the cookie and the web console `Origin`. */
export function portalPost(app: FastifyInstance, url: string, cookie: Headers, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN, ...cookie }, ...(payload === undefined ? {} : { payload }) });
}

/** A request as the mobile app sends it (decision D69): no `Origin`, no cookie, at most a bearer value. */
export function devicePost(app: FastifyInstance, url: string, credential: string | null, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url,
    headers: { host: '127.0.0.1:4420', 'user-agent': 'okhttp/4.12.0', ...(credential === null ? {} : bearer(credential)) },
    ...(payload === undefined ? {} : { payload }),
  });
}

export function deviceGet(app: FastifyInstance, url: string, credential: string | null): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'GET', url, headers: { host: '127.0.0.1:4420', 'user-agent': 'okhttp/4.12.0', ...(credential === null ? {} : bearer(credential)) } });
}

export interface IssuedCode {
  readonly codeId: string;
  /** Held by the test only; never printed. */
  readonly code: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly response: LightMyRequestResponse;
}

/** Operation 15 as the supervisor. */
export async function issueCode(pairing: PairingApp, cookie: Headers): Promise<IssuedCode> {
  const response = await portalPost(pairing.app, CODE, cookie);
  if (response.statusCode !== 201) throw new Error(`issuePairingCode answered ${response.statusCode}`);
  const body = response.json() as { codeId: string; code: string; issuedAt: number; expiresAt: number };
  return { codeId: body.codeId, code: body.code, issuedAt: body.issuedAt, expiresAt: body.expiresAt, response };
}

/** Operation 18 from a caller without a credential. */
export function redeem(app: FastifyInstance, code: string, overrides: Partial<Record<'deviceName' | 'platform' | 'appVersion', string>> = {}): Promise<LightMyRequestResponse> {
  return devicePost(app, REDEEM, null, { code, ...TABLET, ...overrides });
}

/** Six digits that are not `code`. */
export function wrongCodeFor(code: string): string {
  return String((Number(code) + 1) % 1_000_000).padStart(6, '0');
}

export interface PairedTestDevice {
  readonly deviceId: string;
  /** Held by the test only; never printed. */
  readonly credential: string;
  readonly codeId: string;
  readonly pairedAt: number;
}

/** A real paired device: a code issued by the supervisor and redeemed. */
export async function pairDevice(pairing: PairingApp, cookie: Headers, deviceName: string = TABLET.deviceName): Promise<PairedTestDevice> {
  const issued = await issueCode(pairing, cookie);
  const response = await redeem(pairing.app, issued.code, { deviceName });
  if (response.statusCode !== 201) throw new Error(`redeemPairingCode answered ${response.statusCode}`);
  const body = response.json() as { deviceId: string; deviceCredential: string; pairedAt: number };
  return { deviceId: body.deviceId, credential: body.deviceCredential, codeId: issued.codeId, pairedAt: body.pairedAt };
}

/** The answer validates against the contract for its operation and status (MODG). */
export function expectContract(operationId: string, response: LightMyRequestResponse): void {
  const body: unknown = response.body === '' ? undefined : response.json();
  expect(validateCoreApiResponse(operationId, response.statusCode, body), `${operationId} ${response.statusCode}`).toEqual({ ok: true });
}

/** `[status, error code]` of an answer; the code is null for an answer that is no error envelope. */
export function outcomeOf(response: LightMyRequestResponse): [number, string | null] {
  let code: string | null = null;
  try {
    code = (response.json() as { error?: { code?: string } }).error?.code ?? null;
  } catch {
    // No JSON body: a 204.
  }
  return [response.statusCode, code];
}

/** How many answers had each status. */
export function statusesOf(answers: readonly LightMyRequestResponse[]): Record<number, number> {
  return answers.reduce<Record<number, number>>((count, answer) => ({ ...count, [answer.statusCode]: (count[answer.statusCode] ?? 0) + 1 }), {});
}

/** The stored rows of the pairing tables, without any hash: only whether each hash column holds 32 bytes. */
export interface StoredCode {
  readonly id: string;
  readonly state: string;
  readonly issuedBy: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly failedAttempts: number;
  readonly closedAt: number | null;
  readonly closedBy: string | null;
  readonly hashBytes: number;
}

interface Asker {
  query<Row extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

export async function storedCodes(owner: Asker): Promise<StoredCode[]> {
  const { rows } = await owner.query<{
    id: string;
    state: string;
    issued_by_operator_id: string;
    issued_at: string;
    expires_at: string;
    failed_attempts: number;
    closed_at: string | null;
    closed_by_operator_id: string | null;
    hash_bytes: number;
  }>(
    'SELECT id, state, issued_by_operator_id, issued_at, expires_at, failed_attempts, closed_at, closed_by_operator_id, octet_length(code_hash) AS hash_bytes ' +
      'FROM public.pairing_codes ORDER BY length(id), id',
  );
  return rows.map((row) => ({
    id: row.id,
    state: row.state,
    issuedBy: row.issued_by_operator_id,
    issuedAt: Number(row.issued_at),
    expiresAt: Number(row.expires_at),
    failedAttempts: row.failed_attempts,
    closedAt: row.closed_at === null ? null : Number(row.closed_at),
    closedBy: row.closed_by_operator_id,
    hashBytes: row.hash_bytes,
  }));
}

export async function storedCode(owner: Asker, codeId: string): Promise<StoredCode> {
  const code = (await storedCodes(owner)).find((candidate) => candidate.id === codeId);
  if (code === undefined) throw new Error(`no stored code ${codeId}`);
  return code;
}

export interface StoredDevice {
  readonly id: string;
  readonly state: string;
  readonly name: string;
  readonly pairedWithCodeId: string;
  readonly lastSeenAt: number;
  readonly revokedBy: string | null;
  readonly revokeReason: string | null;
  readonly currentHashBytes: number | null;
  readonly hasNextHash: boolean;
  readonly rotatedAt: number | null;
}

export async function storedDevices(owner: Asker): Promise<StoredDevice[]> {
  const { rows } = await owner.query<{
    id: string;
    state: string;
    name: string;
    paired_with_code_id: string;
    last_seen_at: string;
    revoked_by_operator_id: string | null;
    revoke_reason: string | null;
    current_bytes: number | null;
    has_next: boolean | null;
    rotated_at: string | null;
  }>(
    'SELECT d.id, d.state, d.name, d.paired_with_code_id, d.last_seen_at, d.revoked_by_operator_id, d.revoke_reason, ' +
      'octet_length(c.current_hash) AS current_bytes, c.next_hash IS NOT NULL AS has_next, c.rotated_at ' +
      'FROM public.paired_devices d LEFT JOIN public.device_credentials c ON c.device_id = d.id ORDER BY length(d.id), d.id',
  );
  return rows.map((row) => ({
    id: row.id,
    state: row.state,
    name: row.name,
    pairedWithCodeId: row.paired_with_code_id,
    lastSeenAt: Number(row.last_seen_at),
    revokedBy: row.revoked_by_operator_id,
    revokeReason: row.revoke_reason,
    currentHashBytes: row.current_bytes,
    hasNextHash: row.has_next === true,
    rotatedAt: row.rotated_at === null ? null : Number(row.rotated_at),
  }));
}

export async function storedDevice(owner: Asker, deviceId: string): Promise<StoredDevice> {
  const device = (await storedDevices(owner)).find((candidate) => candidate.id === deviceId);
  if (device === undefined) throw new Error(`no stored device ${deviceId}`);
  return device;
}
