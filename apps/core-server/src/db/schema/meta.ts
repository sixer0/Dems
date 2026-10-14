/**
 * Typed schema, group `meta`: T-29 `schema_meta` (database contract §4.29), and the two
 * constants the server compares it with at boot (B-3).
 *
 * The one row is written by the last file of a migration set and by nothing else (MG-5). The
 * migrator's own bookkeeping table lives in schema `drizzle`, which the runtime role cannot
 * read (OW-5, D38); the runtime role reads the version here.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, text } from 'drizzle-orm/pg-core';

/**
 * The schema version this code expects: 3 since migration set 4 (`0008_capture_sources.sql` +
 * `0009_capture_sources_privileges.sql`; dbc-4 §N.8/§N.9, D-DB-17, blueprint row 129). It was 2
 * since the capture set (`0004`/`0005`). A later set adds 1 in its last file, and this constant
 * changes in the same commit as that file (MG-5) - here, the `UPDATE public.schema_meta` of 0009.
 * Boot check B-3 refuses a database on either side of the step: this code on `(2, 'dbc-3')` names
 * `db:migrate`, and code older than row 129 refuses `(3, 'dbc-4')`.
 *
 * 4 since migration set 5 (`0010_credential_replace_privileges.sql`; section N erratum
 * PE-129a-01, finding F-84-1, row 129a): one column grant, `SELECT (device_id)` on
 * `capture_device_credentials`, so that the runtime role can replace a stored camera credential.
 * No table or column changed; the step exists because code that replaces a credential fails
 * 42501 on a database without the grant, and B-3 is the only place that can say so at boot.
 *
 * 5 since migration set 6 (`0011_session_stt_config.sql` + `0012_session_stt_config_privileges.sql`;
 * section N erratum PE-129b-01, row 129b, D109): T-42 `session_stt_config`, the STT configuration
 * of a session as it was at its start (R-8 AC-4). Code that keeps that snapshot fails at its first
 * statement on a database without the table, so B-3 refuses it there, and refuses older code here.
 *
 * 6 since migration set 7 (`0013_key_id_fault_reason_media_root.sql` +
 * `0014_key_id_fault_reason_media_root_privileges.sql`; section N erratum PE-0013-01; rulings
 * D146, D162, D166): the key-id form on `transcript_revisions`, `alerts.reason` (the third member
 * of the fault key) and T-43 `core_media_store` (the media store root for the command-line reset).
 * Code that writes the new column or table fails at its first statement on a database without the
 * set, so B-3 refuses it there, and refuses older code here.
 *
 * 7 since migration set 8 (`0015_capture_streams_audio_inputs.sql` +
 * `0016_capture_streams_audio_inputs_privileges.sql`; schema set A of task 4, design
 * `docs/2026-10-12_input_av_core_adapter_plan/masterplan/03_db_schema_extension.md` sections 2.1
 * to 2.3 with design addendum 1.4 #1 and 7.2; decisions U8, U11, C14): T-44
 * `capture_device_streams`, T-45 `capture_audio_inputs`, `session_capture_sources.source_facts`,
 * and the six slot columns of `capture_config` nullable with `capture_config_slot_pair_check`.
 * Code that writes a new table or the new column fails at its first statement on a database
 * without the set, and older code must not read a selector row that may hold an unassigned slot,
 * so B-3 refuses in both directions.
 *
 * 8 since migration set 9 (`0017_network_commissioning.sql` +
 * `0018_network_commissioning_privileges.sql`; schema set B of task 4, design
 * `docs/2026-10-12_input_av_core_adapter_plan/masterplan/03_db_schema_extension.md` sections 2.4
 * and 2.5; decisions U10, U11; plan review P12-F07; findings of rows 67 and 156): T-46
 * `capture_network_config`, T-47 `host_network_aliases`, the columns `usb_serial` and `usb_port`
 * of `capture_audio_inputs`, and - on a database that is already seeded - the two stored rows of
 * the commissioning permission. Code that reads the network settings or stores the port of a
 * sound card fails at its first statement on a database without the set, and older code refuses
 * a stored matrix that holds a permission it does not know, so B-3 refuses in both directions.
 *
 * 9 since migration set 10 (`0019_credential_replaced_reason.sql` +
 * `0020_credential_replaced_reason_privileges.sql`; task 4 package X-C, design
 * `docs/2026-10-12_input_av_core_adapter_plan/masterplan/05_design_x1_x2.md` section 3.6;
 * security review SX-12; decision U19): the value `CREDENTIAL_REPLACED` in the session-end
 * reasons (`auth_sessions_end_reason_check`) and in the biometric-revoke reasons
 * (`biometric_tokens_revoke_check`). No table, no column, no grant. Code that ends a session with
 * the new reason answers 23514 on a database without the set, and older code must not read a
 * session history that may hold a reason it does not know, so B-3 refuses in both directions.
 *
 * 10 since migration set 11 (`0021_profile_codes_data.sql` + `0022_profile_codes.sql` +
 * `0023_profile_codes_privileges.sql`; requirement AD-06 (4) of
 * `docs/2026-10-12_input_av_core_adapter_plan/verification/04_security_addendum.md`, handed over
 * by task 4 row 51; decisions C29 (2), C36): `capture_devices_profiles_code_check` holds every
 * element of `capture_devices.profiles` to the code form of the Core. `0021` is a DATA STEP: a
 * stored list that holds anything else (an ONVIF token list of an adoption before row 51) is set
 * to the empty list, and that camera needs a connection test before it can be assigned. Code that
 * reads the list as codes must not start on a database that does not keep that promise, and older
 * code may write a token list the database now refuses, so B-3 refuses in both directions.
 *
 * 11 since migration set 12 (`0024_installation_acceptance.sql` +
 * `0025_installation_acceptance_privileges.sql`; schema set C of task 4, design
 * `docs/2026-10-12_input_av_core_adapter_plan/masterplan/03_db_schema_extension.md` section 2.6;
 * decisions U11 (OQ-2), C2; security finding S13-13): T-48 `installation_acceptances`, the record
 * that an installation was accepted, with at most one acceptance in force. Code that reads or
 * writes an acceptance fails at its first statement on a database without the set, and the status
 * command of older code would not count the table, so B-3 refuses in both directions.
 *
 * 12 since migration set 13 (`0026_alias_removal_reasons.sql` +
 * `0027_alias_removal_reasons_privileges.sql`; decisions C74 (D-2, D-3) and C83 of
 * `docs/2026-10-12_input_av_core_adapter_plan/decisions/decisions.md`; security finding S13-10):
 * the values `SHUTDOWN` and `NOT_ADDED` in the removal reasons of a temporary host address
 * (`host_network_aliases_remove_reason_check`). No table, no column, no grant. Code that closes a
 * row with a new reason answers 23514 on a database without the set, and older code must not
 * read an alias history that may hold a reason it does not know, so B-3 refuses in both directions.
 *
 * 13 since migration set 14 (`0028_alias_removal_reason_unconfirmed.sql` +
 * `0029_alias_removal_reason_unconfirmed_privileges.sql`; caution R119-05, answer (d), of
 * `docs/2026-10-12_input_av_core_adapter_plan/verification/119_commissioning_security.md`;
 * decision C94 (d)): the value `ADD_UNCONFIRMED` in the same set, for the removal at once after
 * an `add` whose effect is not known. No table, no column, no grant. B-3 refuses in both
 * directions for the reasons of set 13.
 *
 * 14 since migration set 15 (`0030_network_config_onvif_ports.sql` +
 * `0031_network_config_onvif_ports_privileges.sql`; code review 120 finding F-4 with decision
 * C114, and code review 120b finding S2-02 with decision C116, of
 * `docs/2026-10-12_input_av_core_adapter_plan/decisions/decisions.md`): the column
 * `capture_network_config.onvif_ports` (the allowed ONVIF ports, default `[80]`) with its two
 * CHECKs and its UPDATE grant, and the form of an interface name widened to the alias helper's
 * own (upper case admitted) in the two CHECKs that hold one. Code that names the column answers
 * 42703 on a database without the set, and older code must not start on settings that may hold
 * a name or a port list it does not know, so B-3 refuses in both directions.
 */
export const DB_SCHEMA_VERSION = 14;
/** The revision of the database contract the migration set was written from. */
export const DB_CONTRACT_REVISION = 'dbc-15';

/** T-29. One row. */
export const schemaMeta = pgTable(
  'schema_meta',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    schemaVersion: integer('schema_version').notNull(),
    contractRevision: text('contract_revision').notNull(),
  },
  (t) => [check('schema_meta_singleton_check', sql`${t.singleton} AND ${t.schemaVersion} >= 1`)],
);

export type SchemaMetaRow = typeof schemaMeta.$inferSelect;
