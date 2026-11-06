# FX-W (E-fix, web console) — progress

Row: FX-W of the E-fix pass (D201, ruling R3). Owner paths: `apps/core-web/**` (except the session-timeline note-label lines, FX-C) and `packages/shared/src/i18n/en/{dashboard,evidence,shell}.ts`.
Report: `gateway_check/11b_efix_web.md`. Status: **complete**.

| Time (WIB) | Milestone |
|---|---|
| 11:14 | Inputs read (D152, D197, D198, D201; 07a §20/§23; 07b E2E-W2-1). |
| 11:25 | Lane-3 probe (read-only): 13 items, all `NOT_RUN`, ring ATTENTION, every item joined to a bundled package by suffix (Core media ref `DEMO_PACKAGE`). |
| 11:27 | Before captures (`gateway_check/assets/11b_before_*`); all six defects reproduced with measurements. |
| 11:29 | Rollback copies of 11 files in `.cache/rollback/FX-W/` with `SHA256SUMS`. |
| 11:29-11:33 | Fix 1 (R3) + tests; mutations M1a-c caught. |
| 11:33-11:44 | Fixes 2, 3, 6 (evidence), 4 (ring), 5 (strip); dry checks on lane 3 (no commands). Strip wrap rule lost to the `flex-1` utility; moved to the stylesheet. Ring fit switched from layout box to canvas ink metrics after measuring each word's ink against the ring. |
| 11:45-11:52 | New tests: 4 new files with 24 tests, plus 2 new and 1 rewritten case in `live-dashboard-devices.test.tsx`; a real bug found by the component test (parent ref not attached when the child's layout effect first runs), fixed by resolving the ring root from the DOM. |
| 11:52-11:56 | Mutations M2-M6 (all caught); typecheck and lint exit 0. |
| 11:57 | First after set; the 1440 strip showed "Synchroniz…", so the ellipsis was scoped to sm/xs; the running full suite was stopped (stale) and M5 re-run. |
| 12:02 | Final after set on lane 3 (`11b_after_*`). |
| 12:03-12:07 | Typecheck exit 0, lint exit 0, full core-web suite 108 files / 1422 tests passed (exit 0, 178 s). Secret scan clean. Browser and profiles gone. |

## Decisions for the controller

- R3 implemented: Dashboard Test signal on `DIAGNOSTICS_RUN`, Restart on `DEVICE_MANAGE` (amends F63-1/D152 in code and docblock). Spec text outside this row's paths not edited.
- E2E-W1-3: the record's last verification shows on open in both modes (result, time, operator from the custody entry).
- E2E-W1-4: a joined bundled package counts as the item's metadata only when its evidence ID, session ID and case number equal the item's; otherwise the Core record + notice + labelled package documents. The D84 join and MS-2 stay unchanged. This also affects Simulated mode on any day but 1 Oct.
- E2E-W1-5: the fit applies to any state word whose ink crosses the inner ring. At 1440x900 that includes CRITICAL (−1.2 px) and UNKNOWN (−12 px); at 390x844 only ATTENTION; at 1920x1080 none.
- E2E-W1-6: the wrap and truncation apply below 1024 px only; wider tiers are unchanged.

## Incidents

- IN-FXW-1 (11:22): a README grep printed the published demo password (plus the README's pairing code and PIN) into this agent's tool output once; written to no file.
- IN-FXW-2 (11:25-11:36): the crashed first probe left its headless browser running (no sign-in); found, verified as this row's own, and stopped at 11:36. Driver hardened.

## FX-W2 (follow-up row)

Controller gate of FX-W: PASS (39/39 re-run). Status of FX-W2: **complete**.

| Time (WIB) | Milestone |
|---|---|
| 12:08 | Brief read; FX-W2 rollback copies (8 files) in `.cache/rollback/FX-W/fx-w2/` with `SHA256SUMS`. |
| 12:10-12:13 | W2-1: own-record rule in Live mode only; Simulated tests rewritten (re-dated row, simulator dated 2026-10-06); Live notice test unchanged. |
| 12:13 | W2-2: RESIDUAL-W70-1 comments updated (comments only, checked by diff). |
| 12:13-12:14 | W2-3: note drawer title and action subtitle by the signed-in role; new `live-session-note-role.test.tsx` (4). |
| 12:15 | Mutations W2-M1..M5 all caught. |
| 12:16-12:17 | Neighbours 18 files / 172 passed; shared 3 / 58; typecheck and lint exit 0. |
| 12:16-12:18 | Full core-web suite (`--maxWorkers=2`, load 4.67): 109 files / 1427 tests passed, exit 0, 127 s. |

Decisions: the own-record rule applies in Live mode only (controller ruling); the note action's subtitle follows the role as well as the drawer title; the neutral fallbacks are "Session note" / "Add a session note".

