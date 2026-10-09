CREATE TABLE "capture_config" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"video_01_device_id" text NOT NULL,
	"video_01_profile" text NOT NULL,
	"video_02_device_id" text NOT NULL,
	"video_02_profile" text NOT NULL,
	"mic_primary_id" text NOT NULL,
	"mic_standby_id" text NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	"updated_by" text,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "capture_config_singleton_check" CHECK ("capture_config"."singleton"),
	CONSTRAINT "capture_config_profile_check" CHECK ("capture_config"."video_01_profile" ~ '^[A-Z][A-Z0-9_]{0,63}$' AND "capture_config"."video_02_profile" ~ '^[A-Z][A-Z0-9_]{0,63}$'),
	CONSTRAINT "capture_config_mic_check" CHECK ("capture_config"."mic_standby_id" <> "capture_config"."mic_primary_id"),
	CONSTRAINT "capture_config_selector_check" CHECK (("capture_config"."video_01_device_id" <> "capture_config"."video_02_device_id") OR ("capture_config"."video_01_profile" <> "capture_config"."video_02_profile")),
	CONSTRAINT "capture_config_revision_check" CHECK ("capture_config"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "capture_device_credentials" (
	"device_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"encryption" text DEFAULT 'AES-256-GCM' NOT NULL,
	"secret_ciphertext" "bytea" NOT NULL,
	"nonce" "bytea" NOT NULL,
	"key_ref" text NOT NULL,
	"rotated_at" bigint NOT NULL,
	CONSTRAINT "capture_device_credentials_username_check" CHECK (char_length("capture_device_credentials"."username") BETWEEN 1 AND 120),
	CONSTRAINT "capture_device_credentials_encryption_check" CHECK ("capture_device_credentials"."encryption" = 'AES-256-GCM'),
	CONSTRAINT "capture_device_credentials_secret_check" CHECK (octet_length("capture_device_credentials"."secret_ciphertext") >= 33),
	CONSTRAINT "capture_device_credentials_nonce_check" CHECK (octet_length("capture_device_credentials"."nonce") = 12),
	CONSTRAINT "capture_device_credentials_key_ref_check" CHECK ("capture_device_credentials"."key_ref" ~ '^[A-Z][A-Z0-9_]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE "capture_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"transport" text NOT NULL,
	"model" text,
	"firmware" text,
	"address" text,
	"mac" text,
	"onvif_uuid" text,
	"profiles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"poe_port" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_seen_at" bigint,
	CONSTRAINT "capture_devices_id_check" CHECK (("capture_devices"."kind" = 'CAMERA' AND "capture_devices"."id" ~ '^CAM-[0-9]{2,}$') OR ("capture_devices"."kind" = 'MIC' AND "capture_devices"."id" ~ '^MIC-[0-9]{2,}$') OR ("capture_devices"."kind" = 'POE' AND "capture_devices"."id" ~ '^POE-[A-Z0-9_]{2,}$')),
	CONSTRAINT "capture_devices_kind_check" CHECK ("capture_devices"."kind" IN ('CAMERA', 'MIC', 'POE')),
	CONSTRAINT "capture_devices_transport_check" CHECK ("capture_devices"."transport" ~ '^[A-Z][A-Z0-9_]{0,63}$'),
	CONSTRAINT "capture_devices_text_check" CHECK (("capture_devices"."model" IS NULL OR char_length("capture_devices"."model") BETWEEN 1 AND 120) AND ("capture_devices"."firmware" IS NULL OR char_length("capture_devices"."firmware") BETWEEN 1 AND 120) AND ("capture_devices"."address" IS NULL OR char_length("capture_devices"."address") BETWEEN 1 AND 120) AND ("capture_devices"."onvif_uuid" IS NULL OR char_length("capture_devices"."onvif_uuid") BETWEEN 1 AND 120) AND ("capture_devices"."mac" IS NULL OR "capture_devices"."mac" ~ '^[0-9A-F:]{17}$')),
	CONSTRAINT "capture_devices_profiles_check" CHECK (jsonb_typeof("capture_devices"."profiles") = 'array'),
	CONSTRAINT "capture_devices_poe_port_check" CHECK ("capture_devices"."poe_port" IS NULL OR "capture_devices"."poe_port" ~ '^[A-Z][A-Z0-9_]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE "recording_fragments" (
	"session_id" text NOT NULL,
	"track_id" text NOT NULL,
	"seq" integer NOT NULL,
	"byte_offset" bigint NOT NULL,
	"byte_length" bigint NOT NULL,
	"media_start_ms" bigint NOT NULL,
	"media_duration_ms" bigint NOT NULL,
	"sha256" text NOT NULL,
	"chain_hash" text NOT NULL,
	"durable_at" bigint NOT NULL,
	CONSTRAINT "recording_fragments_pkey" PRIMARY KEY("session_id","track_id","seq"),
	CONSTRAINT "recording_fragments_session_check" CHECK ("recording_fragments"."session_id" ~ '^SES-[0-9]{8}-[0-9]{4}$'),
	CONSTRAINT "recording_fragments_track_check" CHECK ("recording_fragments"."track_id" IN ('VIDEO-01', 'VIDEO-02')),
	CONSTRAINT "recording_fragments_seq_check" CHECK ("recording_fragments"."seq" >= 1),
	CONSTRAINT "recording_fragments_bytes_check" CHECK ("recording_fragments"."byte_offset" >= 0 AND "recording_fragments"."byte_length" >= 1),
	CONSTRAINT "recording_fragments_media_check" CHECK ("recording_fragments"."media_start_ms" >= 0 AND "recording_fragments"."media_duration_ms" >= 1),
	CONSTRAINT "recording_fragments_hashes_check" CHECK ("recording_fragments"."sha256" ~ '^[0-9a-f]{64}$' AND "recording_fragments"."chain_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "sealing_jobs" (
	"session_id" text NOT NULL,
	"step" text NOT NULL,
	"status" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"eta_ms" bigint,
	"attempt" integer DEFAULT 1 NOT NULL,
	"checkpoint" jsonb,
	"error_code" text,
	"started_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "sealing_jobs_pkey" PRIMARY KEY("session_id","step"),
	CONSTRAINT "sealing_jobs_session_check" CHECK ("sealing_jobs"."session_id" ~ '^SES-[0-9]{8}-[0-9]{4}$'),
	CONSTRAINT "sealing_jobs_step_check" CHECK ("sealing_jobs"."step" ~ '^[A-Z][A-Z0-9_]{0,63}$'),
	CONSTRAINT "sealing_jobs_status_check" CHECK ("sealing_jobs"."status" IN ('RUNNING', 'DONE', 'FAILED')),
	CONSTRAINT "sealing_jobs_progress_check" CHECK ("sealing_jobs"."progress" BETWEEN 0 AND 100),
	CONSTRAINT "sealing_jobs_eta_check" CHECK ("sealing_jobs"."eta_ms" IS NULL OR "sealing_jobs"."eta_ms" >= 0),
	CONSTRAINT "sealing_jobs_attempt_check" CHECK ("sealing_jobs"."attempt" >= 1),
	CONSTRAINT "sealing_jobs_checkpoint_check" CHECK ("sealing_jobs"."checkpoint" IS NULL OR jsonb_typeof("sealing_jobs"."checkpoint") = 'object'),
	CONSTRAINT "sealing_jobs_error_code_check" CHECK ("sealing_jobs"."error_code" IS NULL OR "sealing_jobs"."error_code" ~ '^[A-Z][A-Z0-9_]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE "session_audio_intervals" (
	"session_id" text NOT NULL,
	"seq" integer NOT NULL,
	"mic_device_id" text NOT NULL,
	"role" text NOT NULL,
	"from_media_ms" bigint NOT NULL,
	"to_media_ms" bigint,
	"from_at" bigint NOT NULL,
	"to_at" bigint,
	"switched_by" text,
	"reason" text NOT NULL,
	CONSTRAINT "session_audio_intervals_pkey" PRIMARY KEY("session_id","seq"),
	CONSTRAINT "session_audio_intervals_session_check" CHECK ("session_audio_intervals"."session_id" ~ '^SES-[0-9]{8}-[0-9]{4}$'),
	CONSTRAINT "session_audio_intervals_seq_check" CHECK ("session_audio_intervals"."seq" >= 1),
	CONSTRAINT "session_audio_intervals_role_check" CHECK ("session_audio_intervals"."role" IN ('PRIMARY', 'STANDBY')),
	CONSTRAINT "session_audio_intervals_reason_check" CHECK ("session_audio_intervals"."reason" IN ('START', 'MANUAL', 'STOP')),
	CONSTRAINT "session_audio_intervals_media_check" CHECK ("session_audio_intervals"."from_media_ms" >= 0 AND ("session_audio_intervals"."to_media_ms" IS NULL OR "session_audio_intervals"."to_media_ms" >= "session_audio_intervals"."from_media_ms")),
	CONSTRAINT "session_audio_intervals_open_check" CHECK (("session_audio_intervals"."to_media_ms" IS NULL) = ("session_audio_intervals"."to_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "transcript_chunks" (
	"session_id" text NOT NULL,
	"seq" integer NOT NULL,
	"audio_from_ms" bigint NOT NULL,
	"audio_to_ms" bigint NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"segments" jsonb,
	"embedding_ref" text,
	"model_id" text,
	"computed_at" bigint,
	CONSTRAINT "transcript_chunks_pkey" PRIMARY KEY("session_id","seq"),
	CONSTRAINT "transcript_chunks_session_check" CHECK ("transcript_chunks"."session_id" ~ '^SES-[0-9]{8}-[0-9]{4}$'),
	CONSTRAINT "transcript_chunks_seq_check" CHECK ("transcript_chunks"."seq" >= 1),
	CONSTRAINT "transcript_chunks_audio_check" CHECK ("transcript_chunks"."audio_from_ms" >= 0 AND "transcript_chunks"."audio_to_ms" > "transcript_chunks"."audio_from_ms"),
	CONSTRAINT "transcript_chunks_status_check" CHECK ("transcript_chunks"."status" IN ('PENDING', 'RUNNING', 'DONE', 'FAILED')),
	CONSTRAINT "transcript_chunks_segments_check" CHECK ("transcript_chunks"."segments" IS NULL OR jsonb_typeof("transcript_chunks"."segments") = 'array'),
	CONSTRAINT "transcript_chunks_done_check" CHECK (("transcript_chunks"."status" <> 'DONE') OR ("transcript_chunks"."segments" IS NOT NULL AND "transcript_chunks"."computed_at" IS NOT NULL)),
	CONSTRAINT "transcript_chunks_ref_check" CHECK (("transcript_chunks"."embedding_ref" IS NULL OR "transcript_chunks"."embedding_ref" ~ '^[A-Z][A-Z0-9_]{0,63}$') AND ("transcript_chunks"."model_id" IS NULL OR "transcript_chunks"."model_id" ~ '^[A-Z][A-Z0-9_]{0,63}$'))
);
--> statement-breakpoint
CREATE TABLE "transcript_revisions" (
	"evidence_id" text NOT NULL,
	"revision_no" integer NOT NULL,
	"parent_sha256" text NOT NULL,
	"sha256" text NOT NULL,
	"author_id" text NOT NULL,
	"reason" text NOT NULL,
	"signature_value" text NOT NULL,
	"signature_key_id" text NOT NULL,
	"signature_algorithm" text NOT NULL,
	"signature_simulated" boolean DEFAULT false NOT NULL,
	"signature_certificate_sha256" text,
	"created_at" bigint NOT NULL,
	CONSTRAINT "transcript_revisions_pkey" PRIMARY KEY("evidence_id","revision_no"),
	CONSTRAINT "transcript_revisions_revision_no_check" CHECK ("transcript_revisions"."revision_no" >= 1),
	CONSTRAINT "transcript_revisions_hashes_check" CHECK ("transcript_revisions"."parent_sha256" ~ '^[0-9a-f]{64}$' AND "transcript_revisions"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "transcript_revisions_reason_check" CHECK (char_length("transcript_revisions"."reason") BETWEEN 5 AND 500),
	CONSTRAINT "transcript_revisions_key_id_check" CHECK ("transcript_revisions"."signature_key_id" ~ '^[A-Z][A-Z0-9_]{0,63}$'),
	CONSTRAINT "transcript_revisions_certificate_check" CHECK ("transcript_revisions"."signature_certificate_sha256" IS NULL OR "transcript_revisions"."signature_certificate_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "transcript_revisions_signature_check" CHECK ("transcript_revisions"."signature_algorithm" IN ('Ed25519', 'SIMULATED-SHA256') AND (("transcript_revisions"."signature_algorithm" = 'SIMULATED-SHA256' AND "transcript_revisions"."signature_simulated") OR ("transcript_revisions"."signature_algorithm" IN ('Ed25519') AND NOT "transcript_revisions"."signature_simulated"))),
	CONSTRAINT "transcript_revisions_signature_value_check" CHECK (("transcript_revisions"."signature_algorithm" = 'Ed25519' AND "transcript_revisions"."signature_value" ~ '^([0-9a-f]{2}){64}$') OR ("transcript_revisions"."signature_algorithm" = 'SIMULATED-SHA256' AND "transcript_revisions"."signature_value" ~ '^([0-9a-f]{2}){32}$'))
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"evidence_id" text PRIMARY KEY NOT NULL,
	"json_sha256" text NOT NULL,
	"srt_sha256" text NOT NULL,
	"vtt_sha256" text NOT NULL,
	"model" jsonb NOT NULL,
	"diarization" jsonb NOT NULL,
	"labels_status" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "transcripts_hashes_check" CHECK ("transcripts"."json_sha256" ~ '^[0-9a-f]{64}$' AND "transcripts"."srt_sha256" ~ '^[0-9a-f]{64}$' AND "transcripts"."vtt_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "transcripts_json_check" CHECK (jsonb_typeof("transcripts"."model") = 'object' AND jsonb_typeof("transcripts"."diarization") = 'object'),
	CONSTRAINT "transcripts_labels_check" CHECK ("transcripts"."labels_status" IN ('LABELLED', 'UNAVAILABLE'))
);
--> statement-breakpoint
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_details_no_secret_keys_check";--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_params_no_secret_keys_check";--> statement-breakpoint
ALTER TABLE "active_session" DROP CONSTRAINT "active_session_json_check";--> statement-breakpoint
ALTER TABLE "session_history" DROP CONSTRAINT "session_history_outcome_check";--> statement-breakpoint
ALTER TABLE "evidence_items" DROP CONSTRAINT "evidence_items_hashes_check";--> statement-breakpoint
ALTER TABLE "evidence_items" DROP CONSTRAINT "evidence_items_signature_check";--> statement-breakpoint
ALTER TABLE "evidence_items" DROP CONSTRAINT "evidence_items_sources_check";--> statement-breakpoint
ALTER TABLE "evidence_tracks" DROP CONSTRAINT "evidence_tracks_values_check";--> statement-breakpoint
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_kind_check";--> statement-breakpoint
ALTER TABLE "health_snapshots" DROP CONSTRAINT "health_snapshots_cause_check";--> statement-breakpoint
ALTER TABLE "active_session" ADD COLUMN "started_by" text;--> statement-breakpoint
ALTER TABLE "active_session" ADD COLUMN "stopped_by" text;--> statement-breakpoint
ALTER TABLE "active_session" ADD COLUMN "capture_config" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "active_session" ADD COLUMN "audio_source" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "active_session" ADD COLUMN "transcript_status" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN "manifest_version" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN "transcript_sha256" text;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN "labels_status" text;--> statement-breakpoint
ALTER TABLE "evidence_tracks" ADD COLUMN "kind" text DEFAULT 'FILE' NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_tracks" ADD COLUMN "contains_audio" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_tracks" ADD COLUMN "codec" text;--> statement-breakpoint
ALTER TABLE "evidence_tracks" ADD COLUMN "duration_ms" bigint;--> statement-breakpoint
ALTER TABLE "evidence_tracks" ADD COLUMN "fragment_count" integer;--> statement-breakpoint
ALTER TABLE "evidence_tracks" ADD COLUMN "fragment_chain_head" text;--> statement-breakpoint
ALTER TABLE "evidence_tracks" ADD COLUMN "sha256_plain" text;--> statement-breakpoint
ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_video_01_device_id_fkey" FOREIGN KEY ("video_01_device_id") REFERENCES "public"."capture_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_video_02_device_id_fkey" FOREIGN KEY ("video_02_device_id") REFERENCES "public"."capture_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_mic_primary_id_fkey" FOREIGN KEY ("mic_primary_id") REFERENCES "public"."capture_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_mic_standby_id_fkey" FOREIGN KEY ("mic_standby_id") REFERENCES "public"."capture_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_device_credentials" ADD CONSTRAINT "capture_device_credentials_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."capture_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audio_intervals" ADD CONSTRAINT "session_audio_intervals_mic_device_id_fkey" FOREIGN KEY ("mic_device_id") REFERENCES "public"."capture_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_audio_intervals" ADD CONSTRAINT "session_audio_intervals_switched_by_fkey" FOREIGN KEY ("switched_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_revisions" ADD CONSTRAINT "transcript_revisions_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_revisions" ADD CONSTRAINT "transcript_revisions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capture_devices_kind_idx" ON "capture_devices" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "session_audio_intervals_one_open_key" ON "session_audio_intervals" USING btree ("session_id") WHERE "session_audio_intervals"."to_media_ms" IS NULL;--> statement-breakpoint
ALTER TABLE "active_session" ADD CONSTRAINT "active_session_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_session" ADD CONSTRAINT "active_session_stopped_by_fkey" FOREIGN KEY ("stopped_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_details_no_secret_keys_check" CHECK (NOT ("audit_log"."details" ?| ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization','secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl']));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_params_no_secret_keys_check" CHECK (NOT ("events"."params" ?| ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization','secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl']));--> statement-breakpoint
ALTER TABLE "active_session" ADD CONSTRAINT "active_session_json_check" CHECK (jsonb_typeof("active_session"."precheck") = 'object' AND jsonb_typeof("active_session"."finalization") = 'object' AND jsonb_typeof("active_session"."timeline") = 'array' AND jsonb_array_length("active_session"."timeline") <= 200 AND jsonb_typeof("active_session"."notes") = 'array' AND ("active_session"."fault" IS NULL OR jsonb_typeof("active_session"."fault") = 'object') AND ("active_session"."recovery" IS NULL OR jsonb_typeof("active_session"."recovery") = 'object') AND jsonb_typeof("active_session"."capture_config") = 'object' AND jsonb_typeof("active_session"."audio_source") = 'object' AND jsonb_typeof("active_session"."transcript_status") = 'object');--> statement-breakpoint
ALTER TABLE "session_history" ADD CONSTRAINT "session_history_outcome_check" CHECK ("session_history"."outcome" IN ('SEALED', 'INCOMPLETE') AND ("session_history"."fault_kind" IS NULL OR ("session_history"."outcome" = 'INCOMPLETE' AND "session_history"."fault_kind" IN ('CAMERA_LOSS', 'MIC_NO_SIGNAL', 'MIC_CLIP', 'STORAGE_LOW', 'STORAGE_FULL', 'GNSS_LOSS', 'TAMPER', 'FAN_STALL', 'POWER_FAIL', 'TPM_FAILURE', 'SECURITY_FAULT', 'AUDIT_TAMPER', 'MIC_SILENT', 'CAPTURE_FAULT'))));--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_signature_value_check" CHECK (("evidence_items"."signature_algorithm" = 'SIMULATED-SHA256' AND "evidence_items"."signature_value" ~ '^([0-9a-f]{2}){32}$') OR ("evidence_items"."signature_algorithm" = 'Ed25519' AND "evidence_items"."signature_value" ~ '^([0-9a-f]{2}){64}$') OR ("evidence_items"."signature_algorithm" = 'ECDSA-P256-SHA256' AND "evidence_items"."signature_value" ~ '^([0-9a-f]{2}){64,72}$'));--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_manifest_version_check" CHECK ("evidence_items"."manifest_version" IN (1, 2));--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_labels_check" CHECK ("evidence_items"."labels_status" IS NULL OR "evidence_items"."labels_status" IN ('LABELLED', 'UNAVAILABLE'));--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_hashes_check" CHECK ("evidence_items"."manifest_hash" ~ '^[0-9a-f]{64}$' AND ("evidence_items"."transcript_sha256" IS NULL OR "evidence_items"."transcript_sha256" ~ '^[0-9a-f]{64}$'));--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_signature_check" CHECK ("evidence_items"."signature_algorithm" IN ('SIMULATED-SHA256', 'Ed25519', 'ECDSA-P256-SHA256') AND (("evidence_items"."signature_algorithm" = 'SIMULATED-SHA256' AND "evidence_items"."signature_simulated") OR ("evidence_items"."signature_algorithm" IN ('Ed25519', 'ECDSA-P256-SHA256') AND NOT "evidence_items"."signature_simulated")));--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_sources_check" CHECK (("evidence_items"."integrity_source" IS NULL OR "evidence_items"."integrity_source" IN ('DEMO_PACKAGE', 'SIMULATED', 'REAL')) AND ("evidence_items"."start_time_source" IS NULL OR "evidence_items"."start_time_source" IN ('GNSS', 'NTP', 'RTC')) AND ("evidence_items"."end_time_source" IS NULL OR "evidence_items"."end_time_source" IN ('GNSS', 'NTP', 'RTC')));--> statement-breakpoint
ALTER TABLE "evidence_tracks" ADD CONSTRAINT "evidence_tracks_kind_check" CHECK ("evidence_tracks"."kind" IN ('FILE'));--> statement-breakpoint
ALTER TABLE "evidence_tracks" ADD CONSTRAINT "evidence_tracks_audio_check" CHECK ("evidence_tracks"."contains_audio");--> statement-breakpoint
ALTER TABLE "evidence_tracks" ADD CONSTRAINT "evidence_tracks_values_check" CHECK ("evidence_tracks"."size_bytes" >= 0 AND "evidence_tracks"."sha256" ~ '^[0-9a-f]{64}$' AND ("evidence_tracks"."codec" IS NULL OR "evidence_tracks"."codec" ~ '^[A-Z][A-Z0-9_]{0,63}$') AND ("evidence_tracks"."duration_ms" IS NULL OR "evidence_tracks"."duration_ms" >= 0) AND ("evidence_tracks"."fragment_count" IS NULL OR "evidence_tracks"."fragment_count" >= 0) AND ("evidence_tracks"."fragment_chain_head" IS NULL OR "evidence_tracks"."fragment_chain_head" ~ '^[0-9a-f]{64}$') AND ("evidence_tracks"."sha256_plain" IS NULL OR "evidence_tracks"."sha256_plain" ~ '^[0-9a-f]{64}$'));--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_kind_check" CHECK ("alerts"."severity" IN ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL') AND ("alerts"."kind" = 'SYSTEM' OR "alerts"."kind" IN ('CAMERA_LOSS', 'MIC_NO_SIGNAL', 'MIC_CLIP', 'STORAGE_LOW', 'STORAGE_FULL', 'GNSS_LOSS', 'TAMPER', 'FAN_STALL', 'POWER_FAIL', 'TPM_FAILURE', 'SECURITY_FAULT', 'AUDIT_TAMPER', 'MIC_SILENT', 'CAPTURE_FAULT')));--> statement-breakpoint
ALTER TABLE "health_snapshots" ADD CONSTRAINT "health_snapshots_cause_check" CHECK ("health_snapshots"."cause" IN ('INTERVAL', 'FAULT_RAISED', 'FAULT_CLEARED') AND (("health_snapshots"."cause" = 'INTERVAL') = ("health_snapshots"."fault_kind" IS NULL)) AND ("health_snapshots"."fault_kind" IS NULL OR "health_snapshots"."fault_kind" IN ('CAMERA_LOSS', 'MIC_NO_SIGNAL', 'MIC_CLIP', 'STORAGE_LOW', 'STORAGE_FULL', 'GNSS_LOSS', 'TAMPER', 'FAN_STALL', 'POWER_FAIL', 'TPM_FAILURE', 'SECURITY_FAULT', 'AUDIT_TAMPER', 'MIC_SILENT', 'CAPTURE_FAULT')));