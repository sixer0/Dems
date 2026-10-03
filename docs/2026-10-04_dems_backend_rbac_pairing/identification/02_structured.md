---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: task-architect
revision: 2.1  # rev 2 = B.9 refinement (blueprint row 21), accepted by D22. Rev 2.1 = alignment patch with plan revision 2.1: no row added, removed or renumbered. Rows 1-22 FIRM with their status; rows 23-127 CONFIRMED (plan work rows W01-W105). Rev 1 (118 rows, 23-118 PROVISIONAL) was accepted by D7
tiering: default  # unchanged from rev 1: 01_translated.md carries no `tiering` field; inherited from its `model_tier: default` (CLAUDE.md §10: no local tier in this port)
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/01_translated.md
source_original_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/01_original.md
refined_against:
  - masterplan/02_plan.md revision 2.1 of 06:12 (105 work rows W01-W105; revision 2 accepted by D20, the patch follows the consistency check, D21); read for rev 2.1 of this file: its revision history, §3.4, §4.2, §4.3, §8.1, §8.7, §21, §23.3 and the rows W01, W06, W07, W13, W71, W84, W104, W105
  - masterplan/01_specs.md revision 2 (75 operations; SR-01..82; AC-B-01..93)
  - masterplan/03_database_contract.md revision 2.1 (30 tables; three roles)
  - masterplan/04_client_integration_spec.md revision 2 (AC-C-01..110)
  - research/03_analysis.md (TD-01..13, ADQ-1..10, Host Impact Register)
  - gateway_check/03_security_design_review.md (verdict CAUTION; every correction accepted by D16)
  - decisions/decisions.md (D1-D20, DR-01..DR-04, F1-F25)
  - gateway_check/02_masterplan_consistency.md (row 19, PASS-WITH-NOTES; it finished while this revision was written, DR-04; its findings C-02, C-08, C-09, C-10, C-12 and C-13 are applied here)
scale_category: enhancement  # major; with a migration component (the simulator's demo dataset moves into PostgreSQL)
professional_document: false  # output format is markdown
approval: pre-granted (D1); the classification below is still reported to the user
b9_classification: MAJOR  # reasoning in the Refinement Log
status: refined_blueprint
---

# Structured Tasks: DEMS Backend (PostgreSQL), Integrated RBAC and Portal-Mobile Pairing

## Revision history

| Rev | Content | Accepted by |
|--:|---|---|
| 1 | 118 rows: 1-22 FIRM, 23-118 PROVISIONAL; protocol P1-P22 | D7 |
| 2 | Rows 23-118 are replaced by the confirmed breakdown: 105 rows (steps 23-127), one per plan work row W01-W105. Protocol P1-P25. Lanes, early proofs, two checkpoint commits. B.9 class: **MAJOR** | D22 (V1-V7 PASS by the controller's script; class MAJOR recorded) |
| 2.1 | Alignment with plan revision 2.1: the mapping of provisional rows 25 and 79; "W01's state" by `git hash-object` (steps 23, 93, 106); the variable name `DEMS_CORE_HOST_PORT`; the `lsof` probe in the verification of step 29 and the rule for a blocked step 24; `storage-page.test.tsx` in the two checkpoint commits. 127 rows, nothing renumbered | pending (the controller's patch request) |

## Source Translation

- **Translated task**: `identification/01_translated.md`. **Original**: `identification/01_original.md` (Indonesian, verbatim).
- **Intent (accepted in D4)**: the two clients built by the predecessor task each run their own in-app simulator and share nothing. The user wants one system:
  1. a backend with PostgreSQL as the single source of truth for every feature the two apps show;
  2. RBAC defined and enforced on the server, honoured by the web console and the mobile app;
  3. a real pairing flow in which a mobile device is paired with the Core through the portal, is listed there and can be revoked there.
- **Process intent**: spec and plan first, then implementation, fully autonomous, with every finding (F-n), drift (DR-n) and decision (D-n) recorded.
- **Goals**: 1-9 of the translated task. **Acceptance**: success criteria SC1-SC11.
- **Constraints**: C1-C7 (explicit) and I1-I13 (standing). **Assumptions**: A1-A10. **Defaults adopted**: Q1-Q16 (D4). **User's-call items**: U1-U9.
- **Design inputs fixed since rev 1**:
  - D11, D12: the technology and architecture record (TD-01..13, ADQ-1..10) and fifteen hand-built elements HB-1..HB-15.
  - D13, D18: the server specification, revision 2: 75 operations, 3 roles and 12 permissions, SR-01..82, AC-B-01..93.
  - D14, D19: the database contract, revision 2.1: 30 tables, three database roles, audit append-only as a database feature.
  - D15, D18: the client integration specification, revision 2: AC-C-01..110.
  - D16: the security design review (CAUTION) with all 24 corrections accepted.
  - D17, D20: the implementation plan, revision 2: 105 work rows, three npm slots, three lanes, seven early proofs, two checkpoint commits.
  - Drift: DR-01 (fallback keg `postgresql@18`), DR-02 (QR scanning on the device deferred), DR-03 (three database roles), DR-04 (rows 19 and 21 in parallel).

## Prior Task Continuity

No formal prior-task inputs (prior_02_structured, prior_decisions, prior_report) were passed. The controller pointed to the predecessor blueprint for structure and conventions only.

| Item | Carried into this blueprint |
|---|---|
| Summary of the prior task | `docs/2026-09-30_dems_demo_stack_setup/` closed at local commit `acaff20` (D3): web console, Android app, shared in-app simulator, mock-core (health and heartbeat), 0.1.0 release packages |
| Inherited decisions | mock-core is a scaffold by decision; the simulator lives in `packages/shared` so both clients run it; the release APK is Simulated-only with no cleartext; emulators are never killed and never booted from a snapshot; one npm and one Gradle writer at a time under `/usr/bin/lockf` |
| Open items that this task touches | KI-01 (tablet end pass: the Pair screen's tablet layout is checked by W57), KI-02 (no Maestro flows: stays open), KI-07 (simulator gaps on mobile: must not grow, W97), KI-18 (stale description in `core-api.ts`: closed by W83), KI-21 (`expo prebuild` wipes `android/`: W13 backs up first), KI-26 (keep the Mac awake), KI-28 (design-book extracts are tracked locally: never staged) |
| Conflicts with the prior task | Q5 reverses the prior rule that an unpaired tablet may sign in. The prior concurrency override (12 / 16) is not reused; D6 sets 6 / 8. A defect of the prior task is repaired first: two calendar-dependent web tests (F20, W01) |
| What this agent read of the prior task | For rev 1: its blueprint, 06_packaging_spec §2.6, the KI lines of `verification/01_verification.md`. For rev 2: nothing further; the plan cites the KI texts (02_plan §17) |

---

## Architecture Challenge & Refinement

### Memory and history screen (STEP 0, repeated for rev 2)

- The memory folder holds six entry files and `MEMORY.md` (Glob on 2026-10-04); `memory/refs/` and `memory/tasks/` do not exist. Four entries were re-read for this revision: the environment gotchas, the parallelism feedback, the autonomy feedback and the project state.
- Applied to this revision:
  - **reference-dems-environment-gotchas**: another project owns `[::1]:5173`, `127.0.0.1:5174` and `[::1]:5175`; DEMS lanes are 5176-5178; sandbox bypass per command; never `cd`; emulators boot cold only. The entry also says macOS keeps agent-started emulators at background priority and that booting them from the user's own Terminal is the workaround: relevant to W02.
  - **feedback-parallelism-push-to-limit**: wide waves are wanted, 12 / 16 overloaded this Mac. D6 (6 / 8) holds; the load guard of the plan is carried into P9.
  - **feedback-autonomy-with-decision-log**: the autonomy never covered outward-facing or hard-to-reverse actions. D1 repeats that limit for this task.
  - **project-dems-demo-state**: baseline `acaff20`; never commit `release/`, `apps/mobile/signing/` or the design book.
- **Template skill and Graft**: not available in this agent's tool set (no Skill tool; the Graft tools are deferred and not needed for document work, CLAUDE.md §10). The structure follows the agent instructions and rev 1.
- **No command was run by this agent** (it has no shell). The mechanical checks of this revision are Grep counts over the specification files and over this file; they are named in the Self-checks.

### Status of the facts that rev 1 verified in code

| Rev 1 fact | Status after research | Source |
|---|---|---|
| F-A1 `SimActions` has 42 members, many with a synchronous return | Confirmed: 42 members; 14 return a value synchronously | F14, F12 |
| F-A2 30 persisted state slices | Corrected: 30 of 33 slices persist | F14 |
| F-A3 one `Sim` object behind `useSim` and `useSimActions` | Confirmed | F12, F15 |
| F-A4 167 web and 140 mobile files import the simulator | Confirmed, split into production, test and harness files | F12, F15 |
| F-A5 the simulator core is platform-neutral | Confirmed by reading; the headless run under Node is proof (d), W04 | F14 |
| F-A6 3 roles, 9 permissions, missing audit types | Confirmed; the target is 12 permissions and 53 audit types | F14, D13 |
| F-A7 one any-of permission; demo controls need no sign-in | Confirmed; Live mode puts them behind `DEMO_CONTROL` and a flag | D13 |
| F-A8 pairing compares with a constant | Confirmed | F14 |
| F-A9 10 operations, 9 answered inside the client | Confirmed; the target is 75 | F4, D13 |
| F-A10 no environment override; the origin allowlist holds port 5173 | Confirmed; the server keeps its own two origin lists, `WEB_DEV_ORIGINS` is not edited | F9, D16 |
| F-A11, F-A12 mock-core and the launcher | Confirmed; neither is written | F9 |
| F-A13 `VITE_DEMS_CORE_ORIGIN` | Confirmed; Live mode uses a same-origin dev proxy | F12, D11 |
| F-A14 two Core link sources on mobile | Confirmed; `LIVE` becomes the third | F15 |
| F-A15 no secure storage, camera or QR library | Confirmed; `expo-secure-store` and `qrcode.react` are added, no camera module | F16, DR-02 |
| F-A16 `sim-adapter.ts` files | Confirmed; the Live source sits behind eight seam files | D11, D15 |
| F-A17 workspace globs | Confirmed: `apps/core-server` registers with no root edit | F9 |
| F-A18 no ignore rule for a data directory | Confirmed; W03 adds `/.data/` before the folder exists | F9 |
| F-A19 the release APK allows no cleartext | Confirmed; unchanged by this task | D4 |
| F-A20 which build each emulator holds | Still unknown: W06 measures it; decision point DP-1 | 02_plan GP-03 |

### Challenge table (rev 2)

| Dimension | Challenge | Resolution in this revision |
|---|---|---|
| Intent | Does the confirmed breakdown still prove "one system"? | SC3, SC4 and SC5 each keep an automated acceptance test (W49, W47, W48) and an end-to-end row (W95, W96, W94) |
| Scale category | Still Enhancement (major) with a Migration component? | Yes. The dataset mapping is W20; no initial-project protocol |
| Source | Is every refined row traceable? | Each row starts with its plan ID; the plan row cites the specification sections |
| Spec | Is every criterion owned? | AC-B 93 of 93, AC-C 110 of 110, SR 82 of 82 (coverage tables below) |
| Impact | What can break during the run? | The host register H-01..H-18 with verbatim rollbacks (02_plan §14); the protocol P1-P25; the regression row W97 |
| Goals | Are the gates measurable? | Every Verification cell names a command or an observable and its expected result |
| Scope | What left the scope since rev 1? | Media serving by the server (D13); QR scanning on the device (DR-02); a live package for another PC (D11) |
| Constraints | New non-functional rules? | Three database roles; a denial budget; loopback origins without `localhost`; `--maxWorkers=2` per workspace |
| Assumptions | Which are still unexecuted? | Seven early proofs, each with a time box and a fallback row |
| History | Does a prior rule change? | P14 (one shared Vite server) is replaced by lanes; four npm slots become three |
| Multi-document | Are all inputs present? | Yes. The consistency report of row 19 arrived during revision 2 (PASS-WITH-NOTES); plan revision 2.1 landed afterwards and revision 2.1 of this file is aligned with it |

### Architecture questions of rev 1: closed by D11

| ID | Choice | Where it is built |
|---|---|---|
| ADQ-1 | The server hosts the shared simulator core headless; identity, pairing, persistence and clock are server-native | W04 (proof), W26 |
| ADQ-2 | A Live source behind the existing `useSim` contract; TanStack Query for the two new portal pages | W18, W44, W50, W51 |
| ADQ-3 | Asynchronous Live actions with the same names and result shapes; a settle helper; Simulated mode stays synchronous | W18, the page and screen rows |
| ADQ-4 | Tables for records; one snapshot row with one column per slice for simulated hardware; meter frames never stored | W17, W20, W26 |
| ADQ-5 | Core server on `127.0.0.1:4420`; mock-core and the launcher unchanged | W08 |
| ADQ-6 | Web through a same-origin Vite dev proxy with a cookie; mobile with a bearer header; no CORS plugin | W05 (proof), W23, W24 |
| ADQ-7 | Development builds offer both modes and default to Simulated; packaged builds stay Simulated-only; no silent fallback | W50, W51, W82 |
| ADQ-8 | `apps/core-server`, package `@dems/core-server` | W03, W08 |
| ADQ-9 | Additive permissions and audit types in the shared vocabulary | W16 |
| ADQ-10 | Three lane backends on 4421-4423 with their own databases; serial ownership of 4420 for gates and end-to-end rows | P14, P18 |

### Impact questions: all 25 answered

| Questions | Answered in |
|---|---|
| 1-3, 8-21 | `masterplan/01_specs.md` §17.4 |
| 6, 7, 9, 14 | `masterplan/03_database_contract.md` |
| 1, 16, 17, 19, 23 | `masterplan/04_client_integration_spec.md` |
| 4, 5, 22, 24, 25 | `masterplan/02_plan.md` §14, §15, §16, §12, §17 |

The map of all 25 is `research/03_analysis.md` §8. Row 19 confirmed every anchor (its §2.2: 25 of 25 PASS); this revision did not repeat that check.

### Assumptions of rev 1: status

| ID | Assumption | Status |
|---|---|---|
| H-B1 | The shared transition code runs unchanged in Node | Unexecuted. Proof (d), W04; fallback Fd |
| H-B2 | A Live source can sit behind the `useSim` contract | Decided (ADQ-2, eight seam files); proven by W44 and the first client rows |
| H-B3 | PostgreSQL from npm-distributed binaries runs on this host | Unexecuted. Proof (b), W03 and W07; fallback Fb |
| H-B4 | 20 Hz meter messages keep both clients smooth | Unmeasured. The send policy drops meter frames per client (W42); measured by W98 |
| H-B5 | A device credential can be stored and protected on the emulators | Unexecuted. Proof (g), W15; decision point DP-2 |
| H-B6 | The emulators hold a build that a debug APK can replace | Unknown. W06; decision point DP-1 |
| H-B7 | One row can write the server specification | Closed: row 15 delivered it |

### Edge cases and where each is handled

| ID | Edge case | Rows |
|---|---|---|
| E1 | The backend stops while a session is recording | W26, W53, W73 |
| E2 | A role is changed, or a user disabled, while signed in on both clients | W33, W42, W96 |
| E3 | A device is revoked while it is signed in and recording | W48, W60 |
| E4 | The last holder of the administration permission removes it | W33, W77 |
| E5 | Two clients start a session at the same moment | W34 |
| E6 | A pairing code is redeemed twice, after expiry, or during a lock | W32 |
| E7 | The app is reinstalled on a paired device | W57 |
| E8 | The packaged web build must keep Live code inert | W50, W97 |
| E9 | Live mode with the backend unreachable | No silent fallback (ADQ-7); W50, W51, W54 |
| E10 | Stored keys of the clients when the mode changes | Never deleted (P21) |
| E11 | Another PostgreSQL on the chosen port | W06, W07 probe 4432 |
| E12 | Concurrent audit appends | W17, W21 |
| E13 | The seed runs on another date than the demo packages | W20 (seed as of the server clock) |
| E14 | Demo controls need a permission in Live mode | W43, W76, W82 |

### Scope refinement

- **In scope**: as in the translated task, plus what the specifications added: a bulk synthetic fixture for tests, two new portal pages, a mode selector in both clients, three database roles, a lineage table for discarded audit chains, a denial budget, two checkpoint commits.
- **Out of scope**: real hardware, real PKI or mTLS, TLS, an external identity provider, production hardening, iOS, a visual redesign, publishing, a git remote, a release APK with Live mode, a live package for another PC (costed only), **serving media from the server** (D13), **QR scanning on the device** (DR-02), any change to `apps/mock-core`, `release/`, `scripts/release/`, the demo media or the demo evidence packages.
- **Boundary conditions**: additive work only. Every listener binds 127.0.0.1. No Docker, no cloud, no account. Seed data is synthetic. Secrets are generated locally and git-ignored. The ports `[::1]:5173`, `127.0.0.1:5174` and `[::1]:5175` are never bound and their owners never stopped. Emulators are never killed, never booted from a snapshot, never wiped.

### Constraint enhancement

- **Functional**: FR1 one backend serves all 13 feature areas (75 operations); FR2 state survives a restart; FR3 server-side RBAC with a denial audit row; FR4 role administration in the portal; FR5 pairing issue, redeem, list, revoke, re-pair; FR6 pairing gate on mobile in Live mode; FR7 realtime channel with resync; FR8 Live and Simulated modes in both clients; FR9 seed and reset; FR10 the OpenAPI document covers every operation.
- **Non-functional**: NFR1 loopback only; NFR2 no secret in git, logs, URLs, events or audit rows; NFR3 audit rows are append-only and chained, for every database role; NFR4 the 20 Hz meters stay smooth (I8); NFR5 no per-frame database writes; NFR6 the existing suites stay green, and the root gate needs no database (D9); NFR7 every host change has a verbatim rollback; NFR8 ready-made frameworks, with fifteen recorded hand-built elements (D12); NFR9 tests run with two workers at most; NFR10 the running server never connects as a superuser (DR-03).

### Confirmed workspace layout (additions only; exact paths per row are in 02_plan §8)

```
/Users/gsp-budi/Documents/DEMS/
├── .data/                         git-ignored: the cluster, the server log, three credential files (W07)
├── scripts/pg/                    lifecycle scripts and checks of the project-local PostgreSQL (W07)
├── apps/
│   ├── core-server/               NEW (W03, W08): src/{index,app,config}.ts, src/plugins/, src/core/,
│   │                              src/engine/, src/realtime/, src/modules/<14 folders>/,
│   │                              src/db/{schema,migrations,commands,mapping,seed,fixtures,reset}/,
│   │                              test/{static,helpers/db,db,acceptance}/
│   ├── core-web/                  + vite proxy, src/runtime/, src/routes/_app/admin/,
│   │                              features/users-roles/, features/paired-devices/, src/test/live-*
│   ├── mobile/                    runtime, auth, pairing, navigation and sixteen feature folders in Live mode
│   └── mock-core/                 unchanged
└── packages/shared/src/
    ├── api/                       the contract for 75 operations (one owner at a time)
    ├── client/                    NEW typed REST client (W12)
    ├── realtime/                  + live socket client (W30)
    ├── live/                      NEW light API (W18), source/ (W44), testing/ (W31)
    └── sim/                       unchanged, except additive values in vocabulary.ts and auth.ts (W16)
```

### Blueprint shape

- **Rows 1-22 stay FIRM.** Rows 1-21 are done (row 19 finished while revision 2 was written; revision 2 of this file was accepted by D22 and revision 2.1 is its alignment patch); row 22 is next.
- **Rows 23-127 are CONFIRMED.** One blueprint row per plan work row; no plan row was split and none was merged further. The plan's own splits, merges and moves against rev 1 are listed in the Refinement Log.
- **Numbering.** Step = plan number + 22 for W01 to W102 (steps 23 to 124). The two checkpoint commits come next (W104 = 125, W105 = 126) and the final commit is last (W103 = 127), because W103 depends on W105 and every dependency must point to a lower step.
- **Six rows span more than one folder** by the plan's accepted merges (W37, W40, W66, W71, W72, W79). Each keeps one owner, one output and one verification; the Self-checks state the reason and the split recipe.
- **Conditional rows** (Fb, Fc, Fd, Fe, Ff, Fh) and the reserved numbers W106-W109 are listed below the table. They receive a step number only when the controller triggers them.
- **Controller-owned artifacts, not rows**: `gateway_check/01_gate_report.md`, `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `report/report.md`.

### Scale Category Design Matrix

| Dimension | Finding | Evidence source | Design consequence |
|---|---|---|---|
| **Scale category** | Enhancement (major) with a Migration component | `identification/01_translated.md`, Intent | Delta design on two existing clients; a mapping module for the dataset; regression against the baseline |
| **Source** | The simulator's action and state layer is the behaviour to reproduce | Rows 1-5 (F4-F15) | The server hosts the shared simulator core (ADQ-1); the clients keep their contract (ADQ-2) |
| **Spec** | 75 operations, 30 tables, 285 numbered criteria and requirements | D13, D14, D15, D18, D19 | Every refined row cites its IDs; the coverage tables below |
| **Impact** | The host, 307 client files, the shared contract, three emulators | 02_plan §10, §14 | Protocol P1-P25; gates W58 and W89; regression W97 |
| **Migration component** | `sim/dataset.ts` and `src/demo-data/` to PostgreSQL tables | 03_database_contract §9 | W20 (mapping and seed), W29 (reset), W90 (clean-state rebuild) |

### Source → Spec → Impact research design: status

| Layer | Rows | Artifacts | Status |
|---|---|---|---|
| Source (code) | 1-5 | `research/01_explore.md`, `01b`-`01e` | Done |
| Source (external) | 6-12 | `research/02_collection.md`, `02b`-`02g` | Done |
| Source (baseline) | 13 | `initialization/02_baseline_gate.md` | Done, PASS-WITH-NOTES (D10) |
| Spec | 14-17 | `research/03_analysis.md`, `masterplan/01_specs.md`, `03_database_contract.md`, `04_client_integration_spec.md` | Done (rev 2, rev 2.1, rev 2) |
| Impact | 18, 19, 20 | `masterplan/02_plan.md`, `gateway_check/02_masterplan_consistency.md`, `gateway_check/03_security_design_review.md` | Done: plan rev 2 (D20), the security review (CAUTION, D16), the consistency check (PASS-WITH-NOTES: 0 Blocker, 2 Major, 11 Minor, all text) |

### Items the controller should report to the user (approval is pre-granted under D1)

| # | Item | State |
|---|---|---|
| MJ-1 | A PostgreSQL server is provisioned on this Mac | Route fixed: PostgreSQL 18.4 from npm binaries, `127.0.0.1:4432`, data in `.data/`; removal by `npm run pg:remove` (written, the package part not executed) |
| MJ-2 | Pairing is mandatory for mobile in Live mode | Unchanged |
| MJ-3 | Mobile Live mode works in a debug build on the emulators only | Unchanged |
| MJ-4 | No live package for another PC | Confirmed by D11: cost recorded, nothing built |
| MJ-5 | Two new portal pages and three new permissions, all on SUPERVISOR | Confirmed by D13 |
| MJ-6 | The security-key button and biometric sign-in change in Live mode | Confirmed; biometric unlock uses a server-issued single-use token |
| MJ-7 | A mobile native rebuild; an emulator with the release-signed build | Decided (DP-1, option A): such an emulator is left as it is; an uninstall needs a recorded decision |
| MJ-8 | Size | 127 rows; 105 of them confirmed implementation, test, gate and verification rows |
| MJ-9 | `apps/mock-core`, the simulator and `release/` are not changed | Unchanged; proven by W97 |
| MJ-10 | **B.9 class of this revision: MAJOR** | Restructured flow, new modules, one concern moved to another agent type, security scope added (Refinement Log) |
| MJ-11 | Three database roles and three credential files instead of two roles | DR-03 |
| MJ-12 | QR scanning on the device is deferred; the portal still shows the QR | DR-02 |
| MJ-13 | In Live mode the console must be opened at `http://127.0.0.1:<port>`, never at `localhost` | D18, F25 |
| MJ-14 | The published demo password is accepted in Live mode only while every listener is on loopback | D16 |
| MJ-15 | Two local checkpoint commits besides the docs commit and the final commit | D17 |
| MJ-16 | W90 removes and rebuilds the git-ignored `.data/` as the proof of the removal command; W06 removes two stale lock markers of the predecessor session | D5, D9 |

### Professional Document Flag

Not set. Output format is markdown.

---

## Structured Task Breakdown

> **PRIMARY OUTPUT: controller-executable table.** Each row is one delegation unit.
> - Expected Output paths are relative to `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/`. Code paths are relative to `/Users/gsp-budi/Documents/DEMS/`.
> - **Rows 1-22 are FIRM** and carry their status: `[DONE]`, `[IN PROGRESS]`, `[NEXT]`.
> - **Rows 23-127 are CONFIRMED.** Each starts with its plan ID, so a row can be delegated by step or by ID. Step = plan number + 22 for W01-W102; W104 = 125; W105 = 126; W103 = 127.
> - "Plan Wnn" means the row of `masterplan/02_plan.md` §8 with that ID. Its scope, owned write paths, locks and ports, Implements IDs, verification cases and rollback are binding; the cell here is their summary. This file is aligned with plan revision 2.1; the three deliberate differences that remain are RL-22, RL-23 and RL-29 of the Refinement Log.
> - A row whose text says "starts only after ... DP-n" needs that controller record in addition to its Depends On.
> - Model tier is R unless the row says tier D.
> - SG, MODG and CLG in a Verification cell are the gates defined below the table. R-NEW, R-CO, R-PRE, R-NONE and H-nn are the rollback classes defined there.
> - Paste the **Parallel Execution Protocol** (below the table) and the Documentation Contract block into every delegation. Each row writes its own `delegation_progress/<agent_name>_step_<N>.md`.

| Step | Task Description | Agent_to_Invoke | Expected Output | Depends On | Verification | Phase |
|------|------------------|-----------------|-----------------|------------|--------------|-------|
| 1 | [DONE] Inventory the shared simulator `packages/shared/src/sim/` read-only (Graft first, CLAUDE.md §10): every member of `SimActions` with its signature, synchronous return type, permission check, state slices written, audit and event types emitted; every exported selector and view with the slices it reads; engine subsystems with tick rates; error codes; snapshot keys; which transition modules are pure and platform-neutral. Tier 2 block | explore | research/01_explore.md (Tier 2; DONE, 706 lines, gate PASS, F14) | — | Action table row count equals the `SimActions` member count (both quoted with file:line); listed selectors equal the export counts of selectors.ts, views.ts and derive.ts; every row cites file:line; zero web tool calls | research |
| 2 | [DONE] Inventory the API contract and the demo dataset read-only: the operations in `packages/shared/src/api/` (schemas, badges, error envelope, generator script, drift test, realtime message schemas, network constants with every consumer); the canonical dataset in `sim/dataset.ts`, `sim/initial-state.ts` and `sim/generator.ts` (operators, roles, Core device, evidence items, scenarios, date-relative rules); `src/demo-data/` with its join rule; media under `assets/` with sizes. Tier 2 block | explore | research/01b_explore_contract_dataset.md (Tier 2; DONE, 629 lines, gate PASS, F4-F7) | — | Operation table has one row per entry of `CORE_API_OPERATIONS` (count quoted); every seeded entity is listed with its count and file:line; media file count and total size quoted from a listing; the stale description of KI-18 quoted with file:line | research |
| 3 | [DONE] Inventory how `apps/core-web` consumes the simulator, read-only, grouped by feature folder plus `components/`, `routes/`, `lib/` and `main.tsx`: selectors read, actions called, call sites that use an action's synchronous return value, direct store access, each `sim-adapter.ts`; the sign-in, stored-session, route-guard, permission-gating and pairing-display code; `core-endpoint.ts`; `packaged-csp.ts`; the API Reference simulated-fetch path; tests that construct a simulator. Tier 2 block | explore | research/01c_explore_web.md (Tier 2; DONE, 700 lines, gate PASS, F12) | — | Every file matching `@dems/shared/sim` under `apps/core-web/src` (count quoted at run time; 167 at blueprint time) appears in exactly one group; each synchronous-return call site has file:line; storage keys and guards are quoted from code | research |
| 4 | [DONE] Inventory how `apps/mobile` consumes the simulator, read-only, grouped by feature folder plus `src/runtime/`, `src/providers/`, `src/auth/`, `src/app/` and `src/navigation/`: selectors read, actions called, synchronous-return call sites, each `sim-adapter.ts`; the Core link sources, sign-in, biometric, pairing and route-guard code; storage keys; `app.json` plugins and cleartext policy; the `reverse` and `e2e` scripts; test harnesses; `scripts/device-session.sh` targets. Tier 2 block | explore | research/01d_explore_mobile.md (Tier 2; DONE, 741 lines, gate PASS, F15) | — | Every file matching `@dems/shared/sim` under `apps/mobile/src` (count quoted at run time; 140 at blueprint time) appears in exactly one group; each synchronous-return call site has file:line; storage keys, guards and the cleartext setting are quoted from code | research |
| 5 | [DONE] Inventory the service and packaging coupling read-only: `apps/mock-core` (app factory, CORS and socket origin rules, heartbeat, error log, tests), the standalone launcher (what it duplicates from the shared contract and which test guards it), `scripts/release/`, a listing of `release/` with its checksum files, root `package.json` scripts and workspace globs, `tsconfig.base.json`, `.gitignore` coverage, `.locks` conventions; list every constant or path a second backend on another port would touch. Tier 2 block | explore | research/01e_explore_services_packaging.md (Tier 2; DONE, 577 lines, gate PASS, F8, F9) | — | Coupling table gives file:line for each mock-core and launcher dependency on `@dems/shared`; a "must not change" list names every file whose change would alter the 0.1.0 packages' sources; the `release/` listing is quoted and no file under it was opened for writing; root script table quoted | research |
| 6 | [DONE] Collect evidence on providing a real PostgreSQL server on macOS arm64 without Docker and without a host service, with generic technology queries only (I2): npm-distributed PostgreSQL binaries, a Homebrew keg run with `pg_ctl` from project scripts, other self-contained distributions; per candidate: version, licence, maintainer, platform coverage (also Windows x64, Linux x64, macOS x64 for the Q7 cost), install size, start, stop and removal commands, known issues on Node 26. Tier 2 block | data-collector | research/02_collection.md (Tier 2; DONE, 577 lines, gate PASS, F13) | — | At least 3 candidates, each with a URL and fetch date for version, licence and platform coverage; candidates that need Docker, an account, a cloud service or a system service are marked excluded with the reason (U1, U2, U5); the query log lists every query and contains no design-book term | research |
| 7 | [DONE] Collect evidence on typed PostgreSQL access layers for Node 26.8.2 and TypeScript 6.0.3 with their migration and seed tooling, with generic queries only: per candidate: version, licence, driver, migration model (SQL files or generated), reset and rollback support, type-safety approach, zod 4 interoperability, maintenance signals. Tier 2 block | data-collector | research/02b_collection_data_access.md (Tier 2; DONE, 373 lines, gate PASS, F10, F11) | — | At least 4 candidates, each with a URL and fetch date for version, licence and migration model; a comparison table has no empty cell; the query log contains no design-book term | research |
| 8 | [DONE] Collect evidence on the server runtime, with generic queries only: Fastify 5.x on Node 26 and the current versions of the official plugins a database-backed API needs (CORS, WebSocket, cookie or session, rate limit, static files with range requests, OpenAPI generation, schema type providers for zod 4); single-process WebSocket fan-out patterns (topics, backpressure, 20 Hz broadcast, authentication at upgrade). Tier 2 block | data-collector | research/02c_collection_server_runtime.md (Tier 2; DONE, 764 lines, gate PASS, F17) | — | Every plugin row has version, licence, Fastify 5 compatibility and a URL with fetch date; at least 2 fan-out patterns with sources; the query log contains no design-book term | research |
| 9 | [DONE] Collect evidence on contract tooling, with generic queries only: OpenAPI-first versus code-first for a TypeScript monorepo; generators and typed clients usable in a browser and in React Native 0.86 on Hermes (fetch-based, no Node built-ins); runtime validation with zod 4; drift and conformance test tools. Tier 2 block | data-collector | research/02d_collection_contract_tooling.md (Tier 2; DONE, gate PASS, F18) | — | At least 2 candidates per approach, each with version, licence, Hermes suitability and a URL with fetch date; the query log contains no design-book term | research |
| 10 | [DONE] Collect evidence on identity security, with generic queries only: password hashing for Node 26 (algorithm, parameters, native versus pure implementations); session versus token models for a browser plus a React Native app on loopback; rotation and revocation; lockout and rate limiting; RBAC libraries versus a permission guard for Fastify; cite current public guidance. Tier 2 block | data-collector | research/02e_collection_identity_security.md (Tier 2; DONE, gate PASS) | — | At least 2 options per topic; every recommended parameter cites a source URL with fetch date; options that need an account or a hosted service are marked excluded (U5); the query log contains no design-book term | research |
| 11 | [DONE] Collect evidence on the mobile device credential and QR, with generic queries only: credential storage on Android under Expo SDK 57 (secure-storage module, biometric-protected items, emulator behaviour, behaviour on reinstall); QR rendering in React 19 web; QR scanning in React Native 0.86 on Expo (camera module, emulator support, permission footprint); per candidate: version, licence, native rebuild need. Tier 2 block | data-collector | research/02f_collection_device_credential_qr.md (Tier 2; DONE, 475 lines, gate PASS, F16) | — | At least 2 candidates per topic, each with version, licence, SDK 57 compatibility and a URL with fetch date; the native rebuild need is stated per candidate; the query log contains no design-book term | research |
| 12 | [DONE] Collect evidence on test tooling for a PostgreSQL-backed Fastify API with Vitest 5, with generic queries only: in-process injection; database isolation per test or per worker (template databases, schemas, transactions); WebSocket testing; coverage; end-to-end options for a web console plus an Android emulator pair, including the Maestro CLI already on the host. Tier 2 block | data-collector | research/02g_collection_test_tooling.md (Tier 2; DONE, gate PASS, F19) | — | At least 2 isolation strategies with sources and their cost per test run; every tool has version, licence and a URL with fetch date; the query log contains no design-book term | research |
| 13 | [DONE] Run the root gate on the unchanged baseline tree (commit `acaff20` plus uncommitted docs): `npm run typecheck`, `npm run lint` and `npm test` with two workers at most for the shared, mock-core, core-web and mobile workspaces; start no server; change no file | verifier | initialization/02_baseline_gate.md (Tier 3; DONE, PASS-WITH-NOTES, D10, F20) | — | Exit code plus test-file and test counts per workspace quoted from the runner; each failing test named and classified as pre-existing; `git status --porcelain` is identical before and after except this row's docs files | initialization |
| 14 | [DONE] Analyse rows 1-12 into the decision record: one record per technology topic TD-01..TD-13 (backend framework; PostgreSQL provisioning in the D5 preference order; data access; migrations and seed tooling; password hashing; session or token model; RBAC pattern; realtime fan-out; contract tooling and typed clients; device credential storage; QR; test tooling; portable PostgreSQL for a live package, cost only) and one per architecture question ADQ-1..ADQ-10 of this blueprint, each with options, criteria, evidence, the choice, the rejected options and the rollback; a Host Impact Register; a table mapping the 25 impact questions to the document and section that will answer each; a gap and risk register; an index of rows 1-12. Tier 1 block | data-analyst | research/03_analysis.md (Tier 1; DONE, 979 lines, gate PASS, D11, D12) | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 | 23 decision records present, each with a pinned version or a named pattern, at least one citation to rows 1-12 and the rejected options; TD-02 gives install, start, stop and removal commands and states no Docker, no login service, loopback only; all 25 impact questions mapped; every assumption labelled; Tier 1 elements present | research |
| 15 | [DONE] Write the system specification (server side, canonical): architecture with the process and port model; state ownership (stored, engine-held, streamed only); the API contract for all 13 feature areas as operation tables (operationId, method, path, permission, audit type, request and response shape); the RBAC model with the full permission list and the role-permission matrix; sign-in, session, lockout and idle expiry; the pairing lifecycle with the device credential; the server-side simulation engine for hardware signals with restart recovery; the realtime protocol with authentication and resync; the Live versus Simulated mode contract; media serving; demo controls; security requirements SR-nn; numbered acceptance criteria AC-B-nn; traceability to SC1-SC11, C1-C7, I1-I13 and Q1-Q16. Tier 1 block | data-analyst | masterplan/01_specs.md (Tier 1; DONE, revision 2, 2,226 lines, D13, D18) | 14 | Each of the 13 feature areas has an operation table; every `SimActions` member from row 1 maps to an operation or to a recorded exclusion; the matrix covers every role and permission; the pairing state table names an audit type per transition; every AC-B is testable by a command or an observable and traces to a success criterion; impact questions 1-3, 8-21 answered with section anchors; no U1-U9 item is required; any departure from a Q1-Q16 default is flagged for a decision | masterplan |
| 16 | [DONE] Write the database contract for PostgreSQL from row 15: tables, columns, types, keys, constraints, indexes; how the audit table is append-only and how its hash chain is serialised under concurrent writers; migration naming, order and reset; the seed mapping from the dataset of row 2 with the date-relative rule; test-database isolation; bulk-fixture minimum row counts per entity; a database design checklist (keys, constraints, indexes, naming, normalisation, audit columns, migration order and reset, seed and test isolation). Tier 1 block | database-specialist | masterplan/03_database_contract.md (Tier 1; DONE, revision 2.1, 2,641 lines, D14, D19) | 15 | Every stored entity of row 15 has a table; every dataset entity of row 2 has a target table in the seed mapping; the append-only and chain-serialisation mechanisms are stated as database features with a test idea each; the checklist has no empty item; impact questions 6, 7, 9 and 14 answered with section anchors | masterplan |
| 17 | [DONE] Write the client integration specification from row 15 and rows 3-4: the shared typed client, the Live data source and the mode switch per build type (dev, test, packaged web, release APK) with the UI label in each mode; a wiring map of every web and mobile feature folder to its operations and realtime topics; the Live behaviour of every synchronous-return call site; sign-in, stored session and trust-line wording on the web; credential storage, biometric unlock, the pairing flow and the pairing-required gate on mobile; the two new portal pages (Users & Roles, Paired Devices with code issue and QR) built from the existing component kit; CORS and CSP changes; the API Reference page; numbered acceptance criteria AC-C-nn. Tier 1 block | data-analyst | masterplan/04_client_integration_spec.md (Tier 1; DONE, revision 2, 1,599 lines, D15, D18) | 15 | Every feature folder listed by rows 3 and 4 appears in the wiring map; every synchronous-return call site has a stated Live behaviour; each new page has a component list, states, permissions and test IDs; the pairing flow and the gate have state tables; every AC-C is testable; impact questions 1, 16, 17, 19 and 23 answered with section anchors | masterplan |
| 18 | [DONE] Write the implementation plan from rows 13-17: work rows with owner agent, owned write paths, dependencies, verification command and rollback; pinned versions with licences for every new dependency; the serial slots (npm, Gradle, migration writer, contract owner, backend port, PostgreSQL instance); the port table; waves within D6; the lane model for live checks (ADQ-10); the Host Impact Register with a verbatim rollback per host change; the test strategy; the predecessor known issues touched (KI-01, KI-02, KI-07, KI-18). Tier 1 block | data-analyst | masterplan/02_plan.md (Tier 1; DONE, revision 2.1, D17, D20, D21) | 13, 15, 16, 17 | Every AC-B and AC-C maps to at least one work row; a collision scan table shows no shared write path, lock or port among rows that may run together; every host change has a verbatim rollback; every dependency is pinned; impact questions 4, 5, 22, 24 and 25 answered with section anchors | masterplan |
| 19 | [DONE] Check the masterplan for coverage and cross-consistency, read-only: 13 feature areas, 25 impact questions, SC1-SC11, Q1-Q16, U1-U9 against rows 15-18; every operation has a permission and an audit type; every stored entity has a table; every AC has a plan row; every plan row has owned write paths | verifier | gateway_check/02_masterplan_consistency.md (Tier 2; DONE, PASS-WITH-NOTES, ran beside row 21 per DR-04) | 18 | A matrix marks each of the 13 areas, 25 questions, 11 criteria and 16 defaults PASS or FAIL with a section anchor; zero operations without permission or audit type; zero entities without a table; zero AC without a plan row; each FAIL names the owning row | gateway_check |
| 20 | [DONE] Review the security design of rows 15-17, read-only: password storage, session or token model, lockout, pairing code and device credential, WebSocket authentication, secrets handling, CORS and CSP, audit immutability, loopback binding, log redaction, demo controls, the seed's demo password. Tier 1 block | security-review | gateway_check/03_security_design_review.md (Tier 1; DONE, verdict CAUTION, 440 lines, D16) | 15, 16, 17 | Verdict stated; every checklist item cites a spec section; each CAUTION or FAIL names the owning row and the expected correction; no finding requires a U1-U9 action | gateway_check |
| 21 | [DONE] Refine this blueprint (B.9): re-read this file, then research/03_analysis.md, masterplan/01_specs.md, 02_plan.md, 03_database_contract.md, 04_client_integration_spec.md and both gate reports; replace rows 23-118 with the confirmed breakdown (split any broad row into single-owner, single-verification units; fix write paths, locks, ports, waves and model tiers from 02_plan); classify the change MAJOR or MINOR; the output is this file only | task-architect | identification/02_structured.md (Tier 2; DONE, rev 2 accepted by D22 with class MAJOR; rev 2.1 is the alignment patch with plan revision 2.1) | 18, 20 | Every implementation row cites its 02_plan work row and its AC IDs; every AC of rows 15-17 is covered by a row; the collision scan shows no shared write path, lock or port inside a wave; per-type and in-flight counts stay within D6; a Refinement Log lists each change against rev 1 with its class | masterplan |
| 22 | [NEXT] Create the first local docs commit: this task's folder plus the predecessor's uncommitted trackers and report (D3), staged by explicit path; no code file, no remote, no push | git-specialist | initialization/03_docs_commit.md (Tier 3; NEXT) | 19, 21 | `git log -1 --stat` quoted with paths under `docs/` only; `git remote -v` empty; the commit time is recorded as the SC1 reference; `git status --porcelain` otherwise unchanged | initialization |
| 23 | [W01] Baseline fix slot (early proof a, time box 30 min): give the two calendar-dependent web tests a fixed simulator clock (`createManualClock` at 2026-10-01 10:00 WIB); test files only, no production file. Plan W01 (02_plan §8.2, §6). Writes: `apps/core-web/src/test/sim-fetch.test.ts`, `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx`. Locks: none. Implements D10(a), F20; AC-B-59 (recorded change); precondition of AC-B-58 and AC-C-101. Rollback R-CO | coder-execution | implementation/01_baseline_test_fix.md (Tier 3) | 22 | `npm run test -w @dems/core-web -- --maxWorkers=2` prints 438 passed of 438, and the two files print 24 passed of 24 under the shifted-clock preload of the baseline gate report §6.2 at 2026-10-04 00:10 WIB and at 2026-10-02 12:00 WIB; the row log records the output of `git hash-object` for each of the two files, and these two values are "W01's state" for steps 93, 106, 111 and 119 | implementation |
| 24 | [W02] Emulator cold boot, tier D (`model="sonnet"`): boot `dems_phone` (5554), `dems_tablet` (5556) and `dems_phone2` (5558) with the cold-boot commands of 02_plan §5.5 (`-no-snapshot-load -no-snapshot-save`), outside the sandbox; no install, no app start; `npm run emulator` is not used. Plan W02. Writes: `.locks/dems_phone.pid`, `.locks/dems_tablet.pid`, `.locks/dems_phone2.pid`. Locks: the three device locks. Implements P3 (no AC or SR). Rollback H-14 (the user closes the windows; an agent never kills an emulator) | coder-execution | initialization/05_emulator_cold_boot.md (Tier 3) | 22 | `adb devices` lists emulator-5554, emulator-5556 and emulator-5558 as `device`; each `adb -s <serial> shell getprop sys.boot_completed` prints 1; the three process command lines contain `-no-snapshot-load -no-snapshot-save` | initialization |
| 25 | [W03] npm slot N1 (early proof b, trial steps T1 and T8): add `/.data/` to `.gitignore` first; create the `@dems/core-server` manifest (version 0.2.0, scripts and pins of 02_plan §3), its `tsconfig.json`, its `vitest.config.ts` (projects `unit` and `db`, two workers), one version constant with its test; add the root dev dependencies and root scripts of §3.4 and the four `@dems/shared` export subpaths with one-line placeholders; read the install script of `@embedded-postgres/darwin-arm64`, approve it by exact name, run `npm audit signatures`; record `@types/pg` as resolved with `--save-exact`, two SHA-256 values (SU-1) and the `npm audit` output (SU-2); no blanket script approval (SU-3). Plan W03. Writes: `.gitignore`, root `package.json`, `package-lock.json`, five skeleton files under `apps/core-server/`, `packages/shared/package.json`, four placeholder `index.ts` files. Locks: npm. Implements SR-60, SR-76 (package), SR-80; AC-B-58, AC-B-91. Rollback H-01 | coder-execution | implementation/03_npm_slot_n1_server_shared.md (Tier 3) | 22 | `npm install` exits 0; the lockfile diff against `acaff20` holds only the slot-N1 packages of 02_plan §3.1 and their transitive dependencies (list quoted, with the resolved `@types/pg`); `npm install-scripts ls` prints no unreviewed script; `npm ls react react-dom --all` shows one copy each; root `npm run typecheck` and `npm run lint` exit 0 | implementation |
| 26 | [W04] Early proof d (time box 60 min): a scratch script that runs the shared `Sim` headless under Node with a manual clock, an injected scheduler and memory storage, and checks points d1 to d5 of 02_plan §6 (audit-type sequence, rehydration, RECORDING to FAULT on `POWER_FAIL`, ring-only `AUDIT_TAMPER`, actor scope cleared after a command that throws). Plan W04. Writes: `.cache/proof-engine/**` (scratch, git-ignored). Locks: none. Input to AC-B-52, AC-B-53 and SR-79. On failure: conditional row Fd. Rollback R-NEW | coder-execution | implementation/04_proof_headless_engine.md (Tier 3) | 22 | `node --import tsx .cache/proof-engine/headless.mts` exits 0 and prints `PROOF d1 PASS` to `PROOF d5 PASS` | implementation |
| 27 | [W05] Early proof f (time box 45 min): add the `server.proxy` block for `/api/v1` and `/ws` with `DEMS_CORE_PROXY_PORT` to the web Vite config (no `headers` option, no `changeOrigin`, no hook that changes a request header); write the throw-away proof harness; settle the lane start details of 02_plan §5.3. Plan W05. Writes: `apps/core-web/vite.config.ts`, `.cache/proof-harness/**`. Locks: lane 1 (ports 4421 and 5176). Implements AC-C-34 (transport), AC-C-102 (config). On failure: conditional row Ff, which returns to a security review first. Rollback R-CO, R-NEW | coder-execution | implementation/05_proof_vite_proxy.md (Tier 3) | 22 | With the harness on 4421 and the dev server on 5176: `curl -si` through 5176 returns the harness's `Set-Cookie`, `x-dems-epoch`, `x-dems-revision` and `retry-after`; the next request and a `ws` upgrade through 5176 reach the harness with `Cookie` and `Origin` unchanged (harness log quoted); Vite's own socket still connects; the core-web test run is unchanged; the proxy block holds no `headers`, no `changeOrigin` and no rewrite hook (quoted) | implementation |
| 28 | [W06] Environment check, read-only: every port of the P4 table free or owned as stated; the other project's listeners untouched; per emulator the build class (`DEBUG`, `RELEASE-SIGNED` or `NOT INSTALLED`) with the signing-certificate digest; Node and npm versions against the baseline; free disk space (figure only); whether the Maestro CLI starts outside the sandbox (KI-02); remove the two stale `user-manual-test` markers (D9 DN-4). The port section is written first, because step 29 waits for this row. An emulator that is not running is reported as such and does not hold the row: if step 24 ends `blocked`, the controller starts this row on that state, so the emulators cannot hold up the backend. Its result is the input of DP-1. Plan W06. Writes: only the removal of `.locks/mock-core.users/user-manual-test` and `.locks/vite.users/user-manual-test`. Locks: device (read-only `adb`). No AC or SR. Rollback H-16 | verifier | initialization/01_env_check.md (Tier 3) | 24 | Each check is marked PASS or FAIL with its command output quoted; the build class and certificate digest of each emulator are recorded; `node -v` is v26.8.2 and `npm -v` is 11.19.1; no process started by the row is left running | initialization |
| 29 | [W07] PostgreSQL provisioning with its trial (early proof b, time box 45 min): write `scripts/pg/` (init, start, stop, status, remove-data, remove, the host-authentication check, the superuser trigger check; plain `.mjs` with `node --test` files); `pg:init` per RP-1 to RP-6: `.data/` of mode 0700, three passwords into three files of mode 0600 that are never printed (`.data/pg.pwfile`, `.data/pg.owner.env`, `.data/pg.env`), `initdb` with `scram-sha-256`, one listener on `127.0.0.1:4432`, no Unix socket, both project roles created (`dems_owner` with CREATEDB and no superuser flag, `dems_app`); trial T2 to T7 with T3-a, T3-b, T5-a to T5-i as `dems_owner` and T5-j once as `dems_admin`; then the superuser connection is closed for good; record the SHA-256 of the three binaries (SU-1). It follows the port report of step 28 (consistency finding C-09; plan W07 depends on W03 and W06) and still probes 4432 itself with `lsof` immediately before the first start. Plan W07 (02_plan §8.2, §4.2, §7.3, §14). Writes: `scripts/pg/**`, `.data/**`, `.locks/postgres.pid`, `.locks/postgres.lock`. Port 4432. Implements AC-B-03 (4432), AC-B-64, AC-B-86 (scripts), AC-B-91 (binaries); SR-01, SR-02, SR-60, SR-68 (roles), SR-77, SR-80. On failure: conditional row Fb. Rollback H-02, H-03 | coder-execution | initialization/04_postgres_provisioning.md (Tier 3) | 25, 28 | `lsof -nP -iTCP:4432 -sTCP:LISTEN`, run immediately before the first start, is quoted and prints nothing; trial T2 to T7 with T3-a, T3-b and T5-a to T5-j all PASS with quoted output (T5-h recorded, not gating): the version string names 18.4; one listener on `127.0.0.1:4432`; a wrong password is refused with 28P01; as `dems_owner` `SET session_replication_role = replica` and `CREATE ROLE` fail with 42501; a row survives stop and start; no process, launchd job or brew service after stop; `git check-ignore -v` matches `.data/postgres` and the three credential files; `stat -f '%Lp'` prints 700 and 600; T5-j refuses UPDATE, DELETE and TRUNCATE with ZA002; `npm run test:pg-scripts` exits 0 | initialization |
| 30 | [W08] Backend scaffold with the health operation: app factory with no listen; entry bound to the constant `127.0.0.1`; config loader for `.data/pg.env`, `DEMS_CORE_PORT` and `DEMS_DEMO_CONTROLS` (it stops on a file readable by group or others and never opens the two other credential files); logger with header redaction, the route pattern instead of the raw URL, parse failures by code; error envelope; pool plugin; readiness; response headers through `@fastify/helmet` 13.1.1 plus one `onSend` hook; the pipeline stage order of the spec §2.3; the decorators of P25; one statically imported stub per plugin and per module; static guard tests. Plan W08. Writes: `apps/core-server/src/{index,app,config}.ts`, `src/plugins/{config,logger,error-envelope,response-headers,db,readiness}/**`, `test/static/**`, the stub `index.ts` of four plugins, of `core`, `engine`, `realtime` and of thirteen modules, `src/modules/health/**`. Locks: none. Implements SR-01, SR-03, SR-04, SR-48..50, SR-64, SR-68 (loader), SR-75 (stage order), SR-76, SR-77; AC-B-08, AC-B-14 (headers, unit), AC-B-58, AC-B-61, AC-B-86 (server part). Rollback R-NEW | coder-execution | implementation/08_backend_scaffold_health.md (Tier 3) | 25 | `npm run test -w @dems/core-server -- --maxWorkers=2` exits 0 with the cases of plan W08: health validates against `HealthResponseSchema` with `service: dems-core-server` and `version: 0.2.0`; a closed pool gives 200 with `ready.database: false`; a refusal in `onRequest` wins over an invalid body; every answer carries the five headers of OR-9 and no `Strict-Transport-Security`; a log capture shows no credential, body, query string or marker; a credential file of mode 0644 stops the loader; the static tests find none of the forbidden names; `git diff --stat acaff20 -- apps/mock-core release scripts/release` prints nothing | implementation |
| 31 | [W09] Password-hash wrapper HB-4 over the Node built-in `crypto.argon2` (argon2id, 19,456 KiB, 2 passes, parallelism 1, a 16-byte salt from `crypto.randomBytes(16)`, constant-time verify, no pepper); built before the seed, which needs it. Plan W09. Writes: `apps/core-server/src/modules/identity/password-hash/**`. Locks: none. Implements SR-05, SR-06; AC-B-30 (hash record and vector). On failure: conditional row Fh. Rollback R-NEW | coder-execution | implementation/09_password_hash_wrapper.md (Tier 3) | 25 | `npm run test -w @dems/core-server -- --maxWorkers=2 src/modules/identity/password-hash` exits 0: the Argon2id test vector of RFC 9106 reproduces on Node 26.8.2; a round trip with the stated parameters and a 32-byte tag verifies; a wrong password is rejected | implementation |
| 32 | [W10] Early proof c (time box 45 min), run as `dems_owner`: a scratch schema with one table of each difficult kind (named CHECK, partial unique index, composite key, `bytea`, `jsonb`, custom SQL file), generated by `drizzle-kit` 0.31.11 and applied with `drizzle-orm` 0.45.3 to a scratch database on PostgreSQL 18.4. Plan W10. Writes: `.cache/proof-drizzle/**` (scratch). Uses PostgreSQL through its own scratch database. No AC or SR (it closes AS-02, DA-03, GD-06, PG-08, F23). On failure: conditional row Fc. Rollback R-NEW | database-specialist | implementation/10_proof_drizzle_kit.md (Tier 3) | 29 | In the scratch folder `drizzle-kit generate --name=probe` and `generate --custom --name=probe_guard` write files whose names and order are quoted; `migrate()` applies them; the catalog shows each declared object; a second `migrate()` applies nothing; `tsc --noEmit` passes; the scratch database is dropped | implementation |
| 33 | [W11] Template-clone test helper HB-12 with the `globalSetup` of the Vitest project `db`: run prefix, three templates, guarded names, serialised clones, cleanup, stale-database sweep; the helper, the templates and the clones use `dems_owner`, the code under test uses `dems_app`, nothing connects as `dems_admin`. Plan W11. Writes: `apps/core-server/test/helpers/db/**`, `apps/core-server/test/global-setup.db.ts`. Uses PostgreSQL through its own databases. Implements SR-68 (tests). Rollback R-NEW | database-specialist | implementation/11_db_test_helper.md (Tier 3) | 29 | `npm run test:db -w @dems/core-server -- test/helpers/db` exits 0: two files get two clones and see only their own row; no database with the run prefix remains; a request to drop `dems_demo` or a younger database of another run is refused before a statement is sent; the first clone time is recorded; `pg_database.datdba` shows `dems_owner` for templates and clones | implementation |
| 34 | [W12] Early proof e (time box 90 min): the registry-driven typed client HB-9 in `packages/shared/src/client/` (written against the registry as it stands), a debug-only probe module with its one hook, a socket route added to the harness; proven on one debug-build emulator with the default `expo/fetch`; the harness log records which `Origin` the app sends. Starts only after the controller has recorded the DP-1 outcome. Plan W12. Writes: `packages/shared/src/client/**`, `packages/shared/test/client-*.test.ts`, `apps/mobile/src/runtime/dev-probes.ts`, `apps/mobile/src/runtime/debug.ts`, `.cache/proof-harness/**`. Locks: lane 1 (port 4421); one device. Implements AC-C-01..05. On failure: conditional row Fe. Rollback R-NEW, R-PRE (`debug.ts`) | coder-execution | implementation/12_typed_client_emulator_proof.md (Tier 3) | 25, 27, 28 | On one debug-build emulator with `adb reverse tcp:4420 tcp:4421`, `adb logcat -d` shows four probe lines: GET `getServiceHealth` 200 zod-valid; POST `createSession` 201 zod-valid; POST `exportEvidence` 403 parsed as `ApiError`; a socket opened with an `Authorization` header and its close code; the harness log shows which `Origin` arrived; `npm run test -w @dems/shared -- --maxWorkers=2` exits 0 with the `client-*` tests | implementation |
| 35 | [W13] npm slot N3 with the native rebuild: add `expo-secure-store` (`~57.0.4`, no config plugin; `app.json` untouched); add `tcp:4420` to the `reverse` script; add the optional shell variable `DEMS_CORE_HOST_PORT` to `device-session.sh` (02_plan §3.4; the client spec §9.6 still shows the proposed name; the shared constant keeps the name `CORE_SERVER_PORT`); copy the current debug APK to `.cache/apk-backup/` (KI-21); prebuild; build the debug APK; `adb install -r` on the emulators that DP-1 names, without wiping data; record the `npm audit` output (SU-2). Starts only after the DP-1 outcome is recorded; an emulator with the release-signed build is left as it is. Plan W13. Writes: `apps/mobile/package.json`, `package-lock.json`, `apps/mobile/scripts/device-session.sh`, `apps/mobile/android/**` (generated, git-ignored), `.cache/apk-backup/**`. Locks: npm; gradle; each named device in turn. Implements AC-C-84, AC-C-85; SR-80; AC-B-91. Rollback H-06, R-PRE | coder-execution | implementation/13_npm_slot_n3_mobile_native.md (Tier 3) | 25, 28 | `npm run deps:check -w @dems/mobile` and `npm run doctor -w @dems/mobile` outputs are quoted with no new finding; on each named emulator `adb install -r` prints `Success` and the app opens in Simulated mode (screencap); with `DEMS_CORE_HOST_PORT=4421` `adb reverse --list` shows `tcp:4420` during a session and not after it; the merged release manifest has no cleartext attribute and `app.json` lists seven plugins; mobile typecheck, lint and tests exit 0 at or above 833 tests in 72 suites | implementation |
| 36 | [W14] npm slot N2, tier D (`model="sonnet"`): add `qrcode.react` 4.2.0 to `@dems/core-web`, nothing else; record the `npm audit` output (SU-2). Plan W14. Writes: `apps/core-web/package.json`, `package-lock.json`. Locks: npm. Implements SR-80; AC-B-91. Rollback R-PRE | coder-execution | implementation/14_npm_slot_n2_web.md (Tier 3) | 35 | `npm install` exits 0; the lockfile diff against the pre-image holds only `qrcode.react@4.2.0`; `npm ls react react-dom --all` shows one copy each; `npm run typecheck -w @dems/core-web` exits 0; the `npm audit` output is in the row log | implementation |
| 37 | [W15] Early proof g (time box 60 min after W13): the secure-store wrapper (the one module that imports `expo-secure-store`), jest mocks for it and for `expo-device`, a probe that writes, reads and deletes the probe item unprotected and protected on each debug-build AVD; the wrapper writes the unprotected biometric item only where `isDevice` is false or the build is a debug build (MB-6a). Its observations fix the case of DP-2. Plan W15. Writes: `apps/mobile/src/runtime/secure-credentials.ts` with its two test files, `apps/mobile/jest.setup.ts`, `apps/mobile/src/runtime/dev-probes.ts`. Locks: each debug-build device in turn. Implements SR-32; AC-C-66, AC-C-71, AC-C-105 (wrapper). Rollback R-NEW, R-PRE (`dev-probes.ts`), R-CO (`jest.setup.ts`) | coder-execution | implementation/15_secure_store_wrapper_probe.md (Tier 3) | 34, 35 | The row log holds, for each debug-build AVD, the three observations of MB-8, the value of `isDevice` and the MB-5 case that follows, each with a screencap; the probe item is absent afterwards; `npm run test -w @dems/mobile -- --maxWorkers=2` exits 0 and the static test finds exactly one importer of `expo-secure-store` | implementation |
| 38 | [W16] Shared vocabulary, additive only: 3 permissions (`PAIRING_MANAGE`, `USER_ADMIN`, `DEMO_CONTROL`), 3 SUPERVISOR grants, 9 audit types with their categories, English labels; a test that pins a count is edited by design and named in the log (GP-06). Plan W16. Writes: `packages/shared/src/sim/vocabulary.ts`, `packages/shared/src/sim/auth.ts`, `packages/shared/src/i18n/en/common.ts`, `packages/shared/test/{i18n-vocabulary-sync,auth,sim-contract}.test.ts`. Slot: contract owner (first holder). Implements AC-B-62; input to AC-B-17. Rollback R-CO | coder-execution | implementation/16_shared_vocabulary.md (Tier 3) | 23 | `git diff acaff20 -- packages/shared/src/sim` shows additions only, in `vocabulary.ts` and `auth.ts` (12 permissions, 53 audit types, 18 grants: counts quoted); typecheck and tests of shared, core-web and mobile exit 0 at or above the ledger | implementation |
| 39 | [W17] Schema, migrations and database commands (the only migration writer): the typed schema of 30 tables and the four migration files in order (`0000_prelude`, `0001_tables`, `0002_audit_guards`, `0003_privileges`), applied as `dems_owner`; three triggers `ENABLE ALWAYS`; `TOKEN_REUSE` in the session end reasons; SELECT only for `dems_app` on `audit_chain_history`; `db:create`, `db:migrate`, `db:status`; catalog, guard, privilege and ownership tests; the statement-level concurrency tests T-AT-1 to T-AT-5; each PG-n marked confirmed or corrected. Plan W17. Writes: `apps/core-server/drizzle.config.ts`, `src/db/schema/**`, `src/db/migrations/**`, `src/db/commands/**`, `test/db/**`. Slot: migration writer; own cloned databases. Implements AC-B-01, AC-B-54 (privilege, trigger, guard), AC-B-87 (table, trigger, grant); SR-52..54, SR-67, SR-68 (ownership), SR-72 (statements), SR-78 (table). Rollback R-NEW | database-specialist | implementation/17_db_schema_migrations.md (Tier 3) | 32, 33 | `npm run test:db -w @dems/core-server -- test/db` exits 0: migrate on an empty clone, then a second run that applies nothing; the catalog equals the contract §4 (30 tables, 98 named CHECKs, 25 foreign keys, 5 functions, 3 triggers with `tgenabled = 'A'`; the diff is quoted and empty); every object belongs to `dems_owner`; UPDATE, DELETE and TRUNCATE on `audit_log` and `audit_chain_history` are refused (42501 for `dems_app`, ZA002 for `dems_owner`) and INSERT on `audit_chain_history` is refused for `dems_app`; T-PV-1 to T-PV-3 and T-AT-1 to T-AT-5 pass | implementation |
| 40 | [W18] Light Live API with the settle helper HB-15: `useCoreActions`, `coreActionsOf`, `settle`, the two error classes, mode helpers and hooks; no network code. Plan W18. Writes: `packages/shared/src/live/{index,settle,core-actions,errors,mode,hooks}.ts`, `packages/shared/test/live-light-*.test.ts`. Locks: none. Implements AC-C-02, AC-C-06 (identity part), AC-C-09. Rollback R-NEW | coder-execution | implementation/18_live_light_api_settle.md (Tier 3) | 25 | `npm run test -w @dems/shared -- --maxWorkers=2` exits 0 with the 508 baseline tests unchanged and the `live-light-*` tests: `useCoreActions()` returns `sim.actions` itself for a simulator; `settle` runs `ok` and `done` before it returns for a plain value, and `fail` and `done` for a synchronous throw | implementation |
| 41 | [W19] Contract A: the registry model (`access`, `audit`, `mode`, answering services), the envelope with 15 new codes, additive constants, the widened health schema, the text rule API-13 on every free-text schema, the builder scope (offline 10, all), and the operations of areas 1, 2, 3 and 13 with their bodies. Plan W19. Writes: `packages/shared/src/api/**`, `packages/shared/openapi/**`, `packages/shared/scripts/gen-openapi.ts`, `packages/shared/test/{openapi,schemas,sim-api-validation}.test.ts`, `packages/shared/test/api-*.test.ts`. Slot: contract owner. Implements AC-B-13; SR-64; input to AC-B-93. Rollback R-PRE | coder-execution | implementation/19_contract_a.md (Tier 3) | 38 | `npm run test -w @dems/shared -- --maxWorkers=2` and `node --import tsx packages/shared/scripts/gen-openapi.ts --check` exit 0: 37 operations (10 existing, 27 new), each with `access` and `audit`; the ten existing ones equal their baseline path, method and schemas; the offline scope yields ten and `scalar-config.test.ts` of core-web passes with that file unchanged | implementation |
| 42 | [W20] Mapping module with the seed: the one slice-to-table mapping in both directions (MR-1 to MR-9), the seed program with `db:seed`, the first build of `dems_demo` (create, migrate, seed), all as `dems_owner`; `audit_chain_history` is empty after a first seed. Plan W20. Writes: `apps/core-server/src/db/mapping/**`, `apps/core-server/src/db/seed/**`. Locks: own cloned databases; `db-migrate.lock` for `dems_demo`. Implements AC-B-02, AC-B-17, AC-B-28 (seed dump), AC-B-65; SR-62, SR-63. Rollback R-NEW, H-15 | database-specialist | implementation/20_db_mapping_seed.md (Tier 3) | 31, 38, 39 | `npm run test:db -w @dems/core-server -- src/db/seed src/db/mapping` exits 0 (ST-1 to ST-6; `fromRows(toRows(state))` equals the durable slices); `db:create`, `db:migrate`, `db:seed` and `db:status` for `dems_demo` exit 0 with the row counts of the contract §9.4 quoted (82 audit rows and 59 events confirmed or corrected) | implementation |
| 43 | [W21] Core services: the audit writer on the append protocol, the event writer, the transaction helper with the serial unit-of-work queue that the engine pipeline and the server-native modules share (SR-72), the server clock. Plan W21. Writes: `apps/core-server/src/core/**`. Locks: own cloned databases. Implements AC-B-54 (50 writers), AC-B-55 (clock); SR-52..54, SR-65, SR-72 (queue). Rollback R-NEW | coder-execution | implementation/21_core_services.md (Tier 3) | 30, 39 | `npm run test:db -w @dems/core-server -- src/core` exits 0: 50 concurrent appends give a chain that `verifyAuditChain` accepts over all rows; a writer that skips the lock is refused with SQLSTATE ZA001; every `at` follows the injected clock | implementation |
| 44 | [W22] Contract B: the 28 slice schemas and the realtime message union (the heartbeat member stays); `TOKEN_REUSE` is a value of `session.ended.reason`. Plan W22. Writes: the contract paths of step 41. Slot: contract owner. Implements AC-B-46 (schema side). Rollback R-PRE | coder-execution | implementation/22_contract_b.md (Tier 3) | 41 | The shared tests and `gen-openapi.ts --check` exit 0: each of the 28 slice schemas accepts the matching slice of `createIdleState` at the fixed instant and of the recording scenario; the union accepts one example of every message of the spec §9.4 and the existing heartbeat | implementation |
| 45 | [W23] Request guards: the Origin guard HB-6 with two lists (web console origins `http://127.0.0.1` on 5173, 5176, 5177 and 5178 by exact match, no `localhost`, `null` refused; the instance's own origins only on a request without a cookie); the throttle with `@fastify/rate-limit` keyed by the resolved principal or by `class:web` or `class:local`; the denial budget (20 audited refusals per key in 60 s, then 429 without a row) as a limiter of `rate-limiter-flexible`. Plan W23. Writes: `apps/core-server/src/plugins/origin-guard/**`, `apps/core-server/src/plugins/throttle/**`. Locks: none. Implements SR-04, SR-19..21, SR-24, SR-69, SR-70, SR-71, SR-75; AC-B-14 (429, 413), AC-B-43 (REST, unit), AC-B-74 (POST, unit). Rollback R-NEW | coder-execution | implementation/23_request_guards.md (Tier 3) | 30, 41 | `npm run test -w @dems/core-server -- --maxWorkers=2 src/plugins/origin-guard src/plugins/throttle` exits 0: every cell of the HTTP decision table of the spec §14.2 gives the stated answer; `http://localhost:5173`, `null`, a trailing slash, an upper-case scheme and port 5174 each answer 403 `ORIGIN_NOT_ALLOWED`; no answer carries an `access-control-allow-` header; the 31st request of one class in 60 s answers 429 with `retry-after`; the 21st refusal of one key answers 429 and writes no row; the test can reset or advance the counter (SA-14) | implementation |
| 46 | [W24] Identity core: the `authenticate` hook HB-5 that resolves at most one credential before the throttle (a cookie only for a session without a device, a bearer only for a session with one, two credentials answer 401 `CREDENTIAL_CONFLICT`); the session table access; the cookie `dems_session_<listen port>` with no `Max-Age`; lockout with `rate-limiter-flexible`, the attempt consumed before the verification; the Argon2id computation always runs; the sweeper; operations 2 to 6. Plan W24. Writes: `apps/core-server/src/plugins/authenticate/**`, `apps/core-server/src/modules/identity/**` (not `password-hash/`, not `biometric/`). Locks: own cloned databases. Implements SR-05..18, SR-22, SR-23, SR-25, SR-61, SR-72, SR-73; AC-B-23..30, AC-B-80, AC-B-90. Rollback R-NEW | coder-execution | implementation/24_identity_core.md (Tier 3) | 31, 41, 42, 43 | MODG, and `npm run test:db -w @dems/core-server -- src/modules/identity src/plugins/authenticate` shows the cases of plan W24: the cookie with exactly `HttpOnly; SameSite=Strict; Path=/`; two instances with one cookie jar keep both sessions valid; byte-identical failure bodies with exactly one Argon2id call per attempt; 20 concurrent wrong-password sign-ins verify exactly five attempts and answer 423 to the other 15; the lock releases after 60 s; idle expiry at 15 minutes and absolute expiry at 8 hours; a dump and a log capture hold no secret and no marker | implementation |
| 47 | [W25] Bulk fixture at the minimums of the database contract §11 (revision 2, 30 tables), deterministic, loaded as `dems_owner` into test databases only. DEFERRABLE (reduced) as DF-1. Plan W25. Writes: `apps/core-server/src/db/fixtures/**`. Locks: own cloned databases. Implements SR-62. Rollback R-NEW | database-specialist | implementation/25_db_bulk_fixture.md (Tier 3) | 42 | `npm run test:db -w @dems/core-server -- src/db/fixtures` exits 0: the loader's printed counts meet every minimum; `verifyAuditChain` passes over all rows; `db:status` of `dems_demo` prints the same counts before and after | implementation |
| 48 | [W26] Engine host (HB-13, host half): the headless `Sim` with the command pipeline, the actor scope cleared in a `finally`, write-through by reference inequality, rehydration, the restart fault, health snapshots every 60 s, no meter frames stored. Plan W26. Writes: `apps/core-server/src/engine/**`. Locks: own cloned databases. Implements SR-55, SR-59, SR-65, SR-79; AC-B-07, AC-B-52, AC-B-53, AC-B-55. Rollback R-NEW | coder-execution | implementation/26_engine_host.md (Tier 3) | 26, 42, 43 | `npm run test:db -w @dems/core-server -- src/engine` exits 0: with a fixed seed and a manual clock the audit-type sequence of the recording scenario equals the shared simulator's; the engine's `auth` slice is signed out after every command, also after one that throws; a 60 s recording writes zero meter-frame rows; a rehydrated engine equals the state before the stop; a session in RECORDING at the stop is in FAULT after rehydration | implementation |
| 49 | [W27] Contract C: the 47 operations of areas 4 to 11; the committed `openapi.json` in the scope `all` (75 operations, two security schemes, server `http://127.0.0.1:4420`, version 0.2.0); `AuditChainStatus` gains `lineage` and `lineageTotal`. Plan W27. Writes: the contract paths of step 41. Slot: contract owner. Implements AC-B-09 (registry side), AC-B-11; AC-C-01 (re-run at 75). Rollback R-PRE | coder-execution | implementation/27_contract_c.md (Tier 3) | 44 | The shared tests and `gen-openapi.ts --check` exit 0: exactly 75 operations (27 GET, 48 POST), each with `access` and `audit`; the document lists 75 operations and two security schemes; the typed client's callable operation count is 75 | implementation |
| 50 | [W28] RBAC guard HB-7 with the matrix read and the pipeline integration: the boot check, the per-request rule in `onRequest` (stage 6), the denial audit row counted against the denial budget, any-of; operation 10; the integration tests of pipeline stages 3 to 6. Plan W28. Writes: `apps/core-server/src/plugins/permission-guard/**`, `apps/core-server/src/modules/rbac/**`. Locks: own cloned databases. Implements SR-13, SR-43..46, SR-69, SR-71, SR-75; AC-B-12, AC-B-16 (unit form), AC-B-18, AC-B-43, AC-B-73 (HTTP table), AC-B-74, AC-B-75 (one operator), AC-B-84 (REST). Rollback R-NEW | coder-execution | implementation/28_rbac_guard_pipeline.md (Tier 3) | 45, 46 | MODG, and the cases of plan W28: an app with a route that lacks an access rule or an audit rule fails to boot; a denied call answers 403 and writes exactly one `ACCESS_DENIED` row naming actor, operation and permission, decided before the body is read; an allowed call writes none; every cell of the HTTP decision table of the spec §14.2 gives the stated answer; 100 denied calls of one operator within 10 s write exactly 20 rows while the other 80 answer 429; 31 requests with 31 unknown bearer values share one bucket | implementation |
| 51 | [W29] Reset routine HB-3 with `db:reset`: steps R-0 to R-9 with the failure table, every database step as `dems_owner`; the role check of R-0 (`RESET_ROLE_PRIVILEGED` for a superuser connection); eight kept tables carried over unchanged, `audit_chain_history` among them; one lineage row appended for the discarded chain; an ACTIVE pairing code written `CANCELLED` with no audit row; the epoch continues; creates the three lane databases. Plan W29. Writes: `apps/core-server/src/db/reset/**`. Locks: own cloned databases; `db-migrate.lock`; advisory key 442001. Implements SR-56, SR-58, SR-68 (reset role), SR-78; AC-B-57 (routine), AC-B-72 (role check), AC-B-87 (table level). Rollback R-NEW, H-15 | database-specialist | implementation/29_db_reset_routine.md (Tier 3) | 42 | `npm run test:db -w @dems/core-server -- src/db/reset` exits 0 (T-RS-1 to T-RS-6): after two resets `audit_chain_history` holds two rows and the first is byte-equal before and after the second; the routine's sessions are `dems_owner` only; a stubbed superuser answer stops the routine with `RESET_ROLE_PRIVILEGED` before R-1; `db:reset` for `dems_lane_1`, `dems_lane_2` and `dems_lane_3` exits 0 with `db:status` printing the seed counts and the owner `dems_owner` | implementation |
| 52 | [W30] Live socket client beside the heartbeat client: one socket, heartbeat view, close codes, reconnect, resync. Plan W30. Writes: `packages/shared/src/realtime/live-socket-client.ts`, `packages/shared/src/realtime/index.ts`, `packages/shared/test/realtime-live-*.test.ts`. Locks: none. Implements AC-C-02, AC-C-15, AC-C-16. Rollback R-NEW, R-CO (`realtime/index.ts`) | coder-execution | implementation/30_live_socket_client.md (Tier 3) | 34, 44 | `npm run test -w @dems/shared -- --maxWorkers=2` exits 0: `heartbeat-client.test.ts` passes unchanged; new tests cover 4401, 4403, reconnect on 1001, 1013 and 4408 with the existing backoff constants, and at most one `resync` in 2 s on a revision gap | implementation |
| 53 | [W31] Fake transport HB-11, contract-checked in both directions, for Vitest and jest. Plan W31. Writes: `packages/shared/src/live/testing/**`, `packages/shared/test/live-testing-*.test.ts`. Locks: none. Implements AC-C-02, AC-C-17. Rollback R-NEW | coder-execution | implementation/31_fake_transport.md (Tier 3) | 34, 44 | `npm run test -w @dems/shared -- --maxWorkers=2` exits 0: a scripted response that violates its schema fails with a named error; a request body that violates the operation's schema fails; the call log holds method, path, headers and body | implementation |
| 54 | [W32] Pairing with the device registry HB-10: operations 15 to 23; the device resolver; code and credential storage per the database contract §5; a redeem is one unit of work with a consuming compare-and-set before the comparison; its refusals count against the denial budget; a retired credential falls into the class bucket; `getSignInStatus` needs no console identity. Plan W32. Writes: `apps/core-server/src/modules/pairing/**`. Locks: own cloned databases. Implements SR-26..31, SR-33..35, SR-71 (retired credential), SR-72; AC-B-29, AC-B-32..38, AC-B-41, AC-B-75 (retired credentials), AC-B-76, AC-B-77. Rollback R-NEW | coder-execution | implementation/32_pairing_device_registry.md (Tier 3) | 50 | MODG, and the cases of plan W32: six digits valid 300 s with only a hash stored; a second redeem and an expired code answer the generic `INVALID_CODE`; lock after three failures, close after five; revoke makes the next call answer 403 `DEVICE_REVOKED`; two-phase rotation; of 20 concurrent wrong redeems exactly three count and 17 answer 423, a second burst counts exactly two more and the code closes at five; two concurrent redeems of the right code give one 201 and one 401; a scan of audit rows, events and the log capture finds no code and no credential | implementation |
| 55 | [W33] User and role administration: operations 11 to 14; the last-administrator rule with its check and update as one unit under a lock; session end on disable; the change notification through `publish`. Plan W33. Writes: `apps/core-server/src/modules/admin/**`. Locks: own cloned databases. Implements SR-12, SR-47, SR-72; AC-B-18, AC-B-20 (session and sign-in part), AC-B-21, AC-B-79. Rollback R-NEW | coder-execution | implementation/33_user_role_admin.md (Tier 3) | 50 | MODG, and: the same session gets 403 before and 2xx after a role change with no new sign-in; a disabled user's next request answers 401, the next sign-in the generic 401, and `USER_DISABLED` is written; demoting or disabling the last enabled SUPERVISOR answers 409 `LAST_ADMIN` and changes nothing; two concurrent demotions of the two remaining holders give one 200 and one 409 `LAST_ADMIN` | implementation |
| 56 | [W34] Sessions module: operations 24 to 38 (the recording lifecycle; one active session per Core, Q16). Plan W34. Writes: `apps/core-server/src/modules/sessions/**`. Locks: own cloned databases. Implements AC-B-49, AC-B-50. Rollback R-NEW | coder-execution | implementation/34_module_sessions.md (Tier 3) | 48, 49, 50 | MODG, and: two simultaneous creates give one 201 and one 409 `SESSION_ACTIVE`; a stop by another operator with a five-character reason names that operator in `RECORDING_STOPPED`; a shorter reason answers 422 `INVALID_REASON` | implementation |
| 57 | [W35] Evidence module: operations 39 to 43. Plan W35. Writes: `apps/core-server/src/modules/evidence/**`. Locks: own cloned databases. Implements SR-59, SR-66; AC-B-69, AC-B-70. Rollback R-NEW | coder-execution | implementation/35_module_evidence.md (Tier 3) | 48, 49, 50 | MODG, and: after verify, export, archive and an evidence tamper fault the tracks, track hashes, manifest hash and signature are unchanged; a denied export answers 403 `FORBIDDEN` with one `EXPORT_DENIED` row; every answer that lists audio has exactly AUDIO-01 and AUDIO-02 | implementation |
| 58 | [W36] Devices module: operations 44 to 52. Plan W36. Writes: `apps/core-server/src/modules/devices/**`. Locks: own cloned databases. Implements the spec §7.10; AC-B-68 through MODG. Rollback R-NEW | coder-execution | implementation/36_module_devices.md (Tier 3) | 48, 49, 50 | MODG, and: `restartDevice` during a recording answers 409 `RECORDING_ACTIVE`; an unsupported command answers 409 `COMMAND_UNSUPPORTED` | implementation |
| 59 | [W37] The two smallest domain modules, kept in one row by the plan's merge: storage (operations 53 to 55) with network-time (operations 56 and 57, reads only). Plan W37. Writes: `apps/core-server/src/modules/storage/**`, `apps/core-server/src/modules/network-time/**`. Locks: own cloned databases. Implements the spec §7.11 and §7.12, Q15; AC-B-68 through MODG. Rollback R-NEW | coder-execution | implementation/37_modules_storage_network_time.md (Tier 3) | 48, 49, 50 | MODG for both folders, and: `setStoragePolicy` is allowed for a holder of either permission and refused for a holder of neither; a policy change is present after an app restart with its `STORAGE_POLICY_CHANGED` row; time values follow the injected clock | implementation |
| 60 | [W38] CHECKPOINT CP-B1, read-only: review the backend foundation (W08, W17, W20, W21, W23, W24, W28) for structure, duplication, dependency hygiene, error handling and reuse of the contract; a parallel audit whose blockers are closed before step 80. Plan W38. Writes: nothing. Checks I1 and D12 (one folder and own tests per hand-built element). Rollback R-NONE | senior-code-reviewer | gateway_check/04_cp_backend_foundation.md (Tier 2) | 45, 50 | The report lists findings with file:line and severity; each blocker names its owning row; the count of open blockers is stated and is zero before step 80 | gateway_check |
| 61 | [W39] Security-audit module: operations 58 to 63; cursor paging; `verifyAuditChain` returns `view`, `stored` and the lineage (the newest 20 with `lineageTotal`) and verifies the stored chain incrementally. Plan W39. Writes: `apps/core-server/src/modules/security-audit/**`. Locks: own cloned databases. Implements SR-78 (read), SR-81; AC-B-87 (operation 60), AC-B-88. Rollback R-NEW | coder-execution | implementation/39_module_security_audit.md (Tier 3) | 47, 48, 49, 50, 51 | MODG, and: paging of `listAuditRows` over the bulk fixture (the seed, if DF-1 is taken) returns every row once while rows are appended; an export without a reason answers 422 `INVALID_REASON`; after two resets the operation returns both lineage rows, newest first; after one full verification a call that follows k appended rows reads exactly k audit rows (a query spy), and two concurrent calls run one verification | implementation |
| 62 | [W40] The system module (operations 64 to 68) with the alerts module (operations 69 and 70), kept in one row by the plan's merge; `acknowledgeAlert` and `updateSettings` write no audit row and one log line each. Plan W40. Writes: `apps/core-server/src/modules/system/**`, `apps/core-server/src/modules/alerts/**`. Locks: own cloned databases. Implements AC-B-71, AC-B-89; SR-82. Rollback R-NEW | coder-execution | implementation/40_modules_system_alerts.md (Tier 3) | 48, 49, 50 | MODG for both folders, and: `restartServices` and `startSoftwareUpdate` during a session answer 409 `SESSION_ACTIVE`; every raised alert has a `FAULT_RAISED` audit row; `acknowledgeAlert` and `updateSettings` each write no audit row and exactly one log line with the operator ID and the alert ID or the changed key names, and none of their values | implementation |
| 63 | [W41] Biometric token: operations 7 to 9; server-issued, single use, rotating, bound to device and operator; consumed by a compare-and-set; a reused token ends the open BIOMETRIC sessions of that device and operator with `TOKEN_REUSE`; `reportBiometricFailure` names an operator only where an enrolment exists. Plan W41. Writes: `apps/core-server/src/modules/identity/biometric/**`. Locks: own cloned databases. Implements SR-36, SR-37, SR-72, SR-74; AC-B-29 (biometric flow), AC-B-31, AC-B-78, AC-B-82 (session end), AC-B-83. Rollback R-NEW | coder-execution | implementation/41_biometric_token.md (Tier 3) | 54 | MODG, and the cases of plan W41: a valid token signs in with `method: BIOMETRIC` and is replaced; the old token answers 401, revokes the family and writes `AUTH_FAILED`; no request without a valid token creates a session; two concurrent uses of one token issue exactly one session; after a reuse the BIOMETRIC session ends with `TOKEN_REUSE` while a password session of the same operator stays open; a failure report for an operator with no enrolment writes `AUTH_FAILED` with a null actor and the device ID | implementation |
| 64 | [W42] Realtime channel HB-8: the `/ws` route; authentication at the upgrade by the socket decision table of the spec §14.2; five topics; snapshot then deltas; the send policy; control events; close codes 4401, 4403 and 4408; anonymous sockets capped at 6 of 16; upgrades counted in the throttle; a `?token=` query authenticates nothing. Plan W42. Writes: `apps/core-server/src/realtime/**`. Locks: own cloned databases; ephemeral loopback ports. Implements SR-38..42, SR-51, SR-69, SR-70, SR-74 (socket close), SR-75; AC-B-19, AC-B-20 (socket), AC-B-42, AC-B-43 (upgrade), AC-B-46, AC-B-48, AC-B-73 (socket table), AC-B-74 (upgrade), AC-B-84 (upgrades), AC-B-85. Rollback R-NEW | coder-execution | implementation/42_realtime_channel.md (Tier 3) | 44, 45, 48, 54, 55 | `npm run test:db -w @dems/core-server -- src/realtime` exits 0 with the cases of plan W42: a socket with no credential gets `hello` and `heartbeat` only; every cell of the socket decision table gives the stated answer; a seventh anonymous socket is closed with 1013 while an operator's upgrade is accepted; after 30 anonymous upgrades in 60 s the next is refused with 429; a role change pushes `session.updated` within 1 s; a disabled user's socket closes with 4401 and a revoked device's with 4403 within 1 s; a stalled client loses meter frames but no state delta, or is closed with 4408; revisions are gap-free | implementation |
| 65 | [W43] Demo-control module: operations 71 to 75 behind `DEMO_CONTROL` and the demo flag; faults; the reset through the routine of step 51, for which the server reads `.data/pg.owner.env` only at R-0, only with the flag on, and drops the values at R-9. Reducible as DF-3. Plan W43. Writes: `apps/core-server/src/modules/demo/**`. Locks: own cloned databases. Implements SR-57..59, SR-68; AC-B-56, AC-B-57, AC-B-72. Rollback R-NEW | coder-execution | implementation/43_module_demo_controls.md (Tier 3) | 48, 49, 50, 51 | MODG, and the cases of plan W43: with the flag off the five operations answer 403 `DEMO_DISABLED` for a SUPERVISOR and 403 `NOT_PERMITTED` with an audit row for the other roles, and the server runs while `.data/pg.owner.env` is unreadable; with it on, the pool reports `dems_app` and the reset connection `dems_owner` with `rolsuper` false; `AUDIT_TAMPER` breaks `view` and leaves `stored` intact; `resetDemo` returns the domain tables to the seed checksums, keeps the eight kept tables, writes an ACTIVE code as `CANCELLED`, raises the epoch by exactly 1 and sends a snapshot to every operator socket | implementation |
| 66 | [W44] Live source HB-14: the replica store, delta application with structural sharing, the 42 action bindings, own-command atomicity, error rebuilding, the `touchSession` throttle; a 429 keeps its status and `retry-after` in `LiveTransportError`; `session.ended` with `TOKEN_REUSE` is passed on to the clients. Plan W44. Writes: `packages/shared/src/live/source/**`, `packages/shared/test/live-source-*.test.ts`. Locks: none. Implements AC-B-63 (spies); AC-C-02, AC-C-06..08, AC-C-10..15, AC-C-39, AC-C-54. Rollback R-NEW | coder-execution | implementation/44_live_source.md (Tier 3) | 34, 40, 49, 52, 53 | `npm run test -w @dems/shared -- --maxWorkers=2` exits 0: in Simulated mode the 508 baseline tests pass unchanged and spies count zero `fetch` calls and zero socket constructions; in Live mode, on the fake transport, a snapshot and the deltas of the recording scenario drive the selectors to the simulator's values; atomicity holds in both arrival orders; the settle time-out sends one `resync` and resolves | implementation |
| 67 | [W45] CHECKPOINT CP-S1, read-only: security review of the access-control code (W23, W24, W28, W32, W33, W41, W42) against the spec §15 and the findings of row 20, with the re-check list of the database contract §15.4 (HC-1 to HC-5, what binds which role, T-AO-4, T-CR-2) and GS-22; any `DEVICE_CREDENTIAL_ROTATED` row is unexpected. Tier 1 block. Plan W45. Writes: nothing. Checks SR-01..82 (met or not met with file:line). Rollback R-NONE | security-review | gateway_check/05_cp_access_control_security.md (Tier 1; verdict PASS, CAUTION or FAIL) | 54, 55, 63, 64 | Verdict stated; every security requirement SR-01 to SR-82 that the reviewed code implements is marked met or not met with file:line; each finding names its owning row; zero open FAIL before step 80 | gateway_check |
| 68 | [W46] CHECKPOINT CP-C1, read-only: review the shared client layer (W12, W18, W30, W31, W44) for platform neutrality, contract reuse and an untouched Simulated path; a parallel audit. Plan W46. Writes: nothing. Checks AC-B-62; AC-C-02. Rollback R-NONE | senior-code-reviewer | gateway_check/07_cp_shared_client.md (Tier 2) | 66 | Findings carry file:line and severity; `git diff acaff20 -- packages/shared/src/sim` shows only the additions of W16; each blocker names its owning row | gateway_check |
| 69 | [W47] TEST, role-by-endpoint matrix generated from the registry against the spec §4.4 and §7, on the bulk fixture (the seed, if DF-1 is taken): 75 operations for 5 caller kinds plus the credential-misuse cells of AC-B-81; the test advances the manual clock by 60 s or resets the counter after at most 20 denied cells of one key, so that no cell is answered 429 (F25). Plan W47. Writes: `apps/core-server/test/acceptance/rbac-matrix.test.ts`. Locks: own cloned databases. Implements SC4; AC-B-15, AC-B-16, AC-B-81; SR-73. Rollback R-NEW | test-expert | test/02_rbac_matrix.md (Tier 2) | 47, 54, 55, 56, 57, 58, 59, 61, 62, 63, 64, 65 | `npm run test:db -w @dems/core-server -- test/acceptance/rbac-matrix.test.ts` exits 0: 375 cells, each equal to the specification; each denied operator cell asserts exactly one `ACCESS_DENIED` row (`EXPORT_DENIED` for operations 42, 61, 62); an allowed call wrote none; no cell is answered 429; the four credential-misuse cells answer 401 `CREDENTIAL_CONFLICT`, 403, 401 and 401 and resolve no principal | test |
| 70 | [W48] TEST, pairing lifecycle: issue, expiry, redemption, listing, revocation, refused access after revocation, re-pairing, each with its audit type; an unpaired caller succeeds on `getSignInStatus`; the reuse of a biometric token closes the socket of the BIOMETRIC session. Plan W48. Writes: `apps/core-server/test/acceptance/pairing-lifecycle.test.ts`. Locks: own cloned databases. Implements SC5; AC-B-28, AC-B-32..39, AC-B-41, AC-B-82 (socket close). Rollback R-NEW | test-expert | test/04_pairing_lifecycle.md (Tier 2) | 54, 56, 63, 64 | The file passes under `test:db`: each lifecycle step asserts its audit type; a revoked device's REST call answers 403 and its socket closes with 4403; a device revoked while it records leaves the session in RECORDING and another operator stops it; a dump holds no code and no credential the test issued; a used biometric token presented again closes that session's socket with 4401 within 1 s | test |
| 71 | [W49] TEST, two-client shared state with resync. Plan W49. Writes: `apps/core-server/test/acceptance/shared-state.test.ts`. Locks: own cloned databases; ephemeral loopback ports. Implements SC3; AC-B-44..47. Rollback R-NEW | test-expert | test/05_shared_state_realtime.md (Tier 2) | 56, 64 | The file passes under `test:db`: client B equals client A after start, marker and stop; after a dropped socket B equals a fresh snapshot; every message validates against the union; a store at revision N shows the command's effect | test |
| 72 | [W50] Web runtime with the mode switch: the mode resolver, the Live start-up, the query bridge for `admin.changed` (it removes every `['core', ...]` entry on sign-out, on `session.ended` and on the loss of `USER_ADMIN` or `PAIRING_MANAGE`), the Live row of `core-endpoint.ts`, the refusal presenter (a 429 worded as a limit, LB-10), shared words; a page under `localhost` is refused with the cause named. Plan W50. Writes: `apps/core-web/src/main.tsx`, `src/router.tsx`, `src/routes/__root.tsx`, `src/runtime/**`, `src/lib/core-endpoint.ts`, `src/lib/core-errors.ts`, `src/lib/__tests__/live-*.test.tsx`, `src/test/live-runtime-*.test.tsx`, `packages/shared/src/i18n/en/common.ts`. Locks: a lane. Implements AC-C-18..23, AC-C-25, AC-C-33..37, AC-C-40, AC-C-41, AC-C-46, AC-C-101, AC-C-102, AC-C-106 (cache). Rollback R-CO, R-NEW, R-PRE (`common.ts`) | coder-execution | implementation/50_web_runtime_mode.md (Tier 3) | 27, 51, 64, 66 | `npm run test -w @dems/core-web -- --maxWorkers=2` exits 0 with `routes.test.tsx`, `core-endpoint.test.tsx` and `packaged-csp.test.ts` absent from `git diff --stat acaff20`; on a lane `curl -si http://127.0.0.1:517x/api/v1/health` answers 200 with `service: dems-core-server` and no `access-control-allow-` header; the socket through the dev server receives `hello` and `heartbeat`; the console loads in both modes (two screenshots); a sign-in POST through the dev server with a foreign `Origin` and one with `http://localhost:5173` each answer 403 `ORIGIN_NOT_ALLOWED`; after a sign-out the query cache holds no `['core', ...]` entry | implementation |
| 73 | [W51] Mobile runtime: `LIVE` as the third Core link source, the Live source with its adapters, the `pairing` member with its state at start, the refusal presenter (a 429 worded as a limit), the banner rule, the `core=` debug parameter, the health call of Stack Check. Plan W51. Writes: `apps/mobile/src/runtime/{contract,core-link,sim-adapters,connection-banner,index,debug,core-errors}.ts`, `src/runtime/sim-runtime-provider.tsx`, `src/runtime/live-*.test.tsx`, `src/features/home/use-health.ts`, `src/i18n/en.mobile.ts`. Locks: lane 1 or lane 2; its device. Implements AC-C-28, AC-C-29, AC-C-32, AC-C-49, AC-C-59, AC-C-78, AC-C-79, AC-C-101. Rollback R-CO, R-NEW, R-PRE (`debug.ts`) | coder-execution | implementation/51_mobile_runtime.md (Tier 3) | 37, 51, 64, 66 | `npm run test -w @dems/mobile -- --maxWorkers=2` exits 0 with the existing runtime and provider tests unchanged and new tests for the three sources and the release fallback; on the lane's emulator, opened with `core=LIVE`, the Pair screen shows the chip `LIVE` and Stack Check shows the Core server's health (screencap) | implementation |
| 74 | [W52] TEST, contract conformance: every registered route is in the OpenAPI document, every documented operation is registered, every response validates; the header set of OR-9 on every answer; the text rule API-13. Plan W52. Writes: `apps/core-server/test/acceptance/contract.test.ts`. Locks: own cloned databases. Implements SC6; AC-B-09, AC-B-10, AC-B-14, AC-B-70, AC-B-93; SR-76. Rollback R-NEW | test-expert | test/03_contract_conformance.md (Tier 2) | 54, 55, 56, 57, 58, 59, 61, 62, 63, 64, 65 | The file passes under `test:db`: zero undocumented routes and zero unregistered operations (both lists quoted, empty); every response validates with `validateCoreApiResponse`; each of 401, 403, 404, 405, 409, 413, 422, 423 and 429 is produced once or more and parses as `ApiError`; no GET handler writes; every answer carries the five headers of OR-9; free text with U+0000 or an unpaired surrogate answers 422 `INVALID_INPUT` on `addSessionNote`, `revokeDevice` and `redeemPairingCode` and writes no row | test |
| 75 | [W53] TEST, restart and recovery. Plan W53. Writes: `apps/core-server/test/acceptance/restart.test.ts`. Locks: own cloned databases. Implements SC2; AC-B-04..06; SR-17. Rollback R-NEW | test-expert | test/06_restart_recovery.md (Tier 2) | 48, 54, 55, 56, 59 | The file passes under `test:db`: the per-table checksums of the contract §9.6 are equal before and after a restart that follows a policy change, a sealed session, a role change and a paired device; a session in RECORDING, and one in FINALIZING, at the stop is in FAULT afterwards and `recoverSession` ends in an INCOMPLETE history entry with the four recovery audit rows | test |
| 76 | [W54] Web shell with the admin routes: the mode indicator, the link notice, the role notice, the ADMINISTRATION navigation group, the two route files with guards and page stubs, two i18n namespaces; a 429 shows the limit toast, not the link notice. Plan W54. Writes: `apps/core-web/src/components/shell/**`, `src/routes/_app/admin/**`, `src/routeTree.gen.ts`, `src/features/users-roles/index.tsx`, `src/features/paired-devices/index.tsx`, `src/test/live-shell-*.test.tsx`, `packages/shared/src/i18n/index.ts`, `packages/shared/src/i18n/en/{shell,users-roles,paired-devices}.ts`. Locks: a lane. Implements AC-C-24, AC-C-26, AC-C-45 (shell), AC-C-49..51, AC-C-59. Rollback R-CO, R-NEW | coder-execution | implementation/54_web_shell_admin_routes.md (Tier 3) | 72 | `npm run test -w @dems/core-web -- --maxWorkers=2` exits 0 with the existing shell tests absent from `git diff --stat acaff20`; new tests show the indicator at three widths in its three states, the ADMINISTRATION entries only in Live mode and only with their permission, and the leave of `/admin/users` on `session.updated` | implementation |
| 77 | [W55] Web Login in Live mode: server sign-in, lockout, the mode selector, the Live trust line, no security-key button, the disclosure with the plain sentence of WS-9 and no role chip; a 429 shows the limit toast with the seconds of `retry-after` and keeps the form filled; the live check records the browser and its version. Plan W55. Writes: `apps/core-web/src/features/login/**`, `packages/shared/src/i18n/en/login.ts`, `apps/core-web/src/test/live-login-*.test.tsx`. Locks: a lane. Implements SR-16, SR-63; AC-C-23, AC-C-25, AC-C-38..40, AC-C-42..45, AC-C-47, AC-C-104, AC-C-107, AC-C-110. Rollback R-CO, R-NEW | coder-execution | implementation/55_web_login.md (Tier 3) | 46, 72 | CLG items (a) to (c), and one live sign-in on a lane: `document.cookie` does not show `dems_session_<port>`, no web-storage value starts with `ses_`, `dems.auth` is not written (console output and screenshot); Live tests cover success, a wrong password, the 423 countdown and the absent `login-security-key`; a marker password leaves no marker in the web's error sink; a 429 shows the limit toast and neither the offline notice nor a changed mode indicator | implementation |
| 78 | [W56] Mobile sign-in in Live mode: server sign-in on a paired device, server-driven idle, biometric enrolment and unlock with the case that DP-2 fixed; the DEPARTURE-6 conditions (MB-6a); `session.ended` with `TOKEN_REUSE` signs out, deletes the biometric token and its marker and keeps the device credential. The biometric parts are DEFERRABLE as DF-4. Plan W56. Writes: `apps/mobile/src/auth/**`. Locks: lane 1 or lane 2; its device. Implements SR-16; AC-C-65, AC-C-67..71, AC-C-105, AC-C-108. Rollback R-CO | coder-execution | implementation/56_mobile_sign_in.md (Tier 3) | 63, 73 | `npm run test -w @dems/mobile -- --maxWorkers=2` exits 0 with the existing auth tests unchanged; Live tests cover password sign-in, lockout, enrolment only in a password session, biometric sign-in with rotation, a 401 that deletes the token, a failed OS check and a cancelled prompt; AsyncStorage and the storage-mock log hold no string starting with `dvc_`, `ses_` or `bio_`, no marker password and no marker pairing code; with `isDevice` true in a build that is not a debug build a failing protected write turns biometric sign-in off and stores no token; `TOKEN_REUSE` leads to the Login screen | implementation |
| 79 | [W57] Mobile pairing flow on the existing Pair screen: redeem, the credential written before the action settles, unpair, re-pairing after a reinstall; the tests use a marker code and scan storage and logs for it; the tablet pairs on lane 2 here, once for the whole client phase. The tablet layout check is DEFERRABLE as DF-8. Plan W57. Writes: `apps/mobile/src/features/pairing/**`. Locks: lane 2; the tablet device. Implements AC-C-75..77, AC-C-80, AC-C-81. Rollback R-CO | coder-execution | implementation/57_mobile_pairing_flow.md (Tier 3) | 54, 73 | CLG items (a) to (c), and on the tablet AVD the app pairs with a code issued by the lane backend and both panes of the Pair screen show unclipped in portrait and landscape (screencaps); Live tests cover a correct code, a wrong code, a 423 countdown, cancel before `commitAt` (no request) and unpair while offline (refused); the marker code is in no storage and no log | implementation |
| 80 | [W58] GATE, backend: the gate commands of P24 for `@dems/core-server` and `@dems/shared`, then a smoke run as the sole owner of port 4420 with `dems_demo` (start by the documented command, health, sign-in, one protected call, one denied call with its audit row, the socket heartbeat); scan the log of the whole acceptance run for secrets and markers; check the file modes. No lane backend runs while this row runs. Plan W58. Writes: nothing. Locks: main (4420, `dems_demo`); PostgreSQL. Checks SC2; AC-B-03, AC-B-08, AC-B-29 (the run log), AC-B-58, AC-B-64 (modes), AC-B-66; SR-01, SR-03. Rollback R-NONE | verifier | gateway_check/06_backend_gate.md (Tier 2) | 60, 67, 69, 70, 71, 74, 75 | The gate commands exit 0 with output quoted; each smoke step is PASS with its status quoted; `lsof -nP -iTCP:4420 -sTCP:LISTEN` shows one listener on `127.0.0.1` and `lsof -nP -a -p <pid> -i` shows loopback sockets only; the process is stopped and the lock released; the server log of the acceptance run holds no secret, no marker and no query string; `stat -f '%Lp'` prints 700 for `.data/` and 600 for the three credential files and the logs | gateway_check |
| 81 | [W59] Mobile Login in LIVE mode: no pairing-code hint, no role chip, the trust line with the device ID, the disclosure sentence of condition C1; a 429 shows the limit wording. Plan W59. Writes: `apps/mobile/src/features/login/**`. Locks: lane 1 or lane 2; its device (the device check waits while step 80 holds port 4420). Implements SR-63; AC-C-72, AC-C-104, AC-C-110. Rollback R-CO | coder-execution | implementation/59_mobile_login.md (Tier 3) | 78 | CLG items (a) to (c), and one device sign-in on the lane's emulator in LIVE mode (screencap) that shows no pairing-code hint, no role chip and the trust line with the device ID | implementation |
| 82 | [W60] Mobile pairing gate: the `blocked` rule in the root stack, the boot route, the pending link, the return to the Pair screen on revocation. Plan W60. Writes: `apps/mobile/src/navigation/**`, `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/(app)/_layout.tsx`. Locks: lane 1 or lane 2; its device (the device check waits while step 80 holds port 4420). Implements Q5; AC-C-31, AC-C-50, AC-C-73, AC-C-74, AC-C-78, AC-C-79. Rollback R-CO | coder-execution | implementation/60_mobile_pairing_gate.md (Tier 3) | 78, 79 | `npm run test -w @dems/mobile -- --maxWorkers=2` exits 0 with the existing guard tests unchanged; Live route tests cover unpaired (boot route `/pair`; `/login`, `/home` and `/dev-gallery` not reachable; `/stack-check` reachable), paired and revoked; one device check shows the gate and its release after pairing (two screencaps) | implementation |
| 83 | [W61] CHECKPOINT CP-W1, read-only: review W50, W54 and W55 for mode isolation, credential handling in the browser and an unchanged packaged CSP. Plan W61. Writes: nothing. Checks AC-C-35, AC-C-38. Rollback R-NONE | senior-code-reviewer | gateway_check/08_cp_web_runtime.md (Tier 2) | 76, 77 | Findings carry file:line and severity; each blocker names its owning row; a `grep` shows no credential in a URL, a log call or web storage | gateway_check |
| 84 | [W62] CHECKPOINT CP-M1, read-only: review W15, W51, W56, W57, W59 and W60 for mode isolation, credential storage, hook naming under the React Compiler and release-build behaviour. Plan W62. Writes: nothing. Checks AC-C-28, AC-C-65, AC-C-66. Rollback R-NONE | senior-code-reviewer | gateway_check/09_cp_mobile_runtime.md (Tier 2) | 81, 82 | Findings carry file:line and severity; each blocker names its owning row; `git diff --stat acaff20` shows no write of a mobile row under `packages/shared`, `apps/core-web` or `apps/mock-core` | gateway_check |
| 85 | [W63] Web Dashboard in Live mode: settle site B-7. Plan W63. Writes: `apps/core-web/src/features/dashboard/**`, `packages/shared/src/i18n/en/dashboard.ts`, `apps/core-web/src/test/live-dashboard-*.test.tsx`. Locks: a lane. Implements AC-C-48, AC-C-53, AC-C-101. Rollback R-CO | coder-execution | implementation/63_web_dashboard.md (Tier 3) | 76, 77, 80 | CLG passes for the folder: the existing tests are unchanged, the Live tests of site B-7 pass on the fake transport, the grep finds no `useSimActions`, and one live check on a lane has its screenshot path | implementation |
| 86 | [W64] Web Start New Session in Live mode: settle sites A3, A4, B-6, C-3, C-4, D-2, D-3; the in-flight marker of the resume effect (FC-7). Plan W64. Writes: `apps/core-web/src/features/session-new/**`, `packages/shared/src/i18n/en/session-new.ts`, `apps/core-web/src/test/live-session-new-*.test.tsx`. Locks: a lane. Implements AC-C-57, AC-C-58 (AC-C-48, AC-C-53, AC-C-101 through CLG). Rollback R-CO | coder-execution | implementation/64_web_session_new.md (Tier 3) | 76, 77, 80 | CLG, and the pending test with fake timers: with an answer delayed by 1 s two quick presses send one request, no spinner at 300 ms, the in-button spinner at 500 ms, and no element is added outside the pressed control | implementation |
| 87 | [W65] Web Session Monitor in Live mode: settle sites A9, B-2, B-3, B-4, C-1, C-2; the meters fed from the socket. Plan W65. Writes: `apps/core-web/src/features/session-monitor/**`, `packages/shared/src/i18n/en/session.ts`, `apps/core-web/src/test/live-session-monitor-*.test.tsx`. Locks: a lane. Implements I8; AC-C-48, AC-C-53, AC-C-101 through CLG. Rollback R-CO | coder-execution | implementation/65_web_session_monitor.md (Tier 3) | 76, 77, 80 | CLG, with the live check on a running recording: the meters move and a stop with a reason seals the session (screenshot) | implementation |
| 88 | [W66] The mobile Core chip rule in its two folders (Home, More), display only: both chips read `Simulated` unless the source is LIVE (MD-8, MD-9). Plan W66. Writes: `apps/mobile/src/features/dashboard/**`, `apps/mobile/src/features/more/**`. Locks: lane 1 or lane 2; its device. Implements AC-C-30, AC-C-48. Rollback R-CO | coder-execution | implementation/66_mobile_home_more.md (Tier 3) | 80, 81, 82 | CLG for both folders, and jest shows both chips reading `Simulated` in SIMULATED and HEARTBEAT mode and `Live` only in LIVE mode | implementation |
| 89 | [W67] Mobile Start Session in Live mode: settle sites S1-4, S2-2, S4-6, S5-6; the start-recording hand-off. Plan W67. Writes: `apps/mobile/src/features/session-new/**`. Locks: lane 1 or lane 2; its device. Implements AC-C-50, AC-C-57, AC-C-58, AC-C-62. Rollback R-CO | coder-execution | implementation/67_mobile_session_new.md (Tier 3) | 80, 81, 82 | CLG, and jest with the fake transport: in both arrival orders the monitor opens and no `session busy` toast shows; the pending test of step 86 passes in its mobile form | implementation |
| 90 | [W68] Mobile Session Monitor in Live mode: settle sites S2-1, S4-2; the meters on the UI thread fed from the socket. Plan W68. Writes: `apps/mobile/src/features/session-live/**`. Locks: lane 1 or lane 2; its device. Implements I8; AC-C-48, AC-C-53, AC-C-101 through CLG. Rollback R-CO | coder-execution | implementation/68_mobile_session_live.md (Tier 3) | 80, 81, 82 | CLG, with the device check on a running recording (screencap) | implementation |
| 91 | [W69] Web Evidence in Live mode: settle sites A5, A6, B-1, C-5, D-1, D-6; the server's verdict is the record. Plan W69. Writes: `apps/core-web/src/features/evidence/**`, `packages/shared/src/i18n/en/evidence.ts`, `apps/core-web/src/test/live-evidence-*.test.tsx`. Locks: a lane. Implements AC-C-61. Rollback R-CO | coder-execution | implementation/69_web_evidence.md (Tier 3) | 76, 77, 80 | CLG, and the fake transport's log shows that verification called operation 41 and no demo operation | implementation |
| 92 | [W70] Web Devices in Live mode: settle sites B-7, B-8, D-5; the `Paired devices` row of the drawer. Plan W70. Writes: `apps/core-web/src/features/devices/**`, `packages/shared/src/i18n/en/devices.ts`, `apps/core-web/src/test/live-devices-*.test.tsx`. Locks: a lane. Implements GS-16; AC-C-48, AC-C-53, AC-C-101 through CLG. Rollback R-CO | coder-execution | implementation/70_web_devices.md (Tier 3) | 76, 77, 80 | CLG passes for the folder: the existing tests are unchanged, the Live tests of the three sites pass on the fake transport, the grep finds no `useSimActions`, and one live check on a lane has its screenshot path | implementation |
| 93 | [W71] Web Storage in Live mode (settle site B-9), with the Network & Time folder riding along as a test-and-check item because it changes no production file. The storage folder holds `__tests__/storage-page.test.tsx`, which step 23 repaired: this row does not edit that file and saves its pre-image by P23 before its first edit (consistency finding C-02). Plan W71. Writes: `apps/core-web/src/features/storage/**`, `apps/core-web/src/features/network-time/**` (tests only), `packages/shared/src/i18n/en/{storage,network-time}.ts`, `apps/core-web/src/test/live-storage-*.test.tsx`. Locks: a lane. Implements AC-C-48, AC-C-53, AC-C-101 through CLG. Rollback R-CO for the folders, R-PRE for `storage-page.test.tsx` so that the repair of step 23 is not undone | coder-execution | implementation/71_web_storage_network_time.md (Tier 3) | 76, 77, 80 | CLG for both folders, with one exception under item (a): `storage-page.test.tsx` may appear in `git diff --stat acaff20` and is compared with W01's state, not with `acaff20`: `git hash-object` of the file prints the value recorded by step 23; `git diff --stat acaff20 -- apps/core-web/src/features/network-time` lists test files only | implementation |
| 94 | [W72] Mobile Finalization, Summary and Sessions hub in Live mode: settle sites S2-4, S4-4, S4-5; Finalization and the hub change no production file and ride along as test-and-check items (their device checks are DEFERRABLE as DF-7). Plan W72. Writes: `apps/mobile/src/features/{session-finalizing,session-summary,sessions}/**`. Locks: lane 1 or lane 2; its device. Implements AC-C-48, AC-C-53, AC-C-101 through CLG. Rollback R-CO | coder-execution | implementation/72_mobile_finalizing_summary_sessions.md (Tier 3) | 80, 81, 82 | CLG for the three folders, with one device check that follows a session from stop to the acknowledged summary (screencaps) | implementation |
| 95 | [W73] Mobile Recovery in Live mode: settle sites S2-3, S4-8, S5-2 (edge case E1). Plan W73. Writes: `apps/mobile/src/features/session-recovery/**`. Locks: lane 1 or lane 2; its device. Implements AC-C-48, AC-C-53, AC-C-101 through CLG. Rollback R-CO | coder-execution | implementation/73_mobile_session_recovery.md (Tier 3) | 80, 81, 82 | CLG, with a Live test of recovery after a server-side fault | implementation |
| 96 | [W74] Mobile Evidence in Live mode: settle sites S1-5, S1-6, S3-1, S5-1, S5-5. Plan W74. Writes: `apps/mobile/src/features/evidence/**`. Locks: lane 1 or lane 2; its device. Implements AC-C-61, AC-C-63. Rollback R-CO | coder-execution | implementation/74_mobile_evidence.md (Tier 3) | 80, 81, 82 | CLG, and jest shows the archive dialog's success toast only after the server's 2xx and the danger toast on a refusal | implementation |
| 97 | [W75] Web Security & Audit in Live mode: settle sites A7, A9, B-5, C-6; twelve matrix rows from operation 10 in Live mode, nine in Simulated mode; the chain panel shows the stored-chain line and, when `lineage` is not empty, the `Earlier chains` line. Plan W75. Writes: `apps/core-web/src/features/security-audit/**`, `packages/shared/src/i18n/en/security-audit.ts`, `apps/core-web/src/test/live-security-audit-*.test.tsx`. Locks: a lane. Implements AC-C-60, AC-C-109. Rollback R-CO | coder-execution | implementation/75_web_security_audit.md (Tier 3) | 76, 77, 80 | CLG, and with 450 rows on the fake server the audit export file holds 450 rows; in Live mode the chain panel lists one entry per discarded chain while the Simulated panel is as today | implementation |
| 98 | [W76] Web System with the Demo Control Panel in Live mode: settle sites A8, A10, A11, B-10, C-7, D-4. Plan W76. Writes: `apps/core-web/src/features/system/**`, `packages/shared/src/i18n/en/system.ts`, `apps/core-web/src/test/live-system-*.test.tsx`. Locks: a lane started with `DEMS_DEMO_CONTROLS=1`. Implements Q14, E14; AC-C-52, AC-C-60. Rollback R-CO | coder-execution | implementation/76_web_system_demo_panel.md (Tier 3) | 76, 77, 80 | CLG, and the panel is rendered in Live mode only with `DEMO_CONTROL` and `demoControls`; the log export file is built from all pages of operations 59 and 63 | implementation |
| 99 | [W77] New web page Users & Roles (`/admin/users`, Live only): user list, role assignment, enable and disable, the read-only matrix; its queries are removed by the bridge of step 72 on sign-out and on the loss of `USER_ADMIN`. Plan W77. Writes: `apps/core-web/src/features/users-roles/**`, `packages/shared/src/i18n/en/users-roles.ts`, `apps/core-web/src/test/live-users-roles-*.test.tsx`. Locks: a lane. Implements Q9, E4; AC-C-86..91. Rollback R-NEW | coder-execution | implementation/77_web_users_roles.md (Tier 3) | 55, 76, 77, 80 | The render tests of AC-C-86 to AC-C-91 pass on the fake transport (test IDs; a role change; 409 `LAST_ADMIN` inline; disable and enable; refetch on `admin.changed`; the five states); one live role change on a lane (screenshot) | implementation |
| 100 | [W78] Mobile Devices in Live mode: settle sites S2-8, S3-2, S5-4. Plan W78. Writes: `apps/mobile/src/features/devices/**`. Locks: lane 1 or lane 2; its device. Implements AC-C-63. Rollback R-CO | coder-execution | implementation/78_mobile_devices.md (Tier 3) | 80, 81, 82 | CLG, and jest shows the device-command dialog's success toast only after the server's 2xx | implementation |
| 101 | [W79] Mobile Storage in Live mode (settle sites S2-6, S5-3), with the Network & Time folder riding along as a test-and-check item because it changes no production file (its device check is DEFERRABLE as DF-7). Plan W79. Writes: `apps/mobile/src/features/{storage,network-time}/**`. Locks: lane 1 or lane 2; its device. Implements AC-C-48, AC-C-53, AC-C-101 through CLG. Rollback R-CO | coder-execution | implementation/79_mobile_storage_network_time.md (Tier 3) | 80, 81, 82 | CLG passes for both folders: the existing tests are unchanged, the Live tests of the two sites pass on the fake transport, the grep finds no `useSimActions`, and one device check on a lane has its screencap path | implementation |
| 102 | [W80] Mobile Operator Audit in Live mode: settle sites S1-7, S4-3. Plan W80. Writes: `apps/mobile/src/features/audit/**`. Locks: lane 1 or lane 2; its device. Implements AC-C-48, AC-C-53, AC-C-101 through CLG. Rollback R-CO | coder-execution | implementation/80_mobile_audit.md (Tier 3) | 80, 81, 82 | CLG passes for the folder: the existing tests are unchanged, the Live tests of the two sites pass on the fake transport, the grep finds no `useSimActions`, and one device check on a lane has its screencap path | implementation |
| 103 | [W81] New web page Paired Devices (`/admin/devices`, Live only): issue with the digits, the QR (`qrcode.react`) and the countdown; cancel; list; revoke with a reason; the code is dropped from memory on sign-out, on `session.ended` and on the loss of `PAIRING_MANAGE`. The QR tile is DEFERRABLE as DF-5. Plan W81. Writes: `apps/core-web/src/features/paired-devices/**`, `packages/shared/src/i18n/en/paired-devices.ts`, `apps/core-web/src/test/live-paired-devices-*.test.tsx`. Locks: a lane. Implements Q8; AC-C-92..99, AC-C-106 (code memory), AC-C-107. Rollback R-NEW | coder-execution | implementation/81_web_paired_devices.md (Tier 3) | 36, 54, 76, 77, 80 | The render tests of AC-C-92 to AC-C-99 pass on the fake transport (the QR component receives exactly the answer's `qrPayload`; the code is in no web-storage value, URL or query-cache entry); one live issue and cancel on a lane (screenshot with the digits masked); after a sign-out the feature holds no code and a second operator on the same page load sees no digit of the first; the issue of a code leaves no code in the web's error sink | implementation |
| 104 | [W82] Mobile Settings in Live mode: settle sites S2-7, S5-7; the third segment `LIVE`; the biometric switch; demo controls. Plan W82. Writes: `apps/mobile/src/features/settings/**`. Locks: lane 1 or lane 2 started with `DEMS_DEMO_CONTROLS=1`; its device. Implements AC-C-31, AC-C-52, AC-C-68, AC-C-83. Rollback R-CO | coder-execution | implementation/82_mobile_settings.md (Tier 3) | 80, 81, 82 | CLG, and the existing release-gate test passes unchanged with `settings-core-link-LIVE` disabled in a release build; selecting LIVE shows the dialog, signs out and lands on `/pair` or `/login` | implementation |
| 105 | [W83] Contract close-out with the OpenAPI document: apply every `CONTRACT-GAP-n`; correct the stale description of KI-18 in its eight places; regenerate. Plan W83. Writes: the contract paths of step 41. Slot: contract owner (last holder); own cloned databases for the conformance test. Implements SC6; KI-18; AC-B-11, AC-B-13. Rollback R-PRE | coder-execution | implementation/83_contract_close_out_openapi.md (Tier 3) | 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104 | A search for `CONTRACT-GAP-` under `apps/` and `packages/` finds nothing; `gen-openapi.ts --check`, the shared tests and `test/acceptance/contract.test.ts` exit 0; the document and the registry both count 75 operations; the stale sentence of KI-18 is gone from the eight places (diff quoted) | implementation |
| 106 | [W84] Web API Reference in both modes: ten operations in Simulated mode, 75 with the Core-server switch, 75 `LIVE` in Live mode; Try-it of operations 2, 7, 8, 15, 18 and 23 is rejected before a request; no request body or answer is kept in web storage; the page's log holds method, path and status only. The switch and the Realtime panel are DEFERRABLE as DF-6. Plan W84. Writes: `apps/core-web/src/features/api-reference/**`, `packages/shared/src/i18n/en/api-reference.ts`, `apps/core-web/src/test/live-api-reference-*.test.tsx`. Locks: a lane. Implements SC6; AC-C-18, AC-C-100, AC-C-103, AC-C-107. Rollback R-CO | coder-execution | implementation/84_web_api_reference.md (Tier 3) | 76, 105 | The existing API Reference tests and `scalar-config.test.ts` pass unchanged, with one exception: `apps/core-web/src/test/sim-fetch.test.ts` is one of them and is compared with W01's state, not with `acaff20` (`git hash-object` of the file prints the value recorded by step 23); new tests show ten operations in Simulated mode, 75 with the switch and a Try-it rejected without a request, 75 `LIVE` in Live mode, a URL outside `{page origin}/api/v1` rejected, and no second socket; one live Try-it of `getServiceHealth` answers `dems-core-server` (screenshot); Try-it of the six denied operations sends no request; after one GET and one POST no web-storage value holds a request body or an answer | implementation |
| 107 | [W85] `THIRD_PARTY_NOTICES.md`, append-only, tier D (`model="sonnet"`): one new section listing every installed package of 02_plan §3.1 (and any fallback package) with version and licence read from the package's own licence file, plus the PostgreSQL License text with the note on the binaries' packaging licence. Plan W85. Writes: `THIRD_PARTY_NOTICES.md`. Locks: none. Implements D9 DN-2 (no AC or SR). Rollback R-CO | coder-execution | implementation/85_third_party_notices.md (Tier 3) | 36 | `git diff acaff20 -- THIRD_PARTY_NOTICES.md` shows additions only, and every direct dependency added since `acaff20` (the list from `git diff acaff20 -- '*package.json'`, quoted) has a line in the new section | implementation |
| 108 | [W86] README Live-mode run guide: the exact commands to initialise (`pg:init`), start and stop PostgreSQL; create, migrate, seed, reset; start the backend, the web console in Live mode, `adb reverse` and the mobile app in Live mode; switch modes; ports; remove the data; remove PostgreSQL completely; troubleshooting; the console address `http://127.0.0.1:<port>` (never `localhost`); the two plain sentences of AC-B-92. Each command is run once, the full removal excepted. Plan W86. Writes: `README.md`. Locks: main (4420, 5173); a lane emulator, never the reserved one. Implements SC11; AC-B-67, AC-B-92; SR-63. Rollback R-CO | coder-execution | implementation/86_readme_live_mode.md (Tier 3) | 105, 106 | A command-to-output table shows one passing run of every new README command; `git diff acaff20 -- README.md` shows additions only; the Live section names `http://127.0.0.1` and not `localhost` as the console address and holds the two sentences of AC-B-92; it prints no credential value that is not already published in the file | implementation |
| 109 | [W87] TEST, completion with the test strategy and coverage report: add the tests no build row owns (the two static tests of AC-C-53; gaps the operation-to-test table shows); run every suite; write the report. Plan W87. Writes: `apps/core-web/src/test/live-static-*.test.ts`, `apps/mobile/src/lib/live-static-*.test.ts`, `apps/core-server/test/acceptance/gap-*.test.ts`. Locks: own cloned databases. Implements SC7; AC-B-68; AC-C-53, AC-C-56, AC-C-101. Rollback R-NEW | test-expert | test/01_test_report.md (Tier 2) | 105, 106 | Every workspace's run exits 0 at or above the ledger; the report holds the operation-to-test table (75 rows: success, denial where a permission exists, validation where a body exists), the site-to-test table for every site ID of the client spec §8 not marked `no change` or `not reachable`, the AC-to-test table, and the backend line coverage from `@vitest/coverage-v8` | test |
| 110 | [W88] Consolidated implementation report: each work row's status, files changed, deviations from 02_plan, closed and open gap IDs, host changes with their rollbacks. Tier 1 block. Plan W88. Writes: nothing but its report. Implements SC9. Rollback R-NONE | data-analyst | implementation/99_implementation_report.md (Tier 1) | 107, 108, 109 | Every work row appears with its log path and status; every deviation cites a D, DR or F ID or is listed for the controller; the file counts match `git diff --stat acaff20` | implementation |
| 111 | [W89] GATE, root: the gate commands of P24 in full, first with PostgreSQL stopped (root `npm run typecheck`, `npm run lint`, `npm test`, then the five per-workspace runs with `-- --maxWorkers=2`), then `npm run test:db` with PostgreSQL started again; this row uses PostgreSQL exclusively and runs the mock-core suite (ports 4410, 4411). Plan W89. Writes: nothing. Checks SC7; D9, D10; AC-B-58, AC-B-59; AC-C-101. Rollback R-NONE | verifier | gateway_check/10_root_gate.md (Tier 2) | 68, 83, 84, 107, 108, 109 | With `npm run pg:status` reporting no server: root `npm run typecheck`, `npm run lint` and `npm test` exit 0 and the five per-workspace runs are at or above the ledger; then with PostgreSQL started `npm run test:db` exits 0; each failure names its owning row | gateway_check |
| 112 | [W90] Clean-state rebuild, following `README.md` literally as the sole user of PostgreSQL and port 4420: stop, `pg:remove-data`, init, start, create, migrate, seed, start the backend, change state, restart, compare; recompute the five SHA-256 values of SU-1; run the host-authentication check and the file-mode check again; read the README Live section against AC-B-92. Plan W90. Writes: nothing in the repository (it removes and rebuilds the git-ignored `.data/`; the lane databases and their pairings go with it). Locks: PostgreSQL exclusively; main. Checks SC2, SC11; AC-B-01..03, AC-B-64, AC-B-67, AC-B-91, AC-B-92; SR-80; proves the rollbacks H-02 and H-03. Rollback R-NONE | verifier | verification/03_clean_state_rebuild.md (Tier 2) | 111 | Every README command exits 0 as written; `db:status` equals the seed counts recorded by step 42; the per-table checksums before and after the restart are equal; `lsof` shows 4432 and 4420 on `127.0.0.1` only; the recomputed SHA-256 values equal those recorded by steps 25 and 29; `pg:status` reports HA-1 to HA-4 as passing; `stat` shows 700 and 600 | verification |
| 113 | [W91] Code review of `apps/core-server`, read-only: module boundaries, duplication against the shared simulator, transaction use, error handling, dependency hygiene, ready-made framework compliance (I1). Plan W91. Writes: nothing. Checks I1; SR-67. Rollback R-NONE | senior-code-reviewer | verification/10_code_review_backend.md (Tier 2) | 111 | Findings carry file:line and severity; zero open blockers; every hand-built part without a recorded decision is listed | verification |
| 114 | [W92] Code review of `packages/shared` with `apps/core-web`, read-only: contract reuse, platform neutrality, mode isolation, single React and zustand copies, the two new pages built from the existing kit. Plan W92. Writes: nothing. Checks AC-C-02. Rollback R-NONE | senior-code-reviewer | verification/11_code_review_shared_web.md (Tier 2) | 111 | Findings carry file:line and severity; zero open blockers; `npm ls react react-dom zustand --all` output quoted with one copy each | verification |
| 115 | [W93] Code review of `apps/mobile`, read-only: mode isolation, UI-thread discipline for the meters, credential handling, ownership (no mobile row wrote outside `apps/mobile`). Plan W93. Writes: nothing. Checks AC-C-66. Rollback R-NONE | senior-code-reviewer | verification/12_code_review_mobile.md (Tier 2) | 111 | Findings carry file:line and severity; zero open blockers; `git diff --stat acaff20` shows no mobile row wrote outside `apps/mobile` | verification |
| 116 | [W94] END TO END, SC5 pairing, on the main instance with the web console on `127.0.0.1:5173` in Live mode and the reserved emulator. Starts only after the controller has recorded DP-3 (default A: the reserved emulator never paired). Plan W94. Writes: nothing. Locks: main; the reserved device. Checks SC5; AC-B-40; AC-C-81, AC-C-82. Rollback R-NONE | verifier | verification/06_e2e_pairing.md (Tier 2) | 112 | Five steps, each PASS with a capture and its audit row quoted: (1) the app in LIVE mode with no device credential shows only the Pair screen and Stack Check; (2) the portal issues a code (`PAIRING_CODE_ISSUED`); (3) the app redeems it and reaches Login (`PAIRING_SUCCESS`); (4) Paired Devices lists the device as PAIRED and, after sign-in, with its operator (`AUTH_SUCCESS` naming the device); (5) revoke in the portal returns the app to the Pair screen within 1 s and its next call is refused (`DEVICE_REVOKED`) | verification |
| 117 | [W95] END TO END, SC3 shared state, same environment; the emulator pairs again first (a new device ID). Plan W95. Writes: nothing. Locks: main; the reserved device. Checks SC3; AC-B-51; AC-C-37, AC-C-64. Rollback R-NONE | verifier | verification/04_e2e_shared_state.md (Tier 2) | 116 | A session started on the web console appears on the emulator within 2 s and a stop on the emulator appears on the web console, then the reverse; each step PASS with a screenshot, a screencap and the matching `SESSION_CREATED`, `RECORDING_STARTED` and `RECORDING_STOPPED` rows; the browser's network log shows requests to the page origin only | verification |
| 118 | [W96] END TO END, SC4 role change, same environment: a SUPERVISOR in one browser profile, the affected operator in a second profile and on the emulator; the role is changed back at the end. Plan W96. Writes: nothing. Locks: main; the reserved device. Checks SC4; AC-B-22; AC-C-55. Rollback R-NONE | verifier | verification/05_e2e_rbac.md (Tier 2) | 117 | After the role change in Users & Roles the affected operator's control changes on the web console and on the emulator within 1 s without a new sign-in (before and after captures); a now-denied call is refused with 403 and its `ACCESS_DENIED` row; the `ROLE_CHANGED` row is quoted; the role is changed back | verification |
| 119 | [W97] REGRESSION, SC8: the 61 simulator-dependent test files; `release/` byte-identical; the macOS launcher self-test from a copy outside the workspace; the mock-core suite; the simulator diff; a Simulated-mode walk on the web and on one emulator with the lane-3 backend running; HEARTBEAT mode with mock-core; the KI-07 marker count (at most 13 IDs and 68 markers). Plan W97 (02_plan §8.5, §17). Writes: nothing. Locks: lane 3 (recreated with `db:reset`); a lane emulator; ports 4400 and 4410. Checks SC8; AC-B-59..63; AC-C-27, AC-C-35, AC-C-101. Rollback R-NONE | verifier | verification/07_regression_simulated_release.md (Tier 2) | 112 | All six checks PASS with output quoted: the 61 files pass and their diff against `acaff20` lists only the two files of step 23 and recorded by-design changes; `shasum -a 256 -c` reports OK for every file under `release/`; the launcher prints `"ok": true` for `--self-test`; the 19 mock-core tests pass and `git diff --stat acaff20 -- apps/mock-core scripts/release` is empty; `git diff acaff20 -- packages/shared/src/sim` shows additions only in `vocabulary.ts` and `auth.ts`; the Simulated walk and HEARTBEAT mode leave no request line in the lane-3 server log | verification |
| 120 | [W98] Performance of the realtime path (I8) on the main instance: web frame rate and long tasks on Session Monitor, mobile frame statistics, backend CPU with three clients, database write rate during a recording, one list pass on the bulk fixture; each compared with the Simulated-mode value on the same host. DEFERRABLE (reduced) as DF-2. Plan W98. Writes: nothing. Locks: main; the reserved device; no other Core server runs while it measures. Checks I8 (SA-06, CA-01, GD-03, GS-11); no AC or SR. Rollback R-NONE | verifier | verification/08_performance_realtime.md (Tier 2) | 118 | Each measure is recorded with its method and compared with the Simulated-mode value on the same host; zero meter-frame rows are written during the recording; each shortfall names its owning row | verification |
| 121 | [W99] Security review of the backend, the database, secrets and host changes, read-only: SR-01 to SR-82; loopback-only listeners; no secret in git, logs, URLs or audit rows; `npm audit` high and critical counts; the PostgreSQL install limited to the logged steps, each with its rollback; the re-check list of the database contract §15.4 (HC-1 to HC-5, what binds which role, GD-13, GD-14, T-AO-4, T-CR-2); a `DEVICE_CREDENTIAL_ROTATED` row outside the server's own tests is reported as unexpected. Tier 1 block. Plan W99. Writes: nothing. Locks: lane 3 only if a running server is needed, and then only after step 120 has finished measuring. Checks SC10; SR-01..82; AC-B-66. Rollback R-NONE | security-review | verification/02_security.md (Tier 1; verdict PASS, CAUTION or FAIL) | 118 | Verdict stated; every item has command output or file:line evidence; `npm audit` high and critical counts quoted; each CAUTION or FAIL names a remediation row | verification |
| 122 | [W100] Security review of the two clients, read-only: credential storage in the browser and on Android, the DEPARTURE-6 conditions, the Try-it deny list, the debug-only cleartext rule, the release manifest unchanged, no credential in logs or stored snapshots. Tier 1 block. Plan W100. Writes: nothing. Locks: a device (read-only log check). Checks SC10; AC-C-65, AC-C-103, AC-C-105; SR-16, SR-32. Rollback R-NONE | security-review | verification/09_security_clients.md (Tier 1; verdict PASS, CAUTION or FAIL) | 118, 119 | Verdict stated; every item has command output or file:line evidence; a device log check after pairing, sign-in and enrolment finds no string starting with `dvc_`, `ses_` or `bio_`; the release manifest is unchanged | verification |
| 123 | [W101] Final verification of SC1 to SC11: a matrix with the evidence for each criterion (SC1 by the commit time of row 22 against the log of step 23). Plan W101. Writes: nothing. Checks SC1..SC11. Rollback R-NONE | verifier | verification/01_verification.md (Tier 2) | 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122 | Each of SC1 to SC11 is marked PASS, FAIL or CAUTION with a pointer to quoted evidence; both security verdicts are PASS or an acknowledged CAUTION; zero open blocker findings; each FAIL names its owning row | verification |
| 124 | [W102] Report inputs: every D, DR and F cross-checked against the row logs; the SC1 to SC11 outcome; open items; the user's-call items that came up; the host state left behind with its removal commands. Tier 1 block. Plan W102. Writes: nothing but its report. Implements SC9. Rollback R-NONE | data-analyst | report/01_report_inputs.md (Tier 1) | 123 | Every D-n, DR-n and F-n of `decisions/decisions.md` appears; every decision or drift a row log reports is in that file or listed as missing; the host-state list matches 02_plan §14 and the log of step 112 | report |
| 125 | [W104] CHECKPOINT COMMIT 1, after the backend gate, tier D (agent default): one local commit of the owned write paths of every row the controller's tracker shows as complete, and of the task folder under `docs/` as it stands; staged by explicit path; a path that a row still in flight writes, or a multi-writer path whose later writer has not finished, is left out and named in the row log; one such path is known in advance: `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` is left out and named, because its later writer W71 (step 93) has not finished; never staged: `release/`, `.data/`, `.cache/`, `.locks/`, `apps/mobile/signing/`, the design book, any env or credential file; no remote, no push. Plan W104 (02_plan §8.5a, §4.3). Writes: the git index only. Implements D17; SC10. Rollback `git reset --soft HEAD~1` (local only) | git-specialist | implementation/97_checkpoint_commit_1_backend.md (Tier 3) | 80 | `git log -1 --stat` is quoted; `git remote -v` prints nothing; `git status --porcelain` lists only the paths the row named as left out; `git ls-files release .data apps/mobile/signing` prints nothing | implementation |
| 126 | [W105] CHECKPOINT COMMIT 2, after the web client wave (the web runtime, the shell, Login, the web page rows, the two new pages), tier D (agent default): the rules of step 125; the mobile rows still in flight are left out and named; `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx`, which step 125 left out, is staged here, because its later writer (step 93) has finished. Plan W105 (02_plan §8.5a, §4.3). Writes: the git index only. Implements D17; SC10. Rollback `git reset --soft HEAD~1` (local only) | git-specialist | implementation/98_checkpoint_commit_2_web.md (Tier 3) | 76, 77, 85, 86, 87, 91, 92, 93, 97, 98, 99, 103, 125 | `git log -1 --stat` is quoted; `git remote -v` prints nothing; `git status --porcelain` lists only the paths the row named as left out; `git ls-files release .data apps/mobile/signing` prints nothing | implementation |
| 127 | [W103] Final local commit, tier D (agent default), staged by explicit path: code, docs and the report inputs; never `release/`, `.data/`, `.cache/`, `.locks/`, env files, any credential file, `apps/mobile/signing/` or the design book; no remote, no push. The search for credential contents reads its patterns from the files; no secret is passed as an argument or printed (P19). Plan W103. Writes: the git index only. Implements SC10; D1. Rollback `git reset --soft HEAD~1` (local only) | git-specialist | report/02_git_final_commit.md (Tier 3) | 124, 126 | `git log -1 --stat` is quoted; `git remote -v` is empty; `git status --porcelain --ignored` shows the excluded paths as ignored, not staged; a search of the commit for the contents of the three credential files under `.data/` finds nothing | report |

### Gates and rollback classes used in the table (from 02_plan §8.1)

| Gate | Applies to | Content |
|---|---|---|
| **SG** standard gate | Every row that writes code | Typecheck and lint of each workspace it wrote, and its own tests, exit 0 with the runner output quoted; the workspace totals are at or above the test ledger (P24) |
| **MODG** module gate | Backend module rows | SG, and: the folder's route list equals the registry operations of its area (both quoted); each operation has a success test, a denial test if it carries a permission and a validation test if it has a body (AC-B-68); tests run in-process against the row's own cloned database (`DEMS_TEST_STEP=<row>`); no port is bound |
| **CLG** client gate | Web page rows and mobile screen rows | SG, and: (a) the folder's existing tests pass and their files are absent from `git diff --stat acaff20` (AC-C-101), except the two files of W01, which are compared with W01's state (below); (b) one Live test, on the fake transport, per settle site named in the row, covering success, the site's refusal with the denied toast (AC-C-48) and an outage; (c) `grep` finds no `useSimActions` and no `.actions` read on a `Sim` in the folder's production files (AC-C-53); (d) one live check of at most 10 minutes on a lane, with a screenshot or a screencap path |

| Rollback class | Action (run only on the controller's instruction) |
|---|---|
| **R-NEW** | The row created its paths: remove them (`git clean -fd -- <paths>`); where a stub or placeholder existed before, restore it by P23 |
| **R-CO** | The row is the only writer of tracked files in this task: `git checkout acaff20 -- <paths>` |
| **R-PRE** | A path with more than one writer: `git checkout acaff20 -- <paths>` then `git apply .cache/rollback/<row>.pre.patch` (P23) |
| **R-NONE** | Read-only row: nothing to undo; its report is deleted if the row is repeated |
| **H-nn** | The verbatim commands of that line of the Host Impact Register (02_plan §14.3) |

**W01's state** (02_plan §8.1, revision 2.1). Step 23 changes two existing test files, so these two differ from `acaff20` for the rest of the task: `apps/core-web/src/test/sim-fetch.test.ts` and `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx`. The log of step 23 records the output of `git hash-object <file>` for each. Wherever a gate asks that existing test files are unchanged, these two are compared with that record and not with `acaff20`: `git hash-object <file>` prints the recorded value, which shows that the file holds the change of step 23 and nothing else. This applies to CLG (a) in step 93 (W71), to the verification of step 106 (W84) and to the rule on the 61 simulator-dependent files in the gates of steps 111 (W89) and 119 (W97). The value depends on the file content only, so a checkpoint commit does not change it.

### Rows added by the controller (not renumbered)

| Row | Agent | What it did | Artifact | Status | Decision |
|---|---|---|---|---|---|
| 20a | database-specialist | Folded the accepted security corrections into the database contract (revision 2, then 2.1) | `masterplan/03_database_contract.md` | DONE | D16, D19 |
| 20b | data-analyst | Folded them into the server specification and the client specification (revision 2 each) | `masterplan/01_specs.md`, `masterplan/04_client_integration_spec.md` | DONE | D16, D18 |

The plan's own share of the corrections was folded by the resumed row 18 (plan revision 2, D20). These rows are complete and are not delegation units of this table.

### Rev 1 provisional row → plan ID → rev 2 step (consistency finding C-12)

The three specification files still cite the provisional rows of rev 1 (for example "row 62"). This table resolves each citation. It names the same plan rows as 02_plan §21 and the "Prov." column of 02_plan §8 in their revision 2.1. A plan ID in brackets holds a part of the provisional row.

| Rev 1 row | Plan ID | Step | Rev 1 row | Plan ID | Step | Rev 1 row | Plan ID | Step |
|---|---|---|---|---|---|---|---|---|
| prov. 23 | W03, W07 | 25, 29 | prov. 55 | W53 | 75 | prov. 87 | W68 | 90 |
| prov. 24 | W06 | 28 | prov. 56 | W58 | 80 | prov. 88 | W72 | 94 |
| prov. 25 | W03, W08 | 25, 30 | prov. 57 | W03, W14 | 25, 36 | prov. 89 | W72 | 94 |
| prov. 26 | W16 | 38 | prov. 58 | W12 | 34 | prov. 90 | W73 | 95 |
| prov. 27 | W19, W22, W27 | 41, 44, 49 | prov. 59 | W30 | 52 | prov. 91 | W72 | 94 |
| prov. 28 | W10, W11, W17 | 32, 33, 39 | prov. 60 | W18, W31, W44 | 40, 53, 66 | prov. 92 | W74 | 96 |
| prov. 29 | W20 | 42 | prov. 61 | W46 | 68 | prov. 93 | W78 | 100 |
| prov. 30 | W25 | 47 | prov. 62 | W05, W50, W54 | 27, 72, 76 | prov. 94 | W79 | 101 |
| prov. 31 | W21 | 43 | prov. 63 | W54 | 76 | prov. 95 | W79 | 101 |
| prov. 32 | W09, W23, W24, W41 | 31, 45, 46, 63 | prov. 64 | W55 | 77 | prov. 96 | W80 | 102 |
| prov. 33 | W28, [W23] | 50, 45 | prov. 65 | W61 | 83 | prov. 97 | W82 | 104 |
| prov. 34 | W38 | 60 | prov. 66 | W63 | 85 | prov. 98 | W83 | 105 |
| prov. 35 | W33 | 55 | prov. 67 | W64 | 86 | prov. 99 | W84 | 106 |
| prov. 36 | W32 | 54 | prov. 68 | W65 | 87 | prov. 100 | W85 | 107 |
| prov. 37 | W04, W26 | 26, 48 | prov. 69 | W69 | 91 | prov. 101 | W86 | 108 |
| prov. 38 | W42 | 64 | prov. 70 | W70 | 92 | prov. 102 | W87 | 109 |
| prov. 39 | W34 | 56 | prov. 71 | W71 | 93 | prov. 103 | W88 | 110 |
| prov. 40 | W35 | 57 | prov. 72 | W71 | 93 | prov. 104 | W89 | 111 |
| prov. 41 | SKIPPED (D13) | — | prov. 73 | W75 | 97 | prov. 105 | W90 | 112 |
| prov. 42 | W36 | 58 | prov. 74 | W76 | 98 | prov. 106 | W95 | 117 |
| prov. 43 | W37 | 59 | prov. 75 | W77 | 99 | prov. 107 | W96 | 118 |
| prov. 44 | W37 | 59 | prov. 76 | W81 | 103 | prov. 108 | W94 | 116 |
| prov. 45 | W39 | 61 | prov. 77 | W13 | 35 | prov. 109 | W97 | 119 |
| prov. 46 | W40 | 62 | prov. 78 | W15, W51 | 37, 73 | prov. 110 | W98 | 120 |
| prov. 47 | W40 | 62 | prov. 79 | W15, W56 | 37, 78 | prov. 111 | W99 | 121 |
| prov. 48 | W29, W43 | 51, 65 | prov. 80 | W59 | 81 | prov. 112 | W100 | 122 |
| prov. 49 | W08 | 30 | prov. 81 | W57 | 79 | prov. 113 | W91 | 113 |
| prov. 50 | W45 | 67 | prov. 82 | W60 | 82 | prov. 114 | W92 | 114 |
| prov. 51 | W47 | 69 | prov. 83 | W62 | 84 | prov. 115 | W93 | 115 |
| prov. 52 | W52 | 74 | prov. 84 | W66 | 88 | prov. 116 | W101 | 123 |
| prov. 53 | W48 | 70 | prov. 85 | W66 | 88 | prov. 117 | W102 | 124 |
| prov. 54 | W49 | 71 | prov. 86 | W67 | 89 | prov. 118 | W103 | 127 |

New in rev 2, with no provisional row: W01 (step 23), W02 (step 24), W104 (step 125), W105 (step 126). The hash wrapper W09 (step 31) belongs to provisional row 32 only; the secure-store row W15 (step 37) holds the wrapper of provisional row 78 and the AVD probe of provisional row 79.

### Narrative tier blocks (paste the one a row names)

- **Tier 1 block**: "State the subject, the stakeholders, the timeline, the scope, the rationale with its evidence chain, the method, the alternatives considered, the assumptions and the gaps. Every factual claim cites `file:line`, a URL with its fetch date, or a command with its output. A claim without a source is labelled as a hypothesis."
- **Tier 2 block**: "For each finding state what was found, why it matters for this task, how it was verified, and the source (`file:line` or URL with fetch date)."
- **Tier 3 block** (implicit for logs): "State what was done and give the file path or the command output as evidence."

---

## Parallel Execution Protocol (rev 2, P1-P25): paste into every delegation of steps 22-127

**Limits (this task only, D6)**: at most **6 agents of one type** and **8 in flight**. The controller drops to 2 / 4 if the load guard of P9 keeps firing.

1. **P1 npm slots.**
   - Only three rows run `npm install` or `npm uninstall`, or edit a `package.json` or `package-lock.json`, in this order: **N1** W03 (server, shared, PostgreSQL binaries) → **N3** W13 (mobile native) → **N2** W14 (web).
   - Each runs under `/usr/bin/lockf -k -t 3600 .locks/npm.lock <command>`.
   - A conditional fallback row takes one more slot, and only after its proof failed.
   - A missing package in any other row means `needs-review`.
2. **P2 Gradle.**
   - Only W13 runs `expo prebuild`, Gradle or a native build, under `/usr/bin/lockf -k -t 3600 .locks/gradle.lock <command>`.
   - It copies the current debug APK to `.cache/apk-backup/` first (KI-21: prebuild wipes `apps/mobile/android/`).
   - `flock` is not installed; do not install it.
3. **P3 Emulators.**
   - Serials: `dems_phone` is `emulator-5554`, `dems_tablet` is `emulator-5556`, `dems_phone2` is `emulator-5558`. Always use `adb -s <serial>`.
   - **Never kill an emulator. Never boot one from a snapshot** (cold boot only, with `-no-snapshot-load -no-snapshot-save`; `npm run emulator` and `npm run emulator:phone` are not used). **Never wipe emulator data.**
   - **No row uninstalls the DEMS app or clears its data without a recorded controller decision that names the emulator.**
   - Device sessions use `apps/mobile/scripts/device-session.sh <target> '<commands>'`, which holds `.locks/dems_<avd>.lock`. A check lasts 10 minutes at most. Code changes happen outside the lock.
   - **Binding.** `dems_phone` belongs to lane 1 and `dems_tablet` to lane 2 for the whole client phase; each pairs once on its lane (the tablet in W57). `dems_phone2` is the reserved emulator: it stays unpaired until W94 and never runs a lane check. If fewer than three emulators hold the debug build, the table of 02_plan §5.5 applies (DP-1).
   - **Reverse rules.** The device side is always `tcp:4420`; the host side is the lane port, set and removed by `device-session.sh` through its optional shell variable `DEMS_CORE_HOST_PORT` (4420 to 4423; unset changes nothing). That variable is distinct from the shared constant `CORE_SERVER_PORT` and from the server's `DEMS_CORE_PORT`; on a lane both variables hold the lane port. `tcp:8081` goes to the row's Metro port; `tcp:4400` to mock-core in W97. Remove only your own rules.
   - Quote deep links passed through the device shell. Force-stop `com.dems.demo.tablet` before a row's first launch.
4. **P4 Ports.** Every listener binds `127.0.0.1` explicitly.

   | Port | Owner | Lock | Used by |
   |---|---|---|---|
   | `[::1]:5173`, `127.0.0.1:5174`, `[::1]:5175` | Another project | Never bound; its processes are never stopped | none |
   | `127.0.0.1:5173` | DEMS web console on the main instance (IPv4 explicitly) | `.locks/vite.lock` | W86, W94, W95, W96, W98 |
   | `127.0.0.1:5176`, `5177`, `5178` | Vite of lanes 1, 2, 3; each proxies `/api/v1` and `/ws` to 4421, 4422, 4423 | The lane lock | W05, the client rows, W84, W97 |
   | `127.0.0.1:4400` | mock-core, unchanged | `.locks/mock-core.lock`, reference-counted in `.locks/mock-core.users/` | W97 |
   | `127.0.0.1:4410`-`4419` | The packaged 0.1.0 launcher; the mock-core tests bind 4410 and 4411 | Serial by dependency | W89, W97 |
   | `127.0.0.1:4420` | Core server, HTTP and `/ws`, with `dems_demo` | `.locks/core-server.lock` | W58, W86, W90, W94, W95, W96, W98 |
   | `127.0.0.1:4421`-`4423` | Lane backends with `dems_lane_1` to `dems_lane_3`; 4421 is also the proof harness of W05 and W12 | `.locks/core-server.lane<k>.lock` | Live checks |
   | `127.0.0.1:4432` | PostgreSQL 18.4, TCP only, no Unix socket; 5432 is never used | `.locks/postgres.lock` | W07 onward |
   | 8081-8086 | Metro lanes (the device side stays 8081) | `device-session.sh` | Device checks; two Metro processes at most |
   | 5554, 5556, 5558 | Emulator consoles | The device locks | W02 |

5. **P5 mock-core.** `apps/mock-core/**` is read-only in this task. Port 4400 is a shared, reference-counted service: start it under `/usr/bin/lockf -k .locks/mock-core.lock` if it is not listening, register in `.locks/mock-core.users/step-<N>`, stop it only when the last user leaves. Only W89 and W97 run the mock-core test suite.
6. **P6 Write paths.** Write only the paths your row names; the binding list is the "Owned write paths" cell of your plan row. Page and screen rows write only their feature folder, its i18n file and its tests. No row writes `apps/mock-core/**`, `release/**`, `scripts/release/**`, `packages/shared/src/demo-data/**`, `packages/shared/assets/**`, `apps/core-web/src/lib/packaged-csp.ts`, `apps/mobile/app.json`, or any file under `packages/shared/src/sim/` other than `vocabulary.ts` and `auth.ts` (W16).
7. **P7 Processes.** Record every PID you start and stop it before you return (the emulators and PostgreSQL excepted). Never stop a process you did not start.
8. **P8 Progress files.** Write `delegation_progress/<agent_name>_step_<N>.md`, never a shared or per-type file. Only the controller writes `status_tasks.md`, `delegation_progress_report.md` and `decisions/decisions.md`.
9. **P9 Load** (10 cores, 24 GB).
   - Run Vitest and jest with `--maxWorkers=2`. One `vite build` at a time. Two Metro processes at most. One Gradle build.
   - **Load guard.** If a test that timed out passes when re-run alone, or the 1-minute load average stays above 10: first stop using lane 3; if it repeats, use one lane only; if it repeats, the controller drops to 2 / 4.
   - While a gate row (W58, W89) or the clean-state row (W90) or an end-to-end row (W94 to W96, W98) runs, no client-row live check runs and at most 4 other agents are in flight. The lane-3 backend that W97 starts for its own check, and the one W99 may start after W98 has finished measuring, are the two stated exceptions.
10. **P10 Sandbox.** Port binding, the emulator, `adb`, Gradle, npm installs, the mock-core suite and git writes need a per-command sandbox bypass. Never `cd` into a subfolder; use absolute paths.
11. **P11 Noise and the 429 rule.**
    - If a typecheck or test fails only in files owned by a row running at the same time, or during an install window, re-run it after the cause ends and record both runs.
    - **A 429 is not a defect.** More than 20 refusals or failed sign-ins of one key within a minute are answered 429 on everything except health for up to 60 s (the denial budget). Wait out the window, then repeat the check. Each lane has its own counters.
12. **P12 Gaps.** A row that needs a new package, a native module, a contract change, a schema change or a simulator change returns `needs-review` with the request, or logs the gap and uses a local adapter inside its own folder:
    - `CONTRACT-GAP-<n>` for `packages/shared/src/api/` (closed by W83 or by a controller-scheduled contract slot);
    - `SCHEMA-GAP-<n>` for the database (closed by a controller-scheduled migration slot);
    - `BE-GAP-<n>` for a backend defect found by a client row (routed to the module's owning row);
    - `SIM-GAP-<n>` for the simulator (no writer is planned; `needs-review`). No row adds a `SIM-GAP` marker to mobile code (KI-07).
13. **P13 Demo data is read-only.** `packages/shared/src/demo-data/`, `packages/shared/assets/` and the generator scripts are never changed or regenerated. The seed imports them.
14. **P14 Lanes** (replaces the shared Vite server of rev 1).
    - Lane k (k = 1, 2, 3) is one lock, `.locks/core-server.lane<k>.lock`, that owns backend port 442k, database `dems_lane_k` and Vite port 517(5+k). Lane 3 has no emulator.
    - A live check runs inside one `/usr/bin/lockf -k -t 900` on its lane lock, by the procedure of 02_plan §5.3: reset the lane database with `db:reset`, start the server with `DEMS_CORE_PORT=442k`, record the PID in `.locks/core-server.lane<k>.pid`, check health, run the web check through the lane's Vite port or the device check through `device-session.sh`, stop what you started.
    - A web row takes the first free lane in the order 3, 1, 2 (probe with `lockf -k -t 0`), so lanes 1 and 2 stay free for device checks.
    - **Open the console at `http://127.0.0.1:<port>`, never at `localhost`**: the server holds no `localhost` origin and answers such a sign-in with 403 `ORIGIN_NOT_ALLOWED`.
    - `DEMS_DEMO_CONTROLS=1` is added only by the rows whose check needs the demo operations (W76, W82, and W96 if it injects a fault).
15. **P15 PostgreSQL instance.**
    - One project-local cluster on `127.0.0.1:4432`, started by W07 through `scripts/pg/` and left running, with its PID in `.locks/postgres.pid`. **No Docker, no login or background service, no shell-profile edit.**
    - **Three roles.** `dems_admin` is the bootstrap superuser, used at provisioning only. `dems_owner` (not a superuser) owns the databases and runs migrate, seed, reset and the test helper. `dems_app` is the server's runtime role.
    - **After W07 nothing connects as `dems_admin`.**
    - Databases: `dems_demo` (main instance), `dems_lane_1` to `dems_lane_3`, and `dems_test_<label>_<stamp>_...` for tests, each created and dropped by the test helper as `dems_owner`. Each row's tests use their own clones (`DEMS_TEST_STEP=<row>`).
    - Only W89 (stops and starts it) and W90 (removes and rebuilds `.data/`) use the instance exclusively. No other row stops it.
16. **P16 Migration writer.** Only W17, and a controller-scheduled slot for a `SCHEMA-GAP`, write `apps/core-server/src/db/schema/`, `src/db/migrations/` and `drizzle.config.ts`. Applying migrations to `dems_demo` runs under `/usr/bin/lockf -k .locks/db-migrate.lock`. Test databases migrate freely.
17. **P17 Contract owner.** One owner at a time, as a chain: W16 (vocabulary) → W19 (contract A) → W22 (contract B) → W27 (contract C) → W83 (close-out). The owner writes `packages/shared/src/api/`, `packages/shared/openapi/`, `packages/shared/scripts/gen-openapi.ts`, the three pinned shared tests and its own `api-*` tests. Every other row reads the contract and logs `CONTRACT-GAP-<n>`. An extra slot runs under `.locks/contract.lock`.
18. **P18 Main instance (port 4420).**
    - `127.0.0.1:4420` with `dems_demo` has one owner at a time: `/usr/bin/lockf -k -t 900 .locks/core-server.lock`. The holder starts the server from the current tree, records the PID in `.locks/core-server.pid`, runs its check, stops the process and releases the lock.
    - Holders: W58, W86, W90, W94 → W95 → W96, W98. Client rows never use the main instance; they use a lane (P14).
    - Backend rows test in-process against their own cloned database and never bind a port.
19. **P19 Secrets, data and commits.**
    - **Three credential files**, all under the git-ignored `.data/` (mode 0700), each of mode 0600: `.data/pg.pwfile` (`dems_admin`; read by `scripts/pg/` only), `.data/pg.owner.env` (`dems_owner`), `.data/pg.env` (`dems_app`). **None is printed, staged or passed as an argument.**
    - Never print a secret, a password, a token, a pairing code or a device credential in a log, a progress file or a document. A pairing code that a row obtains to pair its lane emulator is typed into the app and written nowhere.
    - Seed data is synthetic. Never use a real person's name or email.
    - **Commits** (row 22, W104, W105, W103) are local, staged by explicit path, with no remote and no push. **Never staged**: `release/`, `.data/`, `.cache/`, `.locks/`, `apps/mobile/signing/`, the design book, any env or credential file. A checkpoint commit stages only the paths of rows the controller's tracker shows as complete, leaves out any path with a writer still in flight, and names what it left out.
20. **P20 Network.** **Loopback only**: no LAN address, no TLS setup, no cloud service, no account. Implementation rows fetch only from the npm registry (W03, W13, W14, a fallback row), Maven artefacts during the Gradle build of W13, and `npm audit` (W03, W13, W14, W99). Homebrew is used only by the fallback row Fb. No design-book content goes into any query.
21. **P21 Additive only.** No row deletes or renames anything under `apps/mock-core/`, `packages/shared/src/sim/`, `release/` or `scripts/release/`, or any stored key of the clients. `release/` is never written. Simulated-mode tests stay green in every row.
22. **P22 Reporting.** Each row's return message lists its findings, its deviations from the plan and the decisions it needs. The controller records them as F-n, DR-n and D-n.
23. **P23 Rollback pre-image.** A row that writes a path with more than one writer (table below) saves, before its first edit, `git diff acaff20 -- <those paths> > .cache/rollback/<row>.pre.patch`. The comparison is against **`acaff20`**, not against the index, so the patch stays right after a checkpoint commit. Its rollback is `git checkout acaff20 -- <paths>` followed by `git apply .cache/rollback/<row>.pre.patch`.
24. **P24 Gate rule and test ledger.**
    - Root `npm run typecheck`, `npm run lint` and `npm test` need **no database** and no running server. Database-backed tests run through `npm run test:db`, which attaches to or starts PostgreSQL and fails, never skips.
    - Tests run **per workspace** as `npm run test -w <workspace> -- --maxWorkers=2`; the root script does not forward the worker limit.
    - Gate commands, from `/Users/gsp-budi/Documents/DEMS`: `npm run typecheck`; `npm run lint`; `npm run test -w @dems/shared -- --maxWorkers=2`; the same for `@dems/core-web`, `@dems/mobile` and `@dems/core-server` (project `unit`); `npm run test -w @dems/mock-core -- --maxWorkers=2` (W89 and W97 only); `npm run test:pg-scripts`; `npm run test:db`; `npm test` (W89 only, with PostgreSQL stopped).
    - Until W01 is done a gate accepts exactly the two baseline failures by name; from W01 on, none.
    - **Ledger.** Baseline at `acaff20`: shared 508 tests in 28 files, mock-core 19 in 4, core-web 438 in 39, mobile 833 in 72 suites, core-server 0. Each row reports, per workspace, the runner totals before and after and its new test files by name (core-server: projects `unit` and `db` separately). Expected total = baseline + reported additions. A gate passes when failed = 0 and the total is at or above the ledger; a total below it is a FAIL that names the row which last wrote that workspace.
    - An existing test changes only by design, as a recorded decision. The 61 simulator-dependent test files pass in every client row; their diff against `acaff20` holds only the two files of W01 and recorded by-design changes.
    - **W01's state.** The two files of W01 (`apps/core-web/src/test/sim-fetch.test.ts`, `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx`) are compared with the `git hash-object` values recorded in the log of step 23, not with `acaff20`: in the client gate of W71, in the verification of W84 and in the gates W89 and W97.
    - A checkpoint commit follows a gate and never replaces one.
25. **P25 Decorator seam.** After W08 no row edits `apps/core-server/src/app.ts`, `index.ts` or `config.ts`. A module reaches another through the decorators W08 declares: `deviceResolver`, `originDecision`, `sessionRegistry`, `auditWriter`, `clock`, `pipeline` (the serial unit-of-work queue, built by W21), `engine`, `publish`, `readiness`. A missing seam is `needs-review`.

### Waves within D6 (refined rows)

A wave is the earliest point at which its rows can start. The controller starts a row when its Depends On is done, its decision point (if any) is recorded and a slot is free, and enforces both limits over everything in flight.

| Wave | Plan rows (steps) | Agents by type | In flight (max) | Serial resources and notes |
|---|---|---|--:|---|
| E1 | W01-W05 (23-27) | coder-execution ×5 | 5 | npm N1 (W03); lane 1 with ports 4421 and 5176 (W05); three device locks (W02) |
| E2 | W06, W08, W09 (28, 30, 31), then W07 (29) | verifier ×1, coder-execution ×3 | 4 | W07 follows W06 (C-09) and binds 4432 after its own `lsof` probe. If W02 ends `blocked`, the controller starts W06 anyway, so the emulators cannot hold up the backend. The DP-1 outcome is recorded after W06 |
| E3 | W10-W13 (32-35) | database-specialist ×2, coder-execution ×2 | 4 | npm N3 and Gradle (W13); lane 1 port 4421 (W12); W12 and W13 queue on the device locks |
| E4 | W14, W15 (36, 37) | coder-execution ×2 | 2 | npm N2 (W14); device locks (W15). The DP-2 case is recorded after W15 |
| B1 | W16, W17, W18 (38-40) | coder-execution ×2, database-specialist ×1 | 3 | Contract slot (W16); migration writer (W17). B1 may overlap E3 and E4: 7 in flight at most |
| B2 | W19, W20, W21 (41-43) | coder-execution ×2, database-specialist ×1 | 3 | Contract slot (W19); first build of `dems_demo` under `db-migrate.lock` (W20) |
| B3 | W22-W26 (44-48) | coder-execution ×4, database-specialist ×1 | 5 | Contract slot (W22) |
| B4 | W27-W31 (49-53) | coder-execution ×4, database-specialist ×1 | 5 | Contract slot (W27); `db-migrate.lock` and advisory key 442001, lane databases created (W29) |
| B5 | W32-W38 (54-60) | coder-execution ×6, senior-code-reviewer ×1 | 7 | Each row tests on its own cloned database |
| B6 | W39-W44 (61-66) | coder-execution ×6 | 6 | Ephemeral loopback ports in the tests of W42 |
| B7 | W45-W51 (67-73) | security-review ×1, senior-code-reviewer ×1, test-expert ×3, coder-execution ×2 | 7 | Lanes for the live checks of W50 (web) and W51 (device lane) |
| B8 | W52-W57 (74-79) | test-expert ×2, coder-execution ×4 | 6 | Lanes; lane 2 with the tablet (W57) |
| B9 | W58-W61 (80-83), then W104 (125) | verifier ×1, coder-execution ×2, senior-code-reviewer ×1, git-specialist ×1 | 5 | W58 owns port 4420 and `dems_demo`; the device checks of W59 and W60 wait for it. W104 follows W58 and holds the git index |
| C1 | W62-W68 (84-90) | senior-code-reviewer ×1, coder-execution ×6 | 7 | Three lanes; three web rows, three mobile rows |
| C2 | W69-W74 (91-96) | coder-execution ×6 | 6 | Same |
| C3 | W75-W80 (97-102) | coder-execution ×6 | 6 | Same; W76 on a lane started with `DEMS_DEMO_CONTROLS=1` |
| C4 | W81, W82 (103, 104), then W105 (126) | coder-execution ×2, git-specialist ×1 | 3 | W81 and W82 may start with C3 as slots free (6 coder-execution, 8 in flight at most). W105 follows the last web row and holds the git index |
| F1 | W83 (105) | coder-execution ×1 | 1 | Contract slot |
| F2 | W84, W85 (106, 107), then W86 (108) | coder-execution ×3 | 3 | A lane (W84); W86 owns ports 4420 and 5173 and one lane emulator |
| F3 | W87 (109) | test-expert ×1 | 1 | Own cloned databases |
| F4 | W88, W89 (110, 111) | data-analyst ×1, verifier ×1 | 2 | W89 uses PostgreSQL exclusively and runs the mock-core suite (4410, 4411) |
| V1 | W90-W93 (112-115) | verifier ×1, senior-code-reviewer ×3 | 4 | W90 uses PostgreSQL and port 4420 exclusively; the reviews are read-only |
| V2 | W94 → W95 → W96 (116-118); beside them W97 (119) | verifier ×2 at a time | 2 | One serial chain on the main instance with the reserved emulator; W97 on lane 3, ports 4400 and 4410, a lane emulator |
| V3 | W98, W99, W100 (120-122) | verifier ×1, security-review ×2 | 3 | W98 owns port 4420 and measures alone; W99 starts a lane-3 server only after W98 has finished measuring |
| V4, V5, V6 | W101 (123); W102 (124); W103 (127) | verifier; data-analyst; git-specialist | 1 | Git index (W103, after W105) |

**Limit check.** No wave exceeds 6 agents of one type (peak: coder-execution ×6 in B5, B6, C1, C2, C3) or 8 in flight (peak: 7 in B5, B7, C1; 7 when B1 overlaps E3). The counts are those of 02_plan §9, confirmed by row 19 (§6.4); the two changes of this revision (W07 after W06; two more dependencies on W50 and W51) move no row to another wave.

**Critical path.** 22 → W03 and W02 → W06 → W07 → W10 → W17 → W20 → W24 → W28 → W32 → W42 → W47 and W48 → W58 → the page and screen rows → W83 → W84 → W86 and W87 → W89 → W90 → W94 → W95 → W96 → W98 and W99 → W101 → W102 → W103. The contract chain W16 → W19 → W22 → W27 feeds it at W24, W42 and W34 to W44. The checkpoint commits are off the path; only W103 waits for W105.

### Serial and exclusive resources by row

| Resource | Rows |
|---|---|
| A device (emulator) | W02 (boots all three), W06 (read-only `adb`), W12, W13, W15, W51, W56, W57 (the tablet), W59, W60, W66, W67, W68, W72, W73, W74, W78, W79, W80, W82, W86 (a lane emulator), W94, W95, W96, W98 (the reserved emulator), W97 (a lane emulator), W100 (read-only log check) |
| Lane 1, fixed | W05, W12 (the proof harness on 4421) |
| Lane 2, fixed | W57 |
| Lane 3, fixed | W97; W99 only if it needs a running server |
| Any free lane (web rows; order 3, 1, 2) | W50, W54, W55, W63, W64, W65, W69, W70, W71, W75, W76, W77, W81, W84 |
| Lane 1 or lane 2 with its emulator (mobile rows) | W51, W56, W59, W60, W66, W67, W68, W72, W73, W74, W78, W79, W80, W82 |
| Port 4420 with `dems_demo` (one owner at a time) | W58, W86, W90, W94, W95, W96, W98 |
| Port 5173 (IPv4) | W86, W94, W95, W96, W98 |
| PostgreSQL, exclusive use | W89 (stops and starts it), W90 (removes and rebuilds `.data/`) |
| PostgreSQL, first bind of 4432 | W07 |
| mock-core suite (4410, 4411) and port 4400 | W89, W97; port 4400 only W97 |
| npm slot | W03, W13, W14. Gradle: W13 |
| Migration writer | W17. `db-migrate.lock`: W20, W29 |
| Contract owner | W16, W19, W22, W27, W83 |
| Git index | Row 22, W104, W105, W103 |
| Own cloned test databases (shared instance, no exclusivity) | W10, W11, W17, W20, W21, W24, W25, W26, W28, W29, W32 to W37, W39 to W43, W47, W48, W49, W52, W53, W58, W83, W87 |

### Collision scan

**Rule.** Two rows may run together when neither depends on the other, directly or through other rows. For every such pair the write paths, the locks, the fixed ports and the databases must be disjoint or serialised by a lock that queues.

**Result.** 0 write-path overlaps between rows with no dependency path. The figure is the plan's script result (02_plan §10.3) and was recomputed independently by row 19 (§6.3: 37 pairs share a path, and in every pair one row is an ancestor of the other). This revision adds no write path; its three dependency changes only add ancestors.

**Paths with more than one writer** (each writer depends on the one before it; P23 applies):

| Path | Writers in order |
|---|---|
| `package-lock.json` | W03 → W13 → W14 |
| `packages/shared/src/api/**`, `packages/shared/openapi/**`, `packages/shared/scripts/gen-openapi.ts`, the three pinned shared tests, `api-*.test.ts` | W19 → W22 → W27 → W83 |
| `packages/shared/src/i18n/en/common.ts` | W16 → W50 |
| `packages/shared/src/client/index.ts`, `src/live/index.ts`, `src/live/source/index.ts`, `src/live/testing/index.ts` | W03 (placeholder) → W12, W18, W44, W31 (the owner of the folder) |
| `apps/core-server/src/plugins/<name>/index.ts`, `src/modules/<area>/index.ts`, `src/core/index.ts`, `src/engine/index.ts`, `src/realtime/index.ts` | W08 (stub) → the row that owns the folder |
| `apps/core-server/src/modules/identity/**` | W08 (stub) → W09 (`password-hash/`) → W24 (the module) → W41 (`biometric/`) |
| `apps/mobile/src/runtime/debug.ts` | W12 → W51 |
| `apps/mobile/src/runtime/dev-probes.ts` | W12 → W15 |
| `.cache/proof-harness/**` (git-ignored) | W05 → W12 |
| `apps/core-web/src/features/users-roles/index.tsx`, `features/paired-devices/index.tsx`, `packages/shared/src/i18n/en/users-roles.ts`, `en/paired-devices.ts` | W54 (stub) → W77, W81 (the page) |
| `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` | W01 (fixed clock) → W71 (the folder; it does not edit this file); added by consistency finding C-02. W104 leaves it out and names it; W105 stages it |

The other file of W01, `apps/core-web/src/test/sim-fetch.test.ts`, has no second writer and no rollback touches it; it is an API Reference test, so the verification of W84 treats it the same way (W01's state).

**Per wave.** The write-path roots, locks and fixed ports of each wave are those of 02_plan §10.2; no wave has two rows that hold the same lock other than as a queue (the lanes, the device locks).

### Model tier per row (CLAUDE.md §11)

| Tier | Rows | Reason |
|---|---|---|
| D (`model="sonnet"` on the call) | W02 (24), W14 (36), W85 (107): coder-execution rows that are purely mechanical | Boot three emulators with given commands; install one pinned package; fill a notices section from the packages' licence files |
| D (agent default) | W104 (125), W105 (126), W103 (127); row 22: git-specialist | Scripted git work with one checkable output |
| R, never downgraded: verification-phase agents | verifier: W06, W58, W89, W90, W94 to W98, W101; security-review: W45, W99, W100; senior-code-reviewer: W38, W46, W61, W62, W91, W92, W93; test-expert: W47, W48, W49, W52, W53, W87 | Their errors propagate into everything downstream |
| R | Every other coder-execution row (65 rows); database-specialist W10, W11, W17, W20, W25, W29; data-analyst W88, W102 | Design choices, trade-offs or writing for a reader |
| Escalate D to R once (`model="opus"`) | Any tier-D row that returns `blocked` or `needs-review` or fails the completion gate | If the R re-run also fails it is a real blocker |

Tier D is used only where the plan says so (six rows). The controller records every override in `delegation_progress_report.md`.

### Checkpoints and feedback loop

- **Progress checkpoints** (`checkpoint-resume`): after E4, B2, B4, B6, W58 with W104, C2, C4 with W105, W89, W96 and W103.
- **Review checkpoints inside the implementation phase**: CP-B1 (W38), CP-S1 (W45), CP-C1 (W46), CP-W1 (W61), CP-M1 (W62). They are parallel audits. W58 is the gate that requires CP-B1 and CP-S1 to have no open blocker; W89 requires CP-C1, CP-W1 and CP-M1.
- **Gates**: W58 (backend) and W89 (root).
- **Checkpoint commits**: W104 after W58, W105 after the last web row; the docs commit (row 22) and the final commit (W103) complete the four local commits.
- **Feedback loop**:
  - A failed Verification cell goes back to the same agent with (a) the failing check, (b) the artifact to rework and (c) the expected correction. The check is then re-run.
  - Findings of W38 and W45 go back to the owning row before W58. Findings of W91 to W93, W99 and W100 go back to the owning row; any code change after those reviews started triggers a delta re-check by the same reviewer before W103.
  - A finding that needs a row of its own takes a number from W106 to W109 and the next free step number.
  - No block without a re-route path: a finding that needs a U1-U9 action goes to the controller, which asks the user.

### Decision points

| ID | Decision point | When | Options | Controller's default |
|---|---|---|---|---|
| DP-1 | An emulator holds the release-signed build | After W06, before W12 and the install step of W13 | A use only the emulators that hold the debug build / B uninstall the DEMS app on one named emulator / C ask the user | **A, decided by D17.** An uninstall needs a recorded decision that names the emulator. What is recorded after W06 is the list of debug-build emulators; with none, W13 returns `needs-review` |
| DP-2 | The secure-store observations of W15 show a second prompt or a failing protected read or write | After W15, before W56 | A keep `requireAuthentication` / B store the token without it and keep the OS prompt as the gate | **Decided by D16**: B only where `isDevice` is false or the build is a debug build; no silent fallback; no text that claims hardware protection. W15 records the case per AVD |
| DP-3 | How the "no device credential" state of SC5 is produced | Before W94 | A first Live launch of the reserved emulator, which never paired / B uninstall and reinstall the app on one named emulator / C unpair on the device | **A** (D17 keeps `dems_phone2` unpaired). C if no emulator could be reserved. B only as a recorded decision |

### Early proofs: time box and fallback

A time box is a limit set by the plan: when it is reached without a pass, the row stops and reports, the controller records the drift and schedules the fallback row.

| Proof | Rows (steps) | Time box | Fallback |
|---|---|---|---|
| (a) The two calendar-dependent web tests pass on any date | W01 (23) | 30 min | Inside the row: derive the identifier and the count from simulator state. If still red: `needs-review`; gates keep accepting exactly these two failures by name |
| (b) PostgreSQL 18.4 from the npm binaries, three roles, the trial | W03 (25), W07 (29) | 45 min for W07 | **Fb**: the Homebrew keg `postgresql@18`; drift entry; the user is told with the removal block H-12 |
| (c) `drizzle-kit` and `drizzle-orm` on PostgreSQL 18.4 | W10 (32) | 45 min | **Fc**: step 1 inside W17 (a hand-written constraint file, no row); step 2 only if the tool does not run at all: Kysely with `node-pg-migrate` |
| (d) The shared simulator runs headless under Node | W04 (26) | 60 min | **Fd**: the pure transition functions with a server-owned loop; W26 grows |
| (e) The typed client on an emulator with the default `expo/fetch` | W12 (34) | 90 min | **Fe**: the generator `@hey-api/openapi-ts`; one npm slot and a regeneration step in every contract row |
| (f) The Vite dev proxy carries the cookie, the headers and the socket upgrade | W05 (27) | 45 min | **Ff**: cross-origin calls with `@fastify/cors`; it returns to a security review before it is built |
| (g) `expo-secure-store` on each debug-build AVD | W15 (37) | 60 min after W13 | No row: the case of DP-2. If even the unprotected item fails: `needs-review` |

Smaller proofs ride on W07 (PG-21, trial step T5-j), W08 (SA-01, SA-13), W09 (AS-08; fallback **Fh**), W11 (template clone), W23 (SA-14) and W24 (SA-12); each has a fallback local to its row (02_plan §6).

### Conditional rows (not delegated unless triggered)

The controller schedules one of these only after the proof failed and the drift is recorded. It then receives the next free step number (128 onward) and one extra npm slot where a package changes. Their full cells are in 02_plan §8.6.

| ID | Triggered by | What it does | Owner | Effect on later rows |
|---|---|---|---|---|
| Fb | W03 (T1) or W07 (T2 to T7) fails | Removes the npm binaries, installs the Homebrew keg `postgresql@18` 18.6, repeats the trial | coder-execution | Host register gains H-12 (outside the project); the README names the keg; the user is told |
| Fc | W10 fails | Step 2 only: replaces the tools by `kysely` 0.29.6 with `node-pg-migrate` 9.0.0 | database-specialist | Changes W17, W20, W21, W29 and the data access of every module row |
| Fd | W04 fails on d1, d2 or d5 | Proves the pure transition functions with a server-owned loop | coder-execution | W26 grows; operations and tables do not change |
| Fe | W12 fails on the REST points | Replaces the hand-built client by `@hey-api/openapi-ts` 0.99.0 | coder-execution | W19, W22, W27 and W83 gain a regeneration step |
| Ff | W05 fails | Cross-origin transport with `@fastify/cors` 11.3.0 | coder-execution | W23 and W50 change; OR-5, SR-04, AC-B-43, AC-C-33 and AC-C-102 change; **a security review comes first** |
| Fh | W09 fails | Replaces the built-in by `@node-rs/argon2` 2.2.1 | coder-execution | None beyond W09 |

**Reserved numbers W106 to W109** stay free for a review finding that needs a row of its own, or for a split of one of the longest rows (W07, W08, W17, W23, W24, W28, W42) if it does not fit one agent context.

### DEFERRABLE list (nothing is cut by default, D17)

Each item is cut only by a recorded controller decision, with its consequence reported to the user.

| ID | Item | Rows affected | Consequence |
|---|---|---|---|
| DF-1 | The bulk fixture at full volume | W25 reduced; W39, W47, W52 run on the seed template | Paging beyond one page and chain verification over thousands of rows are not proven |
| DF-2 | The performance measurements | W98 reduced | I8 is reported as observed, not measured |
| DF-3 | Reset and scenario load from inside the running server | W43 reduced; `db:reset` on the command line stays | AC-B-57 loses its reset clause; the reset buttons are hidden in Live mode |
| DF-4 | Biometric unlock on mobile in Live mode | W56 and W82 without the biometric parts; W41 stays | AC-C-68 to AC-C-71 are not met; a drift entry |
| DF-5 | The QR tile | W14 dropped; W81 shows the digits only | "Also shown as a QR" (Q8) is not met; a drift entry |
| DF-6 | Two extras of the API Reference page | W84 reduced | AC-C-100 is not met for the Simulated listing of the other 65 operations |
| DF-7 | Device checks of the mobile folders that change no production file | W72, W79 | Three fewer device captures |
| DF-8 | The tablet layout check of the Pair screen | W57 | KI-01 stays fully open |

**Never cut**: server-side RBAC enforcement (W23, W24, W28, W33, W47); pairing (W32, W48, W57, W60, the issue, list and revoke of W81); PostgreSQL persistence (W07, W17, W20, W21, W26, W53, W90); the three end-to-end rows (W94, W95, W96); the gates (W58, W89); the regression row (W97); the security reviews (W45, W99, W100).

### Coverage of the acceptance criteria and security requirements

**How it was checked.** (1) The definition rows were counted with Grep in the specification files: 93 `AC-B`, 110 `AC-C` and 82 `SR` rows, each list contiguous from 01. (2) The AC and SR IDs of every refined row were copied from the "Implements" cell of its plan row. (3) Each ID from AC-B-01 to 93, AC-C-01 to 110 and SR-01 to 82 was then walked by hand against those row cells; every one is carried by at least one row. (4) Row 19 recomputed the same coverage by script from the plan's cells (§5: 93 of 93, 110 of 110, 82 of 82). No script was run by this agent; a range such as `AC-B-23..27` means every ID in it. Plan IDs are shown; step = plan number + 22.

| AC-B | Plan rows | AC-B | Plan rows |
|---|---|---|---|
| 01 | W17, W90 | 02 | W20, W90 |
| 03 | W07, W58, W90 | 04..06 | W53 |
| 07 | W26 | 08 | W08, W58 |
| 09 | W27, W52 | 10 | W52 |
| 11 | W27, W83 | 12 | W28 |
| 13 | W19, W83 | 14 | W08, W23, W52 |
| 15 | W47 | 16 | W28, W47 |
| 17 | W16, W20 | 18 | W28, W33 |
| 19 | W42 | 20 | W33, W42 |
| 21 | W33 | 22 | W96 |
| 23..27 | W24 | 28 | W20, W24, W48 |
| 29 | W24, W32, W41, W58 | 30 | W09, W24 |
| 31 | W41 | 32..38 | W32, W48 |
| 39 | W48 | 40 | W94 |
| 41 | W32, W48 | 42 | W42 |
| 43 | W23, W28, W42 | 44..45 | W49 |
| 46 | W22, W42, W49 | 47 | W49 |
| 48 | W42 | 49..50 | W34 |
| 51 | W95 | 52..53 | W04, W26 |
| 54 | W17, W21 | 55 | W21, W26 |
| 56 | W43 | 57 | W29, W43 |
| 58 | W01, W03, W08, W58, W89 | 59 | W01, W89, W97 |
| 60 | W97 | 61 | W08, W97 |
| 62 | W16, W46, W97 | 63 | W44, W97 |
| 64 | W07, W58, W90 | 65 | W20 |
| 66 | W58, W99 | 67 | W86, W90 |
| 68 | W87, and MODG in every module row | 69 | W35 |
| 70 | W35, W52 | 71 | W40 |
| 72 | W29, W43 | 73 | W28, W42 |
| 74 | W23, W28, W42 | 75 | W28, W32 |
| 76..77 | W32 | 78 | W41 |
| 79 | W33 | 80 | W24 |
| 81 | W47 | 82 | W41, W48 |
| 83 | W41 | 84 | W28, W42 |
| 85 | W42 | 86 | W07, W08 |
| 87 | W17, W29, W39 | 88 | W39 |
| 89 | W40 | 90 | W24 |
| 91 | W03, W07, W13, W14, W90 | 92 | W86, W90 |
| 93 | W19, W52 | | |

| AC-C | Plan rows | AC-C | Plan rows |
|---|---|---|---|
| 01 | W12, W27 | 02 | W12, W18, W30, W31, W44, W46, W92 |
| 03..05 | W12 | 06 | W18, W44 |
| 07..08 | W44 | 09 | W18 |
| 10..14 | W44 | 15 | W30, W44 |
| 16 | W30 | 17 | W31 |
| 18 | W50, W84 | 19..22 | W50 |
| 23 | W50, W55 | 24 | W54 |
| 25 | W50, W55 | 26 | W54 |
| 27 | W97 | 28 | W51, W62 |
| 29 | W51 | 30 | W66 |
| 31 | W60, W82 | 32 | W51 |
| 33 | W50 | 34 | W05, W50 |
| 35 | W50, W61, W97 | 36 | W50 |
| 37 | W50, W95 | 38 | W55, W61 |
| 39 | W44, W55 | 40 | W50, W55 |
| 41 | W50 | 42..44 | W55 |
| 45 | W54, W55 | 46 | W50 |
| 47 | W55 | 48 | W63, W66, and CLG in W63 to W82 |
| 49 | W51, W54 | 50 | W54, W60, W67 |
| 51 | W54 | 52 | W76, W82 |
| 53 | W63, W87, and CLG in W63 to W82 | 54 | W44 |
| 55 | W96 | 56 | W87 |
| 57..58 | W64, W67 | 59 | W51, W54 |
| 60 | W75, W76 | 61 | W69, W74 |
| 62 | W67 | 63 | W74, W78 |
| 64 | W95 | 65 | W56, W62, W100 |
| 66 | W15, W62, W93 | 67 | W56 |
| 68 | W56, W82 | 69..70 | W56 |
| 71 | W15, W56 | 72 | W59 |
| 73..74 | W60 | 75..77 | W57 |
| 78..79 | W51, W60 | 80 | W57 |
| 81 | W57, W94 | 82 | W94 |
| 83 | W82 | 84..85 | W13 |
| 86..91 | W77 | 92..99 | W81 |
| 100 | W84 | 101 | W01, W50, W51, W63, W87, W89, W97, and CLG in W63 to W82 |
| 102 | W05, W50 | 103 | W84, W100 |
| 104 | W55, W59 | 105 | W15, W56, W100 |
| 106 | W50, W81 | 107 | W55, W81, W84 |
| 108 | W56 | 109 | W75 |
| 110 | W55, W59 | | |

| SR | Plan rows | SR | Plan rows |
|---|---|---|---|
| 01 | W07, W08, W58 | 56 | W29 |
| 02 | W07 | 57 | W43 |
| 03 | W08, W58 | 58 | W29, W43 |
| 04 | W08, W23 | 59 | W26, W35, W43 |
| 05..06 | W09, W24 | 60 | W03, W07 |
| 07..11 | W24 | 61 | W24 |
| 12 | W24, W33 | 62 | W20, W25 |
| 13 | W24, W28 | 63 | W20, W55, W59, W86 |
| 14..15 | W24 | 64 | W08, W19 |
| 16 | W24, W55, W56, W100 | 65 | W21, W26 |
| 17 | W24, W53 | 66 | W35 |
| 18 | W24 | 67 | W17, W91 |
| 19..21 | W23 | 68 | W07, W08, W11, W17, W29, W43 |
| 22..23 | W24 | 69 | W23, W28, W42 |
| 24 | W23 | 70 | W23, W42 |
| 25 | W24 | 71 | W23, W28, W32 |
| 26..31 | W32 | 72 | W17, W21, W24, W32, W33, W41 |
| 32 | W15, W100 | 73 | W24, W47 |
| 33..35 | W32 | 74 | W41, W42 |
| 36..37 | W41 | 75 | W08, W23, W28, W42 |
| 38..42 | W42 | 76 | W03, W08, W52 |
| 43..46 | W28 | 77 | W07, W08 |
| 47 | W33 | 78 | W17, W29, W39 |
| 48..50 | W08 | 79 | W04, W26 |
| 51 | W42 | 80 | W03, W07, W13, W14, W90 |
| 52..54 | W17, W21 | 81 | W39 |
| 55 | W26 | 82 | W40 |

The two review rows W45 and W99 check all 82 requirements; the table names the rows that implement them. Nine criteria are carried only by a verification row because they are two-client or host observations: AC-B-22, 40, 51, 60, 66 and AC-C-27, 55, 64, 82.

## Dependencies

- **Controller records between rows**:
  - After W06 (step 28): the outcome of DP-1, which is the list of emulators that hold the debug build. W12 and W13 wait for it.
  - After W15 (step 37): the DP-2 case per AVD. W56 builds to it.
  - Before W94 (step 116): DP-3.
  - On a failed early proof: the drift entry, then the conditional row. Fb and Ff are also reported to the user (a host change outside the project; a security review).
  - Any cut from the DEFERRABLE list, with its consequence.
  - The B.9 class of this revision (MAJOR) and the items MJ-10 to MJ-16.
- **Plan revision 2.1** (06:12): this file is aligned with it. The 105 output paths are equal (02_plan §8.7; this file's name is the reference if the two ever differ); W07 depends on W03 and W06 in both; the shell variable is `DEMS_CORE_HOST_PORT` in both. Three differences remain on purpose, each a rule of this blueprint: the two extra dependencies of steps 72 and 73 (RL-22), the wording of the load-guard exceptions (RL-29) and the way step 127 searches for credential contents (RL-23).
- **A blocked emulator boot**: if step 24 (W02) ends `blocked`, the controller starts step 28 (W06) on that state; W06 reports an emulator that is not running as such. This is the one case in which a row starts before its Depends On is done.
- **Internet**: the npm registry for W03, W13, W14 and any fallback row; Maven artefacts during the Gradle build of W13; `npm audit` in W03, W13, W14 and W99. Nothing else leaves the machine.
- **Sandbox bypass approvals**: port binding (W05, W07, every live check, the gates), the emulators and `adb` (W02, W06, W12, W13, W15, every device check), Gradle (W13), npm installs (W03, W13, W14), the mock-core suite (W89, W97), the git writes of row 22, W104, W105 and W103.
- **Browser** (the browser tool first): the web live checks, W94 to W96, W97.
- **Git identity** for row 22, W104, W105 and W103.
- **Host**: the Mac stays awake with the lid open during long waves (KI-26).
- **Baseline**: commit `acaff20` (D3) for every diff check and every code rollback; the docs commit of row 22 as the SC1 reference.
- **Controller-owned artifacts, not rows**: `gateway_check/01_gate_report.md`, `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `report/report.md`.

## Verification & Testing Strategy

- **Unit testing.** Every implementation row ships its own tests and passes its gate (SG, MODG or CLG) inside the row. Server guards, the password hash and the logger run in the database-free project; the shared client layer and every client row test the Live path on the contract-checked fake transport; Simulated-mode tests stay unchanged. Agent: the row's owner.
- **Integration testing.** Each backend module runs in-process against a real PostgreSQL 18.4, one database per test file cloned from a template, as `dems_app` (the helper as `dems_owner`). Five concurrency tests and the two decision tables are part of the module rows (W24, W28, W32, W33, W41, W42).
- **Acceptance testing** (test-expert, independent of the module rows): W47 the role-by-endpoint matrix, W52 contract conformance, W48 the pairing lifecycle, W49 two-client shared state, W53 restart and recovery. W58 gates the backend on them.
- **Functional testing on bulk data.** W47, W52 and W39 run on the bulk fixture of W25 (the seed template only if DF-1 is taken).
- **UAT.** W94, W95 and W96 run SC5, SC3 and SC4 by hand on the main instance, the canonical seed and the reserved emulator, each step with a capture and its audit row. W98 adds one list pass on the bulk fixture.
- **Security testing.** The design review (row 20, done); the access-control checkpoint W45 during the build; the final reviews W99 (backend, database, secrets, host) and W100 (clients). Dump and log-capture tests for secrets sit in W24, W28, W32, W41, W42, W48 and W58.
- **Performance testing.** W98, against the Simulated-mode figures on the same host.
- **Bulk data seeding.** Canonical seed: W20 (`apps/core-server/src/db/seed/`; 3 operators, 3 roles, 12 permissions, 18 grants, 13 evidence items, 52 tracks, 82 audit rows, 59 events). Bulk fixture: W25 (`src/db/fixtures/`, the minimums of the database contract §11), test databases only. Owner: database-specialist.
- **Code quality.** Typecheck and lint in every row; the checkpoints W38, W46, W61, W62; the final reviews W91 to W93; the gates W58 and W89.
- **Regression.** The baseline of row 13; the 61 simulator-dependent test files in every client row; W97 for Simulated mode, HEARTBEAT mode and the 0.1.0 packages.
- **Rollback and recovery.**
  - Code of one row: its class (R-NEW, R-CO, R-PRE), only on the controller's instruction. From W104 on, the checkpoint commits are further rollback points.
  - Code of the whole task: path checkout to `acaff20`, only on an explicit request from the user.
  - Host: the verbatim blocks of 02_plan §14.3. The removal of the data and the stop of the server are proven by W90; the package removal is written, not executed (D17).
  - Database: `db:reset` to the seed state.
  - Emulators: the debug APK that W13 backed up.
- **Acceptance criteria.** SC1-SC11 PASS in W101, or CAUTION acknowledged; both security verdicts PASS, or CAUTION acknowledged; zero open blocker findings; the commit of W103 present.

## Risk Assessment

| ID | Risk | Likelihood | Impact | Mitigation | Owner rows |
|---|---|---|---|---|---|
| R1 | An early proof fails | Medium | One fallback row, one extra npm slot, a drift entry | Time boxes and named fallback rows; nothing wide depends on a proof before it passes | W01, W03, W04, W05, W07, W10, W12, W15 |
| R2 | No emulator, or only one, holds the debug build | Medium | Fewer device lanes; a weaker "fresh app" state for SC5 | W06 measures it; DP-1 and DP-3 with defaults; the table of 02_plan §5.5 | W06, W13, W94 |
| R3 | Host overload with three lanes, PostgreSQL, emulators and six agents | Medium | Test timeouts | The load guard of P9; two workers; gates run without client live checks | all |
| R4 | The contract chain delays the backend | Medium | Idle slots in B2 to B4 | Contract A first; W18, W20, W21, W23, W25, W26 need no contract row or only A | W19, W22, W27 |
| R5 | One of the longest rows does not fit one agent context | Medium | A partial return | The controller splits it with a number from W106 to W109 | W07, W08, W17, W23, W24, W28, W42 |
| R6 | The decorator seam of P25 is not enough | Low-Medium | A row needs to edit `app.ts` | `needs-review`; one serial scaffold slot | W24, W28, W32, W42 |
| R7 | An agent writes outside its paths | Low-Medium | A silent collision | P6; the pre-image of P23; the checkpoints W38, W46, W61, W62; the ownership check of W93 | all |
| R8 | The matrix test or a live check runs into the denial budget | Medium | False failures | W47 advances the clock or resets the counter; lanes have their own counters; the 429 rule of P11 | W47, client rows |
| R9 | A checkpoint commit captures half-finished work | Low-Medium | A commit that does not build | W104 and W105 stage only rows marked complete and name what they leave out | W104, W105 |
| R10 | A console opened at `localhost` cannot sign in | Medium | A check reported as a server defect | P14; the README; the console record names the cause | W50, W86 |
| R11 | A secret, the demo password, a pairing code or a credential leaks into git or logs | Low-Medium | A security finding on a product whose headline is security | P19; static guard tests from W08 on; marker scans; W45, W99, W100; the commit checks | W07, W08, W24, W32, W103 |
| R12 | A mobile row needs a string in `apps/mobile/src/i18n/en.mobile.ts`, which only W51 owns | Medium | `needs-review` in W56, W57 or W59 | The controller gives W51 the strings up front or schedules one small slot (row 19, §12 item 6) | W51, W56, W57, W59 |
| R13 | The plan and this file drift apart again after a later patch of either | Low | Two references for one row | Aligned at plan revision 2.1 and blueprint revision 2.1; for output paths this file's name is the reference (02_plan §8.7) | controller |
| R14 | Agent-started emulators run at background priority | Medium | Slow device checks | The user may boot the three emulators from a Terminal with the cold-boot commands; W02 then only verifies | W02 |
| R15 | The Mac sleeps during a long wave; many sandbox-bypass prompts | Medium | Hours lost; a slower run | Keep it awake (KI-26); the user may set `sandbox.network.allowLocalBinding` | all |
| R16 | W90 removes the lane databases, so every lane pairing is gone | Certain | None by then | The client waves are over; W94 to W96 use the reserved emulator; W97 creates lane 3 again | W90, W97 |

- **Assumptions and caveats**: no time estimates are given. Every technology behaviour is still unexecuted until its proof row runs. This agent ran no command; its checks are Grep counts and reading. The design risks stay in the registers of the specifications and of the security review (17 accepted residual risks, D16).

## Recommendation & Next-Plan Summary

### Key Findings Summary

| # | Finding | Confidence | Evidence Source | Implication |
|---|---|---|---|---|
| 1 | The plan's 105 work rows map one to one onto blueprint steps 23-127; no row needed a split | High | 02_plan §8; the table above | The controller can delegate by step or by plan ID |
| 2 | Every criterion is owned: AC-B 93 of 93, AC-C 110 of 110, SR 82 of 82 | High | Grep counts over the specifications; the coverage tables; row 19 §5 | No uncovered requirement enters implementation |
| 3 | The masterplan is consistent: 0 Blocker, 2 Major and 11 Minor text findings | High | `gateway_check/02_masterplan_consistency.md` | Five of them touch this file and are applied (RL-30 to RL-35) |
| 4 | Two live-check rows had dependencies that only the wave order implied | Medium | 02_plan W50, W51, §5.1 | Steps 72 and 73 now depend on the lane databases (51) and the realtime channel (64) |
| 5 | The change against rev 1 is MAJOR by the B.9 criteria | High | Refinement Log | Reported to the user; approval is pre-granted by D1 |
| 6 | Nothing the design relies on has been executed yet | High | 02_plan §1.5, §6 | The seven early proofs come first, each with a fallback |
| 7 | Which build each emulator holds is still unknown | Low | 02_plan GP-03 | W06 decides how many device lanes exist |

### Priority Recommendations

| Priority | Recommendation | Rationale | Risk if Ignored | Target Phase/Task |
|----------|---------------|-----------|-----------------|-------------------|
| P0 | Run row 22 (docs commit) before any work row | It is the SC1 reference and the rollback point of the documents | SC1 cannot be shown | initialization; step 22 |
| P0 | Launch wave E1 (steps 23-27) in one message, then record DP-1 right after step 28 | Five proofs and the npm slot unblock everything else | Idle slots; W12 and W13 blocked | steps 23-28 |
| P0 | Enforce the single-owner slots: npm, Gradle, migration writer, contract owner, port 4420, PostgreSQL exclusive use, git index | They are the collision points of a 6 / 8 run | Lost edits, false failures | P1, P2, P15-P18 |
| P0 | Report the MAJOR class and MJ-10 to MJ-16 to the user | Pre-granted approval does not remove the duty to report | The user is surprised by a host or behaviour change | controller, now |
| P1 | If step 24 ends `blocked`, start step 28 anyway | W06 needs no booted emulator, and W07 waits for W06 | The emulators hold up the whole backend chain | steps 24, 28, 29 |
| P1 | Commit at W104 and W105 without waiting | A session break then costs one phase at most | Lost work, as in the predecessor task | steps 125, 126 |
| P1 | Give W51 the mobile strings that W56, W57 and W59 will need | `en.mobile.ts` has one owner | Three `needs-review` returns | step 73 |
| P2 | Ask the user to boot the three emulators from a Terminal and to keep the Mac awake | Background priority and sleep cost hours | Slow or stalled device checks | step 24; all |
| P2 | Add Maestro flows for sign-in and pairing after the task | KI-02 stays open | Manual device checks only | follow-up |

### Pending Decisions for Human-in-Loop

Approval is pre-granted (D1). These are listed so that the controller can decide under D1, or ask the user where a U item is involved.

| # | Decision Required | Options | Recommended Option | Impact |
|---|-------------------|---------|-------------------|--------|
| 1 | DP-1 outcome after step 28 | Record the list of debug-build emulators / decide option B for one named emulator | Record the list (A, D17); B only if no emulator holds the debug build, and then it is the user's call (the app's local demo state on that emulator is lost) | Number of device lanes |
| 2 | DP-3 before step 116 | A reserved emulator / B uninstall and reinstall / C unpair on the device | A | Strength of the SC5 proof |
| 3 | A failed PostgreSQL trial (Fb) | Homebrew keg `postgresql@18` / stop and ask | The keg, reported to the user with the removal block H-12 (D11) | A host change outside the project |
| 4 | A failed proxy proof (Ff) | Cross-origin transport after a security review / stop and ask | The review first | Changes OR-5, SR-04 and three criteria |
| 5 | Any DEFERRABLE cut (DF-1 to DF-8) | Keep / cut | Keep all (D17) | Each cut loses the criteria named in the list |
| 6 | Strict per-folder rows for the six merged rows | Keep the plan's merges / split with suffixes a, b, c | Keep (Self-checks, atomicity note) | Seven more rows and more lane checks if split |

### Next-Plan Recommendations

- **Immediate next step**: validate this table (V1-V7), record the B.9 class, run row 22, then launch wave E1 (steps 23-27) in one message.
- **Subsequent tasks**: E2 → record DP-1 → E3, E4 → record the DP-2 case → B1 to B8 → the backend gate (step 80) with checkpoint commit 1 (step 125) → C1 to C4 with checkpoint commit 2 (step 126) → F1 to F4 → V1 to V6.
- **Parallelizable work**: the backend chain, the shared client layer and the mobile native slot from E3 on; after step 80, three web and three mobile rows per wave on the three lanes.
- **Cross-task continuity notes**: baseline `acaff20`; the decision log is the single place for D-n, DR-n and F-n; the gap IDs (`CONTRACT-GAP`, `SCHEMA-GAP`, `BE-GAP`, `SIM-GAP`) carry open work between rows; the host state left behind (the npm binaries, `.data/` rebuilt by step 112, three running emulators) is listed in the final report with its removal commands.

## Agent Mapping Rationale

- **coder-execution** (68 rows): every code and host change, one concern per row; three of them are mechanical and run on tier D (W02, W14, W85).
- **database-specialist** (W10, W11, W17, W20, W25, W29): the proof of the migration tool, the test helper, the schema, the mapping with the seed, the fixture and the reset routine are one specialist's chain, which also makes it the single migration writer. The reset routine moved here from a coder-execution row because the lanes need `db:reset` before the demo module exists.
- **test-expert** (W47, W48, W49, W52, W53, W87): acceptance tests written from the specification and the contract, independent of the rows that built the endpoints; the final test report.
- **verifier** (W06, W58, W89, W90, W94 to W98, W101): the environment check, the two gates, the clean-state rebuild, the end-to-end proof, regression, performance and the final criteria matrix; read-only on code.
- **security-review** (W45, W99, W100): the access-control checkpoint during the build and two final reviews.
- **senior-code-reviewer** (W38, W46, W61, W62, W91, W92, W93): checkpoints where a defect would spread to every module, page or screen; final reviews per codebase.
- **data-analyst** (W88, W102): the two consolidations, each a synthesis with an evidence chain.
- **git-specialist** (row 22, W104, W105, W103): four local commits staged by explicit path.
- **task-architect** (row 21): this refinement; design only.
- **Not used**: docker-specialist (U1), explore and data-collector after the research phase, pm-analyst and pm-planner, the document and image agents.

## Refinement Log

Class per the B.9 criteria: new scope or features, different agents, effort change above 30 %, new modules, changed intent, restructured flow, or a contradiction of an approved decision = MAJOR; same scope with more detail = MINOR.

### Part A: what the masterplan changed against rev 1

| ID | Change against rev 1 | Source | Class |
|---|---|---|---|
| RL-01 | The 96 provisional rows 23-118 are replaced by 105 confirmed rows, steps 23-127, one per plan work row | 02_plan §8, §21; D20 | MINOR (count +9.4 %) |
| RL-02 | Two rows added at the start: W01 (the baseline test fix of D10) and W02 (emulator cold boot) | D10, F20; 02_plan §21 | MINOR |
| RL-03 | **The flow is restructured**: seven early proofs come before the wide waves, each with a time box and a fallback row; the typed client moves early (prov. 58 → W12); the environment check moves before provisioning (prov. 24 → W06) | 02_plan §6, §1.7 | **MAJOR** (restructured flow) |
| RL-04 | Four npm slots become three (N1 W03, N3 W13, N2 W14) | D17 | MINOR |
| RL-05 | Splits: 23 → W03, W07; 25 → W03, W08; 27 → W19, W22, W27; 28 → W10, W11, W17; 32 → W09, W23, W24, W41; 37 → W04, W26; 57 → W03, W14; 60 → W18, W31, W44; 62 → W05, W50, W54; 78 → W15, W51; 79 → W15, W56 (rows 25 and 79 as corrected in rev 2.1, RL-36) | 02_plan §21 | MINOR (same scope, more detail) |
| RL-06 | **Row 48 is split across agent types**: the reset routine goes to database-specialist (W29), the demo module stays with coder-execution (W43) | 02_plan §21; D12 | **MAJOR** (a different agent for part of a row) |
| RL-07 | Merges: 43 + 44 → W37; 46 + 47 → W40; 49 → W08; 71 + 72 → W71; 84 + 85 → W66; 88 + 89 + 91 → W72; 94 + 95 → W79 | 02_plan §21; client spec §17.4 | MINOR |
| RL-08 | Row 41 (media and package file endpoint) is SKIPPED; `@fastify/static` is not installed | D13 | MINOR (the row's own condition in rev 1) |
| RL-09 | The end-to-end order becomes SC5, SC3, SC4 (108, 106, 107 → W94, W95, W96) | D17 | MINOR |
| RL-10 | Lanes: three lane backends with their own databases and Vite ports replace the single shared Vite server and the serial ownership of port 4420 for live checks; each emulator is bound to one lane; one emulator stays reserved | ADQ-10; 02_plan §5 | MINOR (rev 1 named lanes as an option in P18) |
| RL-11 | Two checkpoint commits added: W104 after the backend gate, W105 after the web client wave | D17 | MINOR |
| RL-12 | **Security scope added** by the accepted review: three database roles and three credential files, two Origin lists, a denial budget, a serial unit-of-work queue, the request log rule, response headers with `@fastify/helmet`, the lineage table `audit_chain_history` (a 30th table), `TOKEN_REUSE`, a cookie name per instance, the Try-it deny list; 54 rows changed in scope or verification; the criteria SR-68..82, AC-B-72..93, AC-C-102..110 | D16, D18, D19; DR-03 | **MAJOR** (new scope) |
| RL-13 | **New modules** against the provisional layout of rev 1: `scripts/pg` checks, `src/db/{commands,mapping,reset}`, ten plugin folders, `test/static`, `test/helpers/db`, `packages/shared/src/live/{source,testing}`, `apps/core-web/src/routes/_app/admin`; the module `evidence-files` is dropped | 02_plan §2.4 | **MAJOR** (new modules) |
| RL-14 | QR scanning on the device is deferred; no camera module; `apps/mobile/app.json` and `src/app/pair.tsx` are not written | DR-02; D17 | MINOR (rev 1 said "if 02_plan adopts it") |
| RL-15 | Paths that rev 1 left without an owner now have one: `vite.config.ts` (W05), `sim/auth.ts` (W16), `device-session.sh` (W13), `jest.setup.ts` (W15), `use-health.ts` (W51), `i18n/en/common.ts` (W16, W50), new cross-feature tests | F22, F24 | MINOR |
| RL-16 | Protocol: P1, P4, P14 to P19 amended; P9 gains the load guard; P11 gains the 429 rule; P23, P24, P25 are new | 02_plan §4.4, §5.4, §7.2 | MINOR |
| RL-17 | The gate rule: tests per workspace with `--maxWorkers=2`; database tests behind `test:db`; the test ledger | D9, D10; 02_plan §11 | MINOR |
| RL-18 | Model tiers: tier D for W02, W14, W85 and the three git rows; the vocabulary row stays on R | 02_plan §8.1 | MINOR |
| RL-19 | Rows by agent: coder-execution 64 → 68, database-specialist 3 → 6, git-specialist 1 → 3 among the refined rows; verifier 10, senior-code-reviewer 7, test-expert 6, security-review 3, data-analyst 2 | D7, D20 | MINOR (below 30 %) |

### Part B: choices of this revision

| ID | Choice | Reason | Class |
|---|---|---|---|
| RL-20 | Step order: W104 = 125, W105 = 126, W103 = 127; every other row is plan number + 22 | W103 depends on W105, and every dependency must point to a lower step | MINOR |
| RL-21 | The tokens DP-1 and DP-3 are not in Depends On; the rows W12, W13 and W94 say "starts only after ..." | The column holds step numbers only | MINOR |
| RL-22 | Steps 72 (W50) and 73 (W51) gain the dependencies 51 (W29, lane databases) and 64 (W42, realtime channel) | Their verification needs a lane backend that answers `hello` and `heartbeat`; the plan implied it by wave order only. No wave moves | MINOR |
| RL-23 | Step 127 (W103): the search for credential contents reads its patterns from the files | P19: no secret in an argument or in output | MINOR |
| RL-24 | One distinct output document per row, assigned by this revision: implementation logs are `implementation/<plan number>_<slug>.md`; the checkpoint commits are `implementation/97_...` and `98_...`; `99_implementation_report.md` is W88; gate, test, verification and report names are those of rev 1; W02 and W07 are `initialization/05_...` and `04_...`; W06 is `initialization/01_env_check.md` | Consistency finding C-08; the plan's "row to output document" table did not exist when this was written | MINOR |
| RL-25 | Phases: W02, W06 and W07 are initialization; W104 and W105 are implementation; the checkpoints and the two gates are gateway_check; the six test-expert rows are test; W90 to W101 are verification; W102 and W103 are report; everything else is implementation | The eight allowed phases | MINOR |
| RL-26 | Rows 1-22: row 21 depends on 18 and 20, row 22 on 19 and 21; row 19 is marked DONE because it finished while this revision was written | DR-04; the controller's note | MINOR |
| RL-27 | No plan row was split. Six rows span more than one folder by the plan's merges (W37, W40, W66, W71, W72, W79) | Self-checks, atomicity note | — |
| RL-28 | The conditional rows Fb to Fh and the reserved numbers W106 to W109 stay outside the table; a triggered row takes the next free step number | They are not delegation units until triggered | MINOR |
| RL-29 | The load guard is worded so that the lane-3 backends of W97 and W99 are stated exceptions, and W99 starts its server only after W98 has finished measuring | 02_plan §5.4 names W97 among the rows during which no lane backend runs, while W97 itself uses lane 3 | MINOR |

### Part C: patches from the consistency check of row 19

| ID | Finding | Patch in this file | Class |
|---|---|---|---|
| RL-30 | C-02: W71 owns the folder that holds the test file W01 repaired | Step 93: the verification compares `storage-page.test.tsx` with its state after step 23; the rollback is R-PRE for that file; the file is in the multi-writer table; CLG item (a) names the exception | MINOR |
| RL-31 | C-08: 24 read-only rows named no output document in the plan | Every row has one distinct Expected Output (RL-24) | MINOR |
| RL-32 | C-09: the order "W06 probes before W07 binds" was not enforced | Step 29 (W07) depends on step 28 (W06) and keeps its own `lsof` check. Plan revision 2.1 chose the same option (W07 depends on W03 and W06); see RL-39 | MINOR |
| RL-33 | C-12: the specifications cite rev 1 row numbers | The table "Rev 1 provisional row → plan ID → rev 2 step" | MINOR |
| RL-34 | C-13: one name for a shell variable and a shared constant | Rev 2 named no variable. Rev 2.1 names it: `DEMS_CORE_HOST_PORT` (RL-38) | MINOR |
| RL-35 | C-10: W45 and W99 did not say how they treat a `DEVICE_CREDENTIAL_ROTATED` row | Steps 67 and 121 say it | MINOR |

### Part D: revision 2.1 of this file (alignment with plan revision 2.1, after D22)

No row was added, removed or renumbered; no agent, phase, output path or Depends On cell changed. Every entry is MINOR, so the overall class stays as recorded.

| ID | Change | Where in this file | Source | Class |
|---|---|---|---|---|
| RL-36 | Mapping table: provisional row 25 maps to W03 and W08 only (W09 belongs to provisional row 32); provisional row 79 maps to W15 and W56; provisional row 62 lists W54 without brackets, as the plan does | The table "Rev 1 provisional row → plan ID → rev 2 step"; RL-05 | 02_plan §21 and §23.3 item 7 | MINOR |
| RL-37 | "W01's state" has a mechanical meaning: the log of step 23 records `git hash-object` of its two files. Step 93 (W71) compares `storage-page.test.tsx` with that record and does not edit the file; step 106 (W84) gets the same exception for `apps/core-web/src/test/sim-fetch.test.ts`; the gates of steps 111 and 119 use the same record | Steps 23, 93, 106; the gate table (CLG item a); the paragraph "W01's state"; P24; the multi-writer table | 02_plan §8.1, §4.3, W01, W71, W84 | MINOR |
| RL-38 | The shell variable of `apps/mobile/scripts/device-session.sh` is `DEMS_CORE_HOST_PORT`; the shared constant stays `CORE_SERVER_PORT` | Step 35 (task and verification); P3 | 02_plan §3.4; finding C-13 | MINOR |
| RL-39 | Step 29 (W07): Depends On is 25, 28, confirmed equal to the plan (W03, W06); the `lsof` probe of port 4432 is now part of its Verification cell. Step 28 (W06) starts anyway if step 24 (W02) ends `blocked` | Steps 28, 29; wave E2; Dependencies; Priority Recommendations | 02_plan §4.2, W06, W07, §23.3 item 4 | MINOR |
| RL-40 | Output documents compared with 02_plan §8.7: all 105 paths of steps 23-127 equal the plan's table (compared by reading the two lists; ten spot-checked again by name: W01, W02, W07, W38, W47, W58, W71, W88, W99, W103). RL-24 stands; this file's name is the reference | Expected Output column; RL-24 | 02_plan §8.7 | MINOR |
| RL-41 | Step 125 (W104) leaves `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` out and names it, because its later writer W71 has not finished; step 126 (W105) stages it | Steps 125, 126; the multi-writer table | 02_plan §4.3 | MINOR |
| RL-42 | Front matter, revision history, the legend above the table, risk R13 and the Dependencies section now state that this file is aligned with plan revision 2.1 and name the three differences that remain on purpose (RL-22, RL-23, RL-29). Status cells: row 21 is marked DONE (rev 2 accepted by D22); row 18 names plan revision 2.1 | As listed; rows 18 and 21 | The controller's patch request; D22 | MINOR |

### Overall classification: MAJOR

| B.9 criterion | Met? | Evidence |
|---|---|---|
| New scope or features | Yes | RL-12: the security corrections add a table, roles, a plugin dependency, a deny list and 46 numbered criteria and requirements |
| Different agents | Yes, narrowly | RL-06: the reset routine moved from coder-execution to database-specialist |
| Effort change above 30 % | No | 96 → 105 rows (+9.4 %); 54 rows grew in scope, which this agent cannot quantify |
| New modules | Yes | RL-13 |
| Changed intent | No | Goals 1-9 and SC1-SC11 are unchanged |
| Restructured flow | Yes | RL-03: proofs first; a different order of the first twenty rows |
| Contradiction of an approved decision | No unrecorded one | Every departure from D4, D5, D7 and D11 is recorded as DR-01 to DR-04 or ruled in D13 to D20 |

Four of seven criteria are met, so the change is **MAJOR**. Each MAJOR item was already accepted one by one by the controller under D1 (D13, D16, D17, D20); what remains is the report to the user. A MINOR reading would hold only for the row mapping itself (RL-01, RL-05, RL-07), which is the smaller part of the change.

## Self-checks

This agent has no shell. The checks marked "Grep" are pattern counts run with the Grep tool over this file after it was written; the checks marked "read" were done by reading the Grep output or the tables. The controller's V1-V7 script is the mechanical confirmation.

| # | Check | Result | How |
|--:|---|---|---|
| 1 | Row count | **PASS**: 127 rows = 22 FIRM + 105 CONFIRMED (W01-W105) | Grep: 127 lines start with a step cell followed by a bracketed tag |
| 2 | Exactly 7 cells in every row | **PASS**: 127 of 127 | Grep: the same 127 lines hold exactly six further cell separators after the tag and end with one, so seven cells; no cell holds a pipe character |
| 3 | Steps consecutive | **PASS**: 1 to 127, no gap, no duplicate | Grep list of the step and tag of every row, read in order |
| 4 | Every refined row starts with its plan ID | **PASS**: steps 23-124 carry W01-W102 in order; 125 = W104, 126 = W105, 127 = W103 | Same Grep list |
| 5 | Agents valid | **PASS**: coder-execution 68, verifier 12, senior-code-reviewer 7, data-collector 7, database-specialist 7, test-expert 6, data-analyst 6, explore 5, security-review 4, git-specialist 4, task-architect 1 = 127; docker-specialist absent | Grep counts per agent cell (68, 29 for the four verification-phase agents, 30 for the other six) |
| 6 | Phases valid | **PASS**: research 13, masterplan 5, initialization 5, implementation 75, gateway_check 9, test 6, verification 12, report 2 = 127 | Grep: 127 lines match the full row pattern with the eight phase names; implementation counted separately (75) |
| 7 | One output per row, all distinct, under the task folder | **PASS**: 127 paths, no duplicate; the folder of each path is its phase folder, except row 21 (`identification/` in phase masterplan, as in rev 1) | Grep list of the 127 output paths, read |
| 8 | Every dependency exists and points to a lower step | **PASS**: 127 Depends On cells; rows 1-13 hold "—"; every number in rows 14-127 is lower than its step | Grep list of the Depends On cells, read row by row. The graph is therefore acyclic |
| 9 | Depends On holds step numbers only | **PASS**: 127 of 127 cells are "—" or a list of integers; DP-1 and DP-3 are in the row text | Grep (the full row pattern) |
| 10 | AC and SR coverage | **PASS**: AC-B 93 of 93, AC-C 110 of 110, SR 82 of 82 | Grep counts of the definition rows in the specifications (93, 110, 82, contiguous); the IDs of each row copied from its plan row; each ID walked by hand; row 19 §5 recomputed it by script |
| 11 | Every implementation row cites its plan row and its AC or SR IDs | **PASS**, with this note: twelve rows cite no AC or SR because their plan rows have none (W02, W06, W10, W38, W85, W88, W98, W101, W102, W103, W104, W105; they cite P3, D9, D12, D17, I1, I8 or SC instead). Two module rows (W36, W37) and eight client rows (W65, W68, W70, W71, W72, W73, W79, W80) carry their criteria through MODG or CLG and say so | Read |
| 12 | D6 limits per wave | **PASS**: no wave above 6 of one type (peak coder-execution ×6) or 8 in flight (peak 7) | The wave table; the counts are the plan's, confirmed by row 19 §6.4; the dependency changes of this revision move no row to another wave |
| 13 | Tier D only where the plan says so | **PASS**: W02, W14, W85, W103, W104, W105; no verification-phase agent on tier D | The tier table |
| 14 | No execution instruction above the table | **PASS**: the context region holds findings, status and scope; the delegable rows, the protocol and the wave rules are in the execution region | Read |
| 15 | Rev 2.1: the table is still valid after the patch | **PASS**: 127 rows, steps 1 to 127, exactly 7 cells each, the same agents, phases, output paths and Depends On cells as in rev 2 | Grep, repeated after the patch: 127 lines match the full row pattern; the lists of step tags, output paths and Depends On cells read again |
| 16 | Rev 2.1: output paths equal 02_plan §8.7 | **PASS**: 105 of 105 equal | Read: the Grep list of this file's output paths against the plan's table, row by row; ten checked again by name (RL-40) |
| 17 | Rev 2.1: step 29 depends on 25 and 28 | **PASS**: equal to the plan's W07 (W03, W06) | Grep list of the Depends On cells |

**Atomicity: PASS, with one stated exception.** Every row has one owner, one output document and one Verification cell, and its write paths are disjoint from those of every row it can run beside. Six rows span more than one folder: W37 (storage with network-time), W40 (system with alerts), W66 (Home with More), W71 (Storage with Network & Time), W72 (Finalization, Summary, Sessions hub), W79 (Storage with Network & Time). This agent's own rule is one module per row. The merges are kept because: in W71, W72 and W79 the extra folders change no production file (client spec §17.4, point 3 for row 21); W66 is one display rule shown in two folders; W37 and W40 hold five and seven operations under one gate that already verifies each folder separately (MODG); the plan with these merges was accepted twice (D17, D20) and its collision scan and wave limits were checked by script on that shape. If the controller prefers strict per-folder rows, each of the six splits into rows with the suffixes a, b (and c for W72), the same Depends On and disjoint folders; that adds seven coder-execution rows and pushes B5, B6 and C1 above six coder-execution rows, so the extra rows would start as slots free. This is pending decision 6.

**What these checks do not show.** That each Verification cell proves every criterion its row cites (row 19 read 36 of the 105 plan cells in full); that the plan's revision 2.1 agrees with this file outside the sections read for the patch (its revision history, §3.4, §4.2, §4.3, §8.1, §8.7, §21, §23.3 and eight rows; the plan itself states that no W-number, wave, agent or write path changed); that an agent stays inside its paths (P6, P23 and the review checkpoints do that during the run).

---
*Generated: 2026-10-04 (rev 1; clock time not available to this agent)*
*Last Updated: 2026-10-04 (rev 2 written after plan revision 2 of 05:30 and the consistency report of 05:52 WIB; rev 2.1 written after plan revision 2.1 of 06:12 WIB; clock time not available to this agent)*
