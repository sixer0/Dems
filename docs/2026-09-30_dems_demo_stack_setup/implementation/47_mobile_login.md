---
task_id: 2026-09-30_dems_demo_stack_setup
step: 75
plan_row: 05_mobile_plan §3 M-07 (login part)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete (fast lane, D75; tablet re-checks moved to the end pass)
---

# Step 75: Mobile Login with biometric sign-in (M-07, part a)

**Outcome: PASS on the fast lane (D75).** The tablet re-checks after the emulator incident (§6) move to the end pass.

| Row-75 check | Result | Evidence |
|---|---|---|
| T-M04 passes (MA-06) | **PASS** | `src/features/login/login.test.tsx`: 19/19 tests. `login-model.test.ts`: 18/18 tests (§3.1) |
| MA-06 on a device | **PASS** (phone) | 5 wrong passwords → "Too many attempts / Try again in 00:33". Sign In is disabled. The countdown went 53 s → 34 s between two dumps, and the lock cleared at ≈ 60 s. Audit row: `AUTH_FAILED … attemptsRemaining 0, lockedUntil …` (§3.3) |
| MA-07 on both AVDs after enrolment | **PASS on both** | Phone, 07:07: fingerprint → `screen-home`, audit `AUTH_SUCCESS {method: BIOMETRIC}`. Tablet, 05:49 (before the incident): same result. The tablet re-run is moved to the end pass (D75) |
| H-MB-04 enrolment | **PASS on both** | `locksettings set-pin 1234` worked on both AVDs, and 3 touches gave "Fingerprint added" (§5). No fallback was needed, so no button was hidden |
| MA-15, login part | **PASS** (phone) | `demsdemo:///login?motion=slow` cold start: the 1.0 s and 8.0 s frames differ by **14.83 %**, bbox (0,0)–(1080,2230). The tablet run is moved to the end pass |
| Compact and expanded screencaps on both AVDs | **Met, with one gap** | Phone: portrait (compact) and landscape (compact-landscape). Tablet: landscape (expanded), 05:41. Tablet portrait (medium) is moved to the end pass; jest covers it (§3.1 layouts) |
| Mobile typecheck, lint, jest | **typecheck exit 0, lint exit 0** (09:16); **own suites pass** | Full jest: 10 failures, all in step 70's `routes` and `guard` stub assertions for screens that steps 78, 80 and 83 replaced (P11, F-75-2) |

## 1. Files

### 1.1 Owned paths (P6)

All files below are under `apps/mobile/src/features/login/`.

| File | Change | Role |
|---|---|---|
| `login-screen.tsx` | replaced the step-70 stub | `LoginScreen()`, root `SafeScreen id="login"`, with the four §2.4 layouts. It mounts the backdrop and the gold dust, and wires the choreography, the controller and the ambient loops |
| `login-brand.tsx` | new | L2 GlowRing (`login` mode), the Skia `EmblemDraw` (M-APP-03 stroke order; scan while a sign-in is pending), and L3 wordmark + caption |
| `login-card.tsx` | new | L9 Alert, L4/L5 fields, L6 Sign In, L7 fingerprint, L10 demo operators, L11 trust line, L8 version. Also the M-C-22 motions: shake, shackle, unlock pulse, eye toggle, border beam |
| `login-ambient.tsx` + `login-ambient.math.ts` | new | Gold dust: Skia `Points`, ≤ 24 points, 3 layers, seeded, seamless loop. Border beam: one lap of 6 s |
| `login-model.ts` | new | Pure logic: zod schema, ring tone, Core chip, notice priority, Alert status, the biometric button rule, Core address, ring sizes |
| `use-login-controller.ts` | new | Form state (react-hook-form), password and biometric sign-in, haptics, the Core retry (rate-limited), persistent error logging |
| `use-login-choreography.ts` | new | M-PG-LOGIN `enter`, M-APP-02 `return`, shake, the M-APP-01 card exit, proof-mode and reduced-motion handling |
| `presentation-mode.ts` | new | Read-only reader of `dems.mobile.prefs.v1`.`presentationMode`. It fails closed |
| `i18n.ts` | filled (it was `{}`) | `features.login.*`: only copy that no shared or `mobile.*` key already has |
| `login.test.tsx` | new | T-M04, run through the real route tree, the real guard and the real simulator auth on a manual clock |
| `login-model.test.ts` | new | The state table and the ambient maths |

### 1.2 Hand-overs D69 (controller)

| Path | Change |
|---|---|
| `apps/mobile/jest.config.js` | Added `standard-navigation` to the `transformIgnorePatterns` allowlist (one token plus a comment). A probe proves it: `require('expo-router')` loads without a mock. The same probe with the old pattern fails with "Jest failed to parse a file" |
| `src/navigation/screen-stub.tsx` | Removed `StubSignIn` and its now-unused imports and styles (−43 lines). `ScreenStub` is unchanged |
| `src/navigation/index.ts` | Removed `StubSignIn` from the barrel export |
| `src/navigation/i18n.ts` | Removed `stub.signIn` and `stub.signInHint` |
| `src/navigation/__tests__/guard.test.tsx` | The one case that pressed `stub-sign-in` now signs in through the real Login form. It has the same assertion: the pending href is `/devices` |

The placeholder sign-in did not live in the login stub itself: it was defined in `screen-stub.tsx`. Removing it therefore touched these four step-70 files, and only these lines. The step-70 originals are backed up in scratchpad `s75/`.

### 1.3 Not written, and no installs

- Not written: `packages/shared/**`, `src/app/**`, any `package.json` or lockfile, `src/runtime/**`, `src/auth/**`, `README.md`.
- No `npm install`. No Gradle run.
- Nothing was committed.

## 2. Behaviour (04 §4.1, §6)

### 2.1 States (§6.2)

**Idle.** The full layout renders.

**Validating.** Field errors come from the zod schema: "Enter your username." and "Enter your password.".

**Submitting.** Sign In shows a `Spinner` and "Signing in…", and the emblem arcs pulse in sequence.

**Error.** The Alert reads "Invalid username or password." with the number of attempts left.
- The card shakes once. Under reduced motion it shows a red border only.
- Haptic: Error.
- The password field is cleared after every attempt and takes focus again.

**Locked.**
- A warning Alert shows "Too many attempts / Try again in" followed by a C-6 `countdown` timer.
- Sign In and the fingerprint button are disabled.
- The lock icon closes from 20° to 0. The ring turns amber.
- When the countdown reaches zero, the card plays one gold glow pulse.

**Core offline** (heartbeat mode only).
- A danger Alert shows "Core service unreachable at 127.0.0.1:4400.".
- Sign In is disabled. The ring turns critical, and the Core chip turns red and breathes.
- Retry restarts the heartbeat client at once instead of waiting for its backoff. Retries are rate-limited to 3 s → 6 s → 12 s, at most 3, using the shared `useRetryCooldown`.

**Signed out or expired.** An accent Alert shows "You have been signed out." or the 15-minute expiry text. It disappears at the operator's first attempt.

**Success.**
- Haptic: Success.
- The card leaves (M-APP-01, Login half). The step-70 guard then opens the §3.3 target.

### 2.2 Biometric (§6.3)

The button follows the device state:
- No hardware: the button is hidden.
- Nothing enrolled: the button is disabled, with the caption "Biometrics not set up on this device".
- Available but not yet bound to an operator: the button is disabled, with the caption "Sign in with your password once…" (DR-S75-7).
- Bound: the button is enabled, with the caption "Use biometric login".

On a tap, the OS prompt reads "Sign in to DEMS / <operator> / Use password".

| OS result | What the screen does |
|---|---|
| Success | Signs in through the guard |
| `authentication_failed` | Shows "Fingerprint not recognised" with the attempts left. It counts toward the lockout |
| `lockout` | Shows "Biometrics locked — use your password" |
| Cancel | Nothing |

The enable offer itself is step 73's global dialog.

### 2.3 Layouts (§2.4)

| Class | Layout |
|---|---|
| Compact | The MB 1 order on a full-bleed licensed room still. The officer photo is never used (D28) |
| Compact-landscape | Brand 40 % \| card 60 %, with the card side scrolling |
| Medium | A 360 dp brand band above the card |
| Expanded | Split 7 \| 5: a 340 dp ring and the triplet line on the left \| a 440 dp card on the right, over a scrim |

### 2.4 Motion (§7.2, §7.3)

**Entrance.** The beats follow §7.3: backdrop at 0 ms; ring at 200; emblem draw and bloom at 500; wordmark rack-focus at 900; caption at 1,000; card rise and one border-beam lap at 1,200. The card companions (demo operators, trust line, version) enter with the card.

**Focus.** The Username field takes focus once the card has settled. The focus is "quiet": the soft keyboard does not open (DR-S75-6).

**Return after a sign-out.** The M-APP-02 entrance is compressed to ≤ 900 ms. The emblem flies in from the header logo slot, and the Alert enters last.

**Proof mode.** `?motion=slow` stretches every beat 10×.

**Reduced motion, `?motion=off` and the OS setting.** Everything appears with ≤ 160 ms fades. There is no shake, flight, beam or loop.

**Ambient loops.** There are at most 4: ring rotation, bracket breathing, Ken Burns, and gold dust. While the Core is offline, the dust gives its slot to the Core-chip breath. The loops pause off focus and in the background.

## 3. Verification

### 3.1 JS (commands run from the workspace root; jest with `--maxWorkers=2`)

| Run | Result |
|---|---|
| `npm run typecheck -w @dems/mobile` (09:16) | **exit 0** |
| `npm run lint -w @dems/mobile` (09:16) | **exit 0**. The whole workspace is clean |
| `npx jest src/features/login` (09:18, after the last edit) | **37/37 pass** (login 19, model 18) |
| `npx jest src/features/login src/navigation/__tests__/{guard,routes}.test.tsx` (09:17) | Login suites PASS. guard and routes have **10 failures**, all "Unable to find stub-param-{selectedId,evidenceId,sessionId,step}" or "Attempted to navigate before mounting the Root Layout" (`session-new-screen.tsx:160`). They are step 70's stub-level cases for `/evidence`, `/session/new` and `/session/summary`, which steps 83, 78 and 80 replaced (P11, F-75-2). The D69 case "signs in through the Login form and then opens the pending href" **passes** |
| Full mobile jest (06:28–06:32) | 50 suites, 647 tests, 9 failures. These are the same step-70 stub cases (P11) |
| Hand-over (1) probe (05:10) | Passes with `standard-navigation` in the allowlist. With the old pattern: "Jest failed to parse a file" |

T-M04 (`login.test.tsx`) covers the following:
- **Render.** The MB 1 regions appear in order with `screen-login` as the root, and there are 0 missing i18n keys.
- **Validating.** No audit row is written.
- **Generic error.** The message and the attempts left are shown, the password is cleared, and an unknown username gets the same text.
- **Lockout.** 5 failures lock the console, and the countdown runs on the simulator clock (60 s → 30 s → re-enabled → success).
- **Core offline.** In heartbeat mode the Alert shows, Sign In is disabled, Retry opens a new socket and shows "Retry in 3s", and no audit row is written.
- **Demo operators.** The list is hidden in presentation mode. Outside it there are 3 rows; a row fills the form, the override releases at the next keystroke, and the sign-in lands on Home.
- **Biometric.** All of these pass:
  - the button is hidden, not-enrolled or not-bound in the matching device states;
  - a fingerprint sign-in writes `BIOMETRIC` and passes the exact prompt options;
  - a failed fingerprint counts toward the lockout;
  - an OS lockout shows its Alert.
- **Sign-out notice (M-APP-02).** After a sign-out the notice shows, and it goes away at the next attempt.
- **15-minute expiry.** The expiry notice shows, and the recording stays untouched.
- **Credential hygiene.** The password never appears in the state, the audit rows, the runtime log or AsyncStorage.
- **Layouts.** The panes render on compact-landscape, medium and expanded.

### 3.2 Static checks

| AC | Command | Result |
|---|---|---|
| MA-22 | `grep -rnoE "#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?" apps/mobile/src/features/login` | no match (exit 1). One hex in a comment was removed |
| MA-25 | `grep -rnE "https?://" apps/mobile/src/features/login \| grep -vE "127\.0\.0\.1\|localhost\|CORE_…"` | no match (exit 1) |
| MA-20 | `grep -rn "Haptics\." apps/mobile/src \| grep -v motion/haptics` | no match (exit 1). Haptics go through `useHaptics()` |
| Stub removal | `grep -rn "StubSignIn\|stub-sign-in\|stub.signIn" apps/mobile/src` | no match (exit 1) |
| Prefs (D57, F74-07) | `grep -rn "setItem\|mergeItem" apps/mobile/src/features/login` (non-test) | no match. This step only reads `dems.mobile.prefs.v1` |

### 3.3 Device: `dems_phone` (emulator-5554)

The final session ran 07:05:49–07:11:37, through `device-session.sh` on Metro 8081 with the app force-stopped first (D55). Deep links were quoted (D68).

| # | Action | Result | Screencap |
|---|---|---|---|
| 0 | Enrolment state at the start and the end of the session | `locksettings get-disabled=false`, `"count":1`, app `lastUpdateTime 06:07:21` (step 72's APK, reinstalled) | — |
| 1 | `demsdemo:///login?motion=off` | `screen-login` plus all `login-*` ids. **IME `mInputShown=false`** after the autofocus; `true` after a tap on Username | `75_dems_phone_login_compact_motion_off.png` |
| 2 | Password `abc123`, then the eye toggle | The text is kept: `'abc123'` | — |
| 3 | Demo operators → `budi.santoso` | Username `budi.santoso`, password `demo-2026`. The eye was still toggled on from row 2, so the password shows in plain text; it is the published demo credential | `75_dems_phone_login_demo_filled.png` |
| 4 | Sign In | Biometric offer → Enable → Home. Audit: `AUTH_SUCCESS {method: PASSWORD}` | `75_dems_phone_biometric_offer.png`, `75_dems_phone_home_after_password.png` |
| 5 | Force-stop, relaunch | Caption "Use biometric login", the button is enabled | `75_dems_phone_login_biometric_ready.png` |
| 6 | Fingerprint button | The prompt text, from the dump: "DEMS Tablet Demo / Sign in to DEMS / AKP Budi Santoso / Touch the fingerprint sensor / Use password". The screencap is black because BiometricPrompt is FLAG_SECURE | `75_dems_phone_biometric_prompt.png` |
| 7 | `adb -s emulator-5554 emu finger touch 1` | `screen-home`. Audit: **`AUTH_SUCCESS {method: BIOMETRIC}`** → **MA-07 PASS** | `75_dems_phone_ma07_home_after_fingerprint.png` |
| 8 | MA-15 cold `demsdemo:///login?motion=slow` | The runtime was ready after 15 s. The frames at t0 + 1.0 s and t0 + 8.0 s differ by **14.83 %** → **PASS** | `75_dems_phone_ma15_login_{1s,8s}.png` |
| 9 | Full-motion entrance (cold, no query) | 0.8 s vs ≥ 9 s: 11.39 % differ. The frames show the backdrop fade-up, the ring sweep, the emblem draw, then the card. The 9 s frame was captured late under host load | `75_dems_phone_entrance_full_{0800,2200,4000,9000}ms.png` |
| — | logcat `ReactNativeJS:E` / `AndroidRuntime:E` | none | — |

Earlier phone session P ran 06:08–06:21. It used the same code except for the two fixes in §4.

| Action | Result | Screencap |
|---|---|---|
| One `adb input text` burst | Arrives whole: `'budi.santoso'` | — |
| 5 wrong attempts | 4, 3, 2, 1 attempts remaining, then "Too many attempts / Try again in 53 secon[ds]". Sign In `enabled=false`. 5 s later "34 s". Lockout `{"failures":[],"lockedUntil":1790809889802}`. Unlocked at ≈ 60 s with Sign In `enabled=true` | `75_dems_phone_login_locked_{a,b}.png`, `75_dems_phone_login_unlocked.png` |
| Demo list | Rendered | `75_dems_phone_login_demo_operators.png` |
| `adb emu rotate` | ROTATION_270, frame 2424×1080: brand 40 % \| card 60 %. Three more turns return to ROTATION_0 | `75_dems_phone_login_compact_landscape_motion_off.png`, `75_dems_phone_login_turned_back.png` |

### 3.4 Device: `dems_tablet` (emulator-5556), 05:41–05:50, before the incident

| Action | Result | Screencap |
|---|---|---|
| `?motion=off` | `screen-login`, `pane-brand` + `pane-auth`, logcat E none | `75_dems_tablet_login_expanded_motion_off.png` |
| Demo operator → Sign In | Offer → Enable → Home, `AUTH_SUCCESS {PASSWORD}` | `75_dems_tablet_login_demo_operators.png`, `75_dems_tablet_biometric_offer.png`, `75_dems_tablet_home_after_password.png` |
| Relaunch → fingerprint | Prompt "Sign in to DEMS / AKP Budi Santoso / Use password" → `adb emu finger touch 1` → `screen-home`, **`AUTH_SUCCESS {BIOMETRIC}`** → **MA-07 PASS** | `75_dems_tablet_login_biometric_ready.png`, `75_dems_tablet_biometric_prompt.png` (black, FLAG_SECURE), `75_dems_tablet_ma07_home_after_fingerprint.png` |

**Moved to the end pass (D75)**, each to be re-run on the repaired tablet:
- MA-15, login part;
- the medium (portrait) screencap;
- the lockout on the device;
- MA-07.

Session T is scripted in scratchpad `s75/sessionT.sh` and logs the enrolment state at its start and end.

### 3.5 Diagnostic screencaps (`75diag_*`, kept as evidence)

| File | What it shows |
|---|---|
| `75diag_dems_tablet_dropped_keystrokes.png`, `75diag_dems_tablet_partial_attempts_{a,b,c}.png` | Controlled inputs lost characters ("bud") → DR-S75-5 |
| `75diag_dems_phone_demo_fill_empty_password.png` | Remount fill → empty password → DR-S75-5 |
| `75diag_dems_phone_keyboard_autofocus_{1,3,6}s.png` | The soft keyboard covering MB 1 → DR-S75-6 |
| `75diag_dems_phone_ma15_black_{1s,8s}.png` | A first MA-15 timing that fired before the first paint. Re-timed from runtime readiness |

## 4. Decisions and drift

| ID | Type | Decision | Why |
|---|---|---|---|
| DR-S75-1 | drift (motion) | M-APP-01: only the Login half runs here. On success, `leave()` fades and drops the card (300 ms, `exit`). The ring check-draw and the emblem flight are not played | Step 70's `Stack.Protected` removes `/login` in the same commit as the sign-in. The screen survives only for the Stack `fade` (240 ms), which equals the reduced-motion variant. The full hand-off needs the guard to hold the flip for ≤ 600 ms, which is a step-70 or controller change. Home's entering half belongs to step 77 |
| DR-S75-2 | drift (layout) | Compact-landscape ring is 200 dp, not 160 dp | C-1 `login` mode clamps sizes to 200–340 dp (step 71). 200 dp fits the 411 dp-high landscape window |
| DR-S75-3 | H-MB-02 not attempted | The wordmark is flat gold (`palette.gold`) with a bronze text glow | Masked gradient text needs `@react-native-masked-view`, which is not a dependency. P12: no new package, so the spec's fallback is used |
| DR-S75-4 | design | A translucent card (surface at 55 % on compact, 80 % elsewhere) with a hairline border | It hosts the M-C-22 shake and the border beam. The MB 1 order is unchanged |
| DR-S75-5 | fix (found on the device) | The inputs are **uncontrolled**. A programmatic change (demo fill, the password cleared after an attempt) is a one-off `value` override on the mounted input, released by the next keystroke | A controlled `value` lost characters from `adb input text` bursts on the background-band emulator (F74-01). Remounting a `secureTextEntry` input with `defaultValue` came up empty on Android. jest saw neither problem |
| DR-S75-6 | fix (found on the device) | Quiet autofocus: `showSoftInputOnFocus` is off only for the programmatic focus (250 ms). A tap opens the keyboard | The spec focus (M-PG-LOGIN) opened Gboard over half of MB 1 on the phone. Device proof: IME `false` after the autofocus, `true` after a tap |
| DR-S75-7 | interpretation | Available but not bound: the button is disabled, with "Sign in with your password once to enable biometric sign-in on this tablet." | §6.3 is silent on this state. Pressing the button there would only return `unavailable` |
| DR-S75-8 | hand-over H-S75-1 | Presentation mode is read from `dems.mobile.prefs.v1`.`presentationMode` (boolean). The list stays unrendered until the value is read; a read error counts as "on" | No writer exists yet. **Step 88 writes this field by merge (D57).** Step 91's `createPrefsField` helper should absorb this reader (F74-07) |
| DR-S75-9 | budget note | Up to 4 animated Skia canvases (ring, emblem, dust, beam) overlap for about 1.5 s during the entrance. §7.8 sets ≤ 3 on compact; the figure is informational on the emulator. The beam unmounts after its lap, and the emblem goes static after its bloom | All four elements are listed in §7.3 |
| DR-S75-10 | omitted | The caps-lock hint and the pending-button sheen are left out | Touch device; the simulator answers at once |
| DR-S75-11 | omitted | The web device strip (M-PG-LOGIN 1,100 ms beat) is left out | The mobile §7.3 Login beats do not include it |
| DR-S75-12 | design | The L9 Alert sits at the top of the card | It is read before the fields; web parity |
| DR-S75-13 | React Compiler (F-70-1) | `'use no memo'` in `LoginCard` and `useLoginController`. Every hook-calling function is named `use*` (D66) | react-hook-form hands out mutable objects. The compiler lint (`preserve-manual-memoization`) flagged the memoisation |
| D58 | rule | Gold dust and border beam size themselves with `onLayout` (no `onSize`). Their worklets take no default parameters | — |
| D73 | relay | **F74-13:** selectors return primitives (`pairing.state`, `pairing.coreDeviceId`), and the operators list is the dataset constant. **F74-02:** N/A, because this step never calls `animatePulseOnce`; the unlock pulse is `GlowLayer pulseKey`, which is step 69's JS-thread call. **F74-07:** this step only reads the key (DR-S75-8) | — |
| SIM-GAP / P12 | — | **None.** Everything came from the step-31/32/73 contract and the dataset constants. No package, native module or shared change was needed | — |

## 5. Biometric enrolment: commands for the README (step 60), verified on both AVDs

Run outside the sandbox, through `device-session.sh` with `NO_METRO=1`. The AVD lock is held and the app is force-stopped first. The commands are the same on both AVDs; set `S=emulator-5554` (phone) or `emulator-5556` (tablet).

```sh
adb -s $S shell locksettings set-pin 1234                    # → Pin set to '1234'   (H-MB-04: PASS on both)
adb -s $S shell am start -a android.settings.BIOMETRIC_ENROLL
adb -s $S shell input text 1234 && adb -s $S shell input keyevent 66   # confirm the PIN
# "Set up Pixel Imprint": tap MORE until it reads I AGREE, then tap I AGREE
#   (bottom-right button: phone 911,2266 · tablet 1776,1280; the screens are FLAG_SECURE, so
#    screencaps are black; use `uiautomator dump` to read them)
# "Touch the sensor": repeat until "Fingerprint added" (3 touches on both AVDs), then tap DONE
adb -s $S emu finger touch 1; adb -s $S emu finger remove 1
# verify
adb -s $S shell locksettings get-disabled                     # → false
adb -s $S shell dumpsys fingerprint | grep -o '"count":[0-9]*' # → "count":1
# in the app: sign in once with a password → "Enable biometric sign-in on this tablet?" → Enable;
# afterwards, at Login: tap the fingerprint button, then
adb -s $S emu finger touch 1
# rollback (04 §6.3 step 5): removes the PIN and the enrolled fingerprint
adb -s $S shell locksettings clear --old 1234
# after any reboot the PIN keyguard shows; unlock with
adb -s $S shell input keyevent KEYCODE_WAKEUP && adb -s $S shell input text 1234 && adb -s $S shell input keyevent 66
```

**Final state.**
- **Phone**, re-verified at 07:11:36 (D75/D78): `get-disabled=false`, `"count":1`, app `lastUpdateTime 06:07:21` (step 72's APK). In-app binding `dems.mobile.auth.v1 = {lastOperatorId: OPR-001, biometricEnabled: true}`.
- **Tablet**, last verified at 06:08:43: `get-disabled=false`, `"count":1`, app reinstalled 06:08:06. Its in-app binding was lost in the snapshot revert. **Re-verify at the end pass.**

Both AVDs keep `stay_on_while_plugged_in=1` and `screen_off_timeout=2147483647`, so the keyguard does not show while they run.

## 6. Environment incident (P11) and findings

**F-75-1. Both session emulators died at about 05:50–05:53. The cause is unknown.**
- The original PIDs (phone 51262, tablet 51273) no longer exist, and there is no qemu crash report after 01:54. No step-75 command stops an emulator.
- **Tablet.** At 06:04 my next tablet session's `device-session.sh` (`ensure_avd`, P3 flags) rebooted it. That predates D78. Without `-no-snapshot-load` it restored the old quick-boot snapshot (D43): APK `lastUpdateTime 01:33:57`, and the app red-screened with "NativeModule: AsyncStorage is null". It was repaired at 06:08 with `adb install -r` of step 72's unchanged APK (sha256 `cb6b1f51…0be5`), and the enrolment was redone. Another lane had also reinstalled at 06:07:56.
- **Phone.** It was booted the same way at 06:07 (PID 95964, snapshot APK `01:26:45`). It was repaired the same way (`Success`, 06:07:21), and the enrolment was redone.
- **Durable fix** (step 67's helper; D78 now states the rule): boot with `-no-snapshot-load -no-snapshot-save`. My later sessions refused to start on a down AVD.

**F-75-2. Step 70's `routes.test.tsx` and `guard.test.tsx` stub-param cases fail as the real screens land.** The failing routes are `/evidence` and `/evidence/[id]` (step 83), `/session/new` (step 78) and `/session/summary` (step 80). The fix is for step 57 (T-M02 against the real screens) or the controller.

**F-75-3. All form screens.** `adb input text` and Maestro `inputText` bursts drop characters in controlled `TextInput`s on these emulators. Use the DR-S75-5 pattern, or type slowly.

**F-75-4. Secure windows.** BiometricPrompt and the Settings enrolment screens are FLAG_SECURE, so their screencaps are black. Evidence for those screens = `uiautomator dump` text + the audit row + the screencap of the next screen.

**F-75-5. Copy on the phone.** The biometric copy says "tablet" ("…on this tablet") on the phone too. This is spec copy (§6.3, `mobile.biometric.enableOffer`).

**F-75-6. LogBox banner.** Phone session P showed a LogBox "Open debugger to view warnings" banner. Its source was Reanimated's "Reduced motion setting is overwritten with mode 'always'" under `?motion=off` (motion kit; same family as F74-05). It did not appear in session Q.

## 7. Processes (P7)

| Item | Status |
|---|---|
| Metro 127.0.0.1:8081, one per device session | Each stopped by the helper. The last one, PID 42856, stopped at 07:11:37. `curl 127.0.0.1:8081/status` gets no answer |
| `adb reverse` | Removed by the helper. `adb -s emulator-5554 reverse --list` is empty |
| Emulators | Left running (P3): phone PID 95964, tablet PID 92922, both in `.locks/`. **No emulator was killed by this step.** The 06:04 tablet reboot and the 06:07 phone boot were the helper's `ensure_avd` on down AVDs, before D78 |
| Cancelled waiters | A queued phone session (05:30–05:40) and the tablet session T (killed by the controller interruption) never ran |
| AVD changes | PIN 1234 and one fingerprint on both AVDs (Q-M3, D38). The step-72 APK was reinstalled on both (§6) |
| App data | `dems.mobile.auth.v1` on the phone. The simulator snapshot holds this step's audit rows; no lockout is left active |

Scratch files are in the session scratchpad `s75/`: `lib.sh`, `ui.py`, `cdp.mjs` (a copy of step 73's), `enrol.sh`, `restore.sh`, `session*.sh`, logs, and the step-70 originals.

## 8. Rollback

1. **Code.** Restore `src/features/login/{login-screen,i18n}.tsx` to the step-70 stubs (shown in `43_mobile_navigation_shell.md` §2) and delete the other files in the folder.
2. **Step-70 files.** Restore `screen-stub.tsx`, `index.ts`, `i18n.ts` and `guard.test.tsx` from the scratchpad `s75/*.orig` copies.
3. **jest config.** Remove `|standard-navigation` from `jest.config.js`.
4. **AVDs.** Run `adb -s <serial> shell locksettings clear --old 1234` on each AVD.
5. **Screencaps.** Delete `implementation/assets/mobile/75_*` and `75diag_*`.

---
*Generated: 2026-10-01 09:20 WIB by coder-execution (step 75)*
