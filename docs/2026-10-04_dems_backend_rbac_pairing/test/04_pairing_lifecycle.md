---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 70
plan_row: W48
title: Acceptance test, pairing lifecycle (SC5; AC-B-28, AC-B-32 to AC-B-39, AC-B-41, AC-B-82)
date: 2026-10-04
agent: test-expert (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_spec: masterplan/01_specs.md rev 2.2 (§4.6, §4.7, §5.2, §5.6, §6, §9.2, §13, §16.4, §16.5, §16.10); gateway_check/01_gate_report.md (rules M9, M10, M12, M15, M16); implementation/32, 34, 41, 42
evidence_tier: 2
status: complete
---

# W48: acceptance test "pairing lifecycle"

All times are WIB (UTC+7) on 2026-10-04. Commands ran from `/Users/gsp-budi/Documents/DEMS`, never
from a subfolder. Database commands and every run that binds a port ran with the per-command
sandbox bypass (P10). Quoted runner output is unchanged except that blank lines are left out.
Instants of the manual server clock are written as seconds after the boot of the test's server
(`+673.00 s`).

**No pairing code, device credential, session token, cookie value, biometric token, credential
hash or password appears in this document or in its assets.** The test takes each from an answer
and hands it on; it prints counts, statuses, audit types and identifiers (`PCD-000001`,
`DEV-0001`, `OPR-002`, `SES-20310101-0025`). A search of every asset for a session token, a device
credential, a biometric token, a bearer value, a cookie pair and a QR payload found 0 lines
(18:39); the only standalone six-digit numbers in them are character counts the test prints.

## 1. Result

| Question of the row | Answer | Where |
|---|---|---|
| The file passes under `test:db` | **Yes: 1 file, 31 tests, exit 0** (18:38:01; 3.72 s); 0 databases left with the run prefix. The file, unchanged by a mutation, ran 16 times between 18:25:21 and 18:42:26 (13 times alone, once as a scratch copy, twice inside the whole project): 16 green | section 9.1 |
| Each lifecycle step asserts its audit type | **Yes.** Every step reads the rows it wrote and asserts type, actor and device; one test then asserts the whole trail of the journey as ONE sequence of 47 rows and that no row was written outside a step | sections 4, 5 |
| A revoked device's REST call answers 403 and its socket closes with 4403 | **Yes.** Six calls (three with the session token, three with the device credential): 403 `DEVICE_REVOKED`, one `ACCESS_DENIED` row each. The socket: `device.revoked`, then close 4403, **5.1 ms** after the revoke was sent (bound 1,000 ms; 3.9 to 8.8 ms over seven runs) | sections 4, 6 |
| A device revoked while it records leaves the session in RECORDING and another operator stops it | **Yes.** RECORDING before and after; the recording goes on (2,000 ms to 4,000 ms, 4,555,556 to 9,111,111 bytes) with the Core link OFFLINE; the supervisor's stop from the web console answers 202, `RECORDING_STOPPED` names `OPR-002`, the session is SEALED | section 4, steps 13 to 15 |
| A dump holds no code and no credential the test issued | **Yes.** 30 tables, 421 rows: 0 of 4 codes, 5 guesses, 2 device credentials, 5 session tokens, 3 biometric tokens and the demo password, in every form searched; each code and token is there once, as its SHA-256. The same for the 47 audit rows, 45 events, 254 realtime frames, 29 refusals and the server's log at level `trace` (973 lines) | section 8 |
| A used biometric token presented again closes that session's socket with 4401 within 1 s | **Yes.** 401; `session.ended` with `TOKEN_REUSE`, then close 4401, **3.4 ms** after the request was sent (2.9 to 6.0 ms over seven runs); the PASSWORD session of the same operator on the same device and its socket stay open | sections 6, 7 |
| An unpaired caller succeeds on `getSignInStatus` | **Yes**: 200, twice, with no credential and no `Origin`; its sign-in answers 403 `DEVICE_NOT_PAIRED` (no attempt counted, no password verified); its socket received `hello` and `heartbeat` only over the whole journey (40 frames) | section 4, step 1 |
| Typecheck, lint | Exit 0 and exit 0 without a warning for the whole workspace with this file as it is now (18:37:35). At the end (18:45): lint exit 0 without a warning; typecheck exit 2 with two errors, both in a file another row wrote at 18:40 (`test/acceptance/shared-state.support.ts`, in flight), none in this file | section 9.3 |
| The whole `db` project | **Exit 0, twice: 112 files, 1,646 tests passed, 1 skipped** (18:34:23 to 18:37:26; and with the file as it is now, 18:39:08 to 18:42:26). No test failed, so there is no failure to attribute to another row | section 9.4 |
| Can the test fail | **9 of 9 changes of the test's input or of the clone are detected**, the three the row names among them; no file of the tree was changed for it | section 10 |
| Findings | 1 Low (as specified, with a consequence for re-pairing), 4 Info | section 11 |
| End state | 0 databases with the prefix `dems_test_step_70_`; no listener and no process of this row; `.locks/postgres.pid` 19121 | section 18 |

## 2. What was written

| Path | What |
|---|---|
| `apps/core-server/test/acceptance/pairing-lifecycle.test.ts` | The one test file of the row: 1,563 lines, 31 tests in five blocks, project `db` (the project takes `test/acceptance/**/*.test.ts`). SHA-256 `b59b9283…0d554005`, last written 18:37:35. No support file beside it was needed |
| `docs/2026-10-04_dems_backend_rbac_pairing/test/04_pairing_lifecycle.md` | This document |
| `docs/2026-10-04_dems_backend_rbac_pairing/test/assets/04_*` | 19 files: runner output, the mutation harness and its logs, the reproduction of finding W48-F1, the probe, the end-state script and its output (section 14) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/test_expert_step_70.md` | The progress file of the row |

Nothing else was written: no production file, no other row's test, no configuration, no shared
tracking file. The mutation harness, the reproduction and the probe live outside the repository
(the session's scratch folder) and reach the test file only through a load-time transform.

## 3. What was tested, why it matters, how

### 3.1 Why it matters

Pairing is what makes the mobile app a known client of the Core in Live mode (spec §6, Q5), and
revocation is the only way to take a lost tablet out. SC5 asks that the gate, the registry, the
revocation and the audit of each step hold together. Each module row proved its own operations
on its own app (pairing W32 without a listener, the realtime channel W42 with scratch devices,
the biometric token W41 with recorded publications). This test is the first place where one
device goes through all of them in order on one server: the code, the credential, the session,
the socket, the Core link, a recording, the revoke, and the next pairing.

### 3.2 Who the callers are

| Caller | What it holds | What it sends |
|---|---|---|
| The portal | A SUPERVISOR's web session (`OPR-002`), signed in through `POST /api/v1/auth/sign-in` | A POST: the cookie and the web console origin `http://127.0.0.1:5173`. A GET: the cookie, no `Origin`. Its socket: the origin and the cookie |
| The mobile app | Only what the answers gave it: a device credential after the redeem, a session token after a sign-in, a biometric token after an enrolment | REST: no `Origin`, `Host: 127.0.0.1:4420`, `User-Agent: okhttp/4.12.0`, ONE bearer value (the session token when signed in, else the device credential), never a cookie (measured on the emulator: decision D69, finding F56). Its socket: the own origin `http://127.0.0.1:4420` and the bearer value. After a sign-in it reopens its socket with the session token, as the Live source does |
| A device that never paired | Nothing | The same without a bearer value. Its socket stays open from the first test to the end |
| A second operator on the web | The INVESTIGATOR's web session (`OPR-001`) | Used by the control of section 4, step 2 |

### 3.3 What is real, and what is the test's

| Part | In this test |
|---|---|
| The server | `buildApp` (the real factory) on the file's own clone of `tpl_seed`, as `dems_app`; booted through `app.readiness.boot()` (a running engine); LISTENING on `127.0.0.1` at port 0 (an ephemeral port; asserted not to be 4400, 4420 to 4423, 4432 or 5432) |
| REST | `app.inject`: stages 2 to 7 and the modules' handlers, as in every landed test of the server. Not HTTP over the listener (section 12) |
| The socket | A real WebSocket (`ws` 8.22.0, the realtime row's `openSocket`) to `ws://127.0.0.1:<port>/ws`, with exactly the headers above |
| The Core link | **Never set by the test.** No call of `setTabletLink` is in the file. It becomes CONNECTED when the paired tablet's socket is admitted and OFFLINE when the tablet is revoked: the realtime channel's own call. A control shows that without the socket the pre-check blocks |
| The server clock | A manual clock (2031-01-01T00:00:00Z at the boot); it moves only when the test moves it |
| The engine's timer, the channel's three timers | Manual (the engine row's `manualTimer`, the realtime row's step timer). `drive(ms)` moves the clock 50 ms at a time and lets each tick's unit end |
| The two expiry sweepers | Stopped (the realtime row's app does that): the expired code is closed by the redeem that meets it (W32 choice 5) |
| The owner role | `db.ownerPool()`: SELECT for assertions and the dump; one UPDATE in a transaction that is rolled back (the positive control of the scan) |

### 3.4 Time, and the only real waits

Nothing sleeps. The clock is advanced by hand: 299,999 ms and 1 ms (the code's lifetime), 301 s
(a fresh window of the redeem lock), 59,999 ms and 1 ms (the lock), and by `drive` for 5 s (a
pre-check, twice), 2 s (twice) and 20 s (the finalisation). The journey covers 695 s of the
server clock in about 0.6 s of test time (the sum of the 31 tests in the verbose run of 18:38:01).

The real waits are waits for a socket EVENT, each bounded:

| Wait | Bound | Whose |
|---|---|---|
| The close of a socket (`ended`) | 5,000 ms (`SOCKET_EVENT_CAP_MS`), then the test fails with the types the socket received | This file |
| The handshake, a message of a type (`opened`, `nextOf`), a heartbeat on each socket (`settle`), the hub forgetting a socket (`untilSockets`) | 5,000 ms (`EVENT_GUARD_MS`) | The realtime row's support |

**The two deadlines of 1 s are measured, not waited for.** `performance.now()` (the test's real
clock) is read immediately before the request is sent; the close event of the client socket
stamps `performance.now()` in its listener. The difference includes the request itself, so it is
an upper bound of "from the commit". The assertion is `< 1,000 ms`; the number is stated in the
file from the specification (§4.7, SR-41, SR-74), not imported from the code under test.

### 3.5 Helpers of other rows that this file imports (read-only)

| From | What |
|---|---|
| `test/helpers/db` (W11) | `useTestDatabase({ template: 'seed' })` |
| `test/support/pairing` (W32) | The URLs, the seeded operators, `portalPost`, `devicePost`, `deviceGet`, `redeem`, `revokeUrl`, `expectContract`, `storedCode`, `storedDevice` |
| `test/support/identity` (W24) | The URLs, `webSignIn`, `cookieValue`, `deviceSignIn`, `get`, `sessionOfToken`, `occurrences` |
| `test/support/core` (W21) | `readTrail`, `readHead`, `verifyTrail`, `linkProblems` |
| `test/support/config` (W08) | `credentialLeaks` |
| `src/realtime/__tests__/support` (W42) | `realtimeApp` (the booted, listening app on manual time), `openSocket`, `deviceHeaders`, `webHeaders`, `settle`, `untilSockets`, `OWN_ORIGIN` |

The last one is not yet in `test/support/` (decision DN-3 of section 17).

## 4. The lifecycle, step by step

One journey on one server; each row below is a step whose audit rows the test asserts exactly
(`[type, actor, device]`). "—" is no actor or no device. The numbers of the specification
(300 s, 3 and 60 s, 5, 1 s) are constants of the file, stated from §6.1 and §4.7.

| # | At | Step | Answer and what else is asserted | Audit rows of the step |
|--:|---|---|---|---|
| 1 | +0 s | **AC-B-32.** A caller with no credential: `getSignInStatus`, health, `signIn` (no `Origin`; own origin), five other operations; then its socket | 200 `SignInStatus` (not locked, 5 attempts); 200; 403 `DEVICE_NOT_PAIRED` twice, no cookie; 401 `NOT_SIGNED_IN` five times; after the refused sign-ins the status is unchanged and the count of Argon2id derivations is unchanged (no attempt, no password verified); no session row. Socket: `hello` ANONYMOUS with the one topic `heartbeat` | none |
| 2 | +0 s to +5 s | The portal signs in (supervisor, investigator); its socket: OPERATOR with `admin`. **The control**: the Core link is OFFLINE; the investigator creates a session on the web and starts it | 201; 202; after 5 s 409 `PRECHECK_BLOCKED`; the session is in PRECHECK with outcome BLOCK, and the ONE blocking check is `CORE` (`OFFLINE`); cancel 204 | `AUTH_SUCCESS` OPR-002; `AUTH_SUCCESS` OPR-001; `SESSION_CREATED`, `PRECHECK_BLOCKED`, `SESSION_CANCELLED` (OPR-001) |
| 3 | +5 s | **AC-B-33.** The portal issues code A | 201; six digits; `expiresAt − issuedAt` = 300,000; 5 attempts allowed. The stored row read as the owner: nine columns, the only one about the code is `code_hash`, 32 bytes, equal to SHA-256(`<code ID>:<code>`); the code in the row in 0 of 4 forms. The status read gives the ID and 5 attempts | `PAIRING_CODE_ISSUED` OPR-002, details exactly `codeId`, `expiresAt` |
| 4 | +304.999 s, +305 s | **AC-B-35.** One millisecond before 300 s the code is still active; at 300 s the redeem | The status read: active, then null. Redeem: 401 `INVALID_CODE`, details `attemptsRemaining` only (this is the "generic refusal" the later ones are compared with). The code EXPIRED, closed at this instant; no device | `PAIRING_CODE_CLOSED` (—, `reason: EXPIRED`); `PAIRING_FAILED` (—) |
| 5 | +606 s | **AC-B-36.** Code B; three wrong codes | 401, 401 (the same refusal as the expired code, `attemptsRemaining` 2, 1), then 423 `LOCKED` with `lockedUntil` = now + 60,000 (the failure that locks answers 423: decision D93 DN-1) | `PAIRING_CODE_ISSUED`; `PAIRING_FAILED` × 3, the third with `lockedUntil` |
| 6 | +665.999 s | The RIGHT code during the lock | 423 `LOCKED`, `retryInMs: 1`; the code still ACTIVE with 3 failed attempts; nothing paired | `PAIRING_LOCKED` (—) |
| 7 | +666 s | The lock has ended: the fourth and the fifth wrong code | 401, 401; the code EXHAUSTED with 5 failed attempts; the status read: null | `PAIRING_FAILED` × 2; `PAIRING_CODE_CLOSED` (—, `reason: EXHAUSTED`) |
| 8 | +666 s | **AC-B-34.** Code C; the app redeems it without a credential | 201; `DEV-0001`; a credential of the documented form; no cookie; the code REDEEMED; the device PAIRED with 32 bytes of hash equal to SHA-256(credential); its own registration (200) and the registry hold no credential. Then code C again and the exhausted code B: 401, 401, the same generic refusal; still one device | `PAIRING_CODE_ISSUED`; `PAIRING_SUCCESS` (—, DEV-0001; details `coreDeviceId`, `certificateFingerprint`, `codeId`); `PAIRING_FAILED` × 2 |
| 9 | +666 s | **The registry.** Listed PAIRED, offline, nobody signed in, with the code and its issuer. The app opens its socket with the credential; closes it; opens it again | `hello` DEVICE (`heartbeat`, `control`); `online: true`; the Core link CONNECTED. After the close `online: false`; after the reconnect `online: true`; the link did not toggle (no row) | `TABLET_LINK_CHANGED` (—, `TABLET`, `state: CONNECTED`) |
| 10 | +666 s | **AC-B-37.** The investigator signs in on the tablet; the app reopens its socket with the session token; the investigator turns biometric sign-in on | 200, `method: PASSWORD`, the session bound to DEV-0001, the token in the body, no cookie; the registry shows `signedInOperatorId: OPR-001`; socket `hello` OPERATOR; link still CONNECTED; enrolment 200 | `AUTH_SUCCESS` (OPR-001, DEV-0001, `method: PASSWORD`); `BIOMETRIC_ENROLLMENT_CHANGED` (OPR-001, DEV-0001) |
| 11 | +666 s to +673 s | **The recording**, from the tablet (bearer session token): create, start, 5 s, start, 2 s | 201; 202; the check `CORE` is PASS / ONLINE and nothing blocks; 200; RECORDING with 2,000 ms elapsed | `SESSION_CREATED`, `PRECHECK_PASSED`, `RECORDING_STARTED` (OPR-001) |
| 12 | +673 s | **AC-B-38.** The supervisor revokes the tablet | 200 `PairedDevice`: REVOKED, by OPR-002, with the reason and the instant. The socket: section 6. Its session row ended at this instant with `DEVICE_REVOKED`; its biometric token revoked with `DEVICE_REVOKED` (SR-34); the registry: REVOKED, offline, nobody signed in | `DEVICE_REVOKED` (OPR-002, DEV-0001, details exactly `reason`, `sessionsEnded: 1`); `TABLET_LINK_CHANGED` (—, `TABLET`, `state: OFFLINE`) |
| 13 | +673 s | Six calls of the revoked tablet: `getCurrentSession`, `addSessionMarker`, `stopSession` (session token); `getDeviceRegistration`, `signIn`, `signInWithBiometric` (device credential); then health | 403 `DEVICE_REVOKED` six times; no session created; health 200. The retired token and the retired credential on a socket: `hello` ANONYMOUS with `DEVICE_REVOKED`, close 4403 | `ACCESS_DENIED` × 6 (—, DEV-0001; `operationId`, `reason: DEVICE_REVOKED`); none for health |
| 14 | +673 s to +675 s | **AC-B-39.** The session after the revoke; 2 s of ticks | RECORDING before and after; elapsed + 2,000 ms; bytes grow; the Core link OFFLINE | none |
| 15 | +675 s to +695 s | ANOTHER operator (the supervisor, on the web) stops it; 20 s | 202; then SEALED, the link still OFFLINE | `RECORDING_STOPPED` (OPR-002); `EVIDENCE_SEALED` (—) |
| 16 | +695 s | **Re-pairing.** Code D; the app redeems without a credential; the new and the old credential; the old biometric token; code D again; the socket | 201; `DEV-0002` (not DEV-0001); another credential. New credential 200 (PAIRED); old credential 403; the biometric token of DEV-0001 presented by DEV-0002: 401, no session; code D again: the generic 401. The four codes: EXPIRED, EXHAUSTED, REDEEMED, REDEEMED; none active. Registry: DEV-0002 PAIRED, DEV-0001 REVOKED. Socket: DEVICE, link CONNECTED, online | `PAIRING_CODE_ISSUED`; `PAIRING_SUCCESS` (—, DEV-0002); `ACCESS_DENIED` (—, DEV-0001); `AUTH_FAILED` (OPR-001, DEV-0002); `PAIRING_FAILED` (—); `TABLET_LINK_CHANGED` (`CONNECTED`) |
| 17 | +695 s | **AC-B-82.** Section 7 | | `AUTH_SUCCESS`, `BIOMETRIC_ENROLLMENT_CHANGED`, `AUTH_SUCCESS`, `AUTH_FAILED`, `AUTH_FAILED` |

What the link state is after the device is gone, and whether the stop is still possible (the
row's question): **OFFLINE at once** (the realtime channel compares again when a device is
retired and no other device socket is open; the row `TABLET_LINK_CHANGED` at the instant of the
revoke, its message in the simulator is "Tablet control offline — recording continues"), and
**yes**: the stop answers 202 and the recording is finalised and sealed with the link OFFLINE.
What is not possible with the link OFFLINE is to START a recording (step 2; finding W48-F4).

## 5. The audit sequence of the journey

Printed by the test (run of 18:38:01, `assets/04_row_command_verbose.log`). 47 rows after the
boot, sequence 84 to 130 (the seed holds 82 rows, the boot wrote row 83); 0 of them arrivals of
the recording's integrity stream (`FRAME_HASH`, `WRITE_VERIFIED`, `TIMESTAMP_CONFIRMED`, which the
test counts and leaves out of the asserted sequences). The test asserts this exact list of
`[type, actor, device]`, that the list of sequence numbers equals the rows the steps collected
(no row was written outside a step: not by a socket that opened or closed, not by a read), that
no row is stamped before its predecessor, and that the stored chain verifies with the shared
function over all 130 rows.

```
[w48]   seq  at          type                          actor    device    step
[w48]    84  +0.00 s     AUTH_SUCCESS                  OPR-002  -         the portal signs in
[w48]    85  +0.00 s     AUTH_SUCCESS                  OPR-001  -         the portal signs in
[w48]    86  +0.00 s     SESSION_CREATED               OPR-001  -         the control: a pre-check with the Core link offline
[w48]    87  +4.25 s     PRECHECK_BLOCKED              OPR-001  -         the control: a pre-check with the Core link offline
[w48]    88  +5.00 s     SESSION_CANCELLED             OPR-001  -         the control: a pre-check with the Core link offline
[w48]    89  +5.00 s     PAIRING_CODE_ISSUED           OPR-002  -         issue code A
[w48]    90  +305.00 s   PAIRING_CODE_CLOSED           -        -         redeem code A at 300 s
[w48]    91  +305.00 s   PAIRING_FAILED                -        -         redeem code A at 300 s
[w48]    92  +606.00 s   PAIRING_CODE_ISSUED           OPR-002  -         issue code B
[w48]    93  +606.00 s   PAIRING_FAILED                -        -         three wrong codes
[w48]    94  +606.00 s   PAIRING_FAILED                -        -         three wrong codes
[w48]    95  +606.00 s   PAIRING_FAILED                -        -         three wrong codes
[w48]    96  +666.00 s   PAIRING_LOCKED                -        -         the right code during the lock
[w48]    97  +666.00 s   PAIRING_FAILED                -        -         the fourth and the fifth wrong code
[w48]    98  +666.00 s   PAIRING_FAILED                -        -         the fourth and the fifth wrong code
[w48]    99  +666.00 s   PAIRING_CODE_CLOSED           -        -         the fourth and the fifth wrong code
[w48]   100  +666.00 s   PAIRING_CODE_ISSUED           OPR-002  -         issue code C
[w48]   101  +666.00 s   PAIRING_SUCCESS               -        DEV-0001  redeem code C
[w48]   102  +666.00 s   PAIRING_FAILED                -        -         the used code and the exhausted code again
[w48]   103  +666.00 s   PAIRING_FAILED                -        -         the used code and the exhausted code again
[w48]   104  +666.00 s   TABLET_LINK_CHANGED           -        TABLET    tablet 1 opens its socket
[w48]   105  +666.00 s   AUTH_SUCCESS                  OPR-001  DEV-0001  the investigator signs in on tablet 1
[w48]   106  +666.00 s   BIOMETRIC_ENROLLMENT_CHANGED  OPR-001  DEV-0001  the investigator enrols a biometric token on tablet 1
[w48]   107  +666.00 s   SESSION_CREATED               OPR-001  -         a recording is started from tablet 1
[w48]   108  +669.92 s   PRECHECK_PASSED               OPR-001  -         a recording is started from tablet 1
[w48]   109  +671.00 s   RECORDING_STARTED             OPR-001  -         a recording is started from tablet 1
[w48]   110  +673.00 s   DEVICE_REVOKED                OPR-002  DEV-0001  the supervisor revokes tablet 1
[w48]   111  +673.00 s   TABLET_LINK_CHANGED           -        TABLET    the supervisor revokes tablet 1
[w48]   112  +673.00 s   ACCESS_DENIED                 -        DEV-0001  tablet 1 calls after the revoke
[w48]   113  +673.00 s   ACCESS_DENIED                 -        DEV-0001  tablet 1 calls after the revoke
[w48]   114  +673.00 s   ACCESS_DENIED                 -        DEV-0001  tablet 1 calls after the revoke
[w48]   115  +673.00 s   ACCESS_DENIED                 -        DEV-0001  tablet 1 calls after the revoke
[w48]   116  +673.00 s   ACCESS_DENIED                 -        DEV-0001  tablet 1 calls after the revoke
[w48]   117  +673.00 s   ACCESS_DENIED                 -        DEV-0001  tablet 1 calls after the revoke
[w48]   118  +675.00 s   RECORDING_STOPPED             OPR-002  -         the supervisor stops the recording from the web console
[w48]   119  +682.26 s   EVIDENCE_SEALED               -        -         the Core finalises and seals the recording
[w48]   120  +695.00 s   PAIRING_CODE_ISSUED           OPR-002  -         issue code D
[w48]   121  +695.00 s   PAIRING_SUCCESS               -        DEV-0002  redeem code D
[w48]   122  +695.00 s   ACCESS_DENIED                 -        DEV-0001  the new credential, the old credential, the old biometric token and the used code
[w48]   123  +695.00 s   AUTH_FAILED                   OPR-001  DEV-0002  the new credential, the old credential, the old biometric token and the used code
[w48]   124  +695.00 s   PAIRING_FAILED                -        -         the new credential, the old credential, the old biometric token and the used code
[w48]   125  +695.00 s   TABLET_LINK_CHANGED           -        TABLET    the re-paired tablet opens its socket
[w48]   126  +695.00 s   AUTH_SUCCESS                  OPR-001  DEV-0002  a password session, an enrolment and a biometric sign-in on the tablet
[w48]   127  +695.00 s   BIOMETRIC_ENROLLMENT_CHANGED  OPR-001  DEV-0002  a password session, an enrolment and a biometric sign-in on the tablet
[w48]   128  +695.00 s   AUTH_SUCCESS                  OPR-001  DEV-0002  a password session, an enrolment and a biometric sign-in on the tablet
[w48]   129  +695.00 s   AUTH_FAILED                   OPR-001  DEV-0002  the used biometric token is presented again
[w48]   130  +695.00 s   AUTH_FAILED                   OPR-001  DEV-0002  the rotated token of the revoked family
```

Row 96 is at +665.999 s (one millisecond before the lock ends; the column rounds). The audit type
of each step of the row's list:

| Step of the row | Audit type (actor) | Rows |
|---|---|---|
| Issue | `PAIRING_CODE_ISSUED` (the supervisor) | 89, 92, 100, 120 |
| Expiry | `PAIRING_CODE_CLOSED` `EXPIRED` (nobody), then `PAIRING_FAILED` | 90, 91 |
| Lock, exhaustion | `PAIRING_FAILED`, `PAIRING_LOCKED`, `PAIRING_CODE_CLOSED` `EXHAUSTED` (nobody) | 93 to 99 |
| Redemption | `PAIRING_SUCCESS` (nobody; the new device) | 101, 121 |
| A code that cannot be redeemed again | `PAIRING_FAILED` (nobody) | 102, 103, 124 |
| Listing | none (a read); the connection of the device: `TABLET_LINK_CHANGED` | 104, 125 |
| Sign-in on the device | `AUTH_SUCCESS` (the operator, the device) | 105, 126, 128 |
| Revocation | `DEVICE_REVOKED` (the supervisor, the device), `TABLET_LINK_CHANGED` | 110, 111 |
| Refused access after revocation | `ACCESS_DENIED` (nobody; the device) | 112 to 117, 122 |
| The stop by another operator | `RECORDING_STOPPED` (the supervisor) | 118 |
| Re-pairing | `PAIRING_CODE_ISSUED`, `PAIRING_SUCCESS` (a new device ID) | 120, 121 |
| A biometric token of a revoked device, a reused token, a revoked family | `AUTH_FAILED` (the token's operator; the presenting device) | 123, 129, 130 |

## 6. The socket timings

Measured on the test's real clock from the instant the request was sent to the close event of
the client socket (section 3.4). Loopback, one process, a host with a 1-minute load of 4 to 6.

| Run | Revoke to close 4403 | Reused token to close 4401 |
|---|--:|--:|
| 18:17:17 | 3.9 ms | 2.9 ms |
| 18:24:58 | 6.0 ms | 3.5 ms |
| 18:31:38 | 8.8 ms | 6.0 ms |
| 18:31:43 | 4.2 ms | 3.4 ms |
| 18:31:46 | 4.4 ms | 3.3 ms |
| 18:34:11 | 8.4 ms | 5.7 ms |
| **18:38:01 (final)** | **5.1 ms** | **3.4 ms** |
| Bound asserted | < 1,000 ms | < 1,000 ms |

What each socket was sent last, and what it was not sent:

| Socket | Last message | Close | Not sent |
|---|---|---|---|
| The tablet's socket (the investigator's session bound to DEV-0001) at the revoke | `{ type: 'device.revoked', v: 1, reason: 'REVOKED' }` | 4403 | `session.ended` (the socket is the device's) |
| The retired session token, the retired device credential, on a new socket | `hello` with `principal: ANONYMOUS`, `reason: DEVICE_REVOKED` | 4403 | anything else |
| The BIOMETRIC session's socket at the reuse | `{ type: 'session.ended', v: 1, reason: 'TOKEN_REUSE' }` | 4401 | — |
| The ended BIOMETRIC session's token on a new socket | `hello` ANONYMOUS | 4401 | anything else |
| The PASSWORD session's socket at the reuse | a heartbeat (it answers the next one) | open | `session.ended` |
| The device that never paired, over the whole journey | 40 frames: `hello`, `heartbeat` | open until the test closes it | every state, control and admin message |
| The portal | 155 frames: `hello`, `snapshot`, `heartbeat`, `delta`, `admin.changed` (resources `DEVICES` and `PAIRING_CODE`) | open until the test closes it | — |

11 sockets were opened; at the end 11 are closed, the hub knows none, every frame of every socket
was a message of the contract's union, the listener is closed and a connection to its port is
refused (`ECONNREFUSED`):

```
[w48] sockets: 11 opened by the test; the unpaired device received 40 frames of types [hello, heartbeat]; the portal 155 frames of types [hello, snapshot, heartbeat, delta, admin.changed]
[w48] end: 11 sockets opened, 11 closed, 0 open; the listener on 127.0.0.1:55350 is closed (a connection is refused: ECONNREFUSED)
```

## 7. AC-B-82: the reuse of a biometric token and the socket

On the re-paired tablet (DEV-0002), in order:

| Step | Request | Answer | Asserted |
|---|---|---|---|
| A password session | `signIn` with the device credential | 200, a session token | `AUTH_SUCCESS`, `method: PASSWORD` |
| The enrolment | `setBiometricEnrollment { enabled: true }` with that session token | 200, a token of the form `bio_…` | `BIOMETRIC_ENROLLMENT_CHANGED` |
| The biometric sign-in | `signInWithBiometric { token }` with the DEVICE CREDENTIAL (spec §5.6 step 4) | 200: a session with `method: BIOMETRIC` bound to DEV-0002, its token, and the next biometric token (another value) | `AUTH_SUCCESS`, `method: BIOMETRIC`; two open session rows of OPR-001 on DEV-0002 |
| Two real sockets | the PASSWORD session's token; the BIOMETRIC session's token | both `hello` OPERATOR | |
| **The reuse** | the USED token again, with the device credential | **401 `INVALID_CREDENTIALS`** | `AUTH_FAILED` (OPR-001, DEV-0002; `method: BIOMETRIC`, `reason: TOKEN_REUSE`, `sessionsEnded: 1`) |
| The BIOMETRIC session | | its socket: `session.ended` `TOKEN_REUSE`, close **4401, 3.4 ms** after the request; its row: ended at that instant, `end_reason` `TOKEN_REUSE`; its token: 401 `NOT_SIGNED_IN`, and on a new socket `hello` ANONYMOUS and 4401 | |
| The family | the rotated token | 401; `AUTH_FAILED` with `reason: TOKEN_REVOKED`; no session row added; 0 biometric tokens of DEV-0002 that are not revoked | |
| **The PASSWORD session** | its token on `getAuthSession` | **200, `method: PASSWORD`**; its row not ended; its socket open, a heartbeat arrives, no `session.ended`; the tablet's DEVICE socket open too | |

## 8. No secret left behind (AC-B-41, AC-B-28)

### 8.1 What is searched, and in which forms

What the journey issued or used, held by the test under a label: **4 pairing codes** (A expired,
B exhausted, C and D redeemed), **5 wrong guesses**, **2 device credentials**, **5 session
tokens** (two web sessions, whose token is the cookie value; three device sessions), **3
biometric tokens** (one of the revoked tablet; the enrolment and the rotation on the re-paired
one), and the demo password.

| Secret | Forms |
|---|---|
| A code or a guess (4) | The six digits as text (not inside a longer run of digits or hexadecimal digits, not decimals, not the number of an identifier); the QR payload `DEMS-PAIR:1:<code>`; hex and base64 of the digits. For the dump, more than the same table held at the boot |
| A credential or a token (8) | Raw; hex, base64 and base64url of its text; its first half; its last half; the value without its prefix; its 32 random bytes as hex (what a `bytea` column would show) |
| The demo password (4) | Raw; hex, base64, base64url. Its halves are not searched: they are words of the demo's own vocabulary |

Two limits of the search, stated in the file: the halves of a six-digit code (three digits)
cannot be told from data, so they are not searched; and six digits that stand as a bare JSON
NUMBER (`"bytes": 482133,`) are counted apart and not judged, because a measurement of the Core
cannot be told from a code and the contract's code is a text with its leading zeros (the count
was 0 in every run).

### 8.2 The counts (run of 18:38:01)

```
[w48] returned once: 82 answers of the journey; holding a secret: 8 of 10 tokens in exactly one answer, 2 in none (the web sessions: cookie only); 4 of 4 codes in exactly one
[w48] dump of dems_test_step_70_tmdsbdlq_f01_pairing_lifecycle: 30 tables, 421 rows, 185403 characters (at boot: 303 rows); searched: 4 pairing codes and 5 guesses, 2 device credentials, 5 session tokens, 3 biometric tokens, the demo password; a code in 4 forms, a credential or token in 8 forms: 0 found; stored hashes present once: codes 4 of 4, credentials and tokens 10 of 10; six digits of a code as a bare number (not judged): 0
[w48] positive control (rolled back): 3 values planted as the owner role; the scan reports 3 finding(s): tablet 1 paired again: the rotated biometric token as hex in table operators; code C (redeemed by tablet 1) as digits as text in table paired_devices; tablet 1: device credential as last half in table paired_devices
[w48] AC-B-41: 47 audit rows and 45 events of the journey, 254 realtime frames (2359072 characters) on 11 sockets: 0 codes, credentials or tokens found
[w48] AC-B-41: 29 answers of a refusal: 0 codes, credentials or tokens found
[w48] AC-B-41 log capture: 191809 characters, 973 lines, 82 request lines, levels {"20":840,"30":124,"40":9}; searched: 4 pairing codes and 5 guesses, 2 device credentials, 5 session tokens, 3 biometric tokens, the demo password: 0 found; hashes of them: 0
```

| Place | Size | Found | Not vacuous because |
|---|---|--:|---|
| A dump of the clone: every table the catalog lists in schema `public`, each row as `to_jsonb(row)` text (a `bytea` as hex), read as `dems_owner` | 30 tables, 421 rows, 185,403 characters | **0** | The SHA-256 of each of the 4 codes (`<code ID>:<code>`) and of each of the 10 credentials and tokens is in the dump exactly once; the hash a guess would have under any of the 4 code IDs is absent. The scan is run per table, with the same table at the boot as its baseline |
| The audit rows and the events of the journey | 47 rows, 45 events | **0** | Also searched after EVERY step, before the step's own assertions see the rows |
| Every realtime frame every socket received (raw text) | 254 frames, 2,359,072 characters, 11 sockets | **0** | The portal's socket received every state change with its audit rows (155 frames) |
| The answers of every refusal | 29 bodies | **0** | Also searched as each refusal is received |
| The server's log, level `trace`, from the boot to the close of the server | 973 lines, 191,809 characters; 840 at debug, 124 at info, 9 at warn, none at error | **0**, and 0 hashes of a code or a token | The log holds one `request completed` line per answer the test received (82 = 82); the redeem lines are exactly `{201: 2, 401: 8, 423: 2}`; `engine started`, `socket opened`, `socket closed`, `engine stopped` are in it |
| Each secret in the answers of the journey | 82 answers | each device credential, device session token, biometric token and code is in **exactly one** answer (the one that issued it); a web session token and a guess in **none** | "Returned once" over the whole journey, the registry and the registration reads included |

### 8.3 The scan is not blind

In the file (a transaction that is rolled back): as the owner role, code C is written into
`paired_devices.name`, the last half of a device credential into `paired_devices.revoke_reason`,
and the hex of a biometric token into `operators.name`. The scan of a dump taken in that
transaction reports exactly those three, each with its label, its form and its table; after the
rollback it reports none. A line of text with a session token behind `Bearer` is reported in
four forms. From outside (section 10): a code planted and committed before the dump (M3), a line
with a token written into the captured log stream (M7), and an answer that echoes a code (M9)
each turn the scan red, named by label and never by value.

## 9. Verification

### 9.1 The row command (18:37:56; `assets/04_row_command.log`)

```
## 2026-10-04 18:37:56 WIB $ DEMS_TEST_STEP=70 npm run test:db -w @dems/core-server -- test/acceptance/pairing-lifecycle.test.ts
> @dems/core-server@0.2.0 test:db
> vitest run --project db test/acceptance/pairing-lifecycle.test.ts
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_70_tmdsb957_
[test:db] stale sweep: dropped 0; kept 5 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_70_tmdsb957_tpl_schema: built in 137 ms (create 48 ms, hook 86 ms)
[test:db] template dems_test_step_70_tmdsb957_tpl_seed: built in 223 ms (create 76 ms, hook 145 ms)
 Test Files  1 passed (1)
      Tests  31 passed (31)
   Start at  18:37:57
   Duration  3.72s (tests 45%, transform 35%, import 20%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 2 database(s) in 94 ms; 0 remain with the run prefix dems_test_step_70_tmdsb957_
## exit 0 at 18:38:01
```

The same with the verbose reporter at 18:38:01 (exit 0 at 18:38:05; every printed line of the
tests): `assets/04_row_command_verbose.log`.

### 9.2 The 31 tests

| # | Block | Test (shortened) |
|--:|---|---|
| 1 | SC5 lifecycle | AC-B-32: the unpaired caller: status, health, 403 on the sign-in with no Origin and with the own origin, 401 elsewhere, a socket with hello and heartbeat only |
| 2 | | The control: no paired device connected, the Core link OFFLINE, the pre-check blocks on that check alone |
| 3 | | AC-B-33: the issue; `PAIRING_CODE_ISSUED`; the table holds a hash and not the code |
| 4 | | AC-B-35: active one millisecond before 300 s; at 300 s the generic 401 and `PAIRING_CODE_CLOSED` `EXPIRED` |
| 5 | | AC-B-36: three wrong codes lock for 60 s; the right code during the lock is not looked at; the fifth closes the code as `EXHAUSTED` |
| 6 | | AC-B-34: the redeem: 201, a device ID and a credential; `PAIRING_SUCCESS`; the used and the exhausted code never pair again |
| 7 | | The registry: PAIRED; online while the real socket is open, offline after it closes; the first device socket connects the Core link |
| 8 | | AC-B-37: the sign-in on the device: a session bound to it; `AUTH_SUCCESS` and the registry name the device and the operator; the enrolment |
| 9 | | The recording from the tablet: the pre-check passes because the link comes from the tablet's socket |
| 10 | | AC-B-38: the revoke while it records: 200, REVOKED; `DEVICE_REVOKED` |
| 11 | | AC-B-38: the socket: `device.revoked`, 4403 within 1 s; the retired values open no socket |
| 12 | | AC-B-38: six REST calls answer 403 `DEVICE_REVOKED`, each with one `ACCESS_DENIED` row |
| 13 | | AC-B-38: the session ended with `DEVICE_REVOKED`, the biometric token revoked; the registry |
| 14 | | AC-B-39: the session STAYS IN RECORDING and goes on, the link OFFLINE |
| 15 | | AC-B-39: another operator stops it from the web: 202, `RECORDING_STOPPED` names the supervisor; sealed |
| 16 | | AC-B-38: paired AGAIN: a new code, device ID and credential; the old credential and biometric token refused |
| 17 | AC-B-82 | A PASSWORD and a BIOMETRIC session on the tablet, each with its real socket |
| 18 | | The USED token again: the generic 401; `AUTH_FAILED` `TOKEN_REUSE`, one session ended |
| 19 | | The BIOMETRIC session's socket: `session.ended` `TOKEN_REUSE`, 4401 within 1 s |
| 20 | | That session ended with `TOKEN_REUSE`, its token 401; the family revoked |
| 21 | | The PASSWORD session and its socket stay open |
| 22 | The audit trail | Exactly this sequence of 47 rows; every row belongs to a step; the chain verifies |
| 23 | The end of the run | The unpaired device's socket: hello and heartbeat only; the portal was told of every change |
| 24 | | Every socket closed, every frame a message of the contract, nothing listens on the port |
| 25 | No secret left behind | The inventory of what the test must look for |
| 26 | | Each secret was handed out in exactly one answer |
| 27 | | The dump |
| 28 | | The scan is not blind (the positive control) |
| 29 | | The audit rows, the events, the realtime frames |
| 30 | | The answers of every refusal |
| 31 | | The log |

Time limits of the file, as caps: 120 s per test, 180 s per hook (`vi.setConfig`); the 31 tests
take about 0.6 s together; the clone and the boot in the hook take the rest of the run's 3.7 s.

### 9.3 Typecheck and lint

`npm run typecheck -w @dems/core-server` and `npm run lint -w @dems/core-server`, whole workspace:

| Time | Typecheck | Lint | Note |
|---|---|---|---|
| 18:15:55, 18:16:03 | exit 2: 2 errors, both in `test/acceptance/contract.test.ts` | 3 warnings: one in this file's first draft (fixed at once), one in `test/acceptance/rbac-matrix.support.ts`, one in `test/acceptance/contract.test.ts` | Two other acceptance rows in flight (P11) |
| 18:24:36 to 18:24:46 | exit 2: 2 errors, both in `test/acceptance/rbac-matrix.test.ts` | exit 0, no warning | The same (P11) |
| 18:26:46, 18:31:01 | exit 0 | exit 0, no warning | |
| **18:37:35 (the file as it is now)** | **exit 0, 0 errors** | **exit 0, no warning** | |
| 18:45:06, 18:45:13 | exit 2: 2 errors, both in `test/acceptance/shared-state.support.ts` (lines 409 and 887); **0 in this file** | exit 0, no warning | The last run of the row (`assets/04_gate_final.log`). That file was written at 18:40 by the two-client acceptance row, in flight (P11) |

No error and no warning was in this row's file after 18:16. The workspace as a whole was clean at
18:26, 18:31 and 18:37; the red of 18:45 is in a file that did not exist when this row's file was
last written.

### 9.4 The whole `db` project

`DEMS_TEST_STEP=70 npm run test:db -w @dems/core-server -- --maxWorkers=2`, twice (after the
file was complete, and at the end; rule M15):

| Run | Result | This row's file in it |
|---|---|---|
| 18:34:23 to 18:37:26 (`assets/04_whole_db_1834.log`) | **exit 0: 112 files passed, 1,646 tests passed, 1 skipped**; 182.47 s; 0 forced drops; 0 databases remain | The version before the hardening of 18:37:35 (section 16, DV-10) |
| **18:39:08 to 18:42:26** (`assets/04_whole_db_final.log`) | **exit 0: 112 files passed, 1,646 tests passed, 1 skipped**; 197.24 s; 0 forced drops; 0 databases remain | The file as it is now |

No test failed in either run, so there is no failure to attribute. The one skipped test is not
this row's: `src/modules/demo/__tests__/reset-failures.db.test.ts:421` (`it.skip`, the pending
test of finding F73). The 1-minute load was 4.9 at the start of the first run and 10.7 at the end
of the second (other rows' runs beside it); the two 1 s bounds of this file held in both.

## 10. Can the test fail?

Each change below is a change of the TEST'S INPUT (a step left out, another value presented) or
of the CLONE (a row changed as the owner role). None changes production code, and no file of the
tree was changed: the scratch runner configuration (`assets/04_mutation_harness.vitest.config.mjs.txt`)
is the workspace's own configuration plus one load-time transform of this one test file, which
replaces one text that must occur exactly once (`assets/04_mutations.json`). Run against the file as it is now: started 18:38:05, the last change at 18:38:50
(`assets/04_mutations.log`).

| ID | Change | Result | The tests that turn red (the first is the one that speaks) |
|---|---|---|---|
| BASELINE | none, through the scratch configuration | exit 0, 31 passed | — |
| **M1** | **The revoke is skipped** (the supervisor reads the registry instead) | **red, 13 failed** | "the supervisor revokes the tablet …" (the answer is no `PairedDevice`); **"its socket was told device.revoked and closed with 4403 …": `tablet 1, with the investigator's session: the socket was not closed within 5000 ms; it received [hello, snapshot, heartbeat, delta]`**; **"its next REST calls answer 403 …": `expected [ [ 200, null ], [ 204, null ], …(4) ] to deeply equal [ [ 403, 'DEVICE_REVOKED' ], …(5) ]`** (the read 200, the marker 204, the stop 202: the tablet could still stop its own recording); "its session is ended …"; then the tests that depend on the revoke (`assets/04_mutation_M1.log`) |
| **M2** | **A FRESH biometric token** (the rotated one) is presented instead of the used one | **red, 6 failed** | **"the USED token presented again answers the generic 401 …": `expected [ 200, null ] to deeply equal [ 401, 'INVALID_CREDENTIALS' ]`**; **"the socket of the BIOMETRIC session … closed with 4401 …": `the BIOMETRIC session on the tablet: the socket was not closed within 5000 ms; it received [hello, snapshot, heartbeat, delta]`**; "that session is ended with the reason TOKEN_REUSE …" (`endReason: null`); the audit sequence; the two counts of the scan block. "The PASSWORD session … stays open" stays green, as it must (`assets/04_mutation_M2.log`) |
| **M3** | **The value of an issued code is planted into a column of the clone as the owner role** (`paired_devices.name`), committed, before the dump | **red, 2 failed** | **"a dump of the clone …": `+ "code D (redeemed by tablet 1 after the revoke) as digits as text in table paired_devices"`**; and the positive control, whose scan reports the planted value as a fourth finding beside its own three (`assets/04_mutation_M3.log`) |
| M4 | The tablet's socket is closed and 6 s pass before the recording is created: no paired device holds a socket | red, 13 failed | "the investigator starts a recording from the tablet …": the check `CORE` blocks; everything after it |
| M5 | Code A is redeemed one millisecond BEFORE its 300 s have passed | red, 18 failed | "AC-B-35 …": 201 instead of 401; the journey after it |
| M6 | The recording is stopped from the web console by the operator who started it, not by another one | red, 3 failed | "ANOTHER operator stops it …": the row names OPR-001; the audit sequence; a count |
| M7 | A line that holds a session token is written into the captured log stream before the scan | red, 1 failed | "the log of the server …": the token in four forms, by its label |
| M8 | The device that never paired opens its socket as the supervisor's web console | red, 5 failed | "AC-B-32 …" (`hello` OPERATOR, a snapshot); "the socket of the device that never paired received hello and heartbeat only …" |
| M9 | An answer of a refusal that echoes the expired code is handed to the test (a stand-in answer; the server sent none such) | red, 4 failed | "AC-B-35 …": `+ "code A (left to expire) as digits as text in the body of a refusal"` (`assets/04_mutation_M9.log`) |

9 of 9 detected. A failure message names a secret by its label and its form, never by its value
(M3, M7, M9). The two socket waits that never end (M1, M2) end at the cap of 5 s.

## 11. Findings

Severity is the row's proposal.

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| **W48-F1** | **Low** (availability of pairing; as specified by RB-6 and ID-P13, [SDR:SD-03]) | **Refused calls of a revoked device use up the budget that the redeem of a NEW device needs.** A retired credential is no principal, so its `ACCESS_DENIED` rows count in the class bucket `class:local`, the one bucket of every caller without a principal. After 20 such refusals within 60 s, every REST request of that class except health answers 429: also `redeemPairingCode` with the RIGHT code from a device that never called before, and `getSignInStatus` of an unpaired caller. The code is not consumed and pairs when the window has passed. Operators and paired devices are not affected. A revoked tablet that keeps calling (or any local process without a credential) can therefore delay a re-pairing for as long as it sends 20 refused calls a minute | Section 11.1 |
| W48-F2 | Info (audit trail) | The device column of `TABLET_LINK_CHANGED` is the Core's tablet slot `TABLET` (the shared simulator's hardware ID), not the registry ID of the device whose socket changed the link. The trail does not say WHICH paired device connected or went away; with two paired tablets the row cannot be attributed. The registry's `online` and the `DEVICE_REVOKED` row beside it name the device | Rows 104, 111, 125 of section 5; `packages/shared/src/sim/actions.ts:222` and `:229` (`deviceId: 'TABLET'` in the row and in the event); the hosted action is the simulator's, written "as the simulator writes it" (spec §13.2) |
| W48-F3 | Info (audit trail) | The rows of session commands sent from a tablet carry no device ID: `SESSION_CREATED`, `PRECHECK_PASSED`, `RECORDING_STARTED` of the recording started from DEV-0001 name OPR-001 and no device. "From which tablet was this recording started" is answered only by the `AUTH_SUCCESS` row of that operator on that device before it. Conversely an `ACCESS_DENIED` row of a revoked device names the device and no operator, also when the refused value was an operator's session token (as RB-6 says) | Rows 107 to 109, 112 to 114 of section 5; hosted actions are the simulator's (spec §8.2 ENG-2, §13.2) |
| W48-F4 | Info (product; the lifecycle side of finding F69) | After a revoke with no other paired device connected the Core link is OFFLINE at once. The running recording is not touched (it goes on, is stopped and sealed), but NO NEW recording can be started, from the web console either, until a paired device is connected again: the pre-check blocks on the check `CORE` alone (the control of step 2). In a demo "revoke the tablet, then record from the web" does not work before the re-pairing | Section 4, steps 2, 12, 14, 15; mutation M4 |
| W48-F5 | Info (test support, for W49) | The realtime row's `TestSocket` builds `opened`, `refused` and `closed` with a guard of 5 s that starts when the socket is CREATED: `socket.closed` rejects for a socket that lives longer than 5 s, whatever happens later. This file holds sockets for the whole journey, so it attaches its own `close` listener and its own bounded wait. The two-client test W49 will hold long-lived sockets too | `src/realtime/__tests__/support.ts:235-241, 301-303` |

Observations that are as specified and no finding: the failure that locks redeeming answers 423
and writes `PAIRING_FAILED` (D93 DN-1); a redeem that carries a RETIRED credential as its bearer
value pairs (201; spec §6.6), while `getSignInStatus` with a retired credential answers 403
(D78 DN-9) and without any credential 200 (probe X1); the server lets the operator who started a
recording stop it from another client too (M6: 202, the row names OPR-001), so "another operator"
of AC-B-39 is a capability, not a restriction.

### 11.1 Minimal reproduction of W48-F1

`assets/04_repro_F1_revoked_device_blocks_pairing.ts.txt` (48 lines): the pairing row's test app
on a clone of the seed, no listener, the server on a manual clock. It is not a file of the tree:
the scratch configuration loads it in place of this row's test file. Run of 18:32:33
(`assets/04_repro_F1.log`), exit 0 (the reproduction asserts what it shows):

```
$ W48_REPLACE=<scratch>/repro_F1_revoked_device_blocks_pairing.ts DEMS_TEST_STEP=70 npm exec -w @dems/core-server -- \
    vitest run --config <scratch>/harness.vitest.config.mjs --project db test/acceptance/pairing-lifecycle.test.ts --reporter=verbose
[w48-f1] 21 calls with the retired credential: 403 403 403 403 403 403 403 403 403 403 403 403 403 403 403 403 403 403 403 403 429; rows: 20 x ACCESS_DENIED
[w48-f1] a NEW device redeems the RIGHT code: [429,"RATE_LIMITED"], retry-after 60 s; the code: ACTIVE, failed attempts 0
[w48-f1] the portal at the same instant: 200
[w48-f1] 60 s later the same redeem: 201
```

Steps: pair a device; revoke it; `GET /api/v1/pairing/device` 21 times with its retired
credential within one minute of the server clock; issue a code; redeem it from a caller without
a credential.

| Expected by a reader of SC5 ("revoked, refused and paired again") | Observed | By the specification |
|---|---|---|
| The new device pairs: 201 | 429 `RATE_LIMITED`, `retry-after: 60`; 201 sixty seconds later | As written: RB-6 puts the rows of a retired credential into `class:local`; ID-P13 answers 429 to "every REST request of that key except `getServiceHealth`" while the key holds 20 |

In the journey of this test the bucket held 12 of 20 at its fullest (4 `PAIRING_FAILED`, 7
`ACCESS_DENIED` and one more `PAIRING_FAILED` between +666 s and +695 s), so the re-pairing was
not delayed; the probe that added 25 more refused calls at that point shows the 429 on the redeem
inside the real journey (`assets/04_probe_X1.log`, 18:44:43: one more 403 for `getSignInStatus` with the retired
credential, then 7 more 403 and 429 from the eighth call on; a new device's redeem of the right code
429 with `retry-after: 31`, the code untouched with 5 attempts left; health 200; the portal and the
paired device 200; 59 s later the new device pairs).

What follows from it (decision DN-1 of section 17): the mobile app must stop calling with a
credential that was answered 403 `DEVICE_REVOKED` (it does, by the client specification: it
deletes the credential and shows the pairing screen); the mobile pairing screen must treat 429 on
a redeem as "wait `retry-after`", not as a wrong code; the end-to-end row W94 must not send
bursts of refused calls before it pairs again.

## 12. What this test does NOT cover

| Not covered | Where it is, or why not |
|---|---|
| A real phone or an emulator, the app's own code (secure storage, the Live source's reconnect, the pairing screen) | The end-to-end row W94 (AC-B-40) and the client rows W57, W60. The "mobile app" here is a client of the test that sends what the app was measured to send |
| The QR path | DR-02: scanning is deferred. The `qrPayload` of the issue answer is validated against the contract; the test asserts that `DEMS-PAIR` stands in no table, row, event, frame, refusal or log line |
| A listening server on a fixed port (4420 or a lane), the entry point `src/index.ts`, HTTP over TCP for REST, the Vite proxy, a browser's cookie jar | The listener of this test is ephemeral and carries only `/ws`; REST is `app.inject`. HTTP over the listener for both clients: the realtime row's first-contact test; the main instance: W58, W94 |
| `cancelPairingCode`, `unpairDevice`, `rotateDeviceCredential` (operations 17, 22, 23); a revoke of a device that is not PAIRED (409), a short reason (422) | The pairing row's own tests (`lifecycle.db.test.ts`, `devices.db.test.ts`). An unpair DURING a recording was not run by any row |
| Concurrency: 20 wrong redeems at once, two redeems of the right code, two uses of one biometric token (AC-B-76, AC-B-77, AC-B-78) | The pairing and the biometric rows' `concurrency.db.test.ts` |
| The expiry sweep on its 5 s timer; the 5 s debounce of the Core link; idle and absolute expiry of a session | The sweepers are stopped in this app (the expired code is closed by the redeem that meets it). The debounce: the realtime row. Expiry: the identity row, and the restart row for sessions across restarts |
| Several paired devices at once; a revoke of one of two connected tablets | The realtime row's hub tests |
| The 429 paths (throttle, denial budget) inside the journey | Only in the reproduction and the probe of finding W48-F1; the journey stays inside every budget (12 of 20) |
| A restart between the steps | The restart row W53 (a paired device, an active code and a revoked device across four restarts) |
| The role-by-operation matrix for the pairing operations; the conformance of every answer of every operation | W47 and W52; this test validates each answer it receives against the contract (`validateCoreApiResponse`) |
| A six-digit code written as a bare JSON number, and the halves of a code | Section 8.1: cannot be told from data |
| Real time beyond loopback in one process: the 1 s bound over a network, under a slow consumer | Loopback only is the task's scope (P20) |

## 13. Requirement to test

| Requirement | What it asks | Test (number of section 9.2) | Result |
|---|---|---|---|
| **SC5** | Pairing gate, listing, revocation, audit of each step | 1 to 16 (the lifecycle), 22 (the sequence as one), 17 to 21 | Pass |
| **AC-B-28** | A full dump holds no password, session token, device credential, biometric token or pairing code the test issued or used | 27 (and 28: the scan is not blind; M3) | Pass: 0 found; the 14 hashes present once each |
| **AC-B-32** | Without a credential: `signIn` 403 `DEVICE_NOT_PAIRED` with no `Origin` and with an own origin alike; only health, the redeem and `getSignInStatus` succeed; its socket receives `hello` and `heartbeat` only | 1 (status, health, the two sign-ins, five 401); 6 and 16 (the redeem by a caller without a credential: 201); 23 (the socket over the whole journey); M8 | Pass |
| **AC-B-33** | `issuePairingCode` returns six digits and `expiresAt = issuedAt + 300 s`, writes `PAIRING_CODE_ISSUED` without the code; the table holds only a hash | 3 | Pass |
| **AC-B-34** | The redeem returns a device ID and a credential; the device is listed PAIRED; `PAIRING_SUCCESS`; a second redeem of the same code answers 401 `INVALID_CODE` | 6, 7; 26 (the credential in exactly one answer) | Pass |
| **AC-B-35** | After 300 s (manual clock) the code answers 401 `INVALID_CODE`; `PAIRING_CODE_CLOSED` with `reason: EXPIRED` | 4 (active at 299,999 ms, refused at 300,000 ms); M5 | Pass |
| **AC-B-36** | Three wrong codes lock redeeming for 60 s (423, `PAIRING_LOCKED`); the fifth wrong code closes the code (`EXHAUSTED`) | 5 | Pass (the third failure answers 423 with `PAIRING_FAILED`, the attempt during the lock `PAIRING_LOCKED`: D93 DN-1) |
| **AC-B-37** | A sign-in on a paired device creates a session bound to it; the `AUTH_SUCCESS` row and `listPairedDevices` name the device and the operator | 8 | Pass |
| **AC-B-38** | `revokeDevice`: the device's sessions end, its socket closes with 4403 within 1 s, its next REST call answers 403 `DEVICE_REVOKED`, `DEVICE_REVOKED` is written; a new redeem creates a new device ID | 10 (the row), 11 (4403, 5.1 ms), 12 (403 × 6), 13 (the session, the biometric token, the registry), 16 (a new device ID); M1 | Pass |
| **AC-B-39** | Revoking a device during its recording leaves the session in RECORDING; another operator with `SESSION_START` stops it | 9 (the recording, the link from the socket), 14 (RECORDING, going on), 15 (the supervisor's stop, `RECORDING_STOPPED` OPR-002, SEALED); M4, M6 | Pass |
| **AC-B-41** | No audit row, event, realtime message or log line of the whole lifecycle contains a code or a credential | 29 (rows, events, frames), 30 (refusals), 31 (the log), and after every step and every refusal; M7, M9 | Pass: 0 found |
| **AC-B-82** | After a biometric sign-in, the used token presented again ends that BIOMETRIC session: `session.ended` `TOKEN_REUSE`, the socket closed with 4401 within 1 s, the session token 401, the row's end reason `TOKEN_REUSE`; a password session of the same operator on the same device stays open | 17 to 21; M2 | Pass (3.4 ms) |
| SR-34 (beside the row's list) | A revoke ends the device's biometric tokens in the same transaction | 13; 16 (the old token presented by the re-paired device: 401) | Pass |
| Spec §6.6, §6.8 (beside the row's list) | What a revoked device may call; the Core link from a real device socket | 12 (health 200), 2, 7, 9, 10 | Pass |

## 14. Assets (`docs/2026-10-04_dems_backend_rbac_pairing/test/assets/`)

| File | What |
|---|---|
| `04_row_command.log` | The row command, 18:37:56, exit 0 |
| `04_row_command_verbose.log` | The same with the verbose reporter, 18:38:01: the 31 test names and every printed line (the audit sequence, the timings, the counts, the routes of the log) |
| `04_whole_db_1834.log`, `04_whole_db_final.log` | The two runs of the whole `db` project |
| `04_gate_final.log` | The last typecheck and lint of the row |
| `04_mutations.json`, `04_mutations.log` | The nine changes and the summary of their runs (18:38:05) |
| `04_mutation_M1.log`, `04_mutation_M2.log`, `04_mutation_M3.log`, `04_mutation_M9.log` | The full output of the three changes the row names, and of M9 |
| `04_mutation_harness.vitest.config.mjs.txt`, `04_mutation_harness.run.sh.txt` | The scratch runner configuration (one load-time transform of this one test file) and the script that runs the changes one at a time |
| `04_repro_F1_revoked_device_blocks_pairing.ts.txt`, `04_repro_F1.log` | The minimal reproduction of W48-F1 and its output |
| `04_probes.json`, `04_probe_X1.log` | The probe inserted into the journey after the re-pairing, and its output |
| `04_end_state.mts.txt`, `04_end_state.log` | The scratch script that lists what is left in the instance (names and counts, as `dems_owner`), and its output |

## 15. Test ledger (P24)

| Project | Before this row | This row adds | Whole project |
|---|---|---|---|
| `db` | 108 files, 1,540 passed and 1 skipped (the baseline of the brief, 17:48) | **+1 file, +31 tests**: `test/acceptance/pairing-lifecycle.test.ts` | 18:34: 112 files, 1,646 passed, 1 skipped (the three other files and 75 other tests are the two acceptance rows and the helper follow-up that landed beside this row) |
| `unit` | 141 files, 3,609 tests | nothing (the file is not in that project) | not run by this row |

## 16. Deviations from the row text and the brief

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | REST calls are `app.inject`; only the socket goes over TCP | The pattern of every landed test of the server, the acceptance test of W53 included; the upgrade is the part that only a real listener can show. Section 12 |
| DV-2 | The socket client is `ws` through the realtime row's `openSocket`, not Node's global `WebSocket` | It is what `src/realtime/__tests__/support.ts` uses for a test socket: exactly the given headers, the close code, every frame checked against the contract's union |
| DV-3 | The biometric scenario runs on the re-paired tablet, on the same server as the lifecycle, not in an app of its own | One dump and one log capture then cover every secret of both parts; and the re-paired device is used, not only created |
| DV-4 | Beyond the row's list: AC-B-36 inside the journey (it is in the row's criteria); the control of the Core link; the biometric token of a revoked device (SR-34); "handed out in exactly one answer" | They make the row's own statements checkable (the link "comes from the socket"; "returned once"; "refused access after revocation") |
| DV-5 | A session's rows carry no device and `TABLET_LINK_CHANGED` carries `TABLET`: the asserted sequence states them as they are specified, and names them as findings W48-F2, W48-F3 | Hosted actions write what the simulator writes (spec §13.2) |
| DV-6 | The halves of a six-digit code are not searched; a bare JSON number of the same digits is counted and not judged | Section 8.1 |
| DV-7 | The file imports the realtime row's test support from `src/realtime/__tests__/support` | It is not in `test/support/` yet (DN-3) |
| DV-8 | The mutation check and the reproduction run through a transform in a runner configuration outside the repository | Rule M15: no file of the tree is changed, not even for seconds |
| DV-9 | `masterplan/02_plan.md`, `implementation/99_implementation_report.md` and `test/01_test_report.md` were not written | Parallel run: shared files are the controller's (P8); this document and the progress file are the row's report |
| DV-10 | The file was changed once after the first whole-project run: a hardening of 7 added, 1 changed and 3 reordered lines (a refusal and the rows of every step are scanned before any other assertion sees them; a credential is never handed to an assertion; one more count of the log). Validated on a scratch copy before it was applied (18:37:05, 31 of 31), then by the row command, the nine changes and a second whole-project run | P19: a failing assertion must not be able to print a secret |
| DV-11 | One finding has a probe INSIDE the journey beside its standalone reproduction | The probe shows the 429 on the redeem at the very point of the re-pairing |

## 17. Decisions for the controller

| ID | Decision asked | This row's proposal |
|---|---|---|
| DN-1 | Finding W48-F1: a revoked or unpaired local caller can delay a pairing by 20 refused calls a minute | Accept as specified (RB-6, ID-P13; a hostile local process is outside the boundary), and pass three sentences on: to the mobile pairing rows (W57, W60) "a redeem answered 429 is not a wrong code: wait `retry-after`"; to the mobile runtime (W51) "after 403 `DEVICE_REVOKED` no further call with that credential"; to W94 "no burst of refused calls before the re-pairing". The alternative (a budget of its own for `redeemPairingCode`, or the redeem outside the class denial budget) is a change of the specification and of the throttle row; not proposed for the demo |
| DN-2 | Findings W48-F2, W48-F3: the trail does not name the paired device on a link change or on a session command | Accept: both rows are the simulator's hosted actions, and parity with its audit sequence is ruled (spec §13.2, [SDR:SD-28]). If a later task wants the attribution, it is an additive detail (`pairedDeviceId`) written by the server, not a change of the shared action |
| DN-3 | The realtime row's test support (`realtimeApp`, `openSocket`, the step timer) is used by this row and will be by W49 | Move it to `test/support/realtime.ts` in fix round B2 (the pattern of CPB1-12), with `closed` guarded from the moment it is awaited (W48-F5), or tell W49 to attach its own close listener as this file does |
| DN-4 | Finding W48-F4 into the README row W86 and the end-to-end rows | "After a revoke, a recording can be started again only when a paired device is connected" beside the sentence of F69 |
| DN-5 | Test ledger | `db`: +1 file, +31 tests |

## 18. End state and cleanup

End state at 18:45:23 (the scratch script `assets/04_end_state.mts.txt`, as `dems_owner`, names
and counts only; `assets/04_end_state.log`):

```
## 2026-10-04 18:45:23 WIB end state of blueprint row 70 (W48)
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_70_*): 0
test databases of all rows at this moment: 0
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
## .locks/postgres.pid: 19121
## process 19121: 19121 Sun Oct  4 07:14:26 2026     /Users/gsp-budi/Documents/DEMS/node_modules/@embedded-postgres/darwin-arm64/native/bin/postgres
## listeners on loopback held by node processes (lsof), with the ports of the plan named:
COMMAND PID NAME
postgres 19121 127.0.0.1:4432
## vitest runners of this row still alive (pgrep -f 'pairing-lifecycle|w48'): 0
```

| Item | State |
|---|---|
| Databases of this row | 0 with the prefix `dems_test_step_70_`. Every run of the row dropped its own: all 38 teardown lines in the runner outputs that were kept say "0 remain with the run prefix" (the row command, the verbose runs, the two whole-project runs, the changes of section 10, the reproduction, the probe), and the instance holds none at 18:45 |
| `dems_demo`, the lane databases | Never connected to by a test of this row. The end-state script reads `pg_database` and `pg_stat_activity` through the owner's maintenance connection, as the scripts of W33, W34 and W53 do |
| PostgreSQL | Never stopped or reconfigured: `.locks/postgres.pid` is 19121, the postmaster started 07:14:26, as before |
| Listeners | The test's listener is on `127.0.0.1` at port 0 and is closed by the test itself (asserted: a connection is refused); it existed for about a second per run, inside the Vitest worker. At 18:45 no `node` process listens on any port; port 4432 is PostgreSQL's. Ports 4420 to 4423, 4400, 5173 to 5178 were never bound or probed by this row |
| Processes | None left: every runner of the row has exited |
| The tree | One new file (`apps/core-server/test/acceptance/pairing-lifecycle.test.ts`); no other path of the repository changed by this row |
| Scratch | The harness, the logs and the candidate copy are in the session's scratch folder, outside the repository; nothing there holds a secret (searched) |

## 19. Rollback (R-NEW; not executed)

The row added one untracked file and documents. From `/Users/gsp-budi/Documents/DEMS`: remove
`apps/core-server/test/acceptance/pairing-lifecycle.test.ts`; remove
`docs/2026-10-04_dems_backend_rbac_pairing/test/04_pairing_lifecycle.md`, the 19 files
`test/assets/04_*` and `delegation_progress/test_expert_step_70.md`. No other path was touched;
the `db` project then holds one file and 31 tests fewer.

---
*Generated: 2026-10-04 18:43 WIB*
*Last Updated: 2026-10-04 18:47 WIB*
