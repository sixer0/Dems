# Delegation progress: senior-code-reviewer, step 68 (W46, CHECKPOINT CP-C1)

| Field | Value |
|---|---|
| Task | 2026-10-04_dems_backend_rbac_pairing |
| Blueprint step / plan row | 68 / W46 |
| Agent | senior-code-reviewer (tier R) |
| Status | **complete** |
| Verdict | **PASS WITH FIXES**: 0 Blocker, 0 High, 6 Medium, 12 Low, 4 Info |
| Output document | `gateway_check/07_cp_shared_client.md` |
| First timed command / finished | 2026-10-04 12:47:31 / 13:06 WIB |

## Files created

- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/07_cp_shared_client.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/senior_code_reviewer_step_68.md` (this file)

No source file, no test file and no shared tracker was written (`status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md` untouched:
parallel run).

## Commands run (from the workspace root, no `cd` into a subfolder)

```
12:47:31 WIB  npm run typecheck -w @dems/shared                  exit=0
              npm run lint -w @dems/shared                       exit=0
12:47:37 WIB  npm run test -w @dems/shared -- --maxWorkers=2     64 files / 1650 tests passed, exit=0
```

Plus read-only `git diff` / `git status` / `git ls-tree`, `grep`, and four `graft callers`
queries. The test output went to `$TMPDIR/cpc1_shared_test.log`. Nothing else was executed: the
findings on behaviour are traced in the code, not reproduced.

## The row's verification

| Item | Result |
|---|---|
| Findings carry file:line and severity | Yes (report section 5) |
| `git diff acaff20 -- packages/shared/src/sim` shows only the additions of W16 and the recorded SIM-GAP-1 fix | Yes: `auth.ts` +5, `vocabulary.ts` +27 (D37, D41); `session-machine.ts` +5 −2, `evidence-actions.ts` +3 −2, new `text-cut.ts` (D53, D56). Nothing else |
| Each blocker names its owning row | No blocker. Every finding names its owner |

## Findings by severity

| Severity | IDs |
|---|---|
| Blocker | none |
| High | none |
| Medium | CPC1-1 (W44, device revocation not idempotent; reopen loop when the port leaves the credential), CPC1-2 (W44, an exception in a store update freezes the replica and cuts a session end short), CPC1-3 (W12, credential provider outside the time-out), CPC1-4 (W44 and the client rows, F66-10 needs a run-time guard and a wider static test), CPC1-5 (W44, envelope codes as string literals), CPC1-21 (controller decision, no local lock while the link is down) |
| Low | CPC1-6 (W44, gap adapters unmarked for W83), CPC1-7 to CPC1-11 (W44), CPC1-12 (W12), CPC1-13 (W18), CPC1-14 to CPC1-16 (W44), CPC1-17 (controller, the text of AC-B-62 and TS-1) |
| Info | CPC1-18 (W44), CPC1-19 (W30, note for W51), CPC1-20 (W44), CPC1-22 (the web System page row) |

## Decisions for the controller to record

1. CP-C1 verdict PASS WITH FIXES; W50 and W51 may start. No API of the four subpaths changes.
2. The 18 decisions of W44: none overruled. 2, 14 and 16 upheld; 3, 5, 7 and 8 upheld with the
   conditions of report section 8.
3. F66-10: the static test of AC-C-53 is not sufficient alone. Add the run-time report in the
   Live source (CPC1-4) and widen the test to `components/`, `routes/`, `navigation/`, `runtime/`.
4. F66-9: `live-sim.ts` is not split before W50 / W51; the flags become one state record with the
   fixes of CPC1-1 and CPC1-2 (report section 6).
5. New decision asked, CPC1-21: sign-out, lock and idle expiry while the link is not ONLINE.
6. CPC1-17: amend AC-B-62 (`01_specs.md:1818`) and TS-1 (`04_client_integration_spec.md:1119`)
   for SIM-GAP-1 before W97.
7. A fix slot for W44 (CPC1-1, 2, 4, 5, 6, then 7 to 11) and one for W12 (CPC1-3, CPC1-12); a
   one-line addition for W18 (CPC1-13).
8. Six notes for the briefs of W50 and W51 (report section 9, last paragraph).

## Blockers

None.

## Limits

Report section 10: nothing executed beyond the three commands; `src/live/testing` and the test
files read in part; the contract not reviewed; no real server, browser or device observed.

---
*Generated: 2026-10-04 13:06 WIB*

---

# Re-review of the fix rounds (decisions D80, D81, D84, D86)

| Field | Value |
|---|---|
| Status | **complete** |
| Verdict after the fixes | **PASS WITH FIXES**: 0 Blocker, 0 High; W50 and W51 may start |
| Findings of the first pass (22) | 19 closed in the code; 1 closed by a ruling (CPC1-17); 2 routed to briefs (CPC1-19 at W51, CPC1-22 at W76) |
| New findings (10) | 2 Medium (CPC1-23, CPC1-24), 5 Low (CPC1-25, 26, 27, 31, 32), 3 Info (CPC1-28, 29, 30) |
| Output | Section "Re-review of the fix rounds" appended to `gateway_check/07_cp_shared_client.md` (R0 to R5); the first pass is unchanged |
| First timed command / finished | 2026-10-04 15:11 / 15:25 WIB |

## Files updated

- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/07_cp_shared_client.md` (appended)
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/senior_code_reviewer_step_68.md` (this section)

No source file, no test file and no controller file was written.

## Commands run (from the workspace root)

```
15:11 WIB     npm run typecheck -w @dems/shared                  exit=0
              npm run lint -w @dems/shared                       exit=0
15:11:54 WIB  npm run test -w @dems/shared -- --maxWorkers=2     68 files / 1747 tests passed, exit=0
```

Plus read-only `git diff` (also `--no-index` against the pre-images under `.cache/rollback/`),
`git status`, `grep`, and file listings. The test output went to
`$TMPDIR/cpc1_rereview_test.log`. Deviation from P10, stated: one read-only command changed into
the assets folder before a listing; the working directory is reset between commands and nothing
was written there.

## New findings

| ID | Severity | Owner | Before | One line |
|---|---|---|---|---|
| CPC1-23 | Medium | W44 | W54; any lane check with two tabs | A local expiry can end a session the Core still holds (activity of another tab, a lost answer; any link change counts, RESYNCING included), and the owed sign-out then ends it for every tab; the owed request names no session |
| CPC1-24 | Medium | Controller; W44 and W50 | W54 | The debt of a local end is in memory: a page reload forgets it, so a Lock made while the Core was unreachable is undone inside the idle window |
| CPC1-25 | Low | W44 | W92 | An action's late answer is not held to the session that sent it |
| CPC1-26 | Low | W44 | W56 | The text and stack of what the app's secrets port throws travel into reports |
| CPC1-27 | Low | W44 | W92 | The Live clock cannot follow a server clock that is behind the local one; the local expiry then comes early |
| CPC1-31 | Low | W44 | W92 | A sign-out the Core refuses (not 401) fails open, also for an owed one |
| CPC1-32 | Low | Controller; W44 | W77, W81 | Decision 35: a page call through `live.client` gets no CL-23 |
| CPC1-28 | Info | W30's owner | W92 | Two exports named `DEFAULT_TIMERS` |
| CPC1-29 | Info | Briefs of W51, W56, W57 | — | The 5 s bound on `sessionIssued` and `devicePaired`: no OS prompt inside; an orphan device or session otherwise |
| CPC1-30 | Info | Briefs of W50, W51, W57 | — | Contained exceptions are loud only if the app's sink makes them so; a stopped source does not expire; how the app sees that the device clean-up gave up |

## Decisions for the controller to record

1. Re-review verdict PASS WITH FIXES; W50 and W51 may be briefed from sections 15 and 16.6 of the
   Live source's log plus the ten additions of report R5 (a to j).
2. Decisions 19 to 37 of the Live source: upheld, except **21 overruled in part** (an expiry
   decided here is not signed out blindly: the Core is asked first), **24 amended** (at the
   instant the Core is asked for the real expiry; RESYNCING counts as "the Core would tell"),
   **35 overruled** (a page call through `live.client` gets the full CL-23; the exemption from
   CL-22 stays). 20 and 37 upheld for now (CPC1-31, CPC1-28).
3. CPC1-24: either an optional port for the owed sign-out (the web keeps it in the tab's
   `sessionStorage`), or a recorded residual beside F66-15.
4. A second fix slot for W44: CPC1-23, CPC1-24 (if ruled), CPC1-32 (if ruled), CPC1-26; then
   CPC1-25, 27, 31 by W92.
5. The note on CP-B1: the client layer hands the apps no error object; the free text of what app
   code threw does travel (CPC1-26).

## Blockers

None.

---

# Third pass: the second fix round (decisions D90, D97)

| Field | Value |
|---|---|
| Status | **complete** |
| Verdict | **PASS WITH FIXES, Low only**: nothing of Medium or higher is open; W50 and W51 proceed |
| The seven findings of the round | CPC1-23, 24, 25, 26, 30, 31, 32: all closed (test bodies read for CPC1-23 and CPC1-24: each fails on the code before the round) |
| New items (6) | 3 Low (CPC1-33, 34, 35), 3 Info (CPC1-36, 37, 38) |
| Output | Section "Third pass: the second fix round (decisions D90, D97)" appended to `gateway_check/07_cp_shared_client.md` (T0 to T6); earlier sections unchanged |
| First timed command / finished | 2026-10-04 15:59:52 / 16:07 WIB |

## Files updated

- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/07_cp_shared_client.md` (appended)
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/senior_code_reviewer_step_68.md` (this section)

No source file, no test file and no controller file was written. No `cd` in this pass.

## Commands run (from the workspace root)

```
15:59:52 WIB  npm run typecheck -w @dems/shared                  exit=0
              npm run lint -w @dems/shared                       exit=0
15:59:55 WIB  npm run test -w @dems/shared -- --maxWorkers=2     68 files / 1775 tests passed, exit=0
```

Plus read-only `git diff --no-index` against the pre-images under `.cache/rollback/W44-round2/`,
`git -C … diff acaff20 --numstat` (the simulator diff is unchanged), `grep` and file listings.
The test output went to `$TMPDIR/cpc1_third_test.log`.

## New items

| ID | Severity | Owner | Before | One line |
|---|---|---|---|---|
| CPC1-33 | Low | W44 | W92 | After a debt check that takes a session on the open socket, a later close 4401 without `session.ended` is not treated as an end |
| CPC1-34 | Low | W44 | W50 writes its port | The port's type allows asynchronous `write` and `clear`; its comment does not say the guarantee needs a synchronous storage; no test has an asynchronous port |
| CPC1-35 | Low | W44 | The two-tab lane check with a change of operator | Not from this round: a known session is not re-checked at an OPERATOR `hello` of a reconnect, so a missed ROTATED or `session.updated` leaves the session stale for up to 15 minutes |
| CPC1-36 | Info | W44 | W92 | A payment the Core keeps refusing is repeated without an end (not reachable today) |
| CPC1-37 | Info | W83, optional | W83 | Between the question and the payment another tab can sign in; only a sign-out that names the session closes it |
| CPC1-38 | Info | Controller | The final report | Residuals: a local Lock protects the screen, not the session, until the debt is paid; an open second tab keeps its replica until its link returns; a failing `read` fails open |

## Decisions for the controller to record

1. Third pass: PASS WITH FIXES (Low only). The seven findings of D90 are closed.
2. Decisions 38 to 49 of the Live source: all upheld. On 39 I withdraw "this tab stays signed
   out": the session is taken again only when the Core says it is open by its own clock. 43
   upheld with CPC1-34.
3. F66-23 (up to about 10 s of data past the instant when REST black-holes) and F66-25 accepted.
4. Section 17.4 of the Live source's log is THE brief list, with four additions (report T5,
   a to d): all three storage calls synchronous and the open-second-tab caveat (W50); no repeat
   of a 401 or 403 in the query client (W77, W81); a sign-in can wait up to 16 s behind a debt
   (W55); the two-tab lane check without a change of operator until CPC1-35.
5. A small slot for W44: CPC1-34 and CPC1-35 first; CPC1-33 and CPC1-36 by W92.

## Blockers

None.
