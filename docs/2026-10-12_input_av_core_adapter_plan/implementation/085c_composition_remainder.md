---
task_slug: input_av_core_adapter_plan
row: 85c
milestone: M6 / WP-13b (the remainder of the production composition; decision C60 (2), (3))
date: 2026-10-13
agent: coder-execution
status: needs-review (members (b) to (f) built and proven on doubles; (g) built up to a door neither built adapter has yet; two static reds and typecheck errors of other rows' sources in flight)
tier: T3
requirement: C60 (2), (3); C57 (the loss watch and a superseded attempt); C37; C36; G-R12 / SR-4; SR-1 entry 1; AD-07 (2); OD-14 (config keys)
---

# Row 85c - the remainder of the production composition

Paths are relative to `/Users/gsp-budi/Documents/DEMS`; `CS` = `apps/core-server`. Everything is closed on doubles on this Mac. No worker, relay, test camera or port was started; no real device and no credential was touched. The one kind of process started is a shell script of the test in a temporary directory (the stand-in of the listing program).

## 1. The members

| # | Member | State | Where |
|---|---|---|---|
| b | Runner of the card listing program | BUILT | `CS/src/capture/adapters/local/mic-helper-args.ts` (the row), `CS/src/capture/fence/production-parts.ts` (`cardListingProgramsOf`, `hostCardEnumeratorOf`), `CS/src/capture-composition.ts` (member 4/6) |
| c | Audio helper configuration key | BUILT | `CS/src/config.ts`, `CS/src/plugins/config/load-config.ts`; `dependencies.audio.helperProgram` |
| d | Watch fault sink, ruling C60 (2) | BUILT | `production-parts.ts` (`watchFaultSinkOf`), `camera/camera-watch.ts` (`raisedHere`), the composition's `faults` in both watch bundles |
| e | `sourceLost` attempt-awareness | BUILT | `adapters/audio/mic-loss.ts` (option `superseded`), the composition's `watches.microphone.superseded` |
| f | Wider device read | BUILT | `production-parts.ts` (`READ_STORED_DEVICE_PROFILES`, `productionDeviceEntryOf`), `fence/index.ts` (`buildProductionRegistryOf`) |
| g | Admission after the boot | AT THE DOOR | `fence/index.ts` (`admit`, `admitted`, `reader`, `onAdmission`, `LateDeviceAdapter`); the two built adapters do not have the door (request) |

Not this row: the network-facts reader (row 108) and the lift (row 88). Before the lift the production kinds still do not record: every test that says so is unchanged and green (`real.test.ts`, the row-85 static case, `fence.test.ts` new cases assert `assertRecordable` still throws).

### (b) The runner

- **The row** (rules G-R12 / SR-4, "no argument from data"): `LINUX_CARD_LISTING_PROGRAM = '/usr/bin/arecord'`, `linuxCardListingArguments()` answers `['-l']`. The function has NO parameter.
- **The caller**: `cardListingProgramsOf({ door, timers })` hands that row to the production door with an empty environment and no start message, ends the program's input at once, kills it at 5,000 ms. Anything but "started, exit code 0, less text than the door keeps (64 KiB)" is `AUDIO_CARD_LISTING_PROGRAM_FAILED` with a reason of a closed set (`NOT_STARTED`, `TIMED_OUT`, `ENDED_NONZERO`, `OUTPUT_TOO_LONG`). The hardware parameter dump is NOT offered: its arguments would be two integers of a listing.
- **The composition**: on `linux` the enumerator has this runner behind it, so operations 98 and 99 no longer answer `LISTING_PROGRAM_NOT_HANDED_IN`. On any other platform the named `NOT_AVAILABLE_ON_THIS_PLATFORM` answer stays and no program is ever started (a door that throws proves it). A failed run reaches operations 98 / 99 as their existing 503 with the reason in the error log (`audio-cards/service.ts:268-277`, unchanged).
- The entry point's statement is unchanged (`src/index.ts` not edited).

### (c) The key

`DEMS_CAPTURE_AUDIO_HELPER` -> `captureAudioHelperPath`, absolute path or null, by `parseCapturePath` (the rule of the other program keys). Nine waived lines in five places of `config.ts`, served in `capture/__tests__/static.test.ts` (ENV pin 11 -> 12).

### (d) The fault sink

`watchFaultSinkOf(engine, note)`, one object for both watches:

| Step | Rule |
|---|---|
| raise, key already active at the engine | another part raised it: nothing written, NOT owned (`HELD_BY_ANOTHER`) |
| raise, key not active | the engine's raise; owned |
| clear, not owned | nothing cleared, whatever is active (`CLEAR_NOT_OWNED`) |
| clear, owned, no longer active | another part ended it: nothing written (`ENDED_BY_ANOTHER`) |
| clear, owned, active | the engine's clear of THAT cause on THAT device |
| no engine | the named refusal `CAPTURE_WATCH_FAULT_ENGINE_NOT_AVAILABLE`; what is owned stays |
| any other fault | refused before the engine is asked (`..._NOT_OF_A_WATCH`): only `CAMERA_STREAM_ENDED` about `CAM-NN` and `MIC_DISCONNECTED` about `MIC-NN`, always WITH the cause - so it cannot end a fault an operator must acknowledge, the capture-wide fault, or every cause on a device |

In the watches: the camera watch sends a clear only for a camera whose raise it asked for and that did not fail (`raisedHere`); the microphone watch already cleared only `Episode.raised` (comment added, no behaviour change).

Found by the row's own test and fixed: the cause `constructor` reached `Object.prototype` in the subject table (a TypeError, not the named refusal). The table is now read by own member only.

### (e) Attempt-awareness

`MicLossWatchOptions.superseded?(deviceId)`, asked once in the turn `sourceLost` is called. True: the word is dropped and reported (`MIC_LOSS_REPORT_SUPERSEDED`); no episode opens. A function that throws: the word COUNTS (`MIC_LOSS_ATTEMPT_UNREADABLE`). The composition answers it from the supervisor's phase: `RESTARTING`. Row 191's timings (helper ended 33 to 46 ms after the worker; the session's close began 12 to 19 ms after) fall inside that phase, which lasts at least the 250 ms back-off; the session closes every earlier handle before the later worker starts, and a closed handle says nothing (`usb-audio-production.ts:781`).

### (f) The wider read

`capture_devices` has no capabilities column (`db/mapping/rows.ts:769-770`). The builder now makes ONE more read (`SELECT d.id, d.profiles ...`) beside the boot's pinned `READ_STORED_DEVICES`. A camera entry carries `['VIDEO']` and its stored profile list in stored order; a microphone `['AUDIO']`; a switch none - the statements the registration actions make and the mapping reads back. A list not of the stored form (codes, at most 16, no repeat) is an EMPTY list, named by `malformedProfiles()`: no profile is assumed (C36).

### (g) Admission after the boot

`admit(device)` of the built production registry: served -> `ALREADY_SERVED`; not the production kind of its class, no `reader`, or an adapter without `admitDevice` -> `NOT_SERVED` (the answer of before); otherwise `ADMITTING` (new member of `CaptureDeviceAdmission`), and asynchronously: the STORED row is read (class, kind, label, profiles are the store's, never the caller's), the adapter takes the entry through `admitDevice`, the registry registers a one-entry view of that adapter under its unchanged rules. `admitted(deviceId)` settles with the outcome; `onAdmission` is told, a failure by a code only.

**What is not there:** neither built adapter has `admitDevice` (their files are not this row's), and the boot still calls `buildProductionRegistry` (row 88). So on a production Core today `admit` still answers `NOT_SERVED`.

## 2. Checks

All from `CS`, `--maxWorkers=2`.

| Check | Command | Result |
|---|---|---|
| Unit: the four touched files, run 1 | `npx vitest run --project unit` on `src/__tests__/capture-composition.test.ts`, `mic-loss.test.ts`, `camera-watch.test.ts`, `load-config.test.ts` | `1 failed, 129 passed (130)`: my own new sink test found the `constructor` bug above |
| Unit: fence, loader, composition (after the fix) | the same on `fence/__tests__/fence.test.ts`, `adapters/__tests__/real.test.ts`, `capture-composition.test.ts` | `Test Files 3 passed (3)`, `Tests 143 passed (143)` |
| Unit: static rule files and every touched unit, last run | the same on `src/capture/__tests__/static.test.ts`, `adapters/__tests__/static.test.ts`, `test/static`, the static tests of `capture-config` and `capture-discovery`, `adapters/audio/__tests__`, `camera-watch.test.ts`, `onvif-relay.test.ts`, `src/plugins/config`, the composition, fence and loader tests, `capture/__tests__/module.test.ts`, `local/__tests__/mic-static.test.ts` | `Test Files 1 failed, 33 passed (34)`, `Tests 2 failed, 747 passed (749)`. Both reds are in `capture/__tests__/static.test.ts` and name sources row 143b is editing (section 4) |
| Database: the composition on the real app | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db src/__tests__/capture-composition.db.test.ts` (sandbox off) | run 1: `1 failed, 6 passed (7)` (my new case counted a seeded audit row); run 2: 7 of 7, `0 remain` |
| Database: the fence suite | the same on `capture/fence/__tests__/fence.db.test.ts` | run 1: 1 red, the count pin `:982` (the builder's reads 1 -> 2, moved by delta); run 2: `Tests 44 passed (44)`, `0 remain` |
| Typecheck | `npx tsc --noEmit -p .` | 0 errors in this row's files. Errors seen during the row, each in a file in flight of another row: `camera/stored-address.ts:178`, `camera/onvif-relay.ts:461` (143b), `test/support/fake-onvif-stub.ts:1191` (109), `modules/capture-config/network/facts.ts:168` (108), `packages/shared/src/api/capture-discovery.ts:1444`, `core-api.ts:1135, 1141` (the shared contract, last run) |
| Lint, secret scan | `npx oxlint` on the changed sources; `scripts/secret-scan/count-only.mjs` | no finding; `TOTAL: 0 in 0 file(s)` |

Run by mistake, once: `adapters/local/__tests__/mic-helper.generated.test.ts` was inside a folder pattern of one unit run with the sandbox on. It failed at `spawn EPERM` / `bind EPERM` before it started anything; it is not this row's file and was left out afterwards.

Existing expectations this row changed, each a direct consequence:

| File | Line | Change |
|---|---|---|
| `capture-composition.test.ts` | the `it.each` of the card enumerator | the third row (`linux`, no program -> `LISTING_PROGRAM_NOT_HANDED_IN`) taken out: that is the answer this row ends |
| `capture-composition.test.ts` | the audio bundle case | key list gains `helperProgram`; the helper comes from the bundle; the mic watch takes `faults` from the bundle |
| `camera-watch.test.ts` | "a sink or an observer that throws ..." | four reports -> three: no clear is asked for after a raise that failed; a failing clear is shown on a raise that succeeded |
| `real.test.ts:122`, `fence.db.test.ts:982` | count pins | the builder's reads 1 -> 2 |

## 3. Doubles, and what stays unproven

| Double | What it is |
|---|---|
| the listing program | a `#!/bin/sh` script in a temporary directory that prints a listing fixture, started by the REAL production door (only the core-file limit of the test process is answered as 0) |
| the sound directory | a temporary directory of three fixed files |
| the engine behind the sink | a set of active keys and two recorded actions (unit); the REAL engine of a `REAL_PRODUCTION` app on a throw-away database, started without a boot (database case) |
| the adapters of the builder | plain objects of the three production kinds without an opener, one with `admitDevice` |

| Unproven | Check |
|---|---|
| `/usr/bin/arecord` at that path on the target host, its text and exit code with no card, its run time against 5,000 ms, under the service account | `9A/H-07` |
| the door's core-file rule with the listing program in a started Core | `9A/H-01`, `H-07` |
| `superseded` against a real supervisor in `RESTARTING` with the production microphone adapter (the predicate is proven on a scripted answer; the phase was read, not driven) | `9A/H-08`; row 88's scenario |
| the sink behind the two watches in a recording session with a worker that says the same key | row 88; `9A/H-11` |
| the admission with a real built adapter | after the request of section 4 |

## 4. Requests (four lines in `delegation_progress/file_requests.md`; point 5 is inside line 2)

1. Owners of the two built adapters and of the registry: the door `admitDevice` (blocking for adoption on a running production Core).
2. Row 88: the updated list (section 5).
3. The forwarder's owner and the controller: the two consequences of ruling (2) and the one open race.
4. Rows 143b and 108: two static reds and one typecheck error from their sources; the pins move when they state the new text.
5. (inside line 2) the boot checks' owner: step 4e does not check the audio helper or the listing program.

## 5. What row 88 switches (updated)

1. Boot step: `buildProductionRegistryOf({ operation, executor, reader, dependencies, load, audioCards, checkCamera, locked, onAdmission })`; log `malformedProfiles()`.
2. `dependencies.camera` as it is. `dependencies.audio` plus `configWriter` and `runDir` ONLY; refuse a null `helperProgram` or `guardProgram`.
3. `createCameraWatch({ ...watches.camera, reader })`; `createMicLossWatch({ ...watches.microphone, devices, identify, isRow, held: () => built.openSources() })`. `faults` and `superseded` are in the bundles. Attach as row 85b's record says.
4. `audioCards: () => composition.cards.list()`; `checkCamera` from the watch.
5. `real.ts`, the opener list, A-1, A-9, the "no production caller" line.

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Reason |
|---|---|---|
| DD-1 | The listing program is the LITERAL `/usr/bin/arecord`, no configuration key | "no argument from data" is strictest with no input at all; the host checks name their programs the same way. A host with the program elsewhere needs a key: a decision |
| DD-2 | The key is `DEMS_CAPTURE_AUDIO_HELPER`, separate from `DEMS_CAPTURE_HELPER_FFMPEG` | no document names it; the development helper's key belongs to the development fence |
| DD-3 | "A fault another part raised" is decided by asking the engine whether the key is active before the raise | the fault key is shared with the worker by design (C40); the forwarder's table is not this row's file |
| DD-4 | A watch that finds its key held by another part never clears it, also when it sees the source back | the letter of C60 (2); consequence (a) of request 3 |
| DD-5 | "Superseded" is the supervisor's phase `RESTARTING`, asked through a predicate; the watch learns no attempt number | the adapter's `onSourceLost` carries none and its file is not this row's. A helper that ends after the worker is down for good (`FAULTED`) still raises |
| DD-6 | A predicate that throws counts the word | a loss is not hidden by a failed question |
| DD-7 | A malformed stored profile list is an empty list, not a refused build | one bad row must not keep every other device from being served; the CHECK of row 51b makes it unreachable through the product |
| DD-8 | (g) is a live device door in ONE adapter per class, not one adapter per device | two microphone adapters would share one configuration path and one card |
| DD-9 | `CaptureDeviceAdmission` gained `ADMITTING` | the loader and the store read are asynchronous and `admitDevice` of the fence is synchronous in two modules; `ADMITTED` before it is true would be a claim |
| DD-10 | `tellQuietly` lives in `production-parts.ts` | static rule G-R14 allows no `catch` in `fence/index.ts` (it builds the development sources); the admission's error path builds nothing |
| DD-11 | `real.test.ts` (row 85's file) and `fence.db.test.ts:982` were edited, one count pin each | the builder is this row's now and the pins count its reads |

## 7. Rules kept

Edit tool for every existing file; the two documents of this row with Write. No commit, no stage. No full suite. Throw-away databases under `.locks/db-migrate.lock`, `0 remain` each time; the instance on ports 4423 / 5178 and `dems_test_m12_row232` were not touched (the sweep kept it as "1 unrecognised"). No heavy-host lock was needed. No file of row 143b, of `packages/shared` or of the schema was edited.

READ IN FULL: `driver_rules.md`, `batch_9_brief.md`, records 085b, 021, 049, 064, 068, 155, 190, 191, decisions C55, C56, C57, C60, the request lines of rows 85b and 191. The blueprint cells of the row were NOT read: the row was defined by decision C60 (3) and the delegation.

---
*Generated: 2026-10-13*
