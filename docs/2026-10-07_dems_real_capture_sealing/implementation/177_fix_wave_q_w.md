---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: FIX WAVE Q, driver Q-W - every not-confirmed and new WEB finding of the confirmation (report/confirm_c3_web.md), apps/core-web ONLY; decision D246
date: 2026-10-12
agent: coder-execution (driver; rules D94 / D122 / D163; fix brief wave J)
narrative_tier: 2
status: complete - 3 not-confirmed rows and 5 of the 8 new findings fixed whole, 2 in part, 1 not fixed (section 1); the web's side of CT-08 and CP-05 fixed; "Acknowledge all" proven with an open unsealable notice
tree: b4b0c25 + this wave (uncommitted); no git write
proof: tests, typecheck, lint AND a headless browser on both lanes (section 5)
---

# 177 - Fix wave Q, driver Q-W: the web console

Only `apps/core-web/**` was edited, plus this note, one claim line in `delegation_progress/file_claims.md`,
my lines in `delegation_progress/judging_slots.md` and `delegation_progress/coder-execution_wave_q_w.md`.
No git write, no install, no lane restart, no local device, nothing played aloud, no secret in this note.
Paths below are under `apps/core-web/src/`.

**The quiet window was kept**: from the start until the line "QUIET WINDOW CLOSED by Q-M at 14:05" nothing was run
(no test, typecheck, lint, build, browser); the edits and their tests were written in that time. The dev servers
hot-reloaded each saved file.

## 1. Every finding

| Id | Sev. | State | Cause (file:line before) | Change | Test | Proven |
|---|---|---|---|---|---|---|
| JW-10 | MINOR | **fixed** | `features/evidence/evidence.css` (`.evi-table .evi-strong { white-space: nowrap }`, automatic table layout): one long subject made the Subject column 509 px | FIXED table layout as wide as its card (`evidence.css:240`); set widths for ID 176, Duration 100, Status 252, Case 22 %, row menu 52; Subject takes the rest. Free text (subject, case number, investigator) wraps inside its column, also inside a word, and is cut after three lines by an ellipsis with the whole text as `title` (`evidence.css:384`, `evidence-table.tsx:233`); the Status cell and the row menu are never cut | `test/evidence-table.test.tsx` "JW-10" (3 cases: the two stylesheet rules; a row with a 130-character subject and a long case number) | BROWSER, lane 2, section 5.1 |
| JW-13 (custody part) | MINOR | **fixed** | `features/evidence/integrity-tab.tsx:47` worded an action only when its code was an AUDIT type; the custody codes `SEALED`, `VERIFIED`, `VERIFY_FAILED` are not | ONE map, `lib/event-words.ts:89` `CUSTODY_ACTION_KEY` (11 actions) + `readableCode` (`:40`) for a code no vocabulary holds; the table reads it (`integrity-tab.tsx:458`); the code stays as `title` and `data-custody-action`. Sweep: section 2 | `lib/__tests__/event-words.test.ts` (new; 8 cases - a KNOWN code without words fails: section 2); `features/evidence/__tests__/cf-web-custody-media.test.tsx` (the case that pinned the raw code with `<wbr>` is replaced) | BROWSER, lane 2: `EV-20261009-0005` 24 rows, 22 x "Evidence verification failed", 0 raw; `EV-20261012-0073` "Evidence verified", "Evidence exported", "Export downloaded", "Evidence sealed" |
| JW-18 | MINOR | **fixed** (= CW-01 + CW-02 + what the extended check found, section 4) | - | - | - | BROWSER: the box check is clean on every page of both lanes at the three widths (section 4) |
| CW-01 | MINOR | **fixed** | `features/session-monitor/session-monitor.css` `.sm-card-title { min-width: 0; overflow-wrap: break-word }` in a one-row header beside the DEMO chip and the control | The header wraps (`session-monitor.css:241`); the title is never narrower than its longest word and has no forced break (`:258`). Integrity rows ("SHA- / 256", "(UTC+0 / 7:00)"): label and value columns never narrower than a word, a short value keeps its line (`:562`). Same rule for the New Session and Paired Devices card headers | `test/box-check.test.ts` "the stylesheets" (2 cases) + the rule (a) cases | BROWSER: lane 1 at 1440 the heading is 179 x 20 px, one line, the control under it (`q13`); lane 2 recording at 1280 clean (`q07`) |
| CW-02 | MINOR | **fixed** | `features/devices/camera-preview.tsx:71`: the lines lay OVER the frame (`absolute inset-0 overflow-hidden`) and the frame could shrink to nothing (`min-h-0` from the Dashboard) | In a tile the lines are in the flow and the frame never shrinks under them (`camera-preview.tsx:64`). At 1280 a tile was 136 px wide: tiles two by two when the card is under 640 px (`dashboard.css:577`); the source badge wraps instead of standing one letter per line (`dashboard.css:89`) | `features/devices/__tests__/camera-no-preview.test.tsx` (Dashboard case extended) | BROWSER: lane 2 Dashboard clean at 1280 / 1440 / 1920; picture `q03_l2_dashboard_1280` opened |
| CW-03 | NOTE | **fixed** | `features/session-new/devices-step.tsx:352`: `t('common.enums.lensState.UNREACHABLE', { defaultValue })` - the key does not exist, and `t()` records a missing key even with a default. The row of an unreachable camera asked for it | The value is worded through the map, which asks the tree first (`event-words.ts:157`, `devices-step.tsx:353`); the same form in `alerts/index.tsx`, `system/demo-panel.tsx` | `features/session-new/__tests__/precheck-unreachable.test.tsx` (the row: no missing key); `event-words.test.ts` "CW-03" with the old lookup as its control | BROWSER, lane 2: the whole flow of the finding (form, pre-check with the unreachable camera, Ready, countdown, recording, marker, seal) - 0 console warnings, `getMissingI18nKeys()` empty at four points; control: the old lookup run by hand in the page gave the warning and the key |
| CW-04 | MINOR | **fixed** | `features/session-monitor/finalization-modal.tsx:367`: `live ? 'LIVE' : 'SIMULATED'` beside the digest; no mark in the dialog | DEMO · SIMULATED mark in the header (`:11`, `DemoMark block="seal-dialog"`), the sentence "Demonstration: this seal is simulated. The item is a demonstration record, not evidence.", and the chip beside the digest says DEMO · SIMULATED on the demonstration Core (`:380`); "LIVE" only on a Core in its own capture | `test/live-session-monitor-actions.test.tsx` "B-2 stop" (pin moved: it held "never says simulated"); control `test/real-core-facts.test.tsx` "G89b-05" | BROWSER, lane 1: `q14` opened; lane 2 control: no mark, no chip |
| CW-05 | NOTE | **fixed** | `components/shell/notifications-bell.tsx:123` two inline links; `shell.css:1490` tag placed by the grid | The links in one row with a gap (`notifications-bell.tsx:124`); tag under the text, control under the time (`shell.css:1494`) | none (layout) | BROWSER, lane 2: links at x 547-600 and 618-709; the tag 173 x 18 px (one line) |
| CW-06 | NOTE | **not fixed** | The rejection comes from the router's own `document.startViewTransition` call when a second navigation starts (TanStack Router, `router.tsx:60`); nothing visible breaks | A fix is a global `unhandledrejection` filter for one browser message - hiding, not fixing. Left | - | - |
| CW-07 | NOTE | **not fixed** | Repeated sentences of the blocked dialog; "Recording pipeline - OK" in the pill's popover during retries | Wording across three shared sentences and the pill's checklist model: not one line. Listed | - | - |
| CW-08 | NOTE | **part** | (b) `features/system/quick-actions.tsx:25` always four cards | (b) FIXED: no "Software Update" card on a Core without an updater (`quick-actions.tsx:70`). (f) FIXED on the web form = CT-08 below. (a) another export's number on a demonstration item's download, (c) synthetic services in the log export, (d) "Re-verify", (e) the synthetic chart's axis: listed, not changed | `test/real-core-facts.test.tsx` "System: ... no Software Update quick action" + control | BROWSER: lane 2 three cards, lane 1 four |
| CT-08 (web side) | - | **fixed** | `features/session-new/info-step.tsx:387`, `ready-step.tsx:118`: the label of the form's `profileId` | On a Core in its own capture the form states the selector lines IN FORCE per track and offers no choice (`model.ts:234` `selectorProfileLinesOf`, `info-step.tsx:366`); preview and Ready summary the same | `test/real-core-facts.test.tsx` "G75d-05" (3 new cases incl. the simulated control) | BROWSER, lane 2: "Configured profile - VIDEO-01: H264_720P30 / VIDEO-02: H264_720P30"; lane 1 keeps "Standard (1080p / 25 fps)" |
| CP-05 (web side) | - | **fixed** | the list row drew the status chip only | ONE mark "Demonstration record" on the list row and the item header, in Live mode, for a demonstration item (`item-marks.tsx:68`) | `test/live-w0-evidence-words.test.tsx` "CP-05" (2 cases); Simulated control in `test/evidence-table.test.tsx` | BROWSER, lane 1: rows "Sealed · Demonstration record"; header of `EV-20261012-0020` "Sealed / Demonstration record / Core record" |

Counts: not-confirmed rows 3 of 3 fixed. New findings: 5 fixed (CW-01, -02, -03, -04, -05), 1 part (CW-08),
2 not fixed (CW-06, CW-07; both NOTES). Device judges' web side: 2 of 2.

## 2. JW-13 - the sweep: every place that printed a code, now through `lib/event-words.ts`

| Place | Source file | Was | Now |
|---|---|---|---|
| Custody table, action and detail | `features/evidence/integrity-tab.tsx` | audit vocabulary or the raw code | `custodyActionWords`, `custodyDetailWords` |
| Metadata tab, custody lines | `features/evidence/metadata-tab.tsx:257` | raw `entry.action` | `custodyActionWords` (code as title) |
| Audit log rows, auth feed, tamper feed, chain inspector | `features/security-audit/{audit-log-panel,auth-panel,tamper-panel,chain-panel}.tsx` | `t('common.auditType.' + type)` - a key as text for an unknown type | `auditTypeWords`, `faultKindWords` |
| Monitor audit card, Devices drawer log, System demo panel | `session-monitor/audit-panel.tsx`, `devices/device-drawer.tsx`, `system/demo-panel.tsx` | the same | the same |
| Activity lists (Storage, Network & Time, Dashboard) | `storage/activity-panel.tsx`, `network-time/events-panel.tsx`, `lib/event-words.ts` `eventTitle` | the same | `eventTypeWords`, `faultKindWords` |
| Header pill, critical kind | `components/shell/integrity-checks.ts` | the same | `faultKindWords` |
| Alerts page, severity | `features/alerts/index.tsx:88` | `t()` with a default (raw + missing key) | `severityWords` |
| Pre-check row value | `features/session-new/devices-step.tsx` | the same | `enumValueWords` |
| Interrupted cause (list, header, Sessions) | `features/evidence/cause-words.ts` | fault name or the raw code | `causeCodeWords` |
| Unsealable cause: bell notice, Monitor notice | `components/shell/notifications-bell.tsx`, `session-monitor/unsealable-notice.tsx` | "Cause code: X" | "Cause: <words> (code X)" |
| Session history cause | `features/sessions/index.tsx:170` | "...(the code the Core recorded): X" | "Why it could not be sealed: <words> (the code the Core recorded: X)" |
| Export job failure, finished export kind | `evidence/export-job-status.tsx`, `evidence/finished-exports.tsx` | "(SOURCE_VERIFY_FAILED)", raw kind | readable words; the code on `data-reason` |

Alert kinds are not printed anywhere (a row shows the Core's message); export states were already worded
(`evidence.exportJob.status.*`). The known-code test reads the codes where they are DEFINED: `AuditType` (67),
`SimEventType` (46), `FaultKind` (14), `SEAL_BLOCKED_DETAILS` (6) and the custody actions the shared sources write
(a scan; 11).

## 3. `overflow-wrap: anywhere` / `word-break: break-all` - where they remain and why

Removed from three labels (`.dems-strip-value-text`, `.sn-readiness-label`, `.dems-role-reason`). The 16 rules left
are data cells of a set width, each listed with its reason in `test/box-check.test.ts` (`BREAKS_ANYWHERE`); a new
one fails that test: `.api-kv dd`, `.api-rt-json-wrap`, `.dev-connect-target dd`, `.dev-cam-meta dd`,
`.dev-facts-row dd`, `.evi-mono` (hashes), `.evi-table .evi-free`, the three custody cells, `.evi-cert-subject`,
`.evi-transcript-text`, `.nt-kv-item dd, .nt-facts dd`, `.pd-reason`, `.sa-export-result dd`, `.sn-check-detail`,
`.ses-caption`, `.alr-message`.

## 4. The extended box check and what it found

`test/box-check.ts` (new): the judges' `box.js` as a module of the console, served by the dev server and run in the
page (`(await import('/src/test/box-check.ts')).boxCheck()`); rules held by `test/box-check.test.ts` (14 cases).
New rules: (a) a word laid out on more than one line; (b) text wider or taller than its box with the rest hidden,
unless an ellipsis or a line clamp AND a title say it; and a text sticking out of the ancestor that clips it. The
old check never ran that last rule on page content: it skipped everything inside `[data-shell-slot]`, and the whole
page is inside `data-shell-slot="route-content"` - why CW-02 was missed.

Found on the first run after the fixes of section 1 (all fixed, then clean):

| Lane, page, width | Finding | Fix |
|---|---|---|
| 2 Dashboard 1280 | "Development source" clipped by all four tiles; "Test source" one letter per line (badge 180 px high); "CAM-02" broken | tiles two by two under 640 px; badge wraps (`dashboard.css:577`, `:89`) |
| 2 Session Monitor 1280, 1440 | thumb "No / preview" cut by its 59 x 33 px frame; "SHA-256", the evidence id and "acknowledged" broken | a thumb draws the icon, its words stay as name and title (`camera-preview.tsx:86`); check rows and audit rows (`session-monitor.css:562`) |
| 2 New Session 1280, 1440 | "Time Sync" 25 px wide, one letter per line; "Security" broken; a profile line broken | the row wraps (`session-new.css:374`); one whole token per track |
| 2 Devices 1280, 1440 | "Camera / 1", "VIDEO- / 01" (name 45 px wide) | the tile head wraps (`devices.css:538`) |
| 2 Security & Audit 1280 | hash-chain strip 1057 px in 1008; audit table 1144 px in 1008 (round three's cue); event names pushed out of their 40 px rows | strip closer below 1440 (`security-audit.css:310`); the six fixed columns narrowed to 774 px so the table FITS (`audit-log-panel.tsx:94`) - no cue is drawn any more; the reference line on one line with an ellipsis and its title (`:449`) |
| 1 Dashboard 1280 | the format chip "1080p • 25 fps" clipped by the tile | rows of the two-by-two grid at least 128 px |

Two rules of the check were narrowed after reading what they flagged: a long identifier or an ordinary compound word
("Auto-Save") in running text may wrap at its hyphen; a code view (the record's JSON) scrolls sideways by design.

Final run, every page at 1280 x 800, 1440 x 900, 1920 x 1080: **lane 2: 18 pages, 54 checks; lane 1: 16 pages,
48 checks - all clean** after the last fixes (logs `.cache/judging/wave-q-w/work/sweep_l{1,2}.log` hold the run
before the last four fixes; those pages were run again, clean). Also clean: the recording Monitor on both lanes, the
pre-check with the warning, the Ready step, both seal dialogs, the bell popover.

## 5. Proven in the browser (headless Chromium, muted, two profiles; 14:10 - 14:30)

1. **JW-10, lane 2**, table = card at all three widths: 1024 in 1024 (1280), 1184 in 1184 (1440), 1077 in 1077
   (1920, with the preview pane); the row menu inside the card and hit-testable on every row; no status chip outside
   its cell. With the long subject ("Round Two Wijayakusuma Hadiningrat J2M form note Counsel present") and with
   "Sealed · verification FAILED" (`EV-20261009-0005`): the same. Pictures `q01`, `q02` (one opened).
2. **"Acknowledge all" with an unsealable notice open** (lane 2, supervisor). `SES-20261012-0111` (API, 45 s, seal rig
   `unsealable`, then `release`, status OFF) ended in quarantine, notice `ALR-000242`. Bell: "Acknowledge all (9)".
   Confirmation, quoted: "Acknowledge 9 alerts? - 9 alerts are marked as acknowledged for every console of this Core,
   one after the other. The faults behind them are not cleared by this. - 1 notice of a recording that could not be
   sealed (kept in quarantine) is not included. It is left for individual acknowledgement on its own row. - Cancel /
   Acknowledge 9 alerts". Run: 9 `POST alerts/{id}/acknowledge`, 9 x 204, `ALR-000242` not among them; the bell then
   "1 new alert" with the notice and "Acknowledge and close". Pressed: one POST, 204; the Core: `active false`,
   `acknowledged true`; pill back to "NO FAULT REPORTED".
3. Web session lane 2 `SES-20261012-0112` (52 s, source rig at the pre-check, released) -> `EV-20261012-0082`;
   lane 1 `SES-20261012-0031` (45 s) -> `EV-20261012-0020`. The other proofs are in the rows of section 1.

Not seen in a browser: CW-06 (not fixed); the role other than supervisor; widths other than the three.

## 6. Checks

| Check | Result |
|---|---|
| `npm run -s typecheck -w apps/core-web` | exit 0 (after the last edit) |
| `npm run -s lint -w apps/core-web` | exit 0, no output (after the last edit) |
| Touched files, first run (12 files) | 2 failed of 216 - both MY new cases (a control that assumed the Devices tiles are not `tile` frames; a seal-dialog case mounted without the Core's two statements); fixed, the two files run again: 99 passed |
| Whole suite, run 1 (before the box-check fixes) | 172 files, 2366 tests, 0 failed |
| **Whole suite on the tree as delivered** | **`npm test -w apps/core-web`: 172 files, 2367 tests, 0 failed** (157 s) |

The load was NOT below 6 at either whole run (7.6 - 9.1 at the start: the mobile driver was working); both passed.
New test files: `lib/__tests__/event-words.test.ts` (the map had none), `test/box-check.test.ts` (new module). Pins
moved because the product changed: the custody raw-code case, three cause sentences, the export failure sentence,
the Live seal dialog's "never says simulated".

## 7. Re-drive list for the confirmation judge

1. Lane 2, Evidence at 1280 / 1440 / 1920: Status and the row menu on every row; search "Wijayakusuma".
2. Lane 2, `EV-20261009-0005` > Hash & Integrity: no raw code in the custody table. Sessions page: the cause in words.
3. Lane 1 at 1440 and lane 2 at 1280, recording Monitor: "AUDIO MONITOR" on one line; "SHA-256" whole.
4. Lane 2 Dashboard at 1280 and 1440: the camera tiles read whole (two by two at 1280 - judge the look).
5. Lane 1: end a web session - the dialog says DEMO · SIMULATED twice and its sentence; no "LIVE".
6. Lane 2 New Session: "Configured profile" with the selector's lines; lane 1 unchanged.
7. Lane 2 Security & Audit at 1280: the audit table fits, no sideways cue; a long reference line ends in an ellipsis.
8. Lane 2 System: three quick actions. Bell: two links apart.

## 8. Decisions for the controller

1. **A cause keeps its code beside its words** ("Cause: ... (code X)") on the unsealable notices and the Sessions page:
   the administrator searches the Core's log for it. Custody actions and export failures show words only (code as
   title / attribute).
2. The sealing pipeline's failure codes (`NOTHING_SEALABLE`, `SIGNING_KEY_UNAVAILABLE`, ...) have no shared vocabulary:
   they read in the readable form ("Nothing sealable"). Words for them belong to the shared / server driver.
3. **The audit table now fits at 1280 and round three's sideways cue no longer appears there** (the cue code stays for
   narrower windows).
4. **Dashboard device tiles are two by two below a 640 px card** (1280 x 800); the row grows and the page scrolls.
5. The Evidence table cuts free text after three lines (ellipsis + title); "Demonstration record" also marks the
   seeded demonstration items of lane 2.
6. "Acknowledge all" acknowledged nine open alerts of lane 2, eight of them cleared microphone rate notes, some from
   Q-M's sessions of the quiet window (in the slots file).
7. Not fixed, for a ruling: CW-06 (router), CW-07 (wording), CW-08 a / c / d / e.
8. The whole suite ran with the host load above 6 (another driver was working).

## 9. State left (read back 14:31)

No session open by me (lane 2 `SES-20261012-0112` SEALED, `-0111` in quarantine with its notice acknowledged;
lane 1 `SES-20261012-0031` SEALED); seal rig OFF, source rig OFF; selector never changed (read at 14:18: `CAM-01`,
`CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY); no active and no unacknowledged alert on lane 2; lane 1 only
`ALR-000007` (found, not mine); both browsers stopped (no process), both consoles signed out, both helper sessions
answer 401, my two jars, the sign-in file and both browser profiles removed. Added data: lane 2 `EV-20261012-0082`,
two case numbers, one quarantine folder (`SES-20261012-0111`); lane 1 `EV-20261012-0020`, one case number.

---
*Generated: 2026-10-12 14:33 WIB*
