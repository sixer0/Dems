---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave J - driver J-P (apps/mobile with the PHONE emulator-5554, lane 1 SIMULATED)
date: 2026-10-12
agent: coder-execution (driver J-P; two sub-drivers J-P2, J-P3 were used for closed slices; J-P2 was cut off and finished by J-P)
narrative_tier: 2
status: needs-review - headline items 1 and 2 fixed and proven on the phone in the normal launch form; items 3-6 fixed by test; several minors NOT fixed (listed with reasons); the test folders are red only through J-T's in-flight worklet audit in jest.setup.ts (154 hook-only failures)
tree: 035150b + working tree (no git write)
---

# 170 - Fix wave J, driver J-P (mobile: Home, alert toasts, navigation chrome, Settings, Devices, Network, Storage, Audit, Login / Pairing copy)

Evidence: `.cache/wave-j/p/` (0700): screenshots `NNN_*.png` with reduced copies `v_*.jpg`, montages `m_*.jpg`,
screen recordings `rest_critical.mp4`, `warn_switch.mp4`, `rec_critical.mp4` with their frames, helper scripts.
No credential, pairing code or token is in this note or in a file name. No LOCAL_DEVICE source was selected,
pre-checked or started. No Gradle build, no install, no git write. Nothing was played aloud (media volume 4
before and after, never changed).

## 0. Read first

1. **The test folders are not green, for one reason that is not mine.** `apps/mobile/jest.setup.ts` carries
   J-T's in-flight worklet audit: its `afterEach` throws "A worklet calls a function that is not a worklet ...
   dbfsMeterTsx5 calls rect / vec / rrect" for every test that mounts `components/composed/dbfs-meter.tsx`
   under the Skia mock (every tablet-landscape Home test, most Devices tests). Last runs: my slice + J-P2's
   slice 716 tests, 666 passed, 50 failed = 47 hook-only + 3 that I then fixed and re-ran green (section 5);
   J-P3's slice 522 tests, 415 passed, 107 failed = 107 hook-only. A body that ran to its end under a failing
   hook is weaker proof than a green test: these must be re-run when the audit accepts the Skia mock.
2. **Three edits were left half-applied and were completed** (section 6).
3. **The lanes were NOT restarted during my run** (`contract_wave_j.md` has neither "JS consistent" nor "lanes
   restarted" at 05:45): lane 1's Core answered the OLD way throughout. What depends on J-S's new members
   (J-S 5, 6, 13) is proven by test against the exported examples, not on the phone.
4. Not fixed, needing a decision: orientation lock (JA2-18), popover / menu content absent from the Android
   accessibility tree (JA2-16, bell and avatar menu), RBAC sentence for Start Session (JT-16). Section 3.

## 1. What was built

### 1.1 Home is ONE pure function of the Core's facts (JA2-04, JT-01; truth rule 3c)

`homeStatusOf(facts)` in `apps/mobile/src/features/dashboard/home-model.ts` returns the `HomeStatus` that
the status card, the header chip, the ring, the tiles (phone and tablet) and the primary action read; none
of them decides anything itself any more (`system-status-card.tsx`, `home-header.tsx`, `quick-actions.tsx`,
`status-tiles.tsx`, `device-tiles.tsx`). The facts are read in ONE place, `useHomeStatus`
(`use-home-data.ts`): `systemStatus()`, the runtime's link rule (`useCoreLinkNotice().offline`),
`sealAttentionOf`, `openUnsealableNoticesOf`, the reported state of the selector's lines
(`sourceStateWord`), and the facts of J-S's shared reader `systemTruthFactsOf` (contract J-S 13, the same
reader as the web's ring and pill).

| # | First fact that holds | `presentation` | Home says |
|---|---|---|---|
| 1 | the Core link is down | `OFFLINE` | "Core offline — state unknown", neutral ring, chip OFFLINE, tiles "— / Not known", Start disabled with "Core offline. A session cannot be started from this device until the link returns." |
| 2 | the open session's seal is BLOCKED | `SEAL_BLOCKED` | "Sealing blocked" (as wave I) |
| 3 | a critical fault flag | `CRITICAL` | "Recording Blocked" + flags; Start is dimmed, no sheen, with "Recording is blocked: <cause>. The devices check will refuse the start until it is cleared." (JM-N6) |
| 4 | RECORDING before the first durable fragment | `CONNECTING` | "Connecting cameras…" |
| 5 | a session records | `RECORDING` | "Session in progress" |
| 6 | a step of the seal failed and the Core retries | `SEAL_RETRYING` | "Sealing is being retried", session, the Core's sentence, "The recording is kept on the Core." - from the FIRST failure |
| 7 | a CRITICAL fact of `systemTruthOf` the Core does not mark "does not block" | `CRITICAL_ALERT` | "Critical alert" + the Core's sentence |
| 8 | a warning flag, a source on a selector line reported NOT reachable, any other fact | `ATTENTION` | "Attention Needed" + one line per fact ("Camera 2 (CAM-02): not reachable") |
| 9 | an open unsealable notice | `NOTICE` | "Open notice" (as wave L) |
| 10 | none | `READY` | "Ready for Recording" |

Also: on a Core that states `platformNotReported` the hero ring's sub-line reads "SECURITY NOT REPORTED" and
the subtitle "No fault is reported by the Core" - never "SECURE • HEALTHY • OPERATIONAL" / "All systems
operational" (J-S 5; the same "Not reported" as the Security chip). In Live on a SIMULATED Core
(`!isOwnCaptureCoreState`, J-S 7; truth rule 3f; JA2-N1) the status card carries ONE chip "Simulated Core ·
demonstration".

### 1.2 The alert toasts (JA2-05)

New module `apps/mobile/src/features/alerts/`: `alert-toasts-model.ts` (pure rules), `alert-toasts.tsx`
(`<AlertToasts />`, the app's kit toast `useToast` of heroui-native), `alert-label.ts` (ONE wording for the
bell and the toast; the bell's rules moved there unchanged), `i18n.ts`. Mounted once in the signed-in layout
(`src/app/(app)/_layout.tsx`, one line), so it runs on every screen of both layouts.

- A CRITICAL active alert always shows, `duration: 'persistent'`, with "Acknowledge" (operation 70, every
  signed-in role may call it; a refusal or outage goes to the app's one refusal presenter and the toast
  stays); it leaves when the CORE says acknowledged, or resolved. An unacknowledged critical alert that is
  already active at sign-in is shown at once.
- A WARNING alert shows once for the kit's default time when its switch is on (`shouldNotify` of
  `settings-model.ts`, the Settings rule itself); off = no toast. Warnings already there at sign-in are not
  announced. INFO / SUCCESS: none.
- One toast per alert id (toast id = `alert-<alertId>`); a replicated slice raises nothing again.
- Accessibility: `AccessibilityInfo.announceForAccessibility` with severity + words; the kit toast's action
  is a labelled button. NOT proven with TalkBack.
- `settings-prefs.ts:12-14` no longer says "no consumer".
- The duplicate screen-level "GNSS signal lost" toast of Network & Time was removed (J-P3).

### 1.3 Other changes of mine

| Change | File |
|---|---|
| "Recent Sessions" rows read the SESSION id they open; an interrupted session's row says "· Incomplete, not sealed" (JA2-28, JA2-07 on Home) | `dashboard/home-model.ts` (`recentRowsFor`), `recent-sessions.tsx` |
| Primary action label never cut: two lines, centred, shrinks to 0.85 (JA2-11) | `dashboard/quick-actions.tsx` |
| Bell lists every OPEN alert (active, or resolved and not acknowledged), newest 20, in a scroll; resolved ones are tagged "resolved, not acknowledged" and can be acknowledged; the badge counts the unacknowledged of that list (JA2-25) | `dashboard/use-home-data.ts` (`useAlertSummary`), `home-header.tsx` |
| Latched clip line names its remedy: "MIC 2: clipping was detected. Reset the clip mark in Devices." (JA2-26, Home half) | `dashboard/i18n.ts` |
| Avatar entry "Profile" renamed "Settings and profile" (it opens the Settings index) (JA2-35 / JT-18, Home half) | `dashboard/home-header.tsx` |
| First Android Back on Home answers "Press Back again to leave DEMS." and stays; the second leaves (JT-19) | `dashboard/dashboard-screen.tsx` (`useLeaveAppGuard`) |
| A status chip without a press of its own is announced as text and takes no touch (JA2-32, JT-13 for the Home chips, the READY / "Core Live" badges; also lets a tap on a chip inside a row reach the row, JT-14) | `components/kit/status-chip.tsx` |
| The tab cross-fade veil starts at 0.55 instead of an opaque canvas: no completely empty screen at a tab change (JM-07) | `navigation/app-tabs.tsx` (`TAB_VEIL_START_OPACITY`) |
| "Tablet link offline" flag -> "Device link offline" (JA2-13, Home) | `dashboard/i18n.ts` |
| Adapted to J-T's `crossFadeIn(): … | undefined` (J-T's request line of 01:20) | `components/composed/nav/live-mini-bar.tsx:43,100` |
| JT-02 on Home (J-T's offer of 05:45, brief rule 4): J-T's `SealRetryControl` is mounted beside the "Sealing blocked: view" entry (`home-seal-retry`). No test of mine for it: the control's tests are J-T's; the existing blocked-seal Home cases stay green. NOT seen on a device | `dashboard/quick-actions.tsx` |

## 2. Findings - fixed

Test files: H = `dashboard/home-model.test.ts`, L = `dashboard/home-live.test.tsx`, N =
`dashboard/home-notice-tiles.test.tsx`, S = `dashboard/session-start-home.test.tsx`, D =
`dashboard/dashboard-screen.test.tsx`, M = `settings/settings-model.test.ts`, K = `components/kit/kit.test.tsx`,
C = `navigation/__tests__/chrome-lost-updates.test.tsx` (all EXISTING files; no per-wave test file; the only
new files are the new module `features/alerts/*`, which has no test file of its own: its tests are in L and M).

| Id | Sev. | Fixed - how | Test | Proof |
|---|---|---|---|---|
| JA2-04 / JT-01 (c) link cut | MAJOR | 1.1 row 1 | H "homeStatusOf: one statement per combination of facts" (19 rows, `it.each`); L "JA2-04: Home while the Core link is down" in all four layouts | LIVE, normal launch: section 4.1 |
| JT-01 (a) seal retried | MAJOR | 1.1 row 6 | H rows; S "JT-01 (a): a seal the Core is RETRYING" (imports `SEAL_RETRYING_EXAMPLE_FINALIZATION`) | test only (lane 1 has no seal rig) |
| JT-01 (b) unreachable camera + alert | MAJOR | 1.1 row 8 | H rows; N "JT-01 (b) phonePortrait / tabletLandscape" + CONTROL | test only (real-capture lane is the tablet's) |
| JA2-05 alert toasts | MAJOR | 1.2 | M "notifications: the alert-toast consumer of the switches (JA2-05)" (4 cases); L "JA2-05: alert toasts on the Live source" (phone + tablet layout x motion default + off, refusal control, resolved, switch off, at sign-in) | LIVE, filmed: section 4.2 |
| JT-03 / JW-04 mobile half | MAJOR | Home: 1.1 last paragraph. Network & Time, device Health, diagnostics sheet: J-P3 (`delegation_progress/wave_j_p3.md` rows 1) - "Not reported" on a real-capture Core, both layouts, simulated rendering pinned | L "CONTROL - a Core in its own capture"; J-P3's `devices/real-capture-one-rule.test.tsx:336,380,471`, `network-time/network-time-screen.test.tsx:297` | test only; phone on the simulated lane showed the unchanged simulated Home |
| JW-08 mobile half | MAJOR (web id) | J-P3: "No signal" only when the Core states that state; `isLevelNotMeasured` = "— dBFS / Not measured" (`devices/device-mic-meter.tsx:38`). Home tiles already followed `micReadoutKind` | J-P3 `real-capture-one-rule.test.tsx:336,380` (imports `AUDIO_FRAME_NOT_MEASURED_EXAMPLE`) | test only |
| JA2-07 (Home half) | MINOR | 1.3 | H "falls back ... incomplete session" | - |
| JA2-11 | MINOR | 1.3 | D (label present); layout seen on the phone ("Start Session" whole) | not re-driven during a recording |
| JA2-13 | MINOR | "this device" / "Device" in apps/mobile copy: Login, Pair, biometric offer, More, Settings, About (J-P2); Devices, Network, Storage (J-P3); Home (mine). Shared sentences: J-S 12. `features/evidence/**` strings ("this tablet shows it", "not available on this tablet", "No file is sent to this tablet") are J-T's: request line written | J-P2's copy sweeps in `login.test.tsx`, `pairing-live-static.test.ts`, `more-screen.test.tsx`; J-P3 `D:380`, `N:297`, `T:248` | Login seen on the phone: "biometric sign-in on this device" |
| JA2-14 | MINOR | J-P2: Login footer (trust line + version) is a pinned row above the bottom safe area; the version keeps a full line; after a failed sign-in the password field takes focus with Sign In above the keyboard (`login/login-screen.tsx`, `login-card.tsx`) | `login/login.test.tsx` "JA2-14: the Login footer on a phone" in both motion modes | Login seen on the phone (uiautomator: `login-version` at y 2319 with its text; was 3 px) |
| JA2-15 | MINOR | J-P2: Sign In always carries its own accessible name (`login-card.tsx`) | `login/login.test.tsx` | not re-driven (no wrong sign-in typed) |
| JA2-16 (sheets, dialogs, menus) | MINOR | J-P2 / J-P3: the gorhom sheet wrapper's single accessible node "Bottom Sheet" is turned off in both sheet frames (`settings/sheet-frame.tsx`, `audit/audit-sheet.tsx`) and content is marked modal; Back closes sheets (`*/use-sheet-presence.tsx`); picker radios expose `checked` | `settings/settings-screen.test.tsx:390`, `audit/audit-screen.test.tsx`, J-P3 tests | NOT proven on the device / with TalkBack. Popover + menu: NOT fixed, section 3 |
| JA2-24 | MINOR | J-P3 row 3 | `capture-selector/capture-selector.test.tsx:197` | - |
| JA2-25 | MINOR | 1.3 (list); "View all events" still opens the Audit | D "bell" | popover seen on the phone |
| JA2-26 | MINOR | 1.3 + J-P3 row 4 | D "MIC 2 clip"; J-P3 `D:471` | - |
| JA2-27 | MINOR | J-P3 row 7 (prop level) | J-P3 `S:197`, `T:248` | NOT seen on a device |
| JA2-28 | MINOR | 1.3 | H "shows the SESSION id the row opens"; D; L | seen on the phone (rows SES-…) |
| JA2-29 (my areas) | MINOR | J-P2: no spec / developer wording in Login, Pair, More, Settings, Audit copy; the stack-check page and the developer controls ("Core link source", "Performance overlay", developer gallery) show in a development build only and are hidden by presentation mode. J-P3: Devices / selector copy. Shared keys: J-S 12 | J-P2 copy sweeps (one per feature test file); `settings/live-settings-sites.test.tsx`, `heartbeat-release-gate.test.tsx` | - |
| JA2-31 | MINOR | J-P2: a verdict is of the chain AT ITS TIME; when the chain's break state changed it is drawn as an earlier check with its time, never FAIL beside "Chain OK"; the stored-log line under a FAIL names which chain broke (`audit/audit-model.ts`, `chain-strip.tsx`, `chain-live.tsx`) | `audit/audit-model.test.ts`, `audit/live-audit-chain.test.tsx` | - |
| JA2-32 | MINOR | 1.3 (status chip is a readout) | K "is a readout" | - |
| JA2-33 | MINOR | J-P3 row 5 | J-P3 `D:336,380`, `S:197` | - |
| JA2-34 | MINOR | J-P3 row 2: readouts are true in every motion mode | J-P3 `D:380`, `N:297` `it.each(['off','default'])` | uiautomator idle under `motion=off` on a microphone detail NOT checked |
| JA2-35 | MINOR | 1.3 (avatar entry); J-P2: More's Settings tile counts the rows the list shows | D "avatar menu"; `more/more-screen.test.tsx` | "Lock console" still signs out: see section 3 |
| JA2-38 / JT-21 | MINOR | J-P3 row 8 (labels "Sealed today", "Recorded, not sealed") | J-P3 `T:248` | "Est. Remaining" not fixed (section 3) |
| JA2-N1 | NOTE | 1.1 ("Simulated Core · demonstration") | L "a SIMULATED Core is named once" + own-capture CONTROL | seen on the phone |
| JA2-N3 / N-05 | NOTE | J-P2: a PAIRED device's screen is titled as its pairing details; the link is named for what it opens | `pairing/pairing-screen.test.tsx` | Unpair reachability unchanged: decision 4 |
| JA2-N6 | NOTE | J-P2: demo operator rows announced with the role | `login/login.test.tsx` | - |
| JA2-N10 | NOTE | J-P3 row 6 | J-P3 `D:534`, `C:536` | - |
| JM-07 | MINOR | 1.3 | C "full motion keeps M-MB-01 and M-APP-04" (veil opacity < 1) | NOT re-measured per frame on the phone |
| JM-N6 | NOTE | 1.1 row 3 | H row "a critical fault at rest" (`startBlock: 'CRITICAL'`) | seen on the phone (`014`, `015`) |
| JT-13 (Home, selector) | MINOR | 1.3; J-P3 row 9 | K; J-P3 `S:197` | - |
| JT-14 | MINOR | J-P3 row 9 (+ 1.3 chip takes no touch) | J-P3 `D:336,380` | - |
| JT-19 | MINOR | 1.3 | D "JT-19" | LIVE: section 4.3 |
| RBAC (item 6) | - | Home Start / Continue setup: disabled with "Requires the Investigator role" / "Checking your permissions…" (unchanged, `use-role-gate.ts`), and now also disabled with the reason while the link is down. J-P3's list: `wave_j_p3.md` "RBAC control list" (+ the `DIAGNOSTICS_RUN` gate). No control on my screens is enabled-then-refused by role | `rbac/*.test.tsx` (unchanged, green) | - |

Settings switches (item 5), what reads each: Reduce motion and Haptics -> the motion kit (`src/motion/prefs.ts`,
`use-motion-policy.ts`, `haptics.ts`); Presentation mode -> `login/presentation-mode.ts` (hides the demo
operators) and, by J-P2, the developer pages; the four Notifications switches -> `<AlertToasts />` through
`shouldNotify` (new); Critical alerts -> always on (the consumer ignores the switches for CRITICAL);
Biometric sign-in -> `auth` (not touched, D151); Core link source / Performance overlay -> development build
only (J-P2). Meter size -> `settings-prefs.ts` documents that the monitor keeps its own choice until it
reads the field (J-T's screen): NOT verified by me, see section 3.

## 3. Findings - NOT fixed, or only partly

| Id | Sev. | Reason |
|---|---|---|
| JA2-18 portrait lock | MINOR | Needs the user's decision and a native build. `src/layout/use-layout-class.ts:7` records decision D17 "orientation is never locked"; `app.json` has `"orientation": "default"`; a lock is either `app.json` / manifest (Gradle build: forbidden here) or `expo-screen-orientation` (not installed; no installs). The tablet keeps what it has: no app lock (its landscape comes from the emulator's rotation setting). The tap-through seen once after a rotation was not reproduced (no rotation driven) |
| JA2-16 bell popover, avatar menu | MINOR | Kit-level. With the popover OPEN (screenshot before and after the dump, `m_036.jpg`) `uiautomator dump` holds no node of its content. Tried on the phone: `importantForAccessibility="yes"` + label on `Popover.Content`; `accessible={false}` on it - no change (both removed again). The same kit's Dialog is exposed. Option for the controller: present the bell and the account menu as a Dialog / sheet on the phone (a design change) |
| "the bell popover's Back on Home exits the app" | (prompt) | Not reproducible: Back closed the popover and the app stayed (section 4.3); the kit registers its own Back handler (`primitives/popover/popover.tsx:296`). No code changed for it |
| JT-16 RBAC sentence "Requires the Investigator role" although a supervisor starts sessions too | MINOR | ONE rule today: `requiredRoleFor` of `src/runtime/core-errors.ts` (not my file) names the least privileged role, for the gate AND the refusal presenter, pinned by 8+ test files including J-T's. Changing the sentence is a decision (decision 2) |
| JT-18 "Lock console" = sign out | MINOR | `lockConsole()` is `signOut('LOCK')` (`src/auth/auth-provider.tsx:245`, not mine). The avatar entry was only renamed for "Profile". A distinct Login notice for reason LOCK was asked of J-P2 and NOT done (cut off) |
| JA2-36 (reason hint, autocorrect), JA2-10, JA2-09, JA2-22, JA2-23, JA2-06, JA2-08, JA2-17, JA2-19, JA2-20, JA2-21, JA2-01..03, JA2-37, JA2-12, JA2-30, JM-01..06, JM-08, JM-09 | - | J-T's screens (session flow, evidence, stepper, update, keyboard) or the simulator (J-S): not my area. JA2-12 is a bundled asset |
| JA2-38 "Est. Remaining" | MINOR | The replicated storage slice has no `estimatedRemainingMs` (J-P3 "to wire") |
| Settings diagnostics sheet still "PASS" on a real-capture Core | part of JT-03 | It is its own component in `settings/maintenance-section.tsx:214` (J-T's file); it can import `diagnosticNotReported` / `summaryOf` from `devices/diagnostics-sheet.tsx`. Request line written |
| Meter size switch | item 5 | Reader not verified (J-T's monitor); not hidden |
| JA2-N2, N4, N5, N7, N8, N9, N11, N12, JM-N1..N5, N7, JT-12 Home tile title size, JT-24 | NOTE / MINOR | Not done: N2 / N4 are rulings (role matrix, demo fault list); N7 - a persistent critical toast now also covers the header until acknowledged (by the promise of Settings); N5 dialog dimming is the kit's; JT-12 (tablet tile title) and JT-24 (Home with an open setup shows only a renamed button) were not reached |
| JT-03 on the phone / lanes | - | Not seen on a real-capture Core: the phone is on the simulated lane and the lanes were not restarted |

## 4. Proven LIVE on the phone (normal launch form: `am force-stop`, then `monkey ... LAUNCHER 1`)

Reverse rules read back after every relaunch: `tcp:8081 tcp:8081`, `tcp:4420 tcp:4421`. Sign-in by the seed
helper with coordinates (uiautomator cannot idle on Login with motion on); fields checked empty on a
screenshot; biometric offer "Not now".

### 4.1 Home and the Core link (01:02; `cut1_*.png`, `m_cut1_a.jpg`, `m_cut1_b.jpg`, `m_cut1_full.jpg`)

`adb -s emulator-5554 reconnect` at 01:02:36. First screenshot **+0.4 s**: chip "Core Offline", card "Core
offline — state unknown / This device has no link to the Core server. What is shown is the last known
state.", tiles "— / Not known", Start Session dimmed with the reason line; ring neutral from +1.6 s. Same
at every one of 32 shots to +21.7 s. Both rules restored at +22.4 s and read back; chip red at +2.6 s after
the restore, "Core Live / Ready for Recording / 2/2, 2/2, 20 %" at **+3.3 s**. Pairing kept.

A demo fault through lane 1's API (`POST demo/faults {"kind":"STORAGE_FULL"}`, 01:08:31): Home "Recording
Blocked / • Evidence storage full", Storage tile 99 % red, bell 1, "Recording is blocked: Evidence storage
full. …" under the dimmed Start (`010`, `014`, `015`).

### 4.2 Alert toasts (filmed with `adb shell screenrecord`)

| Film | What | Result |
|---|---|---|
| `rest_critical.mp4` (`m_rest_critical.jpg`) | at rest on Home: STORAGE_FULL raised 01:10:45 (film +4 s) | toast "Storage full / Critical alert at 01:10:45. It stays until it is acknowledged." + "Acknowledge" in the next 1 s frame; still there at +21 s; "Acknowledge" tapped at +22 s -> gone by +23 s; the Core's alert `acknowledged: true` |
| `014_home_fault_at_signin` | critical alert already active at sign-in | shown at once |
| `warn_switch.mp4` (`m_warn.jpg`) | Settings -> Notifications, "Storage" switched OFF; STORAGE_LOW raised (01:12:25), then GNSS_LOSS (01:12:35, switch on) | no toast for the storage warning in 10 s (the Core held it active and unacknowledged); toast "GNSS signal lost / Alert at 01:12:35. The bell lists it." for the time warning. Switch put back ON |
| `rec_critical.mp4` (`m_rec_critical.jpg`) | during a recording (demo scenario `recording`, Session Live): TPM_FAILURE at 01:13:34 | toast "TPM failure / Critical alert …" appears over the monitor, stays through the session's change to Session recovery, leaves on "Acknowledge" (+22 s) |

The first attempt at 01:08 showed NO toast: the new mount line in the signed-in layout needed an app
relaunch (Fast Refresh did not remount the layout). After the relaunch every case above showed.

### 4.3 Back (05:21, `m_back.jpg`)

Bell popover open ("Latest alerts"), Android Back: popover closed, `topResumedActivity` still
`com.dems.demo.tablet/.MainActivity`. Back again on Home: toast "Press Back again to leave DEMS.", app
still resumed.

### 4.4 By test only

Tablet layouts of everything above; the retried seal; the unreachable camera; the real-capture rendering
(J-S 5, 6, 7, 13 examples); the refusal of an acknowledgement; JM-07; JT-13 / JA2-32; all of J-P2's and
J-P3's fixes (no device was used for them, except that the Login in its new layout was seen and signed
into three times).

## 5. Checks run, and for the test runner

| Check | Result |
|---|---|
| `npx tsc --noEmit` (apps/mobile) | 1 error, in J-T's file: `src/features/evidence/live-evidence-export.test.tsx(278,125)` (in flight). None in mine |
| `npx eslint .` (apps/mobile) | 0 problems |
| jest: `src/features/{dashboard,alerts,rbac,settings,login,pairing,more,audit} src/navigation src/components/kit src/components/composed/nav src/i18n` | 66 suites, 716 tests: 666 passed, 50 failed = 47 worklet-audit hook-only + 3 others. Of the 3: `settings-screen.test.tsx` (half-written assertion, completed, green), `pairing-screen.test.tsx` ("Tablet paired" -> J-S's "Device paired", updated, green), `pairing/pairing-handoff-routes.test.tsx` "the root layout mounts the landing beside the navigator" - pins the source of `src/app/_layout.tsx`, which J-T changed: NOT mine, not fixed |
| jest: `src/features/{devices,capture-selector,network-time,storage}` | 47 suites, 522 tests: 415 passed, 107 failed, all 107 worklet-audit hook-only |

Host load was 8-25 during these runs (other drivers); the brief's "below 6" could not be held for the last
two runs - I waited 15 minutes twice and ran with three workers.

For the test runner (after J-T's audit accepts the Skia mock): the whole mobile suite once; expect the
`pairing-handoff-routes` case to follow `src/app/_layout.tsx`'s owner.

Re-drive list for the confirmation judge (normal launch): 4.1, 4.2, 4.3 as written; on the TABLET (lane 2,
after the lanes' restart): Home with `seal-rig 2 blocked` from the first failed step ("Sealing is being
retried"), `source-rig 2 unreachable CAM-02` ("Attention Needed / Camera 2 (CAM-02): not reachable"), the
hero ring "SECURITY NOT REPORTED", no "Simulated Core" chip on lane 2, Network & Time / diagnostics / Health
"Not reported", a critical alert toast on the tablet; Login footer and keyboard after a wrong sign-in;
Audit after clearing an audit-tamper fault; TalkBack on a Settings sheet and on the bell popover.

## 6. Edits found half-applied and how they were completed

| File | State found | Completed |
|---|---|---|
| `settings/sheet-frame.tsx`, `audit/audit-sheet.tsx` (J-P2's JA2-16 fix to both sheet frames) | both frames carried the full change (wrapper off, modal root, closing tags balanced) | verified by typecheck and their tests; the test `settings-screen.test.tsx:404` asked for a `header` role the kit title does not carry: replaced by the title text |
| `login/login.test.tsx:352`, `pairing/pairing-screen.test.tsx:285` (J-P2) | did not typecheck (`it.each` tuple, BackHandler listener type) | typed; both green |
| `dashboard/dashboard-screen.test.tsx` (MINE) | my second edit of the JT-19 case had removed the describe's `beforeAll` / `beforeEach` / `afterEach`; three later cases failed on leaked state | hooks restored verbatim from `HEAD` (read with `git show`, no git write); file green except the two hook-only tablet cases |
| J-P2's progress file | never written (`delegation_progress/wave_j_p2.md` does not exist) | its fixes are listed in section 2 from its diff and tests; its Settings switch list is the paragraph under section 2 |

## 7. Decisions for the controller

1. JA2-18: lock the phone to portrait (overrides D17; needs a native build or a new dependency)?
2. JT-16: should the gate and the refusal presenter say "Requires the Investigator or Supervisor role"
   (change in `runtime/core-errors.ts` + its pinned tests in J-T's folders)?
3. JA2-16: present the bell and the account menu as a Dialog / sheet on the phone so that their content is
   in the accessibility tree?
4. Unpair stays reachable from Login without a sign-in and by a technician (JA2-N3): rule unchanged.
5. JA2-28 changes the MB 2 mock-up ("Recent Sessions" showed evidence ids): rows now read session ids.
6. JA2-25: the bell's badge now also counts alerts the Core resolved that nobody acknowledged; the web's
   rule is J-W's - make them one.
7. A persistent critical toast lies over the header (bell, avatar, Back) until acknowledged (JA2-N7 gets
   stronger): acceptable, or move critical toasts to the bottom?
8. The "Simulated Core" chip is drawn when Live, link up, and the Core states neither a host clock nor
   `platformNotReported`; before the first snapshot of a real-capture Core it could show for a moment
   (not observed; the lanes were not restarted).
9. J-P3's five decisions: `wave_j_p3.md` "Decisions".

## 8. Requests written / owners named

`features/evidence/i18n.ts` "tablet" sentences and `settings/maintenance-section.tsx` diagnostics sheet
(J-T); `runtime/core-errors.ts` role sentence; `auth` lock semantics; J-S: `estimatedRemainingMs` in the
storage slice, a "network not reported" member, a camera-search capability (J-P3 "to wire").

## 9. State left (read back 05:45)

- Phone `emulator-5554`: Login in the environment note's form (`demsdemo:///login?core=LIVE&motion=off`),
  both fields showing only their hints, "Core online", "Core: DEMS-IR-01 • paired as DEV-0002", `v2.4.1`;
  reverse rules `tcp:8081 tcp:8081`, `tcp:4420 tcp:4421`; media volume 4 (as found). Disclosure: at 05:39
  the phone was found asleep behind the keyguard (host load 25, emulator load 28) and was unlocked with
  `apps/mobile/scripts/emulator-user-lock.sh unlock phone` (no lock change); one "isn't responding" dialog
  of the starved emulator was answered "Wait", and the app was then restarted in the note's form with the
  device calm (Login read by uiautomator, no ANR).
- Lane 1: Core and web up, never stopped or reset by me; demo scenarios `recording` then `idle` loaded once
  each (seed again: no session, no alert, `activeFaults []`); faults STORAGE_FULL (3x), STORAGE_LOW,
  GNSS_LOSS, TPM_FAILURE raised and cleared. Helper session signed out (204), jar removed.
- Lane 2 and the tablet: not touched. No rig used. `judging_slots.md`: my lines released.

---
*Generated: 2026-10-12 05:50 WIB*
