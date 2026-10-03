---
task_id: 2026-09-30_dems_demo_stack_setup
step: 76
plan_row: 05_mobile_plan §3 M-07 (part b)
date: 2026-10-01
agent: coder-execution
lane: mobile, Metro 8082 (brief)
tier: 3
verification: FAST LANE (D75)
status: complete (notes S76-1..S76-10; no SIM-GAP)
decisions: D17, D55, D58, D66, D73, D75, D78
---

# Step 76: mobile Pairing screen (`/pair`), M-07 part b

**Outcome: PASS on the fast-lane checks.**

| Check (row 76, reduced by D75) | Result | Evidence |
|---|---|---|
| pair(code) and unpair() change the pairing state and emit audit rows | **PASS** | `pairing-screen.test.tsx`: PAIRING_SUCCESS +1 row (no code in the row), PAIRING_FAILED ×2 + 3rd → lockout, UNPAIRED +1 row with actor OPR-001; on device: rows #238 UNPAIRED, #239 PAIRING_FAILED, #240 PAIRING_SUCCESS |
| Own jest tests | **PASS** | `npx jest src/features/pairing --maxWorkers=2` → `Test Suites: 2 passed, 2 total`, `Tests: 15 passed, 15 total` (09:42, again 09:44) |
| Mobile lint | **exit 0** | `npm run lint -w @dems/mobile` exit 0 (09:42 and 09:44, whole app); `npx eslint src/features/pairing` exit 0 |
| Mobile typecheck | **exit 0** (09:43, whole app) | `npm run typecheck -w @dems/mobile` exit 0. Earlier runs (09:33, 09:42) failed only on files that concurrent steps were editing (`storage/capacity-ring.tsx`, `settings/settings-prefs.ts`, `audit/audit-model.test.ts`; P11), never on a pairing file |
| ONE phone-portrait device check | **PASS** | dems_phone (emulator-5554), session 09:37–09:41 via `device-session.sh`, Metro 8082; screencaps below |
| Screencaps on both AVDs | **deferred** (D75: tablet layouts move to the end pass, steps 57/59) | jest covers the expanded two-pane layout |

Written in the app: only `apps/mobile/src/features/pairing/**`. No `packages/shared/**`, route file, `package.json`, jest config or npm install. Nothing committed.

## 1. Files (`apps/mobile/src/features/pairing/`)

| File | Content |
|---|---|
| `pairing-screen.tsx` | `PairingScreen()` (export + `SafeScreen id="pair"` kept): topographic canvas, header (back, "Pair this tablet", §20.1 subtitle), `KeyboardAwareScrollView`, `PaneLayout` `pane-connection` \| `pane-code` (stacked on compact, side by side from compact-landscape up; code pane 440 dp on expanded), Unpair dialog mounted on demand, unpair toast |
| `pairing-connection.tsx` | "Core connection" `SectionCard`: C-1 GlowRing (`mini` 88 dp phone, `hero` 240 dp tablet) around Link2Off / Radar / ShieldCheck / Lock, one success pulse (`animatePulseOnce`, `totalMs` passed, F74-02); live status line (cross-fade); C-4 Stepper Discover → Verify code → Paired (horizontal phone, vertical with descriptions on tablet); Core identity `KeyValueList` (device mono, room, paired at, last PAIRING audit row); certificate fingerprint in mono (2 lines) + SIMULATED chip; error boundary around the Skia ring |
| `pairing-code-panel.tsx` | Kit `InputOTP` 6 digits (3 + 3, `REGEXP_ONLY_DIGITS`, numeric keypad, submit key pairs); Alert danger "Code not accepted" + attempts left, Alert warning "Pairing locked" + C-6 countdown; Pair (primary, Spinner "Pairing…") + Cancel (outline); PAIRED panel: success chip, Continue to sign-in / Done, "Returning automatically…", Unpair (`danger-soft`) |
| `use-pairing-flow.ts` | Controller: code (memory only), attempt, outcome; phase from the simulator clock; commit and hand-off as store subscriptions (no `setTimeout`, D58/F74-09); `pair` / `cancel` / `leave` / `unpair`; errors → `reportRuntimeIssue` (persistent runtime log) |
| `pairing-model.ts` | Pure: `PAIR_TIMELINE` (verify 900, commit 1,800, hand-off 2,400 sim ms), phases, view, C-4 statuses, ring state, state chip, flat selectors (F74-13), lockout seconds, fingerprint lines, leave target |
| `unpair-dialog.tsx` | Kit `Dialog` (callbacks only; portalled above the simulator provider) |
| `use-dialog-presence.ts` | Local copy of step 79's mount-on-demand pattern (`use-sheet-presence.tsx`) for the Dialog |
| `i18n.ts` | `features.pairing.*`; shared copy reused: `mobile.pairing.*`, `common.pairingState.*`, `common.auditType.*`, `login.errors.attemptsRemaining`, `login.errors.lockedBody` (F74-16) |
| `pairing-model.test.ts` | 7 tests: phases, outcomes, view precedence, statuses / ring / chip, lockout rounding, selectors against the real simulator (3 failures → 60 s, countdown 60 → 30 → 0), fingerprint, leave target |
| `pairing-screen.test.tsx` | 8 tests (real `AppProviders`, injected sim, manual clock): unpaired render + no demo code + 6-digit gate; success path with steps on the sim clock, nothing committed before Verify ends, PAIRING_SUCCESS, haptic, hand-off `back()`; deep link → `replace('/')` + keypad submit; 3 wrong codes → lockout 60 → 30 → 0 → pair; Cancel mid-flight commits nothing; Unpair Dialog (keep / confirm, UNPAIRED row); tablet two panes; idle ticks stable; `getMissingKeys()` empty |

## 2. Device check (dems_phone, 1080×2424, 09:37–09:41 WIB)

Launch: `adb shell 'am start -W -a android.intent.action.VIEW -d "demsdemo:///pair" com.dems.demo.tablet'` (helper force-stopped the app first; bundle 6,018 modules).

| Screencap | Shows |
|---|---|
| `assets/mobile/76_dems_phone_probe.png` | Arrival while PAIRED (the default, S73-16): green ring shield, 3 checks, identity, fingerprint, Continue to sign-in, Unpair |
| `76_dems_phone_unpair_dialog.png` | Unpair Dialog (Keep paired / Unpair) |
| `76_dems_phone_unpaired.png` | After Unpair: toast "Tablet unpaired", "Not paired" chip, amber ring, step 1 active, audit "#238 Tablet unpaired · 09:38:12", empty code slots, Pair disabled |
| `76_dems_phone_wrong_b.png` | In flight: Radar icon, Discover spinner, Verify badge fading in (remount stagger), "Pairing…" spinner |
| `76_dems_phone_wrong_code.png` | 111111 rejected: Discover ✓, Verify error, audit "#239 Pairing failed", Alert "Code not accepted / 2 attempts remaining", red slots, code cleared |
| `76_dems_phone_code_keyboard.png` | 482913 typed, numeric keypad up, Pair visible above the keyboard (S76-10) |
| `76_dems_phone_pairing_steps.png` | Submitted with the keypad ✓: Discover running, "Pairing…" |
| `76_dems_phone_paired.png` | PAIRED: 3 checks, "Paired at 1 Oct 2026 09:40:22", audit "#240 Tablet paired · 09:40:22", "Returning automatically…" |
| `76_dems_phone_handoff_login.png` | 2.4 s later: hand-off via the boot router to Login (no screen underneath after a cold deep link), trust line "Core: DEMS-IR-01 • paired (simulated)" |

The simulator on the phone is left PAIRED (its default). Lane clean-up: helper "Metro 70373 stopped", "session ended with status 0"; 8082 not listening afterwards. No emulator was killed, rebooted or snapshot-restored (D78).

## 3. Notes and decisions (for the controller)

| # | Kind | Item |
|---|---|---|
| S76-1 | interpretation | Step labels stay `mobile.pairing.steps` (Discover → Verify code → Paired, §4.2); the brief's "verify certificate (DEMO)" is carried by the status line and the tablet step description "Check the code and the Core certificate (DEMO)" |
| S76-2 | decision | The code reaches `pair(code)` only when the Verify step ends (1.8 s, simulator clock). Cancel or Back before that writes no audit row (tested) |
| S76-3 | decision | Success hand-off 2.4 s after PAIRED (simulator clock) plus an explicit Continue to sign-in / Done: `router.back()` when a screen is underneath (Login, Settings), else `router.replace('/')` so the step-70 boot router applies the §3.3 guard (→ `/login` signed out). Arriving already paired never auto-leaves |
| S76-4 | finding → step 91 (C-4 owner) | Stepper remounted per status change (step 78 S78-7 workaround); glyphs render correctly on the device, but Reanimated still logs `synchronouslyUpdateUIProps failed` (W level) at each transition (09:38:31, 09:39:20–21, 09:40:22–23, 09:40:27 during the route change) |
| S76-5 | interpretation | Haptics: success → `pairingSuccess`; invalid code → `signInFailure` (§7.6 row 7, the map has no pairing-failure event); lockout → `lockout` |
| S76-6 | addition | Identity shows the newest PAIRING audit row (`#seq event · time`) so each pair/unpair visibly lands in the audit chain |
| S76-7 | layout | Two panes from compact-landscape up; hero ring + vertical stepper with descriptions on medium/expanded. Tablet/landscape not device-checked (D75 → end pass 57/59) |
| S76-8 | tooling note → step 57 | `adb shell input text 111111` registered only 2 of 6 digits in the OTP field; per-digit input (0.4 s apart) works. Maestro `inputText` may need the same care |
| S76-9 | P11 | Jest prints "A worker process has failed to exit gracefully" for these suites; the step-77 dashboard suites print the same in the same harness (pre-existing, `AppProviders` timers); no open handle reported with `--runInBand --detectOpenHandles` |
| S76-10 | fix during the device check | Phones: `KeyboardAwareScrollView bottomOffset` 112 dp so Pair stays above the keypad, and the keypad submit key pairs (`returnKeyType: 'go'`) |

**SIM-GAP: none.** `pair(code)`, `unpair()`, the lockout and the audit rows come from the shared simulator (`packages/shared/src/sim/pairing.ts`); no `sim-adapter.ts`.

**Process note:** at 09:37 one of my shell commands wrote a stray 50-byte file `apps/mobile/.s76_tmp` (a temp-path echo); I deleted it at once (09:37). No other path outside the owned folder was written.
