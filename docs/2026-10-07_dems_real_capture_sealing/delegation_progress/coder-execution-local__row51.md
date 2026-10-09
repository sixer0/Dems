# coder-execution-local - row 51 (M2-W9 simulated v2 parity, tier 3)

Status: **COMPLETE** for the in-scope simulator work; one sub-item (SIM_SNAPSHOT_VERSION bump) routed
to the controller as a cross-row atomic edit. Date: 2026-10-08. Dependency row 47 verified satisfied
before start (its artifact `implementation/14_m2_shared_contract.md` + progress read; row 47 left the
SH-08 behavioural re-key to this row).

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/implementation/17_m2_simulated_parity.md`
(Tier 3) plus this note. Edits confined to `packages/shared/src/sim/**` and the single
`live-sim.ts:902-905` seam. No file under `packages/shared/src/api/**`, `apps/**`, `apps/mock-core`,
`release/`, or any controller tracker was touched. No commit, no push, no DB contact, no sudo, no
Homebrew write.

## What landed (register rows closed)

- SH-05/SH-06 — session machine: `startRecording` snapshots the selector (`captureConfigSnapshot`) and
  opens the active/standby mic pair (`audioSourceAtStart`); `advanceStopping`/`advanceFinalization`
  report per-step `progress`/`etaMs`/`attempt`; new pure `switchAudioSourceTransition` (op 81) moves
  `audio.activeInputId`, records the interval boundary (media-pts), writes an `AUDIO_SWITCH` timeline
  item and one `AUDIO_SOURCE_SWITCHED` audit row carrying the sending device id (E-30). Idempotent.
- SH-07 — evidence v2: a live seal carries `files` (one whole file per camera + the single AUDIO-01),
  a package `fragmentChainHead` and a `transcriptSha256`; pre-built dataset items keep their
  byte-identical v1 shape (OD-02 L2).
- SH-08 — OD-11 silence warning: `maybeRaiseMicSilentWarning` raises `MIC_SILENT` after the active
  input is dead for 10 s during RECORDING and NEVER switches the active input; `describeFault` and
  `faultTargetKey` extended for `MIC_SILENT`/`CAPTURE_FAULT`.
- SH-10 — constants: sealing-driver timing + silence constants added; SIM_SNAPSHOT_VERSION documented
  (bump routed, see below).
- SH-25/E-02 — the `live-sim.ts` `onMeters` seam maps the re-keyed meters frame field-by-field instead
  of a blind cast.
- OD-23 — SC8 "simulator untouched" rule retired; `src/sim/index.ts` now states "simulator changes only
  through blueprint rows".

## Verification (must be able to fail; quoted in the artifact)

- New falsifiable suite `test/sim-v2-parity.test.ts`: 10/10 pass.
- Loadable simulator suites under the edits (incl. the new file): 11 files / 199 tests pass.
- tsc filtered to row-51 files: 0 errors; oxlint on those files: exit 0.
- M2-SIM-1 five named suites were green at the last clean baseline (5 files / 81 tests); three still
  load+pass now, two are blocked from LOADING by concurrent row 48's api/** breakage (not sim behaviour).
- M2-SIM-2 audit: the 15 changed sim files all map to blueprint rows 47/48/51; live-sim seam is the one
  named exception outside src/sim/.

## Residual caused by concurrent row 48 (NOT this row)

Full shared suite is RED (39 files) and root typecheck exits 2 while row 48 has `api/evidence.ts:222
operatorId is not defined` and `api/state-slices.ts:203 SealingProgressStepSchema` undefined, plus
`sim/vocabulary.ts` gained 9 audit types / POE_CYCLE / SESSION_HOLDER with `openapi.json` not yet
regenerated and the registry/i18n pins still at 53/4. Every failure traces to `api/**` or audit-type
pins; none to `src/sim/`. Owned by row 48 (+ row 50 openapi regen). Board note posted to main.

## Routed to controller

- `SIM_SNAPSHOT_VERSION` 1->2 (SH-10) cannot land inside this row alone: it is checked against the wire
  MetaSlice `z.literal(1)` (`api/state-slices.ts:124`, row 48) and the Core `sim_schema_version` boot
  check (`db/mapping/rows.ts`, rows 49/52). Bumping it here regressed snapshot resume in
  `sim-gap-closure`. Needs an atomic bump across constant + wire literal + mapping/boot-check. The two
  capture slices joined the snapshot as OPTIONAL keys, so v1 snapshots still resume at version 1 meanwhile.

## Anti-hang compliance

Every suite ran non-interactively: `CI=true` + vitest run mode + `--maxWorkers=2`, stdin closed
(`</dev/null`), long runs as tracked background processes with a wall-time cap. No watch mode, no stdin
wait, no polling loop. `timeout`/`gtimeout` are absent on this host, so bounded runs used the background
process monitor's wall-time cap instead.
