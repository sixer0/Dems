# M2 — the closing mobile consolidation: one read-only rule in the runtime, W66's chip in one call, a link-derivation sweep for W93

**Row**: M2 (controller-added; decisions D175 DN-4 = W73's F73-5 / DN-4, and D164 DN-2 = M1's DN-2), the last
mobile consolidation before the mobile code review W93. Model: rows M0 (`09a_m0_link_rule.md`) and M1
(`09b_m1_mobile_consolidation.md`). Agent: coder-execution. **Time**: 2026-10-06 02:15–02:40 WIB.
**Status**: **needs-review** — all three items done and verified, no visible change to an operator, but item 1
changed two assertions of W73's gated static test, which the brief's grant (an import line) does not cover:
decision **DN-1** below. Everything else is within the brief.

**Controller gate (decision D180, 02:38–02:42)**: PASS. DN-1, DN-2 and DN-3 (the surface-table line is enough) are
ratified; DN-5 goes to W87; DN-6 goes to W93's brief. L-1 and L-2 were granted as a follow-up, which is
reported at the end of this file.

Assets (`gateway_check/assets/`): `09c_m2_final_gate.log` (whole suite, typecheck, lint, unchanged-file
checks), `09c_m2_item_runs.log` (the per-item runs), `09c_m2_mutations.log` (control + 17 mutants),
`09c_m2_changes.diff.txt` (every edited file against its pre-image, the new files and post-images with
SHA-256), `09c_m2_item3_sweep.txt` (the raw candidate lines of item 3), `09c_m2_mutate.py.txt`,
`09c_m2_mutating_transformer.cjs.txt`, `09c_m2_jest_mut_config.cjs.txt`.

---

## 1. Outcome per item

| # | Item | Outcome | Visible to an operator? | Evidence |
|---|---|---|---|---|
| 1 | One read-only rule in `@/runtime` (D175 DN-4) | **Done.** The two copies were byte-identical apart from their names (§2). `runtime/use-core-link-read-only.ts` holds the one hook, `useCoreLinkReadOnly()`, built on `useCoreLinkNotice()`; one barrel export and one surface-table line. The monitor screen, the monitor actions and Recovery's actions call it; both local functions are gone. W68's tests are unchanged. **W73's static test pinned the rule's body inside `use-recovery.ts`, so two of its assertions were changed by design (DN-1)** | No: the same code runs (§2), proven at every step of 2,592 histories against the former text (§3) | typecheck 0; 14 suites / 195 tests, exit 0 (02:24); new test 14; mutations 9 of 9 on the helper (§6) |
| 2 | W66's chip in one call (D164 DN-2) | **Done.** `features/more/use-core-link-chip.ts` takes `const { offline } = useCoreLinkNotice();` (11 lines of M0's snippet plus M1's seed become 1). W66's gated pin was changed as granted: two regexes became one (§4) | No: `useCoreLinkNotice()` is the same five lines with the same seed (§4) | typecheck 0; 14 suites / 136 tests, exit 0 (02:25); mutations 3 of 3 (§6) |
| 3 | Read-only sweep of `features/**` for "link down" derived without the notice (report for W93) | **Done, no code changed.** 208 production files read. 11 places listed in §5, with file:line, mode, why M0's static check cannot see them, and an owner. Main ones: Login's chip, ring and dust loop read the two-valued `coreLink.state` (L-1); the replica's tablet link stands in for the Core link in SIMULATED and HEARTBEAT (D-1) | — | §5; `09c_m2_item3_sweep.txt` |
| Final | Whole suite, typecheck, lint, unchanged files, mutation run | `@dems/mobile` **139 suites / 1,709 tests, exit 0**: the ledger's 138 / 1,695 plus this row's 1 suite / 14 tests. No red file. typecheck exit 0; lint exit 0 with eslint JSON **534 files, 0 errors, 0 warnings**. The 72 baseline files and W60's tests are unchanged. **Mutations: 16 of 17 caught.** The one that survived (C1) is a gap in W68's tests that predates this row (DN-5) | | §7 |

## 2. Item 1: the two copies, compared

`diff` of the two function bodies (`.cache/m2/monitor-body.txt`, `recovery-body.txt`) shows **one line**:
the function's name. Both started at `acaff20` as the same step-79 expression (step 81 copied it), and W68 and
W73 each added the same LIVE line.

| | Session Monitor (W68) | Recovery (W73) |
|---|---|---|
| Function (before) | `useMonitorReadOnly`, `features/session-live/use-monitor.ts:129-135` | `useRecoveryReadOnly`, `features/session-recovery/use-recovery.ts:210-216` |
| Body | `useConnectionBanner()`, `useCoreLink()`, `useCoreLinkNotice()`; `if (link.source === 'LIVE') return offline;` `return banner.kind === 'offline' \|\| link.state === 'OFFLINE';` | **identical** |
| Hook order | banner, link, notice | identical |
| At `acaff20` | `use-monitor.ts:104-108` (step 79) | `use-recovery.ts:184-188` (step 81): the same two lines |
| Doc comment | "step-79 rule"; names the screen's display-only controls | "step-81 rule"; "the monitor's rule, step 79" |
| Callers | `session-live-screen.tsx:124`: disables the Snapshot and Bookmark tiles (`:271`) and End Session (`:280`). `use-monitor.ts:185`: refuses the guarded actions with `features.session-live.errors.readOnly` and an `info` log (`:217-226`). CLIP reset and camera choice are not guarded | `use-recovery.ts:250`: refuses Start with `features.session-recovery.actions.readOnly` and an `info` log (`:254-258`). The button stays enabled and only the press is refused |
| What the screen shows besides | The banner (`session-live/connection-banner.tsx`, from the runtime banner) | Its own LIVE-only alert and Back hold from `useCoreLinkNotice().offline` (`session-recovery-screen.tsx:122-125`, `:363-369`). That is the notice, not the read-only rule: outside LIVE the alert never shows, though the screen can still be read-only |
| Tests that pin it | Behaviour only: W68's mutant U3 was caught by `live-session-live-link.test.tsx` (`implementation/68_mobile_session_live.md:251`) | Behaviour did not catch W73's mutant U6 (`73_mobile_recovery.md:228-232`), so W73 pinned "the exact three lines" in `recovery-live-static.test.ts:126`, `:129` (its DN-6) |

**Differences in behaviour: none.** The rule's code is the same text, so there was nothing to choose. What
differs is how each screen uses the answer: the monitor disables controls and refuses presses, Recovery only
refuses presses, and Recovery draws its own alert from the notice. All of that is screen code and is
**unchanged**.

### 2.1 The change (before / after, file:line)

| File | Before | After |
|---|---|---|
| `runtime/use-core-link-read-only.ts` (new, 32 lines) | — | Header with the rule per source and the one-call form. `useCoreLinkReadOnly()` at `:26-32`: **the same body**, under one name |
| `runtime/index.ts` | export block ends `:208` | `:209` `export { useCoreLinkReadOnly } from './use-core-link-read-only';`. Surface table `:36`: "Make session actions read-only while the Core link is down \| `const readOnly = useCoreLinkReadOnly();` (row M2: in LIVE the notice above, else the step-79 rule); never a rule of your own". The module table was not extended (DN-3) |
| `features/session-live/use-monitor.ts` | `:48` imported `useConnectionBanner`, `useCoreLinkNotice`; `:118-135` the function and its doc; `:185` `const readOnly = useMonitorReadOnly();`; header `:22-24` | `:49` `import { reportRuntimeIssue, useCoreErrorPresenter, useCoreLink, useCoreLinkReadOnly } from '@/runtime';`. The function is removed. `:167-169` a two-line comment (S7; display-only controls not guarded) and `const readOnly = useCoreLinkReadOnly();`. Header `:22-25` names the helper |
| `features/session-live/session-live-screen.tsx` | `:49` `import { usePendingPress } from '@/runtime';`; `:81` `useMonitorReadOnly,` in the `./use-monitor` import; `:124` `const readOnly = useMonitorReadOnly();` | `:49` `import { useCoreLinkReadOnly, usePendingPress } from '@/runtime';`; the `./use-monitor` line removed; `:123` `const readOnly = useCoreLinkReadOnly();` |
| `features/session-recovery/use-recovery.ts` | `:45` imported `useConnectionBanner`, `useCoreLinkNotice`; `:202-216` the function and its doc; `:250` `const readOnly = useRecoveryReadOnly();`; header `:25-26` | `:46` `import { reportRuntimeIssue, useCoreErrorPresenter, useCoreLink, useCoreLinkReadOnly } from '@/runtime';`. The function is removed. `:235-236` comment and `const readOnly = useCoreLinkReadOnly();`. Header `:25-27`. The file's one `SIM-GAP` marker (`:168`) and its `useCoreLink().source === 'LIVE'` (`:231`) are kept, as W73's static test counts them |
| `features/session-recovery/recovery-live-static.test.ts` (W73, gated) | `:126` `…useCoreLinkNotice…).toEqual(['session-recovery-screen.tsx', 'use-recovery.ts'])`; `:128` comment; `:129` regex of the body's three lines | `:126` `.toEqual(['session-recovery-screen.tsx'])`; `:128` "The read-only rule is the runtime's one helper (row M2, D175 DN-4): LIVE the one notice, else step 81's."; `:129` `expect(fileText('use-recovery.ts')).toMatch(/const readOnly = useCoreLinkReadOnly\(\);/);` — **DN-1** |

Old names: neither `useMonitorReadOnly` nor `useRecoveryReadOnly` had an importer other than the two
callers (`grep` over `apps/mobile/src` at 02:20: `session-live-screen.tsx:81` only). No test imported them,
so they were removed and not re-exported (DN-2).

Granted import-line changes in tests: **none needed.** W68's test files and W73's behavioural test files are
byte-equal to their state at 02:19 (hash check, §7). The only test file of the two rows that changed is
W73's static test (DN-1). The production import lines that changed are `use-monitor.ts:49`,
`session-live-screen.tsx:49` (plus the removed `:81`) and `use-recovery.ts:46`.

## 3. Item 1: the new test (`runtime/use-core-link-read-only.test.tsx`, 14 tests)

| Group | What it proves |
|---|---|
| LIVE (5) | A cold start (CONNECTING, banner hidden) is not read-only, and a reconnect with no outage before it (CL-11a) is not either. The step-79 rule would make both read-only (asserted): that is **W73's U6**. An outage is read-only from the first STALE or OFFLINE until the first heartbeat, and reconnect attempts keep it (no blink). A screen first opened during a reconnect after an outage is read-only from its first render. After the first render the banner alone moves nothing |
| SIMULATED and HEARTBEAT (3) | The step-79 rule exactly, for every heartbeat × banner. Explicit cases: HEARTBEAT CONNECTING is read-only, unlike LIVE; a banner `offline` alone is read-only; an online link with no banner is not. It follows every change at once, with no state of its own |
| Equal to the former copy (1) | The former text, verbatim, renders beside the helper in one probe: every source × every first link × every sequence of 3 link changes or resyncs, **2,592 screens, 10,368 renders, 0 mismatches**. The walk reaches the LIVE answers that differ from the step-79 rule (counted > 0) |
| One helper in the app (4) | The barrel hands out this very hook (`toBe`). The monitor screen, the monitor actions and Recovery each have `const readOnly = useCoreLinkReadOnly();` and import it from `@/runtime`. No `function useMonitorReadOnly`/`useRecoveryReadOnly` is left. Static checks R1 (the step-79 expression, either order) and R2 (a file that calls both `useConnectionBanner(` and `useCoreLinkNotice(`) find the former copy (positive controls), stay quiet on the monitor's banner view, Login's ring line, Recovery's alert and a call of the helper, and find **no** production file under `features/` |
| The file (1) | Built on `useCoreLinkNotice()`. No effect, ref, state, timer or clock. It imports only `./connection-banner`, `./contract`, `./use-core-link-notice` |

## 4. Item 2: W66's chip

| File | Before | After |
|---|---|---|
| `features/more/use-core-link-chip.ts` | `:19` `import { useState } from 'react';`; `:21` `import { coreLinkViewOf, initialOfflineNotice, offlineNoticeAfter, useConnectionBanner, useCoreLink, type CoreLinkSource } from '@/runtime';`; `:38-48` `view`, `banner`, `viewSeen`, `offline` seeded by `initialOfflineNotice(view, banner)`, the render-time adjustment; header `:7-14` | `react` import removed; `:21` `import { useCoreLink, useCoreLinkNotice, type CoreLinkSource } from '@/runtime';`; `:38` `const { offline } = useCoreLinkNotice();`; header `:7-15` names the one call and the seed |
| `features/dashboard/home-more-live-static.test.ts` (W66, gated; **the one granted pin**) | `:133` comment "…the runtime's rule (row M0), adjusted in render…"; `:135` `expect(chip).toMatch(/coreLinkViewOf\(link\)/);` `:136` `expect(chip).toMatch(/offlineNoticeAfter\(offline, view\)/);` | `:133` comment "…the runtime's rule (rows M0, M1) in one call (row M2)…"; `:135` `expect(chip).toMatch(/const \{ offline \} = useCoreLinkNotice\(\);/);` (two regexes become one). `:137` (no ref, effect or timer) is unchanged and still holds |

**Why nothing visible changes.** `useCoreLinkNotice()` (`runtime/use-core-link-notice.ts:34-44`) is the
chip's former code: the same `coreLinkViewOf(useCoreLink())`, the same `useConnectionBanner().kind`, the
same two `useState`s with the same seed `initialOfflineNotice(view, banner)`, and the same adjustment
`offlineNoticeAfter(offline, view)`. The word, tone, icon, source and `live` are computed as before
(`:39-46`). W66's four test files, M1's chip group in `use-core-link-notice.test.tsx` and the end-to-end
F-1 probe on the real Live source all pass unchanged.

## 5. Item 3: "link down" derived without `useCoreLinkNotice()` / `coreLinkViewOf` (for W93)

Method: every production `.ts`/`.tsx` under `apps/mobile/src/features/**` (208 files; tests and `testing/`
left out). I searched the code with comments removed for every reader of a link-like state:
`useCoreLink()` and what is read off it, `.state`/`.heartbeat`, `useConnectionBanner`, `useLiveLink`,
`useHeartbeat`/`HeartbeatContext`, `socketStatus`, `tabletLink`, `outage`, `'offline'`, `isCoreBlocked`,
health queries, resync listeners and time windows. That gave 240 candidate lines
(`09c_m2_item3_sweep.txt` and the run in this report). Each candidate was read in context. The 11 places
below derive "the link is down", or something a reviewer could take for it, by some other route.

| # | Where (file:line) | What derives "down" | Modes | Why M0's static check misses it | Effect | Owner / recommendation |
|---|---|---|---|---|---|---|
| **L-1** | `login/login-screen.tsx:62` `coreOffline = controller.coreLink.state === 'OFFLINE'` → `:66` the gold-dust loop off; `:68` `ringStateFor` → `login/login-model.ts:57-59` (OFFLINE → `critical`); `login/login-card.tsx:588` `coreChipFor` → `login-model.ts:67-68` (chip OFFLINE) and `:594` the chip's breath loop | The **two-valued** `coreLink.state` (`runtime/core-link.ts:56`: anything but heartbeat LIVE is OFFLINE) | HEARTBEAT (as designed) and **LIVE** | It names neither a transient nor STALE (M0 §7, "a copy keyed on the two-valued `coreLink.state`") | In LIVE a cold start's CONNECTING and every reconnect attempt read OFFLINE. Before the first heartbeat the chip says OFFLINE and the ring is critical, while the Login Alert, which uses the runtime rule, stays hidden. The two disagree for that step. Not checked on a device | W59 / W93: in LIVE read `useCoreLinkNotice()` (`offline`, or `view`) for the chip, ring and loops; keep HEARTBEAT as is. Low |
| **L-2** | `login/login-model.ts:60` and `:69` `coreLink.heartbeat === 'STALE'` → attention / STALE chip | Heartbeat STALE | — | — | **Unreachable.** In HEARTBEAT and LIVE a STALE heartbeat already makes `state` OFFLINE (`core-link.ts:56`), which the line above catches. SIMULATED has no heartbeat | W59: dead branches. Info |
| **L-3** | `login/login-model.ts:78-79` `isCoreBlocked` = `source !== 'SIMULATED' && state === 'OFFLINE'` → `login/use-login-controller.ts:103-104` Sign In disabled; HEARTBEAT's Alert `:320` | Two-valued `state` | HEARTBEAT, LIVE (Sign In only) | Same as L-1 | Deliberate: Sign In only while ONLINE (M1 DN-3; commands only while ONLINE). In LIVE the Alert comes from the rule (`:320` `live ? liveOfflineShown : coreBlocked`) | Keep. Info: it answers "may I send", not "is the link down" |
| **L-4** | `login/use-login-controller.ts:109-115` | The runtime rule (`liveOfflineNoticeAfter` = `offlineNoticeAfter`, M0) on a **bare** `coreLink.heartbeat`, not seeded | LIVE | It calls the rule, so it does not fire | Known and kept: M0 B-3/DN-4 and M1 DN-3 give the exact two-line change. A Login screen first opened during a reconnect after an outage shows its Alert one reconnect step late. Sign In is disabled anyway (L-3) | W59 carry list (M1 DN-3). Info |
| **P-1** | `pairing/use-pairing-flow.ts:134`, `:158-164`; `pairing/pairing-connection.tsx:86` | The runtime rule on `useLiveLink()` (the Live link, not `useCoreLink()`), not seeded. `pairing-connection.tsx:86` repeats `showsOffline` of `pairing-live-model.ts:138-140` | LIVE | It calls the rule | Known and kept (M0 B-3/DN-4: Pair must know when a redeem would be sent; M1 DN-3; the duplicate is M0's Info observation) | W57 carry list. Info |
| **D-1** | `devices/devices-model.ts:103-104` (TABLET row CONNECTED/OFFLINE); `devices/device-detail.tsx:208` (the "tablet offline" alert); `devices/sim-adapter.ts:123` (health series `offlineSince`); `devices/use-devices-data.ts:51`, `:61-62`; `network-time/network-time-model.ts:195` → `network-time/lan-sheet.tsx:30` (tablet tone) | The store's `tabletLink.state` | SIMULATED: **is** the Core link (`core-link.ts:4-5`, `:57`). HEARTBEAT: the runtime drives it from the heartbeat (`core-link.ts:6-9`). LIVE: the Core's statement about the paired tablet, "says nothing about this app's link" (`core-link.ts:46-49`) | It reads a domain slice, not a link vocabulary | By design in SIMULATED and HEARTBEAT ("the Devices screen shows the tablet offline"). In LIVE the row follows the replica. By the replica's design it does not move while this app's link is down, so the TABLET row may keep CONNECTED while the notice says the link is down. *Hypothesis from the code, not run* | W93: a LIVE wording check of the TABLET row during an outage. Info |
| **S-1** | `session-new/devices-check-step.tsx:78` `coreBlocked = live && blocks.some((item) => item.id === 'CORE')` | The Core's precheck result for CORE, at the time of the check | LIVE | A check result, not a link vocabulary | The hint (`session-new/i18n.ts:86`) says it is "this device's own connection to the Core server … run the checks again". It is a snapshot of the check, not the live link. Start Session's live notice is separate (`session-new-screen.tsx:151`) | Keep. Info |
| **H-1** | `home/home-screen.tsx:178-191` (raw `useHeartbeat()` state chip); `:205-212` "Core unreachable" when `useHealth()` fails (`home/use-health.ts:22-37`, 10 s poll) | The raw heartbeat (CONNECTING shown as is); a failed health request | All | Raw state names come from the shared label map; the health failure is a request | The **Stack Check proof screen** (`navigation/routes.ts:128-129`, AC-31), not an operator screen. A failed request is not a link state (LB-10), but this is a diagnostics view | Keep (AC-31 greps pin the file). Info |
| **B-1** | `session-live/connection-banner.tsx:21-32` (and the haptic on its edge, ref + effect `:25-29`) | The runtime's banner kind (`useConnectionBanner()`) | All | — | It draws the runtime's banner. That banner is the runtime's own function (M0 DN-5), held to the rule in LIVE by `link-notice.test.ts`. Not a copy | Keep. Info |
| **M-1** | `more/more-model.ts:116` `link.state === 'ONLINE' ? 'simulated' : 'offline'` | Two-valued `state` | SIMULATED, HEARTBEAT only (LIVE takes the notice at `:115`) | — | By design outside LIVE (MD-8) | Keep. Info |
| **F-1** | `features/settings/**` | — | — | — | W82 is writing here. At 02:27 the folder read `useCoreLink().source` only (`core-link-switch.tsx:59`, `maintenance-section.tsx:96`, `:129`, `:160`, `:256`, `:337`, `security-section.tsx:39`, `settings-screen.tsx:40`), with no link-down derivation | W93: re-run this sweep on W82's final files |

**Clean** (the notice or the helper only): the monitor (`use-monitor.ts:169`, `session-live-screen.tsx:123`),
Recovery (`use-recovery.ts:236`, `session-recovery-screen.tsx:122`), Start Session (`session-new-screen.tsx:151`),
Summary (`session-summary-screen.tsx:94`), the Sessions hub (`sessions-screen.tsx:169`), Audit
(`audit/chain-live.tsx:53`) and the chip (`more/use-core-link-chip.ts:38`). No production file under
`features/` calls `useConnectionBanner()` together with `useCoreLinkNotice()`, and none writes the
step-79 expression (§3, checks R1/R2). M0's checks C1 to C3 still find nothing.

## 6. Mutation run (rule M15: nothing in the tree was modified; `assets/09c_m2_mutations.log`)

Method of M0 and M1: a jest transformer outside the tree (`.cache/m2/mut/`, copied to the assets)
applies one mutant's edits **in memory** to one production file, then hands the result to the app's own
babel-jest. Each mutant runs the test files of its group. A mutant is detected when jest exits ≠ 0. The
SHA-256 of the five mutated files was compared before and after every batch.

```
# M2 mutation check, 2026-10-06 02:32:45; the tree is not edited
control (no mutation, 11 test files): exit=0 Tests:       139 passed, 139 total (22 s)
## 9 detected, 0 not detected, 0 not applied, of 9          (group R, 02:33:10–02:34:47)
## 7 detected, 1 not detected, 0 not applied, of 8          (groups C, K, 02:34:52–02:35:56)
## the mutated files in the tree, before and after: identical
```

| Group | Mutants | Caught | Tests that fail |
|---|---|--:|---|
| **R — the helper** (`runtime/use-core-link-read-only.ts`; its test plus 6 screen test files) | **R1 = W73's U6**: LIVE takes the step-79 rule. R2: outside LIVE the notice instead. R3: banner not read. R4: link state not read. R5: LIVE = notice OR step-79. R6: LIVE = notice AND banner. R7: HEARTBEAT handled like LIVE. R8: LIVE inverted. R9: never read-only | **9 / 9** | R1: `use-core-link-read-only.test.tsx` **and W68's `live-session-live-link.test.tsx`** ("a reconnect with no outage …"). So U6, which W73's behavioural tests missed, is now caught by behaviour twice. R2: also `session-live-screen.test.tsx`. R8, R9: also W68's and W73's Live files |
| **C — the call sites** (6 screen test files) | C1: monitor actions never refused. C2: monitor screen never disables. C3: Recovery Start never refused. C4, C5: always refused | **4 / 5** | C2: `live-session-live-link`, `session-live-screen`. C3: `live-recovery-sites`, `live-recovery-restart`. C4, C5: many |
| **K — the chip** (W66's three files + `use-core-link-notice.test.tsx`) | K1: ignores the notice. K2: always Offline in LIVE. K3: takes `view === 'down'` instead of `offline` (Live while settling after an outage) | **3 / 3** | all four files, including M1's chip group |
| **Total** | 17 | **16 / 17** | |

**C1 survives, and the gap predates this row.** The monitor's action-level refusal
(`use-monitor.ts:201-210`, `if (guarded && readOnly)`) is reached by no test. Every tested press is stopped
earlier by the disabled control (`session-live-screen.tsx:270`, `:279`; mutant C2). The refusal *can* be
reached: End Session's `disabled` only gates the hold button (`end-session.tsx:55`, `:99`, `:121`, `:129`,
`:140`), so a stop-reason dialog already open when the link drops sends its confirm to
`actions.endSession`, and only the action-level refusal stops it there. Before M2 the same mutant on
`const readOnly = useMonitorReadOnly();` gave the same program over the same tests, because the helper's
body is the former function's body. *That last point is reasoning, not a separate run.* See DN-5.

## 7. Verification (commands from the repo root; `assets/09c_m2_final_gate.log`)

Per item (`assets/09c_m2_item_runs.log`):

```
## item 1, 02:24  npm run typecheck -w @dems/mobile -> exit=0
## item 1, 02:24:27  npm run test -w @dems/mobile -- --maxWorkers=2 src/runtime/use-core-link-read-only.test.tsx src/runtime/use-core-link-notice src/runtime/link-notice src/features/session-live src/features/session-recovery
Test Suites: 14 passed, 14 total
Tests:       195 passed, 195 total
exit=0
## item 2, 02:25:45  npm run typecheck -w @dems/mobile -> exit=0
## item 2  npm run test -w @dems/mobile -- --maxWorkers=2 src/features/more src/features/dashboard src/runtime/use-core-link-notice src/runtime/use-core-link-read-only src/runtime/link-notice
Test Suites: 14 passed, 14 total
Tests:       136 passed, 136 total
exit=0
eslint --max-warnings 0 on the touched files of each item: exit 0
```

Final:

```
## 2026-10-06 02:29:20 WIB  2:29  2 users, load averages: 2.32 3.23 5.16
## $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 139 passed, 139 total
Tests:       1709 passed, 1709 total
Time:        82.974 s, estimated 106 s
exit=0
## 02:30:52 $ npm run typecheck -w @dems/mobile
exit=0
TS errors: 0
## 02:30:56 $ npm run lint -w @dems/mobile
exit=0
eslint json: files 534 errors 0 warnings 0
baseline 72 vs acaff20 (lines of git diff --stat): 0
W60 navigation tests + harness vs b90a3c6 (lines of git diff --stat): 0
61 test files hashed at 02:19: 59 OK; changed: apps/mobile/src/features/dashboard/home-more-live-static.test.ts: FAILED
apps/mobile/src/features/session-recovery/recovery-live-static.test.ts: FAILED
files changed in apps/mobile/src + packages/shared/src since 02:19: 9 (all this row's)
```

- **Ledger.** 138 / 1,695 (02:11) + this row's 1 suite / 14 tests = **139 / 1,709**. That is exactly the
  run. **No red file at any run of this row**, so there is no foreign red to name. W82 wrote nothing under
  `apps/mobile/src` or `packages/shared/src` between 02:19 and 02:31 (`find -newer`).
- The two "FAILED" hash lines are the two pins this row changed by design: W66's (granted, item 2) and
  W73's (DN-1). The 61 hashed files cover every test file of `runtime/`, `features/session-live`,
  `features/session-recovery`, `features/more`, `features/dashboard` and `navigation/`.
- `uptime` before the whole suite: 1-minute load 2.32. Before each batch: 1.46–4.09. It never reached 10.
- The jest message "A worker process has failed to exit gracefully" appears once in the whole-suite run.
  It predates this row (M0 §9).

## 8. Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| **DN-1** | **Beyond the grant.** W73's gated `recovery-live-static.test.ts` pinned the rule's body inside `use-recovery.ts` (`:129`) and that file's `useCoreLinkNotice()` call (`:126`). That pin was W73's DN-6 compensation for its surviving mutant U6. Moving the rule into the runtime (D175 DN-4) cannot leave those two assertions green as written. I changed them by design, in the smallest form: `:126` drops `use-recovery.ts` from the list, and `:128-129` becomes the one-call regex (§2.1). The pin's purpose is now met **by behaviour**: U6 (= R1) is caught by the new runtime test and by W68's `live-session-live-link.test.tsx` (§6). The alternative was to keep Recovery's copy, which would leave the rule in the runtime plus one copy | **Ratify.** To undo, see §9: the rollback has to include my new test's two Recovery assertions |
| **DN-2** | Shape: `useCoreLinkReadOnly(): boolean` moves the **whole** rule (LIVE branch and step-79 branch), with its body byte-identical to the former copies. `useMonitorReadOnly` and `useRecoveryReadOnly` are removed, not re-exported: one name in the app, and no other importer or test used them. The monitor screen's import line changed (production, in the write set) | Ratify |
| **DN-3** | Barrel: one export line (`:209`) and one surface-table line (`:36`), as the brief says. The module table (`:9-25`) was **not** extended, unlike M0 DN-3 and M1 DN-6. If wanted, add one line: `\| use-core-link-read-only \| useCoreLinkReadOnly: session actions read-only while the Core link is down (row M2) \|` | Ratify as is, or add the line in the next runtime slot (comment only) |
| **DN-4** | Item 1 found **no behavioural difference** between the two copies (§2). How each screen uses the answer differs and is kept: the monitor disables its controls and refuses presses; Recovery only refuses its Start press and draws its own LIVE-only alert from the notice | Note; nothing to choose |
| **DN-5** | Mutant C1 survives: the monitor's action-level read-only refusal (`use-monitor.ts:201-210`) is reachable, because a stop-reason dialog already open when the link drops is not disabled (`end-session.tsx:55`). No test reaches that refusal. The gap predates this row and lives in W68's tests. Not fixed here: this row may only create files under `runtime/`, and the gap is in W68's behaviour | W93 / W68 carry list: one Live test that drops the link while the stop-reason dialog is open and asserts the read-only toast, the `info` log and that no stop was sent |
| **DN-6** | Item 3: L-1 (Login's chip, ring and loops follow the two-valued state in LIVE) is the one visible inconsistency found. The others are known, by design or Info | Put §5 into W93's brief. Route L-1 and L-2 to W59's carry list |

Observations, not this row's to fix:

- `runtime/use-core-link-notice.ts:18` already said that a screen must never read `useCoreLink().state`.
  L-1 is the one operator screen that still does so in LIVE.
- After this row, M1 §8's paragraph for the page rows can name the second runtime call: *"A screen whose
  session actions pause while the Core link is down takes `const readOnly = useCoreLinkReadOnly();` from
  `@/runtime` — never the banner plus the notice, never `useCoreLink().state`."*

## 9. Rollback (not executed)

Pre-images with their SHA-256 are in `.cache/rollback/M2/` (`pre.sha256`, 7 files, 02:19). Each file name is
its path with `/` turned into `_`.

1. **Everything**: copy back `apps_mobile_src_runtime_index.ts`, `…_features_session-live_use-monitor.ts`,
   `…_features_session-live_session-live-screen.tsx`, `…_features_session-recovery_use-recovery.ts`,
   `…_features_session-recovery_recovery-live-static.test.ts`, `…_features_more_use-core-link-chip.ts` and
   `…_features_dashboard_home-more-live-static.test.ts` over their originals. Then remove the two new files
   `apps/mobile/src/runtime/use-core-link-read-only.ts` and `use-core-link-read-only.test.tsx`. The suite
   returns to 138 / 1,695.
2. **Item 2 only**: copy back the chip and W66's static test (2 files).
3. **DN-1 only** (Recovery keeps its own copy): copy back `use-recovery.ts` and `recovery-live-static.test.ts`.
   Then, in `runtime/use-core-link-read-only.test.tsx`, drop `features/session-recovery/use-recovery.ts` from
   the "call it" list and accept that file in the "no copy" check. Without that edit the new test fails, by
   design.

None of these files is committed after `b90a3c6`, so `git checkout` cannot restore them. The pre-images can.

## 10. Footprint and limits

- Written in the tree: 7 edited files (two of them test pins) and 2 new files, all listed in §2.1 and §4.
  Documents: this report, its 8 assets and `delegation_progress/coder_execution_m2.md`. Scratch went only
  under `.cache/m2/` and `.cache/rollback/M2/`.
- Not touched: `features/settings/**`, `auth/**`, `navigation/**`, `src/app/**`, the 72 baseline test files,
  `packages/shared/**`, `apps/core-web/**`, `apps/core-server/**`. No git write, no Docker, no emulator, no
  device, no port.
- No `cd` in any command. One void run: the first per-item `eslint` call (02:24) was started through `npx --prefix`
  and found no configuration. It linted nothing and changed nothing. It was repeated as
  `npm exec -w @dems/mobile -- eslint --max-warnings 0 …` (exit 0).
- No device check, as the brief says. Item 3's LIVE effects (L-1, D-1) come from the code, not from a device.

---

## Follow-up: Login's link visuals (decision D180)

**Granted by**: controller gate D180, which passed M2 and ratified DN-1, DN-2, DN-3, DN-5 → W87 and DN-6 → W93. It
also made this row the follow-up writer of `features/login/**` for findings L-1 and L-2 of §5 (W59 is gated).
**Time**: 2026-10-06 02:44–02:58 WIB. **Status**: **complete**.
- **L-1 is fixed.** In LIVE the chip, the glow ring and both ambient loops now read the runtime's link view
  and notice. A link that is still connecting no longer shows as offline or critical.
- **L-2: proven dead in every mode, but not removed.** Removing them would break step 75's baseline test (F.3).

Pre-images are in `.cache/rollback/M2b/` (`pre.sha256`, 02:46). Assets: `assets/09c_m2b_final_gate.log`,
`09c_m2b_red_green.log`, `09c_m2b_mutations.log`, `09c_m2b_changes.diff.txt`, `09c_m2b_mutate.py.txt`.

### F.1 What LIVE now reads, and why the notice and not the bare view

`features/login/login-model.ts:67-70` holds the one mapping, `liveCoreLookOf({ view, offline })`. The
controller feeds it from `useCoreLinkNotice()`, the runtime's one call (rows M0, M1):

| The runtime says | Look | Chip (`login-core-chip`) | Ring | Gold dust / chip breath |
|---|---|---|---|---|
| The notice shows (from the first OFFLINE or STALE until the first heartbeat; a reconnect attempt keeps it), or the view is `down` | `offline` | "Core offline", danger, alert triangle | critical | dust yields; the chip breathes |
| The view is `up` | `up` | "Core online", success, Wi-Fi | ready | dust runs |
| The view is `settling` and the notice does not show: a cold start, or a reconnect with no outage before it | `connecting` | **"Connecting to Core…"**, warning, Wi-Fi | **attention** | dust runs |

**Decision DN-F1: the notice, not the bare view.** Read literally, the brief would map every `settling` to
"not offline". During a real outage, though, the link alternates OFFLINE → CONNECTING → OFFLINE at every
reconnect attempt (`RECONNECT_BACKOFF_MS`). With the bare view, the chip and the ring would flicker between
"Core offline" and "Connecting" while the Alert keeps showing "offline". That is exactly the flicker row
M0's rule removes. With the notice:
- A cold start's `settling` is never offline or critical (the case D180 names).
- A `settling` after an outage keeps the offline look, as the Alert does.

So the chip, the ring and the Alert follow one rule. Mutant V4 (the notice ignored) is caught by the outage
test (F.5). If the literal reading is wanted, the change is one line, `liveCoreLookOf(linkNotice)` →
`liveCoreLookOf({ view: linkNotice.view, offline: false })` (= mutant W2), and the outage test's
reconnect-attempt step would then expect "Connecting…".

**The connecting look is new.** The chip had no word for "connecting", so one key was added:
`features.login.coreChip.SETTLING` = "Connecting to Core…". The ring uses the kit's existing `attention`
state, which means not ready, not failed; Sign In is still disabled then. The chip kind is named `SETTLING`
rather than after the transient state. M0's static check C1 fails the workspace if a feature names that
state in code, and the guard stays green.

### F.2 The change (before / after, file:line)

| File | Before | After |
|---|---|---|
| `login/login-model.ts` | `:18` `import type { CoreErrorText, CoreLinkInfo, SignOutReason } from '@/runtime';`. `ringStateFor` `:57-62` and `coreChipFor` `:67-71` read `coreLink.state` and `coreLink.heartbeat` in every mode. `CoreChipKind` was `'ONLINE' \| 'STALE' \| 'OFFLINE'` | `:20` adds `coreLinkViewOf`, `type CoreLinkView`. `:50-77`: `LiveCoreLook`, `liveCoreLookOf`, and `liveLookFor`, which falls back to the view alone when no look is handed in. `LIVE_RING` `:77`. `ringStateFor` `:91-99` (optional `liveLook`): the lockout first as before, then `if (coreLink.source === 'LIVE') return LIVE_RING[…]` `:93`, then the unchanged lines. `CoreChipKind` `:102` adds `'SETTLING'`. `CoreChip` and `LIVE_CHIP` `:104-113`. `coreChipFor(coreLink, liveLook = null)` `:116-122` with the LIVE line `:117`, then the unchanged lines. The two `STALE` lines carry a comment, `:95-96` and `:119` |
| `login/use-login-controller.ts` | No look. `:37` imports from `@/runtime` | `:40` adds `useCoreLinkNotice`; `:46` adds `liveCoreLookOf`; `:79-81` `const linkNotice = useCoreLinkNotice(); const coreLook = live ? liveCoreLookOf(linkNotice) : null;`; returned at `:342`. Header bullet `:29-31` |
| `login/login-screen.tsx` | `:62` `const coreOffline = controller.coreLink.state === 'OFFLINE';`; `:68` `ringStateFor({ coreLink, locked })` | `:64` `const coreOffline = coreChipFor(controller.coreLink, controller.coreLook).kind === 'OFFLINE';`, so the dust yields exactly while the chip breathes, as its comment always said. `:70` passes `liveLook: controller.coreLook`. `:34` imports `coreChipFor` |
| `login/login-card.tsx` | `:588` `coreChipFor(controller.coreLink)`; icon `chip.kind === 'ONLINE' ? 'Wifi' : 'TriangleAlert'` | `:589` `coreChipFor(controller.coreLink, controller.coreLook)`; `:609` icon `chip.kind === 'ONLINE' \|\| chip.kind === 'SETTLING' ? 'Wifi' : 'TriangleAlert'`. The breath (`:595`, `chip.kind === 'OFFLINE'`) is unchanged and follows the look |
| `login/i18n.ts` | `coreChip` had 3 keys | `:48-49` `SETTLING: 'Connecting to Core…'` (LIVE only). No text names a simulation |

**SIMULATED and HEARTBEAT are byte-for-byte the old logic.** The new code returns early only when
`coreLink.source === 'LIVE'`. In every other mode, `coreChipFor(…).kind === 'OFFLINE'` is exactly the old
`coreLink.state === 'OFFLINE'`, because that is its first branch. This is proven over every source × state ×
heartbeat × lockout × handed look (160 cases) against a verbatim copy of the two former functions. The
HEARTBEAT cold start still reads "Core offline" and critical, as step 75's `login.test.tsx` pins.

**W59's and step 75's tests: green and unchanged.** No by-design pin change was needed: none of them
asserted the LIVE chip or ring. `login-model.test.ts` and `login.test.tsx` are baseline files and still
byte-equal to `acaff20`. `live-login.test.tsx` and `login-live-model.test.ts` match their 02:46 hashes.

### F.3 L-2: dead in every mode, kept anyway

**Proof.** Every Core link the app can see is built in one of three places:
- `runtime/contract.ts:149` `SIMULATED_ONLINE`, which has no heartbeat.
- `runtime/sim-runtime-provider.tsx:332-337`. SIMULATED gets no heartbeat. HEARTBEAT gets one, with
  `state: coreLinkStateFor(source, heartbeat, tabletLink)`.
- `sim-runtime-provider.tsx:434`. LIVE gets a heartbeat with the same `coreLinkStateFor`.

`coreLinkStateFor` (`runtime/core-link.ts:56`) gives HEARTBEAT and LIVE `heartbeat === 'LIVE' ? 'ONLINE' :
'OFFLINE'`. So a STALE heartbeat always comes with `state` OFFLINE, and the line above each `STALE` branch
returns first. After this follow-up, LIVE also returns before reaching them. Both `STALE` branches
(`login-model.ts:97`, `:120`) are therefore unreachable in every mode. The new test pins the proof:
- `coreLinkStateFor` over every source × heartbeat × tablet link;
- a text check that `sim-runtime-provider.tsx` holds exactly the two `coreLinkStateFor(` constructions
  above and that `SIMULATED_ONLINE` has no heartbeat.

**Not removed.** Step 75's `login-model.test.ts:46` and `:53` call the two functions with a hand-built link
`{ source: 'HEARTBEAT', state: 'ONLINE', heartbeat: 'STALE' }`, which the runtime never builds, and expect
`attention` / the STALE chip. That file is one of the 72 baseline files, which must stay byte-equal to
`acaff20`. Removing the branches would turn those two assertions red. D180 granted changes only to tests
that pin the old **LIVE** behaviour, and this one is HEARTBEAT and baseline. So the branches stay, with a
comment saying why (`:95-96`, `:119`). **Decision DN-F2**: ratify, or grant the two baseline assertions;
removing them is then 4 lines in `login-model.ts` and 2 in the test.

### F.4 The new test (`features/login/live-login-link-visuals.test.tsx`, 12 tests)

| Group | What it proves |
|---|---|
| The look (5) | Every view × notice. The chip and the ring of every look; a lockout still wins on the ring. In LIVE the look decides, not the two-valued state. LIVE without a look reads the view alone and is never critical while connecting. SIMULATED and HEARTBEAT match the former functions (160 cases) |
| L-2 (2) | The state of every source × heartbeat × tablet link; the runtime's only two constructions of a link with a heartbeat |
| LIVE on the real Live source (3) | W59's harness: AppProviders over `createMobileLive(...)` and the contract-checked fake transport, on a paired tablet. **Cold start**, with the socket held in CONNECTING: probe `LIVE/OFFLINE/CONNECTING`, chip "Connecting to Core…" with the Wi-Fi mark, ring `attention`, no offline Alert, Sign In disabled. The first heartbeat gives "Core online" and `ready`. **Real outage**: the socket dropped → "Core offline", alert triangle, `critical`, the Alert. A reconnect attempt held in CONNECTING keeps all of it (no flicker). The Core answering clears it. **Loops** (full motion): at a cold start the gold dust runs and the chip does not breathe; in the outage the chip breathes and the dust yields; when the link is back, the dust runs again |
| SIMULATED and HEARTBEAT on the real providers (2) | SIMULATED: "Core online" and `ready`; the simulator's tablet link dropped gives "Core offline" and `critical`. HEARTBEAT with no heartbeat yet: "Core offline" and `critical`, as before |

**Red before, green after** (`assets/09c_m2b_red_green.log`). The two LIVE lines of `login-model.ts` were
removed in memory, which restores the pre-image's two-valued LIVE chip and ring:

```
✕ a cold start (the socket still connecting) shows no "Core offline" chip and no critical ring; …
✕ the ambient loops (full motion): at a cold start the gold dust runs and the chip does not breathe; …
✓ a real outage shows the "Core offline" chip and the critical ring with the Alert, … (the same in both: an outage was always offline)
Tests:       5 failed, 7 passed, 12 total     exit=1
# green after (no mutation): Tests: 12 passed, 12 total     exit=0
```

### F.5 Mutation run over the new mapping (rule M15, in memory; `assets/09c_m2b_mutations.log`)

```
# M2b mutation check, 2026-10-06 02:52:01; the tree is not edited
control (no mutation, 4 test files): exit=0 Tests:       58 passed, 58 total (15 s)
## 12 detected, 0 not detected, 0 not applied, of 12          (group V, 02:52–02:53)
## 6 detected, 0 not detected, 0 not applied, of 6            (group W, 02:53:15–02:53:42)
## the mutated files in the tree, before and after: identical
```

| Group | Mutants | Caught |
|---|---|--:|
| **V — the look** (`login-model.ts`) | V1, V2: ring / chip read the two-valued state in LIVE again (L-1 back). V3: settling reads offline. V4: the notice is ignored (outage flicker). V5: down without the notice is not offline. V6: up reads connecting. V7: connecting ring is critical. V8: connecting ring is ready. V9: connecting chip is "Core offline". V10: LIVE without a look reads offline. V11: the look wins over a lockout. V12: a look applies outside LIVE | **12 / 12** |
| **W — the wiring** | W1: the controller hands no look. W2: the controller drops the notice. W3: the ring gets no look. W4: the dust follows the two-valued state. W5: the chip gets no look. W6: the connecting chip shows the alert triangle | **6 / 6** |
| **Total** | 18 | **18 / 18** |

Each mutant ran the new test file, `login-model.test.ts`, `live-login.test.tsx` and `login.test.tsx`.
W1, W2, W3 and W5 are caught only by the outage test's reconnect step, which is what DN-F1 is about. W4 is
caught by the loops test. W6 is caught by the cold start's icon assertion.

### F.6 Verification (commands from the repo root; `assets/09c_m2b_final_gate.log`, `09c_m2b_red_green.log`)

```
## 02:56:45 $ npm run test -w @dems/mobile -- --maxWorkers=2 src/features/login src/runtime/link-notice-static src/runtime/use-core-link-read-only
PASS src/features/login/live-login.test.tsx
PASS src/features/login/live-login-link-visuals.test.tsx
PASS src/runtime/use-core-link-read-only.test.tsx
PASS src/features/login/login.test.tsx
PASS src/features/login/login-model.test.ts
PASS src/runtime/link-notice-static.test.ts
PASS src/features/login/login-live-model.test.ts
Test Suites: 7 passed, 7 total
Tests:       89 passed, 89 total
exit=0

## 2026-10-06 02:54:35 WIB  2:54  2 users, load averages: 2.53 2.26 2.63
## $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 140 passed, 140 total
Tests:       1721 passed, 1721 total
Time:        83.124 s
exit=0
## 02:56:11 $ npm run typecheck -w @dems/mobile
exit=0
TS errors: 0
## 02:56:15 $ npm run lint -w @dems/mobile
exit=0
eslint json: files 535 errors 0 warnings 0
baseline 72 vs acaff20 (lines of git diff --stat): 0 (incl. login-model.test.ts, login.test.tsx)
W60 navigation tests + harness vs b90a3c6 (lines of git diff --stat): 0
28 test files of features/login + runtime hashed at 02:46: 28 OK; changed: none
files changed in apps/mobile/src + packages/shared/src since 02:46: 6   (exactly this follow-up's)
```

- **Ledger.** 139 / 1,709 (D180) + 1 suite / 12 tests = **140 / 1,721**. No red file.
- **Static guards green.** M0's `link-notice-static.test.ts` (C1 to C3) and M2's `use-core-link-read-only.test.tsx`
  (R1, R2) both pass. The new code names no transient state and writes no step-79 expression.
- `uptime` before the whole suite: 2.53. Before each batch: 1.15–2.53.

### F.7 Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| **DN-F1** | LIVE reads the **notice plus view** (`useCoreLinkNotice()`), not the bare view. A cold start's settling is never offline or critical. A settling during an outage stays offline (no flicker; one rule with the Alert) | Ratify; the literal alternative is one line (F.1) |
| **DN-F2** | L-2 is dead in every mode (F.3) but **not removed**: step 75's baseline `login-model.test.ts:46`, `:53` pins it with a link the runtime never builds | Ratify keeping it, or grant the two baseline assertions |
| **DN-F3** | One new LIVE-only key, `features.login.coreChip.SETTLING` = "Connecting to Core…"; the ring reuses the kit's `attention` state | Ratify (the web console has no Login chip of this kind) |

Not changed, as the grant says: the offline Alert's own state (`use-login-controller.ts:109-115`, L-4: still the
runtime rule on the bare heartbeat, unseeded, M1 DN-3) and Sign In's `isCoreBlocked` (L-3). The chip, ring
and loops use the same rule as the Alert, so they agree everywhere except one case: a Login screen *first
opened* during a reconnect after an outage. There the chip is seeded at once and the Alert follows one
reconnect step later (M1 DN-3's known delay).

### F.8 Rollback (not executed)

Copy back the five pre-images of `.cache/rollback/M2b/`: `apps_mobile_src_features_login_login-model.ts`,
`…_use-login-controller.ts`, `…_login-screen.tsx`, `…_login-card.tsx`, `…_i18n.ts`. The sixth pre-image,
`login-live-model.ts`, was saved but not edited. Then remove
`apps/mobile/src/features/login/live-login-link-visuals.test.tsx`. The suite returns to 139 / 1,709.

### F.9 Footprint

Written in the tree: 5 edited files in `features/login/` and 1 new test there. Documents: this section, 5
assets and the progress file. Scratch only under `.cache/m2b/` and `.cache/rollback/M2b/`. No git write, no
Docker, no emulator, no device, no `cd`.
- **One void run.** The first red-before run (02:53:52) used shell `node … jest` outside the workspace
  folder. The `@/` alias did not resolve, so nothing ran ("Tests: 0 total"). It was repeated through a
  Python subprocess with the workspace as its working directory, as the mutation driver does.
