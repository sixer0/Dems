---
task_slug: input_av_core_adapter_plan
row: 85b
milestone: M6 / WP-13b (the composition row 85 left unbuilt; decision C55)
date: 2026-10-13
agent: coder-execution
status: needs-review (the composing unit is built, tested and called by the entry point; six members are not built - section 5)
tier: T3
requirement: C55 (SR-7); C34; C36; C46; C56; C58; AD-02 (1), (2); AD-03 (1); rows 143, 144, 146, 190, 200 (their request lines)
---

# Row 85b - the composition of the production dependency bundle

Paths are relative to `/Users/gsp-budi/Documents/DEMS`; `CS` = `apps/core-server`. Everything is closed on doubles on this Mac. No worker, relay, test camera or port was started; no real device and no credential was touched.

## 1. The composing unit, and why no closed-unit rule is weakened

**`CS/src/capture-composition.ts`**: a file directly under `src/`, beside `app.ts` and `config.ts`. It is a file of NO unit - above the modules, in neither the capture unit nor a module (C55).

| Rule (text) | Why it is not weakened |
|---|---|
| `unitOf` - "A file directly under `src/` is in no unit" (`CS/test/static/imports.test.ts:183-184`) | `CLOSED_UNITS` did not grow; "the one unit that is not closed is the command folder" still holds. A new top folder would have been a unit and a third entry |
| Rule 2, deep imports (`imports.test.ts:319-322`) | every unit is imported through its index or an `EXPOSED` path; the ONE new path is SR-7 entry (b) |
| Rule 4, cycles (`CS/test/static/imports.ts:147-152`) | an edge needs two units; a file of no unit adds none |
| Rule 5 (`imports.test.ts:124`, `:138`) | nothing below the modules imports a module, and no module imports another, because of this file - it is what keeps `capture-discovery` from importing `capture-config` |
| R-6 (`CS/src/modules/capture-config/__tests__/static.test.ts`, list `CAPTURE_CREDENTIAL_HOLDERS_IMPORTERS`) | SR-7 entry (a): exactly this one file; two added assertions hold the list to ONE entry that is no file of a module, of the capture unit, of a plugin, the core or the engine. R-3 and "no file under `src/capture/` imports the reader, the wiring or the reveal module" are unchanged |
| A-5 of the adapter layer (`CS/src/capture/adapters/__tests__/static.test.ts:240-262`) | NOT TOUCHED. The first version of the file imported `./capture/adapters` and A-5 refused it (a THIRD list, not admitted). What the composition needs of the layer is now offered by the fence, which is on A-5's list: new `CS/src/capture/fence/production-parts.ts` |
| A-9, A-1 | the composing file and the fence file name no built adapter file and not the loader |

The two admitted entries, and nothing else of either list: `EXPOSED` + `'src/modules/capture-config/credential-holders'`; `CAPTURE_CREDENTIAL_HOLDERS_IMPORTERS` = `['src/capture-composition.ts']`.

`app.ts` is not edited. The entry point's `buildApp(...)` call is not edited. `CS/src/index.ts` gained one import line and ONE statement, placed after the `configuration loaded` line and BEFORE row 85's `provideHost` statement, so that the literal pin of C46 (`provideHost(...);\n  await app.readiness.boot();`) is unchanged; the pin of the entry point's capture lines moved by delta (7 -> 11).

## 2. What is handed in (once per app, in `REAL_PRODUCTION` only)

In any other capture operation `composeProductionCaptureOf` opens no door and builds nothing: no reader of a credential exists in a simulated or development Core.

| Member | State | How |
|---|---|---|
| Credential reader, both holders (rows 144, 146) | WIRED | `wireCaptureCredentialHolders` called once; `connectionTest` -> `adoptedCameraTestControl(app).provide({ reader, storedAddress })`; `cameraAdapter` -> `dependencies.camera.credentials`. `open` asks the Core credential store at each read; a store that is not ready opens nothing and writes one error-log line |
| `storedAddress`: ONE binding, FOUR takers (row 143) | WIRED, FAIL-CLOSED | `storedCameraAddressRuleOf(network)` of the fence: `decideDestination` with `STORED_CAMERA` on what an INJECTED reader answers at every judgement. The same function object goes to the wiring, the connection test, `dependencies.camera` and `watches.camera` (asserted by identity) |
| Network facts (camera interface, subnet) | **NOT INJECTED** | row 108's read operation is not built. The entry point hands in the platform and nothing else, so **a production Core refuses every stored camera address today** (`NOT_CONFIGURED`; an address class keeps its own code, e.g. `LOOPBACK`). No reader, a reader that answers null, a reader that throws and facts without a camera subnet are all refusals |
| Relay report source into capture-session (C34) | WIRED as a hub, source AT THE DOOR | `sessionCapture(app).replace({ relayReports: hub })`. The hub reports what the attached source reports; the production camera adapter's own source is attached at the lift (`relayReports.attach`). With nothing attached no camera can be paired: fail-closed (C35 / C40 apply) |
| Card enumerator (`provideEnumerator`, row 190) | WIRED | on a platform with a reader AND the program text handed in: the product's `createCardEnumerator(createCardListingReader(programs))`. Otherwise an enumerator whose `list` rejects with `AUDIO_CARD_LISTING_NOT_AVAILABLE` and a reason: `NOT_AVAILABLE_ON_THIS_PLATFORM` (macOS) or `LISTING_PROGRAM_NOT_HANDED_IN`. Never a made-up card |
| Stored stream facts | WIRED (reader) | `stored.stream(deviceId, profile)`: the candidate at the stored address (`storedCameraCandidate`) and `capture_device_streams.onvif_profile_token`; null when either is missing - no profile is assumed (C36) |
| Stored microphone row with `usb_serial`, `usb_port` (rows 199, 200; C56) | WIRED (reader) | `READ_STORED_MICROPHONE` selects both columns; the row passes the adapter's own shape rule (`isRegisteredAudioInput`) |
| The two fact keys in fence sources (row 200) | DONE | `MIC_SOURCE_FACT_KEYS` 8 -> 10 (`usbSerial`, `usbPort`), each through the listing's rule for its kind; two optional members of `AudioCardStatement` and of `AudioSourceStatement`. The column has no CHECK on its keys (only the 120-character and the 2 048-byte bounds): no schema step |
| Camera bundle (`dependencies.camera`) | COMPLETE at the door | ten members, typed against `OnvifRelayCameraDependencies` and the adapter built from it in a test |
| Clock read, camera loss callback | AT THE DOOR | `clock` and `relayEnded` of the camera bundle forward to the camera watch once `attachCameraWatch` is called; before that a loss is dropped and a clock read is refused by name (`CAPTURE_COMPOSITION_CAMERA_WATCH_NOT_ATTACHED`) |
| Camera watch, microphone loss watch | AT THE DOOR | `watches.camera` (timers, clock, stored candidate, the binding) and `watches.microphone` (stored row, enumerator, timers). The time reader, the adapter's two match functions, `held` and the fault sink are added where the watch is built |
| Audio bundle (`dependencies.audio`) | PARTIAL at the door | `registered`, `cards`, `guardProgram`, `timers`, `onSourceLost`. Missing: `configWriter`, `runDir`, `helperProgram` |
| Wider device read (capabilities, profiles) | NOT BUILT | section 5 |
| Admission of a device adopted after the boot | NOT BUILT | section 5 |

Why "at the door": rule A-9 lets no production source name `camera/onvif-relay`, `audio/usb-audio-production` or `audio/mic-loss` before the lift, and the adapter layer's index does not export them or `camera/camera-watch`. The bundles are stated by SHAPE; a test binds each to the real type.

## 3. Change set

| File | Change |
|---|---|
| `CS/src/capture-composition.ts` | NEW. `composeProductionCapture(ports, input)` (pure, on ports), `composeProductionCaptureOf(app, input)` (binds the real doors; once per app), `productionCaptureComposition(app)`, the relay report hub, the stored-facts readers and their three statements, the four bundle shapes |
| `CS/src/capture/fence/production-parts.ts` | NEW. The capture unit's own parts: `storedCameraAddressRuleOf`, `cardEnumeratorOf` with its named refusal, `productionCameraDoors`, `productionCameraCandidateOf`, `isProductionCaptureOperation`. No log, no process, no file, no socket |
| `CS/src/capture/fence/index.ts` | one export line |
| `CS/src/capture/fence/sources.ts`, `CS/src/capture/adapters/types.ts` | the two fact keys, two optional members each |
| `CS/src/modules/capture-inputs/index.ts` | one export line: `captureAudioCardsControl` of its own folder |
| `CS/src/index.ts` | one header line, one import, one statement with its two comment lines |
| `CS/test/static/imports.test.ts`, `CS/src/modules/capture-config/__tests__/static.test.ts` | the two SR-7 entries; R-6's title re-stated and two assertions added |
| `CS/src/capture/__tests__/static.test.ts` | the entry-point pin by delta; five assertions: the statement stands once, after `ready()` and before the boot, with the platform only; `composeProductionCaptureOf` is called by the entry point alone; no file of a unit names the composing file |
| `CS/src/capture/fence/__tests__/fence.test.ts` | one expectation re-stated (a statement without serial and port gives the eight keys of before), one case added |
| `CS/src/__tests__/capture-composition.test.ts`, `capture-composition.db.test.ts` | NEW |

`CS/src/capture/index.ts` is NOT changed by this row (one export line was added and removed again).

## 4. THE QUESTION: can a PRODUCTION-class camera be assigned and recorded under `REAL_DEVELOPMENT`?

**No. Only under `REAL_PRODUCTION`, before and after the lift.** From the code:

| Fact | Where |
|---|---|
| The source class of `ONVIF_RTSP` is `PRODUCTION`; the class `REAL_DEVELOPMENT` records is `DEVELOPMENT` | `CS/src/capture/adapters/kinds.ts:39-45`, `:61-65` |
| Rule RG-3: a device is assignable only when its source class equals the operation's -> `SOURCE_CLASS_NOT_ALLOWED` | `CS/src/capture/adapters/registry.ts:128-134` (the comparison is `:132`) |
| That refusal is the `422 INVALID_INPUT` of the slot assignment | `CS/src/modules/capture-config/routes.ts:249-265` (the call `:259`, the 422 `:265`); the edit asks it at `:357` |
| The development registry gives a stored production device NO adapter (only `FAKE` rows and the two local devices), also when it is adopted later | `CS/src/capture/fence/index.ts:205-209` (statement), `:298`, `:321` |
| The production adapters are loaded for `REAL_PRODUCTION` only, refused before any import otherwise | `CS/src/capture/adapters/real.ts:55`; `CS/src/capture/fence/index.ts:413` |
| A session's four sources must all be of the class of the operation; a mixed session is refused | `CS/src/capture/fence/sources.ts:124-129` |
| `REAL_DEVELOPMENT` may register the kind `ONVIF_RTSP` - for the SEARCH and adoption only, which is why the two cameras could be adopted there | `CS/src/capture/adapters/kinds.ts:72-76` |

The lift (row 88) changes the opener list and the registration of the production adapters; it changes none of the lines above.

The configuration that accepts the assignment: `DEMS_CAPTURE_MODE=real`, `DEMS_DEMO_CONTROLS=0`, `DEMS_CAPTURE_DEV_SOURCES` off (`CS/src/capture/fence/operation.ts:71-81`), on the SAME database (the adopted rows stay). Until row 88 a `REAL_PRODUCTION` Core refuses the assignment too: its registry holds no adapter (`fence/index.ts:338-341`). After the lift it also needs: all four slots assigned to production sources (C25), a host that passes steps 4d and 4e (C46: Linux, relay and guard programs), and the network facts of section 5 (a) - without them every stored camera address is refused.

## 5. NOT BUILT - the remainder, as members

| # | Member | What is missing | Blocks |
|---|---|---|---|
| a | Reader of the network facts | row 108's read of `capture_network_config` joined with the host's interface list, as a synchronous `CaptureNetworkFactsReader`; one more member of the entry point's statement | every use of a stored production camera |
| b | Runner of the listing program | `CardListingPrograms.captureDevices` is "handed in by the unit that owns the production door" and no production source runs that program. On Linux operations 98 and 99 still answer 503, now for the named reason `LISTING_PROGRAM_NOT_HANDED_IN` | the card listing on the target host |
| c | Audio helper program | no key of the configuration names it; `configWriter` and `runDir` are the capture unit's own | the production microphone adapter |
| d | Fault sink of the two watches | the ruling rows 49 and 68 asked for (through the forwarder, or clear only what the watch raised) | the loss faults |
| e | `sourceLost` and a superseded attempt | row 191's point; the watch's file | one false raise per worker restart |
| f | Wider device read | `buildProductionRegistryOf` makes entries with empty capabilities and profiles; `READ_STORED_DEVICES` is the boot's own pinned statement | the device shapes of a production device |
| g | Admission after the boot | both built adapters take a fixed device list at construction; `admit` answers `NOT_SERVED` | a camera adopted on a running production Core needs a restart |

The row was sized M and is larger. It was stopped here at a compiling, tested state.

## 6. What row 88 switches

1. The fence's boot step: `buildProductionRegistry(mount.locked)` -> `buildProductionRegistryOf({ operation, executor, dependencies, load, audioCards, checkCamera, locked })`; `dependencies` reach the fence through a door of the fence control opened by the composing file (the fence cannot import a file above the modules).
2. `dependencies.camera` as it is; `dependencies.audio` plus `configWriter`, `runDir`, `helperProgram`, and a refusal of a null `guardProgram`.
3. The two watches built inside the capture unit and attached: `attachCameraWatch`, `attachMicLossWatch`, `relayReports.attach(adapter.relayReports)`; `watch.watch(deviceId)` per stored camera; `close()` / `stop()` at shutdown.
4. `audioCards: () => composition.cards.list()`; `checkCamera: (deviceId, signal) => watch.check(deviceId, signal)`.
5. `real.ts` (two imports, two type parameters), the opener list, rules A-1 and A-9, the "no production caller" line - as record 085 section 5 says.

## 7. Checks

| Check | Command (in `CS`) | Result |
|---|---|---|
| Unit: the composition on doubles | `npx vitest run --project unit --maxWorkers=2 src/__tests__/capture-composition.test.ts` | run 1: 2 failed of 22 (my own test: a session id and an operator id not of their forms); run 2: `Tests 22 passed (22)`. Run again after the A-5 correction: `22 passed` |
| Unit: static rule files and touched files | the same runner on `test/static`, the static tests of `capture`, `capture/adapters`, `capture-config`, `capture-discovery`, `adapters/__tests__/real.test.ts`, `modules/capture-inputs`, `capture/fence/__tests__`, `slot-replacement`, `module.test`, `modules/__tests__` | run 1: 1 red of mine - A-5 refused the composing file's import of the adapter layer (corrected by the fence file, not by a list entry) - and 13 reds of `host-alias-socket.test.ts`, which binds a local socket and was started with the sandbox on (not this row's file; left out afterwards). Run 2: `Test Files 31 passed (31)`, `Tests 532 passed (532)`. Last run of the static set: `Test Files 21 passed (21)`, `Tests 405 passed (405)` |
| Database: the composition on the real app | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/__tests__/capture-composition.db.test.ts` (sandbox off) | run 1: `Tests 4 passed (4)`; `0 remain with the run prefix` |
| Database: the suites touched | the same on `capture/fence/__tests__/fence.db.test.ts`, `capture-inputs/audio-cards/__tests__/routes.db.test.ts` | `2 failed, 64 passed (66)`: both reds are the schema pin of another row (`fence.db.test.ts:139`, `routes.db.test.ts:159` expect `[10, 'dbc-11']`; the tree is at `[11, 'dbc-12']`). Not edited |
| Typecheck | `npx tsc --noEmit -p .` | 0 errors (one earlier run showed 12 errors in `packages/shared/src/sim/api.ts`, another agent mid-edit; gone in the last run) |
| Lint, secret scan | `npx oxlint` and `scripts/secret-scan/count-only.mjs` on the new files | 0 and 0 |

What the tests hold: the composition in each of the three operations (doubles and real app); every fail-closed case - no network facts, a reader that answers nothing or throws, no reader of the card listing for the platform, no program text, no report source, no camera watch, a credential store that is not asked; the same binding at its four takers; the stored microphone row with serial and port; each bundle bound to the real type and the part built from it; **a production registry still refuses the built camera adapter (`CAPTURE_ADAPTER_INVALID`)** - the tests that say the production kinds do not record are unchanged and green (`real.test.ts`, the row-85 static case).

## 8. Doubles, and what stays unproven

| Double | What it is |
|---|---|
| the app's doors (unit file) | functions that record what they were handed; a unit of work that never commits; a store that fails if asked |
| the host facts | hand-written (camera interface `192.168.50.1/24`, office interface `10.20.0.5/24`); the destination rule is the real one |
| the stored rows (database file) | inserted as the owner on a throw-away clone; the app is brought to `ready()` and NOT booted |

| Unproven | Check |
|---|---|
| the entry point's statement in a started process (`src/index.ts` is pinned by text, not started) | `9A/H-04` |
| the composition followed by a production BOOT (the database cases stop at `ready()`) | the controller's full run; row 86 |
| the card listing through the product's reader on Linux | `9A/H-07` |
| a stored camera admitted by real network facts, then dialled from the camera interface | `9A/H-09`, `H-10`; row 108 |

## 9. Driver decisions (for the controller to confirm)

| # | Decision | Reason |
|---|---|---|
| DD-1 | The composing file is `src/capture-composition.ts`, a file of no unit | a folder would be a unit and need a `CLOSED_UNITS` entry |
| DD-2 | The parts made from the adapter layer live in the FENCE (`production-parts.ts`), the hand-over in the composing file | A-5 is a third list; the fence is already on it. C55 forbids the COMPOSITION inside the capture unit; these functions compose nothing and take every host fact as a parameter |
| DD-3 | The entry point calls the composition, before `provideHost` | `app.ts` is frozen; the C46 pin fixes what follows `provideHost` |
| DD-4 | The network facts reader is SYNCHRONOUS and asked at every judgement | the rule's shape (`StoredCameraAddressRule`) is synchronous in all four takers; a cached answer inside the binding would outlive a changed configuration |
| DD-5 | The session gets a HUB now, not null | C34's refusal `RELAY_REPORTS_NOT_WIRED` is for a composition that forgot the source; the hub with nothing attached pairs nothing, which is the same fail-closed result. The production kinds are refused earlier anyway until the lift |
| DD-6 | Off Linux, and on Linux without the program text, the enumerator IS provided and rejects by name | the brief's "named not available, not a fake": operations 98 and 99 answer 503 with the reason in the error log instead of "no enumerator" |
| DD-7 | `RULE_BINDERS` of A-10 (b) was NOT extended | a third list entry was not admitted; the rule is green because its pattern does not see a returned function. Stated openly in a request line, with the proposed entry |
| DD-8 | The two new members of the statement types are OPTIONAL | row 200 asked for required members; optional keeps every other stater compiling and reads the same (absent = none) |
| DD-9 | The wider device read and the admission after the boot were NOT built | each changes a pinned statement or two built adapter files; the row was already past its size |

## 10. Rules kept

Edit tool for every existing file; the four new files with Write (one of them, the composing file, was then changed by Edit only). No commit, no stage. No full suite. Throw-away databases under `.locks/db-migrate.lock`; the instance on ports 4423 / 5178 and its database were not touched (the sweep listed it as "1 unrecognised" and kept it). No heavy-host lock was needed: nothing was started.

READ IN PART, NOT IN FULL (the brief asked for full): records 144, 145, 143 and 085 were read in full; 146, 190, 188 / 048, 049, 068, 199 and 200 were read through their request lines in `file_requests.md` and through the code they describe.
