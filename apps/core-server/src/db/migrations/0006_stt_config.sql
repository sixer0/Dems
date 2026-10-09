CREATE TABLE "stt_config" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"backend" text NOT NULL,
	"endpoint" text,
	"model" text NOT NULL,
	"language" text DEFAULT 'id' NOT NULL,
	"diarization" boolean DEFAULT true NOT NULL,
	"credential_kind" text,
	"credential_ref" text,
	"secret_ciphertext" "bytea",
	"nonce" "bytea",
	"revision" bigint DEFAULT 1 NOT NULL,
	"updated_by" text,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "stt_config_singleton_check" CHECK ("stt_config"."singleton"),
	CONSTRAINT "stt_config_backend_check" CHECK ("stt_config"."backend" IN ('omlx-server', 'cpu-local')),
	CONSTRAINT "stt_config_endpoint_required_check" CHECK ("stt_config"."backend" <> 'omlx-server' OR "stt_config"."endpoint" IS NOT NULL),
	CONSTRAINT "stt_config_endpoint_loopback_check" CHECK ("stt_config"."endpoint" IS NULL OR "stt_config"."endpoint" ~ '^http://(127\.0\.0\.1|localhost)(:[0-9]{1,5})?(/.*)?$'),
	CONSTRAINT "stt_config_language_check" CHECK ("stt_config"."language" = 'id'),
	CONSTRAINT "stt_config_credential_kind_check" CHECK ("stt_config"."credential_kind" IS NULL OR "stt_config"."credential_kind" IN ('REFERENCE', 'ENCRYPTED')),
	CONSTRAINT "stt_config_secret_check" CHECK ("stt_config"."secret_ciphertext" IS NULL OR octet_length("stt_config"."secret_ciphertext") >= 17),
	CONSTRAINT "stt_config_nonce_check" CHECK ("stt_config"."nonce" IS NULL OR octet_length("stt_config"."nonce") = 12),
	CONSTRAINT "stt_config_credential_check" CHECK (("stt_config"."credential_kind" IS NULL AND "stt_config"."credential_ref" IS NULL AND "stt_config"."secret_ciphertext" IS NULL AND "stt_config"."nonce" IS NULL)
        OR ("stt_config"."credential_kind" = 'REFERENCE' AND "stt_config"."credential_ref" IS NOT NULL AND "stt_config"."secret_ciphertext" IS NULL AND "stt_config"."nonce" IS NULL)
        OR ("stt_config"."credential_kind" = 'ENCRYPTED' AND "stt_config"."credential_ref" IS NOT NULL AND "stt_config"."secret_ciphertext" IS NOT NULL AND "stt_config"."nonce" IS NOT NULL)),
	CONSTRAINT "stt_config_revision_check" CHECK ("stt_config"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_details_no_secret_keys_check";--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_params_no_secret_keys_check";--> statement-breakpoint
ALTER TABLE "stt_config" ADD CONSTRAINT "stt_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_details_no_secret_keys_check" CHECK (NOT ("audit_log"."details" ?| ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization','secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl','credentialRef','credentialValue','apiKey']));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_params_no_secret_keys_check" CHECK (NOT ("events"."params" ?| ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization','secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl','credentialRef','credentialValue','apiKey']));