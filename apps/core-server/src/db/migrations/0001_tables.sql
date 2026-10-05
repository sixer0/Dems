CREATE TABLE "operator_credentials" (
	"operator_id" text PRIMARY KEY NOT NULL,
	"algorithm" text NOT NULL,
	"memory_kib" integer NOT NULL,
	"passes" integer NOT NULL,
	"parallelism" integer NOT NULL,
	"salt" "bytea" NOT NULL,
	"hash" "bytea" NOT NULL,
	"hashed_at" bigint NOT NULL,
	CONSTRAINT "operator_credentials_algorithm_check" CHECK ("operator_credentials"."algorithm" = 'argon2id'),
	CONSTRAINT "operator_credentials_params_check" CHECK ("operator_credentials"."memory_kib" >= 19456 AND "operator_credentials"."passes" >= 2 AND "operator_credentials"."parallelism" >= 1),
	CONSTRAINT "operator_credentials_lengths_check" CHECK (octet_length("operator_credentials"."salt") >= 16 AND octet_length("operator_credentials"."hash") = 32)
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"rank" text,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"initials" text NOT NULL,
	"role_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_sign_in_at" bigint,
	"role_changed_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "operators_username_key" UNIQUE("username"),
	CONSTRAINT "operators_id_check" CHECK ("operators"."id" ~ '^OPR-[0-9]{3}$'),
	CONSTRAINT "operators_username_check" CHECK ("operators"."username" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
	CONSTRAINT "operators_name_check" CHECK (char_length("operators"."name") BETWEEN 1 AND 120 AND char_length("operators"."initials") BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"sort_order" smallint NOT NULL,
	CONSTRAINT "permissions_sort_order_key" UNIQUE("sort_order"),
	CONSTRAINT "permissions_id_check" CHECK ("permissions"."id" ~ '^[A-Z][A-Z0-9_]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" text NOT NULL,
	"permission_id" text NOT NULL,
	CONSTRAINT "role_permissions_pkey" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"sort_order" smallint NOT NULL,
	CONSTRAINT "roles_sort_order_key" UNIQUE("sort_order"),
	CONSTRAINT "roles_id_check" CHECK ("roles"."id" IN ('INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'))
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"operator_id" text NOT NULL,
	"device_id" text,
	"method" text NOT NULL,
	"issued_at" bigint NOT NULL,
	"last_seen_at" bigint NOT NULL,
	"absolute_expires_at" bigint NOT NULL,
	"ended_at" bigint,
	"end_reason" text,
	CONSTRAINT "auth_sessions_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "auth_sessions_token_hash_check" CHECK (octet_length("auth_sessions"."token_hash") = 32),
	CONSTRAINT "auth_sessions_method_check" CHECK ("auth_sessions"."method" IN ('PASSWORD', 'BIOMETRIC')),
	CONSTRAINT "auth_sessions_biometric_device_check" CHECK ("auth_sessions"."method" <> 'BIOMETRIC' OR "auth_sessions"."device_id" IS NOT NULL),
	CONSTRAINT "auth_sessions_times_check" CHECK ("auth_sessions"."last_seen_at" >= "auth_sessions"."issued_at" AND "auth_sessions"."absolute_expires_at" > "auth_sessions"."issued_at" AND ("auth_sessions"."ended_at" IS NULL OR "auth_sessions"."ended_at" >= "auth_sessions"."issued_at")),
	CONSTRAINT "auth_sessions_end_check" CHECK (("auth_sessions"."ended_at" IS NULL) = ("auth_sessions"."end_reason" IS NULL)),
	CONSTRAINT "auth_sessions_end_reason_check" CHECK ("auth_sessions"."end_reason" IS NULL OR "auth_sessions"."end_reason" IN ('SIGNED_OUT', 'IDLE_EXPIRED', 'ABSOLUTE_EXPIRED', 'ROTATED', 'USER_DISABLED', 'DEVICE_REVOKED', 'DEVICE_UNPAIRED', 'TOKEN_REUSE')),
	CONSTRAINT "auth_sessions_token_reuse_check" CHECK ("auth_sessions"."end_reason" IS DISTINCT FROM 'TOKEN_REUSE' OR "auth_sessions"."method" = 'BIOMETRIC')
);
--> statement-breakpoint
CREATE TABLE "biometric_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"family_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"operator_id" text NOT NULL,
	"issued_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"used_at" bigint,
	"revoked_at" bigint,
	"revoke_reason" text,
	CONSTRAINT "biometric_tokens_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "biometric_tokens_token_hash_check" CHECK (octet_length("biometric_tokens"."token_hash") = 32),
	CONSTRAINT "biometric_tokens_times_check" CHECK ("biometric_tokens"."expires_at" > "biometric_tokens"."issued_at" AND ("biometric_tokens"."used_at" IS NULL OR "biometric_tokens"."used_at" >= "biometric_tokens"."issued_at")),
	CONSTRAINT "biometric_tokens_revoke_check" CHECK (("biometric_tokens"."revoked_at" IS NULL) = ("biometric_tokens"."revoke_reason" IS NULL) AND ("biometric_tokens"."revoke_reason" IS NULL OR "biometric_tokens"."revoke_reason" IN ('DISABLED', 'REENROLLED', 'TOKEN_REUSE', 'DEVICE_REVOKED', 'DEVICE_UNPAIRED', 'USER_DISABLED')))
);
--> statement-breakpoint
CREATE TABLE "device_credentials" (
	"device_id" text PRIMARY KEY NOT NULL,
	"current_hash" "bytea" NOT NULL,
	"next_hash" "bytea",
	"rotated_at" bigint,
	CONSTRAINT "device_credentials_current_hash_key" UNIQUE("current_hash"),
	CONSTRAINT "device_credentials_next_hash_key" UNIQUE("next_hash"),
	CONSTRAINT "device_credentials_lengths_check" CHECK (octet_length("device_credentials"."current_hash") = 32 AND ("device_credentials"."next_hash" IS NULL OR (octet_length("device_credentials"."next_hash") = 32 AND "device_credentials"."next_hash" <> "device_credentials"."current_hash")))
);
--> statement-breakpoint
CREATE TABLE "paired_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"app_version" text NOT NULL,
	"state" text NOT NULL,
	"paired_at" bigint NOT NULL,
	"paired_with_code_id" text NOT NULL,
	"last_seen_at" bigint NOT NULL,
	"revoked_at" bigint,
	"revoked_by_operator_id" text,
	"revoke_reason" text,
	"unpaired_at" bigint,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "paired_devices_paired_with_code_id_key" UNIQUE("paired_with_code_id"),
	CONSTRAINT "paired_devices_id_check" CHECK ("paired_devices"."id" ~ '^DEV-[0-9]{4,}$'),
	CONSTRAINT "paired_devices_text_check" CHECK (char_length("paired_devices"."name") BETWEEN 1 AND 60 AND char_length("paired_devices"."platform") BETWEEN 1 AND 32 AND char_length("paired_devices"."app_version") BETWEEN 1 AND 32),
	CONSTRAINT "paired_devices_state_check" CHECK ("paired_devices"."state" IN ('PAIRED', 'REVOKED', 'UNPAIRED')),
	CONSTRAINT "paired_devices_lifecycle_check" CHECK (("paired_devices"."state" = 'PAIRED' AND "paired_devices"."revoked_at" IS NULL AND "paired_devices"."revoked_by_operator_id" IS NULL AND "paired_devices"."revoke_reason" IS NULL AND "paired_devices"."unpaired_at" IS NULL) OR ("paired_devices"."state" = 'REVOKED' AND "paired_devices"."revoked_at" IS NOT NULL AND "paired_devices"."revoked_by_operator_id" IS NOT NULL AND char_length("paired_devices"."revoke_reason") BETWEEN 5 AND 500 AND "paired_devices"."unpaired_at" IS NULL) OR ("paired_devices"."state" = 'UNPAIRED' AND "paired_devices"."unpaired_at" IS NOT NULL AND "paired_devices"."revoked_at" IS NULL AND "paired_devices"."revoked_by_operator_id" IS NULL AND "paired_devices"."revoke_reason" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "pairing_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code_hash" "bytea" NOT NULL,
	"state" text NOT NULL,
	"issued_by_operator_id" text NOT NULL,
	"issued_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"failed_attempts" smallint DEFAULT 0 NOT NULL,
	"closed_at" bigint,
	"closed_by_operator_id" text,
	CONSTRAINT "pairing_codes_id_check" CHECK ("pairing_codes"."id" ~ '^PCD-[0-9]{6,}$'),
	CONSTRAINT "pairing_codes_code_hash_check" CHECK (octet_length("pairing_codes"."code_hash") = 32),
	CONSTRAINT "pairing_codes_state_check" CHECK ("pairing_codes"."state" IN ('ACTIVE', 'REDEEMED', 'CANCELLED', 'EXPIRED', 'EXHAUSTED')),
	CONSTRAINT "pairing_codes_times_check" CHECK ("pairing_codes"."expires_at" > "pairing_codes"."issued_at" AND ("pairing_codes"."closed_at" IS NULL OR "pairing_codes"."closed_at" >= "pairing_codes"."issued_at")),
	CONSTRAINT "pairing_codes_attempts_check" CHECK ("pairing_codes"."failed_attempts" BETWEEN 0 AND 5),
	CONSTRAINT "pairing_codes_closed_check" CHECK (("pairing_codes"."state" = 'ACTIVE') = ("pairing_codes"."closed_at" IS NULL) AND ("pairing_codes"."closed_by_operator_id" IS NULL OR "pairing_codes"."state" = 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "registry_counters" (
	"name" text PRIMARY KEY NOT NULL,
	"next_value" bigint NOT NULL,
	CONSTRAINT "registry_counters_name_check" CHECK ("registry_counters"."name" IN ('device', 'pairingCode')),
	CONSTRAINT "registry_counters_value_check" CHECK ("registry_counters"."next_value" >= 1)
);
--> statement-breakpoint
CREATE TABLE "audit_chain_head" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"seq" bigint NOT NULL,
	"hash" text NOT NULL,
	CONSTRAINT "audit_chain_head_singleton_check" CHECK ("audit_chain_head"."singleton"),
	CONSTRAINT "audit_chain_head_values_check" CHECK ("audit_chain_head"."seq" >= 0 AND "audit_chain_head"."hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "audit_chain_history" (
	"reset_no" bigint PRIMARY KEY NOT NULL,
	"epoch" bigint NOT NULL,
	"head_hash" text NOT NULL,
	"row_count" bigint NOT NULL,
	"first_seq" bigint NOT NULL,
	"last_seq" bigint NOT NULL,
	"reset_at" bigint NOT NULL,
	"actor_id" text,
	"reason" text NOT NULL,
	"scenario" text NOT NULL,
	CONSTRAINT "audit_chain_history_epoch_key" UNIQUE("epoch"),
	CONSTRAINT "audit_chain_history_numbers_check" CHECK ("audit_chain_history"."reset_no" >= 1 AND "audit_chain_history"."epoch" >= 0),
	CONSTRAINT "audit_chain_history_head_hash_check" CHECK ("audit_chain_history"."head_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "audit_chain_history_values_check" CHECK ("audit_chain_history"."row_count" >= 1 AND "audit_chain_history"."first_seq" >= 1 AND "audit_chain_history"."last_seq" >= "audit_chain_history"."first_seq"),
	CONSTRAINT "audit_chain_history_reason_check" CHECK ("audit_chain_history"."reason" IN ('RESET', 'SCENARIO_LOAD') AND "audit_chain_history"."scenario" IN ('idle', 'recording', 'finalizing', 'fault-demo'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"seq" bigint PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"at" bigint NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"actor_id" text,
	"message" text NOT NULL,
	"session_id" text,
	"evidence_id" text,
	"device_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL,
	CONSTRAINT "audit_log_id_key" UNIQUE("id"),
	CONSTRAINT "audit_log_prev_hash_key" UNIQUE("prev_hash"),
	CONSTRAINT "audit_log_hash_key" UNIQUE("hash"),
	CONSTRAINT "audit_log_seq_check" CHECK ("audit_log"."seq" >= 1),
	CONSTRAINT "audit_log_id_check" CHECK ("audit_log"."id" = 'AUD-' || lpad("audit_log"."seq"::text, greatest(6, length("audit_log"."seq"::text)), '0')),
	CONSTRAINT "audit_log_type_check" CHECK ("audit_log"."type" ~ '^[A-Z][A-Z0-9_]{0,63}$'),
	CONSTRAINT "audit_log_category_check" CHECK ("audit_log"."category" IN ('AUTH', 'SESSION', 'EVIDENCE', 'DEVICE', 'SECURITY', 'STORAGE', 'PAIRING', 'SYSTEM')),
	CONSTRAINT "audit_log_severity_check" CHECK ("audit_log"."severity" IN ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL')),
	CONSTRAINT "audit_log_hashes_check" CHECK ("audit_log"."prev_hash" ~ '^[0-9a-f]{64}$' AND "audit_log"."hash" ~ '^[0-9a-f]{64}$' AND "audit_log"."prev_hash" <> "audit_log"."hash"),
	CONSTRAINT "audit_log_details_flat_check" CHECK (public.dems_jsonb_is_flat("audit_log"."details")),
	CONSTRAINT "audit_log_details_no_secret_keys_check" CHECK (NOT ("audit_log"."details" ?| ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization']))
);
--> statement-breakpoint
CREATE TABLE "events" (
	"seq" bigint PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"at" bigint NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"session_id" text,
	"device_id" text,
	CONSTRAINT "events_id_key" UNIQUE("id"),
	CONSTRAINT "events_seq_check" CHECK ("events"."seq" >= 1),
	CONSTRAINT "events_id_check" CHECK ("events"."id" = 'LOG-' || lpad("events"."seq"::text, greatest(6, length("events"."seq"::text)), '0')),
	CONSTRAINT "events_type_check" CHECK ("events"."type" ~ '^[A-Z][A-Z0-9_]{0,63}$'),
	CONSTRAINT "events_category_check" CHECK ("events"."category" IN ('AUTH', 'SESSION', 'EVIDENCE', 'EXPORT', 'STORAGE', 'TIME', 'NETWORK', 'DEVICE', 'SECURITY', 'SYSTEM')),
	CONSTRAINT "events_severity_check" CHECK ("events"."severity" IN ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL')),
	CONSTRAINT "events_params_flat_check" CHECK (public.dems_jsonb_is_flat("events"."params")),
	CONSTRAINT "events_params_no_secret_keys_check" CHECK (NOT ("events"."params" ?| ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization']))
);
--> statement-breakpoint
CREATE TABLE "active_session" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"id" text NOT NULL,
	"state" text NOT NULL,
	"case_number" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_name" text NOT NULL,
	"investigator_id" text NOT NULL,
	"room" text NOT NULL,
	"profile_id" text NOT NULL,
	"input_notes" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"created_by" text,
	"armed_at" bigint,
	"started_at" bigint,
	"stopped_at" bigint,
	"stop_reason" text,
	"sealed_at" bigint,
	"marker_count" integer DEFAULT 0 NOT NULL,
	"snapshot_count" integer DEFAULT 0 NOT NULL,
	"bytes_written" bigint DEFAULT 0 NOT NULL,
	"evidence_id" text,
	"start_time_source" text,
	"stop_time_source" text,
	"precheck" jsonb NOT NULL,
	"finalization" jsonb NOT NULL,
	"timeline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fault" jsonb,
	"recovery" jsonb,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "active_session_singleton_check" CHECK ("active_session"."singleton"),
	CONSTRAINT "active_session_id_check" CHECK ("active_session"."id" ~ '^SES-[0-9]{8}-[0-9]{4}$' AND "active_session"."case_number" ~ '^LP/[0-9]{4}/[0-9]{4}-[0-9]{4}$'),
	CONSTRAINT "active_session_state_check" CHECK ("active_session"."state" IN ('CREATE', 'PRECHECK', 'ARMED', 'RECORDING', 'STOPPING', 'FINALIZING', 'SEALED', 'FAULT', 'RECOVERY')),
	CONSTRAINT "active_session_input_check" CHECK ("active_session"."subject_type" IN ('TERSANGKA', 'SAKSI', 'LAINNYA') AND "active_session"."profile_id" IN ('STANDARD_1080P25')),
	CONSTRAINT "active_session_time_source_check" CHECK (("active_session"."start_time_source" IS NULL OR "active_session"."start_time_source" IN ('GNSS', 'NTP', 'RTC')) AND ("active_session"."stop_time_source" IS NULL OR "active_session"."stop_time_source" IN ('GNSS', 'NTP', 'RTC'))),
	CONSTRAINT "active_session_counts_check" CHECK ("active_session"."marker_count" >= 0 AND "active_session"."snapshot_count" >= 0 AND "active_session"."bytes_written" >= 0),
	CONSTRAINT "active_session_json_check" CHECK (jsonb_typeof("active_session"."precheck") = 'object' AND jsonb_typeof("active_session"."finalization") = 'object' AND jsonb_typeof("active_session"."timeline") = 'array' AND jsonb_array_length("active_session"."timeline") <= 200 AND jsonb_typeof("active_session"."notes") = 'array' AND ("active_session"."fault" IS NULL OR jsonb_typeof("active_session"."fault") = 'object') AND ("active_session"."recovery" IS NULL OR jsonb_typeof("active_session"."recovery") = 'object'))
);
--> statement-breakpoint
CREATE TABLE "session_history" (
	"id" text PRIMARY KEY NOT NULL,
	"outcome" text NOT NULL,
	"case_number" text NOT NULL,
	"subject_name" text NOT NULL,
	"subject_type" text NOT NULL,
	"investigator_id" text NOT NULL,
	"room" text NOT NULL,
	"profile_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"started_at" bigint,
	"ended_at" bigint NOT NULL,
	"duration_ms" bigint NOT NULL,
	"size_bytes" bigint NOT NULL,
	"fault_kind" text,
	"start_time_source" text,
	"end_time_source" text,
	CONSTRAINT "session_history_id_check" CHECK ("session_history"."id" ~ '^SES-[0-9]{8}-[0-9]{4}$' AND "session_history"."case_number" ~ '^LP/[0-9]{4}/[0-9]{4}-[0-9]{4}$'),
	CONSTRAINT "session_history_outcome_check" CHECK ("session_history"."outcome" IN ('SEALED', 'INCOMPLETE') AND ("session_history"."fault_kind" IS NULL OR ("session_history"."outcome" = 'INCOMPLETE' AND "session_history"."fault_kind" IN ('CAMERA_LOSS', 'MIC_NO_SIGNAL', 'MIC_CLIP', 'STORAGE_LOW', 'STORAGE_FULL', 'GNSS_LOSS', 'TAMPER', 'FAN_STALL', 'POWER_FAIL', 'TPM_FAILURE', 'SECURITY_FAULT', 'AUDIT_TAMPER')))),
	CONSTRAINT "session_history_input_check" CHECK ("session_history"."subject_type" IN ('TERSANGKA', 'SAKSI', 'LAINNYA') AND "session_history"."profile_id" IN ('STANDARD_1080P25')),
	CONSTRAINT "session_history_values_check" CHECK ("session_history"."duration_ms" >= 0 AND "session_history"."size_bytes" >= 0 AND "session_history"."ended_at" >= "session_history"."created_at"),
	CONSTRAINT "session_history_time_source_check" CHECK (("session_history"."start_time_source" IS NULL OR "session_history"."start_time_source" IN ('GNSS', 'NTP', 'RTC')) AND ("session_history"."end_time_source" IS NULL OR "session_history"."end_time_source" IN ('GNSS', 'NTP', 'RTC')))
);
--> statement-breakpoint
CREATE TABLE "evidence_custody" (
	"evidence_id" text NOT NULL,
	"seq" integer NOT NULL,
	"at" bigint NOT NULL,
	"action" text NOT NULL,
	"actor_id" text,
	"detail" text,
	CONSTRAINT "evidence_custody_pkey" PRIMARY KEY("evidence_id","seq"),
	CONSTRAINT "evidence_custody_values_check" CHECK ("evidence_custody"."seq" >= 1 AND "evidence_custody"."action" ~ '^[A-Z][A-Z0-9_]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE "evidence_items" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"case_number" text NOT NULL,
	"subject_name" text NOT NULL,
	"subject_type" text NOT NULL,
	"investigator_id" text NOT NULL,
	"room" text NOT NULL,
	"profile_id" text NOT NULL,
	"recorded_at" bigint NOT NULL,
	"ended_at" bigint NOT NULL,
	"sealed_at" bigint,
	"duration_ms" bigint NOT NULL,
	"size_bytes" bigint NOT NULL,
	"status" text NOT NULL,
	"lifecycle_stage" text NOT NULL,
	"manifest_hash" text NOT NULL,
	"signature_value" text NOT NULL,
	"signature_key_id" text NOT NULL,
	"signature_algorithm" text NOT NULL,
	"signature_simulated" boolean DEFAULT true NOT NULL,
	"verification_status" text DEFAULT 'NOT_RUN' NOT NULL,
	"verification_at" bigint,
	"tampered" boolean DEFAULT false NOT NULL,
	"tampered_track_id" text,
	"case_type" text,
	"markers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"integrity_source" text,
	"start_time_source" text,
	"end_time_source" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "evidence_items_session_id_key" UNIQUE("session_id"),
	CONSTRAINT "evidence_items_id_check" CHECK ("evidence_items"."id" ~ '^EV-[0-9]{8}-[0-9]{4}$' AND "evidence_items"."case_number" ~ '^LP/[0-9]{4}/[0-9]{4}-[0-9]{4}$'),
	CONSTRAINT "evidence_items_status_check" CHECK ("evidence_items"."status" IN ('RECORDED', 'SEALED', 'EXPORTED', 'UNDER_REVIEW', 'ARCHIVED') AND "evidence_items"."lifecycle_stage" IN ('CAPTURE', 'RECORDING', 'FINALIZING', 'HASH', 'MANIFEST', 'ENCRYPT', 'SIGN', 'SEALED_LOCAL_EVIDENCE', 'AUTHORIZED_REVIEW', 'AUTHORIZED_EXPORT_TRANSFER', 'DESTINATION_VERIFICATION', 'RETENTION_ARCHIVE_DISPOSITION')),
	CONSTRAINT "evidence_items_input_check" CHECK ("evidence_items"."subject_type" IN ('TERSANGKA', 'SAKSI', 'LAINNYA') AND "evidence_items"."profile_id" IN ('STANDARD_1080P25') AND ("evidence_items"."case_type" IS NULL OR "evidence_items"."case_type" IN ('TERSANGKA', 'SAKSI', 'LAINNYA'))),
	CONSTRAINT "evidence_items_hashes_check" CHECK ("evidence_items"."manifest_hash" ~ '^[0-9a-f]{64}$' AND "evidence_items"."signature_value" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "evidence_items_signature_check" CHECK ("evidence_items"."signature_algorithm" = 'SIMULATED-SHA256' AND "evidence_items"."signature_simulated"),
	CONSTRAINT "evidence_items_verification_check" CHECK ("evidence_items"."verification_status" IN ('NOT_RUN', 'PASS', 'FAIL') AND (("evidence_items"."verification_status" = 'NOT_RUN') = ("evidence_items"."verification_at" IS NULL))),
	CONSTRAINT "evidence_items_tamper_check" CHECK ("evidence_items"."tampered_track_id" IS NULL OR "evidence_items"."tampered_track_id" IN ('VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02')),
	CONSTRAINT "evidence_items_values_check" CHECK ("evidence_items"."duration_ms" >= 0 AND "evidence_items"."size_bytes" >= 0 AND "evidence_items"."ended_at" >= "evidence_items"."recorded_at" AND ("evidence_items"."sealed_at" IS NULL OR "evidence_items"."sealed_at" >= "evidence_items"."ended_at")),
	CONSTRAINT "evidence_items_sources_check" CHECK (("evidence_items"."integrity_source" IS NULL OR "evidence_items"."integrity_source" IN ('DEMO_PACKAGE', 'SIMULATED')) AND ("evidence_items"."start_time_source" IS NULL OR "evidence_items"."start_time_source" IN ('GNSS', 'NTP', 'RTC')) AND ("evidence_items"."end_time_source" IS NULL OR "evidence_items"."end_time_source" IN ('GNSS', 'NTP', 'RTC'))),
	CONSTRAINT "evidence_items_json_check" CHECK (jsonb_typeof("evidence_items"."markers") = 'array' AND jsonb_typeof("evidence_items"."notes") = 'array')
);
--> statement-breakpoint
CREATE TABLE "evidence_tracks" (
	"evidence_id" text NOT NULL,
	"track_id" text NOT NULL,
	"position" smallint NOT NULL,
	"label" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	CONSTRAINT "evidence_tracks_pkey" PRIMARY KEY("evidence_id","track_id"),
	CONSTRAINT "evidence_tracks_evidence_id_position_key" UNIQUE("evidence_id","position"),
	CONSTRAINT "evidence_tracks_track_check" CHECK ("evidence_tracks"."track_id" IN ('VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02') AND "evidence_tracks"."position" BETWEEN 1 AND 4),
	CONSTRAINT "evidence_tracks_values_check" CHECK ("evidence_tracks"."size_bytes" >= 0 AND "evidence_tracks"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "exports" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"evidence_id" text,
	"operator_id" text NOT NULL,
	"reason" text NOT NULL,
	"destination" text NOT NULL,
	"at" bigint NOT NULL,
	CONSTRAINT "exports_id_check" CHECK ("exports"."id" ~ '^EXP-[0-9]{6}$'),
	CONSTRAINT "exports_scope_check" CHECK ("exports"."scope" IN ('EVIDENCE', 'AUDIT', 'LOGS') AND (("exports"."scope" = 'EVIDENCE') = ("exports"."evidence_id" IS NOT NULL))),
	CONSTRAINT "exports_text_check" CHECK (char_length(btrim("exports"."reason")) >= 5 AND char_length("exports"."destination") BETWEEN 1 AND 120)
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"at" bigint NOT NULL,
	"severity" text NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"resolved_at" bigint,
	"target" text,
	"params" jsonb,
	CONSTRAINT "alerts_id_check" CHECK ("alerts"."id" ~ '^ALR-[0-9]{6,}$'),
	CONSTRAINT "alerts_kind_check" CHECK ("alerts"."severity" IN ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL') AND ("alerts"."kind" = 'SYSTEM' OR "alerts"."kind" IN ('CAMERA_LOSS', 'MIC_NO_SIGNAL', 'MIC_CLIP', 'STORAGE_LOW', 'STORAGE_FULL', 'GNSS_LOSS', 'TAMPER', 'FAN_STALL', 'POWER_FAIL', 'TPM_FAILURE', 'SECURITY_FAULT', 'AUDIT_TAMPER'))),
	CONSTRAINT "alerts_params_check" CHECK ("alerts"."params" IS NULL OR public.dems_jsonb_is_flat("alerts"."params"))
);
--> statement-breakpoint
CREATE TABLE "console_settings" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"presentation_mode" boolean DEFAULT false NOT NULL,
	"time_format" text DEFAULT '24' NOT NULL,
	"notify_warnings" boolean DEFAULT true NOT NULL,
	"notify_sound" boolean DEFAULT false NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "console_settings_singleton_check" CHECK ("console_settings"."singleton"),
	CONSTRAINT "console_settings_time_format_check" CHECK ("console_settings"."time_format" IN ('24', '12'))
);
--> statement-breakpoint
CREATE TABLE "core_device" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"room" text NOT NULL,
	"product_name" text NOT NULL,
	"software_version" text NOT NULL,
	"certificate_fingerprint" text NOT NULL,
	"serial_number" text NOT NULL,
	"hardware_uuid" text NOT NULL,
	"chassis_revision" text NOT NULL,
	"som_part_revision" text NOT NULL,
	"audio_board_revision" text NOT NULL,
	"poe_board_revision" text NOT NULL,
	"power_board_revision" text NOT NULL,
	"bsp_version" text NOT NULL,
	"core_software_version" text NOT NULL,
	"tablet_app_version" text NOT NULL,
	"tpm_model_firmware" text NOT NULL,
	"camera_model_firmware" text NOT NULL,
	"provisioning_record_id" text NOT NULL,
	"device_certificate_id" text NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "core_device_singleton_check" CHECK ("core_device"."singleton")
);
--> statement-breakpoint
CREATE TABLE "core_state" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"seed" bigint NOT NULL,
	"sim_schema_version" integer NOT NULL,
	"scenario" text NOT NULL,
	"epoch" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"seeded_at" bigint NOT NULL,
	"last_reset_at" bigint,
	"last_sealed_session_id" text,
	"last_sealed_acknowledged" boolean DEFAULT true NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "core_state_singleton_check" CHECK ("core_state"."singleton"),
	CONSTRAINT "core_state_values_check" CHECK ("core_state"."scenario" IN ('idle', 'recording', 'finalizing', 'fault-demo') AND "core_state"."epoch" >= 0 AND "core_state"."sim_schema_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "engine_counters" (
	"name" text PRIMARY KEY NOT NULL,
	"next_value" bigint NOT NULL,
	CONSTRAINT "engine_counters_name_check" CHECK ("engine_counters"."name" IN ('event', 'session', 'caseNumber', 'evidence', 'item', 'export')),
	CONSTRAINT "engine_counters_value_check" CHECK ("engine_counters"."next_value" >= 1)
);
--> statement-breakpoint
CREATE TABLE "hardware_snapshot" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"sim_schema_version" integer NOT NULL,
	"tablet_link" jsonb NOT NULL,
	"active_camera_id" text NOT NULL,
	"cameras" jsonb NOT NULL,
	"mics" jsonb NOT NULL,
	"storage" jsonb NOT NULL,
	"time_status" jsonb NOT NULL,
	"network" jsonb NOT NULL,
	"security" jsonb NOT NULL,
	"services" jsonb NOT NULL,
	"health" jsonb NOT NULL,
	"other_devices" jsonb NOT NULL,
	"ports" jsonb NOT NULL,
	"faults" jsonb NOT NULL,
	"diagnostics" jsonb,
	"software_update" jsonb NOT NULL,
	"written_at" bigint NOT NULL,
	CONSTRAINT "hardware_snapshot_singleton_check" CHECK ("hardware_snapshot"."singleton"),
	CONSTRAINT "hardware_snapshot_camera_check" CHECK ("hardware_snapshot"."active_camera_id" IN ('VIDEO-01', 'VIDEO-02')),
	CONSTRAINT "hardware_snapshot_shapes_check" CHECK (jsonb_typeof("hardware_snapshot"."cameras") = 'array' AND jsonb_typeof("hardware_snapshot"."mics") = 'array' AND jsonb_typeof("hardware_snapshot"."services") = 'array' AND jsonb_typeof("hardware_snapshot"."other_devices") = 'array' AND jsonb_typeof("hardware_snapshot"."ports") = 'array' AND jsonb_typeof("hardware_snapshot"."tablet_link") = 'object' AND jsonb_typeof("hardware_snapshot"."storage") = 'object' AND jsonb_typeof("hardware_snapshot"."time_status") = 'object' AND jsonb_typeof("hardware_snapshot"."network") = 'object' AND jsonb_typeof("hardware_snapshot"."security") = 'object' AND jsonb_typeof("hardware_snapshot"."health") = 'object' AND jsonb_typeof("hardware_snapshot"."faults") = 'object' AND jsonb_typeof("hardware_snapshot"."software_update") = 'object' AND ("hardware_snapshot"."diagnostics" IS NULL OR jsonb_typeof("hardware_snapshot"."diagnostics") = 'object'))
);
--> statement-breakpoint
CREATE TABLE "health_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" bigint NOT NULL,
	"cause" text NOT NULL,
	"fault_kind" text,
	"cpu_percent" double precision NOT NULL,
	"cpu_temp_c" double precision NOT NULL,
	"storage_temp_c" double precision NOT NULL,
	"ambient_temp_c" double precision NOT NULL,
	"fan_rpm" integer NOT NULL,
	"fan_ok" boolean NOT NULL,
	"storage_state" text NOT NULL,
	"evidence_used_bytes" bigint NOT NULL,
	"time_source" text NOT NULL,
	"time_offset_ms" double precision NOT NULL,
	"security_state" text NOT NULL,
	"session_state" text,
	"active_faults" smallint NOT NULL,
	CONSTRAINT "health_snapshots_cause_check" CHECK ("health_snapshots"."cause" IN ('INTERVAL', 'FAULT_RAISED', 'FAULT_CLEARED') AND (("health_snapshots"."cause" = 'INTERVAL') = ("health_snapshots"."fault_kind" IS NULL)) AND ("health_snapshots"."fault_kind" IS NULL OR "health_snapshots"."fault_kind" IN ('CAMERA_LOSS', 'MIC_NO_SIGNAL', 'MIC_CLIP', 'STORAGE_LOW', 'STORAGE_FULL', 'GNSS_LOSS', 'TAMPER', 'FAN_STALL', 'POWER_FAIL', 'TPM_FAILURE', 'SECURITY_FAULT', 'AUDIT_TAMPER'))),
	CONSTRAINT "health_snapshots_states_check" CHECK ("health_snapshots"."storage_state" IN ('READY', 'LOW', 'FULL') AND "health_snapshots"."time_source" IN ('GNSS', 'NTP', 'RTC') AND "health_snapshots"."security_state" IN ('READY', 'FAULT') AND ("health_snapshots"."session_state" IS NULL OR "health_snapshots"."session_state" IN ('CREATE', 'PRECHECK', 'ARMED', 'RECORDING', 'STOPPING', 'FINALIZING', 'SEALED', 'FAULT', 'RECOVERY')) AND "health_snapshots"."active_faults" >= 0)
);
--> statement-breakpoint
CREATE TABLE "storage_policy" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"retention_policy" text NOT NULL,
	"retention_days" integer NOT NULL,
	"auto_archive" boolean NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "storage_policy_singleton_check" CHECK ("storage_policy"."singleton"),
	CONSTRAINT "storage_policy_values_check" CHECK ("storage_policy"."retention_policy" IN ('DAYS_30', 'DAYS_90', 'YEAR_1', 'CASE_CLOSURE') AND "storage_policy"."retention_days" BETWEEN 1 AND 3650)
);
--> statement-breakpoint
CREATE TABLE "schema_meta" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"schema_version" integer NOT NULL,
	"contract_revision" text NOT NULL,
	CONSTRAINT "schema_meta_singleton_check" CHECK ("schema_meta"."singleton" AND "schema_meta"."schema_version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "operator_credentials" ADD CONSTRAINT "operator_credentials_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."paired_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_tokens" ADD CONSTRAINT "biometric_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."paired_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_tokens" ADD CONSTRAINT "biometric_tokens_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_credentials" ADD CONSTRAINT "device_credentials_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."paired_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paired_devices" ADD CONSTRAINT "paired_devices_paired_with_code_id_fkey" FOREIGN KEY ("paired_with_code_id") REFERENCES "public"."pairing_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paired_devices" ADD CONSTRAINT "paired_devices_revoked_by_operator_id_fkey" FOREIGN KEY ("revoked_by_operator_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_issued_by_operator_id_fkey" FOREIGN KEY ("issued_by_operator_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_closed_by_operator_id_fkey" FOREIGN KEY ("closed_by_operator_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_chain_history" ADD CONSTRAINT "audit_chain_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_session" ADD CONSTRAINT "active_session_investigator_id_fkey" FOREIGN KEY ("investigator_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_session" ADD CONSTRAINT "active_session_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_history" ADD CONSTRAINT "session_history_investigator_id_fkey" FOREIGN KEY ("investigator_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_custody" ADD CONSTRAINT "evidence_custody_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_custody" ADD CONSTRAINT "evidence_custody_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."session_history"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_investigator_id_fkey" FOREIGN KEY ("investigator_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_tracks" ADD CONSTRAINT "evidence_tracks_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operators_role_id_idx" ON "operators" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_active_operator_idx" ON "auth_sessions" USING btree ("operator_id") WHERE "auth_sessions"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "auth_sessions_active_device_idx" ON "auth_sessions" USING btree ("device_id") WHERE "auth_sessions"."ended_at" IS NULL AND "auth_sessions"."device_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "auth_sessions_active_last_seen_idx" ON "auth_sessions" USING btree ("last_seen_at") WHERE "auth_sessions"."ended_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "biometric_tokens_one_live_key" ON "biometric_tokens" USING btree ("device_id","operator_id") WHERE "biometric_tokens"."used_at" IS NULL AND "biometric_tokens"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "biometric_tokens_family_id_idx" ON "biometric_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "biometric_tokens_live_operator_idx" ON "biometric_tokens" USING btree ("operator_id") WHERE "biometric_tokens"."used_at" IS NULL AND "biometric_tokens"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pairing_codes_one_active_key" ON "pairing_codes" USING btree ("state") WHERE "pairing_codes"."state" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "audit_log_category_seq_idx" ON "audit_log" USING btree ("category","seq");--> statement-breakpoint
CREATE INDEX "audit_log_type_seq_idx" ON "audit_log" USING btree ("type","seq");--> statement-breakpoint
CREATE INDEX "audit_log_actor_id_seq_idx" ON "audit_log" USING btree ("actor_id","seq") WHERE "audit_log"."actor_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_log_session_id_seq_idx" ON "audit_log" USING btree ("session_id","seq") WHERE "audit_log"."session_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_log_evidence_id_seq_idx" ON "audit_log" USING btree ("evidence_id","seq") WHERE "audit_log"."evidence_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "events_category_seq_idx" ON "events" USING btree ("category","seq");--> statement-breakpoint
CREATE INDEX "events_type_seq_idx" ON "events" USING btree ("type","seq");--> statement-breakpoint
CREATE INDEX "events_severity_seq_idx" ON "events" USING btree ("severity","seq");--> statement-breakpoint
CREATE INDEX "session_history_ended_at_idx" ON "session_history" USING btree ("ended_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "evidence_items_recorded_at_idx" ON "evidence_items" USING btree ("recorded_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "evidence_items_status_recorded_at_idx" ON "evidence_items" USING btree ("status","recorded_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "evidence_items_case_type_recorded_at_idx" ON "evidence_items" USING btree ("case_type","recorded_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "exports_evidence_id_idx" ON "exports" USING btree ("evidence_id") WHERE "exports"."evidence_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "alerts_at_idx" ON "alerts" USING btree ("at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "health_snapshots_at_idx" ON "health_snapshots" USING btree ("at");