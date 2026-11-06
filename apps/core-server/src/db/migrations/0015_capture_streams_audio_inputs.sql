CREATE TABLE "capture_audio_inputs" (
	"device_id" text PRIMARY KEY NOT NULL,
	"usb_id" text,
	"card_id" text NOT NULL,
	"card_device" smallint DEFAULT 0 NOT NULL,
	"input_number" smallint NOT NULL,
	"native_channels" smallint NOT NULL,
	"sample_rate" integer DEFAULT 48000 NOT NULL,
	"sample_bits" smallint DEFAULT 24 NOT NULL,
	"updated_by" text,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "capture_audio_inputs_card_input_key" UNIQUE("card_id","card_device","input_number"),
	CONSTRAINT "capture_audio_inputs_device_id_check" CHECK ("capture_audio_inputs"."device_id" ~ '^MIC-[0-9]{2,}$'),
	CONSTRAINT "capture_audio_inputs_usb_id_check" CHECK ("capture_audio_inputs"."usb_id" IS NULL OR "capture_audio_inputs"."usb_id" ~ '^[0-9a-f]{4}:[0-9a-f]{4}$'),
	CONSTRAINT "capture_audio_inputs_card_check" CHECK ("capture_audio_inputs"."card_id" ~ '^[A-Za-z0-9_]{1,32}$' AND "capture_audio_inputs"."card_device" BETWEEN 0 AND 31),
	CONSTRAINT "capture_audio_inputs_input_check" CHECK ("capture_audio_inputs"."input_number" BETWEEN 1 AND 64 AND "capture_audio_inputs"."native_channels" BETWEEN 1 AND 64 AND "capture_audio_inputs"."input_number" <= "capture_audio_inputs"."native_channels"),
	CONSTRAINT "capture_audio_inputs_sample_rate_check" CHECK ("capture_audio_inputs"."sample_rate" = 48000),
	CONSTRAINT "capture_audio_inputs_sample_bits_check" CHECK ("capture_audio_inputs"."sample_bits" IN (16, 24, 32))
);
--> statement-breakpoint
CREATE TABLE "capture_device_streams" (
	"device_id" text NOT NULL,
	"profile" text NOT NULL,
	"onvif_profile_token" text NOT NULL,
	"video_source_token" text,
	"lens" smallint DEFAULT 1 NOT NULL,
	"stream_role" text NOT NULL,
	"codec" text,
	"width" integer,
	"height" integer,
	"read_at" bigint NOT NULL,
	CONSTRAINT "capture_device_streams_pkey" PRIMARY KEY("device_id","profile"),
	CONSTRAINT "capture_device_streams_device_id_check" CHECK ("capture_device_streams"."device_id" ~ '^CAM-[0-9]{2,}$'),
	CONSTRAINT "capture_device_streams_profile_check" CHECK ("capture_device_streams"."profile" ~ '^[A-Z][A-Z0-9_]{0,63}$'),
	CONSTRAINT "capture_device_streams_token_check" CHECK ("capture_device_streams"."onvif_profile_token" ~ '^[A-Za-z0-9_.:-]{1,64}$' AND ("capture_device_streams"."video_source_token" IS NULL OR "capture_device_streams"."video_source_token" ~ '^[A-Za-z0-9_.:-]{1,64}$')),
	CONSTRAINT "capture_device_streams_lens_check" CHECK ("capture_device_streams"."lens" BETWEEN 1 AND 4),
	CONSTRAINT "capture_device_streams_stream_role_check" CHECK ("capture_device_streams"."stream_role" IN ('MAIN', 'SUB')),
	CONSTRAINT "capture_device_streams_codec_check" CHECK ("capture_device_streams"."codec" IS NULL OR "capture_device_streams"."codec" IN ('H264', 'HEVC', 'OTHER')),
	CONSTRAINT "capture_device_streams_size_check" CHECK (("capture_device_streams"."width" IS NULL AND "capture_device_streams"."height" IS NULL) OR ("capture_device_streams"."width" IS NOT NULL AND "capture_device_streams"."height" IS NOT NULL AND "capture_device_streams"."width" BETWEEN 1 AND 16384 AND "capture_device_streams"."height" BETWEEN 1 AND 16384))
);
--> statement-breakpoint
ALTER TABLE "capture_config" ALTER COLUMN "video_01_device_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "capture_config" ALTER COLUMN "video_01_profile" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "capture_config" ALTER COLUMN "video_02_device_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "capture_config" ALTER COLUMN "video_02_profile" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "capture_config" ALTER COLUMN "mic_primary_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "capture_config" ALTER COLUMN "mic_standby_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "session_capture_sources" ADD COLUMN "source_facts" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "capture_audio_inputs" ADD CONSTRAINT "capture_audio_inputs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."capture_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_audio_inputs" ADD CONSTRAINT "capture_audio_inputs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_device_streams" ADD CONSTRAINT "capture_device_streams_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."capture_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capture_device_streams_device_lens_role_idx" ON "capture_device_streams" USING btree ("device_id","lens","stream_role");--> statement-breakpoint
ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_slot_pair_check" CHECK ((("capture_config"."video_01_device_id" IS NULL) = ("capture_config"."video_01_profile" IS NULL)) AND (("capture_config"."video_02_device_id" IS NULL) = ("capture_config"."video_02_profile" IS NULL)));--> statement-breakpoint
ALTER TABLE "session_capture_sources" ADD CONSTRAINT "session_capture_sources_source_facts_flat_check" CHECK (public.dems_jsonb_is_flat("session_capture_sources"."source_facts"));--> statement-breakpoint
ALTER TABLE "session_capture_sources" ADD CONSTRAINT "session_capture_sources_source_facts_no_secret_keys_check" CHECK (NOT ("session_capture_sources"."source_facts" ?| ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization','secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl','credentialRef','credentialValue','apiKey']));--> statement-breakpoint
ALTER TABLE "session_capture_sources" ADD CONSTRAINT "session_capture_sources_source_facts_bound_check" CHECK (octet_length("session_capture_sources"."source_facts"::text) <= 2048 AND NOT jsonb_path_exists("session_capture_sources"."source_facts", '$.*?(@.type() == "string" && !(@ like_regex "^[^[:cntrl:]]{0,120}$"))'));