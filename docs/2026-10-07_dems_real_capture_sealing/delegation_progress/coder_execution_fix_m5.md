# coder-execution — fix pass F-M5 (review row 74 + R63-03 + F-M6's request)

Status: **complete, needs-review** (R74-08 and R74-14 (2) open; R74-14 (1) wiring untested). Note:
`implementation/112_fix_m5_review.md`. No commit, no migration, no OpenAPI change.

## Files

Shared: `packages/shared/src/sim/{capture-session,session-machine,api,faults,selectors,capture-telemetry,index}.ts`,
NEW `sim/capture-fault-wording.ts`, `i18n/en/common.ts` (appended block `captureFault`),
tests NEW `sim-m5-review.test.ts`, NEW `sim-m5-fault-wording.test.ts`, `sim-v2-parity.test.ts`.

Core: `src/capture-session/index.ts` (+ db test), `src/capture/forwarder.ts`, `src/capture-notices/session-start.ts`,
`src/engine/capture-session.ts`, `src/engine/host.ts` (rehydrate capture block), `src/modules/sessions/index.ts`,
`test/support/capture-stub-worker.mjs`; tests NEW `capture/__tests__/{forwarder-advisories,fault-wording}.test.ts`,
`capture/__tests__/{fault-lifecycle,ipc}.test.ts`, `capture-notices/__tests__/session-start.test.ts`,
`engine/__tests__/capture-session-parity.test.ts`.

Mobile: `features/capture-selector/capture-notices-model.ts`, `session-live/capture-start-notice.tsx`,
`session-recovery/session-recovery-screen.tsx`, `dashboard/home-header.tsx`; tests
`session-live/{situation-c,mic-source}.test.tsx`, `session-recovery/failed-start.test.tsx`,
`dashboard/session-start-home.test.tsx`.

Web: `features/session-monitor/__tests__/audio-source.test.tsx` (one pin; no product file).

## Results (each once; a second run only after a fail)

| Check | Result |
|---|---|
| `npm run test -w packages/shared` | 99 files / 2454 passed (second run: the first had 1 red, the R-4 rule I then kept as pinned) |
| shared typecheck, lint | 0 / 0 |
| core unit: forwarder x3, fault-lifecycle, fault-wording, ipc, capture-notices, parity, modules/sessions | 15 files / 324 passed |
| core db (`lockf .locks/db-migrate.lock`): `src/capture-session` | 41 passed (earlier runs: the app did not boot — another pass's route; then "the database does not answer" until the new rigs were closed per case) |
| core db: capture-notices, engine restart + capture-actions, modules/sessions, capture boot | 9 files / 89 passed |
| core typecheck | 2 errors, both `capture/__tests__/records.test.ts` (F-M3 in flight) |
| core lint | 0 errors; 2 warnings in other passes' files |
| mobile jest `--maxWorkers=2`: session-live, session-recovery, dashboard, capture-selector, sessions, session-new | 77 suites, 610 tests green after the `mic-source` pin was aligned (session-live rerun: 23 / 186) |
| mobile typecheck, lint | 0 errors (1 warning, `runtime/log.test.ts`, not mine) |
| web vitest session-monitor + dashboard; typecheck; lint | 11 files / 99 passed; 0; 0 |

## Checks for the test runner

1. `npm run test -w apps/core-server` — expect green except the static pins of other passes named in the note §5.
2. `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w apps/core-server` (sandbox off).
3. `npm run test -w apps/core-web`; `npm run test -w apps/mobile -- --maxWorkers=2`.
4. `npm run test -w packages/shared`, `npm run test -w packages/capture-protocol`.
5. Heavy (`.locks/heavy-host.lock`): the worker e2e of rows 71a / 86 against the changed forwarder and the stub — FAKE sources only (D163).

## Device / browser checks left for the gate (scripted flows)

- Simulated lane: two failed starts in a row (two alerts, each with its time); three microphone switches and the Monitor band; demo clear during a failed start.
- Real lane, FAKE sources: one camera of two not connecting = one WARNING, no critical alert; a microphone helper killed mid-recording = an alert that says "stopped delivering audio"; Core shutdown mid-start leaves no helper process (`CAPTURE_HELPERS_LEFT` not raised at the next start).
- Phone: a failed start first seen while another client closes it.

## Decisions for the controller

1. R-4 kept as "the fault of a failed start is ended by the NEXT start" (failed or not), not "with its session": the other choice moved an existing pinned test (`sim-capture-start.test.ts:215`). Say if it should be cleared with the session.
2. Erratum ev §B.5: `missingSamples` per interval (note §4.1). R74-04 closed by the audit extract meanwhile.
3. Erratum of the D142 (1) / D144 (5) sentence (note §4.2).
4. The in-app simulator writes no `sendingDeviceId` on `AUDIO_SOURCE_SWITCHED` (SEC35-17 asks for it when a device sends): add it from the pairing state?
5. `FRAGMENT_SIZE_BOUND_REACHED` has a sentence but no shared advisory notice: who raises it (a fourth `CaptureAdvisoryReason`, `capture-notices.ts` is not in this pass).
6. `CAMERA_NOT_CONNECTED` is no fault any more (WARNING through the notices unit, only once the session records). Confirm.
7. The engine's failed start now writes `reason` / `evidenceFiles` on its own FAULT_RAISED row (the copy is gone).
8. The sessions module registers one `onClose` hook (its header said "no hook").
9. R74-08 (one chain) and R74-14 (2) (file as well as row at rehydrate) need a row of their own.
