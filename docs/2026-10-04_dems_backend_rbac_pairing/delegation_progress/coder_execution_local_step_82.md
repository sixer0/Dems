---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution-local
blueprint_row: 82 (plan W60, mobile pairing gate)
date: 2026-10-05
status: complete
gate: CLG
decision_refs: [D124, D129, D137, D138, D141]
ledger_after: "@dems/mobile 94 suites / 1,230 tests (+23 tests, +2 files over the 1,207/92 floor)"
---

# coder-execution-local progress: step 82 (W60) — the mobile pairing gate

Status: **complete**. The gate is built, typechecked, linted, tested (route + fake-transport), mutation-
checked out-of-tree, and shown on the lane-1 phone end to end: an unpaired device held on `/pair` in LIVE
mode, `/login` unreachable while blocked, pairing with a lane-1 code releasing into Login, and the LIVE
sign-in reaching Home on the now-paired phone (the evidence D138 transferred here from W59). The app was
left in SIMULATED mode as found; `dems_lane_2` untouched; no process/listener/reverse-rule/pid left.

## Files created or updated (all inside the owned write paths)

- `apps/mobile/src/navigation/root-navigator.tsx` — the `blocked` rule in the root stack (`(auth)` =
  `!isAuthenticated && !blocked`, `(app)` = `isAuthenticated && !blocked`, `dev-gallery` guarded by
  `!blocked`; `index`/`stack-check`/`pair` unguarded), and the boot router returning `/pair` first while
  blocked. The gate reads `isPairingBlocked(usePairing())` (MP-11); inert outside LIVE (AC-C-74).
- `apps/mobile/src/navigation/testing/router-harness.tsx` — additive: `FakeRuntime` carries an optional
  `pairing` and a `setPairing()` setter threaded through `createRuntimeContract`. Existing fakes unchanged.
- `apps/mobile/src/navigation/__tests__/pairing-gate.test.tsx` — NEW, 19 route tests.
- `apps/mobile/src/navigation/__tests__/pairing-gate-live.test.tsx` — NEW, 4 fake-transport tests.
- `docs/.../implementation/60_mobile_pairing_gate.md` — the row's document.
- `docs/.../implementation/assets/60_*` — screencaps, run logs, device scripts, mutation script.
- This file only under `delegation_progress/`.

Not touched: `app/_layout.tsx`, `app/(app)/_layout.tsx` (needed no change), `auth/**`, `features/**`,
`packages/shared/**`, `mock-core/**`, `release/**`, `app.json`, `pending-href.ts` (MP-12 "as today").

## Measured totals

| Check | Result |
|---|---|
| `npm run test -w @dems/mobile -- --maxWorkers=2` | exit 0 — **94 suites / 1,230 tests** (floor 1,207/92; +23/+2) |
| Existing guard tests | unchanged; absent from `git diff --stat acaff20`; `guard.test.tsx` hash `df66f10…` |
| `npm run typecheck -w @dems/mobile` | exit 0 |
| `npm run lint -w @dems/mobile` | exit 0 |
| Mutation (M15, out-of-tree) | 8 mutations of the gate logic: **7 detected**, G06 equivalent-by-analysis; tree restored identical (sha `831a5230…`) |

## Device check (lane 1, dems2_phone / emulator-5554)

Inside the lane lock + `device-session.sh phone`. Standard lane reset of `dems_lane_1` at start only;
`dems_lane_2` never touched. Keyguard/fingerprint/security untouched (never exit 77; biometric-enable
dialog not pressed). Screencaps in `assets/`: unpaired-LIVE held on `/pair`; `/login` blocked → `/pair`;
release into Login with the LIVE trust line "paired as DEV-0001"; paired Pair view; **signed-in Home**
(`POST /api/v1/auth/sign-in 200`). Pairing redeem 201; issued code counted 0 everywhere; no credential
lines in either log. App left SIMULATED; credential entry still listed; cleanup verified clean.

## Findings / deviations / decisions (see the document §8–§10)

- F-1 uiautomator cannot dump the animated screens → field centres from pixel analysis.
- F-2 Gboard handwriting coach steals the first field's focus → dismiss via its Cancel button, never BACK.
- DV-1 the D138 LIVE sign-in needed a follow-up session on the already-paired phone (environment, not product).
- DN-1 accept the split device evidence (or request one continuous session). DN-2 leave lane 1 paired.
  DN-3 ledger now 1,230/94.

## Next steps

- Controller to rule on DN-1/DN-2/DN-3.
- W61+ may build on the released gate; the pending-link and revocation-return behaviours are locked by
  the new route tests.
