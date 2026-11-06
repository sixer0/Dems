---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-09-30
agent: task-architect
revision: 6  # rev 1 = first blueprint (D1); rev 2 = web lane (D36); rev 3 = mobile merge (D40); rev 4 = demo media and data (D50); rev 5 = release packaging (D94, accepted D97); rev 6 = packaging spec applied (D104), step 100 and history rows 101 = 45b, 102 = 67c, during live execution
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
  - decisions/decisions.md (D1-D94 on disk; rev 4 applied D39-D50; rev 5 applies D67, D71-D75, D78, D84, D87, D88, D90, D92, D93 and D94)
  - masterplan/06_packaging_spec.md (accepted D104; §2 APK, §3 web packager and step 100, §4 release folder, §5 step-96 plan, §6 row and review additions, §7.3 deviations)
  - decisions/decisions.md D95-D104 (rev 6)
  - research/01_explore.md (§11.1-§11.4, §12.2, §19.1-§19.2: evidence package, manifest fields, export package)
  - status_tasks.md
scale_category: new_project  # greenfield demo: stack setup, Core web build and mobile build (D15-D37)
professional_document: false  # D2: Output format A (markdown only)
b9_classification: MAJOR  # D22 (web scope), D32 (flow), D33/D34 (mobile build in this task, parallel lanes)
status: executing  # combined gate approved (D38); standing authorisation (D39); concurrency 12 per type / 16 in flight (D71, D72); rev 5 adds steps 94-96 (D94) and history rows 97-99; controller's status_tasks.md is authoritative for progress
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
  - **Standing authorisation (D39)**: the controller runs every remaining step without further gates and records each decision and each drift. Outward-facing actions stay excluded.
  - **Demo media and dummy evidence data (D50)**, added by the user ("dummy data files, video buatkan juga agar lebih complete"). This supersedes D31's "no video files":
    - Step 92 produces the generated demo videos (VIDEO-01 and VIDEO-02), the two separate interview audio tracks, loops, posters and a mobile subset.
    - Step 93 produces full evidence packages per design book §11.2–§11.4 and §19.2, with DEMO-key signatures and one tampered package.
    - The consumer steps switch from procedural media to real media, keeping a procedural fallback.
  - **Speed-up decisions (D71, D72, D75)**:
    - Concurrency raised to 12 per agent type and 16 in flight.
    - Reviews 40, 45 and 74 became parallel audits instead of gates.
    - The remaining page and screen steps run on a fast lane: typecheck, lint, own tests and one screenshot, with the deeper checks moved to the end pass.
  - **Release packaging (D94)**, added by the user ("jika sudah versi mobile di build jadi apk installer, dan versi web juga dibuat packagernya. buat semudah mungkin untuk di jalankan di pc lain"):
    - Step 94 builds a signed universal Android release APK that needs no Metro.
    - Step 95 builds double-click web launchers for macOS arm64 and x64, Windows x64 and Linux x64, serving the app and the Core endpoints from one local origin, plus a static zip.
    - Step 96 verifies both from a clean state.
    - Outputs go to the git-ignored `release/` folder.
  - **Packaging spec accepted (D104)**:
    - APK: three ABIs, Simulated-only (no cleartext; Heartbeat disabled in release by step 91), versionName 0.1.0 and versionCode 100, a DEMO keystore whose password file is git-ignored.
    - Web: Node SEA single executables for macOS arm64, Windows x64 and Linux x64; an Intel-Mac bundle on official Node; a Windows official-node fallback; an any-OS zip (replacing the static zip).
    - Step 100 adds the same-origin Core address and the CSP.
    - APK install guidance is adb-first, because of Android developer verification in Indonesia from 30 Sep 2026.
  - **Extra emulator (D100)**: a second phone AVD dems_phone2, added because mobile lanes queued on the single phone.
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
| Decisions | D32 Option C; D33 mobile spec and plan; D34 parallel lanes; D35 guards; D36 rev 2 accepted; D37 SCR folding; **D38 combined gate approved**; D39 standing authorisation; D40 rev 3 accepted; D41–D49 execution rulings; **D50 demo media and dummy evidence data** | `decisions/decisions.md` (D1–D50) |
| Execution (rev 4) | Done: 19, 25–30, 90. Running: 31, 34, 35, 67, 68, 71. Everything else not started. Rev 4 therefore edits only rows that have not started, and adds steps 92–93 | Controller brief for rev 4; D42–D49 |
| Execution (rev 5) | Most build steps are done (D51–D93). Controller-scheduled extras: 74b blocked (D87), 93b done (D67), 67b running (D93). Step 54 started before step 53 finished (D93). Rev 5 edits only rows that have not started (56, 57, 59–66, 91) and adds steps 94–99 | Controller brief for rev 5; D67–D94; `status_tasks.md` is authoritative |
| Execution (rev 6) | All web pages built (D101). Step 99 (67b) done (D98). Running: 54, 100 (Core origin), 101 (45b, visual-audit fixes) and 102 (67c, second phone AVD), plus mobile lanes. Rev 6 edits only rows that have not started (56–66, 91, 94–96) and adds steps 100–102 | Controller brief for rev 6; D95–D104 |

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

- **Numbering.** Rows 1–66 keep their numbers. The mobile build is appended as steps 67–91, the demo media and data as steps 92–93 (rev 4), and the release packaging as steps 94–96 (rev 5). Nothing is renumbered.
- **History rows 97–99 (rev 5).** The controller scheduled extra steps under the IDs 74b, 93b and 67b. The Step column must be an integer, so they are recorded as **97 = 74b**, **98 = 93b** and **99 = 67b**, with the controller ID in each Task Description. Controller logs and decisions may keep using the letter IDs.
- **Rev 6.** Step 100 (same-origin Core address and CSP; spec alias "95a") is added. History rows **101 = 45b** (visual-audit fixes) and **102 = 67c** (second phone AVD) are added. Size: 102 steps.
- **05 rows folded into existing steps.** M-16, M-18, M-19, M-20, M-21 and M-22 map onto 57, 59, 63, 65, 60 and 66.
- **Size.** 99 steps. Rev 4 count, kept for history: 93 steps, with 6 running and 55 not started. At rev 5, the controller's status_tasks.md is authoritative for progress. Step 54 is now required (D74). Step 91 is required with a widened scope (rev 5).

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
  - Demo media (step 92) and dummy evidence packages (step 93), with their consumers on web and mobile (D50).
  - Release packages built and verified locally (steps 94–96, D94): a signed universal Android APK and portable web launchers in the git-ignored release/ folder. Publishing them anywhere (a store, a web host, a file share) stays out of scope (D39).
  - One combined end-of-build pass.
  - Two local commits.
- **Out of scope**
  - Any mock-core change, including a shared live session between the apps (G-M15).
  - An `id` locale (A10).
  - iOS and deployment.
  - Any remote or push.
  - EAS, Android Studio, and TLS.
  - Real encryption of the evidence payload: the package declares its encryption algorithm, but the media stay readable for the demo (§11.2 notes "encryption packaging remain TBD").
  - Real device keys: signatures use a DEMO key only.
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
| 39 | [WEB, APPROVED D38] (02_plan §4 W-08, part a) Build the custom compositions GlowRing, DbfsMeter (reads the transient audio channel, never React state), SessionTimeline and Stepper per 01_specs §14.6, plus CameraFeed per §14.10 as amended by D50: it plays the step-92 live-feed loop video (muted, looped, through its src prop, with media URLs resolved in core-web via import.meta.glob over @dems/shared/assets/demo-media) under the kit Chip overlays, and falls back to the procedural canvas renderer (@dems/shared/assets/hero/room-2560.jpg with drift, grain and burned-in timestamp) when the video cannot load or autoplay; files in apps/core-web/src/components/composed and components/media, with motion per 03_motion_spec §5 | coder-execution | implementation/20_compositions.md (Tier 3) | 29, 31, 36, 92 | Each composition has a test for its §14.6 accessibility contract; a DbfsMeter test counts 0 React commits across 20 audio frames (MS-08 unit form); a CameraFeed test shows the video source when available and the procedural canvas after a simulated media error; MS-01 and MS-02 greps find nothing; core-web typecheck, lint and test exit 0 | implementation |
| 40 | [WEB, APPROVED D38; parallel checkpoint CP-1] (02_plan §4.1 W-02b rule, applied early) Review the web foundation read-only before the page fan-out: the simulator API against the Data column of 01_specs §14.5; the simulator's API handlers against the OpenAPI shapes; the SCR-01 and SCR-02 surface the mobile lane consumes; shell and route structure (§14.2–§14.4); the composition contracts (§14.6); the motion rules (03_motion_spec §9) | senior-code-reviewer | verification/06_foundation_review.md (Tier 2) | 32, 33, 36, 37, 38, 39 | Findings carry file:line and severity; a table maps every §14.5 Data item and every SCR-01/SCR-02 item to an existing export or names it as a gap; zero open blocker findings before steps 43, 46 and 47 start | verification |
| 41 | [WEB, APPROVED D38] (02_plan §4 W-07, part b) Integrate app-level and shell motion per 03_motion_spec §4: the M-APP-01..03 infrastructure (root LayoutGroup and AnimatePresence, top-bar emblem slot with layoutId brand-emblem, H-M1 proven natively or replaced by the two-phase DOMRect fallback), the M-APP-04 route transitions, and the shell motions M-SH-01..08 | coder-execution | implementation/21_shell_motion.md (Tier 3) | 36, 37, 38 | H-M1 outcome (native or fallback) recorded with the test or trace that decided it; the reduced-motion test for shell loops passes; MS-01 and MS-02 greps find nothing; core-web typecheck, lint and test exit 0 | implementation |
| 42 | [WEB, APPROVED D38] (02_plan §4 W-10) Build the Dashboard per 01_specs §14.5.1 (panels A–J, grid and row heights) and 03_motion_spec M-PG-DASH, with the camera tiles playing the step-92 live-feed loops through CameraFeed (D50), writing only apps/core-web/src/features/dashboard, its i18n namespace file and its own test file | coder-execution | implementation/22_page_dashboard.md (Tier 3) | 29, 32, 37, 38, 39 | Render test asserts page-dashboard and panel test IDs A–J in the idle scenario, with the camera tiles rendering CameraFeed on the step-92 video sources; the storage panel reads 20% USED and 3.2 TB free of 4.0 TB (AC-75 unit form); core-web typecheck, lint and test exit 0 | implementation |
| 43 | [WEB, APPROVED D38] (02_plan §4 W-09) Build the Login page per 01_specs §14.8 and 03_motion_spec M-PG-LOGIN with its side of the M-APP-01 hand-off, writing only apps/core-web/src/features/login, its i18n namespace file and its own test file | coder-execution | implementation/23_page_login.md (Tier 3) | 40, 41 | Tests show every §14.8 state renders, a correct sign-in navigates to the redirect target, and no password appears in sessionStorage, the URL or emitted events (AC-49, AC-50 UI path); core-web typecheck, lint and test exit 0 | implementation |
| 44 | [WEB, APPROVED D38] (02_plan §4 W-11) Build the Session Monitor with finalization per 01_specs §14.5.2 and 03_motion_spec M-PG-SM, with the live feed playing the step-92 recording-session loops (VIDEO-01 and VIDEO-02) through CameraFeed and the audio track labels AUDIO-01 "MIC 1 – Interviewer" and AUDIO-02 "MIC 2 – Subject" matching the demo tracks (meters stay on the simulator's transient channel; D50), writing only apps/core-web/src/features/session-monitor, its i18n namespace file and its own test file | coder-execution | implementation/24_page_session_monitor.md (Tier 3) | 32, 37, 38, 39 | Render test asserts the page test ID and panel test IDs K–T in the recording scenario, with the feed on the step-92 video sources and both track labels shown; a fake-timer test drives End Session with a reason to SEALED within 10 s of sim time (AC-63 unit form); core-web typecheck, lint and test exit 0 | implementation |
| 45 | [WEB, APPROVED D38; parallel checkpoint CP-2] (02_plan §4 W-21 subset, run early) Run the early visual and performance checkpoint in the browser on Vite port 5173 at 1920x1080 and 1440x900 on the shell, Dashboard and Session Monitor: AC-59, AC-60, AC-61, AC-70 on these pages, and a first AC-71 reading, using mock-core under P5 | verifier | verification/07_visual_checkpoint.md (Tier 2) | 41, 42, 44 | Each listed check PASS or FAIL with a quoted measurement or screenshot path; each FAIL routed to step 38, 39, 41, 42 or 44 with the expected correction; own PIDs stopped | verification |
| 46 | [WEB, APPROVED D38] (02_plan §4 W-12) Build the Start New Session flow per 01_specs §14.5.11 and 03_motion_spec M-PG-NEW (three steps, the §5.3 gate policy, 3-2-1 countdown), writing only apps/core-web/src/features/session-new, its i18n namespace file and its own test file | coder-execution | implementation/25_flow_start_session.md (Tier 3) | 40, 44 | Fake-timer tests show step 2 blocks on a BLOCK check, WARN needs acknowledgement, and Start puts the sim in RECORDING with audit SESSION_CREATED, PRECHECK_PASSED and RECORDING_STARTED (AC-62 unit form); core-web typecheck, lint and test exit 0 | implementation |
| 47 | [WEB, APPROVED D38] (02_plan §4 W-13) Build the Evidence list, detail and export wizard per 01_specs §14.5.3 and 03_motion_spec M-PG-EVID as amended by D50, joining simulator evidence to its package by stable ID suffix through @dems/shared/demo-data: media tab playing VIDEO-01 and VIDEO-02 with a dual audio switch between the separate AUDIO-01 and AUDIO-02 files; metadata tab with the manifest and metadata viewers; integrity tab that re-computes every track SHA-256 and the manifest hash in the browser with the step-93 verify helper (@noble/hashes), checks the Ed25519 signature with WebCrypto where supported (otherwise shows step 93's precomputed result, labelled), and shows FAIL on exactly the altered track for the TAMPERED item; the export wizard downloads step 93's prebuilt export zip where one exists and otherwise the item's export manifest JSON, labelled demo; writing only apps/core-web/src/features/evidence, its i18n namespace file and its own test files | coder-execution | implementation/26_page_evidence.md (Tier 3) | 40, 93 | The evidence-table test (AC-64) passes with a fixture of at least 11 rows so page 2 exists; an integrity test gives PASS for a pristine package and FAIL on exactly one track for the tampered one; a test hashes the prebuilt export zip bytes and matches its export manifest; an audio-switch test selects AUDIO-02; core-web typecheck, lint and test exit 0 | implementation |
| 48 | [WEB, APPROVED D38] (02_plan §4 W-14) Build the Devices & Inputs page per 01_specs §14.5.4 and 03_motion_spec M-PG-DEV, writing only apps/core-web/src/features/devices, its i18n namespace file and its own test file | coder-execution | implementation/27_page_devices.md (Tier 3) | 40, 45 | Render test asserts the page test ID and every panel test ID §14.5.4 lists, in the idle scenario; core-web typecheck, lint and test exit 0 | implementation |
| 49 | [WEB, APPROVED D38] (02_plan §4 W-15) Build the Storage page per 01_specs §14.5.5 and 03_motion_spec M-PG-STOR, writing only apps/core-web/src/features/storage, its i18n namespace file and its own test file | coder-execution | implementation/28_page_storage.md (Tier 3) | 40, 45 | Render test asserts the page and panel test IDs from §14.5.5 and the ring text 20% USED with 3.2 TB free of 4.0 TB (AC-75 unit form); core-web typecheck, lint and test exit 0 | implementation |
| 50 | [WEB, APPROVED D38] (02_plan §4 W-16) Build the Network & Time page per 01_specs §14.5.6 and 03_motion_spec M-PG-NET, writing only apps/core-web/src/features/network-time, its i18n namespace file and its own test file | coder-execution | implementation/29_page_network_time.md (Tier 3) | 40, 45 | Render test asserts the page test ID and every panel test ID §14.5.6 lists, with UTC+07:00 timestamps; core-web typecheck, lint and test exit 0 | implementation |
| 51 | [WEB, APPROVED D38] (02_plan §4 W-17) Build the Security & Audit page per 01_specs §14.5.7 and 03_motion_spec M-PG-SEC, writing only apps/core-web/src/features/security-audit, its i18n namespace file and its own test file | coder-execution | implementation/30_page_security_audit.md (Tier 3) | 40, 45 | Render test asserts the page and panel test IDs from §14.5.7; after inject AUDIT_TAMPER the chain view reports FAIL at the tampered index (AC-55 UI path); core-web typecheck, lint and test exit 0 | implementation |
| 52 | [WEB, APPROVED D38] (02_plan §4 W-18) Build the System & Maintenance page with the Demo Control Panel per 01_specs §14.5.8 and 03_motion_spec M-PG-SYS, writing only apps/core-web/src/features/system, its i18n namespace file and its own test file | coder-execution | implementation/31_page_system.md (Tier 3) | 40, 45 | Render test asserts the page and panel test IDs from §14.5.8; Demo Control Panel actions MIC 2 clip and Storage full change sim state to CLIP-latched and FULL (AC-65 unit form); core-web typecheck, lint and test exit 0 | implementation |
| 53 | [WEB, APPROVED D38] (02_plan §4 W-19) Build the API Reference page per 01_specs §14.9 and 03_motion_spec M-PG-API (Scalar config with the agent and AI features disabled per D45, simAwareFetch, scalar.css theme, server strip, Realtime WS panel, lazy route chunk), with example request and response payloads taken from @dems/shared/demo-data (D50), resolving H-S17 or applying its fallback, writing only apps/core-web/src/features/api-reference, its i18n namespace file and its two test files | coder-execution | implementation/32_page_api_reference.md (Tier 3) | 33, 40, 45, 93 | scalar-config.test.ts (AC-57 config part) and sim-fetch.test.ts (AC-58) pass; a test validates every demo-data example payload against its OpenAPI schema; H-S17 outcome recorded with evidence; no @scalar import outside features/api-reference (grep quoted); core-web typecheck, lint and test exit 0 | implementation |
| 54 | [WEB, APPROVED D38; conditional; W-02 owner] (02_plan §4.1 W-02b) Close the simulator API gaps logged by the web page steps 42–53 as SIM-GAP-n: add each missing selector or action with tests in packages/shared/src/sim, then remove each web page's temporary sim-adapter. If no web page log lists a gap, the controller records SKIPPED with the grep evidence instead of delegating | coder-execution | implementation/33_sim_gap_closure_web.md (Tier 3) | 42, 43, 44, 46, 47, 48, 49, 50, 51, 52, 53 | `grep -rn SIM-GAP- apps/core-web/src` finds nothing; shared, core-web and mobile typecheck and test exit 0 (or SKIPPED recorded with evidence) | implementation |
| 55 | [DONE: this merge, rev 3] Merge the mobile lane into this blueprint from masterplan/04_mobile_specs.md and masterplan/05_mobile_plan.md: M-rows as steps 67–91 with lanes, locks and ports; SCR-01..SCR-07 folded into steps 27–35 (Q-M7 yes); end-pass halves rewired; combined approval gate | task-architect | identification/02_structured.md (rev 3; Tier 2) | 6 | Every M-step cites its 05_mobile_plan row; V1–V7 PASS on 91 rows; no two concurrent steps share a write path, lock or port (collision scan); Refinement Log RL-40 onward | masterplan |
| 56 | [WEB, APPROVED D38 for web scope; stack scope pre-approved D1] (02_plan §3 Row 20 and §4 W-20; web and stack half of the absorbed row 20) Complete and run the stack and web test suites: confirm the 01_specs §8 smoke tests S-1, S-2, M-1..M-3 and W-1 exist (add any missing); add the §14.13 core-web tests no build step owns (routes.test.tsx for AC-48 and AC-49 with an i18next missingKey handler for AC-66; reduced-motion.test.tsx for AC-70); confirm the step-93 demo-evidence hash and signature tests cover every package, including the tampered one; replace the fixed 1 s waits that flake under load in the shell and route tests (F-49-3, D77); include step 100's core-endpoint and shared origin tests, so both Core-address modes are covered; run npm test for the shared, mock-core and core-web workspaces with --maxWorkers=2 | test-expert | test/01_test_report.md (Tier 2) | 54, 100 | The three workspace test runs exit 0 with the §8 stack smoke tests and every §14.13 test file passing, runner output quoted (automated AC-48..AC-58, AC-64, AC-66, AC-69, AC-70); demo-evidence.test.ts recomputes every SHA-256 and Ed25519 signature, and the tampered package fails exactly one check; 0 missing i18n keys; no test connects beyond 127.0.0.1 | test |
| 57 | [MOBILE, APPROVED D38] (05 §3 M-16; mobile half of the absorbed row 20) Complete and run the mobile test suite: T-M02 against the real screens, T-M11 missing keys, the cross-cutting tests of 04_mobile_specs §10.1, the step-70 routes and guard test updates routed here (D88, D90, D92) and F74-06/F74-21 (D73), and the Maestro flows apps/mobile/e2e/maestro/01..04 on both AVDs (Q-M2 approved, D38; both AVD locks, phone first; Metro 8085; device work split into sessions of 30 minutes or less, because the step-99 watchdog ends longer ones; Maestro flags per D47; ambient loops paused per D43; pairing codes typed digit by digit, S76-8 in D95; phone sessions may target any-phone, including dems_phone2 from step 102); run npm test for the mobile workspace with --maxWorkers=2 | test-expert | test/02_mobile_test_report.md (Tier 2) | 90, 91, 99, 102 | MA-03 (at least 15 test files T-M01..T-M15 pass), MA-04 and MA-21 with runner output quoted; MA-27 PASS on both AVDs (4 Maestro flows, junit output linked); no test connects beyond 127.0.0.1 | test |
| 58 | [WEB, APPROVED D38] (02_plan §4 W-21) Verify the web build in the browser (agent-browser first) on Vite port 5173 at 1920x1080, 1440x900, 1200x800 and 900x800 against AC-48..AC-75 and MS-01..MS-10 (including the MS-07 Login hand-off capture), running the idle, recording, finalizing and fault-demo scenarios, with mock-core under P5; it also re-measures AC-71 for Dashboard and Devices on the production build in GPU Chrome after step 101's one-live-tile policy (D96), checks the build half of AC-73 (D101), and confirms the Login hand-off pause on the production build (D76) | verifier | verification/04_web_verification.md (Tier 2) | 56, 100, 101 | Each of AC-48..AC-75 and MS-01..MS-10 marked PASS or FAIL with quoted output or a screenshot path; AC-57 resource-host list quoted; AC-71 fps and long-task counts (with the step-92 videos playing) plus the AC-73 entry-chunk gzip size recorded; in the browser the tampered evidence item shows FAIL, a pristine item shows PASS, and a downloaded export zip's `shasum -a 256` equals its export manifest (D50); each FAIL routed to its owning step | verification |
| 59 | [MOBILE, APPROVED D38] (05 §3 M-18) Verify the mobile app from a fresh zsh -l on dems_phone (emulator-5554) and dems_tablet (emulator-5556) against MA-01..MA-30 and the scaffold mobile ACs AC-16 and AC-25..AC-34, with the MA-11 contact sheet and gfxinfo on both AVDs, plus the tablet re-checks routed to the end pass (MA-07 and MA-15 on the tablet, enrolment state, tablet portrait, stepper and step-param device confirmation; D88, D90), and every device check a lane deferred to the end pass under D103; phone checks may use dems_phone2 (emulator-5558, step 102); sign in through the simulator's auth or biometric debug handle (D103); hold the AVD locks (phone first) in sessions of 30 minutes or less (step 99), Metro 8086, the Gradle lock for any rebuild; never kill or reboot an emulator except per D78; run MA-10 only while this step is mock-core's sole registered user (P5) | verifier | verification/08_mobile_verification.md (Tier 2) | 57, 99, 102 | Each of MA-01..MA-30, AC-16 and AC-25..AC-34 marked PASS or FAIL with quoted output or a screencap path on the stated AVD; the demo videos play in the live feed and the evidence play sheet, and the tampered item shows FAIL, on both AVDs (D50); contact sheet linked; each FAIL routed to its owning step; locks released and own PIDs stopped | verification |
| 60 | [WEB and MOBILE, APPROVED D38; stack sections pre-approved D1] (02_plan §3 Row 21, §4 W-22 and 05 §3 M-21; absorbs row 21) Write the run guide at /Users/gsp-budi/Documents/DEMS/README.md: the 8 AC-44 sections, the D24 emulator note, --no-metrics, both AVD scripts and rollback pointers; web sections (pages, scenarios, Demo Control Panel, presentation mode, ?debug=1, ?motion=slow); a mobile section (lanes and Metro ports, locks, AVD boot on ports 5554 and 5556, deep links, scenarios, biometric enrolment with PIN 1234, Maestro, and a presenter note that each app runs its own simulator, Q-M4 accepted in D38); a demo-data section (regenerating the media with step 92's script and the evidence packages with step 93's script and its --as-of date, the DEMO-key notice, and the ffmpeg rollback from step 92's log); the items routed to step 60 (ANDROID_SERIAL for every adb call with two emulators, D43; the Maestro flags and footprint, D47; booting demo emulators from the user's own Terminal with windows visible, checking priority, and measuring cold start as a warm-up plus the median of 5, D73 and D87; regenerating with --as-of before a demo on another date, D84; the enrolment and PIN-unlock commands, D88; the third AVD dems_phone2 on port 5558 and the device-session targets phone2, any-phone and any, D100); a "Release packages" section (06 §6.1, D104) pointing to release/RUN-ON-ANOTHER-PC.md, giving the two build commands (apps/mobile/scripts/build-release-apk.sh; node --import tsx scripts/release/build-web-packages.ts), and recommending adb-first installation of the APK, because Android developer verification in Indonesia (from 30 Sep 2026) adds a one-time 24-hour advanced flow for tap-installing unregistered apps; it also corrects THIRD_PARTY_NOTICES.md per D74 (videos derived from the Pexels photo; eSpeak NG voice; no macOS voices); one `graft build .` line (never graft init). Cite commands from existing logs and start no servers | coder-execution | /Users/gsp-budi/Documents/DEMS/README.md (Tier 2) | 56, 57 | The AC-44 section grep returns 8; a command-to-log mapping table in the return message shows passing output for every README command; versions match initialization/01_env_check.md; no pre-existing root README.md overwritten (E13) | implementation |
| 61 | [WEB, APPROVED D38 for web scope; stack scope pre-approved D1] (02_plan §3 Row 22; absorbs row 22) Verify the stack end to end from a fresh zsh -l by following README.md literally: first stop the session-scoped emulators started by steps 67 and 102 (dems_phone, dems_tablet, dems_phone2; P3), then AC-01..AC-47 with the D29 wording for AC-01, AC-04 and AC-11 and the D42 boundary-anchored AC-13/AC-14 greps, on both AVDs with the mobile build re-proven after both lanes' changes to packages/shared; cold boots use -no-snapshot-load (D78); cold start is recorded as the median of at least 3, and the step tests whether -no-window keeps the emulators at normal priority (D73, D87); root `npm run typecheck`, `npm run lint` and `npm test` (AC-43, AC-47); the dumpsys gfxinfo jank baseline per AVD (informational) | verifier | verification/01_verification.md (Tier 2) | 58, 59, 60, 99, 100, 102 | AC-01..AC-47 each PASS, FAIL or CAUTION-with-acknowledgement with quoted output; SC1–SC7 all PASS; every initialization log and the step-92 host-install log carry their rollback commands; no emulator is left running; each FAIL routed to its owning row or step | verification |
| 62 | [WEB, APPROVED D38 for web scope; stack scope pre-approved D1] (02_plan §3 Row 23 and §4 W-23, security half; stack and web half of the absorbed row 23) Security review of the stack and the web build, read-only and starting no servers: ~/.zprofile diff limited to blocks A and B; loopback-only listeners and the Metro bind (from the row 19, step 58 and step 61 logs); no credentials in URLs, logs, events or sessionStorage (01_specs §14.8); Scalar privacy flags and zero external resource hosts (AC-57); @scarf/scarf absent; THIRD_PARTY_NOTICES.md complete, including any new media source; .gitignore coverage (AC-46, .locks/); npm audit high and critical counts, including the D45 Scalar advisories; no design-book text in the web bundle; demo data (D50): the DEMO key is derived from a published demo seed or generated locally, is labelled DEMO in the certificate subject and in every signature file, is never presented as a real key, and no private-key file is tracked; the ffmpeg host install is limited to the formulae logged by step 92, with a rollback; the interview audio's voice is eSpeak NG with no macOS voices, and the step-60 notices corrections are in place (D74); packaging (D94): the web launchers' network exposure (listener on 127.0.0.1 only, one origin, no external requests, from step 96's log), binary provenance (every bundled Node binary is an official nodejs.org build whose SHA-256 matches SHASUMS256), the packaging scripts, and release/ git-ignored; plus step 100's CSP and every web-and-stack item in masterplan/06_packaging_spec.md §6.2 (security headers, the Host and WS Origin allowlists, the 32-client cap, no interface override, the launcher writes no files, provenance including the Windows-fallback node.exe, package contents free of secrets, source maps and design-book text, the RUN guide's confidentiality advice) | security-review | verification/02_security.md (Tier 2; verdict PASS, CAUTION or FAIL) | 58, 60, 96 | Verdict stated; every checklist item has command output or file:line evidence; each CAUTION or FAIL names a remediation step | verification |
| 63 | [MOBILE, APPROVED D38] (05 §3 M-19; mobile half of the absorbed row 23) Security review of the mobile app, read-only and starting no servers: no credentials in AsyncStorage keys (04_mobile_specs §5.3) or logs; biometric handling; loopback-only traffic (MA-25); cleartext only in the debug manifest (AC-26); Android permissions (USE_BIOMETRIC); no EAS, expo-updates or projectId (AC-27, MA-26); Maestro analytics off and the ~/.maestro footprint (installed by step 90, Q-M2 approved in D38); THIRD_PARTY_NOTICES.md mobile use (MA-24); no design-book text in the JS bundle; the bundled demo media subset is synthetic (no real person, insignia or case) and verification results are labelled as DEMO precomputed values (D50); release APK (D94): DEMO keystore handling (generated locally, git-ignored, labelled DEMO, no password in any log), the apksigner certificate details, the release manifest's permissions and cleartext policy (AC-26: the main manifest allows none) and their effect on heartbeat mode, no Metro or dev-server URL baked into the release bundle, and APK provenance through its SHA-256 file; plus every mobile item in masterplan/06_packaging_spec.md §6.2, including AC-PK-A8 (the keystore password appears nowhere in docs or release/), the Heartbeat option disabled in release (step 91), and the install guide's advice (adb preferred, Play Protect upload declined, protections never disabled globally) | security-review | verification/09_mobile_security.md (Tier 2; verdict PASS, CAUTION or FAIL) | 59, 60, 96 | Verdict stated; every checklist item has command output or file:line evidence; each CAUTION or FAIL names a remediation step | verification |
| 64 | [WEB, APPROVED D38 for web scope; stack scope pre-approved D1] (02_plan §3 Row 24 and §4 W-23, review half; stack and web half of the absorbed row 24) Senior code review of apps/core-web, apps/mock-core, packages/shared and the root config: duplication; dependency hygiene (AC-13 single React, peer conflicts); token and type reuse; template leftovers; D6 compliance (only the five §14.6 compositions are custom UI); simulator core free of DOM and React and platform-neutral (SCR-01); @dems/shared/demo-data free of node: imports so it runs in the browser, on Hermes and in Node (D50); the demo generator scripts use no npm package beyond the pins; erasableSyntaxOnly; bundle split (AC-73, quoted from step 58); the web packager and launcher code (D94): same-origin serving of the app, health and /ws, a loopback default, Node-binary checksum verification in the build script, no duplicated mock-core logic beyond what the spec allows; plus the web items of masterplan/06_packaging_spec.md §6.2 (RFC 6455 handshake and framing, Range/ETag handling, SPA fallback, shutdown path, Windows "Press Enter" path, contract tests against the shared schemas, the packager failing closed, a minimal core-endpoint.ts with dev defaults unchanged) | senior-code-reviewer | verification/03_code_review.md (Tier 2) | 58, 60, 96 | Findings carry file:line and severity; zero open blocker findings; `npm ls react react-dom --all` output quoted | verification |
| 65 | [MOBILE, APPROVED D38] (05 §3 M-20; mobile half of the absorbed row 24) Senior code review of apps/mobile: D6 compliance (MA-23, only C-1..C-6 custom); shared-contract use without forks (MA-28); single React and zustand copies (MA-01); UI-thread discipline for meters, Skia and Reanimated (MA-16, 04_mobile_specs §7.8); ownership rules of 05 §3 held (no mobile step wrote packages/shared); the release build configuration (D94): signing config kept outside source control, versionName/versionCode, universal ABI, embedded bundle and assets, no debug-only code paths in release; plus the mobile items of masterplan/06_packaging_spec.md §6.2 (plugin idempotence and Groovy correctness, no secret in app.json or the plugin, the ABI flag in the script rather than gradle.properties, EXPO_NO_TELEMETRY and the lock used, the versionCode scheme, `__DEV__` gates) | senior-code-reviewer | verification/10_mobile_code_review.md (Tier 2) | 59, 60, 96 | Findings carry file:line and severity; zero open blocker findings; `git diff --stat` of packages/shared restricted to mobile-step commits is empty or explained | verification |
| 66 | [WEB, APPROVED D38; covers 05 M-22] (02_plan §4 W-24 and 05 §3 M-22) Create one combined final local commit of both verified builds, the packaging scripts and the end-pass outputs on top of the step-25 baseline, using the existing git identity; release/ binaries and apps/mobile/signing/ are never committed (git-ignored by step 100 or 94; confirm before staging); before staging, confirm that no source changed after the packages were built (06 §6.1 provenance check); no remote, no push | git-specialist | implementation/34_git_final_commit.md (Tier 3) | 61, 62, 63, 64, 65, 96 | `git log --oneline` shows the new commit directly above the step-25 baseline; `git status --porcelain` is empty; `git remote -v` is empty; `git ls-files` lists no .docx, .env, keystore, node_modules, .cache, .locks or apps/mobile/android path, and no private-key file (*.key or *private*.pem); `git check-ignore -q release/x apps/mobile/signing/x` exits 0; `git ls-files` lists no release/, signing, .p12 or .properties path; `find apps packages scripts -newer release/web/BUILD-INFO.txt -type f -not -path '*/node_modules/*' -not -path 'apps/mobile/android/*'` prints nothing (no source changed after the packages were built) | implementation |
| 67 | [MOBILE, APPROVED D38; npm slot 2 of 2; Gradle] (05 §3 M-01; §6) Prepare the mobile dependencies and native config: diff installed packages against 01_specs §1.4 and 04_mobile_specs §8.4 and install only the missing ones under .locks/npm.lock after step 27 (R-1 npx expo install: expo-local-authentication, @react-native-async-storage/async-storage, react-native-keyboard-controller; R-2 exact: zustand 5.0.15, i18next 26.4.2, react-i18next 17.0.15); move the jest config into jest.config.js and jest.setup.ts with the §10.1 additions; add the start:lane script and the e2e script with the Maestro analytics opt-outs (Q-M2 approved, D38); add the expo-local-authentication plugin to app.json; add scripts/device-session.sh (05 §5.4); boot both AVDs on fixed ports 5554 and 5556 as session-scoped emulators (P3); prebuild and Gradle once under .locks/gradle.lock; install on both AVDs; prove the lane-port reverse (H-MB-09) | coder-execution | implementation/40_mobile_deps_native.md (Tier 3) | 25, 27 | MA-01, MA-02 and MA-26 PASS with quoted output; AC-16, AC-25, AC-26 and AC-27 still PASS; the app launches on emulator-5554 and emulator-5556 through a lane on Metro 8082 (H-MB-09 outcome recorded); apps/mobile/package.json has no jest key; emulator PIDs written to .locks/dems_phone.pid and .locks/dems_tablet.pid | implementation |
| 68 | [MOBILE, APPROVED D38] (05 §3 M-02, part a) Build the mobile foundation without the simulator per 04_mobile_specs §2.2 and §3.2: layout classes with SafeScreen and PaneLayout; AppProviders without simulator, auth or motion, wired into the existing src/app/_layout.tsx (edit, not rename); the typed no-op runtime contract stub src/runtime/index.ts (SimRuntimeProvider, useCoreLink, SessionRouteSync, KeepAwakeController, useAuth); kit recipes StatusChip, SubjectTypeChip, SectionCard and KeyValueList; src/i18n/index.ts, en.mobile.ts and an empty src/i18n/features.ts registry; src/global.css additions if needed | coder-execution | implementation/41_mobile_foundation.md (Tier 3) | 25 | T-M01 passes; the MA-22 hex grep finds nothing in the new files; the /stack-check device smoke on both AVDs, run after step 67 reports its reinstall, shows no regression; mobile typecheck, lint and jest (--maxWorkers=2) exit 0 | implementation |
| 69 | [MOBILE, APPROVED D38] (05 §3 M-02, part b) Build the mobile motion kit in apps/mobile/src/motion per 04_mobile_specs §7: token-to-Reanimated mapping from the step-30 motion tokens; builders; useMotionPolicy with ReducedMotionConfig and the kit animation 'disable-all' switch; GlowLayer; the haptics service (§7.6); the ?debug=1 overlay; a MotionPolicyProvider export for the root layout | coder-execution | implementation/42_mobile_motion_kit.md (Tier 3) | 30 | T-M12 and T-M14 pass (MA-18 unit part, MA-20); the MA-20 grep finds no Haptics call outside src/motion/haptics; mobile typecheck, lint and jest exit 0 | implementation |
| 70 | [MOBILE, APPROVED D38] (05 §3 M-03) Build the mobile navigation shell per 04_mobile_specs §3: the full Expo Router tree of §3.1 with a stub for every route (screen-<id> from src/features/<folder>/<name>-screen.tsx) plus an empty i18n.ts per feature folder registered in src/i18n/features.ts; the Stack.Protected guard on the useAuth contract; headless Tabs with ResponsiveTabList (BottomTabBar, NavRail, LiveMiniBar); hidden More triggers (H-MB-01); the boot router keeping ?motion= on the proof screen (AC-31); public /stack-check and /pair; the usePreventRemove back-guard hook; zod deep-link parsing; the step-69 MotionPolicyProvider in _layout.tsx | coder-execution | implementation/43_mobile_navigation_shell.md (Tier 3) | 68, 69 | T-M02 (stubs) and T-M03 pass (MA-04 stub level, MA-05); on both AVDs MA-14 and MA-15 PASS and the chrome parts of MA-12 and MA-13 are recorded with screencaps; mobile typecheck, lint and jest exit 0 | implementation |
| 71 | [MOBILE, APPROVED D38] (05 §3 M-04) Build the mobile compositions and asset renderers without the simulator per 04_mobile_specs §4.0 and §8.3: C-1 GlowRing, C-2 DbfsMeter (input = shared values), C-3 SessionTimeline, C-4 Stepper, C-6 RollingNumber with their pure-maths modules and tests; CameraFeed, Emblem and HeroBackdrop with placeholder image and path data; the debug-only route src/app/dev-gallery.tsx (create only); compositions take the motion policy as a prop | coder-execution | implementation/44_mobile_compositions.md (Tier 3) | 25 | T-M09 passes (MA-16: one meter render for 40 frames; no React state in dbfs-meter.tsx); the MA-23 listing shows only C-1..C-6 under components/composed; dev-gallery screencaps on both AVDs after step 67's reinstall; mobile typecheck, lint and jest exit 0 | implementation |
| 72 | [MOBILE, APPROVED D38; Gradle] (05 §3 M-05) Wire the mobile brand and media: emblem path data and the topographic SVG from @dems/shared/brand (step 35) into Emblem and the backdrops; the step-28 PNGs into apps/mobile/assets/images/brand/ and the app.json icon, adaptive-icon, monochrome and splash keys; the step-29 room-1600.jpg into apps/mobile/assets/images/hero/ for HeroBackdrop and thumbnails; the step-92 lower-resolution mobile media subset (live-feed loops, per-session tracks, posters) into apps/mobile/assets/media/ with a static require map, wired into CameraFeed as video (expo-video, muted, looped) with the step-71 procedural renderer as fallback (D50); one prebuild and Gradle rebuild under .locks/gradle.lock with reinstall on both AVDs | coder-execution | implementation/45_mobile_brand_media.md (Tier 3) | 28, 29, 35, 67, 71, 92 | MA-24 PASS (no DEMS-Mobile reference; hero shasum equals the step-29 room-1600.jpg; notices name apps/mobile); every copied media file's shasum equals its step-92 mobile-subset source and the subset size is recorded; CameraFeed plays the video on both AVDs (screencaps) and a test covers the procedural fallback; launcher icon and splash screencaps on both AVDs (MA-11 icon and splash part); the Gradle run held the lock; THIRD_PARTY_NOTICES.md not modified by this step | implementation |
| 73 | [MOBILE, APPROVED D38] (05 §3 M-06) Wire the mobile runtime to the shared simulator per 04_mobile_specs §5 and §6: replace the step-68 stubs in src/runtime with SimRuntimeProvider (createSim with AsyncStorage storage, AppState visibility and the ready-promise hydration gate), useAudioSharedValues, the Core link (Simulated by default, Q-M8 approved in D38; heartbeat as the alternative), SessionRouteSync and KeepAwakeController; src/auth with AuthProvider over the simulator auth, the biometric service with T-M05, and the idle lock; the ConnectionBanner logic; the shared @dems/shared/i18n resources deep-merged in src/i18n/index.ts; the new providers in src/providers/app-providers.tsx | coder-execution | implementation/46_mobile_runtime_sim.md (Tier 3) | 32, 33, 34, 68 | T-M05, T-M06 and T-M07 pass; MA-08 and MA-19 PASS on a device; MA-10 runtime part recorded (run only as mock-core's sole registered user, P5); the MA-28 check finds at least one @dems/shared/sim importer; mobile typecheck, lint and jest exit 0 | implementation |
| 74 | [MOBILE, APPROVED D38; parallel checkpoint CP-M1] (05 §3 ownership rules, applied early) Review the mobile foundation read-only before the screen fan-out: runtime wiring against 04_mobile_specs §5 (adapters, hydration gate, transient meter path); navigation shell and guard (§3); composition contracts and UI-thread discipline (§4.0, §7.8); the motion kit and haptics service (§7); the 05 §3 ownership rules; the §5.6 selectors every screen needs against the step-31 and step-32 simulator | senior-code-reviewer | verification/11_mobile_foundation_review.md (Tier 2) | 70, 71, 72, 73 | Findings carry file:line and severity; a table maps every 04_mobile_specs §5.6 selector to an existing simulator export or names it a gap; zero open blocker findings before steps 76, 78 and 80–89 start | verification |
| 75 | [MOBILE, APPROVED D38] (05 §3 M-07, part a) Build the mobile Login with biometric sign-in per 04_mobile_specs §4.1 and §6, writing only apps/mobile/src/features/login (screen, its i18n.ts, its tests); enrol PIN 1234 and a virtual fingerprint on both AVDs per §6.3 (Q-M3 approved, D38), hiding the biometric button on an AVD where H-MB-04 fails | coder-execution | implementation/47_mobile_login.md (Tier 3) | 70, 72, 73 | T-M04 passes (MA-06); MA-07 PASS on both AVDs after enrolment, or the H-MB-04 fallback recorded for the failing AVD; MA-15 login part PASS; compact and expanded screencaps on both AVDs; mobile typecheck, lint and jest exit 0 | implementation |
| 76 | [MOBILE, APPROVED D38] (05 §3 M-07, part b) Build the mobile Pairing screen per 04_mobile_specs §4.2 and §6.5, writing only apps/mobile/src/features/pairing (screen, its i18n.ts, its tests) | coder-execution | implementation/48_mobile_pairing.md (Tier 3) | 70, 73, 74 | Its test shows pair(code) and unpair() change the pairing state and emit audit rows; screencaps on both AVDs; mobile typecheck, lint and jest exit 0 | implementation |
| 77 | [MOBILE, APPROVED D38] (05 §3 M-08) Build the mobile Home (Dashboard) per 04_mobile_specs §4.3 and §7.3, writing only apps/mobile/src/features/dashboard (screen, its i18n.ts, its tests) | coder-execution | implementation/49_mobile_home.md (Tier 3) | 70, 71, 73 | MA-11 MB 2 checklist met on dems_phone; MA-12 home part and MA-18 ring check recorded; its render test passes; mobile typecheck, lint and jest exit 0 | implementation |
| 78 | [MOBILE, APPROVED D38] (05 §3 M-09) Build the mobile Start New Session flow per 04_mobile_specs §4.4 (three steps, the §5.3 gate, ARMED), writing only apps/mobile/src/features/session-new (screen, its i18n.ts, its tests) | coder-execution | implementation/50_mobile_start_session.md (Tier 3) | 70, 71, 73, 74 | T-M10 passes; MA-29 steps 1–3 and MA-30 step-2 part PASS on dems_phone; MA-11 MB 3 checklist met; mobile typecheck, lint and jest exit 0 | implementation |
| 79 | [MOBILE, APPROVED D38] (05 §3 M-10) Build the mobile Session Monitor per 04_mobile_specs §4.5 (the live feed playing the step-72 media subset through CameraFeed with its procedural fallback, D50; meters, actions, the "End Session" hold with reason, labelled "End Session" per Q-M5 in D38, sheets, back guard, banner), writing only apps/mobile/src/features/session-live (screen, its i18n.ts, its tests) | coder-execution | implementation/51_mobile_session_live.md (Tier 3) | 70, 71, 72, 73 | T-M08 passes; the feed screencap on both AVDs shows the video with its OSD; MA-09 PASS on a device; MA-12 live part and MA-17 recorded on both AVDs; MA-11 MB 4 checklist met; mobile typecheck, lint and jest exit 0 | implementation |
| 80 | [MOBILE, APPROVED D38] (05 §3 M-11, part a) Build the mobile Finalization and Session Summary flow per 04_mobile_specs §4.6 and §4.7, writing only apps/mobile/src/features/session-finalizing and session-summary (screens, their i18n.ts, their tests) | coder-execution | implementation/52_mobile_finalize_summary.md (Tier 3) | 70, 71, 73, 74 | The MA-29 finalize-to-summary part PASS on dems_phone (FINALIZING to SEALED within 10 s; violet SEALED chip; acknowledgeSummary called); its tests pass; mobile typecheck, lint and jest exit 0 | implementation |
| 81 | [MOBILE, APPROVED D38] (05 §3 M-11, part b) Build the mobile Recovery Status screen per 04_mobile_specs §4.8, writing only apps/mobile/src/features/session-recovery (screen, its i18n.ts, its tests) | coder-execution | implementation/53_mobile_recovery.md (Tier 3) | 70, 73, 74 | Its test drives FAULT to RECOVERY to an incomplete session and asserts the screen states; screencaps on both AVDs; mobile typecheck, lint and jest exit 0 | implementation |
| 82 | [MOBILE, APPROVED D38] (05 §3 M-11, part c) Build the mobile Sessions hub per 04_mobile_specs §4.9, writing only apps/mobile/src/features/sessions (screens, their i18n.ts, their tests) | coder-execution | implementation/54_mobile_sessions_hub.md (Tier 3) | 70, 73, 74 | Its test lists sessionHistory including an incomplete session; screencaps on both AVDs; mobile typecheck, lint and jest exit 0 | implementation |
| 83 | [MOBILE, APPROVED D38] (05 §3 M-12) Build the mobile Evidence list, detail, export and play sheets per 04_mobile_specs §4.10 and §4.11 as amended by D50: the play sheet uses the step-72 media subset with an AUDIO-01 and AUDIO-02 switch; the integrity section shows the package's verification status from @dems/shared/demo-data (precomputed by step 93, labelled "verified by the Core"; the TAMPERED item shows FAIL on its altered track), joined by stable ID suffix; writing only apps/mobile/src/features/evidence (screens, their i18n.ts, their tests) | coder-execution | implementation/55_mobile_evidence.md (Tier 3) | 70, 71, 72, 73, 74, 93 | T-M15 passes; a test shows PASS for a pristine item and FAIL for the tampered one; the play sheet plays on both AVDs (screencaps); MA-11 MB 5 and MB 6 checklists met on dems_phone; MA-12 evidence part and MA-13 selection part PASS on dems_tablet; mobile typecheck, lint and jest exit 0 | implementation |
| 84 | [MOBILE, APPROVED D38] (05 §3 M-13) Build the mobile Devices & Inputs list and device detail per 04_mobile_specs §4.12, writing only apps/mobile/src/features/devices (screens, their i18n.ts, their tests) | coder-execution | implementation/56_mobile_devices.md (Tier 3) | 70, 71, 73, 74 | MA-11 MB 7 checklist met on dems_phone; the list/detail panes render on dems_tablet; its tests pass; mobile typecheck, lint and jest exit 0 | implementation |
| 85 | [MOBILE, APPROVED D38] (05 §3 M-14, part a) Build the mobile Storage screen per 04_mobile_specs §4.13, writing only apps/mobile/src/features/storage (screen, its i18n.ts, its tests) | coder-execution | implementation/57_mobile_storage.md (Tier 3) | 70, 71, 73, 74 | MA-11 MB 8 checklist met, with the ring at 20% USED and 3.2 TB free of 4.0 TB; its test passes; mobile typecheck, lint and jest exit 0 | implementation |
| 86 | [MOBILE, APPROVED D38] (05 §3 M-14, part b) Build the mobile Network & Time screen per 04_mobile_specs §4.14, writing only apps/mobile/src/features/network-time (screen, its i18n.ts, its tests) | coder-execution | implementation/58_mobile_network_time.md (Tier 3) | 70, 71, 73, 74 | MA-11 MB 9 checklist met, with UTC+07:00 times from the shared arithmetic formatter; its test passes; mobile typecheck, lint and jest exit 0 | implementation |
| 87 | [MOBILE, APPROVED D38] (05 §3 M-15, part a) Build the mobile Operator Audit View per 04_mobile_specs §4.16, writing only apps/mobile/src/features/audit (screen, its i18n.ts, its tests) | coder-execution | implementation/59_mobile_audit.md (Tier 3) | 70, 73, 74 | Its test lists audit rows including AUTH_SUCCESS with method BIOMETRIC and the session events MA-29 names; screencaps on both AVDs; mobile typecheck, lint and jest exit 0 | implementation |
| 88 | [MOBILE, APPROVED D38] (05 §3 M-15, part b) Build the mobile Settings screens with every section, including Demo controls, the Core link source switch (default Simulated, Q-M8 approved in D38) and the reduce-motion override, per 04_mobile_specs §4.15, writing only apps/mobile/src/features/settings (screens, their i18n.ts, their tests) | coder-execution | implementation/60_mobile_settings.md (Tier 3) | 70, 73, 74 | MA-11 MB 10 checklist met; the MA-30 demo-controls part PASS on a device (MIC 2 clip, Storage full); its tests pass; mobile typecheck, lint and jest exit 0 | implementation |
| 89 | [MOBILE, APPROVED D38] (05 §3 M-15, part c) Build the phone-only More screen per 04_mobile_specs §4.17, writing only apps/mobile/src/features/more (screen, its i18n.ts, its tests) | coder-execution | implementation/61_mobile_more.md (Tier 3) | 70, 73, 74 | Its render test lists every More destination and each navigates to its route; screencap on dems_phone; mobile typecheck, lint and jest exit 0 | implementation |
| 90 | [MOBILE, APPROVED D38 (Q-M2 yes); HOST] (05 §3 M-17) Install the Maestro CLI 2.11.0: download the pinned zip and checksums_sha256.txt, verify the sha256 against the published value, unzip into ~/.maestro, run ~/.maestro/bin/maestro --version with MAESTRO_CLI_NO_ANALYTICS=true; no shell-profile edit | coder-execution | implementation/62_maestro_install.md (Tier 3) | 25 | The computed sha256 equals the published checksum (both quoted); maestro --version prints 2.11.0; `test ! -e ~/.zshrc` exits 0 (AC-10 still PASS); rollback `rm -rf ~/.maestro` recorded | implementation |
| 91 | [MOBILE and WEB, APPROVED D38; now required per the routings in D69, D73, D78, D83, D88, D90, D92 and D93; W-02 owner] (05 §9 and P6) Two parts, one remediation concern. First, close the remaining simulator gaps in packages/shared/src/sim, with tests, removing the temporary sim-adapters: step 53's web SIM-GAPs (D93) and every mobile SIM-GAP that step 54 did not absorb. Then apply the mobile remediation list routed to step 91, each through a one-change hand-over of the owning file: the step-69 leftovers (D69); F74-02 and F74-04/05/07/10/11/12/14 (D73); F-79-1, keeping the tabs underneath after deep jumps, and the F-79-2 sheet-presence pattern lifted into the kit (D78); F77-1, S77-9 and F77-3 (D83); the guard wait after sign-in (D88); the Stepper badge and the caseScan haptic (D90); S80-3 and the optional 1.2 s summary sync delay (D92); F-83-1 and F-83-4 (D93); the S76-4 Stepper warnings and the pairingFailure haptic (D95); SIM-GAP-M81-1..4 and F-81-1 (D99); SIM-GAP-M84-2 (D102); and the Heartbeat option disabled in release builds with a hint, plus a unit test with `__DEV__` false (06 §2.6, D104). Runs after steps 53 and 54, so only one step writes the simulator at a time | coder-execution | implementation/63_sim_gap_closure_mobile.md (Tier 3) | 53, 54, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89 | `grep -rn SIM-GAP- apps/mobile/src apps/core-web/src` finds nothing; every routed finding is listed with its fix and file:line; shared, core-web and mobile typecheck and test exit 0 | implementation |
| 92 | [NEW, D50 (user scope addition; controller design under D39); HOST] Generate the demo media. First install ffmpeg through Homebrew (per-command sandbox bypass; record `brew list --formula` before and after, and the exact uninstall list as the rollback). Then write packages/shared/scripts/gen-demo-media.ts, run with `node --import tsx` and using only Node built-ins, the ffmpeg CLI and macOS `say` (no npm install, no package.json edit), and generate into packages/shared/assets/demo-media/: for each step-31 dataset session, VIDEO-01 (wide) and VIDEO-02 (alternate angle) as H.264 MP4 at 1280x720 and 25 fps, made from the licensed step-29 hero photo with slow drift, sensor noise, vignette and a burned-in OSD (camera ID, running UTC+07:00 timestamp, REC); AUDIO-01 and AUDIO-02 as two separate AAC files of a neutral, fictional Indonesian interview (`say -v Damayanti` if `say -v '?'` lists it, second voice pitch-shifted, room tone; otherwise a speech-like synthetic fallback, with no GUI voice download); seamless live-feed loops for the recording session; posters and thumbnails; a lower-resolution mobile subset under demo-media/mobile/; everything within a 60 MB total | coder-execution | implementation/64_demo_media.md (Tier 3) | 29, 31 | ffprobe on every file quoted: videos h264 1280x720 at 25 fps (mobile subset at its recorded lower size), audio AAC, durations listed, and each session has two separate audio files whose durations match its video within 0.1 s; `du -sk` of demo-media is at most 61440 KB; frame grabs at 1 s and at the loop point show the OSD (linked); a second run yields the same file list and the same durations; THIRD_PARTY_NOTICES.md unchanged unless a new licensed source was used (then appended after step 37); the Homebrew rollback list and the voice used are recorded | implementation |
| 93 | [NEW, D50 (user scope addition; controller design under D39)] Generate the dummy evidence data with packages/shared/scripts/gen-demo-evidence.ts (Node built-ins only, run with `node --import tsx`, with an --as-of date option). For each step-31 dataset session it writes packages/shared/assets/demo-evidence/SESSION-<id>/ per design book §11.2: an evidence-container descriptor that references the step-92 media; metadata.json; manifest.json with the 13 §11.3 fields and a per-track SHA-256 over the real media; signature.sig, a detached Ed25519 signature over the manifest made with a DEMO key derived from a published demo seed; device-certificate.pem, self-signed and labelled DEMO; audit-session-extract.jsonl, hash-chained with the step-31 chain rule. It also writes export packages (zip built with macOS zip, plus an export manifest with the 8 §19.2 items) for the exported items, and exactly one TAMPERED package (one audio track altered after sealing). Finally it generates the typed, framework-free index module packages/shared/src/demo-data/ (entries keyed by the stable numeric suffixes of the dataset IDs, with paths, hashes, flags and precomputed verification results), a pure verify helper using @noble/hashes, and test/demo-evidence.test.ts. It never writes src/sim; the simulator is not wired to these files, and consumers join by ID suffix | coder-execution | implementation/65_demo_evidence.md (Tier 3) | 31, 92 | demo-evidence.test.ts passes: it recomputes every SHA-256 and verifies every Ed25519 signature and certificate with Node crypto (X509Certificate); the tampered package fails exactly one check (its altered track); every package holds the §11.2 items and every manifest the 13 §11.3 fields; every export zip's SHA-256 equals its export manifest; `grep -rn "node:" packages/shared/src/demo-data` finds nothing; shared typecheck exits 0; no private-key file is written anywhere | implementation |
| 94 | [NEW, D94; packaging spec accepted D104; controller design under D39; Gradle] Build the Android release APK per masterplan/06_packaging_spec.md §2. Steps: `expo prebuild --platform android --no-install` (no --clean), then `./gradlew assembleRelease` under .locks/gradle.lock with EXPO_NO_TELEMETRY. Signing: a DEMO PKCS12 keystore whose random password sits in the git-ignored apps/mobile/signing/release-signing.properties (mode 600, never logged), wired by the local config plugin plugins/with-dems-release-signing.js, failing fast when the properties file is missing. Three ABIs (arm64-v8a, armeabi-v7a, x86_64), set by a flag in the build script. versionName 0.1.0 and versionCode 100. Simulated-only: no cleartext, and step 91 disables the Heartbeat option in release. allowBackup false and the unused permissions blocked (app.json keys by hand-over). Scripts create-demo-keystore.sh and build-release-apk.sh. Output: release/android/DEMS-Demo-0.1.0.apk with its .sha256, SHA256SUMS.txt, BUILD-INFO.txt and INSTALL-ANDROID.md (adb-first, EN with an ID summary). Confirm release/ and apps/mobile/signing/ are git-ignored, appending only if step 100 did not | coder-execution | implementation/69_release_apk.md (Tier 3) | 61 | AC-PK-A1..A7 and A9 of 06 §2.10 with quoted output (A8 is run by step 63): apksigner "Verified" with one signer whose DN contains DEMO ONLY and is not the debug key; aapt2 shows versionCode 100, versionName 0.1.0, native-code arm64-v8a armeabi-v7a x86_64 only, and no debuggable flag; Hermes bundle magic present; 84/84 mobile media hashes found in the APK; manifest without cleartext, allowBackup false and the blocked permissions absent; `zipalign -c -P 16 -v 4` passes; `git check-ignore -q` passes for release/x and apps/mobile/signing/x; a Login screencap on dems_phone with no Metro and no reverse rules | implementation |
| 95 | [NEW, D94; packaging spec accepted D104; controller design under D39] Build the web packages per masterplan/06_packaging_spec.md §3–§4. First, the dependency-free launcher apps/mock-core/standalone/dems-web-launcher.cjs and its test apps/mock-core/test/standalone-launcher.test.ts. It uses Node built-ins only, serves static files, health and an RFC 6455 heartbeat, listens on port 4410 (fallback 4411–4419) on 127.0.0.1 only, runs single-instance, auto-opens the browser, prints an EN and ID banner, and supports --self-test. Then the packager scripts/release/build-web-packages.ts. It builds the web app with VITE_DEMS_CORE_ORIGIN=same-origin (step 100) into .cache/release/web-dist and produces six packages in release/web/: Node SEA single executables for macOS arm64, Windows x64 and Linux x64; an Intel-Mac bundle with the official notarized Node and a start script (SEA is unsupported on Intel Macs); a Windows fallback with the official signed node.exe (for Smart App Control); and an any-OS zip for PCs with Node installed, which replaces the static dist zip (a static-only build cannot sign in). It uses official Node archives verified against SHASUMS256 and fails closed on any mismatch; writes SHA256SUMS.txt, BUILD-INFO.txt and a .sha256 per file; and writes release/RUN-ON-ANOTHER-PC.md (EN, then an ID summary) | coder-execution | implementation/70_web_packager.md (Tier 3) | 61, 100 | AC-PK-W3..W8 of 06 §3.8 with quoted output: six packages with .sha256 and `shasum -a 256 -c SHA256SUMS.txt` all OK; every archive hash equals its SHASUMS256 line, and the Windows-fallback node.exe and the Intel-Mac runtime are byte-identical to the official binaries; the SEA fuse and marker are present in all three SEA binaries, `codesign --verify --strict` passes on macOS arm64, and `file` shows Mach-O arm64, PE32+ x86-64 and ELF 64-bit x86-64; `--self-test` exits 0 for the macOS arm64 SEA and for the any-OS zip on this Mac's Node; on 127.0.0.1:4410, /, /api/v1/health (schema-valid) and /ws answer and `lsof` shows only 127.0.0.1:4410; RUN-ON-ANOTHER-PC.md covers Windows, macOS arm64, macOS x64, Linux and Android with an ID summary, and every file name it cites exists | implementation |
| 96 | [NEW, D94; packaging spec accepted D104] Verify both packages from a clean state per masterplan/06_packaging_spec.md §5. Android: on dems_phone, then dems_tablet (booted with the D78 flags; the helper takes the AVD locks), uninstall the debug app first because the signatures differ. Install release/android/DEMS-Demo-0.1.0.apk fresh and smoke-test offline with no Metro, no adb reverse and no mock-core: launch, sign in as a demo operator, open Home, a live feed and an evidence item; the Heartbeat option is disabled. Web: copy the macOS arm64 SEA package to a folder outside the workspace and run it (app loads, health and /ws on one origin, no external requests); run the any-OS zip with this Mac's Node. Statically check the Windows x64 (SEA and fallback), Linux x64 and Intel-Mac packages (§5.3). Regression and clean-up per §5.4; stop every emulator and process this step started | verifier | verification/12_package_verification.md (Tier 2) | 94, 95 | Each check PASS or FAIL with quoted output and per-AVD screencaps; `file` shows Mach-O x86_64 for the Intel-Mac runtime, PE32+ x86-64 for both Windows packages and ELF x86-64 for Linux; every release file matches its .sha256; each FAIL routed to step 94, 95 or 100; no emulator or launcher process this step started is left running | verification |
| 97 | [BLOCKED, D87; controller ID 74b (scheduled in D73, F74-01); environment limitation accepted; not delegated again] Raise the two session emulators to normal scheduling priority with `taskpolicy -B -p <pid>` for the PIDs in .locks/*.pid (reversible with `taskpolicy -b -p <pid>`), then measure the median of 5 cold starts | coder-execution | implementation/67_emulator_priority.md (Tier 3) | 67, 74 | Target: threads in the 31T band and a median cold start of 4.5 s or less. Result per D87: BLOCKED, because the emulators return to the 4T band within 6–32 s and medians were 12.5–14.3 s. Follow-ups are in steps 60 and 61 and the final report | implementation |
| 98 | [DONE, D67; controller ID 93b; extra serial P1 slot] Add the ./demo-data export to packages/shared/package.json (one line, no install) | coder-execution | implementation/66_demo_data_export.md (Tier 3) | 93 | Done per D67 and the controller's rev 5 brief: the ./demo-data export is present in packages/shared/package.json; no npm install ran | implementation |
| 99 | [RUNNING, D93; controller ID 67b] Fix the device-session cap in apps/mobile/scripts/device-session.sh. Add a watchdog that ends a session at the 30-minute cap by killing only the session's own process group, then releases the AVD lock and removes that session's adb reverse rules. Confirm that the helper's boot path uses the D78 flags (-no-snapshot-load -no-snapshot-save) | coder-execution | implementation/68_device_session_cap.md (Tier 3) | 67, 83 | A test session with a shortened cap is ended by the watchdog; afterwards a `lockf -k -t 0` probe gets the lock, the session's reverse rules are gone, and processes outside the session's group survive; the helper's boot command carries both D78 flags (grep quoted) | implementation |
| 100 | [RUNNING, D104 (packaging spec §3.4, part of the D94 scope); controller design under D39] Add the same-origin Core address mode for packaged web builds per masterplan/06_packaging_spec.md §3.4: VITE_DEMS_CORE_ORIGIN, whose only meaningful value is same-origin, set by the packager only (no .env file); the new apps/core-web/src/lib/core-endpoint.ts (isSameOriginCore, coreHttpOrigin, coreWsUrl, allowedPageOrigins) and env.d.ts; the listed call sites switched through hand-overs from steps 38, 41, 43 and 53; backward-compatible shared changes (a fetchHealth origin parameter and a createOpenApiDocument serverUrl option, defaults unchanged); the Content-Security-Policy for the packaged build (§3.3, §3.5). Dev mode on 5173 stays unchanged. Per spec §6.1 it also appends release/ and apps/mobile/signing/ to .gitignore; if its delegation omitted that, step 94 does it | coder-execution | implementation/73_web_core_origin.md (Tier 3) | 38, 53 | AC-PK-W1: typecheck, lint and test exit 0 for shared, core-web, mobile and mock-core, with core-endpoint.test.ts (vi.stubEnv) and the shared fetchHealth-origin and serverUrl tests covering both modes; AC-PK-W2: dev regression with mock-core and Vite on 127.0.0.1:5173 shows heartbeat LIVE, health OK and Login enabled on /stack-check; the packaged-build CSP is present and quoted; no .env file exists | implementation |
| 101 | [RUNNING, D96; controller ID 45b] Fix the step-45 audit findings in the web UI through hand-overs of the finished owners' files: the systemic one-live-tile-video policy in components/media (F45-01); the ambient-registry slot reservation for shell escalation (F45-02); UTC+07:00 labels (F45-04); the meter label overlap (F45-05); the state-aware CRITICAL caption (F45-06); the arc clamp below 1024 px (F45-07); the one-line sealed label (F45-08). Never touch the simulator, the sim-adapters or the shell integrity-checks file (step 54 runs concurrently; F45-03 belongs to step 54) | coder-execution | implementation/71_visual_audit_fixes.md (Tier 3) | 45 | Each of F45-01, 02 and 04–08 listed with its fix and file:line; a test shows the Dashboard decodes only one live tile video at a time; core-web typecheck, lint and test exit 0; `git diff --stat` shows no change under packages/shared/src/sim, any features/*/sim-adapter.ts or the shell integrity-checks file | implementation |
| 102 | [RUNNING, D100; controller ID 67c; HOST] Add the second phone AVD dems_phone2 (pixel_10, API 36, boot port 5558, the step-72 debug APK installed, PIN 1234 and fingerprint enrolled), and extend apps/mobile/scripts/device-session.sh with the targets phone2, any-phone (the first free phone) and any (any free device), keeping the step-99 watchdog and the D78 boot flags | coder-execution | implementation/72_second_phone_avd.md (Tier 3) | 72, 99 | `avdmanager list avd` shows dems_phone2; it boots as emulator-5558 with the D78 flags; the installed APK's hash matches step 72's and the app launches; the enrolment state is recorded; with the dems_phone lock held, `any-phone` selects dems_phone2, and `any` selects a free device (probe output quoted); the rollback `avdmanager delete avd -n dems_phone2` is recorded | implementation |

### Status note (history kept outside the table)

- **Delivered outside the table** (controller-delegated, no row numbers):
  - `research/04_ui_design_analysis.md` (image-analyst).
  - `masterplan/03_motion_spec.md`, `masterplan/04_mobile_specs.md` and `masterplan/05_mobile_plan.md` (data-analyst).
- **Counts by tag (as designed)**:
  - 16 DONE (1–10, 12–16, 55).
  - 2 IN PROGRESS (17, 18).
  - 1 DROPPED (11).
  - 5 MERGED (20–24).
  - 3 PENDING, pre-approved (19, 25, 26).
  - 35 web, approved D38 (27–54, 56, 58, 60, 61, 62, 64, 66).
  - 29 mobile, approved D38 (57, 59, 63, 65, 67–91).
  - 2 new under D50 (92, 93).
  - 3 new under D94 (94, 95, 96).
  - 3 history rows for controller-scheduled steps: 97 = 74b (BLOCKED), 98 = 93b (DONE), 99 = 67b (row tag RUNNING; done per D98).
  - 1 new under D104: step 100 (RUNNING).
  - 2 more history rows: 101 = 45b (RUNNING, D96) and 102 = 67c (RUNNING, D100).
  - Total: 102.
- **Gate relaxations (D71, D72)**: steps 40, 45 and 74 ran as parallel audits, not gates. Their rows keep the original "before steps … start" wording because they had already started; blockers were routed to owners or to steps 54 and 91.
- **Execution status at rev 4** (the controller's `status_tasks.md` is authoritative; rows of started steps are not edited):
  - Done: 1–10, 12–19, 25–30, 55, 90.
  - Running: 31, 34, 35, 67, 68, 71.
  - Not started: 32, 33, 36–54, 56–66, 69, 70, 72–89, 91, 92, 93.
- **Conditional steps**: 54 and 91 (gap closures). The controller records SKIPPED with evidence when no gap is logged, and dependent steps treat SKIPPED as satisfied. Step 90 is no longer conditional (Q-M2 yes, D38).
- **05_mobile_plan mapping**: see the Refinement Log.

## Parallel Execution Protocol (D34, D35, 05 §5, D47, D50, D71, D72, D78, D94, D100, D103, D104): paste into every delegation of steps 25–102

**Limits** (this task only):
- **D71 and D72: at most 12 agents of one type and 16 in flight.** The original D34 limits were 6 and 8.
- The controller fills slots across lanes. Memory pressure is left to the OS (D72).

**The rules, numbered P1–P18** (P15, P16 and P18 withdrawn):

1. **P1 npm slot.**
   - Only steps 27 and 67 run `npm install` or `npm uninstall`, or edit a `package.json` or `package-lock.json`. Step 98 (93b) was the one extra serial slot the controller scheduled (the ./demo-data export, D67). Steps 92 and 93 install no npm package and add no script entries; their scripts run with `node --import tsx` (D49).
   - Each runs under `/usr/bin/lockf -k -t 3600 .locks/npm.lock <command>`, with 27 first.
   - Other steps keep working. A typecheck, test, Metro or Vite failure that happens during an install window is re-run after the lock is released (P11).
   - A missing package in any other step means `needs-review`; the controller schedules one extra serial npm slot (MINOR).
2. **P2 Gradle.**
   - Every `expo prebuild`, Gradle, `expo run:android` or `npm run build -w @dems/mobile` command runs under `/usr/bin/lockf -k -t 3600 .locks/gradle.lock <command>`.
   - Native builds happen only in steps 67 and 72, step 94 (the release APK, `assembleRelease`), step 61 (AC-28), and step 59 if a rebuild is needed.
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
   - **Amendments from execution:**
     - **Never kill or reboot an emulator (D78).** A lane that finds one down reboots it only with `-no-snapshot-load -no-snapshot-save` and reinstalls the current hash-verified step-72 debug APK. Steps 61 and 96 are the only steps that stop emulators.
     - Force-stop `com.dems.demo.tablet` before a step's first launch (D43).
     - Quote deep links passed through the device shell: `adb shell "am start … -d '<url>' …"` (D68).
     - Lock probes use `lockf -k` (D47).
     - The 30-minute session cap is enforced by step 99's wall-clock watchdog (D93, D98). Split long device work into several sessions. Keep the Mac awake while agents run: sleep stalls every agent (D98).
     - **Third AVD (D100)**: dems_phone2 boots with `-port 5558` (serial emulator-5558). device-session.sh accepts phone, phone2, tablet, any-phone (the first free phone) and any (any free device). Fast-lane device checks may use whichever device is free first.
     - **Sign-in on devices (D103)**: lanes sign in through the simulator's auth or biometric debug handle or debug deep links, not by typing. Each device check is time-boxed to about 10 minutes once a lock is held; otherwise it is deferred to step 59 with the reason.
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
   - **Live assignments since D72 and D85 supersede the table above.**
     - Web page coders share one Vite dev server on 127.0.0.1:5178 (P14).
     - Metro lanes 8081–8087 are assigned per step by the controller.
     - Steps 94–96 use no dev server. Step 96 runs the packaged launcher on the port the spec defines.
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
   - **Demo media and data (D50)**:

     | Path | Written only by |
     |---|---|
     | `packages/shared/scripts/gen-demo-media.*`, `packages/shared/assets/demo-media/**` | 92 |
     | `packages/shared/scripts/gen-demo-evidence.ts`, `packages/shared/src/demo-data/**`, `packages/shared/assets/demo-evidence/**`, `packages/shared/test/demo-evidence.test.ts` | 93 |
     | `apps/mobile/assets/media/**` | 72 (a copy of step 92's mobile subset) |

     Every other step only reads these.
   - **Release packaging (D94)**:

     | Path | Written only by |
     |---|---|
     | `apps/mobile/{plugins/with-dems-release-signing.js, scripts/create-demo-keystore.sh, scripts/build-release-apk.sh, signing/**}`, the release keys in `apps/mobile/app.json` (versionCode, allowBackup, blockedPermissions, plugin entry; by hand-over), `apps/mobile/android/**` (generated), `release/android/**` | 94 (06 §6.1) |
     | `apps/mock-core/standalone/**`, `apps/mock-core/test/standalone-launcher.test.ts`, `scripts/release/**`, `.cache/release/**`, `release/web/**`, `release/RUN-ON-ANOTHER-PC.md` | 95 (06 §6.1) |
     | `apps/core-web/src/lib/core-endpoint.ts`, `apps/core-web/src/env.d.ts`, the §3.4 call sites (by hand-over), `packages/shared/src/api/health.ts` and `openapi.ts` (backward-compatible options) | 100. It is sequenced with step 54's core-api and openapi hand-over: never two writers at once |
     | `.gitignore` | 7 and 25 earlier; then 100 (release/ and apps/mobile/signing/, 06 §6.1); 94 appends only if those lines are missing |
7. **P7 Processes.** Record every PID you start and stop it before you return (emulators excepted, P3). Never stop a process you did not start. Remove only your own `adb reverse` rules.
8. **P8 Progress files.** Write `delegation_progress/<agent_name>_step_<N>.md`, never a shared or per-type file.
9. **P9 Load** (10 cores, 24 GB):
   - Run vitest and jest with `--maxWorkers=2`.
   - Only steps 38, 58, 61, 95 and 100 (a same-origin check build) run `vite build`, never at the same time. Step 95 builds into .cache/release/web-dist, not apps/core-web/dist.
   - At most two Metro processes run at once, one per AVD session. One Gradle build at a time.
   - Build steps verify with typecheck, lint and their own tests, plus the device smoke for mobile steps.
10. **P10 Sandbox.** Port binding, the emulator, `adb` and Gradle need a per-command sandbox bypass (D14, D24). So do step 90's host write, step 92's Homebrew install of ffmpeg, and `sips` runs (D46).
11. **P11 Noise.** If a typecheck or test fails only in files owned by a step running at the same time, during an install window, or on a `tsbuildinfo` read, re-run it after the cause ends and record both runs.
12. **P12 Gaps and native needs.** A screen or page step that needs a new native module, a new package or a shared-contract change returns `needs-review` with the request. It never works around the rules.
13. **P13 Demo data (D50).**
    - Media and packages are regenerated only by steps 92 and 93, through their scripts.
    - Consumers resolve files through `@dems/shared/demo-data`, joining simulator objects to packages by the stable numeric suffix of their IDs. They never hard-code hashes.
    - Everything DEMO is labelled DEMO: the key, the certificate subject, the signature files, and verification results that were precomputed.
    - No private-key file is ever written.
    - Homebrew is touched only by step 92 (ffmpeg). The rollback is the exact uninstall list recorded in its log.
    - Lock probes use `lockf -k` (D47).
14. **P14 Shared web dev server (D71, D72).** Web page coders use one Vite dev server on 127.0.0.1:5178, reference-counted like mock-core through `.locks/vite.lock` and `.locks/vite.users/step-<N>`. The last user stops it.
15. **P15 (withdrawn, D72).** It serialised headless-Chrome checks.
16. **P16 (withdrawn, D72).** It set `--maxWorkers=1`. P9's `--maxWorkers=2` applies again.
17. **P17 Mobile device checks (D71).** They stay serialised by the AVD locks and device-session.sh, with at most 2 Metro processes at once (P3, P9).
18. **P18 (withdrawn, D72).** It throttled launches on memory pressure.

### Combined waves and collision scan (after the combined gate)

| Wave | Web lane | Mobile lane | Other agents | coder-execution | In flight (max) | Serial resources and notes |
|---|---|---|---|---|---|---|
| Now (D27) | 17, then 18 | none | none | 1 | 1 | Already running |
| Pre-gate (D1) | 19 | none | 26 (verifier) | 1 | 2 | Step 26 is read-only. Step 19 owns every process |
| **Gate** | APPROVED (D38) | APPROVED (D38) | none | 0 | 0 | none |
| W1 | 25 | none | git-specialist | 0 | 1 | Git-ignores .locks/ |
| W2 | 27 (npm), 29, 30 | 68, 71; then 67 (npm after 27; Gradle; boots both AVDs), 69 (after 30), 90 (Maestro install) | 28 (image-specialist) | 6 | 7 | npm.lock: 27, then 67. gradle.lock: 67 |
| W3 (live at rev 4: 31, 34, 35, 67, 68, 71 running) | A: 31, then 32 (takes the first freed slot, D45). B: 92 (D50) in the next freed slot after 31 lands, then 93 after 92; then 36 and 37. C: 38, 33 | 67 (finishing), 69, then 70 | none | 6 | 6 | Shared-lane noise handled by P11. 92 and 93 write only their D50 paths (P6). 39 now waits for 92; 72 waits for 28, 29, 35, 67 and 92 |
| W4 | 39 (after 92), 41, 42, 44 as slots free | 70, 72 (Gradle, after 92), 73 (after 32, 33, 34) | 40 (senior-code-reviewer, CP-1) | 6 | 7 | gradle.lock: 72. 93 finishes here at the latest; 47, 53 and 83 need it |
| W5 | 43, 46, 47 | 75, 77, 79 | 45 (verifier, CP-2, Vite 5173); 74 (senior-code-reviewer, CP-M1) | 6 | **8 (peak)** | 3 mobile coders share 2 AVD locks. Step 45 gates 48–53; step 74 gates 76, 78, 80–89 |
| W6 | 48, 49, 50 | 76, 78, 80 | none | 6 | 6 | AVD locks |
| W7 | 51, 52, 53 | 81, 82, 83 | none | 6 | 6 | AVD locks |
| W8 | 54 (conditional) | 84, 85, 86, 87, 88, 89 (up to 5 at once in lent slots) | none | 6 | 6 | Lent lanes on Metro 8084 and 8085. 5 coders share 2 AVDs through the locks |
| W9 | 56 | 91 (conditional; after 54) | test-expert | 1 | 2 | One simulator writer (91 after 54) |
| W10 | 58 (Vite 5173) | 57 (both AVDs, Metro 8085) | verifier, test-expert | 0 | 2 | mock-core shared (P5) |
| W11 | 60 (README) | 59 (both AVDs, Metro 8086) | verifier | 1 | 2 | MA-10 only as mock-core's sole user. Step 60 starts no servers |
| W8b (live, rev 6) | 100 (same-origin Core address and CSP), 101 (= 45b, visual-audit fixes) | 102 (= 67c, dems_phone2 and device-session targets) | none | 3 | 3 plus the running lanes | 100 gates 56, 58, 61 and 95; 101 gates 58; 102 gates 57, 59 and 61. Steps 100 and 54 must not edit packages/shared/src/api at the same time (P6) |
| W12 | 61 | (covered by 61) | verifier | 0 | 1 | Step 61 stops the session emulators (all three), then cold-boots (D78) and leaves none running. Needs steps 99, 100 and 102 done |
| W13 (rev 5, updated rev 6) | 95 (web packages: same-origin `vite build`, six packages, port 4410, one browser) | 94 (release APK: gradle.lock and the dems_phone lock) | none | 2 | 2 | Disjoint write sets (06 §6.1). .gitignore lines come from step 100; step 94 only fills gaps |
| W14 (rev 5) | 96 (launcher run from a copy outside the workspace; static checks) | 96 (fresh APK install on both AVDs, offline) | verifier | 0 | 1 | Step 96 boots the AVDs with the D78 flags and stops them at the end |
| W15 | 62, 64 | 63, 65 | security-review ×2, senior-code-reviewer ×2 | 0 | 4 | Read-only. They now also cover packaging (keystore, binary provenance, launcher network exposure) and depend on 96 |
| W16 | 66 | (covered by 66) | git-specialist | 0 | 1 | One combined commit; release/ never committed |

**Single-writer scan** (combined; extends 05 §4.3):

| Shared path | Writers, in order |
|---|---|
| `package-lock.json` | 27, then 67 (npm.lock) |
| `packages/shared/package.json` | 27, then 98 (93b: the ./demo-data export) |
| `.gitignore` | 7, 25, then 100 (release/ and apps/mobile/signing/); 94 only if those lines are missing |
| `release/**` | 94 (release/android/**), 95 (release/web/** and RUN-ON-ANOTHER-PC.md); disjoint; never committed |
| `apps/mobile/signing/**`, `apps/mobile/plugins/with-dems-release-signing.js`, the release build scripts | 94 |
| `apps/mock-core/standalone/**`, `scripts/release/**`, `.cache/release/**` | 95 |
| `apps/core-web/src/lib/core-endpoint.ts`, `env.d.ts`, the §3.4 call sites | 100 (by hand-over) |
| `packages/shared/src/api/{health,openapi}.ts` | 33 earlier; then 100 and 54 (its core-api/openapi hand-over), one at a time |
| `apps/mobile/scripts/device-session.sh` | 67, then 99 (67b: watchdog cap), then 102 (67c: phone2, any-phone, any targets) |
| `components/media` and the finished web owners' files named in D96 | 101 (45b; by hand-over; no sim, sim-adapter or integrity-checks files) |
| AVD dems_phone2 (host, ~/.android/avd) | 102 |
| `apps/mobile/package.json` | 67 |
| `packages/shared/src/sim/**` | 31, 32, 54, 91, all sequential |
| `packages/shared/src/brand/**` | 35 |
| `packages/shared/assets/**` | 28 (brand), 29 (hero), 92 (demo-media), 93 (demo-evidence); disjoint subfolders |
| `packages/shared/src/demo-data/**`, `packages/shared/test/demo-evidence.test.ts` | 93 |
| `apps/mobile/assets/media/**` | 72 |
| Homebrew (host) | 92 only (ffmpeg) |
| `packages/shared/src/i18n/**` | 34, then one web page step per namespace file |
| `packages/shared/src/realtime/format.ts` | 34 |
| `THIRD_PARTY_NOTICES.md` | 29, then 37, then 92 (only if it adds a new licensed source), then 60 (the D74 corrections) |
| `apps/mobile/app.json` | 67 (plugins), 72 (icon and splash), then 94 (release version keys) |
| `README.md` | 60 |
| Git index | 25, then 66 |
| `apps/mobile/android/` (generated) | 67, 72, 59 or 61 if rebuilding (gradle.lock) |
| `apps/mobile` hand-over files | See P6 |

**Limit check:**
- `coder-execution` never exceeds 6.
- Every other type stays at 2 or fewer (senior-code-reviewer ×2 and security-review ×2 only in W12).
- Peak in flight in this rev-3 plan is 8 (W5). Live execution ran under D71/D72 limits (up to 12 coders, 16 in flight), so W2–W11 were re-scheduled by the controller and the table records the planned shape.
- Waves after the gate: 16 (W1–W16; rev 5 adds W13 and W14 for packaging and moves the reviews to W15).
- History rows: 98 (93b) ran right after 93; 97 (74b) ran after 74 and is blocked; 99 (67b) is done (D98) and gates 57, 59 and 61; 101 (45b) gates 58; 102 (67c) gates 57, 59 and 61. Waves after the gate stay at 16; the live row W8b holds the rev-6 additions.

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
- **Internet**: step 27 (npm), step 29 (stock photo), step 67 (npm; Gradle cache warm from row 18), step 90 (Maestro zip), step 92 (Homebrew ffmpeg bottles), step 62 (`npm audit`).
- **Demo data (D50)**: step 92 needs 29 and 31. Step 93 needs 31 and 92. Consumers: 39 and 72 need 92; 47, 53 and 83 need 93; 42, 44 and 79 get the media through 39 and 72.
- **Release packaging (D94)**:
  - Steps 94 and 95 need the verified tree (61). Step 96 needs both. Steps 62–66 now also need 96.
  - `masterplan/06_packaging_spec.md` was accepted in D104. Steps 94–96 and 100 follow it.
  - Step 100 (same-origin Core address and CSP) must finish before 56, 58, 61 and 95 (06 §7.2). Steps 101 (45b) and 102 (67c) gate 58 and 57/59/61 respectively.
  - Internet: step 95 downloads official Node binaries plus SHASUMS256 from nodejs.org.
  - Sandbox bypass: step 94 (Gradle; one AVD launch), step 95 (port binding for the smoke run), step 96 (emulators, launcher run).
- **Browser**: steps 45 and 58 (agent-browser first).
- **Git identity** for steps 25 and 66 (R11).
- **Controller-owned artifacts, not rows**: `gateway_check/01_gate_report.md`, `status_tasks.md`, `delegation_progress_report.md`, `report/report.md`.

## Verification & Testing Strategy

- **Unit testing.**
  - Web and shared: tokens (30), auth and store (31), seven simulator tests (32), OpenAPI (33), i18n and formatDate (34), brand sync (35), compositions (39), one test per web page.
  - Mobile: T-M01..T-M15 spread over steps 68–89, each with a device smoke on both AVDs.
  - Test-expert halves: 56 (stack and web) and 57 (mobile, with the 4 Maestro flows on both AVDs; Q-M2 approved, D38).
  - Demo data (D50):
    - Step 92 is verified with ffprobe, frame grabs and a deterministic re-run.
    - Step 93's `demo-evidence.test.ts` recomputes every SHA-256 and Ed25519 signature; the tampered package fails exactly one check.
    - Steps 47 and 83 test the PASS and FAIL display.
    - Step 58 checks the browser re-verification and an export-zip hash.
  - Release packages (D94):
    - Step 94: `apksigner`, `aapt2` badging, APK contents, and one launch with no Metro.
    - Step 95: Node-binary checksums, a same-origin smoke run, a loopback-only listener.
    - Step 96: a fresh APK install on both AVDs, smoke-tested offline; the macOS arm64 launcher run from a copy outside the workspace; static checks on the other launchers.
    - Steps 62–65 review keystore handling, binary provenance and launcher network exposure.
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
| R36 | The PNG export tool is unproven (qlmanage renders SVG; hypothesis) | Closed (D48: Playwright Chromium was used) | none | none | 28 |
| R37 | Static packages carry fixed IDs and dates, while the simulator dates evidence relative to "now" (D28/Q7), so the manifest viewer and the list can disagree | Certain without mitigation | Visible inconsistency in the demo | Join by the stable ID suffix; step 93's --as-of option regenerates the packages for the demo date in seconds (media hashes unchanged); step 60 documents it | 93, 47, 83, 60 |
| R38 | H-DM-1: the macOS System Voice output may be licensed for personal, non-commercial use only (hypothesis; check the SLA on this host), which would conflict with a client demo | Medium | Licence issue with the interview audio | Step 62 checks the terms. Fallback: step 92's speech-like synthetic audio. Record the finding in the Drift Log | 92, 62 |
| R39 | H-DM-2: the Damayanti voice is not installed, and downloading it needs the System Settings GUI | Medium | No Indonesian voice | Speech-like synthetic fallback; no GUI download | 92 |
| R40 | ffmpeg brings a large Homebrew dependency tree | High | Host footprint and download time | Before-and-after `brew list` diff; exact uninstall list as the rollback; nothing else touched | 92, 61, 62 |
| R41 | Repository size grows by about 60 MB of media plus the export zips | Certain | Slower local git operations | 60 MB budget; zips only for exported items; local repo only | 92, 93, 66 |
| R42 | H-DM-3: Chrome WebCrypto Ed25519 is unavailable | Low–Medium | No live signature check in the browser | Show step 93's precomputed result, labelled | 47 |
| R43 | H-DM-4: three 720p H.264 decodes plus overlays break the AC-71 frame budget | Medium | Jank in the demo | Pause off-screen feeds; poster or procedural fallback; measured in steps 45 and 58 | 39, 42, 44, 45, 58 |
| R38, R39 (update) | macOS System Voice licence; Damayanti not installed | Closed (D74: eSpeak NG voice, no macOS voices) | none | Notices corrected by step 60 and checked by step 62 | 60, 62 |
| R44 | The release manifest allows no cleartext traffic (AC-26 main), so heartbeat mode (ws://) cannot work in the release APK | Resolved by design (D104) | none | Release is Simulated-only and step 91 disables the Heartbeat option in release builds; step 63 reviews | 91, 94, 63 |
| R51 | Android developer verification in Indonesia (from 30 Sep 2026) adds a one-time 24-hour advanced flow for tap-installing unregistered apps | Certain on new devices | Slow first install on another phone or tablet | adb-first guidance (step 94 INSTALL-ANDROID.md, step 95 RUN guide, step 60 README). A free Google developer registration would avoid it but needs an account (D5, D6): listed for the user | 60, 94, 95 |
| R52 | Steps 100 and 54 both touch packages/shared/src/api (openapi.ts and health.ts; 54's core-api and openapi hand-over) while both are running | Medium | Lost edits or a stale openapi.json | One writer at a time (P6): the controller confirms the order. The second step re-reads the file and re-runs the openapi drift test | 54, 100 |
| R53 | Host sleep stalls every agent and inflates lock holds (D98: clamshell sleep 07:08–09:12) | Medium | Hours lost | Keep the Mac awake with the lid open and power connected; the watchdog counts wall-clock time | all |
| R45 | The DEMO keystore leaks into git or logs | Low | Signing-key exposure (demo only) | Git-ignored by step 94 before creation; no passwords logged; steps 63 and 66 check | 94, 63, 66 |
| R46 | Node binaries bundled in the web launchers come from an unverified source | Low | Supply-chain risk | Official nodejs.org builds only, checked against SHASUMS256; steps 62 and 64 review | 95, 62, 64 |
| R47 | The Windows, Linux and Intel-Mac packages cannot be executed on this Mac (no Rosetta or Wine; Docker not used without explicit OK, D104) | Certain | Residual risk on those platforms | Static checks in step 96 (formats, checksums, SEA fuse and marker, byte-identity with official Node); troubleshooting in RUN-ON-ANOTHER-PC.md | 95, 96 |
| R48 | macOS Gatekeeper (quarantine) and Windows SmartScreen block unsigned launchers on another PC | High | The user cannot open the launcher with a double-click | RUN-ON-ANOTHER-PC.md gives the right-click Open / `xattr` and "More info → Run anyway" steps | 95 |
| R49 | Installing the release APK over the debug build fails (different signature) | Certain | Install error on the AVDs | Step 96 uninstalls the debug app first (app data lost, which is acceptable this late); device-level enrolment stays | 96 |
| R50 | Universal APK size (four ABIs plus media) | Medium | Slow sideload | Size recorded by step 94; the spec may add per-ABI APKs as an extra | 94 |

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

**Post-gate scope addition (D50, rev 4).** The user asked for dummy data files and videos. Under the standing authorisation (D39), the controller designed:
- step 92: demo media;
- step 93: evidence packages, including a tampered one;
- consumer updates to steps 39, 42, 44, 47, 53, 72, 79 and 83.

These are recorded as DR-25.

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
| 9 | Wiring demo-data into the simulator would put ffmpeg and media generation on the critical path of both lanes (32 feeds 42, 44 and 73) | High | DAG: 31, 32, then 38/39/73; 92 needs 29 and 31 | The simulator stays untouched. Consumers join by ID suffix through @dems/shared/demo-data. Any missing simulator field goes through SIM-GAP to steps 54 and 91 |
| 10 | Chrome's per-element audio-track switching is not generally available, so one MP4 with two audio streams cannot be switched reliably | Medium (knowledge, not tested here) | Design book §11.1: four independent tracks | AUDIO-01 and AUDIO-02 are separate files, synced to the video; per-track SHA-256 falls out naturally |
| 11 | The mobile app bundles only a lower-resolution subset, and there is no Ed25519 library in RN, so it cannot re-hash the originals | High | Step 72 subset; @noble/hashes has no Ed25519 | Mobile shows precomputed results from step 93, labelled "verified by the Core". Web (the Core console) re-verifies for real |
| 12 | The macOS System Voice licence may restrict commercial use (H-DM-1) | Medium (hypothesis) | macOS SLA, System Voices clause, to be read on this host | Step 62 checks it. Step 92 has a synthetic fallback |

### Priority Recommendations

| Priority | Recommendation | Rationale | Risk if Ignored | Target Phase/Task |
|---|---|---|---|---|
| P0 | Run steps 19 and 26 as soon as rows 17–18 are done | Gate approved (D38); they are the last pre-build checks | Idle critical path | 19, 26 |
| P0 | Record D37, D38, the SCR folding, the P1–P12 mechanics, the combined commit, the AC-67 path and the four process items from the gate section's scope check | Every delegation pastes the protocol | Collisions; lost audit trail | decisions.md |
| P0 | Run step 25, then launch W2 in one message | Rollback point, then both lanes start | Late start | 25, W2 |
| P0 | Put step 92 in the first web slot freed after 32 has started; run 93 right after 92 | 39 and 72 wait on 92; 47, 53 and 83 wait on 93 | The web and mobile media consumers stall | 92, 93 |
| P1 | Check the macOS System Voice licence before or during step 92 (H-DM-1) | Closed by D74 (eSpeak NG was used) | none | 92, 62 |
| P0 | After step 61, run 94 and 95 in parallel, then 96, then the four reviews 62–65, then 66 | The packaging tail (D94) sits between verification and the reviews | Reviews miss the packaging scripts; binaries committed | 94–96, 62–66 |
| P1 | Feed masterplan/06_packaging_spec.md into the delegations of 94–96 as soon as it lands | Done: accepted in D104 and applied in rev 6 | none | 94–96, 100 |
| P0 | Serialise the edits of steps 100 and 54 in packages/shared/src/api (R52) | Both are running and both touch openapi.ts and health.ts | Lost edits; openapi drift | 54, 100 |
| P1 | Put to the user in the final report: a free Google developer registration (removes the 24-hour advanced install flow) and a global App Nap opt-out (D87) | Both need user action or an account | Install friction; slow emulators | Final report |
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
- **coder-execution** (rows 8–19; steps 27, 29–39, 41–44, 46–54, 60, 67–73, 75–95, 97–102): every build step in both lanes, the README, the Maestro install, the demo media and data generators (92, 93), the release APK and web packager (94, 95), the same-origin Core address (100), and the controller-scheduled fixes (97–99, 101, 102). Its unrestricted tool set covers builds, `adb`, `sips` and the photo search.
- **image-specialist** (step 28): SVG brand mark and PNG exports. Image work only.
- **verifier** (row 13; steps 26, 45, 58, 59, 61, 96): independent checks. Step 96 verifies the release packages from a clean state. The web (58) and mobile (59) halves run in parallel. The stack check (61) runs last because it stops mock-core and the emulators.
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
- Rev 4 MAJOR entries: RL-66 and RL-67. This is a scope addition the user requested (D50), applied under the standing authorisation (D39), so no gate is needed.
- Rev 5 MAJOR entry: RL-76, steps 94–96. The user requested it (D94) and D39 covers it.
- Rev 6: no MAJOR entry. Step 100 and the spec details implement the already approved D94 scope (D104), and 101/102 are history rows (RL-85..RL-95).
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
| RL-66 | Rev 4: step 92 added (ffmpeg host install with rollback; demo media generator; per-session VIDEO-01 and VIDEO-02 at 720p and 25 fps with OSD; two separate audio tracks; loops, posters and a mobile subset; 60 MB budget) | 92 | **MAJOR** | New scope (D50, user request, approved under D39); supersedes D31 "no video files" |
| RL-67 | Rev 4: step 93 added (§11.2 packages with metadata, manifest, DEMO Ed25519 signature, DEMO certificate and hash-chained audit extract; export zips for exported items; exactly one tampered package; typed index module and verify helper; hash and signature tests) | 93 | **MAJOR** | New scope (D50) |
| RL-68 | The simulator is not wired to demo-data. Step 32 is unchanged; consumers join by ID suffix through @dems/shared/demo-data; gaps go through steps 54 and 91 | 32, 54, 91 | MINOR | Keeps media generation off the critical path of both lanes (controller asked which option was chosen) |
| RL-69 | Web consumers updated (none had started). 39: CameraFeed plays video with a procedural fallback; Depends On +92. 42: camera tiles. 44: live feed and track labels. 47: media tab with audio switch, in-browser re-verify, export zip, tampered FAIL; Depends On +93. 53: demo-data example payloads and the D45 Scalar agent/AI flags; Depends On +93 | 39, 42, 44, 47, 53 | MINOR | Within D50 |
| RL-70 | Mobile consumers updated (none had started). 72: mobile media subset with video in CameraFeed; Depends On +92. 79: live feed; Depends On +72. 83: play sheet with audio switch and precomputed verification status; Depends On +93 | 72, 79, 83 | MINOR | Within D50; running step 71 unaffected |
| RL-71 | End-pass rows updated (none had started). 56: demo-evidence tests. 58 and 59: tampered FAIL and videos play. 60: regeneration commands, DEMO notice, ffmpeg rollback. 61: step-92 rollback present. 62: DEMO key handling, ffmpeg footprint, System Voice licence. 63: synthetic media and DEMO labels. 64: demo-data portability. 66: no private-key file tracked | 56, 58–64, 66 | MINOR | Controller instruction (end pass) |
| RL-72 | Protocol: P13 added (demo data); P1 notes that 92 and 93 install nothing; P6 demo-path owners; P10 adds ffmpeg and sips; single-writer scan extended (demo paths, THIRD_PARTY_NOTICES order 29, 37, 92, Homebrew owned by 92) | Protocol | MINOR | D50, D46, D47 |
| RL-73 | Waves: 92 takes the next freed web slot after 31 lands (after 32, per D45); 93 follows 92; 39 and 72 now wait for 92; 47, 53 and 83 wait for 93. Peak (8) and wave count (13) unchanged | Waves | MINOR | Sequencing |
| RL-74 | Design choices for 92 and 93, recorded for the controller: separate audio files per track; a DEMO key derived from a published demo seed (reproducible, no key file); a certificate via Node or openssl, verified with Node X509Certificate; export zips via macOS zip for exported items only (other items download their export manifest JSON); --as-of regeneration for date alignment; mobile shows precomputed verification | 92, 93, 47, 83 | MINOR | Evidence in Key Findings 9–12 |
| RL-75 | Risks R37–R43 added (R36 closed by D48). Hypotheses H-DM-1..H-DM-4 added. Frontmatter revision 4, status `executing` | Document | MINOR | Documentation |
| RL-76 | Rev 5: steps 94 (release APK), 95 (web packager) and 96 (package verification) added, all referencing masterplan/06_packaging_spec.md | 94, 95, 96 | **MAJOR** | New scope requested by the user (D94); approved under the standing authorisation (D39), so no gate |
| RL-77 | History rows added for controller-scheduled steps, as integers because Step must be an integer: 97 = 74b (BLOCKED, D73/D87, log 67_emulator_priority.md), 98 = 93b (DONE, D67, log 66_demo_data_export.md), 99 = 67b (RUNNING, D93, log 68_device_session_cap.md) | 97, 98, 99 | MINOR | History completeness (controller request) |
| RL-78 | Dependencies: 62, 63, 64 and 65 add 96; 66 adds 96; 57, 59 and 61 add 99 (the watchdog cap and boot flags must be final before the long device sessions and the cold-boot run) | 57, 59, 61–66 | MINOR | Controller request; downstream rows not started |
| RL-79 | Reviewer focus lists extended: 62 covers launcher network exposure, Node-binary provenance, packaging scripts and release/ ignore (and drops the closed H-DM-1 check for D74's eSpeak NG facts); 63 covers keystore handling, release manifest cleartext and permissions, and APK provenance; 64 covers the packager code; 65 covers the release build config. Step 66 never commits release/ and checks it is ignored | 62–66 | MINOR | D94 |
| RL-80 | Rows synced with recorded rulings: 56 (F-49-3, D77); 57 (routes/guard updates D88/D90/D92, F74-06/21 D73, Maestro flags D47, loop pause D43); 59 (tablet re-checks D88/D90, D78); 60 (README items from D43, D47, D73, D84, D87, D88 and the release pointer; notices corrections D74); 61 (D42 greps, D73, D78, D87) | 56, 57, 59, 60, 61 | MINOR | Keeps the blueprint the single source; nothing new |
| RL-81 | Step 91 is now required, with the scope the controller routed to it: step 53's web SIM-GAPs, mobile gaps not absorbed by 54 (D93), and the mobile remediation list (D69, D73, D78, D83, D88, D90, D92, D93). Depends On adds 53 | 91 | MINOR | Controller routings. Atomicity flag: two parts (sim gaps, mobile fixes) in one remediation step; split on request |
| RL-82 | Protocol: limits 12/16 (D71, D72); P1 adds step 98; P2 adds step 94; P3 adds D78 (never kill or reboot an emulator), D43, D68, D47 and the step-99 cap; P4 notes the live lanes (5178 shared Vite, Metro 8081–8087); P6 adds packaging paths and .gitignore; P9 adds 95 to the `vite build` list; P14 and P17 added; P15, P16 and P18 recorded as withdrawn | Protocol | MINOR | D47, D68, D71, D72, D78, D93, D94 |
| RL-83 | Waves: W12 = 61 alone; new W13 (94 ∥ 95) and W14 (96); reviews moved to W15; commit W16. Waves after the gate: 16 | Waves | MINOR | Sequencing |
| RL-84 | Single-writer scan: packages/shared/package.json (27, then 98); .gitignore (7, 25, 94); release/** (94, 95); device-session.sh (67, then 99); THIRD_PARTY_NOTICES adds 60; app.json adds 94. Risks R44–R50 added; R38 and R39 closed (D74). Frontmatter revision 5 | Document | MINOR | Documentation |
| RL-85 | Rev 6: step 100 added (running): same-origin Core address (VITE_DEMS_CORE_ORIGIN) and CSP per 06 §3.4, output implementation/73_web_core_origin.md, depends on 38 and 53 (the controller's choice; the spec had proposed 53, 54 and 91) | 100 | MINOR | Part of the D94 packaging scope; spec accepted D104 (06 §7.3 #7) |
| RL-86 | History rows added as integers: 101 = 45b (visual-audit fixes, RUNNING, D96, log 71_visual_audit_fixes.md); 102 = 67c (dems_phone2 and device-session targets, RUNNING, D100, log 72_second_phone_avd.md) | 101, 102 | MINOR | History completeness (controller request) |
| RL-87 | Dependencies: 56, 58, 61 and 95 add 100; 58 adds 101; 57, 59 and 61 add 102 | 56–61, 95 | MINOR | Controller request; none of these rows had started |
| RL-88 | Step 94 rewritten to 06 §2: prebuild plus assembleRelease, a DEMO PKCS12 keystore with its password file in git-ignored apps/mobile/signing/, a config plugin, three ABIs (x86 dropped), versionName 0.1.0 and versionCode 100, Simulated-only, allowBackup false, blocked permissions, output release/android/DEMS-Demo-0.1.0.apk with INSTALL-ANDROID.md; verification AC-PK-A1..A7 and A9 | 94 | MINOR | 06 §7.3 deviations 1 and 5 |
| RL-89 | Step 95 rewritten to 06 §3–§4: the launcher (port 4410, loopback, single instance, --self-test), the packager, six packages (SEA for macOS arm64, Windows x64 and Linux x64; Intel-Mac official-node bundle; Windows official-node fallback; any-OS zip replacing the static zip), release/web/ with checksums and BUILD-INFO; verification AC-PK-W3..W8 | 95 | MINOR | 06 §7.3 deviations 2–4 |
| RL-90 | Step 96 aligned with 06 §5 (new APK path, Heartbeat disabled check, any-OS zip run, Intel-Mac now static only, FAILs also routed to 100) | 96 | MINOR | D104 |
| RL-91 | Step 91 adds: Heartbeat disabled in release builds with a `__DEV__`-false test (06 §2.6); S76-4 and pairingFailure (D95); M81-1..4 and F-81-1 (D99); M84-2 (D102) | 91 | MINOR | Controller routings |
| RL-92 | Step 60 adds the "Release packages" section (RUN guide pointer, both build commands, adb-first install because of Android developer verification in Indonesia from 30 Sep 2026) and the dems_phone2 and device-session targets (D100) | 60 | MINOR | 06 §6.1, D100, D104 |
| RL-93 | Step 66 adds the provenance check (no source newer than release/web/BUILD-INFO.txt) and the signing ignore checks; .gitignore lines now come from step 100 (06 §7.3 #6) | 66 | MINOR | 06 §6.1 |
| RL-94 | Steps 62–65 include the review additions of 06 §6.2; step 58 adds the D96 AC-71 re-measurement, the D101 build half of AC-73 and the D76 hand-off check; steps 57 and 59 add D95, D100 and D103 items | 57–59, 62–65 | MINOR | D76, D95, D96, D100, D101, D103 |
| RL-95 | Protocol and records: P3 adds dems_phone2 (port 5558), the device-session targets (D100), debug-handle sign-in and time-boxed device checks (D103), and the wall-clock watchdog (D98); P6 and the single-writer scan use the 06 §6.1 write sets and the 100/54 ordering; P9 adds 100; waves add the live row W8b; risks: R44 resolved, R47 widened, R51–R53 added | Protocol, risks | MINOR | D98, D100, D103, D104 |

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
| D50 (rev 4) | 92, 93 | implementation/64_demo_media.md; implementation/65_demo_evidence.md |
| D94 (rev 5) | 94, 95, 96 | implementation/69_release_apk.md; implementation/70_web_packager.md; verification/12_package_verification.md |
| Controller IDs 74b, 93b, 67b | 97, 98, 99 | implementation/67_emulator_priority.md; implementation/66_demo_data_export.md; implementation/68_device_session_cap.md |
| D104 (rev 6) | 100 | implementation/73_web_core_origin.md |
| Controller IDs 45b, 67c | 101, 102 | implementation/71_visual_audit_fixes.md; implementation/72_second_phone_avd.md |

---
*Generated: 2026-09-30 (revision 1; clock time not available to this agent)*
*Last Updated: 2026-10-01 (revision 6, packaging spec D104 applied, step 100 and history rows 101–102 added during live execution; clock time not available to this agent)*
