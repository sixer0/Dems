/**
 * The typed schema of the DEMS Core database: 40 tables in schema `public` (database contract
 * §3.3, §4 and `dbc-3` §B; plan rows W17 and M2-W2; table 40 = T-40 `stt_config`, row 112). This
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
 *              T-25 core_device, T-26 core_state, T-27 hardware_snapshot, T-28 health_snapshots
 *   meta       T-29 schema_meta
 *   capture    T-32 capture_devices, T-31 capture_config, T-33 capture_device_credentials
 *   recording  T-34 session_audio_intervals, T-35 recording_fragments, T-39 sealing_jobs
 *   transcript T-36 transcript_chunks, T-37 transcripts, T-38 transcript_revisions
 *   stt        T-40 stt_config (R-8, D20; Q-STT-CFG confirmed (a) at D24)
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
