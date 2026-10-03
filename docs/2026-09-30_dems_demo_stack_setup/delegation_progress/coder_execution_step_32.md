# coder-execution — step 32 (W-02 part b: simulator engine, SCR-01 / SCR-02 behaviour)

| Field | Value |
|---|---|
| Step | 32 |
| Agent | coder-execution |
| Status | **complete** |
| Started / finished | 2026-10-01 02:52 / 03:36 WIB |
| Output | implementation/13_sim_engine.md |
| Next owner of `packages/shared/src/sim/**` (P6) | step 54 (conditional), then step 91 |

## Files written

| Path | Change |
|---|---|
| `packages/shared/src/sim/{session-machine,derive,faults,audio,health,generator,maintenance,evidence-actions,pairing,scenarios,api}.ts` | new (11 files) |
| `packages/shared/src/sim/actions.ts` | rewritten (every action wired) |
| `packages/shared/src/sim/{engine,dataset,initial-state,evidence,events,selectors,types,errors,constants,index}.ts` | extended (additive; D54 b dataset change) |
| `packages/shared/test/{sim-determinism,session-machine,audio,storage-math,hash-chain,sim-platform-neutral,sim-mobile-additions}.test.ts` | new: the seven row-32 files, 89 tests |
| `packages/shared/test/{sim-api,sim-faults-scenarios}.test.ts` | new: extra files, 46 tests |
| `packages/shared/test/sim-contract.test.ts` | updated 4 tests (step-31 file; the contract changed, S32-D1) |
| `docs/…/implementation/13_sim_engine.md` | step report and updated contract |
| `docs/…/delegation_progress/coder_execution_step_32.md` | this file |

**Not written** (parallel-run contract):
- `02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and `99_implementation_report.md`. The controller synthesises them.
- No `package.json` or lockfile change; no `npm install`.
- Nothing under `src/{i18n,brand,tokens,api}/**`, demo-media or demo-data.

## Verification (row 32): 3/3 PASS (03:31-03:32 WIB)

| Check | Result |
|---|---|
| `npm test -w @dems/shared` exits 0 with the seven files passing | PASS: exit 0. 20 files, 347/347. determinism 8, session-machine 27, audio 14, storage-math 9, hash-chain 14, platform-neutral 8, mobile-additions 9 |
| sim-platform-neutral runs in Node with no `document` or `sessionStorage` | PASS: stubbed to undefined and asserted, then a full session on injected async storage, visibility and scheduler |
| Shared typecheck exits 0 | PASS |

**Extras:**
- lint 0 (0 warnings);
- consumer-strict flags 0;
- `src/sim` under the core-web and Expo compiler settings: 0 and 0;
- web-global grep: the same 4 guarded `platform.ts` lines; no `randomUUID`, `crypto` or `Math.random`; the root barrel does not re-export the sim;
- core-web typecheck 0 and tests 64/64 (routes.test.tsx runs the real engine);
- mock-core typecheck 0;
- mobile jest 210/210;
- step-33 schema cross-check 15/15.

**P11 noise:** mobile typecheck exits 2, only in the concurrent mobile files `src/navigation/*` and `components/composed/nav/live-mini-bar.tsx`. Re-run after steps 69–71.

## Decisions / drift / findings (details in the report, §5)

**Decisions:**

| ID | Decision |
|---|---|
| S32-1 (D54 b) | 7 follow-ups sealed today (EV 0007–0013 / SES 0017–0023); the six step-31 items unchanged; **recording scenario session 0017 → 0024**; idle counters 24/8/14; Sealed Today 7, pending 1 |
| S32-3 | Scheduled-time transitions; monotonic audit time |
| S32-5 | Precheck policy (the Core check follows the tablet link; ≤ 4.9 s in total) |
| S32-7 | A SEALED session stays until the next create |
| S32-8 | An interrupted recording keeps a RECORDED evidence item |
| S32-9 | POWER_FAIL recovery: SYSTEM_BOOT, and the fault clears itself |
| S32-11 | Fault rows carry `evt` and `eventKind` (AUDIO_CLIP) |
| S32-13 | Archive needs SUPERVISOR |
| S32-14 | API contract |
| S32-15 | The CLIP latch sets at inject |
| S32-16 | The storage fill |
| S32-17 | Optional types; snapshot version 1 |
| S32-18 | New error classes |
| S32-19 | Generator events |
| S32-20 | No event on a WARN outcome |
| S32-21 | Bytes settle at stop and fault |

**Drift:**
- S32-4: STOPPING is faultable.
- S32-6: create idempotent while any session is active.
- S32-10: extra fault targets.
- S32-12: 409 SECURITY_FAULT on export.
- S32-D1: step-31 test file updated.
- S32-D2: 5 extra source files and 2 extra test files.

**Findings for the controller:**
- **F-32-1 (relay to 92 / 93 / 47 / 53):** the 7 new today items have no media or package unless steps 92 and 93 include them. Join by the evidence suffix. Key the recording loop by `RECORDING_SCENARIO.sessionSeq` = **24**, not 17.
- F-32-2 (P11): re-run the mobile typecheck later.
- F-32-3 (step 73): the mobile stub fixture uses a literal `SES-…-0017`. Consider `persistThrottleMs` 2000-5000 on AsyncStorage (hypothesis).
- F-32-4 (steps 33, 54, 91): step 33 imports `EXPORT_REASON_MIN_LENGTH`, `STOP_REASON_MIN_LENGTH` and the `isValidSessionInput` bounds (64/120/80/2000); keep them stable.
- H-32-1: before about 02:50 WIB, Sealed Today is below 7.

**Blockers:** none. No processes started. Nothing committed.
