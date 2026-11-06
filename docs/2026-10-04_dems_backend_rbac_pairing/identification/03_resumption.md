---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-05
agent: request-translator
tiering: local
status: resumption
classification: RESUME / CONTINUATION (approved plan, rev 2.1) — not a new scope
---

# Resumption Translation: DEMS Backend (Postgres), Integrated RBAC and Pairing

## Request Under Translation

Verbatim user request that opens this session (Indonesian):

```
lanjutkan prosesnya dengan delegasi sesuai dengan plan
```

Preceded in the same session by a read-only study request ("tanpa orkestrasi, pelajari project dems, beserta progres kerja yang sudah berjalan sampai saat ini dengan sangat detail; petakan mana yang masih menggantung dan belum selesai dikerjakan"), already delivered by the controller. That study is an input, not new scope.

## Classification

**RESUME / CONTINUATION of an already approved, in-progress orchestrated task.** No re-scoping, no re-planning, no new blueprint revision, no new task folder.

Reasons for the classification:

- The scope was fixed by D1 (`decisions/decisions.md:7`) and translated to goals and SC1-SC11 in `identification/01_translated.md:296-308`; the blueprint at `identification/02_structured.md:1062` records "Changed intent: No — Goals 1-9 and SC1-SC11 are unchanged".
- Approval is already granted and already reported: `BLUEPRINT_APPROVAL` pre-granted by D1 (D7), the B.9 second gate classified **MAJOR** and reported to the user (D22, `decisions/decisions.md:28`).
- The instruction "sesuai dengan plan" binds execution to the existing artifacts: plan rev 2.1 (`masterplan/02_plan.md`, 105 work rows, gates SG/MODG/CLG, waves, lanes, DEFERRABLE DF-1..DF-8 in §18 at line 1544) and blueprint rev 2.1 (127 steps; steps 23-127 = plan rows W01-W105; Parallel Execution Protocol P1-P25 declared at `identification/02_structured.md:487`).
- Nothing in the request adds a feature, changes a default of Q1-Q16 (D4), or lifts a boundary in U1-U9.

## Translated Intent

Pick up the approved 105-row plan exactly where the interrupted session stopped on 2026-10-04 at about 22:05 WIB, with delegation to the plan's own agents under the LOCAL-FIRST tiering (`*-local` variant first):

1. **Restore a verified green baseline** — clear the two RED database tests that an interrupted structural fix left behind, so every later gate runs against a clean tree.
2. **Finish the interrupted rows** — complete the rows that were mid-flight when the session ended, each with its own implementation log, progress file, and test evidence.
3. **Gate what returned ungated** — run the controller gate over every result that landed after the last gate, so no accepted work is silent.
4. **Then continue the plan order** — the backend gate, then the checkpoint commit, then the remaining rows wave by wave, lane by lane, per plan rev 2.1 and protocol P1-P25.

The intent is completion of the approved scope to SC1-SC11, not expansion of it.

## Binding Constraints Inherited (not renegotiated here)

From **D1** (`decisions/decisions.md:7`) — full autonomy inside the task:

- Spec and plan first, then implementation **without stopping at approval gates**, with every finding (F-n), drift (DR-n) and decision (D-n) recorded in `decisions/decisions.md` and reported at the end. Autonomy covers ordinary ambiguity: an open question is written down with options, a recommended default and a reason, and the controller adopts it as a decision.
- Autonomy does **not** cover outward-facing or hard-to-reverse actions: git remote or push, publishing, deploys, accounts, cloud services, sending data out, persistent system settings, Docker, deleting or renaming user files. Those still need an explicit user yes.

From **D4** (`decisions/decisions.md:10`) — adopted defaults and out-of-scope list:

- Defaults Q1-Q16 stay as adopted (Simulated mode kept beside Live; new backend app, `apps/mock-core` untouched; pairing mandatory for mobile in Live; mobile reaches the backend through `adb reverse` on loopback; released 0.1.0 packages stay as the offline edition; portal issues a short-lived one-time code plus QR; three roles with added `PAIRING_MANAGE`, `USER_ADMIN`, `DEMO_CONTROL`; server clock authoritative; etc.).
- Out of scope by D4: real hardware, real PKI / mTLS, external IdP, production hardening, iOS, visual redesign, publishing.

Environment and hygiene boundaries still in force:

| Constraint | Source | Standing rule |
|---|---|---|
| Loopback only | D5, D8 MJ-3, D16 | Every listener on `127.0.0.1` (backend 4420-4423, PostgreSQL 4432, Vite lanes); LAN or TLS needs the user's OK; the published demo password is accepted only while every listener is on loopback (C1-C4) |
| No Docker | U1, D4, D5 | Never used without the user's explicit OK; PostgreSQL runs from the project-local npm binaries (`identification/02_structured.md` TD-02 route confirmed by D32) |
| `release/` untouched | D4, D8, D9 DN-1 | Artifacts under `release/` stay byte-identical and keep working; the pinned sources may change, provenance of 0.1.0 stays commit `acaff20` plus `release/web/BUILD-INPUTS.txt` |
| No remote, no push | D1, D24 | Local commits only, staged by explicit path; `git remote -v` must stay empty |
| Record everything | D1, SC9 | Every D / DR / F before it is reported; a change to a released screen or a Q-default is a drift entry, not a silent edit |
| Concurrency | D6 | Max 6 agents of one type, 8 in flight; one npm / lockfile writer, one migration writer; drop to 2 / 4 if tests start timing out under load; the load guard above 10 is already applied by the controller |
| Gates accept zero failures | D31 | Since W01b landed, a gate accepts no named failure; the shifted-clock sweep is repeated by W58 and W89 |
| Ready-made frameworks | I1, D12 | The 15 hand-built elements HB-1..HB-15 stay small, in one owned folder, with their own tests; no new hand-built infrastructure without a decision |
| Confidentiality | 01_original.md raw context | Nothing from the design book is copied in bulk or sent anywhere |

## Resume Scope (ordered)

Stage R0 — restore the baseline (blocking, first):

- Two RED database tests from the interrupted structural round:
  - `apps/core-server/src/db/seed/__tests__/seed.db.test.ts:160` asserts `{ ok: false, reason: 'HASH_MISMATCH at sequence 30' }`.
  - `apps/core-server/src/db/fixtures/__tests__/bulk-fixture.db.test.ts:346` asserts the same flat shape for sequence 2501.
  - Cause (read and confirmed): B2b item 8 landed at 22:02 and replaced the verdict with a structured union in `apps/core-server/src/db/mapping/audit-verify.ts:28-39` (`code`, `seq`, plus a one-text member). The two assertions were never aligned to it. The fix belongs to the B2b round's owner as part of its unfinished items, red-before / green-after, test-side only unless the owner proves a production defect.
  - Evidence: `delegation_progress/coder_execution_fix_round_b2b.md:19` (item 8 done), lines 20-23 (items 9-13 pending).

Stage R1 — finish the interrupted rows:

- **B2b items 9-13** (shims and neutral test support; CPB1-18..26 and F-9; the log-call static test that misses spreads; `ACTIVITY_EXEMPT_OPERATIONS`; the `dropDeadRun` npm script), same round, same pre-images under `.cache/rollback/CPB2b/`.
- **W59 mobile Login in LIVE mode** (`apps/mobile/src/features/login/**`, blueprint step 81 = `identification/02_structured.md:363`): source half-written, **no implementation log and no progress file exist** (checked 2026-10-05: no `implementation/59_*.md`, and no `delegation_progress/coder_execution_step_80.md` or `_step_81.md`, the two step IDs either reading could point to). It must be completed or rolled back to its pre-image by its owner, then reported; it may not be carried forward as a silent partial state.
- **The unreported helper follow-up** (the database-specialist row that has been in flight since before 19:45): close it with quoted runner output, or return it.

Stage R2 — gate the returns that never got a gate:

- **W54 web shell + admin routes** (step 76, `identification/02_structured.md:358`) — returned `needs-review` at 21:43, report and log present (`implementation/54_web_shell_admin_routes.md`), not gated.
- **W57 mobile pairing flow** (step 79, `identification/02_structured.md:361`) — returned `needs-review` at 22:01, report and log present (`implementation/57_mobile_pairing_flow.md`), not gated; it also carries the Pair-screen chip line handed over from W51 and DEFERRABLE DF-8.

Stage R3 — the backend gate, then the checkpoint commit:

- **W58 GATE, backend** (step 80, `identification/02_structured.md:362`, verifier, `gateway_check/06_backend_gate.md`): P24 gate commands for `@dems/core-server` and `@dems/shared`, then the smoke run as sole owner of port 4420 with `dems_demo`, the secret/marker scan of the acceptance log, file modes 700 / 600, one loopback listener; no lane backend may run during it. Queue note from `status_tasks.md:81`: run it with a live `npm audit`. It cannot pass while R0 is red.
- **Checkpoint commit 1** (plan W104, after the backend gate) so work stops being invisible to `git status`; staging by explicit path, `storage-page.test.tsx` left out and named per D23, plus the D30 rule about stray `.vitest/` folders.

Stage R4 — continue the plan order:

- Then W59-W62 and the rest of the waves per plan rev 2.1, keeping lanes (`dems2_phone`, `dems2_tablet`, web lane 3), serial resources (npm slots, migration writer, contract owner, PostgreSQL, port 4420), the DEFERRABLE policy, and the queued items: CPS1-9 at a quiet moment, and the W15 secure-store re-probe now that the emulator lock exists (user action D125).
- Verification and close phases afterwards (W101 SC matrix, W102 report inputs, W103 final commit) are unchanged.

Two queued items that are not blocking and stay queued until a slot is free: `CPS1-9` and the W15 re-probe (`status_tasks.md:81`).

## Verified Current State (measured read-only by this agent, 2026-10-05 10:02 WIB)

| Check | Result | Evidence |
|---|---|---|
| Last commit | `4b708c8` (docs only), above baseline `acaff20` | `git log --oneline -3` |
| Nothing committed since | confirmed | same |
| Working tree | 1,388 untracked + 94 modified paths | `git status --porcelain -uall` |
| Typecheck | green in all five workspaces | controller measurement 2026-10-05 (input) |
| Root tests | green: shared 1,814; core-server unit 3,845; core-web 759; mobile 1,187; mock-core 19 | controller measurement 2026-10-05 (input) |
| `npm run test:db` | RED on exactly 2 tests, cause located | test files cited in Stage R0; `audit-verify.ts:28-39` |
| B2b round | items 0-8 done, 9-13 pending | `delegation_progress/coder_execution_fix_round_b2b.md` |
| Ungated returns | W54, W57 | `status_tasks.md:81`, progress files at 21:43 / 22:01 |
| Half-written row | W59, no report, no tests | filesystem check above |
| Step-number discrepancy | `delegation_progress_report.md` launches "step 80, W59"; the blueprint maps step 80 to **W58 (the backend gate)** and step 81 to **W59** (`identification/02_structured.md:362-363`) | reconcile in the trackers before re-delegating; do not let the gate row and the mobile Login row collide on one step ID |
| Modified-path count | controller reported 148; this agent measures 94 `M` (plus 1,388 `??`) with `-uall` | re-check at resume time; does not change scope |

## Out of Scope for This Resume

- **No new features** beyond the 75 operations, the WebSocket channel, the three roles / 12 permissions and the two portal admin pages already specified.
- **No DEFERRABLE cuts without a recorded decision.** DF-1..DF-8 (`masterplan/02_plan.md:1544-1561`) stay uncut per D17 ("nothing DEFERRABLE is cut"); any reduction needs a D-n entry naming the item, the rows affected and the consequence, and DF-4, DF-5 and DF-8 explicitly produce drift entries.
- No change to Q1-Q16 defaults, no change to the security rulings of D16, no new dependency, no npm slot without the serial lock.
- No release packaging work: `release/` byte-identical, no live package unless a portable path needs neither Docker nor an admin install (Q7).
- No U1-U9 action: no Docker, no LAN or TLS exposure, no cloud service, no account, no persistent host setting, no deletion or rename of user files, no push.
- No uninstall of an app from an emulator (DP-1 option A, D26); a native rebuild must back up the debug keystore and verify the certificate digest first (D26 condition on W13).
- No physical tablet or Live APK without a separate user OK (D8 MJ-3).
- No blueprint or plan revision beyond a text alignment, and none of the reconciliation notes above is a reason to re-open the design.

## Success Criteria This Resume Still Serves (SC1-SC11)

Source: `identification/01_translated.md:296-308`; criterion-to-section map at `masterplan/01_specs.md:1874-1884`.

| # | Criterion | Standing at resume time | Evidence / owner |
|---|---|---|---|
| SC1 | Specs and plan dated before the first implementation log | MET | Docs commit `4b708c8`, reference time 2026-10-04T06:25:02+07:00 (D24) |
| SC2 | Start command, migrations, seed, state survives a restart | Backend half proven; gate open | W53 restart acceptance test, 16 tests through the real routes (D110); confirmed by the W58 gate |
| SC3 | Both clients read from the backend; an action on one shows on the other | Proven over the real channel; client-side rows unfinished | W49, 6 tests, 2,934 validated frames (D119) |
| SC4 | Role-by-endpoint test; denial refused and audited; role change follows both clients | Server matrix proven; client-side rows unfinished | W47, 34 tests, 1,200 cells (D117) |
| SC5 | Pairing gate, listing, revocation, audit per step | Server lifecycle proven; mobile flow ungated | W48, 31 tests (D116); W57 report pending gate |
| SC6 | OpenAPI describes every endpoint, drift test passes | Proven; API Reference page rows still ahead | W52, 337 of 337 cells (D115); W84 remains |
| SC7 | Existing suites plus new backend tests pass | Root green, `test:db` RED on 2 tests | Stage R0 must restore this before any gate |
| SC8 | Simulated mode and the 0.1.0 packages still work | Not yet demonstrated end to end | Runtime rows landed; verification rows plus the checksum and launcher re-checks are ahead |
| SC9 | Every decision, drift and finding recorded; the report consolidates them | Running record D1-D129, DR-01..DR-12, F1-F79 | D1; consolidated by W102 |
| SC10 | No secret committed, no real personal data, nothing sent out | Kept so far; final proof open | Per-row secret greps; the W58 log scan; verification rows |
| SC11 | README gives the exact Live-mode commands | Not yet written | README row (specs `:1883`, plan W86) is ahead |

## Assumptions Made

- **A-R1**: "lanjutkan prosesnya dengan delegasi sesuai dengan plan" is an instruction to continue under the existing approvals, not a request for a new plan or a new summary. Justification: the phrase "sesuai dengan plan" names the approved artifact, and D1 / D22 already cover both gates.
- **A-R2**: The two RED tests are unfinished work of the interrupted B2b round, not a defect in previously gated rows. Justification: the assertions match the pre-item-8 verdict shape; item 8 landed at 22:02 with no tracker entry after it.
- **A-R3**: Half-written W59 source in the working tree is not accepted work; completing or rolling it back is the row owner's call. Justification: no implementation log, no progress file, no tests exist for it, so it has never met a gate criterion.
- **A-R4**: Delegation resumes with the plan's own agent assignments and the LOCAL-FIRST variants; the controller keeps its 6 / 8 ceiling (D6) and its load guard.
- **A-R5**: A resume may begin without waiting for the user because the only gate that could apply was already passed and reported (D22). If any later row turns out to need a U1-U9 action, that stop is still live.

## History Relevance Assessment

| Reference | Relevance | Notes |
|---|---|---|
| `identification/01_original.md` | Direct | The originating request and the U1-U9 boundary list |
| `identification/01_translated.md` | Direct | Goals 1-9, defaults Q1-Q16, assumptions A1-A10, SC1-SC11 |
| `identification/02_structured.md` rev 2.1 | Direct | The 127-step flow, protocol P1-P25, the step-to-W map used to order this resume |
| `masterplan/02_plan.md` rev 2.1 | Direct | Work rows, waves, lanes, gates, DEFERRABLE §18 |
| `masterplan/01_specs.md`, `03_database_contract.md`, `04_client_integration_spec.md` rev 2.2 | Direct | Canonical requirements (SR-82, AC-B-93, AC-C-110, 30 tables) that the remaining rows must satisfy |
| `decisions/decisions.md` (D1-D129, DR-01..DR-12, F1-F79) | Direct | Binding rulings; D1 and D4 are the authority for resuming without a new gate |
| `status_tasks.md`, `delegation_progress_report.md` | Direct | Where the work stopped and what is queued |
| `gateway_check/01_gate_report.md` (M1-M16) | Direct | Gate rules the resume must keep honouring, including the zero-failure baseline (D31) |
| `docs/2026-09-30_dems_demo_stack_setup/` (CLOSED, KI-01..KI-29) | Indirect | Known issues this task must not worsen; KI-01 is touched by DF-8 |

### Important Notes From History

- Two prior sessions ended mid-flight (D2, and the 19:45 / 22:05 pauses): the recurring failure mode of this project is **ungated or unreported results at a session boundary**. The first act of this resume is to make state visible again — green tests, gated returns, then the checkpoint commit.
- Commits happen only at the plan's checkpoint rows; do not "clean up" the tree with an unscheduled commit, and never stage by directory wildcard (D23, D30).
- Database-backed commands need the per-command sandbox bypass; a sandbox EPERM on port 4432 is not "PostgreSQL down" (P10, D32).

### Lessons From History

- A structural fix that changes a public shape must update its callers and its own tests in the same landing; here the shape changed and two test files did not follow (Stage R0).
- Report a `needs-review` return with the decisions it needs listed, so the gate after an interruption costs one read rather than a re-investigation (as with W54 / W57).
- Keep the load guard: at 11.7 the controller refused to start another heavy agent; the same restraint keeps gate timings trustworthy.

## Dependencies

- The project-local PostgreSQL instance on `127.0.0.1:4432` must be reachable, or restarted by `scripts/pg/` per P10 and the documented commands.
- Emulators `dems2_phone`, `dems2_tablet` (and the third device) hold the debug build with the user's PIN and fingerprint set (D26, D125) for the mobile rows.
- The plan's serial resources are free: npm slots, migration writer, contract owner, port 4420 for the gate, lane locks.
- The pre-images under `.cache/rollback/CPB2b/` must still exist for the B2b round to be finished or reversed cleanly.

## Notes

- This document is the translation record only. Execution order, per-row briefs, wave scheduling and delegation live in `masterplan/02_plan.md` rev 2.1 and the controller's trackers; nothing here adds a row or changes an owned write path.
- The step-number collision noted in the state table should be fixed in `status_tasks.md` and `delegation_progress_report.md` before new delegations go out, so the backend gate and the mobile Login row cannot be confused.
- If a resume row discovers that a DEFERRABLE item or a U1-U9 boundary must move, it stops and raises it: those are decisions for the record, and a U-item stays the user's call.

---
*Generated: 2026-10-05 10:02 WIB*
