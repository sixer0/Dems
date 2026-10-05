# Progress: coder-execution, step 76 (plan row W54, web shell, navigation, admin routes)

Status: **needs-review** (2026-10-04; the first recorded time of this row is 20:34 WIB)

Document: `implementation/54_web_shell_admin_routes.md`. Evidence: `implementation/assets/54_*`.

## Timeline

| Time | What |
|---|---|
| until 20:34 | Inputs read: the row W54, the citation convention and the gates SG and CLG of `masterplan/02_plan.md`; the client spec §3.2, §3.3, §3.5, §6.1 to §6.5, §10.1 to §10.3 and the IDs the row names; `implementation/50_web_runtime_mode.md` (the surface, section 20, the lane scripts); `implementation/44_live_source.md` §17.4 and §18.4; the shell folder, the runtime's surface, the harness |
| 20:34 | Pre-images saved under `.cache/rollback/W54/` (the patch against `acaff20` is 0 bytes: no earlier row had changed the files). Baseline: `npm run test -w @dems/core-web -- --maxWorkers=2` exit 0, 48 files / 598 tests |
| 20:40 to 20:53 | Production: the words (`shell.ts`, two namespace files, `index.ts`), the navigation table, the mode switch, the indicator, the notices, the navigation group, the "Live mode only" state, the two call sites, the routes and their guard, the page stubs, the Stack Check line. The router plugin regenerated `routeTree.gen.ts` (42 added lines). Typecheck and lint exit 0; the existing shell and runtime tests green (20:53) |
| 20:52 to 20:54 | **Controller's grant (decision D126)** for `packages/shared/test/i18n.test.ts`: pre-image saved, three lines changed (two entries of the pinned list, the number in the title). No other test pins the list |
| 20:54 to 21:05 | The three test files. First findings from them: a toast of the previous test outlives it (the queue is one per page); the link notice flashed when another tab's sign-in rotated the session (the socket is closed with 4401 while the tab stays signed in), so a socket the Core ended is no longer a lost link; the role notice lacked its second sentence when the delta of `operators` arrived before `session.updated`, so both sources are watched |
| 21:05 | Interim gate: web 52 files / 690 tests, **1 failed: `live-runtime-startup.test.tsx:398` (W50's test; red by the Login row's change of 21:00:06, finding F76-1)**; shared 68 / 1,814 exit 0; typechecks and lints exit 0 |
| 21:09 | A `grep -n` of this row over the seed source printed the line of the constant `DEMO_OPERATOR_PASSWORD` to this agent's tool output (deviation D-13). Nothing was written to a file, log or document; checked by a count over everything this row wrote: 0 |
| 21:10:16 to 21:11:29 | **Lane check, first full pass** (lane 3, inside `lockf`): all steps as wanted, and two layout problems seen on the screenshots: the top bar had no room for the chip at 1440 px (the wordmark cut, the tagline under the date), and the sidebar's footer met the rail toggle with the two new entries |
| 21:16 to 21:23 | The top bar measured in the browser (21:16:00 to 21:16:27); the date yields to the indicator; the footer keeps its height beside ADMINISTRATION; a layout pass on the lane (21:22:27 to 21:23:14) |
| 21:24:40 to 21:26:41 | **Lane check, final full pass on the finished code**, with the layout at eleven window sizes. 23 screenshots in all. Nothing left listening on 4423, 5178, 9398 |
| 21:27:57 to 21:28:20 | Phone widths measured; the clock yields below 432 px (496 px in Live mode) |
| 21:20 to **22:05:15** | Mutation check (M15, in memory): the table reached **137 mutations in 18 modules**; the recorded passes are 57 → 55 detected / 2 survived (`T02`, `G05`) at 21:51:11, 59 → 55 detected / 4 survived (`W11`, `N36`, `N39`, `N40`) at 22:01:15, then re-tests of 2 (T02, N36 detected) at 22:02:50 and of 9 (all detected) at **22:05:15**, where the break (D130) came. No recorded pass covered all 137. The record sat in git-ignored `.cache/w54/mut/` only; it is now `implementation/assets/54_mutation_record.txt`. The four survivors with no re-test were re-run on 2026-10-05 (0 detected / 4 survived) and each is closed as an equivalent mutant by measurement — document section 17, `assets/54_mut_probe_evidence.log`. A full pass over all 137 followed the same day (12:02:41→12:46:26): **133 detected, 4 survived (the same four), 0 not applied** — `assets/54_mut_full_run.log`, document 17.5 |
| 21:29 to 21:42 | The Login row's own copy of the mode switch read (finding F76-4); a rejected switch handled and logged; the indicator's two forms share one set of attributes; tests added for what the first mutation results showed |
| **2026-10-05 11:34 to 11:37** (no final gate was run on 2026-10-04: the break came at 22:05; these are fresh runs of the repair pass, `coder-execution-local`) | Final gate: `npm run test -w @dems/core-web -- --maxWorkers=2` **exit 0, 55 files / 759 tests** (11:34:21, 59.07 s); this row's three files alone **exit 0, 84 tests** (11:35:32); `npm run test -w @dems/shared -- --maxWorkers=2` **exit 0, 68 files / 1,814 tests** (11:35:48); `npm run typecheck -w @dems/core-web` **exit 0**; `npm run lint -w @dems/core-web` **exit 0**. F76-1 is green in this run (D128 ruling 1 landed in that file), so the web suite does exit 0. Quoted output: document sections 16.2 and 17; logs `implementation/assets/54_gate_*.log` |

## Files created or updated

Production (inside the row's write paths):

- `apps/core-web/src/components/shell/app-shell.tsx`, `index.ts`, `nav-items.ts`, `shell.css`, `sidebar.tsx`, `top-bar.tsx`, `user-menu.tsx` (changed)
- `apps/core-web/src/components/shell/live-notices.tsx`, `live-only-state.tsx`, `mode-indicator.tsx`, `mode-indicator-state.ts`, `mode-switch.tsx`, `route-permissions.ts`, `shell-report.ts`, `use-visible-nav-items.ts` (new)
- `apps/core-web/src/routes/_app/admin/users.tsx`, `devices.tsx`, `-guard.ts` (new)
- `apps/core-web/src/routeTree.gen.ts` (regenerated by the router plugin)
- `apps/core-web/src/features/users-roles/index.tsx`, `apps/core-web/src/features/paired-devices/index.tsx` (new)
- `packages/shared/src/i18n/index.ts`, `packages/shared/src/i18n/en/shell.ts` (changed, additive)
- `packages/shared/src/i18n/en/users-roles.ts`, `packages/shared/src/i18n/en/paired-devices.ts` (new)

By grant:

- `apps/core-web/src/features/home/home-page.tsx` (one line, decision D121)
- `packages/shared/test/i18n.test.ts` (three lines, decision D126)

Tests (new):

- `apps/core-web/src/test/live-shell-indicator.test.tsx`, `live-shell-notices.test.tsx`, `live-shell-admin.test.tsx`

Documents:

- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/54_web_shell_admin_routes.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/54_*` (23 screenshots, the lane logs and browser records, the lane scripts and drivers, the baseline, gate and mutation logs)
- this file

Scratch, git-ignored: `.cache/w54/**`, `.cache/rollback/W54/**`, `.locks/core-server.lane3.{lock,log,pid,vite.log,vite.pid}` (the two pid files are empty).

Not written: `masterplan/**`, `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `gateway_check/01_gate_report.md`, `implementation/99_implementation_report.md` (parallel run: the controller's). No git write.

## For the controller

Findings F76-1 to F76-12, deviations D-1 to D-14 and decisions 1 to 14: sections 18, 19 and 20 of the document.
The ones that need a word first:

1. **F76-1: the web suite does not exit 0.** `apps/core-web/src/test/live-runtime-startup.test.tsx:398` (W50's test)
   fails since the Login row's change of 21:00: the Login page now hands over to the shell when the store becomes
   SIGNED_IN, the shell mounts in that test, and the shell's session flag `dems.shell.intro` (written since
   `acaff20`) appears in the `sessionStorage` the test compares as a whole. Not a file of this row. Smallest change:
   line 398 expects `{ ...before.session, 'dems.shell.intro': '1' }`.
2. **Decision 1: the date of the top bar yields to the mode indicator** below 1520 px (1664 px in Live mode). The bar
   was full at 1440 px. In Simulated mode the date is therefore no longer shown between 1280 and 1519 px. Measured
   in the browser; the alternative is to drop other items.
3. **Decision 9 / F76-4**: the Login row wrote a second copy of the confirmed mode change
   (`features/login/use-mode-switch.tsx`) beside the shell's `useModeSwitch`.
4. **D120** (document section 12): a tab whose socket the Core replaced shows the link notice ("Core server
   unreachable …") for about the first reconnect delay and then "Reconnected to the Core". With five tabs or more
   the notice would pass from tab to tab (a hypothesis: not run).
5. **D-13**: one command printed the line of the seed password constant to this agent's tool output. No file holds
   the value (count 0 over everything this row wrote).
