# coder-execution — step 31 (W-02 part a: simulator contract, SCR-01 / SCR-02)

| Field | Value |
|---|---|
| Step | 31 |
| Agent | coder-execution |
| Status | **complete** |
| Started / finished | 2026-10-01 02:27 / 02:47 WIB |
| Output | implementation/12_sim_contract.md |
| Next owner of `packages/shared/src/sim/**` (P6) | step 32 |

## Files written

| Path | Change |
|---|---|
| `packages/shared/src/sim/index.ts` | replaced the empty placeholder with the public barrel |
| `packages/shared/src/sim/{constants,vocabulary,types,errors,rng,clock,events,evidence,dataset,auth,platform,initial-state,store,selectors,actions,engine,react}.ts` | new (17 files) |
| `packages/shared/test/auth.test.ts` | new (14 tests; AC-50 + the BIOMETRIC audit row) |
| `packages/shared/test/sim-store.test.ts` | new (16 tests; injected storage, `ready`, snapshot contents, throttle, engine, visibility) |
| `packages/shared/test/sim-contract.test.ts` | new (26 tests; rng, clock, dataset, hash chain, integrity, selectors, stubs, export boundary) |
| `docs/…/implementation/12_sim_contract.md` | step report, including the contract |
| `docs/…/delegation_progress/coder_execution_step_31.md` | this file |

**Not written** (parallel-run contract):
- `02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and `99_implementation_report.md`. The controller synthesises them.
- No `package.json` or lockfile change. No `npm install`.

## Verification (row 31): 5/5 PASS

| Check | Result |
|---|---|
| auth.test.ts passes (AC-50 + BIOMETRIC audit row) | PASS: 14/14 |
| Store test: injected in-memory storage, `ready` after hydration, snapshot excludes audio | PASS: sim-store.test.ts 16/16 |
| Web-global grep under `src/sim` finds only guarded default-adapter code | PASS: 4 lines, all in `platform.ts`; `randomUUID` absent; positive control matched |
| `src/index.ts` does not re-export `./sim` | PASS: grep exit 1 |
| Shared typecheck exits 0 | PASS |

**Extras:**
- Full shared suite: 212/212.
- Lint exits 0.
- Consumer-strict flags exit 0.
- `src/sim` compiles under both core-web and Expo compiler settings.

## Decisions / drift / blockers (details in the report, §6)

**Drift:**
- S31-2: extra optional adapters (`authStorage`, `timers`, `persistThrottleMs`, `initialPairing`, `onError`).
- S31-6: `sealedHourly` is a derived selector, and Sealed Today is 0 at load.
- S31-10: `evidence.ts` was started early, with the pure hash derivation only.

**Decisions:**

| ID | Decision |
|---|---|
| S31-1 | Actions live outside the state |
| S31-3 | Operator IDs are `OPR-001..003` |
| S31-4 | Console-wide lockout, with one audit row per attempt |
| S31-5 | RBAC interpretation |
| S31-7 | The RECORDED evidence belongs to the INCOMPLETE session |
| S31-8 | 8.2 GB/h exactly |
| S31-9 | Explicit hydration with a write gate |
| S31-11 | Step-32 actions throw `SimNotImplementedError` |
| S31-12 | Action naming |
| S31-13 | `react.ts` uses `createElement` |
| S31-14 | Initial pairing is PAIRED |

**Findings for the controller:**
- **F-31-1: Node v26.8.2 defines a global `sessionStorage`.** Every Node or jsdom test must pass `storage: null, authStorage: null` or stub the global; otherwise sims in one worker share one snapshot. Step 32's `sim-platform-neutral` test must stub `sessionStorage` to undefined. Please relay this to steps 32, 38 and 39.
- F-31-2 (P11): root and `@dems/mobile` typecheck exit 2, with 4 errors, only in the concurrent step's `apps/mobile/src/components/composed/rolling-number.tsx`. Re-run after that step lands. Shared, mock-core and core-web typecheck exit 0.
- H-31-1: Metro and Hermes loading `@noble/hashes/sha2.js` is unverified on a device. Step 73 should check it.

**Blockers:** none. No processes started. Nothing committed.
