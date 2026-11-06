# coder-execution — step 85, plan row W63 (web Dashboard in Live mode, site B-7)

Status: **complete** (22:45 WIB). Report: `implementation/63_web_dashboard.md`.

The stream stalled at about 20:40 and the row resumed at 22:23. What the resume check found: all four edited
files were whole (no half edit), `npm run typecheck -w @dems/core-web` exited 0, and the protected
`apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx` was byte-equal to `b90a3c6`
(`git hash-object` `1ab07579…`, W01b's state).

## Gate (all quoted in the report, section 6)

| Item | Result |
|---|---|
| core-web suite (22:39:46) | 62 files / 849 tests, exit 0. The first run at 22:32 had 4 red tests in W64's `live-session-new-create.test.tsx`; they were green on the re-run |
| shared suite (22:34:00) | 68 / 1,814, exit 0 |
| typecheck, lint (core-web, shared) | exit 0 each |
| CLG (a) | `dashboard-model.test.tsx` absent from the diff to `acaff20`; `dashboard.test.tsx` = W01b's hash; both pass |
| CLG (b) | `live-dashboard-devices.test.tsx`, 13 tests (B-7 success, 403 by `notPermitted`, 409, outage, link down, 429, pending, Simulated control) |
| CLG (c) | `grep` finds no `useSimActions` and no `.actions` in the folder's production files; a static test holds the rule |
| CLG (d) | lane 3, about 100 s over three runs, 6 screenshots; 4423, 5178, 9398 free afterwards |
| M15 | 21 mutations, applied in memory: 20 detected, 1 equivalent survivor (P14) |

## Lane check (22:28:52 to 22:31:55)

Run 1 (79 s): Live as the seeded SUPERVISOR through the form. The Dashboard showed server data and the kebab
was disabled for that role; the Core answered 403 NOT_PERMITTED for operation 48. Then the seeded TECHNICIAN
signed in through the form: Test signal on MIC-01 answered 204 with the toast "Test signal sent to MIC 1", and
Restart on CAM-02 answered 204 with the toast "Camera 2 restart requested". No console error. Run 2 aborted
after 3 s; it changed nothing on the lane. Run 3 (20 s) was Simulated only, signed in through the simulator's
stored sign-in: menu showed "(simulated)", no request to `/api/v1`.

## Files

Modified: `apps/core-web/src/features/dashboard/{devices-panel.tsx, active-session-panel.tsx, sim-adapter.ts,
panel-boundary.tsx}`, `packages/shared/src/i18n/en/dashboard.ts` (additive). New:
`apps/core-web/src/features/dashboard/report.ts`, `apps/core-web/src/test/live-dashboard-devices.test.tsx`,
`apps/core-web/src/test/live-dashboard-page.test.tsx`, `implementation/63_web_dashboard.md`,
`implementation/assets/63_*` (17 files). Pre-images: `.cache/rollback/W63/`.

## For the controller

Contract gap: CONTRACT-GAP-W63-1 (operation 49 has no `notPermitted` 403 example). Findings F63-1 to F63-7,
deviations DV-1 to DV-7 and five decisions are in report sections 8 to 11.
