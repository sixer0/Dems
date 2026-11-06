/**
 * Test support of the biometric token (plan row W41; not a test file). Other rows may import it:
 * `enrol` gives a later row a REAL biometric token that the server issued.
 *
 * Database tests (`*.db.test.ts`, project `db`): the real app factory on the file's own clone,
 * connected as `dems_app`, on a manual clock, with every stage as the server has it, the REAL
 * device resolver of the pairing module behind its seam and the publications recorded. No
 * listener: every request is `app.inject`. The engine is not booted (a booted engine ticks);
 * one file boots it on a manual timer.
 *
 * Secrets. A biometric token, a session token and a device credential are taken from an answer
 * and handed on; none is ever written to a log, a test name, a snapshot or the message of an
 * assertion (P19). What a test prints are counts, statuses, audit types and identifiers.
 */
import { createHash } from 'node:crypto';
import type { AuditRow } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { readTrail } from '../../../../../test/support/core';
import { deviceSignIn } from '../../../../../test/support/identity';
import { devicePost, type PairedTestDevice } from '../../../../../test/support/pairing';

export {
  INVESTIGATOR,
  SUPERVISOR,
  TECHNICIAN,
  devicePost,
  expectContract,
  forgetLimits,
  outcomeOf,
  pairDevice,
  pairingApp as biometricApp,
  portalPost,
  revokeUrl,
  statusesOf,
  supervisorCookie,
  type PairedTestDevice,
  type PairingApp as BiometricApp,
} from '../../../../../test/support/pairing';

export const BIOMETRIC = '/api/v1/auth/biometric';
export const BIOMETRIC_SIGN_IN = `${BIOMETRIC}/sign-in`;
export const BIOMETRIC_FAILURE = `${BIOMETRIC}/failure`;

export const DAY = 24 * 60 * 60_000;
/** ID-P11, stated here on its own so that a test does not take the number from the code under test. */
export const THIRTY_DAYS = 30 * DAY;

/** The form of the three bearer secrets, for an assertion that names no value. */
export const BIO_FORM = /^bio_[A-Za-z0-9_-]{43}$/;
export const SES_FORM = /^ses_[A-Za-z0-9_-]{43}$/;

/** A value of the form of a biometric token that no server issued: one repeated letter. */
export const madeUpToken = (letter: string): string => `bio_${letter.repeat(43)}`;

/** A session of an operator on a paired device, created by PASSWORD: its bearer value. Held by the test only. */
export async function passwordSession(app: FastifyInstance, device: Pick<PairedTestDevice, 'credential'>, username: string): Promise<string> {
  const response = await deviceSignIn(app, device.credential, username);
  if (response.statusCode !== 200) throw new Error(`the password sign-in on the device answered ${response.statusCode}`);
  const { sessionToken } = response.json() as { sessionToken?: string };
  if (typeof sessionToken !== 'string') throw new Error('the password sign-in on the device returned no session token');
  return sessionToken;
}

/** Operation 7 with the bearer value of a session (or without a credential). */
export function setEnrolment(app: FastifyInstance, bearerValue: string | null, body: Record<string, unknown>): Promise<LightMyRequestResponse> {
  return devicePost(app, BIOMETRIC, bearerValue, body);
}

export interface Enrolled {
  /** Held by the test only; never printed. */
  readonly token: string;
  readonly expiresAt: number;
  readonly response: LightMyRequestResponse;
}

/** Operation 7 `enabled: true` in a password session: the token the server issued. */
export async function enrol(app: FastifyInstance, sessionToken: string): Promise<Enrolled> {
  const response = await setEnrolment(app, sessionToken, { enabled: true });
  if (response.statusCode !== 200) throw new Error(`setBiometricEnrollment answered ${response.statusCode}`);
  const body = response.json() as { token?: string; expiresAt?: number };
  if (typeof body.token !== 'string' || typeof body.expiresAt !== 'number') throw new Error('the enrolment returned no token');
  return { token: body.token, expiresAt: body.expiresAt, response };
}

/** A password session and an enrolment in it: what a device holds after the operator turned biometric sign-in on. */
export async function enrolledOperator(app: FastifyInstance, device: Pick<PairedTestDevice, 'credential'>, username: string): Promise<Enrolled & { readonly sessionToken: string }> {
  const sessionToken = await passwordSession(app, device, username);
  return { ...(await enrol(app, sessionToken)), sessionToken };
}

/** Operation 8 as the mobile app sends it: the device credential (or a session of the device) and the token in the body. */
export function biometricSignIn(app: FastifyInstance, bearerValue: string | null, token: unknown): Promise<LightMyRequestResponse> {
  return devicePost(app, BIOMETRIC_SIGN_IN, bearerValue, { token });
}

export interface SignedIn {
  /** Held by the test only; never printed. */
  readonly sessionToken: string;
  readonly biometricToken: string;
  readonly session: { readonly method: string; readonly deviceId: string | null; readonly operator: { readonly id: string }; readonly issuedAt: number };
  readonly response: LightMyRequestResponse;
}

/** Operation 8 that must succeed. */
export async function signInWithToken(app: FastifyInstance, bearerValue: string, token: string): Promise<SignedIn> {
  const response = await biometricSignIn(app, bearerValue, token);
  if (response.statusCode !== 200) throw new Error(`signInWithBiometric answered ${response.statusCode}`);
  const body = response.json() as { sessionToken?: string; biometricToken?: string; session: SignedIn['session'] };
  if (typeof body.sessionToken !== 'string' || typeof body.biometricToken !== 'string') throw new Error('the biometric sign-in returned no tokens');
  return { sessionToken: body.sessionToken, biometricToken: body.biometricToken, session: body.session, response };
}

/** Operation 9. */
export function reportFailure(app: FastifyInstance, bearerValue: string | null, operatorId: unknown): Promise<LightMyRequestResponse> {
  return devicePost(app, BIOMETRIC_FAILURE, bearerValue, { operatorId });
}

interface Asker {
  query<Row extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

/** A stored token without its hash: only how many bytes the hash column holds. */
export interface StoredToken {
  readonly id: string;
  readonly familyId: string;
  readonly deviceId: string;
  readonly operatorId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly usedAt: number | null;
  readonly revokedAt: number | null;
  readonly revokeReason: string | null;
  readonly hashBytes: number;
}

interface StoredTokenRow extends Record<string, unknown> {
  id: string;
  family_id: string;
  device_id: string;
  operator_id: string;
  issued_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  hash_bytes: number;
}

const TOKEN_COLUMNS =
  'id, family_id, device_id, operator_id, issued_at, expires_at, used_at, revoked_at, revoke_reason, octet_length(token_hash) AS hash_bytes';

const storedToken = (row: StoredTokenRow): StoredToken => ({
  id: row.id,
  familyId: row.family_id,
  deviceId: row.device_id,
  operatorId: row.operator_id,
  issuedAt: Number(row.issued_at),
  expiresAt: Number(row.expires_at),
  usedAt: row.used_at === null ? null : Number(row.used_at),
  revokedAt: row.revoked_at === null ? null : Number(row.revoked_at),
  revokeReason: row.revoke_reason,
  hashBytes: row.hash_bytes,
});

/** Every row of `biometric_tokens`, as `dems_owner`: in the order of issue, a used row before the one that followed it. */
export async function storedTokens(owner: Asker): Promise<StoredToken[]> {
  const { rows } = await owner.query<StoredTokenRow>(`SELECT ${TOKEN_COLUMNS} FROM public.biometric_tokens ORDER BY issued_at, used_at NULLS LAST, id`);
  return rows.map(storedToken);
}

/** The SHA-256 of a token as the server stores it. For a lookup and for a dump scan; never printed. */
export const tokenDigest = (token: string): Buffer => createHash('sha256').update(token, 'utf8').digest();

/** The stored row of a token, found by its SHA-256 as the server finds it; null when no row has it. */
export async function tokenRow(owner: Asker, token: string): Promise<StoredToken | null> {
  const { rows } = await owner.query<StoredTokenRow>(`SELECT ${TOKEN_COLUMNS} FROM public.biometric_tokens WHERE token_hash = $1`, [tokenDigest(token)]);
  return rows[0] === undefined ? null : storedToken(rows[0]);
}

/** The state of a token in one word, from its three columns. */
export function stateOf(token: StoredToken | null, now: number): string {
  if (token === null) return 'UNKNOWN';
  const parts = [
    token.usedAt === null ? null : 'USED',
    token.revokedAt === null ? null : `REVOKED(${token.revokeReason})`,
    token.usedAt === null && token.revokedAt === null ? (token.expiresAt > now ? 'LIVE' : 'EXPIRED') : null,
  ];
  return parts.filter((part) => part !== null).join('+');
}

/** Fixture clean-up between tests, as `dems_owner` (the runtime role cannot delete a token): the table is empty again. */
export async function clearTokens(owner: Asker): Promise<void> {
  await owner.query('DELETE FROM public.biometric_tokens');
}

/** The audit rows written since the trail had `from` rows. */
export async function trailSince(owner: Parameters<typeof readTrail>[0], from: number): Promise<AuditRow[]> {
  return (await readTrail(owner)).slice(from);
}

export async function trailLength(owner: Parameters<typeof readTrail>[0]): Promise<number> {
  return (await readTrail(owner)).length;
}

/** What a test asserts of a row: its type, who it names, the device, and its details. */
export function shapeOf(row: AuditRow): { type: string; actorId: string | null; deviceId: string | null; details: AuditRow['details'] } {
  return { type: row.type, actorId: row.actorId, deviceId: row.deviceId, details: row.details };
}

/** The open sessions and how each ended, for one device: `[operator, method, end reason or OPEN]`. */
export async function sessionsOf(owner: Asker, deviceId: string | null): Promise<Array<[string, string, string]>> {
  const { rows } = await owner.query<{ operator_id: string; method: string; end_reason: string | null }>(
    'SELECT operator_id, method, end_reason FROM public.auth_sessions WHERE device_id IS NOT DISTINCT FROM $1 ORDER BY issued_at, id',
    [deviceId],
  );
  return rows.map((row) => [row.operator_id, row.method, row.end_reason ?? 'OPEN']);
}

export async function sessionCount(owner: Asker): Promise<number> {
  const { rows } = await owner.query<{ n: string }>('SELECT count(*) AS n FROM public.auth_sessions');
  return Number(rows[0]?.n ?? 0);
}
