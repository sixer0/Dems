/**
 * The typed schema of the DEMS Core database: 48 tables in schema `public` (database contract
 * §3.3, §4, `dbc-3` §B and `dbc-4` §N; plan rows W17 and M2-W2; table 40 = T-40 `stt_config`,
 * row 112; table 41 = T-41 `session_capture_sources`, row 129). This
 * file is the entry `drizzle.config.ts` names, and what every later row imports.
 *
 *   rbac       T-01 roles, T-02 permissions, T-03 role_permissions, T-04 operators,
 *              T-05 operator_credentials
 *   identity   T-06 auth_sessions
 *   pairing    T-07 pairing_codes, T-08 paired_devices, T-09 device_credentials,
 *              T-10 biometric_tokens, T-11 registry_counters
 *   audit      T-12 audit_log, T-13 audit_chain_head, T-14 events, T-30 audit_chain_history
 *   sessions   T-15 active_session, T-16 session_history
 *   evidence   T-17 evidence_items, T-18 evidence_tracks, T-19 evidence_custody, T-20 exports
 *   core       T-21 alerts, T-22 storage_policy, T-23 console_settings, T-24 engine_counters,
 *              T-25 core_device, T-26 core_state, T-27 hardware_snapshot, T-28 health_snapshots,
 *              T-43 core_media_store (erratum PE-0013-01; ruling D166)
 *   meta       T-29 schema_meta
 *   capture    T-32 capture_devices, T-31 capture_config, T-33 capture_device_credentials,
 *              T-44 capture_device_streams, T-45 capture_audio_inputs (task 4 schema set A),
 *              T-46 capture_network_config, T-47 host_network_aliases (task 4 schema set B)
 *   recording  T-34 session_audio_intervals, T-35 recording_fragments, T-39 sealing_jobs,
 *              T-41 session_capture_sources (dbc-4 §N.3; R-9..R-11)
 *   transcript T-36 transcript_chunks, T-37 transcripts, T-38 transcript_revisions
 *   stt        T-40 stt_config (R-8, D20; Q-STT-CFG confirmed (a) at D24),
 *              T-42 session_stt_config (erratum PE-129b-01; R-8 AC-4)
 *   installation T-48 installation_acceptances (task 4 schema set C)
 *
 * ONE WRITER (P16, MG-1). Only the migration writer edits this folder and `../migrations`. A
 * change here without a new migration file is drift: `npm run db:generate -w @dems/core-server`
 * must report "No schema changes". A row that needs a schema change logs `SCHEMA-GAP-<n>`.
 *
 * SCHEMA VERSION 2 IS DECLARED HERE AND APPLIED ELSEWHERE. The nine tables, the eleven added
 * columns and the swapped CHECKs of `dbc-3` §B and §C are the typed schema of plan row 45; the
 * generated `0004_capture.sql`, the hand-written `0005_capture_privileges.sql` and the bump of
 * `DB_SCHEMA_VERSION`/`DB_CONTRACT_REVISION` in `./meta` are row 46, which also keeps this folder
 * and `../migrations` free of drift in the same commit (MG-1, MG-5). Until that commit exists the
 * constants in `./meta` still say `(1, 'dbc-2')` on purpose: they state what the migration SET
 * applies, and no live database has been migrated by row 45. Row 112 (R-8, D20/D24) adds the tenth
 * v2 table `stt_config` as the generated `0006_stt_config.sql` plus the hand-written
 * `0007_stt_config_privileges.sql`; the version constants do NOT move again — table 40 still speaks
 * `(2, 'dbc-3')`, and the `*_details_no_secret_keys_check` swap of the 28-key forbidden list rides
 * inside 0006 beside the new table.
 *
 * SCHEMA VERSION 3 (`dbc-4` §N, blueprint row 129): the generated `0008_capture_sources.sql`
 * (T-41, `capture_devices.adapter_kind`, `evidence_items.development_sources`, the partial unique
 * index on `onvif_uuid`) plus the hand-written `0009_capture_sources_privileges.sql`, which steps
 * the version to `(3, 'dbc-4')` together with the constants of `./meta` (D-DB-17).
 *
 * SCHEMA VERSION 4 (`dbc-5`; section N erratum PE-129a-01, row 129a): NOTHING in this folder's
 * tables changed. The hand-written `0010_credential_replace_privileges.sql` grants the runtime
 * role SELECT on `capture_device_credentials.device_id` (finding F-84-1) and steps the version.
 *
 * SCHEMA VERSION 5 (`dbc-6`; section N erratum PE-129b-01, row 129b): the generated
 * `0011_session_stt_config.sql` (T-42, the per-session STT snapshot, in `./stt`) plus the
 * hand-written `0012_session_stt_config_privileges.sql` (SELECT + INSERT only; the version step).
 *
 * SCHEMA VERSION 6 (`dbc-7`; section N erratum PE-0013-01; rulings D146, D162, D166): the
 * generated `0013_key_id_fault_reason_media_root.sql` (the key-id form of
 * `transcript_revisions_key_id_check`, `alerts.reason`, T-43 `core_media_store` in `./core`) plus
 * the hand-written `0014_key_id_fault_reason_media_root_privileges.sql` (the version step).
 *
 * SCHEMA VERSION 7 (`dbc-8`; schema set A of task 4, `docs/2026-10-12_input_av_core_adapter_plan/
 * masterplan/03_db_schema_extension.md` sections 2.1 to 2.3 with design addendum 1.4 #1 and 7.2):
 * the generated `0015_capture_streams_audio_inputs.sql` (T-44 and T-45 in `./capture`,
 * `session_capture_sources.source_facts` in `./recording`, the six slot columns of
 * `capture_config` nullable with `capture_config_slot_pair_check`, the value sets
 * `CAPTURE_STREAM_ROLE` and `CAPTURE_STREAM_CODEC`) plus the hand-written
 * `0016_capture_streams_audio_inputs_privileges.sql` (the grants and the version step).
 *
 * SCHEMA VERSION 8 (`dbc-9`; schema set B of task 4, the same design document sections 2.4 and
 * 2.5; plan review P12-F07): the generated `0017_network_commissioning.sql` (T-46 and T-47 in
 * `./capture`, the columns `usb_serial` and `usb_port` of `capture_audio_inputs`, the value sets
 * `HOST_ALIAS_REASON` and `HOST_ALIAS_REMOVE_REASON`) plus the hand-written
 * `0018_network_commissioning_privileges.sql` (the grants, the two stored rows of the
 * commissioning permission for a database that is already seeded, and the version step).
 *
 * SCHEMA VERSION 9 (`dbc-10`; task 4 package X-C, `docs/2026-10-12_input_av_core_adapter_plan/
 * masterplan/05_design_x1_x2.md` section 3.6; security review SX-12): the generated
 * `0019_credential_replaced_reason.sql` (the value `CREDENTIAL_REPLACED` in `SESSION_END_REASON`
 * and `BIO_REVOKE_REASON`: two CHECKs dropped and added again under their names) plus the
 * hand-written `0020_credential_replaced_reason_privileges.sql` (no grant; the version step).
 *
 * SCHEMA VERSION 10 (`dbc-11`; requirement AD-06 (4), handed over by task 4 row 51): the
 * hand-written `0021_profile_codes_data.sql` (a stored profile list that holds anything but codes
 * becomes the empty list), the generated `0022_profile_codes.sql`
 * (`capture_devices_profiles_code_check` in `./capture`) and the hand-written
 * `0023_profile_codes_privileges.sql` (no grant; the version step). Three files, because the data
 * step must run before the CHECK and a generated file is not edited by hand.
 *
 * SCHEMA VERSION 11 (`dbc-12`; schema set C of task 4, `docs/2026-10-12_input_av_core_adapter_plan/
 * masterplan/03_db_schema_extension.md` section 2.6; decisions U11 (OQ-2), C2; finding S13-13): the
 * generated `0024_installation_acceptance.sql` (T-48 `installation_acceptances` in
 * `./installation`, with the partial unique index that holds one acceptance in force) plus the
 * hand-written `0025_installation_acceptance_privileges.sql` (the grants and the version step).
 *
 * SCHEMA VERSION 12 (`dbc-13`; decisions C74 (D-2, D-3) and C83 of task 4; finding S13-10): the
 * generated `0026_alias_removal_reasons.sql` (the values `SHUTDOWN` and `NOT_ADDED` in
 * `HOST_ALIAS_REMOVE_REASON`: one CHECK dropped and added again under its name) plus the
 * hand-written `0027_alias_removal_reasons_privileges.sql` (no grant; the version step).
 *
 * SCHEMA VERSION 13 (`dbc-14`; caution R119-05 (d) of the commissioning security review, decision
 * C94 (d) of task 4; finding S13-10): the generated `0028_alias_removal_reason_unconfirmed.sql`
 * (the value `ADD_UNCONFIRMED` in `HOST_ALIAS_REMOVE_REASON`: the same CHECK dropped and added
 * again under its name) plus the hand-written
 * `0029_alias_removal_reason_unconfirmed_privileges.sql` (no grant; the version step).
 *
 * SCHEMA VERSION 14 (`dbc-15`; code reviews 120 (finding F-4) and 120b (finding S2-02) of task 4,
 * decisions C114 and C116; requirement S13-11 point 3): the generated
 * `0030_network_config_onvif_ports.sql` (the column `onvif_ports` of `capture_network_config` in
 * `./capture` with its two CHECKs, and the two interface-name CHECKs dropped and added again
 * under their names with the alias helper's own form) plus the hand-written
 * `0031_network_config_onvif_ports_privileges.sql` (the UPDATE grant on the column; the version
 * step).
 *
 * SCHEMA VERSION 15 (`dbc-16`; design 07 of task 4, retiring a capture device, decision C147):
 * the generated `0032_capture_device_retirement.sql` (`capture_devices.retired_at` / `retired_by`
 * with their foreign key and two CHECKs, `capture_audio_inputs.retired_at`, and the two identity
 * indexes `capture_devices_onvif_uuid_key` / `capture_audio_inputs_card_input_key` made partial on
 * rows in service, the second a constraint until then) plus the hand-written
 * `0033_capture_device_retirement_privileges.sql` (the UPDATE grants on the three columns, the
 * guard trigger of a retired row on both tables, the owner's credential-destroy function with its
 * EXECUTE grant; the version step).
 *
 * Not expressed here, because the tool cannot generate them: the function of `0000_prelude`,
 * the chain lock, the chain guard, the three triggers and the genesis row (`0002_audit_guards`),
 * and every privilege (`0003_privileges`, and `0005_capture_privileges` from row 46). The typed
 * schema declares no automatic `updated_at` hook (MR-8): an UPDATE names only the columns that
 * changed and that the runtime role may write.
 *
 * This folder holds no query code and no repository. The boot checks live beside it in
 * `boot-checks.ts` and the public column sets in `public-columns.ts`; neither is re-exported
 * here, so `drizzle-kit` loads table definitions only.
 */
export * from './bytea';
export * from './value-sets';
export * from './rbac';
export * from './identity';
export * from './pairing';
export * from './audit';
export * from './sessions';
export * from './evidence';
export * from './core';
export * from './meta';
export * from './capture';
export * from './recording';
export * from './transcript';
export * from './stt';
export * from './installation';
