// Acceptance test "pairing lifecycle" of the DEMS Core server (plan row W48; success criterion
// SC5; AC-B-28, AC-B-32 to AC-B-39, AC-B-41, AC-B-82; spec §4.7, §5.6, §6, §9, §13).
//
// WHAT IS ASKED. A mobile device is paired from the portal, used, revoked, refused and paired
// again, and every step leaves its audit row: through the real routes, the real stages and the
// real socket.
//
// WHO THE CALLERS ARE.
//   the portal      a SUPERVISOR's web session: the cookie and a web console `Origin` on a POST,
//                   the cookie alone on a GET, the cookie and the origin on its socket;
//   the mobile app  a client that holds only what the answers gave it (a device credential, later
//                   a session token and a biometric token) and sends what the real app sends
//                   (measured, decision D69, finding F56): no `Origin` on REST, one bearer value,
//                   never a cookie; the own origin and the bearer value on its socket.
//
// WHAT IS REAL. The app is the real factory on the file's own clone of the seed, as `dems_app`,
// booted (a running engine) and LISTENING on `127.0.0.1` at an ephemeral port (port 0). Every
// REST call is `app.inject` through stages 2 to 7 and the modules' handlers; every socket is a
// real WebSocket to that listener. The Core link that a recording needs is never set by this
// file: it comes from the paired device's socket, and a control shows that without one the
// pre-check blocks.
//
// TIME. The server clock is a manual clock; the engine's timer and the channel's three timers
// are manual too. Nothing sleeps. The only real waits are bounded waits for a socket EVENT (the
// handshake, a message, the close): `SOCKET_EVENT_CAP_MS` here and the same 5 s guard in the
// realtime row's socket support. The two deadlines of 1 s (a revoked device's socket, a reused
// biometric token's session socket) are measured on the test's real clock, from the instant the
// request was sent to the close event of the client socket.
//
// SECRETS (P19). A pairing code, a device credential, a session token, a cookie value and a
// biometric token are taken from an answer and handed on. None is printed, logged, put into a
// test name, or handed to an assertion whose failure message would show it: an assertion sees
// forms, booleans, counts, identifiers and audit types. The scan at the end prints counts only.
import { createHash } from 'node:crypto';
import { connect as connectTcp, type AddressInfo } from 'node:net';
import { performance } from 'node:perf_hooks';
import { DEMO_OPERATOR_PASSWORD, type AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RawData } from 'ws';
import {
  OWN_ORIGIN,
  deviceHeaders,
  openSocket,
  realtimeApp,
  settle,
  untilSockets,
  webHeaders,
  type RealtimeApp,
  type TestSocket,
} from '../support/realtime';
import { useTestDatabase } from '../helpers/db';
import { credentialLeaks } from '../support/config';
import { linkProblems, readHead, readTrail, verifyTrail } from '../support/core';
import { SESSION as AUTH_SESSION, SIGN_IN, STATUS, cookieValue, deviceSignIn, get, occurrences, sessionOfToken, webSignIn, type Headers } from '../support/identity';
import {
  CODE,
  DEVICE,
  DEVICES,
  INVESTIGATOR,
  SUPERVISOR,
  deviceGet,
  devicePost,
  expectContract,
  portalPost,
  redeem,
  revokeUrl,
  storedCode,
  storedDevice,
} from '../support/pairing';

const db = useTestDatabase({ template: 'seed' });

// Caps, not waits: a clone waits for the clone lock, which the runs of other rows may hold.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

// ── The numbers of the specification, stated here and not taken from the code under test ────────

const SECOND = 1_000;
/** PR-P2 (spec §6.1): a pairing code is valid for 300 s. */
const CODE_LIFETIME_MS = 300 * SECOND;
/** PR-P4: three failed redeems within 300 s lock redeeming for 60 s. */
const REDEEM_WINDOW_MS = 300 * SECOND;
const REDEEM_LOCK_MS = 60 * SECOND;
/** PR-P5: the fifth failed redeem closes the code. */
const CODE_MAX_FAILED_REDEEMS = 5;
/** Spec §4.7, SR-41, SR-74: from the commit to the push and the close. */
const CONTROL_DEADLINE_MS = 1_000;
/** The engine resolves the eight checks within 4.9 s and finalises a stopped recording in under 20 s. */
const PRECHECK_MS = 5 * SECOND;
const FINALIZE_MS = 20 * SECOND;
/** The cap of every real wait of this file: a socket event that does not come within it fails the test. */
const SOCKET_EVENT_CAP_MS = 5_000;

const HEALTH = '/api/v1/health';
const REC_SESSION = '/api/v1/session';
const REC_CURRENT = `${REC_SESSION}/current`;
const BIOMETRIC = '/api/v1/auth/biometric';
const BIOMETRIC_SIGN_IN = `${BIOMETRIC}/sign-in`;
const onSession = (sessionId: string, operation: string): string => `${REC_SESSION}/${sessionId}/${operation}`;

/** What the mobile app sends on every REST call beside its bearer value (finding F56). */
const MOBILE_REST: Headers = { host: '127.0.0.1:4420', 'user-agent': 'okhttp/4.12.0' };

const CODE_FORM = /^\d{6}$/;
const DEVICE_ID_FORM = /^DEV-\d{4}$/;
const CREDENTIAL_FORM = /^dvc_[A-Za-z0-9_-]{43}$/;
const SESSION_TOKEN_FORM = /^ses_[A-Za-z0-9_-]{43}$/;
const BIOMETRIC_TOKEN_FORM = /^bio_[A-Za-z0-9_-]{43}$/;

/**
 * The integrity stream of a recording: rows that arrive at moments drawn from the engine's
 * random streams. They are counted, and left out of the asserted sequences.
 */
const INTEGRITY_STREAM: readonly string[] = ['FRAME_HASH', 'WRITE_VERIFIED', 'TIMESTAMP_CONFIRMED'];

/**
 * The device column of a `TABLET_LINK_CHANGED` row: the Core's tablet slot of the shared
 * simulator's hardware list, not the registry ID of the device that connected.
 */
const CORE_TABLET_SLOT = 'TABLET';

const REVOKE_REASON = 'Tablet reported lost during an interview';
const STOP_REASON = 'Recording device was revoked';

// ── The server ─────────────────────────────────────────────────────────────────────────────────

let rt: RealtimeApp;
let owner: Pool;
/** The audit head after the boot: every count of this file is relative to it (rule M9). */
let bootSeq = 0;
/** The instant of the boot on the server clock, for the printed lines. */
let bootAt = 0;

const rel = (at: number): string => `+${((at - bootAt) / SECOND).toFixed(2)} s`;

/** Everything a step may have left in flight has been committed and published. */
async function quiet(): Promise<void> {
  await rt.channel.settled();
  await rt.engine.idle();
  await rt.app.pipeline.drain();
  await rt.channel.settled();
}

// ── Secrets the test holds: remembered for the scan, never printed ─────────────────────────────

/** Bearer values, cookie values and biometric tokens, by label. */
const tokens = new Map<string, string>();
/** Pairing codes the server issued, by label, with the ID each is stored under. */
const codes = new Map<string, { readonly code: string; readonly codeId: string }>();
/** Six digits the test guessed with: never stored by the server in any form. */
const guesses = new Map<string, string>();

function rememberToken(label: string, value: string): string {
  tokens.set(label, value);
  return value;
}

/** Six digits that are not `code`: the n-th guess. */
function guessFor(label: string, code: string, n: number): string {
  const guess = String((Number(code) + n) % 1_000_000).padStart(6, '0');
  guesses.set(label, guess);
  return guess;
}

const sha256 = (text: string): Buffer => createHash('sha256').update(text, 'utf8').digest();

// ── Answers ────────────────────────────────────────────────────────────────────────────────────

/** The status and the body of every answer the journey received, in order. Read by the scan. */
const answers: Array<{ readonly status: number; readonly body: string }> = [];
const recorded = new WeakSet<LightMyRequestResponse>();

/** `[status, error code]` of an answer; the code is null for an answer that is no error envelope. */
function outcome(response: LightMyRequestResponse): [number, string | null] {
  if (!recorded.has(response)) {
    recorded.add(response);
    answers.push({ status: response.statusCode, body: response.body });
    // A refusal that echoed a secret fails HERE, named by label and form: no later assertion is handed its body.
    if (response.statusCode >= 400) expect(leaksIn('the body of a refusal', response.body)).toEqual([]);
  }
  if (response.body === '') return [response.statusCode, null];
  let code: string | null = null;
  try {
    code = (response.json() as { error?: { code?: string } }).error?.code ?? null;
  } catch {
    // No JSON body.
  }
  return [response.statusCode, code];
}

interface Refusal {
  readonly code: string;
  readonly message: string;
  readonly detailKeys: string[];
}

/** What a refusal tells its caller, without the request ID. */
function refusalOf(response: LightMyRequestResponse): Refusal {
  const error = (response.json() as { error: { code: string; message: string; details?: Record<string, unknown> } }).error;
  return { code: error.code, message: error.message, detailKeys: Object.keys(error.details ?? {}).sort() };
}

const detailsOf = (response: LightMyRequestResponse): Record<string, unknown> =>
  (response.json() as { error: { details?: Record<string, unknown> } }).error.details ?? {};

// ── The audit trail of the journey ─────────────────────────────────────────────────────────────

interface LedgerEntry {
  readonly step: string;
  readonly row: AuditRow;
}

/** Every audit row a step of this file wrote, in sequence order, with the step that wrote it. */
const ledger: LedgerEntry[] = [];

/** Runs one step and returns what it answered and the audit rows it wrote. */
async function step<Value>(name: string, work: () => Promise<Value>): Promise<{ value: Value; rows: AuditRow[] }> {
  await quiet();
  const before = (await readHead(owner)).seq;
  const value = await work();
  await quiet();
  const rows = (await readTrail(owner)).filter((row) => row.seq > before);
  for (const row of rows) ledger.push({ step: name, row });
  // AC-B-41, step by step: a row that held a code, a credential or a token fails HERE, named by
  // label and form, so that no assertion on a row's details or message can print one.
  expect(leaksIn(`the audit rows of the step "${name}"`, JSON.stringify(rows))).toEqual([]);
  return { value, rows };
}

type Named = [type: string, actor: string | null, device: string | null];

/** `[type, actor, device]` of each row that is no arrival of the integrity stream: what a step asserts. */
const who = (rows: readonly AuditRow[]): Named[] => rows.filter((row) => !INTEGRITY_STREAM.includes(row.type)).map((row) => [row.type, row.actorId, row.deviceId]);

// ── The portal: an operator's web session ──────────────────────────────────────────────────────

interface Portal {
  readonly operatorId: string;
  /** `{ cookie: 'dems_session_<port>=…' }`. Handed on, never printed. */
  readonly cookie: Headers;
}

/** Operation 2 from a web console: the session comes as a cookie and the body holds no token (ID-1 a). */
async function signInOnPortal(operator: { readonly id: string; readonly username: string }, label: string): Promise<Portal> {
  const response = await webSignIn(rt.app, operator.username);
  expect(outcome(response)).toEqual([200, null]);
  expectContract('signIn', response);
  expect(Object.keys(response.json() as object)).toEqual(['session']);
  const token = cookieValue(response, rt.cookieName);
  if (token === null) throw new Error('the web sign-in set no session cookie');
  rememberToken(label, token);
  return { operatorId: operator.id, cookie: { cookie: `${rt.cookieName}=${token}` } };
}

interface IssuedCode {
  readonly codeId: string;
  /** Held by the test only. */
  readonly code: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly attemptsAllowed: number;
  readonly sixDigits: boolean;
}

/** Operation 15 by the portal. */
async function issueCode(portal: Portal, label: string): Promise<IssuedCode> {
  const response = await portalPost(rt.app, CODE, portal.cookie);
  expect(outcome(response)).toEqual([201, null]);
  expectContract('issuePairingCode', response);
  const body = response.json() as { codeId: string; code: string; issuedAt: number; expiresAt: number; attemptsAllowed: number };
  codes.set(label, { code: body.code, codeId: body.codeId });
  return { codeId: body.codeId, code: body.code, issuedAt: body.issuedAt, expiresAt: body.expiresAt, attemptsAllowed: body.attemptsAllowed, sixDigits: CODE_FORM.test(body.code) };
}

/** The code the portal may read: its ID and the attempts left, or null. */
async function activeCode(portal: Portal): Promise<{ codeId: string; attemptsRemaining: number } | null> {
  const response = await get(rt.app, CODE, portal.cookie);
  expect(outcome(response)).toEqual([200, null]);
  expectContract('getPairingCodeStatus', response);
  const { active } = response.json() as { active: { codeId: string; attemptsRemaining: number } | null };
  return active === null ? null : { codeId: active.codeId, attemptsRemaining: active.attemptsRemaining };
}

interface ListedDevice {
  readonly id: string;
  readonly name: string;
  readonly state: string;
  readonly online: boolean;
  readonly signedInOperatorId: string | null;
  readonly pairedWithCodeId: string;
  readonly codeIssuedBy: string;
  readonly revokedBy: string | null;
  readonly revokeReason: string | null;
  readonly revokedAt: number | null;
}

/** Operation 19 by the portal: the registry, newest first. */
async function listDevices(portal: Portal): Promise<ListedDevice[]> {
  const response = await get(rt.app, DEVICES, portal.cookie);
  expect(outcome(response)).toEqual([200, null]);
  expectContract('listPairedDevices', response);
  // The registry never returns a credential or its hash (spec §6.5).
  expect(credentialLeaks(response.body)).toEqual([]);
  return (response.json() as { devices: ListedDevice[] }).devices;
}

async function listed(portal: Portal, deviceId: string): Promise<ListedDevice> {
  const device = (await listDevices(portal)).find((candidate) => candidate.id === deviceId);
  if (device === undefined) throw new Error(`the registry does not list ${deviceId}`);
  return device;
}

interface RecordingSession {
  readonly id: string;
  readonly state: string;
  readonly elapsedMs: number;
  readonly bytesWritten: number;
  readonly precheck: { readonly outcome: string | null; readonly items: ReadonlyArray<{ readonly id: string; readonly status: string; readonly value: string | null }> } | null;
}

/** Operation 27: the open session of the Core, as a caller with a web session reads it. */
async function currentSession(portal: Portal): Promise<RecordingSession | null> {
  const response = await get(rt.app, REC_CURRENT, portal.cookie);
  expect(outcome(response)).toEqual([200, null]);
  expectContract('getCurrentSession', response);
  return (response.json() as { session: RecordingSession | null }).session;
}

/** `[id, status, value]` of the Core link check and of every check that blocks. */
function coreCheckAndBlocks(session: RecordingSession | null): { core: unknown; blocking: string[] } {
  const items = session?.precheck?.items ?? [];
  const core = items.find((item) => item.id === 'CORE');
  return { core: core === undefined ? null : [core.status, core.value], blocking: items.filter((item) => item.status === 'BLOCK').map((item) => item.id) };
}

/** A valid create input; `caseNumber` tells two sessions apart. */
function sessionInput(investigatorId: string, caseNumber: string): Record<string, unknown> {
  return { caseNumber, subjectType: 'SAKSI', subjectName: 'Test Subject', investigatorId, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
}

// ── A real socket of the test ──────────────────────────────────────────────────────────────────

interface Ended {
  readonly code: number;
  /** The instant of the close event on the test's real clock (`performance.now()`). */
  readonly at: number;
}

interface Wire {
  readonly label: string;
  readonly socket: TestSocket;
  /** The text of every frame the socket received: what the scan reads. */
  readonly frames: string[];
  ended: Ended | null;
}

/** Every socket this file opened, in order. */
const wires: Wire[] = [];

function connect(label: string, headers: Headers): Wire {
  const socket = openSocket(rt.wsUrl, headers);
  const wire: Wire = { label, socket, frames: [], ended: null };
  socket.ws.on('message', (data: RawData, isBinary: boolean) => {
    wire.frames.push(isBinary ? '' : String(data));
  });
  socket.ws.on('close', (code: number) => {
    wire.ended = { code, at: performance.now() };
  });
  wires.push(wire);
  return wire;
}

const typesOf = (wire: Wire): string[] => [...new Set(wire.socket.types())];
const isOpen = (wire: Wire): boolean => wire.socket.ws.readyState === wire.socket.ws.OPEN;

/** The close of a socket: a bounded wait for the event, never a pause. */
function ended(wire: Wire): Promise<Ended> {
  if (wire.ended !== null) return Promise.resolve(wire.ended);
  return new Promise<Ended>((resolve, reject) => {
    const onClose = (code: number): void => {
      clearTimeout(guard);
      resolve(wire.ended ?? { code, at: performance.now() });
    };
    const guard = setTimeout(() => {
      wire.socket.ws.removeListener('close', onClose);
      reject(new Error(`${wire.label}: the socket was not closed within ${SOCKET_EVENT_CAP_MS} ms; it received [${typesOf(wire).join(', ')}]`));
    }, SOCKET_EVENT_CAP_MS);
    wire.socket.ws.once('close', onClose);
  });
}

/** The client closes its socket; resolves when the server has forgotten it. */
async function hangUp(wire: Wire): Promise<void> {
  const known = rt.channel.stats().sockets;
  wire.socket.ws.close(1000);
  await ended(wire);
  await untilSockets(rt, known - 1);
}

interface Hello {
  readonly principal: string;
  readonly topics: readonly string[];
  readonly reason?: string;
}

/** Opens a socket and waits for its `hello` and its connect-time heartbeat. */
async function online(label: string, headers: Headers): Promise<{ wire: Wire; hello: Hello }> {
  const wire = connect(label, headers);
  await wire.socket.opened;
  const hello = (await wire.socket.nextOf('hello')) as unknown as Hello;
  await wire.socket.nextOf('heartbeat');
  return { wire, hello };
}

// ── The mobile app ─────────────────────────────────────────────────────────────────────────────

/** What an installed app holds: only what the answers gave it. */
interface Tablet {
  readonly name: string;
  deviceId: string | null;
  /** Held by the test only. */
  credential: string | null;
  sessionToken: string | null;
  wire: Wire | null;
}

const tabletOf = (name: string): Tablet => ({ name, deviceId: null, credential: null, sessionToken: null, wire: null });

/** The one bearer value of the next request: the session token when signed in, else the device credential. */
const bearerOf = (tablet: Tablet): string | null => tablet.sessionToken ?? tablet.credential;

const mobileGet = (tablet: Tablet, url: string): Promise<LightMyRequestResponse> => deviceGet(rt.app, url, bearerOf(tablet));
const mobilePost = (tablet: Tablet, url: string, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> =>
  devicePost(rt.app, url, bearerOf(tablet), payload);

/** What React Native's socket sends: the origin of the URL it opens, and the bearer value if the app holds one. */
function mobileHeaders(tablet: Tablet): Headers {
  const value = bearerOf(tablet);
  return value === null ? { origin: OWN_ORIGIN, 'user-agent': 'okhttp/4.12.0' } : deviceHeaders(value);
}

/** The app (re)opens its one socket with the bearer value it holds now. */
async function reconnect(tablet: Tablet, label: string): Promise<Hello> {
  if (tablet.wire !== null && isOpen(tablet.wire)) await hangUp(tablet.wire);
  const { wire, hello } = await online(label, mobileHeaders(tablet));
  tablet.wire = wire;
  return hello;
}

/** Operation 18 by an app without a credential; the app keeps what a 201 gave it. */
async function pair(tablet: Tablet, code: string, label: string): Promise<LightMyRequestResponse> {
  const response = await redeem(rt.app, code, { deviceName: tablet.name });
  if (response.statusCode !== 201) return response;
  const body = response.json() as { deviceId: string; deviceCredential: string };
  tablet.deviceId = body.deviceId;
  tablet.credential = rememberToken(`${label}: device credential`, body.deviceCredential);
  return response;
}

/** Operation 2 on a paired device: the session token goes to the app's memory. */
async function signInOnTablet(tablet: Tablet, operator: { readonly username: string }, label: string): Promise<LightMyRequestResponse> {
  if (tablet.credential === null) throw new Error('the app holds no device credential');
  const response = await deviceSignIn(rt.app, tablet.credential, operator.username);
  if (response.statusCode !== 200) return response;
  tablet.sessionToken = rememberToken(`${label}: session token`, (response.json() as { sessionToken: string }).sessionToken);
  return response;
}

// ── What PostgreSQL holds, read as the owner role ──────────────────────────────────────────────

interface Asker {
  query<Row extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

interface Dump {
  /** Every table of schema `public` with its rows as `to_jsonb(row)` text: a `bytea` value appears as its hex form. */
  readonly tables: ReadonlyArray<{ readonly name: string; readonly lines: readonly string[] }>;
  readonly rows: number;
  readonly characters: number;
}

/** A dump of the clone: every row of every table the catalog lists in schema `public`. */
async function dumpOf(asker: Asker): Promise<Dump> {
  const { rows: catalog } = await asker.query<{ name: string }>("SELECT tablename::text AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  const tables: Array<{ name: string; lines: string[] }> = [];
  for (const { name } of catalog) {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('a table of schema public has a name this test does not put into a statement');
    const { rows } = await asker.query<{ line: string }>(`SELECT to_jsonb(t)::text AS line FROM public.${name} AS t`);
    tables.push({ name, lines: rows.map((row) => row.line) });
  }
  const lines = tables.flatMap((table) => table.lines);
  return { tables, rows: lines.length, characters: lines.reduce((sum, line) => sum + line.length + 1, 0) };
}

const textOf = (dump: Dump): string => dump.tables.map((table) => table.lines.join('\n')).join('\n');
const textOfTable = (dump: Dump, name: string): string => dump.tables.find((table) => table.name === name)?.lines.join('\n') ?? '';
const countOf = async (statement: string, values: unknown[] = []): Promise<number> => Number((await owner.query<{ n: string }>(statement, values)).rows[0]?.n);

// ── The scan: every form a leak would take ─────────────────────────────────────────────────────

/** Six digits as a value of their own: not inside a longer run of digits or hexadecimal digits, not decimals, not the number of an identifier. */
const standalone = (code: string): RegExp => new RegExp(`(?<![0-9a-fA-F.-])${code}(?![0-9a-fA-F])`, 'g');
/** The same six digits as a bare JSON number (`"bytes": 482133,`): a measurement, not a text. */
const bareNumber = (code: string): RegExp => new RegExp(`(?<=[:\\[,] ?)${code}(?= ?[,}\\]])`, 'g');
const matches = (text: string, pattern: RegExp): number => [...text.matchAll(pattern)].length;

/**
 * How often a code stands in a text AS TEXT. The contract's code is a text of six digits with
 * its leading zeros; a bare JSON number of the same digits is a measurement of the Core (a byte
 * count, an uptime) and cannot be told from one, so it is counted apart and not judged.
 */
function codeAsText(text: string, code: string): number {
  return matches(text, standalone(code)) - matches(text, bareNumber(code));
}

/** The forms a pairing code could have been written in. */
function codeForms(code: string): Record<string, (text: string) => number> {
  const bytes = Buffer.from(code, 'utf8');
  return {
    'digits as text': (text) => codeAsText(text, code),
    'the QR payload': (text) => occurrences(text, `DEMS-PAIR:1:${code}`),
    hex: (text) => occurrences(text, bytes.toString('hex')),
    base64: (text) => occurrences(text, bytes.toString('base64')),
  };
}

/** The forms a long secret (a credential, a token, the password) could have been written in. */
function secretForms(secret: string): Record<string, string> {
  const bytes = Buffer.from(secret, 'utf8');
  const half = Math.floor(secret.length / 2);
  const forms: Record<string, string> = {
    raw: secret,
    hex: bytes.toString('hex'),
    base64: bytes.toString('base64'),
    base64url: bytes.toString('base64url'),
    'first half': secret.slice(0, half),
    'last half': secret.slice(half),
  };
  // A token is a prefix and 32 random bytes as base64url: the bytes themselves, as a `bytea` would show them.
  const body = /^(?:dvc|ses|bio)_([A-Za-z0-9_-]{43})$/.exec(secret)?.[1];
  if (body !== undefined) {
    forms['without its prefix'] = body;
    forms['its 32 bytes as hex'] = Buffer.from(body, 'base64url').toString('hex');
  }
  return forms;
}

const FORMS_OF_A_CODE = 4;
const FORMS_OF_A_TOKEN = 8;
const PASSWORD = 'the demo password';

/**
 * Where the secrets of this file stand in a text: one entry per secret and form, named by the
 * label, the form and the place. Never the value. `baseline` is the same place before the
 * journey: six digits may stand in the seed's own data by chance.
 */
function leaksIn(place: string, text: string, baseline = ''): string[] {
  const found: string[] = [];
  for (const [label, value] of [...[...codes].map(([name, { code }]) => [name, code] as const), ...guesses]) {
    for (const [form, count] of Object.entries(codeForms(value))) {
      if (count(text) > count(baseline)) found.push(`${label} as ${form} in ${place}`);
    }
  }
  for (const [label, secret] of [...tokens, [PASSWORD, DEMO_OPERATOR_PASSWORD] as const]) {
    for (const [form, value] of Object.entries(secretForms(secret))) {
      // The halves of the password are words of the demo's own vocabulary; its whole forms are searched.
      if (label === PASSWORD && form.endsWith('half')) continue;
      if (occurrences(text, value) > 0) found.push(`${label} as ${form} in ${place}`);
    }
  }
  return found;
}

/** The leaks of a dump, table by table. */
function leaksOfDump(dump: Dump, baseline: Dump): string[] {
  return dump.tables.flatMap((table) => leaksIn(`table ${table.name}`, table.lines.join('\n'), textOfTable(baseline, table.name)));
}

function countBy(values: readonly string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((count, value) => ({ ...count, [value]: (count[value] ?? 0) + 1 }), {});
}

// ── The journey's state ────────────────────────────────────────────────────────────────────────

let dumpAtBoot: Dump;
let supervisor: Portal;
let investigatorOnWeb: Portal;
/** The portal's own socket: an OPERATOR with the `admin` topic. It sees every state change. */
let portalWire: Wire;
/** A device that never paired: its socket stays open through the whole journey. */
let stranger: Wire;

/** The tablet of the lifecycle, and the same tablet after it was paired again. */
const first = tabletOf('Interview tablet 01');
const second = tabletOf('Interview tablet 01');

let codeA: IssuedCode;
let codeB: IssuedCode;
let codeC: IssuedCode;
let codeD: IssuedCode;
/** What the redeem of the expired code answered: every other refused redeem must say the same. */
let genericRefusal: Refusal;
/** The biometric token the investigator enrolled on the tablet before it was revoked. */
let firstBiometricToken = '';
let recordingId = '';
/** The instant on the server clock at which the revoke was committed. */
let revokedAt = 0;
/** The instant on the test's real clock at which the revoke was sent. */
let revokeSentAt = 0;
/** The socket the tablet held when it was revoked. */
let revokedWire: Wire;
/** The session token the tablet held when it was revoked. */
let revokedSessionToken = '';

beforeAll(async () => {
  owner = db.ownerPool();
  rt = await realtimeApp(db, { logLevel: 'trace' });
  bootSeq = (await readHead(owner)).seq;
  bootAt = rt.clock.now();
  dumpAtBoot = await dumpOf(owner);
});

afterAll(() => {
  // A safety net for a run that failed half way: the last block closes everything itself.
  for (const wire of wires) {
    if (wire.socket.ws.readyState !== wire.socket.ws.CLOSED) wire.socket.terminate();
  }
});

describe('SC5: a tablet is paired from the portal, used, revoked, refused and paired again; every step has its audit row', () => {
  it('AC-B-32: before it is paired, the app reads the sign-in status and the service health, is refused the sign-in with 403 DEVICE_NOT_PAIRED with no Origin and with the own origin alike, gets 401 elsewhere, and its socket is told hello and heartbeat only', async () => {
    // The listener of this file: loopback, an ephemeral port, none of the plan's ports (P4).
    expect(rt.app.server.listening).toBe(true);
    expect((rt.app.server.address() as AddressInfo).address).toBe('127.0.0.1');
    expect(rt.wsUrl).toBe(`ws://127.0.0.1:${rt.port}/ws`);
    expect([4400, 4420, 4421, 4422, 4423, 4432, 5432]).not.toContain(rt.port);

    const derivations = rt.derive.mock.calls.length;
    /** The lock state an unpaired caller is told: the web console's (ID-1, decision D18). */
    const signInStatus = async (): Promise<Record<string, unknown>> => {
      const status = await mobileGet(first, STATUS);
      expect(outcome(status)).toEqual([200, null]);
      expectContract('getSignInStatus', status);
      expect(status.headers['set-cookie']).toBeUndefined();
      const { locked, lockedUntil, retryInMs, attemptsRemaining, serverTime } = status.json() as Record<string, unknown>;
      return { locked, lockedUntil, retryInMs, attemptsRemaining, serverTime };
    };
    const notLocked = { locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: 5, serverTime: rt.clock.now() };

    const { rows } = await step('an unpaired caller', async () => {
      // getSignInStatus needs no console identity: it issues nothing.
      expect(await signInStatus()).toEqual(notLocked);

      const health = await mobileGet(first, HEALTH);
      expect(outcome(health)).toEqual([200, null]);
      expectContract('getServiceHealth', health);

      // The sign-in: no console identity without a device credential, whatever the Origin says.
      const credentials = { username: INVESTIGATOR.username, password: DEMO_OPERATOR_PASSWORD };
      const withoutOrigin = await rt.app.inject({ method: 'POST', url: SIGN_IN, headers: MOBILE_REST, payload: credentials });
      const withOwnOrigin = await rt.app.inject({ method: 'POST', url: SIGN_IN, headers: { ...MOBILE_REST, origin: OWN_ORIGIN }, payload: credentials });
      for (const refused of [withoutOrigin, withOwnOrigin]) {
        expect(outcome(refused)).toEqual([403, 'DEVICE_NOT_PAIRED']);
        expectContract('signIn', refused);
        expect(refused.headers['set-cookie']).toBeUndefined();
      }
      // The refused sign-ins were no attempts: nothing was counted toward a lock, no password was verified.
      expect(await signInStatus()).toEqual(notLocked);
      expect(rt.derive.mock.calls.length).toBe(derivations);

      // Everything else needs a principal.
      for (const [operationId, url] of [
        ['getAuthSession', AUTH_SESSION],
        ['getDeviceRegistration', DEVICE],
        ['listPairedDevices', DEVICES],
        ['getPairingCodeStatus', CODE],
        ['getCurrentSession', REC_CURRENT],
      ] as const) {
        const refused = await mobileGet(first, url);
        expect(outcome(refused), operationId).toEqual([401, 'NOT_SIGNED_IN']);
        expectContract(operationId, refused);
      }
    });
    // A 401 and a 403 DEVICE_NOT_PAIRED name no actor and write no row (RB-6); nobody was signed in.
    expect(who(rows)).toEqual([]);
    expect(await countOf('SELECT count(*)::text AS n FROM public.auth_sessions')).toBe(0);

    // Its socket: accepted without a principal, and told nothing but that the Core is alive.
    const opened = await online('a device that never paired', mobileHeaders(first));
    stranger = opened.wire;
    expect([opened.hello.principal, [...opened.hello.topics]]).toEqual(['ANONYMOUS', ['heartbeat']]);
    expect(typesOf(stranger)).toEqual(['hello', 'heartbeat']);
  });

  it('the control: with no paired device connected the Core link is OFFLINE and the pre-check of a session blocks on that check alone, so nothing can be recorded', async () => {
    const { rows: signIns } = await step('the portal signs in', async () => {
      supervisor = await signInOnPortal(SUPERVISOR, 'the supervisor on the portal: session token');
      investigatorOnWeb = await signInOnPortal(INVESTIGATOR, 'the investigator on the web console: session token');
    });
    expect(who(signIns)).toEqual([
      ['AUTH_SUCCESS', SUPERVISOR.id, null],
      ['AUTH_SUCCESS', INVESTIGATOR.id, null],
    ]);

    const opened = await online('the portal', webHeaders(supervisor.cookie));
    portalWire = opened.wire;
    expect([opened.hello.principal, [...opened.hello.topics]]).toEqual(['OPERATOR', ['heartbeat', 'control', 'state', 'meters', 'admin']]);

    expect(rt.engine.slice('tabletLink').state).toBe('OFFLINE');
    const { rows } = await step('the control: a pre-check with the Core link offline', async () => {
      const created = await portalPost(rt.app, REC_SESSION, investigatorOnWeb.cookie, sessionInput(INVESTIGATOR.id, 'LP/2026/1004-0481'));
      expect(outcome(created)).toEqual([201, null]);
      const { sessionId } = created.json() as { sessionId: string };
      expect(outcome(await portalPost(rt.app, onSession(sessionId, 'start'), investigatorOnWeb.cookie))).toEqual([202, null]);
      await rt.drive(PRECHECK_MS);
      const blocked = await portalPost(rt.app, onSession(sessionId, 'start'), investigatorOnWeb.cookie, { acknowledgeWarnings: true });
      expect(outcome(blocked)).toEqual([409, 'PRECHECK_BLOCKED']);
      expectContract('startSession', blocked);
      const session = await currentSession(supervisor);
      expect([session?.state, session?.precheck?.outcome]).toEqual(['PRECHECK', 'BLOCK']);
      // The one check that blocks is the Core link: every other check of the seeded Core passes or warns.
      expect(coreCheckAndBlocks(session)).toEqual({ core: ['BLOCK', 'OFFLINE'], blocking: ['CORE'] });
      expect(outcome(await portalPost(rt.app, onSession(sessionId, 'cancel'), investigatorOnWeb.cookie))).toEqual([204, null]);
    });
    // The engine's own row of the blocked pre-check names the session's creator (decision D28 D-2).
    expect(who(rows)).toEqual([
      ['SESSION_CREATED', INVESTIGATOR.id, null],
      ['PRECHECK_BLOCKED', INVESTIGATOR.id, null],
      ['SESSION_CANCELLED', INVESTIGATOR.id, null],
    ]);
    expect(await currentSession(supervisor)).toBeNull();
  });

  it('AC-B-33: the portal issues a code: six digits, valid 300 s; PAIRING_CODE_ISSUED names the supervisor and the code ID; the table holds a hash and not the code', async () => {
    const { value: issued, rows } = await step('issue code A', () => issueCode(supervisor, 'code A (left to expire)'));
    codeA = issued;
    expect(issued.sixDigits).toBe(true);
    expect([issued.issuedAt, issued.expiresAt - issued.issuedAt, issued.attemptsAllowed]).toEqual([rt.clock.now(), CODE_LIFETIME_MS, CODE_MAX_FAILED_REDEEMS]);

    expect(who(rows)).toEqual([['PAIRING_CODE_ISSUED', SUPERVISOR.id, null]]);
    // The row names the code by its ID; the code is in it in no form.
    expect(Object.values(codeForms(issued.code)).map((count) => count(JSON.stringify(rows[0])))).toEqual([0, 0, 0, 0]);
    expect(rows[0]?.details).toEqual({ codeId: issued.codeId, expiresAt: issued.expiresAt });
    expect(rows[0]?.message).toBe(`Pairing code ${issued.codeId} issued`);

    // The stored row, read as the owner role: every column of it, and the code in none.
    const { rows: storedRows } = await owner.query<{ line: string; columns: string[]; bytes: number; is_hash: boolean }>(
      `SELECT to_jsonb(t)::text AS line,
              (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(to_jsonb(t)) AS key) AS columns,
              octet_length(t.code_hash) AS bytes,
              t.code_hash = $2 AS is_hash
         FROM public.pairing_codes AS t WHERE t.id = $1`,
      [issued.codeId, sha256(`${issued.codeId}:${issued.code}`)],
    );
    const row = storedRows[0];
    if (row === undefined) throw new Error('the issued code has no row');
    const inRow = Object.entries(codeForms(issued.code)).map(([form, count]) => [form, count(row.line)] as const);
    console.info(
      `[w48] pairing_codes row ${issued.codeId}: columns [${row.columns.join(', ')}]; code_hash holds ${row.bytes} bytes, equal to SHA-256(<code ID>:<code>): ${row.is_hash}; ` +
        `the code in the row: ${inRow.map(([form, count]) => `${count} as ${form}`).join(', ')}`,
    );
    // The one column that is about the code is its hash.
    expect(row.columns.filter((column) => /code|digit|secret|plain|qr/i.test(column))).toEqual(['code_hash']);
    expect([row.bytes, row.is_hash]).toEqual([32, true]);
    expect(inRow.filter(([, count]) => count !== 0)).toEqual([]);
    expect(await storedCode(owner, issued.codeId)).toMatchObject({ state: 'ACTIVE', issuedBy: SUPERVISOR.id, failedAttempts: 0, closedAt: null });

    // What the portal can read again: the ID and the attempts left. Never the code.
    expect(await activeCode(supervisor)).toEqual({ codeId: issued.codeId, attemptsRemaining: CODE_MAX_FAILED_REDEEMS });
  });

  it('AC-B-35: one millisecond before 300 s the code is still active; at 300 s on the manual clock the redeem answers the generic 401 INVALID_CODE and PAIRING_CODE_CLOSED says EXPIRED', async () => {
    rt.clock.advance(CODE_LIFETIME_MS - 1);
    expect(await activeCode(supervisor)).toEqual({ codeId: codeA.codeId, attemptsRemaining: CODE_MAX_FAILED_REDEEMS });
    rt.clock.advance(1);
    expect(rt.clock.now()).toBe(codeA.expiresAt);
    expect(await activeCode(supervisor)).toBeNull();

    const { value: refused, rows } = await step('redeem code A at 300 s', () => pair(first, codeA.code, 'tablet 1'));
    expect(outcome(refused)).toEqual([401, 'INVALID_CODE']);
    expectContract('redeemPairingCode', refused);
    genericRefusal = refusalOf(refused);
    expect(genericRefusal.detailKeys).toEqual(['attemptsRemaining']);
    expect(who(rows)).toEqual([
      ['PAIRING_CODE_CLOSED', null, null],
      ['PAIRING_FAILED', null, null],
    ]);
    expect(rows[0]?.details).toEqual({ codeId: codeA.codeId, reason: 'EXPIRED' });
    expect(await storedCode(owner, codeA.codeId)).toMatchObject({ state: 'EXPIRED', closedAt: rt.clock.now(), closedBy: null });
    expect([first.deviceId, first.credential === null]).toEqual([null, true]);
    expect(await listDevices(supervisor)).toEqual([]);
  });

  it('AC-B-36: three wrong codes lock redeeming for 60 s (423; the right code is then not even looked at: PAIRING_LOCKED); the fifth wrong code closes the code as EXHAUSTED', async () => {
    // A fresh count: the window of the failure above has passed.
    rt.clock.advance(REDEEM_WINDOW_MS + SECOND);
    const { value: issued, rows: issuedRows } = await step('issue code B', () => issueCode(supervisor, 'code B (guessed at until it closes)'));
    codeB = issued;
    expect(who(issuedRows)).toEqual([['PAIRING_CODE_ISSUED', SUPERVISOR.id, null]]);

    const lockedAt = rt.clock.now();
    const { value: firstThree, rows: failed } = await step('three wrong codes', async () => {
      const refused: LightMyRequestResponse[] = [];
      for (const n of [1, 2, 3]) refused.push(await redeem(rt.app, guessFor(`wrong guess ${n}`, codeB.code, n)));
      return refused;
    });
    expect(firstThree.map(outcome)).toEqual([
      [401, 'INVALID_CODE'],
      [401, 'INVALID_CODE'],
      [423, 'LOCKED'],
    ]);
    for (const answer of firstThree) expectContract('redeemPairingCode', answer);
    // A wrong code is told what the expired one was told: the answer says nothing about a code (SR-29).
    expect(firstThree.slice(0, 2).map((answer) => refusalOf(answer))).toEqual([genericRefusal, genericRefusal]);
    expect(firstThree.slice(0, 2).map((answer) => detailsOf(answer)['attemptsRemaining'])).toEqual([2, 1]);
    expect(firstThree.slice(2).map((answer) => detailsOf(answer)['lockedUntil'])).toEqual([lockedAt + REDEEM_LOCK_MS]);
    expect(who(failed)).toEqual([
      ['PAIRING_FAILED', null, null],
      ['PAIRING_FAILED', null, null],
      ['PAIRING_FAILED', null, null],
    ]);
    expect(failed.map((row) => row.details)).toEqual([
      { attemptsRemaining: 2, lockedUntil: null },
      { attemptsRemaining: 1, lockedUntil: null },
      { attemptsRemaining: 0, lockedUntil: lockedAt + REDEEM_LOCK_MS },
    ]);

    // During the lock the RIGHT code pairs nothing: it is not compared.
    rt.clock.advance(REDEEM_LOCK_MS - 1);
    const { value: duringLock, rows: locked } = await step('the right code during the lock', () => pair(first, codeB.code, 'tablet 1'));
    expect(outcome(duringLock)).toEqual([423, 'LOCKED']);
    expectContract('redeemPairingCode', duringLock);
    expect(detailsOf(duringLock)).toMatchObject({ lockedUntil: lockedAt + REDEEM_LOCK_MS, retryInMs: 1 });
    expect(who(locked)).toEqual([['PAIRING_LOCKED', null, null]]);
    expect(await storedCode(owner, codeB.codeId)).toMatchObject({ state: 'ACTIVE', failedAttempts: 3 });
    expect(first.deviceId).toBeNull();

    // The lock has ended: two more wrong codes, and the fifth failure of the code closes it.
    rt.clock.advance(1);
    const { value: lastTwo, rows: closing } = await step('the fourth and the fifth wrong code', async () => {
      const refused: LightMyRequestResponse[] = [];
      for (const n of [4, 5]) refused.push(await redeem(rt.app, guessFor(`wrong guess ${n}`, codeB.code, n)));
      return refused;
    });
    expect(lastTwo.map(outcome)).toEqual([
      [401, 'INVALID_CODE'],
      [401, 'INVALID_CODE'],
    ]);
    expect(lastTwo.map((answer) => refusalOf(answer))).toEqual([genericRefusal, genericRefusal]);
    expect(who(closing)).toEqual([
      ['PAIRING_FAILED', null, null],
      ['PAIRING_FAILED', null, null],
      ['PAIRING_CODE_CLOSED', null, null],
    ]);
    expect(closing[2]?.details).toEqual({ codeId: codeB.codeId, reason: 'EXHAUSTED' });
    expect(await storedCode(owner, codeB.codeId)).toMatchObject({ state: 'EXHAUSTED', failedAttempts: CODE_MAX_FAILED_REDEEMS, closedAt: rt.clock.now() });
    expect(await activeCode(supervisor)).toBeNull();
    expect(await listDevices(supervisor)).toEqual([]);
  });

  it('AC-B-34: a new code is redeemed: 201 with a device ID and a credential; PAIRING_SUCCESS names the device; no later answer holds the credential; the same code and the exhausted one never pair again', async () => {
    const { value: issued, rows: issuedRows } = await step('issue code C', () => issueCode(supervisor, 'code C (redeemed by tablet 1)'));
    codeC = issued;
    expect(who(issuedRows)).toEqual([['PAIRING_CODE_ISSUED', SUPERVISOR.id, null]]);

    const { value: paired, rows } = await step('redeem code C', () => pair(first, codeC.code, 'tablet 1'));
    expect(outcome(paired)).toEqual([201, null]);
    expectContract('redeemPairingCode', paired);
    expect(paired.headers['set-cookie']).toBeUndefined();
    const deviceId = first.deviceId ?? '';
    expect([DEVICE_ID_FORM.test(deviceId), CREDENTIAL_FORM.test(first.credential ?? '')]).toEqual([true, true]);
    expect((paired.json() as { pairedAt: number }).pairedAt).toBe(rt.clock.now());

    expect(who(rows)).toEqual([['PAIRING_SUCCESS', null, deviceId]]);
    expect(Object.keys(rows[0]?.details ?? {}).sort()).toEqual(['certificateFingerprint', 'codeId', 'coreDeviceId']);
    expect(rows[0]?.details?.['codeId']).toBe(codeC.codeId);
    expect(await storedCode(owner, codeC.codeId)).toMatchObject({ state: 'REDEEMED', failedAttempts: 0, closedAt: rt.clock.now() });
    expect(await storedDevice(owner, deviceId)).toMatchObject({ state: 'PAIRED', name: first.name, pairedWithCodeId: codeC.codeId, currentHashBytes: 32, hasNextHash: false });
    // The credential is stored as its SHA-256 and as nothing else.
    expect(await countOf('SELECT count(*)::text AS n FROM public.device_credentials WHERE device_id = $1 AND current_hash = $2', [deviceId, sha256(first.credential ?? '')])).toBe(1);

    // The device's own registration and the registry hold no credential.
    const registration = await mobileGet(first, DEVICE);
    expect(outcome(registration)).toEqual([200, null]);
    expectContract('getDeviceRegistration', registration);
    expect(Object.keys(registration.json() as object).sort()).toEqual(['core', 'credentialRotatedAt', 'deviceId', 'name', 'pairedAt', 'state']);
    expect(credentialLeaks(registration.body)).toEqual([]);
    expect((await listDevices(supervisor)).map((device) => [device.id, device.state])).toEqual([[deviceId, 'PAIRED']]);

    // Never again: the redeemed code, and the code that was guessed at until it closed.
    const { value: again, rows: refusedRows } = await step('the used code and the exhausted code again', async () => [
      await redeem(rt.app, codeC.code, { deviceName: 'Another tablet' }),
      await redeem(rt.app, codeB.code, { deviceName: 'Another tablet' }),
    ]);
    expect(again.map(outcome)).toEqual([
      [401, 'INVALID_CODE'],
      [401, 'INVALID_CODE'],
    ]);
    // The answer does not say which it was: used, closed or expired (SR-29).
    expect(again.map((answer) => refusalOf(answer))).toEqual([genericRefusal, genericRefusal]);
    expect(who(refusedRows)).toEqual([
      ['PAIRING_FAILED', null, null],
      ['PAIRING_FAILED', null, null],
    ]);
    expect((await listDevices(supervisor)).map((device) => device.id)).toEqual([deviceId]);
  });

  it('the registry lists the device as PAIRED; ONLINE while its real socket is open and offline after it closes; the first device socket connects the Core link', async () => {
    const deviceId = first.deviceId ?? '';
    expect(await listed(supervisor, deviceId)).toMatchObject({
      name: first.name,
      state: 'PAIRED',
      online: false,
      signedInOperatorId: null,
      pairedWithCodeId: codeC.codeId,
      codeIssuedBy: SUPERVISOR.id,
      revokedAt: null,
    });
    expect(rt.engine.slice('tabletLink').state).toBe('OFFLINE');

    const { value: hello, rows } = await step('tablet 1 opens its socket', () => reconnect(first, 'tablet 1, with its device credential'));
    expect([hello.principal, [...hello.topics]]).toEqual(['DEVICE', ['heartbeat', 'control']]);
    expect(who(rows)).toEqual([['TABLET_LINK_CHANGED', null, CORE_TABLET_SLOT]]);
    expect(rows[0]?.details).toMatchObject({ state: 'CONNECTED' });
    expect(rt.engine.slice('tabletLink').state).toBe('CONNECTED');
    expect((await listed(supervisor, deviceId)).online).toBe(true);

    // The socket closes: offline in the registry at once; the link waits for a reconnect (spec §6.8).
    const { rows: none } = await step('tablet 1 drops its socket and reconnects', async () => {
      await hangUp(first.wire as Wire);
      expect((await listed(supervisor, deviceId)).online).toBe(false);
      await reconnect(first, 'tablet 1, reconnected');
      expect((await listed(supervisor, deviceId)).online).toBe(true);
    });
    expect(who(none)).toEqual([]);
    expect(rt.engine.slice('tabletLink').state).toBe('CONNECTED');
  });

  it('AC-B-37: a password sign-in on the paired device creates a session bound to it: AUTH_SUCCESS and the registry name the device and the operator; the operator turns biometric sign-in on', async () => {
    const deviceId = first.deviceId ?? '';
    const { value: signedIn, rows } = await step('the investigator signs in on tablet 1', () => signInOnTablet(first, INVESTIGATOR, 'tablet 1'));
    expect(outcome(signedIn)).toEqual([200, null]);
    expectContract('signIn', signedIn);
    // A device gets its token in the body and no cookie (ID-1 b; decision D69).
    expect(signedIn.headers['set-cookie']).toBeUndefined();
    expect(SESSION_TOKEN_FORM.test(first.sessionToken ?? '')).toBe(true);
    const { session } = signedIn.json() as { session: { method: string; deviceId: string | null; operator: { id: string } } };
    expect([session.method, session.deviceId, session.operator.id]).toEqual(['PASSWORD', deviceId, INVESTIGATOR.id]);

    expect(who(rows)).toEqual([['AUTH_SUCCESS', INVESTIGATOR.id, deviceId]]);
    expect(rows[0]?.details).toMatchObject({ method: 'PASSWORD' });
    expect(await sessionOfToken(owner, first.sessionToken ?? '')).toMatchObject({ operatorId: INVESTIGATOR.id, deviceId, method: 'PASSWORD', endedAt: null, tokenHashBytes: 32 });
    expect(await listed(supervisor, deviceId)).toMatchObject({ state: 'PAIRED', signedInOperatorId: INVESTIGATOR.id });

    // The app opens its socket again with the session token: an OPERATOR bound to the device.
    const { value: hello, rows: none } = await step('tablet 1 reopens its socket as the investigator', () => reconnect(first, 'tablet 1, with the investigator\'s session'));
    expect([hello.principal, [...hello.topics]]).toEqual(['OPERATOR', ['heartbeat', 'control', 'state', 'meters']]);
    expect(who(none)).toEqual([]);
    expect(rt.engine.slice('tabletLink').state).toBe('CONNECTED');
    expect((await listed(supervisor, deviceId)).online).toBe(true);

    // In that password session: a biometric token bound to this device and this operator (spec §5.6 step 1).
    const { value: enrolled, rows: enrolment } = await step('the investigator enrols a biometric token on tablet 1', () => mobilePost(first, BIOMETRIC, { enabled: true }));
    expect(outcome(enrolled)).toEqual([200, null]);
    expectContract('setBiometricEnrollment', enrolled);
    firstBiometricToken = rememberToken('tablet 1: biometric token', (enrolled.json() as { token: string }).token);
    expect(BIOMETRIC_TOKEN_FORM.test(firstBiometricToken)).toBe(true);
    expect(who(enrolment)).toEqual([['BIOMETRIC_ENROLLMENT_CHANGED', INVESTIGATOR.id, deviceId]]);
    expect(enrolment[0]?.details).toMatchObject({ enabled: true });
  });

  it('the investigator starts a recording from the tablet: the pre-check passes because the Core link is connected by the tablet\'s own socket', async () => {
    const { rows } = await step('a recording is started from tablet 1', async () => {
      const created = await mobilePost(first, REC_SESSION, sessionInput(INVESTIGATOR.id, 'LP/2026/1004-0482'));
      expect(outcome(created)).toEqual([201, null]);
      expectContract('createSession', created);
      recordingId = (created.json() as { sessionId: string }).sessionId;
      expect(outcome(await mobilePost(first, onSession(recordingId, 'start')))).toEqual([202, null]);
      await rt.drive(PRECHECK_MS);
      // The same Core as in the control; the one difference is the tablet's socket.
      expect(coreCheckAndBlocks(await currentSession(supervisor))).toEqual({ core: ['PASS', 'ONLINE'], blocking: [] });
      const started = await mobilePost(first, onSession(recordingId, 'start'), { acknowledgeWarnings: true });
      expect(outcome(started)).toEqual([200, null]);
      expectContract('startSession', started);
      await rt.drive(2 * SECOND);
    });
    expect(who(rows)).toEqual([
      ['SESSION_CREATED', INVESTIGATOR.id, null],
      ['PRECHECK_PASSED', INVESTIGATOR.id, null],
      ['RECORDING_STARTED', INVESTIGATOR.id, null],
    ]);
    const recording = await currentSession(supervisor);
    expect([recording?.id, recording?.state, recording?.elapsedMs]).toEqual([recordingId, 'RECORDING', 2 * SECOND]);
    expect(isOpen(first.wire as Wire)).toBe(true);
  });

  it('AC-B-38: the supervisor revokes the tablet while it records: 200, the device REVOKED; DEVICE_REVOKED names the supervisor, the device and the session it ended', async () => {
    const deviceId = first.deviceId ?? '';
    revokedWire = first.wire as Wire;
    revokedSessionToken = first.sessionToken ?? '';
    await settle(rt, revokedWire.socket, portalWire.socket);

    revokeSentAt = performance.now();
    const { value: revoked, rows } = await step('the supervisor revokes tablet 1', () => portalPost(rt.app, revokeUrl(deviceId), supervisor.cookie, { reason: REVOKE_REASON }));
    revokedAt = rt.clock.now();
    expect(outcome(revoked)).toEqual([200, null]);
    expectContract('revokeDevice', revoked);
    const body = revoked.json() as ListedDevice;
    expect([body.id, body.state, body.revokedBy, body.revokeReason, body.revokedAt]).toEqual([deviceId, 'REVOKED', SUPERVISOR.id, REVOKE_REASON, revokedAt]);

    // No other device holds a socket: the Core link is OFFLINE at once, with its own row.
    expect(who(rows)).toEqual([
      ['DEVICE_REVOKED', SUPERVISOR.id, deviceId],
      ['TABLET_LINK_CHANGED', null, CORE_TABLET_SLOT],
    ]);
    expect(rows.map((row) => row.details)).toEqual([{ reason: REVOKE_REASON, sessionsEnded: 1 }, expect.objectContaining({ state: 'OFFLINE' })]);
    expect(await storedDevice(owner, deviceId)).toMatchObject({ state: 'REVOKED', revokedBy: SUPERVISOR.id, revokeReason: REVOKE_REASON });
  });

  it('AC-B-38: its socket was told device.revoked and closed with 4403 within 1 s; the retired credential and the retired session token open no socket again', async () => {
    const end = await ended(revokedWire);
    const elapsed = end.at - revokeSentAt;
    console.info(`[w48] revoke: the tablet's socket closed with ${end.code}, ${elapsed.toFixed(1)} ms after the request was sent (bound ${CONTROL_DEADLINE_MS} ms; the test's real clock)`);
    expect(end.code).toBe(4403);
    expect(elapsed).toBeLessThan(CONTROL_DEADLINE_MS);
    expect(revokedWire.socket.messages.at(-1)).toEqual({ type: 'device.revoked', v: 1, reason: 'REVOKED' });
    // No session.ended for the session the revoke ended: its socket is the device's.
    expect(typesOf(revokedWire)).not.toContain('session.ended');

    for (const [label, value] of [
      ['the retired session token', revokedSessionToken],
      ['the retired device credential', first.credential ?? ''],
    ] as const) {
      const again = connect(`tablet 1 after the revoke, with ${label}`, deviceHeaders(value));
      const hello = (await again.socket.nextOf('hello')) as unknown as Hello;
      expect([label, hello.principal, hello.reason]).toEqual([label, 'ANONYMOUS', 'DEVICE_REVOKED']);
      expect([label, (await ended(again)).code]).toEqual([label, 4403]);
    }
  });

  it('AC-B-38: its next REST calls answer 403 DEVICE_REVOKED, with the session token and with the device credential alike, each with one ACCESS_DENIED row that names the device', async () => {
    const deviceId = first.deviceId ?? '';
    const sessions = await countOf('SELECT count(*)::text AS n FROM public.auth_sessions');
    const { value: refused, rows } = await step('tablet 1 calls after the revoke', async () => [
      // With the session token the app still holds: a read, and two commands on its own recording.
      await deviceGet(rt.app, REC_CURRENT, revokedSessionToken),
      await devicePost(rt.app, onSession(recordingId, 'markers'), revokedSessionToken, { label: 'After the revoke' }),
      await devicePost(rt.app, onSession(recordingId, 'stop'), revokedSessionToken, { reason: STOP_REASON }),
      // With the device credential: its own registration, a new sign-in, and the biometric token it enrolled.
      await deviceGet(rt.app, DEVICE, first.credential),
      await deviceSignIn(rt.app, first.credential ?? '', INVESTIGATOR.username),
      await devicePost(rt.app, BIOMETRIC_SIGN_IN, first.credential, { token: firstBiometricToken }),
    ]);
    const operations = ['getCurrentSession', 'addSessionMarker', 'stopSession', 'getDeviceRegistration', 'signIn', 'signInWithBiometric'];
    expect(refused.map(outcome)).toEqual(operations.map(() => [403, 'DEVICE_REVOKED']));
    refused.forEach((answer, index) => expectContract(operations[index] ?? '', answer));
    expect(who(rows)).toEqual(operations.map(() => ['ACCESS_DENIED', null, deviceId]));
    expect(rows.map((row) => [row.details?.['operationId'], row.details?.['reason']])).toEqual(operations.map((operationId) => [operationId, 'DEVICE_REVOKED']));
    // Nothing was signed in.
    expect(await countOf('SELECT count(*)::text AS n FROM public.auth_sessions')).toBe(sessions);
    // What a revoked device may still ask (spec §6.6): whether the Core is alive. No row.
    const { value: health, rows: none } = await step('tablet 1 asks for the service health after the revoke', () => deviceGet(rt.app, HEALTH, first.credential));
    expect(outcome(health)).toEqual([200, null]);
    expect(who(none)).toEqual([]);
  });

  it('AC-B-38: its session is ended with the reason DEVICE_REVOKED and its biometric token is revoked; the registry shows the device REVOKED, offline, with nobody signed in', async () => {
    const deviceId = first.deviceId ?? '';
    expect(await sessionOfToken(owner, revokedSessionToken)).toMatchObject({ deviceId, operatorId: INVESTIGATOR.id, endedAt: revokedAt, endReason: 'DEVICE_REVOKED' });
    expect(await countOf('SELECT count(*)::text AS n FROM public.auth_sessions WHERE device_id = $1 AND ended_at IS NULL', [deviceId])).toBe(0);
    // SR-34: in the same transaction as the revoke.
    const { rows: biometric } = await owner.query<{ revoked_at: string | null; revoke_reason: string | null; used_at: string | null }>(
      'SELECT revoked_at, revoke_reason, used_at FROM public.biometric_tokens WHERE token_hash = $1',
      [sha256(firstBiometricToken)],
    );
    expect(biometric.map((row) => [row.revoked_at === null ? null : Number(row.revoked_at), row.revoke_reason, row.used_at])).toEqual([[revokedAt, 'DEVICE_REVOKED', null]]);
    expect(await listed(supervisor, deviceId)).toMatchObject({ state: 'REVOKED', online: false, signedInOperatorId: null, revokedBy: SUPERVISOR.id, revokeReason: REVOKE_REASON, revokedAt });
  });

  it('AC-B-39: the session STAYS IN RECORDING and goes on recording, with the Core link OFFLINE now that the device is gone', async () => {
    const before = await currentSession(supervisor);
    expect([before?.id, before?.state]).toEqual([recordingId, 'RECORDING']);
    expect(rt.engine.slice('tabletLink').state).toBe('OFFLINE');

    const { rows } = await step('the recording goes on without the tablet', () => rt.drive(2 * SECOND));
    expect(who(rows)).toEqual([]);
    const after = await currentSession(supervisor);
    expect([after?.id, after?.state]).toEqual([recordingId, 'RECORDING']);
    expect((after?.elapsedMs ?? 0) - (before?.elapsedMs ?? 0)).toBe(2 * SECOND);
    expect(after?.bytesWritten ?? 0).toBeGreaterThan(before?.bytesWritten ?? 0);
    console.info(
      `[w48] after the revoke: session ${recordingId} ${after?.state}, elapsed ${before?.elapsedMs} ms -> ${after?.elapsedMs} ms, ${before?.bytesWritten} -> ${after?.bytesWritten} bytes; Core link ${rt.engine.slice('tabletLink').state}`,
    );
  });

  it('AC-B-39: ANOTHER operator stops it from the web console with a reason: 202, RECORDING_STOPPED names the supervisor; the recording is sealed with the link still OFFLINE', async () => {
    const { value: stopped, rows } = await step('the supervisor stops the recording from the web console', () =>
      portalPost(rt.app, onSession(recordingId, 'stop'), supervisor.cookie, { reason: STOP_REASON }),
    );
    expect(outcome(stopped)).toEqual([202, null]);
    expectContract('stopSession', stopped);
    expect(who(rows)).toEqual([['RECORDING_STOPPED', SUPERVISOR.id, null]]);
    expect(rows.find((row) => row.type === 'RECORDING_STOPPED')?.sessionId).toBe(recordingId);

    // What the Core does by itself names nobody.
    const { rows: finalised } = await step('the Core finalises and seals the recording', () => rt.drive(FINALIZE_MS));
    expect(who(finalised)).toEqual([['EVIDENCE_SEALED', null, null]]);
    const sealed = await currentSession(supervisor);
    expect([sealed?.id, sealed?.state]).toEqual([recordingId, 'SEALED']);
    expect(rt.engine.slice('tabletLink').state).toBe('OFFLINE');
    console.info(`[w48] the stop by ${SUPERVISOR.id} with the Core link OFFLINE: 202; session ${recordingId} ${sealed?.state} after ${sealed?.elapsedMs} ms of recording`);
  });

  it('AC-B-38: the tablet is paired AGAIN: a new code, a new device ID, a new credential; the old credential and the old biometric token stay refused; the old device stays REVOKED in the registry', async () => {
    const oldDeviceId = first.deviceId ?? '';
    const { value: issued, rows: issuedRows } = await step('issue code D', () => issueCode(supervisor, 'code D (redeemed by tablet 1 after the revoke)'));
    codeD = issued;
    expect(who(issuedRows)).toEqual([['PAIRING_CODE_ISSUED', SUPERVISOR.id, null]]);
    expect(codeD.codeId === codeC.codeId).toBe(false);

    // The reinstalled app holds nothing: it redeems without a credential.
    const { value: paired, rows } = await step('redeem code D', () => pair(second, codeD.code, 'tablet 1, paired again'));
    expect(outcome(paired)).toEqual([201, null]);
    expectContract('redeemPairingCode', paired);
    const newDeviceId = second.deviceId ?? '';
    expect([DEVICE_ID_FORM.test(newDeviceId), newDeviceId === oldDeviceId]).toEqual([true, false]);
    expect([CREDENTIAL_FORM.test(second.credential ?? ''), second.credential === first.credential]).toEqual([true, false]);
    expect(who(rows)).toEqual([['PAIRING_SUCCESS', null, newDeviceId]]);
    expect(rows[0]?.details?.['codeId']).toBe(codeD.codeId);

    // The new credential works; the old one stays refused; so does the biometric token of the revoked device.
    const sessions = await countOf('SELECT count(*)::text AS n FROM public.auth_sessions');
    const {
      value: [withNew, withOld, oldToken, usedCode],
      rows: denied,
    } = await step(
      'the new credential, the old credential, the old biometric token and the used code',
      async () =>
        [
          await mobileGet(second, DEVICE),
          await deviceGet(rt.app, DEVICE, first.credential),
          await devicePost(rt.app, BIOMETRIC_SIGN_IN, second.credential, { token: firstBiometricToken }),
          await redeem(rt.app, codeD.code, { deviceName: 'Another tablet' }),
        ] as const,
    );
    expect([outcome(withNew), outcome(withOld), outcome(oldToken), outcome(usedCode)]).toEqual([
      [200, null],
      [403, 'DEVICE_REVOKED'],
      [401, 'INVALID_CREDENTIALS'],
      [401, 'INVALID_CODE'],
    ]);
    const registration = withNew.json() as { deviceId: string; state: string };
    expect([registration.deviceId, registration.state]).toEqual([newDeviceId, 'PAIRED']);
    expect(refusalOf(usedCode)).toEqual(genericRefusal);
    expect(who(denied)).toEqual([
      ['ACCESS_DENIED', null, oldDeviceId],
      ['AUTH_FAILED', INVESTIGATOR.id, newDeviceId],
      ['PAIRING_FAILED', null, null],
    ]);
    expect(await countOf('SELECT count(*)::text AS n FROM public.auth_sessions')).toBe(sessions);

    // Every code of the journey is closed for good, each in its own way; none is active.
    expect((await Promise.all([codeA, codeB, codeC, codeD].map((code) => storedCode(owner, code.codeId)))).map((code) => code.state)).toEqual(['EXPIRED', 'EXHAUSTED', 'REDEEMED', 'REDEEMED']);
    expect(await activeCode(supervisor)).toBeNull();

    // The registry: every device ever paired, newest first.
    expect((await listDevices(supervisor)).map((device) => [device.id, device.name, device.state, device.pairedWithCodeId])).toEqual([
      [newDeviceId, second.name, 'PAIRED', codeD.codeId],
      [oldDeviceId, first.name, 'REVOKED', codeC.codeId],
    ]);

    // Its socket connects the Core link again.
    const { value: hello, rows: link } = await step('the re-paired tablet opens its socket', () => reconnect(second, 'tablet 1 paired again, with its device credential'));
    expect(hello.principal).toBe('DEVICE');
    expect(who(link)).toEqual([['TABLET_LINK_CHANGED', null, CORE_TABLET_SLOT]]);
    expect(link[0]?.details).toMatchObject({ state: 'CONNECTED' });
    expect((await listed(supervisor, newDeviceId)).online).toBe(true);
  });
});

describe('AC-B-82, SR-74: a used biometric token presented again closes the socket of the BIOMETRIC session; a PASSWORD session of the same operator stays', () => {
  /** The socket of the session that was created with the password, and of the one created with the token. */
  let passwordWire: Wire;
  let biometricWire: Wire;
  let passwordToken = '';
  let biometricSessionToken = '';
  /** The token of the enrolment (used by the sign-in) and the one the sign-in returned. */
  let usedToken = '';
  let nextToken = '';
  let reuseSentAt = 0;
  let reusedAt = 0;

  it('on the paired tablet the investigator signs in with the password, enrols, and signs in with the token: a PASSWORD and a BIOMETRIC session, each with its own real socket', async () => {
    const deviceId = second.deviceId ?? '';
    const { rows } = await step('a password session, an enrolment and a biometric sign-in on the tablet', async () => {
      const signedIn = await signInOnTablet(second, INVESTIGATOR, 'tablet 1 paired again, by password');
      expect(outcome(signedIn)).toEqual([200, null]);
      passwordToken = second.sessionToken ?? '';

      const enrolled = await mobilePost(second, BIOMETRIC, { enabled: true });
      expect(outcome(enrolled)).toEqual([200, null]);
      expectContract('setBiometricEnrollment', enrolled);
      usedToken = rememberToken('tablet 1 paired again: the biometric token of the enrolment', (enrolled.json() as { token: string }).token);
      expect(BIOMETRIC_TOKEN_FORM.test(usedToken)).toBe(true);

      // The app sends the token with the DEVICE CREDENTIAL as its bearer value (spec §5.6 step 4).
      const biometric = await devicePost(rt.app, BIOMETRIC_SIGN_IN, second.credential, { token: usedToken });
      expect(outcome(biometric)).toEqual([200, null]);
      expectContract('signInWithBiometric', biometric);
      const body = biometric.json() as { sessionToken: string; biometricToken: string; session: { method: string; deviceId: string | null; operator: { id: string } } };
      biometricSessionToken = rememberToken('tablet 1 paired again, by biometric token: session token', body.sessionToken);
      nextToken = rememberToken('tablet 1 paired again: the rotated biometric token', body.biometricToken);
      expect([body.session.method, body.session.deviceId, body.session.operator.id]).toEqual(['BIOMETRIC', deviceId, INVESTIGATOR.id]);
      expect([BIOMETRIC_TOKEN_FORM.test(nextToken), nextToken === usedToken]).toEqual([true, false]);
    });
    expect(who(rows)).toEqual([
      ['AUTH_SUCCESS', INVESTIGATOR.id, deviceId],
      ['BIOMETRIC_ENROLLMENT_CHANGED', INVESTIGATOR.id, deviceId],
      ['AUTH_SUCCESS', INVESTIGATOR.id, deviceId],
    ]);
    expect(rows.map((row) => row.details?.['method'] ?? row.details?.['enabled'])).toEqual(['PASSWORD', true, 'BIOMETRIC']);

    // Two sessions of one operator on one device, each with its socket.
    const password = await online('the PASSWORD session on the tablet', deviceHeaders(passwordToken));
    const biometric = await online('the BIOMETRIC session on the tablet', deviceHeaders(biometricSessionToken));
    passwordWire = password.wire;
    biometricWire = biometric.wire;
    expect([password.hello.principal, biometric.hello.principal]).toEqual(['OPERATOR', 'OPERATOR']);
    expect([await sessionOfToken(owner, passwordToken), await sessionOfToken(owner, biometricSessionToken)].map((session) => [session.method, session.deviceId, session.endedAt])).toEqual([
      ['PASSWORD', deviceId, null],
      ['BIOMETRIC', deviceId, null],
    ]);
    await quiet();
    await settle(rt, passwordWire.socket, biometricWire.socket);
  });

  it('the USED token presented again answers the generic 401; AUTH_FAILED says TOKEN_REUSE and that one session was ended', async () => {
    const deviceId = second.deviceId ?? '';
    reuseSentAt = performance.now();
    const { value: reused, rows } = await step('the used biometric token is presented again', () => devicePost(rt.app, BIOMETRIC_SIGN_IN, second.credential, { token: usedToken }));
    reusedAt = rt.clock.now();
    expect(outcome(reused)).toEqual([401, 'INVALID_CREDENTIALS']);
    expectContract('signInWithBiometric', reused);
    expect(who(rows)).toEqual([['AUTH_FAILED', INVESTIGATOR.id, deviceId]]);
    expect(rows[0]?.details).toMatchObject({ method: 'BIOMETRIC', reason: 'TOKEN_REUSE', sessionsEnded: 1 });
  });

  it('the socket of the BIOMETRIC session was told session.ended with TOKEN_REUSE and closed with 4401 within 1 s', async () => {
    const end = await ended(biometricWire);
    const elapsed = end.at - reuseSentAt;
    console.info(
      `[w48] token reuse: the BIOMETRIC session's socket closed with ${end.code}, ${elapsed.toFixed(1)} ms after the request was sent (bound ${CONTROL_DEADLINE_MS} ms; the test's real clock)`,
    );
    expect(end.code).toBe(4401);
    expect(elapsed).toBeLessThan(CONTROL_DEADLINE_MS);
    expect(biometricWire.socket.messages.at(-1)).toEqual({ type: 'session.ended', v: 1, reason: 'TOKEN_REUSE' });
  });

  it('that session is ended with the reason TOKEN_REUSE and its token answers 401; the family is revoked: the rotated token signs nobody in', async () => {
    const deviceId = second.deviceId ?? '';
    expect(await sessionOfToken(owner, biometricSessionToken)).toMatchObject({ method: 'BIOMETRIC', deviceId, endedAt: reusedAt, endReason: 'TOKEN_REUSE' });
    expect(outcome(await deviceGet(rt.app, AUTH_SESSION, biometricSessionToken))).toEqual([401, 'NOT_SIGNED_IN']);
    const again = connect('the ended BIOMETRIC session, again', deviceHeaders(biometricSessionToken));
    expect(((await again.socket.nextOf('hello')) as unknown as Hello).principal).toBe('ANONYMOUS');
    expect((await ended(again)).code).toBe(4401);

    const sessions = await countOf('SELECT count(*)::text AS n FROM public.auth_sessions');
    const { value: refused, rows } = await step('the rotated token of the revoked family', () => devicePost(rt.app, BIOMETRIC_SIGN_IN, second.credential, { token: nextToken }));
    expect(outcome(refused)).toEqual([401, 'INVALID_CREDENTIALS']);
    expect(who(rows)).toEqual([['AUTH_FAILED', INVESTIGATOR.id, deviceId]]);
    expect(rows[0]?.details).toMatchObject({ method: 'BIOMETRIC', reason: 'TOKEN_REVOKED' });
    expect(await countOf('SELECT count(*)::text AS n FROM public.auth_sessions')).toBe(sessions);
    expect(await countOf('SELECT count(*)::text AS n FROM public.biometric_tokens WHERE device_id = $1 AND revoked_at IS NULL', [deviceId])).toBe(0);
  });

  it('the PASSWORD session of the same operator on the same device stays open, and so does its socket', async () => {
    const deviceId = second.deviceId ?? '';
    await settle(rt, passwordWire.socket);
    expect([isOpen(passwordWire), passwordWire.ended]).toEqual([true, null]);
    expect(typesOf(passwordWire)).not.toContain('session.ended');
    expect(await sessionOfToken(owner, passwordToken)).toMatchObject({ method: 'PASSWORD', deviceId, endedAt: null, endReason: null });
    const own = await deviceGet(rt.app, AUTH_SESSION, passwordToken);
    expect(outcome(own)).toEqual([200, null]);
    expect((own.json() as { method: string }).method).toBe('PASSWORD');
    // The device's own socket was not touched either.
    expect(isOpen(second.wire as Wire)).toBe(true);
  });
});

describe('the audit trail of the whole journey', () => {
  it('is exactly this sequence of types with their actors and devices; every row belongs to a step of this file; the chain verifies', async () => {
    await quiet();
    const trail = await readTrail(owner);
    const journey = trail.filter((row) => row.seq > bootSeq);
    // No row was written outside a step: by a socket that opened or closed, or by a read.
    expect(journey.map((row) => row.seq)).toEqual(ledger.map((entry) => entry.row.seq));

    const shown = ledger.filter((entry) => !INTEGRITY_STREAM.includes(entry.row.type));
    console.info(
      `[w48] the audit sequence of the journey: ${journey.length} rows after the boot (seq ${bootSeq + 1} to ${trail.at(-1)?.seq}), ${journey.length - shown.length} of them arrivals of the integrity stream (not listed)`,
    );
    console.info('[w48]   seq  at          type                          actor    device    step');
    for (const { step: name, row } of shown) {
      console.info(`[w48]   ${String(row.seq).padStart(3)}  ${rel(row.at).padEnd(10)}  ${row.type.padEnd(28)}  ${(row.actorId ?? '-').padEnd(7)}  ${(row.deviceId ?? '-').padEnd(8)}  ${name}`);
    }

    const S = SUPERVISOR.id;
    const I = INVESTIGATOR.id;
    const one = first.deviceId;
    const two = second.deviceId;
    const expected: Named[] = [
      // The portal signs in; the control.
      ['AUTH_SUCCESS', S, null],
      ['AUTH_SUCCESS', I, null],
      ['SESSION_CREATED', I, null],
      ['PRECHECK_BLOCKED', I, null],
      ['SESSION_CANCELLED', I, null],
      // Code A: issued, left to expire, refused.
      ['PAIRING_CODE_ISSUED', S, null],
      ['PAIRING_CODE_CLOSED', null, null],
      ['PAIRING_FAILED', null, null],
      // Code B: issued, three failures, the lock, two failures, closed.
      ['PAIRING_CODE_ISSUED', S, null],
      ['PAIRING_FAILED', null, null],
      ['PAIRING_FAILED', null, null],
      ['PAIRING_FAILED', null, null],
      ['PAIRING_LOCKED', null, null],
      ['PAIRING_FAILED', null, null],
      ['PAIRING_FAILED', null, null],
      ['PAIRING_CODE_CLOSED', null, null],
      // Code C: issued, redeemed; the used and the exhausted code again.
      ['PAIRING_CODE_ISSUED', S, null],
      ['PAIRING_SUCCESS', null, one],
      ['PAIRING_FAILED', null, null],
      ['PAIRING_FAILED', null, null],
      // The tablet connects, the investigator signs in and enrols, and records.
      ['TABLET_LINK_CHANGED', null, CORE_TABLET_SLOT],
      ['AUTH_SUCCESS', I, one],
      ['BIOMETRIC_ENROLLMENT_CHANGED', I, one],
      ['SESSION_CREATED', I, null],
      ['PRECHECK_PASSED', I, null],
      ['RECORDING_STARTED', I, null],
      // The revoke, and the six refused calls of the tablet.
      ['DEVICE_REVOKED', S, one],
      ['TABLET_LINK_CHANGED', null, CORE_TABLET_SLOT],
      ['ACCESS_DENIED', null, one],
      ['ACCESS_DENIED', null, one],
      ['ACCESS_DENIED', null, one],
      ['ACCESS_DENIED', null, one],
      ['ACCESS_DENIED', null, one],
      ['ACCESS_DENIED', null, one],
      // The supervisor stops the recording; the Core seals it.
      ['RECORDING_STOPPED', S, null],
      ['EVIDENCE_SEALED', null, null],
      // Code D: issued, redeemed; the old credential, the old biometric token and the used code; the link again.
      ['PAIRING_CODE_ISSUED', S, null],
      ['PAIRING_SUCCESS', null, two],
      ['ACCESS_DENIED', null, one],
      ['AUTH_FAILED', I, two],
      ['PAIRING_FAILED', null, null],
      ['TABLET_LINK_CHANGED', null, CORE_TABLET_SLOT],
      // The biometric token on the re-paired tablet: sign-in, enrolment, sign-in, reuse, the revoked family.
      ['AUTH_SUCCESS', I, two],
      ['BIOMETRIC_ENROLLMENT_CHANGED', I, two],
      ['AUTH_SUCCESS', I, two],
      ['AUTH_FAILED', I, two],
      ['AUTH_FAILED', I, two],
    ];
    expect(who(journey)).toEqual(expected);

    // Every row is stamped with the server clock, never before its predecessor.
    expect(journey.every((row, index) => index === 0 || row.at >= (journey[index - 1]?.at ?? 0))).toBe(true);
    expect(linkProblems(trail)).toEqual([]);
    expect(verifyTrail(trail, await readHead(owner))).toMatchObject({ ok: true });
  });
});

describe('the end of the run: no socket and no listener of this file remains', () => {
  it('the socket of the device that never paired received hello and heartbeat only, whatever happened on the server; the portal beside it was told of every change', async () => {
    await settle(rt, stranger.socket, portalWire.socket);
    expect(isOpen(stranger)).toBe(true);
    expect(typesOf(stranger)).toEqual(['hello', 'heartbeat']);
    expect(typesOf(portalWire).sort()).toEqual(['admin.changed', 'delta', 'heartbeat', 'hello', 'snapshot']);
    const resources = new Set(portalWire.socket.messages.flatMap((message) => (message.type === 'admin.changed' ? [message.resource] : [])));
    expect([...resources].sort()).toEqual(['DEVICES', 'PAIRING_CODE']);
    console.info(
      `[w48] sockets: ${wires.length} opened by the test; the unpaired device received ${stranger.frames.length} frames of types [${typesOf(stranger).join(', ')}]; ` +
        `the portal ${portalWire.frames.length} frames of types [${typesOf(portalWire).join(', ')}]`,
    );
  });

  it('every socket is closed, every frame was a message of the contract, and nothing listens on the port any more', async () => {
    const port = rt.port;
    for (const wire of wires) {
      if (isOpen(wire)) wire.socket.ws.close(1000);
    }
    await Promise.all(wires.map((wire) => ended(wire)));
    await untilSockets(rt, 0);
    expect(wires.filter((wire) => wire.socket.ws.readyState !== wire.socket.ws.CLOSED).map((wire) => wire.label)).toEqual([]);
    expect(wires.flatMap((wire) => wire.socket.invalid.map((problem) => `${wire.label}: ${problem}`))).toEqual([]);

    await rt.app.close();
    expect(rt.app.server.listening).toBe(false);
    const refusal = await new Promise<string>((resolve) => {
      const probe = connectTcp({ host: '127.0.0.1', port });
      probe.once('connect', () => {
        probe.destroy();
        resolve('connected');
      });
      probe.once('error', (error: NodeJS.ErrnoException) => resolve(error.code ?? 'error'));
    });
    expect(refusal).toBe('ECONNREFUSED');
    console.info(`[w48] end: ${wires.length} sockets opened, ${wires.filter((wire) => wire.ended !== null).length} closed, 0 open; the listener on 127.0.0.1:${port} is closed (a connection is refused: ${refusal})`);
  });
});

describe('AC-B-41, AC-B-28: no secret is left behind', () => {
  /** What the journey issued, in numbers. */
  const inventory = (): string => {
    const kinds = (prefix: string): number => [...tokens.values()].filter((value) => value.startsWith(prefix)).length;
    return `${codes.size} pairing codes and ${guesses.size} guesses, ${kinds('dvc_')} device credentials, ${kinds('ses_')} session tokens, ${kinds('bio_')} biometric tokens, the demo password`;
  };
  const refusals = (): string[] => answers.filter((answer) => answer.status >= 400).map((answer) => answer.body);

  it('the test holds what it must look for: four codes, five guesses, two device credentials, five session tokens and three biometric tokens, all different', () => {
    expect([codes.size, guesses.size]).toEqual([4, 5]);
    const values = [...tokens.values()];
    expect(new Set(values).size).toBe(values.length);
    expect(values.map((value) => value.slice(0, 4)).sort()).toEqual(['bio_', 'bio_', 'bio_', 'dvc_', 'dvc_', 'ses_', 'ses_', 'ses_', 'ses_', 'ses_']);
    expect(values.every((value) => /^(?:dvc|ses|bio)_[A-Za-z0-9_-]{43}$/.test(value))).toBe(true);
    expect(new Set([...codes.values()].map(({ codeId }) => codeId)).size).toBe(4);
  });

  it('each secret was handed out in exactly one answer of the journey: a code by its issue, a credential by its redeem, a token by its sign-in or enrolment; a web session token in none (the cookie); a guess in none', () => {
    const bodies = answers.map((answer) => answer.body);
    const holding = (value: string): number => bodies.filter((body) => body.includes(value)).length;
    const perToken = [...tokens].map(([label, value]) => [label, holding(value)] as const);
    const onTheWeb = (label: string): boolean => label.includes('on the portal') || label.includes('on the web console');
    console.info(
      `[w48] returned once: ${bodies.length} answers of the journey; holding a secret: ${perToken.filter(([, count]) => count === 1).length} of ${perToken.length} tokens in exactly one answer, ` +
        `${perToken.filter(([, count]) => count === 0).length} in none (the web sessions: cookie only); ${[...codes.values()].filter(({ code }) => bodies.filter((body) => codeAsText(body, code) > 0).length === 1).length} of ${codes.size} codes in exactly one`,
    );
    expect(perToken.filter(([label, count]) => count !== (onTheWeb(label) ? 0 : 1)).map(([label, count]) => `${label}: in ${count} answers`)).toEqual([]);
    expect([...codes].map(([label, { code }]) => [label, bodies.filter((body) => codeAsText(body, code) > 0).length])).toEqual([...codes.keys()].map((label) => [label, 1]));
    expect([...guesses].map(([label, guess]) => [label, bodies.filter((body) => codeAsText(body, guess) > 0).length])).toEqual([...guesses.keys()].map((label) => [label, 0]));
  });

  it('a dump of the clone, every table as the owner role: none of the codes, credentials and tokens in any form; each is there only as the hash it is stored as', async () => {
    const dump = await dumpOf(owner);
    expect(dump.tables.length).toBeGreaterThanOrEqual(30);
    expect(dump.rows).toBeGreaterThan(dumpAtBoot.rows);

    const found = leaksOfDump(dump, dumpAtBoot);
    const text = textOf(dump);
    // Not vacuous: the dump holds the hash columns, and each secret is there as its SHA-256, once.
    const hashOf = (value: string): number => occurrences(text, `\\\\x${sha256(value).toString('hex')}`);
    const codeHashes = [...codes.values()].map(({ code, codeId }) => hashOf(`${codeId}:${code}`));
    const tokenHashes = [...tokens].map(([label, value]) => [label, hashOf(value)] as const);
    const bareNumbers = [...codes.values()].reduce((sum, { code }) => sum + matches(text, bareNumber(code)), 0);
    console.info(
      `[w48] dump of ${db.name}: ${dump.tables.length} tables, ${dump.rows} rows, ${dump.characters} characters (at boot: ${dumpAtBoot.rows} rows); searched: ${inventory()}; ` +
        `a code in ${FORMS_OF_A_CODE} forms, a credential or token in ${FORMS_OF_A_TOKEN} forms: ${found.length} found; ` +
        `stored hashes present once: codes ${codeHashes.filter((count) => count === 1).length} of ${codeHashes.length}, credentials and tokens ${tokenHashes.filter(([, count]) => count === 1).length} of ${tokenHashes.length}; ` +
        `six digits of a code as a bare number (not judged): ${bareNumbers}`,
    );
    expect(found).toEqual([]);
    expect(text).not.toMatch(/DEMS-PAIR/);
    expect(credentialLeaks(text)).toEqual([]);
    expect(codeHashes).toEqual([1, 1, 1, 1]);
    expect(tokenHashes.filter(([, count]) => count !== 1)).toEqual([]);
    // A guess was never stored in any form: not even as the hash a code would have.
    for (const guess of guesses.values()) {
      for (const { codeId } of codes.values()) expect(occurrences(text, sha256(`${codeId}:${guess}`).toString('hex'))).toBe(0);
    }
  });

  it('the scan is not blind: a code, half a credential and a token as hex, planted into columns of two tables as the owner role, are found, each in its form and its table; a token in a line of text is found in four forms', async () => {
    const code = codes.get('code C (redeemed by tablet 1)')?.code ?? '';
    const credential = tokens.get('tablet 1: device credential') ?? '';
    const token = tokens.get('tablet 1 paired again: the rotated biometric token') ?? '';
    const client = await owner.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE public.paired_devices SET name = $2 WHERE id = $1', [first.deviceId, `Tablet ${code}`]);
      await client.query('UPDATE public.paired_devices SET revoke_reason = $2 WHERE id = $1', [first.deviceId, `Lost; ${credential.slice(Math.floor(credential.length / 2))}`]);
      await client.query('UPDATE public.operators SET name = $2 WHERE id = $1', [INVESTIGATOR.id, Buffer.from(token, 'utf8').toString('hex')]);
      const found = leaksOfDump(await dumpOf(client), dumpAtBoot);
      console.info(`[w48] positive control (rolled back): 3 values planted as the owner role; the scan reports ${found.length} finding(s): ${found.join('; ')}`);
      expect(found).toEqual([
        'tablet 1 paired again: the rotated biometric token as hex in table operators',
        'code C (redeemed by tablet 1) as digits as text in table paired_devices',
        'tablet 1: device credential as last half in table paired_devices',
      ]);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    expect(leaksOfDump(await dumpOf(owner), dumpAtBoot)).toEqual([]);

    const line = `{"level":30,"authorization":"Bearer ${tokens.get('tablet 1: session token') ?? ''}","msg":"a line that must never be written"}`;
    expect(leaksIn('a line', line)).toEqual(['raw', 'first half', 'last half', 'without its prefix'].map((form) => `tablet 1: session token as ${form} in a line`));
    expect(credentialLeaks(line).length).toBeGreaterThan(0);
  });

  it('the audit rows and the events of the journey, and every realtime frame every socket received', async () => {
    const { rows: audit } = await owner.query<{ line: string }>('SELECT to_jsonb(t)::text AS line FROM public.audit_log AS t WHERE t.seq > $1', [bootSeq]);
    const { rows: events } = await owner.query<{ line: string }>('SELECT to_jsonb(t)::text AS line FROM public.events AS t WHERE t.at >= $1', [bootAt]);
    const rowsText = [...audit, ...events].map((row) => row.line).join('\n');
    const frames = wires.flatMap((wire) => wire.frames);
    const framesText = frames.join('\n');
    const found = [...leaksIn('the audit rows and events', rowsText), ...leaksIn('the realtime frames', framesText)];
    console.info(
      `[w48] AC-B-41: ${audit.length} audit rows and ${events.length} events of the journey, ${frames.length} realtime frames (${framesText.length} characters) on ${wires.length} sockets: ${found.length} codes, credentials or tokens found`,
    );
    expect(audit.length).toBeGreaterThanOrEqual(47);
    expect(frames.length).toBeGreaterThanOrEqual(100);
    expect(found).toEqual([]);
    for (const text of [rowsText, framesText]) {
      expect(credentialLeaks(text)).toEqual([]);
      expect(text).not.toMatch(/DEMS-PAIR/);
      for (const value of tokens.values()) expect(occurrences(text, sha256(value).toString('hex'))).toBe(0);
    }
  });

  it('the answers of every refusal: no code is echoed and no credential', () => {
    const text = refusals().join('\n');
    const found = leaksIn('the refusals', text);
    console.info(`[w48] AC-B-41: ${refusals().length} answers of a refusal: ${found.length} codes, credentials or tokens found`);
    expect(refusals().length).toBeGreaterThanOrEqual(25);
    expect(found).toEqual([]);
    expect(credentialLeaks(text)).toEqual([]);
  });

  it('the log of the server, captured at level trace from the boot to the close: none of them, no hash of one, and no line at level error', () => {
    const text = rt.log.text();
    const lines = rt.log.lines();
    const found = leaksIn('the log', text);
    const requests = lines.filter((line) => line['msg'] === 'request completed');
    const byRoute: Record<string, Record<string, number>> = {};
    for (const line of requests) {
      const route = `${String(line['method'])} ${String(line['route'])}`;
      byRoute[route] = { ...byRoute[route], [String(line['status'])]: (byRoute[route]?.[String(line['status'])] ?? 0) + 1 };
    }
    console.info(
      `[w48] AC-B-41 log capture: ${text.length} characters, ${lines.length} lines, ${requests.length} request lines, levels ${JSON.stringify(countBy(lines.map((line) => String(line['level']))))}; searched: ${inventory()}: ${found.length} found; hashes of them: 0`,
    );
    for (const route of Object.keys(byRoute).sort()) console.info(`[w48]   ${route.padEnd(48)} ${JSON.stringify(byRoute[route])}`);
    expect(found).toEqual([]);
    expect(credentialLeaks(text)).toEqual([]);
    expect(text).not.toMatch(/DEMS-PAIR/);
    for (const { code, codeId } of codes.values()) expect(occurrences(text, sha256(`${codeId}:${code}`).toString('hex'))).toBe(0);
    for (const value of tokens.values()) expect(occurrences(text, sha256(value).toString('hex'))).toBe(0);
    // Not vacuous: the journey is in it, request by request, from the boot to the stop of the server.
    expect(requests.length).toBe(answers.length);
    expect(byRoute['POST /api/v1/pairing/redeem']).toEqual({ '201': 2, '401': 8, '423': 2 });
    expect(byRoute['POST /api/v1/pairing/code']).toEqual({ '201': 4 });
    expect(byRoute['POST /api/v1/auth/biometric/sign-in']).toEqual({ '200': 1, '401': 3, '403': 1 });
    for (const message of ['engine started', 'socket opened', 'socket closed', 'engine stopped']) expect(lines.some((line) => line['msg'] === message), message).toBe(true);
    expect(lines.filter((line) => Number(line['level']) >= 50)).toEqual([]);
  });
});
