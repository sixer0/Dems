---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-06
agent: verifier
row: E2E-W2
decisions: D191, D194
tier: 2
type: end-to-end-test-report
status: needs-review
---

# E2E-W2: every web page in Live mode as INVESTIGATOR and as TECHNICIAN, and two consoles live

## 1. Result

**Mostly PASS, with one known UI-versus-matrix defect and two process incidents the controller must record.**

- **Part A:** 14 routes for each of the two roles (28/28) were opened two ways: through the navigation and by typing the deep link. Every gated control was compared with the role matrix: 62 automated checks per role, plus 12 below-the-fold facts per role. Results:
  - The **server role and permission list** of each session match `ROLE_PERMISSIONS` exactly.
  - **One mismatch:** the Dashboard device-tile menu disables **Test signal** for the INVESTIGATOR, but the matrix grants it (operation 49 needs `DIAGNOSTICS_RUN`). This is known as F63-1 and was ruled the safe direction in D152. By this row's rule it is still a mismatch: **E2E-W2-1**.
  - One driver expectation was too strict and was re-judged with evidence (section 4.2, note a).
- **Refusals:** 9 calls the roles may not make were issued from the page's own context, 4 as INVESTIGATOR and 5 as TECHNICIAN. All 9 answered **403 `NOT_PERMITTED`** with `details.operationId/permission/role`, and each wrote exactly one **`ACCESS_DENIED`** row (seq 109 to 112 and 135 to 139). The SUPERVISOR read those rows back in Security & Audit.
- **UI refusals:** the Export wizard's Authorise step gave 2 more refusals (403 `FORBIDDEN`, `EXPORT_DENIED` rows seq 105 and 128).
- **Part B:** **7 of 7 changes** made in one console appeared in the other console **with no reload**, between **24 ms and 431 ms** after the Core's audit row (target 2 s).
- **Incidents (section 8):**
  - **IN-1:** a devtools-port collision at 09:42 made this row sign the INVESTIGATOR into **E2E-W1's lane 3 browser**.
  - **IN-2:** a leftover line in the Part A driver pressed **Restart services** once as TECHNICIAN at 10:06:06 on the shared main instance. The press was allowed (200) and the effect was simulated only, but it was not intended.

| Measure | Result | Evidence |
|---|---|---|
| Routes × roles | 14/14 INVESTIGATOR, 14/14 TECHNICIAN. Navigation: 9/9 entries per role, the ADMINISTRATION group absent. Deep links: 14/14 per role | `w2_part_a_<role>.json` `pages`, `checks`; screenshots 02 to 24 per role |
| Matrix checks | INVESTIGATOR 61/62 (1 FAIL = E2E-W2-1). TECHNICIAN 62/62 after re-judging note (a) | §4.1, §4.2 |
| Allowed actions exercised | INVESTIGATOR: 10 (incl. one full Live recording with a note). TECHNICIAN: 8 (incl. IN-2) | §5 |
| Refusals verified (403 + one audit row each) | 9/9 `ACCESS_DENIED` + 2/2 UI `EXPORT_DENIED` | §6 |
| Live propagation (Core row → other console) | start 101 ms, note 24 ms, stop 351 ms, counter 266 ms, archive 431 ms, storage 24 ms / 35 ms; 0 reloads | §7 |
| Origins seen by the browsers | only `http://127.0.0.1:5173` and `ws://127.0.0.1:5173` in every run (inline `data:` images excluded, 2 to 4 per run) | `origins` in each JSON |
| Console | 0 exceptions, 0 `console.error`/`warn` captured. Only lines: the network 401 of the signed-out session probe on Login, and the deliberate 403s | §9 |
| Secrets in this row's files | password 0 of 166 files; token-shaped values 0 | §9 |

## 2. Environment

| Item | Value | Source |
|---|---|---|
| Core server | `http://127.0.0.1:4420`, pid 59871, `dems-core-server 0.2.0`, database `dems_demo`, `demoControls: true` (from `GET /auth/session`), health `ok` at 09:37 | `curl /api/v1/health`; `lsof -iTCP:4420`; `.cache/manual/main-server.log` |
| Web console | Vite 8.3.1 on `http://127.0.0.1:5173`, pid 59858, Live mode preselected, proxy `/api/v1` and `/ws` to 4420 | `.cache/manual/main-web.log`; `lsof -iTCP:5173` |
| Browser | `chrome-headless-shell` HeadlessChrome/153.0.8010.12 (`ms-playwright/chromium_headless_shell-1243`), raw CDP with Node 26.8.2 `WebSocket`; one process per console, fresh profile under `$TMPDIR` (removed after each run); devtools port chosen by the OS and verified as this browser's PID before connecting (after IN-1); `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"`; viewport 1440×900 | `w2_lib.mjs.txt` `launch()` |
| Operators | INVESTIGATOR `budi.santoso` (OPR-001), TECHNICIAN `rina.wijaya` (OPR-003), SUPERVISOR `andi.pratama` (OPR-002). The password was read from README Quick start inside the driver and never printed | `w2_lib.mjs.txt` `passwordOf()` |
| Concurrent row on the same instance | E2E-S (pairing `dems2_phone2` as budi.santoso): `DEV-0001` paired by about 09:49 (tablet link CONNECTED since 09:49:10), revoked 10:08:24, `DEV-0002` re-paired at 10:12:13 | main-server request lines |
| Load guard | `uptime` before each run. 23.98 at 10:00: paused until 12.64 (10:02:30), then continued | command output |
| Vite hot reload during the walk | none. `main-web.log` has only `ws proxy error: read ECONNRESET` at 09:56:16, 10:04:28, 10:06:34 and 10:14:51, the moments this row's full-page navigations closed sockets. No re-sign-in was needed | `main-web.log` |

Run windows (local time, UTC+7):
- INVESTIGATOR walk 09:55:10 to 09:58:21; refusals 09:58:42; recording 09:59:09 to 09:59:52; sign-out 10:00:27.
- TECHNICIAN walk 10:02:44 to 10:06:06; refusals 10:06:37; sign-out 10:06:54.
- Part B 10:12:48 to 10:14:57.
- Below-the-fold supplement: INVESTIGATOR 10:16:44 to 10:17:12, TECHNICIAN 10:17:14 to 10:17:42.

## 3. Method

1. **Sign-in through the Login form** (`login-mode-selector` must read `LIVE`). The origin guard aborts if the page is not at `http://127.0.0.1:5173` before typing and before submitting. The server's role and permission list are then read with `GET /api/v1/auth/session` from the page.
2. **Navigation:** every visible `li[data-id]` of the sidebar is clicked with a real mouse event. The landed path, the page test ID and the current entry are recorded, with one screenshot.
3. **Deep links:** each of the 14 routes is loaded as a typed address (full load). The landed path is recorded, with one screenshot.
4. **Controls against the matrix:** the expected state is derived from `ROLE_PERMISSIONS` (`packages/shared/src/sim/auth.ts:46-72`) and the registry's `access` of the operation behind the control (`packages/shared/src/api/*.ts`, cells in `test/assets/02_rbac_matrix_cells.md` table 1). The observed state is read from the DOM: `disabled`, `aria-disabled`, `data-disabled`, menu items' `aria-disabled`, and presence.
5. **Allowed controls** were pressed once through the UI. Non-destructive where possible: toggles were restored, and Restart services and Install update were deliberately not exercised (see IN-2).
6. **Refusals:** `fetch()` from the page itself (same origin, the page's httpOnly cookie, the browser's own `Origin` header). Only reads and harmless commands were used, so a defect that let a call through would not touch E2E-S: no role, user, pairing, revoke, reset, scenario or fault call.
7. **Part B:** two separate browser processes with separate profiles. In the observing page a watcher (`setInterval` 20 ms) stores `Date.now()` when the change first shows. The delay is measured from the acting console's HTTP 2xx answer, from the click, and from the Core's own audit row `at` (read afterwards as SUPERVISOR). One machine clock throughout. "No reload" is the count of `Document` requests of the observing page during the change: 0 in every row.

## 4. Part A — role walks

Screenshot numbers refer to `test/assets/e2e/w2_roles/NN_<role>_<slug>.png`.

### 4.1 INVESTIGATOR (`budi.santoso`; server permissions `SESSION_START, SESSION_NOTE, EVIDENCE_VIEW, DIAGNOSTICS_RUN`)

| Page | Nav entry | Controls visible / enabled (observed) | Expected per matrix | Result | Screenshot |
|---|---|---|---|---|---|
| Login → shell | — | Live sign-in 200; user menu "AKP Budi Santoso"; 0 script-visible cookies; server role INVESTIGATOR with exactly 4 permissions | Role INVESTIGATOR, 4 grants | PASS | 01 |
| Dashboard `/dashboard` | shown | **Start New Session enabled**. Quick action Export Evidence **disabled** "Requires the Supervisor role"; Run Diagnostics enabled. Camera 1 tile menu: Details enabled, **Test signal disabled** "Requires the Technician role", **Restart disabled** "Requires the Technician role" | SESSION_START ✓ → enabled; EVIDENCE_EXPORT ✗ → disabled; op 49 `testDeviceSignal` = DIAGNOSTICS_RUN ✓ → **enabled**; op 48 = DEVICE_MANAGE ✗ → disabled | **FAIL** (Test signal: E2E-W2-1); the rest PASS | 02, 11, 25 |
| Start New Session `/session/new` | none (reached from Start New Session; not a nav item by design, `nav-items.ts`) | Deep link opens the page. Form, Fill-in case number (op 32), Next (op 24 + op 28), Start (op 25) all usable; investigator field prefilled with self | SESSION_START ✓ → page and commands | PASS | 13, 45–47 |
| Session Monitor `/session` | shown | Start New Session link shown; End Session `data-permitted="true"`. Marker, Note and Snapshot disabled without a recording, **enabled while recording**; note sent 204 | SESSION_START ✓, SESSION_NOTE ✓ | PASS | 03, 12, 48–51, 56 |
| Evidence list `/evidence` | shown | Row menu of EV-20261006-0013: View, Verify, Export enabled; **Archive disabled** | EVIDENCE_VIEW ✓; EVIDENCE_REVIEW ✗ → Archive disabled; Export opens the wizard, and the Core judges EVIDENCE_EXPORT (design D-6, spec §19.3 rule 2) | PASS | 04, 14, 26 |
| Evidence detail `/evidence/EV-20261006-0013` | via list / deep link | Tabs Media, Metadata, Integrity open; More menu **Archive disabled**. **Verify** pressed: `POST …/verify 200`, verdict PASS. **Export** → Reason → **Authorise**: `POST …/export 403`, alert "Export not permitted … recorded in the audit log" | EVIDENCE_VIEW ✓; EVIDENCE_REVIEW ✗; EVIDENCE_EXPORT ✗ → refused by the Core | PASS | 15, 27–33 |
| Devices `/devices` + drawers | shown | Camera 1 menu: Test signal and Identify enabled, **Restart disabled** "Requires the Technician role". MIC 1 Test signal 204; Camera 1 Identify 204. Camera drawer: Overview, Health, Log. Tablet drawer: sentence "A paired device is connected", **no count and no link to Paired Devices** | DIAGNOSTICS_RUN ✓; DEVICE_MANAGE ✗; PAIRING_MANAGE ✗ → no op 19 summary | PASS | 05, 16, 34–40 |
| Storage `/storage` | shown | Manage Storage: the switch can be changed, but **Apply stays disabled** with a changed draft ("Apply policy"); sentence "Requires the Supervisor / Technician role" | op 55 ANY-OF(EVIDENCE_REVIEW, MAINTENANCE): neither held → disabled | PASS | 06, 17, 41 |
| Network & Time `/network-time` | shown | read-only page, no command control | AUTHENTICATED reads only | PASS | 07, 18 |
| Security & Audit `/security-audit` | shown | **Verify chain enabled**, pressed: `GET /audit/chain 200`, "entries linked". **Export audit disabled** "Requires the Supervisor role". Role matrix from the Core shown read-only | op 60 AUTHENTICATED ✓; op 61 AUDIT_EXPORT ✗; op 10 AUTHENTICATED ✓ | PASS | 08, 19, 42, 43, 55 |
| System & Demo Control `/system` | shown ("System & Maintenance") | **Run Diagnostics enabled**, pressed: `POST /system/diagnostics 202`, 8 checks. **Restart services** and **Install update disabled** ("Requires the Technician role"). **Export logs disabled** ("Requires the Supervisor role"). Quick card Export Evidence disabled. **Demo Control Panel absent** (the flag is on) | DIAGNOSTICS_RUN ✓; MAINTENANCE ✗; AUDIT_EXPORT ✗; EVIDENCE_EXPORT ✗; DEMO_CONTROL ✗ | PASS | 09, 20, 44, 53, 54 |
| Users & Roles `/admin/users` | **hidden** (no ADMINISTRATION group) | deep link → `/dashboard` (route guard, replace) | USER_ADMIN ✗ | PASS | 21 |
| Paired Devices `/admin/devices` | **hidden** | deep link → `/dashboard` | PAIRING_MANAGE ✗ | PASS | 22 |
| API Reference `/developer/api` | shown (DEVELOPER) | renders the contract, Copy base URL, Download openapi.json; no Core command | public documentation | PASS | 10, 23 |
| Stack Check `/stack-check` | none (URL only, §14.2) | renders | — | PASS | 24 |
| Sign-out | user menu | menu: Profile, Role: Investigator, Lock console, Sign out. `POST /auth/sign-out 204`, then `GET /auth/session 401`, Login shown | own session only | PASS | 52 |

### 4.2 TECHNICIAN (`rina.wijaya`; server permissions `EVIDENCE_VIEW, DEVICE_MANAGE, DIAGNOSTICS_RUN, MAINTENANCE`)

| Page | Nav entry | Controls visible / enabled (observed) | Expected per matrix | Result | Screenshot |
|---|---|---|---|---|---|
| Login → shell | — | Live sign-in 200; "Rina Wijaya"; server role TECHNICIAN with exactly 4 permissions | as left | PASS | 01 |
| Dashboard | shown | **Start New Session disabled** with the lock chip (`start-new-session-locked`). Export Evidence disabled; Run Diagnostics enabled. Camera 1 menu: Test signal **enabled**, Restart **enabled** | SESSION_START ✗ → cannot start; DIAGNOSTICS_RUN ✓; DEVICE_MANAGE ✓ | PASS (note a) | 02, 11, 25 |
| Start New Session `/session/new` | none | deep link → **`/dashboard`** (route guard) | SESSION_START ✗ | PASS | 13 |
| Session Monitor | shown | **Start New Session link absent**; End Session `data-permitted="false"`; Marker, Note and Snapshot disabled | SESSION_START ✗, SESSION_NOTE ✗ | PASS | 03, 12, 50 |
| Evidence list | shown | Row menu: View, Verify, Export enabled; **Archive disabled** | EVIDENCE_VIEW ✓; EVIDENCE_REVIEW ✗ | PASS | 04, 14, 26 |
| Evidence detail `/evidence/EV-20261006-0014` | via list / deep link | 3 tabs open; Archive disabled. Verify 200 PASS. Export → Authorise → `403`, alert "Export not permitted" | EVIDENCE_VIEW ✓; EVIDENCE_EXPORT ✗ | PASS | 15, 27–33 |
| Devices + drawers | shown | Camera 1 menu: Test signal, Identify, **Restart enabled**. MIC 1 Test signal 204; **Camera 2 Restart 204** ("Camera 2 restarted"). Camera drawer 3 tabs. Tablet drawer: sentence only, no count or link | DEVICE_MANAGE ✓; PAIRING_MANAGE ✗ | PASS | 05, 16, 34–40 |
| Storage | shown | Manage Storage: **Apply enabled** with a changed draft, no role sentence. Auto-archive switched and applied (`POST /storage/policy 200`), then restored (200; `autoArchive: true` read back) | op 55 ANY-OF: MAINTENANCE ✓ | PASS | 06, 17, 41, 42 |
| Network & Time | shown | read-only | — | PASS | 07, 18 |
| Security & Audit | shown | Verify chain enabled, pressed 200 ("132 entries linked"); **Export audit disabled**; role matrix shown | AUDIT_EXPORT ✗ | PASS | 08, 19, 43, 44, 49 |
| System & Demo Control | shown | Run Diagnostics enabled (pressed 202). **Restart services enabled**, **Install update enabled**. **Export logs disabled**. Export Evidence quick card disabled. **Demo Control Panel absent** | MAINTENANCE ✓; AUDIT_EXPORT ✗; DEMO_CONTROL ✗ | PASS (Restart services was pressed by IN-2) | 09, 20, 45, 47, 48 |
| Users & Roles | **hidden** | deep link → `/dashboard` | USER_ADMIN ✗ | PASS | 21 |
| Paired Devices | **hidden** | deep link → `/dashboard` | PAIRING_MANAGE ✗ | PASS | 22 |
| API Reference | shown | renders | — | PASS | 10, 23 |
| Stack Check | none (URL only) | renders | — | PASS | 24 |
| Sign-out | user menu | 204, then 401, Login | own session only | PASS | 46 |

**Note (a), re-judged:** the driver expected the TECHNICIAN's Dashboard **Start New Session** to be *absent*. It is rendered **disabled** inside the lock wrapper (`start-new-session-locked` present, check PASS; `apps/core-web/src/features/dashboard/active-session-panel.tsx:103-152`: "without SESSION_START it is disabled"). A disabled control with a lock is a correct gate for a role without SESSION_START, so the driver's expectation was wrong, not the page. The raw FAIL stays in `w2_part_a_technician.json` as recorded.

## 5. Allowed actions exercised through the UI

| Role | Page | Action (operation) | Answer | Time (local) | Screenshot |
|---|---|---|---|---|---|
| INVESTIGATOR | Evidence detail | Verify package (41) | `POST /evidence/EV-20261006-0013/verify 200`, verdict PASS | 09:57:09 | 31 |
| INVESTIGATOR | Devices | MIC 1 Test signal (49) | 204, toast "Test signal sent to MIC 1" | 09:57:30 | 35 |
| INVESTIGATOR | Devices | Camera 1 Identify (50) | 204, "Camera 1 is blinking its indicator" | 09:57:36 | 36 |
| INVESTIGATOR | Security & Audit | Verify chain (60) | 200 | 09:58:04 | 42 |
| INVESTIGATOR | System | Run Diagnostics (65) | 202, 8 checks | 09:58:14 | 44 |
| INVESTIGATOR | Start New Session | Fill in case number (32) | 200, `LP/2026/1006-0008` | 09:59:09 | 45 |
| INVESTIGATOR | Start New Session | Next: create (24) + pre-check (28) | 201, 202; verdict **pass** (tablet link CONNECTED via E2E-S's DEV-0001) | 09:59:13 | 46 |
| INVESTIGATOR | Start New Session | **Start** (25) | 200 after the 3 s countdown; RECORDING `SES-20261006-0024` | 09:59:23 | 47, 48 |
| INVESTIGATOR | Session Monitor | **Session Note** (35) | 204, "Note added"; timeline "Investigator Note Added" | 09:59:31 | 49 |
| INVESTIGATOR | Session Monitor | **End Session** (26): 1.5 s hold, reason, confirm | 202; SEALED **EV-20261006-0014** 7.2 s after the end | 09:59:41 | 50, 51 |
| TECHNICIAN | Evidence detail | Verify (41) | 200 PASS | 10:04:43 | 31 |
| TECHNICIAN | Devices | MIC 1 Test signal (49) | 204 | 10:05:04 | 35 |
| TECHNICIAN | Devices | **Camera 2 Restart (48)** | 204, "Camera 2 restarted" | 10:05:10 | 36 |
| TECHNICIAN | Storage | Auto-archive off, Apply (55), then on again | 200, 200; restored value `true` | 10:05:30, 10:05:36 | 41, 42 |
| TECHNICIAN | Security & Audit | Verify chain (60) | 200 | 10:05:48 | 43 |
| TECHNICIAN | System | Run Diagnostics (65) | 202 | 10:05:59 | 45 |
| TECHNICIAN | System | Restart services (66), **unintended, IN-2** | 200 | 10:06:06 | — (supplement 47: uptimes restarted) |

Allowed but deliberately not pressed: TECHNICIAN Install update (it would take the shared instance into an update cycle during E2E-S); INVESTIGATOR Marker, Snapshot, Pause (the note was the required one); Lock console. Core request lines for every row of this table: `w2_core_request_lines.log`.

## 6. Refusals — calls the role may not make

Issued from the page's own context (`fetch`, same origin, the page's cookie). The audit rows were read back afterwards **as SUPERVISOR** in console 1 (`GET /api/v1/audit?type=ACCESS_DENIED` from the Security & Audit page, and the page's own search, screenshot `03_live_audit_access_denied_supervisor.png`). Every row: category SECURITY, device null (web console), one row per call.

| Operation | Role | HTTP status | error code | `details` | ACCESS_DENIED row (seq, time, actor) | Core log line (reqId) |
|---|---|---|---|---|---|---|
| `listUsers` GET `/api/v1/admin/users` | INVESTIGATOR | 403 | NOT_PERMITTED | permission USER_ADMIN | **#109** 09:58:42.723, OPR-001 | 09:58:42.740 `ddacef07…` 403 operator:OPR-001 |
| `listPairedDevices` GET `/api/v1/pairing/devices` | INVESTIGATOR | 403 | NOT_PERMITTED | PAIRING_MANAGE | **#110** 09:58:43.161, OPR-001 | 09:58:43.171 `2b3462db…` |
| `restartDevice` POST `/api/v1/device/CAM-01/restart` | INVESTIGATOR | 403 | NOT_PERMITTED | DEVICE_MANAGE | **#111** 09:58:43.592, OPR-001 | 09:58:43.603 `1ba5bca4…` |
| `getDemoStatus` GET `/api/v1/demo/status` | INVESTIGATOR | 403 | NOT_PERMITTED | DEMO_CONTROL | **#112** 09:58:44.044, OPR-001 | 09:58:44.093 `6a307020…` |
| `listUsers` | TECHNICIAN | 403 | NOT_PERMITTED | USER_ADMIN | **#135** 10:06:37.800, OPR-003 | 10:06:37.809 `b50598e6…` |
| `listPairedDevices` | TECHNICIAN | 403 | NOT_PERMITTED | PAIRING_MANAGE | **#136** 10:06:38.234, OPR-003 | 10:06:38.237 `229aa232…` |
| `scanCaseNumber` POST `/api/v1/session/case-number` | TECHNICIAN | 403 | NOT_PERMITTED | SESSION_START | **#137** 10:06:38.694, OPR-003 | 10:06:38.727 `af2f7679…` |
| `addSessionNote` POST `/api/v1/session/SES-99999999-9999/notes` | TECHNICIAN | 403 | NOT_PERMITTED | SESSION_NOTE | **#138** 10:06:39.150, OPR-003 | 10:06:39.157 `b4821d3d…` |
| `getDemoStatus` | TECHNICIAN | 403 | NOT_PERMITTED | DEMO_CONTROL | **#139** 10:06:39.581, OPR-003 | 10:06:39.583 `346328a6…` |
| `exportEvidence` (Export wizard → Authorise, through the UI) | INVESTIGATOR | 403 | FORBIDDEN | EVIDENCE_EXPORT | `EXPORT_DENIED` **#105** 09:57:18.380, OPR-001, `eventKind: UNAUTHORIZED_EXPORT` | 09:57:18.403 `f300bbfa…` |
| `exportEvidence` (UI) | TECHNICIAN | 403 | FORBIDDEN | EVIDENCE_EXPORT | `EXPORT_DENIED` **#128** 10:04:52.123, OPR-003 | 10:04:52.130 `ef5369da…` |

Each `details` also names the `operationId` and the `role` (full bodies: `w2_part_a2_refusals_<role>.json`). For each call the Core logged `"request refused by the access rule"` (level 40) right before the 403 request line. These answers match the matrix cells of `test/assets/02_rbac_matrix_cells.md` table 1 (rows 11, 19, 32, 35, 42, 48, 71).

## 7. Part B — two consoles live

Console 1: SUPERVISOR `andi.pratama`, headless shell pid of run `b_supervisor`. Console 2: INVESTIGATOR `budi.santoso`, run `b_investigator`. Separate processes and separate profiles (`separateProcesses: true` in the JSON); both at `http://127.0.0.1:5173`. Console 1 showed the ADMINISTRATION group (Users & Roles, Paired Devices); console 2 did not. Pre-conditions read before the changes: tablet link `CONNECTED` (E2E-S's re-paired `DEV-0002`), no running session (the last was `SES-20261006-0024` SEALED).

| Change | Made in | Seen in (no reload) | Delay ms: Core row → seen (HTTP 2xx → seen; click → seen) | Result | Screenshots (before → after) |
|---|---|---|---|---|---|
| Session started (`SES-20261006-0025`) | console 2 INVESTIGATOR, Start New Session → Start | console 1 Dashboard, active session panel turns RECORDING | **101** (85; 3,231 incl. the 3 s countdown). Core `RECORDING_STARTED` #152 10:13:34.182, seen 10:13:34.283 | PASS | 05, 06 → 07, 08 |
| Session note "E2E-W2 live note 03:13:43" | console 2, Session Monitor → Session Note | console 1 Session Monitor timeline | **24** (16; 99). `NOTE_ADDED` #155 10:13:45.327, seen 10:13:45.351 | PASS | 09, 10 → 11, 12 |
| Session stopped | console 2, End Session (hold, reason, confirm) | console 1 Dashboard, panel leaves RECORDING (finalizing) | **351** (343; 420). `RECORDING_STOPPED` #157 10:13:58.869, seen 10:13:59.220 | PASS | 13, 14 → 15, 16 |
| Dashboard counter "Sealed evidence today" **8 → 9** | console 2's session sealed by the Core (EV-20261006-0015) | console 1 Dashboard counter | **266** from `EVIDENCE_SEALED` #158 10:14:06.341 (seen 10:14:06.607; console 2 itself showed "Evidence sealed" at 10:14:06.528); 7,807 from the End press, because sealing takes about 7 s by design | PASS | 13, 14 → 17, 18 |
| Evidence review: archive EV-20261006-0015 | console 1 SUPERVISOR, Evidence detail → More → Archive (`POST …/archive 204`) | console 2 Evidence list row "Sealed" → "Archived", filter Archived 1 | **431** (421; 524). `EVIDENCE_ARCHIVED` #160 10:14:18.484, seen 10:14:18.915 | PASS | 19, 20 → 21, 22 |
| Storage state: auto-archive Enabled → Disabled | console 1, Storage → Manage Storage → Apply (`POST /storage/policy 200`) | console 2 Storage page policy list | **24** (18; 97). `STORAGE_POLICY_CHANGED` #161 10:14:31.059 | PASS | 23, 24 → 25, 26 |
| Storage state restored: Disabled → Enabled | console 1, same | console 2, same | **35** (17; 109). #162 10:14:43.242 | PASS | 27, 28 → 29, 30 |

Screenshots are `NN_live_<change>_<console>_<before|after>.png`. All 7 changes are under the 2 s target; the median from the Core row is 101 ms. Reloads of the observing page during each change: 0, from `Document` requests in the network log. Both consoles then signed out their own sessions (`POST /auth/sign-out 204` at 10:14:48.938 and 10:14:55.580, then 401; screenshots 31, 32). E2E-S's own SUPERVISOR session went on undisturbed (its `GET /auth/session 200 operator:OPR-002` at 10:14:51.445).

## 8. Defects, incidents and observations

### Defects

| ID | Severity | Where | Expected vs observed | Repro | Evidence |
|---|---|---|---|---|---|
| **E2E-W2-1** | Low (known **F63-1**, ruled in D152 as "console stays stricter, safe direction", recorded for W83 as a specification question; still a UI-vs-matrix mismatch by this row's rule) | `apps/core-web/src/features/dashboard/devices-panel.tsx:44` (`selectCanManage` = DEVICE_MANAGE gates both items), `:137-138` | Matrix: op 49 `testDeviceSignal` = `DIAGNOSTICS_RUN`, which the INVESTIGATOR holds (and the SUPERVISOR). Dashboard: **Test signal disabled**, "Requires the Technician role". The Devices page offers the same command to the same operator and the Core accepts it | Sign in `budi.santoso` (Live) → Dashboard → Camera 1 tile kebab → "Test signal" greyed out. Then Devices → MIC 1 → Test signal → 204 | `25_investigator_dashboard_camera1_menu.png` (disabled); `35_investigator_devices_mic1_test_signal.png` (accepted); Core: `09:57:30.297 6e3b9de3-bedb-4d0e-9b32-ba2fd780136e POST /api/v1/device/:id/test-signal 204 operator:OPR-001` |

No other mismatch between UI and matrix was found on any of the 28 role-pages.

### Incidents caused by this row (for the controller's record)

| ID | What happened | Effect | Evidence | Action taken |
|---|---|---|---|---|
| **IN-1** (09:42) | This row started its headless shell on fixed devtools port 9431 **one second after another agent session** (parent pid 44482, driver `node recorder.mjs`) had started its own on `127.0.0.1:9431`. This row's browser could only bind `[::1]:9431`, and the row's probe and driver reached the **other row's browser**, whose page was at `http://127.0.0.1:5178` (lane 3, E2E-W1). The sign-in step typed `budi.santoso` into it | Lane 3 (`dems_lane_3`): `POST /api/v1/auth/sign-in 200` at 09:42:09.636 (INVESTIGATOR session in E2E-W1's browser), then `GET /session/current`, `/network/status`, `/auth/session` (200, OPR-001). If E2E-W1 had a session in that page it was rotated out (ID-6). No command, no other change | `lane3-server.log` request lines 09:42:08.234 to 09:42:13.228; `ps` (pid 63921 started 09:41:54, pid 63935 at 09:41:55) | This row's browser was stopped at once and the other browser was never touched again. The lane 3 session was not signed out (it is in the other row's browser; idle expiry about 09:57). The driver now uses `--remote-debugging-port=0`, reads the browser's own "DevTools listening" line, refuses any listener PID that is not its own, and aborts any step whose page is not at 5173. Written to `delegation_progress/e2e_w2_roles.md` at 09:43 |
| **IN-2** (10:06:06) | `w2_part_a.mjs.txt:392`, a leftover `clickSel('[data-testid="system-restart-services"]', 'scroll only')` at the end of the System section. It pressed nothing for INVESTIGATOR (button disabled) but **pressed Restart services** for TECHNICIAN on the shared main instance | `POST /api/v1/system/services/restart 200 operator:OPR-003` (reqId `a0979f3f-a9f7-4f44-b134-4e181d5dfbc8`). The simulated restart only resets the services' `startedAt` and writes one `DEVICE_COMMAND` audit row (`packages/shared/src/sim/maintenance.ts:251-275`). No socket closed and health kept answering (main-server log 10:06:06 to 10:06:34); uptimes read 00:10:48 at 10:16:55 (`53_investigator_system_maintenance_controls.png`) | Core request line; the run's `endedAt` 10:06:06.476 | Allowed for the role (MAINTENANCE), so not a refusal defect; reported because it was not intended on the shared instance. The as-run driver is kept unchanged for traceability |

### Other deviations and observations

| ID | Note |
|---|---|
| DV-1 | **Extra runs on the main instance before the recorded walk:** an exploration session as INVESTIGATOR (sign-in 09:44:20; page visits and one storage switch toggled without Apply; expired idle 09:59:20, "Sign-in expired" row) and a scratch trial walk as INVESTIGATOR 09:50:24 to 09:53:24 (same actions as the recorded walk: verify EV-0013 200, export 403 = `EXPORT_DENIED` #98, test signal 204, identify 204, verify chain, diagnostics 202). The trial browser was closed without a sign-out, so that session was left to its idle expiry (about 10:08). Trial screenshots were deleted; its Core lines are at the top of `w2_core_request_lines.log` |
| DV-2 | **State this row left on `dems_demo`:** two Live recordings sealed (EV-20261006-0014 by the INVESTIGATOR walk, EV-20261006-0015 by Part B), EV-20261006-0015 archived (this row's own item), and verify, test signal, identify, restart (CAM-02), diagnostics and IN-2 rows in the audit chain. Storage auto-archive restored to Enabled twice and read back. No seeded item was changed except the verify rows of EV-0013 and EV-0014 |
| DV-3 | The session-flow steps polled `GET /api/v1/session/current` from the page context to know when the state changed. Those requests are the driver's, not the app's (visible in `w2_part_a3_session_investigator.json` and the Part B request lists) |
| DV-4 | Screenshot numbering restarts at 01 for each role (`NN_<role>_…`) and for Part B (`NN_live_…`). Part B's sign-in, audit and sign-out shots were renamed after the run from `NN_<role>_…` to `NN_live_…`, and the JSON references were updated in the same step |
| O-1 | Export is **enabled** on the Evidence pages for roles without EVIDENCE_EXPORT, while the Dashboard and System quick card "Export Evidence" is disabled. This is by design: the wizard asks the Core, which refuses and audits (spec §19.3 rule 2, W69 D-6). It was observed working (403 + `EXPORT_DENIED`). Not counted as a defect |
| O-2 | Low, logging only. When a page is replaced by a full navigation while `POST /api/v1/auth/touch` is in flight, the old page logs "The Core server did not answer" / `CORE_OFFLINE` at error level (forwarded by Vite at 10:14:51, `main-web.log`), although the Core answered 200 (10:14:51.261 `operator:OPR-001`). Seen once, caused by this driver's own reload of console 2 before its sign-out (request `POST /auth/touch` with no status at 03:14:51.224Z in `w2_part_b_two_consoles.json`). No user-visible effect |

## 9. Network, console and secrets

- **Origins:** every run's request list contains only `http://127.0.0.1:5173` (documents, Vite modules, `/api/v1/*`) and `ws://127.0.0.1:5173` (Vite HMR socket and `/ws` realtime). `localhost` was never used; the resolver rules would have failed it. Inline `data:` images (2 to 4 per run) are not network requests and are counted apart.
- **Console:** INVESTIGATOR walk: 1 network 401 + 1 network 403. TECHNICIAN walk: the same. Part B: 2 network 401 per console. Supplements: 2 network 401 each. The 401 is `GET /api/v1/auth/session` on the Login page before sign-in; the 403s are the deliberate refusals and exports. **0 exceptions, 0 `console.error` and 0 `console.warn`** captured in any run (also O-2, which was emitted by a page being unloaded and reached only Vite's terminal).
- **Secrets:** a scan of all 166 files this row wrote (assets, the progress file and this report) found the demo password in 0 files and token-shaped values (`ses_`, `dvc_`, `bio_`) in 0 files. The sign-in request body is never recorded. The Login "Demo operators" disclosure was never opened. No pairing code was shown: Paired Devices was never opened.

## 10. Files

Under `test/assets/e2e/w2_roles/`:
- **Drivers (as run, `.txt`):** `w2_lib.mjs.txt` (CDP library, after the IN-1 fix), `w2_part_a.mjs.txt` (role walk; line 392 = IN-2), `w2_part_a_supplement.mjs.txt`, `w2_part_b.mjs.txt`, `w2_launch.mjs.txt`, `w2_run.mjs.txt`, steps `s_refusals.mjs.txt`, `s_session_flow.mjs.txt`, `s_signout.mjs.txt`, and the exploration steps `s_signin_inv/s_explore/s_tablet/s_link/s_switch.mjs.txt`. To run: copy without `.txt`, then `TMPDIR=… node w2_part_a.mjs <ROLE> <assetsDir>`.
- **Data:** `w2_part_a_<role>.json` (checks, pages, controls, every request), `w2_part_a2_refusals_<role>.json`, `w2_part_a3_session_investigator.json`, `w2_part_a4_signout_<role>.json`, `w2_part_a5_supplement_<role>.json`, `w2_part_b_two_consoles.json`.
- **Logs:** `w2_driver.log` (sanitised step log) and `w2_core_request_lines.log` (Core request lines, request fields only).
- **Screenshots:** 138 PNG files (INVESTIGATOR 56, TECHNICIAN 50, Part B 32), indexed below.

## 11. Screenshot index

### Part A, INVESTIGATOR (56)

| File | Caption |
|---|---|
| `01_investigator_dashboard_after_sign_in.png` | INVESTIGATOR signed in through the Login form, Live mode, Dashboard |
| `02_investigator_dashboard.png` | INVESTIGATOR: /dashboard opened through the navigation entry "dashboard" |
| `03_investigator_session.png` | INVESTIGATOR: /session opened through the navigation entry "session" |
| `04_investigator_evidence.png` | INVESTIGATOR: /evidence opened through the navigation entry "evidence" |
| `05_investigator_devices.png` | INVESTIGATOR: /devices opened through the navigation entry "devices" |
| `06_investigator_storage.png` | INVESTIGATOR: /storage opened through the navigation entry "storage" |
| `07_investigator_network_time.png` | INVESTIGATOR: /network-time opened through the navigation entry "network-time" |
| `08_investigator_security_audit.png` | INVESTIGATOR: /security-audit opened through the navigation entry "security-audit" |
| `09_investigator_system.png` | INVESTIGATOR: /system opened through the navigation entry "system" |
| `10_investigator_api_reference.png` | INVESTIGATOR: /developer/api opened through the navigation entry "api-reference" |
| `11_investigator_dashboard_deeplink.png` | INVESTIGATOR: address /dashboard typed (full load) → /dashboard |
| `12_investigator_session_deeplink.png` | INVESTIGATOR: address /session typed (full load) → /session |
| `13_investigator_session_new_deeplink.png` | INVESTIGATOR: address /session/new typed (full load) → /session/new |
| `14_investigator_evidence_deeplink.png` | INVESTIGATOR: address /evidence typed (full load) → /evidence |
| `15_investigator_evidence_detail_deeplink.png` | INVESTIGATOR: address /evidence/EV-20261006-0013 typed (full load) → /evidence/EV-20261006-0013 |
| `16_investigator_devices_deeplink.png` | INVESTIGATOR: address /devices typed (full load) → /devices |
| `17_investigator_storage_deeplink.png` | INVESTIGATOR: address /storage typed (full load) → /storage |
| `18_investigator_network_time_deeplink.png` | INVESTIGATOR: address /network-time typed (full load) → /network-time |
| `19_investigator_security_audit_deeplink.png` | INVESTIGATOR: address /security-audit typed (full load) → /security-audit |
| `20_investigator_system_deeplink.png` | INVESTIGATOR: address /system typed (full load) → /system |
| `21_investigator_admin_users_deeplink.png` | INVESTIGATOR: address /admin/users typed (full load) → /dashboard |
| `22_investigator_admin_devices_deeplink.png` | INVESTIGATOR: address /admin/devices typed (full load) → /dashboard |
| `23_investigator_developer_api_deeplink.png` | INVESTIGATOR: address /developer/api typed (full load) → /developer/api |
| `24_investigator_stack_check_deeplink.png` | INVESTIGATOR: address /stack-check typed (full load) → /stack-check |
| `25_investigator_dashboard_camera1_menu.png` | INVESTIGATOR: Dashboard, Camera 1 tile menu |
| `26_investigator_evidence_row_menu.png` | INVESTIGATOR: Evidence list, row menu of EV-20261006-0013 (SEALED) |
| `27_investigator_evidence_detail_tab_media.png` | INVESTIGATOR: Evidence EV-20261006-0013, tab media |
| `28_investigator_evidence_detail_tab_metadata.png` | INVESTIGATOR: Evidence EV-20261006-0013, tab metadata |
| `29_investigator_evidence_detail_tab_integrity.png` | INVESTIGATOR: Evidence EV-20261006-0013, tab integrity |
| `30_investigator_evidence_detail_more_menu.png` | INVESTIGATOR: Evidence detail, More menu |
| `31_investigator_evidence_detail_verify_done.png` | INVESTIGATOR: Evidence EV-20261006-0013, Verify pressed (allowed: EVIDENCE_VIEW) |
| `32_investigator_evidence_export_wizard_reason.png` | INVESTIGATOR: Export wizard opened, Reason step |
| `33_investigator_evidence_export_denied.png` | INVESTIGATOR: Export wizard, Authorise → the Core refuses (EXPORT_DENIED), denied alert |
| `34_investigator_devices_camera1_menu.png` | INVESTIGATOR: Devices, Camera 1 menu |
| `35_investigator_devices_mic1_test_signal.png` | INVESTIGATOR: Devices, MIC 1 → Test signal (allowed: DIAGNOSTICS_RUN) |
| `36_investigator_devices_camera1_identify.png` | INVESTIGATOR: Devices, Camera 1 → Identify (allowed: DIAGNOSTICS_RUN) |
| `37_investigator_devices_drawer_overview.png` | INVESTIGATOR: Devices, Camera 1 drawer, tab overview |
| `38_investigator_devices_drawer_health.png` | INVESTIGATOR: Devices, Camera 1 drawer, tab health |
| `39_investigator_devices_drawer_log.png` | INVESTIGATOR: Devices, Camera 1 drawer, tab log |
| `40_investigator_devices_drawer_tablet.png` | INVESTIGATOR: Devices, tablet drawer, "Paired devices" row |
| `41_investigator_storage_manage_drawer_changed.png` | INVESTIGATOR: Storage, Manage drawer with the auto-archive switch changed |
| `42_investigator_security_audit_verify_chain.png` | INVESTIGATOR: Security & Audit, Verify chain pressed (allowed: AUTHENTICATED) |
| `43_investigator_security_audit_role_matrix.png` | INVESTIGATOR: Security & Audit, role matrix from the Core (read-only) |
| `44_investigator_system_run_diagnostics.png` | INVESTIGATOR: System, Run Diagnostics pressed (allowed: DIAGNOSTICS_RUN) |
| `45_investigator_session_new_filled.png` | INVESTIGATOR: Start New Session, step 1 filled (case number from the Core, subject, investigator = self) |
| `46_investigator_session_new_precheck.png` | INVESTIGATOR: Start New Session, step 2, the Core's pre-check verdict: pass |
| `47_investigator_session_new_ready.png` | INVESTIGATOR: Start New Session, step 3 ready |
| `48_investigator_session_monitor_recording.png` | INVESTIGATOR: Session Monitor while recording |
| `49_investigator_session_note_added.png` | INVESTIGATOR: Session Note submitted (op 35) |
| `50_investigator_session_end_dialog.png` | INVESTIGATOR: End Session dialog after the 1.5 s hold |
| `51_investigator_session_sealed.png` | INVESTIGATOR: session ended and sealed (op 26), finalization |
| `52_investigator_signed_out_login.png` | INVESTIGATOR: signed out through the user menu (own session), Login page |
| `53_investigator_system_maintenance_controls.png` | INVESTIGATOR: System, Diagnostics & Maintenance panel scrolled into view (Run diagnostics / Restart services / Export logs) |
| `54_investigator_system_update_panel.png` | INVESTIGATOR: System, Software update panel (Install update) |
| `55_investigator_security_audit_export_control.png` | INVESTIGATOR: Security & Audit, audit log toolbar with Export audit |
| `56_investigator_session_monitor_action_bar.png` | INVESTIGATOR: Session Monitor without a session: action bar and Start New Session link |

### Part A, TECHNICIAN (50)

| File | Caption |
|---|---|
| `01_technician_dashboard_after_sign_in.png` | TECHNICIAN signed in through the Login form, Live mode, Dashboard |
| `02_technician_dashboard.png` | TECHNICIAN: /dashboard opened through the navigation entry "dashboard" |
| `03_technician_session.png` | TECHNICIAN: /session opened through the navigation entry "session" |
| `04_technician_evidence.png` | TECHNICIAN: /evidence opened through the navigation entry "evidence" |
| `05_technician_devices.png` | TECHNICIAN: /devices opened through the navigation entry "devices" |
| `06_technician_storage.png` | TECHNICIAN: /storage opened through the navigation entry "storage" |
| `07_technician_network_time.png` | TECHNICIAN: /network-time opened through the navigation entry "network-time" |
| `08_technician_security_audit.png` | TECHNICIAN: /security-audit opened through the navigation entry "security-audit" |
| `09_technician_system.png` | TECHNICIAN: /system opened through the navigation entry "system" |
| `10_technician_api_reference.png` | TECHNICIAN: /developer/api opened through the navigation entry "api-reference" |
| `11_technician_dashboard_deeplink.png` | TECHNICIAN: address /dashboard typed (full load) → /dashboard |
| `12_technician_session_deeplink.png` | TECHNICIAN: address /session typed (full load) → /session |
| `13_technician_session_new_deeplink.png` | TECHNICIAN: address /session/new typed (full load) → /dashboard |
| `14_technician_evidence_deeplink.png` | TECHNICIAN: address /evidence typed (full load) → /evidence |
| `15_technician_evidence_detail_deeplink.png` | TECHNICIAN: address /evidence/EV-20261006-0014 typed (full load) → /evidence/EV-20261006-0014 |
| `16_technician_devices_deeplink.png` | TECHNICIAN: address /devices typed (full load) → /devices |
| `17_technician_storage_deeplink.png` | TECHNICIAN: address /storage typed (full load) → /storage |
| `18_technician_network_time_deeplink.png` | TECHNICIAN: address /network-time typed (full load) → /network-time |
| `19_technician_security_audit_deeplink.png` | TECHNICIAN: address /security-audit typed (full load) → /security-audit |
| `20_technician_system_deeplink.png` | TECHNICIAN: address /system typed (full load) → /system |
| `21_technician_admin_users_deeplink.png` | TECHNICIAN: address /admin/users typed (full load) → /dashboard |
| `22_technician_admin_devices_deeplink.png` | TECHNICIAN: address /admin/devices typed (full load) → /dashboard |
| `23_technician_developer_api_deeplink.png` | TECHNICIAN: address /developer/api typed (full load) → /developer/api |
| `24_technician_stack_check_deeplink.png` | TECHNICIAN: address /stack-check typed (full load) → /stack-check |
| `25_technician_dashboard_camera1_menu.png` | TECHNICIAN: Dashboard, Camera 1 tile menu |
| `26_technician_evidence_row_menu.png` | TECHNICIAN: Evidence list, row menu of EV-20261006-0014 (SEALED) |
| `27_technician_evidence_detail_tab_media.png` | TECHNICIAN: Evidence EV-20261006-0014, tab media |
| `28_technician_evidence_detail_tab_metadata.png` | TECHNICIAN: Evidence EV-20261006-0014, tab metadata |
| `29_technician_evidence_detail_tab_integrity.png` | TECHNICIAN: Evidence EV-20261006-0014, tab integrity |
| `30_technician_evidence_detail_more_menu.png` | TECHNICIAN: Evidence detail, More menu |
| `31_technician_evidence_detail_verify_done.png` | TECHNICIAN: Evidence EV-20261006-0014, Verify pressed (allowed: EVIDENCE_VIEW) |
| `32_technician_evidence_export_wizard_reason.png` | TECHNICIAN: Export wizard opened, Reason step |
| `33_technician_evidence_export_denied.png` | TECHNICIAN: Export wizard, Authorise → the Core refuses (EXPORT_DENIED), denied alert |
| `34_technician_devices_camera1_menu.png` | TECHNICIAN: Devices, Camera 1 menu |
| `35_technician_devices_mic1_test_signal.png` | TECHNICIAN: Devices, MIC 1 → Test signal (allowed: DIAGNOSTICS_RUN) |
| `36_technician_devices_camera2_restart.png` | TECHNICIAN: Devices, Camera 2 → Restart (allowed: DEVICE_MANAGE) |
| `37_technician_devices_drawer_overview.png` | TECHNICIAN: Devices, Camera 1 drawer, tab overview |
| `38_technician_devices_drawer_health.png` | TECHNICIAN: Devices, Camera 1 drawer, tab health |
| `39_technician_devices_drawer_log.png` | TECHNICIAN: Devices, Camera 1 drawer, tab log |
| `40_technician_devices_drawer_tablet.png` | TECHNICIAN: Devices, tablet drawer, "Paired devices" row |
| `41_technician_storage_manage_drawer_changed.png` | TECHNICIAN: Storage, Manage drawer with the auto-archive switch changed |
| `42_technician_storage_policy_applied.png` | TECHNICIAN: Storage, auto-archive changed and applied (allowed: MAINTENANCE) |
| `43_technician_security_audit_verify_chain.png` | TECHNICIAN: Security & Audit, Verify chain pressed (allowed: AUTHENTICATED) |
| `44_technician_security_audit_role_matrix.png` | TECHNICIAN: Security & Audit, role matrix from the Core (read-only) |
| `45_technician_system_run_diagnostics.png` | TECHNICIAN: System, Run Diagnostics pressed (allowed: DIAGNOSTICS_RUN) |
| `46_technician_signed_out_login.png` | TECHNICIAN: signed out through the user menu (own session), Login page |
| `47_technician_system_maintenance_controls.png` | TECHNICIAN: System, Diagnostics & Maintenance panel scrolled into view (Run diagnostics / Restart services / Export logs) |
| `48_technician_system_update_panel.png` | TECHNICIAN: System, Software update panel (Install update) |
| `49_technician_security_audit_export_control.png` | TECHNICIAN: Security & Audit, audit log toolbar with Export audit |
| `50_technician_session_monitor_action_bar.png` | TECHNICIAN: Session Monitor without a session: action bar and Start New Session link |

### Part B, two consoles (32)

| File | Caption |
|---|---|
| `01_live_sign_in_supervisor.png` | Console 1 SUPERVISOR andi.pratama signed in (ADMINISTRATION group visible) |
| `02_live_sign_in_investigator.png` | Console 2 INVESTIGATOR budi.santoso signed in (no ADMINISTRATION group) |
| `03_live_audit_access_denied_supervisor.png` | SUPERVISOR: Security & Audit, audit log searched for "Access denied": the refusals of Part A (INVESTIGATOR and TECHNICIAN) |
| `04_live_audit_export_denied_supervisor.png` | SUPERVISOR: Security & Audit, audit log searched for "Export denied": the two Export wizard attempts of Part A |
| `05_live_session_start_supervisor_before.png` | SUPERVISOR Dashboard before the start (active session panel: setup) |
| `06_live_session_start_investigator_before.png` | INVESTIGATOR ready to press Start |
| `07_live_session_start_supervisor_after.png` | SUPERVISOR Dashboard after the start, no reload: active session panel RECORDING |
| `08_live_session_start_investigator_after.png` | INVESTIGATOR after Start (countdown, then recording) |
| `09_live_session_note_supervisor_before.png` | SUPERVISOR Session Monitor before the note |
| `10_live_session_note_investigator_before.png` | INVESTIGATOR note drawer with "E2E-W2 live note 03:13:43" typed |
| `11_live_session_note_supervisor_after.png` | SUPERVISOR Session Monitor after the note, no reload: the timeline shows "E2E-W2 live note 03:13:43" |
| `12_live_session_note_investigator_after.png` | INVESTIGATOR after Submit ("Note added") |
| `13_live_session_stop_supervisor_before.png` | SUPERVISOR Dashboard before the stop (RECORDING; sealed today 8) |
| `14_live_session_stop_investigator_before.png` | INVESTIGATOR End Session dialog |
| `15_live_session_stop_supervisor_after.png` | SUPERVISOR Dashboard after the stop, no reload: active session panel FINALIZING/SEALED |
| `16_live_session_stop_investigator_after.png` | INVESTIGATOR finalization after End Session |
| `17_live_dashboard_counter_supervisor_after.png` | SUPERVISOR Dashboard, no reload: Sealed evidence today 8 → 9 |
| `18_live_dashboard_counter_investigator_after.png` | INVESTIGATOR: Evidence sealed (finalization done) |
| `19_live_evidence_archive_supervisor_before.png` | SUPERVISOR evidence EV-20261006-0015, More menu open (Archive enabled: EVIDENCE_REVIEW) |
| `20_live_evidence_archive_investigator_before.png` | INVESTIGATOR Evidence list before the review: EV-20261006-0015 Sealed |
| `21_live_evidence_archive_supervisor_after.png` | SUPERVISOR after Archive (op 43): EV-20261006-0015 Archived |
| `22_live_evidence_archive_investigator_after.png` | INVESTIGATOR Evidence list, no reload: EV-20261006-0015 Archived |
| `23_live_storage_policy_change_supervisor_before.png` | SUPERVISOR Manage Storage, auto-archive switched (change) |
| `24_live_storage_policy_change_investigator_before.png` | INVESTIGATOR Storage page before: auto-archive Enabled |
| `25_live_storage_policy_change_supervisor_after.png` | SUPERVISOR after Apply (op 55, change) |
| `26_live_storage_policy_change_investigator_after.png` | INVESTIGATOR Storage page, no reload: auto-archive Enabled → Disabled |
| `27_live_storage_policy_restore_supervisor_before.png` | SUPERVISOR Manage Storage, auto-archive switched (restore) |
| `28_live_storage_policy_restore_investigator_before.png` | INVESTIGATOR Storage page before: auto-archive Disabled |
| `29_live_storage_policy_restore_supervisor_after.png` | SUPERVISOR after Apply (op 55, restore) |
| `30_live_storage_policy_restore_investigator_after.png` | INVESTIGATOR Storage page, no reload: auto-archive Disabled → Enabled |
| `31_live_signed_out_supervisor.png` | SUPERVISOR console signed out (own session), Login page |
| `32_live_signed_out_investigator.png` | INVESTIGATOR console signed out (own session), Login page |


---
*Generated: 2026-10-06 10:25*
*Last Updated: 2026-10-06 10:25*
