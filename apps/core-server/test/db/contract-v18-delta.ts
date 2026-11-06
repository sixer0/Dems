/**
 * The 0044 delta of the database contract (D28 of 2026-11-05, DQ-1 = S1: the files of the four
 * microphone channels get the same fragment-hash protection as the camera files), composed after
 * the v17 delta by `contract-inventory.ts` (ruling D44 R1: a closed contract is never edited; the
 * delta lives in this app's test folder).
 *
 * Provenance, stated honestly:
 *   - decision D28 of `docs/2026-11-05_team_update_audit/decisions/decisions.md` (DQ-1 = S1), with
 *     the numbering of D29 (0044) and blueprint row 146; requirement R-DB-2 of
 *     `docs/2026-11-05_team_update_audit/masterplan/01_specs_d5.md` section 3;
 *   - the statement text is the hand-written `0044_recording_fragments_audio_tracks.sql`: the CHECK
 *     `recording_fragments_track_check` is dropped and re-added under its name with the eight
 *     tracks of `TRACK_ID` (the four camera files, then the four microphone channel files `AUDIO-01`
 *     to `AUDIO-04`), the list `evidence_tracks_track_check` has carried since 0040.
 * No table, no column, no value set, no grant; no schema version step (as 0039 to 0043, the schema
 * stays at version 15, `dbc-16`). One CHECK replaced under its name: every total stays as v17 left
 * it (50 tables, 518 columns, 237 CHECKs, 54 foreign keys with the purge amendment).
 */
import type { V2ChangedTable } from './contract-v2-delta';

const TRACK_ID = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'] as const;

const list = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');

export const V18: {
  readonly changedTables: readonly V2ChangedTable[];
} = {
  changedTables: [
    {
      name: 'recording_fragments',
      addColumns: [],
      addConstraints: [
        // Same name: the camera files and the microphone channel files (0044).
        { name: 'recording_fragments_track_check', kind: 'CHECK', definition: `"recording_fragments"."track_id" IN (${list(TRACK_ID)})` },
      ],
      dropConstraints: [],
    },
  ],
};
