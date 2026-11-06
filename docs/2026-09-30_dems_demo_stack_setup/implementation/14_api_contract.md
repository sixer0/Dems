---
task_id: 2026-09-30_dems_demo_stack_setup
step: 33
plan_row: 02_plan §4 W-03 part a (OpenAPI 3.1 document and generator, session schema)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
---

# Step 33: Core API contract (OpenAPI 3.1.0, generator, `sessionCreateSchema`)

**Outcome: PASS.** All three row-33 checks pass. Command output is in §4.

- **AC-56 test passes.** The parser reports the document valid. It has 10 operations: 1 LIVE and 9 SIMULATED.
- **A second `npm run openapi:gen -w @dems/shared` leaves the file unchanged.** The shasum is identical before and after (`68cdb5cc…6aea`).
- **mock-core is unaffected.** Its typecheck and tests still exit 0.

The contract is framework-free: zod only, exported through `@dems/shared/api` (and so through the root barrel). The document is built on demand and never at import time, so mock-core and mobile pay nothing for loading the barrel.

## 1. Files

| File | Change | Role |
|---|---|---|
| `packages/shared/src/api/patterns.ts` | new | ID wire formats: `SES-{YYYYMMDD}-NNNN`, `EV-…`, `OPR-NNN`, `EXP-NNNNNN`, case `LP/YYYY/MMDD-NNNN` (month and day checked), error-code pattern |
| `packages/shared/src/api/session-schema.ts` | new | `sessionCreateSchema`; `SESSION_INPUT_LIMITS` (name 120, room 80, notes 2,000, the same bounds as the sim); `SESSION_CREATE_MESSAGES` (i18n keys); `SESSION_CREATE_FORM_MESSAGE_KEYS`; `DEFAULT_SESSION_ROOM`; types `SessionCreateRequest` and `SessionCreateFormValues` |
| `packages/shared/src/api/core-api.ts` | new | Zod schemas for every body, plus `CORE_API_SCHEMAS`, which gives the component names. `CORE_API_OPERATIONS` is the table of 10 operations. Helpers: `matchCoreApiOperation(method, path)`, `validateCoreApiResponse(opId, status, body)`, `findCoreApiOperation` |
| `packages/shared/src/api/examples.ts` | new | `CORE_API_EXAMPLES`, keyed by operation, then status, then name. Also `EXAMPLE_IDS`, `OPENAPI_EXAMPLE_INSTANT` (2026-10-01 10:00 WIB) and `HEARTBEAT_EXAMPLE` |
| `packages/shared/src/api/openapi.ts` | new | `createOpenApiDocument({ includeSimulated? })`, `serializeOpenApiDocument`, `listOpenApiOperations`. Also `API_BADGES` (name, tone, colour), `SIMULATED_HEADER_NAME`/`VALUE`, `OPENAPI_ALLOWED_EXTENSION` and the document types |
| `packages/shared/src/api/index.ts` | modified (+7 lines) | Re-exports the 5 new modules; the 3 existing lines are unchanged |
| `packages/shared/scripts/gen-openapi.ts` | new | Writes `openapi/openapi.json`, but only when the content changed. `--check` exits 1 if the file is stale. On error it prints a structured JSON line to stderr and exits 1 |
| `packages/shared/openapi/openapi.json` | new (generated) | 90,966 bytes, 2,748 lines; sha256 `68cdb5cca09ec9e6b38bddf02097d8ece60c0baff5a0ccf6bf3a7ceb7d9a6aea` |
| `packages/shared/test/openapi.test.ts` | new | 21 tests (AC-56 and the contract against the sim handlers and dataset) |
| `packages/shared/test/session-schema.test.ts` | new | 7 tests |

**Not touched:**
- `src/sim/**` (step 32), which was read only.
- `src/i18n/**`.
- Every `package.json` and the lockfile. Their `M` status in git is from steps 27 and 67; their mtimes are before this step.
- mock-core, core-web and mobile.

No process was left running. Nothing was committed.

## 2. The contract

| Operation | Method and path | Mode, `x-badges` | Documented statuses (all produced by the sim, §4) |
|---|---|---|---|
| getServiceHealth | GET `/api/v1/health` | live, LIVE | 200 (mock-core) |
| createSession | POST `/api/v1/session` | simulated, SIMULATED; `x-dems-rbac` SESSION_START | 200 (idempotent), 201, 400, 401, 403, 409, 422 |
| startSession | POST `/api/v1/session/{id}/start` | simulated, SIMULATED | 200, 202, 400, 404, 409 |
| stopSession | POST `/api/v1/session/{id}/stop` | simulated, SIMULATED | 202, 400, 404, 409, 422 |
| getCurrentSession | GET `/api/v1/session/current` | simulated, SIMULATED | 200 |
| getDeviceHealth | GET `/api/v1/device/health` | simulated, SIMULATED | 200 |
| getAudioStatus | GET `/api/v1/audio/status` | simulated, SIMULATED | 200 |
| getVideoStatus | GET `/api/v1/video/status` | simulated, SIMULATED | 200 |
| getStorageStatus | GET `/api/v1/storage/status` | simulated, SIMULATED | 200 |
| exportEvidence | POST `/api/v1/evidence/{id}/export` | simulated, SIMULATED + **RBAC + AUDIT**; `x-dems-rbac` EVIDENCE_EXPORT | 202, 400, 401, 403, 404, 409, 422 |

**Document features:**
- **Extensions.** Only `x-badges` (Scalar's display badge) and the `x-dems-*` keys: `x-dems-mode`, `x-dems-source`, `x-dems-rbac`, and `x-dems-mode` on the Realtime tag. The test enforces this allowlist and fails on any `scalar`, `agent`, `mcp`, `pre-request`, `post-response` or `code-samples` key (D45).
- **No auth scheme.** There is no `security` or `securitySchemes`, because the book defines none.
- **Local only.** The only URL host in the document is `127.0.0.1:4400`.
- **Info section.** It lists what the design book does not define (01 L364-L368): the auth, pairing, metadata, evidence-list, audit-list and verify endpoints; the WS schema; the bodies; and an auth scheme. It also carries the LIVE / SIMULATED / RBAC + AUDIT legend.
- **Realtime tag.** It documents `ws://127.0.0.1:4400/ws`: the 1 Hz heartbeat, the immediate heartbeat on connect, the origin allowlist, STALE after 2,500 ms, backoff and jitter, and a JSON example message. The message is also the `Heartbeat` component.
- **Components.** There are 18 `components.schemas`. They are generated from the zod schemas with `z.toJSONSchema` (draft 2020-12, `io: 'input'`, so objects are open), and nested named schemas become `$ref`s. zod's 1 KB date-time regex and its ±2^53 integer bounds are stripped from the output.
- **Simulated header.** `components.headers.XDemsSimulated` (`const "1"`) is referenced on every simulated response and on none of the live ones.

**For consumers:**

| Consumer | Use |
|---|---|
| Step 53 (API Reference) | `content: createOpenApiDocument()` (fresh object per call, safe for Scalar to mutate). "Show simulated endpoints" off: `createOpenApiDocument({ includeSimulated: false })`. Download: `new Blob([serializeOpenApiDocument(doc)])`. Legend chips: `API_BADGES` (tones success / warning / danger). `simAwareFetch` can route with `matchCoreApiOperation` and check responses with `SIMULATED_HEADER_NAME`. Its demo-data example test can reuse `CORE_API_SCHEMAS` |
| Steps 46 and 78 (Start New Session, web and mobile) | RHF with `zodResolver(sessionCreateSchema)`, and `maxLength` set from `SESSION_INPUT_LIMITS`. Issue messages are i18n keys, rendered with `t(issue.message)`. The Room Select defaults to `DEFAULT_SESSION_ROOM` |
| Steps 40 (CP-1) and 54 (W-02b) | `validateCoreApiResponse(operationId, status, body)` checks a handler response against the contract. `test/openapi.test.ts` already does this for every documented status |
| Step 93 (demo data) | `EXAMPLE_IDS` suffixes (session 0024, evidence 0004, 0006, 0014) match the dataset (checked by the test) |

## 3. Examples

- **Frozen instant.** All examples describe 2026-10-01 10:00:00 WIB.
- **Time format.** Simulated bodies use `+07:00`, as the sim writes them. The live health body uses `Z`, as mock-core writes it.
- **Session and evidence IDs.** Every ID is checked against the dataset:
  - `SES-20261001-0024` = `sessionIdFor(RECORDING_SCENARIO.sessionSeq, t)`.
  - `LP/2026/1001-0007` = `caseNumberFor(RECORDING_SCENARIO.caseSeq, t)`.
  - `EV-20260930-0004` is EXPORTED.
  - `EV-20260930-0006` is RECORDED; exporting it gives 409.
  - `EV-20261001-0014` is what the sim seals the scenario session into.
- **Idle snapshots.** The `getDeviceHealth` and `getStorageStatus` examples **deep-equal** the handler responses of an idle sim at that instant, including the 16 services, which equal the sim's `CORE_SERVICES`.

## 4. Verification (fresh, 2026-10-01 03:38–03:39 WIB)

| Check | Command | Result |
|---|---|---|
| AC-56 test (and contract tests) | `npx vitest run test/openapi.test.ts test/session-schema.test.ts --maxWorkers=2` (in packages/shared) | `Test Files 2 passed (2)` / `Tests 28 passed (28)` |
| Parser verdict | inside openapi.test.ts: `validate(serializeOpenApiDocument(doc))` | `valid: true`, `errors: []`, `version: '3.1'`. `dereference` errors `[]`. Positive control: a broken `$ref` gives `valid: false` (`INVALID_REFERENCE`) |
| 10 / 1 / 9 | same file | 10 unique operationIds. Live operations: exactly `get /api/v1/health` with badges `[LIVE]`. The simulated method-path set equals the 9 §21.2 endpoints verbatim. LIVE badge count 1, SIMULATED badge count 9. RBAC + AUDIT is on `exportEvidence` only |
| Second generator run, same shasum | `npm run openapi:gen -w @dems/shared` twice (sandbox bypass, see F-33-4) | `68cdb5cca09ec9e6b38bddf02097d8ece60c0baff5a0ccf6bf3a7ceb7d9a6aea` before, after run 1 and after run 2. Two independent processes hash a fresh `renderOpenApiJson()` to the same value; `--check` prints "up to date" |
| Drift | openapi.test.ts "no drift" | The committed file equals `renderOpenApiJson()` byte for byte |
| mock-core typecheck | `npm run typecheck -w @dems/mock-core` | exit 0 |
| mock-core tests | `npm test -w @dems/mock-core -- --maxWorkers=2` (port-binding bypass, P10) | `Test Files 3 passed (3)` / `Tests 6 passed (6)`. In the sandbox, 2 files fail with `listen EPERM 127.0.0.1` only |
| LIVE body against the contract | scratch script: `buildApp().inject(GET /api/v1/health)`, then `validateCoreApiResponse('getServiceHealth', 200, body)` | `status 200`, `{"ok":true}` |
| Sim handlers against the contract | openapi.test.ts: two sims at the example instant; each operation called through `Sim.request` | Every response parses. `x-dems-simulated: 1` is on every response. The set of produced statuses equals the set of documented statuses for all 9 simulated operations. `SIM_API_ROUTES` equals the 9 simulated operations |
| Full shared suite | `npm test -w @dems/shared -- --maxWorkers=2` | `Test Files 22 passed (22)` / `Tests 375 passed (375)` |
| Shared typecheck / lint / consumer-strict flags | `npm run typecheck -w @dems/shared`; `npm run lint -w @dems/shared`; `tsc -p packages/shared --noUnusedLocals --noUnusedParameters --noFallthroughCasesInSwitch` | exit 0 / exit 0 / exit 0. `oxlint` on the new files reports "Found 0 warnings and 0 errors" |
| Mutation checks (tests catch real faults) | Four temporary edits, each reverted; the restoration was confirmed by sha256 | Tampered openapi.json → the drift test fails. Health badged SIMULATED → the 10/1/9 test fails. An added `x-scalar-stability` → the extension test fails. A changed storage example → the idle-equality test fails. Files restored byte-identical |
| Build cost | `createOpenApiDocument()` timed in Node | first build 6.4 ms, warm 1.6 ms. Nothing is built at import |
| core-web and mobile typecheck | `npm run typecheck -w @dems/core-web` / `-w @dems/mobile` | exit 2 each, with 1 error each, both in files of concurrent steps (F-33-5). No error is in shared or in any importer of `@dems/shared/api`. An earlier mobile run (03:35) passed with these modules present |

## 5. Decisions, drift and findings

| ID | Kind | Item |
|---|---|---|
| S33-1 | decision | **Simulated bodies follow step 32's handler types** (`sim/api.ts`, whose header says "The body types below are the contract for step 33's OpenAPI schemas"). The shapes are restated in zod, and plain `string` fields are tightened to the enums and patterns the sim guarantees. The test runs the real handlers, so any later rename or removal fails it. My first draft had richer bodies, such as the full `SessionResource` on commands and an ExportEvent with audit hash. It was replaced before generation to avoid two competing contracts |
| S33-2 | drift (form) | 01_specs §14.9 names an imported constant `openApiDocument`. It is now `createOpenApiDocument()`, a fresh object per call built on demand (1.6–6.4 ms). Importing `@dems/shared/api` (mock-core, Hermes) then does no zod-to-JSON-Schema work, and Scalar, the filter Switch and the Download each get their own copy. Step 53's config is `content: createOpenApiDocument()` |
| S33-3 | decision | `api/` imports two leaf modules of the simulator, `sim/vocabulary.ts` and `sim/constants.ts`. Neither imports anything. This gives one source for SubjectType, profile, role, permission, fault and precheck values and for the reason minimums. The root barrel still does not re-export the sim (the step-31 boundary test passes) |
| S33-4 | decision | `sessionCreateSchema` normalises input as the sim's `normalizeSessionInput` does: trim and collapse whitespace, notes trim only. Its parsed type is **exactly** the sim's `SessionCreateInput` (a compile-time `Exact` proof in the test). At the limits (name 120, room 80, notes 2,000), what it accepts the sim creates. The case number must match `LP/YYYY/MMDD-NNNN`, the format the i18n `invalid` message already states |
| S33-5 | decision | Schema messages are i18n keys. The 5 the form can show exist in `en` (checked by the test). Five limit keys can only occur through the API, because the form uses `maxLength` and default Selects: `sessionNew.info.subjectName.tooLong`, `room.required`, `room.tooLong`, `profile.required`, `notes.tooLong`. **Follow-up for step 46** (owner of `en/session-new.ts`): add these keys |
| S33-6 | decision | No `securitySchemes`. RBAC is documented in the text and in `x-dems-rbac` (roles checked against the sim's `roleHas` in the test). Badge colours come from `palette`: LIVE success, SIMULATED warning, RBAC + AUDIT danger |
| F-33-1 | finding, for step 40 (CP-1) and 54 | `sim/api.ts` passes the create body to `createSession` without `sessionCreateSchema`. Try-it therefore accepts a case number outside `LP/YYYY/MMDD-NNNN` that the documented schema rejects. Suggested fix, owned by the sim: parse the body with `sessionCreateSchema` in the handler and answer 422 INVALID_INPUT |
| F-33-2 | finding | The handler's 405 METHOD_NOT_ALLOWED and 500 SIMULATOR_ERROR codes are listed in `ApiError.error.code`, but no operation documents them as a status. 405 is only reachable with undocumented methods; 500 is an internal fault |
| F-33-3 | note, for AC-56 part 2 | `git diff --exit-code packages/shared/openapi/` has no meaning until the controller commits the new directory (it is untracked now). The drift test covers the same property today |
| F-33-4 | environment | `npm run openapi:gen` (the tsx CLI) fails in the sandbox with `listen EPERM …/tsx-501/*.pipe`. It was run with a per-command bypass. In-sandbox equivalent: `node --import tsx scripts/gen-openapi.ts` (D49) |
| F-33-5 | P11 noise | Both failures are in files of concurrent steps, re-run at 03:38 with the same result. **Re-run after those steps land.** Root `npm run typecheck` exits 2 for the same two reasons. Neither file imports `@dems/shared/api`.<br>- core-web: `src/components/ui/__tests__/copy-in-items.test.tsx(22,15)` TS1294, a parameter property under `erasableSyntaxOnly` (mtime 03:35).<br>- mobile: `src/navigation/testing/router-harness.tsx(162,23)` TS2345 (mtime 03:37) |

**Blockers: none.**
