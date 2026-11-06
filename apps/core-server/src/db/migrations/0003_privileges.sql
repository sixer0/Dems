-- Custom SQL migration file, put your code below! --
-- 0003_privileges (hand-written; database contract 8.2 order 4, text of 8.3; matrix of 7.3).
--
-- Least privilege for the runtime role dems_app. No statement names the owner role: ownership
-- comes from the role that applies the set (MG-9). dems_app must exist before this file runs
-- (OW-8); both project roles are created at provisioning.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO dems_app;
--> statement-breakpoint

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, dems_app;
--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
--> statement-breakpoint

GRANT SELECT ON ALL TABLES IN SCHEMA public TO dems_app;
--> statement-breakpoint

GRANT INSERT ON
  auth_sessions, pairing_codes, paired_devices, device_credentials, biometric_tokens,
  audit_log, events, active_session, session_history, evidence_items, evidence_tracks,
  evidence_custody, exports, alerts, engine_counters, health_snapshots
TO dems_app;
--> statement-breakpoint
-- audit_chain_history is not in this list: the runtime role has SELECT only on it (CONFLICT-1,
-- decided by D18). Its rows are inserted by the reset routine, which runs as the owner.

GRANT UPDATE (role_id, enabled, last_sign_in_at, role_changed_at, updated_at) ON operators TO dems_app;
--> statement-breakpoint
GRANT UPDATE (algorithm, memory_kib, passes, parallelism, salt, hash, hashed_at) ON operator_credentials TO dems_app;
--> statement-breakpoint
GRANT UPDATE (last_seen_at, ended_at, end_reason) ON auth_sessions TO dems_app;
--> statement-breakpoint
GRANT UPDATE (state, failed_attempts, closed_at, closed_by_operator_id) ON pairing_codes TO dems_app;
--> statement-breakpoint
GRANT UPDATE (state, last_seen_at, revoked_at, revoked_by_operator_id, revoke_reason, unpaired_at, updated_at) ON paired_devices TO dems_app;
--> statement-breakpoint
GRANT UPDATE (current_hash, next_hash, rotated_at) ON device_credentials TO dems_app;
--> statement-breakpoint
GRANT UPDATE (used_at, revoked_at, revoke_reason) ON biometric_tokens TO dems_app;
--> statement-breakpoint
GRANT UPDATE (next_value) ON registry_counters, engine_counters TO dems_app;
--> statement-breakpoint
GRANT UPDATE, DELETE ON active_session TO dems_app;
--> statement-breakpoint
GRANT UPDATE (status, lifecycle_stage, verification_status, verification_at, tampered, tampered_track_id, updated_at) ON evidence_items TO dems_app;
--> statement-breakpoint
GRANT UPDATE (active, acknowledged, resolved_at) ON alerts TO dems_app;
--> statement-breakpoint
GRANT UPDATE (retention_policy, retention_days, auto_archive, updated_at) ON storage_policy TO dems_app;
--> statement-breakpoint
GRANT UPDATE (presentation_mode, time_format, notify_warnings, notify_sound, updated_at) ON console_settings TO dems_app;
--> statement-breakpoint
GRANT UPDATE (software_version, core_software_version, updated_at) ON core_device TO dems_app;
--> statement-breakpoint
GRANT UPDATE (epoch, last_sealed_session_id, last_sealed_acknowledged, updated_at) ON core_state TO dems_app;
--> statement-breakpoint
GRANT UPDATE (tablet_link, active_camera_id, cameras, mics, storage, time_status, network, security,
              services, health, other_devices, ports, faults, diagnostics, software_update, written_at)
  ON hardware_snapshot TO dems_app;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.dems_jsonb_is_flat(jsonb) TO dems_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.audit_chain_lock() TO dems_app;
--> statement-breakpoint

INSERT INTO public.schema_meta (singleton, schema_version, contract_revision)
VALUES (true, 1, 'dbc-2');
