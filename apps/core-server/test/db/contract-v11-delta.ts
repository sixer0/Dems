/**
 * The schema-v11 delta of the database contract (schema set C of task 4, contract revision
 * `dbc-12`), composed after the v10 delta by `contract-inventory.ts` (ruling D44 R1: a closed
 * contract is never edited; the delta lives in this app's test folder).
 *
 * Provenance, stated honestly:
 *   - table T-48 `installation_acceptances` - names, types, nullability and defaults from the
 *     column table of `docs/2026-10-12_input_av_core_adapter_plan/masterplan/
 *     03_db_schema_extension.md` section 2.6; decisions U11 (OQ-2) and C2;
 *   - the partial unique index is the design's "at most one acceptance in force"; its name
 *     `installation_acceptances_in_force_key` and its form (an index on the expression
 *     `revoked_at IS NULL`, over the rows where it holds) are this delta's, the form of
 *     `host_network_aliases_one_open_key`;
 *   - the design gives `steps` "CHECK array, at most 32 elements" and `diagnostics` "CHECK
 *     object"; security finding S13-13 asks for a forbidden-key check and a size bound on both.
 *     What the database holds beyond the design's two words is this delta's: each step a FLAT
 *     object; the diagnostics at most four levels deep (the shape of the Core's own diagnostics
 *     run); none of the 28 denied key names at any depth; 8,192 and 16,384 bytes; every text at
 *     most 200 characters without a control character. The CLOSED KEY LIST of each document is
 *     the contract's of the acceptance operation (row 116), not the database's;
 *   - the bounds on `software_version` (1 to 64) and `site_address` (at most 500) and on the
 *     revoke reason (5 to 500) are the design's; "single-line, 1 to 200 characters" for the three
 *     snapshot columns is this delta's (the design states no bound; `core_device` has none);
 *   - every constraint definition is the statement text of the generated
 *     `0024_installation_acceptance.sql`; a default is written as PostgreSQL prints it back.
 * No value set is added. Totals after the composition: 48 tables, 497 columns, 229 CHECKs, 48
 * foreign keys, 48 primary keys, 16 unique constraints, 7 unique indexes, 24 indexes, 48 value
 * sets.
 */
import type { V2NewTable } from './contract-v2-delta';

const T = '"installation_acceptances"';
const SITE_TEXT = "'^[^[:cntrl:]]{1,200}$'";
const DENIED = 'password|passwordHash|salt|token|tokenHash|sessionToken|deviceCredential|credential|credentialHash|biometricToken|code|codeHash|pairingCode|qrPayload|username|cookie|authorization|secret|secretCiphertext|ciphertext|nonce|keyRef|onvifUuid|signedUrl|mediaUrl|credentialRef|credentialValue|apiKey';
const NO_SECRET_KEYS = (column: string): string =>
  `NOT jsonb_path_exists(${T}."${column}", 'strict $.**?(@.type() == "object").keyvalue()?(@."key" like_regex "^(${DENIED})$")')`;
const TEXT_BOUND = (column: string, bytes: number): string =>
  `octet_length(${T}."${column}"::text) <= ${bytes} AND NOT jsonb_path_exists(${T}."${column}", 'strict $.**?(@.type() == "string" && !(@ like_regex "^[^[:cntrl:]]{0,200}$"))')`;

export const V11: { readonly newTables: readonly V2NewTable[] } = {
  newTables: [
    {
      id: 'T-48',
      name: 'installation_acceptances',
      columns: [
        { name: 'id', type: 'uuid', notNull: true, default: 'gen_random_uuid()' },
        { name: 'accepted_at', type: 'bigint', notNull: true, default: null },
        { name: 'accepted_by', type: 'text', notNull: true, default: null },
        { name: 'software_version', type: 'text', notNull: true, default: null },
        { name: 'core_device_id', type: 'text', notNull: true, default: null },
        { name: 'site_name', type: 'text', notNull: true, default: null },
        { name: 'room', type: 'text', notNull: true, default: null },
        { name: 'site_address', type: 'text', notNull: false, default: null },
        { name: 'steps', type: 'jsonb', notNull: true, default: null },
        { name: 'diagnostics', type: 'jsonb', notNull: true, default: null },
        { name: 'revoked_at', type: 'bigint', notNull: false, default: null },
        { name: 'revoked_by', type: 'text', notNull: false, default: null },
        { name: 'revoke_reason', type: 'text', notNull: false, default: null },
      ],
      constraints: [
        { name: 'installation_acceptances_pkey', kind: 'PRIMARY KEY', definition: '(id)' },
        { name: 'installation_acceptances_accepted_by_fkey', kind: 'FOREIGN KEY', definition: '(accepted_by) REFERENCES operators (id)' },
        { name: 'installation_acceptances_revoked_by_fkey', kind: 'FOREIGN KEY', definition: '(revoked_by) REFERENCES operators (id)' },
        { name: 'installation_acceptances_in_force_key', kind: 'UNIQUE INDEX', definition: '((revoked_at IS NULL)) WHERE revoked_at IS NULL' },
        { name: 'installation_acceptances_software_version_check', kind: 'CHECK', definition: `${T}."software_version" ~ '^[^[:cntrl:]]{1,64}$'` },
        {
          name: 'installation_acceptances_site_check',
          kind: 'CHECK',
          definition: `${T}."core_device_id" ~ ${SITE_TEXT} AND ${T}."site_name" ~ ${SITE_TEXT} AND ${T}."room" ~ ${SITE_TEXT}`,
        },
        {
          name: 'installation_acceptances_site_address_check',
          kind: 'CHECK',
          definition: `${T}."site_address" IS NULL OR char_length(${T}."site_address") BETWEEN 1 AND 500`,
        },
        {
          name: 'installation_acceptances_steps_check',
          kind: 'CHECK',
          definition: `CASE WHEN jsonb_typeof(${T}."steps") = 'array' THEN jsonb_array_length(${T}."steps") <= 32 AND NOT jsonb_path_exists(${T}."steps", 'strict $[*]?(@.type() != "object")') AND NOT jsonb_path_exists(${T}."steps", 'strict $.**{3 to last}') ELSE false END`,
        },
        { name: 'installation_acceptances_steps_no_secret_keys_check', kind: 'CHECK', definition: NO_SECRET_KEYS('steps') },
        { name: 'installation_acceptances_steps_bound_check', kind: 'CHECK', definition: TEXT_BOUND('steps', 8192) },
        {
          name: 'installation_acceptances_diagnostics_check',
          kind: 'CHECK',
          definition: `CASE WHEN jsonb_typeof(${T}."diagnostics") = 'object' THEN NOT jsonb_path_exists(${T}."diagnostics", 'strict $.**{5 to last}') ELSE false END`,
        },
        { name: 'installation_acceptances_diagnostics_no_secret_keys_check', kind: 'CHECK', definition: NO_SECRET_KEYS('diagnostics') },
        { name: 'installation_acceptances_diagnostics_bound_check', kind: 'CHECK', definition: TEXT_BOUND('diagnostics', 16384) },
        {
          name: 'installation_acceptances_revoked_at_check',
          kind: 'CHECK',
          definition: `${T}."revoked_at" IS NULL OR ${T}."revoked_at" >= ${T}."accepted_at"`,
        },
        {
          name: 'installation_acceptances_revoke_check',
          kind: 'CHECK',
          definition: `((${T}."revoked_at" IS NULL) = (${T}."revoked_by" IS NULL)) AND ((${T}."revoked_at" IS NULL) = (${T}."revoke_reason" IS NULL)) AND (${T}."revoke_reason" IS NULL OR char_length(${T}."revoke_reason") BETWEEN 5 AND 500)`,
        },
      ],
    },
  ],
};
