-- D28 (DQ-1 = S1, 2026-11-05; numbered 0044 by D29) - blueprint row 146, spec S5 section 3 R-DB-2.
-- The files of the four microphone channels (AUDIO-01 to AUDIO-04) get the same fragment-hash
-- protection as the camera files: the Core stores one recording_fragments row per closed fragment
-- of a channel file, and the seal cross-checks every fragment against that row. The track CHECK
-- widens under its own name from the four video tracks of 0039 to the eight tracks of TRACK_ID
-- (the list of evidence_tracks_track_check since 0040). A widening: every stored row stays valid.
-- No column, no other rule, no grant, no schema version step (as 0039 to 0043). The table owner
-- (dems_owner) runs the ALTER; owner and grants are untouched by a constraint swap.
-- Idempotent (D22(1)): over a database that already holds the wide CHECK, the file drops and re-adds
-- the same definition.
ALTER TABLE "recording_fragments" DROP CONSTRAINT IF EXISTS "recording_fragments_track_check";
--> statement-breakpoint
ALTER TABLE "recording_fragments" ADD CONSTRAINT "recording_fragments_track_check" CHECK ("recording_fragments"."track_id" IN ('VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'));
