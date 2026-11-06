/**
 * The schema-v15 delta of the database contract (task 4, retiring a capture device, contract
 * revision `dbc-16`), composed after the v14 delta by `contract-inventory.ts` (ruling D44 R1: a
 * closed contract is never edited; the delta lives in this app's test folder).
 *
 * Provenance, stated honestly:
 *   - the design `docs/2026-10-12_input_av_core_adapter_plan/masterplan/07_design_retire_readopt.md`
 *     section 4.1 (adopted by decision C147 of `decisions/decisions.md`) names the three columns,
 *     the foreign key of `retired_by`, the CHECK "both NULL or both set", and the two identity
 *     rules made partial on rows in service. The CHECK that a PoE row is never retired, and the
 *     NAMES of both CHECKs, are the schema row's choices (record
 *     `implementation/rd1_schema_retirement.md`);
 *   - the definitions are the statement texts of the generated `0032_capture_device_retirement.sql`.
 *     The two indexes keep their names; the composer replaces a constraint of the same name, so
 *     `capture_audio_inputs_card_input_key` goes from a UNIQUE constraint to a UNIQUE INDEX.
 * The guard trigger and the credential-destroy function of `0033` are no constraint of this
 * inventory; `catalog.db.test.ts` holds them (functions and triggers).
 * Three columns, one foreign key, two CHECKs; one UNIQUE becomes a UNIQUE INDEX: the totals are
 * 48 tables, 501 columns (498), 233 CHECKs (231), 49 foreign keys (48), 48 primary keys,
 * 15 unique constraints (16), 8 unique indexes (7), 24 indexes, 48 value sets.
 */
import type { V2ChangedTable } from './contract-v2-delta';

export const V15: {
  readonly changedTables: readonly V2ChangedTable[];
} = {
  changedTables: [
    {
      name: 'capture_devices',
      addColumns: [
        { name: 'retired_at', type: 'bigint', notNull: false, default: null },
        { name: 'retired_by', type: 'text', notNull: false, default: null },
      ],
      addConstraints: [
        // Same name, the predicate widened by "in service": the composer replaces it.
        { name: 'capture_devices_onvif_uuid_key', kind: 'UNIQUE INDEX', definition: '(onvif_uuid) WHERE onvif_uuid IS NOT NULL AND retired_at IS NULL' },
        { name: 'capture_devices_retired_by_fkey', kind: 'FOREIGN KEY', definition: '(retired_by) REFERENCES operators (id)' },
        {
          name: 'capture_devices_retired_check',
          kind: 'CHECK',
          definition: '("capture_devices"."retired_at" IS NULL) = ("capture_devices"."retired_by" IS NULL)',
        },
        {
          name: 'capture_devices_retired_kind_check',
          kind: 'CHECK',
          definition: `"capture_devices"."retired_at" IS NULL OR "capture_devices"."kind" <> 'POE'`,
        },
      ],
      dropConstraints: [],
    },
    {
      name: 'capture_audio_inputs',
      addColumns: [{ name: 'retired_at', type: 'bigint', notNull: false, default: null }],
      addConstraints: [
        // Same name, a constraint until v15 and a partial unique index since: the composer replaces it.
        { name: 'capture_audio_inputs_card_input_key', kind: 'UNIQUE INDEX', definition: '(card_id, card_device, input_number) WHERE retired_at IS NULL' },
      ],
      dropConstraints: [],
    },
  ],
};
