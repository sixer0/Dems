---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: data-analyst
blueprint_row: 15 (FIRM); revision 2 by controller row 20b (decision D16); revision 2.1 after the masterplan consistency check (row 19)
revision: 2.2
tier: 1
type: system-specification (server side, canonical)
confidence: MEDIUM
confidence_note: repository facts are HIGH (read from files); every design value that no row has executed yet is labelled "hypothesis" or carries an assumption ID (SA-n) with the row that proves it
based_on: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/research/03_analysis.md
binding_decisions: D1-D20, DR-01, DR-02, DR-03, DR-04 (decisions/decisions.md)
security_review: gateway_check/03_security_design_review.md (row 20, verdict CAUTION; every correction folded in by D16)
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/02_structured.md
sibling_specs: masterplan/03_database_contract.md (row 16; its revision 2.1 carries the rulings this file cites, D18 and D19), masterplan/04_client_integration_spec.md (row 17, revision 2.1), masterplan/02_plan.md (row 18, revision 2)
last_updated: 2026-10-04 06:16
---

# System Specification: DEMS Core server, integrated RBAC and portal-mobile pairing

## Revision history

Revision 2 folds the corrections of the security design review (`gateway_check/03_security_design_review.md`, row 20) into this file, as decision D16 directs, and states the rulings of D13 to D16 as decided. Each rule is changed in the section where it lives. SD-20 and SD-23 are owned by the client specification and change nothing here.

| Rev | Date | Change | Finding or decision | Sections touched |
|--:|---|---|---|---|
| 1 | 2026-10-04 | First issue (row 15) | D13 | all |
| 2 | 2026-10-04 | Three database roles; the server holds `dems_app` always, `dems_owner` only for a reset with the demo flag on, never the superuser; the reset described accordingly | SD-01, DR-03 | 2.1, 2.4, 8.6, 12.4, 14.1, SR-58, SR-68, AC-B-72 |
| 2 | 2026-10-04 | Two Origin lists; decision tables for HTTP requests and for the socket upgrade; what React Native sends; why pairing stays mandatory | SD-02 | 1.8, 2.3, 2.4, 5.2, 6.9, 7.2, 9.2, 14.2, SR-19, SR-21, SR-69, AC-B-32, AC-B-43, AC-B-73 |
| 2 | 2026-10-04 | `getSignInStatus` no longer needs the web console `Origin` (a browser sends none on a same-origin GET); ruled by D18 (OP-1) | GS-29, found while writing the decision table of SD-02 | 5.2 (ID-1), 6.6, 7.5, 14.2, AC-B-32, 18.1, 19.6 |
| 2 | 2026-10-04 | Denial budget at the throttle stage (20 audited refusals per key per 60 s, then 429 without a row); the bucket of a retired device credential | SD-03 | 2.3, 4.6, 5.1, 6.2, 6.6, 13.2, SR-23, SR-45, SR-71, AC-B-16, AC-B-75 |
| 2 | 2026-10-04 | Server-native handlers are atomic: one unit of work in the pipeline, the attempt consumed before verification, compare-and-set transitions; five concurrency criteria; the guessing bound of the pairing code restated | SD-04 | 2.3, 4.6, 5.2, 5.6, 6.1, 6.4, 8.2, SR-27, SR-47, SR-72, AC-B-76 to AC-B-80 |
| 2 | 2026-10-04 | The request log holds the route pattern, never the raw URL; parse errors are logged by code; the log-capture criterion extended; AC-B-42 uses a marker instead of a token | SD-05 | 15.8 (SR-48, SR-49), AC-B-29, AC-B-42 |
| 2 | 2026-10-04 | Audit triggers enabled `ALWAYS`; the chain-link check accepted (references to the database contract) | SD-06, GD-01 | 8.3, 13.3, SR-52 |
| 2 | 2026-10-04 | Web console origins without `localhost`; exact match; `null` refused | SD-07 | 2.4, 14.2, SR-70, AC-B-74 |
| 2 | 2026-10-04 | A cookie name per instance | SD-08 | 2.4, 5.1, 5.3, 7.1, SR-18, AC-B-23, AC-B-90 |
| 2 | 2026-10-04 | One credential per request; a session is bound to its transport | SD-09 | 2.3, 4.1, 5.2, 7.2, 7.3, 14.2, SR-73, AC-B-15, AC-B-81 |
| 2 | 2026-10-04 | `TOKEN_REUSE`: a reused biometric token ends the family's sessions | SD-10 | 4.7, 5.4, 5.6, 9.4, SR-36, SR-74, AC-B-31, AC-B-82 |
| 2 | 2026-10-04 | `reportBiometricFailure` names an operator only where an enrolment exists | SD-11 | 5.6, 7.5, SR-37, SR-65, AC-B-83 |
| 2 | 2026-10-04 | Throttle key = the resolved principal or a fixed class; upgrades counted; the credential is resolved before the throttle | SD-12 | 2.3, 5.1, 7.3, 9.1, SR-24, SR-75, AC-B-84 |
| 2 | 2026-10-04 | A separate cap for anonymous sockets | SD-13 | 9.1, 9.2, SR-42, AC-B-85 |
| 2 | 2026-10-04 | Response headers through `@fastify/helmet` 13.1.1 and `Cache-Control: no-store`; the packaged policy of the 0.1.0 packages untouched | SD-14 | 2.2, 14.2 (OR-9), SR-76, AC-B-14 |
| 2 | 2026-10-04 | Secrets: file modes, the fields of the connection files, the loader, no secret in an argument, the `pg_hba.conf` check | SD-15 | 2.4, 14.1, SR-02, SR-60, SR-77, AC-B-64, AC-B-86 |
| 2 | 2026-10-04 | Try-it deny list for six operations (reference to the client specification) | SD-16 | 7.7 |
| 2 | 2026-10-04 | The demo-password conditions C1 to C4 | SD-17 | 15.10 (SR-63), 15.11, AC-B-92 |
| 2 | 2026-10-04 | The DEPARTURE-6 conditions (reference to the client specification) | SD-18 | 5.3, 5.6 |
| 2 | 2026-10-04 | The lineage of discarded audit chains: an entity that survives every reset, returned by `verifyAuditChain` | SD-19 | 3.3 (E-26), 7.13, 7.18, 8.6, 12.4, SR-56, SR-78, AC-B-57, AC-B-87 |
| 2 | 2026-10-04 | Password verification always computes; the pepper sentence; the salt source | SD-21 | 5.2, 14.1, SR-05, SR-08, SR-61, AC-B-24 |
| 2 | 2026-10-04 | The actor scope is cleared in a `finally` | SD-22 | 8.2, SR-79, AC-B-53 |
| 2 | 2026-10-04 | The cookie has no `Max-Age` | SD-24 | 1.7, 1.8, 5.1, SR-18, AC-B-23 |
| 2 | 2026-10-04 | Supply-chain records | SD-25 | 14.3, SR-80, AC-B-91 |
| 2 | 2026-10-04 | The boundary: a single-user Mac; other accounts on it and apps inside the emulators also reach the loopback listeners | SD-26 | 15.11 |
| 2 | 2026-10-04 | The stored-chain check is incremental | SD-27 | 7.13, SR-81, AC-B-88 |
| 2 | 2026-10-04 | A log line for the two unaudited commands; parity with the simulator kept | SD-28 | 13.2, SR-82, AC-B-89 |
| 2 | 2026-10-04 | The note on operation 23 | SD-29 | 6.3, 7.7 |
| 2 | 2026-10-04 | DEPARTURE-3, DEPARTURE-4 and the fifteen open choices stated as decided | D13 | 2.3, 4.6, 19.3, 19.4 |
| 2 | 2026-10-04 | SPEC-GAP rulings: the text rule; pairing codes, the two counters and the lineage kept by a reset; an ACTIVE code written `CANCELLED`; the epoch continues; `lastSignInAt`; the newest session per device; one snapshot row | D14 | 3.1, 3.3, 6.2, 6.5, 7.1 (API-13), 8.6, 12.4, SR-30, SR-64, AC-B-57, AC-B-93 |
| 2 | 2026-10-04 | The registry's mode model as the client specification adopted it | D15 | 7.19 |
| 2 | 2026-10-04 | The rulings of row 20 stated as decided; the 17 accepted residual risks listed; the gap register updated (GS-20 to GS-29); the traceability of SD-01 to SD-29; the choices made while folding, two conflicts (CF-1, CF-2) and one open point (OP-1), all ruled by D18 | D16 | 0, 1.3, 1.6 to 1.8, 17.1 to 17.3, 17.7, 18.1, 18.2, 19.5, 19.6 |
| 2.1 | 2026-10-04 | Text-only patch after the masterplan consistency check (`gateway_check/02_masterplan_consistency.md`). CF-1, CF-2, OP-1, GS-24 and GS-25 marked DECIDED and their open wording removed; the superuser is used at provisioning only (trial step T5-j; removal needs no connection); the reset routine (HB-3) lives in `db/reset/` and HB-13 in two folders; binding decisions D1 to D20; every cited provisional blueprint row is followed by its work rows, as [PL:§21] maps them. No rule, ID or count changed | Consistency-check findings C-01, C-03, C-04, C-11, C-12; D17 to D20 | Front matter; 0; 1.3; 1.6; 2.1 (C-6); 2.2; 3.3 (E-26); 5.2 (ID-1); 12.4; 14.1; SR-78; AC-B-72, AC-B-76, AC-B-80, AC-B-87; 18.1 (GS-24, GS-25, GS-28, GS-29); 19.6; row citations throughout |
| 2.2 | 2026-10-04 | Text-only patch (controller row 20c): work-row citations aligned with plan rev 2.1 §21; shell variable name `DEMS_CORE_HOST_PORT` (the name does not occur in this file; plan section 3.4 pins it and the client specification uses it). Row 25 is cited as W03, W08, because the password-hash wrapper W09 belongs to row 32; the supply-chain records of SU-2 and AC-B-91 are cited as W03, W07, W08, W13, W14. No rule, ID or count changed | Plan rev 2.1 §21 and §3.4 (C-13); controller row 20c | Front matter; 1.8 (SA-13); 14.2 (OR-9); 14.3 (SU-2); 16.10 (AC-B-91); 19.5 ("Row 18" item 6); 19.6 (item 10) |

## 0. Reading guide

| Section | Content | Impact questions answered |
|---|---|---|
| 1 | Tier 1 frame: subject, stakeholders, timeline, scope, rationale, method, alternatives, assumptions | |
| 2 | Architecture: process and port model, modules, request pipeline, configuration | |
| 3 | State ownership: stored, engine-held, streamed only; stored entities for row 16 | |
| 4 | RBAC model: permissions and role matrix; change propagation | 18, 19 |
| 5 | Sign-in, session, lockout and idle expiry; sign-in methods in Live mode | 11, 12, 17 |
| 6 | Pairing lifecycle and device registry | 20 |
| 7 | API contract: conventions, error envelope, operation tables for the 13 feature areas, the 42 simulator actions | 21 |
| 8 | Engine: hosting, actor scope, persistence, clock, seed clock rule, restart and recovery | 10 |
| 9 | Realtime protocol: authentication and visibility, messages and resync, session and device events | 13, 19, 21 |
| 10 | Mode contract: Live and Simulated; released artefacts and versioning; client reachability; live package | 1, 2, 3 (and 5) |
| 11 | Media and evidence package files | 8 |
| 12 | Demo controls | 9 |
| 13 | Audit: types and writers | 14 |
| 14 | Secrets handling; origins, CORS, content-security policy and response headers; supply-chain records | 15, 16 |
| 15 | Security requirements SR-01 to SR-82 and the out-of-scope list (the boundary) | 11-17 |
| 16 | Acceptance criteria AC-B-01 to AC-B-93 | |
| 17 | Traceability: SC1-SC11, C1-C7, I1-I13, Q1-Q16, impact questions, feature areas, edge cases, U1-U9, the security design review findings SD-01 to SD-29 | |
| 18 | Gap and risk register of this specification; the residual risks the controller accepted | |
| 19 | Decisions for the controller to record; the rulings already made (D13 to D16) | |

**Citation convention.** `[AN:TD-06]` or `[AN:520]` is a record or a line of `research/03_analysis.md`. `[R1:80]` is line 80 of `research/01_explore.md`; R2 = `01b_explore_contract_dataset.md`, R3 = `01c_explore_web.md`, R4 = `01d_explore_mobile.md`, R5 = `01e_explore_services_packaging.md`, R8 = `02c_collection_server_runtime.md`, R10 = `02e_collection_identity_security.md`, R11 = `02f_collection_device_credential_qr.md` (the keys of AN section 2.2). `[RT:n]` and `[BP:n]` are lines of `identification/01_translated.md` and `identification/02_structured.md`. `[DEC:D11]`, `[DEC:F14]`, `[DEC:DR-02]` are rows of `decisions/decisions.md`. Code is cited as `path:line` relative to `/Users/gsp-budi/Documents/DEMS/`. `[SDR:SD-03]` or `[SDR:§5.4]` is a finding or a section of `gateway_check/03_security_design_review.md` (row 20). `[DB:§8.5]` is a section of `masterplan/03_database_contract.md` and `[CL:AR-3a]` a rule of `masterplan/04_client_integration_spec.md`, both at their revision 2. A statement without a source is labelled **hypothesis** or carries an assumption ID (SA-n, section 1.8).

**Normative words.** "MUST", "MUST NOT" and "MAY" state requirements on the server. Numbered items (RB-n, ID-n, ID-Pn, PR-n, ENG-n, RT-n, MS-n, DC-n, OR-n, SU-n, SR-nn, AC-B-nn) are the units that rows 16-21 and the gate rows refer to. An ID is never renumbered and never reused: revision 2 changed the text of existing items in place and added new items at the end of each list.

**Work rows.** This file was written against the provisional blueprint rows 23 to 118. Where such a row is cited as the row that builds or proves something, the plan's work rows follow in brackets, as the blueprint delta of `masterplan/02_plan.md` maps them (cited as `[PL:§21]`): "row 23 (W03, W07)". A list or a range gets the union of its rows' work rows, and a run of three or more is written "W63 to W65". Where a provisional row was split, all its work rows are named; the plan's row tables say which one carries which part. Row 41 has no work row: it is skipped [DEC:D13]. Rows 1 to 22 are the blueprint's firm rows and keep their numbers.

**No credential value appears in this file.** The demo password, the simulator's pairing code and the security-key operator are cited by constant name only: `DEMO_OPERATOR_PASSWORD` (`packages/shared/src/sim/dataset.ts:153`), `DEMO_PAIRING_CODE` (`:157`), `SECURITY_KEY_OPERATOR_ID` (`:155`) [R1:45].

---

## 1. Tier 1 frame

### 1.1 Subject

The server-side specification of the DEMS Core server (`apps/core-server`, package `@dems/core-server` 0.2.0, [AN:ADQ-8]): a PostgreSQL-backed process that becomes the single source of truth for the 13 feature areas of the two demo clients [RT:112-126], enforces one role and permission model for both of them, and runs a real pairing flow in which the portal issues a one-time code and a mobile device redeems it for a device-bound credential [RT:86].

### 1.2 Stakeholders

| Stakeholder | What this file gives them |
|---|---|
| The user (demo owner and presenter) | One system instead of two independent simulators: an action on one client is visible on the other, a role change follows on both, revoking a device removes its access (SC3-SC5, [RT:300-302]); the Simulated demo and the 0.1.0 packages untouched (SC8) |
| Controller | The operation count, the permission and audit vocabulary, every departure and every open point (section 19) |
| Row 16 (database-specialist) | The stored entities (section 3.3), the audit rules (section 13), the reset semantics (section 12.4), the seed clock rule (section 8.5) |
| Row 17 (data-analyst, client integration) | The operation tables (section 7), the realtime protocol (section 9), the change-propagation table (section 4.7), the credentials each client holds (sections 5, 6) |
| Row 18 (plan) | Module list, parameters, test names and the skipped row 41 (sections 2.2, 11, 19.5) |
| Row 20 (security-review) | SR-01 to SR-67 as reviewed, the out-of-scope list and the deviations it ruled on (sections 15, 18); revision 2 carries its corrections (SR-68 to SR-82) |
| Rows 25-56 (W03, W04, W08 to W11, W16, W17, W19 to W29, W32 to W43, W45, W47 to W49, W52, W53, W58; coder-execution, test-expert) | Numbered requirements and acceptance criteria per module |

### 1.3 Timeline

| When (2026-10-04, WIB) | Event | Source |
|---|---|---|
| 02:36 | Decision record accepted (row 14) | [DEC:D11] |
| 02:50-03:14 | This specification (row 15, wave M1) | `date` printed `2026-10-04 02:50 WIB` at the start of the row |
| 03:53, 04:02 | Rows 16 (database contract) and 17 (client integration) accepted | [DEC:D14, D15] |
| 04:03-04:25 | Security design review (row 20): verdict CAUTION, 0 Critical, 0 High, 5 Medium, 18 Low, 6 Info | [DEC:D16]; `gateway_check/03_security_design_review.md` |
| 04:41-05:09 | **Revision 2 of this file** (controller row 20b): every correction of the review folded in; the rulings of D13 to D16 stated as decided | `date` printed `2026-10-04 04:41 WIB` at the start of the revision |
| 05:52 | Masterplan consistency check (row 19): PASS-WITH-NOTES; D17 to D20 recorded | `gateway_check/02_masterplan_consistency.md`; [DEC:D17 to D20] |
| 06:04 | **Revision 2.1 of this file**: text only, findings C-01, C-03, C-04, C-11 and C-12 of that check | this file's revision history |
| Next | Rows 21 and 22 [BP:488-493]. The docs commit of row 22 is the reference time for SC1 [BP:295] | |

No duration estimates are given [AN:69].

### 1.4 Scope

- **In scope**: architecture with the process and port model; state ownership; the API contract for the 13 feature areas; the RBAC model; sign-in, session, lockout, idle expiry; the pairing lifecycle; the server-side engine with restart recovery; the realtime protocol; the mode contract; media serving; demo controls; security requirements; acceptance criteria; traceability [BP:288].
- **Owned by sibling files, only referenced here**: tables, columns, constraints and the seed mapping (row 16); the Live source, the mode switch, the two new portal pages and every client screen (row 17); work rows, serial slots, the Host Impact Register and the run commands (row 18).
- **Out of scope by decision**: real hardware, real PKI or mutual TLS, TLS on loopback, an external identity provider, WebAuthn, production hardening, iOS, a Live release APK, a live package for another PC [RT:141-147; AN:836-847; DEC:D11 TD-13].
- **Not done by this row**: no install, no code, no process. One file is written. Revision 2 (row 20b) changed two documents only: this file and `04_client_integration_spec.md`; the database contract and the plan are revised by their own agents and are referenced, not edited.

### 1.5 Rationale and evidence chain

| Step | Fact | Source |
|---|---|---|
| 1 | Both clients run their own simulator and share nothing; RBAC is a static client-side table; pairing compares a code with a constant inside the app | [RT:51-55]; `packages/shared/src/sim/auth.ts:46-67`; `packages/shared/src/sim/pairing.ts:19-56` |
| 2 | 25 of the 42 simulator actions check no permission; only the three export paths audit a denial; no action edits an operator or a role; no device list exists | [R1:80-86]; [DEC:F14] |
| 3 | The contract has 10 operations, none for sign-in, pairing, lists, administration or demo controls; reads carry no permission | [R2:99-107]; [DEC:F4] |
| 4 | The simulator's domain logic is platform-neutral and both clients bind to its state shape through `useSim` | [R1:98]; [R3:50]; [R4:47] |
| 5 | Therefore: the server hosts the shared simulator core for the domain behaviour, and replaces identity, RBAC, pairing, persistence and the clock with server-native modules | [DEC:D11 ADQ-1]; [AN:520] |
| 6 | Therefore: every operation gets one access rule and one audit rule in the shared registry, and the server refuses a route without them | [DEC:D11 TD-07]; [AN:408] |
| 7 | Therefore: a client learns of a change (state, role, revocation) from a socket that is authenticated at the upgrade and that the server closes when access ends | [DEC:D11 TD-08, ADQ-6]; [R8:418] |

### 1.6 Method

1. Read the decision record (TD-01..TD-13, ADQ-1..ADQ-10, the security boundary, the gap register), the binding decisions D1-D12, the translated task, blueprint rows 15-18 and 23-118, the simulator inventory (all 42 actions, 33 slices, 44 audit and 46 event types, the error layers) and the contract inventory (10 operations, 18 schemas, the pinned test assertions).
2. Read the exact shapes in code where a table of this file depends on them: `packages/shared/src/api/core-api.ts`, `constants.ts`, `health.ts`, `realtime-messages.ts`, `patterns.ts`; `packages/shared/src/sim/types.ts:884-1094`, `vocabulary.ts`, `auth.ts`, `constants.ts`, `pairing.ts`, `api.ts:347-431,498-522`.
3. Checked with read-only greps how the clients gate today's unchecked actions, so that the new server rules match what the screens already show: notes and markers on `SESSION_NOTE`, recovery on `SESSION_START` (`apps/core-web/src/features/session-monitor/model.ts:69-70`, `action-bar.tsx:99`; `apps/mobile/src/features/session-recovery/sim-adapter.ts:40`).
4. Designed to D11. Where a D11 wording and a finding disagree, the point was marked as a departure and put to the controller with the evidence and the smallest alternative (section 19.3; all are decided). Where D11 leaves a value open, the value is chosen here and listed in section 19.
5. Counted every table mechanically while writing: 75 operations (10 existing, 65 new), 42 actions mapped (40 to operations, 2 recorded exclusions), 12 permissions, 18 grants, 53 audit types (44 existing, 9 new), 5 realtime topics.
6. Revision 2: read the security design review in full (checklist, findings SD-01 to SD-29, reasoning, rulings, ordered corrections, residual risks) and the decisions D13 to D16 with DR-03. Each correction whose owning document is this file was written into the section where its rule lives, so the body states one rule and no patch note. Where the review leaves a value open ("either ... or", "for example"), the value is chosen here and listed in section 19.6 for the controller. Where a correction and an accepted decision disagreed, the point was put to the controller instead of being settled silently (two such points: CF-1, at AC-B-76, and CF-2, at SR-78), and so was one defect of revision 1 that the decision table of SD-02 exposed (OP-1, GS-29). All three are DECIDED [DEC:D18] (section 19.6). The counts were re-run on the revised file: 75 operations, the access-rule counts and the matrix are unchanged; the lists end at SR-82 and AC-B-93.
7. Revision 2.1: read the masterplan consistency check (`gateway_check/02_masterplan_consistency.md`, verdict PASS-WITH-NOTES) and the decisions D17 to D20 with DR-04. Text only: the five points that D18 ruled are marked DECIDED and their open wording is removed (finding C-01); the superuser is used at provisioning only (C-03); the folder table follows the plan (C-04); the front matter names the binding decisions (C-11); every cited provisional row carries its work rows (C-12). No rule changed: in each case the text this file already stated is what was ruled. No ID was renumbered.

### 1.7 Alternatives considered

| Alternative | Why not |
|---|---|
| REST resources per feature as the only read path (no state replication) | [DEC:D11 ADQ-2] fixes a Live source behind `useSim`; 139 web and 96 mobile production files bind to the state shape [AN:535] |
| Permission-specific reads (a view permission per page) | The simulator shows every page to every role and the matrix is read-only (Q9); new view permissions would change the Simulated matrix and its tests without adding to SC4. Recorded as GS-02 |
| A fourth "administrator" role | Q10 keeps three roles [DEC:D4]; the three new permissions go to SUPERVISOR [DEC:D11] |
| Serving demo media from the server | Section 11: the files are build-time assets of both clients, identical by hash, and a newly sealed item has no media in either design [R2:522, R2:580] |
| REST verbs PUT, PATCH, DELETE for the new operations | The contract type allows `get` and `post` only (`core-api.ts:377`); GET-reads and POST-commands give one simple Origin rule ("every POST is state-changing"). Section 7.1 |
| One composite start operation for precheck, acknowledge and start | The design-book operation `startSession` stays as it is (I10), and three precise operations are added so that each Live action has one operation and one audit type (section 7.8) |
| Keeping the audit chain across a demo reset | The shared reset rebuilds the chain from a freshly built history [R1:96]; D11 fixes "reset by re-creating the database" (TD-04). Section 12.4 states what must survive |
| CSRF tokens instead of the Origin guard | The guidance lists Origin verification as a defence [R10:268]; tokens would have to be carried by both clients [AN:397]. The guard is kept and tightened to two lists (section 14.2) [SDR:§1.7] |
| A second request counter after authentication, with the first one left before it (the other form the review offers for the throttle key) | The first counter could not know which requests to count before the credential is resolved. One counter after the credential is resolved gives one rule: the key is the resolved principal or a fixed class (section 2.3, ID-P12) |
| Keeping the cookie's `Max-Age` and listing the persistent cookie as one more accepted deviation | The controller accepted 17 residual risks and a persistent session cookie is not among them; a browser-session cookie removes the deviation at no cost (ID-P7) [SDR:SD-24] |
| A separate short-lived process for the reset, so that the owner credential never enters the server's address space | Inside one uid the server can read the password file anyway, and a process boundary adds exit-code mapping, an orphaned child and a time-out to the most delicate routine. The owner role is made a non-superuser instead (section 12.4) [SDR:§5.2] |

### 1.8 Assumptions

Assumptions AS-01 to AS-10 of the decision record stay in force [AN:86-97]. This file adds:

| ID | Assumption | Effect if wrong | Proven by |
|---|---|---|---|
| SA-01 | Fastify runs `onRequest` hooks before the body is parsed and validated (hook order as quoted in [R8:269]; the parsing position is general knowledge, not in the research) | The guard moves to the earliest hook that precedes validation; error precedence in section 7.3 changes for malformed bodies only | Row 33 (W23, W28) |
| SA-02 | The Vite dev proxy forwards `Origin`, `Cookie`, `Set-Cookie` and the `x-dems-*` response headers on HTTP and on the socket upgrade (extends AS-07) | Fallback of ADQ-6: cross-origin calls with CORS and credentials | Row 62 (W05, W50, W54) |
| SA-03 | React Native `fetch` sends no `Origin` header and no cookie; React Native's socket constructor takes an `Authorization` header and may add an `Origin` equal to the origin of the URL it opens ([R8:406] for the header option; the comment at `packages/shared/src/api/constants.ts:28` for the Origin; the `fetch` part is not in the research; none of it was run) | Nothing changes for either outcome: the Origin rules of section 14.2 accept an absent Origin and the instance's own origin on a request that carries no cookie. If React Native sends some other value, the own-origin list gains that exact value after a security review | Rows 58, 59 (W12, W30) |
| SA-04 | The shared `Sim` can be rehydrated from a snapshot assembled from PostgreSQL, through its `storage` option or `store.setState` (extends AS-03; options listed in [R1:473]) | Fallback (C) of ADQ-1: the pure transition functions with a server-owned loop | Row 37 (W04, W26) |
| SA-05 | `inject(POWER_FAIL)` moves a session in PRECHECK, ARMED, RECORDING, STOPPING or FINALIZING to FAULT [R1:223] | The restart path writes its own transition; SIM-GAP | Row 37 (W04, W26), row 55 (W53) |
| SA-06 | The buffer thresholds for meter frames (64 KiB skip, 4 MiB close) keep the meters smooth; no source gives a number for `ws` [AN:426] | Tune the two constants; lower the wire rate | Row 110 (W98) |
| SA-07 | `crypto.randomInt` is available and uniform on Node 26.8.2 (general knowledge; not in the research) | Draw from `crypto.randomBytes` with rejection sampling | Row 36 (W32) |
| SA-08 | The reset routine can carry the identity and pairing rows across the database re-creation (section 12.4) | Reset signs every operator out and unpairs every device; recorded as drift | Row 16 design, row 48 (W29, W43) |
| SA-09 | The seed produces 82 audit rows and 59 events; both counts are static derivations, never executed [R2:431, R2:440] | The acceptance criterion compares with the shared function's output, not with the two numbers (AC-B-02) | Row 29 (W20) |
| SA-10 | An `AUDIT_TAMPER` fault can be modelled as an alteration of the engine-held ring only (section 12.3) | The fault kind is refused in Live mode with `COMMAND_UNSUPPORTED`; recorded as drift | Row 37 (W04, W26) |
| SA-11 | The numbers of ID-P12 and ID-P13 (throttle 30 and 600 per 60 s, denial budget 20 per 60 s) and of RT-P6 (16 connections, 6 of them anonymous) do not hinder a presenter (no source; chosen here; accepted as proposals by row 20, [SDR:§6]) | Raise the constants | Rows 32, 33, 38, 106 (W09, W23, W24, W28, W41, W42, W95) |
| SA-12 | The message of a V8 `JSON.parse` error can quote a fragment of the input (general knowledge; not in the research) | The rule "a parse failure is logged by its code only" (SR-48) stays right; it is then not needed for this reason | Row 32 (W09, W23, W24, W41) |
| SA-13 | `@fastify/helmet` 13.1.1 can produce the header set of OR-9 through its options and can switch off the headers this design does not send (the option names are not in the research) | The missing or unwanted header is handled in the `onSend` hook that already sets `Cache-Control` | Row 25 (W03, W08) |
| SA-14 | `rate-limiter-flexible` 11.2.1 with its memory store can hold the denial budget of ID-P13: a counter that is consumed when a refusal row is written, read at the throttle stage, and reset or advanced by a test (not in the research) | A counter of a few lines inside the guard would be a new hand-built element and needs the controller's approval under I1 | Row 33 (W23, W28) |
| SA-15 | A PostgreSQL role that is not a superuser but may create databases can do everything the reset needs (create from `template0`, rename inside a transaction, drop), cannot set `session_replication_role`, and cannot create a role (general PostgreSQL knowledge; the statements are the database contract's) | The role design returns to the security review; its recorded alternative is a separate short-lived reset process [SDR:§5.2, option b]. The server never falls back to the superuser | Row 23 (W03, W07) trial, row 28 (W10, W11, W17) |
| SA-16 | A browser treats a cookie without `Max-Age` and `Expires` as a browser-session cookie; some browsers restore such a cookie together with a restored session (general knowledge) | The cookie lives longer than one browser run; the server-side idle and absolute limits bound it either way | Row 64 (W55) |

---

## 2. Architecture

### 2.1 Process and port model

Every listener binds `127.0.0.1` explicitly; the host is a constant in code and cannot be configured (SR-01; U4, [RT:226]).

| ID | Process | Listener | Source | Used in Live mode | Used in Simulated mode |
|---|---|---|---|---|---|
| P-1 | PostgreSQL 18.4 (`embedded-postgres` binaries driven by `scripts/pg/`) | `127.0.0.1:4432`, TCP only, Unix socket disabled | [DEC:D11 TD-02]; [AN:269-275] | Required | Not used |
| P-2 | Core server `@dems/core-server` 0.2.0 (Fastify 5.12.5, run with `tsx`) | `127.0.0.1:4420`, HTTP and WebSocket path `/ws`; lane instances on 4421-4423 with their own databases | [DEC:D11 TD-01, ADQ-5, ADQ-8, ADQ-10] | Required | Not used |
| P-3 | Web dev server (Vite) | `127.0.0.1:5173`; lanes 5176-5178 | [AN:583]; [BP:427-430] | Serves the console and proxies `/api/v1` and `/ws` to P-2 | Serves the console; the proxy is never used |
| P-4 | mock-core (unchanged) | `127.0.0.1:4400` | `packages/shared/src/api/constants.ts:8-10`; P5 [BP:438] | Not used | Health and heartbeat (HEARTBEAT source) |
| P-5 | Packaged launcher 0.1.0 (unchanged) | `127.0.0.1:4410`-`4419` | [R5:38] | Not used | The offline edition |
| P-6 | Android app, debug build, on an emulator | none (client) | [AN:612] | Reaches P-2 through `adb reverse tcp:4420 tcp:4420`; a lane maps `tcp:4420` to `tcp:442x` [AN:660] | In-app simulator |

Ports of another project (`[::1]:5173`, `127.0.0.1:5174`, `[::1]:5175`) are never bound [BP:427].

| # | Connection | Transport | Credential on the wire |
|---|---|---|---|
| C-1 | Browser to P-3, same origin: `/api/v1/*` and `/ws` | HTTP and WebSocket on loopback | Session cookie (section 5.3) |
| C-2 | P-3 proxy to P-2 | HTTP and WebSocket on loopback | The proxy forwards the cookie and the `Origin` header unchanged (SA-02) |
| C-3 | Mobile app to P-2 through `adb reverse` | HTTP and WebSocket on loopback | `Authorization: Bearer` with a device credential or a session token (sections 5.3, 6.3) |
| C-4 | P-2 to P-1, runtime (the application's pool, always) | TCP, password authentication (`scram-sha-256`) as role `dems_app` | Five discrete connection fields in the git-ignored `.data/pg.env`, mode 0600 (section 14.1) [AN:272-273] |
| C-5 | Migration, seed, reset, status and test-database commands to P-1; **and one connection of P-2, opened only for the duration of a demo reset and only when the demo flag is on** (DC-5) | TCP as role `dems_owner`, the owner of the project's databases and objects, which is **not a superuser** | The owner-role file `.data/pg.owner.env`, mode 0600 (section 14.1) |
| C-6 | The provisioning scripts under `scripts/pg/` to P-1, **at provisioning only**: `initdb`, creating the two other roles, and trial step T5-j (the superuser trigger check, [DB:§7.1]). Removal needs no connection, and after the provisioning row nothing connects as `dems_admin` [DEC:D19, D20] | TCP as role `dems_admin`, the bootstrap superuser that `initdb` creates | `.data/pg.pwfile`, mode 0600 [AN:272]. **No file under `apps/core-server/` opens it** (SR-68) |

No other connection exists. The server opens no outbound connection (SR-03).

**Three database roles** [DEC:D16; DEC:DR-03; SDR:SD-01]. The roles, their attributes and their privileges are defined in the database contract [DB:§7.1]; this file states what the running server may hold. It holds `dems_app` always. It holds `dems_owner` only while a demo reset runs, and only when the demo flag is on. It never holds `dems_admin`: a superuser session could skip the triggers that keep the audit table append-only (**hypothesis**: through the session setting `session_replication_role`; row 28 (W10, W11, W17) confirms), so the guarantee would not hold for the very connection that resets the database.

### 2.2 Server modules

Folder names follow the blueprint sketch [BP:200-202]. Each hand-built element approved in [DEC:D12] lives in one folder, except HB-13: its host half is in `engine/` and its mapping half in `db/mapping/` [DEC:D17], and the writers and the queue it uses are in `core/`.

| Folder under `apps/core-server/src/` | Responsibility | Hand-built element | Specified in |
|---|---|---|---|
| `plugins/` | Configuration loader (it also reads the database connection files itself, section 14.1), logger with redaction, error envelope, response headers (`@fastify/helmet` 13.1.1 and one `onSend` hook, OR-9), database pool, Origin guard, `authenticate` hook, permission guard, throttle and denial budget | HB-5, HB-6, HB-7 | 2.3, 4.6, 5, 14.2, 15 |
| `core/` | Audit writer, event writer, transaction helper, server clock; the serial unit-of-work queue of ENG-1 and ENG-23, which the engine host shares [DEC:D20] | part of HB-13 | 8.2, 8.3, 8.4, 13 |
| `engine/` | Engine host: headless `Sim`, command pipeline, actor scope, write-through, rehydration | HB-13 (the host half) | 8 |
| `realtime/` | Socket route, connection registry, topic registry, send policy | HB-8 | 9 |
| `modules/identity/` | Sign-in, sessions, lockout, biometric token | HB-4, HB-5 | 5, 7.5 |
| `modules/rbac/`, `modules/admin/` | Matrix read, user list, role assignment, enable and disable | HB-7 | 4, 7.6 |
| `modules/pairing/` | Pairing code, redeem, registry, revoke, unpair, credential rotation | HB-10 | 6, 7.7 |
| `modules/sessions/`, `evidence/`, `devices/`, `storage/`, `network-time/`, `security-audit/`, `system/`, `alerts/` | The domain operations: validate, call the engine, shape the answer | none | 7.8-7.15 |
| `modules/demo/` | Demo flag, scenario load, fault injection; it calls the reset routine of `db/reset/` | none | 12 |
| `modules/health/` | Service health with readiness | none | 7.4 |
| `db/schema/`, `db/migrations/`, `db/seed/`, `db/fixtures/` | Row 16 | HB-2 | 03_database_contract |
| `db/commands/`, `db/mapping/`, `db/reset/` | The `db:*` commands; the slice-to-table mapping in both directions; the reset routine (and `db:reset`), which the demo module calls and the command line runs [DEC:D17] | HB-13 (the mapping half), HB-3 | 03_database_contract; 12.4 |

`modules/evidence-files/` of the blueprint (row 41) is **not built**: section 11.

### 2.3 Request pipeline

One order for every REST request. The stage decides which error a caller sees first (section 7.3).

| # | Stage | Fastify hook | What it does | Error it can produce |
|---|---|---|---|---|
| 1 | Routing | router | Matches method and path to a registry operation | 400 `INVALID_PATH`, 404 `NOT_FOUND`, 405 `METHOD_NOT_ALLOWED` |
| 2 | Readiness | `onRequest` | Refuses everything except `getServiceHealth` while the database or the engine is not ready or a demo reset runs | 503 `NOT_READY` |
| 3 | Origin guard (HB-6) | `onRequest` | Classifies the `Origin` header (absent, a web console origin, one of the instance's own origins, anything else) and the credential headers that are present, and applies the decision table of section 14.2 | 403 `ORIGIN_NOT_ALLOWED` |
| 4 | `authenticate` (HB-5): resolve | `onRequest` | Reads **at most one** credential and resolves it to a principal or to none (section 4.1). A missing, unknown, expired or retired credential is not refused here: it resolves to none, and stage 6 answers. Only a request that presents two credentials is refused (ID-12) | 401 `NOT_SIGNED_IN` with `details.reason: CREDENTIAL_CONFLICT` |
| 5 | Throttle and denial budget | `onRequest` | `@fastify/rate-limit` 11.2.0, keyed by the **resolved principal**, else by one of two fixed classes; then the denial budget of the same key (ID-P12, ID-P13). The key is never a value the caller chose | 429 `RATE_LIMITED` |
| 6 | Access rule (HB-7) | `onRequest` | Requires the principal that the operation's access rule names; applies the rule; writes the denial audit row and counts it against the denial budget; then checks the demo flag for demo operations | 401 `NOT_SIGNED_IN`, 403 `DEVICE_REVOKED`, 403 `NOT_PERMITTED`, `FORBIDDEN`, `DEVICE_NOT_PAIRED`, `DEMO_DISABLED` |
| 7 | Parsing and validation | body parser, then the zod compilers of `fastify-type-provider-zod` 7.0.0 | Body limit 65,536 bytes; schema from the registry | 413 `PAYLOAD_TOO_LARGE`, 400 `INVALID_JSON`, 422 `INVALID_INPUT` |
| 8 | Handler | handler | Every handler that changes state submits **one unit of work to the engine pipeline** (section 8.2): server-native modules and domain operations alike. Only the Argon2id computation of a sign-in runs outside the pipeline (ENG-23 to ENG-27) | 401, 404, 409, 422, 423 |
| 9 | Commit | pipeline | One PostgreSQL transaction; the answer is sent after the commit [AN:520] | 500 `INTERNAL_ERROR`, 503 `NOT_READY` |
| 10 | Publish | realtime | Deltas and control events go out; the answer carries the state revision (section 7.1) | none |

Stages 3-6 run before the body is read, so a caller without the right learns nothing from a validation message and the denial audit row never contains request data. The simulator's REST layer has the same order for its permission check ("Runs before any other check, so a signed-out caller learns nothing", `packages/shared/src/sim/api.ts:349-362`). The decision record names `preHandler` for the guard [AN:408]; this is DEPARTURE-4, which the controller accepted [DEC:D13].

Why the credential is resolved before the throttle: the throttle key must be the resolved principal or a fixed class, never a value taken from an unverified header, or a caller could mint a fresh key with every request [SDR:SD-12]. The price is one indexed lookup before the throttle for a request that presents a credential (GS-26). A value that does not resolve is counted in the class bucket, so it gains nothing.

### 2.4 Configuration

Names are proposals for row 18; values are fixed here.

| Item | Value | Configurable | Source |
|---|---|---|---|
| Listen host | `127.0.0.1` | No (constant) | SR-01; [AN:583] |
| Listen port | 4420; an environment variable may set 4421-4423 for a lane, any other value is refused at boot | Yes, within 4420-4423 | [AN:583, AN:660] |
| Database connection (runtime) | Read by the server's own loader from `.data/pg.env`: five discrete fields (host, port, database `dems_demo` or `dems_lane_n`, user `dems_app`, password). No connection URL (section 14.1) | By that file | [AN:272-274]; [SDR:SD-15] |
| Database connection (reset) | Read from the owner-role file `.data/pg.owner.env` (user `dems_owner`) at the moment a reset starts, and only when the demo flag is on. With the flag off the file is never opened | By that file | DC-5; [SDR:SD-01] |
| Demo flag | Off unless the environment sets it; read once at boot; never changeable through the API | Yes, at start only | Q14 [DEC:D4]; SR-57 |
| Web console origins | `http://127.0.0.1:5173`, `http://127.0.0.1:5176`, `http://127.0.0.1:5177`, `http://127.0.0.1:5178`. **No `localhost` entry.** Used by web sign-in and by every request that carries the cookie (section 14.2) | No (constant list in the server's configuration module; `WEB_DEV_ORIGINS` is not edited) | [AN:596]; D9 DN-5; [SDR:SD-07]; [DEC:D16] |
| The instance's own origins | `http://127.0.0.1:4420`, the address every app uses through `adb reverse` (P-6), and on a lane instance also `http://127.0.0.1:<its listen port>`. Accepted only on a request that carries no cookie (section 14.2) | No (derived from the listen port) | [SDR:SD-02]; GS-23 |
| Session cookie name | `dems_session_<listen port>`: `dems_session_4420` on the main instance, `dems_session_4421` to `_4423` on the lanes (ID-P7) | No (derived from the listen port) | [SDR:SD-08]; [DEC:D16] |
| Shared constants | Additive values beside the existing ones in `packages/shared/src/api/constants.ts`: backend host, port 4420, HTTP origin, socket URL, service name `dems-core-server`; no existing value changes, so the launcher guard stays green | — | [AN:583]; [R5:37] |
| Log level | Environment variable; default `info` | Yes | — |

---

## 3. State ownership

### 3.1 Classes

| Class | Meaning | Restart |
|---|---|---|
| **S** stored | A PostgreSQL table row, written inside the transaction of the command or engine step that changed it | Restored |
| **SN** snapshot | Engine-held simulated-hardware state, written to the one-row hardware snapshot (one column per slice, [DEC:D14]) at most once a second when changed and at shutdown [AN:567] | Restored (at most one second old) |
| **E** engine-held | Lives only in the engine; rebuilt at start | Fresh |
| **M** memory | Server-native state held in memory: the lockout counters, the throttle and denial-budget counters, the socket registry, the verified position of the stored audit chain | Fresh |
| **X** streamed only | Sent on the socket, never written (Q4, [DEC:D4]) | Fresh |

### 3.2 The 33 simulator slices

Slice list and declared types: `packages/shared/src/sim/types.ts:849-884` [R1:245-279]. "Replicated" = the slice is part of the `state` topic (section 9.3). 28 slices are replicated; `audio` is streamed; `clock`, `auth`, `authLockout` and `pairing` are built on each client from other sources (28 + 1 + 4 = 33).

| # | Slice | Class | Authority and writer in Live mode | Reaches a client as |
|--:|---|---|---|---|
| 1 | `meta` | S (counters), E (seed, epoch) | Engine; counters written with the rows that consume them | Replicated |
| 2 | `clock` | E | The server clock (section 8.4) | Derived on the client from `serverTime` in the heartbeat |
| 3 | `device` | S | Engine (changes only after a software update) | Replicated |
| 4 | `operators` | S | **Server-native** (operators table); mirrored into the engine before every command and after every administration change [AN:520] | Replicated (identity fields and role only, `types.ts:231`; never `enabled`, never a hash) |
| 5 | `auth` | S (auth sessions) | **Server-native**. The engine's `auth` slice is only the actor scope of one command and is signed out between commands (ENG-2) | Per connection: filled from the session operations (section 7.5) |
| 6 | `authLockout` | M | **Server-native** (`rate-limiter-flexible`, memory store) [AN:393]; G-26 | Per console: from sign-in answers and `getSignInStatus` |
| 7 | `pairing` | S (devices, pairing codes) | **Server-native**. The engine's `pairing` slice is not used | Per device: from the pairing operations (section 7.7) |
| 8 | `tabletLink` | SN, recomputed at start (section 8.6) | The server sets it from real connections through the hosted `setTabletLink` action (section 6.8) | Replicated |
| 9 | `session` | S | Engine. State transitions are written at once; the 1 Hz progress fields are coalesced to one write a second | Replicated |
| 10 | `lastSealedSessionId` | S | Engine | Replicated |
| 11 | `lastSealedAcknowledged` | S | Engine | Replicated |
| 12 | `sessionHistory` | S | Engine | Replicated |
| 13 | `activeCameraId` | SN | Engine | Replicated |
| 14 | `cameras` | SN | Engine (derived) | Replicated |
| 15 | `mics` | SN | Engine | Replicated |
| 16 | `audio` | X | Engine, 20 Hz (`packages/shared/src/sim/constants.ts:26`) | `meters` topic |
| 17 | `storage` | SN | Engine (1 Hz) | Replicated |
| 18 | `storagePolicy` | S | Engine | Replicated |
| 19 | `time` | SN | Engine | Replicated |
| 20 | `network` | SN | Engine | Replicated |
| 21 | `security` | SN | Engine | Replicated |
| 22 | `services` | SN | Engine | Replicated |
| 23 | `health` | SN, plus one stored health snapshot every 60 s (Q4) | Engine (1 Hz) | Replicated |
| 24 | `otherDevices` | SN | Engine (derived) | Replicated |
| 25 | `ports` | SN | Engine (derived) | Replicated |
| 26 | `evidence` | S | Engine | Replicated |
| 27 | `events` | S (every row; the engine keeps a ring of 500) | Engine and server-native writers through one function (section 8.3) | Replicated ring, then appends |
| 28 | `alerts` | S | Engine | Replicated |
| 29 | `audit` | S (every row; the engine keeps a ring of 1,000, `constants.ts:35-36`) | Engine and server-native writers through one chain (section 8.3) | Replicated ring, then appends |
| 30 | `faults` | SN | Engine | Replicated |
| 31 | `diagnostics` | SN | Engine | Replicated |
| 32 | `update` | SN | Engine | Replicated |
| 33 | `settings` | S | Engine | Replicated |

Note for row 16: the decision record's list of snapshot-row slices does not name `storage` and `activeCameraId` [AN:567]; this table assigns both to the snapshot row.

### 3.3 Stored entities (input for row 16)

Every entity below needs a table (or columns of a table) in `03_database_contract.md`. Shapes cite the shared type; row 16 chooses table and column names. E-01 to E-25 are the entities of revision 1 (29 tables in the contract's revision 1, [DEC:D14]); E-26 was added by revision 2 and is the contract's thirtieth table, `audit_chain_history` [DB:§4.30].

| ID | Entity | Shape | Written by |
|---|---|---|---|
| E-01 | Operator | `SimOperator` (`types.ts:231`) plus `enabled`, the password hash set of SR-06, `lastSignInAt`, `roleChangedAt` | Seed; `assignUserRole`, `enableUser`, `disableUser`; sign-in |
| E-02 | Role | 3 values (`vocabulary.ts:16-21`) | Seed |
| E-03 | Permission | 12 values (section 4.3) | Seed |
| E-04 | Role-permission grant | 18 rows (section 4.4) | Seed (read-only in this task, Q9) |
| E-05 | Auth session | token hash, operator, device or null, method, issued, last seen, absolute expiry, ended, end reason (the closed set of section 5.4, `TOKEN_REUSE` included) | Identity module |
| E-06 | Paired device | section 6.5 | Pairing module |
| E-07 | Device credential | current hash, next hash, rotated at (may be columns of E-06) | Pairing module |
| E-08 | Pairing code | section 6.2 | Pairing module |
| E-09 | Biometric token | hash, device, operator, family, issued, expires, used, revoked | Identity module |
| E-10 | Audit row | `AuditRow` (`types.ts:769-789`): the 12 hashed body fields [R1:668] plus `prevHash`, `hash` | The one chain writer (section 8.3) |
| E-11 | Operational event | `SimEvent` (`types.ts:740`) | Same pipeline |
| E-12 | Active session | `ActiveSession` (`types.ts:369`) with precheck, timeline, notes, fault | Engine |
| E-13 | Session history entry | `SessionHistoryEntry` (`types.ts:397`) | Engine |
| E-14 | Evidence item | `EvidenceItem` (`types.ts:699`) | Engine |
| E-15 | Evidence track | `EvidenceTrack` (`types.ts:663`); AUDIO-01 and AUDIO-02 stay separate rows (I11) | Engine |
| E-16 | Custody entry | `CustodyEntry` (`types.ts:678`) | Engine |
| E-17 | Export record | export ID, scope (evidence, audit, logs), evidence or null, operator, reason, destination, time | Engine |
| E-18 | Alert | `SimAlert` (`types.ts:753`) | Engine |
| E-19 | Storage policy | `StoragePolicy` (`types.ts:513`) | Engine |
| E-20 | Console settings | `SettingsSlice` (`types.ts:836`) | Engine |
| E-21 | Counters | `meta.counters` (`types.ts:194`) plus two server-native counters: device, pairing code. The two server-native counters are kept across a reset, so an identifier is never minted twice [DEC:D14] | Engine; pairing module |
| E-22 | Core device record | `DeviceSlice` (`types.ts:222`) | Seed; engine |
| E-23 | Core state record | last sealed session ID and its acknowledged flag, seed, schema version, epoch (it continues: plus 1 at every start and at every reset, [DEC:D14]), `seededAt`, `lastResetAt`, loaded scenario | Engine; reset routine |
| E-24 | Hardware snapshot row | One row with one column per SN slice of section 3.2 [DEC:D14] | Engine, at most once a second |
| E-25 | Health snapshot | One row every 60 s and at every fault raise and clear; the 17 columns the database contract chose [DEC:D14]. No operation reads it in this task | Engine |
| E-26 | Audit chain lineage | One row per **discarded** audit chain: the epoch it ended in, its row count (head sequence), its head hash, the time of the reset, the actor (operator ID, or null from the command line), the scenario and the reason (`RESET` or `SCENARIO_LOAD`). No secret. Table `audit_chain_history` [DB:§4.30]; **it survives every reset** (section 12.4) [DEC:D16; SDR:SD-19] | The reset routine, under the owner role `dems_owner`. The runtime role `dems_app` has SELECT only (CF-2, DECIDED [DEC:D18]) |

Never stored: `audio` frames (20 Hz), `clock`, the lockout counters, the throttle and denial-budget counters, the socket registry, the state revision, the verified position of the stored chain.

---

## 4. RBAC model: permissions and role matrix

The server is the only authority. A client-side permission table is a display hint [AN:156]. The model stays flat: three roles (Q10), a fixed permission list, a read-only matrix (Q9), one role per operator [AN:408].

### 4.1 Principals

| Principal | Established by | Carries |
|---|---|---|
| ANONYMOUS | No credential; or one credential that resolves to nothing (unknown, expired, ended, presented on the wrong transport, or belonging to a device that is no longer PAIRED) | Nothing. For a retired device credential, or a session of a retired device, stage 4 keeps the device ID only so that stage 6 can answer 403 `DEVICE_REVOKED` with its audit row (RB-6); that is not a principal |
| DEVICE | A device credential (`dvc_`) in `Authorization: Bearer` whose device is in state PAIRED (section 6) | Device ID |
| OPERATOR (web console) | This instance's session cookie, resolving to a session row **that has no device** | Operator ID, role, permissions read from PostgreSQL for this request |
| OPERATOR (device) | A session token (`ses_`) in `Authorization: Bearer`, resolving to a session row **that is bound to a device** in state PAIRED | Operator ID, role, permissions, device ID |

A bearer value is told apart by its prefix: `dvc_` (device credential), `ses_` (session token); `bio_` is never sent in a header (section 5.6). **One credential per request, and a session is bound to its transport** (ID-12, ID-13): the cookie resolves only a session without a device, a bearer `ses_` value only a session with one, and a request that carries both the cookie and an `Authorization` header is refused. A session token whose device is no longer PAIRED does not resolve to a principal (403 `DEVICE_REVOKED`); its requests are counted in the class bucket of the throttle (ID-P12).

### 4.2 Access rules (one per operation)

| Marker | Meaning | Reason it exists |
|---|---|---|
| `PUBLIC` | Any caller on loopback | Health, and the two entry points that create a credential (pairing redeem, sign-in). Sign-in and its status read add the console rule ID-1 |
| `DEVICE` | A DEVICE principal, or an OPERATOR bound to a device | What a paired device may do before or without a sign-in (biometric sign-in, its own registration, unpair, credential rotation) |
| `AUTHENTICATED` | Any OPERATOR | Reads that every role sees today, and actions that are display preferences or housekeeping. Each use states its reason in the operation tables |
| a permission | An OPERATOR whose role holds it | Everything else |
| `ANY-OF(a, b)` | An OPERATOR whose role holds either | Exactly one operation, `setStoragePolicy`, as the simulator does (`packages/shared/src/sim/types.ts:1072-1073`; [AN:406]) |

### 4.3 Permission list (12)

Nine exist (`packages/shared/src/sim/vocabulary.ts:23-34`); three are new, additive values in the same module [DEC:D11 ADQ-9]. "Enforced at" lists the operations of section 7.

| # | Permission | State | Meaning | Enforced at (operation numbers) |
|--:|---|---|---|---|
| 1 | `SESSION_START` | existing | Control the session lifecycle | 24, 25, 26, 28, 29, 30, 31, 32, 33, 37 |
| 2 | `SESSION_NOTE` | existing, never checked today [R1:82] | Annotate a recording | 34, 35, 36 |
| 3 | `EVIDENCE_VIEW` | existing, never checked today [R1:82] | Read evidence and run a verification | 39, 40, 41 |
| 4 | `EVIDENCE_REVIEW` | existing | Archive evidence; change retention | 43, 55 |
| 5 | `EVIDENCE_EXPORT` | existing | Export evidence | 42 |
| 6 | `AUDIT_EXPORT` | existing | Export the audit log or the log bundle | 61, 62 |
| 7 | `DEVICE_MANAGE` | existing | Restart a device | 48 |
| 8 | `DIAGNOSTICS_RUN` | existing | Run diagnostics, test signal, identify | 49, 50, 65 |
| 9 | `MAINTENANCE` | existing | Restart services, software update; change retention | 55, 66, 67 |
| 10 | `PAIRING_MANAGE` | **new** | Issue and cancel a pairing code, list and revoke devices | 15, 16, 17, 19, 20 |
| 11 | `USER_ADMIN` | **new** | List users, assign a role, enable and disable | 11, 12, 13, 14 |
| 12 | `DEMO_CONTROL` | **new** | Scenarios, fault injection, reset (also needs the demo flag) | 71, 72, 73, 74, 75 |

Every permission has at least one enforcement point. `SESSION_NOTE` and `EVIDENCE_VIEW`, which are in the role table but checked nowhere today, gain theirs.

### 4.4 Role-permission matrix

Baseline: `ROLE_PERMISSIONS` (`packages/shared/src/sim/auth.ts:46-67`; [R2:389-401]). The three new permissions go to SUPERVISOR [DEC:D11]; no reason was found to place them elsewhere (section 19.1).

| Permission | INVESTIGATOR | SUPERVISOR | TECHNICIAN |
|---|:-:|:-:|:-:|
| `SESSION_START` | yes | yes | no |
| `SESSION_NOTE` | yes | yes | no |
| `EVIDENCE_VIEW` | yes | yes | yes |
| `EVIDENCE_REVIEW` | no | yes | no |
| `EVIDENCE_EXPORT` | no | yes | no |
| `AUDIT_EXPORT` | no | yes | no |
| `DEVICE_MANAGE` | no | no | yes |
| `DIAGNOSTICS_RUN` | yes | yes | yes |
| `MAINTENANCE` | no | no | yes |
| `PAIRING_MANAGE` | no | **yes** | no |
| `USER_ADMIN` | no | **yes** | no |
| `DEMO_CONTROL` | no | **yes** | no |
| Grants | 4 | 10 | 4 |

18 grants in all (15 today [R2:330] plus 3). The seeded operators: `OPR-001` INVESTIGATOR, `OPR-002` SUPERVISOR, `OPR-003` TECHNICIAN (`packages/shared/src/sim/dataset.ts:113-147`).

### 4.5 What each role can and cannot do (plain language)

| Task | Investigator | Supervisor | Technician |
|---|:-:|:-:|:-:|
| Sign in and out; open every status page (dashboard, devices, storage, network and time, security, system) | Yes | Yes | Yes |
| Read the audit log and the event list; check the audit chain | Yes | Yes | Yes |
| Open the evidence list and an evidence item; run an integrity verification | Yes | Yes | Yes |
| Create a session, run the pre-check, start and stop a recording (with a reason), cancel, recover after a fault, acknowledge the summary | Yes | Yes | **No** |
| Stop a recording that another operator started | Yes | Yes | **No** |
| Add a note, a marker or a snapshot during a recording | Yes | Yes | **No** |
| Archive an evidence item | **No** | Yes | **No** |
| Export an evidence item | **No** | Yes | **No** |
| Export the audit log or the log bundle | **No** | Yes | **No** |
| Change the retention policy | **No** | Yes | Yes |
| Run diagnostics; send a test signal; identify a device | Yes | Yes | Yes |
| Restart a camera or a microphone | **No** | **No** | Yes |
| Restart the Core services; start a software update | **No** | **No** | Yes |
| Acknowledge an alert; reset a clip indicator; switch the active camera; change display preferences | Yes | Yes | Yes |
| Issue a pairing code; see the paired devices; revoke a device | **No** | Yes | **No** |
| See the user list; change a role; enable or disable a user | **No** | Yes | **No** |
| Use the demo controls (scenarios, faults, reset), when the server has them enabled | **No** | Yes | **No** |
| See the role and permission matrix (read-only for everyone) | Yes | Yes | Yes |

In short: the **Investigator** runs interviews and can look at everything, but cannot export, archive, administer or repair. The **Technician** keeps the equipment running and can look at everything, but cannot run or annotate a session, export, archive or administer. The **Supervisor** can do what the Investigator does, plus export, archive, pairing, user administration and the demo controls, but cannot restart devices or services or start an update.

### 4.6 Enforcement rules

| ID | Rule | Source |
|---|---|---|
| RB-1 | Every operation in the shared registry carries exactly one access rule (section 4.2) and one audit rule (section 7.1). At boot an `onRoute` hook refuses any route without them | [AN:408]; [R10:475] |
| RB-2 | The rule is evaluated on every request, before the body is read (section 2.3). No result is cached across requests | [R10:475] |
| RB-3 | The operator's role and the role's permissions are read from PostgreSQL for each request. Nothing about privilege is stored in the session or the token, so a committed role change applies to the next request | [AN:393] |
| RB-4 | A refusal of an OPERATOR for a missing permission answers 403 and writes exactly one audit row before the answer: type `ACCESS_DENIED` (new, category SECURITY) with `actorId`, and details `operationId`, `permission`, `role`. An allowed call writes no denial row. The row counts against the caller's denial budget (ID-P13): once the caller's key holds 20 audited refusals within 60 s, the next request is answered 429 at stage 5 and never reaches the guard, so it is not a refusal of the guard and writes no row. "One row per refused call" therefore holds for every call the guard refuses | [AN:408]; SC4 [RT:301]; [SDR:SD-03] |
| RB-5 | For the three export operations (42, 61, 62) the denial row keeps today's type `EXPORT_DENIED` and the matching event, and the code stays `FORBIDDEN` for `exportEvidence`. This is DEPARTURE-3, which the controller accepted [DEC:D13] | [R1:170-173]; `packages/shared/src/api/core-api.ts:610-649`; [R4:56] |
| RB-6 | A 401 (no principal) writes no audit row, because no actor can be named; sign-in and pairing attempts are the exception and always write one (sections 5, 6). A 403 `DEVICE_REVOKED` writes one `ACCESS_DENIED` row with the device ID and `reason: DEVICE_REVOKED`. A retired device credential is not a principal, so that row counts against the denial budget of the **pre-authentication class bucket** (`class:local`, ID-P12): however many retired credentials are presented, together they write at most 20 such rows in 60 s | SC5 [RT:302]; [SDR:SD-03] |
| RB-7 | The hosted simulator actions keep their own checks (17 of 42, [R1:80]). They run after the guard under the caller's identity and agree with it, because the seeded matrix equals `ROLE_PERMISSIONS` and is read-only; a test asserts the equality | [AN:536] |
| RB-8 | Last-administrator rule: `assignUserRole` and `disableUser` are refused with 409 `LAST_ADMIN` when they would leave no enabled operator holding `USER_ADMIN` (edge case E4, [BP:170]). The check and the update it guards are **one unit of work** in the pipeline (ENG-27), so two concurrent requests cannot both pass the check and leave no administrator (AC-B-79) | [BP:308]; [SDR:SD-04] |
| RB-9 | The matrix cannot be changed through the API in this task (Q9 option b). `getRoleMatrix` returns `editable: false` | [DEC:D4] |
| RB-10 | Reading the replicated state needs only `AUTHENTICATED`, as every role sees every page today [R3:54]. The `evidence` slice is not filtered, because every role holds `EVIDENCE_VIEW` in the fixed matrix. If the matrix ever becomes editable, the `state` topic needs per-slice filtering (GS-08) | — |

### 4.7 Realtime protocol: session and device events (how a change reaches both clients)

"Push" messages are defined in section 9.4. Deadlines are measured from the commit. The last column is the observable that row 17 turns into screens.

| Trigger (operation) | Server effect in one transaction | Push | Effect on the next request | What the client must show |
|---|---|---|---|---|
| Role changed (`assignUserRole`) | Operator row updated; audit `ROLE_CHANGED`; the engine's `operators` mirror updated. **Sessions stay** (no sign-out) | Within 1 s: `session.updated` (new role and permission list) to every socket of that operator's sessions; a `delta` replacing the `operators` slice to every operator socket; `admin.changed` to holders of `USER_ADMIN`; the affected sockets' topic membership is re-evaluated | The new permissions apply at once (RB-3): a now-denied call answers 403 with an `ACCESS_DENIED` row | No re-login. Gates follow the new role within 1 s on the web and on the device; a notice names the new role; a page or screen that needs a lost permission is left |
| User disabled (`disableUser`) | Operator `enabled = false`; all of the operator's sessions ended (reason `USER_DISABLED`), biometric tokens revoked; audit `USER_DISABLED` | Within 1 s: `session.ended` then close 4401 on every socket of those sessions | 401 `NOT_SIGNED_IN`; a new sign-in answers the generic 401 `INVALID_CREDENTIALS` | The signed-out screen with a notice that the account was disabled |
| User enabled (`enableUser`) | `enabled = true`; audit `USER_ENABLED` | `admin.changed` | The operator can sign in again | Nothing on the affected client until sign-in |
| Device revoked (`revokeDevice`) | Device state REVOKED; its sessions ended (reason `DEVICE_REVOKED`), its biometric tokens revoked; audit `DEVICE_REVOKED`; event `UNPAIRED` | Within 1 s: `device.revoked` then close 4403 on every socket of the device; `admin.changed` to holders of `PAIRING_MANAGE`; the tablet link is re-evaluated (section 6.8) | 403 `DEVICE_REVOKED` for the device credential and for its session tokens | The device returns to the pairing screen with a notice; the stored credential is deleted. The portal list shows REVOKED |
| Session expired (sweeper) | Session ended; audit `AUTH_EXPIRED` | `session.ended` then close 4401 | 401 | The existing expired state [R3:67] |
| Sign-out | Session ended; audit `AUTH_SIGNED_OUT` | `session.ended` then close 4401 on that session's sockets | 401 | The login screen |
| A used biometric token presented again (`signInWithBiometric`, section 5.6 step 6) | The token's family revoked; the open sessions of that device and operator whose method is BIOMETRIC ended (reason `TOKEN_REUSE`); audit `AUTH_FAILED` (`details.reason: TOKEN_REUSE`, `details.sessionsEnded`) | Within 1 s: `session.ended` then close 4401 on the sockets of those sessions | 401 `NOT_SIGNED_IN` for those session tokens; the generic 401 for the token | The Login screen with a notice; biometric sign-in is off on that device until the operator enrols again with the password. A session created by password is not touched |
| A session operation by any client | Engine state change | `delta` to every operator socket | — | Both clients show the same session state (SC3) |

A role change does not renew the session identifier. OWASP asks for a renewal after a privilege change [R10:212]; here no privilege is stored in the session, and SC4 needs the operator to stay signed in [AN:398]. The deviation is G-11. Row 20 accepted it: the guidance aims at an identifier that carries or predates a privilege level, and here the token is issued after authentication, carries no privilege, and the role is read per request (RB-3); disable, revoke and unpair do end the session [SDR:§6]; [DEC:D16] (residual R-04).

---

## 5. Sign-in, session, lockout and idle expiry

Identity is server-native: the simulator's sign-in actions, its idle expiry and its lockout slice are not used [AN:520]. Hashing follows TD-05, the session model TD-06 [DEC:D11].

### 5.1 Parameters

| ID | Parameter | Value | Source |
|---|---|---|---|
| ID-P1 | Failed attempts before a lock | 5 within 300 s | `packages/shared/src/sim/constants.ts:51-52`; [RT:332] |
| ID-P2 | Lock duration | 60 s | `constants.ts:53` |
| ID-P3 | Lockout key | The client console: `web` for the web console, the device ID for a device. Never the IP address, because every client arrives from 127.0.0.1 | [AN:393-394] |
| ID-P4 | Idle timeout | 15 minutes from the server-side last-seen time | `constants.ts:54`; [R10:219] |
| ID-P5 | Absolute timeout | 8 hours from issue | [DEC:D11 TD-06]; [R10:219] |
| ID-P6 | Session token | 32 bytes from `crypto.randomBytes` (256 bits), base64url, prefix `ses_`; only its SHA-256 is stored | [AN:393]; [R10:205] |
| ID-P7 | Cookie | Name `dems_session_<listen port>` (`dems_session_4420` on the main instance): cookies are not isolated by port [R10:254], so a name per instance keeps the main console and the lanes from replacing each other's cookie, and from receiving each other's tokens, in one browser profile. `HttpOnly`; `SameSite=Strict`; `Path=/`; no `Domain`; no `Secure`; **no `Max-Age` and no `Expires`**: a browser-session cookie, because a bearer session secret should not be persistent [R10:233] (SA-16) | [AN:393]; [R10:212, R10:261]; [SDR:SD-08, SD-24]; [DEC:D16] |
| ID-P8 | Expiry sweep | At most every 5 s; also checked on every request | this file |
| ID-P9 | What counts as activity | A state-changing request (POST) and `touchSession`. GET requests and the socket do not extend a session, so an open page cannot keep itself alive | this file; the client sends `touchSession` at most once a minute [AN:557] |
| ID-P10 | Password input | 1 to 128 characters in the request body only | this file |
| ID-P11 | Biometric token lifetime | 30 days from issue; replaced at every use | [AN:452]; [R10:341]; the number is chosen here |
| ID-P12 | Request throttle | Counted per key over 60 s; a socket upgrade counts as one request. The key is the **resolved principal**, else one of two fixed **classes**; never a value the caller supplies. Keys and limits: the table below. Answer 429 `RATE_LIMITED` with `retry-after` | `@fastify/rate-limit` 11.2.0 [AN:393]; [SDR:SD-12]; numbers are SA-11 |
| ID-P13 | Denial budget | Per throttle key at most **20 audited refusals within 60 s**. Counted: every `ACCESS_DENIED`, `EXPORT_DENIED`, `AUTH_FAILED`, `AUTH_LOCKED`, `PAIRING_FAILED` and `PAIRING_LOCKED` row, against the key of the request that caused it. While a key holds 20, every REST request of that key except `getServiceHealth` is answered 429 `RATE_LIMITED` at stage 5 **without a further audit row** (one log line, GS-07). Socket upgrades write no denial row and are not blocked by the budget. Every refusal inside the budget is still audited, one row per refused call | [SDR:SD-03]; [DEC:D16]; the counter is one more limiter of `rate-limiter-flexible` 11.2.1 (SA-14), not a hand-built one; numbers are SA-11 |

**Throttle keys and limits (ID-P12).** The class is chosen by the Origin category that stage 3 found; it is one of two fixed values, not a value from the request.

| Key | Who | Counted at 30 per 60 s | Counted at 600 per 60 s |
|---|---|---|---|
| `class:web` | No resolved principal; the `Origin` is a web console origin: the POSTs and the socket upgrades of a signed-out console (its same-origin GETs carry no `Origin` and count in `class:local`) | Every request and socket upgrade except health | `getServiceHealth` |
| `class:local` | No resolved principal; the `Origin` is absent or one of the instance's own. This is the **pre-authentication bucket**: an unpaired device, a bearer or cookie value that does not resolve, and a **retired device credential** | The same | `getServiceHealth` |
| `device:<device ID>` | A DEVICE principal | Operations 2, 3, 8 and 9 (the sign-in entry points of a paired device) | Every other request and upgrade |
| `operator:<operator ID>` | An OPERATOR principal, on the web or on a device; all sessions of one operator share the key | — | Every request and upgrade |

### 5.2 Rules

| ID | Rule |
|---|---|
| ID-1 | **Console rule.** `signIn` is accepted from exactly two kinds of caller. (a) A web console: the request carries an `Origin` from the **web console origins** (section 2.4) and no `Authorization` header; the session is delivered **only** as a cookie and the body holds no token. (b) A paired device: the request carries a valid device credential; the session token is returned in the body and bound to that device; no cookie is set. Any other caller gets 403 `DEVICE_NOT_PAIRED`: a request with no `Origin` and no device credential, and equally a request whose `Origin` is one of **the instance's own origins**, which never counts as a web console (section 14.2). This is how pairing is mandatory for mobile in Live mode (Q5). `getSignInStatus` stays a GET, issues nothing and needs no console identity. It reads the lock state of one console key: the device's when the request carries a valid device credential, and only the web console's otherwise. It cannot be held to (a): a browser sends no `Origin` on a same-origin GET, which is the premise of OR-3, so the web login page could never read its lock state (OP-1, DECIDED [DEC:D18]) |
| ID-2 | Verification: look up the operator by the trimmed, lower-cased username (`auth.ts:102-109`). **The Argon2id computation always runs, before any branch**: with the stored salt and parameters for a known operator, enabled or disabled, and with a fixed dummy record of the current parameters when the username matches nobody. Only after it does the handler look at whether the operator exists and is enabled, and at the result of the comparison (`crypto.timingSafeEqual`, [AN:380]). So the three failure cases take comparable time [SDR:SD-21] |
| ID-3 | **Generic failure.** Unknown username, wrong password and a disabled operator give the same answer: 401 `INVALID_CREDENTIALS`, the same message, `details.attemptsRemaining` [RT:332]; [R10:420] |
| ID-4 | **One audit row per attempt**: `AUTH_SUCCESS`, `AUTH_FAILED` or `AUTH_LOCKED` with `details.method` (`auth.ts:8-9`). The row names the operator ID only when the username matched a known operator; a typed username that matches nobody is never recorded (`auth.ts:10-12`). A disabled operator's attempt carries `details.reason: USER_DISABLED` |
| ID-5 | **One attempt is consumed from the console's lockout counter before the verification starts**, and a success clears the counter (`auth.ts:5-9`); so attempts that arrive together are each counted, whatever their order (ENG-24). The attempt that reaches the limit is an `AUTH_FAILED` row whose details say it locked; attempts during the lock answer 423 `LOCKED` with `details.lockedUntil` and `details.retryInMs`, write `AUTH_LOCKED` and are not verified |
| ID-6 | **Rotation.** Every successful sign-in creates a new session and a new token. A valid session presented with the sign-in request is ended (reason `ROTATED`) |
| ID-7 | Several sessions per operator are allowed (the same operator on the web and on a device is the SC4 scenario) |
| ID-8 | **Idle and absolute expiry** are decided by the server clock. On expiry: session ended, audit and event `AUTH_EXPIRED` with `details.reason` `IDLE` or `ABSOLUTE`, sockets closed (section 4.7) |
| ID-9 | **Sign-out** ends the session, clears this instance's cookie (the same name and attributes, sent with `Max-Age=0`), writes `AUTH_SIGNED_OUT` with `details.reason` `USER` or `LOCK` (`vocabulary.ts:51`) |
| ID-10 | Sessions survive a server restart (they are rows); lockout counters do not (G-26) |
| ID-11 | No operation changes a password in this task. The seeded operators keep the demo password (Q12); the seed stores only its hash. Recorded as GS-01; accepted by row 20 under condition C4 of SR-63 [DEC:D16] |
| ID-12 | **One credential per request.** A request carries this instance's session cookie or an `Authorization` header, never both. A request with both is refused at stage 4 with 401 `NOT_SIGNED_IN` and `details.reason: CREDENTIAL_CONFLICT`, on every operation, and nothing is resolved. A bearer request that carries a web console `Origin` is refused by the Origin guard (OR-4). No client of this design sends either combination [SDR:SD-09] |
| ID-13 | **A session is bound to its transport.** The cookie resolves only a session row without a device; a bearer `ses_` value resolves only a session row with a device; a `dvc_` value is read only from the `Authorization` header. A device session's token sent as the cookie, or a web session's token sent as a bearer, resolves to nothing. So a token copied from one client cannot be replayed under the other client's rules (the Origin rule of the cookie, the device binding of the bearer) [SDR:SD-09] |

### 5.3 Where each client holds its credential

| Client | Credential | Held in | Sent as |
|---|---|---|---|
| Web console | Session token | The `dems_session_<listen port>` cookie only (ID-P7); not readable by script, not in web storage [R10:226] | Cookie on same-origin requests and on the socket upgrade |
| Mobile app | Device credential | `expo-secure-store`, without the biometric requirement, so the pairing gate can read it at start [AN:452] | `Authorization: Bearer dvc_...` on `DEVICE` operations, on sign-in and on a socket opened while signed out |
| Mobile app | Session token | Memory only; a cold start signs in again [AN:393]; [R4:58] | `Authorization: Bearer ses_...` on REST and on the socket upgrade |
| Mobile app | Biometric token | `expo-secure-store` with `requireAuthentication: true` [AN:452]. On an emulator or in a debug build the client may store it without that requirement, under the conditions of DEPARTURE-6 ([CL:MB-6a]; [DEC:D16]); the server-side rules of section 5.6 are the same in both cases | Request body of `signInWithBiometric` only |

A browser cannot set an `Authorization` header on a socket upgrade; React Native can [R8:400, R8:406]. So the web relies on the cookie that the browser attaches to the same-origin upgrade, and the app sets the header in the socket constructor. React Native sends no cookie. If it adds an `Origin` header, that header names the URL it opened, which is one of the instance's own origins and is accepted on a bearer request (section 14.2; SA-03).

### 5.4 Auth-session states

| From | To | Trigger | Audit type |
|---|---|---|---|
| (none) | ACTIVE | `signIn` or `signInWithBiometric` succeeds | `AUTH_SUCCESS` |
| ACTIVE | ENDED (`SIGNED_OUT`) | `signOut` | `AUTH_SIGNED_OUT` |
| ACTIVE | ENDED (`IDLE_EXPIRED` or `ABSOLUTE_EXPIRED`) | Sweeper or a request after the limit | `AUTH_EXPIRED` |
| ACTIVE | ENDED (`ROTATED`) | A new sign-in that presented this session | covered by the new session's `AUTH_SUCCESS` (`details.replaced: true`) |
| ACTIVE | ENDED (`USER_DISABLED`) | `disableUser` | `USER_DISABLED` (`details.sessionsEnded`) |
| ACTIVE | ENDED (`DEVICE_REVOKED` or `DEVICE_UNPAIRED`) | `revokeDevice` or `unpairDevice` | `DEVICE_REVOKED` or `UNPAIRED` (`details.sessionsEnded`) |
| ACTIVE | ENDED (`TOKEN_REUSE`) | A used biometric token of the session's device and operator was presented again (section 5.6 step 6). Only sessions whose method is BIOMETRIC | `AUTH_FAILED` (`details.reason: TOKEN_REUSE`, `details.sessionsEnded`) |

Ended sessions are kept as rows with their end reason. The set of end reasons is closed in the database (a CHECK list, [DB:§2.4]): `SIGNED_OUT`, `IDLE_EXPIRED`, `ABSOLUTE_EXPIRED`, `ROTATED`, `USER_DISABLED`, `DEVICE_REVOKED`, `DEVICE_UNPAIRED`, `TOKEN_REUSE`. `TOKEN_REUSE` is part of it from the first migration, because a later addition would need a migration [SDR:SD-10]; [DEC:D16].

### 5.5 Sign-in methods in Live mode

| Method | Simulated mode (unchanged) | Live mode, web console | Live mode, mobile app |
|---|---|---|---|
| Password | Compared with one constant in the client (`auth.ts:292`, [R1:85]) | `signIn`; cookie session | `signIn` on a paired device; bearer session bound to the device |
| Biometric | The OS result is trusted; the caller names the operator (`auth.ts:296-299`) | Not offered | Section 5.6: the OS prompt unlocks a server-issued token; the server verifies the token |
| Security key (simulated) | Signs in the SUPERVISOR operator with no credential (`auth.ts:311-314`) | **Not offered. No server operation exists** (Q11, [DEC:D4]) | Not applicable |

### 5.6 Biometric unlock without trusting the client

The server never accepts a claim that a biometric check passed. It accepts only a secret that the device can read after the OS has released the Keystore key.

| Step | Who | What |
|---|---|---|
| 1 Enrol | Operator, signed in **by password** on a paired device | `setBiometricEnrollment {enabled: true}`. The server creates a 256-bit token (prefix `bio_`), stores only its SHA-256 with the device, the operator and a family ID, and returns it once. Audit `BIOMETRIC_ENROLLMENT_CHANGED` |
| 2 Store | App | Writes the token to `expo-secure-store` with `requireAuthentication: true` (on an emulator or in a debug build possibly without it, under the conditions of DEPARTURE-6, [CL:MB-6a]) |
| 3 Unlock | App | The OS biometric prompt releases the item. Without a successful prompt the app has no token to send |
| 4 Sign in | App | `signInWithBiometric {token}` with the device credential. The server first consumes one attempt from the device's lockout counter (423 while locked, ID-5), then **claims the token with one compare-and-set statement** (it is marked used only where it is neither used nor revoked; the row count decides, ENG-25), and checks: not expired, same device, device PAIRED, operator enabled |
| 5 Rotate | Server | Marks the token used and returns a new one of the same family with the session. Audit `AUTH_SUCCESS`, `details.method: BIOMETRIC` |
| 6 Reuse | Server | A token that was already used revokes its whole family, **ends the open sessions of that device and operator whose method is BIOMETRIC** (reason `TOKEN_REUSE`; `session.ended` is pushed and their sockets are closed within 1 s, section 4.7), writes `AUTH_FAILED` (`details.reason: TOKEN_REUSE`), counts toward the lockout and answers the generic 401. The reuse rule exists because one of the two presenters is not the owner; revoking only the family would leave that presenter's session open until it expires [R10:341]; [SDR:SD-10]. Sessions created by password are not touched |
| 7 Failure | App | An OS failure is reported with `reportBiometricFailure`. It can only add a failure toward the device's own lockout and one `AUTH_FAILED` row; it can never create a session. The row names the operator **only when a biometric token of this device and that operator exists** (live or last used); otherwise the actor is null and the row carries the device ID only, so a paired device cannot write failure rows that name an operator of its choosing [SDR:SD-11] |
| 8 Disable | Operator | `setBiometricEnrollment {enabled: false}` revokes the family. Device revocation, device unpair and `disableUser` revoke it too |

Emulator limit: the documentation of `expo-secure-store` says emulators do not require biometric authentication when a secret is read [R11:159]. The server-side check is unaffected; the weaker prompt on an emulator is AS-06 and belongs to row 17. Row 20 accepted the client's fallback for that case (DEPARTURE-6) with three conditions, which the client specification carries ([CL:MB-6a]; [SDR:§5.5]; [DEC:D16]; residual R-07).

---

## 6. Pairing lifecycle and device registry

Decisions: Q5 (pairing is mandatory for mobile in Live mode), Q8 (portal-issued one-time code, also shown as a QR), Q13 (the portal itself does not pair), DR-02 (the device **enters** the code; scanning is deferred) [DEC:D4, DEC:DR-02]. The protocol is hand-built by approval HB-10 [DEC:D12].

### 6.1 Parameters

| ID | Parameter | Value | Source |
|---|---|---|---|
| PR-P1 | Code | 6 decimal digits, uniform, from `crypto.randomInt` (SA-07) | `constants.ts:61`; the existing screen takes six digits [AN:456]; at least six digits [R10:383] |
| PR-P2 | Lifetime | 300 s | at most 10 minutes [R10:383] |
| PR-P3 | Use | Single use; **one active code at a time** (a new issue cancels the previous one) | this file |
| PR-P4 | Failed redeems before a lock | 3 within 300 s, then 60 s lock. The key is global, because unpaired callers cannot be told apart on loopback. One attempt is consumed before the comparison (ENG-24); a successful redeem clears the count, and a lock that has ended starts a fresh count, as the simulator does (`packages/shared/src/sim/pairing.ts:44-46, 56`) | `constants.ts:59-60, 52`; [R10:376] |
| PR-P5 | Failed redeems before the code is closed | 5 during the code's lifetime | this file |
| PR-P6 | Stored form of the code | SHA-256 of the code ID and the code; the code is returned once by `issuePairingCode` and can never be read again | [AN:456] |
| PR-P7 | QR payload | The string `DEMS-PAIR:1:` followed by the code. Not a URL and not a deep link, because a code must not appear in a URL | [AN:467] |
| PR-P8 | Device credential | 32 bytes from `crypto.randomBytes`, base64url, prefix `dvc_`; only its SHA-256 is stored; returned once | [AN:452] |
| PR-P9 | Device ID | `DEV-NNNN` from a server-native counter | this file |

**Guessing bound.** A code allows at most five guesses: three, then the 60 s lock, then two more, all inside its 300 s lifetime. Five distinct guesses out of 10^6 uniform codes hit with probability 5 in 1,000,000 (5 × 10^-6) per issued code [SDR:§5.1]. An attacker cannot issue codes (that needs `PAIRING_MANAGE`), so the bound for a demo is that number times the codes issued. **The bound depends on the atomicity of the redeem path** (ENG-23 to ENG-25; AC-B-76, AC-B-77): if concurrent redeems could pass the checks before one another's failure is counted, the only brake would be the class throttle of 30 requests per 60 s (ID-P12), which is 150 guesses in a code's lifetime, 1.5 × 10^-4 per code, thirty times the bound. A successful guess yields a paired device, not a session: a sign-in still follows. A six-digit code's hash can be searched offline in a moment, so the hash only keeps the code out of dumps and logs; the protection is the lifetime, the single use and the attempt limits (GS-09, accepted by row 20).

### 6.2 Pairing code: states and audit

| # | From | To | Trigger | Actor | Audit type |
|---|---|---|---|---|---|
| T1 | (none) | ACTIVE | `issuePairingCode` | Operator with `PAIRING_MANAGE` | `PAIRING_CODE_ISSUED` (new) |
| T2 | ACTIVE | REDEEMED | `redeemPairingCode` with the right code | The device (no operator) | `PAIRING_SUCCESS` (existing) |
| T3 | ACTIVE | CANCELLED | `cancelPairingCode`, or a new `issuePairingCode` | Operator | `PAIRING_CODE_CLOSED` (new), `details.reason: CANCELLED` |
| T4 | ACTIVE | EXPIRED | 300 s passed (sweeper) | System | `PAIRING_CODE_CLOSED`, `details.reason: EXPIRED` |
| T5 | ACTIVE | EXHAUSTED | The fifth failed redeem | System | `PAIRING_CODE_CLOSED`, `details.reason: EXHAUSTED` |

Attempts that change no state also write one row each: a wrong, expired, used or absent code writes `PAIRING_FAILED` (existing) with `details.attemptsRemaining`; an attempt during the lock writes `PAIRING_LOCKED` (existing) (`packages/shared/src/sim/pairing.ts:19-56`). These rows count against the denial budget of the class bucket (ID-P13). No row, event or log line ever holds a code (SR-28, SR-30).

One close has no row of its own: a code that is ACTIVE when a demo reset runs is written `CANCELLED` by the reset routine, and the new chain's `SCENARIO_LOADED` row is its record (section 12.4; [DEC:D14]).

Fields of a code that an operator may read (`getPairingCodeStatus`): code ID, issued by, issued at, expires at, attempts remaining. Never the code.

### 6.3 Paired device: states and audit

| # | From | To | Trigger | Actor | Audit type | Effect |
|---|---|---|---|---|---|---|
| T6 | (none) | PAIRED | T2 succeeds | The device | `PAIRING_SUCCESS` (existing), with the new device ID; event `PAIRED` | The device receives its ID and its credential once |
| T7 | PAIRED | PAIRED | `rotateDeviceCredential` | The device | `DEVICE_CREDENTIAL_ROTATED` (new) | Two-phase: the new hash is stored as "next" and promoted at its first use; then the old credential is refused. A lost answer leaves the old one valid |
| T8 | PAIRED | REVOKED | `revokeDevice` with a reason of at least 5 characters | Operator with `PAIRING_MANAGE` | `DEVICE_REVOKED` (new); event `UNPAIRED` | Section 4.7 |
| T9 | PAIRED | UNPAIRED | `unpairDevice` | The device (and the signed-in operator, if any) | `UNPAIRED` (existing); event `UNPAIRED` | Sessions and biometric tokens of the device are ended; the app deletes its credential |

REVOKED and UNPAIRED are final. Pairing again creates a **new** device row with a new ID. The link changes of a paired device are audited separately as `TABLET_LINK_CHANGED` (section 6.8).

**Operation 23 in this task.** `rotateDeviceCredential` is registered and tested on the server, but neither client calls it ([CL:MP-8a]). A `DEVICE_CREDENTIAL_ROTATED` row outside the server's own tests is therefore unexpected: it would mean that a holder of a copied device credential rotated it, which also locks the real device out. The row makes that visible, and revoking the device ends it [SDR:SD-29] (residual R-06).

### 6.4 The flow

| Step | Where | What happens |
|---|---|---|
| 1 | Portal, Paired Devices page | A Supervisor issues a code. The page shows the six digits, the QR and the expiry countdown. Reloading the page cannot show the code again; a new one must be issued |
| 2 | Mobile app, pairing screen | The operator **types** the six digits (DR-02) |
| 3 | Server | `redeemPairingCode`, **one unit of work in the pipeline** (ENG-23): lock check and attempt consumption (423), code comparison, the code set to REDEEMED by a compare-and-set statement whose row count decides (of two concurrent redeems of the right code exactly one wins, ENG-25), device row created, credential generated, audit row; all in one transaction |
| 4 | Mobile app | Stores the device ID and the credential in secure storage; the pairing gate opens the login screen |
| 5 | Portal | `admin.changed` arrives; the list shows the new device as PAIRED and online |
| 6 | Mobile app | Sign-in (ID-1 b). The session row carries the device ID; `AUTH_SUCCESS` carries it too |

Edge case E6 [BP:172]: a code redeemed twice, redeemed after its expiry, or redeemed after it was closed answers 401 `INVALID_CODE` in every case (the answer never says which, SR-29); a redeem during the lock answers 423 `LOCKED`.

### 6.5 Device registry (what `listPairedDevices` returns per device)

| Field | Meaning |
|---|---|
| `id` | `DEV-NNNN` |
| `name`, `platform`, `appVersion` | Sent by the device at redeem (name at most 60 characters) |
| `state` | PAIRED, REVOKED or UNPAIRED |
| `pairedAt`, `pairedWithCodeId`, `codeIssuedBy` | When and through which code |
| `lastSeenAt` | Last authenticated request or socket of the device (written at most once a minute) |
| `online` | True while the device has an open authenticated socket (from the connection registry; not stored) |
| `signedInOperatorId` | The operator of the device's **newest open session**, or null. Several open sessions per device are possible (a cold start signs in again without presenting the old token); the registry shows the newest [DEC:D14] |
| `credentialRotatedAt` | Last rotation |
| `revokedAt`, `revokedBy`, `revokeReason`, `unpairedAt` | End of life |

The registry never returns a credential or its hash.

### 6.6 What a device may call

| Device situation | May call | Everything else |
|---|---|---|
| No credential (fresh install), or state UNPAIRED | `getServiceHealth`, `redeemPairingCode`, `getSignInStatus` (it reads the web console's lock state, ID-1); an unauthenticated socket (heartbeat only) | 403 `DEVICE_NOT_PAIRED` on sign-in; 401 elsewhere |
| Credential of a REVOKED device | `getServiceHealth`, `redeemPairingCode`; an unauthenticated socket | 403 `DEVICE_REVOKED`, with one `ACCESS_DENIED` row inside the denial budget of the class bucket (RB-6) |
| PAIRED, signed out | Also the `DEVICE` operations (8, 9, 21, 22, 23), `signIn`, `getSignInStatus`; a socket with the `control` topic | 401 `NOT_SIGNED_IN` |
| PAIRED, signed in | As the operator's permissions allow | 403 `NOT_PERMITTED` with an audit row |

Edge case E3 [BP:169], a device revoked while it is signed in and recording: the device loses access at once; the recording belongs to the Core and continues; any operator with `SESSION_START` on another client stops it with a reason (Q16).

### 6.7 Re-pairing after a reinstall (edge case E7)

`expo-secure-store` data does not survive an uninstall [R11:160]. The reinstalled app has no credential and shows the pairing screen. The registry still lists the old device as PAIRED, with an ageing `lastSeenAt` and `online: false`, until a Supervisor revokes it. A new redeem creates a new device ID. The server does not try to recognise the old installation: no stable hardware identifier is collected.

### 6.8 The tablet link

The engine's `tabletLink` slice is CONNECTED while at least one PAIRED device has an open authenticated socket, and OFFLINE otherwise. The server drives it through the hosted `setTabletLink` action, which writes `TABLET_LINK_CHANGED` and the event `TABLET_CONNECTED` or `TABLET_DISCONNECTED` [R1:191]. A device that reconnects within 5 s does not toggle the link. With several paired devices the slice stays one flag (GS-16).

### 6.9 The portal

The web console does not pair (Q13). Its sign-in is accepted on a **web console origin** (ID-1 a). The limit of that rule is stated plainly: a local process that forges an `Origin` header can reach the sign-in form without a device credential. It still needs an operator's password, and a hostile local process is outside the security boundary [AN:843]. Recorded as GS-03; row 20 accepted it [SDR:§6]; [DEC:D16] (residual R-01).

What is not left open is the unforged case. The instance's own origins are a second list (section 2.4): they are accepted only on a request that carries no cookie, and they never satisfy ID-1 (a). A request whose `Origin` is the server's own address, which is what a React Native socket may send, is therefore an uncredentialed non-web caller, and its `signIn` answers 403 `DEVICE_NOT_PAIRED` (AC-B-73). Pairing stays mandatory for everything that is not a web console (section 14.2).

---

## 7. API contract: operation tables

**75 REST operations (10 existing, 65 new) and one WebSocket channel.** The registry in `packages/shared/src/api/` stays the single source [DEC:D11 TD-09]; row 27 (W19, W22, W27) writes it from the tables below, and the count in the registry must equal 75 [BP:300].

### 7.1 Conventions

| ID | Convention | Source |
|---|---|---|
| API-1 | Base path `/api/v1`. The nine design-book operations and the health operation keep their path, method, request and response schema (I10, [RT:172]) | `packages/shared/src/api/core-api.ts:418-650` |
| API-2 | **Two methods only.** GET reads and never changes state. POST is a command and always passes the Origin guard. The contract type stays `'get' or 'post'` (`core-api.ts:377`) | this file |
| API-3 | At most one path parameter, named `id` (`core-api.ts:406`) | existing |
| API-4 | Bodies are JSON objects, at most 65,536 bytes; unknown keys are dropped by the schema | this file |
| API-5 | **Time.** The ten existing operations keep ISO-8601 strings with an offset (`core-api.ts:68-69`). Every new schema uses epoch milliseconds (`EpochMs`, `packages/shared/src/sim/types.ts:65-66`), because the Live source maps answers straight into result types and slices that use that form | this file |
| API-6 | **Slice form.** A new read returns the wire form of the simulator slices it names (the same JSON as the realtime `state` topic), so one zod schema per slice serves both | [AN:534] |
| API-7 | **State revision.** Every 2xx answer of a POST carries the headers `x-dems-epoch` and `x-dems-revision`: the revision of the delta that holds the command's effect (the current revision when nothing replicated changed). The Live action settles when its store has reached that revision [AN:551]. Response bodies of the existing operations are not changed | this file |
| API-8 | **Access and audit metadata.** Each registry entry carries `access` (section 4.2) and `audit`: the success rule and the denial type. The success rule is one audit type, or one of two explicit markers: `NONE-R` (a read; no state change) and `NONE-P` (parity: the hosted simulator action writes no audit row today [R1:203] and Live keeps the same audit sequence; an event may still be emitted). The denial type is `ACCESS_DENIED`, except RB-5 | [AN:408, AN:436] |
| API-9 | Lists are cursor-paged: `cursor` (opaque), `limit` (default 50, at most 200), answer `nextCursor` or null. Audit and event lists are ordered by sequence, so paging is stable while rows are appended | [BP:318] |
| API-10 | The header `x-dems-simulated` is sent only by the in-app simulator (`packages/shared/src/sim/api.ts:36-39`); the server never sends it | [R2:97] |
| API-11 | Commands are not retried automatically by a client. Only `createSession` is idempotent, for equal input, as today [R1:156] | existing |
| API-12 | The OpenAPI document gains two security schemes (the session cookie, documented under the main instance's name `dems_session_4420`, ID-P7; HTTP bearer) and the server `http://127.0.0.1:4420`; `info.version` becomes 0.2.0 | [R2:181, R2:193] |
| API-13 | **Text rule.** Every string schema of the registry refuses the character U+0000 and ill-formed UTF-16 (an unpaired surrogate) with 422 `INVALID_INPUT`, before the engine runs. PostgreSQL cannot store the first; the second would be altered when the row is written, so that the stored audit row no longer matched its chain hash | [DEC:D14] (SPEC-GAP-1); [DB:§13.1] |

### 7.2 Error envelope and status codes

The envelope stays `{ error: { code, message } }` (`core-api.ts:81-94`). Two **additive, optional** members are added: `error.details` (a flat map of string, number, boolean or null, the form of audit details, `types.ts:68-69`) and `error.requestId`. Existing bodies still parse.

`details` carries what the Live source needs to rebuild the simulator's error classes [AN:551]: `simCode` (the `SimErrorCode`), `permission`, `from`, `event` (read by the web's command wrapper, [R3:57]), and the counters `attemptsRemaining`, `lockedUntil`, `retryInMs`. A refusal that needs a machine-readable cause carries `reason` (for example `CREDENTIAL_CONFLICT`, ID-12).

| Status | Codes | When | State |
|--:|---|---|---|
| 400 | `INVALID_JSON` | The body is not a JSON object | documented |
| 400 | `INVALID_PATH` | Malformed path or percent-encoding | **emitted by the simulator, missing from the document** (`sim/api.ts:493, 504`; [R2:168-171]; [DEC:F4]) |
| 401 | `NOT_SIGNED_IN` | No valid session (or no valid device credential on a `DEVICE` operation); or two credentials in one request (`details.reason: CREDENTIAL_CONFLICT`, ID-12) | documented; **added to the six reads** [R2:104-107] |
| 401 | `INVALID_CREDENTIALS` | Sign-in failed (generic, ID-3) | new |
| 401 | `INVALID_CODE` | Pairing redeem failed (generic, SR-29) | new |
| 403 | `NOT_PERMITTED` | The operator's role lacks the permission; one audit row | documented |
| 403 | `FORBIDDEN` | `exportEvidence` refused (existing code, RB-5) | documented |
| 403 | `ORIGIN_NOT_ALLOWED` | Origin guard: the decision table of section 14.2 | new |
| 403 | `DEVICE_NOT_PAIRED` | Sign-in without a console identity (ID-1), which includes a caller whose `Origin` is one of the instance's own; a device-only operation called by a web session | new |
| 403 | `DEVICE_REVOKED` | The credential or the session belongs to a device that is REVOKED or UNPAIRED | new |
| 403 | `DEMO_DISABLED` | A demo operation while the demo flag is off | new |
| 404 | `NOT_FOUND` | Unknown route, or unknown resource | documented for resources; **the unknown-route case is missing from the document** [R2:169] |
| 405 | `METHOD_NOT_ALLOWED` | Known path, other method; header `allow` | **missing from every operation's responses** [R2:169] |
| 409 | `SESSION_ACTIVE`, `INVALID_STATE`, `PRECHECK_RUNNING`, `PRECHECK_WARNINGS`, `PRECHECK_BLOCKED`, `NOT_SEALED`, `SECURITY_FAULT` | State conflicts | documented |
| 409 | `RECORDING_ACTIVE`, `COMMAND_UNSUPPORTED`, `LAST_ADMIN` | Device restart while recording; command not supported by the device; RB-8 | new |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 65,536 bytes | new |
| 422 | `INVALID_INPUT`, `INVALID_REASON` | Schema or business validation | documented |
| 423 | `LOCKED` | Sign-in or pairing lockout; `details.lockedUntil`, `details.retryInMs` | new |
| 429 | `RATE_LIMITED` | Throttle, or the denial budget of the caller's key is used up (ID-P12, ID-P13); header `retry-after` | new |
| 500 | `INTERNAL_ERROR` | Unexpected failure; no detail (SR-50). `SIMULATOR_ERROR` stays the simulator's code | new; **500 is missing from the document** [R2:169] |
| 503 | `NOT_READY` | Database or engine not ready; demo reset in progress | new |

The document's code list grows from 16 [R2:165] to 31 (15 new codes: `INVALID_PATH`, `INVALID_CREDENTIALS`, `INVALID_CODE`, `ORIGIN_NOT_ALLOWED`, `DEVICE_NOT_PAIRED`, `DEVICE_REVOKED`, `DEMO_DISABLED`, `RECORDING_ACTIVE`, `COMMAND_UNSUPPORTED`, `LAST_ADMIN`, `PAYLOAD_TOO_LARGE`, `LOCKED`, `RATE_LIMITED`, `INTERNAL_ERROR`, `NOT_READY`). 400 `INVALID_PATH`, 404 unknown route, 405, 413, 429, 500 and 503 are defined **once at envelope level**, not per operation.

How a thrown simulator error becomes an answer (the existing mapping of `sim/api.ts:481-495` [R1:547], extended to the codes it does not cover):

| `SimErrorCode` (`errors.ts:10-41`, [R1:495-509]) | Status and code | `details.simCode` |
|---|---|---|
| `NOT_SIGNED_IN` | 401 `NOT_SIGNED_IN` | same |
| `NOT_PERMITTED` | 403 `NOT_PERMITTED` | same |
| `NOT_FOUND` | 404 `NOT_FOUND` | same |
| `ILLEGAL_STATE`, `NO_WARNINGS` | 409 `INVALID_STATE` | the simulator code |
| `CHECKS_RUNNING` | 409 `PRECHECK_RUNNING` | `CHECKS_RUNNING` |
| `SESSION_ACTIVE` | 409 `SESSION_ACTIVE` | same |
| `RECORDING_ACTIVE` | 409 `RECORDING_ACTIVE` | same |
| `COMMAND_UNSUPPORTED` | 409 `COMMAND_UNSUPPORTED` | same |
| `UNSEALED_EVIDENCE` | 409 `NOT_SEALED` | `UNSEALED_EVIDENCE` |
| `REASON_TOO_SHORT` | 422 `INVALID_REASON` | `REASON_TOO_SHORT` |
| `NOTE_INVALID`, `POLICY_RANGE`, `INVALID_INPUT` | 422 `INVALID_INPUT` | the simulator code |
| an unknown scenario name (`RangeError`, [R1:179]) | 422 `INVALID_INPUT` (caught by the schema before the engine) | none |
| anything else | 500 `INTERNAL_ERROR` | none |

### 7.3 Error precedence

The first matching line decides the answer (stages of section 2.3).

| Order | Answer |
|--:|---|
| 1 | 400 `INVALID_PATH`, 404 unknown route, 405 |
| 2 | 503 `NOT_READY` |
| 3 | 403 `ORIGIN_NOT_ALLOWED` |
| 4 | 401 `NOT_SIGNED_IN` with `details.reason: CREDENTIAL_CONFLICT` (two credentials in one request, ID-12) |
| 5 | 429 `RATE_LIMITED` (the throttle, then the denial budget) |
| 6 | 401 `NOT_SIGNED_IN`, 403 `DEVICE_REVOKED` (with its audit row) |
| 7 | 403 `NOT_PERMITTED` or `FORBIDDEN` (with the audit row), 403 `DEVICE_NOT_PAIRED`, then 403 `DEMO_DISABLED` |
| 8 | 413, 400 `INVALID_JSON`, 422 `INVALID_INPUT` (schema) |
| 9 | 423 `LOCKED` (sign-in, biometric sign-in, redeem), then 401 `INVALID_CREDENTIALS` or `INVALID_CODE` |
| 10 | 404 resource, then 409, then 422 business validation, in the order the hosted action checks them (for `exportEvidence`: 404, 409, 422 [R1:170]) |

Difference from the simulator: its handler answers 400 `INVALID_JSON` before 401 (`sim/api.ts:498-522`). The server answers 401 or 403 first, because stages 3-6 run before the body is read.

Errors common to many operations are not repeated in the tables below: 401 (every operation that is not `PUBLIC`), 403 `NOT_PERMITTED` (every operation with a permission), 403 `ORIGIN_NOT_ALLOWED`, 400 and 422 (every operation with a body), 429, 500, 503.

### 7.4 Area 12: service health and the API reference

| # | operationId | Method and path | Access | Audit | Request | Success | State |
|--:|---|---|---|---|---|---|---|
| 1 | `getServiceHealth` | GET `/api/v1/health` | `PUBLIC` (liveness; no Core data) | `NONE-R` | none | 200 `HealthResponse` | existing, widened |

`HealthResponse` is widened additively (D9 DN-3, [AN:442]): `service` accepts `dems-mock-core` or `dems-core-server` (today a single literal, `packages/shared/src/api/health.ts:7, 25`); an optional `ready: { database: boolean, engine: boolean }` is added. The server answers `service: dems-core-server`, `version: 0.2.0`. The status is always 200 while the process answers; a stopped database shows as `ready.database: false` [BP:322]. mock-core's and the launcher's answers stay valid.

The API Reference page builds the OpenAPI document in the browser from the shared registry [AN:435]; the server has no operation for it. How the page shows 75 live operations is row 17's (impact question 23).

### 7.5 Area 1: identity and sign-in

| # | operationId | Method and path | Access | Audit on success | Request | Success | Specific errors | Simulator action |
|--:|---|---|---|---|---|---|---|---|
| 2 | `signIn` | POST `/api/v1/auth/sign-in` | `PUBLIC` plus ID-1 (it creates the session) | `AUTH_SUCCESS`; a failure writes `AUTH_FAILED` or `AUTH_LOCKED` | `SignInRequest` | 200 `SignInResponse`; web: `Set-Cookie` and no token in the body | 401 `INVALID_CREDENTIALS`, 403 `DEVICE_NOT_PAIRED`, 403 `DEVICE_REVOKED`, 423 | `signIn` |
| 3 | `getSignInStatus` | GET `/api/v1/auth/status` | `PUBLIC` (the login screen shows the lock after a reload; which console's lock state is read follows ID-1) | `NONE-R` | none | 200 `SignInStatus` | 403 `DEVICE_REVOKED` | reads `authLockout` |
| 4 | `getAuthSession` | GET `/api/v1/auth/session` | `AUTHENTICATED` (the caller's own session) | `NONE-R` | none | 200 `AuthSessionInfo` | — | reads `auth` |
| 5 | `signOut` | POST `/api/v1/auth/sign-out` | `AUTHENTICATED` (own session) | `AUTH_SIGNED_OUT` | `{ reason?: USER or LOCK }` | 204; cookie cleared | — | `signOut` |
| 6 | `touchSession` | POST `/api/v1/auth/touch` | `AUTHENTICATED` (own session) | `NONE-P` | none | 200 `{ idleExpiresAt, absoluteExpiresAt }` | — | `touch` |
| 7 | `setBiometricEnrollment` | POST `/api/v1/auth/biometric` | `AUTHENTICATED` (own credential); the session must be bound to a device, and `enabled: true` needs a password session | `BIOMETRIC_ENROLLMENT_CHANGED` (new) | `{ enabled: boolean }` | 200 `{ enabled, token?, expiresAt? }` | 403 `DEVICE_NOT_PAIRED` | none (new) |
| 8 | `signInWithBiometric` | POST `/api/v1/auth/biometric/sign-in` | `DEVICE` | `AUTH_SUCCESS` (`method: BIOMETRIC`); a failure writes `AUTH_FAILED` or `AUTH_LOCKED` | `{ token }` | 200 `SignInResponse` with `biometricToken` (the rotated token) | 401 `INVALID_CREDENTIALS`, 423 | `signInWithBiometric` |
| 9 | `reportBiometricFailure` | POST `/api/v1/auth/biometric/failure` | `DEVICE` | `AUTH_FAILED` (or `AUTH_LOCKED` while locked); the actor follows SR-37 | `{ operatorId: string or null }` | 200 `SignInStatus` | — | `recordBiometricFailure` |

Note on operation 9. `operatorId` is the operator the app believes was trying to sign in. The server does not take it as an actor (SR-65): the `AUTH_FAILED` row names that operator only when a biometric token of this device and that operator exists, live or last used; otherwise the actor is null and the row carries the device ID only [SDR:SD-11].

### 7.6 Area 2: RBAC and user administration

| # | operationId | Method and path | Access | Audit on success | Request | Success | Specific errors |
|--:|---|---|---|---|---|---|---|
| 10 | `getRoleMatrix` | GET `/api/v1/rbac/matrix` | `AUTHENTICATED` (the role panel is visible to every role today) | `NONE-R` | none | 200 `RoleMatrix` | — |
| 11 | `listUsers` | GET `/api/v1/admin/users` | `USER_ADMIN` | `NONE-R` | none | 200 `{ users: AdminUser[] }` | — |
| 12 | `assignUserRole` | POST `/api/v1/admin/users/{id}/role` | `USER_ADMIN` | `ROLE_CHANGED` (new); none when the role is unchanged | `{ role, reason? }` | 200 `AdminUser` | 404, 409 `LAST_ADMIN` |
| 13 | `enableUser` | POST `/api/v1/admin/users/{id}/enable` | `USER_ADMIN` | `USER_ENABLED` (new); none when already enabled | `{ reason? }` | 200 `AdminUser` | 404 |
| 14 | `disableUser` | POST `/api/v1/admin/users/{id}/disable` | `USER_ADMIN` | `USER_DISABLED` (new); none when already disabled | `{ reason? }` | 200 `AdminUser` | 404, 409 `LAST_ADMIN` |

`{id}` is an operator ID (`OPR-NNN`, `packages/shared/src/api/patterns.ts:17`). No operation creates or deletes a user (Q9 option b). None of these has a simulator action: no action edits an operator or a role today [R1:83].

### 7.7 Area 3: pairing and the device registry

| # | operationId | Method and path | Access | Audit on success | Request | Success | Specific errors | Simulator action |
|--:|---|---|---|---|---|---|---|---|
| 15 | `issuePairingCode` | POST `/api/v1/pairing/code` | `PAIRING_MANAGE` | `PAIRING_CODE_ISSUED` (new); a replaced code also writes `PAIRING_CODE_CLOSED` | none | 201 `PairingCodeIssued` | — | none (new) |
| 16 | `getPairingCodeStatus` | GET `/api/v1/pairing/code` | `PAIRING_MANAGE` | `NONE-R` | none | 200 `{ active: PairingCodeStatus or null }` | — | none |
| 17 | `cancelPairingCode` | POST `/api/v1/pairing/code/cancel` | `PAIRING_MANAGE` | `PAIRING_CODE_CLOSED` (new); none when no code is active | none | 204 | — | none |
| 18 | `redeemPairingCode` | POST `/api/v1/pairing/redeem` | `PUBLIC` (the caller has no credential yet; the code is the proof) | `PAIRING_SUCCESS`; a failure writes `PAIRING_FAILED` or `PAIRING_LOCKED` | `PairingRedeemRequest` | 201 `PairingRedeemed` | 401 `INVALID_CODE`, 423 | `pair` |
| 19 | `listPairedDevices` | GET `/api/v1/pairing/devices` | `PAIRING_MANAGE` | `NONE-R` | none | 200 `{ devices: PairedDevice[] }` | — | none |
| 20 | `revokeDevice` | POST `/api/v1/pairing/devices/{id}/revoke` | `PAIRING_MANAGE` | `DEVICE_REVOKED` (new) | `{ reason }` (at least 5 characters) | 200 `PairedDevice` | 404, 409 `INVALID_STATE`, 422 `INVALID_REASON` | none |
| 21 | `getDeviceRegistration` | GET `/api/v1/pairing/device` | `DEVICE` (the device reads its own registration at start) | `NONE-R` | none | 200 `DeviceRegistration` | 403 `DEVICE_REVOKED` | reads `pairing` |
| 22 | `unpairDevice` | POST `/api/v1/pairing/device/unpair` | `DEVICE` | `UNPAIRED` | none | 204 | — | `unpair` |
| 23 | `rotateDeviceCredential` | POST `/api/v1/pairing/device/credential` | `DEVICE` | `DEVICE_CREDENTIAL_ROTATED` (new) | none | 200 `{ deviceCredential, rotatedAt }` | — | none |

`{id}` in operation 20 is a device ID (`DEV-NNNN`). The bodies of operations 2, 7, 8, 15, 18 and 23 hold a secret; they are never logged (SR-48), and the API Reference page offers no "Try it" for these six in Live mode ([CL:AR-3a]; [SDR:SD-16]). Operation 23 is called by no client in this task (section 6.3).

### 7.8 Area 4: sessions and the recording lifecycle

One active session per Core; any operator with `SESSION_START` may stop it with a reason (Q16, [DEC:D4]). In operations 25-37 `{id}` is a session ID (`patterns.ts:11`); an ID that is not the open session answers 404, as today [R2:84-85].

| # | operationId | Method and path | Access | Audit on success | Request | Success | Specific errors | Simulator action |
|--:|---|---|---|---|---|---|---|---|
| 24 | `createSession` | POST `/api/v1/session` | `SESSION_START` | `SESSION_CREATED` | `SessionCreateRequest` | 201, or 200 for equal input; `SessionCommandResponse` | 409 `SESSION_ACTIVE` | `createSession` |
| 25 | `startSession` | POST `/api/v1/session/{id}/start` | `SESSION_START` | `RECORDING_STARTED` (see the note) | `SessionStartRequest`, optional | 200 or 202 `SessionCommandResponse` | 404, 409 | `startRecording` |
| 26 | `stopSession` | POST `/api/v1/session/{id}/stop` | `SESSION_START` | `RECORDING_STOPPED` | `SessionStopRequest` | 202 `SessionCommandResponse` | 404, 409, 422 `INVALID_REASON` | `stopRecording` |
| 27 | `getCurrentSession` | GET `/api/v1/session/current` | `AUTHENTICATED` (every role sees the monitor) | `NONE-R` | none | 200 `CurrentSessionResponse` | — | reads `session` |
| 28 | `beginPrecheck` | POST `/api/v1/session/{id}/precheck` | `SESSION_START` | `NONE-P` (event `PRECHECK_STARTED`) | none | 202 `SessionCommandResponse` | 404, 409 | `beginPrecheck` |
| 29 | `retryPrecheck` | POST `/api/v1/session/{id}/precheck/retry` | `SESSION_START` | `NONE-P` (event `PRECHECK_STARTED`) | none | 202 `SessionCommandResponse` | 404, 409 | `retryPrecheck` |
| 30 | `acknowledgePrecheckWarnings` | POST `/api/v1/session/{id}/precheck/acknowledge` | `SESSION_START` | `PRECHECK_PASSED` | none | 200 `SessionCommandResponse` (ARMED) | 404, 409 | `acknowledgePrecheckWarnings` |
| 31 | `cancelSession` | POST `/api/v1/session/{id}/cancel` | `SESSION_START` | `SESSION_CANCELLED` | none | 204 | 404, 409 | `cancel` |
| 32 | `scanCaseNumber` | POST `/api/v1/session/case-number` | `SESSION_START` | `NONE-P` (reserves a counter value) | none | 200 `{ caseNumber }` | — | `scanCaseNumber` |
| 33 | `recoverSession` | POST `/api/v1/session/{id}/recover` | `SESSION_START` | `RECOVERY_STARTED` (after a power failure also `SYSTEM_BOOT` and `FAULT_CLEARED`, [R1:164]) | none | 202 `SessionCommandResponse` (RECOVERY) | 404, 409 | `recover` |
| 34 | `addSessionMarker` | POST `/api/v1/session/{id}/markers` | `SESSION_NOTE` | `MARKER_ADDED` | `{ label? }` | 204 | 404, 409 | `addMarker` |
| 35 | `addSessionNote` | POST `/api/v1/session/{id}/notes` | `SESSION_NOTE` | `NOTE_ADDED` | `{ text }` (1 to 2,000 characters) | 204 | 404, 409, 422 | `addNote` |
| 36 | `takeSessionSnapshot` | POST `/api/v1/session/{id}/snapshots` | `SESSION_NOTE` | `SNAPSHOT_TAKEN` | none | 204 | 404, 409 | `snapshot` |
| 37 | `acknowledgeSessionSummary` | POST `/api/v1/session/{id}/summary/acknowledge` | `SESSION_START` | `SUMMARY_ACKNOWLEDGED`; none for a repeat or another ID (no-op as today, [R1:168]) | none | 204 | — | `acknowledgeSummary` |
| 38 | `listSessionHistory` | GET `/api/v1/session/history` | `AUTHENTICATED` | `NONE-R` | `cursor`, `limit` | 200 `{ items: SessionHistoryEntry[], nextCursor }` | — | reads `sessionHistory` |

Note on operation 25. `startSession` is the design-book operation and keeps its composite behaviour (`sim/api.ts:397-431`): from CREATE it starts the pre-check (202, no audit row); from ARMED it starts the recording (200, `RECORDING_STARTED`); with `acknowledgeWarnings: true` after a WARN outcome it writes `PRECHECK_PASSED` and `RECORDING_STARTED`. It is the one operation with more than one possible audit type, by the existing contract (`core-api.ts:496-500`). The Live action `startRecording` calls it only for a session that its replica shows as ARMED; the state machine has no way back from ARMED to CREATE or PRECHECK [R1:210-226], so the composite branches cannot be reached from that action.

Permissions closed here (they are unchecked today, [R1:164-168]): `recover` and `acknowledgeSummary` take `SESSION_START`, which is how the clients already gate recovery (`apps/core-web/src/features/session-monitor/model.ts:69`; `apps/mobile/src/features/session-recovery/sim-adapter.ts:40`); `addMarker`, `addNote` and `snapshot` take `SESSION_NOTE`, which is how the web gates notes and markers (`model.ts:70`; `action-bar.tsx:99`).

Edge case E5 [BP:171], two clients create a session at the same moment: commands are serialised by the engine pipeline (section 8.2); the first gets 201, the second 409 `SESSION_ACTIVE` (or 200 with `created: false` for equal input).

### 7.9 Area 5: evidence

| # | operationId | Method and path | Access | Audit on success | Request | Success | Specific errors | Simulator action |
|--:|---|---|---|---|---|---|---|---|
| 39 | `listEvidence` | GET `/api/v1/evidence` | `EVIDENCE_VIEW` | `NONE-R` | `status?`, `caseType?`, `q?`, `cursor?`, `limit?` | 200 `{ items: EvidenceItem[], nextCursor }` | — | reads `evidence` |
| 40 | `getEvidence` | GET `/api/v1/evidence/{id}` | `EVIDENCE_VIEW` | `NONE-R` | none | 200 `{ evidence: EvidenceItem, media: EvidenceMediaRef }` | 404 | reads `evidence` |
| 41 | `verifyEvidence` | POST `/api/v1/evidence/{id}/verify` | `EVIDENCE_VIEW` | `EVIDENCE_VERIFIED` or `EVIDENCE_VERIFY_FAILED`, by the verdict [R1:169] | none | 200 `EvidenceVerifyResult` | 404 | `verify` |
| 42 | `exportEvidence` | POST `/api/v1/evidence/{id}/export` | `EVIDENCE_EXPORT` | `EVIDENCE_EXPORTED`; denial `EXPORT_DENIED` (RB-5) | `EvidenceExportRequest` | 202 `EvidenceExportAccepted` | 403 `FORBIDDEN`, 404, 409 `NOT_SEALED` or `SECURITY_FAULT`, 422 `INVALID_REASON` | `exportEvidence` |
| 43 | `archiveEvidence` | POST `/api/v1/evidence/{id}/archive` | `EVIDENCE_REVIEW` | `EVIDENCE_ARCHIVED`; none when already archived | none | 204 | 404, 409 `NOT_SEALED` | `archiveEvidence` |

Domain rules (I11, [RT:173]): no operation changes the tracks, the track hashes, the manifest hash or the signature of an item; status changes add a custody entry and an audit row; AUDIO-01 and AUDIO-02 are separate tracks in every answer. No operation sets the status UNDER_REVIEW: the simulator has none either (`EVIDENCE_REVIEW_OPENED` is written only by the seed, [R1:89]); recorded as GS-14.

### 7.10 Area 6: devices and inputs

| # | operationId | Method and path | Access | Audit on success | Request | Success | Specific errors | Simulator action |
|--:|---|---|---|---|---|---|---|---|
| 44 | `getDeviceHealth` | GET `/api/v1/device/health` | `AUTHENTICATED` | `NONE-R` | none | 200 `DeviceHealthResponse` | — | reads |
| 45 | `getAudioStatus` | GET `/api/v1/audio/status` | `AUTHENTICATED` | `NONE-R` | none | 200 `AudioStatusResponse` | — | reads |
| 46 | `getVideoStatus` | GET `/api/v1/video/status` | `AUTHENTICATED` | `NONE-R` | none | 200 `VideoStatusResponse` | — | reads |
| 47 | `getDeviceInventory` | GET `/api/v1/device/inventory` | `AUTHENTICATED` | `NONE-R` | none | 200 slices `device`, `cameras`, `mics`, `otherDevices`, `ports`, `activeCameraId`, `tabletLink` | — | reads |
| 48 | `restartDevice` | POST `/api/v1/device/{id}/restart` | `DEVICE_MANAGE` | `DEVICE_COMMAND` | none | 204 | 404, 409 `RECORDING_ACTIVE`, 409 `COMMAND_UNSUPPORTED` | `deviceCommand` (RESTART) |
| 49 | `testDeviceSignal` | POST `/api/v1/device/{id}/test-signal` | `DIAGNOSTICS_RUN` | `DEVICE_COMMAND` | none | 204 | 404, 409 `COMMAND_UNSUPPORTED` | `deviceCommand` (TEST_SIGNAL) |
| 50 | `identifyDevice` | POST `/api/v1/device/{id}/identify` | `DIAGNOSTICS_RUN` | `DEVICE_COMMAND` | none | 204 | 404 | `deviceCommand` (IDENTIFY) |
| 51 | `setActiveCamera` | POST `/api/v1/video/active-camera` | `AUTHENTICATED` (a view selection; no evidence effect) | `NONE-P` | `{ cameraId }` | 204 | — | `setActiveCamera` |
| 52 | `resetMicClip` | POST `/api/v1/audio/clip/reset` | `AUTHENTICATED` (resets an indicator on the meter every role sees) | `NONE-P` | `{ channel }` | 204 | — | `resetClip` |

The simulator's `deviceCommand` needs a different permission per command (`types.ts:1066-1071`); it is split into three operations so that each has one permission. `{id}` is a device ID such as `CAM-01`, `MIC-01`, `GNSS`, `TPM`, `FRONT-PANEL`.

### 7.11 Area 7: storage

| # | operationId | Method and path | Access | Audit on success | Request | Success | Specific errors | Simulator action |
|--:|---|---|---|---|---|---|---|---|
| 53 | `getStorageStatus` | GET `/api/v1/storage/status` | `AUTHENTICATED` | `NONE-R` | none | 200 `StorageStatusResponse` | — | reads |
| 54 | `getStorageDetail` | GET `/api/v1/storage/detail` | `AUTHENTICATED` | `NONE-R` | none | 200 slices `storage`, `storagePolicy` | — | reads |
| 55 | `setStoragePolicy` | POST `/api/v1/storage/policy` | `ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)` | `STORAGE_POLICY_CHANGED`; none when unchanged | partial `StoragePolicy` (`retentionDays` 1 to 3,650) | 200 `StoragePolicy` | 422 `INVALID_INPUT` | `setStoragePolicy` |

### 7.12 Area 8: network and time

| # | operationId | Method and path | Access | Audit | Request | Success |
|--:|---|---|---|---|---|---|
| 56 | `getNetworkStatus` | GET `/api/v1/network/status` | `AUTHENTICATED` | `NONE-R` | none | 200 slices `network`, `tabletLink` |
| 57 | `getTimeStatus` | GET `/api/v1/time/status` | `AUTHENTICATED` | `NONE-R` | none | 200 slice `time` |

The area has no command: its values are simulated hardware signals of the engine, and their faults are demo controls (section 12). Every timestamp comes from the server clock (Q15).

### 7.13 Area 9: security and audit

| # | operationId | Method and path | Access | Audit on success | Request | Success | Specific errors | Simulator action |
|--:|---|---|---|---|---|---|---|---|
| 58 | `getSecurityStatus` | GET `/api/v1/security/status` | `AUTHENTICATED` | `NONE-R` | none | 200 slice `security`, plus the audit head and total | — | reads |
| 59 | `listAuditRows` | GET `/api/v1/audit` | `AUTHENTICATED` (every role reads the audit page today; GS-02) | `NONE-R` | `category?`, `type?`, `actorId?`, `sessionId?`, `evidenceId?`, `order?`, `cursor?`, `limit?` | 200 `{ rows: AuditRow[], head, total, nextCursor }` | — | reads `audit` |
| 60 | `verifyAuditChain` | GET `/api/v1/audit/chain` | `AUTHENTICATED` | `NONE-R` | none | 200 `AuditChainStatus` | — | `verifyAuditChain` |
| 61 | `exportAudit` | POST `/api/v1/audit/export` | `AUDIT_EXPORT` | `AUDIT_EXPORTED`; denial `EXPORT_DENIED` (RB-5) | `{ reason, destination? }` | 202 `AuditExportAccepted` | 422 `INVALID_REASON` | `exportAudit` |
| 62 | `exportLogs` | POST `/api/v1/logs/export` | `AUDIT_EXPORT` | `AUDIT_EXPORTED` (`details.scope: LOGS`); denial `EXPORT_DENIED` | `{ reason, destination? }` | 202 `AuditExportAccepted` | 422 `INVALID_REASON` | `exportLogs` |
| 63 | `listEvents` | GET `/api/v1/events` | `AUTHENTICATED` | `NONE-R` | `category?`, `type?`, `severity?`, `cursor?`, `limit?` | 200 `{ events: SimEvent[], nextCursor }` | — | reads `events` |

In Live mode the export reason is mandatory (the simulator's form without a request records no reason, `types.ts:1037-1042`). Audit rows are delivered with `seq`, `prevHash`, `hash` and the full hashed body, so the web's own chain check works on server rows [R3:60]. `verifyAuditChain` reports three things: `view`, the shared check over the engine's ring (what the screens show, and what an `AUDIT_TAMPER` demo fault breaks); `stored`, the check over the table (which no demo fault can break, section 12.3); and `lineage`, the chains that earlier resets discarded.

**The stored check is incremental** [SDR:SD-27]. The operation needs only `AUTHENTICATED`, so a check of the whole table on every call would let any signed-in operator make the server read every audit row again and again. The server therefore remembers, in memory, the sequence and the hash up to which the stored chain has verified, and a call verifies only the rows above that position. The first call after a start verifies the table once from its first row; calls that arrive together share one run; a failed verification is remembered too (`firstBadSeq`), so repeating the call costs nothing. After a reset the position starts at the first row of the new chain. `stored.checked` is the sequence the stored chain has been verified through.

**The lineage of discarded chains** [SDR:SD-19]; [DEC:D16]. `lineage` lists the newest 20 rows of the chain-lineage table (E-26), newest first, with `lineageTotal`: for each discarded chain the epoch it ended in, its row count, its head hash, the time of the reset, the operator who ran it (null for the command line), the scenario and the reason. This is what keeps a reset traceable after more than one reset: the `SCENARIO_LOADED` row of a chain names only the chain directly before it, and that row is itself discarded by the next reset. Every signed-in role can read the lineage, as every role reads the audit page (GS-02). The Security & Audit page shows it under the chain result ([CL:§8.2, A9]).

### 7.14 Area 10: system and maintenance

| # | operationId | Method and path | Access | Audit on success | Request | Success | Specific errors | Simulator action |
|--:|---|---|---|---|---|---|---|---|
| 64 | `getSystemStatus` | GET `/api/v1/system/status` | `AUTHENTICATED` | `NONE-R` | none | 200 slices `device`, `services`, `update`, `diagnostics`, `settings` | — | reads |
| 65 | `runDiagnostics` | POST `/api/v1/system/diagnostics` | `DIAGNOSTICS_RUN` | `DIAGNOSTICS_RUN` | none | 202 `{ runId }` | — | `runDiagnostics` |
| 66 | `restartServices` | POST `/api/v1/system/services/restart` | `MAINTENANCE` | `DEVICE_COMMAND` (`details.scope: CORE_SERVICES`) | none | 200 `{ restarted }` | 409 `SESSION_ACTIVE` | `restartServices` |
| 67 | `startSoftwareUpdate` | POST `/api/v1/system/update` | `MAINTENANCE` | `UPDATE_STARTED`; none when already running | none | 202 | 409 `SESSION_ACTIVE` | `startSoftwareUpdate` |
| 68 | `updateSettings` | POST `/api/v1/settings` | `AUTHENTICATED` (display preferences of the console; documented as unaudited, `packages/shared/src/sim/actions.ts:87-91`) | `NONE-P` | partial `SettingsSlice` | 200 `SettingsSlice` | — | `updateSettings`, `setPresentationMode` |

### 7.15 Area 11: realtime status and alerts

| # | operationId | Method and path | Access | Audit on success | Request | Success | Simulator action |
|--:|---|---|---|---|---|---|---|
| RT | (the realtime channel) | GET `/ws`, WebSocket upgrade | By principal (section 9.2) | none | none | 101, then the messages of section 9 | — |
| 69 | `listAlerts` | GET `/api/v1/alerts` | `AUTHENTICATED` | `NONE-R` | none | 200 `{ alerts: SimAlert[] }` | reads `alerts` |
| 70 | `acknowledgeAlert` | POST `/api/v1/alerts/{id}/acknowledge` | `AUTHENTICATED` (the bell is on every page) | `NONE-P`; no-op for an unknown or acknowledged alert, as today [R1:178] | none | 204 | `acknowledgeAlert` |

Heartbeat, state changes, alerts, audio levels, timers, reconnect and resync are the realtime protocol (section 9). Every alert has an audit entry (I11): raising one writes `FAULT_RAISED` [R1:175].

### 7.16 Area 13: demo controls

All five need `DEMO_CONTROL` **and** the server-side demo flag; with the flag off a permitted caller gets 403 `DEMO_DISABLED` (section 12).

| # | operationId | Method and path | Access | Audit on success | Request | Success | Specific errors | Simulator action |
|--:|---|---|---|---|---|---|---|---|
| 71 | `getDemoStatus` | GET `/api/v1/demo/status` | `DEMO_CONTROL` | `NONE-R` | none | 200 `DemoStatus` | 403 `DEMO_DISABLED` | reads `faults` |
| 72 | `loadScenario` | POST `/api/v1/demo/scenario` | `DEMO_CONTROL` | `SCENARIO_LOADED` | `{ name }` | 200 `{ epoch }` | 403 `DEMO_DISABLED` | `loadScenario` |
| 73 | `injectFault` | POST `/api/v1/demo/faults` | `DEMO_CONTROL` | `FAULT_RAISED` (`AUDIT_CHAIN_DISCONTINUITY` for the kind `AUDIT_TAMPER`, [R1:175]); none when already active | `{ kind, target? }` | 204 | 403 `DEMO_DISABLED`, 404 | `inject` |
| 74 | `clearFault` | POST `/api/v1/demo/faults/clear` | `DEMO_CONTROL` | `FAULT_CLEARED`; none when nothing matches | `{ kind, target? }` | 204 | 403 `DEMO_DISABLED` | `clearFault` |
| 75 | `resetDemo` | POST `/api/v1/demo/reset` | `DEMO_CONTROL` | `SCENARIO_LOADED` (`details.reset: true`) | none | 200 `{ epoch }` | 403 `DEMO_DISABLED` | `resetDemo` |

### 7.17 The 42 simulator actions: every member mapped

Member list: `packages/shared/src/sim/types.ts:985-1094` [R1:150-191]. "Rule today" is the simulator's check [R1:197-201]. 40 members map to an operation, 2 are recorded exclusions. 31 are **hosted** (the server calls the shared action under the caller's identity), 9 are **server-native** (the shared action is not called; a server module does the work), 1 is not available in Live mode, and 1 is hosted but internal (31 + 9 + 1 + 1 = 42).

| # | Member | Rule today | Operation | Rule in Live mode | Execution |
|--:|---|---|--:|---|---|
| 1 | `signIn` | none (pre-auth) | 2 | `PUBLIC` plus ID-1 | server-native |
| 2 | `signInWithBiometric` | none; trusts the caller | 8 | `DEVICE` plus a server-issued token | server-native |
| 3 | `recordBiometricFailure` | none | 9 | `DEVICE` | server-native |
| 4 | `signInWithSecurityKey` | none; signs in the SUPERVISOR | — | **Excluded (X-1)**: a server must not issue a session without a credential (Q11) | not available |
| 5 | `signOut` | none | 5 | `AUTHENTICATED` | server-native |
| 6 | `touch` | none | 6 | `AUTHENTICATED` | server-native |
| 7 | `createSession` | `SESSION_START` (returned) | 24 | `SESSION_START` | hosted |
| 8 | `beginPrecheck` | `SESSION_START` | 28 | `SESSION_START` | hosted |
| 9 | `acknowledgePrecheckWarnings` | `SESSION_START` | 30 | `SESSION_START` | hosted |
| 10 | `retryPrecheck` | `SESSION_START` | 29 | `SESSION_START` | hosted |
| 11 | `startRecording` | `SESSION_START` | 25 | `SESSION_START` | hosted |
| 12 | `stopRecording` | `SESSION_START` | 26 | `SESSION_START` | hosted |
| 13 | `cancel` | `SESSION_START` | 31 | `SESSION_START` | hosted |
| 14 | `scanCaseNumber` | `SESSION_START` | 32 | `SESSION_START` | hosted |
| 15 | `recover` | **none** | 33 | `SESSION_START` | hosted |
| 16 | `addMarker` | **none** | 34 | `SESSION_NOTE` | hosted |
| 17 | `addNote` | **none** | 35 | `SESSION_NOTE` | hosted |
| 18 | `snapshot` | **none** | 36 | `SESSION_NOTE` | hosted |
| 19 | `acknowledgeSummary` | **none** | 37 | `SESSION_START` | hosted |
| 20 | `verify` | **none** | 41 | `EVIDENCE_VIEW` | hosted |
| 21 | `exportEvidence` | `EVIDENCE_EXPORT` (returned, audited) | 42 | `EVIDENCE_EXPORT` | hosted |
| 22 | `archiveEvidence` | `EVIDENCE_REVIEW` | 43 | `EVIDENCE_REVIEW` | hosted |
| 23 | `exportAudit` | `AUDIT_EXPORT` (returned, audited) | 61 | `AUDIT_EXPORT` | hosted |
| 24 | `exportLogs` | `AUDIT_EXPORT` (returned, audited) | 62 | `AUDIT_EXPORT` | hosted |
| 25 | `verifyAuditChain` | **none** | 60 | `AUTHENTICATED` | hosted |
| 26 | `inject` | **none**, no sign-in | 73 | `DEMO_CONTROL` and the demo flag | hosted |
| 27 | `clearFault` | **none**, no sign-in | 74 | `DEMO_CONTROL` and the demo flag | hosted |
| 28 | `resetClip` | **none** | 52 | `AUTHENTICATED` | hosted |
| 29 | `acknowledgeAlert` | **none** | 70 | `AUTHENTICATED` | hosted |
| 30 | `loadScenario` | **none**, no sign-in | 72 | `DEMO_CONTROL` and the demo flag | server-native (reset routine with the shared builders) |
| 31 | `resetDemo` | **none**, no sign-in | 75 | `DEMO_CONTROL` and the demo flag | server-native (reset routine) |
| 32 | `runDiagnostics` | `DIAGNOSTICS_RUN` | 65 | `DIAGNOSTICS_RUN` | hosted |
| 33 | `deviceCommand` | `DEVICE_MANAGE` or `DIAGNOSTICS_RUN`, by command | 48, 49, 50 | one permission per operation | hosted |
| 34 | `setStoragePolicy` | `EVIDENCE_REVIEW` or `MAINTENANCE` | 55 | `ANY-OF` the same two | hosted |
| 35 | `startSoftwareUpdate` | `MAINTENANCE` | 67 | `MAINTENANCE` | hosted |
| 36 | `restartServices` | `MAINTENANCE` | 66 | `MAINTENANCE` | hosted |
| 37 | `setActiveCamera` | **none** | 51 | `AUTHENTICATED` | hosted |
| 38 | `setPresentationMode` | **none**, no sign-in | 68 | `AUTHENTICATED` | hosted |
| 39 | `updateSettings` | **none** | 68 | `AUTHENTICATED` | hosted |
| 40 | `pair` | **none**; compares with a constant | 18 | `PUBLIC` plus a one-time code | server-native |
| 41 | `unpair` | **none** | 22 | `DEVICE` | server-native |
| 42 | `setTabletLink` | **none** | — | **Excluded (X-2)**: no client may set the link; the server sets it from real connections (section 6.8) | hosted, internal |

Counts: 41 distinct operations are reached by actions (`deviceCommand` reaches three; `setPresentationMode` and `updateSettings` share one); the other 34 operations are reads and new server functions. The 25 members that check nothing today [R1:201; DEC:F14] each have a rule in the fifth column: 23 gain an access rule, 2 are excluded.

Not called on the engine, in full: the four sign-in actions, `signOut`, `touch`, `pair`, `unpair` (identity and pairing are server-native); `loadScenario` and `resetDemo` (the reset routine uses the shared builders `createIdleState` and `buildScenarioState` instead, section 12.4); and the `auth-idle` engine subsystem, which stays inert because the engine's `auth` slice is signed out whenever a tick runs (ENG-2).

### 7.18 New schemas (for row 27 (W19, W22, W27))

Existing schemas: the 18 of `CORE_API_SCHEMAS` (`core-api.ts:337-357`). New ones, with their members. "slice" means the wire form of the named `SimState` type.

| Schema | Members |
|---|---|
| `SignInRequest` | `username` (1-64), `password` (1-128) |
| `AuthSessionInfo` | `operator` (`SimOperator` members), `permissions` (list), `method`, `issuedAt`, `lastActivityAt`, `idleExpiresAt`, `absoluteExpiresAt`, `deviceId` or null, `demoControls` (the demo flag), `serverTime` |
| `SignInResponse` | `session: AuthSessionInfo`; `sessionToken` (device sign-in only); `biometricToken` (operation 8 only) |
| `SignInStatus` | `locked`, `lockedUntil` or null, `retryInMs`, `attemptsRemaining`, `serverTime` (the members of `LockoutStatus`, `auth.ts:116-122`) |
| `RoleMatrix` | `roles`, `permissions`, `grants` (role and permission pairs), `editable: false` |
| `AdminUser` | `SimOperator` members, `enabled`, `lastSignInAt` or null, `activeSessions`, `roleChangedAt` or null |
| `PairingCodeIssued` | `codeId`, `code`, `qrPayload`, `issuedAt`, `expiresAt`, `attemptsAllowed` |
| `PairingCodeStatus` | `codeId`, `issuedBy`, `issuedAt`, `expiresAt`, `attemptsRemaining` |
| `PairingRedeemRequest` | `code` (six digits), `deviceName` (1-60), `platform`, `appVersion` |
| `PairingRedeemed` | `deviceId`, `deviceCredential`, `pairedAt`, `core` (`deviceId`, `name`, `certificateFingerprint`: the members the client's `pairing` slice needs, `types.ts:260-268`) |
| `PairedDevice` | section 6.5 |
| `DeviceRegistration` | `deviceId`, `name`, `state`, `pairedAt`, `credentialRotatedAt`, `core` |
| `EvidenceMediaRef` | `source` (`DEMO_PACKAGE` or `NONE`), `packageSuffix` or null (section 11) |
| `EvidenceVerifyResult` | as `types.ts:915-922` |
| `AuditExportAccepted` | `exportId`, `scope` (`AUDIT` or `LOGS`), `rows`, `head` |
| `AuditChainStatus` | `view` (`ChainVerifyResult`, `types.ts:951-960`), `stored` (`ok`, `checked`, `head`, `firstBadSeq` or null), `lineage` (list of `AuditChainLineageEntry`, newest first, at most 20), `lineageTotal` |
| `AuditChainLineageEntry` | `epoch`, `rows`, `head`, `resetAt`, `actorId` or null, `scenario`, `reason` (`RESET` or `SCENARIO_LOAD`) |
| `DemoStatus` | `scenarios`, `scenario` (loaded), `activeFaults`, `seededAt`, `lastResetAt` or null, `epoch` |
| 28 slice schemas | one per replicated slice of section 3.2 |
| Realtime messages | section 9.4 |

### 7.19 Pinned contract assertions that change by design

The drift test pins today's shape [R2:187-201; DEC:F5]. These assertions change with this contract; rows 27 and 98 (W19, W22, W27, W83) own the edits.

| Assertion today | After |
|---|---|
| Exactly 10 operations | 75 |
| Exactly one LIVE operation, nine SIMULATED; badge counts 1 and 9 | Changes with the mode model, as the client specification adopted it ([CL:AR-1]; [DEC:D15]): the two-value `mode` keeps meaning "who answers in Simulated mode" (the nine stay `simulated`, the 66 others are `live`), and each entry names the answering service |
| The set with `x-dems-rbac` is four operations; roles equal the `roleHas` holders | 41 operations carry a permission; holders follow the matrix of section 4.4 |
| No `security` and no `securitySchemes`; the only host is `127.0.0.1:4400` | Two schemes; a second server `127.0.0.1:4420` |
| The `/ws` description parses with `HeartbeatSchema` only | The message union of section 9.4 |
| `SIM_API_ROUTES` equals the nine simulated operations, and the simulator produces every documented status | Unchanged for the nine: the simulator is not rewritten; the six reads gain a documented 401 that only the server produces, so the comparison must be limited to the statuses the simulator can produce |

---

## 8. Engine: hosting, persistence, clock, restart and recovery

The server hosts the shared simulator core headless for the hardware signals and the session machine [DEC:D11 ADQ-1]. It does not re-implement the domain rules: 11,610 lines of tested shared behaviour stay the one implementation for both modes [AN:105].

### 8.1 What the engine is

| Item | Value | Source |
|---|---|---|
| Instance | One headless `Sim` per server process (one per lane instance) | [AN:520] |
| Created with | The injectable options of `createSim` (`packages/shared/src/sim/types.ts:139-162`): a server clock, a server scheduler (50 ms), memory storage, no operator-record storage, an always-visible visibility adapter, the server's error reporter | [R1:473] |
| Subsystems that run | clock, session-machine, health (1 Hz), audio (20 Hz), generator, maintenance | [R1:461-469] |
| Subsystem that stays inert | auth-idle (ENG-2) | [R1:464] |
| Hosted actions | 31 through operations, plus `setTabletLink` internally (section 7.17) | section 7.17 |
| Not called | The four sign-in actions, `signOut`, `touch`, `pair`, `unpair`, `loadScenario`, `resetDemo` (section 7.17); the simulator's `authLockout` and `pairing` slices; its REST handler (`Sim.request`) | [AN:520] |
| Not rewritten | `packages/shared/src/sim/**`, except additive vocabulary values (P21, [BP:476]). A missing seam is logged as `SIM-GAP-n` and returned as `needs-review` [BP:452] | [DEC:D9] |

### 8.2 The command pipeline and the actor scope

| ID | Rule | Source |
|---|---|---|
| ENG-1 | **One pipeline.** Every state change, by a command or by an engine tick, passes one serial pipeline: change the state, write the changed durable parts in one PostgreSQL transaction, commit, publish. At most one unit of work is between "changed" and "committed" at a time; the scheduler runs no tick while a commit is in flight, and the next tick carries the elapsed time, which the engine already supports [R1:459] | [AN:520, AN:568] |
| ENG-2 | **Actor scope.** After the guard has accepted the caller, the command sets the engine's `auth` slice to that operator, calls the shared action and sets `auth` back to signed-out **in a `finally` block**, all in one synchronous turn. A hosted action refuses by throwing (ENG-7), which is the normal refusal path; the `finally` makes sure that a throw cannot leave the caller's identity in the engine for the next tick or the next command. Node runs one turn at a time, so no tick and no other command can run in between. Between commands the engine's `auth` slice is always signed out; rows written by the engine itself have no operator | [AN:520]; [R1:84]; G-25 [AN:796]; [SDR:SD-22] |
| ENG-3 | Before a command runs, the engine's `operators` slice equals the operators table (identity fields and role). The shared checks inside hosted actions then see the current role (RB-7) | [AN:520] |
| ENG-4 | **Write-through.** After the action, the slices whose reference changed [R1:41] are written: records at once (class S), the hardware snapshot at most once a second (class SN). The HTTP answer is sent **after** the commit | [AN:520] |
| ENG-5 | **Commit failure.** The engine's state is set back to the reference held before the unit of work; a command answers 503 `NOT_READY`; health reports `ready.database: false`; ticks are suspended until a write succeeds again, then resume with the elapsed time | [AN:520] |
| ENG-6 | Commands are ordered by arrival. Two commands never interleave, which closes edge case E5 (section 7.8) and E12 (audit appends from a tick and from a request, [BP:178]) | this file |
| ENG-7 | A hosted action's refusal (a thrown `Sim*Error` or a refusal in its result type) changes nothing and is mapped by section 7.2 | [R1:94] |
| ENG-23 | **Server-native handlers use the same pipeline.** Every state change of the identity, pairing and administration modules and of the guard (the check, the count, the transition and the audit row) is **one unit of work** in the serial pipeline of ENG-1, committed in one PostgreSQL transaction. There is one reading of where such a handler runs: inside the pipeline | [SDR:SD-04]; [DEC:D16] |
| ENG-24 | **An attempt is consumed before it is verified.** `signIn`, `signInWithBiometric` and `redeemPairingCode` first take one attempt from their lockout counter (and answer 423 with its row when the counter is at its limit), then verify, and clear the counter on a success. So n attempts that arrive together are counted as n attempts, whatever their order | [SDR:SD-04] |
| ENG-25 | **Transitions are compare-and-set.** A transition that can race is one statement whose row count decides, as the database contract writes them [DB:§5.6]: the pairing code becomes REDEEMED only where it is still ACTIVE and not expired; the failed-attempt count of a code is raised by an increment that returns the new value; a biometric token becomes used only where it is neither used nor revoked. A statement that changes no row means the other request won, and the handler gives the generic failure answer | [SDR:SD-04] |
| ENG-26 | **Only the hash computation runs outside the pipeline.** Argon2id takes far longer than a tick, and the pipeline must not wait for it [AN:378]. `signIn` is therefore two units of work with the computation between them: unit 1 is the lock check and the attempt consumption; then the Argon2id computation, always (ID-2); unit 2 reads the operator again (`enabled` and the role may have changed meanwhile), decides, and writes either the session row with `AUTH_SUCCESS` or the `AUTH_FAILED` row | [SDR:SD-04] |
| ENG-27 | The last-administrator check and the update it guards (RB-8) are one unit of work | [SDR:SD-04] |

### 8.3 Audit and events: one chain, one writer

| ID | Rule | Source |
|---|---|---|
| ENG-8 | Every audit row and every event, whether written by a hosted action, by an engine subsystem or by a server-native module (identity, pairing, administration, denial), is appended through the shared `appendActivity` function on the engine's state inside the pipeline. There is one chain | [AN:520]; [R1:87] |
| ENG-9 | The hash function and the canonical form are the shared ones: `sha256(prevHash ‖ canonicalJSON(body))`, `seq = total + 1`, genesis 64 zero digits (`packages/shared/src/sim/events.ts:64-84, 123`; `constants.ts:44`) | [R1:87] |
| ENG-10 | The table keeps every row; the engine keeps its ring of 1,000 audit rows and 500 events. Persistence writes only rows with a sequence above the stored head; an alteration of a ring row is never written (section 12.3) | [AN:566-568] |
| ENG-11 | The database refuses a row that does not continue the chain, and refuses UPDATE, DELETE and TRUNCATE on the audit table: the runtime role has no such privilege, and a trigger refuses them for every role. Both audit triggers are enabled `ALWAYS`, so a session setting cannot skip them (the mechanism and its proof are the database contract's, [DB:§6]; [SDR:SD-06]) | [AN:568]; [BP:289] |
| ENG-12 | Server-native rows use the existing row shape: `actorId` (operator ID or null), `deviceId` (registry ID or null), flat `details` (`types.ts:68-69`). A server-native row names no secret (SR-54) | [R1:87] |

### 8.4 The server clock (Q15)

| ID | Rule |
|---|---|
| ENG-13 | The server's wall clock is the engine clock, at speed 1. Every `at`, every identifier date and every timer deadline comes from it. The time zone arithmetic stays the shared fixed `+07:00` (`constants.ts:47-48`) |
| ENG-14 | The clock never moves backwards: the adapter returns the larger of the last value and the current wall time |
| ENG-15 | No request carries a time that the server trusts. Clients show server time through an offset learned from `serverTime` in the heartbeat |
| ENG-16 | Tests inject a manual clock, as the shared suites do (`createManualClock`, [R1:473]) |

### 8.5 The seed clock rule and the frozen demo evidence packages (F6)

| ID | Rule | Source |
|---|---|---|
| ENG-17 | The seed and every reset run **as of the server clock at that moment**: the seed program calls the shared `createIdleState` with `now` [AN:367, AN:569]. Session, evidence and case identifiers carry that date [R2:464]; "today" lists are filled on any demo day [R2:466] | [DEC:D11 ADQ-4] |
| ENG-18 | The demo evidence packages and the API examples are frozen at 2026-10-01 10:00 WIB [R2:475]. They stay attached on any seed date because the join ignores the dated parts of the identifiers and matches the evidence suffix, the session suffix, the case sequence and the subject name [R2:520-522]. The server uses the same join; the packages are never regenerated (P13, [BP:453]) | [R2:520] |
| ENG-19 | An example shown against the Live server takes its identifiers from the database, never from the frozen example identifiers; a frozen identifier does not exist on another day [DEC:F20] | [AN:569] |
| ENG-20 | The seed takes `now` as a parameter. Tests pass the fixed instant the existing suites use (2026-10-01 10:00 WIB) | [AN:569] |
| ENG-21 | After the seed the data does not follow the calendar: a database seeded yesterday shows yesterday's sessions as yesterday. A presenter resets before a demo. `seededAt` is stored and shown in `getDemoStatus` | this file |
| ENG-22 | Known edge: in the first hours after midnight WIB fewer than seven items are "sealed today" (before about 02:25 by the baseline gate, [AN:573]; before about 02:50 by the dataset rule, [R2:467]) | [DEC:F20] |

### 8.6 Engine: restart and recovery

**Stop.** On SIGINT or SIGTERM the server stops accepting commands, drains the pipeline, writes the hardware snapshot, closes the sockets (code 1001) and closes the pool.

**Start.** Order: configuration; database connection and schema check (migrations are applied by a separate command under the owner role `dems_owner`; the running server connects as `dems_app` and only checks the schema version, section 19.4 item 14); rehydration; scheduler start; listen.

| What | At start |
|---|---|
| **Restored from PostgreSQL** | Operators, roles, grants; auth sessions (an operator stays signed in across a restart if the session did not expire meanwhile); paired devices and credentials; an ACTIVE pairing code with its expiry and attempt count; biometric tokens; the audit chain (ring = the newest 1,000 rows, with `total`, `head`, `dropped`); events (ring = the newest 500); the active session with its timeline; session history; evidence, tracks, custody; exports; alerts; storage policy; settings; counters; the chain lineage (E-26); the Core device record; the hardware snapshot (cameras, microphones, storage, time, network, security, services, health series, other devices, ports, faults, diagnostics, update, active camera) |
| **Fresh** | `audio` (silent frames), `clock` (now), the engine's `auth` (signed out), the lockout counters (G-26), the throttle and denial-budget counters, the verified position of the stored chain, the socket registry, the state revision (0) with a **new epoch** (the stored epoch plus 1, [DEC:D14]), the random streams (re-derived from the seed and the epoch, as the shared hydration does, [R1:473]) |
| **Recomputed** | The tablet link: OFFLINE until a paired device connects. If the stored value was CONNECTED, `setTabletLink(OFFLINE)` writes the truthful `TABLET_LINK_CHANGED` row |
| **Not generated** | No activity is invented for the time the server was down: subsystem timers start at the start time |

**A session that was in flight** (impact question 10, edge case E1):

| Stored session state at start | What the server does | What the operator sees | Audit rows |
|---|---|---|---|
| none, CREATE, SEALED | Nothing | The same state | none |
| PRECHECK, ARMED, RECORDING, STOPPING, FINALIZING | Raises the power-failure fault through the hosted `inject` path with no operator as actor; the shared code moves the session to FAULT [R1:223] | A fault banner; the session waits for recovery | `FAULT_RAISED` |
| the same, then `recoverSession` by an operator with `SESSION_START` | The shared `recover` path: FAULT to RECOVERY; three seconds later the engine closes the session as INCOMPLETE, with a RECORDED (never sealed) evidence item if a recording had started [R1:164, R1:225] | The existing recovery screens | `SYSTEM_BOOT`, `RECOVERY_STARTED`, `FAULT_CLEARED`, then `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED` |
| FAULT | Nothing; the fault stays | As before the stop | none |
| RECOVERY | The timed transition fires at its scheduled time at the first tick [R1:91] | Recovery completes | `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED` |

Why the recording is not simply continued: the shared timed transitions would catch up with the same timestamps as a live run [R1:91], but the Core recorded nothing while the process was down, and a continuous recording would be a false record. The design book's recovery path is the model [RT:251; AN:520]. A diagnostics run or a software update that was in flight completes by its stored deadlines at the first tick.

The injected fault needs no demo flag: it is an internal call, not the demo operation.

### 8.7 Rates and the write budget

| Signal | Rate | Stored? |
|---|---|---|
| Engine tick | 50 ms (`constants.ts:22`) | — |
| Audio frames | 20 Hz (`constants.ts:26`) | **Never** (Q4) |
| Health, storage, time, network steps | 1 Hz (`constants.ts:28`) | Snapshot row, at most one write a second |
| Session progress while recording | 1 Hz | One coalesced write a second |
| Audit rows while recording | About 7.5 a minute [R2:487] | Every row, one transaction each |
| Health snapshot row | Every 60 s and at each fault raise and clear | Yes (E-25) |

---

## 9. Realtime protocol

Transport: `ws` 8.22.0 through `@fastify/websocket` 11.3.1 at path `/ws` on the server's port [DEC:D11 TD-08]. Messages are one JSON object per text frame, a zod discriminated union on `type` in the shared contract; the existing `heartbeat` member is unchanged (`packages/shared/src/api/realtime-messages.ts:25-36`).

### 9.1 Parameters

| ID | Parameter | Value | Source |
|---|---|---|---|
| RT-P1 | Heartbeat | 1,000 ms; a client treats the link as stale after 2,500 ms | `packages/shared/src/api/constants.ts:20-21` |
| RT-P2 | Reconnect delays | 500, 1,000, 2,000, 4,000, 8,000 ms (the last repeats) plus up to 250 ms jitter | `constants.ts:23-24` |
| RT-P3 | Protocol ping | Every 30 s; a connection that did not answer the previous ping is terminated | [R8:356] |
| RT-P4 | Largest client message | 65,536 bytes | [AN:422]; [R8:350] |
| RT-P5 | Client messages | At most 30 in 10 s per connection, else close 1008 | [R10:600]; number chosen here |
| RT-P6 | Connections | At most 16 per server instance, **of which at most 6 ANONYMOUS** (no device and no operator). An upgrade beyond either limit is closed with 1013. Anonymous sockets, which any local client can open, therefore cannot take the places of devices and operators: 10 of the 16 are always left for them [SDR:SD-13] | [AN:422]; numbers chosen here (6 is the review's example) |
| RT-P7 | Compression | Off (the server default) | [R8:350] |
| RT-P8 | Meter wire rate | 20 Hz; a server constant that may be lowered (I8 fallback) | [AN:424] |
| RT-P9 | Meter skip threshold | A meter frame is skipped for a connection whose `bufferedAmount` is above 65,536 bytes | [R8:332]; SA-06 |
| RT-P10 | Hard buffer limit | A connection whose `bufferedAmount` is above 4,194,304 bytes is closed with 4408 | SA-06 |
| RT-P11 | Delta pacing | A delta caused by a command or by a record change is sent at once; deltas caused only by the 1 Hz steps are sent at most four times a second | this file |
| RT-P12 | Control deadline | 1 s from the commit to the push and the close (section 4.7) | [BP:311] |
| RT-P13 | Session re-validation | Every connection's session is checked by the sweeper (ID-P8) | [R8:418] |
| RT-P14 | Throttle | A socket upgrade is counted by the request throttle of ID-P12, under the key of its principal or its class | [SDR:SD-12] |

### 9.2 Realtime protocol: authentication and visibility

Authentication happens **only at the upgrade** and only from the upgrade request's headers. No token is ever accepted in the URL, in a subprotocol or in a message (SR-38).

| Client | What it does | What the server reads |
|---|---|---|
| Web console | Opens `/ws` on its own origin; the browser attaches the session cookie and the `Origin` header by itself. A browser cannot set an `Authorization` header on a socket [R8:400] | Cookie and Origin |
| Mobile app | Passes `Authorization: Bearer` in the socket constructor's `headers` option (React Native allows it, [R8:406]): the session token when signed in, the device credential when signed out. It sends no cookie. React Native may add an `Origin` header that names the URL it opens (SA-03) | The `Authorization` header. An `Origin`, when present, must be one of the instance's own origins (section 14.2) |

| Upgrade request | Result |
|---|---|
| An `Origin` that is in neither list of section 2.4, or the literal `null` | HTTP 403 at the handshake [R8:388] |
| No credential; no `Origin`, a web console origin, or one of the instance's own | Accepted as ANONYMOUS, inside the anonymous cap (RT-P6) |
| The cookie with a web console origin, no longer resolving to a session | Accepted as ANONYMOUS; `hello.reason: SESSION_INVALID` (the login page still needs the heartbeat, [R3:65]) |
| The cookie with a web console origin, resolving to a web session | Accepted as OPERATOR |
| The cookie with no `Origin`, or with one of the instance's own origins | HTTP 403 at the handshake: a browser always sends its `Origin` on an upgrade, and the own origin is never valid together with a cookie (OR-2) |
| A bearer value with no `Origin` or with one of the instance's own origins: a valid device credential | Accepted as DEVICE |
| The same: a valid session token bound to a PAIRED device | Accepted as OPERATOR |
| The same: a value that is unknown, expired, or belongs to a revoked device | The handshake completes, the server sends `hello` with `principal: ANONYMOUS` and the reason, then closes with 4401 or 4403. A React Native client cannot read an HTTP status of a refused upgrade, but it can read a close code (**hypothesis**; row 59 (W30) confirms) |
| A bearer value with a web console origin | HTTP 403 at the handshake (OR-4) |
| The cookie and an `Authorization` header together | HTTP 401 at the handshake (ID-12), or 403 where the cookie's Origin rule already refuses |

A web client that signs in or out must open a new socket, because the principal is fixed at the upgrade. The full table of credential against `Origin`, for HTTP requests and for the upgrade, is in section 14.2.

**What each principal receives:**

| Topic | Content | ANONYMOUS | DEVICE | OPERATOR |
|---|---|:-:|:-:|:-:|
| `heartbeat` | Liveness, server time | yes, with `sessionState: null` | yes, with `sessionState: null` | yes, with the real session state |
| `control` | `session.updated`, `session.ended`, `device.revoked` | no | `device.revoked` only | yes |
| `state` | Snapshot and deltas of the 28 replicated slices | no | no | yes |
| `meters` | 20 Hz audio frames | no | no | on `subscribe` |
| `admin` | "A list changed" hints for the two portal pages | no | no | users: only with `USER_ADMIN`; devices and pairing code: only with `PAIRING_MANAGE` |

So an unpaired device and a signed-out client receive `hello` and `heartbeat` and nothing else (impact question 13).

### 9.3 State replication: snapshot, then deltas

| ID | Rule |
|---|---|
| RT-1 | After `hello`, an OPERATOR connection receives one `snapshot` with the 28 replicated slices (section 3.2), the `epoch` and the `revision` |
| RT-2 | Every later change arrives as a `delta` whose `revision` is exactly the previous one plus 1 within the epoch. Revisions are gap-free |
| RT-3 | A delta holds operations: `replace` (one whole slice) and `append` (new rows of `audit`, with `head`, `total`, `dropped`, or of `events`). A slice that did not change is not sent, so a client can keep its reference [AN:534] |
| RT-4 | **State deltas are never dropped.** A connection that cannot keep up is closed (RT-P10) and resynchronises |
| RT-5 | **Read-your-writes.** For a command answered 2xx with revision N (API-7), the delta that holds its effect has a revision of at most N and is sent to every `state` subscriber. A client that waits for revision N therefore sees the effect of its own command [AN:551] |
| RT-6 | **Resync.** A client that sees a revision gap, or another epoch, sends `resync`; the server answers with a new `snapshot`. After a reconnect the server always starts with a `snapshot`; no delta is replayed. A resynchronised client's state equals a fresh client's [BP:311] |
| RT-7 | A demo reset or a scenario load (section 12.4) and a server restart start a new epoch; every OPERATOR connection gets a new `snapshot` |
| RT-8 | **Meter frames** go only to connections that subscribed, are skipped per connection under RT-P9 (the latest value wins) and carry no revision |

The `audit` slice is replaced as a whole only when a ring row changed in place (the `AUDIT_TAMPER` demo fault and its clearing); otherwise rows arrive as appends.

### 9.4 Realtime protocol: messages and resync

Server to client:

| `type` | Topic | Members (besides `type` and `v: 1`) | Sent to |
|---|---|---|---|
| `hello` | — | `connectionId`, `epoch`, `principal`, `reason?`, `topics`, `serverTime`, `heartbeatIntervalMs` | Every connection, first |
| `heartbeat` | heartbeat | Unchanged: `seq`, `serverTime`, `uptimeMs`, `intervalMs`, `clients`, `sessionState` (`realtime-messages.ts:25-34`) | Every connection, 1 Hz |
| `snapshot` | state | `epoch`, `revision`, `serverTime`, `state` | OPERATOR: after `hello`, on `resync`, on a new epoch |
| `delta` | state | `epoch`, `revision`, `serverTime`, `ops` | OPERATOR |
| `meters` | meters | `at`, `seq`, `audio` (the `AudioSlice` wire form, `types.ts:471`) | Subscribed OPERATOR |
| `session.updated` | control | `operator` (`id`, `role`), `permissions`, `reason: ROLE_CHANGED` | Sockets of the operator's sessions |
| `session.ended` | control | `reason`: `SIGNED_OUT`, `IDLE_EXPIRED`, `ABSOLUTE_EXPIRED`, `ROTATED`, `USER_DISABLED`, `TOKEN_REUSE` | Sockets of the session, then close |
| `device.revoked` | control | `reason`: `REVOKED`, `UNPAIRED` | Sockets of the device, then close |
| `admin.changed` | admin | `resource`: `USERS`, `DEVICES`, `PAIRING_CODE` | Permission holders (section 9.2); the client refetches through REST |

Client to server (anything else, or a message from a principal that may not send it, closes with 1008):

| `type` | Members | Allowed for |
|---|---|---|
| `subscribe`, `unsubscribe` | `topic: meters` | OPERATOR |
| `resync` | none; at most one in 2 s | OPERATOR |

Close codes:

| Code | When | Client reaction |
|--:|---|---|
| 1001 | Server shutdown | Reconnect with RT-P2 |
| 1008 | Protocol violation | Reconnect |
| 1013 | Connection cap | Reconnect later |
| 4401 | The session ended (any reason of `session.ended`), or an invalid bearer | Web: open an anonymous socket, show the login screen. Mobile: login screen |
| 4403 | The device was revoked or unpaired | Mobile: delete the credential, show the pairing screen |
| 4408 | Slow consumer | Reconnect and resynchronise |

### 9.5 What never appears in a realtime message

A password; a session token; a cookie value; a device credential; a biometric token; a pairing code or a QR payload; any hash or salt of those; database credentials; the `enabled` flag or the session list of another operator; the paired-device list (it is REST-only behind `PAIRING_MANAGE`); another console's lockout state. `admin.changed` carries only the name of the list that changed. The same exclusions hold for audit rows, events and logs (SR-15, SR-28, SR-48, SR-54).

---

## 10. Mode contract: Live and Simulated

### 10.1 Mode contract (server side)

The server knows nothing about Simulated mode. The clients choose a source [DEC:D11 ADQ-7]; row 17 owns the switch and the indicator.

| Aspect | Simulated mode (unchanged) | Live mode |
|---|---|---|
| Who answers | The in-app simulator of each client; mock-core for health and heartbeat | The Core server |
| State | One copy per client (`dems.sim.v1`) [RT:51] | One, on the server |
| Identity, RBAC, pairing | In the client, from shared constants | In the server, from PostgreSQL |
| Clock | Each client's simulator clock | The server clock (Q15) |
| Sign-in methods | Password, biometric, security key (simulated) | Section 5.5 |
| Pairing | A constant code; an unpaired tablet may sign in | Mandatory for mobile; portal-issued code (section 6) |
| Demo controls | Open to every role, no sign-in [R1:96] | `DEMO_CONTROL` and the server's demo flag (edge case E14) |
| Actions | Synchronous | Asynchronous with the same names, result shapes and error classes [DEC:D11 ADQ-3] |
| Default | Yes, in every build [AN:609-614] | Offered only in dev and debug builds |

| ID | Rule the server relies on |
|---|---|
| MC-1 | **No silent fallback.** A client in Live mode that cannot reach the server shows an offline state with an explicit action to use Simulated mode; it never switches by itself, because the two modes hold different data (edge case E9, [AN:621]) |
| MC-2 | A client in Simulated mode sends nothing to the server (AC-B-63) |
| MC-3 | The packaged web build and the release APK are Simulated-only; Live code is inert there (edge case E8, [AN:610, AN:613]) |
| MC-4 | The health answer tells the services apart: `dems-mock-core` or `dems-core-server` (section 7.4) |
| MC-5 | The stored keys of both clients are never deleted or reused (edge case E10; U8) |

### 10.2 Released artefacts and versioning

| Item | Rule | Source |
|---|---|---|
| `release/` | Byte-identical: 29 files, checksums verified in the verification phase (AC-B-60). Never written | [DEC:D9 DN-1]; [DEC:F8] |
| `apps/mock-core/**`, `scripts/release/**` | Not changed (AC-B-61) | [BP:476] |
| Pinned sources | They change from the first implementation row on; that is expected. The provenance of 0.1.0 is commit `acaff20` plus `release/web/BUILD-INPUTS.txt` | [DEC:D9 DN-1] |
| Server version | 0.2.0, private package; the OpenAPI `info.version` becomes 0.2.0 | [AN:634] |
| A live edition | Not built in this task. If one is built later, it is versioned 0.2.0 or higher and written beside the 0.1.0 files, never over them | [DEC:D11 TD-13] |

### 10.3 Client reachability and its limits

| Client | Reaches the server? | Why |
|---|---|---|
| Web dev server on this Mac | Yes, through the same-origin proxy | [DEC:D11 ADQ-6] |
| Debug build on an emulator | Yes, through `adb reverse tcp:4420` | Q6 [DEC:D4] |
| Release APK (0.1.0 or a new one) | **No.** Its manifest allows no cleartext traffic and the app has no configurable address [R4:63]; [RT:59] | Changing that is U4 (the user's call) |
| A physical tablet, another PC | **No.** The server listens on loopback only | U4 |

### 10.4 Live package: cost and decision

The cost is recorded in the decision record: a path without Docker and without an administrator install exists on paper for four targets, is proven on none, and three targets cannot be exercised on this host [AN:498-503]. **No live package is built in this task** [DEC:D11 TD-13]; the 0.1.0 packages stay the offline edition (Q7).

---

## 11. Media and evidence package files

**Decision MS-1: the server does not serve media or package files in this task.** The clients keep their bundled demo media; the server owns the records, the hashes and the verdicts. This is the recommendation of the decision record for impact question 8 [AN:745].

| Asset | Where it lives in Live mode | Served by | The server's part |
|---|---|---|---|
| Evidence media of the 13 dataset items (196 files, 41.46 MiB, two renditions) [R2:556-566] | Bundled in each client: Vite globs in the web, a static map in the app; the mobile copy is identical to the shared one [R2:580-582] | The client's own bundle | Track list, sealed hashes, sizes, `integritySource`, and `EvidenceMediaRef` (operation 40): whether the bundled demo package applies and under which suffix |
| Live camera loops | Bundled | The client's own bundle | Camera state only |
| Package documents (manifest, signature, certificate, audit extract; 14 folders) [R2:567] | Bundled through `@dems/shared/demo-data` [R2:530] | The client's own bundle | The verdict of record (`verifyEvidence`), the manifest hash and the signature summary of the item |
| The prebuilt export archive of evidence 0004 | Bundled | The client's own bundle | The export record and its audit row |
| An audit or log export file | Built by the client from server rows (operations 59 and 63) after the server accepted the export (operations 61, 62) | — | The accepted export and its audit row |
| A session recorded in Live mode | No media exists, in either mode: the item joins no package and stays `SIMULATED` [R2:522] | — | The record |

| ID | Rule |
|---|---|
| MS-2 | The server decides which media belongs to an item: a client shows bundled media for an item only when the server's `EvidenceMediaRef.source` is `DEMO_PACKAGE`. The join is the shared one (section 8.5) |
| MS-3 | The server accepts no upload and resolves no file path that a client sent (SR-66) |
| MS-4 | `@fastify/static` is not installed. Blueprint row 41 is recorded as SKIPPED with this section as its anchor [BP:314] |
| MS-5 | The verdict of record is the server's. A client-side recomputation over bundled files may be shown, but it does not write state, and a client never calls a demo control to mirror a tamper [R3:61] (open point for row 17) |

Why: the files are static build-time assets, the same bytes in both clients; serving them would need authenticated range requests through the dev proxy and an authenticated player on the device over `adb reverse`, neither of which any row has run; and it would add nothing to SC3-SC5. If the controller wants it later, the pinned option is `@fastify/static` 10.1.5 with authenticated, read-only range requests [AN:213].

---

## 12. Demo controls

Q14: demo controls exist on the server behind a permission and a server-side demo flag [DEC:D4].

### 12.1 Gate

| ID | Rule |
|---|---|
| DC-1 | The five operations of section 7.16 need `DEMO_CONTROL` (SUPERVISOR). A caller without it gets 403 `NOT_PERMITTED` and an `ACCESS_DENIED` row, whatever the flag |
| DC-2 | The demo flag is server configuration, read once at boot, off by default, and cannot be changed through the API. With the flag off a permitted caller gets 403 `DEMO_DISABLED` on all five (no audit row; one log line) |
| DC-3 | The session answer tells a client whether the flag is on (`AuthSessionInfo.demoControls`), so the panel can be hidden. Nothing about the flag is public |

Edge case E14 [BP:180]: in Simulated mode the same controls need no sign-in; that stays as it is.

### 12.2 Fault injection and clearing

Operations 73 and 74 call the hosted `inject` and `clearFault` actions. The 12 fault kinds and their targets are the shared ones (`packages/shared/src/sim/vocabulary.ts:188-202`; `types.ts:962-979`). A critical fault during a session moves it to FAULT [R1:223]. Every raised fault creates an alert and a `FAULT_RAISED` row (I11).

### 12.3 Two faults that touch protected data

| Fault | In the simulator | In Live mode |
|---|---|---|
| `AUDIT_TAMPER` | Rewrites one stored row of the ring so that the chain check fails [R1:175] | Alters **only the engine-held ring** (SA-10). The PostgreSQL table is never touched: the runtime role cannot update it and persistence writes only new rows (ENG-10). `verifyAuditChain` shows the broken `view` and the intact `stored` chain. Clearing the fault restores the ring row. The overlay does not survive a restart: the ring is rebuilt from the table, and the server clears the fault at start |
| `TAMPER` with an evidence target | Marks the item as tampered; verification then fails on one track [R1:175] | Sets the item's `tampered` flag and track marker (stored, so a restart keeps it). The sealed hashes, the manifest hash and the signature are not changed; clearing the fault restores the flag |

### 12.4 Scenario load and reset to the seed state

`loadScenario` (four scenarios, `vocabulary.ts:227-232`; [R2:450-455]) and `resetDemo` rebuild the Core state from a freshly built history, so the audit chain restarts [R1:96]. In Live mode that is a **database re-creation by the owner role `dems_owner`, which is not a superuser** [DEC:D16; DEC:DR-03], never an UPDATE, DELETE or TRUNCATE by the runtime role [AN:524; DEC:D11 TD-04]. The order is: build the new database beside the live one, carry the kept rows over, swap the names, drop the old database last; a failure before the swap leaves the live database untouched [DEC:D14]; [DB:§8.5]. `resetDemo` is the scenario `idle`.

| Data | After a reset or a scenario load |
|---|---|
| Audit chain | **New chain**: the seed history as of the server clock, then one `SCENARIO_LOADED` row naming the operator, the scenario, `reset`, and the head hash and row count of the discarded chain. The discarded chain also gets one row in the chain-lineage table (below) |
| Events, sessions, history, evidence, exports, alerts, faults, diagnostics, update, storage policy, the engine's counters (`meta.counters`), hardware snapshot, health snapshots | Rebuilt from the seed (and the scenario's transitions) |
| Operators | Rebuilt from the seed: seed roles, all enabled, fresh password hashes. An operator whose role changes back receives `session.updated`. `lastSignInAt` is set to the issue time of the operator's newest kept session, and stays null when there is none [DEC:D14] |
| Roles, permissions, grants | Rebuilt (identical) |
| **Auth sessions** | **Kept**: nobody is signed out by a reset (the simulator keeps `auth` too, [R1:96]) |
| **Paired devices, device credentials, biometric tokens** | **Kept**: no device has to pair again (the simulator keeps `pairing`) |
| **Settings** | **Kept** (as in the simulator) |
| **Pairing codes; the device counter and the pairing-code counter** | **Kept** [DEC:D14]: a kept device refers to the code it was paired with, and an identifier is never minted twice. A code that is ACTIVE at the reset is written `CANCELLED`, closed at the reset time by the resetting operator (null from the command line). It gets no `PAIRING_CODE_CLOSED` row of its own: the reset rebuilds the trail, and the new chain's `SCENARIO_LOADED` row and the lineage table are the record (GS-25, DECIDED [DEC:D18]) |
| **Chain lineage** (E-26) | **Kept, and extended**: the rows of earlier resets are carried over, and one row is added for the chain this reset discards [DEC:D16] |
| Tablet link | Recomputed from the open sockets |
| Epoch | **Continues**: the previous epoch plus 1 [DEC:D14], so no client can be shown the epoch it already holds; the revision restarts at 0; every OPERATOR socket receives a new `snapshot` |

| ID | Rule |
|---|---|
| DC-4 | During the routine the server answers 503 `NOT_READY` to every other request, and the pipeline is drained first |
| DC-5 | The routine runs as `dems_owner`, never as the bootstrap superuser. The server reads the owner-role file and opens the owner connection only when a reset starts and only when the demo flag is on, keeps the connection for the routine's duration, and holds no reference to the password afterwards. With the flag off it never opens that file. Before the routine touches anything it checks that the role of its connection is not a superuser, and stops otherwise (`RESET_ROLE_PRIVILEGED`, [DB:§8.5] step R-0). The application's pool always uses the runtime role `dems_app` (SR-58, SR-68) |
| DC-6 | How the kept rows cross the re-creation is the database contract's routine [DB:§8.5] (SA-08). Whatever it does, the runtime role never gains UPDATE, DELETE or TRUNCATE on the audit table, and never gains more than SELECT on the chain-lineage table (CF-2, DECIDED [DEC:D18]) |
| DC-7 | The discarded chain leaves a durable trace in two records: the details of the new chain's `SCENARIO_LOADED` row (the head hash and the row count of the discarded chain), and one row of the chain-lineage table (E-26). The first is lost at the next reset together with its chain; the second survives every reset, so after any number of resets each earlier chain and the operator who discarded it are still known [DEC:D16]; [SDR:SD-19]. The routine also writes one server log line, which is process output and not a record |
| DC-8 | Reset is the one deliberate exception to "append-only" (G-10, [AN:781]). Row 20 accepted it with the owner role of DC-5 and the lineage of DC-7 [SDR:§5.6]; [DEC:D16] (residual R-08) |
| DC-9 | The same routine, run from the command line by the owner role `dems_owner`, resets a lane database before a live check [AN:660]. Its lineage row has no actor |
| DC-10 | The lineage is read through `verifyAuditChain` (section 7.13). No operation changes it |

---

## 13. Audit: types and writers

### 13.1 New audit types (9; additive values in the shared vocabulary)

Categories are the existing eight (`vocabulary.ts:279-288`), so no category-keyed map in a client needs a new entry [AN:646]. Each new type also needs its entry in `AUDIT_TYPE_CATEGORY` and its i18n label [R1:88].

| Type | Category | Written by | Actor | Details (never a secret) |
|---|---|---|---|---|
| `ACCESS_DENIED` | SECURITY | The permission guard (RB-4, RB-6) | The refused operator, or null with the device ID | `operationId`, `permission`, `role`, `reason?` |
| `PAIRING_CODE_ISSUED` | PAIRING | `issuePairingCode` | Operator | `codeId`, `expiresAt` |
| `PAIRING_CODE_CLOSED` | PAIRING | Cancel, expiry, exhaustion | Operator or system | `codeId`, `reason` |
| `DEVICE_REVOKED` | PAIRING | `revokeDevice` | Operator | device ID, `reason`, `sessionsEnded` |
| `DEVICE_CREDENTIAL_ROTATED` | PAIRING | `rotateDeviceCredential` | none (device ID) | — |
| `ROLE_CHANGED` | SECURITY | `assignUserRole` | Operator | `targetOperatorId`, `from`, `to`, `reason?` |
| `USER_ENABLED` | SECURITY | `enableUser` | Operator | `targetOperatorId`, `reason?` |
| `USER_DISABLED` | SECURITY | `disableUser` | Operator | `targetOperatorId`, `sessionsEnded`, `reason?` |
| `BIOMETRIC_ENROLLMENT_CHANGED` | AUTH | `setBiometricEnrollment` | Operator | device ID, `enabled` |

"Device paired" uses the existing `PAIRING_SUCCESS`; the decision record lists it as a new type [AN:646]. Three types go beyond that record's list (`PAIRING_CODE_CLOSED`, `DEVICE_CREDENTIAL_ROTATED`, `BIOMETRIC_ENROLLMENT_CHANGED`). Both points are in section 19.2. The total becomes 53 audit types (44 today, [R1:555]). **No new event type is needed**: device revocation emits the existing `UNPAIRED` event; the other new rows are audit-only.

### 13.2 Actions that must write a row

| Action | Row | Writer |
|---|---|---|
| Sign-in attempt | `AUTH_SUCCESS`, `AUTH_FAILED` or `AUTH_LOCKED`: one per attempt | Identity module |
| Sign-out; expiry | `AUTH_SIGNED_OUT`; `AUTH_EXPIRED` | Identity module |
| Biometric enrolment change | `BIOMETRIC_ENROLLMENT_CHANGED` | Identity module |
| Refusal for a missing permission | `ACCESS_DENIED` (`EXPORT_DENIED` for the three exports): one row per call the guard refuses, inside the denial budget (ID-P13) | Guard |
| Pairing: issue, close, redeem (success, failure, locked), revoke, unpair, credential rotation | Section 6.2, 6.3 | Pairing module |
| Tablet link change | `TABLET_LINK_CHANGED` | Engine (hosted, internal) |
| Role change; enable; disable | `ROLE_CHANGED`; `USER_ENABLED`; `USER_DISABLED` | Administration module |
| Export of evidence, audit, logs | `EVIDENCE_EXPORTED`; `AUDIT_EXPORTED` | Engine (hosted) |
| Every other hosted action | As the simulator writes it [R1:150-191] | Engine (hosted) |
| Engine activity | The nine engine-only types (`AUTH_EXPIRED` excepted, which the identity module now writes) [R1:553] | Engine |
| Raised alert | `FAULT_RAISED` (I11) | Engine |
| Demo reset, scenario load | `SCENARIO_LOADED` | Reset routine |

Hosted actions that write no row today keep writing none (`NONE-P`, API-8): `beginPrecheck`, `retryPrecheck`, `scanCaseNumber`, `resetClip`, `acknowledgeAlert`, `setActiveCamera`, `setPresentationMode`, `updateSettings` [R1:203]. Adding rows there would make the Live audit sequence differ from the simulator's, which the fixed-seed comparison of row 37 (W04, W26) forbids [BP:310]. Row 20 ruled on it: parity with the simulator's audit sequence is kept [SDR:SD-28]; [DEC:D16] (residual R-15). Two of these commands change a value that every client sees: `acknowledgeAlert`, and `updateSettings` (which `setPresentationMode` shares, operation 68). Each of the two writes **one server log line** with the operator ID and the alert ID, or the names of the settings keys that changed (the names, not the values). It is a log line, not an audit row.

### 13.3 Storage rules

Append-only by database privilege and a trigger; chain serialised by the single pipeline and refused by the database when a row does not continue it (ENG-8 to ENG-11; SR-52, SR-53). The mechanisms and their tests are row 16's [BP:289].

Two rulings of row 20 belong here [DEC:D16]. Both audit triggers are enabled `ALWAYS`, and the boot check expects that state [SDR:SD-06]. And the database checks the link of a new row (its sequence and its previous hash), not the digest itself. That is accepted: a writer that may insert can also compute a valid digest, so a digest check in the database would catch defects only, and those are reported by the stored-chain verification of `verifyAuditChain` and by the boot check (GD-01; residual R-09).

---

## 14. Secrets handling; origins, CORS and content-security policy

### 14.1 Secrets handling

| Secret | Generated by | Kept in | Stored form | Lifetime |
|---|---|---|---|---|
| PostgreSQL bootstrap superuser password (`dems_admin`) | The provisioning script, locally | `.data/pg.pwfile`, mode 0600, git-ignored. Read only by `scripts/pg/`, **at provisioning only** (`initdb`, the creation of the two other roles, trial step T5-j). Removal needs no connection [DEC:D19, D20]. **No file under `apps/core-server/` opens it** | Plain, in that file only | Until the cluster is removed [AN:272] |
| PostgreSQL owner password (`dems_owner`) | The provisioning script: at least 24 bytes from `crypto.randomBytes`, base64url | Its own file, `.data/pg.owner.env`, mode 0600 [DB:§7.6]. Read by the `db:*` commands and the test helper; by the server only when a reset starts with the demo flag on | Plain, in that file only | Same |
| PostgreSQL runtime password (`dems_app`) | The provisioning script, in the same way | `.data/pg.env`, mode 0600, git-ignored | Plain, in that file only | Same |
| Operator passwords | The demo constant, by name `DEMO_OPERATOR_PASSWORD` (Q12) | The operators table | Argon2id hash, salt and parameters (SR-05, SR-06) | Until the next reset re-hashes |
| Session token | The server | Web: the cookie. Mobile: memory | SHA-256 in the database | 15 min idle, 8 h absolute |
| Device credential | The server | The device's secure storage | SHA-256 in the database | Until rotation, revocation or unpair |
| Biometric token | The server | The device's secure storage, behind the OS prompt (section 5.3 for the emulator case) | SHA-256 in the database | 30 days; single use |
| Pairing code | The server | Shown once in the portal | SHA-256 in the database | 300 s; single use |

No signing secret, HMAC key or token-signing key exists in this design [AN:752], so none can leak or needs rotation. The demo evidence signing key is published demo material, not a secret [R2:516]. No pepper: it would be one more secret under the same `.data/` and the same uid, so it adds no separation, and the password is a published constant [SDR:SD-21].

Rules [SDR:SD-15]:

1. `.data/` is git-ignored before it is created, and `git check-ignore` confirms it [AN:271]. The directory has mode 0700; every file in it that holds a secret, and a log file of PostgreSQL or of the server written there, has mode 0600 (AC-B-64).
2. Each of the two connection files (`.data/pg.env` and the owner-role file) holds five discrete fields: host, port, database, user, password. No connection URL that contains a password exists anywhere: not in a file, not in code, not in a script, not in a log line.
3. The server's own loader opens and parses the file. No `--env-file`, no `source` in a script, no exported `PGPASSWORD`: the password is in no process environment that a child inherits and in no shell.
4. No secret is passed as a process argument or written into an npm script: arguments are visible to every local account through the process list. A static check over `scripts/` and the package manifests enforces it (AC-B-86).
5. The two generated role passwords each come from at least 24 bytes of `crypto.randomBytes`, base64url, as the bootstrap password does [AN:295].
6. `pg_hba.conf` has no line with the method `trust`: `initdb -A scram-sha-256` produces that [AN:296]. The provisioning trial checks it, and checks that a connection with a wrong password is refused (row 23 (W03, W07); the trial steps are the plan's).
7. No secret is printed in a log, a progress file or a document (P19, [BP:471-474]); secrets leave no trace in URLs, audit rows, events or realtime messages (section 9.5).

### 14.2 Origins, CORS, content-security policy and response headers

| ID | Rule | Source |
|---|---|---|
| OR-1 | **Two lists** (section 2.4). The *web console origins* are used by web sign-in (ID-1 a) and by every request that carries the cookie. *The instance's own origins* are accepted only on a request that carries **no cookie**: a bearer request or a request without a credential. A request whose `Origin` is in neither list is refused with 403 `ORIGIN_NOT_ALLOWED`; on a socket upgrade the refusal is the HTTP 403 of the handshake. The comparison is an **exact string match on the serialised origin** (scheme, host and port; no case folding, no trailing slash, no wildcard), and the literal `null` is refused | [AN:596]; [R8:388]; [SDR:SD-02, SD-07] |
| OR-2 | A POST or a socket upgrade that carries the cookie must carry a **web console origin**. Browsers always send `Origin` on those requests. One of the instance's own origins does not satisfy this rule | [R10:268]; [SDR:SD-02] |
| OR-3 | A GET with the cookie and no `Origin` (a same-origin browser read) is accepted; GET never changes state (API-2). A GET with the cookie and an `Origin` outside the web console origins is refused | this file |
| OR-4 | A request with a bearer value and no `Origin`, or with one of the instance's own origins, is accepted: a browser never attaches a bearer value on its own, and React Native may add the origin of the URL it opens (SA-03). A bearer request with a **web console origin** is refused: no client of this design produces it (ID-12) | [AN:596]; [SDR:SD-02, SD-09] |
| OR-5 | **No CORS plugin is registered** and no `Access-Control-Allow-*` header is sent. The web reaches the server through the same-origin dev proxy. If the fallback of ADQ-6 (cross-origin calls with CORS and credentials, [AN:598]) is ever triggered, it returns to a security review before it is built | [DEC:D11 ADQ-6]; [SDR:SD-07] |
| OR-6 | The packaged content-security policy is not changed: the packaged build is Simulated-only (MC-3), and the policy is duplicated in the launcher and pinned by a test [R3:63] | [AN:596] |
| OR-7 | `WEB_DEV_ORIGINS` is not edited: it keeps its `localhost` entry for mock-core. The server's two lists live in its own configuration module (D9 DN-5) and hold **no `localhost` entry**. Another project on this host listens on `[::1]:5173` (section 2.1), the dev server binds `127.0.0.1` only (`apps/core-web/vite.config.ts:18`), and `localhost` can resolve to either address; a page of that project could otherwise carry an allowlisted `Origin` | [AN:596]; [SDR:SD-07]; [DEC:D16] |
| OR-8 | The cookie has no `Secure` attribute and no `__Host-` prefix and is visible to every port of 127.0.0.1 in that browser profile (G-08, [AN:600]). Row 20 accepted this: a refused cookie would break the demo, and neither attribute protects anything on a transport without TLS; the token is random, short-lived and revocable (residual R-02). **The acceptance lapses if any listener leaves loopback or TLS is added**: then `Secure` and `__Host-` become mandatory | [R10:254, R10:261]; [SDR:§5.3]; [DEC:D16] |
| OR-9 | **Response headers.** Every answer of the Core server, success or error, carries `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Cross-Origin-Resource-Policy: same-origin` and `Referrer-Policy: no-referrer`; a JSON body is sent as `application/json; charset=utf-8`. They are set by `@fastify/helmet` 13.1.1 and one `onSend` hook for `Cache-Control`; the option names are confirmed by row 25 (W03, W08; SA-13). `Strict-Transport-Security` is not sent: there is no TLS. This policy governs the Core server's own answers only. **The packaged content-security policy of the 0.1.0 packages (`apps/core-web/src/lib/packaged-csp.ts` and the launcher's copy) is not touched** (OR-6) | [SDR:SD-14]; [DEC:D16] |
| OR-10 | Two further checks that the review calls optional are **not** adopted: refusing a cookie request whose `Sec-Fetch-Site` header is present and is not `same-origin`, and refusing a `Host` header that is not the instance's own. Recorded as GS-21 | [SDR:SD-07] |

**Decision table for HTTP requests (stage 3).** "Cookie" means that this instance's session cookie is present, "bearer" that an `Authorization` header is present. Stage 3 looks at presence only; whether the credential is valid is decided at stage 4. Every 403 in the two tables is `ORIGIN_NOT_ALLOWED`.

| Credential present | No `Origin` | One of the instance's own origins | A web console origin | Any other origin, or `null` |
|---|---|---|---|---|
| Cookie | GET: accepted (OR-3). POST: 403 (OR-2) | 403 | Accepted | 403 |
| Bearer | Accepted (OR-4) | Accepted (OR-4) | 403 (OR-4) | 403 |
| None | Accepted as ANONYMOUS. `signIn` answers 403 `DEVICE_NOT_PAIRED` (ID-1); `getSignInStatus` reports the web console's lock state (GS-29) | Accepted as ANONYMOUS and **not** as a web console: `signIn` answers 403 `DEVICE_NOT_PAIRED`; `getSignInStatus` as in the first column | Accepted as ANONYMOUS; a web console for ID-1 (a) | 403 |
| Cookie and bearer | GET: 401 `NOT_SIGNED_IN` with `CREDENTIAL_CONFLICT` (ID-12). POST: 403 | 403 | 401 `NOT_SIGNED_IN` with `CREDENTIAL_CONFLICT` | 403 |

**Decision table for the WebSocket upgrade** (GET `/ws`; a refusal is the HTTP status of the handshake).

| Credential present | No `Origin` | One of the instance's own origins | A web console origin | Any other origin, or `null` |
|---|---|---|---|---|
| Cookie | 403: a browser always sends its `Origin` on an upgrade | 403 | OPERATOR; or ANONYMOUS with `hello.reason: SESSION_INVALID` when the cookie no longer resolves | 403 |
| Bearer | DEVICE or OPERATOR; an unknown or retired value completes the handshake and is then closed with 4401 or 4403 (section 9.2) | The same | 403 | 403 |
| None | ANONYMOUS | ANONYMOUS | ANONYMOUS | 403 |
| Cookie and bearer | 403 | 403 | 401 | 403 |

**What React Native sends, and how the server treats it.** The app sends `Authorization: Bearer` on REST and on the upgrade, and never a cookie. Its `fetch` is expected to send no `Origin`; its socket may add an `Origin` that names the URL it opened, which on every emulator is `http://127.0.0.1:4420` (the comment at `packages/shared/src/api/constants.ts:28` records that it may; neither behaviour was run, SA-03; rows 58 and 59 (W12, W30) record what is sent). Both outcomes are in the tables: with no `Origin` the app is in the first column, with the server's own origin in the second. In both, a bearer value is accepted and a request without a device credential cannot sign in. mock-core keeps its single list (`apps/mock-core/src/heartbeat.ts:20`); it issues no session, so the question does not arise there, and it is not changed.

**Why pairing stays mandatory.** ID-1 (a) is satisfied only by a web console origin. If the server's own origins were in the same list as the web console origins, a request whose `Origin` is the server's own address would count as a web console and could sign in with a password alone: no device credential, and nothing forged [SDR:SD-02]. With two lists that request is an uncredentialed caller that is not a web console, and its `signIn` answers 403 `DEVICE_NOT_PAIRED` (AC-B-73). What remains is a local process that forges a web console origin (GS-03), which is outside the boundary.

### 14.3 Supply-chain records

The PostgreSQL binaries come through an npm package whose one install script is read before it is approved by exact name [DEC:D11 TD-02; DEC:F21]. Three records make that review checkable afterwards [SDR:SD-25]. The work rows are the plan's (row 18); the rules are stated here so that SR-80 has an anchor.

| ID | Rule |
|---|---|
| SU-1 | The provisioning record stores the SHA-256 of what was read and of what was installed: the install script (`scripts/hydrate-symlinks.js` of the binary package), its `native/pg-symlinks.json`, and the three binaries (`initdb`, `pg_ctl`, `postgres`). Verification row 105 (W90) recomputes them and compares |
| SU-2 | The output of `npm audit` is recorded in every row that installs a package: rows 23, 25, 57 and 77 (W03, W07, W08, W13, W14) |
| SU-3 | Any further install script goes through the same step: it is listed (the review names `npm install-scripts ls` for that; row 23 (W03, W07) confirms the command on this host's npm), read, and approved by exact name. A blanket approval is never given |

---

## 15. Security requirements

"Verified by" names the acceptance criterion of section 16 (or the row) that tests the requirement. Client-side storage requirements are restated as AC-C in row 17.

### 15.1 Network exposure

| ID | Requirement | Source | Verified by |
|---|---|---|---|
| SR-01 | Every listener binds `127.0.0.1` explicitly: the Core server (4420, lanes 4421-4423) and PostgreSQL (4432). The host is a constant and cannot be configured | [AN:583, AN:829]; U4 | AC-B-03 |
| SR-02 | PostgreSQL listens on TCP 127.0.0.1 only, with the Unix socket disabled and `scram-sha-256` password authentication; no line of `pg_hba.conf` uses the method `trust`; the server connects as `dems_app` | [AN:269-275]; [SDR:SD-15] | AC-B-03; the provisioning trial (row 23 (W03, W07)) |
| SR-03 | The server opens no outbound connection: no telemetry, no update check, no remote logging | SC10 [RT:307]; [BP:475] | AC-B-66 |
| SR-04 | No CORS plugin; no `Access-Control-Allow-*` header is ever sent | [AN:596] | AC-B-43 |

### 15.2 Security requirements: identity and sessions

| ID | Requirement | Source | Verified by |
|---|---|---|---|
| SR-05 | Passwords are hashed with Argon2id through Node's `crypto.argon2` (asynchronous form): memory 19,456 KiB, 2 passes, parallelism 1, tag 32 bytes, and a salt of 16 bytes from `crypto.randomBytes(16)`, new for every password. No pepper (section 14.1) | [DEC:D11 TD-05]; [R10:582, R10:589]; [SDR:SD-21] | AC-B-30 |
| SR-06 | Stored per operator: algorithm, the three parameters, salt and hash. Never the password. Verification recomputes with the stored parameters and compares with `crypto.timingSafeEqual`; a row with older parameters is re-hashed at the next successful sign-in | [AN:380-382] | AC-B-28, AC-B-30 |
| SR-07 | A password is accepted only in the body of `signIn`, is at most 128 characters long, is never echoed and never written anywhere | this file | AC-B-29 |
| SR-08 | Unknown username, wrong password and disabled operator give the same status, code and message, in comparable time: the Argon2id computation runs once in all three cases, before any branch (ID-2) | [R10:420]; `packages/shared/src/sim/auth.ts:10-12`; [SDR:SD-21] | AC-B-24 |
| SR-09 | Session token: 256 bits from `crypto.randomBytes` (the floor is 64 bits), prefix `ses_`; the database stores only its SHA-256 | [AN:393]; [R10:205] | AC-B-23, AC-B-28 |
| SR-10 | Rotation on sign-in: every successful sign-in issues a new token, and a valid session presented with the request is ended | this file | AC-B-23 |
| SR-11 | Idle expiry after 15 minutes and absolute expiry after 8 hours, both decided by the server clock, on every request and by a sweeper at most 5 s apart | [DEC:D11 TD-06]; [R10:219] | AC-B-26 |
| SR-12 | Revocation is immediate: sign-out, user disable, device revoke and device unpair end the session row in the same transaction; the next request is refused and the sockets are closed within 1 s | [R8:418]; [R10:219] | AC-B-20, AC-B-27, AC-B-38 |
| SR-13 | No role or permission is stored in a session or a token; both are read from PostgreSQL for each request | [AN:393] | AC-B-18 |
| SR-14 | The session identifier is not renewed on a role change. **Deviation from OWASP** [R10:212], accepted by row 20: no privilege is stored in the session and the role is read per request (G-11; residual R-04) | [AN:398]; [SDR:§6]; [DEC:D16] | AC-B-18 |
| SR-15 | A session token never appears in a URL, a query string, a socket subprotocol or message, a log line, an audit row or an event | [R8:412]; [R10:226] | AC-B-29, AC-B-41 |
| SR-16 | Web: the token lives only in the cookie. Mobile: only in memory. Neither client writes it to web storage or AsyncStorage | [AN:393]; [R10:226] | AC-B-23; AC-C (row 17) |
| SR-17 | Sessions survive a server restart; ended sessions keep their end reason | [AN:391] | AC-B-04 |

### 15.3 Cookie and Origin

| ID | Requirement | Source | Verified by |
|---|---|---|---|
| SR-18 | The cookie is named `dems_session_<listen port>` (ID-P7) and is set with `HttpOnly`, `SameSite=Strict`, `Path=/`, no `Domain`, no `Max-Age` and no `Expires`. It has no `Secure` attribute and no `__Host-` prefix, because the transport is loopback HTTP. **Deviation from guidance** [R10:212], accepted by row 20 (G-08; OR-8); the acceptance lapses if a listener leaves loopback or TLS is added | [AN:393]; [R10:261]; [SDR:§5.3, SD-08, SD-24]; [DEC:D16] | AC-B-23, AC-B-90 |
| SR-19 | Origin guard OR-1 to OR-4, with its two lists and the decision tables of section 14.2, on every request and every socket upgrade | [AN:596]; [R8:388]; [R10:268]; [SDR:SD-02] | AC-B-43, AC-B-73 |
| SR-20 | No GET operation changes state | API-2 | AC-B-09 |
| SR-21 | A cookie session is issued only to a request with a web console origin (ID-1 a), which also blocks a sign-in forced from a foreign page | [R10:268] | AC-B-43, AC-B-73 |

### 15.4 Sign-in and pairing: lockout and rate limits

| ID | Requirement | Source | Verified by |
|---|---|---|---|
| SR-22 | Sign-in lockout: 5 failures within 300 s lock the console for 60 s. The key is the console (`web` or the device ID), never the IP address | [AN:393-394]; `packages/shared/src/sim/constants.ts:51-53` | AC-B-25 |
| SR-23 | Every sign-in attempt that reaches the handler writes exactly one audit row. An attempt that the throttle or the denial budget answers with 429 does not reach it (SR-71) | `auth.ts:8-9`; [SDR:SD-03] | AC-B-24, AC-B-75 |
| SR-24 | Request throttle with the keys and limits of ID-P12: 30 per 60 s for the class buckets and for a device's sign-in entry points, 600 per 60 s otherwise; socket upgrades are counted; answer 429 with `retry-after`. A throttled request is logged, not audited | `@fastify/rate-limit` 11.2.0 [AN:393]; SA-11; [SDR:SD-12] | AC-B-14, AC-B-84 |
| SR-25 | The lockout counters are in memory (`rate-limiter-flexible` 11.2.1) and reset at a restart. Accepted by row 20: a lock lasts 60 s, and clearing it needs a restart, which needs local access; the PostgreSQL store is not required (G-26; residual R-10) | [AN:797]; [SDR:§6]; [DEC:D16] | AC-B-25 |
| SR-26 | Pairing code: 6 decimal digits from a CSPRNG, valid 300 s, single use, one active code at a time | [AN:456]; [R10:383] | AC-B-33, AC-B-34, AC-B-35 |
| SR-27 | Pairing attempt limits: 3 failed redeems within 300 s lock redeeming for 60 s; 5 failed redeems close the active code. Both limits hold under concurrent attempts (SR-72) | [R10:376]; `constants.ts:59-60` | AC-B-36, AC-B-76 |
| SR-28 | The code is stored only as a hash, is returned once by `issuePairingCode`, can never be read again, and never appears in a URL, a log line, an audit row, an event or a realtime message. The QR payload is not a URL | [AN:467, AN:828] | AC-B-33, AC-B-41 |
| SR-29 | The redeem answer does not say whether a code was wrong, expired, used or closed | this file | AC-B-34, AC-B-35 |
| SR-30 | Issuing a code needs `PAIRING_MANAGE`; every issue, close, redeem, failure and locked attempt writes an audit row. One exception: a code cancelled by a demo reset has no row of its own (section 12.4) | section 6.2; [DEC:D14] | AC-B-33 to AC-B-36 |

### 15.5 Device credential and biometric token

| ID | Requirement | Source | Verified by |
|---|---|---|---|
| SR-31 | Device credential: 256 bits from `crypto.randomBytes`, prefix `dvc_`; the database stores only its SHA-256; it is returned once, at redeem (and at a rotation) | [AN:452] | AC-B-34, AC-B-28 |
| SR-32 | On the device it is kept only in `expo-secure-store` (Keystore-backed), never in AsyncStorage or a log | [DEC:D11 TD-10]; [R11:151-164] | AC-C (row 17) |
| SR-33 | Rotation is two-phase: the new hash is promoted at its first use, after which the old credential is refused | section 6.3 T7 | AC-B-38 |
| SR-34 | Revocation and unpair refuse the credential at once and end the device's sessions and biometric tokens in the same transaction | section 4.7 | AC-B-38 |
| SR-35 | A mobile session is bound to a device and is valid only while that device is PAIRED | [AN:393] | AC-B-37, AC-B-38 |
| SR-36 | Biometric token: 256 bits, prefix `bio_`, stored as SHA-256, bound to one device and one operator, issued only inside a password session on that device, single use with rotation, lifetime 30 days. A reuse revokes the family and ends its sessions (SR-74) | [AN:452]; [R10:341] | AC-B-31, AC-B-78, AC-B-82 |
| SR-37 | No operation creates a session from a client's statement that a biometric check passed. `reportBiometricFailure` can only add a failure, and its row names an operator only when a biometric token of that device and that operator exists; otherwise the actor is null and the row carries the device ID | Q11 [DEC:D4]; [SDR:SD-11] | AC-B-31, AC-B-83 |

### 15.6 WebSocket

| ID | Requirement | Source | Verified by |
|---|---|---|---|
| SR-38 | Authentication only from the upgrade request: the cookie (web) or `Authorization: Bearer` (mobile). Never a query string, a subprotocol or a message | [DEC:D11 TD-08]; [R8:400, R8:406, R8:412] | AC-B-42 |
| SR-39 | The Origin is checked on every handshake; a foreign Origin gets HTTP 403 | [R8:388] | AC-B-43 |
| SR-40 | An unauthenticated connection receives `hello` and `heartbeat` only; its heartbeat carries no session state | section 9.2 | AC-B-42 |
| SR-41 | The server maps sessions and devices to connections, closes them within 1 s when access ends, and re-validates each connection's session with the sweeper | [R8:418] | AC-B-20, AC-B-38 |
| SR-42 | Limits: client message at most 65,536 bytes; at most 30 client messages in 10 s; at most 16 connections, of which at most 6 anonymous; compression off; ping every 30 s | section 9.1; [SDR:SD-13] | AC-B-48, AC-B-85 |

### 15.7 RBAC

| ID | Requirement | Source | Verified by |
|---|---|---|---|
| SR-43 | Deny by default: a route without an access rule and an audit rule cannot boot | [AN:408]; [R10:475] | AC-B-12 |
| SR-44 | The access rule is evaluated on every request, before the body is read | section 2.3 | AC-B-15 |
| SR-45 | Exactly one denial audit row per call that the guard refuses for an operator; none for an allowed call. A call answered 429 by the denial budget is not refused by the guard and writes none (SR-71) | RB-4; [SDR:SD-03] | AC-B-16, AC-B-75 |
| SR-46 | A client-side permission table is a display hint; the server decides in every case | [AN:156] | AC-B-15, AC-B-22 |
| SR-47 | The last enabled holder of `USER_ADMIN` cannot be demoted or disabled; the check and the update are one unit of work (SR-72) | RB-8 | AC-B-21, AC-B-79 |

### 15.8 Log redaction

| ID | Requirement | Source | Verified by |
|---|---|---|---|
| SR-48 | The logger redacts the headers `authorization`, `cookie` and `set-cookie`. Request and response bodies are not logged; those of operations 2, 7, 8, 15, 18 and 23 are never logged under any log level. **A parse or validation failure is logged by its code only** (`INVALID_JSON`, `INVALID_INPUT`), never with the parser's message or any part of the input: a parser's message can quote the body (SA-12) | [AN:215]; [R8:424]; [SDR:SD-05] | AC-B-29 |
| SR-49 | **The request log never holds the raw URL.** A request log line holds the method, the registry's route pattern (for an unmatched path: the path without its query string), the status, the duration, the request ID and a principal reference that is safe to log (an operator ID, a device ID or a session row ID, [DB:§5.4] NL-7). By design no secret travels in a URL: a registry test asserts that no path or query parameter of any operation is a secret, and the server reads no credential from a query string, on any operation or on the upgrade. By mistake one can: a client may append one, and Fastify's default logger would write it [DEC:F9]. With this rule the log is safe whatever a caller puts into a query string | [AN:215]; [SDR:SD-05]; [DEC:D16] | AC-B-29, AC-B-42 |
| SR-50 | An error answer never contains a stack trace, an SQL fragment or an internal message; an unexpected failure is the generic `INTERNAL_ERROR` | `packages/shared/src/api/core-api.ts:90` | AC-B-14 |
| SR-51 | Socket message contents are not logged | [R8:424] | AC-B-29 |

### 15.9 Audit

| ID | Requirement | Source | Verified by |
|---|---|---|---|
| SR-52 | The audit table is append-only **by database privilege**: the runtime role has no UPDATE, DELETE or TRUNCATE on it; a trigger refuses them as well, for every role, and is enabled `ALWAYS` | [AN:273, AN:568]; [SDR:SD-06] | AC-B-54 |
| SR-53 | The hash chain is serialised: one writer (the pipeline), and the database refuses a row that does not continue the chain. Hash and canonical form are the shared ones | [AN:568]; [R1:87] | AC-B-54 |
| SR-54 | Audit details are flat values and never hold a password, a token, a code, a credential, or the username typed at a failed sign-in | `types.ts:68-69`; `auth.ts:10-12` | AC-B-24, AC-B-41 |
| SR-55 | The actions of section 13.2 always write their row | section 13.2 | AC-B-16, AC-B-40 |
| SR-56 | The chain restarts only through the demo reset, and the new chain records the head and the row count of the discarded one. The lineage of all discarded chains is kept durably (SR-78) | DC-7 | AC-B-57, AC-B-87 |

### 15.10 Demo controls, secrets and data, input handling

| ID | Requirement | Source | Verified by |
|---|---|---|---|
| SR-57 | Demo operations need `DEMO_CONTROL` and the server-side demo flag; the flag is read at boot, is off by default and cannot be changed through the API | Q14 [DEC:D4] | AC-B-56 |
| SR-58 | The reset runs under the owner role `dems_owner`, which is not a superuser, in a connection opened only for the reset and only with the demo flag on; the runtime role cannot perform it; the routine refuses to run as a superuser | [AN:524, AN:781]; [SDR:SD-01]; [DEC:D16] | AC-B-57, AC-B-72 |
| SR-59 | The `AUDIT_TAMPER` and evidence `TAMPER` demo faults never alter a stored audit row, a sealed hash, a manifest hash or a signature | section 12.3 | AC-B-57, AC-B-69 |
| SR-60 | Secrets are generated locally (at least 24 bytes from `crypto.randomBytes` for each database password), kept under the git-ignored `.data/`, checked with `git check-ignore` before creation and never printed. `.data/` has mode 0700; every file in it that holds a secret, and a log file written there, has mode 0600 | [AN:272, AN:834]; [BP:471-474]; [SDR:SD-15] | AC-B-64 |
| SR-61 | No signing secret and no pepper exist (section 14.1) | [AN:752]; [SDR:SD-21] | review (row 20) |
| SR-62 | Synthetic data only: the seed uses the shared dataset and no real name or e-mail (U7) | [RT:168, RT:229] | AC-B-65 |
| SR-63 | **The demo password is published** (shown on both login screens, present in `README.md` and a release script, [DEC:F7]) and is accepted by the Live server (Q12). Row 20 accepted this inside the boundary, with four conditions: (C1) the disclosure on both login screens and the Live section of `README.md` say in plain words that these are published demo credentials for synthetic accounts on a local demo; (C2) no server data, such as a role, is shown before sign-in; (C3) the disclosure is hidden in presentation mode; (C4) **Live mode with the published password is permitted only while every listener is on loopback. A change under U4 MUST first replace the seeded password and remove the disclosure.** In Live mode the sign-in therefore demonstrates the mechanism; it does not protect the data (residual R-01) | [AN:783]; [SDR:§5.4, SD-17]; [DEC:D16] | AC-B-03, AC-B-92; [CL:AC-C-104] |
| SR-64 | Every body, query and path parameter is validated by the registry's zod schema; unknown keys are dropped; bodies are at most 65,536 bytes; every string refuses U+0000 and ill-formed UTF-16 (API-13) | [AN:436]; [DEC:D14] | AC-B-10, AC-B-14, AC-B-93 |
| SR-65 | No client-supplied time, actor, role or revision is trusted: the actor comes from the session, the time from the server clock. The one request field that names an operator, `operatorId` of operation 9, is used only under the rule of SR-37 | Q15; [SDR:SD-11] | AC-B-55, AC-B-83 |
| SR-66 | The server resolves no file path from a client and accepts no upload | MS-3 | AC-B-09 |
| SR-67 | All SQL is parameterised through the data-access layer | [DEC:D11 TD-03] | row 113 (W91) |

### 15.11 Explicitly out of scope

Taken from the decision record's boundary [AN:836-847]; restated so that the review has a clear edge.

**The boundary is a single-user Mac** [SDR:SD-26]. Every listener is on loopback, and loopback is reachable by every account on the machine and by every app inside an emulator that is connected through `adb reverse`. Other accounts on the Mac and other apps inside the emulators therefore reach the listeners without the user's uid. They are held only by the application's sign-in, and in Live mode that sign-in uses a published password (SR-63). The emulators are part of the boundary.

| Item | Consequence that is accepted |
|---|---|
| Real PKI, mutual TLS, certificate-bound pairing | The device credential is a bearer secret with no proof of possession |
| TLS on loopback | Cookies carry no `Secure` attribute; traffic between browser, proxy, server and emulators is cleartext on the loopback interface |
| An external identity provider, single sign-on, WebAuthn | The "security key (simulated)" button exists only in Simulated mode |
| A hostile local user or process on the same Mac | It can read `.data/`, the browser profile and process memory, and can forge an `Origin` header (GS-03) |
| Other accounts on the same Mac; other apps inside an emulator | They reach the loopback listeners; only the application's sign-in holds them, and its password is published (residual R-01) |
| Encryption at rest of the database | Synthetic data only |
| Production hardening: several processes, a shared rate-limit store, high availability | One process; in-memory lockout counters |
| Real evidence signing | The demo key is published; signatures prove nothing [R2:516] |
| A Live release APK, a physical tablet, another PC | U4 |
| Password change and reset | Not offered (GS-01); accepted with condition C4 of SR-63 |

### 15.12 Requirements added in revision 2

Added from the security design review [DEC:D16]. New IDs continue the list; no ID was renumbered or reused. Revision 2 also changed in place the text of SR-02, SR-05, SR-08, SR-14, SR-18, SR-19, SR-21, SR-23, SR-24, SR-25, SR-27, SR-30, SR-36, SR-37, SR-42, SR-45, SR-47, SR-48, SR-49, SR-52, SR-56, SR-58, SR-60, SR-61, SR-63, SR-64 and SR-65.

| ID | Requirement | Source | Verified by |
|---|---|---|---|
| SR-68 | **Database roles.** The running server holds the runtime role `dems_app` always, and the owner role `dems_owner` only while a demo reset runs with the demo flag on. It never holds the bootstrap superuser `dems_admin`: no file under `apps/core-server/` opens that role's password file, and with the demo flag off the server does not open the owner-role file either. `dems_owner` is not a superuser | [SDR:SD-01]; [DEC:D16, DR-03]; [DB:§7.1] | AC-B-72 |
| SR-69 | **Two Origin lists.** The web console origins serve web sign-in and cookie requests; the instance's own origins are accepted only on a request without a cookie and never satisfy the console rule ID-1 (a). A sign-in from one of the instance's own origins without a device credential answers 403 `DEVICE_NOT_PAIRED` | [SDR:SD-02]; [DEC:D16] | AC-B-73 |
| SR-70 | The web console origins are `http://127.0.0.1` on ports 5173, 5176, 5177 and 5178 and nothing else: no `localhost` entry. Origins are compared by exact string match; `null` is refused | [SDR:SD-07]; [DEC:D16] | AC-B-74; [CL:AC-C-102] |
| SR-71 | **Denial budget.** Per throttle key at most 20 audited refusals within 60 s (ID-P13); after that the key's REST requests answer 429 without a further audit row, until the window has room again. Every refusal inside the budget is audited. A retired device credential is counted in the pre-authentication class bucket | [SDR:SD-03]; [DEC:D16] | AC-B-75 |
| SR-72 | **Atomic server-native state changes.** Every such change is one unit of work in the serial pipeline; an attempt is consumed before it is verified; transitions that can race are compare-and-set statements; only the Argon2id computation runs outside the pipeline (ENG-23 to ENG-27). The limits of SR-22, SR-27, SR-36 and SR-47 therefore hold under concurrent requests | [SDR:SD-04]; [DEC:D16] | AC-B-76 to AC-B-80 |
| SR-73 | **One credential per request; a session is bound to its transport** (ID-12, ID-13). A request with the cookie and an `Authorization` header is refused; a bearer request with a web console origin is refused; the cookie resolves only a session without a device, a bearer only a session with one | [SDR:SD-09] | AC-B-81 |
| SR-74 | A reused biometric token ends the open BIOMETRIC sessions of that device and operator (reason `TOKEN_REUSE`) and closes their sockets within 1 s, besides revoking the family | [SDR:SD-10]; [DEC:D16] | AC-B-82 |
| SR-75 | The throttle key is the resolved principal or one of two fixed classes, never a value supplied by the caller; a value that does not resolve is counted in the class bucket | [SDR:SD-12] | AC-B-84 |
| SR-76 | **Response headers.** Every answer carries the header set of OR-9, through `@fastify/helmet` 13.1.1 and one `onSend` hook. The packaged content-security policy of the 0.1.0 packages is not changed | [SDR:SD-14]; [DEC:D16] | AC-B-14, AC-B-60; [CL:AC-C-35] |
| SR-77 | **Secret files and process arguments.** The connection files hold discrete fields and no connection URL; the server's loader reads them itself (no `--env-file`, no `source`, no exported `PGPASSWORD`); no secret is in a process argument or an npm script (section 14.1, rules 2 to 4) | [SDR:SD-15] | AC-B-86 |
| SR-78 | **Durable chain lineage.** Every discarded audit chain leaves one row (epoch, row count, head hash, reset time, actor, scenario, reason) in a table that survives every reset; the runtime role has SELECT only (CF-2, DECIDED [DEC:D18]) and the reset routine appends the rows as `dems_owner`; `verifyAuditChain` returns it | [SDR:SD-19]; [DEC:D16] | AC-B-87 |
| SR-79 | The engine's actor scope is cleared in a `finally` block, so a hosted action that throws leaves no identity behind (ENG-2) | [SDR:SD-22] | AC-B-53 |
| SR-80 | **Supply-chain records** SU-1 to SU-3: the hashes of the reviewed install script, of its symlink list and of the three PostgreSQL binaries; the `npm audit` output of every install row; no blanket approval of install scripts | [SDR:SD-25]; [DEC:F21] | AC-B-91 |
| SR-81 | The stored-chain verification of `verifyAuditChain` is incremental: a call reads only the rows above the last verified position (section 7.13) | [SDR:SD-27] | AC-B-88 |
| SR-82 | `acknowledgeAlert` and `updateSettings` write no audit row (parity with the simulator) and one server log line each, with the operator ID and the alert ID or the names of the changed keys | [SDR:SD-28]; [DEC:D16] | AC-B-89 |

---

## 16. Acceptance criteria

Each criterion is testable by a command or an observable and names its success criterion (SC, [RT:298-308]). Test-file names follow the blueprint's provisional rows 51-55 (W47 to W49, W52, W53) [BP:324-328]; `npm run test:db -w @dems/core-server` is the database-backed command of [DEC:D11 TD-12]. Rows 18 and 21 map each criterion to a work row.

### 16.1 Start, schema, seed, restart

| ID | Criterion | Tested by | SC |
|---|---|---|---|
| AC-B-01 | On an empty database the migration command creates the schema; a second run changes nothing | The migration command twice; second output shows no pending migration; catalog query | SC2 |
| AC-B-02 | The seed loads the dataset: 3 operators, 3 roles, 12 permissions, 18 grants, 1 Core device, 13 evidence items with 52 tracks, 13 history entries; audit and event row counts equal those of the shared `createIdleState` for the same `now` (82 and 59 by static count, SA-09) | Count queries after the seed, compared in a test with the shared function | SC2 |
| AC-B-03 | The server starts from the documented command; `lsof -nP -iTCP:4420 -sTCP:LISTEN` shows one listener on `127.0.0.1`; the same for 4432; no other address | The two `lsof` commands | SC2, SC10 |
| AC-B-04 | State survives a restart: after a policy change, a sealed session, a role change and a paired device, every stored entity of section 3.3 is equal before and after | `test/acceptance/restart.test.ts`; checksums per table | SC2 |
| AC-B-05 | A session in RECORDING at stop is in FAULT after the restart with a `FAULT_RAISED` row; `recoverSession` leads to an INCOMPLETE history entry and a RECORDED evidence item, with `SYSTEM_BOOT`, `RECOVERY_STARTED`, `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED` rows | `restart.test.ts` | SC2 |
| AC-B-06 | The same for a session in FINALIZING at stop | `restart.test.ts` | SC2 |
| AC-B-07 | A 60 s recording stores zero meter-frame rows, and the audit table grows only by the rows the engine wrote | Count query before and after | SC2 |
| AC-B-08 | `GET /api/v1/health` validates against `HealthResponseSchema` with `service: dems-core-server`, `version: 0.2.0`, `ready` both true; with PostgreSQL stopped it answers 200 with `ready.database: false` and the process stays up | `curl` and a test | SC2, SC6 |

### 16.2 Contract

| ID | Criterion | Tested by | SC |
|---|---|---|---|
| AC-B-09 | The registry holds exactly 75 operations; every registered route is in the registry and every registry operation is registered; 27 are GET and 48 are POST; no GET handler writes | `test/acceptance/contract.test.ts` | SC6 |
| AC-B-10 | Every response produced in the tests validates against its documented schema with `validateCoreApiResponse` | `contract.test.ts` | SC6 |
| AC-B-11 | The OpenAPI document is regenerated; the generator's `--check` exits 0; the drift test passes; the document lists 75 operations and two security schemes | `node --import tsx scripts/gen-openapi.ts --check` in `packages/shared`; the shared test run | SC6 |
| AC-B-12 | A route registered without an access rule or an audit rule makes the application fail to boot | A boot test | SC4 |
| AC-B-13 | The ten existing operations keep path, method, request schema and response schema | A test comparing the registry entries with the baseline shapes | SC6 |
| AC-B-14 | Each of 401, 403, 404, 405 (with `allow`), 409, 413, 422, 423, 429 (with `retry-after`) is produced by at least one test and validates against `ApiError`; no answer contains a stack trace. Every answer the test produces, success or error, carries the five headers of OR-9 with their values; a JSON body is `application/json; charset=utf-8`; no answer carries `Strict-Transport-Security` | `contract.test.ts` | SC6, SC10 |

### 16.3 RBAC

| ID | Criterion | Tested by | SC |
|---|---|---|---|
| AC-B-15 | Role-by-endpoint matrix: all 75 operations for five callers (the three roles, an unauthenticated caller, an unpaired device); every cell equals sections 4.4 and 7. The credential-misuse callers of AC-B-81 are further cells of the same file | `test/acceptance/rbac-matrix.test.ts`, generated from the registry | SC4 |
| AC-B-16 | Every denied cell of an operator wrote exactly one row (`ACCESS_DENIED`, or `EXPORT_DENIED` for operations 42, 61, 62) naming actor, operation and permission; an allowed call wrote none. The test keeps every caller inside the denial budget (ID-P13): the matrix gives the INVESTIGATOR 22 denied cells and the TECHNICIAN 31, so the test advances the clock by 60 s or resets the budget after at most 20 denied cells of one key, and no cell is answered 429 (GS-20) | `rbac-matrix.test.ts` | SC4 |
| AC-B-17 | The seeded matrix equals the shared `ROLE_PERMISSIONS` table | A test | SC4 |
| AC-B-18 | A role change applies to the next request with no new sign-in: the same session gets 403 before and 2xx after (and the reverse) | An integration test | SC4 |
| AC-B-19 | A role change pushes `session.updated` to every socket of that operator within 1 s and a `delta` of `operators` to every operator socket | A socket test | SC4 |
| AC-B-20 | Disabling a user ends the sessions, closes the sockets with 4401 within 1 s, makes the next request answer 401 and the next sign-in the generic 401, and writes `USER_DISABLED` | An integration test | SC4 |
| AC-B-21 | Demoting or disabling the last enabled SUPERVISOR answers 409 `LAST_ADMIN` and changes nothing | An integration test | SC4 |
| AC-B-22 | Two clients: an operator signed in on the web console and on an emulator loses (and regains) an action on both within 1 s of a role change made in the portal, without signing in again; a now-denied call is refused by the server with its audit row | Observable: before and after captures on both clients, the 403 and the audit row (verification row 107 (W96)) | SC4 |

### 16.4 Identity

| ID | Criterion | Tested by | SC |
|---|---|---|---|
| AC-B-23 | Web sign-in sets `dems_session_<listen port>` with exactly `HttpOnly; SameSite=Strict; Path=/`: no `Secure`, no `Domain`, no `Max-Age`, no `Expires`, and no token in the body; a device sign-in returns the token in the body and sets no cookie; a second sign-in ends the presented session | An integration test reading `Set-Cookie` | SC3, SC10 |
| AC-B-24 | Wrong password, unknown user and disabled user give byte-identical bodies (apart from `attemptsRemaining`); each writes one `AUTH_FAILED` row; the typed unknown username is in no row; the Argon2id function is invoked exactly once per attempt in all three cases (a spy) | An integration test | SC4, SC10 |
| AC-B-25 | The fifth failure within 5 minutes locks: 423 with `lockedUntil`; attempts write `AUTH_LOCKED`; after 60 s (manual clock) a correct sign-in succeeds | An integration test | SC4 |
| AC-B-26 | With a manual clock: 15 minutes without activity end the session (401, `AUTH_EXPIRED`, socket closed 4401); 8 hours end it regardless of activity; a GET does not extend it | An integration test | SC4 |
| AC-B-27 | Sign-out makes the token unusable, clears the cookie and writes `AUTH_SIGNED_OUT` | An integration test | SC4 |
| AC-B-28 | A full dump of the database contains no password, no session token, no device credential, no biometric token and no pairing code that the test issued or used | The test greps the dump for the values it holds | SC10 |
| AC-B-29 | A log capture contains none of those values, no cookie value and no marker value: (a) during the sign-in, biometric and pairing flows; (b) after a socket upgrade and a GET that carry `?token=<marker>`; (c) after malformed JSON that contains a marker, sent to operations 2 and 18; (d) over the log of the whole acceptance run. No request log line holds a query string | A log-capture test; a scan of the acceptance run's log | SC10 |
| AC-B-30 | The stored hash record states argon2id, 19,456 KiB, 2 passes, parallelism 1, a 16-byte salt and a 32-byte hash; a known-vector test passes | A unit test and a query | SC10 |
| AC-B-31 | A valid biometric token signs in (`method: BIOMETRIC`) and is replaced; presenting the old token again answers 401, revokes the family and writes `AUTH_FAILED` (the sessions it ends: AC-B-82); no request without a valid token creates a session | An integration test | SC5 |

### 16.5 Pairing

| ID | Criterion | Tested by | SC |
|---|---|---|---|
| AC-B-32 | A device without a credential: `signIn` answers 403 `DEVICE_NOT_PAIRED`, with no `Origin` and with one of the instance's own origins alike; only `getServiceHealth`, `redeemPairingCode` and `getSignInStatus` (the web console's lock state, GS-29) succeed; its socket receives `hello` and `heartbeat` only | `test/acceptance/pairing-lifecycle.test.ts` | SC5 |
| AC-B-33 | `issuePairingCode` returns six digits and `expiresAt = issuedAt + 300 s`, writes `PAIRING_CODE_ISSUED` without the code, and the table holds only a hash | `pairing-lifecycle.test.ts` | SC5 |
| AC-B-34 | Redeeming the code returns a device ID and a credential; the device is listed as PAIRED; `PAIRING_SUCCESS` is written; a second redeem of the same code answers 401 `INVALID_CODE` | `pairing-lifecycle.test.ts` | SC5 |
| AC-B-35 | After 300 s (manual clock) the code answers 401 `INVALID_CODE` and a `PAIRING_CODE_CLOSED` row with `reason: EXPIRED` exists | `pairing-lifecycle.test.ts` | SC5 |
| AC-B-36 | Three wrong codes lock redeeming for 60 s (423, `PAIRING_LOCKED`); the fifth wrong code closes the active code (`reason: EXHAUSTED`) | `pairing-lifecycle.test.ts` | SC5 |
| AC-B-37 | A sign-in on a paired device creates a session bound to it: the `AUTH_SUCCESS` row and `listPairedDevices` name the device and the operator | `pairing-lifecycle.test.ts` | SC5 |
| AC-B-38 | `revokeDevice`: the device's sessions end, its socket closes with 4403 within 1 s, its next REST call answers 403 `DEVICE_REVOKED`, `DEVICE_REVOKED` is written; a new redeem creates a new device ID | `pairing-lifecycle.test.ts` | SC5 |
| AC-B-39 | Revoking a device during its recording leaves the session in RECORDING; another operator with `SESSION_START` stops it | An integration test | SC5, SC3 |
| AC-B-40 | Two clients: a freshly installed app in Live mode cannot leave the pairing screen; it pairs with a code issued in the portal; it appears in Paired Devices; revoking it there returns the app to the pairing screen; each step has its audit row | Observable: captures and the audit rows (verification row 108 (W94)) | SC5 |
| AC-B-41 | No audit row, event, realtime message or log line of the whole lifecycle contains a code or a credential | The tests scan what they captured | SC5, SC10 |

### 16.6 Shared state and realtime

| ID | Criterion | Tested by | SC |
|---|---|---|---|
| AC-B-42 | A socket without a credential receives `hello` and `heartbeat` only, with `sessionState: null`; a `?token=` query on the upgrade authenticates nothing. The test puts a marker value there, never an issued token, and the marker is absent from the server log (SR-49) | A socket test | SC3, SC10 |
| AC-B-43 | An upgrade or a POST with a foreign `Origin` answers 403; a POST with the cookie and no `Origin` answers 403; a POST with the cookie and one of the instance's own origins answers 403; no answer carries an `Access-Control-Allow-*` header | An integration test | SC10 |
| AC-B-44 | Client A starts a session; client B receives the deltas; after start, marker and stop, B's state equals A's | `test/acceptance/shared-state.test.ts` | SC3 |
| AC-B-45 | After a dropped socket, B reconnects and its state equals a fresh client's snapshot | `shared-state.test.ts` | SC3 |
| AC-B-46 | Every message validates against the contract's union; revisions are gap-free within an epoch | `shared-state.test.ts` | SC3, SC6 |
| AC-B-47 | For a command answered with revision N, a store that has applied revision N shows the command's effect | `shared-state.test.ts` | SC3 |
| AC-B-48 | A subscribed client receives meter frames at the wire rate; for a client that stops reading, meter frames are skipped and state deltas are either all delivered or the connection is closed with 4408; a 30 s ping keeps a healthy link open | A socket test | SC3 |
| AC-B-49 | A second `createSession` while one is active answers 409 `SESSION_ACTIVE`; two simultaneous creates give one 201 and one 409 (or 200 with `created: false` for equal input) | An integration test | SC3 |
| AC-B-50 | An operator who did not start the session stops it with a reason of at least 5 characters; `RECORDING_STOPPED` names that operator; a shorter reason answers 422 `INVALID_REASON` | An integration test | SC3 |
| AC-B-51 | Two clients: a session started on the web console appears on the emulator within 2 s, and a stop on the emulator appears on the web console (and the reverse) | Observable: captures and the matching rows (verification row 106 (W95)) | SC3 |

### 16.7 Engine and audit

| ID | Criterion | Tested by | SC |
|---|---|---|---|
| AC-B-52 | With a fixed seed and a manual clock, the audit-type sequence of the recording scenario equals the shared simulator's | An engine test | SC2 |
| AC-B-53 | After every command the engine's `auth` slice is signed out, also after a command that the hosted action refuses by throwing; rows written by the engine itself have no operator | An engine test | SC4 |
| AC-B-54 | 50 concurrent audit appends produce a chain that verifies; UPDATE, DELETE and TRUNCATE on the audit table by the runtime role are rejected; a row that does not continue the chain is rejected | `npm run test:db -w @dems/core-server` | SC4, SC10 |
| AC-B-55 | Every `at` value follows the injected clock; no request field can set a time or an actor | An engine test | SC3 |
| AC-B-56 | With the demo flag off, the five demo operations answer 403 `DEMO_DISABLED` for a SUPERVISOR and 403 `NOT_PERMITTED` (with an audit row) for the other roles | An integration test | SC4 |
| AC-B-57 | With the flag on: a fault is raised and cleared with its rows and alert; an `AUDIT_TAMPER` fault breaks `view` and leaves `stored` intact; `resetDemo` returns the domain tables to the seed checksums; keeps sessions, devices, device credentials, biometric tokens, settings, pairing codes, the device and pairing-code counters and the chain lineage; writes a code that was ACTIVE as `CANCELLED`; raises the epoch by exactly 1; and sends a snapshot to every operator socket | An integration test | SC2 |

### 16.8 Regression

| ID | Criterion | Tested by | SC |
|---|---|---|---|
| AC-B-58 | `npm run typecheck`, `npm run lint` and `npm test` at the workspace root exit 0 with no PostgreSQL running (the two baseline failures of [DEC:F20] excepted until their fix slot lands, [DEC:D10]) | The three commands, with `pg_ctl status` showing no server | SC7 |
| AC-B-59 | The 61 simulator-dependent test files (28 web, 33 mobile, [AN:611, AN:614]) pass, and their diff against `acaff20` holds only recorded changes | The per-workspace test runs with `-- --maxWorkers=2`; `git diff --stat acaff20` over those files | SC8 |
| AC-B-60 | `release/` is byte-identical: its checksum files verify for all files | `shasum -a 256 -c` over the checksum files under `release/` | SC8 |
| AC-B-61 | mock-core is untouched: `git diff --stat acaff20 -- apps/mock-core scripts/release` prints nothing; its 19 tests pass | The `git` command and the mock-core test run | SC8 |
| AC-B-62 | `git diff acaff20 -- packages/shared/src/sim` shows additions only, and only in `vocabulary.ts` and `auth.ts` | The `git` command | SC8 |
| AC-B-63 | A client in Simulated mode sends nothing to the Core server: with the server running, a Simulated session leaves no request line in its log | Observable: the server log; spies in the shared tests [BP:333] | SC8 |

### 16.9 Secrets, data, domain rules, documentation

| ID | Criterion | Tested by | SC |
|---|---|---|---|
| AC-B-64 | `git check-ignore -v` matches `.data/postgres`, `.data/pg.pwfile`, `.data/pg.env` and `.data/pg.owner.env`; `git status --porcelain` lists nothing under `.data/`; `stat` shows mode 0700 on `.data/` and 0600 on each of the three secret files and on every log file under `.data/` | The two `git` commands and `stat -f '%Lp'` | SC10 |
| AC-B-65 | A dump of the seeded database holds no person name and no e-mail beyond the synthetic operators and subjects of the shared dataset | A grep over the dump against the dataset's name list | SC10 |
| AC-B-66 | The server process has no socket other than loopback ones | `lsof -nP -a -p <pid> -i` | SC10 |
| AC-B-67 | The Live-mode commands of `README.md` (start PostgreSQL, migrate, seed, start the server) run as written and exit 0 | Verification row 105 (W90) follows the README literally | SC11 |
| AC-B-68 | Every operation has a success test; every operation with a permission has a denial test; every operation with a body has a validation test | The test report's operation-to-test table | SC7 |
| AC-B-69 | After verify, export, archive and an evidence tamper fault, the tracks, track hashes, manifest hash and signature of the item are unchanged | An integration test | SC3 |
| AC-B-70 | Every answer that lists audio has exactly two entries, AUDIO-01 and AUDIO-02 | `contract.test.ts` | SC6 |
| AC-B-71 | Every raised alert has a `FAULT_RAISED` audit row | An integration test | SC4 |

SC1 and SC9 are process criteria owned by row 22 and rows 116-117 (W101, W102); no backend criterion applies to them.

### 16.10 Criteria added in revision 2

Added from the security design review [DEC:D16] and from the rulings of D14. New IDs continue the list. Revision 2 also changed in place the text of AC-B-14, AC-B-15, AC-B-16, AC-B-23, AC-B-24, AC-B-29, AC-B-31, AC-B-32, AC-B-42, AC-B-43, AC-B-53, AC-B-57 and AC-B-64.

| ID | Criterion | Tested by | SC |
|---|---|---|---|
| AC-B-72 | The server's pool reports `current_user` = `dems_app`. With the demo flag on, the reset connection reports `current_user` = `dems_owner` and `rolsuper` false. The role check of the reset routine, given a role that is a superuser, stops with `RESET_ROLE_PRIVILEGED` and changes nothing; it is tested with a stub of the role query, because no test of the server connects as the superuser (SR-68). The one check that needs a real superuser, the trigger check of SD-06, is provisioning trial step T5-j [DB:§7.1]; [DEC:D19]. With the demo flag off the server starts and runs while `.data/pg.owner.env` is unreadable. No file under `apps/core-server/` contains the name of the superuser's password file | An integration test (`npm run test:db -w @dems/core-server`); a static test | SC2, SC10 |
| AC-B-73 | Every cell of the two decision tables of section 14.2 gives the stated answer. Among them: `signIn` with one of the instance's own origins and no bearer answers 403 `DEVICE_NOT_PAIRED`; a POST with the cookie and the own origin answers 403; an upgrade with a bearer and the own origin is accepted | A table-driven integration test | SC5, SC10 |
| AC-B-74 | `http://localhost:5173`, `null`, `http://127.0.0.1:5173/` (trailing slash), `HTTP://127.0.0.1:5173` and `http://127.0.0.1:5174` as `Origin` each answer 403 `ORIGIN_NOT_ALLOWED` on a POST and on the upgrade | An integration test | SC10 |
| AC-B-75 | 100 denied calls of one operator within 10 s write exactly 20 `ACCESS_DENIED` rows; the other 80 answer 429 and write none; after the 60 s window a denied call is audited again. 25 calls that present five different retired device credentials write at most 20 rows in all: they share the class bucket | An integration test with the manual clock (or a reset of the counter, SA-14) | SC4, SC10 |
| AC-B-76 | Concurrent wrong redeems never get more guesses than PR-P4 and PR-P5 allow. Of 20 concurrent wrong redeems exactly three are counted as failed attempts and the other 17 answer 423 (the 60 s lock); after the lock a second burst of 20 counts exactly two more, and the code is closed as `EXHAUSTED` with a failed-attempt count of exactly five. The accepted pairing parameters stand (CF-1, DECIDED [DEC:D18]): the review's wording of this test, five consumed in one burst [SDR:SD-04], is not used, because the lock after three failures makes it impossible | A concurrency test (`test:db`), manual clock | SC5 |
| AC-B-77 | Two concurrent redeems of the right code give one 201 and one 401 `INVALID_CODE`; exactly one device row and one `PAIRING_SUCCESS` row exist | A concurrency test (`test:db`) | SC5 |
| AC-B-78 | Two concurrent uses of one valid biometric token issue exactly one session (one `AUTH_SUCCESS` row); the other use answers 401 and is handled as a reuse (section 5.6 step 6) | A concurrency test (`test:db`) | SC5 |
| AC-B-79 | With two enabled holders of `USER_ADMIN`, two concurrent demotions, one of each holder, give one 200 and one 409 `LAST_ADMIN`; one enabled holder remains | A concurrency test (`test:db`) | SC4 |
| AC-B-80 | 20 concurrent wrong-password sign-ins on one console key verify exactly five attempts (five `AUTH_FAILED` rows, the fifth marked as locking) and answer 423 with `AUTH_LOCKED` to the other 15. The review names four concurrency tests and counts five [SDR:§7 item 4; DEC:D16]; this one, the test of ENG-24 for sign-in, is the fifth (GS-24, DECIDED [DEC:D18]) | A concurrency test (`test:db`) | SC4 |
| AC-B-81 | Credential misuse: a request with the cookie and an `Authorization` header answers 401 with `details.reason: CREDENTIAL_CONFLICT`; a bearer request with a web console origin answers 403; a device session's token sent as the cookie, and a web session's token sent as a bearer, both answer 401 on an operation that is not public. None of them resolves a principal or changes state | Cells of `rbac-matrix.test.ts` | SC10 |
| AC-B-82 | After a biometric sign-in, presenting the used token again ends that BIOMETRIC session: `session.ended` with `TOKEN_REUSE`, the socket closed with 4401 within 1 s, the session token answering 401, the session row's end reason `TOKEN_REUSE`. A password session of the same operator on the same device stays open | An integration test with a socket | SC5 |
| AC-B-83 | `reportBiometricFailure` that names an operator with no biometric token on that device writes `AUTH_FAILED` with a null actor and the device ID; naming an enrolled operator writes it with that operator | An integration test | SC4 |
| AC-B-84 | 31 requests within 60 s that carry 31 different unknown bearer values share one bucket: the 31st answers 429. Socket upgrades are counted: after 30 anonymous upgrades within 60 s the next one is refused with 429 at the handshake | An integration test | SC10 |
| AC-B-85 | With six anonymous sockets open, a seventh anonymous upgrade is closed with 1013, while an operator's and a device's upgrade are still accepted; the 17th connection of any kind is closed with 1013 | A socket test | SC3 |
| AC-B-86 | A static check finds, in `scripts/`, the package manifests and `apps/core-server/`: no secret passed as a process argument, no `--env-file`, no `source` of a file under `.data/`, no exported `PGPASSWORD`, no connection URL that contains a password. The two connection files hold the five field names and nothing else (the check prints names, never values) | A static test; a key-name check of the two files | SC10 |
| AC-B-87 | After two resets the chain-lineage table holds two rows with epoch, row count, head hash, reset time, actor and reason; the first row is byte-equal before and after the second reset; `verifyAuditChain` returns both in `lineage`, newest first; UPDATE and DELETE on the table are rejected for every role, and INSERT by the runtime role is rejected (CF-2, DECIDED [DEC:D18]) | An integration test (`test:db`) | SC2, SC4 |
| AC-B-88 | After one full verification, a `verifyAuditChain` call that follows k appended rows reads exactly k audit rows (a query spy); two concurrent calls run one verification | An integration test | SC4 |
| AC-B-89 | `acknowledgeAlert` and `updateSettings` each write no audit row and exactly one log line, which holds the operator ID and the alert ID, or the names of the changed keys and none of their values | A log-capture test | SC4 |
| AC-B-90 | Two instances on two ports, used with one cookie jar: a sign-in on the second leaves the first instance's cookie and session valid, and each instance ignores the other's cookie | An integration test with two application instances | SC3, SC10 |
| AC-B-91 | The provisioning record holds the five SHA-256 values of SU-1 and the `npm audit` outputs of SU-2; recomputing the five hashes gives the recorded values | The records of rows 23, 25, 57 and 77 (W03, W07, W08, W13, W14); `shasum -a 256` in verification row 105 (W90) | SC10 |
| AC-B-92 | The Live section of `README.md` says in plain words that the seeded accounts use published demo credentials for synthetic accounts on a local demo, and that Live mode is for loopback only (C1 and C4 of SR-63). It prints no credential value that is not already published there | Row 101 (W86) writes it; verification row 105 (W90) reads it | SC10, SC11 |
| AC-B-93 | A body whose free-text field contains U+0000 or an unpaired surrogate answers 422 `INVALID_INPUT` on `addSessionNote`, `revokeDevice` and `redeemPairingCode`, and writes no row | `contract.test.ts` | SC2, SC6 |

---

## 17. Traceability

### 17.1 Success criteria

| SC | Text (short) | Sections | Acceptance criteria |
|---|---|---|---|
| SC1 | Spec and plan dated before the first implementation log | this file exists; row 22 | — |
| SC2 | Start command, migrations, seed, state survives a restart | 2, 3, 8.5, 8.6, 12.4 | AC-B-01 to 08, 52, 57, 72, 87, 93 |
| SC3 | Both clients take data from the backend; an action on one is visible on the other | 3, 7, 9 | AC-B-39, 44 to 51, 55, 69, 85, 90 |
| SC4 | Role-by-endpoint test; denial refused and audited; a role change follows on both clients | 4, 5, 13 | AC-B-12, 15 to 22, 24 to 27, 53, 54, 56, 71, 75, 79, 80, 83, 87 to 89 |
| SC5 | Pairing gate, listing, revocation, audit of each step | 6, 14.2 | AC-B-31 to 41, 73, 76 to 78, 82 |
| SC6 | OpenAPI describes every endpoint; drift test passes | 7 | AC-B-08 to 11, 13, 14, 46, 70, 93 |
| SC7 | Existing suites and the new backend tests pass | 16 | AC-B-58, 68 |
| SC8 | Simulated mode and the 0.1.0 packages still work | 10 | AC-B-59 to 63 |
| SC9 | Decisions, drift and findings recorded | 19 | — (controller) |
| SC10 | No secret committed, no real personal data, nothing sent out | 14, 15 | AC-B-03, 14, 23, 24, 28 to 30, 41 to 43, 54, 64 to 66, 72 to 75, 81, 84, 86, 90 to 92 |
| SC11 | README gives the exact Live-mode commands | row 18, row 101 (W86) | AC-B-67, 92 |

### 17.2 Constraints

| ID | Constraint | Where met |
|---|---|---|
| C1 | RBAC integrated across portal and mobile | Section 4; one matrix, one guard, the same push to both clients (4.7) |
| C2 | A pairing system links portal and mobile | Section 6 |
| C3 | The database is PostgreSQL | Sections 2.1, 3 |
| C4 | The backend covers all features and endpoints | Section 7: 13 areas, 75 operations, 42 actions mapped |
| C5 | Plan and spec first | This file, before any implementation row |
| C6 | Fully autonomous | No approval gate is added; the departures are for the controller, not the user |
| C7 | Findings, drift, decisions recorded | Section 19 |
| I1 | Ready-made frameworks | Only the elements approved in [DEC:D12] are hand-built; this file adds none |
| I2 | Confidential design book | No passage is copied; the research files are cited |
| I3 | Limits of the autonomy | No outward-facing action is specified |
| I4 | No Docker | None used |
| I5 | No deletion or renaming | Additive only (sections 8.1, 10.2) |
| I6 | Synthetic data only | SR-62 |
| I7 | English documents and UI text | This file |
| I8 | UI quality bar | Meters stay 20 Hz, streamed, with a skip policy (9.1, 9.3) |
| I9 | Secrets stay local | Section 14.1; SR-15, SR-28, SR-48, SR-49, SR-60, SR-68, SR-77 |
| I10 | The API baseline stays | API-1; AC-B-13 |
| I11 | Domain rules: export needs RBAC and audit; sealed evidence is never silently changed; two microphone tracks; every alert audited | 7.9; AC-B-16, 69, 70, 71 |
| I12 | Host rules | Section 2.1 (ports); P-rules of the blueprint unchanged |
| I13 | Evidence for every claim | Every AC is a command or an observable |

### 17.3 Defaults Q1-Q16

No default is departed from. DR-02 (QR scanning deferred) was recorded before this row [DEC:DR-02]. DR-03 (three database roles instead of two) was recorded with the security design review [DEC:DR-03]; it changes a technical decision of D11, not a default.

| Q | Default adopted [DEC:D4] | Where | Departure |
|---|---|---|---|
| Q1 | Simulated mode stays beside Live | 10.1 | none |
| Q2 | New backend app; mock-core unchanged | 2.1 | none |
| Q3 | PostgreSQL provisioning per D5 | 2.1 (TD-02) | none |
| Q4 | Store records and periodic health snapshots; stream meter frames | 3 | none |
| Q5 | Pairing mandatory for mobile in Live mode | ID-1; 6.6; 6.9; 14.2 | none |
| Q6 | Mobile through `adb reverse` on loopback | 2.1; 10.3 | none |
| Q7 | 0.1.0 stays the offline edition; live package costed | 10.2; 10.4 | none |
| Q8 | Portal-issued one-time code, also a QR; code entry | 6 | DR-02 already recorded (the device enters the code) |
| Q9 | Read-only matrix; user list with role assignment and enable/disable | 4; 7.6 | none |
| Q10 | Three roles; new permissions | 4.3; 4.4 | none |
| Q11 | Biometric unlocks a credential on a paired device; security key only in Simulated mode | 5.5; 5.6 | none |
| Q12 | Seeded operators keep the demo password, stored as a hash | ID-11; SR-63 | none; accepted by row 20 with conditions C1 to C4 |
| Q13 | The portal does not pair | 6.9 | none |
| Q14 | Demo controls behind a permission and a demo flag | 12 | none |
| Q15 | The server clock is authoritative | 8.4 | none |
| Q16 | One active session; any operator with the session permission may stop it | 7.8 | none |

### 17.4 Impact questions answered here (1-3, 8-21)

| IQ | Question (short) | Answer in |
|--:|---|---|
| 1 | Live and Simulated coexistence | 10.1 "Mode contract" |
| 2 | 0.1.0 untouched; versioning | 10.2 "Released artefacts and versioning" |
| 3 | How a release APK reaches a backend | 10.3 "Client reachability and its limits": it does not, without U4 |
| 8 | Where demo media live; who serves them | 11 "Media and evidence package files" |
| 9 | Reset to the seed state | 12.4 "Scenario load and reset to the seed state" |
| 10 | A session recording when the backend stops | 8.6 "Engine: restart and recovery" |
| 11 | Hashing, session model, expiry, revocation, credential storage | 5; 15.2 "Security requirements: identity and sessions" |
| 12 | Lockout and rate limiting | 5.1; 6.1; 15.4 "Sign-in and pairing: lockout and rate limits" |
| 13 | Socket authentication; what an unpaired or signed-out client receives | 9.2 "Realtime protocol: authentication and visibility" |
| 14 | Audit: append-only, chain, which actions write a row | 13 "Audit: types and writers"; 8.3 |
| 15 | Secrets | 14.1 "Secrets handling" |
| 16 | CORS and the packaged CSP | 14.2 "Origins, CORS and content-security policy" |
| 17 | Biometric and security-key sign-in | 5.5 "Sign-in methods in Live mode"; 5.6 |
| 18 | Permission list and role matrix | 4 "RBAC model: permissions and role matrix" |
| 19 | How clients learn of a permission or pairing change | 4.7 "Realtime protocol: session and device events" |
| 20 | Pairing lifecycle, device identity, re-pairing | 6 "Pairing lifecycle and device registry" |
| 21 | Endpoint list, realtime schema, resync | 7 "API contract: operation tables"; 9.4 "Realtime protocol: messages and resync" |

Impact question 5 is touched in 10.4. Questions 4, 6, 7, 22-25 belong to rows 16-18 [AN:736-762].

### 17.5 Feature areas and edge cases

| Area [RT:114-126] | Operation table | Operations |
|---|---|--:|
| 1 Identity and sign-in | 7.5 | 8 |
| 2 RBAC | 7.6 | 5 |
| 3 Pairing and device registry | 7.7 | 9 |
| 4 Sessions and recording lifecycle | 7.8 | 15 |
| 5 Evidence | 7.9 | 5 |
| 6 Devices and inputs | 7.10 | 9 |
| 7 Storage | 7.11 | 3 |
| 8 Network and time | 7.12 | 2 |
| 9 Security and audit | 7.13 | 6 |
| 10 System and maintenance | 7.14 | 5 |
| 11 Realtime status | 7.15 and section 9 | 2 plus the channel |
| 12 Service health and the API reference | 7.4 | 1 |
| 13 Demo controls | 7.16 | 5 |
| Total | | 75 |

| Edge case [BP:167-180] | Handled in |
|---|---|
| E1 backend stops while recording | 8.6 |
| E2 role changed or user disabled while signed in on both clients | 4.7 |
| E3 device revoked while signed in and recording | 6.6 |
| E4 last holder of user administration | RB-8 |
| E5 two clients start a session together | 7.8; ENG-6 |
| E6 code redeemed twice, after expiry, during a lock | 6.4 |
| E7 app reinstalled on a paired device | 6.7 |
| E8 packaged web build | MC-3 |
| E9 Live mode, backend unreachable | MC-1 |
| E10 stored keys when the mode changes | MC-5 (row 17) |
| E11 another PostgreSQL on the chosen port | rows 23, 24 (W03, W06, W07; not this file) |
| E12 concurrent audit appends | ENG-1, ENG-8 |
| E13 seed date differs from the demo packages | 8.5 |
| E14 demo controls need a permission in Live mode | 12.1 |

### 17.6 Items that remain the user's call

No U1-U9 item [RT:223-231] is required by this specification: no Docker (U1); no login or background service and no shell-profile edit (U2); PostgreSQL provisioning is D5's decision, not this file's (U3); every listener is on loopback and no release APK is changed (U4); no hosted service (U5); no remote, push or publishing (U6); no real personal data (U7); nothing deleted or renamed (U8); no emulator wipe and no other project's process stopped (U9). Revision 2 changes none of this: no correction of the security design review needs a U1-U9 item [SDR:§10].

### 17.7 Security design review: where each finding is folded in

Owner as the review names it: S = this file, D = database contract, C = client specification, P = plan. A finding owned elsewhere is listed with the part this file carries.

| Finding | Severity | Owner | In this file | Requirement | Criterion |
|---|---|---|---|---|---|
| SD-01 the server connects as the superuser for a reset | Medium | D, S, P | 2.1 (C-4 to C-6), 2.4, 8.6, 12.4 (DC-5), 14.1 | SR-58, SR-68 | AC-B-72 |
| SD-02 one Origin list for two kinds of origin | Medium | S | 1.8 (SA-03), 2.3, 2.4, 5.2 (ID-1), 6.9, 9.2, 14.2 | SR-19, SR-21, SR-69 | AC-B-32, 43, 73 |
| SD-03 nothing limits denial rows | Medium | S | 2.3, 4.6 (RB-4, RB-6), 5.1 (ID-P13), 6.2, 13.2 | SR-23, SR-45, SR-71 | AC-B-16, 75 |
| SD-04 check-then-write under concurrency | Medium | S, D | 2.3 (stage 8), 4.6 (RB-8), 5.2 (ID-5), 5.6, 6.1, 6.4, 8.2 (ENG-23 to ENG-27) | SR-27, SR-47, SR-72 | AC-B-76 to 80 |
| SD-05 the request log holds the URL | Medium | S | 15.8 | SR-48, SR-49 | AC-B-29, 42 |
| SD-06 trigger enablement | Low | D | 8.3 (ENG-11), 13.3 (reference) | SR-52 | AC-B-54 |
| SD-07 `localhost` in the allowlist; `null`; the comparison rule | Low | S, C | 2.4, 14.2 (OR-1, OR-5, OR-7, OR-10) | SR-70 | AC-B-74; [CL:AC-C-102] |
| SD-08 one cookie name for every instance | Low | S, C, P | 2.4, 5.1 (ID-P7), 5.3, 7.1 (API-12) | SR-18 | AC-B-23, 90 |
| SD-09 a request with two credentials; transport of a session | Low | S, D | 2.3 (stage 4), 4.1, 5.2 (ID-12, ID-13), 7.2, 7.3, 14.2 | SR-73 | AC-B-15, 81 |
| SD-10 a reused token leaves its sessions open | Low | S, D, C | 4.7, 5.4, 5.6 (step 6), 9.4 | SR-36, SR-74 | AC-B-31, 82 |
| SD-11 the failure report names any operator | Low | S | 5.6 (step 7), 7.5 | SR-37, SR-65 | AC-B-83 |
| SD-12 the throttle key before authentication | Low | S | 2.3 (stages 4, 5), 5.1 (ID-P12), 7.3, 9.1 (RT-P14) | SR-24, SR-75 | AC-B-84 |
| SD-13 anonymous sockets fill the cap | Low | S | 9.1 (RT-P6), 9.2 | SR-42 | AC-B-85 |
| SD-14 no response-header rule | Low | S, P | 2.2, 14.2 (OR-9) | SR-76 | AC-B-14 |
| SD-15 secrets: modes, file content, arguments | Low | S, D, P | 2.4, 14.1 | SR-02, SR-60, SR-77 | AC-B-64, 86 |
| SD-16 Try-it with operations that carry a secret | Low | C | 7.7 (reference) | — | [CL:AC-C-103] |
| SD-17 the demo password in Live mode | Low | S, C, P | 15.10 (SR-63), 15.11 | SR-63 | AC-B-03, 92; [CL:AC-C-104] |
| SD-18 DEPARTURE-6 | Low | C | 5.3, 5.6 (reference) | — | [CL:AC-C-105] |
| SD-19 the lineage of discarded chains | Low | D, S | 3.3 (E-26), 7.13, 7.18, 8.6, 12.4 (DC-7, DC-10) | SR-56, SR-78 | AC-B-57, 87 |
| SD-20 client memory after sign-out | Low | C | — | — | [CL:AC-C-106] |
| SD-21 password details | Low | S | 5.2 (ID-2), 14.1 | SR-05, SR-08, SR-61 | AC-B-24 |
| SD-22 the actor scope after a throw | Low | S | 8.2 (ENG-2) | SR-79 | AC-B-53 |
| SD-23 client log scans | Low | C | — | — | [CL:AC-C-65, 75, 107] |
| SD-24 the cookie's `Max-Age` | Info | S | 1.7, 1.8 (SA-16), 5.1 (ID-P7) | SR-18 | AC-B-23 |
| SD-25 supply-chain records | Info | P | 14.3 (SU-1 to SU-3) | SR-80 | AC-B-91 |
| SD-26 the boundary sentence | Info | S | 15.11 | — | — |
| SD-27 the cost of the chain check | Info | S | 7.13 | SR-81 | AC-B-88 |
| SD-28 the unaudited commands | Info | S | 13.2 | SR-82 | AC-B-89 |
| SD-29 operation 23 is unused | Info | S | 6.3, 7.7 | — | — |

---

## 18. Gap and risk register of this specification

G-01 to G-29 of the decision record stay open as recorded there [AN:770-800]. This file adds the items below. The last column gives the owner and, where row 20 has ruled, the ruling [SDR:§6]; [DEC:D16].

### 18.1 Gaps and risks

| ID | Type | Item | Effect | Owner and status (revision 2) |
|---|---|---|---|---|
| GS-01 | gap | No operation changes or resets a password | Operators keep the published demo password | Accepted by row 20, tied to condition C4 of SR-63 (R-16) |
| GS-02 | risk | No view permission exists: every signed-in role reads the audit log, the events and all status pages, as in Simulated mode | A TECHNICIAN reads audit rows | Accepted by row 20: parity with Simulated mode; the matrix is read-only (R-12) |
| GS-03 | risk | The pairing requirement is tied to the absence of a web console origin; a local process that forges the header reaches the web sign-in | Not a defence against a hostile local process (out of scope) | Accepted by row 20 (R-01). The unforged case, a request from the server's own origin, is closed by the two lists (SR-69) |
| GS-04 | risk | A mobile session token is a bearer secret; it is bound to the device in the database, not by proof of possession | A copied token works until the session or the device ends | Accepted by row 20 (R-05) |
| GS-05 | risk | Lockout counters are in memory (G-26) | A restart clears a lock | Accepted by row 20 (R-10) |
| GS-06 | gap | A server start writes no audit row unless a session was in flight | The audit log does not show ordinary restarts (the server log does) | Accepted by row 20 |
| GS-07 | gap | Throttled requests (429) and `DEMO_DISABLED` refusals are logged, not audited | A flood is visible only in the log | Accepted by row 20, and relied on by the denial budget (SR-71) |
| GS-08 | risk | The `state` topic is not filtered per permission (RB-10) | Correct only while every role holds `EVIDENCE_VIEW` and no view permission exists | Accepted by row 20 while the matrix is read-only and AC-B-17 holds (R-12); a future task |
| GS-09 | risk | A six-digit code's hash is not resistant to an offline search | The code is protected by lifetime, single use and attempt limits, not by the hash | Accepted by row 20 (section 6.1) |
| GS-10 | risk | Published demo password accepted in Live mode (G-12) | SR-63 | Accepted by row 20 with conditions C1 to C4 (R-01) |
| GS-11 | risk | Slice-level `replace` deltas at 1 Hz for `session`, `health`, `storage` while recording may be large [AN:540] | Network and render cost | Row 110 (W98); an additive field-level operation if needed |
| GS-12 | gap | The buffer thresholds, the throttle numbers, the denial budget and the connection caps are chosen here without a source (SA-06, SA-11) | May need tuning | Accepted as proposals by row 20; rows 32, 33, 38, 110 (W09, W23, W24, W28, W41, W42, W98) |
| GS-13 | risk | The reset rebuilds the audit chain (G-10) and must carry sessions and devices across a database re-creation (SA-08) | The most delicate routine of the server | Accepted by row 20 with the owner role and the lineage folded in (R-08); row 16 and row 48 (W29, W43) |
| GS-14 | gap | No operation moves an item to UNDER_REVIEW; the simulator has none | "Review status" is read-only | Recorded; no SIM change planned |
| GS-15 | risk | Row 27 (W19, W22, W27) must write zod schemas for 28 slices and about 17 new bodies | Size of the contract row | Row 18 (may split the row) |
| GS-16 | gap | The tablet link is one flag although several devices can be paired | The Devices page shows "a tablet is connected", not which | Row 17 |
| GS-17 | gap | The hook stage of the guard and the header forwarding of the proxy are not in the research (SA-01, SA-02, SA-03) | Small rework | Rows 33, 58, 62 (W05, W12, W23, W28, W50, W54) |
| GS-18 | risk | The `AUDIT_TAMPER` overlay (SA-10) and the fault at restart (SA-05) depend on shared behaviour that was read, not run | A SIM-GAP may appear | Row 37 (W04, W26) |
| GS-19 | gap | The contract's two-value `mode` cannot describe 75 live operations [R2:158] | The API Reference page and the drift test change together | Closed in design by the client specification ([CL:AR-1]; [DEC:D15]); rows 27, 98 (W19, W22, W27, W83) implement |
| GS-20 | risk | The denial budget (20 per 60 s per key) is smaller than the number of denied cells of two roles in the matrix test: INVESTIGATOR 22, TECHNICIAN 31 (section 4.4 against the operation tables) | The test reads 429 where it expects 403 unless it advances the clock or resets the counter between batches (AC-B-16); whether the counter follows a test clock is SA-14 | Rows 33, 52 (W23, W28, W52) |
| GS-21 | gap | Hardening that the review calls optional is not adopted: the `Sec-Fetch-Site` check, the `Host` check, a console key injected by the dev proxy, a seed-time override of the demo password | Each is a small addition if the boundary changes; the password override is the first step under U4 (C4) | Recorded; a later task |
| GS-22 | gap | `redeemPairingCode` is `PUBLIC` and is not refused when it carries a web console origin: a script on the console origin could redeem a code and read the device credential | The code still has to be issued by a holder of `PAIRING_MANAGE`; the API Reference page refuses Try-it of this operation ([CL:AR-3a]) | Row 50 (W45; access-control review) |
| GS-23 | gap | The own-origin list of a lane instance holds `http://127.0.0.1:4420` although the instance listens on 4421 to 4423, because every app addresses port 4420 on its device side | Right only if React Native takes its `Origin` from the URL it opens (SA-03) | Rows 18 (lane model), 59 |
| GS-24 | gap | The review names four concurrency tests under SD-04 and counts five in its section 7; D16 repeats five | AC-B-80 (concurrent sign-ins) is the fifth | DECIDED [DEC:D18]: confirmed |
| GS-25 | gap | A code cancelled by a demo reset has no `PAIRING_CODE_CLOSED` row: D14 adopted the contract's default for SPEC-GAP-3, which names the state and no row | SR-30 has one stated exception | DECIDED [DEC:D18]: confirmed (the reset rebuilds the trail, and the lineage table records the reset); row 48 (W29, W43) |
| GS-26 | risk | A request that presents a credential costs one indexed lookup before the throttle (stage 4 before stage 5) | A local flood of made-up bearer values reaches the database before it is throttled; denial of service by a local client is outside the boundary (R-11) | Recorded |
| GS-27 | risk | A key that has used up its denial budget gets 429 on every REST operation except health for up to 60 s, and `class:web` is shared by every signed-out web console | 20 failed or locked web sign-ins within a minute stop web sign-in for the rest of that minute; comparable to the lockout itself (R-10, R-11) | Recorded |
| GS-28 | gap | Points where this file and the database contract meet. The two names this file left to the contract are fixed there: `.data/pg.owner.env` and `audit_chain_history`. The three points that revision 2 left are settled: the runtime role has SELECT only on the lineage table (CF-2; the contract says the same from its revision 2.1); the one check that needs a real superuser is provisioning trial step T5-j, and AC-B-72 uses a stub; `first_seq`, `last_seq` and the agreement check of the newest lineage row are stored or computed by the contract [DB:§4.30] and are not members of `AuditChainLineageEntry` | None open | Settled [DEC:D18, D19] |
| GS-29 | gap | Revision 1 held `getSignInStatus` to the console rule of `signIn`: an allowlisted `Origin` or a device credential. A browser sends no `Origin` on a same-origin GET (**hypothesis** from the Fetch rules, and the premise of OR-3; row 62 (W05, W50, W54) confirms), so the web login page's status read would have been answered 403. Found while the decision table of SD-02 was written; it is not a finding of the review | The rule (ID-1): the operation stays a GET, needs no console identity, and reports only the web console's lock state to a caller without a device credential. A local caller can then read whether web sign-in is locked, which it can already cause (R-10). The alternative, operation 3 as a POST, was rejected: the operation changes no state | DECIDED [DEC:D18] (OP-1); rows 27, 32 (W09, W19, W22 to W24, W27, W41) |

### 18.2 Residual risks accepted by the controller

The 17 residual risks of the security design review, accepted by D16 for a local demo [SDR:§8]. They are restated so that this file shows what is knowingly left open.

| ID | Residual risk | Where in this file |
|---|---|---|
| R-01 | In Live mode any client that reaches the loopback listener can sign in as any seeded operator: the password is published and an `Origin` can be forged | SR-63 (C4); 6.9; 15.11 |
| R-02 | The session cookie has no `Secure` attribute and no `__Host-` prefix and is sent to every port of 127.0.0.1 that the browser profile visits | OR-8; SR-18 |
| R-03 | All traffic between the browser, the dev proxy, the server, PostgreSQL and the emulators is cleartext on loopback | 15.11 |
| R-04 | The session identifier is not renewed on a role change | 4.7; SR-14 |
| R-05 | The mobile session token and the device credential are bearer secrets with no proof of possession; the device credential has no expiry | GS-04; 15.11 |
| R-06 | The device credential is never rotated in this task; the rotation operation exists and is unused | 6.3 |
| R-07 | On emulators the biometric token may be stored without the operating system's authentication requirement | 5.3; 5.6 |
| R-08 | A reset discards the audit chain | 12.4 (DC-7, DC-8) |
| R-09 | The database checks the chain link, not the digest | 13.3 |
| R-10 | Lockout counters are in memory; a restart clears a lock; the web console has one lockout key, so five failures lock every web sign-in for 60 s | ID-P3; SR-25 |
| R-11 | Any local client can lock pairing for 60 s at a time, close the active code with five wrong attempts, or fill the pre-authentication throttle | PR-P4, PR-P5; ID-P12; GS-26, GS-27 |
| R-12 | Every signed-in role reads the audit log, the events and every status page; the `state` topic is not filtered | RB-10; GS-02, GS-08 |
| R-13 | PostgreSQL 18.4 is two minor releases behind 18.6; the binaries come through a single-maintainer npm package without a recorded provenance attestation | 2.1 (P-1); 14.3 |
| R-14 | The dev server that serves the console in Live mode sends no content-security policy | [CL:§4.3] |
| R-15 | The `NONE-P` commands write no audit row | 13.2 |
| R-16 | No password change, no per-account lockout, no multi-factor sign-in | ID-11; GS-01 |
| R-17 | A pairing code is shown on screen for up to 300 s | [CL:§10.3] |

---

## 19. Decisions for the controller to record

### 19.1 New permissions and who holds them

| Permission | Holder | Reason |
|---|---|---|
| `PAIRING_MANAGE` | SUPERVISOR | [DEC:D11]; no reason found to place it elsewhere |
| `USER_ADMIN` | SUPERVISOR | [DEC:D11]; the seed has one SUPERVISOR, protected by the last-administrator rule (RB-8) |
| `DEMO_CONTROL` | SUPERVISOR | [DEC:D11]; a SUPERVISOR also holds `SESSION_START`, so one operator can run and disturb a demo, or the portal can inject a fault while the tablet records as INVESTIGATOR |

Also to record: the matrix has 18 grants (INVESTIGATOR 4, SUPERVISOR 10, TECHNICIAN 4); `SESSION_NOTE` and `EVIDENCE_VIEW` gain enforcement points; one operation (`setStoragePolicy`) keeps an any-of rule of two permissions, as TD-07 provides; 25 operations use `AUTHENTICATED` and 4 use `PUBLIC`, each with its reason in section 7.

### 19.2 New audit types (9) and vocabulary notes

`ACCESS_DENIED`, `PAIRING_CODE_ISSUED`, `PAIRING_CODE_CLOSED`, `DEVICE_REVOKED`, `DEVICE_CREDENTIAL_ROTATED`, `ROLE_CHANGED`, `USER_ENABLED`, `USER_DISABLED`, `BIOMETRIC_ENROLLMENT_CHANGED` (section 13.1).

| Point | To record |
|---|---|
| "Device paired" | Uses the existing `PAIRING_SUCCESS` instead of a new type (ADQ-9 listed a new one) |
| Three types beyond ADQ-9's list | `PAIRING_CODE_CLOSED`, `DEVICE_CREDENTIAL_ROTATED`, `BIOMETRIC_ENROLLMENT_CHANGED` |
| Event types | None added |
| Error codes | 15 added to the documented list (section 7.2) |
| Write paths of row 26 (W16) | `sim/vocabulary.ts` (3 permissions, 9 audit types, the category map), `sim/auth.ts` (3 grants), the i18n labels |

### 19.3 Departures

| ID | Statement | Evidence | Smallest alternative |
|---|---|---|---|
| DEPARTURE-3 | **DECIDED: accepted [DEC:D13].** TD-07 says a refusal writes "one audit row of a new generic denial type" [AN:408]. This file keeps the existing `EXPORT_DENIED` type (and its event, and the code `FORBIDDEN` for `exportEvidence`) for the three export operations, and uses the generic `ACCESS_DENIED` everywhere else (RB-5) | The simulator already audits exactly these three denials as `EXPORT_DENIED` [R1:170-173]; the existing contract lists that type for `exportEvidence` (`packages/shared/src/api/core-api.ts:610-649`); the mobile export wizard sends a forbidden export on purpose so that this row is written [R4:56]; both clients have copy for it | Use `ACCESS_DENIED` for all 75 operations. Then a denied export shows the generic label in both clients, the `EXPORT_DENIED` event is no longer emitted in Live mode, and the contract metadata of `exportEvidence` changes |
| DEPARTURE-4 | **DECIDED: accepted [DEC:D13]** (wording of the TD-07 record only). The record places the guard in a `preHandler` hook [AN:408]. This file places authentication and the access rule in `onRequest`, before the body is read (section 2.3) | The simulator's REST layer checks the permission "before any other check, so a signed-out caller learns nothing" (`packages/shared/src/sim/api.ts:349-362`); a denial row must not depend on request data; validation runs before `preHandler` (SA-01, to be confirmed in row 33 (W23, W28)) | Keep `preHandler`: a caller without the right who sends an invalid body then gets 400 or 422 instead of 401 or 403, and writes no denial row |

No decision departs from a Q1-Q16 default (section 17.3). DEPARTURE-1 and DEPARTURE-2 of the decision record are already ruled [DEC:D11]. DEPARTURE-3 and DEPARTURE-4 are ruled by D13. DEPARTURE-5 and DEPARTURE-6 belong to the client specification and are ruled by D15 and D16. No departure is open.

### 19.4 Choices made here that D11 left open

**DECIDED: all fifteen accepted by the controller [DEC:D13].** Three were amended afterwards and are stated here as amended: item 3 by D14 and D16, item 7 by D16, item 14 by D16 and DR-03.

| # | Choice | Section |
|---|---|---|
| 1 | 75 operations (10 existing, 65 new); GET and POST only; one path parameter | 7 |
| 2 | Media and package files are **not** served by the server; row 41 is SKIPPED; `@fastify/static` is not installed | 11 |
| 3 | A reset and a scenario load keep auth sessions, paired devices, biometric tokens, settings, pairing codes, the device and pairing-code counters and the chain lineage; everything else is rebuilt, including operator roles; a code that is ACTIVE is written `CANCELLED`; the epoch continues [DEC:D14, D16] | 12.4 |
| 4 | The `AUDIT_TAMPER` demo fault alters only the engine-held ring; `verifyAuditChain` reports `view` and `stored` | 12.3 |
| 5 | A session in flight at a restart goes to FAULT through the power-failure fault and is closed as INCOMPLETE by the existing recovery path; no activity is generated for the downtime | 8.6 |
| 6 | Pairing: 6 digits, 300 s, one active code, lock after 3 failures for 60 s, code closed after 5, generic `INVALID_CODE` | 6.1 |
| 7 | Sign-in is accepted only from a web console origin (cookie) or from a paired device (bearer); the instance's own origins are a second list and never count as a web console [DEC:D16]; mobile credentials travel as `Authorization: Bearer` with the prefixes `dvc_` and `ses_` | 5.2, 4.1, 14.2 |
| 8 | Biometric unlock by a server-issued, single-use, rotating token; no session from a client's claim | 5.6 |
| 9 | Idle activity = POST requests and `touchSession`; GET and the socket do not extend a session | 5.1 |
| 10 | Realtime: 5 topics, slice-level `replace` and row `append`, gap-free revisions per epoch, the revision in response headers, close codes 4401, 4403, 4408 | 9 |
| 11 | Hosted actions that write no audit row today keep writing none in Live mode (parity with the simulator's sequence); row 20 confirmed it and added a log line for two of them (SR-82) | 13.2 |
| 12 | Health: `service` widened to two names, optional `ready`; always 200 while the process answers | 7.4 |
| 13 | The envelope gains optional `details` and `requestId`; new schemas use epoch milliseconds, the ten existing operations keep ISO strings | 7.1, 7.2 |
| 14 | Migrations are applied by a command under the owner role `dems_owner`, which is not a superuser [DEC:D16, DR-03]; the running server (runtime role) only checks the schema version. TD-04 says "the server applies them" [AN:367]; TD-02 gave migrations to the owner role [AN:273]. This file follows TD-02 | 8.6 |
| 15 | The demo flag is off by default and read at boot | 12.1 |

### 19.5 Open points for the next rows

Status at revision 2: the points for row 16 were closed by the database contract [DEC:D14]; those for row 17 by section 14 of the client specification [DEC:D15]; those for row 20 were ruled by the security design review [DEC:D16], as each line says. The points for row 18 stay open until the plan is accepted. Lines marked "(revision 2)" are new.

| For | # | Open point |
|---|--:|---|
| Row 16 | 1 | A table for each of E-01 to E-25 (section 3.3); `storage` and `activeCameraId` go to the snapshot row |
| Row 16 | 2 | The reset mechanism that carries E-05 to E-09 and E-20 across the re-creation (DC-6, SA-08) |
| Row 16 | 3 | Which role applies migrations, and the schema-version check at start (19.4 item 14) |
| Row 16 | 4 | The stored form of the hash set (SR-06), of the pairing code (PR-P6), of the two credential hashes (T7) |
| Row 16 | 5 | Cursor paging by sequence for audit rows and events (API-9); the health snapshot interval of 60 s |
| Row 16 | 6 | The seed: `enabled = true` for the three operators, 18 grants, fresh salts, `seededAt` |
| Row 16 | 7 | (revision 2) For the database contract's revision 2: a table for E-26 that every reset keeps; the three roles; `TOKEN_REUSE` in the end-reason set; the compare-and-set statements of ENG-25; the role check of the reset routine |
| Row 17 | 1 | What each client shows for `session.updated`, `session.ended` and `device.revoked` (last column of section 4.7) |
| Row 17 | 2 | How the web fills the `pairing` slice and words the trust line (Q13); how the login screens read presentation mode before sign-in (the server setting arrives only after sign-in) |
| Row 17 | 3 | The mode model of the registry for 75 live operations and the API Reference page (GS-19; proposal in section 7.19) |
| Row 17 | 4 | Rebuilding `SimPermissionError` and `SimTransitionError` from `error.details` (section 7.2); the settle on `x-dems-revision` and its time-out |
| Row 17 | 5 | The `touchSession` throttle (at most one a minute, with a trailing call so that the last activity is reported) |
| Row 17 | 6 | Structural sharing when a snapshot is applied, so unchanged slices keep their references |
| Row 17 | 7 | Evidence verification in Live mode: the server's verdict is the record; no demo control is called to mirror a tamper (MS-5) |
| Row 17 | 8 | Biometric item on an emulator (AS-06); the write after a rotation may prompt again |
| Row 17 | 9 | A new socket after sign-in and after sign-out on the web (section 9.2) |
| Row 18 | 1 | Row 41 SKIPPED; `@fastify/static` removed from the dependency list |
| Row 18 | 2 | Names of the commands and environment variables of section 2.4; the additive shared constants |
| Row 18 | 3 | Row 27 (W19, W22, W27) may need a split (GS-15); row 26 (W16) gains `sim/auth.ts` and the i18n files |
| Row 18 | 4 | Early proofs: SA-01 (row 33 (W23, W28)), SA-02 (row 62 (W05, W50, W54)), SA-03 (rows 58, 59 (W12, W30)), SA-04, SA-05 and SA-10 (row 37 (W04, W26)) |
| Row 18 | 5 | The acceptance tests named in section 16; `test:db` for the database-backed ones |
| Row 18 | 6 | (revision 2) `@fastify/helmet` 13.1.1 in the dependency list of row 25 (W03, W08); the trial steps of SD-01 and SD-15 in row 23 (W03, W07); the supply-chain records SU-1 to SU-3; the README sentences of AC-B-92 in row 101 (W86); a cookie name and an own-origin list per lane instance; the matrix test and the denial budget (GS-20) |
| Row 20 | 1 | Deviations to rule on: G-08 (cookie on loopback), G-11 (no identifier renewal on role change), G-12 and SR-63 (published demo password in Live mode), G-10 and DC-8 (reset rebuilds the chain). **Ruled: all accepted**; G-12 with conditions C1 to C4, G-10 with the owner role and the lineage |
| Row 20 | 2 | GS-01 to GS-09: no password change, no view permission, the forged-Origin limit, bearer session on mobile, in-memory lockout, unaudited server start, unaudited 429, unfiltered state topic, six-digit code hash. **Ruled: all accepted** (section 18.1) |
| Row 20 | 3 | Whether any `NONE-P` action should gain an audit row (settings, alert acknowledgement, active camera, clip reset, case-number scan, pre-check start). **Ruled: none**; two write a log line (SR-82) |
| Row 20 | 4 | The parameters chosen without a source: throttle 30 and 600 per minute, 16 connections, 30-day biometric token, 5 s sweep. **Ruled: accepted**, refined by the denial budget (ID-P13) and the anonymous cap (RT-P6) |
| Row 20 | 5 | `@fastify/helmet` 13.1.1 for response headers. **Ruled: adopted** (OR-9, SR-76) |

### 19.6 Revision 2: rulings folded in, and choices made while folding

**Rulings stated as decided in this file.**

| Decision | Ruling | Where |
|---|---|---|
| D13 | DEPARTURE-3 and DEPARTURE-4 accepted; the fifteen open choices accepted; row 41 skipped | 19.3; 19.4; RB-5; 2.3; 11 |
| D14 | The contract's defaults for SPEC-GAP-1 to 7: the text rule; pairing codes and the two counters kept by a reset; an ACTIVE code written `CANCELLED`; 17 health-snapshot columns; the epoch continues; `lastSignInAt` from the newest kept session; several open sessions per device, the registry shows the newest. Reset order: build, carry over, swap, drop the old database last. The hardware snapshot is one row with a column per slice | API-13; 12.4; E-25; E-23; 6.5; 3.1; E-24 |
| D15 | DEPARTURE-5 and DEPARTURE-6 accepted (client specification); the registry's mode model | 7.19; 5.3 |
| D16, DR-03 | All 24 corrections of the security design review folded in; three database roles; the chain lineage as a table that survives every reset; `@fastify/helmet` 13.1.1 adopted; no `localhost` origin; a cookie name per instance; 17 residual risks accepted | 17.7; 18.2 |
| D17 | The plan: HB-13 in two folders, the reset routine (HB-3) in `db/reset/` and built before the demo module | 2.2 |
| D18 | CF-1, CF-2 and OP-1 ruled; GS-24 and GS-25 confirmed; the 13 choices below accepted | ID-1; E-26, DC-6, SR-78; AC-B-76, AC-B-80, AC-B-87; 12.4; 18.1 |
| D19, D20 | The superuser is used at provisioning only: its one trial step is T5-j, and after the provisioning row nothing connects as `dems_admin`; the serial unit-of-work queue lives in `core/` | 2.1 (C-6), 2.2, 14.1, AC-B-72 |

**Choices made by revision 2 where the review leaves a value open. All 13 accepted [DEC:D18].**

| # | Choice | Finding | Why | Section |
|--:|---|---|---|---|
| 1 | The credential is resolved at stage 4 and the throttle runs at stage 5. The review offers this, or a second counter after authentication | SD-12 | One counter and one key rule | 2.3 |
| 2 | Throttle keys `operator:<id>`, `device:<id>`, `class:web`, `class:local`; class buckets at 30 per 60 s, with health counted apart at 600 | SD-12 | The review fixes the principle, not the keys | 5.1 |
| 3 | The denial budget counts six audit types, blocks every REST operation of the key except health, leaves socket upgrades alone, and uses `rate-limiter-flexible` | SD-03 | The stage runs before the guard, so it cannot block refusals only | 5.1 |
| 4 | Two credentials in one request answer 401 `NOT_SIGNED_IN` with `details.reason: CREDENTIAL_CONFLICT`; a bearer with a web console origin answers 403 `ORIGIN_NOT_ALLOWED`. No new error code: the documented list stays at 31 | SD-09 | The review says "refused" and names no code | 5.2, 7.2 |
| 5 | Anonymous sockets: a cap of 6 of the 16 (the review's example), not the displacement of the oldest anonymous connection | SD-13 | No connection is closed on another caller's account | 9.1 |
| 6 | The cookie has no `Max-Age`. The review offers this, or listing the persistent cookie as a deviation | SD-24 | No further accepted deviation is needed | 5.1 |
| 7 | The lineage is returned by `verifyAuditChain` (`lineage`, the newest 20, `lineageTotal`). No new operation: the count stays 75 | SD-19 | D16 fixes the table, not the read path | 7.13 |
| 8 | The instance's own origins are `http://127.0.0.1:4420` and, on a lane, the origin of its listen port | SD-02 | Every app addresses port 4420 on its device side | 2.4 |
| 9 | The fifth concurrency test is the concurrent sign-in test | SD-04 | The review names four and counts five | AC-B-80 |
| 10 | `Strict-Transport-Security` is not sent; the header library's other defaults are recorded by row 25 (W03, W08) | SD-14 | No TLS | OR-9 |
| 11 | No `PAIRING_CODE_CLOSED` row for a code cancelled by a reset | D14 | The adopted default names none | 12.4 |
| 12 | The optional checks of SD-07 (`Sec-Fetch-Site`, `Host`) and the console key of the dev proxy are not adopted | SD-07 | Optional in the review, and absent from its ordered corrections | OR-10 |
| 13 | Names: the owner-role file is `.data/pg.owner.env` and the lineage table is `audit_chain_history` (the review's name), as the database contract's revision 2 fixes them. `AuditChainLineageEntry` carries the values D16 lists, and not the contract's `first_seq` and `last_seq` | SD-01, SD-19 | The contract owns file and table names | 14.1, 3.3, 7.18 |

**Corrections that disagreed with an accepted decision: both DECIDED [DEC:D18].**

| ID | Correction | Accepted decision it disagreed with | Ruling, as this file states it |
|---|---|---|---|
| CF-1 | SD-04, first test: "20 parallel wrong redeems consume exactly five and close the code" | D13, open choice 6: redeeming locks for 60 s after three failures, and the code closes after five | DECIDED [DEC:D18]: the accepted parameters stand. AC-B-76 counts three failures in the first burst, then the lock, two more after it, and the code closes at exactly five |
| CF-2 | SD-19, option (i): on the lineage table, "INSERT and SELECT for the owner, SELECT for the runtime role" | D16: the table is "covered by the same privileges", which the first draft of the database contract's revision 2 read as INSERT and SELECT for the runtime role | DECIDED [DEC:D18]: the runtime role `dems_app` has SELECT only on `audit_chain_history`, and rows are appended by the reset routine under `dems_owner` (E-26, DC-6, SR-78, AC-B-87). D16's phrase meant the same trigger protection, not INSERT for the runtime role. The database contract says the same from its revision 2.1 [DB:§7.3] |

**A defect of revision 1 that came to light while the decision table of SD-02 was written: DECIDED [DEC:D18].**

| ID | Point | Ruling, as this file states it | Rejected alternative |
|---|---|---|---|
| OP-1 | `getSignInStatus` was held to the console rule of `signIn`, which a web console cannot meet for a GET: a browser sends no `Origin` on a same-origin GET (GS-29) | DECIDED [DEC:D18]: the operation stays a GET and needs no console identity; without a device credential it reports only the web console's lock state (ID-1; section 14.2; AC-B-32) | Operation 3 as a POST: rejected, because the operation changes no state |

**Confirmed [DEC:D18].** GS-24: the fifth concurrency test is the concurrent sign-in test (AC-B-80). GS-25: a code that a reset cancels gets no `PAIRING_CODE_CLOSED` row.

---
*Generated: 2026-10-04 03:14*
*Last Updated: 2026-10-04 06:16 (revision 2.2)*
