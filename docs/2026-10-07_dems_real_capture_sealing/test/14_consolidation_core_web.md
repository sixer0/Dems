---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: test-expert
step: test-suite consolidation, owner W (apps/core-web tests and test support)
decision: D233, D238
tree: a5d75ed + the working-tree edits of this consolidation (no commit, no git write)
status: complete
---

# Test-suite consolidation: core-web (owner W)

Basis: `delegation_progress/consolidation_brief.md`, `test/13_suite_consolidation_audit.md` (sections 3c,
4, 5, 7.2), `delegation_progress/driver_rules_d94.md`. Only test files and test support of
`apps/core-web` changed. No product file changed: `diff -rq` of `apps/core-web/src` against the copy
made before the first edit shows three files only, all new test support
(`runtime/testing/fake-time.ts`, `test/real-core-bed.tsx`, `test/static-scan.ts`). No git write, no
install, no lane, no dev server, no browser. Scripts and raw reports: session scratchpad `cw14/`
(`hashes.mjs`, `merge.mjs`, `prune.mjs`, `cross.mjs`, `stats.mjs`, `before.json`, `after.json`).

## 1. Before / after

Command of both runs, the one of `test/12_precommit_wave_m.md` row 6 with its JSON reporter:
`npm run test -w @dems/core-web -- --reporter=default --reporter=json --outputFile.json=<scratchpad>/x.json`
(from the repo root, inside the sandbox; one run each).

| | files | tests | result | wall (vitest "Duration") | sum of per-file times | 1-minute load at start / end |
|---|---|---|---|---|---|---|
| run 12 (reference, `a5d75ed`) | 182 | 2224 | green | 87 s | 499 s | 1.6 to 4.7 / 16.8 |
| BEFORE (this session, 17:09) | 182 | 2224 passed, 0 failed, 0 skipped | green | 160.69 s | 956.1 s | 1.26 / 53 (it rose to 95 during the run) |
| AFTER (this session, 17:34) | 164 | 2224 passed, 0 failed, 0 skipped | green | 72.56 s | 428.0 s | 5.87 / 17.40 |

The BEFORE wall time is NOT a fair baseline: the load was 1.26 when I started it and went to 64 and
95 within two minutes (other owners' runs started beside it). Read the AFTER run against run 12:
87 s -> 72.56 s (-17 %), sum of file times 499 s -> 428 s (-14 %), at a somewhat higher starting
load than run 12 had. Typecheck (`npm run typecheck -w @dems/core-web`) exit 0, lint
(`npm run lint -w @dems/core-web`) exit 0 and silent, both after the last edit.

Slowest 10 files:

| # | BEFORE (under load) | s | tests | AFTER | s | tests |
|---|---|---|---|---|---|---|
| 1 | `features/evidence/__tests__/wave-k-w-player.test.tsx` | 40.7 | 29 | `features/evidence/__tests__/sealed-player.test.tsx` | 38.6 | 29 |
| 2 | `features/evidence/__tests__/export-job.test.tsx` | 34.0 | 22 | `test/live-session-new-local-notice.test.tsx` | 14.5 | 13 |
| 3 | `features/session-new/__tests__/wave-h-z2-countdown-sources.test.tsx` | 21.5 | 3 | `test/real-core-facts.test.tsx` | 12.4 | 84 |
| 4 | `test/live-session-new-local-notice.test.tsx` | 21.4 | 13 | `test/live-evidence-verify.test.tsx` | 11.6 | 14 |
| 5 | `test/live-devices-commands.test.tsx` | 20.4 | 17 | `test/live-evidence-export.test.tsx` | 11.0 | 10 |
| 6 | `features/security-audit/__tests__/security-audit.test.tsx` | 20.4 | 18 | `test/live-security-audit-chain.test.tsx` | 9.6 | 15 |
| 7 | `test/live-shell-admin.test.tsx` | 18.8 | 40 | `test/live-security-audit-export.test.tsx` | 9.0 | 10 |
| 8 | `test/live-users-roles-commands.test.tsx` | 17.3 | 19 | `test/live-shell-notices.test.tsx` | 8.6 | 22 |
| 9 | `test/live-login-signin.test.tsx` | 16.1 | 17 | `test/live-shell-admin.test.tsx` | 8.0 | 40 |
| 10 | `test/live-security-audit-export.test.tsx` | 15.8 | 10 | `test/live-session-new-create.test.tsx` | 7.5 | 16 |

Files measured alone (not under the whole run): `export-job.test.tsx` 27.3 s (run 12) -> about 5 s;
`countdown-sources.test.tsx` 20.5 s (run 12) -> about 5 s (3 s of it is the one real-clock control);
`live-session-new-local-notice.test.tsx` 17.7 s (run 12) -> 14.4 s.

### The test count delta: 0, to the single test

2224 -> 2224. Nothing was added, nothing deleted, nothing parametrised away.

- Run-time leaf titles of the two JSON reports compared as multisets: 2224 before, 2224 after, 0 lost,
  0 gained; every test `passed` in both.
- Static call sites (`hashes.mjs`, the audit's `collect.mjs` normalisation): 2006 before, 2006 after.
  The normalised body hash of 1986 is unchanged and found again; 20 changed, exactly the bodies
  edited on purpose under W1 (17 in `export-job.test.tsx`, 2 in the countdown file, 1 in
  `live-session-new-local-notice.test.tsx`). The W4 edits change 10 further bodies (section 4).
- 30 files left, 12 files are new, 12 existing homes grew by exactly what moved in (table of
  section 3: the "tests" column sums to 299 = the 30 files of the audit's section 3c).

## 2. W1: real waits -> the page's fake clock

New test support `apps/core-web/src/runtime/testing/fake-time.ts` (beside the live harness):

| helper | what it is |
|---|---|
| `pageTimersFake()` / `pageTimersReal()` | `setTimeout` and `setInterval` of the page fake from here on (the workspace's mechanism: `vi.useFakeTimers`, as 11 web files already use) / back |
| `pass(ms)` | moves the fake clock in 50 ms slices, each in its own `act` |
| `until(check, { stepMs, rounds })` | what `waitFor` is on the real clock; each round runs the due timers, the promise jobs and one turn of the real event loop, and it settles twice after `check` passed, as `waitFor` does |

Three facts found while building it; each one would have made a converted test prove nothing:

1. **One `act` over a whole span runs only the first timer of a chain.** The 3-2-1 countdown arms its
   next step from an effect, and React renders when the `act` ends. `pass` therefore slices. The same
   holds on the REAL clock: the old countdown test waited with `act(async () => sleep(3500))`, so its
   "past the whole countdown" was one step, and its `starts()` assertions were never reached by a
   missing gate (it caught the mutation below through "the countdown is over" only).
2. **`waitFor` / `findBy` hang on a fake clock** (the testing library ends them with its own
   `setTimeout(resolve, 0)`). Hence `until`.
3. **The observers' zero timer** (`@tanstack/query-core` `notifyManager`: `setTimeout(callback, 0)`,
   the cause of the mobile flake of note 150) gets a due time 1 ms later when it is armed while the
   fake clock is being moved. `until` moves at least `ZERO_TIMER_MS` = 1 per round, so no web test
   has to wait for "the observers were told" itself. No web test carried an `observersTold`-style wait
   (`grep -rn observersTold apps/core-web/src`: no hit; the test of note 150 is the mobile one and is
   the mobile owner's); the helper is the shared bed helper the brief asked for.

No timeout was raised anywhere. `configure({ asyncUtilTimeout })` / `vi.setConfig({ testTimeout })` of
the three files are as they were.

| file | before | now | kept on the system clock, and why |
|---|---|---|---|
| `features/session-new/__tests__/countdown-sources.test.tsx` (was `wave-h-z2-countdown-sources`, 3 tests) | `wait(COUNTDOWN_MS + 500)` x 3, `wait(COUNTDOWN_STEP_MS)` x 2 | cases 1 and 2 on the fake clock. Added assertions: the countdown is over as soon as the knowledge is lost (no time has to pass); after the new press no start before the countdown's end, then exactly one, and still one a countdown later | "CONTROL - nothing is lost": the ONE real 3-2-1 (audit W1) |
| `features/evidence/__tests__/export-job.test.tsx` (22 tests) | the 2 s poll waited for; `setTimeout` `EXPORT_JOB_POLL_MS + 400` x 3 and 600 ms x 3 | fake from the submit on (`exportSealed`): the poll timer is armed on the fake clock; `POLLS` is the same span in 100 ms fake steps. Added assertion in "never backwards": the answer that says 20 is in the cache before the bar is read | the wizard walk before the submit (real `findBy`, no wait of the product) |
| `test/live-session-new-local-notice.test.tsx` (13 tests, PROTECTED) | 3,600 ms x 2, `quiet()` 400 ms x 17 | case "(a) with the 3-2-1 countdown on": fake before the press, so a countdown the press armed would run through | case "(c) a reload on the ready step": what a mount starts by itself is armed during the mount, which needs the real timers; a fake clock from there on would not hold it. `quiet()` (the page's own 300 ms beat + 100) left as it is: 17 sites in a protected file for about 7 s |
| `features/evidence/__tests__/sealed-player.test.tsx` (the stall watch) | real | real (audit W2, PROTECTED) | all of it |

Mutation proofs (the product file is copied, mutated, the test run, the copy put back and compared
with `cmp` against the copy made before the work; each printed `RESTORED-IDENTICAL`):

| mutation | file | result on the converted tests |
|---|---|---|
| the "sources known" gate removed, both layers (`index.tsx:206` and the last-tick defence `:428`) | `features/session-new/index.tsx` | countdown cases 1 and 2 RED (`expected <div class="sn-countdown"> to be null`), control green |
| the render gate only removed | the same | cases 1 and 2 RED |
| the same mutation against the ORIGINAL real-clock file (a temporary copy, removed) | the same | cases 1 and 2 RED by the same assertion: same strength, 20 s instead of 5 |
| the poll never stops (`refetchInterval: () => pollMs`) | `features/evidence/export-job.ts:73` | 3 RED: "Running ... never backwards", "COMPOSITE_ENCODER_NOT_SELECTED ... reading stops", "404 ... reads once" |
| the bar follows the last answer (`shownPct: job.progressPct`) | `features/evidence/export-job.ts:81` | "never backwards" RED (`40% done` expected, `20% done` drawn). My first conversion stayed GREEN here while the original went red: it read the bar before the observers were told. That is finding 3 above; fixed in the helper, proven by this row |
| the countdown starts beside the START notice (`onStart` calls `start()` without the Confirm) | `features/session-new/index.tsx:535` | "(a) with the 3-2-1 countdown on" RED (`expected 1 to be +0`), and "(a) nothing is sent until Confirm", "(b)" RED |

Not mutated: the "EXACTLY once under StrictMode" cases of G94c-02 (they pass on the fake clock; the
`deferEffectStart` timer is a `setTimeout(start, 0)` that `pass(600)` runs).

## 3. Merges (W2, W3): 30 per-wave files -> 0

Rule followed: a move only. Each moved file's module-level content sits in ONE `describe` at the end
of its home, so its helpers, hooks and constants keep their scope and no helper is duplicated; the
block starts with `vi.resetConfig()` followed by the file's own `vi.setConfig`, and its
`configure({ asyncUtilTimeout })` runs in `beforeAll` of the block (1,000, the library's default, where
the file had none) and is put back in `afterAll`: no test got a longer timeout than it had. Where a
home had top-level hooks, its own content was put in a `describe` too, so its hooks do not reach the
moved blocks; that adds one title level to the home's tests and changes no body. Finding ids are in
the block titles and in every test title as before; no block title carries a wave / pass / fix prefix.

| from (removed) | tests | to | kind |
|---|---|---|---|
| `features/evidence/__tests__/wave-k-w-player.test.tsx` | 29 | `features/evidence/__tests__/sealed-player.test.tsx` | the file itself under a feature name, byte-identical (`cmp`); PROTECTED: every stall-watch / tamper-stop case, on the real clock |
| `features/evidence/__tests__/wave-h-c2-media.test.tsx` | 21 | `features/evidence/__tests__/item-facts.test.tsx` (new home) | block; holds the contract's examples of operation 40 fed unmodified (PROTECTED, case for case) |
| `features/evidence/__tests__/wave-h-c2-integrity.test.tsx` | 6 | `item-facts.test.tsx` | block |
| `features/evidence/__tests__/copy-round-metadata-media.test.tsx` | 3 | `item-facts.test.tsx` | block |
| `features/evidence/__tests__/wave-h-c2-export-playback.test.tsx` | 8 | `features/evidence/__tests__/item-exports.test.tsx` (new home) | block |
| `features/evidence/__tests__/wave-k-z2-export.test.tsx` | 4 | `item-exports.test.tsx` | block |
| `features/evidence/__tests__/wave-h-c2-transcript.test.tsx` | 7 | `features/evidence/__tests__/transcript.test.tsx` (13 -> 20) | block; home wrapped |
| `features/evidence/__tests__/wave-k-w-evidence.test.tsx` | 12 | `features/evidence/__tests__/item-v2.test.tsx` (8 -> 20) | block |
| `features/devices/__tests__/wave-i-b-connect-wording.test.tsx` | 7 | `features/devices/__tests__/camera-connect.test.tsx` (11 -> 18) | block |
| `features/devices/__tests__/wave-h-z2-audio-card-lines.test.tsx` | 3 | `features/devices/__tests__/selector-microphones.test.tsx` (9 -> 14) | block; home wrapped |
| `features/devices/__tests__/devices-gate70-minors.test.tsx` | 2 | `selector-microphones.test.tsx` | block |
| `features/devices/__tests__/wave-i-b-source-state.test.tsx` | 11 | `features/devices/__tests__/source-state.test.tsx` | the file itself under the name of its module (`source-state.ts`), unchanged |
| `features/devices/__tests__/copy-round-health-caption.test.tsx` | 3 | `features/devices/__tests__/health-caption.test.tsx` | the file itself, unchanged |
| `features/session-monitor/__tests__/wave-i-b-seal-blocked.test.tsx` | 12 | `features/session-monitor/__tests__/sealing-progress.test.tsx` (15 -> 27) | block; home wrapped |
| `features/session-monitor/__tests__/wave-h-z2-own-capture.test.tsx` | 10 | `features/session-monitor/__tests__/integrity-facts.test.tsx` (3 -> 13) | block; home wrapped |
| `features/session-new/__tests__/wave-h-z2-countdown-sources.test.tsx` | 3 | `features/session-new/__tests__/countdown-sources.test.tsx` | the file itself (with the W1 edit) |
| `features/session-new/__tests__/copy-round-live-words.test.tsx` | 8 | `features/session-new/__tests__/live-words.test.tsx` | the file itself, unchanged |
| `features/session-new/__tests__/wave-h-z2-precheck-note.test.tsx` | 3 | `features/session-new/__tests__/precheck-unreachable.test.tsx` (2 -> 5) | block; home wrapped |
| `features/dashboard/__tests__/wave-h-z2-failed-start-event.test.tsx` | 2 | `features/dashboard/__tests__/dashboard-model.test.tsx` (15 -> 17) | block; home wrapped |
| `features/security-audit/__tests__/copy-round-reason-note.test.ts` | 2 | `features/security-audit/__tests__/security-audit.test.tsx` (18 -> 20) | block; home wrapped |
| `test/wave-i-b-header-critical.test.ts` | 7 | `test/integrity-checks.test.ts` (7 -> 14) | block |
| `test/live-row87-verify-v2.test.tsx` | 2 | `test/live-evidence-verify.test.tsx` (12 -> 14) | block; home wrapped; PROTECTED (verify), case for case |
| `test/wave-i-b-own-core-facts.test.tsx` | 14 | `test/real-core-facts.test.tsx` (new home, ONE file, PROTECTED) | block |
| `test/pass-j.test.tsx` | 17 | `test/real-core-facts.test.tsx` | block |
| `test/wave-k-w-real-core.test.tsx` | 26 | `test/real-core-facts.test.tsx` | block |
| `test/wave-l-w-real-core.test.tsx` | 44 | 27 -> `test/real-core-facts.test.tsx`; 17 -> `features/session-monitor/__tests__/unsealable-notice.test.tsx` (2 -> 19; home wrapped) | split by `describe`: "G75d-01 / G75d-03" (open notice), "G75d-02" (retry of a blocked seal), "G75d-04" (unsealable end) are beside the Monitor's tests; the rest is with the facts |
| `test/wave-l-z-selector-in-force.test.tsx` | 24 | `test/selector-in-force.test.tsx` | the file itself (one comment names the new home of "G75d-02") |
| `test/fxr-w-dev-console-logging.test.tsx` | 5 | `test/dev-console-logging.test.tsx` | the file itself, unchanged |
| `test/fxr-w-nits.test.tsx` | 2 | `test/api-reference-static.test.tsx` | the file itself, unchanged |
| `test/live-fxr-w-evidence-media-signout.test.tsx` | 2 | `test/live-evidence-media-signout.test.tsx` | the file itself, unchanged |
| **30 files** | **299** | | files 182 -> 164 |

`real-core-facts.test.tsx` holds 84 tests = 14 + 17 + 26 + 27; `unsealable-notice.test.tsx` 19 = 2 + 17.

Points a reader should know:

- **Homes differ from the audit's section 3c table in places.** That table pairs by the most specific
  shared import and says itself that 16 files need the owner's reading. Where its home was another
  per-fix file or had nothing to do with the subject (`pass-j` -> `live-storage-policy`, the real-core
  files -> `security-audit` / `live-dashboard-page`, `wave-h-c2-media` -> `cf-web-custody-media`), I
  took the subject's feature-named file, or made the per-wave file the home under a feature name
  (the audit's W2 pattern). The task's own examples decided three: ONE sealed-player file, ONE
  real-core facts file, seal-blocked / open-notice beside the Monitor's tests.
- **The split of `wave-l-w-real-core` needed its page harness in one place.** It is now
  `test/real-core-bed.tsx` (moved text, exported; `useRealCorePages()` registers the same four
  hooks for the block that calls it). Before the split the file was run on the bed alone: 44 passed,
  44 body hashes unchanged. Both halves import the bed; no helper exists twice. The other three
  real-core blocks keep their own harness inside their block, as their files had it.
- **One environment change.** `wave-l-w-real-core` carried
  `@vitest-environment-options { "url": "http://127.0.0.1:5178/" }`; its two homes do not. Evidence
  that it was incidental: the file names no `location` / `origin` (`grep`), it mounts simulators on a
  memory history and not the live bed, and a temporary copy without the pragma ran 44 of 44 green
  before the move. Every other merge is between files of the same environment (the script refuses a
  difference).
- **Unused imports after the split** were removed from the two homes by `prune.mjs` and two leftover
  helper blocks by hand (`retrying` / `blocked` from the facts half; `t` / `SEALED` from the notice
  half): `noUnusedLocals` is on. No assertion is involved.

## 4. W4: list pins -> the scan-coverage rule

New test support `apps/core-web/src/test/static-scan.ts`: `expectScanCovers({ scanned, listed, root })` -
THE SCAN EQUALS AN INDEPENDENT LISTING OF THE FOLDER, AND IS NOT EMPTY. The independent listing is
Vite's (`import.meta.glob` of the folder in the calling test), not the test's own directory walk.

Ten tests kept their titles and place; their body was "these named files are among the scanned ones,
and there are at least N" and is now the rule:

| test | folder | the list it held |
|---|---|---|
| `test/live-dashboard-page.test.tsx` "reads the files it means to read" | `features/dashboard` | 6 names, at least 19 |
| `test/live-evidence-archive.test.tsx` same title | `features/evidence` | 7 names, at least 30 |
| `test/live-security-audit-page.test.tsx` same title | `features/security-audit` | 7 names, at least 24 |
| `test/live-network-time-page.test.tsx` same title | `features/network-time` | 5 names, at least 15 |
| `test/live-storage-page.test.tsx` same title | `features/storage` | 6 names, at least 21 |
| `test/live-system-settings.test.tsx` same title | `features/system` | 9 names, at least 19 |
| `test/live-login-model.test.tsx` same title | `features/login` (flat) | 5 names, at least 16 |
| `test/live-users-roles-model.test.tsx` "reads the folder" | `features/users-roles` | 9 names |
| `test/live-shell-admin.test.tsx` "reads the shell's production files" | `components/shell` (flat) | 5 names |
| `test/live-runtime-static.test.tsx` "reads the console's sources and tells production files from tests" | the whole `src` | 6 names, more than 150; the "no test file among them" and the import-parser assertions of the same test are unchanged |

All ten green on the first run of the rule, so every scan already read exactly its folder. Mutation
(once): the walk of `live-dashboard-page.test.tsx` narrowed from `.tsx?` to `.tsx` -> RED, "the scan
of ../features/dashboard differs from the folder: expected [ …(14) ] to deeply equal [ …(18) ]";
restored from a copy, 11 of 11 green.

Kept as they are, on purpose: every rule of the form "no file does X" (the seven "MD-6, TS-15"
blocks, "AC-C-53", the console rules), the allow-lists of importers, "no page prints a simulator
constant" in `real-core-facts.test.tsx` and `selector-in-force.test.tsx`, the media-session and token
canaries (`media-session-canary.test.tsx`, `media-token-blanking.test.ts`,
`camera-connect-canary.test.tsx`, the CANARY of `export-job.test.tsx`).

No i18n list pin or "exactly these sentences" pin that went red as stale exists in core-web: the
audit's section 4.2 lists no web red of that kind in runs 06 to 12 (the 39 web reds of run 05 were
the fake transport's contract check, which is protected), and a title search for "exactly", "these
files", "only these", "pinned", "the list of" found behaviour tests only.

## 5. `shell-motion.test.tsx` and the working directory

It read `${process.cwd()}/src/components/shell/shell.css`. It now takes the path from its own
location (`import.meta.url`). Evidence: the file as it was, started from the repo root
(`npx vitest run --root apps/core-web …`): `ENOENT … /Users/…/DEMS/src/components/shell/shell.css`,
"no tests"; the file now: 30 passed from the repo root, 30 from the package (`npm run test -w`), 30
from `docs/`.

## 6. Cross-workspace title clusters (web + mobile): nothing deleted

`cross.mjs` over the trees as they are now (the mobile owner is merging in parallel, so the count
moves): 51 leaf-title clusters (30+ characters) with one web and one or more mobile tests; the audit
counted 69 on `a5d75ed` from run-time titles. Of the 51 web tests, 37 render nothing - and every one
of those calls the WEB's own module (`../verify-v2`, `../sealing-progress`, `../item-v2`,
`../sealed-playback`, `../export-job-model`, `@/lib/capture-notices`, `@/runtime/error-sink`, …).
The two clients implement these readers separately; the same title is the same requirement on two
implementations.

**Web tests of a cluster that assert only a shared sentence which a shared-package test already
asserts: 0.** No candidate for a ruling comes out of the clusters.

Outside the clusters, four web tests assert only members of the shared `en` tree (no render, no web
module). For each sentence I searched `packages/shared/test` for the literal: none is asserted there,
so none has a covering shared test and none is deletable; they are listed for a later ruling on
WHERE such a sentence pin should live:

| web test | sentences | covering shared test |
|---|---|---|
| `features/devices/__tests__/health-caption.test.tsx:64` "says the line is derived from the Core's data, names no device or browser, and nothing about a simulation" | "Derived from the Core's data · last {{count}} samples" and 2 more | none |
| `test/live-login-model.test.tsx:195` "WS-7: the trust line and its tooltip …" | "Core server on this computer • web console, no pairing required" and 2 more | none |
| `test/live-login-model.test.tsx:202` "WS-9 C1, WS-14, §6.4: the plain sentence, the 8-hour sentence, the disabled account" | "Your session reached its 8-hour limit. Sign in again." and 2 more | none |
| `test/live-shell-indicator.test.tsx:169` "the words are the specification's" | "LIVE · OFFLINE", "LIVE · RECONNECTING" and 2 more | none |

## 7. Tests deleted

None. The brief allows a delete only for what section 7 lists as deletable with a covering test and a
mutation proof; for core-web that is the W4 collapse (below), which I did not do.

## 8. Not done from the audit's table, and why

| row | what | why |
|---|---|---|
| W4, second half | collapse the seven "MD-6, TS-15" copies and the per-page scan tests into one rule file (26 -> about 9 tests) | it is a DELETE of 17 tests. The brief's rule 6 keeps a "no file does X" rule as it is; each copy asserts on a different folder; none was ever stale-red; and the proof the audit asks (the new rule covers at least the folders of the seven blocks, compared as path sets) is a piece of work of its own. Left for a ruling. The estimate "2,224 -> about 2,207" of the audit's section 8 therefore did not happen: 2,224 stays |
| W1, rest | `quiet()` and case "(c)" of `live-session-new-local-notice.test.tsx` | protected file; section 2 says why each stays |
| W2 | the stall watch on the real clock | kept on purpose (38.6 s, the slowest file by far). An injectable clock for the player's 4 s stall watch would be a PRODUCT change; not asked, not done |
| W5 | the six `live-X` / `X` pairs, the LB-10 cases per page | KEEP in the audit; kept |
| W6 | one `testQueryClient()` for the 76 constructions without `gcTime` | optional in the audit, "do only if a leak is shown"; vitest shows none |
| - | other files with a fix-round name the audit classes as feature-named (`efix-integrity-metadata`, `cf-web-custody-media`, `live-efix-evidence`, `live-cf-web-media`, `live-d2-client-seams`, `live-w0-*`, `live-gap-indicator-connecting`, `visual-audit-45b`, `session-start-d7`) | not in the audit's 30; not touched |

## 9. Needs a product change

Nothing was blocked by one. Two things would need one if they are wanted: a clock the sealed
player's stall watch can be given (W2: the 38.6 s file), and nothing else.

## 10. For the controller

- The same `act` weakness as finding 1 of section 2 may sit in other suites: a test that sleeps
  inside ONE `act(async …)` across a chain of timers checks less than its comment says. In core-web
  the old countdown file was the one I met; I did not search the other workspaces.
- `packages/shared/test/fxr-w-nits.test.ts` is named in a comment of
  `test/api-reference-static.test.tsx:4`; if the shared owner renames it, that comment is stale
  (wording only).
- Files in `git status` under `apps/core-web`: 30 deleted, 26 modified, 15 new (12 test files, 3
  test support). Nothing outside `apps/core-web` and this note was written by me.

---
*Generated: 2026-10-11 17:40 WIB*
