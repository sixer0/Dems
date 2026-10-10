---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: wave H, closing pass Z1 - server / shared leftovers of the seven fix drivers
date: 2026-10-10
agent: coder-execution
narrative_tier: 2
source_brief: delegation_progress/fix_brief_wave_h.md (decision D200); rulings D201 (5), D203 (1) (4), D206 (2) (3), D207
tree: f293221 + the working tree of wave H (no commit, no migration: schema 6 / dbc-7 untouched)
status: needs-review - all ten items built and green in tests; nothing was driven on a device, in a browser or with the built worker
---

# 128 - Fix wave H, closing pass Z1

No commit. No migration. No git write of any kind. No formatter run. The gate environment was not
used. Decision D207 is cited as the task names it; `decisions/decisions.md` held no row D207 when
this note was written (the controller's to add).

## 1. Items

| # | Finding | Reproduced (red)? | Fix | Test | Status |
|--:|---|---|---|---|---|
| 1 | Truthful time in the Core's own capture (D203 (1)) | YES - `sim-wave-h-z1-time.test.ts` before the fix: slice `GNSS`, TIME item `PASS / GNSS`, `RECORDING_STARTED {timeSource: GNSS}` (3 red) | `sim/core-facts.ts`: `HOST_CLOCK_TIME`, `hostClockTimeTransition`, `isHostClockTime`, `isPrecheckNote`. Where the capture is `'external'` the slice is the host clock: `hostClock: true`, `source: RTC`, not locked, no satellites, no NTP, offset 0, empty history - in the first state (`engine.ts`), at every health tick (`health.ts`, which no longer steps it) and when the Core adopts a stored state (`engine/host.ts`, "Time block"). `RECORDING_STARTED.timeSource`, `startTimeSource`, `stopTimeSource` and the START node follow the slice unchanged. Pre-check TIME = a NOTE: `WARN`, value `HOST_SYSTEM_CLOCK`, "Time source: host system clock (no GNSS)", `reasonCode: null`, `params.rule: TIME_HOST_CLOCK`; `advancePrecheck` and the acknowledgement count leave notes out, so the outcome is PASS and the session arms by itself. `systemStatus` raises no `TIME_FALLBACK` for the host clock. Contract: `time.hostClock?: true` (optional) | shared `sim-wave-h-z1-time.test.ts` (6 + controls: simulated keeps GNSS; a real warning beside the note still asks for its acknowledgement and counts 1); Core rig `session-capture.db.test.ts` describe "Z1" (slice, ARMED without acknowledgement, the audit row `{timeSource: RTC}`, no `GNSS` in any row of the session); `capture-checkpoint-doors.test.ts` (the slice parses) | FIXED |
| 2 | Idle `HEALTH_CHECK_OK` in the Core's own capture (D203 (4)) | YES (same file, 1 red: 15 events in 30 idle minutes) | `sim/generator.ts`: one condition - the idle draw is kept (the other streams do not shift), no event is written; `idleHealthActivity` removed | same file, describe "item 2" + the simulated control; driver A's pin moved | FIXED |
| 3 | Installation identity for manifest fields 20 / 21 (driver A decision 2; D207) | YES - `wave-h-z1-installation-identity.test.ts`: the reader handed over `DEMS-IR-01` / `Interview Room 1` (3 red) | Two keys, waived edit of `config.ts` / `load-config.ts`: `DEMS_INSTALLATION_DEVICE_ID`, `DEMS_INSTALLATION_NAME`. NEW `sealing-host/installation-identity.ts`: the ONE reader `installationIdentityOf`, the verdict table, the boot step. `session-reader.ts` states the configured identity or `NOT_CONFIGURED`; the stored device record is no longer read. REAL_PRODUCTION without it: boot step `sealing.installation-identity` throws `INSTALLATION_IDENTITY_NOT_CONFIGURED` (persisted first, names the missing keys); REAL_DEVELOPMENT: one warning of that code; SIMULATED: not asked | same file (19: reader, verdicts, boot function, the two parsers, a static one-reader rule with its control); pins of `config.ts` moved in `capture/__tests__/static.test.ts` | FIXED in units. NOT proven: a whole Core that refuses to boot (section 4) |
| 4 | Capture checkpoint facts for the Monitor (driver A decision 3) | YES - rig case red before the wiring (`expected undefined to deeply equal { fragments: 1, ... }`) | Contract: `session.captureCheckpoints?: { fragments, bytes, lastAt, cameras: [{ deviceId, fragments, bytes }] }` (optional, not stored). NEW `engine/capture-checkpoint-doors.ts` (door `applyCaptureCheckpoints`, beside the seam; refuses another session, a simulator's recording, non-counts, figures that go backwards). `capture-session/index.ts` counts each `FRAGMENT_CHECKPOINT` by camera and says the figures at most every 5 s of the Core clock and once at each of the three ends | `engine/__tests__/capture-checkpoint-doors.test.ts` (5 + simulated control); rig case with the fake worker (absent before the first checkpoint, window, by camera, final figure at the stop, equal to the `recording_fragments` rows, no audit row) | FIXED. Names sent to Z2 at 10:30:00Z |
| 5 | `DemoFaultRequestSchema` strict (D206 (3)) | YES - 3 red in the shared test and 3 on both routes (a top-level `cameraId` was accepted) | `api/demo-controls.ts`: `DemoFaultRequestSchema` and `FaultTargetSchema` are `strictObject` | `api-wave-h-z1-demo-fault-strict.test.ts` (3 + 3 controls); `modules/demo/__tests__/routes.test.ts` (+3 rows, both operations, engine not called) | FIXED |
| 6 | In-app simulator op 97 states `adapter: FAKE` / `sourceClass: DEVELOPMENT` | YES - the existing pin stated it; moved first, red | `sim/api.ts`: the two members are not written. Erratum PE-WH-01 in `masterplan/03_api_contract.md` (§2.6 row "Microphones" + the index) | `sim-capture-discovery.test.ts` (pin, absence, the body still parses) | FIXED |
| 7 | `controller.ts` reads `stoppedAt !== null` as STOPPED for a SEALED session | YES - 2 red (`FINISH` said `STOPPED` for an interrupted sealed session) | `sealedItemInterrupted(item)`: the sealed flag where the item states it, else the custody entry `RECORDING_INTERRUPTED`; the FINISH decision reads it. The other branches are unchanged (an unsealed interrupted session still has no `stoppedAt`) | `sealing/__tests__/pipeline.test.ts` (+4: two interrupted shapes, two controls) | FIXED |
| 8 | A non-WAV speech fixture passes the boot (driver E decision 5; D201 (5)) | YES by mutation - with the format check switched off 3 of 18 fail (the text file boots); restored from my own copy | `fake-mic.ts` `speechFixtureFormatProblem` (RIFF / WAVE, integer PCM, mono, 16 bit, 48 kHz, a sample); read through NEW `readFileHead` of `process-door.ts` (the pinned file-system door), after the path rule; no reader = `UNREADABLE` (fail closed). `scripts/capture/speech-fixture.mjs` `speechFixtureWavProblem`: a kept file and the file it makes are held to the same rule | `wave-h-z1-speech-fixture-format.test.ts` (18, a text file renamed `.wav` through the real reader and the boot); `test/support/speech-fixture-setup.test.ts` (10: both implementations on the same vectors; the set-up's KEPT path) | FIXED |
| 9 | A control that holds the connecting state (driver B decision 6) | no red seen (a new control: the test failed only for the missing symbols) | `CreateSimOptions.captureConnectMs` (0..600,000 ms, else the default 1,000), `HeadlessSimOptions.captureConnectMs`, `EngineHostDependencies.captureConnectMs`. **No Core environment key** (section 2, decision 3) | `sim-wave-h-z1-connect-hold.test.ts` (4); `engine/__tests__/wave-h-z1-connect-hold.test.ts` (2) | BUILT as the sim option only |
| 10 | Pins | - | Engine file list: 24, every name listed. The four reds the task named (`receiver-cli.ts`, `src/evidence-facts`, `development-discovery.ts`, a `sealing-host` deep import) were NOT red in my whole-unit run: nothing to do. Pins moved: section 3 | whole unit project | DONE |

## 2. Decisions for the controller

1. **The pre-check note has no reason code.** `PrecheckReasonCode` is a closed enumeration and the web client holds a `Record` over it: a new value would have broken core-web's typecheck in Z2's area. The note follows the precedent of an unreachable source (`reasonCode: null`, the rule in `params.rule`). Until Z2 draws it, core-web's `reasonKeyFor` words the item as the RTC fallback ("timeRtc").
2. **`systemStatus` raises no `TIME_FALLBACK` for the host clock.** Otherwise every real Core would read WARNING for good. Not in the task text: confirm.
3. **Item 9: no environment key.** It needs a new line in the frozen `config.ts`, and the waiver names the two identity keys. A lane Core therefore cannot hold the connecting state today; only a test rig can. One key (`DEMS_CAPTURE_DEV_CONNECT_MS`, refused outside SIMULATED development) is one more waived line and one line in `engine/index.ts`.
4. **The checkpoint figures are throttled to one engine unit per 5 s**, not one per fragment (each unit is a revision and a realtime delta). `lastAt` is the Core clock when the checkpoint was heard, not the worker's `durableAt`. The REST `Session` does not carry the member; the slice does.
5. **`FaultTargetSchema` is strict too** (an unknown member inside `target` was dropped the same way). `ScenarioLoadRequestSchema` was NOT changed (driver D proposed it; the ruling names the fault request).
6. **A test Core has a default identity** (`test/support/config.ts`: `DEMS-TEST-01`), so the rigs that boot REAL_PRODUCTION keep booting. Manifests sealed by test rigs now say that identity; a lane without the keys says `NOT_CONFIGURED`.
7. **A demo `GNSS_LOSS` on a real-capture Core**: the fault entry stays active while the slice says host clock again within a second. Whether demo time faults should be refused there is open.
8. **The speech fixture must be 16 bit.** The task says "PCM, mono, 48 kHz"; 16 bit is what the set-up writes and I added it to the rule.
9. **Pins of driver B's finished fixes moved by me** (section 3, last two rows): they were red in my area and name no defect.

## 3. Pins moved (by delta)

| File | Pin | Why |
|---|---|---|
| `packages/shared/test/sim-wave-h-a-generator.test.ts` | idle `HEALTH_CHECK_OK` "stays" -> "not written" | item 2 |
| `packages/shared/test/sim-capture-discovery.test.ts` | op 97 entries without `adapter` / `sourceClass` | item 6 |
| `apps/core-server/src/capture/__tests__/static.test.ts` | `WAIVED_CONFIG` + 28 lines; last ENV names 6 -> 8 | item 3 (D207) |
| `apps/core-server/src/engine/__tests__/static.test.ts` | file count 23 -> 24, by name | items 4, 10 |
| `sealing-host/__tests__/wave-h-a-manifest-facts.test.ts`, `sealing-host.test.ts` | fields 20 / 21 | item 3 |
| `capture/fence/__tests__/fake-mic.test.ts` | two "usable fixture" cases hand in a WAV head | item 8 |
| `db/fixtures/__tests__/audit-details.test.ts` | a third `FAULT_RAISED` form and a second `FAULT_CLEARED` form, with `reason` | driver B, G75-05 / G75-09 |
| `modules/sessions/__tests__/journey.db.test.ts` | `elapsedMs` of a faulted recording 100,000 -> 10,000 | driver B, G75-08 |

## 4. Checks I ran, and what is not proven

| Check | Result |
|---|---|
| shared suite, once at the end | 112 files, 2542 passed |
| core-server unit, the WHOLE project once (`--maxWorkers=4`) | 329 files; 6462 passed, 4 failed (3 pins of section 3, 1 import of my new file into the adapter layer - fixed). The files that failed and the folders I touched afterwards re-run: 54 files, 799 passed |
| db: `capture-session`, `modules/sessions`, `engine`, `capture/fence` (without `e2e/`), `modules/demo` | 29 files: 228 passed, 1 failed (the journey pin, moved, re-run 16 passed); `session-capture.db.test.ts` alone 55 passed |
| db: `sealing-host` (without `e2e/`), `modules/capture-inputs`, `simulated-no-source-class`, `capture/__tests__`, `test/acceptance/contract` (`--maxWorkers=2`) | 5 files, 49 passed, 3 skipped |
| typecheck shared, core-server, core-web, mobile; lint shared, core-server | 0 errors each |
| OpenAPI generator under `.locks/npm.lock` | "unchanged": the document in the tree already held my members (another pass had regenerated) |

- **A db run of `capture-session` + `engine` together failed twice with 37 errors**, 32 of them `remaining connection slots are reserved for roles with the SUPERUSER attribute`. Each file passes alone. The cause is the number of open pools on the one PostgreSQL server, not a test; my two rig cases were merged into one rig to add as little as possible. Whether it also occurs with the lanes stopped was not checked.
- Not run: the fence e2e and `seal-e2e.db.test.ts` (built worker, ports 8554 / 8556 held by lane 2), the whole db suite, core-web and mobile tests, any device or browser.
- Not proven by a test: a whole Core in REAL_PRODUCTION refusing to start for the identity (the boot function and its wiring line are; no rig boots production without a worker and a signing key), and the removal of the old identity from an e2e-sealed manifest.
- Item 1's Core case and item 9 were written with their fix (their red is the shared test's, respectively none).

## 5. Checks for the test runner

| Command | Lock | Expect |
|---|---|---|
| `/usr/bin/lockf -k .locks/db-migrate.lock npm run -s test:db -w apps/core-server` (sandbox off; lanes stopped if the connection limit shows again) | db-migrate | green; watch manifests that pinned `DEMS-IR-01` (now `DEMS-TEST-01`), `timeSource` in audit rows of real-mode rigs (`RTC`), rigs that acknowledged a TIME warning |
| `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k .locks/db-migrate.lock npm run -s test:db -w apps/core-server -- src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts src/capture/fence/__tests__/e2e` (lane 2 down) | heavy-host + db-migrate | sealed manifest: `device.deviceId` / `name` = the rig's identity; `audit-session-extract.jsonl` holds `RECORDING_STARTED {timeSource: RTC}` and no `GNSS`; the session arms without an acknowledgement |
| `npm run -s test -w apps/core-web`, `npm run -s test -w apps/mobile -- --maxWorkers=2` | - | reds that follow from this pass are Z2's: a simulator op 97 pin with `adapter`, a TIME row worded as RTC fallback, a time chart on an empty history |

## 6. To re-drive on a device / browser

1. Lane 2 (real capture), new session: pre-check passes with no acknowledgement; the TIME row reads "host system clock (no GNSS)" and is not counted as a warning; `GET time/status` says `hostClock: true`, `source: RTC`; the header shows no time-fallback warning.
2. Same session sealed: `audit-session-extract.jsonl` has `RECORDING_STARTED {timeSource: RTC}`; the manifest's `device.deviceId` / `name` are `NOT_CONFIGURED` on a lane without the keys, and the configured values with them.
3. Web Monitor on lane 2 while recording: the checkpoint figures appear after the first fragment, move about every 5 s, and are absent on lane 1.
4. Dashboard event feed of lane 2 idle for 10 minutes: no "System health check completed".
5. `POST /demo/faults {kind: CAMERA_LOSS, cameraId: VIDEO-02}` on lane 1: 422 (was: fault on the default camera).
6. In-app simulator (tablet, no Core): Devices / microphone re-read shows no source class.
7. Kill the Core of lane 2 after an interrupted seal committed and before its last step is DONE (kill-matrix C-S6): the restart finishes it and the log line of the resume says the run was INTERRUPTED.
8. A text file at `.data/dev-fixtures/speech-mic/dialogue.wav` with `--speech-mic`: the Core refuses to start with `DEV_SPEECH_FIXTURE_UNUSABLE`, reason `NOT_WAV`.
9. A Core started in REAL_PRODUCTION without the two keys: refused with `INSTALLATION_IDENTITY_NOT_CONFIGURED`.

---
*Generated: 2026-10-10 18:00 WIB*
