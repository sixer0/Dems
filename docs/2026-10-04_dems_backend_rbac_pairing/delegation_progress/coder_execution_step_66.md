---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: 66
plan_row: W44
agent: coder-execution
status: complete
started: 2026-10-04 11:22 WIB
first_delivery: 2026-10-04 12:37 WIB (gate passed, decision D75)
fix_round: after checkpoint CP-C1, decision D80; started 13:08 WIB, finished 14:17 WIB (gate passed, decision D84)
follow_up: of decision D84; started 14:20 WIB, finished 14:36 WIB
second_round: after the re-review, decision D90; started 15:27 WIB, finished 15:58 WIB
third_round: decision D100; started 16:08 WIB, finished 17:06 WIB
output_document: implementation/44_live_source.md (sections 14 and 15: the fix round; section 16: the follow-up; section 17: the second round, with the FINAL API list in 17.3 and the ONE list of brief notes in 17.4; section 18: the third round, with 17.4 updated in place)
---

# Step 66 (W44): Live source HB-14 — progress

Parallel run: this file is the only progress record of the row. `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md` and
`implementation/99_implementation_report.md` were not written (P8); the controller synthesises
them from this file and from `implementation/44_live_source.md`.

## A. First delivery (unchanged record)

| Time (WIB) | Milestone |
|---|---|
| 11:22 | Inputs read |
| 11:25 | Baseline before the first edit: `@dems/shared` 57 files / 1,406 tests; P23 pre-image |
| 11:25-12:10 | 13 source files and 7 test files written |
| 12:21-12:35 | Mutation runs: 58 changes, 56 detected, two weak tests strengthened; then 60 of 60 |
| 12:32, 12:36 | Gate green: 64 files / 1,650 tests; typecheck (shared, core-web, mobile) and lint exit 0 |
| 12:37 | `implementation/44_live_source.md` sections 1 to 13 final. Findings F66-1 to F66-11, decisions 1 to 18 |

## B. Fix round after CP-C1 (decision D80)

Status: **complete**. 17 findings were given to the row: 16 fixed, 1 not fixable inside the row's
write paths (CPC1-16, the exact lines for the owner are given). CPC1-3 and CPC1-12 are the typed
client's row and were not touched.

### Milestones

| Time (WIB) | Milestone |
|---|---|
| 13:08 | `gateway_check/07_cp_shared_client.md` read in full (sections 0 to 10) |
| 13:10 | P23 pre-images of every file the round may touch: `.cache/rollback/W44-fix/{source,live,test}`; hashes in `assets/44_fix_pre_state.txt` |
| 13:10-13:35 | Source: the small files (`constants`, `touch-throttle`, `rebuild-error`, `bindings`, `neutral-state`, `command-gate`, `live-result`, `types`, `index`), then `live-sim.ts` re-written around one state record |
| 13:35 | The 64 existing files green on the new source, except the two tests the round changes by design (the D80 rule; the pinned export list) |
| 13:35-13:57 | Tests: 3 new files, additions to 5; the light API's hook (`useLiveSelector`). Two defects of the round's own first version were found by its tests and corrected (a sign-in while a sign-out is owed; a debt whose request belonged to a stopped run) |
| 13:51 | Client compiler probes (web, mobile): exit 0; negative controls exit 2 |
| 13:56, 14:05, 14:14 | Mutation runs: 113 of 113, then 114 of 114 twice (the last on the final tests) |
| 14:06, 14:14 | Gate green twice: 68 files / 1,735 tests; the 28 files of `acaff20` alone 517 tests; typecheck (shared, core-web, mobile) and lint exit 0 |
| 14:14 | Red before / green after: 57 tests |
| 14:17 | `implementation/44_live_source.md` sections 14 and 15 written; two statements corrected in place |

### Files changed by the round

Source, `packages/shared/src/live/source/` (10 of 13): `bindings.ts`, `command-gate.ts`,
`constants.ts`, `index.ts`, `live-result.ts`, `live-sim.ts`, `neutral-state.ts`,
`rebuild-error.ts`, `touch-throttle.ts`, `types.ts`. Unchanged: `clock.ts`, `replica.ts`,
`structural-sharing.ts`.

Light API (recorded exception, CPC1-13): `packages/shared/src/live/hooks.ts` (20 lines added:
15-16 and 71-88; nothing changed or removed). `packages/shared/src/live/index.ts` is unchanged.

Tests, `packages/shared/test/`: new `live-source-resilience.test.ts` (24),
`live-source-local-end.test.ts` (18), `live-source-misuse.test.ts` (8); changed
`live-source-atomicity.test.ts` (+4), `live-source-bindings.test.ts` (+3),
`live-source-session.test.ts` (+4, one re-written by D80), `live-source-react.test.ts` (+2),
`live-source-platform-neutral.test.ts` (+4, and 12 names in the pinned list);
`live-light-platform-neutral.test.ts` (one line added: 181).

Documents and evidence, under `docs/2026-10-04_dems_backend_rbac_pairing/`:
`implementation/44_live_source.md` (sections 14, 15; frontmatter; two paragraphs corrected in
place), this file, and under `implementation/assets/`: `44_fix_pre_state.txt`,
`44_fix_post_state.txt`, `44_fix_gate.log`, `44_fix_tests_verbose.log`, `44_fix_red_green.py`,
`44_fix_red_green.log`, `44_fix_red_before_reasons.log`, `44_fix_assim_probe.py`,
`44_fix_assim_probe.log`; refreshed: `44_mutate.py`, `44_mutations.log`, `44_client_probe.log`,
`44_probe_web.ts.txt`, `44_probe_mobile.ts.txt`.

Not changed: the 28 test files of `acaff20` (identical hashes), `src/sim`, `src/api`,
`src/client`, `src/realtime`, `src/live/testing`, i18n, `package.json`, any app.

### Outcome per finding

| Finding | Outcome | Evidence |
|---|---|---|
| CPC1-2 | Fixed | 5 tests red before, green after |
| CPC1-1 | Fixed | 3 red/green, 3 guards. Before: 3 ends at a cold start, 24 ends in 60 s when the port throws |
| CPC1-4 | Fixed, limits stated | 3 red/green, 3 guards |
| CPC1-5 | Fixed | 3 red/green |
| CPC1-21 | Fixed as ruled, option (a) | 17 red/green, 2 guards |
| CPC1-6 | Fixed | 1 red/green |
| CPC1-7 | Fixed | 6 red/green |
| CPC1-8 | Fixed | 5 red/green, 1 guard |
| CPC1-9 | Fixed; `headers()` stays synchronous, documented | 2 red/green |
| CPC1-10 | Fixed | 3 red/green, 1 guard |
| CPC1-11 | Fixed | 1 red/green |
| CPC1-13 | Fixed (light API, by the recorded exception) | 2 red/green, in `live-source-react.test.ts` |
| CPC1-14 | Fixed | Compile probe: exit 0 before, exit 2 after; 2 run-time guards |
| CPC1-15 | Fixed (one state record, a state table; the file not split) | No behaviour to test; existing tests and the mutation run unchanged in result |
| CPC1-16 | **Not fixable in the row's write paths** | Finding F66-12 with the two lines the owner changes |
| CPC1-18 | Fixed (the log's sentence; two inherited-key lookups) | 2 red/green |
| CPC1-20 | Fixed, one step wider (all four storage ports) | 2 red/green |

### Public API changes (section 14.3 of the log has the table)

1. `actions.signOut`: a local end when the link is not ONLINE or the request gets no answer; it
   rejects only for a refusal other than 401.
2. `LiveSessionEndSource` gained `'LOCAL'`.
3. `stop()` settles every action that is out (resolve when accepted; reject with code `STOPPED`).
4. `store.subscribe`: a listener that throws is contained and reported (`live.subscriber`).
5. `reconnect('CREDENTIAL')` and `setPairing(pairing)` also end a remembered revocation.
6. The result of the 14 value-returning actions has a hidden, not enumerable member `ok`.
7. New exports: 6 constants, `LIVE_STOPPED_CODE`, `LiveMisuse`, `LIVE_VALUE_ACTION_NAMES`,
   `LIVE_RESULT_DISCRIMINANT`, `envelopeSimCodeOf`, `isRefusal`; types `LiveResultHooks`, `LiveMisuse`.
8. `ENVELOPE_SIM_CODE` is typed by the contract's `ApiErrorCode`.
9. Optional additions: `createLiveResult(report, hooks?)` and its two siblings; `CommandGate.halt()`;
   `CommandGateOptions.maxHeld`, `overflow`.
10. Light API: `useLiveSelector(read)`.
No member of `LiveSim`, `LiveSecretsPort` or `CreateLiveSimOptions` was added, removed or retyped.

### Blockers

None.

### Findings of the round (section 14.6)

| ID | Finding | Owner of the action |
|---|---|---|
| F66-12 (CPC1-16) | `DEFAULT_TIMERS` exists twice; the other copy is `src/realtime/live-socket-client.ts:468-473`, not exported | W30: export it; then this row deletes its copy |
| F66-13, CONTRACT-GAP-7 (first logged as CONTRACT-GAP-4; renamed by D84, see section C; **withdrawn in the second round, see section D**) | The sign-out request has no reason for an expiry decided on the client; it was sent as USER | None: since D90 no sign-out is sent for an expiry |
| F66-14 | A POST a page sends through `live.client` is not seen by the source (touch period, 401, idle instant) | Controller decision; the administration pages |
| F66-15 | On a tablet a local end leaves the session open at the Core until its idle expiry (the token is dropped at once, as ruled) | None in code |
| F66-16 | CPC1-1 reproduced: 3 ends at a cold start, 24 ends in 60 s; a fake must answer by the credential the request carried | The client rows' briefs |
| F66-17 | `live-sim.ts` is 2,036 lines (1,290 before); not split, as ruled | CP-C1 steps 2 and 3 stand |
| F66-18 | A `hello` without OPERATOR and without a reason, while signed in, is not an end: one new socket, then a report | None unless the backend gate shows such a server |

### Deviations

1. CPC1-4: the "never observed" sign is level `warn`, not `error` as the reviewer suggested: three
   production call sites drop a value on purpose (section 14.4).
2. CPC1-20 was applied to `sessionIssued` and `devicePaired` too (the reviewer named two ports).
3. CPC1-13: one generic hook instead of three named ones; `live/index.ts` needed no edit.
4. One existing test of the row was re-written, because D80 changed its rule.
5. The round's tests are three new files plus additions, not one file.

### Decisions for the controller to record

Fifteen (numbers 19 to 33), in `implementation/44_live_source.md` section 14.7. Each is what the
code does now; it stands unless the controller decides otherwise.

### Verification (quoted from `implementation/assets/44_fix_gate.log`)

```
## 2026-10-04 14:14:40 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1735 passed (1735)
exit=0
## 14:14:47 the 28 test files that exist at acaff20, alone
 Test Files  28 passed (28)
      Tests  517 passed (517)
exit=0
## 14:14:50 the ten files of this row, alone
 Test Files  10 passed (10)
      Tests  311 passed (311)
exit=0
## 14:14:52 the light API's test files, alone
 Test Files  2 passed (2)
      Tests  26 passed (26)
exit=0
## 14:14:52 $ npm run typecheck -w @dems/shared       exit=0
## 14:14:55 $ npm run lint -w @dems/shared            exit=0
## 14:14:55 $ npm run typecheck -w @dems/core-web     exit=0
## 14:15:04 $ npm run typecheck -w @dems/mobile       exit=0
```

Ledger: 64 files / 1,650 tests before the round; 68 / 1,735 after. This row: +3 files, +67 tests
(244 to 311). Not this row: `client-credentials.test.ts`, 18 tests (the typed client's row).

Red before, green after (`44_fix_red_green.log`): `57 failed | 235 passed (292)` on the code before
the round; `292 passed (292)` on the tree.

Mutation re-run (`44_mutations.log`): `mutations: 114, killed: 114, survived: 0 []`.

## C. Follow-up after the fix round (decision D84)

Status: **complete**. The three items are done and the question on F66-18 is answered; answering
it found one defect, which is fixed. With the recorded exception of item 3, CPC1-16 is closed:
**17 of the 17 findings of CP-C1 that belong to this row are fixed.**

### Milestones

| Time (WIB) | Milestone |
|---|---|
| 14:20 | D84 read. P23 pre-images: `.cache/rollback/W44-followup/{source,test}`, `live-socket-client.ts.pre`, `realtime-index.ts.pre`; hashes in `assets/44_followup_pre_state.txt` |
| 14:22 | Item 3: the one-line export in `src/realtime/live-socket-client.ts:468`; this row's copy deleted |
| 14:22-14:24 | Item 1: `CONTRACT-GAP-7`. Item 2: `noteActivity` and the observed view of the typed client; 10 tests |
| 14:26 | F66-18: the defect found (no expiry check while ONLINE on a socket that is not the session's), fixed, 2 tests |
| 14:34 | Mutation run: 127 of 127. Red before / green after: 9 tests |
| 14:34 | Gate green: 68 files / 1,747 tests; the 28 files of `acaff20` alone 517; the socket client's own tests 130, unedited; typecheck (shared, core-web, mobile) and lint exit 0 |
| 14:36 | `implementation/44_live_source.md` section 16 written; the gap ID renamed in the log |

### Files changed by the follow-up

- `packages/shared/src/live/source/live-sim.ts`, `packages/shared/src/live/source/types.ts` (a comment)
- `packages/shared/src/realtime/live-socket-client.ts`: line 468 only (`export` added; recorded exception). `packages/shared/src/realtime/index.ts`: not edited
- `packages/shared/test/live-source-local-end.test.ts` (+12 tests), `packages/shared/test/live-source-platform-neutral.test.ts` (two tests re-written)
- Documents: `implementation/44_live_source.md` (section 16; pointers in 14.6, 14.8, 15; the gap ID), this file
- Evidence, `implementation/assets/`: `44_followup_pre_state.txt`, `44_followup_post_state.txt`, `44_followup_gate.log`, `44_followup_tests_verbose.log`, `44_followup_red_green.py`, `44_followup_red_green.log`; refreshed: `44_mutate.py`, `44_mutations.log`, `44_client_probe.log`, `44_probe_web.ts.txt`

Not changed: the 28 test files of `acaff20` and the two `realtime-live-*` test files (identical hashes), `src/sim`, `src/api`, `src/client`, `src/live/*.ts`, `src/live/testing`, any app.

### Outcome per item

| Item | Outcome |
|---|---|
| 1. Gap-ID collision | The marker is `CONTRACT-GAP-7` in the code (`live-sim.ts`, at `endLocally`), in the static test, in the log and here. `CONTRACT-GAP-3` stays |
| 2. F66-14 | `live.client` is an observed view of the typed client: ONE way for pages, `live.client.call(operationId, input)`. Counted: every answered POST of the signed-in operator except 401 moves the idle instant; only a 2xx restarts the touch period; a GET, a 401, no answer, a call while signed out count nothing. The same rule now holds for actions. 6 tests red before / green after, 4 guards |
| 3. F66-12 (CPC1-16) | One line of the socket client exports `DEFAULT_TIMERS`; this folder imports it and calls no timer function of the platform. The name was NOT changed to `LIVE_SOCKET_DEFAULT_TIMERS`: the file's own static test reads the old text and line 523 uses the name |
| F66-18 | One new socket, once per session; then one report per such `hello`; no loop. Bound for the Core data on the screen: the next answered POST when an operator is there (60 s at most for the touch), else the idle instant (15 minutes at most, never beyond the absolute expiry). That second bound did not hold before the follow-up: fixed |

### Public API changes of the follow-up (the final list is section 16.5 of the log)

13. `live.client` is an observed view of the typed client that was passed in (same type; `live.client !== options.client`).
14. The activity rule, for actions too: every answered POST except 401 moves the idle instant; only a 2xx restarts the touch period.
15. A local expiry also ends the session while the link is ONLINE on a socket that is not an OPERATOR socket.
16. `src/realtime/live-socket-client.ts` exports `DEFAULT_TIMERS` (and so does `@dems/shared/realtime`, through `export *`).
No name was added to `@dems/shared/live/source` or `@dems/shared/live`.

### Findings and decisions of the follow-up

| ID | Finding | Owner of the action |
|---|---|---|
| F66-19 | The Core counts a POST as activity only when it reached its handler (`apps/core-server/src/plugins/authenticate/index.ts:41-44, 150, 257-258`): narrower than the ruling's wording. The client takes the safe side for each half of the activity state | None in the client; W58 observes it |
| F66-20 | The exported name stays `DEFAULT_TIMERS`, and the realtime barrel now exports it | The owner of `src/realtime`, if a rename is wanted |

Decisions 34 to 37 (section 16.8 of the log): a refused POST moves the idle instant and does not
restart the touch period; the view counts activity and nothing else (no session end on a page's
401, no permission refresh on its 403); no extra `getAuthSession` for F66-18; the exported name.

### Blockers

None.

### Verification (quoted from `implementation/assets/44_followup_gate.log`)

```
## 2026-10-04 14:34:47 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1747 passed (1747)
exit=0
## 14:34:54 the 28 test files that exist at acaff20, alone
 Test Files  28 passed (28)
      Tests  517 passed (517)
exit=0
## 14:34:57 the ten files of this row, alone
 Test Files  10 passed (10)
      Tests  323 passed (323)
exit=0
## 14:35:00 the live socket client's own test files, unedited, alone
 Test Files  2 passed (2)
      Tests  130 passed (130)
exit=0
## 14:35:01 $ npm run typecheck -w @dems/shared       exit=0
## 14:35:04 $ npm run lint -w @dems/shared            exit=0
## 14:35:04 $ npm run typecheck -w @dems/core-web     exit=0
## 14:35:14 $ npm run typecheck -w @dems/mobile       exit=0
```

Ledger: 68 files / 1,735 tests before the follow-up; 68 / 1,747 after (+12, all in
`live-source-local-end.test.ts`). Red before, green after (`44_followup_red_green.log`):
`9 failed | 295 passed (304)` on the code before the follow-up; `304 passed (304)` on the tree.
Mutation re-run (`44_mutations.log`): `mutations: 127, killed: 127, survived: 0 []`.

## D. Second fix round after the re-review (decision D90)

Status: **complete**. The seven findings that ask for code are fixed (CPC1-23, CPC1-24, CPC1-25,
CPC1-26, CPC1-31, CPC1-32, and the one report code of CPC1-30), each with tests that are red on
the code before the round and green on the tree. The three notes (CPC1-27, CPC1-28, CPC1-29) are
in the log. The three rulings are applied: decision 35 overruled, decision 21 overruled in part,
decision 24 amended; decision 20 is replaced (a refused sign-out fails closed).

### Milestones

| Time (WIB) | Milestone |
|---|---|
| 15:27 | The re-review read: R0 to R5 of `gateway_check/07_cp_shared_client.md`, R2 and R5 in full |
| 15:30 | P23 pre-images: `.cache/rollback/W44-round2/{source,test}`; hashes in `assets/44_round2_pre_state.txt` |
| 15:30-15:44 | Source: the debt as a record with its session, `settleDebt` (the Core is asked first), `checkExpiry` asks the Core, the storage port, the full CL-23 for `live.client`, answers held to their session, fixed texts for port failures, fail closed. Suite after the step: the 22 tests whose rule changed were red, as expected |
| 15:44-15:48 | Tests: `live-source-local-end.test.ts` re-written around a model of the Core's session (two tabs, a reload, a storage); CPC1-26 and CPC1-30 in `resilience`; the static test of the injected storage. Suite green: 68 files |
| 15:48 | Mutation check over the round's code, first run: 46 changes, 42 detected. Four tests asserted too little and were strengthened |
| 15:51 | Second run: 46 of 46. Client compiler probes: exit 0; negative controls exit 2 |
| 15:53 | One follow-up test that the re-write had dropped was put back (a refused POST through `live.client` moves the instant); every run repeated after it |
| 15:56 | Mutation check 46 of 46; red before / green after: 37 tests; gate green: 68 files / 1,775 tests; the 28 files of `acaff20` alone 517; typecheck (shared, core-web, mobile) and lint exit 0 |
| 15:58 | `implementation/44_live_source.md` section 17 written |

### Files changed by the round

- `packages/shared/src/live/source/live-sim.ts`, `types.ts`, `index.ts`
- `packages/shared/test/live-source-local-end.test.ts` (30 to 54 tests), `live-source-resilience.test.ts` (24 to 27), `live-source-platform-neutral.test.ts` (19 to 20), `live-source-session.test.ts` (two tests re-written)
- Documents: `implementation/44_live_source.md` (section 17; notices in the head, 15 and 16.6), this file
- Evidence, `implementation/assets/`: `44_round2_pre_state.txt`, `44_round2_post_state.txt`, `44_round2_gate.log`, `44_round2_tests_verbose.log`, `44_round2_red_green.py`, `44_round2_red_green.log`, `44_round2_mutations.log`, `44_round2_mutations_run1.log`; refreshed: `44_mutate.py` (153 entries), `44_client_probe.log`, `44_probe_web.ts.txt`, `44_probe_mobile.ts.txt`

Not changed: the 28 test files of `acaff20` (identical hashes), `src/realtime`, `src/live/*.ts`,
`src/sim`, `src/api`, `src/client`, `src/live/testing`, any app. No storage of the platform is
named in the folder: the new storage is injected.

### Outcome per finding

| Finding | Outcome | Evidence |
|---|---|---|
| CPC1-23 Medium | Fixed: RESYNCING is no lost link; at the reckoned instant the Core is asked; a debt names its session and is never paid blindly | 10 tests red/green (two tabs; a lost answer; a new sign-in while a debt exists; the question first), 8 guards (the offline local end still works) |
| CPC1-24 Medium | Fixed: the optional port `owedSignOut` (`read`, `write`, `clear`) | 11 red/green (a reload after an offline Lock; a second tab; another session; a storage that throws or hangs), 1 guard |
| CPC1-32 Low, ruling | Fixed: a page's call through `live.client` gets the full CL-23, without CL-22 | 2 red/green, 1 guard |
| CPC1-25 Low | Fixed: every answer is held to the session that sent the request | 2 red/green, 1 guard |
| CPC1-26 Low | Fixed: a port failure is reported by port and error name only; the action rejects with a fixed error | 5 red/green |
| CPC1-31 Low | Fixed: a refused sign-out fails closed, for LOCK and for USER; the debt stays with back-off | 2 red/green |
| CPC1-30 Info | One report code: `DEVICE_CLEANUP_GAVE_UP` (`LIVE_DEVICE_CLEANUP_GAVE_UP_CODE`) | 1 red/green |
| CPC1-27 Low | Note (section 17.5): with fix (b) an early reckoning is corrected by asking the Core; it errs early only when the Core cannot be asked. No code | — |
| CPC1-28 Info | Note: the rename of the socket client's `DEFAULT_TIMERS` is the realtime owner's | — |
| CPC1-29 Info | Note for the mobile briefs (section 17.4, row 13); one sentence in the port's comment | — |

### Public API changes of the round (the final list is section 17.3 of the log)

- New option: `CreateLiveSimOptions.owedSignOut?: LiveOwedSignOutPort`; new types `LiveOwedSignOut`
  (`operatorId`, `issuedAt`, `reason`, `at`; no credential) and `LiveOwedSignOutPort`.
- New value: `LIVE_DEVICE_CLEANUP_GAVE_UP_CODE` (the subpath exports 57 names).
- `actions.signOut` always resolves when somebody is signed in (also when the Core refuses it).
- `live.client`: a 401 ends the session, a 403 refreshes the permission hint (one debounced request).
- At a reckoned expiry the source asks `getAuthSession`; before a debt is settled it asks too.
- After a local EXPIRY the session can come back without a sign-in, when the Core still holds it.
- An action whose storage port failed rejects with `CoreRefusalError('NOT_AVAILABLE')`.
- `CONTRACT-GAP-7` is withdrawn. No member of `LiveSim` or `LiveSecretsPort` changed.

### Findings and decisions of the round

Findings F66-21 to F66-25 and decisions 38 to 49 are in section 17.7 of the log. The three the
controller should look at: decision 38 (an expiry is never signed out, so `CONTRACT-GAP-7` is
gone), decision 39 (an expiry whose session the Core still holds is taken again; the reviewer
wrote "this tab stays signed out"), decision 40 (a refused USER sign-out fails closed like a LOCK).

### Blockers

None.

### Verification (quoted from `implementation/assets/44_round2_gate.log`)

```
## 2026-10-04 15:56:20 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1775 passed (1775)
exit=0
## 15:56:28 the 28 test files that exist at acaff20, alone
 Test Files  28 passed (28)
      Tests  517 passed (517)
exit=0
## 15:56:31 the ten files of this row, alone
 Test Files  10 passed (10)
      Tests  351 passed (351)
exit=0
## 15:56:35 $ npm run typecheck -w @dems/shared       exit=0
## 15:56:38 $ npm run lint -w @dems/shared            exit=0
## 15:56:38 $ npm run typecheck -w @dems/core-web     exit=0
## 15:56:48 $ npm run typecheck -w @dems/mobile       exit=0
```

Ledger: 68 files / 1,747 tests before the round; 68 / 1,775 after (+28, all in this row's files:
323 to 351). Red before, green after (`44_round2_red_green.log`): `37 failed | 295 passed (332)` on
the code before the round; `332 passed (332)` on the tree. Mutation check over the round's code
(`44_round2_mutations.log`): `mutations: 46, killed: 46, survived: 0 []`; the first run
(`44_round2_mutations_run1.log`): 42 of 46.

## E. Third round (decision D100)

Status: **complete**. The three items that ask for code are fixed (CPC1-34, CPC1-35, CPC1-33),
each with tests that are red on the code before the round and green on the tree. CPC1-36 is
capped (my call). CPC1-37 is worded as a contract gap of this row's series. CPC1-38 asks nothing
of this row. Section 17.4 of the log, THE brief list, is updated in place with the four additions
of the third pass (T5) and with what the fixes change for the runtimes.

### Milestones

| Time (WIB) | Milestone |
|---|---|
| 16:08 | The third pass read: T0 to T6 of `gateway_check/07_cp_shared_client.md`, in full |
| 16:11 | P23 pre-images: `.cache/rollback/W44-round3/{source,test}`; hashes in `assets/44_round3_pre_state.txt` |
| 16:12-16:23 | Source, first step: the storage calls in order, a `read` that fails starts closed, the confirmation of a known session after a reconnect (`revalidateSession`, `confirmSession`, `unconfirmed`), the mark cleared in `taken`, the cap of a refused payment, the two gap markers; the documentation of the port in `types.ts`. Suite after the step: the four tests whose rule changed red, nothing else |
| 16:23-16:40 | Tests and source in steps: the model of the Core's session gets an operator per session; the storage tests re-written; the asynchronous storage that finishes out of order; the two-tab tests with a change of operator; then the confirmation refined (an answer about an earlier socket confirms nothing; the question keeps to a `retry-after`; a restart's probe compares too). Suite green after each step: 68 files / 1,795, then 1,805 |
| 16:40 | Mutation check, first run of the round's own changes: 53 changes, 52 detected. One test asserted too little |
| 16:45 | Found by reading while that run was going: a sign-in while a confirmation is out left its flag standing. Fixed, with a test and three changes of the list. Suite green: 1,806 |
| 16:49-16:53 | Second run: 55 of 56 of the round's own, 38 of 38 of the earlier changes on touched lines. One more test (no sign-in after the end). Suite green: 1,807 |
| 16:55-17:00 | Third run on the final code and tests: 56 of 56 and 38 of 38 |
| 17:01 | Red before / green after: 30 tests. Gate green: 68 files / 1,807 tests; the 28 files of `acaff20` alone 517; the ten files of the row 383; typecheck (shared, core-web, mobile) and lint exit 0 |
| 17:05 | `implementation/44_live_source.md`: section 18 written, section 17.4 updated in place |

### Files changed by the round

- `packages/shared/src/live/source/live-sim.ts`, `types.ts` (documentation of `LiveOwedSignOutPort` only), `live-result.ts` (`isThenable` exported inside the folder; `index.ts` is unchanged)
- `packages/shared/test/live-source-local-end.test.ts` (54 to 86 tests), `live-source-platform-neutral.test.ts` (one test changed by design: the gap markers)
- Documents: `implementation/44_live_source.md` (section 18; section 17.4 in place; the notice in the head; the status line), this file
- Evidence, `implementation/assets/`: `44_round3_pre_state.txt`, `44_round3_post_state.txt`, `44_round3_gate.log`, `44_round3_tests_verbose.log`, `44_round3_red_green.py`, `44_round3_red_green.log`, `44_round3_red_before_reasons.log`, `44_round3_mutations.log`, `44_round3_mutations_run1.log`, `44_round3_mutations_run2.log`; refreshed: `44_mutate.py` (209 entries; `W44_TESTS` narrows the tests that run)

Not changed: the 28 test files of `acaff20` (identical hashes), `src/realtime`, `src/live/*.ts`,
`src/sim`, `src/api`, `src/client`, `src/live/testing`, any app. No storage of the platform is
named in the folder, and the folder holds no `fetch(` call. Nothing in the tree was mutated: the
mutation runs and the "before" runs work on copies under `.cache/w44/`.

### Outcome per item

| Item | Outcome | Evidence |
|---|---|---|
| CPC1-34 Low | Fixed. (1) The type's documentation says what the guarantee costs: all three calls synchronous, or a reload inside `write` forgets the Lock. (2) The calls are made in order whatever the storage: a later call waits for the REAL end of the earlier one; a late `clear` cannot erase a newer debt. (3) A `read` that throws, rejects or times out (and a stored value that is no debt) starts CLOSED: the Core is asked, the session it names is not taken, one `error` report, a fresh sign-in is required. `null` takes the session as before | 8 tests red/green (four for `read`, four with an asynchronous fake storage that finishes out of order), 3 guards |
| CPC1-35 Low | Fixed in the source. After a reconnect that follows a time without the session's socket: ONE `getAuthSession` before anything of the new socket is shown. The same session goes on; another one ends the earlier session here (ROTATED, REST, nothing owed) and is taken as at a fresh start. Until the answer the session is unconfirmed: nothing is sent for the operator, and a Lock ends the session here and is settled by asking. The contract text is `CONTRACT-GAP-W44-1` | 19 red/green (the controller's: operator B signs in from another tab while tab A is offline; every store update is watched), 3 guards (the uninterrupted case sends no request) |
| CPC1-33 Low | Fixed: the mark is cleared when a session is taken after a debt check | 1 red/green (a close 4401 without `session.ended` is an end) |
| CPC1-36 Info | Capped, my call: five refusals in a row, one report, then the next OPERATOR socket asks again | 1 red/green |
| CPC1-37 Info | Nothing can be built in the client. Contract text `CONTRACT-GAP-W44-2` (a sign-out that names the session it is for); a marker at the payment | The static test of the markers (1 red/green, shared with W44-1) |
| CPC1-38 Info | Nothing for this row | — |

### Public API changes of the round (section 18.3 of the log)

No name was added, removed or re-typed: 57 exports, 30 members of `LiveSim`, the port's three
members. Changes of behaviour:

- With `owedSignOut`: a `read` that fails, and a stored value that is no debt, start CLOSED (before: open). New report `live.owed`, level `error`.
- The calls of `owedSignOut` are made one after another when the storage answers later.
- After a reconnect of a signed-in client the source sends one `getAuthSession`; until its answer actions that send a request reject with `CORE_OFFLINE` although `link` can be ONLINE, a touch waits, and `signOut` ends the session here and is owed.
- A `LiveSessionEnd` with `reason: 'ROTATED'` can have `source: 'REST'` (a session answer named another session than the known one); the session the credential names is taken right after it.
- A session taken after a debt check ends with `source: 'CLOSE'` when its socket is closed with 4401.
- A payment the Core refuses five times in a row is not repeated on the timer; one more `live.session` report.
- Markers `CONTRACT-GAP-W44-1`, `CONTRACT-GAP-W44-2` in `live-sim.ts`; the texts for the close-out row are section 18.5.

### Findings and decisions of the round

Findings F66-26 to F66-31 and decisions 50 to 60 are in section 18.7 of the log. The four the
controller should look at:

- **Decision 54**: while a session is unconfirmed the source also SENDS nothing for the operator (commands and the read are refused as offline, a sign-out becomes a local end with a debt). D100 asked for "before the replica is shown"; this goes further, because the harm the finding names is requests that act for the credential's operator. The controller may narrow it.
- **F66-27**: a change of operator that is HEARD on an open socket still switches the tab without a session end (§6.5, as built and reviewed); one that is FOUND at a reconnect ends the earlier session first (D100). The shell rows must handle both (brief row 7). One line makes them the same, if ruled.
- **F66-26**: calls of pages through `live.client` are not held back in the unconfirmed window (D84: the view changes nothing of a call).
- **F66-29 / decision 51**: after a closed start nothing is signed out at the Core (nothing is known to be owed); the session that was not taken lives until its idle expiry or the fresh sign-in.

### Blockers

None. Not run by this row: `apps/core-server/src/realtime/__tests__/first-contact.db.test.ts`
(the realtime row's, with a database). Read: its Live sources sign in, drive a session and sign
out, and never reconnect while signed in, and they pass no `owedSignOut`; none of this round's
new paths is on its way.

### Verification (quoted from `implementation/assets/44_round3_gate.log`)

```
## 2026-10-04 17:01:17 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1807 passed (1807)
exit=0
## 17:01:24 the 28 test files that exist at acaff20, alone
 Test Files  28 passed (28)
      Tests  517 passed (517)
exit=0
## 17:01:26 the ten files of this row, alone
 Test Files  10 passed (10)
      Tests  383 passed (383)
exit=0
## 17:01:29 $ npm run typecheck -w @dems/shared       exit=0
## 17:01:32 $ npm run lint -w @dems/shared            exit=0
## 17:01:32 $ npm run typecheck -w @dems/core-web     exit=0
## 17:01:41 $ npm run typecheck -w @dems/mobile       exit=0
```

Ledger: 68 files / 1,775 tests before the round; 68 / 1,807 after (+32, all in
`live-source-local-end.test.ts`: the row's files 351 to 383). Red before, green after
(`44_round3_red_green.log`): `30 failed | 225 passed (255)` on the code before the round;
`255 passed (255)` on the tree. Mutation check over the round's code (`44_round3_mutations.log`):
`mutations: 56, killed: 56, survived: 0 []` for the round's own changes and
`mutations: 38, killed: 38, survived: 0 []` for the earlier ones on touched lines; the first two
runs: 52 of 53 and 55 of 56.

---
*Last Updated: 2026-10-04 17:06*
