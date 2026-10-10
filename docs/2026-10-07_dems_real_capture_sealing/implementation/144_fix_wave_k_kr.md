---
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: coder-execution (fix wave K, reconcile pass K-R)
tree: commit 57b80a9 + the uncommitted work of wave K (S1, S2 finished; W, M1, M2 in flight)
status: complete
---

# Fix wave K, reconcile pass K-R (apps/core-server + packages/shared)

No commit, no migration (schema 6 / dbc-7), totals 97 operations (36 GET / 61 POST) / 67 audit
types unchanged. No lane was called; no e2e was run (lane 2 holds the ports). Nothing was written
in `apps/core-web`, `apps/mobile`, `scripts/lane`. G89b-07 was not built (deferred).

## 1. Per item

### Item 3 (done FIRST, contract line written 18:05Z) - op 41 `files[].plainChecked` (G89b-06, S1's request of 18:00:00Z)

- Cause: `apps/core-server/src/evidence-verify/index.ts:220` (`plainOk = file.plainOk === true`)
  flattens the report's `null` ("not checked") to `false`; the contract member is a strict boolean
  (`packages/shared/src/api/evidence.ts`, `plainOk`).
- Change: `contractBodyOf` adds `plainChecked: false` to a file row whose report value is `null`
  AND for whose track check V-05 holds no finding (a REQUIRED key that is missing is a V-05 failure
  of that track and stays a plain failure). The Core never writes `true`; absent = `plainOk` is the
  result. Contract: `plainChecked: z.boolean().optional()` beside `plainOk`; example
  `VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE` (`@dems/shared/api`). OpenAPI regenerated.
- The member is per FILE, so it is finer than the status of V-05 (V-05 may be FAIL for one file
  while the other was not checked).
- Test: NEW `src/evidence-verify/__tests__/wave-k-kr-plain-checked.test.ts` (3 cases, with the
  controls "a failed comparison" and "a required key missing"). `src/evidence-verify`:
  `Test Files 13 passed (13)  Tests 149 passed (149)`.
- Pins moved: none (the member is written only where the check did not run; every existing
  `toEqual` of a file row is of a checked file).

### Item 1 - the five cross-driver reds

| Red | Found | Change | Pin moved? |
|---|---|---|---|
| `engine/__tests__/commands.db.test.ts` (engine log allow-list vs `restartFaultEnded`) | The key is written at ONE place, `engine/host.ts:1048`: `restartFaultEnded: effects.restartFaultEnded === true` - a strict boolean, never a text | `'restartFaultEnded'` added to `engineKeys`, plus an assertion that the member is of type boolean on the one line that carries it | YES, +1 key. Ruled product change: G75c-01 / D223 (the restart fault ends; the start line says so) |
| `engine/__tests__/static.test.ts` (lists `restart-fault.ts`) | Already green in the tree: S1 moved the pin itself (note 139 section 4 (a)) | none | no |
| typecheck `src/transcription/index.ts(438,62)` | NOT reproduced: `npx tsc --noEmit -p apps/core-server` exit 0 at 01:06 WIB; it was S1's in-flight line when S2 measured | none | no |
| three TS2367 in `wave-k-s2-*` test files | NOT reproduced: same run, exit 0; S2's in-flight files when S1 measured | none | no |
| capture static G-R16 names `src/modules/evidence/export-request.ts` | `exportDestinationDefaultOf` / `withDestinationDefault` compared `captureMode === 'simulated'` themselves, and `modules/evidence/index.ts:177,294` handed them `app.config.captureMode`: a new reader of the capture mode beside the one function | The route now ASKS the one function: `captureOperationOf(app.config) === 'SIMULATED' ? 'simulated' : 'real'` (once, at mount); the two helpers take that answer (`ExportCapture`), not the configuration's mode. A refused flag combination answers SIMULATED there, as everywhere. Behaviour of every booting configuration is unchanged | The rule itself did NOT move (no entry added to `LEGACY_MODE_READERS`). ONE pin moved: `modules/evidence/__tests__/static.test.ts` import list +1 (`../../capture/fence`). Ruled change: G-R16 "every reader asks the one function" (row 61) |

Test lines: capture + evidence + demo + transcripts + evidence-verify + capture-config + engine
static + `test/static`: `Test Files 115 passed (115)  Tests 1807 passed (1807)`. db:
`commands.db.test.ts` green inside the 5-file db run below.

### Item 2 - G89b-01 second half: a generated source's selector line states its adapter's profile

- Where the `H264_1080P25` comes from: the SELECTOR row `capture_config.video_0N_profile`. It is
  written by the SEED from the simulator's built-in selector (`packages/shared/src/sim/initial-state.ts:93,159-160`
  through `toRows`; `db/seed/seed.ts:181` `CAPTURE_SEED_PROFILE`), and `capture_config` is a KEPT
  table of a reset (`db/reset/kept-tables.ts`). The session copies the selector, and the seal
  compares that copy with the stream (`sealing-host/session-reader.ts:399-401`).
- What does NOT carry it: `capture_devices.profiles` of the seeded built-ins is `[]` (the engine
  state does not model it, `db/store/store.ts:166`); the generated adapter already declares
  `H264_720P30` (`capture/fence/generated-sources.ts`), the profile its argument table makes
  (`capture/adapters/local/camera-helper-args.ts:30`). `capture/adapters/fake/camera.ts:46`
  (`FAKE_CAMERA_PROFILE`) is the in-memory test double, not what a lane records from: unchanged.
- HOW THE ROWS ARE WRITTEN, and so how they are corrected: the FAKE rows and the selector are the
  seed's, not a registration's. The correction is therefore ONE statement in the unit of the
  capture fence's boot - the step that registers the generated adapters - in `REAL_DEVELOPMENT`
  only: NEW `src/capture/fence/fake-profile.ts` (`CORRECT_GENERATED_SOURCE_PROFILES`), called from
  `fence/boot.ts` after the local-device registration; `fence/index.ts` then restarts the engine
  (`reloadState`, the path a first registration already takes) so that slice 29 states it at once.
  A camera line whose device is of adapter kind `FAKE` and whose profile is not
  `GENERATED_CAMERA_PROFILE` takes it; `revision` + 1; `updated_at` the server clock. Idempotent:
  the second start writes nothing. It covers a lane whose kept rows exist AND a fresh seed.
- Never touched: a line of another kind (the local camera, a production camera), `capture_devices`,
  a selector with ONE device behind both tracks (two profiles must differ there), a simulated or
  production Core, the seed, the simulator's built-ins. No profile is threaded through the capture
  files; no 1080p encode.
- Within a run an operator can still set another profile on such a line (op 77 / 78); a camera
  re-assignment (op 79) keeps the slot's profile (`packages/shared/src/sim/capture-config.ts:158`).
  The manifest then states the stream and the notice is raised - until the next start corrects it.
- Tests:
  - db, the real boot as `dems_app` (`capture/fence/__tests__/fence.db.test.ts`, 2 cases appended):
    a seeded clone says `H264_1080P25`, revision 1 -> after the development start both lines say
    `H264_720P30`, revision 2, the engine's slice says it, the registry's adapter declares the same
    text, one log line; second start: nothing written. CONTROL: a simulated Core corrects nothing;
    the local camera on VIDEO-01 keeps its own profile while VIDEO-02 (FAKE) is corrected.
    `Test Files 1 passed (1)  Tests 16 passed (16)` (second run; the first failed on the TEST's own
    `bigint` read as text, no product change).
  - reader (`sealing-host/__tests__/wave-k-s1-stream-profile.test.ts`, 2 cases appended): the
    generated 1280 x 720 at 30 files under a selector that says `GENERATED_CAMERA_PROFILE` ->
    `tracks[].profile` equals the configured profile and NOTHING is told; CONTROL: a deliberately
    mismatched selector (`H264_1080P30`) -> the stream is stated and the difference told for both.
  - blast radius, 10 db files that boot a development-capture Core: `Test Files 10 passed (10)  Tests 42 passed (42)`.
- NOT proven by me: the manifest of a REAL recording by the built worker (seal e2e, kill matrix,
  development e2e) - not run.
- Pins moved: `capture/__tests__/static.test.ts` fence file list +1 (`fake-profile.ts`);
  `capture/fence/__tests__/fence.test.ts:263` "no UPDATE statement" -> "the ONE update is the
  selector statement, on `capture_config`, never `capture_devices` / `adapter_kind`" (the test's
  subject, no built-in touched, still holds); the in-memory double `fence/__tests__/support.ts`
  answers the new statement. `fence/statements.ts` and its pin ("no UPDATE in this file") are
  UNCHANGED. Ruled change: the controller's ruling of 2026-10-11 on G89b-01.
- Seal e2e / kill matrix, read only: `sealing-host/__tests__/e2e/seal-e2e.db.test.ts` and
  `sealing/__tests__/kill-matrix/*` hold NO assertion on `H264_1080P25`, on `tracks[].profile` or
  on `STREAM_PROFILE_DIFFERS` (grep: only the session-create bodies). No stale pin to move there.

### Item 4 - the demo reset's rows and the sending device (S2's leftover; D216 (2))

- Can a paired device send it? YES on the server: the access rule of ops 73 / 75 asks the
  permission DEMO_CONTROL and the demo flag (`plugins/permission-guard/decision.ts:207`), not the
  kind of session. (The mobile app offers no such control; the API does not refuse a device.)
- `ACCESS_DENIED` refusal row: `modules/demo/host.ts:98` wrote `deviceId: null` as a constant.
  Change: `ResetCall.deviceId?` (`modules/demo/reset.ts`), filled by the routes from the caller's
  principal (`modules/demo/index.ts` `deviceIdOf`), handed to `auditRefusal`, written on the row;
  a web console session: `null`, as before.
- Lineage row (`audit_chain_history`, `db/reset/kept-tables.ts:185`): the table has NO device
  column (`reset_no, epoch, head_hash, row_count, first_seq, last_seq, reset_at, actor_id, reason,
  scenario`). Carrying a device needs a migration: NOT done, `src/db/reset` unchanged.
- Test: NEW `modules/demo/__tests__/wave-k-kr-reset-device.test.ts` (the refusal handed to the host
  with / without a device; the row the host writes). In the 115-file unit run above.
- Pins moved: `modules/demo/__tests__/static.test.ts` rule M3 - the folder now holds ONE read of the
  caller's device (`principal.deviceId`, in `deviceIdOf`) and a second `const { principal } = request`.
  Ruled change: D216 (2). The existing `refusals` pins did not move (a web call hands no member).

### Item 5 - G89b-07: nothing written.

### Item 6 (controller addition) - op 86 `reason`, and `archiveOnCore` through the Live source

- `reason` (G81b-09): `TranscriptRevisionSchema` was a strict object without it while the row holds
  it (`modules/transcripts/store.ts` `NewTranscriptRevision.reason`). Change: `reason?: string` on
  the schema (`packages/shared/src/api/evidence.ts`), written by `revisionAnswer`
  (`modules/transcripts/routes.ts`) from the stored row - so it is on op 85's answer and on every
  entry of op 86. Example `TRANSCRIPT_REVISION_REASON_EXAMPLE`; both registry examples carry it.
  Access unchanged: the handler's `holdScope` runs before any entry is read. OpenAPI regenerated.
  db test appended to `modules/transcripts/__tests__/transcript-routes.db.test.ts` (two revisions,
  both answers, the 403 of a caller outside the case scope carries no reason, the contract):
  `Test Files 1 passed (1)  Tests 23 passed (23)`.
- `archiveOnCore`: dropped in `packages/shared/src/live/source/bindings.ts` (`evidenceExported`
  built `{ ok, status, exportId, jobId? }` only). Change: handed on by name when the 202 states a
  boolean (`LiveExportAccepted.archiveOnCore`). Test appended to
  `packages/shared/test/live-source-bindings.test.ts`; `Test Files 19 passed (19)  Tests 567 passed (567)`
  (bindings, openapi, `test/api*`).

## 2. Tests run (each once; a second run only after a fail)

| Check | Command (repository root) | Result |
|---|---|---|
| core-server unit, touched areas + static rules | `npx vitest run --root apps/core-server --project unit src/engine/__tests__/static.test.ts src/capture src/modules/evidence src/modules/demo src/modules/transcripts src/evidence-verify src/sealing-host/__tests__/wave-k-s1-stream-profile.test.ts src/modules/capture-config test/static` (sandbox off: loopback) | first run 4 red = the 4 pins of items 2 and 4 (moved); second run `Test Files 115 passed (115)  Tests 1807 passed (1807)` |
| db, the reds + touched files, one worker | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 src/engine/__tests__/commands.db.test.ts src/capture/fence/__tests__/fence.db.test.ts src/modules/transcripts/__tests__/transcript-routes.db.test.ts src/modules/evidence/__tests__/wave-k-s2-sending-device.db.test.ts src/modules/demo/__tests__/reset-failures.db.test.ts` | `Test Files 1 failed | 4 passed (5)  Tests 2 failed | 75 passed (77)` - the 2 red were my new fence cases (test read a bigint as text); fence file re-run `16 passed (16)`; transcript-routes re-run after a lint edit `23 passed (23)` |
| db, development boots in the blast radius of item 2 | same lock, `--maxWorkers=1`, 10 files (`capture/__tests__/wave-h-f-boot-clear`, `capture/fence/__tests__/development-session`, `capture-discovery/__tests__/wave-i-a2-adopt-assign`, `capture-config/__tests__/integration-c1`, `integration-d1b`, `capture-notices/__tests__/session-start`, `devices/__tests__/source-class`, `engine/__tests__/wave-k-s1-restart-fault`, `capture-actions`, `sessions/__tests__/audio-intervals`) | `Test Files 10 passed (10)  Tests 42 passed (42)` |
| shared | `npx vitest run --root packages/shared test/live-source-bindings.test.ts test/openapi.test.ts test/api` | `Test Files 19 passed (19)  Tests 567 passed (567)` |
| typecheck, whole | `npx tsc --noEmit -p apps/core-server` ; `-p packages/shared` | exit 0 ; exit 0 |
| lint, whole | `npm run -s lint -w @dems/core-server` ; `-w @dems/shared` | exit 0, no warning ; exit 0 |
| OpenAPI | `/usr/bin/lockf -k .locks/npm.lock node --import tsx packages/shared/scripts/gen-openapi.ts` | `97 operations ... 1360750 bytes` |

## 3. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm test -w @dems/core-server` (sandbox off) | none | green |
| `npm run test:db -w @dems/core-server` (sandbox off) | `.locks/db-migrate.lock` | green. A db test that boots a development-capture Core and pins `captureConfig.cameras[].profile: H264_1080P25` or the selector's `revision: 1` AFTER the boot is a stale pin of item 2 (22 db files boot such a Core; none was found pinning it by grep; 11 were run green - the 10 above and the fence file - not run, beside the e2e files of the next row: `capture-session/__tests__/session-capture.db.test.ts`, `sessions/__tests__/recover-failed-seal.db.test.ts`, `evidence-export/__tests__/export-restart.db.test.ts`, `storage/__tests__/volume-at-boot.db.test.ts`, `capture-discovery/__tests__/lane-camera-stub.db.test.ts`, three `engine/__tests__` restart files) |
| seal e2e (`DEMS_SEAL_E2E=1 ... sealing-host/__tests__/e2e/seal-e2e.db.test.ts`), kill matrix, development e2e, export e2e | `.locks/heavy-host.lock` + db lock; ports 8554 / 8556 free (lane 2 DOWN) | 3 of 3; 35 of 35. Case (a)'s manifest reads `tracks[].profile: H264_720P30` and the session carries NO `STREAM_PROFILE_DIFFERS` alert. No assertion of those files pins the old value |
| `npm test -w @dems/shared` | none | green |
| `npm test -w @dems/core-web`, `-w @dems/mobile`, `-w @dems/mock-core` + typechecks | none | additive members only; a client test that pins the exact resolved value of `exportEvidence` against a fake 202 that states `archiveOnCore` now sees the member |

## 4. Re-drive list (lane 2, after M1 restarts it)

1. Core log of the start: `DEV_GENERATED_SOURCE_PROFILE_STATED` once; op 76 `cameras[].profile`
   = `H264_720P30` for CAM-01 / CAM-02; a second restart: no line, the revision does not move.
2. Record on the FAKE sources and seal: `manifest.json` `tracks[].profile: H264_720P30`; NO alert
   with `params.reason: STREAM_PROFILE_DIFFERS` for that session; verify PASS 15 of 15.
3. Set one camera line to another profile (op 78), record, seal: the manifest states the stream,
   one WARNING notice names the file. Restart: the line is `H264_720P30` again.
4. Op 41 on the tamper demonstration (VIDEO-02 fragment 3): the VIDEO-02 file row carries
   `plainOk: false, plainChecked: false`; the VIDEO-01 row has no such member. Web and tablet row:
   decrypted bytes "Not run".
5. Op 86 of a revised item (`EV-20261010-0020`): every entry carries `reason`; web and tablet
   revision lists show it without the audit fallback.
6. Export from web and tablet on lane 2: the client reads `archiveOnCore: true`; lane 1
   demonstration item: `false`, no "stored on the Core" sentence.
7. Lane 1 (simulated, phone paired): a refused reset sent with a device session writes
   `ACCESS_DENIED` with `deviceId: DEV-...` (API call; the app has no control for it).

## 5. Decisions for the controller

1. `plainChecked` is written ONLY as `false` (S1's proposed form) and per file; a required key that
   is missing stays a plain failure (V-05 FAIL with a finding of that track), not "not run".
2. Item 2 is a start-time statement of the capture fence, not a seed change: one mechanism serves
   kept rows and a fresh seed, and a simulated Core keeps the simulator's profile. It bumps the
   selector's `revision` and writes NO audit row (as the registration of the local devices at the
   same step writes none; the boot row `SYSTEM_BOOT` is the record of the start). Say so if a row
   is wanted.
3. `session.input.profileId` (`STANDARD_1080P25`, a closed set of one, CHECK-constrained) still
   names 1080p25 on a development session. It is the session's profile ID, not field 36; changing
   it needs a new value of a closed set (schema CHECK = a migration). Not touched.
4. The demo static rule M3 ("the folder reads no device of the caller") now allows one read, for
   the audited refusal only. The alternative - the guard's own denial writer - would move the row
   out of the module.
5. The reset's lineage row cannot carry a device without a migration (no column). The
   `SCENARIO_LOADED` row of a reset that RAN (`db/reset/plan.ts:206`) also carries no device; it is
   written into the NEW database by the routine and was not in the task: one line if D216 (2) is to
   reach it (the paired devices are carried over, so the FK can hold).
6. G-R16: the export default now follows the capture OPERATION. Identical for every configuration
   that boots; a refused combination (real + demo controls) would read "simulated", and never runs.

## 6. Open items

- Not proven here: everything in section 4, and field 36 on a real recording (heavy runs).
- W and M2 read `plainChecked`, `reason`, `archiveOnCore` by the names in `contract_wave_k.md` (KR).
- Docs owner: errata for C3 op 41 (`files[].plainChecked`), ops 85 / 86 (`reason`), capture spec
  (the selector line of a generated source is corrected at a development start).

---
*Generated: 2026-10-11 01:22 WIB*
