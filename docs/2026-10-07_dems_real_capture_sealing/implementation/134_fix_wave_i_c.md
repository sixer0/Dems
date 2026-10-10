---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave I, driver C (apps/mobile) - the tablet / phone findings of re-gates 70 and 75
date: 2026-10-10
agent: coder-execution
narrative_tier: 3
tree: 74fd1f1 + the working-tree edits of wave I (no commit, no migration, no git write)
status: needs-review
---

# 134 - Fix wave I, driver C (apps/mobile)

Status **needs-review**, for two reasons only: (1) G75b-05 is a device-log finding - the cause was
read from the gate's saved logcat and cured the way wave H cured the same lines at the Finalizing
hand-over, but "0 lines" can only be read on a device; (2) the planned member `checkedAt` of
contract note A2 section 4 has not landed in `packages/shared`, so "Not checked" is held on the
pure rule and not through the contract-checked transport. Everything else is done in tests.

No lane, no emulator, no Gradle, no git write. Paths below are under `apps/mobile/src/`.

## 1. Findings

| Finding | Reproduced (red)? | Cause (file:line before the change) | Change | Test (one run, green) | Status |
|---|---|---|---|---|---|
| **G75b-02 (MAJOR)** Finalizing on a blocked seal: "0% complete / Resumed after restart", "closes by itself", cannot be left | YES - 8 of 8 red | `features/session-finalizing/session-finalizing-screen.tsx`: the screen read only `session.finalization` - never the Core's blocked alert; `:337` drew "Resumed after restart" from `progress.resumed` = `attempt > 1` (`sealing-progress.ts:119`), which a retry in the same process sets; `:347` always drew `keepOpen`; `:111` + `:232` held Back for every FINALIZING state | NEW `features/session-finalizing/seal-attention.tsx` (`useSealAttention` = the contract's `sealAttentionOf`; `SealAttentionNotice`). Screen `:120-121` Back is not held while the Core retries / is blocked; `:298` the resumed line only in the in-app simulator and never beside a notice (contract note A1 section 4); `:360` the notice; `:361`, `:376` no percentage, no ETA, no "closes by itself" then. BLOCKED shows: title "Sealing is blocked", the alert's whole message, the fixed sentence of the detail code, "The recording is kept on the Core.", who resolves it, that the session stays open on the Core, "Go to Home". RETRYING shows the Core's retry sentence and can be left | `session-finalizing/wave-i-c-seal-blocked.test.tsx` 8 passed (tablet + phone; RETRYING; CONTROL: a running seal reads as before and Back is still held) | DONE in tests |
| G75b-02, Home half | YES - 2 red, 2 controls green | `features/dashboard/system-status-card.tsx:195` read "Recording Blocked / A critical fault needs action"; `quick-actions.tsx` "View finalization" with no reason | `system-status-card.tsx:178-204` title "Sealing blocked", subtitle `<session> · The recording is kept on the Core.`; `quick-actions.tsx:75-131` label "Sealing blocked: view" + the line "A new session cannot be started: sealing of session X is blocked, and the Core records no new session until it is sealed. The recording is kept on the Core." | `dashboard/wave-i-c-seal-blocked-home.test.tsx` 4 passed | DONE in tests |
| G75b-02, Sessions half + New Session | YES - 4 red, 2 controls green | `features/sessions/hub-top.tsx:116` "Sealing the evidence. This takes a few seconds."; `:173` "A session is in progress. Finish it before starting a new one."; `session-status-chip.tsx` "Finalizing" | `session-status-chip.tsx:38` chip "Sealing blocked" (danger); `hub-top.tsx:116` "Sealing of this session is blocked. The recording is kept on the Core."; `:182-183` the disabled Start button's hint and caption name the blocked seal by session; `navigation/session-guards.ts:27-38` the notice of a refused `/session/new` deep link names it too (the only way to reach New Session while a session is busy: Home shows the way to the session, the hub button is disabled) | `sessions/wave-i-c-seal-blocked-hub.test.tsx` 6 passed; `navigation/wave-i-c-new-session-blocked.test.tsx` 2 passed (written after the change, not run red; its control holds the old words) | DONE in tests |
| **G70b-03** microphone rows read only "busy" after a Save | YES - 6 of 6 red (`accessibilityLabel` undefined) | `features/capture-selector/capture-selector.tsx:320`: the row's `ListGroup.Item` stated `accessibilityState.busy` and had NO `accessibilityLabel`. Android writes the content description from label + state words and skips the write when both are empty (`ReactAndroid/.../BaseViewManager.java:415-446`), so "busy" was written during the save and never rewritten. Both microphone rows share one pending key (`MIC`); a camera row had the same defect after a camera save | `:348-353` every row carries its own label: name, detail (or "Saving…"), state word (stream state / role). `busy` is unchanged: true only while the request is out or its answer is not republished | `capture-selector/wave-i-c-row-labels.test.tsx` 9 passed (tablet + phone: before a save, after a save, in flight) | DONE in tests; device re-check |
| **G70b-04 / G75b-09** Home "Recent Sessions" stock pictures in real capture | YES - 2 red, 2 controls green | `features/dashboard/recent-sessions.tsx:92-99`: `source={poster ?? HERO_STILL}` in every mode (wave H fixed the Sessions rows and the tiles only) | `:85`, `:98` on a Core in real capture (`useRealCaptureView`, the rule of the tiles) the thumb is the neutral `PreviewThumb`, labelled "<id>. No preview: this build shows no live picture."; simulated capture and the in-app simulator unchanged | `dashboard/wave-i-c-home-real-capture.test.tsx` (4 of its 11) | DONE in tests |
| **G75b-06 (mobile half)** Home time chip "GNSS / Time: RTC" on a host-clock Core | YES - 1 red, 2 controls green | `features/dashboard/home-model.ts:404-408`: label `dashboard.statusStrip.time` ("GNSS / Time") and value `common.enums.timeSource.RTC` whatever `time.hostClock` said | `home-model.ts:432` + `use-home-data.ts:183`: `hostClock: true` reads "Time: Host system clock", tone info; a Core that states RTC / NTP / GNSS is worded as before | same file (3) | DONE in tests |
| Home microphone state (controller's post-gate item; G70b-06; contract note A2 section 4) | YES - 3 red, 1 control green | `features/dashboard/use-home-data.ts:120` and `:199`: the tile state came from the simulated track slice `s.mics[].state`; `device-tiles.tsx:103` took the badge from the track's built-in microphone id, not from the microphone on the line | NEW pure rule `features/capture-selector/source-state.ts` (`micLineReportOf`, `sourceStateWord`): in real capture a tile says what the Core reported for the microphone ON its line - "On" / "Not checked" (`checkedAt: null`) / "Reachable" / "Not reachable" / a local-device cause / "State not known". Tablet tiles `device-tiles.tsx:82-108` (chip, label, and the badge now follows the line); phone tile `home-model.ts:246` (`realCaptureMicTileFor`: counts the reachable lines; "Primary not reachable" / "Primary not checked" first) | same file (4) + `capture-selector/wave-i-c-source-state.test.ts` 8 passed | DONE in tests; "Not checked" waits for the member (section 3) |
| G70b-06 (NOTE; contract note A2 section 4, RULED client rule) "Live" on an idle camera line | fix and test together; control green | `capture-selector.tsx:144` chip from `cameraLineStatus` in every mode | `:84-170` in real capture the chip says "Live" / "Lost" only while a session is RECORDING; otherwise the device's reported word | `wave-i-c-row-labels.test.tsx` (3 of its 9) | DONE in tests |
| **G75b-05** 269 Reanimated "Unable to find SurfaceMountingManager" lines | YES for what jest can see - 5 of 5 red (39 kit Spinners over a pre-check, 1 in the remounted Stepper, 23 in a pending Next) | Read from `.cache/gates/75b/logcat_T_session1_full.txt`: every line is `synchronouslyUpdateUIProps failed for tag N`, retried per draw event. Three groups: (a) 19:51:45.487, 4 tags x 49 = the commit in which the session turned PRECHECK, where `session-new-screen.tsx:602` REMOUNTS the Stepper (`key={statuses.join('\|')}`) with its entering fades and the kit Spinner of the running badge; (b) 8 tags x 8, one new tag per resolved check, +44 tags apart = the kit Spinner of a pre-check row, `devices-check-step.tsx:245`, removed when its check resolves; (c) 1 late tag x 8 at 19:52:22.307 = the kit Spinner inside "Start Recording" (`session-new-screen.tsx:422`), removed when the start settles at the hand-over | The cure wave H used for the same lines at the Finalizing hand-over (G89-02; 0 lines at the re-gate): these places own no kit Spinner. `devices-check-step.tsx:202-260` a still running sign drawn by React (same testIDs); `session-new-screen.tsx:600-612` only the FIRST Stepper copy of a visit keeps its motion - a copy remounted for a status change, or with a running step, gets `animate={false}`; `:397-422`, `:708` the pending sign of Next / Start / "Run checks again" is the still glyph. Nothing is silenced | `session-new/wave-i-c-no-removed-spinner.test.tsx` 5 passed | **needs-review: a hypothesis until logcat reads 0** |
| **G70-08 on the tablet** (NOT PROVEN live) | the rule read + 12 cases green at once; **5 red** on a gap the reading found | The rule (`capture-selector/local-source-notice-model.ts:86-98`): UNKNOWN (no selector line / a line's device missing / first CONNECTING) and STALE (a kept list while the link is not ONLINE) both disable the controls with "Checking the capture sources…" and send nothing. A kept list while the link still reads ONLINE is trusted, the notice precedes the send - that is what the re-gate saw on the tablet. THE GAP: `local-source-notice.tsx:193-200` `confirm()` ran the held send without re-checking, so a notice opened while known and confirmed after the link dropped still sent | `local-source-notice.tsx:200` Confirm re-checks: nothing is sent, no consent is kept, the press is cancelled, said and logged | `capture-selector/wave-i-c-sources-stale.test.tsx` 17 passed | DONE in tests; device re-check |
| **G75b-08 (mobile half, NOTE)** "Recording Started" while connecting | YES - 1 red, 2 green | The row is the Core's (`session.timeline`), drawn at once by `features/session-live/use-monitor.ts:145` | `session-live.math.ts:261` + `use-monitor.ts:146`: the START row is held back while `selectConnectingCameras` is true and appears with the first durable fragment | `session-live/wave-i-c-timeline-connecting.test.ts` 3 passed | DONE in tests |

## 2. Commands and results (each once after its fix)

| Command | Result |
|---|---|
| `npx -w @dems/mobile jest <each wave-i-c file>` | 10 new files, 73 tests, all green: row-labels 9, source-state 8, sources-stale 17, home-real-capture 11, seal-blocked-home 4, seal-blocked 8, seal-blocked-hub 6, new-session-blocked 2, no-removed-spinner 5, timeline-connecting 3 |
| the existing test files of the folders touched (attribution run): `capture-selector dashboard session-new session-finalizing sessions navigation` + `session-summary/summary-live-static.test.ts` | first run 88 of 90 suites: 2 red, both mine - fixed, re-run green (`settings-capture-section.test.tsx`: the selector must not load the Skia feed; `summary-live-static.test.ts`: file-list pin + the Live idiom) |
| `session-finalizing session-live` + the static file | 36 suites, 264 passed |
| `devices settings capture-selector i18n` | 50 suites, 448 passed |
| `npm run -w @dems/mobile typecheck` | exit 0, 0 errors |
| `npm run -w @dems/mobile lint` | exit 0, 0 errors, 1 warning (`src/runtime/log.test.ts:160`, not mine, the known one) |

Pins moved by delta, one name each: `session-summary/summary-live-static.test.ts` (the file list:
`session-finalizing/seal-attention.tsx`; the files that use `useCoreLink().source === 'LIVE'`:
`session-finalizing/session-finalizing-screen.tsx`).

## 3. To wire / contract state

- `captureDevices.devices[].checkedAt` (contract note A2 section 4, PLANNED): read by name
  (`source-state.ts` `checkedFactOf`), absent = as before. When it lands in the shared schema the
  contract-checked Home bed can carry it; nothing else changes.
- Contract A1 used exactly as written: `sealAttentionOf`, `sealBlockedNoticeOf`,
  `SEAL_BLOCKED_DETAIL_SENTENCE`, `SEAL_RECORDING_KEPT_SENTENCE`; the tests import
  `SEAL_BLOCKED_EXAMPLE_ALERT`, `SEAL_BLOCKED_EXAMPLE_FINALIZATION`,
  `SEAL_RETRYING_EXAMPLE_FINALIZATION`, `SEAL_BLOCKED_EXAMPLE_SESSION_ID` (no payload retyped).
- No request line was filed: nothing was missing in `packages/shared` or on the server.

## 4. Decisions for the controller

1. **G75b-05 trades motion for a clean log.** A running pre-check row, a pending Next / Start /
   "Run checks again" and the running badge of the wizard Stepper now show a STILL loader glyph;
   the Stepper replays its enter stagger only on the first copy of a visit. It is wave H's ruling
   for the hand-over applied to the screens before it. Alternative if the spin is wanted back: a
   rotation that owns no Reanimated node (React Native's own native-driver animation) - a new
   pattern in this app, not built without a ruling.
2. **"Resumed after restart" is no longer shown in Live mode** (contract note A1 section 4: the app
   does not poll operation 83). The in-app simulator keeps it.
3. **No recovery action on the blocked Finalizing screen.** The contract allows `recoverSession`
   only "where your surface already offers recovery"; the mobile Recovery screen is for FAULT /
   RECOVERY states. The screen says who resolves it ("A technician or the administrator of the
   Core...") and offers Home.
4. **The new words** are in the mobile feature trees (`features.capture-selector.sourceState.*`,
   `features.session-finalizing.sealAttention.*`, `features.navigation.sealBlocked.*`), not in
   `features.dashboard.*`, whose copy is pinned by digest (`home-more-live-static.test.ts`).
5. **A row label on a non-focusable row.** G70b-03 is fixed by giving the selector row a label; the
   row's "Change" button keeps its own label. Whether TalkBack now reads the row as one extra stop
   is a device observation (re-drive item 2).

## 5. Open items (not in this driver's list)

- The mobile Network & Time screen still words a host clock as "RTC (holdover)"
  (`features/network-time/i18n.ts:33`, `network-time-model.ts:24`) - the same class as G75b-06,
  outside "Home"; the web half is driver B's.
- The phone History badge counts the held-back START row while connecting (`use-monitor.ts:87`,
  the raw timeline length) - one unseen item for about two seconds.

## 6. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm run -w @dems/mobile test` | none (no db, no worker); not while Gradle builds | 0 failed; the 275 suites of `test/08_precommit_wave_h.md` + the 10 new files of this driver (other drivers add none in apps/mobile) |
| `npm run -w @dems/mobile typecheck` and `lint` | none | 0 errors; the one known warning |
| `npm run -w @dems/shared test -- sim-wave-i-a1-seal-blocked` | none | the examples this driver imports still pass their schemas (driver A1's file) |

## 7. Re-drive list for the gates (device, after Metro serves this tree)

1. **G75b-02 (gate 75):** a session whose seal is blocked, tablet and phone: Finalizing shows
   "Sealing is blocked", the Core's sentence, "The recording is kept on the Core.", who resolves
   it; no "%", no "Resumed after restart", no "closes by itself"; Back and "Go to Home" leave;
   Home status card "Sealing blocked" + the line under Quick Actions; Sessions card chip "Sealing
   blocked", Start button disabled with the blocked sentence. While the Core still retries (the
   first ~155 s): "Sealing is being retried" with the retry sentence.
2. **G70b-03 (gate 70):** tablet, Save in the microphone sheet, then `uiautomator dump`:
   `capture-selector-row-MIC-0N` `content-desc` = "MIC-0N, <model> · <transport>, Primary|Standby",
   never "busy" alone, 10 s later too; a camera Save the same. Note how TalkBack walks the row.
3. **G70b-04 / G75b-09:** tablet Home on lane 2: "Recent Sessions" thumbs are the neutral tile;
   phone on lane 1 keeps its pictures.
4. **G75b-06:** tablet Home chip on lane 2 reads "Time: Host system clock"; MIC tiles read
   "Reachable" (or "Not checked" once the Core sends `checkedAt`); with `MIC-03` on a line (select
   only, never opened: D163) the tile and badge are MIC-03's; selector camera chips read
   "Reachable" when idle and "Live" only during a recording.
5. **G75b-05 (mandatory):** tablet, logcat cleared before Session New: from step 1 through the
   pre-check, Ready, Start and the mount of Session Live,
   `adb logcat | grep -c "Unable to find SurfaceMountingManager"` = 0. If not 0: tags, counts and
   times back (the three groups of section 1 tell which place).
6. **G70-08 on the tablet:** with a local camera named on a track (select only), cut the tablet's
   Core path and HOLD the cut until the app's Core link has left "Online" (the re-gate's cut lasted
   under a minute and did not record the link state; until the link leaves ONLINE the kept list is
   trusted and the notice precedes the send - the safe reading it saw). Then: Next is disabled with
   "Checking the capture sources…"; a notice opened before the cut and confirmed after the link
   left ONLINE sends nothing and shows the same sentence.
7. **G75b-08:** tablet timeline during "Connecting cameras…": no "Recording Started" row until
   the first durable fragment.

---
*Generated: 2026-10-10*
