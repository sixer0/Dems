/**
 * The schema-v2 delta of database contract dbc-3, composed onto the v1 inventory by
 * `contract-inventory.ts` (ruling D44 R1: the CLOSED task-2 contract is never edited; the
 * re-point lives here, in this app's test folder).
 *
 * Provenance, stated honestly:
 *   - table set, column names, types, nullability and defaults: dbc-3 §A.2/§B/§B.13 as
 *     implemented by the typed schema of rows 45/112 - verified name-by-name against the dbc-3
 *     section tables (zero mismatches) and against the migration defaults of 0004/0006;
 *   - every constraint definition: the statement text of migrations 0004/0006, which row 46
 *     validated against dbc-3 §A/§B/§C statement by statement;
 *   - value-set swaps and additions: dbc-3 §C.6/§E.3, read from the typed-schema constants the
 *     CL-12 equality pins; the denied-key list is the 28 keys of §C.6 (row 112 included).
 * Independence is preserved where it matters: `catalog.db.test.ts` compares the composed
 * inventory with the LIVE catalog built from the migration SQL, and `contract-inventory.test.ts`
 * compares it with the TYPED SCHEMA - two separately authored transcriptions of dbc-3.
 */
import type { ContractColumn, ContractConstraint } from './contract-inventory';

export interface V2NewTable {
  readonly id: string;
  readonly name: string;
  readonly columns: readonly ContractColumn[];
  readonly constraints: readonly ContractConstraint[];
}

export interface V2ChangedTable {
  readonly name: string;
  readonly addColumns: readonly ContractColumn[];
  readonly addConstraints: readonly ContractConstraint[];
  readonly dropConstraints: readonly string[];
}

export const V2 = {
 "newTables": [
  {
   "id": "T-32",
   "name": "capture_devices",
   "columns": [
    {
     "name": "id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "kind",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "transport",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "model",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "firmware",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "address",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "mac",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "onvif_uuid",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "profiles",
     "type": "jsonb",
     "notNull": true,
     "default": "'[]'"
    },
    {
     "name": "poe_port",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "enabled",
     "type": "boolean",
     "notNull": true,
     "default": "true"
    },
    {
     "name": "last_seen_at",
     "type": "bigint",
     "notNull": false,
     "default": null
    }
   ],
   "constraints": [
    { "name": "capture_devices_pkey", "kind": "PRIMARY KEY", "definition": "(id)" },
    {
     "name": "capture_devices_id_check",
     "kind": "CHECK",
     "definition": "(\"capture_devices\".\"kind\" = 'CAMERA' AND \"capture_devices\".\"id\" ~ '^CAM-[0-9]{2,}$') OR (\"capture_devices\".\"kind\" = 'MIC' AND \"capture_devices\".\"id\" ~ '^MIC-[0-9]{2,}$') OR (\"capture_devices\".\"kind\" = 'POE' AND \"capture_devices\".\"id\" ~ '^POE-[A-Z0-9_]{2,}$')"
    },
    {
     "name": "capture_devices_kind_check",
     "kind": "CHECK",
     "definition": "\"capture_devices\".\"kind\" IN ('CAMERA', 'MIC', 'POE')"
    },
    {
     "name": "capture_devices_transport_check",
     "kind": "CHECK",
     "definition": "\"capture_devices\".\"transport\" ~ '^[A-Z][A-Z0-9_]{0,63}$'"
    },
    {
     "name": "capture_devices_text_check",
     "kind": "CHECK",
     "definition": "(\"capture_devices\".\"model\" IS NULL OR char_length(\"capture_devices\".\"model\") BETWEEN 1 AND 120) AND (\"capture_devices\".\"firmware\" IS NULL OR char_length(\"capture_devices\".\"firmware\") BETWEEN 1 AND 120) AND (\"capture_devices\".\"address\" IS NULL OR char_length(\"capture_devices\".\"address\") BETWEEN 1 AND 120) AND (\"capture_devices\".\"onvif_uuid\" IS NULL OR char_length(\"capture_devices\".\"onvif_uuid\") BETWEEN 1 AND 120) AND (\"capture_devices\".\"mac\" IS NULL OR \"capture_devices\".\"mac\" ~ '^[0-9A-F:]{17}$')"
    },
    {
     "name": "capture_devices_profiles_check",
     "kind": "CHECK",
     "definition": "jsonb_typeof(\"capture_devices\".\"profiles\") = 'array'"
    },
    {
     "name": "capture_devices_poe_port_check",
     "kind": "CHECK",
     "definition": "\"capture_devices\".\"poe_port\" IS NULL OR \"capture_devices\".\"poe_port\" ~ '^[A-Z][A-Z0-9_]{0,63}$'"
    },
    {
     "name": "capture_devices_kind_idx",
     "kind": "INDEX",
     "definition": "(kind)"
    }
   ]
  },
  {
   "id": "T-31",
   "name": "capture_config",
   "columns": [
    {
     "name": "singleton",
     "type": "boolean",
     "notNull": true,
     "default": "true"
    },
    {
     "name": "video_01_device_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "video_01_profile",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "video_02_device_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "video_02_profile",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "mic_primary_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "mic_standby_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "revision",
     "type": "bigint",
     "notNull": true,
     "default": "1"
    },
    {
     "name": "updated_by",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "updated_at",
     "type": "bigint",
     "notNull": true,
     "default": null
    }
   ],
   "constraints": [
    { "name": "capture_config_pkey", "kind": "PRIMARY KEY", "definition": "(singleton)" },
    {
     "name": "capture_config_singleton_check",
     "kind": "CHECK",
     "definition": "\"capture_config\".\"singleton\""
    },
    {
     "name": "capture_config_profile_check",
     "kind": "CHECK",
     "definition": "\"capture_config\".\"video_01_profile\" ~ '^[A-Z][A-Z0-9_]{0,63}$' AND \"capture_config\".\"video_02_profile\" ~ '^[A-Z][A-Z0-9_]{0,63}$'"
    },
    {
     "name": "capture_config_mic_check",
     "kind": "CHECK",
     "definition": "\"capture_config\".\"mic_standby_id\" <> \"capture_config\".\"mic_primary_id\""
    },
    {
     "name": "capture_config_selector_check",
     "kind": "CHECK",
     "definition": "(\"capture_config\".\"video_01_device_id\" <> \"capture_config\".\"video_02_device_id\") OR (\"capture_config\".\"video_01_profile\" <> \"capture_config\".\"video_02_profile\")"
    },
    {
     "name": "capture_config_revision_check",
     "kind": "CHECK",
     "definition": "\"capture_config\".\"revision\" >= 1"
    },
    {
     "name": "capture_config_video_01_device_id_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(video_01_device_id) REFERENCES capture_devices (id)"
    },
    {
     "name": "capture_config_video_02_device_id_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(video_02_device_id) REFERENCES capture_devices (id)"
    },
    {
     "name": "capture_config_mic_primary_id_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(mic_primary_id) REFERENCES capture_devices (id)"
    },
    {
     "name": "capture_config_mic_standby_id_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(mic_standby_id) REFERENCES capture_devices (id)"
    },
    {
     "name": "capture_config_updated_by_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(updated_by) REFERENCES operators (id)"
    }
   ]
  },
  {
   "id": "T-33",
   "name": "capture_device_credentials",
   "columns": [
    {
     "name": "device_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "username",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "encryption",
     "type": "text",
     "notNull": true,
     "default": "'AES-256-GCM'"
    },
    {
     "name": "secret_ciphertext",
     "type": "bytea",
     "notNull": true,
     "default": null
    },
    {
     "name": "nonce",
     "type": "bytea",
     "notNull": true,
     "default": null
    },
    {
     "name": "key_ref",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "rotated_at",
     "type": "bigint",
     "notNull": true,
     "default": null
    }
   ],
   "constraints": [
    { "name": "capture_device_credentials_pkey", "kind": "PRIMARY KEY", "definition": "(device_id)" },
    {
     "name": "capture_device_credentials_username_check",
     "kind": "CHECK",
     "definition": "char_length(\"capture_device_credentials\".\"username\") BETWEEN 1 AND 120"
    },
    {
     "name": "capture_device_credentials_encryption_check",
     "kind": "CHECK",
     "definition": "\"capture_device_credentials\".\"encryption\" = 'AES-256-GCM'"
    },
    {
     "name": "capture_device_credentials_secret_check",
     "kind": "CHECK",
     "definition": "octet_length(\"capture_device_credentials\".\"secret_ciphertext\") >= 33"
    },
    {
     "name": "capture_device_credentials_nonce_check",
     "kind": "CHECK",
     "definition": "octet_length(\"capture_device_credentials\".\"nonce\") = 12"
    },
    {
     "name": "capture_device_credentials_key_ref_check",
     "kind": "CHECK",
     "definition": "\"capture_device_credentials\".\"key_ref\" ~ '^[A-Z][A-Z0-9_]{0,63}$'"
    },
    {
     "name": "capture_device_credentials_device_id_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(device_id) REFERENCES capture_devices (id)"
    }
   ]
  },
  {
   "id": "T-34",
   "name": "session_audio_intervals",
   "columns": [
    {
     "name": "session_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "seq",
     "type": "integer",
     "notNull": true,
     "default": null
    },
    {
     "name": "mic_device_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "role",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "from_media_ms",
     "type": "bigint",
     "notNull": true,
     "default": null
    },
    {
     "name": "to_media_ms",
     "type": "bigint",
     "notNull": false,
     "default": null
    },
    {
     "name": "from_at",
     "type": "bigint",
     "notNull": true,
     "default": null
    },
    {
     "name": "to_at",
     "type": "bigint",
     "notNull": false,
     "default": null
    },
    {
     "name": "switched_by",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "reason",
     "type": "text",
     "notNull": true,
     "default": null
    }
   ],
   "constraints": [
    { "name": "session_audio_intervals_pkey", "kind": "PRIMARY KEY", "definition": "(session_id, seq)" },
    {
     "name": "session_audio_intervals_session_check",
     "kind": "CHECK",
     "definition": "\"session_audio_intervals\".\"session_id\" ~ '^SES-[0-9]{8}-[0-9]{4}$'"
    },
    {
     "name": "session_audio_intervals_seq_check",
     "kind": "CHECK",
     "definition": "\"session_audio_intervals\".\"seq\" >= 1"
    },
    {
     "name": "session_audio_intervals_role_check",
     "kind": "CHECK",
     "definition": "\"session_audio_intervals\".\"role\" IN ('PRIMARY', 'STANDBY')"
    },
    {
     "name": "session_audio_intervals_reason_check",
     "kind": "CHECK",
     "definition": "\"session_audio_intervals\".\"reason\" IN ('START', 'MANUAL', 'STOP')"
    },
    {
     "name": "session_audio_intervals_media_check",
     "kind": "CHECK",
     "definition": "\"session_audio_intervals\".\"from_media_ms\" >= 0 AND (\"session_audio_intervals\".\"to_media_ms\" IS NULL OR \"session_audio_intervals\".\"to_media_ms\" >= \"session_audio_intervals\".\"from_media_ms\")"
    },
    {
     "name": "session_audio_intervals_open_check",
     "kind": "CHECK",
     "definition": "(\"session_audio_intervals\".\"to_media_ms\" IS NULL) = (\"session_audio_intervals\".\"to_at\" IS NULL)"
    },
    {
     "name": "session_audio_intervals_mic_device_id_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(mic_device_id) REFERENCES capture_devices (id)"
    },
    {
     "name": "session_audio_intervals_switched_by_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(switched_by) REFERENCES operators (id)"
    },
    {
     "name": "session_audio_intervals_one_open_key",
     "kind": "UNIQUE INDEX",
     "definition": "(session_id) WHERE to_media_ms IS NULL"
    }
   ]
  },
  {
   "id": "T-35",
   "name": "recording_fragments",
   "columns": [
    {
     "name": "session_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "track_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "seq",
     "type": "integer",
     "notNull": true,
     "default": null
    },
    {
     "name": "byte_offset",
     "type": "bigint",
     "notNull": true,
     "default": null
    },
    {
     "name": "byte_length",
     "type": "bigint",
     "notNull": true,
     "default": null
    },
    {
     "name": "media_start_ms",
     "type": "bigint",
     "notNull": true,
     "default": null
    },
    {
     "name": "media_duration_ms",
     "type": "bigint",
     "notNull": true,
     "default": null
    },
    {
     "name": "sha256",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "chain_hash",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "durable_at",
     "type": "bigint",
     "notNull": true,
     "default": null
    }
   ],
   "constraints": [
    { "name": "recording_fragments_pkey", "kind": "PRIMARY KEY", "definition": "(session_id, track_id, seq)" },
    {
     "name": "recording_fragments_session_check",
     "kind": "CHECK",
     "definition": "\"recording_fragments\".\"session_id\" ~ '^SES-[0-9]{8}-[0-9]{4}$'"
    },
    {
     "name": "recording_fragments_track_check",
     "kind": "CHECK",
     "definition": "\"recording_fragments\".\"track_id\" IN ('VIDEO-01', 'VIDEO-02')"
    },
    {
     "name": "recording_fragments_seq_check",
     "kind": "CHECK",
     "definition": "\"recording_fragments\".\"seq\" >= 1"
    },
    {
     "name": "recording_fragments_bytes_check",
     "kind": "CHECK",
     "definition": "\"recording_fragments\".\"byte_offset\" >= 0 AND \"recording_fragments\".\"byte_length\" >= 1"
    },
    {
     "name": "recording_fragments_media_check",
     "kind": "CHECK",
     "definition": "\"recording_fragments\".\"media_start_ms\" >= 0 AND \"recording_fragments\".\"media_duration_ms\" >= 1"
    },
    {
     "name": "recording_fragments_hashes_check",
     "kind": "CHECK",
     "definition": "\"recording_fragments\".\"sha256\" ~ '^[0-9a-f]{64}$' AND \"recording_fragments\".\"chain_hash\" ~ '^[0-9a-f]{64}$'"
    }
   ]
  },
  {
   "id": "T-36",
   "name": "transcript_chunks",
   "columns": [
    {
     "name": "session_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "seq",
     "type": "integer",
     "notNull": true,
     "default": null
    },
    {
     "name": "audio_from_ms",
     "type": "bigint",
     "notNull": true,
     "default": null
    },
    {
     "name": "audio_to_ms",
     "type": "bigint",
     "notNull": true,
     "default": null
    },
    {
     "name": "status",
     "type": "text",
     "notNull": true,
     "default": "'PENDING'"
    },
    {
     "name": "segments",
     "type": "jsonb",
     "notNull": false,
     "default": null
    },
    {
     "name": "embedding_ref",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "model_id",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "computed_at",
     "type": "bigint",
     "notNull": false,
     "default": null
    }
   ],
   "constraints": [
    { "name": "transcript_chunks_pkey", "kind": "PRIMARY KEY", "definition": "(session_id, seq)" },
    {
     "name": "transcript_chunks_session_check",
     "kind": "CHECK",
     "definition": "\"transcript_chunks\".\"session_id\" ~ '^SES-[0-9]{8}-[0-9]{4}$'"
    },
    {
     "name": "transcript_chunks_seq_check",
     "kind": "CHECK",
     "definition": "\"transcript_chunks\".\"seq\" >= 1"
    },
    {
     "name": "transcript_chunks_audio_check",
     "kind": "CHECK",
     "definition": "\"transcript_chunks\".\"audio_from_ms\" >= 0 AND \"transcript_chunks\".\"audio_to_ms\" > \"transcript_chunks\".\"audio_from_ms\""
    },
    {
     "name": "transcript_chunks_status_check",
     "kind": "CHECK",
     "definition": "\"transcript_chunks\".\"status\" IN ('PENDING', 'RUNNING', 'DONE', 'FAILED')"
    },
    {
     "name": "transcript_chunks_segments_check",
     "kind": "CHECK",
     "definition": "\"transcript_chunks\".\"segments\" IS NULL OR jsonb_typeof(\"transcript_chunks\".\"segments\") = 'array'"
    },
    {
     "name": "transcript_chunks_done_check",
     "kind": "CHECK",
     "definition": "(\"transcript_chunks\".\"status\" <> 'DONE') OR (\"transcript_chunks\".\"segments\" IS NOT NULL AND \"transcript_chunks\".\"computed_at\" IS NOT NULL)"
    },
    {
     "name": "transcript_chunks_ref_check",
     "kind": "CHECK",
     "definition": "(\"transcript_chunks\".\"embedding_ref\" IS NULL OR \"transcript_chunks\".\"embedding_ref\" ~ '^[A-Z][A-Z0-9_]{0,63}$') AND (\"transcript_chunks\".\"model_id\" IS NULL OR \"transcript_chunks\".\"model_id\" ~ '^[A-Z][A-Z0-9_]{0,63}$')"
    }
   ]
  },
  {
   "id": "T-37",
   "name": "transcripts",
   "columns": [
    {
     "name": "evidence_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "json_sha256",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "srt_sha256",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "vtt_sha256",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "model",
     "type": "jsonb",
     "notNull": true,
     "default": null
    },
    {
     "name": "diarization",
     "type": "jsonb",
     "notNull": true,
     "default": null
    },
    {
     "name": "labels_status",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "created_at",
     "type": "bigint",
     "notNull": true,
     "default": null
    }
   ],
   "constraints": [
    { "name": "transcripts_pkey", "kind": "PRIMARY KEY", "definition": "(evidence_id)" },
    {
     "name": "transcripts_hashes_check",
     "kind": "CHECK",
     "definition": "\"transcripts\".\"json_sha256\" ~ '^[0-9a-f]{64}$' AND \"transcripts\".\"srt_sha256\" ~ '^[0-9a-f]{64}$' AND \"transcripts\".\"vtt_sha256\" ~ '^[0-9a-f]{64}$'"
    },
    {
     "name": "transcripts_json_check",
     "kind": "CHECK",
     "definition": "jsonb_typeof(\"transcripts\".\"model\") = 'object' AND jsonb_typeof(\"transcripts\".\"diarization\") = 'object'"
    },
    {
     "name": "transcripts_labels_check",
     "kind": "CHECK",
     "definition": "\"transcripts\".\"labels_status\" IN ('LABELLED', 'UNAVAILABLE')"
    },
    {
     "name": "transcripts_evidence_id_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(evidence_id) REFERENCES evidence_items (id)"
    }
   ]
  },
  {
   "id": "T-38",
   "name": "transcript_revisions",
   "columns": [
    {
     "name": "evidence_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "revision_no",
     "type": "integer",
     "notNull": true,
     "default": null
    },
    {
     "name": "parent_sha256",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "sha256",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "author_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "reason",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "signature_value",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "signature_key_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "signature_algorithm",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "signature_simulated",
     "type": "boolean",
     "notNull": true,
     "default": "false"
    },
    {
     "name": "signature_certificate_sha256",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "created_at",
     "type": "bigint",
     "notNull": true,
     "default": null
    }
   ],
   "constraints": [
    { "name": "transcript_revisions_pkey", "kind": "PRIMARY KEY", "definition": "(evidence_id, revision_no)" },
    {
     "name": "transcript_revisions_revision_no_check",
     "kind": "CHECK",
     "definition": "\"transcript_revisions\".\"revision_no\" >= 1"
    },
    {
     "name": "transcript_revisions_hashes_check",
     "kind": "CHECK",
     "definition": "\"transcript_revisions\".\"parent_sha256\" ~ '^[0-9a-f]{64}$' AND \"transcript_revisions\".\"sha256\" ~ '^[0-9a-f]{64}$'"
    },
    {
     "name": "transcript_revisions_reason_check",
     "kind": "CHECK",
     "definition": "char_length(\"transcript_revisions\".\"reason\") BETWEEN 5 AND 500"
    },
    {
     "name": "transcript_revisions_key_id_check",
     "kind": "CHECK",
     "definition": "\"transcript_revisions\".\"signature_key_id\" ~ '^[A-Z][A-Z0-9_]{0,63}$'"
    },
    {
     "name": "transcript_revisions_certificate_check",
     "kind": "CHECK",
     "definition": "\"transcript_revisions\".\"signature_certificate_sha256\" IS NULL OR \"transcript_revisions\".\"signature_certificate_sha256\" ~ '^[0-9a-f]{64}$'"
    },
    {
     "name": "transcript_revisions_signature_check",
     "kind": "CHECK",
     "definition": "\"transcript_revisions\".\"signature_algorithm\" IN ('Ed25519', 'SIMULATED-SHA256') AND ((\"transcript_revisions\".\"signature_algorithm\" = 'SIMULATED-SHA256' AND \"transcript_revisions\".\"signature_simulated\") OR (\"transcript_revisions\".\"signature_algorithm\" IN ('Ed25519') AND NOT \"transcript_revisions\".\"signature_simulated\"))"
    },
    {
     "name": "transcript_revisions_signature_value_check",
     "kind": "CHECK",
     "definition": "(\"transcript_revisions\".\"signature_algorithm\" = 'Ed25519' AND \"transcript_revisions\".\"signature_value\" ~ '^([0-9a-f]{2}){64}$') OR (\"transcript_revisions\".\"signature_algorithm\" = 'SIMULATED-SHA256' AND \"transcript_revisions\".\"signature_value\" ~ '^([0-9a-f]{2}){32}$')"
    },
    {
     "name": "transcript_revisions_evidence_id_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(evidence_id) REFERENCES evidence_items (id)"
    },
    {
     "name": "transcript_revisions_author_id_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(author_id) REFERENCES operators (id)"
    }
   ]
  },
  {
   "id": "T-39",
   "name": "sealing_jobs",
   "columns": [
    {
     "name": "session_id",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "step",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "status",
     "type": "text",
     "notNull": true,
     "default": null
    },
    {
     "name": "progress",
     "type": "integer",
     "notNull": true,
     "default": "0"
    },
    {
     "name": "eta_ms",
     "type": "bigint",
     "notNull": false,
     "default": null
    },
    {
     "name": "attempt",
     "type": "integer",
     "notNull": true,
     "default": "1"
    },
    {
     "name": "checkpoint",
     "type": "jsonb",
     "notNull": false,
     "default": null
    },
    {
     "name": "error_code",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "started_at",
     "type": "bigint",
     "notNull": true,
     "default": null
    },
    {
     "name": "updated_at",
     "type": "bigint",
     "notNull": true,
     "default": null
    }
   ],
   "constraints": [
    { "name": "sealing_jobs_pkey", "kind": "PRIMARY KEY", "definition": "(session_id, step)" },
    {
     "name": "sealing_jobs_session_check",
     "kind": "CHECK",
     "definition": "\"sealing_jobs\".\"session_id\" ~ '^SES-[0-9]{8}-[0-9]{4}$'"
    },
    {
     "name": "sealing_jobs_step_check",
     "kind": "CHECK",
     "definition": "\"sealing_jobs\".\"step\" ~ '^[A-Z][A-Z0-9_]{0,63}$'"
    },
    {
     "name": "sealing_jobs_status_check",
     "kind": "CHECK",
     "definition": "\"sealing_jobs\".\"status\" IN ('RUNNING', 'DONE', 'FAILED')"
    },
    {
     "name": "sealing_jobs_progress_check",
     "kind": "CHECK",
     "definition": "\"sealing_jobs\".\"progress\" BETWEEN 0 AND 100"
    },
    {
     "name": "sealing_jobs_eta_check",
     "kind": "CHECK",
     "definition": "\"sealing_jobs\".\"eta_ms\" IS NULL OR \"sealing_jobs\".\"eta_ms\" >= 0"
    },
    {
     "name": "sealing_jobs_attempt_check",
     "kind": "CHECK",
     "definition": "\"sealing_jobs\".\"attempt\" >= 1"
    },
    {
     "name": "sealing_jobs_checkpoint_check",
     "kind": "CHECK",
     "definition": "\"sealing_jobs\".\"checkpoint\" IS NULL OR jsonb_typeof(\"sealing_jobs\".\"checkpoint\") = 'object'"
    },
    {
     "name": "sealing_jobs_error_code_check",
     "kind": "CHECK",
     "definition": "\"sealing_jobs\".\"error_code\" IS NULL OR \"sealing_jobs\".\"error_code\" ~ '^[A-Z][A-Z0-9_]{0,63}$'"
    }
   ]
  },
  {
   "id": "T-40",
   "name": "stt_config",
   "columns": [
    {
     "name": "singleton",
     "type": "boolean",
     "notNull": true,
     "default": "true"
    },
    {
     "name": "enabled",
     "type": "boolean",
     "notNull": true,
     "default": "true"
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
     "default": "'id'"
    },
    {
     "name": "diarization",
     "type": "boolean",
     "notNull": true,
     "default": "true"
    },
    {
     "name": "credential_kind",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "credential_ref",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "secret_ciphertext",
     "type": "bytea",
     "notNull": false,
     "default": null
    },
    {
     "name": "nonce",
     "type": "bytea",
     "notNull": false,
     "default": null
    },
    {
     "name": "revision",
     "type": "bigint",
     "notNull": true,
     "default": "1"
    },
    {
     "name": "updated_by",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "updated_at",
     "type": "bigint",
     "notNull": true,
     "default": null
    }
   ],
   "constraints": [
    { "name": "stt_config_pkey", "kind": "PRIMARY KEY", "definition": "(singleton)" },
    {
     "name": "stt_config_singleton_check",
     "kind": "CHECK",
     "definition": "\"stt_config\".\"singleton\""
    },
    {
     "name": "stt_config_backend_check",
     "kind": "CHECK",
     "definition": "\"stt_config\".\"backend\" IN ('omlx-server', 'cpu-local')"
    },
    {
     "name": "stt_config_endpoint_required_check",
     "kind": "CHECK",
     "definition": "\"stt_config\".\"backend\" <> 'omlx-server' OR \"stt_config\".\"endpoint\" IS NOT NULL"
    },
    {
     "name": "stt_config_endpoint_loopback_check",
     "kind": "CHECK",
     "definition": "\"stt_config\".\"endpoint\" IS NULL OR \"stt_config\".\"endpoint\" ~ '^http://(127\\.0\\.0\\.1|localhost)(:[0-9]{1,5})?(/.*)?$'"
    },
    {
     "name": "stt_config_language_check",
     "kind": "CHECK",
     "definition": "\"stt_config\".\"language\" = 'id'"
    },
    {
     "name": "stt_config_credential_kind_check",
     "kind": "CHECK",
     "definition": "\"stt_config\".\"credential_kind\" IS NULL OR \"stt_config\".\"credential_kind\" IN ('REFERENCE', 'ENCRYPTED')"
    },
    {
     "name": "stt_config_secret_check",
     "kind": "CHECK",
     "definition": "\"stt_config\".\"secret_ciphertext\" IS NULL OR octet_length(\"stt_config\".\"secret_ciphertext\") >= 17"
    },
    {
     "name": "stt_config_nonce_check",
     "kind": "CHECK",
     "definition": "\"stt_config\".\"nonce\" IS NULL OR octet_length(\"stt_config\".\"nonce\") = 12"
    },
    {
     "name": "stt_config_credential_check",
     "kind": "CHECK",
     "definition": "(\"stt_config\".\"credential_kind\" IS NULL AND \"stt_config\".\"credential_ref\" IS NULL AND \"stt_config\".\"secret_ciphertext\" IS NULL AND \"stt_config\".\"nonce\" IS NULL) OR (\"stt_config\".\"credential_kind\" = 'REFERENCE' AND \"stt_config\".\"credential_ref\" IS NOT NULL AND \"stt_config\".\"secret_ciphertext\" IS NULL AND \"stt_config\".\"nonce\" IS NULL) OR (\"stt_config\".\"credential_kind\" = 'ENCRYPTED' AND \"stt_config\".\"credential_ref\" IS NOT NULL AND \"stt_config\".\"secret_ciphertext\" IS NOT NULL AND \"stt_config\".\"nonce\" IS NOT NULL)"
    },
    {
     "name": "stt_config_revision_check",
     "kind": "CHECK",
     "definition": "\"stt_config\".\"revision\" >= 1"
    },
    {
     "name": "stt_config_updated_by_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(updated_by) REFERENCES operators (id)"
    }
   ]
  }
 ],
 "changedTables": [
  {
   "name": "active_session",
   "addColumns": [
    {
     "name": "started_by",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "stopped_by",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "capture_config",
     "type": "jsonb",
     "notNull": true,
     "default": "'{}'"
    },
    {
     "name": "audio_source",
     "type": "jsonb",
     "notNull": true,
     "default": "'{}'"
    },
    {
     "name": "transcript_status",
     "type": "jsonb",
     "notNull": true,
     "default": "'{}'"
    }
   ],
   "addConstraints": [
    {
     "name": "active_session_json_check",
     "kind": "CHECK",
     "definition": "jsonb_typeof(\"active_session\".\"precheck\") = 'object' AND jsonb_typeof(\"active_session\".\"finalization\") = 'object' AND jsonb_typeof(\"active_session\".\"timeline\") = 'array' AND jsonb_array_length(\"active_session\".\"timeline\") <= 200 AND jsonb_typeof(\"active_session\".\"notes\") = 'array' AND (\"active_session\".\"fault\" IS NULL OR jsonb_typeof(\"active_session\".\"fault\") = 'object') AND (\"active_session\".\"recovery\" IS NULL OR jsonb_typeof(\"active_session\".\"recovery\") = 'object') AND jsonb_typeof(\"active_session\".\"capture_config\") = 'object' AND jsonb_typeof(\"active_session\".\"audio_source\") = 'object' AND jsonb_typeof(\"active_session\".\"transcript_status\") = 'object'"
    },
    {
     "name": "active_session_started_by_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(started_by) REFERENCES operators (id)"
    },
    {
     "name": "active_session_stopped_by_fkey",
     "kind": "FOREIGN KEY",
     "definition": "(stopped_by) REFERENCES operators (id)"
    }
   ],
   "dropConstraints": [
    "active_session_json_check"
   ]
  },
  {
   "name": "evidence_items",
   "addColumns": [
    {
     "name": "manifest_version",
     "type": "smallint",
     "notNull": true,
     "default": "1"
    },
    {
     "name": "transcript_sha256",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "labels_status",
     "type": "text",
     "notNull": false,
     "default": null
    }
   ],
   "addConstraints": [
    {
     "name": "evidence_items_signature_value_check",
     "kind": "CHECK",
     "definition": "(\"evidence_items\".\"signature_algorithm\" = 'SIMULATED-SHA256' AND \"evidence_items\".\"signature_value\" ~ '^([0-9a-f]{2}){32}$') OR (\"evidence_items\".\"signature_algorithm\" = 'Ed25519' AND \"evidence_items\".\"signature_value\" ~ '^([0-9a-f]{2}){64}$') OR (\"evidence_items\".\"signature_algorithm\" = 'ECDSA-P256-SHA256' AND \"evidence_items\".\"signature_value\" ~ '^([0-9a-f]{2}){64,72}$')"
    },
    {
     "name": "evidence_items_manifest_version_check",
     "kind": "CHECK",
     "definition": "\"evidence_items\".\"manifest_version\" IN (1, 2)"
    },
    {
     "name": "evidence_items_labels_check",
     "kind": "CHECK",
     "definition": "\"evidence_items\".\"labels_status\" IS NULL OR \"evidence_items\".\"labels_status\" IN ('LABELLED', 'UNAVAILABLE')"
    },
    {
     "name": "evidence_items_hashes_check",
     "kind": "CHECK",
     "definition": "\"evidence_items\".\"manifest_hash\" ~ '^[0-9a-f]{64}$' AND (\"evidence_items\".\"transcript_sha256\" IS NULL OR \"evidence_items\".\"transcript_sha256\" ~ '^[0-9a-f]{64}$')"
    },
    {
     "name": "evidence_items_signature_check",
     "kind": "CHECK",
     "definition": "\"evidence_items\".\"signature_algorithm\" IN ('SIMULATED-SHA256', 'Ed25519', 'ECDSA-P256-SHA256') AND ((\"evidence_items\".\"signature_algorithm\" = 'SIMULATED-SHA256' AND \"evidence_items\".\"signature_simulated\") OR (\"evidence_items\".\"signature_algorithm\" IN ('Ed25519', 'ECDSA-P256-SHA256') AND NOT \"evidence_items\".\"signature_simulated\"))"
    },
    {
     "name": "evidence_items_sources_check",
     "kind": "CHECK",
     "definition": "(\"evidence_items\".\"integrity_source\" IS NULL OR \"evidence_items\".\"integrity_source\" IN ('DEMO_PACKAGE', 'SIMULATED', 'REAL')) AND (\"evidence_items\".\"start_time_source\" IS NULL OR \"evidence_items\".\"start_time_source\" IN ('GNSS', 'NTP', 'RTC')) AND (\"evidence_items\".\"end_time_source\" IS NULL OR \"evidence_items\".\"end_time_source\" IN ('GNSS', 'NTP', 'RTC'))"
    }
   ],
   "dropConstraints": [
    "evidence_items_hashes_check",
    "evidence_items_signature_check",
    "evidence_items_sources_check"
   ]
  },
  {
   "name": "evidence_tracks",
   "addColumns": [
    {
     "name": "kind",
     "type": "text",
     "notNull": true,
     "default": "'FILE'"
    },
    {
     "name": "contains_audio",
     "type": "boolean",
     "notNull": true,
     "default": "true"
    },
    {
     "name": "codec",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "duration_ms",
     "type": "bigint",
     "notNull": false,
     "default": null
    },
    {
     "name": "fragment_count",
     "type": "integer",
     "notNull": false,
     "default": null
    },
    {
     "name": "fragment_chain_head",
     "type": "text",
     "notNull": false,
     "default": null
    },
    {
     "name": "sha256_plain",
     "type": "text",
     "notNull": false,
     "default": null
    }
   ],
   "addConstraints": [
    {
     "name": "evidence_tracks_kind_check",
     "kind": "CHECK",
     "definition": "\"evidence_tracks\".\"kind\" IN ('FILE')"
    },
    {
     "name": "evidence_tracks_audio_check",
     "kind": "CHECK",
     "definition": "\"evidence_tracks\".\"contains_audio\""
    },
    {
     "name": "evidence_tracks_values_check",
     "kind": "CHECK",
     "definition": "\"evidence_tracks\".\"size_bytes\" >= 0 AND \"evidence_tracks\".\"sha256\" ~ '^[0-9a-f]{64}$' AND (\"evidence_tracks\".\"codec\" IS NULL OR \"evidence_tracks\".\"codec\" ~ '^[A-Z][A-Z0-9_]{0,63}$') AND (\"evidence_tracks\".\"duration_ms\" IS NULL OR \"evidence_tracks\".\"duration_ms\" >= 0) AND (\"evidence_tracks\".\"fragment_count\" IS NULL OR \"evidence_tracks\".\"fragment_count\" >= 0) AND (\"evidence_tracks\".\"fragment_chain_head\" IS NULL OR \"evidence_tracks\".\"fragment_chain_head\" ~ '^[0-9a-f]{64}$') AND (\"evidence_tracks\".\"sha256_plain\" IS NULL OR \"evidence_tracks\".\"sha256_plain\" ~ '^[0-9a-f]{64}$')"
    }
   ],
   "dropConstraints": [
    "evidence_tracks_values_check"
   ]
  },
  {
   "name": "audit_log",
   "addColumns": [],
   "addConstraints": [
    {
     "name": "audit_log_details_no_secret_keys_check",
     "kind": "CHECK",
     "definition": "NOT (\"audit_log\".\"details\" ?| ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization','secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl'])"
    },
    {
     "name": "audit_log_details_no_secret_keys_check",
     "kind": "CHECK",
     "definition": "NOT (\"audit_log\".\"details\" ?| ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization','secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl','credentialRef','credentialValue','apiKey'])"
    }
   ],
   "dropConstraints": [
    "audit_log_details_no_secret_keys_check",
    "audit_log_details_no_secret_keys_check"
   ]
  },
  {
   "name": "events",
   "addColumns": [],
   "addConstraints": [
    {
     "name": "events_params_no_secret_keys_check",
     "kind": "CHECK",
     "definition": "NOT (\"events\".\"params\" ?| ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization','secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl'])"
    },
    {
     "name": "events_params_no_secret_keys_check",
     "kind": "CHECK",
     "definition": "NOT (\"events\".\"params\" ?| ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization','secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl','credentialRef','credentialValue','apiKey'])"
    }
   ],
   "dropConstraints": [
    "events_params_no_secret_keys_check",
    "events_params_no_secret_keys_check"
   ]
  },
  {
   "name": "session_history",
   "addColumns": [],
   "addConstraints": [
    {
     "name": "session_history_outcome_check",
     "kind": "CHECK",
     "definition": "\"session_history\".\"outcome\" IN ('SEALED', 'INCOMPLETE') AND (\"session_history\".\"fault_kind\" IS NULL OR (\"session_history\".\"outcome\" = 'INCOMPLETE' AND \"session_history\".\"fault_kind\" IN ('CAMERA_LOSS', 'MIC_NO_SIGNAL', 'MIC_CLIP', 'STORAGE_LOW', 'STORAGE_FULL', 'GNSS_LOSS', 'TAMPER', 'FAN_STALL', 'POWER_FAIL', 'TPM_FAILURE', 'SECURITY_FAULT', 'AUDIT_TAMPER', 'MIC_SILENT', 'CAPTURE_FAULT')))"
    }
   ],
   "dropConstraints": [
    "session_history_outcome_check"
   ]
  },
  {
   "name": "alerts",
   "addColumns": [],
   "addConstraints": [
    {
     "name": "alerts_kind_check",
     "kind": "CHECK",
     "definition": "\"alerts\".\"severity\" IN ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL') AND (\"alerts\".\"kind\" = 'SYSTEM' OR \"alerts\".\"kind\" IN ('CAMERA_LOSS', 'MIC_NO_SIGNAL', 'MIC_CLIP', 'STORAGE_LOW', 'STORAGE_FULL', 'GNSS_LOSS', 'TAMPER', 'FAN_STALL', 'POWER_FAIL', 'TPM_FAILURE', 'SECURITY_FAULT', 'AUDIT_TAMPER', 'MIC_SILENT', 'CAPTURE_FAULT'))"
    }
   ],
   "dropConstraints": [
    "alerts_kind_check"
   ]
  },
  {
   "name": "health_snapshots",
   "addColumns": [],
   "addConstraints": [
    {
     "name": "health_snapshots_cause_check",
     "kind": "CHECK",
     "definition": "\"health_snapshots\".\"cause\" IN ('INTERVAL', 'FAULT_RAISED', 'FAULT_CLEARED') AND ((\"health_snapshots\".\"cause\" = 'INTERVAL') = (\"health_snapshots\".\"fault_kind\" IS NULL)) AND (\"health_snapshots\".\"fault_kind\" IS NULL OR \"health_snapshots\".\"fault_kind\" IN ('CAMERA_LOSS', 'MIC_NO_SIGNAL', 'MIC_CLIP', 'STORAGE_LOW', 'STORAGE_FULL', 'GNSS_LOSS', 'TAMPER', 'FAN_STALL', 'POWER_FAIL', 'TPM_FAILURE', 'SECURITY_FAULT', 'AUDIT_TAMPER', 'MIC_SILENT', 'CAPTURE_FAULT'))"
    }
   ],
   "dropConstraints": [
    "health_snapshots_cause_check"
   ]
  }
 ],
 "valueSetSwaps": {
  "FAULT_KIND": [
   "CAMERA_LOSS",
   "MIC_NO_SIGNAL",
   "MIC_CLIP",
   "STORAGE_LOW",
   "STORAGE_FULL",
   "GNSS_LOSS",
   "TAMPER",
   "FAN_STALL",
   "POWER_FAIL",
   "TPM_FAILURE",
   "SECURITY_FAULT",
   "AUDIT_TAMPER",
   "MIC_SILENT",
   "CAPTURE_FAULT"
  ],
  "INTEGRITY_SOURCE": [
   "DEMO_PACKAGE",
   "SIMULATED",
   "REAL"
  ]
 },
 "valueSets": {
  "CAPTURE_DEVICE_KIND": [
   "CAMERA",
   "MIC",
   "POE"
  ],
  "MIC_ROLE": [
   "PRIMARY",
   "STANDBY"
  ],
  "TRACK_KIND": [
   "FILE"
  ],
  "LABELS_STATUS": [
   "LABELLED",
   "UNAVAILABLE"
  ],
  "SEALING_JOB_STATUS": [
   "RUNNING",
   "DONE",
   "FAILED"
  ],
  "TRANSCRIPT_CHUNK_STATUS": [
   "PENDING",
   "RUNNING",
   "DONE",
   "FAILED"
  ],
  "SIGNATURE_ALGORITHM": [
   "SIMULATED-SHA256",
   "Ed25519",
   "ECDSA-P256-SHA256"
  ],
  "TRANSCRIPT_SIGNATURE_ALGORITHM": [
   "Ed25519",
   "SIMULATED-SHA256"
  ],
  "STT_BACKEND": [
   "omlx-server",
   "cpu-local"
  ],
  "STT_CREDENTIAL_KIND": [
   "REFERENCE",
   "ENCRYPTED"
  ],
  "AUDIO_INTERVAL_REASON": [
   "START",
   "MANUAL",
   "STOP"
  ],
  "TIME_FORMAT": [
   "24",
   "12"
  ],
  "ENGINE_COUNTER": [
   "event",
   "session",
   "caseNumber",
   "evidence",
   "item",
   "export"
  ],
  "REGISTRY_COUNTER": [
   "device",
   "pairingCode"
  ]
 },
 "noSecretKeys": "NOT (c ?| ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization','secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl','credentialRef','credentialValue','apiKey'])"
} as const;
