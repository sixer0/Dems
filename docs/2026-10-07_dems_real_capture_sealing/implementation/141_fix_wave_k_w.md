---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave K, driver W (apps/core-web) - web findings of re-gates 75, 81, 89, 94
date: 2026-10-11
agent: coder-execution
narrative_tier: 2
tree: commit 57b80a9 + the working tree of wave K (no commit, no git write)
contract: delegation_progress/contract_wave_k.md (S2 sections 1-4, S1 sections 3, 5, 6, 7, KR section 1)
decisions: D220, D221, D222 (1), (2), D223
status: needs-review
---

# 141 - Fix wave K, driver W (core-web)

Area: `apps/core-web` only. `packages/shared`, `apps/core-server`, `apps/mobile` untouched. No lane
was called, no dev server and no browser were started: the proof is component and unit tests.
Paths are relative to `apps/core-web/src/` unless they start with another root.

Status is **needs-review**, not complete, for three stated reasons: (1) the tamper stop of the web
player rests on what a real browser does with a cut media stream, which only the re-check on lane 2
can show (section 2.1, "not proven"); (2) the sweep changed every sentence the gates named and the
same class of claim, and LISTS the rest of the appliance model as not changed (section 3, decision
D-1); (3) the camera rows that depend on Live mode are proven as rules only (D-4).

## 1. Findings

| Finding | Reproduced (red)? | Fix | Test | Status |
|---|---|---|---|---|
| G94b-02 MAJOR - web tamper demonstration says nothing | yes: before the change the panel had no integrity element at all and no reader of the route's refusal (the test ids and `probeMediaSession` did not exist); controls in the same file | 2.1 | `features/evidence/__tests__/wave-k-w-player.test.tsx` (19) | fixed in code; browser behaviour NOT proven (re-drive 1) |
| C-2 / G75c-04 MAJOR - simulator constants on a real-capture Core | yes: `test/pass-j.test.tsx` (model pin) and the page text read the DEMO key / TPM residence / RTC holdover before; every page has a control that pins the simulated lane | 2.2, sweep in 3 | `test/wave-k-w-real-core.test.tsx` (26) | named sentences fixed; rest listed (D-1) |
| G89b-05 - seal dialog of a REAL item says "No DEMO package exists" | yes (rule absent) | 2.3 | same file, "G89b-05" (2) | fixed |
| G89b-06 - "decrypted bytes FAIL" beside V-05 "Not run" | yes: `test/live-row87-verify-v2.test.tsx:147` pinned the wrong sentence and went red | 2.4 | `features/evidence/__tests__/wave-k-w-evidence.test.tsx` "G89b-06" (4) + the moved pin | fixed, by `files[].plainChecked` (KR 1), fallback V-05 |
| G94b-07 - no development mark on player tiles / band legend | yes (cases absent) | 2.5 | player file "G94b-07" (3) | fixed |
| G94b-08 - "no interval" at 0:00 | yes | 2.5 | player file "G94b-08" (3) | fixed |
| G94b-09 - interrupted recording ends without a word | yes | 2.5 | player file "G94b-09" (2) | fixed |
| G81b-06 - transcript model on no client | yes (reader absent) | 2.6 | evidence file "G81b-06" (4) | fixed, by `evidence.transcriptModel` (S2 1) |
| G81b-05 - pending sentence with no session open | the web already reads the member by name; the server fixes the fact | 2.6 | `test/live-system-stt-config.test.tsx` "G81b-05" (2) | pinned by name |
| G81b-09 - revision reason not in the list | yes | 2.6 | evidence file "G81b-09" (2) | fixed with a limit (D-3) |
| G75c-05 - seal ETA of 1680 s | yes: the pin "estimating" of `sealing-progress.test.tsx` moved | 2.7 | `features/session-monitor/__tests__/sealing-progress.test.tsx` (moved case + control) | fixed (S1 5) |
| G75c-06 web half - timeline words every capture fault "interrupted", twice | yes (rule absent) | 2.7 | real-core file "G75c-06" (2) | fixed |
| G75c-10 - "Sealed —" at 0 % | yes | 2.7 | real-core file "G75c-10" (1) | the web-drawn sentence fixed; the 120 ms banner is the Core's state (2.7) |
| G89b-11 - Monitor integrity card rows overlap | cause found in the markup (2.8); not reproducible in jsdom (no layout) | 2.8 | real-core file "G89b-11" (static, 1) | fixed in code; NOT seen in a browser (re-drive 9) |
| ruling D222 (2) client rule - configured profile shown as a fact of the recording | yes | 2.9 | real-core file "ruling D222 (2)" (2) | Monitor details fixed |

## 2. Per finding

### 2.1 G94b-02 - the sealed player and a fragment that does not authenticate

Cause. `features/evidence/sealed-player.tsx` (before) learned of a failed file only from the media
element's `error` event. The Core stops a stream BEFORE a failed fragment and destroys the
connection (`apps/core-server/src/media-stream/service.ts:47-51`); a range that STARTS in the
fragment answers `409 MEDIA_NOT_AVAILABLE` with `details { reason: FRAGMENT_NOT_AUTHENTIC, fileId,
seq }` (`service.ts:178-188`). In the browser the element of that file reported nothing at all
(gate: `readyState 0`, `networkState 2`, no `error`), and a media element cannot read the body of
a `409` in any case. The tablet's player gets an error from its native player and says the generic
stop sentence; it does not name the file either (G94b-10).

Change.
- `features/evidence/media-session.ts:265` NEW `probeMediaSession(session, { startByte })`: the one
  other reader of the bearer path. A same-origin `fetch` with `Range: bytes=<start>-`, never cached;
  where the answer is cut (the read rejects, or the body ends short of `content-length`) it asks
  again from the byte of the cut; `409 ... FRAGMENT_NOT_AUTHENTIC` returns `{ kind: NOT_AUTHENTIC,
  fileId, seq }` - the Core's codes only. Other outcomes: `REFUSED` (status + reason), `SERVED`,
  `UNKNOWN`. At most 4 requests, 16 MiB, 10 s. Never throws.
- `features/evidence/sealed-playback.ts:100` NEW `probeStartByte`: 0 for a file that never played;
  else the playhead's share of the file moved back three fragments.
- `sealed-player.tsx`: `:306` `watch` - a file that gives no sign of life (no `loadedmetadata` /
  `canplay` / `playing` / `timeupdate`) or waits (`waiting`, `stalled`) for `STALL_CHECK_MS` (4 s,
  `:54`) is asked about, once per file and session; `:278` `askCore` - `NOT_AUTHENTIC` stops THAT
  file (pause, path taken off the element, kept off through every renewal), records
  `Evidence.playback.integrityStop` with the codes, and the other file plays on and leads (it
  carries the same audio track, R-4); `:476` `onMediaError` - on a live session the Core is asked
  BEFORE anything is renewed, so a refusal is told from a session that ended (the G94-07 / G94-08
  rules are unchanged: a session at its end is not asked about).
- What the operator sees (`:662`): an alert, `role="alert"`, with the shared integrity sentence
  `evidence.playback.integrity` - "This recording failed its integrity check at VIDEO-02 fragment
  3." - where file and fragment are the ones THE CORE named; "The Core server refused the fragment:
  it does not match the sealed package, and none of its bytes was sent. Camera 2 is stopped. Camera
  1 plays on. Run Verify for the full result."; the tile of the file reads "Stopped: this file
  failed its integrity check at fragment 3." With every file refused: "Playback is stopped.", Play
  disabled. A file the Core SERVES and that still shows no life reads "This file has not loaded." -
  never an integrity sentence.

Test (two cases asked for, and controls): "refusal at open" (VIDEO-02 never becomes ready, the
gate's state), "refusal mid-play" (`waiting` at the altered fragment), "media error", "leading
file", "control", five cases of the probe. `Test Files 1 passed (1) / Tests 19 passed (19)`.

The refusal body is typed in the test (`ROUTE_REFUSAL`) from `service.ts` `mediaUnavailable`: the
route is registry-external and the contract exports no example of it. The test holds the reason to
the registry text of operation 88. Request line 18:20:00Z asks for the exported example.

NOT PROVEN (jsdom has no media stack): that a real browser's `fetch` delivers the bytes before the
cut and then rejects (the probe also handles a body that ends short without an error); that Chrome
fires `waiting` / `stalled` or stays silent at the cut (both lead to the question: the watch is also
started when a path is put on the element and at Play). Re-drive 1.

Existing tests changed by delta: `features/evidence/__tests__/media-session-canary.test.tsx` and
`wave-h-c2-export-playback.test.tsx` call the new helper `serveMediaRoute()` of
`live-evidence-bed.ts` after the page opens - the player now makes a request to the media route,
which the fake Core of the bed refuses as an unknown route. No assertion of either file moved; the
canary's leak list still holds (the probe's request is not in the fake's log, its outcome and its
record hold no path: asserted in the new file).

### 2.2 C-2 / G75c-04 - a Core in its own capture and the device model

Cause. On a real-capture Core the slices `security.keys / controls / tamper / encryption`,
`time`, `storage.writeBytesPerSec`, `device.identity`, `cameras[]` hold the dataset's values
(`packages/shared/src/sim/initial-state.ts`), and `features/security-audit/sim-adapter.ts`
`keyEntries` builds the key list from `DEMO_EVIDENCE_INDEX` whatever the Core is. Pass J worded
the TPM, Secure Boot and posture only.

Change - the rule. `lib/own-capture.ts:75` NEW `isSelfCaptureCore` (`security.platformNotReported`
OR `time.hostClock`, both read by name) and `:100` `reportedSigningKeyOf`: the signing key THE CORE
REPORTS is the `signature.keyId` of its newest sealed item whose signature is not the simulated
stand-in (`signature.simulated === false`; `developmentKey` with it) - what its packages are signed
with. No such item: "No sealed item of this Core names a signing key yet." Each surface keeps its
own member: TPM / Secure Boot / posture / controls / keys from `platformNotReported`, the time from
`hostClock`, throughput from either. A value that shows a FAULT keeps it everywhere (an open
enclosure, a failed TPM, a broken chain are facts of the state). The simulated lane reads neither
member and is unchanged; every page has a control case.

Per page: section 3. Test: `Test Files 1 passed (1) / Tests 26 passed (26)`; pin moved by delta in
`test/pass-j.test.tsx:219` (the list of controls that read "Not reported").

### 2.3 G89b-05 - the "Evidence sealed" dialog of a REAL item

Cause: `features/session-monitor/finalization-modal.tsx` `PackageBlock` knew two cases - a bundled
DEMO package, or "missing" with `session.finalization.noPackage`.
Change: NEW `features/session-monitor/real-seal-facts.ts` `realSealFactsOf` (`integritySource:
REAL` and `signature.simulated === false`); `finalization-modal.tsx:314` draws for such an item the
manifest digest, "Ed25519, Core key CORE-KEY-EVSIGN-01" (`evidence.itemFacts.signature.realShort`),
"Signed with a DEVELOPMENT key — not a production signature" when `developmentKey === true`,
"Recorded from development sources - not from production devices." when `developmentSources ===
true`. No DEMO word, no "LIVE" chip. A simulated or demonstration item keeps its block.

### 2.4 G89b-06 - the decrypted-bytes part of a file row

Cause: `features/evidence/verify-v2-report.tsx` `ResultRow` drew `plainOk: false` as FAIL.
Change: `features/evidence/verify-v2.ts:471` `v2FilePartOutcome` - `NOT_RUN` when the file row
says `plainChecked === false` (KR section 1, per FILE), else when the member is absent and check
`V-05` of the same result is `SKIPPED` (S1 section 7, an older Core); stored bytes and chain are
always the answer's flags. The row reads "Stored bytes FAIL · decrypted bytes Not run · fragment
chain FAIL". Test imports `VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE`.

### 2.5 G94b-07, -08, -09 - the player

- -07: `sealed-player.tsx:599` the item's own mark (`developmentSources === true`, Live data) on
  each camera tile while no verify run of the page states a class per file; `audio-source-band.tsx:69`
  the legend from the item's `audioSourceIntervals[].sourceClass` (manifest field 125, read in
  `item-v2.ts`), the plain mark when the item states none per interval; a microphone stated
  PRODUCTION carries none. A verify result still wins. Limit: the item states no class per CAMERA
  file, so the tile mark is the item's ("Development source", no kind word) until Verify runs.
- -08: `sealed-playback.ts:89` a playhead before the first interval that reads the same SECOND as
  its start is inside it (0 ms beside a start at 21 ms). A gap between intervals, and a first
  interval that starts in a later second, stay "no interval". The contract file states no
  tolerance; this is the display's own resolution (decision D-5).
- -09: `sealed-player.tsx:682` at the end of the leading file of an item whose
  `interruptedFactOf(item).interrupted === true`: "End of the sealed recording at 0:29: the
  recording was interrupted, so it ends here."

### 2.6 G81b-06, -05, -09 - transcript

- -06: `item-v2.ts` `readTranscriptModel` reads `transcriptModel` by name;
  `transcript-pane.tsx:276` `TranscriptModelFacts` - local backend: Model, "Version (declared by
  the installation)", Quantisation, "Model file SHA-256"; server backend: the name and the Core's
  `report` sentence (D160), no version / quantisation / hash row. An item without the member draws
  nothing.
- -05: `features/system/stt-config-section.tsx:301` already draws the sentence from
  `config.pendingForNextSession`; two cases pin it by name (true / false).
- -09: operation 86 answers no reason (`TranscriptRevisionSchema` is strict and has no such
  member). `transcript-model.ts:136` `revisionReasons`: the revision's own `reason` when an answer
  carries one, else `details.reason` of the Core's `TRANSCRIPT_REVISED` row of the same item and
  revision id from the console's audit slice; else "Reason: not reported". Request 18:20:10Z.

### 2.7 G75c-05, -06, -10 - the seal dialog and the timeline

- -05: `finalization-modal.tsx:221` the time-left line exists only for `etaMs > 0`; `null` draws no
  line (it drew "Estimating the time left…"). No number is made here.
- -06: S1 now writes `params.reason` on the row and one row per interruption. Web half, also for a
  Core that runs the older code: `session-monitor/sim-adapter.ts:147` `captureFaultReasonOf` - a
  row without a reason takes the reason of the CAPTURE_FAULT alert raised within 2 s of it; `:166`
  `timelineWithoutRepeatedFaults` - the same fault at the same instant is one row.
- -10: `session-monitor/interrupted-seal.tsx` - while the seal runs the line reads "The recording
  was interrupted. <cause> The Core is sealing the recording up to the interruption."; "Sealed —
  recording was interrupted" comes with the SEALED state. The 120 ms "SESSION ACTIVE / Capture fault
  / Start recovery" banner is the Core's own passing session state (FAULT before FINALIZING), drawn
  as the state says: NOT changed - a client that hides a state for a time would be guessing.

### 2.8 G89b-11 - Monitor integrity card at 1440 x 900

Cause: `session-monitor/capture-checkpoints.tsx` drew its block with the class `sm-check`, the
three-column grid of a check row (`18px auto 1fr`); it has no icon, so the label "Durable
Fragments" fell into the 18 px column (`white-space: nowrap`) and was drawn over the lines beside it.
Change: own class `sm-checkpoints` (`session-monitor.css:572`, one column, never shrunk); where the
block is drawn the card body scrolls instead of clipping (`:has(.sm-checkpoints)`; the simulated
lane's card is untouched). Not seen in a browser.

### 2.9 Ruling D222 (2), client rule (S1 section 3)

`session-monitor/sim-adapter.ts:128` `streamProfileNoticeOf` reads the Core's notice
(`params.reason: STREAM_PROFILE_DIFFERS`, `target: <sessionId>`); the Monitor's details panel then
labels the row "Configured profile" and shows the Core's sentence. The reason is a constant of
`apps/core-server/src/engine/sealing-notice-doors.ts`, typed in the web file (no shared export).

## 3. The sweep - every sentence checked, page by page

Legend: **K** changed in this wave; **J / I / H** already worded by an earlier pass (checked, still
holds); **model** the appliance model of the dataset, NOT changed (decision D-1); **real** read
from the Core's own state. "Own Core" = `security.platformNotReported` and / or `time.hostClock`.

### Security & Audit

| Sentence (simulated lane) | Source member | On an own Core | |
|---|---|---|---|
| "SECURITY POSTURE SECURE", "All controls active. No issues detected." | `security.posture` | "Posture: not reported" | J |
| "{{ok}} of {{total}} controls active" | `buildControls` | "1 of 9 controls active, 8 not reported" | K |
| "TPM 2.0 attestation - Attestation OK" | `security.controls[TPM]`, `tpm.ok` | "Not reported" + "This Core does not read a TPM or the Secure Boot state." | J |
| "Secure Boot - Enabled and verified" | `security.secureBoot` | "Not reported" | J |
| "Key custody - TPM-wrapped, never exported" | `security.tpm.ok` | "Not reported" | J |
| "Evidence encryption - AES-256-GCM per session - Active" | `security.controls[ENCRYPTION]` | "Not reported": "This Core reports no encryption status here. Each sealed item states how it is encrypted." | K |
| "Manifest signature - Ed25519, DEMO device key - Active" | `security.state`, `DEMO_EVIDENCE_INDEX.key.algorithm` | "Ed25519, Core key CORE-KEY-EVSIGN-01 - the key the sealed items of this Core are signed with." + the development-key sentence; status "Not reported" | K |
| "Audit hash chain - SHA-256, every entry linked - Active" | `verifyChain(audit)` (this page's own check of the Core's rows) | unchanged | real |
| "Secure timestamp - {{source}} locked" / "RTC holdover, not locked - Check" | `time.source`, `time.locked` | "Host system clock. No time service is configured: nothing is locked and nothing is in holdover." | K |
| "Enclosure tamper switch - Closed - Active" | `security.tamper`, `controls[TAMPER]` | "Not reported": "This Core has no enclosure switch to read." (an OPEN switch stays) | K |
| "Signed firmware - v2.4.1 signature verified - Active" | `controls[SIGNED_FIRMWARE]`, `device.softwareVersion` | "Not reported": "This Core reports no firmware signature." | K |
| "9 of 9 active" (chip) | `buildControls` | "1 of 9 active · 8 not reported" | K |
| "Device certificate DEMO - CN=DEMS-IR-01 - SHA-256 fingerprint 76:0B:E9:29… - Serial …" | `DEMO_EVIDENCE_INDEX.certificate` | "Not reported": "This Core reports no device certificate." | K |
| "Evidence signing key DEMO - Ed25519 • DEMO-KEY-EVSIGN-01 - Public key …" | `DEMO_EVIDENCE_INDEX.key` | "Ed25519 • CORE-KEY-EVSIGN-01", "The key the sealed items of this Core are signed with (newest: EV-…)", chip "DEVELOPMENT KEY" when the Core says so; no item: "No sealed item of this Core names a signing key yet." | K (`evidence[].signature`) |
| "TLS server certificate SIMULATED - …" | `security.keys[TLS_SERVER]` | "Not reported": "This Core reports no TLS server certificate." | K |
| "Hardware root key - Hardware-bound - TPM 2.0 (fw 7.2.3.1) - Resident in TPM 2.0, never exported" | `device.identity.tpmModelFirmware` | "Not reported": "This Core reports no hardware root key. It does not read a TPM." | K |
| "{{n}} days left" expiry chips | DEMO certificate dates | not drawn | K |
| "DEMO certificate and key: not for production" | static | "As this Core reports them. It reports no device certificate, no TLS certificate and no hardware root key." | K |
| Tamper & Integrity "Enclosure - Closed" | `security.tamper` | "Not reported" (Open stays) | K |
| "Audit chain - Intact / Broken" | `verifyChain` | unchanged | real |
| "Evidence packages {{pass}} PASS • {{fail}} FAIL", "DEMO - precomputed" | `packageIntegrity` (DEMO packages that join the item list) | unchanged: labelled DEMO, about demonstration items only | model, labelled |
| Hash chain panel, audit log, authentication, custody, RBAC | `audit.rows`, `auth`, operation 10 | unchanged | real |

### Devices

| Sentence | Source member | On an own Core | |
|---|---|---|---|
| Banner "All devices ready 9/9" / "GNSS Receiver: NO FIX" | `selectBanner` | GNSS (host clock) and an unread TPM are not counted: "7/7"; a failed TPM stays | K |
| "TPM 2.0 / Secure Element - Attestation OK · sealing enabled - OK" | `security.tpm.ok` | "This Core does not read a TPM or the Secure Boot state." - "Not reported" | K |
| "GNSS Receiver - No fix · time from RTC - NO FIX" | `time.gnss`, `time.source` | "No GNSS receiver is configured. The time is the host system clock." - "Not configured" | K |
| GNSS drawer: Status, Time source RTC, Satellites, Stratum, Offset, Last sync, NTP server | `time.*` | Status "Not configured", Time source "Host system clock"; no other row | K |
| TPM drawer: Status OK, Model, "Attestation OK · sealing enabled", Secure Boot Enabled, Encryption | `security.*`, `DEVICE_IDENTITY.tpmModelFirmware` | Status / Model / Secure Boot "Not reported", attestation = the not-read sentence; no encryption row | K |
| LCD "{{time}} UTC+07:00 · RTC" | `time.source` | "… · HOST CLOCK" | K |
| LCD "TPM OK · SECURE BOOT ON" | `security.tpm.ok`, `secureBoot` | "TPM NOT REPORTED · SECURE BOOT NOT REPORTED" | K |
| LCD "EST. {{h}}h {{m}}m REMAINING" | `storage.estimatedRemainingMs` (free ÷ 8.2 GB/h) | "REMAINING TIME NOT REPORTED" | K |
| Cameras panel "Dual-lens forensic camera · two logical video tracks" | static | "The camera sources of the two video tracks" (real capture) | K (D-4) |
| Camera tile "Format 1080p • 25 fps • H.264", picture chip | `cameras[].resolution/fps/codec` | not drawn (real capture) | K (D-4) |
| Camera tile "PoE port PoE CAM 1" | constant | not drawn | I |
| Camera tile "Bitrate {{x}} Mbps" | `cameras[].bitrateMbps` | drawn only while recording (ruling of wave I) | I, value is the slice's |
| Camera drawer: Model "Dual-lens IP camera DL-2 (lens 1)", Firmware, Format, Bitrate, Port | `cameras[]` | "Not reported" each (real capture) | K (D-4) |
| Selector line "Online / Stream live" | `captureConfig` | "Reachable" / "Not checked", stream only while recording | I |
| Summary cards "Dual-lens DL-2 on PoE CAM 1", "Balanced XLR · 48 V phantom", "PoE · relay · tablet · GNSS · TPM", ports | `selectSummary` | unchanged | model |
| PoE switch row and drawer, relay / lamp, tablet link, port map and its tips, front-panel LEDs, LCD status / network / storage pages, device id / firmware / serial, front-panel drawer (temperature, fan), drawer Health tab ("Attestation (%)", "PoE draw (W)") | `network.poe`, `ports`, `tabletLink`, `health`, `DEVICE_IDENTITY` | unchanged | model |
| Audio cards: gain, phantom power, ADC, "read-only in this demo" | `mics[]` | unchanged | model |

### Dashboard

| Sentence | Source member | On an own Core | |
|---|---|---|---|
| Card header "All systems secure" | `securityColumns` | "Platform security: not reported" (when nothing warns) | K |
| Ring line "SECURE • HEALTHY • OPERATIONAL" | `selectSystemState` | "OPERATIONAL • NO FAULT REPORTED" | K |
| "TPM 2.0 Verified", "Secure Boot Enabled", "ACTIVE" | `security.tpm`, `secureBoot` | "NOT REPORTED", "TPM: not reported", "Secure Boot: not reported" | J |
| "GNSS / Time Sync - SYNCHRONIZED / RTC HOLDOVER" + tooltip stratum / offset / last sync | `time.*` | "Time - HOST CLOCK" + its tooltip | I |
| "Security Posture - SECURE - All controls active" | `security.posture` | "NOT REPORTED - Posture: not reported" | J |
| Strip "GNSS / Time - Synchronized" / "Security - Secure" | `time`, `security.posture` | "Time - Host system clock" / "Not reported" | I / J |
| Ring caption "All core services are running and the system is ready for recording." | `selectSystemState` | unchanged | model (services) |
| Network column: Connected, ip, LAN name, tooltip gateway / link / PoE ports | `network.*` | unchanged | model |
| Strip cameras / microphones, device tiles "READY" | `cameras`, `mics` | unchanged | model state of the two tracks |
| Storage ring "3.2 TB Free of 4.0 TB" | `storageSummary` | unchanged | real (the evidence volume is read, `core-facts.ts:27`) |

### Storage

| Sentence | Source member | On an own Core | |
|---|---|---|---|
| "Write Speed 2.3 MB/s - Recording · 8.2 GB/h" | `storage.writeBytesPerSec` | "Not reported" - "This Core does not measure a write speed." | K |
| "Est. Remaining {{h}}h {{m}}m - Computed from free space at 8.2 GB per hour - About N days of continuous recording" | `estimatedRemainingMs` | "Not reported" - "No estimate: this Core does not measure a write speed to compute one from." | K |
| Banner "{{free}} free · about {{remaining}} of recording left" | same | "{{free}} free" | K |
| "Session Size" | `session.bytesWritten` | the durable bytes of the checkpoints | J |
| Capacity ring, "{{percent}}% used", LOW / FULL thresholds, retention calculator, toasts | `selectStorage` of the evidence volume | unchanged | real |
| "Evidence HDD · {{total}}", volume "NVMe SSD · System", SMART / temperature / wear / power-on, "Write verified" | `storage.volumes`, `volumeHealth` | unchanged; Live footnote already says "derived by the console: the Core server does not report them" | model, labelled |
| "Usage over 24 h" | `storage.history` | unchanged | model |

### Network & Time

| Sentence | Source member | On an own Core | |
|---|---|---|---|
| A/V sync "Degraded", "CH1 ↔ CH2 Sample-synchronous", "Track start Common timeline", "Source metadata RTC UNLOCKED", "Derived for the demo; …" | `selectAvSync` (`time.source`, `time.locked`) | chip "Not measured" + "This Core reports no A/V sync figure here. Source metadata: host system clock. A capture that nears its A/V bound raises a capture notice." | K |
| Banner time half, system time chip / source / chain, hierarchy tiers, constellation "NO FIX", lock / stratum / last sync / offset / server, offset chart, time toasts | `time.*` | "Host system clock" surfaces of wave I / pass J | I / J |
| LAN row, PoE row and LEDs, bandwidth, tablet link, domains and VLANs | `network.*`, `ports`, `tabletLink` | unchanged | model |

### Session Monitor

| Sentence | Source member | On an own Core | |
|---|---|---|---|
| "Est. Remaining 56h" | `storageSummary.estimatedRemainingMs` | "Not reported" | K |
| "Write Speed", write-rate sparkline, "Session Size" | `storage.writeBytesPerSec`, `session.bytesWritten` | not drawn / durable bytes | H / I |
| Integrity rows "Encryption Active AES-256", "Secure Timestamp Synced RTC", "Storage Write Verified" | `security`, `time`, `storage` | "Capture", "Media Protection", "Time Source: Core system clock" beside a session of the Core's own capture | H |
| Inputs panel "1080p • 25 fps" | `cameras[]` | not drawn (real capture) | K (D-4) |
| Details "Profile Standard (1080p / 25 fps)" | `session.input.profileId` | "Configured profile" + the Core's sentence when the notice STREAM_PROFILE_DIFFERS is there | K |
| Timeline AUTOSAVE / HEALTH rows, "Recording Started" while connecting | generator | not drawn | H / I |
| Seal dialog "Evidence package DEMO", "No DEMO package exists for this item." | `matchDemoPackage` | the real block (2.3) | K |

### System

| Sentence | Source member | On an own Core | |
|---|---|---|---|
| About "TPM / SE firmware" | `device.identity.tpmModelFirmware` | "Not reported" | J |
| About "Device certificate" | `device.identity.deviceCertificateId` | "Not reported" | K |
| About "Camera firmware - Dual-lens IP camera DL-2 (fw 3.8.14)" | `device.identity.cameraModelFirmware` | "Not reported" | K |
| Settings "Time source: RTC" | `time.source` | "Time source: Host system clock" | K |
| Diagnostics "Security (TPM, Secure Boot) - PASS" | `diagnostics.run.checks[SECURITY]` | "Not reported" (FAIL / WARN stay) | K |
| About: serial, hardware UUID, chassis / board revisions, bootloader, software versions, provisioning record, SBOM, "Synthetic demo values" chip | `device.identity`, `releaseInfo` | unchanged; the chip says what they are | model, labelled |
| Banner "All core services running", services list and uptimes, health (CPU, temperatures, fan), update panel ("No newer signed bundle is available", slots, pipeline), the other seven diagnostics rows | `services`, `health`, `update`, `diagnostics` | unchanged | model |

### Shell, Session New, Login

| Sentence | Source member | On an own Core | |
|---|---|---|---|
| Checklist "Evidence encryption (AES-256-GCM): OK" | `security.state` | "Not reported" | K |
| Checklist "Enclosure tamper seal: OK" | `security.tamper` | "Not reported" (a fault stays) | K |
| Checklist "TPM 2.0 and Secure Boot: OK" / "Trusted time source: OK" | `security`, `time` | "Not reported" / "Host system clock" | J / I |
| Checklist "Audit hash chain", "Evidence storage", "Cameras and microphones" | chain, evidence volume, track state | unchanged | real |
| Pill "SECURE / All systems operational" | `selectSystemSeverity` | unchanged (a state of faults, not a platform reading) | model state |
| Top bar tooltip "Serial • Firmware • Build", sidebar "v{{version}}" | constants | unchanged | model |
| Session New pre-check "Time Sync" | `time.source` | "NOTE - Time source: host system clock (no GNSS)" | H |
| Session New pre-check "Security - READY" | `security.state`, `tamper` (the engine's gate) | unchanged: the gate's result "no security fault", not a TPM claim | model state |
| Login device strip (GNSS, Security) | `time`, system state | Simulated mode only; Live mode shows the Core's service facts | n/a |

Evidence pages were swept by wave H (item facts) and by sections 2.3 - 2.6 above; `api-reference`
and `stack-check` show no device value.

## 4. Commands and results (one run each; a second run only after a red)

| Check | Command (repo root) | Result |
|---|---|---|
| Player | `npx vitest run --root apps/core-web src/features/evidence/__tests__/wave-k-w-player.test.tsx` | 19 passed (two earlier runs red for a fault of the TEST's stream stub and of its `fetch` order, fixed in the test) |
| Evidence item | `npm test -w apps/core-web -- src/features/evidence/__tests__/wave-k-w-evidence.test.tsx` | 10 passed |
| Real-Core sweep + session surfaces | `npm test -w apps/core-web -- src/test/wave-k-w-real-core.test.tsx` | 26 passed (first run 3 red: two waits of the test, one dialog opening of the test) |
| Moved pins | `npm test -w apps/core-web -- src/test/pass-j.test.tsx src/test/live-row87-verify-v2.test.tsx src/features/session-monitor/__tests__/sealing-progress.test.tsx src/test/live-system-stt-config.test.tsx` | passed |
| Touched features | `npm test -w apps/core-web -- src/features src/components src/lib src/test` | see section 4a |
| Typecheck | `npm run typecheck -w apps/core-web` | 0 errors |
| Lint | `npm run lint -w apps/core-web` | exit 0, no warning |

### 4a. The run over the touched features

`npm test -w apps/core-web -- src/features src/components src/lib src/test`, run once after the last
code change (typecheck and lint clean before it): `Test Files 175 passed (175) / Tests 2094 passed
(2094)`.

An earlier run of the same folders, before the contract's S1 / KR sections were applied, had three
red cases, each a pin of the old wording and each moved by delta in this wave:
`test/pass-j.test.tsx:219` (the list of controls that read "Not reported": three -> seven),
`test/live-row87-verify-v2.test.tsx:147` ("decrypted bytes FAIL" -> "decrypted bytes Not run": the
finding G89b-06 itself, red on the live answer of the tamper demonstration),
`features/session-monitor/__tests__/sealing-progress.test.tsx` (the "estimating" line -> no line).
Before that, the first run over `features/evidence` had six red cases in
`media-session-canary.test.tsx` and `wave-h-c2-export-playback.test.tsx`: the fake Core of the Live
bed refused the player's new request to the media route (`UNKNOWN_ROUTE`); both files now serve the
route (`serveMediaRoute`), no assertion moved.

## 5. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm test -w apps/core-web` (whole workspace, once per commit) | none | 0 failed |
| `npm run typecheck -w apps/core-web && npm run lint -w apps/core-web` | none | clean |
| `npm test -w packages/shared` (holder of the examples imported here: `EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE`, `EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE`, `VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE`, `SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE`, `getEvidence.productSealed`) | none | 0 failed |

## 6. Re-drive list (browser on lane 2 after M1's restart, unless said)

1. **G94b-02**: `EV-20261009-0005`, Open playback, Play. Expected within about 4 s of the open:
   the alert "This recording failed its integrity check at VIDEO-02 fragment 3.", the VIDEO-02 tile
   "Stopped: this file failed its integrity check at fragment 3.", Camera 1 plays to the end, Play
   stays usable. Note the audit rows of the stop (one served + one WARNING from the question, beside
   the browser's own). Then a clean item: no integrity element, no "has not loaded" after 4 s.
2. G94b-02 control: a 60 s renewal on a clean item still works (the G94-07 / -08 checks of gate 94).
3. C-2: Security & Audit on lane 2 - no "DEMO", no "TPM 2.0 (fw", no "never exported", no "RTC
   holdover"; "Ed25519 • CORE-KEY-EVSIGN-01" with "DEVELOPMENT KEY"; "1 of 9 active · 8 not
   reported"; Enclosure "Not reported". Lane 1 unchanged ("DEMO-KEY-EVSIGN-01", "Resident in TPM
   2.0, never exported", "9 of 9 active").
4. G75c-04: Devices (TPM / GNSS rows and drawers, banner count, LCD lines, camera tile without
   Format, camera drawer "Not reported", panel subtitle); Dashboard header and ring line; Storage
   write speed / remaining / banner; Monitor "Est. Remaining"; Network & Time A/V strip; header
   checklist; System About / Settings / Diagnostics SECURITY row. Lane 1 unchanged on each.
5. G89b-05: end a session on lane 2 - the dialog shows the Core key, the development-key line, the
   development-sources line; no "No DEMO package exists for this item."
6. G89b-06: verify of the tamper demonstration - "decrypted bytes Not run".
7. G94b-07 / -08 / -09: `-0016` (marks on tiles and legend before Verify; "Audio at the playhead:
   MIC 1" at 0:00), `-0017` (the end sentence at 0:29).
8. G81b-06 / -09: `-0020` (Transcript model block; "Reason: …" under each revision - as a
   supervisor; as an investigator without the audit rows it may read "Reason: not reported").
9. G89b-11: Monitor at 1440 x 900 during a recording on lane 2 - the "Durable Fragments" lines do
   not overlap; the card scrolls if it is short.
10. G75c-05 / -06 / -10: a seal on lane 2 shows no time-left line during "Finalize transcript"; a
    worker kill - one timeline row "The capture worker process was killed.", the dialog reads "The
    recording was interrupted…" until SEALED; lane 1 demo fault - "The demo control raised a capture
    fault. The recording is not affected."
11. D222 (2): Monitor details of a lane 2 session after its seal read "Configured profile" with the
    Core's sentence.

## 7. Decisions for the controller

- **D-1 (scope of the sweep).** Changed: every sentence the gates named, and every sentence of the
  same class on any page - a key or certificate name, a TPM / attestation / Secure Boot / firmware
  signature / enclosure claim, a time-service claim, a throughput figure or an estimate computed
  from one, a camera model of the dataset. NOT changed, listed in section 3 as "model": the rest of
  the appliance model a development Core still carries - PoE switch and port map, relay lamp,
  tablet link, network interfaces / bandwidth / domains, services and uptimes, CPU / temperature /
  fan, the update slots, the System volume and SMART values, identity fields under the "Synthetic
  demo values" chip. They claim no security property and no measurement of the recording, and
  wording each as "Not reported" empties four pages; that is a product decision (hide the appliance
  pages on a Core in its own capture, or word them), not a wording fix.
- **D-2 (the signing key).** No member of the state names the Core's signing key; the web derives
  it from the newest sealed item. A Core that sealed nothing reads "No sealed item of this Core
  names a signing key yet." Request 18:20:20Z asks for a stated member (key id, class, certificate
  fingerprint, encryption).
- **D-3 (revision reason).** Shown from the audit row until operation 86 carries it (request
  18:20:10Z). A reader whose audit slice lacks the row sees "Reason: not reported".
- **D-4 (Live-only rows).** Camera tile Format, camera drawer, Cameras subtitle, Monitor inputs meta
  hang on `useRealCaptureCore()` (Live mode + a stated `sourceClass`), which the simulator-mounted
  page tests cannot switch on. Their rule is the existing one of wave I; the rendered rows are for
  re-drive 4.
- **D-5 (G94b-08).** `contract_wave_k.md` states no tolerance for the first interval. The web rule
  is "same second as the legend shows". If the contract fixes a number, one line changes.
- **D-6 (the probe writes audit rows).** Each question to the media route is recorded by the Core
  like the element's own requests (notice 18:20:30Z; M2's proposal of one WARNING per session, file
  and fragment would bound it).
- **D-7 (bearer path).** `media-session.ts` now names a third place the path goes: the request of
  `probeMediaSession`, same-origin, in the same module. Its outcome, its log record and the page hold
  no path (asserted). The canary test's leak assertions were not changed.

## 8. Open items

- The exported contract example of the media route's refusal (request 18:20:00Z).
- `steps[].detail` of the transcript step ("1 of 3 chunks", S1 section 5) is not drawn by the web
  stepper (it draws the percent); not asked for by a finding.
- Evidence item surfaces carry no "profile" label; the configured-profile rule was applied to the
  Monitor details only.
- Plan tracking table, `status_tasks.md`, `99_implementation_report.md`: not written (driver rules).

---
*Generated: 2026-10-11 WIB*
