/**
 * THE ONE CALLER OF THE REVEAL FUNCTION OF THE CAMERA CREDENTIAL (task 4 blueprint row 45, work
 * package WP-06a; design addendum 04 section 2.3 step 1; plan-review finding P12-B2; SEC35-02;
 * database contract dbc-3 section B.3 "the single read path"; migration `0005_capture_privileges.sql`,
 * which names this very path).
 *
 * The runtime role cannot select a credential column of `capture_device_credentials`. The owner's
 * function is the only read path, and THIS FILE is the only source of the server that names it
 * (`CAPTURE_REVEAL_CALLERS` of `__tests__/static.test.ts`; the twin of the transcriber's rule).
 *
 * What comes back is NEVER a secret: the account name (a clear column) and the sealed envelope
 * (key reference, ciphertext, nonce), which only the Core credential store's opener can open. This
 * file opens nothing and imports nothing of the server.
 *
 * It is imported by ONE file, the credential reader beside it, which calls it inside the unit
 * that also writes the audit entry of the reveal. So a row of a form the contract does not know
 * is an ANSWER here (`INVALID`), not a throw: a throw would roll that unit back, and the function
 * would have been called without its entry.
 *
 * Nothing here logs, and nothing here is put into an error.
 */
import type { QueryResultRow } from 'pg';

/** The one statement. A constant text; `$1` is the device, a bind parameter (SR-67). */
export const REVEAL_CAPTURE_CREDENTIAL = 'SELECT username, encryption, secret_ciphertext, nonce, key_ref FROM public.dems_capture_credential_reveal($1)';

/** The one stored form (`capture_device_credentials_encryption_check`). */
export const CAPTURE_CREDENTIAL_ENCRYPTION = 'AES-256-GCM';

/** A connection that runs one parameterised statement: the unit of work of the reveal. */
export interface CaptureRevealConnection {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<{ readonly rows: Row[] }>;
}

/** The three stored values of the envelope, in the form the credential store's opener takes. */
export interface RevealedCaptureEnvelope {
  readonly keyRef: string;
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
}

/**
 * What the function answered for one device. `NONE`: no credential is stored for it (an unknown
 * device answers the same: the function yields no row). `INVALID`: a row whose members are not of
 * the stored form. `SEALED`: the account name and the envelope - still no secret.
 */
export type RevealedCaptureCredential =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'INVALID' }
  | { readonly kind: 'SEALED'; readonly username: string; readonly sealed: RevealedCaptureEnvelope };

interface RevealRow extends QueryResultRow {
  username: unknown;
  encryption: unknown;
  secret_ciphertext: unknown;
  nonce: unknown;
  key_ref: unknown;
}

/** One device per call. Throws only what the connection throws: the statement failed, nothing was read. */
export async function revealCaptureCredential(connection: CaptureRevealConnection, deviceId: string): Promise<RevealedCaptureCredential> {
  const { rows } = await connection.query<RevealRow>(REVEAL_CAPTURE_CREDENTIAL, [deviceId]);
  const row = rows[0];
  if (row === undefined) return { kind: 'NONE' };
  // The device is the key of the table: more than one row is not an answer of this function.
  if (rows.length !== 1) return { kind: 'INVALID' };
  if (
    typeof row.username !== 'string' ||
    row.username.length === 0 ||
    row.encryption !== CAPTURE_CREDENTIAL_ENCRYPTION ||
    typeof row.key_ref !== 'string' ||
    !(row.secret_ciphertext instanceof Uint8Array) ||
    !(row.nonce instanceof Uint8Array)
  ) {
    return { kind: 'INVALID' };
  }
  return { kind: 'SEALED', username: row.username, sealed: { keyRef: row.key_ref, ciphertext: new Uint8Array(row.secret_ciphertext), nonce: new Uint8Array(row.nonce) } };
}
