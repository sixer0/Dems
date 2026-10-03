---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: data-analyst
blueprint_row: 17 (FIRM); revision 2 by controller row 20b (decision D16); revision 2.1 after the masterplan consistency check (row 19)
revision: 2.2
tier: 1
type: client-integration-specification (web console and mobile app, Live mode)
confidence: MEDIUM
confidence_note: repository facts are HIGH (read from files and from the row 3 and row 4 inventories); every behaviour that no row has executed yet is labelled "hypothesis" or carries an assumption ID (CA-n) with the row that proves it
based_on: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md
binding_decisions: D1-D20, DR-01, DR-02, DR-03, DR-04 (decisions/decisions.md)
security_review: gateway_check/03_security_design_review.md (row 20, verdict CAUTION; every correction folded in by D16)
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/02_structured.md
sibling_specs: masterplan/01_specs.md (row 15, canonical server side, revision 2.1), masterplan/03_database_contract.md (row 16, revision 2.1 or later), masterplan/02_plan.md (row 18, revision 2)
last_updated: 2026-10-04 06:16
---

# Client Integration Specification: Live mode in the DEMS web console and mobile app

## Revision history

Revision 2 folds the corrections of the security design review (`gateway_check/03_security_design_review.md`, row 20) into this file, as decision D16 directs, and states the rulings of D15 and D16 as decided. Each rule is changed in the section where it lives.

| Rev | Date | Change | Finding or decision | Sections touched |
|--:|---|---|---|---|
| 1 | 2026-10-04 | First issue (row 17) | D15 | all |
| 2 | 2026-10-04 | What React Native sends as `Origin`, and that the server accepts it only on a bearer request | SD-02 | 1.8 (CA-08), 4.4 (WT-6) |
| 2 | 2026-10-04 | A 429 has its own wording: the server's denial budget makes it reachable after repeated refusals | SD-03 | 2.5 (CL-21), 8.1 (LB-10), 8.2 (A1), 8.4 (D-6), 8.5 (S1-1), AC-C-110 |
| 2 | 2026-10-04 | The proxy sets no header and rewrites no `Origin`; the negative test through the dev server; the console is opened at `127.0.0.1`, not `localhost` | SD-07 | 1.8 (CA-05), 4.1 (WT-2, WT-2a), 8.2 (A1), AC-C-102 |
| 2 | 2026-10-04 | The cookie name per instance | SD-08 | 5.2, 5.3, 9.1, AC-C-38 |
| 2 | 2026-10-04 | `session.ended` with `TOKEN_REUSE` | SD-10 | 6.5, AC-C-108 |
| 2 | 2026-10-04 | The Core server's response headers; the packaged policy untouched; the dev server's missing page policy accepted | SD-14 | 4.3 |
| 2 | 2026-10-04 | Try-it deny list for operations 2, 7, 8, 15, 18 and 23; no request or answer in web storage; the page's log | SD-16 | 1.8 (CA-11), 11 (AR-3, AR-3a, AR-9), AC-C-100, AC-C-103 |
| 2 | 2026-10-04 | The demo-password conditions C1 to C4 on both login screens | SD-17 | 5.5 (WS-9, WS-10), 9.2, AC-C-104 |
| 2 | 2026-10-04 | The DEPARTURE-6 conditions | SD-18 | 9.1, 9.3 (MB-5, MB-6, MB-6a), 17.3, AC-C-105 |
| 2 | 2026-10-04 | The lineage of discarded audit chains in the chain panel | SD-19 | 2.5, 8.2 (A9), AC-C-109 |
| 2 | 2026-10-04 | The administration queries and the code memory are cleared on sign-out, on a session end and on permission loss | SD-20 | 5.6 (WS-12), 6.3 (RC-3), 9.1, 10.1 (PG-6, PG-6a), 10.3, AC-C-106 |
| 2 | 2026-10-04 | Log scans include a marker password and a marker pairing code | SD-23 | 11 (AR-9), AC-C-65, AC-C-75, AC-C-107 |
| 2 | 2026-10-04 | The cookie has no `Max-Age` | SD-24 | 5.2, 5.6 (WS-15) |
| 2 | 2026-10-04 | The note on operation 23 | SD-29 | 9.4 (MP-8a), 16 (GC-05) |
| 2 | 2026-10-04 | DEPARTURE-5, DEPARTURE-6, the 24 open choices and the change to the mobile Core chips stated as decided | D15 | 17.1, 17.2 (FC-1), 17.3 |
| 2 | 2026-10-04 | The rulings of row 20 stated as decided; the gap register updated (GC-18 to GC-22); findings FC-11 to FC-13; the traceability of the findings; the choices made while folding | D16 | 0, 1.3, 1.6, 12.3, 15.2, 15.3, 15.6, 16, 17.4, 17.5 |
| 2.1 | 2026-10-04 | Text-only patch after the masterplan consistency check (`gateway_check/02_masterplan_consistency.md`). The mobile release-gate test file stays unchanged and the LIVE cases are a new test file; OP-1 of the server specification is decided (FC-13), and the choices of revision 2 and LB-10 are accepted; binding decisions D1 to D20; every cited provisional blueprint row, in the text and in the "Row" columns, is followed by its work rows, as [PL:§21] maps them. No rule, ID or count changed | Consistency-check findings C-05, C-06, C-11, C-12; D17, D18 | Front matter; 0; 1.3; 1.6; 9.5; 9.6; 17.2 (FC-11, FC-13); 17.5; row citations and "Row" columns throughout (2, 7, 12.3, 13) |
| 2.2 | 2026-10-04 | Text-only patch (controller row 20c): work-row citations aligned with plan rev 2.1 §21; shell variable name `DEMS_CORE_HOST_PORT`. Provisional row 79 is cited with both of its work rows, W15 (the secure-store probe, which was missing) and W56; the shell variable of `device-session.sh` carries the name that plan section 3.4 pins, in place of the name this file had proposed; the shared constant in `packages/shared` is not named in this file. No rule, ID or count changed | Plan rev 2.1 §21 and §3.4 (C-13); controller row 20c | Front matter; 1.8 (CA-06, CA-07); 7.4; 9.3 (MB-6, MB-8); 9.6; 12.3; 13.7 (AC-C-65, AC-C-67 to AC-C-71); 13.8 (AC-C-84); 13.12 (AC-C-105, AC-C-108); 16 (GC-17); 17.1; 17.3 (DEPARTURE-6); 17.4 ("Row 18" items 1, 2, 6) |

## 0. Reading guide

| Section | Content | Impact question answered |
|---|---|---|
| 1 | Tier 1 frame: subject, stakeholders, timeline, scope, rationale, method, alternatives, assumptions | |
| 2 | Shared client layer: typed client, live socket client, Live source, asynchronous actions and the settle helper | |
| 3 | **Mode switch per build type and the mode indicator** | **IQ-1** |
| 4 | **Web transport: the dev proxy**; origins, CORS and the content-security policy; mobile transport | **IQ-16** |
| 5 | Web sign-in, stored session, guards, trust line, idle expiry | IQ-11 (web part) |
| 6 | **Reacting to a role change and to a revocation** (RBAC on the clients) | **IQ-19** |
| 7 | The wiring map: every web and mobile feature folder | |
| 8 | Live behaviour of every synchronous-return call site | |
| 9 | Mobile: **Credential storage per client**, **Biometric unlock and the security-key button**, **Pairing flow and the pairing-required gate**, Core link sources, ports | IQ-11, **IQ-17**, IQ-20 |
| 10 | The two new portal pages: Users & Roles, Paired Devices | |
| 11 | **API Reference page in both modes** | **IQ-23** |
| 12 | Tests: the 61 simulator-dependent files, the fake transport, what each client row proves | |
| 13 | Acceptance criteria AC-C-01 to AC-C-110 | |
| 14 | The nine open points of the server specification, closed one by one | |
| 15 | Traceability: impact questions, success criteria, defaults, edge cases, the security design review findings | |
| 16 | Gap and risk register of this specification | |
| 17 | Decisions for the controller to record; the rulings already made (D15, D16) | |

**Citation convention.** `[SP:§4.7]`, `[SP:RT-5]`, `[SP:AC-B-22]` are a section, a numbered rule or a criterion of `masterplan/01_specs.md`. `[AN:ADQ-3]` is a record of `research/03_analysis.md`. `[R3:167]` is line 167 of `research/01c_explore_web.md`; `[R4:130]` is line 130 of `research/01d_explore_mobile.md`. `[BP:333]` is a line of `identification/02_structured.md`. `[DEC:D11]`, `[DEC:F15]`, `[DEC:DR-02]` are rows of `decisions/decisions.md`. `[PS:§14.4]`, `[PM:M-C-11]` and `[PN:§4.2]` are the predecessor's `docs/2026-09-30_dems_demo_stack_setup/masterplan/01_specs.md`, `03_motion_spec.md` and `04_mobile_specs.md`. Code is cited as `path:line` relative to `/Users/gsp-budi/Documents/DEMS/`. `[SDR:SD-16]` or `[SDR:§5.5]` is a finding or a section of `gateway_check/03_security_design_review.md` (row 20). References to `masterplan/01_specs.md` are to its revision 2. A statement without a source is labelled **hypothesis** or carries an assumption ID (CA-n, section 1.8).

**Normative words.** "MUST", "MUST NOT" and "MAY" state requirements on the clients. Numbered items (CL-n, MD-n, WT-n, WS-n, RC-n, LB-n, MP-n, MB-n, PG-n, AR-n, TS-n, AC-C-nn) are the units that rows 18-21 and the gate rows refer to. An ID is never renumbered and never reused: revision 2 changed the text of existing items in place and added new items (WT-2a, RC-3, LB-10, MB-6a, PG-6a, AR-3a, AR-9, AC-C-102 to AC-C-110).

**Work rows.** This file was written against the provisional blueprint rows 23 to 118. Where such a row is cited as the row that builds or proves something, in the text or in a "Row" column, the plan's work rows follow in brackets, as the blueprint delta of `masterplan/02_plan.md` maps them (cited as `[PL:§21]`): "row 62 (W05, W50, W54)". A list or a range gets the union of its rows' work rows, and a run of three or more is written "W63 to W65". Where a provisional row was split, all its work rows are named; the plan's row tables say which one carries which part. Rows 1 to 22 are the blueprint's firm rows and keep their numbers.

**Names.** Module, function, constant, key and test-ID names in this file are proposals unless the text says "existing". Row 18 fixes them; behaviour is what is specified.

**No credential value appears in this file.** The demo password, the simulator's pairing code and the security-key operator are cited by constant name only: `DEMO_OPERATOR_PASSWORD`, `DEMO_PAIRING_CODE`, `SECURITY_KEY_OPERATOR_ID` (`packages/shared/src/sim/dataset.ts:153-157`, [SP:§0]). Operators are named by ID (`OPR-001` to `OPR-003`), never by person name.

---

## 1. Tier 1 frame

### 1.1 Subject

How the two existing demo clients, the web console (`apps/core-web`) and the Android app (`apps/mobile`), consume the Core server of `masterplan/01_specs.md` in **Live mode** while their **Simulated mode** stays as it is: one shared typed client and Live data source, the mode switch per build, the wiring of every feature folder, the behaviour of every call site that today depends on a synchronous simulator answer, sign-in and stored session on the web, credential storage, biometric unlock and mandatory pairing on mobile, two new portal pages, and the API Reference page.

### 1.2 Stakeholders

| Stakeholder | What this file gives them |
|---|---|
| The user (demo owner and presenter) | What each screen shows in each mode, and that simulated data is never presented as live (section 3); the two new portal pages in the existing design language (section 10) |
| Controller | Every choice that D11 and D13 left open for the clients, the departures and the findings (section 17) |
| Row 18 (plan) | The files each client row writes, split into seam files and call-site files (section 7); constants and names to pin; sequencing risks (section 16) |
| Row 20 (security design review) | Credential storage on both clients (sections 5, 9.1), the biometric variants (9.3), the QR content (10.3), the demo-operator disclosure in Live mode (5.4) |
| Row 21 (blueprint refinement) | The slicing of rows 57-99 (W03, W05, W12 to W15, W18, W30, W31, W44, W46, W50, W51, W54 to W57, W59 to W84): which row owns which file and which criterion (sections 7, 13) |
| Rows 57-99 (W03, W05, W12 to W15, W18, W30, W31, W44, W46, W50, W51, W54 to W57, W59 to W84; coder-execution) | Numbered rules, state tables, test IDs and acceptance criteria per row |
| Rows 106-112 (W94 to W100; verification) | The observables of SC3, SC4, SC5 and SC8 on the client side |

### 1.3 Timeline

| When (2026-10-04, WIB) | Event | Source |
|---|---|---|
| 02:36 | Decision record accepted (row 14) | [DEC:D11] |
| 03:14 | Server specification accepted (row 15) | [DEC:D13] |
| 03:16-04:02 | This specification (row 17, wave M2), in parallel with row 16 | `date` printed `2026-10-04 03:24 WIB` during the read phase of this row and `2026-10-04 04:02 WIB` at its end |
| 04:03-04:25 | Security design review (row 20): verdict CAUTION; eight of its findings name this file (SD-07, SD-08, SD-10, SD-16, SD-17, SD-18, SD-20, SD-23) | [DEC:D16]; `gateway_check/03_security_design_review.md` |
| 04:41-05:09 | **Revision 2 of this file** (controller row 20b): the corrections folded in; the rulings of D15 and D16 stated as decided | `date` printed `2026-10-04 04:41 WIB` at the start of the revision |
| 05:52 | Masterplan consistency check (row 19): PASS-WITH-NOTES; D17 to D20 recorded | `gateway_check/02_masterplan_consistency.md` |
| 06:04 | **Revision 2.1 of this file**: text only, findings C-05, C-06, C-11 and C-12 of that check | this file's revision history |
| Next | Rows 21, 22 | [BP:488-493] |

No duration estimates are given [AN:69].

### 1.4 Scope

- **In scope**: everything blueprint row 17 names [BP:290] and the ten controller requirements of the row brief: the shared client layer, the mode switch, the wiring map, the Live behaviour of the synchronous sites, RBAC display on the clients, mobile pairing and its gate, the two portal pages, web sign-in and session, tests, and the nine open points of [SP:§19.5].
- **Owned by sibling files, only referenced here**: the operations, access rules, realtime messages and security requirements (row 15); tables and seed (row 16); work rows, pinned versions, lanes, serial slots and run commands (row 18).
- **Out of scope by decision**: QR scanning on the device [DEC:DR-02]; a Live release APK, a physical tablet, another PC [SP:§10.3]; serving media from the server [SP:§11]; a visual redesign (the two new pages reuse the existing kit, [BP:185]); password change (GS-01, [SP:§18]).
- **Not done by this row**: no install, no code, no process. One specification file and one progress file are written. Revision 2 (row 20b) changed documents only: this file and `01_specs.md`.

### 1.5 Rationale and evidence chain

| Step | Fact | Source |
|---|---|---|
| 1 | Both clients create one `Sim` and reach it only through `useSim`, `useSimActions`, `useSimInstance` and `useAudioChannel`; 88 web and 31 mobile production files call `useSim` | [R3:48-50]; [R4:47] |
| 2 | Therefore a Live source with the store shape of `SimState` behind the same context leaves every read site untouched | [DEC:D11 ADQ-2]; [AN:534] |
| 3 | 14 + 36 + 7 web sites and 9 + 8 + 2 + 9 mobile sites depend on a synchronous answer, a synchronous throw or an immediate store read | [R3:167-211]; [R4:130-173] |
| 4 | Therefore Live actions keep names, result shapes and error classes, settle only when the store holds their effect, and call sites go through one helper that stays synchronous in Simulated mode | [DEC:D11 ADQ-3]; [AN:551] |
| 5 | The server authenticates the web by a same-site cookie and the device by a bearer credential that exists only after pairing | [SP:§5.3, ID-1] |
| 6 | Therefore the web needs a same-origin transport (dev proxy) and no stored token; mobile needs secure storage and a pairing gate that does not exist today | [DEC:D11 ADQ-6]; [R4:60]; `apps/mobile/src/navigation/root-navigator.tsx:55-63` |
| 7 | The server pushes role changes, session ends and revocations on the socket and closes it when access ends | [SP:§4.7, §9.4] |
| 8 | Therefore each client needs one place that turns the four control messages (`session.updated`, `session.ended`, `device.revoked`, `admin.changed`) into store changes and refetches, and the existing reactive gates and leave paths then do the rest | [R3:652]; `apps/core-web/src/components/shell/app-layout.tsx:34-62` |
| 9 | The two modes hold different data | [SP:MC-1] |
| 10 | Therefore the mode is always visible, a mode change always passes the login screen, and Live never falls back to the simulator by itself | [DEC:D11 ADQ-7]; section 3 |

### 1.6 Method

1. Read the canonical server specification in full (operations, access rules, realtime protocol, mode contract, security requirements, acceptance criteria, open points), the decision record's client records (ADQ-2, ADQ-3, ADQ-6, ADQ-7, TD-09 to TD-12), the binding decisions D1-D13 and the two client inventories with their synchronous-site tables.
2. Read the code where a rule of this file depends on an exact name or shape: `apps/core-web/src/main.tsx`, `router.tsx`, `routes/__root.tsx`, `vite.config.ts`, `lib/core-endpoint.ts`, `components/shell/{app-layout,app-shell,nav-items,page-header,sidebar,top-bar,user-menu}.tsx`, `features/login/*`, `features/session-new/index.tsx`, `features/system/use-sim-command.ts`, `features/security-audit/{panel,choreography,model}.ts(x)`, `features/api-reference/sim-fetch.ts`, `motion/variants.ts`; `apps/mobile/src/runtime/{contract,core-link,sim-runtime-provider,connection-banner}.ts(x)`, `navigation/{root-navigator,routes,session-guards}.ts(x)`, `auth/{auth-provider,biometric,auth-prefs}.ts(x)`, `features/pairing/*`, `features/login/login-card.tsx`, `features/settings/{preferences-section,security-section}.tsx`, `providers/app-providers.tsx`, `scripts/device-session.sh`, `package.json`; `packages/shared/src/sim/{engine,react,errors,types,constants,selectors,auth}.ts`, `src/api/{core-api,constants,health,realtime-messages,openapi}.ts`, `src/realtime/{heartbeat-client,heartbeat-context}.ts(x)`, `src/i18n/index.ts`.
3. Read the predecessor's design language for the new pages: page mapping and shell [PS:§14.2-14.8], motion tokens, choreography rules and component motions [PM:§2-§5], the mobile component vocabulary, pairing and motion mapping [PN:§3.3, §4.0-4.2, §6.3-6.5, §7].
4. Designed to D11 and D13. Where a finding and a decision disagree, the point was marked as a departure and put to the controller with the evidence and the smallest alternative (section 17.3; both are decided).
5. Counted mechanically while writing: 18 web groups and 21 mobile groups in the wiring map; 14 + 36 + 7 web and 9 + 8 + 2 + 9 mobile synchronous sites in section 8; 101 acceptance criteria (110 after revision 2).
6. Revision 2: read the security design review in full and the decisions D13 to D16. Each correction whose owning document is this file was written into the section where its rule lives; the consequences of the server-side corrections for a client (the cookie name, the origin lists, the denial budget, the token-reuse reason, the chain lineage) were followed into the affected rules. Where the review leaves a value open, the value is chosen here and listed in section 17.5. The counts were re-run: the wiring map and the site table are unchanged; the criteria end at AC-C-110.
7. Revision 2.1: read the masterplan consistency check (`gateway_check/02_masterplan_consistency.md`, verdict PASS-WITH-NOTES) and the decisions D17 to D20. Text only: the release-gate test file stays unchanged (finding C-05); OP-1 of the server specification is decided (C-06); the front matter names the binding decisions (C-11); every cited provisional row carries its work rows (C-12). No rule changed and no ID was renumbered.

### 1.7 Alternatives considered

| Alternative | Why not |
|---|---|
| Widen `useSimActions()` in `packages/shared/src/sim/react.ts` to return possibly asynchronous results | That file may not be written: only additive vocabulary values are allowed under `src/sim/` [BP:476]; [SP:AC-B-62]. A second hook in the Live module gives the same type safety (CL-12) |
| `await` at every call site | It adds a microtask to Simulated mode and puts the unchanged test files at risk [AN:554]. Kept only where the function is already asynchronous |
| Optimistic local execution of the shared transition, reconciled later | The client would decide results and refusals before the server; rejected by ADQ-3 option (A) [AN:553] |
| A second socket per client for state, beside the heartbeat socket | Two connections per client against a cap of 16 [SP:RT-P6]; an OPERATOR socket on the API Reference page would receive a full snapshot for a panel that shows five lines. One socket per client with a heartbeat view (CL-7) |
| Promise-only delivery of an action's result | The continuation would run in a later turn than the store update; the mobile start-recording hand-off needs both in one turn [R4:52]. Section 2.5 (CL-16) |
| A mode selector that switches in place, without a reload on the web | One data source is created per page load [R3:48]; switching in place would need every page to drop cached state. A reload is one line |
| Live as the default in dev builds | A checkout with no backend would open on an error [AN:623] |
| The two new pages fed by a new simulator slice, so they also work in Simulated mode | No simulator action edits an operator or lists devices [DEC:F14]; a new slice would write `src/sim/**`. The pages are Live-only (section 10.1) |
| Showing the QR as the only form of the code | The device types the code [DEC:DR-02]; the digits stay primary |
| Server paging for the audit and event lists of the existing pages | The pages render the ring that the simulator also keeps (1,000 and 500 rows); the replica carries the same ring [SP:§3.2]. Paging is used only to build export files (section 8.2, A7 and A8) |

### 1.8 Assumptions

AS-01 to AS-10 of the decision record [AN:86-97] and SA-01 to SA-11 of the server specification [SP:§1.8] stay in force. This file adds:

| ID | Assumption | Effect if wrong | Proven by |
|---|---|---|---|
| CA-01 | A round trip on loopback (request, commit, delta) completes well inside `LIVE_PENDING_REVEAL_MS` (420 ms), so pending spinners rarely show | Spinners appear more often; no functional effect | Rows 66-74, 110 (W63 to W65, W69 to W71, W75, W76, W98) |
| CA-02 | A zustand store update and a navigation dispatched in the same synchronous turn are rendered in one React commit, on the web and on React Native, as today's synchronous hand-off already relies on (`apps/mobile/src/features/session-new/session-new-screen.tsx:181-193`) | The mobile hand-off shows one "session busy" toast in Live mode; fallback in section 8.6 (S2-2) | Row 86 (W67) |
| CA-03 | `router.invalidate()` of TanStack Router 1.170 re-runs `beforeLoad` of the matched routes (not in the research) | The shell navigates explicitly from a route-to-permission map (RC-1 fallback) | Row 63 (W54) |
| CA-04 | `replaceEqualDeep` is exported by `@tanstack/react-query` 5.104.0 (installed in both clients, `apps/core-web/package.json:23`, `apps/mobile/package.json:31`) and can be injected into the Live source for structural sharing | A structural-sharing function of about 20 lines is written inside HB-14 | Row 60 (W18, W31, W44) |
| CA-05 | The Vite dev proxy forwards `/ws` upgrades with `Cookie` and `Origin` unchanged and leaves Vite's own HMR socket alone (extends AS-07, SA-02). The proxy block itself adds no header and rewrites no `Origin` | ADQ-6 fallback (B): cross-origin with `@fastify/cors`, which returns to a security review before it is built [SP:OR-5] | Row 62 (W05, W50, W54; AC-C-34, AC-C-102) |
| CA-06 | `expo-device` (`~57.0.2`, already a dependency, `apps/mobile/package.json:35`; no source file imports it today) reports `isDevice === false` on the three AVDs and is mocked by `jest-expo` | The biometric pre-prompt switch (MB-5) becomes a build constant set from the observation of row 79 (W15, W56) | Row 79 (W15, W56) |
| CA-07 | `expo-secure-store` distinguishes a cancelled prompt from a failed one on a protected read (not in the research, [AN:451]) | A failed protected read is treated as "cancelled": no failure is reported to the server | Row 79 (W15, W56) |
| CA-08 | React Native's socket constructor accepts a `headers` option and reports close codes 4401 and 4403; if it adds an `Origin` header, the value is the origin of the URL it opens (extends SA-03 and the hypothesis in [SP:§9.2]) | The app learns a revocation from its next REST call (403 `DEVICE_REVOKED`) instead of from the close code. Another `Origin` value is refused by the server until its own-origin list is extended, after a security review [SP:SA-03] | Row 59 (W30) |
| CA-09 | Adding one chip to the web top bar and one optional member to two context types does not break an existing test | The owning row moves the indicator or adjusts its markup; never the test | Rows 62, 63, 78 (W05, W15, W50, W51, W54) |
| CA-10 | `qrcode.react` 4.2.0 `QRCodeSVG` renders an inline SVG with no network request and no `data:` URL [AN:465] | The QR is dropped and the code stays as text (TD-11 rollback) | Row 76 (W81) |
| CA-11 | The API Reference renderer writes no request body and no answer to web storage. `persistAuth: false` is set (`apps/core-web/src/features/api-reference/scalar-config.ts:30`); any other persistence of the renderer is not established [SDR:RG-3] | Row 99 (W84) switches the renderer's persistence off or clears its keys after each call. If neither is possible, Try-it is switched off in Live mode, the page says so, and the point is recorded as drift | Row 99 (W84; AC-C-103) |

---

## 2. Shared client layer

Three folders of `packages/shared/src/` hold everything both clients share. None of them imports `node:`, `react-native`, `expo`, `window` or `document` [BP:331-333]; platform parts are injected.

| Folder | Hand-built element [DEC:D12] | Row | Export subpath (row 57 (W03, W14) adds it to `packages/shared/package.json`, whose `exports` map has no such entry today, `:6-21`) |
|---|---|---|---|
| `src/client/` | HB-9 registry-driven typed client | 58 (W12) | `@dems/shared/client` |
| `src/realtime/` (new files beside `heartbeat-client.ts`) | Live socket client | 59 (W30) | `@dems/shared/realtime` (existing) |
| `src/live/` | HB-14 Live source; HB-15 settle helper and asynchronous action type | 60 (W18, W31, W44) | `@dems/shared/live` (light: types, hooks, `settle`, mode helpers) and `@dems/shared/live/source` (heavy: `createLiveSim`, which imports the client and the socket) |
| `src/live/testing/` | HB-11 contract-checked fake transport | 60 (W18, W31, W44) | `@dems/shared/live/testing` |

Why two subpaths for `src/live/`: feature files import the light API statically. The heavy module is loaded only by a dynamic import that sits behind the build gate (MD-2, MD-6), so a packaged web build and a release APK carry no client or socket code path that can run (MC-3 of [SP:§10.1]).

### 2.1 The typed client (HB-9)

| ID | Rule | Source |
|---|---|---|
| CL-1 | One generic function: operation ID in, typed input in, typed success **or** typed error envelope out. It never throws for an HTTP status; it throws only for a programming error. Types come from the registry in `packages/shared/src/api/` | [AN:436] |
| CL-2 | Created with `{ baseUrl, fetch, credentials }`. Web: `baseUrl` = the page origin, `credentials` = "browser cookie" (the client sets `credentials: 'same-origin'` and sends no `Authorization` header). Mobile: `baseUrl` = the Core server origin constant of [SP:§2.4], `credentials` = a function that returns the current bearer value (`ses_...` when signed in, else `dvc_...`, else none) | [SP:§5.3] |
| CL-3 | JSON is read with `text()` and `JSON.parse`, never through `response.body`; the global `fetch` is the default and is injectable | [AN:435, AN:436]; [DEC:F18] |
| CL-4 | Every 2xx body is validated with the registry's zod schema for that status; every non-2xx body with the `ApiError` schema. A body that fails validation is returned as the error `{ code: 'CONTRACT_VIOLATION' }` and reported; it is never handed to the store | [AN:436] |
| CL-5 | The result carries `epoch` and `revision` read from `x-dems-epoch` and `x-dems-revision` on a 2xx answer of a POST | [SP:API-7] |
| CL-6 | A request is aborted after `LIVE_COMMAND_TIMEOUT_MS` (8,000 ms). No command is retried automatically | [SP:API-11] |
| CL-6a | No secret is placed in a URL, a query string or a log line. The client's own debug log prints method, path, status and request ID only | [SP:SR-15, SR-49] |

Proof on a device, not in jest only: one GET, one POST with a body and one error envelope, validated by zod on an emulator through `adb reverse` [AN:443].

### 2.2 The live socket client

| ID | Rule | Source |
|---|---|---|
| CL-7 | **One socket per client in Live mode.** The live socket client also implements the existing `HeartbeatClient` interface (`subscribe`, `getSnapshot`, `start`, `stop`; `packages/shared/src/realtime/heartbeat-client.ts:58-63`), fed by the `heartbeat` messages of the same socket. Live mode provides it through the existing `HeartbeatContext` (`heartbeat-context.tsx:5`), so `useHeartbeat()` and every Core-link reader work unchanged | [SP:§9.4] (the `heartbeat` member is unchanged) |
| CL-8 | Created with `{ url, socketFactory, headers }`. Web: `url` = `ws://<page host>/ws`, no headers (the browser attaches the cookie). Mobile: the Core server socket URL constant, `headers` = a function returning `{ Authorization: 'Bearer ...' }` | [SP:§9.2] |
| CL-9 | Reconnect with the existing constants `RECONNECT_BACKOFF_MS` and `RECONNECT_JITTER_MS` (`packages/shared/src/api/constants.ts:23-24`); stale after `HEARTBEAT_STALE_AFTER_MS` (`:21`) | [SP:RT-P1, RT-P2] |
| CL-10 | Messages are parsed with the contract's union. An unknown or invalid message is dropped and reported, as the heartbeat client does today (`handleMessage`, `heartbeat-client.ts:151-182`) | existing |
| CL-11 | Close codes: 1001, 1008, 1013, 4408 reconnect with backoff and expect a `snapshot`. 4401 raises "session ended". 4403 raises "device revoked". A revision gap or another epoch sends `resync` (at most one in 2 s) | [SP:§9.4, RT-6] |
| CL-11a | `reconnect(reason)` closes the socket and opens a new one at once. The Live source calls it after a web sign-in, a web sign-out, a mobile sign-in (the bearer value changed) and a mobile sign-out, because the principal is fixed at the upgrade | [SP:§9.2]; open point 9 |
| CL-11b | `subscribe meters` is sent while an OPERATOR socket is open **and** the page or app is visible; `unsubscribe` when it is hidden (the existing idle rule R10 of [PM:§3]) | [SP:RT-8] |

### 2.3 The Live source (HB-14)

`createLiveSim(options)` returns an object that satisfies the `Sim` interface (`packages/shared/src/sim/engine.ts:63-93`) except that its actions are asynchronous (section 2.5). It is put into the existing `SimContext` (`packages/shared/src/sim/react.ts:30`) through one documented cast inside `src/live/`. So `useSim`, `useSimInstance`, `useSimReady` and `useAudioChannel` (`react.ts:60-112`) work on it without a change, and the five mobile sheet frames that re-provide the context [R4:204] carry it too.

| `Sim` member | Live behaviour |
|---|---|
| `store` | A zustand store of `SimState` shape, created with the same middleware as the simulator's store so that `subscribe(selector, listener, options)` works [R3:81]; [R4:173] |
| `actions` | Section 2.5 |
| `clock.now()` | Local monotonic time plus the offset learned from `serverTime` in `hello` and in every `heartbeat` [SP:ENG-15]. It never moves backwards. The `clock` slice is published every `CLOCK_TICK_MS` (100 ms, `packages/shared/src/sim/constants.ts:24`), as the simulator publishes it |
| `ready`, `isReady()` | Resolves when the bootstrap is over (section 5.1): the session probe has answered and, when signed in, the first `snapshot` is applied. It never rejects; it resolves at the latest after `LIVE_BOOT_TIMEOUT_MS` (4,000 ms) with the link OFFLINE |
| `wasRestored()` | Always false |
| `start()`, `stop()`, `destroy()` | Open and close the socket and the timers. Idempotent, as today (`react.ts:50-54`) |
| `tick()`, `flush()` | No-ops. `isRunning()` reports whether the socket is started |
| `rng`, `seed` | `seed` from the replicated `meta` slice; `rng` is an inert stub. No client file reads either [R3:49]; [R4:47] |
| `errors()` | The last 50 reports, as today |
| `request()` | Answers 501 with code `SIMULATOR_ERROR`; the API Reference page does not call it in Live mode (section 11) |

**Where each of the 33 slices comes from** (classes of [SP:§3.2]):

| Slices | Filled from | When signed out |
|---|---|---|
| The 28 replicated slices | `snapshot`, then `delta` operations `replace` and `append` [SP:RT-1 to RT-3] | Reset to a neutral `SimState`-shaped value built inside `src/live/` (empty lists, no session, empty device identity): a signed-out client holds no Core data |
| `audio` | `meters` frames (CL-11b). On link STALE or OFFLINE and on sign-out the slice is reset to silent frames (`noSignal`, `packages/shared/src/sim/types.ts:457-468`), so a meter never freezes on a stale level | Silent |
| `clock` | The offset clock above | Runs |
| `auth` | `status`, `operatorId`, `method`, `issuedAt`, `lastActivityAt` from `AuthSessionInfo` [SP:§7.18]; `status` becomes SIGNED_OUT, LOCKED or EXPIRED from the control events (section 6.5) | SIGNED_OUT |
| `authLockout` | Synthesised from `SignInStatus` so that the shared `lockoutStatus(slice, clock.now)` (`packages/shared/src/sim/selectors.ts:55`) returns the server's `locked`, `lockedUntil` and `attemptsRemaining`: `lockedUntil` is copied; `failures` holds `AUTH_MAX_FAILURES - attemptsRemaining` entries stamped with `serverTime`. A test asserts the equality (AC-C-39) | From `getSignInStatus` |
| `pairing` | Mobile: from `PairingRedeemed`, `DeviceRegistration` and the redeem errors (section 9.4). Web: a neutral value that no web screen reads in Live mode (section 5.5, section 7.3 G6) | Same |
| `operators` (one of the 28) | Replicated; identity fields and role only [SP:§3.2 row 4] | Empty |

| ID | Rule | Source |
|---|---|---|
| CL-12 | **Typed access to actions.** `@dems/shared/live` exports `useCoreActions()` and `coreActionsOf(sim)`. They return the same object as `useSimActions()` and `sim.actions`, typed as `CoreActions`: every member of `SimActions` (`types.ts:985-1094`) with its return type `R` widened to `R` or `Promise<R>`. In Simulated mode the object **is** `sim.actions`. Call-site files import these instead of `useSimActions`; a static test forbids `useSimActions` and `.actions` on a `Sim` in production files of the feature folders (AC-C-53) | [AN:551] rule 1; HB-15 |
| CL-13 | **Structural sharing** (open point 6). When a `snapshot` or a `replace` is applied, a slice that is deeply equal to the current one keeps the current reference; inside an array slice, an element that is deeply equal keeps its reference. A slice that a `delta` does not name is not touched. The function is injected (`replaceEqualDeep`, CA-04) | [R4:67]; [SP:RT-3] |
| CL-14 | `append` operations build the `audit` and `events` rings as the simulator does: caps `AUDIT_RING_SIZE` and `EVENT_RING_SIZE` (`constants.ts:35-36`), with `head`, `total` and `dropped` from the message, so the web's own chain check (`apps/core-web/src/features/security-audit/model.ts:57-85`) verifies server rows | [R3:60]; [SP:§7.13] |
| CL-15 | The Live source exposes, beside `Sim`: `session` (the current `AuthSessionInfo` or null: permission list, `demoControls`, expiry times, `deviceId`), `link` (CONNECTING, ONLINE, STALE, OFFLINE, RESYNCING), `lastSessionEnd` (reason of the last `session.ended` or revocation), `client` (the typed client, for the two portal pages), `heartbeat` (CL-7) and `onControl(listener)` (the four control messages of [SP:§9.4]). Hooks in `@dems/shared/live`: `useCoreMode()`, `useLive()` (null in Simulated mode), `useLiveLink()`, `useCorePermission(permission)` | section 6 |

### 2.4 Constants of the client layer

| Constant (proposed name) | Value | Why this value |
|---|---|---|
| `LIVE_PENDING_REVEAL_MS` | 420 (the motion token `duration.slow`, [PM:§2.1]) | Above the "feedback" tempo of 90-180 ms and inside the "transition" tempo [PM:§1 P2]; time-scaled with the motion policy |
| `LIVE_COMMAND_TIMEOUT_MS` | 8,000 | Longer than a demo reset is expected to take (**hypothesis**; row 48 (W29, W43) measures) |
| `LIVE_SETTLE_TIMEOUT_MS` | 2,000 | Twice the heartbeat interval [SP:RT-P1] |
| `LIVE_BOOT_TIMEOUT_MS` | 4,000 | Covers the first two reconnect delays (500 + 1,000 ms, `constants.ts:23`) plus the handshakes |
| `LIVE_TOUCH_INTERVAL_MS` | 60,000 | "At most once a minute" [SP:ID-P9] |
| `LIVE_RESYNCED_NOTICE_MS` | 3,000 | Equals the mobile `RESYNCED_BANNER_MS` (`apps/mobile/src/runtime/connection-banner.ts:21`) |

### 2.5 Asynchronous actions and the settle helper (HB-15)

| ID | Rule | Source |
|---|---|---|
| CL-16 | **Own-command atomicity.** While at least one command of this client is in flight, incoming `delta` messages are held. When the 2xx answer with revision N arrives, the held deltas up to N are applied (the source waits for a missing one) and the action's continuation is invoked **in the same synchronous turn**. So, as in the simulator, the code after an action always sees its effect, and no render happens between the state change and the continuation. Deltas beyond N stay held while another command is in flight, else they are applied at once. Meter frames are never held | [SP:RT-5]; [R4:52]; [R3:205-211] |
| CL-17 | **Settle time-out** (open point 4). If the delta for revision N has not arrived `LIVE_SETTLE_TIMEOUT_MS` after the answer, the source sends `resync`, sets `link` to RESYNCING, applies whatever it holds and **resolves** the action with the server's answer: the command did succeed. The connection notice of section 3.5 is shown; no error toast | [SP:RT-6] |
| CL-18 | A 2xx answer whose `epoch` differs from the store's (a reset or a scenario load, [SP:RT-7]) settles when the `snapshot` of that epoch is applied | [SP:§12.4] |
| CL-19 | **Result shapes.** An action whose simulator signature returns a result union resolves with that union, also for a refusal: `signIn`, `signInWithBiometric`, `recordBiometricFailure` (`SignInResult`), `createSession` (`CreateSessionResult`), `pair` (`PairResult`), `exportEvidence`, `exportAudit`, `exportLogs` (`ExportResult`), `types.ts:890-949`. The mapping is by status and code: for `ExportResult`, 401 → `NOT_SIGNED_IN`, any 403 → `FORBIDDEN` (the server's code is `FORBIDDEN` for operation 42 and `NOT_PERMITTED` for 61 and 62, [SP:RB-5]), 404 → `NOT_FOUND`, 409 → `NOT_SEALED` or `SECURITY_FAULT`, 422 → `INVALID_REASON` | [AN:551]; [SP:§7.2] |
| CL-20 | **Error classes** (open point 4). A void action rejects with the simulator's class, rebuilt from the envelope: | `packages/shared/src/sim/errors.ts:62-114` |
| | 401 `NOT_SIGNED_IN`, 403 `NOT_PERMITTED` → `SimPermissionError(action, permission, code)`; `permission` from `error.details.permission`, else from the registry's access rule of the operation | [SP:§7.2] |
| | 404 → `SimNotFoundError(entity, id)`, both taken from the request the binding sent | |
| | 409 and 422 with a simulator code → `SimTransitionError(from, event, undefined, code)`; `from`, `event`, `code` from `error.details.from`, `.event`, `.simCode`; without details: `from` = the replica's session state, `event` = the action name, `code` by the table of [SP:§7.2] read backwards (`INVALID_STATE` → `ILLEGAL_STATE`, `PRECHECK_RUNNING` → `CHECKS_RUNNING`, `NOT_SEALED` → `UNSEALED_EVIDENCE`, `INVALID_REASON` → `REASON_TOO_SHORT`, same name otherwise) | |
| CL-21 | **Two new classes** in `@dems/shared/live`, for answers the simulator never gives. `LiveTransportError` with `reason` `CORE_OFFLINE` (no answer, time-out, 503 `NOT_READY`, link not ONLINE) or `UNAVAILABLE` (429, 500, `CONTRACT_VIOLATION`; the error keeps the status and the `retry-after` value, so a 429 can be worded as a limit and not as an outage, LB-10): the two reasons the mobile contract already has (`apps/mobile/src/runtime/contract.ts:41`). `CoreRefusalError` with the envelope `code`, for `DEMO_DISABLED`, `LAST_ADMIN`, `DEVICE_NOT_PAIRED`, `ORIGIN_NOT_ALLOWED`, `LOCKED`, `INVALID_CODE` when the action has no result union for them | [AN:551] |
| CL-22 | While `link` is not ONLINE a command is not sent: the action rejects at once with `LiveTransportError('CORE_OFFLINE')` | section 3.5 |
| CL-23 | A 401 `NOT_SIGNED_IN` on any call of a client that believes it is signed in is treated as `session.ended`; a 403 `DEVICE_REVOKED` as `device.revoked` (section 6.5). A 403 `NOT_PERMITTED` triggers one `getAuthSession` call (debounced 1 s) to refresh the permission hint | [SP:§4.7] |
| CL-24 | **No unhandled rejection.** The Live source observes every rejection itself and reports it through `onError`; the promise it returns is thereby marked as handled. A fire-and-forget call site needs no change | [R3:230] |
| CL-25 | **`settle(run, handlers)`.** `run` is a function that calls the action. `handlers` are `ok(value)`, `fail(error)` and `done()`. If `run` returns a plain value, `ok` and `done` run **before `settle` returns**; if `run` throws synchronously, `fail` and `done` run before it returns. If `run` returns a Live action result, the handlers run in the turn of CL-16. Sequences nest: the next `settle` is called inside `ok`. `settle` itself never throws | [AN:551] rule 3 |
| CL-26 | A Live action invoked from an already asynchronous function MAY be awaited instead (`createAndCheck` on the web, `signIn` on mobile), because CL-16 resolves the awaited value only after the store holds the effect | [AN:554] |

**The 42 action bindings.** The operation, the access rule and the execution kind of every `SimActions` member are the table of [SP:§7.17]; this file does not repeat it. Client-side particulars:

| Member | Client-side particular |
|---|---|
| `signInWithSecurityKey` | No operation exists (X-1). The Live binding rejects with `CoreRefusalError('NOT_AVAILABLE')`; the button that calls it is not rendered (WS-8) |
| `setTabletLink` | No operation exists (X-2). The Live binding resolves without a request; the mobile bridge that calls it is inactive in LIVE mode (section 9.5) |
| `touch` | Throttled, CL-27 |
| `startRecording` | Calls `startSession` only when the replica shows ARMED; otherwise rejects locally with `SimTransitionError` (the composite branches of operation 25 are not reachable, [SP:§7.8 note]) |
| `deviceCommand(id, command)` | Chooses operation 48, 49 or 50 by `command` |
| `setPresentationMode`, `updateSettings` | Both call operation 68 |
| `verifyAuditChain` | Calls operation 60 and resolves with its `view` member (`ChainVerifyResult`); the `stored` and `lineage` members are kept on the Live handle for the web chain panel (section 8.2, A9) |
| `verify` | Calls operation 41; never preceded by a demo control (section 14, point 7) |
| `pair`, `unpair` | Mobile only: operations 18 and 22 through the pairing module of section 9.4, which also writes and deletes the stored credential |
| `signInWithBiometric(operatorId)`, `recordBiometricFailure(operatorId)` | Mobile only: operations 8 and 9. The token is supplied by an injected provider (section 9.3); the parameter list stays |
| `loadScenario`, `resetDemo` | Settle by CL-18 |

| ID | Rule | Source |
|---|---|---|
| CL-27 | **`touchSession` throttle** (open point 5). The first activity after at least `LIVE_TOUCH_INTERVAL_MS` without a sent touch sends one at once. Activity inside the window sets a flag; when the window ends with the flag set, one trailing touch is sent, so the last activity is always reported, at most 60 s late. Every successful POST of the client restarts the window and clears the flag, because the server counts it as activity. No touch is sent without activity, so an open page cannot keep itself alive. The answer updates `session.idleExpiresAt` | [SP:ID-P9]; [R3:59]; `apps/mobile/src/auth/auth-provider.tsx:54,261` |

---

## 3. Mode switch per build type and the mode indicator

Answers impact question 1 on the client side. The server side is [SP:§10.1].

### 3.1 Mode model

There are two **data modes**: SIMULATED (the in-app simulator is the Core) and LIVE (the Core server is the Core). The mobile Core link source HEARTBEAT is SIMULATED data with a link indicator that follows mock-core (`apps/mobile/src/runtime/core-link.ts:4-9`); it is not a third data mode.

| Build | How the code recognises it | Modes offered | Default | Where the choice is stored | Where it is chosen |
|---|---|---|---|---|---|
| Web, dev server (`127.0.0.1:5173`) | `import.meta.env.DEV` is true and `isSameOriginCore()` is false (`apps/core-web/src/lib/core-endpoint.ts:37-39`) | Simulated, Live | **Simulated** | `localStorage` key `dems.core.mode.v1`, value `SIMULATED` or `LIVE` | Login page (selector) and the shell's mode indicator |
| Web, dev lane (5176-5178) | Same | Simulated, Live | `VITE_DEMS_CORE_MODE` (`live` or `simulated`) when set, else Simulated | Same key; `localStorage` is per origin, so each lane has its own | Same |
| Web, tests (Vitest) | The test builds the router itself (`apps/core-web/src/router.tsx:29-43`) | Simulated; Live only when the test injects a Live source with the fake transport | Simulated | Nothing is read unless the test stubs it | The selector is not rendered (MD-4) |
| Web, production build that is not packaged (`vite build`, `vite preview`) | `import.meta.env.DEV` is false | **Simulated only** | Simulated | The key is ignored | Selector hidden |
| Web, packaged build (`VITE_DEMS_CORE_ORIGIN=same-origin`) | `isSameOriginCore()` | **Simulated only** | Simulated | The key is ignored | Selector hidden |
| Mobile, debug build | `__DEV__` (`core-link.ts:32-34`) | SIMULATED, HEARTBEAT, LIVE | **SIMULATED** (`core-link.ts:24`) | Field `coreLinkSource` of `dems.mobile.prefs.v1` (`core-link.ts:86-89`), new value `LIVE` | Settings → App Preferences → Core link source; "Use Simulated mode" on the Pair and Login screens while in LIVE |
| Mobile, jest | `__DEV__` is true under jest (`apps/mobile/src/features/settings/heartbeat-release-gate.test.tsx:1-4`) | Simulated unless a test injects a Live source | SIMULATED | The AsyncStorage mock | As the test renders |
| Mobile, release APK | `__DEV__` is false | **Simulated only** | SIMULATED | A stored `LIVE` or `HEARTBEAT` value is read and replaced by SIMULATED (`core-link.ts:37-39,111-119`) | The LIVE and HEARTBEAT options are disabled |

| ID | Rule | Source |
|---|---|---|
| MD-1 | The web key `dems.core.mode.v1` collides with none of the eight existing keys (`dems.sim.v1`, `dems.auth`, `dems.system.prefs.v1`, `dems.system.demoControls.v1`, `dems.motion.reduced`, `dems.shell.rail`, `dems.presentation.v1`, `dems.shell.intro`) | [R3:261-268] |
| MD-2 | **Web resolution order**, evaluated once in `main.tsx` before any data source exists: (1) packaged or production build → SIMULATED; (2) a valid stored value; (3) a valid `VITE_DEMS_CORE_MODE`; (4) SIMULATED. Any other stored or environment value counts as absent | [AN:609-611] |
| MD-3 | **Mobile**: `CoreLinkSource` becomes `'SIMULATED' \| 'HEARTBEAT' \| 'LIVE'` (`apps/mobile/src/runtime/contract.ts:67`); `CORE_LINK_SOURCES` gains `LIVE` (`core-link.ts:25`); `isCoreLinkSourceAvailable` becomes "SIMULATED, or a debug build" (`:32-34`); `parseCoreLinkSource` accepts the third value (`:79`). An older build that reads `LIVE` falls back to SIMULATED by the existing parser | [AN:612]; [R4:59] |
| MD-4 | The web selector is rendered only when the router context carries `coreMode.selectable === true`; `main.tsx` sets it from rule 1 of MD-2. A router built by a test without that member renders no selector, so no existing test sees a new control | CA-09 |
| MD-5 | Exactly one data source exists per web page load and per mobile runtime mount. In LIVE mode `createSim` is not called and the simulator's stored snapshot is neither read nor written; in SIMULATED mode the Live module is not loaded and no request goes to the Core server | [SP:MC-2, MC-5]; [SP:AC-B-63] |
| MD-6 | In a packaged or production web build and in a release APK the dynamic import of `@dems/shared/live/source` is unreachable: it sits behind `import.meta.env.DEV` on the web and behind the `__DEV__` gate of MD-3 on mobile | [SP:MC-3] |
| MD-7 | A debug deep-link parameter `core=LIVE\|SIMULATED\|HEARTBEAT`, handled beside the existing `scenario=` parameter in `apps/mobile/src/runtime/debug.ts` (debug builds only, [R4:206]), sets the source through `setCoreLinkSource`. It exists so that device checks need no taps through Settings. In LIVE mode the `scenario=` parameter is ignored and logged, because it would call a demo control without the operator asking | [PN:§3.5] |

### 3.2 What the user sees in each mode

The rule behind every row: **a screen that shows simulator data says "simulated"; a screen that says "live" shows server data; nothing else.**

| Place | SIMULATED (and HEARTBEAT on mobile) | LIVE, link up | LIVE, link down |
|---|---|---|---|
| Web shell, top bar: mode indicator (new; kit `Chip size="sm" variant="soft"` inside a `Tooltip`, between the device block and the bell, `apps/core-web/src/components/shell/top-bar.tsx:69-78`; never hidden at any width) | `SIMULATED`, tone `warning` (the tone of the API badge `SIMULATED`, `packages/shared/src/api/openapi.ts:63`). Tooltip: "The Core is simulated in this browser. Nothing is sent to a server." | `LIVE`, tone `success` (`openapi.ts:62`). Tooltip: "Data comes from the Core server on this computer." | `LIVE · OFFLINE`, tone `danger`; `LIVE · RECONNECTING` while the socket retries or resynchronises |
| Web Login: trust line | Unchanged: `login.trustLine` / `login.trustLineUnpaired`, both ending "(simulated)" (`packages/shared/src/i18n/en/login.ts:40-43`) | Section 5.5 (WS-7) | "Core server unreachable" with the offline Alert |
| Web Login: selector (dev builds) | `ToggleButtonGroup` "Simulated \| Live", Simulated selected | Live selected | Live selected; the offline Alert offers "Use Simulated mode" |
| Web API Reference | Badges `LIVE` (health, mock-core) and `SIMULATED` (nine), as today | Every operation `LIVE` (section 11) | Service banner offline |
| Mobile Home header chip `home-core-link` and More footer chip `more-core-link` | "Core Simulated", tone `info`, **also in HEARTBEAT mode** (see MD-8) | "Core Live", tone `success` | "Core Offline", tone `danger` (existing word, `apps/mobile/src/features/more/more-model.ts:101-104`) |
| Mobile Login: trust line | Unchanged: "... paired (simulated)" / "... not paired" (`apps/mobile/src/i18n/en.mobile.ts:77-78`) | Section 9.2 | Core chip red, Sign In disabled, Alert with Retry and "Use Simulated mode" |
| Mobile Settings → Core link source | Three segments; the selected one names the source | Same | Same |
| Mobile Pair screen chip | `SIMULATED` (`en.mobile.ts:67`) | `LIVE` | Offline Alert |

| ID | Rule | Source |
|---|---|---|
| MD-8 | **Wording correction in HEARTBEAT mode.** Today the two mobile chips print "Live" whenever the source is not SIMULATED and the link is up (`apps/mobile/src/features/dashboard/home-header.tsx:109-115`; `more-model.ts:95-104`), although the data is simulated. From this task on they print "Simulated" in HEARTBEAT mode (tone `info`) and "Live" only when the source is LIVE; the accessibility label keeps naming the source ("mock-core heartbeat"). No existing test pins the HEARTBEAT word (the two that read the chips assert the SIMULATED case, `more-screen.test.tsx:131`, `dashboard-screen.test.tsx:289`). This changes a predecessor screen and is listed for the controller (section 17.2, finding FC-1) | controller requirement 2 |
| MD-9 | In LIVE mode the Home header shows the chip in every layout class. In SIMULATED and HEARTBEAT mode its placement stays as it is (expanded header only), so no Simulated layout changes | [AN:622] |

### 3.3 Changing the mode

| Step | Web | Mobile |
|---|---|---|
| 1 Confirm | Kit `AlertDialog` (the pattern of `apps/core-web/src/features/session-new/cancel-dialog.tsx`): "Switch to Live mode? You will be signed out and the console reloads. Simulated data and Live data are separate." | HeroUI Native `Dialog` with the same sentence, only when the change crosses the LIVE boundary. SIMULATED ↔ HEARTBEAT stays instant, as today (`apps/mobile/src/runtime/runtime.test.tsx:185-191`) |
| 2 Sign out of the current mode | Simulated: `signOut(USER)` and a snapshot flush. Live: `signOut` (operation 5) | The contract's `signOut('USER')` |
| 3 Store | Write `dems.core.mode.v1` | `setCoreLinkSource(next)` (merge write, `core-link.ts:128-139`) |
| 4 Rebuild | `window.location.assign('/login')` (one data source per page load, [R3:48]) | `SimRuntimeProvider` unmounts the current source and mounts the other one (keyed on "is LIVE"); the navigator falls back to `/`, and the boot router picks `/pair` or `/login` (section 9.4) |
| 5 Result | The Login page of the new mode | The Pair or Login screen of the new mode |

So a mode change always passes a login screen, and no session of one mode is ever shown in the other.

### 3.4 Stored state when the mode changes (edge case E10)

Nothing is deleted and no existing key changes meaning [SP:MC-5]; [BP:176].

| Key | Owner | In SIMULATED mode | In LIVE mode |
|---|---|---|---|
| `dems.sim.v1` (web `sessionStorage`; mobile AsyncStorage) | Shared simulator | Read at start, written at most once a second | **Not read, not written**: the simulator is not constructed. The snapshot is found again, unchanged, when the mode returns to Simulated |
| `dems.auth` (web `sessionStorage`) | Shared simulator | `{ operatorId, issuedAt }` | Not read, not written. Step 2 of section 3.3 clears it before a switch to Live, by the simulator's own sign-out |
| `dems.system.prefs.v1`, `dems.system.demoControls.v1`, `dems.motion.reduced`, `dems.shell.rail`, `dems.presentation.v1`, `dems.shell.intro` (web) | Web | As today | As today; `dems.presentation.v1` is also the pre-sign-in source of presentation mode (WS-10) |
| `dems.core.mode.v1` (web, new) | Web runtime | `SIMULATED` or absent | `LIVE` |
| `dems.mobile.prefs.v1` | Mobile (merge writes) | `coreLinkSource` SIMULATED or HEARTBEAT | `coreLinkSource: LIVE`; every other field as today |
| `dems.mobile.auth.v1` | Mobile `auth-prefs` | `{ lastOperatorId, biometricEnabled }` of the simulated binding | Not read, not written; the Live biometric state lives in secure storage (section 9.1) |
| `dems.mobile.log.v1` | Mobile runtime log | As today | As today; the redaction list already drops keys that look like credentials or codes [R4:236] |
| Secure-storage items (mobile, new) | Mobile runtime | Not read, not written | Section 9.1 |

### 3.5 Live mode with the server unreachable (edge case E9)

A client in LIVE mode **never** constructs or shows the simulator by itself [SP:MC-1]. What the user sees instead:

| Situation | Web | Mobile |
|---|---|---|
| Unreachable at start, no session known | The Login page with the existing "Core offline" Alert (`danger`, Retry with the existing cooldown), Sign In disabled (`apps/core-web/src/features/login/login-model.ts:56-58`), the ring in its critical state, the indicator `LIVE · OFFLINE`, and, in dev builds, a second action "Use Simulated mode" (section 3.3). The text names no simulated value | No credential: the Pair screen with the code slots disabled and an Alert (`danger`) with Retry and "Use Simulated mode". Credential present: the Login screen with the existing offline state (Sign In disabled, reason `CORE_OFFLINE`, `apps/mobile/src/auth/auth-provider.tsx:144-147`) and the same two actions |
| Link lost while signed in | The indicator turns `LIVE · OFFLINE`. One **persistent critical toast** (the existing pattern M-C-14, [PM:§5.4]): "Core server unreachable. The screen shows the last state received. Reconnecting…", with "Retry now" and, in dev builds, "Switch to Simulated mode". No element is inserted into the page, so nothing jumps. Meters fall to "no signal" (section 2.3). Commands are refused locally (CL-22) with one coalesced toast | The existing connection banner (`mobile.coreLink.lost`, motion M-MB-04) and the existing read-only rule of the monitor and recovery screens (`apps/mobile/src/features/session-live/use-monitor.ts:104-108`) |
| Link back | The socket delivers a `snapshot`; the toast is replaced for `LIVE_RESYNCED_NOTICE_MS` by a success toast "Reconnected to the Core"; the indicator returns to `LIVE` | The existing "Resynced" banner (`connection-banner.ts:21-39`) and the existing route resync on the resync bus (`apps/mobile/src/providers/app-providers.tsx:96-101`) |
| The session ended while the link was down | The reconnect is answered with 4401 or `hello.reason: SESSION_INVALID`; the client goes to the Login page with the matching notice (section 6.5) | Same, to the Login screen |
| Database or engine not ready (`ready` false in health, 503 `NOT_READY`) | Treated as "unreachable": the same states, with the Alert text "The Core server is starting" | Same |

---

## 4. Web transport: the dev proxy

Answers impact question 16 on the client side. The server side is [SP:§14.2].

### 4.1 The proxy

| ID | Rule | Source |
|---|---|---|
| WT-1 | `apps/core-web/vite.config.ts` gains a `server.proxy` block (the file has none today, `:18`) with two entries: `/api/v1` and `/ws` (`ws: true`), both to `http://127.0.0.1:<port>`. The port is 4420, or the value of an environment variable read by the config file (4421-4423 for a lane; any other value stops the dev server with a message) | [AN:596]; [SP:§2.1 C-1, C-2]; [DEC:F22] |
| WT-2 | The proxy forwards `Origin`, `Cookie`, `Set-Cookie`, `x-dems-epoch`, `x-dems-revision` and `retry-after` unchanged. **The proxy block sets no header and rewrites no `Origin`** (no `headers` option, no `changeOrigin`, no hook that touches a request header): the Core server's Origin guard must see what the browser sent. Row 62 (W05, W50, W54) proves the pass-through for HTTP and for the upgrade before any page row starts (CA-05, SA-02), and proves the negative case: a POST sent **through the dev server** with a foreign `Origin` is answered 403 `ORIGIN_NOT_ALLOWED` by the Core server (AC-C-102). If the fallback of CA-05 (cross-origin with CORS) is ever triggered, it returns to a security review before it is built | [SP:§1.8 SA-02]; [SP:OR-5]; [SDR:SD-07] |
| WT-2a | In Live mode the console is opened at `http://127.0.0.1:<port>`, never at `http://localhost:<port>`. The Core server's web console origins hold no `localhost` entry [SP:OR-7], so a page under `localhost` is refused at sign-in with 403 `ORIGIN_NOT_ALLOWED`. The Login page then shows its "unexpected" Alert, and the console record names the cause and the address to use (A1). The README says the same (row 101 (W86)) | [SDR:SD-07]; finding FC-12 |
| WT-3 | The block is under `server` only. `preview` and `build` have no proxy, so a production or packaged build cannot reach the Core server through this file. The file is a pinned build input of 0.1.0; changing it is expected [DEC:D9 DN-1] | [SP:§10.2] |
| WT-4 | When the proxy cannot reach the server it answers without a contract envelope. The typed client maps any answer that is not valid JSON of the contract, and any network error, to `LiveTransportError('CORE_OFFLINE')` (CL-21) | CL-4 |

### 4.2 Origins in the web code

`apps/core-web/src/lib/core-endpoint.ts` gets a third row in its table (`:4-7`), read at call time like the other two:

| Mode | REST origin (`coreHttpOrigin()`) | Socket (`coreWsUrl()`) | `allowedPageOrigins()` |
|---|---|---|---|
| Simulated, dev and tests (unchanged) | `CORE_HTTP_ORIGIN` (`http://127.0.0.1:4400`) | `CORE_WS_URL` | `WEB_DEV_ORIGINS` |
| Simulated, packaged (unchanged) | The page origin | `ws(s)://<page host>/ws` | The page origin |
| **Live** (dev builds only) | The page origin | `ws://<page host>/ws` | The page origin |

So in Live mode `fetchCoreHealth()` (`core-endpoint.ts:63-75`), the Home and Stack Check pages, the API Reference server strip and the Realtime panel all address the page's own origin, and the health answer names `dems-core-server` [SP:§7.4]. `WEB_DEV_ORIGINS` and every other existing shared constant stay as they are [SP:OR-7]; the existing resolver tests (`apps/core-web/src/lib/__tests__/core-endpoint.test.tsx`) run unchanged because without a stored mode the resolvers behave as today.

### 4.3 CORS and the content-security policy

| Topic | Statement | Source |
|---|---|---|
| CORS | **No change in either client.** The Core server registers no CORS plugin and sends no `Access-Control-Allow-*` header; the web reaches it same-origin. mock-core's CORS (GET, POST, OPTIONS; origin 5173 only) is untouched and is not used in Live mode | [SP:OR-5]; [DEC:F9] |
| Packaged CSP | **No change.** `apps/core-web/src/lib/packaged-csp.ts` and the launcher's copy stay byte-identical; the pinning test `packaged-csp.test.ts` runs unchanged. The packaged build is Simulated-only (MD-6) | [SP:OR-6]; [R3:322] |
| Dev server | The dev server injects no CSP meta tag (the plugin acts only on `vite build` with the packaged flag, [R3:322]), so the page has no content-security policy in Live mode. Row 20 accepted that: Live mode exists only in dev builds, the packaged policy is unchanged, and the cookie is `HttpOnly` (residual R-14). The review's optional `X-Frame-Options: DENY` for the dev server block is not adopted (GC-21) | [R3:322]; [SDR:§8] |
| Core server response headers | Every answer of the Core server carries `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Cross-Origin-Resource-Policy: same-origin` and `Referrer-Policy: no-referrer`. They belong to API answers that the page fetches from its own origin through the proxy; the policy of an API answer does not govern the page, so no client change is needed. `no-store` also means that the browser keeps no API answer in its HTTP cache. The packaged policy of the 0.1.0 packages is a different thing and is not touched (the row above) | [SP:OR-9]; [SDR:SD-14] |
| The two new pages | They add no resource host: data comes from the page origin; the QR is an inline SVG element (CA-10), not an image URL and not a `data:` URL. If a Live edition is ever packaged, `connect-src 'self'` already covers same-origin REST and socket | [AN:465] |
| API Reference | The resource-host rule stays "loopback only": in Live mode Try-it may call only `{page origin}/api/v1/*`; any other URL is still rejected before a request is made (`apps/core-web/src/features/api-reference/sim-fetch.ts:97-103`) | [BP:372] |

### 4.4 Mobile transport

| ID | Rule | Source |
|---|---|---|
| WT-5 | The app addresses the Core server by the additive shared constants of [SP:§2.4] (host `127.0.0.1`, port 4420, HTTP origin, socket URL). There is no setting for another address | [SP:§10.3] |
| WT-6 | REST and the socket carry `Authorization: Bearer`; no cookie. The app sets no `Origin` itself. React Native's `fetch` is expected to send none, and its socket may add the origin of the URL it opens, `http://127.0.0.1:4420` (SA-03, CA-08); the Core server accepts both on a bearer request, because that address is one of its own origins [SP:§14.2]. Row 59 (W30) records what is sent. Lanes change only the host side of `adb reverse` (section 9.6) | [SP:§5.3]; [AN:660]; [SDR:SD-02] |
| WT-7 | Cleartext HTTP stays allowed in the debug and debugOptimized manifests only; `app.json` and the release manifest are not changed. `expo-secure-store` is added without its config plugin, so the plugin list keeps its seven entries (`apps/mobile/app.json:34-49`) | [R4:302-307]; [AN:452] |

---

## 5. Web sign-in, stored session and the trust line

### 5.1 Start-up in Live mode

| Step | Where | What happens |
|---|---|---|
| 1 | `apps/core-web/src/main.tsx` | After `z.config({ jitless: true })` (`:18`) the mode is resolved (MD-2). Simulated: lines 19 and 37-38 run as today |
| 2 | `main.tsx` | Live: dynamic import of `@dems/shared/live/source`; `createLiveSim` with the typed client on the page origin, the socket URL `coreWsUrl()`, the structural-sharing function and the error sink (`:31-35`) |
| 3 | Live source | `getAuthSession` (operation 4). 200: the session is known. 401: signed out. No answer: link OFFLINE |
| 4 | Live source | Opens the socket; the browser attaches the cookie. `hello` names the principal. Signed in: waits for the `snapshot`. Signed out: `getSignInStatus` (operation 3) fills the lockout view |
| 5 | `main.tsx` | `await live.ready` (the module already uses top-level `await`, `:19-21`), then `createAppRouter({ sim: live, queryClient, coreMode })` |
| 6 | `apps/core-web/src/routes/__root.tsx` | `SimProvider sim={sim} autoStart` as today (`:73`). In Live mode the heartbeat context is provided from the Live socket (CL-7) instead of a second client (`:72`) |

### 5.2 Sign-in and the cookie

| Step | What happens | Source |
|---|---|---|
| 1 | The browser posts `{ username, password }` to `/api/v1/auth/sign-in` on its own origin; the proxy forwards it with the `Origin` header | [SP:ID-1 a] |
| 2 | The server answers 200 with `Set-Cookie: dems_session_<port>=...; HttpOnly; SameSite=Strict; Path=/` and a body that holds the session information and **no token**. `<port>` is the port of the Core server instance that the proxy targets (4420, or 4421 to 4423 on a lane), so the main console and a lane keep separate cookies in one browser profile. The cookie has no `Max-Age`: it is a browser-session cookie | [SP:ID-P7]; [SP:AC-B-23]; [SDR:SD-08, SD-24] |
| 3 | The browser stores the cookie for the page origin. Script cannot read it. Nothing is written to web storage | [SP:§5.3] |
| 4 | The Live source calls `reconnect` (CL-11a); the new socket's upgrade carries the cookie; `hello` says OPERATOR; the `snapshot` is applied; `auth` becomes SIGNED_IN | [SP:§9.2] |
| 5 | Only now the `signIn` action settles with `{ ok: true, operatorId, role, method }` | CL-16 |
| 6 | If the snapshot does not arrive within `LIVE_BOOT_TIMEOUT_MS`, the action rejects with `CORE_OFFLINE`; the cookie exists, and the next successful start-up (section 5.1 step 3) signs the operator in without credentials | CL-21 |

### 5.3 What replaces the stored session

| | Simulated mode (unchanged) | Live mode |
|---|---|---|
| What is stored | `dems.auth` = `{ operatorId, issuedAt }` in `sessionStorage` [R3:52] | The `dems_session_<port>` cookie only (section 5.2 step 2). No web-storage key holds anything about the session |
| Who checks it | Nobody: a reload restores SIGNED_IN (`packages/shared/src/sim/auth.ts:373-387`) | The server, on every request and on the socket upgrade |
| Reload | Still signed in | Section 5.1 steps 3-4: signed in if the server still accepts the cookie |
| Another tab | Each tab has its own `sessionStorage` | The cookie is shared by all tabs of the browser profile; a sign-in in one tab ends the session it presented (reason `ROTATED`), and the other tabs re-run step 3 of section 5.1 on `session.ended`. A lane console talks to another instance and holds that instance's cookie; the two do not replace each other |
| Sign-out | Clears `dems.auth` | Operation 5; the server clears the cookie; the socket is replaced by an anonymous one |

### 5.4 Route guards: unchanged

The three guards and the in-shell leave path keep their code:

| Guard | Code today | Why it still works in Live mode |
|---|---|---|
| `routes/_app.tsx:9-14` | `selectIsSignedIn(context.sim.store.getState())`, else redirect to `/login` with `redirect` | `context.sim` is the Live source; its store has `auth.status` set before the router exists (section 5.1 step 5) and before `signIn` settles (section 5.2 step 5) |
| `routes/login.tsx:8-14` | Signed in → `/dashboard` | Same |
| `routes/_app/session/new.tsx:15-19` | `selectCan(state, SESSION_START)`, else `/dashboard` | `selectCan` applies the shared role table to the operator's role (`packages/shared/src/sim/selectors.ts:48-50`), and the role in the replica is the server's (section 6.1) |
| `components/shell/app-layout.tsx:34-62` | When `auth.status` leaves SIGNED_IN: play the exit, go to `/login`, with `redirect` only for EXPIRED | The Live source sets `auth.status` from the control events (section 6.5) |

No guard becomes asynchronous. `git diff acaff20` over the three route files is empty (AC-C-41).

One addition in the Login feature (row 64 (W55)): when the Login page is on screen and the store becomes SIGNED_IN without a submit (a session found again after the link returned, section 5.2 step 6), the page runs its normal hand-off to the redirect target.

### 5.5 The Login page in Live mode

The layout, the components and the motion of the page do not change [PS:§14.8]; [PM:M-PG-LOGIN]. What changes is where each value comes from.

| ID | Element | Simulated mode (unchanged) | Live mode |
|---|---|---|---|
| WS-1 | Submit | `actions.signIn` after `VERIFY_BEAT_MS` (`use-login-controller.ts:193-205`) | The request is sent at once; the existing Submitting state (button `Spinner`, scan pulse M-C-22) is shown until the action settles, and at least `VERIFY_BEAT_MS`, so the state never flashes. The password state is cleared as soon as the request is handed over (`:200-203`) |
| WS-2 | Wrong credentials | `{ ok: false, reason: 'INVALID_CREDENTIALS', attemptsRemaining }` | The same union from 401 `INVALID_CREDENTIALS` and `details.attemptsRemaining`; same Alert, same shake. A disabled operator gets the same answer [SP:ID-3] |
| WS-3 | Lockout | `selectLockout` on the simulator clock | The same selector on the synthesised `authLockout` slice (section 2.3); the countdown runs on the Live clock to `lockedUntil`; after a reload `getSignInStatus` restores it |
| WS-4 | Core offline | Heartbeat OFFLINE from mock-core disables Sign In [R3:65] | The same gate, fed by the Live socket's heartbeat view; plus "Use Simulated mode" (section 3.5) |
| WS-5 | Device strip (six cells, `device-strip.tsx`) | Device, room, clock, GNSS, Core link, security from the simulator | An anonymous client receives no Core state [SP:§9.2]. The six cells show what is public: Core service and version (health), server time (heartbeat), database readiness and engine readiness (health `ready`), Core link, and the mode. Same component, same layout |
| WS-6 | Arrival notice | `selectLastSignOut` from the event ring (`features/login/sim-adapter.ts:27-33`) | `lastSessionEnd` of the Live source (CL-15), mapped in section 6.5. The notice is in memory only: after a manual reload it is not repeated |
| WS-7 | **Trust line** (Q13) | `login.trustLine`, `login.trustLineUnpaired`, `login.trustTooltip` | New keys. Line: "Core server on this computer • web console, no pairing required". Tooltip: "This console signs in to the Core server with a session cookie. Only mobile devices are paired; see Paired Devices." Icon `ShieldCheck` (`success`) while the link is up, `ShieldAlert` (`warning`) with "Core server unreachable" otherwise. The web does not read `s.pairing` in Live mode (`use-login-controller.ts:92`) |
| WS-8 | **Security-key button** (Q11) | Rendered (`auth-card.tsx:272-283`) | **Not rendered**, with its "or" separator. The server has no such operation [SP:§5.5] |
| WS-9 | Demo operators disclosure (Q12) | Three operators from `s.operators` with role chips; the password hint from `DEMO_OPERATOR_PASSWORD`; hidden in presentation mode (`auth-card.tsx:286-288,413-455`) | Kept, as Q12 decides; row 20 accepted it with four conditions [SP:SR-63]; [DEC:D16]. **C1**: the disclosure says in plain words what it is, in a new line above the list: "Published demo credentials for synthetic accounts on this local demo. They are not a secret." **C2**: the three seeded usernames come from the shared `OPERATORS` constant, because `s.operators` is not available before sign-in, and **no role chip** or other server data is shown: a role is server data and may have changed. **C3**: hidden in presentation mode (WS-10). **C4**: the disclosure may exist only while every listener is on loopback; a change that exposes a listener must first replace the seeded password and remove the disclosure from both login screens |
| WS-10 | Presentation mode before sign-in (open point 2) | `dems.presentation.v1` or the simulator's setting (`features/login/sim-adapter.ts:17-21`) | The server setting is not public before sign-in. The Login page reads the tab-local flag `dems.presentation.v1` (`apps/core-web/src/lib/presentation-mode.ts:25`). While signed in, the web copies the server's `settings.presentationMode` into that flag on every change of the `settings` slice, so after a sign-out in the same tab the page follows the server's last value. A fresh tab shows the disclosure until someone signs in once. Limitation recorded as GC-07, which row 20 accepted as it is: the value is public, so no contract change is required (condition C3) |
| WS-11 | Mode selector | — | Section 3.2; dev builds only |

### 5.6 Sign-out, lock console and idle expiry

| ID | Rule | Source |
|---|---|---|
| WS-12 | `signOut(USER)` and `signOut(LOCK)` (`components/shell/user-menu.tsx:20-23`) call operation 5 with the reason. The Live source sets `auth.status` to SIGNED_OUT or LOCKED when the answer arrives, clears the replica (section 2.3), and replaces the socket by an anonymous one. In the same turn the query cache loses every `['core', …]` entry and the Paired Devices feature drops the pairing code it holds (PG-6a): the console is a single-page app, and another operator can sign in on the same page load. The shell then plays its existing exit (M-APP-02) | [SP:ID-9]; [SDR:SD-20] |
| WS-13 | **Idle expiry is decided by the server** (15 min idle, 8 h absolute). The shell keeps calling `touch` on pointer and key activity (`app-shell.tsx:96-111`); the Live binding throttles it (CL-27). No countdown or warning is shown before the expiry, as today | [SP:ID-P4, ID-P5, ID-P9] |
| WS-14 | On `session.ended` with `IDLE_EXPIRED` or `ABSOLUTE_EXPIRED` the Live source sets `auth.status` to EXPIRED; `AppLayout` leaves for `/login?redirect=<current href>` (`app-layout.tsx:48-52`); the Login page shows the existing "session expired" notice for the idle case and a new sentence for the absolute case ("Your session reached its 8-hour limit. Sign in again.") | [R3:130] |
| WS-15 | A closed tab does not sign out. The cookie is a browser-session cookie (it has no `Max-Age`, [SP:ID-P7]) shared by the tabs of the browser profile: it ends when the browser ends its session, at the server's idle or absolute limit, or at a sign-out. A browser that restores its session may restore the cookie too (**hypothesis**; row 64 (W55) records the browser and its version). This differs from Simulated mode, where `sessionStorage` ends with the tab | [SP:ID-P7]; [SDR:SD-24] |

---

## 6. Reacting to a role change and to a revocation

Answers impact question 19 on the client side. The server side is [SP:§4.7]. **Every permission display on a client is a hint; the server decides every call** [SP:SR-46].

### 6.1 Where the hint comes from

| Consumer | Hint in Simulated mode (unchanged) | Hint in Live mode | Why |
|---|---|---|---|
| The existing gates: 13 web files that call `selectCan`, 4 that call `roleHas`, 3 models that name the required role [R3:138-141]; 7 mobile checks [R4:181-187] | The static table `ROLE_PERMISSIONS` applied to the signed-in operator's role | **The same code.** The role comes from the replicated `operators` slice, which the server replaces on a role change; the server's matrix is seeded from the same table and is read-only, and a test asserts the equality [SP:AC-B-17] | No call site changes [AN:536]; the stricter variant is not adopted [DEC:D11] |
| New consumers: the two portal pages, their navigation entries and route guards, the Demo Control Panel gate | — | The effective permission list of `AuthSessionInfo.permissions`, updated by `session.updated`, read through `useCorePermission` (CL-15) | These have no simulator equivalent |
| The role and permission matrix panel of Security & Audit (`rbac-panel.tsx`) | `PERMISSION_ORDER`, nine rows (`features/security-audit/model.ts:434-444`) | `getRoleMatrix` (operation 10), twelve rows | [BP:346] |

### 6.2 A refused call (403)

The server writes the audit row (`ACCESS_DENIED`, or `EXPORT_DENIED` for the three exports) before it answers [SP:RB-4, RB-5]. The client shows:

| Client | What the user sees | Mechanism |
|---|---|---|
| Web | A danger toast with the existing copy: title `common.rbac.deniedTitle`, description `common.rbac.requiresRole` naming the first role that holds the permission (`features/system/use-sim-command.ts:30-35`). The control that was pressed returns to its idle state. Nothing else on the page changes | The action rejects with `SimPermissionError` carrying `permission` (CL-20). Every `fail` branch of section 8 passes the error to one shared presenter (`apps/core-web/src/lib/`, row 62 (W05, W50, W54)) before its own generic message, so a refusal reads the same on every page |
| Web, export wizard | The wizard's existing denied state: `Alert` `danger` naming the role (`features/evidence/export-wizard.tsx:245,269`) | The result union `{ ok: false, status: 403, reason: 'FORBIDDEN' }` (CL-19) |
| Mobile | A danger toast with the same two sentences; haptic "error" by the existing map [PN:§7.6] | The same presenter idea in `apps/mobile/src/runtime/` (row 78 (W15, W51)), called from the wrappers of table S2 |
| Both | Within 1 s the gate that allowed the press corrects itself | CL-23: a 403 `NOT_PERMITTED` refreshes the session information |

### 6.3 A role change pushed while signed in

Trigger: `assignUserRole` by a holder of `USER_ADMIN`. The affected operator's sockets receive `session.updated` and a `delta` of `operators` within 1 s [SP:§4.7]. Nobody is signed out.

| Aspect | Web | Mobile |
|---|---|---|
| Notice | One info toast from the shell: "Your role is now {{role}}. The available actions have changed." The role line of the user menu cross-fades (M-C-10, 120 ms) | One toast with the same sentence; the operator card and the profile sheet show the new role and its permission list (`features/settings/settings-model.ts:76`) |
| Controls that are **disabled, not removed** (the existing pattern: `isDisabled` plus "Requires the X role") | Start session, quick actions, device restart and test signal, archive, export, storage policy, diagnostics, service restart, update, audit export [R3:138-141]. They change state in place with the kit's own transition; no layout moves | Start recovery, storage policy, device restart, archive, export [R4:181-185] |
| Controls that **appear or disappear** | The ADMINISTRATION group of the sidebar and its two entries (section 10.1); the Demo Control Panel switch of the System page | The demo controls group of Settings → System Maintenance |
| Their transition | Enter: opacity 0 → 1 with `x -8 → 0`, duration `fast` (the label motion of M-SH-03). Exit: R2 (opacity, 160 ms, easing `exit`). The entries below move by Motion `layout` with the kit's `transitions.layout` (`apps/core-web/src/motion/variants.ts:62-63`). Reduced motion: opacity only | `FadeInDown` / `FadeOutUp` with the R1 and R2 mappings of [PN:§7.1]; `LinearTransition` for the rows below |
| **Is the current screen left?** | Only when the route itself needs the lost permission: `/session/new` (SESSION_START), `/admin/users` (USER_ADMIN), `/admin/devices` (PAIRING_MANAGE). The shell calls `router.invalidate()`, the route's own guard redirects to `/dashboard` (CA-03), and a toast says why. Every other page stays | Only `/session/new` (the wizard): it leaves for `/home` with a toast. Every other screen stays |
| An open dialog or sheet | Stays open. Its gate re-evaluates; a submit gets the server's refusal (section 6.2). Nothing the operator typed is discarded by the push | Same |
| A setup session left behind (CREATE, PRECHECK, ARMED) | It stays on the Core; any operator with `SESSION_START` continues or cancels it | Same |
| A gained permission | The same events in the other direction: controls become enabled, entries appear; no navigation | Same |

| ID | Rule |
|---|---|
| RC-1 | The shell reacts to `session.updated` in one place (`apps/core-web/src/components/shell/`, row 63 (W54)): toast, `router.invalidate()`. If CA-03 does not hold, the shell navigates from a three-entry map of route to permission instead |
| RC-2 | A role change that returns an operator to the seed role by a demo reset [SP:§12.4] is the same event and gets the same notice |
| RC-3 | When `session.updated` removes `USER_ADMIN` or `PAIRING_MANAGE`, the clearing of PG-6a runs before the route guard redirects, so no row of the page that was lost stays in memory |

### 6.4 A disabled user

`disableUser` ends the operator's sessions; the sockets receive `session.ended` with `USER_DISABLED` and are closed with 4401 [SP:§4.7].

| Client | What the user sees |
|---|---|
| Web | The shell plays its exit (M-APP-02) and the Login page shows an `Alert` (`danger`): "This account was disabled by an administrator." A later sign-in attempt gets the generic "Invalid username or password." with the attempts counter; the client never says "disabled" at that point, because the server does not [SP:ID-3] |
| Mobile | The guard removes the app screens; the Login screen shows the same Alert. A recording in progress continues on the Core [SP:§6.6] |

### 6.5 The control events, one by one (open point 1)

| Server event | `auth.status` set by the Live source | Web | Mobile |
|---|---|---|---|
| `session.updated` (`ROLE_CHANGED`) | Stays SIGNED_IN | Section 6.3 | Section 6.3 |
| `session.ended` `SIGNED_OUT` | SIGNED_OUT (LOCKED when this client sent the reason `LOCK`) | Login page; notice "You have been signed out." or "Console locked" (existing) | Login screen; existing notice |
| `session.ended` `IDLE_EXPIRED` | EXPIRED | `/login?redirect=...`; existing "session expired" notice | The existing idle-lock dialog (`mobile.idleLock`, `en.mobile.ts:103-107`) and the Login screen |
| `session.ended` `ABSOLUTE_EXPIRED` | EXPIRED | As above with the 8-hour sentence (WS-14) | Same sentence |
| `session.ended` `ROTATED` | Unchanged until the check | The tab repeats step 3 of section 5.1: a valid session → it stays signed in (as whoever now owns the cookie, with a fresh snapshot); none → Login page | Not possible: a device session token lives in one process |
| `session.ended` `USER_DISABLED` | SIGNED_OUT | Section 6.4 | Section 6.4 |
| `session.ended` `TOKEN_REUSE` | SIGNED_OUT | Not received by a web session: only a session created by biometric sign-in on a device is ended this way [SP:§5.6 step 6] | The Login screen. The app deletes `dems.live.bio.v1` and its marker, as after a 401 on operation 8 (MB-3), and shows an `Alert` (`danger`): "Biometric sign-in was turned off on this tablet because its token was used a second time. Sign in with your password." The device credential stays: the tablet is still paired |
| `device.revoked` `REVOKED`, close 4403, or REST 403 `DEVICE_REVOKED` | SIGNED_OUT | Not received by a web session. The Paired Devices page shows the device as REVOKED through `admin.changed` | Section 6.6 |
| `device.revoked` `UNPAIRED` | SIGNED_OUT | Same | The Pair screen in its unpaired state, info notice "This tablet was unpaired." |
| `admin.changed` `USERS`, `DEVICES`, `PAIRING_CODE` | — | The matching query of section 10.1 is refetched | Not sent to devices (no page uses it) |
| Close 4401 with no `session.ended` before it (an invalid bearer or cookie) | SIGNED_OUT | Login page, no notice | Signed out with a device credential: the credential is unknown to the Core (section 9.4, MP-10) |

### 6.6 A revoked device

| Client | What happens |
|---|---|
| Mobile (the revoked device) | Within 1 s of the server's commit: the Live source deletes the device credential, the biometric token and its marker from secure storage, drops the session token, sets `auth.status` to SIGNED_OUT and the pairing gate to UNPAIRED with the notice `revoked`. The guard removes the app screens and the boot router opens `/pair`. The Pair screen shows an `Alert` (`danger`): "This tablet's pairing was revoked on the Core. Ask a supervisor for a new pairing code." If the last known session state was RECORDING: "The recording continues on the Core." |
| Web (any session) | **Unaffected**: a web session has no device. The Devices page shows the tablet link OFFLINE if no other paired device is connected (the existing alert, `features/devices/other-devices.tsx:128`); the Paired Devices page updates (section 10.3) |
| Another paired device | Unaffected |

---

## 7. The wiring map

### 7.1 How to read it

| Term | Meaning |
|---|---|
| **Read path** | Every `useSim` selector and every pure helper that takes a `SimState` reads the replica (section 2.3). Topics: `state` (the 28 replicated slices), `meters` (the `audio` slice), `heartbeat` (clock offset and link), `control`, `admin` [SP:§9.2]. **No existing page calls a REST read**, except where the "Operations" column lists one. The other read operations of [SP:§7] serve the API Reference page, the tests and future consumers |
| **Operations** | The operations the folder causes in Live mode, by number and ID of [SP:§7.4-7.16] |
| **S** seam file | A file where the data source, the transport or the mode enters |
| **C** call-site file | A file with a site of section 8: it uses an action's result, catches its throw, or reads the store right after it. It switches from `useSimActions` to `useCoreActions` (CL-12) and uses `settle` (CL-25) |
| **D** display file | A file whose Live-mode output differs for a reason other than asynchrony (wording, source of a value, a gate) |
| **N** new file | |
| **Settle sites** | The site IDs of section 8 that need the helper in that folder |
| "No change" | No production file of the folder is written. The owning row adds Live tests with the fake transport and runs its live check |

Fire-and-forget calls (Class F on the web, [R3:230]; the void calls of table 3.1 in [R4:77-118] whose result nobody reads) need no `settle` and no change of behaviour in either client (CL-24). A file inside a feature folder that makes one still takes its actions from `useCoreActions` (a one-line change), so that the static test of AC-C-53 has one rule; files under `components/` and `runtime/` are outside that test.

### 7.2 Seam files

The decision record counts eight seam files, three on the web and five on mobile [AN:535]. All eight are below (marked ADQ-2). The seam rows also write the adjacent and new files listed with them; that is a count note for the controller (section 17.2, FC-4), not a different design.

| Client | File | Kind | What changes | Row |
|---|---|---|---|---|
| Web | `apps/core-web/src/main.tsx` | S (ADQ-2) | Mode resolution; one source per page load; `await ready` (section 5.1) | 62 (W05, W50, W54) |
| Web | `apps/core-web/src/router.tsx` | S (ADQ-2) | `RouterContext` gains the optional member `coreMode`; `sim: Sim` keeps its type (`:18-22`) | 62 (W05, W50, W54) |
| Web | `apps/core-web/src/routes/__root.tsx` | S (ADQ-2) | Heartbeat context from the Live socket in Live mode; mounts the query bridge of section 10.1 | 62 (W05, W50, W54) |
| Web | `apps/core-web/vite.config.ts` | S | The proxy (WT-1) | 62 (W05, W50, W54) |
| Web | `apps/core-web/src/lib/core-endpoint.ts` | S | The Live row of section 4.2 | 62 (W05, W50, W54) |
| Web | `apps/core-web/src/runtime/` | N | Mode resolution and switch, Live start-up, the `admin.changed` query bridge [BP:203] | 62 (W05, W50, W54) |
| Web | `apps/core-web/src/lib/core-errors.ts` | N | The refusal presenter of section 6.2 | 62 (W05, W50, W54) |
| Web | `apps/core-web/src/routes/_app/admin/users.tsx`, `admin/devices.tsx` | N | Route files with their guards (section 10.1) | 62 (W05, W50, W54) |
| Web | `packages/shared/src/i18n/index.ts`, `en/common.ts`, `en/shell.ts` | S | Two new namespaces registered; shared words for refusals, the offline notice and the mode | 62, 63 (W05, W50, W54) |
| Mobile | `apps/mobile/src/runtime/contract.ts` | S (ADQ-2) | `CoreLinkSource` gains `LIVE`; `RuntimeContract` gains the optional member `pairing` (MP-9) | 78 (W15, W51) |
| Mobile | `apps/mobile/src/runtime/core-link.ts` | S (ADQ-2) | MD-3; `coreLinkStateFor` gets the LIVE case (`:42-49`) | 78 (W15, W51) |
| Mobile | `apps/mobile/src/runtime/sim-runtime-provider.tsx` | S (ADQ-2) | Chooses the source after the preference has hydrated; creates the Live source; provides the heartbeat context from it and stops the outer mock-core heartbeat client while in LIVE (it is started again on leaving LIVE; `start` and `stop` are idempotent); fills `pairing` | 78 (W15, W51) |
| Mobile | `apps/mobile/src/runtime/sim-adapters.ts` | S (ADQ-2) | The mobile adapters of the Live source: `fetch`, a socket factory that passes headers, `AppState` visibility | 78 (W15, W51) |
| Mobile | `apps/mobile/src/features/settings/preferences-section.tsx` | S (ADQ-2) | The third segment (section 9.5) | 97 (W82) |
| Mobile | `apps/mobile/src/runtime/connection-banner.ts`, `runtime/index.ts`, `runtime/debug.ts` | S | The transient rule of `nextBannerKind` covers LIVE (`:30`); barrel exports; MD-7 | 78 (W15, W51) |
| Mobile | `apps/mobile/src/runtime/secure-credentials.ts`, `runtime/core-errors.ts` | N | The secure-storage wrapper (section 9.1); the refusal presenter | 78 (W15, W51) |
| Mobile | `apps/mobile/src/providers/app-providers.tsx` | — | **Not changed**: its props and tree order stay (`:103-123`) | 78 (W15, W51) |

### 7.3 Web: the 18 groups of row 3

Group names, file counts and file lists are those of [R3:356-611]. "Row" is the provisional row of [BP:335-349,372], with its work rows in brackets [PL:§21].

| Group (files) | Operations in Live mode | Topics and slices read | Files that change | Settle sites (section 8) | Row |
|---|---|---|---|---|---|
| G1 `components/composed` (6) | 52 `resetMicClip` (`dbfs-meter.tsx:360`, fire-and-forget) | `meters`; `state`: `mics` | None | None | — (no writer needed) |
| G2 `components/media` (2) | None | `heartbeat` (the clock) | None | None | — |
| G3 `components/shell` (8) | 5 `signOut`, 6 `touchSession` (both fire-and-forget) | `state`: `auth`, `operators`, `alerts`, `device`, the slices of the integrity checklist; `control` | D `nav-items.ts`, `sidebar.tsx`, `nav-drawer.tsx` (the ADMINISTRATION group, section 10.1); D `top-bar.tsx` (the mode indicator slot); N the mode indicator, the link notice (section 3.5), the role-change notice (RC-1). `app-layout.tsx`, `app-shell.tsx`, `user-menu.tsx`: no change | None | 63 (W54) |
| G4 `features/api-reference` (2 of 17 files import the simulator) | Any operation, by the reader's own Try-it; 1 `getServiceHealth` | `heartbeat`; the socket's message tap | Section 11 | None | 99 (W84) |
| G5 `features/dashboard` (14) | 48 `restartDevice`, 49 `testDeviceSignal` | `state`: `session`, `operators`, `cameras`, `mics`, `evidence`, `events`, `time`, `network`, `security`, `alerts`, `storage`; `meters` | C `devices-panel.tsx` | B-7 | 66 (W63) |
| G6 `features/devices` (16) | 48, 49, 50 `identifyDevice`; 52; 19 `listPairedDevices` (drawer, holders of `PAIRING_MANAGE` only) | `state`: `cameras`, `mics`, `otherDevices`, `ports`, `tabletLink`, `network`, `time`, `security`, `health`, `audit`, `faults`, `session`, `device`; `meters` | C `index.tsx`, `audio-input-card.tsx`; D `device-drawer.tsx` (see note G6) | B-7, B-8, D-5 | 70 (W70) |
| G7 `features/evidence` (17) | 40 `getEvidence` (the media reference), 41 `verifyEvidence`, 42 `exportEvidence`, 43 `archiveEvidence` | `state`: `evidence`, `operators`, `audit`, `device` | C `detail-page.tsx`, `list-page.tsx`, `export-wizard.tsx`, `use-verification.ts`, `sim-adapter.ts`; D the media tab (bundled media shown only when `EvidenceMediaRef.source` is `DEMO_PACKAGE`, [SP:MS-2]) | A5, A6, B-1, C-5, D-1, D-6 | 69 (W69) |
| G8 `features/login` (8) | 2 `signIn`, 3 `getSignInStatus`; 4 `getAuthSession` (by the Live source) | `heartbeat` (anonymous socket); `state` after sign-in | C `use-login-controller.ts`; D `auth-card.tsx`, `device-strip.tsx`, `sim-adapter.ts`, `login-model.ts`, `index.tsx` (section 5.5) | A1, A2 | 64 (W55) |
| G9 `features/network-time` (13) | None [SP:§7.12] | `state`: `time`, `network`, `ports`, `tabletLink`, `events`, `faults`, `update` | **No change** | None | 72 (W71) |
| G10 `features/security-audit` (15) | 10 `getRoleMatrix`; 60 `verifyAuditChain`; 61 `exportAudit`; 59 `listAuditRows` (to build the export file); 70 `acknowledgeAlert` | `state`: `audit` (ring), `security`, `device`, `time`, `operators`, `evidence`, `alerts`; `authLockout` (this console) | C `sim-adapter.ts`, `export-audit-dialog.tsx`, `chain-panel.tsx`; D `rbac-panel.tsx` (twelve rows from operation 10 in Live mode; `model.ts` and the nine-row list stay for Simulated mode) | A7, A9, B-5, C-6 | 73 (W75) |
| G11 `features/session-monitor` (15) | 26 `stopSession`, 33 `recoverSession`, 34 `addSessionMarker`, 35 `addSessionNote`, 36 `takeSessionSnapshot`, 51 `setActiveCamera`, 60 | `state`: `session`, `operators`, `cameras`, `mics`, `activeCameraId`, `storage`, `time`, `security`, `audit`, `faults`, `evidence`; `meters` | C `action-bar.tsx`, `index.tsx`, `integrity-panel.tsx`, `live-feed-panel.tsx` | A9, B-2, B-3, B-4, C-1, C-2 | 68 (W65) |
| G12 `features/session-new` (8) | 24 `createSession`, 25 `startSession`, 28 `beginPrecheck`, 29 `retryPrecheck`, 30 `acknowledgePrecheckWarnings`, 31 `cancelSession`, 32 `scanCaseNumber` | `state`: `session`, `operators`, `cameras`, `mics`; `meters` | C `index.tsx`, `sim-adapter.ts` | A3, A4, B-6, C-3, C-4, D-2, D-3 | 67 (W64) |
| G13 `features/storage` (15) | 55 `setStoragePolicy` | `state`: `storage`, `storagePolicy`, `health`, `evidence`, `events`, `session` | C `manage-drawer.tsx` | B-9 | 71 (W71) |
| G14 `features/system` (14) | 33, 51, 52; 62 `exportLogs`; 59 and 63 `listEvents` (to build the log file); 65 `runDiagnostics`; 66 `restartServices`; 67 `startSoftwareUpdate`; 68 `updateSettings`; 71 `getDemoStatus`; 72 `loadScenario`; 73 `injectFault`; 74 `clearFault`; 75 `resetDemo` | `state`: `services`, `health`, `update`, `diagnostics`, `device`, `network`, `settings`, `audit`, `events`, `faults`, `meta`, `session`, `mics`, `storage` | C `use-sim-command.ts`, `diagnostics.tsx`, `demo-panel.tsx`, `update-panel.tsx`, `settings-panel.tsx`, `sim-adapter.ts`, `index.tsx`. The Demo Control Panel is rendered only with `DEMO_CONTROL` **and** `session.demoControls` [SP:DC-3] | A8, A10, A11, B-10, C-7, D-4 | 74 (W76) |
| G15 `lib` (1 test file imports the simulator) | — | — | S `core-endpoint.ts`; N `core-errors.ts`. `packaged-csp.ts` and `presentation-mode.ts`: no change | — | 62 (W05, W50, W54) |
| G16 `main.tsx`, `router.tsx` (2) | — | — | Section 7.2 | — | 62 (W05, W50, W54) |
| G17 `routes` (5) | — | — | S `__root.tsx`; N the two admin routes. `_app.tsx`, `login.tsx`, `_app/session/new.tsx`, `_app/evidence/index.tsx`: **no change** (section 5.4). `routeTree.gen.ts` is regenerated by the router plugin | E (guards) | 62 (W05, W50, W54) |
| G18 `src/test` (6 cross-feature tests) | — | — | **No change** to the six files. New Live tests are new files | — | 62-76, 99 (W05, W50, W54, W55, W61, W63 to W65, W69 to W71, W75 to W77, W81, W84) |
| Not in the 167: `features/home`, `features/stack-check` | 1 `getServiceHealth` | `heartbeat` | No change: they follow `coreHttpOrigin()` and `coreWsUrl()` (section 4.2) | — | — |
| New: `features/users-roles`, `features/paired-devices` | 10, 11, 12, 13, 14; 15, 16, 17, 19, 20 | `admin`; `state`: `audit`, `operators` | Section 10 | Mutations (TanStack Query) | 75, 76 (W77, W81) |

Count: the C files are 1 + 2 + 5 + 1 + 3 + 4 + 2 + 1 + 7 = **26**, the number of the decision record [AN:552].

**Note G6, the tablet row of the device drawer.** Today it prints `s.pairing.state` (`device-drawer.tsx:278-288`), which in Live mode would describe nothing: the portal does not pair [SP:§6.9]. In Live mode the row is titled "Paired devices". A holder of `PAIRING_MANAGE` sees "n paired, m online" from `listPairedDevices` with a link to the Paired Devices page. Any other operator sees "A paired device is connected" or "No paired device is connected", from `tabletLink`, which the server sets from real connections [SP:§6.8]. This also covers gap GS-16 for the roles that may see the list.

### 7.4 Mobile: the 21 groups of row 4

Group names, file counts and file lists are those of [R4:358-643]. "Row" is the provisional row of [BP:351-370], with its work rows in brackets [PL:§21].

| Group (files) | Operations in Live mode | Topics and slices read | Files that change | Settle sites (section 8) | Row |
|---|---|---|---|---|---|
| `runtime` (11) | 4 `getAuthSession`, 21 `getDeviceRegistration` (by the Live source and the gate) | `heartbeat`, `control`; `state`: `session`, `tabletLink` | Section 7.2. `use-audio-shared-values.ts`: no change | S4-7 (inactive in LIVE), S4-9 (unchanged) | 78 (W15, W51) |
| `providers` (1) | — | — | **No change** | — | 78 (W15, W51) |
| `auth` (6) | 2 `signIn`, 3 `getSignInStatus`, 5 `signOut`, 6 `touchSession`, 7 `setBiometricEnrollment`, 8 `signInWithBiometric`, 9 `reportBiometricFailure` | `state`: `auth`, `operators`; `authLockout` | C `auth-provider.tsx`, `biometric.ts`; N the Live biometric token provider (section 9.3). `auth-prefs.ts`, `operators.ts`, `auth-dialogs.tsx`: no change | S1-1, S1-2, S1-3, S4-1 | 79 (W15, W56) |
| `navigation` (2; no production file imports the simulator) | — | The runtime contract | D `root-navigator.tsx`, `routes.ts` (the gate, section 9.4). `session-guards.ts`: no change | — | 82 (W60) |
| `components` (2) | None | None | **No change** | — | — |
| `features/audit` (10) | 60 `verifyAuditChain` | `state`: `audit`, `operators`, `lastSealedSessionId` | C `chain-strip.tsx` | S1-7, S4-3 | 96 (W80) |
| `features/dashboard` (6) | 70 `acknowledgeAlert` (fire-and-forget, `home-header.tsx:170`) | `state`: `session`, `cameras`, `mics`, `time`, `network`, `security`, `evidence`, `alerts`, `storage`, `sessionHistory`; `meters` | D `home-header.tsx` (MD-8, MD-9) | None | 84 (W66) |
| `features/devices` (10) | 48, 49, 50; 52; 65 `runDiagnostics` | `state`: `cameras`, `mics`, `otherDevices`, `tabletLink`, `network`, `faults`, `session`, `audit`, `diagnostics`; `meters` | C `device-detail.tsx`, `device-command-dialog.tsx` | S2-8, S3-2, S5-4 | 93 (W78) |
| `features/evidence` (14) | 40, 41, 42, 43 | `state`: `evidence`, `operators` | C `export-sheet.tsx`, `archive-dialog.tsx`, `evidence-list-screen.tsx`, `evidence-detail.tsx`, `sim-adapter.ts`, `integrity-tab.tsx` | S1-5, S1-6, S3-1, S5-1, S5-5, and the ignored `verify` result | 92 (W74) |
| `features/login` (2) | Through the auth contract: 2, 8, 9, 3 | `heartbeat`; `pairing` | D `login-card.tsx` (section 9.2). The controller already awaits both sign-in paths [R4:58] | None | 80 (W59) |
| `features/more` (6) | None | `state`: `session`, `storage`, `time`, `network`, `audit`, `auth`; `pairing` | D `more-model.ts` (MD-8) | None | 85 (W66) |
| `features/network-time` (3) | None | `state`: `time`, `network`, `tabletLink` | **No change** | None | 95 (W79) |
| `features/pairing` (7) | 18 `redeemPairingCode`, 21, 22 `unpairDevice` | `pairing`; `heartbeat`; `state`: `audit` (only while signed in) | C `use-pairing-flow.ts`, `pairing-screen.tsx`; D `pairing-model.ts`, `pairing-connection.tsx`, `pairing-code-panel.tsx`, `unpair-dialog.tsx` (section 9.4) | S1-8, S2-5 | 81 (W57) |
| `features/session-finalizing` (5) | None | `state`: `session`, `lastSealedSessionId`, `lastSealedAcknowledged` | **No change** | None | 88 (W72) |
| `features/session-live` (7) | 26, 34, 36, 51, 52 | `state`: `session`, `activeCameraId`, `cameras`, `mics`, `storage`, `time`; `meters` | C `use-monitor.ts`, `session-live-screen.tsx`, `end-session.tsx` | S2-1, S4-2 | 87 (W68) |
| `features/session-new` (13) | 24, 25, 28, 29, 30, 31; 52 (fire-and-forget, `device-previews.tsx:111`) | `state`: `operators`, `session`, `sessionHistory`, `mics`, `cameras`, `meta`; `meters` | C `use-session-new.ts`, `session-new-screen.tsx`; `device-previews.tsx` (the import only) | S1-4, S2-2, S4-6, S5-6 | 86 (W67) |
| `features/session-recovery` (7) | 33 `recoverSession`, 70 | `state`: `session`, `sessionHistory`, `evidence`, `alerts`, `faults` | C `use-recovery.ts`, `session-recovery-screen.tsx`, `sim-adapter.ts` | S2-3, S4-8, S5-2 | 90 (W73) |
| `features/session-summary` (5) | 37 `acknowledgeSessionSummary` | `state`: `session`, `time`, `evidence`, `sessionHistory`, `operators` | C `use-summary.ts`, `session-summary-screen.tsx` | S2-4, S4-4 | 89 (W72) |
| `features/sessions` (6) | None | `state`: `sessionHistory`, `session`, `operators` | **No change** (S4-5 reads the Live clock) | S4-5 (unchanged) | 91 (W72) |
| `features/settings` (8) | 33, 52, 65, 67 `startSoftwareUpdate`, 71, 72, 73, 74; 7 through the auth session | `state`: `meta`, `session`, `faults`, `diagnostics`, `update`, `device`; `pairing` | C `maintenance-section.tsx`; S `preferences-section.tsx`; D `security-section.tsx` (the pairing row and the biometric switch, sections 9.3-9.4); `settings-model.ts` and `profile-sheet.tsx` list the role's permissions from the shared table and need labels for the three new permissions (row 26 (W16)) | S2-7, S5-7 | 97 (W82) |
| `features/storage` (9) | 55 | `state`: `storage`, `storagePolicy`, `events`, `session`, `evidence` | C `storage-screen.tsx`, `manage-storage-sheet.tsx` | S2-6, S5-3 | 94 (W79) |
| `src/app/` (34 route files, none imports the simulator, [R4:292]) | — | — | **No change** to route files; the gate lives in `navigation/` (row 82 (W60) may adjust `_layout.tsx` and `(app)/_layout.tsx`, [BP:355]) | — | 82 (W60) |
| Not in the 140: `features/home` (Stack Check) | 1 `getServiceHealth` | `heartbeat` | D `use-health.ts`: in LIVE mode the health call addresses the Core server through the existing `fetchImpl` seam (`packages/shared/src/api/health.ts:46-50`). W51 owns this file [PL:§21] (section 17.2, FC-6) | — | 78 (W15, W51) |

Count: the C files are 2 (`auth`) + 1 + 2 + 6 + 2 + 3 + 2 + 3 + 2 + 1 + 2 = 26, plus `sim-runtime-provider.tsx` and `use-audio-shared-values.ts` of `runtime` (sites S4-7 and S4-9, neither needs the helper), 28 in all. The decision record says 27 [AN:552]; the difference is that the two evidence files with the ignored `verify` result (`sim-adapter.ts`, `integrity-tab.tsx`, [R4:139]) are counted here and `sessions-screen.tsx` (S4-5, no change) is not.

Mobile uses 33 of the 42 actions [R4:48]. The nine it never calls (`signInWithSecurityKey`, `scanCaseNumber`, `addNote`, `exportAudit`, `exportLogs`, `resetDemo`, `restartServices`, `setPresentationMode`, `updateSettings`) get no mobile Live behaviour in this task.

---

## 8. Live behaviour of every synchronous-return call site

Site IDs: the web classes A to F are those of [R3:161-230]; the mobile tables S1 to S5 are those of [R4:126-187]. In Simulated mode every site behaves as today: `settle` runs its continuation before it returns (CL-25).

### 8.1 Rules that hold for every site

| ID | Rule | Reason |
|---|---|---|
| LB-1 | **Busy at once, spinner late.** From the press until the action settles the control that sent the command ignores further presses (an in-flight flag; the control is marked `aria-busy`), so a second press cannot send a second command. For the first `LIVE_PENDING_REVEAL_MS` its look does not change. Only after that does the control show the kit's own pending state (`isPending` with the `Spinner` inside the button, as the Login button already does, `apps/core-web/src/features/login/auth-card.tsx:272-283`). The spinner replaces the button's icon, so nothing moves | On loopback the answer is expected sooner (CA-01); the UI then looks as it does with the simulator. Recorded reason for the late spinner: a server that is slow or restarting must not leave a dead-looking control |
| LB-2 | **An existing pending visual is kept and becomes true.** Where the predecessor already shows a paced state (Login verification beat, export pipeline, verification spinner, diagnostics modal, pairing steps), that state now spans the real request, and its old duration is the **minimum** display time, so it never flashes | [R3:51]; [PM:M-C-21, M-C-22] |
| LB-3 | **Success continues as today, after the settle**: toast, navigation, flight, closing the dialog. Read-after-write lines need no change (CL-16) | [AN:551] rule 2 |
| LB-4 | **An optimistic visual stays optimistic only where it changes no record**: the marker chip at the button, the snapshot shutter flash, the camera selection. Each has a stated undo. Nothing else is optimistic | controller requirement 3 |
| LB-5 | **A refusal uses the same branch as today**, because the class is the same (CL-20). A `SimPermissionError` is shown by the presenter of section 6.2 before any generic message | section 6.2 |
| LB-6 | **Unreachable server**: `LiveTransportError`. One toast, "Core server unreachable. Nothing was changed.", coalesced to one per 3 s; the control returns to idle; a dialog or drawer stays open with what the operator typed. No automatic retry [SP:API-11] | CL-21, CL-22 |
| LB-7 | **Timed-out command** (no answer in 8 s): the same toast with "The command may or may not have been applied; the screen updates when the Core is reachable." The next snapshot shows the truth | CL-6 |
| LB-8 | Mobile adds the existing haptic at the press and the existing success or error haptic at the settle [PN:§7.6]; nothing new |  |
| LB-9 | Reduced motion and the `?motion=off` test switch skip the minimum display times of LB-2, as `beatMs` does today (`apps/core-web/src/features/login/use-login-controller.ts:70`) | existing |
| LB-10 | **A limit is not an outage.** A 429 `RATE_LIMITED` (the request throttle, or the denial budget after 20 refused calls of one key within 60 s, [SP:ID-P12, ID-P13]) shows one warning toast: "The Core server is limiting requests from this console. Try again in {{seconds}} s.", with the seconds from `retry-after` (on the mobile Pair screen the existing error form of section 9.4 takes its place). The control returns to idle and a form or dialog keeps what was typed. A 429 never shows the offline notice of LB-6 and never changes the mode indicator | [SP:SR-71]; finding FC-11 |

### 8.2 Web, class A: the return value is used (14 sites, 11 actions)

| ID | Site | Live behaviour: waiting, success, refusal |
|---|---|---|
| A1 | `signIn`, `features/login/use-login-controller.ts:196` | WS-1 to WS-4. Waiting: the existing Submitting state, minimum `VERIFY_BEAT_MS`. 200 → `settle(result)` with `ok: true` after the snapshot (section 5.2). 401 → the `INVALID_CREDENTIALS` union. 423 → the `LOCKED` union; the Alert and countdown come from the lockout slice. 403 (`ORIGIN_NOT_ALLOWED`, `DEVICE_NOT_PAIRED`: a misconfigured dev origin, for example a console opened under `localhost`, WT-2a) → the existing "unexpected" Alert (`fail`, `:172-177`) and a console record that names the cause. 429 → the limit toast of LB-10; the form stays filled. Transport error → the offline Alert, not "unexpected" |
| A2 | `signInWithSecurityKey`, `:215` | Not reachable: the button is not rendered (WS-8) |
| A3 | `createSession`, `features/session-new/index.tsx:203` and `:207` | The function is already asynchronous (`await wait(CREATE_BEAT_MS)`, `:201`), so the calls are awaited (CL-26). Waiting: the existing `creating` state of the Next button. 201 or 200 → `ok: true`. 409 → `{ ok: false, reason: 'SESSION_ACTIVE' }`; if the session seen before the call was a setup session, `cancel` is awaited and `createSession` repeated, as today. 401, 403, 422 → the union's other reasons and the existing toast per reason (`:208-212`). If another client created a session meanwhile (edge case E5), the toast says a session is active and the page's existing state sync shows that session's step (`:164-183`) |
| A4 | `scanCaseNumber`, `features/session-new/sim-adapter.ts:21`, used at `index.tsx:226` | The adapter returns a possibly asynchronous string; the handler writes the field in `ok`. Waiting: LB-1 on the scan button; the field stays editable. Refusal or transport error → the adapter's existing fallback, the next number computed from the replica (`sim-adapter.ts:22-24`) |
| A5 | `exportEvidence`, `features/evidence/export-wizard.tsx:145` (and `:133`, result discarded) | Waiting: the wizard's existing pipeline step (LB-2). 202 → `{ ok: true, status: 202, exportId }`, then the audit row of the export is read from the replica as today (`:146-148`, class C-5). 403 → the wizard's denied Alert; the server wrote `EXPORT_DENIED`. 404, 409, 422 → the union's reasons and the existing messages; `INVALID_REASON` returns to the reason step. Transport error → the wizard's failure state with the LB-6 sentence |
| A6 | `verify`, `features/evidence/use-verification.ts:232`; `sim-adapter.ts:96` | Section 14, point 7. Waiting: the existing Spinner and hash scramble (M-C-21). The verdict chip, the per-track list and the custody entry show the **server's** `EvidenceVerifyResult`. The check over the bundled demo files still runs for display and is labelled "Bundled demo package"; `inject` is never called (D-1) |
| A7 | `exportAudit`, `features/security-audit/sim-adapter.ts:66`, used by `export-audit-dialog.tsx:76` | `exportAuditWithReason` returns a possibly asynchronous receipt; the dialog's `submit` continues in `ok`. Waiting: the dialog's existing pipeline Stepper. 202 → the receipt is built from the `AUDIT_EXPORTED` row in the replica (`:77`), and the file from all pages of `listAuditRows` (operation 59; 200 rows a page; the step shows the page count), because the server's table may hold more rows than the ring [SP:§11]. 403 → the denied state; 422 → the reason field's error |
| A8 | `exportLogs`, `features/system/diagnostics.tsx:103` | Through the command wrapper (B-10). 202 → the bundle is built from all pages of operations 59 and 63 plus `services` and `diagnostics` from the replica (`:114-127`), then the success toast with the export ID |
| A9 | `verifyAuditChain`, `features/security-audit/chain-panel.tsx:94`; `features/session-monitor/integrity-panel.tsx:67` | Waiting: the existing Spinner. The result is the `view` check (the bindings table of section 2.5), stamped with the Live clock (C-6). In Live mode the chain panel adds one line under the result: "Stored chain: verified, n rows" or the first bad sequence, from `stored`. During an `AUDIT_TAMPER` demo fault the panel therefore shows a broken view and an intact stored chain, as [SP:§12.3] defines. When the Core has discarded chains by a reset or a scenario load, a second line reads "Earlier chains: n" and opens a read-only list of them (epoch, row count, head hash shortened, time of the reset, operator, scenario), from the `lineage` member [SP:§7.13]: the durable trace of every reset [SDR:SD-19] |
| A10 | `runDiagnostics`, `features/system/use-sim-command.ts:56`; consumers `index.tsx:43`, `diagnostics.tsx:251,301` | `useStartDiagnostics` takes a callback instead of returning a boolean; the modal opens in `ok` (202). Waiting: LB-1 on the Run button. The per-check progress comes from the `diagnostics` slice |
| A11 | `restartServices`, `features/system/sim-adapter.ts:67`, used at `diagnostics.tsx:95-99` | 200 `{ restarted }` → the toast prints the count. 409 `SESSION_ACTIVE` → `SimTransitionError` → the existing friendly warning |

### 8.3 Web, class B: a synchronous throw around a void action (36 sites by the inventory's count)

Rows follow the inventory's table [R3:187-197]. Every row: LB-1, LB-5, LB-6.

| ID | Sites | Live behaviour beyond the common rules |
|---|---|---|
| B-1 | `archiveEvidence`: `features/evidence/detail-page.tsx:159`, `list-page.tsx:139` | The menu closes at the press. On the settle the status chip morphs (M-C-10) and the success toast shows. 403 → denied toast (`:162`, `:142`); 409 `NOT_SEALED` → the existing not-sealed warning (`:163`, `:143`) |
| B-2 | `addMarker`, `addNote`, `snapshot`, `stopRecording`: `features/session-monitor/action-bar.tsx:218,289,376,554` | Marker: the popover closes and the chip appears at the button at the press (optimistic visual, LB-4); the flight to the timeline (M-C-17) and the toast run on the settle; on a refusal the chip exits (R2) and the toast explains. Note: the drawer's Save button is busy (LB-1); the drawer closes on the settle; on a refusal it stays open with the text. Snapshot: the shutter flash plays at the press (LB-4); the thumbnail flight (M-C-18) on the settle. Stop: the dialog's confirm is busy; it closes on the settle. 422 → the reason field's error and the dialog stays open. 409 because another operator already stopped the session (Q16) → the dialog closes with an info toast "The session was already ended."; the finalization overlay follows the state |
| B-3 | `recover`, `features/session-monitor/index.tsx:86` | Settle, then the recovery overlay follows the state. Refusal → `session.recovery.failed` or the denied toast (`SESSION_START`) |
| B-4 | `setActiveCamera`, `features/session-monitor/live-feed-panel.tsx:67` | Optimistic selection (LB-4): the toggle shows the pressed camera at once from a local pending value, which yields to the store on the settle and reverts on a failure. Reason: a view selection with no record [SP:§7.10 operation 51] |
| B-5 | `acknowledgeAlert`, `features/security-audit/chain-panel.tsx:109` | Settle; the alert leaves the list when the delta arrives |
| B-6 | `beginPrecheck` (`features/session-new/index.tsx:189,214`), `acknowledgePrecheckWarnings` (`:234`), `retryPrecheck` (`:246`), `startRecording` (`:259`), `cancel` (`:297`, `:206`) | The resume effect at `:186-195` runs whenever the step is 2 and the state is CREATE; in Live mode the state changes only when the delta arrives, so the effect carries an in-flight marker per session ID and sends one request. Acknowledge: `goTo(3)` in `ok`. Retry: the acknowledgement reset in `ok`. Start: the optional 3-2-1 runs first, as today; then the request; the toast and the navigation to `/session` run in `ok`, where the store already shows RECORDING. Cancel: the dialog's confirm is busy; leaving happens in `ok` |
| B-7 | `deviceCommand`: `features/devices/index.tsx:80,85,89`; `features/dashboard/devices-panel.tsx:64` | The menu closes at the press. 409 `RECORDING_ACTIVE` (restart while recording) and 409 `COMMAND_UNSUPPORTED` → `SimTransitionError`, the existing friendly toast. 403 → denied toast (`DEVICE_MANAGE` or `DIAGNOSTICS_RUN`) |
| B-8 | `resetClip`, `features/devices/audio-input-card.tsx:50` | Settle; the CLIP chip leaves when the delta arrives |
| B-9 | `setStoragePolicy`, `features/storage/manage-drawer.tsx:53` | Apply is busy; the drawer closes and the toast shows in `ok`; on a refusal the drawer stays open. 422 → `SimTransitionError` with `POLICY_RANGE` → `storage.manage.failed` |
| B-10 | The 13 commands behind `useSimCommand` (`features/system/use-sim-command.ts:26-45`): `demo-panel.tsx:162,185,200,215,228`; `settings-panel.tsx:202`; `update-panel.tsx:66`; `diagnostics.tsx:86,95,103`; `useStartDiagnostics` | The wrapper keeps its three branches (permission, transition, generic) and gains a callback form: `run(command, options, onDone)`; `onDone(result)` runs in `ok`. Callers that did `if (!done) return` move the rest into `onDone`. A `CoreRefusalError` with `DEMO_DISABLED` → warning toast "Demo controls are disabled on this Core server." (normally unreachable: the panel is hidden, [SP:DC-3]) |

### 8.4 Web, classes C to F

| ID | Site | Live behaviour |
|---|---|---|
| C-1 | `action-bar.tsx:218` then `:224-225` (marker count and time) | No change: the read runs in `ok` and sees the new marker (CL-16) |
| C-2 | `action-bar.tsx:376` then `:383-385` | No change, same reason |
| C-3 | `session-new/index.tsx:203-214` (state read decides `beginPrecheck`) | No change after the awaits of A3 |
| C-4 | `session-new/index.tsx:256` then `:259` (ID read before the call) | No change |
| C-5 | `export-wizard.tsx:145-148` (audit row of the export) | No change: the `append` with the row is in a revision at or below the answer's |
| C-6 | `chain-panel.tsx:94-95` (clock stamp) | No change: the Live clock |
| C-7 | `demo-panel.tsx:162-170` then `:151` (`audit.rows.at(-1)` for the toast) | In Live mode the newest row may belong to the engine or to another client. The note reads the newest row of the command's audit type whose actor is the signed-in operator |
| D-1 | `evidence/sim-adapter.ts:94,96` (`inject(TAMPER)` then `verify`) | **Not done in Live mode**: only `verify` is called (section 14, point 7) |
| D-2 | `session-new/index.tsx:206-207` (`cancel` then `createSession`) | Awaited in order (A3) |
| D-3 | `session-new/index.tsx:203-214` (`createSession` then `beginPrecheck`) | Awaited in order |
| D-4 | `demo-panel.tsx:165-168,187,203-204,217-219` (clear, reset clip, reset, scenario) | Nested `settle` calls, one request after the other. `resetDemo` and `loadScenario` settle when the snapshot of the new epoch is applied (CL-18); while the server rebuilds, every other request answers 503 [SP:DC-4], which the client shows as "The Core server is starting" (section 3.5) |
| D-5 | `devices/index.tsx:80-81` (`IDENTIFY` then local blink state) | The local state is set in `ok` |
| D-6 | `export-wizard.tsx:131-137` (one export per selected row on the denied path) | Nested `settle` calls in row order; each writes its denial row on the server. The server audits at most 20 refusals of one operator within 60 s [SP:ID-P13]; with more rows than that selected, the later calls answer 429 and are shown by LB-10 |
| E | Guards `routes/_app.tsx:11`, `routes/login.tsx:11`, `routes/_app/session/new.tsx:16`; plain reads `login/sim-adapter.ts:28`, `session-new/sim-adapter.ts:23` | No change (section 5.4). `readLastAuthEvent` gets its Live branch (WS-6) |
| F | `components/shell/app-shell.tsx:103` (`touch`); `user-menu.tsx:21-22` (`signOut`); `components/composed/dbfs-meter.tsx:360` (`resetClip`); `features/system/sim-adapter.ts:80,98,103` (`setPresentationMode`, `updateSettings`) | **No change** (CL-24). `touch` is throttled by the binding (CL-27). A failed preference write is reported through `onError`; the toggle follows the replica, so it shows the server's value |

### 8.5 Mobile, table S1: the return value is used (9 expressions)

| ID | Site | Live behaviour |
|---|---|---|
| S1-1 | `signIn`, `auth/auth-provider.tsx:218` | The enclosing function is already asynchronous: the action is awaited (CL-26). The union maps as today (`toContractSignInResult`). On `ok` the operator is found in the replica (`:224`, S4-1), which holds the snapshot by then. `LiveTransportError` → `{ ok: false, reason: 'CORE_OFFLINE' }`; anything else, a 429 included, → `UNAVAILABLE` (existing catch), and a 429 is worded by LB-10. `isSignInBlocked` covers LIVE: blocked while the link is not ONLINE (`:144-147`). 403 `DEVICE_NOT_PAIRED` or `DEVICE_REVOKED` cannot be shown on this screen: the gate has already moved the app to the Pair screen (section 9.4) |
| S1-2 | `signInWithBiometric`, `auth/biometric.ts:147` | `BiometricSimAuth` (`:128-131`) allows asynchronous results; `applyBiometricOutcome` awaits them (its caller is already asynchronous, `:176-187`). Section 9.3 |
| S1-3 | `recordBiometricFailure`, `auth/biometric.ts:151` | Operation 9; the returned `SignInStatus` is mapped to the failure union (`fromFailure`, `:133-137`) |
| S1-4 | `createSession` twice, `features/session-new/use-session-new.ts:174,179`; outcome read at `session-new-screen.tsx:228` | `createAndCheck` returns a possibly asynchronous `CreateOutcome`; the submit handler continues in `ok`. Waiting: LB-1 on Next. Refusals set the existing inline error by reason (`setCreateError`). `cancel` and `beginPrecheck` run in order (nested `settle`) |
| S1-5 | `exportEvidence` probe, `features/evidence/export-sheet.tsx:113` | Kept: a role without `EVIDENCE_EXPORT` still calls the Core so that the denial is audited [R4:181]. Fire through `settle`; only the outcome is logged |
| S1-6 | `exportEvidence`, `export-sheet.tsx:142` | The request starts with the build step; the result is shown at the later of the answer and `EXPORT_BUILD_MS` (LB-2). The union maps as today; `INVALID_REASON` returns to step 3 |
| S1-7 | `verifyAuditChain`, `features/audit/chain-strip.tsx:107` | The Spinner already shows one frame earlier (`:103-104`); it stays until the settle. The time stamp is the Live clock (S4-3) |
| S1-8 | `pair`, `features/pairing/use-pairing-flow.ts:103` | Section 9.4 |
| — | `verify` (`features/evidence/sim-adapter.ts:61`) and `runDiagnostics` (`maintenance-section.tsx:114`, `device-detail.tsx:136`), results ignored today | `verify`: the server's verdict is shown (section 14, point 7). `runDiagnostics`: S2-7 and S2-8 |

### 8.6 Mobile, table S2: a success or a throw becomes a boolean

Each wrapper keeps its error branches and returns a possibly asynchronous boolean; each consumer moves what followed the `if` into `ok`.

| ID | Wrapper and consumers | Live behaviour |
|---|---|---|
| S2-1 | `useMonitorActions.run`, `features/session-live/use-monitor.ts:132-152`; consumers `session-live-screen.tsx:150,157,180-189`, `end-session.tsx:189` | The read-only refusal while the link is down stays first (`:133-137`). Snapshot: shutter at the press (LB-4), signal bump and toast in `ok`. Marker: the timeline read (S4-2) in `ok`. End session: the dialog's button is busy, the dialog closes in `ok`, and re-enables on `false`. `resetClip` and `setActiveCamera`: results ignored, as today |
| S2-2 | `useFlowActions.guarded`, `features/session-new/use-session-new.ts:199-210`; consumers `session-new-screen.tsx:188,240,246,256` | Acknowledge: step 3 opens in `ok`. Retry: the reset in `ok`. **Start (the hand-off of [R4:52])**: `launch` calls `settle` around `actions.startRecording()` and dispatches the stack replace in `ok`. By CL-16 the store update to RECORDING and that dispatch are in one synchronous turn, in both arrival orders, so the wizard route never renders RECORDING and its "session busy" guard (`navigation/session-guards.ts:18-38`) does not fire (CA-02). On `false`: `setLaunching(false)`, stay on step 3. **Fallback if CA-02 fails**: row 82 (W60) lets `useSessionNewRedirect` skip its toast for a transition from ARMED to RECORDING of the same session ID seen while mounted |
| S2-3 | `useRecoveryActions`, `features/session-recovery/use-recovery.ts:213-243`; consumers `session-recovery-screen.tsx:140,175` | `start` returns a possibly asynchronous boolean; the screen's milestones follow the state |
| S2-4 | `useAcknowledgeSummary`, `features/session-summary/use-summary.ts:123-144`; consumers `session-summary-screen.tsx:103,107` | Navigation to `/home` or to the evidence in `ok` |
| S2-5 | `usePairingFlow.unpair`, `features/pairing/use-pairing-flow.ts:163-174`; consumer `pairing-screen.tsx:66-68` | Section 9.4 |
| S2-6 | `useApplyStoragePolicy`, `features/storage/storage-screen.tsx:184-204`; consumer `manage-storage-sheet.tsx:179` | The sheet closes in `ok`; stays open on `false` |
| S2-7 | `useSimCommand`, `features/settings/maintenance-section.tsx:61-80`; uses at `:114,203,270-282,288,298` | Callback form, as the web wrapper (B-10). The diagnostics sheet opens in `ok`; the scenario chip is set in `ok` |
| S2-8 | `KnownDeviceDetail.startDiagnostics`, `features/devices/device-detail.tsx:134-141`; consumers `:236,270` | The sheet opens in `ok` |

### 8.7 Mobile, tables S3 to S5 and the clock-dependent sites

| ID | Site | Live behaviour |
|---|---|---|
| S3-1 | `ArchiveDialog`, `features/evidence/archive-dialog.tsx:26-39`; callers `evidence-list-screen.tsx:137-144`, `evidence-detail.tsx:352-359` | The `archive` callback may return a promise. The dialog keeps its busy state until the settle, shows the success toast in `ok` and the danger toast in `fail`, and closes in `done`. Today's order "call, toast, close" would toast before the server answers [R4:51] |
| S3-2 | `DeviceCommandDialog`, `features/devices/device-command-dialog.tsx:31-45`; caller `device-detail.tsx:278` | Same change |
| S4-1 | `auth-provider.tsx:224` (operator lookup after `signIn`) | No change after the await (S1-1) |
| S4-2 | `session-live-screen.tsx:158-163` (timeline tail after `addMarker`) | No change: runs in `ok` |
| S4-3 | `chain-strip.tsx:108` (clock) | No change: the Live clock |
| S4-4 | `use-summary.ts:130` (pending summary ID before the call) | No change: a read of the replica |
| S4-5 | `sessions-screen.tsx:136` (refresh stamp) | No change |
| S4-6 | `session-new-screen.tsx:203` (next case number computed on the device) | No change: the counters and the history are replicated. Two clients may propose the same number; the server accepts a case number as given, as the simulator does |
| S4-7 | `runtime/sim-runtime-provider.tsx:199-201` (tablet link from the heartbeat) | Inactive in LIVE: the effect returns when the source is LIVE. The server sets the link from real connections [SP:§6.8] |
| S4-8 | `use-recovery.ts:251-258` (acknowledge each matching alert) | One request per alert, fired without waiting for each other; `acknowledgeAlert` is a no-op for an acknowledged alert [SP:§7.15] |
| S4-9 | `runtime/use-audio-shared-values.ts:87-109` (20 Hz poll and subscription) | No change: the `audio` slice is fed by `meters` |
| S5-1 | `export-sheet.tsx:107-120` | Display hint kept; the probe is S1-5 |
| S5-2 | `session-recovery/sim-adapter.ts:40-58` | The client-side check stays as the hint that disables the button; the server enforces `SESSION_START` on operation 33 |
| S5-3 | `storage/sim-adapter.ts:60-62` | Hint kept; the server enforces the any-of rule on operation 55 |
| S5-4 | `devices/use-devices-data.ts:29`, `device-detail.tsx:155` | Hint kept; the server enforces `DEVICE_MANAGE` on operation 48 |
| S5-5 | `evidence/use-evidence-data.ts:56` | Hint kept |
| S5-6 | `session-new/session-new-model.ts:62` (investigator list) | Hint kept; roles come from the replica |
| S5-7 | `settings/settings-model.ts:76`, `profile-sheet.tsx:51` (permission list of the role) | The shared table; three more entries for SUPERVISOR after row 26 (W16) |
| Clock | Pairing phases and hand-off (`use-pairing-flow.ts:78,89-143`); recovery acknowledgement (`use-recovery.ts:173-175`); lockout countdown (`auth-provider.tsx:125-133`); monitor timer (`use-monitor.ts:59-61`) | The last three read `clock.now` and work on the Live clock unchanged. The pairing timeline keeps running, on the Live clock; only its commit becomes a request (section 9.4) |

---

## 9. Mobile: credentials, biometric unlock, pairing and the gate

Everything in this section applies in LIVE mode only. In SIMULATED and HEARTBEAT mode the app behaves as today, including the predecessor's rule that an unpaired tablet may sign in [PN:§6.5].

### 9.1 Credential storage per client

Answers impact question 11 for the clients (the server side is [SP:§5.3, §14.1]).

| Client | Secret | Where it is held | Where it is never written |
|---|---|---|---|
| Web | Session token | The `dems_session_<port>` cookie of the instance the console talks to, `HttpOnly`: script cannot read it | `localStorage`, `sessionStorage`, the URL, the console log |
| Web | Pairing code (shown to a supervisor) | Memory of the Paired Devices feature, at most for the life of the page load; dropped at a sign-out, a session end or the loss of `PAIRING_MANAGE` (PG-6a; section 10.3) | Web storage, the URL, the clipboard, the TanStack Query cache |
| Mobile | Device credential (`dvc_...`) | `expo-secure-store` item `dems.live.device.v1`, **without** an authentication requirement, so the gate can read it at start: JSON of the device ID, the credential, `pairedAt` and the Core identity returned at redeem | AsyncStorage, the runtime log, the debug handle |
| Mobile | Session token (`ses_...`) | Memory of the Live source only; a cold start signs in again [SP:§5.3] | Any storage |
| Mobile | Biometric token (`bio_...`) | `expo-secure-store` item `dems.live.bio.v1`, with `requireAuthentication: true`; without it only under the conditions of MB-6a (section 9.3) | AsyncStorage, the runtime log |
| Mobile | Biometric marker (not a secret) | `expo-secure-store` item `dems.live.bio.meta.v1`: the operator ID and display name the token belongs to, the device ID, and whether the token item is protected. It lets the Login screen show the fingerprint button without a prompt | — |

| ID | Rule | Source |
|---|---|---|
| MP-1 | One wrapper module (`apps/mobile/src/runtime/secure-credentials.ts`, row 78 (W15, W51)) is the only importer of `expo-secure-store`. It exposes read, write and delete for the three items and nothing else | [BP:351] |
| MP-2 | The three existing AsyncStorage keys of the app and the simulator snapshot key are not used for any of this (section 3.4). In particular `dems.mobile.auth.v1` keeps holding only the simulated binding (`apps/mobile/src/auth/auth-prefs.ts:1-13`) | [R4:62] |
| MP-3 | The Live source's public surface (which the debug handle `__DEMS_DEBUG__` exposes in debug builds, [R4:206]) has no member that returns a credential or a token; the bearer function is private to the typed client | [SP:SR-32] |
| MP-4 | Secure-storage items do not survive an uninstall [SP:§6.7]. `adb install -r` keeps app data; what it does to a Keystore entry is not confirmed [AN:451], so after a debug reinstall the app treats an unreadable item as absent (state UNPAIRED) | G-14 of [AN:785] |

### 9.2 Sign-in on a paired device

| Element | Live behaviour |
|---|---|
| Reachability | The Login screen exists only for a PAIRED device (section 9.4) |
| Password sign-in | Operation 2 with the device credential as bearer; the answer's `sessionToken` is kept in memory; the socket is reopened with it (CL-11a); the snapshot is applied; then the contract's `signIn` resolves (S1-1) |
| Lockout | Keyed by the device ID on the server [SP:ID-P3]; the screen reads it through the existing `lockoutInfoOf` (`auth/auth-provider.tsx:125-133`) from the synthesised slice; `getSignInStatus` is called when the screen mounts |
| Trust line (L11 of [PN:§4.1]) | "Core: {{core device}} • paired as {{device ID}}", for example with `DEV-0003`; the link's label becomes "Pairing details" and still opens `/pair` (`features/login/login-card.tsx:519-547`) |
| Demo operators (L10) | Kept (Q12), under the same four conditions as the web disclosure (WS-9; [SP:SR-63]). The three seeded operators from the `OPERATORS` constant fill the form, as today, **without the role chip** (a role is server data). The password hint stays, with the same plain sentence above it: these are published demo credentials for synthetic accounts on this local demo (C1). **The pairing-code hint is not rendered** (`login-card.tsx:506`): the simulator's fixed code means nothing to the Core server [AN:622]. Hidden in presentation mode, which on mobile stays a device preference in both modes (`features/login/presentation-mode.ts`) |
| Core offline | The existing state: Sign In disabled, reason `CORE_OFFLINE`; plus "Use Simulated mode" in debug builds |
| Idle | The provider's 5 s activity throttle stays (`auth-provider.tsx:54,261`); the binding applies CL-27 on top. The server ends the session; the existing idle-lock dialog shows |
| Cold start while a session records | Sign in again; the existing route resync opens the monitor [PN:§3.7] |

### 9.3 Biometric unlock and the security-key button

Answers impact question 17 on the client side. The protocol is [SP:§5.6]: the server never accepts a claim that a biometric check passed; it accepts a single-use token.

| ID | Rule | Source |
|---|---|---|
| MB-1 | **Enrol.** Only inside a session created by password on this device. The existing offer dialog after a password sign-in (`auth-provider.tsx:199-206`) and the existing Settings switch (`features/settings/security-section.tsx:45-62`) call `setBiometricEnrollment { enabled: true }` (operation 7). The returned token is written to `dems.live.bio.v1` and the marker to `dems.live.bio.meta.v1`. In a session created by biometric the switch is disabled with the description "Sign in with your password to change biometric sign-in." | [SP:§5.6 step 1; §7.5 operation 7] |
| MB-2 | **Disable.** `{ enabled: false }`; both items are deleted. Revocation, unpair and a disabled user revoke the token on the server [SP:§5.6 step 8]; the app deletes both items whenever it deletes the device credential |  |
| MB-3 | **Sign in.** The fingerprint button is shown when the marker exists and the existing availability check passes (`auth/biometric.ts:176-187`). The token is read (the OS prompt, MB-5) and sent with operation 8 under the device credential. 200: the session token is kept in memory, the rotated `biometricToken` is written (MB-6), the socket is reopened, the result is `signed-in`. 401: the stored token can never work again; both items are deleted and the screen shows an Alert "Biometric sign-in is no longer valid on this tablet. Sign in with your password to enable it again." 423: the existing `locked` result | [SP:§5.6 steps 3-6] |
| MB-4 | **A failed OS check** (`authentication_failed`) calls operation 9, as `recordBiometricFailure` does today (`biometric.ts:150-153`). A cancelled prompt calls nothing | [SP:§5.6 step 7] |
| MB-5 | **The prompt on an emulator** (open point 8). The documentation says emulators do not require authentication to read a protected item [SP:§5.6]. Three cases, decided so that the operator always sees exactly one prompt: | [AN:454] |
| | (a) A real device (`isDevice` true, CA-06) with a protected item: the protected read **is** the prompt; `expo-local-authentication` is not called first | |
| | (b) An emulator with a protected item: the existing `expo-local-authentication` prompt (`promptBiometric`, `biometric.ts:97-110`) runs first; the read follows on success | |
| | (c) The protected write or read throws: the token is stored **without** `requireAuthentication`, the marker records `protected: false`, and the existing prompt always runs first. This is the fallback the decision record names [AN:454]. It is allowed only under the conditions of MB-6a | |
| MB-6 | **The write after a rotation** (open point 8). The new token is written with the same options as the old one. If that write fails, both items are deleted: the session stays, biometric sign-in is off until the operator enrols again. If on a device the protected write shows a second OS prompt (not known; row 79 (W15, W56) observes it on each AVD), case (c) is used for that build, because a sign-in that asks for the finger twice is not acceptable. That is DEPARTURE-6, which the controller accepted with the conditions of MB-6a [DEC:D15, D16] | CA-07 |
| MB-6a | **Conditions of the unprotected fallback** (DEPARTURE-6). (1) The case in use is recorded per AVD (MB-8, AC-C-71). (2) Case (c) is allowed only where `isDevice` is false **or** the build is a debug build. Anywhere else a failing protected write or read **turns biometric sign-in off** (both items deleted, the switch off, the Alert of MB-3); it never falls back silently. A Live build on a physical device is U4 and needs a new security review. (3) While the marker says `protected: false`, no text on any screen says or implies that the token is protected by the device's hardware; the Settings description then reads "Biometric sign-in asks for this device's screen-lock check." (a new key). The server-side rules are the same in every case: single use, rotation, reuse detection, binding to device and operator, revocation [SP:SR-36, SR-37] | [SDR:§5.5, SD-18]; [DEC:D15, D16]; residual R-07 |
| MB-7 | The `biometric` part of the auth session that the screens read (`availability`, `enabled`, `lastOperatorId`, `auth-provider.tsx:101-115`) is fed from the marker in LIVE mode and from `dems.mobile.auth.v1` in the other modes. No screen changes |  |
| MB-8 | Row 79 (W15, W56) records for each of the three AVDs: whether the protected write succeeds, whether the protected read prompts, whether the rotation write prompts, and which case of MB-5 the build uses | [AN:457] |
| MB-9 | **Security key.** The mobile app has never had that button [R4:239]. On the web it is rendered in Simulated mode only (WS-8) | Q11 [DEC:D4] |

### 9.4 Pairing flow and the pairing-required gate

Answers impact question 20 on the client side. The lifecycle is [SP:§6]. The device **types** the code [DEC:DR-02]; no camera module is added.

**The flow on the existing Pair screen.** The screen, its two panes, its stepper and its test IDs stay (`features/pairing/pairing-screen.tsx`). The timeline constants stay too (`PAIR_TIMELINE`, `pairing-model.ts:23`) and now run on the Live clock: the code leaves the device at `commitAt`, as today, so a Cancel before that sends nothing and writes no audit row (`use-pairing-flow.ts:89-120`).

| View (`PairingView`, `pairing-model.ts:52`) | Shown when | Connection pane | Code pane | What ends it |
|---|---|---|---|---|
| `unpaired` | No credential, link up | Stepper: Discover active. Identity list: "Core server", its address, link state; chip `LIVE` in place of `SIMULATED` | `InputOTP` with six slots enabled; Pair enabled at six digits (`use-pairing-flow.ts:149`). In place of Cancel: "Use Simulated mode" (debug builds); the header back button is hidden while the gate holds, because there is nowhere to go back to | Pair |
| `pairing` | From Pair to the answer | Discover running, then Verify running (`stepStatusesFor`, `pairing-model.ts:72-86`) | Slots locked; Pair shows the Spinner and "Pairing…" (existing, `pairing-code-panel.tsx:86-98`). Cancel is enabled until `commitAt` and disabled once the request is sent | The answer |
| `paired` | 201 from `redeemPairingCode` | All steps done; ring in its ready state; identity list: Core device ID, name and certificate fingerprint from the answer's `core` member, and "This tablet: DEV-NNNN" | Success chip; "Continue to sign-in" (or "Done" when opened from Settings); Unpair behind its dialog | Hand-off `handoffAfter` (2,400 ms) later: back if a screen is underneath, else `/`, which now resolves to `/login` (`use-pairing-flow.ts:81-86,122-143`) |
| `failed` | 401 `INVALID_CODE` | Verify in error | The existing danger Alert "Code not accepted" with the attempts left, from `details.attemptsRemaining`; slots cleared with the invalid outline. The answer never says whether the code was wrong, expired, used or closed [SP:SR-29], and neither does the screen | The next digit |
| `locked` | 423 `LOCKED` | Verify in warning; ring critical | The existing warning Alert with the rolling countdown (`pairing-code-panel.tsx:124-150`) to `details.lockedUntil` on the Live clock; slots disabled. The lock is global on the server [SP:PR-P4]: it may come from another device's attempts, and the text does not claim otherwise | The countdown reaching zero |
| `failed`, error form | 429, 5xx, a contract violation, or a failed secure-storage write | Verify in error | Danger Alert "Pairing is not available right now." with Retry. If the credential could not be stored, the app calls `unpairDevice` with it once, so no unusable registration is left behind | Retry |
| offline (new notice on `unpaired`) | Link not ONLINE | Discover in error: "Core server unreachable" | Slots disabled; danger Alert with Retry and "Use Simulated mode" | The link returning |
| notice `revoked`, `unknown`, `unpaired` (new, above the code card) | Set by the gate (below) | — | `revoked`: danger, section 6.6. `unknown`: danger, "This tablet is not registered with this Core. Ask a supervisor for a new pairing code." `unpaired`: info, "This tablet was unpaired." | The next attempt |

| ID | Rule | Source |
|---|---|---|
| MP-5 | The redeem request sends the code, a device name (`expo-device` model name, at most 60 characters; "Android device" if absent), `platform: android` and the app version (`expo-constants`, as the About section reads it, `features/settings/about-section.tsx:26`). No hardware identifier is read or sent | [SP:§6.5, §6.7] |
| MP-6 | On 201 the wrapper writes `dems.live.device.v1` **before** the action settles; the `pairing` slice is set to PAIRED with the Core identity and `pairedAt`; the gate opens | [SP:§6.4 step 4] |
| MP-7 | **Unpair from the device.** The existing dialog; its Live text: "Unpair this tablet? You will be signed out. It needs a new pairing code from a supervisor to be used again. A recording in progress continues on the Core." Confirm calls operation 22. On 204 the three items are deleted and the gate goes to UNPAIRED with the notice `unpaired`. While the link is down the action is refused with the LB-6 toast and nothing is deleted, so the registry never keeps a device the tablet has forgotten | [SP:§6.3 T9] |
| MP-8 | **Re-pairing after a reinstall** (edge case E7). No item exists, so the gate shows the Pair screen; a new redeem creates a new device ID. The portal still lists the old device as PAIRED and offline until a supervisor revokes it (section 10.3 shows "last seen") | [SP:§6.7] |
| MP-8a | `rotateDeviceCredential` (operation 23) is **not called by the app in this task**: no screen needs it and a lost answer is the only way to strand a device. The server tests cover it [SP:AC-B-38]. A `DEVICE_CREDENTIAL_ROTATED` audit row is therefore unexpected in this task and points at a copied credential [SP:§6.3]. Recorded as GC-05; accepted by row 20 (residual R-06) | [SDR:SD-29] |

**The gate.** Today no predicate about pairing exists: `/pair` is public and the only guard is `isAuthenticated` [R4:60]; `apps/mobile/src/navigation/root-navigator.tsx:55-63`.

| ID | Rule | Source |
|---|---|---|
| MP-9 | `RuntimeContract` gains the optional member `pairing`: `required` (true only in LIVE mode), `state` (CHECKING, UNPAIRED, PAIRED), `notice` (`revoked`, `unknown`, `unpaired` or none) and `deviceId`. It is optional, so every existing fake contract stays valid, as with `summaryAcknowledged` (`runtime/contract.ts:84-88`) | [R4:346] |
| MP-10 | **How the state is found at start.** (1) Read `dems.live.device.v1`: absent or unreadable → UNPAIRED. (2) Present → PAIRED at once, and `getDeviceRegistration` (operation 21) is called. 200 → confirmed, the `pairing` slice is filled. 403 `DEVICE_REVOKED` → section 6.6. 401 (the Core does not know the credential: another database, or a re-created one) → the items are deleted, UNPAIRED, notice `unknown`. No answer → stays PAIRED; the Login screen shows the offline state. The runtime's `ready` flag waits for step 1 only, so the splash rule of [PN:§3.2] holds | [SP:§6.6] |
| MP-11 | `blocked` = `pairing.required` and `pairing.state` is not PAIRED. In the root stack the `(auth)` group is guarded by "not authenticated and not blocked", `(app)` by "authenticated and not blocked", and `dev-gallery` by "not blocked"; `index`, `stack-check` and `pair` stay unguarded. The boot router returns `/pair` first when blocked (`root-navigator.tsx:78-90`) | Q5 [DEC:D4] |
| MP-12 | A guarded deep link that arrives while blocked is kept as the pending href, as today (`navigation/pending-href.ts:41-50`); it is used after pairing and sign-in | [R4:287] |

| Route | Simulated or Heartbeat (unchanged) | LIVE, no credential, revoked or unknown | LIVE, paired, signed out | LIVE, paired, signed in |
|---|---|---|---|---|
| `/` (boot router) | `/login`, or the sign-in target | **`/pair`** | `/login` | Resync target, pending href, `/home` |
| `/pair` | Shown | **Shown: the only working screen** | Shown (paired view, Unpair) | Shown (from Settings) |
| `/stack-check` (service health) | Shown | **Shown**: health of the Core server | Shown | Shown |
| `/login` | Shown while signed out | Not available → `/pair` | Shown | Not available |
| Every `(app)` route | Signed in only | Not available → `/pair` | Not available → `/login` | Shown |
| `/dev-gallery` (debug) | Shown | Not available → `/pair` | Shown | Shown |
| Core data on any screen | The simulator's | **None**: the socket is anonymous (`hello` and `heartbeat` only) and every call but health and redeem is refused [SP:§6.6] | None until sign-in | The replica |

### 9.5 Core link sources and the Settings control

| Item | Today | After |
|---|---|---|
| Sources | `SIMULATED`, `HEARTBEAT` (`runtime/core-link.ts:25`) | Plus `LIVE` (MD-3) |
| Link state by source (`core-link.ts:42-49`) | HEARTBEAT: heartbeat LIVE → ONLINE; SIMULATED: the simulator's tablet link | LIVE: the Live socket's heartbeat LIVE → ONLINE, anything else OFFLINE. `CoreLinkInfo.heartbeat` is filled for LIVE as for HEARTBEAT |
| Sign-in block (`auth/auth-provider.tsx:144-147`) | HEARTBEAT and OFFLINE | Any source other than SIMULATED and OFFLINE |
| Heartbeat-to-tablet-link bridge (`runtime/sim-runtime-provider.tsx:192-207`) | Active in HEARTBEAT | Unchanged in HEARTBEAT; **inactive in LIVE** (S4-7) |
| Settings control (`features/settings/preferences-section.tsx:62-77`) | A two-segment `SegmentRow` built from `CORE_LINK_SOURCES`; unavailable sources disabled | **Three segments**: "Simulated", "mock-core heartbeat", "Live". The third gets the test ID `settings-core-link-LIVE` by the existing pattern (`settings-controls.tsx:191`). The two existing hint strings stay; one new line follows them: "Live uses the Core server on this computer through adb reverse. The tablet must be paired." Selecting across the LIVE boundary opens the dialog of section 3.3 |
| Release build | HEARTBEAT disabled | HEARTBEAT and LIVE disabled (MD-3); the existing release-gate test passes unchanged, and the LIVE cases are a new test file beside it [DEC:D17] |

### 9.6 `adb reverse` and the hard-coded ports

| File | Today | Change | Row |
|---|---|---|---|
| `apps/mobile/package.json:18`, script `reverse` | `adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081` | Adds `adb reverse tcp:4420 tcp:4420` | 77 (W13) [BP:350] |
| `apps/mobile/scripts/device-session.sh` | The reversed ports are literals: `PLANNED_REV="8081 4400"` (`:238`), `REVERSED="8081 4400"` (`:449`), `adb reverse tcp:4400 tcp:4400` (`:453`), the no-Metro branch (`:457-458`) | A new optional environment variable (proposed `DEMS_CORE_HOST_PORT`). Unset: nothing changes. Set to 4420-4423: the script also runs `adb -s <serial> reverse tcp:4420 tcp:<value>` and adds `4420` to both lists, so its own clean-up removes the rule (`:328`, `:361`). Any other value exits 64, as the Metro port check does (`:424`). The header comment and the usage line name the variable (`:66`, `:80`) | 77 (W13): the plan gives this script to that row [PL:§21]; [DEC:F22] |
| The app | — | The device side is always `tcp:4420`; a lane changes only the host side [AN:660]. So the app has one address and no setting for it (WT-5) | — |

One consequence for the plan: a device credential belongs to one database. An emulator that paired against lane 1 is "unknown" to lane 2 (MP-10) and must pair again. Row 18 either binds each emulator to one lane or pairs at the start of each device check.

---

## 10. The two new portal pages

Decision Q9: the portal gets a read-only role and permission matrix plus a user list with role assignment and enable/disable; decision Q8: it issues the pairing code, also shown as a QR [DEC:D4]. Both pages are arrangements of the existing kit in the existing shell; no new primitive is introduced [PS:§14 "D6 rule"]; [BP:185].

### 10.1 What both pages share

| ID | Topic | Specification | Source |
|---|---|---|---|
| PG-1 | Routes | `/admin/users` (file `routes/_app/admin/users.tsx`, body in `features/users-roles/`) and `/admin/devices` (`routes/_app/admin/devices.tsx`, body in `features/paired-devices/`). Route files hold only `createFileRoute`, the guard and the search validation, as the page contract requires. Each page is its own chunk (`autoCodeSplitting`) | [PS:§14.2]; [BP:348-349] |
| PG-2 | Page root | `data-testid="page-users-roles"` and `data-testid="page-paired-devices"` | [PS:§14.2] page contract |
| PG-3 | Route guard | `beforeLoad`, in the style of `/session/new` (`routes/_app/session/new.tsx:15-19`): in Live mode, an operator without `USER_ADMIN` (users) or `PAIRING_MANAGE` (devices) is redirected to `/dashboard` with `replace`. In Simulated mode there is no redirect; the page shows its "Live mode only" state | [SP:§4.3] |
| PG-4 | Navigation | `NavItem` (`components/shell/nav-items.ts:41-47`) gains the optional fields `permission` and `liveOnly`, and `group` gains the value `admin`. Two items: "Users & Roles" (icon `UsersRound`, as the matrix panel uses, `features/security-audit/rbac-panel.tsx:3`) and "Paired Devices" (icon `TabletSmartphone`, as the device drawer uses, `features/devices/device-drawer.tsx:3`). They form a group **ADMINISTRATION** between the main items and DEVELOPER, with the same separator and micro label as DEVELOPER (`sidebar.tsx:67-71`). An item is rendered only in Live mode and only with its permission (`useCorePermission`); the group renders only when it has an item. The nine existing items carry no permission and stay visible to every role [SP:RB-10]. The drawer below 1024 px and the "More" sheet below 768 px show the same groups | [PS:§14.4] |
| PG-5 | Appear and disappear | Section 6.3: enter `fast` with `x -8 → 0`, exit R2, neighbours by `layout` | [PM:M-SH-03, R2] |
| PG-6 | Data | TanStack Query 5.104.0 (already installed) over the typed client from the Live handle. Keys: `['core','users']`, `['core','role-matrix']`, `['core','paired-devices']`, `['core','pairing-code']`. Queries are enabled only in Live mode with the permission. One bridge (`apps/core-web/src/runtime/`, row 62 (W05, W50, W54)) listens to `admin.changed` and invalidates: `USERS` → users; `DEVICES` → paired-devices and pairing-code; `PAIRING_CODE` → pairing-code. Queries are also invalidated after an own mutation and after a socket resync. **The pairing code is never put into the query cache** (section 10.3). What is removed from the cache, and when, is PG-6a | [AN:534]; [SP:§9.4] |
| PG-6a | Clearing | On a sign-out, on `session.ended` (any reason), and on a `session.updated` that removes `USER_ADMIN` or `PAIRING_MANAGE`, the bridge **removes** every `['core', …]` query from the cache (`removeQueries`; an invalidation would keep the old rows until the refetch), and the Paired Devices feature drops the pairing code from memory. So nothing of one operator's administration pages can be rendered for the next operator on the same page load | [SDR:SD-20]; [DEC:D16] |
| PG-7 | Component kit | `PageHeader` (`components/shell/page-header.tsx:40-63`); a feature-local `Panel` with its error boundary, in the pattern of `features/security-audit/panel.tsx:31-58` (each feature folder owns its copy, P6 of [BP:439]); kit `Table`, `Chip`, `Avatar`, `Button`, `Dropdown`, `Modal`, `AlertDialog`, `RadioGroup`, `TextField`, `TextArea`, `Label`, `Description`, `FieldError`, `Alert`, `Skeleton`, `EmptyState`, `Tooltip`, `ToggleButtonGroup`, `toast`; the copied-in items `SlidingNumber`, `AnimatedNumber`, `TextScramble` (`components/ui/`). One new dependency, for the second page only: `qrcode.react` 4.2.0 (`QRCodeSVG`) | [AN:466]; every kit component named here is already imported somewhere under `apps/core-web/src` (for example `AlertDialog` in `features/session-new/cancel-dialog.tsx:1`, `Table` in `features/security-audit/rbac-panel.tsx:2`, `Modal` in `features/security-audit/export-audit-dialog.tsx:2`) |
| PG-8 | Layout tokens | The page container class and paddings of every shell page (`dems-page`; gutters and the 12-column grid of [PS:§14.3]); dialogs in the kit's `sm` and `md` container sizes as the two existing dialogs use them (`features/session-new/cancel-dialog.tsx:15`, `features/session-monitor/action-bar.tsx:570`) | [PS:§14.3] |
| PG-9 | Motion | From `useMotionPolicy()` (`apps/core-web/src/motion/variants.ts:136-153`): page title by `PageHeader` (TextEffect, M-APP-04); panels enter with `variants.panel` (R1) on beats from a feature-local `choreography.ts` in the pattern of `features/security-audit/choreography.ts:38-60`; the first panel of each page is its hero and uses `variants.hero` (R3); table rows `variants.rowContainer` and `variants.row` with `ROW_STAGGER_MS` 30 and `ROW_STAGGER_CAP` 10 (M-C-11); numbers start `HELD_BEAT_MS` after their panel (R4); chips morph per M-C-10 with `variants.halo` on an escalation only; a changed or new row gets the gold highlight of M-C-07 (`HIGHLIGHT_FADE_MS`, `HIGHLIGHT_FROM_OPACITY`, `components/ui/animated-list`); dialogs keep the kit's own transitions (M-C-15); toasts M-C-14. **Ambient loops: none** on either page. Reduced motion: the `flags` of the kit (`variants.ts:114-134`): no stagger, no halo, numbers jump | [PM:§3, §5.3, §5.4, §8, §9.4] |
| PG-10 | i18n | Two new namespaces, one file each in `packages/shared/src/i18n/en/`: `usersRoles` (`users-roles.ts`) and `pairedDevices` (`paired-devices.ts`), registered in `packages/shared/src/i18n/index.ts:54-68`. Navigation labels: `shell.nav.adminGroup`, `shell.nav.usersRoles`, `shell.nav.pairedDevices`. Role labels reuse `common.roles.*`; permission labels are those row 26 (W16) adds. Key families are listed per page | [PS:§14.11] |
| PG-11 | Refusals and outages | A 403 on a mutation: the dialog closes and the denied toast of section 6.2 shows. An unreachable server: LB-6; the dialog stays open | sections 6.2, 8.1 |

**States every panel of both pages has:**

| State | When | What is shown | Test ID suffix |
|---|---|---|---|
| Live mode only | Simulated mode (direct URL; the entries are hidden) | Page-level kit `EmptyState`: the page icon, "This page needs the Core server", one sentence that Simulated mode has no users or device registry, and, when the mode is selectable, a button "Switch to Live mode" (section 3.3) | `-live-only` |
| Loading | First fetch | Kit `Skeleton` rows in the table's place, with the gold shimmer of M-C-24; three rows for users, three for devices. The header and panel frames are already in place, so nothing jumps when data arrives (cross-fade 160 ms) | `-loading` |
| Empty | The list is empty | Kit `EmptyState` inside the panel | `-empty` |
| Error | The fetch failed (not 403) | Kit `Alert` `danger` inside the panel with a Retry button on the existing cooldown (`useRetryCooldown`, `packages/shared/src/realtime`) | `-error`, `-retry` |
| Forbidden | The fetch answered 403 (a stale hint; the guard normally prevents the visit) | Page-level `EmptyState`: "Your role does not include this page." and a link to the Dashboard. The shell leaves the page when the permission push arrives (section 6.3) | `-forbidden` |
| Offline | The link is down | The last data stays, action buttons are disabled, the shell shows its notice (section 3.5) | — |
| Populated | Otherwise | The regions below | — |

### 10.2 Users & Roles (`/admin/users`, permission `USER_ADMIN`, row 75 (W77))

Operations: 11 `listUsers`, 10 `getRoleMatrix`, 12 `assignUserRole`, 13 `enableUser`, 14 `disableUser` [SP:§7.6]. No operation creates or deletes a user.

| Region | Components | Content |
|---|---|---|
| Header | `PageHeader` with `UsersRound`; status slot: a `Chip` | Title "Users & Roles"; subtitle "Operators, their roles and what each role may do"; chip "n users · m enabled" (`AnimatedNumber`) |
| Panel "Operators" (hero; full width) | `Panel`; kit `Table` | One row per operator. Columns: **Operator** (`Avatar` with initials, display name, username in mono, and a `Chip` "You" on the caller's own row); **Role** (`Chip` soft in the role tone the Login list uses); **Status** (`Chip` with dot: Enabled `success`, Disabled `default`); **Active sessions** (count, mono); **Last sign-in** (date or the empty-date text); **Role changed** (date); **Actions** (`Dropdown` on an icon-only ghost `Button`: "Change role…", then "Disable user…" or "Enable user") |
| Panel "Roles and permissions" (full width, below) | `Panel`; kit `Table` with `Check` and `Minus` icons, as the existing matrix (`rbac-panel.tsx:3,80`); a `Chip` "Read-only" in the panel header | Twelve permission rows by three role columns from `getRoleMatrix`; the matrix cannot be edited (`editable: false`, [SP:RB-9]) |

**The role-change dialog** (kit `Modal` with a form):

| Element | Behaviour |
|---|---|
| Title and target | "Change role" and the operator's name and username |
| Role choice | Kit `RadioGroup` with the three roles; the current role is preselected |
| What changes | Two short lists computed from the matrix: "Gains" and "Loses", by permission label. Below: "The operator stays signed in. The change applies at once on the web console and on paired devices." |
| Own row | A warning `Alert`: "You are changing your own role. You may lose access to this page." |
| Reason | Optional `TextField` with `TextArea` |
| Confirm | Disabled until another role is chosen. Busy per LB-1 while the mutation runs |
| **Last administrator** | Hint: when the target is the only enabled holder of `USER_ADMIN`, the roles without that permission are disabled with the description "At least one enabled user must keep user administration." Authority: the server's 409 `LAST_ADMIN` [SP:RB-8] is shown as an inline `Alert` `danger` with the same sentence; the dialog stays open and nothing changed |
| Success (200) | The dialog closes; success toast "Role of {{name}} is now {{role}}"; the list is refetched; the row's role chip morphs (M-C-10) and the row gets the highlight |
| 404 | Toast and refetch |

**Enable and disable** (kit `AlertDialog`, in the pattern of `cancel-dialog.tsx`):

| Dialog | Content | Result |
|---|---|---|
| Disable | Status `danger`. "Disable {{name}}? Their sessions end at once on every client, and they cannot sign in until enabled again." Optional reason. On the caller's own row: "You will be signed out." | 200: status chip morphs to Disabled with one halo; toast. 409 `LAST_ADMIN`: the inline Alert, as above; the menu item is also disabled by the hint |
| Enable | Neutral status. "Enable {{name}}? They can sign in again." | 200: chip morphs to Enabled (colour only); toast |

**Live update.** `admin.changed` with `USERS` refetches the list: a role changed by another supervisor, a sign-in elsewhere (active sessions, last sign-in) and an enable or disable appear without a reload; changed cells morph, changed rows are highlighted.

**Test IDs** (prefix `ur-`): `page-users-roles`; `ur-summary`; `panel-users`, `panel-matrix`; `ur-users-table`, `ur-user-<operatorId>`, `ur-self`, `ur-role-<operatorId>`, `ur-status-<operatorId>`, `ur-actions-<operatorId>`, `ur-change-role-<operatorId>`, `ur-disable-<operatorId>`, `ur-enable-<operatorId>`; `ur-role-dialog`, `ur-role-option-<ROLE>`, `ur-role-diff`, `ur-role-reason`, `ur-role-confirm`, `ur-role-cancel`, `ur-role-error`; `ur-disable-dialog`, `ur-disable-reason`, `ur-disable-confirm`, `ur-disable-error`; `ur-enable-dialog`, `ur-enable-confirm`; `ur-matrix`, `ur-matrix-readonly`, `ur-grant-<ROLE>-<PERMISSION>`; `ur-loading`, `ur-empty`, `ur-error`, `ur-retry`, `ur-forbidden`, `ur-live-only`.

**i18n key families** (`usersRoles.*`): `title`, `subtitle`, `summary`, `users.*` (panel title, column headers, `you`, `enabled`, `disabled`, `neverSignedIn`), `actions.*`, `roleDialog.*`, `disableDialog.*`, `enableDialog.*`, `lastAdmin`, `matrix.*`, `toasts.*`, `states.*` (`liveOnly`, `empty`, `error`, `forbidden`).

**Enter beats**: header at route enter; "Operators" at 0 ms (hero); its rows staggered; "Roles and permissions" at 120 ms.

### 10.3 Paired Devices (`/admin/devices`, permission `PAIRING_MANAGE`, row 76 (W81))

Operations: 15 `issuePairingCode`, 16 `getPairingCodeStatus`, 17 `cancelPairingCode`, 19 `listPairedDevices`, 20 `revokeDevice` [SP:§7.7].

| Region | Components | Content |
|---|---|---|
| Header | `PageHeader` with `TabletSmartphone`; status slot: a `Chip` | Title "Paired Devices"; subtitle "Tablets and phones allowed to operate this Core"; chip "n paired · m online" |
| Panel "Pair a device" (hero; 5 of 12 columns from 1280 px, full width below, first) | `Panel`; `Button`; `QRCodeSVG`; `SlidingNumber`; `TextScramble`; `Alert`; `Chip` | The issue-code panel, states below |
| Panel "Devices" (7 of 12 columns from 1280 px) | `Panel`; `ToggleButtonGroup`; kit `Table`; `Chip`; `Button`; `EmptyState` | The device list, below |

**The issue-code panel.** At most one code is active on the server; a new issue cancels the previous one [SP:PR-P3]. The server returns the code once [SP:PR-P6]; the feature keeps it in memory, at most for the life of the page load: leaving the page and coming back inside the console shows it again, a reload does not [SP:§6.4 step 1]. It is dropped at once at a sign-out, a session end or the loss of `PAIRING_MANAGE` (PG-6a); the panel then shows "Active, code not known". It is never written to web storage, the URL, the clipboard or the query cache. While the code is on a projected screen the room can read it for up to 300 s; it is single use, five wrong attempts close it, and "Cancel code" closes it at once (accepted by row 20, residual R-17).

| State | Shown when | Content | Actions |
|---|---|---|---|
| Idle | No active code | Three numbered lines: issue a code here; type it on the device's Pair screen; the device appears in the list. | Primary `Button` "Issue pairing code" |
| Issuing | The mutation runs | The button is busy (LB-1) | — |
| **Active, code known** | 201 from `issuePairingCode` | The six digits in two groups of three, mono, large, revealed once by `TextScramble` over digits (600 ms; reduced motion: at once). Beside them the QR: `QRCodeSVG` with the server's `qrPayload` as its value (the string `DEMS-PAIR:1:` and the code, [SP:PR-P7]), 200 px, error-correction level M, dark modules on a light tile with a quiet zone, `role="img"` with the label "QR code of the pairing code". Caption: "Type the six digits on the device. QR scanning is not part of this demo." (true to [DEC:DR-02]). Below: the **countdown to expiry**, minutes and seconds in `SlidingNumber`, from `expiresAt` and the Live clock; a hairline that shrinks with `scaleX` (the toast countdown pattern of M-C-14; composite-only); "n attempts left" from `getPairingCodeStatus`. The hairline is gold, amber from 60 s, red from 15 s; each step plays one halo pulse (R8) | Outline `Button` "Cancel code": calls `cancelPairingCode`; back to Idle with a toast. **This is the panel's close action**: the code never stays valid on the server while nobody can see it by this console's doing |
| Active, code not known | `getPairingCodeStatus` reports an active code that this page load did not issue (a reload, or another supervisor) | "A pairing code is active (issued by {{name}}, expires in mm:ss). The code itself is shown only once." | "Issue new code" with the description "This replaces the active code."; "Cancel code" |
| Redeemed | After `admin.changed`: the status has no active code and the device list holds a device whose `pairedWithCodeId` is this code | The digits and the QR exit (R2). A `Chip` `success` "Paired" pops with `transitions.completion` (a completion moment, P4 of [PM:§1]). "{{device ID}} · {{device name}} is paired." The new row in the list is highlighted | "Issue another code"; the state returns to Idle after 4 s |
| Expired | The countdown reached zero, or the newest `PAIRING_CODE_CLOSED` audit row of this code in the replica says `EXPIRED` | The digits and the QR dim to 0.35; `Alert` `warning` "The code expired." | "Issue pairing code" |
| Closed after wrong attempts | That audit row says `EXHAUSTED` | `Alert` `danger` "The code was closed after five wrong attempts." | "Issue pairing code" |
| Cancelled elsewhere | That audit row says `CANCELLED` and this page did not cancel | `Alert` `default` "The code was cancelled." | "Issue pairing code" |
| Error | The issue call failed (not 403) | Inline `Alert` `danger` with Retry | Retry |

**The device list.**

| Element | Specification |
|---|---|
| Filter | `ToggleButtonGroup`: All (default), Paired, Ended (REVOKED and UNPAIRED) |
| Order | PAIRED first, then by `pairedAt`, newest first |
| Columns | **Device** (ID in mono, name below); **Platform and app version**; **State** (`Chip`: PAIRED `success`, REVOKED `danger`, UNPAIRED `default`) with a dot for `online` (a static dot: `success` when online, muted when not; no loop); **Operator** (the signed-in operator's name from the replica, or a dash); **Paired** (date, and "code issued by {{name}}"); **Last seen** (relative time, refreshed every 30 s without animation, so a device that was reinstalled and never returns is visibly stale, [SP:§6.7]); **Ended** (revoked or unpaired date, the revoker and the reason, when present); **Action** (`Button` `danger-soft` "Revoke…", PAIRED rows only) |
| Empty | "No device has been paired yet." and a line pointing to the issue panel |
| **Live update when a device pairs** | `admin.changed` with `DEVICES` refetches the list. The new row enters as a list insertion (M-C-07: opacity 0 → 1, `y -12 → 0`, scale 0.98 → 1, the rows below pushed by `layout`) with the gold highlight. A state change morphs the chip; PAIRED → REVOKED plays one halo. `online` and the operator change in place |

**The revoke dialog** (kit `AlertDialog` with a form, in the pattern of the End Session dialog, `features/session-monitor/action-bar.tsx:535-611`):

| Element | Behaviour |
|---|---|
| Text | "Revoke {{device ID}}? The device is signed out at once and must be paired again. A recording in progress continues on the Core." |
| Reason | **Mandatory**, at least 5 characters [SP:§7.7 operation 20]; `TextField` with `TextArea` and `FieldError`, validated on submit |
| Buttons | Ghost "Keep device"; `danger` "Revoke device", busy per LB-1 |
| 200 | The dialog closes; toast "{{device ID}} revoked"; the row morphs |
| 422 `INVALID_REASON` | The field's error; the dialog stays |
| 409 `INVALID_STATE`, 404 | The dialog closes; info toast "The device was already revoked or unpaired."; refetch |

**Test IDs** (prefix `pd-`): `page-paired-devices`; `pd-summary`; `panel-issue`, `panel-devices`; `pd-issue`, `pd-code`, `pd-qr`, `pd-countdown`, `pd-expiry-bar`, `pd-attempts`, `pd-cancel-code`, `pd-code-active-elsewhere`, `pd-issue-new`, `pd-code-redeemed`, `pd-code-expired`, `pd-code-closed`, `pd-code-cancelled`, `pd-issue-error`; `pd-filter`, `pd-devices-table`, `pd-device-<deviceId>`, `pd-state-<deviceId>`, `pd-online-<deviceId>`, `pd-operator-<deviceId>`, `pd-last-seen-<deviceId>`, `pd-revoke-<deviceId>`; `pd-revoke-dialog`, `pd-revoke-reason`, `pd-revoke-confirm`, `pd-revoke-cancel`; `pd-loading`, `pd-empty`, `pd-error`, `pd-retry`, `pd-forbidden`, `pd-live-only`.

**i18n key families** (`pairedDevices.*`): `title`, `subtitle`, `summary`, `issue.*` (steps, button, `caption`, `expiresIn`, `attemptsLeft`, `cancel`, `activeElsewhere`, `issueNew`, `redeemed`, `expired`, `closed`, `cancelled`, `error`), `devices.*` (panel title, column headers, `filter.*`, `state.*`, `online`, `offline`, `lastSeen`, `empty`), `revoke.*`, `toasts.*`, `states.*`.

**Enter beats**: header at route enter; "Pair a device" at 0 ms (hero); "Devices" at 120 ms, its rows staggered.

**The QR in tests.** No decoder is installed. The render test replaces `qrcode.react` by a stub and asserts that the component received exactly the `qrPayload` of the issue answer, and that this payload is the fixed prefix plus the six digits shown. This settles the note of [AN:472] for row 21.

---

## 11. API Reference page in both modes

Answers impact question 23 and closes open point 3. The page builds the OpenAPI document in the browser from the shared registry [SP:§7.4]; today it routes Try-it by a two-value `mode`: health to the network, everything else to the simulator (`apps/core-web/src/features/api-reference/sim-fetch.ts:105-122`).

| ID | Rule | Source |
|---|---|---|
| AR-1 | **Registry model (for rows 27 and 98 (W19, W22, W27, W83)).** The two-value `mode` stays and means what [SP:§7.19] states (accepted, [DEC:D15]): `simulated` = the in-app simulator can answer it (the nine design-book operations), `live` = only a service answers it (the other 66). Each entry also names its answering services: `getServiceHealth` is answered by mock-core and by the Core server; every other operation by the Core server. The document builder gets a scope: **offline** (what a client can call without the Core server: health and the nine, ten operations) and **all** (75). The committed `openapi.json` and the drift test use **all** [SP:AC-B-11] | [SP:§7.19, GS-19] |
| AR-2 | **Simulated mode: the page is as today.** The document has the offline scope: ten operations, `LIVE` on health, `SIMULATED` on nine, the existing "Show simulated endpoints" switch (`server-strip.tsx:67`), Try-it routed as today. One addition: a second switch "Show Core-server endpoints", off by default. When on, the other 65 operations are listed with a neutral badge `CORE SERVER`; Try-it on one of them is **rejected before any request** with "This operation is answered by the Core server. Switch to Live mode to try it." The page never fabricates an answer for them | [R3:331] |
| AR-3 | **Live mode.** The document has the scope **all**. Every operation carries `LIVE`. The server shown is the page's own origin (section 4.2). The "Show simulated endpoints" switch is hidden. Try-it sends a `{page origin}/api/v1/*` request to the network, except for the six operations of AR-3a; the browser attaches the session cookie, so the call runs with the signed-in operator's role and is audited like any other call. `sim.request` is not called. A URL outside that prefix is rejected as today (`sim-fetch.ts:97-103`) | [BP:372] |
| AR-3a | **Deny list in Live mode.** Try-it of operations 2 `signIn`, 7 `setBiometricEnrollment`, 8 `signInWithBiometric`, 15 `issuePairingCode`, 18 `redeemPairingCode` and 23 `rotateDeviceCredential` is **rejected before any request**, in the message pattern of AR-2: "This operation carries or returns a secret and cannot be tried from the reference page." These are the six operations whose body or answer holds a secret [SP:§7.7]. Through this page, operation 18 would hand a device credential to a viewer that script can read; operation 2 would put a password into the request editor and replace the console's own session; operation 15 would replace the active code and show it outside the rules of section 10.3. The six stay documented; only Try-it is refused | [SDR:SD-16]; [DEC:D16] |
| AR-4 | In Live mode a warning `Alert` sits above the renderer: "Try it sends real requests to the Core server as {{operator}}. Commands change the Core's state and are recorded in the audit log." | [SP:SR-45] |
| AR-5 | Examples in Live mode take their identifiers from the replica (the open session, the first sealed evidence item), never from the frozen example identifiers, which do not exist on another day | [SP:ENG-19]; [DEC:F20] |
| AR-6 | The service banner reads the heartbeat of the one Live socket and the health answer, which names `dems-core-server`, its version and its readiness | [SP:§7.4] |
| AR-7 | **The Realtime panel in Live mode opens no second socket.** It lists the last five messages of the app's socket by type: `heartbeat` in full, as today; `snapshot` and `delta` as type, epoch, revision and the names of the slices they touch; meter frames as a rate. It never prints a state payload. Its connect switch is hidden, because it would disconnect the console. In Simulated mode the panel is unchanged | CL-7; [SP:§9.5] |
| AR-8 | "Download openapi.json" and "Copy" give the document of the current view | [PS:§14.9] |
| AR-9 | The page's own log prints method, path and status only (CL-6a). After Try-it calls no value in web storage holds a request body or an answer: `persistAuth: false` is already set (`scalar-config.ts:30`), and row 99 (W84) tests the rest (CA-11, AC-C-103) | [SDR:SD-16, SD-23] |

Sequencing risk for rows 18 and 21 (GC-01): `apps/core-web/src/test/scalar-config.test.ts:70` asserts ten operations through the page's document function. It stays green from row 27 (W19, W22, W27) on only if the shared builder keeps returning the offline scope for the call the page makes today. Otherwise that test changes by design in row 27 (W19, W22, W27), like the shared `openapi.test.ts` [DEC:F5].

---

## 12. Tests

### 12.1 How the 61 simulator-dependent test files stay green and untouched

28 web and 33 mobile test files import the simulator [SP:AC-B-59]; [R3:670]; [R4:37]. They construct it directly (24 `createSim` calls in 19 web files; 34 mobile files through `createTestSim` and the harnesses, [R3:615]; [R4:65]) and drive it with `tick`, `flush`, a manual clock and `store.setState`.

| ID | Mechanism | Why it protects the tests |
|---|---|---|
| TS-1 | No file under `packages/shared/src/sim/` is written, except the additive values of row 26 (W16) in `vocabulary.ts` and `auth.ts` [SP:AC-B-62] | `createSim`, `SimProvider`, `useSim`, `useSimActions`, `Sim` and every selector are byte-identical |
| TS-2 | `useCoreActions()` returns `sim.actions` itself for a simulator (CL-12), and `settle` runs its continuation before it returns (CL-25) | A test that asserts right after `act(() => ...)` sees the same order of effects as today |
| TS-3 | The mode is derived from the object in `SimContext`: a simulator means Simulated. No test has to provide a mode | Every mode-dependent branch takes its Simulated side in the existing tests |
| TS-4 | `createAppRouter({ sim, queryClient, socketFactory? })` keeps its signature (`router.tsx:18-43`); the new context member is optional (MD-4) | The route tests build the router as today |
| TS-5 | `AppProviders` keeps its props (`sim`, `simOptions`, `heartbeatSocketFactory`); `RuntimeContract` gains only an optional member (MP-9); `CoreLinkSource` is widened, not changed | The mobile harnesses and the fake runtime of the guard tests stay valid [R4:346] |
| TS-6 | New controls that Simulated mode also shows are additive: the mode indicator of the web shell. The mode selector is not rendered in tests (MD-4) | CA-09; row 63 (W54) proves it by running the shell tests unchanged |
| TS-7 | Existing i18n keys and strings do not change; new text uses new keys (for example the Settings hint, section 9.5) | Tests that assert copy or scan for missing keys stay valid |
| TS-8 | The web matrix panel keeps its nine-row list in Simulated mode (section 6.1), so the row-count assertion of `security-audit.test.tsx:409` holds after row 26 (W16) | Finding FC-3 |
| TS-9 | Gate: `git diff --stat acaff20` over the 61 files prints nothing but recorded changes [SP:AC-B-59]; each client row runs its folder's existing tests before and after | AC-C-101 |

Two test files outside the 61 pin facts that change by design and are named so that no row is surprised: the shared `openapi.test.ts` [DEC:F5] and the web `src/test/scalar-config.test.ts` (section 11).

### 12.2 The contract-checked fake transport (HB-11)

One test double for Vitest and jest, in `packages/shared/src/live/testing/` [AN:486].

| ID | Rule |
|---|---|
| TS-10 | It provides a `fetch` and a socket factory of the shapes the client and the socket client take, so a test builds a real Live source on top of it. No interception layer and no network |
| TS-11 | **Contract-checked requests**: the fake `fetch` matches method and path against the registry and validates the body with the operation's request schema; a mismatch fails the test |
| TS-12 | **Contract-checked responses**: a scripted answer is validated with the operation's response schema for its status (`validateCoreApiResponse`) before it is returned; a scripted socket message with the realtime union. A test cannot script what the server may not send |
| TS-13 | Helpers script the common sequences: an anonymous start, a signed-in start with a snapshot, a command answered with a revision followed or preceded by its delta, a refusal envelope, an outage, the four control messages, a close with a code |
| TS-14 | It records every call (method, path, headers, body) for assertions such as "no credential in a URL" and "no demo operation was called" |
| TS-15 | It is imported only from test and harness files; a static test asserts that no production file imports `@dems/shared/live/testing` |
| TS-16 | Mobile adds jest mocks for `expo-secure-store` (an in-memory map with a switch that makes protected reads prompt, fail or pass) and, if `jest-expo` does not supply one, for `expo-device`. They go into `apps/mobile/jest.setup.ts`, beside the existing mocks [R4:344]; no blueprint row lists that file (section 17.2, FC-6) |

### 12.3 What each client row must prove

| Rows | Proof |
|---|---|
| 58 (W12) | AC-C-01 to 05: every operation callable, platform-neutral, validated, no secret in a URL, and the emulator proof |
| 59 (W30) | AC-C-15, 16: resync, close codes, reconnect; the existing heartbeat client tests unchanged |
| 60 (W18, W31, W44) | AC-C-06 to 14, 17, 39, 54: Simulated isolation, replica, structural sharing, `settle`, atomicity, error rebuilding, throttle, time-out, the fake transport itself |
| 62 (W05, W50, W54) | AC-C-19 to 23, 25, 33 to 37, 40, 41, 46, 102, 106: the mode resolver in every build, the proxy for HTTP and the socket with its negative test, unchanged guards and endpoint tests, both modes loading on the lane, the clearing of the query cache |
| 63 (W54) | AC-C-24, 26, 49 to 51, 59: indicator, link notice, role notice, navigation gating |
| 64 (W55) | AC-C-38, 42 to 45, 47, 104, 107, 110: cookie session, trust line, security key, sign-in states, notices, the disclosure and its wording, the limit toast; one live sign-in on the lane, with the browser and its version recorded |
| 66 to 74 (W63 to W65, W69 to W71, W75, W76; web pages) | For the folder: (a) its existing tests pass and their files are not in the diff; (b) one Live test per settle site of section 7.3, covering success, the site's refusal and an outage (AC-C-48, 56, 59); (c) for one site of the row, the pending test (AC-C-57, 58); (d) the row's specific criteria (AC-C-52, 60, 61, 109); (e) one live check on a lane with a screenshot |
| 75, 76 (W77, W81) | AC-C-86 to 99; row 76 (W81) also AC-C-106 and 107 |
| 77 (W13) | AC-C-84, 85; the debug build starts in Simulated mode on each emulator [BP:350] |
| 78 (W15, W51) | AC-C-28, 29, 32, 66, 78, 79; the three sources and the release fallback |
| 79 (W15, W56) | AC-C-65, 67 to 71, 105, 108 |
| 80, 81, 82 (W57, W59, W60) | AC-C-72, 104, 110; AC-C-75 to 77, 80, 81; AC-C-31, 73, 74 |
| 84 to 97 (W66 to W68, W72 to W74, W78 to W80, W82; mobile screens) | As the web page rows: (a) to (c) with jest and the fake transport; (d) AC-C-30, 62, 63, 83; (e) one device check on an emulator with a screencap |
| 99 (W84) | AC-C-18, 100, 103, 107 |
| 102, 104, 106 to 109 (W87, W89, W94 to W97) | AC-C-27, 55, 56, 64, 82, 101 |

---

## 13. Acceptance criteria

Each criterion is testable by a test, a command or an observable. "Row" is the provisional row that must make it pass [BP:330-372], with its work rows in brackets [PL:§21]; "SC" is the success criterion of [SP:§17.1]. Rows 18 and 21 map each criterion to a work row.

### 13.1 Shared client layer

| ID | Criterion | Tested by | Row | SC |
|---|---|---|---|---|
| AC-C-01 | Every registry operation can be called through the typed client; the number of callable operation IDs equals the registry's count (75) | Unit test in `packages/shared/src/client` | 58 (W12) | SC3, SC6 |
| AC-C-02 | No file under `packages/shared/src/client`, `src/live` or the new files of `src/realtime` names `node:`, `react-native`, `expo`, `window` or `document` | Static test, as the simulator has [AN:519] | 58-60 (W12, W18, W30, W31, W44) | SC3 |
| AC-C-03 | A 2xx body that violates its schema is returned as `CONTRACT_VIOLATION` and never reaches the store; a non-2xx body parses as `ApiError` | Unit test with the fake transport | 58 (W12) | SC6 |
| AC-C-04 | In the call log of the client tests no URL contains a token, a credential or a code; the web client sends no `Authorization` header; the mobile client sends exactly one | The fake transport's log | 58 (W12) | SC10 |
| AC-C-05 | On an emulator, through `adb reverse`, one GET, one POST with a body and one error envelope are answered and validated by zod | Device check: screencap and log lines | 58 (W12) | SC3 |
| AC-C-06 | Simulated isolation: with a simulator in the context, `useCoreActions()` returns `sim.actions` itself; over the recording scenario, spies count zero `fetch` calls and zero socket constructions | Shared test [BP:333] | 60 (W18, W31, W44) | SC8 |
| AC-C-07 | Live replica: a `snapshot` and the deltas of the recording scenario drive the selectors to the values the simulator has at the same instants | Shared test | 60 (W18, W31, W44) | SC3 |
| AC-C-08 | Structural sharing: after a `delta` that replaces one slice, every other slice reference is unchanged; a `snapshot` equal to the current state changes no reference; unchanged array elements keep their references | Shared test | 60 (W18, W31, W44) | SC3 |
| AC-C-09 | `settle` with a plain value runs `ok` and `done` before it returns; with a synchronous throw it runs `fail` and `done` before it returns | Unit test | 60 (W18, W31, W44) | SC8 |
| AC-C-10 | Own-command atomicity: in both arrival orders the continuation sees the command's effect, and no subscriber is notified between the update that holds the effect and the continuation | Unit test with the fake transport | 60 (W18, W31, W44) | SC3 |
| AC-C-11 | Error rebuilding: a table of envelopes yields `SimPermissionError`, `SimTransitionError` and `SimNotFoundError` (checked with `instanceof`) with the expected `code`, `permission`, `from`, `event`; result-union actions resolve with `ok: false` and the mapped reason | Unit test | 60 (W18, W31, W44) | SC4 |
| AC-C-12 | A rejected Live action that nobody awaits raises no unhandled-rejection event and is reported once through `onError` | Unit test | 60 (W18, W31, W44) | SC7 |
| AC-C-13 | `touchSession`: ten activity calls within 60 s send one request at once and one at the end of the window; no activity sends none; a successful POST restarts the window | Unit test with fake timers | 60 (W18, W31, W44) | SC4 |
| AC-C-14 | Settle time-out: when the delta of the answered revision does not arrive within 2,000 ms, one `resync` is sent, the action resolves, and the link reads RESYNCING until the snapshot | Unit test | 60 (W18, W31, W44) | SC3 |
| AC-C-15 | A revision gap or a new epoch sends `resync` at most once in 2 s; the snapshot replaces the replica | Unit test | 59, 60 (W18, W30, W31, W44) | SC3 |
| AC-C-16 | Close codes: 4401 moves `auth.status` away from SIGNED_IN and records the reason; 4403 calls the revocation handler; 1001, 1013 and 4408 reconnect with the existing backoff constants | Unit test with the fake socket | 59 (W30) | SC4, SC5 |
| AC-C-17 | The fake transport refuses a scripted response that violates the contract: the test fails with a named error | Unit test of HB-11 | 60 (W18, W31, W44) | SC7 |
| AC-C-18 | One socket per client in Live mode: with the API Reference page open, no second socket is constructed | Web test with the fake transport | 62, 99 (W05, W50, W54, W84) | SC3 |

### 13.2 Mode

| ID | Criterion | Tested by | Row | SC |
|---|---|---|---|---|
| AC-C-19 | Web dev build, no stored key, no preselection: Simulated; the simulator is constructed and the Live source module is not requested | Unit test of the resolver and the entry | 62 (W05, W50, W54) | SC8 |
| AC-C-20 | With the packaged flag, or in a production build, the resolver returns SIMULATED whatever the stored key and the environment say, and no selector is rendered | Unit test with `vi.stubEnv` | 62 (W05, W50, W54) | SC8 |
| AC-C-21 | With `dems.core.mode.v1` = `LIVE` in a dev build the Live source is created; after a Live session the values under `dems.sim.v1` and `dems.auth` are byte-equal to before | Web test | 62 (W05, W50, W54) | SC8 |
| AC-C-22 | `VITE_DEMS_CORE_MODE=live` with no stored key selects Live; a stored `SIMULATED` wins over it | Unit test | 62 (W05, W50, W54) | SC3 |
| AC-C-23 | Switching the mode shows the confirmation, signs out, writes the key and reloads to `/login` | Web test with the reload stubbed | 62, 64 (W05, W50, W54, W55) | SC8 |
| AC-C-24 | The indicator `shell-mode` reads SIMULATED with the simulator, LIVE with the Live source and the link up, LIVE · OFFLINE with the link down; it is rendered at every shell width | Web test at three widths | 63 (W54) | SC3, SC8 |
| AC-C-25 | No silent fallback: Live mode with the server unreachable at start shows the Login page with the offline Alert, Retry and "Use Simulated mode"; the simulator is not constructed and the replica holds no evidence, session or operator | Web test with a failing fake transport | 62, 64 (W05, W50, W54, W55) | SC8 |
| AC-C-26 | Link lost while signed in: one persistent toast, the indicator LIVE · OFFLINE, meters at "no signal", a command rejects without a request; after the link returns the replica equals a fresh snapshot | Web test | 63 (W54) | SC3 |
| AC-C-27 | A client in Simulated mode sends nothing to the Core server | The server log [SP:AC-B-63]; the spies of AC-C-06 | 109 (W97) | SC8 |
| AC-C-28 | Mobile: the default source is SIMULATED; `isCoreLinkSourceAvailable('LIVE', false)` is false; `effectiveCoreLinkSource('LIVE', false)` is SIMULATED; a stored LIVE hydrates as SIMULATED in a release build | jest, beside the existing release-gate test | 78 (W15, W51) | SC8 |
| AC-C-29 | Mobile: in LIVE mode the simulator is not started; `dems.sim.v1` and `dems.mobile.auth.v1` in AsyncStorage are unchanged after a Live session | jest | 78 (W15, W51) | SC8 |
| AC-C-30 | Mobile: the two Core chips read "Simulated" in SIMULATED and in HEARTBEAT mode and "Live" only in LIVE mode | jest | 84, 85 (W66) | SC8 |
| AC-C-31 | Mobile: selecting LIVE in Settings shows the dialog, signs out and lands on `/pair` (no credential) or `/login` (credential) | jest with the route harness | 82, 97 (W60, W82) | SC5 |
| AC-C-32 | The debug parameter `core=LIVE` sets the source in a debug build and does nothing in a release build; `scenario=` is ignored in LIVE mode | jest | 78 (W15, W51) | SC7 |

### 13.3 Web transport, CORS and the content-security policy

| ID | Criterion | Tested by | Row | SC |
|---|---|---|---|---|
| AC-C-33 | With the dev server and the backend running, `curl -si http://127.0.0.1:5173/api/v1/health` answers 200 with `service: dems-core-server` and no `access-control-allow-` header | The command, in the row's live check | 62 (W05, W50, W54) | SC3, SC10 |
| AC-C-34 | In Live mode the browser's socket to `/ws` on the dev server's port receives `hello` and `heartbeat`, and a source edit still hot-reloads the page | Observable on the lane | 62 (W05, W50, W54) | SC3 |
| AC-C-35 | `git diff acaff20 -- apps/core-web/src/lib/packaged-csp.ts apps/mock-core` prints nothing; `packaged-csp.test.ts` passes unchanged | The command and the test run | 62 (W05, W50, W54) | SC8 |
| AC-C-36 | `core-endpoint.test.tsx` passes unchanged; new tests cover the Live row of section 4.2 | Test run | 62 (W05, W50, W54) | SC8 |
| AC-C-37 | Over a Live web session every request goes to the page's own origin | The browser's network log in the live check; the fake transport's log | 62, 106 (W05, W50, W54, W95) | SC10 |

### 13.4 Web sign-in and session

| ID | Criterion | Tested by | Row | SC |
|---|---|---|---|---|
| AC-C-38 | After a Live sign-in, `document.cookie` does not show the session cookie (`dems_session_<port>`), no value in `localStorage` or `sessionStorage` starts with `ses_`, and `dems.auth` is not written | Web test; the live check | 64 (W55) | SC10 |
| AC-C-39 | For a `SignInStatus` with n attempts remaining and a `lockedUntil`, `selectLockout` on the replica returns the same `locked`, `lockedUntil` and `attemptsRemaining` | Unit test | 60, 64 (W18, W31, W44, W55) | SC4 |
| AC-C-40 | A reload while signed in returns to the same route without credentials; a reload after the server ended the session lands on `/login` | Web test; the live check | 62, 64 (W05, W50, W54, W55) | SC3 |
| AC-C-41 | `git diff acaff20 -- apps/core-web/src/routes/_app.tsx apps/core-web/src/routes/login.tsx apps/core-web/src/routes/_app/session/new.tsx` prints nothing; `routes.test.tsx` passes unchanged; a Live route test sends an anonymous visit to `/login` with `redirect` | The command and the tests | 62 (W05, W50, W54) | SC8 |
| AC-C-42 | The trust line shows the Simulated strings with the simulator and the Live string with the Live source; the Live string contains neither "simulated" nor "paired" | Web test | 64 (W55) | SC8 |
| AC-C-43 | `login-security-key` is in the DOM in Simulated mode and absent in Live mode | Web test | 64 (W55) | SC4 |
| AC-C-44 | Wrong password, lockout (423 with a countdown) and success behave as section 5.5 says; the password state is empty once the request is sent | Web test with the fake transport | 64 (W55) | SC4 |
| AC-C-45 | `session.ended` with `IDLE_EXPIRED` leads to `/login?redirect=<href>` with the expired notice; `ABSOLUTE_EXPIRED` shows the 8-hour sentence; `USER_DISABLED` shows the disabled Alert | Web test | 63, 64 (W54, W55) | SC4 |
| AC-C-46 | After a sign-in and after a sign-out the socket is a new connection; the socket after a sign-out receives no `state` message | Web test with the fake socket | 62 (W05, W50, W54) | SC4 |
| AC-C-47 | The demo-operator disclosure is hidden while `dems.presentation.v1` is on; in Live mode it shows no role chip; the server's presentation setting is copied into the flag while signed in | Web test | 64 (W55) | SC10 |

### 13.5 RBAC on the clients

| ID | Criterion | Tested by | Row | SC |
|---|---|---|---|---|
| AC-C-48 | A 403 `NOT_PERMITTED` shows the denied toast that names the required role, and the control returns to idle | One Live test per page row and per screen row | 66-74, 84-97 (W63 to W76, W78 to W80, W82) | SC4 |
| AC-C-49 | `session.updated` changes the gated controls without a reload or a sign-in and shows the role notice | Web test; jest | 63, 78 (W15, W51, W54) | SC4 |
| AC-C-50 | Losing the permission of the current route leaves `/session/new`, `/admin/users` and `/admin/devices` for `/dashboard` on the web, and `/session/new` for `/home` on mobile; every other route stays | Web route test; jest route test | 63, 82, 86 (W54, W60, W67) | SC4 |
| AC-C-51 | The ADMINISTRATION entries are rendered only in Live mode and only with their permission; they appear and disappear on `session.updated` | Web test | 63 (W54) | SC4 |
| AC-C-52 | The Demo Control Panel (web) and the demo controls (mobile) are rendered in Live mode only with `DEMO_CONTROL` and `demoControls`; in Simulated mode they are as today | Web test; jest | 74, 97 (W76, W82) | SC4 |
| AC-C-53 | No production file under `apps/core-web/src/features`, `apps/mobile/src/features` or `apps/mobile/src/auth` imports `useSimActions` or reads `.actions` from a `Sim` | Static test in each app | 64-74, 79-97 (W55 to W57, W59 to W76, W78 to W80, W82) | SC7 |
| AC-C-54 | A 403 `NOT_PERMITTED` causes one `getAuthSession` within 1 s; ten of them cause one | Unit test | 60 (W18, W31, W44) | SC4 |
| AC-C-55 | Two clients: after a role change in the portal, the affected operator's controls change on the web console and on an emulator within 1 s; a now-denied action shows the denied toast on both | Verification row 107 (W96) [SP:AC-B-22] | 107 (W96) | SC4 |

### 13.6 Synchronous sites

| ID | Criterion | Tested by | Row | SC |
|---|---|---|---|---|
| AC-C-56 | Every site ID of section 8 that is not marked "no change" or "not reachable" has a Live test that names the ID | The test report's site-to-test table | 102 (W87) | SC7 |
| AC-C-57 | Pending: with an answer delayed by 1 s, two quick presses send one request, the control shows no spinner at 300 ms and shows its in-button spinner at 500 ms; with an answer after 50 ms no spinner is rendered | One test per client with fake timers | 67, 86 (W64, W67) | SC3 |
| AC-C-58 | The pending state adds no element outside the pressed control | DOM assertion in the test of AC-C-57 | 67, 86 (W64, W67) | SC3 |
| AC-C-59 | Offline: a command rejects at once, five presses show one toast, and no request is sent | One test per client | 63, 78 (W15, W51, W54) | SC3 |
| AC-C-60 | The web audit and log export files are built from all pages of operations 59 and 63: with 450 rows on the fake server the file holds 450 rows | Web test | 73, 74 (W75, W76) | SC3 |
| AC-C-61 | Evidence verification in Live mode calls operation 41 and no demo operation; the verdict shown is the server's | Web test; jest; the fake transport's log | 69, 92 (W69, W74) | SC3 |
| AC-C-62 | Mobile start-recording hand-off: in both arrival orders the monitor opens and no "session busy" toast shows | jest with the fake transport | 86 (W67) | SC3 |
| AC-C-63 | The mobile archive and device-command dialogs show the success toast only after the server's 2xx, and the danger toast on a refusal | jest | 92, 93 (W74, W78) | SC4 |
| AC-C-64 | A session started on one client appears on the other, and a stop on the second appears on the first | Verification row 106 (W95) [SP:AC-B-51] | 106 (W95) | SC3 |

### 13.7 Mobile credentials, sign-in and biometric unlock

| ID | Criterion | Tested by | Row | SC |
|---|---|---|---|---|
| AC-C-65 | After pairing, sign-in and biometric enrolment, AsyncStorage and the runtime log (the persisted `dems.mobile.log.v1` included) contain no string that starts with `dvc_`, `ses_` or `bio_`, and neither the marker password nor the marker pairing code that the test used | jest with the storage mocks; a device log check | 79, 112 (W15, W56, W100) | SC10 |
| AC-C-66 | `expo-secure-store` is imported by exactly one source file | Static test | 78 (W15, W51) | SC10 |
| AC-C-67 | A cold start in LIVE mode on a paired device opens the Login screen | jest; device check | 79 (W15, W56) | SC5 |
| AC-C-68 | Biometric enrolment calls operation 7 only in a password session; in a biometric session the switch is disabled | jest | 79, 97 (W15, W56, W82) | SC5 |
| AC-C-69 | Biometric sign-in sends the stored token with operation 8, stores the rotated token and signs in; a 401 deletes the token and the marker and shows the Alert | jest with the secure-store mock | 79 (W15, W56) | SC5 |
| AC-C-70 | A failed OS check calls operation 9; a cancelled prompt calls nothing | jest | 79 (W15, W56) | SC5 |
| AC-C-71 | The log of row 79 (W15, W56) records, for each AVD, the three observations of MB-8 and the case of MB-5 in use | The row log | 79 (W15, W56) | SC9 |
| AC-C-72 | The Login screen in LIVE mode shows no pairing-code hint and no role chip; its trust line names the device ID | jest | 80 (W59) | SC10 |

### 13.8 Pairing and the gate on mobile

| ID | Criterion | Tested by | Row | SC |
|---|---|---|---|---|
| AC-C-73 | LIVE mode without a credential: the boot route is `/pair`; `/login`, `/home` and `/dev-gallery` are not reachable; `/stack-check` is | jest route tests | 82 (W60) | SC5 |
| AC-C-74 | In Simulated and Heartbeat mode the guards behave as today: the existing guard tests pass unchanged | jest | 82 (W60) | SC8 |
| AC-C-75 | A correct code stores the credential, sets the gate to PAIRED and hands off to `/login`; the code (the test uses a marker code) is in no storage and no log | jest | 81 (W57) | SC5 |
| AC-C-76 | A wrong code shows the Alert with the attempts left; a 423 shows the countdown to `lockedUntil`; neither says why the code failed | jest | 81 (W57) | SC5 |
| AC-C-77 | Cancel before `commitAt` sends no request | jest with fake time | 81 (W57) | SC5 |
| AC-C-78 | `device.revoked`, a close with 4403, or a 403 `DEVICE_REVOKED` deletes the three items, signs out and opens `/pair` with the revoked notice | jest | 78, 82 (W15, W51, W60) | SC5 |
| AC-C-79 | A stored credential that the Core does not know (401 on operation 21) is deleted, and `/pair` shows the "not registered" notice | jest | 78, 82 (W15, W51, W60) | SC5 |
| AC-C-80 | Unpair on the device calls operation 22, deletes the three items and stays on `/pair`; while the link is down it is refused and nothing is deleted | jest | 81 (W57) | SC5 |
| AC-C-81 | With an empty secure store the app opens `/pair`; a new pairing shows a new device ID | jest; the device check of row 108 (W94) | 81, 108 (W57, W94) | SC5 |
| AC-C-82 | A freshly installed app in Live mode cannot leave the Pair screen; it pairs with a code issued in the portal; it appears in Paired Devices; revoking it there returns it to the Pair screen | Verification row 108 (W94) [SP:AC-B-40] | 108 (W94) | SC5 |
| AC-C-83 | The Settings control has three segments; `settings-core-link-LIVE` is disabled in a release build; the existing release-gate test passes unchanged | jest | 97 (W82) | SC8 |
| AC-C-84 | `npm run reverse -w @dems/mobile` maps `tcp:4420`. `device-session.sh` with `DEMS_CORE_HOST_PORT=4421` maps device `tcp:4420` to host `tcp:4421` and removes the rule at the end; with the variable unset it behaves as today | `adb reverse --list` before, during and after | 77 (W13) | SC11 |
| AC-C-85 | The merged release manifest has no cleartext attribute; `app.json` lists seven plugins | grep; the existing plugin-count test | 77 (W13) | SC8, SC10 |

### 13.9 Users & Roles

| ID | Criterion | Tested by | Row | SC |
|---|---|---|---|---|
| AC-C-86 | The page renders the test IDs of section 10.2, with three operators and twelve matrix rows from the fake transport | Render test | 75 (W77) | SC4 |
| AC-C-87 | A role change sends operation 12, closes the dialog, shows the toast and updates the row; the confirm is disabled while the role is unchanged | Render test | 75 (W77) | SC4 |
| AC-C-88 | 409 `LAST_ADMIN` shows the inline Alert, keeps the dialog open and changes nothing; the hint disables the options for the last administrator | Render test | 75 (W77) | SC4 |
| AC-C-89 | Disable and enable send operations 14 and 13 and morph the status chip; disabling the caller's own account warns first | Render test | 75 (W77) | SC4 |
| AC-C-90 | `admin.changed` with `USERS` refetches the list without a reload | Render test with the fake socket | 75 (W77) | SC4 |
| AC-C-91 | The loading, empty, error, forbidden and "Live mode only" states render as section 10.1 says; in Simulated mode the navigation entry is absent | Render test | 75 (W77) | SC8 |

### 13.10 Paired Devices

| ID | Criterion | Tested by | Row | SC |
|---|---|---|---|---|
| AC-C-92 | Issue sends operation 15 and shows six digits, the QR and the countdown; the QR component receives exactly the answer's `qrPayload`, which is the fixed prefix plus the digits shown | Render test with the QR stub | 76 (W81) | SC5 |
| AC-C-93 | The countdown reaches zero at `expiresAt` and the expired state shows | Render test with fake time | 76 (W81) | SC5 |
| AC-C-94 | While a code is active no second issue is offered beside it; "Cancel code" sends operation 17 and returns to Idle | Render test | 76 (W81) | SC5 |
| AC-C-95 | A fresh mount with an active code on the server shows "A pairing code is active" and no digits | Render test | 76 (W81) | SC10 |
| AC-C-96 | The code appears in no web-storage value, no URL and no query-cache entry | Render test that inspects the three | 76 (W81) | SC10 |
| AC-C-97 | `admin.changed` with `DEVICES` after a redeem shows the Paired state in the panel and a new highlighted row in the list | Render test | 76 (W81) | SC5 |
| AC-C-98 | Revoke needs a reason of at least five characters, sends operation 20 and morphs the row to REVOKED; a 409 closes the dialog with the info toast | Render test | 76 (W81) | SC5 |
| AC-C-99 | The loading, empty, error, forbidden and "Live mode only" states render; a refused issue (403) shows the denied toast | Render test | 76 (W81) | SC4 |

### 13.11 API Reference and regression

| ID | Criterion | Tested by | Row | SC |
|---|---|---|---|---|
| AC-C-100 | Simulated mode: the page's document has the ten operations it has today and Try-it routes as today; with "Show Core-server endpoints" on it lists 75, and Try-it of a Core-server operation is rejected without a request. Live mode: 75 operations, all `LIVE`; one Try-it call of `getServiceHealth` answers `dems-core-server`; a URL outside `{page origin}/api/v1` is rejected. The deny list and the storage and log checks of Live mode are AC-C-103 | Web tests; one live call with a screenshot | 99 (W84) | SC6 |
| AC-C-101 | The 61 simulator-dependent test files pass, and `git diff --stat acaff20` over them prints only recorded changes; typecheck and lint exit 0 in every workspace after each client row | The per-workspace runs [SP:AC-B-59] | Every client row; 104 (W89) | SC7, SC8 |

SC1 and SC2 are owned by other rows. SC9 is touched by AC-C-71 only and SC11 by AC-C-84 only.

### 13.12 Criteria added in revision 2

Added from the security design review [DEC:D16]. New IDs continue the list; no ID was renumbered or reused. Revision 2 also changed in place the text of AC-C-38, AC-C-65, AC-C-75 and AC-C-100.

| ID | Criterion | Tested by | Row | SC |
|---|---|---|---|---|
| AC-C-102 | A POST to `/api/v1/auth/sign-in` sent **through the dev server** with a foreign `Origin`, and one with `Origin: http://localhost:5173`, are each answered 403 `ORIGIN_NOT_ALLOWED` by the Core server. The proxy block of `vite.config.ts` has no `headers` option, no `changeOrigin` and no hook that changes a request header | `curl -si -X POST -H 'Origin: <value>'` against the dev server in the row's live check; a static test over the config | 62 (W05, W50, W54) | SC10 |
| AC-C-103 | Live mode: Try-it of operations 2, 7, 8, 15, 18 and 23 is rejected before a request (the fake transport's log shows none) with the message of AR-3a. After Try-it calls of one GET and one POST, no value in `localStorage` or `sessionStorage` holds a request body or an answer, and the page's own log lines hold method, path and status only | Web tests with the fake transport; an inspection of web storage in the row's live check | 99 (W84) | SC10 |
| AC-C-104 | In Live mode the disclosure on the web Login page and on the mobile Login screen carries the plain sentence of WS-9 (C1), shows the three usernames without a role chip or any other server data, and is hidden in presentation mode. In Simulated mode both disclosures are as today | Web test; jest | 64, 80 (W55, W59) | SC10 |
| AC-C-105 | The unprotected biometric item (MB-5 case c) is written only when `isDevice` is false or the build is a debug build. With `isDevice` true in a build that is not a debug build, a failing protected write turns biometric sign-in off and stores no token. While the marker says `protected: false`, no rendered text says that the token is protected by the device's hardware | jest with the secure-store mock, a stubbed `isDevice` and a stubbed build flag | 79 (W15, W56) | SC5, SC10 |
| AC-C-106 | After a sign-out, after `session.ended`, and after a `session.updated` that removes `USER_ADMIN` or `PAIRING_MANAGE`, the query cache holds no `['core', …]` entry and the Paired Devices feature holds no code. A second operator who signs in on the same page load sees no row and no digit of the first | Web test with the fake transport | 62, 76 (W05, W50, W54, W81) | SC10 |
| AC-C-107 | After a Live sign-in with a marker password, the issue of a pairing code and Try-it calls, the web's error sink and the API Reference page's log contain no marker password, no pairing code and no string that starts with `ses_`, `dvc_` or `bio_` | Web tests | 64, 76, 99 (W55, W81, W84) | SC10 |
| AC-C-108 | `session.ended` with `TOKEN_REUSE` signs the app out to the Login screen, deletes the biometric token and its marker, and shows the Alert of section 6.5; the device credential stays | jest with the fake socket | 79 (W15, W56) | SC5 |
| AC-C-109 | In Live mode the chain panel shows the stored-chain line and, when `lineage` is not empty, the "Earlier chains" line with one entry per discarded chain; in Simulated mode the panel is as today | Web test with the fake transport | 73 (W75) | SC4 |
| AC-C-110 | A 429 shows the limit toast with the seconds of `retry-after`, keeps the form or dialog filled, and shows neither the offline notice nor a changed mode indicator, on the web Login page and on the mobile Login screen | Web test; jest | 64, 80 (W55, W59) | SC4 |

---

## 14. The nine open points of the server specification, closed

Source: [SP:§19.5], rows "Row 17".

| # | Open point | Closed in | Answer in one sentence |
|--:|---|---|---|
| 1 | What each client shows for `session.updated`, `session.ended` and `device.revoked` | Sections 6.3 to 6.6 | A role change keeps the session, re-gates controls in place, shows one notice and leaves only a route that needs the lost permission; an ended session goes to the login screen with a notice per reason; a revoked device goes to the Pair screen with a notice and loses its stored credential |
| 2 | How the web fills the `pairing` slice and words the trust line; how the login screens read presentation mode before sign-in | Section 2.3; WS-7; note G6; WS-10; section 9.2 | The web's `pairing` slice is a neutral value that no web screen reads in Live mode; the trust line says "web console, no pairing required"; presentation mode before sign-in comes from the tab-local flag on the web (kept in step with the server while signed in) and from the device preference on mobile |
| 3 | The mode model of the registry for 75 live operations and the API Reference page | Section 11 | `mode` keeps two values meaning "the simulator can answer it"; each entry names its answering services; the builder has an offline scope (ten) and a full scope (75); the page shows ten in Simulated mode and 75 `LIVE` in Live mode |
| 4 | Rebuilding `SimPermissionError` and `SimTransitionError` from `error.details`; the settle on `x-dems-revision` and its time-out | CL-16 to CL-21 | The classes are rebuilt from status, code and details, with fallbacks from the registry and the request; an action settles in the turn in which its revision is applied; after 2,000 ms without the delta the client resynchronises and resolves |
| 5 | The `touchSession` throttle | CL-27 | Leading and trailing, one a minute, restarted by every successful POST, never sent without activity |
| 6 | Structural sharing when a snapshot is applied | CL-13 | Equal slices and equal array elements keep their references; untouched slices are not replaced |
| 7 | Evidence verification in Live mode | Sections 8.2 (A6), 8.4 (D-1), 8.5; below | The server's verdict is the record and no demo control is called |
| 8 | The biometric item on an emulator; the write after a rotation may prompt again | MB-5, MB-6, MB-8 | One visible prompt in every case: the protected read on a device, the existing OS prompt first on an emulator; an unprotected item only as the recorded fallback |
| 9 | A new socket after sign-in and after sign-out on the web | CL-11a; section 5.2 step 4; WS-12 | The Live source replaces the socket on both; the action settles only after the new socket's snapshot |

**Point 7 in full.** In Live mode the verdict of record is the server's `EvidenceVerifyResult` (operation 41). Both clients show it as the result: the chip, the per-track list, the custody entry. The web's recomputation over bundled demo files (`apps/core-web/src/features/evidence/use-verification.ts`) and the mobile app's on-device check (`apps/mobile/src/features/evidence/evidence-model.ts`) run only when the server's `EvidenceMediaRef.source` is `DEMO_PACKAGE` [SP:MS-2]. They are labelled "Bundled demo package", write nothing, and never call `injectFault`: today's mirror of a tamper into the simulator (`apps/core-web/src/features/evidence/sim-adapter.ts:84-97`) is not done, and the mobile adapter calls `verify` whether or not the bundled package agrees (today it calls only when it agrees, [R4:655]). If the two results differ, an info Alert says: "The bundled demo package differs from the Core's record. The Core's verdict is the record." A presenter who wants a failing verdict in Live mode injects the evidence tamper fault from the Demo Control Panel, which the server records [SP:§12.3].

---

## 15. Traceability

### 15.1 Impact questions answered here

| IQ | Question (short) | Answer in |
|--:|---|---|
| 1 | Live and Simulated coexistence; the UI in each mode | Section 3 "Mode switch per build type and the mode indicator" |
| 11 | Credential storage on the clients (the client half) | Section 9.1 "Credential storage per client"; section 5.3 |
| 16 | CORS and the packaged content-security policy | Section 4 "Web transport: the dev proxy" (4.1 to 4.3) |
| 17 | Biometric and security-key sign-in | Section 9.3 "Biometric unlock and the security-key button"; WS-8 |
| 19 | How clients learn of a permission or pairing change while signed in | Section 6 "Reacting to a role change and to a revocation" |
| 20 | Pairing lifecycle, device identity, re-pairing (the client half) | Section 9.4 "Pairing flow and the pairing-required gate" |
| 23 | The API Reference page when every operation is live | Section 11 "API Reference page in both modes" |

### 15.2 Success criteria

| SC | Text (short) | Sections | Acceptance criteria |
|---|---|---|---|
| SC3 | Both clients take their data from the backend; an action on one is visible on the other | 2, 7, 8 | AC-C-01, 02, 05, 07, 08, 10, 14, 15, 18, 22, 24, 26, 33, 34, 40, 57 to 62, 64 |
| SC4 | A denied action is refused and audited; a role change follows on both clients | 6, 8.1, 10.2 | AC-C-11, 13, 16, 39, 43 to 46, 48 to 52, 54, 55, 63, 86 to 90, 99, 109, 110 |
| SC5 | Pairing gate, listing, revocation | 9, 10.3 | AC-C-16, 31, 67 to 70, 73, 75 to 82, 92 to 94, 97, 98, 105, 108 |
| SC6 | The API Reference page shows the endpoints as live | 11 | AC-C-01, 03, 100 |
| SC7 | Existing suites and new tests pass | 12 | AC-C-12, 17, 32, 53, 56, 101 |
| SC8 | Simulated mode and the 0.1.0 packages still work | 3, 12.1 | AC-C-06, 09, 19 to 21, 23 to 25, 27 to 30, 35, 36, 41, 42, 74, 83, 85, 91, 101 |
| SC9 | Decisions, drift and findings recorded | 17 | AC-C-71 |
| SC10 | No secret stored where it should not be; nothing sent out | 4, 5.3, 9.1, 10.1, 11 | AC-C-04, 33, 37, 38, 47, 65, 66, 72, 85, 95, 96, 102 to 107 |
| SC11 | README commands | 9.6 | AC-C-84 |

### 15.3 Decisions and defaults honoured

| Decision | Where |
|---|---|
| Q1 Simulated mode stays selectable | Section 3; default in every build |
| Q5 pairing mandatory for mobile in Live mode | Section 9.4 (the gate) |
| Q8 portal-issued code, also a QR; code entry | Sections 9.4, 10.3; [DEC:DR-02] |
| Q9 two portal surfaces | Section 10 |
| Q11 biometric unlocks a credential; security key only in Simulated mode | Section 9.3; WS-8 |
| Q12 demo operators keep the disclosure | WS-9; section 9.2 (accepted by row 20 with conditions C1 to C4) |
| Q13 truthful trust line | WS-7; section 9.2 |
| Q14 demo controls behind a permission and a flag | Sections 7.3 (G14), 7.4 (settings); AC-C-52 |
| ADQ-2, ADQ-3 | Sections 2, 7, 8 |
| ADQ-6 | Sections 4, 5 |
| ADQ-7 | Section 3 |
| TD-09, TD-10, TD-11, TD-12 | Sections 2.1; 9.1 and 9.3; 10.3; 12 |
| HB-9, HB-11, HB-14, HB-15 [DEC:D12] | Sections 2.1; 12.2; 2.3; 2.5. **No further hand-built element is introduced**: structural sharing reuses a library function (CA-04), the pages use the kit, the QR uses `qrcode.react` |
| D15: DEPARTURE-5, DEPARTURE-6, the change to the mobile Core chips, the 24 open choices | Sections 17.1 to 17.3, stated as decided |
| D16: the corrections of the security design review | Section 15.6 |

### 15.4 Edge cases [BP:167-180]

| Edge case | Client handling |
|---|---|
| E2 role changed or user disabled while signed in on both clients | Sections 6.3, 6.4 |
| E3 device revoked while signed in and recording | Section 6.6 |
| E4 last holder of user administration | Section 10.2 (hint and 409) |
| E5 two clients start a session together | Section 8.2 (A3) |
| E6 code redeemed twice, after expiry, during a lock | Section 9.4 (`failed`, `locked`); section 10.3 (expired, closed) |
| E7 app reinstalled on a paired device | MP-4, MP-8, MP-10 |
| E8 packaged web build | MD-2, MD-6; AC-C-20 |
| E9 Live mode, backend unreachable | Section 3.5 |
| E10 stored keys when the mode changes | Section 3.4 |
| E14 demo controls need a permission in Live mode | AC-C-52 |

### 15.5 The controller's ten requirements for this row

| # | Requirement | Where |
|--:|---|---|
| 1 | Design to D11 and D13; departures flagged | Section 17.3 |
| 2 | The mode switch, the default per build, the label, no silent fallback, the stored snapshot | Section 3 |
| 3 | The wiring map and the Live behaviour of every synchronous site | Sections 7, 8 |
| 4 | RBAC on the clients | Section 6 |
| 5 | Mobile pairing, gate, credential, biometric, Settings control, ports | Section 9 |
| 6 | The two portal pages | Section 10 |
| 7 | Web sign-in and session | Section 5 |
| 8 | Tests | Section 12 |
| 9 | The nine open points | Section 14 |
| 10 | No credential values, no personal data | Section 0; operators by ID only |

### 15.6 Security design review: where each finding is folded in

The eight findings that name this file, and the server-side findings that change what a client sees. A finding that is not listed changes nothing here.

| Finding | In this file | Criterion |
|---|---|---|
| SD-02 two Origin lists | 1.8 (CA-08), 4.4 (WT-6): what React Native sends | [SP:AC-B-73] |
| SD-03 denial budget | 2.5 (CL-21), 8.1 (LB-10), 8.2 (A1), 8.4 (D-6), 8.5 (S1-1): a 429 has its own wording | AC-C-110 |
| SD-07 allowlist and the proxy | 1.8 (CA-05), 4.1 (WT-2, WT-2a), 8.2 (A1) | AC-C-102 |
| SD-08 cookie name per instance | 5.2 (step 2), 5.3, 9.1 | AC-C-38 |
| SD-10 `TOKEN_REUSE` | 6.5 | AC-C-108 |
| SD-14 response headers | 4.3 | [SP:AC-B-14]; AC-C-35 |
| SD-16 Try-it deny list | 1.8 (CA-11), 11 (AR-3, AR-3a, AR-9) | AC-C-100, 103 |
| SD-17 demo password, C1 to C4 | 5.5 (WS-9, WS-10), 9.2 | AC-C-47, 104 |
| SD-18 DEPARTURE-6 conditions | 9.1, 9.3 (MB-5, MB-6, MB-6a), 17.3 | AC-C-71, 105 |
| SD-19 chain lineage | 2.5 (the `verifyAuditChain` binding), 8.2 (A9) | AC-C-109 |
| SD-20 client memory after sign-out | 5.6 (WS-12), 6.3 (RC-3), 9.1, 10.1 (PG-6, PG-6a), 10.3 | AC-C-106 |
| SD-23 log scans with markers | 11 (AR-9) | AC-C-65, 75, 107 |
| SD-24 the cookie's `Max-Age` | 5.2 (step 2), 5.6 (WS-15) | [SP:AC-B-23] |
| SD-29 operation 23 unused | 9.4 (MP-8a), 16 (GC-05) | — |

---

## 16. Gap and risk register of this specification

G-01 to G-29 of the decision record and GS-01 to GS-19 of the server specification stay as recorded there, with the rulings of row 20 that [SP:§18] lists. This file adds the items below; the last column gives the owner and, where row 20 has ruled, the ruling [DEC:D16].

| ID | Type | Item | Effect | Owner and status (revision 2) |
|---|---|---|---|---|
| GC-01 | risk | `apps/core-web/src/test/scalar-config.test.ts:70` pins ten operations through the page's document function; the registry grows in row 27 (W19, W22, W27), the page changes in row 99 (W84) | A red web test between the two rows unless the builder keeps the offline scope for today's call (section 11) | Rows 18 and 21; row 27 (W19, W22, W27) |
| GC-02 | risk | The mobile hand-off relies on one React commit for a store update and a navigation in the same turn (CA-02) | One spurious "session busy" toast; the fallback is a guard change in row 82 (W60) | Rows 82, 86 (W60, W67) |
| GC-03 | gap | Files no blueprint row owns: `apps/mobile/src/features/home/use-health.ts`, `apps/mobile/scripts/device-session.sh`, `apps/mobile/jest.setup.ts`, `apps/core-web/src/test/` (new cross-feature Live tests), `packages/shared/src/i18n/en/common.ts` | A row returns `needs-review` | Row 21 |
| GC-04 | risk | The mode indicator and the navigation group are new elements in the shell that Simulated mode also renders (the indicator) | An existing shell test may count elements (CA-09) | Row 63 (W54) |
| GC-05 | gap | `rotateDeviceCredential` is not called by the app | The operation is used only by the server tests; the API Reference page refuses Try-it of it in Live mode (AR-3a); a `DEVICE_CREDENTIAL_ROTATED` row is unexpected in this task | Accepted by row 20 (residual R-06); a later task |
| GC-06 | gap | Rows older than the rings (1,000 audit rows, 500 events) are not shown on the existing pages in Live mode; export files hold them all | Parity with Simulated mode, not a regression | Recorded |
| GC-07 | gap | Presentation mode before sign-in on a fresh browser tab is unknown (WS-10) | The disclosure may show although the server's setting hides it | Accepted by row 20 as it is: the value is public, so no contract change is required (condition C3 of [SP:SR-63]) |
| GC-08 | gap | The arrival notice of the Login page is not repeated after a manual reload in Live mode (WS-6) | A cosmetic difference from Simulated mode | Recorded |
| GC-09 | risk | Try-it in Live mode sends real commands with the operator's role (AR-3) | A reader can change the Core's state from the reference page | Accepted by row 20 with the deny list of AR-3a; the banner of AR-4 stays |
| GC-10 | risk | A device credential belongs to one database; lanes have separate databases (section 9.6) | A device check on another lane starts at the Pair screen | Row 18 |
| GC-11 | risk | The constants of section 2.4 are chosen here without a source | Tuning after row 110 (W98) | Rows 60, 110 (W18, W31, W44, W98) |
| GC-12 | risk | Three segments in the Settings control may truncate on the narrow phone | A label is shortened | Row 97 (W82) device check |
| GC-13 | risk | The Pair screen's tablet layout is a known issue of the predecessor (KI-01, [AN:762]); its texts change in Live mode | Needs a device check on the tablet AVD | Row 81 (W57) |
| GC-14 | gap | The QR tile is dark on light, inside a dark page, for scanner contrast | A deliberate exception to the palette, one tile | Controller |
| GC-15 | gap | In Simulated mode the web matrix shows nine permissions while the shared table has twelve after row 26 (W16) | The three new permissions have no function in Simulated mode | Controller |
| GC-16 | gap | Maestro flows stay a follow-up; the two-client checks are rows 106 to 108 (W94 to W96) [AN:487] | No scripted end-to-end run | Recorded |
| GC-17 | risk | `expo-secure-store` behaviour on the AVDs is known from documentation only (CA-06, CA-07) | The case of MB-5 may differ per AVD | Row 79 (W15, W56) |
| GC-18 | gap | Whether the API Reference renderer keeps request or response history in web storage is not established (CA-11) | An answer with Core data could outlive a sign-out | Row 99 (W84; AC-C-103) |
| GC-19 | risk | The Core server accepts no `localhost` origin [SP:OR-7]: a console opened at `http://localhost:<port>` cannot sign in in Live mode | A developer sees the "unexpected" Alert; the console record and the README name the address to use (WT-2a) | Rows 62, 101 (W05, W50, W54, W86) |
| GC-20 | risk | With the server's denial budget a 429 can follow repeated refusals or failed sign-ins of one console [SP:ID-P13] | Without LB-10 it would read as an outage | Rows 63, 64, 78, 80 (W15, W51, W54, W55, W59) |
| GC-21 | gap | The dev server sends no content-security policy for the page in Live mode (accepted, residual R-14); the review's optional `X-Frame-Options: DENY` in the dev server block is not adopted | Live mode exists only in dev builds; the cookie is `HttpOnly` | Recorded |
| GC-22 | gap | The session cookie is a browser-session cookie; a browser that restores its session may restore the cookie (hypothesis) | The server's idle and absolute limits still end the session | Row 64 (W55) records the browser and its version |

---

## 17. Decisions for the controller to record

### 17.1 Choices made here that D11 and D13 left open

**DECIDED: all 24 accepted by the controller [DEC:D15].** Four were refined by the security design review and are stated here as refined: items 12, 15, 20 and 21 [DEC:D16].

| # | Choice | Section |
|--:|---|---|
| 1 | Shared layer: three folders and four export subpaths; `useCoreActions` and `settle` are the call-site API; the Live source is cast into the existing `SimContext` | 2 |
| 2 | One socket per client in Live mode; the heartbeat context is fed from it | 2.2 |
| 3 | Own-command atomicity: deltas are held while a command is in flight; the continuation runs in the turn of the store update | 2.5 |
| 4 | Settle time-out 2,000 ms: resynchronise and resolve; command time-out 8,000 ms; late spinner after 420 ms | 2.4, 8.1 |
| 5 | Two new error classes, `LiveTransportError` and `CoreRefusalError`, beside the rebuilt simulator classes | 2.5 |
| 6 | `touchSession`: leading and trailing, one a minute | 2.5 |
| 7 | Web mode key `dems.core.mode.v1` in `localStorage`; preselection by `VITE_DEMS_CORE_MODE`; Live only in dev builds; a mode change signs out and reloads | 3 |
| 8 | Mobile mode = the third Core link source `LIVE` in the existing preference field; a debug deep-link parameter `core=` | 3, 9.5 |
| 9 | Mode labels: `SIMULATED`, `LIVE`, `LIVE · OFFLINE`; a persistent toast for a lost link; "Use Simulated mode" only as an explicit action | 3.2, 3.5 |
| 10 | Proxy entries `/api/v1` and `/ws`; no CORS and no CSP change in either client | 4 |
| 11 | Web trust line in Live mode: "Core server on this computer • web console, no pairing required"; the Login device strip shows public server facts | 5.5 |
| 12 | The demo-operator disclosure stays in Live mode without role chips (Q12), under the conditions C1 to C4; the mobile pairing-code hint is not shown in Live mode | 5.5, 9.2 |
| 13 | A role change leaves only `/session/new`, `/admin/users`, `/admin/devices`; controls are re-gated in place; one notice | 6.3 |
| 14 | Secure-storage items `dems.live.device.v1`, `dems.live.bio.v1`, `dems.live.bio.meta.v1`; one wrapper module | 9.1 |
| 15 | Biometric: one visible prompt in every case (MB-5); the app deletes a token the server refused; the unprotected fallback only under the conditions of MB-6a | 9.3 |
| 16 | The Pair screen keeps its timeline on the Live clock; only the commit is a request; unpair is refused while offline | 9.4 |
| 17 | The gate: optional `pairing` member of the runtime contract; unpaired reaches `/`, `/pair`, `/stack-check` only; an unknown credential is deleted | 9.4 |
| 18 | `device-session.sh` gets `DEMS_CORE_HOST_PORT`; the device side stays `tcp:4420` | 9.6 |
| 19 | Portal pages: routes `/admin/users` and `/admin/devices`; an ADMINISTRATION navigation group; Live-only; TanStack Query with invalidation by `admin.changed` | 10.1 |
| 20 | Paired Devices: "Cancel code" is the panel's close action; the code lives in page memory only and is dropped at a sign-out, a session end or the loss of the permission; the QR test asserts the payload handed to the component, with no decoder | 10.3 |
| 21 | API Reference: ten operations in Simulated mode, 75 `LIVE` in Live mode; Try-it of the six operations that carry a secret is refused in Live mode; the Realtime panel reads the one socket | 11 |
| 22 | Evidence verification in Live mode: the server's verdict; the bundled check is labelled and never mirrored | 14 |
| 23 | `rotateDeviceCredential` is not called by the app in this task | 9.4 |
| 24 | Audit and log export files are built from all pages of operations 59 and 63 | 8.2 |

### 17.2 Findings

| ID | Finding | Evidence | Proposed action |
|---|---|---|---|
| FC-1 | The mobile Core chips print "Live" in HEARTBEAT mode although the data is simulated | `apps/mobile/src/features/dashboard/home-header.tsx:109-115`; `apps/mobile/src/features/more/more-model.ts:95-104` | MD-8: they print "Simulated" unless the source is LIVE. A change to a predecessor screen, **accepted by the controller [DEC:D15]** and recorded under SC8 |
| FC-2 | A web test outside the 61 pins ten operations through the page's document function | `apps/core-web/src/test/scalar-config.test.ts:70` | GC-01: keep the offline scope in the builder, or change the test by design in row 27 (W19, W22, W27) |
| FC-3 | The web role matrix uses a local nine-entry list, so the additions of row 26 (W16) do not change the Simulated matrix on the web (the decision record expected a change, [AN:647]); the mobile profile sheet does list the three new permissions | `apps/core-web/src/features/security-audit/model.ts:434-444`; `apps/mobile/src/features/settings/settings-model.ts:76` | Row 26 (W16) adds labels; row 73 (W75) renders the server's twelve rows in Live mode only |
| FC-4 | The eight seam files of ADQ-2 are confirmed; the seam rows also write adjacent files (web: `vite.config.ts`, `lib/core-endpoint.ts`, two i18n files; mobile: `connection-banner.ts`, `runtime/index.ts`, `runtime/debug.ts`) and new files | Section 7.2 | Row 21 lists them as write paths |
| FC-5 | `expo-device` and `expo-constants` are already dependencies of the app; no source file imports `expo-device` today | `apps/mobile/package.json:34-35`; a search of `apps/mobile/src` | Used for the device name and the emulator check (MP-5, MB-5); no new native module beyond `expo-secure-store` |
| FC-6 | Five paths have no owning row (GC-03) | [BP:548-556] | Row 21 |
| FC-7 | The web Start Session resume effect would send `beginPrecheck` again on every render until the delta arrives | `apps/core-web/src/features/session-new/index.tsx:186-195` | B-6: an in-flight marker (row 67 (W64)) |
| FC-8 | The web "Core offline" text prints the Core origin, which in Live mode is the page's own origin, not the server's port | `apps/core-web/src/features/login/login-model.ts:60-66` | The Live text names no address (section 3.5) |
| FC-9 | The mobile health call is fixed to mock-core's origin | `apps/mobile/src/features/home/use-health.ts:8`; `packages/shared/src/api/health.ts:46-50` | Section 7.4, last row |
| FC-10 | The mobile pairing timeline works unchanged on a clock that follows the server; the change is smaller than the decision record's note "a request, not a timeline" [AN:557] | `apps/mobile/src/features/pairing/use-pairing-flow.ts:89-143` | Section 9.4 |
| FC-11 | A 429 is mapped to `LiveTransportError('UNAVAILABLE')`, and the Login page treats a transport error as "Core offline" (A1). With the server's denial budget a 429 can follow 20 refused or failed calls of one console, so a limit would read as an outage | CL-21; section 8.2 (A1); [SP:ID-P13] | LB-10: a 429 has its own wording. Found while folding SD-03; it is not a correction of the review. Accepted [DEC:D18] |
| FC-12 | The Core server's web console origins hold no `localhost` entry, while `WEB_DEV_ORIGINS`, which mock-core uses, keeps one | [SP:OR-7]; `packages/shared/src/api/constants.ts:27` | WT-2a: in Live mode the console is opened at `http://127.0.0.1:<port>`; row 101 (W86) says so in the README |
| FC-13 | The web login page reads the lock state with a same-origin GET (`getSignInStatus`), which carries no `Origin` header; revision 1 of the server specification asked for an allowlisted `Origin` on that operation | Section 5.1 step 4; WS-3; [SP:ID-1, GS-29] | DECIDED [DEC:D18]: operation 3 stays a GET that needs no console identity and reports only the web console's lock state to a caller without a device credential. No client change |

### 17.3 Departures

| ID | Statement | Evidence | Smallest alternative |
|---|---|---|---|
| DEPARTURE-5 | **DECIDED: accepted [DEC:D15]** (wording of D11 only). D11 says "8 seam files" [DEC:D11 ADQ-2]. The design is unchanged and the eight files are confirmed, but the seam rows write more files than eight (FC-4), and the mobile call-site count is 26 plus two runtime files, not 27 (section 7.4) | Sections 7.2, 7.4 | Record the corrected counts; no design change |
| DEPARTURE-6 | **DECIDED: accepted with conditions [DEC:D15, D16]; the conditions are MB-6a.** D13 stores the biometric token with `requireAuthentication: true` [SP:§5.3]. If row 79 (W15, W56) observes on a device that the write of the rotated token shows a second OS prompt, or that a protected write or read fails, the token is stored without that flag and the existing OS prompt is the gate (MB-5 case c, MB-6). The decision record already allows this when a write or read fails [AN:454]; this file extends it to the double prompt | Not run by any row; [AN:451] | Keep the flag and accept two prompts per biometric sign-in on that build |

No other rule of this file departs from D4, D9, D11, D12 or D13. DR-02 (no QR scanning) is honoured. No departure is open.

### 17.4 Open points for the next rows

Status at revision 2: the points for row 20 were ruled by the security design review [DEC:D16], as each line says. The others stay open for their rows. The line marked "(revision 2)" is new.

| For | # | Open point |
|---|--:|---|
| Row 18 | 1 | Pin the names of section 2 (subpaths, functions, constants) and of the environment variables (`VITE_DEMS_CORE_MODE`, the proxy port variable, `DEMS_CORE_HOST_PORT`) |
| Row 18 | 2 | Early proofs before the wide client waves: CA-05 (row 62 (W05, W50, W54)), CA-02 (row 86 (W67)), CA-03 (row 63 (W54)), CA-06 and CA-07 (row 79 (W15, W56)), CA-08 (row 59 (W30)) |
| Row 18 | 3 | The sequencing of rows 27 and 99 (W19, W22, W27, W84) for the document scope (GC-01) |
| Row 18 | 4 | The lane and emulator binding for device credentials (GC-10) |
| Row 18 | 5 | `qrcode.react` is the only new web dependency of this file; `expo-secure-store` the only new mobile one; no QR decoder |
| Row 18 | 6 | (revision 2) Row 62 (W05, W50, W54) carries the negative proxy test and the clearing of the query cache (AC-C-102, 106); row 99 (W84) the deny list and the storage check (AC-C-103); row 79 (W15, W56) the conditions of MB-6a (AC-C-105); row 101 (W86) the address `127.0.0.1` and the plain sentence about the demo credentials in the README; row 64 (W55) records the browser and its version |
| Row 20 | 1 | Rule on: the demo-operator disclosure in Live mode (WS-9, with [SP:SR-63]); the device credential stored without an authentication requirement (section 9.1); the biometric cases (MB-5, MB-6); Try-it with real commands (GC-09); the pairing code held in page memory and shown on screen (section 10.3). **Ruled: all accepted**, with the conditions C1 to C4 (WS-9), the conditions of MB-6a, the deny list of AR-3a and the clearing of PG-6a |
| Row 20 | 2 | Whether presentation mode should be readable before sign-in through an optional member of `SignInStatus` (GC-07). Not adopted here: it would change the contract of [SP:§7.18]. **Ruled: not needed** (GC-07 accepted) |
| Row 21 | 1 | Add the write paths of FC-4 and FC-6; split row 62 (W05, W50, W54) if it is too wide (mode, proxy, routes, runtime, presenter, i18n registration) |
| Row 21 | 2 | The check of row 76 (W81) becomes "the QR component receives the issued payload" (section 10.3) |
| Row 21 | 3 | Rows 72, 88, 91 and 95 (W71, W72, W79) change no production file (sections 7.3, 7.4): they are test-and-check rows |
| Rows 27, 98 (W19, W22, W27, W83) | 1 | The registry's `mode` meaning, the answering-service field and the builder's scope (AR-1) |

### 17.5 Revision 2: rulings folded in, and choices made while folding

**Rulings stated as decided in this file.**

| Decision | Ruling | Where |
|---|---|---|
| D15 | DEPARTURE-5 accepted; DEPARTURE-6 accepted; the change to the two mobile Core chips accepted; the 24 open choices accepted | 17.3; MD-8 and FC-1; 17.1 |
| D16 | The corrections of the security design review that name this file; DEPARTURE-6 with its conditions; the demo-password conditions; the Try-it deny list; the cookie name per instance; no `localhost` origin | 15.6 |
| D17 | The mobile release-gate test file stays unchanged; the LIVE cases go into a new test file | 9.5; AC-C-83 |
| D18 | The nine choices below and LB-10 accepted; OP-1 of the server specification decided (FC-13) | 17.2; 8.1 |

**Choices made by revision 2 where the review leaves a value open. All nine accepted [DEC:D18].**

| # | Choice | Finding | Section |
|--:|---|---|---|
| 1 | The wording of the plain sentence of the disclosure (C1), with new i18n keys on both clients; the Simulated texts do not change | SD-17 | 5.5, 9.2 |
| 2 | The clearing removes every `['core', …]` query on all four triggers, with `removeQueries` rather than an invalidation | SD-20 | 10.1 |
| 3 | The message of the Try-it deny list | SD-16 | 11 |
| 4 | LB-10: a 429 has its own wording. Not a correction of the review; a consequence of the denial budget (FC-11) | SD-03 | 8.1 |
| 5 | The app's reaction to `session.ended` with `TOKEN_REUSE`, and its text | SD-10 | 6.5 |
| 6 | The "Earlier chains" line of the chain panel as the place where the lineage is shown | SD-19 | 8.2 |
| 7 | The review's optional `X-Frame-Options: DENY` in the dev server block is not adopted | SD-14 | 4.3 |
| 8 | The Settings description shown while the biometric token is stored without the authentication requirement | SD-18 | 9.3 |
| 9 | The fallback of CA-11: Try-it is switched off in Live mode if the renderer's persistence cannot be switched off | SD-16 | 1.8 |

**Conflicts and open points**: none in this file. CF-1, CF-2 and OP-1 of the server specification are ruled by D18 [SP:§19.6]; OP-1, which touches the web login page (FC-13), needs no client change.

---
*Generated: 2026-10-04 04:02*
*Last Updated: 2026-10-04 06:16 (revision 2.2)*

