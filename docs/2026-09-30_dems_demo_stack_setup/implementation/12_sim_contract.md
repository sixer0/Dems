---
task_id: 2026-09-30_dems_demo_stack_setup
step: 31
plan_row: 02_plan §4 W-02 part a (simulator contract; SCR-01 and SCR-02 contract; audit hash chain moved here)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
---

# Step 31: Simulator contract (`@dems/shared/sim`)

**Outcome: PASS.** All five row-31 checks pass; the command output is in §5.
- 18 source files under `packages/shared/src/sim/` (4,790 lines) and 3 test files (56 tests).
- Exported only through `@dems/shared/sim`. The root barrel is unchanged.
- The only web globals are 4 lines in `platform.ts`, all guarded (quoted in §5).

Steps 32, 54 and 91 own this path next (P6), one at a time. §2–§4 are the contract they build on, together with the web pages (42–53) and mobile step 73.

## 1. Files

| File | Role | State after step 31 |
|---|---|---|
| `constants.ts` | Rates, storage keys, ring sizes, auth, pairing and machine timing, audio model, storage model | complete |
| `vocabulary.ts` | Demo-defined `const` value sets plus unions (roles, permissions, audit types and categories, fault kinds, scenarios, …) | complete |
| `types.ts` | State slices, `SimActions`, adapters, `CreateSimOptions`, results, `SimSubsystem`, `SimApiRequest/Response` | complete (the contract) |
| `errors.ts` | `SimNotImplementedError`, `SimTransitionError` (for step 32, AC-52), `describeError` | complete |
| `rng.ts` | mulberry32; helpers `int`, `float`, `chance`, `pick`, `gauss`, `poisson`, `exponential`, `hex`; streams keyed by seed, salt and epoch | complete |
| `clock.ts` | `createSimClock` (real time × speed), `createManualClock` (test mode); WIB arithmetic without `Intl` | complete |
| `events.ts` | `canonicalJSON`, `sha256Hex`, `chainHash`, `appendAudit`, `verifyAuditChain`, `tamperAuditRow` (EVT-30 hook), `appendEvent`, `appendActivity`, ring buffers (500 / 1000) | complete |
| `evidence.ts` | Pure integrity derivation: track hash, manifest hash, simulated signature, `buildEvidenceIntegrity` | **partial**: step 32 adds seal, `verify()` and the tamper hook |
| `dataset.ts` | The one canonical dataset: device, §24.1 identity, operators, demo password and pairing code, network, 16 services, ID formats, recording-scenario constants, 6-item history | complete |
| `auth.ts` | RBAC table, lockout, pure sign-in, biometric, security-key, sign-out, idle-expiry and restore transitions | complete |
| `platform.ts` | Guarded default adapters; memory storages; `dems.auth` storage; `ALWAYS_VISIBLE`; default timers and scheduler; 1 s throttled persist storage with a hydration gate | complete |
| `initial-state.ts` | `createIdleState({ now, seed, pairing?, auth? })`: every slice, with history replayed through the real chain | complete (idle) |
| `store.ts` | zustand vanilla, `subscribeWithSelector` + `persist` (`dems.sim.v1`, version 1, `skipHydration`); `toSnapshot`; `isUsableSnapshot` | complete |
| `selectors.ts` | Derived reads (§3) | complete for the contract slices |
| `actions.ts` | `createActions`: auth, `verifyAuditChain`, `setTabletLink` and `setActiveCamera` are real; every other action throws `SimNotImplementedError('…', 'step 32')` | **skeleton** |
| `engine.ts` | `createSim`, `Sim`, `createSubsystems` (clock publisher and auth idle expiry), `buildScenarioState` (idle only) | **skeleton** |
| `react.ts` | `SimProvider`, `useSim`, `useSimActions`, `useAudioChannel`, plus `useSimInstance`, `useSimReady`, `SimContext` | complete |
| `index.ts` | `export *` of all of the above | complete |

**Tests** (names disjoint from step 32's seven):

| File | Tests |
|---|---|
| `packages/shared/test/auth.test.ts` | 14 |
| `packages/shared/test/sim-store.test.ts` | 16 |
| `packages/shared/test/sim-contract.test.ts` | 26 |

**Not touched:**
- `package.json`, `src/index.ts`, and every file outside `src/sim` and those three tests.
- The step-32 files `session-machine.ts`, `audio.ts`, `health.ts`, `faults.ts`, `api.ts` and `scenarios.ts` are **not created**. Step 32 creates them.

## 2. Contract: creating and running a simulator

```ts
import { createSim, SimProvider, useSim, useSimActions, useAudioChannel, selectStorage } from '@dems/shared/sim';

const sim = createSim({
  seed,             // default 20261001
  scenario,         // default 'idle' ('recording' | 'finalizing' | 'fault-demo' throw until step 32);
                    //   ignored when a snapshot hydrates
  clock,            // default createSimClock() (real time, 1×); tests use createManualClock(start)
  scheduler,        // (tick, intervalMs) => cancel; default setInterval(tick, 50)
  storage,          // zustand PersistStorage<SimSnapshot>; default web session storage, else memory;
                    //   null = memory
  authStorage,      // { load, save, clear } for { operatorId, issuedAt }; default web session storage
                    //   key 'dems.auth', else memory; null = memory
  visibility,       // { isHidden(), subscribe(onChange) => unsubscribe }; default page visibility,
                    //   else always visible
  timers,           // { setTimeout, clearTimeout }; default globals
  persistThrottleMs,// default 1000
  initialPairing,   // default 'PAIRED'; mobile may pass 'UNPAIRED'
  onError,          // (SimErrorReport) => void; the last 50 are also kept in sim.errors()
});
await sim.ready;    // never rejects; resolves after hydration (async on AsyncStorage)
sim.start();        // safe to call before ready; runs once ready AND visible; idempotent
sim.stop();         // pause, unsubscribe visibility, flush the snapshot
sim.tick();         // one engine step at clock.now() (tests)
sim.flush(); sim.isReady(); sim.wasRestored(); sim.isRunning(); sim.errors(); sim.store; sim.actions; sim.rng
```

**Platform recipes:**

| Platform | Recipe |
|---|---|
| Web | `<SimProvider>` with no props: it creates the sim, starts it after mount and stops it on unmount. Session storage is synchronous, so `ready` is immediate. Seed the sign-in for P4 by writing `sessionStorage['dems.auth'] = '{"operatorId":"OPR-001","issuedAt":<ms>}'` |
| Mobile (step 73) | `createSim({ storage: createJSONStorage(() => AsyncStorage), authStorage: null, visibility: <AppState adapter> })`, then `<SimProvider sim={sim} autoStart>`. Gate the UI on `useSimReady()` or `await sim.ready`. Hydration replaces any change made before `ready`, so call actions after it |
| Tests (Node 26 / jsdom) | Always pass `storage: null, authStorage: null` (or stub the globals). See §6 F-31-1 |

**Engine subsystems:**
- `SimSubsystem { name; tick({ now, dtMs, tickIndex }) }` runs in order on every tick.
- A throw is reported as `engine.<name>`; it never stops the loop.
- `dtMs` is large after a resume from hidden, so subsystems catch up from it.
- Step 32 appends to `createSubsystems(engine)`: the session-machine timers, audio (20 Hz), health (1 Hz), the event generator and fault effects.
- `EngineContext` gives each subsystem `{ store, clock, rng, report }`.

## 3. Contract: state, actions, selectors

**State.** `SimState` is plain JSON data. Times are epoch milliseconds on the sim clock. IDs come from `meta.counters` or the seeded RNG.

**Slices:**
- `meta` (`schemaVersion` 1, `seed`, `scenario`, `epoch`, `createdAt`, `counters { event, session, caseNumber, evidence, item }`)
- `clock` (`now` in 100 ms steps; `tz` '+07:00'; offset 420)
- `device` (id, name, room, product, version, §24.1 `identity`)
- `operators`
- `auth` (status, operatorId, method, issuedAt, lastActivityAt)
- `authLockout` (failures[], lockedUntil)
- `pairing` (state, core ID and name, certificate fingerprint, pairedAt, failures, lockedUntil)
- `tabletLink` (state, changedAt)
- `session: ActiveSession | null`:
  - `id`, `state`, `input`, `createdAt`, `createdBy`
  - `precheck` (items × 8, outcome, warningsAcknowledged)
  - `armedAt`, `startedAt`, `stoppedAt`, `stopReason`, `sealedAt`
  - `finalization` (6 steps)
  - `timeline`, `notes`, `markerCount`, `snapshotCount`, `bytesWritten`
  - `fault`, `recovery`, `evidenceId`
- `lastSealedSessionId`, `lastSealedAcknowledged`
- `sessionHistory[]` (outcome SEALED or INCOMPLETE, faultKind, evidenceId)
- `activeCameraId`, `cameras[2]`, `mics[2]` (with `clipLatched`)
- `audio.channels{AUDIO-01, AUDIO-02}` (frame: `seq`, `at`, `dbfs`, `peak`, `clip`, `noSignal`; numbers and booleans only)
- `storage` (state, volumes [NVMe system 2 TB, HDD evidence 4 TB], writeBytesPerSec, bitrateMbps, 24-point history, lastWriteVerifiedAt)
- `storagePolicy`
- `time` (source, locked, stratum, offsetMs, gnss, ntp, rtc, history)
- `network` (IP, LAN, gateway, link, PoE, bandwidth with history, 4 domains)
- `security` (state, posture, TPM, secure boot, AES-256-GCM, SHA-256, tamper, 6 controls, 3 simulated keys)
- `services[16]`
- `health` (cpu, temperatures, fan, series)
- `otherDevices[3]`, `ports[7]`
- `evidence[]` (tracks × 4 with sha256, manifestHash, simulated signature, custody, verification, tampered)
- `events[]` (ring of 500)
- `alerts[]`
- `audit { rows (ring of 1000), head, total, dropped }`
- `faults.active[]`
- `diagnostics`
- `update` (2.4.1 → 2.5.0, slot A, 6 steps)

**Persisted snapshot** (`dems.sim.v1`, version 1) is the state minus `audio`, `clock` and `auth`.
- `SNAPSHOT_KEYS` has a compile-time proof that it lists every snapshot key.
- A snapshot with another seed, another schema or a missing key is dropped and reported at `warn`.
- Hydration bumps `meta.epoch`, and the RNG streams reseed from it.

**Actions** (`sim.actions` or `useSimActions()`):

| Group | Action → result | Step |
|---|---|---|
| Auth | `signIn(username, password)`, `signInWithBiometric(operatorId)`, `recordBiometricFailure(operatorId \| null)`, `signInWithSecurityKey()` → `SignInResult` (`{ok:true, operatorId, role, method}` \| `{ok:false, reason:'INVALID_CREDENTIALS', attemptsRemaining}` \| `{ok:false, reason:'LOCKED', lockedUntil, retryInMs}`); `signOut(reason?: 'USER' \| 'LOCK')`; `touch()` | **31** |
| Session machine | `createSession(input) → CreateSessionResult`; `beginPrecheck()` (= "sim.precheck()" in 01_specs §14.5.11 and 04 §5.6); `acknowledgePrecheckWarnings()`; `retryPrecheck()`; `startRecording()`; `stopRecording(reason)`; `cancel()`; `recover()`; `addMarker(label?)`; `addNote(text)`; `snapshot()`; `acknowledgeSummary(sessionId)` | 32 |
| Evidence and audit | `verify(evidenceId) → EvidenceVerifyResult`; `exportEvidence(id, {reason, destination}) → ExportResult` (202 \| 401/403/404/409/422); `archiveEvidence(id)`; `exportAudit() → ExportResult` | 32 |
| Audit | `verifyAuditChain() → ChainVerifyResult` (`{ok:true, checked, head}` \| `{ok:false, checked, index, seq, reason:'HASH_MISMATCH' \| 'PREV_LINK_BROKEN' \| 'SEQ_GAP'}`) | **31** |
| Faults and scenarios | `inject(kind, target?)` (target `{channel?, cameraId?, auditIndex?}`); `clearFault(kind, target?)`; `resetClip(channel)`; `acknowledgeAlert(alertId)`; `loadScenario(name)` | 32 |
| Devices and maintenance | `runDiagnostics() → runId`; `deviceCommand(deviceId, 'TEST_SIGNAL' \| 'RESTART')`; `setStoragePolicy(partial)`; `startSoftwareUpdate()` | 32 |
| Devices | `setActiveCamera(cameraId)` | **31** |
| Pairing | `pair(code) → PairResult`; `unpair()` | 32 |
| Tablet link | `setTabletLink('CONNECTED' \| 'OFFLINE')`: updates `tabletLink` and the TABLET row, plus one audit row and one event | **31** |

**Selectors** (`selectors.ts`; pass them to `useSim`, whose comparison is shallow):

| Area | Selectors |
|---|---|
| Auth | `selectAuth`, `selectIsSignedIn`, `selectOperator`, `selectRole`, `selectCan(s, permission)`, `selectLockout` (at `clock.now`), `selectOperatorById` |
| Session | `selectSession`, `selectSessionState`, `selectIsRecording`, `selectElapsedMs` (clock-derived; S4), `selectTimeline`, `selectPendingSummaryId` (SCR-02), `selectSessionHistory` (newest first), `selectRecentSessions(s, 3)`, `selectSessionHistoryById` |
| Devices | `selectCameras`, `selectMics`, `selectCameraById`, `selectMicById`, `selectDeviceById` (CAM-01, MIC-02, POE-SWITCH, …), `selectDeviceStats` |
| Storage | `selectStorage`, which returns `totalBytes`, `usedBytes`, `freeBytes`, `usedPercent` (rounded; 20 at load), `usedRatioPercent`, `estimatedRemainingMs` (free ÷ 8.2 GB/h) and `state`. Helpers: `storageSummary`, `storageStateFor(%)` (LOW ≥ 85, FULL ≥ 98) |
| Evidence | `selectEvidence`, `selectEvidenceById`, `selectEvidenceStats` (total, recorded, sealed, exported, underReview, archived, pending, sealedToday), `selectSealedHourly` (24 WIB buckets derived from `sealedAt`), `selectSealedToday` |
| Stream | `selectRecentEvents(s, 6)`, `selectActiveAlerts`, `selectWorstAlert`, `selectUnacknowledgedAlertCount`, `selectAuditTail(s, 12)`, `selectChainHead` |
| System | `selectSystemState` → `{ state: READY \| ATTENTION \| CRITICAL \| RECORDING, flags[] }` (UNKNOWN is left to the UI before `ready`) |
| Misc | `selectClockNow`, `selectClockSecond` (for 1 Hz UI), `selectTabletLink`, `selectPairing` |

**React:**

| Export | Contract |
|---|---|
| `SimProvider({ sim?, options?, autoStart?, children })` | Starts after mount and stops on unmount. StrictMode-safe (start and stop are idempotent) |
| `useSim(selector)` | `useStore` + `useShallow` |
| `useSimActions()` | The stable actions object |
| `useAudioChannel(channel, onFrame)` | A `subscribeWithSelector` subscription with `fireImmediately`; the latest callback is held in a ref, so no resubscribe and no React render per frame |
| `useSimReady()` | True once hydrated |
| `useSimInstance()` | The `Sim` from the nearest provider |

## 4. Canonical dataset (as built)

| Item | Value |
|---|---|
| Device | `DEMS-IR-01` "Interview Room 1", DEMS Edge Client 2.4.1, update 2.5.0. §24.1 identity is synthetic (serial `DEC-2026-IR01-000117`, …) |
| Operators | `OPR-001` budi.santoso, AKP Budi Santoso, INVESTIGATOR, BS<br>`OPR-002` andi.pratama, AKP Andi Pratama, SUPERVISOR, AP<br>`OPR-003` rina.wijaya, Rina Wijaya, TECHNICIAN, RW<br>Password `demo-2026` (`DEMO_OPERATOR_PASSWORD`; never in state, events, audit or storage) |
| Security key | Signs in as `OPR-002` |
| Demo pairing code | `482913` (`DEMO_PAIRING_CODE`) |
| RBAC | INVESTIGATOR: SESSION_START, SESSION_NOTE, EVIDENCE_VIEW, DIAGNOSTICS_RUN<br>SUPERVISOR: those four plus EVIDENCE_REVIEW, EVIDENCE_EXPORT, AUDIT_EXPORT<br>TECHNICIAN: EVIDENCE_VIEW, DEVICE_MANAGE, DIAGNOSTICS_RUN, MAINTENANCE |
| ID formats | `SES-{YYYYMMDD}-NNNN`, `LP/{YYYY}/{MMDD}-NNNN`, `EV-{YYYYMMDD}-NNNN`, `AUD-000001`, `LOG-000001`. Idle counters: next session 0017, next Scan case 0008, next evidence 0007 |
| Recording scenario constants (`RECORDING_SCENARIO`) | Session 0017, case 0007, Ahmad Fauzi (TERSANGKA), OPR-001, Interview Room 1, STANDARD_1080P25, 00:18:42 elapsed |
| Evidence history (previous two WIB days, office hours) | 0001 Siti Rahma SAKSI SEALED<br>0002 Budi Hartono SAKSI SEALED<br>0003 Rudi Setiawan TERSANGKA UNDER_REVIEW<br>0004 Maya Lestari SAKSI EXPORTED<br>0005 Dewi Anggraini LAINNYA SEALED<br>0006 Hendra Wijaya SAKSI RECORDED = the one INCOMPLETE session (POWER_FAIL, recovered, never sealed) |
| Session history | 6 entries mirroring the evidence (sessions 0011–0016) |
| Storage | 804 GB of 4 TB used → 20% USED, 3.2 TB free; NVMe 212 GB of 2 TB |
| Network and time | 192.168.10.21 on "Interview LAN"; NTP 192.168.10.1; GNSS locked, stratum 1, offset +3 ms |
| Audit and events at load | **40** hash-chained audit rows and **31** events (measured for 2026-10-01 10:00 WIB). The audit rows replay the history (logins, create, precheck, start, stop, seal, review, export, power fail, recovery), plus today's boot. The events add time sync, health check and "2.5.0 ready" |

## 5. Verification (fresh, 2026-10-01 02:43–02:46 WIB)

| Row-31 check | Command | Result |
|---|---|---|
| auth.test.ts passes (AC-50 + BIOMETRIC audit row) | `npx vitest run test/auth.test.ts test/sim-store.test.ts test/sim-contract.test.ts --maxWorkers=2` | `Test Files 3 passed (3)` / `Tests 56 passed (56)`. auth.test.ts 14/14. AC-50 asserts the exact sequence `AUTH_FAILED ×5, AUTH_LOCKED, AUTH_SUCCESS` and no password in the serialized state. The biometric test asserts `details: { method: 'BIOMETRIC' }` |
| Store test with injected in-memory storage: `ready` after hydration; snapshot excludes audio | same run (sim-store.test.ts 16/16) | A deferred AsyncStorage-like storage keeps `isReady()` false and `ready` pending until released, then restores (epoch 1). The stored JSON has no `audio`, `clock` or `auth` key. No write happens before hydration. Writes coalesce to 1 per second |
| Web-global grep finds only guarded default-adapter code | `/usr/bin/grep -rnwE "document\|window\|sessionStorage\|localStorage" packages/shared/src/sim` | 4 lines, all in `platform.ts` (below). `randomUUID\|crypto\.` → exit 1 (none). The planted positive control matched both patterns (D44) |
| src/index.ts does not re-export ./sim | `grep -n sim packages/shared/src/index.ts` | exit 1 (no match). `sim-contract.test.ts` also asserts `'createSim' in root === false` |
| Shared typecheck exits 0 | `npm run typecheck -w @dems/shared` | exit 0 |

**Grep output (the only web-global lines under `src/sim`):**

```
packages/shared/src/sim/platform.ts:34:  document?: VisibilityDocumentLike;          ← structural type field
packages/shared/src/sim/platform.ts:35:  sessionStorage?: StateStorage;               ← structural type field
packages/shared/src/sim/platform.ts:41:    const candidate = (globalThis as WebGlobalsLike).sessionStorage;
packages/shared/src/sim/platform.ts:52:    const candidate = (globalThis as WebGlobalsLike).document;
```

**The guard around lines 41 and 52:**
- Each read sits inside `try { … } catch { return null; }`.
- It is followed by `if (!candidate || typeof candidate.getItem !== 'function') return null;` (for `document`, the check is on `addEventListener`).
- A null result falls back to memory storage or `ALWAYS_VISIBLE`.

**Extra checks:**

| Check | Result |
|---|---|
| Full shared suite (`npm test -w @dems/shared -- --maxWorkers=2`) | exit 0; 11 files, 212 tests. This includes the other lanes' concurrent test files |
| Consumer-strict flags (`tsc -p packages/shared --noUnusedLocals --noUnusedParameters --noFallthroughCasesInSwitch`, as core-web applies to imported shared source) | exit 0 |
| `src/sim/index.ts` compiled with core-web's settings (DOM lib, bundler) | exit 0 |
| `src/sim/index.ts` compiled with Expo's `tsconfig.base` settings (`customConditions: ["react-native"]`, `module: preserve`) | exit 0 |
| `npm run lint -w @dems/shared` | exit 0 |
| `oxlint --format default src test` | "Found 0 warnings and 0 errors" |
| Per-workspace typecheck | shared 0, mock-core 0, core-web 0 |
| Mobile typecheck | exit 2: 4 errors, all in `apps/mobile/src/components/composed/rolling-number.tsx` (mtime 02:35). That file belongs to a concurrent mobile step; mobile imports nothing from the sim yet. This is **P11 noise, not caused here** |
| Root `npm run typecheck` | exit 2, for the same reason. **Re-run needed** after that step lands |

## 6. Decisions, drift and findings

| ID | Kind | Item |
|---|---|---|
| S31-1 | decision | Actions live outside the state (`Sim.actions`). The state is pure JSON, so the snapshot is `partialize` minus three slices, and `useSimActions()` is stable |
| S31-2 | drift (additive) | `CreateSimOptions` has more adapters than SCR-01's `storage` and `visibility`: `authStorage` (web `dems.auth` vs mobile memory-only, 04 §6.4), `timers`, `persistThrottleMs`, `initialPairing` and `onError`. Every one is optional |
| S31-3 | decision | Operator IDs are `OPR-001..003`, not the usernames, so `dems.auth` never holds a login name. P4 seeding uses these IDs |
| S31-4 | decision | Lockout is console-wide and counts every username, including unknown ones. Each attempt writes one row. The 5th failure is AUTH_FAILED with `lockedUntil` in its details; attempts during the lockout are AUTH_LOCKED. This yields AC-50's 5 / 1 / 1 exactly. A username matching no operator is never recorded (it may be a mistyped password) |
| S31-5 | interpretation | TECHNICIAN keeps EVIDENCE_VIEW (read-only), because §14.7 names only "no evidence export and no session start". SUPERVISOR inherits the INVESTIGATOR rights. DIAGNOSTICS_RUN goes to all three roles. Demo controls are not role-gated |
| S31-6 | drift (form) | `sealedHourly` and `sealedToday` are **selectors derived from `evidence[].sealedAt`**, not a stored counter that the machine increments. The observable behaviour is the same (a new seal bumps its hour). The history sits on the previous two days, so Sealed Today is **0 at load**. The mockup's "7" is not reproduced; the one dataset stays coherent (D28/Q7) |
| S31-7 | decision | RECORDED evidence (EV-…-0006) is the evidence of the dataset's one **INCOMPLETE** session. This explains "1 pending" and gives the Sessions hub an incomplete row. **Suggestion for step 32:** at runtime, give FAULT → RECOVERY sessions a RECORDED, unsealed evidence item as well |
| S31-8 | decision | Estimated remaining = free ÷ **8.2 GB/h** exactly (AC-54). The 18.3 Mbps display bitrate gives 8.235 GB/h, which would miss AC-54's ±1 min by about 1.6 h |
| S31-9 | decision | Hydration is explicit (`skipHydration` + `rehydrate()` after wiring). Snapshot writes are dropped until it finishes (the 04 §5.2 gate). Changes made before `ready` are replaced by a restored snapshot. `start()` defers to `ready` |
| S31-10 | drift (early file) | `evidence.ts` was created now, with only the pure hash derivation, because the dataset needs real hashes. Step 32 extends it (`verify`, seal, tamper) and must keep the derivation so dataset items verify PASS. `sim-contract.test.ts` pins this |
| S31-11 | decision | Unimplemented actions **throw** `SimNotImplementedError(action, 'step 32')` instead of doing nothing silently. `createSim({ scenario: 'recording' })` also throws until step 32. Step 38 (shell) needs only auth, selectors and the providers, all of which are real now |
| S31-12 | naming | These spec names map to canonical actions: `sim.precheck()` → `beginPrecheck()`, `verify()` → `verify(evidenceId)`, "Reset" → `loadScenario(name)`. `PairingState` has no PAIRING value, because `pair()` is synchronous and the spinner is UI-only |
| S31-13 | decision | `react.ts` uses `createElement` (no JSX) to keep the spec's file name. It adds `useSimInstance`, `useSimReady` and `SimContext` |
| S31-14 | decision | The initial pairing state is PAIRED (the web trust line "paired (simulated)"). Mobile can start UNPAIRED through `initialPairing` |
| **F-31-1** | finding (for steps 32, 38, 39 and every Node or jsdom test) | **Node v26.8.2 defines a global `sessionStorage`**: `typeof globalThis.sessionStorage === 'object'`, while `localStorage` warns and is undefined. The guarded default therefore uses Node's process-wide in-memory storage in tests, so a second `createSim()` in the same worker hydrates the first one's snapshot. **Every test must pass `storage: null, authStorage: null`** or stub the global. Step 32's `sim-platform-neutral` test must `vi.stubGlobal('sessionStorage', undefined)` to model Hermes, as `sim-store.test.ts` does. jsdom in core-web tests has the same effect |
| F-31-2 | noise (P11) | Root and mobile typecheck fail only in the concurrent mobile file `rolling-number.tsx`. Re-run after that step. Shared, mock-core and core-web are clean |
| H-31-1 | hypothesis for step 73 | Metro resolves `@noble/hashes/sha2.js` and `utils.js` through package exports, and Hermes runs them (BigInt constants in `_u64.js`, `TextEncoder`). Both are expected on RN 0.86 / Expo 57, but they are **unverified on a device**. Fallback: step 73 logs a SIM-GAP |
| — | not done | React bindings are compile-verified only. `shared` has no renderer dependency, and adding one would break P1. Their render behaviour is covered by step 39 (the DbfsMeter zero-commit test) and step 38 (routes under the providers) |

**Blockers: none.**
- No `npm install` was run, and no `package.json` or lockfile was touched.
- No process was started, and nothing was committed.
- Only P6 paths were written.
