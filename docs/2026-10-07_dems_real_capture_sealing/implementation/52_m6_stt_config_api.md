---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 113 (phase C, milestone M6, class B; R-8 / D20, confirmed D24; CF-11; blueprint rev 2.1)
date: 2026-10-09
agent: coder-execution (DRIVER of the row-113 pair; the navigator reviews and re-runs)
source_plan: identification/02_structured.md rev 2.1 row 113 (:276); masterplan/03_api_contract.md (C3) §2.5 + §1 (:107); masterplan/04_database_contract.md §B.13; masterplan/09_security_design_review.md §10; masterplan/10_test_strategy.md §A.6a (M6-STTCFG-API); implementation/51_m2_stt_config_schema.md §7 residuals 2 and 3
narrative_tier: 3
status: complete — with three decisions for the controller to confirm (§6: D-113-2, D-113-3, D-113-13)
closes: R-8 API half (specs R-8 AC-2/3/7, API side of AC-4); CF-11 (the M6 re-pin); row 112 residual 2 (reads use the granted column list) and residual 3 (the static rule that narrows the reveal function)
depends_on: rows 56, 112, 114
verification: M6-STTCFG-API PASS (shared 19/19, core-server unit 53/53, core-server db 8/8); pins = C3 §2.5 total 92 / 35 GET / 57 POST / 63 audit types; baselines not worse (§5)
---

# Row 113 / R-8: STT configuration contract + API (operations 90, 91, 92)

## 0. Summary

| Item | Result |
|---|---|
| Registry | 89 -> **92 operations, 35 GET / 57 POST**; audit types 62 -> **63** (`STT_CONFIG_CHANGED`, category `DEVICE`); error codes stay **40**; slices stay **30** — the totals C3 §2.5 states (`03_api_contract.md:305-307`), asserted in the tests from the registry and re-derived from C3 by the acceptance reader (§3) |
| Operations | 90 `getSttConfig` GET `/api/v1/transcription/config` (AUTHENTICATED); 91 `updateSttConfig` POST same path (`CAPTURE_CONFIG`); 92 `testSttConnection` POST `/api/v1/transcription/config/test` (`CAPTURE_CONFIG`) — all three ROUTED in the Core server and emulated by the shared simulator |
| RBAC | every signed-in role reads 90; INVESTIGATOR is refused 91 and 92 with `403 NOT_PERMITTED` and one `ACCESS_DENIED` row each; SUPERVISOR and TECHNICIAN pass |
| Next session | a change stored while a session is open is accepted and answers `appliesFrom: NEXT_SESSION` / `pendingForNextSession: true` |
| Audit | one `STT_CONFIG_CHANGED` row per change with exactly `changedFields`, `enabled`, `backend`, `credentialChanged`, `revision`; no row on a refusal or on an update that changes nothing |
| Credential | write-only: answers carry `credentialSet` / `credentialKind` only; planted-credential grep over responses, logs, error log, audit rows and events = **0 hits**, negative control = **1 hit each** |
| Loopback | a non-loopback endpoint is refused `422 INVALID_INPUT` with `details.reason: ENDPOINT_NOT_LOOPBACK` (API rule; the DB CHECK of row 112 stays the backstop) |
| Log blanking | both lists cover the STT credential forms: web `apps/core-web/src/runtime/error-sink.ts:73-77`, mobile `apps/mobile/src/runtime/log.ts:44,59-61` |
| OpenAPI | regenerated under `/usr/bin/lockf -k .locks/npm.lock`: `all` 92 operations, `offline` 26; versions unchanged (0.3.0 / 0.2.0) |
| No migration | `git status --short apps/core-server/src/db/migrations` = 0 lines; the four live databases answer `db:status: OK` (§5.4) |
| Not done here (other rows) | the session-start snapshot and the real probes (row 115), the seal-side states (116), the web menu (117), tablet/phone status (118), the Core credential store that seals a `SECRET` (§6 D-113-3) |

## 1. What was built, and where

### 1.1 Shared contract (`packages/shared`)

| File | Change |
|---|---|
| `src/api/transcription.ts` (new, 598 lines) | value sets, the loopback pattern (`:91`, character-equal to the CHECK of migration 0006), schemas `SttConfig` / `SttConfigUpdateRequest` / `SttConfigUpdateResult` / `SttConnectionTest` / `SttCredentialWrite` / `SttLastTest`, the shared update rule `planSttConfigUpdate` (`:305`), `sttConfigChangedDetails`, `STT_CONFIG_OPERATIONS` (`:384`), examples |
| `src/api/core-api.ts` | schemas and operations appended after op 89 (`...STT_CONFIG_OPERATIONS, // 90-92`) |
| `src/api/examples.ts`, `src/api/index.ts` | examples merged; module exported |
| `src/sim/vocabulary.ts` | `AuditType.STT_CONFIG_CHANGED`, category `DEVICE` |
| `src/i18n/en/common.ts` | label "Transcription configuration changed" |
| `src/sim/api.ts` | three simulator routes (`STT_ROUTES`, `:1020`) + `SIM_API_ROUTES` entries — sim parity for all three (the parity test requires a route per `mode: simulated` operation) |
| `src/api/openapi.ts`, `scripts/gen-openapi.ts` | header comments only (89 -> 92, 23 -> 26) |
| `openapi/openapi.json` | regenerated |

### 1.2 Core server (`apps/core-server`)

| File | Change |
|---|---|
| `src/modules/stt-config/index.ts` (new) | plugin `sttConfigModule` (`:209`), three routes built with `routeOfOperation`, `sttConfigControl(app)` (`:131`) with `provideProbe` / `provideCredentialSealer`, one-at-a-time probe queue with a 3 s limit |
| `src/modules/stt-config/change.ts` (new) | the unit of work `sttConfig.update` (`changeSttConfig`, `:183`): lock, shared rule, credential write, compare-and-set update, audit row; the builder `sttConfigChanged`; fixed-text refusals |
| `src/modules/stt-config/statements.ts` (new) | four constant statements; reads name the eleven granted columns only (`READ_STT_CONFIG`, `:72`); the three credential columns appear once, in the SET list of `UPDATE_STT_CONFIG_WITH_CREDENTIAL` (`:89`) |
| `src/modules/stt-config/seams.ts` (new) | the probe and sealer interfaces, `isSealedCredential` |
| `src/core/audit-details.ts` | exact detail-key rule for `STT_CONFIG_CHANGED` (`:268`) — 18 -> 19 allow-listed types |
| `src/app.ts` | two lines: the import (`:101`) and the unit (`:322`), re-read immediately before the edit (row 57's edits kept) |
| `src/db/fixtures/operations.ts` | one fixture audit row of the new type (the fixture must write every audit type) |

### 1.3 Clients (blanking lists only)

| File | Change |
|---|---|
| `apps/core-web/src/runtime/error-sink.ts` | `redactCredentials` also blanks: a value after `Bearer`; the value of `apiKey` / `api_key` / `credentialValue` / `credentialRef` / `authorization` / `secret`; the `value` / `ref` of a `"kind":"SECRET"\|"REFERENCE"` member. Context members of those names are blanked whole |
| `apps/mobile/src/runtime/log.ts` | the same three text forms; `SENSITIVE_KEY` gains `api key` and `authorization` |

## 2. Behaviour, as the tests state it

| Clause | Observed | Evidence |
|---|---|---|
| op 90 shape | seeded row: `enabled: true, backend: cpu-local, model: ggml-large-v3-turbo, credentialSet: false, revision: 1`; a stored credential shows as `credentialSet: true` + `credentialKind` and nothing else | `routes.test.ts` "operation 90"; `stt-config.db.test.ts` on the real seed |
| op 91 change | `200`, revision +1, `updatedBy` = caller, one transaction (BEGIN ... one audit insert ... COMMIT) | `routes.test.ts` "operation 91" |
| op 91 refusals | stale revision `409 INVALID_STATE` (`REVISION_CONFLICT`, `currentRevision`); `422 INVALID_INPUT` with `ENDPOINT_NOT_LOOPBACK` / `LANGUAGE_NOT_SUPPORTED` / `BACKEND_UNKNOWN`; each ends in `ROLLBACK`, stores nothing, writes no row | 8 parametrised cases + stale-revision case |
| op 91 credential | `REFERENCE`: pointer stored, never answered; `SECRET` + sealer: AES-256-GCM ciphertext + 12-byte nonce + key reference stored, opened again by the key holder; `SECRET` without a sealer: `503 NOT_READY` (`CREDENTIAL_STORE_NOT_READY`), nothing stored; a sealer that does not seal: refused, nothing stored; `CLEAR` | `routes.test.ts` "the credential is write-only"; db test "SUPERVISOR stores a SECRET" |
| op 92 | no probe: `503 NOT_READY` (`TRANSCRIBER_NOT_READY`); with a probe against a FAKE server on an ephemeral loopback port: one `GET /v1/models`, zero body bytes; unreachable = a 200 result; a throwing probe = `UNREACHABLE`, logged and persisted by code; a silent probe = `TIMEOUT` at 3 s with its signal aborted; three concurrent calls never overlap | `routes.test.ts` "operation 92" (7 tests) |
| runtime role | `SELECT credential_ref` / `secret_ciphertext` / `nonce` / `*` on `stt_config` = `42501`, also after the module wrote them | `stt-config.db.test.ts` |
| reveal function | no production source outside `src/db/migrations/` names `dems_stt_credential_reveal`; allow-list empty until row 115 adds its one file | `static.test.ts` rule 1 |

No real STT server was contacted by any test. Port 8000 is not named by any test request; oMLX was never started or called.

## 3. Pin sweep (the C3 total, in every workspace)

Old totals 89 / 34 / 55 / 62 and the offline 23 / 22. Every assertion below was a genuine count pin and moved to the C3 §2.5 value. The acceptance reader now COMPOSES C3 §2.5 as well as §2.2 (`rbac-matrix.support.ts`, `API_CONTRACT_SECTIONS`), so the 92 is read from the contract document, not typed: "the composed document holds operations 1 to 92 and the registry holds the same 92".

```
apps/core-server/src/core/__tests__/writers.test.ts:53            toHaveLength(63)            audit types
apps/core-server/src/core/__tests__/writers.test.ts:272           toHaveLength(19)            allow-listed types
apps/core-server/src/db/fixtures/__tests__/audit-details.test.ts:159   'ALLOW-LIST': 19
apps/core-server/src/db/fixtures/__tests__/audit-details.test.ts:263,276   toHaveLength(63)
apps/core-server/src/plugins/permission-guard/__tests__/access-rules.test.ts:58,60   92
apps/core-server/src/plugins/permission-guard/__tests__/access-rules.test.ts:71      AUTHENTICATED: 30, PERMISSION: 52
apps/core-server/src/plugins/permission-guard/__tests__/decision.test.ts:108         cells 828 (92 x 9)
apps/core-server/src/plugins/permission-guard/__tests__/guard.test.ts:251            92
apps/core-server/src/plugins/permission-guard/__tests__/matrix.test.ts:35            92
apps/core-server/src/modules/devices/__tests__/routes.test.ts:104-108                Device tag area + the three STT operations
apps/core-server/test/acceptance/contract.test.ts:414-419     92 / 92 / 92 / 92 / 35 GET / 57 POST
apps/core-server/test/acceptance/contract.test.ts:446-447     router 79 (75 + 3 STT + /ws)
apps/core-server/test/acceptance/contract.test.ts:480         documented 92
apps/core-server/test/acceptance/rbac-matrix.test.ts:944-947  92 (composed from the documents)
apps/core-server/test/acceptance/rbac-matrix.test.ts:983      AUTHENTICATED: 30, PERMISSION: 52
apps/core-server/test/acceptance/rbac-matrix.test.ts:1072     delta rows 17 (14 of §2.2 + 3 of §2.5)
apps/core-server/test/acceptance/rbac-matrix.test.ts:1128     routed 78
apps/core-server/test/static/scaffold.test.ts:49,51           units 24 / modules 16 (includes row 57's two)
apps/core-web/src/test/live-api-reference-document.test.tsx:135,145,206,236,334,338   26 / 92 / 25 / 92 / 86 / 86
apps/core-web/src/test/live-api-reference-page.test.tsx:132,135,292,293,302,303,322    92 / 26
apps/core-web/src/test/scalar-config.test.ts:75               26
packages/shared/test/api-registry.test.ts:285,311,313,314,315,470,476,479,520,690,691,692,705,758,1050
                                                              92 / 35 / 57 / 63 / [4,5,30,52,1] / 53 / 26 / +6 schemas
packages/shared/test/api-registry.test.ts:999                 Table['length'] 92 (type-level), Table[89], Table[91]
packages/shared/test/api-openapi-scope.test.ts:247,291,299,300,302,303,315,373,420,431,526
                                                              26 / 92 / 87 paths / 35 / 57 / 25 simulated / 53 / [3,1,6,82] / '92 operations' / 158 schemas
packages/shared/test/openapi.test.ts:167,168,180,188,216,684  26 / 26 / 25 / 25 / 92 / Core-server-only statuses 23
packages/shared/test/api-text-rule.test.ts:158,222            32 request bodies / 140 schemas
packages/shared/test/api-examples.test.ts:76                  82
packages/shared/test/api-domain-operations.test.ts:662        92 - 41 = 51
packages/shared/test/i18n-vocabulary-sync.test.ts:140         63 (+ last type STT_CONFIG_CHANGED -> DEVICE)
packages/shared/test/sim-api.test.ts:41,42                    25 simulator routes
```

Mobile and mock-core hold no operation-count pin (both suites pass untouched apart from the new blanking test). Stale-pin grep after the sweep (`toHaveLength\((89|62)\)|toBe\((89|801)\)|toEqualTypeOf<89>|89 operations|34 GET|55 POST` over shared, core-server, core-web, mobile, mock-core sources and tests): the only hits are two historical comments (`core-api.ts:1028` "75 + 14 = 89", `client-types.test.ts:209` "Regression for contract C (89 operations)").

Test-support changes that are not count pins: `without-domain-modules.ts` stubs the new module too (the "app without the domain modules" must not grow routes); `audit-reference.ts` registers the module's builder for the fixture comparison; `rbac-matrix.test.ts` AC-B-16 per-role denied count is now `stated(base) + recomputed(routed C3 rows)` = +2 for INVESTIGATOR (ops 91, 92); both acceptance servers get a stand-in probe (D-113-10).

## 4. M6-STTCFG-API — commands and output

### 4.1 Shared half

`npx vitest run --root packages/shared test/api-stt-config.test.ts --maxWorkers=2 --reporter=verbose </dev/null`

```
[row113] M6-STTCFG-API next-session | status=200 appliesFrom=NEXT_SESSION pendingForNextSession=true revision=3
[row113] M6-STTCFG-API credential grep (simulator) | answers=10 auditRows=86 bytes=53148 secretHits=0 referenceHits=0
[row113] M6-STTCFG-API credential grep negative control | plantedHits=1
      Tests  19 passed (19)
```

### 4.2 Core-server unit + static (sandbox OFF: the fake STT server binds an ephemeral loopback port)

`npx vitest run --root apps/core-server --project unit src/modules/stt-config --maxWorkers=2 --reporter=verbose </dev/null`

```
[row113] reveal-function callers outside src/db/migrations/: (none) | allowed: (none yet; row 115 adds one)
[row113] MODG routes of src/modules/stt-config: GET /api/v1/transcription/config getSttConfig | POST /api/v1/transcription/config updateSttConfig | POST /api/v1/transcription/config/test testSttConnection
[row113] registry totals | operations=92 GET=35 POST=57
[row113] M6-STTCFG-API INVESTIGATOR | op91=403 NOT_PERMITTED | op92=403 NOT_PERMITTED
[row113] M6-STTCFG-API audit detail | [{"changedFields":"backend,endpoint,model,diarization","enabled":true,"backend":"omlx-server","credentialChanged":false,"revision":2}]
[row113] M6-STTCFG-API refusal | a LAN address -> 422 INVALID_INPUT reason=ENDPOINT_NOT_LOOPBACK
[row113] M6-STTCFG-API refusal | a public host name -> 422 INVALID_INPUT reason=ENDPOINT_NOT_LOOPBACK
[row113] M6-STTCFG-API refusal | loopback over TLS -> 422 INVALID_INPUT reason=ENDPOINT_NOT_LOOPBACK
[row113] M6-STTCFG-API refusal | a host that only starts with the loopback address -> 422 INVALID_INPUT reason=ENDPOINT_NOT_LOOPBACK
[row113] M6-STTCFG-API refusal | credentials in the URL -> 422 INVALID_INPUT reason=ENDPOINT_NOT_LOOPBACK
[row113] M6-STTCFG-API refusal | the wildcard address -> 422 INVALID_INPUT reason=ENDPOINT_NOT_LOOPBACK
[row113] M6-STTCFG-API refusal | another language -> 422 INVALID_INPUT reason=LANGUAGE_NOT_SUPPORTED
[row113] M6-STTCFG-API refusal | an unknown backend -> 422 INVALID_INPUT reason=BACKEND_UNKNOWN
[row113] M6-STTCFG-API next-session | status=200 appliesFrom=NEXT_SESSION pendingForNextSession=true revision=3
[row113] M6-STTCFG-API test-connection | fake=http://127.0.0.1:<ephemeral> status=200 {"reachable":true,"modelAvailable":true,"backend":"omlx-server","detailCode":"OK"} requests=1
[row113] M6-STTCFG-API credential grep | responses=16 (10383 bytes) logLines=36 (8903 bytes) errorLog=0 bytes auditRows=5 (1957 bytes) | secret={"responses":0,"logs":0,"errorLog":0,"auditRows":0,"events":0} reference={"responses":0,"logs":0,"errorLog":0,"auditRows":0,"events":0}
[row113] M6-STTCFG-API credential grep negative control | planted={"responses":1,"logs":1,"errorLog":1,"auditRows":1,"events":1}
 Test Files  2 passed (2)
      Tests  53 passed (53)
```

The grep run sends the planted secret and the planted reference in 16 requests (two refused by stage 6, three accepted writes, a 409, five 422s, a truncated-JSON 400, a CLEAR, reads and a test), captures the log at level `trace`, and also searches the base64 and hex forms of the secret. The negative control writes the same value into each capture and finds it once in each.

### 4.3 Core-server db (throw-away clone; sandbox OFF for the database connection)

`/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- src/modules/stt-config --maxWorkers=2 --reporter=verbose </dev/null`

```
[row113] M6-STTCFG-API next-session (PostgreSQL) | status=200 appliesFrom=NEXT_SESSION pendingForNextSession=true revision=4
[row113] M6-STTCFG-API credential grep (PostgreSQL) | audit_log=26744 bytes events=8266 bytes sttRows=3 | secret: audit=0 events=0 | reference: audit=0 events=0
[row113] M6-STTCFG-API credential grep negative control (PostgreSQL) | storedKeyRefHits=1
      Tests  8 passed (8)
```

### 4.4 OpenAPI regeneration

`/usr/bin/lockf -k .locks/npm.lock node --import tsx packages/shared/scripts/gen-openapi.ts`

```
wrote packages/shared/openapi/openapi.json (all (committed): 92 operations, 2 security schemes, version 0.3.0; offline: 26 operations, 0 security schemes, version 0.2.0; 1170533 bytes)
```

No dependency was added; this row did not write `package-lock.json` (its diff in the tree is row 57's).

## 5. Baselines (each `--maxWorkers=2 </dev/null`)

| Suite | Command | Baseline | Now |
|---|---|---|---|
| shared | `npm test -w @dems/shared -- --maxWorkers=2` | 1875 pass | **73 files, 1894 passed** (+19 new) |
| core-web | `npm test -w @dems/core-web -- --maxWorkers=2` | 1496 pass | **117 files, 1497 passed** (+1 new) |
| mobile | `npm test -w @dems/mobile -- --maxWorkers=2` | 1997 pass | **194 suites, 1999 passed** (+2 new) |
| mock-core | `npm test -w @dems/mock-core -- --maxWorkers=2` | 19 pass | 4 files, 19 passed |
| core-server unit | `npm test -w @dems/core-server -- --maxWorkers=2` (sandbox OFF) | 3 failed (MODG) | **3 failed \| 4197 passed (4200)** — the same three: `modules/sessions/__tests__/routes.test.ts` x2, `modules/evidence/__tests__/routes.test.ts` x1 |
| core-server db | `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- --maxWorkers=2` (sandbox OFF) | 12 failed, all `contract.test.ts` | **12 failed \| 1848 passed (1860)**, 1 file failed of 128 — the same twelve blocks |
| typecheck | `npm run typecheck -w @dems/shared`, `-w @dems/core-server` | exit 0 | exit 0, exit 0 |
| lint | `npm run lint -w @dems/shared`, `-w @dems/core-server` | exit 0 | exit 0, exit 0 |
| typecheck core-web / mobile | `npm run typecheck -w @dems/core-web`, `-w @dems/mobile` | 3 `PrecheckCheckId` errors | the same 3 (`devices-step.tsx` :27 and :267, `check-icon.tsx` :9); none added |

### 5.1 The twelve red db tests add nothing for this row

The twelve names equal the list of `implementation/66_recon_core_tests.md` items 4 and 6-13 plus the three SC6 summaries. The three new operations are routed and appear in those blocks only as PASSING lines:

```
[w52]   getSttConfig [AUTHENTICATED]: 403 ORIGIN_NOT_ALLOWED (a session cookie with an Origin that is no web console origin)
[w52]   updateSttConfig [CAPTURE_CONFIG]: 403 NOT_PERMITTED (the INVESTIGATOR lacks CAPTURE_CONFIG)
[w52]   testSttConnection [CAPTURE_CONFIG]: 403 NOT_PERMITTED (the INVESTIGATOR lacks CAPTURE_CONFIG)
[w52]   updateSttConfig body.backend (U+0000): 422 INVALID_INPUT          (and nine more members, all 422)
[w52]   getSttConfig: 200; 401 NOT_SIGNED_IN; 403 ORIGIN_NOT_ALLOWED
[w52]   updateSttConfig: 200; 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 NOT_PERMITTED; 409 INVALID_STATE; 422 INVALID_INPUT
[w52]   testSttConnection: 200; 401 NOT_SIGNED_IN; 403 NOT_PERMITTED
```

Every documented status of the three was produced (the new block "the STT configuration (operations 90 to 92...)" in `contract.test.ts` passes). `test/acceptance/rbac-matrix.test.ts` passes whole (38/38) with 78 routed operations per caller.

### 5.2 A contract-walk rule this row had to meet

The first draft wrote the `credential` member as a discriminated union. `contract.support.ts:435` refuses a union in a request schema ("the walker of the contract test does not handle it"), which would have made the whole `contract.test.ts` file fail to load. The member is now one closed object with a cross-member rule that accepts exactly `{kind: REFERENCE, ref}`, `{kind: SECRET, value}` and `{kind: CLEAR}` (`transcription.ts`, `SttCredentialWriteSchema`).

### 5.3 Concurrent rows

A mid-work unit run showed 12 failures under `src/capture/__tests__/` (row 57's untracked folder; no file of this row is imported there). They were gone in the final run above; nothing of row 57 or row 111 was edited by this row except the shared pin file `test/static/scaffold.test.ts` (their two units and this row's one, counted together) and `src/app.ts` (two added lines).

### 5.4 Databases

No migration, schema, seed or reset file changed. Read-only status through the repo's own command:

```
db:status: OK: dems_demo is at the schema version this code expects and the ledger matches the files.
db:status: OK: dems_lane_1 is at the schema version this code expects and the ledger matches the files.
db:status: OK: dems_lane_2 is at the schema version this code expects and the ledger matches the files.
db:status: OK: dems_lane_3 is at the schema version this code expects and the ledger matches the files.
```

Every db test ran on throw-away databases of its own run prefix: `teardown: dropped 8 database(s) ...; 0 remain with the run prefix`. No lane stack was restarted; ports 4421-4423, 5173-5178, 8000, 8081, 5432 were not touched.

## 6. Decisions taken in this row (for the decision log)

| ID | Decision | Why | Needs confirmation |
|---|---|---|---|
| D-113-1 | Totals are C3 §2.5's: 92 / 35 / 57 / 63, codes 40, slices 30. The `offline` scope grows 23 -> 26 because all three are `mode: simulated` (C3 §8 rule); OpenAPI versions stay 0.3.0 / 0.2.0 (C3 §2.5 names no version change) | C3 §2.5, §8 | no |
| D-113-2 | Operation 92 runs a PROVIDED probe (`sttConfigControl(app).provideProbe`). With none provided it answers `503 NOT_READY` (`TRANSCRIBER_NOT_READY`) — the contract's own answer. The server itself opens no outbound connection | static guard `test/static/network.test.ts` (SR-03) forbids one; row 115 owns "test-connection probes" by its row text | **yes** — row 115 must call `provideProbe` |
| D-113-3 | A `SECRET` credential is stored only as ciphertext from a PROVIDED sealer. With none provided: `503 NOT_READY` with `details.reason: CREDENTIAL_STORE_NOT_READY`, nothing stored. `REFERENCE` and `CLEAR` work now | no "Core credential store" exists in the code yet (dbc-3 §B.3 SEC35-03 assigns it; rows 66/84); storing a secret weaker than the contract was not an option. `CREDENTIAL_STORE_NOT_READY` is a NEW reason value (the code `NOT_READY` is existing) | **yes** — name the row that provides the sealer; until then the web menu (row 117) can only set a reference |
| D-113-4 | Stale revision = `409 INVALID_STATE` with `details.reason: REVISION_CONFLICT` and `currentRevision` | C3 says "the same optimistic-revision refusal as op 78", but op 78 defines none; `db/schema/stt.ts:70` already names `REVISION_CONFLICT`; an existing code keeps the count at 40 | no |
| D-113-5 | The body accepts an optional `language` member (C3's member list omits it) | C3 names the reason `LANGUAGE_NOT_SUPPORTED`, unreachable without the member; UX §8a lists language in the menu | no |
| D-113-6 | `changedFields` is the field names joined with a comma, not a list | an audit detail is a flat map (payload rule + DB CHECK); a list cannot be stored | no |
| D-113-7 | The `credential` request member is one closed object with a cross-member rule, not a union | §5.2 | no |
| D-113-8 | The simulator keeps its STT configuration beside the store (not in `SimState`), unpersisted | C3 §2.5 keeps the replicated state at 30 slices | no |
| D-113-9 | `pendingForNextSession` = a session is open AND `stt_config.updated_at >= active_session.created_at`; `lastTest` is kept in memory (not configuration, not stored) | no extra column; durable across restarts for the first, by design not for the second | row 115: if the snapshot is taken at recording start rather than at creation, tell this row's rule |
| D-113-10 | Operation 92 does not list 503 among its own responses | registry rule `api-registry.test.ts`: no operation documents 405/413/429/500/503 (envelope level). The two acceptance servers therefore get a stand-in probe that contacts nothing, so a permitted cell gets its documented 200 | no |
| D-113-11 | An update that changes nothing writes no row and keeps the revision | the precedent of operation 55 | no |
| D-113-12 | `omlx-server` without an endpoint is `422 INVALID_INPUT` with no named reason | the table's `stt_config_endpoint_required_check`; C3 names only three reasons | no |
| D-113-13 | `updateSttConfig` was NOT added to the web Try-it deny list | out of this row's file scope; see finding F-2 | **yes** |
| D-113-14 | The two blanking lists blank the STT credential by position (after `Bearer`, under a credential-named member, the `value`/`ref` of a credential write), because the key has no prefix of this product | SEC35-14 | no |
| D-113-15 | The bulk fixture gained one `STT_CONFIG_CHANGED` row, held against the module's own builder | the fixture must write every audit type | no |

## 7. Findings outside this row

| # | Finding | Where it lands |
|---|---|---|
| F-1 | `masterplan/03_api_contract.md` still calls §2.5 "PROPOSED — pending Q-STT-CFG" and §1 (:107) "proposed, not counted", although D24 confirmed it. Not edited here (not this row's file). The acceptance reader maps §2.5's "none on success (no state change)" audit cell to the registry marker `NONE-P` | controller / a doc row |
| F-2 | Web Try-it in Live mode can send the body of `updateSttConfig` (a possible credential). The same gap exists for op 89: `devices.ts:736` says "the API Reference offers no Try it for this operation" but `TRY_IT_DENIED_OPERATIONS` (`apps/core-web/src/features/api-reference/try-it.ts:35`) holds only the six of AR-3a | security row of M6 / row 117 |
| F-3 | While probing whether the db lock was free I ran `lockf -t 0 .locks/db-migrate.lock true` without `-k`, which removes the lock file; I re-created it at once with `lockf -k`. It is an empty, git-ignored file and nobody held it | none; noted for honesty |
| F-4 | The reveal function still writes no audit row (row 112 residual 3). The static rule of this row is its only narrowing control; row 115 adds its one file to `STT_REVEAL_CALLERS` in `modules/stt-config/__tests__/static.test.ts` | row 115 |

## Fix round 1 (navigator findings) — 2026-10-09

Source: `delegation_progress/pair_113_navigator.md` (ACCEPT-WITH-FINDINGS: 0 blocker, 4 major, 12 minor) and the controller's ruling (D68; sealer owner = row 84; N-4 and N-14 not in this round).

### R1.1 Outcome per finding

| # | Outcome | What changed |
|---|---|---|
| N-1 (major) | **fixed** | One rule set, two callers: `packages/shared/src/api/redaction.ts` (new, dependency-free; subpath `@dems/shared/redaction`). `apps/core-web/src/runtime/error-sink.ts` and `apps/mobile/src/runtime/log.ts` now only call it; their own regexes are gone. Text rule: tokens by prefix; whatever follows `Bearer`; the value of every member whose NAME says credential (`apiKey`, `api_key`, `x-api-key`, `authorization`, `credential`, `credentialValue`, `credentialRef`, `credential.value`, `secret`, `client_secret`, ...) in any quoting or escaping depth; and, in a text that mentions a credential or a credential `kind`, also `value` and `ref` in either member order. It fails closed: an unterminated value is blanked to the end, `authorization` to the end of its line. Objects: by member name at ANY depth, `value`/`ref` beside a credential `kind`, and whole below depth 12 (was: returned raw below depth 4). Every form of the navigator's §3.5 is a test in both apps and in shared |
| N-1, declined part | **declined, with a test** | A bare `value: X` in a text that names no credential, and a context member `value` / `ref` with no credential `kind` beside it and no credential-named parent, are NOT blanked: `value` is an ordinary member name (`{"kind":"PACKAGE","value":"EXPJ-000001"}`), and a rule that blanked them all would leave no log. Test "N-1: text that only looks alike is left alone" (both apps) and `redaction.test.ts` hold the boundary |
| N-2 (major) | **fixed** | `TRY_IT_DENIED_OPERATIONS` holds eight: + `setCaptureDeviceCredential` (89), `updateSttConfig` (91) (`apps/core-web/src/features/api-reference/try-it.ts`). Pins: allowed 86 -> **84**; list length 6 -> **8**. New tests show a Try-it POST of 91 and 89 (three spellings each) never calls the network, and that 90, 92 and 76 still do. Supersedes D-113-13 |
| N-3 (major) | **fixed** | `app.ts` header gains one line recording D68 (row 57's header lines untouched). `src/capture/__tests__/static.test.ts` gains ONE test in the P25 block: the file with the 16 waived lines removed (each where it stands) must hash to the frozen W08 file (`3846e170...`, `git show 9d3a1ef:apps/core-server/src/app.ts`); the three STT lines are pinned by exact text; in-test controls prove an extra line and a changed waived line both fail it |
| N-4 (major, doc) | **not in this round** (controller) | C3 / 01_specs erratum is another agent's |
| N-5 | **fixed** | A change of `backend` / `endpoint` / `model` / `credential` forgets `lastTest` (server and simulator, shared `sttChangeInvalidatesLastTest`); a test that was in flight across such a change is not kept either |
| N-6 | **fixed** | At most `STT_TEST_QUEUE_LIMIT` = 4 tests run or wait; one more answers `503 NOT_READY` (`TRANSCRIBER_NOT_READY`) at once. The probe's duty to honour `abort` is stated in `seams.ts`; its test is row 115's |
| N-7 | **fixed** | The secret is sealed BEFORE the unit of work, and only for a body a preview read accepts (no envelope, no key, for a stale revision or a refused value). If the row moves between preview and lock the unit answers the ordinary `409 REVISION_CONFLICT` |
| N-8 | **partly fixed** | The audit negative control is now planted through the pipeline (a real unit's row). For `responses` and `events` it still proves the counter only: the module has no channel a test can plant through without a route of its own. Said in the test |
| N-9 | carried -> **row 115** | accepted as the documented SEC35-02 alternative |
| N-10 | **fixed / decided** | Message parity: one constant `STT_CONFIG_CHANGED_MESSAGE` = "STT configuration changed", written by both. SECRET in the simulator: **kept at 200 (opaque accept)** — the sim contract says otherwise than the server here: `packages/shared/test/openapi.test.ts` requires the statuses the simulator produces to EQUAL the operation's documented offline statuses, and the registry rule forbids an operation documenting 503; C3 §8 already states the same for op 89 ("the simulator accepts the write opaquely and never stores or echoes a credential"). `implementation/61_m2_sim_capture_routes.md` holds no rule that asks for more. Both service differences (SECRET, operation 92 always 200) are now written into the operation descriptions |
| N-11 | none required; `endpoint: null` to clear is carried -> **erratum owner** (a contract change) | |
| N-12 | carried -> **controller / erratum** | |
| N-13 | none; noted for **row 118** | |
| N-14 | not in this round -> **row 115** | |
| N-15 | **kept** (cosmetic, D-113-9) | |
| N-16 | **fixed** | mobile `sanitizeLogContext` drops `value` / `ref` beside a credential `kind`, and every credential-named key |

### R1.2 One existing test was changed on purpose (please rule on it)

`apps/core-web/src/test/live-runtime-static.test.tsx` (CPW1-7) asserted that the error sink imports NO value, because `main.tsx` loads the sink before `z.config`. "One implementation, two callers" needs one import. The assertion is now: the sink's only value import is `@dems/shared/redaction`, **and** that module imports nothing at all, names neither `zod` nor `require(`, and is the file the package manifest exports. The purpose of CPW1-7 (no module that could build a schema is loaded early) is held in full; the literal "no value import" is not. The first attempt imported `@dems/shared/api` and that test caught it.

### R1.3 Red before green

| Tests | Red run | After |
|---|---|---|
| N-1 forms, core-web `live-runtime-sink.test.tsx` | 19 failed | 33 passed |
| N-1 forms + N-16, mobile `runtime/log.test.ts` | `Tests: 19 failed, 13 passed` | 32 passed |
| N-2, `live-api-reference-document.test.tsx` | `3 failed \| 112 passed` | passed (124 with the page file) |
| N-5, N-6, N-7, N-10 (server), `stt-config/__tests__/routes.test.ts` | `4 failed \| 41 passed` | passed |
| N-10 (simulator), `api-stt-config.test.ts` | `1 failed \| 18 passed` | 19 passed |
| N-3 pin | not shown red as a run: the header line was added first. Its two in-test controls (an extra line; a changed waived line) are the proof it can fail | passed |

### R1.4 Re-run totals (each `--maxWorkers=2 </dev/null`)

| Suite | Result |
|---|---|
| shared | 74 files, **1914 passed** |
| core-web | 117 files, **1523 passed** |
| mobile | 194 suites, **2020 passed** |
| core-server unit (sandbox off) | **4 failed \| 4202 passed (4206)**: the three baseline MODG tests, plus `test/db/contract-inventory.test.ts:68` — see R1.5 |
| core-server db (once, under `lockf -k .locks/db-migrate.lock`, sandbox off) | **12 failed \| 1848 passed (1860)**, the same twelve in `contract.test.ts`; teardown dropped 8, 0 remain |
| M6-STTCFG-API unit + static | 2 files, **58 passed**; credential grep 0 hits in all five captures, negative control 1 in each |
| M6-STTCFG-API shared | 19 passed; `redaction.test.ts` 20 passed |
| P25 pin file `src/capture/__tests__/static.test.ts` | 23 passed |
| typecheck + lint, shared and core-server | exit 0 each; lint core-web and mobile exit 0 |
| typecheck core-web / mobile | the same 3 `PrecheckCheckId` errors (2 + 1) |
| `gen-openapi.ts --check` | up to date (92 operations; offline 26) — regenerated under `lockf -k .locks/npm.lock` after the description changes |

### R1.5 One new red unit test that is not this row's

`test/db/contract-inventory.test.ts:68` expects the text `### B.13 \`stt_config\` (proposed T-40)` in `masterplan/04_database_contract.md`. The doc erratum running in parallel changed that heading to `(T-40) ... (CONFIRMED — D24 ...) Erratum PE-R8-02` (`git diff` of the doc shows exactly that line). Neither the test (last touched by commit b24405e) nor the doc is a file of this row. Owner: the erratum agent re-pins :68.

### R1.6 Files of this round

New: `packages/shared/src/api/redaction.ts`, `packages/shared/test/redaction.test.ts`.
Changed: `packages/shared/package.json` (one `exports` line; no dependency, no lockfile write), `packages/shared/src/api/{index,transcription}.ts`, `packages/shared/src/sim/api.ts`, `packages/shared/openapi/openapi.json`, `packages/shared/test/api-stt-config.test.ts`; `apps/core-web/src/runtime/error-sink.ts`, `apps/core-web/src/features/api-reference/try-it.ts`, `apps/core-web/src/test/{live-runtime-sink,live-runtime-static,live-api-reference-document,live-api-reference-page}.test.tsx`; `apps/mobile/src/runtime/{log,log.test}.ts`; `apps/core-server/src/app.ts` (one header line), `apps/core-server/src/modules/stt-config/{index,change,seams}.ts`, `.../__tests__/{routes,static}.test.ts`, `apps/core-server/src/capture/__tests__/static.test.ts` (one import, one test in the P25 block; nothing else of row 57's).

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

## Fix round 2 (navigator re-check) — 2026-10-09

Scope: `packages/shared/src/api/redaction.ts`, one pattern detail in `transcription.ts`, their tests. No exported name or signature changed (`apps/transcriber` imports both). One export added: `CREDENTIAL_WALK_NODE_BUDGET`.

| # | Outcome |
|---|---|
| R-2 | **fixed.** The object walk keeps the set of objects it is INSIDE of (a reference back to one is blanked: a cycle costs one visit, not branching^12) and a node budget `CREDENTIAL_WALK_NODE_BUDGET` = 2000; past it every object, list and text not yet reached is `***`. An object used twice without a cycle is still walked both times. Tests assert structure, not time: an object with 2 / 3 / 4 / 8 references to itself has each reference READ exactly once; a diamond 2^11 wide stays within `2 x budget` member reads; a list of budget + 500 items keeps item 0 as it came, answers `***` for the last, and blanks a text past the budget |
| R-1 | **fixed for the listed forms.** `Bearer` / `Basic` with a quoted value, in any case, with tokens holding `:` or `%`; a header tuple `["authorization","…"]` / `["X-Api-Key","…"]`; ONE predicate `isCredentialKeyName` for the text rule and the object rule (a name holding `credential` except the three flags, `apikey`, `secret`, `password`, `passphrase`, `authorization`, or ending in `token`), so `credentials`, `sttCredential`, `apiKeyValue`, `secretKey`, `token`, `access_token`, `password`, `API Key` are blanked by both; `kind` / `value` / `ref` in any case in text and object; a URL-encoded body (judged and returned decoded when it names a credential) |
| R-1, declined with boundary tests | `key` alone (storage keys and list keys in every log; an existing mobile test logs `key: 'dems.sim.v1'`); prose after a scheme (`Basic authentication`, `a bearer of news`); an unquoted value that itself holds `,` `;` `&` (the value ends there — the canonical `credentialRef: x, next` needs it); unicode-escaped names and free prose (not attempted) |
| R-1, behaviour changes to know | `credentials: same-origin` (the fetch option) now reads `credentials: ***` — the earlier boundary case was removed from three tests; the tuple rule is limited to header names, because in `"kind":"SECRET","value":…` the text `SECRET` is also "a quoted text, a comma, a quoted text" |
| R-4 | **fixed.** `STT_MODEL_ID_PATTERN` refuses a trailing `.` (`model.`, `ggml-large-v3.`); OpenAPI regenerated under `lockf -k .locks/npm.lock`, `--check` up to date, 92 operations / offline 26 |
| R-3 | carried to row 117 (not attempted) |

Red first: the R-1 / R-2 tests ran red before the change (`3 failed | 20 passed (51)`, the run stopping on the 4- and 8-reference objects, which is finding R-2 itself). The two R-4 cases were added in the same edit as the look-ahead and were not shown red in a run of their own.

Totals (each `--maxWorkers=2 </dev/null`): shared 74 files / **1969 passed**; core-web 117 / **1523**; mobile 194 suites / **2020**; transcriber (`npm run test -w @dems/transcriber`) 8 files / **259 passed, 1 skipped**; core-server `src/modules/stt-config` unit 2 files / 69 passed; typecheck + lint shared exit 0. One `tsc` run of shared answered exit 2 while another row was editing `packages/shared/src/**` in the same tree; the two runs after it answered 0 with my files unchanged.

Files: `packages/shared/src/api/redaction.ts`, `packages/shared/src/api/transcription.ts` (one pattern + its comment), `packages/shared/openapi/openapi.json`, `packages/shared/test/redaction.test.ts`, `packages/shared/test/api-stt-config.test.ts`; one removed boundary line each in `apps/core-web/src/test/live-runtime-sink.test.tsx` and `apps/mobile/src/runtime/log.test.ts`.

---
*Generated: 2026-10-09*
*Last Updated: 2026-10-09 (fix round 1)*
