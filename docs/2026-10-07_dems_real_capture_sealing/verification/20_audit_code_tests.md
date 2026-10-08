---
task_id: 2026-10-07_dems_real_capture_sealing
row: AU-1 (independent audit of blueprint rev-1 rows 16-27, code and test changes)
date: 2026-10-08
agent: verifier (Claude Code)
narrative_tier: 2
target: /Users/gsp-budi/Documents/DEMS working tree vs HEAD 2a4f4ea (git diff + untracked)
status: needs-review
---

# AU-1: Independent audit of the task-3 code and test changes (rows 16-27)

## 0. Verdict

The change set is narrow and honest. One production file changed (`apps/mobile/src/runtime/recording-elapsed.ts`). No existing assertion was removed, loosened or re-valued. No test was skipped and no timeout was raised. All five workspaces reproduce the claimed counts exactly, and RC-1 RED/GREEN reproduces independently. The four D256 tests passed 3/3 alone and inside their full workspace runs.

Three Major findings stand. None of them is a regression introduced by the diff:

- **AU1-1:** Row 20 converted the file's only `setTimeout` sleep. It did not touch the mechanism behind the recorded D256 failure at `live-paired-devices-issue.test.tsx:132`: a real 40 ms `setInterval` scramble whose first frame already equals the final code.
- **AU1-2:** RC-1's step back is moved, not removed. The hub row draws the held value until SEALED and then drops by the overshoot (probe: 1129 to 1122). The row-26 follow-up for this is not scheduled in the rev-2 plan.
- **AU1-3:** The B2 audit gate ("high <= 53", claimed 49) does not reproduce today. The result is 98 high (95 with `--omit=dev`) on the same lockfile with the same two root advisories. This is registry propagation drift, not a tree change.

Findings: 0 Blocker, 3 Major, 1 Minor, 2 Nit. Row verdicts: 8 CONFIRMED, 4 PARTLY, 0 NOT CONFIRMED (section 6).

## 1. Scope and method

- Every hunk of `git diff` under `apps/`, plus the untracked test file, `package.json` and `package-lock.json`, was read in full.
- The reference documents were read: the rev-1 rows (`git show 2a4f4ea:.../identification/02_structured.md:196-207`), `implementation/05` and `07` in full, the key sections of `implementation/08`, `gateway_check/02` and `03`, `test/01`, D10-D15, and predecessor D232/D233/D236/D246/D247/D255/D256.
- The suites were re-run per workspace with `--maxWorkers=2`. `uptime` was checked before each run; the highest 1-minute load seen was 8.55, below the pause threshold of 14.
- RC-1 RED was produced in a scratch worktree, `git worktree add --detach $TMPDIR/au1 HEAD`. It held the current test files plus the 2a4f4ea `recording-elapsed.ts`, with `node_modules` symlinked. The worktree was removed afterwards (`git worktree remove --force`, exit 0; symlinks unlinked first). Two probes and one mutation ran only in that worktree.
- No tracked file in the repository was modified. `git status --short -- apps packages scripts package.json package-lock.json` is identical before and after: 15 modified paths and 1 untracked path.

## 2. Diff audit (check 1)

### 2.1 Production files

```
$ git diff --name-only -- apps packages scripts | grep -v '\.test\.'
apps/mobile/src/runtime/recording-elapsed.ts
$ git status --short --untracked-files=all -- apps packages scripts   (13 M test/prod files + 1 ??)
?? apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx
$ git diff --stat -- apps packages scripts | tail -1
 13 files changed, 169 insertions(+), 43 deletions(-)
```

Result: `recording-elapsed.ts` is the only production file changed. `packages/` and `scripts/` have no diff. The mobile jest config was not changed: `apps/mobile/jest.config.js:10 testTimeout: 20000`, `:12 maxWorkers: '50%'`, and `git diff --stat 2a4f4ea -- apps/mobile/jest.config.js` is empty.

### 2.2 Assertion census, HEAD vs working tree

The counts come from `git show 2a4f4ea:<file>` against the working file, counting `expect(` occurrences, `it(`/`test(` lines, and `.skip/.only/.todo/xit` markers.

| File | expect before | expect after | it before | it after | skip before/after |
|---|---|---|---|---|---|
| core-web `src/test/live-paired-devices-issue.test.tsx` | 131 | 131 | 20 | 20 | 0/0 |
| mobile `devices/devices-screen.test.tsx` | 90 | 90 | 11 | 11 | 0/0 |
| mobile `evidence/evidence-detail.test.tsx` | 42 | 42 | 7 | 7 | 0/0 |
| mobile `evidence/evidence-more-menu-title.test.tsx` | 12 | 12 | 3 | 3 | 0/0 |
| mobile `evidence/play-sheet.test.tsx` | 27 | 27 | 5 | 5 | 0/0 |
| mobile `more/more-live.test.tsx` | 24 | 24 | 5 | 5 | 0/0 |
| mobile `session-live/elapsed-ticker.test.ts` | 13 | 23 | 4 | 6 | 0/0 |
| mobile `session-live/live-session-live-link.test.tsx` | 78 | 78 | 14 | 14 | 0/0 |
| mobile `session-new/live-session-new-followups.test.tsx` | 59 | 59 | 8 | 8 | 0/0 |
| mobile `settings/live-settings-boundary.test.tsx` | 61 | 61 | 8 | 8 | 0/0 |
| mobile `storage/storage-screen.test.tsx` | 68 | 68 | 7 | 7 | 0/0 |
| mobile `navigation/__tests__/chrome-lost-updates.test.tsx` | 38 | 38 | 4 | 4 | 0/0 |
| NEW `session-live/live-rc1-elapsed-stop-hold.test.tsx` | — | 26 | — | 4 | 0 |

`git diff -U0 -- apps` was filtered for changed lines that contain `expect|toBe|toEqual|toHave|timeout|_000`. The only removed lines of that kind are 6 `jest.setTimeout(...)` calls (five of 20_000 and one of 40_000 in `live-settings-boundary`), 2 `LOAD_TOLERANT_TIMEOUT_MS = 20_000` constants with their 2 per-test uses, the `jest` import trims, and the 5 real sleeps. **0 existing `expect` lines were removed or edited**, 0 expected values changed, 0 skips, and 0 timeouts raised; `live-settings-boundary` went from 40 s down to the 20 s default.

### 2.3 Real-wait census (rows 16-18, 20, 21)

The grep was `setTimeout\(|setInterval\(|new Promise|sleep|waitFor\(|Date\.now|performance\.now|setImmediate`.

- **`live-gap-read-only-dialog` (row 16):** 0 hits and no diff (`git diff --stat` is empty). This matches D10(e), "no change required".
- **`live-settings-boundary` (row 17):**
  - The only hits are `Date.now()` at `:105` and `:255`. Both are faked by `jest.useFakeTimers` at `:236`, which fakes `Date` because the `doNotFake` list holds only nextTick, queueMicrotask and setImmediate.
  - `promisify(setImmediate)` at `:220` is a turn hand-over, not a duration.
  - `until()` (`:164-170`) is now bounded in virtual time, 8 s in 50 ms virtual steps, so it is deterministic.
- **`live-session-live-link` (row 18):** the only hits are the setImmediate priming at `:26` and the fake-timer install at `:43`. `waitA11yTick` now uses `jest.advanceTimersByTime(1_100)`.
- **`live-paired-devices-issue` (row 20):** the 50 ms sleep is now `bed.elapse(50, 50)`. 25 RTL `waitFor` sites still poll in real time; `implementation/05` §7.4 already discloses this. The file also depends on a real `setInterval` in production code, which is finding AU1-1.
- **`chrome-lost-updates` (row 21):** the only hits are the priming at `:139` and the install at `:149`. All 4 `wait(MOTION_OVER_MS)` sites advance the fake clock.

### 2.4 Mutation check: the converted tests still guard behaviour

This ran in the scratch worktree only. In `apps/mobile/src/navigation/app-tabs.tsx:123`, the veil-removal timer callback was changed to the no-op `setVeil((current) => current)`.

```
✕ Sessions -> a session detail -> Evidence: ... the pill on Evidence, the Evidence screen visible
✕ full motion keeps M-MB-01 and M-APP-04: ... React removes them after their budgets
✓ reduced motion (the testers' motion=off): right at once, no overlay is ever drawn
✕ Evidence detail -> rail Devices: ...
Tests:       3 failed, 1 passed, 4 total      (2 runs, same result; file restored, diff --stat empty)
```

The converted `chrome-lost-updates` kills the mutant. Under reduced motion no veil is drawn, so that test correctly stays green.

### 2.5 RC-8 residuals (row 19)

`grep -rnE "jest\.setTimeout\(|\}, *[0-9_]{4,}\)|LOAD_TOLERANT" apps/mobile/src --include='*.test.ts*'` finds 0 remaining 20 s overrides. What remains is 20 files with `jest.setTimeout(30_000)`, `login.test.tsx:169` at 30_000 and `devices-states.test.tsx:117` at 15_000. These are outside RC-8 and are already routed by row-25 F4 to M9-W3 (`masterplan/02_plan.md:450`).

## 3. RC-1 (check 2)

### 3.1 Code read (`apps/mobile/src/runtime/recording-elapsed.ts`)

- **`:76, :81, :95, :107` (`stopped` flag):** a frozen ticker never reads the clock and never re-arms.
- **`:117-124` (`freeze()`):** idempotent; clears the armed handle.
- **`:129, :136`:** the cache entry now records `sessionId`.
- **`:149-155` (`heldAfterStop`):** returns the frozen ticker only for the same `sessionId`, otherwise null, so a new session never inherits it.
- **`:171-174`:** when the session is not RECORDING the hook uses `heldAfterStop`.
- **Forward-only rule (DEC-FXR-M-2/D236/D246) during recording, unchanged:**
  - `:86` `Math.max(seconds, elapsedSecondsAt(...))`
  - `:182` `Math.max(fromStore, ticked)`
  - `use-sessions-data.ts:141` and `use-home-data.ts:99` also take the max.
- **Pinned by tests:** `elapsed-ticker.test.ts` "never steps back when the clock reads earlier" stays green.
- **Protected file:** `git diff --stat -- apps/mobile/src/features/session-live/use-monitor.ts` is empty.

### 3.2 RED, pre-fix code (worktree with `recording-elapsed.ts` = 2a4f4ea, current tests)

```
✓ a subscriber hears each new second; with every tick 700 ms late ...
✓ a Core clock that jumps forward right after a tick is drawn within 250 ms ...
✓ never steps back when the clock reads earlier, and stops its timer when the last subscriber leaves
✕ RC-1: freeze() stops the advancement at the last drawn second and drops the armed timer      (TypeError: ticker.freeze is not a function)
✕ RC-1: freeze() is idempotent, and a subscribe after a freeze keeps drawing the frozen second  (TypeError)
✓ W93-12 (FXR-M): a tick that throws once is logged and the ticker keeps running ...
✕ stop learned 7 s late while the ticker was 7 s ahead of the held store clock: the drawn duration keeps the larger value
✕ the held value freezes at the stop: further Core-clock time does NOT push the duration past the stop
✓ SIMULATED (no Core clock): the hub draws the store value only, and it freezes at `stoppedAt` ...
✕ session boundary: a NEW session after a stop does not inherit the held second, it counts from its own start
    Expected: >= 1129
    Received:    1122        (at live-rc1-elapsed-stop-hold.test.tsx:114, :130, :180)
Tests:       5 failed, 5 passed, 10 total
```

### 3.3 GREEN

The same worktree with the current `recording-elapsed.ts` copied in gives `Tests: 10 passed, 10 total`. The main tree, in the full mobile run, shows `PASS src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx` and `PASS src/features/session-live/elapsed-ticker.test.ts`. Alone, the new file passed 3/3 (`Tests: 4 passed, 4 total`, 0.93-0.96 s).

### 3.4 Probe: what the hub row draws through SEALED (finding AU1-2)

The scratch test used the same set-up as the new test (ticker 7 s ahead, late stop). It drew `useSessionRow(id)` and showed the row's `durationMs`, or the live value while that is null. Store time then advanced 12 × 1 s:

```
AU1-SEQ RECORDING|1129 -> FINALIZING|1129 -> ... (8 frames) ... FINALIZING|1129 -> SEALED|1122 -> SEALED|1122 ...
```

The hold works through STOPPING/FINALIZING. At SEALED the active row is gone (`sessions-model.ts:112-113` "SEALED: already a history row" returns null). The history row then draws `entry.durationMs` (`sessions-model.ts:74`), and the drawn duration steps back by 7 s, the overshoot δ. This is the same symptom as RC-1, moved from stop time to seal time. D255 ruled "keep the larger of drawn and stored value **per session**", and the history row of the same session does not keep it. Row 26 found this too (`gateway_check/03_rc1_review.md:47, :61, :98`, F4/R1 "Needs-follow-up"), and `implementation/07:227` records the follow-up "hub row: no step-back across the SEALED→history swap". However, `grep -nE "step-back across|SEALED.?(→|->).?history" identification/02_structured.md masterplan/02_plan.md` returns 0 hits. The follow-up is therefore not scheduled in rev 2: the plan rows `masterplan/02_plan.md:446` (A4 device check) and `:452` (F1-F4 text) do not carry it.

## 4. B2 dependency refresh (check 3)

### 4.1 Manifest and lockfile

```
package.json  overrides: + "@scalar/json-magic": { "undici": "7.29.1" }     (existing 5 overrides unchanged)
package-lock.json  node_modules/@scalar/json-magic/node_modules/undici  7.29.0 -> 7.29.1 (version, resolved, integrity)
$ diff <(2a4f4ea lock: .packages key@version, 1908 entries) <(working lock, 1908 entries)
468c468
< node_modules/@scalar/json-magic/node_modules/undici@7.29.0
> node_modules/@scalar/json-magic/node_modules/undici@7.29.1
non-packages section identical;  hasInstallScript count 17 -> 17;  no workspace package.json changed
```

Result: exactly one lockfile entry moved. There are no unintended dependency changes and no new install scripts.

### 4.2 `npm ls undici --all`

```
+-- @dems/core-web@0.1.0 -> ./apps/core-web
| `-- jsdom@30.1.1
|   `-- undici@8.11.2
`-- @dems/shared@0.1.0 -> ./packages/shared
  `-- @scalar/openapi-parser@0.29.9
    `-- @scalar/json-magic@0.15.3
      `-- undici@7.29.1 overridden
on disk: node_modules/undici 8.11.2; node_modules/@scalar/json-magic/node_modules/undici 7.29.1
```

Every copy of undici is at 7.29.1 or newer, and jsdom's 8.11.2 was not downgraded.

### 4.3 `npm audit` (2026-10-08 ~05:19 WIB, registry.npmjs.org)

| View | Command | Today | Claimed (row 23 / row 27) |
|---|---|---|---|
| full, installed | `npm audit --json \| jq .metadata.vulnerabilities` | `{"low":7,"moderate":18,"high":98,"critical":0,"total":123}` | 49 / 53 |
| omit-dev, installed | `npm audit --omit=dev --json` | `{"low":7,"moderate":14,"high":95,"critical":0,"total":116}` | 46 / 46 |
| lock only | `npm audit --package-lock-only --json` | high 98, total 123 | 49 |
| lock only, omit-dev | `npm audit --package-lock-only --omit=dev --json` | high 95, total 116 | 46 |

Attribution of the difference:

- `package-lock.json` mtime is `Oct 7 18:09:25`. Row 23's stored after-audit, `/tmp/dems_audit_after.json`, was written at `Oct 7 18:10:15`, so both audits ran against the same lockfile.
- The root advisory set is identical then and now: high `braces` GHSA-vfj7-8cjw-p6xm and `node-forge` GHSA-86w9-cpqp-85rv; moderate decode-uri-component, esbuild, sprintf-js and uuid; low @ai-sdk/provider-utils. undici is absent in both, so the bump's effect holds.
- The high **package** set grew from 49 to 98. The 49 new entries are all Expo/React Native dependents (for example expo-router, react-native-screens, @testing-library/react-native and jest-pnp-resolver), flagged by propagation from the same two roots. npm recomputes this propagation from live registry metadata.
- D248 recorded 99 high / 96 omit-dev on 2026-10-07 before row 5, so this metric has swung 99 → 54 → 49 → 53 → 98 with no tree change of that size.

The figure 49/53 cannot be reproduced and the row-23 gate "high <= 53" FAILs on today's data. The cause is not the change. The stable metric is the root-advisory set, and it is unchanged apart from undici being cleared.

## 5. Suites (checks 4 and 5)

### 5.1 Per-workspace runs (`--maxWorkers=2`, verbatim count lines)

| Workspace | Command | Load before | Result (verbatim) | Claimed (row 27) |
|---|---|---|---|---|
| shared | `npm run test -w @dems/shared -- --maxWorkers=2` | 3.10 | `Test Files  71 passed (71)` / `Tests  1851 passed (1851)` / `Duration  7.68s` exit 0 | 71/1,851 |
| core-web | `npm run test -w @dems/core-web -- --maxWorkers=2` | 3.24 | `Test Files  117 passed (117)` / `Tests  1495 passed (1495)` / `Duration  132.42s` exit 0 | 117/1,495 |
| mobile | `npm run test -w @dems/mobile -- --maxWorkers=2` | 4.64 | `Test Suites: 193 passed, 193 total` / `Tests:       1994 passed, 1994 total` / `Time: 133.89 s` exit 0 | 193/1,994 |
| core-server unit | `npm run test -w @dems/core-server -- --maxWorkers=2` | 8.11 | `Test Files  160 passed (160)` / `Tests  3954 passed (3954)` / `Duration  28.45s` exit 0 | 160/3,954 |
| core-server db | `npm run test:db -w @dems/core-server -- --maxWorkers=2` (outside the sandbox) | 4.80 | `Test Files  124 passed (124)` / `Tests  1751 passed (1751)` / `Duration  117.27s` exit 0 | 124/1,751 |
| root typecheck | `npm run typecheck` | — | exit 0, 0 `error TS` | exit 0 |
| root lint | `npm run lint` | — | exit 0 (5 workspaces) | exit 0 |

Mobile's delta against the D256 baseline (192/1,988) is +1 suite and +6 tests: the 4 tests of the new file plus 2 new `elapsed-ticker` tests. That is exactly row 22's delta, with nothing removed.

Database pre-condition:

- `npm run pg:status` printed `server RUNNING, PID 47413 (postmaster.pid: 127.0.0.1:4432 ...)`. The connect probe returned EPERM inside the sandbox.
- The sandboxed `test:db` failed with `DbTestHelperError: ... (EPERM). That is a command sandbox, not a stopped server`.
- The run was repeated outside the sandbox and is reported above. Port 5432 was not used, and no `.data/pg.*` content was printed.

### 5.2 The four D256 tests (plus the D246 residual and the new RC-1 test)

| Test | Run 1 | Run 2 | Run 3 | Inside the full workspace run |
|---|---|---|---|---|
| mobile `live-gap-read-only-dialog` | 1/1, 3.10 s | 1/1, 2.03 s | 1/1, 2.02 s | `PASS` (mobile 193/193) |
| mobile `live-settings-boundary` | 8/8, 3.99 s | 8/8, 4.37 s | 8/8, 4.01 s | `PASS` |
| mobile `live-session-live-link` | 14/14, 3.83 s | 14/14, 3.78 s | 14/14, 3.91 s | `PASS` |
| core-web `live-paired-devices-issue` | 20/20, 3.68 s | 20/20, 3.24 s | 20/20, 3.17 s | pass (core-web 117/117) |
| mobile `chrome-lost-updates` (D246) | 4/4, 3.25 s | 4/4, 3.36 s | 4/4, 3.25 s | `PASS` |
| mobile `live-rc1-elapsed-stop-hold` (new) | 4/4 | 4/4 | 4/4 | `PASS` |

No failure was recorded: 0 of 18 isolated runs failed and 0 of 2 full runs failed. The host load during these runs was 5.2-6.0, which is lower than the D256 failure conditions (20-31). A green result here is not proof that the load flake has gone; see AU1-1.

### 5.3 Probe of the core-web D256 failure site (finding AU1-1)

D256 recorded the core-web failure at `live-paired-devices-issue.test.tsx:132` ("marker digits mismatch"). That line checks the two digit groups right after `issueMarker()` (`:77-81`), which waits for `waitFor(() => expect(shownDigits()).toBe(MARKER_CODE))`.

The digits are drawn by `CodeDigits` → `TextScramble` (`code-display.tsx:13` `SCRAMBLE_SECONDS = 0.6`; `text-scramble.tsx:78-106`, a real `setInterval` every `speed*1000` = 40 ms). The default motion policy in tests is `reduced: false` (`use-motion-policy.ts:34`).

The scratch probe rendered `<CodeDigits code="482913" revealed={false}>` in the worktree only, then sampled its text every 8 ms:

```
AU1-SCRAMBLE trials=3 distinctFramesTrial0=482913,180842,407911,485966,478924,476978,480928,480919,487918,483914,482910,485919,482913
AU1-SCRAMBLE trials=200 ... finalShownThenChangedAgain=200
```

In 200 of 200 mounts, the first frame after mount already equals the final code, and the real interval then scrambles it for about 0.6 s. So `issueMarker()`'s completion condition can be met before the reveal has even started. The assertions that follow, `:128-132`, then race a real 40 ms timer. Late frames, where only one digit per group is random, can also match by chance (frame `482910` above is one digit off).

Verified facts: the real-interval dependency, the pre-scramble frame equal to the final code, and the D256 failure line sitting on this path. The exact interleaving that produced D256's failure is a **hypothesis** consistent with these facts.

Row 20 changed only `:373`, and its report (`implementation/05`) does not analyse `:132` or the scramble. Row 25 (`gateway_check/02`) does not mention it either: `grep -n "132\|[Ss]cramble"` returns 0 hits.

## 6. Verdict per row

| Row | Claim (rev 1) | Verdict | Evidence |
|---|---|---|---|
| 16 | B10-a `live-gap-read-only-dialog`: 3/3, 0 waits, production diff empty | **CONFIRMED** | No diff; 0 timer tokens (§2.3); 3/3 alone plus the full run (§5.2) |
| 17 | B10-b `live-settings-boundary`: 3/3, 0 waits, prod empty | **CONFIRMED** | 2 waits converted to runner fake timers; expect 61=61; 3/3 plus the full run; timeout 40 s → 20 s default (not raised) |
| 18 | B10-c `live-session-live-link`: 3/3, 0 waits, prod empty | **CONFIRMED** | 1 wait (`waitA11yTick`) converted; expect 78=78; 3/3 plus the full run |
| 19 | B10-e RC-8: 0 per-test 20000 overrides; mobile ≥1,988 | **CONFIRMED** | 7 files, removals only; 0 residual 20 s overrides (§2.5); mobile 193/1,994 |
| 20 | B10-d `live-paired-devices-issue`: wall-clock independent, 3/3, prod empty | **PARTLY** | `:373` conversion correct and 3/3 green, but the file still depends on a real 40 ms `setInterval` at the recorded D256 failure path `:132` (AU1-1) |
| 21 | B10-f `chrome-lost-updates`: 3/3, 0 waits, prod empty | **CONFIRMED** | 4 sleeps converted; expect 38=38; 3/3 plus the full run; mutation killed 3/4 (§2.4) |
| 22 | RC-1: hub never steps back after a late stop; RED/GREEN; `use-monitor.ts` diff empty; 3/3 | **PARTLY** | Acceptance column fully reproduced (§3.2-3.3), but the hub row still steps back at SEALED (1129 → 1122, §3.4), short of D255's "per session" ruling; follow-up unscheduled (AU1-2) |
| 23 | B2: audit high ≤ 53, undici ≥ 7.29.1, typecheck+lint 0 | **PARTLY** | undici and lockfile confirmed (§4.1-4.2); typecheck and lint exit 0; the audit clause fails on today's data, 98 > 53 (registry drift, same lockfile and roots; AU1-3) |
| 24 | B2 review: dependencies listed, install-script count stated | **CONFIRMED** | One package moved; install scripts 17 → 17; the accepted-risk roots are still the only high roots. Its numeric audit baseline is stale (AU1-3) |
| 25 | B10 review: verdict per file, 0 production files, findings routed | **PARTLY** | Verdicts and the 0-production-files claim match my diff read, but it passed row 20 without examining the D256 failure site (AU1-1) |
| 26 | RC-1 review: forward-only checked with file:line, findings routed | **CONFIRMED** | Its 6-path analysis matches mine, including the SEALED caveat (F4/R1) that my probe reproduces. The routing gap is downstream (AU1-2) |
| 27 | Wave-A regression: 5/5 exit 0 at the stated floors; typecheck+lint 0 | **CONFIRMED** | All five counts reproduced exactly (§5.1); typecheck and lint exit 0; its audit figure is not reproducible today (AU1-3) |

## 7. Findings

| ID | Severity | File:line | Evidence | Proposed revision |
|---|---|---|---|---|
| AU1-1 | Major | `apps/core-web/src/test/live-paired-devices-issue.test.tsx:77-81` (`issueMarker`), `:132`; `apps/core-web/src/features/paired-devices/code-display.tsx:13`; `apps/core-web/src/components/ui/text-scramble.tsx:78-106` | §5.3. The recorded D256 failure (`:132`, D256 in `2026-10-04.../decisions.md:262`) sits on a real 40 ms `setInterval` scramble. The completion condition of `issueMarker` is satisfied by the pre-scramble frame (200/200 mounts). Row 20 touched only `:373`. 14 call sites use `issueMarker()` | Re-open row 20 as a small follow-up and make the reveal deterministic in this file. Option 1: render the page bed under reduced motion (the component shows final text at once, `text-scramble.tsx:68-71`) for tests that are not about the scramble. Option 2: inside `issueMarker`, fake only `setInterval`/`clearInterval` (`vi.useFakeTimers({ toFake: ['setInterval','clearInterval'] })`), advance more than 600 ms, restore, then assert. Then state the outcome in `implementation/05` and `gateway_check/02`. Do not raise timeouts |
| AU1-2 | Major | `apps/mobile/src/features/sessions/sessions-model.ts:112-113, :74`; `session-row.tsx:61, :115-116`; `apps/mobile/src/runtime/recording-elapsed.ts:149-155`; `masterplan/02_plan.md:446, :452` | §3.4 probe: `FINALIZING\|1129 → SEALED\|1122`. D255 ruled "keep the larger ... per session"; the step back moved to the seal. Row 26 F4/R1 flagged it as Needs-follow-up; 0 hits for it in the rev-2 blueprint and plan | The controller records a decision and schedules a row. Two coherent options need a user ruling: (a) the history row of the just-stopped session also draws max(held, durationMs) until another session starts (honours D255 literally, but shows a duration above the sealed evidence's); (b) re-rule D255 so that the authoritative sealed duration wins and the held value converges once, at SEALED (accepts one bounded correction, never overshoots the evidence). Add the chosen fix plus a fake-clock test of the SEALED swap to M9-W3 (row 97) and keep the device check in A4 |
| AU1-3 | Major | `package.json:19-21`, `package-lock.json` (undici entry); `decisions/decisions.md:25` D14(a), `:27` D15(a); `implementation/08:214-225`; `test/01:33` | §4.3: today high 98 / omit-dev 95 against the claimed 49/53 and 46, on the same lockfile with the same 2 high roots. The count is not reproducible, and the row-23 gate "≤ 53" fails today | Record today's figures and the drift attribution in the decision log (no tree change needed). Re-base the B2 gate and any later audit gate on the **root-advisory set** (unique GHSA IDs: high = {braces, node-forge}; undici absent), not on npm's propagated package count. Keep the braces/node-forge accepted-risk entries and re-check them at the next milestone gate |
| AU1-4 | Minor | `decisions/decisions.md:23` D13(c) | D13(c) says the fix "never overshoots the stop". `implementation/07:229` (§7.3 "Accepted overshoot") and §3.4 (held 1129 against a stored 1122) show it does overshoot, by the stop-learning delay δ | Correct D13(c) by an erratum in the next decision entry: "holds at the largest drawn second; can exceed the stored duration by δ (accepted per D255)" |
| AU1-5 | Nit | `apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx:114, :130, :180` | Lower-bound assertions (`toBeGreaterThanOrEqual(ticked)`). A regression that holds one second too many would pass. In the deterministic set-up the held value equals `ticked` exactly (1129 = 1129, §3.2) | Change to `expect(drawn()).toBe(ticked)` at the three sites |
| AU1-6 | Nit | `apps/mobile/src/runtime/recording-elapsed.ts:149-155, :171-174` | `freeze()` is an irreversible side effect called inside `useMemo` during render. If the same `sessionId\|startedAt` ever re-entered RECORDING, the cached ticker would stay frozen. Hypothesis only: `session-machine.ts:657` is the sole RECORDING entry, and the store clock would still advance through the `Math.max` | Optional: when `sharedTicker` returns a cached ticker whose `stopped` flag is set, replace it with a fresh one, or document the invariant at `:128` |

Disclosures already routed in the plan, not re-raised here:

- Row-25 F1, the narrower W92-16 window.
- F2, the `clearToasts()` 350 ms wait.
- F3, `waitForSheetExit`.
- F4, the 20 `jest.setTimeout(30_000)` files, routed to M9-W3 (`masterplan/02_plan.md:449-451`).

Observation only: a second worktree, `/Users/gsp-budi/Documents/DEMS/.kilo/worktrees/immense-slime` (detached at 2a4f4ea), exists from before this audit. It was not touched.

## 8. Next steps for the controller

1. Route AU1-1 back to row 20 (coder-execution follow-up; one file, test-only).
2. Put AU1-2 to the user as a D255 clarification, (a) or (b), then schedule the fix in M9-W3 (row 97) with a SEALED-swap test.
3. Record AU1-3 and AU1-4 as decision-log errata and re-base the audit gate on root advisories.
4. AU1-5 and AU1-6 are optional; they can fold into row 97.

---
*Generated: 2026-10-08 05:55 WIB*
*Last Updated: 2026-10-08 05:55 WIB*
