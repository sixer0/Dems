---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W69 (plan step 91)
agent: coder-execution
date: 2026-10-05
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row W69, gate CLG of §11)
status: complete
tier: 2
---

# W69 — Web Evidence in Live mode

Settle sites A5, A6, B-1, C-5, D-1 and D-6 of the Evidence page run through `useCoreActions()` and
`settle`; every error goes to the refusal presenter first; in Live mode the integrity verdict shown
is the Core server's `EvidenceVerifyResult` (operation 41), never computed or assumed here
[CS:§8.2 A5, A6; §8.3 B-1; §8.4 C-5, D-1, D-6; §14 point 7; SP:MS-2, MS-5; AC-C-48, AC-C-61].
Simulated mode keeps its behaviour: the folder's own tests are byte-equal to `acaff20` and pass.

Citation convention as in `masterplan/02_plan.md` (about line 81). Code is cited as `path:line`
relative to `/Users/gsp-budi/Documents/DEMS/`; `F` below is `apps/core-web/src/features/evidence/`.

## 1. Result

| Gate item | Result | Evidence |
|---|---|---|
| SG: typecheck, lint of `@dems/core-web` | exit 0, exit 0 | §9.3 |
| CLG (a): the folder's existing tests pass, their files absent from `git diff --stat acaff20` | 4 files / 28 tests pass; the diff of the five files is empty | §9.1, `assets/69_clg_a_c.log` |
| CLG (b): one Live test per settle site (success, refusal with the denied toast or Alert, outage) | 3 new files, 35 tests, all green (row run 8 files / 72 tests, 23:36) | §6 |
| CLG (c): no `useSimActions`, no `.actions` read on a `Sim` in the production files | 0 and 0 (grep), and a static test | §7 |
| CLG (d): lane 3, at most 10 minutes, screenshots | 23:17:23 to 23:18:31 (1 min 8 s), 7 screenshots, ports 4423/5178/9398 free after | §8 |
| Row verification: "the fake transport's log shows that verification called operation 41 and no demo operation" | asserted in four tests (`live-evidence-verify.test.tsx`), and on the real server (lane: one `POST …/verify` per press, no `/demo` request) | §6, §8 |
| Whole web suite at or above the floor (62 / 853 at 22:46) | **71 files / 958 tests, exit 0** (23:32:34); no red file | §9.2 |
| `@dems/shared` suite; its typecheck and lint (one file written) | **68 / 1,814, exit 0**; exit 0, exit 0 | §9.4 |
| Mutation check (M15) | 29 mutations, 29 detected, 0 survived | §9.5 |

## 2. What was written

| File | Change | Why |
|---|---|---|
| `F/use-verification.ts` | Live branch of `run()` (`:300-344`): one `settle(() => actions.verify(id))` (`:256-262`), the Core's checks revealed at the old pace (`resultChecks(…, 'core')`), the verdict `coreResult.ok` (`:335`); the bundled-package check beside it for display only (`:304-320`), compared by `bundledDiffers` (`:158`); presenter first (`refused`, `:264-269`). The Simulated paths are unchanged in effect; their one `verify` call also goes through `settle` | A6, D-1, §14 point 7, rule 1, rule 2 |
| `F/sim-adapter.ts` | `recordPackageVerification(actions, state, …, onError)` (`:83-101`): takes the actions object of `useCoreActions()` and runs the mirror through `settle`; Simulated mode only | AC-C-53 (no `.actions` read on a `Sim`), D-1 |
| `F/use-evidence-media.ts` (new) | Operation 40 through `useWebLive()?.client.call('getEvidence', …)` (`:74`) in a query under the Core root (`:32-34`); `rowForMedia` (`:95-104`) gives the row a package only when the Core says `DEMO_PACKAGE` | MS-2; rule 1, rule 3 |
| `F/use-archive.ts` (new) | `settle(() => actions.archiveEvidence(id))` (`:46`), presenter first (`:51`), not-sealed warning, record and failure toast otherwise | B-1 |
| `F/use-pending-action.ts` (new) | Busy at once, spinner after `LIVE_PENDING_REVEAL_MS × timeScale`; nothing happens when the action settles in the press (Simulated) | LB-1, LB-2, AC-C-57/58 |
| `F/export-outcome.ts` (new) | Pure helpers: the failure sentence by the presenter's notice (its own words), `everyExportDenied`, `reasonRefused`, `anyExportPastGuard` | A5, D-6, LB-6, LB-10 |
| `F/export-wizard.tsx` | `exportOne` (`:151-168`): one export through `settle`, presenter first; Authorise for a role without the permission: nested `settle` in row order (`:199-232`); Export (`:234-267`): nested `settle` in row order, C-5 read of the audit row (`:171-182`), 403 → denied Alert, 422 → Reason step; busy marks on the step panels (`:355`, `:418`); the source check's start waits one task (`:618-624`) | A5, C-5, D-6, F59, LB-1 |
| `F/detail-page.tsx` | Archive via `useArchiveEvidence`; the body waits behind a skeleton for the media reference (`:57-75`); the row by `rowForMedia` (`:93`); the package chip says "Core record" / "Media reference unavailable" in Live mode; `aria-busy` on the action row (`:273`); the arrival verification's start waits one task (`:106-112`) | B-1, MS-2, §3.2, LB-1 |
| `F/list-page.tsx`, `F/evidence-table.tsx` | Archive via the same hook; `aria-busy` on the table wrapper and the row trigger's late spinner (`evidence-table.tsx:93-102`) | B-1, LB-1 |
| `F/integrity-tab.tsx` | Live words for the verdict card, the bundled line (`data-testid="evidence-bundled"`), the info Alert when the two differ, "Core record" on the values' chip | A6, §14 point 7, §3.2 |
| `F/log.ts` | Records go to `webErrorSink` with a fixed sentence and the error's class, code, status (the CPW1-8 discipline, as W63, W64, W65) | error logging rule; CPW1-8 |
| `F/evidence.css` | `.evi-bundled` (11 lines) | the bundled line |
| `packages/shared/src/i18n/en/evidence.ts` | Additive: `evidence.live.*` (14 keys) | rule 8 (own namespace) |
| `F/__tests__/live-evidence-bed.ts` (new) | The Live helpers of the three test files, built on W50's harness | tests |
| `apps/core-web/src/test/live-evidence-{verify,export,archive}.test.tsx` (new) | 12 + 10 + 13 tests | CLG (b), (c) |

No file outside the row's write paths was changed. `routeTree.gen.ts` was not touched by hand.

## 3. The settle sites

| Site | Live behaviour built | Simulated mode |
|---|---|---|
| **A6** `verify` | One request of operation 41; while it is out the first check shows the Spinner; the answer's six checks (four tracks, manifest, signature) are revealed one per `VERIFY_STEP_MS` with the hash scramble (LB-2); chip, list and toast are the Core's; the custody entry arrives with the answer's delta (CL-16) | Unchanged (package verification, simulator record) |
| **D-1** | Never `inject`: the Live branch does not call `recordPackageVerification`; asserted by a test in which the bundled copy fails where the Core's record passes (the Simulated mirror would inject there) | Unchanged |
| **§14 point 7** | The bundled check runs only for `DEMO_PACKAGE` (the detail page's row has a package only then), labelled "Bundled demo package", writes nothing; when it differs: "The bundled demo package differs from the Core's record. The Core's verdict is the record." (the specification's sentence) | — |
| **A5** `exportEvidence` | Waiting: the Export step stays on its pipeline step, panel `aria-busy`, spinner late. 202 → accepted with the Core's export ID; 403 for every row → the denied Alert (the Core wrote `EXPORT_DENIED`); 422 → back to Reason, the reason kept, "The Core server did not accept this reason. Change it and try again."; 404/409 → the existing sentence; no answer → the presenter's toast and the row's failure state with the presenter's own sentence (LB-6), no second toast of the page | Unchanged (the 403/422 branches are gated on Live mode; a thrown error keeps its old fallback) |
| **C-5** | The audit row of the export is read from the replica after the answer (`latestAuditRowFor`), which holds it at the answer's revision | Unchanged |
| **D-6** | A role without `EVIDENCE_EXPORT` presses Authorise: one export per selected row, nested `settle` in row order; each refusal is the Core's 403 with its guard row; a 429 past the denial budget is shown once (LB-10); then the denied Alert. If the Core lets a call through (the permission hint was out of date), its answers are shown as the result | Unchanged (the denied state, as before) |
| **B-1** `archiveEvidence` | The menu closes at the press; the action row (detail) or the table wrapper (list) is `aria-busy`; the trigger shows the kit's spinner after the reveal time; Archive is disabled while out; 204 → the chip has morphed with the delta, then the toast; 403 → the presenter's denied toast naming the Supervisor (AC-C-48); 409 → the not-sealed warning; outage/429 → the presenter | Settles in the press; same toasts |

## 4. MS-2: the media reference (operation 40)

The detail page asks operation 40 once per item (query key `['core','evidence-media', id]`, built
from the exported `CORE_QUERY_KEY`, so the bridge removes it at every session end and refetches it
after a resynchronisation). While it is on its way the body shows its skeleton (no media that
appears and vanishes). `DEMO_PACKAGE` → the bundled package of the Core's suffix (the guarded join's
package when the suffixes agree); `NONE` → no package, no media, no bundled check, the chip says
"Core record"; no answer → the presenter's toast, no package, the chip says "Media reference
unavailable", and the Core's verdict still works. On the lane the Core answered `DEMO_PACKAGE 0005`
for its `EV-20261003-0005` (§8).

## 5. Simulated mode

The folder's tests (`__tests__/evidence-{export,integrity,media}.test.tsx`, `__tests__/harness.ts`,
`src/test/evidence-table.test.tsx`) are byte-equal to `acaff20` and pass (§9.1). What the row changed
on the Simulated path, each without an observable difference:

| Change | Why it is not observable |
|---|---|
| The actions come from `useCoreActions()` (the simulator's own object) and run in `settle` | `settle` runs a plain value's handlers before it returns (CL-25) |
| The Simulated non-package `verify` continues after one `await` | One microtask; the simulator's record is written in the press as before |
| Archive: the presenter speaks first | A `SimPermissionError` cannot reach it: the menu item is disabled for a role without `EVIDENCE_REVIEW` (`detail-page.tsx`, `evidence-table.tsx` `disabledKeys`). A `SimTransitionError` passes the presenter untouched (row 14) to the existing warning |
| Mount-time verification (wizard source check, list hand-off) starts after one task | Under StrictMode it removes a duplicate simulator verification in dev (§10 F69-1); in production one `setTimeout(…, 0)` |
| `log.ts` writes to the page sink | Records were dev-console only before; the sink prints them to the console in dev |

The lane's Simulated pass (§8): `SIMULATED` chip, no request to `/api/v1`, no socket to the dev
server's `/ws`, the package verification "DEMO - recomputed".

## 6. Tests (CLG (b)) — `apps/core-web/src/test/live-evidence-*.test.tsx`

Each file has the page address `http://127.0.0.1:5178/` in its docblock, calls `clearToasts()`
between tests, and scopes toast queries to `[data-slot="toast"]` (rule 5).

| Site | Success | Refusal | Outage / limit | File |
|---|---|---|---|---|
| A6 | PASS from the Core: one POST to `/api/v1/evidence/{id}/verify`, six `data-source="core"` rows, VERIFIED custody from the delta, no demo request, no "simulat" word on the card; FAIL on exactly the Core's track | 403 NOT_PERMITTED → denied toast naming the Investigator; no verdict toast; no page record | `failOnce` → offline toast, ERROR, Retry; 429 → limit toast, no OFFLINE | verify |
| D-1 / §14 p.7 | bundled PASS vs Core FAIL → notice, verdict FAIL; agree → no notice; bundled FAIL vs Core PASS → notice, verdict PASS, `injectFault` 0, the page's calls are exactly `getEvidence`, `verifyEvidence` | — | — | verify |
| MS-2 | NONE → "Core record", no media | — | op 40 outage → "Media reference unavailable", offline toast, the Core's verdict still PASS | verify |
| StrictMode | list hand-off and wizard source check each send ONE request of operation 41 | — | — | verify |
| A5 + C-5 | 202: one POST with reason and destination, the Core's `EXP-000031`, the audit row `AUD-000083` and its hash from the delta, success toast; the source verified by the Core first | 403 → denied Alert; 422 → Reason step, reason kept, refusal on the field, cleared on typing | `failOnce` → one toast in all, the row's failure with the LB-6 sentence; 429 → its sentence on the row | export |
| A5 pending | step `aria-busy`, a second press sends nothing, spinner after the reveal time | — | — | export |
| D-6 | three POSTs in row order, each 403 → denied Alert | — | 429 past the budget → one limit toast, denied Alert; first call outage → one offline toast, denied Alert; the Core accepts → results shown | export |
| B-1 | detail: one POST, chip ARCHIVED before the toast; list row: one POST for that row | 403 `notPermitted` example → denied toast naming the Supervisor, idle again; 409 `notSealed` → warning | `failOnce` → one toast; 429 → limit | archive |
| B-1 pending | action row `aria-busy`, Archive disabled, spinner late | — | — | archive |

The 403 of A6 is written by hand (`refusal(403, 'NOT_PERMITTED', …, { permission: 'EVIDENCE_VIEW' })`):
operation 41 has no `notPermitted` example (CONTRACT-GAP-W69-1). The 403 of B-1 is named by its
example `fake.example('archiveEvidence', 403, 'notPermitted')`; the 403 of A5/D-6 by
`fake.example('exportEvidence', 403, 'forbidden')`, the operation's only 403 example.

## 7. CLG (c) and the static rules

`grep` (`assets/69_clg_a_c.log`): `useSimActions` in 0 production files of the folder, `sim.actions`
in 0. The static block of `live-evidence-archive.test.tsx` holds it for every production file
(comments and quoted i18n keys removed), and also: the three actions are called exactly at the five
expected places, each inside `settle`; the tamper mirror is reached only from the Simulated branch;
the only `client.call` is operation 40; the presenter is consulted first at the four places; no
sentence of the page says "unreachable" or "limiting requests"; no import of the typed client, the
Live source or a test double (MD-6, TS-15); no `console.*`; the log's message is a fixed sentence.

## 8. CLG (d): the lane check (lane 3)

`/usr/bin/lockf -k -t 300 .locks/core-server.lane3.lock /bin/sh .cache/w69/lane/run_lane.sh`
(W63's script and W55's driver helpers; `assets/69_lane_run_lane.sh.txt`,
`assets/69_lane_cdp_driver.mjs.txt`), sandbox bypass for that command; `lockf exit=0`.

```
== 23:17:23 0. the three ports must be free before anything is started (nothing is stopped that this check did not start)
free: 4423 5178 9398
backend up after 3 quarter seconds, npm pid 98546
node    98567 gsp-budi   17u  IPv4 …      0t0  TCP 127.0.0.1:4423 (LISTEN)
node    98602 gsp-budi   14u  IPv4 …      0t0  TCP 127.0.0.1:5178 (LISTEN)
-- health through the dev server: 200
cdp-driver exit 0
  "elapsedSeconds": 65
the output held the seeded password before redaction: false
-- evidence lines of the backend's log (route, status; no body is logged):
   1 "route":"/api/v1/evidence","status":200
   4 "route":"/api/v1/evidence/:id","status":200
   1 "route":"/api/v1/evidence/:id/export","status":403
   1 "route":"/api/v1/evidence/:id/export","status":422
   4 "route":"/api/v1/evidence/:id/verify","status":200
== 23:18:31 stop what this check started
chrome stopped
vite: npm exit status 143
backend: npm exit status 0
== 23:18:31 listeners left on 4423, 5178, 9398 (expect none):
lsof exit 1 (1 with no output: no listener)
```

Sign-ins went through the form with the seeded operators read from the seed source
(`packages/shared/src/sim/dataset.ts`); the password was never printed or stored. The lane database
was not reset; ports 5432, 5173 to 5175, 4400 and lanes 1 and 2 were not touched; PostgreSQL ran on
4432 before and after (not started or stopped by this row).

| Step | Observed (`assets/69_lane_browser.json`) | Screenshot |
|---|---|---|
| SUPERVISOR, Evidence list, Live | chip `LIVE`; the Core's list: 13 items | `69_evidence_list_live.png` |
| A6 on `EV-20261003-0005` | operation 40: `DEMO_PACKAGE 0005`; one `POST …/verify` 200; verdict **FAIL**, checks `track:AUDIO-02:fail:core`, the five others `pass:core`; card "Verdict of the Core server"; custody top `VERIFY_FAILED`; bundled line done, FAIL (agrees, no notice); toast "Integrity FAILED for EV-20261003-0005: AUDIO-02"; no `/demo` request | `69_evidence_verify_live.png` |
| A6 on `EV-20261002-0001` | verdict PASS, six `pass:core`, custody `VERIFIED`, bundled PASS | `69_evidence_verify_pass_live.png` |
| A5 refused by the Core (422) | reason of three astral characters (six UTF-16 code units: the form's bound passes, the Core counts three characters); source verified by the Core; `POST …/export` **422**; the wizard back on Reason with the Core's refusal; nothing exported | `69_export_refused_422_live.png` |
| D-6, the INVESTIGATOR | `POST …/export` **403**; denied Alert; `EXPORT_DENIED` rows of the item 0 → 1, the new row `seq 137`, actor `OPR-001`, details `{ operationId: exportEvidence, permission: EVIDENCE_EXPORT, role: INVESTIGATOR, eventKind: UNAUTHORIZED_EXPORT }` (the guard's row, D83) | `69_export_denied_403_live.png` |
| Simulated (stored sign-in, F63-3) | chip `SIMULATED`; Sign In disabled (mock-core off by rule); 0 requests to `/api/v1`; 0 sockets to the dev server's `/ws`; package verification PASS "DEMO - recomputed" | `69_evidence_simulated.png`, `69_evidence_verify_simulated.png` |

What the check changed in `dems_lane_3` (db:status before/after): `audit_log` 129 → 138,
`auth_sessions` 16 → 18, `events` 95 → 105, `evidence_custody` 28 → 32, `health_snapshots` 1 → 2.
The four custody entries are the four verifications the Core answered (two presses on the detail page,
the wizard's source check, and one more: the source check's duplicate under StrictMode, F69-1, found
here and fixed after the run; the regression tests of §6 prove one request since). No export was
accepted and no item changed status. The backend's log had no line of level error or fatal.

## 9. Verification

### 9.1 CLG (a): the folder's existing tests

```
$ npm run test -w @dems/core-web -- --maxWorkers=2 src/features/evidence src/test/evidence-table.test.tsx
 Test Files  4 passed (4)
      Tests  28 passed (28)
   Start at  22:59:39
```
(Baseline before the first edit, 22:48:55: the same 4 files / 28 tests.)

### 9.2 The whole web suite (`assets/69_gate.log`)

Load before the run: 8.95 (waited below 9 from 9.87).

```
$ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  71 passed (71)
      Tests  958 passed (958)
   Start at  23:32:34
   Duration  134.04s
exit 0
```

At or above the floor the controller gave (62 files / 853 tests at 22:46); the difference includes
this row's 3 files / 35 tests and the rows running beside it. No red file, so no other row's file
to name. The row's own files in one run:

```
$ npm run test -w @dems/core-web -- --maxWorkers=2 --reporter=verbose src/features/evidence src/test/evidence-table.test.tsx src/test/live-evidence- src/test/live-runtime-static.test.tsx
 Test Files  8 passed (8)
      Tests  72 passed (72)
   Start at  23:36:03
```
(verify 12, export 10, archive 13; the folder's 7 + 9 + 4 + 8 = 28; `live-runtime-static` 9.)

### 9.3 Typecheck and lint

```
$ npm run typecheck -w @dems/core-web      → exit 0 (23:13; again 23:35 after the last edit)
$ npm run lint -w @dems/core-web           → exit 0 (23:13; again 23:35)
```
At 22:59 a typecheck showed one error in `apps/core-web/src/test/live-devices-drawer.test.tsx:372`
(W70's file, in flight); it was gone at 23:13. Not this row's.

### 9.4 `@dems/shared`

```
$ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
   Start at  23:34:55
exit 0
$ npm run typecheck -w @dems/shared        → exit 0 (23:35)
$ npm run lint -w @dems/shared             → exit 0 (23:35)
```

### 9.5 Mutation check (rule M15; `assets/69_mutations.log`, `69_mutations_runner.py.txt`, `69_mutations_config.mts.txt`)

W63's runner and transform plugin (W55's pattern): each mutation is one text replacement in one
module, applied in memory while Vitest transforms it; no file of the tree is changed; a marker under
`$TMPDIR` proves that it was applied. Baseline: the three Live files, 3 / 35 green (23:21:28).

```
## 2026-10-05 23:30:43 WIB 29 mutations: 29 detected, 0 survived [], 0 not applied []
```

Among them: the Live branch not taken (V01); the Core's checks labelled as the simulator's (V02);
the presenter skipped at verify, export, archive and the media read (V03, E06, A01, M02); the bundled
check never run, a difference never said, a verdict that is not the Core's (V04 to V06); the media
reference ignored (M01); the 403 and 422 branches of A5 removed (E01, E02); D-6 sending only the first
row, or showing a call the Core let through as denied (E03, E04); C-5's audit row not read (E09); the
StrictMode deferrals removed (E10, D03); the busy marks, the disabled Archive, the late spinner and the
in-flight flag (E07, D01, D02, P01, P02); an optimistic archive toast (A02); the control left busy (A03);
"simulated" on a Live item (D04, I01). The text rules (the log's fixed sentence, the static rules) are
held by the static tests, which read the files from disk, so they were not mutated in memory.

## 10. Findings

| ID | Finding | Evidence | Status |
|---|---|---|---|
| F69-1 | **A mount-effect command runs twice in every Live session.** `main.tsx:54` renders under StrictMode and Live mode exists only in dev builds (`runtime/error-sink.ts` header), so a command started in a mount effect is sent twice: the wizard's source check and the list's "Verify" hand-off each sent two `verifyEvidence` requests and the Core recorded two verifications (lane: 4 custody entries for 3 verifications). Fixed in this folder (the start waits one task); proven by two StrictMode tests | §8; `live-evidence-verify.test.tsx` "StrictMode" | fixed here; the pattern may exist in other folders (§12 DC-2) |
| F69-2 | The signature line keeps "Manifest signature (simulated)" in Live mode. True: the Core's items carry "the simulated signature" (the contract's own description, `packages/shared/src/api/evidence.ts:164`) | test comment in `live-evidence-verify.test.tsx` | accepted |
| F69-3 | The export destinations end in "(simulated)" and that text is sent to the Core as the destination and recorded. True (no transfer is carried out in either mode), but it appears in the Core's audit trail | `packages/shared/src/i18n/en/evidence.ts:277-281` | for the controller (DC-4) |
| F69-4 | Not reworded for Live mode (outside the row's list of changed files [CS:§7.3 G7]): the Metadata tab's "Simulated evidence record" and the preview card's `data-package="simulated"` for an item without a package | `F/metadata-tab.tsx:82-110`, `F/preview-card.tsx:109` | for W87/W88 |
| F69-5 | The DEMO export manifest downloaded in Live mode carries no verification report: the wizard runs no bundled check in Live mode (the Core's verdict decides, MS-5) | `F/export-wizard.tsx` `download` → `verification.report` null | accepted (DV-4) |
| F69-6 | The brief's "the FIRST 403 example of every operation is `deviceRevoked`" holds only for operations whose 403 examples are `BASIC_403_EXAMPLES`: `archiveEvidence` lists `notPermitted` first (`deniedExamples`), `exportEvidence` has `forbidden` only | probe of `CORE_API_EXAMPLES` (§6) | information for the briefs |
| F69-7 | The Core's verdict for a package item compares its stored record (sealed hashes, the tamper state); the Core holds no media (MS-1). The bundled check is the only byte-level recomputation in Live mode, and it is display-only | `implementation/35_module_evidence.md` §3; §14 point 7 | by design |
| F69-8 | Vite printed `ws proxy error: read ECONNRESET` once at 23:17:39, the moment of the sign-in, when the Live source replaces the anonymous socket (CL-11a); no page error, no console error | `assets/69_lane_run.log` step 5 | information |
| F69-9 | The list's thumbnails keep the guarded join in Live mode (MS-2 is applied where media plays and the bundled check runs: the detail page). On the 13 seeded items both agree | `F/list-page.tsx`; lane | accepted |

## 11. Contract gaps found

| ID | What the page needs | Where | What the row did |
|---|---|---|---|
| CONTRACT-GAP-W69-1 | A `notPermitted` 403 example for operation 41 (`verifyEvidence`), to name the denial test by its example | `packages/shared/src/api/evidence.ts:270` (`VIEW_DENIED = BASIC_403_EXAMPLES`), the examples at `:350` | The envelope is written in the test (as W63's CONTRACT-GAP-W63-1) |
| CONTRACT-GAP-W69-2 | A key for the item's media reference in `CORE_QUERY_KEYS` | `apps/core-web/src/runtime/query-bridge.ts:43-49` (closed to this row) | The key is built from the exported `CORE_QUERY_KEY` root (`F/use-evidence-media.ts:32-34`), so the bridge's removal and refetch reach it |

## 12. Deviations

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | `log.ts` now writes to `webErrorSink` instead of the dev console | The persistent-logging rule and CPW1-8; W63, W64, W65 did the same |
| DV-2 | Archive in Simulated mode: a `SimPermissionError` would now get the presenter's denied toast instead of `evidence.archive.denied` | Rule 2 is binding; the path is not reachable through the UI (§5) |
| DV-3 | The mount-time verification starts one task later in both modes | F69-1 |
| DV-4 | In Live mode the wizard's source check shows the Core's verdict only (no bundled check) | The list's rows carry no media reference; MS-5 allows, not requires, the recomputation; §19.3 rule 3 is met by the Core's verdict |
| DV-5 | D-6 in Live mode: when the Core accepts a call of the denied path, its answers are shown as the export's result instead of the denied Alert | "The server is the judge, show its answer" |
| DV-6 | A test helper lives at `F/__tests__/live-evidence-bed.ts` (inside the row's path `features/evidence/**`, not a `live-evidence-*.test.tsx`) | Three files share it; W64 did the same (`features/session-new/__tests__/live-session-new-bed.ts`). It first imported a type from the fake transport, which turned `live-runtime-static.test.tsx` (TS-15) red at 23:04 (controller note); fixed at 23:05 (the type is derived from the harness), the static test 9/9 green at 23:05:57 |
| DV-7 | A probe file `src/test/live-evidence-probe.test.tsx` was created and deleted by this row (my own new file) to read the bed's data | No other file was deleted |

## 13. Decisions for the controller

| ID | Decision asked | Default if none |
|---|---|---|
| DC-1 | Add `evidenceMedia: ['core', 'evidence-media']` to `CORE_QUERY_KEYS` (W50's path), or accept the key built from the root (CONTRACT-GAP-W69-2) | accept |
| DC-2 | F69-1: brief the remaining page rows (and check the gated ones) for commands started in a mount effect, which StrictMode sends twice in every Live session | brief W70 to W82 |
| DC-3 | Add a `notPermitted` 403 example to operation 41 at the contract's next change (CONTRACT-GAP-W69-1) | leave |
| DC-4 | Live wording of the export destinations ("(simulated)" is recorded by the Core, F69-3) | leave |
| DC-5 | Ledger: web +3 test files / +35 tests by this row (`live-evidence-verify` 12, `live-evidence-export` 10, `live-evidence-archive` 13); shared +0 tests | record |

## 14. Rollback (R-CO for the tracked files, R-NEW for the new ones; not executed)

| Kind | Command |
|---|---|
| R-CO | `git checkout acaff20 -- apps/core-web/src/features/evidence packages/shared/src/i18n/en/evidence.ts` (the pre-image patch `.cache/rollback/W69/W69.pre.patch` is 0 bytes: the folder equalled `acaff20`; file copies with `pre.sha256` in `.cache/rollback/W69/pre/`) |
| R-NEW | Remove `apps/core-web/src/features/evidence/{use-archive.ts,use-evidence-media.ts,use-pending-action.ts,export-outcome.ts}`, `apps/core-web/src/features/evidence/__tests__/live-evidence-bed.ts`, `apps/core-web/src/test/live-evidence-{verify,export,archive}.test.tsx`, this document, `assets/69_*`, `delegation_progress/coder_execution_step_91.md` |
| Scratch | `.cache/w69/` (lane scripts and output, mutation runner and its Vite cache), `.cache/rollback/W69/`; the lane's own files `.locks/core-server.lane3.{log,vite.log}` (rewritten by the run, as every lane run does) and the two emptied pid files. All git-ignored |
| Lane database | Nothing to undo: audit and custody rows are append-only by design; no item changed status |
