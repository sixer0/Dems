# `src/db/migrations`

Up: [`src/db`](../README.md)

## Purpose

The SQL migrations of the Core database, applied in numeric order by `db:migrate`, with the Drizzle journal and snapshots in `meta/`. Table migrations are usually followed by a separate `_privileges` migration that grants access to the database roles.

## Contents

| File or folder | Role |
|---|---|
| [`0000_prelude.sql`](./0000_prelude.sql) | Migration 0000: prelude. The function that check constraints of 0001_tables call: true when the document is a JSON object whose values are strings, numbers, booleans or null. |
| [`0001_tables.sql`](./0001_tables.sql) | Migration 0001: tables. |
| [`0002_audit_guards.sql`](./0002_audit_guards.sql) | Migration 0002: audit guards. Append-only and chain serialisation of the audit table, and append-only of the lineage table. |
| [`0003_privileges.sql`](./0003_privileges.sql) | Migration 0003: privileges. Least privilege for the runtime role the runtime role. |
| [`0004_capture.sql`](./0004_capture.sql) | Migration 0004: capture. |
| [`0005_capture_privileges.sql`](./0005_capture_privileges.sql) | Migration 0005: capture privileges. Least privilege for the runtime role the runtime role over the nine tables 0004 adds, the write-only credential store, and the schema-version bump. |
| [`0006_stt_config.sql`](./0006_stt_config.sql) | Migration 0006: stt config. |
| [`0007_stt_config_privileges.sql`](./0007_stt_config_privileges.sql) | Migration 0007: stt config privileges. R-8, confirmed as Q-STT-CFG at D24; lands as row 112. |
| [`0008_capture_sources.sql`](./0008_capture_sources.sql) | Migration 0008: capture sources. |
| [`0009_capture_sources_privileges.sql`](./0009_capture_sources_privileges.sql) | Migration 0009: capture sources privileges. R-9..R-11; blueprint row 129. |
| [`0010_credential_replace_privileges.sql`](./0010_credential_replace_privileges.sql) | Migration 0010: credential replace privileges. Finding F-84-1 of blueprint row 84, controller-added row 129a. |
| [`0011_session_stt_config.sql`](./0011_session_stt_config.sql) | Migration 0011: session stt config. |
| [`0012_session_stt_config_privileges.sql`](./0012_session_stt_config_privileges.sql) | Migration 0012: session stt config privileges. Requirement R-8 AC-4, check M6-STTCFG-NEXT; controller-added row 129b. |
| [`0013_key_id_fault_reason_media_root.sql`](./0013_key_id_fault_reason_media_root.sql) | Migration 0013: key id fault reason media root. |
| [`0014_key_id_fault_reason_media_root_privileges.sql`](./0014_key_id_fault_reason_media_root_privileges.sql) | Migration 0014: key id fault reason media root privileges. Controller rulings D146, D162, D166. |
| [`0015_capture_streams_audio_inputs.sql`](./0015_capture_streams_audio_inputs.sql) | Migration 0015: capture streams audio inputs. |
| [`0016_capture_streams_audio_inputs_privileges.sql`](./0016_capture_streams_audio_inputs_privileges.sql) | Migration 0016: capture streams audio inputs privileges. Schema design sections 2.1 to 2.3 with design addendum 1.4 #1 and 7.2; decisions U8, U11, C9, C14. |
| [`0017_network_commissioning.sql`](./0017_network_commissioning.sql) | Migration 0017: network commissioning. |
| [`0018_network_commissioning_privileges.sql`](./0018_network_commissioning_privileges.sql) | Migration 0018: network commissioning privileges. Schema design sections 2.4 and 2.5; decisions U10, U11, C9; plan review P12-F07; findings of rows 67 and 156. |
| [`0019_credential_replaced_reason.sql`](./0019_credential_replaced_reason.sql) | Migration 0019: credential replaced reason. |
| [`0020_credential_replaced_reason_privileges.sql`](./0020_credential_replaced_reason_privileges.sql) | Migration 0020: credential replaced reason privileges. Design docs/2026-10-12_input_av_core_adapter_plan/masterplan/05_design_x1_x2.md section 3.6; security review SX-12; decision U19. |
| [`0021_profile_codes_data.sql`](./0021_profile_codes_data.sql) | Migration 0021: profile codes data. Migration set 11: this file, 0022, 0023 (hand-written: t |
| [`0022_profile_codes.sql`](./0022_profile_codes.sql) | Migration 0022: profile codes. |
| [`0023_profile_codes_privileges.sql`](./0023_profile_codes_privileges.sql) | Migration 0023: profile codes privileges. Requirement AD-06. |
| [`0024_installation_acceptance.sql`](./0024_installation_acceptance.sql) | Migration 0024: installation acceptance. |
| [`0025_installation_acceptance_privileges.sql`](./0025_installation_acceptance_privileges.sql) | Migration 0025: installation acceptance privileges. Schema design section 2.6; decisions U11, C2, C9; security finding S13-13. |
| [`0026_alias_removal_reasons.sql`](./0026_alias_removal_reasons.sql) | Migration 0026: alias removal reasons. |
| [`0027_alias_removal_reasons_privileges.sql`](./0027_alias_removal_reasons_privileges.sql) | Migration 0027: alias removal reasons privileges. Decisions C74 and C83 of docs/2026-10-12_input_av_core_adapter_plan/decisions/decisions.md; security finding S13-10. |
| [`0028_alias_removal_reason_unconfirmed.sql`](./0028_alias_removal_reason_unconfirmed.sql) | Migration 0028: alias removal reason unconfirmed. |
| [`0029_alias_removal_reason_unconfirmed_privileges.sql`](./0029_alias_removal_reason_unconfirmed_privileges.sql) | Migration 0029: alias removal reason unconfirmed privileges. Caution R119-05, answer, of docs/2026-10-12_input_av_core_adapter_plan/verification/119_commissioning_securit |
| [`0030_network_config_onvif_ports.sql`](./0030_network_config_onvif_ports.sql) | Migration 0030: network config onvif ports. |
| [`0031_network_config_onvif_ports_privileges.sql`](./0031_network_config_onvif_ports_privileges.sql) | Migration 0031: network config onvif ports privileges. Decisions C114 (finding F-4 of docs/2026-10-12_input_av_core_adapter_plan/verification/120_m10_review |
| [`0032_capture_device_retirement.sql`](./0032_capture_device_retirement.sql) | Migration 0032: capture device retirement. |
| [`0033_capture_device_retirement_privileges.sql`](./0033_capture_device_retirement_privileges.sql) | Migration 0033: capture device retirement privileges. Design docs/2026-10-12_input_av_core_adapter_plan/masterplan/07_design_retire_readopt.md section 4.1 and its security points 1 and 5; decision C147 of... |
| [`0034_capture_config_supervisor_revocation.sql`](./0034_capture_config_supervisor_revocation.sql) | Migration 0034: capture config supervisor revocation. `ROLE_PERMISSIONS` of `@dems/shared/sim/auth` no longer states supervisor -> CAPTURE_CONFIG: the capture topology is the principal's layer and the... |
| [`0035_operator_administration_privileges.sql`](./0035_operator_administration_privileges.sql) | Migration 0035: operator administration privileges. Contract revision of the amendment: area 2 of the Core API grows from five operations to eight — createUser, updateUser and deleteUser, each narrowed to the... |
| [`0036_operator_purge.sql`](./0036_operator_purge.sql) | Migration 0036: operator purge. why. |
| [`0037_operator_credential_creation.sql`](./0037_operator_credential_creation.sql) | Migration 0037: operator credential creation. the gap. |
| [`0038_operator_purge_reseal_correction.sql`](./0038_operator_purge_reseal_correction.sql) | Migration 0038: operator purge reseal correction. why this file exists. |
| [`0039_four_video_tracks.sql`](./0039_four_video_tracks.sql) | Migration 0039: four video tracks. D60: the Core records four video tracks at once. |
| [`0040_four_audio_channels.sql`](./0040_four_audio_channels.sql) | Migration 0040: four audio channels. D61: four simultaneous audio channels — the microphone plane mirrors the video plane. |
| [`0041_capture_widening_privileges.sql`](./0041_capture_widening_privileges.sql) | Migration 0041: capture widening privileges. the companion privilege file of the D60 / D61 widening, missing from it: 0039 added capture_config.video_03_device_id / video_03_profile /... |
| [`0042_capture_config_constraint_repair.sql`](./0042_capture_config_constraint_repair.sql) | Migration 0042: capture config constraint repair. the repair of an edited applied migration. |
| [`0043_operator_purge_scope.sql`](./0043_operator_purge_scope.sql) | Migration 0043: operator purge scope. why this file exists. |
| [`0044_recording_fragments_audio_tracks.sql`](./0044_recording_fragments_audio_tracks.sql) | Migration 0044: recording fragments audio tracks. D28 - blueprint row 146, spec S5 section 3 R-DB-2. |
| [`meta/`](./meta/) | Drizzle migration journal (`_journal.json`) and one schema snapshot per migration (generated by Drizzle Kit). |

## Main exports and entry points

No TypeScript exports. The migrations are applied by `db:migrate` (see [`../commands`](../commands/README.md)) in the order of `meta/_journal.json`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound: no production file outside this folder imports it.

Outbound: imports nothing else inside `src`.


## Tests

No test folder inside this folder.

## Related decisions

From the 2026-11-05 audit decisions log:

- D22: KD-46: a new idempotent migration adds the missing FKs; applied migrations are never edited again.
