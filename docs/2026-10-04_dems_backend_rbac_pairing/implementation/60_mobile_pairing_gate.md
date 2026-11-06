---
task_id: W60
task_slug: mobile-pairing-gate
blueprint_step: 82
date: 2026-10-05
agent: coder-execution-local
status: complete
gate: CLG (client row; SG not applicable — no shared/ or mock-core/ file touched)
rollback_class: R-CO
pre_image: .cache/rollback/W60.pre.patch (empty — the owned paths were byte-identical to acaff20 at the start)
---

# W60 — the mobile pairing gate

The gate that holds an **unpaired device on `/pair`** in LIVE mode, releases into Login once the
device is paired, and returns to `/pair` when the pairing is revoked. Simulated-mode behaviour is
byte-identical and its tests are unchanged.

## 1. Sources cited

| Source | Used for |
|---|---|
| `masterplan/04_client_integration_spec.md` §9.4 MP-11, MP-12, §6.6 | the gate rule per route, the pending link, the return on revocation |
| `masterplan/04_client_integration_spec.md` AC-C-31, AC-C-50, AC-C-73, AC-C-74, AC-C-78, AC-C-79 | the acceptance cells this row closes |
| `masterplan/02_plan.md` §8.1 (gates SG/CLG, rollback classes), §8.4 row W60 | the verification cell, the owned paths, R-CO |
| `identification/02_structured.md` P3/P4/P7/P9/P10/P11/P19/P23 | emulators/lanes, stop-what-you-start, load guard, sandbox, noise, secrets, pre-image |
| `implementation/51_mobile_runtime.md` §3.3, §4 (`usePairing`, `isPairingBlocked`, `required`) | the gate predicate and where it is read |
| `implementation/56_mobile_sign_in.md` §11 | the seams into this brief (auth is false after every session end; TOKEN_REUSE stays PAIRED) |
| `implementation/57_mobile_pairing_flow.md` §9 (seams table), §8 | the hand-off (`replace('/')` after pairing), the notice ownership, what the tablet left behind |
| `decisions/decisions.md` D124, D129, D137 (DN-6, DN-7), D138, D141 | runtime/sign-in/gating decisions; **D138 transfers the paired-device LIVE sign-in evidence to this row** |

## 2. What was built

Two source files, both inside the owned write paths. No other file under `apps/mobile/src/**` was
touched; `app/_layout.tsx` and `app/(app)/_layout.tsx` needed no change (the `(app)` group is guarded
at the root stack by name, so its own layout is untouched).

### 2.1 `apps/mobile/src/navigation/root-navigator.tsx`

The gate reads the runtime's own value — `blocked = isPairingBlocked(usePairing())` — never a copy of
it (MP-11). `isPairingBlocked(pairing)` is `pairing.required && pairing.state !== 'PAIRED'`; `required`
is true only in LIVE mode, so in SIMULATED / HEARTBEAT `blocked` is always false and every guard behaves
exactly as before (AC-C-74).

Guard changes (the `blocked` rule in the root stack):

| Route | Guard before | Guard after (MP-11) |
|---|---|---|
| `(auth)` group (`/login`) | `!isAuthenticated` | `!isAuthenticated && !blocked` |
| `(app)` group (`/home`, …) | `isAuthenticated` | `isAuthenticated && !blocked` |
| `dev-gallery` | (unlisted → always reachable) | `<Stack.Protected guard={!blocked}>` |
| `index`, `stack-check`, `pair` | unguarded | unguarded (unchanged) |

Boot route (`useBootHref`): returns `/pair` **first** while blocked, else the previous order
(`/login` signed out; resync → pending href → `/home` signed in). While blocked the pending href is
neither read nor dropped.

### 2.2 The pending link (MP-12) — unchanged mechanism

`navigation/pending-href.ts` was **not** edited. A guarded deep link that arrives while blocked is
recorded as the pending href exactly as today; because `/login` is itself guarded out while blocked,
the returned `/login` falls through the anchor `/` to the boot router, which opens `/pair`. The link
survives (it is cleared only on a sign-out transition) and is consumed after both the pairing and the
sign-in. This matches "kept as the pending href, as today".

### 2.3 The return on revocation (§6.6, AC-C-78/79) — no new code

A revocation sets the gate UNPAIRED (with the `revoked` notice) and signs the operator out. Both groups
are then guarded out, the active screen falls back to `/`, and the boot router opens `/pair`. The notice
belongs to the Pair screen (`usePairing().notice`, built by W57); this row only routes. An unknown
credential (401 on operation 21) behaves identically with the `unknown` notice.

### 2.4 `apps/mobile/src/navigation/testing/router-harness.tsx` (test harness, additive)

`FakeRuntime` gained an optional `pairing: PairingInfo` (default `undefined` = no gate member, i.e.
SIMULATED/HEARTBEAT) and a `setPairing()` setter, threaded through `createRuntimeContract`. Existing
constructor calls are unaffected, so the five existing navigation test files behave identically.

## 3. State table (what the route tree does per gate state)

| Mode / gate | signed-in | boot `/` | `/login` | `/home` | `/dev-gallery` | `/stack-check` | `/pair` |
|---|---|---|---|---|---|---|---|
| SIMULATED / HEARTBEAT (no `pairing`) | any | as before | reachable | reachable | reachable | reachable | reachable |
| LIVE, CHECKING / UNPAIRED / REVOKED / UNKNOWN (`blocked`) | any | `/pair` | → `/pair` | → `/pair` | → `/pair` | reachable | reachable |
| LIVE, PAIRED | no | `/login` | reachable | → `/login` | reachable | reachable | reachable (paired view) |
| LIVE, PAIRED | yes | resync/pending/`/home` | removed | reachable | reachable | reachable | reachable |

## 4. The Live tests (on the fake transport)

New files (both under `apps/mobile/src/navigation/__tests__/`, inside the owned path):

- **`pairing-gate.test.tsx` — 19 tests.** Route-level matrix over the real route tree: unpaired boots
  to `/pair`; `/login`, `/home`, `/dev-gallery` unreachable; `/stack-check` reachable; CHECKING counts
  as blocked; the `revoked`/`unknown` notices still block; a guarded deep link stays pending and opens
  after pair+sign-in; a sign-out drops it; pairing releases into `/login` and `/home`; `/pair` stays
  open on a paired device; a revocation and an unknown credential route back to `/pair`; the `(app)`
  block term removes the app screens even while the session still reads signed-in; and the gate is inert
  outside LIVE (AC-C-74).
- **`pairing-gate-live.test.tsx` — 4 tests.** Builds the app's real Live source (`createMobileLive`) over
  `createFakeTransport`, lets MP-10 settle against a scripted Core, and feeds the resulting
  `getPairing()` into the route tree: no credential → UNPAIRED → `/pair`; a confirmed credential →
  PAIRED → `/login`; `DEVICE_REVOKED` (socket close 4403) → UNPAIRED `revoked` → `/pair`; an unknown
  credential (401, items deleted) → UNPAIRED `unknown` → `/pair`. These prove the gate values come from
  the Core's answers, not from a test-set flag.

## 5. Verification (the plan row's cell, quoted)

> `npm run test -w @dems/mobile -- --maxWorkers=2` exits 0 with the existing guard tests unchanged; Live
> route tests cover unpaired (boot route `/pair`; `/login`, `/home`, `/dev-gallery` not reachable;
> `/stack-check` reachable), paired and revoked; one device check shows the gate and its release after
> pairing (two screencaps).

| Check | Result |
|---|---|
| `npm run test -w @dems/mobile -- --maxWorkers=2` | **exit 0 — 94 suites / 1,230 tests passed** (ledger floor 1,207 / 92 after W57+W59; **+23 tests in +2 files**) |
| Existing guard tests unchanged | `guard/chrome/routes/navigation-units/back-guard` absent from `git diff --stat acaff20`; `guard.test.tsx` hash still `df66f10…` |
| `npm run typecheck -w @dems/mobile` | exit 0 |
| `npm run lint -w @dems/mobile` | exit 0 (no findings) |
| Mutation check (M15, out-of-tree) | see §6 |
| Device check | see §7 |

## 6. Mutation check (rule M15, run outside the source tree)

`implementation/assets/60_mutate.py` applies single textual mutations to the gate logic in
`root-navigator.tsx`, runs the two gate test files against each, and restores the file. Result:

```
G01 DETECTED  (auth) guard drops the block term
G02 DETECTED  (app) guard drops the block term
G03 DETECTED  dev-gallery guard always open
G04 DETECTED  blocked forced false (gate inert)
G05 DETECTED  boot router no longer returns /pair first
G06 SURVIVED  boot router checks auth before the block   ← equivalent by case analysis
G07 DETECTED  (auth) guard uses OR instead of AND
G08 DETECTED  (app) guard ignores block via negation slip
7 detected, 1 survived (G06), of 8; tree before == tree after (sha 831a5230d6cf6b2e…)
```

G06 is provably equivalent: for every reachable state (blocked & signed-out, not-blocked & signed-out,
blocked & signed-in) the reordered boot router yields the same target as the original, so no test can
distinguish it. It is excluded from the detection requirement in the script. G02/G08 were initially
survivors until the "block alone removes the app screens" test was added (§4).

## 7. The device check (lane 1, `dems2_phone` / emulator-5554)

Run inside `/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock`, device commands inside
`DEMS_CORE_HOST_PORT=4421 METRO_PORT=8083 apps/mobile/scripts/device-session.sh phone '…'`. Standard
lane reset of `dems_lane_1` at the start only. `dems_lane_2` was never touched (still `paired_devices 1`,
`device_credentials 1` — D137 DN-6). Scripts staged under `assets/60_*`.

The phone carried the user's PIN and one enrolled fingerprint; the keyguard, the fingerprint sensor and
every security setting were left alone. `device-session.sh` reported `screen awake, no keyguard` and
`RUNNING_UNLOCKED` throughout (never exit 77). The biometric-enable dialog that Home shows after sign-in
was **not** pressed.

Two successful sessions (the gate + pairing + release in session A; the LIVE sign-in in session F):

| Step | Evidence (from `assets/60_device_run_pair.log`, `60_device_run_signin.log`) | Screencap |
|---|---|---|
| Unpaired, LIVE, cold start `demsdemo:///pair?core=LIVE` | `runtime.live.ready`; prefs `{"coreLinkSource":"LIVE"}`; the Pair screen with chip "Not paired", empty code slots, LIVE chip | `60_phone_unpaired_live_pair.png` |
| Try `/login` while blocked `demsdemo:///login?core=LIVE` | lands back on `/pair` (the gate holds it) | `60_phone_unpaired_login_blocked.png` |
| Pair with a code issued by the lane-1 backend | SUPERVISOR sign-in 200 → `issuePairingCode` 201 → typed into the app → app redeem **201** (req `89de2537…`) → registry `state PAIRED … DEV-0001`, `devices in the registry: 1` | — |
| Gate releases into Login | the Login screen with the LIVE trust line "Core: DEMS-IR-01 • paired as DEV-0001", "Core online" | `60_phone_released_login_live.png` |
| Paired Pair view (`demsdemo:///pair?core=LIVE`) | "Paired with DEMS-IR-01 as DEV-0001", all steps done, "Continue to sign-in" | `60_phone_paired_pair_view.png` |
| **Sign in there in LIVE mode (D138)** | `POST /api/v1/auth/sign-in 200` (req `e8753cbf…`), principal=device; reached Home | `60_phone_signed_in_home_live.png` |
| Leave as found | force-stop, relaunch `demsdemo:///?core=SIMULATED`; prefs `{"coreLinkSource":"SIMULATED"}`; secure-store entry `key_v1-dems.live.device.v1` still listed; 0 Core requests after the SIMULATED relaunch | — |

Secret handling (P19 / SD-23): the issued code was counted **0** in the device JS log, the whole device
log, AsyncStorage values, the backend log and this check's output files; `dvc_`/`ses_`/`bio_` lines 0 in
both logs; bearer/cookie/credential lines in the server log 0. The demo password was read from the shared
dataset constant and typed via a single keystroke call; it appears in no log, script or document.

Afterwards: backend stopped (`shutdown complete`), no listener on 4421/8083/5176, no reverse rule on
emulator-5554, `.locks/core-server.lane1.pid` emptied (0 bytes), app not running, lock unchanged
(`CredentialType: PIN`, `fingerprint count: 1`, `isKeyguardShowing=false`). `dems_lane_1` now holds one
paired device (DEV-0001) — expected for lane 1; `dems_lane_2` untouched.

## 8. Findings

- **F-1 — uiautomator cannot dump these screens.** `uiautomator dump` (plain and `--compressed`) returns
  an empty tree on the animated Login/Pair screens (continuous Reanimated frames never let the window
  reach idle). The field centres were therefore taken from pixel analysis of the captured PNG (Username
  ≈ y1105, Password ≈ y1265, Sign In ≈ y1430 on the 1080×2424 phone portrait), confirmed against the
  rendered screen. Not a product defect; noted for future device rows.
- **F-2 — the emulator's handwriting coach steals the first field's focus.** Gboard's one-time "Try out
  your stylus" overlay captured injected text on the first Login-field tap. Dismissing it by tapping its
  Cancel button (a no-op when absent) fixed the sign-in; `KEYCODE_BACK` must NOT be used (it leaves the
  app). Environment quirk, not a product defect.
- **F-3 — the gate is fully driven by the runtime value.** No navigation code re-derives `required` or
  inspects the credential; it consumes `usePairing()`. This keeps the gate honest across modes.

## 9. Deviations

- **DV-1 — the LIVE sign-in needed a second device session.** The plan cell asks for "one device check";
  the gate block, the pairing and the release were captured in session A, but the D138-transferred LIVE
  sign-in could not be completed in that session because of F-1/F-2 (an environment issue). It was
  completed in a follow-up session on the already-paired phone (no re-pair, no lane reset). Total device
  sessions on the phone: A (pair+release), B/C/D/E (diagnosing F-1/F-2), F (sign-in). All cleaned up.
- **DV-2 — `app/_layout.tsx` and `app/(app)/_layout.tsx` were not edited.** They are in the allowed write
  paths but needed no change; the gate lives entirely in the root stack.

## 10. Decisions for the controller (DN)

- **DN-1 — accept the split device evidence.** The gate block + pairing + release are shown in session A;
  the D138 LIVE sign-in (Home reached on the paired phone) in session F. If the controller requires them
  in a single continuous session, say so and this row will re-run A→F as one session.
- **DN-2 — leave `dems_lane_1` paired.** The phone is now paired with `dems_lane_1` (DEV-0001). Per §5.2
  an emulator pairs once per lane and the credential survives resets, so this is the intended resting
  state; do not unpair unless a later row needs an unpaired lane-1 phone (W94 uses the reserved
  `dems_phone2`, which stays unpaired).
- **DN-3 — ledger.** `@dems/mobile` moves from 1,207/92 to **1,230/94** (+23 tests, +2 files). No existing
  test changed.

## 11. Rollback (R-CO)

Revert the two source files and delete the two new test files:

```sh
git checkout acaff20 -- apps/mobile/src/navigation/root-navigator.tsx \
  apps/mobile/src/navigation/testing/router-harness.tsx
rm -f apps/mobile/src/navigation/__tests__/pairing-gate.test.tsx \
      apps/mobile/src/navigation/__tests__/pairing-gate-live.test.tsx
```

No migration, no config, no other file to touch. The pre-image (`.cache/rollback/W60.pre.patch`) is empty
because the owned paths were at acaff20 before this row.

---
*Generated: 2026-10-05*
