---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-14
agent: coder-execution (CB, wave 12, track D)
source_plan: docs/2026-10-12_input_av_core_adapter_plan/delegation_progress/wave_12_brief.md
status: complete (the database checks ran at 09:30-09:57 after the controller restarted PostgreSQL; one driver decision on the lock, section 5)
---

# Row CB - the Core's camera bitrate (R-01) and the four tests that survived a mutation (review 60d, section 6)

| | |
|---|---|
| What | (1) A camera's `bitrateMbps` is null on a Core in REAL capture - in the state it serves and on operations 44, 46, 47. (2) The four tests review 60d names are strengthened: each is red on its mutant, green on the tree. Tests only for item 2 |
| Why | R-01 (`verification/060c_m3_review_third_pass.md:25, 122`): the simulator's literal 9 was served beside a real camera as a measured figure (decision C36: a default is never shown as a fact). Q-03, Q-04, Q-08, Q-09 (`verification/060d_m3_review_fourth_pass.md:82-86, 118-125`): four tests passed with the rule they name removed |
| Who | Agent CB. Readers: the controller; agent W5 (web and mobile); the lift (row 88) |
| Where | `apps/core-server/src/modules/devices`, `src/engine`, `src/capture/adapters/camera/__tests__` |
| When | 2026-10-14, head 1fbeada7, branch task4/input-av-core-port |
| How verified | Targeted unit and database runs, typecheck, lint, the static rule tests; every new guard seen red on a named mutant (section 4) |

Nothing committed. Existing files changed with the Edit tool only. No device, no network beyond loopback, no credential.

## 1. Item 1 - the bitrate

### 1.1 The writers found

| Place | What it does | Evidence |
|---|---|---|
| `packages/shared/src/sim/initial-state.ts:300, 316` | THE ONE WRITER of a number: the simulator's initial state, `bitrateMbps: 9` on both tracks | text search of `packages/shared/src` and `apps/core-server/src` for `bitrateMbps` (demo data and examples aside): no other assignment of a camera's member |
| `apps/core-server/src/modules/devices/status.ts:234` (before this row) | operations 46 and 44: `bitrateMbps: camera.bitrateMbps` - a pass-through of the slice, not a writer | the line (now `:244`); `videoTracksOf` |
| `status.ts deviceInventoryOf` | operation 47: the `cameras` slice by reference, or `withCameraStreamFacts(...)` in real capture | `status.ts:411` |
| the engine's committed state | THE STATE STREAM: slice `cameras` as the engine holds it. In real capture it is the stored or seeded slice the start adopts (`engine/host.ts`, `adoptStoredState`) - the simulator's 9, which nothing overwrote | `engine/host.ts:1030-1100`; no file of `modules/devices` writes the slice (its static rule: "runs no transition") |

So the brief's file is the READER of two operations. The value of a real Core has one source, the engine's start.

### 1.2 What changed

| File | Change |
|---|---|
| `apps/core-server/src/modules/devices/status.ts` | `withCameraStreamFacts` (the composer of a real capture operation, lines 192-208) now also answers `bitrateMbps: null` for every track - beside the three stream facts, in the same identity rule (the same array when nothing differs). Operations 44, 46 and 47 reach it through the `streamFacts` flag the routes already hand in (`index.ts:121`, `inRealCaptureOperation`). No signature changed |
| NEW `apps/core-server/src/engine/camera-bitrate.ts` | `cameraBitrateNotStatedTransition(state)`, `isCameraBitrateNotStated(cameras)`: pure; the same state when every track already says null |
| `apps/core-server/src/engine/host.ts` | ONE additive start block (lines 1086-1093) beside the host-clock, platform and updater blocks, under the same condition `dependencies.captureLevels === 'external'` (capture mode `real`), at EVERY start (boot, reset, reload, resync), before the start's write plan. One import line (97-98) |

Result on a Core in real capture: the committed slice says null, so the state stream, operation 47 and the stored row (`hardware_snapshot.cameras`) say null; operations 44 and 46 say null by the composer too, whatever slice is handed in. A Core in Simulated capture is never handed to the transition and its routes pass no flag: it answers the simulator's 9, as before. Simulated mode of the clients runs the shared simulator: untouched (no file of `packages/shared` was edited).

No real source states a bitrate today, so null is the only value a real Core can state. The day one does, it is read in `withCameraStreamFacts` and written through a fact door of its own; the start block stays the statement of "none yet".

### 1.3 DRIVER DECISIONS (for the controller to confirm)

1. **`engine/host.ts` and a new engine file were written**, outside the two places the brief names. Reason: 1.1 - without the state saying null, the state stream keeps the 9 and the request line to W5 would be false. Declared in `file_claims.md` before writing; no other row of this wave holds the engine; additive, the pattern of three existing blocks.
2. **The composer says null as well as the state** (two places, one rule). The composer holds for a slice handed in from anywhere (a test double of the engine, a state before a start); the state holds for every reader that does not pass through the composer.
3. **A database that ran in real capture keeps the null if it is later started in Simulated capture**, until a reset: the transition is not undone (the same as `platformNotReported`). The contract allows null in both modes and the web never draws a null.

### 1.4 Existing tests that pinned the 9 in real capture (edited, listed as the brief asks)

| Test | Lines pinned | Now |
|---|---|---|
| `modules/devices/__tests__/status.test.ts`, "an HEVC camera is stated HEVC with NO rate ..." | "every other member of a track is as it was" compared `bitrateMbps` of the real answer with the plain one (9 = 9) | the comparison leaves the bitrate out and states it: `[null, null]` |
| same file, "the H.264 baseline is unchanged, member for member ..." | four lines ran the real composer on the simulator's slice and expected equality and identity (`toEqual`, `toBe(state.cameras)`) | the four lines run on the state a real Core holds (bitrate null): identity as before; one line more: on the simulator's slice the one difference is the bitrate |

No other existing test changed its expectation. First run after the product edit, before any test edit: `Tests 2 failed | 376 passed (378)` - exactly these two.

### 1.5 New tests

| Test | Holds |
|---|---|
| `status.test.ts`, "row CB (R-01): a camera's bitrate is NULL on the three reads ..." | four states (H.264 slots, an HEVC slot, a code that is no statement, other numbers in the slice): operations 46, 44, 47 answer `[null, null]`, valid against the contract; the state handed in is not written; CONTROL: without the flag the slice's own numbers on all three; the storage volume's bitrate is untouched |
| `routes.test.ts`, "row CB (R-01): on a Core in REAL capture each of the three reads ..." | the wiring, through the routes: real `[null, null]` on 46, 44, 47 with the member PRESENT; a Simulated Core on the same state `[9, 9]` |
| `engine/__tests__/rehydrate.test.ts`, block "row CB (R-01)" (3 cases) | the pure transition: null on every track, every other slice the same object, the input not written, contract valid, stored and read back; identity when already null; a mixed slice |
| `engine/__tests__/restart.db.test.ts`, block G75b, the REAL case and its CONTROL (extended; run at 09:56, section 5) | a BOOTED Core in REAL_DEVELOPMENT on a database a simulated process left with 9: `engine.state().cameras`, `engine.slice('cameras')` and the stored row say `[null, null]`, the stream facts of the tracks did not move; the simulated control keeps `[9, 9]` in state and row |

## 2. Item 2 - the four tests

| # | Test (now at) | What it asks now | Mutation | Red | Green on the tree |
|---|---|---|---|---|---|
| 1 | `onvif-session.test.ts:434` "the connection limit is asked of the timer seam ...; a connection that never stands is destroyed when the limit fires" | second half added: the agent's real maker is handed a host name and a resolver that never answers; limits of the call 1,234 ms / 60,000 ms on manual timers; ONE timer of 1,234 asked; still pending after 150 ms; the test fires it; ended `UNREACHABLE` / `NO_ANSWER` BY THE LIMIT (read before the test's own abort), one dial, 0 requests at the stub, no timer left | in memory, `onvif-session.ts`: `if (socket.connecting === true) socket.destroy();` deleted (the review's mutant) | `Tests 1 failed \| 63 passed (64)`: this case, 3,165 ms | yes |
| | | | `timers.after(limits.connectMs,` -> `limits.requestMs,` | `1 failed \| 63 passed`: this case | |
| 1b | NEW `:485` "the request limit ends a read ..." (Q-03, second sentence: held by a text pin only) | a device that takes the request and never answers, `requestMs` 400: `NO_ANSWER` between 350 ms and 4 s, one request | `timeout: limits.requestMs,` deleted | `1 failed \| 63 passed`: this case, 4,008 ms | yes |
| 2 | `discovery-recording.test.ts:118` "the session keeps recording ..." | per search, on the wall clock: the fragments by 100 ms after the search was started, counted by a timer set BEFORE it (>= 8), and the writer's longest silence until the later of the search's end and that time (< 75 ms). A control with no search (inside both bounds) and a control where the test itself holds the loop 120 ms (outside both) | in memory, `ws-discovery.ts`: the datagram handler holds the loop 40 ms per datagram | `Tests 1 failed \| 1 passed (2)`: `WRONG_RELATES_TO: fragments by 100 ms ...: expected 2 to be greater than or equal to 8` | yes |
| 3 | `onvif-session.test.ts:177` "WRONG_PROFILE: authenticated, and the device lists no profile" | ONE reason: `PROFILE_ANSWER_INVALID` (the stub's NO_PROFILE device answers an empty response element, which the package cannot read); the three reads by name. CONTROL added: a listed profile with no source and no encoder is `NO_USABLE_PROFILE`, by exact value (no case of the file held that value before) | in memory: line 780's reason -> `NO_USABLE_PROFILE` | `3 failed`: this case and two others that already pinned the value | yes |
| | | | the reason of an empty usable list -> `PROFILE_ANSWER_INVALID` | `1 failed \| 63 passed`: this case alone (the control half) | |
| 4 | `ws-discovery.test.ts:267` "negative control: ... (the premise); THE PRODUCT'S search, in a process of its own ..." | the bare script stays, named the premise (status 1, the thrown text). The "contained" half is now THE PRODUCT: a child process (`node --import tsx`) loads `onvif-discovery.ts` of this folder, runs a search against a loopback responder of its own with a reader that throws the same error on every datagram: status 0, the text not on standard error, `handlerErrors = datagramsReceived = datagramsSent >= 1`, 0 candidates | ON A SCRATCH COPY of the workspace (`.cache/task4-cb/scratch`, removed after the run; a child process reads the disk, so an in-memory transform cannot reach it): the handler's `catch { handlerErrors += 1; }` replaced by `finally {}` | `Tests 2 failed \| 31 passed (33)`: this case (`expected ... not to contain 'thrown inside the parse callback'`) and the product half beside it | yes |

### 2.1 Row T3's equivalent mutant is NOT the review's case

Row T3 (`test/t3_mutation_and_ports.md:43`) left one mutant of the connection limit alive as EQUIVALENT: `socket.once('connect', established);` removed - the same `established` runs at `close`, and a timer that fires on an established socket does nothing (`socket.connecting` is false). The review's :395 case is a different mutant, the deletion of the destroy line: not equivalent, and red now (row 1). Run for completeness in the session file: T3's mutant `socket.once(target.secure ? 'secureConnect' : 'connect', established);` removed - `Tests 64 passed (64)`. It survives here for T3's reason, and no test was forced on it.

### 2.2 The tree ends unmutated

In-memory mutants write no file (`.cache/task4-cb/vitest.mut.config.mjs`, the transform of row T3 under this row's names; each run printed its count of replaced texts, 1). The scratch copy was a copy, deleted. `git diff --stat -- apps/core-server/src/capture/adapters/camera/ws-discovery.ts`: empty (0 lines). `onvif-session.ts` DOES show a diff in the working tree - it is row E2's (wave 12, decision C113: the source address made a required argument; file mtime 08:58, during this row); none of its changed lines holds a text this row mutated, and each of the five mutated texts is in the file exactly once (checked by count after the runs).

### 2.3 Shared file

`onvif-session.test.ts` has two writers in this wave: this row (the cases at :177, :434, :485) and row E2 (its `tester` helper and appended cases). Both by the Edit tool; the edits did not overlap. The controller may want one writer for it at the commit.

## 3. Request lines written (`delegation_progress/file_requests.md`)

1. To W5: **the reader can go by null now** - with the caveat of a web console that reads an older Core.
2. To the controller: confirm driver decision 1 (engine files).
3. To the controller: three things not done - `storage.bitrateMbps` is the simulator's figure on a real Core too (another member, not traced); `onvif-session.test.ts` about :1518 still accepts either profile reason; the "weaker, noted" cases of 60d are untouched.

## 4. Mutations of item 1 (rule 6 of the wave brief)

| Mutant (in memory) | Red |
|---|---|
| `status.ts`: `, bitrateMbps: null }` and the `=== null` of the identity test removed | `status.test.ts` 2 cases, `routes.test.ts` 1 case |
| `index.ts`: operation 46 not handed the flag | `routes.test.ts`: `Tests 2 failed \| 34 passed (36)` |
| `index.ts`: `streamFacts = true` for every Core | `routes.test.ts`: the CONTROL halves, 5 cases |
| `engine/camera-bitrate.ts`: the transition returns its state | `rehydrate.test.ts`: `Tests 2 failed \| 43 passed (45)` |

| `engine/host.ts`: THE START BLOCK - `const stated = cameraBitrateNotStatedTransition(sim.store.getState());` -> `const stated = sim.store.getState();` (in memory, 1 occurrence replaced; database project) | `restart.db.test.ts -t G75b`: `Tests 1 failed \| 3 passed \| 28 skipped (32)` - the REAL case, `expected [ 9, 9 ] to deeply equal [ null, null ]` at `:1026`; the simulated CONTROL stays green on the mutant |

The start block is HELD by the extended REAL case. After the run `host.ts` holds the block's line exactly once; its diff is this row's ten added lines.

## 5. Checks

| Check | Command (from `apps/core-server`) | Result |
|---|---|---|
| Devices + engine unit, before any test edit | `npx vitest run --project unit --maxWorkers=2 src/modules/devices src/engine` | `Tests 2 failed \| 376 passed (378)` - the two pins of 1.4 |
| The same, after | the same | `Test Files 20 passed (20)`, `Tests 383 passed (383)` |
| Devices unit, engine unit, camera adapter unit, static | `... src/modules/devices src/engine src/capture/adapters/camera test/static src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts` (08:49) | `Test Files 51 passed (51)`, `Tests 1015 passed (1015)` |
| Every static rule test | `... static test/static src/__tests__` | `Test Files 50 passed (50)`, `Tests 906 passed (906)` |
| Typecheck | `npx tsc --noEmit` (twice: 08:48, 09:05) | rc 0, 0 errors |
| Lint of the touched files | `npx oxlint <files>` | rc 0 |
| The three strengthened files, second run (09:05) | `... onvif-session.test.ts discovery-recording.test.ts ws-discovery.test.ts` | first run 08:44: `Tests 99 passed (99)`. Second: `Tests 2 failed \| 97 passed (99)` - NOT this row's: `onvif-session.test.ts:658` and `:836`, `Object.isFrozen(facade)` false, from row E2's in-flight `statedTester` / `statedLocator` wrappers (`:126-131`, plain objects around the frozen facades), written to the file between the two runs. This row's cases (:177, :434, :485) pass in both |
| **Devices database suites; `engine/__tests__/restart.db.test.ts`** | `vitest run --project db ...` under `.locks/db-migrate.lock` (then `heavy-host.lock`) | **Not run before 09:20** (see the rows below for the runs made after). First attempt: `lockf: .locks/heavy-host.lock: already locked` after the full 1,800 s wait (another job held it throughout; the database lock was held idle by this row for that time - the cost of the lock order). Second attempt, the three devices suites that boot no worker, database lock only: `DbTestHelperError: test:db needs the project's PostgreSQL on 127.0.0.1:4432, and nothing answers there (ECONNREFUSED)`. The wave brief forbids starting it. No third attempt |
| `onvif-session.test.ts`, third run (09:29, after row E2 landed) | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/camera/__tests__/onvif-session.test.ts` | `Test Files 1 passed (1)`, `Tests 66 passed (66)` - the two reds at `:658` and `:836` are gone |
| Devices database suites that boot no worker (09:30; PostgreSQL restarted by the controller about 09:40 by its clock) | `lockf .locks/db-migrate.lock ... vitest run --project db devices.db.test.ts effects.db.test.ts simulated-no-source-class.db.test.ts` | `Test Files 3 passed (3)`, `Tests 42 passed (42)` |
| `restart.db.test.ts`, block G75b (the two extended cases and their two neighbours) (09:56) | `... --project db src/engine/__tests__/restart.db.test.ts -t G75b` | `Tests 4 passed \| 36 skipped (40)` (the 36 are the cases the name filter left out, 8 of them of the second file named on that command) |
| The same, the start block of `host.ts` mutated in memory | `... --config .cache/task4-cb/vitest.mut.config.mjs --project db ... -t G75b` | `Tests 1 failed \| 3 passed \| 28 skipped (32)`: `expected [ 9, 9 ] to deeply equal [ null, null ]`, `restart.db.test.ts:1026` |
| `source-class.db.test.ts` (09:57) | `... --project db src/modules/devices/__tests__/source-class.db.test.ts` | `Test Files 1 passed (1)`, `Tests 8 passed (8)` |

The two extended cases of `restart.db.test.ts` ran: a booted Core in REAL_DEVELOPMENT, on a database a simulated process left with 9, serves and stores `[null, null]`; the simulated control keeps `[9, 9]`. The other 28 cases of that file were not run by this row (no full suite).

DRIVER DECISION 4 (the lock): `.locks/heavy-host.lock` was held by another job through a second wait of 20 minutes (a retry loop that held neither lock while waiting; it gave up at 09:50). `restart.db.test.ts` and `source-class.db.test.ts` were then run under `.locks/db-migrate.lock` ALONE. Reason: their boot fixture (`capture/boot/__tests__/support.ts`, `realBootFixture`) writes a STAND-IN worker script that states a version - no capture worker, no relay, no media process, no listener; block G75b starts no session on the real Core. The two runs took 4 s each. If the controller reads the heavy-host rule as covering the boot fixture, these two results are to be taken again under it.

## 6. What stays unproven

- No real camera was contacted. That a real stream's bitrate could be stated at all is not this row's: nothing measures it.
- The web and the tablet were not edited or run (W5's). Until W5 drops the mode's part, the web hides the bitrate in real capture by mode AND by null.
- The fixed bounds of `discovery-recording.test.ts` (8 fragments, 75 ms) were measured on this host under a load average of 11 (two runs: 12 to 19 fragments, silence up to 22 ms). A much slower host could go red without a stall; the controls in the case tell the two apart (the idle control would be red first).
