# CF-W (web closing fixes) — delegation progress

- Agent: coder-execution
- Date: 2026-10-06, 13:39-14:25 WIB
- Status: **complete**
- Report: `gateway_check/12c_cf_web.md` (evidence, measurements, ledger); screenshots and logs `gateway_check/assets/12c_*` (42 files)

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 13:39 | Load 3.10; lane 3 web 5178 and Core 4423 confirmed listening (`lsof`); nothing started or stopped |
| 13:41 | Read-only probe: 14 lane-3 items, all media `DEMO_PACKAGE`; EV-20261006-0014 carries the R-W stop reason |
| 13:42-13:43 | Before captures (code untouched): custody 472 in 441 at 1440 (31 over), 472 in 375 at 1280 (97 over, Detail 0 px visible), 631 in 631 at 1920; Live Media tab "...Its record comes from the simulator." beside "Core record" |
| 13:44-13:50 | Design probe and prototype in the driver's page only: four columns cannot fit 1280 without "superviso/r"; 1440 fine with four |
| 13:51 | Rollback copies + `SHA256SUMS` in `.cache/rollback/CF-W/` |
| 13:54 | Tests written first: 8 / 8 fail before the fix |
| 13:55-14:10 | Fixes: fixed table layout + `<wbr>` + stacked below 26rem (+ phone step below 20rem); Media tab follows the mode |
| 14:02-14:06 | Full suite run 1: 111 files / 1,435 passed (superseded by the phone-width step) |
| 14:10-14:12 | Mutations on the final code: 16 / 16 caught (R-W-1 12, O-RT-1 4); baseline passes; tree hashes unchanged |
| 14:13 | Typecheck exit 0; oxlint 0 warnings / 0 errors |
| 14:13-14:18 | Full suite run 2 on the final code: **111 files / 1,436 tests passed**, exit 0 (load 11.08 -> 8.00) |
| 14:18-14:19 | After captures: overflow 0 at 1280 / 1440 / 1920 (and 1024, 390); date and clock 1 box each; Live Media tab "No DEMO package for this item: the Core server's record only." |
| 14:20 | Secret scan 44 files (24 PNG as bytes): 0 hits; no CF-W browser or profile left |

## Files

Created: `apps/core-web/src/features/evidence/__tests__/cf-web-custody-media.test.tsx`, `apps/core-web/src/test/live-cf-web-media.test.tsx`, `gateway_check/12c_cf_web.md`, `gateway_check/assets/12c_*` (42), this file, `.cache/rollback/CF-W/*`.
Modified: `apps/core-web/src/features/evidence/integrity-tab.tsx`, `evidence.css`, `media-tab.tsx`, `detail-page.tsx`.
Not modified: `packages/shared/src/i18n/en/evidence.ts`, `apps/mobile/**`, any shared tracker (`status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`): parallel run, the controller synthesises them.

## Decisions (for `decisions/decisions.md`)

- **D-CFW-1:** custody table: fixed layout at every width; `<wbr>` after each `_` of an action code; below 26rem of card content (1280 layout) the Detail goes under the action; below 20rem (phone) the actor too; headings hidden visually only (assistive technology keeps four columns).
- **D-CFW-2:** O-RT-1 reuses `evidence.live.noPackage` (the preview card's sentence, D158) and `evidence.live.mediaUnavailable`; the shared i18n file is not edited. An edit there would very likely full-reload four consoles and, through Metro, the device apps during CF-M1's crash loops.
- **D-CFW-3:** the O-RT-1 before/after on lane 3 rewrites one operation-40 answer in the driver's own browser (`DEMO_PACKAGE` -> `NONE`) because no lane-3 item answers `NONE`; the Core is untouched.
- **D-CFW-4:** the full suite ran twice: run 1 was superseded by a code change, run 2 is on the final code.

## Blockers

None.

## Observations

- O-CFW-1: with operation 40 unavailable, the header still placeholder says "No DEMO media" (`detail-page.tsx:203`); pre-existing, cosmetic.
- O-CFW-2: at 1440 the Detail column is 112 px (7 lines for the 66-character repro reason); it fits and keeps every word whole. Raising the stack query to about 28rem would stack 1440 too.
- O-CFW-3: a CF-M1 headless shell (`cf-m1-phone-w1-profile-*`) was running at 14:19; it was not touched.
