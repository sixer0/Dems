---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: request-translator
status: original
---

# Original Request: DEMS Backend (Postgres), Integrated RBAC and Portal-Mobile Pairing

## User Request

Verbatim, in Indonesian, as passed by the controller:

```
lanjut ke step berikutnya

1. aktifkan RBAC terintegrasi & pairing system antara portal utama dengan mobile
2. aktifkan Backend dengan DB Postgres semua fitur dan endpoint


persiapkan mulai plan dan spec, dan lanjutkan implementasi full autonomous dengan mencatat semua temuan, drift dan keputusan yang kamu ambil.
```

## Request Metadata

- **Task Title**: DEMS Backend (Postgres), Integrated RBAC and Portal-Mobile Pairing
- **Date Received**: 2026-10-04
- **Task folder**: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/`
- **Workspace root**: `/Users/gsp-budi/Documents/DEMS`
- **Request language**: Indonesian (working documents under `/docs` are written in English)
- **History References Provided**: Yes
  - `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/01_translated.md`
  - `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/masterplan/01_specs.md` (web spec rev 3; §14 covers Login/auth, API reference, demo operators)
  - `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/masterplan/04_mobile_specs.md` (login, pairing screen, role gating)
  - `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/decisions/decisions.md` (D1–D133 and Drift Log; D3/D4, D19, D25/D26, D62, D66, D94/D104 named)
  - `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/verification/01_verification.md` (known issues KI-01..KI-29)
  - `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/research/01_explore.md` (extract of the confidential design book)
  - User memory: `/Users/gsp-budi/.claude/projects/-Users-gsp-budi-Documents-DEMS/memory/` (5 entries)

## Raw Context

Everything in this section was supplied by the controller with the delegation. It is recorded as received and is not the user's wording.

### Terms carried over from the predecessor task

- "core" = the React web console for the Core Machine.
- "mobile" = the Android operator app.

### Code facts the controller verified on 2026-10-04

- Monorepo (npm workspaces):
  - `packages/shared`: tokens, i18n, `sim` (a zustand-vanilla simulator with the session state machine, auth with 3 synthetic operators — Investigator, Supervisor, Technician — permission checks and a demo pairing code), and `api` (an OpenAPI 3.1 document).
  - `apps/core-web`: Vite + React 19 web console. This is the "portal utama".
  - `apps/mobile`: Expo / React Native Android app.
  - `apps/mock-core`: Fastify; health endpoint and a 1 Hz WebSocket heartbeat only, on 127.0.0.1:4400; plus the standalone launcher used by the packaged web demo.
- Today both clients run their **own** in-app simulator. Nothing is shared between the web console and the mobile app, and no database exists.
- PostgreSQL is not installed on this host.
- A `docker` CLI exists, but Docker must not be used without the user's explicit OK.
- The confidential design book `DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx` in the workspace root is the source of the domain. Its extract is `docs/2026-09-30_dems_demo_stack_setup/research/01_explore.md`. Large passages must not be copied, and none of it may be sent anywhere.

### User preferences from memory (as summarised by the controller)

- The stack must use ready-made frameworks and kits, not hand-built infrastructure.
- The user writes in Indonesian.
- Working documents under `/docs` are written in English.

### Controller instruction about ambiguity

- The user explicitly asked for full autonomy, so ordinary ambiguity must not stop the task.
- Every open question is to be written down with its options, a recommended default and the reason. The controller adopts the defaults and records them as decisions.
- `CLARIFICATION_NEEDED` is returned only if a question is impossible to default.
- Anything outward-facing or hard to reverse is flagged separately and stays the user's call: accounts, cloud services, publishing, Docker, persistent system settings, real personal data.

### Points the controller asked the translation to make explicit (as intent, not design)

1. What "RBAC terintegrasi" most plausibly means: one server-side source of truth for users, roles and permissions, enforced by the backend and honoured by both the web console and the mobile app, versus today's per-client simulated checks.
2. What "pairing system antara portal utama dengan mobile" most plausibly means: a real pairing flow in which the mobile device is paired with the Core through the portal (a code or QR issued or approved in the portal, the device registered and revocable, state shared), versus today's simulated fixed code.
3. What "Backend dengan DB Postgres semua fitur dan endpoint" most plausibly means: every feature the two apps show (auth, sessions and recording lifecycle, evidence and verification/export, devices and inputs, storage, network and time, security and audit, system/maintenance, pairing, realtime status) served by real backend endpoints that persist to PostgreSQL, replacing the in-app simulation as the source of truth; and what that implies for things with no real hardware behind them (recording, sensors).
4. The process intent: spec and plan first, then implementation; a running log of findings, drift and decisions; a final report at the end.
5. Impact questions the architect must answer later (to be listed, not solved): the fate of the offline "Simulated" mode and of the already-released packages (APK, web launchers); how PostgreSQL is provisioned on the dev host and on a demo PC; migration of the demo dataset into the database; security expectations (password hashing, tokens/sessions, audit trail); testing strategy.

### Documentation contract received

- Deliverables: `identification/01_original.md` and `identification/01_translated.md`.
- Parallel run: do not write `delegation_progress_report.md` or `status_tasks.md`; write `delegation_progress/request_translator.md` instead.
- The final response must give an explicit status, the exact file list, and milestones, blockers and decisions for the controller to record.

### State of the task folder when this agent started

Present: `README.md`, `status_tasks.md`, `decisions/decisions.md` (D1, D2, F1, F2). No `identification/` folder yet.

---
*Generated: 2026-10-04 (clock time not available to this agent)*
