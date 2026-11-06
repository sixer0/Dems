---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave L, driver L-M (apps/mobile only, with the tablet `emulator-5556` = `DEV-0001` and the phone `emulator-5554` = `DEV-0002`, both on lane 2)
date: 2026-10-11
agent: coder-execution
narrative_tier: 2
tree: commit b05106b + fix 151 + wave L (L-S, L-W in the same working tree); no git write by me
source: delegation_progress/fix_brief_wave_l.md, contract_wave_l.md; gateway_check/09c, 10d, 12c, 13c; decisions D227, D228, D229, D230b; the controller's ruling on G70c-02 sent during the run
status: needs-review
---

# 155 - Fix wave L, driver L-M (mobile)

Run window 10:13 - 11:25 WIB. `apps/mobile` only; `packages/shared`, `apps/core-server`,
`apps/core-web` not touched. No git write, no install, no Gradle build, no lane restart or
reset. No LOCAL_DEVICE source was selected, pre-checked or started (`CAM-03` / `MIC-03` never
left the option lists); no attendance variable; nothing was played aloud (media volume 0 by
the volume key before playback, read back 0; restored to 4 / 5 as found); the biometric offer
was answered "Not now" each time; the sign-in fields were checked empty by `login.sh` before
typing; no field content, password, token or fixture account is in a file of this run.
Screenshots, tools and the two logcats: `.cache/gates/wave-l-m/` (git-ignored).

**Status needs-review** because of the items of section 4 (what is NOT proven on a device)
and the decisions of section 5.

## 1. Per finding

### G70c-01 (MAJOR) - Home and Session New named the camera a track had before a selector change

- **Cause - the re-check's hypothesis is CONFIRMED, in code and on the tablet.** Fourteen
  readers spelled `state.session?.captureConfig ?? state.captureConfig`. The replicated
  `session` slice keeps the LAST session after its seal, with that session's selector snapshot
  (`packages/shared/src/api/state-slices.ts:357`: "the selector as it was when recording
  started"), so the snapshot of a SEALED session hid every later edit. Operation 27
  `session/current` carries no such member (read: no `captureConfig` key) - the slice on the
  socket does. Seen before the fix on the tablet's old bundle: selector `VIDEO-02 = CAM-05`
  (audit seq 773), Home tile "Camera 2 · Camera CAM-02" (`t_00_before_fix_home_cam05_on_track2.png`).
- **Change.** ONE helper, `apps/mobile/src/features/capture-selector/selector-in-force.ts`
  (`sessionIsOpen`, `openSessionSnapshot`, `selectorInForce`, `cameraLinesInForce`,
  `micLinesInForce`): a session's snapshot counts only while that session is OPEN (state stated
  and not `SEALED`); otherwise the Core's current selector. Every reader goes through it:
  `devices/camera-preview.tsx:81` (the "No preview" tile of Home, Session New, Session Live,
  device detail), `capture-selector/source-state.ts:88` (+ the three microphone readers),
  `development-source-badge.tsx` (track badge, microphone badge, pre-check badge),
  `capture-selector.tsx`, `open-local-sources.tsx`, `local-source-notice-model.ts` (the
  local-device notice no longer names a device of a SEALED session's snapshot - it read BOTH
  selectors before), `session-new/session-new-model.ts` (`micRoleLine`),
  `session-live/mic-source-model.ts`. The shared `captureMicLines` (same defect,
  `packages/shared/src/sim/audio.ts:64`) is no longer called from the app: `mic-card.tsx`,
  `use-mic-source.ts`, `dashboard/use-home-data.ts`, `dashboard/device-tiles.tsx`,
  `devices/device-detail.tsx`, `runtime/use-audio-shared-values.ts` use `micLinesInForce`.
- **Test.** `capture-selector/wave-l-m-selector-in-force.test.ts` - 10 passed: the rule; every
  reader in the order of the defect (sealed session, THEN the selector changed; control: the
  same state with the session OPEN keeps the snapshot); the local-device notice both ways; a
  STATIC test that fails on a second spelling of the expression or a call of `captureMicLines`
  in `apps/mobile/src`.
- **Proven on the devices** (FAKE devices only): `CAM-05` on `VIDEO-02` through the API
  (seq 773) -> tablet Home "Camera 2 · Camera CAM-05", Session New preview "Camera 2 · Camera
  CAM-05" (`t_01`, `t_02`); `CAM-02` put back through the TABLET's sheet (seq 776, `DEV-0001`)
  -> Home "Camera CAM-02" (`t_05`). Again in the exact order of the defect - after the sealed
  session `SES-20261011-0046`: `CAM-05` through the PHONE's sheet (seq 823, `DEV-0002`) ->
  tablet Home "Camera CAM-05" (`t_09`); back through the phone's sheet -> "Camera CAM-02".
  Phone: its selector and sheet follow at once; the phone has no screen that names a track's
  camera without an open session (its Home shows counts, its Session New names sources on
  step 2, under an open session) - that half is by test.

### G70c-02 (mobile half) - status words that are not checked facts; CONTROLLER RULING applied

- **Cause.** `capture-source-sheet.tsx:137` drew `cameraLineStatus({ online, streamState })`
  for every option ("Live"); the phone Home tiles drew the track words (`cameraTileFor`,
  `micTileFor`: "Online"); the tablet camera tiles the model word "READY".
- **Ruling received during the run (controller): a source AT REST that the Core has not
  checked is "Not checked" on web and mobile; "Reachable" / "Not reachable" only with a tested
  fact; "Live" only while recording.** Built as the web's rule (`sourceLineState`,
  `restingSourceChecked`): ONE function `sourceChecked` + `sourceStateLabelKey`
  (`devices/registered-devices-model.ts:127`): checked = `sourceOpen`, or `checkedAt` a finite
  number, or (a source on a line) a session RECORDS. A negative fact is never hidden.
- **Screens changed** (all on a Core in real capture only; the simulated lane is unchanged and
  pinned by controls):

  | Screen | Was | Now, at rest on lane 2 |
  |---|---|---|
  | Tablet / phone camera sheet, every option | "Live" | "Not checked" (`t_18`); "Live" only for a camera ON a track while a session records (`cameraOptionWord`, `capture-source-sheet.tsx:238`) |
  | Selector lines (Devices, Settings) | "Reachable" (wave I) | "Not checked" |
  | Phone Home tiles | "Cameras: 2 of 2 online. Online", "Microphones: 2 of 2 ready. Online" | "Cameras: 2 of 2. Not checked", "Microphones: 2 of 2. Primary not checked" (`p_10`); "n not reachable" for a negative fact; "Live" while recording (`realCaptureCameraTileFor`, `home-model.ts:279`) |
  | Tablet Home device tiles (camera + microphone chips) | "READY" / "Reachable" | "Not checked" (`t_17`); while a session records the track's own word stands |
  | "No preview" tile state (Home, Session New, device detail) | "Reachable" / "Ready" | "Not checked"; reachable while its session records |
  | Registered-devices roster row and detail | "Reachable" / "Ready" | "Not checked" without a checked fact |

  Not changed (as ruled): the engine track-state words elsewhere ("READY" of pre-check rows
  and "Live device status", "ALL DEVICES READY").
- **Also (the ONE RULE; contract section 5):** `model` of a device with `adapter: 'FAKE'` is no
  longer drawn on the selector lines and sheet options (`statedModelOf`,
  `capture-selector-model.ts:57`): the tablet read "CAM-01 · Dual-lens IP camera DL-2", now
  "CAM-01" with its "Development source / Test source" badge.
- **Test.** `wave-l-m-source-sheet.test.tsx` (10 passed), `dashboard/wave-l-m-home-notice-tiles.test.tsx`
  (13 passed, with the pure tile rule). Changed BY DELTA for the ruling, each with a comment:
  `wave-i-c-source-state.test.ts`, `wave-i-c-row-labels.test.tsx`, `wave-h-no-preview-home.test.tsx`,
  `wave-h-no-preview-session-new.test.tsx`, `devices/wave-h-no-preview.test.tsx`,
  `devices/registered-devices.test.tsx`, `dashboard/wave-i-c-home-real-capture.test.tsx`
  ("Reachable" / "Ready" of a resting source without `checkedAt` -> "Not checked").
- **Proven on the devices:** the rows of the table marked with a screenshot. "Live while a
  session records" on the sheet / tiles: by test only (the selector is locked then and I took
  no sheet picture during my one recording).

### G70c-03 - the phone's option row: a tap on the "Development source" chip did not select

- **Cause.** The kit chip (`StatusChip` -> heroui `Chip`) is a pressable of its own; inside
  `OptionRow` it took the touch (`capture-source-sheet.tsx`, the badge and the suffix chip).
- **Change.** Both are wrapped `pointerEvents="none"` (`capture-source-sheet.tsx:288`, `:302`).
- **Test.** `wave-l-m-source-sheet.test.tsx` "G70c-03" (structure + press).
- **Proven on both devices:** phone, tap AT the chip of the `CAM-05` row (361, 1875): the row
  reads `selected`, Save enabled, saved (seq 823 `DEV-0002`; `p_06`); the same with the
  `CAM-02` chip for the put-back. Tablet: chip of `CAM-02` (seq 776).

### G70c-06 - "Core server unreachable" beside "Core Machine ONLINE"

- **Cause.** `session-new/device-previews.tsx` `LiveChecks` draws the Core's last evaluation
  whatever the link is.
- **Change.** `liveCheckWhileLinkDown` (`session-new-model.ts:193`) + `useCoreLinkNotice()` in
  `LiveDeviceColumn`: link down = Core row "OFFLINE" (danger), every other row "Not known"
  (neutral), card hint "Not connected to the Core server. The device status is not known
  until the connection is back."
- **Test.** `session-new/wave-l-m-live-checks.test.ts` (3 passed; the rule).
- **Proven on the tablet:** link cut with `adb reconnect` (both rules gone): banner + "Core
  Machine OFFLINE", "Video Lens 1 Not known" (`t_03`); both rules restored and read back:
  "ONLINE" / "READY" again within 8 s.

### Player: G94c-03, -04, -05, -06, -07

| Finding | Cause (file:line before) | Change | Device proof |
|---|---|---|---|
| G94c-03 interrupted end without a word | `sealed-player.tsx`: `playToEnd` only paused | prop `interrupted` (the item's `interruptedFactOf`), state `fileEnded`, sentence `features.evidence.player.interruptedEnd` = the web's sentence | T `EV-20261011-0031`: "End of the sealed recording at 0:24: the recording was interrupted, so it ends here." at "0:24 / 0:26" (`t_16`); P the same item, the same sentence (`p_17`) |
| G94c-04 "no interval" at 0:00 | `sealed-playback.ts` `segmentAt` had no start tolerance | the web's rule copied: a playhead before the first interval in the same second as its start is inside it | T `EV-20261010-0016` opened, not started, "0:00 / 1:09": "Audio at the playhead: MIC 1" (`t_19`); P `-0031` at "0:00 / 0:26": the same (`p_16`) |
| G94c-05 phone after background / foreground | the platform pauses the player; `playing` state stayed true | `AppState` listener (`sealed-player.tsx:449`): `background` pauses players AND state; `active` reads the leading player's own `playing` | P `EV-20261010-0020` playing, Home 8 s, back: both controls "Play", "0:13 / 1:36" standing; ONE press: 0:13 -> 0:19 in 5 s (`p_13`, `p_14`) |
| G94c-06 short item: player half below the fold | `evidence-detail.tsx:133` `scrollTo(tabsTop)` cannot scroll past the end of a short pane | while the sealed player is asked for, the tabs block is at least as tall as the scroll view; the player asks to be seen (`onAttention`) when drawn, when it stops with a sentence, at the interrupted end; the view follows layout changes until the operator drags | T and P `EV-20261009-0005` after Play: tab row first, both tiles, the stop sentence and (tablet) "Open again" and the scrubber in view (`t_20`, `p_11`) |
| G94c-07 stopped tamper player never idle for uiautomator | NOT FOUND | no targeted change | NOT REPRODUCED: on the stopped tamper player the phone's view tree was read 4 times in 2-3 s each, the tablet's in 4 s. Whether the wave L changes (the controls no longer hold a false "playing") removed the cause is not established |

Test: `evidence/wave-l-m-player.test.tsx` - 10 passed (each row above with its control).
Tamper stops of this run: one WARNING row each (tablet, phone), the one expected ExoPlayer
"Playback error" line per device.

### G75d-02 (mobile half) - a blocked seal named an action no screen offers

- **Contract (section 2):** operation 33 is for `SEAL_RETRY_PERMISSION` (investigator,
  supervisor); "the web offers the control, the devices say who can". So NO retry control was
  built on the device.
- **Change.** `session-finalizing/seal-attention.tsx`: the Core's sentence stays as the Core
  wrote it (it also says what to check); under it "Sealing stopped after 3 automatic retries.
  The Core does not run it again by itself when the cause is resolved." (`SEAL_AUTOMATIC_RETRIES`),
  who resolves the cause, and "The recovery named above is "Retry sealing" on the web console
  (Session Monitor): an investigator or a supervisor presses it after the cause is resolved.
  This device has no retry control. A restart of the Core also runs the seal again."
- **Test.** `session-finalizing/wave-l-m-blocked-who-where.test.tsx` (7 passed).
- **Proven LIVE with the seal rig** (announced in `contract_wave_l.md`): `seal-rig 2 blocked`;
  session `SES-20261011-0047` created, pre-checked (8 of 8) and started ON THE TABLET
  (10:58:30), 53 s, stopped through the API with a reason; "Sealing is being retried (retry 2
  of 3, in 30 s)"; BLOCKED at about 11:02. Tablet and phone Finalizing: the sentences above,
  "Go to Home" the only control (`t_12`, `p_08`); Home on both: "Sealing blocked /
  SES-20261011-0047 · The recording is kept on the Core.", "Sealing blocked: view", the
  new-session reason (`t_13`, `p_09`). L-W had finished its own retry proof before (its line
  of 10:44) and wrote no "retried" for mine; after my pictures: `seal-rig 2 release` (OFF read),
  operation 33 as the investigator through the API (202) -> SEALED 11:09:15 ->
  `EV-20261011-0036`, verify PASS. Rig OFF.

### G75d-01 (mobile half) - the UNSEALABLE open notice

- **Change.** `session-finalizing/open-notice.ts` reads `openUnsealableNoticesOf` (contract
  section 1). READY with an open notice: tablet header chip "OPEN NOTICE", ring amber with
  "OPEN NOTICE • RECORDING NOT BLOCKED", title "Ready for Recording · open notice", "A
  recording could not be sealed (SES-…). Its files were kept in quarantine on the Core.
  Recording is not blocked.", and who closes it (`canResolveUnsealable(role)`)
  (`dashboard/system-status-card.tsx:72`, `home-header.tsx`). The bell row: the plain sentence
  of ITS session, the cause code as a detail, "Acknowledge and close" for the role whose
  acknowledgement closes it - also for a notice already acknowledged; an acknowledged, still
  open notice still counts on the bell. `unsealable-notice.tsx`: drawn for the session the
  screen FOLLOWS only (no id = nothing; the Finalizing screen keeps the followed id), plain
  sentence, "Recording is not blocked", who closes it.
- **Test.** `dashboard/wave-l-m-home-notice-tiles.test.tsx`, `wave-l-m-blocked-who-where.test.tsx`;
  `unsealable-notice.test.tsx` changed BY DELTA (two cases pinned the old behaviour: "without
  an id, the most recent" and the code in the sentence).
- **Proven on both devices, on the wave L Core.** With `ALR-000049` active (before the
  restart): tablet and phone Home state it (`t_01`). After the restart, with L-W's
  `ALR-000062` (`SES-20261011-0045`, left active for this proof): tablet and phone Home
  (`t_06`, `p_02`), the bell rows (`t_07`, `p_03`); **"Acknowledge and close" pressed on the
  TABLET as the supervisor: audit seq 822 `FAULT_CLEARED` `{reason UNSEALABLE, alertId
  ALR-000062, operationId acknowledgeAlert}`, actor `OPR-002`, `deviceId DEV-0001`, session
  `SES-20261011-0045`; alert `active false`, `resolvedAt` set; tablet AND phone Home back to
  "READY / All systems operational" within 3 s** (`t_08`, `p_04`).

### G89c-04 (mobile) - the manifest's per-track profile and the profile notice

- **Change.** `evidence/item-facts.ts` reads `evidence.files[].profile` and
  `evidence.streamProfileNotice` of operation 40 by the names of the contract (section 4);
  `evidence/sealed-format.tsx` draws "Sealed format (signed manifest) / Camera 1: H264_720P30"
  and, when stated, "The recorded stream was not the configured profile / Camera 1: recorded
  …, configured …". Nothing stated = nothing drawn; never `profileId`.
- **Test.** `evidence/wave-l-m-sealed-format.test.tsx` (6 passed; the contract's examples
  imported).
- **Proven on both devices:** `EV-20261011-0031` "Camera 1: H264_720P30 / Camera 2:
  H264_720P30" (tablet `t_14`, phone `p_15`); `EV-20261010-0016` (sealed by older code)
  "H264_1080P25" twice - what ITS manifest states. The notice block: by test only (no item of
  lane 2 was opened whose session still holds the notice).

### G75d-08 - "Start recovery" for 8 s while the Core was sealing

- **Can the app know? YES, from the session payload:** `state FAULT`, `fault.fromState
  RECORDING`, `startedAt` set, `captureDurable: true` - on a Core in its own capture every
  interrupted recording with durable media is handed to the seal
  (`apps/core-server/src/capture-session/index.ts:884-894`, `:932-937`).
- **Change.** `coreSealsInterruptedPrefix` (`session-recovery/recovery.model.ts:54`), used by
  the screen only for a Core server in real capture (`realCaptureSources`): instead of the
  fault alert, the recovery pipeline and "Start recovery", the screen says "Recording was
  interrupted — sealing what was recorded", the cause, "The Core is sealing the recording up to
  the interruption. Nothing has to be started here: this screen moves on by itself.", chip
  "Sealing", and "Go to Home".
- **Test.** `session-recovery/wave-l-m-core-sealing.test.ts` (2 passed, the rule and its
  controls); the simulated lane keeps the recovery prompt (`failed-start.test.tsx` CONTROL,
  unchanged). **NOT proven on a device** (no worker kill in this run - the brief asks for the
  test).

## 2. Checks I ran (one run each, after the last edit)

| Check | Result |
|---|---|
| `npx tsc --noEmit -p apps/mobile` | clean |
| `npm run lint -w apps/mobile` | 0 errors, 1 warning (`src/runtime/log.test.ts:160`, not mine) |
| `npm test -w apps/mobile -- src/features/{session-finalizing,session-recovery,dashboard,capture-selector,session-new,devices,session-live,evidence,home,sessions} src/i18n src/runtime test/` | `Test Suites: 204 passed, 204 total / Tests: 1768 passed, 1768 total` |
| Logcat over my proofs (10:29 - 11:20) | tablet 146,526 lines, phone 122,351 lines: 0 `FATAL EXCEPTION` / `ANR in`, **0 `ReactNativeJS` error lines**, 0 token shapes; one ExoPlayer "Playback error" per device (the tamper demonstration, expected) |

## 3. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm test -w apps/mobile` (whole workspace) | none | green; the suites of section 2 are a subset |
| `npm run typecheck -w apps/mobile`, `npm run lint -w apps/mobile` | none | clean / the one known warning |

## 4. What is NOT proven on a device (re-drive list)

1. G75d-08: the recovery screen during a worker kill on lane 2 (by test only).
2. G94c-07: not reproduced; no targeted change (4 + 1 view-tree reads on the stopped player).
3. G70c-02: "Live" on a sheet option / Home tile WHILE a session records (by test only).
4. G70c-01 on the phone's Session New step 2 with a changed selector (needs an open session,
   where the snapshot rule applies: by test).
5. G89c-04: the profile-notice block on an item whose session holds `STREAM_PROFILE_DIFFERS`
   (`EV-20261011-0025` was not opened).
6. The UNSEALABLE end ON the Finalizing screen of the session it followed (L-W's next session
   started before my read; by test).
7. A second role on the bell (an investigator sees "A supervisor acknowledges this notice to
   close it." and no closing button for an acknowledged notice): by test.

## 5. Decisions for the controller

1. **The shared readers keep the G70c-01 defect** (`captureMicLines`, `selectorOf` of
   `capture-notices.ts`, `sessionCameras`): the app no longer calls them, but
   `useAudioChannel` / `activeMeterChannel` do. Line to L-S in `file_requests.md` (10:15).
2. **The open notice `ALR-000062` was CONSUMED by my acknowledgement proof** (L-W had left it
   "for L-M and the re-check"). Lane 2 has no active alert: the final re-check of G75d-01 needs
   one more `seal-rig 2 unsealable` run.
3. **G75d-02:** no device retry control was built (contract: "the devices say who can"). The
   Core's alert sentence still says "start recovery for the session"; the device maps it to the
   web's "Retry sealing". If the alert text itself should say "retry the seal on the web
   console", that is L-S's sentence.
4. **Strings moved out of digest-pinned trees:** the Simulated copy of `dashboard/i18n.ts` and
   `session-recovery/i18n.ts` is pinned by count and digest, so the new Live words are in
   `session-finalizing/i18n.ts` (`openNotice`, `interruptedSealing.core*`) and
   `capture-selector/i18n.ts` (`sourceState.*`); `open-notice.ts` lives in
   `session-finalizing/` (the dashboard folder's file list is pinned). `evidence`'s explicit
   Live lists were extended by delta (`live-evidence-static.test.ts`).
5. **Open, not in my items:** the microphone lines still read the transport "USB" for a
   generated source; `devices/` detail screens still draw model values of the simulator's
   `cameras[]` / `mics[]` slices on lane 2 (no sweep of the mobile app was asked).
6. **Lapses:** (a) my code edits made Metro reload the phone once (it fell back to Login;
   signed in again); the tablet lost fast refresh after the link cut and was restarted twice
   with the launch form of note 08 (`force-stop` + deep link). (b) Leaving the Summary of L-W's
   `SES-20261011-0046` on the tablet wrote `SUMMARY_ACKNOWLEDGED` (seq 820, `DEV-0001`).
   (c) My session ran 53 s, not 45. (d) The helper's technician session expired twice (15 min
   idle) and was signed in again.

## 6. State left (11:22)

| Item | State |
|---|---|
| Lane 2 | RUNNING (PID 86337, L-W's restart of 10:38), not restarted or reset by me |
| Selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` (read last) |
| Session | none open; `session/current` = `SES-20261011-0047` SEALED (`EV-20261011-0036`, tablet-started, blocked then sealed, verify PASS) |
| Seal rig | OFF (read); "rig free" written |
| Alerts | none active |
| Audit | chain `view.ok true`, 863 rows checked; my rows: selector 773, 776, 823 and the put-back after it, the session of `SES-…-0047`, 820, 822, device sign-ins / sign-outs, three media-session pairs + two tamper stop rows |
| Devices | both signed out through the app, on Login, fields empty, "Core online", paired as `DEV-0001` / `DEV-0002`; reverse rules `tcp:8081 -> 8081`, `tcp:4420 -> 4422` read back on both; media volume 4 / 5 as found; no lock change, no reboot, biometric not enabled |
| Helpers | technician and investigator helper sessions signed out (204), jars removed; logcat readers stopped; no capture-worker / ffmpeg / whisper process |

## 7. Files

New: `capture-selector/selector-in-force.ts`, `session-finalizing/open-notice.ts`,
`evidence/sealed-format.tsx`; tests `capture-selector/wave-l-m-selector-in-force.test.ts`,
`capture-selector/wave-l-m-source-sheet.test.tsx`, `dashboard/wave-l-m-home-notice-tiles.test.tsx`,
`evidence/wave-l-m-player.test.tsx`, `evidence/wave-l-m-sealed-format.test.tsx`,
`session-finalizing/wave-l-m-blocked-who-where.test.tsx`, `session-new/wave-l-m-live-checks.test.ts`,
`session-recovery/wave-l-m-core-sealing.test.ts` (all under `apps/mobile/src/features/`).

Edited (product): `capture-selector/{capture-selector-model.ts,capture-selector.tsx,capture-source-sheet.tsx,development-source-badge.tsx,i18n.ts,local-source-notice-model.ts,open-local-sources.tsx,source-state.ts}`,
`dashboard/{device-tiles.tsx,home-header.tsx,home-model.ts,status-tiles.tsx,system-status-card.tsx,use-home-data.ts}`,
`devices/{camera-preview.tsx,device-detail.tsx,registered-device-detail.tsx,registered-device-rows.tsx,registered-devices-model.ts}`,
`evidence/{evidence-detail.tsx,i18n.ts,item-facts.ts,sealed-playback.ts,sealed-player-i18n.ts,sealed-player.tsx}`,
`session-finalizing/{i18n.ts,seal-attention.tsx,session-finalizing-screen.tsx,unsealable-notice.tsx}`,
`session-live/{mic-card.tsx,mic-source-model.ts,use-mic-source.ts}`,
`session-new/{device-previews.tsx,i18n.ts,session-new-model.ts}`,
`session-recovery/{recovery.model.ts,session-recovery-screen.tsx}`, `src/runtime/use-audio-shared-values.ts`.

Edited (tests, by delta, each with its reason in place): `capture-selector/{capture-selector.test.tsx,wave-h-no-preview-home.test.tsx,wave-h-no-preview-session-new.test.tsx,wave-i-c-row-labels.test.tsx,wave-i-c-source-state.test.ts}`,
`dashboard/wave-i-c-home-real-capture.test.tsx`, `devices/{registered-devices.test.tsx,wave-h-no-preview.test.tsx}`,
`evidence/live-evidence-static.test.ts`, `session-finalizing/unsealable-notice.test.tsx`,
`session-new/precheck-mic-roles.test.ts`.

Docs: this note; `delegation_progress/coder_execution_fix_wave_l_m.md`; lines in
`file_claims.md`, `file_requests.md`, `contract_wave_l.md` (announcements only).

---
*Generated: 2026-10-11 11:25 WIB*
