---
task_id: 2026-10-07_dems_real_capture_sealing
row: 113 ([R-8|M6|B] STT config contract + API)
agent: coder-execution (DRIVER; pair-programming, navigator to follow)
date: 2026-10-09
status: complete
artifact: implementation/52_m6_stt_config_api.md
---

# Row 113 — driver progress (parallel run: this file replaces any write to the shared trackers)

`status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md` and
`implementation/99_implementation_report.md` were NOT written by this row (shared files, parallel
isolation). The controller synthesises them from this file and from
`implementation/52_m6_stt_config_api.md`.

## Status

**complete.** Operations 90-92 are in the registry, routed in the Core server, emulated by the
simulator; OpenAPI regenerated; every count pin moved to the C3 §2.5 total; M6-STTCFG-API passes in
all three projects. No commit was made.

## Milestones

| # | Milestone | Evidence |
|---|---|---|
| 1 | Contract: `packages/shared/src/api/transcription.ts`; registry 92 / 35 GET / 57 POST; audit types 63 | `[row113] registry totals \| operations=92 GET=35 POST=57` |
| 2 | Simulator parity for 90-92 | `packages/shared/test/openapi.test.ts` flow 13; `sim-api.test.ts` 25 routes |
| 3 | Core-server module `src/modules/stt-config/*`, registered in `src/app.ts:101,322` | MODG line in `52_...md` §4.2 |
| 4 | Audit rule for `STT_CONFIG_CHANGED` (`src/core/audit-details.ts:268`) | `writers.test.ts` 19 allow-listed types |
| 5 | Both log-blanking lists extended | `live-runtime-sink.test.tsx`, `apps/mobile/src/runtime/log.test.ts` |
| 6 | OpenAPI regenerated under `/usr/bin/lockf -k .locks/npm.lock` | 92 operations / offline 26 |
| 7 | Pin sweep across shared, core-server (unit + acceptance), core-web | list with file:line in `52_...md` §3 |
| 8 | Static rule narrowing `dems_stt_credential_reveal` (row 112 residual 3) | `[row113] reveal-function callers ...: (none)` |

## Totals a navigator should reproduce

| Command (each with `</dev/null`) | Result |
|---|---|
| `npm test -w @dems/shared -- --maxWorkers=2` | 73 files, 1894 passed |
| `npm test -w @dems/core-web -- --maxWorkers=2` | 117 files, 1497 passed |
| `npm test -w @dems/mobile -- --maxWorkers=2` | 194 suites, 1999 passed |
| `npm test -w @dems/mock-core -- --maxWorkers=2` (sandbox off) | 4 files, 19 passed |
| `npm test -w @dems/core-server -- --maxWorkers=2` (sandbox off: a fake STT server binds a loopback port) | 3 failed (baseline MODG) \| 4197 passed (4200) |
| `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- --maxWorkers=2` (sandbox off) | 12 failed (baseline, all `contract.test.ts`) \| 1848 passed (1860) |
| `npx vitest run --root packages/shared test/api-stt-config.test.ts --maxWorkers=2 --reporter=verbose` | 19 passed |
| `npx vitest run --root apps/core-server --project unit src/modules/stt-config --maxWorkers=2 --reporter=verbose` (sandbox off) | 2 files, 53 passed |
| `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- src/modules/stt-config --maxWorkers=2 --reporter=verbose` (sandbox off) | 8 passed |
| `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- test/acceptance/rbac-matrix.test.ts --maxWorkers=2` (sandbox off) | 38 passed |
| `node --import tsx packages/shared/scripts/gen-openapi.ts --check` | no drift |
| `npm run typecheck -w @dems/shared` / `-w @dems/core-server`; `npm run lint -w @dems/shared` / `-w @dems/core-server` | exit 0 each |
| `npm run typecheck -w @dems/core-web` / `-w @dems/mobile` | the 3 known `PrecheckCheckId` errors, none added |

`--reporter=verbose` is needed to see the `[row113]` evidence lines (vitest hides the console of passing tests otherwise).

## Blockers

None.

## Decisions for the controller to record (full table: `52_...md` §6)

Three need a confirmation or an owner:

1. **D-113-2** — operation 92 runs a provided probe; with none it answers `503 NOT_READY`
   (`TRANSCRIBER_NOT_READY`). Row 115 must call `sttConfigControl(app).provideProbe(...)`.
2. **D-113-3** — a `SECRET` credential needs a provided sealer (the Core credential store, which
   does not exist in the code yet). Until one is provided a `SECRET` write answers `503 NOT_READY`
   with the NEW reason value `CREDENTIAL_STORE_NOT_READY` and stores nothing; `REFERENCE` and
   `CLEAR` work. Name the row that provides the sealer.
3. **D-113-13 / F-2** — `updateSttConfig` is not on the web Try-it deny list (nor is op 89, whose
   registry comment says it is). Decide in the M6 security row or row 117.

The others (D-113-1, -4 to -12, -14, -15) are recorded as taken: C3 totals and offline 26; the 409
code; the optional `language` member; the comma-joined `changedFields`; one closed credential
object instead of a union; the simulator's unpersisted state; the `pendingForNextSession` rule; no
503 in operation 92's own responses; no row for an unchanged update; the unnamed 422 for a server
backend without an endpoint; blanking by position; one new fixture row.

## Findings outside the row (`52_...md` §7)

- F-1: C3 §2.5 and §1 (:107) still read "PROPOSED / not counted" although D24 confirmed R-8.
- F-3: `.locks/db-migrate.lock` was removed by a `lockf` probe without `-k` and re-created at once (empty, git-ignored, nobody held it).
- F-4: the reveal function writes no audit row; the static rule of this row is its only narrowing control until row 115.

## Files created or updated by this row

Created:

```
packages/shared/src/api/transcription.ts
packages/shared/test/api-stt-config.test.ts
apps/core-server/src/modules/stt-config/index.ts
apps/core-server/src/modules/stt-config/change.ts
apps/core-server/src/modules/stt-config/statements.ts
apps/core-server/src/modules/stt-config/seams.ts
apps/core-server/src/modules/stt-config/__tests__/routes.test.ts
apps/core-server/src/modules/stt-config/__tests__/static.test.ts
apps/core-server/src/modules/stt-config/__tests__/stt-config.db.test.ts
apps/core-server/src/modules/stt-config/__tests__/support.ts
docs/2026-10-07_dems_real_capture_sealing/implementation/52_m6_stt_config_api.md
docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder_execution_row113.md
```

Updated:

```
packages/shared/openapi/openapi.json                      (regenerated)
packages/shared/scripts/gen-openapi.ts                    (comment)
packages/shared/src/api/core-api.ts
packages/shared/src/api/examples.ts
packages/shared/src/api/index.ts
packages/shared/src/api/openapi.ts                        (comments)
packages/shared/src/i18n/en/common.ts
packages/shared/src/sim/api.ts
packages/shared/src/sim/vocabulary.ts
packages/shared/test/api-domain-operations.test.ts
packages/shared/test/api-examples.test.ts
packages/shared/test/api-openapi-scope.test.ts
packages/shared/test/api-registry.test.ts
packages/shared/test/api-state-examples.test.ts           (a title)
packages/shared/test/api-text-rule.test.ts
packages/shared/test/i18n-vocabulary-sync.test.ts
packages/shared/test/openapi.test.ts
packages/shared/test/sim-api.test.ts
apps/core-server/src/app.ts                               (2 lines; shared with row 57)
apps/core-server/src/core/audit-details.ts
apps/core-server/src/core/__tests__/writers.test.ts
apps/core-server/src/db/fixtures/operations.ts
apps/core-server/src/db/fixtures/__tests__/audit-details.test.ts
apps/core-server/src/db/fixtures/__tests__/audit-reference.ts
apps/core-server/src/modules/devices/__tests__/routes.test.ts
apps/core-server/src/plugins/permission-guard/__tests__/access-rules.test.ts
apps/core-server/src/plugins/permission-guard/__tests__/decision.test.ts
apps/core-server/src/plugins/permission-guard/__tests__/guard.test.ts
apps/core-server/src/plugins/permission-guard/__tests__/matrix.test.ts
apps/core-server/src/plugins/permission-guard/__tests__/without-domain-modules.ts
apps/core-server/test/acceptance/contract.test.ts
apps/core-server/test/acceptance/rbac-matrix.support.ts
apps/core-server/test/acceptance/rbac-matrix.test.ts
apps/core-server/test/static/scaffold.test.ts             (shared with row 57)
apps/core-web/src/runtime/error-sink.ts
apps/core-web/src/test/live-api-reference-document.test.tsx
apps/core-web/src/test/live-api-reference-page.test.tsx
apps/core-web/src/test/live-runtime-sink.test.tsx
apps/core-web/src/test/scalar-config.test.ts
apps/mobile/src/runtime/log.ts
apps/mobile/src/runtime/log.test.ts
```

NOT this row's (in the same working tree): `apps/core-server/package.json`, `package-lock.json`,
`apps/core-server/src/index.ts`, `apps/core-server/src/capture/**`, `apps/capture-worker/**`,
`packages/capture-protocol/**`, `apps/core-server/src/modules/capture-config/{index,store}.ts`,
`apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts`,
`apps/core-server/test/static/{credentials,imports}.test.ts`,
`apps/core-server/test/support/capture*.{ts,mjs}`.

## Fix round 1 (navigator findings) — 2026-10-09

**Status: complete**, with one item for a ruling (the CPW1-7 test change, below). Detail and
evidence: `implementation/52_m6_stt_config_api.md`, section "Fix round 1".

| Finding | Outcome |
|---|---|
| N-1 | fixed: one shared rule set `packages/shared/src/api/redaction.ts`, called by both apps; every listed form is a test in both apps. Declined, with a test: a bare `value`/`ref` that nothing marks as a credential |
| N-2 | fixed: deny list 6 -> 8 (ops 89, 91); allowed pin 86 -> 84 |
| N-3 | fixed: D68 header line in `app.ts`; whole-file pin (waived lines removed = frozen W08 hash) in `src/capture/__tests__/static.test.ts` |
| N-5, N-6, N-7, N-16 | fixed |
| N-8 | partly (audit control through the pipeline; responses/events prove the counter only) |
| N-10 | message aligned; simulator SECRET stays 200 (the sim parity test and the "no operation documents 503" rule forbid a simulated 503; C3 §8 precedent of op 89); differences written into the descriptions |
| N-4, N-12 | not this round (erratum / controller) |
| N-9, N-14 | carried to row 115 |
| N-11 (`endpoint: null`), N-13, N-15 | carried / kept (erratum owner; row 118; cosmetic) |

For a ruling: `apps/core-web/src/test/live-runtime-static.test.tsx` (CPW1-7) said the error sink
imports no value. It now says: its only value import is `@dems/shared/redaction`, which itself
imports nothing and names no schema library. Needed for "one implementation, two callers".

Not this row's, new in the tree: `apps/core-server/test/db/contract-inventory.test.ts:68` is red
because the parallel doc erratum renamed the §B.13 heading of `masterplan/04_database_contract.md`.

Totals: shared 1914; core-web 1523; mobile 2020; core-server unit 4 failed (3 baseline MODG + the
one above) | 4202 passed; db 12 failed (baseline) | 1848 passed; M6-STTCFG-API unit 58 passed;
`gen-openapi.ts --check` up to date. No commit.

## Fix round 1, continuation (controller rulings + the row-76 navigator's item) — 2026-10-09

| Item | Outcome |
|---|---|
| Shared model id | `STT_MODEL_ID_PATTERN` / `isSttModelId` / `STT_MODEL_ID_MAX_LENGTH` in `packages/shared/src/api/transcription.ts` (exported through `@dems/shared/api`). 1 to 128 of `A-Z a-z 0-9 . _ -`, first a letter or digit, no `..`, no trailing `.bin` (any case). No `/` is allowed: every id in use is free of it (`ggml-large-v3-turbo` seeded, `whisper-large-v3-turbo`, `mlx-community--whisper-large-v3-turbo-asr-fp16` from `initialization/02_stt_runtime_install.md`). Used by the op-91 body schema (server stage 7 and simulator: `422 INVALID_INPUT`), by `planSttConfigUpdate`, and shown as `pattern` in OpenAPI. Totals unchanged: 92 / 35 / 57 / 63, 158 schemas. The body no longer trims `model` (white space is refused). The ANSWER schema keeps its 255 bound, so a stored row is still readable |
| DB compatibility (read-only) | `0006_stt_config.sql:6` is `"model" text NOT NULL`, no CHECK: laxer than the pattern, no contradiction, no migration |
| Blanking rule set for Node workspaces | `@dems/shared/redaction` (`packages/shared/package.json` exports -> `src/api/redaction.ts`, import-free) and also through `@dems/shared/api`: `redactCredentialText`, `redactCredentialValue`, `isCredentialKeyName`, `isCredentialWriteKind` |
| Ruling 1, `contract-inventory.test.ts:68` | re-pinned to the stable prefix `### B.13 \`stt_config\` (T-40)`; the inventory still yields T-01..T-40 (same test); unit suite back to the 3 baseline failures |
| Rulings 2, 3, 4 | accepted as they stand; both halves of CPW1-7 stay pinned |
| Ruling 5, N-7 race | **tested, deterministic**: the stand-in pool gained `afterNextPoolRead` (another writer commits right after the preview read answered). Two tests: preview refuses + lock would accept -> `409 REVISION_CONFLICT`, nothing sealed, nothing stored, `ROLLBACK`; preview accepts and seals + lock refuses -> 409, the envelope is dropped unstored. Not carried to row 116 |
| Ruling 6, N-8 | **done for all five captures**: events through `unit.events.append` in a real unit; responses through a real answer (the value stored as the path of a loopback endpoint, which operation 90/91 return). The control `{"responses":1,"logs":1,"errorLog":1,"auditRows":1,"events":1}` is now planted through each channel; it also shows the endpoint value reaches no log line and no audit row |

Model-id tests were written together with the pattern (not shown red in a separate run): 20 refused forms x (predicate, schema, shared rule, simulator) in `api-stt-config.test.ts`, 8 refused forms + the ids in use against the server routes.

Totals: shared 74 files / **1936 passed**; core-web **1523**; mobile **2020**; core-server unit **3 failed (baseline MODG) | 4214 passed (4217)**; db (once, `src/modules/stt-config` + the two acceptance files, under the db lock) **12 failed (baseline) | 69 passed**, 0 databases remain; M6-STTCFG-API unit + static 2 files; typecheck + lint shared and core-server exit 0; `gen-openapi.ts --check` up to date.

Files of the continuation: `packages/shared/src/api/transcription.ts`, `packages/shared/openapi/openapi.json`, `packages/shared/test/api-stt-config.test.ts`, `apps/core-server/src/modules/stt-config/__tests__/{routes.test,support}.ts`, `apps/core-server/test/db/contract-inventory.test.ts` (one line, by ruling).

---
*Generated: 2026-10-09; fix round 1 appended 2026-10-09*
