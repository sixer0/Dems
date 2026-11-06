CREATE TABLE "session_stt_config" (
	"session_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"backend" text NOT NULL,
	"endpoint" text,
	"model" text NOT NULL,
	"language" text NOT NULL,
	"diarization" boolean NOT NULL,
	"credential_kind" text,
	"config_revision" bigint NOT NULL,
	"taken_at" bigint NOT NULL,
	CONSTRAINT "session_stt_config_session_check" CHECK ("session_stt_config"."session_id" ~ '^SES-[0-9]{8}-[0-9]{4}$'),
	CONSTRAINT "session_stt_config_backend_check" CHECK ("session_stt_config"."backend" IN ('omlx-server', 'cpu-local')),
	CONSTRAINT "session_stt_config_endpoint_required_check" CHECK ("session_stt_config"."backend" <> 'omlx-server' OR "session_stt_config"."endpoint" IS NOT NULL),
	CONSTRAINT "session_stt_config_endpoint_loopback_check" CHECK ("session_stt_config"."endpoint" IS NULL OR "session_stt_config"."endpoint" ~ '^http://(127\.0\.0\.1|localhost)(:[0-9]{1,5})?(/.*)?$'),
	CONSTRAINT "session_stt_config_language_check" CHECK ("session_stt_config"."language" = 'id'),
	CONSTRAINT "session_stt_config_credential_kind_check" CHECK ("session_stt_config"."credential_kind" IS NULL OR "session_stt_config"."credential_kind" IN ('REFERENCE', 'ENCRYPTED')),
	CONSTRAINT "session_stt_config_revision_check" CHECK ("session_stt_config"."config_revision" >= 1)
);
