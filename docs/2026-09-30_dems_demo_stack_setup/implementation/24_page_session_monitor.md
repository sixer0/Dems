---
task_id: 2026-09-30_dems_demo_stack_setup
step: 44
plan_row: 02_plan §4 W-11 (Session Monitor with finalization)
date: 2026-10-01
agent: coder-execution
tier: 3
lane: web B (Vite 127.0.0.1:5177, D59)
status: complete
decisions: D28, D38, D41(d), D49, D50, D59, D61, D63, D64, D65, D67, D70, D74 (review 40 relay)
---

# Step 44: Session Monitor page and finalization view

**Outcome: PASS.** Run 05:29–06:50 WIB from `/Users/gsp-budi/Documents/DEMS`. Every row-44 check passes (§4, fresh output). The browser check at 1920×1080 and 1440×900 is in §5.

| Row-44 check | Result | Evidence |
|---|---|---|
| Render test asserts the page test ID and panel test IDs K–T in the recording scenario | **PASS** | `renders the page and panels K–T…`: `page-session-monitor` with `data-phase="RECORDING"`, and `panel-K` … `panel-T` all present |
| …with the feed on the step-92 video sources | **PASS** | The same test: `camera-feed` `data-feed-mode="video"`, `<video src>` ends in `demo-media/live/VIDEO-01.loop.mp4`. The camera switch test: `…/VIDEO-02.loop.mp4` |
| …and both track labels shown | **PASS** | `sm-track-label-AUDIO-01` = "MIC 1 – Interviewer", `…AUDIO-02` = "MIC 2 – Subject". The two `role="meter"` names are the same (the step-92/93 track labels, D50) |
| A fake-timer test drives End Session with a reason to SEALED within 10 s of sim time (AC-63 unit form) | **PASS** | `ends the session with a reason and reaches SEALED within 10 s…`. Vitest fake timers drive the engine's 50 ms scheduler on a manual clock. A 4-character reason is refused inline; "Interview completed" goes STOPPING → 6 steps → SEALED with `sealedAt − stoppedAt ≤ 10 000`. The stamp shows SEALED, EV-…-0014 is sealed, and the DEMO package joins |
| core-web typecheck, lint and test exit 0 | **PASS** | 06:46–06:48 WIB: `tsc -b` exit 0; oxlint exit 0 (274 files, 0 diagnostics); vitest **26 files, 320/320**, exit 0 |

**Scope (P6).** I wrote only these paths:
- `apps/core-web/src/features/session-monitor/**` (21 source files, 1 test file);
- `packages/shared/src/i18n/en/session.ts` (additive keys only);
- this report, the screenshots `implementation/assets/24_*.png` (32 files) and `delegation_progress/coder_execution_step_44.md`.

No `npm install` was run, and no `package.json`, lockfile, `packages/shared/src/sim/**`, shell, route or `vite build` was touched. Nothing was committed. `routeTree.gen.ts` was not rewritten: its mtime is still 03:12:48.

## 1. Files

| File | Lines | Role |
|---|---|---|
| `index.tsx` | 208 | `SessionMonitorPage`, which keeps the stub contract (export name plus `data-testid="page-session-monitor"`). It holds the page state (Pause Monitoring, shutter key), a per-panel error boundary, the finalization and recovery overlay tracking, and the K title shimmer |
| `model.ts` | 394 | Pure selectors that return primitives or flat objects of primitives (review 40 R1): page, banner, details, integrity, feed, storage (display values), and the `cameraTiles`/`micTiles` mappers |
| `sim-adapter.ts` | 94 | SIM-GAP-W44-1 (write-rate series) and SIM-GAP-W44-2 (timeline values parsed from labels) |
| `choreography.ts` | 70 | M-PG-SM beats (K 0 … T 580), panel and stagger variants built on the step-36 kit (`cappedStagger`) |
| `panel.tsx` | 114 | The `Panel` frame (kit `Card`, gold icon, tracked title, "View All →" slot) and `PanelErrorBoundary` (friendly message plus the shared 3 s → 6 s → 12 s retry, max 3) |
| `log.ts` | 16 | Structured dev-console error record (level, source, message, stack, context, timestamp). No note or reason text is logged, only its length |
| `status-banner.tsx` | 157 | K banner |
| `live-feed-panel.tsx` | 276 | L: feed, camera switch, fullscreen, shutter, idle/setup/sealed/fault invitation |
| `details-panel.tsx` | 112 | M |
| `integrity-panel.tsx` | 190 | N: checks, verification sweep, Re-verify |
| `audio-panel.tsx` | 42 | O |
| `action-bar.tsx` | 609 | P: the six actions, marker Popover, note Drawer, snapshot, queue badge, End Session hold plus AlertDialog |
| `timeline-panel.tsx` | 85 | Q |
| `inputs-panel.tsx` | 96 | R |
| `storage-panel.tsx` | 149 | S (ProgressCircle, AnimatedNumber, Recharts sparkline) |
| `audit-panel.tsx` | 117 | T (AnimatedListItem, TextScramble hash) |
| `finalization-modal.tsx` | 359 | The finalization overlay (STOPPING → 6 steps → SEALED stamp, DEMO package digest) and the recovery overlay (FAULT → RECOVERY → INCOMPLETE) |
| `flight-context.ts`, `flight-layer.tsx` | 28, 107 | M-C-17 marker chip and M-C-18 snapshot thumbnail flights (portal, transform only) |
| `scroll-edges.ts` | 49 | Controlled ScrollShadow edges (performance fix B-44-1) |
| `session-monitor.css` | 1,289 | Page-scoped styles (`.sm-*`), the grid tiers, and the kit-part overrides (§3) |
| `__tests__/session-monitor.test.tsx` | 443 | 13 tests (§4.2) |
| `packages/shared/src/i18n/en/session.ts` | 281 (was 191) | Additive keys: `banner.{SETUP,SEALED,RECOVERY,recordingContinues,cta.*,FINALIZING.stopping}`, `idle.*`, `details.{evidenceId,state}`, `integrity.{storageWrite.idle,hashChainBroken,verifying,chainHead,verifiedRows,brokenAt,verifyFailed,checkStatus.*}`, `audio.micIcon`, action feedback and errors, `timeline.empty`, `inputs.offline`, `storage.{viewStorage,writeRateAria,free,ofTotal}`, `audit.{empty,hash}`, `finalization.{sealedTitle,stopping,stepDuration,sealedIn,packageTitle,manifestDigest,signature,signatureValue,demoNote,loadingPackage,noPackage,close}`, `recovery.{stagesLabel,done,failed}`. No existing key changed, because mobile step 79 reads this namespace |

**Test IDs for steps 45, 56 and 58:**
- Panels: `panel-K` … `panel-T` (`data-panel`).
- Page: `data-phase` (IDLE, SETUP, RECORDING, FINALIZING, SEALED, FAULT, RECOVERY) and `data-session-state`.
- Banner: `sm-status-banner` with `data-kind` and `data-tone`.
- Actions: `sm-action-{pause,marker,note,snapshot,queue,end}`, `sm-end-dialog`, `sm-end-reason`, `sm-end-confirm`.
- Other: `finalization-modal` (`data-mode`, `data-state`), `sm-final-sealed`, `sm-final-package` (`data-source` package or simulated), `sm-invitation`, `sm-reverify`, `sm-chain-result`.

## 2. Mockup mapping and states (01_specs §14.5.2; research/04 §3.2)

| ID | Built from | Data | Beyond the mockup |
|---|---|---|---|
| K | `PageHeader` (template) plus the banner in its status slot; MP **TextShimmer** sweeps the title once (2 s) after the TextEffect | `selectBanner`: session state plus the worst active alert | States ACTIVE & SECURE / ATTENTION / FAULT / NO SESSION / FINALIZING (spec), plus SETUP / SEALED / RECOVERY. CTAs: Start New Session, Continue setup, Start recovery. The dot breathes while something is alive and gives one halo on escalation (R8) |
| L | Kit `Card`, `ToggleButtonGroup` (Camera 1 \| Camera 2), `Button isIconOnly`, `Modal size="full"`, **CameraFeed** (step 39) | `selectFeed`, `setActiveCamera` | The live loop plays only while live; idle shows a dimmed poster under an invitation with **GlowRing `mini`** (M-PG-SM NO SESSION). Shutter flash on Snapshot |
| M | Key-value `dl` in a hairline box | `selectDetails` (operator display name, subject type Tersangka with the gloss as `title`, profile label, UTC+07:00 start) | Adds the Subject row, and Evidence ID once sealed |
| N | Read-only check list, `Spinner`, `Chip`, MP **TextScramble** (on Re-verify) | security, audit chain (AUDIT_TAMPER), time source, storage | One gold sweep band per new audit row. Re-verify recomputes the chain: PASS n rows, or FAIL at row i |
| O | **DbfsMeter** `panel` ×2 | transient channel (zero renders per frame) | CLIP latch, NO SIGNAL, Pause Monitoring dim |
| P | Kit `Toolbar`, `ToggleButton`, `Button` outline ×3, queue `Link`, `Button danger-soft`, `Popover`, `Drawer` plus `TextArea`, `AlertDialog`, `toast` | `addMarker`, `addNote`, `snapshot`, `stopRecording` | Marker and snapshot flights. Queue badge = session snapshots. End Session: 1.5 s hold (keyboard and assistive tech open the dialog directly), reason ≥ 5 characters |
| Q | **SessionTimeline** in its own kit ScrollShadow | `session.timeline` | Opens on the newest items; peak and autosave details rebuilt (SIM-GAP-W44-2) |
| R | Kit `Card variant="tertiary"` ×4, CameraFeed `thumb` (`live={false}`, D70), DbfsMeter `compact` | cameras, mics | — |
| S | Kit `ProgressCircle` (USED %), MP **AnimatedNumber**, Recharts sparkline | `selectStorage` (display values) | Est. remaining = free ÷ 8.2 GB/h (389 h 26 min at load; the mockup's "31h 26m" is not the dataset's) |
| T | MU **AnimatedListItem** (step-37 variants), MP **TextScramble** on the short hash | `selectAuditTail(s, 12)` | Severity dots, row hash, 1.5 s gold highlight on the newest row |
| Finalization | Kit `Modal` (non-dismissible until done), `ProgressBar` (transform fill), **Stepper** `pipeline`, **StepperStamp** | `session.finalization` | "Sealed n s after the recording ended". The DEMO package digest and signature key are loaded on demand from `@dems/shared/demo-data`. Close and "View in Evidence" |

## 3. Motion (03_motion_spec M-PG-SM, §8, §9)

- **Enter:** panels on their beats (K 0, L 80, M 140, N 200, O 260, P 320, Q 400, R 460, S 520, T 580).
  - Rows stagger inside: details 30 ms, checks 80 ms, actions 40 ms, tiles 60 ms, audit 30 ms, capped at 8.
  - The ring sweeps after the held beat (M-C-03, 900 ms `luxe`, stroke-dashoffset on the small SVG).
- **Hero:** the REC chip pulse and the SlidingNumber timer, with the feed's breathing frame glow (step-39 CameraFeed).
- **Ambient (browser, `?debug=1`):** 4/4. That is `clock-colon, secure-dot, topo-drift` (shell, one slot), `banner-dot`, `feed-frame-glow` and `rec-pulse`. Idle uses 2 slots: shell and `glow-ring` (mini breath). The camera push-in takes a slot only if the video falls back to the canvas.
- **Data moments:**
  - verification sweep on N;
  - timeline insertions (M-C-08);
  - audit insertions (M-C-07);
  - MIC clip → banner ATTENTION;
  - End Session: M-C-19 hold fill, then the AlertDialog, then the finalization Stepper (M-C-09), then the SEALED stamp (`bouncy`, e3 flash, hairline ring: the completion moment). The header icon turns violet and the title becomes "Evidence sealed".
- **Flights:** the marker chip goes to the timeline, and the snapshot thumbnail goes to the Open Evidence Queue button, whose badge then pops (`bouncy`). Both use transform only, in a portal.
- **Reduced (§8):**
  - Browser: `html[data-motion=reduced]`, 12 `data-motion="reduced"` marks on the page, ambient 0/4, and the video paused on its poster.
  - Meters still run at 10 Hz per instance (the overlay shows 20/s per channel).
  - The page has no title shimmer, flights or flashes. The shutter becomes a border highlight, and the End Session dialog opens without a hold.
- **Property rules:**
  - AC-72 grep: no match.
  - MS-02: no animated `box-shadow`.
  - No `will-change` in the folder.
  - The kit ProgressBar's `width` transition is replaced with a `scaleX` fill (CSS in `session-monitor.css`).

## 4. Verification (fresh; commands and output)

### 4.1 Gates

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck -w @dems/core-web` (06:46:47) | exit 0 |
| Lint | `npm run lint -w @dems/core-web`; `npx oxlint -f json` | exit 0; `files 274 diagnostics 0` |
| Tests (full) | `npm test -w @dems/core-web -- --maxWorkers=2 --reporter=json` (06:47:21–06:48:03) | exit 0; **26 files, 320 passed, 0 failed** |
| Page and route tests | `npx vitest run src/features/session-monitor src/test/routes.test.tsx --maxWorkers=2` | `Test Files 2 passed (2)`, `Tests 44 passed (44)`. Step 38's `/session` route test still passes |
| Shared (namespace edit) | `npx vitest run test/i18n.test.ts` (shared); `npm run typecheck -w @dems/shared`; `npm run lint -w @dems/shared` | 14/14 (the "End Session" and "no stop session/recording" rules hold); exit 0; exit 0 |
| AC-72 | `grep -rnE "animate=\{\{[^}]*(width\|height\|top\|left)" apps/core-web/src` | exit 1 (no match) |
| MS-02, will-change | `grep … box-shadow … animate\|transition`; `grep -rnE "will-change\|willChange" features/session-monitor` | exit 1; exit 1 |
| Review 40 R1 | `grep -rn selectSystemState features/session-monitor` | the only use is `useSim((s) => selectSystemState(s).state)` (`live-feed-panel.tsx:225`) |

### 4.2 Step-44 tests (13)

| Test | Proves |
|---|---|
| Recording render | Row-44 render check (above). Also: the ACTIVE banner copy; details (SES-…-0024, AKP Budi Santoso, Tersangka, Ahmad Fauzi, profile, Duration 00:18:4x); 4 passing checks with "GNSS (UTC+07:00)"; ≥ 5 timeline items; USED ring; 12 audit rows; End Session enabled; 0 missing i18n keys (AC-66) |
| Camera switch | `setActiveCamera` → VIDEO-02 loop and label, after the 320 ms cross-fade |
| AC-63 unit form | Row-44 fake-timer check. Also: 6 steps done, `View in Evidence` → `/evidence/EV-…-0014`, banner SEALED, package `data-source="package"`. **RECORDING_STOPPED is attributed to the signed-in operator (OPR-002, not the creator OPR-001; review 40 M5)** |
| Hold to confirm | A 600 ms pointer press does not open the dialog, and the button shows "Hold to end the session". A 1.6 s hold opens it |
| Actions | Marker (label into the timeline), note (empty note refused inline, then saved), snapshot (count +1, badge, shutter), queue href `/evidence?status=RECORDED`, timeline +3 |
| Pause Monitoring | UI-only: "Resume Monitoring", the feed shows "Monitoring paused. Recording continues.", REC stays, the sim stays RECORDING |
| RBAC | A TECHNICIAN sees End Session disabled, `data-permitted="false"` and `aria-describedby` "Your role cannot end sessions." (review 40 R4) |
| Idle | NO SESSION banner with CTA `/session/new`; the invitation with GlowRing "System ready" and Start New Session; actions disabled; empty timeline; feed `data-live="false"` |
| Escalation | MIC_CLIP → ATTENTION "Recording continues • Microphone clipping". CAMERA_LOSS → FAULT, recording continues, NO SIGNAL overlay |
| Re-verify | PASS; then after AUDIT_TAMPER the hash-chain check fails and Re-verify gives FAIL |
| Reduced motion | `data-motion="reduced"`, meters kept, no shimmer, banner loop marked reduced |
| View models | Banner kinds for recording, GNSS loss (ATTENTION), idle and finalizing (total 6) |
| SIM-GAP-W44-2 | Peak level, segment and bytes at 8.2 GB/h (30 min → 4.1 GB) |

**Mutation check.** Three files were backed up and restored afterwards (`cmp`: restored identical).

| Mutation | Tests that fail |
|---|---|
| M1: End Session confirm does not call `stopRecording` | the AC-63 test |
| M2: CameraFeed forced to `src={null}` | the render test and the camera-switch test |
| M3: End Session always permitted | the RBAC test |

Result: **4 failed | 9 passed**.

## 5. Browser check (lane B, headless Chromium over CDP)

**Method:**
- **Server:** Vite on **127.0.0.1:5177** (D59 lane B) with a scratch config that reuses `apps/core-web/vite.config.ts` unchanged. It moves only `cacheDir` to the scratchpad (step-39 N-39-1) and sets the port.
- **Browser:** Playwright `chrome-headless-shell` 1243, driven by a scratch Node script over CDP. Nothing was installed.
- **Sign-in:** `sessionStorage['dems.auth'] = {operatorId: 'OPR-001', issuedAt}` (P4); mock-core was not used.
- **Scenario:** the recording scenario was loaded through the page's own simulator. The script found the `SimContext` value in the React tree and called `loadScenario('recording')`, then reloaded so the page enters on the resumed snapshot (S4).
- **Measurement:** fps from a rAF counter; long tasks from `PerformanceObserver('longtask')`; ambient slots and meter frames from the `?debug=1` overlay; fit from `main.scrollHeight` vs `clientHeight`.

**Final results** (code as delivered; 06:39–06:45 WIB):

| Viewport | State | fps (avg) | Long tasks > 50 ms | Fit (`main` scroll / client) | Notes |
|---|---|---|---|---|---|
| 1920×1080 | recording, 10 s | 59.7 | 0 | 1000 / 1000 (no scroll) | Overlay: ambient 4/4, meters AUDIO-01 **40/s**, AUDIO-02 **40/s** (AC-61 ≥ 15), fps 61, long tasks 0 |
| 1920×1080 | recording soak, 30 s after 5 s warm-up (AC-71 form) | 59.5 / 59.0 (`?debug=1`) | 1 / 1 | no scroll | AC-71: ≥ 55 fps and ≤ 3 long tasks. Headless is informational; step 58 measures windowed Chrome (D70) |
| 1920×1080 | idle | 60.1 | 0 | no scroll | NO SESSION |
| 1920×1080 | reduced (OS emulation) | 60.1 | 0 | no scroll | ambient 0/4, video paused, meters kept |
| 1920×1080 | End Session → SEALED | — | — | — | Pointer hold opens the dialog; **SEALED 7.6 s after confirm** (AC-63 ≤ 10 s); DEMO package joined |
| 1440×900 | recording, 10 s | 59.3 | 0 | 828 / 828 (no scroll) | — |
| 1440×900 | recording soak, 30 s | 60.0 / 60.0 | 0 / 0 | no scroll | — |
| 1440×900 | idle / reduced | 60.1 / 60.2 | 0 / 0 | no scroll | — |
| 1440×900 | End Session → SEALED | — | — | — | SEALED 7.5 s after confirm |

Console: no errors and no exceptions. The only warnings are Motion's "You have Reduced Motion enabled" notice in the reduced runs (step-36 N-3).

**Screenshots** (`implementation/assets/`, 16 per viewport, prefix `24_1920_` or `24_1440_`):
- `recording`, `recording_enter`, `recording_debug`, `idle`;
- `end_hold` (fill at about 50%), `end_dialog`;
- `finalization_stopping`, `finalization_steps`, `finalization_stamp`, `finalization_sealed`, `sealed_page`;
- `reduced`, `attention_clip` (MIC 2 CLIP, ATTENTION banner, FAULT node);
- `snapshot_flash` (shutter, thumbnail in flight, badge 2, toast);
- `fullscreen_flight` (kit Modal at +40 ms), `fullscreen`.

### 5.1 Comparison with `ui_design/DEMS-SessionMonitor.png`

| Area | Match | Differences (all intended) |
|---|---|---|
| Grid | Same composition and proportions. At 1920: L 820×424, M 402×424, N 402×214 over O 402×194, P 1656×62, Q 681×366, R 541×204 over S 541×147, T 402×366 | Fits without scrolling at 1920 and 1440 |
| K | Oblique white-to-gold title, subtitle, green banner "SESSION ACTIVE & SECURE / Recording in progress • All integrity checks passing" | Page icon is the sidebar's `Monitor` (§14.4) |
| L | Top-left "Camera 1 - Interview Room 1", top-right "● REC 00:18:4x", bottom-left "1080p • 25 fps • H.264", bottom-right fullscreen | The Camera 1 \| Camera 2 switch is added (04 §3.2 proposal). The footage is the step-92 loop, top-anchored crop (DR-44-6) |
| M | Same rows and gold Duration | Dataset values (SES-…-0024, LP/…, AKP Budi Santoso, Tersangka) instead of the mockup's placeholders. A Subject row is added |
| N | Four green checks with AES-256, SHA-256, time source, Continuous | "GNSS (UTC+07:00)" (dataset) instead of "NTP (UTC+10:00)". A chain-head line with Re-verify is added |
| O | MIC 1 - Interviewer / MIC 2 - Subject, mic in a ring, staircase meters, dBFS | The en dash label from the demo tracks (row 44). The ring is hidden below 1600 px |
| P | Six buttons; gold Pause Monitoring; red End Session | "Pause Monitoring" typo fixed. The End Session subtitle is "End recording and seal evidence" (i18n rule: no "stop recording"). Below 1600 px titles only |
| Q, R, S, T | Same content types and styles | Values from the simulator. S reads 20% USED (D28/Q1; the mockup's 80% is 04 §9 #4). Est. remaining is 389 h, from the dataset |

### 5.2 Defects the browser found (fixed)

| ID | Finding | Fix | Proof |
|---|---|---|---|
| B-44-1 | The kit ScrollShadow's automatic mode watches its subtree with a MutationObserver and reads `scrollHeight` on every mutation. Inside the live lists, every animation frame forced a layout (profile: 83 ms self time in 4 s) | `scroll-edges.ts` computes the edges from `scroll` and ResizeObserver only, and passes a controlled `visibility` (the kit observers switch off) | Not re-profiled on its own. It landed with B-44-2 and B-44-3, and the combined result is the final long-task count |
| B-44-2 | A long task every second (51–84 ms; 31 in 30 s at 1920). Cause: a second MP SlidingNumber set (Duration). SlidingNumber gives each digit layer a `layoutId`, and Motion re-measures all 60 layers per tick | Duration is plain gold mono text (DR-44-3). The REC chip keeps the SlidingNumber hero timer | 31 → 11 → (after B-44-3) 1 long task in 30 s; a shell-only stub page gives 0 |
| B-44-3 | Periodic long tasks from the Recharts re-render (sampling) and the storage panel re-rendering on raw bytes every second | Storage selects display strings (re-renders only on a visible change). The write-rate sampler appends only when the rate changes (5 s sampling) | 1 long task in 30 s at 1920; 0 at 1440 |
| B-44-4 | Inside the fullscreen Modal, SlidingNumber measured its digit height mid scale-in, and its ten layers stacked (garbled REC timer) | The fullscreen REC chip shows plain tabular time (DR-44-4) | `24_1920_fullscreen.png` shows "REC 00:18:49" |
| B-44-5 | At 1440 the video's burnt-in "…\| LIVE \| DEMO" line was half-cut behind the format chip | Top-anchored cover crop; the fullscreen view shows the full frame (DR-44-6) | `24_1440_recording.png` |
| B-44-6 | Test harness: `useSim(selectMicTiles)` returned fresh objects and looped ("Maximum update depth") | Selectors now return store-owned arrays; mapping happens in `useMemo` (review 40 R1) | Tests green |

## 6. Decisions, drift, SIM-GAPs and relays

| ID | Kind | Item |
|---|---|---|
| **SIM-GAP-W44-1** | sim gap (step 54) | No write-rate history, and the rate is constant (8.2 GB/h ≈ 2.3 MB/s). `sim-adapter.ts` samples the live value every 5 sim seconds and appends only changes. Step 54 may add variance and a bounded `writeRateHistory` (review 40 m3) |
| **SIM-GAP-W44-2** | sim gap (step 54) | `TimelineEvent` carries EN display text only. AUDIO_PEAK's level and AUTOSAVE's segment are parsed from the label, and the segment size is `recordingBytes(at − startedAt)`. Step 54 adds `params` (review 40 m4) |
| DR-44-1 | decision | Panel test IDs are `panel-K` … `panel-T`; no convention existed. K wraps `PageHeader`, which owns its own `data-testid` |
| DR-44-2 | decision | States beyond the spec's five banner states: SETUP (Continue setup), SEALED (violet, Start New Session plus View evidence) and RECOVERY. The recovery overlay (FAULT → Start recovery → RECOVERY_SCAN → INCOMPLETE_SESSION_ANALYSIS → INCOMPLETE notice, SYS-008) uses the existing `session.recovery.*` keys |
| DR-44-3 | drift (spec M) | Duration is plain gold mono text, not MP SlidingNumber (B-44-2, P9). The hero timer in the REC chip keeps SlidingNumber |
| DR-44-4 | drift (fullscreen) | The fullscreen REC chip is RecIndicator with plain time (B-44-4) |
| DR-44-5 | drift (M-C-12, R5) | No `layoutId="feed-<cameraId>"` flight into fullscreen: in the browser the flight did not play into the kit Modal's portal. The kit's own Modal transition is used (M-C-15, D6), and the page feed stops decoding while fullscreen plays (one video decode) |
| DR-44-6 | decision | The main feed crops with `object-position: center top` (the OSD line is cropped whole at every width); the fullscreen 16:9 view shows it |
| DR-44-7 | decision | Reduced motion opens the End Session dialog on press (no 1.5 s hold to watch). The mandatory reason is kept (S21) |
| DR-44-8 | decision | The finalization and recovery overlays follow a session this page watched enter FINALIZING or RECOVERY, and stay open until closed. A reload into SEALED opens no overlay. `acknowledgeSummary` is not called (mobile SCR-02 semantics) |
| DR-44-9 | decision | The timeline opens scrolled to its newest items (a session joined mid-way); later insertions follow the 5 s user-scroll rule |
| DR-44-10 | decision | Below 1600 px (1440 tier), density rules apply: action subtitles are hidden (the End Session hold hint still shows), the mic rings in O are hidden, labels and values are smaller, and truncated values carry `title` |
| DR-44-11 | error handling | No client log endpoint exists (D41(g)), so `log.ts` writes structured dev-console records. Users see kit toasts with generic copy (review 40 m8: no English `SimTransitionError` text) and per-panel fallbacks with the rate-limited retry. Input is pre-validated: reason ≥ 5, note 1–2000, marker ≤ 80 characters |
| Review 40 (D74) | applied | **R1** primitive or store-owned selectors only; `selectSystemState(s).state`. **R4/M5**: End Session, Continue setup and Start recovery are gated on `SESSION_START` with a reason text; the test proves the stop is attributed to the signed-in operator. **M4/R2** (the package join guard, used by the finalization view): the step-93 package is accepted only when case number, subject and session suffix match (`demoIdSuffix`); otherwise the simulator's manifest hash is shown, labelled SIMULATED. **R8**: 1 Hz via `useSimSecond`; the timeline re-renders on insertion only. **R9**: no new suffix parser. **m12**: `@dems/shared/demo-data` is loaded only by dynamic import, inside the lazy page chunk |

**Relays:**

| To | Item |
|---|---|
| 46 (Start Session) | The invitation and banner CTAs link to `/session/new`. After Start, `/session` shows RECORDING with REC (AC-62). SETUP shows "Continue setup" |
| 54 (sim owner) | SIM-GAP-W44-1 and SIM-GAP-W44-2 (`grep -rn SIM-GAP-W44 apps/core-web/src`). Once start and stop enforce RBAC, the UI gate stays as defence in depth |
| 45, 58 (verification, port 5173) | AC-61: `?debug=1` shows 40/s per channel. AC-71: measure in windowed Chrome; headless gives 59.5 fps with 1 long task in 30 s at 1920. AC-63 end-to-end: the Evidence page (step 47) must show EV-…-0014 as violet Sealed with Verify PASS |
| 56 (tests), 42 and the controller (P11) | During this run, `src/test/shell-motion.test.tsx` ("escalation … BorderBeam", "marks `<html>` …") and `src/test/routes.test.tsx` failed only on `/dashboard` and `/evidence/$id` while steps 42 and 47 were writing (05:57, 06:34). The final run at 06:48 is 320/320. Separately, a Dashboard with four page loops could suppress the shell's SECURE beam (the ambient cap), which is worth a look in step 45 |
| Controller | `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and `99_implementation_report.md` were not edited (parallel run, P8) |

## 7. Parallel-run notes (P1–P13)

- **P1:** no install; no manifest or lockfile edit.
- **P4:** Vite on 127.0.0.1:5177 only (never 5174 or 5175); `dems.auth` seeded with OPR-001; mock-core not started (P5 not needed).
- **P6:** paths as listed in the header. Step 38's `routeTree.gen.ts` was not rewritten (mtime 03:12:48).
- **P7:** processes started and stopped:
  - Vite: npx 87867 / node 87885, stopped at 06:49;
  - `chrome-headless-shell` one-shots (for example PID 88781), each killed by its script.

  Afterwards `lsof` showed 5177 and 9339 free and `pgrep` found no headless shell. The scratch profiles and the Vite cache were deleted.
- **P9:** vitest always ran with `--maxWorkers=2`; no `vite build`.
- **P10:** per-command sandbox bypass only for the Vite bind, the browser launches and the kill.
- **P11:** see Relays. In addition, other steps' edits reached this dev server as HMR updates: Tailwind's `index.css` on any source save, and full page reloads when `i18n/en/{storage,evidence,security-audit}.ts` changed (06:15, 06:38, 06:42). Two measurement runs were interrupted this way and were re-run (the 1440 soak).
- **P13:** DEMO data is labelled DEMO. The package digest, signature key and a notice sit in the finalization view; no hashes are hard-coded; the join uses `getDemoEvidencePackage` and `demoIdSuffix`.

**Persistent issues: none.** Blockers: none.

---
*Generated: 2026-10-01 06:50 WIB*
