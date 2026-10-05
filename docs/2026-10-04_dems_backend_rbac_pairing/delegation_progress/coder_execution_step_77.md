---
task_id: 2026-10-04_dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_step: 77
plan_row: W55
status: complete
report: implementation/55_web_login.md
---

# Step 77 (plan row W55): Web Login, server sign-in in Live mode

Parallel run: this file stands in for `delegation_progress_report.md`, `status_tasks.md`,
`masterplan/02_plan.md` and `implementation/99_implementation_report.md`, which this row did not
write. Times are WIB on 2026-10-04.

## Status after the follow-up (decision D128), 21:55

**complete.** The controller accepted the build (D128) and granted two changes outside the row's write
paths; both are made, nothing else was touched outside the row's paths:

1. `apps/core-web/src/test/live-runtime-startup.test.tsx:398-399`: the closed comparison now allows the
   shell's own marker `dems.shell.intro`, with one comment line saying why.
2. `apps/core-web/src/routes/__root.tsx:26` (import) and `:80` (effect): the root route installs
   `followServerPresentationMode(live)` for a Live source and returns its clean-up. In the row's folder
   the function now returns that clean-up (`live-adapter.ts`), and the Login page's own installation is
   removed (`index.tsx`): exactly one place installs it. Finding F77-3 is closed. The one line was enough.

New test file: `apps/core-web/src/test/live-login-presentation.test.tsx` (5 tests); one static test added
to `live-login-model.test.tsx` (25 now).

Gate of the follow-up, 21:53:50 to 21:55:04 (1-minute load 7.84 at the start):
`npm run test -w @dems/core-web -- --maxWorkers=2` exit 0, **55 files / 758 tests, all passed** (this
row: 4 files / 77; every other file: 51 / 681, none red); typecheck exit 0; lint exit 0 without a
warning. Mutation check of the changed lines, in memory: 11 of 11 detected. No lane run (none needed);
no listener on 4423, 5178, 9398. Report: `implementation/55_web_login.md` section 21;
`assets/55_followup_gate.log`.

For the plan's tracking table (row W55): status done; note "D128 follow-up made: W50's assertion
relaxed by one line; the root route installs the presentation follow-up (F77-3 closed)".

Files of the follow-up: `apps/core-web/src/test/live-runtime-startup.test.tsx` (granted),
`apps/core-web/src/routes/__root.tsx` (granted), `apps/core-web/src/features/login/live-adapter.ts`,
`index.tsx`, `sim-adapter.ts` (comment), `apps/core-web/src/test/live-login-presentation.test.tsx` (new),
`apps/core-web/src/test/live-login-model.test.tsx`, the two documents, `assets/55_followup_gate.log`,
`assets/55_mutations.log` (appended), `assets/55_mutations_runner.py.txt` (updated).

## Status at the hand-in (21:43), kept as written

**needs-review.** The row is built and verified. One test outside the row's paths is red by the
row's own change, and needs a one-line change that is the controller's to assign:

- `apps/core-web/src/test/live-runtime-startup.test.tsx:398` (W50's file):
  `expect({ ...window.sessionStorage }).toEqual(before.session)` →
  `expect({ ...window.sessionStorage }).toEqual({ ...before.session, 'dems.shell.intro': '1' })`.
  Cause: [CS] §5.4 tells this row to hand off when a session the page did not submit is found. That
  test signs in by calling the action beside a mounted Login page, so the shell is mounted now and
  writes its own marker. The two assertions that are the criterion (AC-C-21, lines 396-397) pass.
  Report section 13.

## For the plan's tracking table (row W55)

| Field | Value |
|---|---|
| Status | needs-review (one line of a W50 test; everything else done) |
| Notes / Issues | Server sign-in through the Live source in the Login page; 401 and 423 as the simulator's union; a 429 as the limit toast with the form put back; no security key, the plain sentence and no role chip, the Live trust line, the public device strip, the arrival notices, the mode selector. Lane 3 check 21:15:10 to 21:15:32, HeadlessChrome/153.0.8010.12: wrong password refused, sign-in through the form, cookie `HttpOnly` and not in `document.cookie`, no `ses_` value, `dems.auth` not written |

## Files created or updated

Production (`apps/core-web/src/features/login/`):

- changed: `use-login-controller.ts`, `auth-card.tsx`, `login-alert.tsx`, `device-strip.tsx`,
  `index.tsx`, `login-model.ts`, `sim-adapter.ts`, `report.ts`, `login.css`
- new: `login-live-model.ts`, `live-adapter.ts`, `use-mode-switch.tsx`, `mode-selector.tsx`

Shared: `packages/shared/src/i18n/en/login.ts` (changed, additive: the group `login.live`, 15 strings).

Tests (new): `apps/core-web/src/test/live-login-signin.test.tsx` (17), `live-login-page.test.tsx` (30),
`live-login-model.test.tsx` (24): 71 tests, all green.

Gate at 21:37 to 21:40: `@dems/core-web` 54 files / 752 tests, 751 passed, 1 failed (the assertion
above); typecheck and lint exit 0. `@dems/shared` 68 files / 1,814 tests, typecheck and lint exit 0.
`@dems/mobile` typecheck exit 0. Mutation check: 68 of 68 detected on the final tree.

Documents: `implementation/55_web_login.md`; `implementation/assets/55_*` (the baseline log, the
lane script, driver, log and browser record, five screenshots, the gate log, the mutation runner,
its configuration and its logs); this file.

Scratch (git-ignored): `.cache/w55/`, `.cache/rollback/W55/`.

## Blockers

None for the work of the row. The one open item is the red assertion above.

## Decisions for the controller (report section 18)

1. The red assertion of W50's test: keep the page as the specification says and change line 398,
   or narrow the page.
2. After a 429 the typed password is put back (LB-10 beside AC-C-44).
3. The rows of the Live disclosure keep the display name and the initials of the shared constant.
4. Where the presentation follow-up is installed (a reload inside the shell is not covered: one line
   in the root route or the shell).
5. Two copies of the mode-change confirmation (W54's `useModeSwitch` and the Login page's): unify
   after both rows are gated.
6. The hand-off that is taken back when the session ends before the page was left.
7. A 500 on sign-in is worded by the presenter's toast, not by the offline Alert.
8. A Core server that is starting blocks Sign In on the health answer.
9. The offline Alert in Live mode keeps its existing words with the page's own address.
10. The footer's "v2.4.1" on a Live page is the console's constant, not the Core's version.

## Not this row's, seen while it ran

- 21:00:30 `tsc -b` of `@dems/core-web`: TS7031 at `src/test/live-shell-notices.test.tsx(407,39)`
  and `(408,40)` (W54's file). Gone at 21:13:14.
- 21:25:19 `tsc --noEmit` of `@dems/mobile`: TS2345 at
  `src/features/pairing/pairing-live-model.test.ts(101,80)` (a mobile row's file). Gone at 21:32.
- About 21:16: listeners on 5178 (pid 24805) and 9398 (pid 24814), started by another row inside
  the lane lock after this row's check had ended with no listener. Not touched.
