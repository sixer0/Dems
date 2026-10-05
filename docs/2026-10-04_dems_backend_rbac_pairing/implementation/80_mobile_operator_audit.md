---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W80 (plan step 102; provisional row 96)
agent: coder-execution
date: 2026-10-06
status: complete
source_plan: masterplan/02_plan.md (row `| W80 |`, gate CLG)
---

# W80 — Mobile Operator Audit in LIVE mode (sites S1-7, S4-3)

Tier 2. Code is cited as `path:line` relative to the repository root. No credential value, token,
password or pairing code appears in this file or its assets (checked: the device and server logs hold
0 credential lines; the only match of the scan pattern is the scan's own label line).

## 1. Result at a glance

| Gate item | Result | Evidence |
|---|---|---|
| SG: typecheck, lint of `@dems/mobile` | exit 0, exit 0 (0 warnings) at 01:03 | §5.1, `assets/80_final_gate.log` |
| SG: whole suite at or above the floor (114 / 1,431) | **128 suites / 1,580 tests, exit 0** at 01:04–01:07 | §5.1 |
| CLG (a) the folder's existing tests pass, absent from `git diff --stat acaff20` | 12 tests pass; the 5 existing test files are byte-equal to `acaff20` | §5.2 |
| CLG (b) one Live test per site: success, refusal (denied toast), outage | S1-7 and S4-3: 10 Live tests + 5 screen tests on the fake transport | §5.3 |
| CLG (c) no `useSimActions`, no `.actions` read on a `Sim` | 0 and 0 (grep, and a static test) | §5.4 |
| CLG (d) one live check, at most 10 minutes | phone, lane 1, **00:56:33–00:58:29 (1 min 56 s)**, exit 0; 10 screencaps | §6 |
| StrictMode (D158) | a test under `<StrictMode>`: 0 requests at mount, 1 per press | §5.3 |
| Mutation check (in memory, M15) | **22 of 22 detected**, mutated files identical before and after | §5.5 |
| Lock status | identical before (00:54:09) and after (00:58:41) | §6.4 |

## 2. Inputs read

Plan row W80, the citation convention, section 11 (SG, CLG) of `masterplan/02_plan.md`; client spec
`[CS:§7.4]` (group `features/audit`), §8.1 LB-1 to LB-10, §8.5 S1-7, §8.7 S4-3, §8.2 A9 (web form of the
chain line), §6.2, §3.5, §2.5 (the `verifyAuditChain` binding), AC-C-48; `gateway_check/09_cp_mobile_runtime.md`
§4 answer 3 (the ten rules); `gateway_check/09b_m1_mobile_consolidation.md` §8; the controller note of
decision D166 (received during the row); decisions D154 (A9 precedent), D157–D164, F59;
`implementation/51_mobile_runtime.md` §4; `implementation/39_module_security_audit.md` §6, §12, §18;
security review CPS1-12 (a) (`gateway_check/05_cp_access_control_security.md:443-445`); finding F63-4.

## 3. What was built

### 3.1 Site S1-7 and S4-3: Verify (`apps/mobile/src/features/audit/chain-strip.tsx`)

| Where | What | Why |
|---|---|---|
| `chain-strip.tsx:38`, `:111` | `useCoreActions()` and `settle` of `@dems/shared/live` replace `useSimActions()` | rule 1 (one way in), AC-C-53 |
| `chain-strip.tsx:115`, `:126-148` | the call runs inside the runtime's `usePendingPress()`: `press.run((release) => settle(() => actions.verifyAuditChain(), { ok, fail, done: release }))` | LB-1; 09b §8; D166 (never a copy) |
| `chain-strip.tsx:150-161` | **Simulated** path unchanged: "running" (the kit `Spinner` and "Verifying…") at the press, the call one frame later, synchronous | CLG (a); Simulated must look and behave as before |
| `chain-strip.tsx:152-155` | **Live** path: sent at the press. Busy at once (`busyState(press.busy, running)` at `:231`), a second press sends nothing; the look does not change for `LIVE_PENDING_REVEAL_MS`, then `PendingSpinner` and "Verifying…" (`:233-234`) until the answer | LB-1; D166 |
| `chain-strip.tsx:131-133` | the stamp is `sim.store.getState().clock.now`: in LIVE the store is the Live source, its clock the Core's | S4-3 ("no change: the Live clock") |
| `chain-strip.tsx:134-144` | Live rejection: the runtime's presenter first (`useCoreErrorPresenter`); the generic "could not be checked" toast only when the presenter does not handle it; the last verdict stays. Simulated branch unchanged | rule 2; LB-5, LB-6, LB-10; W67 DN-1 (presenter in LIVE only) |
| `chain-strip.tsx:240` | in LIVE, after a verdict, `LiveChainLines` | §3.2 |

The verdict shown in LIVE is the Core's `view` (operation 60 resolves with `view`, `packages/shared/src/live/source/bindings.ts:401-406`).
Nothing starts from an effect: the only call is in the press handler (D158).

### 3.2 The Core's stored chain and lineage, and the link notice (`chain-live.tsx`, new)

| Where | What | Why |
|---|---|---|
| `chain-live.tsx:30-47` | `LiveChainLines`: "Stored chain verified through entry #n" / "Stored chain breaks at entry #n" from `stored`, and "Earlier chains: n, …" when `lineageTotal > 0`, read with `useLiveSelector((live: MobileLiveSim \| null) => live?.auditChain ?? null)` | the same answer of operation 60 keeps `stored` and `lineage` on the Live handle (`packages/shared/src/live/source/live-sim.ts:2188-2191`); during the demo fault AUDIT_TAMPER the view breaks while the stored chain stays verified (`39_module_security_audit.md` §6.1, §12) — without this line the phone would show only the broken view. Mobile form of [CS:§8.2 A9]; see DV-2 |
| `chain-live.tsx:50-66`; mounted at `audit-screen.tsx:126` | `AuditLinkNotice`: "Core server unreachable / The entries shown are the last the Core sent." by `const { offline } = useCoreLinkNotice();` — one call, no rule of its own; renders no element (not even a wrapper) when hidden | 09b §8; §3.5 |
| `audit-model.ts:206-229` | `StoredChainCheck`, `storedChainLine` (pure) | the Core's numbers, nothing computed on the tablet |

### 3.3 Truthful actor for AUTH_FAILED / AUTH_LOCKED in LIVE (CPS1-12 (a))

The Core writes these two types with `actorId` = the operator whose **username was typed**, not an
authenticated actor (`gateway_check/05_cp_access_control_security.md:445`; the simulator does the same,
`packages/shared/src/sim/auth.ts:193`, `:261`). In LIVE the actor of such a row reads
**"Username typed: <name>"** in the row, the detail (pane and sheet) and the search; an unknown username
stays "Unverified user"; a real sign-in names the operator.

| Where | What |
|---|---|
| `audit-model.ts:92-101` (function at `:99`) | `isTypedUsernameActor(row)` |
| `use-audit-data.ts:68-84` (the wording at `:76`) | `useAuditText` reads `useCoreLink().source === 'LIVE'` and words those rows |
| `i18n.ts:81-93` | `features.audit.live.*` (7 strings; none says "simulat") |

Simulated mode keeps the operator's name for these rows (unchanged; DN-2).

### 3.4 Files

| File | Change |
|---|---|
| `apps/mobile/src/features/audit/chain-strip.tsx` | modify (S1-7, S4-3) |
| `apps/mobile/src/features/audit/chain-live.tsx` | **new** (stored / lineage lines, link notice) |
| `apps/mobile/src/features/audit/audit-model.ts` | modify (+39: `isTypedUsernameActor`, `storedChainLine`) |
| `apps/mobile/src/features/audit/use-audit-data.ts` | modify (typed-username actor in LIVE; header comment) |
| `apps/mobile/src/features/audit/i18n.ts` | modify (+`live` subtree) |
| `apps/mobile/src/features/audit/audit-screen.tsx` | modify (mounts `AuditLinkNotice`; header comment) |
| `apps/mobile/src/features/audit/audit-entry-detail.tsx` | modify (one prop comment) |
| `apps/mobile/src/features/audit/testing/live-audit-bed.tsx` | **new** (test bed) |
| `apps/mobile/src/features/audit/live-audit-chain.test.tsx` | **new** (10 tests) |
| `apps/mobile/src/features/audit/live-audit-screen.test.tsx` | **new** (5 tests) |
| `apps/mobile/src/features/audit/audit-live-static.test.ts` | **new** (10 tests) |

`git diff --stat acaff20 -- apps/mobile/src/features/audit`: 6 files, 149 insertions, 25 deletions; no
existing test file. Nothing outside the folder was written (besides this report, the progress file and
`assets/80_*`).

### 3.5 The ten mobile rules (09 §4 answer 3) and 09b §8

| Rule | How it holds |
|--:|---|
| 1 | `useCoreActions()` + `settle` only; no `useSimActions`, no `.actions` (static test, `audit-live-static.test.ts`) |
| 2 | presenter first in LIVE (`chain-strip.tsx:135-137`); `resetCoreErrorPresenterForTests()` in the bed's reset |
| 3 | no network API, no Core address (static test) |
| 4 | no credential, no storage package (static test); the bed's passwords are markers |
| 5 | `useCoreLink().source === 'LIVE'` in `chain-strip.tsx` and `use-audit-data.ts`; `useLiveSelector` for the handle member |
| 6 | no ref+effect added; no state set in render; lint 0/0 with the compiler rules |
| 7 | timers on the store clock (`usePendingPress`); the folder's two timers are `acaff20`'s (boundary cooldown, sheet presence) |
| 8 | the Live text says nothing about a simulation; no `SIM-GAP` marker (folder: 0, as at `acaff20`) |
| 9 | only `features/audit/**` written; `@/runtime` through its barrel only |
| 10 | ledger and pre-image: §5.1, §10 |
| 09b §8 / D166 | `useCoreLinkNotice()` in one call; `usePendingPress`, `busyState`, `PendingSpinner` from `@/runtime`; busy while `press.busy`, spinner only while `press.pending` (LIVE) |

## 4. Contract gaps found

| ID | Where | What | Effect |
|---|---|---|---|
| CONTRACT-GAP-W80-1 | `packages/shared/src/api/security-audit.ts:522-530` (operation 60's examples: 403 is `BASIC_403_EXAMPLES` = `deviceRevoked`, `originNotAllowed`; `example-parts.ts:118-121`); used at `apps/mobile/src/features/audit/live-audit-chain.test.tsx` (the denial test) | Operation 60 needs no permission (every signed-in role may call it), so it has no `notPermitted` example and a 403 NOT_PERMITTED cannot occur by the contract. The refusal case is tested with the contract's own `originNotAllowed` example; to prove AC-C-48's denied toast the test writes the envelope, as W66 did (CONTRACT-GAP-W66-2). The toast names no role (no permission to map; W66 F-3) | test only; probably "by design, no change" — for W83 |

No Core capability the screen needs in LIVE is missing.

## 5. Verification

### 5.1 SG: lint, typecheck, whole suite (`assets/80_final_gate.log`)

```
## 2026-10-06 01:03  load averages: 6.41 5.59 5.00
## $ npm run lint -w @dems/mobile          > eslint .
lint exit=0
## $ npm run typecheck -w @dems/mobile     > tsc --noEmit
typecheck exit=0
## 01:04 load averages: 5.94 5.54 5.01
## $ npm run test -w @dems/mobile -- --maxWorkers=2
test exit=0
Test Suites: 128 passed, 128 total
Tests:       1580 passed, 1580 total
Time:        197.729 s
PASS src/features/audit/audit-screen.test.tsx (7.129 s)
PASS src/features/audit/live-audit-chain.test.tsx (5.38 s)
PASS src/features/audit/live-audit-screen.test.tsx
PASS src/features/audit/audit-live-static.test.ts
PASS src/features/audit/audit-model.test.ts
```

Reds seen while the row ran, not this row's (named, not touched; the final run above is green):

| Time | File | Owner |
|---|---|---|
| 00:40 | typecheck: `src/features/session-live/session-live-screen.tsx` (4 errors) | W68 |
| 00:48 | typecheck: `src/features/session-summary/testing/live-summary-bed.tsx(36,28)` | W72 |
| 00:55 | test: `src/features/session-live/live-session-live-link.test.tsx` (2 tests; 130 suites / 1,577 then) | W68 |

### 5.2 CLG (a)

```
## 01:08:23 $ git diff --stat acaff20 -- apps/mobile/src/features/audit
 .../src/features/audit/audit-entry-detail.tsx      |  2 +-
 apps/mobile/src/features/audit/audit-model.ts      | 39 ++++++++++
 apps/mobile/src/features/audit/audit-screen.tsx    |  8 ++
 apps/mobile/src/features/audit/chain-strip.tsx     | 87 +++++++++++++++++-----
 apps/mobile/src/features/audit/i18n.ts             | 14 ++++
 apps/mobile/src/features/audit/use-audit-data.ts   | 24 ++++--
 6 files changed, 149 insertions(+), 25 deletions(-)
## existing test files vs acaff20 (git rev-parse acaff20:<file> = git hash-object <file>)
same  1f872838d169  audit-model.test.ts
same  96de04ee1673  audit-screen.test.tsx
same  536e359e85e4  testing/audit-harness.tsx
same  33739412ce61  testing/audit-test-setup.ts
same  545c940bab00  testing/kit-helpers.ts
```

The folder's existing tests (`audit-screen.test.tsx` 7, `audit-model.test.ts` 5) pass in the run of §5.1
and in `assets/80_folder_tests_verbose.txt` (5 suites / 37 tests at 01:00:30).

### 5.3 CLG (b): the Live tests (`assets/80_folder_tests_verbose.txt`)

On the app's real Live source (`createMobileLive`) over the contract-checked fake transport, mounted by
the real `AppProviders` around the real `/audit` route (`testing/live-audit-bed.tsx`). Operation 60 is
answered as the Core answers it: `view` = the engine's own chain check, `stored` = verified through the
newest row unless a test sets it, `lineage` as set.

| Site | Success | Refusal | Outage | Further |
|---|---|---|---|---|
| S1-7 Verify (op. 60) | one GET at the press; busy at once; no spinner at 0 and 300 ms; `PendingSpinner` + "Verifying…" after the reveal delay; second press sends nothing; PASS with the Core's `view`; stored line | the contract's 403 `originNotAllowed` → "The Core refused this action", no verdict, idle, next press asks again; the written 403 NOT_PERMITTED (CONTRACT-GAP-W80-1) → "Not permitted" (AC-C-48), no role sentence | `OUTAGE` → "Core server unreachable / Nothing was changed.", no link notice (socket up), idle, next press works | 429 → "The Core server is limiting requests from this tablet / Try again in 30 s.", no offline wording (LB-10); AUDIT_TAMPER: chip and Alert from the replicated fault, the Core's FAIL at the altered row, stored line verified; stored broken + lineage 2 and 1 (plural/singular); the last verdict stays while a new one is out and after a refused one |
| S4-3 clock | the stamp equals `formatDate(store clock)` of the Live source | — | — | mutant C4 (wall clock) detected |
| Link (M0/M1) | — | — | the notice shows while the link is down, the rows stay, a press is refused locally (0 requests), the notice leaves when the Core is back | |
| StrictMode (D158) | under `<StrictMode>`: 0 requests of the screen at mount; one press, one request | | | |
| Screen | rows, head and total are the replica's; no REST read for them; a Core row enters live with the highlight | | | typed username in row, search, detail; "Unverified user" for an unknown username; F63-4: a Core row whose `message` says "(simulated)" shows nothing of it; no text on the screen says "simulat" |
| Simulated control | the typed row keeps the operator's name; "Verifying…" at the press; never busy; no stored line; no link notice | | | |

```
Test Suites: 5 passed, 5 total
Tests:       37 passed, 37 total
```

### 5.4 CLG (c)

```
## CLG (c): useSimActions in production files
grep exit 1 (1 = none)
## CLG (c): .actions reads outside quotes in production files
matches: 0
```

`audit-live-static.test.ts` holds the same (with a positive control for each pattern), plus rules 3, 4,
5, 7, 9, the one-call link notice, D166's helpers, the Live copy, 0 `SIM-GAP` markers, and the digest of
the Simulated copy (55 texts, `dd6855b4…`, the same value computed independently from
`git show acaff20:apps/mobile/src/features/audit/i18n.ts` by `assets/80_digest.cjs.txt`).

### 5.5 Mutation check (rule M15: nothing in the tree was written)

M1's method: a jest transformer outside the tree (`.cache/w80/mut/`, copied to `assets/80_mutate.py.txt`,
`80_mutating_transformer.cjs.txt`) applies one mutant in memory; each mutant runs the three
**behavioural** files (the static test is left out, so no regex can be what catches a mutant).

```
# W80 mutation check, 2026-10-06 01:00:58; the tree is not edited
control (no mutation, 3 test files): exit=0 Tests:       22 passed, 22 total (5 s)
## 22 detected, 0 not detected, 0 not applied, of 22
## the mutated files in the tree, before and after: identical
```

Mutants (`assets/80_mutations_2.log`): presenter skipped in LIVE (C1), generic toast after the presenter
(C1b), never released (C2), busy mark dropped (C3), wall clock (C4), a refusal clears the verdict (C5),
stored lines never shown (C6), Simulated calls at the press (C7), verdict before the answer (C8),
spinner at the press (P1), no spinner (P2), LIVE through the Simulated path (P3), "Verifying…" at the
press (P4), lineage line at 0 (L1), notice never / always (L2, L3), stored line from the view (L4),
broken stored read as verified (M1), a success counted as typed (M2), typed wording in SIMULATED / never
in LIVE (A1, A2), notice not mounted (S1). The first run (before D166, 17 of 17) is `assets/80_mutations_1.log`.

## 6. Device check (CLG (d)) — phone, lane 1, one sitting

### 6.1 How it was run

| Item | Value |
|---|---|
| Lock order | lane 2 / tablet were free but the tablet has no measured Login coordinates and Login may not be dumped, so the row queued for lane 1: `lockf -k -t 300 .locks/core-server.lane1.lock` (acquired 00:56:32), then `device-session.sh phone` (`METRO_PORT=8083`, `DEMS_CORE_HOST_PORT=4421`, `DEVICE_SESSION_MAX_SECONDS=600`) |
| Backend | `DEMS_CORE_PORT=4421 npm run start:server` → `"port":4421,"database":"dems_lane_1","demoControls":false`; health `dems-core-server 0.2.0`, ready; **no reset** |
| Launches | `demsdemo:///login?core=LIVE&motion=off`, then the deep link `demsdemo:///audit`; `core=SIMULATED&motion=off` last (D124, D164 DN-7) |
| Login, Home | no dump: W60's fixed coordinates; the app's biometric offer detected by its pixels (W66's `pixels.py`) and declined with "Not now" (540,1444) — never "Enable" |
| Dumps | only on the Audit screen (motion off: no ambient loop), 20 s limit each; none timed out; the dump file `/sdcard/w80.xml` removed (`ls: … No such file or directory`) |
| Secret | the password typed into the app's own field from the dataset constant, never printed; credential lines: JS log 0, server log 0 |
| Scripts | `assets/80_run_w80.sh.txt`, `80_device_w80.sh.txt`, `80_device_flow.mts.txt`; log `assets/80_device_run.log` |
| Code on the device | the sitting ran at 00:56–00:58 with `chain-strip.tsx` before the D166 change (sha256 `a7eeda08…`). The change only moves the LIVE spinner to the reveal delay; the verdict, the stored line, the request and the Simulated path are the same code. Not re-run (DV-1) |

### 6.2 The run, as logged (`assets/80_device_run.log`)

```
-- 00:57:01 the app's sign-in: POST /api/v1/auth/sign-in 200
-- 00:57:08 tapped the app's biometric offer: "Not now" at 540,1444
-- 00:57:11 deep link demsdemo:///audit
-- 00:57:17 on screen: screen-audit, audit-chain-chip-ok "Chain OK", audit-chain-head "99b19b0b", audit-chain-total "177 entries"
-- 00:57:21 tapped audit-verify at 912,392
-- 00:57:22 verify: GET /api/v1/audit/chain 200
-- 00:57:27 on screen: audit-verify-PASS, audit-verify-text "Checked 177 entries at 00:57:21", audit-live-chain, audit-live-stored-ok "Stored chain verified through entry #177", audit-live-lineage "Earlier chains: 1, discarded by a demo reset or a scenario load"
-- 00:57:36 on screen: audit-empty            (search "typed": no such row on lane 1)
-- 00:57:37 credential/token lines in the JS log (must be 0): 0
-- 00:57:37 audit chain requests: 1; audit list requests (must be 0): 0; demo operations (must be 0): 0; biometric enrolment requests (must be 0): 0
-- LIVE flow exit: 0
== S. SIMULATED mode (the last launch, D124) ==
-- 00:58:20 on screen: screen-audit, audit-chain-chip-ok "Chain OK", audit-chain-head "b6b865b8", audit-chain-total "91 entries"
-- 00:58:28 on screen: audit-verify-PASS, audit-verify-text "Checked 91 entries at 00:58:23"
-- 00:58:28 Core requests in SIMULATED mode (must be 0): 0
-- SIMULATED flow exit: 0
-- prefs after: {"coreLinkSource":"SIMULATED"}
device session exit=0
```

The backend's request log for the sitting:

```
      1 GET /api/v1/audit/chain 200 principal=operator
      1 GET /api/v1/auth/session 401 principal=device
      1 GET /api/v1/auth/status 200 principal=device
      1 GET /api/v1/health 200 principal=null
      1 GET /api/v1/pairing/device 200 principal=device
      1 POST /api/v1/auth/sign-in 200 principal=device
      1 POST /api/v1/auth/touch 200 principal=operator
-- bearer/cookie/credential lines in the server log (must be 0): 0
```

**The rows are the lane's:** `dems_lane_1` held 175 audit rows at 00:56:32; the phone's own connection
(00:56:46, "Tablet link changed") and its sign-in (00:57:00) made 177, which is the total the strip
showed at 00:57:17 and the sequence the Core verified its table through; 178 after the sitting.

### 6.3 Screencaps (`assets/80_*.png`, 1080 × 2424)

| File | What it shows |
|---|---|
| `80_live_login.png` | LIVE Login: "Core online", "Core: DEMS-IR-01 • paired as DEV-0001" |
| `80_live_after_signin_offer_check.png` | Home "Core Live" with the app's biometric offer on top (before "Not now") |
| `80_live_after_signin.png` | Home after the offer was declined |
| `80_live_audit.png` | **Operator Audit in LIVE with the lane's real rows**: "Chain OK", HEAD 99b19b0b, 177 entries; the Core's rows (sign-in of AKP Budi Santoso · Password · DEV-0001, tablet link changes by System, storage policy changes by AKP Andi Pratama) |
| `80_live_verdict.png` | **Site S1-7 settled with the server's verdict**: PASS "Checked 177 entries at 00:57:21", "Stored chain verified through entry #177", "Earlier chains: 1, discarded by a demo reset or a scenario load" |
| `80_live_search_typed.png` | the search "typed": no matching row on lane 1 |
| `80_simulated_start.png` | the SIMULATED Login after the `core=SIMULATED` launch |
| `80_simulated_after_signin_offer_check.png` | SIMULATED Home with the offer (declined) |
| `80_simulated_audit.png` | SIMULATED Operator Audit: the simulator's 91 entries, HEAD b6b865b8 |
| `80_simulated_verdict.png` | SIMULATED Verify: PASS "Checked 91 entries at 00:58:23", no stored line, no link notice — as at `acaff20`; 0 Core requests |

### 6.4 Lock status, ports (read-only; `assets/80_lock_status_before.txt`, `80_lock_status_after.txt`)

```
00:54:09 / 00:58:41 (identical; diff exit 0)
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
phone2 (emulator-5558): AVD dems2_phone2, isKeyguardShowing=false, CredentialType=NONE, fingerprint count=0, lock screen disabled=true
tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
lsof 4421/8083 exit 1 (1 = none)
adb -s emulator-5554 reverse --list: (empty)
```

## 7. Findings

| ID | Finding | Evidence | For |
|---|---|---|---|
| F80-1 | F63-4 does not reach the mobile Operator Audit: the screen labels rows by their code and never renders `message` (nor puts it in the event record), so the Core's "(simulated)" restart / test-signal message is never shown. Proven in jest on a Core row whose message says so; on the device the scan of what the screen showed found no such word, but the lane-1 rows on screen did not include a device command | `live-audit-screen.test.tsx` (F63-4 test); `packages/shared/src/sim/maintenance.ts:220-224` | W75 / W83 (server data not reworded here) |
| F80-2 | The KI-07 command of the plan (`grep -rhoE "SIM-GAP-M[0-9]+-[0-9]+" apps/mobile/src`) now prints 13 IDs / **65** markers, not 62: the 3 extra hits are the ID quoted in the text of W72's new `features/session-summary/summary-live-static.test.ts` (lines 16 and 174). No marker was added; W78's and this row's static tests build the string by joining parts to avoid exactly this | `diff` of per-file counts vs `acaff20` (01:08) | W72 (in flight); the controller's ledger |
| F80-3 | Lane 1's audit ring holds no failed or locked sign-in with a known username, so the "Username typed" wording was not seen on the device; it is proven in jest on the real Live source (row, search, detail, AUTH_LOCKED included) | `80_live_search_typed.png` | — |
| F80-4 | `dems_lane_1` holds one discarded chain (`lineageTotal` 1): an earlier row reset or loaded a scenario on lane 1 at some point; the line is the durable trace of SD-19 | `80_live_verdict.png` | Info |
| F80-5 | jest prints "A worker process has failed to exit gracefully" for this folder; it appears with the folder's existing suites alone (00:40, before any new test ran) | the first folder run | Info (pre-existing) |

## 8. Deviations

| # | Brief / spec | What was done | Why |
|--:|---|---|---|
| DV-1 | S1-7: "The Spinner already shows one frame earlier; it stays until the settle" | In LIVE the request goes at the press, busy at once, and the runtime's `PendingSpinner` shows only after `LIVE_PENDING_REVEAL_MS` (D166, 09b §8); Simulated keeps its Spinner from the press and its one-frame order | The controller's binding note D166 arrived during the row; its rule is newer than S1-7's sentence. The device sitting ran just before this change (§6.1); the change is in the pending look only and is covered by jest and mutants P1–P4 |
| DV-2 | `[CS:§7.4]` lists only the call-site file for this group | `chain-live.tsx` adds two display lines in LIVE (the stored chain and the lineage count) and the link notice | Truthfulness: in LIVE under AUDIT_TAMPER the view breaks while the Core's table is intact; showing only the view would tell the operator the log is broken. The web's A9 shows the same lines. Easy to drop if not wanted (DN-1) |
| DV-3 | The brief: "Never `cd`" | Three commands early in the row began with `cd <repo root>` (00:31–00:43), read-only, in a shell whose working directory resets per call | Slip; no effect on any file. All later commands use absolute paths |
| DV-4 | Report name | `implementation/80_mobile_operator_audit.md` (the brief's name); the plan's section 17 lists `implementation/80_mobile_audit.md` | The brief is the newer instruction |

## 9. Decisions for the controller

| ID | Decision | Recommendation |
|---|---|---|
| DN-1 | Keep the two LIVE lines under the verdict (stored chain, earlier chains) on the phone (DV-2) | Keep: same answer, no new request, mirrors A9, makes the AUDIT_TAMPER demo read truthfully |
| DN-2 | The "Username typed: <name>" wording is LIVE-only; the simulator writes the same rows (`sim/auth.ts:193`, `:261`) and Simulated still shows the operator's name, which reads as if that operator acted | Put the same one-line change for SIMULATED into W0 / W83 as a deliberate Simulated change (the static digest and the Simulated control test would be updated there), or accept as is |
| DN-3 | CONTRACT-GAP-W80-1 (operation 60 has no `notPermitted` example) | To W83 with CONTRACT-GAP-W66-2 / W69-1; probably "by design" |
| DN-4 | F80-2 (KI-07 count inflated by a test's text) | Ask W72 to build the ID string from parts, or count markers in production files only |
| DN-5 | DV-1: accept the device evidence of 00:56–00:58 for the pre-D166 build (pending look only differs) | Accept; a re-run would show nothing a screencap can capture (the spinner window is under 1 s on loopback) |

## 10. State left on the device and its lane

| Where | State |
|---|---|
| `dems2_phone` | Last launch `core=SIMULATED&motion=off`; prefs `{"coreLinkSource":"SIMULATED"}`; signed in to the simulator as the INVESTIGATOR when device-session force-stopped the app. The biometric offer declined twice ("Not now"), never enabled; no `setBiometricEnrolment` request. `/sdcard/w80.xml` removed. Keyguard, PIN and fingerprint untouched; lock status identical |
| `dems_lane_1` | DEV-0001 kept (`paired_devices 1`, `device_credentials 1` before and after); `audit_log` 175 → 178 (the tablet link change of 00:56:46 and the sign-in of 00:57:00 are on screen; the 178th row, written after 00:57:17, was not itemised); the sign-in's session was not signed out (device-session force-stopped the app), so it should end by the server's idle rule — hypothesis, not read back; no reset, no summary acknowledged, nothing exported |
| Ports, locks | 4421 and 8083 free; `adb reverse --list` empty; Metro stopped by device-session; backend stopped; `.locks/core-server.lane1.pid` emptied. Lane 2, the tablet, `dems2_phone2`, 5432, 5173–5175, 4400 and lane 3 untouched |

## 11. Rollback (not executed)

R-CO for the six modified files: `git checkout acaff20 -- apps/mobile/src/features/audit/{chain-strip.tsx,audit-model.ts,use-audit-data.ts,i18n.ts,audit-screen.tsx,audit-entry-detail.tsx}`;
R-NEW for the five new files: `git clean -fd -- apps/mobile/src/features/audit/chain-live.tsx apps/mobile/src/features/audit/live-audit-chain.test.tsx apps/mobile/src/features/audit/live-audit-screen.test.tsx apps/mobile/src/features/audit/audit-live-static.test.ts apps/mobile/src/features/audit/testing/live-audit-bed.tsx`.
Pre-images and hashes: `.cache/rollback/W80/` (`pre.sha256`, 17 files; `post.sha256`; `W80.post.patch`, 343 lines).

## 12. Error handling and logging

Every rejection of the S1-7 call writes one record to the persistent runtime log (`reportRuntimeIssue`,
`dems.mobile.log.v1`, privacy-filtered): `audit.verifyChain.core` (`warn` when the presenter showed it,
`error` otherwise) in LIVE, `audit.verifyChain` (`error`) in Simulated, as before. The user sees the
presenter's toast or the screen's own; the button returns to idle; the last verdict stays (LIVE).

---
*Generated: 2026-10-06 01:10 WIB*
