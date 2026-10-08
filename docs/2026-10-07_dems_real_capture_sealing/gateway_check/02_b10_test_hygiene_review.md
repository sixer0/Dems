# Row 25 — Senior code review: B10 test-hygiene diffs (rows 16-21, wave A)

> **Superseded in part (2026-10-08, audit D19/D21):** see `implementation/09_rv_code_audit_fixes.md` — the `:132` failure site of `live-paired-devices-issue` is now deterministic, and the row-22 after-stop hold was replaced by ruling D19(b) (the Core's recorded duration wins once the stop is known).


Date: 2026-10-07
Reviewer: senior-code-reviewer
Plan: identification/02_structured.md:205 row 25. Hard gate: "Verdict per file (6 files); 0 production files in the diff; each finding routed to its producing row."
Scope: the test-hygiene diffs produced by rows 16-21. Row 22 (RC-1) is excluded — it runs in parallel.
Method: read-only. No test or source file was edited; findings below are routed, not fixed. One confirmatory suite run (row 17) at `--maxWorkers=2`; no other workspace, no root `npm test`, no emulator, no network.

---

## 1. Diff enumeration — the real set vs the blueprint's "6 files"

The blueprint's "6 files" (`02_structured.md:205`) is a row-count estimate (6 producing rows 16-21, one file each). The real set is larger and uneven: row 16 changed **no file**, row 19 changed **7**, one mobile file carries two rows' edits. Enumerated from `git status --porcelain -- apps/` and `git diff --name-only`:

| # | File | Producing row | Notes |
|---|---|---|---|
| 1 | `apps/mobile/src/features/session-live/live-gap-read-only-dialog.test.tsx` | 16 | **Not in the diff.** Row 16's audit found the file already virtual; no edit made (`implementation/01_b10a…md` §2, §5). |
| 2 | `apps/mobile/src/features/settings/live-settings-boundary.test.tsx` | 17 (+ 19) | Row 17's conversion + row 19's one-line `jest.setTimeout(40_000)` deletion (mixed uncommitted diff; row 19 report §3). |
| 3 | `apps/mobile/src/features/session-live/live-session-live-link.test.tsx` | 18 | converted. |
| 4 | `apps/mobile/src/features/session-new/live-session-new-followups.test.tsx` | 19 | RC-8 removal. |
| 5 | `apps/mobile/src/features/more/more-live.test.tsx` | 19 | RC-8 removal. |
| 6 | `apps/mobile/src/features/evidence/evidence-detail.test.tsx` | 19 | RC-8 removal + import trim. |
| 7 | `apps/mobile/src/features/evidence/evidence-more-menu-title.test.tsx` | 19 | RC-8 removal + import trim. |
| 8 | `apps/mobile/src/features/evidence/play-sheet.test.tsx` | 19 | RC-8 removal. |
| 9 | `apps/mobile/src/features/storage/storage-screen.test.tsx` | 19 | RC-8 removal. |
| 10 | `apps/mobile/src/features/devices/devices-screen.test.tsx` | 19 | RC-8 removal + import trim. |
| 11 | `apps/core-web/src/test/live-paired-devices-issue.test.tsx` | 20 | converted. |
| 12 | `apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx` | 21 | converted. |

**Delta to report:** 12 row targets; 11 carry diffs; row 16 carries none. Everything else in `git status` is controller docs under `docs/` (ignored, §4). No unexplained path was found.

---

## 2. Verdict per file

| File | Row | Verdict | Reasoning (1-2 lines) |
|---|---|---|---|
| `session-live/live-gap-read-only-dialog.test.tsx` | 16 | **PASS (no change)** | No diff; the file was already bed-virtual (0 timer tokens, `implementation/01_b10a…md` §1, §4). Acceptance "real-time waits = 0" is met vacuously; the row correctly refused to fabricate an edit. |
| `settings/live-settings-boundary.test.tsx` | 17 | **PASS** | Two real waits converted to a runner fake clock + `beforeAll` setImmediate priming + `afterEach` restore; 0 literal waits remain; confirmatory run 8/8 green (§7). Diff wording matches the file. |
| `session-live/live-session-live-link.test.tsx` | 18 | **PASS-with-findings** | Conversion is correct and leak-free; file-local waits = 0. Finding F3: the shared `monitor-harness` real sleep still couples two other files. |
| `session-new/live-session-new-followups.test.tsx` | 19 | **PASS** | `LOAD_TOLERANT_TIMEOUT_MS` removed from def and the one `it()` budget; global default is the same 20000 (`jest.config.js:10`); no assertion changed. |
| `more/more-live.test.tsx` | 19 | **PASS** | Same form as above; `jest` binding correctly retained (still used by `jest.mock`). |
| `evidence/evidence-detail.test.tsx` | 19 | **PASS** | `jest.setTimeout(20_000)` removed; `jest` binding trimmed because `grep -nE "\bjest\."` → 0 refs (verified). |
| `evidence/evidence-more-menu-title.test.tsx` | 19 | **PASS** | Same; 0 `jest.` refs after the trim (verified). |
| `evidence/play-sheet.test.tsx` | 19 | **PASS** | `jest.setTimeout(20_000)` removed; binding retained (still 4+ `jest.` uses: `jest.Mock`, `jest.spyOn`). |
| `storage/storage-screen.test.tsx` | 19 | **PASS** | `jest.setTimeout(20_000)` removed; binding retained (jest.mock/fn/mocked in use). |
| `devices/devices-screen.test.tsx` | 19 | **PASS** | `jest.setTimeout(20_000)` removed; binding trimmed, 0 `jest.` refs (verified). |
| `core-web/src/test/live-paired-devices-issue.test.tsx` | 20 | **PASS-with-findings** | `bed.elapse(50, 50)` is a correct, superset-equivalent virtual window (`live-harness.ts:446-453`: 1×50 ms advance + flush). Findings F1 (coverage reduction) and F2 (shared `clearToasts` 350 ms still on the path). |
| `navigation/__tests__/chrome-lost-updates.test.tsx` | 21 | **PASS** | Four real 700 ms sleeps (helper + 4 sites) converted to a runner advance with priming and restore; no assertion changed; file-local waits = 0. |

---

## 3. Overall verdict

**PASS** for wave A's test-hygiene portion.

| Count | Value |
|---|---|
| Row targets reviewed | 12 (6 producing rows) |
| Changed files reviewed | 11 (all `*.test.tsx`) |
| Production files in the diff | **0** |
| Config / lockfile / package changes | **0** |
| Findings — Blocker | 0 |
| Findings — Major | 0 |
| Findings — Minor | 4 (F1-F4) |
| Findings — Nit | 2 (F5-F6) |
| Confirmatory suites run | 1 (row 17, PASS 8/8) |

No blocker and no major. Every conversion is test-only, behaviour-preserving (assertions, matchers, expected values, test names, timeouts and retry counts unchanged), and restores the clock in `afterEach`. The four Minor findings are residual coupling or documented coverage nuances, all routed to a producing row.

---

## 4. The "0 production files in the diff" proof

Primary command (all changed paths under the code trees are `*.test.tsx`):

```
$ git diff --name-only -- apps/ packages/ scripts/ release/
apps/core-web/src/test/live-paired-devices-issue.test.tsx
apps/mobile/src/features/devices/devices-screen.test.tsx
apps/mobile/src/features/evidence/evidence-detail.test.tsx
apps/mobile/src/features/evidence/evidence-more-menu-title.test.tsx
apps/mobile/src/features/evidence/play-sheet.test.tsx
apps/mobile/src/features/more/more-live.test.tsx
apps/mobile/src/features/session-live/live-session-live-link.test.tsx
apps/mobile/src/features/session-new/live-session-new-followups.test.tsx
apps/mobile/src/features/settings/live-settings-boundary.test.tsx
apps/mobile/src/features/storage/storage-screen.test.tsx
apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx

$ git diff --name-only -- apps/ packages/ scripts/ release/ | grep -v -E '\.test\.(ts|tsx)$'
(no output; exit 1)                                  <- 0 non-test paths

$ git diff --stat -- apps/ packages/ scripts/ release/ ':(exclude)*.test.ts' ':(exclude)*.test.tsx' ':(exclude)**/__tests__/**' ':(exclude)**/testing/**'
(empty)                                              <- production code: 0 files, 0 lines

$ git diff --stat -- package.json package-lock.json apps/mobile/jest.config.js apps/mobile/jest.setup.ts apps/core-web/package.json apps/core-web/vite.config.ts
(empty)                                              <- no manifest, lockfile or config change
```

Untracked files under `apps/`, `packages/`, `scripts/`, `release/`: **none** (`git ls-files --others --exclude-standard -- apps/ packages/ scripts/ release/` empty). The only other changed paths are controller docs under `docs/2026-10-07_dems_real_capture_sealing/` (decisions, progress, status), which are out of scope.

Timeout-removal proof (row 19), repository root:

```
$ grep -rnE "jest\.setTimeout\(\s*20_?000|,\s*20000\s*\)|LOAD_TOLERANT_TIMEOUT_MS" apps/mobile/src --include="*.test.ts*"
(no output; exit 1)
```

---

## 5. Findings table

| ID | Severity | File:line | What | Why it matters | Remediation | Producing row |
|---|---|---|---|---|---|---|
| F1 | Minor | `apps/core-web/src/test/live-paired-devices-issue.test.tsx:375` | The 50 ms real quiet window became `bed.elapse(50, 50)`, which advances the **fake transport clock** only; real (global) timers due within 50 ms no longer execute in that window. | A latent weakening of the W92-16 "one toast call" guard if production later adds a short global timer on this path (today the only real timer is the 1500 ms highlight fade, `devices-panel.tsx:163`). Row 20 residual 1 already flags it. | Keep the change (justified by measurement), and either add the second `expect(toastCalls()).toBe(1)` after another `bed.flush()` that the row itself suggests, or record it as an accepted residual for row 36's fake-clock rule. | 20 |
| F2 | Minor | `apps/core-web/src/features/paired-devices/__tests__/pd-bed.tsx:228` (awaited from `live-paired-devices-issue.test.tsx` afterEach) | The target file is not wall-clock independent end-to-end: its `afterEach` awaits the shared `clearToasts()`, which sleeps a real 350 ms when exiting toast keys exist. | The row's "real-time waits = 0" is file-scoped and passes, but the test still consumes real time per run; the same helper is duplicated in **30** core-web files (`rg -l "getExitingKeys" | wc -l` = 30). | Register as a B10 follow-up row that converts `clearToasts` to the shared fake clock; do not fold into rows 20/21. | 20 |
| F3 | Minor | `apps/mobile/src/features/session-live/testing/monitor-harness.tsx:33-35` | `waitForSheetExit` still sleeps `SHEET_EXIT_MS + 50` real ms; it is called by `live-session-live-sites.test.tsx:179` and `session-live-screen.test.tsx:105,123` — both outside the row 16-21 file list. | Two mobile files remain wall-clock-coupled through a shared harness helper, so the mobile suite is not fully independent even after B10. | Open a follow-up row (B10 extension) converting the harness helper to a runner-clock advance, with the two caller files in scope. | 18 |
| F4 | Minor | `apps/mobile/src/src-features` → 20 files, e.g. `features/settings/live-settings-biometric.test.tsx:23` | 20 mobile test files still carry `jest.setTimeout(30_000)` (census reproducible with `grep -rnE "jest.setTimeout\(" apps/mobile/src --include="*.test.ts*"`). Several are now CPU-bounded by rows 16-18. | Out of RC-8's `20_000` scope, but the same smell one tier up and chosen pre-T1 against the old 5 s default; may be dead overhead or mask a real slow test. | Follow-up sweep that re-times each `30_000` file and removes the override where the config default 20000 has headroom. | 19 |
| F5 | Nit | `docs/2026-10-07_dems_real_capture_sealing/research/01_explore.md` §2.6 | The register lists three `chrome-lost-updates` wait sites; the file has four (`:150`, `:162`, `:181`, `:216`). Row 21 documents the miss. | Errata only; the file-level acceptance ("waits = 0") is unaffected. | Carry the erratum into row 6's register (wait-site count 4, not 3). | 21 |
| F6 | Nit | `docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md:270` (B10 "4 files") | B10's "4 files" grouping is symptom-based; row 16 changed nothing and the converted set is 11 files across 6 rows. | Row 27 and row 36 must not expect a mobile diff from B10-a, nor a 6-file diff overall. | Note in row 27's baseline and row 36's pinned-count list that B10 wave A = 11 changed test files, row 16 = 0. | 16 |

No Blocker; no Major. No finding requires a fix before row 27.

---

## 6. Residuals adjudication

| Residual | Source row (section) | Verdict | Reason |
|---|---|---|---|
| Unawaited HeroUI toast auto-dismiss real timer | 16 (`implementation/01_b10a…md` §6.1) | **accept** | No assertion reads on-screen toast presence/dismissal; DC-6 counts `toast.show` calls (`live-gap-read-only-dialog.test.tsx:113-114`). Wall-clock-inert by design. |
| Load-bearing `doNotFake: ['nextTick','queueMicrotask','setImmediate']` | 17 (§7.2), 18 (§7.1), 21 (§8.1) | **accept** | Copied from the workspace precedent (`probe-failure.test.ts:213`); required so `act` hand-overs and worklet `runOnJS` do not wait on clock advances. Fragility is the cost of the pattern; document in row 36. |
| Load-bearing `beforeAll` two-turn `setImmediate` priming | 17 (§7.3), 18 (§7.2), 21 (§8.2) | **accept** | Guards S72-12 Reanimated-registry prep before the first fake install; cheap and verified by 3/3 runs. |
| `monitor-harness.tsx:33-37` `waitForSheetExit` real sleep | 18 (§7.4) | **follow-up row** | Two files outside the row list (`live-session-live-sites`, `session-live-screen`) stay coupled; already routed as F3. |
| 20 files with `jest.setTimeout(30_000)` | 19 (§8.1) | **follow-up row** | Out of RC-8 scope; per-file timing question; routed as F4. |
| `live-settings-boundary.test.tsx` `jest.setTimeout(40_000)` removal | 17 (§7.1) / 19 (§3) | **accept** | Reverts to the identical config default 20000; measured max test 822 ms (row 19 §3) and confirmatory suite 7.566 s (§7). Not an increase, not a behaviour change. |
| Shared `clearToasts()` real 350 ms across 30 files | 20 (§7.2) | **follow-up row** | Shared bed, outside the row's file-level acceptance; routed as F2. |
| Virtual quiet window no longer fires real global timers ≤50 ms | 20 (§7.1) | **accept + optional follow-up** | Only real timer on the path is 1500 ms; routed as F1 with the row's own suggested double-assertion as the optional hardening. |
| `research/01_explore.md` §2.6 undercounts row-21 wait sites | 21 (§8.6) | **accept (errata)** | File-level criterion met; routed as F5 to row 6. |
| Fake timers fake `Date`/`performance`/`requestAnimationFrame` (not in `doNotFake`) | 17 (§7.5), 18, 21 | **accept** | All three converted files assert state/opacity/testIDs, not clock-derived values; 3/3 green. A future test asserting an rAF-driven animation under this install must re-check, and row 36 should record the exception. |

---

## 7. Confirmatory evidence (one suite, per the review budget)

Row 17's file was re-run once because it carries the most intricate change (runner fake timers + `clockFromTimers` globals bridge + `beforeAll` priming + a store-clock spinner test). Command, repository root:

```
npm run test -w @dems/mobile -- src/features/settings/live-settings-boundary --maxWorkers=2
```

Result (process exited 0; console noise omitted):

```
PASS src/features/settings/live-settings-boundary.test.tsx (7.444 s)
Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        7.566 s, estimated 12 s
```

This independently confirms row 17's "8 passed" claim under the post-row-19 blob (override removed). No other suite was run; the other rows' claims were checked against the diff and source (greps for 0 literal waits, `\bjest\.` binding trims, config equality) rather than re-run.

---

## 8. Notes for row 27 (wave-A regression) and row 36 (test strategy)

**Row 27:**
- The B10 wave-A diff is **11 changed `*.test.tsx` files**, not 6; row 16 contributes **0 files** (F6).
- All changed files are tests; no config/lockfile/package change. Expect the mobile ledger at 192 suites / 1,988 tests (row 19 full-suite result) and the core-web count unchanged at 117/1,495.
- Command forms: mobile `npm run test -w @dems/mobile -- <path> --maxWorkers=2`; core-web `npm run test -w @dems/core-web -- <path> --maxWorkers=2`. **Do not** use `--poolOptions.threads.maxThreads=2` — vitest 5.0.3 rejects it (`CACError: Unknown option`, row 20 §5); `--maxWorkers` is honoured (row 20 §5).
- Known real-time coupling that will persist in a full run: `monitor-harness.waitForSheetExit` (2 mobile files, F3) and `pd-bed.clearToasts` (core-web, F2). If the full run flakes, the lever is worker count/host load, not re-adding sleeps or raising ceilings (row 19 §8.5).

**Row 36 (test strategy):**
- Codify the fake-clock rule as: install in `beforeEach` with `jest.useFakeTimers({ doNotFake: ['nextTick','queueMicrotask','setImmediate'] })`, restore `jest.useRealTimers()` in `afterEach`, and prime Reanimated's frame-callback registry with two `setImmediate` turns in `beforeAll` **before** the first install. Record that `setTimeout` is deliberately faked and the bed's own virtual transport clock is a separate scheduler that `b.elapse`/`b.flush` drive.
- List the known wall-clock exceptions by file:line (`monitor-harness.tsx:33-37`, `pd-bed.tsx:228`) and the 20 `jest.setTimeout(30_000)` files, so later refactors do not assume whole-suite independence.
- Pin the B10 output set (11 files) in the pinned-count list, and carry the two errata (F5 wait-site count; F6 B10 file count) so the strategy's baseline matches the actual tree.
- State the vitest `--maxWorkers` correction explicitly (D8's substitute is wrong for this workspace).

---

## 9. Positive findings

- **Correct, conservative conversion.** Rows 17/18/20/21 follow one established pattern; row 16 refused a cosmetic edit ("behaviour unchanged") and instead proved the file already virtual — the right call.
- **Behaviour preservation is real**, not asserted: assertions, matchers, expected values, names and counts are unchanged (`git diff` shows only plumbing), and each mobile file restores the clock in `afterEach` (no fake-timer leak into the next test).
- **Import hygiene.** The three files that lost `jest.setTimeout` also correctly trimmed the now-unused `jest` binding (`evidence-detail`, `evidence-more-menu-title`, `devices-screen` — verified 0 `\bjest\.` refs); the files that still use `jest` kept it.
- **Scope discipline.** Production = 0, config = 0, lockfile = 0; sibling attribution in each report is accurate against the live tree.

## 10. Files reviewed

Changed test files (11): all paths in §1 rows 2-12.
Unchanged target: `apps/mobile/src/features/session-live/live-gap-read-only-dialog.test.tsx` (row 16).
Supporting sources read to validate claims: `apps/core-web/src/runtime/testing/live-harness.ts:381-453`, `apps/core-web/src/features/paired-devices/__tests__/pd-bed.tsx:221-233`, `apps/mobile/src/features/session-live/testing/live-monitor-bed.tsx:167-171,257-286`, `apps/mobile/src/features/session-live/testing/monitor-harness.tsx:31-36`, `apps/mobile/jest.config.js:1-16`.
Producing reports read in full: `implementation/01_b10a…` … `implementation/06_b10f…`.
Plan note: `masterplan/02_plan.md` does not exist in this task folder (only `masterplan/01_specs.md` and spec files), so per-row plan-table status tracking was not applicable; `status_tasks.md` and `decisions.md` are controller-owned and were not touched.
