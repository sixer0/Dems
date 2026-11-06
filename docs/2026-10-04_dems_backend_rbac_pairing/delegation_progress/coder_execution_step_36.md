---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier D, model sonnet)
blueprint_row: 36 (plan W14, npm slot N2, web)
date: 2026-10-04
status: needs-review
evidence_tier: 3
---

# coder-execution progress: step 36 (W14, npm slot N2)

Status: **needs-review**, on one clause only: `npm install-scripts ls` prints 8 lines after the install and
step 25's list had 7. The extra line is `fsevents@2.3.3 (install: (install scripts present))`, a package that is
in the lockfile since `acaff20`, was not touched by this row and has no lifecycle script. Everything else of
the row is done and verified.

Output document: `implementation/14_npm_slot_n2_web.md` (evidence for every line below).

## Files created or updated

Workspace (the owned write paths of W14 and the one D28 D-4 line):

- `apps/core-web/package.json` (`qrcode.react` `4.2.0`)
- `apps/core-server/package.json` (`react` `19.2.3`; D28 D-4)
- `package-lock.json` (1 package entry added, 0 removed; the two workspace records gained one dependency line each)

Git-ignored: `.cache/rollback/W14.pre.patch` (P23), `.cache/rollback/W14.core-server.package.json`,
`node_modules/qrcode.react/`.

Task folder:

- `implementation/14_npm_slot_n2_web.md`
- `implementation/assets/14_npm_slot.sh`, `14_npm_slot.txt`
- `implementation/assets/14_npm_audit.txt`, `14_npm_audit_matches_step25.txt`, `14_npm_audit_80run.txt`, `14_npm_audit_signatures.txt`
- `implementation/assets/14_audit_set_80.txt`, `14_audit_set_84.txt`
- `implementation/assets/14_lockfile.diff.txt`, `14_npm_ls_react.txt`, `14_registry_qrcode_react_4_2_0.json`
- `implementation/assets/14_install_scripts_before.txt`, `14_install_scripts_after.txt`
- `implementation/assets/14_typecheck_core_server_run1.txt`, `14_typecheck_core_server_run2.txt`, `14_tsconfig_core_server_minus_w08_test.json`
- `implementation/assets/14_probe_install_scripts.cjs`, `14_probe_fsevents.cjs`
- `delegation_progress/coder_execution_step_36.md` (this file)

Not written (parallel run): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`,
`masterplan/02_plan.md`, `implementation/99_implementation_report.md`. The root `package.json` is byte-identical
(SHA-256 `c556e9c0...ed3c922` before and after); no source or test file was written.

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 07:29:13 | P23 pre-images; `npm install-scripts ls` baseline: the same 7 as step 25 |
| 07:30:38 | Registry: `qrcode.react` 4.2.0, ISC, no dependencies, peer `react`, no install-time script |
| 07:31:11 | Dry run under the npm lock: "add qrcode.react 4.2.0", nothing else |
| **07:31:44 to 07:31:52** | **Install window.** `npm install --ignore-scripts` under the npm lock: "added 1 package, and audited 1732 packages in 8s", exit 0 |
| 07:32:55 to 07:33:04 | `core-web` typecheck 0, `core-web` lint 0; `core-server` typecheck 2 (18 errors, all in W08's new test file) |
| 07:33:21 to 07:36:45 | `npm audit` (84 entries in the first run; set analysis shows it is non-deterministic: 80 or 84 for one lockfile), `npm audit signatures`: 1,721 verified, 0 invalid, 0 missing |
| 07:37:02, 07:37:32 | `core-server` typecheck run 2: same 18 errors; the server project without that one file: exit 0 over 62 files |
| 07:40:22 | `core-server` typecheck run 3: exit 0 (the owning row rewrote its test at 07:37:49) |
| 07:40:32 to 07:40:41 | Final run: `core-web` typecheck 0, `core-server` typecheck 0, `core-web` lint 0 |

## Verification quoted (full output in the document)

- Lockfile: 11 lines added, 0 removed; `ADDED entries: 1` (`node_modules/qrcode.react`); `existing entries whose version, resolved or integrity changed: 0 of 1907`; `CHANGED entries: 2` (the workspace records of `apps/core-web` and `apps/core-server`, one declared dependency each); `git diff --minimal --numstat acaff20 -- package-lock.json` = `1750 0`.
- `npm ls react react-dom --all` exit 0: `react@19.2.3` 117 deduped + 1 overridden; `react-dom@19.2.3` 44 deduped + 1 overridden; on disk one copy each.
- `npm ls qrcode.react`: `@dems/core-web@0.1.0` then `qrcode.react@4.2.0`, exit 0.
- `npm audit` against step 25's Appendix A: no entry that this row causes. In the 80-entry state the text is byte-identical (8 of 16 reports); the 84-entry state adds four `react-native` dependents (`@shopify/react-native-skia`, `heroui-native`, `uniwind`, `victory-native`) that also appear with the pre-image lockfile.
- Rollback pre-image proven on a scratch copy: `acaff20` lockfile plus `W14.pre.patch` gives `bc6b6f0789f765a5...e88e5ab75` (the lockfile before this row).

## Findings, deviations and decisions for the controller

Findings:

- **F-1** `npm audit` is not deterministic for one lockfile (80 or 84 entries; 11 JSON runs gave exactly two sets, the 84-set is the 80-set plus four `react-native` dependents). This explains the "two totals" of steps 25 and 35. Gates must compare the package-name set, not the bytes (W99).
- **F-2** `npm install-scripts ls` lists `fsevents@2.3.3` after the install. Why the list changed between 07:29 and the later runs is not established (a hidden-lockfile theory was tested and not confirmed).
- **F-3** `qrcode.react` 4.2.0: registry signature verified, no provenance attestation; exports `QRCodeSVG` and `QRCodeCanvas`.
- **F-4** The React pin now lives in three places that change together: core-web manifest, core-server manifest, root `overrides` (all 19.2.3).
- **F-5** W08's new test file (`apps/core-server/src/plugins/response-headers/__tests__/response-headers.test.ts`) was red under `tsc` at 07:33:02 and 07:37:02 and was rewritten by its own row at 07:37:49.
- **F-6** W85 needs one notices line for `qrcode.react` (ISC; the package ships its own `LICENSE`).

Deviations: **DV-1** a dry run, a registry lookup and a scratch-project audit were added; **DV-2** the install-scripts clause is not met as written (one extra line); **DV-3** shared tracking files not written (parallel run).

Decisions needed: **DN-1** treat the `fsevents` line like D27 option B (reviewed, no script, not approved), or record a name-only denial in a later npm slot; recommendation: the former. **DN-2** later rows compare `npm audit` by package-name set and accept both the 80-set and the 84-set.

Install window for other rows (P11): `node_modules` was rewritten once, 07:31:44 to 07:31:52; only `node_modules/qrcode.react` was added.

Rollback: restore the three files from the pre-images (section 12 of the document) and run `npm install --ignore-scripts` under the npm lock.
