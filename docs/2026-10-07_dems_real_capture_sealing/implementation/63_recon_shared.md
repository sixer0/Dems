---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: RECON-A (controller-added reconciliation for the M2 gate; phase C, milestone M2, class B; blueprint rev 2.1)
date: 2026-10-08
agent: coder-execution-local
source_plan: implementation/16_m2_openapi_pins.md (row 50 residual list); implementation/61_m2_sim_capture_routes.md (row 51a §5 - the #17 sub-defects); implementation/15_m2_api_contract.md (row 48); implementation/51_m2_stt_config_schema.md (row 112 forbidden-key 25->28); decisions/decisions.md D38/D41/D42
narrative_tier: 3
status: COMPLETE - packages/shared FULLY green (suite exit 0 / 1875 tests; tsc exit 0; lint exit 0)
closes: RECON-A (openapi.test.ts #17; capture-op Core-server-only markers; sim/api.ts TS6133); item 3 verified no-op in shared
depends_on: row 50 (DONE), row 48 (DONE), row 51a (DONE), row 112 (DONE)
---

# RECON-A: make `packages/shared` fully green

## 0. Scope and boundary

Sole `packages/shared` writer this turn. Edits confined to `packages/shared/src/**` and
`packages/shared/test/**`. Nothing under `apps/**`, `packages/shared/openapi/openapi.json`, the
lockfile, or any controller tracker was touched (proved by mtimes in §5). No commit, no push, no
remote, no sudo, no database contact.

**Anti-hang:** this macOS host has no `timeout` binary, so the row-46/112 perl shim was copied to
`.cache/reconA/bin/timeout` and prepended to `PATH` inline on every command (PATH does not persist
across tool calls). Every command ran under `timeout ... </dev/null`, `CI=true`, `--run`, never watch,
never stdin. The full shared suite completes in ~8 s, so iteration was cheap and every claim below is
backed by a fresh run.

## 1. Enumeration (ground truth before any edit)

```
$ timeout 900 env CI=true npm run test -w @dems/shared -- --maxWorkers=2 --run </dev/null
 Test Files  1 failed | 71 passed (72)
      Tests  1 failed | 1874 passed (1875)
 FAIL  test/openapi.test.ts > ... > every documented simulated status is produced by the simulator, and every response parses
 -     "status": "EXPORTED",
 +     "status": "QUEUED",
 ❯ test/openapi.test.ts:457:22
```

Exactly one failure, as the brief predicted. Note the test aborts at :457 *before* the coverage loop at
:476, so fixing the literal alone surfaces the loop's next failure - items 1b and 2 are what actually
green #17.

## 2. Measurement (why the fix is broader than row 51a analysed)

Row 51a §5 only analysed the unreachable **403**s. Two throw-away probes (`.cache/reconA/probe.mts`,
`probe2.mts`) dumped, per simulated operation, the documented offline set and the set the simulator
actually emits. Result: besides the six unproducible `403`s, **five** operations also document a `422`
the simulator cannot produce - it answers an unknown path parameter with `404` and skips query
validation entirely (row 51a D-51a-6). These `422`s are the same class as the already-marked
`startSession` `422`: validation the Core server performs and the simulator deliberately does not.

| op | offline (landed) | simulator-reachable | unproducible -> mark |
|---|---|---|---|
| getCaptureConfig | 200,401,403 | 200,401 | 403 |
| getCaptureDevices | 200,401,403 | 200,401 | 403 |
| updateCaptureConfig | 200,400,401,403,409,422 | (all) | - |
| setCaptureCameraSource | 200,400,401,403,404,409,422 | (all) | - |
| setPrimaryMic | 200,401,403,404,409,422 | 200,401,403,404,409 | 422 |
| switchAudioSource | 200,400,401,403,404,409,422 | (all, incl. 401/403/409) | - |
| listAudioSourceIntervals | 200,401,403,404,422 | 200,401,404 | 403,422 |
| getSealingProgress | 200,401,403,404,409,422 | 200,401,404,409 | 403,422 |
| getTranscript | 200,401,403,404,409,422 | 200,401,404,409 | 403,422 |
| createTranscriptRevision | 201,400,401,403,404,409,422 | (all, incl. 403/422) | - |
| listTranscriptRevisions | 200,401,403,404,409,422 | 200,401,404,409 | 403,422 |
| getEvidenceExportJob | 200,401,403,404,422 | (all) | - |
| setCaptureDeviceCredential | 200,400,401,403,404,409,422 | (all) | - |

After marking, every simulated operation's offline set equals its reachable set, so the coverage loop can
demand the full offline set of all 22 operations without weakening anything.

**Builder safety:** `createOpenApiDocument({scope:'all'})` lists every status regardless of per-response
`services` (`openapi.ts:719`), and the builder never serialises a response-level `services` member. So
marking does not change the committed `openapi.json`; the byte-for-byte drift test passes with no regen
(confirmed by the full-suite run).

## 3. Item-by-item fix

### Item 1 - `test/openapi.test.ts`
- **:457 literal** `EXPORTED` -> `QUEUED` (op 42 queue receipt, C3 §3 / row 48 / row 51a §3). The
  evidence item's lifecycle status stays `EXPORTED`; that fact is asserted in `sim-api.test.ts:192`, not
  here. This corrects the expectation to the landed contract; nothing weakened.
- **coverage loop (:476-486)** kept iterating all 22 simulated operations with the identical strong
  assertion (`produced == listCoreApiResponseStatuses(op, OFFLINE)`). Rather than narrow the loop (which
  would drop coverage), the flow was **extended** with flows 3..10 that drive all thirteen capture ops
  across every reachable status (signed-out 401, INVESTIGATOR/TECHNICIAN RBAC 403, idle 400/404/422/200,
  locked 409, the sealed-transcript chain, and the export-job poll). "Align the loop to the actual
  simulated-route coverage" is satisfied by making the flow's coverage actually match the loop's
  expectation. `coreServerOnly` pin corrected `11 -> 22` (11 baseline + 6 capture-403 + 5 capture-422).

### Item 2 - `src/api/{devices,sessions,evidence}.ts` markers
Added `services: CORE_SERVER_ONLY` (= `['dems-core-server']`, the codebase idiom from `core-api.ts:677`)
by spreading the existing helper spec, so descriptions/schemas/examples are unchanged:
- **six `403`s (brief item 2):** `getCaptureConfig`, `getCaptureDevices` (devices.ts);
  `listAudioSourceIntervals`, `getSealingProgress` (sessions.ts); `getTranscript`,
  `listTranscriptRevisions` (evidence.ts). Each read is reachable by every seeded role, so its 403 is the
  Origin/revoked-device guard only the Core server sends (01_specs §7.19).
- **five `422`s (same class, discovered by measurement):** `setPrimaryMic` (devices.ts);
  `listAudioSourceIntervals`, `getSealingProgress` (sessions.ts); `getTranscript`,
  `listTranscriptRevisions` (evidence.ts). Path-parameter/query format checks the simulator answers with
  404 instead (D-51a-6). Disclosed in §5 as an extension of row 51a's incomplete analysis.

### Item 3 - forbidden-key 25 -> 28 (verified NO-OP in shared)
`AUDIT_DETAIL_FORBIDDEN_KEYS` exists only under `apps/core-server/**` (`value-sets.ts`, `checks.ts`,
`payload-rules.ts`, and the core-server tests `writers.test.ts` / `contract-inventory.test.ts`). It is
never imported or referenced anywhere in `packages/shared`, and no shared-side pin asserts a `25`
forbidden-key count (the green suite confirms this). Row 112 §7.4 and D38 route those drifting pins to
RECON-B (core-server). **No shared-side change was made or fabricated.**

### Item 4 - `src/sim/api.ts:770` TS6133
Renamed the unused first parameter of `sealingProgress(state, ...)` to `_state`. Behaviour unchanged; the
`_`-prefix matches the file's own convention (`_params` at :966/:1210) and satisfies both tsc
(`noUnusedParameters`) and oxlint.

## 4. Verification (raw output quoted)

```
# targeted #17 file
$ timeout 300 env CI=true npx vitest run test/openapi.test.ts --root packages/shared --maxWorkers=2 --run </dev/null
 Test Files  1 passed (1)
      Tests  21 passed (21)

# marker-coupled contract tests
$ timeout 300 env CI=true npx vitest run test/api-registry.test.ts test/api-openapi-scope.test.ts \
    test/api-examples.test.ts test/api-state-examples.test.ts --root packages/shared --maxWorkers=2 --run </dev/null
 Test Files  4 passed (4)
      Tests  86 passed (86)

# FULL shared suite
$ timeout 1200 env CI=true npm run test -w @dems/shared -- --maxWorkers=2 --run </dev/null
 Test Files  72 passed (72)
      Tests  1875 passed (1875)          ; SUITE_EXIT=0

$ timeout 300 npx tsc --noEmit -p packages/shared </dev/null   ; TSC_EXIT=0
$ timeout 300 npm run lint -w @dems/shared </dev/null           ; LINT_EXIT=0
```

Baseline entering RECON-A: `1 failed | 1874 passed (1875)`. After: `1875 passed (1875)`, exit 0. The
single residual red (#17) is closed; no assertion was deleted, skipped, weakened, or timed out.

## 5. Files changed in THIS session

| File | Change |
|---|---|
| `packages/shared/test/openapi.test.ts` | :457 `EXPORTED`->`QUEUED`; flows 3..10 drive the 13 capture ops; `coreServerOnly` 11->22; comment updated |
| `packages/shared/src/api/devices.ts` | `services: CORE_SERVER_ONLY` on getCaptureConfig 403, getCaptureDevices 403, setPrimaryMic 422 |
| `packages/shared/src/api/sessions.ts` | markers on listAudioSourceIntervals 403+422, getSealingProgress 403+422 |
| `packages/shared/src/api/evidence.ts` | markers on getTranscript 403+422, listTranscriptRevisions 403+422 |
| `packages/shared/src/sim/api.ts` | `sealingProgress` param `state`->`_state` (TS6133) |

## 6. Notes / decisions

- **D-RECON-A-1 (extend, do not narrow).** The brief allowed scoping the loop down; I extended the flow to
  cover all 22 simulated operations instead, keeping the loop's full-strength assertion. This preserves the
  intent "every documented simulated status is produced" maximally rather than trading it for a smaller
  iteration set.
- **D-RECON-A-2 (the five 422 marks exceed the literal item-2 enumeration).** Row 51a §5 examined only the
  403s and did not check 422 reachability; measurement showed five capture ops document a 422 the
  simulator cannot emit. Marking them `dems-core-server` is the honest reconciliation (identical precedent
  to the already-marked `startSession` 422 and the five baseline reads' 401/403) and is required for the
  loop to stay over all 22 ops. Flagged for controller review; it is a classification correction, not a
  behaviour change or a weakened assertion.
- **D-RECON-A-3 (item 3 genuinely absent in shared).** Reported as a verified no-op rather than inventing a
  shared-side edit; the constant and its 25->28 pins live in core-server (RECON-B).
- **Boundary held.** openapi.json (mtime 13:17, row 50) and package-lock.json (Oct 7) predate this session
  and were not written; the passing drift test proves the committed document still matches the builder with
  the new markers present.

## 7. Residuals for other rows

- None block M2-RG-SHARED: `packages/shared` reaches exit 0. The app-side category-B pins and the
  core-server forbidden-key 25->28 pins remain RECON-B (unchanged by this row, out of its file set).

---
*Generated: 2026-10-08 16:04 (RECON-A completion run)*
