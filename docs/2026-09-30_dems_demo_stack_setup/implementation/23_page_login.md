---
task_id: 2026-09-30_dems_demo_stack_setup
step: 43
plan_row: 02_plan §4 W-09 (Login page + hand-off into the shell)
date: 2026-10-01
agent: coder-execution
tier: 3
lane: shared Vite 127.0.0.1:5178 (P14, D72)
status: complete
decisions: D28, D38, D41(d), D46, D48, D49, D61, D63, D65, D70, D71, D72, D74 (review 40 relay: R1–R10, ruling M8)
---

# Step 43: Login page and the hand-off into the shell

**Outcome: PASS.** Every row-43 check passes; command output and browser measurements are quoted in §4 and §5.

| Row-43 check | Result | Evidence |
|---|---|---|
| Every §14.8 state renders | **PASS** | `data-state` on `page-login` reaches all 8 states in tests (§4.2) and in headless Chromium at 1920 and 1440 (§5): idle, validating, submitting, error, locked, offline, signed-out (signed out / console locked / expired), success |
| A correct sign-in navigates to the redirect target (AC-49) | **PASS** | Own tests: `/stack-check` unauthenticated → `/login?redirect=%2Fstack-check` → sign-in → `/stack-check` (also after a lockout, an idle expiry and the security key). Step 38's route test (AC-49 round trip) and step 41's M-APP-01/02 tests pass against the new page |
| No password in sessionStorage, the URL or emitted events (AC-50 UI path) | **PASS** | `login-page.test.tsx` "keeps both typed passwords out of …": real jsdom sessionStorage (snapshot flushed), router href and state, `window.location`, simulator events, audit rows, alerts and auth, and every console call contain neither the wrong nor the correct password; `dems.auth` is exactly `{ operatorId: 'OPR-001', issuedAt }`. Mutation (d) proves the test catches a leak |
| core-web typecheck, lint, test exit 0 | **PASS for step 43**; suite has P11 noise | typecheck exit 0 (whole core-web); lint exit 0, **0 diagnostics in 273 files**; login tests **31/31**. Full suite: run 1 (06:27) 9 failures, run 2 (06:37) 2 failures, **all in files or pages owned by running steps 42, 44, 47** (§4.3) |
| Headless check at 1920×1080 and 1440×900 (fps, long tasks, ≤ 4 loops, reduced motion, emblem flight) | **PASS** | §5: 55.6 / 59.3 fps, 0 long tasks in 5 s steady state, ambient 4/4 with no breach, reduced motion 0 loops at 60 fps, emblem flight continuous both ways, hand-off 1.38 / 1.46 s. 31 screenshots `implementation/assets/23_*.png` |

Run on 2026-10-01, 05:15 to 06:40 WIB. No `npm install`, no `package.json` or lockfile edit, no `vite build`, nothing in `packages/shared/src/sim/**`, no other feature, shell or route file written, nothing committed.

## 1. Files

**Feature folder `apps/core-web/src/features/login/`** (step 38's stub replaced; export `LoginPage` and test ID `page-login` kept):

| File | Lines | Role |
|---|---|---|
| `index.tsx` | 170 | `LoginPage`: layout, `data-state`/`data-tier`/`data-arrival`, hand-off (navigate on the card's exit completion, guard timer), shell-chunk warm-up and target preload, the polite success announcement |
| `auth-card.tsx` | 468 | Card: title, one Alert, Username/Password (`TextField` + `InputGroup`, eye toggle, caps-lock hint, `FieldError`), gold Sign In with Spinner and pending sheen, "or", security key, "Demo operators" `Disclosure`, §20.1 trust line `Tooltip`; BorderBeam one lap; unlock glow pulse |
| `brand-panel.tsx` | 307 | `LoginBackdrop` (room still, baked grade, Ken Burns, hand-off crop) and `BrandSide` (GlowRing `login`, the shared-layout emblem as the ring's sibling, overline, wordmark, tagline, rule, pillars, device strip, Particles, success halo) |
| `device-strip.tsx` | 179 | Device, room, sliding clock, GNSS, Core link (heartbeat; offline dot breathes), security |
| `login-alert.tsx` | 238 | Locked (shackle closes, sliding countdown, one static screen-reader sentence), Core offline (rate-limited Retry), Error (attempts caption ticks), unexpected, signed out / console locked / expired |
| `login-emblem.tsx` | 161 | Emblem from `@dems/shared/brand` with its own gradient id: entrance draw with offset, Submitting scan, success check, bloom |
| `login-model.ts` | 299 | Pure rules: Core link view, ring state, sizes, validation, arrival notice, the one Alert, the 8 state names, countdown and text helpers |
| `login-choreography.ts` | 177 | M-PG-LOGIN, M-APP-01 Login half and return timelines as documented literals; loop and accent constants |
| `login-motion.ts` | 64 | Enter (R1 / §8) and hand-off exit props per element |
| `use-login-controller.ts` | 299 | State machine: credentials, validation, verification beat, simulator calls, lockout edges, Core Retry |
| `use-login-tier.ts` | 53 | wide / split / stacked / compact (+ tall) |
| `graded-still.ts` | 83 | Bakes the backdrop grade once into an object URL (DR-43-8) |
| `sim-adapter.ts` | 27 | SIM-GAP-W43-1 and W43-2 (§6) |
| `report.ts` | 63 | Structured dev-console entries with correlation IDs, never credentials |
| `login.css` | 661 | Page styles (`@layer components`), tiers, one transform-only keyframe |
| `__tests__/login-model.test.tsx` | 175 | 14 tests |
| `__tests__/login-page.test.tsx` | 509 | 17 tests through the real router |

**Other paths:**
- `packages/shared/src/i18n/en/login.ts` (my namespace): **+10 keys, additive only** (`trustLineUnpaired`, `deviceStrip.coreLinkValue.{ONLINE,CONNECTING,STALE,OFFLINE}`, `deviceStrip.gnssValue.{GNSS,NTP,RTC}`, `notices.consoleLocked`, `successAs`). No key renamed or removed, so the mobile Login's `login.*` keys are untouched. Shared i18n test 14/14; shared typecheck and lint exit 0.
- `apps/core-web/src/lib/presentation-mode.ts` (**new path, owned by step 43 per ruling M8**, 101 lines): `PRESENTATION_MODE_STORAGE_KEY = 'dems.presentation.v1'` (sessionStorage), `getPresentationMode()`, `setPresentationMode(enabled)`, `usePresentationMode()` (in-page notifier plus `storage` events).

**Evidence images** (`implementation/assets/`): `23_{1920,1440}_{entry_mid, idle, debug_overlay, validating, submitting, error, locked, offline, demo_operators, handoff_mid, handoff_end, signout_return_mid, signed_out, reduced}.png` and `23_{1200,900,600}_tier.png`. My renders only; the officer photo of the mobile mockup appears nowhere (D28).

## 2. What was built (§14.8, 04 §5.8, the mobile Login screen)

| Area | As built |
|---|---|
| Layout | ≥ 1280: 7 \| 5; 1024–1279: 6 \| 6 (strip in a 3 × 2 grid); 768–1023: a 280 px band (ring 200, wordmark, one-line tagline) above the card; < 768: card over the full-bleed backdrop (ring 168 + wordmark, like the mobile Login). No horizontal overflow at 1920, 1440, 1200, 900 or 600 (§5) |
| Brand side | Licensed room still `room-2560.jpg` (D46), `object-position: 62% 45%`, grade brightness .55 / sepia .35 / saturate .8 plus a warm overlay, faded into the canvas toward the auth side. GlowRing `mode="login"` (340 px, 320 when the viewport is < 1000 px high, 260 at split) with a 170 px emblem (160 at 320). Overline, "DEMS EDGE CLIENT", "TRUSTED RECORDING / FOR A SAFER TOMORROW" (synthetic oblique, 04 §9 #25), gold rule, vertical RECORD / PRESERVE / PROTECT, device strip, Particles (24, gold) |
| Auth card | 440 px, L2 glow through `GlowLayer`, "Sign in" + "Authorised operators only"; Username (`User` icon, `autocomplete="username"`), Password (`Lock` icon, eye toggle, caps-lock hint, `autocomplete="current-password"`); gold **Sign In with dark text** (D28/Q5) and a Spinner while pending; "or"; "Use security key (simulated)" (1.2 s prompt, then SUPERVISOR, D28/Q15); "Demo operators" (collapsed; 3 synthetic operators with role Chips; a row fills both fields; demo password shown; hidden in presentation mode); trust line "Console: DEMS-IR-01 • paired (simulated)" with the §20.1 Tooltip; footer version + triplet |
| States | Idle; Validating (inline `FieldError`, on submit and on blur of a typed-in field); Submitting (600 ms beat: pending button with sheen loop, disabled fields, fingerprint scan); Error (generic copy, "N attempts remaining", both fields red until edited, one shake); Locked out (5 failures in 5 min → 60 s on the simulator clock: warning Alert, shackle closes, sliding countdown, form disabled, ring amber, one gold pulse at zero); Core offline (heartbeat OFFLINE: danger Alert with Core address and rate-limited Retry 3 s → 6 s → 12 s, Sign In and security key disabled, strip dot red and breathing, ring red); Signed out / Console locked / Expired (accent notice, entering last); Success (check over the emblem, green ring flash and bloom, hand-off) |
| Motion | M-PG-LOGIN entrance (still 0, ring 200, emblem draw 500 + bloom 1,600, text from 900, strip 1,100, card 1,200 + one BorderBeam lap, focus 1,800); M-C-22; M-APP-01 Login half (§3); M-APP-02 return (emblem flies back, card rises, notice last); §8 reduced motion (opacity only, no draw, no flight, no shake, no scan, no loops; hand-off is a cross-fade) |
| Loops (§9.4) | `ring-rotate`, `ring-breath`, `ken-burns`, and one shared `login-accents` slot for Particles, the BorderBeam lap and the offline dot: never more than 4 (debug overlay: 4/4, `breach=false`) |

## 3. The hand-off (M-APP-01 Login side, D65 fallback) and MS-07

1. **t = 0** (simulator accepts): check draws over the emblem (300, `luxe`), green ring flash and one success bloom; the target route is preloaded (`router.preloadRoute`).
2. **t = 150**: card exits (opacity 0, scale 0.96, y 8; 300, `exit`); the backdrop crops toward the Dashboard hero band (`clip-path: inset()`, once) and fades.
3. **t = 210**: ring, text, pillars, strip and particles fade (240). **t = 300**: the check fades, so the plain brand mark flies.
4. **t = 450**: the card's exit completes → `navigate({ href: redirect ?? '/dashboard', replace: true })`. Login unmounts in the same commit as the shell mounts; the top-bar emblem (`layoutId="brand-emblem"`) takes the Login emblem's box and flies (spring `gentle`). A 900 ms guard timer always navigates.
5. **Sign-out** (M-APP-02): the shell exits, `/login` mounts with `data-arrival="return"`; the Login emblem (same layoutId, never at opacity 0, no draw) flies back from the top bar; the notice enters last.

**MS-07 measured** (per-frame box `[x, y, width]` of whichever emblem is mounted; `scratchpad/step43/flight-*.json`, `return-*.json`):

| | 1920×1080 | 1440×900 |
|---|---|---|
| Login emblem before the commit | [197, 311, 170] | [166, 240, 160] |
| Shell emblem, first frame | [197, 311, 170] (same box: no jump) | [166, 240, 160] |
| Settled at the top-bar slot | [20, 16, 48] | [20, 14, 44] |
| Success → settled | **1,381 ms** (≤ 1.8 s) | **1,460 ms** |
| Flight (first shell frame → settled) | 667 ms | 651 ms |
| Frames with no emblem / both mounted | 0 / 0 | 0 / 0 |
| Return flight (sign-out) | [20, 16, 48] → [20, 16, 48] (continuous) → [197, 311, 170] | [20, 14, 44] → same → [166, 240, 160] |
| Landing | `/dashboard`, shell `data-entrance="handoff"` | same |

Note: between the last Login frame and the first shell frame there is a 264 ms (1920) / 349 ms (1440) render stall: the commit mounts the shell plus step 42's Dashboard in the dev build. The emblem holds its box during the stall (no jump), then flies. The largest single frame step during the flight is 157 px (1920) / 107 px (1440), caused by frames dropped while the Dashboard mounts. See hand-off H-43-3.

## 4. Verification (fresh)

### 4.1 Gates (final run 06:36–06:39 WIB, after the last code edit)

| # | Check | Command | Result |
|---|---|---|---|
| 1 | core-web typecheck | `npm run typecheck -w @dems/core-web` | exit 0 (0 `error TS`) |
| 2 | core-web lint | `npm run lint -w @dems/core-web`; `npx oxlint -f json` (in `apps/core-web`) | exit 0; `oxlint diagnostics 0 files 273` |
| 3 | Login tests | `npx vitest run src/features/login --maxWorkers=2` | `Test Files 2 passed (2)`, `Tests 31 passed (31)` |
| 4 | core-web test (full) | `npm test -w @dems/core-web -- --maxWorkers=2` | exit 1, `Tests 2 failed \| 317 passed (319)`: both failures belong to running steps (§4.3) |
| 5 | shared namespace | `npx vitest run test/i18n.test.ts`; `npm run typecheck -w @dems/shared`; `npm run lint -w @dems/shared` | 14/14; exit 0; exit 0 |
| 6 | MS-01 / AC-72 | `grep -rnE "animate=\{\{[^}]*(width\|height\|top\|left)" apps/core-web/src` | exit 1 (no match) |
| 7 | MS-02 | `grep -rn "box-shadow" apps/core-web/src/features/login --include="*.tsx" \| grep -E "animate\|transition"` | exit 1 (no match) |
| 8 | MS-03 | `grep -rnE "will-change\|willChange" apps/core-web/src/features/login` | one rule: `login.css:62 will-change: transform; /* §9.3: Ken Burns images */` (an allowed place) |

### 4.2 Tests (`features/login/__tests__/`, 31)

- **`login-model.test.tsx` (14):** Core link mapping and blocking; ring states and sizes; validation; arrival notices (fresh, expired, signed out, console locked) and the newest-auth-event scan; notice priority; all 8 state names; submit disabling; countdown and text splitting; choreography beats (card exit ends at the 450 ms commit; everything but the emblem gone by then); reduced choreography; structured log entry fields.
- **`login-page.test.tsx` (17), real router, guards and providers:** Idle layout at 1920 (ring `login`, emblem `data-layout-id="brand-emblem"`, wordmark, tagline, pillars, strip with a UTC+07:00 clock, one element labelled "Password", no input `name`, 0 missing i18n keys, AC-66); tiers at 1200 / 900 / 600; Validating; Error (generic Alert, "4 attempts remaining", password cleared, both fields invalid until edited); eye toggle and demo-operator fill; caps-lock hint; **Locked out** with a manual simulator clock (5 failures → locked, countdown 60 → 30, controls disabled, ring ATTENTION, +5 AUTH_FAILED rows, unlock after 60 s, then sign-in lands on the redirect target with AUTH_SUCCESS); **Core offline** (socket drop → offline Alert with 127.0.0.1:4400, controls disabled, strip offline, ring CRITICAL; Retry opens a new socket at once and cools down "Retry in 3s"; a heartbeat restores idle); **Signed out**, **Console locked**, **Expired after 15 min** (returns to the same page); **Success** with real animations (Submitting → Success with check and announcement → `/stack-check` with shell `data-entrance="handoff"`); AC-49 round trip; security key (prompt text, then OPR-002 via SECURITY_KEY); **AC-50** (above); presentation mode live toggle; reduced motion (no layoutId, no running loop, no particles or draw; the hand-off still lands).

**The tests are not vacuous.** Six single mutations, each restored with `cmp` confirming the original bytes:

| Mutation | Result |
|---|---|
| (a) password not cleared after an attempt | 3 failed |
| (b) Core offline no longer blocks sign-in | 2 failed |
| (c-pre) emblem `layoutId` dropped | 1 failed |
| (c) emblem shared-layout marker dropped | 1 failed |
| (d) typed password written to sessionStorage | 1 failed (AC-50) |
| (e) lockout countdown frozen at 60 | 1 failed |

### 4.3 Full-suite noise (P11), both runs recorded

| Run | Result | Failing tests (all outside step 43) |
|---|---|---|
| 1 (06:27) | 9 failed \| 306 passed | 4 in `features/session-monitor/__tests__` (step 44 building); `routes.test.tsx` `/session` (step 44); `shell-motion.test.tsx` ×4, all mounting `/dashboard` or `/evidence` (steps 42, 47 building) |
| 2 (06:37) | 2 failed \| 317 passed | `routes.test.tsx` "accepts the evidence detail tabs" (`/evidence/…`, step 47); `shell-motion.test.tsx` SECURE beam on `/dashboard` (step 42's page now holds page loops, so the shell slot stays paused) |

Every Login path in those files passes in both runs: AC-49 round trip, `/login` signed out, open-redirect guard, sign-out to `/login`, M-APP-01 hand-off entrance, M-APP-02.

## 5. Browser check (headless Chromium, shared Vite 5178)

**Method.** `chrome-headless-shell` 1243 over CDP (`scratchpad/step43/login-check.mjs`, own copy of the CDP helper). Two harness measures, both inside the check page only:
- a **simulated Core heartbeat** (a fake WebSocket for `ws://127.0.0.1:4400/ws` sending schema-valid heartbeats), because mock-core accepts WS upgrades only from `:5173` (its Origin allowlist), so on `:5178` the Core is always offline; `__ws.dropAll()` drives Core offline;
- an **inert stand-in for Vite's HMR socket**, because other agents edit the shared tree every few seconds (CSS rescans, an i18n full reload broke the first run with "Inspected target navigated or closed").

Machine load during the final runs: load average 19.5–38 on 10 cores (other agents, two emulators).

| Measurement | 1920×1080 | 1440×900 |
|---|---|---|
| Entrance (`entry_mid` at 0.7 s) | ring sweeping, emblem drawing, card not yet in | same |
| Steady fps (own rAF, 5 s) / overlay | **55.6** / 57 | **59.3** / 61 |
| Long tasks in 5 s steady state | **0** | **0** |
| Ambient slots (overlay) | 4/4, `ken-burns, particles, ring-rotate, ring-breath` (+ `border-beam-lap` in the shared slot during the lap), `breach=false` | same |
| Core offline | `core-offline-dot` joins the shared slot while particles pause: still 4/4 | same |
| States reached | validating, submitting (pending, scan on), error ("4 attempts remaining"), locked (ring ATTENTION, Sign In disabled, 57 s after 2.3 s), offline (ring CRITICAL, disabled), recovered to idle, signed-out (`arrival=return`) | same |
| Reduced motion (OS emulation) | `data-motion=reduced`, 0 running loops, no layoutId, **60** fps; hand-off cross-fade lands on `/dashboard` (entrance `handoff`) | same, 59.9 fps |
| Console | no errors or warnings from the page (the one filtered line is Motion's reduced-motion dev notice) | same |
| No overflow; focus | none; Username focused after the entrance | same |

Tier captures (1200 / 900 / 600): `split` ring 260, `stacked` ring 200, `compact` ring 168; no horizontal overflow; card 440.

**Finding fixed during the check (DR-43-8).** The first 1920 run held **17–19 fps**. A probe removing one loop at a time showed the cost was the live CSS `filter` on the full-viewport still (re-applied at composite time every frame): 17.3 fps with everything, 20 fps with every loop stopped, **44.2 fps** with only the filter removed. The grade is now baked once; the same probe then gave **60.0 fps with all loops** (0 long tasks). A 4 s CDP trace at load 27.7 showed no main-thread task over 45 ms.

## 6. Decisions, drift, SIM-GAPs and hand-offs

| ID | Kind | Item |
|---|---|---|
| DR-43-1 | decision | Submitting needs a visible beat, but the simulator answers synchronously: a 600 ms verification beat, skipped when Motion skips animations (tests, automation) so the step-38/41 route tests stay deterministic. The security-key prompt (1.2 s) follows the same rule |
| DR-43-2 | decision (mobile parity) | Core offline = heartbeat OFFLINE, or CONNECTING after a failure (no flicker during backoff); it disables Sign In **and** the security key. Retry restarts the heartbeat client now (as the mobile Login does), rate-limited by `useRetryCooldown`. Ring: offline → CRITICAL, stale or locked → ATTENTION (§14.8 names only the amber lockout) |
| DR-43-3 | drift (timing) | The brand-text fade starts at 210 ms, not 300, so everything except the emblem has left before the commit at 450 (the two-phase fallback unmounts Login there; a later fade would blink out) |
| DR-43-4 | drift (fallback) | M-APP-01's backdrop "cross-fades into the Dashboard hero": the Login half crops toward the hero band and fades to 0.2 by 450; the Dashboard hero's own enter (step 42) completes it. `object-position` is not animated (not composite-only) |
| DR-43-5 | decision | GlowRing has no success state and is not a step-43 file: the green flash is a pre-rendered green ring overlay plus a success-tone GlowLayer pulse (opacity only) |
| DR-43-6 | decision | The emblem is the ring's sibling in a grid cell (GlowRing gets an empty `center`), so the ring can fade while the emblem stays visible for the flight; no ancestor of the emblem animates a transform (exact layout projection) |
| DR-43-7 | decision | A page-local `LoginEmblem` built from `@dems/shared/brand` (per-instance gradient id, D48) instead of the shell's `BrandEmblem`, which has no draw offset, scan or check |
| DR-43-8 | decision (performance) | The backdrop grade is baked once (canvas `filter` with the same filter string → object URL); until then, or without canvas filters (jsdom), the image keeps the CSS filter. `data-grade="baked"` in the browser |
| DR-43-9 | decision (§9.4, R7/m10) | Loops: `ring-rotate`, `ring-breath`, `ken-burns`, plus one `login-accents` slot for Particles, the BorderBeam lap (`repeat: 0`, mounted only while its slot runs, unmounted after the lap) and the offline dot; particles pause while the Core is offline |
| DR-43-10 | decision (ruling M8) | Presentation mode lives in `apps/core-web/src/lib/presentation-mode.ts` (sessionStorage `dems.presentation.v1`); Login reads it live |
| DR-43-11 | decision | Arrival notice: EXPIRED → expired; previous top-level route `/_app` → signed out, or "Console locked" when the newest AUTH_LOGOUT says LOCK (new copy key) |
| DR-43-12 | decision (a11y + tests) | The eye toggle's name is visually hidden text, not `aria-label`, so the password input stays the only element labelled "Password" (the step-38/41 route tests query `getByLabelText(/password/i)`) |
| DR-43-13 | decision (AC-50 defence in depth) | Inputs have no `name`; the form is `method="post"` and always intercepted, so a password can never reach a URL; the password is cleared after every attempt and exists only in component state and the one simulator call |
| DR-43-14 | decision | The `_app` chunk is warmed (code only, no guard) once the card has settled; the target route is preloaded at success. The remaining commit stall is the Dashboard mount in the dev build (H-43-3) |
| DR-43-15 | decision | Pillars only at ≥ 1280, the strip at ≥ 1024, per the 04 §5.8 tier table; the stacked band shows ring, wordmark and a one-line tagline |
| DR-43-16 | decision | The security-key button uses Lucide `KeyRound` (04 §7 `key-round`); the mobile "biometric" fingerprint is not reused on web |
| DR-43-17 | decision (error handling) | No client-log endpoint (D3/D4, D41(g)): failures (a throwing action, a heartbeat restart, a preload, storage, the grade bake) go to structured dev-console entries with a per-attempt correlation ID and never a credential or username; users see the generic copy |
| DR-43-18 | note | Screen readers get the lockout sentence once (fixed at the Alert's appearance); the countdown digits are `aria-hidden` |
| DR-43-19 | note (spec, D60) | AC-48 for `/login` is read signed out (a signed-in visit redirects per §14.2) |
| **SIM-GAP-W43-1** | gap → step 54 | No presentation-mode flag in the simulator; interim `@/lib/presentation-mode` (M8). Step 54 may add `settings.presentationMode` + `setPresentationMode(on)` to the snapshot; the module keeps its API |
| **SIM-GAP-W43-2** | gap → step 54 | No "last sign-out reason" selector; `readLastAuthEvent` scans the event ring once at mount. A `selectLastSignOut` selector would replace it (`sim-adapter.ts`) |
| H-43-1 | hand-off → step 52 | Bind the System page's presentation-mode `Switch` to `setPresentationMode(enabled)` from `@/lib/presentation-mode`; read with `usePresentationMode()` |
| H-43-2 | hand-off → step 54 | `selectLockoutSeconds` (m9) can replace the page's whole-seconds lockout selector; close SIM-GAP-W43-1 and W43-2 |
| H-43-3 | note → steps 42, 58 | The shell + Dashboard mount stalls 264–349 ms at the hand-off commit in the dev build (the emblem holds its box, then flies). Step 58 should confirm MS-07 and AC-71 in windowed Chrome with GPU on a production build |
| H-43-4 | note → step 60 | README: presentation mode is `sessionStorage['dems.presentation.v1']` (System page switch); `?debug=1` shows the Login loops |

Plan tracking: `masterplan/02_plan.md`, `status_tasks.md` and `delegation_progress_report.md` were not written (controller-owned during the parallel run, per the brief). Progress: `delegation_progress/coder_execution_step_43.md`.

## 7. Parallel-run notes (P1–P14)

- **P1:** no install; no manifest or lockfile edit.
- **P6:** wrote only `apps/core-web/src/features/login/**`, `packages/shared/src/i18n/en/login.ts`, my own tests, and the M8 module `apps/core-web/src/lib/presentation-mode.ts` (new path assigned by the controller). Shell, routes, other features, `components/**`, `motion/**` and `packages/shared/src/sim/**` were only read.
- **P7 / P14:** the shared Vite on 5178 was already running (PID in `.locks/vite.pid`, users step-48 and step-51). I joined under `/usr/bin/lockf -k .locks/vite.lock` (`touch .locks/vite.users/step-43`) twice and released both times under the same lock; other users remained, so the server was left running. Each `chrome-headless-shell` was killed by its script; `pgrep -fl chrome-headless-shell` returned nothing afterwards; scratch profiles deleted. mock-core was not started (the heartbeat was simulated in the page, §5).
- **P9/D72:** vitest `--maxWorkers=2`; no `vite build`.
- **P10:** per-command sandbox bypass for the Vite lock/join, the headless shells and the process checks.
- **P11:** see §4.3; the sandbox's `ERROR: failed to copy trust settings …` lines on Node start are unrelated.
- Reviews 40/45 run as parallel audits; review 40's rules R1 (primitive selectors only), R7 (BorderBeam one lap), R8 (whole seconds in selectors), R10 (SIM-GAP pattern) and ruling M8 are applied.

---
*Generated: 2026-10-01 06:40 WIB*
