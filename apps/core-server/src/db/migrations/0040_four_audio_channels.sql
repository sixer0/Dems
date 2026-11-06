-- D61 (2026-11-04): four simultaneous audio channels — the microphone plane mirrors the video plane.
-- The two named roles become the first two channels of eight slots; the data migration renames every
-- existing source row, so sealed and in-flight sessions keep their meaning. Legacy packages are
-- untouched: they name their own track list and the verifier reads it as a prefix of the new order.
ALTER TABLE "capture_config" RENAME COLUMN "mic_primary_id" TO "mic_01_id";--> statement-breakpoint
ALTER TABLE "capture_config" RENAME COLUMN "mic_standby_id" TO "mic_02_id";--> statement-breakpoint
ALTER TABLE "capture_config" ADD COLUMN "mic_03_id" text;--> statement-breakpoint
ALTER TABLE "capture_config" ADD COLUMN "mic_04_id" text;--> statement-breakpoint
-- D61 renames the two role foreign keys with their columns (dbc-18: "two renames, two new"). A
-- column rename leaves the constraint's name alone, so say it out loud.
ALTER TABLE "capture_config" RENAME CONSTRAINT "capture_config_mic_primary_id_fkey" TO "capture_config_mic_01_id_fkey";--> statement-breakpoint
ALTER TABLE "capture_config" RENAME CONSTRAINT "capture_config_mic_standby_id_fkey" TO "capture_config_mic_02_id_fkey";--> statement-breakpoint
-- The no-doubled-device rule of the mics, pairwise over the four channels (the old check refused a
-- standby equal to the primary; NULL on either side passes, as before).
ALTER TABLE "capture_config" DROP CONSTRAINT "capture_config_mic_check";--> statement-breakpoint
ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_mic_check" CHECK (
  ((mic_01_id <> mic_02_id) AND (mic_01_id <> mic_03_id))
  AND ((mic_01_id <> mic_04_id) AND (mic_02_id <> mic_03_id))
  AND ((mic_02_id <> mic_04_id) AND (mic_03_id <> mic_04_id))
);--> statement-breakpoint
ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_mic_03_id_fkey" FOREIGN KEY ("mic_03_id") REFERENCES "capture_devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_mic_04_id_fkey" FOREIGN KEY ("mic_04_id") REFERENCES "capture_devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE "session_capture_sources" DROP CONSTRAINT "session_capture_sources_slot_check";--> statement-breakpoint
ALTER TABLE "session_capture_sources" DROP CONSTRAINT "session_capture_sources_pairing_check";--> statement-breakpoint
-- The old world's two roles join the new world's first two channels (after the widened slot check
-- lands, so the renamed rows validate; before the pairing rewrite, whose mic kinds they satisfy).
UPDATE "session_capture_sources" SET "slot" = 'MIC-01' WHERE "slot" = 'MIC-PRIMARY';--> statement-breakpoint
UPDATE "session_capture_sources" SET "slot" = 'MIC-02' WHERE "slot" = 'MIC-STANDBY';--> statement-breakpoint
-- The checks of the eight-slot world, added over the migrated rows (ADD CONSTRAINT validates what
-- is already there, so the data migration above must come first).
ALTER TABLE "session_capture_sources" ADD CONSTRAINT "session_capture_sources_slot_check" CHECK ("session_capture_sources"."slot" IN ('VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'));--> statement-breakpoint
-- The pairing rule keeps its shape (D60): a video slot takes a camera kind, a mic slot takes a
-- microphone kind; `SNMP_POE` feeds no slot.
ALTER TABLE "session_capture_sources" ADD CONSTRAINT "session_capture_sources_pairing_check" CHECK (("session_capture_sources"."slot" IN ('VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04') AND "session_capture_sources"."adapter_kind" IN ('ONVIF_RTSP', 'FAKE', 'LOCAL_DEVICE')) OR ("session_capture_sources"."slot" IN ('MIC-01', 'MIC-02', 'MIC-03', 'MIC-04') AND "session_capture_sources"."adapter_kind" IN ('USB_AUDIO', 'FAKE', 'LOCAL_DEVICE')));--> statement-breakpoint
-- The v2 session seals FOUR audio tracks beside the four video tracks: the OD-01 "one session audio
-- track" premise is superseded by D61 and `AUDIO-02` loses its legacy-only status going forward.
ALTER TABLE "evidence_tracks" DROP CONSTRAINT "evidence_tracks_track_check";--> statement-breakpoint
ALTER TABLE "evidence_tracks" ADD CONSTRAINT "evidence_tracks_track_check" CHECK ("evidence_tracks"."track_id" IN ('VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04') AND "evidence_tracks"."position" BETWEEN 1 AND 8);--> statement-breakpoint
-- The stored health series carries one level per audio channel: the two new channels join
-- every sample at the noise floor (-90 dBFS), which is what an unopened channel reads as.
UPDATE "hardware_snapshot"
   SET "health" = jsonb_set(
         "health",
         '{micLevels}',
         COALESCE((
           SELECT jsonb_agg(
                    (elem || '{"AUDIO-03": -90}'::jsonb) || '{"AUDIO-04": -90}'::jsonb
                    ORDER BY x.ord)
           FROM jsonb_array_elements("health" -> 'micLevels') WITH ORDINALITY AS x(elem, ord)
         ),
         "health" -> 'micLevels')
       )
   WHERE jsonb_typeof("health" -> 'micLevels') = 'array';--> statement-breakpoint
ALTER TABLE "evidence_items" DROP CONSTRAINT "evidence_items_tamper_check";--> statement-breakpoint
-- The hardware snapshot's mic lines follow the same renaming: the stored `micRole` of the
-- two-role era becomes the `channel` word of the numbered era (position 1 -> MIC-01, 2 ->
-- MIC-02, and so on); the member `micRole` itself dies with the failover concept.
UPDATE "hardware_snapshot"
   SET "mics" = COALESCE((
     SELECT jsonb_agg(
              jsonb_set((elem - 'micRole'), '{channel}',
                        to_jsonb(CASE (elem ->> 'micRole')
                                   WHEN 'PRIMARY' THEN 'MIC-01'
                                   WHEN 'STANDBY' THEN 'MIC-02'
                                   ELSE 'MIC-0' || (x.ord)::text
                                 END))
              ORDER BY x.ord)
     FROM jsonb_array_elements("mics") WITH ORDINALITY AS x(elem, ord)
   ), "mics");--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_tamper_check" CHECK ("evidence_items"."tampered_track_id" IS NULL OR "evidence_items"."tampered_track_id" IN ('VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'));--> statement-breakpoint
