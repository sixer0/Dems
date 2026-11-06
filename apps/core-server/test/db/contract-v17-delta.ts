/**
 * The schema-v17 delta of the database contract (D61 of 2026-11-04, four simultaneous microphone
 * channels, contract revision `dbc-18`), composed after the v16 delta by `contract-inventory.ts`
 * (ruling D44 R1: a closed contract is never edited; the delta lives in this app's test folder).
 *
 * Provenance, stated honestly:
 *   - ruling D61 of `docs/2026-10-21_bare_metal_bench/decisions/decisions.md` (2026-11-04): the
 *     microphone plane mirrors the video plane - FOUR numbered channels MIC-01..MIC-04 replace the
 *     two roles PRIMARY/STANDBY on the selector plane; the selector is EIGHT slots;
 *   - every statement text is the hand-written `0040_four_audio_channels.sql`: the two role columns
 *     RENAME to `mic_01_id` / `mic_02_id` (the data migration keeps what a site had assigned), the
 *     pair `mic_03_id` / `mic_04_id` joins with its foreign keys, `capture_config_mic_check` becomes
 *     pairwise over the four channels, the stored source rows of every era are renamed to their
 *     channel (`UPDATE session_capture_sources SET slot = ...`), and the slot, pairing, track and
 *     tamper CHECKs widen under their names (`evidence_tracks_track_check` goes to eight tracks and
 *     the position bound 8; `evidence_items_tamper_check` to the eight);
 *   - three value sets widen in place: `TRACK_ID` (eight), `CAPTURE_SOURCE_SLOT` (eight). The two
 *     legacy roles survive only where D61 keeps the lane: `SWITCH_AUDIO_SOURCE.to`, telemetry role
 *     members and the interval records - none of them a database rule.
 * Two renamed columns, two columns, four foreign keys (two renames, two new), one CHECK re-added;
 * five CHECKs replaced under their names. The totals become 48 tables, 507 columns, 234 CHECKs,
 * 53 foreign keys.
 */
import type { V2ChangedTable } from './contract-v2-delta';

const TRACK_ID = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'] as const;
const MIC_CHANNEL = ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const;
const VIDEO_TRACK_ID = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'] as const;
const CAPTURE_SOURCE_SLOT = [...VIDEO_TRACK_ID, ...MIC_CHANNEL] as const;

const list = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');

/** A changed table of the v2 shape plus the one thing D61 needs and no earlier era did: column RENAMES (order preserved). */
export interface V17ChangedTable extends V2ChangedTable {
  readonly renameColumns?: Readonly<Record<string, string>>;
}

export const V17: {
  readonly changedTables: readonly V17ChangedTable[];
  readonly valueSets: Readonly<Record<string, readonly string[]>>;
} = {
  changedTables: [
    {
      name: 'capture_config',
      renameColumns: { mic_primary_id: 'mic_01_id', mic_standby_id: 'mic_02_id' }, // 0040: RENAME COLUMN
      addColumns: [
        { name: 'mic_03_id', type: 'text', notNull: false, default: null },
        { name: 'mic_04_id', type: 'text', notNull: false, default: null },
      ],
      addConstraints: [
        { name: 'capture_config_mic_01_id_fkey', kind: 'FOREIGN KEY', definition: '(mic_01_id) REFERENCES capture_devices (id)' }, // 0040 renames the two role fkeys
        { name: 'capture_config_mic_02_id_fkey', kind: 'FOREIGN KEY', definition: '(mic_02_id) REFERENCES capture_devices (id)' },
        { name: 'capture_config_mic_03_id_fkey', kind: 'FOREIGN KEY', definition: '(mic_03_id) REFERENCES capture_devices (id)' },
        { name: 'capture_config_mic_04_id_fkey', kind: 'FOREIGN KEY', definition: '(mic_04_id) REFERENCES capture_devices (id)' },
        {
          name: 'capture_config_mic_check', // same name: pairwise over the four channels now
          kind: 'CHECK',
          definition:
            '((\\"capture_config\\".\\"mic_01_id\\" <> \\"capture_config\\".\\"mic_02_id\\") AND (\\"capture_config\\".\\"mic_01_id\\" <> \\"capture_config\\".\\"mic_03_id\\"))' +
            ' AND ((\\"capture_config\\".\\"mic_01_id\\" <> \\"capture_config\\".\\"mic_04_id\\") AND (\\"capture_config\\".\\"mic_02_id\\" <> \\"capture_config\\".\\"mic_03_id\\"))' +
            ' AND ((\\"capture_config\\".\\"mic_02_id\\" <> \\"capture_config\\".\\"mic_04_id\\") AND (\\"capture_config\\".\\"mic_03_id\\" <> \\"capture_config\\".\\"mic_04_id\\"))',
        },
      ],
      dropConstraints: ['capture_config_mic_primary_id_fkey', 'capture_config_mic_standby_id_fkey'],
    },
    {
      name: 'evidence_tracks',
      addColumns: [],
      addConstraints: [
        // Same name: eight tracks (four video, four numbered audio channels) and the position bound 8 (0040).
        { name: 'evidence_tracks_track_check', kind: 'CHECK', definition: `track_id IN (${list(TRACK_ID)}) AND position BETWEEN 1 AND 8` },
      ],
      dropConstraints: [],
    },
    {
      name: 'evidence_items',
      addColumns: [],
      addConstraints: [
        { name: 'evidence_items_tamper_check', kind: 'CHECK', definition: `\\"evidence_items\\".\\"tampered_track_id\\" IS NULL OR \\"evidence_items\\".\\"tampered_track_id\\" IN (${list(TRACK_ID)})` },
      ],
      dropConstraints: [],
    },
    {
      name: 'session_capture_sources',
      addColumns: [],
      addConstraints: [
        { name: 'session_capture_sources_slot_check', kind: 'CHECK', definition: `\\"session_capture_sources\\".\\"slot\\" IN (${list(CAPTURE_SOURCE_SLOT)})` },
        {
          name: 'session_capture_sources_pairing_check',
          kind: 'CHECK',
          definition:
            `(\\"session_capture_sources\\".\\"slot\\" IN (${list(VIDEO_TRACK_ID)}) AND \\"session_capture_sources\\".\\"adapter_kind\\" IN ('ONVIF_RTSP', 'FAKE', 'LOCAL_DEVICE'))` +
            ` OR (\\"session_capture_sources\\".\\"slot\\" IN (${list(MIC_CHANNEL)}) AND \\"session_capture_sources\\".\\"adapter_kind\\" IN ('USB_AUDIO', 'FAKE', 'LOCAL_DEVICE'))`,
        },
      ],
      dropConstraints: [],
    },
  ],
  valueSets: {
    TRACK_ID: [...TRACK_ID],
    CAPTURE_SOURCE_SLOT: [...CAPTURE_SOURCE_SLOT],
  },
};
