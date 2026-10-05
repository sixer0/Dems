# M1 — the second mobile consolidation round: one pending hook, a seeded link notice, the back-guard `busy` prop, truthful Start Session copy

**Row**: M1 (controller-added; decisions D157 DN-7, DN-9, F-2, F-3 and D159 DN-1 / W66 F-1), the twin of
row M0 (`09a_m0_link_rule.md`), landed BEFORE the remaining mobile page rows (W68, W72, W73, W79, W80, W82)
copy these patterns. Agent: coder-execution. **Time**: 2026-10-05 23:51 to 2026-10-06 00:24 WIB.
**Status**: **complete**. Three named operator-visible changes (items 2, 3, 4); seven decisions for the
controller (§10).

Assets (`gateway_check/assets/`): `09b_m1_final_gate.log` (whole suite, typecheck, lint, unchanged-file
checks, per-item runs), `09b_m1_mutations.log` (control + 31 mutants), `09b_m1_w78_line.log` (W78's tests
with its copy re-exported in memory), `09b_m1_changes.diff.txt` (every edited file against its
pre-image, the new files with SHA-256), `09b_m1_mutate.py.txt`, `09b_m1_mutating_transformer.cjs.txt`,
`09b_m1_jest_mut_config.cjs.txt`.

---

## 1. Outcome per item

| # | Item | Outcome | Visible to an operator? | Evidence |
|---|---|---|---|---|
| 1 | One pending-press hook in `@/runtime` (D157 DN-7) | **Done.** `runtime/use-pending-press.ts` (code body identical to W67's, 53 lines compared), one barrel block; W67's file is a one-line re-export; W67's screen imports `@/runtime`. W78's copy NOT edited: the one line for it is in §7, proven in memory against W78's own 51 tests | No | typecheck 0; 7 suites / 87 tests (W67's 6 suites unchanged + 8 new); W67's pending test file unchanged (hash) |
| 2 | Link notice seeded from the runtime (D159, W66 F-1) | **Done.** `initialOfflineNotice(link, banner)` in `runtime/link-notice.ts`; ONE call for screens, `useCoreLinkNotice()` (`runtime/use-core-link-notice.ts`). W67's screen takes the call; W66's chip keeps M0's snippet text (pinned by its gated static test) with its first-render line seeded; Pair and Login unchanged (not needed, §10 DN-3) | **Yes**: a Home / More chip or the Start Session notice first rendered while the socket reconnects after an outage reads Offline / shows the notice at once instead of "Core Live" for one reconnect step | 30 suites / 332 tests; new 15 tests incl. the F-1 scenario end to end on the real Live source |
| 3 | `BackGuardDialog` `busy` prop (D157 DN-9, W67 F-6) | **Done** as granted (`busy?: boolean`); W67's cancel confirm passes `busy={cancelPress.pending}`. W60's navigation tests unchanged; own test file beside them | **Yes**: in LIVE, a slow cancel shows the kit's Spinner inside "Cancel session" after the reveal delay | 14 suites / 217 tests; new 6 + 3 end to end |
| 4 | Truthful Start Session copy in LIVE (D157 F-2) | **Done** with two feature-local Live keys (as W67 added its three); the shared strings are NOT edited — their keys and texts for the web are in §10 DN-5 | **Yes**: LIVE step 2 reads "Microphone levels from the Core server"; the scan button's label "Fill in the next case number". SIMULATED unchanged | 19 suites / 249 tests; new 3 copy tests with positive controls |
| 5 | Read-only: a cold `/?core=LIVE` launch reached Stack Check (D157 F-3) | **Explained, no defect in the code.** The launch URL carried `motion=off` on the ROOT path; `/` + any non-empty `?motion=` renders the row-18 proof screen by design (AC-31). Without `motion`, a paired device reaches `/login` | No change | §6, with file:line |
| Final | Whole suite, typecheck, lint, mutation run | `@dems/mobile` **114 suites / 1,431 tests exit 0**; typecheck exit 0; lint exit 0, eslint JSON 496 files **0 errors / 0 warnings**; 72 baseline test files and W60's navigation tests unchanged; **30 of 31 mutants detected**, the one survivor a proven equivalent | | §9, §8 |

## 2. Item 1 — the pending-press hook moves into `@/runtime`

| File | Before | After |
|---|---|---|
| `apps/mobile/src/runtime/use-pending-press.ts` (new, 84 lines) | — | The hook of W67 (`usePendingPress`, `PendingPress`), header naming row M1 and a usage block. The code from `import` to the end is byte-identical to W67's file (53 lines; `diff` of both bodies: empty, 00:00) |
| `apps/mobile/src/runtime/index.ts` | `:201` last export (M0's) | `:205` `export { usePendingPress, type PendingPress } from './use-pending-press';` (one block); module-table row `:23`, surface-table row `:36` ("Mark a control busy while its command is out, the spinner late …") — as M0's DN-3 |
| `apps/mobile/src/features/session-new/use-pending-press.ts` | the hook, 70 lines (SHA-256 `a1a38ac8…`) | ONE line: `export { usePendingPress, type PendingPress } from '@/runtime'; // The one hook lives in the runtime (row M1, D157 DN-7).` Not deleted |
| `apps/mobile/src/features/session-new/session-new-screen.tsx` | `:65` `import { coreLinkViewOf, offlineNoticeAfter, reportRuntimeIssue, useCoreLink } from '@/runtime';` and `:93` `import { usePendingPress } from './use-pending-press';` | `:65` `import { reportRuntimeIssue, useCoreLink, useCoreLinkNotice, usePendingPress } from '@/runtime';` (the link names come from item 2); `:93` removed |

New test `runtime/use-pending-press.test.tsx` (8 tests, manual store clock): a command that settles before
`run` returns sets nothing (Simulated mode); busy at the press and the spinner at the first store-clock step
at or after `LIVE_PENDING_REVEAL_MS` — the store publishes its clock in 100 ms steps
(`packages/shared/src/sim/engine.ts:107-115`), so 420 ms means 500 ms, and 499 ms of wall time still reads
400 (asserted); second and third presses ignored, also before the busy state rendered; no spinner for an
answer before the delay; `release` twice is harmless and a throwing `start` releases; identity — W67's
file and the barrel hand out the runtime's function (`toBe`); the re-export is one line and the hook's code
names no wall clock or timer.

**W67's pending tests stay green UNCHANGED**: `live-session-new-handoff.test.tsx` is one of the 58 test
files hashed at 23:57 and re-checked at 00:21 (58 / 58 OK); its two pending tests (1 s answer: one request
for two and three presses, no spinner at 300 ms, the in-button spinner at 500 ms, nothing added outside;
50 ms answer: no spinner) pass on the runtime hook.

```
## item 1, 00:01:50  npm run test -w @dems/mobile -- --maxWorkers=2 src/runtime/use-pending-press.test.tsx src/features/session-new
Test Suites: 7 passed, 7 total
Tests:       87 passed, 87 total
exit=0
```

## 3. Item 2 — the link notice's first render, seeded from the runtime

**Why the banner is the right seed.** The connection banner (`runtime/connection-banner.ts:37-42`, held by
`sim-runtime-provider.tsx:517-533` in `LiveBridge` since the runtime started) follows the same heartbeat as
`useCoreLink()`; M0's own test proves that in LIVE mode `banner === 'offline'` is exactly the rule's
"shown" for every heartbeat × banner state (`link-notice.test.ts:268-276`). So "what the notice would show
had this screen been mounted all along" is `offlineNoticeAfter(banner === 'offline', view)`.

| File | Before | After |
|---|---|---|
| `runtime/link-notice.ts` | header snippet `:40-48` started from `offlineNoticeAfter(false, view)`; no seed | header `:37-62`: screens take ONE call, the snippet it stands for, and a section "The first render"; `:144-146` `export function initialOfflineNotice(link: CoreLinkInput, banner: ConnectionBannerKind): boolean { return offlineNoticeAfter(banner === 'offline', link); }` — pure (type-only import of `ConnectionBannerKind`; M0's purity scan stays green) |
| `runtime/use-core-link-notice.ts` (new, 44 lines) | — | `useCoreLinkNotice(): { view, offline }` = M0's snippet over `useCoreLink()` with the first state `useState(() => initialOfflineNotice(view, banner))` (`:38`), `banner = useConnectionBanner().kind`; render-time adjustment, no effect, no ref, no timer |
| `runtime/index.ts` | `:201` M0's export; surface row `:32` taught `offlineNoticeAfter(shown, coreLinkViewOf(useCoreLink()))` | `:204` adds `initialOfflineNotice` to M0's export line; `:206` `export { useCoreLinkNotice, type CoreLinkNotice } from './use-core-link-notice';`; module row `:24`; surface row `:34` now `const { view, offline } = useCoreLinkNotice();` (comment only, §10 DN-6) |
| `features/session-new/session-new-screen.tsx` (W67) | `:150-159` M0's snippet (`linkView`, `linkViewSeen`, `linkDown` from `offlineNoticeAfter(false, linkView)`) | `:150-151` `const live = useCoreLink().source === 'LIVE'; const { offline: linkDown } = useCoreLinkNotice();` — `linkDown` feeds the same three places as before (`:195`, `:383`, `:442`) |
| `features/more/use-core-link-chip.ts` (W66; also Home's header chip through it) | `:21` import; `:41` `useState(() => offlineNoticeAfter(false, view))` | `:21` adds `initialOfflineNotice, useConnectionBanner`; `:40-42` comment and `const banner = useConnectionBanner().kind;`; `:44` `useState(() => initialOfflineNotice(view, banner))`. M0's snippet text stays because W66's gated static test pins it (`home-more-live-static.test.ts:134-137`: `coreLinkViewOf(link)`, `offlineNoticeAfter(offline, view)`) — §10 DN-2 |
| `features/dashboard/home-header.tsx` | — | **not edited**: it reads the chip through `useCoreLinkChip()` (`:40`, `:128`) |
| `features/pairing/use-pairing-flow.ts:159`, `features/login/use-login-controller.ts:111` | — | **not edited** (not needed; exact lines in §10 DN-3) |

**Did the snippet change?** Yes — to ONE call. A screen cannot be seeded through M0's five lines unchanged:
their only inputs are `useCoreLink()` (the contract, `runtime/contract.ts`, outside this row) and two pure
functions. The new paragraph for the page rows is §8.

New test `runtime/use-core-link-notice.test.tsx` (15 tests):

| Group | What it proves |
|---|---|
| The pure seed (5) | Every view × banner kind; **LIVE: a first render while down shows; while settling after a down keeps it; while up does not; a cold start does not**; outside LIVE nothing shows whatever the banner says; the seed equals the notice of a screen mounted from the start after **every LIVE history of up to five link changes and resyncs (6,220 histories)**, while M0's first snippet was wrong on some (the F-1 histories, counted > 0); barrel identity and purity |
| The hook over a fake runtime (7) | The same three required cases rendered; M0's rule follows from there with no flicker; outside LIVE `none` / false; after the first render only the view moves it (a banner change alone does not); only LIVE can show it; the file holds no effect, ref, timer or clock |
| W66's chip (1) | First rendered during a reconnect after an outage: "Offline"; at a cold start and while up: "Live"; HEARTBEAT: "Simulated" |
| **End to end, the app's real Live source (2)** (W66's bed, `features/dashboard/testing/live-home-bed.tsx`) | After an outage, a screen opened at a reconnect attempt (CONNECTING) renders `view=settling offline=true m0=false chip=offline banner=offline` — M0's unseeded snippet mounted at the same moment says `false` (the defect, shown); it keeps the notice through OFFLINE and the next CONNECTING; hides at the first heartbeat. A screen opened while up shows nothing |

```
## item 2, 00:06:34  … src/runtime/link-notice src/runtime/use-core-link-notice src/runtime/use-pending-press src/features/more src/features/dashboard src/features/session-new src/features/pairing src/features/login
Test Suites: 30 passed, 30 total
Tests:       332 passed, 332 total
exit=0
```

W66's tests (`use-core-link-chip.test.tsx`, `more-live.test.tsx`, `home-live.test.tsx`,
`home-more-live-static.test.ts`), M0's (`link-notice*.test.ts`), W67's, W57's and W59's: all unchanged and
green. W66's "LIVE cold start … flashes no Offline" still holds: at a cold start the banner is hidden.

## 4. Item 3 — `navigation/back-guard.tsx` gets `busy`

| Line (after) | Before | After |
|---|---|---|
| `:3`, `:7` | `Button, Dialog`; `spacing` | `Button, Dialog, Spinner`; `palette, spacing` |
| `:108-114` | — | `busy?: boolean` with its documentation (LB-1; the caller passes its pending state) |
| `:118` | `({ guard, variant, onConfirm })` (`:111`) | `({ guard, variant, onConfirm, busy = false })` |
| `:135` | — | `if (busy) return;` first in the leave button's `onPress`: a further press is ignored |
| `:140` | — | `{...(busy ? { accessibilityState: { busy: true } } : {})}` — spread only while busy, so a caller that passes nothing gets exactly the props of before |
| `:142` | — | `{busy ? <Spinner size="sm" color={palette.foreground} testID="back-guard-leave-spinner" /> : null}` before the label (the Pair screen's unpair-dialog precedent, `features/pairing/unpair-dialog.tsx:42`) |
| `features/session-new/session-new-screen.tsx:514` (the one granted call) | `<BackGuardDialog guard={back.guard} variant="flow" onConfirm={cancelAndLeave} />` (`:522`) | `… onConfirm={cancelAndLeave} busy={cancelPress.pending} />` |

Not changed: "Stay", the dialog's dismissal, the monitor variant's behaviour without `busy`. W60's tests
(`navigation/__tests__/*`, `navigation/testing/*`): `git diff --stat b90a3c6` empty.

Tests: `navigation/__tests__/back-guard-busy.test.tsx` (6): not passed / false → as before (no busy state,
no spinner, the confirm runs, nothing else in the dialog changes); busy → marked busy, Spinner inside the
leave button, the label kept, nothing added outside; a second and third press ignored, the next press after
busy runs it; monitor variant does not leave while busy; Stay unchanged; barrel identity. End to end in
`features/session-new/live-session-new-followups.test.tsx` (3, real Live source): a 1 s cancel answer → one
cancel for two (and three, four) presses, no spinner at 300 ms, the Spinner inside the leave button at 500 ms
with the busy state, nothing added elsewhere in the dialog, leaves for `/home` when the Core cancelled; a
50 ms answer → no spinner; a 1 s outage → the spinner goes with the answer, the dialog stays, the next
press sends again.

```
## item 3, 00:09:00  … src/navigation src/features/session-new
Test Suites: 14 passed, 14 total
Tests:       217 passed, 217 total
exit=0
```

## 5. Item 4 — truthful copy in Start Session

The two strings are shared (`packages/shared/src/i18n/en/session-new.ts:32` `scan: 'Scan case number (simulated)'`,
`:94` `speakToTest: 'Speak to test (simulated)'`) and were **not edited**. LIVE takes two feature-local
keys, the way W67 added its three LIVE keys under `features.session-new.live.*`:

| File | Before | After |
|---|---|---|
| `features/session-new/i18n.ts` | `live` had 3 keys (`:82-87`) | `:87-91` `speakToTest: 'Microphone levels from the Core server'`, `scanCaseNumber: 'Fill in the next case number'` |
| `features/session-new/device-previews.tsx` | `:83` `{t('sessionNew.devices.speakToTest')}` | `:56-57` `const liveSource = useCoreLink().source === 'LIVE';` (rule 5), `:85` `t(liveSource ? 'features.session-new.live.speakToTest' : 'sessionNew.devices.speakToTest')` |
| `features/session-new/session-info-step.tsx` | `:80` `accessibilityLabel={t('sessionNew.info.caseNumber.scan')}` | `:27` `import { useCoreLink } from '@/runtime';`, `:52-53` `const live = …`, `:83` `t(live ? 'features.session-new.live.scanCaseNumber' : 'sessionNew.info.caseNumber.scan')` |

**Why these words are true** (CS §3.2: "a screen that says 'live' shows server data"): in LIVE the meters
of step 2 are the Live source's `audio` slice, which is the Core server's `meters` frames
(`packages/shared/src/live/source/live-sim.ts:905`; `neutral-state.ts:20`), read by
`runtime/use-audio-shared-values.ts:50-63`. "Speak to test" without "(simulated)" would claim the
operator's voice moves them, which the demo Core's simulated devices do not do, so the Live hint names the
source instead. The case-number button computes the next free number from the replicated counters and
history (`features/session-new/sim-adapter.ts:27-36`, S4-6) and scans nothing, so the Live label says what
it does.

Tests (in `live-session-new-followups.test.tsx`): the Live texts name no simulation; LIVE — the button's
label and the step 2 hint are the Live words and **no text or accessibility label under
`screen-session-new` on steps 1 and 2 matches /simulat/i**; SIMULATED — the words of before, with the same
whole-screen walk finding them (positive control).

```
## items 3 + 4, 00:13:09  … src/features/session-new src/navigation src/i18n src/runtime/link-notice-static src/runtime/live-no-raw-fetch src/runtime/secure-store-import
Test Suites: 19 passed, 19 total
Tests:       249 passed, 249 total
exit=0
```

## 6. Item 5 — why the paired phone reached Stack Check (read-only, no code change, no device)

**What a cold LIVE launch on a paired device must reach: `/login`.** `core=LIVE` is read from the raw
launch URL whatever its path (`runtime/debug.ts:55-58` `coreSourceFromUrl`, `:89-95`
`applyLaunchCoreSource`) and applied before the runtime builds its source. The route then decides the
screen: `/` is the boot router (`src/app/index.tsx:13-17`); without `?motion=` it renders `BootRedirect`
(`:16`), whose target is `useBootHref()` (`navigation/root-navigator.tsx:97-110`): `/pair` while the pairing
gate blocks (`:103`, LIVE and not PAIRED), else `/login` while signed out (`:104`). A paired, signed-out
phone therefore gets `/login` — what W60 recorded with `demsdemo:///?core=LIVE`
(`implementation/assets/60_device_w60f.sh:23`, `60_device_run_signin.log:24`).

**Why the phone reached Stack Check.** W67's first device attempt launched
`demsdemo:///?core=LIVE&motion=off` (`implementation/assets/67_device_attempt1_run.log:23`). On `/`,
`src/app/index.tsx:15` reads `if (hasMotionParam(params)) return <StackCheckRoute …/>`, and
`navigation/params.ts:67-70` is true for ANY non-empty `motion` value, `off` included. That is the
designed behaviour (AC-31: `demsdemo://?motion=slow` opens Motion proof mode; `navigation/stack-check-route.tsx:9-12`
"`/` whenever the URL carries `?motion=`"; pinned for `slow` by `navigation/__tests__/guard.test.tsx:150` and
`routes.test.tsx:56`). The `motion=off` test switch of the motion kit is meant for a non-root path
(`motion/policy.test.tsx:164`, `:235`: `demsdemo:///home?motion=off`; on a guarded path the switch is
dropped from the pending href, `navigation/params.ts:77`). W67's second run used
`demsdemo:///login?core=LIVE&motion=off` (`67_device_w67.sh.txt:23`, `67_device_run.log:23`) and reached
Login. So the F-3 difference is the second query parameter on the root path, not LIVE mode, the pairing
gate or a regression of W60.

**Defect?** Not in the code. It is a device-procedure trap. Smallest fix: a procedure rule for every row
that drives the phone or tablet — never launch `/` with `motion=`; launch `demsdemo:///login?core=LIVE&motion=off`
(or the target route) — owner: the controller (in the page-row briefs, §8's last sentence). A code
alternative (owner W60 / the shell, `src/app/index.tsx:15`: treat `motion=off` as the global switch rather
than a proof-screen request) is **not recommended**: it changes a documented route of AC-31 for a test
convenience.

## 7. The one-line change for W78's copy

Replace the whole content of `apps/mobile/src/features/devices/use-pending-press.ts` (today byte-identical
to W67's former hook, SHA-256 `a1a38ac8249d7bda524ab84829d4ce8379a8a04a59a13b8d352e61ad59bee05f`) with:

```ts
export { usePendingPress, type PendingPress } from '@/runtime'; // The one hook lives in the runtime (row M1, D157 DN-7).
```

The callers (`device-detail.tsx:71`, `device-command-dialog.tsx:33`) need no change. The comment of
`features/devices/busy-state.ts:6-7` ("stays byte-equal … until one copy moves into `@/runtime` (row M1)")
then describes the past; W78 may reword it. **Proven without touching `features/devices/**`**
(`assets/09b_m1_w78_line.log`, 00:22): W78's 4 suites / 51 tests pass with the copy as it is AND with the
copy replaced by this line in memory (the M15 transformer); a sanity replacement that throws makes 22 of
22 tests of `live-devices-sites.test.tsx` fail, so the replaced copy is the one loaded; the file's SHA-256
was identical before and after. W78's static test reads the disk, so it was checked by reading its rules
against the line: the folder's file list keeps `use-pending-press.ts` (`devices-live-static.test.ts:73`),
the line names no forbidden module, timer or clock (`:108-121`), and imports through the barrel, not
`@/runtime/…` (`:123`).

## 8. What the mobile page rows W68–W82 must call (paste into their briefs; supersedes M0's §10 paragraph)

> **Core link notice and pending controls (rows M0 + M1; D151, D157, D159).** A screen that says "Core
> server unreachable" takes the runtime's one rule in ONE call and writes none of its own:
> `const { view, offline } = useCoreLinkNotice();` (from `@/runtime`). `offline` shows at the first OFFLINE
> or STALE, hides at the first ONLINE, CONNECTING and RESYNCING keep it, and a screen first opened while the
> socket reconnects after an outage shows it from its first render (seeded from the app's connection
> banner); a cold start flashes nothing. Outside LIVE `view` is `none` and `offline` is false, so no
> `live &&` gate is needed. To word the link (a chip, a disabled control) read `view`
> (`'up' | 'settling' | 'down' | 'none'`), never the raw states, never `useCoreLink().state` and never a
> bare `heartbeat`; never a ref plus an effect, a `setTimeout` or a hold time; a 429 is not a link state
> (LB-10), so never feed a refusal, its `kind` or its `outage` to it. M0's five-line snippet is retired for
> new code; only a screen that must follow another input than `useCoreLink()` keeps it, with
> `const banner = useConnectionBanner().kind;` and `useState(() => initialOfflineNotice(view, banner))` as
> its first state. `runtime/link-notice-static.test.ts` still fails the workspace if a file under
> `features/` names CONNECTING or RESYNCING, puts STALE in a `case`, or writes OFFLINE and STALE in one
> expression. **A control that sends a Core command** takes `const press = usePendingPress();` from
> `@/runtime` — never a copy of the hook — and calls
> `press.run((release) => settle(() => actions.x(), { done: release, fail: … }))`; it spreads
> `accessibilityState: { busy: true }` only while `press.busy` and shows the kit's `Spinner` in place of its
> icon only while `press.pending` (the reveal delay on the store's clock: no spinner for a fast answer). A
> confirm in navigation's `BackGuardDialog` passes `busy={press.pending}`. Import through `@/runtime` and
> `@/navigation` only. Device checks never launch `/` with `motion=` (that opens Stack Check, AC-31):
> launch `demsdemo:///login?core=LIVE&motion=off` or the target route.

## 9. Verification (commands from the repo root; `assets/09b_m1_final_gate.log`)

```
## 2026-10-06 00:18:50 WIB  0:18  2 users, load averages: 2.85 3.16 4.25
## $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 114 passed, 114 total
Tests:       1431 passed, 1431 total
Time:        63.392 s
exit=0
## 00:20:13 $ npm run typecheck -w @dems/mobile
exit=0
## 00:20:17 $ npm run lint -w @dems/mobile
exit=0
eslint json: files 496 errors 0 warnings 0
baseline 72 vs acaff20 (lines of git diff --stat): 0
W60 navigation tests + harness vs b90a3c6 (lines of git diff --stat): 0
58 test files recorded at 23:57: 58 OK, 0 not OK
```

- **Ledger.** 110 suites / 1,395 tests at 23:50 + this row's 4 new suites / 35 tests (8 + 15 + 6 + 6) =
  114 / 1,430. The one further test is in W74's in-flight `features/evidence/live-evidence-export.test.tsx`
  (modified 23:56, after the ledger); not this row's. No red file at any run of this row.
- `uptime` was read before the whole suite (1-minute load 2.85) and before every batch (2.0–6.8; never at 10).
- The 58 test files hashed before the first edit cover every existing test file of `features/session-new`,
  `navigation`, `features/more`, `features/dashboard`, `features/pairing`, `features/login` and `runtime`.
- Files changed in the tree since the first edit (00:21 listing): exactly this row's 15 files; besides them
  only `packages/shared/src/i18n/en/session.ts` (00:17:55) and `devices.ts` (00:20:26), written by the
  parallel rows. The whole suite ran 00:18:50–00:19:54, after the first and before the second.
- The jest message "A worker process has failed to exit gracefully" appears once in the whole-suite run; it
  predates this row (M0 §9 observation).

### Mutation run (rule M15: nothing in the tree was modified; `assets/09b_m1_mutations.log`)

M0's method: a jest transformer outside the tree (`.cache/m1/mut/`, copied to `assets/09b_m1_*`) applies one
mutant's edits **in memory** to one production file before the app's own babel-jest; each mutant runs the
test files of its group; detected = jest exit ≠ 0; the SHA-256 of the eight mutated files was compared
before and after every batch (identical each time).

```
control (no mutation, 7 test files): exit=0 Tests:       73 passed, 73 total (17 s)
## 11 detected, 1 not detected, 0 not applied, of 12          (group H, 00:16:53–00:17:36)
## 19 detected, 0 not detected, 0 not applied, of 19          (groups S, B, T, 00:17:41–00:18:38)
## the mutated files in the tree, before and after: identical
```

| Group | Mutants | Detected | Tests that fail |
|---|---|--:|---|
| **H — press guard** | H1 guard removed; H2 in-flight flag never set; H3 release keeps the flag; H4 a throwing start not released; H5 a settled command still sets state; H6 busy never reported | 6 / 6 | `use-pending-press.test.tsx` all; H1, H2, H6 also W67's `live-session-new-handoff.test.tsx`. H3, H4, H5 are caught ONLY by the new unit test |
| **H — reveal delay** | H7 delay 0; H8 delay halved; H9 delay + 100 ms; H10 the press stamped with the wall clock; H11 pending while idle | 5 / 5 | both files |
| H12 `>=` → `>` | 1 | 0 / 1 — **equivalent**: the store clock moves in 100 ms steps (`engine.ts:115`), so the difference is a multiple of 100 and never equals 420 | — |
| **S — seeded first render** | S1 seed ignores the banner (F-1 back); S2 banner offline shows whatever the view; S3 always seeded shown; S4 `resynced` counts as lost; S5 the hook starts from "not shown"; S6 re-seeds at every view change; S7 the banner not read; S8 a not-LIVE view handed back as up; S9 W66's chip unseeded again | 9 / 9 | `use-core-link-notice.test.tsx`; S3 also W66's chip test |
| **B — busy prop** | B1 press not ignored; B2 no spinner; B3 no busy state; B4 default busy; B5 W67 passes the in-flight state (spinner at the press); B6 W67 passes nothing | 6 / 6 | `back-guard-busy.test.tsx`, `live-session-new-followups.test.tsx` |
| **T — copy** | T1, T2 LIVE keeps a "(simulated)" string; T3, T4 SIMULATED takes a Live string | 4 / 4 | `live-session-new-followups.test.tsx` |
| **Total** | 31 | **30 / 31** (the survivor equivalent) | |

## 10. Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| **DN-1** | Item 2's shape: the seed is a pure `initialOfflineNotice(link, banner)` in `link-notice.ts`, and screens take ONE call, `useCoreLinkNotice()` → `{ view, offline }`; M0's snippet is retired for new code (§8 supersedes M0's §10 paragraph) | Ratify; put §8 into W68–W82's briefs |
| **DN-2** | W66's chip keeps M0's snippet text and only its first state is seeded (3 lines), because W66's gated static test pins `coreLinkViewOf(link)` and `offlineNoticeAfter(offline, view)` (`home-more-live-static.test.ts:134-137`). When that test is next opened, the chip can take `const { offline } = useCoreLinkNotice();` and the two regexes become `/useCoreLinkNotice\(\)/` | Ratify; route the switch to W66's carry list (optional) |
| **DN-3** | Pair and Login are NOT changed: not needed — Login's Sign In is already disabled while the link is not ONLINE (`use-login-controller.ts:103` `isCoreBlocked`), so only its Alert would come up to one reconnect step earlier; the Pair screen follows the Live link (M0 DN-4) and is reached at boot (banner hidden) or after a revocation sent over a live link. If wanted (W57 / W59 carry list or W100): Login `use-login-controller.ts:111` `useState(() => live && liveOfflineNoticeAfter(false, linkHeartbeat))` → `useState(() => live && initialOfflineNotice(linkHeartbeat, banner))` plus `const banner = useConnectionBanner().kind;` and the two names in its `@/runtime` import (`:37`); Pair `use-pairing-flow.ts:159` `useState(() => offlineNoticeAfter(false, liveLink))` → `useState(() => initialOfflineNotice(liveLink, banner))` plus the same two lines (`@/runtime` import ends at `:45`). Their tests would stay green (they mount at a cold start) | Keep unchanged for the demo |
| **DN-4** | Item 3 as granted (one `busy` prop): W67 passes `cancelPress.pending`, so on this one control the accessibility busy state appears with the spinner (500 ms on the store clock), not at the press as LB-1 words it; a second press is ignored from the press anyway (the hook's in-flight flag, mutants H1/H2). Full LB-1 parity needs a second prop (`pending` for the spinner, `busy` for the state) — an interface change, not made | Accept for the demo; or a later W60 slot |
| **DN-5** | Item 4 Live words are feature-local (`features.session-new.live.speakToTest`, `.scanCaseNumber`); the shared strings stay. For the web (W64 shows the same two strings in LIVE): `sessionNew.devices.speakToTest` = "Speak to test (simulated)" (`packages/shared/src/i18n/en/session-new.ts:94`) and `sessionNew.info.caseNumber.scan` = "Scan case number (simulated)" (`:32`). If both clients should share the Live words, a shared-copy slot adds `sessionNew.live.speakToTest` = "Microphone levels from the Core server" and `sessionNew.live.scanCaseNumber` = "Fill in the next case number", and the two mobile keys move there | Decide; the mobile change stands either way |
| **DN-6** | Barrel header (comment only): module rows `:23-24`, surface row `:36` (pending hook), and the existing surface row `:34` now names `useCoreLinkNotice()` instead of M0's expression — otherwise the barrel would teach the retired snippet | Ratify (as M0's DN-3) |
| **DN-7** | Item 5: no code change; the device rule of §8's last sentence goes into every brief that drives a phone or tablet | Ratify |

Observations, not this row's to fix:

- **The cancel confirm's "Stay" while a cancel is out** (W67, Info): `busy` holds only the leave button, as
  granted. A "Keep session" tap (or dismissing the dialog) while the cancel request is out closes the
  dialog; when the Core then cancels, `cancelAndLeave` calls `back.guard.leave()`
  (`session-new-screen.tsx:346`) with no held action (`back-guard.tsx:83-86`), so the wizard stays while the
  session was cancelled on the Core. The Pair screen's unpair dialog holds both buttons and ignores dismissal
  while busy (`features/pairing/unpair-dialog.tsx:31`, `:38`, `:41`). A design question for W67's carry list
  or W100: should `busy` also hold "Stay" and the dismissal?
- **A third small copy class** (Info): `busyState(busy, disabled)` and the in-button spinner exist in
  `features/session-new/session-new-screen.tsx:648-655` and W78's `features/devices/busy-state.ts:9-11` (same
  body). With the hook in the runtime, the page rows will need the same two lines; a candidate for a later
  consolidation slot (runtime or `components/kit`) after W78 gates.
- One existing comment now describes the past: `features/devices/busy-state.ts:6-7` (W78's file, §7).

## 11. Rollback (not executed)

Pre-images with their SHA-256 in `.cache/rollback/M1/` (`pre.sha256`, 9 files, 23:57):

1. Copy back `apps_mobile_src_runtime_index.ts`, `apps_mobile_src_runtime_link-notice.ts`,
   `apps_mobile_src_features_session-new_use-pending-press.ts`, `…_session-new-screen.tsx`,
   `…_device-previews.tsx`, `…_session-info-step.tsx`, `…_i18n.ts`,
   `apps_mobile_src_features_more_use-core-link-chip.ts`, `apps_mobile_src_navigation_back-guard.tsx` over
   their originals (each name is its path with `/` → `_`).
2. Remove the six new files: `runtime/use-pending-press.ts`, `runtime/use-pending-press.test.tsx`,
   `runtime/use-core-link-notice.ts`, `runtime/use-core-link-notice.test.tsx`,
   `navigation/__tests__/back-guard-busy.test.tsx`, `features/session-new/live-session-new-followups.test.tsx`.
3. Re-run the mobile suite: it returns to the ledger without this row's 4 suites / 35 tests.

(`link-notice.ts`, `use-core-link-chip.ts` and W67's files are not committed yet, so `git checkout` cannot
restore them; the pre-images can.)

## 12. Footprint and limits

- Written in the tree: the 9 edited and 6 new files above. Documents: this report, its seven assets,
  `delegation_progress/coder_execution_m1.md`. Scratch only under `.cache/m1/` and `.cache/rollback/M1/`.
  Not touched: `features/devices/**`, `features/evidence/**`, the 72 baseline test files, W60's tests,
  `auth/**`, `src/app/**`, `jest.setup.ts`, `package.json`, `app.json`, `scripts/**`, `packages/shared/**`,
  `apps/core-web/**`, `apps/core-server/**`. No git write, no Docker, no emulator, no port.
- **One process slip** (P10): at about 23:58 one read-only listing command ended with
  `cd /Users/gsp-budi/Documents/DEMS 2>/dev/null; true`. It changed nothing (every command starts in a fresh
  shell) and was not repeated.
- No device check (none needed by the brief). The F-1 fix is proven on the real Live source in jest, not on
  the phone; item 5 is explained from the code and the recorded device logs, not re-run.

---

## Follow-up (decision D164)

**Time**: 2026-10-06 00:29–00:56 WIB. **Status**: **complete**. W78 gated, so `features/devices/**` was this
row's for these items. Pre-images in `.cache/rollback/M1b/` (`pre.sha256`, 18 files). Assets:
`assets/09b_m1b_final_gate.log`, `09b_m1b_cancel_red_green.log` (probe, red before, green after, the probe
file), `09b_m1b_mutations.log`, `09b_m1b_mutate.py.txt`, `09b_m1b_w68_seed_revert.log`, `09b_m1b_changes.diff.txt`.
`usePendingPress` and `useCoreLinkNotice` are untouched: names, signatures and code (the parallel rows
import both).

### F.1 Outcome per item

| # | Item | Outcome | Evidence |
|---|---|---|---|
| F1 | W78's hook copy | **Done**: `features/devices/use-pending-press.ts` is the proven one line (§7). W78's four suites unchanged and green | 00:30: devices 4 suites + the hook test = 5 / 59, exit 0 |
| F2 | One busy-state / in-button spinner helper | **Done**, in `@/runtime` beside the hook (`runtime/pending-control.tsx`, 43 lines: `busyState`, `PendingSpinner`). Both callers point at it; `features/devices/busy-state.ts` is a one-line re-export; Start Session's two local copies are removed (they lived inside the screen file), and the third inline copy in `devices-check-step.tsx` is replaced too | 00:34: 21 suites / 290, exit 0; new test 8 |
| F3 | W78's LIVE health caption (D160) | **Done**: LIVE reads "Derived on this device from the Core's data · last N samples"; SIMULATED unchanged | 00:38: devices 5 suites / 56, exit 0; new test 5 |
| F4 | DN-4: busy at the PRESS, spinner late | **Done**: `BackGuardDialog` `busy` = from the press, new `pending` = the spinner (defaults to `busy`, so a caller of the first form keeps its behaviour); W67 passes both | 00:41: 16 suites / 234, exit 0; own tests extended |
| F5 | "Keep session" during an in-flight cancel | **Done, and my finding is corrected** (F.6): the wizard did NOT stay on a cancelled session. The real defect, "Keep session" closes the dialog while the cancel is out, is reproduced red before and green after | 00:42:00 red (3 / 3), 00:42:39 green |
| Final | Suite, typecheck, lint, mutation run | Second whole run **127 suites / 1,564 tests, 1,559 passed**: the 2 red files are the parallel rows' (F.8), each explained; typecheck: **one error, in W72's in-flight file**, 0 outside the parallel rows; lint exit 0, eslint JSON 515 files **0 / 0**; 72 baseline and W60's tests unchanged; **mutations 18 of 18 on the final code** (first pass 17 / 19, the two survivors acted on) | F.8, F.7 |

### F.2 F2: where the helper lives, and the callers

**Home: `@/runtime`, not `components/kit`.** The kit is the demo task's fixed recipe set
(`components/kit/index.ts:1-2`, "tokens and className on HeroUI Native parts, not new primitives (D6)";
04_mobile_specs §4.0; unchanged since `acaff20`, and `kit.test.tsx` is one of the 72 baseline files). Adding
a sixth recipe would change a specified surface. This pair is the presentation of a runtime rule (LB-1)
and is only ever used together with `usePendingPress`, so it sits beside the hook and page rows import
both from `@/runtime`. The runtime already exports components (`SimRuntimeProvider`, `KeepAwakeController`,
`SessionRouteSync`).

| File | Before | After |
|---|---|---|
| `runtime/pending-control.tsx` (new) | — | `busyState(busy, disabled = false)` (nothing while idle) and `PendingSpinner({ color?, testID? })` (the kit's `Spinner size="sm"`; no colour prop when none is given, so the kit's default stays) |
| `runtime/index.ts` | — | `:208` `export { PendingSpinner, busyState, type PendingSpinnerProps } from './pending-control';`, module row `:25`, surface row `:37` now names both helpers (comment) |
| `features/session-new/session-new-screen.tsx` | local `busyState` (`:648-650`) and `PendingSpinner` (`:653-655`, default colour black) | removed; `:65` imports both from `@/runtime`; the two Next spinners pass `color={palette.black}` (`:371`, `:379`), so they render as before |
| `features/session-new/devices-check-step.tsx` | inline `{...(retryBusy ? { accessibilityState: { busy: true, disabled: false } } : {})}` and `<Spinner size="sm" …>` (`:170-172`) | `:171` `{...busyState(retryBusy)}`, `:173` `<PendingSpinner testID="session-new-retry-spinner" />` (same props) |
| `features/devices/device-detail.tsx`, `device-command-dialog.tsx`, `diagnostics-sheet.tsx` | `import { busyState } from './busy-state'` and an inline `<Spinner size="sm" color=… testID=… />` each | `@/runtime` imports (`:52`, `:31`, `:28`); `<PendingSpinner color=… testID=… />` (`:282`, `:125`, `:110`); the now-unused `Spinner` imports dropped from the first two (`diagnostics-sheet.tsx` keeps it for its check rows) |
| `features/devices/busy-state.ts` | the helper (W78) | one line: `export { busyState } from '@/runtime'; // …` (W78's static file list keeps it) |

`runtime/pending-control.test.tsx` (8): `busyState` idle / busy / disabled; `PendingSpinner` is the kit's
`Spinner` with the given props and no colour prop by default; identity through the barrel and through
W78's former file; the three former files are one-line re-exports; neither caller folder defines a copy,
writes the busy state inline or puts the kit `Spinner` behind a pending flag (with positive controls of
the matchers); every user imports from the barrel. Not changed (another row's folder):
`features/pairing/unpair-dialog.tsx:41` writes the busy state inline (W57; Info).

### F.3 F3: the LIVE health caption

The Core serves no per-device health history (`CONTRACT-GAP-W78-2`, `implementation/78_mobile_devices.md:104`).
In LIVE the line is computed on the device from the Core's data: cameras and the tablet from its network
history, the PoE switch from its PoE draw on that timeline, the lamp from its session state
(`features/devices/sim-adapter.ts:117-167`), a microphone from 1 s peaks of its meter frames. One wording
is true for all four metrics, so only the VALUE of the existing keys changed:

| File | Before | After |
|---|---|---|
| `features/devices/i18n.ts:99-102` | `samples_one: '{{count}} sample'`, `samples_other: 'Last {{count}} samples'` | `"Derived on this device from the Core's data · {{count}} sample"`, `"… · last {{count}} samples"` (with a comment naming the gap) |
| `features/devices/health-chart.tsx:8-14` | header comment | says why the LIVE caption says "derived" (no code change) |
| `features/devices/live-devices-sites.test.tsx:368-369` (W78's) | `/^(?:Last \d+ samples|Collecting samples…)$/` | `/^(?:Derived on this device from the Core's data · last \d+ samples|Collecting samples…)$/` — **the one assertion of a gated test changed, by design**: it pinned the old wording |

Why a value change and not new keys: W78's static test pins the LIVE key count (`devices-live-static.test.ts`,
11 leaves) and a digest of every non-LIVE text (44), so any new key would have changed a second gated
assertion. Both stay green. New test `features/devices/live-devices-health-caption.test.tsx` (5): the LIVE
texts; the chart caption for every metric in LIVE and SIMULATED; the real LIVE screen (W78's bed) for a
camera, the tablet, the PoE switch, the lamp and a microphone (the bed sends no meter frames, so the
microphone may still be collecting), with no text claiming a simulation; the Simulated camera screen
unchanged. For the web (W70 shows "Last N samples" from the shared `devices.live.samples`,
`packages/shared/src/i18n/en/devices.ts:330-331`), see DN-F2.

### F.4 F4: DN-4, busy at the press

| `navigation/back-guard.tsx` (after) | What |
|---|---|
| `:110-117` `busy?: boolean` | from the PRESS until settled: `{...busyState(busy)}` on the leave button (`:149`), a further press ignored (`:144`), and the dialog holds (F5) |
| `:118-123` `pending?: boolean` | the kit's spinner inside the leave button (`:151`, `PendingSpinner`) |
| `:127` `busy = false, pending = busy` | a caller of the first form (`busy` only) keeps exactly its behaviour |
| `features/session-new/session-new-screen.tsx:514` | `busy={cancelPress.busy} pending={cancelPress.pending}` |

W60's tests: `git diff --stat b90a3c6 -- navigation/__tests__ navigation/testing` empty. My own test file
grew from 6 to 11 tests: busy without pending (state, no spinner, press ignored), busy + pending
(spinner, nothing added outside), pending alone, pending omitted (follows busy), plus F5's two. The
end-to-end cancel test now expects the busy state at the press and at 300 ms, the spinner only at 500 ms.

### F.5 F5: the rule, the fix, red and green

**The cancel rule** (`masterplan/04_client_integration_spec.md`): B-6 (`:758`) "Cancel: the dialog's confirm
is busy; leaving happens in `ok`"; S3-1 (`:817`) "The dialog keeps its busy state until the settle, shows the
success toast in `ok` and the danger toast in `fail`, and closes in `done`"; LB-6 (`:725`) on an outage "a
dialog or drawer stays open". So while the cancel is out, nothing but the Core's answer may close the dialog:
**"Keep session" is disabled**, and on success the wizard leaves (which it already did, F.6).

**The fix** (the button lives in navigation's dialog, so it lands there, in the file F4 owns; Start
Session's part is the call at `:514`): `navigation/back-guard.tsx:131` the dialog ignores a dismissal while
`busy`; `:137` the stay button is `isDisabled` while `busy` (spread only then, so the default dialog is
unchanged). A first version also ignored the press in the handler; the mutation run showed that guard was
dead code behind the disabled flag (survivor C1), so it was removed.

**Red before** (00:42:00, `assets/09b_m1b_cancel_red_green.log`), three Live tests on the real Live source
in `features/session-new/live-session-new-followups.test.tsx`: a confirmed cancel (delta-first,
answer-first) and a refused cancel (403, 1 s late). Each pressed "Cancel session", then "Keep session":

```
✕ a confirmed cancel (delta-first): "Keep session" is disabled and does not close the dialog while the cancel is out; …
✕ a confirmed cancel (answer-first): …
✕ a refused cancel (403, 1 s late): …
    expect(received).not.toBeNull()      Received: null      (the dialog was gone)
Tests:       3 failed, 6 passed, 9 total
```

**Green after** (00:42:39): Start Session + navigation 15 suites / 230 tests, exit 0. On a confirmed cancel
the dialog stays with "Keep session" disabled until the Core answers, then the wizard leaves for `/home`
with one cancel sent. On a refusal the denied toast shows, the dialog stays, "Keep session" is enabled
again and then keeps the session (ARMED). SIMULATED is unchanged: its cancel settles before the press
returns, so `busy` is never set.

### F.6 My finding was wrong in one point (correction)

§10's observation said the wizard "stays while the session was cancelled on the Core". A probe on the real
Live source (00:38:55, both arrival orders; `assets/09b_m1b_cancel_red_green.log`) shows otherwise: after
"Keep session", the cancel's answer still navigates to `/home`, because `cancelAndLeave`'s continuation holds
the `back.guard.leave` of the render at the press, which still knows the held action (`flow-guard.tsx:57-63`,
`navigation/back-guard.tsx` `leave`). The defect is the dialog closing on "Keep session" while the cancel
is out: the operator sees the session kept, and about 1 s later the screen leaves anyway. That is what
F5 fixed. The probe was a scratch test file in the tree for under a minute (00:38–00:39); it was moved to
`.cache/m1b/m1b-probe-keep.test.tsx.txt` (deviation: a scratch file in the tree, not deleted, now outside it).

### F.7 Mutation run (rule M15, in memory; `assets/09b_m1b_mutations.log`)

```
control (no mutation, 6 test files): exit=0 Tests: 61 passed, 61 total            (00:43:41)
## 17 detected, 2 not detected, 0 not applied, of 19                              (first pass)
control (no mutation, 6 test files): exit=0 Tests: 62 passed, 62 total            (00:45:56, after the two fixes)
## 9 detected, 0 not detected, 0 not applied, of 9                                (group C again)
## the mutated files in the tree, before and after: identical                    (each batch)
```

| Group | Mutants | Detected (final code) |
|---|---|--:|
| P — the helper | P1 idle marked busy; P2 disabled flag dropped; P3 never busy; P4 colour dropped; P5 size md; P6 test ID dropped; P7 a colour forced | 7 / 7 (P1, P3, P6 also by W67's and W78's own Live tests) |
| C — the dialog hold (F5) and the second prop (F4) | C2 Stay not disabled; C3 dismissal allowed while busy; C4 Stay always disabled; C5 `pending` default false; C6 spinner follows busy; C7 busy state follows pending (DN-4 undone); C8 leave press not ignored; C9 W67 passes the first form; C10 W67 passes only `pending` | 9 / 9 |
| D — the LIVE caption | D1 "Last N samples" again; D2 the Simulated key in LIVE | 2 / 2 |
| **Total** | | **18 / 18** |

The first pass had two survivors, both acted on: **C1** (Stay's press not ignored in the handler)
survived because the disabled flag already stops the press, so the handler guard was dead code and was
removed; **C3** (dismissal while busy) survived because no test dismissed the dialog, so a test now
requests a dismissal through the kit's `onOpenChange(false)`.

### F.8 Verification (`assets/09b_m1b_final_gate.log`)

```
## 2026-10-06 00:49:4x  load 4.68
## second whole run: npm run test -w @dems/mobile -- --maxWorkers=2
FAIL src/features/session-live/live-session-live-link.test.tsx      (W68, in flight)
FAIL src/features/sessions/live-sessions.test.tsx                   (W72, in flight)
Test Suites: 2 failed, 125 passed, 127 total
Tests:       5 failed, 1559 passed, 1564 total
## re-check 00:52:23: live-sessions PASS; live-session-live-link FAIL (2 tests)
## W68's file with the M1 seed reverted IN MEMORY (00:53): the same 2 tests fail -> not caused by M1
$ npm run typecheck -w @dems/mobile   exit=2: one error, src/features/session-summary/testing/live-summary-bed.tsx(36,28) (W72, in flight); errors outside the parallel rows: 0
$ npm run lint -w @dems/mobile        exit=0; eslint json: files 515 errors 0 warnings 0
baseline 72 vs acaff20: 0     W60 navigation tests + harness vs b90a3c6: 0
142 test files hashed at 00:29: 139 OK, 3 changed = live-devices-sites.test.tsx (F3, by design), back-guard-busy.test.tsx and live-session-new-followups.test.tsx (this row's)
```

- **Red files, not this row's.** First whole run (00:46:5x–00:48:36, 123 / 1,526): W68's
  `live-session-live-sites.test.tsx` and W80's `live-audit-screen.test.tsx`, both rewritten during the run
  (00:47:41, 00:47:23), both PASS on the re-check at 00:48:55 (19 / 19). Second run: W72's
  `live-sessions.test.tsx` (PASS on re-check) and W68's `live-session-live-link.test.tsx`. W68's file still
  fails 2 tests: "Simulated mode is unchanged › a snapshot …" and "link lost … link back: 'Resynced'", whose
  assertion is the monitor's offline banner. That banner is drawn from `useConnectionBanner()`
  (`session-live/connection-banner.tsx:17-21`), and `runtime/connection-banner.ts`, `runtime/sim-runtime-provider.tsx`
  and that file are byte-equal to `b90a3c6`. With my seed reverted in memory the same 2 tests fail
  (`assets/09b_m1b_w68_seed_revert.log`). Owner: W68.
- **Ledger.** This round adds 2 suites (`runtime/pending-control.test.tsx` 8, `features/devices/live-devices-health-caption.test.tsx` 5)
  and 8 tests in my existing files (back-guard-busy +5, followups +3): **+2 suites / +21 tests** over M1's 114 / 1,431.
  The other new suites of the second run belong to W68, W72, W79 and W80.
- **Footprint since 00:29** (listing of every changed file outside the parallel rows' folders): exactly
  this round's 17 files (14 edited, 3 new).

### F.9 Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| **DN-F1** | F2's home is `@/runtime` (beside the hook), not the kit (reason in F.2) | Ratify |
| **DN-F2** | F3 is a value change of `features.devices.live.samples_*`, one wording true for every metric, plus the one W78 assertion that pinned the old wording. The web's `devices.live.samples` (`packages/shared/src/i18n/en/devices.ts:330-331`) says "Last N samples" for the same derived line | Ratify; the web caption to W83 with DN-5 |
| **DN-F3** | F4 keeps the first form compatible (`pending` defaults to `busy`) | Ratify |
| **DN-F4** | F5's fix is in navigation's dialog (where the button is) and the dialog now holds while `busy`: Stay disabled, dismissal ignored, per B-6 / S3-1 / LB-6. The correction of my finding is in F.6 | Ratify |
| **DN-F5** | The W68 file that stays red (`live-session-live-link.test.tsx`) fails without M1's seed as well; for W68 | Note to W68 |

### F.10 The paragraph for the page rows: changed (replaces §8's last three sentences, from "**A control that sends a Core command**")

> **A control that sends a Core command** takes `const press = usePendingPress();` from `@/runtime` — never a
> copy of the hook or of its two helpers — and calls
> `press.run((release) => settle(() => actions.x(), { done: release, fail: … }))`; on the control it spreads
> `{...busyState(press.busy)}` (with its disabled flag as the second argument if it has one) and inside it
> shows `{press.pending ? <PendingSpinner color={…} testID="…-spinner" /> : icon}`, both from `@/runtime`
> (the reveal delay on the store's clock: no spinner for a fast answer). A confirm in navigation's
> `BackGuardDialog` passes `busy={press.busy} pending={press.pending}`: busy at the press, the spinner late,
> and the dialog holds until the Core answers (its stay button disabled, no dismissal); a dialog of your own
> does the same (S3-1: it keeps its busy state until the settle and closes in `done`). Import through
> `@/runtime` and `@/navigation` only. Device checks never launch `/` with `motion=` (that opens Stack Check,
> AC-31): launch `demsdemo:///login?core=LIVE&motion=off` or the target route; never `uiautomator dump` on
> Login, Summary or Home (D164 DN-7).

### F.11 Rollback (not executed)

Copy back the 18 pre-images of `.cache/rollback/M1b/` (names are paths with `/` → `_`; `pre.sha256`) and
remove the three new files (`runtime/pending-control.tsx`, `runtime/pending-control.test.tsx`,
`features/devices/live-devices-health-caption.test.tsx`). The tree returns to M1's gated state (D164).

---

## Follow-up 2: the stale-session resync (decision D169)

**Time**: 2026-10-06 01:25–01:38 WIB (verification shared with follow-up 3, 01:48–01:53). **Status**:
**complete, with a different cause than the brief's**. Finding F-2 of row W72. Pre-images in
`.cache/rollback/M1c/` (`pre.sha256`). Assets: `assets/09b_m1c_d169_red_green.log`, `09b_m1c_mutations.log`,
`09b_m1c_mutate_d169.py.txt`, `09b_m1c_changes.diff.txt`, `09b_m1c_final_gate.log`.

### 2.1 The cause, measured

| Step | What was seen | Evidence |
|---|---|---|
| Reproduction, red before (01:25:44) | W72's case on the app's real Live source (W66's gated bed; a sealed, pending X; outage; on the Core X acknowledged and Y sealed and pending; link back): the route sync opened `/session/summary/SES-20261001-0024` (X) instead of `…-0025` (Y) | `09b_m1c_d169_red_green.log` |
| W72's proposed fix (read the store at the signal) | **still red**, the same diff | same |
| Probe at the signal | the store still held X; `getAuthSession` was in flight; the store switched to Y right after the signal, before React rendered | same |

On every LIVE reconnect the new OPERATOR socket makes the Live source confirm the session first
(CPC1-35, `revalidateSession`, `packages/shared/src/live/source/live-sim.ts:1479-1524`). It holds every
state message until the Core answers (`holdForSession`, `:789-793`). The socket client reports `RESYNCED`
as soon as it has handed the snapshot over (`live-socket-client.ts:953-957`), so before it is applied.
`adoptSession` then applies the held snapshot (`releaseSessionHold()`, `live-sim.ts:1416`) and only after
that notifies the Live listeners with a new `session` object (`notifyLive()`, `:1419`). At `RESYNCED`
neither the rendered session nor the store holds the snapshot yet. Reading either one opens the screen
from before the outage.

### 2.2 The fix (two files in `runtime/`; the barrel's exports unchanged)

| File | Before | After |
|---|---|---|
| `runtime/live-resync-watch.ts` (new, 70 lines) | — | `watchLiveResync(live)` reads only the Live source's public members (`link`, `session`, `socketStatus().connection`, `onLiveChange`). It remembers the session object and socket when the link is lost. `whenSynced(run)` runs at once when nothing is pending (no outage seen, the link back on the same socket, or the session already confirmed or ended); otherwise it runs at the confirmation, i.e. the first `onLiveChange` with another `session` object, when the store holds the snapshot. No clock, no timer |
| `runtime/session-route-sync.tsx:72` | `useEffect(() => bus?.subscribe(() => resync('heartbeat', latest.current)), [bus, resync]);` | `:86-106`. In LIVE (`liveOf(sim)`) the bus callback runs `watch.whenSynced(() => resync('heartbeat', { session: selectActiveSessionInfo(sim.store.getState()), pathname: latest.current.pathname }))`, the selector the runtime's contract renders the session with (`sim-runtime-provider.tsx:410`, `LiveBridge`). On a simulator the callback is unchanged (`latest.current`). The effect is keyed on `[bus, sim]` with `resync` read through a ref (`:87-90`): keyed on `resync`, the watch was re-created on renders during the outage and forgot it (a probe showed it; mutant R4 pins it). Header `:18-24` |
| `runtime/session-route-sync.tsx:34` | `const bus = useRuntimeInternals()?.resyncBus ?? null;` | `:45-47` also takes `sim` from the same internals |

The transition trigger (`isForcedTransition`) and the mount behaviour are untouched.
`runtime/session-route-sync.test.tsx` and `route-sync.test.ts` are unchanged (hash) and green. Their
fake-contract cases run on a plain simulator, so they keep the old path; mutant R3 shows they would
fail if the LIVE path applied there.

### 2.3 The test (`runtime/session-route-sync-live.test.tsx`, 10 tests)

| Group | What it proves |
|---|---|
| Live reconnect (3, real Live source) | W72's case: only `/session/summary/<Y>`, never X's (red before, green after); a reconnect on the pending summary navigates nowhere; a recording with the operator elsewhere opens `/session/live` once after the confirmation (the old behaviour kept) |
| The watch on a fake Live source (6) | at once without an outage; after an outage on a new socket it waits for another session object and runs once, and a later outage does not run it again; session confirmed before the signal: at once; link back on the same socket (a recovered STALE): at once; session ended while waiting: runs; a newer call replaces an owed one; `dispose` drops it and unsubscribes |
| Purity (1) | the watch reads no clock and starts no timer |

### 2.4 Mutation run (`09b_m1c_mutations.log`): **11 of 11**

R1 the rendered session again; R2 W72's proposal (store at the signal, no wait); R3 the LIVE path on a
simulator; R4 the watch re-created per `resync`; R5 the outage never remembered; R6 the confirmation not
recognised; R7 the same-socket return not recognised; R8 any socket back counts as synced; R9 always at
once; R10 an owed run not cleared; R11 `dispose` keeps listening. The first pass let R10 through (no test
had a second outage after a settled resync); a test now has it. Control 46 / 46; the files byte-identical
before and after.

## Follow-up 3: the banner after an outage (decision D170)

**Time**: 2026-10-06 01:39–01:53 WIB. **Status**: **complete**; W68's hypothesis confirmed by experiment.
Finding F-1 of row W68. Assets: `assets/09b_m1c_d170_banner.log` (probes before and after, the
isolated mechanism, the scratch probe files), `09b_m1c_mutations.log`, `09b_m1c_mutate_d170.py.txt`.

### 3.1 Reproduction and cause

| Experiment | Result |
|---|---|
| W68's bed, imported read-only by a scratch probe in `runtime/` (moved to `.cache/m1c/` afterwards), the outage without and with a 1.1 s wall-clock wait (01:41:22) | without: `… next(offline,ONLINE/LIVE)=resynced \| for(resynced)`, banner `resynced`; **with: `… resync(offline)=offline \| next(offline,ONLINE/LIVE)=resynced \| for(resynced) \| for(offline)`, banner `offline` with the link `ONLINE/LIVE`** |
| W66's bed + the runtime's own 1 Hz `useAudioAccessibilityValue`, four variants (recording, two meters, meter frames) | none reproduces: the exact trigger depends on what W68's screen schedules |
| **The mechanism in isolation**: a copy of the old hook, the link from an external store through `useSyncExternalStore` (as the heartbeat view arrives), the bus updater, six schedulings (01:42–01:43) | both in one lane, any order: `resynced`; **the bus updater in a lower lane than the render that applies the link change (before or after it): `offline`** |

**Cause (W68's hypothesis, now confirmed).** `useConnectionBannerState` (`sim-runtime-provider.tsx:517-532`
at `b90a3c6`) wrote `kind` in two ways:
- in render: `setKind(nextBannerKind(kind, link))` when the link changed;
- from the resync bus, as a functional updater `setKind(bannerKindAfterResync)`.

The link arrives through `useSyncExternalStore` (a sync update), the bus from a socket callback (a lower
lane). When the bus updater was skipped by the render that applied the link change, React later rebased
it from the older base state and the render-phase `setKind(resynced)` was lost. The final `for(offline)`
comes with no reducer call at all; `resync(offline)` appears first because a functional update is computed
eagerly at dispatch. In W68's run the 1 Hz interval and the wall-clock wait produced that lane split. In
the app the two updates already arrive in different lanes, so it is not a jest artefact.

### 3.2 The fix (one function in `runtime/sim-runtime-provider.tsx`)

| Before (`:517-532`) | After (`:517-547`) |
|---|---|
| `kind` written in render (link) and by two functional updaters from outside the render: the bus (`setKind(bannerKindAfterResync)`) and the "Resynced" timer (`setKind((current) => …)`) | `kind` is written **only in render**, from the kind of that render. The bus and the timer only bump their own counters (`setResyncs`, `setExpiries`, `:540`, `:543`). One render-time step folds every changed input: the link, then a resync, then the end of "Resynced" (only while it is resynced). There is no updater of `kind` left to rebase over a render-phase update. The function is now exported (for its test); the barrel is unchanged |

Same semantics as before for every single input; for inputs arriving together, the fold order gives the
answer the old code gave when nothing was dropped (B6 below shows the order is immaterial). On W68's bed
after the fix (01:43:51), with and without the wait: `… next(offline,ONLINE/LIVE)=resynced | resync(resynced)=resynced | for(resynced)`, banner `resynced`.

### 3.3 The test (`runtime/connection-banner-live.test.tsx`, 9 tests)

| Group | What it proves |
|---|---|
| The scheduling, forced on the REAL hook (6) | the signal in a lower lane than the link change, before or after it: `resynced`, never `offline` after it; both in one lane in either order, with an unrelated update pending: `resynced`; a resync with the link up shows "Resynced"; "Resynced" ending in the same turn as the link drops gives `offline`; a resync never hides an outage |
| End to end on the Live source with the 1 Hz interval (3) | the outage with the runtime's 1 Hz meter interval and a wall-clock wait: once ONLINE, never `offline` again, ends `resynced`; the same without the wait; "Resynced" hides after `RESYNCED_BANNER_MS`, and an outage then turns it `offline` at once |

**Red before**, without editing the tree: mutant B0 puts the hook from `b90a3c6` back in memory and the
committed test fails (2 lane tests). The Live-source tests did not reproduce it on their own (see 3.1),
so they stand as the regression guard the brief asked for.

### 3.4 Mutation run (`09b_m1c_mutations.log`): 6 of 8, both survivors explained

B0 the old hook (red-before), B1 a resync not folded, B2 the end of "Resynced" not folded, B3 the end
hides any kind, B4 the bus writes `kind` again, B5 the link skipped when a resync came too: detected.
Two survivors:
- **B6** (resync folded before the link) is **equivalent**: `nextBannerKind` and `bannerKindAfterResync`
  commute on every combination of kind and link state.
- **B7** (the timer writes `kind` again) **cannot be forced from a test**: its race needs the timer's
  update in a lower lane than the link's render, and React picks a timer callback's lane. The bus path,
  whose lane the test controls, is pinned by B0 and B4.

The first pass also let B1 and B3 through; the two tests added after it catch them.

## Verification of follow-ups 2 and 3 (`assets/09b_m1c_final_gate.log`)

```
## runtime folder after both fixes (01:48:22): Test Suites: 23 passed, 23 total; Tests: 309 passed, 309 total
## 2026-10-06 01:49:xx  load 3.70
$ npm run test -w @dems/mobile -- --maxWorkers=2
FAIL src/features/settings/settings-live-static.test.ts          (W82, rewritten at 01:50:06 during the run)
Test Suites: 1 failed, 137 passed, 138 total
Tests:       2 failed, 1692 passed, 1694 total
## re-check of W82's file at 01:52:58: PASS, 14 passed
$ npm run typecheck -w @dems/mobile   exit=0
$ npm run lint -w @dems/mobile        exit=0; eslint json: files 532 errors 0 warnings 0
baseline 72 vs acaff20: 0     W60 navigation tests vs b90a3c6: 0
161 OK, 0 changed of the test files hashed at 01:25 (incl. runtime/session-route-sync.test.tsx and route-sync.test.ts)
```

- The floor (128 / 1,580) is passed (138 / 1,694). The two failures belong to W82's file, which it was
  writing during the run (Settings copy and `.actions` reads) and which passes on re-check.
- Footprint: `runtime/session-route-sync.tsx`, `runtime/sim-runtime-provider.tsx` (edited),
  `runtime/live-resync-watch.ts`, `runtime/session-route-sync-live.test.tsx`,
  `runtime/connection-banner-live.test.tsx` (new). `usePendingPress` and `useCoreLinkNotice` untouched.
- **Deviations:** temporary probe code lived inside my own new test file (removed). Three scratch probe
  test files were in `runtime/` for under three minutes and were moved, not deleted, to
  `.cache/m1c/zz-m1c-banner-probe*.test.tsx.txt` (copies in `09b_m1c_d170_banner.log`). None was in a
  whole-suite run.

### Decisions for the controller (follow-ups 2 and 3)

| # | Decision | Recommendation |
|---|---|---|
| **DN-G1** | D169's fix is not W72's one-liner: on a reconnect the snapshot lands after `RESYNCED` (CPC1-35), so the route sync waits for the Live source's confirmation (a helper on public members). A simpler alternative is a Live-source signal "the held snapshot is applied" in `packages/shared` (e.g. emit to the app's listeners after `releaseSessionHold()` in `adoptSession`). Out of this row's bounds; it would let the watch go | Ratify; the shared signal optional, for W83 / the shared owner (CONTRACT-GAP-W44-1 already notes that `hello` names no session) |
| **DN-G2** | Any other consumer of the resync bus that reads replicated state at `RESYNCED` has the same timing (today: the banner, which reads only the link, and the route sync, now fixed) | Note in the page-row briefs: a page that reacts to "resynced" reads the store after the Live source confirms, never at the signal |
| **DN-G3** | D170: the banner hook is exported from `sim-runtime-provider.tsx` for its test (not through the barrel) | Ratify |
| **DN-G4** | D170 on a device: the lane split is the production case, but not checked on a device | For W94 / W100's reconnect checks |
