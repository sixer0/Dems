/**
 * Typed schema, group `stt`: T-40 `stt_config` (database contract dbc-3 §B.13; requirement R-8,
 * decision D20; confirmed as Q-STT-CFG (a) at the second blueprint gate, decision D24).
 *
 * One row: the persistent STT configuration the web configuration menu edits (operation 91,
 * `03_api_contract.md` §2.5) and the transcriber reads at session start. Like `capture_config`
 * (B.1) the row is snapshotted into `active_session` when a session starts, so an edit applies to
 * the NEXT session, never to the open one (OD-10 pattern). Reset: KEPT, mode `upsert` (D-DB-08,
 * §E.1) — the configuration survives a demo reset (OD-19); the seed and the kept-tables entry are
 * row 114, the API operations are row 113 (M6).
 *
 * The credential rule (SEC35-14; RK-12 pattern of B.3): the server key is NEVER held as key
 * material here. It is either a REFERENCE — the oMLX key stays in `~/.omlx/settings.json`, pointed
 * at by `credential_ref` — or ENCRYPTED: AES-256-GCM ciphertext plus a 12-byte nonce and a
 * `credential_ref` into the Core credential store (the same store as B.3). `secret_ciphertext`,
 * `nonce` and the reference target `credential_ref` are exactly the columns whose SELECT is withheld
 * from the runtime role by `0007_stt_config_privileges.sql` (dbc-3 §B.13 privileges): the columns
 * are writable by op 91 but readable only through the owner-owned `SECURITY DEFINER` reveal function,
 * reached from the single transcriber key-loader module (`07_transcript_spec.md` §B.2 SEC35-14 rule;
 * D-DB-07 forbids a fourth DB role). Nothing of this table's credential may reach a slice, a log or
 * an audit row: `STT_CONFIG_CHANGED` carries field NAMES plus `credentialChanged` only (E-30/E-31).
 *
 * The endpoint is loopback-only by a DB CHECK (OD-13): the regex admits `http://127.0.0.1` and
 * `http://localhost` with an optional port and path; a LAN host is refused at the database boundary,
 * not only by the API (row 113 refuses it earlier with `ENDPOINT_NOT_LOOPBACK`).
 */
import { sql } from 'drizzle-orm';
import { bigint, boolean, check, foreignKey, pgTable, text } from 'drizzle-orm/pg-core';
import { bytea } from './bytea';
import { matches, oneOf } from './checks';
import { operators } from './rbac';
import { STT_BACKEND, STT_CREDENTIAL_KIND, type SttBackendValue, type SttCredentialKindValue } from './value-sets';

/**
 * The loopback-only endpoint shape of `stt_config_endpoint_loopback_check` (OD-13; dbc-3 §B.13).
 * Statement text for `drizzle-kit generate`, never a bind parameter (checks.ts header rule).
 */
const STT_ENDPOINT_LOOPBACK_PATTERN = '^http://(127\\.0\\.0\\.1|localhost)(:[0-9]{1,5})?(/.*)?$';

/** The only language the product transcribes (OD-20); the CHECK is equality, not an IN list. */
const STT_LANGUAGE = 'id';

/**
 * T-40. The STT configuration singleton (N-2 shape: PK on `singleton` DEFAULT true, CHECK true).
 */
export const sttConfig = pgTable(
  'stt_config',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    /** R-8 AC-5: disabled means no transcriber work and `transcript.state = 'DISABLED'` at seal. */
    enabled: boolean('enabled').notNull().default(true),
    /** `omlx-server` = development on this Mac, `cpu-local` = the shipped whisper.cpp path (OD-24/D7). */
    backend: text('backend').$type<SttBackendValue>().notNull(),
    /** Server backend only; loopback hosts only (OD-13); null for `cpu-local`. */
    endpoint: text('endpoint'),
    /** Model id (server) or model path reference (cpu-local); format checked by the mapping, never a secret. */
    model: text('model').notNull(),
    /** Indonesian only (OD-20). */
    language: text('language').notNull().default(STT_LANGUAGE),
    /** Speaker labelling on/off: R-5 labels when possible, seals unlabelled with the flag otherwise. */
    diarization: boolean('diarization').notNull().default(true),
    /** How a credential is held, or null when none is configured. */
    credentialKind: text('credential_kind').$type<SttCredentialKindValue>(),
    /** REFERENCE: a pointer such as `omlx-settings:auth.api_key`; ENCRYPTED: the key-store `key_ref`. Never key material. */
    credentialRef: text('credential_ref'),
    /** ENCRYPTED only: AES-256-GCM envelope bytes (16-byte minimum plaintext + 16-byte tag = 17 floor per §B.13). */
    secretCiphertext: bytea('secret_ciphertext'),
    /** ENCRYPTED only: the 96-bit standard GCM nonce. */
    nonce: bytea('nonce'),
    /** Optimistic revision of operation 91, the same refusal shape as op 78 (`REVISION_CONFLICT`). */
    revision: bigint('revision', { mode: 'number' }).notNull().default(1),
    updatedBy: text('updated_by'),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    // N-2 singleton: one row, PK true, CHECK keeps the PK honest.
    check('stt_config_singleton_check', sql`${t.singleton}`),
    foreignKey({
      name: 'stt_config_updated_by_fkey',
      columns: [t.updatedBy],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check('stt_config_backend_check', oneOf(t.backend, STT_BACKEND)),
    // Required for the server backend, null for the local one (§B.13 first endpoint clause).
    check('stt_config_endpoint_required_check', sql`${t.backend} <> 'omlx-server' OR ${t.endpoint} IS NOT NULL`),
    // Loopback only when present (OD-13; the M2-STTCFG-DB refusals cite this name).
    check('stt_config_endpoint_loopback_check', sql`${t.endpoint} IS NULL OR ${matches(t.endpoint, STT_ENDPOINT_LOOPBACK_PATTERN)}`),
    check('stt_config_language_check', sql`${t.language} = ${sql.raw(`'${STT_LANGUAGE}'`)}`),
    check('stt_config_credential_kind_check', sql`${t.credentialKind} IS NULL OR ${oneOf(t.credentialKind, STT_CREDENTIAL_KIND)}`),
    // The GCM envelope floors of §B.13, enforced only when the column is present.
    check('stt_config_secret_check', sql`${t.secretCiphertext} IS NULL OR octet_length(${t.secretCiphertext}) >= 17`),
    check('stt_config_nonce_check', sql`${t.nonce} IS NULL OR octet_length(${t.nonce}) = 12`),
    // The three-way credential shape of §B.13 `stt_config_credential_check`, quoted exactly:
    // none, or REFERENCE (pointer only), or ENCRYPTED (reference + envelope complete).
    check(
      'stt_config_credential_check',
      sql`(${t.credentialKind} IS NULL AND ${t.credentialRef} IS NULL AND ${t.secretCiphertext} IS NULL AND ${t.nonce} IS NULL)
        OR (${t.credentialKind} = 'REFERENCE' AND ${t.credentialRef} IS NOT NULL AND ${t.secretCiphertext} IS NULL AND ${t.nonce} IS NULL)
        OR (${t.credentialKind} = 'ENCRYPTED' AND ${t.credentialRef} IS NOT NULL AND ${t.secretCiphertext} IS NOT NULL AND ${t.nonce} IS NOT NULL)`,
    ),
    check('stt_config_revision_check', sql`${t.revision} >= 1`),
  ],
);

export type SttConfigRow = typeof sttConfig.$inferSelect;
export type NewSttConfigRow = typeof sttConfig.$inferInsert;
