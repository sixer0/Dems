---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W75 (plan step 97)
agent: coder-execution
date: 2026-10-06
source_plan: masterplan/02_plan.md (row W75; gate CLG of section 11)
status: complete
tier: 2
---

# W75 — Web Security & Audit in Live mode

Settle sites A7 (`exportAudit`), A9 (`verifyAuditChain`), B-5 (`acknowledgeAlert`) and C-6 (the clock
stamp) of the Security & Audit page run through `useCoreActions()` and `settle`, every error goes to the
refusal presenter first, the role matrix shows the Core's twelve rows from operation 10 in Live mode and the
nine-row list in Simulated mode [CS:FC-3, TS-8], and the chain panel shows the stored-chain line and, when the
Core returns a lineage, the "Earlier chains" line with one entry per discarded chain [CS:§8.2 A9; AC-C-109;
SD-19]. The audit export file is built from every page of operation 59 [CS:§8.2 A7; AC-C-60]. Simulated mode
behaves as before: the folder's own test is at W01c's recorded state and passes.

Citation convention as in `masterplan/02_plan.md` (about line 81): `[CS:…]` is
`masterplan/04_client_integration_spec.md`, `[CP:§8 rule n]` is `gateway_check/08_cp_web_runtime.md` section 8
with the amendments of its section 30, `[W0:§15]` is `gateway_check/08a_w0_web_consolidation.md` §15, `[DEC:…]`
is `decisions/decisions.md`, `[I39:§n]` is `implementation/39_module_security_audit.md`. Code is cited as
`path:line` relative to `/Users/gsp-budi/Documents/DEMS/`; `F` below is `apps/core-web/src/features/security-audit/`.
No credential value appears in this file or in the assets: the lane driver reads the demo password from the
seed source and never prints it ("the output held the seeded password before redaction: false", §8).

## 1. Result

(§9 holds every command with its output.)

| Gate item | Result | Evidence |
|---|---|---|
| SG: typecheck and lint of `@dems/core-web` | exit 0, exit 0 (02:05; no warning in this row's files) | §9.3 |
| SG: typecheck and lint of `@dems/shared` (one i18n file, additive) | exit 0, exit 0 | §9.4 |
| SG: `@dems/core-web` suite at or above 78 files / 1,012 tests | **93 files / 1,242 tests, exit 0** (02:00:57, load 8.59); the first run at 01:53 was red only in the three files of decision D172 (§9.2) | §9.2, `assets/75_web_suite_0200.log` |
| SG: `@dems/shared` suite | **68 files / 1,814 tests, exit 0** (01:58:37) | §9.4 |
| CLG (a): the folder's existing tests pass; their file absent from `git diff --stat acaff20` | 1 file / 18 tests pass; the one test file differs from `acaff20` by W01c's recorded by-design change only: `git hash-object` prints `5470ce3fdcd98fd8c0926cd6afe03a1a1c1af58f`, W01c's reference [DEC:D41, D42]; never edited by this row | §9.1, `assets/75_clg_a_c.log` |
| CLG (b): one Live test per settle site — success, refusal with the denied toast, outage | 3 new files, 44 tests: chain 15 (A9 and C-6 6, lineage 3, B-5 4, Simulated controls 2), export 10 (A7 success and the 450-row file 2, refusal 2, outage and limit 2, pending 1, the file's failures 2, Simulated control 1), page 19 (matrix 6, StrictMode 1, actor 2, static rules 10) | §6 |
| CLG (c): no `useSimActions`, no `.actions` read on a `Sim` in the folder's production files | 0 and 0 (grep), and a static test | §7, `assets/75_clg_a_c.log` |
| CLG (d): one live check on a lane, at most 10 minutes, screenshots | lane 3, two passes, 87 s in all; 8 screenshots; ports free after; `dems_lane_3` not reset | §8 |
| Row check: with 450 rows on the fake server the audit export file holds 450 rows | asserted (`live-security-audit-export.test.tsx`, "with 450 rows …"): 450 rows, seq 1..450, three pages of 200, ending on the export's head; the socket's ring held 200 | §6.1 |
| Row check: in Live mode the chain panel lists one entry per discarded chain while the Simulated panel is as today | asserted: 1 entry (contract example), 3 of 25 (one per chain the Core returned, the total named), none for an empty lineage; Simulated: no stored line, no lineage line | §6.2 |
| M15 mutation check (in memory, no tree file changed) | **43 mutants, 43 detected** (two survived the first run and were killed by two stronger assertions) | §10, `assets/75_mutations.log` |

## 2. What was written

| File | Change | Why |
|---|---|---|
| `F/chain-panel.tsx` | A9: `useSimActions()` → `useCoreActions()` (`:64`); the check runs `settle(() => actions.verifyAuditChain(), …)` when the Spinner's time is over (`:112`), as the simulator's call did, so Simulated mode is identical (the A9 rule of D154 DN-4 / D165); in `ok` the Live handle's `auditChain` of the same answer is kept with the result (`:115-118`); `fail` → presenter first (`:122`), else one record and a toast; the Spinner spans the request (`done`, LB-2). B-5: Acknowledge through `usePendingControl()` (`:69`, `:134-148`) with the busy mark `ref` on the kit Button, the late `Spinner`, the presenter first (`:140`). The Live lines rendered under the result (`:344`) | [CS:§8.2 A9, §8.3 B-5, §8.4 C-6]; [CP:§8 rules 1, 2]; [W0:§15] |
| `F/chain-core-lines.tsx` (new, 103 lines) | "Stored chain: verified, n rows" or "Stored chain: broken at entry #s, verified through #c" from `stored` (`:38-48`); "Earlier chains: n" only when `lineage` is not empty (`:49`), n = `lineageTotal`; a read-only Popover list, one entry per chain the Core returned (epoch, rows, head shortened, the reason, the time of the reset, the operator or "the command line", the scenario), and "The newest k of n are listed." when the Core returned fewer than all (`:54-102`) | [CS:§8.2 A9]; AC-C-109; SD-19 |
| `F/export-audit-dialog.tsx` | A7 through `settle(() => actions.exportAudit({ reason }))` inside the one pending control (`:259-278`); the outcome by the pure `auditExportOutcome` (`:263`); Live: the Export button busy at once, spinner late, Cancel and dismissal held while the Core has not answered (`:139`, LB-6); 202 → the receipt from the AUDIT_EXPORTED row in the replica, then the file from all pages of operation 59 (`buildFile`, `:149-190`): the pipeline holds on "Build export package" until the file is built (`:230`) and that step names the page ("page 2 of 3"); the file is downloaded and can be downloaded again (`:285-293`); 403 → the denied state naming the Supervisor; 422 → the reason field's error, cleared on typing (`:197-201`, F59); outage or 429 → the presenter (`:272`); a page the Core does not answer → the presenter, else one record; the inline sentence "The Core recorded export EXP-…, but the file could not be built" — never a partial file. Live words: destination, body, success title, the reason note | [CS:§8.2 A7, §8.1 LB-1, LB-2, LB-6, LB-10]; AC-C-60; [DEC:F59] |
| `F/export-file.ts` (new, 172 lines) | `readExportedRows` (`:81-110`): the stored chain from the first row, `limit` 200 (`:21`), following `nextCursor`, up to the rows the export covers (or, when the row count is unknown, up to the AUDIT_EXPORTED row of the export); `checkWalk` (`:112-120`): sequences 1, 2, 3 … without a gap, as many as the export covers, ending on the export's head — else `AuditWalkError` `CHAIN_MOVED`; `buildAuditExportFile` (`:135`), file name `dems-audit-<exportId>.json`, `downloadAuditFile` (`:161`). It reads the typed client's answer structurally, so no page file imports the typed client | [I39:§7.1, §7.4, §12]; [CS:§8.2 A7] |
| `F/rbac-panel.tsx` | Live: `CoreRoleMatrix` (`:145-228`): operation 10 through `live.client.call('getRoleMatrix')` in one query under `CORE_QUERY_KEYS.roleMatrix` (`:153`), enabled only while signed in (`:150-154`, see F75-2); the Core's permission order, role order and grants (`coreGrantSet`); loading line; on failure the presenter first, else one record (`:159`), an inline message and a rate-limited Retry (`useRetryCooldown`, 3 s → 6 s → 12 s, at most 3). Simulated: the nine-row `RoleMatrix` unchanged (`:81`). Live subtitle | [CS:§6.1, FC-3, TS-8]; [CP:§8 rule 3] |
| `F/sim-adapter.ts` | `auditExportOutcome(result, rows, reason, coreRows)` (`:74-103`): one pure mapping of the result union (simulator or Live binding, CL-19); Live counts the entries as the AUDIT_EXPORTED row's sequence minus one (`:89`), the stored rows the export covers ([I39:§7.4]; the row's `details.rows` counts the Core's ring, [I39] F-1). `exportAuditWithReason(sim, reason)` (`:116`) keeps its signature and result for the folder's test, now through `coreActionsOf(sim)` (no `.actions` read) | AC-C-53; CLG (a) |
| `F/model.ts` | `namesTypedUsername(row)` (`:208`): an AUTH_FAILED or AUTH_LOCKED row that names an operator; `coreGrantSet` (`:467`) | CPS1-12 (a); FC-3 |
| `F/audit-log-panel.tsx` (`:281`), `F/auth-panel.tsx` (`:46`) | Live mode words the actor of those two types "AKP Budi Santoso (username typed, unverified)": the operator whose username was TYPED, not a signed-in actor. Simulated keeps its words | `gateway_check/05_cp_access_control_security.md` CPS1-12 (a) |
| `F/log.ts` (rewritten, 39 lines) | `logSecurityAudit(level, source, error, context)` keeps its signature and now writes through `createPageReporter('sa')` of `@/lib/page-report` to `webErrorSink`: a fixed sentence, the cause by class, code and status, a `sa-…` correlation ID; no `console.*`, no error text, no stack | [W0:§15]; CPW1-8 |
| `F/panel.tsx` | the boundary's record passes `componentStack ?? null` (the reporter's context type); its comment names the page's own log | — |
| `F/security-audit.css` | `.sa-chain-core*`, `.sa-chain-earlier*`, `.sa-matrix-state`, `.sa-export-file` (`:910-971`) | the new lines |
| `packages/shared/src/i18n/en/security-audit.ts` | additive `securityAudit.live.*` (28 keys: `audit.typedActor`, `chain.*`, `exportAudit.*`, `rbac.*`); every existing key kept with its value | [CP:§8 rule 8] |
| `F/__tests__/live-security-audit-bed.ts` (new) | Live helpers on W50's harness; imports no test double (TS-15) | tests |
| `apps/core-web/src/test/live-security-audit-{chain,export,page}.test.tsx` (new) | 15 + 10 + 19 tests (§6) | CLG (b), (c) |

No file outside the row's write paths was changed. `routeTree.gen.ts` was not touched by hand. Nothing was
deleted or renamed.

## 3. The settle sites

| Site | Live behaviour built | Simulated mode |
|---|---|---|
| **A9** `verifyAuditChain` (operation 60) | The Spinner from the press (LB-2); the request leaves when its 480 ms are over (as the simulator's call did); a second press is ignored while it runs; the chip is the check over the Core's audit VIEW; under it the stored-chain line, and "Earlier chains: n" when the Core returned a lineage. During `AUDIT_TAMPER` the chip says FAIL and the stored line says verified [SP:§12.3]. Refusal / outage / link down → the presenter; no result; the button is idle again | Unchanged: the simulator's check at 480 ms, PASS/FAIL, no Live line |
| **C-6** the stamp | `sim.store.getState().clock.now` is the Live clock in Live mode; asserted exact on the fake's manual clock | Unchanged |
| **B-5** `acknowledgeAlert` (operation 70) | One POST for the tamper alert; busy at once (`aria-busy` on the button), the kit's spinner after the reveal time, a second press sends nothing; the toast after the answer; the button leaves when the Core's delta marks the alert acknowledged; the discontinuity Alert stays (the break stays on record) | Settles in the press: store, toast, button gone; never busy |
| **A7** `exportAudit` (operation 61) + operation 59 | §2 row of `export-audit-dialog.tsx` | Unchanged: the simulator's export in the press, the "(simulated)" toast, no file |

The two operations of A9 and B-5 (and operation 10) have the access rule AUTHENTICATED: the Core never answers
them 403 `NOT_PERMITTED` and the contract has no `notPermitted` example for them. Their refusal case is the
documented 403 `ORIGIN_NOT_ALLOWED`, as ruled for A9 and B-4 in [DEC:D154] DN-1. A7's refusal is the contract's
`notPermitted` example of operation 61 (not its first 403 example, which is `deviceRevoked`; F76-8).

## 4. Simulated mode

| Change | Why it is not observable in Simulated mode |
|---|---|
| The actions come from `useCoreActions()` (the simulator's own object) and run in `settle` | `settle` runs a plain value's handlers before it returns (CL-25); the pending control changes no state for a command that settled in the press [W0:§3.2] |
| `exportAuditWithReason` goes through `coreActionsOf(sim)` and the shared `auditExportOutcome` | Same calls, same result union, same receipt (the folder's test asserts it unchanged) |
| The verify `fail` branch asks the presenter first | The simulator's `verifyAuditChain` never throws (`packages/shared/src/sim/actions.ts:175`) |
| `log.ts` writes to the page sink | Records were dev-console only; the sink prints them in a dev build; no UI |
| `data-testid="chain-acknowledge"`, `isPending={false}`, `ref` on Acknowledge; `isDisabled={false}` on Cancel | No visible or behavioural difference |

The lane's Simulated pass (§8) showed the SIMULATED chip, the nine-row matrix, no stored line, 0 requests to
`/api/v1` and 0 sockets to the dev server's `/ws`.

## 5. The role matrix and the actor column

- **Matrix**: 13 table rows in Live mode (header + 12, the Core's order: … `PAIRING_MANAGE`, `USER_ADMIN`,
  `DEMO_CONTROL`), 18 grants as the Core sends them; a test with an extra grant proves the cells are the Core's,
  not the console's static table. 10 rows in Simulated mode (the folder's assertion holds, TS-8).
- **Actor of a failed sign-in** (CPS1-12 (a)): Live mode only, in the authentication feed and the audit table.
  The simulator writes the same `actorId` (`packages/shared/src/sim/auth.ts:262`), so the Simulated wording is
  equally imprecise; changing it would be a deliberate Simulated change (DC-3 below).

## 6. Tests (CLG (b)) — `apps/core-web/src/test/live-security-audit-*.test.tsx`

Each file has the page address `http://127.0.0.1:5178/` in its docblock, calls `clearToasts()` between tests,
scopes toast queries to `[data-slot="toast"]`, ends with `fake.assertNoViolations()` (the harness) and asserts
that the page load's own sink holds no `live.misuse` report.

### 6.1 `live-security-audit-export.test.tsx` (10)

| Case | Asserted |
|---|---|
| **450 rows** | The fake Core holds a stored chain of 450 rows; the socket's ring only the newest 200. The export: one POST with the reason; the AUDIT_EXPORTED row (seq 451, `details.rows` 200 as the simulator writes it) arrives in the delta; the toast "Audit export accepted by the Core — Export EXP-000032 with 450 entries."; three GETs of operation 59 with `limit=200`, the 2nd and 3rd after the cursors of rows 200 and 400; the downloaded file holds **450 rows**, seq 1..450, ending on the export's head, without the AUDIT_EXPORTED row; file name `dems-audit-EXP-000032.json`; "Download again" hands it over once more; no "simulat" word |
| page count | With page 2 held: the build step reads "Reading the Core's audit list: page 2 of 3" and no result is shown until the file is built |
| 403 `notPermitted` | The denied toast "Audit export needs the Supervisor role." and the inline alert; reason kept; Export idle; no page read; no file |
| 422 `invalidReason` | The reason field's error "The Core server did not accept this reason. …"; reason kept; no reason toast; cleared on typing |
| outage | The presenter's offline sentence once; no page toast, no page record; reason kept; idle |
| 429 | The limit toast with 9 s; never the offline sentence |
| pending | Busy at once (`aria-busy`), same look; a second press sends nothing; Cancel disabled; the spinner after the reveal time; the answer then goes on to a 30-row file |
| a page not answered | The presenter's sentence once; the inline sentence names the recorded export; no page toast, no record, no file; the result still shows the export ID |
| the chain moved | Pages of another chain: no file; the page's toast and one record (`AuditWalkError`, `CHAIN_MOVED`, `sa-…`, no text, no reason) |
| Simulated control | The simulator's row in the press, the "(simulated)" toast, the Simulated words, no file, no page step |

### 6.2 `live-security-audit-chain.test.tsx` (15)

A9 success (Spinner until the answer, one request, PASS, `Verified 82 entries at <Live clock>`, "Stored chain:
verified, 82 rows", no lineage line); `AUDIT_TAMPER` (view FAIL, stored PASS); stored broken (#41 / #40); lineage
from the contract example (1 entry: epoch, rows, head, "Reset at … by AKP Andi Pratama • scenario Idle"); 3 of 25
(epochs 25, 24, 23 newest first, "Scenario load", "the command line", "Fault demo", "The newest 3 of 25 are
listed."); empty lineage (no line); refusal `originNotAllowed` (the address, no result, idle, no record); outage
(once, no page toast or record); link down (no request). B-5 success (one POST for `ALR-…`, toast after, button
leaves with the delta, Alert stays), pending, refusal, outage. Simulated controls: Verify without any Live line;
Acknowledge in the press.

### 6.3 `live-security-audit-page.test.tsx` (19)

Matrix: 13 rows, the Core's labels in its order, 18 grants, `USER_ADMIN` only for the Supervisor, one GET
`/api/v1/rbac/matrix`, the cache entry under `CORE_QUERY_KEYS.roleMatrix`; the Core's extra grant shown; no
answer (presenter once, no record, inline message, Retry → "Retry in 3s" disabled, a press in the cooldown reads
nothing, the third read shows the table); `originNotAllowed`; **after the session ends, no further read** (red
before the fix of F75-2: 2 requests); Simulated 10 rows and no request. StrictMode: one read of operation 10, no
other Core call at mount, one request per Verify press. Actor: Live feed and table "… (username typed,
unverified)"; Simulated unchanged. Static rules (§7).

## 7. CLG (c) and the static rules

`grep` (`assets/75_clg_a_c.log`): `useSimActions` in 0 production files of the folder; `.actions` (minus the i18n
words `common.actions.*`) 0. The static block of `live-security-audit-page.test.tsx` holds for every production
file of the folder (comments removed): no `useSimActions`, `.actions`, `SimContext`, `live.source`; the three
actions are called exactly once each, each inside `settle(() => actions.x(…)` (the adapter's synchronous form
through `coreActionsOf`); the only `client.call` operations are `getRoleMatrix` and `listAuditRows`; the
presenter speaks first at every failure branch; no "unreachable" / "limiting requests" sentence; the matrix key
is the runtime's and no key starts with `'core'`; no `LIVE_PENDING_REVEAL_MS` / `usePendingReveal` of the page,
`usePendingControl()` with its `ref` on the pressed button; no import of the typed client, the Live source or a
test double; no `console.*`; `log.ts` binds `createPageReporter('sa')`; no `logSecurityAudit` call carries the
export reason (only its length; a refusal by its enum). No effect of the folder starts a Core call (the matrix is
a `useQuery`; `live-strict-mode-starts.test.tsx` passes in the whole suite).

## 8. CLG (d): the lane check (lane 3)

`/usr/bin/lockf -k -t 300 .locks/core-server.lane3.lock /bin/sh .cache/w75/lane/run_lane.sh` — W71's script
(itself W63's, on W50's ports and start/stop) with this row's step 4 and log greps (`assets/75_lane_run_lane.sh.txt`),
and W55's CDP helpers with this row's steps (`assets/75_lane_cdp_driver.mjs.txt`); sandbox bypass for that one
command (port binding, the browser). Two passes, 87 s of lane time in all; `lockf exit=0` both times; the ports
4423, 5178 and 9398 free before and after each; the demo flag off; `dems_lane_3` not reset; port 5432 never named;
5173 to 5175 and 4400 neither used nor touched; PostgreSQL on 4432 running before and after (not started or
stopped by this row). Browser: HeadlessChrome 153.0.8010.12 (Chrome for Testing), 1920 × 1080.

| Pass | Time | Why | Log |
|---|---|---|---|
| 1 | 01:33:34 to 01:34:16 (42 s) | First full pass | `assets/75_lane_run_1.log`, `assets/75_lane_browser_1.json` |
| 2 | lock waited 01:42:34 to 01:42:52 (another row's lane 3 run held it: its backend and Vite were listening at 01:42:34 and were not touched); 01:42:52 to 01:43:37 (45 s) | The finished code: after the fix of F75-2 (found in pass 1) and with the shell pill read for F63-6 | `assets/75_lane_run_2.log`, `assets/75_lane_browser_2.json` |

Pass 2 (the evidence; pass 1 agreed wherever both looked):

```
== 01:42:52 0. the three ports must be free before anything is started (nothing is stopped that this check did not start)
free: 4423 5178 9398
lineage          0 row(s)
backend up after 4 quarter seconds, npm pid 12259
-- health through the dev server: 200
cdp-driver exit 0
the output held the seeded password before redaction: false
-- the backend's log: lines       50; lines with level error or fatal: 0
   1 "route":"/api/v1/audit/export","status":202
   2 "route":"/api/v1/audit","status":200
   2 "route":"/api/v1/audit/chain","status":200
   1 "route":"/api/v1/rbac/matrix","status":200
   3 "route":"/api/v1/security/status","status":200
== 01:43:37 stop what this check started
chrome stopped
vite: npm exit status 143
backend: npm exit status 0
== 01:43:37 listeners left on 4423, 5178, 9398 (expect none):
lsof exit 1 (1 with no output: no listener)
lockf exit=0
```

| Step | Observed | Screenshot |
|---|---|---|
| The seeded SUPERVISOR signs in through the form; `/security-audit` in Live mode | chip `LIVE`; banner `SECURE`, posture `SECURE`, 9 of 9 controls OK; chain `PASS`, "151 of 151 entries"; the operators OPR-001..003; **the matrix from operation 10: 13 rows (header + 12), `data-matrix-source="core"`**, the Live subtitle; one `GET /api/v1/rbac/matrix` 200 | `75_security_audit_live.png`, `75_rbac_matrix_live.png` |
| The Core's own state, by a page request (operation 58) | `posture: SECURE`, `state: READY`, `tamper: false`, `auditTotal: 151` | — |
| F63-6: the shell's integrity pill | "ATTENTION — Some checks need attention"; its checklist: eight checks OK and **"Operator tablet link — Needs attention"** (no tablet is connected to lane 3). The page's posture and the Core's posture are SECURE; the pill aggregates more than the posture | `75_shell_pill_live.png` |
| A9: Verify chain | one `GET /api/v1/audit/chain` 200; chip `PASS`, "Verified 151 entries at 01:43:13"; **"Stored chain: verified, 151 rows"**; no "Earlier chains" line — the Core's answer read by a page request: `lineageTotal: 0`, `lineage: []` (`db:status`: "lineage 0 row(s)"; the lane was never reset, and this row may not reset it) | `75_chain_verified_live.png` |
| A7: Export audit with a reason | the dialog's Live words ("The file is built here from the Core's audit list: 151 entries", "Destination: A file downloaded to this computer"; no "simulat" word in the dialog); `POST /api/v1/audit/export` 202; the toast "Audit export accepted by the Core — Export EXP-000033 with 151 entries."; the result with the file `dems-audit-EXP-000033.json` and "Download again"; `GET /api/v1/audit?limit=200` (one page: 151 rows) | `75_export_dialog_live.png`, `75_export_live.png` |
| **The downloaded file** (read back from the browser's download folder, `assets/75_lane_export_files.json`) | `dems-audit-EXP-000033.json`, 87,296 bytes, sha256 `7a8ef81f…abefd53e`: `kind: dems-audit-export`, `source: core-server`, **151 rows, seq 1..151 without a gap**, last row's hash `50b5b680dc70d97a…` = the `prevHash` of the Core's AUDIT_EXPORTED row (seq 152, actor OPR-002, `details.rows` 151, the reason recorded), so the file is exactly the stored chain the export covers; the AUDIT_EXPORTED row itself is not in it. Pass 1: `EXP-000032`, 140 rows, 1..140, head equal | — |
| Simulated (the stored choice wins over the lane's preset; the simulator's stored sign-in, F63-3) | chip `SIMULATED`; Verify → `PASS`, "Verified 82 entries", no stored line, no lineage line; matrix 10 rows, no `data-matrix-source`; the pill `SECURE`; **0 requests to `/api/v1`, 0 sockets to the dev server's `/ws`** | `75_security_audit_simulated.png`, `75_security_audit_simulated_top.png` |

No phase recorded a console error or warning. The screenshots show the seeded operators' display names and the
lane's synthetic audit rows; no screenshot is of the Login page and none shows a credential. The two downloaded
files stay under `.cache/w75/lane/out/downloads/` (lane data, not copied into the documents); their facts are in
`75_lane_export_files.json`.

**One driver defect, corrected after pass 2:** the driver read "the first `.json` file" of its download folder,
which in pass 2 was pass 1's file (so `browser_2.json` → `steps.export.file` reports `EXP-000032`, 140 rows). The
pass-2 file was read directly afterwards (`75_lane_export_files.json`, the table above), and the driver now takes
the newest file written during its own run (`75_lane_cdp_driver.mjs.txt`, the `statSync` lines). Not re-run.

**What the check changed in `dems_lane_3`** (`db:status` before and after; the lane is not reset):

| Pass | `audit_log` | `auth_sessions` | `events` | `exports` |
|---|---|---|---|---|
| 1 | 138 → 142 | 18 → 19 | 105 → 108 | 1 → 2 |
| 2 | 150 → 153 | 21 → 22 | 112 → 114 | 2 → 3 |

(Between the passes another row used the lane: 142 → 150.) Two accepted audit exports (EXP-000032, EXP-000033,
each one AUDIT_EXPORTED row and one `exports` row, destination "Audit archive (simulated)", the Core's default),
two sign-ins and sign-outs of the seeded SUPERVISOR. Nothing else changed: no role, no alert, no reset.

**Found in pass 1 (F75-2):** after the sign-out, one `GET /api/v1/rbac/matrix` answered **401** (`75_lane_run_1.log`:
`"route":"/api/v1/rbac/matrix","status":401`). Reproduced red by a test (2 requests), fixed (§2, `rbac-panel.tsx:150-154`),
green; pass 2 shows no 401 on the matrix.

## 9. Verification

Commands from the repository root (`npm --prefix /Users/gsp-budi/Documents/DEMS run …`, the same scripts).

### 9.1 CLG (a): the folder's existing test (`assets/75_clg_a_c.log`)

```
## 2026-10-06 01:36:59 WIB CLG (a): the folder's existing test files against acaff20
$ git diff --stat acaff20 -- apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx
 .../src/features/security-audit/__tests__/security-audit.test.tsx       | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
$ git hash-object apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx   (W01c reference, D42: 5470ce3fdcd98fd8c0926cd6afe03a1a1c1af58f)
5470ce3fdcd98fd8c0926cd6afe03a1a1c1af58f
$ git status --porcelain -- apps/core-web/src/features/security-audit/__tests__/
?? apps/core-web/src/features/security-audit/__tests__/live-security-audit-bed.ts
```

The one existing test file of the folder is a declared multi-writer path whose by-design change belongs to W01c
(the awaiting row query, [DEC:D41, D42]); its hash is W01c's reference, before and after this row (02:05:
`5470ce3f…` again). It passes unchanged:

```
$ npm run test -w @dems/core-web -- --maxWorkers=2 src/features/security-audit     (01:16:43)
 Test Files  1 passed (1)
      Tests  18 passed (18)
$ … src/test/live-security-audit-page.test.tsx src/test/live-security-audit-chain.test.tsx src/test/live-security-audit-export.test.tsx src/features/security-audit     (01:28)
 Test Files  4 passed (4)
      Tests  61 passed (61)
```

(After that run the page file gained the F75-2 test and two assertions were strengthened: the row's four files are
4 / 62 in the baseline of §10 and in the whole suite.)

### 9.2 The whole web suite

```
## 2026-10-06 02:00:57 WIB  2:00  2 users, load averages: 8.59 8.92 7.61
$ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  93 passed (93)
      Tests  1242 passed (1242)
   Start at  02:00:57
   Duration  229.28s
exit=0
```

The first whole run (01:53:00, `assets/75_web_suite_0153.log`) was `3 failed | 90 passed (93)`, `19 failed | 1219
passed (1238)`, red ONLY in the files decision D172 named while their owner was changing them, none of them this
row's: `test/live-shell-admin.test.tsx` (W54's; 17 tests — `FakeTransportUnscriptedError` for `getRoleMatrix`
(this page's read in its "every other route stays: /security-audit" test), `getPairingCodeStatus` and
`listPairedDevices`: the harness did not answer them yet), `test/live-pending-control.test.tsx` (W0's; the exact
caller list, now a minimum: this row's two callers `security-audit/chain-panel.tsx` and `export-audit-dialog.tsx`
among eleven new ones) and `test/live-devices-drawer.test.tsx` (W70's; `getPairingCodeStatus` unscripted, W81's
page). Re-run once, as D172 asks, after the harness answers had landed: green above.

### 9.3 Typecheck and lint of `@dems/core-web`

```
## 02:05:19 $ npm run typecheck -w @dems/core-web
> tsc -b
exit=0
## 02:05:43 $ npm run lint -w @dems/core-web
src/features/paired-devices/code-display.tsx:36:105: warning react-hooks(exhaustive-deps): …
src/features/paired-devices/code-display.tsx:39:20: warning react-hooks(exhaustive-deps): …
exit=0
```

The two warnings are W81's in-flight file. At 01:57 the typecheck was red in W76's in-flight
`src/test/live-system-demo.test.tsx(408,11): error TS6133` (and its lint warning); named, re-run at 02:05: green.
This row's files: 0 errors, 0 warnings (the two `react(refs)` warnings of 01:27 were removed by destructuring the
hook's `ref`, as Session New does).

### 9.4 `@dems/shared` (one i18n file written, additive)

```
## 01:57:47 $ npm run typecheck -w @dems/shared
exit=0
## 01:57:54 $ npm run lint -w @dems/shared
exit=0
$ npm run test -w @dems/shared -- --maxWorkers=2      (01:58:37; load 11.18 at the start, see DV-6)
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
exit=0
```

### 9.5 No secret in the row's documents and assets

`node --import tsx .cache/w75/secret_scan.mts` (reads the seed's password constant and counts, never prints):
`files scanned: 16; holding the seeded password: 0; token-shaped strings: 0` (02:08, every non-image `75_*` asset, this document and the progress file).

## 10. Mutation check (M15)

W71's runner and config (`assets/75_mutations_runner.py.txt`, `assets/75_mutations_config.mts.txt`): each mutant is
one text replacement in one module, applied IN MEMORY by a Vite transform plugin while Vitest loads the module; a
marker under `$TMPDIR` proves it ran; no file of the tree was modified (the runner checks that every searched text
occurs exactly once in the file on disk, `43 mutations; texts that do not occur exactly once: 0`). Baseline under
the same config, no mutant: `Test Files 4 passed (4) | Tests 62 passed (62)`, exit 0. Log: `assets/75_mutations.log`.

| Group | Mutants | Result |
|---|---|---|
| A9 / B-5 / C-6 (`chain-panel.tsx`) | C01 presenter skipped; C02 Live lines never rendered; C03 Live handle not read; C04 browser clock instead of the Live clock; C05 toast at the press; C06b no press guard; C07 presenter skipped (B-5); C08 no busy mark; C09 no spinner | 9 / 9 detected |
| Lineage / stored line (`chain-core-lines.tsx`) | L01 lineage never shown; L02 count of listed entries instead of all; L03 broken stored chain reads verified; L04 command-line reset credited to an operator; L05 only the newest entry listed | 5 / 5 |
| A7 (`export-audit-dialog.tsx`) | X01 presenter skipped; X02 Live 422 not on the field; X03 Simulated words on the Live toast; X04 Cancel not held; X05b no press guard; X06 a refused page not presented; X07 no download; **X08 pipeline does not wait for the file**; X09 no page count; X10 entries counted as the ring; **X11 dialog dismissable while out** | 11 / 11 (X08 and X11 survived the first run; the page-count test now waits past the steps' pace and the pending test presses Escape; then detected) |
| The file (`export-file.ts`) | E01 pages of 50; E02 one page only; E03 no head check; E04 one row too many; E05 cursor not passed on | 5 / 5 |
| Matrix (`rbac-panel.tsx`) | R01 static matrix in Live; R02 static grants; R03 Retry not rate-limited; R04 presenter skipped; R05 key outside the runtime's; R06 Simulated subtitle in Live; R07 read again after the session ended (F75-2) | 7 / 7 |
| Actor (CPS1-12) | A01 feed without the wording; A02 the wording in Simulated too; A03 table without the wording | 3 / 3 |
| `log.ts`, `sim-adapter.ts` | G01 the record quotes the error; G02 another prefix; S01 Live counts the ring (F-1) | 3 / 3 |

**43 mutants, 43 detected.** C06 and X05 (the first form of the two press-guard mutants) were "detected" by a
crash, not by the guard (F75-8): superseded by C06b and X05b, which the pending tests catch specifically.

## 11. Contract gaps found

**`CONTRACT-GAP-W75-1`** (the default destination of an export says "simulated" in Live mode).
`packages/shared/src/api/security-audit.ts:201-206` (`AuditExportRequestSchema.destination`: "Omitted or empty means
'Audit archive (simulated)'") and the action that writes it. The Live dialog sends `{ reason }` only (as the
binding `packages/shared/src/live/source/bindings.ts:241-246` and the simulator's request do), so every accepted
web export is recorded by the Core with the destination "Audit archive (simulated)" while the file goes to the
browser's download folder (lane: EXP-000032 and EXP-000033). Server data, not reworded here (F63-4's rule); the
custody panel shows it as written ("To: …"). Options for W83: the console sends a truthful destination in Live
mode (for example "Web console download"), or the Core's default drops "(simulated)" in Live builds.

No other gap: operations 59, 60, 61, 10 and 70 gave the page everything it needed. The A9 and B-5 refusal case
(no `notPermitted` example for AUTHENTICATED operations) is the ruled `originNotAllowed` [DEC:D154 DN-1], not a gap.

## 12. Findings

| ID | Finding | Evidence | Effect / owner |
|---|---|---|---|
| F75-1 | **The Live binding drops `rows` and `head` of the export's answer.** `exported` (`packages/shared/src/live/source/bindings.ts:248-252`) keeps only `exportId`. The page reads the two from the AUDIT_EXPORTED row in the replica instead — `seq - 1` and `details.head`, equal to the answer by [I39:§7.4] (lane: row 152 → 151 rows, `prevHash` = the file's last hash) — and, if that row is not in the replica (a settle time-out, CL-17), walks up to the export's row | `F/sim-adapter.ts:89`; `F/export-file.ts:81-110` | Works; a one-member addition to `ExportResult` (or a Live-only receipt) would let the page use the Core's own numbers. To W83 (shared live layer, not this row's path) |
| F75-2 | **A read after the session ended.** When the session ends the bridge removes `['core', …]` in the same turn, but a page still on screen until the shell leaves re-ran its query: one `GET /api/v1/rbac/matrix` → 401 (lane pass 1). Fixed: the query is enabled only while signed in (`useLiveSelector`) | `75_lane_run_1.log`; red/green test "after the session ends …"; pass 2 clean | Fixed here. **Every page row with a Core query (W77, W81, W76) may have the same pattern**: worth a line in their briefs or a bridge-level answer (W83) |
| F75-3 | **The reason's lower bound counts UTF-16 code units in the form and characters in the contract.** `isValidExportReason` (`F/sim-adapter.ts:39-41`, `reason.trim().length >= 5`) lets three astral characters through; the contract-checked fake refuses to carry that body (`INVALID_BODY: reason: too_small`), the real Core answers 422 and the dialog shows the field's error (F59). Unchanged: the simulator counts code units too, and Simulated mode must stay as it is | the 422 test's comment; [I39:§7.2] | Known class (F59); the server is the judge. To W83 if the form should count characters in Live mode |
| F75-4 | **F63-6 explained on lane 3.** The shell's integrity pill says ATTENTION because its "Operator tablet link" check needs attention (no tablet connected to lane 3); the Core's posture (operation 58) and this page say SECURE, with 9 of 9 controls OK. The pill aggregates more checks than the posture; both are right about what they measure | `75_shell_pill_live.png`; `75_lane_browser_2.json` → `steps.shellPill` | Wording question for the shell (W54/W83), not a defect of this page |
| F75-5 | **Two "simulated" words remain on the Live page, both from the Core's data or its synthetic records:** the custody line "To: Case file transfer (simulated)" (an evidence export's recorded destination, CONTRACT-GAP-W75-1's kind) and the keys panel's "TLS server certificate — SIMULATED" (the Core's `security.keys` TLS entry is the hosted engine's synthetic record; the Core serves plain HTTP on loopback). Left as they are: truthful about the record | `75_lane_browser_1.json` → `livePage.facts.simulatedWords` | DC-4 below |
| F75-6 | **The lineage line could not be shown on the lane.** `dems_lane_3` has `lineage 0 row(s)` (seeded 2026-10-04, never reset); a reset is forbidden to this row. The line and its list are proven by the Live tests only (§6.2) | `db:status` in both logs | A lane that is reset by its owner (W76's demo controls) would show it |
| F75-7 | The Simulated result note "Shown here only: the demo simulator does not record the export reason yet." is no longer true (the simulator records the reason since step 54, `security-audit.test.tsx` asserts it). Unchanged (Simulated mode as before); the Live note is truthful | `packages/shared/src/i18n/en/security-audit.ts:239` | To W83 (a one-line copy fix in Simulated mode) |
| F75-8 | Two press-guard mutants (C06, X05) first "detected" by a crash: a statement starting with `(` after a line without a semicolon is a call (ASI), so every press threw. Re-run in an ASI-safe form (C06b, X05b) | `assets/75_mutations.log` | Method note for later mutation runs |

## 13. Deviations

| # | What | Why / effect |
|---|---|---|
| DV-1 | The brief's "never `cd`": five commands contained a `cd` into the repository root (00:59 a subshell around `shasum` for the pre-image list; 01:15 a status line; 01:33 the lane pass 1 command; two read-only summaries at about 01:35 and 01:37) | The working directory of every command is the repository root already, so none changed where anything ran; nothing was written outside the row's paths |
| DV-2 | The 422 test scripts the Core's refusal for a reason the contract accepts | The fake refuses to carry a body the contract rejects (F75-3); the lane's real 422 for such a reason was shown by W69 |
| DV-3 | Two lane passes (87 s in all) | Pass 2 on the finished code after the fix of F75-2; both inside the 10-minute budget |
| DV-4 | `log.ts` writes through the page reporter in both modes | [W0:§15]; not visible in Simulated mode (dev console print by the sink instead of `console.warn`) |
| DV-5 | Live: Cancel and the dialog's dismissal are held while the export is out | LB-6 (the dialog keeps what was typed), the precedent of M1b's ruling for the mobile cancel dialog [DEC:D166]; Simulated never holds |
| DV-6 | The `@dems/shared` suite started at a 1-minute load of 11.18 (the brief: below 10 before a whole suite) | It ran 16 s and passed; the whole web suite was started at 8.59 after a wait |

## 14. Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| DC-1 | The audit export file in Live mode: JSON `dems-audit-<exportId>.json` (`kind: dems-audit-export`, `source: core-server`, `exportId`, `scope`, `deviceId`, `exportedAt` on the Live clock, `reason`, `chain { rows, head }`, `rows`), the stored rows 1..`rows`, without the AUDIT_EXPORTED row; auto-download plus "Download again"; no partial file on any failure | Accept |
| DC-2 | The stored and lineage lines appear under the result of the panel's own "Verify chain" press (A9's "adds one line under the result"), not before a press | Accept; an auto-verify at mount would be an effect-started read (F69-1 rules) for no requirement |
| DC-3 | CPS1-12 (a) wording ("… (username typed, unverified)") in Live mode only; Simulated keeps the simulator's names | Accept for now; applying it in Simulated too is a deliberate Simulated change (like D156) for W83 |
| DC-4 | F75-5: keep the two Core-data "simulated" words on the Live page | Accept (truthful about the record); revisit with CONTRACT-GAP-W75-1 |
| DC-5 | CONTRACT-GAP-W75-1 and F75-1, F75-3, F75-7 | To W83 |
| DC-6 | F75-2's pattern (a Core query re-run after a session end) | Put one line into the briefs of W76, W77, W81 ("enable a Core query only while `live.session` is not null") or decide a bridge-level rule in W83 |
| DC-7 | Ledger: `@dems/core-web` 78 / 1,012 → 93 / 1,242 at 02:00 (this row: +3 files, +44 tests; the rest are W76, W77, W81 and W0's follow-up, landing at the same time) | Move the floor; this row's share is `live-security-audit-{chain,export,page}.test.tsx` (15 + 10 + 19) |

## 15. Rollback (R-CO for the tracked files, R-NEW for the new ones; not executed)

1. Pre-images: `.cache/rollback/W75/` holds the folder `apps/core-web/src/features/security-audit/` and
   `packages/shared/src/i18n/en/security-audit.ts` as they were at 00:59 (26 files, `SHA256SUMS.txt`). Copy each back:
   `cp -p .cache/rollback/W75/<path> <path>` for the 11 tracked files this row changed (`chain-panel.tsx`,
   `export-audit-dialog.tsx`, `rbac-panel.tsx`, `sim-adapter.ts`, `model.ts`, `audit-log-panel.tsx`, `auth-panel.tsx`,
   `log.ts`, `panel.tsx`, `security-audit.css`, `security-audit.ts`) — or `git checkout -- <path>` (their committed state
   equals the pre-image: none had uncommitted changes before this row).
2. Delete the new files: `F/chain-core-lines.tsx`, `F/export-file.ts`, `F/__tests__/live-security-audit-bed.ts`,
   `apps/core-web/src/test/live-security-audit-{chain,export,page}.test.tsx`.
3. Re-run `npm run test -w @dems/core-web -- --maxWorkers=2` (78 / 1,012 expected on the tree of 00:51 plus the
   other rows' files), typecheck and lint of `@dems/core-web` and `@dems/shared`.
