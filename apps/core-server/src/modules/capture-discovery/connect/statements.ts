/**
 * The statements of the camera-credential write (blueprint row 142; contract C3 §2.6 "Adoption and
 * operation 89"; database contract dbc-5 §B.3, §N.7, erratum PE-129a-01; decisions D81, D103;
 * findings F-84-1, F-129a-1).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text (SR-67). A function takes the connection to run on: always a unit of work.
 *
 * WHAT THE RUNTIME ROLE MAY DO ON `capture_device_credentials` (migrations 0005, 0009, 0010).
 * INSERT; UPDATE of six columns; SELECT of ONE column, `device_id`. No SELECT of any other column,
 * no DELETE. The table is read back only through the owner's reveal function, by the single
 * owning reveal module (SEC35-02) - which is NOT this folder: no statement here selects, returns
 * or compares a credential column, and this folder never calls a reveal function.
 *
 * THE REPLACE FORM (finding F-129a-1). `ON CONFLICT ... DO UPDATE SET col = EXCLUDED.col` is
 * refused 42501 for the runtime role: PostgreSQL asks for SELECT on the target column behind every
 * `EXCLUDED` reference. So the SET list of the upsert names the BIND PARAMETERS again, and nothing
 * but them. The conflict target is the one column the role may read.
 *
 * THE CREDENTIAL COLUMNS APPEAR IN EXACTLY TWO PLACES OF THIS FILE: the column list of the INSERT
 * and the SET list of its conflict branch. Both write.
 */
import type { QueryResultRow } from 'pg';

/** A connection that runs one parameterised statement: a unit of work. */
export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<{ readonly rows: Row[]; readonly rowCount: number | null }>;
}

/**
 * The first credential of a device: operation 96, inside the adoption transaction. `$1` the
 * device, `$2` the account name (a clear column), `$3` the ciphertext with its tag, `$4` the
 * 12-byte nonce, `$5` the key reference of the Core credential store, `$6` the instant. A second
 * row for the device is a conflict that FAILS the unit: an adoption writes a new device.
 */
export const INSERT_CAPTURE_CREDENTIAL =
  'INSERT INTO public.capture_device_credentials (device_id, username, secret_ciphertext, nonce, key_ref, rotated_at) VALUES ($1, $2, $3, $4, $5, $6)';

/**
 * Operation 89: the credential of a registered device, set or REPLACED in one statement. The same
 * six parameters; the conflict branch names them again (never `EXCLUDED`, see the file comment).
 * It returns nothing: the role may read no column that a `RETURNING` could usefully name.
 */
export const UPSERT_CAPTURE_CREDENTIAL = `${INSERT_CAPTURE_CREDENTIAL} ON CONFLICT (device_id) DO UPDATE SET username = $2, secret_ciphertext = $3, nonce = $4, key_ref = $5, rotated_at = $6`;

/** The columns of one credential write, as the table's CHECKs want them. */
export interface CaptureCredentialRow {
  readonly deviceId: string;
  readonly username: string;
  /** AES-256-GCM ciphertext with its tag: 33 bytes or more (`capture_device_credentials_secret_check`). */
  readonly ciphertext: Uint8Array;
  /** The 96-bit GCM nonce: 12 bytes. */
  readonly nonce: Uint8Array;
  /** A code of the Core credential store: never key material. */
  readonly keyRef: string;
  readonly at: number;
}

const valuesOf = (row: CaptureCredentialRow): readonly unknown[] => [row.deviceId, row.username, Buffer.from(row.ciphertext), Buffer.from(row.nonce), row.keyRef, row.at];

/** Operation 96. Throws the driver's error (a unique or a foreign-key violation) and the unit rolls back. */
export async function insertCaptureCredential(db: Queryable, row: CaptureCredentialRow): Promise<void> {
  await db.query(INSERT_CAPTURE_CREDENTIAL, valuesOf(row));
}

/** Operation 89: the second write replaces the first. */
export async function upsertCaptureCredential(db: Queryable, row: CaptureCredentialRow): Promise<void> {
  await db.query(UPSERT_CAPTURE_CREDENTIAL, valuesOf(row));
}
