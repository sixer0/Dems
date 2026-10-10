---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: wave H, closing pass Z2 (client leftovers of the seven fix drivers; decisions D203, D206, D207)
date: 2026-10-10
agent: coder-execution
narrative_tier: 2
tree: f293221 + the working tree of wave H (no commit, no migration, no git write)
status: needs-review
---

# 129 - Fix wave H, closing pass Z2: web console, tablet, phone

Nothing here was driven on a device or in a browser; the gate environment was not used. Proof is
tests. Area: `apps/core-web/src/**` and `apps/mobile/src/**` outside `features/evidence/**`, and
three append-only i18n blocks. No file of `packages/shared/src/{sim,api}` was edited.

## 1. Items

| # | Finding | Reproduced red? | Fix | Test | Status |
|---|---|---|---|---|---|
| 1a | Web banner "SESSION ACTIVE & SECURE / All integrity checks passing" in real capture | YES | `status-banner.tsx`: beside a session of the Core's own capture the title is "SESSION ACTIVE" and the detail is the capture state (`session.integrityFacts.capture.DURABLE`). One rule for the web: `lib/own-capture.ts` (`isOwnCapture` = `captureFactsOf(session) !== null`) | `session-monitor/__tests__/wave-h-z2-own-capture.test.tsx` "banner" (+ control) | FIXED |
| 1b | Web storage panel "Write Speed" + write-rate curve (the simulator's nominal 8.2 GB/h, `sim/health.ts:109`) | YES | `storage-panel.tsx`: neither is drawn in own capture; the volume figures and the estimate stay | same file, "storage" (+ control) | FIXED |
| 1c | Web timeline AUTOSAVE figure by the simulator's formula | YES | `sim-adapter.ts` `timelineOfOwnCapture` (the tablet's rule, driver A): AUTOSAVE, HEALTH and the generator's CHECK are not drawn in own capture | same file, "timeline" (+ control) | FIXED |
| 1d | Mobile TIME chip (Session Live) | YES by mutation (see lapses) | `session-live.math.ts` / `use-monitor.ts` / `status-strip.tsx`: the chip reads the slice; a slice that says the host clock (`isHostClockTime`) reads "TIME Host system clock", tone info, never "LOCKED" | `session-live/wave-h-z2-own-capture.test.tsx` "TIME chip" | FIXED |
| 1e | Mobile Summary Start / End chips | YES (2 cases) | `summary.model.ts` `summaryTimeSource`: the session's own member (`startTimeSource` / `endTimeSource` of its history entry) wins; the live slice's ring only for an entry without it and never on a host-clock Core; an `RTC` member on a host-clock Core reads "Host system clock" in a neutral chip | `session-summary/wave-h-z2-time-source.test.tsx` (3) | FIXED |
| 2 | Capture checkpoint facts | wiring red on the web | Z1's line arrived (10:30:00Z): `session.captureCheckpoints?: { fragments, bytes, lastAt, cameras[] }`. Web: `capture-checkpoints-model.ts` (defensive reader) + `capture-checkpoints.tsx`, drawn in the integrity panel. Mobile: `session-live/own-capture.ts` + `capture-checkpoints.tsx`, drawn under the status strip. "24 fragments saved · last 2 s ago · 34 MB", one line per camera; absent = nothing, never 0; never beside a simulated session | web "checkpoints" (3); mobile "checkpoints" (3) | BUILT AND WIRED; the member is read by name, so it compiles before and after Z1's type lands |
| 3a | G89-13 tablet drew Finalizing after the Core had sealed | NOT reproducible in jest | none | - | CAUSE STATED (section 2), no code change |
| 3b | Web timeline row "Critical fault: CAPTURE_FAULT" | YES | `timeline-panel.tsx`: a FAULT row is worded for every session - a capture fault by `captureFaultSentence(params.reason, null)`, any other fault by `common.faultKind.*` | web "timeline" (2 cases) | FIXED |
| 3c | G75-11 Dashboard "Recording session started" after a failed start | YES | `dashboard-model.ts` `recordingStartOutcome`; `recent-events-panel.tsx`: "Recording did not start" (danger dot) for a failed start, "Recording start accepted" while connecting | `dashboard/__tests__/wave-h-z2-failed-start-event.test.tsx` (2) | FIXED (web). The event itself stays in the slice |
| 4 | Audio cards map lines to MIC-01 / MIC-02 by constant | YES on both apps (AUDIO-01 carried MIC-01's badge with MIC-03 on the line) | Web `audio-input-card.tsx`: badge, "is on" mark and unreachable mark follow `micInputOfChannel(captureMicLines(s), channel)`; the input is named in the sub line when it is not the line's built-in. Mobile `session-live/mic-card.tsx`: the same rule in place of `mic.deviceId` | web `devices/__tests__/wave-h-z2-audio-card-lines.test.tsx` (3); mobile `session-live/wave-h-z2-mic-lines.test.tsx` (2) | FIXED. Mobile Devices rows already follow the lines (`devices/sim-adapter.ts:240`). Mobile Home tile: left (section 4) |
| 5 | Start fires although source knowledge was lost during 3-2-1 | Web: red, but not as described (section 3). Mobile: red (the countdown kept running) | Web `session-new/index.tsx`: knowledge lost at any moment ends the countdown; the last tick also checks a ref. Mobile `session-new-screen.tsx`: `stopCountdown` includes `localSourceGate.checking` (the sender's gate already refused) | web `session-new/__tests__/wave-h-z2-countdown-sources.test.tsx` (3); mobile `session-new/wave-h-z2-countdown-sources.test.tsx` (2) | FIXED |
| 6 | Mobile session row draws the demo poster on a real Core | YES | `session-row.tsx`: `PreviewThumb` (new `fill` prop) when `useRealCaptureView()`; no LIVE badge over the neutral thumb. Applies to every row, not only the active one (closed rows drew the room still) | `sessions/wave-h-z2-row-no-preview.test.tsx` (2) | FIXED |
| 7 | G70-04 "busy" stays | YES (pin moved first) | `runtime/pending-control.tsx`: idle returns `{ busy: false }`; `disabled` only when the caller gives it. 22 controls gained an `accessibilityLabel` (Session New Next x2 / Start, and every control that takes the busy state) | `runtime/pending-control.test.tsx` (pin + new static guard); `session-new/wave-h-z2-footer-labels.test.tsx` | FIXED in tests; the announcement itself is a device check |
| 8 | G94-13 / G81-13 / G89-14 first tap did not navigate | NO | none | - | CAUSE FOUND IN THE GATE'S OWN FRAMES (section 2); no product change |
| 9 | `connecting-leftovers.test.tsx:99` red | - | The test follows the new panel and still proves "no integrity activity is claimed while connecting" | 2 passed | DONE |
| + | Pre-check TIME note (Z1's line, item 3) | YES on both apps (the web worded it as the RTC fallback) | Web `session-new/model.ts` (`precheckNoteKey`, `reasonKeyFor`, `gateView` count) + `devices-step.tsx`; mobile `session-new-model.ts` (`precheckNoteOf`, `itemsWith`, `valueKey`, `hostClockValue`) + `devices-check-step.tsx`, `device-previews.tsx` | web `wave-h-z2-precheck-note.test.tsx` (3); mobile `wave-h-z2-precheck-note.test.tsx` (2) | FIXED |

## 2. The two investigations

**Item 8, first tap.** Read: `session-summary-screen.tsx:118-134`, `use-summary.ts:147-190`,
`sessions/session-detail.tsx:270-296`, `runtime/session-route-sync.tsx`. No swallowed press, no
navigation before the route is ready, no double mount was found. The gate's saved frames show the
cause:

- `.cache/gates/94/shots/t2_01_after_login.png` (Session Summary right after sign-in): the app's own
  modal "Enable biometric sign-in on this tablet?" stands across the middle of the screen, AND the
  development build's toast "Open debugger to view warnings." lies over the footer where "View in
  Evidence" is.
- `.cache/gates/81/t2_01_home.png`: the same biometric dialog covers the rail's "Settings" item;
  `t2_02_after_settings_tap.png` is Home with the dialog gone - the first tap closed it.
- `.cache/gates/89/p1_01_small.png` (phone, after the first tap on Evidence): Home, no dialog.

All three reports are a first tap after a sign-in. The tap landed on an overlay and closed it. The
dialog is product behaviour (a modal takes the press); the toast exists only in a development build.
What the gate should do: after every sign-in answer the biometric offer ("Not now") and close the
warnings toast, then tap; or assert that neither is on screen before a tap. Not checked by me: the
phone frame BEFORE the tap at gate 89 (none was saved).

**Item 3a, G89-13.** Not a stale route, not the mini-bar, no client timer (`sealing-progress.ts` reads
no clock; no pacing exists in `packages/shared/src/live`; the Core paces only 1 Hz deltas, at most
250 ms, `realtime/limits.ts:71`). What the saved logcat shows (`.cache/gates/89/logcat_A.txt`): the
six removed-indicator bursts stand at 14:20:56.116, .662, 57.246, 57.759 ... - 513 to 584 ms apart,
jittered, no round figure. That is one React commit of the whole Finalizing tree per Core state, each
costing about half a second on that development build on a loaded emulator. Added to it: the mount of
the hand-over copy (first frame about 1 s after the seal) and the deliberate 1.2 s SEALED beat before
the Summary (`finalizing.model.ts:19`). This is a reading of the log, not a measurement; a hypothesis
until a release build is timed. Driver B's static glyph (G89-02) removes Reanimated work from each of
those commits and may shorten them.

## 3. Lapses and things that are not as the brief said

1. **Web countdown (item 5).** Before the fix my test did NOT see a start fire. It saw the countdown
   stall at "1" while the device list was being read again, with 0 starts in 4.5 s. I did not
   observe what happens when the answer arrives (by reading: the countdown resumes and fires by
   itself, without asking the rule again). The fix covers both.
2. **Mobile TIME chip and checkpoints** were first run after the code existed (the test imported new
   modules). The chip was then proven by mutation: with the host-clock branch removed the test reads
   "TIME RTC" and fails.
3. **Untested edit taken back:** I pointed the mobile Home mic tile at the line's input, then saw it
   also changes the tile's navigation target (`/devices/MIC-03`, no such detail route). Reverted by
   the inverse edit; `git diff` of that file is empty.

## 4. Left open

- **Before Z1's time slice lands, a real Core's slice still says GNSS** and every chip repeats it:
  the clients now read the slice and the session's member, never a constant.
- Time surfaces outside the fixed list still read the slice without a host-clock wording: mobile Home
  chip (`dashboard/home-model.ts:395-407`, reads "RTC" with a warning tone), mobile More tile
  (`more/console-tiles.tsx:161`), mobile and web Network & Time pages (they would draw "GNSS lost /
  NTP unreachable / RTC" for a host-clock Core), web Dashboard and header time chips.
- Mobile Home mic tile badge still keyed by the channel record (`dashboard/device-tiles.tsx:103`).
- Web storage panel "Session Size" and the web integrity panel's Time Source row (a constant "Core
  system clock", driver A) were not changed.
- Mobile has no Recent Events list that words `RECORDING_STARTED`; G75-11 is closed on the web only.
- The same checkpoint reader exists twice (web, mobile); the shared sim was closed to me.

## 5. Decisions for the controller

1. **Deliberate pin changes** (item 7): `pending-control.test.tsx` (idle is `{ busy: false }`), and
   `toBeUndefined()` -> `toBe(false)` in `devices/live-devices-sites.test.tsx`,
   `session-live/live-session-live-link.test.tsx`, `storage/live-storage-sites.test.tsx`,
   `audit/live-audit-screen.test.tsx` (x2), and the tag pin of `settings/settings-live-static.test.ts:133`.
   The brief named two; the others pin the same rule.
2. **Labels on 22 controls, not 3.** A new static guard in `pending-control.test.tsx` requires an
   `accessibilityLabel` on every control that takes the busy state. Say if that guard is too wide.
3. **"SESSION ACTIVE"** replaces "SESSION ACTIVE & SECURE" in own capture ("secure" while the media
   is plaintext until the seal). New i18n blocks: `session.captureFacts`, `dashboard.captureStart`,
   `sessionNew.precheckNote`.
4. **A pre-check note has its own chip** ("NOTE", neutral) on both apps instead of WARN.
5. **Session row:** the neutral thumb applies to closed rows too.

## 6. Checks run (once each unless noted)

| Check | Result |
|---|---|
| core-web whole suite `npm run test -w @dems/core-web -- --maxWorkers=4` | 170 files / 2001 tests passed, 0 failed |
| mobile whole suite `npx -w apps/mobile jest --maxWorkers=2` | 275 suites / 2610 tests: 2609 passed, 1 failed - `features/settings/settings-live-static.test.ts`, MINE: a static pin of the exact text of the mode-confirm button tag, broken by the label I added. Pin moved by delta; that file re-run alone: 14 passed. The whole suite was NOT run a second time |
| shared i18n (`vitest run --root packages/shared test/i18n`) | 2 files / 50 passed |
| typecheck core-web, mobile | 0 errors each |
| lint core-web | clean (two fast-refresh warnings of mine fixed by splitting the reader into `capture-checkpoints-model.ts`) |
| lint mobile | 0 errors, 1 warning in `runtime/log.test.ts:160` (not mine, reported by B and D before) |

## 7. Checks for the test runner

- `npm -w packages/shared test` whole (I ran only the i18n files).
- Both client suites again once Z1 and R have landed: Z1's time slice and `captureCheckpoints` type
  meet my readers there.

## 8. To re-drive on a device / browser

1. Lane 2 web Monitor while recording: banner "SESSION ACTIVE / Recording. The first fragment is
   durable..."; no "Write Speed", no curve; no "Evidence Auto-Save" row; after Z1: "Durable Fragments"
   line that moves about every 5 s. Lane 1: everything as before.
2. Worker kill on lane 2: the web timeline's fault row is a sentence, no `CAPTURE_FAULT`.
3. Failed start on lane 2: Dashboard Recent Events reads "Recording did not start".
4. Tablet / phone Session Live on lane 2: TIME chip "Host system clock" (after Z1); checkpoint line
   under the strip. Summary chips the same.
5. Select MIC-03 / MIC-01 (SELECT ONLY): web Devices cards and tablet Session Live cards carry the
   badge of the microphone on each line.
6. Session New on web and tablet: drop the link during 3-2-1 - the countdown ends, nothing starts.
7. Tablet Sessions hub on lane 2: no room picture on any row.
8. G70-04: `uiautomator` dump of Session New Next after "Not now", and of "Run diagnostics" after it
   ends: the label, no "busy".
9. G81-13 / G94-13: sign in, answer the biometric offer, close the warnings toast, THEN tap once.
10. G89-13: time Monitor -> Summary on a release build if one exists.

---
*Generated: 2026-10-10*
