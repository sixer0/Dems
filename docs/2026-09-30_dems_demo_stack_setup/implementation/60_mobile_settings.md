---
task_id: 2026-09-30_dems_demo_stack_setup
step: 88
plan_row: 05_mobile_plan §3 M-15 (part b, Settings)
date: 2026-10-01
agent: coder-execution
lane: mobile, Metro 8085 (fast lane D75; D100 AVD choice; D103 debug sign-in)
tier: 3
status: complete
decisions: D17, D55, D57, D66, D73, D75, D78, D87, D88, D100, D103
---

# Step 88: mobile Settings (04_mobile_specs §4.15, MB 10)

**Outcome: PASS on the fast-lane gate (D75).**

| Check | Result | Evidence |
|---|---|---|
| Mobile typecheck | **exit 0** | `npm run typecheck -w @dems/mobile`, final run 10:20 (after DR-S88-3) |
| Mobile lint | **exit 0** (0 warnings) | `npm run lint -w @dems/mobile`, final run 10:20 |
| This screen's jest | **2 suites / 17 tests pass**, exit 0 | `npx jest --maxWorkers=2 src/features/settings`, final run 10:20:44 |
| MA-11 MB 10 checklist (phone portrait) | **PASS** | §3, `88_dems_phone_list.png`: G1–G4 in MB 10 order |
| MA-30 demo-controls part on a device | **PASS** (tablet, D100) | §3: MIC 2 clip → "1 fault active"; Storage full → "2 faults active"; Home shows CRITICAL, "Evidence storage full", "MIC 2: clipping", MIC 2 CLIP chip, "Storage: 99% used"; Reset → "0 faults active", "Current: Idle". The monitor's toast and the step-2 BLOCK screencaps are left to the end pass (step 59) |
| Static | clean | `grep "Haptics\."`, the hex grep (MA-22) and the `https?://` grep (MA-25) over `features/settings`: no match (exit 1). No `setItem` in the code |

Only `apps/mobile/src/features/settings/**` was written in the app. Not touched: `packages/shared/**`, route files, `src/{navigation,runtime,auth,motion,components}/**`, any `package.json`, jest config. No npm install, nothing committed.

## 1. Files (`apps/mobile/src/features/settings/`)

| File | Content |
|---|---|
| `settings-screen.tsx` | `SettingsScreen({ selectedSection })` (`screen-settings` kept). Compact: the MB 10 list; a section pushes `/settings/<section>`. Medium/expanded: `pane-categories` 320 dp \| `pane-section` (§2.4); `?selected=` defaults to App Preferences. Hosts the Profile sheet |
| `settings-section-screen.tsx` | `SettingsSectionScreen({ section })` (`screen-settings-section` kept): back + title + section body |
| `settings-list.tsx` | G1 header (back + "Settings"; 48 dp landscape phone, 64 dp pane), G2 Account (Avatar initials, role, name, chevron → Profile sheet), G3 Application, G4 System. Device Settings / Storage Management / Network & Time → `/devices`, `/storage`, `/network-time` |
| `section-body.tsx` | Section switch plus a toast for a failed read or write in the motion, Core link or Settings prefs |
| `preferences-section.tsx` | Reduce motion (`useMotionPreferences`, shows the OS setting); Haptics; **Presentation mode**; Core link source Simulated \| mock-core heartbeat (`useCoreLinkSourceSetting`); Meter size; Language (Bahasa Indonesia disabled, A10); Performance overlay (`__DEV__` only) |
| `notifications-section.tsx` | One switch per category (cameras and mics, storage, time, enclosure and system). Critical: selected and disabled, with the explanation |
| `security-section.tsx` | Biometric switch (`useAuthSession().setBiometricEnabled`, hardware/enrolment status, bound-operator rule); Auto-lock 5/15/30 with only 15 enabled (SIM-GAP-M88-1); Core pairing → `/pair`; Operator audit → `/audit`; Lock console; Sign out |
| `maintenance-section.tsx` | Run diagnostics (sim run + sheet following the 8 checks); Software update card (v2.4.1 → v2.5.0, C-4 Stepper once running, SIMULATED chip); **Demo controls** `Accordion` (collapsed, DEMO badge; hidden in presentation mode): 9 fault buttons (inject / clear; clearing MIC 2 also resets its CLIP latch), scenario `TagGroup` + Load, Reset demo, Recover while in FAULT |
| `about-section.tsx` | Product (DEMS Edge Client, v2.4.1, tablet app, app build from expo-constants), §24.1 identity subset (DEMS-IR-01, …) with DEMO chips; Licences sheet (fonts OFL-1.1; hero photo, Leandro Alamino / Pexels License); "Stack diagnostics" → `/stack-check` |
| `profile-sheet.tsx` | Role, operator ID, demo permissions (sim `ROLE_PERMISSIONS`), Lock console, Sign out (props only, because it is portalled) |
| `settings-prefs.ts` | Owns `presentationMode` (field name imported from the Login reader), `meterSize` and `notifications` in `dems.mobile.prefs.v1`. Writes only through `AsyncStorage.mergeItem` (D57). A late read never overrides a choice made before it finishes. Failures go to `reportRuntimeIssue` (`dems.mobile.log.v1`) |
| `settings-model.ts` | Pure: rows, section titles, demo faults, notification kinds, biometric view, diagnostics and update views |
| `settings-controls.tsx` | `GroupCard` (stagger `enterRise`), `NavRow`, `SwitchRow` / `SegmentRow` (haptics through `triggerHaptic`, MA-20) |
| `sheet-frame.tsx`, `use-sheet-presence.tsx` | Kit BottomSheet frame; a copy of step 79's presence hook, as the brief asked (F-79-2) |
| `i18n.ts` | `features.settings.*`, only copy that no shared key has. Labels reuse `system.settings.*`, `system.demo.*`, `system.diagnostics.*`, `system.update.*`, `securityAudit.rbac.permissions.*`, `shell.userMenu.*`, `mobile.*` |
| `settings-screen.test.tsx`, `settings-model.test.ts` | §2 |

## 2. Tests (17)

- MB 10 order G1–G4, account label "Investigator, AKP Budi Santoso", row labels, 0 missing keys.
- Phone push targets (5 sections + 3 screens) and Back.
- Tablet: panes, App Preferences by default, `setParams({selected})`, `?selected=about`.
- **Merge writes:** seeded `{railCollapsed, coreLinkSource}` survive. After the run the stored object is exactly `{railCollapsed, coreLinkSource:'HEARTBEAT', presentationMode, reduceMotion, haptics:false, meterSize:'compact'}`. Login's own `readPresentationMode()` returns `true` (D88).
- Notifications are merged as one object; Critical stays disabled and on.
- Demo controls: MIC 2 clip (fault + CLIP latch), Storage full, clear resets the latch, Reset → idle. The controls are hidden in presentation mode.
- Diagnostics: the sheet follows the run to completion.
- Security: auto-lock 5/30 disabled; pairing and audit links; Sign out.
- About: v2.4.1, DEMS-IR-01, DEMO chips, licences sheet, `/stack-check`.
- Profile sheet: role, permissions, Lock console.
- Model and parser units.

## 3. Device check

**Phone portrait.** Session 1 ran 09:54:20–09:56:43 on emulator-5554 (1080×2424) through `device-session.sh` with `?motion=off`. Sign-in used the Login demo-operator row. logcat `ReactNativeJS:E` / `AndroidRuntime:E`: none.

| Screencap | Shows |
|---|---|
| [88_dems_phone_list](assets/mobile/88_dems_phone_list.png) | Back + "Settings"; Account (BS, Investigator, AKP Budi Santoso, chevron); Application ×3; System ×5; bottom bar with More selected. uiautomator: `settings-header` y 63–210, `settings-account` 210–557, `settings-group-application` 599–1162, `settings-group-system` 1204–2096, `nav-bottom` 2204 |
| [88_dems_phone_profile_sheet](assets/mobile/88_dems_phone_profile_sheet.png) | Profile sheet: role, OPR-001, 4 permissions, Lock console, Sign out |
| [88_dems_phone_preferences](assets/mobile/88_dems_phone_preferences.png), [presentation on](assets/mobile/88_dems_phone_preferences_presentation_on.png) | All App Preferences controls |
| [88_dems_phone_maintenance_presentation](assets/mobile/88_dems_phone_maintenance_presentation.png) | "Demo controls are hidden in presentation mode." (`settings-demo-hidden` found). Presentation mode was turned off again afterwards |
| [88_dems_phone_about](assets/mobile/88_dems_phone_about.png) | v2.4.1, app build 0.1.0, DEMS-IR-01, DEMO chips |
| — | Storage Management → `screen-storage`; Back → `screen-settings` |

**Tablet landscape** (D100: the first free AVD). Session 3 ran 10:14:19–10:17:23 on emulator-5556 (2560×1600). Sign-in used the simulator's biometric action through `__DEMS_DEBUG__`, read over Metro's inspector (D103), with result `{ok:true, operatorId:"OPR-001", method:"BIOMETRIC"}`. No credential was typed. logcat E: none.

| Screencap | Shows |
|---|---|
| [88_dems_tablet_maintenance](assets/mobile/88_dems_tablet_maintenance.png) | Deep link `/settings/maintenance` handed over to the pane: rail \| categories (System Maintenance selected) \| section |
| [88_dems_tablet_demo_open](assets/mobile/88_dems_tablet_demo_open.png), [mic2_clip_storage_full](assets/mobile/88_dems_tablet_demo_mic2_clip_storage_full.png) | Accordion opened; MIC 2 clip and Storage full shown active (danger tint), "2 faults active" |
| [88_dems_tablet_home_storage_full](assets/mobile/88_dems_tablet_home_storage_full.png) | Home: CRITICAL, "Recording Blocked", "Evidence storage full", "MIC 2: clipping", MIC 2 CLIP, "Storage: 99% used" |
| [88_dems_tablet_list_pane_preferences](assets/mobile/88_dems_tablet_list_pane_preferences.png) | `/settings`: `pane-categories` \| `settings-pane-header` with App Preferences |

**Session 2 was invalid, and its screencaps were withdrawn.** It ran on the phone 10:02:43–10:11:27. The demo-operator sign-in did not land under host load: the app stayed on `screen-login` with an empty form. Its 4 screencaps, which show Login under misleading names, were moved to the scratchpad (`s88/invalid_shots/`). So was session 1's `maintenance_demo_mic2_clip`: the accordion tap there coincided with a Metro "Refreshing…" banner, and the accordion stayed collapsed. The tablet set replaces all five.

## 4. Decisions, drift, gaps, hand-overs

| ID | Item |
|---|---|
| **SIM-GAP-M88-1** | §4.15 Auto-lock asks for 5/15/30 min, but the simulator's idle timeout is fixed (`AUTH_IDLE_TIMEOUT_MS`, 15 min). 15 is shown selected and 5/30 disabled, with "Fixed at 15 minutes by the demo policy". No local sim-adapter: faking the other values would lie. Closure: a configurable idle timeout in `packages/shared/src/sim/auth.ts` (not this row's path) |
| DR-S88-1 | §4.15 `Select` → a kit `Tabs` segmented control for 2–3 options (Core link source, Meter size, Language, Auto-lock) and a `TagGroup` for the 4 scenarios. Still kit only (D6), and the same pattern as the monitor's meter-size control. This avoids portalled Select sheets (F-79-2) |
| DR-S88-2 | Brief additions beyond §4.15 are implemented: Meter size, and Sign out in Security. Demo fault buttons toggle (inject, or clear when active), with Recover while in FAULT, following the web Demo Control Panel |
| DR-S88-3 | Device findings, all fixed after the screencaps: (a) the group titles sat about 5 dp under the card edge, because the kit surface keeps its own padding; the title now has 8 dp top padding (the tablet set already shows it). (b) In the tablet pane a newly opened section kept the previous section's scroll offset (`88_dems_tablet_list_pane_preferences.png` opens mid-way); the pane's `ScrollView` is now keyed by section. (c) "(S20)" was removed from the user-facing permissions note. The gate was re-run afterwards (typecheck, lint and jest exit 0 at 10:20) |
| O-S88-1 (other owner) | In the same tablet screencap the rail's selection card stays on Home while the Settings label is gold. The route was opened by `am start` while Home was active. This is navigation-shell behaviour (steps 70/91), not Settings; noted for the end pass |
| H-S88-1 (D88) | `presentationMode` is now written by merge. Login reads it on mount (unit-proven: `readPresentationMode()` returns `true` after the Settings switch) |
| H-S88-2 | `meterSize` (`'card' \| 'compact'`) is stored. The monitor (step 79's `session-live-screen.tsx`, local `useState('card')`) does not read it yet. Owner: step 91 or step 79's successor |
| H-S88-3 | `notifications` is stored, and `shouldNotify(kind, prefs)` is exported from `settings-model.ts`. No alert-toast consumer exists on mobile yet (§4.19 global overlays) |
| H-S88-4 | `use-sheet-presence.tsx` is the third copy, after session-live and evidence. Step 91 lifts it into the kit (D78) |
| F-S88-1 | Device tooling: the Metro inspector WebSocket needs an `Origin` header; without it the handshake returns 401. The helper `s88/heval.mjs` sends `Origin: http://127.0.0.1:<port>`. Useful for step 59 and README step 60 |
| P11 | 10:02, jest: both settings suites failed to load because `packages/shared/src/sim/maintenance.ts` imported a `./devices` module another lane had not written yet. 10:05: green again after that file landed |
| Cold starts | 11–19 s; environment-bound (D87), ignored |

## 5. Processes (P7)

- Three `device-session.sh` sessions on Metro 8085. Each Metro (86309, 94496, 7980) was stopped by the helper, and the reverse rules were removed.
- Emulators were not touched (D78).
- App state on the tablet: signed in as OPR-001 (memory only), faults cleared, idle scenario. On the phone: presentation mode is back to `false`.
- Scratch files are in the session scratchpad `s88/`: scripts, logs, `ui.py`, `heval.mjs` and the invalid screencaps.

---
*Generated: 2026-10-01 10:20 WIB by coder-execution (step 88)*
