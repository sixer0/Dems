---
task_slug: input_av_core_adapter_plan
row: 85
milestone: M6 / WP-13b, with decision C46 (review finding F-07; gate M2 decision C50)
date: 2026-10-13
agent: coder-execution (batch 9, agent R1)
status: needs-review (C46 is closed and tested; the builder and the loader signature are built and tested; the APP-LEVEL composition of the dependency bundle is NOT built - section 5 lists each member)
tier: T3
requirement: C46 / F-07 / C50; addendum 6.4 WP-13b; AD-02 (2); AD-08 (2), (3); P12-F02; P12-F05 (b)
---

# Row 85 - the production registry builder, the loader signature, and the host facts at the real entry

Paths are relative to `/Users/gsp-budi/Documents/DEMS`; `CS` = `apps/core-server`. Everything is closed on doubles on this Mac. Nothing here has run on a Linux host.

## 1. C46 / F-07 / C50: a production start is held to its host at the real entry

### 1.1 Before and after, by line

| | Before row 85 (commit 0f5d2a8e) | After |
|---|---|---|
| The capture unit's mount | `CS/src/capture/index.ts:324-332`: `mountCaptureBootChecks(app, { timers, sinks })`, no host facts | the SAME call, now at `:327-335`, members unchanged (`timers`, `sinks`) - AD-08 (2) is kept |
| What the mount did without facts | `CS/src/capture/boot/index.ts:285-297`: `facts === undefined ? {} : { host, programs }` - `checks.ts` then ran NEITHER step 4d nor 4e (`checks.ts` `deps.host !== undefined`, `deps.programs !== undefined`) | `boot/index.ts:341-349` `hostChecksOf(facts)` is ALWAYS built; `:360-361` the boot step runs `hostChecksOf(provided ?? HOST_NOT_SEEN)` - both steps get their dependencies in every case |
| No facts handed in | a `REAL_PRODUCTION` Core started unchecked (the live defect of C50) | `HOST_NOT_SEEN` (`boot/index.ts:138`): limit unreadable, option variable counted as set, runner starts nothing. Step 4d refuses: `CAPTURE_HOST_CORE_FILE_LIMIT` / `LIMIT_UNREADABLE` |
| The real entry | `CS/src/index.ts` handed nothing in | `index.ts:110-122`: `captureBootControl(app).provideHost(captureHostOfProcess({ platform, startArguments, nodeOptionsSet, userLimits }, createSystemTimers()))`, after `app.ready()` and before `app.readiness.boot()` (`:123`) |
| The command runner | `hostCommandRunnerOver` had no caller | ONE caller: NEW `CS/src/capture/boot/host-facts.ts`, over the local helper door (`startHelperProcess`) |

`checks.ts`, `host-checks.ts`, `program-checks.ts`, `fence/boot.ts`, `fence/operation.ts` and `app.ts` are NOT edited. The order of the checks is unchanged: 1 to 4c refuse first.

### 1.2 The door

`CaptureBootControl.provideHost(facts)`: once, before the boot step asks. A second call, a call on a mount that was given the seam `host`, and a call after the step asked are refused (`CaptureHostFactsError`, code `CAPTURE_BOOT_HOST_FACTS_NOT_TAKEN`). The core-file limit is read from the runtime's own statement (`process.report.getReport().userLimits.core_file_size_blocks.soft`: an in-memory object, no file, no switch); anything not understood is `null`, which the check refuses.

### 1.3 The tests that prove it

| Claim | Test |
|---|---|
| A `REAL_PRODUCTION` start THROUGH THE CAPTURE UNIT'S OWN MOUNT, on the real app and PostgreSQL, runs 4d and 4e: no facts -> refused `CAPTURE_HOST_CORE_FILE_LIMIT`; the entry point's facts and NO relay program -> refused `CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE` / `NOT_SET`, nothing asked of the host; a prepared host -> lines `CAPTURE_HOST_PROFILE_NOT_ASKED`, `CAPTURE_PROGRAM_CHECKS_PASSED`, `CAPTURE_BOOT_CHECKS_PASSED` | `CS/src/capture/fence/__tests__/fence.db.test.ts:906` (case "C46 / F-07") |
| The same on the bare mount; without a guard the guard's code; a limit above 0 refused; the door's three refusals; SIMULATED and REAL_DEVELOPMENT never ask | `CS/src/capture/boot/__tests__/boot.test.ts:567, 586, 606` |
| The entry point's statement stands before `app.readiness.boot()`, with exactly the four facts; `provideHost` is called by `src/index.ts` alone; no production source states a core-file limit of 0; the two mount calls keep their members | `CS/src/capture/__tests__/static.test.ts`, cases "index.ts: ..." and "C46: ..." |

LIMIT OF "THROUGH THE REAL ENTRY": `src/index.ts` is a script (it runs at import, listens and exits the process). It is not started by a test. What is proven is its one statement by text, and the same function (`captureHostOfProcess`) and the same door on the real app with the real mount. A start of the script itself with no relay program is hardware check `9A/H-04`.

### 1.4 The sweep (C46: an explicit TEST host)

NEW `CS/test/support/capture-host.ts`: `TEST_CAPTURE_HOST` (a prepared host that is not Linux; its runner starts nothing), `provideTestCaptureHost(app)`, `testHostPrograms(directory)` (two stand-in programs, mode 0700, in the suite's own directory).

Suites swept: 4. Found by running every suite whose configuration names real capture (15 unit files, 12 database files); these are the ones a production boot PASSED in.

| Suite | Change |
|---|---|
| `CS/src/capture/boot/__tests__/boot.test.ts` | three bare mounts take the host and the two programs; 5 expected persisted lists gain the one warn row of a host that is not Linux; the case "NO host facts runs neither step" is TURNED (it pinned the fail-open) |
| `CS/src/capture/fence/__tests__/fence.db.test.ts` | one import, `REAL` gains the two programs, `boot()` and `coreOn()` hand the host in |
| `CS/src/modules/capture-config/__tests__/capture-config.db.test.ts` | one import, `PRODUCTION` gains the two programs, two boot sites hand the host in |
| `CS/src/modules/devices/__tests__/source-class.db.test.ts` | one import, `REAL` gains the two programs, `booted()` hands the host in |

NOT RUN by this row (they start the worker or bind ports; each has one real-capture configuration with the development flag on): `session-capture.db`, `export-e2e.db`, `seal-e2e.db`, `development-session.db`, `development-session-e2e.db`, `lane-camera-stub.db`, the kill-matrix child. The controller's full run is the check.

## 2. The loader and the builder (WP-13b)

| File | Change |
|---|---|
| `CS/src/capture/adapters/real.ts:54` | `loadProductionAdapters(operation, devices, dependencies)`; `ProductionAdapterDependencies<Camera, Audio>`. Another operation is refused before any import, as before; a missing bundle is refused before any import. It still loads the three class-C STUBS |
| `CS/src/capture/fence/index.ts:410` | `buildProductionRegistryOf(input)`, ADDITIVE. Refuses another operation before a read; reads the stored devices itself; serves the rows of the three production kinds through the loader; registers into an unchanged registry; supplies the list, `openSources`, `probeAdapters`, `admit`, `audioCards`, `closeAll`. The boot step still calls `buildProductionRegistry(mount.locked)` (`:627`) |

Verification cell, each part:

| Part | Evidence |
|---|---|
| built against a clone with production rows it lists the expected devices | `fence.db.test.ts:954`: 4 production rows listed, 0 development rows, 1 read |
| a call for another operation is refused before any import | `real.test.ts`: SIMULATED and REAL_DEVELOPMENT -> `CAPTURE_REAL_ADAPTERS_REFUSED`, 0 reads, 0 loads; the same on the clone |
| both built adapters CAN be constructed from the bundle | `real.test.ts`, third case: `createOnvifRelayCameraAdapter` and `createUsbAudioProductionAdapter` built from ONE typed bundle of doubles; each states its opener; a real registry still refuses them (`CAPTURE_ADAPTER_INVALID`), and the builder closes what was built |
| `assertRecordable` still refuses the production kinds | `real.test.ts` second case (4 devices), `fence.db.test.ts:954`; the existing tests that say so are unchanged |
| static rule: no seam argument | `static.test.ts` case "row 85: ..." - closed member list with a planted control; no production caller before the lift |

## 3. Static pins moved in `CS/src/capture/__tests__/static.test.ts`

| Pin | Move | Authority |
|---|---|---|
| the entry point's lines that name capture | 2 -> 7 (one import, the statement's two lines, two comment lines) | C46 |
| callers of `hostCommandRunnerOver` | `[host-checks]` -> `[host-checks, host-facts]` | row 81's open pin, C46 |
| `config.ts` waived lines | +9 lines in 5 places, key list 10 -> 11 (`DEMS_CAPTURE_ALIAS_SOCKET`) | SERVED FOR ROW 105 (agent R7), whose edit of `config.ts` had turned the digest red; no request line existed yet |
| new cases | "row 85: the production registry builder ...", "C46: steps 4d and 4e ..." | this row |

Not an SR-1 to SR-5 entry: no list of G-R2 or G-R8 grew (`host-facts.ts` imports no process module and reads no environment).

## 4. Driver decisions (for the controller to confirm)

| # | Decision | Reason |
|---|---|---|
| DD-1 | The facts go through a DOOR of the boot control, not through `buildApp`'s options as record 081 sketched | `app.ts` is digest-frozen, and `CS/test/static/slot-replacement.test.ts` pins the entry point's call `buildApp({ config, errorLogFile: DEFAULT_ERROR_LOG_FILE })` literally (not my file). The door also leaves both mount calls with today's members (AD-08 (2), row 157) |
| DD-2 | Absent facts are `HOST_NOT_SEEN`, refused by the EXISTING code `CAPTURE_HOST_CORE_FILE_LIMIT` / `LIMIT_UNREADABLE`; no new refusal code | a new code belongs in `checks.ts`, which my cells do not open. Cost: the reason names the limit, not "no facts handed in". It can only occur in a composition that is not the entry point |
| DD-3 | A test's "passing double" is the host facts PLUS two stand-in programs in its configuration | C46 says the suites pass "a passing double" while booting "without a relay". The mount takes the two program paths from the configuration, so no host double can pass without them unless `src/` gained a path override only tests use (AD-08). Conservative: no such override |
| DD-4 | The core-file limit is read from the runtime's in-memory report | the runtime has no call for a resource limit; a shell (`ulimit`) is what row 80's block forbids. HOST-36 forbids the report SWITCHES; no switch is set and nothing is written |
| DD-5 | The builder is handed the loader (`load`) | rule A-1 lets no production file import `real.ts`, and its test file is agent R3's. At the lift the fence becomes that importer |
| DD-6 | The bundle's two shapes are type parameters in `src/` | rule A-9 lets no production source name a built adapter file, not for a type either |
| DD-7 | `real.test.ts` calls the loader for REAL_PRODUCTION (it loads the three stubs) | the row's own check needs the devices listed through the loader. The stubs build nothing; rule A-1's static half is unchanged and green |

## 5. NOT BUILT (why the status is needs-review)

The builder takes a dependency bundle; WHO composes that bundle from the running app is not built. Each member, with what blocks it:

| Member | State | Blocked by |
|---|---|---|
| credential reader (`wireCaptureCredentialHolders(...).cameraAdapter`) | not wired | two list entries in files of other writers: rule R-6 (`capture-config/__tests__/static.test.ts`) and `EXPOSED` (`test/static/imports.test.ts`); and a unit below the modules may not import a module - the composing unit must be named |
| destination rule with the host facts (`storedAddress`; camera interface and subnet of `capture_network_config`) | not wired; nothing reads the row for the rule today (the boot reads `interface_name` only) | row 108's read operation; the reader is to be injected |
| relay report source (`sessionCapture(app).replace({ relayReports })`, C34) | not wired | it is a member of the BUILT camera adapter, which no production source may name before the lift |
| card enumerator (`captureAudioCardsControl(app).provideEnumerator`) | not wired; operation 99 still answers 503 | the same import rule (a unit below the modules) |
| camera watch and microphone loss watch (rows 49, 68), the clock read | not wired | they hang on the built adapters; and the open ruling of rows 49 / 68 on who clears a fault |
| stored facts of a stream, stored row of a microphone | not wired | readers of `capture_device_streams` and of the microphone row |
| device entries | label only: capabilities and profile list are empty | a wider read than `READ_STORED_DEVICES` |
| admission after the boot | `NOT_SERVED` for a new production device | an adapter takes its devices when it is built |

WHAT ROW 88 SWITCHES, given this row: (1) in `real.ts` the first two imports and the two type parameters; (2) in the fence's boot step `buildProductionRegistry(mount.locked)` -> `buildProductionRegistryOf({ ... })` with the loader imported there; (3) the opener list and the new registration rule; (4) rules A-1, A-9 and the "no production caller" line of the row-85 static case. It ALSO needs the composition of section 5, which is more than a switch.

## 6. Checks run

| Check | Command | Result |
|---|---|---|
| unit: boot folder, capture static, adapters tests and static, fence unit tests, `test/static`, module | `npx vitest run --project unit --maxWorkers=2 src/capture/boot src/capture/__tests__/static.test.ts src/capture/adapters/__tests__ src/capture/fence/__tests__ test/static src/capture/__tests__/module.test.ts` | `Test Files 35 passed (35)`, `Tests 663 passed (663)` |
| database: the three swept suites (run 2, after the sweep) | under `.locks/db-migrate.lock`, sandbox off, `--project db --maxWorkers=2` on `fence.db`, `capture-config.db`, `source-class.db` | `Test Files 3 passed (3)`, `Tests 84 passed (84)` |
| database: fence and boot, with the two new cases | the same on `fence.db`, `boot.db` | `Tests 1 failed / 48 passed (49)`: the failure is the schema pin `fence.db.test.ts:139` (expects 9 / dbc-10, the tree is at 10 / dbc-11) - agent R6's line, in flight, not edited |
| database: the nine other candidates, before the sweep | `boot.db`, `precheck-unassigned.db`, `session-start.db`, `volume-at-boot.db`, `capture-discovery.booted.db`, `restart.db`, `audio-intervals.db`, `recover-failed-seal.db`, `export-restart.db` | all passed unchanged |
| typecheck | `npx tsc --noEmit` in `CS` | 0 errors |

Run 1 of the database set showed the 12 cases that needed the sweep (the proof that the refusal bites through `buildApp`). Reds seen in files of others during the row, gone or theirs: `test/support/host-command-unit.db.test.ts` against two `test/static` rules (R7), `src/sealing/production-key.ts` against the installation-identity rule (R9), `packages/shared` mid-edit (R5).

## 7. Doubles, and what stays unproven

| Double | What it is |
|---|---|
| the host | `TEST_CAPTURE_HOST`: fixed facts, a runner that answers the relay's question with exit code 10 and starts nothing |
| relay and guard | two shell stand-ins that only pass the path rule; never started |
| the adapters' dependencies | functions that fail if called; the two adapters are constructed, never opened |
| the loader on the clone | a function that returns adapters without an opener |

| Unproven | Check |
|---|---|
| the installed runtime states `userLimits.core_file_size_blocks.soft` in this form on Ubuntu 24.04; a unit with `LimitCORE=0` reads 0 | `9A/H-04` |
| a start of `src/index.ts` itself with one prerequisite removed names exactly that one | `9A/H-04` |
| the host's questions through the local helper door with an empty environment | `9A/H-01`, `9A/H-05` |
| everything of section 5 | row 88 and its composition |

## 8. Rules kept, and one broken

Edit tool for every existing file EXCEPT ONE: `CS/src/capture/adapters/__tests__/real.test.ts` (18 lines) was replaced with the Write tool. Its one earlier case is kept in substance (the loader call gained its third argument); the diff is to be read at the commit. No commit, no stage. No full suite. No process started by a test of this row, no port bound, no heavy lock needed. No real device, no credential. `apps/input-av/` not opened.

READ IN PART, NOT IN FULL (the brief asked for full): the records 045, 144, 145, 046, 049, 050, 067, 068, 070, 096, 048, 188, 190, i07 and `test/033` were read through their request lines in `file_requests.md` and through the code they describe; 080 and 081, addendum sections 1, 2, 6, AD-02, AD-03 (ranked line), AD-08, C46, C48 and F-07 were read in full. Section 5 is where that shows.
