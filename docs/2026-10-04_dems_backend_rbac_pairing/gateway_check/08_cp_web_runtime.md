---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-05
agent: senior-code-reviewer-local
blueprint_row: 83
plan_row: W61 (CHECKPOINT CP-W1, read-only)
rows_reviewed: W50 (web runtime and mode switch), W54 (web shell, navigation, admin routes), W55 (web Login)
evidence_tier: 2 (what was found, why it matters, how it was verified, source citation)
status: complete
verdict: PASS WITH FIXES (0 Blocker, 1 High, 4 Medium, 6 Low, 4 Info)
open_blockers: 0
---

# 08 Checkpoint CP-W1: the web client foundation (blueprint step 83, plan row W61)

Row, verbatim: [W61] CHECKPOINT CP-W1, read-only: review the web client foundation (W50, W54, W55)
for mode isolation, credential handling in the browser and an unchanged packaged CSP. Writes: nothing
(except this report). Checks AC-C-18, AC-C-35, AC-C-36. Rollback R-NONE.

## 0. Result

**Verdict: PASS WITH FIXES. Open blockers: 0.** Nothing found changes what a page row may rely on:
mode isolation holds, no credential can reach browser storage or a log, and the packaged CSP is
byte-identical. One High finding must be fixed before the page rows lean on the mode-switch seam,
because the seam is currently two functions that render one identical set of test IDs.

| Dimension | Verdict | Findings |
|---|---|---|
| 1 Mode isolation | PASS | CPW1-6, CPW1-7, CPW1-14 |
| 2 Credential handling in the browser | PASS | CPW1-3, CPW1-8, CPW1-12 |
| 3 The packaged CSP | PASS (clean) | none |
| 4 Structure, reuse, error handling, dependencies, i18n, tests | PASS WITH FIXES | CPW1-1, CPW1-2, CPW1-4, CPW1-5, CPW1-9, CPW1-10, CPW1-11, CPW1-13 |
| 5 The five questions routed by D136 | answered in section 6 | — |

Command totals quoted from my own runs (assets/08_command_totals.txt): `@dems/core-web` **55 files /
759 tests exit 0** with `--maxWorkers=2`, `@dems/shared` **68 files / 1,814 exit 0**, `typecheck -w
@dems/core-web` exit 0, `lint -w @dems/core-web` exit 0 with no finding, `lint -w @dems/shared` exit 0.
`test:db` was not run (the database folder belongs to another agent right now). A fresh production
build of the current tree holds **no `unsafe-eval` and no `new Function(`** anywhere in its assets.

The three protected artefacts were re-measured, not trusted (assets/08_protected_artefacts.txt):
`lib/packaged-csp.ts` = `78c8898e…`, `lib/__tests__/packaged-csp.test.ts` = `6d0db39e…`,
`lib/__tests__/core-endpoint.test.tsx` = `89cab371…`, `test/routes.test.tsx` = `7a04c97d…` — all four
blob-equal to `acaff20`, and `git diff --stat acaff20` over them is empty. The three guard files of
AC-C-41 (`routes/_app.tsx`, `routes/login.tsx`, `routes/_app/session/new.tsx`) and all of
`apps/mock-core/**` are likewise untouched.

## 1. Method

Read first: `masterplan/02_plan.md` rows W50/W54/W55/W61 and sections 8.1 and 11;
`identification/02_structured.md:487-578` (P1-P25); `gateway_check/01_gate_report.md` (M1-M16);
the three rows' own reports (W50 whole, W54 sections 3-15 and 16-24, W55 sections 1-10 and 21);
`04_client_integration_spec.md` §3, §4.2, §5.1-5.6, §6.3-6.5, §10.1, §13.1-13.11 (AC-C-18..47,
AC-C-101..110); `decisions/decisions.md` D29, D113, D120, D121, D126, D128, D136, D137, D138, D141.

Then the code, read in full where it mattered: `runtime/{core-mode,boot,live-start,live-host,error-sink,
owed-sign-out-storage,query-bridge,hooks,index,live-host-refusal}.ts(x)`, `main.tsx`, `router.tsx`,
`routes/{__root,login,-search}.tsx`, `routes/_app.tsx`, `routes/_app/admin/{-guard,users,devices}.tsx`,
`components/shell/{mode-switch,mode-indicator,mode-indicator-state,live-notices,live-only-state,
use-visible-nav-items,route-permissions,nav-items,sidebar,app-shell,user-menu,shell-report,index}.{ts,tsx}`,
`features/login/{index,auth-card,mode-selector,device-strip,login-alert,live-adapter,sim-adapter,
use-login-controller,use-mode-switch,login-live-model,report}.{ts,tsx}`, `lib/{core-endpoint,core-errors,
presentation-mode,packaged-csp}.ts`, the shared `client/core-client.ts`, `realtime/live-socket-client.ts`,
`realtime/heartbeat-context.tsx`, `live/hooks.ts`, and the eight `live-*.test.tsx` files of the three rows.

Proven by: the greps of section 3 (their raw output is in `assets/08_credentials_build_checks.txt`),
the two suites and the two checks above, one production build, and `git cat-file`/`git hash-object`
comparisons against `acaff20`. No source file was changed; see CPW1-15 for the one artefact my build
wrote into the git-ignored `apps/core-web/dist`.

## 2. Mode isolation — PASS

**2.1 No Simulated path reaches the Core server or its socket.** `bootCoreRuntime` builds the
simulator without ever loading the heavy module (`runtime/boot.ts:217-224`); the only value import of
`@dems/shared/client` and `@dems/shared/live/source` sits in `runtime/live-start.ts:27-28`, reached only
through the dev-gated dynamic import at `boot.ts:40` (`import.meta.env.DEV ? () => import('./live-start') : null`).
The endpoint row follows the data source, not the mode word: `setCoreEndpointMode(coreModeOf(context.sim))`
(`router.tsx:46-48`), and `isLiveCore()` additionally requires `import.meta.env.DEV`
(`lib/core-endpoint.ts:70-72`), so a Simulated page cannot address the page origin even if the flag
leaked. The only socket a Simulated page opens is the predecessor's mock-core heartbeat
(`routes/__root.tsx:116`, `coreWsUrl()` → `ws://127.0.0.1:4400/ws`), unchanged from `acaff20`; in Live
mode the same line takes `live.heartbeat` instead and no second client is built (§4.2's AC-C-18,
except the API Reference page's own socket, which is W84's and was already reported as F72-4).
My fresh production build repeats W50's marker profile exactly (`createLiveSim`, `browser-cookie`,
`dems.live.owedSignOut`, `live-start`: 0 files each).

**2.2 The mode is decided in one place.** `resolveCoreMode` (`runtime/core-mode.ts:74-83`) is the only
resolver and `bootCoreRuntime` (`boot.ts:167`) its only caller; everything else derives from the built
source (`coreModeOf(sim)` in the router context, `useCoreMode()` in the shell). No page, guard or
component reads `dems.core.mode.v1` or `DEMS_CORE_MODE` — the static rule that keeps it so is pinned in
`live-runtime-static.test.tsx` and re-checked by W55's SR-16 scan.

**2.3 No silent fallback from LIVE to SIMULATED.** A refusal returns neither source
(`boot.ts:176-195`); an unreachable Core returns a Live source whose link is OFFLINE and never a
simulator (`boot.ts:196-215`, proven by `live-runtime-startup.test.tsx` "unreachable at start"); the
only LIVE→SIMULATED transition that happens without the operator pressing anything is rule 1 of the
resolver (`core-mode.ts:75-76`), which AC-C-20 requires and which is observable because the chip then
reads SIMULATED. "Use Simulated mode" on the refusal screen is an explicit press
(`runtime/live-host-refusal.tsx`, `boot.ts:184-189`). Two latent shapes are recorded as Info/Low:
CPW1-14 (the `&& loadLive !== null` fall-through at `boot.ts:174`, unreachable because `dev` already
requires the module) and CPW1-7 (nothing catches a rejected boot).

**2.4 The two administration pages in Simulated mode.** They are unreachable through the interface —
both entries carry `liveOnly: true` and `permission` (`components/shell/nav-items.ts:75-76`) and every
surface that lists them goes through `useVisibleNavItems` (`use-visible-nav-items.ts:19-21`, used by
`sidebar.tsx:65`; the bottom tabs never had them) — and a direct URL renders the "Live mode only" state
with no data and no request (`routes/_app/admin/-guard.ts:19-23` deliberately does not redirect in
Simulated mode, which is PG-3; `features/users-roles/index.tsx:25-33`, `features/paired-devices/index.tsx`).
The one exported helper that can lie about the mode is CPW1-6.

## 3. Credential handling in the browser — PASS

**3.1 The session lives only in the `HttpOnly` cookie.** The typed client is built with
`credentials: 'browser-cookie'` and no bearer provider (`runtime/live-start.ts:100-106`); the client maps
that to `credentials: 'same-origin'` and never writes an `Authorization` header
(`packages/shared/src/client/core-client.ts:576,695`), and it refuses a credential-shaped value in a path
or query (`:70`, CL-6a). The socket carries no header at all (`live-start.ts:110-113`).

**3.2 The greps.** Over the production files of all three rows (raw output in
`assets/08_credentials_build_checks.txt`): no `localStorage`/`sessionStorage` write of anything that is
not a mode name, a layout preference, a presentation flag or the owed-sign-out debt; no
`document.cookie` read anywhere in `apps/core-web/src` outside tests; no `token=`/`password=`/
`authorization` in a URL, query or log call; no string literal starting with `ses_`, `dvc_` or `bio_` in
any production file of `apps/core-web/src` or of `packages/shared/src/{live,client,realtime}`. The keys
the three rows write are `dems.core.mode.v1` (`core-mode.ts:26`), `dems.live.owedSignOut.v1`
(`owed-sign-out-storage.ts:37`) and `dems.live.storageProbe` (`:40`, transient, removed at once); the
debt record holds four members and no credential (`owed-sign-out-storage.ts:84-87`). All five are inside
the allowed list of [CS] §3.4. AC-C-38's "no web-storage value starts with `ses_`" is asserted after a
Live sign-in at `live-login-signin.test.tsx:194`, and the stronger proof (the cookie is `HttpOnly`,
`SameSite=Strict`) is
W50's lane check.

**3.3 The cache is emptied in the turn the session is lost.** `attachQueryBridge` removes every
`['core', …]` entry, clears the mutation cache (so the answer of a command cannot outlive the session
that sent it) and notifies the features, on `onSessionEnd` (any cause: a control message, a close, a 401,
this console's own sign-out, or a local end) and on a session change that drops `USER_ADMIN` or
`PAIRING_MANAGE` or changes operator (`runtime/query-bridge.ts:103-115,137-148`; the pure rule is
`sessionChangeClearsCoreQueries` at `:79-82`). `live-runtime-bridge.test.tsx` pins each of those paths by
name (26 tests, `:189` AC-C-106, `:201` "in the turn … before anything renders", `:315` and `:326` the two
permissions, `:362` a rotated session heard on the socket). The Login page's `['health']` entry is
deliberately not removed — the health answer is public data an anonymous client may ask for.

**3.4 The pairing code.** Nothing in these three rows holds one; the seam exists and is correct: the
query key carries only "active and until when. NEVER the code itself" (`query-bridge.ts:47-48`) and W81's
memory has its hook (`onCoreQueriesCleared`, `:90-100`). Two instructions follow from what is NOT true of
the sink: CPW1-12 (the redactor blanks only the three bearer prefixes — it will not catch a code or a
password) and CPW1-8 (one shell helper writes a raw error message, which the Login row forbids).

## 4. The packaged CSP — PASS, clean

`apps/core-web/src/lib/packaged-csp.ts` is blob-equal to `acaff20` (`78c8898ecb89206beda222030c918958143316c3`),
its policy names no `unsafe-eval` (read directly: `script-src 'self'`), and the plugin emits the meta tag
only for `vite build` with `VITE_DEMS_CORE_ORIGIN=same-origin` (`packaged-csp.ts:76-91`). The production
build of the current tree contains no `unsafe-eval` string and **no `new Function(`** in any asset, and
zod's `jitless` configuration is still the first statement of `main.tsx:21`, ahead of every import that
builds a schema — the ordering that keeps Zod's `Function('')` probe from ever running under the policy,
pinned by `live-runtime-static.test.tsx`. No Live code path adds dynamic code: `rg` for
`unsafe-eval|new Function|\beval\(` over `apps/core-web/src` and `packages/shared/src/{live,client,realtime}`
returns only the two lines of the CSP test that asserts the absence.

## 5. Structure, reuse, dependencies, i18n, tests

**5.1 Duplication — CPW1-1 (High).** Two confirmed-mode-change implementations exist and render one
identical set of test IDs; see section 6.1. Beyond that, the duplication is small and named:
CPW1-9 (three definitions of the same `['health']` query: `features/home/use-health.ts:13`,
`features/api-reference/service-banner.tsx:31`, `features/login/live-adapter.ts:33-41` — the last one is
W55's, and it could not reuse the first because that folder is closed to it by [CS] §7.3), CPW1-8
(`components/shell/shell-report.ts` versus `features/login/report.ts`: two shapes of "write one record",
with different discipline), and the two admin stubs each repeating `LiveOnlyState`'s `Card`/`EmptyState`
markup (`features/users-roles/index.tsx:26-30`) — harmless, since W77/W81 replace those branches.

**5.2 Dead code.** None found. Every export of the three rows is either consumed in production or named
by the surface test (`live-runtime-surface.test.tsx`) or used by the row's own static rule; the
several exports used only by tests (`parseCoreModeEnv`, `requiredRoleForPermission`,
`sessionChangeClearsCoreQueries`, `STORAGE_PROBE_KEY`, `operatorSignOutOf`) are deliberate seams, each
documented as such.

**5.3 Error handling.** Good and consistent: the sink never throws and never leaves the page
(`error-sink.ts:72-91`, capacity 200, trimmed correctly), the presenter owns rows 1-13 and returns
`null` for the page's own cases (`lib/core-errors.ts:187-190`) with a coalescing window and a reset for
tests (`:169-202`), the Login page reports an unknown rejection by class/code/status only
(`use-login-controller.ts:296-299`), and a 429 is a limit and never an outage (`core-errors.ts:110-112`;
LB-10). Two gaps: CPW1-7 and CPW1-8.

**5.4 Dependency hygiene.** No new dependency in any of the three rows: the only `package.json` changes
against `acaff20` are W14's `qrcode.react` (still unused, W81 will need it) and W44/W46's four
`packages/shared` export paths. The heavy module stays behind one dynamic import and `@/runtime`'s barrel
is light by test (`live-runtime-surface.test.tsx`).

**5.5 i18n namespace ownership.** Correct and additive: W50 extended `common.ts`
(`coreMode`, `coreLink`, `coreErrors`, `liveHost`), W54 extended `shell.ts` (`mode.*`, `roleNotice.*`,
`liveOnly.title`, `nav.*`) and created `usersRoles`/`pairedDevices` with only what its stubs say — both
files are declared multi-writer (`02_plan.md:404`, W54 → W77/W81) and each carries a header naming the
page row's key families — and W55 extended `login.ts` with `live.*`. No row put a page's words in
another's namespace. The one defect is CPW1-10 (a stale count in a comment of the test that pins the list).

**5.6 Test quality — CPW1-5 (Medium) and CPW1-6/CPW1-11.** Most of the 321 new tests (759 now, 438 at
`acaff20`) pin behaviour:
the resolver table, the four steps of a switch, the cache clearing per cause, the guard's redirect, the
notice's stickiness, the sign-in outcomes. The exception is a family of static tests that pin source
text: `live-login-model.test.tsx:269-280` reads **another row's file** (`routes/__root.tsx`) and asserts
its exact `useEffect` line, and `live-shell-indicator.test.tsx:384-390` asserts two CSS rules as literal
whitespace-normalised strings plus the JSX order of the top bar. Those break on a reformatting with no
behaviour change, and the first one will break on the very fix CPW1-4 asks for. `live-runtime-static.test.tsx`
is the acceptable kind (it guards bundling and CSP, which jsdom cannot observe, and says why).

## 6. The five answers routed to this checkpoint (D136)

### 6.1 Decision 9 / F76-14 — which copy of the confirmed mode change remains

**The shell's copy stays: `apps/core-web/src/components/shell/mode-switch.tsx:30`. The Login copy,
`apps/core-web/src/features/login/use-mode-switch.tsx:34`, is deleted.** Three reasons, in order of
weight: (i) W54 §21.2 has already told nine page rows that the seam is "`useModeSwitch()` from
`@/components/shell`", and W77/W81's "Switch to Live mode" button reaches it through `LiveOnlyState`
(`live-only-state.tsx:25`) — a surviving copy in `@/features/login` would rewrite that promise and make
every page import a sibling feature's internals; (ii) the dependency direction is already one-way,
features → `@/components/shell` (nine folders do it, e.g. `features/session-new/index.tsx:53`), and the
shell must never import a feature; (iii) the shell copy has three consumers and a barrel export
(`components/shell/index.ts:18`), the login copy has one page.

What moves with it, exactly:

| Moves | Where | Cost |
|---|---|---|
| `switching: boolean` joins the returned object and the `ModeSwitch` interface (the login copy exposes it at `:21-28`; the shell copy keeps it private) | `mode-switch.tsx:8-17,90` | one field, one return member |
| The login copy's **record discipline**: a fixed sentence plus `context.errorName`, never the raw `error.message` (see CPW1-8) | replaces `mode-switch.tsx:59` | one call, and it is the part that makes the two copies genuinely equal |
| An optional `source` argument defaulting to `'shell.modeSwitch'`, so the Login page keeps naming its own failures `login.modeSwitch` | `mode-switch.tsx:30,59` | one parameter; only `shell.modeSwitch` is pinned by a test (`live-shell-indicator.test.tsx:358`), nothing pins `login.modeSwitch` |
| `features/login/index.tsx:48,61` imports `useModeSwitch` from `@/components/shell`; `auth-card.tsx:42` and `mode-selector.tsx:13` change their prop type from `LoginModeSwitch` to `ModeSwitch`; `mode-selector.tsx` **stays** (it is a Login-only control, not shared behaviour) | three files of W55 | import/type lines |
| `features/login/use-mode-switch.tsx` is deleted | — | 102 lines out |

**No test file changes.** All four files that pin `mode-switch-dialog` / `-confirm` / `-cancel` reach the
dialog through the surface they mount and import neither hook (re-counted: 11/4/1, 1/1/0, 1/1/0, 7/4/1 —
identical to F76-14's table, `assets/08_mode_switch_pins.txt`), so the surviving copy renders the same IDs
and the same words. W55's own folder scan still passes: `live-login-model.test.tsx:233` asks for at least
16 production files and the folder holds 18, 17 after the deletion.

**Owning row:** neither alone — it touches `components/shell/**` (W54) and `features/login/**` (W55), both
gated. The controller schedules it as one small slot, as D136(d) already anticipated. **Not** a move to
`@/runtime`: the hook returns a kit `AlertDialog`, and the runtime barrel is deliberately UI-free.

### 6.2 Decision 3 — the tone of `LIVE · RECONNECTING`

**Ruled: `warning` is the truer presentation, and the change is one expression.** The console already
owns a definition of "the link is up" that includes RESYNCING (`mode-indicator-state.ts:37-39`), the notice
uses it to stop calling the state an outage (`live-notices.tsx:62`), and the row's own test asserts both
halves of the contradiction two lines apart: `chip--danger` and "The link is up: this is not an outage, and
no link notice is shown" (`live-shell-indicator.test.tsx:252-253`). The tooltip is a recovery sentence
("The link to the Core server is being restored", `en/shell.ts:33`), and the notice reserves its danger
wording for `isLinkLost` = OFFLINE or STALE. So the chip is the only surface that calls a self-recovering
state by the outage colour.

Free of criterion conflict: [CS] §3.2 assigns `danger` to `LIVE · OFFLINE` and names no tone for
RECONNECTING; AC-C-24 pins the three readings, not the colour. Smallest change, in
`apps/core-web/src/components/shell/mode-indicator.tsx`: take the colour from the link rather than from
the label alone — `state === 'RECONNECTING' && isLinkUp(link) ? 'warning' : CHIP_COLOR[state]` — so
CONNECTING after a loss stays `danger` while the sticky notice is up (no amber/red alternation during an
outage) and RESYNCING, which the shell calls up, reads `warning`. One assertion changes in
`live-shell-indicator.test.tsx:252`. **Owning row: W54.** Recorded as CPW1-6 (Low) because it is a
presentation choice, not a broken flow.

### 6.3 F79 / F-15 — the displaced tab

**Ruled: no. A tab closed with "replaced by a newer connection" must keep reconnecting.** Stopping would
leave a signed-in console permanently blind — its only recovery control lives inside the very notice we
would suppress — and it would fight the server, which closes the oldest socket precisely so the newcomer
can proceed and expects the loser back (`apps/core-server/src/realtime/hub.ts:551`). It would also break
the native app: the same client serves it, and its cap of two exists for "the one socket and its
replacement while reconnecting" (D120 CPS1-5), where a reconnect after 1013 is the design, not a bug.

Where the decision lands: the close-code table and `handleClose` in
**`packages/shared/src/realtime/live-socket-client.ts`** (`:43` maps 1013 to WAITING with a timer;
`:889` passes `event.code` only). Note that a "stop when replaced" rule is not even implementable today:
1013 is shared by displacement and by the connection cap (`hub.ts:568` and `:685`, distinguished only by
the close **reason text**, which the client discards). That is the second reason to leave the behaviour
alone.

What the web may still fix, and where: the notice calls a reachable Core "unreachable" for one reconnect
delay. The smallest honest change is one more condition beside the existing 4401 carve-out in
**`apps/core-web/src/components/shell/live-notices.tsx:58`** (suppress the notice while
`live.socketStatus().lastCloseCode === 1013`, which the status already exposes at
`live-socket-client.ts:364-365`), leaving the indicator to say `LIVE · RECONNECTING`. I do **not**
require it before the page rows: it is a wording refinement (CPW1-11, Low, owner W54), the four-tab limit
is already routed to W86's README by D120, and any change to the shared client waits for the final shared
review (D107).

### 6.4 D128's note — the placement of `followServerPresentationMode`

**Ruled: it must not live in a feature folder now that the root route installs it; and it does not
belong in `lib/presentation-mode.ts` either. It moves to `apps/core-web/src/runtime/presentation-follow.ts`.**
Reasons: (i) since D128 the function runs on every route for the lifetime of the page
(`routes/__root.tsx:80`), so it is entry/root wiring, not Login behaviour — and `routes/**` importing a
feature's *internal* adapter (not its barrel, not a page component) inverts the layering that the rest of
`routes/**` respects (a route file imports the page it renders, `routes/login.tsx:1`); (ii) [CS] §7.3 G15
lists `presentation-mode.ts` as **"no change"**, so moving it there rewrites a closed predecessor file for
a function that is not about storage — it is about a Live source subscription that happens to write a
storage flag; (iii) `runtime/` already owns the exact same shape of thing: `query-bridge.ts` subscribes to
a Live source and applies the effect to a page-side object, and the root installs both in consecutive
lines (`__root.tsx:79-80`).

What moves with it: the function and its docblock (`features/login/live-adapter.ts:43-72`) →
`runtime/presentation-follow.ts`, re-exported from `runtime/index.ts`; `__root.tsx:26` then imports
`@/runtime`; `live-adapter.ts` keeps `useLiveCoreHealth` and its header comment shrinks; and W55's static
rule at `live-login-model.test.tsx:269-280` retargets (it currently pins both the definition site inside
the folder and the exact source text of `routes/__root.tsx` — CPW1-5). **Owning row: W55's follow-up slot**
(it is W55's function), landing in a path W50 owns — so the same controller-scheduled slot as 6.1, which
also explains why CPW1-4 is rated Medium rather than fixed on the spot.

### 6.5 What the rows W63..W82 must know before they start

See section 8 — that section is the answer, written to be pasted into a brief.

## 7. The findings

| # | Severity | Dimension | File:line | What and why | Owning row |
|---|---|---|---|---|---|
| CPW1-1 | 🔴 High | Duplication / reuse | `components/shell/mode-switch.tsx:30` vs `features/login/use-mode-switch.tsx:34` | Two confirmed-mode-change implementations, one identical set of test IDs pinned by four files; D128 point 4 promised the unification once W54 was gated and it has not happened. Nine page rows are about to read a seam table that names one of them. Ruled in 6.1. | controller slot (W54 + W55) |
| CPW1-2 | 🟠 Medium | Documentation accuracy | `implementation/54_web_shell_admin_routes.md:853-856` | **F76-13 is false.** It states that `core-endpoint.test.tsx` and `packaged-csp.test.ts` "have never existed in this repository". Both exist and both are blob-equal to `acaff20`: `apps/core-web/src/lib/__tests__/core-endpoint.test.tsx` = `89cab371…`, `apps/core-web/src/lib/__tests__/packaged-csp.test.ts` = `6d0db39e…` (`git cat-file -e acaff20:…` succeeds). The repair measured `apps/core-web/src/test/`, which is the wrong folder, and W50's own gate ran the correct paths (`50_web_runtime_mode.md` §16). Consequence: D136(g) accepted the claim and routed it to W88, which would print a false statement into the implementation report. The real (smaller) point is only that the plan cell names three files by basename without directories. Fix: correct §24.1's table and brief W88 with the corrected wording; the clause is **met by name** — all three are absent from `git diff --stat acaff20`. | W54's document; consumer W88 |
| CPW1-3 | 🟠 Medium | Test isolation / credential path | `features/login/live-adapter.ts:36`, `lib/core-endpoint.ts:107-113`, `runtime/testing/live-harness.ts` (no global `fetch` stub) | The health reader uses the **global** `fetch`, so it bypasses the typed client and the fake transport. Any Live test of any later row that lands on `/login` (a sign-out, a guard redirect) issues a real request attempt to `http://127.0.0.1:5178/api/v1/health` — noise under P11, a slow failure mode, and a result that depends on whether someone else's lane is listening. F77-6 knew; this checkpoint makes it a rule. Smallest change: `createLiveTestBed` sets `globalThis.fetch = fake.fetch` for the bed's lifetime and restores it on `dispose()`, and W55's three manual stubs move their answers into `fake.answer('getServiceHealth', …)`. (If the controller prefers not to touch the harness, the alternative is one line in `live-adapter.ts` switching to `live.client.call('getServiceHealth')` — which is also what [LS] row 21 says.) | W50 (harness) + W55 (its three stubs) |
| CPW1-4 | 🟠 Medium | Layering | `routes/__root.tsx:26` ← `features/login/live-adapter.ts:54` | The root route imports a helper from a feature folder although it is app-wide wiring. Ruled in 6.4: move it to `runtime/presentation-follow.ts`. | W55's follow-up, in W50's path |
| CPW1-5 | 🟠 Medium | Test quality | `test/live-login-model.test.tsx:269-280`; `test/live-shell-indicator.test.tsx:384-390`; `test/live-shell-admin.test.tsx:622-624` | Static tests pin the **source text of another row's file** (`routes/__root.tsx`) and exact CSS/JSX strings. A reformat with no behaviour change turns a gated row red, and CPW1-4's fix will break this one on purpose. Change the pins to a loose pattern (the symbol is installed once, by the root) or to the computed effect; keep the text pins for the CSP/bundling rules, which jsdom genuinely cannot observe. | W55 (the first pin), W54 (the other two) |
| CPW1-6 | 🟡 Low | Presentation truthfulness | `components/shell/mode-indicator.tsx:11` + `mode-indicator-state.ts:39` | `RECONNECTING` takes the outage colour while the same module calls RESYNCING "up", and the row's own test asserts both (`live-shell-indicator.test.tsx:252-253`). Ruled in 6.2. Also `mode-indicator-state.ts:22`: `(LIVE, null) → 'SIMULATED'` would print the opposite lie; unreachable through the component today, but the function is exported to page rows via `shell/index.ts:16`, so give it a comment or a distinct branch. | W54 |
| CPW1-7 | 🟡 Low | Failure presentation | `main.tsx:45` | `await bootCoreRuntime(...)` is not guarded; a rejected boot (a chunk that fails to load in dev, a throwing start-up) leaves `#root` empty — a white page with an unhandled rejection, and the refusal screen exists only for the host rule. Wrap it and render a static sentence; do not fall back to the simulator (AC-C-25). | W50 |
| CPW1-8 | 🟡 Low | Error handling / consistency | `components/shell/shell-report.ts:13` vs `features/login/report.ts:74-76` | The shell helper writes `error.message` and `error.stack` raw into the sink (and, in dev, into the console that Vite forwards to the terminal — F72-6), while W55 states the opposite rule for the same sink: "the text of an unknown error is not trusted to be free of input". Today's three call sites carry no input; page rows copying the helper for a mutation failure will not be so careful. Adopt the login discipline in the shared helper (name + code + status) as part of 6.1. | W54 (with CPW1-1) |
| CPW1-9 | 🟡 Low | Duplication | `features/home/use-health.ts:13`, `features/api-reference/service-banner.tsx:31`, `features/login/live-adapter.ts:33-41` | Three definitions of the same `['health']` query with three option sets. Understandable (each folder is closed to the other rows), but the next reader must not add a fourth. Decide one home when W84 converts the API Reference banner. | W55 (accepted) → W84 |
| CPW1-10 | 🟡 Low | i18n hygiene | `packages/shared/test/i18n.test.ts:2` | The header comment still says "13 namespaces" while `:93` pins 15. W54 edited this file under D126's grant and declined the comment (decision 14); one word, in a file already open. | W54 or W88 |
| CPW1-11 | 🟡 Low | Presentation | `components/shell/live-notices.tsx:58` | A displaced socket (close 1013) raises "Core server unreachable" for one reconnect delay although the Core answered. Optional one-condition carve-out, ruled in 6.3; the four-tab sentence belongs to W86's README. | W54 |
| CPW1-13 | ⚪ Info | Hidden state | `lib/core-endpoint.ts:55-63`, `router.tsx:47`, `live-harness.ts:402` | The endpoint row is a module-level mutable global written by the router factory. Safe in the app (one router per page load), and the harness resets it — but a row that builds its own router without the harness leaks `'LIVE'` into the next test in the same worker. Page rows: build routers through `createLiveTestBed`/`mount`, or reset it. | W50 (stated) |
| CPW1-14 | ⚪ Info | Mode isolation shape | `runtime/boot.ts:174` | `if (resolution.mode === LIVE && loadLive !== null)` falls through to the simulator. Unreachable (the same nullability already forced `dev` false at `:161`), so not a silent fallback — but the safety is spread over two lines. A stricter form returns REFUSED. | W50 |
| CPW1-12 | ⚪ Info | Credential redaction | `runtime/error-sink.ts:52` | `redactCredentials` blanks only `\b(ses\|dvc\|bio)_…`. It does **not** catch a pairing code (six digits), a password, or a token glued to a word character (e.g. `x_ses_…`). Reporters are the first line and stay the only real line: W81 must never put a code in a record, a toast description or a URL, and W84 must never put a generated API key in one. | W81, W84 (instruction) |
| CPW1-15 | ⚪ Info | This review's own footprint | `apps/core-web/dist` (git-ignored) | To check the CSP dimension on the current tree I ran `npm run build -w @dems/core-web`. npm forwarded my `--outDir`/`--emptyOutDir` flags to the script's second command (`tsc -b`), not to `vite`, so the bundle landed in the pre-existing, git-ignored `apps/core-web/dist` (created Oct 1) instead of `$TMPDIR`. No tracked file changed (`git status --porcelain apps/core-web/dist` is empty), no gate reads that path, and per M12 I did not `rm` inside the tree. Disclosed, not repaired. | none (stated) |

**Open blockers: 0.** The gate does not stop W63..W82; CPW1-1, CPW1-3 and CPW1-4 should land in one small
slot before the first page row leans on the mode-switch seam or writes a Live test that reaches `/login`.

## 8. What the page rows (W63..W82) must carry

Each line is a rule with its evidence; paste into a brief.

1. **One way in, always.** `useCoreActions()` + `settle` for an action; `useWebLive()?.client.call(operationId, input)`
   for anything else (`runtime/hooks.ts:19-21`, `runtime/index.ts:6-17`). Never `useSimActions`,
   `sim.actions`, `SimContext`, `live.source`, a typed client of your own, or a second socket — the static
   scan in `live-runtime-static.test.tsx` fails the whole workspace, not just your row.
2. **Hand every error to the presenter first.** `const presented = presentCoreError(error); if (presented !== null) return;`
   then your own case (`lib/core-errors.ts:187-190`). Rows 2-8 coalesce at 3 s; PERMISSION never does.
   A 429 is a limit, not an outage (LB-10): never write your own "unreachable" or "rate-limited" sentence.
3. **Cache contract.** Every Core list lives under `CORE_QUERY_KEYS` (`runtime/query-bridge.ts:43-49`) —
   nothing else may start a key with `'core'`, or the clearing misses it and PG-6a leaks one operator's
   rows to the next. `retry: false` is already applied (`:61-67`); do not set it again. Anything you hold
   outside the cache subscribes with `onCoreQueriesCleared(queryClient, …)` (`:90-100`) — that is how W81
   drops a pairing code (AC-C-106).
4. **Never persist a secret.** The sink's redactor covers only `ses_`/`dvc_`/`bio_` (CPW1-12): a pairing
   code, a password or a generated key in a record, a toast description, a URL or a query key is a defect
   you cannot undo later (AC-C-106, AC-C-107, AC-C-96).
5. **A Live test needs three things.** The docblock page address `http://127.0.0.1:5178/` (jsdom's default
   is `localhost:3000`, which sends your endpoints to mock-core while the harness refuses off-origin
   requests — F72-10); `clearToasts()` between tests and toast queries scoped to `[data-slot="toast"]`
   (F76-9); and a 403 named by its example, `fake.example(op, 403, 'notPermitted')` — the **first** 403
   example of every operation is `deviceRevoked` (F76-8). Add the global-`fetch` stub until CPW1-3 lands
   (F77-6).
6. **The shell already says these things.** No outage notice of your own (§3.5); no role-change toast
   (§6.3); disable commands with `useLiveLink()` if you want CL-22 locally. A new permission-gated route
   needs a `beforeLoad` guard **and** an entry in `ROUTE_PERMISSIONS`
   (`components/shell/route-permissions.ts:14-18`) so the notice can name the page it left.
7. **The seam table is W54 §21.2**, with one correction pending: the mode switch is
   `useModeSwitch()` from `@/components/shell` — after CPW1-1 it is the only copy; do not import anything
   mode-related from `@/features/login`. `LiveOnlyState` is the shared "Live mode only" surface, and its
   `.dems-live-only-card` class does not centre itself — W77/W81 must wrap it in their own grid (F76-12).
   The top bar is full: another item needs another yield rule.
8. **Namespace ownership.** Your words go in your own `en/<page>.ts`; `shell.*` is W54's, `login.*` is
   W55's, `common.{coreMode,coreLink,coreErrors,liveHost}` are W50's and closed. `usersRoles`/`pairedDevices`
   exist with `title`, `subtitle`, `states.liveOnly` and are yours to extend (`02_plan.md:404`). Adding a
   namespace file needs the granted line in `packages/shared/test/i18n.test.ts` (D126's precedent).
9. **Do not touch:** `lib/packaged-csp.ts`, `vite.config.ts`, `runtime/**`, `lib/core-endpoint.ts`,
   `lib/core-errors.ts`, `lib/presentation-mode.ts`, `components/shell/**`, `routes/**` except your own
   page's route file, and the six protected test files (`test/routes.test.tsx`,
   `test/sim-fetch.test.ts`, `features/storage/__tests__/storage-page.test.tsx`,
   `lib/__tests__/{core-endpoint,packaged-csp}.test.ts`) — AC-C-35, AC-C-36, AC-C-101, CLG (a)-(d).
   `routeTree.gen.ts` is regenerated by the router plugin on every Vitest start: commit it and re-run
   your tests after another row's regeneration (F76-2).
10. **Ledger for your gate.** `@dems/core-web` is 55 files / 759 tests exit 0; `@dems/shared` 68 / 1,814
    exit 0; `typecheck` and `lint` exit 0. That is your pre-image, not `acaff20`.

## 9. Fix order (proposal)

| Order | Item | Why here | Owner |
|---|---|---|---|
| 1 | CPW1-2 — correct §24.1 and re-brief W88 | Cheapest, and it stops a false statement reaching the final report | the row's document + controller |
| 2 | CPW1-1 + CPW1-8 (one slot: unify the mode switch, adopt the record discipline) | Nine rows read this seam; do it before they start | controller slot over W54/W55 paths |
| 3 | CPW1-4 + CPW1-5's first pin (move `followServerPresentationMode`, retarget the static rule) | Same files as step 2 (`__root.tsx`, `features/login/**`); one landing | same slot |
| 4 | CPW1-3 (stub global `fetch` in the harness) | Every Live page test that reaches `/login` inherits it | W50 harness + W55's three stubs |
| 5 | CPW1-6, CPW1-7, CPW1-11 | Small, independent, no dependent row | W54, W50 |
| 6 | CPW1-9, CPW1-10, CPW1-12, CPW1-13, CPW1-14, CPW1-15 | Close-out and instruction items; carry them to W87/W88/W86 and the client security review W100 | as named |

## 10. What was not verified

No lane or device run (this is a read-only review and two other agents hold the lanes). The three rows'
browser evidence was read, not repeated: W50's `50_console_live_signed_in.png` and Simulated console,
W54's 23 screenshots and `54_lane_measure.log`, W55's `55_live_login_page_before.png` and
`55_live_login_signed_in_as_admin.png`. The mutation runs were quoted, not re-executed (W50: 191 of 192, one equivalent
survivor; W54: 133 of 137 killed, the four survivors the row names in its section 17; W55: 68 changes,
68 detected on the final tree). `npm run test:db` and anything touching
`apps/core-server` were out of scope by instruction. The packaged CSP was verified by blob equality, by
reading the module, and by a fresh non-packaged build; I did not run the `VITE_DEMS_CORE_ORIGIN=same-origin`
build (W50 did, twice, and the module has not changed since).

## Files reviewed

Production: `apps/core-web/src/{main.tsx,router.tsx}`, `runtime/{boot,core-mode,error-sink,hooks,index,
live-host,live-host-refusal,live-start,owed-sign-out-storage,query-bridge}.ts(x)`,
`runtime/testing/live-harness.ts`, `lib/{core-endpoint,core-errors,packaged-csp,presentation-mode}.ts`,
`routes/{__root,login,-search}.tsx`, `routes/_app.tsx`, `routes/_app/admin/{-guard,users,devices}.tsx`,
`components/shell/{app-shell,index,live-only-state,live-notices,mode-indicator,mode-indicator-state,
mode-switch,nav-items,route-permissions,shell-report,sidebar,top-bar,use-shell-layout,use-visible-nav-items,user-menu}.tsx?`,
`features/login/{auth-card,brand-panel,device-strip,index,live-adapter,login-alert,login-choreography,
login-live-model,login-model,mode-selector,report,sim-adapter,use-login-controller,use-mode-switch}.ts(x)`,
`features/{users-roles,paired-devices}/index.tsx`, `features/home/use-health.ts`,
`features/api-reference/service-banner.tsx`, `packages/shared/src/{client/core-client.ts,
realtime/{live-socket-client,heartbeat-context,hooks}.ts(x), live/{hooks,source/live-sim}.ts,
i18n/{index,en/shell,en/common,en/users-roles}.ts, sim/{auth,heartbeat}.ts(x)}`.
Tests: `live-runtime-{mode,startup,bridge,sink,storage,surface,static}.test.tsx`,
`live-shell-{indicator,notices,admin}.test.tsx`, `live-login-{page,signin,presentation,model}.test.tsx`,
`lib/__tests__/{core-endpoint,packaged-csp}.test.tsx`, `packages/shared/test/i18n.test.ts`.
Docs: the three rows' reports, `01_gate_report.md`, `07_cp_shared_client.md`, plan sections 4.3, 8.1, 11,
[CS] §3, §4.2, §5, §6.3-6.5, §7.3, §10.1, §13, decisions D29, D113, D120, D121, D126, D128, D136-D141.

Assets: `assets/08_protected_artefacts.txt`, `assets/08_credentials_build_checks.txt`,
`assets/08_mode_switch_pins.txt`, `assets/08_command_totals.txt`.

---

# Part two — the fix round of CP-W1 (decision D144), landed 2026-10-05

Written by the round itself (`coder-execution-local`, the single writer of `apps/core-web/**` while the
backend gate W58 runs). Sections 0-10 above are the review and are **unchanged**; this part records what
was done with its rulings. Numbering starts at 22 as the brief asked; 11-21 stay unused so a later pass
of the review can keep its own numbers.

## 22. The frame of the round

| # | Finding | Ruling applied | Files the landing wrote | Landing gate |
|---|---|---|---|---|
| 1 | CPW1-1 (High) with CPW1-8 (Low) | D144(1) | `components/shell/mode-switch.tsx`, `components/shell/shell-report.ts`, `features/login/index.tsx`, `features/login/auth-card.tsx`, `features/login/mode-selector.tsx`; deleted `features/login/use-mode-switch.tsx`; `test/live-shell-indicator.test.tsx`, `test/live-login-page.test.tsx` | web 55 / **760** exit 0, typecheck 0 |
| 2 | CPW1-6 (Low) | D144(2) | `components/shell/mode-indicator.tsx`, `components/shell/mode-indicator-state.ts`, `test/live-shell-indicator.test.tsx` | web 55 / 760 exit 0 |
| 3 | CPW1-4 (Medium) with CPW1-5's first pin | D144(4) | `runtime/presentation-follow.ts` (new), `features/login/live-adapter.ts`, `routes/__root.tsx`, `test/live-login-model.test.tsx`, `test/live-login-presentation.test.tsx` | web 55 / 760 exit 0, logged as `08_fix_item3_suite.log` |
| 4 | CPW1-3 (Medium) | D144 (last paragraph) | `runtime/testing/live-harness.ts`, `test/live-login-page.test.tsx`, `test/live-runtime-startup.test.tsx` | web 55 / 760 exit 0, logged as `08_fix_item4_suite.log` |
| 5 | CPW1-5 (Medium), rest of it | report §5.6 | `test/live-shell-indicator.test.tsx`, `test/live-shell-admin.test.tsx` | web 55 / 760 exit 0, logged as `08_fix_item5_suite.log` and `08_fix_final_suite.log` |

**Honoured while the gate ran.** No lane, no Vite dev server, no browser session, no device session
(P9 reserves the live checks away from the gate); nothing written outside `apps/core-web/**` except this
report, `assets/08_fix_*` and my own progress file (P6, P8); `packages/shared/**` read only — its suite
was re-run and is unchanged; every mutation ran on a copy under `$TMPDIR`, never in the tree (M15); no
credential, token, cookie or password appears in any file of this round (P19).

**Pre-image.** `.cache/rollback/CPW1/apps-core-web.pre.patch` (`git diff acaff20 -- apps/core-web`,
saved before the first edit) covers every tracked file of the round; the untracked production files have
file copies under `.cache/rollback/CPW1/`. See deviation DV-a in section 31 and `08_fix_files_written.txt`.

## 23. Item 1 — CPW1-1 with CPW1-8: one copy of the confirmed mode change

The Login page's copy is gone; the shell's copy is the seam, carrying the three things the login copy
did better. Nothing else in the console defines a mode change.

| Part | Before | After |
|---|---|---|
| The copies | `components/shell/mode-switch.tsx:30` **and** `features/login/use-mode-switch.tsx:34` (102 lines) | one file: `components/shell/mode-switch.tsx:41`; the other moved out of the tree to `.cache/rollback/CPW1/removed/use-mode-switch.tsx` (nothing destroyed) |
| `switching` | private state of the shell copy; exposed by the login copy | exposed: `ModeSwitch.switching` (`mode-switch.tsx:14`) and returned at `:103` |
| The record of a failed switch | `reportShellError('shell.modeSwitch', error)` → the sink held `error.message` and `error.stack` verbatim | `mode-switch.tsx:72`: `reportShellError(source, error, 'The data mode could not be changed.', { from: control.mode, to: target })` |
| Who is named in the log | `'shell.modeSwitch'` only | `useModeSwitch(source = 'shell.modeSwitch')`; the Login page passes `'login.modeSwitch'` (`features/login/index.tsx:63`) |
| `shell-report.ts` (CPW1-8 proper) | `message: error.message`, `stack: error.stack` | a caller's fixed sentence (default `'A shell control could not complete its action.'`) plus `{ errorName, code?, status? }`; the raw text and stack are never written |
| The Login page's types | `LoginModeSwitch` from `./use-mode-switch` | `ModeSwitch` from `@/components/shell/mode-switch` (`auth-card.tsx:23`, `mode-selector.tsx:11`) |

**Proof** (each number a delta on the scratch baseline, section 29). R1, writing the raw message
again, reddens exactly the two assertions that read the record — the shell's at `:358` and the Login
page's new one. R2, dropping the `source` argument, reddens the Login page's new test alone. R3,
renaming the surviving copy's dialog test ID, reddens **twelve tests spread over all four pinning
files**, which is the direct evidence for the review's claim that those four reach the dialog through
their own surface and import neither hook. The folder scan of W55 still reads its files: 17 production files, the rule asks for 16.

**The one by-design test change** (asked of the controller on the board, pattern of D139 DN-1):
`test/live-shell-indicator.test.tsx:358` pinned the shell's sink record as
`message: 'the storage is gone'` — the raw text of the error, which CPW1-8 forbids. It now pins the
fixed sentence, the context and the absence of the raw text:

```ts
expect(written).toEqual([expect.objectContaining({
  level: 'error', source: 'shell.modeSwitch',
  message: 'The data mode could not be changed.',
  context: { from: 'SIMULATED', to: 'LIVE', errorName: 'Error' },
})])
expect(JSON.stringify(written)).not.toContain('the storage is gone')
```

No alternative exists: the assertion is an exact one-element array, so a fixed sentence cannot coexist
with the old text. One test was added (`live-login-page.test.tsx`, "a switch that throws is recorded by
this page under `login.modeSwitch`"), which is why the ledger moves 759 → 760.

## 24. Item 2 — CPW1-6: the tone of a self-recovering state

One expression, as ruled, in `components/shell/mode-indicator.tsx:43`:

```ts
const tone = state === 'RECONNECTING' && isLinkUp(link) ? 'warning' : CHIP_COLOR[state]
```

RESYNCING — which `mode-indicator-state.ts:38` already calls up — reads `warning`; CONNECTING keeps
`danger`, so the chip and the sticky notice say the same thing through an outage. The second half of
CPW1-6 is the comment at `mode-indicator-state.ts:22-26` naming what `(LIVE, null)` means for a caller
outside the shell, and the table row of its docblock now states both colours.

**Test.** `live-shell-indicator.test.tsx:252-253` is the one assertion the ruling named
(`chip--danger` → `chip--warning`, with the "the link is up" comment kept beside it). The round added a
sweep beside it (`:225-234`): through six samples of the retry window after a real loss the chip is
never amber. **Proof:** mutation T2 (colour from the label alone again) reddens line 253. T1 (every
RECONNECTING reads warning) **survived** — see section 29 for why and what would close it.

## 25. Item 3 — CPW1-4 with CPW1-5's first pin: the follow-up leaves the feature folder

| Before | After |
|---|---|
| `features/login/live-adapter.ts:54` defined `followServerPresentationMode` | `runtime/presentation-follow.ts:37` defines it, beside `query-bridge.ts`, with the docblock that says why (D144(4), [CS] §7.3 G15) |
| `routes/__root.tsx:26` imported it from `@/features/login/live-adapter` | `routes/__root.tsx:30` imports it from `@/runtime/presentation-follow`, one line under the `attachQueryBridge` import |
| `live-adapter.ts` also carried `selectServerPresentation` and the storage imports | it keeps `useLiveCoreHealth` alone; its header names where the follow-up went |
| `test/live-login-model.test.tsx:269-280` pinned the definition site inside the folder **and** the exact source text of `routes/__root.tsx` | retargeted and loosened (`:273-284`): the root installs the call exactly once inside a `useEffect` whose dependency list is `[live]` (a bounded pattern, not a literal), nothing in the folder names the symbol, and the definition site is asserted in `runtime/presentation-follow.ts` |
| `test/live-login-presentation.test.tsx:34` mocked `@/features/login/live-adapter` to count installs | mocks `@/runtime/presentation-follow` (the same counting wrapper, the same five tests) |

Two deliberate differences from §6.4's wording, both small and both stated: the **barrel is untouched**
(`runtime/index.ts` exports no new name) because `live-runtime-surface.test.tsx:36-58` pins the exact
export list of `@/runtime` and `__root.tsx` already imports its sibling by module path
(`attachQueryBridge`); and the record's `source` moved from `'login.presentationMode'` to
`'runtime.presentationMode'`, since after the move the old name would lie. Nothing pinned either string.

**Proof.** Mutations P1 (the flag is never written) and P2 (no `fireImmediately`) redden
`live-login-presentation.test.tsx` (4 of 5 and 2 of 5); P3 (install it twice in the root) is reddened by
the retargeted static rule, which shows the loose pattern still counts what matters.

## 26. Item 4 — CPW1-3: the bed owns the global `fetch`

The smallest change the review proposed, taken whole, with one addition the review's own harness design
asked for. In `runtime/testing/live-harness.ts`:

| Line | What |
|---|---|
| `:226-238` | `healthAnswer(now)`: the public health body of the bed's model Core (`dems-core-server` 0.2.0, ready database and engine) |
| `:240-256` | `holdGlobalFetch()`: puts `fake.fetch` on `globalThis.fetch` and returns its release; a registry of live beds means a newer bed keeps ownership and the last release puts back what was there before |
| `:268` | every `createLiveTestBed()` takes the hold; `:455` `dispose()` releases it, before `fake.assertNoViolations()` |
| `:373` | `answered('getServiceHealth', …)`: the bed answers health **by what its model Core holds**, on the same reachability rule as every other answer of the bed (`OUTAGE` while `core.reachable` is false) |

A Live test of any later row that lands on `/login` therefore cannot issue a real request attempt: the
call is contract-checked and logged like any other. A row that wants another answer scripts
`fake.answer('getServiceHealth', …)`; a row that wants to prove nothing was asked reads
`fake.log.requestsOf('getServiceHealth')`.

**W55's manual stubs.** `live-login-page.test.tsx` moved its four health assertions to the transport
(the device strip's origin check, the failed answer, the "starting" answer, the Retry refetch count);
its `beforeEach` stub stays and is now commented for what it still does — proving that a **Simulated**
page asks nothing of a server, which needs a spy precisely because no bed exists there. The health
answer of the failed case became the fake's `OUTAGE` rather than a hand-built `Response('{}', {status:
503})`: the contract documents only a 200 for `getServiceHealth`, so an outage is the honest way to ask
for "no answer" (same UI: the cells read Unknown, sign-in stays enabled).

**Proof.** H1 (the bed stops owning the global `fetch`) reddens the four Login-page tests whose
health assertions read the transport — with the hold gone they fall back to the file's own spy, which is
exactly the bypass CPW1-3 named. H2 (leave `getServiceHealth` unscripted) reddens **28 of 31**: every
page of the file then meets an unscripted request, which the fake records as a violation and
`dispose()` throws. `live-runtime-startup.test.tsx:288-292`
(AC-C-37, the Stack Check page in Live mode) now reads the same truth from `bed.fake.log`.

## 27. Item 5 — the rest of CPW1-5

| Pin | Before | After | Proof |
|---|---|---|---|
| `live-shell-indicator.test.tsx:403-443` (the widths) | four `toContain` calls over the whole whitespace-normalised stylesheet, each an exact rule string | the blocks are **read**: `mediaBlocks()` extracts every `@media <condition>` block by brace matching and `blockHides()` asks whether a selector that *ends with* the class hides it, optionally requiring the Live mode key on that same selector | mutations C1 (hide another item), C2 (lose the mode key), C3 (yield at another width), C4 (drop the clock rule) — all four reddened. C1 and C2 survived the round's FIRST helper, which matched `.dems-topbar-date + .dems-topbar-sep` as hiding the date; the helper was tightened and both were re-run |
| `live-shell-admin.test.tsx:622-624` (the leave path) | read `live-notices.tsx` and asserted it contains `router.invalidate()` and does not contain `navigate(` | dropped: the two assertions above it measure exactly that on the running router (`invalidate` called, `navigate` not called). A text pin of another row's file only adds a way for a reformatting to redden a gated row | the behavioural pair stays and is what W54 already proved |
| `live-login-model.test.tsx:269-280` | see section 25 | see section 25 | mutation P3 |

What CPW1-5 asked to KEEP is kept: the CSP and bundling text pins of `live-runtime-static.test.tsx`
(jsdom genuinely cannot observe those) are untouched, and the JSX-order pin of the top bar
(`live-shell-indicator.test.tsx:400`) stays as the literal it is, because "the indicator sits between the
device block and the bell" is exactly the guarantee AC-C-24 needs.

## 28. What was measured (every line quoted from the round's own runs)

| Command | Result | Asset |
|---|---|---|
| `npm run test -w @dems/core-web -- --maxWorkers=2` | exit **0** — `Test Files 55 passed (55)`, `Tests 760 passed (760)` | `08_fix_final_suite.log`. The same totals were measured after every landing: items 3, 4 and 5 are logged (`08_fix_item3_suite.log`, `08_fix_item4_suite.log`, `08_fix_item5_suite.log`, each 55 / 760 exit 0); the two runs of items 1 and 2 were read in the terminal before the logging habit of the round started, and the run before the round (55 / 759, exit 0) is the baseline they were compared against |
| `npm run typecheck -w @dems/core-web` | exit **0** | `08_fix_typecheck.log` |
| `npm run lint -w @dems/core-web` | exit **0**, no finding | `08_fix_lint.log` |
| `npm run test -w @dems/shared -- --maxWorkers=2` | exit **0** — `Test Files 68 passed (68)`, `Tests 1814 passed (1814)` — unchanged; shared was read, never written | `08_fix_shared_suite.log` |
| `npm run build -w @dems/core-web` | exit **0**; 529 files; **0** assets contain `unsafe-eval`, **0** `new Function(`, **0** `eval(`; the four Live markers (`createLiveSim`, `browser-cookie`, `dems.live.owedSignOut`, `live-start`) are 0 files each, as in section 4 | `08_fix_build.log`, `08_fix_csp_scan.txt` |
| `git hash-object` over the protected artefacts | `packaged-csp.ts` `78c8898e…`, `packaged-csp.test.ts` `6d0db39e…`, `core-endpoint.test.tsx` `89cab371…`, `routes.test.tsx` `7a04c97d…` — all four unchanged by the round; W01's two files still print W01's state (`9e8b97c8…`, `71f6f033…`) | `08_fix_protected_artefacts.txt` |

Ledger for the next web row: **`@dems/core-web` 55 files / 760 tests**, `@dems/shared` 68 / 1,814,
typecheck and lint exit 0. That replaces the 759 of section 8 rule 10; the +1 is the Login page's own
mode-switch record test. Nothing else moved: no test file was deleted and no assertion was weakened
except the two text pins of section 27, each replaced by something that measures more.

## 29. The mutation check (M15: a copy under `$TMPDIR`, the tree never touched)

Fifteen single mutations, each applied to a scratch copy of the tree under `$TMPDIR`, run against the
files named for it, and put back; the script (`08_fix_mutate_script.txt`) runs the **baseline of every
file set first** and reports each verdict as a delta on it, because the scratch copy is not the
workspace: three `/session/new` tests of `live-shell-admin.test.tsx` are red in it for an environment
reason and green in the workspace (the whole-suite run of section 28 is the workspace truth). The record
is `08_fix_mutations.log`.

| # | Mutation (what it un-does) | Tests run | Delta | Verdict |
|---|---|---|---|---|
| R1 | the sink writes the raw message again (CPW1-8) | indicator + login page | +2 over 0 | DETECTED |
| R2 | the Login page stops naming itself (the `source` argument) | login page | +1 over 0 | DETECTED |
| R3 | the surviving copy renames its dialog test ID | all four pinning files | +12 over 3 | DETECTED |
| R4 | the switch stops refusing a second press while it runs | indicator | +0 | SURVIVED |
| T1 | the tone ignores the link: every RECONNECTING reads warning | indicator | +0 | SURVIVED |
| T2 | the tone comes from the label alone again (D144(2)) | indicator | +1 | DETECTED |
| P1 | the follow-up never writes the tab-local flag | presentation | +3 over 0 | DETECTED |
| P2 | the follow-up does not fire at the load | presentation | +1 over 0 | DETECTED |
| P3 | the root installs the follow-up twice | model (the retargeted rule) | +1 over 0 | DETECTED |
| H1 | the bed stops owning the global `fetch` (CPW1-3) | login page | +4 over 0 | DETECTED |
| H2 | the bed leaves `getServiceHealth` unscripted | login page | +28 over 0 | DETECTED |
| C1 | the 1520 px block hides another item | indicator | +1 | DETECTED |
| C2 | the Live-only date rule loses its mode key | indicator | +1 | DETECTED |
| C3 | the date yields at another width than the measured one | indicator | +1 | DETECTED |
| C4 | the clock rule of 432 px is gone | indicator | +1 | DETECTED |

**13 of 15 detected.** Two notes on how they were found, both kept in the open:

* The first pass of this check ran against a scratch copy whose `node_modules` resolved `@dems/shared`
  back into the workspace, which made unrelated tests red and inflated every number. The copy was
  rebuilt with in-tree resolution and the whole set re-run; the table above is the second pass. The
  first pass also let mutation **P2** look detected when it equalled its own baseline — the baseline
  pass is what caught that, and P2 is detected properly now (+1).
* Mutation **C1** survived the round's FIRST helper, which matched `.dems-topbar-date + .dems-topbar-sep`
  as hiding the date. The helper was tightened to require a selector that ends with the class, and C1,
  C2 were re-run with both selectors mutated; C3 and C4 were added. All four are detected now.

The two survivors, with their cause:

* **R4** is not new: it is W54's own survivor **W11** of D136(f), already measured equivalent — the
  confirm button is `isPending={switching}`, so a second press never reaches `confirm()`. The round did
  not touch that guard.
* **T1** is a gap in coverage, not a wrong colour: no test of the suite ever *observes* a CONNECTING
  instant. After `core.unreachable()` the link sits at OFFLINE between attempts, and the fake's refusal
  returns it there inside the same act, so the sweep added in section 24 proves "never amber during an
  outage" without distinguishing CONNECTING from OFFLINE. Closing it needs the colour rule as a pure
  function beside `modeIndicatorState` (a unit pin of both halves); that is a shape change to W54's file
  beyond D144(2)'s "one expression", so it is left as **DN-2** rather than done here.

## 30. Closed here, and what is left with its owner

**Closed by this round:** CPW1-1 (High), CPW1-3, CPW1-4, CPW1-5 (all three pins), CPW1-6 (both halves),
CPW1-8. Six of the eleven findings, including the only High.

| Finding | Status after the round | Owner | Why not here |
|---|---|---|---|
| CPW1-2 (Medium) | **open** | W54's document; consumer W88 | It lives in `implementation/54_web_shell_admin_routes.md` §24.1 — another row's document, outside my write path and forbidden by the brief. D144 already superseded D136(g) and withdrew F76-13, so the false sentence now exists only in that table; it still has to be corrected there |
| CPW1-7 (Low) | **open** | W50 | Not a one-line fix: `main.tsx`'s static and dynamic import lists are pinned by `live-runtime-static.test.tsx:106-134`, so a guarded boot with its own fallback needs that pin changed too — a design choice for the row, not a cheap repair |
| CPW1-9 (Low) | **open, accepted** | W84 | The review itself defers the choice of one home for `['health']` to the row that converts the API Reference banner |
| CPW1-10 (Low) | **open** | W54 or W88 | One word in `packages/shared/test/i18n.test.ts:2`; `packages/shared/**` is closed to this round while W58 runs |
| CPW1-11 (Low) | **open, optional by ruling** | W54 | D144(3) calls the carve-out optional. Suppressing an outage notice on `lastCloseCode === 1013` turns a safety surface off under a condition whose reset semantics live in the shared client, and proving it wants a lane or a browser — both reserved away from the gate (P9). The four-tab sentence belongs to W86's README |
| CPW1-12 … CPW1-15 (Info) | stated, nothing to write | as named in section 7 | instructions to W81/W84/W86 and the shape notes of W50 |

The page-row carry list of section 8 stands unchanged except two lines: rule 7's seam is now true as
written (`useModeSwitch()` from `@/components/shell` is the only copy), and rule 5's "add the global
`fetch` stub until CPW1-3 lands" is retired — since this round a Live test gets health from its bed and
must script `fake.answer('getServiceHealth', …)` for anything else. Rule 10's ledger is 760.

## 31. Deviations and the decisions the round needs

**DV-a — incomplete pre-images.** The tracked files of the round are covered by
`.cache/rollback/CPW1/apps-core-web.pre.patch`, and seven untracked production files have file copies
there, but eight untracked files (two sources, six tests) were edited after that copy pass and have no
byte-level pre-image. Every one of their changes is quoted before/after in sections 23-27, which is the
reconstruction guide. The pattern is D139's DV-5/DV-6, disclosed rather than repaired.
**DV-b — the import path.** `features/login/index.tsx` imports `useModeSwitch` from
`@/components/shell/mode-switch` (a module path, as `@/components/shell/shell-entrance` already does at
`:37`) rather than from the barrel, and `runtime/index.ts` gained no export: the barrel would pull the
whole shell into the Login page's chunk and would break the exact export list that
`live-runtime-surface.test.tsx:36-58` pins. The promise to the page rows — "`useModeSwitch()` from
`@/components/shell`" — is unaffected: the barrel still exports it.
**DV-c — one record renamed.** `'login.presentationMode'` became `'runtime.presentationMode'` with the
function's move; nothing pinned either string.
**DV-d — the build's footprint.** Like CPW1-15, `npm run build -w @dems/core-web` wrote into the
pre-existing git-ignored `apps/core-web/dist`; `git status --porcelain apps/core-web/dist` is empty and
nothing was deleted (M12).

| DN | What the round asks | Context |
|---|---|---|
| DN-1 | record `test/live-shell-indicator.test.tsx:358` as the by-design test change of D144(1)+CPW1-8 | posted on the board with the before/after; P24 asks that an existing test change be recorded |
| DN-2 | whether to give the chip colour a pure home beside `modeIndicatorState` so mutation T1 can be caught | closes the last coverage gap of item 2; touches W54's file beyond the ruled "one expression", so it was not done unilaterally |
| DN-3 | confirm that the ledger moves to 55 / 760 and that section 8 rule 5's fetch-stub sentence is retired | every later web row reads section 8 |
