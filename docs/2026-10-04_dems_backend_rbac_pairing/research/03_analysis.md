---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: data-analyst
blueprint_row: 14 (FIRM)
tier: 1
type: mixed
confidence: MEDIUM
confidence_note: repository facts are HIGH (read from files and commands); every technology choice is MEDIUM because no candidate was installed or run in rows 6-12 (each record names the row that proves it by execution)
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/02_structured.md
last_updated: 2026-10-04 02:36
---

# Analysis Report: decision record for the DEMS backend, integrated RBAC and portal-mobile pairing

## 0. Reading guide

| Section | Content |
|---|---|
| 1 | Tier 1 frame: subject, stakeholders, timeline, scope, method, assumptions |
| 2 | Source tasks and the index of rows 1-12 (with the citation keys used below) |
| 3 | Overview, requirements, key findings |
| 4 | Technology decisions TD-01 to TD-13 |
| 5 | Architecture decisions ADQ-1 to ADQ-10 |
| 6 | Pinned versions and licences |
| 7 | Host Impact Register |
| 8 | The 25 impact questions mapped to document and section |
| 9 | Gap and risk register |
| 10 | External research synthesis (dimensions 1-7) |
| 11 | Security boundary for row 20 |
| 12 | Files and modules, implementation order, acceptance criteria, recommendations |
| 13 | Decisions for the controller to record |

**Citation convention.** `[R6:79]` means line 79 of the file with key R6 in the index (section 2.2). Every external fact (version, licence, guidance) is cited to the research line that holds its URL; all those URLs were fetched on 2026-10-04 (R6:9, R7:21, R8:15, R9:21, R10:25, R11:19, R12:34). `[BP:n]` and `[RT:n]` are lines of `identification/02_structured.md` (rev 1) and `identification/01_translated.md`. `[DEC:D5]` or `[DEC:F13]` is the row with that ID in `decisions/decisions.md`; IDs are used there, not line numbers, because the controller appends to that file while rows run (D10 and F20 were added during this row and are taken into account). A statement without a source is labelled **hypothesis** or carries an assumption ID (AS-n).

**No plan file.** This row writes only this file. `masterplan/02_plan.md` belongs to row 18 (BP:291).

---

## 1. Tier 1 frame

### 1.1 Subject

The 23 design decisions that the specification rows (15-18) need before they can be written: 13 technology choices (TD) and 10 architecture choices (ADQ) for a PostgreSQL-backed backend that becomes the single source of truth for the two DEMS demo clients, with server-enforced RBAC and a portal-issued device pairing (RT:86).

### 1.2 Stakeholders

| Stakeholder | Interest in this record |
|---|---|
| The user (demo owner and presenter) | A host change that is small and reversible (D5, DEC:D5); ready-made frameworks (I1, RT:163); the Simulated demo and the 0.1.0 packages keep working (RT:82) |
| Controller | Records the PostgreSQL route and the ADQ choices after this row (BP:591); needs each hand-built element and each departure named |
| Row 15, 17 (data-analyst), row 16 (database-specialist), row 18 (plan) | Take the choices as inputs; section 8 tells each which impact question it answers |
| Row 20 (security-review) | Needs the security boundary (section 11) and the deviations from public guidance (G-11, G-12, G-08) |
| Row 21 (task-architect) | Re-slices rows 23-118; section 12.2 lists the write-path corrections this record implies |
| Rows 23, 25, 57, 58, 77 (coder-execution) | Run the execution proofs this record defers to them |
| The owner of the other project on this Mac | Ports `[::1]:5173`, `127.0.0.1:5174`, `[::1]:5175` are never bound (BP:427) |

### 1.3 Timeline

| When (2026-10-04, WIB) | Event | Source |
|---|---|---|
| 00:47-01:26 | Translation and blueprint rev 1 (118 rows) | DEC:D4, DEC:D7 |
| 01:39-02:00 | Rows 1-13 completed (five inventories, seven collections, baseline gate) | file times of `research/` and `initialization/` (`ls -la`, this row) |
| 02:18 | This record (row 14, wave R3) | `date` printed `2026-10-04 02:18 WIB` |
| Next | Rows 15, then 16 and 17, then 18 and 20, 19, 21, 22 (BP:488-493). The docs commit of row 22 is the reference time for success criterion 1 | BP:295 |

No duration estimates are given (BP:657).

### 1.4 Scope

- **In scope**: one decision record per TD-01..TD-13 and ADQ-1..ADQ-10 with options, criteria, evidence, choice, rejected options and rollback; the Host Impact Register; the mapping of the 25 impact questions; the gap and risk register; the index of rows 1-12.
- **Out of scope**: the operation list, the permission matrix, table definitions, the wiring map and the work rows (rows 15-18). Where this record gives a value that those rows own (a port, a timeout, a table name), it is marked "input for row n".
- **Not done by this row**: no install, no code, no process other than read-only commands (section 3.4).

### 1.5 Method

1. Read `identification/01_translated.md`, `identification/02_structured.md`, `decisions/decisions.md`, the five inventories and the seven collections; read the baseline gate of row 13 because the D9 root-gate constraint depends on it.
2. For each topic: list the options the research collected, set criteria from the binding constraints (D4, D5, D9 and the controller's nine constraints for this row), weigh the evidence, choose, name the rejected options and state the rollback.
3. Where the evidence is declared metadata only (no run), name the row and the check that proves the choice by execution, and a fallback.
4. Verify repository facts that decide a choice with read-only commands (section 3.4).

### 1.6 Assumptions (each is labelled where it is used)

| ID | Assumption | Effect if wrong | Proven by |
|---|---|---|---|
| AS-01 | The npm-distributed PostgreSQL 18.4 binaries start on macOS 27 arm64 (not run by any source, R6:99, R6:540) | Fall back to the Homebrew keg (TD-02) | Row 23 trial T1-T8 |
| AS-02 | `drizzle-orm` 0.45.3, `drizzle-kit` 0.31.11 and `pg` 8.23.1 work on Node 26.8.2 with TypeScript 6.0.3 (declared ranges only, R7:285, R7:296) | Fall back to Kysely 0.29.6 (TD-03) | Row 25 scaffold proof |
| AS-03 | The shared simulator runs headless in a long-lived Node process (partial evidence only, R1:99, R1:698) | Fall back to hosting the pure transition functions with a server-owned loop (ADQ-1) | First step of row 37 |
| AS-04 | A store shaped like `SimState` and fed by socket messages keeps both clients as smooth as the in-app simulator (H-B4, BP:160) | Lower the wire rate and interpolate on the client | Rows 68, 87, 110 |
| AS-05 | A registry-driven `fetch` client works on Hermes under Expo SDK 57's default `expo/fetch` (static reading only, R9:194-195, R9:329) | Use the generator fallback of TD-09 | Row 58 emulator proof |
| AS-06 | `expo-secure-store` items, including one with `requireAuthentication`, can be written and read on the host AVDs (not run, R11:159) | Biometric unlock keeps the existing OS prompt as its only gate on emulators (TD-10) | Rows 77, 79 |
| AS-07 | A Vite dev proxy can forward `/api` and `/ws` to the backend without disturbing Vite's own socket | Use cross-origin calls with CORS and credentials (ADQ-6 fallback) | Row 62 |
| AS-08 | `crypto.argon2` on Node 26.8.2 behaves as documented (added v24.7.0, Stable, R10:124) | Use `@node-rs/argon2` 2.2.1 (TD-05 fallback) | Row 25 or 32 |
| AS-09 | In npm 11.19.1 a dependency's install script runs only after an `allowScripts` approval (local `npm help install-scripts`, section 3.4); the predecessor observed the opposite on 2026-10-01 ("warnings are advisory in this version", `docs/2026-09-30_dems_demo_stack_setup/delegation_progress/coder_execution_scaffold.md:51`) | None: the trial covers both behaviours | Row 23 trial T1 |
| AS-10 | The demo browser is Chromium-based (agent-browser first, BP:600); Safari has an open bug about session cookies on loopback hosts (R10:261) | The cookie session of ADQ-6 may not persist in Safari | Rows 64, 106 |

### 1.7 Alternatives considered

Each record in sections 4 and 5 lists its own alternatives. The three alternatives that would have changed the whole shape of the work, and why they were not taken:

| Alternative | Why not |
|---|---|
| Re-implement the domain rules in the server | 11,610 lines of tested shared behaviour already exist and are platform-neutral (R1:142, R1:98); two implementations would drift between Simulated and Live mode (ADQ-1) |
| Rewrite the clients' data layer as per-feature query hooks | 139 web and 96 mobile production files import the simulator (R3:670; DEC:F15); a Live store behind the same contract changes about 53 call-site files and 8 seam files (ADQ-2, ADQ-3) |
| A ready-made identity framework for sign-in, sessions, roles and rate limits (Better Auth 1.7.7) | Its model (e-mail accounts, admin and user roles, cookie cache, own tables) does not match usernames, three roles with a permission list, per-attempt audit rows in a hash chain and device-bound sessions; Fastify 5 and Node 26 support are not stated (R10:317, R10:524) (TD-06, TD-07) |

---

## 2. Source tasks and index of rows 1-12

### 2.1 Source tasks

- Structured: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/02_structured.md` (rev 1, 736 lines)
- Translated: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/01_translated.md` (376 lines)
- Original: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/01_original.md` (94 lines; Indonesian, verbatim; read through the translation)
- Decisions: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/decisions/decisions.md` (D1-D10, F1-F20 at the time of writing; D10 and F20 were added while this row ran)

### 2.2 Index of rows 1-12 (and row 13)

Line counts from `wc -l` run by this row.

| Key | Row | Agent | File (under the task folder) | Lines | What it establishes | Used by |
|---|---|---|---|---|---|---|
| R1 | 1 | explore | `research/01_explore.md` | 705 | Shared simulator: 42 actions, 33 slices, 7 engine subsystems, purity map, audit chain, RBAC gaps (F1-F23) | ADQ-1, ADQ-4, ADQ-9, TD-07 |
| R2 | 2 | explore | `research/01b_explore_contract_dataset.md` | 629 | API contract (10 operations), drift test assertions, network constants, seed dataset and date rules, demo packages, media | TD-09, ADQ-4, ADQ-5 |
| R3 | 3 | explore | `research/01c_explore_web.md` | 700 | Web: 167 files, simulator seam, 14 + 36 + 7 + 3 synchronous sites, client-side RBAC, origins, CSP (W-01..W-21) | ADQ-2, ADQ-3, ADQ-6, ADQ-7 |
| R4 | 4 | explore | `research/01d_explore_mobile.md` | 741 | Mobile: 140 files, tables S1-S5, Core link sources, no pairing gate, storage keys, cleartext policy (F-M1..F-M21) | ADQ-2, ADQ-3, ADQ-7, TD-10, TD-11 |
| R5 | 5 | explore | `research/01e_explore_services_packaging.md` | 577 | mock-core and launcher coupling, 748 pinned build inputs, root scripts, `.gitignore`, ports (F-E1..F-E22, DN-1..DN-6) | ADQ-5, ADQ-8, TD-12 |
| R6 | 6 | data-collector | `research/02_collection.md` | 577 | PostgreSQL without Docker: 12 candidates, host facts H1-H10, lifecycle commands | TD-02, TD-13 |
| R7 | 7 | data-collector | `research/02b_collection_data_access.md` | 373 | 13 access layers and migration tools, 2 drivers | TD-03, TD-04 |
| R8 | 8 | data-collector | `research/02c_collection_server_runtime.md` | 764 | Fastify 5 on Node 26, official plugins, fan-out patterns, authentication at upgrade | TD-01, TD-08, ADQ-6 |
| R9 | 9 | data-collector | `research/02d_collection_contract_tooling.md` | 405 | Contract approaches, typed clients on Hermes, conformance tools | TD-09 |
| R10 | 10 | data-collector | `research/02e_collection_identity_security.md` | 771 | Password hashing, session models, rotation, lockout, RBAC libraries, source-stated parameters P1-P26 | TD-05, TD-06, TD-07, section 11 |
| R11 | 11 | data-collector | `research/02f_collection_device_credential_qr.md` | 475 | Secure storage, QR rendering and scanning, AVD camera facts | TD-10, TD-11 |
| R12 | 12 | data-collector | `research/02g_collection_test_tooling.md` | 494 | Vitest 5 mechanics, injection, database isolation costs, socket tests, coverage, end-to-end tools | TD-12 |
| R13 | 13 | verifier | `initialization/02_baseline_gate.md` | 315 | Baseline: typecheck and lint green; tests green except 2 date-dependent web tests | TD-12, G-01 |

### 2.3 Data validation (step 2 of the analyst workflow)

All twelve research files exist, are non-empty and state their own gaps. No file was found to be missing a section this record needs, so no `DATA_INCOMPLETE` is raised. Three facts in the research needed a correction or a re-check by this row; they are recorded as G-01, G-02 and G-22 in section 9.

---

## 3. Overview, requirements, key findings

### 3.1 Overview

The research supports the blueprint's hypotheses with two refinements. First, the cheapest design that still makes the server authoritative is to run the shared simulator core headless inside the server and to replicate its state to the clients through a socket, because both clients already bind to that state shape. Second, the PostgreSQL route with the least host footprint is the npm-distributed binaries driven by project scripts with `pg_ctl`, with the Homebrew keg as the named fallback. Fifteen small elements are hand-built because no ready-made option fits; each is named with its reason in section 13.2. No finding forces a departure from D4, D5 or D9 in substance; two departures from D5's wording are flagged for the controller (section 13.3). One finding outside the 23 topics is already ruled by the controller: the baseline root test command is not green on any date other than 2026-10-01, and D10 schedules an early fix slot (G-01).

### 3.2 Requirements this record must satisfy

| # | Requirement | Source |
|---|---|---|
| RQ-1 | The server is the source of truth; a client-side permission table is a display hint only | Controller constraint 5; SC3-SC5 (RT:300-302) |
| RQ-2 | PostgreSQL with no Docker, no login or background service, no shell-profile edit, loopback only, non-default port, project-local git-ignored data directory, removable with one command | D5 (DEC:D5) |
| RQ-3 | Ready-made frameworks; prefer what is installed and proven on Node 26.8.2; name every hand-built element | I1 (RT:163); controller constraint 2 |
| RQ-4 | Root `npm run typecheck`, `npm run lint`, `npm test` work with no database running | D9 (DEC:D9) |
| RQ-5 | `release/` byte-identical; `apps/mock-core/**`, simulator semantics and `scripts/release/**` not rewritten; the 61 simulator-dependent test files stay green in Simulated mode | D9 DN-1; P21 (BP:476) |
| RQ-6 | Minimal client change, with the counts of F12 and F15 | Controller constraint 5 |
| RQ-7 | No new host-level tool for contract conformance; the typed client is proven on an emulator | Controller constraint 6 |
| RQ-8 | Security floor: salted memory-hard password hash; no secret in a log, URL, audit row or realtime event; every listener on 127.0.0.1; append-only audit with a serialised hash chain; denials audited | Controller constraint 8 |
| RQ-9 | Every chosen package pinned to an exact version and licence from the research | Controller constraint 9 |

### 3.3 Key findings

| # | Finding | Confidence | Evidence | Implication |
|---|---|---|---|---|
| KF-1 | Both clients read one store shape through `useSim(selector)` and act through one actions object; 88 web and 31 mobile production files call `useSim`, and many pure helpers take a whole `SimState` | HIGH | R3:50, R3:77; R4:47, R4:66 | A Live store with the same shape needs no change in the read path (ADQ-2) |
| KF-2 | The simulator's domain logic is platform-neutral, has a static test for it, and already runs in a Node script; three places are not pure | HIGH for the source facts, MEDIUM for long-running use | R1:98-100, R1:672, R1:684-686 | The server hosts the shared code (ADQ-1); AS-03 is proven in row 37 |
| KF-3 | The simulator is not safe as an authority: 25 of 42 actions have no permission check, the password check compares with one shared constant, pairing compares with one constant, and only the three export paths audit a denial | HIGH | R1:80-81, R1:85-86 | Identity, RBAC, pairing and denial audit are server-native modules, not hosted code (TD-05..TD-07, ADQ-1) |
| KF-4 | Synchronous coupling is concentrated: web 14 return-value sites, 36 throw sites (13 behind one wrapper), 7 read-after-write sites, 3 guards; mobile 9 return-value expressions in 6 files, 8 wrappers, 2 dialogs, 9 read-after-write sites, 27 production files in all | HIGH | R3:56-58, R3:181; R4:49-53, R4:735 | An asynchronous Live action contract touches about 26 web and 27 mobile production files (ADQ-3) |
| KF-5 | Fastify 5.12.5, `@fastify/websocket` 11.3.1, `ws` 8.22.0, zod 4.6.5 and vitest 5.0.3 are installed; the Fastify 5.x branch and the official plugins run CI on Node 26 | HIGH | R8:84, R8:110, R8:128; R12:44-49 | No new server framework is needed (TD-01, TD-08, TD-12) |
| KF-6 | The npm route for PostgreSQL has a candidate with four-platform coverage, but it is single-maintainer, two minor versions behind, needs an install script and ships no client tools; the Homebrew route is current and trusted but writes outside the project and is not removable with one command | HIGH | R6:73-84, R6:149-152 | TD-02 chooses the npm binaries with a trial and the keg as fallback |
| KF-7 | npm 11.19.1 on this host has an install-script approval policy; the root `package.json` approves exactly one package. The research's host fact H6 (`ignore-scripts=false`) does not cover it | HIGH | `npm help install-scripts` (section 3.4); `package.json` `allowScripts`; R6:33 | The npm route needs one reviewed `allowScripts` entry, or the binaries fail to load (R6:90-91) |
| KF-8 | The repository already builds its OpenAPI document from zod with a `--check` flag and a byte-equality test; every ready-made typed client examined is a generator that takes that document as input, and the two without a generator need zod 3 or Web Streams | HIGH | R9:173-177, R9:221-226, R9:242-243 | TD-09 keeps the zod registry as the one source and derives the client from it |
| KF-9 | Browsers cannot set an `Authorization` header on a socket upgrade; React Native can; React Native's cookie handling is documented as unstable; cookies are not isolated by port | HIGH | R8:400, R8:406; R10:282; R10:254 | Web uses a cookie over a same-origin proxy, mobile uses a bearer header (TD-06, ADQ-6) |
| KF-10 | The three AVDs have both cameras set to `none`; `expo-camera` is documented "Android (device only)" | HIGH | R11:100-104, R11:275 | QR scanning on the device is deferred (TD-11) |
| KF-11 | The baseline root test command cannot exit 0 on any date other than 2026-10-01: one web test uses a frozen evidence ID, and a second fails before about 02:25 WIB | HIGH | R13 section 6 (tests F-1, F-2); DEC:F20 | D10 already rules it: an early fix slot, and until then gate rows accept exactly these two failures by name (G-01) |
| KF-12 | All seed IDs and timestamps derive from the run date, while the demo packages and API examples are frozen at 2026-10-01 10:00 WIB and join by ID suffix | HIGH | R2:463-475, R2:520 | The seed clock rule is fixed in ADQ-4 |

### 3.4 Commands run by this row (read-only)

| Command | Output (quoted) | Used in |
|---|---|---|
| `node -v` | `v26.8.2` | Baseline for every pin |
| `cat package.json` (root) | `"allowScripts": { "@shopify/react-native-skia@2.6.2": true }`; scripts `typecheck`, `lint`, `test` as `npm run <x> --workspaces --if-present`; no root dependency block | TD-02, TD-12 |
| `npm help install-scripts` | "Dependency install scripts are blocked by default. Install commands silently skip lifecycle scripts for any dependency that does not have a matching entry in allowScripts"; `npm install-scripts approve <pkg>` "writes pinned entries (pkg@1.2.3)"; `npm install-scripts ls` "lists every package whose install scripts are not yet covered"; `prune` removes stale entries | TD-02, KF-7 |
| `grep -rn allowScripts docs/2026-09-30_dems_demo_stack_setup` | predecessor D41(e): "root `allowScripts` allows only @shopify/react-native-skia@2.6.2 (script reviewed)" (`decisions/decisions.md:44`); scaffold note "warnings are advisory in this version (scripts still ran)" (`delegation_progress/coder_execution_scaffold.md:51`) | AS-09 |
| `ls node_modules/pg` | `No such file or directory` | TD-03 (the driver is a new dependency) |
| `ls node_modules/.bin \| grep -E '^(tsx\|drizzle\|vitest\|oxlint)'` | `oxlint`, `tsx`, `vitest` | TD-01, TD-12 |
| `cat apps/mock-core/package.json` | `fastify 5.12.5`, `@fastify/cors 11.3.0`, `@fastify/websocket 11.3.1`, `tsx 4.23.15`, dev `@types/node 26.6.3`, `@types/ws 8.18.2`, `oxlint 1.86.0`, `typescript 6.0.3`, `vitest 5.0.3`, `ws 8.22.0` | Section 6 |
| `sed -n '1,70p' apps/core-web/src/main.tsx` | lines 18-21: `z.config({ jitless: true })`, then `await import('@dems/shared/sim')`, `await import('./i18n')`, `await import('./router')`; lines 37-38: `createSim(...)`, `createAppRouter({ sim, queryClient })` | ADQ-2, ADQ-3 (the entry already awaits before the router is built) |
| `sed -n '1,40p' apps/core-web/vite.config.ts` | line 18: `server: { host: '127.0.0.1', port: 5173, strictPort: true }`; no `proxy` key | ADQ-6 |
| `sed -n '40,52p' packages/shared/src/sim/selectors.ts` | lines 49-50: `selectCan = (s, permission) => roleHas(selectRole(s), permission)` | ADQ-2, TD-07 |
| `sed -n '36,65p' .gitignore` | `.env`, `.env.*`, `.cache/`, `*.log`, `.locks/`, `/release/`; no `.data/` rule | TD-02 |
| `date` | `2026-10-04 02:18 WIB` | Timeline |

---

## 4. Technology decisions

Record format: options, criteria, evidence, choice (with the pinned version or the named pattern), rejected options, rollback, hand-built elements, and the row that proves the choice by execution.

### TD-01 Backend framework

| Field | Content |
|---|---|
| Options | (A) Fastify 5.12.5 with its official plugins, as mock-core uses today. (B) A different HTTP framework. (C) A realtime server framework (Colyseus) or a native socket server (uWebSockets.js through `fastify-uws`) |
| Criteria | Installed and proven on Node 26.8.2 (controller constraint 2); official plugins for the needs of a database-backed API; in-process injection for tests; loopback binding under our control |
| Evidence | Fastify 5.12.5 equals the npm `latest` tag and is installed (R8:84, R8:90). The 5.x branch runs CI on Node 20, 22, 24, 26 (R8:110); the nine official plugins checked inherit a CI matrix that includes Node 26 (R8:128). The app-factory pattern with no `listen` exists in mock-core and is what Fastify's testing guide advises (R5:106; R12:85). `fastify-type-provider-zod` 7.0.0 accepts the repo's zod 4.6.5 and validates requests and serialises responses through zod schemas (R8:275-276; R9:276). Fastify's default logger writes request URLs with no redaction (R5:128) |
| Choice | **Fastify 5.12.5** in a new workspace, run from TypeScript source with `tsx` 4.23.15 as mock-core is (R5:134-135). Plugins: `@fastify/websocket` **11.3.1** (the installed pin; see note), `@fastify/cookie` **11.1.2**, `@fastify/rate-limit` **11.2.0**, `fastify-type-provider-zod` **7.0.0** (its peers `@fastify/swagger` **9.9.1** and `openapi-types` **12.1.3** are installed but `@fastify/swagger` is not registered, see TD-09), `@fastify/static` **10.1.5** only if row 15 assigns media serving to the server (range requests are built in, R8:257). Optional, for row 20 to confirm: `@fastify/helmet` **13.1.1** for response security headers (R8:175). All MIT (R8:153-166, R8:175) |
| Note on `@fastify/websocket` | Registry latest is 11.3.3, published 2026-10-03T14:44Z, about 11 hours before the lookup (R8:90). The pin stays at 11.3.1: it is the version proven in this repo, a second version would add a second copy next to mock-core's (hypothesis on hoisting in R5:366), and a release that is hours old has no track record |
| Logging rule (input for row 15) | No secret ever travels in a URL (TD-06, TD-08), so the request URL may be logged; headers `authorization`, `cookie`, `set-cookie` and the request and response bodies of the sign-in and pairing operations are never logged. The redaction is a configuration of Fastify's built-in logger, not hand-written code (**hypothesis**: the option names are not in the research; row 25 confirms them and row 32 proves it with a log-capture test, BP:305) |
| Rejected | (B): no evidence was collected for another framework, and adding one for the same job contradicts controller constraint 2. (C) Colyseus is a whole game-server framework with its own peers (`express`, `@pm2/io`) (R8:193, R8:317); uWebSockets.js is not on the npm registry and its Fastify bridge lists Node 20, 22, 24 only (R8:190, R8:303). `@fastify/session` and `@fastify/secure-session`: see TD-06. `@fastify/cors`: not registered, see ADQ-6. `@fastify/under-pressure`: not needed; the event-loop delay is measured in row 110 with Node's `perf_hooks` (R8:344) |
| Rollback | Remove the workspace folder and its lockfile entries (`git checkout acaff20 -- package.json package-lock.json`, then `npm install` under the npm lock). Both clients keep working in Simulated mode because nothing in them depends on the server until the Live source is selected (ADQ-7) |
| Hand-built | None in this record |
| Proof | Row 25: `npm install` exits 0 with only the pinned packages in the lockfile diff; typecheck, lint and one `app.inject` test pass on Node 26.8.2 |

### TD-02 PostgreSQL provisioning (D5 preference order weighed against the evidence)

**Options and criteria**

| Criterion (weight) | C1 `embedded-postgres` 18.4.0-beta.17 (npm), binaries driven by project scripts | C3 Homebrew keg `postgresql@18` 18.6 with `pg_ctl` | C2 `@serve-tools/postgres` 0.1.0 (npm) | C5 `theseus-rs/postgresql-binaries` 18.6.0 (archive) | C4 PGlite 0.5.8 |
|---|---|---|---|---|---|
| A real PostgreSQL server (request constraint "the database is PostgreSQL", RT:155) | Yes: `initdb`, `pg_ctl`, `postgres` (R6:80) | Yes | Yes | Yes | No: WebAssembly, single user and single connection (R6:175) |
| D5: no Docker, no service, no profile edit | Met | Met only without `brew services` (R6:356) | Met | Met | Met |
| D5: nothing outside the project | **Met**: `node_modules` and the data directory only (R6:83) | **Not met**: Cellar, symlink trees under `/opt/homebrew`, a default cluster at `/opt/homebrew/var/postgresql@18`, one new dependency `krb5` (R6:148-149) | Met | Met, but a project script must download and unpack it (R6:205) | Met |
| D5: removable with one command | `npm uninstall` plus deleting the data directory (R6:83) | **Not met**: four to five commands; the default cluster and log stay after `brew uninstall` (R6:152) | As C1 | Delete two folders | As C1 |
| Supply-chain trust (F13, controller constraint 1) | One npm maintainer; repository since 2022, 147 stars, last push 2026-06-05; binaries come from the zonky project (R6:76-77). Provenance attestation: **not recorded by the research** | Homebrew core formula and bottle (R6:145) | **Excluded by the controller's rule**: created 2026-08-07, one maintainer, no attestation returned (R6:117-118) | GitHub organisation, 78 stars, one checksum file per archive (R6:198-199) | Four maintainers, 16,116 stars (R6:172) |
| PostgreSQL minor | 18.4, two behind the current 18.6 (R6:74) | 18.6, current (R6:143) | 18.4 | 18.6 | not confirmed (R6:170) |
| Client tools | None: no `psql`, no `pg_dump` (R6:80) | Full set (R6:151) | Full set | Full set | n/a |
| Licence | MIT wrapper; README says the binaries are Apache-2.0; no PostgreSQL licence text in the package (R6:75) | PostgreSQL (R6:144) | PostgreSQL with the text shipped (R6:116) | PostgreSQL (R6:197) | Apache-2.0 or PostgreSQL (R6:171) |
| Install-time code | A `postinstall` that recreates dylib symlinks (R6:84) | Formula post-install steps (R6:149) | None | None | None |
| Node 26 | Not tested by the project; CI on Node 20 only; the wrapper is pure JavaScript (R6:99) | Not applicable | CI on Linux only for Node 26 (R6:127) | Not applicable | Open Node issue about WebAssembly crashes (R6:180) |
| Fits P20 ("npm registry, and Homebrew on the keg route", BP:475) | Yes | Yes | Yes | **No**: a GitHub download | Yes |
| Serves the portable cost (TD-13) | Four platforms from one dependency (R6:78) | No Windows bottle, no Intel macOS bottle for `@18` (R6:146) | Four platforms | Four platforms | All |

**Choice: C1, the npm-distributed binaries, used without the wrapper's lifecycle API.** Pinned: `embedded-postgres` **18.4.0-beta.17** (MIT), which installs `@embedded-postgres/darwin-arm64` **18.4.0-beta.17** (PostgreSQL **18.4**), 147,710,671 bytes unpacked (R6:73, R6:79).

Reasons:

1. It is the only route that meets all four D5 rules together. The keg writes to four places outside the project and its removal is not one command (R6:149, R6:152); D5 states "nothing else on the host is touched" and "removable with one command" (DEC:D5).
2. Supply-chain trust is acceptable with the mitigations below, and it is not the case the controller excluded (that case is C2). The trust gap against Homebrew is real and is stated, not hidden.
3. **Stated reason for accepting a "beta" version** (controller constraint 1): the suffix `-beta.NN` is part of every release name of this package from 9.x to 18.x and the only dist-tag is `latest`; it is a build counter, not a pre-release channel next to a stable one (R6:73).
4. The open defects of the package are in the wrapper's lifecycle code (`stop()` stalls, no start timeout, password temp file mode, forced shutdown: issues #32, #34, #33, #38, R6:92-95). The project scripts call `initdb` and `pg_ctl` directly, which the platform package documents as supported use (R6:82), so none of that code runs.
5. The missing client tools are not needed: migration, seed, reset and status all go through the Node driver (TD-03, TD-04).

Mitigations that are part of the choice:

| # | Mitigation | Evidence or reason |
|---|---|---|
| M1 | Exact version in `package.json` (`.npmrc` has `save-exact=true`, R5:85) and the tarball integrity hash in the lockfile | Reproducible install |
| M2 | The one install script (`scripts/hydrate-symlinks.js`) and `native/pg-symlinks.json` are read before approval, and the approval is a pinned `allowScripts` entry, as the predecessor did for its one approved package (section 3.4) | R6:84; KF-7 |
| M3 | The wrapper's JavaScript is not imported by any project script | R6:92-95 |
| M4 | `npm audit signatures` is run in the trial and its output recorded (it closes the provenance gap) | Supply-chain criterion |
| M5 | The server binds 127.0.0.1 only, with password authentication, as the user's own uid | D5; R6:455 |
| M6 | `THIRD_PARTY_NOTICES.md` gains the PostgreSQL License text and the note on the binaries' packaging licence, append-only (D9 DN-2) | R6:75 |

**Named fallback: C3, Homebrew keg `postgresql@18` 18.6**, used if any trial step T1-T7 fails. Its extra footprint and its removal steps go into the Host Impact Register (section 7, H-12). D5 names `postgresql@17`; this record proposes `@18` so that the fallback has the same major version as the primary (see section 13.3, DEPARTURE-1).

**Rejected**: C2 (controller's supply-chain rule, R6:117-118); C4 PGlite (not a server process, one connection, R6:175, R6:182); C5 and C6 (direct downloads outside P20; a download script would be hand-built; C5 stays the reference for TD-13); C7 Postgres.app (a DMG into `/Applications`, macOS only, R6:247-250); C8 EDB archives (macOS architecture unconfirmed, Rosetta absent, 445 MB, R6:267-268, R6:32); C9, C10, C11 (stale or PostgreSQL 18.0, R6:286, R6:307, R6:319); C12 (conda absent, R6:333); X1-X7 (Docker, launchd, cloud; R6:353-359).

**Fixed parameters (inputs for rows 18 and 23)**

| Item | Value | Reason |
|---|---|---|
| Listener | `127.0.0.1:4432`, TCP only | Never 5432 (BP:435); below the 49152-65535 dynamic range so no client socket can take it (**hypothesis** on the range, general knowledge); in the DEMS 44xx family; row 24 probes that it is free (BP:297) |
| Unix socket | Disabled (`unix_socket_directories = ''`) | The default socket directory is `/tmp`, outside the project (R6:456) |
| Data directory | `.data/postgres/` | BP:197; `.gitignore` has no rule yet (R5:400), so row 23 adds `/.data/` first |
| Credentials | `.data/pg.pwfile` (mode 0600, generated, never printed); connection settings in `.data/pg.env` | They are created and removed with the cluster; `.env*` and `.data/` are git-ignored |
| Roles (input for row 16) | `dems_admin` (cluster owner; migrations, reset, test databases) and `dems_app` (the server's runtime role, without UPDATE, DELETE or TRUNCATE on the audit table) | The audit table's append-only rule is then a database feature (BP:289) |
| Databases | `dems_demo`; `dems_test_*` per test file (TD-12); `dems_lane_1..3` if lanes are enabled (ADQ-10) | P15 (BP:458) |
| Process | Started and stopped by `scripts/pg/` only; PID in `.locks/postgres.pid`; no launchd job, no Docker, no shell-profile edit | D5; P15 |

**Commands (derived from the PostgreSQL 18 documentation and the package facts, R6:451-457, R6:80-84; none was executed; row 23 runs them outside the sandbox where a port is bound, P10)**

```sh
# Variables
ROOT=/Users/gsp-budi/Documents/DEMS
PGBIN="$ROOT/node_modules/@embedded-postgres/darwin-arm64/native/bin"
PGDATA="$ROOT/.data/postgres"

# 1. Install (npm slot 1). Add "/.data/" to .gitignore first and check it:
git -C "$ROOT" check-ignore -v .data/postgres .data/pg.pwfile
/usr/bin/lockf -k -t 3600 "$ROOT/.locks/npm.lock" npm install --save-dev --save-exact embedded-postgres@18.4.0-beta.17 pg@8.23.1
npm install-scripts ls                                    # expect @embedded-postgres/darwin-arm64
# read node_modules/@embedded-postgres/darwin-arm64/scripts/hydrate-symlinks.js, then:
npm install-scripts approve @embedded-postgres/darwin-arm64
npm rebuild @embedded-postgres/darwin-arm64               # runs the approved postinstall

# 2. Init (once)
umask 077 && mkdir -p "$ROOT/.data"
node -e "require('node:fs').writeFileSync(process.argv[1], require('node:crypto').randomBytes(24).toString('base64url'), { mode: 0o600, flag: 'wx' })" "$ROOT/.data/pg.pwfile"
"$PGBIN/initdb" -D "$PGDATA" -U dems_admin -A scram-sha-256 --pwfile="$ROOT/.data/pg.pwfile" -E UTF8 --locale=C
printf "listen_addresses = '127.0.0.1'\nport = 4432\nunix_socket_directories = ''\n" >> "$PGDATA/postgresql.conf"

# 3. Start, status, stop
"$PGBIN/pg_ctl" -D "$PGDATA" -l "$ROOT/.data/postgres.log" -w -t 30 start
"$PGBIN/pg_ctl" -D "$PGDATA" status
"$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop

# 4. Removal (wrapped as one command: npm run pg:remove)
"$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop              # ignore "no server running"
rm -rf "$ROOT/.data"
/usr/bin/lockf -k -t 3600 "$ROOT/.locks/npm.lock" npm uninstall embedded-postgres
npm install-scripts prune
```

Notes on the commands: `-E`, `--locale` and `-w`, `-t` are standard `initdb` and `pg_ctl` options; `-E` and `--locale` are not in the research's option list (R6:454), so row 23 checks them with `initdb --help` before use. That `pg_ctl -w` reports readiness without a Unix socket is a **hypothesis**; if it does not, the socket directory becomes the project-local `.data/pg-run`. `npm rebuild` running the approved script is a **hypothesis** from npm's documented behaviour; the alternative is to run the reviewed script directly with `node`. The settings are written to `postgresql.conf` so that no start command can open another interface by omission; `listen_addresses` defaults to `localhost` in any case (R6:455).

**Fallback commands (Homebrew keg; not executed)**

```sh
HOMEBREW_NO_AUTO_UPDATE=1 brew install postgresql@18      # also installs krb5 (R6:148)
PGBIN=/opt/homebrew/opt/postgresql@18/bin                 # then steps 2 and 3 unchanged
# Removal
"$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop; rm -rf "$ROOT/.data"
brew uninstall postgresql@18
rm -rf /opt/homebrew/var/postgresql@18 /opt/homebrew/var/log/postgresql@18.log   # the default cluster the formula created (R6:149, R6:152)
brew uninstall krb5        # only if it was installed by this step and nothing else uses it
brew cleanup --prune-prefix
```

`brew autoremove` is not used: it would uninstall every formula that is no longer needed, not only `krb5` (R6:152).

**Execution trial that row 23 runs before anything depends on the database**

| Step | Check | Pass condition |
|---|---|---|
| T1 | Install, list, review, approve, rebuild | `npm install` exits 0; the lockfile diff holds only the pinned packages and their dependencies; the link named by issue #30 (`libicudata.77.dylib`) exists under `native/lib` (R6:90) |
| T2 | `"$PGBIN/postgres" --version`; `xattr -l` and `codesign -dv` on the binary | Prints `postgres (PostgreSQL) 18.4`; no load error; quarantine and signature state recorded (closes R6:546) |
| T3 | `initdb` | Exit 0; `.data/postgres/PG_VERSION` is `18` |
| T4 | Start, then `lsof -nP -iTCP:4432 -sTCP:LISTEN` | One listener on `127.0.0.1:4432`; no other PostgreSQL listener |
| T5 | `SELECT version()` through `pg` 8.23.1 on Node 26.8.2 over 127.0.0.1; create a scratch database; `CREATE DATABASE b TEMPLATE a`; drop both | The version string names 18.4; the clone succeeds (TD-12 depends on it) |
| T6 | Write a row, stop with `-m fast`, start, read the row | The row is there |
| T7 | Stop; `pgrep -x postgres`; `launchctl list \| grep -i postgres`; `brew services list` | No process, no launchd job, no service entry |
| T8 | `npm audit signatures`; `npm install-scripts ls` | Output recorded; `ls` prints no unreviewed script |

Fail on any of T1-T7: run the removal commands, record a drift entry, switch to the fallback, and repeat T2-T7 with the keg's `PGBIN`. T8 is recorded, not gating; a failed registry signature (not a missing attestation) is treated as a T1 failure.

**Rollback**: the removal block above. It is proven again by row 105 (BP:378).

**Hand-built**: the scripts under `scripts/pg/` (start, stop, status, remove), about 20 lines each, as plain `.mjs` so that they run without the `tsx` CLI (which fails inside the sandbox, R2:178). Reason: the ready-made lifecycle code is the wrapper, whose open defects are listed above (R6:92-95).

### TD-03 Data access

| Field | Content |
|---|---|
| Options | Drizzle ORM 0.45.3; Prisma 7.10.0; Kysely 0.29.6; MikroORM 7.2.3; Knex 3.3.0; TypeORM 1.1.1; Slonik 49.10.10; type generators (PgTyped, Zapatos, sqlc); drivers `pg` 8.23.1 and `postgres` 3.4.9 |
| Criteria | Typed schema in TypeScript that satisfies the base tsconfig (`erasableSyntaxOnly`, `verbatimModuleSyntax`, R5:371-376, R5:386); plain SQL migrations that can carry triggers and grants (the audit table's rules are database features, BP:289); transactions; maintenance; no account; small install |
| Evidence | Drizzle: the table schema in TypeScript is the source of truth, types by inference, drivers `pg` or `postgres`, Apache-2.0, 0.45.3 published 2026-09-21 (R7:59, R7:64, R7:70); no `engines` field and no TypeScript peer, so nothing is declared for Node 26 or TypeScript 6 (R7:73, R7:285). Its docs describe the `rc` line (1.0.0-rc.4, 2026-06-27), which is older than the `latest` release (R7:65, R7:72). Prisma: the CLI's `latest` tag points to 8.0.0-rc.19 while `@prisma/client` `latest` is 7.10.0; version 8 changes the migration model; the client is 74 MB (R7:83-88, R7:94). Kysely: types only, hand-written `Database` interface or a separate generator, TypeScript migrations, three packages with their own ranges (R7:115-124). MikroORM and TypeORM: entity classes with decorators or class syntax (R7:150, R7:164). PgTyped: peer `typescript 3.1 - 5` excludes 6.0.3 (R7:197). `pg` 8.23.1: MIT, published 2026-09-30, CI matrix includes Node 26 against PostgreSQL 13 to 18 (R7:252; R6:99) |
| Choice | **`drizzle-orm` 0.45.3 (Apache-2.0)** over the driver **`pg` 8.23.1 (MIT)**. `@types/pg`: version **not confirmed** by the research; row 25 pins the registry's current 8.x at install time and records it. The `rc` line is not used. `drizzle-zod` is not added: the contract's zod schemas stay the only validation source (TD-09), and rows are mapped to contract shapes in the module code |
| Rejected | Prisma 7 (the tag trap, the generated client, a second schema language); Prisma 8 (release candidate, R7:89); Kysely as primary (no schema ownership, so migrations and types would be two more tools); MikroORM, TypeORM (class and decorator models against `erasableSyntaxOnly`; TypeORM runs migrations on compiled `.js` only, R7:147); Knex (typing "best-effort", R7:134); Slonik (migrator peer range excludes the current core, R7:177); PgTyped (TypeScript peer); Zapatos (last push 2025-09, R7:210); sqlc (a Go binary, and its TypeScript plugin is "early access", R7:218); `postgres` 3.4.9 (no Node 26 CI evidence; last release 2026-04, R7:256) |
| Rollback | The schema and repositories live in `apps/core-server/src/db/`; a switch to the fallback (Kysely 0.29.6, MIT, `engines >=22`, with the same `pg` driver, R7:109) rewrites that folder only |
| Hand-built | None |
| Proof | Row 25: install, `tsc --noEmit` under TypeScript 6.0.3, and one query against the trial cluster on Node 26.8.2 |

### TD-04 Migrations and seed tooling

| Field | Content |
|---|---|
| Options | `drizzle-kit` generated SQL files with the runtime `migrate()`; Prisma Migrate; `node-pg-migrate` 9.0.0; `dbmate` 2.36.0; Graphile Migrate 1.4.1; Kysely migrations. Seed: `drizzle-seed` 0.3.1; a seed program that imports the shared dataset |
| Criteria | Follows TD-03; SQL files that a reviewer can read; one initial migration set by one writer (P16, BP:461); raw SQL for triggers, grants and the chain guard; a reset to the seed state (impact question 9); the seed loads the canonical dataset "without copying it" (BP:302) |
| Evidence | `drizzle-kit generate` writes `migration.sql` plus a snapshot per change; `generate --custom` creates an empty SQL file for hand-written statements; migrations are applied from code with `migrate()` from `drizzle-orm/node-postgres/migrator`, logged in a migrations table (R7:66-67). No down migrations and no drop-and-recreate command are documented (R7:68-69). `drizzle-seed` generates deterministic fake data and its `reset` issues `TRUNCATE ... CASCADE` (R7:69). The dataset is built by `createIdleState` and `buildHistory` from a `now` value and is date-relative (R2:463-475); the script `gen-demo-evidence.ts` already loads it in Node (R1:99) |
| Choice | **`drizzle-kit` 0.31.11 (MIT, dev dependency)** generates the SQL; the files are committed under `apps/core-server/src/db/migrations/`; **the server applies them with drizzle-orm's `migrate()`** (no CLI at run time). Roll-forward only: a correction is a new file. **Seed**: a TypeScript program in `src/db/seed/` that calls the shared `createIdleState(now)` and writes its slices to the tables in one transaction (the mapping is row 16's). **Reset**: a script that, as `dems_admin`, ends the connections, drops and recreates the database, migrates and seeds |
| Rejected | `drizzle-seed` (it invents data; the canonical dataset and its hash chain must come from the shared code; its `TRUNCATE` is exactly what the audit table's protection forbids for the runtime role); Prisma Migrate, MikroORM `migration:fresh --seed`, Graphile `reset` (tied to rejected stacks or a second migration tool, R7:92, R7:162, R7:246); `dbmate` (a binary delivered through npm, R7:235); `node-pg-migrate` as primary (a second tool beside the ORM's own generator; it is the migration runner of the TD-03 fallback, R7:226-228) |
| Rollback | Before the first release of the schema: delete the migration folder and regenerate. After: forward migration only. Database state: the reset script |
| Hand-built | (1) The **seed program** and (2) the **reset script**. Reason: Drizzle has no reset command (R7:69), and the data to load is this project's own dataset; no library can supply it |
| Proof | Row 28 (migrate on an empty database, second run is a no-op) and row 29 (row counts equal the seed mapping; R2:440 gives the derived counts 82 audit rows and 59 events, to be confirmed by running the seed, R2:614) |

### TD-05 Password hashing

| Field | Content |
|---|---|
| Options | Node built-in `crypto.argon2` (argon2id); `@node-rs/argon2` 2.2.1; `argon2` 0.45.1; `hash-wasm` 4.12.0; `@noble/hashes` 2.4.0; `bcrypt` 6.0.0 or `bcryptjs` 3.0.3; Node `crypto.scrypt`; a framework default (Better Auth, scrypt) |
| Criteria | Salted, memory-hard, parameters from public guidance (controller constraint 8); no new native dependency if the platform already provides one; does not block the 20 Hz engine tick |
| Evidence | OWASP: "Use Argon2id with a minimum configuration of 19 MiB of memory, an iteration count of 2, and 1 degree of parallelism", that is m=19456 KiB, t=2, p=1 (R10:89, R10:582). RFC 9106: 16-byte salt recommended for password hashing (R10:117, R10:589). `crypto.argon2` was added in Node v24.7.0, is marked Stable, takes `message`, `nonce`, `parallelism`, `tagLength`, `memory`, `passes`, and returns the raw derived key with no encoded string and no verify helper (R10:124, R10:131). `@node-rs/argon2`: native binding with the same default parameters, returns an encoded string and has `verify`; Node 26 is not named by any source (R10:152, R10:615). `@noble/hashes`: its own README says its Argon2 is slow and unaudited (R10:166). OWASP on upgrading: re-hash at the next successful sign-in (R10:103) |
| Choice | **Node built-in `crypto.argon2`, algorithm `argon2id`, memory 19456 KiB, passes 2, parallelism 1, tag length 32 bytes, 16 random bytes of salt per password** (asynchronous form, so the event loop is not blocked). Stored per operator: algorithm name, the three parameters, salt and hash as separate columns (no encoded-string parsing). Verification recomputes with the stored parameters and compares with `crypto.timingSafeEqual` on two 32-byte buffers. The seeded operators keep the demo password (Q12, DEC:D4); only the hash is stored |
| Rejected | `@node-rs/argon2` as primary (a native add-on for a function Node core already provides; Node 26 not named); `argon2` 0.45.1 (registry and README disagree on the Node floor; node-gyp fallback, R10:145); `hash-wasm` (last registry change 2024-11, R10:159); `@noble/hashes` (R10:166); bcrypt (72-byte input limit, third in OWASP's order, R10:96); scrypt (Node's default `maxmem` is below OWASP's set, R10:138); Better Auth (TD-06) |
| Rollback | The parameters are stored per row, so a change of algorithm or cost needs no migration of existing rows: verify with the stored values, re-hash on the next successful sign-in (R10:103). Fallback library: `@node-rs/argon2` 2.2.1 (MIT) |
| Hand-built | **The hash wrapper** (derive, store parameters, constant-time compare; about 30 lines). Reason: the built-in returns a raw key and documents no verify helper (R10:131); the ready-made alternative that has one is a native add-on with no Node 26 statement |
| Proof | Row 32: a known-vector test; a dump of the database holds no plaintext password (BP:302, BP:305) |

### TD-06 Session or token model

| Field | Content |
|---|---|
| Options | (A) `@fastify/session` 11.1.3 with an opaque cookie and a store; (B) `@fastify/secure-session` 8.4.0, a stateless encrypted cookie; (C) `@fastify/jwt` 10.2.2 signed tokens; (D) an opaque token held in an application table, delivered as a cookie to the browser and as a bearer value to the app; (E) Better Auth 1.7.7 |
| Criteria | Immediate revocation (sign-out, disabled user, revoked device, E2, E3 in BP:168-169); works for a browser and for React Native; authenticates the socket upgrade; no token in a URL or in web storage; each attempt writes an audit row in the same chain; survives a server restart |
| Evidence | Browser limits: no `Authorization` header on a socket upgrade (R8:400); tokens must not be kept in `localStorage` or `sessionStorage` (R10:226). React Native: headers can be set on the socket constructor (R8:406); "Cookie based authentication is currently unstable" (R10:282). Session identifiers: at least 64 bits from a CSPRNG (R10:205). Timeouts: idle 15-30 minutes for low-risk applications, absolute 4-8 hours (R10:219). Tokens in query strings appear in access logs (R8:412). (A): cookie only; the default store is in memory and "should not be used in a production environment"; no durable store is bundled (R8:227). (B): native `sodium-native`; no per-session revocation documented (R8:233, R8:440). (C): revocation is an application-kept denylist (R10:303). (E): section 1.7. Existing policy to carry over: 15 minutes idle, 5 failures in 5 minutes lock for 60 seconds, one audit row per attempt, a generic failure message (RT:332) |
| Choice | **Pattern: server-side opaque session in PostgreSQL, one table for both clients.** Token: 32 random bytes (256 bits) from `crypto.randomBytes`, base64url; only its SHA-256 is stored. **Web**: the token is set as a cookie by `@fastify/cookie` **11.1.2** with `HttpOnly`, `SameSite=Strict`, `Path=/`, no `Domain`; no `Secure` attribute and no `__Host-` prefix because the transport is loopback HTTP (TLS on loopback is out of scope; browser behaviour for `Secure` on `http://127.0.0.1` is not confirmed, R10:261, R10:621). **Mobile**: the token is returned in the sign-in response body, held in memory only (as today, R4:58), and sent as `Authorization: Bearer` on REST calls and on the socket upgrade. A mobile session row carries the device id, so revoking the device ends its sessions. **Timeouts (input for row 15)**: idle 15 minutes kept from the existing policy, enforced from a server-side last-seen time; absolute 8 hours added (R10:219). **Permissions are never stored in the session**: they are read from the database on every request, so a role change needs no new sign-in (BP:308). **Lockout**: `rate-limiter-flexible` **11.2.1 (ISC)**, 5 failures in 300 s block for 60 s, keyed per client console (the web console, or the device id), with our handler writing the audit rows; its PostgreSQL store exists but the memory store is enough for a 60-second lock (R10:441). **Throttle** on the two pre-authentication routes: `@fastify/rate-limit` 11.2.0 with a route-level key (R8:251) |
| Why the lockout key is not the IP address | Every client reaches the server from 127.0.0.1 (the browser directly, the emulators through `adb reverse`), so an address key would lock all clients together, the denial-of-service risk OWASP names (R10:420) |
| Rejected | (A) cookie only and no durable store: the store adapter would be hand-built anyway and the app would still need a second mechanism; (B) cannot revoke; (C) revocation needs the same table plus signing-key management; (E) see section 1.7; a bearer token kept in web storage (R10:226); a bearer token in memory on the web (a reload would sign the operator out, and the socket would need the token in a URL or a first message, R8:400, R8:412) |
| Rollback | The table and the two delivery paths sit behind one `authenticate` hook; replacing the model changes that hook and the Live source's sign-in code, not the operations |
| Hand-built | (1) **The session table and the `authenticate` hook** (cookie or bearer, hash lookup, last-seen update, device check). Reason: no examined plugin covers cookie and bearer with immediate revocation and a durable store (R8:227, R8:233, R10:303). (2) **The Origin guard** for state-changing requests and socket upgrades (ADQ-6). Reason: `@fastify/csrf-protection` implements token patterns that both clients would have to carry, while the cookie is `SameSite=Strict` and one hook can verify the Origin as OWASP lists (R10:268); mock-core already uses the same hook pattern for its socket (R5:114) |
| Deviation from guidance to be reviewed by row 20 | OWASP asks for a new session identifier after a privilege change (R10:212). This design keeps the session across a role change, because success criterion 4 needs the operator to stay signed in while the role changes (BP:380), and no privilege is cached in the session (G-11) |
| Proof | Row 32 (success, wrong password, unknown user, lockout start and end, idle expiry, sign-out, disabled user; a log-capture test finds no password or token, BP:305) |

### TD-07 RBAC pattern

| Field | Content |
|---|---|
| Options | A guard written on Fastify's own extension points; `@fastify/auth` 5.1.1; `fastify-guard` 3.0.1; CASL `@casl/ability` 7.0.1; Casbin 5.51.1 with `fastify-casbin` 4.0.0; `accesscontrol` 3.1.1; Better Auth's admin plugin; an external engine (OpenFGA, Cerbos, Permify) |
| Criteria | Deny by default; checked on every request; one audit row per denial; driven by the contract's permission metadata so that a route without metadata cannot boot (BP:306); any-of permissions (`setStoragePolicy` accepts either of two, R1:183); roles and the matrix stored in the database; the same list reaches the clients as a hint |
| Evidence | OWASP: deny by default, validate on every request, test and log authorisation (R10:475). Fastify gives route `config`, route-level `preHandler` hooks and an `onRoute` hook that sees every route (R10:482). `fastify-guard` checks roles and scopes on a `request.user` object and has no permission function (R10:489). CASL is a rule engine for subject and attribute conditions; its Fastify adapter is GPL-3.0 and from 2022 (R10:496). Casbin needs a model file and a policy store; Fastify 5 is not stated (R10:503). The external engines are separate services, two of them Docker-first (R10:531, R10:570). The simulator's model is a flat list: 3 roles, 9 permissions, 15 grants (R2:389-401), and only the export paths audit a denial (R1:81) |
| Choice | **Pattern: a contract-driven permission guard.** Each operation in the shared registry carries its access rule: `public`, `device` (a paired device, before sign-in) or `permission` with an any-of list. At boot an `onRoute` hook refuses any route without a rule. A `preHandler` resolves the session, reads the operator's role and the role's permissions from PostgreSQL, and either continues or answers 403 with the error envelope and one audit row of a new generic denial type (ADQ-9) naming actor, operation and permission. Tables: roles, permissions, role-permission grants, and a role per operator. The matrix is seeded from the shared `ROLE_PERMISSIONS` table plus the new permissions and is read-only in the portal (Q9, DEC:D4). **Client side**: the server returns the signed-in operator's role and effective permission list with the session; the clients' existing gates keep reading the role from the store (ADQ-2) |
| Rejected | `fastify-guard` and `@fastify/auth`: what they would contribute is a set-membership test and an and/or combinator; the registry binding, the boot check and the denial audit row would still be ours. CASL, Casbin, `accesscontrol`: rule engines for a flat list that needs none, each adding a policy format. Better Auth admin plugin: section 1.7. External engines: a second service; Docker-first (I4) |
| Rollback | The guard is one plugin; the grants are data. A different engine could replace the membership test without touching the operations |
| Hand-built | **The permission guard** (boot check, resolution, denial audit; about 80 lines). Reason: stated under "Rejected" |
| Inputs for row 15 | New permissions for pairing management, user administration and demo controls (Q10, Q14); every one of the 42 actions needs a rule, including the 25 that have none today (R1:80; DEC:F14); `SESSION_NOTE` and `EVIDENCE_VIEW` exist in the table but are checked nowhere (R1:82); the six read operations carry no permission today (R2:597); which role receives the new permissions is the blueprint's pending decision 4 (BP:699) |
| Proof | Row 33 (boot test, one audit row per denial) and row 51 (role-by-endpoint matrix generated from the registry) |

### TD-08 Realtime fan-out

| Field | Content |
|---|---|
| Options | (P-1) `ws` through `@fastify/websocket` with an application-owned topic registry; (P-2) uWebSockets.js native topics; (P-3) Socket.IO rooms with volatile emits; (P-4) Colyseus state patches; Server-Sent Events (`@fastify/sse` 0.6.0) |
| Criteria | Installed and proven; authentication at the upgrade through Fastify hooks; the existing heartbeat clients and tests keep working; 20 Hz meter frames without unbounded buffering; snapshot-then-delta resync; works with React Native's socket |
| Evidence | `@fastify/websocket` routes the upgrade through the normal router, so `onRequest` to `preHandler` hooks run first; it exposes the `ws` server and `injectWS` for tests; it has no topic or broadcast API (R8:269). `ws`: `send()` returns nothing; the backpressure signal is `bufferedAmount` (R8:332); permessage-deflate is off on the server by default; `maxPayload` defaults to 100 MiB (R8:350); the documented liveness pattern is a 30 s ping (R8:356). uWebSockets.js: built-in topics and backpressure limits, but installed from GitHub and bridged by a package that lists Node 20, 22, 24 (R8:303, R8:190). Socket.IO: rooms and "volatile" events for latest-value data, but its Fastify plugin is Fastify 4 only and both clients would need its client library (R8:310, R8:189). The union of server messages has one member today and is the extension point (R2:213, R2:223). Node gives no timing guarantee for a 50 ms timer (R8:344) |
| Choice | **P-1: `ws` 8.22.0 through `@fastify/websocket` 11.3.1 (both installed), with a fixed topic list.** Messages are a zod discriminated union in the shared contract. A connection gets a snapshot with a revision number, then deltas; a gap in revisions makes the client ask for a new snapshot. State deltas are never dropped: a client whose buffer passes a hard limit is closed and resyncs. Meter frames (20 Hz) are sent only to connections that subscribed and are skipped for a connection whose `bufferedAmount` is above a threshold (latest value wins). `maxPayload` 65536 as mock-core sets (R5:106), a client cap, a 30 s ping. Authentication is at the upgrade only (ADQ-6); a connection with no session receives the heartbeat only; the server closes the sockets of a session that ends or of a device that is revoked (R8:418) |
| Rejected | P-2 (not on the registry; replaces the HTTP server; Node 26 not listed); P-3 (a second protocol and client library in both apps; no Fastify 5 plugin; the existing plain-socket heartbeat contract would be replaced); P-4 (a second server framework); SSE (one-way; 0.x; Web Streams on Hermes are a known gap, R9:198); `mqemitter` 7.1.0 as the registry (wildcard matching for a list of about five fixed topics, R8:296) |
| Rollback | The wire rate of meters is a server constant: if row 110 measures stutter, lower it and interpolate on the client (H-B4, BP:160). The transport is behind the Live source's socket client (BP:332) |
| Hand-built | **The topic registry and the send policy** (a map from topic to connections, the buffer check, the session-to-connection map). Reason: neither `ws` nor the plugin has topics (R8:269, R8:296); the libraries that do replace the transport or the server |
| Open parameters (inputs for row 15) | The buffer threshold and the hard limit (no source gives a number for `ws`; the only written example is a blog, R8:338); the topic list; the delta format per slice (ADQ-2) |
| Proof | Row 38 (unauthenticated socket, revoked device, resync equals a fresh snapshot) and row 110 (frame statistics on web and emulator) |

### TD-09 Contract tooling and typed clients

| Field | Content |
|---|---|
| Options | Contract: (A) keep the repository's code-first zod registry and its own OpenAPI builder; (B) generate the document from Fastify routes with `@fastify/swagger`; (C) OpenAPI-first with `fastify-openapi-glue`; (D) a contract framework (oRPC, ts-rest). Typed client: (1) a client derived from the registry; (2) `openapi-typescript` 7.13.0 with `openapi-fetch` 0.17.0; (3) `@hey-api/openapi-ts` 0.99.0; (4) Orval 8.39.0; (5) Kubb 5.x. Conformance: in-process tests; oasdiff; Schemathesis |
| Criteria | One source of truth for shapes; no new host-level tool (controller constraint 6); works in a browser and on Hermes under Expo SDK 57; TypeScript 6.0.3 and zod 4.6.5; no duplicated schema set; drift is caught by a test |
| Evidence | Today: 18 zod schemas and one operation table are the source; the OpenAPI 3.1 document is built by repository code from `z.toJSONSchema`; a `--check` flag and a byte-equality test guard it; `validateCoreApiResponse` checks a body against the documented status; the web API Reference page builds the document in the browser (R9:173-179). No typed REST client exists (R9:179). `openapi-typescript` 7.13.0 declares `typescript ^5.x`; the repo pins 6.0.3 (R9:221). Hey API, Orval and Kubb are generators that take the OpenAPI document and emit types, a fetch client and, optionally, zod validators (R9:224-226, R9:275). Kubb's fetch template returns no data when `response.body` is falsy (R9:226). ts-rest's stable line needs zod 3 (R9:243). oRPC needs `ReadableStream`, which its own docs say Hermes lacks (R9:198, R9:242). On the device: Expo 57 installs `expo/fetch` as the global `fetch`; `Request`, `Response`, `Headers` stay React Native's polyfills; clients that read JSON through `text()` and `JSON.parse` do not touch `response.body` (R9:194-195, R9:256-258). oasdiff is a Go binary and Schemathesis a Python tool (R9:290, R9:293). The response validators for tests are stale (R9:295) |
| Choice | **Contract: (A), unchanged in kind.** The operation registry in `packages/shared/src/api/` grows to every operation, each with its schemas, access rule and audit type; the existing builder, `--check` flag, byte-equality test and `@scalar/openapi-parser` 0.29.9 validation stay (R9:176). The server registers its routes from the registry and uses the compilers of `fastify-type-provider-zod` 7.0.0, so a handler that returns a wrong shape fails at serialisation (R9:276). **Typed client: (1)**, one generic function typed by the registry (operation id in, typed input, typed result or typed error envelope out), using the global `fetch` (injectable), JSON through `text()` and `JSON.parse`, and the registry's own zod schema to validate the response. **Conformance**: Vitest tests in the server workspace through `app.inject`: every route is in the registry, every registry operation is registered, every response passes `validateCoreApiResponse` (BP:325). **Realtime**: the zod union of TD-08; no AsyncAPI tooling (not collected, R9:335) |
| Why not a generator | In a zod-first repository the OpenAPI document is an output. A generator would read it back and emit a second set of types and validators for shapes the shared package already holds, plus a regeneration step and a drift test in the contract-owner slot (P17, BP:463) for every contract change |
| Rejected | (B) would move the source of truth into the server and take the document away from the browser-side API Reference page, which builds it locally (R9:179); (C) inverts the repository's direction; (D) see evidence. (2) peer conflict with TypeScript 6.0.3 and open issue (R9:221); (4), (5) as "Why not a generator", and (5) depends on `response.body`; oasdiff and Schemathesis (host tools; controller constraint 6) |
| Fallback | `@hey-api/openapi-ts` **0.99.0 (MIT)**: its peer range names TypeScript 6, its fetch client is bundled source with no Node built-ins, it reads JSON through `text()` (R9:224, R9:257). Used only if the registry-typed client fails its proof (for example, type-checking cost with the full registry) |
| Rollback | The client is one folder (`packages/shared/src/client/`, BP:208) used only by the Live source (ADQ-2) |
| Hand-built | **The registry-driven client** (about 150 lines). Reason: stated in "Why not a generator" and "Rejected"; the two ready-made clients that need no generator require zod 3 or Web Streams |
| Health schema (D9 DN-3) | `HealthResponseSchema` fixes `service` to `dems-mock-core` (R5:49). Proposal for row 15: widen that field to the two service names and add optional readiness fields, an additive edit; mock-core's and the launcher's answers stay valid, and the launcher guard compares the unchanged constants (R5:237) |
| Proof | **Row 58 must prove the client on an Android emulator, not in jest only**: one GET (health), one POST with a JSON body, one error envelope, each validated by zod on the device, through `adb reverse`, with the default `expo/fetch` (controller constraint 6). The web entry already sets `z.config({ jitless: true })` (section 3.4); zod's probe for `new Function` is inside a `try` (R9:272) |

### TD-10 Device credential storage

| Field | Content |
|---|---|
| Options | `expo-secure-store` 57.0.4; `react-native-keychain` 10.0.0; `react-native-sensitive-info` 6.1.5; `react-native-mmkv` 4.3.2 with an encryption key; AsyncStorage |
| Criteria | Bundled for Expo SDK 57; Keystore-backed; an item that needs the OS biometric check (Q11); smallest native change; known behaviour on reinstall |
| Evidence | `expo-secure-store` 57.0.4 is the SDK 57 bundled version (`~57.0.4`), MIT, no dependencies; values are stored in SharedPreferences encrypted with a Keystore AES-GCM key; `requireAuthentication` binds an item to a biometric prompt; items do not survive an uninstall; the library manifest adds no permission; the module is autolinked and its config plugin is optional (R11:151-164). The docs say emulators "do not require biometric authentication when retrieving secrets" (R11:159). `adb install -r` keeps app data; what it does to a Keystore entry is not confirmed (R11:160). A test pins the app's plugin list to seven entries (R11:71). `react-native-keychain`: not bundled, no Expo plugin, no release since 2025-03 (R11:171-176). `react-native-sensitive-info`: needs Nitro modules and `prebuild --clean` (R11:191-198). MMKV: the caller supplies the key (R11:206). AsyncStorage is unencrypted (R11:94). The app holds no secret today (R4:62) |
| Choice | **`expo-secure-store` 57.0.4 (declared `~57.0.4` as Expo's bundled list gives it, MIT)**, without its config plugin, so `app.json`'s plugin list and its test stay unchanged. Two kinds of item: (1) the **device credential** (device id and a 256-bit secret issued by the server when the pairing code is redeemed; the server keeps only its SHA-256), stored without `requireAuthentication` so the pairing gate can be checked at start; (2) a **biometric sign-in token** per operator, issued by the server after a password sign-in on a paired device, stored with `requireAuthentication: true`, replaced at every use (rotation with reuse detection, R10:341). The existing keys `dems.mobile.auth.v1`, `dems.mobile.prefs.v1`, `dems.sim.v1` and `dems.mobile.log.v1` are not reused or deleted (R4:62) |
| Rejected | `react-native-keychain` and `react-native-sensitive-info` (not bundled, larger native change, no SDK 57 statement); MMKV and AsyncStorage (not Keystore-backed) |
| Consequences (inputs for row 17) | A reinstall loses the credential while the registry still lists the device (E7, BP:173): the app shows the pairing screen and the portal shows the old entry until it is revoked. On an emulator the biometric-protected item may not prompt; if writing or reading it fails on an AVD, the token is stored without `requireAuthentication` there and the existing `expo-local-authentication` prompt stays the gate (AS-06); that is a demo limitation to record before row 79 |
| Rollback | Remove the dependency and rebuild the debug APK from the backup that row 77 takes (BP:350) |
| Hand-built | **The pairing protocol** (issue a one-time code, redeem it for the credential, list, revoke). Reason: no source specifies a pairing or device-credential protocol for this case; the closest public texts are for OAuth device flows and out-of-band secrets (R10:629). Parameters from those texts as inputs for row 15: a code of at least six decimal digits, valid for at most 10 minutes (R10:383); attempts limited (R10:376). The existing screen takes six digits (R4:257) |
| Proof | Row 77 (the module is in the debug binary; the app still starts in Simulated mode) and rows 79, 81 (write, read, biometric read on each AVD) |

### TD-11 QR

| Field | Content |
|---|---|
| Options | Rendering in the portal: `qrcode.react` 4.2.0; `react-qr-code` 2.2.0; `qrcode` 1.5.4; `uqr` 0.1.3; `react-qrcode-logo` 4.1.0. Scanning on the device: `expo-camera` 57.0.6; `react-native-vision-camera` 5.2.3 with its scanner; `react-native-camera-kit` 18.0.1; `react-native-data-scanner` 0.1.2; no scanner |
| Criteria | React 19; an SVG element (no data URL, no canvas); few dependencies. For scanning: can it be shown and verified on the three emulators; permission footprint; native change |
| Evidence | `qrcode.react` 4.2.0: ISC, peer range names React 19, no runtime dependency, `QRCodeSVG` component (R11:228, R11:240). `react-qr-code` 2.2.0: MIT, peer `react: *`, two runtime dependencies (R11:229). The others are not React components or draw to a canvas (R11:230-232, R11:242-244). Scanning: all three AVDs have `hw.camera.back=none` and `hw.camera.front=none` (R11:100-104); `expo-camera` is documented "Android (device only)", adds the `CAMERA` permission and, through its plugin, `RECORD_AUDIO` by default, and is 30.7 MB unpacked (R11:270, R11:275-276); the app has no camera permission today (R11:79). A QR image can be loaded into an emulator's virtual scene, which needs a camera setting on the AVD (R11:259). Code entry is always available (Q8, DEC:D4) |
| Choice | **Rendering: `qrcode.react` 4.2.0 (ISC)** in the Paired Devices page. **Scanning on the device: not built in this task (deferred).** The pairing screen keeps code entry as its only input. No camera module is installed, so row 77 adds one native module instead of two and the manifest keeps its four permissions. The AVD camera settings are not changed |
| QR payload (input for rows 15, 17) | A short non-URL string that carries the one-time code and a format version; not a deep link, because a pairing code must not appear in a URL (controller constraint 8) |
| Rejected | `react-qr-code` (React 19 support is by a `*` peer only; two dependencies); the three non-component libraries. Scanning now: it cannot be demonstrated or verified on the host's emulators as configured; it would add a permission and a 30 MB module to the binary for a path no check can exercise; the predecessor's lesson is that deferred device checks accumulate (RT:343) |
| If the controller wants scanning later | `expo-camera` 57.0.6 (MIT, bundled `~57.0.6`, R11:267) with `recordAudioAndroid: false`; one AVD's `config.ini` camera key changed to a virtual scene and a cold boot. That is a host change and the controller's call (Host Impact Register H-10) |
| Rollback | Remove the web dependency and the QR element; the code stays visible as text |
| Hand-built | None |
| Note for row 21 | Row 76's check "the QR decodes to the issued payload in a test" (BP:349) needs a decoder, and none was researched. Either row 18 pins one, or the check becomes "the QR component receives the issued payload" |
| Proof | Row 76 |

### TD-12 Test tooling

| Field | Content |
|---|---|
| Options | Runner: Vitest 5.0.3 (installed). HTTP: `app.inject`; `supertest` 7.3.1. Sockets: `injectWS`; a real `ws` client on an ephemeral loopback port; MSW 3.0.2; `vitest-websocket-mock` 0.8.0. Database isolation: a database per test file cloned from a template; a schema per worker; a transaction rolled back per test; truncation; PGlite or `pg-mem` as a test engine. Coverage: `@vitest/coverage-v8` 5.0.3; `@vitest/coverage-istanbul` 5.0.3. End to end: Maestro CLI 2.11.0 (on the host); Playwright 1.63.0; Detox 20.51.4; Appium 3.8.0 |
| Criteria | The root gate works with no database running (D9); a real PostgreSQL (BP:606); code that commits, uses several connections and appends to the hash chain must be testable; two workers at most (P9, BP:443); no Docker, no hosted service |
| Evidence | Vitest runs files in parallel and tests inside a file in order; `globalSetup` runs once before the workers and can pass data to tests; `VITEST_POOL_ID` is a stable 1-based worker key; the default pool is `forks`, and native add-ons can crash under `threads` (R12:67-70). `app.inject` and the real-socket pattern are the repository's existing practice (R12:51-52). Template clone cost as sources state it: about 30 to 400 ms per database (R12:114-117); the template must have no other connection during the copy (R12:101). Schema per test: about 1 s per 500 definitions (R12:120). Transaction rollback cannot exercise code that commits or that uses a second connection (R12:126). PGlite is single-connection and `pg-mem` an emulator (R12:132-134). Testcontainers and `@databases/pg-test` need Docker (R12:264-265). Detox states React Native 0.77 to 0.84; the app is 0.86.3 (R12:200). Maestro driving a browser and an emulator in one flow is not confirmed (R12:190); its one start inside the sandbox failed (DEC:F19). No coverage package is installed (R12:50). The root scripts do not forward extra arguments such as `--maxWorkers` (R13 note N-2). Port binding fails inside the sandbox (R13 section 5.2) |
| Choice: runner and layers | **Vitest 5.0.3** with `app.inject` for HTTP, `injectWS` for upgrade and authentication tests, and the `ws` 8.22.0 client on an ephemeral port for fan-out tests. `maxWorkers: 2` is set in the workspace's Vitest config, so the limit holds however the command is called; gate rows also run tests per workspace with `-- --maxWorkers=2`, as D10 rules. Coverage: **`@vitest/coverage-v8` 5.0.3 (MIT)** for the server workspace only (BP:375). Mobile stays on jest 29.7.0 with jest-expo |
| Choice: database isolation | **One database per test file, cloned from a template** that `globalSetup` migrates once per run (and seeds where a suite needs the dataset); names carry a run prefix and the drop helper refuses any name without it (the practice in R12:117); clones are serialised. Tests inside a file share the database and run in order (R12:68) |
| **Choice: how database-backed tests run (D9, DN-6)** | **A separate script, not the default test command.** `npm test` in `apps/core-server` runs the database-free project (pure logic, the guard with fakes, the registry boot check, the engine against the shared simulator). `npm run test:db -w @dems/core-server` (with a root alias `npm run test:db`) runs the database-backed and acceptance projects; its `globalSetup` attaches to the running project-local server or, if none runs, starts it through `scripts/pg/` under `.locks/postgres.lock` and stops it afterwards only if it started it. It fails, never skips, when PostgreSQL cannot be reached. The two projects are Vitest `test.projects` of one workspace config (R12:72). The standard gate of every backend row and the gate rows 56 and 104 call both commands |
| Why not self-starting inside `npm test` | The root gate is run by many rows; a database start in each run needs a port (a sandbox bypass per run, R13) and adds an `initdb` per run under a 6-agent load (D6); on the fallback route a fresh checkout has no PostgreSQL binaries at all, so the root gate would fail for a reason unrelated to the code |
| Choice: client tests of the Live path | A **contract-checked fake transport** injected through the seams that already exist (`socketFactory` in the web router context, R3:75; the fake heartbeat socket in the mobile harness, R4:345), shared by Vitest and jest |
| Choice: end to end | Rows 106-108 drive the backend, the web console and one emulator with the browser tool and `adb`, with captures and database rows as evidence (BP:379-381). Maestro flows for the mobile side stay a follow-up (BP:687) until row 24 shows that the CLI starts outside the sandbox. No Playwright (a browser download is a host change, R12:198), no Detox, no Appium |
| Rejected | Transaction rollback and truncation as the main strategy (R12:126); schema per worker (slower than a clone for a full schema, R12:120); PGlite and `pg-mem` (not the server under test); `supertest` (a real port where injection suffices); MSW and `vitest-websocket-mock` for client tests (two interception layers across three runners; MSW under jest-expo is not evidenced) |
| Rollback | The isolation helper is one module; a change of strategy does not touch the tests |
| Hand-built | **The fake transport** for client tests and **the template-clone helper**. Reasons: stated under "Rejected" and R12:264-265 (the ready-made helpers are Docker-based) |
| Proof | Row 28 (first database-backed test), row 31 (50 concurrent audit appends), rows 51-55 |

### TD-13 Portable PostgreSQL for a live package (cost only, Q7)

| Field | Content |
|---|---|
| Question | What would it cost to ship a live edition for another PC, on the four targets of the 0.1.0 web packages, with no Docker and no administrator install (DEC:D4, Q7)? |
| Candidate paths | (A) The `@embedded-postgres/<platform>` packages: macOS arm64 147.7 MB, macOS x64 147.7 MB, Windows x64 109.3 MB, Linux x64 59.2 MB unpacked (R6:79). (B) The `theseus-rs` archives 18.6.0: 13.1 MB, 13.4 MB, 54.1 MB, 12.2 MB compressed, PostgreSQL licence, one checksum per archive (R6:199). Homebrew cannot serve it (no Windows bottle, R6:146); PGlite would, but it is not a PostgreSQL server (R6:175) |
| Size effect | The six 0.1.0 web archives are 37 to 84 MB each (R5:293-303). Path B adds about 12 to 54 MB compressed per platform; path A adds 59 to 148 MB unpacked |
| Work items | (1) Package the server: it runs from TypeScript source through `tsx` today and nothing is compiled (R5:386); a single-file build needs a bundle of Fastify, Drizzle and `pg` (**hypothesis**: all pure JavaScript). (2) Ship the binaries beside the launcher and recreate the library links at package time (npm tarballs carry no symlinks, R6:84). (3) First-run `initdb` into a user-writable folder, a generated password, a free-port search. (4) Supervise two processes: start order, stop on exit, a stale `postmaster.pid`, recovery after a forced kill (about 4 s on Windows, R6:95). (5) Platform trust: quarantine and signing of PostgreSQL binaries on macOS are untested (R6:546); the Windows build's runtime needs are not collected; Linux is glibc only on one path (R6:119). (6) Licence texts for PostgreSQL and its bundled libraries (R6:75). (7) Serve the web console from the server's own origin and extend the packaged content-security policy, which is duplicated in the launcher and pinned by a test (R3:63). (8) Verification: this host can run only macOS arm64 (no Rosetta, R6:32) |
| What it would not give | A mobile live edition: the release APK allows no cleartext traffic and has no configurable address (R4:63); that is U4 |
| Finding | A path with no Docker and no administrator install exists on paper for all four targets (A or B). It is not proven by execution on any target, and three targets cannot be exercised on this host |
| Recommendation | **Not built in this task.** The 0.1.0 packages stay the offline edition (Q7 option a). The cost above goes into `01_specs`. Revisit as a follow-up task after success criteria 1 to 11 pass, starting with a macOS arm64 trial. This is the blueprint's pending decision 6, option A (BP:701); the controller decides |
| Reading of Q7 | D4 says a live package is "built last only if" a portable path exists (DEC:D4). "Only if" makes the path a necessary condition, not an obligation, and the blueprint lists a live package as out of scope, costed only (BP:185). So this recommendation is consistent with D4; it is listed in section 13 because the condition is now met on paper |
| Rejected as paths | Homebrew (no Windows bottle, R6:146); PGlite (not a server, R6:175); the EDB archives (344 to 446 MB, macOS architecture unconfirmed, R6:267-268); Docker (U1) and hosted databases (U5) by rule (R6:353-359) |
| Rollback | Not applicable (nothing is built) |
| Hand-built | None |

---

## 5. Architecture decisions

### ADQ-1 Does the server re-implement the session machine and hardware signals, or host the shared code?

| Field | Content |
|---|---|
| Options | (A) Run the whole simulator in the server, including its sign-in and pairing. (B) **Host the simulator core headless**: the server creates the shared `Sim` (store, engine, domain actions and transitions) with server adapters, and replaces identity, pairing, persistence and the clock with server-native modules. (C) Host only the pure transition functions and write a server-owned action layer and tick loop. (D) Re-implement the rules against SQL |
| Criteria | The server is the only authority; one behaviour in Simulated and Live mode; `packages/shared/src/sim/**` is not rewritten (P21); the security floor; restart recovery (impact question 10) |
| Evidence | The simulator has 7 pure transition modules, 4 pure derivation modules and 12 pure data modules; a static test forbids web, Node and React Native globals in `src/sim` (R1:98, R1:672). `createSim` takes 11 injectable options, among them `clock`, `scheduler`, `storage`, `authStorage`, `visibility`, `timers` (R1:473). The transitions already run in a Node script (R1:99). An unchanged slice keeps its object reference (R1:41). The engine is 7 subsystems on a 50 ms tick; the four timed session transitions fire at their scheduled time, so a catch-up yields the same timestamps as a live run (R1:90-91). Not usable as an authority: every permission check and actor id reads one `state.auth` (R1:84); sign-in compares with one shared constant, biometric sign-in trusts the caller, pairing compares with one constant (R1:85-86); 25 actions have no permission check (R1:80). Three places are not pure: an operator-record write requested by a transition, a mutation of a transient audio object, and a dependency on `../api/session-schema` and `../domain` (R1:100, R1:684-686). No long-running Node host exists today (R1:698) |
| Choice | **(B).** The server holds one headless `Sim` as the Core engine. (1) **Actor**: after the server's own authentication and permission guard, the command sets the engine's `auth` slice to the calling operator, calls the shared action in the same synchronous turn, and clears it; the engine tick cannot run in between because Node runs one turn at a time. (2) **Not used from the simulator**: the sign-in actions, the idle expiry, `pair` and `unpair` (replaced by TD-05, TD-06, TD-10). The `operators` slice mirrors the database; the engine's `tabletLink` slice is set from the real connection state of paired devices through the existing `setTabletLink` action (R1:191). (3) **Persistence**: after each command and each engine step that changed a durable slice, the changed slices (found by reference inequality) are written to PostgreSQL in one transaction (ADQ-4); the HTTP answer is sent after the commit; if the commit fails, the engine's state is set back to the reference held before the command. (4) **Audit**: the server's own rows (denial, pairing, user administration) are appended through the same shared `appendActivity` chain function (R1:87), so there is one chain; the table keeps every row while the engine keeps its ring of 1,000 (R1:87). (5) **Restart** (impact question 10): the state is rebuilt from the tables; if the stored session was in PRECHECK to FINALIZING, the server raises the power-fail fault through the existing `inject` path, which moves the session to FAULT (R1:223), and an operator then runs the existing `recover` path, which writes `SYSTEM_BOOT` and `RECOVERY_STARTED` (R1:164). (6) **Clock**: the server's clock is the engine clock (Q15) |
| Rejected | (A) breaks the security floor (plaintext comparison, R1:85). (C) re-creates the 600 lines of `actions.ts` and `engine.ts` (R1:108, R1:118) and moves the audio impurity out of the engine, for no gain: the actor problem is the same. (D) duplicates 11,610 lines of tested behaviour (R1:142) and guarantees drift between the modes |
| Rollback | If the first step of row 37 (a headless `Sim` under `tsx`, the recording scenario for 60 s, audit-type sequence equal to the simulator's, BP:310) fails, use (C): same transitions, server-owned loop. The operations and the tables do not change |
| Hand-built | **The engine host** (actor scope, change detection, write-through, rehydration). Reason: no library hosts this project's own state machine |
| Notes for rows 15, 16, 20 | Reset to the seed state (Q14) rebuilds the audit chain by design (R1:96); in Live mode that is a database re-creation by the owner role, never an UPDATE or DELETE by the runtime role (G-10). A missing seam in the simulator is logged as `SIM-GAP-n` (BP:452); none is known today |
| Proof | Row 37, then rows 54 and 55 |

### ADQ-2 How do the clients consume Live data?

| Field | Content |
|---|---|
| Options | (A) **A Live source behind the existing contract**: an object with the members of `Sim` that the clients use, whose store is a replica of the server's state fed by the socket and whose actions call the API. (B) Per-feature query hooks over REST resources. (C) A for the existing pages and screens, query hooks for the new portal pages |
| Criteria | Files touched; `SimState`-shaped helpers keep working; Simulated mode and its 61 test files unchanged; the server is the authority |
| Evidence | Web: one `Sim` is created in `main.tsx` and reaches every page through the router context and `SimProvider`; 88 production files call `useSim`, with 32 named selectors and 26 of 33 slices read inline (R3:48-50). The web uses these members: `store.getState`, `store.subscribe`, `actions.*`, `request`, `start`, `stop`, `ready`, `isReady` (R3:49). Mobile: 128 `useSim` calls in 31 files; the raw handle is used for `store.getState`, `store.subscribe`, `clock.now`, `ready`, `isReady`, `wasRestored`; five sheet frames re-provide the context (R4:47). Many pure helpers take a whole `SimState` (R4:66). `useSim` compares shallowly, so unchanged slices must keep their references (R4:67). The 20 Hz audio path is a store subscription that renders nothing (R3:81; R4:173). The web re-verifies the audit chain from the ring in the store (R3:60). 19 web and 34 mobile test or harness files construct a simulator directly (R3:66; R4:65). The server's state is already a `SimState` (ADQ-1) |
| Choice | **(C).** A `LiveSim` in `packages/shared/src/live/` (BP:210) with a zustand store of `SimState` shape: the server's snapshot fills it, per-slice deltas replace only the slices that changed (so references of the others are kept), `audit` and `events` arrive as appends, meter frames are written to the `audio` slice, and the `clock` slice follows the server's time through an offset. The `auth`, `authLockout` and `operators` slices are filled from the session operations (no secret is in them). **Read path: no call-site change.** The two new portal pages (Users & Roles, Paired Devices), which have no slice in the simulator, use TanStack Query 5.104.0 (installed in both clients, RT:334) over the typed client, invalidated by socket events |
| Files touched | Web seam: `main.tsx`, `router.tsx`, `routes/__root.tsx` (3 files, R3:48). Mobile seam: `runtime/sim-adapters.ts`, `runtime/sim-runtime-provider.tsx`, `runtime/core-link.ts`, `runtime/contract.ts`, `features/settings/preferences-section.tsx` (5 files, R4:59, R4:199-200). Against option (B): 139 web and 96 mobile production files (R3:670; DEC:F15) |
| Permission display | The existing gates call `selectCan`, which applies the shared static table to the operator's role (R3:54; section 3.4). In Live mode the role comes from the server and is pushed on change, and the server's matrix is seeded from that same table and is read-only (TD-07), so the hint equals the server's rule; a test asserts the equality of the seeded matrix and the table. The server's effective permission list is also kept by the Live source and is what the new pages and the navigation use. The server decides in every case (RQ-1). A stricter variant is listed as an open option in section 13.4 |
| Rejected | (B): rewrites the data layer of every page and screen and re-bases 61 test files; pure helpers that take a `SimState` would each need a Live twin (R4:66) |
| Rollback | The mode switch (ADQ-7) selects the simulator; the Live source is additive |
| Hand-built | **The Live source** (replica store, delta application, action bindings). Reason: it adapts this project's own contract |
| Risks | Slice size on the wire (the `session` slice changes every second while recording, R1:255); first paint before the snapshot arrives (R3:685); measured in row 110 |
| Proof | Row 60 (in Simulated mode every existing shared test passes and no fetch or socket call is made; in Live mode a mocked transport drives the selectors, BP:333) |

### ADQ-3 Synchronous actions against a network

| Field | Content |
|---|---|
| Options | (A) Keep the synchronous signatures by executing the shared transition locally and reconciling with the server later. (B) **An asynchronous Live action contract**; Simulated mode keeps its signatures. (C) Fire the request, return at once, deliver errors on a side channel |
| Criteria | The server decides results and refusals (success criterion 4); files touched; Simulated-mode timing unchanged so the 61 test files stay green |
| Evidence, web | 14 production sites consume the return value of 11 actions (R3:56, R3:167-177). 36 sites depend on a synchronous throw around a void action, 23 with their own `try/catch` and 13 behind one wrapper, `useSimCommand` (R3:57, R3:181, R3:187-197). 7 sites read the store right after an action (R3:58, R3:205-211). 3 route guards read the store synchronously in `beforeLoad` (R3:126-128). Fire-and-forget sites need no result (R3:230). The entry module already awaits before it builds the router (section 3.4) |
| Evidence, mobile | 9 return-value expressions in 6 files (R4:49, R4:130-137); 8 wrappers that turn success-or-throw into a boolean (R4:50, R4:145-152); 2 dialogs that toast success right after a throwing call (R4:51, R4:158-159); 9 read-after-write sites (R4:53, R4:165-173); the start-recording hand-off depends on synchronous order by design (R4:52); failure branches test `SimTransitionError` and `SimPermissionError` and map reason strings to i18n keys (R4:55); `AuthContract.signIn` is already a Promise with reasons `CORE_OFFLINE` and `UNAVAILABLE` (R4:58). 27 production files in all (R4:735) |
| Choice | **(B)**, with three rules that keep it cheap. (1) **Same names, same parameters, same result shapes and error classes**: a Live action returns a Promise of the simulator's result type and rejects with the same `SimPermissionError` or `SimTransitionError`, built from the error envelope, so `instanceof` branches and i18n maps stay as they are; network failure uses the reasons the mobile contract already has. (2) **Read-your-writes**: the Promise settles only after the Live store has applied the state revision named in the response, so a store read after the settle sees the effect; that covers the read-after-write and ordering sites without new code in them. (3) **Simulated mode stays synchronous**: call sites go through one small helper that runs the continuation at once when the action returned a plain value and after the settle when it returned a Promise. The three web guards do not change, because the Live source is ready before the router is built |
| Files touched | **Web: 26 production files** (this row's count from R3:167-211: login 1, session-new 2, evidence 5, security-audit 3, system 7, session-monitor 4, storage 1, devices 2, dashboard 1), which hold the 14 + 36 + 7 sites; guards 0. R3:304 independently counts 28 production files that call actions or the store directly. **Mobile: 27 production files** (R4:735), which hold the 9 + 8 + 2 + 9 sites; the 7 client-side role checks stay as display hints (R4:56). Total about 53 of 235 production files |
| Why this is the cheapest option that keeps the server authoritative | (A) touches no call site but makes the client decide results, identifiers and refusals first, which fails RQ-1. (C) touches no call site but shows a success toast before the server answers, the fault R4:51 describes, so a denial could not be shown where it happens. (B) with the three rules changes only the files that already depend on a result, a throw or a read-after-write, and leaves every read site and every guard alone |
| Rejected | (A), (C) as above; `await` at every site as the single pattern (it would add a microtask to Simulated mode and put "existing tests pass unchanged" at risk; allowed where the code path is already asynchronous, for example mobile sign-in) |
| Rollback | A site not yet adapted keeps working in Simulated mode; the mode switch hides Live |
| Hand-built | **The settle helper and the asynchronous action type** (about 30 lines). Reason: it is glue between this project's two modes |
| Inputs for row 17 | The Live behaviour of each of the sites above; `touch` is sent at most once a minute (the web calls it on every pointer and key event, R3:59); the mobile pairing flow becomes a request, not a timeline on the simulator clock (R4:54) |
| Proof | Rows 60, 62, 78 and the first page rows; the regression row 109 |

### ADQ-4 Persistence model

| Field | Content |
|---|---|
| Options | (A) One table per entity for everything, state rebuilt by queries. (B) One snapshot of the engine state. (C) **Hybrid**: tables for records, one snapshot row for the simulated-hardware state |
| Criteria | Q4 (store state, sessions, evidence, events, audit and periodic health snapshots; never store meter frames, DEC:D4); the audit table is append-only with a serialised chain as a database feature (BP:289); state survives a restart (success criterion 2); one initial migration set (BP:115) |
| Evidence | Today's whole persistence is a snapshot of 30 of 33 slices; `audio`, `clock` and `auth` are excluded (R1:92). Ten device slices are recomputed by one derivation function (R1:42). Audit rows are chained with `sha256(prevHash ‖ canonicalJSON(body))` and `seq = total + 1`, appends are serial, the ring keeps 1,000 rows (R1:87). Identifiers come from counters in state (R1:97). While recording, the engine adds about 7.5 audit rows per minute (R2:487). The web verifies the chain itself from `prevHash`, `hash`, `seq` and the row body (R3:60) |
| Choice | **(C).** **Tables** for what the product treats as a record: operators, roles, permissions, grants, auth sessions, devices, pairing codes, audit rows, events, sessions and their history, evidence items with tracks and custody, exports, alerts, storage policy, settings, counters, periodic health snapshots. **One snapshot row** (JSON) for the simulated-hardware slices (cameras, microphones, network, ports, other devices, time, security, services, faults, diagnostics, update, the health series), written at most once a second when changed and at shutdown. **Never stored**: `audio` frames |
| Audit rules (inputs for row 16) | Same hash function and canonical form as the shared code, computed in the server, so the clients' own verification works on server rows (R3:60). Append-only by role privileges and a trigger. Serialised twice: the engine is the single writer, and the database refuses a row whose sequence or previous hash does not continue the chain (the 50-writer test of row 31, BP:304) |
| Seed clock rule (DEC:F6) | **The seed runs as of the server clock at seed or reset time**, as the simulator does; identifiers carry the seed date; the demo packages join by suffix on any day (R2:520). The seed function takes `now` as a parameter, and tests pass the fixed instant the suites already use (2026-10-01 10:00 WIB, R4:345). API examples shown in Live mode are taken from the database, not from the frozen example identifiers (R13 test F-1 shows what happens otherwise) |
| Rejected | (A): maps 33 slices, ten of them derived, to tables and back, for no demo value; (B): no relational audit, users or evidence, so no append-only table, no administration queries, no stable pagination over the bulk fixture (BP:318). Seed as of a fixed date: the frozen identifiers would match, but "today" lists would be empty on any demo day (R2:466) |
| Rollback | Reset to the seed state rebuilds everything; a slice can move from the snapshot to a table by a forward migration |
| Hand-built | The mapping between slices and tables (part of the engine host, ADQ-1) |
| Known edge | Before about 02:25 WIB fewer than seven items are "sealed today" (R13 section 6.2); the reset time is shown in the demo controls |
| Proof | Rows 28, 29, 31, 55 |

### ADQ-5 Which process owns which port?

| Field | Content |
|---|---|
| Options | (A) The new backend on its own port, mock-core unchanged. (B) The backend takes over 4400. (C) Grow mock-core |
| Criteria | HEARTBEAT mode, mock-core's tests and the launcher stay untouched (P5, P21); no port of the other project is bound (BP:427); every listener on 127.0.0.1 |
| Evidence | 4420 to 4429 appear nowhere in tracked source (R5:480). mock-core's host and port are constants with no override, and HEARTBEAT mode, the `reverse` script and `device-session.sh` assume 4400 (R5:454-455, R5:473; R4:61, R4:64). The launcher owns 4410 to 4419 and a test binds 4410 and 4411 (R5:475, R5:140). Q2 keeps mock-core as it is (DEC:D4) |
| Choice | **(A).** `@dems/core-server` listens on **`127.0.0.1:4420`** for HTTP and the socket (path `/ws`). mock-core stays on 4400, the launcher on 4410 to 4419, the web dev server on 127.0.0.1:5173 with lanes 5176 to 5178, PostgreSQL on 127.0.0.1:4432 (TD-02), lane backends on 4421 to 4423 (ADQ-10). The host is fixed to 127.0.0.1 in code and cannot be configured (U4); the port can be set by an environment variable for lanes. New constants for the backend are added to the shared constants file beside the existing ones; no existing value changes, so the launcher guard stays green (R5:237). The mobile `reverse` script and the device sessions add `tcp:4420` (BP:421) |
| Rejected | (B) breaks HEARTBEAT regression, mock-core's tests and P5; (C) is Q2's rejected option and changes a packaged input (R5:216) |
| Rollback | The port is one constant and one environment variable |
| Hand-built | None |
| Proof | Row 24 (ports free) and row 56 (`lsof` shows 127.0.0.1 only, BP:329) |

### ADQ-6 Web session transport and socket authentication

| Field | Content |
|---|---|
| Options | (A) **A same-origin dev proxy with a cookie**: the Vite dev server forwards `/api` and `/ws` to the backend. (B) Cross-origin calls with CORS, credentials and a cookie. (C) A bearer token held in memory by the page, with CORS. (D) A bearer token in web storage |
| Criteria | The socket must be authenticated at the upgrade; no token in a URL or in web storage; the lane on 5178 must be able to sign in (BP:117); least change to pinned shared constants; the packaged build stays inert |
| Evidence | The Core origin in the web is either `http://127.0.0.1:4400` or the page origin; `vite.config.ts` has no proxy (R3:62; section 3.4). The page-origin branch already exists for the packaged build: `coreHttpOrigin()` and `coreWsUrl()` return the page's own origin when the build flag says so (R3:312-315). mock-core's CORS allows GET, POST, OPTIONS, one header, no credentials, origin 5173 only; the lane ports are not in `WEB_DEV_ORIGINS`, and that constant is a pinned build input (R5:113, R5:116). A page on one loopback port calling another is cross-origin; a credentialed call then needs an explicit origin and the credentials flag; whether two loopback ports are the same site for an IP-literal host is not stated by the sources (R10:247). Cookies are not isolated by port (R10:254). Browsers send cookies on a socket handshake, so the Origin must be checked on every handshake (R8:388). The packaged content-security policy is injected only by the packaged build and allows loopback sockets only (R3:322) |
| Choice | **(A).** In Live mode the web console talks to its own origin; the Vite dev server's built-in proxy forwards `/api/v1` and `/ws` to `127.0.0.1:4420` (or to a lane backend). The session cookie of TD-06 is then a first-party cookie, the socket upgrade carries it, and no CORS plugin is registered. The server keeps an **Origin allowlist in its own configuration** (127.0.0.1 and localhost on 5173, 5176, 5177, 5178) and applies it to every state-changing request and every socket upgrade that presents a cookie; this answers D9 DN-5 without editing `WEB_DEV_ORIGINS`. **Mobile**: bearer header on REST and on the upgrade (R8:406), no cookie; a request with a valid bearer and device needs no Origin. **Unauthenticated sockets** receive the heartbeat only (TD-08). **Content-security policy and CORS** (impact question 16): no change; the packaged build is Simulated-only (ADQ-7) |
| Rejected | (B): same-site behaviour for loopback ports is unconfirmed, every lane needs an allowlist entry in a pinned file, and CORS adds preflights to every call; (C): the socket cannot carry the token except in a URL or a first message (R8:400, R8:412), and a reload signs the operator out; (D): against OWASP's storage rule (R10:226) |
| Fallback | (B) with `@fastify/cors` 11.3.0 (installed, MIT, R8:154) if the proxy cannot carry the socket (AS-07) |
| Rollback | Remove the `server.proxy` block from `vite.config.ts`; Simulated mode never uses it. The server's Origin allowlist is configuration |
| Side effect to record | The cookie is sent to every port of 127.0.0.1 that the same browser profile visits, including other local servers (R10:254). The token is random, short-lived and revocable; the risk is accepted for a loopback demo and listed as G-08 |
| Write path note for row 21 | `apps/core-web/vite.config.ts` must be added to row 62's write paths (BP:548 does not list it); it is a pinned build input, which D9 DN-1 allows to change |
| Hand-built | The Origin guard (already named in TD-06) |
| Proof | Row 62 (both modes load on the lane) and row 64 (one live sign-in) |

### ADQ-7 Default mode per build

| Build | Modes offered | Default | Rule |
|---|---|---|---|
| Web, dev server | Simulated and Live | **Simulated** | A mode selector; the choice is kept under a new storage key that collides with none of the eight existing keys (R3:261-268); an environment variable can preselect Live for a lane. Changing the mode reloads the page, because one data source is created per page load (R3:48) |
| Web, packaged build (`VITE_DEMS_CORE_ORIGIN=same-origin`) | Simulated only | Simulated | Live code is inert and the selector is hidden (E8, BP:174; R17 in BP:642) |
| Web, tests | Simulated unless a test injects the Live source with the fake transport | Simulated | The 28 simulator-dependent test files are untouched (R3:66) |
| Mobile, debug build | SIMULATED, HEARTBEAT, LIVE | **SIMULATED** | LIVE is a third Core link source with the same build gate as HEARTBEAT; a stored LIVE value falls back to SIMULATED in a release build by the existing path (R4:59, R4:226) |
| Mobile, release APK | Simulated only | Simulated | No cleartext traffic in the release manifest (R4:63); a Live APK is U4 |
| Mobile, jest | Simulated unless injected | Simulated | The 33 test files and 11 harness files are untouched (DEC:F15) |

| Field | Content |
|---|---|
| Options | (A) A build flag only. (B) **A runtime setting in development builds, with release builds fixed to Simulated** (the table above). (C) Automatic fallback from Live to Simulated |
| Criteria | The released 0.1.0 behaviour is unchanged (D9 DN-1); the same debug binary shows both modes; a presenter always knows which data is on screen; stored keys are kept (U8) |
| Evidence | No mode selector or mode label exists in the web (R3:67). The mobile Settings screen already lists the Core link sources from one array (R4:221). The stored keys must never be deleted (E10, BP:176) |
| When Live is selected and the backend is unreachable (E9) | The client shows an offline state with an explicit "use Simulated mode" action. **It never falls back silently**: the two modes hold different data, and a silent switch would show simulated records as if they were the Core's |
| What the UI shows | A mode indicator in the web shell and in the mobile header in both modes; the login trust line gets truthful wording per mode (Q13, DEC:D4); the demo-operator hints stay as Q12 decided, except the simulator's fixed pairing code, which has no meaning in Live mode and is not shown there (R4:57) |
| Rejected | Live as the default in dev builds (a checkout with no backend would open on an error; Simulated is the safe fallback during a demo, RT:200); automatic fallback (above); a build flag only (the same debug APK must show both modes on an emulator) |
| Rollback | The default is one constant per client |
| Proof | Rows 62, 78, 97, 109 |

### ADQ-8 Name and location of the backend application

| Field | Content |
|---|---|
| Options | (A) **A new workspace `apps/core-server`**. (B) Grow `apps/mock-core`. (C) Rename mock-core |
| Criteria | Additive only (I5, U8); the same toolchain as the existing service; later rows never share a file (P6) |
| Evidence | The workspace glob `apps/*` registers a new folder with no root edit, and root typecheck, lint and test then run it (R5:363-365). mock-core runs TypeScript source through `tsx` and extends `tsconfig.base.json` (R5:135, R5:381). The base config forbids enums, parameter properties and namespaces and requires explicit type imports (R5:386) |
| Choice | **`apps/core-server`, package `@dems/core-server`** (BP:119), ESM, run with `tsx` 4.23.15, extending `tsconfig.base.json`, linted with oxlint 1.86.0, tested with Vitest 5.0.3: the same toolchain as mock-core. Layout as the blueprint sketches (BP:200-202). The module folders are registered by static imports in the app factory that row 25 writes together with one stub per module, so later rows fill their own folder and never edit the factory (BP:531); no autoload plugin is added. Package version `0.2.0`, private, so the health answer can be told apart from the 0.1.0 services (input for impact question 2) |
| Rejected | Growing or renaming mock-core (Q2; U8); a name with "api" (the contract file is `core-api.ts`, BP:119) |
| Rollback | Delete the folder; the glob drops it |
| Hand-built | None |

### ADQ-9 Where do new permissions and audit types live?

| Field | Content |
|---|---|
| Options | (A) Additive values in the existing shared vocabulary. (B) A separate server-side vocabulary |
| Criteria | One vocabulary for both modes; existing values and wire strings unchanged (BP:299); one writer; the fewest edits to typed maps in the clients |
| Evidence | The 44 audit types name no generic denial, no pairing-code issue, no device revocation, no role change and no user enable or disable; a new type must also enter the category map (`satisfies Record<AuditType, AuditCategory>`) and the i18n key set that a sync test checks; `Permission` is not in that sync test (R1:88). The role table lives in `packages/shared/src/sim/auth.ts` (R2:387). Three web modules and two mobile files import that table by value, and the web's read-only matrix panel is built from it (R3:54, R3:140-142; R4:187). Server rows flow into the same `audit` slice that the existing components render by `AuditType` |
| Choice | **(A).** Row 26 adds, with labels: the new permissions (pairing management, user administration, demo controls) to `Permission` and to the role table; the new audit types (generic access denial, pairing code issued, device paired, device revoked, role changed, user enabled, user disabled) to `AuditType` and its category map **using the existing eight categories**, so category-keyed maps in the clients need no new entry; event types as row 15 needs. Existing values and wire strings do not change |
| Consequences | The role table is under `src/sim/`, so row 26's write paths must name `sim/auth.ts` and `sim/vocabulary.ts` and the i18n files (note for row 21). In Simulated mode the matrix panel shows the new permission rows, and tests that count permissions or compare the contract's role metadata with the table (R2:191) change by design; that is the blueprint's risk R16 (BP:641) and belongs to row 26's verification |
| Rejected | (B): two vocabularies would leave the clients' typed maps without labels and tones for rows that the server writes |
| Rollback | Additive values can stay unused |
| Hand-built | None |
| Proof | Row 26 (vocabulary-sync, sim-contract and determinism tests; three typechecks, BP:299) |

### ADQ-10 How do parallel live checks avoid interfering?

| Field | Content |
|---|---|
| Options | (A) One owner of the backend port at a time (P18). (B) **Lane instances**: up to three more backends, each with its own database and engine |
| Criteria | No false failure from shared state; throughput of the client waves; host load within D6; no change in the apps to address a lane |
| Evidence | There is one Core state: one active session, role changes and revocations are global (BP:121). About 30 client rows each need a live check of up to 10 minutes (BP:469, BP:506-509). The device side of `adb reverse` can stay on the main port while the host side differs (BP:470). The host has 10 cores and 24 GB, and a wider run once overloaded it (DEC:D6) |
| Choice | **(B) for the client waves, (A) for the gates.** Main instance: port 4420, database `dems_demo`, used serially by rows 56, 101 and 104 to 110. Lanes 1 to 3: ports 4421 to 4423, databases `dems_lane_1` to `dems_lane_3`, one lock file per port. A web check binds a Vite lane (5176 to 5178) whose proxy points at its lane backend. A device check maps its emulator with `adb -s <serial> reverse tcp:4420 tcp:442x`, so the app's address never changes. A check takes one lane lock, resets that lane's database to the seed, runs for at most 10 minutes, stops its backend and releases the lock. One PostgreSQL instance serves all lanes |
| Guard | At most three lanes; if tests start to time out under load, fall back to (A) (D6) |
| Rejected | (A) alone: about five hours of serialised port ownership inside waves that are otherwise parallel (**hypothesis**: 30 rows at up to 10 minutes) |
| Rollback | Lanes are configuration only |
| Hand-built | None |
| Proof | Row 18 fixes the lane table; the first client wave exercises it |

---

## 6. Pinned versions and licences

Every version and licence is taken from the cited research line. "Installed" means it is already in the lockfile at baseline `acaff20`.

| Package | Version | Licence | Workspace | State | Source |
|---|---|---|---|---|---|
| `fastify` | 5.12.5 | MIT | core-server | installed | R8:153 |
| `@fastify/websocket` | 11.3.1 | MIT | core-server | installed (latest is 11.3.3) | R8:84, R8:155 |
| `ws` (test client) | 8.22.0 | MIT | core-server (dev) | installed | R8:184 |
| `@types/ws` | 8.18.2 | MIT | core-server (dev) | installed | R8:185 |
| `@fastify/cookie` | 11.1.2 | MIT | core-server | new | R8:156 |
| `@fastify/rate-limit` | 11.2.0 | MIT | core-server | new | R8:160 |
| `@fastify/static` | 10.1.5 | MIT | core-server | new, only if row 15 assigns media to the server | R8:161 |
| `@fastify/helmet` | 13.1.1 | MIT | core-server | new, optional (row 20) | R8:175 |
| `fastify-type-provider-zod` | 7.0.0 | MIT | core-server | new | R8:165 |
| `@fastify/swagger` (peer of the provider, not registered) | 9.9.1 | MIT | core-server | new | R8:163 |
| `openapi-types` (peer of the provider) | 12.1.3 | MIT | core-server | new | R8:183 |
| `zod` | 4.6.5 | MIT | core-server | installed | R8:167 |
| `drizzle-orm` | 0.45.3 | Apache-2.0 | core-server | new | R7:59 |
| `drizzle-kit` | 0.31.11 | MIT | core-server (dev) | new | R7:60 |
| `pg` | 8.23.1 | MIT | core-server; root (dev) | new | R7:252 |
| `@types/pg` | **not confirmed in the research** | not confirmed | core-server (dev) | new; row 25 pins and records it | R7:252 mentions the package only |
| `rate-limiter-flexible` | 11.2.1 | ISC | core-server | new | R10:72, R10:441 |
| `@vitest/coverage-v8` | 5.0.3 | MIT | core-server (dev) | new | R12:163 |
| `vitest` | 5.0.3 | MIT | core-server (dev) | installed | R12:65 |
| `tsx` | 4.23.15 | licence not in the research (installed) | core-server | installed | R8:84 |
| `typescript`, `oxlint`, `@types/node` | 6.0.3, 1.86.0, 26.6.3 | licences not in the research (installed) | core-server (dev) | installed | R8:84 |
| `@noble/hashes` (chain hash, through the shared package) | 2.4.0 | MIT | shared | installed | R1:690; R10:50 |
| `embedded-postgres` | 18.4.0-beta.17 | MIT (wrapper); binaries Apache-2.0 per its README; PostgreSQL itself under the PostgreSQL License | root (dev) | new | R6:73, R6:75 |
| `@embedded-postgres/darwin-arm64` (installed by the above) | 18.4.0-beta.17 (PostgreSQL 18.4) | as above | root | new | R6:78-80 |
| `qrcode.react` | 4.2.0 | ISC | core-web | new | R11:228 |
| `@tanstack/react-query` | 5.104.0 | licence not in the research (installed) | core-web, mobile | installed | RT:334 |
| `expo-secure-store` | 57.0.4 (declared `~57.0.4`) | MIT | mobile | new, native | R11:151-153 |
| Fallbacks, not installed unless a proof fails | Homebrew `postgresql@18` 18.6 (PostgreSQL); `kysely` 0.29.6 (MIT) with `node-pg-migrate` 9.0.0 (MIT); `@node-rs/argon2` 2.2.1 (MIT); `@hey-api/openapi-ts` 0.99.0 (MIT); `@fastify/cors` 11.3.0 (MIT, installed); `expo-camera` 57.0.6 (MIT) | | | | R6:143-144; R7:109, R7:226; R10:48; R9:224; R8:154; R11:267-269 |

Not a package: `crypto.argon2`, `crypto.randomBytes`, `crypto.timingSafeEqual` (Node 26.8.2 core, TD-05); Vite's dev proxy (Vite 8.3.1, installed, R9:180).

---

## 7. Host Impact Register

"Host" means anything outside tracked source files. Each line has its rollback verbatim. Lines H-01 to H-09 happen on the chosen route; H-12 only on the fallback.

| ID | Change | Where | Row | Persistent after the session? | Rollback |
|---|---|---|---|---|---|
| H-01 | npm packages `embedded-postgres@18.4.0-beta.17`, `@embedded-postgres/darwin-arm64` (147.7 MB), `pg@8.23.1` | `node_modules/`; root `package.json` (dev dependencies, one `allowScripts` entry); `package-lock.json` | 23 | Yes, inside the project | `npm uninstall embedded-postgres` then `npm install-scripts prune` (under `.locks/npm.lock`). The root `pg` entry is the driver, not the server; `npm uninstall pg` at the root removes it too, and the backend workspace keeps its own dependency |
| H-02 | PostgreSQL cluster, password file, connection settings, server log | `.data/` (git-ignored by a rule row 23 adds) | 23 | Yes, inside the project | `pg_ctl -D .data/postgres -m fast -w stop` then `rm -rf .data` |
| H-03 | PostgreSQL process listening on `127.0.0.1:4432` | Process started by `scripts/pg/`; PID in `.locks/postgres.pid` | 23 onward | No: not a launchd job, not started at login | `"$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop` |
| H-04 | Backend process on `127.0.0.1:4420` (and 4421 to 4423 for lanes) | Process started by the row that holds the lock | 56 onward | No | Stop the recorded PID; release the lock |
| H-05 | `adb reverse tcp:4420` rule on an emulator | Emulator runtime state | 77 onward | Until the emulator restarts | `adb -s <serial> reverse --remove tcp:4420` |
| H-06 | Debug APK with one more native module (`expo-secure-store`) installed with `adb install -r` | The DEMS app on each emulator | 77 | Yes, on the emulator | Reinstall the debug APK that row 77 backed up (BP:350). If an emulator holds the release-signed build, an uninstall of the DEMS app there is needed first and loses that app's local demo state; that needs a recorded decision before row 77 (MJ-7, BP:253) |
| H-07 | Device credential and biometric token in the app's secure storage; one Android Keystore key | Inside the DEMS app's sandbox on the emulator | 79, 81 | Until the app is uninstalled or its data cleared (R11:160) | Revoke the device in the portal; unpair in the app |
| H-08 | Session cookie for host `127.0.0.1`; one new storage key for the mode | The browser profile used for the web console | 62, 64 | Cookie until sign-out or expiry; key until cleared | Sign out; clear site data for `http://127.0.0.1:5173` |
| H-09 | Network fetches: npm registry (rows 23, 25, 57, 77); Maven artefacts for the new Android module during the Gradle build (row 77) | npm cache; Gradle cache | as listed | Caches only | None needed |
| H-10 | AVD camera setting | `~/.android/avd/*/config.ini` | none | **Not changed** (TD-11) | Not applicable. Changing it would be a new host change and the controller's call |
| H-11 | Lock and PID files | `.locks/` (git-ignored) | several | Yes, inside the project | Delete the files this task created |
| H-12 | **Fallback route only**: Homebrew keg `postgresql@18`, dependency `krb5`, symlink trees under `/opt/homebrew`, a default cluster at `/opt/homebrew/var/postgresql@18`, a log file | `/opt/homebrew` | 23 | Yes, outside the project | The fallback removal block in TD-02 |
| H-13 | Sandbox bypass per command for port binding, `adb`, Gradle and git writes | Session permissions | several | No | Not applicable |

Not changed by any row under this record: the shell profile, launchd, Docker or Colima, the macOS firewall, another project's processes or ports, `release/`, the emulators' images or data partitions. If macOS shows a firewall prompt when a process binds a loopback port (**hypothesis**: it does not, for loopback), the row stops and reports (U4).

---

## 8. The 25 impact questions mapped to document and section

The questions are RT:237-274. "Section" is the section the named document must contain; the owner row writes it. The blueprint's own map is BP:125-151; this table adds the section and the input from this record.

| IQ | Topic | Document | Section to contain the answer | Owner row | Input from this record |
|---|---|---|---|---|---|
| 1 | Live and Simulated coexistence; UI in each mode | `masterplan/01_specs.md`; `masterplan/04_client_integration_spec.md` | "Mode contract: Live and Simulated"; "Mode switch per build type and the mode indicator" | 15; 17 | ADQ-7, ADQ-2 |
| 2 | 0.1.0 packages untouched; versioning of a live edition | `masterplan/01_specs.md` | "Released artefacts and versioning" | 15 | D9 DN-1; ADQ-8 (version 0.2.0); TD-13 |
| 3 | How a release APK reaches a backend | `masterplan/01_specs.md` | "Client reachability and its limits" (answer: not without U4) | 15 | ADQ-7; R4:63 |
| 4 | PostgreSQL install, start, stop, removal, port, data directory | `research/03_analysis.md`; `masterplan/02_plan.md` | TD-02 of this file; "PostgreSQL provisioning" and "Host Impact Register" | 14; 18 | TD-02; section 7 |
| 5 | PostgreSQL on a demo PC, four OS targets | `research/03_analysis.md`; `masterplan/01_specs.md` | TD-13 of this file; "Live package: cost and decision" | 14; 15 | TD-13 |
| 6 | Test database and its isolation | `masterplan/03_database_contract.md` | "Test-database isolation" | 16 | TD-12 |
| 7 | Dataset migration and date-relative seeding | `masterplan/03_database_contract.md` | "Seed mapping and seed clock rule" | 16 | ADQ-4; TD-04 |
| 8 | Where demo media live in Live mode and who serves them | `masterplan/01_specs.md` | "Media and evidence package files" | 15 | Recommendation: the clients keep their bundled demo media in this task and the server owns records, hashes and verdicts; a newly sealed item has no media in either design (R2:522). If row 15 decides otherwise, `@fastify/static` 10.1.5 is the pinned option and row 41 applies (BP:314) |
| 9 | Reset to the seed state | `masterplan/03_database_contract.md`; `masterplan/01_specs.md` | "Migration order and reset"; "Demo controls" | 16; 15 | TD-04; ADQ-1 notes; G-10 |
| 10 | A session recording when the backend stops | `masterplan/01_specs.md` | "Engine: restart and recovery" | 15 | ADQ-1 (5) |
| 11 | Hashing, session or token model, expiry, revocation, credential storage | `masterplan/01_specs.md`; `masterplan/04_client_integration_spec.md` | "Security requirements: identity and sessions"; "Credential storage per client" | 15; 17 | TD-05, TD-06, TD-10 |
| 12 | Server-side lockout and rate limiting | `masterplan/01_specs.md` | "Sign-in and pairing: lockout and rate limits" | 15 | TD-06, TD-10 |
| 13 | Socket authentication; what an unpaired or signed-out client receives | `masterplan/01_specs.md` | "Realtime protocol: authentication and visibility" | 15 | TD-08, ADQ-6 |
| 14 | Audit trail: append-only storage, hash chain, which actions write a row | `masterplan/01_specs.md`; `masterplan/03_database_contract.md` | "Audit: types and writers"; "Audit table: append-only and chain serialisation" | 15; 16 | ADQ-4, ADQ-9, TD-07 |
| 15 | Secrets: generation, storage, exclusion from git and logs | `masterplan/01_specs.md`; `masterplan/02_plan.md` | "Secrets handling"; "Secrets and git-ignore checks" | 15; 18 | TD-02 (credentials); TD-06 (no signing secret exists); section 11 |
| 16 | CORS and the packaged content-security policy | `masterplan/01_specs.md`; `masterplan/04_client_integration_spec.md` | "Origins, CORS and content-security policy"; "Web transport: the dev proxy" | 15; 17 | ADQ-6 |
| 17 | Biometric and security-key sign-in | `masterplan/01_specs.md`; `masterplan/04_client_integration_spec.md` | "Sign-in methods in Live mode"; "Biometric unlock and the security-key button" | 15; 17 | TD-10; Q11 (DEC:D4) |
| 18 | Permission list and role matrix | `masterplan/01_specs.md` | "RBAC model: permissions and role matrix" | 15 | TD-07, ADQ-9 |
| 19 | How clients learn of a permission or pairing change | `masterplan/01_specs.md`; `masterplan/04_client_integration_spec.md` | "Realtime protocol: session and device events"; "Reacting to a role change and to a revocation" | 15; 17 | TD-08; ADQ-2 (the gates are reactive to the store, R3:652) |
| 20 | Pairing lifecycle, device identity, re-pairing | `masterplan/01_specs.md`; `masterplan/04_client_integration_spec.md` | "Pairing lifecycle and device registry"; "Pairing flow and the pairing-required gate" | 15; 17 | TD-10, TD-11; R4:60 (no gate exists today) |
| 21 | Endpoint list, realtime schema, resync | `masterplan/01_specs.md` | "API contract: operation tables"; "Realtime protocol: messages and resync" | 15 | TD-09, TD-08 |
| 22 | Changing the shared contract without collisions | `masterplan/02_plan.md`; `identification/02_structured.md` | "Serial slots: the contract owner"; P17 | 18; 21 | TD-09 (no generated files, so one writer and no regeneration step) |
| 23 | API Reference page when every operation is live | `masterplan/04_client_integration_spec.md` | "API Reference page in both modes" | 17 | TD-09; R2:158 (the two-value mode and the Try-it routing change together) |
| 24 | Test strategy | `masterplan/02_plan.md`; `masterplan/01_specs.md` | "Test strategy"; "Acceptance criteria" | 18; 15 | TD-12; G-01 |
| 25 | Predecessor known issues that must not get worse | `masterplan/02_plan.md` | "Known issues touched (KI-01, KI-02, KI-07, KI-18)" | 18 | KI-02: Maestro flows stay a follow-up (TD-12); KI-18: one pass over the 8 places (R2:286-295); KI-07: the server guard closes the mobile simulator gaps (R4:654-659); KI-01: the pairing screen changes, so its tablet layout needs a device check in row 81 |

---

## 9. Gap and risk register

Type: G = gap in evidence, R = risk, C = correction to a research statement.

| ID | Type | Item | Evidence | Effect | Mitigation and owner |
|---|---|---|---|---|---|
| G-01 | R | **The baseline root test command is not green.** `apps/core-web/src/test/sim-fetch.test.ts:121` uses a frozen evidence identifier and fails on any date other than 2026-10-01; `features/storage/__tests__/storage-page.test.tsx:139` fails before about 02:25 WIB | R13 section 6; DEC:F20 | D9's rule and success criterion 7 cannot be shown as measured until the fix lands | **Already decided (D10)**: an early, dedicated slot fixes both tests; until then gate rows accept exactly these two failures by name; gate rows run tests per workspace with `--maxWorkers=2`. Input from this record: give both tests a fixed clock, as the other suites have (R3:620), and keep the fix consistent with the seed clock rule of ADQ-4. Rows 18 and 21 place the slot |
| G-02 | C | Host fact H6 ("npm lifecycle scripts are enabled") is incomplete: npm 11.19.1 has an install-script approval list | R6:33; section 3.4 | Without an approval the PostgreSQL binaries may fail to load | TD-02 step 1 and trial T1; AS-09 |
| G-03 | G | No candidate was installed or run in rows 6-12 | R6:540, R7:301, R8:435, R9:329, R10:615, R11:33 | Every technology choice rests on declared metadata | The proof named in each record (rows 23, 25, 28, 32, 37, 58, 77) |
| G-04 | R | The npm binaries are PostgreSQL 18.4; the current minor is 18.6 | R6:74 | Two minor releases of fixes are missing | Loopback only, password authentication; the fallback route has 18.6; noted for the final report |
| G-05 | G | Registry signature and provenance state of `embedded-postgres` not recorded | R6:73-77 (no attestation fact) | Supply-chain criterion not fully evidenced | Trial T8 |
| G-06 | G | Quarantine and Gatekeeper behaviour of binaries fetched through npm on macOS 27 | R6:546 | The server may not start | Trial T2; fallback |
| G-07 | G | The typed client and zod validation were never run on Hermes | R9:329-330 | A client that works in jest may fail on the device | Row 58 emulator proof (controller constraint 6) |
| G-08 | R | Cookie on loopback: no `Secure` attribute; visible to every port of 127.0.0.1; same-site rules for IP-literal hosts not stated; an open Safari bug | R10:254, R10:247, R10:261 | A session cookie may reach another local server; Safari may not keep the session | Same-origin proxy; opaque, short-lived, revocable token; Chromium for the demo (AS-10); row 20 reviews |
| G-09 | G | The Vite proxy carrying the socket, also on lanes | AS-07 | The web cannot authenticate its socket | Row 62; fallback ADQ-6 (B) |
| G-10 | R | A reset to the seed state rebuilds the audit chain | R1:96 | "Append-only" has one deliberate exception | The reset is a database re-creation by the owner role behind a permission and a server-side demo flag (Q14); rows 16 and 20 state it |
| G-11 | R | The session identifier is not renewed after a role change | R10:212 | Deviation from OWASP guidance | No privilege is stored in the session; row 20 rules |
| G-12 | R | The demo password is one constant shown on both login screens; its literal is also in `README.md` and a release script; Q12 keeps it | DEC:F7; R2:381; R3:96 | In Live mode the server accepts a published password | Hash only on the server; hidden in presentation mode as today; row 20 rules on the Live-mode disclosure |
| G-13 | R | Seed dates: identifiers change with the seed date; fewer than seven "sealed today" before about 02:25 WIB | R2:475; R13 section 6.2 | Frozen example identifiers do not exist in the database on other days | ADQ-4 seed clock rule; examples read from the database |
| G-14 | G | Biometric-protected storage on an emulator; what `adb install -r` does to a Keystore entry; which build each emulator holds | R11:159, R11:160; BP:162 | Biometric unlock may be weaker on emulators; a debug install may need an uninstall | Rows 24, 77, 79; decision before row 77 (MJ-7) |
| G-15 | G | Maestro outside the sandbox; one flow across a browser and an emulator | DEC:F19; R12:190 | No scripted end-to-end run | Rows 106-108 are evidence-based manual runs; row 24 checks Maestro |
| G-16 | G | Not in the research: the `@types/pg` version, the logger's redaction options, the `rate-limiter-flexible` call details, `npm rebuild` with an approved script, `pg_ctl -w` without a socket | section 4 (each marked) | Small rework in the scaffold rows | Rows 23, 25, 32 confirm and record |
| G-17 | R | 20 Hz frames through a socket (and the dev proxy) may stutter | BP:160 | The demo looks worse than the simulator (I8) | Row 110 measures; lower the wire rate and interpolate |
| G-18 | R | Two clones of one template at the same time fail | R12:101, R12:118 | Flaky database tests | Clones are serialised (TD-12) |
| G-19 | R | Additive vocabulary changes alter Simulated-mode screens and tests that count permissions | BP:641; R2:191 | Simulated tests change by design | Row 26 owns them; recorded as expected |
| G-20 | G | Write paths missing from rev 1 of the blueprint: `apps/core-web/vite.config.ts` (row 62), `packages/shared/src/sim/auth.ts` (row 26), the hard-coded ports in `apps/mobile/scripts/device-session.sh` (R4:337), the decoder in row 76's check | BP:548, BP:299, BP:349 | A row would return `needs-review` | Row 21 |
| G-21 | G | The health schema's `service` literal | R5:49 | The backend cannot be told apart from mock-core by its health answer | TD-09 proposal; row 15 |
| G-22 | C | Row 8 reports the installed `@fastify/websocket` pin as behind the registry; the newer release is hours old | R8:90 | A reader could "fix" the pin | TD-01 keeps 11.3.1 |
| G-23 | C | Rows 7, 8 and 9 repeat npm's "root-owned files" message | R7:34, R8:48, R9:151; DEC:F10 | A reader could run `sudo chown` | F10 stands: it is the sandbox; no ownership change |
| G-24 | G | The seeded operator `OPR-001` has the given name "Budi" (username `budi.santoso`), which is also the given name of the workspace git identity (`git config user.name`, first word) | R2:374 | U7 forbids the user's name as seed data (RT:229); this is predecessor data, a different person name, with no e-mail | Controller confirms that the predecessor's synthetic operator may stay; no change proposed |
| G-25 | R | The engine's actor scope: if the `auth` slice were not cleared after a command, later engine rows would carry the last caller as actor | ADQ-1 (1); R1:84 | Wrong actor in audit rows | A test in row 37: after every command the engine's `auth` is signed out and engine-written rows have no operator |
| G-26 | R | The lockout counters are in memory and reset on a server restart | TD-06 | A restart clears a 60-second lock | Accepted for a demo; row 20 may ask for the PostgreSQL store |
| G-27 | R | Drizzle's documentation describes the `rc` line, not the pinned release | R7:65 | A row could follow the wrong docs (for example the `drizzle-orm/zod` export, which 0.45.3 lacks, R7:71) | Stated in the briefs of rows 25 and 28 |
| G-28 | R | Host load with three lane backends, PostgreSQL, Vite lanes, Metro and emulators | DEC:D6 | Test timeouts | Two test workers; at most three lanes; drop to serial ownership |
| G-29 | G | `research/03_external_vocabulary.md` does not exist | `ls` printed "No such file or directory" | The dimension definitions were taken from RT:348-353 | None needed |

---

## 10. External research synthesis

Dimensions in scope by inference: 1, 2 and (limited) 3 (RT:350-352). Dimensions 4 to 7 were not triggered (RT:353).

| Dimension | Findings | Effect on the decisions |
|---|---|---|
| 1 Technology Trends | Node 26 enters LTS on 2026-10-28; the host line is not yet LTS (R8:104). TypeScript 6.0.3 is no longer npm `latest` (7.0.2) (R7:41). Fastify 6 is an alpha on `main`; npm serves 5.12.5 (R8:122). Drizzle 1.0 and Prisma 8 are release candidates (R7:59, R7:89). Hermes V1 is the default engine since React Native 0.84 (R9:190). Expo SDK 56 and later replace the global `fetch` on the device (R9:194). The current PostgreSQL minors are 18.6 and 17.11 (R6:458) | Pin exact stable releases, never an `rc` tag; prove each choice on Node 26.8.2 in its scaffold row; prove the client on the device |
| 2 Technology Evaluation | The comparative rationale is in TD-01 to TD-13 | Section 4 |
| 3 Vendor Evaluation (licence, account need) | Every chosen package is MIT, ISC, Apache-2.0 or under the PostgreSQL License (section 6). Avoided on licence: the GPL-3.0 Fastify adapter for CASL and the AGPL-3.0 Permify service (R10:496, R10:531). No chosen package needs an account or a hosted service; the hosted options are in the excluded registers (R10:561-570; R12:264-268). Single-maintainer packages among the choices: `embedded-postgres` (R6:76), with the mitigations of TD-02 | Build-versus-buy: fifteen small elements are hand-built (section 13.2); nothing is bought or hosted |
| 4 Market Share & Positioning | No findings: not triggered | None |
| 5 Regulatory & Compliance | No findings: not triggered. Public security guidance (OWASP, NIST, RFCs) was used as an evaluation criterion under dimension 2 (R10:582-607) | Section 11 |
| 6 Competitive Landscape | No findings: not triggered | None |
| 7 Industry Trends | No findings: not triggered | None |

---

## 11. Security boundary for the design review (row 20)

**Floor that the design meets (controller constraint 8)**

| Control | Where decided | Evidence for the parameter |
|---|---|---|
| Passwords stored only as a salted Argon2id hash: memory 19456 KiB, 2 passes, parallelism 1, 16-byte salt | TD-05 | R10:89, R10:117 |
| Session token: 256 random bits, only its SHA-256 stored, revocable at once; idle 15 minutes, absolute 8 hours | TD-06 | R10:205, R10:219 |
| No password, token, pairing code or device credential in a URL, a log line, an audit row or a realtime message | TD-01 (logging rule), TD-06, TD-08, TD-10, TD-11 (payload is not a URL) | R8:412; R8:424 |
| Every listener on 127.0.0.1: PostgreSQL (4432), the backend (4420 to 4423), the web dev server | TD-02, ADQ-5 | R6:455; R3:318 |
| Audit rows append-only, hash chain serialised, the same hash as the shared code | ADQ-4 | R1:87; BP:289 |
| Every denial writes one audit row; deny by default; a route without an access rule cannot boot | TD-07 | R10:475 |
| Lockout for sign-in and pairing; attempts on a pairing code limited; code valid for at most 10 minutes | TD-06, TD-10 | R10:420, R10:376, R10:383 |
| Socket authenticated at the upgrade; Origin allowlist; sockets closed when a session or a device is revoked | TD-08, ADQ-6 | R8:388, R8:418 |
| Secrets generated locally, mode 0600, git-ignored, removed with the cluster; no signing secret exists in this design | TD-02, TD-06 | R5:398-400 |

**Deliberately out of scope (so that the review has a clear edge)**

| Item | Consequence that is accepted |
|---|---|
| Real PKI, mutual TLS, certificate-bound pairing | The device credential is a bearer secret, a stand-in for the book's certificate-bound pairing (Q8, DEC:D4); no proof of possession (the standard for it is R10:348) |
| TLS on loopback | Cookies carry no `Secure` attribute; traffic between the browser, the dev proxy, the backend and the emulators (through `adb reverse`) is cleartext on the loopback interface |
| An external identity provider, single sign-on, WebAuthn | The web "security key (simulated)" button is offered in Simulated mode only (Q11) |
| A hostile local user or process on the same Mac | The same uid can read `.data/`, the browser profile and process memory |
| Encryption at rest of the database | Synthetic data only (I6, RT:168) |
| Production hardening: several processes, a shared rate-limit store, high availability | One process; in-memory lockout counters (G-26) |
| Real evidence signing | The demo key is published in the index, so signatures prove nothing (R2:516) |
| A Live release APK or a physical tablet | U4 |

**Deviations from public guidance that row 20 should rule on**: G-08 (cookie attributes on loopback), G-11 (no identifier renewal on role change), G-12 (published demo password accepted in Live mode), G-10 (reset rebuilds the chain).

---

## 12. Files and modules, implementation order, acceptance criteria, recommendations

### 12.1 Files and modules involved

| Path | Role under these decisions |
|---|---|
| `apps/core-server/` (new) | Fastify app factory, identity, guard, pairing, engine host, realtime, modules, `src/db/` (schema, migrations, seed, fixtures), tests (ADQ-8) |
| `scripts/pg/` (new), `.data/` (new, git-ignored), `.gitignore` | PostgreSQL lifecycle scripts and data (TD-02) |
| `packages/shared/src/api/` | Operation registry grown to every operation; realtime message union; additive constants; health schema widened (TD-09, ADQ-5) |
| `packages/shared/src/client/` (new), `src/live/` (new), `src/realtime/` | Registry-driven client; Live source, settle helper, mode switch; live socket client (TD-09, ADQ-2, ADQ-3) |
| `packages/shared/src/sim/vocabulary.ts`, `sim/auth.ts`, i18n files | Additive permissions, audit types, labels (ADQ-9). No other file under `src/sim/` is written |
| `apps/core-web/src/main.tsx`, `router.tsx`, `routes/__root.tsx`, `vite.config.ts` | Mode selection, Live source injection, dev proxy (ADQ-2, ADQ-6, ADQ-7) |
| 26 web production files in 9 feature folders | Asynchronous action results (ADQ-3) |
| `apps/core-web/src/features/users-roles/`, `features/paired-devices/` (new) | The two portal pages; `qrcode.react` (TD-11) |
| `apps/mobile/src/runtime/` (4 files), `features/settings/preferences-section.tsx` | Third Core link source, Live source injection (ADQ-2, ADQ-7) |
| 27 mobile production files | Asynchronous action results (ADQ-3) |
| `apps/mobile/src/navigation/`, `src/auth/`, `features/pairing/`, `package.json` | Pairing gate, credential store, pairing request (TD-10; R4:60) |
| Not written: `apps/mock-core/**`, `release/**`, `scripts/release/**`, `packages/shared/src/demo-data/`, `packages/shared/assets/` | P21, P13 |

### 12.2 Implementation order implied by the decisions

1. The fix slot for the two date-dependent web tests that D10 schedules (G-01), so that every later gate is green on any date and at any hour.
2. Row 23 with the TD-02 trial. Nothing else depends on the database before it passes; on failure, the fallback route and a drift entry.
3. Row 25 (scaffold with the pins of section 6 and the proofs of AS-02 and AS-08) and row 26 (vocabulary) in parallel.
4. Row 27 (registry), then rows 28 and 29 (schema, seed).
5. Rows 31 to 33 (audit writer, identity, guard), then row 37 (engine host; AS-03 is its first step) because every domain endpoint row calls the engine.
6. Rows 57 and 58 early, because the emulator proof of the typed client (AS-05) can invalidate TD-09's primary choice; row 77 right after, because it produces the debug binary that every mobile row needs.
7. Rows 59 and 60 (socket client, Live source), then the client seams (62, 78), then the page and screen rows on lanes (ADQ-10).

### 12.3 Acceptance criteria for this record (the controller's verification, BP:287)

1. 23 decision records are present: TD-01 to TD-13 (section 4) and ADQ-1 to ADQ-10 (section 5).
2. Each has a pinned version or a named pattern, at least one citation to rows 1-12, the rejected options and a rollback.
3. TD-02 gives install, init, start, stop and removal commands, the trial and the fallback, and states no Docker, no login service, loopback only.
4. All 25 impact questions are mapped (section 8).
5. Every assumption is labelled (section 1.6 and the word "hypothesis" in the text).
6. The Tier 1 elements are present: subject, stakeholders, timeline, scope, rationale with evidence, method, alternatives, assumptions, gaps (sections 1 and 9).

### 12.4 Recommendations

1. Record the PostgreSQL route as "npm binaries, trial first, keg as fallback" and tell the user the footprint: 148 MB in `node_modules`, a `.data/` folder, one process on 127.0.0.1:4432 while the demo runs, nothing at login.
2. Place the D10 fix slot (G-01) before row 23, so that the first implementation log starts from a green root gate.
3. Schedule the three early proofs (rows 23, 37 first step, 58) before the wide client waves; each has a named fallback, and each fallback changes later rows.
4. Give row 20 section 11 as its checklist start.
5. Give row 21 the write-path corrections of G-20.

---

## 13. Decisions for the controller to record

### 13.1 One line per choice

| ID | Choice |
|---|---|
| TD-01 | Fastify 5.12.5 with `@fastify/websocket` 11.3.1, `@fastify/cookie` 11.1.2, `@fastify/rate-limit` 11.2.0, `fastify-type-provider-zod` 7.0.0; run with `tsx` 4.23.15; no new server framework |
| TD-02 | PostgreSQL 18.4 from `embedded-postgres` 18.4.0-beta.17 (npm), driven by project scripts with `initdb` and `pg_ctl`; `127.0.0.1:4432`; data in `.data/postgres/`; trial T1-T8 in row 23; fallback Homebrew `postgresql@18` 18.6. No Docker, no login or background service, no shell-profile edit, loopback only |
| TD-03 | `drizzle-orm` 0.45.3 over `pg` 8.23.1; fallback Kysely 0.29.6 |
| TD-04 | `drizzle-kit` 0.31.11 SQL migrations applied by the server with `migrate()`; roll-forward only; seed program on the shared dataset; reset by database re-creation |
| TD-05 | Node `crypto.argon2`, argon2id, 19456 KiB, 2 passes, parallelism 1, 16-byte salt; fallback `@node-rs/argon2` 2.2.1 |
| TD-06 | Server-side opaque session in PostgreSQL: cookie (`HttpOnly`, `SameSite=Strict`) for the web, bearer header for mobile; idle 15 minutes, absolute 8 hours; lockout with `rate-limiter-flexible` 11.2.1 |
| TD-07 | Contract-driven permission guard on Fastify hooks: deny by default, any-of, one audit row per denial; roles and grants in PostgreSQL |
| TD-08 | `ws` 8.22.0 through `@fastify/websocket` 11.3.1 with a fixed topic list, snapshot then deltas, meter frames dropped per client on backpressure |
| TD-09 | Keep the zod registry and the repository's OpenAPI builder; routes registered from the registry; typed client derived from the registry; conformance by in-process Vitest tests; emulator proof in row 58; fallback `@hey-api/openapi-ts` 0.99.0 |
| TD-10 | `expo-secure-store` 57.0.4 without its config plugin: a device credential and a biometric-protected sign-in token |
| TD-11 | `qrcode.react` 4.2.0 in the portal; QR scanning on the device deferred; no camera module; no AVD change |
| TD-12 | Vitest 5.0.3; one database per test file cloned from a template; **database-backed tests behind `npm run test:db`**, which attaches to or starts the project-local PostgreSQL; `@vitest/coverage-v8` 5.0.3; end to end by rows 106-108 |
| TD-13 | Cost recorded; a path exists on paper for four targets; no live package is built in this task |
| ADQ-1 | The server hosts the shared simulator core headless; identity, pairing, persistence and clock are server-native |
| ADQ-2 | A Live source behind the existing `useSim` contract (replica store of `SimState` shape); TanStack Query for the two new portal pages |
| ADQ-3 | Asynchronous Live actions with the same names, shapes and error classes; read-your-writes; Simulated mode stays synchronous; 26 web and 27 mobile production files |
| ADQ-4 | Hybrid persistence: tables for records, one snapshot row for simulated hardware, no meter frames; seed as of the server clock |
| ADQ-5 | Backend on `127.0.0.1:4420`; mock-core 4400 and the launcher 4410-4419 unchanged; PostgreSQL 4432; lanes 4421-4423 |
| ADQ-6 | Web through a same-origin Vite dev proxy with the session cookie; mobile with a bearer header; Origin allowlist in server configuration; no CORS plugin; socket authenticated at the upgrade |
| ADQ-7 | Dev builds offer both modes and default to Simulated; the packaged web build and the release APK are Simulated-only; no silent fallback |
| ADQ-8 | `apps/core-server`, package `@dems/core-server`, version 0.2.0, modules registered statically |
| ADQ-9 | Additive permissions and audit types in the existing shared vocabulary and role table, using the existing audit categories |
| ADQ-10 | Lane backends 4421-4423 with their own databases for the client waves; serial ownership of 4420 for the gates |

### 13.2 Hand-built elements (each needs a recorded decision under I1)

| # | Element | Record | Reason no ready-made option fits |
|---|---|---|---|
| HB-1 | `scripts/pg/` lifecycle scripts | TD-02 | The ready-made lifecycle code is the wrapper with open defects (R6:92-95) |
| HB-2 | Seed program | TD-04 | The data is this project's own dataset |
| HB-3 | Reset script | TD-04 | Drizzle has no reset command (R7:69) |
| HB-4 | Password hash wrapper | TD-05 | The built-in returns a raw key with no verify helper (R10:131); the library that has one is a native add-on with no Node 26 statement |
| HB-5 | Session table and `authenticate` hook | TD-06 | No plugin covers cookie and bearer with immediate revocation and a durable store (R8:227, R8:233, R10:303) |
| HB-6 | Origin guard | TD-06, ADQ-6 | The CSRF plugin implements token patterns both clients would have to carry (R10:268) |
| HB-7 | Permission guard | TD-07 | The plugins contribute a membership test; registry binding, boot check and denial audit would still be ours (R10:489) |
| HB-8 | Topic registry and send policy | TD-08 | `ws` and the plugin have no topics (R8:269); the libraries that do replace the transport or the server |
| HB-9 | Registry-driven typed client | TD-09 | Ready-made clients are generators that re-derive shapes the zod registry already holds, or need zod 3 or Web Streams (R9:221-226, R9:242-243) |
| HB-10 | Pairing protocol (issue, redeem, list, revoke) | TD-10 | No source specifies one for this case (R10:629) |
| HB-11 | Contract-checked fake transport for client tests | TD-12 | MSW under jest-expo is not evidenced; three runners must share one double |
| HB-12 | Template-clone test helper | TD-12 | The ready-made helpers need Docker (R12:264-265) |
| HB-13 | Engine host and the slice-to-table mapping | ADQ-1, ADQ-4 | It hosts this project's own state machine |
| HB-14 | Live source (replica store, delta application) | ADQ-2 | It adapts this project's own contract |
| HB-15 | Settle helper and asynchronous action type | ADQ-3 | Glue between this project's two modes |

Not hand-built, where the blueprint expected it might be: the lockout counter (`rate-limiter-flexible` 11.2.1) and the request throttle (`@fastify/rate-limit` 11.2.0).

### 13.3 Departures

| ID | Statement | Status |
|---|---|---|
| DEPARTURE-1 | **DEPARTURE — needs controller decision.** D5 names the Homebrew keg `postgresql@17` (DEC:D5). This record names `postgresql@18` (18.6) as the fallback, so that the fallback and the primary share the major version 18 and the migrations behave the same on both (R6:143). If the controller keeps `@17`, the primary should move to `embedded-postgres` 17.10.0-beta.17 (R6:73) | Open: the controller decides before row 23 |
| DEPARTURE-2 | **DEPARTURE — needs controller decision** (wording of D5 only). D5 says either route is "removable with one command" (DEC:D5). For the keg that is not what the formula does: its removal is four to five commands and leaves a default cluster unless deleted by hand (R6:152). It matters only if the fallback is used; the Host Impact Register carries the full removal (H-12) | Open: the controller records the corrected wording |

No other decision departs from D4, D5, D9 or the nine constraints of this row.

### 13.4 Items that are the controller's call

| # | Item | This record's recommendation |
|---|---|---|
| 1 | G-01: the two date-dependent baseline tests | Already decided by D10; this record only adds where the slot sits (before row 23) and how (a fixed clock) |
| 2 | QR scanning on the device (TD-11) | Deferred; no AVD camera change |
| 3 | A live package for another PC (TD-13; blueprint pending decision 6) | Not built in this task |
| 4 | Which role receives pairing management, user administration and demo controls (blueprint pending decision 4) | SUPERVISOR, to be confirmed by row 15 (BP:699) |
| 5 | An emulator that holds the release-signed build (MJ-7) | As the blueprint proposes (BP:697); decide before row 77 |
| 6 | Lanes for live checks (ADQ-10) | Enable three, with the load guard |
| 7 | The PostgreSQL port | 4432, fixed by row 18 after row 24's probe |
| 8 | A stricter permission hint: an optional effective-permission list in the store that `selectCan` reads when present | Not adopted by default, because it writes `packages/shared/src/sim/selectors.ts` and `types.ts`, beyond the vocabulary additions the blueprint allows (BP:546). The default (ADQ-2) already takes the role from the server and tests the matrix equality |
| 9 | G-24: the predecessor's synthetic operator name | Keep |
| 10 | The demo-password disclosure in Live mode (G-12) | Row 20 rules |

---
*Generated: 2026-10-04 02:18*
*Last Updated: 2026-10-04 02:36*
