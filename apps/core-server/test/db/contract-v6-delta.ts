/**
 * The schema-v6 delta of the database contract (section N erratum PE-0013-01, contract revision
 * `dbc-7`; controller rulings D146, D162, D166), composed after the v5 delta by
 * `contract-inventory.ts` (ruling D44 R1).
 *
 * Provenance: table T-43 `core_media_store` and the column `alerts.reason` - names, types and
 * nullability from the column tables of PE-0013-01; every constraint definition is the statement
 * text of the generated `0013_key_id_fault_reason_media_root.sql`. The CHECK
 * `transcript_revisions_key_id_check` keeps its name and changes its pattern from `CODE` to the
 * key-id form. No value set is added.
 * Totals after the composition: 43 tables, 440 columns, 182 CHECKs, 40 foreign keys, 43 primary
 * keys.
 */
import type { V2ChangedTable, V2NewTable } from './contract-v2-delta';

export const V6: { readonly newTables: readonly V2NewTable[]; readonly changedTables: readonly V2ChangedTable[] } = {
  newTables: [
    {
      id: 'T-43',
      name: 'core_media_store',
      columns: [
        { name: 'singleton', type: 'boolean', notNull: true, default: 'true' },
        { name: 'media_root', type: 'text', notNull: true, default: null },
        { name: 'recorded_at', type: 'bigint', notNull: true, default: null },
      ],
      constraints: [
        { name: 'core_media_store_pkey', kind: 'PRIMARY KEY', definition: '(singleton)' },
        { name: 'core_media_store_singleton_check', kind: 'CHECK', definition: '"core_media_store"."singleton"' },
        {
          name: 'core_media_store_root_check',
          kind: 'CHECK',
          definition:
            'char_length("core_media_store"."media_root") BETWEEN 1 AND 1024 AND "core_media_store"."media_root" ~ \'^/[^[:cntrl:]]*$\' AND position(\'://\' in "core_media_store"."media_root") = 0',
        },
      ],
    },
  ],
  changedTables: [
    {
      name: 'alerts',
      addColumns: [{ name: 'reason', type: 'text', notNull: false, default: null }],
      addConstraints: [
        { name: 'alerts_reason_check', kind: 'CHECK', definition: '"alerts"."reason" IS NULL OR "alerts"."reason" ~ \'^[A-Z][A-Z0-9_]{0,63}$\'' },
      ],
      dropConstraints: [],
    },
    {
      name: 'transcript_revisions',
      addColumns: [],
      // Same name, new pattern: the composer replaces a constraint of the same name.
      addConstraints: [
        { name: 'transcript_revisions_key_id_check', kind: 'CHECK', definition: '"transcript_revisions"."signature_key_id" ~ \'^[A-Z0-9][A-Z0-9_-]{0,63}$\'' },
      ],
      dropConstraints: [],
    },
  ],
};
