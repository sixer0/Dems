# Row 19 — B10-e: remove the RC-8 redundant per-test 20 s timeouts in mobile tests (REMOVED, SUITE GREEN)

**Verdict: complete.** All seven RC-8 files now carry **zero** redundant 20 s overrides (`jest.setTimeout(20_000)` and the `LOAD_TOLERANT_TIMEOUT_MS = 20_000` per-test budgets — the documented RC-8 list and the live grep agree, the union is exactly these seven files). No assertion, matcher, expected value or test logic changed; no production file touched; `apps/mobile/jest.config.js` untouched. Every edited file (seven RC-8 + the boundary file for the deferred `40_000`) passed its 3-run trio (2 + 1) with exit 0 on the final blob; the full mobile suite ran once at `--maxWorkers=2` and finished **exit 0 with 192 suites / 1,988 tests** — exactly the ledger floor (`identification/02_structured.md:39`: "mobile 192/1,988"), satisfying "test count >= 1,988". The deferred `jest.setTimeout(40_000)` at `live-settings-boundary.test.tsx:49` was **removed** (decision (a), timing evidence in §3).

Date: 2026-10-07. Agent: coder-execution. Blueprint: `identification/02_structured.md:199` row 19 — Verification: "Per-test 20000 overrides in the RC-8 file list = 0; mobile suite exit 0 with test count >= 1,988". Depends on row 18; precedents: `implementation/01_b10a…` (row 16), `implementation/02_b10b…` (row 17), `implementation/03_b10c…` (row 18). Decisions consulted: D8 (test depth), D10(f) (command convention `npm run test -w @dems/mobile -- <path> --maxWorkers=2` from the repo root), D12(b) (row 17 PASS — the `40_000` left "for row 19's sweep" by `implementation/02_b10b_live_settings_boundary.md` residual 1).

## 1. The RC-8 scope list — documented source + live grep, union = 7 files

The RC-8 record (predecessor task, `docs/2026-10-04_dems_backend_rbac_pairing/verification/13_post_review_recheck.md:116`), quoted:

> | RC-8 | Nit | FXR-M (W93-17) / T1 | `live-session-new-followups.test.tsx:47`, `more-live.test.tsx:36`; `jest.config.js:10` | After T1, the explicit `LOAD_TOLERANT_TIMEOUT_MS = 20_000` budgets equal the new global default and no longer change anything. Five older files also call `jest.setTimeout(20_000)` | Keep as documentation, or remove in a later cleanup. No action needed for the commit |

Routing trail: D255 (`docs/2026-10-04_dems_backend_rbac_pairing/decisions/decisions.md:261` — "RC-2..RC-8 Nits (… redundant 20 s per-test timeouts after T1) routed to the next phase"); ledger line `verification/01_verification.md:171` (O-15); the T1 change itself `gateway_check/16_t1_mobile_jest_timeout.md:6-11` (adds `testTimeout: 20000`; the record names no per-file list). The live grep (repository root):

```
$ grep -rnE "jest\.setTimeout\(\s*20_?000|,\s*20000\s*\)" apps/mobile/src --include="*.test.ts*"
apps/mobile/src/features/evidence/evidence-detail.test.tsx:24:jest.setTimeout(20_000);
apps/mobile/src/features/evidence/evidence-more-menu-title.test.tsx:28:jest.setTimeout(20_000);
apps/mobile/src/features/evidence/play-sheet.test.tsx:19:jest.setTimeout(20_000);
apps/mobile/src/features/storage/storage-screen.test.tsx:38:jest.setTimeout(20_000);
apps/mobile/src/features/devices/devices-screen.test.tsx:16:jest.setTimeout(20_000);
```

and the named-constant form:

```
$ grep -rn "LOAD_TOLERANT_TIMEOUT_MS" apps/mobile/src --include="*.test.ts*"
apps/mobile/src/features/session-new/live-session-new-followups.test.tsx:47:const LOAD_TOLERANT_TIMEOUT_MS = 20_000;
apps/mobile/src/features/session-new/live-session-new-followups.test.tsx:196:    }, LOAD_TOLERANT_TIMEOUT_MS);
apps/mobile/src/features/more/more-live.test.tsx:36:const LOAD_TOLERANT_TIMEOUT_MS = 20_000;
apps/mobile/src/features/more/more-live.test.tsx:90:  }, LOAD_TOLERANT_TIMEOUT_MS);
```

The documented list names the two `LOAD_TOLERANT_TIMEOUT_MS` files explicitly and says "Five older files also call `jest.setTimeout(20_000)`" without naming them; the live grep identifies exactly five such files. **Documented list and live grep agree — no disagreement to report; the union is the seven files below.** Config anchor: `apps/mobile/jest.config.js:9-10` (`testTimeout: 20000`, cites D239/D246) — untouched.

| # | File (pre-edit line) | Form | Source of the entry |
|---|---|---|---|
| 1 | `apps/mobile/src/features/session-new/live-session-new-followups.test.tsx` (`:47` def, `:196` use) | per-test `LOAD_TOLERANT_TIMEOUT_MS = 20_000` budget | documented (`13_post_review_recheck.md:116`) + live grep |
| 2 | `apps/mobile/src/features/more/more-live.test.tsx` (`:36` def, `:90` use) | per-test `LOAD_TOLERANT_TIMEOUT_MS = 20_000` budget | documented (`13_post_review_recheck.md:116`) + live grep |
| 3 | `apps/mobile/src/features/evidence/evidence-detail.test.tsx` (`:24`) | per-file `jest.setTimeout(20_000)` | documented "five older files" + live grep |
| 4 | `apps/mobile/src/features/evidence/evidence-more-menu-title.test.tsx` (`:28`) | per-file `jest.setTimeout(20_000)` | documented "five older files" + live grep |
| 5 | `apps/mobile/src/features/evidence/play-sheet.test.tsx` (`:19`) | per-file `jest.setTimeout(20_000)` | documented "five older files" + live grep |
| 6 | `apps/mobile/src/features/storage/storage-screen.test.tsx` (`:38`) | per-file `jest.setTimeout(20_000)` | documented "five older files" + live grep |
| 7 | `apps/mobile/src/features/devices/devices-screen.test.tsx` (`:16`) | per-file `jest.setTimeout(20_000)` | documented "five older files" + live grep |

Checked and excluded (with reason):

- **`jest.setTimeout(30_000)` in 20 other mobile test files** (census: `grep -rnE "jest\.setTimeout\([0-9_ ]+\)" apps/mobile/src --include="*.test.ts*"` printed 20 lines after the sweep, all `30_000`). An *increase* over the 20000 default is not RC-8 redundancy and not in scope; untouched, routed to row 25 as residual 1.
- **`live-settings-boundary.test.tsx:49` `jest.setTimeout(40_000)`** — deferred to this sweep by row 17 (residual 1 of `implementation/02_b10b_live_settings_boundary.md`); evaluated in §3, removed.
- **`evidence-detail.test.tsx:45` `const VERIFY_TIMEOUT = { timeout: (VERIFY_ASK_MS + SCRAMBLE_MS) * 8 };`** — a `waitFor` polling budget (`(450 + 600) * 8 = 8400` ms; `integrity-tab.tsx:40` `VERIFY_ASK_MS = 450`, `use-scramble.ts:8` `SCRAMBLE_MS = 600`), consumed by `waitFor(…, VERIFY_TIMEOUT)` at `:53`/`:108` — not a jest per-test timeout, below 20000, not in the RC-8 list. Untouched.
- Grep-regex false positives, not timeouts at all: `summary.model.test.ts:54` (`expect(timeSourceAt(history, 20_000))` — assertion argument), `network-time-model.test.ts:94` (`expect(secondsSince(100, 200_000))` — assertion argument), `live-settings-boundary.test.tsx:442` (`until(…, 2_000)` — the file's own poll budget, 2 s, sibling line 17 code, not touched).

## 2. Changes (7 RC-8 files; deletions only, one comment swap per constant file)

`git diff --numstat` — 7 files changed, 9 insertions(+), 22 deletions(-); the nine insertions are the import lines (rewritten without the `jest` binding) and the two RC-8 replacement comments. Blobs (HEAD `2a4f4ea` → working tree, `git rev-parse HEAD:<path>` / `git hash-object <path>`):

| File | Blob | Change |
|---|---|---|
| `live-session-new-followups.test.tsx` | `c57872c → 9d9b650` | deleted `const LOAD_TOLERANT_TIMEOUT_MS = 20_000;` + its `/** W93-17 … */` doc comment; the two-line `// W93-17 …An explicit budget keeps the gate from flaking under load.` comment replaced with a two-line RC-8 comment (records why the budget is gone); `}, LOAD_TOLERANT_TIMEOUT_MS);` → `});` at the one use site |
| `more-live.test.tsx` | `7f3c78e → 1630ec9` | same three removals (def + doc comment at `:35-36`; stale `// W93-17 …` comment → RC-8 comment; `, LOAD_TOLERANT_TIMEOUT_MS` arg dropped at `:90`) |
| `evidence-detail.test.tsx` | `0d0ae64 → 9b5e33d` | deleted `jest.setTimeout(20_000);` (+ blank line); `jest` removed from the `@jest/globals` import — `:24` was the file's only `jest.` reference (`grep -nE "\bjest\." <file>` printed only line 24 pre-edit), so the binding would be unused (would fail the row 27 "root typecheck plus lint exit 0" gate) |
| `evidence-more-menu-title.test.tsx` | `16ac8fe → b5f4494` | same (`:28` was the only `jest.` reference) |
| `play-sheet.test.tsx` | `5409789 → f6449c9` | deleted `jest.setTimeout(20_000);` (+ blank line); `jest` import kept — still used at `:27-29` (`jest.Mock`), `:66` (`jest.spyOn`) |
| `storage-screen.test.tsx` | `b0ad10a → c9e180c` | deleted `jest.setTimeout(20_000);` (+ blank line); `jest` import kept — still used (`jest.mock`/`jest.fn`/`jest.mocked`, 10+ sites) |
| `devices-screen.test.tsx` | `fd2a81a → 674311b` | deleted `jest.setTimeout(20_000);` (+ blank line); `jest` removed from the import — `:16` was the only `jest.` reference |

No assertion, matcher, expected value, test name or test logic changed anywhere; no production file touched; `jest.config.js` unchanged. Gates: `npx tsc -p apps/mobile/tsconfig.json --noEmit` → exit 0; `npx eslint <the 8 edited files>` (cwd `apps/mobile`) → exit 0 — the import trims are lint-clean.

## 3. The deferred `jest.setTimeout(40_000)` at `live-settings-boundary.test.tsx:49` — decision (a) REMOVED

Row 17 converted both real waits of this file to fake timers and left the 40 s ceiling "for row 19" (`implementation/02_b10b_live_settings_boundary.md` residual 1: "the 40 s ceiling is now doubly redundant against `jest.config.js:10` `testTimeout: 20000`"). A 40000 ceiling above the 20000 default is an *increase*, not RC-8 redundancy, so it is decided on measurement, per this row's assignment.

Baseline measurement on the pre-sweep blob (row 17's state, override still in place): `npm run test -w @dems/mobile -- src/features/settings/live-settings-boundary --maxWorkers=2 --verbose` → exit 0, 8/8 passed, `Time: 6.581 s`; per-test durations quoted: 822, 318, 438, 227, 608, 376, 522, 259 ms — **max 822 ms**, ~24x margin below 20000, under host load 7.03 (`16:53 … load averages: 7.03 6.28 6.44`). No test needs >20 s; the ceiling was removed as a single-line deletion (nothing else in the file touched — row 17's conversion hunks remain as they were gated). The 3-run trio in §4 confirms the file green at the default ceiling, and the full-suite run exercised it under suite-wide load.

## 4. Per-file verification — 3 runs each (2 + 1) on the final blobs, all exit 0

Command form (D10(f)): `npm run test -w @dems/mobile -- <path> --maxWorkers=2`, repository root. Summary lines quoted per run; all 24 runs exit 0, zero flakes, zero re-runs needed.

| File (tests) | run 1 | run 2 | run 3 |
|---|---|---|---|
| `live-session-new-followups` (9) | `PASS … (5.864 s)` / `Test Suites: 1 passed, 1 total` / `Tests: 9 passed, 9 total` / `Time: 5.959 s` | `PASS` / `1 passed, 1 total` / `9 passed, 9 total` / `Time: 4.118 s` | `PASS` / `1 passed, 1 total` / `9 passed, 9 total` / `Time: 4.446 s` |
| `more-live` (5) | `PASS` / `1 passed, 1 total` / `5 passed, 5 total` / `Time: 2.66 s` | `PASS` / `1 passed, 1 total` / `5 passed, 5 total` / `Time: 2.437 s` | `PASS` / `1 passed, 1 total` / `5 passed, 5 total` / `Time: 2.291 s` |
| `evidence-detail` (7) | `PASS … (10.637 s)` / `1 passed, 1 total` / `7 passed, 7 total` / `Time: 10.711 s` | `PASS … (10.907 s)` / `1 passed, 1 total` / `7 passed, 7 total` / `Time: 11.004 s` | `PASS … (10.403 s)` / `1 passed, 1 total` / `7 passed, 7 total` / `Time: 10.5 s` |
| `evidence-more-menu-title` (3) | `PASS` / `1 passed, 1 total` / `3 passed, 3 total` / `Time: 3.188 s` | `PASS` / `1 passed, 1 total` / `3 passed, 3 total` / `Time: 2.739 s` | `PASS` / `1 passed, 1 total` / `3 passed, 3 total` / `Time: 2.58 s` |
| `play-sheet` (5) | `PASS` / `1 passed, 1 total` / `5 passed, 5 total` / `Time: 3.508 s` | `PASS` / `1 passed, 1 total` / `5 passed, 5 total` / `Time: 3.408 s` | `PASS` / `1 passed, 1 total` / `5 passed, 5 total` / `Time: 3.325 s` |
| `storage-screen` (7) | `PASS` / `1 passed, 1 total` / `7 passed, 7 total` / `Time: 3.377 s` | `PASS` / `1 passed, 1 total` / `7 passed, 7 total` / `Time: 3.233 s` | `PASS` / `1 passed, 1 total` / `7 passed, 7 total` / `Time: 3.122 s` |
| `devices-screen` (11) | `PASS` / `1 passed, 1 total` / `11 passed, 11 total` / `Time: 3.992 s` | `PASS` / `1 passed, 1 total` / `11 passed, 11 total` / `Time: 3.301 s` | `PASS` / `1 passed, 1 total` / `11 passed, 11 total` / `Time: 3.375 s` |
| `live-settings-boundary` (8, post `40_000` removal) | `PASS … (5.948 s)` / `1 passed, 1 total` / `8 passed, 8 total` / `Time: 6.01 s` | `PASS … (5.679 s)` / `1 passed, 1 total` / `8 passed, 8 total` / `Time: 5.746 s` | `PASS … (5.127 s)` / `1 passed, 1 total` / `8 passed, 8 total` / `Time: 5.187 s` |

Ceiling headroom: every test of an edited file is bounded by its suite's wall time (runs execute one suite per file here) — max observed suite wall 11.004 s (`evidence-detail`), comfortably inside the config default `testTimeout: 20000`. No timeout was raised anywhere to make anything pass; test counts per file are unchanged from the pre-edit state (`live-session-new-followups` 9, `more-live` 5, `evidence-detail` 7, `evidence-more-menu-title` 3, `play-sheet` 5, `storage-screen` 7, `devices-screen` 11, boundary 8 — D12(b)'s "3/3 green (8 tests)" for row 17 matches).

## 5. Full mobile suite — one regression run, exit 0, 192 suites / 1,988 tests

`npm run test -w @dems/mobile -- --maxWorkers=2`, repository root, single run (this row owns the mobile jest runner this wave — no other workspace suite, no root `npm test`). Host: `16:57 … load averages: 7.09 6.59 6.52`. Final summary, quoted:

```
Test Suites: 192 passed, 192 total
Tests:       1988 passed, 1988 total
Snapshots:   0 total
Time:        243.609 s, estimated 648 s
```

Exit code 0 (`FULLSUITE_EXIT=0`). Log cross-check: `grep -cE "^PASS"` → 192, `grep -cE "^FAIL"` → 0. Test count 1,988 = the ledger floor exactly (`identification/02_structured.md:39` "mobile 192/1,988"); the acceptance line "test count >= 1,988" is met. No flake occurred, so no re-run was performed. The run's log also prints jest's long-standing `A worker process has failed to exit gracefully … force exited` notice — pre-existing and accepted, documented since baseline as N-4 (`docs/2026-10-04_dems_backend_rbac_pairing/initialization/02_baseline_gate.md:276`, "the exit code is still 0"), caused by W87-F1 (unref'd 2 s flush timer, `decisions.md:195`) and accepted as residual C1-R1 (`verification/01_verification.md:137`, "It did not cause a failure"). Not caused by and not fixable within this row.

## 6. Zero-override proof (acceptance line 1)

Task-form grep after the sweep (repository root):

```
$ grep -rnE "jest\.setTimeout\(\s*20_?000|,\s*20000\s*\)" apps/mobile/src --include="*.test.ts*"
(no output; exit 1)
```

All RC-8 forms, including the named-constant form:

```
$ grep -rnE "jest\.setTimeout\(\s*20_?000|,\s*20000\s*\)|LOAD_TOLERANT_TIMEOUT_MS" apps/mobile/src --include="*.test.ts*"
(no output; exit 1)
```

Per-file counts over the seven-file scope list (`grep -cE "jest\.setTimeout\(\s*20_?000|LOAD_TOLERANT_TIMEOUT_MS" <file>`): `0` for each of the seven — the RC-8 override count in the scope list is **0 = 0**.

## 7. Production diff empty — with sibling attribution (acceptance line 3 form)

```
$ git diff --name-only -- apps/ packages/ scripts/ release/ | grep -v "\.test\."
(no output; exit 1 — nothing printed)
```

All ten entries of `git diff --name-only -- apps/ packages/ scripts/ release/` are `*.test.tsx` files:

| Changed file | Owner | This row's touch |
|---|---|---|
| `apps/mobile/src/features/session-new/live-session-new-followups.test.tsx` | **row 19 (mine)** | RC-8 removal (§2) |
| `apps/mobile/src/features/more/more-live.test.tsx` | **row 19 (mine)** | RC-8 removal |
| `apps/mobile/src/features/evidence/evidence-detail.test.tsx` | **row 19 (mine)** | RC-8 removal |
| `apps/mobile/src/features/evidence/evidence-more-menu-title.test.tsx` | **row 19 (mine)** | RC-8 removal |
| `apps/mobile/src/features/evidence/play-sheet.test.tsx` | **row 19 (mine)** | RC-8 removal |
| `apps/mobile/src/features/storage/storage-screen.test.tsx` | **row 19 (mine)** | RC-8 removal |
| `apps/mobile/src/features/devices/devices-screen.test.tsx` | **row 19 (mine)** | RC-8 removal |
| `apps/mobile/src/features/settings/live-settings-boundary.test.tsx` | row 17's gated conversion (pre-existing, D12(b)) + **row 19's one-line `40_000` deletion (§3)** | the single timeout line only; row 17's hunks untouched |
| `apps/mobile/src/features/session-live/live-session-live-link.test.tsx` | **row 18 (pre-existing sibling)** | not touched by this row (§1 census: it carries no `jest.setTimeout`) |
| `apps/core-web/src/test/live-paired-devices-issue.test.tsx` | **row 20 (pre-existing sibling)** | not touched by this row |

Zero production entries; `apps/mobile/jest.config.js` not in the diff (unchanged). No emulator, no sudo, no network, no dependency/lockfile change; `git status` shows only test files plus the task-folder docs.

## 8. Residuals and notes for row 25 (senior code review of the B10 diffs)

1. **The `30_000` population is out of RC-8 but is the same smell, one tier up:** 20 mobile test files still carry `jest.setTimeout(30_000)` (exact list reproducible with `grep -rnE "jest\.setTimeout\(" apps/mobile/src --include="*.test.ts*"`). Several are on files row 16-18 have since made CPU-bounded (e.g. `live-gap-s1-2-biometric`), and 30000 was chosen pre-T1 against the 5 s default; whether they still earn their extra 10 s is a per-file timing question for a future sweep — deliberately not done here: the row's scope is RC-8's `20_000` redundancy plus the deferred `40_000` only.
2. **Import trims:** three files lost the `jest` binding from their `@jest/globals` import because `jest.setTimeout(20_000)` was their only `jest.` reference (§2 table). Reviewer can verify per file with `grep -nE "\bjest\."` — zero matches beyond the import line pre-trim.
3. **Boundary file has two rows in one uncommitted diff:** `git diff` of `live-settings-boundary.test.tsx` (HEAD `0505dd9` → worktree `084e87d`, numstat +20/−6) mixes row 17's gated conversion and row 19's single-line `40_000` deletion; the latter is the only change this row made to the file. Row 25 should review row 17's hunks against `implementation/02_b10b…`, not re-derive them from this row's record.
4. **RC-8 comments added in two files** (`live-session-new-followups.test.tsx`, `more-live.test.tsx`) replace the stale W93-17 budget comments and cite D239/D255 + `jest.config.js:10` — kept deliberately (the predecessor record itself said "keep as documentation"); if row 25 prefers zero comment churn, these two hunks are the only insertions beyond the import trims.
5. **Suite wall under load:** 243.6 s at load ~7 with `--maxWorkers=2`; `evidence-detail` remains the slowest edited file (suite wall ~11 s, ~2x headroom to the 20 s ceiling per test). If row 27's regression sees a load flake in a full root run, the lever is worker count/host load, not a re-added override (D255's ruling, and this row's constraint: no timeout was or may be raised to force green).
6. **`waitFor` budgets are not jest timeouts:** the `{ timeout: … }` object form inside `waitFor` options (e.g. `evidence-detail` `VERIFY_TIMEOUT` = 8400 ms) is orthogonal to `testTimeout`; a future sweep regex like `grep -rEn "\{\s*timeout:" apps/mobile/src --include="*.test.ts*"` will keep returning such hits — they are polling budgets, not test ceilings.

---
*Row 19, blueprint `identification/02_structured.md:199`; baseline HEAD `2a4f4ea`. Precedents: rows 16-18 (`implementation/01…`, `02…`, `03…`). Verification evidence: sections 4-7. Prepared 2026-10-07. No `masterplan/02_plan.md` exists in this task folder (only `masterplan/01_specs.md`), so plan tracking was not applicable; `status_tasks.md` is owned by the controller per this row's documentation contract.*
