---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
step: 26
plan_row: W04
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
tier: 3
status: completed
---

# 04. Early proof (d): the shared simulator runs headless under Node

**ADQ-1 option B CONFIRMED.** The shared `Sim` (store, engine, domain actions and transitions) runs unchanged in a Node process with a manual clock, an injected scheduler, injected timers and memory storage. All five points d1 to d5 of `02_plan.md` section 6 pass. The fallback row Fd is not needed. No simulator change is needed (no `SIM-GAP`). Four findings need a controller decision before W26 (section 7).

| Item | Value |
|---|---|
| Row | Blueprint step 26, plan row W04 (`02_plan.md:666`), proof (d) (`02_plan.md:526`) |
| Time box | 60 min. Started 06:25 WIB, first full pass 06:40 WIB, final run 06:45 WIB |
| Script | `.cache/proof-engine/headless.mts` (1,051 lines, scratch, git-ignored by `.gitignore:47`) |
| Command | `node --import tsx .cache/proof-engine/headless.mts` from the workspace root |
| Result | Exit code 0; `PROOF d1 PASS` to `PROOF d5 PASS` |
| Tracked files changed by this row | None |
| Closes | AS-03, G-25 [AN]; SA-04, SA-05, SA-10 [SP]; input to AC-B-52, AC-B-53, SR-79 |

---

## 1. What was done

1. Read the inputs named in the delegation (row 26, P1 to P25, proof (d), ADQ-1, specification section 8, SA-04, SA-05, SA-10, the simulator inventory) and the simulator sources, read-only.
2. Wrote one scratch script. It imports the public barrel `@dems/shared/sim` and builds a small engine host:
   - a manual clock (`createManualClock`), advanced 50 ms at a time by the script;
   - an injected scheduler that only keeps the engine's `tick` function; the script calls it after each clock step;
   - injected one-shot timers (for the snapshot throttle), fired by the script against the manual clock;
   - memory storage (`storage: null`), no operator-record storage (`authStorage: null`), the always-visible adapter, and an error sink.
3. Ran the five checks, four measurements and several information checks. Each of d1 to d5 prints exactly `PROOF dN PASS` or `PROOF dN FAIL: <reason>`; any FAIL gives exit code 1.
4. Changed nothing under `packages/`, `apps/`, `scripts/` or any `package.json`. Installed nothing. Opened no port, no database, no network connection. Started no process other than the script itself (P7: nothing to stop).

Rules kept: the demo password and the pairing code are imported as constants only, to prove that no output line and no snapshot contains them (`CHECK secrets: ok`). They are not printed here or in the script output. No sign-in action of the simulator is called: an actor is taken from the simulator's own `operators` slice.

---

## 2. Verification evidence

### 2.1 The command and its output (run 05, 2026-10-04 06:45:16 WIB)

```
$ node --import tsx .cache/proof-engine/headless.mts ; echo "exit=$?"
ENV node 26.8.2; tsx 4.23.15; zustand 5.0.15; react 19.2.3; @noble/hashes 2.4.0; zod 4.6.5
ENV barrel '@dems/shared/sim' imported in 76 ms; exports 497; seed 20261001; start 2026-10-01T10:00:00.000+07:00; tick 50 ms
INFO d1 baseline: scenario 'recording' has 218 audit rows (ring 218, dropped 0), 80 events, session RECORDING, auth SIGNED_OUT
INFO d1 60 s appended 12 audit rows: WRITE_VERIFIED@+2.603s, FRAME_HASH@+9.707s, WRITE_VERIFIED@+10.493s, FRAME_HASH@+10.653s, TIMESTAMP_CONFIRMED@+33.701s, WRITE_VERIFIED@+38.497s, FRAME_HASH@+45.866s, FRAME_HASH@+49.959s, TIMESTAMP_CONFIRMED@+50.698s, WRITE_VERIFIED@+51.551s, TIMESTAMP_CONFIRMED@+52.091s, WRITE_VERIFIED@+57.674s
INFO d1 compared: host (injected scheduler, 1200 ticks) == shared-suite harness (rows, hashes, head 19d0fa38a994…, whole snapshot) == pure replay (seq, at, type)
INFO d1 reference digest: sha256(types joined by ',') = 4b5d34e1ac7de7f641b33bb74266579ede2f40d6fbb8574a8f3e53abd475252f over 230 rows
PROOF d1 PASS
INFO d2 snapshot: 30 durable slices, 201315 bytes as JSON, no value JSON cannot carry; stop at +60s, restart 90s later
INFO d2 path A (createSim storage option): wasRestored=true; 29 slices deep-equal; meta deep-equal with epoch 0 -> 1; rng epoch 1; auth SIGNED_OUT; audio and clock fresh
INFO d2 path B (store.setState + rng.reseed): all 30 durable slices deep-equal, epoch unchanged (0); wasRestored=false
INFO d2 continues: 20 s after restart 2 new rows from seq 231, first at +3.263s after restart, chain ok; seed mismatch rejected with a 'store.hydrate' warning
PROOF d2 PASS
INFO d2 ring narrower than the stored chain (dropped > 0): ring = newest 100 of 230 rows (dropped 130): restored true; verifies true; the next row is seq 231 and links to the stored head: true; verifies after the append true; engine errors 0
INFO d3 restart path: rehydrated RECORDING -> inject('POWER_FAIL') with no operator -> FAULT (fromState RECORDING); one FAULT_RAISED row, actorId null, seq 231; still FAULT after 5 s of ticks
INFO d3 fault instant: fault.at = restart instant (+90s after the stop); bytesWritten 2692333333 -> 2897333333 (+205000000 bytes counted for the downtime)
INFO d3 recover path (SA-05, §8.6): recover -> RECOVERY: SYSTEM_BOOT(null), RECOVERY_STARTED(OPR-001), FAULT_CLEARED(null); after 3000 ms: SESSION_INCOMPLETE(null), RECOVERY_COMPLETED(null); session closed; history outcome INCOMPLETE; evidence RECORDED sealedAt null; chain ok; auth SIGNED_OUT
INFO d3 alternative: pure transition at the stored instant: store.setState(injectFaultTransition(state, stopInstant, 'POWER_FAIL')) -> FAULT, fault.at +0s after the stop, bytesWritten +0, FAULT_RAISED at +0s
INFO d3 other faultable states (SA-05): PRECHECK->FAULT ok; ARMED->FAULT ok; STOPPING->FAULT ok; FINALIZING->FAULT ok
PROOF d3 PASS
INFO d4 tamper: ring row seq 218 (index 217 of 222, WRITE_VERIFIED) altered in 'message' only; verifyAuditChain(ring) = HASH_MISMATCH at index 217 seq 218
INFO d4 stored chain: append-only table 222 -> 226 rows (+1 AUDIT_CHAIN_DISCONTINUITY seq 223); stored copy of seq 218 unchanged; table verifies; 8 rows written through in total
INFO d4 durable slices that changed reference at the tamper: meta, session, security, services, events, alerts, audit, faults
INFO d4 overlay: 2 further rows in 19 s reached the table and kept the ring verdict; a ring rebuilt from the table verifies and clearFault clears the stored flag; clearFault on the running engine restores the row
PROOF d4 PASS
INFO d5 engine-timed rows that name an operator by design (wording of AC-B-53): after beginPrecheck, 5 s of ticks with auth SIGNED_OUT wrote: PRECHECK_PASSED(actorId OPR-001, details.by system); session ARMED; the creator is OPR-001
INFO d5 inject and clearFault inside the scope: called as OPR-002: FAULT_RAISED(actorId null), FAULT_CLEARED(actorId null); auth afterwards SIGNED_OUT
INFO d5 operators mirror (ENG-3): stopRecording as OPR-003 (TECHNICIAN): NOT_PERMITTED; after store.setState({ operators }) with role INVESTIGATOR: accepted, row RECORDING_STOPPED(OPR-003); auth SIGNED_OUT
INFO d5 commands (8, 4 throwing): addMarker -> ok [MARKER_ADDED by INVESTIGATOR]; stopRecording as TECHNICIAN -> SimPermissionError/NOT_PERMITTED; startRecording while RECORDING -> SimTransitionError/ILLEGAL_STATE; addNote with empty text -> SimTransitionError/NOTE_INVALID; archiveEvidence of an unknown item -> SimNotFoundError/NOT_FOUND; exportEvidence as INVESTIGATOR (refusal in the result) -> ok [EXPORT_DENIED by INVESTIGATOR] (result FORBIDDEN); addNote -> ok [NOTE_ADDED by INVESTIGATOR]; stopRecording -> ok [RECORDING_STOPPED by INVESTIGATOR]
INFO d5 after every command: auth deep-equals signedOutAuth(); a throwing command left all 30 durable slices reference-identical and appended no row
INFO d5 outside the scope: cancel() -> SimPermissionError/NOT_SIGNED_IN; 15 s of ticks sealed the session with 1 engine rows, all actorId null: EVIDENCE_SEALED; no AUTH_* row
INFO d5 subscribers saw a signed-in auth slice 12 times during 8 commands (the scope is visible to store subscribers; auth is not a durable slice)
INFO d5 negative control (no finally): the throw left auth SIGNED_IN as TECHNICIAN; a later unchecked recover() was attributed to that operator and the auth-idle subsystem wrote AUTH_EXPIRED for it after 15 min
PROOF d5 PASS
MEASURE wall time, one simulated minute of RECORDING (1,200 ticks, manual clock), median of 3: memory storage (JSON snapshot write each second) 29.4 ms; no-op storage 4.1 ms; no-op storage + per-tick reference diff 6.8 ms
MEASURE per tick (no-op storage): mean 0.0034 ms; p50 0.0024 ms; p99 0.0104 ms; max 0.0264 ms; budget 50 ms
MEASURE first (cold, not JIT-warmed) minute, the d1 host run with memory storage: 38.3 ms for 1,200 ticks
MEASURE ten simulated minutes (12,000 ticks, no-op storage): 36.8 ms; audit total 301; session RECORDING; engine errors 0
MEASURE durable slice sizes after the minute (bytes of JSON.stringify, 30 slices, total 201315): audit 105294; evidence 21228; health 19535; events 16808; session 7204; time 6443; network 6373; storage 6304; sessionHistory 5629; services 1403; security 1367; device 694; cameras 553; operators 436; update 415; ports 372; mics 357; otherDevices 250; pairing 209; meta 170; settings 86; storagePolicy 67; tabletLink 47; authLockout 34; faults 13; activeCameraId 10; lastSealedSessionId 4; lastSealedAcknowledged 4; diagnostics 4; alerts 2
MEASURE counts after the minute: audit ring 230 rows (total 230, dropped 0); events 81; evidence 13; sessionHistory 13; alerts 0; session.timeline 30
MEASURE transient slices (never stored): audio 215; clock 57; auth 93
MEASURE slices changing reference per tick over 1,200 ticks (33 slices, 30 durable): durable-changed-count:ticks = 0:1128 1:5 2:4 3:1 4:1 5:60 6:1; ticks with a durable change 72 (6.0%); durable slice writes 326 per minute (mean 0.272 per tick)
MEASURE reference changes per slice in the minute (ticks:count): audio:1200 clock:600 storage:66 session:62 time:61 network:61 health:61 audit:12 meta:2 events:1
MEASURE reference changed but JSON identical (spurious write-through), per slice: time:6
MEASURE store.setState notifications per tick (count:ticks): 1:596 2:536 3:67 4:1
MEASURE the 1 Hz group (durable slices that change about once a second): storage, time, network, health, session = 45859 bytes of JSON per second if each is written whole
MEASURE snapshot storage (zustand persist + 1 s throttle, timers driven by the manual clock): 58 whole-snapshot writes in the minute, 201718 bytes each at the end
INFO rollback by reference (ENG-5): command: store.setState(previous, true) restored the held reference true (audit total 219 -> 218); tick: the rolled-back tick had written WRITE_VERIFIED seq 219 at +2.603s, reference restored true, a repeat tick at the same instant re-emitted it: false; the next row is seq 219 FRAME_HASH at +9.707s; chain ok true (the generator schedule and the RNG position live in closures outside the store)
MEASURE globals touched, phase import: by src/sim: none | by other code: Date.now() @ node_modules/tsx/dist/index-DE3OBZuV.mjs:13 x39; navigator @ node_modules/zod/v4/core/util.js:224 x2; self @ node_modules/tsx/dist/register-B1c7OH6V.cjs:7 x1; queueMicrotask @ node_modules/react/cjs/react.development.js:749 x1
MEASURE globals touched, phase createSim(defaults): by src/sim: sessionStorage @ packages/shared/src/sim/platform.ts:41 x2; document @ packages/shared/src/sim/platform.ts:52 x1; setInterval @ packages/shared/src/sim/platform.ts:195 x1; clearInterval @ packages/shared/src/sim/platform.ts:196 x1 | by other code: window @ node_modules/zustand/esm/middleware.mjs:332 (called from packages/shared/src/sim/store.ts:107) x1
MEASURE globals touched, phase host:create: by src/sim: none | by other code: window @ node_modules/zustand/esm/middleware.mjs:332 (called from packages/shared/src/sim/store.ts:107) x1
MEASURE globals touched, phase host:run-60s: by src/sim: none | by other code: none
MEASURE globals touched, phase host:stop: by src/sim: none | by other code: none
MEASURE packages loaded by importing the barrel: react yes (2 CJS file(s), e.g. node_modules/react/index.js); react-dom no; react-native no
MEASURE Node 26.8.2 web globals (typeof): sessionStorage object, navigator object, document undefined, window undefined
CHECK secrets: ok (neither the demo password nor the pairing code appears in 54 output lines or in the snapshot)
CHECK timers: ok (no real timer or immediate is pending; the script exits by itself)
RESULT ALL PASS (d1..d5)
exit=0
```

Standard error held six identical lines, `ERROR: failed to copy trust settings of system certificate-25291`. They do not come from the script's code: a one-line `.mts` file that only imports `node:crypto`, run the same way, prints the same line once. Standard output and the exit code are not affected. The cause was not investigated further (it appears with `--import tsx` inside the command sandbox; plain `node -e ''` prints nothing).

### 2.2 No tracked file changed by this row

```
$ git check-ignore -v .cache/proof-engine/headless.mts
.gitignore:47:.cache/	.cache/proof-engine/headless.mts

$ git status --porcelain | grep -v '^??'            (06:45 WIB)
 M .gitignore
 M apps/core-web/src/features/storage/__tests__/storage-page.test.tsx
 M apps/core-web/src/test/sim-fetch.test.ts
 M apps/core-web/vite.config.ts
 M docs/2026-10-04_dems_backend_rbac_pairing/decisions/decisions.md
 M docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress_report.md
 M docs/2026-10-04_dems_backend_rbac_pairing/status_tasks.md
 M package-lock.json
 M package.json
 M packages/shared/package.json

$ git status --porcelain --ignored -- .cache docs/.../delegation_progress/coder_execution_step_26.md
?? docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_26.md
!! .cache/
```

None of the ten modified tracked files was written by this row. They match the write paths of the rows that run in the same wave (`02_plan.md:985`): W01 the two web test files; W03 the root manifest, the lockfile, `.gitignore` and `packages/shared/package.json`; W05 `apps/core-web/vite.config.ts`; the controller the three tracker files. This row wrote only `.cache/proof-engine/**` (ignored) and two new files under `docs/` (this file and the progress file). `git status` cannot by itself tell which agent wrote a file; the statement rests on this row's own write list (section 9).

### 2.3 Run history (all runs recorded, P11)

| Run | Time (WIB) | Exit | Verdicts | Note |
|---|---|---|---|---|
| 01 | 06:38:39 | 1 | d1, d2, d3 PASS; d4, d5 FAIL | Two defects **in the proof script**, not in the simulator (below) |
| 02 | 06:40:56 | 0 | d1 to d5 PASS | After the two corrections |
| 03 | 06:43:32 | 0 | d1 to d5 PASS | Four information checks added (ring with dropped rows, engine-timed actor rows, operators mirror, tick rollback) |
| 04 | 06:43:42 | 0 | d1 to d5 PASS | Same script as 03. The 50 output lines that carry no timing are byte-identical between run 03 and run 04 (`diff` of the two logs without the four wall-time lines, the import-time line and the tsx `Date.now()` count) |
| 05 | 06:45:16 | 0 | d1 to d5 PASS | One more information check (`inject` inside the scope). Quoted in 2.1 |

Logs: `.cache/proof-engine/run_01.log` to `run_05.log` (and `.err`).

The two failures of run 01, and why the corrections do not weaken a check:

| Point | Message in run 01 | Cause | Correction |
|---|---|---|---|
| d4 | `appends after the tamper did not reach the table, or the table broke` | The check drove 10 s after the tamper and required at least one new row. With this seed the next integrity row arrives 14 s after the tamper (`.cache/proof-engine/debug_d4.mts`: total unchanged at +10 s, +1 at +14 s, +2 at +19 s). The table was never wrong; the window was empty | The check now drives until two further rows exist (at most 120 s), **requires** that two exist, and then asserts separately that the table total and head equal the ring's and that the table still verifies. It is stricter than before |
| d5 | `negative control: RECOVERY_STARTED actor null` | The negative control looked for the first `RECOVERY_STARTED` row in the whole ring and found a seeded history row of the dataset. The main d5 assertions had all passed | The control now reads only rows written after its own baseline |

**Install window (P11).** Another row ran `npm install` in this wave. `package-lock.json` and `node_modules/.package-lock.json` were last written at 06:35:56 and were unchanged at 06:45; all five runs started after that. No import failed in any run, so no re-run for a resolution error was needed. Every run reports the same package versions in its first line.

---

## 3. The five points: what was checked and how

Common fixture: seed 20261001 (`DEFAULT_SEED`), start instant 2026-10-01 10:00:00 WIB (`Date.UTC(2026, 9, 1, 3, 0, 0)`, the instant the shared suites use, ENG-20), scenario `recording`, engine interval 50 ms, first tick at start + 50 ms.

### d1. The recording scenario for 60 s gives the simulator's audit-type sequence

| What | How | Result |
|---|---|---|
| The engine runs headless for one simulated minute | `createSim` with the host adapters; `sim.start()` hands `tick` to the injected scheduler once, with interval 50; the script advances the clock and calls `tick` 1,200 times | 1,200 ticks; zero entries in `sim.errors()` and in the error sink; session RECORDING before and after; published clock exactly start + 60 s; `auth` signed out |
| Reference 1: the simulator as its own suite drives it | A second `Sim`, built and driven exactly as `packages/shared/test/sim-determinism.test.ts:20-33` does (`storage: null`, `authStorage: null`, direct `sim.tick()`) | The audit-type sequence of the whole ring is equal (230 rows). Stronger: the whole `audit` slice is deep-equal (every row, every hash, head, total), and the canonical JSON of the whole durable snapshot is equal |
| Reference 2: no store and no engine | The pure functions only: `buildScenarioState('recording', createIdleState(...))`, then `replayRecordingActivity` over `[start + 50 ms, start + 60 s]` with the engine's `events` random stream (`createRngStreams(seed, 0)`) | `seq`, `at` and `type` of the 12 rows of the minute are equal to the host run |
| The check is not vacuous | The minute must append rows; only integrity types are allowed; no engine row may name an operator; the chain must verify | 12 rows, types `FRAME_HASH`, `WRITE_VERIFIED`, `TIMESTAMP_CONFIRMED` only, all `actorId` null; `verifyAuditChain` ok |

Reference for W26 (AC-B-52): with the fixture above, the 230 audit types joined by commas have SHA-256 `4b5d34e1ac7de7f641b33bb74266579ede2f40d6fbb8574a8f3e53abd475252f`; the 12 rows of the minute are listed with their offsets in the output (line `INFO d1 60 s appended`).

### d2. Rehydration from a snapshot (SA-04)

The durable state after the minute (30 slices, `toSnapshot`) was serialised slice by slice to JSON text (one text per slice, as a store that keeps only serialised values would hold them) and assembled again from those texts. The "restart" is 90 s later on a new clock.

| What | How | Result |
|---|---|---|
| The durable state can be stored as JSON | A walk over the snapshot for `undefined`, non-finite numbers, functions and non-plain objects; a `JSON.parse(JSON.stringify(...))` round trip compared with `isDeepStrictEqual` | None found; round trip deep-equal; 201,315 bytes |
| Path A: the `storage` option of `createSim` | A storage adapter whose `getItem` returns `{ state, version }`; a new `Sim` at the restart instant | `wasRestored()` true; no error; 29 slices deep-equal to the stored ones; `meta` deep-equal except `epoch` 0 to 1 (the shared hydration adds one, `store.ts:128`; this is the "new epoch" of specification 8.6); the engine's random streams re-seeded to epoch 1; `auth` signed out; `clock` at the restart instant; `audio` fresh; the chain verifies; the session is RECORDING with its start time; the adapter was read once and written zero times during hydration |
| Path B: `store.setState` on a fresh `Sim` | `sim.store.setState(snapshot)` then `sim.rng.reseed(epoch + 1)` | All 30 slices deep-equal, epoch untouched (the host chooses it); transient slices kept; `wasRestored()` false |
| A wrong snapshot is refused | The same snapshot offered to a `Sim` created with another seed | Not restored; one `store.hydrate` report of level `warn` (see finding F-5: the engine then runs on a **fresh demo dataset**) |
| The rehydrated engine runs on | 20 s of ticks on the path B engine | No error; the first new row is `seq` 231 and links to the stored head; no row is stamped inside the 90 s stop; chain ok |
| Information: a ring narrower than the stored chain | The newest 100 of 230 rows with `dropped: 130` | Restored; verifies; the next row links to the stored head |

"Deep-equal" for path A therefore means: 29 slices exactly, and `meta` exactly apart from the epoch increment that the shared code performs and the specification requires. Path B is exact for all 30.

### d3. `inject(POWER_FAIL)` moves RECORDING to FAULT (SA-05)

Run on the engine rehydrated by path A, before its first tick, with no operator (the restart path of specification 8.6).

| What | Result |
|---|---|
| Session state | RECORDING to FAULT; `session.fault = { kind: POWER_FAIL, fromState: RECORDING }` |
| Audit | Exactly one new row, `FAULT_RAISED`, `actorId` null, the session's ID, `details.kind` POWER_FAIL, `details.fromState` RECORDING; chain ok |
| Fault state | `POWER_FAIL` in `faults.active`; one active CRITICAL alert |
| Stability | Still FAULT after 5 s of ticks; `auth` untouched; no engine error |
| Information: recovery | `recover()` inside the actor scope as the INVESTIGATOR: `SYSTEM_BOOT` (no actor), `RECOVERY_STARTED` (the caller), `FAULT_CLEARED`; 3 s later `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED`; the session is closed, history outcome INCOMPLETE, the evidence item is RECORDED and never sealed. This is the row set of AC-B-05 |
| Information: the other states SA-05 names | PRECHECK, ARMED, STOPPING and FINALIZING, each reached through the hosted actions inside the actor scope, each move to FAULT with the right `fromState` |

### d4. `AUDIT_TAMPER` touches the engine-held ring only (SA-10)

The script keeps an append-only "table" beside the engine with the two rules of the specification: it writes only rows with a sequence above its stored head (ENG-10), and it refuses a row that does not continue the chain (ENG-11). It is fed by a store subscription that fires when the `audit` slice changes reference (the write-through of ADQ-1).

| What | Result |
|---|---|
| The tamper is detected in the ring | `verifyAuditChain(ring)` fails with `HASH_MISMATCH` at index 217, `seq` 218: exactly the altered row (fifth from the end, `faults.ts:64-70`) |
| Only the ring row is altered | Of the 222 rows held before the tamper, exactly one differs afterwards, and only in `message`; `hash` and `prevHash` are unchanged |
| The stored chain is untouched | The table grew by exactly one row (`AUDIT_CHAIN_DISCONTINUITY`, `details.seq` 218); its copy of `seq` 218 is unchanged; the table verifies; its head equals the ring's head |
| Appends go on correctly under the overlay | Two further integrity rows reached the table; the table verifies; the ring still reports `seq` 218 |
| The overlay does not survive a restart | A ring rebuilt from the table verifies; the stored `faults` flag is still there, and `clearFault('AUDIT_TAMPER')` on the rebuilt ring clears it and writes `FAULT_CLEARED` |
| Clearing restores the ring | On the running engine, `clearFault` puts the original row back; the ring verifies; the table is in step |

Consequence for W26: the `audit` slice changes reference at a tamper, so persistence **must** write audit rows by sequence number and must never store the `audit` slice (or its `rows`) as a value. With that rule SA-10 holds and `AUDIT_TAMPER` needs no `COMMAND_UNSUPPORTED` answer.

### d5. The actor scope is cleared after a command, also after one that throws (ENG-2, G-25, SD-22)

The scope is the one ADQ-1 (1) describes: `store.setState({ auth: <operator, SIGNED_IN> })`, the shared action, and `store.setState({ auth: signedOutAuth() })` in a `finally`, in one synchronous turn.

| What | Result |
|---|---|
| Eight commands through the scope, four of which throw | After **each** one the `auth` slice is deep-equal to `signedOutAuth()` |
| The throwing commands | `SimPermissionError/NOT_PERMITTED` (TECHNICIAN stops a recording), `SimTransitionError/ILLEGAL_STATE`, `SimTransitionError/NOTE_INVALID`, `SimNotFoundError/NOT_FOUND`. Each left all 30 durable slices reference-identical and appended no row (ENG-7) |
| The commands that return | `MARKER_ADDED`, `NOTE_ADDED`, `RECORDING_STOPPED` name the caller; a refusal in the result (`exportEvidence` as INVESTIGATOR: `FORBIDDEN`) writes `EXPORT_DENIED` naming the caller |
| Between commands | `cancel()` outside the scope is refused with `NOT_SIGNED_IN`; 15 s of ticks seal the stopped session; the engine row (`EVIDENCE_SEALED`) has no actor; no `AUTH_*` row exists |
| Negative control | The same scope **without** `finally`: the throwing command leaves `auth` SIGNED_IN as the TECHNICIAN; a later unchecked `recover()` is attributed to that operator, and after 15 min the auth-idle subsystem writes `AUTH_EXPIRED` for it. So the check can fail, and the `finally` is what prevents it |

---

## 4. Measurements (information for later rows)

Machine: this host (10 cores), Node 26.8.2, tsx 4.23.15, sources run without a build, other agents working at the same time. Timings vary from run to run; each range is the lowest and highest value over the runs that measured it (the first two rows runs 01 to 05, the last two runs 02 to 05).

### 4.1 Wall time for one simulated minute of RECORDING (1,200 ticks)

| Configuration | Wall time | Per tick |
|---|---|---|
| No-op snapshot storage, JIT warm, median of 3 | 2.8 to 4.3 ms | mean 0.0023 to 0.0036 ms; p99 0.0097 to 0.0168 ms; largest single tick seen 0.46 ms (run 04) |
| Memory storage (`storage: null`), JIT warm, median of 3 | 22.5 to 29.4 ms | The difference is 58 whole-snapshot `JSON.stringify` calls of about 202 KB |
| First minute of the process (cold), memory storage | 26.8 to 38.3 ms | |
| Ten simulated minutes, no-op storage | 26.6 to 36.8 ms for 12,000 ticks | Linear; audit total 301 (83 rows in 10 min) |

The tick budget is 50 ms. At real time the engine uses a negligible share of one core.

### 4.2 Size of each durable slice after the minute (bytes of `JSON.stringify`)

Total 201,315 bytes for 30 slices.

| Slice | Bytes | Slice | Bytes | Slice | Bytes |
|---|--:|---|--:|---|--:|
| audit (230 rows) | 105,294 | services | 1,403 | pairing | 209 |
| evidence (13 items) | 21,228 | security | 1,367 | meta | 170 |
| health | 19,535 | device | 694 | settings | 86 |
| events (81) | 16,808 | cameras | 553 | storagePolicy | 67 |
| session | 7,204 | operators | 436 | tabletLink | 47 |
| time | 6,443 | update | 415 | authLockout | 34 |
| network | 6,373 | ports | 372 | faults | 13 |
| storage | 6,304 | mics | 357 | activeCameraId | 10 |
| sessionHistory (13) | 5,629 | otherDevices | 250 | four small slices | 2 to 4 each |

About 458 bytes per audit row and 207 bytes per event. The transient slices (never stored): `audio` 215, `clock` 57, `auth` 93.

### 4.3 Slices that change reference per engine tick (the write-through cost)

| Measure | Value |
|---|---|
| Ticks with no durable change | 1,128 of 1,200 (94.0%) |
| Ticks with a durable change | 72 (6.0%): 60 are the 1 Hz step, which changes five slices at once; the rest are integrity rows |
| Durable slices changed per tick (count: ticks) | 0: 1,128; 1: 5; 2: 4; 3: 1; 4: 1; 5: 60; 6: 1 |
| Durable slice writes if every changed slice is written | 326 a minute (0.27 per tick) |
| Changes per slice in the minute | `storage` 66, `session` 62, `time` 61, `network` 61, `health` 61, `audit` 12, `meta` 2, `events` 1 |
| Transient | `audio` 1,200 (every tick, 20 Hz), `clock` 600 (10 Hz) |
| Reference changed but content identical | `time` 6 times a minute; no other slice |
| The 1 Hz group written whole | `storage`, `time`, `network`, `health`, `session`: 45,859 bytes of JSON a second (about 2.75 MB a minute) |
| `store.setState` calls per tick (count: ticks) | 1: 596; 2: 536; 3: 67; 4: 1 |

An unchanged slice keeps its reference, as [R1:41] says: change detection by reference is exact apart from the `time` slice 6 times a minute.

### 4.4 Browser and React Native globals

Getter traps were installed on 41 global names (browser, React Native, timers, `performance`, `crypto`) and on `Date.now` and `Math.random` **before** the barrel was imported.

| Phase | Touched by `src/sim` code | Touched by other code |
|---|---|---|
| Import of the barrel | **None** | tsx (`Date.now`, `self`); zod (`navigator`, a guarded user-agent probe, `zod/v4/core/util.js:224`); react (`queueMicrotask`, one read at load) |
| `createSim` with the **default** adapters | `sessionStorage` (`platform.ts:41`, twice), `document` (`platform.ts:52`), `setInterval` and `clearInterval` (`platform.ts:195-196`) | zustand reads `window` once per store (`zustand/esm/middleware.mjs:332`, inside a `try`; called from `store.ts:107`) |
| `createSim` with the **host** adapters | **None** | The same single zustand read of `window`, caught |
| 60 s run with the host adapters | **None** (no web global, no timer, no `Date.now`, no `Math.random`) | None |

Also measured: importing the barrel loads `react` (two CommonJS files, the development build); it does not load `react-dom` or `react-native`. Node 26.8.2 defines a global `sessionStorage` and `navigator`; it defines no `document` and no `window`.

---

## 5. Seams used (all public, all read-only use)

| Seam | Where | Used for |
|---|---|---|
| `createSim(options)` | `packages/shared/src/sim/engine.ts:166`; options `types.ts:139-162` | The engine instance |
| `clock` option, `createManualClock` | `types.ts:145`, `:116-127`; `clock.ts:34-47` | The server clock (a manual one here, ENG-16) |
| `scheduler` option | `types.ts:108`, `:147`; called at `engine.ts:283`, only when started, hydrated and visible (`engine.ts:281-284`) | The host owns the tick cadence |
| `Sim.start()`, `Sim.stop()`, `Sim.tick()` | `engine.ts:340-345`, `:324-329`, `:263-279` | Start, stop with flush, one step |
| `timers` option | `types.ts:111-114`, `:155`; used by the snapshot throttle `platform.ts:211-278` (`:246`) | No real timer |
| `storage` option, `null` for memory | `types.ts:149`; `engine.ts:202-205`; `platform.ts:80-84` | Memory storage; the rehydration source |
| `authStorage: null` | `types.ts:151`; `engine.ts:198-201`, `:214` | No operator record; the engine starts signed out |
| `visibility`, `ALWAYS_VISIBLE` | `types.ts:153`; `platform.ts:166-169` | Never paused |
| `onError`, `Sim.errors()` | `types.ts:161`; `engine.ts:173-195`, `:351` | The server's error reporter |
| Hydration | `store.ts:105-141` (merge `:117-134`, epoch + 1 `:128`), `isUsableSnapshot` `store.ts:79-94`; started at `engine.ts:316`; re-seed `engine.ts:239`; rejection report `engine.ts:244-250`; `ready`, `isReady`, `wasRestored` `engine.ts:337-339` | d2 path A |
| `toSnapshot`, `SNAPSHOT_KEYS`, `SIM_STORAGE_KEY`, `SIM_SNAPSHOT_VERSION` | `store.ts:73-76`, `:24-55`; `constants.ts:12`, `:14` | The durable slice list |
| `sim.store.setState`, `getState`, `subscribe` | `store.ts:18-21` (the zustand store) | The actor scope, d2 path B, the operators mirror, change detection, rollback with `setState(previous, true)` |
| `signedOutAuth()` and the signed-in shape | `auth.ts:111-113`; shape as `auth.ts:380-386` builds it | The actor scope |
| The identity the hosted checks read | `requirePermission` `auth.ts:78-91`; `signedInOperatorId` `session-machine.ts:116-118` | Why the scope works |
| `sim.rng.reseed`, `createRngStreams`, `RngStream.EVENTS` | `rng.ts:161`, `:145-166`, `:129` | d2 path B; the d1 pure reference |
| `sim.actions.*` | `actions.ts:129-236`: `inject` `:178`, `clearFault` `:179`, `recover` `:156-162`, `createSession` `:148`, `scanCaseNumber` `:149`, `beginPrecheck` `:150`, `acknowledgePrecheckWarnings` `:151`, `startRecording` `:153`, `stopRecording` `:154`, `cancel` `:155`, `addMarker` `:163`, `addNote` `:164`, `exportEvidence` `:170-171`, `archiveEvidence` `:172` | The hosted commands |
| The fault path | `injectFaultTransition` `faults.ts:205-336` (critical kinds at `:324`); `enterFault` `session-machine.ts:913-938`; `FAULTABLE_STATES` `session-machine.ts:76-82`; `recoverTransition` `:941-976`; recovery end `:979-1064` | d3 |
| The audit chain | `verifyAuditChain` `events.ts:166-191`; `chainHash` `:64-66`; `auditBody` `:69-84`; `appendAudit` `:117-146`; `tamperAuditRow` `:197-203`; `untamperAuditRow` `faults.ts:195-202`; default tamper row `faults.ts:64-70` | d4 and the table model |
| The pure reference | `createIdleState` `initial-state.ts:138`; `buildScenarioState` `scenarios.ts:160-188`; `replayRecordingActivity` `generator.ts:161-169`; the engine's generator `generator.ts:171-215` | d1 reference 2 |
| `simErrorCode` | `errors.ts:117` | d5 |

No private member, no deep import and no patch of the simulator was used. Everything comes through the barrel `@dems/shared/sim` (`packages/shared/package.json:12`).

---

## 6. SIM-GAP

**None.** No seam is missing for option B: every adapter the host needs is an option of `createSim`, the actor scope and the rehydration use the public store, and `packages/shared/src/sim/**` runs unchanged.

---

## 7. Findings, deviations and decisions for the controller (P22)

### 7.1 Findings

| ID | Finding | Evidence | Consequence |
|---|---|---|---|
| F-1 | **The restart fault is stamped at the restart instant and counts the stop as recording.** `sim.actions.inject('POWER_FAIL')` uses `clock.now()`. After a 90 s stop, `fault.at` is 90 s after the last recorded instant and `bytesWritten` grows by 205,000,000 bytes (8.2 GB/h for 90 s). The INCOMPLETE item takes its end time and size from these values | Output line `INFO d3 fault instant`; `actions.ts:178`; `session-machine.ts:916-926` (`enterFault` settles the bytes with `now`), `:993` (`endedAt` from `fault.at`) | Specification 8.6 says the Core recorded nothing while the process was down. With the action as written, the evidence item's length and size include the stop. **Decision needed (D-1)** |
| F-2 | The same shared code can stamp the fault at a stored instant: `store.setState(injectFaultTransition(state, lastCommittedInstant, 'POWER_FAIL'))` gives FAULT with `fault.at` and the bytes at that instant | Output line `INFO d3 alternative`; `faults.ts:205` (exported, takes `now`) | An option for D-1 that needs no simulator change; it needs a stored "last committed instant" (the `clock` slice is transient and is not in the snapshot) |
| F-3 | **Two engine-timed rows name an operator by design.** When the engine arms a clean pre-check, `PRECHECK_PASSED` names the session's creator with `details.by = 'system'`; `PRECHECK_BLOCKED` does the same. The value comes from `session.createdBy`, not from the `auth` slice | Output line `INFO d5 engine-timed rows`; `session-machine.ts:541-550`, `:603-616` | The sentence "rows written by the engine itself have no operator" (ENG-2, AC-B-53, G-25) is not literally true. The engine never takes an actor from `auth` outside a command (d5), which is what the rule protects. **Decision needed (D-2)**: reword AC-B-53, or W26's test fails on a correct engine |
| F-4 | `inject` and `clearFault` write no actor, also inside the scope: `FAULT_RAISED` and `FAULT_CLEARED` have `actorId` null when a signed-in operator calls them | Output line `INFO d5 inject and clearFault inside the scope`; `faults.ts:274-321`, `:371-385` (no `actorId` in the inputs) | Operations 73 and 74 (`DEMO_CONTROL`) leave no operator on their audit row. **Decision needed (D-3)** |
| F-5 | **A rejected snapshot is replaced by a fresh demo dataset, with only a warning.** If the snapshot lacks one of the 29 required keys, or has another seed or schema version, the engine starts on `createIdleState` and reports `store.hydrate` at level `warn` | d2 (seed mismatch); `store.ts:79-94`, `:117-123`; `engine.ts:244-250` | W26 must treat `wasRestored() === false` (when the database is not empty) as a fatal start error, never continue. The assembled snapshot must carry all 29 keys, including the two slices the server does not use (`authLockout`, `pairing`) and `meta.seed` |
| F-6 | Importing the simulator loads React. The only export is the barrel (`packages/shared/package.json:12`), which re-exports `react.ts` (`index.ts:39`; imports `react`, `zustand`, `zustand/react/shallow` at `react.ts:15-25`) | Output line `MEASURE packages loaded` | Works under Node (no DOM, no `react-dom`). `@dems/core-server` gets a run-time dependency on `react` 19.2.3, resolved today from the root `node_modules`. **Decision needed (D-4)**: accept and declare it, or add a React-free entry to the shared manifest (an additive manifest change, not a change under `src/sim`) |
| F-7 | With the **default** adapters under Node 26 the simulator would use Node's own global `sessionStorage` for the snapshot and the operator record, a real `setInterval`, and a real `setTimeout` for the throttle | Section 4.4; `platform.ts:39-47`, `:87-94`, `:157-162`, `:187-197` | The host must pass `storage`, `authStorage`, `scheduler` and `timers` explicitly, as specification 8.1 lists. `visibility` falls back to always-visible by itself (no `document`) |
| F-8 | The zustand persist layer runs on every `setState`: with `storage: null` it serialises the whole snapshot (about 202 KB now; the audit ring alone would be about 458 KB when full) once a second | Section 4.1; `store.ts:109-114`; `platform.ts:243-247` | Harmless in cost (20 to 25 ms of CPU a minute at this size) but useless in the server. Recommended for W26: a storage adapter whose `getItem` returns the assembled snapshot and whose `setItem` does nothing |
| F-9 | Rollback by reference works for the store but not for what lives outside it. `store.setState(previous, true)` restores the exact reference after a command and after a tick. The generator's schedule, the health subsystem's last second, the audio meters and the random-stream positions are closures and are not restored: a rolled-back tick's integrity row is **not** emitted again; the next row takes the same `seq` at its own later time and the chain stays valid | Output line `INFO rollback by reference`; `generator.ts:172-174`, `:197`; `health.ts:179`, `:187`; `rng.ts:145-166` | ENG-5 holds as written (state back, ticks resume). W26 should not expect a replay of the lost tick, and its fixed-seed comparison (AC-B-52) is only valid for runs without a rollback |
| F-10 | The actor scope is visible to store subscribers: 12 notifications with a signed-in `auth` during 8 commands. `auth` is not a durable slice | Output line `INFO d5 subscribers` | A publisher that listens to the store must ignore `auth`, or it would broadcast the caller's identity |
| F-11 | The `AUDIT_CHAIN_DISCONTINUITY` row stores `details.index`, the position **in the ring** (217 here), beside `details.seq` | `faults.ts:253-254`, `:281-287` | After 1,000 rows the index is relative to the ring window. Clients should use `seq` |
| F-12 | Six `failed to copy trust settings of system certificate` lines on standard error in every run | Section 2.1 | Environment noise under the command sandbox; not from the script; not investigated further |

### 7.2 Deviations from the plan

| ID | Deviation | Reason |
|---|---|---|
| DR-a | `masterplan/02_plan.md` (tracking) and `status_tasks.md` were **not** updated by this row | Parallel run (P8, Documentation Contract): only the controller writes the shared trackers. The row's status is in `delegation_progress/coder_execution_step_26.md` |
| DR-b | The proof holds more than the five points: recovery after the fault, the four other faultable states, a ring with dropped rows, the operators mirror, rollback by reference, a negative control for d5 | Each is an `INFO` line and never part of a PROOF verdict. They close parts of SA-05, ENG-3 and ENG-5 that W26 would otherwise meet first |
| DR-c | The d1 reference harness (the shared suite's own way of driving the `Sim`) uses the default timers for one throttle timer; the script calls `stop()` on it, which clears it | It reproduces the suite's harness unchanged. `CHECK timers: ok` confirms nothing is left pending |

### 7.3 Decisions needed

| ID | Question | Options | Recommendation of this row |
|---|---|---|---|
| D-1 | Which instant does the restart fault carry (F-1, F-2)? | (a) As the specification says: `sim.actions.inject` at the restart instant; the INCOMPLETE item includes the stop. (b) The exported pure transition at the last committed instant; needs that instant stored. | (b). It keeps the record truthful and uses the same shared code. It adds one stored value; whether a column exists for it is for the database contract (a possible `SCHEMA-GAP` for W26 to raise) |
| D-2 | Wording of AC-B-53, ENG-2 and G-25 (F-3) | (a) "No row takes its actor from the engine's `auth` slice outside a command; rows the engine writes by itself have no actor, except `PRECHECK_PASSED` and `PRECHECK_BLOCKED`, which name the session's creator with `details.by = 'system'`." (b) Keep the wording and change the simulator (not allowed by P21) | (a) |
| D-3 | Should operations 73 and 74 leave the operator on record (F-4)? | (a) Accept `actorId` null (parity with the simulator, as SD-28 ruled for other rows). (b) One server log line with the operator ID. (c) A server-native audit row | (b), the pattern the specification already uses for `acknowledgeAlert` and `updateSettings` (`01_specs.md:1464`) |
| D-4 | React as a run-time dependency of the server (F-6) | (a) Accept; declare `react` in `apps/core-server/package.json` (an npm slot). (b) Add a React-free subpath export to `packages/shared/package.json` | (a) is the smaller change; (b) is cleaner for packaging. No preference on evidence |

---

## 8. What this proof does not show

- No PostgreSQL: the "table" of d4 and the "slice texts" of d2 are in-memory models of the rules ENG-10 and ENG-11. The real write-through, its transaction and the commit-failure path are W26.
- No real time and no real scheduler: the pipeline rule "no tick while a commit is in flight" (ENG-1) is not exercised.
- One simulated minute for the checks and ten minutes for the scaling measurement; no run of hours, no memory measurement.
- 13 of the simulator's 42 actions were called: `createSession`, `scanCaseNumber`, `beginPrecheck`, `startRecording`, `stopRecording`, `cancel`, `recover`, `addMarker`, `addNote`, `exportEvidence`, `archiveEvidence`, `inject`, `clearFault`. The other hosted actions of specification 7.17 were not exercised (`acknowledgePrecheckWarnings` is in the script but the pre-check passed cleanly in every run).
- The engine ran from TypeScript sources through tsx. How the server is built and packaged is another row's concern.
- Reference 1 of d1 runs in the same process as the host run. The independent reference is the pure replay (reference 2), which covers `seq`, `at` and `type`, not the row contents.

---

## 9. Files

| Path | Kind |
|---|---|
| `.cache/proof-engine/headless.mts` | The proof script (scratch, ignored) |
| `.cache/proof-engine/run_01.log` to `run_05.log`, `run_01.err` to `run_05.err` | Run logs (scratch, ignored) |
| `.cache/proof-engine/debug_d4.mts` | The 20-line aid that explains the d4 failure of run 01 (scratch, ignored) |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/04_proof_headless_engine.md` | This file (new) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_26.md` | Progress file (new) |

Rollback R-NEW: delete the folder `.cache/proof-engine/`. Nothing else was created outside `docs/`.

---

**Recommendation: ADQ-1 option B CONFIRMED.** W26 can host the shared `Sim` as specified in section 8 of the specification. Fallback Fd is not triggered. Record D-1 to D-4 before W26 starts.

*Generated: 2026-10-04 06:50 WIB*
