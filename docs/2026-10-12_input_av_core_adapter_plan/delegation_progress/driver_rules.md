# Driver rules - track D (implementation), valid for every row

Read before anything else: `identification/03_implementation_blueprint.md` - section 6 (row conventions), your row in `## Structured Task Breakdown`, your line in `## Execution Profile`, section 7 (single-writer resources), and the requirement identifiers your row carries (section 11; their text is in `masterplan/04_design_addendum.md` section 9 and `verification/04_security_addendum.md`). `decisions/decisions.md` binds (user rows U1-U14, controller rows C1-C16).

## Standing rules
1. Branch `task4/input-av-core-port`. You do NOT commit, stage, stash, clean, reset or push; the controller commits through the git rows. Never `git clean`, `git stash`, `git add -A`, `git add .`, `git checkout -- <path>`.
2. Nothing under `apps/input-av/data/` is opened, listed or stat-ed. `apps/input-av/` is a read-only reference. No `.env` is read.
3. No `sudo`, no change of a host address, no real camera or network device, no real credential, no Linux host, no hardware. Everything is closed on doubles on this Mac; say in your record what the double is and what stays unproven (it goes to the hardware package, checks `9A/H-nn`).
4. Ownership: your FIRST act is to append the exact paths you will write to `delegation_progress/file_claims.md` (one line: row, paths). Write only inside your Ownership Area. A change you need elsewhere = ONE line in `delegation_progress/file_requests.md` (row, path, exact change, blocking yes/no), then continue behind a seam.
5. Shared hot files (audit vocabulary, operation pins, value sets, schema version and its pins, i18n, lockfile, static-rule lists): only the row the profile names as their writer touches them. Edits are small, additive, made with the Edit tool after re-reading; count pins move by delta; never a whole-file rewrite or a scripted replace.
6. The capture fence files (`boot.ts`, `operation.ts`, `checks.ts` under `apps/core-server/src/capture/`) are edited only by the rows the blueprint names.
7. Tests: targeted files only, `--maxWorkers=2`, one run if it passes, a second only after a failure; your workspace's typecheck once at the end. Do NOT run `npm test`, `npm run test:db` or any full suite - the controller runs them once per commit. New tests extend the existing test file of their subject.
8. Heavy host: anything that starts the capture worker, a relay, a scenario suite, an emulator or a container takes `.locks/heavy-host.lock` (`/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock <cmd>` from the repository root) - one heavy job at a time; another session may hold it, wait rather than work around. Database work takes `.locks/db-migrate.lock` and uses only this Mac's local PostgreSQL (the demo database and throw-away suite databases). Ports: never 8554, 8556, 8558, 4400-4432, 5173, 8081; loopback only. Binding a port or reaching PostgreSQL needs the command sandbox off for that command. Stop only processes you started.
9. Graft is available from the repository root for navigation (`graft skeleton <file>`, `graft grep "<literal>" --in <path>/`, `graft callers <symbol>`). Prefix verbose commands with `rtk` if available.
10. If the row turns out larger than its size: stop at a verified, compiling state, return `needs-review`, and list exactly what is not built. Never leave the tree not compiling.
11. A decision you had to take that is not in the documents: take the conservative one, mark it in your record as DRIVER DECISION for the controller to confirm.

## Record and report
- Write your record to the Expected Output path of your row (`implementation/NNN_*.md` etc., NNN = step number, Tier as the row conventions say) and a short `delegation_progress/row_NNN.md`.
- Never write `delegation_progress_report.md`, `status_tasks.md`, `decisions/decisions.md`, or the masterplan / verification documents.
- Final response under 200 words: status (complete | blocked | needs-review); files created or changed (code and docs); the checks you ran with their result lines; requirement identifiers closed; requests left in `file_requests.md`; driver decisions.
