---
task_id: 2026-10-07_dems_real_capture_sealing
row: 73 (M5-W3, tablet/phone mic UI + B15)
date: 2026-10-09
agent: coder-execution (driver, parallel wave D94 / D95)
status: needs-review
note: implementation/32_m5_mobile_mic.md
---

# Row 73 — delegation progress

**Status: needs-review.** Software complete against the registry, the simulator and the Live binding on
the fake transport. Not proven: the real Core route of op 81 and its audit row (rows 66/71), any
device or emulator run, the B11 measurement (gate), the layouts on a real screen.

## Files (all under `apps/mobile/src/`)

New:
- `features/session-live/mic-source-model.ts`
- `features/session-live/use-mic-source.ts`
- `features/session-live/mic-source-controls.tsx`
- `features/session-live/mic-source-model.test.ts`
- `features/session-live/mic-source.test.tsx`
- `features/session-live/live-mic-source.test.tsx`
- `features/dashboard/home-mic-tiles-live.test.tsx`

Changed:
- `features/session-live/mic-card.tsx` (Active/Standby chip, border, `SelectionGlow`)
- `features/session-live/session-live-screen.tsx` (mount of `MicSourceControls`, `RecLabel`, one style)
- `features/session-live/rec-indicator.tsx` ("Connecting cameras…")
- `features/session-live/i18n.ts` (+1 key `connecting`)
- `features/session-live/testing/live-monitor-bed.tsx`, `testing/monitor-harness.tsx` (MB-13)
- `features/dashboard/home-model.ts`, `use-home-data.ts`, `device-tiles.tsx` (MB-01, B15)
- `features/dashboard/home-model.test.ts` (+2 tests), `features/dashboard/testing/live-home-bed.tsx` (MB-13)

Docs: `implementation/32_m5_mobile_mic.md`, this file.

Not touched: `packages/shared/**`, `apps/mobile/src/i18n/**`, `features/session-new/**`, row 62's
`runtime/session-diagnostics.ts` and `app/(app)/session/live.tsx`, web, server, worker. No commit, no
lockfile, no new dependency, no request line in `file_requests.md`. `masterplan/02_plan.md` and
`status_tasks.md` not edited.

## Results

- `npm run typecheck -w @dems/mobile`: exit 0. `npm run lint -w @dems/mobile`: exit 0 (1 warning, `runtime/log.test.ts:160`, not this row).
- jest `--maxWorkers=2`, touched folders + runtime guards: 33 suites, 274 tests passed; the 14 static guard files: 125 passed.
- Negative controls: 5 mutations -> 12 + 2 tests red; files restored and compared.
- Red, not this row's: `features/capture-selector/capture-selector.test.tsx:145` (1 test).

## For the controller

1. B11 "result applied" is only the structural half; there is no measurement yet (note §3).
2. One assertion is marked `ROW-71` in `mic-source.test.tsx` (audit keys, D105) (note §5 item 2).
3. Decisions D-73-1 .. D-73-7 (note §7): refusals classified before the mobile presenter; link-down state; "— dBFS"; role source; bed change.
4. Device flows T-MIC, P-MIC, H-MIC for the M5 gate (note §6), incl. a layout check this row could not do.
5. Not built: the 2 s "Input interrupted — verifying" state, the development-source badge, "Connecting cameras…" outside the monitor, the dev gallery panel (note §3).
