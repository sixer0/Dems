---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave M, driver M-M (apps/mobile only, with the tablet `emulator-5556` = `DEV-0001` and the phone `emulator-5554` = `DEV-0002`, both on lane 2)
date: 2026-10-11
agent: coder-execution
narrative_tier: 2
tree: commit 7b1aded + wave M (M-S, M-W in the same working tree); no git write by me
source: delegation_progress/fix_brief_wave_m.md, contract_wave_m.md; gateway_check/09d, 10e, 12d; decisions D232, D234, D235, D236
status: needs-review
---

# 160 - Fix wave M, driver M-M (mobile)

Run window 14:47 - 15:50 WIB. `apps/mobile` only. No git write, no install, no Gradle build, no lane
restart or reset. No LOCAL_DEVICE source was selected, pre-checked or started; no attendance variable;
nothing was played (media volume read 4 / 5 at the start and at the end, never changed); the biometric
offer was answered "Not now" each time; the sign-in fields were checked empty before typing; no field
content, password, token or fixture account is in a file of this run. Screenshots, tools and the two
logcats: `.cache/gates/wave-m-m/` (git-ignored).

**Status needs-review** because of section 4 (the dead Back of G70d-03 (a) was NOT reproduced; the cause
of G75e-01 is established as a condition, not as a mechanism) and the decisions of section 5.

## 1. Per finding

### G70d-03 - Session New: the ways out of an armed session; a session cancelled elsewhere

- **(b) the stale form - REPRODUCED on the tablet, cause in code.** Session created and pre-checked on the
  tablet, cancelled through the API: the form stood at step 1 with its case number and subject, Next
  enabled (`t_02_repro_stale_form_values.png`). Cause: `session-new-screen.tsx` kept the
  react-hook-form values of the session it had created; nothing read "the session this form belongs to
  is gone" (the step alone followed the state, `effectiveStep`).
- **(a) "Back does nothing" - NOT REPRODUCED in six drives on the tablet** (plain; after two earlier
  visits left with Back; after a link cut with `adb reconnect` and both rules restored; after a relaunch
  with the armed session open, where the wizard is the root screen; on the stale form of (b); each with
  the on-screen arrow and the system Back). In every drive the arrow opened "Cancel this session?" (or
  "Discard this session?") - `t_00_repro_back_armed.png`. What I did see: the dialog TOGGLES - a second
  tap at the arrow's coordinates lands on the dialog's overlay and closes it, and a system Back closes an
  open dialog. A read after an even number of presses shows no dialog. Whether that is what re-check 70
  met is not established (its one path I could not drive is the visit after a declined local-source
  notice: it needs a LOCAL_DEVICE source on a track). No change was made "against" a cause I did not see.
- **Spec.** `08_client_ux_spec.md` is silent on Session New's back / cancel; `04_mobile_specs` section 3.6
  (cited in `flow-guard.tsx:1-13`) says Back on a session in CREATE / PRECHECK / ARMED asks and cancels.
  Built as the brief's fallback, keeping that dialog:
  - the dialog "Cancel this session?" now has THREE choices and says what they do: "Keep session",
    **"Go to Home, keep the session open"** (nothing is sent; Home offers "Continue setup"),
    "Cancel session" (`navigation/back-guard.tsx`, prop `onGoHome`; strings
    `mobile.backGuard.goHomeKeepSession`, `.flowChoices` in `i18n/en.mobile.ts`);
  - the header has an explicit **"Cancel session"** control while a session exists
    (`session-new-header.tsx`, `session-new-cancel`); it opens the same confirm without a back attempt
    (`flow-guard.tsx` `ask()`);
  - **the session of the form is gone** (`formSessionGone`, `session-new-model.ts`; the screen follows
    ONE session and compares it in render): the form is cleared, the notice "The session was cancelled /
    SES-... was cancelled on another client. Nothing was recorded. This form was cleared: enter the
    details again to start a new session." is drawn, an open confirm closes, Next is disabled, Back
    leaves without a question. The screen's own cancel and the start of the recording are not "gone".
  - Operation 31 `cancelSession` takes no body: there is no reason member to send (contract totals do not
    move). Decision 1.
- **Found on the way:** `form.reset()` with `subjectType: undefined` leaves the chosen subject type in its
  mounted field (react-hook-form gives the field its own last value back) - the cleared form stayed
  "typed". The gone-session reset uses `null` for that field. The header menu's "Clear form" has the same
  behaviour (seen, not changed).
- **Test (existing files).** `session-new/live-session-new-followups.test.tsx` - new describe "a session
  in setup has its ways out, and a session cancelled elsewhere clears the form (G70d-03)", 4 cases
  (go-home choice sends nothing and keeps ARMED; header control present only with a session and its
  confirm cancels; cancelled on another client; CONTROL own cancel); `session-new-model.test.ts` -
  `formSessionGone`, 6 rows. The bed got one helper `coreDoes` (`testing/live-session-new-bed.tsx`).
  Output: `Tests: 13 passed, 13 total` (follow-ups file).
- **Proven on the devices.** Tablet, `SES-20261011-0069`: on-screen Back -> the three choices
  (`t_22_back_dialog_three_choices.png`); system Back -> the same three; cancelled through the API ->
  notice naming `SES-20261011-0069`, case number and subject back to their hints, Next disabled, Back ->
  Home (`t_23_form_reset_after_cancel_elsewhere.png`). `SES-20261011-0070`: Back -> "Go to Home, keep the
  session open" -> Home "Ready for Recording", action "Continue setup", session still ARMED
  (`t_24_home_continue_setup_session_kept.png`) -> "Continue setup" -> step 3 with "Cancel session" in
  the header -> confirm -> session gone, Home. Phone, `SES-20261011-0071`: on-screen Back, system Back
  and the header control each open the three choices (`p_20_back_dialog_three_choices.png`); cancelled
  through the API -> notice + cleared form + disabled Next, Back -> Home
  (`p_21_form_reset_after_cancel_elsewhere.png`). The phone's "Go to Home" choice: by test (same component).

### G70d-02 - one wording rule on the Devices rows and detail; microphone names

- **Cause.** `devices/device-row.tsx` (`CameraRow`, `MicRow`) and `device-detail.tsx` (chip `:224`,
  "Status" rows of `CameraOverview` / `MicOverview`) drew `STATUS_LABEL_KEY[status]` of the simulator's
  track model ("Online") on every Core; the names came from `features.devices.mic.title1/2`
  ("MIC 1 – Interviewer", "MIC 2 – Subject").
- **Change.** ONE reader `sourceRowLine` + hook `useSourceRow` (`devices/use-devices-data.ts`): on a Core
  in its own capture the word is the selector line's own (`sourceStateWord`, D231): "Not checked" at rest
  unless the Core states a checked fact; a negative fact is never replaced (a track that reports NO
  SIGNAL / CLIP / FAULT / OFFLINE keeps its chip); "Live" only for a camera on a line while a session
  records. The microphone rows and the detail header are named from the selector in force:
  "MIC 1 · Primary", "MIC 2 · Standby" (they swap when the roles swap). `DeviceStatusChip` got an optional
  `word`. The row title may take two lines (the role was cut in the tablet's narrow list).
  The simulated lane is unchanged.
- **Test (existing file).** `devices/wave-l-z-one-rule.test.tsx` - new describe "G70d-02 ..." x 2 layouts
  (rows at rest; names follow a role swap; checked fact = "Reachable"; recording = "Live"; detail chip and
  "Status" row of `CAM-01` and `MIC-02`), and three CONTROL lines in the simulated-lane case ("Online",
  "MIC 1 – Interviewer" stay). Output: `Tests: 29 passed, 29 total`.
- **Proven on the devices (at rest).** Tablet list: `device-status-CAM-01 / -CAM-02 / -MIC-01 / -MIC-02`
  = "Not checked"; rows "MIC 1 · Primary, Generated test source, Not checked", "MIC 2 · Standby, ..."
  (`t_30_devices_list_at_rest.png`); detail of `CAM-01`: chip "Not checked", "Status, Not checked", tile
  "Not checked" (`t_31_detail_cam01_at_rest.png`); `MIC-02`: header "MIC 2 · Standby", chip and Status
  "Not checked" (`t_32_detail_mic02_at_rest.png`). Phone list: the same four rows
  (`p_30_devices_list_at_rest.png`); detail of `MIC-01`: header "MIC 1 · Primary", chip and Status "Not
  checked" (`p_31_detail_mic01_at_rest.png`). **While recording** (`SES-20261011-0072` / `-0073`): phone
  rows "Camera 2 ... Live", "MIC 1 · Primary ... Reachable" (`p_22_devices_list_live_while_recording.png`),
  tablet rows the same (`t_26_devices_list_rows_while_recording.png`). Simulated mode: by test only.

### G75e-01 - phone Home: the Camera tile an empty box while a session records

- **REPRODUCED, three times, and the condition found.** The tile is empty exactly when the recording
  STARTS WHILE HOME IS NOT THE TAB IN VIEW (the phone on Evidence or Devices; the session started on
  another client): seen in M-W's `SES-20261011-0064` at 12 s
  (`p_01_repro_home_camera_tile_empty_while_recording.png`) and in my `SES-20261011-0072` at 5 s
  (`p_03_...`), still empty at 13 s after a visit to Devices and back (`p_04_...`). When the recording
  started while the phone stood on a screen pushed OVER the tabs, the tile was drawn "Camera / Live / 2/2"
  (`p_02_home_tile_drawn_while_recording_0066.png`). The data was right each time (the test of wave L
  read "Live" from the same props); no JS error, no mount warning at that moment. **The mechanism inside
  the platform is NOT established** (why this one tile's views come back empty after being patched while
  their tab screen is detached - the microphone tile beside it is patched in the same commit and stays).
- **Change** (`dashboard/status-tiles.tsx`): (1) the tiles change only while the screen is in view - a
  change that arrives while another tab is in view is held and applied in the render in which Home is
  focused again; (2) a tile whose STATEMENT changed (`tileStatement`: state, tone, total, count) is
  mounted as a new tile, so its views are created with their final content; only the tiles of the first
  render play the enter motion and the held count.
- **About the brief's wording** ("the 'No preview' treatment with the track's name"): the phone's Home has
  no camera preview tile - its Camera tile is the COUNT tile. In real capture, while recording, it now
  reads "Camera / Live / 2/2". The tablet's Home draws the "No preview" tiles with the track's name.
- **Test (existing file).** `dashboard/wave-l-m-home-notice-tiles.test.tsx` - new describe "G75e-01 ...",
  3 cases (in view: "Camera / Live / 2/2" and it is a new tile; not in view at the start: held, then drawn
  whole; CONTROL: a moving value keeps its tile). Output: `Tests: 16 passed, 16 total`. The test holds the
  two rules; it cannot show the empty box (jest has no native views).
- **Proven on the phone, same recipe as the reproduction** (phone on Evidence, session started on the
  tablet, `SES-20261011-0073`): Home at 5 s and at 11 s: "Camera / Live / 2/2", "Microphone / Reachable /
  2/2" (`p_23_home_tile_live_while_recording_fixed.png`, `p_24_home_tile_live_later.png`).
- **Tablet Home in the same recordings:** the four tiles are drawn - "No preview / Camera 1 · Camera
  CAM-01", chips "READY" (camera) and "Reachable" (microphone) (`t_21_home_while_recording_0066.png`,
  `t_25_home_while_recording.png`). Not empty. See "seen, not changed" 2.

### G89d-03 - tablet item page: tab strip under the action bar; list durations cut

- **Cause, read on the tablet with `uiautomator`** (`t_03_repro_item_first_position.png`): the scroll view
  of the pane ends at y 1350, the tab strip starts at y 1488 - it is entirely BELOW the first screen, and
  the fixed bar covers y 1398-1536. The view tree reported the strip with inverted bounds
  (`[1356,1488][1499,1350]`), whose "centre" lies on the bar: the tap opened Export. For the eye nothing
  showed that the page has tabs. List: the chips row of `evidence-row.tsx` did not wrap - in the narrow
  list pane the duration (`[1161,526][1238,558]`) ran on under the menu button (`[1136,482][1216,562]`).
- **Change.** `evidence-detail.tsx`: in the tablet's PANE the tab strip is pinned outside the scroll view,
  under the pane's header (`evidence-detail-tabs-pinned`); choosing a tab brings the tab's body to the top
  of the scroll view. The phone screen keeps the strip in its content (there it shows at the fold:
  strip y 1918-1960, bar from y 2023). `evidence-row.tsx`: the chips wrap (`flexWrap`), the duration is
  one unshrinkable line (`evidence-row-duration-<id>`).
- **Test (existing files).** `evidence/evidence-detail.test.tsx` - new describe "the tab strip and the
  action bar never overlap (G89d-03)": the three tabs are inside the pinned strip, outside the scroll view
  and outside the bar; order header / strip / scroll / bar; a press opens Hash & Integrity, no export
  sheet; CONTROL phone. `evidence/evidence-list.test.tsx` - the chips wrap, the duration does not shrink
  and the menu button is not in the chips row. Output: `Tests: 17 passed, 17 total` (both files).
- **Proven on the tablet** (`EV-20261011-0043`, first scroll position): strip `[1318,176][2528,276]`, tabs
  y 182-254; scroll view `[1318,276][2528,1350]`; bar `[1318,1398][2528,1536]` - no intersection
  (`t_10_item_first_position_tabs_pinned.png`). Real taps at the first position: "Hash & Integrity" ->
  "Verified by the Core" (no export sheet; `t_11_item_tab_integrity_by_tap.png`), "Metadata" -> the
  record, "Media" -> the media panel. List: duration `[734,618][850,650]` ("00:00:49", whole), menu
  button `[1136,570][1216,650]` - no intersection.

### Notification B on the devices (item 5; D232) - DRIVEN, no code change needed

- **Read against `contract_wave_m.md` M-S 1:** the mobile code reads the check row by `value:
  "UNREACHABLE"` and `params { deviceId, deviceKind, rule }` (`capture-notices-model.ts:157-166`; the Core
  writes `deviceKind` too, `packages/shared/src/sim/session-machine.ts:477`), the sentence from
  `params.rule`, the count from the alert's `params.searchResponderCount` (`:67`). It matches. The choices
  the app offers are "Search again" (under `CAPTURE_CONFIG`) and "Run checks again"; **"choose another
  source" is not a control of this step** - the selector is locked while a session exists, and the spec
  says choosing another source is an ordinary selector edit (`08_client_ux_spec.md:1363`). Decision 2.
- **Driven (rig announced in `contract_wave_m.md`, 15:38-15:42).** `source-rig 2 unreachable CAM-02`.
  **Tablet**, investigator (`SESSION_START`, no `CAPTURE_CONFIG` - this is also `M4-NODEV-NOCFG-T`), new
  session `SES-20261011-0074`: "Warnings to review", "Camera 2 (CAM-02) is not reachable. The session will
  record one camera only.", "A search found 1 camera.", "Search again" DISABLED with "Requires the
  Supervisor or Technician role", "Acknowledge warnings", Next disabled until acknowledged, row "Video Lens
  2 ... WARN" (`t_40_notice_b_precheck_cam02_unreachable.png`). Core: ONE alert `ALR-000111` (WARNING,
  `phase PRECHECK`, `cause UNREACHABLE`, `searchResponderCount 1`), audit 1151
  `CAPTURE_DISCOVERY_SEARCHED` (`trigger PRECHECK`, `DEV-0001`), 1152 `CAPTURE_DEVICE_UNREACHABLE`
  (`degraded true`). `source-rig 2 release` -> "Run checks again" -> "All checks passed", "Video Lens 2
  READY PASS", no notice node, alert `active false` with `resolvedAt`
  (`t_41_notice_b_after_release_pass.png`); session cancelled with the header control. **Phone**, rig on
  again, `SES-20261011-0075`: the same sentence, count, disabled "Search again" with the role sentence
  (`p_40_...`); the tablet's Home bell counted 1 meanwhile (`t_42_...`); release -> "Run checks again" ->
  "All checks passed", 0 notices (`p_41_...`); cancelled. 60 alerts, none active; rig OFF (read).
- NOT driven: "Search again" pressed by a role that holds `CAPTURE_CONFIG`; the start after the
  acknowledgement (no recording on one camera was made); both cameras unreachable (BLOCK); a microphone.

## 2. Checks I ran (one run each, after the last edit)

| Check | Result |
|---|---|
| `npx tsc --noEmit -p apps/mobile` | clean |
| `npm run lint -w apps/mobile` | 0 errors, 1 warning (`src/runtime/log.test.ts:160`, not mine) |
| `npm test -w apps/mobile -- src/features/{session-new,devices,evidence,dashboard,capture-selector,home,sessions,session-live,session-finalizing} src/navigation src/i18n test/` | `Test Suites: 176 passed, 176 total / Tests: 1474 passed, 1474 total` |
| Logcat over the proofs (14:48 - 15:47; the tablet's reader was resumed once after the link cut) | tablet 715,554 lines, phone 165,194 lines: 0 `FATAL EXCEPTION` / `ANR in`, **0 error-level `ReactNativeJS` lines, 0 runtime records of level error**. Warn records: 2 x `features.sessionNew.cancelledElsewhere` (the new, intended record), and once on the tablet at 15:23 `live.client` "No answer within 8000 ms" for `beginPrecheck` (verdict `js-starved`, the timer 4.5 s late; the session armed by its deltas - seen, not changed 4). Mount warnings counted only: 3,241 / 633 |

## 3. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm test -w apps/mobile` (whole workspace) | none | green; section 2 is a subset |
| `npm run typecheck -w apps/mobile`, `npm run lint -w apps/mobile` | none | clean / the one known warning |

## 4. Not proven / re-drive list

1. G70d-03 (a): the dead Back was not reproduced (six drives); nothing was changed for it beyond the
   explicit ways out. Re-drive: the verifier's own sequence; if Back "does nothing", press once and read
   the screen before a second press (the dialog toggles).
2. G75e-01: the platform mechanism is not established; the fix is proven for the reproduced condition
   (recording starts with Home on a hidden tab). Re-drive: phone on Evidence, start a session on another
   client, open Home.
3. The phone's "Go to Home, keep the session open" choice and "Continue setup" (tablet driven; phone by test).
4. Notification B: the items listed as NOT driven above.
5. Simulated mode on a device (lane 1 has no device): pinned by tests only.

## 5. Decisions for the controller

1. **"Cancel session ... with a reason" - no reason is sent**: operation 31 has no body. A reason member
   would be a contract change (M-S / next task).
2. **"Choose another source" is not offered at the pre-check** (selector locked while a session exists;
   spec `:1363`). The operator's way is: cancel the session (now one press in the header), change the
   selector on Devices, start again. If a link "Cancel and open Devices" is wanted, it is a small addition.
3. **The back dialog has three choices in BOTH data modes** (one behaviour); the simulated lane's tests
   hold. The phone header's title is cut to "Start New Sessi..." beside "Cancel session"
   (`p_20_...`): an icon-only control would free the title - not done (a labelled control was asked).
4. **G75e-01's fix holds tile changes while Home is not in view.** If the platform cause is found later,
   rule 1 can go; rule 2 (a changed tile is a new tile) is the Stepper's precedent.
5. **Lapses.** (a) Both recordings ran about 37 s, not 45 (`SES-20261011-0072` -> `EV-20261011-0050`,
   `-0073` -> `EV-20261011-0051`; stop body with a reason). (b) At 15:16 my form-fill helper ran while the
   tablet stood on another screen: its key events reloaded the tablet's dev client (back on Login; signed
   in again). No field received text (both fields read empty before the sign-in). (c) Leaving the Summary
   screens that the devices opened for M-W's sessions wrote `SUMMARY_ACKNOWLEDGED` rows from `DEV-0001` /
   `DEV-0002` (sessions `-0062`, `-0064`, `-0066`, `-0068`). (d) Lane 2 has one session slot and M-W ran
   sessions back to back; I announced a slot protocol in `contract_wave_m.md` at 15:21 and used M-W's
   recordings `-0064` / `-0066` for the first two observations of G75e-01.

## 6. Seen, not changed

1. Devices list (tablet and phone): a tap ON the "Development source" chip of a row does not open the row
   (the chip takes the touch - the class of G70c-03, fixed there for the source sheet only).
2. Tablet Home tiles while recording: the camera chip reads the engine word "READY" (ruled out of this
   task, D231), and inside the small "No preview" tile the icon's top and the state line are clipped
   (`t_25_home_while_recording.png`).
3. Roster rows ("Core Mac's camera", `CAM-04`, `CAM-05`) draw "Not checked" in a GREEN chip; the built-in
   rows draw it neutral.
4. The pre-check answered the tablet after 12.5 s once (15:22:50 - 15:23:03, the client's budget is 8 s,
   verdict `js-starved`): the screen followed the session's deltas and armed; the refusal presenter had
   worded it as an unreachable Core. The host was under load (M-W's sessions sealing); the other
   pre-checks of the run answered in time.
5. "Clear form" of the Session New menu leaves the chosen subject type selected (the `undefined` reset).
6. Devices detail: a row tap needs the name area in the narrow tablet list (see 1).

## 7. State left (15:48)

| Item | State |
|---|---|
| Lane 2 | RUNNING (M-W's restart of 15:08, PID 34466), not restarted or reset by me |
| Selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` (read last) |
| Session | none open (`session/current` null: my last act was the cancel of `SES-20261011-0075`) |
| Rigs | source rig OFF, seal rig OFF (both read); "source rig free" and "session slot free" written |
| Alerts | 60, none active (`ALR-000111`, `-000112` of the rig drive resolved by the passing runs) |
| Audit | chain `view.ok true`, `stored.ok true`, 1161 rows checked |
| Added by me | Sessions cancelled from ARMED, never recorded: `-0058`, `-0059`, `-0060`, `-0061` (before the restart), `-0069`, `-0070`, `-0071`, `-0074`, `-0075`. Recorded and sealed on the FAKE sources: `-0072` (`EV-20261011-0050`), `-0073` (`EV-20261011-0051`). Two pre-check searches (`DSC-000008`, the next one), two `CAPTURE_DEVICE_UNREACHABLE` rows, device sign-ins / sign-outs, the acknowledgements of lapse (c) |
| Devices | both signed out through the app, on Login ("You have been signed out."), both fields showing only their hints, paired (`DEV-0001`, `DEV-0002` `PAIRED`, online); reverse rules `tcp:8081 -> 8081`, `tcp:4420 -> 4422` read back on both; media volume 4 / 5 as found; no lock change, no reboot, biometric not enabled |
| Helpers | supervisor helper session signed out (204), jar removed; logcat readers stopped |

## 8. Files

Edited (product, `apps/mobile/src`): `features/session-new/{session-new-screen.tsx,session-new-model.ts,session-new-header.tsx,flow-guard.tsx,i18n.ts}`,
`navigation/back-guard.tsx`, `i18n/en.mobile.ts`,
`features/devices/{use-devices-data.ts,device-row.tsx,device-detail.tsx,device-status-chip.tsx}`,
`features/dashboard/status-tiles.tsx`, `features/evidence/{evidence-detail.tsx,evidence-row.tsx}`.

Edited (tests, EXISTING files only - no new test file): `features/session-new/{live-session-new-followups.test.tsx,session-new-model.test.ts,testing/live-session-new-bed.tsx}`,
`features/devices/wave-l-z-one-rule.test.tsx`, `features/dashboard/wave-l-m-home-notice-tiles.test.tsx`,
`features/evidence/{evidence-detail.test.tsx,evidence-list.test.tsx}`.

Docs: this note; `delegation_progress/coder_execution_fix_wave_m_m.md`; lines in `file_claims.md` and
`contract_wave_m.md` (announcements only). `packages/shared`, `apps/core-server`, `apps/core-web` not touched.

---
*Generated: 2026-10-11 15:50 WIB*
