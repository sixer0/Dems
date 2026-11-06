---
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: test-runner (decision D122)
status: needs-review
---

# Checkpoint wave C: whole-suite run, one pass

No file other than this report was written. No fixes, no commit. Tree state: uncommitted working tree on `main` at the time of the run (HEAD 23c8f0b). Project PostgreSQL was listening on 127.0.0.1:4432 (not started or touched by the runner). Machine load at start: 2.9.

Sandbox note: the first core-server unit run inside the Bash sandbox gave 120 failed tests, the large majority `listen EPERM` / `bind EPERM` / `spawn EPERM` on 127.0.0.1 (log kept as the sandbox-caused run, not counted below). Every run from row 5 on, and every re-run, was made with the sandbox off. Rows 1 to 4 do not bind and ran in the sandbox.

Row 7 (acceptance / static tests): not a separate project. `test/static/**` runs inside the `unit` project (row 5); `test/acceptance/**` runs inside the `db` project (row 6). Nothing further was run for row 7.

## Results

| # | command | exit | files | tests | duration |
|---|---------|------|-------|-------|----------|
| 1a | `npm run typecheck -w @dems/shared` | 0 | - | clean | 3 s |
| 1b | `npm run typecheck -w @dems/core-server` | 0 | - | clean | 8 s |
| 1c | `npm run typecheck -w @dems/core-web` (`tsc -b`) | 2 | - | 1 error | 11 s |
| 1d | `npm run typecheck -w @dems/mobile` | 2 | - | 1 error | 5 s |
| 1e | `npm run typecheck -w @dems/capture-protocol` | 0 | - | clean | <1 s |
| 1f | `npm run typecheck -w @dems/transcriber` | 0 | - | clean | 2 s |
| 1g | `npm run typecheck -w @dems/mock-core` | 0 | - | clean | 2 s |
| 2a-g | `npm run lint -w` for the same 7 workspaces | 0 each | - | mobile: 0 errors, 1 warning (`apps/mobile/src/runtime/log.test.ts:160:19`, `@typescript-eslint/array-type`); the six oxlint runs print nothing | 0-13 s each |
| 3 | `npm run test -w @dems/shared` | 0 | 85 passed | 2294 passed | 5 s |
| 4 | `npm run test -w @dems/capture-protocol` | 0 | 1 passed | 23 passed | 1 s |
| 5 | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | 1 | 6 failed, 228 passed (234) | 8 failed, 5387 passed (5395) | 43 s |
| 6 | `lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | 1 | 6 failed, 145 passed (151) | 21 failed, 2156 passed (2177) | 598 s |
| 7 | (covered by 5 and 6, see above) | - | - | - | - |
| 8 | `npm run test -w @dems/core-web -- --maxWorkers=4` | 1 | 1 failed, 131 passed (132) | 2 failed, 1723 passed (1725) | 78 s |
| 9 | `npx -w apps/mobile jest --maxWorkers=2` | 1 | 1 failed, 219 passed (220) | 2 failed, 2258 passed (2260) | 129 s |
| 10a | `npm run test -w @dems/transcriber` | 0 | 20 passed | 555 passed, 3 skipped (558) | 15 s |
| 10b | `npm run test -w @dems/mock-core` | 0 | 4 passed | 19 passed | 4 s |

Row 10: the transcriber `test` script is the default vitest config; the `test:real:*` scripts (model / oMLX) were not run. The 3 skipped tests are skipped by the test files themselves.

## Reds

Re-run column: the single re-run of that file, once. "red again" = same tests failed again.

### Row 1c: core-web typecheck
- `apps/core-web/src/features/evidence/__tests__/verify-v2.test.tsx(246,50)`: `error TS7053: Element implicitly has an 'any' type because expression of type '"V-01" | ... | "V-15"' can't be used to index type ... Property 'V-15' does not exist on type`.

### Row 1d: mobile typecheck
- `apps/mobile/src/features/evidence/verify-v2.test.tsx(186,50)`: same `TS7053`, `Property 'V-15' does not exist`.

### Row 5: core-server unit (re-run of the 6 files: all 8 red again, 239 passed)
| file | test | first error |
|------|------|-------------|
| `test/db/set4-rules.test.ts:117` | M4-MT-12 and SEC35-41 (c) > no production statement updates adapter_kind or kind of capture_devices | `AssertionError: expected [ Array(1) ] to deeply equal []`; received `"src/modules/capture-discovery/adoption.ts:28"` |
| `src/capture/adapters/__tests__/credential.test.ts:176` | the canary through every channel of the layer > results, recorded calls, descriptors, errors, the log, ... hold no credential value | `expected [ ...(6) ] to deeply equal []`; first: `CAPTURE_CONNECTION_TESTED.endpointRef takes canary-secret-9d02fa` (six entries: CAPTURE_CONNECTION_TESTED and CAPTURE_CANDIDATE_ADOPTED, each with canary-secret, canary-user, `[credential]`) |
| `src/capture/adapters/__tests__/static.test.ts:187` | A-5: the layer is wired into nothing yet > no production file outside the folder imports it | `expected [ ...(28) ] to deeply equal []` (A-5, listed as known) |
| `src/capture/fence/__tests__/fence.test.ts:396` | the development test sources (kind FAKE) ... > the test camera pushes the generated picture to the loopback listener: no device list call, ... | `LocalSourceError: the local device could not be opened` at `src/capture/adapters/local/camera-helper.ts:205` (via `src/capture/fence/generated-sources.ts:76`) |
| `src/capture/fence/__tests__/fence.test.ts:411` | same describe > CONTROL: the local camera reads the device list first and is opened by its exact name | `LocalSourceError: the local device could not be opened` at `camera-helper.ts:205` (via `src/capture/adapters/local/camera-adapter.ts:84`) |
| `src/modules/evidence/__tests__/routes.test.ts:198` | MODG: ... > the area of the registry is these five and no other: ... | `expected [ 'archiveEvidence', ...(9) ] to deeply equal [ 'archiveEvidence', ...(4) ]` (MODG, listed as known) |
| `src/modules/sessions/__tests__/routes.test.ts:176` | MODG: ... > registers operations 24 to 38 with the method, the path and the operation ID of the registry ... | `expected [ ...(15) ] to deeply equal [ ...(18) ]` (MODG, listed as known) |
| `src/modules/sessions/__tests__/routes.test.ts:187` | MODG: ... > the tag Session of the registry is exactly the module's list ... | `expected [ 'createSession', ...(17) ] to deeply equal [ 'createSession', ...(14) ]` (MODG, listed as known) |

The two fence tests inject a scripted spawn door (`scriptedDoor`, helper path `/opt/dems/helpers/ffmpeg` in `src/capture/fence/__tests__/support.ts:101`); the runner did not open any device. Whether the stack through `camera-helper.ts` in these two tests reaches a real process is not established by this run.

### Row 6: core-server db (re-run of the 6 files: `chain.db.test.ts` green, the other 5 files red again, 16 failed / 97 passed)
| file | test | first error | re-run |
|------|------|-------------|--------|
| `src/modules/security-audit/__tests__/chain.db.test.ts` | file-level, then 5 tests in "operation 60": two calls ... run ONE verification (2 tests), `view` is the engine's ring (AUDIT_TAMPER), a new epoch drops what was remembered, a reopened pool drops ... | file: `DbTestHelperError: dems_test_local_tmn36xeh_f01_chain cannot be dropped: sessions are still open on it (1 of role dems_app ...)`; tests: `AssertionError: expected { calls: 12, runs: 12, ... } to match object { calls: 13, runs: 12 }` and four times `Error: Test timed out in 120000ms.` | GREEN (file passed, 1 of 1) |
| `test/db/device-upsert.db.test.ts` | M4-MT-12: the device UPSERT as dems_app on an existing id > an ingest-state change of an adopted camera succeeds; adapter_kind, kind and the four discovery columns are unchanged | `AssertionError: expected { id: 'CAM-07', kind: 'CAMERA', ...(9) } to match object { online: true, streamState: 'LIVE' }` | red again |
| `test/acceptance/contract.test.ts` (10 tests, listed as known) | AC-B-09 router vs registry | `expected { undocumented: [], ...(1) } to deeply equal { undocumented: [], unregistered: [] }`; log: routes of the router 90, operations of the registry 97 | red again |
| same | AC-B-10 area 4, sessions (24 to 38) | `expected [ {...}, ...(14) ] to have a length of 11 but got 14` | red again |
| same | AC-B-10 area 5, evidence (39 to 43), software update | `AssertionError: expected undefined to be true // Object.is equality` | red again |
| same | AC-B-14 401 NOT_SIGNED_IN | `expected [ ...(91) ] to have a length of 71 but got 93` | red again |
| same | AC-B-14 403 by access rule | `expected [ ...(10) ] to deeply equal []` | red again |
| same | AC-B-14 404 / 405 / 400 INVALID_PATH | `DELETE /api/v1/session/SES-20261001-0024/audio-source: expected [ 404, 'NOT_FOUND' ] to deeply equal [ 405, 'METHOD_NOT_ALLOWED' ]` | red again |
| same | AC-B-14 403 DEMO_DISABLED ... | `expected [ 'listEvidence', 'getEvidence', ...(9) ] to deeply equal [ 'listEvidence', 'getEvidence', ...(4) ]` | red again |
| same | AC-B-09, SR-20 no GET handler writes | `expected [ ... ] to have a length of 27 but got 36` | red again |
| same | AC-B-93, API-13 U+0000 / surrogate | `expected [ ...(8) ] to deeply equal []` | red again |
| same | SC6 coverage of documented statuses | `expected [ 'createSession 200', ...(156) ] to deeply equal []` | red again |
| `src/engine/__tests__/capture-actions.db.test.ts` | A-4: in capture mode real the meters of a recording read NO SIGNAL without ... (listed as known) | `BootError: boot step transcriber.config failed`; caused by `TranscriberBootError: the transcriber configuration cannot be used: the server does not start in real capture mode`, `{ code: 'TRANSCRIBER_CONFIG_UNRESOLVABLE', reason: 'CPU_LOCAL_RUNTIME_MISSING' }` | red again |
| `src/modules/rbac/__tests__/matrix.db.test.ts:187` | AC-B-16 ... > SUPERVISOR (session device DEV-0001) every operation answers what the registry rule ...; and the same for TECHNICIAN | `expected [ ...(3) ] to deeply equal []`: `setCaptureDeviceCredential: NOT_PERMITTED, expected ALLOW`, `testCaptureCandidateConnection: NOT_PERMITTED, expected ALLOW`, `adoptCaptureCandidate: NOT_PERMITTED, expected ALLOW` | red again (both) |
| `src/modules/capture-discovery/connect/__tests__/connect.db.test.ts:474` | M4-CONN-ATOM-1 / M7-CONN-CRED-1 > a one-character secret is stored (the sealer frames it past the 33-byte ...) | `expected [ 500, 'INTERNAL_ERROR', undefined ] to deeply equal [ 200, undefined, undefined ]` | red again |
| same, `:576` | M4-SEC-CRED-1: the two canaries through every channel (this block runs last) > 0 hits in every response, the log at trace, ... | `AssertionError: expected 1 to be greater than or equal to 2` | red again |

### Row 8: core-web (re-run of the file: both red again, 23 passed)
| file | test | first error |
|------|------|-------------|
| `apps/core-web/src/features/evidence/__tests__/verify-v2.test.tsx:67` | the recorded answers are what the contract carries today > every `body` parses with the registry schema of operation 41, and the pending members do not | `AssertionError: expected true to be false // Object.is equality` |
| same | the wording > the check names are the verifier's, V-01 to V-14 | `expected [ 'V-01', 'V-02', 'V-03', ...(11) ] to deeply equal [ 'V-01', 'V-02', 'V-03', ...(12) ]` |

### Row 9: mobile jest (re-run of the file: both red again, 16 passed)
| file | test | first error |
|------|------|-------------|
| `apps/mobile/src/features/evidence/verify-v2.test.tsx:62` | the recorded answers are what the contract carries today > every `body` parses with the registry schema of operation 41, and the pending members do not | `expect(received).toBe(expected)` Expected: false, Received: true |
| `apps/mobile/src/features/evidence/verify-v2.test.tsx:185` | the wording > the transcript-state lines are row 119's fixed lines; the check names are the verifier's | `expect(received).toEqual(expected)` Expected - 1, Received + 0 (one check name line missing from received) |

## Not attributed
Per the brief no causes are asserted beyond the file paths named in the errors above. Raw logs are in the session scratchpad (`/private/tmp/claude-501/-Users-gsp-budi-Documents-DEMS/a653efdb-135b-4d4c-a16a-a0c17ca466ab/scratchpad/*.log`).

## Limitations
- The db project ran once on the shared host in 598 s; the first-run failures in `chain.db.test.ts` (timeouts at 120000 ms, an open-session drop refusal) did not repeat when the file ran alone, so a load or ordering cause is possible; the runner did not test that.
- No device, browser, camera, microphone, media or `capture/adapters/local/__tests__/e2e/` test was run; the capture-worker e2e target was not run.
- Capture-worker C tests (`apps/capture-worker`, not in the brief's list) were not run.

*Generated: 2026-10-09*
