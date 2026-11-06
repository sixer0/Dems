/**
 * Test support of the STT configuration module (blueprint row 113; not a test file).
 *
 * In-process, no PostgreSQL and no listener: the real app factory with EVERY unit, the real
 * serial pipeline and the real audit writer, on a stand-in pool. The neutral stand-in
 * (`test/support/core.ts`) answers a unit's own statements, the chain lock and the audit insert;
 * this file puts the one row of `stt_config` and the session fact in front of it, with the
 * table's own rules: the eleven readable columns, the compare-and-set on the revision, the
 * loopback CHECK and the three-way credential CHECK, and a transaction that is applied at COMMIT
 * and dropped at ROLLBACK. What the real database says to the same statements is the subject of
 * `stt-config.db.test.ts`.
 *
 * Stage 4 is a stand-in that says who the caller is; stage 6 is the real permission guard, so a
 * refusal is the server's own and writes its own `ACCESS_DENIED` row.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ROLE_PERMISSIONS, createManualClock, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Pool, QueryConfig } from 'pg';
import { buildApp } from '../../../app';
import type { Principal } from '../../../plugins/authenticate';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { CLOCK_START, standInDatabase, type StandInDatabase } from '../../../../test/support/core';
import { sttConfigControl, type SealedSttCredential, type SttConfigControl, type SttCredentialSealer } from '../index';
import { LOCK_STT_CONFIG, READ_STT_CONFIG, UPDATE_STT_CONFIG, UPDATE_STT_CONFIG_WITH_CREDENTIAL } from '../statements';

export const STT_PATH = '/api/v1/transcription/config';
export const STT_TEST_PATH = `${STT_PATH}/test`;
/** The web console origin: a POST of a cookie session needs it (stage 3). */
export const WEB_ORIGIN = 'http://127.0.0.1:5173';

/** The row of `stt_config` as the table holds it, the three credential columns included. */
export interface SttTableRow {
  enabled: boolean;
  backend: string;
  endpoint: string | null;
  model: string;
  language: string;
  diarization: boolean;
  credential_kind: string | null;
  credential_ref: string | null;
  secret_ciphertext: Buffer | null;
  nonce: Buffer | null;
  revision: number;
  updated_by: string | null;
  updated_at: number;
}

/** The seeded row (row 114; Q-STT-CFG item 11): enabled, `cpu-local`, no endpoint, no credential. */
export const SEEDED_ROW: SttTableRow = {
  enabled: true,
  backend: 'cpu-local',
  endpoint: null,
  model: 'ggml-large-v3-turbo',
  language: 'id',
  diarization: true,
  credential_kind: null,
  credential_ref: null,
  secret_ciphertext: null,
  nonce: null,
  revision: 1,
  updated_by: null,
  updated_at: CLOCK_START - 86_400_000,
};

export interface SttDatabase {
  readonly pool: Pool;
  readonly standIn: StandInDatabase;
  /** The committed row, or null for a table the seed never wrote. */
  row(): SttTableRow | null;
  /** Opens or closes "a session": the instant `active_session.created_at` holds, or null. */
  setSessionOpenedAt(at: number | null): void;
  /**
   * Runs `change` once, right after the next read of the row through the POOL has answered: another
   * writer that commits between a preview read and the lock of a unit. It gets the committed row to change.
   */
  afterNextPoolRead(change: (row: SttTableRow) => void): void;
  /** The values of every UPDATE of `stt_config` that reached a connection, in order. */
  readonly updates: Array<{ text: string; values: readonly unknown[] }>;
  /** The values of every audit insert and every event insert that reached a connection. */
  auditInserts(): ReadonlyArray<readonly unknown[]>;
  eventInserts(): ReadonlyArray<readonly unknown[]>;
}

const LOOPBACK_CHECK = /^http:\/\/(127\.0\.0\.1|localhost)(:[0-9]{1,5})?(\/.*)?$/;
const refusedBy = (constraint: string): Error => Object.assign(new Error(`new row violates check constraint "${constraint}"`), { code: '23514', constraint });

/** The CHECKs of dbc-3 §B.13 the module can reach, by their names. */
function checkRow(row: SttTableRow): void {
  if (row.backend !== 'omlx-server' && row.backend !== 'cpu-local') throw refusedBy('stt_config_backend_check');
  if (row.backend === 'omlx-server' && row.endpoint === null) throw refusedBy('stt_config_endpoint_required_check');
  if (row.endpoint !== null && !LOOPBACK_CHECK.test(row.endpoint)) throw refusedBy('stt_config_endpoint_loopback_check');
  if (row.language !== 'id') throw refusedBy('stt_config_language_check');
  if (row.secret_ciphertext !== null && row.secret_ciphertext.byteLength < 17) throw refusedBy('stt_config_secret_check');
  if (row.nonce !== null && row.nonce.byteLength !== 12) throw refusedBy('stt_config_nonce_check');
  const none = row.credential_kind === null && row.credential_ref === null && row.secret_ciphertext === null && row.nonce === null;
  const reference = row.credential_kind === 'REFERENCE' && row.credential_ref !== null && row.secret_ciphertext === null && row.nonce === null;
  const encrypted = row.credential_kind === 'ENCRYPTED' && row.credential_ref !== null && row.secret_ciphertext !== null && row.nonce !== null;
  if (!none && !reference && !encrypted) throw refusedBy('stt_config_credential_check');
}

/** What a SELECT of the readable columns answers: never a credential column, bigints as text (the driver's form). */
function readable(row: SttTableRow, sessionOpenedAt: number | null): Record<string, unknown> {
  return {
    enabled: row.enabled,
    backend: row.backend,
    endpoint: row.endpoint,
    model: row.model,
    language: row.language,
    diarization: row.diarization,
    credential_kind: row.credential_kind,
    revision: String(row.revision),
    updated_by: row.updated_by,
    updated_at: String(row.updated_at),
    session_created_at: sessionOpenedAt === null ? null : String(sessionOpenedAt),
  };
}

export function sttDatabase(initial: SttTableRow | null = SEEDED_ROW): SttDatabase {
  const standIn = standInDatabase();
  let committed: SttTableRow | null = initial === null ? null : { ...initial };
  let sessionOpenedAt: number | null = null;
  let afterPoolRead: ((row: SttTableRow) => void) | null = null;
  const updates: Array<{ text: string; values: readonly unknown[] }> = [];
  const answer = (rows: unknown[], command = 'SELECT') => ({ rows, rowCount: rows.length, command, fields: [], oid: 0 });

  const pool = {
    async connect() {
      const client = await (standIn.pool.connect as () => Promise<{ query(query: string | QueryConfig, values?: readonly unknown[]): Promise<unknown> }>)();
      let pending: SttTableRow | null | undefined;
      return new Proxy(client, {
        get(target, property) {
          if (property !== 'query') {
            const member = Reflect.get(target, property) as unknown;
            return typeof member === 'function' ? (member as (...inner: unknown[]) => unknown).bind(target) : member;
          }
          return async (query: string | QueryConfig, values: readonly unknown[] = []) => {
            const text = typeof query === 'string' ? query : query.text;
            const bound = typeof query === 'string' ? values : ((query.values as readonly unknown[] | undefined) ?? values);
            const current = pending === undefined ? committed : pending;
            if (text === LOCK_STT_CONFIG || text === READ_STT_CONFIG) return answer(current === null ? [] : [readable(current, sessionOpenedAt)]);
            if (text === UPDATE_STT_CONFIG || text === UPDATE_STT_CONFIG_WITH_CREDENTIAL) {
              updates.push({ text, values: [...bound] });
              if (current === null || current.revision !== Number(bound[8])) return answer([], 'UPDATE');
              const next: SttTableRow = {
                ...current,
                enabled: bound[0] as boolean,
                backend: bound[1] as string,
                endpoint: bound[2] as string | null,
                model: bound[3] as string,
                language: bound[4] as string,
                diarization: bound[5] as boolean,
                revision: current.revision + 1,
                updated_by: bound[6] as string,
                updated_at: Number(bound[7]),
                ...(text === UPDATE_STT_CONFIG_WITH_CREDENTIAL
                  ? { credential_kind: bound[9] as string | null, credential_ref: bound[10] as string | null, secret_ciphertext: bound[11] as Buffer | null, nonce: bound[12] as Buffer | null }
                  : {}),
              };
              checkRow(next);
              pending = next;
              return answer([{ revision: String(next.revision) }], 'UPDATE');
            }
            const result = (await target.query(query, values)) as { command?: string };
            if (text === 'COMMIT' && result.command === 'COMMIT' && pending !== undefined) committed = pending;
            if (text === 'COMMIT' || text === 'ROLLBACK') pending = undefined;
            return result;
          };
        },
      });
    },
    async query(text: string) {
      if (text === READ_STT_CONFIG) {
        standIn.statements.push(text);
        const read = answer(committed === null ? [] : [readable(committed, sessionOpenedAt)]);
        const change = afterPoolRead;
        afterPoolRead = null;
        if (change !== null && committed !== null) change(committed);
        return read;
      }
      return (standIn.pool.query as (text: string) => Promise<unknown>)(text);
    },
    on() {
      return pool;
    },
    async end() {
      /* nothing to close */
    },
  };

  const inserts = (table: string) => standIn.sent.filter((statement) => statement.text.startsWith(`insert into "${table}" `)).map((statement) => statement.values);
  return {
    pool: pool as unknown as Pool,
    standIn,
    row: () => (committed === null ? null : { ...committed }),
    setSessionOpenedAt: (at) => void (sessionOpenedAt = at),
    afterNextPoolRead: (change) => void (afterPoolRead = change),
    updates,
    auditInserts: () => inserts('audit_log'),
    eventInserts: () => inserts('events'),
  };
}

// ── The app ────────────────────────────────────────────────────────────────────────────────────

export interface SttApp {
  readonly app: FastifyInstance;
  readonly db: SttDatabase;
  readonly log: CapturedLog;
  readonly clock: ReturnType<typeof createManualClock>;
  readonly control: SttConfigControl;
  /** Says who the next requests come from (stage 4 as a stand-in). */
  actAs(principal: Principal): void;
  get(url?: string): Promise<LightMyRequestResponse>;
  post(url: string, payload?: unknown): Promise<LightMyRequestResponse>;
  /** Everything a request answered, a log line said and a row stored, as one text to search. */
  readonly answers: LightMyRequestResponse[];
  close(): Promise<void>;
}

export interface SttAppOptions {
  readonly row?: SttTableRow | null;
  readonly errorLogFile?: string;
  /** A data directory that exists: the app then has a Core credential store under it (row 84). Default: none. */
  readonly dataDir?: string;
}

export const ANONYMOUS: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
export const operator = (role: OperatorRole, operatorId = 'OPR-002', deviceId: string | null = null): Principal => ({
  kind: 'OPERATOR',
  operatorId,
  sessionId: 'session',
  deviceId,
  role,
  permissions: ROLE_PERMISSIONS[role],
});

export async function sttApp(options: SttAppOptions = {}): Promise<SttApp> {
  const db = sttDatabase(options.row === undefined ? SEEDED_ROW : options.row);
  const log = captureLog();
  const app = buildApp({
    // `trace`: every line the server can write is captured, so a search of the log is a search of all of it.
    config: unitTestConfig({ logLevel: 'trace', ...(options.dataDir === undefined ? {} : { dataDir: options.dataDir }) }),
    createPool: () => db.pool,
    logStream: log.stream,
    ...(options.errorLogFile === undefined ? {} : { errorLogFile: options.errorLogFile }),
  });
  const clock = createManualClock(CLOCK_START);
  app.seams.replace('clock', clock);
  let current: Principal = ANONYMOUS;
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  const answers: LightMyRequestResponse[] = [];
  const keep = async (pending: Promise<LightMyRequestResponse>): Promise<LightMyRequestResponse> => {
    const response = await pending;
    answers.push(response);
    return response;
  };
  return {
    app,
    db,
    log,
    clock,
    control: sttConfigControl(app),
    actAs: (principal) => void (current = principal),
    get: (url = STT_PATH) => keep(app.inject({ method: 'GET', url })),
    post: (url, payload) => keep(app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload: payload as object }) })),
    answers,
    close: () => app.close(),
  };
}

/** `[status, error code, details.reason]` of an answer. */
export function outcome(response: LightMyRequestResponse): [number, string | null, string | null] {
  try {
    const error = (response.json() as { error?: { code?: string; details?: { reason?: string } } }).error;
    return [response.statusCode, error?.code ?? null, error?.details?.reason ?? null];
  } catch {
    return [response.statusCode, null, null];
  }
}

// ── A sealer for the tests: real AES-256-GCM, a key that never leaves this object ───────────────

export interface TestSealer extends SttCredentialSealer {
  /** Opens what `seal` made: the proof that the stored bytes are a real envelope of the plaintext. */
  open(sealed: { ciphertext: Uint8Array; nonce: Uint8Array }): string;
  readonly sealed: SealedSttCredential[];
}

export function testSealer(keyRef = 'TEST_STT_KEY_1'): TestSealer {
  const key = randomBytes(32);
  const sealed: SealedSttCredential[] = [];
  return {
    sealed,
    async seal(plaintext) {
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, nonce);
      const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const envelope = { keyRef, ciphertext: new Uint8Array(Buffer.concat([body, cipher.getAuthTag()])), nonce: new Uint8Array(nonce) };
      sealed.push(envelope);
      return envelope;
    },
    open({ ciphertext, nonce }) {
      const bytes = Buffer.from(ciphertext);
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonce));
      decipher.setAuthTag(bytes.subarray(bytes.byteLength - 16));
      return Buffer.concat([decipher.update(bytes.subarray(0, bytes.byteLength - 16)), decipher.final()]).toString('utf8');
    },
  };
}

// ── The search for a planted credential ────────────────────────────────────────────────────────

/** The texts a credential must never reach, each under the name the report prints. */
export interface Haystacks {
  readonly responses: string;
  readonly logs: string;
  readonly errorLog: string;
  readonly auditRows: string;
  readonly events: string;
}

export function haystacksOf(stt: SttApp, errorLogText = ''): Haystacks {
  return {
    responses: stt.answers.map((answer) => `${answer.statusCode}\n${JSON.stringify(answer.headers)}\n${answer.body}`).join('\n'),
    logs: stt.log.text(),
    errorLog: errorLogText,
    auditRows: JSON.stringify(stt.db.auditInserts()),
    events: JSON.stringify(stt.db.eventInserts()),
  };
}

/** How often `needle` occurs in each text. */
export function hitsOf(haystacks: Haystacks, needle: string): Record<keyof Haystacks, number> {
  const count = (text: string): number => (needle === '' ? 0 : text.split(needle).length - 1);
  return { responses: count(haystacks.responses), logs: count(haystacks.logs), errorLog: count(haystacks.errorLog), auditRows: count(haystacks.auditRows), events: count(haystacks.events) };
}
