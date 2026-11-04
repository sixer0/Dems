/**
 * The schema-v16 delta of the database contract (D60, four simultaneous video tracks, contract
 * revision `dbc-17`), composed after the v15 delta by `contract-inventory.ts` (ruling D44 R1: a
 * closed contract is never edited; the delta lives in this app's test folder).
 *
 * Provenance, stated honestly:
 *   - ruling D60 of `docs/2026-10-21_bare_metal_bench/decisions/decisions.md` (2026-11-04): the
 *     Core records FOUR video tracks VIDEO-01..VIDEO-04 at once (was two); the selector is SIX
 *     slots; `capture_config` gains the `video_03` / `video_04` pair with the collision rule
 *     pairwise over the four tracks; the five DB track CHECKs widen
 *     (`evidence_tracks_track_check`, `evidence_items_tamper_check`, `hardware_snapshot_camera_check`,
 *     `recording_fragments_track_check`, `session_capture_sources_slot_check` and `_pairing_check`);
 *   - every statement text is the hand-written `0039_four_video_tracks.sql`. The re-added CHECKs keep
 *     their names - the composer replaces a constraint of the same name. The widening touches no
 *     other rule: the position bound of `evidence_tracks_track_check` goes 4 -> 6 (a live seal carries
 *     up to four camera files plus the two microphone tracks) and the adapter-kind pairing of
 *     `session_capture_sources_pairing_check` stands as before.
 * Four columns, two foreign keys, one CHECK (`capture_config_profile_34_check`); three value sets
 * widen in place. The totals become 48 tables, 505 columns, 234 CHECKs, 51 foreign keys, 48
 * primary keys, 15 unique constraints, 8 unique indexes, 24 indexes, 48 value sets.
 */
import type { V2ChangedTable } from './contract-v2-delta';

const TRACK_ID = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02'] as const;
const VIDEO_TRACK_ID = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'] as const;
const CAPTURE_SOURCE_SLOT = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-PRIMARY', 'MIC-STANDBY'] as const;

const list = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');

export const V16: {
  readonly changedTables: readonly V2ChangedTable[];
  readonly valueSets: Readonly<Record<string, readonly string[]>>;
} = {
  changedTables: [
    {
      name: 'capture_config',
      addColumns: [
        { name: 'video_03_device_id', type: 'text', notNull: false, default: null },
        { name: 'video_03_profile', type: 'text', notNull: false, default: null },
        { name: 'video_04_device_id', type: 'text', notNull: false, default: null },
        { name: 'video_04_profile', type: 'text', notNull: false, default: null },
      ],
      addConstraints: [
        { name: 'capture_config_video_03_device_id_fkey', kind: 'FOREIGN KEY', definition: '(video_03_device_id) REFERENCES capture_devices (id)' },
        { name: 'capture_config_video_04_device_id_fkey', kind: 'FOREIGN KEY', definition: '(video_04_device_id) REFERENCES capture_devices (id)' },
        {
          name: 'capture_config_profile_34_check',
          kind: 'CHECK',
          definition: "\"capture_config\".\"video_03_profile\" ~ '^[A-Z][A-Z0-9_]{0,63}$' AND \"capture_config\".\"video_04_profile\" ~ '^[A-Z][A-Z0-9_]{0,63}$'",
        },
        // Same names, the pairwise widening of D60: the composer replaces them.
        {
          name: 'capture_config_selector_check',
          kind: 'CHECK',
          definition:
            '(("capture_config"."video_01_device_id" <> "capture_config"."video_02_device_id") OR ("capture_config"."video_01_profile" <> "capture_config"."video_02_profile"))' +
            ' AND (("capture_config"."video_01_device_id" <> "capture_config"."video_03_device_id") OR ("capture_config"."video_01_profile" <> "capture_config"."video_03_profile"))' +
            ' AND (("capture_config"."video_01_device_id" <> "capture_config"."video_04_device_id") OR ("capture_config"."video_01_profile" <> "capture_config"."video_04_profile"))' +
            ' AND (("capture_config"."video_02_device_id" <> "capture_config"."video_03_device_id") OR ("capture_config"."video_02_profile" <> "capture_config"."video_03_profile"))' +
            ' AND (("capture_config"."video_02_device_id" <> "capture_config"."video_04_device_id") OR ("capture_config"."video_02_profile" <> "capture_config"."video_04_profile"))' +
            ' AND (("capture_config"."video_03_device_id" <> "capture_config"."video_04_device_id") OR ("capture_config"."video_03_profile" <> "capture_config"."video_04_profile"))',
        },
        {
          name: 'capture_config_slot_pair_check',
          kind: 'CHECK',
          definition:
            '(("capture_config"."video_01_device_id" IS NULL) = ("capture_config"."video_01_profile" IS NULL))' +
            ' AND (("capture_config"."video_02_device_id" IS NULL) = ("capture_config"."video_02_profile" IS NULL))' +
            ' AND (("capture_config"."video_03_device_id" IS NULL) = ("capture_config"."video_03_profile" IS NULL))' +
            ' AND (("capture_config"."video_04_device_id" IS NULL) = ("capture_config"."video_04_profile" IS NULL))',
        },
      ],
      dropConstraints: [],
    },
    {
      name: 'evidence_tracks',
      addColumns: [],
      addConstraints: [
        // Same name: the track list widens to six and the position bound to six rows (0039, D60).
        { name: 'evidence_tracks_track_check', kind: 'CHECK', definition: `track_id IN (${list(TRACK_ID)}) AND position BETWEEN 1 AND 6` },
      ],
      dropConstraints: [],
    },
    {
      name: 'evidence_items',
      addColumns: [],
      addConstraints: [
        { name: 'evidence_items_tamper_check', kind: 'CHECK', definition: `tampered_track_id IS NULL OR tampered_track_id IN (${list(TRACK_ID)})` },
      ],
      dropConstraints: [],
    },
    {
      name: 'hardware_snapshot',
      addColumns: [],
      addConstraints: [
        { name: 'hardware_snapshot_camera_check', kind: 'CHECK', definition: `active_camera_id IN (${list(VIDEO_TRACK_ID)})` },
      ],
      dropConstraints: [],
    },
    {
      name: 'recording_fragments',
      addColumns: [],
      addConstraints: [
        { name: 'recording_fragments_track_check', kind: 'CHECK', definition: `"recording_fragments"."track_id" IN (${list(VIDEO_TRACK_ID)})` },
      ],
      dropConstraints: [],
    },
    {
      name: 'session_capture_sources',
      addColumns: [],
      addConstraints: [
        { name: 'session_capture_sources_slot_check', kind: 'CHECK', definition: `"session_capture_sources"."slot" IN (${list(CAPTURE_SOURCE_SLOT)})` },
        // Same name: the slot list widens to four video slots, the adapter-kind pairing stands (0039).
        {
          name: 'session_capture_sources_pairing_check',
          kind: 'CHECK',
          definition:
            `("session_capture_sources"."slot" IN (${list(VIDEO_TRACK_ID)}) AND "session_capture_sources"."adapter_kind" IN ('ONVIF_RTSP', 'FAKE', 'LOCAL_DEVICE'))` +
            ` OR ("session_capture_sources"."slot" IN ('MIC-PRIMARY', 'MIC-STANDBY') AND "session_capture_sources"."adapter_kind" IN ('USB_AUDIO', 'FAKE', 'LOCAL_DEVICE'))`,
        },
      ],
      dropConstraints: [],
    },
  ],
  valueSets: {
    TRACK_ID: [...TRACK_ID],
    VIDEO_TRACK_ID: [...VIDEO_TRACK_ID],
    CAPTURE_SOURCE_SLOT: [...CAPTURE_SOURCE_SLOT],
  },
};
