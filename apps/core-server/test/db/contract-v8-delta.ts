/**
 * The schema-v8 delta of the database contract (schema set B of task 4, contract revision
 * `dbc-9`), composed after the v7 delta by `contract-inventory.ts` (ruling D44 R1: a closed
 * contract is never edited; the delta lives in this app's test folder).
 *
 * Provenance, stated honestly:
 *   - tables T-46 `capture_network_config` and T-47 `host_network_aliases` - names, nullability
 *     and defaults from the column tables of `docs/2026-10-12_input_av_core_adapter_plan/
 *     masterplan/03_db_schema_extension.md` sections 2.4 and 2.5;
 *   - the three address columns are `text` with a pattern, NOT `cidr` / `inet`: the fallback the
 *     design states under hypothesis H-DB-3, taken because the column types of the contract are a
 *     closed list of nine (TY-1);
 *   - `host_network_aliases_one_open_key` is NOT in the design: the alias helper as delivered
 *     holds one marked address (task 4 row 104, `MAX_MARKED = 1`), and the database holds the
 *     same bound beside the design's "one alias in place per address";
 *   - the columns `usb_serial` and `usb_port` of `capture_audio_inputs`: the findings of task 4
 *     rows 67 and 156 (requirement AD-07 (4)); the pattern is the card listing's rule for a port;
 *   - every constraint definition is the statement text of the generated
 *     `0017_network_commissioning.sql`; a default is written as PostgreSQL prints it back;
 *   - the two value sets: section 2.5, server-native.
 * NOT in a delta, because it is no part of the catalog: the two stored rows of the commissioning
 * permission that `0018` writes into a database that is already seeded (plan review P12-F07).
 * Independence as before: `catalog.db.test.ts` compares the composed inventory with the LIVE
 * catalog built from the migration SQL, `contract-inventory.test.ts` with the TYPED SCHEMA.
 * Totals after the composition: 47 tables, 484 columns, 217 CHECKs, 46 foreign keys, 47 primary
 * keys, 16 unique constraints, 6 unique indexes, 24 indexes, 48 value sets.
 */
import type { V2ChangedTable, V2NewTable } from './contract-v2-delta';

const INTERFACE_NAME = "'^[a-z0-9][a-z0-9._-]{0,14}$'";
const OCTET = '(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])';
const HOST_PART = '(25[0-4]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]?)';
const USB_TEXT = "'^[A-Za-z0-9:._-]{1,64}$'";

export const V8: {
  readonly newTables: readonly V2NewTable[];
  readonly changedTables: readonly V2ChangedTable[];
  readonly valueSets: Readonly<Record<string, readonly string[]>>;
} = {
  newTables: [
    {
      id: 'T-46',
      name: 'capture_network_config',
      columns: [
        { name: 'singleton', type: 'boolean', notNull: true, default: 'true' },
        { name: 'interface_name', type: 'text', notNull: false, default: null },
        { name: 'camera_subnet', type: 'text', notNull: false, default: null },
        { name: 'factory_addresses', type: 'jsonb', notNull: true, default: '\'["192.168.1.64", "192.168.1.108", "192.168.0.90", "192.168.1.13"]\'' },
        { name: 'alias_host', type: 'smallint', notNull: true, default: '253' },
        { name: 'alias_minutes', type: 'smallint', notNull: true, default: '30' },
        { name: 'camera_ip_start', type: 'smallint', notNull: true, default: '101' },
        { name: 'revision', type: 'bigint', notNull: true, default: '1' },
        { name: 'updated_by', type: 'text', notNull: false, default: null },
        { name: 'updated_at', type: 'bigint', notNull: true, default: null },
      ],
      constraints: [
        { name: 'capture_network_config_pkey', kind: 'PRIMARY KEY', definition: '(singleton)' },
        { name: 'capture_network_config_updated_by_fkey', kind: 'FOREIGN KEY', definition: '(updated_by) REFERENCES operators (id)' },
        { name: 'capture_network_config_singleton_check', kind: 'CHECK', definition: '"capture_network_config"."singleton"' },
        {
          name: 'capture_network_config_interface_name_check',
          kind: 'CHECK',
          definition: `"capture_network_config"."interface_name" IS NULL OR "capture_network_config"."interface_name" ~ ${INTERFACE_NAME}`,
        },
        {
          name: 'capture_network_config_camera_subnet_check',
          kind: 'CHECK',
          definition: `"capture_network_config"."camera_subnet" IS NULL OR "capture_network_config"."camera_subnet" ~ '^${OCTET}([.]${OCTET}){3}/(1[6-9]|2[0-9]|30)$'`,
        },
        {
          name: 'capture_network_config_factory_addresses_check',
          kind: 'CHECK',
          definition:
            'CASE WHEN jsonb_typeof("capture_network_config"."factory_addresses") = \'array\' THEN jsonb_array_length("capture_network_config"."factory_addresses") <= 32 AND NOT jsonb_path_exists("capture_network_config"."factory_addresses", \'strict $[*]?(@.type() != "string" || !(@ like_regex "^[0-9]{1,3}([.][0-9]{1,3}){3}$"))\') ELSE false END',
        },
        { name: 'capture_network_config_alias_host_check', kind: 'CHECK', definition: '"capture_network_config"."alias_host" BETWEEN 2 AND 254' },
        { name: 'capture_network_config_alias_minutes_check', kind: 'CHECK', definition: '"capture_network_config"."alias_minutes" BETWEEN 5 AND 480' },
        { name: 'capture_network_config_camera_ip_start_check', kind: 'CHECK', definition: '"capture_network_config"."camera_ip_start" BETWEEN 2 AND 250' },
        { name: 'capture_network_config_revision_check', kind: 'CHECK', definition: '"capture_network_config"."revision" >= 1' },
      ],
    },
    {
      id: 'T-47',
      name: 'host_network_aliases',
      columns: [
        { name: 'id', type: 'uuid', notNull: true, default: 'gen_random_uuid()' },
        { name: 'interface_name', type: 'text', notNull: true, default: null },
        { name: 'address', type: 'text', notNull: true, default: null },
        { name: 'reason', type: 'text', notNull: true, default: null },
        { name: 'added_at', type: 'bigint', notNull: true, default: null },
        { name: 'added_by', type: 'text', notNull: true, default: null },
        { name: 'expires_at', type: 'bigint', notNull: true, default: null },
        { name: 'removed_at', type: 'bigint', notNull: false, default: null },
        { name: 'remove_reason', type: 'text', notNull: false, default: null },
        { name: 'removed_by', type: 'text', notNull: false, default: null },
        { name: 'remove_error', type: 'text', notNull: false, default: null },
      ],
      constraints: [
        { name: 'host_network_aliases_pkey', kind: 'PRIMARY KEY', definition: '(id)' },
        { name: 'host_network_aliases_added_by_fkey', kind: 'FOREIGN KEY', definition: '(added_by) REFERENCES operators (id)' },
        { name: 'host_network_aliases_removed_by_fkey', kind: 'FOREIGN KEY', definition: '(removed_by) REFERENCES operators (id)' },
        { name: 'host_network_aliases_open_address_key', kind: 'UNIQUE INDEX', definition: '(interface_name, address) WHERE removed_at IS NULL' },
        { name: 'host_network_aliases_one_open_key', kind: 'UNIQUE INDEX', definition: '((removed_at IS NULL)) WHERE removed_at IS NULL' },
        { name: 'host_network_aliases_interface_name_check', kind: 'CHECK', definition: `"host_network_aliases"."interface_name" ~ ${INTERFACE_NAME}` },
        {
          name: 'host_network_aliases_address_check',
          kind: 'CHECK',
          definition: `"host_network_aliases"."address" ~ '^(10[.]${OCTET}[.]${OCTET}|172[.](1[6-9]|2[0-9]|3[01])[.]${OCTET}|192[.]168[.]${OCTET})[.]${HOST_PART}/24$'`,
        },
        { name: 'host_network_aliases_reason_check', kind: 'CHECK', definition: '"host_network_aliases"."reason" IN (\'FACTORY_SCAN\', \'SET_CAMERA_ADDRESS\')' },
        { name: 'host_network_aliases_expires_at_check', kind: 'CHECK', definition: '"host_network_aliases"."expires_at" > "host_network_aliases"."added_at"' },
        {
          name: 'host_network_aliases_removed_at_check',
          kind: 'CHECK',
          definition: '"host_network_aliases"."removed_at" IS NULL OR "host_network_aliases"."removed_at" >= "host_network_aliases"."added_at"',
        },
        {
          name: 'host_network_aliases_remove_reason_check',
          kind: 'CHECK',
          definition:
            '(("host_network_aliases"."remove_reason" IS NULL) = ("host_network_aliases"."removed_at" IS NULL)) AND ("host_network_aliases"."remove_reason" IS NULL OR "host_network_aliases"."remove_reason" IN (\'EXPIRED\', \'MANUAL\', \'JOB_DONE\', \'BOOT_SWEEP\'))',
        },
        {
          name: 'host_network_aliases_removed_by_check',
          kind: 'CHECK',
          definition: '"host_network_aliases"."removed_by" IS NULL OR "host_network_aliases"."removed_at" IS NOT NULL',
        },
        {
          name: 'host_network_aliases_remove_error_check',
          kind: 'CHECK',
          definition: '"host_network_aliases"."remove_error" IS NULL OR "host_network_aliases"."remove_error" ~ \'^[A-Z][A-Z0-9_]{0,63}$\'',
        },
      ],
    },
  ],
  changedTables: [
    {
      name: 'capture_audio_inputs',
      addColumns: [
        { name: 'usb_serial', type: 'text', notNull: false, default: null },
        { name: 'usb_port', type: 'text', notNull: false, default: null },
      ],
      addConstraints: [
        {
          name: 'capture_audio_inputs_usb_serial_check',
          kind: 'CHECK',
          definition: `"capture_audio_inputs"."usb_serial" IS NULL OR "capture_audio_inputs"."usb_serial" ~ ${USB_TEXT}`,
        },
        {
          name: 'capture_audio_inputs_usb_port_check',
          kind: 'CHECK',
          definition: `"capture_audio_inputs"."usb_port" IS NULL OR "capture_audio_inputs"."usb_port" ~ ${USB_TEXT}`,
        },
      ],
      dropConstraints: [],
    },
  ],
  valueSets: {
    HOST_ALIAS_REASON: ['FACTORY_SCAN', 'SET_CAMERA_ADDRESS'],
    HOST_ALIAS_REMOVE_REASON: ['EXPIRED', 'MANUAL', 'JOB_DONE', 'BOOT_SWEEP'],
  },
};
