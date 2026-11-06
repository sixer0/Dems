/**
 * The schema-v14 delta of the database contract (task 4, the allowed ONVIF ports of the network
 * settings and the form of an interface name, contract revision `dbc-15`), composed after the v13
 * delta by `contract-inventory.ts` (ruling D44 R1: a closed contract is never edited; the delta
 * lives in this app's test folder).
 *
 * Provenance, stated honestly:
 *   - the column `capture_network_config.onvif_ports`: finding S2-02 of
 *     `docs/2026-10-12_input_av_core_adapter_plan/verification/120b_m10_review_second_pass.md`
 *     ("the port from the short stored list" of security requirement S13-11 point 3 had no stored
 *     list), ruled by decision C116 of `decisions/decisions.md`: a seventh setting, the rule's own
 *     bound of 8, default `[80]`. The design (`masterplan/03_db_schema_extension.md`, set B) names
 *     no such column; its NAME, its TYPE (jsonb, as the other bounded lists of this schema) and
 *     the lower bound of ONE element are the schema row's choices (record
 *     `implementation/d4a_network_config_schema.md`);
 *   - the form of an interface name: finding F-4 of `verification/120_m10_review.md`, ruled by
 *     decision C114: the table is widened to the alias helper's own form
 *     (`scripts/host/netalias/dems-core-netalias`, `INTERFACE_NAME`). The two CHECKs keep their
 *     names and change their pattern - the composer replaces a constraint of the same name; the
 *     definitions are the statement texts of the generated `0030_network_config_onvif_ports.sql`.
 * One column and two CHECKs are added; no table, no key, no index and no value set: the totals
 * are 48 tables, 498 columns (497), 231 CHECKs (229), 48 foreign keys, 48 primary keys, 16 unique
 * constraints, 7 unique indexes, 24 indexes, 48 value sets.
 */
import type { V2ChangedTable } from './contract-v2-delta';

/** The alias helper's own form, as a single-quoted SQL literal. */
const INTERFACE_NAME = "'^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$'";
const PORTS = '"capture_network_config"."onvif_ports"';
/** The bound of the destination rule's port list. */
const PORTS_MAX = 8;

/** Every two places of a list of at most eight elements, as the generated statement writes them. */
const anyTwoEqual = (): string => {
  const pairs: string[] = [];
  for (let first = 0; first < PORTS_MAX; first += 1) {
    for (let second = first + 1; second < PORTS_MAX; second += 1) pairs.push(`(${PORTS} -> ${first}) = (${PORTS} -> ${second})`);
  }
  return pairs.join(' OR ');
};

export const V14: {
  readonly changedTables: readonly V2ChangedTable[];
} = {
  changedTables: [
    {
      name: 'capture_network_config',
      addColumns: [{ name: 'onvif_ports', type: 'jsonb', notNull: true, default: "'[80]'" }],
      addConstraints: [
        // Same name, the pattern widened: the composer replaces a constraint of the same name.
        {
          name: 'capture_network_config_interface_name_check',
          kind: 'CHECK',
          definition: `"capture_network_config"."interface_name" IS NULL OR "capture_network_config"."interface_name" ~ ${INTERFACE_NAME}`,
        },
        {
          name: 'capture_network_config_onvif_ports_check',
          kind: 'CHECK',
          definition: `CASE WHEN jsonb_typeof(${PORTS}) = 'array' THEN jsonb_array_length(${PORTS}) BETWEEN 1 AND ${PORTS_MAX} AND NOT jsonb_path_exists(${PORTS}, 'strict $[*]?(@.type() != "number")') AND NOT jsonb_path_exists(${PORTS}, 'strict $[*]?(@ < 1 || @ > 65535)') AND NOT jsonb_path_exists(${PORTS}, 'strict $[*]?(@ != @.floor())') ELSE false END`,
        },
        {
          name: 'capture_network_config_onvif_ports_distinct_check',
          kind: 'CHECK',
          definition: `CASE WHEN jsonb_typeof(${PORTS}) = 'array' THEN NOT (${anyTwoEqual()}) ELSE false END`,
        },
      ],
      dropConstraints: [],
    },
    {
      name: 'host_network_aliases',
      addColumns: [],
      addConstraints: [
        { name: 'host_network_aliases_interface_name_check', kind: 'CHECK', definition: `"host_network_aliases"."interface_name" ~ ${INTERFACE_NAME}` },
      ],
      dropConstraints: [],
    },
  ],
};
