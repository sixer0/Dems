---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: data-analyst
step: 14 (blueprint row 14, FIRM)
status: complete
date: 2026-10-04
last_updated: 2026-10-04 02:36
---

# Progress: data-analyst, step 14 (decision record)

## Status

complete

## Artifacts

| Path | State |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/research/03_analysis.md` | created (Tier 1, 979 lines) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/data_analyst_step_14.md` | created (this file) |

No other file was written. `masterplan/02_plan.md` was not created: it belongs to row 18. `git status --porcelain -- apps packages scripts release package.json package-lock.json` printed 0 lines after the work.

## Milestones

1. Read all inputs: `identification/01_translated.md`, `identification/02_structured.md` (all 736 lines), `decisions/decisions.md`, the five inventories (01, 01b-01e) and the seven collections (02, 02b-02g); also `initialization/02_baseline_gate.md` (row 13), because the D9 root-gate constraint depends on it.
2. Data validation: all twelve research files present and usable; no `DATA_INCOMPLETE`.
3. Wrote 13 technology records (TD-01..TD-13) and 10 architecture records (ADQ-1..ADQ-10), each with options, criteria, evidence, choice, rejected options and rollback.
4. Wrote the pinned-version table, the Host Impact Register (13 lines), the map of the 25 impact questions, the gap and risk register (29 items), the external research synthesis, the security boundary for row 20, and the list of decisions for the controller.
5. Spot-checked about 240 cited line numbers against the source files with `sed -n`; all matched except the lines of `decisions/decisions.md`, which had moved (see deviation 2). Not every citation in the file was re-checked this way.

## Verification quoted (the controller's checks for row 14)

| Check | Result |
|---|---|
| 23 decision records present | `grep -c '^### TD-'` = 13; `grep -c '^### ADQ-'` = 10 |
| Each with options, criteria, rejected options, rollback | counts of the fields in the file: options 23, criteria 23, rejected 23, rollback 23 (TD-13, cost only, states its question and candidate paths in place of options and criteria) |
| Each with a pinned version or a named pattern, and a citation to rows 1-12 | section 13.1 (one line per choice); section 6 (versions with source lines) |
| TD-02: install, init, start, stop, removal commands; trial; fallback; "no Docker, no login service, loopback only" | section 4, TD-02 (command block, trial T1-T8, fallback block); stated in the record and in 13.1 |
| All 25 impact questions mapped | section 8: 25 rows |
| Every assumption labelled | section 1.6 (AS-01..AS-10) and the word "hypothesis" in the text (10 uses) |
| Tier 1 elements | section 1 (subject, stakeholders, timeline, scope, method, assumptions, alternatives) and section 9 (gaps) |
| Tables well-formed | a column-count check over the file printed `tables: 48 bad rows: 0 total lines: 979` (after one table was fixed) |
| No unfinished marker, no secret | `grep -c CONTINUE` = 0; the demo credentials are cited by constant name only |

## Commands run (all read-only)

`ls`, `wc -l`, `sed -n`, `grep`, `cat` of manifests; `node -v`; `npm help install-scripts`; `git config user.name` (first word only); `git status --porcelain`; `date`. No install, no server, no test, no web call. The Graft graph was not queried: the research files already carry the code facts.

## Findings beyond the research (for the controller's findings log)

1. **npm install-script policy.** `npm help install-scripts` on this host states that dependency install scripts are blocked unless the package has an `allowScripts` entry; the root `package.json` approves one package. The research's host fact H6 (`ignore-scripts=false`, `research/02_collection.md:33`) does not cover this. The npm PostgreSQL route needs one reviewed approval for `@embedded-postgres/darwin-arm64`, or its binaries may fail to load. The predecessor noted that in its run the warnings were advisory (`docs/2026-09-30_dems_demo_stack_setup/delegation_progress/coder_execution_scaffold.md:51`); the trial in TD-02 covers both behaviours.
2. **`@fastify/websocket` pin.** The registry's 11.3.3 was published about 11 hours before row 8's lookup; the record keeps the installed 11.3.1.
3. **Write paths missing from blueprint rev 1** (for row 21): `apps/core-web/vite.config.ts` (row 62, dev proxy), `packages/shared/src/sim/auth.ts` (row 26, the role table), the hard-coded ports in `apps/mobile/scripts/device-session.sh`, and the decoder that row 76's check implies.
4. **Seed operator name.** `OPR-001` has the given name "Budi", the same given name as the workspace git identity; it is predecessor data with a different person name and no e-mail (G-24). No change proposed.

## Deviations

1. Read `initialization/02_baseline_gate.md` although it was not in the input list.
2. `decisions/decisions.md` changed while this row ran (D10 and F20 were added). The record cites decisions by ID (`DEC:D5`, `DEC:F13`), not by line, and takes D10 into account: G-01 is marked as already decided.
3. The research's `03_external_vocabulary.md` does not exist; the dimension scope was taken from `identification/01_translated.md:348-353`.

## Blockers

None.

## Decisions for the controller to record

The full list is section 13 of `research/03_analysis.md`. Summary:

- **PostgreSQL route (D5)**: npm binaries `embedded-postgres` 18.4.0-beta.17 (PostgreSQL 18.4), driven by project scripts with `initdb` and `pg_ctl`, `127.0.0.1:4432`, data in `.data/postgres/`; trial T1-T8 in row 23 before anything depends on it; fallback Homebrew `postgresql@18`. No Docker, no login or background service, no shell-profile edit, loopback only.
- **ADQ choices**: host the shared simulator core headless in the server (ADQ-1); a Live source behind the existing `useSim` contract (ADQ-2); asynchronous Live actions, 26 web and 27 mobile production files (ADQ-3); hybrid persistence and seed as of the server clock (ADQ-4); backend on 127.0.0.1:4420 (ADQ-5); same-origin Vite proxy with a cookie for the web, bearer header for mobile (ADQ-6); dev builds default to Simulated, release builds Simulated-only, no silent fallback (ADQ-7); `apps/core-server` (ADQ-8); additive vocabulary (ADQ-9); three lane backends for client waves (ADQ-10).
- **Root gate (D9)**: database-backed tests sit behind `npm run test:db`, which attaches to or starts the project-local PostgreSQL and never skips (TD-12).
- **QR (controller constraint 7)**: rendered in the portal with `qrcode.react` 4.2.0; scanning on the device deferred; no camera module; no AVD change.
- **15 hand-built elements** (HB-1..HB-15), each with its reason: section 13.2.
- **2 departures, both "DEPARTURE — needs controller decision"**: the fallback keg is `postgresql@18`, not `@17` as D5 names; D5's "removable with one command" does not hold for the keg route (four to five commands).
- **Controller's calls listed in 13.4**: live package not built (TD-13); role that receives the new permissions; emulator holding the release-signed build; lanes; port 4432; an optional stricter permission hint that would write two more files under `packages/shared/src/sim/`.
