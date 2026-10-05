---
task_slug: dems_backend_rbac_pairing
step: 78
plan_row: W56
date: 2026-10-04
agent: coder-execution
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
tier: 2
status: complete
---

# 56. Mobile sign-in: the auth layer in LIVE mode (step 78, W56)

Sources: `masterplan/04_client_integration_spec.md` rev 2.2 [CS] §6.4, §6.5, §8.5 (S1-1 to S1-3),
§9.1 to §9.3, §9.5; `implementation/51_mobile_runtime.md` (the runtime this row builds on, D124);
`implementation/41_biometric_token.md` §8 (the server's token), `implementation/15_secure_store_wrapper_probe.md`
(the wrapper, D71), `implementation/44_live_source.md` §17.4 (rows 8 to 20, 25 to 27, 31);
decisions D71, D116, D118, D124, D125; findings F72, F76, F77; drift DR-09, DR-11.

No credential value, no password and no pairing code is in this file. Secrets are named by item
name or by kind only.

## 1. Result at a glance

**Status: complete.** The auth layer of LIVE mode is built inside `apps/mobile/src/auth/**`, tested
on the fake transport and the storage mocks, checked by mutation, and run on the lane's emulator
as far as an unpaired device allows. Nothing outside the write path was edited. Three things need
a line from other rows before the operator sees all of it (section 11): the Login screen places
the Alert and words the new result kind (W59), the Settings switch reads two new members (W82),
and the feature-text registry gets one entry (finding F-5).

| Item | Result | Evidence |
|---|---|---|
| `npm run test -w @dems/mobile -- --maxWorkers=2` | exit 0: **90 suites, 1,185 tests** (21:37 to 21:38 WIB). Baseline at 20:40: 82 suites, 992 tests. This row adds 4 test files and 144 tests; the other 4 suites and 49 tests are the pairing row's (W57, in flight) | `assets/56_gate_final.log`, `56_baseline.log` |
| `npm run typecheck -w @dems/mobile`, `npm run lint -w @dems/mobile` | exit 0, exit 0 (21:38) | `assets/56_gate_final.log` |
| The existing auth tests | Unchanged: `auth-provider.test.tsx` and `biometric.test.ts` have the same `git hash-object` as before the row, and `git diff --stat acaff20` over them prints nothing. Both pass (7 and 21 tests) | Section 5.3 |
| Live tests on the fake transport | 41 tests in `live-auth.test.tsx`: password sign-in, lockout, enrolment only in a password session, biometric sign-in with rotation, a 401, a lost answer, a failed OS check, a cancelled prompt, `TOKEN_REUSE`, the DEPARTURE-6 conditions, the storage scans | Section 5.4 |
| Storage scans (AC-C-65, SD-23) | After pairing with a marker code, a wrong and a right marker password, enrolment and two biometric sign-ins: AsyncStorage (with the persisted `dems.mobile.log.v1`), every value ever written to it, the log, the replica and the auth session hold no value with one of the three secret prefixes, no marker password and no marker pairing code | `live-auth.test.tsx`, "nothing secret is readable" |
| AC-C-105 | `isDevice` true in a build that is not a debug build, a failing protected write: nothing is stored, biometric sign-in stays off, the Core is told once | `live-auth.test.tsx`, `live-biometric.test.ts` |
| AC-C-108 | `session.ended` with `TOKEN_REUSE`: signed out, the boot target is `/login`, both biometric items deleted, the device credential stored and presented, the Alert of §6.5 drawn | `live-auth.test.tsx` |
| Mutation check | **78 single changes of the row's production files, 78 detected** (final run on the finished tree). A first run of 78 detected 76: each of the two survivors showed a test that asserted too little; two assertions were added, no test was weakened | Section 5.6 |
| Release transform | In Metro's release transform no file of the auth layer that is part of the bundle loads the token storage, the secure-store wrapper, `expo-device`, the Live source or the typed client; `biometricStoreOf` is `return null;`. The checks of W15 and W51 pass unchanged | Section 5.7 |
| Device check (lane 1, `dems2_phone`, four sessions, 365 s in all) | The unpaired phone in LIVE mode: the Login screen is drawn by the compiled `LiveAuthProvider`; ONE press of Sign In is refused by the auth layer ("this tablet is not paired … nothing was sent"); the server's log of the session holds 0 POST requests and 0 requests to a sign-in operation. Afterwards: Simulated mode, no reverse rule, the app stopped, the backend stopped, no listener | Section 6 |
| Device security | `emulator-user-lock.sh status` printed the same three lines at 20:34:34 and at 21:36:20: phone and tablet `CredentialType=PIN`, fingerprint count 1, no keyguard (the user's set-up of 20:33, decision D125); phone2 unchanged. This row set, typed and touched nothing of it | `assets/56_lock_status_start.txt`, `56_lock_status_end.txt` |
| One slip, stated | The first device session made two taps that landed on the soft keyboard (two letters in the app's own Username field, discarded with the app's stop). No request, no stored value, no device setting (finding F-13) | Section 6 |

## 2. Files

All under `apps/mobile/src/auth/` (the row's write path).

| File | Kind | What |
|---|---|---|
| `auth-provider.tsx` | changed | `AuthProvider` is now the switch (`:89`): `LiveAuthProvider` when the runtime holds the app's Live source (`useMobileLiveRuntime()`), else `SimulatedAuthProvider` (`:100`), which is the predecessor's provider with the Core's actions taken from `useCoreActions()` (AC-C-53) |
| `auth-session.tsx` | new | What both providers share: `AuthSession`, `BiometricInfo`, `useAuthSession`, `lockoutInfoOf`, `toContractSignInResult`, `isSignInBlocked`, `useActivityTouch`, `AuthFrame`. Moved out of `auth-provider.tsx`, which re-exports the public names |
| `live-auth-provider.tsx` | new | `LiveAuthProvider`: the auth of LIVE mode (section 3) |
| `live-auth-model.ts` | new | The pure rules: the sign-in block, the fate of a token after operation 8, a rejected sign-in for the Login screen, the notice of a session end, the prompt plan |
| `live-biometric.ts` | new | The biometric token storage over the one secure-store wrapper. Loaded by a debug build only |
| `auth-notice.tsx` | new | `AuthNoticeAlert`: the kit `Alert` of `useAuthSession().notice` |
| `i18n.ts`, `i18n-bundle.ts` | new | Seven sentences at `features.auth.*`, and their registration in the app's i18n instance |
| `biometric.ts` | changed | S1-2, S1-3: `BiometricSimAuth` may answer later (`:143`); `applyBiometricOutcome` returns at once for the simulator and a promise for a Live source (`:169`); one new result kind, `invalid` (`:136`); `fromFailure` exported |
| `auth-dialogs.tsx` | changed | Two optional props with the old text as default: `IdleLockDialog.reason` (`:21`), `BiometricOfferDialog.note` (`:55`) |
| `index.ts` | changed | Exports of the above |
| `live-auth.test.tsx` | new test | 41 tests: the provider over the app's Live source and the fake transport |
| `live-auth-model.test.ts` | new test | 62 tests: the pure rules as tables |
| `live-biometric.test.ts` | new test | 30 tests: the token storage on the secure-store mock |
| `live-auth-static.test.ts` | new test | 11 tests: AC-C-53, what a release bundle may load, where the layer may keep anything, the copy |

Not changed: `auth-prefs.ts`, `operators.ts`, the two existing test files, and everything outside
the folder.

## 3. What was built

### 3.1 Two providers, one auth session

`AuthProvider` (`auth-provider.tsx:89`) reads `useMobileLiveRuntime()`. Within one runtime mount
the answer never changes (the runtime mounts another subtree across the LIVE boundary), so the
provider never changes under a mounted app.

| | `SimulatedAuthProvider` (SIMULATED, HEARTBEAT) | `LiveAuthProvider` (LIVE, debug builds) |
|---|---|---|
| The Core | The simulator's `auth.ts`, as before | The Core server, through the Live source's actions and `live.client` |
| Actions | `useCoreActions()`: the simulator's own object, answering at once (`:165`, `:186`, `:200`, `:215`) | The same hook; the results are promises |
| `biometric` of the session (MB-7) | `dems.mobile.auth.v1` | The stored marker; `dems.mobile.auth.v1` is neither read nor written (tested) |
| `lastSignOut`, the dialog | Set by the provider | Read from `live.lastSessionEnd` (`live-auth-provider.tsx:221` to `:224`) |

Why two components and not one with branches: AC-C-53 forces a change of the simulated code
anyway (no `.actions` on a source), and with two components that change is four lines while
everything of LIVE stands apart. Deviation DV-1.

### 3.2 Password sign-in, sign-out, idle (S1-1, §9.2)

| Part | Behaviour | Where |
|---|---|---|
| Not paired | No request: `{ ok: false, reason: 'UNAVAILABLE' }`, one `warn` record | `live-auth-provider.tsx:382` |
| Link down | No request: `CORE_OFFLINE`. `isSignInBlocked` is "any source other than SIMULATED with the Core OFFLINE" (§9.5) | `:387`; `live-auth-model.ts:24` |
| Sign-in | `await actions.signIn(username, password)` (CL-26). The union maps as before (`toContractSignInResult`); the operator is found in the replica, with the session's own operator as the fallback | `:394` to `:404` |
| Wrong password, lockout | The action's own results (401 with `attemptsRemaining`, 423 with `lockedUntil`); the lockout view is the replica's `authLockout` slice through the unchanged `lockoutInfoOf` | `auth-session.tsx:150` |
| A rejection | `rejectedSignIn(error)`: an outage is `CORE_OFFLINE` without a toast (the Login screen has its own offline state); a 429 is `UNAVAILABLE` with the presenter's limit toast and its seconds (LB-10, decision D116); anything else `UNAVAILABLE`. What it was is kept in `session.signInFailure` | `live-auth-model.ts:134`; `live-auth-provider.tsx:366` |
| Sign out, Lock console | `settle(() => actions.signOut(...))`. It ends the session here at once, also with the link down (DR-11). The notice is `signOutReasonOf(live.lastSessionEnd)` | `:410`; `live-auth-model.ts:74` |
| Idle | The 5 s throttle (`useActivityTouch`, `auth-session.tsx:183`) calls `actions.touch()`; the Live source reports it at most once a minute (CL-27). The Core ends the session; the dialog opens for `IDLE_EXPIRED` and, with the 8-hour sentence, for `ABSOLUTE_EXPIRED` | `:223`; `auth-dialogs.tsx:21` |

### 3.3 The biometric token (MB-1 to MB-8)

`live-biometric.ts` is the one file of the folder that imports the wrapper. It holds no token: a
value passes through `token()` into the Live source's request and through `sessionIssued()` into
the store.

| Step | What happens | Where |
|---|---|---|
| Marker (MB-7) | Read without a prompt, and only while the pairing gate has a device ID (the runtime reads the device credential first). A marker of an earlier pairing, and one that cannot be parsed, is deleted with its token | `live-biometric.ts:158` |
| Enrol (MB-1) | Only when `live.session.method === 'PASSWORD'` on this device; anything else sends nothing. `live.client.call('setBiometricEnrollment', { enabled: true })`, then `writeBiometricToken(token, owner, biometricWriteMode())`. A failed write stores nothing, turns it off, and tells the Core once (`enabled: false`) so that no live token is left that nobody holds | `live-auth-provider.tsx:241`; `live-biometric.ts:236` |
| The write mode (MB-5, MB-6a, D71 DN37-2) | `unprotected` where MB-6a allows it (not a physical device, or a debug build); else `protected`. One function, so the ruling after the re-probe is a one-line change | `live-biometric.ts:59` |
| Disable (MB-2) | Operation 7 first; on 200 both items are deleted. While the Core cannot be told nothing is deleted and the call rejects (as an unpair, MP-7) | `live-auth-provider.tsx:331` |
| The offer | After a password sign-in, when the device can and this operator is not enrolled here. Its note in LIVE is "Biometric sign-in asks for this device's screen-lock check." | `:296`; `auth-dialogs.tsx:55` |
| Sign in (MB-3, MB-5) | Gates (paired, link up, marker, device not locked, OS availability); ONE check: the existing OS prompt for an item without the requirement and on an emulator, the protected read itself on a physical device with a protected item; then `actions.signInWithBiometric(operatorId)` | `:440` to `:507`; `live-auth-model.ts:228` |
| The request | The runtime sends operation 8 through its second client with the device credential only (D118). This layer changed nothing of that and presents no session | `runtime/sim-adapters.ts:164` |
| Rotation (MB-6) | `sessionIssued` writes the next token with `rotateBiometricToken` (the same options as the old one). The Live source awaits it before the action settles. A failed write deletes both items; the session stays | `live-biometric.ts:211` |
| A failed OS check (MB-4) | `applyBiometricOutcome('failed', …)` → `actions.recordBiometricFailure(operatorId)` (operation 9) → `fromFailure`. A cancelled prompt calls nothing | `live-auth-provider.tsx:429`; `biometric.ts:169` |
| One at a time (F72) | A second press gets the promise of the first (`:510`); the store opens one attempt at a time and hands a token out once per attempt (`live-biometric.ts:183`, `:238`) | |
| The port | Registered when this layer starts a biometric sign-in, not at mount (finding F-1) | `live-auth-provider.tsx:466` |

### 3.4 What an answer of operation 8 means for the token that was sent

`biometricTokenFate` (`live-auth-model.ts:200`). **The list of "kept" is closed; everything else
is "spent"**, and a spent token that was not replaced is deleted with its marker when the attempt
ends (`live-biometric.ts:243`). So a lost answer costs the enrolment on the tablet and no second
request is ever sent with that token.

| The action | Fate | The app |
|---|---|---|
| resolved `ok` | spent; the next one was stored before the action settled | signed in |
| resolved `INVALID_CREDENTIALS` (401) | spent | both items deleted; result `invalid`; the Alert of MB-3 |
| resolved `LOCKED` (423) | kept | result `locked` |
| rejected: 429; 503 `NOT_READY`; no credential for the request | kept | the limit toast, or `core-offline` |
| rejected: 401 `NOT_SIGNED_IN`; 403 `DEVICE_NOT_PAIRED` (`DEVICE_CREDENTIAL_REQUIRED`); 400; 422 | kept (refused before the token was looked at) | an ordinary failed action; the pairing is not touched |
| rejected: 403 `DEVICE_REVOKED` | spent | the runtime ends the pairing |
| rejected: no answer, a time-out, another 5xx, an answer outside the contract, a stop, anything else | **spent** | both items deleted; result `invalid`; the Alert of MB-3 |

This is stricter than `implementation/41` §8.2 ("keeps the token and tries once") and follows this
row's brief and finding F72. Deviation DV-5, decision DN-4.

### 3.5 Why the session ended (§6.4, §6.5)

`signOutReasonOf`, `noticeOfSessionEnd`, `expiryOf` (`live-auth-model.ts:74`, `:86`, `:100`); all
three are `null` while somebody is signed in.

| `live.lastSessionEnd` | `lastSignOut` | Dialog | `notice` |
|---|---|---|---|
| own Lock (also with the link down) | `LOCK` | — | — |
| own sign-out; `SIGNED_OUT` by the Core | `USER` | — | — |
| `IDLE_EXPIRED` | `IDLE` | "Session expired", the 15-minute sentence | — |
| `ABSOLUTE_EXPIRED` | — | "Session expired", the 8-hour sentence | `absolute-expired` |
| `USER_DISABLED` | — | — | `user-disabled` |
| `TOKEN_REUSE` | — | — | `token-reuse`; both biometric items deleted (`live-auth-provider.tsx:202`), the device credential untouched |
| an invalid credential; the end of the pairing | — | — | — (the Pair screen's) |
| a sign-in attempt found the token dead | (unchanged) | — | `biometric-invalid`, until somebody signs in |

### 3.6 The copy

Seven sentences, each the specification's own (`i18n.ts`), at `features.auth.*`: the four Alerts,
the screen-lock note (MB-6a), "Sign in with your password to change biometric sign-in." (MB-1),
and one of this row ("Biometric sign-in could not be turned on on this tablet."). A static test
holds that none says or implies hardware protection and none speaks of a simulation.

## 4. Requirement to test

Test files: A = `live-auth.test.tsx`, M = `live-auth-model.test.ts`, B = `live-biometric.test.ts`,
S = `live-auth-static.test.ts`.

| Requirement | Test |
|---|---|
| Q11, MB-9 (the server takes a token, never a claim; no security key on mobile) | A "one OS check, then operation 8 with the stored token under the DEVICE credential"; no file of the folder names a security key |
| SR-16 (the session token in memory only) | A "signs in with the device credential as the bearer … keeps the session token out of everything readable"; A "nothing secret is readable" |
| MB-1, AC-C-68 | A "the offer after a password sign-in: Enable calls operation 7 once, in the password session"; A "in a session created with the fingerprint nothing is offered, the switch is blocked, and turning it on sends NO operation 7" |
| MB-2 | A "the Settings switch in a password session: on … off"; A "turning it off while the Core cannot be told deletes nothing" |
| MB-3, AC-C-69 | A "one OS check, then operation 8 … the next token is in the store BEFORE the action settles"; A "a 401 deletes the token and the marker … and the Login Alert says so" |
| F72 | A "every sign-in presents the token of the sign-in before it, never one twice"; A "a double tap is ONE sign-in"; A "a lost answer is NOT retried with the same token"; B "one token, one presentation"; M the fate table (26 rows) |
| MB-4, AC-C-70 | A "a failed check calls operation 9 … and no operation 8; the fifth locks the device"; A "a cancelled prompt calls nothing at all" |
| MB-5 | M "which check the operator sees"; B "a protected item: the read is the OS check" |
| MB-6 | A "a rotated token that cannot be written costs the enrolment, not the session"; B "the write after a rotation" |
| MB-6a, AC-C-105, SD-18 | A "the DEPARTURE-6 conditions" (3 tests); B "how a new token is written" (8 tests); S "no sentence says or implies …" |
| MB-7 | A "a paired tablet with an enrolment shows the fingerprint button from the marker alone"; A "the simulated binding is neither read nor written" |
| MB-8, AC-C-71 | Section 7 (a record, not a test) |
| AC-C-65, SD-23 | A "nothing secret is readable" |
| AC-C-67 | A "a paired tablet opens the Login screen" (`useBootHref()` is `/login`) |
| AC-C-108, SD-10 | A "`session.ended` with `TOKEN_REUSE`" |
| S1-1, LB-10, D116 | A "password sign-in on a paired tablet" (6 tests); M "a rejected sign-in for the Login screen" |
| D118, F77 | A: the bearer of operation 8 is the device credential in every biometric test; A "403 `DEVICE_NOT_PAIRED` is an ordinary failed action" |
| §6.4, §6.5, WS-14, DR-11 | A "sign out, Lock console and the server-driven idle" (7 tests); M "why the session ended" (14 rows) |
| AC-C-53 | S "take the Core's actions from `useCoreActions()`" |

## 5. Verification

All commands from `/Users/gsp-budi/Documents/DEMS`, no `cd`.

### 5.1 Baseline, before the first edit (`assets/56_baseline.log`)

```
## 2026-10-04 20:40:48 WIB $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 82 passed, 82 total
Tests:       992 passed, 992 total
exit=0
## 20:41:47 $ npm run typecheck -w @dems/mobile      exit=0
## 20:41:55 $ npm run lint -w @dems/mobile           exit=0
```

### 5.2 Final gate on the finished tree (`assets/56_gate_final.log`)

```
## 2026-10-04 21:37:00 WIB $ npm run test -w @dems/mobile -- --maxWorkers=2 --silent
Test Suites: 90 passed, 90 total
Tests:       1185 passed, 1185 total
Time:        87.317 s
exit=0
## 21:38:28 $ npm run typecheck -w @dems/mobile      exit=0
## 21:38:37 $ npm run lint -w @dems/mobile           exit=0
```

`--silent` leaves the console output of the tests out of the log; it changes no result. 90 `PASS`
lines, no `FAIL`. Of the 8 suites and 193 tests above the baseline, 4 suites and 144 tests are
this row's; the other 4 suites (`features/pairing/pairing-live*.test.*`,
`stack-check-service-name.test.tsx`) and 49 tests are the pairing row's, which is in flight.

### 5.3 The existing tests are unchanged (CLG (a), AC-C-101)

```
$ git diff --stat acaff20 -- apps/mobile/src/auth/auth-provider.test.tsx apps/mobile/src/auth/biometric.test.ts
(no output)   exit=0
72e04bf0cb03b725070bf9ece75873a5cc75c1af  auth-provider.test.tsx     (before the row: the same)
64206281d4dee87fedd6e6be3a3de2b1fa5768fb  biometric.test.ts          (before the row: the same)
$ git diff --stat acaff20 -- apps/mobile/src/auth
 apps/mobile/src/auth/auth-dialogs.tsx  |  19 ++-
 apps/mobile/src/auth/auth-provider.tsx | 241 +++++++++++++--------------------
 apps/mobile/src/auth/biometric.ts      |  62 ++++++---
 apps/mobile/src/auth/index.ts          |  33 ++++-
 4 files changed, 180 insertions(+), 175 deletions(-)
```

The hashes before the row are in `.cache/rollback/W56/hashes_before.txt`. `git status --short`
lists no test file of another folder as modified; the test files of the runtime and of the
pairing folder that it lists as new are those rows' own.

### 5.4 The new tests (`assets/56_live_tests_verbose.txt`: every name)

```
PASS src/auth/biometric.test.ts          21      PASS src/auth/live-auth-model.test.ts    62
PASS src/auth/auth-provider.test.tsx      7      PASS src/auth/live-auth-static.test.ts   11
PASS src/auth/live-biometric.test.ts     30      PASS src/auth/live-auth.test.tsx         41
Test Suites: 6 passed, 6 total
Tests:       172 passed, 172 total
```

`live-auth.test.tsx` mounts the real `AppProviders` with `createMobileLive({ fetch, socketFactory,
now, timers })` of the fake transport. The Core is a small model the scripts read: the devices,
the one session, the device's lock, and the token family (single use, rotation, a reuse ends the
biometric session with `session.ended`). Every request and answer is checked against the contract
(`fake.assertNoViolations()` after each test).

### 5.5 The client gate (CLG)

| Item | Result |
|---|---|
| (a) existing tests pass, files absent from `git diff --stat acaff20` | Section 5.3 |
| (b) one Live test per settle site, with success, the site's refusal and an outage | S1-1 `signIn`: success, 401, 423, 429, 403, outage, link down. S1-2 `signInWithBiometric`: success, 401, 423, 429, 503, outage. S1-3 `recordBiometricFailure`: counted, locked, 429. Operation 7: success, 429, outage, and no request in a biometric session. A sign-in has no permission, so "denied" (AC-C-48) does not apply; its refusals are the ones listed |
| (c) no `useSimActions`, no `.actions` on a source | `grep -n -E "useSimActions\|\b(sim\|live\|source\|mobile)(\.live\|\.sim)?\.actions\b"` over the production files of the folder: no line (exit 1). Held by `live-auth-static.test.ts` |
| (d) one live check on a lane | Section 6 |

### 5.6 Mutation check (`assets/56_mutations_final.log`, `56_mutations_run1.log`)

Rule M15: the tree is not edited. A jest transformer outside the repository's sources
(`.cache/w56/mut/`; copies: `assets/56_mutating_transformer.cjs.txt`, `56_jest_mut_config.cjs.txt`,
`56_mutate.py.txt`) changes one text of one production file in memory and runs the six test files
of the folder; the hashes of the seven mutated files are compared before and after.

```
# W56 mutation check, 2026-10-04 21:39:29; 6 test files per run; the tree is not edited
M11  detected        7s  A LOST ANSWER KEEPS THE TOKEN: it would be sent again  | Tests:       8 failed, 164 passed, 172 total  | live-auth-model.test.ts, live-auth.test.tsx
…
## 78 detected, 0 not detected, 0 not applied, of 78
## the mutated files in the tree, before and after: identical
# finished 21:46:58
```

Run 1 (21:21 to 21:29): 76 of 78 detected. The two survivors, and what they showed:

| ID | Change | What was missing | Added |
|---|---|---|---|
| M06 | The end of the pairing counts as a session end | No row in which an end of the pairing carries a sign-out reason | One row of the table "why the session ended" |
| P29 | The expiry dialog is not tied to "nobody is signed in" | The test closed the dialog before it signed in | The 8-hour test signs in with the dialog open and expects it gone |

Among the detected ones: a lost answer keeps the token (M11), no token is ever deleted after an
attempt (P28), operation 7 is sent in a biometric session (P04), `TOKEN_REUSE` deletes nothing
(P09), a double tap is two sign-ins (P13), no OS check before the token is sent (P15), a cancelled
prompt sends the token (P16), an unpaired tablet sends a sign-in (P01).

### 5.7 What a release build holds (`assets/56_release_transform.log`, `56_release_gate_w56.cjs`)

The method of W15 and W51: Metro's own release transform (Babel with the app's preset, the inline
plugin, constant folding), dependencies collected from what is left.

```
debug build   biometricStoreOf: "if (__DEV__) { var existing = stores.get(mobile); if (existing !== undefined) return existing; var _ref = require('./live-biometric'), …"
    debug build: the provider loads the token storage=ok   the token storage loads the wrapper and the device module=ok   no other file loads them=ok
release build biometricStoreOf: "return null;"
    release: no file of the auth layer that is part of the bundle loads the token storage, the wrapper, the device module, the Live source or the typed client=ok
    release: biometricStoreOf is `return null`=ok   release: the provider names no secure item and no token storage=ok
exit=0
$ node …/51_release_gate_w51.cjs   (unchanged script)   eight checks =ok   exit=0
$ node …/15_release_gate_w15.cjs   (unchanged script)   release build holds no probe=ok release build keeps the wrapper=ok   exit=0
```

No release bundle was built in this row (no `expo export`): section 15.

## 6. The device check (CLG (d)): an unpaired phone in LIVE mode

Lane 1 only: `dems2_phone` (`emulator-5554`), backend `127.0.0.1:4421`, database `dems_lane_1`,
Metro 8082, each run inside `.locks/core-server.lane1.lock` and `device-session.sh` (sandbox bypass
for the port, `adb` and the database):

```
TAP_TRIGGER="540 1975" TAP_OPERATOR="400 2205" TAP_SUBMIT="540 1428" \
  /usr/bin/lockf -k -t 600 .locks/core-server.lane1.lock /bin/sh .cache/w56/run_w56.sh attempt
```

`assets/56_run_w56.sh` and `56_device_w56.sh` are the two scripts; `assets/56_device_run.log` is
the whole output of the run that counts. The phone is not paired, so a sign-in on a paired device
is not shown here (W59). Shown is what the auth layer does on an unpaired device.

| Session (device lock held) | What | Result |
|---|---|---|
| 1. 21:27:13 to 21:28:39 (86 s) | First attempt | The Login screen opened with the soft keyboard up, and the view dump the script relied on is not available on this screen (`uiautomator dump`: "could not get idle state"). Its two fallback taps at the position of the "Demo operators" row landed on the keyboard: **two letters were typed into the app's own Username field.** No sign-in was pressed, no request was sent, nothing was stored; the app was stopped right after (finding F-13). `assets/56_device_run_first_attempt.log` |
| 2. 21:29:17 to 21:32:04 (167 s) | Look, with a keyboard check | No tap and no key: the keyboard was up, and the script's check "keyboard closed, app in front" did not pass (why the app was not in front at that moment is not known; the view dump had just been tried). `assets/56_device_run_first_look.log` |
| 3. 21:33:26 to 21:34:19 (53 s) | Look | Keyboard closed, the app in front; the "Demo operators" list opened and closed by a tap; positions read from the screencap. `assets/56_device_run_look.log` |
| 4. 21:34:52 to 21:35:51 (59 s) | **The attempt** | Below. `assets/56_device_run.log` |

**Session 4, quoted from `56_device_run.log`.**

```
== A. cold start in LIVE mode on the Login screen: demsdemo:///login?core=LIVE (the device is not paired)
-- dems.mobile.prefs.v1 (after the launch with core=LIVE …): {"coreLinkSource":"LIVE"}
-- soft keyboard: mInputShown=false
-- focus before the taps: mCurrentFocus=Window{… com.dems.demo.tablet/com.dems.demo.tablet.MainActivity}
== B. the demo-operator list is opened (a tap on the app's own row)
-- input tap 540 1975   (Demo operators)
== C. ONE sign-in attempt on the unpaired device, through the app's own controls
-- input tap 400 2205   (one demo operator: the app fills its own form)
-- input tap 540 1428   (Sign In)
-- waited 0 s for: not paired with the Core server
     1 DEMS-LIVE] GET /api/v1/auth/session 401
     1 DEMS-LIVE] GET /api/v1/auth/status 200
   request lines in all: 2
   sign-in request lines (POST /api/v1/auth/sign-in or /auth/biometric...; must be 0): 0
  source: 'runtime.live.ready',     message: 'Live source ready',   context: { pairing: 'UNPAIRED' },
  source: 'auth.signIn',
  message: 'Sign-in refused: this tablet is not paired with the Core server; nothing was sent',
-- a misuse report of a Live action (live.misuse) in the device log (count; must be 0): 0
-- an error of the JS runtime in the device log (lines with 'Error:' or 'Invariant'; count): 0
-- a credential, a bearer value or a password in the device log of this run (count of lines; must be 0): 0
   secure-store entries (… none listed = none stored):
```

The server's log of the same session:

```
request lines: 3
   1 GET /api/v1/auth/session 401 principal=null
   1 GET /api/v1/auth/status 200 principal=null
   1 GET /api/v1/health 200 principal=null          <- the host's curl of step 2
-- requests to the sign-in operations (…); must be 0:        0
-- state-changing requests (POST) in all; must be 0:          0
{"connectionId":"fe632d79-…","principal":null,"kind":"ANONYMOUS","msg":"socket opened"}
-- a bearer value, a cookie or a credential in the server log of this run (count of lines; must be 0): 0
```

**What the app shows** (read from the screencaps):

| Screencap | On screen |
|---|---|
| `assets/56_login_live_unpaired.png` | The Login screen in LIVE mode: "Core online"; the trust line "Core: • not paired" (no Core name: an anonymous socket carries no state); "Pair this tablet". Under the fingerprint button: "Sign in with your password once to enable biometric sign-in on this tablet." The device now reports an enrolled fingerprint (availability `available`), and no enrolment of the app exists, so the button is disabled with that caption. It was not pressed |
| `assets/56_login_live_unpaired_refused.png` | After the press of Sign In: the Alert "Sign-in unavailable. Sign-in could not be completed. Try again in a moment." (the Login screen's existing wording for `UNAVAILABLE`); the username the app filled in; the password field empty again; the development banner "Open debugger to view warnings." (the `warn` record above) |
| `assets/56_after_reset_simulated.png` | The sign-in screen in Simulated mode after the last step: "Core online", "Core: DEMS-IR-01 • paired (simulated)". The fingerprint caption is the same sentence as in LIVE mode: the device reports an enrolled fingerprint now, and the simulated binding is not set |

**Afterwards** (21:36:20, `assets/56_device_after_state.txt`):

| Point | State |
|---|---|
| Reverse rules | None on `emulator-5554` (`adb reverse --list`: empty). Set and removed by `device-session.sh` |
| App | Not running (`pidof`: exit 1). `dems.mobile.prefs.v1` is `{"coreLinkSource":"SIMULATED"}`, as before the check; every session ended with a launch with `core=SIMULATED` |
| Stored by the app | `dems.sim.v1` and `dems.mobile.log.v1` as Simulated mode writes them; no secure-store entry before, during or after |
| Backend | Stopped by the script each time: `shutdown complete`, `process … is gone` |
| Listeners | None on 4421 or 8081 to 8086 (`lsof`: no output, exit 1) |
| `.locks/core-server.lane1.pid` | Exists, empty (as W51 left it) |
| Device lock | `emulator-user-lock.sh status`: identical at 20:34:34 and 21:36:20 |
| Other ports and devices | 4420, 4422, 4423, 4400, 4432, 5173 to 5178, the tablet and phone2: not used, nothing stopped |

What was done on the device, in full: launches by deep link, force-stops of the app, screencaps,
read-only queries, and seven taps: two in session 1 (on the keyboard, the slip), two in session 3
(the list opened and closed), three in session 4 (the list, one operator, Sign In). The script
holds a BACK key for an open keyboard; it was never sent (no `input keyevent` line in the four
logs). No command typed a text. The fingerprint button, the sensor, the keyguard, the PIN and the
settings were not touched.

## 7. MB-8 and AC-C-71: the case of MB-5 per AVD

| AVD | `isDevice` | Protected write | Protected read | Rotation write | Case in use |
|---|---|---|---|---|---|
| `dems2_phone` | false | W15, without enrolment (11:29): refused in 3 ms, `ERR_AUTHENTICATION`, no prompt, nothing stored. **With the lock and the fingerprint the user set at 20:33: not observed** | Not observed (nothing protected was ever stored) | W15: refused | **(c)**: the token without the requirement, the existing OS prompt first (`biometricWriteMode()` is `unprotected`: D71 DN37-2) |
| `dems2_tablet` | false | The same | The same | The same | **(c)** |
| `dems2_phone2` | false | W15: refused; no lock, no fingerprint (unchanged) | Not observed | W15: refused | **(c)**; with no enrolled fingerprint the app's fingerprint button is disabled |

Source of the W15 columns: `assets/15_observations_summary.txt`. The protected path with an
enrolled fingerprint needs the system prompt and so the user's finger: it is the re-probe of
D125 (3), not this row's (section 12).

## 8. Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| **F-1** | A registration of the biometric port at mount would replace a port the runtime's own tests register before the providers are mounted | `runtime/live-device.test.tsx:698`, `:1145` | The port is registered when this layer starts a biometric sign-in (`live-auth-provider.tsx:466`). For the app there is no difference: only this layer signs in |
| **F-2** | A child's effect runs before the runtime's `mobile.start()`: a marker read at mount took the secure store before the device credential's read (one runtime test went red on it) | `runtime/live-device.test.tsx:432` | The marker is read only while the pairing gate has a device ID (`live-biometric.ts:158`). The runtime's test files pass unchanged |
| **F-3** | **A process that dies between the request and its answer leaves the sent token in the store.** The next launch presents it again; if the Core had used it, that is a reuse (401, the family revoked, an `AUTH_FAILED` row with `TOKEN_REUSE`) | By reading; `live-biometric.ts:183` to `:209` | The window is one request. Closing it means deleting both items BEFORE the token is sent and writing it back for the answers that keep it (a write of a secret at the end of an attempt, which must not bring back the items of a pairing that ended meanwhile). Decision DN-1 |
| **F-4** | The Login screen is not Live-aware yet: the result `invalid` falls into its default branch ("Biometric sign-in is not available right now. Use your password.") and `session.notice` is not drawn | `features/login/use-login-controller.ts:191`, `login-model.ts:120` | W59: section 11 |
| **F-5** | The feature-text registry is outside the write path | `apps/mobile/src/i18n/features.ts:28` (`FEATURE_RESOURCES`) | The seven sentences are added to the i18n instance by `auth/i18n-bundle.ts`. Smallest change: `import { authEn } from '@/auth/i18n';` and the entry `auth: authEn,` in `FEATURE_RESOURCES`; `i18n-bundle.ts` and its two imports can then go (and one static test of this row, which expects no such entry, changes with it). Decision DN-2 |
| **F-6** | The Settings switch says "Simulated identity binding" in every mode | `features/settings/security-section.tsx:59` | W82: in LIVE mode use `features.auth.biometric.screenLockNote`, and with `biometric.changeBlocked` disable the switch with `features.auth.biometric.passwordSessionRequired` |
| **F-7** | After `USER_DISABLED` the stored token stays until the next attempt answers 401 | [CS:§6.4] names no deletion | One refused attempt (one `AUTH_FAILED` row, one failure on the device's counter). Decision DN-5 |
| **F-8** | MB-5 case (b) (an emulator with a protected item) is built to the letter: the OS prompt first, then the read. On an Android emulator with an enrolled fingerprint the protected read may prompt as well (DR-09) | `live-auth-model.ts:228` | Not reachable with the ruled mode: no build that runs LIVE mode writes a protected item. To be looked at with the re-probe |
| **F-9** | A rotation write that fails turns biometric sign-in off without a word to the operator (the session stays, MB-6) | `live-biometric.ts:211` | One `warn` record. The operator sees it at the next Login ("Sign in with your password once to enable biometric sign-in on this tablet."). Decision DN-6 |
| **F-10** | `CoreLinkState` has two values, ONLINE and OFFLINE | `packages/shared/src/domain/enums.ts:66` | "Blocked while the link is not ONLINE" is "OFFLINE" for LIVE |
| **F-11** | The simulated sign-in now awaits the action: one promise job more than before | `auth-provider.tsx:165` | No test of the app sees a difference (992 baseline tests pass unchanged) |
| **F-12** | `uiautomator dump` cannot be taken on the Login screen ("could not get idle state": the screen animates without end) | `assets/56_device_run_first_look.log` | A device row that needs the positions of Login controls reads them from a screencap |
| **F-13** | **A slip of this row's first device script**: it tapped a position read from an older screencap while the soft keyboard covered it: two letters in the Username field | `assets/56_device_run_first_attempt.log` | Nothing was sent or stored; the app was stopped. The script now taps only while the keyboard is closed and the app is in front |
| F-14 | Session 2 counted one line with `Error:` in the device log; its text was not captured, and sessions 3 and 4 counted 0 | `assets/56_device_run_first_look.log` | Not explained. The script now prints such lines |
| F-15 | The device's clock is about one minute behind the host's | `56_device_run.log`: "device time at the first launch" | None here |

## 9. Deviations

| ID | Deviation | Why |
|---|---|---|
| **DV-1** | [CS:§7.4] lists for `auth`: change `auth-provider.tsx` and `biometric.ts`, one new file (the token provider). Built: those two changed, plus `auth-dialogs.tsx` and `index.ts`; seven new production files | Two providers keep the simulated path as it was (section 3.1); the pure rules and the copy are files of their own so that they can be tested and shipped apart from the token storage, which a release bundle must not load |
| **DV-2** | `auth-dialogs.tsx` changed although [CS:§7.4] says "no change" | Without the two optional props the LIVE offer says "Simulated identity binding" and the 8-hour expiry says "15 minutes" |
| **DV-3** | S1-2 says the LIVE sign-in runs through `applyBiometricOutcome`. It does for every outcome but `success` | A token the Core refuses is `invalid` in LIVE (MB-3), not a failed attempt with attempts left |
| **DV-4** | The type of `BiometricInfo.lastOperator` is `BiometricOperator` (the role optional); `BiometricSignInResult` has the kind `invalid`; `AuthSession` has `notice` and `signInFailure`, `BiometricInfo` has `protected` and `changeBlocked` | The marker holds no role (a role is the Core's data). No consumer outside the folder reads the role there; the Login controller has a default branch |
| **DV-5** | A lost answer deletes the token; `implementation/41` §8.2 says "keeps the token and tries once" | This row's brief and F72: a second presentation would be a reuse |
| **DV-6** | Turning biometric sign-in off while the Core cannot be told deletes nothing and rejects | MB-2 names no order. As an unpair (MP-7): the two sides stay equal and the trail holds the change. Decision DN-7 |
| **DV-7** | A failed write at enrolment is followed by one `setBiometricEnrollment { enabled: false }` | So that the Core holds no live token nobody has, and its trail says what the tablet did |
| **DV-8** | An outage at sign-in shows no presenter toast; a 401 `NOT_SIGNED_IN` at sign-in shows none either | The Login screen has its own offline state (S1-1); "You are signed out" is no sentence for a login screen |
| **DV-9** | The LIVE sign-in does not await `sim.ready` | The Live source's `ready` can take until the boot time-out; the gates of the sign-in (paired, link up) say what `ready` would |
| **DV-10** | `ABSOLUTE_EXPIRED` sets no `lastSignOut` | `IDLE` would make today's Login screen show the 15-minute sentence. The notice and the dialog carry the right one |
| **DV-11** | The device check tapped the app's controls; W51 pressed nothing | An unpaired device shows what the auth layer does only when a sign-in is tried. No command typed anything; the demo password stayed inside the app's own form |
| **DV-12** | The device check took four sessions, not one | F-12, F-13. 365 s in all, inside the 10 minutes |
| **DV-13** | `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `gateway_check/01_gate_report.md` and `implementation/99_implementation_report.md` were not written | The parallel-run contract of this delegation |
| DV-14 | `.locks/core-server.lane1.pid` is emptied, not removed | As W51 (its DV-7) |

## 10. Decisions for the controller

| ID | Decision | Recommendation |
|---|---|---|
| **DN-1** | F-3: close the window of a process death by deleting the stored token before it is sent | Put it to the client security review (W100). As built, the auth layer only ever deletes at the end of an attempt, which cannot bring anything back |
| **DN-2** | F-5: one entry in `src/i18n/features.ts` | Grant it to W59 (it is one import and one line), or accept the registration at load |
| **DN-3** | The write mode after the re-probe with a device lock (D71 DN37-2, D125 (3)) | `biometricWriteMode()` (`live-biometric.ts:59`) is the one place. Until then: `unprotected` where MB-6a allows it |
| **DN-4** | DV-5: a lost answer costs the enrolment on the tablet, with no second request | Confirm, and record the difference to `implementation/41` §8.2 |
| **DN-5** | F-7: delete the stored token at `USER_DISABLED` | Accept as built, or one line in `live-auth-provider.tsx:210` |
| **DN-6** | F-9: a toast when the next token could not be stored | Accept (the specification asks for none), or give the sentence |
| **DN-7** | DV-6: disable while the Core cannot be told | Accept. The alternative deletes locally and leaves the Core's trail without the change |
| **DN-8** | The seams of section 11 | Into the briefs of W59, W60 and W82 |
| **DN-9** | Section 12: the user's commands for the device rows | Hand them to the user with W59's device check |

## 11. Seams for W59 and W60 (and W82)

Everything is exported from `@/auth`.

| Row | To | Use | Notes |
|---|---|---|---|
| W59 | Draw the Alerts of §6.4, §6.5, MB-3, WS-14 | `<AuthNoticeAlert />` in the Login card, or `useAuthSession().notice` (`kind`, `textKey`, `status`) in `noticeFor` | `null` while signed in and outside LIVE. Kinds: `token-reuse`, `biometric-invalid`, `user-disabled`, `absolute-expired` |
| W59 | Word a limit (AC-C-110) | `useAuthSession().signInFailure`: the presenter's description of the last refused attempt (`kind`, `retryAfterSeconds`, `outage`) | The limit toast is already shown by the auth layer. For `kind === 'LIMIT'` the screen keeps the form filled and shows neither its "unavailable" Alert nor the offline notice. `null` after a wrong password or a lockout |
| W59 | The fingerprint button's result | `signInWithBiometric()` may resolve `{ kind: 'invalid' }`: show nothing of its own, the notice says it | Today it falls into the controller's default branch |
| W59 | The lockout | Unchanged: `useAuthSession().lockout` (the Core's, per device) |
| W59 | The trust line | `usePairing().deviceId` of `@/runtime` (not this row's) |
| W59 | A paired sign-in on the device | The contract's `signIn` is the same call. On an unpaired device it answers `UNAVAILABLE` and sends nothing |
| W60 | The gate | `useAuth().isAuthenticated` is false after every session end of section 3.5; the pairing gate is the runtime's. After `TOKEN_REUSE` the device stays PAIRED: the target is `/login`, not `/pair` |
| W60 | A session that comes back | After a locally reckoned expiry the Live source can sign the operator in again without a sign-in; `isAuthenticated` follows in both directions, and the dialog closes with it |
| W82 | The biometric switch (AC-C-68) | `biometric.changeBlocked` → disabled, with `t('features.auth.biometric.passwordSessionRequired')`; `setBiometricEnabled(on)` rejects when the Core or the storage did not take the change (the existing `.catch` shows the toast) | In a biometric session `setBiometricEnabled(true)` sends nothing |
| W82 | The description (MB-6a (3)) | In LIVE: `t('features.auth.biometric.screenLockNote')` in place of `mobile.biometric.identityNote`. `biometric.protected` says how the token is stored (`null`: none) | While it is not `true`, no text may claim hardware protection |
| Tests | Build the layer in a test | `createMobileLive({ fetch, socketFactory, now, timers, random })`, `<AppProviders sim={mobile.sim}>`; an enrolment is two seeded items (`dems.live.bio.v1`, `dems.live.bio.meta.v1`) | The session model of `live-auth.test.tsx` (`bootCore`) answers by the credential a request presents and can be copied. The OS prompt is the `expo-local-authentication` mock of `jest.setup.ts` |

## 12. Not exercised on a device and why

Nothing below was tried on a device. The biometric paths are proven by the Live tests on the fake
transport and the storage mocks (section 5.4).

| Path | Why not | What it needs |
|---|---|---|
| A password sign-in on a paired device | The phone is not paired; the Pair screen's Live flow is W57's, the Login screen's is W59's | W59's device check |
| Biometric enrolment (operation 7) | Needs a password session on a paired device | The same session; with the ruled mode the write shows no system prompt, so no finger is needed for it |
| **Biometric sign-in (operation 8)** | **Needs the user's finger: one command for the user.** It raises the system's biometric prompt, which no agent answers | App state: LIVE, paired, enrolled by the step before, signed out, on the Login screen, the fingerprint button pressed, the system prompt "Sign in to DEMS" on screen. Then the user's command for the enrolled finger on that emulator (the sensor touch of `emulator-user-lock.sh`'s own procedure: `adb -s emulator-5554 emu finger touch 1`, then `… emu finger remove 1`) |
| A failed OS check (operation 9) | **Needs the user's finger** (a finger that is not enrolled) | The same state; the user's command with another finger ID (`… emu finger touch 2`, then `remove 2`) |
| A cancelled prompt | Needs the system prompt | The same state; the user presses "Use password" on the prompt |
| The protected item with an enrolled fingerprint (MB-5 a, MB-8) | Raises the system prompt at the write | The re-probe of D125 (3): `/bin/sh docs/…/implementation/assets/15_run_w15.sh phone tablet`, by W15's owner, the prompt answered by the user |
| `TOKEN_REUSE` | Needs a second client that presents a used token | The end-to-end rows |
| The idle expiry | 15 minutes without activity | The end-to-end rows |
| A keyguard | The phone showed none during this row | If one shows, `device-session.sh` stops with 77 and the user unlocks |

## 13. Error handling and logging

Every record goes to the persistent runtime log (`dems.mobile.log.v1`) with a correlation ID per
attempt. No record holds a password, a username, a token or a credential (the log drops such keys;
the storage scans of section 5.4 read the persisted log).

| Path | Record |
|---|---|
| A sign-in on an unpaired device; with the link down | `auth.signIn`, `warn` / `info`, "nothing was sent" |
| A rejected sign-in action | `auth.signIn` or `auth.biometric.signIn`, `warn` (`error` when it is no error of the Core), the presenter's kind |
| The end of a biometric attempt | `auth.biometric.signIn`: signed in or not, what the store released, what became of the stored item |
| An enrolment that was not made, was refused, or could not be stored | `auth.biometric.enrol`: `warn` or `error`, status, envelope code, request ID |
| Biometric sign-in turned on or off | `auth.biometric.enrol`, `auth.biometric.disable`: `info`, the operator ID |
| A session end | `auth.sessionEnd`: kind, reason, source (`warn` for `TOKEN_REUSE` and `USER_DISABLED`) |
| A rotation write that failed; a marker of an earlier pairing | `auth.biometric.store.rotation`, `auth.biometric.store.marker`, `warn` |
| A storage failure | The wrapper's own record, by code (`runtime.secureCredentials.*`) |

To the operator: the limit toast and the refusal toasts through the runtime's presenter; one
toast when an accepted offer could not be kept; the Alerts through `notice`; the Settings switch
shows its own failure when `setBiometricEnabled` rejects.

## 14. Rollback (not executed)

| Class | Paths | Command |
|---|---|---|
| R-CO | `apps/mobile/src/auth/{auth-provider.tsx,biometric.ts,auth-dialogs.tsx,index.ts}` | `git checkout acaff20 -- <paths>` (pre-images also in `.cache/rollback/W56/`) |
| R-NEW | `apps/mobile/src/auth/{auth-session.tsx,live-auth-provider.tsx,live-auth-model.ts,live-biometric.ts,auth-notice.tsx,i18n.ts,i18n-bundle.ts}`, the four `live-*.test.*` files, this document, the progress file, `assets/56_*` | `git clean -fd -- <paths>` |
| Device | `dems2_phone`: `dems.mobile.prefs.v1` is `{"coreLinkSource":"SIMULATED"}`, as before | Nothing to undo |

The two classes go together: the four changed files import the new ones.

## 15. Limits of this evidence

| Limit | Why it stands |
|---|---|
| No sign-in reached the real Core server | The device is not paired. Sign-in, enrolment, rotation and `TOKEN_REUSE` are proven against a model of the Core on the contract-checked fake transport, not against the server |
| The model is this row's reading of `implementation/41` | It answers single use, rotation, reuse, the lock and the device-credential rule; it is not the server |
| The React Compiler | On in Metro, off in jest. The device run shows the compiled provider mounts and refuses a sign-in on an unpaired device; no other path ran compiled |
| The protected item | Exercised on the mock only (section 7) |
| The release behaviour | Metro's release transform of the folder; no release bundle and no release APK was built |
| The mutation check | Single text changes of seven production files, against the six test files of the folder |
| Timers | The Live source runs on the fake clock; the 5 s activity throttle reads the real clock |

## 16. Assets (`implementation/assets/`)

`56_baseline.log`, `56_gate_final.log`, `56_live_tests_verbose.txt`, `56_mutations_run1.log`,
`56_mutations_final.log`, `56_mutate.py.txt`, `56_mutating_transformer.cjs.txt`,
`56_jest_mut_config.cjs.txt`, `56_release_gate_w56.cjs`, `56_release_transform.log`,
`56_run_w56.sh`, `56_device_w56.sh`, `56_device_run.log`, `56_device_run_look.log`,
`56_device_run_first_attempt.log`, `56_device_run_first_look.log`, `56_device_after_state.txt`,
`56_login_live_unpaired.png`, `56_login_live_unpaired_refused.png`, `56_after_reset_simulated.png`,
`56_lock_status_start.txt`, `56_lock_status_end.txt`.

---
*Generated: 2026-10-04 21:50 WIB*
