/**
 * The schema-v12 delta of the database contract (task 4, the honest removal reasons of a temporary
 * host address, contract revision `dbc-13`), composed after the v11 delta by
 * `contract-inventory.ts` (ruling D44 R1: a closed contract is never edited; the delta lives in
 * this app's test folder).
 *
 * Provenance, stated honestly:
 *   - the values `SHUTDOWN` and `NOT_ADDED` in `HOST_ALIAS_REMOVE_REASON`: decision C74 (D-2, D-3)
 *     of `docs/2026-10-12_input_av_core_adapter_plan/decisions/decisions.md`, launched by C83. The
 *     WORDS are that decision's: the design names four members and none for these two endings
 *     (`masterplan/03_db_schema_extension.md:293`; `masterplan/01_specs.md` and security finding
 *     S13-10 of `verification/02_security.md` name no removal reason at all);
 *   - the set is stated here IN FULL, in its stored order with the two new values LAST: the
 *     composer replaces the list the v8 delta states;
 *   - the CHECK keeps its name and changes its value list - the composer replaces a constraint of
 *     the same name; the definition is the statement text of the generated
 *     `0026_alias_removal_reasons.sql`.
 * No table, no column, no key, no index and no grant is added: the totals stay 48 tables, 497
 * columns, 229 CHECKs, 48 foreign keys, 48 primary keys, 16 unique constraints, 7 unique indexes,
 * 24 indexes, 48 value sets.
 */
import type { V2ChangedTable } from './contract-v2-delta';

const HOST_ALIAS_REMOVE_REASON = ['EXPIRED', 'MANUAL', 'JOB_DONE', 'BOOT_SWEEP', 'SHUTDOWN', 'NOT_ADDED'] as const;

const list = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');

export const V12: {
  readonly changedTables: readonly V2ChangedTable[];
  readonly valueSets: Readonly<Record<string, readonly string[]>>;
} = {
  changedTables: [
    {
      name: 'host_network_aliases',
      addColumns: [],
      // Same name, two values more: the composer replaces a constraint of the same name.
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
