---
task_id: W66
task_slug: mobile-home-more-live
blueprint_step: 88
plan_rows: "84, 85 (merged)"
date: 2026-10-05
agent: coder-execution
status: complete
gate: CLG (SG + a, b, c, d)
rollback_class: R-CO (plus the new files: R-NEW)
pre_image: .cache/rollback/W66/ (the five edited files, byte-equal to acaff20 at the start; pre.sha256 of both folders)
---

# W66 — Mobile Home and More in LIVE mode (display only)

**Row**: W66 (blueprint step 88, plan rows 84 and 85 merged) [PL:§8.4 row W66]. **Time**: 2026-10-05
22:39–23:50 WIB. **Status**: complete. Requirement IDs: FC-1, MD-8, MD-9, AC-C-30, AC-C-48 (and, through
CLG, AC-C-53, AC-C-101).

Citations follow the plan's convention (`masterplan/02_plan.md` line 81): `[CS:…]` is
`masterplan/04_client_integration_spec.md`, `[PL:…]` the plan, `[CP:…]` `gateway_check/09_cp_mobile_runtime.md`,
`[M0:…]` `gateway_check/09a_m0_link_rule.md`, code as `path:line` from the repo root. No credential,
token, password or pairing code appears in this file or its assets.

---

## 1. Result at a glance

| Item | Result |
|---|---|
| Core chips (MD-8, AC-C-30) | One rule for both chips: "Simulated" in SIMULATED and HEARTBEAT mode, "Live" only in LIVE mode, "Offline" when the link is down — in LIVE decided by the runtime's M0 rule, never by `link.state` |
| Home chip placement (MD-9) | LIVE: in the header of every layout class. SIMULATED and HEARTBEAT: expanded header only, as before |
| Copy | LIVE never claims a simulation: More's footer note reads "Data from the Core server" in LIVE (it read "Simulated data for demonstration"). No `SIM-GAP` marker added (KI-07: 13 IDs / 62 markers, as at `acaff20`) |
| The one Core call of the folders | Home's acknowledge-an-alert (operation 70, fire-and-forget) takes its action from `useCoreActions()`, goes through `settle`, and hands a rejection to the refusal presenter first (AC-C-48, AC-C-53) |
| Contract gaps | CONTRACT-GAP-W66-1 (no media reference in the replicated session history → LIVE rows show the brand still, MS-2), CONTRACT-GAP-W66-2 (operation 70 has no `notPermitted` example; test-only) |
| Tests | +4 suites / +33 tests in the two folders; the six existing test files unchanged (not in `git diff --stat acaff20`) |
| Whole mobile suite | **110 suites / 1,395 tests, exit 0** (final, 23:43, load 3.1); earlier 101 / 1,290 (23:03) and 108 / 1,379 (23:39) exit 0; between them one red suite of the parallel Evidence row, green again on re-check (§6.5) |
| typecheck, lint | **exit 0, exit 0** (final, 23:45); eslint JSON **0 errors, 0 warnings** workspace-wide (490 files); a parallel row's type error seen 23:32–23:36 was gone at 23:39 (§6.5, F-6) |
| Mutation check (rule M15, in memory) | **20 of 20 detected**; the mutated files byte-identical before and after (§6.4) |
| Device check (lane 1, phone) | One sitting, 23:09:25–23:11:29, exit 0: Home and More in LIVE, Home in SIMULATED, launch with `core=SIMULATED` stored; everything stopped; lock status identical before and after (§7) |

## 2. Sources read first

| Source | Used for |
|---|---|
| [PL] row W66 (line 740), citation convention (line 81), gates SG and CLG (line 645-647), rollback classes | scope, write paths, verification cell |
| [CS:§3.1, §3.2 MD-8, MD-9, §3.5, §7.1, §7.4 (rows `features/dashboard`, `features/more`), AC-C-30, AC-C-48, §17.2 FC-1] | the chip table, the copy rule, the fire-and-forget rule of §7.1 ("still takes its actions from `useCoreActions`") |
| [CP:§4 answer 3] — the ten binding mobile rules | §5 below, rule by rule |
| [M0:§4, §7, §10] | the chip's LIVE "Offline" through `coreLinkViewOf` + `offlineNoticeAfter` with the render-time adjustment |
| `implementation/51_mobile_runtime.md` §4 | the runtime surface; building a Live source in a test |
| `implementation/60_mobile_pairing_gate.md` §7, `59_mobile_login.md`, assets `60_run_w60f.sh`, `60_device_w60f.sh`, `60_sign_in_live4.mts` | the device-check procedure and the scripted sign-in, reused |
| `01_specs.md` MS-1, MS-2 (lines 1351, 1364); `packages/shared/src/api/evidence.ts:80-101` | what media a client may show in LIVE |

## 3. What was built

### 3.1 The chip rule (MD-8, AC-C-30) — `apps/mobile/src/features/more/more-model.ts:95-123`

`coreLinkWordKey(link, liveOffline)` (`more-model.ts:114`) and `coreLinkTone(word)` (`:120`) replace the
two functions of `acaff20` that printed "Live" for any source but SIMULATED.

| Source | Link | Word | Tone | Before |
|---|---|---|---|---|
| SIMULATED | always up | Simulated | info | same |
| HEARTBEAT | mock-core heartbeat up | **Simulated** | info | "Live", success (FC-1) |
| HEARTBEAT | mock-core heartbeat down | Offline | danger | same |
| LIVE | M0 says not down | Live | success | "Live" whenever `state` was ONLINE |
| LIVE | M0 says down | Offline | danger | "Offline" whenever `state` was not ONLINE (a reconnect attempt flickered it) |

Why: [CS:MD-8] "they print 'Simulated' in HEARTBEAT mode (tone `info`) and 'Live' only when the source is
LIVE; the accessibility label keeps naming the source". The labels stay "Core link: {state} ({source})",
so HEARTBEAT reads "Core link: Simulated (mock-core heartbeat)".

### 3.2 The chip hook (M0) — `apps/mobile/src/features/more/use-core-link-chip.ts` (new, 54 lines)

`useCoreLinkChip()` (`:36`) is M0's snippet word for word: `coreLinkViewOf(link)`, `useState(view)` (`:40`),
`useState(() => offlineNoticeAfter(false, view))` (`:41`), and the render-time adjustment
`setOffline(offlineNoticeAfter(offline, view))` (`:44`). No ref, no effect, no timer, no hold time; the
input is `useCoreLink()` itself, never its `state` and never a bare `heartbeat` [M0:§10]. It returns the
word, tone, icon, the source (for the label) and `live: link.source === 'LIVE'` (`:52`, rule 5). Outside
LIVE the view is `none`, so the M0 state is false and SIMULATED/HEARTBEAT keep their rule of before.

Both chips call it: the Home header (`home-header.tsx:126-145`) and the More footer (`more-links.tsx:156-181`).
One hook in `features/more/` imported by `features/dashboard/` (precedent: `session-summary` imports from
`session-finalizing`), so the two chips cannot drift apart again.

### 3.3 Home header — `apps/mobile/src/features/dashboard/home-header.tsx`

| Line | Change | Why |
|---|---|---|
| `:57` | `const live = useCoreLink().source === 'LIVE'` | rule 5's idiom |
| `:83` | `{layoutClass === 'expanded' \|\| live ? <CoreLinkChip /> : null}` | MD-9: every class in LIVE, expanded only otherwise |
| `:126-145` | `CoreLinkChip` reads `useCoreLinkChip()` | §3.1, §3.2 |
| `:179-194` | `useCoreActions()` (was `useSimActions()`); `settle(() => actions.acknowledgeAlert(id), { fail })`; `if (presentCoreError(error)) return;` then the existing `reportRuntimeIssue('warn', …)` | [CS:§7.1] fire-and-forget files still take `useCoreActions` (AC-C-53); rule 2: the presenter first. Simulated: the simulator's `acknowledgeAlert` throws nothing in a signed-in session (`packages/shared/src/sim/faults.ts:401-405`), so Simulated behaviour is unchanged |

### 3.4 Recent sessions — `apps/mobile/src/features/dashboard/recent-sessions.tsx:76-80`

In LIVE a row shows the brand still (`HERO_STILL`, the picture a row without a poster already showed);
Simulated keeps the D61 join on the evidence number. Why: [SP:MS-2] "a client shows bundled media for an
item only when the server's `EvidenceMediaRef.source` is `DEMO_PACKAGE`", and the replicated
`SessionHistoryEntry` carries no media reference (`packages/shared/src/sim/types.ts:397-418`) —
CONTRACT-GAP-W66-1 (§4). The device captures show the difference: brand still in LIVE
(`66_phone_home_live.png`), the bundled posters in SIMULATED (`66_phone_home_simulated.png`).

### 3.5 More footer — `apps/mobile/src/features/more/more-links.tsx:150-182`, `i18n.ts:88`

The footer chip takes `useCoreLinkChip()`; the note reads `features.more.footer.liveNote` ("Data from the
Core server") in LIVE and the unchanged `demoNote` ("Simulated data for demonstration") otherwise. A
`testID="more-footer-note"` was added to the note (invisible). The "DEMO" chip stays (decision DN-2).

### 3.6 What Home and More show in LIVE without a change

Every panel reads `useSim` selectors; in LIVE the store is the Live source's replica [CS:§2.3], so the
status card, tiles, quick actions, recent rows, sealed-today count, chip row, device tiles, clock, bell
and its alerts, the operator card, the console tiles and the pairing row show the Core's data. Seen on
the device: operator "AKP Andi Pratama", OPR-002, "Signed in 23:10" (the server's `issuedAt`), "118
events" (the lane database had 116 audit rows before the run, `66_device_run.log`), "Core: Interview Room
1" (the Core's name from the pairing). The expanded device tiles keep the bundled camera loops: by
decision MS-1 the server serves no media ("the clients keep their bundled demo media",
`01_specs.md:1351`), as the web Dashboard does (`apps/core-web/src/features/dashboard/devices-panel.tsx:259`).

## 4. Contract gaps found

| ID | Where | What | Local adapter | For W83 |
|---|---|---|---|---|
| CONTRACT-GAP-W66-1 | `apps/mobile/src/features/dashboard/recent-sessions.tsx:76` (marker in code) | `SessionHistoryEntry` (replicated `sessionHistory`) and the replicated evidence items carry no `EvidenceMediaRef`; only operation 40 `getEvidence` does, one item per call. Home cannot tell a demo package from a session recorded in Live mode (`NONE`) | LIVE rows show the brand still; no per-row operation 40 call from Home (a GET per row per visit, and a 403 audit row for a role without evidence access) | Add `mediaSource` (or the `EvidenceMediaRef`) to the replicated history entry or evidence item; then the adapter reads it and the marker goes |
| CONTRACT-GAP-W66-2 | `apps/mobile/src/features/dashboard/home-live.test.tsx:179` (test only) | Operation 70 `acknowledgeAlert` has no `notPermitted` example: every signed-in role may call it (`packages/shared/src/api/alerts.ts:79-100`), so a 403 NOT_PERMITTED cannot occur by the contract; the test writes the envelope to prove the presenter path (as W63 did, CONTRACT-GAP-W63-1) | none needed | Probably "by design, no change"; or add an example if the denial path is to be documented |

## 5. The ten binding rules [CP:§4 answer 3], how each holds

| # | Rule | How |
|---|---|---|
| 1 | One way in | `useCoreActions()` + `settle` (`home-header.tsx:179,188`); no `useSimActions`, no `.actions` read on a `Sim` (static test, §6.2; `66_clg_a_c.log`) |
| 2 | Presenter first; `resetCoreErrorPresenterForTests()` in `beforeEach` | `home-header.tsx:190`; both Live test files reset it |
| 3 | No Core address, no network API | static test "the folders name no network API …" |
| 4 | No credential | the bed seeds the secure-store mock through its global with the shared placeholders (report 51 §4); nothing in the folders names a credential or the wrapper |
| 5 | One LIVE idiom | `useCoreLink().source === 'LIVE'` (`home-header.tsx:57`, `recent-sessions.tsx:79`, `use-core-link-chip.ts:52`); static test forbids `useCoreMode`, preference reads |
| 6 | React Compiler: render-time adjustment | `use-core-link-chip.ts:40-45`; lint 0/0 |
| 7 | Timers on the store's clock | the hook reads no clock at all (M0's rule has no window) |
| 8 | Truthful chips and copy; no `SIM-GAP` | §3.1, §3.5; `no simulat` scans over every rendered text and label of Home (4 classes) and More (4 classes); KI-07 13 / 62 = `acaff20` |
| 9 | Do-not-touch list | written only `features/dashboard/**`, `features/more/**` (§9); the six existing test files unchanged |
| 10 | Ledger; device conditions | §6.3; §7 (ends with `core=SIMULATED`, `DEV-0001` kept, lock untouched) |

## 6. Verification

### 6.1 The Live tests (CLG b) — fake transport, the app's own Live source

The bed `apps/mobile/src/features/dashboard/testing/live-home-bed.tsx` (test-only; `testing/` folders are
outside every production scan) models the Core: one paired tablet, one operator session, the replicated
state as the operator socket's snapshot, operation 70 as the Core does it (a delta, then 204), and a switch
that makes the server unreachable (requests are outages; each new socket stays CONNECTING for 1 s, then
is refused, so the reconnect attempts are visible).

| File | Tests | What |
|---|--:|---|
| `features/more/use-core-link-chip.test.tsx` | 10 | AC-C-30 matrix ("Live" for exactly one input class), tones, HEARTBEAT up/down, LIVE outage with exactly two flips, answers equal to `offlineNoticeAfter` step by step, cold start without a flash, leaving LIVE |
| `features/dashboard/home-live.test.tsx` | 9 | LIVE: "Core Live" (text, label and the `StatusChip` tone) in all four layout classes and no `simulat`/`mock-core` word under `screen-home`; the session's operator and the Core's recent rows, brand still on every row (with the control that the row's number has a bundled poster); no false "new seal" toast on sign-in although the Core holds items sealed today; outage — "Offline" through every CONNECTING/OFFLINE attempt, back at the first heartbeat, last state kept; acknowledge: success (request + delta clears the bell), 403 (denied toast, alert stays, second press sends again), outage (the presenter's one "Core server unreachable" toast). SIMULATED: no chip except expanded, bundled poster kept. HEARTBEAT: "Core Simulated", label "(mock-core heartbeat)", "Offline" when mock-core drops, no chip on phones |
| `features/more/more-live.test.tsx` | 5 | LIVE: "Core Live" (text, label, tone) + "Data from the Core server" in all four classes, no `simulat` word under `screen-more`; operator, pairing with the Core's name, audit count of the replica; outage like Home's; More sent no Core action. SIMULATED and HEARTBEAT chips and note |
| `features/dashboard/home-more-live-static.test.ts` | 9 | CLG (c) and rules 3, 4, 5, 8 over both folders' production files (§6.2) |

`npm run test -w @dems/mobile -- --maxWorkers=2 src/features/dashboard src/features/more` (23:01; the tests were strengthened after the first mutation run, §6.4, and all ten suites pass again in the final gate, §6.5):

```
Test Suites: 10 passed, 10 total
Tests:       79 passed, 79 total
```

### 6.2 CLG (a) and (c) (`assets/66_clg_a_c.log`, 23:09:39)

```
## CLG (a): the folders' existing test files vs acaff20 (expect no output)
$ git diff --stat acaff20 -- $(git ls-tree -r --name-only acaff20 apps/mobile/src/features/dashboard apps/mobile/src/features/more | grep -E "\.test\.tsx?$")
exit=0                                   <- no output: the six files are byte-equal to acaff20
-- the existing test files of the two folders at acaff20:
apps/mobile/src/features/dashboard/dashboard-route.test.tsx
apps/mobile/src/features/dashboard/dashboard-screen.test.tsx
apps/mobile/src/features/dashboard/home-model.test.ts
apps/mobile/src/features/dashboard/panel-boundary.test.tsx
apps/mobile/src/features/dashboard/use-held-value.test.tsx
apps/mobile/src/features/more/more-screen.test.tsx
$ git diff --stat acaff20 -- apps/mobile/src/features/dashboard apps/mobile/src/features/more
 apps/mobile/src/features/dashboard/home-header.tsx | 54 +++++++++++++++-------
 .../src/features/dashboard/recent-sessions.tsx     | 12 ++++-
 apps/mobile/src/features/more/i18n.ts              |  2 +
 apps/mobile/src/features/more/more-links.tsx       | 24 +++++-----
 apps/mobile/src/features/more/more-model.ts        | 35 ++++++++++----
 5 files changed, 90 insertions(+), 37 deletions(-)

## CLG (c): useSimActions and .actions on a Sim in the folders' production files
$ grep -rnE 'useSimActions|\b(sim|test\.sim|instance|live)\.actions\b' <production files of both folders>
exit=1 (1 = no match)
-- every '.actions' token left: styles.actions (2), HOME_BEATS.actions (motion beat), and i18n keys
   'common.actions.*' / 'features.dashboard.actions.*' inside quotes

## KI-07: SIM-GAP markers in apps/mobile/src, now and at acaff20
now: 13 IDs / 62 markers
acaff20: 13 IDs / 62 markers
```

The static test holds the same in the suite: `no production file calls the simulator's action hook`;
`every .actions left is a style or a motion beat` (`home-header.tsx: styles.actions`,
`quick-actions.tsx: HOME_BEATS.actions`, `operator-card.tsx: styles.actions`); Home's one call is
`useCoreActions` → `settle(() => actions.acknowledgeAlert(id), …)` → `presentCoreError` first; no network
API, Core address, storage package or Live source module; through the runtime barrel only, with the one
older exception pinned (`home-model.ts` imports `resyncTarget` from `@/runtime/route-sync` since `acaff20`,
F-8); the Simulated copy is `acaff20`'s (Home 79 texts, digest `500fccbf…`; More 43 texts plus `liveNote`,
digest `54af2d74…`, both built from `git show acaff20:…/i18n.ts`).

### 6.3 SG: the whole workspace (`assets/66_gate_mobile_test_1.log`; final gate §6.5)

```
## 2026-10-05 23:02:16 WIB 23:02  2 users, load averages: 5.64 5.13 4.86
## $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 101 passed, 101 total
Tests:       1290 passed, 1290 total
Time:        92.76 s
exit=0
$ npm run typecheck -w @dems/mobile        exit=0
$ npm run lint -w @dems/mobile             exit=0
$ npm exec -w @dems/mobile -- eslint -f json .
eslint json: files 472 errors 0 warnings 2
dashboard+more files linted: 34 errors 0 warnings 0
```

The two warnings: `apps/mobile/src/features/session-new/testing/live-session-new-bed.tsx:41,42`
`import/no-duplicates` — W67's in-progress file (seen 23:01:50; re-check in §6.5).

### 6.4 Mutation check (rule M15: nothing in the tree is modified)

Method: M0's (`gateway_check/assets/09a_m0_*`) — a jest transformer outside the tree (`.cache/w66/mut/`,
copied to `assets/66_mutating_transformer.cjs.txt`, `66_jest_mut_config.cjs.txt`, `66_mutate.py.txt`) applies
the edits of one mutant **in memory** to one production file and hands the result to the app's own
babel-jest; each mutant runs five test files (the three new behaviour tests plus the two existing screen
tests); detected = jest exit ≠ 0. The SHA-256 of the five mutated files was compared before and after.
The static test reads the tree, so an in-memory mutant cannot exercise it; its controls are in the test.

**Run 1** (23:13:58, `assets/66_mutations_run1.log`): 19 of 20 detected. Two lessons, both fixed in the
tests (not in the product): L3 "the More chip takes a fixed tone" survived — no screen test read the
chip's tone, so `toneOf()` now reads the `tone` of the `StatusChip` element; H2 was "detected" only
because a failed `toEqual` on a render instance made jest print the whole tree and run out of heap — the
presence checks are booleans now (`shows()`). A "no false new-seal toast after sign-in" assertion with its
control (the Core holds items sealed today) was added at the same time.

**Run 2, final** (`assets/66_mutations.log`):

```
# W66 mutation check, 2026-10-05 23:22:51; 5 test files per run; the tree is not edited
control (no mutation): exit=0 Tests:       47 passed, 47 total (7 s)
…
## 20 detected, 0 not detected, 0 not applied, of 20
## the mutated files in the tree, before and after: identical
   6c39053872b9d2f2  src/features/dashboard/home-header.tsx
   b4b1437b4a18b6fb  src/features/dashboard/recent-sessions.tsx
   6cd9bb1164035c05  src/features/more/more-links.tsx
   18cca00649763544  src/features/more/more-model.ts
   7f2d9cf1284e6b68  src/features/more/use-core-link-chip.ts
# finished 23:25:29
```

| Class | Mutants | Detected | A test file that fails |
|---|---|--:|---|
| The chip rule (MD-8) | R1 HEARTBEAT reads "Live" again (the `acaff20` rule); R2 LIVE reads `link.state` instead of the M0 rule; R3 LIVE never "Offline"; R4 SIMULATED/HEARTBEAT never "Offline"; R5 tones swapped | 5 / 5 | R1: all three new behaviour tests; R2: `use-core-link-chip.test.tsx` (the step-by-step equality with `offlineNoticeAfter`) |
| The M0 hook | C1 no hysteresis; C2 render-time adjustment dropped; C3 HEARTBEAT counted as LIVE; C4 icon never the warning mark; C5 initial state "shown" | 5 / 5 | chip test; C1, C2 also both screen Live tests (the outage) |
| Home header | H1 MD-9 dropped; H2 chip in every class in Simulated mode; H3 presenter skipped; H4 request never sent; H5 fixed source in the label | 5 / 5 | `home-live.test.tsx`; H4 also the existing `dashboard-screen.test.tsx` (its bell test) |
| More footer | L1 LIVE keeps the simulated-data note; L2 Simulated gets the LIVE note; L3 fixed tone | 3 / 3 | `more-live.test.tsx` |
| Recent rows (CONTRACT-GAP-W66-1) | P1 LIVE joins the bundled poster again; P2 Simulated loses its poster | 2 / 2 | `home-live.test.tsx` |
| **Total** | | **20 / 20** | |

### 6.5 Final gate on the finished tree (`assets/66_gate_final.log`; earlier attempts `66_gate_final_run1.log` to `_run3.log`)

**Final run** (the load waited for inside the same command; after the StrictMode test of §6.6 was added):

```
## waited 0 s for a 1-minute load below 8
## 2026-10-05 23:43:55 WIB 23:43  2 users, load averages: 3.14 6.10 7.26
## $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 110 passed, 110 total
Tests:       1395 passed, 1395 total
Time:        67.282 s, estimated 105 s
exit=0
## 23:45:03 $ npm run typecheck -w @dems/mobile
exit=0
## 23:45:08 $ npm run lint -w @dems/mobile
exit=0
eslint json: files 490 errors 0 warnings 0; dashboard+more files 34 errors 0 warnings 0
```

All ten suites of `features/dashboard` and `features/more` PASS (10 `PASS` lines). 110 / 1,395 is at or above
the ledger (96 / 1,257 + W66 4 / 33); the other suites and tests are the parallel rows' new files
(W67 session-new, W74 evidence, W78 devices, and others landing meanwhile).

**Earlier attempts, kept as a record** (a clean run at 23:39, before the StrictMode test, measured
108 / 1,379 exit 0, typecheck 0, lint 0/0: `66_gate_final_run3.log`):

The first attempt (23:30:23) started with a 1-minute load of **11.23**: the load had risen again between
the wait loop (7.31 at 23:29) and the start, against the brief's "below 10" (DV-5). It passed (103 suites /
1,325 tests, exit 0) but is kept only as a record; the gate below waited for the load in the same command.

```
## waited 0 s for a 1-minute load below 8
## 2026-10-05 23:34:11 WIB 23:34  2 users, load averages: 7.21 8.82 8.41
## $ npm run test -w @dems/mobile -- --maxWorkers=2
FAIL src/features/evidence/live-evidence-export.test.tsx (7.496 s)
Test Suites: 1 failed, 106 passed, 107 total
Tests:       5 failed, 1365 passed, 1370 total
Time:        92.457 s, estimated 102 s
exit=1
## 23:36:09 $ npm run typecheck -w @dems/mobile
exit=2
src/features/devices/testing/live-devices-bed.tsx(64,8): error TS2305: Module '"@dems/shared/sim"' has no exported member 'AudioTrackId'.
-- type errors under features/dashboard or features/more: 0
## 23:36:18 $ npm run lint -w @dems/mobile
exit=0
eslint json: files 486 errors 0 warnings 0
dashboard+more files: 34 errors 0 warnings 0
## 23:37:20 $ npx tsc -p .cache/w66/tsconfig.w66.json  (the mobile project minus the parallel row's two new devices files)
exit=0
```

- **This row's suites**: all ten suites of `features/dashboard` and `features/more` PASS in this run (the six
  existing and the four new; `grep -E '^(PASS|FAIL) src/features/(dashboard|more)/'` lists ten `PASS` lines).
- **The red suite is not this row's**: `apps/mobile/src/features/evidence/live-evidence-export.test.tsx`
  (5 failed) belongs to the parallel mobile Evidence row (W74's write path `features/evidence/**`); the file
  was still being written (modified 23:35:48, after the run began). Seen at 23:35:44; not touched;
  re-checked at 23:38:47: `PASS … Tests: 10 passed, 10 total`.
- **The type error is not this row's**: `apps/mobile/src/features/devices/testing/live-devices-bed.tsx:64`
  (parallel mobile Devices row, W78; created 23:29:57). Seen at 23:32:05, re-checked at 23:36:09: still
  there, still the only error, none under this row's folders. With that file and the one test that imports
  it left out by a scratch config outside the tree (`assets/66_tsconfig_w66.json.txt`), `tsc` over the rest
  of the mobile project exits 0. This row's files also passed `npm run typecheck` (exit 0) at 23:23, after
  their last edit, when the tree held no foreign error. At 23:39:00 the whole workspace type-checks again
  (`typecheck exit=0`): the parallel row fixed its file.
- **Ledger**: green runs measured 101 / 1,290 (23:03) and 103 / 1,325 (23:30, load-rule breach), both at or
  above 96 / 1,257 + W66's 4 / 32 (W66's count before the StrictMode test). In the 23:34 run 106 suites / 1,365 tests pass; the one red suite is W74's.
- **Lint**: exit 0, **0 errors, 0 warnings** workspace-wide (W67's two warnings of 23:01 are gone).

### 6.6 Controller notes received during the row (23:42)

**(1) F69-1 (decision D158): a Core command started from a mount effect runs twice under StrictMode.**
Checked: the production files of both folders hold three effects, none of which starts a Core command or
query — `dashboard/use-held-value.ts:17` (a display timer), `dashboard/quick-actions.tsx:108` (the sheen
animation), `dashboard/dashboard-screen.tsx:193` (the new-seal toast); `features/more` has no effect; no
`useQuery`, `useMutation`, `client.call` or `useMobileLive` in either folder (`grep` over the production
files). The one Core call (operation 70) is a press handler. Nothing to fix. A test proves it anyway:
`home-live.test.tsx` "mounted twice by StrictMode, neither screen starts a Core command or query" mounts
Home and More inside `<StrictMode>` (the bed's new `strict` option wraps the screens alone) over the Live
source, signs in, lets 3 s pass, and finds only the session's own operations in the log
(`getAuthSession`, `getDeviceRegistration`, `getSignInStatus`, `signIn`, `touchSession`), no
`acknowledgeAlert` request, the bell still at 1, and no new-seal toast. It was added after the final
mutation run (§6.4), so the 20 / 20 there does not count it; it can only add detection.

**(2) `dems_lane_1` holds a sealed session (SES-20261005-0026) whose summary is not acknowledged**, left by
the mobile Start Session row. This row's device check ran earlier (23:09:25–23:11:29): after the LIVE
sign-in Home showed "Ready for Recording" with "Start Session" (`66_phone_home_live.png`), no summary
opened, and this row acknowledged nothing. No further device sitting was needed.

## 7. Device check — lane 1, the phone (`assets/66_device_run.log`)

One sitting inside the lane lock, 23:09:25–23:11:29 WIB (2 min 4 s):
`/usr/bin/lockf -k -t 600 .locks/core-server.lane1.lock /bin/sh .cache/w66/run_w66.sh`; the device part in
`METRO_PORT=8083 DEMS_CORE_HOST_PORT=4421 DEVICE_SESSION_MAX_SECONDS=540 apps/mobile/scripts/device-session.sh phone …`.
Scripts: `assets/66_run_w66.sh.txt`, `66_device_w66.sh.txt`, `66_sign_in_w66.mts.txt`, `66_pixels.py.txt`
(W60's session F, adapted). `dems_lane_1` was not reset.

| Step | Output (quoted from the log) | Screencap |
|---|---|---|
| Lock, before | `phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable` (22:49:10) | — |
| Database, before | `audit_log 116`, `device_credentials 1`, `paired_devices 1` | — |
| Backend | `"port":4421,"database":"dems_lane_1","demoControls":false`; health `"service":"dems-core-server","version":"0.2.0" … "ready":{"database":true,"engine":true}` | — |
| Session | `emulator-5554: screen awake, no keyguard`; `Metro ready; device tcp:8081 -> host tcp:8083`; `Core server: device tcp:4420 -> host tcp:4421`; prefs before `{"coreLinkSource":"SIMULATED"}` | — |
| L1 LIVE cold start `demsdemo:///?core=LIVE` | `runtime.live.ready` after 5 s; `GET /api/v1/pairing/device 200` | `66_phone_login_live.png` |
| L2 sign-in (SUPERVISOR, typed into the app's fields; password never shown) | `the app's sign-in request: status 200, request ID fa78ff78-9325-4cc4-adbc-6843f2d4a78d`; `credential/token lines: device JS log 0; backend log 0` | — |
| Home LIVE | The header holds **"Core Live"** (green, Wi-Fi mark) between the wordmark and the bell — the phone class, MD-9. The app's biometric offer covered the middle; it was declined (Not now, §10 DV-1) | `66_phone_home_live_offer_check.png`, `66_phone_home_live.png` |
| More LIVE | Operator AKP Andi Pratama, Supervisor, OPR-002, "Signed in 23:10"; Audit "118 events"; Pairing "Core: Interview Room 1", "Paired"; footer **"DEMO", "Core Live", "Data from the Core server"** | `66_phone_more_live_top.png`, `66_phone_more_live_footer.png` |
| Requests in LIVE (device log) | `POST /api/v1/auth/touch 200`, `POST /api/v1/auth/sign-in 200`, `GET /api/v1/pairing/device 200`, `GET /api/v1/auth/status 200`, `GET /api/v1/auth/session 401`; `live.misuse (must be 0): 0; credential/token lines (must be 0): 0` | — |
| S1 launch `demsdemo:///?core=SIMULATED` (stored, D124) | `runtime.sim.hydrated` after 2 s; the simulator's Login; scripted simulator sign-in; `Core requests after the SIMULATED launch (must be 0): 0` | `66_phone_simulated_start.png` |
| Home SIMULATED | No chip in the phone header (MD-9 unchanged); the simulator's rows with their bundled posters | `66_phone_home_simulated.png` |
| S2 sign-out from More (the app was at its Login) | `tapped More's Sign out at 781 586` → "You have been signed out." on the SIMULATED Login | `66_phone_simulated_after_sign_out.png` |
| End | prefs after `{"coreLinkSource":"SIMULATED"}`; `lock at end: isKeyguardShowing=false; fps "count":1`; `session ended with status 0` | — |
| Backend log of the session | `GET /api/v1/auth/session 401 principal=device`, `GET /api/v1/auth/status 200`, `GET /api/v1/health 200 principal=null`, `GET /api/v1/pairing/device 200`, `POST /api/v1/auth/sign-in 200 principal=device`, `POST /api/v1/auth/touch 200 principal=operator`; 2 sockets opened, 2 closed; `bearer/cookie/credential lines in the server log this run (must be 0): 0` | — |
| Stop | `"msg":"shutdown complete"`; `lsof exit 1 (1 = none)`; database after `audit_log 119`, `device_credentials 1`, **`paired_devices 1`** (DEV-0001 kept) | — |

Afterwards (23:11:54, sandbox bypass for `adb` and `lsof`):

```
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
lock status: identical before and after
$ adb -s emulator-5554 reverse --list          (empty)  exit=0
$ adb -s emulator-5554 shell pidof com.dems.demo.tablet   exit=1 (1 = not running)
$ lsof -nP -iTCP:4421 -iTCP:8081-8086 -sTCP:LISTEN        exit=1 (1 = none)
-- other listeners (not touched): postgres 127.0.0.1:4432
       0 .locks/core-server.lane1.pid
```

Secret scan of every text asset and of the run's output folder (the demo password compared in memory,
never printed): no password, no bearer value; the only `dvc_|ses_|bio_` matches are the scanners' own
regular expressions in the three scripts. Ports 4420, 4422, 4423, 4400, 5173-5178 and 5432 were not used;
`dems2_tablet` and `dems2_phone2` were not touched.

## 8. Findings

| # | Finding | Evidence | Severity / owner |
|---|---|---|---|
| F-1 | A Home or More screen that **mounts** while the Core socket is reconnecting (CONNECTING after an outage) reads "Core Live" until the next failed attempt (at most one `RECONNECT_BACKOFF_MS` step, 8 s). It is M0's snippet: the initial state is `offlineNoticeAfter(false, view)` and settling keeps it. Home and More are tabs that stay mounted, so only a first visit during an outage sees it. A fix that stays one rule: seed `shown` from the app-wide banner (`useConnectionBanner().kind === 'offline'`, which agrees with the rule in LIVE by M0's agreement test) | `use-core-link-chip.ts:41`; test "LIVE cold start … flashes no Offline" pins today's behaviour | Low; an M0 decision (DN-1) |
| F-2 | §3.5 says the mobile shows "the existing connection banner" when the link is lost while signed in; the banner component is drawn only by the session monitor (`apps/mobile/src/features/session-live/session-live-screen.tsx:261`). On Home and More in LIVE the Core chip is the only link indicator; MD-9 makes it visible on phones, so it is there, but small | `grep ConnectionBanner` over `apps/mobile/src` | Medium for the demo story; shell-level, not this row's folders (W82 or W100) |
| F-3 | The acknowledge denial toast shows the title only ("Not permitted"): operation 70 needs no permission, so `requiredRoleFor` has no role to name. AC-C-48's "names the required role" applies to operations with a permission | `core-errors.ts:182-190`; `alerts.ts:79-100` | Info |
| F-4 | Screen tests print kit noise (`[colorKit.RGB] … default color "black"`, `Uniwind - We couldn't find your variable --theme`) — 101 lines for the two existing screen tests alone, before this row | run of `more-screen.test.tsx` + `dashboard-screen.test.tsx` | Info, pre-existing |
| F-5 | More's Audit tile counts `audit.rows.length` (the ring, cap `AUDIT_RING_SIZE` 1,000), in both modes; in LIVE a Core with more than 1,000 rows would show 1,000 | `more-model.ts` `selectAuditCount`; `packages/shared/src/sim/constants.ts:36` | Info; same semantics as Simulated |
| F-6 | Parallel rows, not this row's: (a) W67's `features/session-new/testing/live-session-new-bed.tsx:41-42` had two `import/no-duplicates` warnings at 23:01:50, gone at 23:32; (b) `features/devices/testing/live-devices-bed.tsx:64` (mobile Devices, W78, created 23:29:57) broke `tsc` at 23:32 and 23:36 (`AudioTrackId` is not exported by `@dems/shared/sim`), fixed by 23:39; (c) `features/evidence/live-evidence-export.test.tsx` (mobile Evidence, W74) had 5 red tests in the 23:34 run while being written, green at 23:38:47 | eslint JSON; §6.5 | owners W67, W78, W74 |
| F-7 | After a password sign-in in either mode, the app's biometric offer covers Home; W60 left it open. It is the app's own dialog; "Not now" is `setBiometricOffer(null)` (`apps/mobile/src/auth/live-auth-provider.tsx:329`, `auth-provider.tsx:243`): in memory, nothing stored, nothing sent | device captures | Info (DV-1) |
| F-8 | `home-model.ts` imports `resyncTarget` from `@/runtime/route-sync`, not the barrel, since `acaff20` (a pure route helper) | static test pins it as the one exception | Info, pre-existing |

## 9. Deviations

| # | Deviation | Why |
|---|---|---|
| DV-1 | On the device the app's biometric offer was **declined** ("Not now") in both modes, after a pixel check that the dialog showed (W60 left it open) | It covered Home and blocked scrolling More to its footer. It is no system prompt, no lock and no enrolment; declining stores and sends nothing (F-7). "Enable" was never pressed |
| DV-2 | The device check signed in to the **simulator** (typing into the app's own Login fields) to capture Home in SIMULATED mode, then signed out again from More | Home is a guarded screen; the mobile simulator never keeps an identity across a cold start (`apps/mobile/src/runtime/sim-adapters.ts:123,131`), so there is no other way to show it. The app ended at the SIMULATED Login, as W60 left it |
| DV-3 | Home's acknowledge call goes through `settle` with the presenter, not only `useCoreActions` | §7.1 asks for the one-line `useCoreActions` change; the row's AC-C-48 needs the denial toast, and a bare fire-and-forget would only be reported by the Live source (CL-24) with nothing shown |
| DV-5 | The 23:30 whole-suite run started at a 1-minute load of 11.23 (above the brief's 10): the load rose again between the wait and the start | Repeated at 23:34 with the wait inside the same command (load 7.21); the first run is kept as a record only |
| DV-4 | Process: two read-only commands were written with a leading `cd` (a `git diff --stat` at about 22:41 and the first `typecheck` at 22:50); nothing changed by them. Every later command ran from the default working directory | the brief's "never `cd`" |

## 10. Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| DN-1 | F-1: the chip of a screen mounted during a reconnect reads "Live" for up to one backoff step | Keep M0's snippet as is (binding); if wanted, seed `shown` from `useConnectionBanner()` in one M0 slot for all page rows |
| DN-2 | More's "DEMO" chip stays in LIVE mode: it labels the demo build, not the data; the note under it, which named simulated data, is replaced in LIVE | Ratify |
| DN-3 | HEARTBEAT with mock-core down keeps "Core Offline" (danger), as before; MD-8 only replaced the word "Live" | Ratify (the label still names "mock-core heartbeat") |
| DN-4 | CONTRACT-GAP-W66-1: LIVE recent rows show the brand still until the replicated history carries a media reference | W83: add `mediaSource` to the history entry (or evidence item), or accept the brand still |
| DN-5 | F-2: the app-wide connection banner is not drawn on Home/More | Route to W82 or W100 (shell), not a page row |
| DN-6 | Ledger: `@dems/mobile` +4 suites / +33 tests from W66 (96/1,257 → 100/1,290 for W66 alone; the tree measured 110/1,395 at 23:43 with the parallel rows' files) | Record |

## 11. Error handling and logging

The one call keeps its persistent log (`reportRuntimeIssue('warn', 'dashboard.alerts.acknowledge', error, { alertId })`,
`home-header.tsx:191`) for anything the presenter does not word; a denial, an outage, a time-out or a limit
gets the app's one toast (user feedback), and the Live source reports every rejection itself (CL-24).
More's and Home's section boundaries (`more-boundary.tsx`, `panel-boundary.tsx`) are unchanged.

## 12. Rollback (not executed)

R-CO for the edited files, R-NEW for the new ones:

```sh
git checkout acaff20 -- apps/mobile/src/features/dashboard/home-header.tsx \
  apps/mobile/src/features/dashboard/recent-sessions.tsx apps/mobile/src/features/more/i18n.ts \
  apps/mobile/src/features/more/more-links.tsx apps/mobile/src/features/more/more-model.ts
rm -f apps/mobile/src/features/more/use-core-link-chip.ts apps/mobile/src/features/more/use-core-link-chip.test.tsx \
  apps/mobile/src/features/more/more-live.test.tsx apps/mobile/src/features/dashboard/home-live.test.tsx \
  apps/mobile/src/features/dashboard/home-more-live-static.test.ts
rm -rf apps/mobile/src/features/dashboard/testing
```

The pre-images and SHA-256 of both folders are in `.cache/rollback/W66/` (`pre.sha256`, HEAD `b90a3c6`).
The ledger then returns to 96 / 1,257 (plus whatever parallel rows added). Nothing on the device or in
`dems_lane_1` needs undoing: the stored source is SIMULATED and the pairing is as before.

## 13. Files

| File | Change |
|---|---|
| `apps/mobile/src/features/more/more-model.ts` | modify: the chip rule (MD-8) |
| `apps/mobile/src/features/more/use-core-link-chip.ts` | new: the chip hook (M0) |
| `apps/mobile/src/features/more/more-links.tsx` | modify: footer chip, LIVE note |
| `apps/mobile/src/features/more/i18n.ts` | modify: `footer.liveNote` |
| `apps/mobile/src/features/dashboard/home-header.tsx` | modify: chip, MD-9, acknowledge via `useCoreActions` + `settle` + presenter |
| `apps/mobile/src/features/dashboard/recent-sessions.tsx` | modify: no bundled poster in LIVE (CONTRACT-GAP-W66-1) |
| `apps/mobile/src/features/more/use-core-link-chip.test.tsx` | new test (10) |
| `apps/mobile/src/features/more/more-live.test.tsx` | new test (5) |
| `apps/mobile/src/features/dashboard/home-live.test.tsx` | new test (9, one under StrictMode) |
| `apps/mobile/src/features/dashboard/home-more-live-static.test.ts` | new test (9) |
| `apps/mobile/src/features/dashboard/testing/live-home-bed.tsx` | new test bed |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/66_mobile_home_more.md` | this report |
| `docs/…/implementation/assets/66_*` | 8 screencaps, `66_device_run.log`, `66_gate_mobile_test_1.log`, `66_gate_final.log` (+ `_run1` to `_run3`), `66_tsconfig_w66.json.txt`, `66_clg_a_c.log`, `66_lock_status_start_end.txt`, `66_mutations.log`, `66_mutations_run1.log`, seven scripts as `.txt` (device check 4, mutation harness 3) |
| `docs/…/delegation_progress/coder_execution_step_88.md` | progress file |

Scratch only under `.cache/w66/` and `.cache/rollback/W66/`. No git write, no Docker, no file outside the
write set changed.
