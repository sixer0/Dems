/**
 * The schema-v5 delta of the database contract (section N erratum PE-129b-01, contract revision
 * `dbc-6`; controller-added row 129b, D109), composed after the dbc-4 delta by
 * `contract-inventory.ts` (ruling D44 R1). Schema version 4 (`dbc-5`, row 129a) changed no table
 * and therefore has no delta module.
 *
 * Provenance: table T-42 `session_stt_config` - its ten columns, types and nullability from the
 * column table of PE-129b-01; every constraint definition is the statement text of the generated
 * `0011_session_stt_config.sql`. The CHECKs repeat those of `stt_config` (dbc-3 section B.13) on
 * the snapshot's columns. No value set is added (`STT_BACKEND`, `STT_CREDENTIAL_KIND` exist).
 * Totals after the composition: 42 tables, 436 columns, 179 CHECKs, 40 foreign keys, 42 primary
 * keys.
 */
import type { V2NewTable } from './contract-v2-delta';

export const V5: { readonly newTables: readonly V2NewTable[] } = {
 "newTables": [
  {
   "id": "T-42",
   "name": "session_stt_config",
   "columns": [
    {
     "name": "session_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "enabled",
     "type": "boolean",
     "notNull": true,
     "default": null
    },
    {
     "name": "backend",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "endpoint",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "model",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "language",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "diarization",
     "type": "boolean",
     "notNull": true,
     "default": null
    },
    {
     "name": "credential_kind",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "config_revision",
     "type": "bigint",
     "notNull": true,
     "default": null
    },
    {
     "name": "taken_at",
     "type": "bigint",
     "notNull": true,
     "default": null
    }
   ],
   "constraints": [
    {
     "name": "session_stt_config_pkey",
     "kind": "PRIMARY KEY",
     "definition": "(session_id)"
    },
    {
     "name": "session_stt_config_session_check",
     "kind": "CHECK",
     "definition": "\"session_stt_config\".\"session_id\" ~ '^SES-[0-9]{8}-[0-9]{4}$'"
    },
    {
     "name": "session_stt_config_backend_check",
     "kind": "CHECK",
     "definition": "\"session_stt_config\".\"backend\" IN ('omlx-server', 'cpu-local')"
    },
    {
     "name": "session_stt_config_endpoint_required_check",
     "kind": "CHECK",
     "definition": "\"session_stt_config\".\"backend\" <> 'omlx-server' OR \"session_stt_config\".\"endpoint\" IS NOT NULL"
    },
    {
     "name": "session_stt_config_endpoint_loopback_check",
     "kind": "CHECK",
     "definition": "\"session_stt_config\".\"endpoint\" IS NULL OR \"session_stt_config\".\"endpoint\" ~ '^http://(127\\.0\\.0\\.1|localhost)(:[0-9]{1,5})?(/.*)?$'"
    },
    {
     "name": "session_stt_config_language_check",
     "kind": "CHECK",
     "definition": "\"session_stt_config\".\"language\" = 'id'"
    },
    {
     "name": "session_stt_config_credential_kind_check",
     "kind": "CHECK",
     "definition": "\"session_stt_config\".\"credential_kind\" IS NULL OR \"session_stt_config\".\"credential_kind\" IN ('REFERENCE', 'ENCRYPTED')"
    },
    {
     "name": "session_stt_config_revision_check",
     "kind": "CHECK",
     "definition": "\"session_stt_config\".\"config_revision\" >= 1"
    }
   ]
  }
 ]
};
