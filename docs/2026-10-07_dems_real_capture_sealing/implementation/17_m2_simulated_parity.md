---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: coder-execution-local
blueprint_row: 51 (M2-W9, class B)
status: completed-with-routed-dependency
---

# Implementation report — Row 51: Simulated v2 parity (M2-W9)

## Scope kept

Edits confined to `packages/shared/src/sim/**` plus the single `live-sim.ts` seam named by the row
(SH-21/SH-25, OD-26 default b). No file under `packages/shared/src/api/**` (row 48 runs there in
parallel), `apps/**`, `apps/mock-core`, `release/`, or any controller tracker was touched. No commit,
no push, no database contact, no sudo, no Homebrew write, no emulator PIN, no biometric step.

Files written this row (all under the allowed set):

| File | Register | Change |
|---|---|---|
| `src/sim/constants.ts` | SH-10 | sealing-driver step-timing constants (`SEALING_PROGRESS_TICK_MS`, `SEALING_ETA_STEP_MS`, `SEALING_FIRST_ATTEMPT`); OD-11 silence constants (`MIC_SILENCE_DBFS=-50`, `MIC_SILENCE_DURATION_MS=10000`); SIM_SNAPSHOT_VERSION documented (see Persistent Issues) |
| `src/sim/types.ts` | SH-05/SH-07 | `EvidenceItem` v2 fields `files`/`fragmentChainHead`/`transcriptSha256`; new `EvidenceFileEntry` |
| `src/sim/session-machine.ts` | SH-06 | `captureConfigSnapshot` + `audioSourceAtStart` written at `startRecording`; per-step `progress`/`etaMs`/`attempt` in `advanceStopping`/`advanceFinalization`; new `switchAudioSourceTransition` (op 81) |
| `src/sim/evidence.ts` | SH-07 | v2 integrity helpers (`buildEvidenceFilesV2`, `fragmentChainHead`, `packageFragmentChainHead`, `transcriptSha256`) attached to a live seal only (`schemaV2` flag) |
| `src/sim/faults.ts` | SH-08 | `describeFault` cases for `MIC_SILENT`/`CAPTURE_FAULT`; `faultTargetKey` keys MIC_SILENT to the active channel; `maybeRaiseMicSilentWarning` (OD-11 warn-never-switch) |
| `src/sim/index.ts` | OD-23 | SC8 retirement statement — the change rule now reads "simulator changes only through blueprint rows" |
| `src/live/source/live-sim.ts` | SH-25/E-02 | the `onMeters` seam (:902-905) maps the re-keyed meters frame field-by-field instead of a blind cast |
| `test/sim-v2-parity.test.ts` | (proof) | new falsifiable suite for the above |

## Executed steps

| Step | Task | Status | Notes |
|---|---|---|---|
| 1 | Read row 51 text, C3 §6, register §F/§B.1, D31 | done | Confirmed row 47 landed the type-level foundation and left SH-08 behaviour to this row |
| 2 | Baseline shared suite + typecheck | done | Suite green at session start (71/1,857); became red mid-session from concurrent row 48 (see below) |
| 3 | SH-10 constants | done | timing + silence constants added |
| 4 | SH-06 session machine (snapshot, audioSource, progress, switch transition) | done | proven by tests |
| 5 | SH-07 evidence v2 (files, chain head, transcript hash) on live seal only | done | dataset items keep byte-identical v1 shape |
| 6 | SH-08 silence warning (warn, never switch) | done | proven idempotent + never auto-switches |
| 7 | SH-25/E-02 live-sim seam minimal edit | done | blind cast removed |
| 8 | OD-23 SC8 rule retirement text | done | grep-proven in `src/sim/index.ts` |
| 9 | Verification suites + typecheck of row-51 files | done | see Test Results |

## Test Results

Row-51 code is proven against the simulator suites that do not import the api barrel that concurrent
row 48 currently leaves broken. Command output quoted verbatim.

Loadable simulator suites under the row-51 edits (includes the new proof file):

```
$ env CI=true npx vitest run --root packages/shared --maxWorkers=2 \
    test/sim-v2-parity.test.ts test/session-machine.test.ts test/sim-determinism.test.ts \
    test/sim-gap-closure.test.ts test/sim-faults-scenarios.test.ts test/sim-selector-stability.test.ts \
    test/audio.test.ts test/sim-store.test.ts test/sim-platform-neutral.test.ts \
    test/sim-mobile-additions.test.ts test/hash-chain.test.ts </dev/null
 Test Files  11 passed (11)
      Tests  199 passed (199)
```

The new proof file alone (falsifiable assertions for SH-05/06/07/08/10/25):

```
$ env CI=true npx vitest run --root packages/shared --maxWorkers=2 test/sim-v2-parity.test.ts </dev/null
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

Typecheck of the row-51 files (whole-package tsc is red only from row 48's api/** — see Persistent
Issues; zero errors attributable to this row):

```
$ npx tsc --noEmit -p packages/shared/tsconfig.json | grep -E "src/sim/|live/source/live-sim|sim-v2-parity"
(no output)   # 0 errors in row-51 files
$ npx oxlint <the seven src files + the test file>   # LINT_EXIT=0
```

### M2-SIM-1 (Simulated regression vs `c2c983b`, behaviour)

The five named suites are `sim-determinism`, `live-source-simulated-isolation`,
`sim-demo-data-alignment`, `sim-gap-closure`, `sim-selector-stability`. At the last clean baseline
(before row 48's mid-edit) all five were green: `Test Files 5 passed (5) / Tests 81 passed (81)`.
Under the row-51 edits, the three that can currently LOAD (`sim-determinism`, `sim-gap-closure`,
`sim-selector-stability`) stay green; `live-source-simulated-isolation` and `sim-demo-data-alignment`
currently fail to LOAD only because they transitively import the api barrel that row 48 has left with
an undefined `operatorId()` (`api/evidence.ts:222`) and an undefined `SealingProgressStepSchema`
(`api/state-slices.ts:203`). This is not a simulator-behaviour regression; it is the row-48 residue
named in the brief. The "simulator answers v2 shapes per OD-17" clause is asserted directly by
`sim-v2-parity.test.ts` (single audio track via `activeInputId`, mic switch, v2 sealing steps,
transcript stub).

### M2-SIM-2 (Simulated diff audit)

Rule as retired by OD-23: `git diff --name-only c2c983b..HEAD -- packages/shared/src/sim/` must list
only files owned by blueprint rows. Working-tree audit (my changes are uncommitted; the gate at row 56
runs it post-commit):

```
$ git diff --name-only c2c983b -- packages/shared/src/sim/
api.ts audio.ts auth.ts constants.ts evidence.ts faults.ts health.ts index.ts
initial-state.ts react.ts selectors.ts session-machine.ts store.ts types.ts vocabulary.ts
```

Every one of the 15 files is owned by an M2 blueprint row: rows 47 (SH-03/04/05/16/17), 48
(vocabulary audit types) and 51 (this row). No file outside the blueprint-owner set changed, and the
`live-sim.ts` seam is the single named exception outside `src/sim/`.

### SC8 replacement proof (OD-23)

```
$ grep -rn "simulator changes only through blueprint rows" packages/shared/src/sim/
packages/shared/src/sim/index.ts:8: * Change rule (task 3 OD-23, blueprint row 51): **simulator changes only through blueprint rows.**
```

The predecessor phrase "simulator untouched / additions only" now appears ONLY inside the sentence
that retires it (`index.ts:9`), never as a live rule.

## Simulated-mode behaviour parity vs `c2c983b`

The OD-23 rule change is intentional: the simulator is now extended for schema v2 rather than frozen.
Expected divergences from the `c2c983b` Simulated behaviour, all by design and each register-traced:

- **meters slice re-key** (SH-17/E-02, landed by row 47; this row completes the consumer at the seam):
  `audio.channels{AUDIO-01,AUDIO-02}` -> `audio.inputs{MIC-01,MIC-02} + activeInputId`. A v1 reader of
  `audio.channels` diverges intentionally; the compat maps `MIC_INPUT_OF_CHANNEL` /
  `CHANNEL_OF_MIC_INPUT` keep the demo controls, the CLIP latch and the timeline naming a channel.
- **sealing steps v2** (SH-01/SH-06): `FINALIZATION_ORDER` is now `FINALIZATION_STEPS_V2`
  (`CLOSE_TRACKS`..`STORE_SEALED_PACKAGE`); the v1 `FINALIZE_TRACKS`/`CALCULATE_HASHES`/`ENCRYPT_PAYLOAD`
  names are gone. Steps now also carry `progress`/`etaMs`/`attempt` (R-6 op 83).
- **session members** (SH-05/SH-06): a recording session gains `captureConfig` snapshot, `audioSource`
  pair and (on seal) a transcript stub. All optional, so pre-M2 states still parse.
- **evidence v2** (SH-07): a LIVE seal carries `files`/`fragmentChainHead`/`transcriptSha256`; the
  pre-built DEMO dataset items keep their byte-identical v1 shape (OD-02 L2 keeps tamper-demo hashes).
- **two new fault kinds** (SH-03): `MIC_SILENT` (warning, never switches) and `CAPTURE_FAULT`
  (critical) join the vocabulary in contract order (D-b).

Everything NOT listed above is unchanged from `c2c983b`: auth, pairing, storage, health series,
audit chain, event ring, the 16 §6.1 services, and the whole pre-existing Simulated journey.

## Persistent Issues

| Issue | Attempts | Root cause | Current status | Blocking? |
|---|---|---|---|---|
| Shared suite RED (39 files) + typecheck exit 2 during this row | observed across 3 runs | Concurrent row 48 mid-edit of `api/**`: `api/evidence.ts:222 operatorId is not defined`, `api/state-slices.ts:203 SealingProgressStepSchema` undefined, `sim/vocabulary.ts` gained 9 audit types (53->62) + `DeviceCommand.POE_CYCLE` + `CoreApiAccessCondition.SESSION_HOLDER` while `openapi.json` was not regenerated and `api-registry.test.ts`/`i18n-vocabulary-sync.test.ts` pins still read 53/4. All 38 load failures + both test failures trace to `api/**` / audit-type pins, none to `src/sim/`. | unresolved-by-this-row (owned by row 48 + row 50 openapi regen) | no for row 51's own proofs; yes for the M2 gate until row 48 lands |
| `SIM_SNAPSHOT_VERSION` not bumped 1->2 | 1 (reverted after measurement) | The value is checked against `meta.schemaVersion` (`store.ts:92`), which is the WIRE value pinned to `z.literal(1)` by the API MetaSlice (`api/state-slices.ts:124`, row 48) and read into `core_state.sim_schema_version` with a boot check (`db/mapping/rows.ts`, rows 49/52). Bumping it here alone regressed `sim-gap-closure` (snapshot no longer restores) and would break the Core boot check. | routed to controller: land the atomic bump (constant + wire literal + mapping/boot-check) with rows 48/49/52. Capture slices joined the snapshot as OPTIONAL keys (`store.ts ADDED_SNAPSHOT_KEYS`), so v1 snapshots still resume at version 1. | no (SH-10's timing half landed; version half is a cross-row atomic edit) |

## Notes / Decisions

- **switchAudioSourceTransition is a pure transition, not a wired `SimActions` member.** Adding a
  member to `SimActions` forces a matching entry in `live/source/bindings.ts` (a two-way mapped type)
  and in `api/sim-actions.ts` (the hosted-action table, register SH-18) — both outside this row's
  allowed set (row 48 owns them). The mechanism is complete and tested here; wiring the hosted action
  + Live binding lands with row 48's table. Same reasoning kept the seam edit minimal.
- **Silence raiser keys on `noSignal`, not a raw dBFS dip.** The demo's conversational noise floor is
  -52 dBFS, just under the -50 threshold, so a naive level check would fire on every speech pause. A
  genuine OD-11 warning means a dead input (e.g. after `MIC_NO_SIGNAL` on the active channel). The
  raiser is provided as a tested transition; the engine hook is deliberately not wired into the 20 Hz
  tick to avoid false positives in the demo (documented in the function).
- **New test file location.** `test/sim-v2-parity.test.ts` sits under `packages/shared/test/`, not
  `src/sim/`. It is a simulator-owned test (mirrors row 47's practice), collides with no parallel row
  (row 48 owns `api-*`/registry/openapi tests), and is required to make M2-SIM-1 falsifiable.

## Next steps

- Controller: coordinate the atomic `SIM_SNAPSHOT_VERSION` bump with rows 48/49/52 (wire literal +
  mapping/boot check), then flip the constant and the pin in `sim-v2-parity.test.ts`.
- Row 48: when `api/evidence.ts` / `api/state-slices.ts` / `api/sim-actions.ts` settle and
  `openapi.json` is regenerated (row 50), re-run the full shared suite; the M2-SIM-1 suites blocked
  only by the api load errors should return green with no further sim change.
- Row 55 (code review) / row 56 (M2 gate): run M2-SIM-2 post-commit.

---
*Generated: 2026-10-08 11:49*
