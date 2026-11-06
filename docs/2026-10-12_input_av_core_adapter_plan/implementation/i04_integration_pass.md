---
task_id: 2026-10-12_input_av_core_adapter_plan
row: I-4 (integration pass, track D)
date: 2026-10-13
agent: coder-execution
tier: T3
source: implementation/177_worker_version_rise.md section 4 (the five pins) and section 7
status: complete (one deviation from the brief, item 4: see below)
---

# Integration pass I-4: the pins of the worker version rise 0.5.0 -> 0.6.0

Edits were made with the Edit tool, one line each. No commit, no stage, no stash. Claim line appended to `delegation_progress/file_claims.md`.

## 1. Changes, line by line

| # | File:line | Before | After |
|--:|---|---|---|
| 1 | `apps/core-server/test/support/capture-stub-worker.mjs:77` | `workerVersion: 'capture-worker/0.5.0'` | `workerVersion: 'capture-worker/0.6.0'` |
| 2a | `apps/core-server/src/capture/__tests__/fault-lifecycle.test.ts:415` | `rig({ workerVersion: 'capture-worker/0.6.0' })` | `rig({ workerVersion: 'capture-worker/0.7.0' })` |
| 2b | `apps/core-server/src/capture/boot/__tests__/boot.test.ts:309` | `fixture.workerSaying('worker-newer', 'capture-worker/0.6.0')` | `... 'capture-worker/0.7.0'` |
| 3a | `packages/shared/src/api/system.ts:97` | `captureWorker: { version: 'capture-worker/0.5.0' }` | `... 'capture-worker/0.6.0'` |
| 3b | `packages/shared/openapi/openapi.json:16469` | `"version": "capture-worker/0.5.0"` | `"version": "capture-worker/0.6.0"` (generator output) |
| 4 | `apps/core-server/src/capture/boot/__tests__/boot.test.ts` (new case after the CONTROL case of item 1) | none | `BR-06: a worker that states exactly capture-worker/0.5.0 ... is refused at boot by name` |

Item 2 meaning confirmed by reading both tests: each is the "a NEWER release word is refused the same way" case (a release-form word that is not the built one). 0.7.0 is a release word the Core does not accept; both still expect the MISMATCH refusal and pass.

Item 3b: `npm run openapi:gen` in `packages/shared` (script `tsx scripts/gen-openapi.ts`), run once; the first attempt failed only because tsx could not open its pipe in the sandbox (EPERM on `/tmp/claude-501/tsx-501/...pipe`), the second ran with the sandbox off: `wrote openapi/openapi.json (all (committed): 99 operations, 2 security schemes, version 0.3.0; offline: 33 operations, 0 security schemes, version 0.2.0; 1457158 bytes)`. The byte size equals the file before the run: the file already held the other rows' pending changes (discovery request body, nullable slots, `unassign`); the generator's only new line for this pass is :16469.

## 2. Deviation, item 4: the code is MISMATCH, not UNKNOWN

The brief said the 0.5.0 worker is refused "with that code" (`CAPTURE_WORKER_VERSION_UNKNOWN`). The rule says otherwise (`apps/core-server/src/capture/boot/checks.ts`, `workerVersionRefusalOf`): `UNKNOWN` is for a word that is NOT of the release form (`stub-worker`); `capture-worker/0.5.0` has the release form and is not `CAPTURE_WORKER_VERSION`, so it is `CAPTURE_WORKER_VERSION_MISMATCH` with reason `expected capture-worker/0.6.0, found capture-worker/0.5.0` (the same refusal the existing 0.4.0 case holds). The new test asserts the actual code, the exact reason text, that `CAPTURE_WORKER_VERSION` is not 0.5.0, and that the boot outcome is null. DRIVER DECISION for the controller to confirm: BR-06's wording "CAPTURE_WORKER_VERSION_UNKNOWN" should read MISMATCH. The stub mechanism needed no source change: `fixture.workerSaying(name, version)` already states any version.

## 3. Checks

| Check | Command (from the package) | Result line |
|---|---|---|
| tidy-fy (red before item 1) | `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__/tidy-fy.test.ts` | `Test Files 1 passed (1) / Tests 13 passed (13)` |
| item 2 files + boot tests (incl. new case) | same, `fault-lifecycle.test.ts` and `boot/__tests__/boot.test.ts` | `Test Files 2 passed (2) / Tests 65 passed (65)` |
| pins, muxer, system routes, ipc | same, `protocol-pins muxer-safety src/modules/system/__tests__/routes.test.ts src/capture/__tests__/ipc.test.ts` | `Test Files 4 passed (4) / Tests 122 passed (122)` |
| shared openapi tests | `packages/shared`: `npx vitest run test/openapi.test.ts test/api-openapi-scope.test.ts --maxWorkers=2` | `Test Files 2 passed (2) / Tests 45 passed (45)` |
| typecheck shared | `npm run typecheck` | `tsc --noEmit`, no error output |
| typecheck core-server | `npm run typecheck` | `tsc --noEmit`, no error output |

All unit runs: one run each, no second run needed; sandbox off for process-starting and tsx runs. Not run: full suites, database suite, worker e2e, anything under `apps/capture-worker`.

## 4. Item 5: every `0.5.0` hit (apps/core-server, packages, apps/core-web, apps/mobile, scripts, root README.md; excluding node_modules, .cache, docs, apps/input-av, dist, build, lockfiles)

| Hit | Meaning | Action |
|---|---|---|
| `apps/core-server/test/support/capture-stub-worker.mjs:77` | the stub's current worker version | changed (item 1) |
| `packages/shared/src/api/system.ts:97` | the example/stated current worker version | changed (item 3) |
| `packages/shared/openapi/openapi.json:16469` | generated from system.ts | regenerated (item 3) |
| `apps/core-server/src/capture/worker-arguments.ts:8` | comment: `--max-fragment-bytes` "added with worker 0.5.0" - history, true regardless of the current version | left; not a pin |
| `apps/core-server/src/modules/system/__tests__/routes.test.ts:375` | control: `capture-worker/0.5.0-PROOF` is not a release word, must fail the contract | left; not a current-version statement (stays invalid at any version) |
| `packages/capture-protocol/test/protocol.test.ts:362,365,366` | form examples for the HELLO decoder (release form accepted with `+negctl`, free text refused); the protocol package does not know the Core's pin | left; not the same pin |
| `apps/core-server/src/capture/boot/__tests__/boot.test.ts` (new case) | deliberate statement of the previous version, as the refused word | by design |
| root `README.md`, `apps/core-web`, `apps/mobile`, `scripts` | no hit | none |

Documentation prose in README.md files: none stated 0.5.0 in the searched scope (the worker's own README was moved by row 177).

## 5. Not proven here

A Core boot against the real built 0.6.0 worker is the run of row 59 (BR-11); the database suites that start the stub through `test/support/capture.ts` were not run and read the stub changed here.

---
*Generated: 2026-10-13 01:40 WIB*
*Last Updated: 2026-10-13 01:40 WIB*
