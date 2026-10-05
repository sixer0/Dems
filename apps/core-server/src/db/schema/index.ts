/**
 * The typed schema of the DEMS Core database: 30 tables in schema `public` (database contract
 * §3.3, §4; plan row W17). This file is the entry `drizzle.config.ts` names, and what every
 * later row imports.
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
 *
 * ONE WRITER (P16, MG-1). Only the migration writer edits this folder and `../migrations`. A
 * change here without a new migration file is drift: `npm run db:generate -w @dems/core-server`
 * must report "No schema changes". A row that needs a schema change logs `SCHEMA-GAP-<n>`.
 *
 * Not expressed here, because the tool cannot generate them: the function of `0000_prelude`,
 * the chain lock, the chain guard, the three triggers and the genesis row (`0002_audit_guards`),
 * and every privilege (`0003_privileges`). The typed schema declares no automatic `updated_at`
 * hook (MR-8): an UPDATE names only the columns that changed and that the runtime role may write.
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
