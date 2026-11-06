# `src/modules/stt-config`

Up: [`src/modules`](../README.md)

## Purpose

STT configuration: operations 90 (`getSttConfig`), 91 (`updateSttConfig`) and 92 (`testSttConnection`).

## Contents

| File or folder | Role |
|---|---|
| [`change.ts`](./change.ts) | Operation 91 `updateSttConfig`: the one state change of the STT configuration. |
| [`index.ts`](./index.ts) | STT configuration module. |
| [`seams.ts`](./seams.ts) | The two things the STT configuration module asks of other rows. |
| [`statements.ts`](./statements.ts) | The statements of the STT configuration module. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `STT_CONFIG_MODULE_OPERATIONS`, `sttConfigControl`, `sttConfigModule`, `STT_CONFIG_NOT_SEEDED_REASON`, `STT_CONFIG_UNIT_LABEL`, `SealedCredentialRefused`, `sttConfigChanged`, `sttConfigOf`, `Actor`, `SttChangeOutcome`, `SttConfigChanged`, `STT_KEY_REF_PATTERN`, `STT_TEST_QUEUE_LIMIT`, `STT_TEST_TIMEOUT_MS`, `isSealedCredential`, `SealedSttCredential`, `SttConnectionProbe`, `SttCredentialSealer`, `SttProbeOptions`, `SttProbeResult`, `SttProbeTarget`, `LOCK_STT_CONFIG`, `READ_STT_CONFIG`, `SttConfigRowError`, `UPDATE_STT_CONFIG`, `UPDATE_STT_CONFIG_WITH_CREDENTIAL`, `StoredSttConfig`.
- Types exported from `index.ts`: `SttConfigModuleOperation`, `SttConfigControl`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`transcription`](../../transcription/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`core`](../../core/README.md)
- [`credential-store`](../../credential-store/README.md)
- [`plugins/authenticate`](../../plugins/authenticate/README.md)
- [`plugins/error-envelope`](../../plugins/error-envelope/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)
- [`transcription`](../../transcription/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`, `pg`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 6 | 3 |

3 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (1 folders): `src/db/fixtures/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
