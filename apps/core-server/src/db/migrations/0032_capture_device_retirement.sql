ALTER TABLE "capture_audio_inputs" DROP CONSTRAINT "capture_audio_inputs_card_input_key";--> statement-breakpoint
DROP INDEX "capture_devices_onvif_uuid_key";--> statement-breakpoint
ALTER TABLE "capture_audio_inputs" ADD COLUMN "retired_at" bigint;--> statement-breakpoint
ALTER TABLE "capture_devices" ADD COLUMN "retired_at" bigint;--> statement-breakpoint
ALTER TABLE "capture_devices" ADD COLUMN "retired_by" text;--> statement-breakpoint
ALTER TABLE "capture_devices" ADD CONSTRAINT "capture_devices_retired_by_fkey" FOREIGN KEY ("retired_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capture_audio_inputs_card_input_key" ON "capture_audio_inputs" USING btree ("card_id","card_device","input_number") WHERE "capture_audio_inputs"."retired_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "capture_devices_onvif_uuid_key" ON "capture_devices" USING btree ("onvif_uuid") WHERE "capture_devices"."onvif_uuid" IS NOT NULL AND "capture_devices"."retired_at" IS NULL;--> statement-breakpoint
ALTER TABLE "capture_devices" ADD CONSTRAINT "capture_devices_retired_check" CHECK (("capture_devices"."retired_at" IS NULL) = ("capture_devices"."retired_by" IS NULL));--> statement-breakpoint
ALTER TABLE "capture_devices" ADD CONSTRAINT "capture_devices_retired_kind_check" CHECK ("capture_devices"."retired_at" IS NULL OR "capture_devices"."kind" <> 'POE');