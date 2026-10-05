---
task_slug: dems_backend_rbac_pairing
step: 79
plan_row: W57
date: 2026-10-04
agent: coder-execution
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
tier: 2
status: needs-review
---

# 57. Mobile pairing flow on the existing Pair screen (step 79, W57)

Sources: `masterplan/04_client_integration_spec.md` rev 2.2 [CS] §9.4, §9.6, §6.6, §3.2, §3.5, MP-5 to
MP-8a; `implementation/51_mobile_runtime.md` (the runtime this row builds on, section 4 and its
seams); `implementation/32_pairing_device_registry.md` §11.3 (what the server answers);
`implementation/44_live_source.md` §17.4 (rows 8 to 15, 18, 20, 25 to 27); `test/04_pairing_lifecycle.md`
(finding F76); decisions D116, D118, D124.

## 1. Result at a glance

**Status: needs-review.** The flow is built, tested on the fake transport, checked by mutation and
run on the tablet against the real Core server: **the tablet paired with a code issued by the lane 2
backend and is left paired as `DEV-0001`.** ONE point needs a ruling before the row can be called
complete, and it is not a defect this row introduced: **when the tablet is turned from landscape
to portrait while the Pair screen is open, the connection pane is squeezed to 144 dp and its
content is clipped. It happens in Simulated mode too, with the code of `acaff20`** (finding F-1,
decision DN-1). Started in portrait, and in landscape, both panes are unclipped in both modes. The
fix is one line of this row's folder, but it changes a Simulated layout, which the plan forbids
this row (section 17, KI-01: "no Simulated layout changes"). Everything else is done.

| Item | Result | Evidence |
|---|---|---|
| First item (a) of D124: the Pair screen in LIVE mode never says it is simulated, and shows no empty Core identity | Done. Chip `LIVE`; a LIVE subtitle; "Not paired. The Core identity is shown after pairing."; the identity list holds what the tablet knows. Simulated mode: every text as it was (one digest over its 51 texts, equal to `acaff20`) | Sections 3.1, 4.3; screencaps `57_tablet_landscape_unpaired.png`, `57_tablet_landscape_simulated.png` |
| First item (b) of D124: Stack Check prints the answering service | One line, `features/home/home-screen.tsx:217`. LIVE: "core-server v0.2.0 · api v1"; mock-core: "mock-core v0.1.0 · api v1", unchanged. The `dems-` prefix is not printed (deviation DV-2) | Section 3.1; `stack-check-service-name.test.tsx` |
| CLG (a): the folder's existing tests pass, their files are those of `acaff20` | `git diff --stat acaff20` over the two files prints nothing; `git hash-object` equals the blob of `acaff20` for both; 15 tests pass | Section 4.2; `assets/57_clg_evidence.log` |
| CLG (b): Live tests on the fake transport per settle site (`pair`, `unpair`): success, the site's refusal, an outage | 25 Live tests in `pairing-live.test.tsx` (the file holds 27: two more are of Simulated mode) | Section 4.3 |
| CLG (c): no `useSimActions`, no `.actions` read on a `Sim` | `grep` finds none; a static test holds it | Section 4.2 |
| The row's Live cases: a correct code, a wrong code with the lock's count, a 423 countdown, a 429 as a limit, cancel before `commitAt` (no request), unpair while offline (refused), the credential written before the action settles (the action killed between the answer and the settle), re-pairing after a reinstall | All eight covered, each by a named test | Section 4.3 |
| The marker code is in no storage and no log (SD-23) | jest: searched in AsyncStorage (the persisted runtime log included), the secure store, the runtime log, the Live source's reports, the replica and the console: 0; found in the redeem request, where it must be. Device: the issued code counted in the device log (every tag), AsyncStorage, the backend log and this check's files: 0 | Sections 4.4, 4.7 |
| Mutation check (rule M15: the tree is not edited) | Run 1 (2026-10-04 21:35:20): 82 of 89 changes detected, 6 survivors and 1 not applied; every survivor led to a test, two also to a production line. Run 2 (21:58:14): the 27 re-tested changes all detected, 0 survivors, exit 0. The nine mutated files' SHA-256 identical before and after — the harness never edited the tree. Re-confirmed read-only by the verifier (`06a_w54_w57_gate_evidence.md` C.4). Assets `57_mutations_run1.log`, `57_mutations_run2.log` | Section 4.5 |
| `npm run test -w @dems/mobile -- --maxWorkers=2`, `typecheck`, `lint` | Fresh 2026-10-05 11:36–11:38: whole workspace **92 suites / 1,207 tests / exit 0**; the folder's six suites **6 / 66 / exit 0** (per file 8/7/2/12/10/27); `typecheck` **exit 0**; `lint` **exit 0**. The whole-workspace total is above the ledger because other rows added suites after the baseline (W59's `features/login/**`, all green under jest); this row's own share is the pairing folder plus the one granted line. See §4.6 for the runner output and the P11 attribution of the verifier's earlier login-folder reds | Section 4.6 |
| Device check, lane 2, `dems2_tablet` | Paired with a code issued by the lane backend: redeem 201, the same request ID in the device log and in the server log; a DEVICE socket `device:DEV-0001`; the credential entry in the secure store; a cold start in LIVE mode reads it and the Core confirms the registration (operation 21: 200) | Section 4.7 |
| Both panes in portrait and landscape | Unclipped when the screen is started in that orientation (portrait 364 dp and 364 dp; landscape 616 dp and 440 dp), in both modes. Clipped after a turn from landscape to portrait while the screen is open, in both modes (F-1) | Section 4.7; nine screencaps |
| Device security | `emulator-user-lock.sh status tablet` printed the same line at 20:34:33 and at 22:00:53: `isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1` (the PIN and the fingerprint are the user's own set-up of about 20:33, before this row's first device command; the controller's note). No lock, PIN, fingerprint or device setting was set, changed, cleared or typed by this row | `assets/57_lock_status_start.txt`, `57_lock_status_end.txt` |

## 2. Files

| File | Kind | What |
|---|---|---|
| `apps/mobile/src/features/pairing/use-pairing-flow.ts` | changed | The controller in both data modes: `useCoreActions` and `settle` in place of `useSimActions`; the Live link, the gate's notice, the paced retry, Cancel that is closed once the request is out, unpair with handlers, "Use Simulated mode" |
| `apps/mobile/src/features/pairing/pairing-live-model.ts` | new | The pure Live rules: the offline notice (no flicker), the outcomes of a rejected redeem, the pacing of a retry, the LIVE statuses of the connection pane |
| `apps/mobile/src/features/pairing/pairing-model.ts` | changed | Two outcome kinds (`limited`, `unavailable`) and their view (`failed`). Nothing else |
| `apps/mobile/src/features/pairing/pairing-connection.tsx` | changed | LIVE: the chip, the status line, the step descriptions, the identity list before and after pairing, no empty fingerprint. Simulated: as it was |
| `apps/mobile/src/features/pairing/pairing-code-panel.tsx` | changed | LIVE: the gate's notice above the card, the offline Alert, the limit and "not available" Alerts with Retry, the lock's count in the server's meaning, Cancel closed once sent, "Use Simulated mode" |
| `apps/mobile/src/features/pairing/pairing-screen.tsx` | changed | LIVE: the subtitle, no back button while the gate holds, the unpair through `settle` with the app's refusal presenter |
| `apps/mobile/src/features/pairing/unpair-dialog.tsx` | changed | LIVE: the text of MP-7; both buttons wait while the request is out |
| `apps/mobile/src/features/pairing/i18n.ts` | changed | A subtree `live` (50 texts) under `features.pairing`. The 51 texts of Simulated mode are untouched |
| `apps/mobile/src/features/home/home-screen.tsx` | changed, ONE line (granted, D124 ruling 2) | Line 217: the service name of the health answer |
| `apps/mobile/src/features/pairing/pairing-live.test.tsx` | new test | 27 tests: 25 of the screen on the app's Live source over the fake transport, 2 of Simulated mode with a simulator that throws |
| `apps/mobile/src/features/pairing/pairing-live-model.test.ts` | new test | 12 tests: the pure rules |
| `apps/mobile/src/features/pairing/pairing-live-static.test.ts` | new test | 10 tests: CLG (c), what stays with the runtime, the copy |
| `apps/mobile/src/features/pairing/stack-check-service-name.test.tsx` | new test | 2 tests: the one granted line |

Not changed: `pairing-model.test.ts`, `pairing-screen.test.tsx`, `use-dialog-presence.ts`, every file
outside the folder but line 217 of `home-screen.tsx`. Nothing under `runtime/`, `auth/`, `i18n/`,
`navigation/`, `packages/shared`, `apps/core-server`. No new i18n key outside the folder was needed:
`mobile.pairing.live` exists (W51), and the folder's own tree is mounted at `features.pairing.*`.

The one granted line, before and after (`git diff acaff20 -- apps/mobile/src/features/home/home-screen.tsx`;
`--numstat`: `1 1`):

```
apps/mobile/src/features/home/home-screen.tsx:217
-            {health.data ? `mock-core v${health.data.version} · api ${health.data.apiVersion}` : 'mock-core'}
+            {health.data ? `${health.data.service.replace(/^dems-/, '')} v${health.data.version} · api ${health.data.apiVersion}` : 'mock-core'}
```

## 3. What was built

### 3.1 The two first items of decision D124

| Item | Before (LIVE mode; screencap `51_pair_live.png`) | Now (LIVE mode) | Where |
|---|---|---|---|
| (a) the chip | `SIMULATED` | `LIVE` (green; red while the Core is unreachable) | `pairing-connection.tsx:240-246` |
| (a) the subtitle | "… simulated in this demo." | "Pairs this tablet with the Core server. A supervisor issues the code in the web console." | `pairing-screen.tsx:117`, `i18n.ts` `live.header.subtitle` |
| (a) the status line | "Ready to pair with ." (an empty Core ID) | "Not paired. The Core identity is shown after pairing." | `pairing-connection.tsx:88-93`, `pairing-live-model.ts:174` |
| (a) the identity list | "Device" and "Room", both empty; "Last pairing audit: No pairing event yet" | Before pairing: "Core server: This computer, through adb reverse", "Link: Connected / Connecting… / Unreachable", "This tablet: Not paired". After pairing: "Core device", "Core name", "This tablet: DEV-NNNN", "Paired at"; the audit line only when the replica holds a pairing row | `pairing-connection.tsx:144-166` |
| (a) the fingerprint | An empty value | "Shown after pairing" until the Core has said who it is | `pairing-connection.tsx:169`, `:247-257` |
| (a) the step descriptions (tablet) | "Find  on the management network" | "Reach the Core server", "The Core checks the pairing code", "The Core registers this tablet and issues its credential" | `pairing-connection.tsx:95-106` |
| (a) the code card | "Enter the 6-digit pairing code issued by the Core." | "Enter the 6-digit pairing code that a supervisor issued for this tablet in the web console." | `pairing-code-panel.tsx:86-90` |
| (b) Stack Check | "mock-core v0.2.0 · api v1" | "core-server v0.2.0 · api v1" | `features/home/home-screen.tsx:217` |

**Why the mode comes from `useCoreLink().source`:** it is the runtime's own word (W51, section 4),
and a simulator never reports LIVE (`simulatorLinkSource`). **Why nothing is shown about the Core
before pairing:** an unpaired tablet has an anonymous socket (`hello` and `heartbeat` only) and no
Core data ([CS:§9.4], the route table's last row), so the replica's `pairing` slice is the neutral
one: every name in it is the empty string.

**In SIMULATED mode every text is as it was.** The static test builds the list of the 51 texts that
are not under `live` and compares one SHA-256 with the value built from
`git show acaff20:apps/mobile/src/features/pairing/i18n.ts`: `08f17385…d6a84546`, equal. The
existing screen test, unchanged, still reads "Ready to pair with DEMS-IR-01." and `SIMULATED`.

### 3.2 The controller in both modes (`use-pairing-flow.ts`)

One call site per action, for the simulator and for the Live source:

```ts
settle(() => actions.pair(sending.code), { ok: (result) => land(…), fail: (error) => … });   // :211
settle(() => actions.unpair(), { ok: () => …, fail: (error) => … });                          // :313
```

`actions` is `useCoreActions()` (`:130`). For a simulator `settle` runs `ok` before it returns, so
the timing of Simulated mode is what it was: the existing test "pair(code): Discover → Verify … then
PAIRED" reads the paired state in the same turn as the commit, unchanged.

| Point | What is built | Why |
|---|---|---|
| The timeline | `PAIR_TIMELINE` as before, on the store's clock, which in LIVE mode is the Live clock. The code reaches the Core at `commitAt` (1,800 ms) and not before | [CS:§9.4]: "a Cancel before that sends nothing and writes no audit row" |
| One attempt, one request | `commit` marks the attempt object it sent (`flight`, `:192`); an effect that runs again cannot send it twice | A second redeem of the right code would be answered `INVALID_CODE` after the first one paired the tablet |
| Cancel | Before `commitAt`: the attempt ends, nothing is sent. Once the request is out: disabled, and `cancel()` itself does nothing (`:304-310`). While the gate holds, Cancel ends the attempt and stays on the screen | A request that left cannot be taken back; while the gate holds there is no screen to cancel to ([CS:§9.4], view `pairing`) |
| The credential (MP-6) | Not this file's: the runtime's `devicePaired` writes it before the Live source settles the action (W51). The screen never sees it. When the screen is gone before the answer, the answer changes nothing here, and the credential is stored all the same | Decision of the brief: "written BEFORE the redeem action settles" |
| The answer | 201: `paired`; the hand-off counts from the store's clock at that moment (`liveOutcomeOf`). 401 `INVALID_CODE`: `invalid` with the Core's count. 423: `locked`; the countdown reads the replica's `lockedUntil` | The Live source resolves these three with the simulator's own result union (CL-19) |
| No judgement of the code | A rejection is read by `failureOutcomeOf` (section 3.3) and drawn in place; the code stays in the slots unless it is used up | [CS:§9.4] "failed, error form" |
| The link | `useLiveLink()`; the "unreachable" notice follows it with the banner's rule: CONNECTING and RESYNCING keep what is shown (`:156-164`) | With the Core down the link alternates between OFFLINE and CONNECTING at every reconnect attempt: a notice that followed it would flicker |
| Pair is open when | Six digits, no attempt in flight, not paired, not locked; in LIVE mode also the link ONLINE and no wait running (`:289-294`) | The Live source sends while ONLINE only (CL-22) |
| The gate's notice | `usePairing().notice`, shown until the next attempt of this visit; a new notice shows again (`:166-172`, `:364`) | [CS:§9.4]: "What ends it: the next attempt" |
| Unpair (MP-7) | `actions.unpair()` through `settle`. The Live source refuses it at once while the link is down; nothing is deleted. On 204 the runtime deletes the three items and sets the gate to UNPAIRED with the notice `unpaired` | "The registry never keeps a device the tablet has forgotten" |
| The offline Retry | `useRetryCooldown` of `@dems/shared/realtime` (3 s, 6 s, 12 s; three times) around `live.reconnect('RETRY')` (`:328-335`) | The Login screen's own Retry, and the agent's retry rule |
| "Use Simulated mode" | `setCoreLinkSource('SIMULATED')`, then `router.replace('/')` (`:337-343`). Logged (`PairingScreen.useSimulated`) | [CS:§3.3] steps 3 to 5. LIVE exists in debug builds only (MD-3), so the control needs no build test of its own |
| A redeemed code | Dropped from the controller's memory in LIVE mode (`:206-208`) | It is used up; nothing of this screen needs it again |

### 3.3 The pure Live rules (`pairing-live-model.ts`)

| Function | Rule |
|---|---|
| `offlineNoticeAfter(shown, link)` (`:51`) | OFFLINE, STALE → shown. ONLINE → hidden. CONNECTING, RESYNCING → as it was. No Live link (Simulated) → hidden |
| `liveLinkViewFor` (`:65`) | `offline` while the notice shows; `online` only for `ONLINE`; else `connecting` |
| `failureOutcomeOf(error, consecutive, now)` (`:118`) | Reads `describeCoreError` of the runtime. 429 → `limited`. STOPPED → nothing. A request that left and got no answer (time-out, lost connection) → `unavailable` NO_ANSWER. The link was down, or a 503 → OFFLINE. `NOT_AVAILABLE` (the storage failed) → STORAGE. Anything else of the presenter → FAILED. Not the presenter's → the screen's own `error`, as before |
| `retryWaitMs` (`:84`), `PAIR_RETRY` (`:78`) | 3 s, 6 s, 12 s; never less than the server's `retry-after` (rounded up). After three attempts in a row without a judgement, `exhausted` |
| `keepsCode` (`:141`) | A wrong code is cleared; a code the Core never judged stays; a code that paired a tablet which could not keep its credential is used up and cleared |
| `liveStatusKeyFor` (`:174`), `liveStepStatusesFor` (`:155`), `liveRingStateFor` (`:160`) | The status line, the stepper and the ring of the connection pane: Discover in error and the ring critical while the Core is unreachable; an attempt in flight and a paired tablet keep their own look |

**A 429 on redeem is a limit, never a wrong code (decision D116, finding F76).** The action rejects
with `LiveTransportError` (status 429), not with the result union of a refused code. The screen
shows a `warning` Alert "Pairing is not available right now." with "The Core server is limiting
requests. The code was not checked and no attempt was counted.", keeps the code, counts nothing,
and opens Retry after `retry-after`. The replica's `pairing` slice is untouched (asserted).

**`attemptsRemaining` is the LOCK's count.** In LIVE mode the Alert reads "2 more attempts before
pairing is locked for a short time." (`live.code.attemptsBeforeLock`), not "2 attempts remaining":
the Core locks redeeming for 60 s after three failures and closes a code after five, and the number
it returns is the first of the two (W32, §11.3). Neither text says why the code failed (SR-29): a
static test finds no "expired", "used", "cancelled", "closed", "wrong code" or "invalid code" in the
LIVE copy. The lock is global on the Core, so the locked text blames nobody: "Pairing is locked on
the Core for a short time."

### 3.4 What the screen shows, against the table of [CS:§9.4]

| View | Connection pane | Code pane | Built as specified? |
|---|---|---|---|
| `unpaired`, link up | Discover active; "Core server", "Link", "This tablet"; chip `LIVE` | Six slots; Pair at six digits; "Use Simulated mode" in place of Cancel; no back button | Yes. The Core server's address is not printed (deviation DV-1) |
| `pairing` | Discover running, then Verify running; after `commitAt` "The Core is checking the code…" | Slots locked; Pair shows the Spinner; Cancel enabled until the request is out, then disabled | Yes |
| `paired` | All steps done; "Core device", "Core name", fingerprint of the answer's `core`; "This tablet: DEV-NNNN" | Success chip; "Continue to sign-in" or "Done"; Unpair behind its dialog; hand-off 2,400 ms later | Yes |
| `failed`, 401 | Verify in error | "Code not accepted" with the lock's count; slots cleared with the invalid outline | Yes; the count is worded as the server means it |
| `locked`, 423 | Verify in warning; ring critical | The existing warning Alert with the rolling countdown to `lockedUntil`; slots disabled | Yes |
| `failed`, error form | Verify in error | "Pairing is not available right now." with Retry. A 429 is a `warning` with its own sentence | Yes, with a paced Retry and a separate wording for the limit (deviation DV-3) |
| offline | Discover in error; "Core server unreachable." | Slots disabled; danger Alert with Retry; "Use Simulated mode" | Yes |
| notice `revoked`, `unknown`, `unpaired` | — | An Alert above the code card: danger, danger, info; "The recording continues on the Core." when the session that ended with the revocation was RECORDING | Yes; each Alert has a short title besides the specified sentence (deviation DV-4) |

### 3.5 MP-5 to MP-8a

| ID | Where it is met |
|---|---|
| MP-5 (the redeem request: the code, a device name, `platform`, the app version; no hardware identifier) | The runtime's `liveDeviceDescription` (W51). Asserted here on the request the screen causes; on the tablet the registry shows the name `sdk_gphone64_arm64`, `android`, app `0.1.0` |
| MP-6 (the wrapper writes the item before the action settles; the slice is PAIRED; the gate opens) | The runtime (W51). Asserted at the screen: two tests of "the credential is written before the action settles" |
| MP-7 (unpair; refused while the link is down) | `use-pairing-flow.ts:312-325`, `pairing-screen.tsx:78-97`, `unpair-dialog.tsx:36` |
| MP-8 (re-pairing after a reinstall: a new device ID; the old device stays in the registry) | Nothing to build: no item, so the gate is UNPAIRED and the screen is the unpaired one. Tested |
| MP-8a (`rotateDeviceCredential` is not called) | No file of the folder names an operation by its ID (static test); the reinstall test finds no such request |

## 4. Verification

Every command was run from `/Users/gsp-budi/Documents/DEMS` (no `cd` between Bash calls of the
agent; the scripts name absolute paths). Port binding, `adb` and database commands ran with the
per-command sandbox bypass.

### 4.1 Start state

No whole-suite baseline run was made by this row before its first edit; the baseline is the brief's
(82 suites, 992 tests; decision D124). Pre-images of the ten existing files of the folder and of
`home-screen.tsx` were saved at 20:34:00 under `.cache/rollback/W57/`; `git status --short` over the
folder printed nothing at that moment, so each pre-image equals `acaff20`.

### 4.2 CLG (a) and (c) (`assets/57_clg_evidence.log`)

```
## 2026-10-04 22:03:33 WIB CLG (a): the folder's existing test files are those of acaff20, unchanged
$ git ls-tree -r --name-only acaff20 -- apps/mobile/src/features/pairing | grep "\.test\."
apps/mobile/src/features/pairing/pairing-model.test.ts
apps/mobile/src/features/pairing/pairing-screen.test.tsx
$ git diff --stat acaff20 -- apps/mobile/src/features/pairing/pairing-model.test.ts apps/mobile/src/features/pairing/pairing-screen.test.tsx
exit=0 (no line above = neither file differs)
pairing-model.test.ts  tree=c882a126fef98eb34dc1165052af5cc328057111  acaff20=c882a126fef98eb34dc1165052af5cc328057111
pairing-screen.test.tsx  tree=6d14036c098f1c4f626c201b2b52e2ccd3e45705  acaff20=6d14036c098f1c4f626c201b2b52e2ccd3e45705

## CLG (c): no simulator action hook and no .actions read on a Sim in the folder's production files
$ grep -rnE "useSimActions" apps/mobile/src/features/pairing --include="*.ts" --include="*.tsx" | grep -v "\.test\."
exit=1 (1 = no match)
$ grep -rnE "\.actions" apps/mobile/src/features/pairing --include="*.ts" --include="*.tsx" | grep -v "\.test\."
apps/mobile/src/features/pairing/unpair-dialog.tsx:37:          <View style={styles.actions}>
apps/mobile/src/features/pairing/pairing-code-panel.tsx:123:      <View style={styles.actions}>
apps/mobile/src/features/pairing/pairing-code-panel.tsx:220:                    ? t('common.actions.retryIn', { seconds: coreRetry.cooldown })
apps/mobile/src/features/pairing/pairing-code-panel.tsx:221:                    : t('common.actions.retry')}
apps/mobile/src/features/pairing/pairing-code-panel.tsx:282:                  {flow.retrySeconds > 0 ? t('common.actions.retryIn', { seconds: flow.retrySeconds }) : t('co
apps/mobile/src/features/pairing/pairing-code-panel.tsx:347:        <View style={styles.actions}>
```

The six lines of the second `grep` are a style named `actions` and the translation keys
`common.actions.retry` and `common.actions.retryIn` inside quotes. None reads a `Sim`. The static
test `pairing-live-static.test.ts` holds both rules without the six lines (it strips quoted text),
and holds that the controller calls `actions.pair` and `actions.unpair` through `settle` and
nothing else of the actions object.

The existing tests: `pairing-screen.test.tsx` (8) and `pairing-model.test.ts` (7) pass, unchanged,
in every run of section 4.6.

### 4.3 The Live tests (CLG (b), and the row's cases)

`pairing-live.test.tsx` mounts `<PairingScreen />` inside the real `AppProviders` on
`createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers })`.
The secure store is the in-memory one of `jest.setup.ts`. Every clock is the fake's: the connection
steps, the countdowns and the hand-off are driven by advancing it. Every test ends with
`fake.assertNoViolations()` and with "no `live.misuse` report" (an `afterEach`).

| Required by the row | Test (`pairing-live.test.tsx` unless named) | What it asserts |
|---|---|---|
| **A correct code** (AC-C-75) | "stores the credential, opens the gate and hands off; the marker code is in no storage and no log (SD-23)" | No request before `commitAt`; then ONE `redeemPairingCode` with `{ code, deviceName, platform: 'android', appVersion }` and no bearer; the item `dems.live.device.v1` equals the answer, without an authentication requirement; the gate is `PAIRED` with the device ID; the next socket presents the device credential; the paired view shows the Core identity of the answer and "This tablet: DEV-…"; the hand-off 2,400 ms after the answer goes to `/` (it resolves to `/login`); the marker scan |
| | "with a screen underneath (opened from sign-in), the hand-off goes back to it" | `router.back()` once, no `replace` |
| **A wrong code, with the lock's count** (AC-C-76) | "a wrong code: "Code not accepted" with the lock's count, the slots cleared; never why" | 401 with `attemptsRemaining: 2`, then `1`: "2 more attempts before pairing is locked for a short time.", then "1 more attempt …"; the slots are empty and Pair is closed; the screen holds none of "wrong", "expired", "already used", "cancelled", "closed", "invalid"; nothing is stored |
| **A 423 countdown** (AC-C-76) | "423: the countdown to the Core's `lockedUntil` on the Live clock; the slots are disabled; the text blames nobody" | "Pairing locked. Try again in 60 seconds.", 30 after 30 s, gone after 60 s; Pair closed with six digits typed; no request during the lock; no "your" in the text |
| **A 429 as a limit** (D116) | "says "wait", counts no attempt, keeps the code, and Retry opens after `retry-after`" | The `limited` Alert, not "Code not accepted"; no count of attempts, no lock, no "unreachable"; the link reads "Connected"; the replica's `pairing` slice equals the one before; the code is still in the slots; "Retry in 41s", closed, and so is Pair; pressing sends nothing; after 41 s Retry sends the same code and the tablet pairs |
| **Cancel before `commitAt`: no request** (AC-C-77) | "before `commitAt` sends no request; while the gate holds it ends the attempt and stays on the screen" | 100 ms before `commitAt` Cancel is pressed; 3.8 s later the fake has seen no redeem and no POST at all; nothing stored; the router was not called |
| | "is disabled once the request is out: the answer decides"; "`cancel()` does nothing once the request is out, whatever calls it" | With the answer held: Cancel is disabled; pressing it, and calling the controller's `cancel()` directly, leave the attempt in flight; the answer then pairs the tablet; one request |
| **Unpair while offline: refused** (AC-C-80) | "while the link is down it is refused: no request, nothing deleted, the tablet stays PAIRED" | The socket is dropped; Unpair, confirm: the toast "Core server unreachable" / "Nothing was changed." (LB-6); no `unpairDevice` request, no request at all; the stored item is unchanged; the gate is PAIRED; the registry still holds the device |
| Unpair online (AC-C-80) | "calls operation 22, deletes the three items and stays on the screen with the notice" | ONE `unpairDevice` with the device credential; the three items are gone; the gate is `UNPAIRED` with `unpaired`; the code card with the info notice "This tablet was unpaired."; no toast repeats it; the router was not called; the reopened socket presents nothing |
| **The credential is written before the action settles; the action killed between the answer and the settle** (MP-6) | "the app dies between the answer and the settle: the only copy of the credential is in storage, and the next start is PAIRED" | A listener on the runtime's gate stops the Live source at the first moment anything says PAIRED: the store holds the credential at that moment; the replica never said PAIRED and the screen never showed it; a second Live source (the next start) reads the item, is PAIRED with the same device ID, presents the credential, and no second redeem is sent |
| | "at the moment anything says "paired", secure storage already holds the credential" | At the gate's first PAIRED and at the replica's first PAIRED the item is already stored |
| | "a credential that cannot be stored: "not available", the code is cleared, and the runtime removes the registration with one unpair" | The storage text; no Retry for a used-up code; one `unpairDevice`; nothing stored; UNPAIRED |
| **Re-pairing after a reinstall** (AC-C-81, MP-8) | "with an empty secure store the tablet is unpaired again, and a new pairing shows a NEW device ID" | Pair; empty the secure store; a new Live source: UNPAIRED, no notice, an anonymous socket; pair again: another device ID on screen and in the store; the registry holds two devices; no `rotateDeviceCredential` request |
| CLG (b), outage at the `pair` site | "a request that left and got no answer: the screen says the code may be used up"; "the link drops between Pair and `commitAt`: nothing is sent, and the offline notice says why"; "a 500: … with a paced Retry (3 s, 6 s, 12 s), then no Retry"; "after an answer that judges the code, and the code typed again, the pacing starts anew" | The three wordings; nothing sent while the link is down, also with six digits and Pair pressed; three paced retries, then Pair only, behind 12 s; a retyped code starts the pacing anew |
| The offline notice ([CS:§3.5]) | "slots disabled, a danger Alert with a paced Retry that reconnects, and no flicker while the socket retries" | With the Core unreachable from the start: the Alert, the slots not editable, "Link: Unreachable"; the Alert is there at each of 40 looks while the socket retries, and while a connect hangs with the link reading CONNECTING; Retry opens one socket and then reads "Retry in 3s"; when the Core is back the Alert goes and the slots open |
| The gate's notices ([CS:§6.6]) | "`unknown` …"; "`revoked` …"; "the notice adds that the recording continues on the Core" | The three texts; the `unknown` notice goes with the next attempt; after a revocation during a recording no later request and no socket carries a credential |
| SIMULATED mode beyond the existing tests | "`pair` throws: the screen's own generic Alert, and the slots are cleared"; "`unpair` throws: "Could not unpair. Please try again.", the dialog closes, the tablet stays paired" | With a simulator whose action throws a permission error: the chip `SIMULATED`, no LIVE wrapper, the Alert "Pairing could not be completed", no wait and no Retry, Cancel as before; the dialog's Simulated text; the toast of Simulated mode and not the presenter's "Not permitted" |
| First item (a) of D124 | "reads LIVE and never "simulated" …"; "tablet landscape: both panes side by side, the step descriptions name no empty Core"; ""Use Simulated mode" stores the simulator as the source and goes to the boot router" | The table of section 3.1; `getCoreLinkSource()` is SIMULATED, the stored preference too, and `router.replace('/')` |

`pairing-live-model.test.ts` (12 tests) holds the rules of section 3.3 one by one, among them
"a dead link that keeps retrying never flickers the notice", "a 429 is a limit, never a wrong
code: no count of attempts, and the wait is at least `retry-after`" and "no judgement of the code:
the reason says whether the code may be used up" (a time-out and a lost connection are NO_ANSWER; a
link that was down and a 503 are OFFLINE).

`pairing-live-static.test.ts` (10 tests): CLG (c); the folder names no network API, no Core server
address, no storage package, no Live source module and no operation ID; the LIVE copy says
"simulated" nowhere but on the switch to the simulator, names no fixed Core and no code, and never
explains a refused code; the Simulated copy is the 51 texts of `acaff20` (one digest).

`stack-check-service-name.test.tsx` (2 tests): LIVE "core-server v0.2.0 · api v1" and never
"mock"; SIMULATED "mock-core v0.1.0 · api v1", exactly.

### 4.4 The marker-code scan (SD-23)

The tests type `MARKER_CODE`: six digits that are neither the simulator's demo code nor an example
of the contract, put together in the test file so that a search of the tree finds one line. After a
pairing, `expectMarkerNowhere` flushes the runtime log and searches:

| Place | How it is read | Marker found |
|---|---|---|
| AsyncStorage, every key and value (`dems.mobile.log.v1` among them; the test asserts that key exists, so the scan is not empty) | `AsyncStorage.multiGet(getAllKeys())` | 0 |
| The secure store, every item | The mock's `keys()` and `peek()` | 0 |
| The runtime log in memory | `runtimeLog.records()` | 0 |
| The Live source's reports | `live.errors()` | 0 |
| The replica | `live.store.getState()` | 0 |
| The console (`log`, `info`, `warn`, `error`, `debug`, captured for the whole test) | Spies | 0 |
| The redeem request the tablet sent | `fake.log.requestsOf('redeemPairingCode')` | **present**: the search can find it |

It runs after: a correct code; a 429 followed by a successful retry; a storage failure; a lost
connection; a re-pairing. The first of them also finds no device credential outside the secure
store and no string with one of the three secret prefixes of the contract in AsyncStorage, the log,
the reports, the replica or the console.

### 4.5 Mutation check (`assets/57_mutate.py.txt`, `57_mutating_transformer.cjs.txt`, `57_jest_mut_config.cjs.txt`, `57_mutations_run1.log`, `57_mutations_run2.log`)

**Method (W51's, rule M15).** A jest transformer changes one text of one production file in
memory and hands the result to the app's own transformer. No file of the tree is edited: the
SHA-256 of the nine mutated files is compared before and after the run. A change is detected when
jest exits non-zero. The files of the pure model, the copy and the granted line are first run
against their own unit tests, and against the whole folder only when those do not notice; every
other change runs against the folder's six test files.

**Run 1 (21:35:20 to 21:54, 89 changes): 82 detected, 6 not detected, 1 not applied.**

```
## W57 mutation check, 2026-10-04 21:35:20; 6 test files per run; the tree is not edited
control (no mutation): exit=0 Tests:       64 passed, 64 total (23 s)
…
## 82 detected, 6 not detected, 1 errors, of 89
## the mutated files in the tree, before and after: identical
```

| Group | File | Changes | Detected in run 1 | Examples (change → a test that fails) |
|---|---|--:|--:|---|
| F: the controller | `use-pairing-flow.ts` | 27 | 25 | The screen never knows it is in LIVE mode → 22 tests; the LIVE rules leak into Simulated mode → 6 tests, the first of them the EXISTING "unpaired phone: stepper, Core identity …"; the request is out and Cancel stays enabled; `cancel()` throws the attempt away after the request left; Cancel leaves the screen although the gate holds; the code is cleared after a limit; a refused code stays in the slots (caught by the existing "3 wrong codes …" too); the hand-off counts from the Core's `pairedAt`; attempts without an answer are not counted; Pair is open while the wait after a limit runs; the gate's notice stays after the next attempt; Retry is offered for ever, or for a used-up code; the offline Retry reconnects nothing; "Use Simulated mode" stores nothing, or does not go to the boot router; the offline notice goes away while the socket is CONNECTING; unpair calls nothing (caught by the existing unpair test too); the request carries a stale code of the controller, not the attempt's → 31 tests |
| M: the pure Live model | `pairing-live-model.ts` | 26 | 24 | A STALE link shows no notice; CONNECTING hides the notice, or flashes it at a first connect; a link that is still connecting counts as online; no back-off, no cap; the server's `retry-after` ignored; a stopped source shows an error; a 429 is not told apart; a fourth paced retry; a lost connection reads "the code was not checked"; a failed storage reads as a server failure; a used-up code is kept; the status line never says the request is out, or that the Core is unreachable; a limit reads "The Core did not accept that code." |
| P: the existing model | `pairing-model.ts` | 1 | 1 | A limit and an outage show no Alert at all |
| C: the code card | `pairing-code-panel.tsx` | 13 | 12 | The slots stay open while the Core is unreachable; the Simulated description in LIVE mode; "Use Simulated mode" never offered; an attempt in flight has no Cancel; no offline Alert; a limit drawn as "Code not accepted"; Simulated mode gets the LIVE wording of the count (the existing "3 wrong codes …"); LIVE mode words the lock's count as attempts left of the code; the notice never, or always, says that the recording continues |
| K: the connection card | `pairing-connection.tsx` | 9 | 8 | The chip reads `SIMULATED` in LIVE mode → 3 tests; the chip reads `LIVE` in Simulated mode (the existing test); an empty fingerprint drawn before pairing; a paired tablet says "No pairing event yet"; the device ID never shown; the status line keeps "Ready to pair with ." → 7 tests; the identity list shows an empty Core → 7 tests |
| S: the screen | `pairing-screen.tsx` | 7 | 7 | The back button drawn while the gate holds; a paired tablet without a back button; the notice repeated as a toast; a refused unpair not worded by the presenter; "simulated in this demo" in the LIVE header → 4 tests; the Simulated connection card in LIVE mode → 12 tests; the Simulated dialog text in LIVE mode |
| U: the dialog | `unpair-dialog.tsx` | 1 | 0 | |
| T: the copy | `i18n.ts` | 3 | 3 | A text of Simulated mode changed (the digest); a LIVE text that says "simulated"; a LIVE text that explains a refused code |
| H: the granted line | `home-screen.tsx` | 2 | 2 | The line before this row ("mock-core" for whichever service answers); the raw service name (the Simulated line changes) |
| **Total** | | **89** | **82** | |

The failing test named for each detected change fits the change (the whole list is in
`57_mutations_run1.log`); none of the 82 was a test that merely ran out of time.

**The six survivors and the one change that was not applied.** Each was read; each led to a test,
and two of them to a small change of production code. No test was weakened.

| ID | The change that was not detected | What it showed | What was added |
|---|---|---|---|
| F13 | Pair is open while the Core is unreachable | The test looked at Pair while the 3 s wait of the failed attempt still ran: the wait closed it, not the link | "the link drops between Pair and `commitAt` …" now waits the 3 s out and finds Pair still closed, with six digits typed |
| F27 | Simulated mode maps a thrown error through the Live table | No test made the simulator throw | Two tests of Simulated mode: `pair` throws a permission error → the screen's own generic Alert, no wait, no Retry; `unpair` throws → "Could not unpair. Please try again." |
| M10 | `retry-after` is rounded down | The presenter rounds up before this function sees the value, so the function's own rounding was never asked | Two assertions on `retryWaitMs` with a fraction |
| C12 | Simulated mode gets the LIVE wrapper around the code card | The wrapper cannot be seen: with no notice it draws nothing | **Production:** the wrapper carries the test ID `pairing-live-stack` (`pairing-code-panel.tsx:59`). Tests: present in LIVE mode, absent in Simulated mode |
| K09 | Discover is never in error while the Core is unreachable | The pure rule was tested, its use by the card was not | The offline test reads the stepper's own labels: "Discover … failed", "Verify code … not started", and "Discover … current" when the Core is back |
| U01 | Simulated mode gets the LIVE dialog text | The existing unpair test does not read the dialog's body | The Simulated `unpair` test above reads it |
| M26 | (not applied: the text to change was looked for with the wrong indentation) | A mistake of the list | Corrected in the list; run 2 |

Reading F27 also changed one production line: a refused unpair is handed to the refusal presenter
in LIVE mode only (`pairing-screen.tsx:93`, `if (flow.live && presentCoreError(error)) return;`), so
that in Simulated mode the toast is "Could not unpair. Please try again." for whatever was thrown,
as before. The list gained one change for it (S08: the guard without `flow.live`).

**Run 2 (21:58:14, 27 changes): 27 detected, 0 not detected, 0 errors.** The control run (no mutation) was 66 tests, exit 0 — two more than run 1's control (64), because the six survivor tests and the S08 addition now exist. Run 2 re-ran the six survivor changes now that each has a test, the corrected M26, and the new S08; all were detected. The nine mutated files are byte-identical before and after (`## the mutated files in the tree, before and after: identical`; each of the nine prints `same`), so the harness edited no file of the tree. `exit=0`. Full log: `assets/57_mutations_run2.log`. W57's M15 record therefore reads **82 of 89 (run 1) plus 27 of 27 (run 2)**, with the tree provably untouched.

**Not in the list, and why.** The guard against a second send of one attempt
(`use-pairing-flow.ts:192`) and the two guards of an answer that arrives for an attempt that is no
longer the screen's (`:198`, `:200`): jest cannot make the effect run again, or the screen go away,
between the request and its answer in a way these lines would change the outcome of; they are
defence for the compiled build. The line that starts the pacing anew after a judged answer
(`:205`) is equivalent in practice to the one in `setCode` (`:285`, in the list as F11): every
judged answer clears the slots, and typing a code starts the pacing anew. The tone of the mode
chip and the colour of the status line are styles and have no assertion.

### 4.6 Final gate (`assets/57_gate_final.log`)

All four commands were re-run fresh on 2026-10-05 (11:35–11:38 WIB) by the step-79 evidence repair; the full curated block is `assets/57_gate_final.log`. Node v26.8.2, npm 11.19.1, one workspace at a time, `--maxWorkers=2`; load average before the runs 3.88 (P9 guard not fired).

```
$ npm run test -w @dems/mobile -- --maxWorkers=2          # 11:36:56 to 11:37:55
Test Suites: 92 passed, 92 total
Tests:       1207 passed, 1207 total
Time:        58.65 s        MOBILE_TEST_EXIT=0

$ npm run test -w @dems/mobile -- src/features/pairing --maxWorkers=2      # 11:35:43 to 11:35:58
Test Suites: 6 passed, 6 total
Tests:       66 passed, 66 total
Time:        14.004 s       PAIRING_EXIT=0
   per file (fresh --json): screen 8 · model 7 · stack-check 2 · live-model 12 · live-static 10 · live 27

$ npm run typecheck -w @dems/mobile     # 11:38:37   TYPECHECK_EXIT=0  (tsc --noEmit, no output)
$ npm run lint    -w @dems/mobile       # 11:38:42   LINT_EXIT=0       (eslint ., no finding)
```

The whole-workspace figure (92 / 1,207) is above the ledger because other rows added suites after the baseline — W59's `features/login/**` files, all green under jest; this row's own share is the pairing folder's 6 / 66 plus the one granted line of `home-screen.tsx`, pinned by `stack-check-service-name.test.tsx`. **Attribution (P11):** the read-only verifier saw `typecheck` exit 2 and `lint` exit 1 at 10:14–10:15, every error inside `apps/mobile/src/features/login/**` (W59, mid-edit); those reds named no file of this row. On this fresh run both are exit 0 — W59 has since cleaned those files (mtimes 10:26–10:27). The earlier reds were transient W59 noise, not this row's. The verbose listing of the four new Live files (4 suites / 51 tests, exit 0) is `assets/57_live_tests_verbose.txt`.

### 4.7 The device check: the tablet pairs with the real Core server

Three sessions on lane 2, each one command inside the lane lock (sandbox bypass for the port, `adb`
and the database):

```
/usr/bin/lockf -k -t 900 .locks/core-server.lane2.lock /bin/sh .cache/w57/run_w57.sh     # 21:14:14 to 21:16:22, exit 0
/usr/bin/lockf -k -t 900 .locks/core-server.lane2.lock /bin/sh .cache/w57/run_w57b.sh    # 21:19:35 to 21:22:04, exit 0
/usr/bin/lockf -k -t 900 .locks/core-server.lane2.lock /bin/sh .cache/w57/run_w57c.sh    # 21:55:29 to 21:57:42, exit 0
```

The scripts are `assets/57_run_w57.sh`, `57_device_w57.sh`, `57_issue_and_type.mts.txt`,
`57_bounds.mjs.txt`, `57_run_w57b.sh`, `57_device_w57b.sh`; the whole output is
`assets/57_device_run.log` and `57_device_run_layout.log`. The device commands ran inside
`METRO_PORT=8083 DEMS_CORE_HOST_PORT=4422 apps/mobile/scripts/device-session.sh tablet '…'`.
Sessions 1 and 2 ran on the production code of 21:10:50 (the last edit before them). After the mutation run two production lines changed (section 4.5: the test ID of the LIVE wrapper, and the unpair guard), so session 2 was repeated on the finished code as **session 3** (21:55:29 to 21:57:42, exit 0, `57_run_w57c.sh`: the same script with another output folder). Its numbers are those of session 2; the layout screencaps and `57_device_run_layout.log` in `assets/` are session 3's, and session 2's log is kept as `57_device_run_layout_first.log`. The pairing itself (session 1) was not repeated: it would have needed an unpair and would have left a second device in the registry; the two lines that changed are not on its path.

**What was done to the device, and nothing else:** read-only queries; launches of the app by a
deep link and force-stops of the app; `adb emu rotate` (the emulator turns the virtual tablet by
90 degrees; the documented way of the predecessor's MA-13), always on to a full circle; ONE tap on
the app's own code field, the pairing code typed into it with `adb shell input text`, and
`KEYCODE_ENTER` in that field. The tap and the typing were refused unless the app was the focused
window and no keyguard showed (checked twice by the script; quoted below). No screencap and no UI
dump was taken while the slots held digits.

**Session 1: pairing.**

| Step | What | Output (quoted from `57_device_run.log`) |
|---|---|---|
| Before | The lane database, not reset | `paired_devices 0`, `device_credentials 0`, `pairing_codes 0`, `audit_log 82` |
| Backend | `DEMS_CORE_PORT=4422 npm run start:server`, first attempt, demo flag off | `"port":4422,"database":"dems_lane_2","demoControls":false`; health `"service":"dems-core-server","version":"0.2.0"`, `"ready":{"database":true,"engine":true}` |
| Device session | The script's own lines | `emulator-5556: screen awake, no keyguard`; `Metro ready; device tcp:8081 -> host tcp:8083, tcp:4400 -> tcp:4400`; `Core server: device tcp:4420 -> host tcp:4422` |
| App data before | Names and lengths only | `dems.mobile.log.v1\|557`, `dems.sim.v1\|119881`; no preference key; no secure-store entry |
| **A** cold start `demsdemo:///pair?core=LIVE` | `runtime.live.ready` after 6 s; the preference is `{"coreLinkSource":"LIVE"}` | Screencap `57_tablet_landscape_unpaired.png`; the UI dump's texts: "Not paired. The Core identity is shown after pairing."; "Core server, This computer, through adb reverse"; "Link, Connected"; "This tablet, Not paired"; "Pair"; "Use Simulated mode"; `says "simulat…" anywhere but on the mode switch: 0 texts` |
| The other orientation, turned while open | `adb emu rotate x1 -> display 1600x2560 (portrait)` | Screencap `57_tablet_portrait_unpaired_after_turn.png`: `connection 288 px wide, code 1168 px wide` (finding F-1). Then `adb emu rotate x3 -> display 2560x1600 (landscape); turns in all: 4` |
| **B** the pairing | One tap on the code field (`adb shell input tap 1644 440`); then `issue_and_type.mts` | `before the issue: isKeyguardShowing=false; mCurrentFocus=Window{… com.dems.demo.tablet/com.dems.demo.tablet.MainActivity}`; `sign-in as the seeded SUPERVISOR (OPR-002): 200`; `issuePairingCode: 201`; `sign-out of the SUPERVISOR: 204`; `issued: codeId PCD-000001, valid 300 s, 5 failed redeems close it; the code has 6 characters, all digits: true (not shown)`; `before typing: isKeyguardShowing=false; …MainActivity}`; `typed the code into the focused field of the app: adb shell input text <not shown>`; `pressed the keypad's submit key (KEYCODE_ENTER) in the app` |
| | The app's redeem | `the app's redeem request, from the device log: status 201, request ID 989c0220-1c59-4bf3-bc14-0a14fb049e98` |
| | The registry, read as the SUPERVISOR | `listPairedDevices: 200`; `state PAIRED, online true, name "sdk_gphone64_arm64", platform android, app 0.1.0`; `devices in the registry: 1`; `getPairingCodeStatus: no code is active (the issued one was redeemed or closed)` |
| **C** the Pair screen of the paired tablet, `demsdemo:///pair` into the running app | | Screencap `57_tablet_landscape_paired.png`: "Paired with DEMS-IR-01 as DEV-0001."; "Core device, DEMS-IR-01"; "Core name, Interview Room 1"; "This tablet, DEV-0001"; "Continue to sign-in"; "Unpair"; a back button. Turned while open: `57_tablet_portrait_paired_after_turn.png` (F-1) |
| Device log | Request lines of the app | `GET /api/v1/auth/session 401`, `GET /api/v1/auth/status 200` (twice: before pairing, and again as the device), `POST /api/v1/pairing/redeem 201`; `'live.misuse' reports in the device log (must be 0): 0` |
| App data after | | `secure-store entries: entry: name="key_v1-dems.live.device.v1"` (the name only; no value was read) |
| **D** stop the app, launch `demsdemo:///?core=SIMULATED` | `LaunchState: COLD`; `runtime.sim.hydrated`; requests to the Core server after it: 0 | The preference is `{"coreLinkSource":"SIMULATED"}`; the secure-store entry is still listed |
| Server log | The same redeem | `989c0220-1c59-4bf3-bc14-0a14fb049e98 POST /api/v1/pairing/redeem 201`; `"principal":"device:DEV-0001","kind":"DEVICE","msg":"socket opened"`; requests by route: `1 POST /api/v1/pairing/redeem 201 principal=null`, `1 GET /api/v1/auth/status 200 principal=device` |
| After | Backend stopped; ports; the database | `shutdown complete`; `lsof exit 1 (1 with no output: no listener on 4422 or 8083)`; `paired_devices 1`, `device_credentials 1`, `pairing_codes 1`, `audit_log 91` |

**The issued code, counted by the process that issued it** (the only place that ever held it, besides
the app's code slots and the request):

```
-- the issued code, counted (must be 0 everywhere): device JS log 0; whole device log (every tag) 0; AsyncStorage values 0; backend log 0; this check's output files 0
   searched: 29 JS log lines, 145839 device log lines, AsyncStorage keys [dems.sim.v1, dems.mobile.prefs.v1, dems.mobile.log.v1], 37 backend log lines
-- lines with a credential or a token (…): device JS log 0; AsyncStorage values 0; backend log 0
-- lines with a bearer value, a cookie or a credential in the server log of this run (must be 0): 0
```

The script holds the code in memory only: no file, no hand-over between processes, nothing printed
but its length. The demo password is read from the shared dataset constant and never printed. The
SUPERVISOR's session exists for two requests each time and is signed out. Before the outputs were
copied into `assets/`, the text files of both sessions (56 files) were searched for the demo
password and for the simulator's demo code: 0 occurrences; the UI dumps hold no text of four or
more digits but the two dates and `DEV-0001`. This document and the progress file were searched
the same way, and for the tests' marker code: 0. (The two six-digit numbers quoted in this section,
`119881` and `145839`, are the length of a stored value and a count of log lines.)

**Sessions 2 and 3: the layout in both orientations, Simulated and LIVE, and a cold start of the paired tablet.** The numbers below were the same in both sessions.

| Step | Mode, how the orientation was reached | Panes (connection, code) | Screencap |
|---|---|---|---|
| A | SIMULATED, cold start in landscape | 1232 px and 880 px (616 dp, 440 dp), side by side, gap 48 px | `57_tablet_landscape_simulated.png` |
| A | SIMULATED, turned to portrait while open | **288 px and 1168 px** | `57_tablet_portrait_simulated_after_turn.png` |
| B | SIMULATED, cold start in portrait | 728 px and 728 px (364 dp each) | `57_tablet_portrait_simulated_coldstart.png` |
| C | LIVE, paired, cold start in portrait | 728 px and 728 px | `57_tablet_portrait_paired_coldstart.png` |
| C | LIVE, paired, turned back to landscape while open | 1232 px and 880 px | `57_tablet_landscape_paired_after_turn.png` |
| (session 1) | LIVE, unpaired, cold start in landscape | 1232 px and 880 px | `57_tablet_landscape_unpaired.png` |
| (session 1) | LIVE, turned to portrait while open, unpaired and paired | **288 px and 1168 px** | `57_tablet_portrait_unpaired_after_turn.png`, `57_tablet_portrait_paired_after_turn.png` |

The pane geometry is the same in both modes in every row: this row's texts move no pane. In
portrait from a cold start the LIVE connection pane is 1,729 px tall and the Simulated one 1,793 px
(the LIVE status line fits one line, the Simulated one takes two). In landscape the connection card
is taller than the viewport in both modes and scrolls: the third identity row sits at the fold in
both, and the fingerprint block is below it in both. KI-01's rule ("a Live text must not clip or
overflow a pane that fits today") holds.

The cold start in LIVE mode on the paired tablet (step C) is the first one of the app with a stored
credential against the real server:

```
-- waited 3 s for the registration read of the stored credential (GET /api/v1/pairing/device 200)
  1 x DEMS-LIVE] GET /api/v1/auth/session 401
  1 x DEMS-LIVE] GET /api/v1/auth/status 200
  1 x DEMS-LIVE] GET /api/v1/pairing/device 200
server: 1 GET /api/v1/auth/session 401 principal=device | 1 GET /api/v1/auth/status 200 principal=device | 1 GET /api/v1/pairing/device 200 principal=device
server: {"connectionId":"…","principal":"device:DEV-0001","kind":"DEVICE","msg":"socket opened"}
-- 'live.misuse' reports (must be 0): 0
```

What the screencaps show (read by this row):

| Screencap | On screen |
|---|---|
| `57_tablet_landscape_unpaired.png` | "Pair this tablet"; the LIVE subtitle; no back button. Core connection: chip "Not paired"; the ring; "Not paired. The Core identity is shown after pairing."; the three steps with the LIVE descriptions; "Core server: This computer, through adb reverse"; "Link: Connected"; "This tablet: Not paired" (at the fold). Pairing code: the LIVE description; six EMPTY slots; Pair (closed); "Use Simulated mode" |
| `57_tablet_landscape_paired.png` | A back button. "Paired with DEMS-IR-01 as DEV-0001."; all three steps done; "Core device: DEMS-IR-01"; "Core name: Interview Room 1"; "This tablet: DEV-0001" (at the fold). Tablet paired: "This tablet is registered with DEMS-IR-01 as DEV-0001. An operator can now sign in on it."; "Continue to sign-in"; "Unpair". No code slot |
| `57_tablet_portrait_paired_coldstart.png` | Both cards side by side, 364 dp each. The whole connection card: the four identity rows, "Paired at 4 Oct 2026 21:15:24", "Certificate fingerprint · SHA-256 (DEMO)" with the chip `LIVE` and the fingerprint in two lines |
| `57_tablet_portrait_simulated_coldstart.png` | The same arrangement with the Simulated texts: "… simulated in this demo."; "Paired with DEMS-IR-01. The control link is certificate-bound (simulated)."; "Device", "Room", "Paired at", "Last pairing audit: No pairing event yet"; the chip `SIMULATED` |
| `57_tablet_portrait_unpaired_after_turn.png` | Finding F-1: the connection card 144 dp wide, its title broken into "Co / re / co / nn / ec / tio / n", the ring cut on both sides; the code card takes the rest |

No screencap shows a code digit or a credential: the slots are empty in the unpaired ones, and the
paired view has no slots.

**Afterwards** (22:00:53, after the third session; `assets/57_end_state.log`):

| Point | State | Evidence |
|---|---|---|
| Reverse rules | None on `emulator-5556` | `adb -s emulator-5556 reverse --list`: empty, exit 0. They were set and removed by `device-session.sh`; this row set none by hand |
| App process | Not running | `pidof com.dems.demo.tablet`: exit 1 |
| Backend | Stopped by each run: `shutdown complete`; the process is gone | The logs' step 5 |
| Listeners | None on 4422 or on 8081 to 8086 | `lsof -nP -iTCP:4422 -iTCP:8081-8086 -sTCP:LISTEN`: no output, exit 1 |
| Lane files | `.locks/core-server.lane2.lock` exists (created by `lockf`); `.locks/core-server.lane2.pid` is empty (0 bytes) | `wc -c` |
| Pose | `cur=2560x1600`, the start pose | `dumpsys window displays` |
| Device lock | `emulator-user-lock.sh status tablet` at 20:34:33 and at 22:00:53: the same line, `isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1` (`diff` of the two files without their time line: identical). Inside each session: `isKeyguardShowing=false`, `RUNNING_UNLOCKED`, `CredentialType: PIN`, `"count":1` at both ends | `57_lock_status_start.txt`, `57_lock_status_end.txt`, the three device logs |
| The other emulators | `emulator-5554` and `emulator-5558` are attached and were not addressed by any command of this row | The scripts name `emulator-5556`; `adb devices` |
| Ports 4420, 4421, 4423, 4400, 4432, 5173 to 5178 | Not used, nothing stopped. 4432 was reached by `db:status` (read-only) and by the lane backend; 5177 appears in an `Origin` header only | The scripts |

Processes started and stopped by this row: the lane backend, three times (through `npm run
start:server`); Metro, three times, through `device-session.sh`; the test and mutation runs.

## 5. Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| **F-1** | **The Pair screen's tablet layout breaks when the tablet is turned from landscape to portrait while the screen is open.** The connection pane becomes 144 dp wide; its title wraps letter by letter and the ring is cut. It is the predecessor's defect: it shows in SIMULATED mode with the layout code of `acaff20`, and this row changed no layout line. A cold start in portrait is right (364 dp and 364 dp), and so is a turn from portrait to landscape. This is the first device check of KI-01's Pair layout, as the plan says | Section 4.7, session 2: 288 px and 1168 px after the turn in both modes; 728 px and 728 px from a cold start in both modes. The numbers fit one reading (a **hypothesis**, not established, and the mechanism behind it is not known): after the turn the code pane is laid out as if it still had its 440 dp of the expanded class as its starting width and then shared the free space, since (1504 − 48 − 880) / 2 = 288 and 880 + 288 = 1168. The pane's sizing is chosen at `apps/mobile/src/features/pairing/pairing-screen.tsx:143` (`layoutClass === 'expanded' ? { width: CODE_PANE_WIDTH } : { flex: 1 }`) and applied by `apps/mobile/src/layout/pane-layout.tsx:94-98` on an `Animated.View` with a layout transition | The row's sentence "both panes show unclipped in portrait and landscape" holds for a screen started in either orientation, not across this one turn. Not fixed here: a fix changes the Simulated layout, which plan section 17 (KI-01) forbids this row. Decision DN-1 |
| **F-2** | The Core server's address cannot be printed by this folder. [CS:§9.4] puts "its address" into the unpaired identity list, but W51's static test allows the address and its constants in ONE file, `runtime/sim-adapters.ts` | `apps/mobile/src/runtime/live-no-raw-fetch.test.tsx` (rule 2) | The row shows "Core server: This computer, through adb reverse", which is true for every lane (the device side is always `tcp:4420`). Deviation DV-1, decision DN-2 |
| **F-3** | Printing `health.data.service` as it is would turn a test of W51 red: `runtime/live-health.test.tsx:235` expects exactly "mock-core v0.1.0 · api v1" in Simulated mode (the matcher compares whole strings), and the service names are `dems-mock-core` and `dems-core-server` | `node_modules/@testing-library/react-native/build/matches.js` (`exact = true`); `packages/shared/src/api/health.ts:14` | The granted line prints the name without the product prefix. Deviation DV-2, decision DN-3 |
| **F-4** | The typed client's 8 s time-out runs on the global timers; the mobile adapters hand it `now` and no timers | `packages/shared/src/client/core-client.ts:660` (`setTimeout`); `apps/mobile/src/runtime/sim-adapters.ts:387-396` | A jest test cannot drive a time-out with the fake clock: it fires 8 real seconds later, after the test. This row tests a time-out through the pure model and a lost connection at the screen. For the tests of W56, W59 and the screen rows |
| **F-5** | In a jest test, `cleanup()` of the testing library in the MIDDLE of a test leaves the next `render` uncommitted ("Can't access .root on unmounted test renderer") | Found by two tests of this row that mount twice | A test that mounts twice calls `unmount()` only. Noted in the test file |
| **F-6** | A test that mounts `AppProviders` without its own `QueryClient` keeps the jest process alive for five minutes when run alone (W51's note 5). This row's first run of its Live test file hung on it and was stopped by the harness at its time limit; its results had been read | The first run of `pairing-live.test.tsx` (6 failed, 15 passed), replaced by later runs | Every mount of this row passes `gcTime: Infinity` |
| **F-7** | The device script printed `device undefined` for the registry row: a row of `listPairedDevices` carries `id`, the script read `deviceId` | `packages/shared/src/api/pairing.ts:161`; `57_device_run.log` | The device ID `DEV-0001` is on the screen (two screencaps, three UI dumps) and in the server's socket line. The pairing was not repeated to correct a print. The script in `assets/` is the one that ran |
| **F-8** | The Core server's fingerprint is the dataset's demo value, the same as the simulator's | The two portrait screencaps show the same two lines | The label "Certificate fingerprint · SHA-256 (DEMO)" stays true in LIVE mode and was not changed |
| **F-9** | `adb shell am start -W` reported `Status: timeout` for the first cold start in LIVE mode; the app was up six seconds later | Section 4.7, step A | F47, as known |
| **F-10** | During two of this row's test runs the auth layer of W56 (in flight) was in the tree and in the device bundle; nothing of it failed on the Pair screen, on the device or in jest | `git status --short -- apps/mobile/src/auth` at 21:04; the Metro log holds no error line | Recorded only |
| F-11 | The 1-minute load average was 10 at 21:36 (this row's mutation run beside the other rows) | `uptime` | P9: the device sessions ran before it, at load 3 to 4 |

**Mismatches between the client layer and the real server: none found** in what this row exercised:
the redeem (201), the device socket, `getSignInStatus` as a device, `getDeviceRegistration` (200),
`getAuthSession` as a device (401). No `live.socket`, `live.client` or `live.misuse` report in the
device log of either session. Not exercised against the real server: a refused code (401), the
lock (423), a limit (429), the unpair and a revocation; those are proven on the fake transport.

## 6. Deviations

| ID | Deviation | Why |
|---|---|---|
| **DV-1** | The unpaired identity list has no address row; it reads "Core server: This computer, through adb reverse" | F-2. The smallest change that would allow the address: export one function from `apps/mobile/src/runtime/sim-adapters.ts` that returns host and port of the device-side address, and read it here |
| **DV-2** | The granted line prints the service name without its `dems-` prefix: "mock-core", "core-server" | F-3: the Simulated line stays byte-equal, and W51's test stays green and untouched |
| **DV-3** | The error form is two Alerts. A 429 is a `warning` with its own sentence and waits `retry-after`; the other cases are the `danger` Alert "Pairing is not available right now." with one of four sentences. Retry is paced (3 s, 6 s, 12 s) and withdrawn after the third attempt in a row; Pair stays, behind the wait | The brief's rule that a 429 is a limit and never a wrong code; the agent's retry rule. [CS:§9.4] names one Alert with Retry |
| **DV-4** | Each notice of the gate has a short title ("Pairing revoked", "Tablet not registered", "Tablet unpaired") above the sentence of [CS:§9.4] | The kit's Alert has a title and a body |
| **DV-5** | A first connect that is still CONNECTING shows no danger Alert; Pair is closed until the link is ONLINE, and the status line reads "Connecting to the Core server…" | [CS:§9.4] has one row, "Link not ONLINE"; an Alert that flashes at every start would be noise. OFFLINE and STALE show it |
| **DV-6** | A successful unpair in LIVE mode shows no toast | The info notice above the code card says it |
| **DV-7** | The mode chip keeps the test ID `pairing-simulated-chip` while it reads `LIVE` | [CS:§9.4]: the screen's test IDs stay |
| **DV-8** | The hand-off in LIVE mode counts from the moment the answer landed, not from the Core's `pairedAt` | The request was out since `pairedAt`; counted from there the hand-off would come early by the round trip |
| **DV-9** | A redeemed code is dropped from the controller's memory in LIVE mode; in Simulated mode it stays as before | Nothing shows it either way; in LIVE mode it is a real code |
| **DV-10** | The test of the granted line lives in the pairing folder (`stack-check-service-name.test.tsx`) | This row's write paths are the folder and that one line |
| **DV-11** | The device check's portrait screencap of the UNPAIRED screen exists only after a turn; the cold-start portrait screencaps are the paired LIVE view and the Simulated view | The tablet had to stay paired. The pane geometry does not depend on the view (section 4.7) |
| **DV-12** | The mutation harness is in `.cache/w57/mut/`, the row's scratch folder inside the repository folder, not outside the repository as W51's | The brief sends scratch files to `.cache/w57/`. No tracked or source file is touched by it (hashes compared) |
| **DV-13** | `.locks/core-server.lane2.lock` was created by `lockf`, `.locks/core-server.lane2.pid` is emptied, not removed | The lane protocol of plan section 5.3; "never delete a file that is not your own new file" |
| **DV-14** | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | The parallel-run contract of this delegation: this document and the progress file are the row's |
| **DV-15** | No whole-suite baseline run before the first edit | The brief gives the baseline (82 suites, 992 tests) |

## 7. Decisions for the controller

| ID | Decision | Recommendation |
|---|---|---|
| **DN-1** | F-1: the Pair screen after a turn from landscape to portrait, in both modes | Rule on it. Option A: accept as the recorded state of KI-01 (a demo tablet stands in landscape; a cold start in portrait is right). Option B: let this row give the code pane a React key per sizing mode in `pairing-screen.tsx` (one line; the pane is mounted anew at the class change, the typed code survives because it lives in the controller), then repeat session 2. Option B changes the Simulated layout after a turn, so it needs this ruling. Option C: the layout kit's owner makes `Pane` drop a fixed width cleanly (`apps/mobile/src/layout/pane-layout.tsx`), which would cover every two-pane screen; whether other screens show the same after a turn was not looked at |
| **DN-2** | DV-1: no address in the identity list | Accept, or grant the one accessor in `runtime/sim-adapters.ts` |
| **DN-3** | DV-2: "core-server" and "mock-core" without the prefix | Accept. The alternative (the full name) changes the Simulated line and W51's test line 235 |
| **DN-4** | DV-3: the wording of the limit on the Pair screen ("The Core server is limiting requests. The code was not checked and no attempt was counted.") | Accept, or give the sentence. It differs from the presenter's toast on purpose: it says what a 429 on redeem does NOT mean |
| **DN-5** | DV-4: the three notice titles | Accept, or give the titles |
| **DN-6** | The tablet is paired with lane 2 as `DEV-0001`; `dems_lane_2` must not be reset in a way that drops `paired_devices` and `device_credentials` (`db:reset` keeps them, [DB:§8.5 R-5]) | Put it into the briefs of the rows that use the tablet |
| **DN-7** | The seams for W60, section 9 | Put them into W60's brief |
| **DN-8** | F-4: a time-out of the typed client cannot be driven by the fake clock in a mobile test | For the owner of the typed client or of the mobile adapters: accept (tests use a lost connection), or pass `timers` to `createCoreClient` |

## 8. State left on the tablet and in `dems_lane_2`

| Point | State | Evidence |
|---|---|---|
| `dems2_tablet` (`emulator-5556`) | **PAIRED with the lane 2 Core** as device **`DEV-0001`** (device name `sdk_gphone64_arm64`, platform `android`, app `0.1.0`). The device credential is in the app's secure store, entry name `key_v1-dems.live.device.v1`; its value was never read by this row | Section 4.7 |
| Core link source of the app on the tablet | **SIMULATED** (`dems.mobile.prefs.v1` is `{"coreLinkSource":"SIMULATED"}`). Why: decision D124 ruling 6, and the Simulated checks of other rows on this tablet expect the default. The stored credential is not read, written or deleted in Simulated mode (the entry is still listed after the Simulated launch). **A row that needs the paired tablet launches with `core=LIVE`**: the app then reads the credential, and the Core confirms `DEV-0001` (done once, session 2 step C) | `57_device_run_layout.log` |
| App process | Stopped (`device-session.sh` force-stops it at the end) | The session's last lines |
| Pose | Landscape, `2560x1600`, as at the start: 8 turns in session 1, 4 each in sessions 2 and 3, always on to a full circle | `display at the end: 2560x1600 (start: 2560x1600)` |
| Lock, PIN, fingerprint | As the user set them at about 20:33 (before this row's first device command): PIN, one fingerprint, no keyguard showing | Section 1; the lock files |
| `dems_lane_2` | **Not reset. Do not drop its pairing tables**: `paired_devices 1`, `device_credentials 1`, `pairing_codes 1` (the redeemed code), `biometric_tokens 0`. `audit_log` 82 before, 91 after session 1, 93 after session 2, 95 after session 3 (the rows were counted, not read by type) | `db:status` in both logs |
| Operators of `dems_lane_2` | The seeded SUPERVISOR `OPR-002` signed in and out twice in session 1 (once to issue the code, once to read the registry); session 2 signed nobody in. No session is open | `sign-out of the SUPERVISOR: 204`, twice |
| Reverse rules, Metro, backend | None left | Section 4.7 "Afterwards" |
| The audit log of `dems_lane_2` after session 3 | 95 rows (93 after session 2): a cold start of the paired tablet adds two rows each time, not read by type | `57_device_run_layout.log` |
| `dems2_phone`, `dems2_phone2`, the old `dems_*` AVDs | Not touched | The scripts name `emulator-5556` only |

## 9. Seams for W60 (the gate), and for W59, W56, W82

| For | Seam |
|---|---|
| W60 | The Pair screen reads the gate itself: `usePairing()` and `isPairingBlocked()`. While it is blocked the screen draws no back button and offers "Use Simulated mode" in place of Cancel; Cancel during an attempt ends the attempt and does not navigate. W60 only has to keep `/pair` as the one working screen |
| W60 | **The hand-off after a pairing** is `router.back()` when `router.canGoBack()`, else `router.replace('/')`, 2,400 ms after the answer landed (`use-pairing-flow.ts:182-187`, `:260-281`). With the gate, `/pair` has nothing underneath, so it is `replace('/')`: the boot router must then resolve to `/login` (the gate is PAIRED by that time: the runtime opens it before the action settles) |
| W60 | **"Use Simulated mode"** calls `setCoreLinkSource('SIMULATED')` and then `router.replace('/')`. The runtime mounts the simulator in place of the Live source; the boot router picks the screen of Simulated mode |
| W60 | **On a revocation or an unknown credential** the screen needs nothing passed to it: the notice comes from `usePairing().notice`, and "The recording continues on the Core." from `live.lastSessionEnd.sessionState`. W60 only routes to `/pair`. The notice is hidden by the first attempt of a visit; a new mount of the screen shows it again while the runtime still holds it |
| W60 | **After an unpair on the device** the screen stays on `/pair` and calls no router function |
| W60 | The pending deep link (MP-12) is not touched by this screen |
| W59 | "Pairing details" on the Login trust line opens `/pair` on a paired tablet: the paired view, with a back button, "Done" or "Continue to sign-in", and Unpair. No hand-off runs there (it runs only after a pairing of that visit) |
| W56 | Unpair signs the operator out through the Live source's end of the pairing (`DEVICE_REVOKED`, reason `UNPAIRED`); the runtime deletes the biometric items with the credential. The Pair screen calls nothing of the auth layer |
| W82 | The Settings row's confirmation dialog for a change of source is not used by "Use Simulated mode": on the Pair screen nobody is signed in while the gate holds |
| Tests of later rows | A screen test on a Live source: pass `queryClient` with `gcTime: Infinity`; never `cleanup()` in the middle of a test; send heartbeats on long waits (`connection.beatEvery()`), or the link turns STALE; a time-out of the typed client is real time (F-4); `InputOTP` calls `onChange` only for a changed text |

## 10. Error handling and logging

| Path | What is logged, where |
|---|---|
| A rejected redeem in LIVE mode | The Live source's own report (`live.action.pair`, through the runtime's `logLiveReport`), and one line of the screen: `PairingScreen.pair`, level `warn` (`error` for an error the presenter does not know), with `phase`, `outcome`, `reason` and the number of attempts without an answer. The context holds no code: the controller passes none, and the log's own filter drops a member named `code` |
| A thrown error in Simulated mode | `PairingScreen.pair`, level `error`, as before |
| A refused unpair | `PairingScreen.unpair`: `warn` in LIVE mode (a dead link is an expected state), `error` in Simulated mode as before. The user sees the presenter's toast, or "Could not unpair. Please try again." |
| The offline Retry fails to ask for a socket | `PairingScreen.reconnect`, level `warn` |
| "Use Simulated mode" | `PairingScreen.useSimulated`, level `info` |
| The ring fails to draw | `PairingScreen.ring`, as before |

Every line goes to the persistent runtime log (`dems.mobile.log.v1`). User feedback is in place:
every failure of `pair` is an Alert in the card, with a paced Retry where a retry can help; a
refused unpair is a toast. The Retry controls are rate-limited: the offline one by
`useRetryCooldown` (3 s, 6 s, 12 s; three), the error form's by the same steps on the store's clock.

## 11. Rollback (not executed)

| Class | Paths | Command |
|---|---|---|
| R-NEW | `apps/mobile/src/features/pairing/pairing-live-model.ts`, `pairing-live.test.tsx`, `pairing-live-model.test.ts`, `pairing-live-static.test.ts`, `stack-check-service-name.test.tsx`; this document, the progress file, `assets/57_*` | `git clean -fd -- <paths>` |
| R-CO | `apps/mobile/src/features/pairing/{use-pairing-flow.ts,pairing-model.ts,pairing-connection.tsx,pairing-code-panel.tsx,pairing-screen.tsx,unpair-dialog.tsx,i18n.ts}`; `apps/mobile/src/features/home/home-screen.tsx` (this row is its only writer in this task; `use-health.ts` beside it is W51's) | `git checkout acaff20 -- <paths>`. The pre-images are also under `.cache/rollback/W57/` |
| Device | The tablet is paired as `DEV-0001` | To undo: a SUPERVISOR revokes `DEV-0001` in the portal (or operation 20), or the app unpairs in LIVE mode. The app then deletes its item. Not needed for a code rollback: with the row's code gone, the item is simply not read |
| Database | One device, one credential, one redeemed code, 13 audit rows in `dems_lane_2` | `npm run db:reset -w @dems/core-server -- --database dems_lane_2` keeps the pairing tables by design; dropping them is a controller decision |

## 12. Limits of this evidence

| Limit | Why it stands |
|---|---|
| Against the real server only the happy path ran: one redeem, one cold start of the paired tablet | A wrong code, the lock, a limit, the unpair and a revocation would have changed the lane's state or needed a second pairing; they are proven on the contract-checked fake transport. The end-to-end rows (W94) do them on the main instance |
| One emulator, the tablet | The phone layout of the Pair screen in LIVE mode was not looked at on a device (jest renders it at 411 × 923) |
| The unpaired LIVE screen in portrait from a cold start has no screencap | DV-11 |
| The React Compiler | On in the Metro build, off in jest. The device ran the compiled controller through a whole pairing, a hand-off and two cold starts; the error form, the offline notice and the unpair were not exercised compiled |
| F-1's cause | Measured, not explained: the hypothesis fits the numbers; no experiment isolated it |
| Mutation check | Single text changes of this row's production files against the folder's six test files; not the whole suite |
| The guard against a double send (`use-pairing-flow.ts:192`) | No test reaches it: jest cannot make the effect run again while a request is out without changing the hook's inputs. It is kept as a defence for the compiled build and is not in the mutation list |
| The release behaviour | Not looked at by this row: LIVE does not exist in a release build (W51), and this row adds no module that a release bundle loads beyond the folder's own files. No release bundle was built |

## 13. Assets (`implementation/assets/`)

`57_lock_status_start.txt`, `57_lock_status_end.txt`, `57_end_state.log`, `57_clg_evidence.log`, `57_gate_final.log`,
`57_live_tests_verbose.txt`, `57_mutate.py.txt`, `57_mutating_transformer.cjs.txt`,
`57_jest_mut_config.cjs.txt`, `57_mutations_run1.log`, `57_mutations_run2.log`, `57_run_w57.sh`, `57_device_w57.sh`,
`57_issue_and_type.mts.txt`, `57_bounds.mjs.txt`, `57_run_w57b.sh`, `57_run_w57c.sh`, `57_device_w57b.sh`,
`57_device_run.log`, `57_device_run_layout_first.log`, `57_device_run_layout.log`, `57_tablet_landscape_unpaired.png`,
`57_tablet_portrait_unpaired_after_turn.png`, `57_tablet_landscape_paired.png`,
`57_tablet_portrait_paired_after_turn.png`, `57_tablet_landscape_simulated.png`,
`57_tablet_portrait_simulated_after_turn.png`, `57_tablet_portrait_simulated_coldstart.png`,
`57_tablet_portrait_paired_coldstart.png`, `57_tablet_landscape_paired_after_turn.png`.

---
*Generated: 2026-10-04 22:04 WIB*

*Last Updated: 2026-10-05 11:42 WIB — the five evidence cells (§1 result table, §4.5 run 2, §4.6 gate body, this footer) filled and the two missing assets (`57_gate_final.log`, `57_live_tests_verbose.txt`) re-created by `coder-execution-local` (step-79 repair); no source file touched.*
