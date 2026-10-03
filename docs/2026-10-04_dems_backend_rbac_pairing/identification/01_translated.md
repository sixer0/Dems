---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: request-translator
model_tier: default
status: translated
---

# Translated Tasks: DEMS Backend (Postgres), Integrated RBAC and Portal-Mobile Pairing

## English Translation of the Request

> Continue to the next step.
>
> 1. Activate integrated RBAC and the pairing system between the main portal and the mobile app.
> 2. Activate the backend with a PostgreSQL database, for all features and endpoints.
>
> Prepare it starting with the plan and the spec, then continue with the implementation fully autonomously, recording every finding, drift and decision you make.

Source: verbatim request in `identification/01_original.md`.

| Term in the request | Read as | Basis |
|---|---|---|
| "portal utama" (main portal) | The web console, `apps/core-web` | It is the only web application in the workspace; predecessor D3 |
| "mobile" | The Android operator app, `apps/mobile` | Predecessor translation, Intent |
| "aktifkan" (activate) | Make live what exists today only as a simulation or a scaffold | RBAC, pairing and nine of the ten API operations exist today in simulated form (see Current state) |
| "Backend" | A server process in this workspace that stands in for the Core Machine's services | Predecessor D3/D4: `apps/mock-core` is a scaffold with health and heartbeat only |
| "semua fitur dan endpoint" | Every feature the two apps show, and every endpoint those features need | The request says "all", not a subset |

## Intent

The predecessor task delivered two polished clients, each running its own copy of an in-app simulator. They do not share anything. The user now wants them to behave as **one system**.

Three things must become real:

1. **A backend with PostgreSQL is the single source of truth.** Both clients read and change state through it. The in-app simulation stops being the authority.
2. **RBAC is integrated.** Users, roles and permissions live in one place on the server. The backend enforces them, and the web console and the mobile app both honour the same answer.
3. **Pairing is a real flow between the portal and the mobile app.** A mobile device is paired with the Core through the portal, is registered there, and can be revoked there.

The reason behind the request is not stated. The most likely reason is that the user wants to show the demo working end to end: an action on the mobile app appears on the portal, and a permission or pairing change made in the portal takes effect on the mobile app. This is an inference.

**Process intent.** The user set an order: spec and plan first, then implementation. The user granted full autonomy for this task on one condition: every finding, drift and decision is recorded as it happens and reported at the end.

**Scale category:** Enhancement (major), with a Migration component (the simulator's demo dataset moves into PostgreSQL).

### Current state that "activate" refers to

| Area | Today | Source |
|---|---|---|
| Source of truth | Each client runs its own simulator and keeps its own snapshot: web in `sessionStorage` key `dems.sim.v1`, mobile in AsyncStorage key `dems.sim.v1`. No database exists | `masterplan/01_specs.md:1723`; `masterplan/04_mobile_specs.md:664` (predecessor folder); controller pre-screen |
| RBAC | 3 roles and 9 permissions, hard-coded in shared code and checked inside each client | `packages/shared/src/sim/vocabulary.ts:16-34`; `packages/shared/src/sim/auth.ts:46-91` |
| Sign-in | 3 synthetic operators. The password check compares the input with one shared constant. Lockout is 5 failures in 5 min for 60 s | `packages/shared/src/sim/auth.ts:4-13,285-293`; `packages/shared/src/sim/dataset.ts:153` |
| Sign-in without a server-verifiable credential | "Security key (simulated)" signs in as the SUPERVISOR operator. Biometric sign-in trusts the phone's OS result | `packages/shared/src/sim/auth.ts:295-314`; `packages/shared/src/sim/dataset.ts:155` |
| Pairing on mobile | A 6-digit code compared with a fixed constant inside the app. 3 failures lock for 60 s. Unpaired tablets can still sign in | `packages/shared/src/sim/pairing.ts:47-51`; `packages/shared/src/sim/dataset.ts:157`; `masterplan/04_mobile_specs.md:751` |
| Pairing in the portal | No pairing management surface. The portal only displays the simulator's pairing state on Login and in the device drawer | `apps/core-web/src/features/login/use-login-controller.ts:92,294`; `apps/core-web/src/features/devices/device-drawer.tsx:279,288`; no pairing or user route under `apps/core-web/src/routes/` |
| API | 10 operations in the OpenAPI document: service health is LIVE, the nine design-book operations are answered by a simulator handler inside the client | `packages/shared/src/api/core-api.ts:420-613`; `packages/shared/src/sim/api.ts:502`; predecessor D62 |
| Server | `apps/mock-core`: Fastify 5.12.5, health endpoint and 1 Hz heartbeat only, loopback 127.0.0.1:4400 | `apps/mock-core/package.json:15-21`; `packages/shared/src/api/constants.ts:8-18` |
| Mobile connection to the server | Default source is SIMULATED. The alternative, HEARTBEAT, works only in debug builds over `adb reverse`. The release APK is Simulated-only and allows no cleartext traffic | `apps/mobile/src/runtime/core-link.ts:24-34` |
| Released packages | `release/android/DEMS-Demo-0.1.0.apk`; six web packages under `release/web/`; `release/RUN-ON-ANOTHER-PC.md` | Glob of `release/`; predecessor D94, D104 |

### What each of the three phrases most plausibly means

**"RBAC terintegrasi".** One server-side definition of users, roles and permissions. The backend checks it on every protected operation. Both clients receive the signed-in operator's effective permissions from the backend and use them to enable, disable or hide actions. A denied action is refused by the server, not only greyed out in the UI, and it leaves an audit row. "Integrated" is read as "the same RBAC across portal, mobile and backend". It is not read as integration with an external identity provider (see Q10).

**"Pairing system antara portal utama dengan mobile".** A mobile device becomes trusted by the Core through an action in the portal. The portal issues or approves the pairing (a one-time code, optionally shown as a QR). The backend registers the device. The portal lists paired devices and can revoke one. A revoked or unpaired device loses access. Because both clients then use one backend, they also show the same live state.

**"Backend dengan DB Postgres semua fitur dan endpoint".** Every feature that the two apps show is served by backend endpoints that persist to PostgreSQL. The feature areas are listed under Scope. The OpenAPI document then describes every endpoint, and no operation is answered by a simulator inside the client.

**What this implies where no hardware exists.** There are no cameras, microphones, sensors, TPM or evidence disks. The backend can be real for identity, permissions, pairing, sessions, evidence records, audit and state. The signals that need hardware (camera frames, audio levels, device health, signing) must stay synthetic. The intent is read as: **a real backend with simulated hardware**. The synthetic signals are produced and owned on the server side, so that both clients see the same values, and the UI keeps labelling them as simulated. How the server produces them is a design decision for the architect (see Q4).

## Goals

1. **Spec and plan come first.** `masterplan/01_specs.md` and `masterplan/02_plan.md` exist before implementation starts. They cover the backend, the data model, the full API surface, the RBAC model, the pairing flow, the integration of both clients, and every impact question listed below.
2. **A backend runs on PostgreSQL.** The backend starts from a documented command, creates its schema from an empty database, and keeps its state across a restart.
3. **Every feature is served by the backend.** In live operation both clients take their data from backend endpoints and the realtime channel. The OpenAPI document describes every endpoint.
4. **RBAC is enforced in one place and honoured by both clients.** A role change made on the server changes what the same operator can do on the web console and on the mobile app.
5. **Pairing works end to end.** A mobile device is paired through the portal, appears in the portal, and can be revoked there. Revocation takes effect on the device.
6. **The two clients share state.** A session started on one client is visible on the other.
7. **The demo dataset is in the database.** The predecessor's canonical demo dataset loads through a repeatable seed, and the database can be reset to that state.
8. **The work is fully logged.** Every finding, drift and decision is in `decisions/decisions.md` when it happens. `report/report.md` consolidates them at the end.
9. **What the user already has keeps working.** The offline simulated demo and the released 0.1.0 packages still work, or any change to them is a recorded decision.

## Primary Task

Write the spec and plan, then build a PostgreSQL-backed backend that becomes the single source of truth for every DEMS demo feature, with server-enforced RBAC shared by the web console and the mobile app and a real portal-to-mobile pairing flow, logging every finding, drift and decision along the way.

## Scope

- **Files**
  - Read-only: `/Users/gsp-budi/Documents/DEMS/DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx` (confidential). Downstream agents should use the extract `docs/2026-09-30_dems_demo_stack_setup/research/01_explore.md`.
  - To be created: the backend application, database schema, migrations and seed, backend tests. The architect decides the paths.
  - To be changed: the API contract and OpenAPI document in `packages/shared/src/api/`; the data layer, sign-in, role gating and pairing screens in `apps/core-web` and `apps/mobile`; root workspace configuration; `README.md` (run guide); `THIRD_PARTY_NOTICES.md` (new dependencies).
- **Folders**
  - `/Users/gsp-budi/Documents/DEMS/apps/`, `/Users/gsp-budi/Documents/DEMS/packages/shared/`: code.
  - `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/`: task documentation.
  - `/Users/gsp-budi/Documents/DEMS/release/`: existing 0.1.0 packages. Not to be overwritten or deleted.
  - Host locations outside the workspace: wherever PostgreSQL is installed, and its data directory. Every host change must be listed in the implementation logs.
- **Systems/Domains**
  - PostgreSQL (not installed on this host; `decisions/decisions.md` F1).
  - REST under `/api/v1` and the realtime WebSocket channel.
  - Identity, sign-in, sessions or tokens, lockout.
  - RBAC: roles, permissions, enforcement, denial audit.
  - Pairing and the device registry.
  - Audit trail (the simulator keeps a SHA-256 hash chain today; `masterplan/01_specs.md:1716`).
  - Android emulators reached through `adb reverse`.

### Feature areas that "all features" covers

Derived from the web routes (`apps/core-web/src/routes/`) and the mobile routes (`apps/mobile/src/app/`). The exact operation inventory is for the research phase; the simulator's action layer (`packages/shared/src/sim/actions.ts`, not read by this agent) is the place to derive it from.

| # | Feature area | Web console | Mobile app |
|---|---|---|---|
| 1 | Identity and sign-in (sign in, sign out, lockout, idle expiry) | Login | Login |
| 2 | RBAC (roles, permissions, denial with audit) | every page | every screen |
| 3 | Pairing and device registry | none today | Pair |
| 4 | Sessions and recording lifecycle (create, pre-check, start, stop with reason, finalization, sealed, cancel, fault, recovery, markers) | Session Monitor, Start New Session, Dashboard | Start Session, Session Monitor, Finalization, Summary, Recovery, Sessions |
| 5 | Evidence (list, detail, verification, review status, export) | Evidence, Evidence detail | Evidence, Evidence detail |
| 6 | Devices and inputs (cameras, microphones, health, commands, diagnostics) | Devices | Devices, Device detail |
| 7 | Storage (capacity, health, retention) | Storage | Storage |
| 8 | Network and time | Network & Time | Network & Time |
| 9 | Security and audit (security status, audit log, audit export) | Security & Audit | Operator Audit |
| 10 | System and maintenance (diagnostics, software update) | System | Settings, System Maintenance section (`masterplan/04_mobile_specs.md:591`) |
| 11 | Realtime status (heartbeat, state changes, alerts, audio levels, timers, reconnect and resync) | all | all |
| 12 | Service health and the API reference | API Reference (`/developer/api`) | not applicable |
| 13 | Demo controls (scenarios, fault injection, reset) | present in the simulator (`masterplan/01_specs.md:1719,1721`) | Settings, System Maintenance section, hidden in presentation mode (`masterplan/04_mobile_specs.md:591`) |

### In scope

- The backend service and its PostgreSQL schema, migrations and seed.
- Server-side sign-in, RBAC enforcement and audit.
- The pairing flow on the backend, in the portal and on the mobile app.
- Wiring both clients to the backend for every feature area above.
- New portal surfaces that have no equivalent today: pairing management, and user and role administration if Q9 is adopted.
- The OpenAPI document and the API Reference page.
- Tests for the backend and for the changed clients.
- The run guide, the decision log and the final report.

### Out of scope (defaults; each is a recorded assumption)

- Real hardware: cameras, microphones, GNSS, TPM, relay and GPIO.
- Real PKI, mutual TLS and real cryptographic signing of evidence. These stay simulated and labelled.
- An external identity provider or single sign-on.
- Production hardening, deployment and cloud hosting.
- iOS.
- A visual redesign. New screens use the existing component kit and motion language.
- Publishing, a git remote, or distributing new packages.

## Constraints

**Explicit (from the request):**

- C1. RBAC is integrated across the main portal and the mobile app.
- C2. A pairing system links the main portal and the mobile app.
- C3. The database is PostgreSQL.
- C4. The backend covers all features and all endpoints, not a subset.
- C5. Plan and spec first, then implementation.
- C6. Implementation is fully autonomous for this task.
- C7. Every finding, drift and decision is recorded.

**Implicit or standing (each labelled with its source):**

- I1. **Ready-made frameworks.** Use existing frameworks and libraries; hand-build only when none fits, and record that as a decision. Source: memory `feedback-ready-made-frameworks`; predecessor constraint C3.
- I2. **Confidential design book.** No content from it goes to any external service, including web search queries. Source: CLAUDE.md §4; predecessor I2.
- I3. **Limits of the autonomy.** It does not cover outward-facing or hard-to-reverse actions. Source: this task's `decisions/decisions.md` D1. See "Items that remain the user's call".
- I4. **No Docker** without the user's explicit OK. Source: predecessor D104; D1.
- I5. **No deletion or renaming** of files the user did not ask to delete or rename. This applies to `apps/mock-core`, `packages/shared/src/sim` and `release/`. The work should be additive. Source: CLAUDE.md §4.
- I6. **Synthetic data only.** No real persons, cases or evidence. Source: predecessor A7.
- I7. **Language.** Documents under `/docs` in English. Replies to the user in Indonesian. UI text stays English (only `packages/shared/src/i18n/en/` exists). Source: memory `user-profile-dems`.
- I8. **The UI quality bar stays.** The user's first priority in the predecessor task was an elegant, fully animated UI. Moving to live data must not make the clients visibly less smooth, for example the 20 Hz audio meters. Source: predecessor C2; `masterplan/01_specs.md:1714`.
- I9. **Secrets stay local.** Database credentials and signing secrets are generated locally, git-ignored and never logged. Passwords and tokens never appear in URLs, logs, events or audit rows. Source: precedent in predecessor D104; `packages/shared/src/sim/auth.ts:10-12`.
- I10. **The API baseline stays.** The `/api/v1` prefix and the nine design-book endpoint concepts are kept. New endpoints fill what the book leaves undefined (sign-in, pairing, lists, verification, audit). Source: `research/01_explore.md:348-368` (predecessor folder).
- I11. **Domain rules the backend must respect.** Export requires RBAC and an audit record. Sealed evidence is never silently modified. The two microphone tracks are never merged. Every alert has an audit entry. Source: `research/01_explore.md:208,322,360,710` (predecessor folder).
- I12. **Host rules.** Another project owns ports 5173 (IPv6), 5174 and 5175 and must not be stopped. DEMS uses 127.0.0.1:5173, 4400 and 4410. Emulators are never killed or booted from a snapshot. Port binding, adb and git writes need to run outside the sandbox. Source: memory `reference-dems-environment-gotchas`.
- I13. **Evidence for every claim.** Completion claims need fresh command output. Source: CLAUDE.md §4, §8.

## Assumptions Made

Each assumption is a default that the controller can adopt and record as a decision.

| ID | Assumption | Why | Effect if wrong |
|---|---|---|---|
| A1 | "Portal utama" is `apps/core-web` | It is the only web application; the predecessor calls it the Core web console | A separate portal application would be a new app |
| A2 | "Integrated RBAC" means one server-side source of truth, enforced by the backend and honoured by both clients | It is the only reading in which RBAC is "integrated" between two clients that share nothing today | An external identity provider would add an outside system (see Q10) |
| A3 | "Pairing" means device pairing: the mobile device is paired with the Core through the portal, registered and revocable | The mobile app already has a Pair screen with a simulated code; the design book prefers pairing for tablet-to-Core control (`research/01_explore.md:554`) | A different meaning (for example, linking two user accounts) changes the flow |
| A4 | "All features and endpoints" means the backend is the source of truth for every feature area in the Scope table | The request says "semua" (all) | A subset would shrink the task |
| A5 | Hardware-dependent signals stay synthetic, are produced on the server side, and stay labelled as simulated | No hardware exists; both clients must see the same values | If client-side generation is kept, the two clients show different values |
| A6 | This is still a demo: local, synthetic data, no cloud | Predecessor C6; nothing in the request changes it | Production expectations would change security and deployment scope |
| A7 | "Done" is measured on this Mac: backend, PostgreSQL, the web console and the Android emulators | It is the only verified environment; other PCs and physical devices raise questions that are the user's call | See Q6 and Q7 |
| A8 | The three roles, the three synthetic operators and the nine permissions carry over as seed data. The permission list may grow | They are used across both clients and their tests | A different role model changes UI gating in both clients |
| A9 | Full autonomy applies to this task | The request states it; D1 records it. The predecessor's autonomy was task-scoped and is not reused | None |
| A10 | The visual design stays. New screens appear only where a feature has no surface today | The request is about backend, RBAC and pairing | A redesign would be a separate task |

## Open Questions With Recommended Defaults

None of these blocks the task. For each one the controller can adopt the default and record it.

| ID | Question | Options | Recommended default | Why |
|---|---|---|---|---|
| Q1 | What happens to the in-app "Simulated" mode in both clients? | (a) Keep it as a selectable offline mode beside the new live mode. (b) Remove it. (c) Keep it only in the released offline packages | **(a)** | Removing it would delete user-approved work (I5). It is the fallback if the backend fails during a demo. The 0.1.0 packages and the existing tests depend on it. The mobile Settings screen already has a "Core link source" selector (`masterplan/04_mobile_specs.md:588`) |
| Q2 | What happens to `apps/mock-core`? | (a) Add a new backend application and leave mock-core as it is. (b) Grow mock-core into the backend. (c) Rename it | **(a)** | The packaged web launcher is built from mock-core (predecessor D104). (a) is additive. (c) is a rename the user did not ask for. The architect decides which process owns port 4400 |
| Q3 | How is PostgreSQL provided on the dev host? | (a) A standard host install (Homebrew), with a project-local data directory, started and stopped by project scripts, not as a login service. (b) A PostgreSQL binary distributed through npm and started by the backend. (c) Docker. (d) An in-process PostgreSQL build such as a WASM port. (e) A hosted cloud database | **(a) for development; research evaluates (b)** for tests and portability | (a) is a real server and is reversible. (c) needs the user's OK. (d) is not a PostgreSQL server, so it may not meet "DB Postgres". (e) needs an account and sends data out. The candidates are named from general knowledge and are hypotheses until research verifies them |
| Q4 | Which data is stored, and which is only streamed? | (a) Store state, sessions, evidence records, events, audit and periodic health snapshots; stream high-rate meter frames without storing them. (b) Store everything. (c) Store only CRUD data and leave telemetry in the clients | **(a)** | (b) writes 20 rows per second per channel for no demo benefit. (c) leaves the clients disagreeing, which defeats the request |
| Q5 | Is pairing required before a mobile device can be used in live mode? | (a) Yes: an unpaired or revoked device reaches only service health and the pairing flow. (b) No: pairing is advisory, as today | **(a)** | Pairing and revocation have no effect unless they gate something. This departs from the predecessor's rule that unpaired tablets may sign in (`masterplan/04_mobile_specs.md:751`), so it must be recorded as a decision |
| Q6 | How does the mobile app reach the backend? | (a) Emulators through `adb reverse` on loopback. (b) A configurable LAN address with cleartext HTTP. (c) TLS with a locally generated certificate | **(a) as the must-have.** (b) and (c) only with the user's OK | (b) and (c) expose the backend on the network and change the release manifest's no-cleartext rule (`apps/mobile/src/runtime/core-link.ts:28-30`). See the user's-call list |
| Q7 | Do the released packages get a live edition? | (a) No: 0.1.0 stays the offline edition and the live system runs on the dev host. (b) New packages that bundle the backend and a portable PostgreSQL. (c) Other PCs connect to the backend on this Mac | **Phase it:** (a) is the must-have; the spec costs (b); (b) is built last and only if research finds a ready-made portable path that needs no Docker and no administrator install on the target PC | "As easy as possible to run on another PC" was an earlier requirement (predecessor D94). Bundling a database server for four OS targets is the largest risk in this task |
| Q8 | How is a pairing issued, and what does the device hold afterwards? | (a) The portal issues a short-lived one-time code, also shown as a QR; the mobile app enters or scans it. (b) The mobile app shows a code and a portal operator approves it. (c) Both | **(a), with code entry always available.** The device then holds a device-bound credential as a stand-in for the book's certificate-bound pairing | The mobile Pair screen already takes a 6-digit code (`masterplan/04_mobile_specs.md:420`). Emulators cannot conveniently scan a QR. Neither `expo-camera` nor `expo-secure-store` is a dependency of `apps/mobile` today, so both would be additions |
| Q9 | How much RBAC administration does the portal get? | (a) None: roles and users are seeded and fixed. (b) A read-only role and permission matrix, plus a user list with role assignment and enable/disable. (c) A full role and permission editor | **(b)** | Changing a role in the portal and seeing the mobile app follow is the clearest proof that RBAC is integrated. (c) adds risk without adding to that proof. (b) adds at least one portal page, so scope grows |
| Q10 | Is the role model extended? | (a) Keep the three roles and add permissions for pairing management and user administration. (b) Add a fourth administrator role and a fourth synthetic operator. (c) Integrate an external identity provider | **(a)** | The design book names no roles (`research/01_explore.md:666,672`), so the three roles are already a demo assumption. They are used across both clients and their tests. (c) adds an outside system |
| Q11 | What happens to the two sign-in methods that a server cannot verify today? | (a) Biometric becomes the unlock of a credential held on a paired device; the web "security key (simulated)" button is offered only in Simulated mode. (b) Remove both in live mode. (c) Implement real WebAuthn | **(a)** | A real backend must not issue a SUPERVISOR session without a credential (`packages/shared/src/sim/auth.ts:310-314`). (c) is a large addition the request does not ask for |
| Q12 | Do the seeded operators keep the demo password and the "Demo operators" disclosure? | (a) Yes, with only a hash stored. (b) New passwords generated at seed time | **(a)** | Demo continuity. The accounts are synthetic. The disclosure is already hidden in presentation mode (`masterplan/01_specs.md:1801`) |
| Q13 | Does the portal itself need pairing? | (a) No: it is the Core's own console. (b) Yes: browsers register too | **(a)** | The request describes pairing "between the portal and mobile". The Login trust line then needs truthful wording instead of "paired (simulated)" |
| Q14 | Are demo controls (scenarios, fault injection, reset to seed) available in live mode? | (a) Yes, on the server, behind a permission and a server-side demo flag. (b) No | **(a)** | The fault scenarios are part of what the demo shows (`masterplan/01_specs.md:1719`). Reset makes the demo repeatable |
| Q15 | Whose clock is authoritative? | (a) The server's. (b) Each client's simulator clock | **(a)** | Two clients must agree on timers and timestamps. The seed must then produce date-relative records (`masterplan/01_specs.md:1765-1766`) |
| Q16 | What may a second client do to a session it did not start? | (a) One active session per Core; any operator with the session permission may stop it, with a reason and an audit row. (b) Only the operator who started it | **(a)** | It matches the existing single-session rule (`masterplan/01_specs.md:1743`). The architect fixes the exact rule |

## Items That Remain the User's Call

The autonomy does not cover these (D1). They are flagged, not defaulted. If the plan needs one, the controller asks the user.

| ID | Item | Why it is flagged |
|---|---|---|
| U1 | Using Docker to run PostgreSQL | Explicitly excluded without the user's OK |
| U2 | Running PostgreSQL as a login or background service (for example a launchd service), or editing the shell profile | Persistent system setting |
| U3 | Installing PostgreSQL on this host at all | **Inferred authorisation.** The request cannot be met without a PostgreSQL server, and a host install is reversible. But the blanket install permission was given for the predecessor task (its C7), not for this one. Recommended: the controller records the install as an explicit decision, uses the least persistent form (Q3 option a), and reports it |
| U4 | Making the backend or the database listen on a network interface other than loopback; allowing cleartext traffic in a release APK; firewall prompts | Network exposure of a service that has demo credentials |
| U5 | Any hosted database, hosted auth service, cloud build or third-party account | Accounts and cloud services; data would leave the machine |
| U6 | A git remote, a push, publishing, or handing out new packages | Outward-facing. `docs/` with design-book extracts is tracked in local commits (predecessor KI-28) |
| U7 | Real personal data in the users table or the seed | The seed must use only the synthetic operators. The user's name and email must not be used as seed data |
| U8 | Deleting or renaming `apps/mock-core`, the in-app simulator, the 0.1.0 packages, or the clients' stored keys | CLAUDE.md §4 |
| U9 | Wiping emulator data or stopping another project's servers | Hard to reverse; the other project is not ours (I12) |

## Impact Questions for the Architect

These are to be answered in the spec. They are listed here, not solved.

**Modes and released artefacts**
1. How do Live and Simulated modes coexist in each client: build flag, runtime setting, or automatic fallback? What does the UI show in each mode?
2. Do the 0.1.0 APK and web launchers stay untouched? If a live edition is built, how is it versioned so that it does not replace 0.1.0?
3. How does a release APK reach a backend, given that it currently allows no cleartext and has no configurable address (`packages/shared/src/api/constants.ts:4-5`)?

**PostgreSQL**
4. How is PostgreSQL installed, started, stopped and removed on the dev host? Which port, given that other projects on this Mac may also use PostgreSQL? Where is the data directory, and is it git-ignored?
5. How would PostgreSQL reach a demo PC on each of the four OS targets of predecessor D104?
6. Which database do the automated tests use, and how is it isolated from the demo database?

**Data**
7. How does the canonical demo dataset move into the database: the operators, the device, the six evidence items, the recording scenario, and the generated demo packages and documents under `packages/shared/src/demo-data/`? How are date-relative records seeded?
8. Where do the demo media files live in live mode, and who serves them?
9. How is the database reset to the seed state between demos?
10. What happens to a session that was recording when the backend stopped? (The book's recovery path is the natural model: `masterplan/01_specs.md:1751-1752`.)

**Security**
11. Password hashing, the session or token model, expiry, revocation, and where each client stores its credential.
12. Server-side lockout and rate limiting for sign-in and pairing.
13. Authentication of the WebSocket channel, and what an unpaired or signed-out client may receive on it.
14. The audit trail: append-only storage, the hash chain, and which actions must write a row (sign-in, denial, pairing, revocation, role change, export).
15. Secrets: how they are generated, where they are kept, and how they stay out of git and logs.
16. CORS and the packaged content-security policy (`apps/core-web/src/lib/packaged-csp.ts`) once the web console calls many more endpoints.
17. The biometric and security-key sign-in paths (Q11).

**RBAC and pairing**
18. The full permission list and the role-to-permission matrix, including the new pairing and administration permissions.
19. How the clients learn of a permission or pairing change while signed in.
20. The pairing lifecycle: issue, expiry, redemption, device identity, revocation, re-pairing after an app reinstall.

**Contract and clients**
21. The complete endpoint list, the realtime message schema, and resync after a reconnect.
22. How the shared contract is changed without parallel agents colliding in `packages/shared` (the predecessor routed such changes through the controller: `masterplan/04_mobile_specs.md:639`).
23. How the API Reference page changes when every operation is live, while keeping its rule that no request leaves the machine (`masterplan/01_specs.md:1854-1857`).

**Testing and verification**
24. The test strategy: backend unit and integration tests against a real PostgreSQL; a role-by-endpoint authorisation matrix; pairing flow tests; contract tests against the OpenAPI document; the existing web, mobile and shared suites; an end-to-end check across backend, web and an emulator.
25. Which predecessor known issues are touched by this work and must not get worse (KI-01 pairing tablet layout never checked on a device; KI-02 no Maestro flows exist; KI-07 open simulator gaps on mobile; KI-18 stale API description).

## Source Documents

| Path | Type | Purpose | References |
|------|------|---------|------------|
| `/Users/gsp-budi/Documents/DEMS/DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx` | document (docx, confidential, read-only) | Domain source. Not read by this agent | Use the extract below |
| `docs/2026-09-30_dems_demo_stack_setup/research/01_explore.md` | markdown | Design-book extract | L348-L368 (§21.2 API baseline and its gaps); L370-L385 (§21.3 entities); L554 (§20.1 pairing); L666, L672, L685 (gaps G1, G14) |
| `docs/2026-09-30_dems_demo_stack_setup/masterplan/01_specs.md` | markdown | Web spec rev 3 | §14.7 simulator, state machine and dataset (L1704-L1777); §14.8 login and auth (L1779-L1812); §14.9 API reference (L1814-L1865) |
| `docs/2026-09-30_dems_demo_stack_setup/masterplan/04_mobile_specs.md` | markdown | Mobile spec | §4.1-§4.2 login and pairing (L399-L423); §5 data (L626-L697); §6 auth and pairing policy (L701-L759) |
| `packages/shared/src/sim/` | TypeScript | The behaviour the backend must reproduce | `auth.ts`, `pairing.ts`, `session-machine.ts`, `api.ts`, `actions.ts`, `dataset.ts`, `vocabulary.ts` |
| `packages/shared/src/api/` | TypeScript | The current contract | `core-api.ts` (10 operations), `openapi.ts`, `constants.ts` |

## Output Requirements

- **Format**: `md` for all documentation. The request contains no output-format keyword, so the default applies. "Plan dan spec" are the Markdown files `masterplan/01_specs.md` and `masterplan/02_plan.md`. The functional deliverables are running code and a database.
- **Destination**:
  - Documentation: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/`, in the phase folders of CLAUDE.md §3.
  - Code: under `/Users/gsp-budi/Documents/DEMS/`. The architect decides the layout. Never `/output`.
- **Style**: English. Every factual claim cites a file and line, a command with its output, or a URL. No emoji in deliverables.
- **Output Format Question**: not applicable. This is an implementation task, not a research deliverable.

## Success Criteria (Definition of Done)

1. `masterplan/01_specs.md` and `masterplan/02_plan.md` exist and are dated before the first implementation log.
2. The backend starts from a documented command. Migrations build the schema from an empty database. The seed loads the demo dataset. State survives a backend restart.
3. In live mode, both clients take their data from the backend. An action on one client is visible on the other.
4. An automated role-by-endpoint test passes. A denied action is refused by the server and writes an audit row. Changing an operator's role on the server changes that operator's permissions on both clients.
5. A freshly installed mobile app cannot operate in live mode until it is paired with a portal-issued pairing. The device then appears in the portal. Revoking it there removes its access. Each step writes an audit row.
6. The OpenAPI document describes every endpoint, its drift test passes, and the API Reference page shows the endpoints as live.
7. The existing test suites still pass and the new backend tests pass, with the command output quoted.
8. The Simulated mode and the 0.1.0 packages still work, or each change to them is a recorded decision.
9. `decisions/decisions.md` holds every decision, drift and finding. `report/report.md` consolidates them.
10. No secret is committed, no real personal data is stored, and nothing was sent outside the machine.
11. `README.md` gives the exact commands to start PostgreSQL, the backend, the web console and the mobile app in live mode.

## History Relevance Assessment

| Reference | Relevance | Notes |
|-----------|-----------|-------|
| `docs/2026-09-30_dems_demo_stack_setup/identification/01_translated.md` | Direct | Defines "core" and "mobile". Its constraints on confidentiality, synthetic data, local builds and outward-facing actions still apply |
| `docs/2026-09-30_dems_demo_stack_setup/masterplan/01_specs.md` (§14.7-§14.9) | Direct | Defines the simulator, state machine, dataset, auth policy and API reference that the backend replaces as the source of truth |
| `docs/2026-09-30_dems_demo_stack_setup/masterplan/04_mobile_specs.md` (§4.1-§4.2, §5, §6) | Direct | Defines mobile login, pairing, role gating, storage keys and the Core link source |
| `docs/2026-09-30_dems_demo_stack_setup/decisions/decisions.md` | Direct | D3, D4, D19, D25, D26, D62, D66, D94 and D104 fix the starting point |
| `docs/2026-09-30_dems_demo_stack_setup/research/01_explore.md` | Direct | The domain: API baseline, entities, pairing, and what the book leaves undefined |
| `docs/2026-09-30_dems_demo_stack_setup/verification/01_verification.md` | Indirect | Known issues that this work touches or must not worsen |
| `docs/2026-09-30_dems_demo_stack_setup/masterplan/06_packaging_spec.md` | Direct for the packaging impact | **Not read by this agent.** Known only through D104. The architect should read it for Q6 and Q7 |
| `docs/2026-10-04_dems_backend_rbac_pairing/decisions/decisions.md` | Direct | D1 (autonomy and its limits), D2 (baseline commit re-run), F1 (no PostgreSQL), F2 (no servers running) |
| Memory: `feedback-ready-made-frameworks`, `feedback-autonomy-with-decision-log`, `reference-dems-environment-gotchas`, `user-profile-dems` | Direct | Constraints I1, I3, I7, I12 |
| Memory: `feedback-parallelism-push-to-limit` | Indirect | The wide-parallel override was task-scoped. See Notes |

### Important Notes From History

- **mock-core is a scaffold by decision.** It has health and heartbeat only (D3, D4). The simulator was put in `packages/shared` so both clients could run it in-app (D19).
- **The API contract already exists.** `packages/shared` holds an OpenAPI 3.1 document with 10 operations: health is LIVE and the nine design-book operations are SIMULATED (D62). Each operation carries a badge, and export is marked "RBAC + AUDIT" (`masterplan/01_specs.md:1849`).
- **The design book leaves much of the API undefined.** It has no sign-in, pairing, evidence-list, audit-list or verify endpoint, no WebSocket schema and no request or response bodies (`research/01_explore.md:364-368`). The demo defines these itself.
- **The design book names no roles** (`research/01_explore.md:666`). The three roles are a demo assumption.
- **The design book defines no Core-side GUI** (`research/01_explore.md:685`). The web console is a demo visualisation, so "portal" features such as pairing management and user administration are demo design, not book requirements.
- **The auth policy is already specified** and should carry over unless a decision changes it: 5 failures in 5 min lock for 60 s; a 15 min idle timeout; one audit row per attempt; a generic failure message; credentials never stored or logged (`masterplan/01_specs.md:1807-1812`).
- **The released mobile APK is Simulated-only**, with no cleartext traffic and the heartbeat disabled (D104). The web launcher serves the app and the health and heartbeat endpoints from one origin on port 4410, using Node built-ins only (D104).
- **Both clients already depend on** `@tanstack/react-query` 5.104.0, `zod` 4.6.5 and `zustand` 5.0.15 (`apps/core-web/package.json:23,38,39`; `apps/mobile/package.json:31,72,73`).
- **The baseline commit is being redone** in parallel (D2). The working tree had many uncommitted changes when this task started.

### Lessons from History

- **Mobile device builds differ from jest.** The device build runs the React Compiler; any function that calls hooks must be named `use*` (D66). Device checks are needed, not only jest.
- **`expo prebuild` wipes `apps/mobile/android/`.** Back up the APK first (KI-21).
- **One writer at a time for shared code and for npm or Gradle.** The predecessor routed shared-contract changes through the controller, and wide parallel runs overloaded this Mac (memory `feedback-parallelism-push-to-limit`).
- **Sandbox limits.** Port binding, adb, the emulator and git writes need to run outside the sandbox (memory `reference-dems-environment-gotchas`). A PostgreSQL server binds a port, so the same applies.
- **Deferred verification accumulates.** The predecessor deferred its device end pass and its Maestro flows (KI-01, KI-02). This task changes sign-in and pairing on the device, which those checks would have covered.
- **Keep the Mac awake** during long runs (KI-26).

## External Research Scope

No keyword from the dimension table appears in the request itself. The dimensions below are triggered by inference: the request needs technology choices, and the standing ready-made-frameworks constraint (I1) requires them to be evaluated. They are labelled as inferred.

- **Technology Evaluation** (Dim 2), inferred from "Backend dengan DB Postgres" and "RBAC terintegrasi" together with I1. Compare ready-made options for: PostgreSQL provisioning on macOS arm64 and on a portable demo PC; data access and migrations; password hashing and session or token handling; authorisation for a Fastify-class server; realtime fan-out; secure credential storage on Android; QR display and scanning. Generic security good practice for password storage and session management belongs here as an evaluation criterion.
- **Technology Trends** (Dim 1), inferred. Check that each candidate is current and compatible with what is installed: Node v26.8.2, Fastify 5.12.5, TypeScript 6.0.3, React 19.2.3, Expo SDK 57 and React Native 0.86.3.
- **Vendor Evaluation** (Dim 3), limited. Check licence terms, and whether any candidate requires an account or a cloud service. Such candidates are excluded by default (U5).
- Not triggered: Market Share & Positioning (Dim 4), Regulatory & Compliance (Dim 5), Competitive Landscape (Dim 6), Industry Trends (Dim 7). This remains a demo with synthetic data.
- **Research constraint**: queries must be generic technology queries. No design-book content may appear in them (I2).

## Dependencies

- A PostgreSQL server on this host. None is installed (F1). See U3.
- Internet access for PostgreSQL and npm packages.
- The baseline commit of the predecessor's final tree (D2), so that this task's changes are diffable.
- The Android emulators and `adb reverse` for live-mode checks on mobile, run outside the sandbox.
- Free ports for the backend and the database that do not collide with the other project on this Mac.
- The Mac staying awake during long runs.

## Notes

- **Clarification decision.** `CLARIFICATION_NEEDED` was not raised. Every open question has a workable default, and the controller was told to adopt defaults. The items that cannot be defaulted are listed as the user's call and do not block the spec phase.
- **Most consequential defaults.** Q1 (keep Simulated mode), Q3 (how PostgreSQL is provided), Q5 (pairing becomes mandatory in live mode), Q7 (live packaging is phased) and Q9 (a user and role page in the portal). The controller should report these five to the user in the blueprint summary even though approval is pre-granted.
- **Parallelism.** The wide-parallel override belonged to the predecessor task, and the memory entry says to confirm it once per new task. The request does not mention it. CLAUDE.md §6 limits apply until the user says otherwise.
- **What this agent read.** The predecessor files and line ranges listed under Source Documents; `packages/shared/src/sim/auth.ts`, `pairing.ts` and parts of `vocabulary.ts`, `dataset.ts`, `api.ts`; `packages/shared/src/api/constants.ts` and the operation list of `core-api.ts`; `apps/mobile/src/runtime/core-link.ts`; `apps/core-web/src/lib/core-endpoint.ts`; route listings of both apps; the five memory entries. It did not read the design book, `06_packaging_spec.md`, `sim/actions.ts` or the predecessor's plan.
- **Progress file not written by this agent.** The controller asked for `delegation_progress/request_translator.md`. This agent's file-scope boundary allows it to create only `identification/01_original.md` and `identification/01_translated.md` in the task folder. The entry is returned in the agent's final message for the controller to write. The predecessor task handled it the same way.
- **Graft.** The repository has a Graft index. Downstream code exploration should use it (CLAUDE.md §10).

---
*Generated: 2026-10-04 (clock time not available to this agent)*
*Last Updated: 2026-10-04*
