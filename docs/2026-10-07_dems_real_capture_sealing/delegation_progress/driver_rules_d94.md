# Driver rules — parallel wave (decision D94, 2026-10-09)

Binding for every implementation driver in this task. Task folder (TF) =
`docs/2026-10-07_dems_real_capture_sealing/`. Read your row in
`TF/identification/02_structured.md` (rev 2.4) in full, then only the spec
sections it cites.

## Mode
- No reviewer follows your row (D88). The milestone review row and gate check it. Verify honestly; say plainly what is not proven.
- Optimistic scheduling (D92): your row may start before rows it formally depends on. Build against the CONTRACT (shared registry, simulator, spec) and against interfaces already in the tree. Where a dependency is not built yet, code to its specified interface, keep the seam explicit, and list it under "to wire when row N lands". Never fake a result.
- Device, emulator and browser checks (2 + 1) are NOT run by you: the lane stack and the emulators are stopped. Do the code and the automated tests; list the device/browser checks of your row, grouped into scripted flows (D89), for the consolidated device session at the milestone gate.

## Shared tree — many drivers write at once
- Touch only the files your row owns. Before editing a file another row may touch (`packages/shared/src/i18n/**`, navigation/router files, `apps/core-server/test/static/*` count pins, `packages/shared/src/api/*`, `apps/core-server/src/db/store/store.ts`, `THIRD_PARTY_NOTICES.md`), re-read it and make the smallest edit. Never reformat or reorder a shared file.
- `apps/core-server/src/app.ts`, `index.ts`, `config.ts` are frozen (P25): add nothing unless your row text names the waived edit; then update the pin in the same change.
- A red test that comes only from another row's in-flight edit: attribute it by file name; do not fix it.
- No commit. No lockfile write unless your row is named its writer (then `/usr/bin/lockf -k .locks/npm.lock`). No Homebrew. No new dependency unless the spec names it.

## Host resources
- Stay in the repo root; never `cd` into subfolders (`-w <workspace>`, `make -C`, absolute paths). No `flock`: `/usr/bin/lockf -k`. `/bin/sleep` to wait.
- Loopback bind, PostgreSQL, process-priority and device calls fail inside the Bash sandbox with EPERM: retry that one command with the sandbox disabled.
- Database: project PostgreSQL 127.0.0.1:4432 only, through the repo's npm commands and the db test project (throw-away databases). One db run at a time: `/usr/bin/lockf -k .locks/db-migrate.lock <command>`. NEVER read, source or print `.data/pg*.env` or the pwfile; never connect as dems_admin. The four live databases are migrated only by row 130.
- Heavy runs (capture e2e, real STT/diarization, any timing-sensitive media measurement): `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock <command>`. Never start oMLX unless your row says so.
- Ports: never 5173-5175, 8000, 5432; media fixtures only 127.0.0.1:8555, 8557, 8559-8564.
- Tests: targeted files while developing. At the end run only your workspace's typecheck + lint and the test files you touched plus the static guards of that workspace. Do NOT run whole-workspace or cross-workspace suites — the controller runs them once per commit. Baseline for attribution: core-server unit 3 failed (MODG route-list tests in modules/sessions x2 and modules/evidence x1), db 12 failed (all in test/acceptance/contract.test.ts), core-web and mobile typecheck carry 3 known `PrecheckCheckId` errors (rows 67/68 close them).

## Quality rules that stay
- A check must be able to fail (negative control). Never weaken, skip or raise the timeout of an existing test. Never claim code exists without file:line. Never delete or rename a file you were not asked to. No media, model or credential in git. No timing/throughput figure for STT anywhere (D230).
- Credentials: never in logs, audit, errors, argv, env of child processes, test output or docs. Agents never handle a real camera credential (D76).
- UI: the apps' existing component kits and patterns only (ready-made frameworks rule); English UI vocabulary from `packages/shared/src/i18n/en/common.ts`.

## Deliverables
- Your row's implementation note (path in the row's Expected Output), SHORT: what was built (file:line), what is real vs stand-in, commands + results, "to wire when row N lands", device/browser checks left for the gate, decisions taken.
- `TF/delegation_progress/<agent>_row<N>.md` with status and file list. Do not write `status_tasks.md` or `delegation_progress_report.md`.
- Final response: status complete | blocked | needs-review; files changed; results; decisions for the controller. Keep it under 60 lines.

## Proof depth and who runs it (decision D122, 2026-10-09 — replaces every "2 runs" in a brief or a blueprint row)

1. **One run.** A check that passes once is proven. It is run a second time only after a FAIL (after the fix, or to tell a flake from a defect). No routine repeat runs.
2. **Driver = build + the fast proof.** The driver (the row's main agent) writes the code and runs only: the test files it wrote or touched, typecheck and lint of its workspace. It then RETURNS — it does not wait on long runs.
3. **Test runner = a separate Sonnet agent.** Everything long or heavy (whole-workspace suites, db suites, e2e with the worker, mutation proofs, browser and device flows) is a list the driver hands over in its report under "Checks for the test runner": the exact command, the lock it needs, the expected result, the check IDs. The controller starts a Sonnet test-runner agent for it. The runner changes no product code.
4. **A red result goes back to the driver.** The runner reports the failing command and output; the controller resumes the row's driver with it. The driver fixes, and the failed check is run again (rule 1).
5. **The controller schedules the runs** by the state of the wave: heavy runs go when the host and the locks are free, grouped per commit where rows overlap; a row's successors may start on its code before its runner has reported (optimistic, D92) — a red runner result then goes to the driver and to the successors that built on it.
6. Negative controls and mutation proofs stay only where the row is about security or evidence integrity (sealing, signer, verify, credentials, access rules); elsewhere one failing-first test is enough.

## Local devices — hard rule for every agent run (decision D163, 2026-10-10)

A pre-check or a session start on a selector that names a LOCAL_DEVICE source (`CAM-03` / `MIC-03` or whatever the registry lists as this Mac's camera / microphone) OPENS the real device. No agent run — driver, test runner, gate session, judging session — selects, pre-checks or starts such a selector, and no agent sets `DEMS_LOCAL_SESSION_ATTENDED` or `DEMS_USER_ATTENDED`. Use FAKE (generated) sources or the scripted process door. Runs with the real devices are the user's, from the user's own Terminal.
