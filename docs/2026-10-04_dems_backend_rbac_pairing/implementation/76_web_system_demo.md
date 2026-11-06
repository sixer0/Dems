---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W76 (blueprint step 98)
title: Web System and the Demo Control Panel in Live mode (sites A8, A10, A11, B-10, C-7, D-4)
date: 2026-10-06
agent: coder-execution
source_plan: masterplan/02_plan.md (row `| W76 |`, §8.1 CLG, §11)
status: complete
tier: 2
---

# W76 — Web System and the Demo Control Panel in Live mode

Citations: `[CS:…]` is `masterplan/04_client_integration_spec.md`, `[PL:…]` the plan, code as
`path:line` from `/Users/gsp-budi/Documents/DEMS/`. Times are WIB on 2026-10-06. No credential and
no seeded password appears in this file or its assets (scanned by count, §11.6).

## 1. Result

| Check | Result | Evidence |
|---|---|---|
| CLG (a) the folder's 2 existing test files pass and are absent from `git diff --stat acaff20` | PASS — 0 diff lines; both green in every run; SHA-256 equal to the pre-images | §11.1 |
| CLG (b) one Live test per settle site (success, refusal with the `notPermitted` denied toast, outage) | PASS — A8, A10, A11, B-10, C-7, D-4 each covered; 4 new files, 66 tests | §8, §11.2 |
| CLG (c) no `useSimActions`, no `.actions` read on a `Sim` in the folder's production files | PASS — `grep` 0 code hits; static test in `live-system-settings.test.tsx` | §11.3 |
| CLG (d) lane check, lane 3 only, `DEMS_DEMO_CONTROLS=1` | PASS — 02:05:4x to 02:06:41 under the lane-3 lock; one reset on lane 3 (epoch 18 → 19); everything stopped, 4423/5178/9398 free | §9 |
| Row extra: the panel is rendered in Live mode only with `DEMO_CONTROL` AND `demoControls` (AC-C-52) | PASS — 4 Live tests + 1 Simulated control test; on the real Core: present for OPR-002 (SUPERVISOR, flag on), absent for OPR-001 | §4, §9 |
| Row extra: the log export file is built from ALL pages of operations 59 and 63 (AC-C-60) | PASS — 450 stored audit rows and 450 events in 3 + 3 pages while the ring holds 100; real Core: 155 rows = stored chain 1..155 | §5, §9 |
| CPC1-22 (the reason the Core requires) | PASS — Live mode collects it; the Core's 422 is shown on the field (F59) | §3.1 |
| SG: typecheck and lint of `@dems/core-web` | exit 0, 0 warnings | §11.4 |
| Decision D176 (F75-2): no Core read after a sign-out | PASS — the log walk asks before every page; test "D176"; mutant X10 detected | §5 point 6 |
| `npm run test -w @dems/core-web -- --maxWorkers=2` | exit 0, **93 files / 1,244 tests** at 02:20:54 (floor 93 / 1,242 of D176; plan floor 78 / 1,012) | §11.4 |
| `npm run test -w @dems/shared -- --maxWorkers=2` (+ typecheck, lint) | exit 0, 68 / 1,814; typecheck 0; lint 0 | §11.5 |
| Mutation check (M15, in memory) | 28 mutants, 27 detected; 1 survivor equal in behaviour (P02), caught by the on-disk static rule only | §10 |

## 2. What was written

All inside the row's write paths. Pre-images of the whole folder and of `en/system.ts`, with
SHA-256, under `.cache/rollback/W76/` (01:24, before the first edit).

| File | Kind | What and why |
|---|---|---|
| `apps/core-web/src/features/system/use-sim-command.ts` | changed | B-10 wrapper `useSimCommand()` → `run(command, options, onDone?, control?)` (`:69-98`): one action or a list of steps sent in order (`settleInOrder`, `:45-67`, D-4); `onDone` in `ok`; the shared presenter FIRST (`:76`), then the page's two branches (transition `:77`, generic); the pending control (`:93`). `useStartDiagnostics()` (`:112`) takes the 202 continuation (A10) and returns `{ start, busy, pending, ref }` |
| `.../system/live.ts` | new | `useSystemLiveMode()`, the AC-C-52 gate `demoPanelAllowed` / `useDemoPanelVisible` (`:31`, `:36`), the C-7 rule `newestOwnRow` (`:59`) |
| `.../system/live-log-export.ts` | new | The Live log file: the export's target from its AUDIT_EXPORTED row (`logExportTarget`, `:79`), the walk of operation 59 up to the covered rows with the chain check (`:94`, `:124`), every page of operation 63 (`:135`), the file (`:168`), `downloadJson` (`:198`, moved from `diagnostics.tsx`, unchanged except `revokeObjectURL?.`) |
| `.../system/export-logs-dialog.tsx` | new | A8 in Live mode: the reason dialog (kit `Modal`, `TextField`/`TextArea`, `FieldError`), the Core's 422 on the field, the walk with a page counter, the download, the success toast with the export ID |
| `.../system/diagnostics.tsx` | changed | `MaintenancePanel`: A11 restart through the wrapper with its pending control (`:108`); A8 Simulated exactly as before (`exportSimulated`, `:118`), Live opens the dialog (`:155`, `:239`); Run Diagnostics takes the page's pending state; Live words. `DiagnosticsModal`: "Run again" through its own starter (`:297`); no SIMULATED chip and the Live subtitle in Live mode (`:315`, `:323`) |
| `.../system/demo-panel.tsx` | changed | `useCoreActions`; one pending control for the panel's commands (`aria-busy` on the body, `:280`; the late spinner only on the pressed button by `key`); C-7 `auditNote` (`:190`); D-4 steps in order for MIC 2 clip and Clear all (`:201`, `:265`); reset and scenario load settle on the new epoch (`:239`) and are confirmed first in Live mode (`:252`, `RebuildConfirm` `:471`); Core clock line in Live mode |
| `.../system/update-panel.tsx` | changed | B-10 Install through the wrapper with its pending control (`:74`, `ref` `:90`); Live words |
| `.../system/settings-panel.tsx` | changed | B-10 live camera through the wrapper with a pending control (`:216`, disabled only after the reveal `:220`); presentation mode through `setPresentationModeEverywhere(actions, …, live, onFail)` (`:144`) |
| `.../system/sim-adapter.ts` | changed | `restartCoreServices(actions)` (`:71`) and `setPresentationModeEverywhere(actions, …)` (`:89`) take `useCoreActions()` instead of `sim.actions`; `usePreferenceWriteFailure` (`:100`); `useConsolePrefs` (`:125`): the Simulated seed RETURNED through `deferEffectStart` with the marker set inside the start (`:132-133`), nothing sent in Live mode |
| `.../system/index.tsx` | changed | A10: the modal opens in the starter's `ok` (`:50`); the demo panel gate (`:72`) |
| `.../system/quick-actions.tsx` | changed | `runBusy` → `aria-busy` on the plain Run Diagnostics card (`:104`) |
| `.../system/log.ts` | changed | The page's reporter `createPageReporter('sys')` (`:16`); `logSystemError` keeps its signature and writes ONE record to `webErrorSink` with the fixed sentence `System: the step "<source>" did not complete.` and plain context values only (`:37`) |
| `packages/shared/src/i18n/en/system.ts` | changed, additive | `system.live.*` (36 keys): Live words without "simulated", the export dialog, the demo confirmation. `git diff acaff20 … \| grep -c '^-[^-]'` → 0 |
| `apps/core-web/src/test/live-system-{maintenance,export,demo,settings}.test.tsx` | new | 16 + 13 + 22 + 15 = 66 tests (§8) |

## 3. The settle sites ([CS:§8.2–§8.4])

### 3.1 A8 — Export logs (`diagnostics.tsx:155`, `export-logs-dialog.tsx`)

- **Simulated**: unchanged. The simulator accepts `exportLogs()` without a request
  (`packages/shared/src/sim/evidence-actions.ts:268`), so the button exports at once and the file is
  the simulator's state, as before (`exportSimulated`, the old body moved into the wrapper's `onDone`).
- **Live (CPC1-22, F59)**: the button opens the dialog; nothing is sent until a reason of at least 5
  characters (after trimming; capped at 500, the contract's bounds) is submitted. One POST to
  operation 62 with `{ reason }`. The result union (CL-19):
  - 202 → `buildFile` (`export-logs-dialog.tsx:94`): the walk of §5, the download, the toast
    "Logs exported · EXP-… / n audit rows and m events in the file", the dialog closes.
  - 422 `INVALID_REASON` → the Core is the judge: `system.live.export.reasonRefused` on the field; the
    dialog keeps the reason (`:141-145`).
  - 403 → the page's existing denied toast "Log export denied · Requires the Supervisor role" (the same
    as Simulated); the dialog closes (DV-7). 401 → the existing "Sign in again" sentence.
  - No answer, 429, 503 → the presenter (outage, limit, starting); the dialog stays open with the reason (LB-6).
- **Busy**: the submit button carries the busy mark from the press until the file is built; the
  reason field is locked meanwhile (LB-1; mutation X07).

### 3.2 A10 — Run Diagnostics (`use-sim-command.ts:112`, `index.tsx:50`, `diagnostics.tsx:297`)

The starter takes a callback; the modal opens in `ok` (the Core's 202), never at the press. Both entry
points (the Maintenance button and the Quick Actions card) share the page's one pending control: the
button gets `ref` (busy mark) and `isPending` (spinner after `LIVE_PENDING_REVEAL_MS`), the card a
plain `aria-busy`. "Run again" in the modal has its own control. The per-check progress comes from the
replicated `diagnostics` slice. In Live mode the modal shows no SIMULATED chip and the Live subtitle.

### 3.3 A11 — Restart services (`diagnostics.tsx:108`)

Through the wrapper with its own pending control; the toast prints the Core's count (`{ restarted }`)
in `ok`, in Live mode as "Core services restarted" (§3.2 of [CS]). 409 `SESSION_ACTIVE` →
`SimTransitionError` → the existing friendly warning `system.maintenance.restartBlocked` and one record.

### 3.4 B-10 — the 13 commands behind the wrapper

`run(command, options, onDone, control)` keeps the three branches (permission → now the shared
presenter, transition, generic), gains the callback form, and every caller that did `if (!done) return`
moved its rest into `onDone`: the demo panel (inject, clear, time source, scenario, reset, clear all,
recover), Settings' live camera, Install, restart, export, diagnostics. A `CoreRefusalError`
`DEMO_DISABLED` is the presenter's warning "Demo controls are disabled on this Core server." (truthful:
proven by the `demoDisabled` example of operations 73 and 75).

### 3.5 C-7 — the audit note of a demo toast (`demo-panel.tsx:190`, `live.ts:59`)

Simulated: the newest row, as before. Live: the newest row **of this command** — its types
(FAULT_RAISED, FAULT_CLEARED, AUDIT_CHAIN_DISCONTINUITY), its fault kind (`details.kind`), written
after the press (`seq` above the ring's `total` at the press), by the signed-in operator **or by no
actor**. The last clause departs from [CS:§8.4 C-7]'s wording ("whose actor is the signed-in
operator") because the simulator's fault rows name no actor (`implementation/43_module_demo_controls.md`
§3: "The simulator's `inject` and `clearFault` name no actor"); a literal reading would never find the
row. No matching row → the toast carries no note rather than a wrong one.

### 3.6 D-4 — several requests of one press; a rebuild (`use-sim-command.ts:45`, `demo-panel.tsx:201,239,252,265`)

- Clearing MIC 2 clip: `clearFault` (73/74), then `resetMicClip` (52) only inside the `ok` of the first;
  Clear all: each active kind, then both latches, strictly in order; a refused step stops the chain.
- Reset (75) and scenario load (72) settle when the snapshot of the NEW epoch is applied (CL-18, the
  binding's `target: newEpoch`, `packages/shared/src/live/source/bindings.ts:434-445`). In Live mode
  both are confirmed first (`RebuildConfirm`, DV-3): they rebuild the Core's data for every console,
  and implementation/43 §9 asks for it ("A reset while a recording runs … The panel should ask the
  operator first."). While the Core rebuilds, its 503 reads "The Core server is starting"
  (CONTRACT-GAP-W76-1 for the reset's own 503).

## 4. The Demo Control Panel gate (AC-C-52, Q14, E14; [CS:§7.3 G14], DC-3)

`useDemoPanelVisible()` (`live.ts:36`): Simulated → always, as today; Live → only when the server's
session (`WebLive.session`, replaced on every change) holds `DEMO_CONTROL` **and** `demoControls` is
true (`live.ts:31`). The page renders `{showDemoPanel ? <DemoPanel /> : null}` (`index.tsx:72`): no
empty panel, no switch. It follows a `session.updated` push without a reload (test "a role change
pushed by the Core…"). The server still decides every call; a flag switched off under an open panel is
worded truthfully (`demoDisabled` tests).

## 5. The log export file (AC-C-60; `live-log-export.ts`)

1. **Target**: the AUDIT_EXPORTED row of the export in the replica (CL-16: present when `ok` runs):
   rows = its `seq − 1`, head = its `prevHash` — the Core's own count (`implementation/39` §7.4). The
   Live binding passes only the export ID (CONTRACT-GAP-W76-3), so the page reads the row.
2. **Audit**: operation 59, `limit=200`, oldest first, following `nextCursor`, until the covered rows;
   then `checkWalk`: seq 1..n without a gap, n rows, last hash = head. A refused page, a moved chain
   (422 to an old cursor after a reset) or a gap is a `LogWalkError` — **never a partial file**.
3. **Events**: operation 63, `limit=200`, every page to `nextCursor: null`.
4. **File**: `{ kind: 'dems-log-export', source: 'core-server', demo: true, notice, exportId, scope:
   'LOGS', reason, deviceId, softwareVersion, exportedAt (the row's instant), audit: { total, head,
   rows }, events, services, diagnostics }`. Server rows are written verbatim (FW76-4).
5. A walk failure: the presenter first (outage, limit; silent for a session end), then the page's own
   warning "The Core server recorded export EXP-…, but its logs could not be read to the end. No file
   was saved." and one record (`list`, `code`, `status`, never the reason).
6. **Decision D176 (finding F75-2)**: a Core read runs only while an operator is signed in. The walk
   asks before EVERY page (`live.session === null` → no request; it ends as the Core would answer,
   401 `NOT_SIGNED_IN`, and says nothing: the shell shows the login screen). The page has no other Core
   read (no `useQuery`; the demo panel reads the replica). Test "D176: no Core read after a sign-out"
   (the session ends while a page is held: page 2 of 59 and every page of 63 are never asked for, no
   file, no toast, no record); mutant X10 (the check removed) detected.

## 6. Words, preferences, the effect, the log

- **§3.2 of [CS]** ("a screen that says live shows server data"): in Live mode the page's own words
  carry no "(simulated)": restart toast and hint, Install label and toast, the diagnostics subtitle
  and chip, the export hint, "Core clock". The Simulated words are unchanged (pinned by a test). The
  demo panel's "Injected faults are simulated" stays in both modes: it describes the faults, not the
  data source.
- **Preferences and presentation mode (§8.4 F)**: written fire-and-forget as before, now through
  `settle` with the presenter (`usePreferenceWriteFailure`, the W0 meter precedent, DV-5). Live
  presentation mode is written to the Core only; the tab flag follows the server's value through the
  root route's follow-up (`apps/core-web/src/runtime/presentation-follow.ts`), so the switch never shows
  a value the Core refused (DV-6).
- **The effect (08a §15)**: the folder's one effect-started command, the Simulated preference seed,
  is RETURNED through `deferEffectStart` with its marker set inside the start (`sim-adapter.ts:132-133`);
  in Live mode the effect returns before any call (the Core's `settings` slice is the record, shared
  by every console; pushing this browser's stored copy would overwrite another console's choice — a
  write nobody made, DV-4). StrictMode proof in both modes (§8). **The guard's `ALLOWED` entry for
  `system/sim-adapter.ts` (`apps/core-web/src/test/live-strict-mode-starts.test.tsx:228-232`) is
  therefore no longer needed**; it lives in W0's file, which this row may not edit (DC-1).
- **The log**: `log.ts` binds `createPageReporter('sys')`; no `console.*`, no `error.message`, no stack.

## 7. The binding web rules (gateway_check/08 §8 with §30; 08a §15)

| Rule | How it is met |
|---|---|
| 1 one way in | `useCoreActions()` + `settle` for actions; `useWebLive()?.client.call('listAuditRows' / 'listEvents', …)` for the two reads (`export-logs-dialog.tsx:80-91`, behind the signed-in check `:78`); no `useSimActions`, `sim.actions`, `SimContext`, typed client of its own, socket |
| 2 presenter first | `use-sim-command.ts:76`, `export-logs-dialog.tsx` (both failure paths), `usePreferenceWriteFailure` |
| 3 cache contract | No Core list is cached by this row: the two walks are one-shot reads for a file, not lists; no query key starts with `core`. D176: each page read only while signed in (§5 point 6) |
| 4 no secret persisted | The reason is a purpose text (not a secret), sent in the body only, never logged (a test asserts the record holds no reason); nothing in web storage but the existing prefs mirror |
| 5 Live test needs | Docblock `http://127.0.0.1:5178/`; `clearToasts()` between tests; toast queries in `[data-slot="toast"]`; every 403 by `fake.example(op, 403, 'notPermitted')` (op 65 has none: CONTRACT-GAP-W76-2) |
| 6 the shell says it | No outage notice or role toast of the page's own |
| 7 seams | No mode switch here; nothing from `@/features/login` |
| 8 namespace | `system.live.*` in `en/system.ts` only; no new namespace file |
| 9 do not touch | `git diff --stat HEAD` of the six protected tests, `vite.config.ts`, `main.tsx`, the route file: empty (§11.3); `runtime/**`, `lib/**`, `components/**` not written |
| 08a §15 | `usePendingControl()` for every command control, `ref={…}` on the pressed kit `Button`; the effect through `deferEffectStart`, StrictMode-tested; `createPageReporter('sys')` |

## 8. The Live tests (fake transport) and what each proves

| File (tests) | Sites and criteria |
|---|---|
| `live-system-maintenance.test.tsx` (16) | A11 success (one POST to 66, the count, no "simulat"); AC-C-48 `notPermitted` → "Requires the Technician role"; 409 SESSION_ACTIVE → friendly warning + one `sys-` record without stack; outage + five presses offline → one toast, no request; LB-10 429. A10 success (modal on the 202, checks from the slice, no chip), quick-action card, 403 (role named, modal not opened), outage. B-10 Install success / 403 / 409 / outage; SUPERVISOR gates. AC-C-57/58 pending on A11 (two presses → one request, no spinner at 300 ms, spinner at the reveal, nothing added outside the button; 50 ms answer → no spinner). Simulated control group |
| `live-system-export.test.tsx` (13) | CPC1-22 reason gate (short reason refused, nothing sent); **AC-C-60** (450 stored rows + 450 events, ring 100; the exact page queries `limit=200`, `cursor=a200`, `a400`; the file's seqs 1..450, head = export head, no AUDIT_EXPORTED row; toast with the export ID); F59 422 on the field; 403 denied toast; outage keeps the dialog; 429; a failed events page → no file + record; a moved chain → no file; a gap → `CHAIN_MOVED`; busy while the pages are read; LB-1 second press; D176 no read after a sign-out; Simulated control group (no dialog, the simulator's file in the press) |
| `live-system-demo.test.tsx` (22) | **AC-C-52** (present with both; absent without the flag; absent for INVESTIGATOR and TECHNICIAN; follows a role change); B-10 inject success / `notPermitted` (Supervisor) / `demoDisabled` / outage / one command at a time; **C-7** (own row despite a newer foreign row and a newer other fault; no row → no note) + 2 pure-rule tests; **D-4** (clear then latch reset only after the clear's answer; refused first step sends no second; Clear all order); reset asks first; reset settles on the new epoch's snapshot, not the answer; scenario load; 75 `notPermitted` / `demoDisabled` / outage; 503 while rebuilding; Simulated control group |
| `live-system-settings.test.tsx` (15) | B-10 live camera success / 422 (generic + record) / outage; F prefs one POST; failed write worded; Live presentation mode to the Core only, flag after the delta; **StrictMode**: Live sends no preference on mount; Simulated seeds once; static rules (CLG (c), MD-6/TS-15, no console, presenter first, no reveal constant, the returned helper, Live words) |

## 9. The lane check (CLG (d); lane 3, `DEMS_DEMO_CONTROLS=1`)

One run inside `/usr/bin/lockf -k -t 240 .locks/core-server.lane3.lock /bin/sh .cache/w76/lane/run_lane.sh`
(sandbox bypass for that one command; `lockf exit=0`). Script = W71's with the demo flag ON for the
backend this script starts (`env DEMS_DEMO_CONTROLS=1 DEMS_CORE_PORT=4423 npm run start -w @dems/core-server`);
driver = W71's helpers + this row's steps. Sign-ins through the form from the seed source; the password
never printed. Assets: `assets/76_lane_run.log`, `76_lane_browser.json`, `76_lane_browser.log`,
`76_lane_run_lane.sh.txt`, `76_lane_cdp_driver.mjs.txt`.

```
free: 4423 5178 9398 … Google Chrome for Testing 153.0.8010.12 … cdp-driver exit 0
== 02:06:23 WIB DEMO ACTION ANNOUNCED: resetDemo (operation 75) on LANE 3 only (127.0.0.1:4423, dems_lane_3), epoch before 18
== 02:06:27 WIB DEMO ACTION DONE: epoch 18 -> 19; snapshot frames seen: []
driver done in 41 s
-- the backend's log: lines 72; lines with level error or fatal: 0
-- the demo flag as the backend read it:   1 "demoControls":true
== 02:06:41 listeners left on 4423, 5178, 9398 (expect none):
lsof exit 1 (1 with no output: no listener)
lockf exit=0
```

| Step | Observed (HeadlessChrome/153.0.8010.12, 1440×900) | Screenshot |
|---|---|---|
| OPR-002 (SUPERVISOR) on `/system`, Live | `shell-mode` LIVE; 8 panels incl. **demo**; banner "All core services running · 16 of 16 · v2.4.1 · slot A"; 16 services; Install reads "Install update"; no "simulat" in maintenance or update panels; `GET /api/v1/demo/status` 200, epoch 18 | `76_system_live_supervisor.png` |
| A10 | `POST /api/v1/system/diagnostics` 202; modal; 8 checks PASS from the slice; no "simulat" | `76_diagnostics_live.png` |
| A8 with a reason (48 characters) | `POST /api/v1/logs/export` 202 (EXP-000034); 1 page of 59, 1 page of 63; the file: 155 audit rows, seq 1..155, head `73ddc5341e7b` = the stored head before the export (155 rows), 117 events, 16 services; toast "Logs exported · EXP-000034 / 155 audit rows and 117 events in the file" | `76_export_dialog_live.png`, `76_export_done_live.png` |
| ONE demo action, lane 3 | panel opened; Reset → the confirmation; confirmed → `POST /api/v1/demo/reset` 200; toast "Demo reset: idle scenario, faults cleared"; `getDemoStatus` epoch 18 → **19**, `lastResetAt` the reset's instant; backend: `engine started … mode reset, epoch 19`, `demo reset done … previousEpoch 18, epoch 19` | `76_demo_panel_live.png`, `76_demo_reset_confirm_live.png`, `76_demo_reset_done_live.png` |
| OPR-001 (INVESTIGATOR), same page | 7 panels, **no demo panel** | `76_system_live_investigator.png` |

**The new epoch in the console.** The console announced the reset only after the snapshot of epoch 19
was applied (CL-18: the toast is in the action's `ok`, which the Live source runs when the store holds
that epoch; proven on the fake by "confirmed: … the toast waits for the snapshot of the NEW epoch");
the next page load of the same Core received `hello@epoch=19` and `snapshot@epoch=19`
(`76_lane_browser.json`, `liveInvestigator.network`). The epoch-19 frame on the supervisor's already
open socket was **not recorded** by the driver: W71's `takeNetwork()` replaces its socket map, so a
socket opened before it is no longer followed (FW76-2). Re-running would have needed a second demo
action, which the brief does not allow; DV-10.

## 10. Mutation check (M15: no file of the tree modified)

W0's in-memory pattern (`assets/76_mutation_config.mts.txt`, runner `76_mutation_runner.py.txt`, log
`76_mutations.log`): one text replacement in one module in a Vite transform; a marker under `$TMPDIR`
proves it ran; detected = Vitest exit ≠ 0; SHA-256 of every mutated file before and after each batch
("identical" in all six batches); baselines green.

| Class | Mutants | Detected |
|---|---|--:|
| Wrapper (presenter skipped, no `onDone`, no pending control, no transition branch) A01–A03, A06 | 4 | 4 |
| A11 words, A10 modal at the press A04, A05 | 2 | 2 |
| A8 / AC-C-60 (no dialog in Live, one page of 59, one page of 63, partial file, no chain check, 422 not on the field, release before the walk, no client bound) X01–X03, X05–X09 | 8 | 8 (X07, X08 after two added tests) |
| D176: the walk keeps asking after a sign-out X10 | 1 | 1 |
| AC-C-52 gate G01–G03 | 3 | 3 |
| C-7 C01–C04 | 4 | 4 (C03, C04 after two added pure tests) |
| D-4 D01, D02, D04 | 3 | 3 |
| Preferences P01–P03 | 3 | 2 — **P02 survived** |
| **Total** | **28** | **27** |

P02 (the seed started in the set-up instead of through `deferEffectStart`) is equal in behaviour under
StrictMode because the ref marker survives React's simulated remount; it is caught only by the static
rule of `live-system-settings.test.tsx`, which reads the file on disk and therefore cannot see an
in-memory mutation (the same limit W0 states for its guard, 08a §11).

## 11. Verification (quoted; full logs in `assets/76_gate_*.log`)

### 11.1 CLG (a)

```
## 2026-10-06 02:12:35 WIB CLG (a): the folder's existing tests, absent from the diff against acaff20
$ git diff --stat acaff20 -- apps/core-web/src/features/system/__tests__
(lines: 0)
19c4126643eced6fda47b5bccc13d62614b3b6961470d33abec391d6df886c4d  apps/core-web/src/features/system/__tests__/system-model.test.tsx
07c6a56037292477c9e48a3708e267f241c42a130cfb2a60e312e0b9214c14da  apps/core-web/src/features/system/__tests__/system-page.test.tsx
```
Both values equal `.cache/rollback/W76/sha256_pre.txt`. Both files pass in every run (§11.4).

### 11.2 CLG (b) and the two row extras

```
## 02:13:06 $ npm run test -w @dems/core-web -- --maxWorkers=2 src/features/system src/test/live-system- src/test/live-strict-mode-starts.test.tsx src/test/live-pending-control.test.tsx src/test/live-runtime-static.test.tsx
 Test Files  9 passed (9)
      Tests  123 passed (123)
```
Site → test: A8 "A8 success / refusal / outage / pending"; A10 "A10 Run Diagnostics"; A11 "A11 Restart
services"; B-10 "B-10 Install", "B-10 the panel's commands", "B-10 the live camera"; C-7 "C-7 the audit
note"; D-4 "D-4 one request after the other", "D-4 reset and scenario load". AC-C-52: "AC-C-52 the
gate" + "Simulated mode is unchanged (AC-C-52, second half)". AC-C-60: "A8 success (§8.2 A8; AC-C-60)".

### 11.3 CLG (c) and rule 9

```
$ grep -rn "useSimActions" apps/core-web/src/features/system --exclude-dir=__tests__ | wc -l
0
$ grep -rnE "[A-Za-z_)]\.actions\b" apps/core-web/src/features/system --exclude-dir=__tests__ | grep -v "common\.actions\."
apps/core-web/src/features/system/sim-adapter.ts:17: * as before in Simulated mode, CL-12) instead of reading `sim.actions` (AC-C-53). In Live mode the
$ git diff --stat HEAD -- apps/core-web/src/test/routes.test.tsx apps/core-web/src/test/sim-fetch.test.ts apps/core-web/src/features/storage/__tests__/storage-page.test.tsx apps/core-web/src/lib/__tests__/core-endpoint.test.tsx apps/core-web/src/lib/__tests__/packaged-csp.test.ts apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx apps/core-web/vite.config.ts apps/core-web/src/main.tsx apps/core-web/src/routes/_app/system.tsx
(empty above = unchanged)
```
The one `.actions` hit is a doc comment; the static test strips comments and finds none.

### 11.4 The web gate

```
## 2026-10-06 02:18:44 WIB  2:18  2 users, load averages: 2.65 5.41 7.30
## $ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  93 passed (93)
      Tests  1244 passed (1244)
exit=0
## end 02:20:54
## 2026-10-06 02:18 WIB (after decision D176) $ npm run typecheck -w @dems/core-web
exit=0
## $ npm run lint -w @dems/core-web
exit=0 (warnings: 0)
```
The pass before the D176 change (02:07:50 to 02:11:34) was also green: 93 files / 1,242 tests, exit 0.
The whole run includes the in-flight files of W75, W77 and W81 and the two shared files of decision
D172 (`runtime/testing/live-harness.ts`, `test/live-pending-control.test.tsx`): all green at 02:11 and
at 02:20; no red file to name. The
log carries the sandbox's `ERROR: failed to copy trust settings of system certificate-25291` lines
(keychain access inside the sandbox), which are not test results.

### 11.5 The shared gate

```
## 2026-10-06 02:11:57 WIB  2:11  2 users, load averages: 10.31 10.58 9.36
## $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
exit=0
## 02:12:08 $ npm run typecheck -w @dems/shared
exit=0
## 02:12:12 $ npm run lint -w @dems/shared
exit=0
```
(The 1-minute load was 3.71 at the start of the web run; 10.31 at the shared run, which is not a whole
web suite.)

### 11.6 Secret scan (by count, never by value)

```
76_lane_run.log / 76_lane_browser.json / 76_lane_browser.log / 76_lane_cdp_driver.mjs.txt /
76_lane_run_lane.sh.txt / core-server.lane3.log / 76_gate_*.log / 76_mutations.log:
seeded password occurrences 0; credential-prefixed tokens 0
```

### 11.7 Test ledger (P24)

| Workspace | Before (floor) | Measured | This row's additions |
|---|--:|--:|---|
| `@dems/core-web` | 78 / 1,012 (plan); 93 / 1,242 (D176) | 93 / 1,244 (with other rows' in-flight files) | +4 files, +66 tests: `live-system-maintenance` 16, `live-system-export` 13, `live-system-demo` 22, `live-system-settings` 15 |
| `@dems/shared` | 68 / 1,814 | 68 / 1,814 | none (i18n keys only) |

## Contract gaps found

| ID | Where | Gap | Effect here |
|---|---|---|---|
| CONTRACT-GAP-W76-1 | `packages/shared/src/live/errors.ts:50-69` (`LiveTransportError` keeps status, code, retry-after, request ID); with CONTRACT-GAP-W43-1 (`packages/shared/src/api/demo-controls.ts`: `details.reason` values undocumented) | The reset's and the scenario load's own 503 `NOT_READY` carries `details.reason` `RESET_IN_PROGRESS` or `RESET_FAILED` (implementation/43 §9); the Live layer drops `details`, so the page cannot tell "another reset is running, try again" from "this reset did not happen" | Both read the presenter's "The Core server is starting. Nothing was changed." (test "a 503 while the Core rebuilds…"). For W83 and the Live source's owner |
| CONTRACT-GAP-W76-2 | `CORE_API_EXAMPLES.runDiagnostics.responses[403]` = `deviceRevoked`, `originNotAllowed` | Operation 65 has no `notPermitted` example (every seeded role holds DIAGNOSTICS_RUN; the pattern of CONTRACT-GAP-W63-1 for operation 49) | The A10 refusal test writes the envelope with `refusal(403, 'NOT_PERMITTED', …, { permission: 'DIAGNOSTICS_RUN' })` |
| CONTRACT-GAP-W76-3 | `packages/shared/src/live/source/bindings.ts:248-252` (`exported`) | The 202 of operation 62 is mapped to `{ ok, status, exportId }`; the answer's `rows` and `head` (the chain the export covers) do not reach the page | The page re-derives them from the AUDIT_EXPORTED row in the replica (seq − 1, prevHash), as W75 does; if that row has left the 1,000-row ring, the walk stops at the export's row instead. For the Live source's owner / W83 |

## Findings

| ID | Finding | Evidence | For |
|---|---|---|---|
| FW76-1 | A `SimTransitionError` rebuilt from a 422 carries a code but no HTTP status, so the page record of that branch has no `status` (the reporter names what the error holds) | `live-system-settings.test.tsx`, "a refusal the presenter leaves to the page (422)" | W83 (record shape) |
| FW76-2 | W71's lane driver helper `takeNetwork()` replaces its socket map, so frames on a socket opened before the call are not recorded; the epoch-19 snapshot on the open socket was missed | `76_lane_browser.json` `d4Reset.snapshotFrames: []` while `liveInvestigator` shows `hello@epoch=19`, `snapshot@epoch=19` | later rows' lane drivers |
| FW76-3 | The presenter's outage sentence ends "Nothing was changed." — true of the failed page read, but it stands beside "The Core server recorded export …" after an accepted export | `live-system-export.test.tsx`, "a page of operation 63 that gets no answer" | W83/W88 wording |
| FW76-4 | F63-4 shows in the downloaded log file, not on screen: the Core's restart audit message "… restarted (simulated)" (`packages/shared/src/sim/maintenance.ts:225`) is server data and is written verbatim; the System page renders no audit message | `live-log-export.ts` writes rows as received | W83 |
| FW76-5 | Two walkers of operation 59 with the same rules now exist in parallel rows: W75's `features/security-audit/export-file.ts` and this row's `features/system/live-log-export.ts` | both files | one helper in `lib/` at close-out (W83/W88) |
| FW76-6 | The kit `Select` drops `aria-busy` like the kit `Button` (F63-2); the live camera Select is guarded and disabled only after the reveal, without a busy mark | `settings-panel.tsx:220` | W83 |
| FW76-7 | The lane screenshots show the shell's "ATTENTION — Some checks need attention" pill: the integrity summary of the lane's seed, not this page | `76_system_live_supervisor.png` | information |

## Deviations

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | Document name `76_web_system_demo.md` (the brief) — the plan's §8.7 names `76_web_system_demo_panel.md` | The brief is the newer instruction |
| DV-2 | Four `cd` in two early commands (01:24, the pre-image copy: `cd /Users/gsp-budi/Documents/DEMS` and `(cd $R && shasum …)`; ~01:30, an example listing: `cd /tmp`, `cd $R`) | Slips against "never `cd`"; both commands stayed in the repository or `/tmp`, the first wrote only `.cache/rollback/W76/`, the second failed before running anything. Not repeated |
| DV-3 | Live-only confirmation before a reset or a scenario load ([CS:§8.4 D-4] names none) | They rebuild the Core for every console; implementation/43 §9 asks the panel to ask first. Simulated: no dialog, as before |
| DV-4 | Live mode sends no stored preference on mount ([CS:§8.4 F] says "no change" for `sim-adapter.ts:98`) | The Core's `settings` slice is shared and persistent; a mount write would overwrite another console's choice |
| DV-5 | The two fire-and-forget preference writes run through `settle` with the presenter ([CS:§8.4 F]: no change needed) | A refusal, a limit or an outage is worded instead of silent; W0's meter precedent (08a §5); Simulated identical (the simulator never throws there) |
| DV-6 | Live presentation mode is written to the Core only; the tab flag follows the server | The switch shows only what the Core accepted |
| DV-7 | A 403 of the export closes the dialog | The role cannot export; the gate corrects itself by CL-23 |
| DV-8 | Simulated mode, invisible differences: the seed runs one task later (`deferEffectStart`); a `SimPermissionError` writes no dev-console warn record any more (the presenter words it, 08a §15); records go to `webErrorSink` (printed in dev) instead of `console` directly | Rules of 08a §15; no screen difference; the folder's tests unchanged and green |
| DV-9 | The `ALLOWED` entry of `system/sim-adapter.ts` in W0's guard is retired in code but stays in `live-strict-mode-starts.test.tsx` | The file is not in this row's write paths (DC-1) |
| DV-10 | The lane evidence for the new epoch is the settle, `getDemoStatus` 18 → 19, the backend log and the next page load's frames — not the frame on the open socket | FW76-2; one demo action only |

## Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| DC-1 | Remove the `system/sim-adapter.ts` entry from `ALLOWED` (`apps/core-web/src/test/live-strict-mode-starts.test.tsx:228-232`, W0's file) | Grant to W0's owner; the effect now returns `deferEffectStart` (`sim-adapter.ts:132-133`) and the guard passes without the entry by its own reading |
| DC-2 | Ratify DV-3 (Live confirmation), DV-4 (no Live seed), DV-5/DV-6 (preferences through the presenter; Core-only presentation write), DV-7 | Ratify |
| DC-3 | CONTRACT-GAP-W76-1 and -3 to the Live source's owner and W83; -2 to W83 with CONTRACT-GAP-W63-1 | Route |
| DC-4 | FW76-5: one walker of operations 59/63 in `lib/` | At the close-out row, after W75 lands |
| DC-5 | Ledger: `@dems/core-web` +4 files, +66 tests by this row (measured whole: 93 / 1,244) | Move the floor after the controller's own gate |
| DC-6 | Lane 3 was reset at 02:06:24 WIB (epoch 19, lineage 1): W75, W77, W81 lane checks after that see a fresh seed and "Earlier chains: 1" | Inform the three rows |

## State left in `dems_lane_3`

`db:status` before / after (`assets/76_lane_run.log`): the reset rebuilt the database from the seed.

| Item | Before | After |
|---|---|---|
| Epoch (`getDemoStatus`) | 18 | 19 |
| `seeded_at` / `last_reset_at` | 2026-10-04T04:36:43.575Z | 2026-10-05T19:06:24.606Z (02:06:24 WIB) |
| Audit head | seq 153 (156 at the reset, after this row's export and sign-ins) | seq 86 |
| Lineage | 0 rows | 1 row: reset_no 1, epoch 18, rows 156, actor OPR-002, reason RESET, scenario idle |
| `audit_log` / `events` / `exports` / `evidence_custody` | 153 / 114 / 3 / 32 | 86 / 63 / 1 / 28 |
| `auth_sessions` | 22 | 24 (this row's two sign-ins; sessions are kept by a reset) |

No fault was injected (no fault to clear). Both operators were signed out at the end (204). The lane's
log and pid files were rewritten / emptied as W50 leaves them. Port 5432 was never named; 5173–5175,
4400, 4420 and lanes 1 and 2 were neither used nor touched.

## Rollback (not executed; class R-CO plus the row's new files)

1. `cp -p .cache/rollback/W76/apps/core-web/src/features/system/* apps/core-web/src/features/system/`
   (the 16 production files) and `cp -p .cache/rollback/W76/packages/shared/src/i18n/en/system.ts packages/shared/src/i18n/en/system.ts`
   — equivalently `git checkout acaff20 -- apps/core-web/src/features/system packages/shared/src/i18n/en/system.ts`
   (both unchanged since `acaff20` before this row).
2. Delete the row's new files: `apps/core-web/src/features/system/{live.ts,live-log-export.ts,export-logs-dialog.tsx}`,
   `apps/core-web/src/test/live-system-{maintenance,export,demo,settings}.test.tsx`.
3. Re-run the web gate. The lane reset cannot be undone (the discarded chain is recorded in the lineage);
   it needs no undo: lane 3 holds seed data only.

## Files

Created (7): `apps/core-web/src/features/system/live.ts`, `.../live-log-export.ts`,
`.../export-logs-dialog.tsx`, `apps/core-web/src/test/live-system-maintenance.test.tsx`,
`.../live-system-export.test.tsx`, `.../live-system-demo.test.tsx`, `.../live-system-settings.test.tsx`.

Updated (10): `apps/core-web/src/features/system/{use-sim-command.ts,sim-adapter.ts,diagnostics.tsx,demo-panel.tsx,update-panel.tsx,settings-panel.tsx,quick-actions.tsx,index.tsx,log.ts}`,
`packages/shared/src/i18n/en/system.ts` (additive).

Documents: this file; `delegation_progress/coder_execution_step_98.md`; assets `76_*` (8 screenshots,
`76_lane_{run.log,browser.json,browser.log,run_lane.sh.txt,cdp_driver.mjs.txt}`,
`76_gate_{web,web_full,shared,clg}.log`, `76_mutations.log`, `76_mutation_runner.py.txt`,
`76_mutation_config.mts.txt`). Scratch: `.cache/w76/`, pre-images `.cache/rollback/W76/`.
