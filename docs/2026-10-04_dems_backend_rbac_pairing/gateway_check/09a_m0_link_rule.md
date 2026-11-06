# M0 — one "follow the Core link without flicker" rule and one link view in the mobile runtime

**Row**: M0 (controller-added, decision D148), fixing finding **CPM1-3** of the CP-M1 review
(`gateway_check/09_cp_mobile_runtime.md` §3, answer 4, fix order 1). Agent: coder-execution.
**Time**: 2026-10-05 20:19–20:40 and, after an interruption of the agent stream (no progress from about
20:40; the controller resumed the row at 22:23), 22:23–22:40 WIB.
**Status**: **complete**. No behaviour change visible to an operator; two decisions to ratify (§9).

Assets: `assets/09a_m0_final_gate.log`, `assets/09a_m0_mutations.log`, `assets/09a_m0_mutate.py.txt`,
`assets/09a_m0_mutating_transformer.cjs.txt`, `assets/09a_m0_jest_mut_config.cjs.txt`.

---

## 1. Result at a glance

| Item | Result |
|---|---|
| The one rule | `apps/mobile/src/runtime/link-notice.ts`: `offlineNoticeAfter(shown, link)` and the one view `coreLinkViewOf(link)` → `'up' \| 'settling' \| 'down' \| 'none'`; exported through `@/runtime` |
| The two copies | Gone. `pairing-live-model.ts` and `login-live-model.ts` re-export the runtime function under the names their callers and tests already use; neither holds a rule |
| Callers | `use-pairing-flow.ts` and `use-login-controller.ts` **not edited at all** (not even an import line); they call the runtime function by identity (asserted by a test) |
| W57 / W59 tests | Unchanged (`git diff --stat b90a3c6` over every test file of `features/pairing` and `features/login`: empty). No granted import-line change was needed |
| 72 baseline test files | Byte-equal to `acaff20` (`git diff --stat acaff20 -- <the 72>`: empty) |
| Whole mobile suite | **96 suites / 1,257 tests, exit 0** (ledger 94 / 1,230 + this row's 2 suites / 27 tests) |
| typecheck, lint | exit 0, exit 0; eslint JSON over 464 files: **0 errors, 0 warnings** |
| Mutation run (rule M15, in memory) | **29 of 29 detected**; control 86 / 86 green; the mutated files byte-identical before and after |

## 2. The two copies, side by side (commit `b90a3c6`)

| | Pair screen (W57) | Login screen (W59) |
|---|---|---|
| Function | `offlineNoticeAfter(shown, link: LiveLinkState \| null)`, `features/pairing/pairing-live-model.ts:51-62` | `liveOfflineNoticeAfter(shown, heartbeat: HeartbeatState \| undefined)`, `features/login/login-live-model.ts:79-89` |
| Input | The Live source's link, `useLiveLink()` (`use-pairing-flow.ts:134`) | The heartbeat of the runtime's link, `coreLink.heartbeat` (`use-login-controller.ts:109`) = the Live socket's heartbeat view (`sim-runtime-provider.tsx:379`, `:413`, `:434`) |
| Down (shows) | `OFFLINE`, `STALE` (`:53-55`) | `'OFFLINE'`, `'STALE'` (`:81-83`) |
| Up (hides) | `default` → false: `ONLINE` and `null` (`:59-60`) | `'LIVE'` → false (`:84-85`) |
| Transient (keeps) | `CONNECTING`, `RESYNCING` (`:56-58`) | `default` → `shown`: `'CONNECTING'` **and `undefined`** (`:86-87`) |
| Gate outside the rule | The link is `null` outside LIVE; the wording is `live ? liveLinkViewFor(…) : null` (`use-pairing-flow.ts:164`) | `live && liveOfflineNoticeAfter(…)` (`use-login-controller.ts:111`, `:114`) |
| State | Render-time adjustment keyed on `liveLink` (`use-pairing-flow.ts:158-163`) | Render-time adjustment keyed on `linkHeartbeat` (`use-login-controller.ts:110-115`) |
| Time window | None | None |
| Tests | `pairing-live-model.test.ts:25-47` | `login-live-model.test.ts:45-54` |

A third instance of the same answer exists outside `features/`: the app banner's
`nextBannerKind` (`runtime/connection-banner.ts:37-42`, "CONNECTING keeps the current banner,
`state === 'OFFLINE'` shows it"). It is outside this row's write set, it has a third state
("Resynced") and a Simulated branch, and it now has a test that holds it to the same answer as the
one rule in LIVE mode (§6, "agree on every heartbeat of LIVE mode").

## 3. Every behavioural difference, and the choice

| # | Difference | Where | Choice and why | Visible change? |
|---|---|---|---|---|
| B-1 | An **absent** input: the Pair copy hides the notice for `null` (from any `shown`); the Login copy **keeps** `shown` for `undefined` | `pairing-live-model.ts:59-60` vs `login-live-model.ts:86-87` | **Absent = `none` = hide**, for both. The notice says "Core server unreachable" and only the link may say so (client spec §3.5; LB-6; LB-10 "never shows the offline notice" unless the link is down). By the contract an absent heartbeat means a SIMULATED source (`runtime/contract.ts:84-85`: `heartbeat` is set for HEARTBEAT and LIVE), where this notice does not exist (§3.5 is LIVE mode only). One function with `null` ≠ `undefined` would be a trap for ten page rows | **None.** Login's only call is `live && liveOfflineNoticeAfter(shown, coreLink.heartbeat)` (`use-login-controller.ts:111`, `:114`): outside LIVE the `&&` short-circuits; in LIVE the link comes from `LiveRuntime`, whose `useMemo` always sets `heartbeat` (`sim-runtime-provider.tsx:434`). No test or fake renders the Login screen with a LIVE link that has no heartbeat (the only LIVE fakes without one are `auth/live-auth-model.test.ts:114-115`, for `isSignInBlocked`). The pinned assertion `login-live-model.test.ts:52` (`(false, undefined) → false`) holds under both rules. Decision **DN-1** to ratify |
| B-2 | Vocabulary: `RESYNCING` exists only in the Live link | `pairing-live-model.ts:57` | `settling` (a transient), as the Pair copy had it; the heartbeat has no such state | None |
| B-3 | **Which representation** each screen reads. The socket computes the link and the heartbeat separately (`computeLink`, `packages/shared/src/realtime/live-socket-client.ts:644-657`; heartbeat LIVE at `:906`, STALE at `:1074-1075`), and they differ in short windows: (a) socket open and a heartbeat in, snapshot not yet: link `CONNECTING` (`:655`), heartbeat `LIVE` — Login hides its Alert at the heartbeat, Pair at the snapshot; (b) a settle time-out: link `RESYNCING`, heartbeat `LIVE`; (c) STALE: the link after 2.5 s without **any** message (`aliveAt`, `:1077-1079`), the heartbeat after 2.5 s without a **heartbeat** (`lastBeatAt`, `:1074`) | `use-pairing-flow.ts:134` vs `use-login-controller.ts:109` | **Kept**: the input is the caller's, the callers' bodies are outside this row's write set, and the brief keeps each screen's current behaviour. Both now feed the one rule, so the difference is in what each screen hands it, not in the rule. The Pair screen reads the Live link because it must know when a redeem would be sent (CL-22: commands only while ONLINE). Page rows hand `useCoreLink()` (the heartbeat), as Login and the app banner do — **DN-4** | None (nothing changed) |
| B-4 | The gate: Login wraps the call in `live &&`; Pair relies on `null` | §2 | With the view, a `CoreLinkInfo` of a SIMULATED or HEARTBEAT source maps to `none`, so new code needs no gate. The two callers keep theirs (unchanged files) | None |
| B-5 | A time window | neither copy has one | **0 ms, kept.** See §4 and **DN-2** | None |

## 4. The helper's exact semantics (`runtime/link-notice.ts`)

**The view** (`coreLinkViewOf`, `link-notice.ts:76-106`):

| A caller holds | `up` | `settling` | `down` | `none` |
|---|---|---|---|---|
| `LiveLinkState` (`useLiveLink()`) | `ONLINE` | `CONNECTING`, `RESYNCING` | `STALE`, `OFFLINE` | `null` (Simulated mode) |
| `HeartbeatState` | `LIVE` | `CONNECTING` | `STALE`, `OFFLINE` | `undefined` |
| `CoreLinkInfo` (`useCoreLink()`), source LIVE | its `heartbeat` as above; without one, `state` `ONLINE` | | without a heartbeat, `state` `OFFLINE` (a fake runtime) | |
| `CoreLinkInfo`, source SIMULATED or HEARTBEAT | | | | always (mock-core's heartbeat never drives the Core server notice) |
| A `CoreLinkView` | itself | itself | itself | itself |
| Any other value (a refusal's kind, a status code) | | always: says nothing about the link | | |

**The rule** (`offlineNoticeAfter(shown, link)`, `link-notice.ts:112-122`):

- **Which states count as down**: `OFFLINE` and `STALE`, in both vocabularies.
- **How long a down state must hold before the notice shows**: **0 ms.** The first render that sees a
  down state shows the notice; no clock is read and no observation count is kept. The only time window
  in the chain is the transport's: a link turns STALE after `HEARTBEAT_STALE_AFTER_MS` = 2,500 ms
  without a message (`packages/shared/src/api/constants.ts:21`, measured by the socket client on its
  injected clock, `live-socket-client.ts:1074-1079`); an OFFLINE is a socket that closed.
- **Up and none** hide it at once.
- **Settling keeps what is shown** — the no-flicker part: with the Core down the link alternates
  OFFLINE, CONNECTING, OFFLINE at every reconnect attempt (`RECONNECT_BACKOFF_MS` 500 → 8,000 ms); a
  cold start is CONNECTING before the first heartbeat, so nothing flashes then; a settle time-out's
  RESYNCING (CL-17) keeps it too.
- **A 429** cannot reach the rule: a limit is a refusal, not a link state (LB-10). The input type has
  no place for one (the test proves a refusal's `kind` and a status code are type errors), and a
  value that is no link state keeps what is shown — a limit neither shows nor hides the notice.
- **Time comes from no clock at all**, so rule 7 (the store's clock, never `setTimeout`) holds
  trivially; a behavioural test spies on `Date.now`, `performance.now`, `setTimeout`, `setInterval`
  and a text scan forbids them in the file.
- **Idempotent for a fixed input**, so the render-time adjustment may re-apply it on any input
  change; keying the state on the view or on the raw state gives the same result.

## 5. The call sites after the change

| File | What it holds now | Lines |
|---|---|---|
| `runtime/link-notice.ts` (new) | The view and the rule; header with the table above and the page-row snippet | 1–122 |
| `runtime/index.ts` | One export block `export { coreLinkViewOf, offlineNoticeAfter, type CoreLinkInput, type CoreLinkView } from './link-notice';` (`:201`), plus one row in each of the header's two tables (`:22`, `:32`) — see DN-3 | 3 lines added |
| `features/pairing/pairing-live-model.ts` | `export { offlineNoticeAfter } from '@/runtime';` (`:50`); `liveLinkViewFor` now reads `coreLinkViewOf(link) === 'up'` (`:53-56`); `LiveLinkState` is a type-only import | 9 added, 21 removed |
| `features/login/login-live-model.ts` | `export { offlineNoticeAfter as liveOfflineNoticeAfter } from '@/runtime';` (`:78`); the `HeartbeatState` import is gone | 7 added, 18 removed |
| `features/pairing/use-pairing-flow.ts` | Unchanged: `offlineNoticeAfter` at `:52`, `:159`, `:162`, now the runtime's function | 0 |
| `features/login/use-login-controller.ts` | Unchanged: `liveOfflineNoticeAfter` at `:38`, `:111`, `:114`, now the runtime's function | 0 |

## 6. The tests

`runtime/link-notice.test.ts` (21 tests) and `runtime/link-notice-static.test.ts` (6 tests); the
failing names of the mutation run (`assets/09a_m0_mutations.log`) show which test guards what.

| Group | What it proves |
|---|---|
| The view (6) | Every state of both vocabularies, through a `Record<LiveLinkState \| HeartbeatState, CoreLinkView>` (a new state in either shared vocabulary fails the type check here) plus a runtime check that the vocabularies hold no other state; `null` / `undefined` → `none`; `CoreLinkInfo` for every source × heartbeat; LIVE without a heartbeat; a view maps to itself; a non-link value → `settling` |
| The rule (4) | Every view and every state, from hidden and from shown; the runtime's link per source; idempotence |
| **No flicker on a manual clock** (4) | An outage stamped with the transport's own constants (cold start, STALE after `HEARTBEAT_STALE_AFTER_MS`, OFFLINE, one CONNECTING/OFFLINE pair per `RECONNECT_BACKOFF_MS` value, a RESYNCING, ONLINE): exactly **two** flips — on at the very instant of the first down state (hold 0), off at the instant the link is back; the same outage through the heartbeat and through `CoreLinkInfo` flips at the same instants; the same states 0.2 ms, 1× or 720× apart flip at the same steps (time-independent); a cold start that never connects shows the notice at the first OFFLINE, not at CONNECTING |
| **A 429** (2) | The presenter calls a 429 `LIMIT` with `outage: false`; across a 429 the notice stays, link up and link down; a refusal's `kind` and a status code handed in are type errors (`@ts-expect-error`) and keep what is shown |
| One rule in the app (3) | `pairing-live-model`'s `offlineNoticeAfter`, `login-live-model`'s `liveOfflineNoticeAfter` and the barrel's export **are** the runtime function (`toBe`); the app banner (`nextBannerKind`) and the rule agree on every heartbeat × banner state of LIVE mode; only a LIVE source can show the notice |
| Purity (2) | Behavioural: no `Date.now`, `performance.now`, `setTimeout`, `setInterval` call while deciding, over every input; textual: the file names no clock, timer, hook, store, storage or log (with positive controls of the matchers) |
| The static rule (6) | §7 |

Existing tests: **unchanged and green**. `pairing-live-model.test.ts` and `login-live-model.test.ts`
now exercise the runtime function through the re-exports; `pairing-live.test.tsx`,
`live-login.test.tsx` and `pairing-live-static.test.ts` (whose folder file list, CPM1-9, is unaffected:
no file was added to `features/pairing/`) pass unedited.

## 7. The static check (`runtime/link-notice-static.test.ts`)

Scans the **code** (comments stripped) of every production `.ts`/`.tsx` under
`apps/mobile/src/features/**`, sub-folders included (198 files today; test files and `testing/`
folders excluded), line by line:

| Check | Pattern | Catches | Hits today |
|---|---|---|---|
| C1 | `\b(?:CONNECTING\|RESYNCING)\b` | Any screen that names a transient link state — it is deciding what a transient does (the Pair copy; the banner's `heartbeat === 'CONNECTING'` shape). A screen that wants to word a transient reads `coreLinkViewOf(link) === 'settling'` | 0 |
| C2 | `\bcase\s+(?:[\w$]+\.)?['"]?STALE\b` | A switch over the down states (the Login copy, which kept the transient through `default` and never named CONNECTING). STALE belongs to the two link vocabularies only, so cameras and devices that are OFFLINE do not fire it | 0 |
| C3 | `OFFLINE` and `STALE` on one line joined by `\|\|` or `,` | The down set written out: an if-chain, an `includes`, a `Set`, a one-line table. A type union (`'ONLINE' \| 'STALE' \| 'OFFLINE'`, one bar, `login-model.ts:65`) does not fire | 0 |

**Positive controls** in the test: the two former copies verbatim (from `b90a3c6`) — the Pair copy
fires C1 and C2, the Login copy fires C2 — and the banner shape, an if-chain, an `includes`, a `Set`
and a one-line table. **Negative controls**: the Login ring and chip lines of `login-model.ts`
(`heartbeat === 'STALE'` → attention, the chip type union), the i18n `STALE:` key, a camera that is
`'OFFLINE'`, the Pair screen's lowercase wording, a comment, and a call of the runtime rule.

**What it cannot see**: a copy that names neither a transient nor STALE (for example one keyed on the
two-valued `coreLink.state === 'OFFLINE'` and `heartbeat === 'LIVE'`); a table spread over several
lines; names built from parts; any copy outside `features/` (the banner is held by the agreement test
instead); a screen that takes the runtime's view and adds a time window of its own. Those stay review
items for the page rows' checkpoint.

## 8. Mutation results (rule M15: nothing in the tree was modified)

Method: W56's (`implementation/assets/56_mutat*`) — a jest transformer outside the tree
(`.cache/m0/mut/`, copied to `assets/09a_m0_*`) applies the edits of one mutant **in memory** to one
production file and hands the result to the app's own babel-jest; each mutant runs six test files
(the two new ones, `pairing-live-model.test.ts`, `login-live-model.test.ts`, `pairing-live.test.tsx`,
`live-login.test.tsx`); detected = jest exit ≠ 0. The SHA-256 of the two mutated files was compared
before and after each batch.

```
# M0 mutation check, 2026-10-05 22:27:42; 6 test files per run; the tree is not edited
control (no mutation): exit=0 Tests:       86 passed, 86 total (23 s)
…
## 14 detected, 0 not detected, 0 not applied, of 14
## the mutated files in the tree, before and after: identical
# finished 22:30:24
…
## 15 detected, 0 not detected, 0 not applied, of 15
## the mutated files in the tree, before and after: identical
   674928ede60e317d  src/features/pairing/pairing-live-model.ts
   8df54bdb2236eeee  src/runtime/link-notice.ts
# finished 22:32:58
```

| Class (the brief's words) | Mutants | Detected | A test that fails |
|---|---|--:|---|
| **The window length** | W1 hold 0 → 1 ms on the wall clock; W2 → 2,500 ms; W3 a one-observation hold without a clock; W4 an infinite window (never shows from hidden) | 4 / 4 | "every view, from hidden and from shown"; W2 and W4 also fail the W57/W59 behaviour tests |
| **A down state left out** | D1 STALE → transient; D2 OFFLINE → transient; D3 STALE → up; D4 LIVE without heartbeat, OFFLINE → not down; D5 the view `'down'` handed back in → not down | 5 / 5 | "maps every state of both vocabularies …"; D2 also fails `live-login.test.tsx` and `pairing-live.test.tsx` |
| **A 429 treated as down** | L1 a non-link value → down; L2 a non-link value → hides | 2 / 2 | "a 429 is no link state: whatever the link shows stays …" |
| **The clock source** | C1 the down branch reads `Date.now()`; C2 the settling branch reads `performance.now()`; C3 the rule schedules a `setTimeout` — all three otherwise behaviour-equal | 3 / 3 | "asks no clock and starts no timer while it decides" (the text scan reads the tree, so the behavioural spy test was added for exactly these) |
| Transients | T1 CONNECTING → down; T2 RESYNCING → up; T3 CONNECTING → up; T4 settling hides; T5 settling shows | 5 / 5 | "every state …", the manual-clock outage; T3/T4 also `pairing-live.test.tsx` |
| No link and sources | N1 null/undefined keep; N2 undefined keeps (the Login copy's old default, B-1); N3 HEARTBEAT drives the notice; N4 the source is not asked; N5 the heartbeat ignored | 5 / 5 | "no link is `none` …", "the runtime's link: …" |
| Up | U1 up keeps; V1 ONLINE unknown; V2 heartbeat LIVE unknown | 3 / 3 | V1: 24 tests across three files |
| The Pair wording | P1 `!== 'down'` instead of `=== 'up'`; P2 any Live link is online | 2 / 2 | `pairing-live-model.test.ts` "`online` only when a redeem would be sent …" |
| **Total** | | **29 / 29** | |

The static check of §7 reads the tree, so an in-memory mutant cannot exercise it; its strength is
shown by the positive and negative controls in the test itself.

## 9. Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| **DN-1** | An absent link (`undefined` heartbeat) now **hides** the notice; the Login copy kept `shown` (B-1). No visible change, proven in §3 | Ratify |
| **DN-2** | **No hold window** (0 ms), as both copies and the spec have it. A window would make both screens show the notice later than today — a visible change, not made. STALE already carries the transport's 2.5 s; the flicker the rule prevents (OFFLINE ↔ CONNECTING) is removed by hysteresis without delay | Keep 0 ms |
| **DN-3** | `runtime/index.ts`: besides the one export block, **two comment rows** were added to the header's module table and "what a screen imports" table, because those tables are where the page rows look up the surface (report 51 §4) | Ratify, or have the two rows removed (no code depends on them) |
| **DN-4** | B-3 kept: Pair follows the Live link, Login the heartbeat. Page rows hand `useCoreLink()` | Put the paragraph of §10 into W66–W82's briefs |
| **DN-5** | The banner's `nextBannerKind` (`connection-banner.ts:37-42`) stays a separate function; it now has an agreement test against the rule for LIVE mode | Leave; route it through the helper only if a W51 slot touches the banner anyway |

Observations, not this row's to fix:

- `features/pairing/pairing-connection.tsx:86` repeats `showsOffline` of `pairing-live-model.ts:150-152`
  (`link === 'offline' && view !== 'pairing' && view !== 'paired'`) — *where* the Pair screen shows the
  notice, not the link rule; a screen-local duplicate for W57's carry list (Info).
- `packages/shared/src/i18n/en/{dashboard,session-new,session}.ts` are modified in the tree by the
  parallel web page rows (seen at 22:28 by `git status`); not written by this row. The final mobile
  suite ran on that tree and is green.
- The jest message "A worker process has failed to exit gracefully" appears in every whole-suite run
  and predates this row (it is in `gateway_check/assets/06_c_real_mobile.log` and
  `implementation/assets/15_gate_mobile_test.log`).

## 10. What the page rows W66–W82 must call (paste into their briefs)

> **Core link notice (row M0, CPM1-3).** A screen that says "Core server unreachable" calls the runtime's
> one rule and writes none of its own: `const view = coreLinkViewOf(useCoreLink());` then keep the
> notice in state with the render-time adjustment — `const [viewSeen, setViewSeen] = useState(view);
> const [offline, setOffline] = useState(() => offlineNoticeAfter(false, view)); if (viewSeen !== view)
> { setViewSeen(view); setOffline(offlineNoticeAfter(offline, view)); }` — never a ref plus an effect,
> never `setTimeout`, never a hold time: the notice shows at the first OFFLINE or STALE, hides at the
> first ONLINE, and CONNECTING and RESYNCING keep it. Hand it `useCoreLink()` itself: never
> `useCoreLink().state` (two values; a CONNECTING link reads OFFLINE and the notice flashes) and never a
> bare `heartbeat` (HEARTBEAT mode has one too). Outside LIVE the view is `none` and nothing shows, so no
> `live &&` gate is needed. A 429 is not a link state: never feed a refusal, its `kind` or its `outage`
> to the rule — the presenter words a limit (LB-10). To word the link (a chip, a disabled control) read
> the view (`'up' | 'settling' | 'down' | 'none'`), never the raw states: `runtime/link-notice-static.test.ts`
> fails the workspace if a file under `features/` names CONNECTING or RESYNCING, puts STALE in a
> `case`, or writes OFFLINE and STALE in one expression or list. Import through `@/runtime` only.

## 11. Verification (commands from the repo root; `assets/09a_m0_final_gate.log`)

```
## 2026-10-05 22:33:13 WIB 22:33  2 users, load averages: 4.08 3.83 3.54
## $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 96 passed, 96 total
Tests:       1257 passed, 1257 total
Time:        57.596 s
exit=0
## 22:34:11 $ npm run typecheck -w @dems/mobile
exit=0
## 22:34:17 $ npm run lint -w @dems/mobile
exit=0
eslint json: files 464 errors 0 warnings 0
baseline 72 vs acaff20:          0   (lines of `git diff --stat acaff20 -- <the 72 test files>`)
W57/W59 tests + callers vs b90a3c6:  0
```

`uptime` was checked before every whole-suite run (load 3.1–4.1, below 10). A first whole-suite run
at about 20:40 died with the agent stream under a heavily loaded host (5 suites in 20 minutes,
`session-live-screen.test.tsx` alone 957 s, two time-outs) and is void; the three suites that failed
in it (`pairing-live`, `evidence-detail`, `live-login`) passed at 22:24 (3 / 43), and the two complete
runs after it (22:25: 96 / 1,256 before the purity test was added; 22:33: 96 / 1,257) are green.

## 12. Rollback (not executed)

Pre-images with their SHA-256 in `.cache/rollback/M0/` (`pre.sha256`; the three files equal commit
`b90a3c6`):

1. Copy back `apps_mobile_src_features_pairing_pairing-live-model.ts`,
   `apps_mobile_src_features_login_login-live-model.ts`, `apps_mobile_src_runtime_index.ts` over
   their originals (or `git checkout b90a3c6 -- <the three paths>`).
2. Remove the three new files `apps/mobile/src/runtime/link-notice.ts`, `link-notice.test.ts`,
   `link-notice-static.test.ts`.
3. Re-run the mobile suite: the ledger returns to 94 / 1,230.

## 13. Footprint and limits

- Written: the three new runtime files, the three edited files above, this report, its five assets,
  `delegation_progress/coder_execution_m0.md`; scratch only under `.cache/m0/` and
  `.cache/rollback/M0/`. No git write, no Docker, no emulator, no port.
- One process slip: at about 20:24 one read-only `grep` command was written with a leading `cd`
  (P10); it changed nothing.
- No device check (a pure refactor proven by tests, per the brief). The representation difference
  B-3 is described from the socket client's code, not measured on a device.
