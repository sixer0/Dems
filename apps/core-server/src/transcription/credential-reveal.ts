/**
 * THE ONE CALLER OF THE REVEAL FUNCTION OF THE STT CREDENTIAL (blueprint row 115; SEC35-14;
 * database contract dbc-3 §B.13 "the single read path"; migration `0007_stt_config_privileges.sql`).
 *
 * The runtime role cannot select the three credential columns of `stt_config`. The owner's
 * function `dems_stt_credential_reveal()` is the only read path, and THIS FILE is the only source
 * of the server that names it (`STT_REVEAL_CALLERS` of `modules/stt-config/__tests__/static.test.ts`).
 *
 * What comes back is NOT a key for a `REFERENCE`: it is the pointer (`omlx-settings:auth.api_key`),
 * and the key itself stays in the file that pointer names, read by the transcriber's single
 * key-loader. For `ENCRYPTED` it is the sealed envelope (key reference, ciphertext, nonce), which
 * only the Core credential store's opener can open.
 *
 * Nothing here logs, and nothing here is put into an error: a failure is a code.
 */
import type { QueryResultRow } from 'pg';

/** The one statement. A constant text, no parameter (the table is a singleton). */
export const REVEAL_STT_CREDENTIAL = 'SELECT credential_kind, credential_ref, secret_ciphertext, nonce FROM public.dems_stt_credential_reveal()';

export interface RevealConnection {
  query<Row extends QueryResultRow = QueryResultRow>(text: string): Promise<{ readonly rows: Row[] }>;
}

/** How the stored credential is held. Never the key: a pointer, or a sealed envelope. */
export type RevealedSttCredential =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'REFERENCE'; readonly ref: string }
  | { readonly kind: 'ENCRYPTED'; readonly sealed: { readonly keyRef: string; readonly ciphertext: Uint8Array; readonly nonce: Uint8Array } };

export const SttCredentialRevealFailure = { ROW_INVALID: 'STT_CREDENTIAL_ROW_INVALID' } as const;

export class SttCredentialRevealError extends Error {
  readonly code = SttCredentialRevealFailure.ROW_INVALID;
  constructor() {
    super('the stored STT credential is not of a form the contract knows');
    this.name = 'SttCredentialRevealError';
  }
}

interface RevealRow extends QueryResultRow {
  credential_kind: string | null;
  credential_ref: string | null;
  secret_ciphertext: Uint8Array | null;
  nonce: Uint8Array | null;
}

/** An unseeded table and a row without a credential are both `NONE`. */
export async function revealSttCredential(connection: RevealConnection): Promise<RevealedSttCredential> {
  const { rows } = await connection.query<RevealRow>(REVEAL_STT_CREDENTIAL);
  const row = rows[0];
  if (row === undefined || row.credential_kind === null) return { kind: 'NONE' };
  if (row.credential_kind === 'REFERENCE' && typeof row.credential_ref === 'string') return { kind: 'REFERENCE', ref: row.credential_ref };
  if (row.credential_kind === 'ENCRYPTED' && typeof row.credential_ref === 'string' && row.secret_ciphertext instanceof Uint8Array && row.nonce instanceof Uint8Array) {
    return { kind: 'ENCRYPTED', sealed: { keyRef: row.credential_ref, ciphertext: new Uint8Array(row.secret_ciphertext), nonce: new Uint8Array(row.nonce) } };
  }
  throw new SttCredentialRevealError();
}
