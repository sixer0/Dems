# `src/db/schema`

Up: [`src/db`](../README.md)

## Purpose

The typed Drizzle schema of the Core database (tables in schema `public`), grouped by area: RBAC, identity, pairing, audit, sessions, recording, evidence, transcripts, capture, STT and installation. Its `index.ts` is the entry `drizzle.config.ts` names.

## Contents

| File or folder | Role |
|---|---|
| [`audit.ts`](./audit.ts) | Typed schema, group `audit`: T-12 `audit_log`, T-13 `audit_chain_head`, T-14 `events`, T-30 `audit_chain_history`. |
| [`boot-checks.ts`](./boot-checks.ts) | Boot checks B-2 to B-9 of the database contract, as pure async functions over a pool. |
| [`bytea.ts`](./bytea.ts) | The one `bytea` column type of the typed schema. |
| [`capture.ts`](./capture.ts) | Typed schema, group `capture`: T-32 `capture_devices`, T-31 `capture_config`, T-33 `capture_device_credentials`. |
| [`checks.ts`](./checks.ts) | SQL fragments for the check constraints of the typed schema. |
| [`core.ts`](./core.ts) | Typed schema, group `core`: T-21 `alerts`, T-22 `storage_policy`, T-23 `console_settings`, T-24 `engine_counters`, T-25 `core_device`, T-26 `core_state`, T-27 `hardware_snapshot`, T-28... |
| [`evidence.ts`](./evidence.ts) | Typed schema, group `evidence`: T-17 `evidence_items`, T-18 `evidence_tracks`, T-19 `evidence_custody`, T-20 `exports`. |
| [`identity.ts`](./identity.ts) | Typed schema, group `identity`: T-06 `auth_sessions`. |
| [`index.ts`](./index.ts) | The typed schema of the DEMS Core database: 48 tables in schema `public`. |
| [`installation.ts`](./installation.ts) | Typed schema, group `installation`: T-48 `installation_acceptances`. |
| [`meta.ts`](./meta.ts) | Typed schema, group `meta`: T-29 `schema_meta`, and the two constants the server compares it with at boot. |
| [`pairing.ts`](./pairing.ts) | Typed schema, group `pairing`: T-07 `pairing_codes`, T-08 `paired_devices`, T-09 `device_credentials`, T-10 `biometric_tokens`, T-11 `registry_counters`. |
| [`public-columns.ts`](./public-columns.ts) | Public column sets. |
| [`rbac.ts`](./rbac.ts) | Typed schema, group `rbac`: T-01 `roles`, T-02 `permissions`, T-03 `role_permissions`, T-04 `operators`, T-05 `operator_credentials`. |
| [`recording.ts`](./recording.ts) | Typed schema, group `recording`: T-34 `session_audio_intervals`, T-35 `recording_fragments`, T-39 `sealing_jobs`. |
| [`sessions.ts`](./sessions.ts) | Typed schema, group `sessions`: T-15 `active_session`, T-16 `session_history`. |
| [`stt.ts`](./stt.ts) | Typed schema, group `stt`: T-40 `stt_config`. |
| [`transcript.ts`](./transcript.ts) | Typed schema, group `transcript`: T-36 `transcript_chunks`, T-37 `transcripts`, T-38 `transcript_revisions`. |
| [`value-sets.ts`](./value-sets.ts) | The closed value sets of the database contract: the text of every check list. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: * from `./bytea`, * from `./value-sets`, * from `./rbac`, * from `./identity`, * from `./pairing`, * from `./audit`, * from `./sessions`, * from `./evidence`, * from `./core`, * from `./meta`, * from `./capture`, * from `./recording`, * from `./transcript`, * from `./stt`, * from `./installation`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`core`](../../core/README.md): `boot-checks.ts`, `index.ts`
- [`db/commands`](../commands/README.md): `index.ts`
- [`db/mapping`](../mapping/README.md): `index.ts`
- [`db/reset`](../reset/README.md): `boot-checks.ts`, `index.ts`
- [`db/seed`](../seed/README.md): `index.ts`
- [`db/store`](../store/README.md): `index.ts`
- [`engine`](../../engine/README.md): `index.ts`
- [`modules/evidence`](../../modules/evidence/README.md): `index.ts`
- [`modules/identity`](../../modules/identity/README.md): `index.ts`
- [`modules/security-audit`](../../modules/security-audit/README.md): `boot-checks.ts`, `index.ts`
- [`modules/sessions`](../../modules/sessions/README.md): `index.ts`

Outbound: imports nothing else inside `src`.

- Workspace packages: `@dems/shared`
- npm packages: `drizzle-orm`, `pg`

## Tests

No test folder inside this folder.

Tests elsewhere that import it (20 folders): `src/capture/adapters/__tests__`, `src/core/__tests__`, `src/db/fixtures`, `src/db/fixtures/__tests__`, `src/db/mapping/__tests__`, `src/db/reset/__tests__`, `src/db/seed/__tests__`, `src/db/store/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
