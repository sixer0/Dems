/**
 * The schema-v7 delta of the database contract (schema set A of task 4, contract revision
 * `dbc-8`), composed after the v6 delta by `contract-inventory.ts` (ruling D44 R1: a closed
 * contract is never edited; the delta lives in this app's test folder).
 *
 * Provenance, stated honestly:
 *   - tables T-44 `capture_device_streams` and T-45 `capture_audio_inputs`, the column
 *     `session_capture_sources.source_facts` - names, types, nullability and defaults from the
 *     column tables of `docs/2026-10-12_input_av_core_adapter_plan/masterplan/
 *     03_db_schema_extension.md` sections 2.1, 2.2 and 2.3;
 *   - the plain index on (device, lens, role) instead of the unique constraint of section 2.1:
 *     design addendum `04_design_addendum.md` section 7.2 (erratum E-A3);
 *   - the six slot columns of `capture_config` nullable and `capture_config_slot_pair_check`:
 *     design addendum section 1.4 #1 (erratum E-A1; decisions C14);
 *   - the bound on `source_facts`: security item S13-13 ("no free JSON": a forbidden key and an
 *     oversized body are refused);
 *   - every constraint definition is the statement text of the generated
 *     `0015_capture_streams_audio_inputs.sql`;
 *   - the two value sets: section 2.1 (`CAPTURE_STREAM_ROLE`; `CAPTURE_STREAM_CODEC` in the words
 *     of `MediaProfile.codec`), server-native.
 * This is the first delta that changes the NULLABILITY of an existing column, so it carries one
 * member the earlier deltas do not have: `nullableColumns`.
 * Independence as before: `catalog.db.test.ts` compares the composed inventory with the LIVE
 * catalog built from the migration SQL, `contract-inventory.test.ts` with the TYPED SCHEMA.
 * Totals after the composition: 45 tables, 461 columns, 199 CHECKs, 43 foreign keys, 45 primary
 * keys, 16 unique constraints, 4 unique indexes, 24 indexes, 46 value sets.
 */
import type { V2ChangedTable, V2NewTable } from './contract-v2-delta';

const NO_SECRET_KEYS =
  "ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization','secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl','credentialRef','credentialValue','apiKey']";

export const V7: {
  readonly newTables: readonly V2NewTable[];
  readonly changedTables: readonly V2ChangedTable[];
  /** Columns of an existing table that lose NOT NULL (`ALTER COLUMN ... DROP NOT NULL`). */
  readonly nullableColumns: readonly { readonly table: string; readonly columns: readonly string[] }[];
  readonly valueSets: Readonly<Record<string, readonly string[]>>;
} = {
  newTables: [
    {
      id: 'T-44',
      name: 'capture_device_streams',
      columns: [
        { name: 'device_id', type: 'text', notNull: true, default: null },
        { name: 'profile', type: 'text', notNull: true, default: null },
        { name: 'onvif_profile_token', type: 'text', notNull: true, default: null },
        { name: 'video_source_token', type: 'text', notNull: false, default: null },
        { name: 'lens', type: 'smallint', notNull: true, default: '1' },
        { name: 'stream_role', type: 'text', notNull: true, default: null },
        { name: 'codec', type: 'text', notNull: false, default: null },
        { name: 'width', type: 'integer', notNull: false, default: null },
        { name: 'height', type: 'integer', notNull: false, default: null },
        { name: 'read_at', type: 'bigint', notNull: true, default: null },
      ],
      constraints: [
        { name: 'capture_device_streams_pkey', kind: 'PRIMARY KEY', definition: '(device_id, profile)' },
        { name: 'capture_device_streams_device_id_fkey', kind: 'FOREIGN KEY', definition: '(device_id) REFERENCES capture_devices (id)' },
        { name: 'capture_device_streams_device_lens_role_idx', kind: 'INDEX', definition: '(device_id, lens, stream_role)' },
        { name: 'capture_device_streams_device_id_check', kind: 'CHECK', definition: '"capture_device_streams"."device_id" ~ \'^CAM-[0-9]{2,}$\'' },
        { name: 'capture_device_streams_profile_check', kind: 'CHECK', definition: '"capture_device_streams"."profile" ~ \'^[A-Z][A-Z0-9_]{0,63}$\'' },
        {
          name: 'capture_device_streams_token_check',
          kind: 'CHECK',
          definition:
            '"capture_device_streams"."onvif_profile_token" ~ \'^[A-Za-z0-9_.:-]{1,64}$\' AND ("capture_device_streams"."video_source_token" IS NULL OR "capture_device_streams"."video_source_token" ~ \'^[A-Za-z0-9_.:-]{1,64}$\')',
        },
        { name: 'capture_device_streams_lens_check', kind: 'CHECK', definition: '"capture_device_streams"."lens" BETWEEN 1 AND 4' },
        { name: 'capture_device_streams_stream_role_check', kind: 'CHECK', definition: '"capture_device_streams"."stream_role" IN (\'MAIN\', \'SUB\')' },
        {
          name: 'capture_device_streams_codec_check',
          kind: 'CHECK',
          definition: '"capture_device_streams"."codec" IS NULL OR "capture_device_streams"."codec" IN (\'H264\', \'HEVC\', \'OTHER\')',
        },
        {
          name: 'capture_device_streams_size_check',
          kind: 'CHECK',
          definition:
            '("capture_device_streams"."width" IS NULL AND "capture_device_streams"."height" IS NULL) OR ("capture_device_streams"."width" IS NOT NULL AND "capture_device_streams"."height" IS NOT NULL AND "capture_device_streams"."width" BETWEEN 1 AND 16384 AND "capture_device_streams"."height" BETWEEN 1 AND 16384)',
        },
      ],
    },
    {
      id: 'T-45',
      name: 'capture_audio_inputs',
      columns: [
        { name: 'device_id', type: 'text', notNull: true, default: null },
        { name: 'usb_id', type: 'text', notNull: false, default: null },
        { name: 'card_id', type: 'text', notNull: true, default: null },
        { name: 'card_device', type: 'smallint', notNull: true, default: '0' },
        { name: 'input_number', type: 'smallint', notNull: true, default: null },
        { name: 'native_channels', type: 'smallint', notNull: true, default: null },
        { name: 'sample_rate', type: 'integer', notNull: true, default: '48000' },
        { name: 'sample_bits', type: 'smallint', notNull: true, default: '24' },
        { name: 'updated_by', type: 'text', notNull: false, default: null },
        { name: 'updated_at', type: 'bigint', notNull: true, default: null },
      ],
      constraints: [
        { name: 'capture_audio_inputs_pkey', kind: 'PRIMARY KEY', definition: '(device_id)' },
        { name: 'capture_audio_inputs_device_id_fkey', kind: 'FOREIGN KEY', definition: '(device_id) REFERENCES capture_devices (id)' },
        { name: 'capture_audio_inputs_updated_by_fkey', kind: 'FOREIGN KEY', definition: '(updated_by) REFERENCES operators (id)' },
        { name: 'capture_audio_inputs_card_input_key', kind: 'UNIQUE', definition: '(card_id, card_device, input_number)' },
        { name: 'capture_audio_inputs_device_id_check', kind: 'CHECK', definition: '"capture_audio_inputs"."device_id" ~ \'^MIC-[0-9]{2,}$\'' },
        {
          name: 'capture_audio_inputs_usb_id_check',
          kind: 'CHECK',
          definition: '"capture_audio_inputs"."usb_id" IS NULL OR "capture_audio_inputs"."usb_id" ~ \'^[0-9a-f]{4}:[0-9a-f]{4}$\'',
        },
        {
          name: 'capture_audio_inputs_card_check',
          kind: 'CHECK',
          definition: '"capture_audio_inputs"."card_id" ~ \'^[A-Za-z0-9_]{1,32}$\' AND "capture_audio_inputs"."card_device" BETWEEN 0 AND 31',
        },
        {
          name: 'capture_audio_inputs_input_check',
          kind: 'CHECK',
          definition:
            '"capture_audio_inputs"."input_number" BETWEEN 1 AND 64 AND "capture_audio_inputs"."native_channels" BETWEEN 1 AND 64 AND "capture_audio_inputs"."input_number" <= "capture_audio_inputs"."native_channels"',
        },
        { name: 'capture_audio_inputs_sample_rate_check', kind: 'CHECK', definition: '"capture_audio_inputs"."sample_rate" = 48000' },
        { name: 'capture_audio_inputs_sample_bits_check', kind: 'CHECK', definition: '"capture_audio_inputs"."sample_bits" IN (16, 24, 32)' },
      ],
    },
  ],
  changedTables: [
    {
      name: 'session_capture_sources',
      addColumns: [{ name: 'source_facts', type: 'jsonb', notNull: true, default: "'{}'" }],
      addConstraints: [
        {
          name: 'session_capture_sources_source_facts_flat_check',
          kind: 'CHECK',
          definition: 'public.dems_jsonb_is_flat("session_capture_sources"."source_facts")',
        },
        {
          name: 'session_capture_sources_source_facts_no_secret_keys_check',
          kind: 'CHECK',
          definition: `NOT ("session_capture_sources"."source_facts" ?| ${NO_SECRET_KEYS})`,
        },
        {
          name: 'session_capture_sources_source_facts_bound_check',
          kind: 'CHECK',
          definition:
            'octet_length("session_capture_sources"."source_facts"::text) <= 2048 AND NOT jsonb_path_exists("session_capture_sources"."source_facts", \'$.*?(@.type() == "string" && !(@ like_regex "^[^[:cntrl:]]{0,120}$"))\')',
        },
      ],
      dropConstraints: [],
    },
    {
      name: 'capture_config',
      addColumns: [],
      addConstraints: [
        {
          name: 'capture_config_slot_pair_check',
          kind: 'CHECK',
          definition:
            '(("capture_config"."video_01_device_id" IS NULL) = ("capture_config"."video_01_profile" IS NULL)) AND (("capture_config"."video_02_device_id" IS NULL) = ("capture_config"."video_02_profile" IS NULL))',
        },
      ],
      dropConstraints: [],
    },
  ],
  nullableColumns: [
    {
      table: 'capture_config',
      columns: ['video_01_device_id', 'video_01_profile', 'video_02_device_id', 'video_02_profile', 'mic_primary_id', 'mic_standby_id'],
    },
  ],
  valueSets: {
    CAPTURE_STREAM_ROLE: ['MAIN', 'SUB'],
    CAPTURE_STREAM_CODEC: ['H264', 'HEVC', 'OTHER'],
  },
};
