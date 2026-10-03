---
task_id: 2026-09-30_dems_demo_stack_setup
step: 83 (blueprint row 83, rev 4; 05_mobile_plan M-12)
lane: mobile, Metro 8084 (D72); fast lane from 09:16 (D75)
date: 2026-10-01
agent: coder-execution
narrative_tier: 3
status: complete (D75 fast lane); tablet list/detail and tablet playback moved to the end pass by the controller
decisions: D17, D28, D38, D43, D50, D51, D55, D58, D61, D66, D67, D68, D69, D72, D73, D75, D78
---

# Step 83: mobile Evidence list, detail, export and play sheets (M-12)

Run on 2026-10-01, 05:40–07:04 and 09:16–09:34 WIB (controller-side interruption in between), from `/Users/gsp-budi/Documents/DEMS`.

**Outcome:**
- The Evidence list (MB 5) and detail (MB 6) are built, with the Media, Metadata and Hash & Integrity tabs, the Play sheet, the Export wizard and the tablet list | detail split.
- **D68 is proven on dems_phone: expo-video plays the audio-only MIC tracks.** Each m4a gets its own ExoPlayer, AAC decoder and Android AudioTrack. One track is audible at a time, and MIC 1 / MIC 2 swap on the switch (§3). **No expo-audio slot is needed (no P12 request).**
- JS gate: typecheck and lint exit 0 on the whole app at 09:17. My own tests pass: 4 suites, 40 tests (09:30).
- The full mobile suite is not green: 10 tests fail in step 70's navigation suites. Three of them belong to this step: stub assertions that real screens retire (R-83-1).
- This report also records one process incident (§6).

## 1. Row-83 acceptance

| Row-83 check | Result | Evidence |
|---|---|---|
| T-M15 passes | **PASS** | `evidence-list.test.tsx`, 7/7, real routes, real simulator: filters, search, sort, tablet-landscape `pane-list` + `pane-detail`, selection fills the pane (glow e2), deep-link hand-over, phone push and Back |
| A test shows PASS for a pristine item and FAIL for the tampered one | **PASS** | `evidence-model.test.ts`: EV 0001 PASS with 4 rows; EV 0005 FAIL with `failed = ['track:AUDIO-02']`; 13 PASS + 1 FAIL over the 14 packages. `evidence-detail.test.tsx` repeats this through the UI: Verify → PASS for 0001 and FAIL on AUDIO-02 for 0005 |
| Play sheet plays on both AVDs (screencaps) | **phone PASS; tablet → end pass (D75)** | Phone: §3 and the `83_dems_phone_final_play_dialog_*` / `…play_sheet_*` screencaps. Tablet playback was not run before the controller moved the tablet to the end pass |
| MA-11 MB 5 and MB 6 checklists on dems_phone | **PASS** | §4; contact sheet `83_dems_phone_ma11_contact.png` |
| MA-12 evidence part on dems_tablet | **PASS** (07:00) | `demsdemo:///evidence?selected=EV-20260930-0004` survives sign-in. Frame 2560×1600. `nav-rail [0,0][464,1600]` with 8 `nav-item-*`, `pane-list [464,48][1270,1536]`, `pane-detail [1318,48][2528,1536]`, detail ID EV-20260930-0004. Screencap `83_dems_tablet_ma12_evidence_split.png` |
| MA-13 selection part on dems_tablet | **PASS under full motion; re-check → end pass** | Portrait 1600×2560: 88 dp rail (176 px), `pane-list` 720 px (360 dp), the selection is kept, PID 11527 unchanged (07:01:53). Two device findings: the landscape return skewed the split, now fixed in code but not yet re-verified (F-83-5); panes freeze under reduced motion, which is not my file (F-83-4). Screencaps `83_dems_tablet_ma13_*` |
| Mobile typecheck, lint, jest exit 0 | **typecheck 0, lint 0 (09:17); own jest 40/40; full jest 10 failures** | The full run at 09:2x gave 54 suites / 681 tests, 10 failed, all in `src/navigation/__tests__/{routes,guard}.test.tsx`. Three are this step's (R-83-1); the rest belong to steps 78 and 80. A second typecheck and lint at 09:33 failed only in concurrent files of steps 81 and 85 (P11). `features/evidence` itself: 0 TS errors, 0 lint problems |

## 2. Files (P6 write set: `apps/mobile/src/features/evidence/**` only)

| File | Content |
|---|---|
| `evidence-list-screen.tsx` | Replaced the stub. E1 header (emblem, title, `Menu` for Sort and Density), E2 `SearchField`, E3 status `TagGroup` (scrolls horizontally), E4 `FlashList` rows (skeleton, empty state with "Clear filters"). Tablet `PaneLayout`: medium 360 dp \| detail; expanded 40 \| 60 with a zero flex basis. Kebab Export sheet and Archive dialog at list level |
| `evidence-detail-screen.tsx` | Replaced the stub: `SafeScreen id="evidence-detail"` around `EvidenceDetail` |
| `evidence-detail.tsx` | D1–D6: header, hero (expo-image poster, gradient, backed status chip), ID and time with the manifest's GNSS badge, facts (`ListGroup` + icons), kit `Tabs`, pinned actions (Play, Export, More `Menu`). Landscape phone: 40 \| 60 columns |
| `evidence-row.tsx`, `evidence-chips.tsx` | Row card (`PressableFeedback` + `Card`) and kebab `Menu` (View, Verify, Export, Archive, RBAC-gated). Chips: Sealed violet + `Lock` (D28); subject chip takes the simulator code (step 78's kit change, F74-03) |
| `media-tab.tsx`, `metadata-tab.tsx`, `integrity-tab.tsx` | D5a–D5c. Metadata: 13 §11.3 fields, plus the byte-exact `manifest.json` in a `ScrollShadow`, plus EV 0004's §19.2 export entry. Integrity: "Verified by the Core" + `DEMO - precomputed`, Verify → Spinner → per-row scramble (600 ms, ≤ 20 updates) → PASS pop / FAIL pulse (explicit `totalMs`, F74-02), full hashes, C-4 lifecycle, custody `ListGroup` |
| `play-sheet.tsx`, `use-evidence-playback.ts` | Player: `VideoView` + kit `Slider` (recorded duration), Play/Pause, CAM `Tabs`, MIC `TagGroup`, "Simulated playback" and "DEMO excerpt" chips. Three expo-video players; the excerpt rule p mod clip; 4 Hz position; 1 Hz drift re-seek; pause on close, unfocus and app background. No media → `CameraFeed` procedural playback |
| `export-sheet.tsx`, `archive-dialog.tsx` | C-4 wizard: Authorize (Core 403 + EXPORT_DENIED for non-supervisors, lock-shackle motion), Verify source (FAIL blocks), Destination (`RadioGroup`), Reason (`TextArea`, ≥ 5 trimmed, inline `FieldError`, keyboard-height padding), Build and hash → `exportEvidence`, Done. Archive confirm `Dialog` |
| `sheet-frame.tsx` | Kit `BottomSheet`, mount-on-demand (step 79's pattern, D78), opens after its body lays out; under reduced motion it renders a kit `Dialog` instead (F-83-1). Re-provides `SimContext` |
| `evidence-model.ts`, `evidence-media.ts`, `use-evidence-data.ts`, `use-scramble.ts`, `detail-intent.ts` | Pure rules, media join (EV 0001–0013 bundled, 0014 live loops), flat `useSim` selectors (F74-13), scramble, kebab → detail intent |
| `sim-adapter.ts` | SIM-GAP-M83-1 guard (`recordCoreVerification`), SIM-GAP-M83-2 note (§5) |
| `i18n.ts` | `features.evidence.*` (shared keys reused for shared terms; MA-21: 0 missing keys asserted in the list and detail suites) |
| Tests | `evidence-list.test.tsx` (7), `evidence-detail.test.tsx` (7), `play-sheet.test.tsx` (5), `evidence-model.test.ts` (21); test-only `testing/{evidence-test-setup.ts, evidence-harness.tsx, kit-helpers.ts}` |

**Not written:** `packages/shared/**`, `src/{app,navigation,runtime,components,layout,motion}/**`, any `package.json`, jest config or lockfile. No npm install, no Gradle, no native change, nothing committed.

**Also written:**
- 54 screencaps `implementation/assets/mobile/83_*`; some come from debugging runs and are named as such (`*_dbg`, `*_try2`, `*_full_*`);
- `delegation_progress/coder_execution_step_83.md`.

## 3. D68: expo-video plays the audio-only m4a MIC tracks (dems_phone)

| Run (host time) | Evidence |
|---|---|
| 06:40:45 (sheet) | logcat: `ExoPlayerImpl: Init` ×3. `CCodec … mime = "video/avc"` ×1. `audio/mp4a-latm` ×2 (two `DMCodecAdapterFactory … track type audio`). `dumpsys audio` players before Play: none. After Play: two `type:android.media.AudioTrack u/pid:10215/10140 state:started … sampleRate=24000 channelMask=0x1`, one `mutedState:none` (MIC 1), one `mutedState:clientVolume` (MIC 2) |
| 06:49:32–06:49:41 (sheet) | MIC 2 tapped → the mute states swap (`piid 503 clientVolume`, `511 none`). Seek → new AudioTracks (ExoPlayer re-creates them on seek). Pause → both `state:paused` |
| **09:30:33–09:31:31 (final run, reduced-motion Dialog form)** | 3 ExoPlayer inits, 1 video/avc, 2 audio/mp4a-latm decoders (device clock 11 s behind the host; inits at device 09:30:22.8–23.1 = host 09:30:33.8). MIC 1: `663 started none`, `671 started clientVolume`. MIC 2: `663 clientVolume`, `679 none`. Seek to 00:14:29 → the clip OSD reads 13:22:29 (869 s mod 42 s = 29 s, the excerpt rule). Pause → `paused` ×2. Close → no AudioTrack (players released). Screencaps `83_dems_phone_final_play_dialog_{mic1,mic2,seek,cam2,paused}.png` |

The 24 kHz mono format is step 92's mobile rendition. For EV 0005, AUDIO-02 plays the bundled rendition, not step 93's altered desktop file; integrity is the Core's (package) result (D51).

## 4. MA-11 checklist (dems_phone, 1080×2424, `83_dems_phone_mb5_list.png`, `…final_mb6_detail.png`, contact sheet)

| MB 5 region | Present | MB 6 region | Present |
|---|---|---|---|
| E1 emblem + "Evidence" + list icon | yes | D1 back + "Evidence Details" | yes |
| E2 search "Search session ID, subject, or case number…" | yes | D2 poster hero, status chip top right (violet Sealed) | yes |
| E3 All / Recorded / Sealed / Exported (+ Under Review scrolls) | yes | D3 mono ID + time range + GNSS badge | yes |
| E4 thumbnail, mono ID, date, subject, subject chip, mono duration, status chip, kebab | yes | D4 Case Number, Subject + chip, Investigator, Location, Duration, File Size, Status, each with an icon | yes |
| E5 tab bar, Evidence active | yes (shell) | D5 Media / Metadata / Hash & Integrity; D5a poster strip with play rings | yes |
| Recorded decisions | Sealed violet (D28); synthetic DEMO data | D6 Play / Export / More | yes (pinned) |

Differences:
- The media strip shows 2 camera posters and the 2 MIC tracks, but no snapshots (SIM-GAP-M83-2).
- The shell keeps the tab bar on the drill-in route.
- Posters carry step 92's burnt-in OSD times.

## 5. SIM-GAPs, decisions and drift

| ID | Kind | Item |
|---|---|---|
| **SIM-GAP-M83-1** | sim gap → steps 54/91 | The simulator seals EV 0005 with `tampered: false` (`dataset.ts:753`), but the DEMO package fails `track:AUDIO-02`. The Core's `verify()` would write "every hash matches". `recordCoreVerification` computes the simulator verdict first (pure `verifyEvidenceItem`) and calls `verify()` only when it agrees with the package; otherwise it writes nothing and logs `evidence.verify.simGap` (info). **Fix:** mark 0005 tampered on AUDIO-02 in the dataset; the guard then records it unchanged |
| **SIM-GAP-M83-2** | sim gap | `EvidenceItem` carries no snapshots or markers; the Media strip omits snapshots |
| DR-83-1 | design | The Play sheet drives its own expo-video player: CameraFeed has no seek API (45 §3.1 allows either). CameraFeed is the no-media fallback |
| DR-83-2 | design | Destination uses `RadioGroup` (2 options) instead of `Select`, avoiding a portal inside a sheet |
| DR-83-3 | design | Facts use `ListGroup` + `ItemPrefix` icons, because the `KeyValueList` recipe has no icon slot. The Metadata tab uses `KeyValueList` |
| DR-83-4 | design | A filter or sort change re-reveals the keyed `FlashList` (row stagger) instead of a `LinearTransition` inside recycled cells |
| DR-83-5 | design | A FAIL source blocks export (§19.3 rule 3). Done shows the sealed manifest SHA, not a zip hash: zips exist only for exported items (D51). EV 0004's real export entry is in Metadata |
| DR-83-6 | design | A non-supervisor's export attempt is sent, so the Core audits EXPORT_DENIED (EVT-26) |
| DR-83-7 | design | Hashes are shown in full, wrapping. Android middle-ellipsis clipped them (device) |
| DR-83-8 | design | The six-step wizard uses the horizontal C-4. Labels wrap ("Authoriz e"; the soft hyphen in "Destination" is not honoured by Android). Cosmetic |
| DR-83-9 | plan | 05 M-12 names `51_mobile_evidence.md`; row 83 names `55`. The blueprint is followed |

## 6. Device findings, incident and relays

| ID | Item | Route |
|---|---|---|
| **F-83-1** | Under reduced motion (kit `disable-all` forces gorhom `reduceMotion: Always`), a kit `BottomSheet` often stayed parked below the screen on a fresh start. Its content was already mounted and the players were audible. `overrideReduceMotion` alone was not reliable (1 success, 1 failure). **Fix here:** reduced motion renders a kit `Dialog`. Device PASS at 09:30 | **Step 79** (same kit sheets) and the end pass |
| F-83-2 | `keyboardBehavior` / `keyboardBlurBehavior` / `android_keyboardInputMode` on the sheet stopped it presenting at all. Removed; the wizard pads itself by `useKeyboardState` height. Device PASS: the reason field stays above the keyboard (`83_dems_phone_final_export_reason_keyboard.png`) | Step 79 FYI |
| F-83-3 | A sheet opened one frame after mount stays parked when its body needs longer to lay out (VideoView). The frame now opens after the body's `onLayout` | Step 79 FYI |
| **F-83-4** | `src/layout/pane-layout.tsx` `PANE_REFLOW` (`LinearTransition … ReduceMotion.System`) freezes pane frames on rotation under reduced motion. Tablet portrait under `?motion=off` kept the landscape widths, and the detail ran off-screen. Suggested fix: `layout={reduced ? undefined : PANE_REFLOW}` | Layout owner / step 91; affects every pane screen |
| F-83-5 | `Pane flex` keeps an automatic basis: after portrait → landscape the split skewed to 1238 \| 778 px instead of 40 \| 60. Fixed locally with `flexBasis: 0`; **not yet re-verified on the tablet** | End pass; suggest a `Pane` default |
| **F-83-6 (incident)** | My interactive tablet session (`device-session.sh` + an agent loop) held **`dems_tablet.lock` and Metro 8084 from 06:58 to 09:16:32**. The helper's 1740 s cap never fired (hypothesis: Perl deferred signals: the SIGALRM handler does not run while `waitpid` blocks). I stopped it at 09:16 with `kill -TERM` on my own perl wrapper. The helper then cleaned up: Metro stopped, the reverse rules were removed, and port 8084 was free. Later sessions use a self-bounded loop (`AGENT_SECS`) | **Controller** (lock held for 2 h 18 min); step 67's helper owner |
| F-83-7 | 09:19:28: the phone lost its `tcp:8081` reverse rule mid-session ("Cannot connect to Expo CLI"; cause unknown, P11). That run was discarded and redone | P11 record |
| F-83-8 | After every password sign-in, the biometric "enable" offer dialog covers the screen. Device tooling must decline it (`biometric-offer-decline`) | Steps 57/59 tooling |
| **R-83-1** | `routes.test.tsx:32–33` and `guard.test.tsx:50` assert `stub-param-selectedId` / `stub-param-evidenceId`, which the real Evidence screens retire. Suggested replacements: `screen-evidence` + `getSearchParams().selected`, and `evidence-detail-id` text | **Step 57** (T-M02 on real screens) / owner step 70 |
| R-83-2 | The tablet end pass should cover: Play sheet + audio on dems_tablet; the MA-13 landscape-return split after F-83-5; rotation under reduced motion after F-83-4 | End pass |

## 7. Processes (P7, D78)

- No emulator was killed or rebooted.
- Every Metro run (8084) was stopped by the helper. The last device session ended at 09:32:36 with status 0.
- `adb reverse --list` was empty on both serials at 09:16:50 (phone rules at that moment belonged to step 80's session).
- The installed APK hash is `cb6b1f51…` (step 72) on both AVDs: phone 09:18, tablet 06:59.
- Simulator state changed on the phone: one re-export of EV 0004 (EXP-000032, status unchanged EXPORTED). Verify added an EVIDENCE_VERIFIED row and a custody entry for EV 0013. The guard wrote nothing for EV 0005 (SIM-GAP-M83-1).

## 8. Persistent issues

| Issue | Attempts | Root cause | Status | Blocking? |
|---|---|---|---|---|
| Full mobile jest not green | n/a | Step 70's stub assertions (R-83-1) | Relay | No (not my files) |
| Tablet re-checks (F-83-5, playback) | 1 (stuck session) | Session incident F-83-6, then the D75 re-scope | End pass | No |

## 9. Rollback

Restore the three step-70 stubs and delete the other files listed in §2:
- `evidence-list-screen.tsx` and `evidence-detail-screen.tsx`: `ScreenStub` bodies with the same exports and props (contract in `43_mobile_navigation_shell.md` §2);
- `i18n.ts`: `evidenceEn = {}`. No native, package or shared change was made.

---
*Generated: 2026-10-01 09:40 WIB*
