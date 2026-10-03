---
task_id: 2026-09-30_dems_demo_stack_setup
step: 84
plan_row: 05_mobile_plan M-13 (Devices & Inputs list + device detail)
date: 2026-10-01
agent: coder-execution
tier: 3
lane: mobile, Metro 8088 (fast lane D75)
status: complete
decisions: D17, D55, D58, D66, D73, D75, D78, D79
---

# Step 84: mobile Devices & Inputs (`/devices`, `/devices/[deviceId]`)

**Outcome: PASS (fast lane, D75).** Run 09:23–10:06 WIB.

| Check (D75) | Result | Evidence |
|---|---|---|
| Own jest tests | **PASS** | `npx jest src/features/devices --maxWorkers=2`: 2 suites, **20 passed** (model 9, screen 11) |
| Mobile lint | **PASS** | `npx eslint .` (cwd `apps/mobile`): exit 0 |
| Mobile typecheck | **PASS** | `npx tsc --noEmit` (cwd `apps/mobile`) exit 0 at 10:04:13 and 10:05:09 (§6) |
| ONE phone-portrait device check | **PASS** | dems_phone (emulator-5554), 6 screencaps `assets/mobile/84_dems_phone_*.png` (§3) |

## 1. Files (`apps/mobile/src/features/devices/`, P6)

| File | Role |
|---|---|
| `devices-screen.tsx` | MB 7 list (replaces the step-70 stub; export and `SafeScreen id="devices"` kept). Header (Boxes icon + "Devices & Inputs"); V2 Camera Devices, V3 Audio Inputs, V4 Other Devices as `SectionCard` + kit `ListGroup`. A calm `Alert` when a device needs attention. Layouts: phone list → push; phone landscape 2 columns; tablet `pane-list` 360 dp / 40% \| `pane-detail` (selection in `?selected=`) |
| `device-detail-screen.tsx`, `device-detail.tsx` | V5 detail (stub replaced; `SafeScreen id="device-detail"` kept). Hero: live `CameraFeed` (cameras), C-2 `large` meter with CLIP reset (mics), icon plate (others). Status chip + device ID. Kit `Tabs` Overview / Health / Log. Actions Diagnostics, Test signal, Restart |
| `device-row.tsx` | Row: poster thumbnail (cameras; mics with a mic badge), icon tile (PoE, lamp, tablet), status chip or dot + gold chevron. Tablet mic rows carry a C-2 `compact` meter. Lamp halo breathes while recording (`glowBreath`, ambient loop, pauses off-focus) |
| `device-status-chip.tsx` | Status chip and dot. A rise in severity pulses the scale once (`animatePulseOnce(…, SPEC_LITERALS.escalationPulseMs)`, explicit `totalMs`, F74-02), then the colour holds (P7) |
| `device-mic-meter.tsx` | Local copy of the monitor's meter wiring: `useAudioSharedValues` (0 renders per frame), NO SIGNAL bridged on change only (F74-08) |
| `health-chart.tsx` | victory-native `CartesianChart` + `Line`, no `animate` (1 Hz, no tween). Sizes itself by `onLayout` (no Skia `onSize`, D58) |
| `diagnostics-sheet.tsx` | Kit `BottomSheet`: 8 checks, `Spinner` → `StatusChip`, from `state.diagnostics` (simulator clock, no timer). Labels from `system.diagnostics.*` |
| `device-command-dialog.tsx` | Kit `Dialog` for Test signal / Restart. A refusal shows a friendly toast and writes to the persistent runtime log |
| `use-sheet-presence.tsx` | Copy of `features/session-live/use-sheet-presence.tsx` (body byte-identical, `cmp`) |
| `use-devices-data.ts` | `useSim` reads: primitives, store references or flat tuples only (F74-13). Derived values in `useMemo`. Mic 1 s peak line from frame time (sim clock, F74-09) |
| `devices-model.ts`, `device-ids.ts` | Pure: IDs = simulator device IDs (same as the Home tile links), kinds, status codes and tones, escalation rank, i18n keys |
| `sim-adapter.ts` | SIM-GAP-M84-1..3 (§2) |
| `i18n.ts` | `features.devices.*`: mobile-only copy. Everything shared comes from `devices.*`, `common.*` and `system.diagnostics.*` |
| `devices-model.test.ts`, `devices-screen.test.tsx`, `testing/*` | 20 tests. Harness renders the real devices route files on real `AppProviders` with a test simulator. `victory-native` and gorhom are mocked in Jest |

Not touched: `packages/shared/**`, `src/app/**`, navigation, runtime, components, any `package.json`, jest config. No npm install, nothing committed.

## 2. Simulator gaps (local adapters; for steps 54 and 91)

| ID | Gap | Local handling |
|---|---|---|
| SIM-GAP-M84-1 | PoE: the simulator modelled 4 ports ("4/4 Ports Active"). The book has 2 (= W48-1, D79) | `bookPoe()` derives the book view from the cameras: "1 active · 1 spare". PoE CAM 1 stays up while either lens streams; both lenses show PoE CAM 1. **Closed upstream during this run:** step 54 landed `network.poe` = 2/2 with `poweredPorts: 1, sparePorts: 1` (initial-state.ts:299). The adapter ignores the simulator's port count and still agrees with it. Step 91 may switch it to read the new fields |
| SIM-GAP-M84-2 | No per-device health history (= W48-4) | `healthSeries()` uses the simulator's 1 Hz `network.bandwidth.history` (same formulas as web). `MicLevelSampler` records 1 s peaks on frame time while the detail is open |
| SIM-GAP-M84-3 | `deviceCommand` checked no permission | The UI gates Restart on DEVICE_MANAGE and turns it off while recording. **Closed upstream during this run:** step 54's simulator RBAC landed (a command needs a signed-in operator; RESTART needs DEVICE_MANAGE and is refused while recording). The dialog handles a refusal with a toast and a log entry. The model test now signs in first (it failed once at 10:04 when the RBAC landed, then passed) |

## 3. Device check (dems_phone, one session)

`METRO_PORT=8088 apps/mobile/scripts/device-session.sh phone …`, run outside the sandbox, 09:44:37–09:50:58:
- The helper force-stopped the app first and set the bundle host to localhost:8081.
- A small driver held the lock while commands ran one at a time.
- Deep links were quoted (`'demsdemo:///devices'`).
- Sign-in went through the debug handle (`__DEMS_DEBUG__.sim.actions.signInWithBiometric("OPR-001")`), then `loadScenario("idle")`. No password was typed. The CDP eval needed an `Origin` header.
- Taps used screencap coordinates.

| Shot | What it shows |
|---|---|
| `84_dems_phone_mb7_list.png` | **MB 7 checklist met.** The regions, in MB 7 order:<br>• header icon + "Devices & Inputs";<br>• Camera Devices: thumbnail, "Interview Room 1", Online chip, chevron;<br>• Audio Inputs: MIC 1 / MIC 2, "Channel 1/2", Online chips;<br>• Other Devices: PoE Switch "1 active · 1 spare", Recording Indicator "● Active", Tablet Control "● Connected";<br>• Devices tab active.<br>Deliberate differences: Camera 2 is listed, the mic label is "Interviewer", PoE uses the 2-port view (§5) |
| `84_dems_phone_detail_camera_health.png` | Camera 1 detail: live loop with OSD, Online, Health line drawn by victory-native on the device ("Now 99.2%", last 60 samples), Restart off with "Requires the Technician role" (INVESTIGATOR) |
| `84_dems_phone_diagnostics_sheet.png` | The sheet opens on the device (F-79-2 pattern): 8 checks PASS, "All checks passed", Run again |
| `84_dems_phone_detail_mic1.png` | MIC 1 detail: C-2 `large` meter (−52 dBFS), gain 32 dB, 48 V ON, Clip latch Clear |
| `84_dems_phone_detail_mic1_clip.png` | After injecting and clearing MIC_CLIP:<br>• the chip turns amber "Clipping";<br>• the meter's top segment latches red;<br>• Clip latch shows "Reset clip".<br>Tapping it cleared the latch (`clipLatched: false`, read back) |
| `84_dems_phone_faults_recording.png` | Recording scenario + CAMERA_LOSS on VIDEO-02:<br>• calm Alert "1 device needs attention · Camera 2: Fault · Recording continues on the Core";<br>• Camera 2 chip red "Fault" on a dimmed thumbnail;<br>• PoE still "1 active · 1 spare";<br>• the lamp is lit;<br>• the shell's REC mini-bar shows |

Logcat since 09:44:30: `ReactNativeJS` E = 0, crash = 0. The only W is step 69's Reanimated "Reduced motion setting is overwritten". Clean-up: the fault was cleared and the idle scenario loaded (faults 0, no session). The helper stopped Metro 8088 and removed the reverse rules. The emulator was not touched (D78).

Fixed from the device: section cards lost their padding (`px-0` removed); row padding tightened so "MIC 1 – Interviewer" fits; "Run diagnostics" was truncated, so the action buttons are `size="sm"`, the label is "Diagnostics" and the accessibility label is still "Run diagnostics".

## 4. Verification commands

| Command (cwd `apps/mobile`) | Result |
|---|---|
| `npx jest src/features/devices --maxWorkers=2` | 2 suites, 20/20 pass. The colorKit `console.error` lines are Jest-only kit noise; the evidence suite prints the same |
| `npx eslint .` | exit 0 |
| `npx tsc --noEmit` | exit 0 (§6) |

## 5. Decisions and drift

| ID | Kind | Item |
|---|---|---|
| DR-84-1 | decision (spec over brief text) | Mic titles are "MIC 1 – Interviewer" / "MIC 2 – Subject". This is the canonical label in 04 §4.12 V3 and research/04 §9 #8, and the simulator and web (DR-48-6) use it. MB 7 and the brief say "Investigator" |
| DR-84-2 | decision | Both cameras are listed (canonical 2, 04 §9 #7). MB 7 draws only Camera 1 |
| DR-84-3 | decision (D79) | PoE uses the book's 2-port view, "1 active · 1 spare" (shared `devices.other.poeSummary`, same as web), not "4/4 Ports Active" |
| DR-84-4 | decision | The brief's "detail sheet" is built as the spec's detail route/pane: route `/devices/[deviceId]` on phones, pane on tablets (the step-70 route files exist). The bottom sheet is used for diagnostics, per V5 |
| DR-84-5 | decision | Restart needs DEVICE_MANAGE and is off while recording, with a visible reason (D79). Test signal and Diagnostics are open to every role, as on web |
| DR-84-6 | decision | Mic thumbnails use the live camera posters with a mic badge: MIC 1 on lens 1, MIC 2 on lens 2. MB 7's room photos are not separate assets |
| DR-84-7 | decision (P7) | A calm `Alert` lists the devices that need attention (worst first) and says recording continues. The status chip pulses once, then holds its colour. No loops |
| DR-84-8 | note | Health domains follow web (link quality 90–100, PoE 0–30 W, relay 0/1, mic −90–0 dBFS) |

**Relays:** step 54 (SIM-GAP-M84-1/-3 are being closed by its in-flight PoE and RBAC changes; M84-2 is open). Step 91 (`bookPoe` can read `poweredPorts`/`sparePorts`; lift `use-sheet-presence` into the kit). End pass 57/59: the tablet split and rotation (MA-12/13) on dems_tablet, fps, reduced motion. These are covered only by jest in this fast-lane step.

**Persistent issues:** none. **Blockers:** none.

## 6. Final full-app typecheck

Between 09:52 and 10:03, `tsc --noEmit` was red only in `packages/shared/src/sim/actions.ts` and `maintenance.ts`, which step 54 was editing at the time (P11). No `apps/mobile` file was named. A 60 s poller then saw it clean:
- **10:04:03 and 10:04:13: `tsc --noEmit` exit 0**, `eslint .` exit 0;
- 10:04: own jest 19/20. The new simulator RBAC rejected an unsigned `deviceCommand` in one model test. Fix: sign in as the TECHNICIAN first;
- **10:05: own jest 20/20, `tsc` exit 0 (10:05:09), `eslint .` exit 0.**

**D100 (controller message, received after the device check):** future device checks may use whichever emulator is free (probe `lockf -k -t 0 .locks/dems_tablet.lock true`), or `any-phone` once 72_second_phone_avd.md exists. This step's single check was already done on dems_phone (§3); no re-run is needed.

---
*Generated: 2026-10-01 10:06 WIB*
