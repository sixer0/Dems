---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-09-30
agent: task-architect
revision: 3  # rev 1 = first blueprint (2026-09-30, approved as D1); rev 2 = row 6 refinement (web lane, accepted as D36); rev 3 = step 55 mobile merge (2026-10-01)
tiering: default  # 01_translated.md carries no `tiering` field; inherited from its `model_tier: default` (CLAUDE.md §10: no local tier in this port)
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/01_translated.md
source_original_task: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/01_original.md
refined_against:
  - research/03_analysis.md
  - research/04_ui_design_analysis.md (§2, §3, §5, §10)
  - masterplan/01_specs.md (rev 3: §9, §13, §14, AC-01..AC-75)
  - masterplan/02_plan.md (§1, §3, §4, §4.1, §5, §6)
  - masterplan/03_motion_spec.md (§0, §1, §4, §11, §12)
  - masterplan/04_mobile_specs.md (§1, §3, §5, §8, §9, §10.1, §11 MA-01..MA-30, §13 SCR-01..SCR-07, §14)
  - masterplan/05_mobile_plan.md (§3 M-01..M-22, §4 waves, §5 resource guards, §6 row steps, §14 gate)
  - decisions/decisions.md (D1-D36 on disk; D37 = Q-M7 yes and D38 = combined gate approved, both from the controller)
  - status_tasks.md
scale_category: new_project  # greenfield demo: stack setup, Core web build and mobile build (D15-D37)
professional_document: false  # D2: Output format A (markdown only)
b9_classification: MAJOR  # D22 (web scope), D32 (flow), D33/D34 (mobile build in this task, parallel lanes)
status: approved_d38  # combined gate (D22 + D33) approved with every recommendation; steps are delegable as their Depends On clear
---

# Structured Tasks: DEMS Demo Stack Setup, Core Web Build and Mobile Build

## Source Translation

- **Translated task**: `identification/01_translated.md`. **Original**: `identification/01_original.md` (Indonesian, verbatim).
- **Intent as approved (D1)**: set up the development stack for a premium-looking, fully animated **demo** of the DEMS Edge Client. It has two parts: a React **Core** web app for the Core Machine (design book §6) and a React Native Android app for the operator tablet (§5).
- **Intent as extended (D15–D37)**:
  - **Core web app built** (D15–D28): 10 pages plus the Start New Session flow, from `ui_design/`, with the motion spec, on an in-browser simulator in `packages/shared`.
  - **Mobile app built in parallel in this same task** (D33, D34; supersedes D20). The source is `masterplan/04_mobile_specs.md` and `masterplan/05_mobile_plan.md`:
    - the 10 designer screens on phone portrait;
    - tablet multi-pane layouts;
    - derived screens;
    - the same shared simulator;
    - acceptance MA-01..MA-30.
  - **Task-scoped concurrency (D34)**: at most 6 agents of one type and 8 in flight, guarded by D35 and the Parallel Execution Protocol below.
  - **Shared-contract requests** SCR-01..SCR-07 are folded into the shared web steps (Q-M7 = yes, D37).
  - **Combined gate approved (D38)**, with every recommendation accepted:
    - Q-M1: yes. Q-M2: yes (Maestro via the pinned zip). Q-M3: yes.
    - Q-M4: separate simulators accepted.
    - Q-M5: the label is "End Session" on web and mobile.
    - Q-M6: accepted. Q-M8: yes.
    - The D28 web defaults are accepted.
- **Goals**: G1–G7. Acceptance: SC1–SC7 (AC-01..AC-47); web AC-48..AC-75 and MS-01..MS-10; mobile MA-01..MA-30.
- **Constraints**:
  - C1–C7 and I1–I7.
  - D6: ready-made frameworks only.
  - D19: one simulator, shared.
  - D24: emulators run outside the sandbox.
  - D35: resource guards.
  - I2: the design book stays on the machine.
  - I6: no publishing, pushing or cloud.

## Prior Task Continuity

Not applicable. There is no prior task. Memory screen (STEP 0, 2026-09-30): `/Users/gsp-budi/Documents/DEMS/docs/` holds only this task, and no DEMS memory exists.

---

## Architecture Challenge & Refinement

### State on 2026-10-01 (rev 3)

| Area | State | Evidence |
|---|---|---|
| Research and spec | Rows 1–5 done. Delivered outside the table: `research/04_ui_design_analysis.md`, `masterplan/03_motion_spec.md`, `masterplan/04_mobile_specs.md` (1,123 lines), `masterplan/05_mobile_plan.md` (392 lines) | Glob of `masterplan/`; `05_mobile_plan.md` frontmatter "complete (pending the Mobile Approval Gate)" |
| Host toolchain | Rows 8–10 done early (D21). Row 11 dropped (D12). Row 13: 25/25 PASS (D29) | `02_plan.md` §1 |
| Stack scaffold | Rows 12 and 14–16 done under D27. Rows 17–18 in progress (D30, D31 relayed) | `02_plan.md` §1; `05_mobile_plan.md` §1 (row 18 still in progress at 01:15 WIB) |
| Decisions | D32 Option C; D33 mobile spec and plan; D34 parallel lanes; D35 guards; D36 rev 2 accepted pending this merge; Q-M7 = yes (D37 per brief); **combined gate approved with every recommendation (D38 per controller)** | `decisions/decisions.md` (D1–D36 on disk); controller messages for D37 and D38 |

**Facts that shaped rev 2 and still hold** (read-only, 2026-10-01):

- **`@dems/shared` is consumed from source.** Its exports map to `./src/*.ts` (`packages/shared/package.json` lines 6–16). `./sim` is exported but empty. There is no `./i18n` export yet.
- **The root barrel reaches mock-core and mobile.** `packages/shared/src/index.ts` lines 6–8 re-export `./domain`, `./api` and `./tokens`.
- **AC-68 is already half-passing.** The template `apps/core-web/public/favicon.svg` exists.
- **AC-69 has no test file.** There is no `contrast.test.ts`.
- **E13 holds.** There is no root `README.md`.
- **`image-specialist` does no code work** (agent file line 12).
- **Only port 5173 can sign in.** mock-core CORS accepts only the 5173 origin (AC-37), and Login needs the Core link (01_specs §14.8).
- **`flock` is absent.** `/usr/bin/lockf` is present and was tested on this host: it exits 75 when the lock is taken (04_mobile_specs VM-18).
- **01_specs AC-01, AC-04 and AC-11 predate D29.**

**New facts from the mobile inputs:**

- **The mobile lane never writes `packages/shared/**`** (05 §3 rule 1). The seven shared-contract requests (04 §13) therefore land in the web steps that own those files.
- **Mobile i18n lives in `apps/mobile`, not in `packages/shared`.** The mobile namespace is `apps/mobile/src/i18n/en.mobile.ts`; shared page copy comes from the web namespaces (04 §9).
- **05 §5 makes the device protocol concrete** and supersedes rev 2's `shlock` and serial-discovery rule:
  - fixed AVD boot ports (phone 5554, tablet 5556);
  - lockf-wrapped device sessions;
  - one Metro port per lane, with the device side kept on 8081.
- **05's output names would collide with this blueprint.** 05 names `test/03_…` and `verification/07_…` to `09_…`, but `verification/07_visual_checkpoint.md` already exists in this blueprint. The blueprint keeps its own names; the mapping is in the Refinement Log.
- **Some 05 rows bundle independent screens:**
  - M-02: foundation plus motion kit.
  - M-07: Login plus Pairing.
  - M-11: four screens.
  - M-14: two screens.
  - M-15: three screens.

  They are split by feature folder for V4.

### Sequencing: Option C (D32) with the rev-2 patches

| Criterion | Option A (02_plan §5) | Option B (02_plan §5) | Option C (D32, adopted) |
|---|---|---|---|
| Runs of tests, run guide, verification, security review and code review | Twice | Once | Once, with web and mobile halves side by side |
| Rollback point before the builds | Yes | None | Yes: step 25 |
| When baseline defects surface | Early | Late | Row 19 and step 26 early; the rest at the end |

The three rev-2 patches stand:
1. Step 26 is a read-only invariant gate.
2. Fallback DAGs cover a declined gate. Since D38 approved both lanes, they are kept for history only.
3. Step 25 runs right after the gate answer. The answer is in (D38).

**One combined final commit (step 66), not per-lane commits.**
- The only tree that is ever verified as a whole is the combined one: step 61 runs the root typecheck, lint and tests over both apps and `packages/shared`.
- A web-only commit made while the mobile lane can still change `packages/shared/src/sim` (step 91) would record a state nobody verified.
- Per-lane rollback stays possible without per-lane commits, because the lanes own disjoint paths: `git checkout <step-25 commit> -- apps/mobile`.

### Critical-path design for two lanes

- **Shared prerequisites.** Steps 27–35 (W-01..W-05, now carrying SCR-01..SCR-07) are the critical path for both lanes.
- **What starts right after the baseline commit:**
  - Step 27 holds the single npm slot, and step 67 (M-01) takes it next.
  - Step 30 (motion tokens) runs beside step 27.
  - Mobile steps 68 (foundation) and 71 (compositions) need neither the simulator nor new packages.
- **The simulator is split** into a contract (31) and an engine (32):
  - The web shell (38), the web compositions (39) and the mobile foundation can start before the engine is done.
  - Mobile runtime wiring (73) waits for the engine.
- **Checkpoints.** CP-1 (40) and CP-2 (45) gate the web page fan-out; CP-M1 (74) gates the mobile screen fan-out. Each runs in parallel with the first page or screen wave of its lane.
- **Peak.** In wave W5, 3 web coders, 3 mobile coders, CP-2 and CP-M1 run at once: **8 in flight**, the D34 limit.

### Hypotheses from the first blueprint (H1–H8): status

| H | Status | Evidence |
|---|---|---|
| H1: one React across web and mobile | Rule set (SD-04, root overrides). Proof due at steps 26, 64 and 59 (MA-01) | 03_analysis SD-04 |
| H2: one token source | Confirmed by design (D10, D16) | 01_specs §2.7–§2.9 |
| H3: emulator loopback | Resolved: `adb reverse` (SD-43); device side on 8081 with a per-lane host port (H-MB-09, proven in step 67) | 01_specs §6.2; 04 §14 |
| H4: cleartext `ws://` in debug | AC-26 | 01_specs AC-26 |
| H5: iCloud | Closed (D29) | `initialization/01_env_check.md` |
| H6: git identity | Open until step 25 (R11) | none yet |
| H7: bottles | Closed | D12 |
| H8: no admin prompts | Confirmed | `02_plan.md` §0 |

### Challenge table (updated)

| Dimension | Challenge | Resolution (rev 3) |
|---|---|---|
| Intent | What proves the work is done? | SC1–SC7, AC-48..AC-75 and MS-01..MS-10, MA-01..MA-30 |
| Scale category | Setup plus two builds | Greenfield posture. Both builds are deltas on the step-25 baseline |
| Source | 8 of the 10 web pages and 10 mobile screens have no mockup | Web derived per 04 §5 and D28; mobile derived per 04_mobile_specs §1.4 |
| Impact | Two lanes on one 10-core / 24 GB Mac | Parallel Execution Protocol P1–P12 |
| Scope | Do web and mobile share one live session (G-M15)? | No. Each app runs its own simulator (Q-M4, accepted in D38). A shared session would need a mock-core relay (MAJOR, out of scope) |
| Constraints | D6 on both lanes | Web: only the five §14.6 compositions are custom (step 64). Mobile: only C-1..C-6 (MA-23, step 65) |
| Assumptions | H-S17, H-S18, H-S19, H-M1, H-MB-01..H-MB-11 | Each has a fallback. Owner steps are named in the risk table |

### Blueprint shape

- **Numbering.** Rows 1–66 keep their numbers. The mobile build is appended as steps 67–91.
- **05 rows folded into existing steps.** M-16, M-18, M-19, M-20, M-21 and M-22 map onto 57, 59, 63, 65, 60 and 66.
- **Size.** 91 steps. 67 remain to be delegated (19, 25, 26, 27–54, 56–91); steps 54, 90 and 91 are conditional.

### Scale Category Design Matrix

| Dimension | Finding | Evidence Source | Design Consequence |
|---|---|---|---|
| **Scale Category** | New Project: stack setup, Core web build, mobile build | D15, D18, D25, D26, D33, D34 | Both lanes broken down; one combined gate |
| **Source** | Digest, collection, UI analysis, motion spec, mobile spec | `research/01`, `02`, `04`; `masterplan/03`, `04` | Every step cites its spec section |
| **Spec** | 01_specs rev 3; 02_plan; 03_motion_spec; 04_mobile_specs; 05_mobile_plan | `masterplan/` | W-steps from 02_plan §4; M-steps from 05 §3, split for atomicity |
| **Impact** | Host changes finished (rows 8–10). One optional host change (Maestro, step 90). Shared CPU, RAM, ports, emulators and lockfile across up to 8 agents | 02_plan §3; 05 §5; D35 | Protocol P1–P12; security halves 62 and 63 |

### Source → Spec → Impact research: status

| Research Layer | Owner | Artifact | Status |
|---|---|---|---|
| Source | document-reader, data-collector, image-analyst | `research/01`, `02`, `04` | Done |
| Spec | data-analyst; task-architect (rows 6, 55) | `research/03`; `masterplan/01`–`05`; this file | Done |
| Impact | data-analyst; verifier (13, 26, 45, 58, 59, 61); security-review (62, 63); senior-code-reviewer (40, 64, 65, 74) | `research/03`; `verification/*` | Register done; checks pending |

### Workspace layout (as built, plus build additions)

```
/Users/gsp-budi/Documents/DEMS/
├── package.json · package-lock.json · .npmrc · .node-version · tsconfig.base.json   (row 14; lockfile writers 27, 67)
├── .locks/                          npm, gradle, dems_phone, dems_tablet, mock-core locks (git-ignored by step 25)
├── THIRD_PARTY_NOTICES.md           (row 17; appended by steps 29 and 37)
├── README.md                        (step 60; absent on 2026-10-01)
├── apps/
│   ├── core-web/                    10-page console (steps 28–54)
│   ├── mobile/                      screens (steps 67–91): src/{app,navigation,layout,motion,providers,runtime,auth,i18n,components,features/<folder>}/, assets/images/{brand,hero}/, scripts/device-session.sh
│   └── mock-core/                   health + 1 Hz WS heartbeat (D4); shared by both lanes (P5)
├── packages/shared/
│   ├── src/sim/                     contract (31) + engine (32) + gap closures (54, 91); W-02 owner only
│   ├── src/brand/{emblem,topo}.ts   (35; SCR-03, SCR-06)
│   ├── src/i18n/en/                 web namespaces (34; SCR-05)
│   ├── src/api/{openapi,session-schema}.ts · openapi/openapi.json   (33)
│   ├── assets/brand/*.png           (28; SCR-03)   assets/hero/room-{2560,1600}.jpg   (29; SCR-04)
│   └── scripts/ · theme/ · test/
└── docs/ · graft/ · ui_design/ · design-book .docx   (existing; read-only except this task's docs/)
```

### Scope Refinement

- **In scope**
  - The stack.
  - The Core web build.
  - The mobile build (04_mobile_specs §1: 10 mockup screens plus 10 derived screens, phone and tablet).
  - The seven shared-contract additions.
  - Maestro end-to-end tests through the pinned zip (Q-M2 approved, D38).
  - One combined end-of-build pass.
  - Two local commits.
- **Out of scope**
  - Any mock-core change, including a shared live session between the apps (G-M15).
  - An `id` locale (A10).
  - iOS and deployment.
  - Any remote or push.
  - EAS, Android Studio, and TLS.
  - Video files.
  - A physical-tablet test (recommended separately).
- **Boundary conditions**
  - Build steps write only inside the workspace. Step 90 (Maestro, `~/.maestro`) is the only exception.
  - Mobile steps never write `packages/shared/**`, `apps/core-web/**`, `apps/mock-core/**`, the root `package.json`, `README.md` or `THIRD_PARTY_NOTICES.md`.
  - Page and screen steps write only their own feature folder, i18n file and tests.
- **Edge cases**
  - E1–E17 as in rev 2.
  - E18: two emulators need explicit serials. Resolved by the fixed boot ports.
  - E19: `flock` is absent. Use `lockf`.
  - E20: progress files collide between same-type agents. Resolved by P8.
  - **E21**: biometric enrolment may fail on `pixel_tablet` (H-MB-04). Hide the button on that AVD.
  - **E22**: MA-10 and AC-42 stop mock-core while another lane may be using it. Resolved by P5.

### Constraint Enhancement

- **Functional**
  - FR1–FR8 as in rev 2.
  - **FR9**: mobile screens per 04_mobile_specs §1 and §4 on both AVDs, orientation unlocked.
  - **FR10**: the mobile app reuses `@dems/shared/sim`, i18n, tokens and brand without forking them (MA-28).
  - **FR11**: biometric sign-in, simulated operator plus the emulator fingerprint (§6.3, Q-M3).
- **Non-functional**
  - NFR1–NFR9 as in rev 2.
  - **NFR10**: mobile motion on the UI thread; meters render zero React commits per frame (MA-16).
  - **NFR11**: mobile traffic to loopback only (MA-25).

### Initial Project Protocol Tailoring

| Template element | Applied as | Rationale |
|---|---|---|
| Phase 0 research | Done (rows 1–5, research/04, masterplan/03–05) | none needed |
| Phase 0b environment | Rows 7–13 done. Step 67 prepares the mobile native side | none needed |
| Per-phase checkpoint | Unit tests plus a device smoke in every build step; web CP-1 (40) and CP-2 (45); mobile CP-M1 (74); full pass 56–65 | Checkpoints sit where a defect would spread to every page or screen |
| Database checklist | N/A | The simulator is in memory with persistence |
| Bulk data seeding | Canonical dataset (01_specs §14.7); fixtures where volume matters (AC-64) | Demo |
| Phase 3b | N/A (D2) | none needed |

### Scope & Delegation Refresh (B.9 input)

- **MAJOR in rev 3**: the mobile build rows 67–91 and the mobile halves 57, 59, 63 and 65. This is new build scope (D33, D34).
- **MINOR in rev 3**:
  - SCR folding;
  - row splits;
  - protocol mechanics;
  - log names;
  - the combined commit;
  - the gate merge.
- Full list: Refinement Log, RL-40 onward.

### Professional Document Flag

Not set (D2).

---

## Structured Task Breakdown

> **PRIMARY OUTPUT: controller-executable table.** Each row is one delegation unit.
> - Expected Output paths are relative to `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/` unless absolute. Code paths are relative to `/Users/gsp-budi/Documents/DEMS/`.
> - **Status tags**:
>   - DONE, IN PROGRESS: history.
>   - DROPPED, MERGED: never delegated.
>   - PENDING: pre-approved by D1 or D27.
>   - **WEB, APPROVED D38**: web lane.
>   - **MOBILE, APPROVED D38**: mobile lane.
>   - The combined gate (D22 + D33) was approved as D38. Delegate each step as soon as its Depends On is satisfied.
> - Paste the **Parallel Execution Protocol** into every delegation of steps 25–91.

| Step | Task Description | Agent_to_Invoke | Expected Output | Depends On | Verification | Phase |
|------|------------------|-----------------|-----------------|------------|--------------|-------|
| 1 | [DONE] Produce the local-only digest of the design book (§5, §6, §11, §12, §19, §21.2, §21.3 and every section defining roles, status enumerations, timing or UI states), ending with "Stack capability needs"; no web tools | document-reader | research/01_explore.md (Tier 2) | — | PASS (status_tasks.md, B/W1): §-cited digest present; zero web tool calls | research |
| 2 | [DONE] Collect current technology evidence for each stack decision area using generic queries only | data-collector | research/02_collection.md (Tier 2) | — | PASS (status_tasks.md, B/W1): URL-cited options per area; query log free of design-book text | research |
| 3 | [DONE] Analyse rows 1 and 2 into the stack decision record SD-01..SD-54 with the Host Impact Register and its rollbacks | data-analyst | research/03_analysis.md (Tier 1) | 1, 2 | PASS: accepted as D10–D14 | research |
| 4 | [DONE, rev 3] Write the stack specification, including the §13 scope resolution, the §14 web application and AC-01..AC-75 | data-analyst | masterplan/01_specs.md (Tier 1) | 3 | PASS: rev 3 accepted as D31; SC1–SC7 coverage in §9; web ACs in §14.14 | masterplan |
| 5 | [DONE] Write the pinned implementation plan with a verbatim rollback per host step, the proposed web rows W-01..W-24 and the sequencing options | data-analyst | masterplan/02_plan.md (Tier 1) | 4 | PASS: accepted as D31; every host-modifying row has a rollback (§3); W-rows in §4 | masterplan |
| 6 | [DONE: rev 2, accepted as D36] Refine this blueprint against research/03 and 04, masterplan/01 rev 3, 02 and 03, and D1–D35; fold in the web lane and the two-lane wave skeleton; report the B.9 class | task-architect | identification/02_structured.md (refined; Tier 2) | 5 | PASS: controller V1–V7 re-check (D36); Refinement Log RL-01..RL-39 | masterplan |
| 7 | [DONE, D7] Initialise the local git repository with the row-7 rules appended to the root .gitignore; no remote, no commit | git-specialist | initialization/02_git_init.md (Tier 3) | — | PASS: inside a work tree; no remote; .docx and graft/ ignored | initialization |
| 8 | [DONE, early per D21] Install JDK 17 through Homebrew openjdk@17 (17.0.20.1, no sudo), backing up ~/.zprofile before appending marked block A (D11) | coder-execution | initialization/03_jdk_install.md (Tier 3) | 3 | PASS: AC-01, AC-02; backup ~/.zprofile.bak.dems-2026-09-30-235451; rollback in 02_plan §3 Row 8 | initialization |
| 9 | [DONE, early per D21] Install the Android SDK: cmdline-tools 23.0 plus the 7 pinned package IDs, including NDK 27.1.12297006 and CMake 3.22.1 (D13), through android --no-metrics (D23, D29), with marked block B in ~/.zprofile | coder-execution | initialization/04_android_sdk_install.md (Tier 3) | 8 | PASS: AC-03..AC-05; 8.4 GB on disk; rollback in 02_plan §3 Row 9 | initialization |
| 10 | [DONE, early per D21] Create the AVDs dems_tablet (pixel_tablet, 2560x1600) and dems_phone (pixel_10, 1080x2424) with orientation unlocked (D17, D23), each proven by a cold boot | coder-execution | initialization/05_avds.md (Tier 3) | 9 | PASS: AC-06..AC-08; cold boots of 25 s and 22 s; delete commands recorded | initialization |
| 11 | [DROPPED, D12; not delegated] Install watchman (not required for Expo SDK 57) | coder-execution | No output (row dropped) | 9 | Not applicable: dropped by D12; AC-10 asserts watchman is absent | initialization |
| 12 | [DONE, D27] Check the JS runtime: keep system Node 26.8.2 and npm 11.19.1 and write .node-version; no version manager, no pnpm (D12) | coder-execution | initialization/07_js_runtime.md (Tier 3) | 9 | PASS: AC-09 values; system Node untouched | initialization |
| 13 | [DONE] Run the consolidated environment readiness check in a fresh login shell, including iCloud and Graft state | verifier | initialization/01_env_check.md (Tier 3) | 7, 10, 12 | PASS: 25/25 checks; ~/Documents not iCloud-synced (R6 closed, D29) | initialization |
| 14 | [DONE, D27] Scaffold the npm-workspaces root per 01_specs §1.2 (package.json with React overrides, .npmrc, tsconfig.base.json, root scripts including emulator and emulator:phone) | coder-execution | implementation/01_workspace_root.md (Tier 3) | 13 | PASS per log: root install exit 0; only new root files | implementation |
| 15 | [DONE, D27; rev-3 token follow-up relayed per D31] Scaffold packages/shared per 01_specs §2: §21.3 entity stubs, health and heartbeat types, heartbeat client, token source, theme generator | coder-execution | implementation/02_shared_package.md (Tier 3) | 14 | PASS per log: typecheck exit 0; 14 tests pass; step 30 confirms the rev-3 values | implementation |
| 16 | [DONE, D27] Scaffold apps/mock-core per 01_specs §3: Fastify on 127.0.0.1:4400, GET /api/v1/health, 1 Hz WebSocket heartbeat on /ws, CORS allowlist; no simulator (D4, D19) | coder-execution | implementation/03_mock_core_service.md (Tier 3) | 15 | PASS per log: M-1..M-3 (6 tests) pass | implementation |
| 17 | [IN PROGRESS, D27; D31 tokens in the same run] Scaffold the apps/core-web proof per 02_plan §3 Row 17 (Vite 8, React 19.2.3, HeroUI v3, Motion, TanStack Router and Query, BorderBeam, SlidingNumber, the three fonts) with one animated placeholder route and a heartbeat indicator | coder-execution | implementation/04_core_web_app.md (Tier 3) | 16 | AC-19..AC-24 PASS with quoted output; screenshots A, B and C linked | implementation |
| 18 | [IN PROGRESS, D27; scope widened by D30] Scaffold apps/mobile per 02_plan §3 Row 18 with the complete 01_specs §1.4 mobile dependency set plus zustand 5.0.15, expo-local-authentication and the listed i18n libraries (D30), a responsive proof screen, and a local debug build launched on dems_tablet and then dems_phone | coder-execution | implementation/05_mobile_app.md (Tier 3) | 10, 17 | AC-16 and AC-25..AC-34 PASS on both AVDs; Gradle duration recorded; no eas.json | implementation |
| 19 | [PENDING, pre-approved D1; runs as soon as rows 17 and 18 are done] (02_plan §3 Row 19) Run the integration smoke with mock-core, core-web in the browser and the mobile app on dems_tablet together, recording the Metro bind address and stopping every started process by PID | coder-execution | implementation/06_integration_smoke.md (Tier 3) | 16, 17, 18 | AC-40 and AC-41 PASS with quoted output; AC-45 bind address recorded; adb reverse --remove-all run; every started PID stopped | implementation |
| 20 | [MERGED into steps 56 and 57; not delegated] Add proportional smoke tests behind the root test command | test-expert | No output here (steps 56 and 57 write the test reports) | 19 | Covered by steps 56, 57 and 61 (AC-43) | test |
| 21 | [MERGED into step 60; not delegated] Write the workspace run guide README.md | coder-execution | No output here (step 60 writes README.md) | 20 | Covered by step 60 (AC-44) | implementation |
| 22 | [MERGED into step 61; not delegated] Verify the stack end to end from a fresh login shell | verifier | No output here (step 61 writes verification/01_verification.md) | 21 | Covered by step 61 (AC-01..AC-47, SC1–SC7) | verification |
| 23 | [MERGED into steps 62 and 63; not delegated] Security review of the scaffold and the host changes | security-review | No output here (steps 62 and 63 write the security reports) | 22 | Covered by steps 62 and 63 | verification |
| 24 | [MERGED into steps 64 and 65; not delegated] Senior code review of apps/, packages/shared and the root config | senior-code-reviewer | No output here (steps 64 and 65 write the review reports) | 22 | Covered by steps 64 and 65 | verification |
| 25 | [PENDING, re-scoped by D32; gate answered (D38), so it runs as soon as steps 19 and 26 are done] (02_plan §3 Row 25) Create the local baseline commit of the scaffold (rows 14–19) as the rollback point for both builds: append .locks/ to .gitignore (D35); track docs/ locally per the D5 default (settles D8); use the existing git identity or return needs-review; no remote, no push | git-specialist | implementation/07_git_baseline_commit.md (Tier 3) | 19, 26 | `git log --oneline` shows the commit; `git status --porcelain` is empty; `git remote -v` is empty; `git check-ignore -q .locks/x` exits 0; `git ls-files` lists no .docx, node_modules, .cache, apps/mobile/android, graft/, .env or keystore path | implementation |
| 26 | [PENDING, NEW, stack scope pre-approved D1; runs beside step 19] (02_plan §5 Option C patch; ACs from 01_specs §9) Run the pre-baseline gate on the monorepo invariants both builds inherit, read-only and starting no servers: AC-12, AC-13, AC-14, AC-15, AC-17, AC-46, and AC-18 in pre-commit form (the S-1 no-drift test) | verifier | verification/05_pre_baseline_gate.md (Tier 3) | 17, 18 | Each of the 7 checks PASS with quoted command output; each FAIL routed to row 14, 15, 17 or 18 with the expected correction | verification |
| 27 | [WEB, APPROVED D38; npm slot 1 of 2] (02_plan §4 W-01, part a; SCR-05 export) Update the package manifests under .locks/npm.lock: install the 01_specs §14.1 pins exactly (shared: zustand 5.0.15, @noble/hashes 2.4.0, dev @scalar/openapi-parser 0.29.9; core-web: zustand 5.0.15, @scalar/api-reference-react 0.9.76, i18next 26.4.2, react-i18next 17.0.15); add the shared exports ./i18n, ./brand, ./assets/* and ./theme/scalar.css; add the shared scripts openapi:gen and gen:topo. Only this step and step 67 edit a package.json or package-lock.json | coder-execution | implementation/08_web_dependencies.md (Tier 3) | 25 | `npm ls --workspaces --depth=0` shows every pin exactly; AC-13 still prints only react@19.2.3 and react-dom@19.2.3; `npm ls @scarf/scarf` finds nothing; the four export keys are present in packages/shared/package.json; `git diff --name-only` lists only package.json files and package-lock.json; root `npm run typecheck` exits 0 | implementation |
| 28 | [WEB, APPROVED D38; SCR-03 image part] (02_plan §4 W-04, part a) Hand-author the brand emblem per 01_specs §14.10 at apps/core-web/src/assets/brand/emblem.svg (double-stroke shield, six fingerprint arcs, path ids emblem-shield and emblem-arc-1..6, vertical gradient #FFE2A6 to #FFC86B to #C9802F); derive the SVG favicon from it to replace the template apps/core-web/public/favicon.svg; export three 1024 px PNGs to packages/shared/assets/brand/ (icon-foreground-1024.png on transparent, icon-monochrome-1024.png, splash-1024.png), rendered locally (macOS qlmanage, hypothesis; fallback a headless-browser render) | image-specialist | implementation/09_brand_emblem.md (Tier 3) | 25 | AC-68 id count is 7; `grep -c FFC86B apps/core-web/public/favicon.svg` is at least 1; `xmllint --noout` passes on both SVGs; `sips -g pixelWidth -g pixelHeight` prints 1024x1024 for the three PNGs and `sips -g hasAlpha` prints yes for the foreground; no raster copied from ui_design/ | implementation |
| 29 | [WEB, APPROVED D38; SCR-04] (02_plan §4 W-05) Source the hero still per 01_specs §14.10: one Pexels or Unsplash photo of an empty interview or meeting room (generic query; no people, insignia or text; at least 2560 px wide), stored as packages/shared/assets/hero/room-2560.jpg with the mobile variant room-1600.jpg (both via macOS sips, JPEG quality 80), and one THIRD_PARTY_NOTICES.md entry (photographer, URL, licence, retrieval date) naming both apps/core-web and apps/mobile use. If none qualifies, build the procedural SVG fallback (H-S19) and record that instead | coder-execution | implementation/10_hero_asset.md (Tier 3) | 25 | AC-67 at the shared path: the notices entry names URL, author, licence and date and mentions apps/mobile (or records the fallback); `sips -g pixelWidth` prints 2560 and 1600; no file derived from ui_design/ or the MB 1 photo anywhere in the workspace assets | implementation |
| 30 | [WEB, APPROVED D38; SCR-07] (02_plan §4 W-01, part b and §6.1) Extend the shared token pipeline (tokens.ts, gen-theme.ts, theme/*.css and their tests): confirm the D31 rev-3 values (apply 02_plan §6.1 if absent); add the 03_motion_spec §2.3 NEW motion tokens as plain numbers and { stiffness, damping, mass } spring objects; add the third generator output theme/scalar.css per 01_specs §14.9; create test/contrast.test.ts (AC-69) if absent | coder-execution | implementation/11_token_pipeline.md (Tier 3) | 25 | `grep -c '#191008' packages/shared/src/tokens/tokens.ts` is at least 1; theme/scalar.css sets --scalar-background-1 and --scalar-color-accent; a token test asserts numeric stiffness, damping and mass on every spring token; `npm test -w @dems/shared -- test/theme.test.ts test/contrast.test.ts` exits 0; core-web and mobile typecheck exit 0 | implementation |
| 31 | [WEB, APPROVED D38; SCR-01 and SCR-02 contract] (02_plan §4 W-02, part a: simulator contract) Build the simulator contract in packages/shared/src/sim per 01_specs §14.7: rng, clock, dataset, events (audit ring buffer and SHA-256 hash chain), auth including signInWithBiometric with audit method BIOMETRIC; the zustand vanilla store with every slice and action signature, including pairing, lastSealedSessionId, sessionHistory and tabletLink; createSim accepting injected storage and visibility adapters and returning a ready promise after hydration; the engine skeleton; the React bindings SimProvider, useSim, useSimActions and useAudioChannel. No unguarded document, window, sessionStorage, localStorage or crypto.randomUUID under src/sim; export only through @dems/shared/sim; include test/auth.test.ts | coder-execution | implementation/12_sim_contract.md (Tier 3) | 27 | auth.test.ts passes (AC-50, plus a BIOMETRIC audit row); a store test with an injected in-memory storage shows `ready` resolves after hydration and the snapshot excludes the audio slice; the web-global grep under src/sim finds only guarded default-adapter code (quoted); src/index.ts does not re-export ./sim; shared typecheck exits 0 | implementation |
| 32 | [WEB, APPROVED D38; SCR-01 and SCR-02 behaviour] (02_plan §4 W-02, part b: simulator engine) Complete the simulator: session-machine (sets lastSealedSessionId and appends sessionHistory, including incomplete sessions), audio (frames of plain numbers and booleans), health (including the tabletLink input), evidence, faults, api (the 9 simulated §21.2 handlers), scenarios, pair and unpair with audit rows, acknowledgeSummary, and the engine loop driven by the injected visibility adapter; tests sim-determinism, session-machine, audio, storage-math, hash-chain, sim-platform-neutral and sim-mobile-additions | coder-execution | implementation/13_sim_engine.md (Tier 3) | 31 | `npm test -w @dems/shared` exits 0 with the seven test files passing (AC-51..AC-55, SCR-01, SCR-02); sim-platform-neutral runs in a Node environment with no document or sessionStorage defined; shared typecheck exits 0 | implementation |
| 33 | [WEB, APPROVED D38] (02_plan §4 W-03, part a) Author the framework-free shared API contract per 01_specs §14.9 (the root barrel re-exports ./api into mock-core and mobile): api/session-schema.ts with sessionCreateSchema; api/openapi.ts (OpenAPI 3.1.0, 10 operations, x-badges LIVE and SIMULATED, x-dems-mode); scripts/gen-openapi.ts writing openapi/openapi.json; test/openapi.test.ts | coder-execution | implementation/14_api_contract.md (Tier 3) | 27 | AC-56 test passes (parser valid, 10 operations, 1 LIVE, 9 SIMULATED); a second `npm run openapi:gen -w @dems/shared` leaves openapi.json with the same `shasum`; mock-core typecheck and test still exit 0 | implementation |
| 34 | [WEB, APPROVED D38; SCR-05] (02_plan §4 W-03, part b; 01_specs §14.11) Create the shared i18n resources at packages/shared/src/i18n: one typed English namespace file per web area under en/ (common, shell, login, dashboard, session, session-new, evidence, devices, storage, network-time, security-audit, system, api-reference) and an index exporting one plain, deep-mergeable nested object en; subject-type EN gloss keys (Suspect, Witness, Other); copy from research/04 §3 and §5 with Indonesian domain terms verbatim; an arithmetic formatDate (no Intl time zone) next to formatClock in src/realtime/format.ts with a test | coder-execution | implementation/15_i18n_resources.md (Tier 3) | 27 | 13 namespace files and the index exist; the index export is a plain object (a test deep-merges it with a sample mobile namespace); Tersangka, Saksi and Lainnya appear verbatim; the formatDate test passes for UTC+07:00 and format.ts contains no Intl call; shared typecheck exits 0 | implementation |
| 35 | [WEB, APPROVED D38; SCR-03 code part and SCR-06] (02_plan §4 W-04, part b; code, so coder-execution) Write the shared brand modules and the topographic texture: packages/shared/src/brand/emblem.ts with the emblem path data (viewBox, shield, arcs[6], gradient stops) in sync with the step-28 emblem.svg, plus test/brand-sync.test.ts; scripts/gen-topo.ts per 01_specs §14.10 writing apps/core-web/src/assets/brand/topo.svg and packages/shared/src/brand/topo.ts exporting the same SVG string | coder-execution | implementation/16_brand_modules_topo.md (Tier 3) | 27, 28 | brand-sync.test.ts passes (every emblem.ts path equals the matching d attribute in emblem.svg); two runs of `npm run gen:topo -w @dems/shared` give the same `shasum` for topo.svg and topo.ts; `xmllint --noout` passes; shared typecheck exits 0 | implementation |
| 36 | [WEB, APPROVED D38] (02_plan §4 W-07, part a) Build the web motion library in apps/core-web/src/motion per 03_motion_spec §2, §3, §8 and §9: variants from the motion tokens, use-motion-policy (reduced motion; ?motion=slow with proofSlowFactor 10 on any route), glow-layer, and the ?debug=1 overlay (fps, ambient-loop count, meter frame counter) | coder-execution | implementation/17_motion_library.md (Tier 3) | 30 | A unit test shows the policy returns reduced variants under prefers-reduced-motion and 10x durations under ?motion=slow; MS-01 and MS-02 greps find nothing; core-web typecheck, lint and test exit 0 | implementation |
| 37 | [WEB, APPROVED D38] (02_plan §4 W-08, part b) Copy the 13 Magic UI and Motion Primitives items listed in 02_plan §4 W-08 (AnimatedNumber, TextEffect, TextShimmer, TextScramble, TransitionPanel, AnimatedBackground, Spotlight, AnimatedList with the edited item variants, Ripple, ShineBorder, OrbitingCircles, AnimatedBeam, Particles) into apps/core-web/src/components/ui without shadcn init, recording each in THIRD_PARTY_NOTICES.md | coder-execution | implementation/18_copy_in_items.md (Tier 3) | 27, 29 | 13 new files under components/ui (border-beam.tsx and sliding-number.tsx untouched); THIRD_PARTY_NOTICES.md names all 13 with source URL and licence; AC-17's shadcn check finds nothing; core-web typecheck and lint exit 0 | implementation |
| 38 | [WEB, APPROVED D38] (02_plan §4 W-06) Build the web shell and routing skeleton per 01_specs §14.2–§14.4: all 16 route files in final form (createFileRoute, validateSearch, a component imported from a features/<page>/index.tsx stub created here); the _app auth guard; AppShell (top bar, sidebar with DEVELOPER group, icon rail, Drawer, bottom tab bar, page-header template, focus ring, skip link); the __root providers (Sim, i18n through src/i18n.ts, MotionConfig, Heartbeat, Query); the row-17 proof route moved to /stack-check | coder-execution | implementation/19_app_shell.md (Tier 3) | 28, 30, 31, 34, 35 | A route test renders every §14.2 page path to its page-<id> stub for a signed-in operator and redirects signed-out /dashboard to /login?redirect=%2Fdashboard (AC-48 and AC-49 at stub level); routeTree.gen.ts lists all 16 route files; the W-1 home-page test still passes; core-web typecheck, lint and test exit 0 | implementation |
| 39 | [WEB, APPROVED D38] (02_plan §4 W-08, part a) Build the custom compositions GlowRing, DbfsMeter (reads the transient audio channel, never React state), SessionTimeline and Stepper per 01_specs §14.6, plus the CameraFeed canvas renderer per §14.10 using @dems/shared/assets/hero/room-2560.jpg, in apps/core-web/src/components/composed and components/media, with motion per 03_motion_spec §5 | coder-execution | implementation/20_compositions.md (Tier 3) | 29, 31, 36 | Each composition has a test for its §14.6 accessibility contract; a DbfsMeter test counts 0 React commits across 20 audio frames (MS-08 unit form); MS-01 and MS-02 greps find nothing; core-web typecheck, lint and test exit 0 | implementation |
| 40 | [WEB, APPROVED D38; parallel checkpoint CP-1] (02_plan §4.1 W-02b rule, applied early) Review the web foundation read-only before the page fan-out: the simulator API against the Data column of 01_specs §14.5; the simulator's API handlers against the OpenAPI shapes; the SCR-01 and SCR-02 surface the mobile lane consumes; shell and route structure (§14.2–§14.4); the composition contracts (§14.6); the motion rules (03_motion_spec §9) | senior-code-reviewer | verification/06_foundation_review.md (Tier 2) | 32, 33, 36, 37, 38, 39 | Findings carry file:line and severity; a table maps every §14.5 Data item and every SCR-01/SCR-02 item to an existing export or names it as a gap; zero open blocker findings before steps 43, 46 and 47 start | verification |
| 41 | [WEB, APPROVED D38] (02_plan §4 W-07, part b) Integrate app-level and shell motion per 03_motion_spec §4: the M-APP-01..03 infrastructure (root LayoutGroup and AnimatePresence, top-bar emblem slot with layoutId brand-emblem, H-M1 proven natively or replaced by the two-phase DOMRect fallback), the M-APP-04 route transitions, and the shell motions M-SH-01..08 | coder-execution | implementation/21_shell_motion.md (Tier 3) | 36, 37, 38 | H-M1 outcome (native or fallback) recorded with the test or trace that decided it; the reduced-motion test for shell loops passes; MS-01 and MS-02 greps find nothing; core-web typecheck, lint and test exit 0 | implementation |
| 42 | [WEB, APPROVED D38] (02_plan §4 W-10) Build the Dashboard per 01_specs §14.5.1 (panels A–J, grid and row heights) and 03_motion_spec M-PG-DASH, writing only apps/core-web/src/features/dashboard, its i18n namespace file and its own test file | coder-execution | implementation/22_page_dashboard.md (Tier 3) | 29, 32, 37, 38, 39 | Render test asserts page-dashboard and panel test IDs A–J in the idle scenario; the storage panel reads 20% USED and 3.2 TB free of 4.0 TB (AC-75 unit form); core-web typecheck, lint and test exit 0 | implementation |
| 43 | [WEB, APPROVED D38] (02_plan §4 W-09) Build the Login page per 01_specs §14.8 and 03_motion_spec M-PG-LOGIN with its side of the M-APP-01 hand-off, writing only apps/core-web/src/features/login, its i18n namespace file and its own test file | coder-execution | implementation/23_page_login.md (Tier 3) | 40, 41 | Tests show every §14.8 state renders, a correct sign-in navigates to the redirect target, and no password appears in sessionStorage, the URL or emitted events (AC-49, AC-50 UI path); core-web typecheck, lint and test exit 0 | implementation |
| 44 | [WEB, APPROVED D38] (02_plan §4 W-11) Build the Session Monitor with finalization per 01_specs §14.5.2 and 03_motion_spec M-PG-SM, writing only apps/core-web/src/features/session-monitor, its i18n namespace file and its own test file | coder-execution | implementation/24_page_session_monitor.md (Tier 3) | 32, 37, 38, 39 | Render test asserts the page test ID and panel test IDs K–T in the recording scenario; a fake-timer test drives End Session with a reason to SEALED within 10 s of sim time (AC-63 unit form); core-web typecheck, lint and test exit 0 | implementation |
| 45 | [WEB, APPROVED D38; parallel checkpoint CP-2] (02_plan §4 W-21 subset, run early) Run the early visual and performance checkpoint in the browser on Vite port 5173 at 1920x1080 and 1440x900 on the shell, Dashboard and Session Monitor: AC-59, AC-60, AC-61, AC-70 on these pages, and a first AC-71 reading, using mock-core under P5 | verifier | verification/07_visual_checkpoint.md (Tier 2) | 41, 42, 44 | Each listed check PASS or FAIL with a quoted measurement or screenshot path; each FAIL routed to step 38, 39, 41, 42 or 44 with the expected correction; own PIDs stopped | verification |
| 46 | [WEB, APPROVED D38] (02_plan §4 W-12) Build the Start New Session flow per 01_specs §14.5.11 and 03_motion_spec M-PG-NEW (three steps, the §5.3 gate policy, 3-2-1 countdown), writing only apps/core-web/src/features/session-new, its i18n namespace file and its own test file | coder-execution | implementation/25_flow_start_session.md (Tier 3) | 40, 44 | Fake-timer tests show step 2 blocks on a BLOCK check, WARN needs acknowledgement, and Start puts the sim in RECORDING with audit SESSION_CREATED, PRECHECK_PASSED and RECORDING_STARTED (AC-62 unit form); core-web typecheck, lint and test exit 0 | implementation |
| 47 | [WEB, APPROVED D38] (02_plan §4 W-13) Build the Evidence list, detail (media, metadata and integrity tabs) and export wizard per 01_specs §14.5.3 and 03_motion_spec M-PG-EVID, writing only apps/core-web/src/features/evidence, its i18n namespace file and its own test files | coder-execution | implementation/26_page_evidence.md (Tier 3) | 40 | The evidence-table test (AC-64) passes with a fixture of at least 11 rows so page 2 exists; integrity-tab Verify returns PASS on the canonical dataset; core-web typecheck, lint and test exit 0 | implementation |
| 48 | [WEB, APPROVED D38] (02_plan §4 W-14) Build the Devices & Inputs page per 01_specs §14.5.4 and 03_motion_spec M-PG-DEV, writing only apps/core-web/src/features/devices, its i18n namespace file and its own test file | coder-execution | implementation/27_page_devices.md (Tier 3) | 40, 45 | Render test asserts the page test ID and every panel test ID §14.5.4 lists, in the idle scenario; core-web typecheck, lint and test exit 0 | implementation |
| 49 | [WEB, APPROVED D38] (02_plan §4 W-15) Build the Storage page per 01_specs §14.5.5 and 03_motion_spec M-PG-STOR, writing only apps/core-web/src/features/storage, its i18n namespace file and its own test file | coder-execution | implementation/28_page_storage.md (Tier 3) | 40, 45 | Render test asserts the page and panel test IDs from §14.5.5 and the ring text 20% USED with 3.2 TB free of 4.0 TB (AC-75 unit form); core-web typecheck, lint and test exit 0 | implementation |
| 50 | [WEB, APPROVED D38] (02_plan §4 W-16) Build the Network & Time page per 01_specs §14.5.6 and 03_motion_spec M-PG-NET, writing only apps/core-web/src/features/network-time, its i18n namespace file and its own test file | coder-execution | implementation/29_page_network_time.md (Tier 3) | 40, 45 | Render test asserts the page test ID and every panel test ID §14.5.6 lists, with UTC+07:00 timestamps; core-web typecheck, lint and test exit 0 | implementation |
| 51 | [WEB, APPROVED D38] (02_plan §4 W-17) Build the Security & Audit page per 01_specs §14.5.7 and 03_motion_spec M-PG-SEC, writing only apps/core-web/src/features/security-audit, its i18n namespace file and its own test file | coder-execution | implementation/30_page_security_audit.md (Tier 3) | 40, 45 | Render test asserts the page and panel test IDs from §14.5.7; after inject AUDIT_TAMPER the chain view reports FAIL at the tampered index (AC-55 UI path); core-web typecheck, lint and test exit 0 | implementation |
| 52 | [WEB, APPROVED D38] (02_plan §4 W-18) Build the System & Maintenance page with the Demo Control Panel per 01_specs §14.5.8 and 03_motion_spec M-PG-SYS, writing only apps/core-web/src/features/system, its i18n namespace file and its own test file | coder-execution | implementation/31_page_system.md (Tier 3) | 40, 45 | Render test asserts the page and panel test IDs from §14.5.8; Demo Control Panel actions MIC 2 clip and Storage full change sim state to CLIP-latched and FULL (AC-65 unit form); core-web typecheck, lint and test exit 0 | implementation |
| 53 | [WEB, APPROVED D38] (02_plan §4 W-19) Build the API Reference page per 01_specs §14.9 and 03_motion_spec M-PG-API (Scalar config, simAwareFetch, scalar.css theme, server strip, Realtime WS panel, lazy route chunk), resolving H-S17 or applying its fallback, writing only apps/core-web/src/features/api-reference, its i18n namespace file and its two test files | coder-execution | implementation/32_page_api_reference.md (Tier 3) | 33, 40, 45 | scalar-config.test.ts (AC-57 config part) and sim-fetch.test.ts (AC-58) pass; H-S17 outcome recorded with evidence; no @scalar import outside features/api-reference (grep quoted); core-web typecheck, lint and test exit 0 | implementation |
| 54 | [WEB, APPROVED D38; conditional; W-02 owner] (02_plan §4.1 W-02b) Close the simulator API gaps logged by the web page steps 42–53 as SIM-GAP-n: add each missing selector or action with tests in packages/shared/src/sim, then remove each web page's temporary sim-adapter. If no web page log lists a gap, the controller records SKIPPED with the grep evidence instead of delegating | coder-execution | implementation/33_sim_gap_closure_web.md (Tier 3) | 42, 43, 44, 46, 47, 48, 49, 50, 51, 52, 53 | `grep -rn SIM-GAP- apps/core-web/src` finds nothing; shared, core-web and mobile typecheck and test exit 0 (or SKIPPED recorded with evidence) | implementation |
| 55 | [DONE: this merge, rev 3] Merge the mobile lane into this blueprint from masterplan/04_mobile_specs.md and masterplan/05_mobile_plan.md: M-rows as steps 67–91 with lanes, locks and ports; SCR-01..SCR-07 folded into steps 27–35 (Q-M7 yes); end-pass halves rewired; combined approval gate | task-architect | identification/02_structured.md (rev 3; Tier 2) | 6 | Every M-step cites its 05_mobile_plan row; V1–V7 PASS on 91 rows; no two concurrent steps share a write path, lock or port (collision scan); Refinement Log RL-40 onward | masterplan |
| 56 | [WEB, APPROVED D38 for web scope; stack scope pre-approved D1] (02_plan §3 Row 20 and §4 W-20; web and stack half of the absorbed row 20) Complete and run the stack and web test suites: confirm the 01_specs §8 smoke tests S-1, S-2, M-1..M-3 and W-1 exist (add any missing); add the §14.13 core-web tests no build step owns (routes.test.tsx for AC-48 and AC-49 with an i18next missingKey handler for AC-66; reduced-motion.test.tsx for AC-70); run npm test for the shared, mock-core and core-web workspaces with --maxWorkers=2 | test-expert | test/01_test_report.md (Tier 2) | 54 | The three workspace test runs exit 0 with the §8 stack smoke tests and every §14.13 test file passing, runner output quoted (automated AC-48..AC-58, AC-64, AC-66, AC-69, AC-70); 0 missing i18n keys; no test connects beyond 127.0.0.1 | test |
| 57 | [MOBILE, APPROVED D38] (05 §3 M-16; mobile half of the absorbed row 20) Complete and run the mobile test suite: T-M02 against the real screens, T-M11 missing keys, the cross-cutting tests of 04_mobile_specs §10.1, and the Maestro flows apps/mobile/e2e/maestro/01..04 on both AVDs (Q-M2 approved, D38; both AVD locks, phone first; Metro 8085); run npm test for the mobile workspace with --maxWorkers=2 | test-expert | test/02_mobile_test_report.md (Tier 2) | 90, 91 | MA-03 (at least 15 test files T-M01..T-M15 pass), MA-04 and MA-21 with runner output quoted; MA-27 PASS on both AVDs (4 Maestro flows, junit output linked); no test connects beyond 127.0.0.1 | test |
| 58 | [WEB, APPROVED D38] (02_plan §4 W-21) Verify the web build in the browser (agent-browser first) on Vite port 5173 at 1920x1080, 1440x900, 1200x800 and 900x800 against AC-48..AC-75 and MS-01..MS-10 (including the MS-07 Login hand-off capture), running the idle, recording, finalizing and fault-demo scenarios, with mock-core under P5 | verifier | verification/04_web_verification.md (Tier 2) | 56 | Each of AC-48..AC-75 and MS-01..MS-10 marked PASS or FAIL with quoted output or a screenshot path; AC-57 resource-host list quoted; AC-71 fps and long-task counts plus the AC-73 entry-chunk gzip size recorded; each FAIL routed to its owning step | verification |
| 59 | [MOBILE, APPROVED D38] (05 §3 M-18) Verify the mobile app from a fresh zsh -l on dems_phone (emulator-5554) and dems_tablet (emulator-5556) against MA-01..MA-30 and the scaffold mobile ACs AC-16 and AC-25..AC-34, with the MA-11 contact sheet and gfxinfo on both AVDs; hold both AVD locks (phone first), Metro 8086, the Gradle lock for any rebuild; run MA-10 only while this step is mock-core's sole registered user (P5) | verifier | verification/08_mobile_verification.md (Tier 2) | 57 | Each of MA-01..MA-30, AC-16 and AC-25..AC-34 marked PASS or FAIL with quoted output or a screencap path on the stated AVD; contact sheet linked; each FAIL routed to its owning step; locks released and own PIDs stopped | verification |
| 60 | [WEB and MOBILE, APPROVED D38; stack sections pre-approved D1] (02_plan §3 Row 21, §4 W-22 and 05 §3 M-21; absorbs row 21) Write the run guide at /Users/gsp-budi/Documents/DEMS/README.md: the 8 AC-44 sections, the D24 emulator note, --no-metrics, both AVD scripts and rollback pointers; web sections (pages, scenarios, Demo Control Panel, presentation mode, ?debug=1, ?motion=slow); a mobile section (lanes and Metro ports, locks, AVD boot on ports 5554 and 5556, deep links, scenarios, biometric enrolment with PIN 1234, Maestro, and a presenter note that each app runs its own simulator, Q-M4 accepted in D38); one `graft build .` line (never graft init). Cite commands from existing logs and start no servers | coder-execution | /Users/gsp-budi/Documents/DEMS/README.md (Tier 2) | 56, 57 | The AC-44 section grep returns 8; a command-to-log mapping table in the return message shows passing output for every README command; versions match initialization/01_env_check.md; no pre-existing root README.md overwritten (E13) | implementation |
| 61 | [WEB, APPROVED D38 for web scope; stack scope pre-approved D1] (02_plan §3 Row 22; absorbs row 22) Verify the stack end to end from a fresh zsh -l by following README.md literally: first stop the session-scoped emulators started by step 67 (P3), then AC-01..AC-47 with the D29 wording for AC-01, AC-04 and AC-11, on both AVDs with the mobile build re-proven after both lanes' changes to packages/shared; root `npm run typecheck`, `npm run lint` and `npm test` (AC-43, AC-47); the dumpsys gfxinfo jank baseline per AVD (informational) | verifier | verification/01_verification.md (Tier 2) | 58, 59, 60 | AC-01..AC-47 each PASS, FAIL or CAUTION-with-acknowledgement with quoted output; SC1–SC7 all PASS; every initialization log carries its rollback command; no emulator is left running; each FAIL routed to its owning row or step | verification |
| 62 | [WEB, APPROVED D38 for web scope; stack scope pre-approved D1] (02_plan §3 Row 23 and §4 W-23, security half; stack and web half of the absorbed row 23) Security review of the stack and the web build, read-only and starting no servers: ~/.zprofile diff limited to blocks A and B; loopback-only listeners and the Metro bind (from the row 19, step 58 and step 61 logs); no credentials in URLs, logs, events or sessionStorage (01_specs §14.8); Scalar privacy flags and zero external resource hosts (AC-57); @scarf/scarf absent; THIRD_PARTY_NOTICES.md complete; .gitignore coverage (AC-46, .locks/); npm audit high and critical counts; no design-book text in the web bundle | security-review | verification/02_security.md (Tier 2; verdict PASS, CAUTION or FAIL) | 58, 60 | Verdict stated; every checklist item has command output or file:line evidence; each CAUTION or FAIL names a remediation step | verification |
| 63 | [MOBILE, APPROVED D38] (05 §3 M-19; mobile half of the absorbed row 23) Security review of the mobile app, read-only and starting no servers: no credentials in AsyncStorage keys (04_mobile_specs §5.3) or logs; biometric handling; loopback-only traffic (MA-25); cleartext only in the debug manifest (AC-26); Android permissions (USE_BIOMETRIC); no EAS, expo-updates or projectId (AC-27, MA-26); Maestro analytics off and the ~/.maestro footprint (installed by step 90, Q-M2 approved in D38); THIRD_PARTY_NOTICES.md mobile use (MA-24); no design-book text in the JS bundle | security-review | verification/09_mobile_security.md (Tier 2; verdict PASS, CAUTION or FAIL) | 59, 60 | Verdict stated; every checklist item has command output or file:line evidence; each CAUTION or FAIL names a remediation step | verification |
| 64 | [WEB, APPROVED D38 for web scope; stack scope pre-approved D1] (02_plan §3 Row 24 and §4 W-23, review half; stack and web half of the absorbed row 24) Senior code review of apps/core-web, apps/mock-core, packages/shared and the root config: duplication; dependency hygiene (AC-13 single React, peer conflicts); token and type reuse; template leftovers; D6 compliance (only the five §14.6 compositions are custom UI); simulator core free of DOM and React and platform-neutral (SCR-01); erasableSyntaxOnly; bundle split (AC-73, quoted from step 58) | senior-code-reviewer | verification/03_code_review.md (Tier 2) | 58, 60 | Findings carry file:line and severity; zero open blocker findings; `npm ls react react-dom --all` output quoted | verification |
| 65 | [MOBILE, APPROVED D38] (05 §3 M-20; mobile half of the absorbed row 24) Senior code review of apps/mobile: D6 compliance (MA-23, only C-1..C-6 custom); shared-contract use without forks (MA-28); single React and zustand copies (MA-01); UI-thread discipline for meters, Skia and Reanimated (MA-16, 04_mobile_specs §7.8); ownership rules of 05 §3 held (no mobile step wrote packages/shared) | senior-code-reviewer | verification/10_mobile_code_review.md (Tier 2) | 59, 60 | Findings carry file:line and severity; zero open blocker findings; `git diff --stat` of packages/shared restricted to mobile-step commits is empty or explained | verification |
| 66 | [WEB, APPROVED D38; covers 05 M-22] (02_plan §4 W-24 and 05 §3 M-22) Create one combined final local commit of both verified builds and the end-pass outputs on top of the step-25 baseline, using the existing git identity; no remote, no push | git-specialist | implementation/34_git_final_commit.md (Tier 3) | 61, 62, 63, 64, 65 | `git log --oneline` shows the new commit directly above the step-25 baseline; `git status --porcelain` is empty; `git remote -v` is empty; `git ls-files` lists no .docx, .env, keystore, node_modules, .cache, .locks or apps/mobile/android path | implementation |
| 67 | [MOBILE, APPROVED D38; npm slot 2 of 2; Gradle] (05 §3 M-01; §6) Prepare the mobile dependencies and native config: diff installed packages against 01_specs §1.4 and 04_mobile_specs §8.4 and install only the missing ones under .locks/npm.lock after step 27 (R-1 npx expo install: expo-local-authentication, @react-native-async-storage/async-storage, react-native-keyboard-controller; R-2 exact: zustand 5.0.15, i18next 26.4.2, react-i18next 17.0.15); move the jest config into jest.config.js and jest.setup.ts with the §10.1 additions; add the start:lane script and the e2e script with the Maestro analytics opt-outs (Q-M2 approved, D38); add the expo-local-authentication plugin to app.json; add scripts/device-session.sh (05 §5.4); boot both AVDs on fixed ports 5554 and 5556 as session-scoped emulators (P3); prebuild and Gradle once under .locks/gradle.lock; install on both AVDs; prove the lane-port reverse (H-MB-09) | coder-execution | implementation/40_mobile_deps_native.md (Tier 3) | 25, 27 | MA-01, MA-02 and MA-26 PASS with quoted output; AC-16, AC-25, AC-26 and AC-27 still PASS; the app launches on emulator-5554 and emulator-5556 through a lane on Metro 8082 (H-MB-09 outcome recorded); apps/mobile/package.json has no jest key; emulator PIDs written to .locks/dems_phone.pid and .locks/dems_tablet.pid | implementation |
| 68 | [MOBILE, APPROVED D38] (05 §3 M-02, part a) Build the mobile foundation without the simulator per 04_mobile_specs §2.2 and §3.2: layout classes with SafeScreen and PaneLayout; AppProviders without simulator, auth or motion, wired into the existing src/app/_layout.tsx (edit, not rename); the typed no-op runtime contract stub src/runtime/index.ts (SimRuntimeProvider, useCoreLink, SessionRouteSync, KeepAwakeController, useAuth); kit recipes StatusChip, SubjectTypeChip, SectionCard and KeyValueList; src/i18n/index.ts, en.mobile.ts and an empty src/i18n/features.ts registry; src/global.css additions if needed | coder-execution | implementation/41_mobile_foundation.md (Tier 3) | 25 | T-M01 passes; the MA-22 hex grep finds nothing in the new files; the /stack-check device smoke on both AVDs, run after step 67 reports its reinstall, shows no regression; mobile typecheck, lint and jest (--maxWorkers=2) exit 0 | implementation |
| 69 | [MOBILE, APPROVED D38] (05 §3 M-02, part b) Build the mobile motion kit in apps/mobile/src/motion per 04_mobile_specs §7: token-to-Reanimated mapping from the step-30 motion tokens; builders; useMotionPolicy with ReducedMotionConfig and the kit animation 'disable-all' switch; GlowLayer; the haptics service (§7.6); the ?debug=1 overlay; a MotionPolicyProvider export for the root layout | coder-execution | implementation/42_mobile_motion_kit.md (Tier 3) | 30 | T-M12 and T-M14 pass (MA-18 unit part, MA-20); the MA-20 grep finds no Haptics call outside src/motion/haptics; mobile typecheck, lint and jest exit 0 | implementation |
| 70 | [MOBILE, APPROVED D38] (05 §3 M-03) Build the mobile navigation shell per 04_mobile_specs §3: the full Expo Router tree of §3.1 with a stub for every route (screen-<id> from src/features/<folder>/<name>-screen.tsx) plus an empty i18n.ts per feature folder registered in src/i18n/features.ts; the Stack.Protected guard on the useAuth contract; headless Tabs with ResponsiveTabList (BottomTabBar, NavRail, LiveMiniBar); hidden More triggers (H-MB-01); the boot router keeping ?motion= on the proof screen (AC-31); public /stack-check and /pair; the usePreventRemove back-guard hook; zod deep-link parsing; the step-69 MotionPolicyProvider in _layout.tsx | coder-execution | implementation/43_mobile_navigation_shell.md (Tier 3) | 68, 69 | T-M02 (stubs) and T-M03 pass (MA-04 stub level, MA-05); on both AVDs MA-14 and MA-15 PASS and the chrome parts of MA-12 and MA-13 are recorded with screencaps; mobile typecheck, lint and jest exit 0 | implementation |
| 71 | [MOBILE, APPROVED D38] (05 §3 M-04) Build the mobile compositions and asset renderers without the simulator per 04_mobile_specs §4.0 and §8.3: C-1 GlowRing, C-2 DbfsMeter (input = shared values), C-3 SessionTimeline, C-4 Stepper, C-6 RollingNumber with their pure-maths modules and tests; CameraFeed, Emblem and HeroBackdrop with placeholder image and path data; the debug-only route src/app/dev-gallery.tsx (create only); compositions take the motion policy as a prop | coder-execution | implementation/44_mobile_compositions.md (Tier 3) | 25 | T-M09 passes (MA-16: one meter render for 40 frames; no React state in dbfs-meter.tsx); the MA-23 listing shows only C-1..C-6 under components/composed; dev-gallery screencaps on both AVDs after step 67's reinstall; mobile typecheck, lint and jest exit 0 | implementation |
| 72 | [MOBILE, APPROVED D38; Gradle] (05 §3 M-05) Wire the mobile brand and media: emblem path data and the topographic SVG from @dems/shared/brand (step 35) into Emblem and the backdrops; the step-28 PNGs into apps/mobile/assets/images/brand/ and the app.json icon, adaptive-icon, monochrome and splash keys; the step-29 room-1600.jpg into apps/mobile/assets/images/hero/ for CameraFeed, HeroBackdrop and thumbnails; one prebuild and Gradle rebuild under .locks/gradle.lock with reinstall on both AVDs | coder-execution | implementation/45_mobile_brand_media.md (Tier 3) | 28, 29, 35, 67, 71 | MA-24 PASS (no DEMS-Mobile reference; hero shasum equals the step-29 room-1600.jpg; notices name apps/mobile); launcher icon and splash screencaps on both AVDs (MA-11 icon and splash part); the Gradle run held the lock; THIRD_PARTY_NOTICES.md not modified by this step | implementation |
| 73 | [MOBILE, APPROVED D38] (05 §3 M-06) Wire the mobile runtime to the shared simulator per 04_mobile_specs §5 and §6: replace the step-68 stubs in src/runtime with SimRuntimeProvider (createSim with AsyncStorage storage, AppState visibility and the ready-promise hydration gate), useAudioSharedValues, the Core link (Simulated by default, Q-M8 approved in D38; heartbeat as the alternative), SessionRouteSync and KeepAwakeController; src/auth with AuthProvider over the simulator auth, the biometric service with T-M05, and the idle lock; the ConnectionBanner logic; the shared @dems/shared/i18n resources deep-merged in src/i18n/index.ts; the new providers in src/providers/app-providers.tsx | coder-execution | implementation/46_mobile_runtime_sim.md (Tier 3) | 32, 33, 34, 68 | T-M05, T-M06 and T-M07 pass; MA-08 and MA-19 PASS on a device; MA-10 runtime part recorded (run only as mock-core's sole registered user, P5); the MA-28 check finds at least one @dems/shared/sim importer; mobile typecheck, lint and jest exit 0 | implementation |
| 74 | [MOBILE, APPROVED D38; parallel checkpoint CP-M1] (05 §3 ownership rules, applied early) Review the mobile foundation read-only before the screen fan-out: runtime wiring against 04_mobile_specs §5 (adapters, hydration gate, transient meter path); navigation shell and guard (§3); composition contracts and UI-thread discipline (§4.0, §7.8); the motion kit and haptics service (§7); the 05 §3 ownership rules; the §5.6 selectors every screen needs against the step-31 and step-32 simulator | senior-code-reviewer | verification/11_mobile_foundation_review.md (Tier 2) | 70, 71, 72, 73 | Findings carry file:line and severity; a table maps every 04_mobile_specs §5.6 selector to an existing simulator export or names it a gap; zero open blocker findings before steps 76, 78 and 80–89 start | verification |
| 75 | [MOBILE, APPROVED D38] (05 §3 M-07, part a) Build the mobile Login with biometric sign-in per 04_mobile_specs §4.1 and §6, writing only apps/mobile/src/features/login (screen, its i18n.ts, its tests); enrol PIN 1234 and a virtual fingerprint on both AVDs per §6.3 (Q-M3 approved, D38), hiding the biometric button on an AVD where H-MB-04 fails | coder-execution | implementation/47_mobile_login.md (Tier 3) | 70, 72, 73 | T-M04 passes (MA-06); MA-07 PASS on both AVDs after enrolment, or the H-MB-04 fallback recorded for the failing AVD; MA-15 login part PASS; compact and expanded screencaps on both AVDs; mobile typecheck, lint and jest exit 0 | implementation |
| 76 | [MOBILE, APPROVED D38] (05 §3 M-07, part b) Build the mobile Pairing screen per 04_mobile_specs §4.2 and §6.5, writing only apps/mobile/src/features/pairing (screen, its i18n.ts, its tests) | coder-execution | implementation/48_mobile_pairing.md (Tier 3) | 70, 73, 74 | Its test shows pair(code) and unpair() change the pairing state and emit audit rows; screencaps on both AVDs; mobile typecheck, lint and jest exit 0 | implementation |
| 77 | [MOBILE, APPROVED D38] (05 §3 M-08) Build the mobile Home (Dashboard) per 04_mobile_specs §4.3 and §7.3, writing only apps/mobile/src/features/dashboard (screen, its i18n.ts, its tests) | coder-execution | implementation/49_mobile_home.md (Tier 3) | 70, 71, 73 | MA-11 MB 2 checklist met on dems_phone; MA-12 home part and MA-18 ring check recorded; its render test passes; mobile typecheck, lint and jest exit 0 | implementation |
| 78 | [MOBILE, APPROVED D38] (05 §3 M-09) Build the mobile Start New Session flow per 04_mobile_specs §4.4 (three steps, the §5.3 gate, ARMED), writing only apps/mobile/src/features/session-new (screen, its i18n.ts, its tests) | coder-execution | implementation/50_mobile_start_session.md (Tier 3) | 70, 71, 73, 74 | T-M10 passes; MA-29 steps 1–3 and MA-30 step-2 part PASS on dems_phone; MA-11 MB 3 checklist met; mobile typecheck, lint and jest exit 0 | implementation |
| 79 | [MOBILE, APPROVED D38] (05 §3 M-10) Build the mobile Session Monitor per 04_mobile_specs §4.5 (feed, meters, actions, the "End Session" hold with reason, labelled "End Session" per Q-M5 in D38, sheets, back guard, banner), writing only apps/mobile/src/features/session-live (screen, its i18n.ts, its tests) | coder-execution | implementation/51_mobile_session_live.md (Tier 3) | 70, 71, 73 | T-M08 passes; MA-09 PASS on a device; MA-12 live part and MA-17 recorded on both AVDs; MA-11 MB 4 checklist met; mobile typecheck, lint and jest exit 0 | implementation |
| 80 | [MOBILE, APPROVED D38] (05 §3 M-11, part a) Build the mobile Finalization and Session Summary flow per 04_mobile_specs §4.6 and §4.7, writing only apps/mobile/src/features/session-finalizing and session-summary (screens, their i18n.ts, their tests) | coder-execution | implementation/52_mobile_finalize_summary.md (Tier 3) | 70, 71, 73, 74 | The MA-29 finalize-to-summary part PASS on dems_phone (FINALIZING to SEALED within 10 s; violet SEALED chip; acknowledgeSummary called); its tests pass; mobile typecheck, lint and jest exit 0 | implementation |
| 81 | [MOBILE, APPROVED D38] (05 §3 M-11, part b) Build the mobile Recovery Status screen per 04_mobile_specs §4.8, writing only apps/mobile/src/features/session-recovery (screen, its i18n.ts, its tests) | coder-execution | implementation/53_mobile_recovery.md (Tier 3) | 70, 73, 74 | Its test drives FAULT to RECOVERY to an incomplete session and asserts the screen states; screencaps on both AVDs; mobile typecheck, lint and jest exit 0 | implementation |
| 82 | [MOBILE, APPROVED D38] (05 §3 M-11, part c) Build the mobile Sessions hub per 04_mobile_specs §4.9, writing only apps/mobile/src/features/sessions (screens, their i18n.ts, their tests) | coder-execution | implementation/54_mobile_sessions_hub.md (Tier 3) | 70, 73, 74 | Its test lists sessionHistory including an incomplete session; screencaps on both AVDs; mobile typecheck, lint and jest exit 0 | implementation |
| 83 | [MOBILE, APPROVED D38] (05 §3 M-12) Build the mobile Evidence list, detail, export and play sheets per 04_mobile_specs §4.10 and §4.11, writing only apps/mobile/src/features/evidence (screens, their i18n.ts, their tests) | coder-execution | implementation/55_mobile_evidence.md (Tier 3) | 70, 71, 72, 73, 74 | T-M15 passes; MA-11 MB 5 and MB 6 checklists met on dems_phone; MA-12 evidence part and MA-13 selection part PASS on dems_tablet; mobile typecheck, lint and jest exit 0 | implementation |
| 84 | [MOBILE, APPROVED D38] (05 §3 M-13) Build the mobile Devices & Inputs list and device detail per 04_mobile_specs §4.12, writing only apps/mobile/src/features/devices (screens, their i18n.ts, their tests) | coder-execution | implementation/56_mobile_devices.md (Tier 3) | 70, 71, 73, 74 | MA-11 MB 7 checklist met on dems_phone; the list/detail panes render on dems_tablet; its tests pass; mobile typecheck, lint and jest exit 0 | implementation |
| 85 | [MOBILE, APPROVED D38] (05 §3 M-14, part a) Build the mobile Storage screen per 04_mobile_specs §4.13, writing only apps/mobile/src/features/storage (screen, its i18n.ts, its tests) | coder-execution | implementation/57_mobile_storage.md (Tier 3) | 70, 71, 73, 74 | MA-11 MB 8 checklist met, with the ring at 20% USED and 3.2 TB free of 4.0 TB; its test passes; mobile typecheck, lint and jest exit 0 | implementation |
| 86 | [MOBILE, APPROVED D38] (05 §3 M-14, part b) Build the mobile Network & Time screen per 04_mobile_specs §4.14, writing only apps/mobile/src/features/network-time (screen, its i18n.ts, its tests) | coder-execution | implementation/58_mobile_network_time.md (Tier 3) | 70, 71, 73, 74 | MA-11 MB 9 checklist met, with UTC+07:00 times from the shared arithmetic formatter; its test passes; mobile typecheck, lint and jest exit 0 | implementation |
| 87 | [MOBILE, APPROVED D38] (05 §3 M-15, part a) Build the mobile Operator Audit View per 04_mobile_specs §4.16, writing only apps/mobile/src/features/audit (screen, its i18n.ts, its tests) | coder-execution | implementation/59_mobile_audit.md (Tier 3) | 70, 73, 74 | Its test lists audit rows including AUTH_SUCCESS with method BIOMETRIC and the session events MA-29 names; screencaps on both AVDs; mobile typecheck, lint and jest exit 0 | implementation |
| 88 | [MOBILE, APPROVED D38] (05 §3 M-15, part b) Build the mobile Settings screens with every section, including Demo controls, the Core link source switch (default Simulated, Q-M8 approved in D38) and the reduce-motion override, per 04_mobile_specs §4.15, writing only apps/mobile/src/features/settings (screens, their i18n.ts, their tests) | coder-execution | implementation/60_mobile_settings.md (Tier 3) | 70, 73, 74 | MA-11 MB 10 checklist met; the MA-30 demo-controls part PASS on a device (MIC 2 clip, Storage full); its tests pass; mobile typecheck, lint and jest exit 0 | implementation |
| 89 | [MOBILE, APPROVED D38] (05 §3 M-15, part c) Build the phone-only More screen per 04_mobile_specs §4.17, writing only apps/mobile/src/features/more (screen, its i18n.ts, its tests) | coder-execution | implementation/61_mobile_more.md (Tier 3) | 70, 73, 74 | Its render test lists every More destination and each navigates to its route; screencap on dems_phone; mobile typecheck, lint and jest exit 0 | implementation |
| 90 | [MOBILE, APPROVED D38 (Q-M2 yes); HOST] (05 §3 M-17) Install the Maestro CLI 2.11.0: download the pinned zip and checksums_sha256.txt, verify the sha256 against the published value, unzip into ~/.maestro, run ~/.maestro/bin/maestro --version with MAESTRO_CLI_NO_ANALYTICS=true; no shell-profile edit | coder-execution | implementation/62_maestro_install.md (Tier 3) | 25 | The computed sha256 equals the published checksum (both quoted); maestro --version prints 2.11.0; `test ! -e ~/.zshrc` exits 0 (AC-10 still PASS); rollback `rm -rf ~/.maestro` recorded | implementation |
| 91 | [MOBILE, APPROVED D38; conditional; W-02 owner] (05 §9 and P6) Close the simulator API gaps logged by the mobile screen steps 75–89 as SIM-GAP-n: add each missing selector or action with tests in packages/shared/src/sim, then remove each mobile feature's temporary sim-adapter; runs after step 54 so only one step writes the simulator at a time. If no mobile screen log lists a gap, the controller records SKIPPED instead of delegating | coder-execution | implementation/63_sim_gap_closure_mobile.md (Tier 3) | 54, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89 | `grep -rn SIM-GAP- apps/mobile/src` finds nothing; shared, core-web and mobile typecheck and test exit 0 (or SKIPPED recorded with evidence) | implementation |

### Status note (history kept outside the table)

- **Delivered outside the table** (controller-delegated, no row numbers):
  - `research/04_ui_design_analysis.md` (image-analyst).
  - `masterplan/03_motion_spec.md`, `masterplan/04_mobile_specs.md` and `masterplan/05_mobile_plan.md` (data-analyst).
- **Counts**:
  - 16 DONE (1–10, 12–16, 55).
  - 2 IN PROGRESS (17, 18).
  - 1 DROPPED (11).
  - 5 MERGED (20–24).
  - 3 PENDING, pre-approved (19, 25, 26).
  - 35 web, approved D38 (27–54, 56, 58, 60, 61, 62, 64, 66).
  - 29 mobile, approved D38 (57, 59, 63, 65, 67–91).
  - Total: 91.
- **Conditional steps**: 54 and 91 (gap closures). The controller records SKIPPED with evidence when no gap is logged, and dependent steps treat SKIPPED as satisfied. Step 90 is no longer conditional (Q-M2 yes, D38).
- **05_mobile_plan mapping**: see the Refinement Log.

## Parallel Execution Protocol (D34, D35, 05 §5): paste into every delegation of steps 25–91

**Limits** (D34, this task only):
- At most **6 agents of one type** and **8 in flight** in total.
- Default split: 3 web and 3 mobile `coder-execution` slots. The controller lends idle slots across lanes, up to 6 coders.

**The rules, numbered P1–P12:**

1. **P1 npm slot.**
   - Only steps 27 and 67 run `npm install` or `npm uninstall`, or edit a `package.json` or `package-lock.json`.
   - Each runs under `/usr/bin/lockf -k -t 3600 .locks/npm.lock <command>`, with 27 first.
   - Other steps keep working. A typecheck, test, Metro or Vite failure that happens during an install window is re-run after the lock is released (P11).
   - A missing package in any other step means `needs-review`; the controller schedules one extra serial npm slot (MINOR).
2. **P2 Gradle.**
   - Every `expo prebuild`, Gradle, `expo run:android` or `npm run build -w @dems/mobile` command runs under `/usr/bin/lockf -k -t 3600 .locks/gradle.lock <command>`.
   - Native rebuilds happen only in steps 67 and 72, plus step 61 (AC-28) and step 59 if a rebuild is needed.
   - `flock` is not installed; do not install it.
3. **P3 Emulators.**
   - **Fixed ports and serials**: `dems_phone` boots with `-port 5554` (serial emulator-5554) and `dems_tablet` with `-port 5556` (serial emulator-5556). Always use `adb -s <serial>`.
   - **Session-scoped**:
     - Step 67 boots both outside the sandbox with `-no-metrics -gpu host -no-boot-anim -no-snapshot-save` and writes their PIDs to `.locks/dems_phone.pid` and `.locks/dems_tablet.pid`.
     - A later step that finds one down reboots it the same way while holding that AVD's lock.
     - No build step stops an emulator. Step 61 stops both before its AC-07 cold boots. This is the one recorded exception to D35 rule 6.
   - **Device sessions**:
     - Use `apps/mobile/scripts/device-session.sh <avd> '<commands>'` (from step 67), or `/usr/bin/lockf -k -t 1800 .locks/dems_<avd>.lock sh -c '<commands>'` before step 67 lands.
     - A session lasts at most 30 minutes. Code changes happen outside the lock.
     - Lock phone before tablet. Only steps 57 and 59 hold both locks.
   - **Inside a session**:
     - `adb -s <serial> reverse tcp:8081 tcp:<your Metro port>` and `tcp:4400 tcp:4400`.
     - Start Metro only inside the session.
     - JS-only steps reuse the installed debug build and open screens by deep link (`am start -W -a android.intent.action.VIEW -d "demsdemo:///…" com.dems.demo.tablet`).
     - Screencaps go to `docs/…/implementation/assets/mobile/<step>_<avd>_<name>.png`.
   - **Before step 67 reinstalls**, steps 68 and 71 work JS-only (jest). Their device smoke waits until step 67's log reports the reinstall.
4. **P4 Ports.**

   | Who | Vite | Metro (host side) |
   |---|---|---|
   | Web coders A / B / C | 5174 / 5175 / 5176 | none |
   | Mobile coders A / B / C | none | 8081 / 8082 / 8083 |
   | Lent 4th and 5th mobile coders (wave W8 only) | none | 8084 / 8085 |
   | Step 90 | none | 8084 |
   | Step 57 | none | 8085 |
   | Step 59 | none | 8086 |
   | Checkpoints 45, 58 and step 61 | 5173 | 8081 for step 61 (all lanes idle by then) |
   | Spare | 5177–5178 | none |

   - The device side always stays on 8081 (H-MB-09). The fallback is one shared Metro on 8081, used under the AVD lock.
   - On Vite ports other than 5173 the Core link shows offline (mock-core CORS, AC-37). Seed `sessionStorage` `dems.auth` instead of signing in, and never edit mock-core.
5. **P5 mock-core (port 4400) is a shared service.**
   - **Start**: under `/usr/bin/lockf -k .locks/mock-core.lock`, if 4400 is not listening, start it and write its PID to `.locks/mock-core.pid`. Then `mkdir -p .locks/mock-core.users` and `touch .locks/mock-core.users/step-<N>`.
   - **Release**: under the same lock, remove your entry. If the directory is now empty, stop the recorded PID.
   - **Checks that stop mock-core** (AC-42 in step 61; MA-10 in steps 59 and 73) run only while their own entry is the only one.
6. **P6 Write paths.**
   - Write only the paths named in your step.
   - **Web**: shell and routes (38) come before pages. Pages write only their feature folder, their shared i18n namespace file and their own tests.
   - **Mobile**: never write `packages/shared/**`, `apps/core-web/**`, `apps/mock-core/**`, the root `package.json`, `README.md` or `THIRD_PARTY_NOTICES.md`. Ownership hand-overs:

     | Path | Owners, in order |
     |---|---|
     | `apps/mobile/package.json` | 67 only |
     | `app.json` | 67 (plugins), then 72 (icon and splash keys) |
     | `src/app/_layout.tsx` | 68, then 70 |
     | `src/app/**` | 70 (71 creates `dev-gallery.tsx` once) |
     | `src/runtime/index.ts` | 68 (stub), then 73 |
     | `src/providers/app-providers.tsx` | 68, then 73 |
     | `src/i18n/index.ts` | 68, then 73 |
     | `src/i18n/features.ts` | 70 |
     | `src/features/<folder>/**` | the screen step for that folder only, including its `i18n.ts` |

   - **Simulator**: `packages/shared/src/sim` is written only by the W-02 owner steps 31, 32, 54 and 91, one at a time. Page and screen steps log `SIM-GAP-<n>` with a local `sim-adapter.ts` in their feature folder instead.
7. **P7 Processes.** Record every PID you start and stop it before you return (emulators excepted, P3). Never stop a process you did not start. Remove only your own `adb reverse` rules.
8. **P8 Progress files.** Write `delegation_progress/<agent_name>_step_<N>.md`, never a shared or per-type file.
9. **P9 Load** (10 cores, 24 GB):
   - Run vitest and jest with `--maxWorkers=2`.
   - Only steps 38, 58 and 61 run `vite build`, never at the same time.
   - At most two Metro processes run at once, one per AVD session. One Gradle build at a time.
   - Build steps verify with typecheck, lint and their own tests, plus the device smoke for mobile steps.
10. **P10 Sandbox.** Port binding, the emulator, `adb` and Gradle need a per-command sandbox bypass (D14, D24). Step 90 also needs approval for its host write.
11. **P11 Noise.** If a typecheck or test fails only in files owned by a step running at the same time, during an install window, or on a `tsbuildinfo` read, re-run it after the cause ends and record both runs.
12. **P12 Gaps and native needs.** A screen or page step that needs a new native module, a new package or a shared-contract change returns `needs-review` with the request. It never works around the rules.

### Combined waves and collision scan (after the combined gate)

| Wave | Web lane | Mobile lane | Other agents | coder-execution | In flight (max) | Serial resources and notes |
|---|---|---|---|---|---|---|
| Now (D27) | 17, then 18 | none | none | 1 | 1 | Already running |
| Pre-gate (D1) | 19 | none | 26 (verifier) | 1 | 2 | Step 26 is read-only. Step 19 owns every process |
| **Gate** | APPROVED (D38) | APPROVED (D38) | none | 0 | 0 | none |
| W1 | 25 | none | git-specialist | 0 | 1 | Git-ignores .locks/ |
| W2 | 27 (npm), 29, 30 | 68, 71; then 67 (npm after 27; Gradle; boots both AVDs), 69 (after 30), 90 (Maestro install) | 28 (image-specialist) | 6 | 7 | npm.lock: 27, then 67. gradle.lock: 67 |
| W3 | A: 31, then 32. B: 36, 37, 39. C: 34, 35, 38, 33 | 67 (finishing), 69, then 70 | none | 6 | 6 | Shared-lane noise handled by P11. 72 waits for 28, 29, 35 and 67 |
| W4 | 41, 42, 44 | 70, 72 (Gradle), 73 (after 32, 33, 34) | 40 (senior-code-reviewer, CP-1) | 6 | 7 | gradle.lock: 72 |
| W5 | 43, 46, 47 | 75, 77, 79 | 45 (verifier, CP-2, Vite 5173); 74 (senior-code-reviewer, CP-M1) | 6 | **8 (peak)** | 3 mobile coders share 2 AVD locks. Step 45 gates 48–53; step 74 gates 76, 78, 80–89 |
| W6 | 48, 49, 50 | 76, 78, 80 | none | 6 | 6 | AVD locks |
| W7 | 51, 52, 53 | 81, 82, 83 | none | 6 | 6 | AVD locks |
| W8 | 54 (conditional) | 84, 85, 86, 87, 88, 89 (up to 5 at once in lent slots) | none | 6 | 6 | Lent lanes on Metro 8084 and 8085. 5 coders share 2 AVDs through the locks |
| W9 | 56 | 91 (conditional; after 54) | test-expert | 1 | 2 | One simulator writer (91 after 54) |
| W10 | 58 (Vite 5173) | 57 (both AVDs, Metro 8085) | verifier, test-expert | 0 | 2 | mock-core shared (P5) |
| W11 | 60 (README) | 59 (both AVDs, Metro 8086) | verifier | 1 | 2 | MA-10 only as mock-core's sole user. Step 60 starts no servers |
| W12 | 61, 62, 64 | 63, 65 | verifier, security-review ×2, senior-code-reviewer ×2 | 0 | 5 | Step 61 stops the session emulators, then cold-boots. 62–65 are read-only and take dependency readings after 61 passes the README Install section |
| W13 | 66 | (covered by 66) | git-specialist | 0 | 1 | One combined commit |

**Single-writer scan** (combined; extends 05 §4.3):

| Shared path | Writers, in order |
|---|---|
| `package-lock.json` | 27, then 67 (npm.lock) |
| `packages/shared/package.json` | 27 |
| `apps/mobile/package.json` | 67 |
| `packages/shared/src/sim/**` | 31, 32, 54, 91, all sequential |
| `packages/shared/src/brand/**` | 35 |
| `packages/shared/assets/**` | 28 (brand), 29 (hero) |
| `packages/shared/src/i18n/**` | 34, then one web page step per namespace file |
| `packages/shared/src/realtime/format.ts` | 34 |
| `THIRD_PARTY_NOTICES.md` | 29, then 37 |
| `README.md` | 60 |
| Git index | 25, then 66 |
| `apps/mobile/android/` (generated) | 67, 72, 59 or 61 if rebuilding (gradle.lock) |
| `apps/mobile` hand-over files | See P6 |

**Limit check:**
- `coder-execution` never exceeds 6.
- Every other type stays at 2 or fewer (senior-code-reviewer ×2 and security-review ×2 only in W12).
- Peak in flight is 8 (W5). Waves after the gate: 13 (W1–W13).

### Fallback DAGs (history only: D38 approved both lanes)

These applied only if part of the combined gate had been declined. They stay here for traceability. A later partial cancellation would reuse them.

- **Web-only** (mobile part of the gate declined):
  - Steps 57, 59, 63, 65 and 67–91 are not delegated. Step 55 is closed as design only.
  - The SCR additions in steps 27–35 are still built; they are small and keep the shared contract ready for mobile.
  - Step 60 depends on 56 only.
  - Step 61 depends on 58 and 60.
  - Step 66 depends on 61, 62 and 64.
- **Mobile-only** (web part declined, mobile approved):
  - Steps 27–35 still run as the shared prerequisites (the SCR owners).
  - Steps 36–54, 56 and 58 are not delegated.
  - Step 91 depends on 75–89 only.
  - Step 57 feeds 60. Steps 61, 62 and 64 run with stack scope, followed by 66.
- **Stack-only** (both declined):
  - Steps 27–54, 57–59, 63, 65 and 67–91 are not delegated.
  - Step 56 runs after 25 with stack scope.
  - Step 60 writes the 8 stack sections.
  - Steps 61, 62 and 64 run with stack scope, then 66.

### Checkpoints and feedback loop

- **Checkpoints** (`checkpoint-resume`): after 19 ∥ 26, after 25, after 32, after 40, after 45, after 74, after 54, after 91, after 59, and after 66.
- **Feedback loop**
  - A failed Verification cell goes back to the same agent with (a) the failing check, (b) the artifact to rework and (c) the expected correction. The check is then re-run.
  - Findings from steps 26, 40, 45, 58, 59, 61 and 74 go to the owning step's agent, which the finding names. The checkpoint is re-run afterwards.
  - Any code change made after steps 62–65 have started triggers a delta re-check of the changed files by the same reviewer before step 66.

## Dependencies

- **Combined gate (D22 + D33): APPROVED (D38).** Step 25 and every web and mobile step can be delegated once their Depends On clear. Q-M2 = yes (step 90 runs). Q-M3 = yes (step 75 enrols PIN and fingerprint).
- **Rows 17 and 18 complete** before steps 19 and 26.
- **Controller records in `decisions/decisions.md`**:
  - D37 (Q-M7 yes) and D38 (combined gate approved; Q-M1..Q-M8 as recommended; D28 defaults). Neither is on disk yet.
  - The four process items from the gate section's scope check: step 74, step 91, the AC-67 path, and the emulator exception.
  - The SCR folding into steps 27–35.
  - The AC-67 path change to `packages/shared/assets/hero/` (spec wording to update).
  - The D35 mechanics as in P1–P12: `lockf`; fixed AVD ports; session-scoped emulators as the exception to D35 rule 6; the Metro lanes; mock-core reference counting.
  - The combined commit decision.
  - This B.9 classification.
- **Sandbox bypass approvals**: steps 19, 45, 58, 59, 61, and every mobile step with a device session (67–89). Plus step 90's host write (`~/.maestro`).
- **Internet**: step 27 (npm), step 29 (stock photo), step 67 (npm; Gradle cache warm from row 18), step 90 (Maestro zip), step 62 (`npm audit`).
- **Browser**: steps 45 and 58 (agent-browser first).
- **Git identity** for steps 25 and 66 (R11).
- **Controller-owned artifacts, not rows**: `gateway_check/01_gate_report.md`, `status_tasks.md`, `delegation_progress_report.md`, `report/report.md`.

## Verification & Testing Strategy

- **Unit testing.**
  - Web and shared: tokens (30), auth and store (31), seven simulator tests (32), OpenAPI (33), i18n and formatDate (34), brand sync (35), compositions (39), one test per web page.
  - Mobile: T-M01..T-M15 spread over steps 68–89, each with a device smoke on both AVDs.
  - Test-expert halves: 56 (stack and web) and 57 (mobile, with the 4 Maestro flows on both AVDs; Q-M2 approved, D38).
- **Integration testing.**
  - Row 19: all three runtimes.
  - Step 58: web flows (AC-62, AC-63).
  - Step 59: mobile flows on both AVDs (MA-29, MA-30).
  - Step 61: AC-41 after both lanes.
- **Functional testing and UAT.** Steps 58 and 59 run the simulator scenarios on the canonical dataset.
- **Security testing.** Step 62 (host, stack and web) and step 63 (mobile).
- **Performance testing.**
  - Web: AC-71 (steps 45 and 58); AC-73 (step 58).
  - Mobile: MA-17 (steps 79 and 59, informational).
  - Emulator jank baseline: step 61.
- **Code quality.** Typecheck and lint in every step; CP-1 (40), CP-M1 (74); steps 64 and 65.
- **Rollback and recovery.**
  - Host rollbacks are documented verbatim in 02_plan §3 and §12. Step 90's rollback is `rm -rf ~/.maestro` (05 §13).
  - Workspace: `git reset` or path checkout to the step-25 commit, only on explicit request.
- **Acceptance criteria.**
  - AC-01..AC-75, MS-01..MS-10 and MA-01..MA-30 PASS, or CAUTION acknowledged.
  - Both security verdicts PASS, or CAUTION acknowledged.
  - Zero open blocker findings.
  - Commit from step 66 present.

## Risk Assessment

| ID | Risk | Likelihood | Impact | Mitigation | Owner step |
|---|---|---|---|---|---|
| R3 | Emulator smoothness does not reflect a physical device | High | Misleading judgement | MA-17 and jank recorded as informational; physical device recommended | 59, 61 |
| R7 | Duplicate React or zustand copies | Low–Medium | Runtime errors | Checks in 26, 27, 64, 65 and MA-01 | 26, 27, 59 |
| R9 | Confidentiality leak | Low | High | No remote; .docx ignored; `docs/` tracked locally, so any future remote needs a review; generic queries only | 25, 62, 63 |
| R11 | No git identity | Unknown | Steps 25 and 66 blocked | Return `needs-review` | 25, 66 |
| R13 | Many sandbox-bypass prompts (mobile device sessions in every M-step) | High | Slower run | Device sessions batched per step; the user may choose `sandbox.network.allowLocalBinding` (S16-7) | 45, 58, 59, 61, 67–89 |
| R14 | Scalar ignores `customFetch` (H-S17) | Low–Medium | Simulated try-it fails | 01_specs §10 fallback | 53 |
| R15 | Emblem flight cannot cross routes (H-M1) | Medium | Hand-off jumps | Two-phase fallback | 41, 58 |
| R16 | No qualifying hero photo, or unclear licence (H-S19) | Low | Asset gap in both apps | Pexels or Unsplash only; procedural fallback | 29 |
| R17 | Scalar bundle size | Medium | Slow first load | Lazy chunk (AC-73) | 53, 58 |
| R18 | Web frame rate under all animations (H-S18) | Medium | Demo jank | §9 caps; 12.5 fps fallback; early read in step 45 | 39, 45, 58 |
| R19 | Simulator API churn across two lanes | Medium | Rework | SCR-01 and SCR-02 built into 31 and 32; CP-1 and CP-M1 map needs first; SIM-GAP adapters; steps 54 and 91 | 31, 32, 40, 74 |
| R20 | Typecheck and test noise across 6 coders | Medium–High | False failures | P11 | W2–W8 |
| R21 | A Large step exceeds one agent context (32, 39, 44, 47, 53, 70, 71, 79, 83) | Medium | Partial returns | `checkpoint-resume`; split by panel (MINOR) | same |
| R22 | Mobile regresses through `packages/shared` | Medium | Mobile bundle breaks | sim-platform-neutral test (32); subpath only; CP-M1; step 61 re-proves | 32, 74, 61 |
| R25 | CPU and RAM saturation: 6 coders, 2 AVDs (7 GB), Gradle, up to 3 Vite and 2 Metro on 10 cores / 24 GB | Medium | Timeouts, emulator ANRs | P2, P3, P9 | all |
| R26 | Two coders wait on the same AVD lock | High in W5–W8 | Slower mobile waves | Sessions of 30 minutes or less; code outside the lock; JS work while waiting | 75–89 |
| R27 | A shared mock-core is stopped mid-check | Medium without P5 | Heartbeat lost | P5 reference counting; stopping checks run only as the sole user | 59, 61, 73 |
| R31 | The lane-port reverse fails (H-MB-09) | Low–Medium | Only one Metro, so mobile lanes serialise on devices | Fallback: one Metro on 8081 under the AVD lock | 67 |
| R32 | Biometric enrolment fails on `pixel_tablet` (H-MB-04) | Medium | MA-07 only on the phone | Hide the button on that AVD and record it | 75 |
| R33 | Two independent simulators confuse a two-screen demo (G-M15) | Medium | Demo narrative | Q-M4 accepted; presenter note in the README (step 60) | 60 |
| R34 | Maestro host install side effects | Low | Host clutter | Pinned zip, checksum, no profile edit, rollback | 90 |
| R35 | Skia and Reanimated cost on the emulator | Medium | Janky mobile monitor | Canvas caps, 12.5 fps grain, pause when unfocused (04_mobile_specs §7.8) | 71, 79 |
| R36 | The PNG export tool is unproven (qlmanage renders SVG; hypothesis) | Medium | No icon PNGs | Headless-browser render fallback | 28 |

- **Closed**: R1, R2, R5, R6. R4 is mostly spent.
- **Caveats**: effort sizing is relative (02_plan §4.2, 05 §7). No time estimates are given. The H-S, H-M and H-MB hypotheses stay open until their owner steps settle them.

## Combined Approval Gate (D22 + D33) — APPROVED D38

The user approved both lanes with every recommendation (D38). This section records what was approved; nothing here is open.

**Web scope** (steps 27–54 and the web halves of the end pass):
- **The Core console, 10 pages**: Login, Dashboard, Session Monitor, Evidence (list, detail and export wizard), Devices & Inputs, Storage, Network & Time, Security & Audit, System & Maintenance (with the Demo Control Panel), and API Reference (Scalar, with simulated try-it). Plus the 3-step Start New Session flow.
- **The in-browser simulator**, shared with mobile.
- **The "Gilded Calm" motion system.**
- **Brand assets and one licensed hero photo**, or a procedural fallback.

**Mobile scope** (steps 67–91 and the mobile halves of the end pass):
- **All 10 designer screens** on phone portrait, plus tablet multi-pane layouts: a rail instead of bottom tabs, list/detail for Evidence, Devices and Settings, and a three-column Session Monitor. Orientation is unlocked on both AVDs.
- **Derived screens**: Pairing, the pre-recording gate, Ready/Armed, Finalization, Session Summary, Recovery, the Sessions hub, More, Operator Audit, and the Settings sections.
- **Shared foundations**: the same shared simulator and translations. Biometric sign-in. Motion on Reanimated and Skia.

**Shared prerequisites** (steps 27–35): they serve both apps, including the 7 shared-contract additions the mobile app asked for (Q-M7, already approved).

**Size and shape**
- 91 steps in total. 67 remain to be delegated: 35 web and 29 mobile (all approved in D38), plus 19, 25 and 26 (pre-approved). Two of them are conditional gap closures: 54 and 91.
- 13 waves after the gate.
- Up to 6 coders at once (3 web, 3 mobile) and **at most 8 agents in flight** (wave W5).

| Wave | Max agents in flight |
|---|---|
| W1 | 1 |
| W2 | 7 |
| W3 | 6 |
| W4 | 7 |
| W5 | 8 |
| W6 | 6 |
| W7 | 6 |
| W8 | 6 |
| W9 | 2 |
| W10 | 2 |
| W11 | 2 |
| W12 | 5 |
| W13 | 1 |

- One combined verification pass with web and mobile halves side by side, then **one** final local commit.
- Now: rows 17–18 finish, then steps 19 and 26 run. Next: step 25, the baseline commit, then W2.

**Mobile decisions** (05 §14; decided in D38):

| # | Question | Decision (D38) | Where it lands |
|---|---|---|---|
| Q-M1 | Install up to 6 additive packages (zustand, i18next, react-i18next, expo-local-authentication, AsyncStorage 2.2.0, react-native-keyboard-controller 1.21.9), only those row 18 has not installed, in one lockfile slot with one native rebuild | **Yes** | Step 67 |
| Q-M2 | Maestro end-to-end tests through the pinned zip into `~/.maestro`, analytics off, no shell-profile change | **Yes** | Steps 90, 67 (e2e script), 57 (flows, MA-27), 63 (footprint review) |
| Q-M3 | Biometric demo: PIN 1234 and a virtual fingerprint on both AVDs | **Yes** | Step 75 (MA-07) |
| Q-M4 | Web and mobile each run their own simulator | **Accepted** | Presenter note in step 60 |
| Q-M5 | The label is "End Session" instead of the mockup's "Stop Session" | **"End Session" on web and mobile** | Steps 44 and 79 |
| Q-M6 | Interpretations of the unexplained mockup icons (history → timeline; download → last profile; list → sort) | **Accepted** as hypotheses | Steps 78, 79, 83 |
| Q-M7 | Route the 7 shared-contract requests into the shared web steps | **Yes** (controller, D37) | Steps 27–35 |
| Q-M8 | Default Core link source is Simulated; heartbeat mode is a switch in Settings | **Yes** | Steps 73 and 88 |

**Web defaults** (D28). Accepted in D38:
- The storage ring shows **used %**: 20%, "3.2 TB free of 4.0 TB".
- One time zone: **UTC+07:00 (WIB)**.
- **English UI** with Indonesian terms kept (Tersangka / Saksi / Lainnya, AKP, LP/, "SEDANG MEREKAM").
- **One canonical demo dataset.**
- "Pause Monitoring" is **UI-only**.
- **Dark text on gold buttons.**
- **Violet** "Sealed".
- **Warm surfaces** with an inset active menu item.
- API Reference in a **DEVELOPER** sidebar group.
- **3 synthetic operators**, hidden in presentation mode. Demo password `demo-2026`.
- A simulated **"Use security key"**.
- The mobile officer photo is **not reused**.
- `docs/` is **tracked in the local commits** (D5; no remote).

**Top risks, both lanes**

| Risk | Fallback |
|---|---|
| Scalar try-it (H-S17) | A "Simulated try" panel |
| Login-to-shell logo flight (H-M1) | Two-phase flight with the same start and end positions |
| Hero photo licence (H-S19) | Pexels or Unsplash with the licence recorded, or a procedural room |
| Machine load (6 coders and 2 emulators on 10 cores / 24 GB) | Locks, lanes, at most 2 Metro, one native build at a time |
| Emulator queueing in the mobile screen waves | 30-minute device sessions; code outside the lock |
| One Metro per lane unproven (H-MB-09) | One shared Metro |
| Biometric on the tablet image (H-MB-04) | Hide the button there |
| Two separate simulators in a two-screen demo (Q-M4) | Presenter note in the README |
| Emulator performance is not a real device | Figures are informational; a physical-device check is recommended |
| Many permission prompts for devices and servers | The user may choose `sandbox.network.allowLocalBinding` |

**Decision (D38)**: both lanes approved as presented, with every recommendation accepted.

**Scope check against D38**: no product scope is added beyond what was approved. The merge made these process-level choices; the controller should record them or reject them:
- **Mobile foundation checkpoint (step 74).** A read-only review in parallel with the first mobile screens. It gates the remaining screens. Dropping it is MINOR: remove it from the Depends On of steps 76, 78 and 80–89.
- **Mobile SIM-gap closure (step 91).** A conditional W-02-owner step, per 05 §9 and §10 "W-02b batch". It is skipped when no gap is logged.
- **AC-67 checked at `packages/shared/assets/hero/`.** This follows from SCR-04 (Q-M7). The spec wording needs a MINOR update.
- **Emulators are session-scoped.** Step 67 boots them and step 61 stops them. This is an exception to D35 rule 6.

## Recommendation & Next-Plan Summary

### Key Findings Summary

| # | Finding | Confidence | Evidence Source | Implication |
|---|---|---|---|---|
| 1 | The mobile auth audit rows (SCR-02 biometric) need the hash chain, so the events module moves from the engine step to the contract step | High | 01_specs §14.7 (events.ts); 04 §13 SCR-02 | Step 31 builds events and auth; step 32 keeps the tamper test (AC-55) |
| 2 | Five 05 rows bundle independent screens (M-02, M-07, M-11, M-14, M-15) | High | 05 §3 owned paths list several feature folders | Split by folder into steps 68/69, 75/76, 80/81/82, 85/86 and 87/88/89 (V4) |
| 3 | Parallel mobile screens would all edit one i18n file | High | 04 §9 (`en.mobile.ts`); 05 §3 M-02 | A per-feature `i18n.ts` registered by step 70 |
| 4 | 05's verification and test file names collide with this blueprint | High | 05 L28; this file's `verification/07_visual_checkpoint.md` | The blueprint's names are kept; mapping recorded |
| 5 | Steps 68 and 71 would device-smoke a binary without the step-67 native modules | Medium | 05 §4.1 wave 1 runs M-01, M-02 and M-04 together | Their device smoke waits for step 67's reinstall (P3) |
| 6 | MA-10 and AC-42 stop mock-core while another lane may be using it | High | 04 §11 MA-10; 01_specs AC-42 | P5: checks that stop mock-core run only as its sole user |
| 7 | Per-lane commits would record trees that were never verified as a whole | Medium (design judgement) | Step 91 writes shared sim after web steps finish | One combined commit (step 66) |
| 8 | The hero master moves to a shared path, which changes AC-67's check path | High | 04 §13 SCR-04; 01_specs AC-67 | The controller records it; the spec wording fix is MINOR |

### Priority Recommendations

| Priority | Recommendation | Rationale | Risk if Ignored | Target Phase/Task |
|---|---|---|---|---|
| P0 | Run steps 19 and 26 as soon as rows 17–18 are done | Gate approved (D38); they are the last pre-build checks | Idle critical path | 19, 26 |
| P0 | Record D37, D38, the SCR folding, the P1–P12 mechanics, the combined commit, the AC-67 path and the four process items from the gate section's scope check | Every delegation pastes the protocol | Collisions; lost audit trail | decisions.md |
| P0 | Run step 25, then launch W2 in one message | Rollback point, then both lanes start | Late start | 25, W2 |
| P1 | Correct 01_specs AC-01, AC-04, AC-11 (D29) and AC-67 (path) (MINOR), or let steps 61 and 29 apply them | Spec matches reality | False FAIL | 29, 61 |
| P1 | Offer the user `sandbox.network.allowLocalBinding` (S16-7); the user's choice only | Mobile device sessions in 23 steps | Many prompts | Before W2 |
| P2 | Physical tablet and phone check before the demo | The emulator is not representative | Surprises at demo time | After 66 |

### Pending Decisions for Human-in-Loop

| # | Decision Required | Options | Recommended Option | Impact |
|---|---|---|---|---|
| 1 | Git identity (only if none is configured when step 25 runs) | Existing / user-supplied | Existing | Unblocks steps 25 and 66 |

The combined gate, Q-M1..Q-M8 and the D28 defaults are decided (D37, D38) and are no longer pending.

### Next-Plan Recommendations

- **Immediate next step**: when rows 17–18 report complete, launch steps 19 and 26 together.
- **Subsequent tasks**:
  - Step 25, then W2–W13 as tabled (gate approved, D38).
  - Then `report/report.md`.
- **Parallelizable work**: see the combined waves table. Peak 8.
- **Cross-task continuity**:
  - A physical-device check.
  - The id locale (A10).
  - A mock-core relay for one shared live session (G-M15), if wanted later.
  - Findings from steps 64 and 65.

## Agent Mapping Rationale

- **document-reader** (row 1): local-only parsing of the confidential `.docx` (I2).
- **data-collector** (row 2): external evidence with generic queries.
- **data-analyst** (rows 3–5; motion spec; mobile spec and plan): synthesis, spec and plan.
- **task-architect** (rows 6, 55): design only.
- **git-specialist** (rows 7, 25; step 66): repository, `.gitignore` and local commits. No remote.
- **coder-execution** (rows 8–19; steps 27, 29–39, 41–44, 46–54, 60, 67–73, 75–91): every build step in both lanes, plus the README and the optional Maestro install. Its unrestricted tool set covers builds, `adb`, `sips` and the photo search.
- **image-specialist** (step 28): SVG brand mark and PNG exports. Image work only.
- **verifier** (row 13; steps 26, 45, 58, 59, 61): independent checks. The web (58) and mobile (59) halves run in parallel. The stack check (61) runs last because it stops mock-core and the emulators.
- **test-expert** (steps 56, 57): the web and stack half and the mobile half, on disjoint test files.
- **security-review** (steps 62, 63): host, stack and web half, and mobile half.
- **senior-code-reviewer** (steps 40, 74, 64, 65): the two foundation checkpoints, then the two review halves.
- **Deliberately not used**:
  - `explore`: the code is fully specified, and Graft is available.
  - `docker-specialist`, `database-specialist`: not needed.
  - `design-system-specialist`: builds document design systems.
  - `image-prompt-specialist`: no generative images (D28).

## Refinement Log (row 6)

Classification under master-controller B.9: **MAJOR overall.**
- Rev 2 MAJOR entries: RL-05 (part), RL-10 (part), RL-12, RL-13, RL-15, RL-35, RL-37.
- Rev 3 MAJOR entry: RL-41.
- Everything else is MINOR.

| # | Change | Rows / steps | Class | Reason |
|---|---|---|---|---|
| RL-01 | Status tags on every finished, dropped and merged row. Outputs set to the files that exist (row 10 is now `initialization/05_avds.md`) | 1–18 | MINOR | Actuals |
| RL-02 | Depends On matches what actually ran: row 8 now depends on 3 (D21); row 12 on 9 (row 11 dropped) | 8, 12 | MINOR | Dependencies updated; sequencing approved (D21, D27) |
| RL-03 | `~/.zshrc` replaced by marked blocks in `~/.zprofile` with a timestamped backup | 8, 9 | MINOR | D11 |
| RL-04 | NDK, CMake and `android --no-metrics` | 9 | MINOR | D13, D23, D29 |
| RL-05 | Two AVDs, orientation unlocked | 10 | MAJOR (D15–D20 bundle, D22); already answered (D17) and executed | D17, D23 |
| RL-06 | Row 11 dropped | 11 | MINOR | D12 |
| RL-07 | Row 12 reduced to a check | 12 | MINOR | D12 |
| RL-08 | Designer tokens; rev-3 values relayed | 15, 17 | MINOR | D16, D31 |
| RL-09 | HeroUI v3 and the three fonts | 17 | MINOR | D10, D16 |
| RL-10 | Row 18: responsive on both AVDs; full mobile dependency set | 18 | D17 part MAJOR (answered); D30 part MINOR | D17, D30 |
| RL-11 | Row 19 records the Metro bind address (AC-45) | 19 | MINOR | Verification detail |
| RL-12 | Rows 20–24 merged into one end-of-build pass (steps 56–65) | 20–24, 56–65 | MAJOR | Flow restructured (D32) |
| RL-13 | Row 25 moved before the builds; depends on 19 and 26; runs after the gate answer; D8 settled by D5; also git-ignores `.locks/` (D35) | 25 | MAJOR | Flow restructured; changes the position approved in D1 |
| RL-14 | New step 26: pre-baseline invariant gate | 26 | MINOR | Patch for Option C defect 1 |
| RL-15 | Web lane steps 27–54 added from 02_plan §4 | 27–54 | MAJOR | New scope (D15, D18, D25, D26); new modules; effort more than 30% (D22) |
| RL-16 | W-01 split into step 27 (manifests) and step 30 (token pipeline) | 27, 30 | MINOR | Atomicity; one lockfile writer (D35) |
| RL-17 | W-02 split into step 31 (contract) and step 32 (engine) | 31, 32 | MINOR | Shorter critical path for both lanes |
| RL-18 | W-03 split into step 33 (API contract) and step 34 (i18n) | 33, 34 | MINOR | Atomicity; disjoint i18n files |
| RL-19 | W-04 split into step 28 (image-specialist) and step 35 (coder-execution) | 28, 35 | MINOR | Agent corrected |
| RL-20 | W-07 split into step 36 (motion library) and step 41 (app-level and shell motion) | 36, 41 | MINOR | Atomicity |
| RL-21 | W-08 split into step 37 (copy-in items) and step 39 (compositions) | 37, 39 | MINOR | Atomicity; notices writers serialised |
| RL-22 | Step 38 writes the route files in final form | 38 | MINOR | Page steps never touch routes |
| RL-23 | Simulator exported only through `@dems/shared/sim`, with DOM access guarded | 31 | MINOR | Mobile safety |
| RL-24 | The W-02b rule becomes conditional step 54 (web gaps) | 54 | MINOR | One sim writer at a time |
| RL-25 | CP-1 (40) and CP-2 (45) added as parallel checkpoints. CP-2 does not wait for Login | 40, 45 | MINOR | Per-phase checkpoints |
| RL-26 | Session Monitor (44) starts alongside CP-1 | 44 | MINOR | Sequencing |
| RL-27 | End pass split into web-and-stack and mobile halves | 56–65 | MINOR | Controller item 5 |
| RL-28 | Run guide in parallel with both verifications; reviews in parallel with step 61 | 60, 62–65 | MINOR | Sequencing |
| RL-29 | Fallback DAGs | 55–66 | MINOR | Protects D1-approved SC1–SC7 |
| RL-30 | Step 28 checks favicon content | 28 | MINOR | Template favicon exists |
| RL-31 | Step 47 uses a fixture of at least 11 rows | 47 | MINOR | AC-64 |
| RL-32 | Step 61 applies the D29 wording to AC-01, AC-04 and AC-11 | 61 | MINOR | Spec predates D29 |
| RL-33 | Web implementation logs renumbered 08–34 | 25–66 | MINOR | Naming |
| RL-34 | Waves redesigned for D34 | Waves | MINOR | D34 |
| RL-35 | Mobile lane added as placeholder step 55 plus mobile halves 57, 59, 63 and 65 | 55, 57, 59, 63, 65 | MAJOR | New scope in this task (D33, D34; supersedes D20) |
| RL-36 | Parallel Execution Protocol P1–P11 added; corrects D35 mechanics. **The `shlock` and ANDROID_SERIAL-discovery parts are superseded by RL-52** | Protocol | MINOR | D35 |
| RL-37 | Concurrency changed to 6 per type and 8 in flight for this task | Waves | MAJOR | User decision D34 |
| RL-38 | Context sections, risks and recommendations updated; gate section added | Document | MINOR | Documentation |
| RL-39 | Frontmatter revision 2 | Document | MINOR | Metadata |
| RL-40 | Step 55 closed: the mobile lane is merged (this rev 3 pass) | 55 | MINOR | Design step done |
| RL-41 | Mobile build steps 67–91 added from 05 §3 M-01..M-15 and M-17, plus CP-M1 (74) and the conditional mobile gap closure (91) | 67–91 | MAJOR | New build scope in this task (D33, D34), inside the combined gate |
| RL-42 | 05 rows that bundle independent screens are split by feature folder: M-02 into 68 (foundation) and 69 (motion kit); M-07 into 75 (Login) and 76 (Pairing); M-11 into 80 (Finalization and Summary), 81 (Recovery) and 82 (Sessions hub); M-14 into 85 and 86; M-15 into 87, 88 and 89 | 68–89 | MINOR | Atomicity (V4); same owned paths as 05 |
| RL-43 | M-16, M-18, M-19, M-20, M-21 and M-22 mapped onto existing steps 57, 59, 63, 65, 60 and 66 | 57–66 | MINOR | One row per role half; one README writer; one git writer |
| RL-44 | One combined final commit (66) instead of per-lane commits | 66 | MINOR | Only the combined tree is ever verified; lanes can still be rolled back by path |
| RL-45 | CP-M1 (74) mobile foundation checkpoint added. It runs beside the first mobile screens (75, 77, 79) and gates the rest | 74 | MINOR | Per-phase checkpoint rule |
| RL-46 | Mobile SIM-gap closure (91) added as a conditional W-02 owner step, sequenced after 54 | 91 | MINOR | One simulator writer at a time (D35 rule 5) |
| RL-47 | SCR-01 and SCR-02 folded into steps 31 and 32. The events module (hash chain) moves into step 31 because auth audit rows, including BIOMETRIC, need it. New tests: sim-platform-neutral and sim-mobile-additions | 31, 32 | MINOR | Q-M7 yes (D37) |
| RL-48 | SCR-03 folded into step 28 (PNG exports to packages/shared/assets/brand) and step 35 (emblem.ts with a sync test). SCR-06 folded into step 35 (topo.ts). Step 35 now depends on 28 and is renamed "brand modules and topo" | 28, 35 | MINOR | Q-M7 yes |
| RL-49 | SCR-04 folded into step 29: hero master and mobile variant in packages/shared/assets/hero/; one notices entry naming both apps. AC-67 is checked at the shared path (spec wording to update) | 29 | MINOR | Q-M7 yes; spec deviation flagged |
| RL-50 | SCR-05 folded into step 34 (plain deep-mergeable `en`, gloss keys, arithmetic formatDate) and step 27 (exports ./i18n, ./brand, ./assets/*) | 27, 34 | MINOR | Q-M7 yes |
| RL-51 | SCR-07 folded into step 30 (motion tokens as plain numbers and spring objects). Step 30 now depends on 25, so it runs beside step 27 | 30 | MINOR | Q-M7 yes; shorter path |
| RL-52 | P3 rewritten from 05 §5: fixed AVD boot ports 5554 and 5556; lockf device sessions through device-session.sh; lock phone before tablet; session-scoped emulators booted by step 67 and stopped by step 61, a recorded exception to D35 rule 6 | Protocol | MINOR | Mechanics; supersedes RL-36 parts |
| RL-53 | P1 changed from a hard barrier to the single npm slot of 05 §5.1 (27, then 67), with a re-run rule for failures during an install window | Protocol | MINOR | More parallelism; aligns with 05 §4.1 |
| RL-54 | P4 Metro lanes adopted from 05 §5.3 (8081–8086), replacing rev 2's split. Vite unchanged (5173 reserved for verification) | Protocol | MINOR | 05 §5.3 |
| RL-55 | P5 adds that checks stopping mock-core (AC-42, MA-10) run only as its sole user | Protocol | MINOR | Collision found between steps 58 and 59 |
| RL-56 | P6 adds mobile ownership hand-overs and per-feature mobile i18n files (68 registry, 70 registration, 73 shared merge) | Protocol | MINOR | Collision found among parallel screen steps |
| RL-57 | Step 69 (motion kit) hard-depends on step 30 instead of 05's soft dependency with fallback constants | 69 | MINOR | Step 30 is small and runs beside 27 |
| RL-58 | The device smokes of steps 68 and 71 wait for step 67's reinstall | 68, 71 | MINOR | Avoids testing a binary without the new native modules |
| RL-59 | Combined waves W1–W13, peak 8 (W5); end-pass halves paired | Waves | MINOR | D34 |
| RL-60 | Output names: mobile implementation logs 40–63 (renumbered from 05's 40–57 because of the splits); mobile test report `test/02_mobile_test_report.md` (05 said 03); mobile verification, security and review `verification/08`, `09`, `10` (05 said 07, 08, 09, which collided with this blueprint's 07); CP-M1 is `verification/11` | 57–91 | MINOR | Naming; collision avoided |
| RL-61 | "Second Approval Gate (D22)" replaced by the "Combined Approval Gate (D22 + D33)" | Document | MINOR | Documentation (controller item 5) |
| RL-62 | Fallback DAGs extended (web-only, mobile-only, stack-only) | Fallbacks | MINOR | Contingency |
| RL-63 | Frontmatter revision 3; `missing_inputs` removed | Document | MINOR | Metadata |
| RL-64 | D38 applied: the tags "D22-GATED" and "MOBILE-GATED" become "WEB, APPROVED D38" and "MOBILE, APPROVED D38". Decided answers are written into rows 57 (Maestro flows required, MA-27), 60 (presenter note), 63 (Maestro footprint), 67 (e2e script, MA-26), 73 and 88 (Simulated Core link), 75 (enrolment on both AVDs, MA-07) and 79 ("End Session" label). Step 90 is no longer conditional. The gate section is renamed "APPROVED D38" and lists the decisions. Pending decisions are reduced to the git identity. Fallback DAGs are kept as history. Status `approved_d38` | 25, 57, 60, 63, 67, 73, 75, 79, 88, 90; document | MINOR | Records the user's decision; no scope change |
| RL-65 | Scope check against D38: no product scope added. Process items flagged for the controller: step 74 (CP-M1), step 91, the AC-67 path, and session-scoped emulators | 29, 67, 74, 91 | MINOR | Controller instruction: flag, do not add |

**Mapping from 02_plan §4 and 05 §3 rows to steps and logs**

| Plan row | Step(s) | Output |
|---|---|---|
| W-01 | 27, 30 | implementation/08_web_dependencies.md; implementation/11_token_pipeline.md |
| W-02 | 31, 32 | implementation/12_sim_contract.md; implementation/13_sim_engine.md |
| W-03 | 33, 34 | implementation/14_api_contract.md; implementation/15_i18n_resources.md |
| W-04 | 28, 35 | implementation/09_brand_emblem.md; implementation/16_brand_modules_topo.md |
| W-05 | 29 | implementation/10_hero_asset.md |
| W-06 | 38 | implementation/19_app_shell.md |
| W-07 | 36, 41 | implementation/17_motion_library.md; implementation/21_shell_motion.md |
| W-08 | 37, 39 | implementation/18_copy_in_items.md; implementation/20_compositions.md |
| W-09..W-19 | 43, 42, 44, 46, 47, 48, 49, 50, 51, 52, 53 | implementation/22..32 as in the table |
| W-02b | 54 | implementation/33_sim_gap_closure_web.md |
| W-20 plus row 20 | 56 | test/01_test_report.md |
| W-21 | 58 | verification/04_web_verification.md |
| W-22 plus row 21 plus M-21 | 60 | /Users/gsp-budi/Documents/DEMS/README.md |
| Row 22 | 61 | verification/01_verification.md |
| W-23 plus rows 23, 24 | 62, 64 | verification/02_security.md; verification/03_code_review.md |
| W-24 plus M-22 | 66 | implementation/34_git_final_commit.md |
| M-01 | 67 | implementation/40_mobile_deps_native.md |
| M-02 | 68, 69 | implementation/41_mobile_foundation.md; implementation/42_mobile_motion_kit.md |
| M-03 | 70 | implementation/43_mobile_navigation_shell.md |
| M-04 | 71 | implementation/44_mobile_compositions.md |
| M-05 | 72 | implementation/45_mobile_brand_media.md |
| M-06 | 73 | implementation/46_mobile_runtime_sim.md |
| M-07 | 75, 76 | implementation/47_mobile_login.md; implementation/48_mobile_pairing.md |
| M-08 | 77 | implementation/49_mobile_home.md |
| M-09 | 78 | implementation/50_mobile_start_session.md |
| M-10 | 79 | implementation/51_mobile_session_live.md |
| M-11 | 80, 81, 82 | implementation/52_mobile_finalize_summary.md; 53_mobile_recovery.md; 54_mobile_sessions_hub.md |
| M-12 | 83 | implementation/55_mobile_evidence.md |
| M-13 | 84 | implementation/56_mobile_devices.md |
| M-14 | 85, 86 | implementation/57_mobile_storage.md; implementation/58_mobile_network_time.md |
| M-15 | 87, 88, 89 | implementation/59_mobile_audit.md; 60_mobile_settings.md; 61_mobile_more.md |
| M-16 | 57 | test/02_mobile_test_report.md |
| M-17 | 90 | implementation/62_maestro_install.md |
| M-18 | 59 | verification/08_mobile_verification.md |
| M-19 | 63 | verification/09_mobile_security.md |
| M-20 | 65 | verification/10_mobile_code_review.md |
| New | 26, 40, 45, 74, 91 | verification/05_pre_baseline_gate.md; 06_foundation_review.md; 07_visual_checkpoint.md; 11_mobile_foundation_review.md; implementation/63_sim_gap_closure_mobile.md |

---
*Generated: 2026-09-30 (revision 1; clock time not available to this agent)*
*Last Updated: 2026-10-01 (revision 3, step 55 mobile merge with D38 applied; clock time not available to this agent)*
