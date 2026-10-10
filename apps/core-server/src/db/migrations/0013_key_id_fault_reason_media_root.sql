CREATE TABLE "core_media_store" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"media_root" text NOT NULL,
	"recorded_at" bigint NOT NULL,
	CONSTRAINT "core_media_store_singleton_check" CHECK ("core_media_store"."singleton"),
	CONSTRAINT "core_media_store_root_check" CHECK (char_length("core_media_store"."media_root") BETWEEN 1 AND 1024 AND "core_media_store"."media_root" ~ '^/[^[:cntrl:]]*$' AND position('://' in "core_media_store"."media_root") = 0)
);
--> statement-breakpoint
ALTER TABLE "transcript_revisions" DROP CONSTRAINT "transcript_revisions_key_id_check";--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_reason_check" CHECK ("alerts"."reason" IS NULL OR "alerts"."reason" ~ '^[A-Z][A-Z0-9_]{0,63}$');--> statement-breakpoint
ALTER TABLE "transcript_revisions" ADD CONSTRAINT "transcript_revisions_key_id_check" CHECK ("transcript_revisions"."signature_key_id" ~ '^[A-Z0-9][A-Z0-9_-]{0,63}$');