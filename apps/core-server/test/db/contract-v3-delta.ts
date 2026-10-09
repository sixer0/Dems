/**
 * The schema-v3 delta of database contract dbc-4 (section N; blueprint row 129), composed onto the
 * v1 base and the dbc-3 delta by `contract-inventory.ts` (ruling D44 R1: a closed contract is
 * never edited; the re-point lives in this app's test folder).
 *
 * Provenance, stated honestly:
 *   - table T-41 `session_capture_sources`, the two added columns, their types, nullability and
 *     defaults: dbc-4 section N.2 / N.3 / N.4 column tables;
 *   - every constraint definition: the plan-form statement text of dbc-4 section N.8, which the
 *     generated `0008_capture_sources.sql` reproduces statement for statement (the comparison is
 *     recorded in `implementation/60_r9_migration_0008.md`);
 *   - the two value sets: dbc-4 section N.2 (`CAPTURE_ADAPTER_KIND`) and N.3
 *     (`CAPTURE_SOURCE_SLOT`), server-native until row 136 adds the shared constant.
 * Independence as in v2: `catalog.db.test.ts` compares the composed inventory with the LIVE
 * catalog built from the migration SQL, `contract-inventory.test.ts` with the TYPED SCHEMA.
 * Totals after the composition (dbc-4 section N.11): 41 tables, 426 columns, 172 CHECKs,
 * 40 foreign keys, 41 primary keys, 4 unique indexes, 44 value sets.
 */
import type { V2ChangedTable, V2NewTable } from './contract-v2-delta';

export const V3: {
  readonly newTables: readonly V2NewTable[];
  readonly changedTables: readonly V2ChangedTable[];
  readonly valueSets: Readonly<Record<string, readonly string[]>>;
} = {
 "newTables": [
  {
   "id": "T-41",
   "name": "session_capture_sources",
   "columns": [
    {
     "name": "session_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "slot",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "device_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "adapter_kind",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "recorded_at",
     "type": "bigint",
     "notNull": true,
     "default": null
    }
   ],
   "constraints": [
    {
     "name": "session_capture_sources_pkey",
     "kind": "PRIMARY KEY",
     "definition": "(session_id, slot)"
    },
    {
     "name": "session_capture_sources_session_check",
     "kind": "CHECK",
     "definition": "\"session_capture_sources\".\"session_id\" ~ '^SES-[0-9]{8}-[0-9]{4}$'"
    },
    {
     "name": "session_capture_sources_slot_check",
     "kind": "CHECK",
     "definition": "\"session_capture_sources\".\"slot\" IN ('VIDEO-01', 'VIDEO-02', 'MIC-PRIMARY', 'MIC-STANDBY')"
    },
    {
     "name": "session_capture_sources_adapter_kind_check",
     "kind": "CHECK",
     "definition": "\"session_capture_sources\".\"adapter_kind\" IN ('ONVIF_RTSP', 'USB_AUDIO', 'SNMP_POE', 'FAKE', 'LOCAL_DEVICE')"
    },
    {
     "name": "session_capture_sources_pairing_check",
     "kind": "CHECK",
     "definition": "(\"session_capture_sources\".\"slot\" IN ('VIDEO-01', 'VIDEO-02') AND \"session_capture_sources\".\"adapter_kind\" IN ('ONVIF_RTSP', 'FAKE', 'LOCAL_DEVICE')) OR (\"session_capture_sources\".\"slot\" IN ('MIC-PRIMARY', 'MIC-STANDBY') AND \"session_capture_sources\".\"adapter_kind\" IN ('USB_AUDIO', 'FAKE', 'LOCAL_DEVICE'))"
    },
    {
     "name": "session_capture_sources_device_id_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(device_id) REFERENCES capture_devices (id)"
    }
   ]
  }
 ],
 "changedTables": [
  {
   "name": "capture_devices",
   "addColumns": [
    {
     "name": "adapter_kind",
     "type": "text",
     "notNull": true,
     "default": "'FAKE'"
    }
   ],
   "addConstraints": [
    {
     "name": "capture_devices_onvif_uuid_key",
     "kind": "UNIQUE INDEX",
     "definition": "(onvif_uuid) WHERE onvif_uuid IS NOT NULL"
    },
    {
     "name": "capture_devices_adapter_kind_check",
     "kind": "CHECK",
     "definition": "\"capture_devices\".\"adapter_kind\" IN ('ONVIF_RTSP', 'USB_AUDIO', 'SNMP_POE', 'FAKE', 'LOCAL_DEVICE')"
    },
    {
     "name": "capture_devices_adapter_pairing_check",
     "kind": "CHECK",
     "definition": "(\"capture_devices\".\"kind\" = 'CAMERA' AND \"capture_devices\".\"adapter_kind\" IN ('ONVIF_RTSP', 'FAKE', 'LOCAL_DEVICE')) OR (\"capture_devices\".\"kind\" = 'MIC' AND \"capture_devices\".\"adapter_kind\" IN ('USB_AUDIO', 'FAKE', 'LOCAL_DEVICE')) OR (\"capture_devices\".\"kind\" = 'POE' AND \"capture_devices\".\"adapter_kind\" IN ('SNMP_POE', 'FAKE'))"
    }
   ],
   "dropConstraints": []
  },
  {
   "name": "evidence_items",
   "addColumns": [
    {
     "name": "development_sources",
     "type": "boolean",
     "notNull": false,
     "default": null
    }
   ],
   "addConstraints": [],
   "dropConstraints": []
  }
 ],
 "valueSets": {
  "CAPTURE_ADAPTER_KIND": [
   "ONVIF_RTSP",
   "USB_AUDIO",
   "SNMP_POE",
   "FAKE",
   "LOCAL_DEVICE"
  ],
  "CAPTURE_SOURCE_SLOT": [
   "VIDEO-01",
   "VIDEO-02",
   "MIC-PRIMARY",
   "MIC-STANDBY"
  ]
 }
};
