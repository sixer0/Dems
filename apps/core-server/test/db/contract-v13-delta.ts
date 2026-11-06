/**
 * The schema-v13 delta of the database contract (task 4, the further removal reason of an alias
 * address on the camera interface, contract revision `dbc-14`), composed after the v12 delta by
 * `contract-inventory.ts` (ruling D44 R1: a closed contract is never edited; the delta lives in
 * this app's test folder).
 *
 * Provenance, stated honestly:
 *   - the value `ADD_UNCONFIRMED` in `HOST_ALIAS_REMOVE_REASON`: caution R119-05, answer (d), of
 *     `docs/2026-10-12_input_av_core_adapter_plan/verification/119_commissioning_security.md`
 *     ("a further value is needed (proposed `ADD_UNCONFIRMED`)"), adopted by decision C94 (d) of
 *     `decisions/decisions.md`. The WORD is the review's; the design names none
 *     (`masterplan/03_db_schema_extension.md:293` holds the four first members);
 *   - the set is stated here IN FULL, in its stored order with the new value LAST: the composer
 *     replaces the list the v12 delta states;
 *   - the CHECK keeps its name and changes its value list - the composer replaces a constraint of
 *     the same name; the definition is the statement text of the generated
 *     `0028_alias_removal_reason_unconfirmed.sql`.
 * No table, no column, no key, no index and no grant is added: the totals stay 48 tables, 497
 * columns, 229 CHECKs, 48 foreign keys, 48 primary keys, 16 unique constraints, 7 unique indexes,
 * 24 indexes, 48 value sets.
 */
import type { V2ChangedTable } from './contract-v2-delta';

const HOST_ALIAS_REMOVE_REASON = ['EXPIRED', 'MANUAL', 'JOB_DONE', 'BOOT_SWEEP', 'SHUTDOWN', 'NOT_ADDED', 'ADD_UNCONFIRMED'] as const;

const list = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');

export const V13: {
  readonly changedTables: readonly V2ChangedTable[];
  readonly valueSets: Readonly<Record<string, readonly string[]>>;
} = {
  changedTables: [
    {
      name: 'host_network_aliases',
      addColumns: [],
      // Same name, one value more: the composer replaces a constraint of the same name.
      addConstraints: [
        {
          name: 'host_network_aliases_remove_reason_check',
          kind: 'CHECK',
          definition: `(("host_network_aliases"."remove_reason" IS NULL) = ("host_network_aliases"."removed_at" IS NULL)) AND ("host_network_aliases"."remove_reason" IS NULL OR "host_network_aliases"."remove_reason" IN (${list(HOST_ALIAS_REMOVE_REASON)}))`,
        },
      ],
      dropConstraints: [],
    },
  ],
  valueSets: {
    HOST_ALIAS_REMOVE_REASON: [...HOST_ALIAS_REMOVE_REASON],
  },
};
