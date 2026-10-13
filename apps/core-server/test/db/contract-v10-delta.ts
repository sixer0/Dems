/**
 * The schema-v10 delta of the database contract (task 4, the element CHECK on
 * `capture_devices.profiles`, contract revision `dbc-11`), composed after the v9 delta by
 * `contract-inventory.ts` (ruling D44 R1: a closed contract is never edited; the delta lives in
 * this app's test folder).
 *
 * Provenance, stated honestly:
 *   - requirement AD-06 (4) of `docs/2026-10-12_input_av_core_adapter_plan/verification/
 *     04_security_addendum.md`; listed in the cell of blueprint row 17, deferred by it (adoption
 *     still stored ONVIF tokens), built in code by row 51 (`assertAdoptedProfiles`) and handed over
 *     to the migration writer with the statement (`implementation/051_adoption_stream_rows.md`);
 *   - the name `capture_devices_profiles_code_check` is row 51's; the definition is the statement
 *     text of the generated `0022_profile_codes.sql`. It differs from row 51's proposal in ONE
 *     point: the path stands inside `CASE WHEN jsonb_typeof(...) = 'array' ... ELSE false END`, so
 *     that a value that is no array is refused as a rule and never raises a path error;
 *   - the data step of `0021_profile_codes_data.sql` is no part of the catalog and is in no delta.
 * No table, no column, no key, no index, no value set and no grant is added. Totals after the
 * composition: 47 tables, 484 columns, 218 CHECKs, 46 foreign keys, 47 primary keys, 16 unique
 * constraints, 6 unique indexes, 24 indexes, 48 value sets.
 */
import type { V2ChangedTable } from './contract-v2-delta';

export const V10: { readonly changedTables: readonly V2ChangedTable[] } = {
  changedTables: [
    {
      name: 'capture_devices',
      addColumns: [],
      addConstraints: [
        {
          name: 'capture_devices_profiles_code_check',
          kind: 'CHECK',
          definition:
            'CASE WHEN jsonb_typeof("capture_devices"."profiles") = \'array\' THEN NOT jsonb_path_exists("capture_devices"."profiles", \'strict $[*]?(@.type() != "string" || !(@ like_regex "^[A-Z][A-Z0-9_]{0,63}$"))\') ELSE false END',
        },
      ],
      dropConstraints: [],
    },
  ],
};
