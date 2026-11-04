-- D60 (ratified PT GSP, 2026-11-04): the Core records FOUR video tracks at once.
-- The two-track shape was written into five checks and the selector row; every one of them
-- widens here. Packages and items sealed under the two-track shape are untouched: a manifest
-- names its own track list and the verifier reads it as a prefix of the new order, so no old
-- evidence changes and no old check is weakened beyond the widening itself.
;--> statement-breakpoint
ALTER TABLE "capture_config" ADD COLUMN "video_03_device_id" text;--> statement-breakpoint
ALTER TABLE "capture_config" ADD COLUMN "video_03_profile" text;--> statement-breakpoint
ALTER TABLE "capture_config" ADD COLUMN "video_04_device_id" text;--> statement-breakpoint
ALTER TABLE "capture_config" ADD COLUMN "video_04_profile" text;--> statement-breakpoint
ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_profile_34_check" CHECK ((video_03_profile ~ '^[A-Z][A-Z0-9_]{0,63}$'::text) AND (video_04_profile ~ '^[A-Z][A-Z0-9_]{0,63}$'::text));; --> statement-breakpoint
-- The no-collision rule of the selector, pairwise over the four tracks: two tracks may share a
-- device (the dual-lens case) only when their profiles differ.
ALTER TABLE "capture_config" DROP CONSTRAINT "capture_config_selector_check";--> statement-breakpoint
ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_selector_check" CHECK (
  ((video_01_device_id <> video_02_device_id) OR (video_01_profile <> video_02_profile))
  AND ((video_01_device_id <> video_03_device_id) OR (video_01_profile <> video_03_profile))
  AND ((video_01_device_id <> video_04_device_id) OR (video_01_profile <> video_04_profile))
  AND ((video_02_device_id <> video_03_device_id) OR (video_02_profile <> video_03_profile))
  AND ((video_02_device_id <> video_04_device_id) OR (video_02_profile <> video_04_profile))
  AND ((video_03_device_id <> video_04_device_id) OR (video_03_profile <> video_04_profile))
);--> statement-breakpoint
ALTER TABLE "capture_config" DROP CONSTRAINT "capture_config_slot_pair_check";--> statement-breakpoint
ALTER TABLE "capture_config" ADD CONSTRAINT "capture_config_slot_pair_check" CHECK ((("video_01_device_id" IS NULL) = ("video_01_profile" IS NULL)) AND (("video_02_device_id" IS NULL) = ("video_02_profile" IS NULL)) AND (("video_03_device_id" IS NULL) = ("video_03_profile" IS NULL)) AND (("video_04_device_id" IS NULL) = ("video_04_profile" IS NULL)));--> statement-breakpoint
ALTER TABLE "evidence_tracks" DROP CONSTRAINT "evidence_tracks_track_check";--> statement-breakpoint
-- D60 widens the track list and the position bound: a live seal carries up to four camera files
-- plus the two microphone tracks (was BETWEEN 1 AND 4).
ALTER TABLE "evidence_tracks" ADD CONSTRAINT "evidence_tracks_track_check" CHECK ("evidence_tracks"."track_id" IN ('VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02') AND "evidence_tracks"."position" BETWEEN 1 AND 6);--> statement-breakpoint
ALTER TABLE "evidence_items" DROP CONSTRAINT "evidence_items_tamper_check";--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_tamper_check" CHECK ("evidence_items"."tampered_track_id" IS NULL OR "evidence_items"."tampered_track_id" IN ('VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02'));--> statement-breakpoint
ALTER TABLE "hardware_snapshot" DROP CONSTRAINT "hardware_snapshot_camera_check";--> statement-breakpoint
ALTER TABLE "hardware_snapshot" ADD CONSTRAINT "hardware_snapshot_camera_check" CHECK ("hardware_snapshot"."active_camera_id" IN ('VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'));--> statement-breakpoint
ALTER TABLE "recording_fragments" DROP CONSTRAINT "recording_fragments_track_check";--> statement-breakpoint
ALTER TABLE "recording_fragments" ADD CONSTRAINT "recording_fragments_track_check" CHECK ("recording_fragments"."track_id" IN ('VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'));--> statement-breakpoint
ALTER TABLE "session_capture_sources" DROP CONSTRAINT "session_capture_sources_slot_check";--> statement-breakpoint
ALTER TABLE "session_capture_sources" ADD CONSTRAINT "session_capture_sources_slot_check" CHECK ("session_capture_sources"."slot" IN ('VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-PRIMARY', 'MIC-STANDBY'));--> statement-breakpoint
ALTER TABLE "session_capture_sources" DROP CONSTRAINT "session_capture_sources_pairing_check";--> statement-breakpoint
-- D60 widens the slot list only: the adapter-kind pairing of the original check stands (the mic
-- kinds are USB_AUDIO, FAKE, LOCAL_DEVICE - as the typed schema declares them).
ALTER TABLE "session_capture_sources" ADD CONSTRAINT "session_capture_sources_pairing_check" CHECK (("session_capture_sources"."slot" IN ('VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04') AND "session_capture_sources"."adapter_kind" IN ('ONVIF_RTSP', 'FAKE', 'LOCAL_DEVICE')) OR ("session_capture_sources"."slot" IN ('MIC-PRIMARY', 'MIC-STANDBY') AND "session_capture_sources"."adapter_kind" IN ('USB_AUDIO', 'FAKE', 'LOCAL_DEVICE')));
