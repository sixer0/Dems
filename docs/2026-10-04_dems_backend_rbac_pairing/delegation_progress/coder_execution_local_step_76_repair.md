# Progress: coder-execution-local — repair of step 76 (plan row W54), documentation and evidence only

Status: **the four gaps are closed; nothing in the tree was written but this row's own documents.**
Date: 2026-10-05 (WIB). Request: close claims 8, 12, 13 of
`gateway_check/06a_w54_w57_gate_evidence.md` so the controller can gate W54 (blueprint step 76).
Rule followed throughout: no write under `apps/**` or `packages/**`; M15 satisfied by in-memory
transform only; no credential, token, cookie value or password in any output.

## 1. Fresh gate runs (all five, performed here, not remembered)

Load at 11:34 was `3.92 4.36 4.78`; Node `v26.8.2`, npm `11.19.1`; one workspace at a time, `--maxWorkers=2`.

| Run | Time | Result |
|---|---|---|
| `npm run test -w @dems/core-web -- --maxWorkers=2` | 11:34:21, 59.07 s | **exit 0 · 55 files / 759 tests** |
| the row's three files alone (`live-shell-{indicator,notices,admin}.test.tsx`) | 11:35:32, 9.52 s | **exit 0 · 3 files / 84 tests** |
| `npm run test -w @dems/shared -- --maxWorkers=2` | 11:35:48, 9.82 s | **exit 0 · 68 files / 1,814 tests** |
| `npm run typecheck -w @dems/core-web` | done 11:36:09 | **exit 0** (`tsc -b`, no output) |
| `npm run lint -w @dems/core-web` | done 11:36:09 | **exit 0** (`oxlint`, no finding) |

F76-1 (the red that kept the web suite from exiting 0) is green in this run: D128 ruling 1 landed in
`live-runtime-startup.test.tsx`, which is inside the 55 / 759. Quoted runner output: document section
16.2 and `assets/54_gate_*.log`. These match the verifier's independent measurements (A.1, A.3, B.1).

## 2. The mutation record is now an asset

`implementation/assets/54_mutation_record.txt` — copied out of git-ignored `.cache/w54/mut/` with a
provenance line (source logs and their mtimes, the runner and its in-memory method, the table's md5
`98b88e1b2fa51d849bf8623bbfc3ff2f`, who copied it and when). It carries the four recorded summary lines
(57 → 55/2, 59 → 55/4, 2 → 2/0, 9 → 9/0), the six survivor lines, and the fresh re-test block.

One fact the copy makes visible and the record had never said: the table grew from 57 entries (21:51) to
59 (22:01) to **137** (by 22:02), so **no recorded run ever covered the final table**. Reported as such in
document section 17.1 rather than smoothed over; a fresh full pass is section 17.5.

## 3. The four survivors that had never been re-tested — G05, W11, N39, N40

Re-run first with the row's own harness on the current tree (`assets/54_mut_retest_survivors.log`):

```
## 2026-10-05 11:36:23 WIB baseline … Tests 84 passed (84)
## 2026-10-05 11:37:38 WIB 4 mutations: 0 detected, 4 survived ['W11', 'N39', 'N40', 'G05'], 0 not applied []
```

Before: 55 detected / 4 survived, no re-test. After: the same four survive, and each is **closed as an
equivalent mutant by measurement** — candidate tests injected in memory (config and snippets under
`/var/folders/…/T/kilo/w54_repair/`, the repository untouched), baseline against mutant, every marker
present. Detail in `assets/54_mut_probe_evidence.log` and document section 17.4.

| ID | Verdict | The measurement that decides it |
|---|---|---|
| G05 | equivalent | identical on three surfaces, incl. a production-style `createBrowserHistory`: `mountedLen=1 afterRefusedNavLen=2 afterBackPath=/dashboard backLen=2` at baseline **and** under G05. A six-observable memory-history traversal byte-identical. The flag changes only how many dead entries a browser keeps, and Back over the refused page re-runs the same guard |
| W11 | equivalent by redundancy | after the first press the button is `aria-disabled="true"` / `data-pending="true"` and `switchTo` has run once — identical at baseline and under W11, so the second press never reaches `confirm`. Probe `K01` (removes the *other* guard) alone: 22 passed; `W11+K01`: the row's **existing** test fails. Two guards, one invariant |
| N39 | equivalent, unreachable | mounting signed out measures `path=/login appShellAbsent=true noticesMounted=false roleNoticeCalls=0` in both. `_app` never mounts `AppShell` unsigned, and W50 makes SIGNED_IN and a known session one store update (`live-sim.ts:33`) |
| N40 | equivalent | Simulated mode measures `toastSlots=0 lostTitles=0 chip=SIMULATED dialogs=1 switchToCalls=1` in both, including the page's own "Switch to Live mode" (exactly one dialog). `isLinkLost(null)` short-circuits the only dereference of `live`; the ternary narrows a type, it does not branch behaviour |

**No test was added to any of the row's three files.** The Documentation Contract of this repair forbids
any write under `apps/**`, so "add the missing test" was not available; each survivor therefore had to be
either killed by a probe or shown equivalent. All four are equivalent — none of them has a missing test
that could kill it within the states the row's surfaces can reach. Had one been killable, the exact test
text would have been handed over in these assets for the row's owner to insert.

## 4. Claim 8 corrected (finding F76-13), and the duplicate-confirm finding (F76-14)

* **F76-13.** The clause naming `routes.test.tsx`, `core-endpoint.test.tsx` and `packaged-csp.test.ts`
  belongs to **W50's** verification cell (`02_plan.md:717`); two of those three files have never existed
  (`git cat-file -e acaff20` and the filesystem both say no), so that half of the clause is vacuous. The
  real protected artefacts are `lib/packaged-csp.ts` — never written by anyone, blob-equal
  `78c8898ecb89206beda222030c918958143316c3` — and `lib/core-endpoint.ts`, modified `58 14` against
  `acaff20` **by W50**, its owner, not by W54. `test/routes.test.tsx` does exist and is blob-equal
  `7a04c97d…`; W54's own cell (`:721`) says "the existing shell tests absent", which holds
  (`test/shell-motion.test.tsx` blob-equal `4d82e08e…`). Recorded as a finding for the plan's wording;
  **the plan was not edited**. Document section 24.1.
* **F76-14.** For D128 point 4: `components/shell/mode-switch.tsx:30` and `features/login/use-mode-switch.tsx:34`
  render one identical set of IDs (`mode-switch-dialog`, `-confirm`, `-cancel`), pinned by four test
  files — counted here: indicator 11/4/1, notices 1/1/0, admin 1/1/0 (all W54), login-page 7/4/1 (W55).
  Whichever copy is retired, its tests move with it. Noted for the ruling, not judged. Document 24.2.

## 5. Files written

| File | What |
|---|---|
| `implementation/54_web_shell_admin_routes.md` | cells `GATE_WEB_LINE`, `GATE_MINE`, `GATE_SHARED_LINE`, `MUT_LINE` filled; `GATE_BLOCK` → sections 16.1–16.2; `MUT_BLOCK` → sections 17.1–17.5; one stale token in F76-1 replaced with the honest statement; sections 24.1–24.3 appended. No earlier prose rewritten |
| `implementation/assets/54_mutation_record.txt` | the M15 record with provenance (new) |
| `implementation/assets/54_gate_web_test.log`, `54_gate_shell3_test.log`, `54_gate_shared_test.log`, `54_gate_typecheck_lint.log` | the fresh gate runs, quoted (new) |
| `implementation/assets/54_mut_retest_survivors.log` | the fresh re-test of the four (new) |
| `implementation/assets/54_mut_full_run.log` | the fresh pass over all 137 entries (new) |
| `implementation/assets/54_mut_probe_evidence.log` | the equivalence measurements (new) |
| `delegation_progress/coder_execution_step_76.md` | `MUT_END` (+ its `MUT_LINE`) and `GATE_TIME`/`GATE_SUMMARY` filled — the only cells the row left open |
| `delegation_progress/coder_execution_local_step_76_repair.md` | this file |

Nothing else. `git status` over `apps/core-web/src/components/shell` and `routes/_app/admin` is exactly as
this row left it; `.cache/w54/mut/mutations.json` kept its md5.

## 6. Open for the controller (not closed here)

1. ~~**Section 17.5** — the fresh pass over all 137 entries~~ **closed while this file was being
   written**: the whole table ran 12:02:41→12:46:26 on the current tree — **133 detected, 4 survived
   (`W11`, `N39`, `N40`, `G05` — exactly the four above), 0 not applied**, logged in
   `assets/54_mut_full_run.log` and recorded in document 17.5. No new survivor appeared among the 78
   entries that had never stood in a full pass, and T02 and N36 are DETECTED inside a full pass. M15
   reads complete: 133 killed, 4 equivalent by measurement.
2. **F76-13** — whether to re-word `02_plan.md:717` (two named files do not exist). The plan is the
   controller's file.
3. **F76-14 / D128 point 4** — which copy of the confirmed mode change survives the unification.
4. The row's decisions 1, 2, 3, 9, 11 and the rest of section 20 are unchanged and still need their word;
   this repair touched none of them.
5. The ledger should take the measured numbers: this row's new tests are **84 in 3 files**.
