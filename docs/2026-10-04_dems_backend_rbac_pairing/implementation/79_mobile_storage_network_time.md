---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W79 (plan step 101; provisional rows 94 and 95, merged)
agent: coder-execution
date: 2026-10-06
source_plan: masterplan/02_plan.md (row W79, line 753; gate CLG, line 647)
status: complete
---

# W79 — Mobile Storage (sites S2-6, S5-3) and Network & Time in LIVE mode

Tier 2 record: what was built, why, and how it was verified. Code is cited as `path:line` relative to the
repository root; `[CS:…]` is `masterplan/04_client_integration_spec.md`; `[CP:§4.3 rule n]` is
`gateway_check/09_cp_mobile_runtime.md` section 4, answer 3; `[M1:§8]` is
`gateway_check/09b_m1_mobile_consolidation.md` section 8; `[DEC:…]` is `decisions/decisions.md`. No credential
value appears in this file or in the assets: the device flow reads the demo password from the dataset constant and
never prints it (scan in section 6.4).

## 1. Result at a glance

| Gate item | Result | Evidence |
|---|---|---|
| S2-6 Apply in the Manage Storage sheet (operation 55) | Through `useCoreActions()` + `settle`; presenter first in LIVE; toast and closing in `ok`; Apply returns to idle in `done`; `usePendingPress`, `busyState`, `PendingSpinner` from `@/runtime` | `storage-screen.tsx:201-229`, `manage-storage-sheet.tsx:77-82, 208-214`; 9 Live tests |
| S5-3 the role hint | Kept (no code change in `sim-adapter.ts`); the Core enforces its any-of rule; its 403 reaches the presenter | `manage-storage-sheet.tsx:123`; 1 Live test + the two 403 tests |
| Network & Time | **No production file changed** (`git diff --stat acaff20 -- …/network-time` prints nothing; only one new untracked test file) | §5.2 |
| CLG (a) existing tests of both folders | 6 files of `acaff20` byte-equal, all green | §5.2 |
| CLG (b) Live tests on the fake transport | S2-6: success (×3), 403 `notPermitted` example, 403 in the Core's spelling, 422, outage, dead link, 429; S5-3; Network & Time on the Core's data, by delta, through an outage, no simulation claim | §4, `assets/79_live_tests_verbose.txt` (35 names) |
| CLG (c) no `useSimActions`, no `.actions` read on a `Sim` | 0 in both folders' production files | §5.3 |
| CLG (d) device check | Phone, lane 1, ONE sitting 00:53:08–00:56:22 (3 min 14 s); LIVE Storage S2-6 settled (200) and **set back** (200), LIVE Network & Time, both in SIMULATED, `core=SIMULATED` last; 14 screencaps | §6 |
| StrictMode (D158, F69-1) | No Core command or query starts on mount: 0 requests with effects run twice; ONE request per press | §4.1 test "React StrictMode" |
| SG | `@dems/mobile` **128 suites / 1,580 tests exit 0** (floor 114 / 1,431); typecheck exit 0; lint exit 0 with `--max-warnings=0` | §5.1, `assets/79_gate.log` |
| M15 mutation check (in memory) | **25 of 25 detected**; the mutated files identical before and after | §5.4, `assets/79_mutations.log` |
| Lock status | Identical before (00:49:09) and after (00:56:38) | §6, `assets/79_lock_status_{before,after}.txt` |

## 2. Sources read (binding)

`masterplan/02_plan.md` row W79 (`:753`), the citation convention (`:81`), section 11 gates SG and CLG (`:645-647`);
`masterplan/04_client_integration_spec.md` §7.4 (groups `features/storage` and `features/network-time`), §8.1
(LB-1 to LB-10), §8.6 S2-6, §8.7 S5-3, §13.5 AC-C-48, §17.4 Row 21 #3; [DEC:F59] (client-side bounds kept, the
server's 422 is the judge), [DEC:F64] (the any-of permission's three spellings), [DEC:D88] (the storage module),
[DEC:D158] (StrictMode, F69-1), [DEC:D164] (M1, device rule DN-7), [DEC:D125] (device locks); [CP:§4.3] the ten mobile
rules; [M1:§8]; `implementation/51_mobile_runtime.md` §4 (the runtime surface and the test notes);
`implementation/71_web_storage_network_time.md` (the gated web twin, CONTRACT-GAP-W71-1, F71-1);
`implementation/37_modules_storage_network_time.md` (operations 54-57, any-of permission); the gated pattern rows
`implementation/78_mobile_devices.md` (bed, static test, mutation runner) and `implementation/74_mobile_evidence.md`
§15 (the device re-run). The controller's note of decision D166 (received mid-row) is answered in §3.3.

## 3. What was built (all production edits under `apps/mobile/src/features/storage/`)

### 3.1 S2-6 — the policy change through the Core (`storage-screen.tsx`)

| Part | Where | What and why |
|---|---|---|
| One way in | `storage-screen.tsx:35` (import), `:204` | `useSimActions()` → `useCoreActions()` [CP:§4.3 rule 1]; in Simulated mode `coreActionsOf(sim)` is `sim.actions` itself, so the timing is unchanged (CL-12) |
| One LIVE idiom | `:205` | `useCoreLink().source === 'LIVE'` [CP:§4.3 rule 5]; the only file that reads it |
| The command | `:210` | `settle(() => actions.setStoragePolicy({ retentionPolicy, autoArchive }), …)`: the draft as the operator set it; the Core derives the days |
| Success | `:211-215` | `ok`: the info record, the toast, then `handlers.applied()` (the sheet closes) — after the Core's 200 **and** the delta of the revision it named (CL-16), so the screen already shows the Core's policy when the toast appears (LB-3). LIVE words `features.storage.live.applied` "Storage policy updated" (rule 8); Simulated keeps "Storage policy updated (simulated)" |
| Refusal | `:216-224` | LIVE: the presenter first (`if (live && presentCoreError(error))`, [CP:§4.3 rule 2]) — a 403, an outage, a dead link, a 429 each get the runtime's one wording (LB-5, LB-6, LB-10); logged `warn`. What the presenter leaves (the Core's 422 rebuilt as `SimTransitionError` `POLICY_RANGE`, binding `packages/shared/src/live/source/bindings.ts:462-467`, F59) keeps the screen's own "could not be updated" toast and an `error` record. Simulated: the old branch exactly (`error` record + the same toast) |
| Idle | `:225` | `done: handlers.settled` releases the pressed control in every path |

### 3.2 The sheet (`manage-storage-sheet.tsx`)

| Part | Where | What and why |
|---|---|---|
| Continuations | `:53-59` (`ApplyHandlers`), `:71` | `onApply(draft, { applied, settled })` replaces the boolean result: "the sheet closes in `ok`; stays open on `false`" [CS:§8.6 S2-6] becomes `applied: onClose` (DV-2) |
| LB-1 | `:77-82` | `const press = usePendingPress()` from `@/runtime` [M1:§8], held in the sheet's frame OUTSIDE the portal, so the in-flight state outlives a sheet the operator closes while the command is out; `press.run((release) => onApply(draft, { applied: onClose, settled: release }))` — a second press sends nothing |
| Busy, spinner late | `:208`, `:214` | `{...busyState(busy, !allowed \|\| !changed)}` marks Apply busy from the press with its look unchanged (the disabled flag passed as the second argument, D166); `PendingSpinner` (kit `Spinner`, black on the gold button) only while `pending`, i.e. after `LIVE_PENDING_REVEAL_MS` on the store's clock (rule 7). Nothing is added outside the button |
| S5-3 | `:123` (unchanged line) | `canManageStoragePolicy(role)` stays the hint, read from the replicated operator; the Core enforces EVIDENCE_REVIEW **or** MAINTENANCE on operation 55 ([DEC:D88]) |

In Simulated mode the command settles before `press.run` returns: `release` runs inside it, no state is set, nothing
renders again — `busyState` adds no prop while idle and the spinner never shows (pinned by the Simulated control test,
§4.1, and by the folder's unchanged `storage-screen.test.tsx`).

### 3.3 Copy, hint, and the controller's note D166

- `i18n.ts:50-57` (the block `live` at `:55`): one additive LIVE text, `live.applied` "Storage policy updated". The 26 Simulated texts are those of
  `acaff20` (digest pinned in the static test). The web twin's shared key `storage.manage.live.applied` (W71) is in the
  uncommitted working tree, so mobile uses its own key, as W78 did (DN-2).
- `sim-adapter.ts` (S5-3) is **not** edited: its two `SIM-GAP-M85-*` markers must stay byte-equal for KI-07; the
  hint's LIVE meaning is documented at the call site (`manage-storage-sheet.tsx` header).
- **D166** (M1 follow-up: `usePendingPress`, `busyState`, `PendingSpinner` from `@/runtime`; never a copy): met as
  written — the folder holds no copy of the hook or the helpers (static test "the pending control is the runtime's";
  `matching(/function usePendingPress|LIVE_PENDING_REVEAL_MS|function busyState/)` is empty). The note's example for a
  dialog (S3-1: "closes in `done`") is not S2-6's rule; this sheet follows [CS:§8.6 S2-6]: closes in `ok`, stays open
  with the draft on a refusal (LB-6) — DN-1.

### 3.4 Network & Time: no production change

[CS:§7.4] "features/network-time (3) | None | `state`: `time`, `network`, `tabletLink` | No change" and [CS:§17.4]
Row 21 #3 hold. The screen reads only replicated slices and the Live clock (`network-time-model.ts:154-197`,
`use-network-time.ts:33-55`), takes no action, and holds no "simulat" text; the Live tests (§4.2) and the device (§6)
show it on the Core's data. Nothing to report as `needs-review`.

### 3.5 New test files

| File | Tests | What |
|---|---:|---|
| `apps/mobile/src/features/storage/testing/live-storage-bed.tsx` | — | The app's REAL Live source over the contract-checked fake transport, the REAL `/storage` and `/network-time` route files, an engine simulator per test that runs operation 55 and answers its refusals with the contract's examples, delta/answer order, answer delay, `strict` (StrictMode), `runCore(ms, change)`; plus `renderSimulatedStorage` (the control group) |
| `apps/mobile/src/features/storage/testing/storage-test-setup.ts` | — | The gorhom sheet's own test mock (the devices / network-time setup, kept in this folder) |
| `apps/mobile/src/features/storage/live-storage-sites.test.tsx` | 15 | S2-6, S5-3, the screen on the Core's data, StrictMode, the Simulated control (§4.1) |
| `apps/mobile/src/features/storage/storage-live-static.test.ts` | 11 | CLG (c) and rules 1-5, 7-9 over the folder's production files (§5.3) |
| `apps/mobile/src/features/network-time/live-network-time.test.tsx` | 9 | Network & Time on the Core's data (5) + static rules over the folder (4) (§4.2) |

Every Live test ends with `mobile.stop()` and `fake.assertNoViolations()`; `resetCoreErrorPresenterForTests()` runs in
`beforeEach` (rule 2); `getMissingKeys()` is empty after each test (MA-21).

## 4. The Live tests (CLG b)

### 4.1 Storage (`live-storage-sites.test.tsx`)

| Test (line) | Covers | Asserted |
|---|---|---|
| `:107` success as the SUPERVISOR, answer delayed 2 s | S2-6, LB-1, LB-3, CL-16, rule 8 | one `POST /api/v1/storage/policy` with `{ retentionPolicy: 'YEAR_1', autoArchive: false }`; held delta: replica unchanged before the answer; Apply busy at once, no spinner; a second press sends nothing; spinner after 500 ms; no toast and sheet open until the answer; then the policy `YEAR_1/365/false`, "Storage policy updated" (no "(simulated)"), sheet closed, first activity row "Storage policy changed · 365 days · auto-archive off", no "simulat" text, info record |
| `:148` answer first, delta later | CL-16 | toast and closing wait for the held delta |
| `:166` TECHNICIAN | the other half of the any-of | Apply enabled; `CASE_CLOSURE` applied |
| `:178` 403 by `fake.example('setStoragePolicy', 403, 'notPermitted')` | AC-C-48, LB-5, F64 | "Not permitted"; no "Requires the …" (no role of the wrong kind); no success or failure toast; sheet open with the draft; Apply idle; policy unchanged; ONE `warn` record with the draft |
| `:204` 403 with `permission: EVIDENCE_REVIEW_OR_MAINTENANCE` (the Core's spelling, D88) | F64 | reads the same |
| `:226` 422 `invalidInput` | F59, B-9's mobile twin | "The storage policy could not be updated. Please try again."; no denied or offline toast; sheet open with the draft; ONE `error` record, correlation ID `…/storage-policy-…` |
| `:247` outage (`failOnce`) | LB-6 | "Core server unreachable" / "Nothing was changed."; sheet open with the draft; Apply idle; a second press sends again and closes it |
| `:270` dead link (socket dropped) | CL-22, AC-C-59 shape | two presses, **no request**; offline toast; sheet open with the draft |
| `:287` 429 (`rateLimited(12)`) | LB-10 | "The Core server is limiting requests from this tablet" / "Try again in 12 s."; no offline wording; sheet keeps the draft |
| `:305` S5-3, INVESTIGATOR | the hint | "Your role (Investigator) can view the storage policy"; Apply disabled; a press sends nothing |
| `:326` the Core's data (tablet landscape) | §3.2, MD-8 | a Core at LOW with `CASE_CLOSURE` and no auto-archive: LOW Alert, ring "… LOW", KPI retention days and "Until case closure", fault and policy activity rows, "Current: Until case closure · auto-archive off"; no "simulat"; no request of operations 54 or 55 |
| `:343` by delta | G13's mobile twin | the Core's disk fills → LOW Alert and toast; another client's policy change → replica and activity row follow |
| `:355` lost link | §3.5 | the screen keeps the Core's last data |
| `:371` StrictMode | D158, F69-1 | Storage, its sheet, Network & Time and its LAN sheet mount under `<StrictMode>`: 0 requests of operations 53-57; then ONE Apply → exactly `['setStoragePolicy']` |
| `:398` SIMULATED control | AC-C-101 behaviour | store and audit row written before the press returns; Apply never marked busy, no spinner; "(simulated)" toast; sheet closes |

### 4.2 Network & Time (`live-network-time.test.tsx`)

| Test | Asserted |
|---|---|
| the Core's data | a Core with its own values (IP `192.168.10.77`, LAN "Core LAN B", 9 satellites, NTP server `192.168.10.9`, one PoE port down): server value, GNSS tier and "9 satellites in view", "N-1 of N ports", the clock label = UTC+07:00 of the Live clock (within 1 s of the fake Core's clock; held to the minute by the `motion=off` switch), the LAN sheet's IP and LAN name; no "simulat"; no request of operations 56 or 57 and none beyond the runtime's own |
| by delta | GNSS loss → NTP tier, "NTP fallback", "GNSS signal lost" toast; restored → GNSS, "GNSS lock restored" |
| tablet link | OFFLINE by delta → "Offline" in the LAN sheet |
| outage | last data kept; no "simulat"; no request |
| SIMULATED | the seed's server `192.168.10.1` and IP `192.168.10.21` |
| static (4) | the 14 production files of `acaff20`; no action hook of the simulator or the Core, no `settle`, no `.actions` read; no network API, address, Live module, `useCoreLink`; copy digest = `acaff20` (35 texts), no "simulat"/"mock" text, no `SIM-GAP` marker |

## 5. Verification (commands from the repo root; last lines quoted)

### 5.1 SG — the gate (`assets/79_gate.log`)

```
## 2026-10-06 01:03:48 WIB  1:03  2 users, load averages: 5.80 5.49 4.97
## $ npm run test -w @dems/mobile -- --maxWorkers=2
exit=0
A worker process has failed to exit gracefully and has been force exited. …
Test Suites: 128 passed, 128 total
Tests:       1580 passed, 1580 total
Time:        193.308 s
## 01:07:27 $ npm run typecheck -w @dems/mobile
exit=0
> tsc --noEmit
## 01:07:36 $ npm run lint -w @dems/mobile -- --max-warnings=0
exit=0
> eslint . --max-warnings=0
```

No red file in the whole-suite run. Earlier in the row two typecheck runs were red in another row's folder only — 00:38
`features/session-summary/session-summary-screen.tsx:103,107` and 00:48
`features/session-summary/testing/live-summary-bed.tsx:36` (W72, in flight); green at 01:07:27. The "worker process
has failed to exit gracefully" line appears in every whole-suite run (W78 §5.3). **Ledger:** W79 adds 3 suites / 35
tests (15 + 11 + 9); no existing test changed.

### 5.2 CLG (a) (`assets/79_clg_a_c.log`)

```
## 2026-10-06 01:08:12 WIB CLG (a): the folders' existing test files vs acaff20 (empty = unchanged)
apps/mobile/src/features/network-time/network-time-model.test.ts
apps/mobile/src/features/network-time/network-time-screen.test.tsx
apps/mobile/src/features/network-time/testing/network-time-harness.tsx
apps/mobile/src/features/network-time/testing/network-time-test-setup.ts
apps/mobile/src/features/storage/storage-model.test.ts
apps/mobile/src/features/storage/storage-screen.test.tsx
$ git diff --stat acaff20 -- <those files>
exit=0 (no output above = unchanged)
$ git diff --stat acaff20 -- apps/mobile/src/features/network-time
(no output = no tracked file of the folder changed)
$ git status --porcelain -- apps/mobile/src/features/network-time
?? apps/mobile/src/features/network-time/live-network-time.test.tsx
$ git diff --stat acaff20 -- apps/mobile/src/features/storage
 apps/mobile/src/features/storage/i18n.ts           |  8 +++
 .../src/features/storage/manage-storage-sheet.tsx  | 47 ++++++++++++---
 .../mobile/src/features/storage/storage-screen.tsx | 66 +++++++++++++++-------
 3 files changed, 94 insertions(+), 27 deletions(-)
## the folders' tests in the whole-suite run of 01:03:48
PASS src/features/network-time/live-network-time.test.tsx
PASS src/features/network-time/network-time-model.test.ts
PASS src/features/network-time/network-time-screen.test.tsx
PASS src/features/storage/live-storage-sites.test.tsx (12.589 s)
PASS src/features/storage/storage-live-static.test.ts
PASS src/features/storage/storage-model.test.ts
PASS src/features/storage/storage-screen.test.tsx
```

The folders' existing tests also passed right after the first production edit (00:38: `Test Suites: 4 passed`,
`Tests: 27 passed`). Pre-image vs post-image checksums (`.cache/rollback/W79/{pre,post}.sha256`): every production
file of `network-time/` identical; in `storage/` only the three files above changed, plus the five new test files.

### 5.3 CLG (c)

```
## CLG (c), corrected (01:10): the same scan with quoted text (i18n keys) removed first, comments kept
(none)
## the same, plain grep (i18n keys in quotes included)
apps/mobile/src/features/storage/panel-boundary.tsx:82:        ? i18n.t('common.actions.retryIn', { seconds: cooldownS })
apps/mobile/src/features/storage/panel-boundary.tsx:83:        : i18n.t('common.actions.retry');
apps/mobile/src/features/network-time/i18n.ts:7: * fallback toasts; `common.actions.*`, `common.errors.*`), …
apps/mobile/src/features/network-time/card-boundary.tsx:82: … i18n.t('common.actions.retryIn', …)
apps/mobile/src/features/network-time/card-boundary.tsx:83: … i18n.t('common.actions.retry');
apps/mobile/src/features/network-time/lan-sheet.tsx:80: … accessibilityLabel={t('common.actions.close')} …
## KI-07 per folder (occurrences): storage and network-time, now and at acaff20
apps/mobile/src/features/storage: now 10 ({'SIM-GAP-M85-1': 5, 'SIM-GAP-M85-2': 5}), acaff20 10 (same)
apps/mobile/src/features/network-time: now 0 ({}), acaff20 0 ({})
```

The plain grep finds only translation keys (`common.actions.*`) and a comment — no read of a `Sim`. The static tests
(`storage-live-static.test.ts`, the static block of `live-network-time.test.tsx`) hold the same rules on every run.
The whole tree reads **13 IDs / 65 markers** at 01:08 against 62 at `acaff20`: the three extra occurrences are in one
new file of another row, `apps/mobile/src/features/session-summary/summary-live-static.test.ts` (W72, in flight); this
row's folders are unchanged (above).

### 5.4 Mutation check (rule M15; `assets/79_mutations.log`, runner `79_mutate.py.txt`)

Method of M0 / W56 / W78: a jest transformer outside the tree (`.cache/w79/mut/`, copied as
`79_mutating_transformer.cjs.txt`, `79_jest_mut_config.cjs.txt`) applies one mutant in memory to one production file;
the group's test files run; detected = jest exit ≠ 0. The jest subprocess gets `cwd=apps/mobile` (as M0's and W78's
runners; no shell `cd`).

```
# W79 mutation check, group network-time, 2026-10-06 00:59:01; 3 test files per run; the tree is not edited
control (no mutation): exit=0 Tests:       23 passed, 23 total (19 s)
## 6 detected, 0 not detected, 0 not applied, of 6
## the mutated files in the tree, before and after: identical
# W79 mutation check, group storage, 2026-10-06 00:59:45; 4 test files per run; the tree is not edited
control (no mutation): exit=0 Tests:       39 passed, 39 total (11 s)
## 19 detected, 0 not detected, 0 not applied, of 19
## the mutated files in the tree, before and after: identical
```

Storage mutants: optimistic toast (S1), sheet closes at the press (S2) or on a refusal (S3), presenter skipped (S4),
Simulated words in LIVE (S5, I1), LIVE branch never taken (S6), Apply never idle (S7), a presented refusal also toasts
the failure (S8), refusal logged as `error` (S9), fire-and-forget (S10), auto-archive not sent as drafted (S11), a
command from a mount effect (SM1, F69-1), Apply not marked busy (M1), no spinner (M2), spinner at once (M3), no in-flight
guard (M4), sheet never closes (M5), the S5-3 hint dropped (M6). Network & Time mutants (no production change; they show
the Live tests read the Core's data): fixed NTP server (N1), satellites (N2), PoE ports (N3), tablet link (N4), IP (N5),
no GNSS-loss toast (N6). The static tests read files from disk, so their own checks are covered by their positive
controls, not by this runner.

## 6. Device check (CLG d) — phone `dems2_phone`, lane 1 (`assets/79_device_run.log`)

Run as `/usr/bin/lockf -k -t 600 .locks/core-server.lane1.lock /bin/sh .cache/w79/run_w79.sh` (sandbox bypass for port
binding and adb; scripts `assets/79_run_w79.sh.txt`, `79_device_w79.sh.txt`, `79_flow_w79.mts.txt` — W74's re-run
with this row's flow). Backend `127.0.0.1:4421` on `dems_lane_1` (no reset; `demoControls:false`), Metro 8083,
`device-session.sh phone` with `DEVICE_SESSION_MAX_SECONDS=600`. **One sitting: lock held 00:53:08, session ended
00:56:22 (3 min 14 s); device-session exit 0; run exit 0.**

Device rules kept (D164 DN-7, D125): the app was launched on `demsdemo:///login?core=LIVE&motion=off` and
`demsdemo:///login?core=SIMULATED&motion=off`, never `/` with `motion=`; Login used W60's fixed coordinates; Home
(after the sign-in) was never dumped — the flow deep-linked to `/storage` and **stopped at a gate** with a screencap,
and went on only after I had looked at it (`79_phone_live_storage_gate.png`: the Storage screen under the app's
biometric offer) and written the gate file; `uiautomator dump` ran only on Storage and Network & Time (20 s limit);
the biometric offer was declined by its "Not now" (`biometric-offer-decline`) in both modes, "Enable" never pressed.

Lock status (read-only `emulator-user-lock.sh status all`):

```
# before (2026-10-06 00:49:09 WIB)
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
phone2 (emulator-5558): AVD dems2_phone2, isKeyguardShowing=false, CredentialType=NONE, fingerprint count=0, lock screen disabled=true
tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
# after (2026-10-06 00:56:38 WIB)   identical: "lock status identical (diff exit 0)"
```

### 6.1 The sitting, as logged

```
-- 00:53:39 the app's sign-in: POST /api/v1/auth/sign-in 200
-- 00:53:48 GATE live_storage_gate: waiting …            -- 00:53:59 GATE live_storage_gate: go
-- 00:54:05 tapped biometric-offer-decline at 541,1444
-- 00:54:09 storage on screen: ring "Evidence storage 20% used, READY"; first activity row "23:59:53, Storage write verified"
-- 00:54:09 texts saying "simulat" on Storage: 0
-- 00:54:15 sheet: "Current: 90 days · auto-archive on" (policy DAYS_90)
-- 00:54:18 tapped storage-manage-retention-YEAR_1 at 541,1271
-- 00:54:21 tapped storage-manage-apply at 541,2194
-- 00:54:22 S2-6 change to YEAR_1: POST /api/v1/storage/policy 200
-- 00:54:27 after the change: first activity row "00:54:21, Storage policy changed · 365 days · auto-archive on"; sheet open: no
-- 00:54:35 tapped storage-manage-retention-DAYS_90 at 541,1177
-- 00:54:38 set back to DAYS_90: POST /api/v1/storage/policy 200 | POST /api/v1/storage/policy 200
-- 00:54:44 after the set back: first activity row "00:54:37, Storage policy changed · 90 days · auto-archive on"
-- 00:54:51 sheet after the set back: "Current: 90 days · auto-archive on"; equal to before: true
-- 00:55:02 network & time on screen: server "192.168.10.1", source "GPS (GNSS Stratum-1)", sync "GNSS / NTP, Synchronized, UTC+07:00. GNSS locked, 10 satellites in view"
-- 00:55:02 texts saying "simulat" on Network & Time: 0
-- 00:55:03 credential/token lines in the JS log (must be 0): 0
-- 00:55:03 demo operations (must be 0): 0; biometric enrolment requests (must be 0): 0
-- 00:55:03 storage or network reads by a screen (must be 0): 0
-- LIVE flow exit: 0
== S. SIMULATED mode (the last launch, D124) ==
-- 00:55:53 GATE simulated_storage_gate: go
-- 00:56:03 storage on screen: ring "Evidence storage 20% used, READY"; first activity row "00:06:40, Storage write verified"
-- 00:56:09 sheet: "Current: 90 days · auto-archive on" (policy DAYS_90)
-- 00:56:20 network & time on screen: server "192.168.10.1", … "GNSS locked, 13 satellites in view"
-- 00:56:21 Core requests in SIMULATED mode (must be 0): 0
-- SIMULATED flow exit: 0
-- prefs after: {"coreLinkSource":"SIMULATED"}
-- remove this row's dump file only: adb shell rm /sdcard/w79.xml
   ls: /sdcard/w79.xml: No such file or directory
device session exit=0
```

Backend requests of the session (`assets/79_device_server_part.log`):

```
      1 GET /api/v1/auth/session 401 principal=device
      1 GET /api/v1/auth/status 200 principal=device
      1 GET /api/v1/health 200 principal=null
      1 GET /api/v1/pairing/device 200 principal=device
      1 POST /api/v1/auth/sign-in 200 principal=device
      1 POST /api/v1/auth/touch 200 principal=operator
      2 POST /api/v1/storage/policy 200 principal=operator
-- error or fatal lines in the backend log: 0
-- bearer/cookie/credential lines in the server log (must be 0): 0
```

Teardown, quoted: `== 00:56:22 4. stop the backend; nothing left` / `lsof exit 1 (1 = none)` / no reverse rule listed.

### 6.2 The screencaps (`assets/79_phone_*.png`, 1080 × 2424)

| File | What it shows |
|---|---|
| `79_phone_live_login.png` | LIVE Login: "Core online", "Core: DEMS-IR-01 • paired as DEV-0001", fields empty |
| `79_phone_live_after_signin.png` | Home after the SUPERVISOR's sign-in ("Core Live" chip, "AP"), the app's biometric offer on top (not dumped) |
| `79_phone_live_storage_gate.png` | The gate: Storage on the Core's data (20 % used, 804 GB, "Sealed Evidence 0" for the Core's day, session SES-20261005-… 0.22 GB) under the biometric offer |
| `79_phone_live_storage.png` | Storage after "Not now": the Core's activity rows ("Storage write verified" of the Core's clock) |
| `79_phone_live_sheet.png` | The sheet: "Current: 90 days · auto-archive on", Apply disabled (no change) |
| `79_phone_live_applied_toast.png` | **S2-6 settled on the Core:** toast "Storage policy updated" (no "simulated"), sheet closed, first row "00:54:21 Storage policy changed · 365 days · …" |
| `79_phone_live_storage_changed.png` | The screen with the Core's new policy row |
| `79_phone_live_sheet_set_back.png` | **Set back:** "Current: 90 days · auto-archive on", as before |
| `79_phone_live_network_time.png` | Network & Time in LIVE: LAN Connected, PoE Active, 11.6 Mbps, GNSS Synchronized, server 192.168.10.1, System Time 00:55:00 (the Core's clock, held to the minute by `motion=off`) |
| `79_phone_simulated_login.png` | SIMULATED Login: "paired (simulated)", "Pair this tablet" |
| `79_phone_simulated_storage_gate.png` | The gate: Storage in SIMULATED under the simulator's biometric offer ("Simulated identity binding") |
| `79_phone_simulated_storage.png` | Storage in SIMULATED (the simulator's dataset; "No session") |
| `79_phone_simulated_sheet.png` | The SIMULATED sheet |
| `79_phone_simulated_network_time.png` | Network & Time in SIMULATED |

## 7. Contract gaps found

**No new gap: no `CONTRACT-GAP-W79-n` was allocated.** Every value the two mobile screens show in LIVE mode comes
from the replica: `storage`, `storagePolicy`, `events`, `session`, `evidence` (Storage; the 8.2 GB/h estimate is the
engine constant the Core runs too, `storage-model.ts:21`), `time`, `network`, `tabletLink` and the Live clock
(Network & Time). The mobile Storage screen shows no SMART values, so the web's CONTRACT-GAP-W71-1 does not reach it.

| Existing gap | Effect here |
|---|---|
| CONTRACT-GAP-5 / [DEC:F64] (the any-of permission's spellings: the example's `ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)`, `packages/shared/src/api/storage.ts:174-181`; the Core's `EVIDENCE_REVIEW_OR_MAINTENANCE`) | `requiredRoleFor` (`apps/mobile/src/runtime/core-errors.ts:91-98`) splits on `\|` only, so the denied toast of S2-6 names no role: AC-C-48 is met in its generic form ("Not permitted"), never with a wrong role — tested for both spellings. W71's one-line normalisation in `rebuild-error.ts:129` (F71-1) would fix web and mobile alike (W83) |

## 8. Findings

| # | Finding | Evidence | For |
|---|---|---|---|
| F79-1 | The `SIM-GAP-M85-2` text ("No role check on `setStoragePolicy`… The simulator itself would still accept the call from anyone") is stale: the simulator now checks EVIDENCE_REVIEW or MAINTENANCE itself. Not edited (KI-07 must stay), same class as W78's F78-3 | `apps/mobile/src/features/storage/sim-adapter.ts:10-14`; `packages/shared/src/sim/maintenance.ts:293` | W83 / W100 close-out |
| F79-2 | In LIVE the legend "Sealed Evidence" counts the Core's items sealed **today** by the Core's clock: 0 at 00:54 although lane 1 sealed items on 2026-10-05. As specified (D61), not a defect; a long-running Core makes it visible (the web's F71-4 class) | `79_phone_live_storage_gate.png` | note |
| F79-3 | Gated device flow: stopping at a screencap before the first dump after a sign-in made it safe to reach a dump-able screen without ever dumping Home or a Summary (the first screen after the sign-in can be either). Cost: about 11 s per gate | §6 | method note for the remaining device rows |
| F79-4 | Lane 1 was taken by W80 at 00:56:32 (`lockf … run_w80.sh`, PIDs 70797 / 70910), ten seconds after this row's teardown; its listeners on 4421 / 8083 at 00:56:38 are W80's, not this row's | `ps` at 00:56:40 | none (stated) |

## 9. Deviations

| # | Deviation | Why / effect |
|---|---|---|
| DV-1 | Two shell commands began with a stray `cd /dev/null 2>/dev/null;` (00:36, the pre-image copy; 00:38, the edit of `storage-screen.tsx` by a script with absolute paths). `/dev/null` is not a directory, so the `cd` failed and changed nothing | Against the letter of "never `cd`"; no state changed; every later command used absolute paths |
| DV-2 | S2-6's wrapper takes continuations (`applied` in `ok`, `settled` in `done`) instead of returning "a possibly asynchronous boolean" ([CS:§8.6] wording) | `usePendingPress` needs its `release` in `done`; the behaviour is the one the row asks for: the sheet closes in `ok`, stays open on a refusal. The callback form is S2-7's and S2-8's (W78) |
| DV-3 | One read-only comparison at about 01:10 tried to write a scratch file under `/tmp`; the sandbox refused it ("operation not permitted"); redone under `$TMPDIR` | Nothing written outside the allowed paths |
| DV-4 | The device check signed in the SUPERVISOR in both modes; the INVESTIGATOR's S5-3 hint and the Core's 403 were not provoked on the device | The brief asks for a role that may change the policy; S5-3 and both 403 spellings are covered by jest (§4.1) |
| DV-5 | The Network & Time Live test imports the Storage folder's bed (`@/features/storage/testing/live-storage-bed`) | One bed mounts both route files on one Core; both folders are this row's; no production import |
| DV-6 | The sheet can be closed by the operator (X, swipe) while a policy change is out | A gesture-closable sheet cannot be held reliably; the press state lives outside the portal, so a reopened sheet shows Apply still busy, and the result toast shows either way (DN-1) |

## 10. Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| DN-1 | S2-6 follows [CS:§8.6]: the sheet closes in `ok` and stays open with the draft on a refusal (not S3-1's "closes in `done`" of the D166 example); the operator may close it while the command is out (DV-6) | Keep |
| DN-2 | The LIVE toast uses `features.storage.live.applied` (mobile) while W71's shared `storage.manage.live.applied` is uncommitted | Keep; one shared key for both clients in W83 (with D164 DN-5) |
| DN-3 | F64 / CONTRACT-GAP-5: S2-6's denied toast names no role until W83 maps the any-of label | Keep the generic denial (the default of F64); W83 takes W71's normalisation |
| DN-4 | F79-1 (stale `SIM-GAP-M85-2` text) | Route to the close-out with F78-3 |
| DN-5 | Ledger `@dems/mobile` +3 suites / +35 tests (W79) | Record |

## 11. Error handling and logging

Every path of S2-6 writes the persistent runtime log (`reportRuntimeIssue`, `dems.mobile.log.v1`, privacy-filtered by
key name), source `storage.manage.apply`, correlation ID `<launch>/storage-policy-<n>`: `info` on success, `warn` for a
refusal the presenter showed (a 403, an outage, a dead link, a 429), `error` for anything else (the Core's 422, an
unexpected error). Context holds the draft only (`retentionPolicy`, `autoArchive`): no credential, no operator data.
User feedback: the presenter's toast in LIVE, the screen's own toast otherwise. Graceful degradation: Apply returns to
idle, the sheet keeps the draft, and the panels keep the Core's last data through an outage; the panel boundaries
(`panel-boundary.tsx`, `card-boundary.tsx`) are unchanged.

## 12. State left on the device and its lane

| What | State |
|---|---|
| Phone app | Last launch `core=SIMULATED`; prefs read back `{"coreLinkSource":"SIMULATED"}`; signed in to the simulator as the SUPERVISOR when `device-session.sh` force-stopped the app at the end. Biometric offer declined twice ("Not now"), never "Enable"; no `setBiometricEnrollment` request. The dump file `/sdcard/w79.xml` removed (`No such file or directory`); nothing else on the phone touched |
| Pairing | Untouched: DEV-0001 on `dems_lane_1` (`paired_devices 1`, `device_credentials 1` before and after); nothing unpaired, no lane reset |
| Storage policy on `dems_lane_1` | Changed once and **SET BACK**: `DAYS_90` (90 days, auto-archive on) → `YEAR_1` (365 days, on) at 00:54:21 → `DAYS_90` (90 days, on) at 00:54:37. Before and after, the sheet read "Current: 90 days · auto-archive on"; the set-back row reads "Storage policy changed · 90 days · auto-archive on". Both `STORAGE_POLICY_CHANGED` rows stay (the trail is append-only) |
| `dems_lane_1` counts | `audit_log` 169 → 175, `events` 163 → 172 (the sign-in's rows and the two policy changes; not itemised further); `storage_policy` 1 row before and after |
| Ports, rules | 4421 and 8083 without listener and no reverse rule at 00:56:22; `.locks/core-server.lane1.pid` emptied. W80 took lane 1 at 00:56:32 — not touched |
| Locks / security | Lock status identical before and after; no PIN, fingerprint, keyguard, system prompt or device setting touched |
| Not touched | Port 5432, 5173-5175, 4400, lane 2, lane 3, the tablet, `dems2_phone2` |

## 13. Rollback (R-CO; not executed)

```sh
git checkout acaff20 -- apps/mobile/src/features/storage/storage-screen.tsx \
  apps/mobile/src/features/storage/manage-storage-sheet.tsx apps/mobile/src/features/storage/i18n.ts
rm -f apps/mobile/src/features/storage/live-storage-sites.test.tsx apps/mobile/src/features/storage/storage-live-static.test.ts \
  apps/mobile/src/features/storage/testing/live-storage-bed.tsx apps/mobile/src/features/storage/testing/storage-test-setup.ts \
  apps/mobile/src/features/network-time/live-network-time.test.tsx
rmdir apps/mobile/src/features/storage/testing
```

Both folders equalled `acaff20` before this row (`.cache/rollback/W79/diff_vs_acaff20_before.txt` is empty); the three
edited files' pre-images have the `acaff20` blobs (`i18n.ts` `40beb46b`, `manage-storage-sheet.tsx` `2370b0d5`,
`storage-screen.tsx` `babe48ab`); pre-images and `pre.sha256` / `post.sha256` are in `.cache/rollback/W79/`. The lane's
audit rows are not rolled back (append-only); the policy itself is already back.

## 14. Files of this row

| File | Change |
|---|---|
| `apps/mobile/src/features/storage/storage-screen.tsx` | modified (S2-6) |
| `apps/mobile/src/features/storage/manage-storage-sheet.tsx` | modified (LB-1, S2-6 continuations, S5-3 note) |
| `apps/mobile/src/features/storage/i18n.ts` | modified, additive (`live.applied`) |
| `apps/mobile/src/features/storage/testing/live-storage-bed.tsx` | new (test bed) |
| `apps/mobile/src/features/storage/testing/storage-test-setup.ts` | new (test setup) |
| `apps/mobile/src/features/storage/live-storage-sites.test.tsx` | new (15 tests) |
| `apps/mobile/src/features/storage/storage-live-static.test.ts` | new (11 tests) |
| `apps/mobile/src/features/network-time/live-network-time.test.tsx` | new (9 tests) |
| `docs/…/implementation/79_mobile_storage_network_time.md` | this file |
| `docs/…/implementation/assets/79_*` | 14 screencaps; `79_device_run.log`, `79_device_server_part.log`, `79_run_w79.sh.txt`, `79_device_w79.sh.txt`, `79_flow_w79.mts.txt`, `79_lock_status_before.txt`, `79_lock_status_after.txt`, `79_gate.log`, `79_clg_a_c.log`, `79_live_tests_verbose.txt`, `79_mutations.log`, `79_mutate.py.txt`, `79_mutating_transformer.cjs.txt`, `79_jest_mut_config.cjs.txt` |
| `docs/…/delegation_progress/coder_execution_step_101.md` | progress file |

---
*Generated: 2026-10-06 01:13 WIB*
