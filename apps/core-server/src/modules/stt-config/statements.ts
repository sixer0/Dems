/**
 * The statements of the STT configuration module (blueprint row 113; requirement R-8; C3 §2.5;
 * database contract dbc-3 §B.13 and its privileges, migration `0007_stt_config_privileges.sql`).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text (SR-67). A function takes the connection to run on: the pool for the read of operations 90
 * and 92, the unit of work for the change of operation 91. Every table is named with its schema.
 *
 * WHAT THE RUNTIME ROLE MAY DO HERE (0007). SELECT on eleven columns of `stt_config` - every one
 * EXCEPT the three credential columns `credential_ref`, `secret_ciphertext` and `nonce`, whose
 * SELECT is revoked. UPDATE on all fourteen. No INSERT and no DELETE: the singleton row is the
 * seed's and is carried by a reset (KEPT, mode `upsert`).
 *
 * THE CREDENTIAL IS WRITE-ONLY, IN THE STATEMENTS THEMSELVES. The three credential columns appear
 * in exactly ONE place of this file: the SET list of `UPDATE_STT_CONFIG_WITH_CREDENTIAL`. No
 * statement here selects one, returns one (`RETURNING` names `revision` only) or compares one, and
 * this module never calls the owner's reveal function `dems_stt_credential_reveal()`: reading the
 * credential back belongs to the single transcriber key-loader (row 115; `07_transcript_spec.md`
 * §B.2, SEC35-14). The static test of this folder holds all of it (`__tests__/static.test.ts`) -
 * for the reveal function it is the only narrowing control there is (row 112, residual 3).
 *
 * `whether a credential is set` is read from `credential_kind` alone, a column that names how a
 * credential is held and never what it is.
 */
import { STT_BACKENDS, STT_LANGUAGE, SttCredentialKind, type SttBackend, type SttConfigStored, type SttConfigValues } from '@dems/shared/api';
import type { QueryResultRow } from 'pg';

/** A connection that runs one parameterised statement: the runtime pool, or a unit of work. */
export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: Row[]; readonly rowCount: number | null }>;
}

/** The stored configuration without any credential column, plus the fact of the open session. */
export interface StoredSttConfig extends SttConfigStored {
  readonly updatedBy: string | null;
  readonly updatedAt: number;
  /** When the open session was created; null while no session is open. */
  readonly sessionOpenedAt: number | null;
}

interface SttRow extends QueryResultRow {
  enabled: boolean;
  backend: string;
  endpoint: string | null;
  model: string;
  language: string;
  diarization: boolean;
  credential_kind: string | null;
  revision: string | number;
  updated_by: string | null;
  updated_at: string | number;
  session_created_at: string | number | null;
}

/**
 * The eleven columns the runtime role may select, minus `singleton`. Written out one by one: a
 * `SELECT *` of this table fails 42501 for the runtime role, by design (row 112, residual 2).
 */
const READ_COLUMNS = 's.enabled, s.backend, s.endpoint, s.model, s.language, s.diarization, s.credential_kind, s.revision, s.updated_by, s.updated_at';

/**
 * Whether a session is open, as the instant it was created: `active_session` holds a row exactly
 * while one is (the same fact the capture selector locks on, OD-10). One statement with the
 * configuration, so both belong to one snapshot.
 */
const SESSION_FACT = '(SELECT a.created_at FROM public.active_session a LIMIT 1) AS session_created_at';

/** Operations 90 and 92: the configuration and the session fact. No credential column. */
export const READ_STT_CONFIG = `SELECT ${READ_COLUMNS}, ${SESSION_FACT} FROM public.stt_config s WHERE s.singleton`;

/** Operation 91: the same row, locked until the unit ends. A column-level UPDATE grant is enough for the lock. */
export const LOCK_STT_CONFIG = `${READ_STT_CONFIG} FOR UPDATE OF s`;

const SET_VALUES = 'enabled = $1, backend = $2, endpoint = $3, model = $4, language = $5, diarization = $6, revision = revision + 1, updated_by = $7, updated_at = $8';
/** Compare-and-set on the revision that was read under the lock; the new revision is all it returns. */
const WHERE_REVISION = 'WHERE singleton AND revision = $9 RETURNING revision';

/** Operation 91, a change that leaves the credential alone: the credential columns are not named. */
export const UPDATE_STT_CONFIG = `UPDATE public.stt_config SET ${SET_VALUES} ${WHERE_REVISION}`;

/**
 * Operation 91 with a credential write. The ONLY statement of the server's runtime that names the
 * three credential columns, and it names them to WRITE: `$10` the kind, `$11` the reference (a
 * pointer, or the key reference of the Core credential store), `$12` the ciphertext, `$13` the nonce.
 */
export const UPDATE_STT_CONFIG_WITH_CREDENTIAL = `UPDATE public.stt_config SET ${SET_VALUES}, credential_kind = $10, credential_ref = $11, secret_ciphertext = $12, nonce = $13 ${WHERE_REVISION}`;

/** What a row could not be read as. Names a column, never a value. */
export class SttConfigRowError extends Error {
  readonly code = 'STT_CONFIG_ROW_INVALID';
  readonly column: string;
  constructor(column: string) {
    super(`the stored STT configuration holds a value outside the contract in column ${column}`);
    this.name = 'SttConfigRowError';
    this.column = column;
  }
}

// The driver hands a `bigint` column over as text; every number of this table is a safe integer.
const whole = (value: string | number, column: string): number => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new SttConfigRowError(column);
  return number;
};

function storedOf(row: SttRow): StoredSttConfig {
  if (!(STT_BACKENDS as readonly string[]).includes(row.backend)) throw new SttConfigRowError('backend');
  if (row.language !== STT_LANGUAGE) throw new SttConfigRowError('language');
  if (row.credential_kind !== null && row.credential_kind !== SttCredentialKind.REFERENCE && row.credential_kind !== SttCredentialKind.ENCRYPTED) {
    throw new SttConfigRowError('credential_kind');
  }
  return {
    enabled: row.enabled,
    backend: row.backend as SttBackend,
    endpoint: row.endpoint,
    model: row.model,
    language: row.language,
    diarization: row.diarization,
    credentialKind: row.credential_kind,
    revision: whole(row.revision, 'revision'),
    updatedBy: row.updated_by,
    updatedAt: whole(row.updated_at, 'updated_at'),
    sessionOpenedAt: row.session_created_at === null ? null : whole(row.session_created_at, 'session_created_at'),
  };
}

/** Null when the table holds no row: a database the seed never wrote. */
export async function readSttConfig(db: Queryable): Promise<StoredSttConfig | null> {
  const { rows } = await db.query<SttRow>(READ_STT_CONFIG);
  return rows[0] === undefined ? null : storedOf(rows[0]);
}

/** The same row, locked by the unit that changes it. */
export async function lockSttConfig(db: Queryable): Promise<StoredSttConfig | null> {
  const { rows } = await db.query<SttRow>(LOCK_STT_CONFIG);
  return rows[0] === undefined ? null : storedOf(rows[0]);
}

/** The credential columns of one write, as the table's three-way CHECK wants them. */
export interface CredentialColumns {
  readonly kind: SttCredentialKind | null;
  readonly ref: string | null;
  readonly ciphertext: Uint8Array | null;
  readonly nonce: Uint8Array | null;
}

export interface SttConfigChange {
  readonly values: SttConfigValues;
  readonly operatorId: string;
  readonly now: number;
  /** The revision read under the lock. */
  readonly expectedRevision: number;
  /** Null: the credential columns are not touched. */
  readonly credential: CredentialColumns | null;
}

/** The new revision, or null when no row had the expected revision (it cannot be, under the lock). */
export async function updateSttConfig(db: Queryable, change: SttConfigChange): Promise<number | null> {
  const { values } = change;
  const base = [values.enabled, values.backend, values.endpoint, values.model, values.language, values.diarization, change.operatorId, change.now, change.expectedRevision];
  const { rows } =
    change.credential === null
      ? await db.query<{ revision: string | number }>(UPDATE_STT_CONFIG, base)
      : await db.query<{ revision: string | number }>(UPDATE_STT_CONFIG_WITH_CREDENTIAL, [
          ...base,
          change.credential.kind,
          change.credential.ref,
          change.credential.ciphertext === null ? null : Buffer.from(change.credential.ciphertext),
          change.credential.nonce === null ? null : Buffer.from(change.credential.nonce),
        ]);
  return rows[0] === undefined ? null : whole(rows[0].revision, 'revision');
}
