---
task_id: 2026-10-12_input_av_core_adapter_plan
row: M1 (track D), revised by row M1b, amended by row M1c
revision: 3 (revision 2 amended to the security addendum `verification/08b_security_macos_microphone_addendum.md`; decision C110)
date: 2026-10-13
agent: data-analyst (designer)
type: design (Tier 1)
status: needs-review (revision 3 is the amendment the addendum's rank 2 asks for; the controller confirms it before rows N1 and N2 are cut. Six points could not be turned into buildable text as the addendum words them, section R3.3; five points stay for the user's own session, section 9.3)
decisions_read: revision 1: U15, U16, U21, U22, C92, P11, C56, C63, C89, U12 A1, U18; revision 2: U21, U22, U23, U24, U25, C92, C96, C97, C104, C106, C107; revision 3: U23, U24, U25, C104, C106, C107, C110
source_changed: none
devices_opened: none by rows M1, M1b and M1c (the measurements were made by rows MM, MM2, MM3)
last_updated: 2026-10-13 19:08 (host `date`, taken after the last edit of row M1c; its reading ended 18:54)
---

# Design: the production microphone path on macOS, under the kind `USB_AUDIO`

Abbreviations: `CS` = `apps/core-server/src`. "The Linux adapter" = `CS/capture/adapters/audio/usb-audio-production.ts`. "The table file" = `CS/capture/adapters/local/mic-helper-args.ts`. "Hypothesis" marks a statement that no file, decision or command output of this pass proves.

**Revision 2, after measurements MM, MM2, MM3 and decisions U23-U25, C96, C104, C106, C107.** Further abbreviations of this revision: `MM sN` = `test/mm_macos_microphone_measurement.md` section N; `MM2 sN` = `test/mm2_macos_microphone_48k.md` section N; `MM3 sN` = `test/mm3_macos_microphone_loss.md` section N; "the review" = `verification/08_security_macos_microphone.md`; `WK` = `apps/capture-worker/src`; `SH` = `packages/shared/src`; `CP` = `packages/capture-protocol/src`. Every number of this revision comes from one of the three measurement records and is cited by record and section. No device name, serial or location value of the user's hardware is in this document.

**Revision 3, amended to the security addendum 08b (decision C110).** Further abbreviations: "the addendum" = `verification/08b_security_macos_microphone_addendum.md`, cited as `08b sN`; `SM-nn` and `SR-15` are its requirement ids. Section R3 lists what changed. Where a sentence of revision 2 and a sentence of revision 3 disagree, revision 3 holds; the sentences of revision 2 that are replaced are listed in R3.2 and were edited in place where they stood in a section this revision amends.

## R3. What changed in revision 3

Subject: the six amendments the controller ordered for row M1c, each as text an implementer can build from. Why: the addendum's rank 2 (08b s2) and decision C110 - rows N1 and N2 are contract rows and "cut before this, they are cut twice". Who reads it next: the controller, the task-architect, the drivers of rows N1 to N18. How it was made: reading only (section 13, "Reading of revision 3"); no source file changed, no device opened, no command but reads, searches and `date`.

### R3.1 Where each amendment stands

| # | Amendment | Section | Serves |
|---|---|---|---|
| 1 | The contract words: the worker's report, the two audit types, the signed member with totals and positions, the source facts, the notices with the running-level margin, the operator's words for the standby | 8.1, 8.2, 8.3, 8.4, 6.2 | SM-29, SM-30, SM-32, SM-34, SM-36, SM-40 |
| 2 | The account is complete: each cited place of the worker, what it does today and what the kind `PCM_FIFO_GAPPED` does; the resampler is OUT of the path for this kind; which pins move | 7.2 | SM-29, SM-31, SM-33, SM-35 (1) |
| 3 | The seal's refusal, the verdict lines, the export's manifest | 8.4a | SM-36, SM-37 |
| 4 | The transcript | 8.6 | SM-38 |
| 5 | SR-15 in its final words as a static rule: two whole templates, the `fifo` groups, the forbidden words, the two provisional sentences | 4.3 | SR-15, SM-07, SM-08 |
| 6 | The work packages re-cut: 18 rows, their order, the worker baseline, the ONE contract step, the schema answer | 10.1, 10.2 | 08b s2, s14; decision C110 |

### R3.2 Statements of revision 2 that are replaced

| # | Revision 2 said (where) | Revision 3 | Source |
|---|---|---|---|
| 1 | `timelineSamples` counts "since this microphone's first sample" (8.2) | from SAMPLE 0 of the session's audio timeline, for every microphone of the plan | SM-29 (1); `WK/audio.c:436-449`, `:570-583` |
| 2 | three numbers "add up" (9.2); the record holds `receivedSamples`, `timelineSamples`, `insertedSamples` (8.2) | five numbers and an identity that holds to the sample: `timelineSamples` = `receivedSamples` - `discardedSamples` - `bufferedSamples` + `insertedSamples` (7.2, 8.2) | SM-29 (2), (3); `WK/audio.c:396`, `:431`, `:582` |
| 3 | "the resampler runs at compensation 0 for the whole session" (7.2) | a gapped microphone has NO resampler: its samples are copied (7.2) | SM-31 (2); `WK/audio.c:353-358`, `:366`, `:399`, `:477` |
| 4 | the silences "mark that samples are missing near that place" (7.2); "near the holes, not at them" (8.5) | struck. The fixed sentence of SM-30 (5) is the only wording (8.3) | 08b s4.1, "On near" |
| 5 | one audit type with six details; a member of six fields 139-144 (8.4) | two audit types (an audit detail list is flat and cannot hold a list of runs); a member of twenty fields 139-158 with totals, the closed mark, the capture group and the list of runs (8.4) | SM-29, SM-30, SM-34 (3); `CS/db/migrations/0001_tables.sql:198` |
| 6 | "PRESENT ON THIS MAC, ALWAYS" as an expectation (8.4) | a rule of the seal with a named refusal, anchored on the source-fact key (8.4a) | SM-36 |
| 7 | "The verdict lines ... do not SHOW the optional members yet" (8.5) | no longer true of the tree: three notices exist (`SH/evidence-verify/types.ts:417-421`); this path adds two (8.4a) | rows V6, R1b; pass I-9b in flight |
| 8 | two notices, one test (8.3) | five advisory reasons, three tests: the floor, the session's own level, a long run | SM-32, SM-34 (2) |
| 9 | W17: a helper that lives and delivers nothing is "stated, not stopped" (7.1, 11) | a group whose microphones all stop advancing for 5,000 ms is stopped (row N11 reads the worker's `receivedSamples`); one microphone alone is a fault of that microphone | 08b s3, SM-06 restated |
| 10 | the queue notices carry "a count" (4.6 row 5) | the amount is the growth of the worker's `insertedSamples` per microphone; a `full` line without `flushed` within 10,000 ms is a fault of the group | SM-35 (1), (4) |
| 11 | SR-15 as admissions by place (4.3) | SR-15 as two whole templates (4.3) | 08b s8 |
| 12 | 16 build rows, N1 and N2 in the first wave without a condition (10.1) | 18 rows; N1 does not land before the worker baseline; N2 follows the shared package's writer in flight (10.1) | 08b s14; decision C110; `delegation_progress/file_claims.md:244` |

### R3.3 What of the addendum could NOT be turned into buildable text as worded, and what stands in its place

| # | The addendum asks | Why not as worded | What this revision writes instead | Who confirms |
|---|---|---|---|---|
| 1 | SM-38 (3): the transcriber takes the fact "from the SIGNED member" | The machine transcript is hashed INTO the manifest (field 81, `apps/transcriber/src/pipeline/document.ts:28-29`): it exists before the signature. It cannot read what is signed after it | The sealed document takes the statement from the same audit rows, through the seal's own function, and the seal refuses a document that disagrees; everything SHOWN or exported later reads the signed member (8.6) | reviewer |
| 2 | SM-38 (2): "text is never joined across" a listed run | A segment is the engine's text "as committed, byte for byte" (`document.ts:25-26`); one engine segment that spans a run cannot be split without making text up | the segment is MARKED; no rendering joins two segments across a run (8.6) | reviewer |
| 3 | SM-30 (2): the runs "into the audit row's chain" as part of one row | audit details are flat: no list (`CS/db/migrations/0000_prelude.sql:7-19`, `0001_tables.sql:198`) | a second audit type, one row per listed run (8.4) | controller |
| 4 | SM-37 (1): ONE verdict line with eight statements | a report line is bounded at 256 characters (`SH/evidence-verify/types.ts:498`, `:532`); the statements at their largest numbers are about 280 | two notices, each one line; the host statement is already its own notice (8.4a) | controller |
| 5 | 08b s14: N1 in wave A' beside wave A | the protocol number is held equal between the package and the worker's header by a test (`CS/capture/__tests__/protocol-pins.test.ts:61`) and the boot refuses a worker of another number (`CS/capture/boot/checks.ts:401`): a package at 5 beside a worker at 4 breaks every run that starts a worker, and would stand in the tree during suite run c06 | N1 may be WRITTEN beside wave A; it LANDS in one change set with N3's edit of `WK/worker.h:48`, after c06 and its commit (10.1) | controller |
| 6 | SM-32 (2): a margin of 2.0 points | on the measured numbers 2.0 trips at about 11.5 to 11.9% for a session at 9.5 to 9.9%: next to the 12.0% floor it adds almost nothing | 1.5 points, from the measurements; N15 confirms or changes it (8.3) | controller; N15 |

Not written, on purpose: the side file with EVERY inserted run (SM-30 (6)) - the addendum puts it to the user and it is not a requirement; and the reviewer's own-reader option (section 14).

## R. What changed against revision 1

The structure of revision 1 is kept (sections 0 to 13). New in revision 2: this section, 1.4, 1.5, 4.2a, 4.6, 4.7, 6.1, 6.2, 7.2, 8.1 to 8.5 and 14 (there is no section 4.5). Where the eight points of the delegation are settled: (1) the helper row 4.2, 4.2a, 4.3; (2) one process, two microphones 6; (3) the shortfall 7.2, 8.2 to 8.4; (4) the helper's own statements 4.6; (5) unreliable opens 4.7; (6) the review's rank-1 points 2.3, 5, 8.1; (7) what was not measured 9.3; (8) the work packages 10.

### R.1 Statements of revision 1 that are now false, and what replaced them

| # | Revision 1 said (where) | Replaced by | Source |
|---|---|---|---|
| 1 | "What is NOT changed: ... the worker and its transport" (section 0) | The worker gains a second way to pace a microphone and reports what it received; the protocol gains one transport kind, three telemetry members and one record (sections 7.2, 8.2) | `WK/audio.c:436-449`, `:464-477`; decision C107 |
| 2 | "No contract member and no schema change is needed" (sections 0, 10.2) | Contract members ARE needed: protocol, one audit type, one optional manifest member, three notice reasons, two source-fact keys. Still no schema change (section 10.2) | decision U25 (3) |
| 3 | The USB tree is read as text; "a forged line can then only spoil its own block" (2.2, 2.3) | The property-list form; the sentence was wrong (section 2.3) | review SM-02; decision C96 (2); MM s1.1 |
| 4 | The index is taken at the open; the third listing compares the capture program's list only (3.3) | The index is taken from the listing of the START; the third listing is the full listing; the helper's own stream line is read (sections 3.3, 4.6) | review SM-04; MM s2 |
| 5 | One helper per registered input; push row with `<QUIET>` (log level `warning`), `<PROGRESS>` and the shared `<OUTPUT>` (4.2) | ONE helper per device with one output per open registered input, at log level `info`, each output behind a dropping queue; no progress report (section 4.2) | MM s5; MM2 s5; MM3 s8; decision C107 |
| 6 | "The listing must state 48,000 ... nothing between the device and the pipe may resample" with the listing as the only control (4.2) | The helper's own stated INPUT rate is the control; `-ar 48000` stays as a guard that changes no sample at a device rate of 48,000 (sections 4.2, 4.6) | review SM-16; decision C96 (4); MM2 s2 |
| 7 | Amendment "SR-14", formats not named (4.3) | SR-15, as tightened by the review and restated for the measured row; its closed format set gains the word `fifo` (section 4.3) | decision C96 (3); MM3 s9 item 6 |
| 8 | "Hypothesis: the system's audio layer serves several clients of one input device at once"; two helpers on one device (section 6) | Refused in 3 of 3 pairs. One process, two microphones (section 6) | MM s5; decision C104 (2) |
| 9 | "Same as Linux, by the same code paths"; a stall bound on the helper's progress report (section 7) | The start, the close and the loss of two microphones go through one helper; the stall is seen by the worker and the watch, not by a progress report (sections 6, 7) | MM3 s8.3 |
| 10 | F13 / W7 / Q7: the path is "built", and "fit to record" only after the delivered rate is measured right (sections 7, 11, 12) | The rate cannot be made right with the pinned tool. The path is built as it is; the shortfall is a measured fact of every session's evidence (section 8) | MM3 s0; decisions U25, C107 |
| 11 | `sampleBits` "NULL"; F14 "stored as null" (1.1, section 8) | The key is LEFT OUT (the builder drops it) | review section 11; `CS/capture/fence/sources.ts:219` |
| 12 | `captureLayer` "uncertain", stated on both platforms (section 8, 10.2) | Two keys, stated on `darwin` only, so that nothing a Linux session stores changes (section 8.1) | decision U25 (3), (5) |
| 13 | The pre-check silence statement "to accept or strike" (section 5) | Accepted by the review and made a gate (section 4.6) | review SM-14 |
| 14 | "That the pinned build reads `none:<n>` as an index is from source reading, not from a run" (4.1) | Measured: `none:0` opens entry 0 of the audio list. Limit: only index 0 could be opened (section 4.1) | MM s2 |
| 15 | "Empty is not none" for the system list only (2.3) | The USB tree row FAILS with an error in a confined process; both are named states (section 2.3) | MM s1.1 |
| 16 | Observation: the static test still expects `-channels` (1.1) | Withdrawn: the review found the pin holds `-ch_layout` | review section 11 |
| 17 | Questions Q1, Q2, Q3, Q4, Q7 open (section 12) | Answered by U23 (1)-(4), U24, U25 (section 12) | decisions U23, U24, U25 |
| 18 | Eleven points "not determinable without opening a device" (section 13) | Six are measured, five stay the user's (sections 9.3, 13) | MM, MM2, MM3 |
| 19 | Rows M2 to M10; "8 build rows" (section 10.1) | Re-cut: 16 build rows and one review addendum (section 10.1) | this revision |

### R.2 Requirements of the review that the measurements make impossible to meet as written

| Requirement | As written | What the measurements allow | Who confirms |
|---|---|---|---|
| SM-04 (2) | the helper's stream line is read "by ONE anchored pattern for two integers" (rate and channel count) | the line states the rate as an integer and the channels as a LAYOUT WORD (`5.1` for six channels, MM s2, MM2 s6). The count is read through a closed table of words (section 4.6) | review addendum |
| SM-19 (4) | "prove two helpers on ONE device ...; if the second is refused, the design's fallback (one helper, two pipes) is a new argument row and comes back to this review" | refused 3 of 3 (MM s5). The fallback is this revision's row; it comes back to the review (section 4.3) | review addendum |
| SM-16 (5), SM-20 (2) | the path is "built", not "fit to record", until the delivered rate is right on the user's interface | 89.4 to 91.8% of the samples in 31 captures, no arrangement better (MM3 s0). The gate can never pass with the pinned tool. Replaced by U25 (2), (3): built, marked, the shortfall stated per session | decision U25; review addendum |
| SR-15 (3) as adopted in C96 | formats `avfoundation`, `f32le`, `null` only | the only arrangement in which a stalled reader of one output costs the other 0 samples needs the output format `fifo` (MM3 s8.2). SR-15 gains that one word (section 4.3) | controller; review addendum |
| SM-06 (last sentence) | "a helper whose progress stops for 5,000 ms after its first sample is stopped" | the measured row has no progress report, and the helper's progress follows its timestamps, not what it delivered (MM3 s8.3). The stall is stated by the worker's existing no-sample fault and by the watch (section 7) | review addendum |

One more, of decision U25 (3) and not of the review: "the session's source facts ... state ... by how much it fell short". The source facts of a session are written once, at the start, and the runtime role may not update them (`CS/capture/fence/sources.ts:132-134`; `CS/db/migrations/0016_capture_streams_audio_inputs_privileges.sql:46`). They can state THAT the path is not sample-continuous; the measured amount is known at the end and is carried by the audit entry and the signed manifest (section 8). Put to the controller.

## 0. Frame (5W1H)

| | |
|---|---|
| Subject | How a production capture session gets its two microphones (PRIMARY, STANDBY) on this Mac, under the existing adapter kind `USB_AUDIO`, with the same refusals and the same evidence form as on Linux |
| Why | Decision U22: the macOS microphone path is built in this task. Finding C92: after the lift a `REAL_PRODUCTION` session still cannot start on macOS, because the start rule needs four slots and the card listing exists for Linux only (`CS/capture/fence/production-parts.ts:273, 286`) |
| Who | The user (owner of the Mac, of its devices and of every microphone permission); the controller (cuts rows); the security reviewer (reviews this design before any code, U22 (1)); the drivers of the build rows; the operator who later registers the inputs in the web console |
| What is NOT changed | The start rule (U22 (2)); the kind and its two operations (98 search, 99 register); the stored row and its CHECKs; the wire vocabulary of refusals; the evidence form fMP4 + AAC mono 48 kHz (U12 A1, U25 (4)); every rule of the Linux production path (U25 (5)); rule D163 for the built-in microphone and camera (U23, U24 (4)) |
| What IS changed since revision 1 | The worker and its protocol (sections 7.2, 8.2); the evidence gains statements (section 8). See section R |
| When | Revision 1; its security review (decision C96); the measurements MM, MM2, MM3; this revision; an addendum of the review on it; then the build rows (no code before the review, U22 (1), C96) |
| Where | Section 10 lists the files and the contract members |
| How it was made | Revision 1: reading of the working tree and five read-only commands that open no device (section 1.2). Revision 2: the three measurement records, the review, the decisions named in the header, and a reading of the worker's audio thread, the helper table, the platform seam, the production door, the session's microphone start and the manifest schema (section 13). Row M1b ran no command on a device and changed no source file |

Limits of both passes: rows M1 and M1b opened no audio device and listed none through the capture program. What a device does is taken from the measurement records only. Device names, serial numbers and location values were not copied into any file.

## 1. Facts

### 1.1 From the code and the decisions

| # | Fact | Source |
|---|---|---|
| F1 | The production microphone is ONE INPUT of a USB sound card. The Linux adapter reads the stored row, lists the cards fresh, re-identifies the card by serial, else by port path, never by index, and builds the helper's arguments from integers only | Linux adapter `:11-39`, `:330-362`, `:699-707` |
| F2 | Two inputs of one card are two helpers on one shared capture; one input belongs to one microphone (`INPUT_TAKEN`), all microphones of a card use one rate | Linux adapter `:31-33`; `CS/capture/adapters/audio/card-listing.ts:687-705` |
| F3 | A handle starts once; a later worker is fed by close, open, start; the open lists again | Linux adapter `:47-48`, `:755-771`; `implementation/067_usb_audio_adapter.md:100-105` |
| F4 | Every string of a listing passes `cardListingText`; a `CaptureCard` is built only by `buildCaptureCard` / `passCardStrings` | `card-listing.ts:165-171`, `:202-216`, `:522-545` |
| F5 | The identity rule: serial equal wins on any port; without a stored serial the unit on the stored port; same model elsewhere is `CARD_CHANGED`; neither value stored is `CARD_UNIDENTIFIED`; two units with the stored serial and no deciding port are `CARD_AMBIGUOUS` | Linux adapter `:300-362`; decision C56 |
| F6 | The enumerator of the host is chosen by platform. Off `linux` it lists nothing and rejects with `NOT_AVAILABLE_ON_THIS_PLATFORM`; the listing program is never started | `production-parts.ts:273-289`, `:374-377` |
| F7 | The Linux listing program is the FIXED row `/usr/bin/arecord -l` through the production door, empty environment, no start message, bound 5,000 ms, output cap 64 KiB | `production-parts.ts:321-367`; table file `:342-348`; `CS/capture/adapters/production-door.ts:41`; decision C63 (b) |
| F8 | The audio helper program is the configuration key `DEMS_CAPTURE_AUDIO_HELPER`; the guard is `DEMS_CAPTURE_GUARD`; both pass the program path rule at open and at start | `CS/config.ts:73-75`; Linux adapter `:573-578`; `CS/capture/adapters/local/helper-program.ts:32-44` |
| F9 | AD-07 (2): "The helper's device argument is built by a table function from two integers. No descriptor string and no card id forms any part of an argument" | `verification/04_security_addendum.md:263` |
| F10 | Static rule G-R12 as amended by SR-4 admits, in a Linux list only, one channel selection after `-af` and one device argument of two integers after `-i`; SR-12 admits one address made from four integers in two commissioning rows | `CS/capture/__tests__/static.test.ts:1028-1053`, `:1075-1113`, `:1180-1269`; decision C90 |
| F11 | The development path already drives this Mac's microphone with the same program: input `-f avfoundation -i none:<name>`, the name a literal constant held to `isUsableDeviceName` and to "exactly one listed entry equals it and no other begins with it"; the device list row is `-hide_banner -nostdin -f avfoundation -list_devices true -i ''` | table file `:36`, `:58-60`, `:117-120`; `CS/capture/adapters/local/device-list.ts:47-74`; `CS/capture/adapters/local/camera-helper-args.ts:85` |
| F12 | The repository's recorded statement: listing the devices opens none and asks for no permission; the first open is where macOS asks; the texts for a denied permission are a hypothesis (H-18) until the user denies once | `device-list.ts:5-6`; `CS/capture/adapters/local/mic-helper.ts:26-33` |
| F13 | The development microphone path through this same input layer FAILED its only recorded run: it delivered about 8/9 of the declared sample rate; it is "not fit for recording". The cause is now established by measurement: the same fault as MF8 / MF9 below | `README.md:437`, `:568`, `:772` (D128); MM3 s3 |
| F14 | The session's microphone source facts are a closed key list of ten keys; a `sampleBits` outside 16/24/32 is LEFT OUT (not stored as null) | `CS/capture/fence/sources.ts:148`, `:219` |
| F15 | The loss watch polls a fresh listing every 5,000 ms and uses the adapter's match; an unreadable listing raises nothing | `CS/capture/adapters/audio/mic-loss.ts:149`; `implementation/068_mic_loss.md:28-34` |
| F16 | On `darwin` the host profile is not asked; the guard program is still checked on every platform | `CS/capture/boot/host-checks.ts:370`, `:388-404`; decision U21 (2); row P1 in flight (`delegation_progress/file_claims.md:220`) |
| F17 | The pinned program on Linux refused `-channels`; the Linux row now uses `-ch_layout <n>C` | decision C89; table file `:211-224` |

(The observation of revision 1 about a `-channels` pin in the static test is withdrawn: the review found the pin holds `-ch_layout`, its section 11.)

### 1.2 Measured on this Mac in the pass of revision 1 (no device opened; values redacted)

| # | Command | Result |
|---|---|---|
| M1 | `sw_vers`; `uname -m` | macOS 27.0.1 (26A434), arm64 |
| M2 | `/opt/homebrew/Cellar/ffmpeg/9.0.2/bin/ffmpeg -hide_banner -version` | `ffmpeg version 9.0.2` (the path is the one `README.md:577` names; `.data/helpers/ffmpeg` has the same size, 426,512 bytes) |
| M3 | same program, `-hide_banner -h demuxer=avfoundation` (prints help; opens nothing) | Options of the input: `list_devices`, `video_device_index`, `audio_device_index` ("select audio device by index for devices with same name (starts at 0)", -1 to INT_MAX), `pixel_format`, `framerate`, `video_size`, `capture_cursor`, `capture_mouse_clicks`, `capture_raw_data`, `drop_late_frames`. NO option for audio channels, sample rate, device id or serial |
| M4 | `strings -a .../lib/libavdevice.63.1.102.dylib`, filtered | Present: `AVFoundation audio devices:`, `[%d] %s`, `Invalid audio device index`, `Audio device not found`, `audio format is not supported`. Absent: any `uid:` or `serial:` text. So a list line of the pinned build is an index and a name and nothing else |
| M5 | `ioreg -p IOUSB -l -w 0` | 96,037 bytes, 203 lines, longest line 85,594 characters: over the door's 64 KiB cap and over the listing's 512-character line bound. Not usable as a row |
| M6 | `ioreg -r -c IOUSBHostDevice -l -d 2 -w 0` | 17,232 bytes, 429 lines, longest line 180 characters, 0.03 s, 4 device blocks. Each block is a line `+-o <name>@<hex>  <class IOUSBHostDevice, ...>` at column 0, its properties, and its direct children with theirs. Device keys seen: `idVendor`, `idProduct`, `locationID` (decimal integers), `USB Product Name` / `kUSBProductString`, `USB Serial Number` / `kUSBSerialNumberString` (strings, the serial keys absent on a device that states none), `bDeviceClass`. Child (interface) keys: `bInterfaceClass`, `bInterfaceSubClass`, `bInterfaceNumber`. The `@<hex>` of the header equals `locationID` in 4 of 4 blocks |
| M7 | same output, counted | ONE device has children with `bInterfaceClass` = 1 (audio): three of them, sub-classes 1, 2, 2. That device has NO serial key. Its product string passes the NAME rule of `card-listing.ts:145` and the name shape of `device-list.ts:48` |
| M8 | `system_profiler SPAudioDataType -json`, outside the command sandbox | 1,471 bytes. Per device: `_name`, `coreaudio_device_input` (integer, channel count), `coreaudio_device_output`, `coreaudio_device_srate` (integer), `coreaudio_device_transport` (a word such as `coreaudio_device_type_usb`, `coreaudio_device_type_builtin`), `coreaudio_device_manufacturer`, `coreaudio_input_source`, default-device marks. No serial, no vendor or product id, no location. Three items; two with input channels: one USB (6 inputs, 6 outputs, current rate 96,000) and the built-in one (1 input, 48,000) |
| M9 | same command INSIDE the command sandbox | `_items` is an EMPTY list, exit 0, 0.07 s. A confined process gets "no audio devices" without an error |
| M10 | M6 joined to M8, yes/no only | The product string of the one USB audio device EQUALS the `_name` of the one USB input item |
| M11 | `ls -l /usr/sbin/ioreg /usr/sbin/system_profiler`; `stat` of `/usr/sbin`, `/usr` | Both `root:wheel`, `-rwxr-xr-x`; both directories owned by root, not writable by group or others: they pass the program path rule (F8) |

### 1.3 Read from the capture program's public source (unverified against the pinned build where marked)

Fetched: `libavdevice/avfoundation.m` of the project's main branch, read through a summarising tool. Hypotheses unless M3 / M4 confirm them:

- The audio part of the input name is parsed as an integer when it is one, and then used as an index into the audio device array (`Invalid audio device index` when beyond it: confirmed present by M4). A name is matched as a PREFIX of the device's localized name (this is what `device-list.ts:9-13` already states).
- Sample rate, channel count and sample format come from the first captured buffer; there is no option for them (confirmed by M3).
- The summary also reported a device-id option and `uid:` / `serial:` in the list line. M3 and M4 show the pinned 9.0.2 build has NEITHER. They are not used in this design.

### 1.4 Measured on the user's USB interface by rows MM, MM2, MM3 (revision 2)

The pinned program is FFmpeg 9.0.2, byte-identical to the package manager's copy (MM s0). The interface has six input channels and states no serial (MM s1.1).

| # | Fact | Source |
|---|---|---|
| MF1 | The USB tree in property-list form (`/usr/sbin/ioreg -r -c IOUSBHostDevice -l -d 2 -a`): exit 0, 34,693 bytes for 4 devices, 0.02 to 0.03 s; integers arrive typed, strings as strings; the interface class of the children is present under `IORegistryEntryChildren`; two of the audio device's six children carry no interface key. Inside the command sandbox the same row FAILS: exit 1, 0 bytes | MM s1.1 |
| MF2 | The device's name is the same string in the USB tree, the system list and the helper's list; the order of the helper's audio entries was the same in 5 of 5 listings and in all 12 listings made before a capture; one listing of all three costs about 0.4 to 0.55 s | MM s1.4 |
| MF3 | The helper's list: an entry is `[<tag>] [<n>] <name>`; the video section comes first with its own indexes from 0; exit 251 by design; 556 bytes of diagnostics | MM s1.3 |
| MF4 | `none:0` opens entry 0 of the audio list (the stream it states has the interface's layout and rate; the open by exact name states the same line). Only index 0 could be opened: that another index opens another device was not shown | MM s2 |
| MF5 | The helper states the opened stream in ONE line, at log level `info` or above only: `Stream #0:0: Audio: pcm_f32le, 48000 Hz, 5.1, flt, ...`. At the product's present level (`warning`) it prints 0 bytes. The channels are a LAYOUT WORD (`5.1` for six channels, at both rates); the word is the program's default label for the count and can be renamed by an option (`-ch_layout 6.0` accepted). The line was identical in all 34 opens with default options | MM s2; MM2 s1, s6 |
| MF6 | With the device at 48,000 Hz, `-ar 48000` changes no sample: the same count to the sample, and a largest difference of 0 against the untouched channel, in nine captures. With the device at 96,000 Hz the program converted to 48,000 without one line | MM2 s2; MM s3 |
| MF7 | THE SHORTFALL. At 48,000 Hz, 31 captures at normal priority delivered 89.4 to 91.8% of the samples (42,966 to 43,943 per second of wall time). Three captures of 60 s in the product's form: 2,607,104, 2,594,816 and 2,601,472 of 2,880,000 samples (90.524%, 90.098%, 90.329%), in 533, 557 and 544 holes of 512 samples (10.67 ms) each: 5.7 to 5.9 s of audio missing per minute | MM3 s0, s8.1 |
| MF8 | THE CAUSE is the helper's reading of the device: it hands on one packet of 512 samples per read and reads about every 11.9 ms (median 11.68 to 12.06 ms) while the device produces one every 10.667 ms; the delivered rate equals 512 / read interval in every capture. Not the cause, each by measurement: the output, the timestamps, the load (correlation 0.135, n = 21), the channel layout. The mechanism inside the build is a hypothesis (its source was not read) | MM3 s1 |
| MF9 | No option changes the share: thread queue 512 / 4,096 / 16,384, real-time buffer, probing, timestamp options, `-drop_late_frames 0`, stream copy, a null sink: 89.39 to 91.04% | MM3 s4, s5 |
| MF10 | THE HELPER NEVER STATES THE LOSS: not in the stream line, the totals line, the exit status, nor at debug level. Its progress and totals follow its timestamps and read 60.00 s for a minute with 5.8 s missing. Only a count of the samples that arrive against wall time, or a per-packet timestamp list (`ashowinfo`, about 0.9 MB of text per minute), shows it | MM3 s8.3 |
| MF11 | TWO ARRANGEMENTS REACH "100.000%" FALSELY: `asetpts=N/SR/TB` fills 10 s with samples that took 11.037 s to arrive; `aresample=async=1` inserts 35,840 samples of silence. `-use_wallclock_as_timestamps 1` hides the gap pattern and cures nothing | MM3 s4, s5 |
| MF12 | A helper put into a background scheduling class delivers 11.0 to 27.0% and still prints nothing | MM3 s6 |
| MF13 | TWO HELPERS CANNOT SHARE THE DEVICE: refused in 3 of 3 pairs (`audio format is not supported`, exit 251) | MM s5 |
| MF14 | ONE HELPER WITH TWO OUTPUTS works: the same number of samples in both, sample for sample equal to the channels of the same open (largest difference 0) in 10 of 10 captures; 4.8% of one core (4.9% with the queues) | MM2 s5 |
| MF15 | In the PLAIN two-output form a reader of one output that stops for 3.0 s stops the OTHER output too: 2.772 s without data, about 113,000 samples lost on both, nothing printed, exit 0 | MM2 s5 |
| MF16 | With each output behind the helper's dropping queue (`-f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32`) the stalled reader cost the other output 0 samples in 3 of 3 runs (sample for sample against a reference), and the helper printed `[fifo @ 0x<ptr>] FIFO queue full` about 0.45 s after the reader stopped and `FIFO queue flushed` about 0.26 s after it resumed | MM3 s8.2 |
| MF17 | OPENS ARE NOT RELIABLE: refused 1 of 10 single opens (MM), 3 of 38 (MM2), 1 of 37 (MM3); always the same text, `audio format is not supported`, exit 251, after 0.31 to 0.40 s (0.86 s with the queues). In MM2 all three came within 0.7 s of a previous close (3 of 18) and none after 0.83 s or more (0 of 20); an immediate retry opened in 3 of 3. In MM3 one came 7.09 s after a close. The cause is not established | MM s2; MM2 s3; MM3 s6 |
| MF18 | A stopped helper ends by itself within 47 to 50 ms of the signal, with exit status 255 | MM s7 |
| MF19 | Time from the start to the first sample: 0.24 to 0.31 s at 48,000 Hz | MM2 s2 |
| MF20 | `pan=mono|c0=c<k>` hands on channel k sample for sample (largest difference 0, six selections from one open) | MM s4 |
| MF21 | The user's set-up, as numbers: channel 0 carries the room's source (clipping at its loud moments), channel 2 is faint and follows channel 0, channels 1 and 3 are a noise floor (not zero), channels 4 and 5 are exactly zero in every capture | MM2 s4, s7 |
| MF22 | Permission: no prompt was observable; the first open delivered samples after 0.48 s; no open was denied; the application at the top of the helper's parent chain is the one that hosts the agents | MM s6 |
| MF23 | Seen once and not again in 32 opens with levels: at the first open of row MM four channels stood at one identical level (-6.96 dBFS RMS, peak 0.00). Unexplained | MM s4; MM2 s4 |

### 1.5 Read in the worker, the Core and the contracts for revision 2

| # | Fact | Source |
|---|---|---|
| WF1 | The worker reads a microphone's pipe without blocking, through a resampler, into a buffer of two seconds, and counts the samples it read (`received`) | `WK/audio.c:87`, `:379-408` |
| WF2 | The audio timeline runs on the HOST's clock: one quantum of 480 samples every 10 ms, consumed 40 ms after it was captured, whatever the pipe delivered | `WK/audio.c:88`, `:599`; `WK/worker.h:85-86` |
| WF3 | A quantum takes what the buffer holds; where the buffer is empty the rest of the quantum is ZERO, and the zeros are counted (`missing`) | `WK/audio.c:436-449` |
| WF4 | A controller holds the buffer's level by asking the resampler to stretch or squeeze the audio by at most 5,000 parts per million; when it stays at the limit for 3 s the worker raises `MIC_RATE_AT_LIMIT` | `WK/audio.c:93-95`, `:464-480`; `WK/micwatch.h:28`; `WK/micwatch.c` (`micwatch_rate`) |
| WF5 | `received`, `missing` and `dropped` leave the worker ONLY as one log line when the audio thread ends. The telemetry carries a level, a clip flag and the controller's rate per microphone, nothing else | `WK/audio.c:500`, `:651-655`; `CP/index.ts:672-674` |
| WF6 | One AAC encoder is fed frames of 1,024 samples whose time is the sample counter; every packet goes byte for byte into every camera file; the interval records and the tap count in the same sample counter | `WK/audio.c:160-170`, `:250`, `:258-279`, `:292`, `:618`; `WK/ingest.c:459-475` |
| WF7 | The plan names a microphone by exactly three members, its input by exactly two, of the one kind `PCM_FIFO`; the protocol is version 4 and its objects are strict | `WK/capture_worker.c:173-176`; `WK/worker.h:48`; `CP/index.ts:148`, `:567` |
| WF8 | In the Core `MIC_RATE_AT_LIMIT` is ADVICE: one named alert on the device, no fault, no audit row. The advisory reasons are a closed list of the shared package | `CS/capture/forwarder.ts:331-339`, `:420-421`; `SH/sim/capture-notices.ts:81-97` |
| WF9 | The production door hands on standard OUTPUT as it arrives; standard ERROR is kept as a bounded head (64 KiB) and is available only when the program has ended | `CS/capture/adapters/production-door.ts:141`, `:150`, `:259-266` |
| WF10 | The source facts of a session are written once, in the INSERT at the start; the runtime role may not update them | `CS/capture/fence/sources.ts:132-134`; `CS/db/migrations/0016_capture_streams_audio_inputs_privileges.sql:46` |
| WF11 | The session opens every microphone, one after the other, before it starts the worker; it then starts every handle in the same turn; when a worker is replaced it closes every microphone handle and then opens every one again | `CS/capture-session/index.ts:2075-2086`, `:1666-1711`, `:1727-1733` |
| WF12 | The signed manifest has three optional members, each absent in every package that has nothing to state, with byte identity proven; the next free field number is 139 | `SH/evidence-package/manifest.ts:809-829`; `implementation/191c_signed_audio_gap.md` section 4; `implementation/p1_production_platforms.md` section 5 |
| WF13 | The Linux adapter's start: a second listing, the guard through the door, a settle time of 1,500 ms, a pre-check bound of 5,000 ms; a handle starts once | `CS/capture/adapters/audio/usb-audio-production.ts:380`, `:755-833` |

## 2. Point 1 - LISTING

### 2.1 Alternatives

| | Listing | For | Against |
|---|---|---|---|
| A | The capture program's own device list only (the development row, F11) | One program; it is the list the helper will index | No identity at all: index and name only (M4). Cannot meet F5 |
| B | `system_profiler SPUSBDataType` + the device list | System program, JSON | States no interface class, so "is an audio device" is a guess; its form on macOS 27 was not checked in this pass |
| C | `ioreg -p IOUSB -l` | One row | Measured too long (M5) |
| D | **Three fixed rows: the USB tree (`ioreg`, depth 2), the audio facts (`system_profiler SPAudioDataType -json`), the capture program's device list** | Identity from the USB tree (M6), channel count and rate from the system (M8), the index from the very program that will open the device (M4). Each row has no parameter. All measured short | Three programs per listing; the three are tied by the device NAME (section 3.3) |
| E | A small native program of our own (CoreAudio): lists by device UID, captures by UID | The listing's identity and the opened device are one object; two same-model devices can be told apart | A new native program, its build, its signing and its review; against the user's standing preference for ready-made parts; outside U22's words ("a card listing and a helper row") |

### 2.2 Recommendation: D

The three rows, each through the production door, empty environment, no start message, input ended at once, killed at its bound, on `darwin` only:

| Row | Program | Arguments (all literals, no parameter) | Bound | Read from |
|---|---|---|---|---|
| L1 | `/usr/sbin/ioreg` | `-r -c IOUSBHostDevice -l -d 2 -a` (the property-list form, as row MM ran it; revision 1's text form is forgeable, decision C96 (2)) | 5,000 ms | standard output |
| L2 | `/usr/sbin/system_profiler` | `SPAudioDataType -json` | 10,000 ms | standard output |
| L3 | the audio helper of the configuration (`DEMS_CAPTURE_AUDIO_HELPER`, vouched for by the path rule before the start) | the existing device-list row of `camera-helper-args.ts:85`, unchanged | 5,000 ms | diagnostics (the list call ends with an error status by design, `mic-helper.ts:156`) |

Anything but "started, ended by itself, wrote less than the cap" is the existing `AUDIO_CARD_LISTING_PROGRAM_FAILED` with its closed reasons (`production-parts.ts:297-306`); for L3 a non-zero exit is expected and only the text counts.

### 2.3 Output form and the strict readers

All three texts are bounded as today (`CARD_LISTING_LIMITS`: 65,536 characters, 512 per line, 2,048 lines; a last line without a line end states nothing, `card-listing.ts:247-255`).

L1, the property-list form (review SM-02; MF1). Revision 1 read the text form and said a forged line "can only spoil its own block"; the review showed that a product string can write a whole new header with a location the DEVICE chose, so the text form is not used.
- The whole text is checked for its size first, then read by a strict property-list reader: no document type, no entity, no external reference; the top is a list of at most 32 dictionaries.
- Of a device dictionary only these keys are read, each asserted by TYPE: `idVendor`, `idProduct`, `locationID` (integers, each within its range), `IORegistryEntryLocation` (a string of eight hex digits that must equal `locationID`: equal in the measured device, MM s1.1), `USB Serial Number`, `USB Product Name` (strings), `IORegistryEntryChildren` (a list). Of a child only `bInterfaceClass` and `bInterfaceSubClass` (integers); a child without them is passed over (MF1: two of six).
- A device is REFUSED (counted in `skipped`, never repaired) when a read key has another type, vendor or product is missing or out of range, the location is 0 or differs from `IORegistryEntryLocation`, or the product string fails the NAME rule. A location stated by two devices refuses both.
- A device is an AUDIO device when at least one direct child has `bInterfaceClass` = 1 and `bInterfaceSubClass` = 2 (an audio streaming interface; the measured device has two, MM s1.1). Whether it is an INPUT is not stated by L1; that comes from L2 and L3.
- Size: 34,693 bytes for 4 devices against the door's cap of 65,536 (MF1). A host with a hub of many devices can exceed it: the listing is then refused by the existing reason `OUTPUT_TOO_LONG` (`production-parts.ts:304-305`), never cut. The cap is not raised by this design.
- Two measurements disagree and the build row settles it before the row's words are pinned: the review's run of the property-list form showed 19,491 bytes and NO interface class at depth 2 (its section 12); row MM's run showed 34,693 bytes WITH the class (MM s1.1). If the class cannot be had reliably, "is an audio device" rests on L2's transport word and the name tie, and the class is not claimed (review SM-02 (2)).
- The reader of the property list is the build row's choice between a ready-made parser and a small strict one; a new dependency is one more shared resource (the lockfile) and is named in section 10.

L2: the whole text through the JSON reader, then by type: the top member is a list of one object with `_items`, a list of at most 32 objects; of each only `_name` (string), `coreaudio_device_input` (integer 1 to 64), `coreaudio_device_srate` (integer 8,000 to 192,000) and `coreaudio_device_transport` (compared to the one word `coreaudio_device_type_usb`) are read. An item without input channels is no input.

L3: the section line `AVFoundation audio devices:` exactly once, and entry lines `[<tag>] [<n>] <name>` AFTER it (the form of `device-list.ts:21-22`, measured in MM s1.3, with the INDEX kept, 0 to 31). The video section stands first with indexes of its own (MF3): no line before the audio section line is read as an audio entry. An index stated twice, or out of order, refuses the whole list. The program ends with a non-zero status by design (251, MF3): the rule is "ended by itself, not by a signal, and the audio section line is present once" (review SM-10 (2)).

Every string leaves through `cardListingText` (F4): the product name as NAME, the serial as USB_SERIAL, the location as USB_PORT.

EMPTY IS NOT "NONE", AND AN ERROR IS NOT "NONE" (M9; MF1): a confined process gets an EMPTY system list with exit 0, and an ERROR (exit 1, nothing written) from the USB tree row. Neither is answered as "no card": the first is the undecided state `NO_SYSTEM_INPUT` (section 3.3), the second the listing failure `ENDED_NONZERO`. A Core confined by a sandbox must not look like a Core with no microphones.

## 3. Point 2 - IDENTITY

### 3.1 The members of a listed card on macOS

| `CaptureCard` member | macOS value | Rule it passes |
|---|---|---|
| `usbId` | `vvvv:pppp`, written by the reader from the two INTEGERS `idVendor`, `idProduct` (lower-case hex, four digits each) | `CAPTURE_AUDIO_USB_ID_PATTERN` |
| `usbSerial` | `USB Serial Number` where the device states one, else null. M7: the device now connected states none | USB_SERIAL (`card-listing.ts:91`) |
| `usbPort` | `locationID` as eight lower-case hex digits, written by the reader from the INTEGER | USB_PORT (`card-listing.ts:84`) |
| `product` | `USB Product Name` | NAME |
| `cardId` | `usb_<location, eight hex digits>`: written by the reader from the integer; it is no text of the device | `CAPTURE_AUDIO_CARD_ID_PATTERN` (`packages/shared/src/api/capture-audio-cards.ts:56`) |
| `cardIndex` | the index of the device's entry in L3 of THIS listing; never stored | 0 to 31 |
| `deviceIndex` | 0 (macOS has no second number) | 0 to 31 |
| `channelCount` | `coreaudio_device_input` of L2 | 1 to 64 |
| `ratesHz` | the one current rate of L2 | - |
| `formats`, `sampleBits` | empty: not stated by any listing | - |
| `factsSource` | a new word of the closed list, `SYSTEM_PROFILE` (one line in `card-listing.ts:484`; the list is not a contract member - `packages/shared/src/api/capture-audio-cards.ts` holds no such member) | FACTS_SOURCE |

The location id is the port-path equivalent. Hypothesis (commonly documented, not proven here): it encodes the controller and the chain of hub ports, so the same socket gives the same value after a re-plug. Not proven: the same value after a reboot (hardware list, section 9.3).

### 3.2 The match is the existing function, unchanged

`identifyRegisteredCard` (Linux adapter `:330-362`) reads only text members and `deviceIndex`. With the members above it gives, with no edit:

| Case on macOS | Answer |
|---|---|
| Same unit, same socket | found |
| Unit with a serial moved to another socket | found, `renamed` (its `cardId` follows the socket): notice `AUDIO_CARD_RENAMED` |
| Unit without a serial moved to another socket | `AUDIO_CARD_CHANGED` / `PORT_DIFFERS` until registered again (decision C56) |
| A same-model unit on another socket, the registered one unplugged | `AUDIO_CARD_CHANGED` (`SERIAL_DIFFERS` or `PORT_DIFFERS`): never opened in its place |
| Another model on the registered socket | `AUDIO_CARD_CHANGED` / `USB_ID_DIFFERS` |
| A row with neither serial nor location | `AUDIO_CARD_UNIDENTIFIED` / `IDENTITY_NOT_STORED` |
| Two same-model units without serials exchanged on the SAME socket | not detectable - the stated limit of C56, the same on macOS |

### 3.3 From the identity to the device the capture program opens

The capture program names a device by index or by name prefix and by nothing else (M3, M4). The USB identity (L1) and the index (L3) are therefore tied by the NAME, and the tie is made, verified and refused as follows.

A USB audio device of L1 gets a `cardIndex`, and is listed as a card, only when ALL hold in ONE listing:

1. no other device block of L1 with an audio interface has the same product string;
2. exactly one input item of L2 has that string as its `_name`, its transport is USB, and no other input item of L2 (of any transport: built-in, virtual, aggregate, wireless) has that name;
3. exactly one audio entry of L3 has that string as its name.

Otherwise the device is UNDECIDED: it is not a card of the listing, it is counted in `skipped`, and the macOS listing states it apart (USB id, location, serial and a reason word of a closed set: `NAME_SHARED`, `NO_SYSTEM_INPUT`, `NO_CAPTURE_ENTRY`). The macOS adapter answers `AUDIO_CARD_AMBIGUOUS` for a registered input whose device is undecided, with the reason as the detail word - not `AUDIO_CARD_ABSENT`, so that the operator is told the right thing. The search screen shows what it shows today for a skipped entry (a count); a named "not registrable" line is a possible later addition and would be a contract member, so it is NOT proposed here.

When it is made and checked:

| Moment | What is done |
|---|---|
| `open` | one listing (L1, L2, L3); the stored row matched (3.2); the tie above. It only decides whether to go on: NO index is kept from it (review SM-04 (1)) |
| the launch of the device's helper (section 6), before the door | a second listing; the same identity, channel count and rate as at the open, else `AUDIO_CARD_MOVED` (the Linux adapter's rule, `:761-771`). THE INDEX IS TAKEN FROM THIS LISTING and from no other (SR-15 (1)) |
| after the helper has started | the helper's own stream line is read (section 4.6): 48,000 Hz and the layout word of the listing's channel count, else the helper is stopped and the launch fails |
| after the settle time | a third listing, the FULL one (L1, L2, L3): the same ordered audio list of L3, the same identity, the same tie, the same rate and count as the second; else the helper is stopped and the launch fails `AUDIO_CARD_MOVED`. Reason: on Linux the card index belongs to the kernel; on macOS it is the position in a list another process makes. Measured: the order was the same in 5 of 5 listings and in 12 of 12 before a capture (MF2) - an observation of one afternoon, not a promise; the third listing stays |

ONE-TO-ONE, NOT ONLY UNIQUE (review SM-03): the input items of L2 and the audio entries of L3 must be the same multiset of names, compared as exact text; else EVERY device of the listing is undecided (`LISTS_DISAGREE`). Measured on this Mac: 2 of 2, the same names (MM s1.3). A tied name that holds `://` or `@` is refused and not compared (`NAME_NOT_TIEABLE`): the door blanks the user part of anything that looks like a locator before a reader sees it. Cost: three listings of about 0.4 to 0.55 s each per launch (MF2).

What a same-model device on another port looks like to the user: both units are undecided (`NAME_SHARED`), and NEITHER can be opened while both are connected. This is stricter than Linux in what it refuses and poorer in what it allows: two same-model microphones cannot serve as PRIMARY and STANDBY on a Mac with this design. Alternative E removes the limit and is the follow-up if the user needs it.

Residual, stated: (a) a device that leaves and another that takes its index inside the settle time and then leaves again before the third listing is not seen; (b) a local audio driver that presents a device under the exact name of the USB unit makes that unit undecided (refused), it cannot be opened in its place because rule 2 counts every input item.

## 4. Point 3 - CAPTURE

### 4.1 Alternatives for the device selector

| | Selector | For | Against |
|---|---|---|---|
| S1 | **`none:<n>`: one integer, the index of the live L3** | No text reaches an argument: AD-07 (2) holds on macOS in its own words (F9); the same shape as `dems_<c>_<d>`. MEASURED: `none:0` opens entry 0 of the audio list (MF4) | The index is another process's list position: needs the third listing of 3.3. Only index 0 could be opened, so "another index opens another device" is not shown (MF4) |
| S2 | `none:<name>`: the name, held to `isUsableDeviceName` and the "no other entry begins with it" rule | Proven form of the development path (F11); the opening process resolves the name itself | DEVICE-CHOSEN TEXT becomes an argument: it weakens AD-07 (2), which holds on Linux. A name with any character outside the shape cannot be used at all |
| S3 | `-audio_device_index <n>` with `-i none:` | An integer, as S1 | M3's help text ("for devices with same name") suggests the option may mean something else in this build; unprovable without an open |

Decided: S1 (adopted with SR-15, decision C96 (3)). S3 (`-audio_device_index`) and S2 (a name) stay outside the table; S2 only by a ruling of the user that names AD-07 (2).

### 4.2 THE HELPER ROW (revision 2: one helper per device, as MM3 measured it)

One helper per DEVICE, not per microphone (MF13). Its row, word for word the form of MM3 s8 (decision C107), without the `-t` and the two measuring outputs that only the measurement had:

```
push
  -hide_banner -nostdin -nostats -loglevel info
  -thread_queue_size 1024 -f avfoundation -i none:<n>
  -map 0:a -af pan=mono|c0=c<k1> -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y <pipe 1>
  -map 0:a -af pan=mono|c0=c<k2> -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y <pipe 2>

pre-check (one registered input; nothing kept)
  -hide_banner -nostdin -nostats -loglevel info
  -f avfoundation -i none:<n>
  -t 1 -map 0:a -af pan=mono|c0=c<k> -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -
```

One output section per registered input of the device that is OPEN when the helper is launched: two in a session with PRIMARY and STANDBY on the interface (U23 (1)), one when only one of them could be opened. The sections stand in the ascending order of the registered input number; the adapter does not know a role, and a role is no argument.

THE ORIGIN OF EVERY WORD:

| Word or group | Origin | Rests on |
|---|---|---|
| `-hide_banner -nostdin -nostats` | fixed (the existing quiet literals, table file `:58`) | - |
| `-loglevel info` | fixed; a literal of the macOS rows only. At `warning` the helper prints 0 bytes and the stream line of section 4.6 does not exist | MF5 |
| `-thread_queue_size 1024` | fixed. It changes nothing for the shortfall (89.65 to 90.29% with 512 / 4,096 / 16,384); it is kept because it is in the measured form and in the Linux row (table file `:220`) | MF9; MM3 s8 |
| `-f avfoundation -i` | fixed | - |
| `none:<n>` | ONE of the closed set of 32 words `none:0` to `none:31` (canonical decimal, no sign, no leading zero), made by one table function from one whole number: the audio index of the device in the listing read for THIS launch, of a device whose tie held in that same listing | SR-15 (1); MF4 |
| `-map 0:a` | fixed: every output takes the one audio stream of the one input | MM2 s5 form A |
| `-af` | fixed | - |
| `pan=mono|c0=c<k>` | ONE of the 64 words of the existing `linuxChannelSelection` (table file `:247-250`; the same function, no twin: review SM-09), k = the registered input number minus 1, refused at or above the LIVE channel count before any argument is built (`AUDIO_INPUT_BEYOND_CARD`). It selects one channel and mixes nothing: largest difference 0 | SR-15 (2); MF20 |
| `-ac 1 -ar 48000 -c:a pcm_f32le` | fixed. `-ar 48000` is a NO-OP GUARD: section 4.6 refuses any device that does not state 48,000 Hz, and at that rate the option changes no sample. It is not the control and the table's comment says so | MF6; review SM-16 (4) |
| `-f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y` | fixed. The dropping queue in front of each output: without it a reader of one output that stops for 3 s stops the other for 2.772 s without a word; with it the other loses 0 samples (3 of 3) and the helper says `FIFO queue full` | MF15, MF16 |
| `<pipe>` | the pipe path of the transport, held to `isMicPipeArgument` (table file `:95-98`), as today | F1 |
| pre-check: `-t 1`, `-f f32le -flush_packets 1 -` | fixed. One second of the SELECTED input to standard output, read by the Core in memory, counted and dropped (review SM-14 (2); SR-15 (5)). NOT RUN in this exact form by the measurement rows (they wrote files and named pipes): the build row runs it once on a generated source before its words are pinned | section 4.6 |

Not arguments at all: a channel count and a rate of the INPUT (the input layer has no option for either, M3; `-channels` is refused as unknown and `-ch_layout` only renames, MM2 s6); a device name; a role; anything of the database, the configuration or a listing's text.

Not in the row, and why: `-progress pipe:1` (the Linux row's first-sample watch reads it). It is not part of the measured form, and what it reports follows the helper's timestamps: it reads 60.00 s for a minute with 5.8 s missing (MF10). On macOS the delivery of samples is known from the worker (section 8.2), not from the helper.

The environment is empty (no shared-capture configuration exists on macOS). The helper is started by the guard (`guardedArguments`), so the liveness rule of every production program holds (F16); nothing else stands between the door and the helper - no wrapper that sets a scheduling class or a priority (MF12: a background class lowers the delivery to 11 to 27% and nothing is printed).

Not measured, for the build row before the words are pinned: the two-output queued form over 60 s WITHOUT the two measuring outputs (measured over 9 s in MM2 s5, over 60 s with them in MM3 s8.1); a single queued output; a reader that is absent when the helper starts, or that closes its pipe (MM3 s10).

### 4.2a FORBIDDEN in every macOS production list (decision C107)

MM3 showed that the count can be made to read "100%" by inventing audio (MF11). So the macOS table holds NONE of the following, the static rule refuses each as a control case, and no later row adds one without a named amendment and the review:

| Forbidden | Why |
|---|---|
| `asetpts` in any form | renumbers the packets as if nothing were missing: 480,000 samples "of 10 s" that took 11.037 s to arrive; the cuts stay in the waveform (MM3 s5, capture 17) |
| `aresample` in any form, `-async`, `apad` | pads with silence the helper invents: 35,840 samples of exact zero in a 10 s capture, in bursts that are not where the holes are (MM3 s5, capture 19) |
| `-use_wallclock_as_timestamps`, `-fflags +genpts`, `-copyts`, `-itsoffset`, `-re` | re-time the input; the first hides the gap pattern and cures nothing (MM3 s4, capture 8) |
| `atempo`, `asetrate`, `adelay`, `aloop`, any filter but the ONE channel selection | stretch, shift or repeat audio |
| `-t`, `-ss`, `-shortest` in a push list | cut the recording by the helper's own (false) time |
| a second `-af`, `-filter_complex`, `channelsplit` | the selection is one closed word per output; the graph form also depends on the layout word (MM2 s5, form B) |
| `-ch_layout`, `-channels`, `-audio_device_index`, `default`, a device name | SR-15 (1), (3); a layout option would RENAME the word section 4.6 reads (MM2 s6) |
| a wrapper before the helper other than the guard (`nice`, `taskpolicy`, a shell) | MF12 |

The rule in one sentence: between the device and the pipe nothing pads, stretches or re-times; what is missing stays missing in the pipe, and the product says how much (section 8).

### 4.3 The named amendment

Revision 1 proposed the amendment as "SR-14". The review tightened it in six points (its section 5) and decision C96 (3) adopted the tightened words under the number SR-15 (14 was taken by another row). Revision 2 restated it for the measured row. The addendum confirmed the restatement and tightened it in five points; decision C110 adopted those FINAL WORDS as the gate of every build row. Revision 3 writes them out as the static rule the helper-table row (N4) is held to. The words in the quotation are the addendum's (08b s8), copied; nothing in them is this designer's.

#### 4.3.1 SR-15, final words (08b s8; decision C110)

> NAMED AMENDMENT SR-15 (final words for the row of revision 2). Rule G-R12 as amended by SR-4 and SR-12 gains the places below, all for the production microphone of kind `USB_AUDIO` on `darwin`, in a kind of list of its own (neither a development list nor a Linux list), and loses none.
> (1) THE DEVICE WORD is one of the CLOSED SET of 32 words `none:0` to `none:31`: the word `none:`, then the decimal form of one whole number 0 to 31 without sign and without a leading zero, made by ONE table function that takes that one number and nothing else. The number is the audio index of the device list read for THIS LAUNCH of the device's helper - at a retry, of the listing made for the retry - of a device whose tie held in that same listing. The video part is the literal `none` always. No name, product, USB id, serial, location, card id or any other text of a listing, of the database or of the configuration forms any part of it.
> (2) THE PUSH LIST IS A TEMPLATE AND IS COMPARED WHOLE. It is, word for word and in this order: `-hide_banner -nostdin -nostats -loglevel info -thread_queue_size 1024 -f avfoundation -i <device word>`, then ONE or TWO sections, each `-map 0:a -af <selection> -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y <pipe>`. Its only computed words are the device word, one SELECTION per section - one of the 64 words of SR-4 (2), made by the SAME table function from one whole number 0 to 63 below the live channel count - and one PIPE per section, held to the pipe argument rule. The sections stand in the ascending order of their selections; two sections never hold the same selection or the same pipe. A list that differs from the template in a word, in the order or in the count is a violation: there is no set of admitted words beside the template.
> (3) THE PRE-CHECK LIST IS A TEMPLATE TOO: `-hide_banner -nostdin -nostats -loglevel info -f avfoundation -i <device word> -t 1 -map 0:a -af <selection> -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -`. The word `-t` stands in this list and in no other. What it writes to standard output is read by the Core in memory, within a bound of bytes and of time, counted and stored nowhere.
> (4) The formats of the table are `avfoundation`, `fifo` and `f32le`. `fifo` stands only as the output format of a push section with its four fixed groups; of the options of that output format in the pinned program no other stands in the table, and `-drop_pkts_on_overflow` is never `0`.
> (5) NOTHING BETWEEN THE DEVICE AND THE PIPE PADS, STRETCHES, RE-TIMES, CUTS OR MIXES. The table holds no filter but the one selection per output, in no spelling of a filter option and from no file; no option of design section 4.2a; no log level but `info`; no progress report; no option that selects a device by another way; no `default`.
> (6) The listing of USB audio devices on `darwin` is THREE FIXED ROWS WITHOUT A PARAMETER: `/usr/sbin/ioreg -r -c IOUSBHostDevice -l -d 2 -a`; `/usr/sbin/system_profiler SPAudioDataType -json`; and the audio helper program of the configuration with the existing device-list row, unchanged. The first two programs are absolute literals named by the table file alone. Each row is handed to the production door unchanged by its ONE caller in the fence, with an empty environment and no start message, on `darwin` only, and is killed at its own bound (5,000 ms, 10,000 ms, 5,000 ms).
> (7) The helper of a push list and of a pre-check list is started by the guard through the production door, with an empty environment; no other program stands before it.
> Kept, unchanged: every other sentence of G-R12, SR-4 and SR-12; the two files that may name `-list_devices` and `avfoundation`; AD-07 (2) in its words on either platform.

#### 4.3.2 The two templates as the static rule compares them (row N4; SM-08 (1))

One word per position. `<D>`, `<S>`, `<P>` mark the THREE COMPUTED PLACES; every other word is a literal of the table file and is compared by equality.

THE PUSH TEMPLATE - a head of 11 words, then one or two sections of 22 words each (33 words with one section, 55 with two):

```
head      -hide_banner -nostdin -nostats -loglevel info -thread_queue_size 1024 -f avfoundation -i <D>
section   -map 0:a -af <S> -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y <P>
```

THE PRE-CHECK TEMPLATE - 26 words, the last one the single dash that names standard output:

```
-hide_banner -nostdin -nostats -loglevel info -f avfoundation -i <D> -t 1 -map 0:a -af <S> -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -
```

| Computed place | The word | Made by | Held to |
|---|---|---|---|
| `<D>`, the device word; once per list, directly after `-i` | one of the 32 words `none:0` to `none:31` | ONE table function of one whole number 0 to 31 | SR-15 (1): the audio index of the listing read for THIS launch (at a retry, of the retry's listing), of a device whose tie held in that listing |
| `<S>`, the selection; once per section, directly after `-af` | one of the 64 words of section 4.2's row, the channel number k from 0 to 63 (the word holds a vertical bar and is therefore not repeated inside this table: it is written in full in the block of section 4.2) | the existing `linuxChannelSelection` (table file `:247-250`), the same function, no twin | SR-15 (2): the registered input number minus 1, below the LIVE channel count; ascending over the sections; never twice in a list |
| `<P>`, the pipe; once per section, the last word of the section | the pipe path of the transport | the transport | `isMicPipeArgument` (table file `:95-98`); never twice in a list |

THE `fifo` GROUPS (SR-15 (4)): the output format of a push section is the word `fifo` followed by exactly four fixed groups, in this order and with these values, and by no other option of that output format:

| Group | Words | What it holds off |
|---|---|---|
| 1 | `-fifo_format f32le` | the format the queue hands on |
| 2 | `-drop_pkts_on_overflow 1` | NEVER `0`: the blocking form stops the other output for as long as one reader stalls, without a line (MF15; SM-35 (6)) |
| 3 | `-queue_size 32` | the measured size (MF16) |
| 4 | `-format_opts flush_packets=1` | every packet is handed on at once |

The row runs `-h muxer=fifo` of the pinned program (it prints help and opens nothing) and pins the WHOLE list of options that help text names; every option of it beside the four is a planted control (08b HB-3; SM-08 (2)).

THE FORBIDDEN WORDS. With a template there is no list of admitted words to complete: a list that holds any of the following already differs from the template. They stay in the rule as PLANTED CONTROLS, each planted in the place where it would act, and each must be SEEN to be refused - a control the rule passes is a failed rule (SM-08 (2)):

| Family | Words planted | Where planted |
|---|---|---|
| Invented or re-timed audio (section 4.2a; decision C107) | `asetpts`, `aresample`, `-async`, `apad`, `-use_wallclock_as_timestamps`, `-fflags +genpts`, `-copyts`, `-itsoffset`, `-re`, `atempo`, `asetrate`, `adelay`, `aloop` | an input option before `-i`; an output option inside a section; text after a comma or a semicolon INSIDE the selection word |
| Cuts | `-t`, `-ss`, `-shortest` in a push list | inside a section |
| Another filter | a second `-af` in a section; `-filter:a`, `-filter_complex`, `-lavfi`, `channelsplit`; a filter option whose value is read from a file (`-/af <file>`, `-filter_script:a <file>`; the spellings are from the reviewer's knowledge, 08b HB-4, and the row takes the pinned program's own list) | inside a section |
| Another device or layout | `-ch_layout`, `-channels`, `-audio_device_index`, `-video_device_index`, `default`, a device name in the place of `<D>`, `none:32`, `none:01`, `none:-1`, `0:none`, `none:1x` | at `<D>` and before `-i` |
| The queue | `-drop_pkts_on_overflow 0`; `-queue_size` with another number; every further option of the `fifo` output format in the pinned help text | inside a section |
| Shape | a third section; the same selection twice; the same pipe twice; sections in descending order; a second log level; `-loglevel warning`; `-progress` | the list |
| Before the helper | `nice`, `taskpolicy`, a shell | before the helper program, at the caller (SR-15 (7)) |
| The listing rows | a fourth argument of a listing row; a listing program handed in by a product file | SR-15 (6) |

AT THE ONE CALLER (the macOS adapter; SM-08 (3)): each table function is called once per launch, and once more for the ONE retry of section 4.7, with the index of the located device of that launch's listing, the stored input numbers, the pipes and the registry ids.

#### 4.3.3 The two provisional sentences, and the one run that settles them

| Provisional | Why | Settled by |
|---|---|---|
| SR-15 (3), the pre-check template | no measurement row ran the pre-check to standard output: the rows wrote files and named pipes (section 4.2, "not measured") | the run below, form (a) |
| SR-15 (2) with ONE section | the queued output was measured with two outputs and two measuring outputs beside them (MM3 s8.1), over 9 s with two (MM2 s5), never alone | the run below, form (b) |

THE ONE RUN (08b rank 4; row N4; the real pinned helper, NO device): a generated six-channel 48,000 Hz source stands in the place of `-f avfoundation -i <D>` (the way row 79b ran the Linux row; the source's own words are the test's and are outside the table), and the rest of each list is the template word for word. Four forms, each once: (a) the pre-check template to standard output, its bytes counted; (b) the push template with one section; (c) the push template with a reader ABSENT when the helper starts - does the helper wait, drop or end; (d) the push template with two sections and a reader that CLOSES its pipe while the helper runs - does the other output live on. Row N4 does not CLOSE before this run; row N9 does not rely on (c) and (d) before it (SM-35 (5)). If a form fails so that a word of a template must change, the row STOPS: that is a new amendment and brings the design back to the review (08b s1, s8 last sentence). It is not a row's decision.

#### 4.3.4 The restatement of revision 2 (SUPERSEDED by 4.3.1; kept so that the table of differences below can be read)

> SUPERSEDED. NAMED AMENDMENT SR-15 (restated for the measured row). Rule G-R12 as amended by SR-4 and SR-12 gains the places below, all for the production microphone of kind `USB_AUDIO` on `darwin`, in a kind of list of its own (neither a development list nor a Linux list), and loses none.
> (1) A list of the macOS production microphone table holds, directly after `-i` and once, ONE device argument of the CLOSED SET of 32 words `none:0` to `none:31`: the word `none:`, then the decimal form of one whole number 0 to 31 without sign and without a leading zero, made by ONE table function that takes that one number and nothing else. The number is the audio index of the device list read for THIS LAUNCH of the device's helper, of a device whose tie held in that same listing. The video part is the literal `none` always. No name, product, USB id, serial, location, card id or any other text of a listing, of the database or of the configuration forms any part of it. A device named by text is refused by the rule in every production list.
> (2) A push list of that table holds ONE or TWO output sections and no more. Each section holds, directly after `-af` and exactly once, ONE channel selection of the 64 of SR-4 (2), made by the SAME table function from one whole number 0 to 63 that is below the live channel count; two sections of one list never hold the same selection and never the same pipe. The selections are the only arguments of the list that hold a vertical bar. No other filter text exists in the table.
> (3) The formats of such a list are `avfoundation`, `fifo` and `f32le`; `fifo` stands only as the output format of a push section, directly followed by `-fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1`, all literals. The table holds no option that selects a device by another way (`-audio_device_index`, `-video_device_index`), no `default`, no option of the list of section 4.2a, and no log level but the one literal `info`.
> (4) The listing of USB audio devices on `darwin` is THREE FIXED ROWS WITHOUT A PARAMETER: `/usr/sbin/ioreg -r -c IOUSBHostDevice -l -d 2 -a`; `/usr/sbin/system_profiler SPAudioDataType -json`; and the audio helper program of the configuration with the existing device-list row, unchanged. The first two programs are absolute literals named by the table file alone. Each row is handed to the production door unchanged by its ONE caller in the fence, with an empty environment and no start message, on `darwin` only, and is killed at its own bound (5,000 ms, 10,000 ms, 5,000 ms).
> (5) The pre-check of that table is a list of the table too: it carries the device argument of (1) and ONE selection of (2) as its only computed values, and what it writes to standard output is read by the Core in memory, within a bound, and stored nowhere.
> Kept, unchanged: every other sentence of G-R12, SR-4 and SR-12; the two files that may name `-list_devices` and `avfoundation`; AD-07 (2) in its words on either platform.

What differed in revision 2 from the words adopted in C96 (3) (all six confirmed by the addendum, 08b s8; the five points in which the addendum then tightened revision 2 are its own table there: templates in the place of admissions, the retry's listing, no other `fifo` option, `-t` in the pre-check alone, the guard and the empty environment):

| # | Adopted in C96 | Restated | Reason |
|---|---|---|---|
| a | "for THIS START" | "for THIS LAUNCH of the device's helper" | two microphones, one helper: there is one launch per device (section 6) |
| b | a selection "at most once" per list | exactly once per output section, one or two sections | MF13, MF14 |
| c | formats `avfoundation`, `f32le`, `null` | `avfoundation`, `fifo`, `f32le`; `null` leaves (the pre-check now writes the selected input to standard output, so that it can be counted) | MF16; review SM-14 (1) |
| d | "no log level but the two literals it names" | the one literal `info` | MF5 |
| e | L1 "in the form SM-02 settles" | the property-list row, word for word | MF1 |
| f | - | the options of section 4.2a are named as forbidden | MF11; decision C107 |

The caller's rule is in 4.3.2, last paragraph.

### 4.4 What can be shared with the development path, and what must not

| May be shared AS CODE (imported, as the Linux adapter already does at `:65-70`) | Must NOT be shared |
|---|---|
| `isMicPipeArgument`; the device-list row; `linuxChannelSelection`. NOT the literals `QUIET`, `PROGRESS`, `OUTPUT`, `PRECHECK_OUTPUT` (revision 1 shared them): the macOS rows have their own log level, no progress report and a queued output (section 4.2) | The adapter object of kind `LOCAL_DEVICE` (`mic-adapter.ts`) or its helper (`createMicHelper`): development class. The fence refuses a development source in a production operation (decision C92); no flag turns one into the other |
| `preparePipe` / `removePipe`, `createPipeFiles`, `inspectProgram`, `helperProgramRefusal`. NOT `createDeliveryWatch` (it reads a progress report the macOS row does not have) | The development door `startHelperProcess`: production programs start through the production door, under the guard |
| The LINE FORM of the device list (section, entry) as a pattern | `parseDeviceList` as it is (it drops the index and bounds a name to 120, not to the NAME rule); `LOCAL_MIC_DEVICE_NAME`; the device argument `none:<name>`; `selectLocalDevice` as the selector (it selects by name) |
| `identifyRegisteredCard`, `UsbAudioError`, the refusal and notice tables, `guardedArguments`, `isRegisteredAudioInput` of the Linux adapter | `DEMS_CAPTURE_HELPER_FFMPEG` as the production program key: production reads `DEMS_CAPTURE_AUDIO_HELPER` only (F8), even when both name the same file |
| | The built-in microphone: it is not a USB device and is never a card of this listing (rule 2 of 3.3 requires USB transport) |

### 4.6 THE HELPER'S OWN STATEMENTS the product reads before a session may be called recording (review SM-04, SM-14, SM-16; decision C96 (4))

Where they arrive: the helper writes them to standard ERROR. The production door hands on standard output as it arrives and keeps standard error only as a bounded head for the end (WF9). So the door gains ONE observer, the twin of the existing one: every chunk of standard error as it arrives (row N5). The adapter reads those chunks line by line (a line of more than 512 characters is dropped unread), matches FOUR fixed forms and drops everything else: no text of a diagnostics line is kept on a handle, an error, a notice or a log (review SM-12 (3)).

| # | Statement | Form read | Rule | Rests on |
|---|---|---|---|---|
| 1 | THE STREAM LINE, the rate | after the line `Input #0, avfoundation, from 'none:<n>':` (the `<n>` of the argument) and before any `Output #` line, the first line `Stream #0:0: Audio: pcm_f32le, <digits> Hz, <word>, flt, ...` | The rate must be exactly 48,000, or the helper is stopped and every microphone of the launch fails `AUDIO_CARD_RATE_UNSUPPORTED` (detail `HELPER_STATES_OTHER_RATE`). Nothing is resampled: at 96,000 Hz the program converts to 48,000 without printing a line, which is exactly why the refusal stands on the INPUT line. With the rate held here `-ar 48000` in the row is a no-op guard | MF5, MF6; decision U23 (2) |
| 2 | THE STREAM LINE, the layout word | the `<word>` of the same line | A CLOSED TABLE maps a word to a channel count. It holds measured entries only: `5.1` is 6. The count must equal the system list's input count of the launch's listing (6 on this interface, MM s1.2), else `AUDIO_CARD_MOVED` (detail `CHANNELS_DIFFER`); a word that is not in the table is `AUDIO_CARD_MOVED` (detail `LAYOUT_WORD_UNKNOWN`). The words for other counts could not be measured with one device (MM2 s6): another interface needs its word measured and added by a row. What the count is worth: the built-in microphone has 1 input, so a helper that opened it cannot state `5.1` (review SM-04 (5)); it does not tell two devices of equal count apart | MF5; decision C104 (3) |
| 3 | the codec and format words of the same line | `pcm_f32le`, `flt` | anything else: `AUDIO_HELPER_ENDED_AT_START` (detail `STREAM_NOT_AS_EXPECTED`) | MF5 |
| 4 | no stream line | - | not read within 3,000 ms of the helper's start: stopped, `AUDIO_HELPER_ENDED_AT_START` (detail `NO_STREAM_LINE`). Measured: the first sample comes after 0.24 to 0.31 s, a refused open ends after 0.31 to 0.86 s (MF17, MF19). Hypothesis, not measured: while the system's permission question is on the screen the open waits; the pre-check then fails at this bound and is clicked again after the answer | MF19, MF22 |
| 5 | `FIFO queue full`, `FIFO queue flushed` | `[fifo @ 0x<hex>] FIFO queue full` / `... flushed`, the whole line | Each becomes a NOTICE of the capture unit (level `warn`, the log and the persistent error log, the way `CS/capture/forwarder.ts:111-116` says its notices): codes `CAPTURE_MIC_HELPER_QUEUE_FULL` and `CAPTURE_MIC_HELPER_QUEUE_FLUSHED`, with the session and the microphones of that helper. The line names a pointer, not an output, and carries no count. Revision 3 (SM-35 (1), (2), (4)): THE AMOUNT comes from the worker, per microphone: the growth of that microphone's `insertedSamples` (section 8.2) between the line `FIFO queue full` and the first telemetry after `FIFO queue flushed` - that tells WHICH microphone lost and how much; the helper's lines only say when to look. THE PLACE is the run of section 8.4 when the loss is on the feeding microphone. A `full` line with no `flushed` line within 10,000 ms is a FAULT of the group (the reader never came back), not a standing notice. What was dropped is inside the count whether or not a line is ever read: the worker never received it and filled its place with counted zeros. The helper is not stopped by a queue line | MF16; 08b s7 |
| 6 | the refused open | `[in#0 @ 0x<hex>] audio format is not supported`, the whole line | section 4.7 | MF17 |

AT LEAST ONE NON-ZERO SAMPLE PER ASSIGNED CHANNEL (review SM-14; the reason for "exactly zero" and not a level: a converter in a quiet room does not deliver exact zeros; a denied grant, a system mute and a dead input do):

| When | Who counts | Rule |
|---|---|---|
| PRE-CHECK of one microphone | the Core, in memory, from the standard output of the one-second pre-check row (48,000 samples expected, about 43,300 delivered, MF7); counted and dropped, no file | every sample exactly zero: the refusal `AUDIO_HELPER_ENDED_AT_START` with the detail `INPUT_SILENT` (wire cause `OPEN_FAILED`; never `PERMISSION_DENIED`, which no measurement supports, MF22). In the start table an unreachable PRIMARY is BLOCK and an unreachable STANDBY is WARN (`SH/sim/capture-notices.ts:470-480`): so A SILENT STANDBY IS THE EXISTING WARNING AND A SILENT PRIMARY BLOCKS (decision U25 (1)), with no new rule |
| SESSION START | the worker (the pipe goes from the helper to the worker; the adapter sees no sample): one new telemetry member per microphone, `nonZero` (section 8.2) | the ACTIVE microphone must state `nonZero` true within 8,000 ms of the helper's start (the bound the session already gives a microphone start, `CS/capture-session/index.ts:187`); until then the session is "starting", not "recording"; without it the start fails as a microphone that delivered no sample (`AUDIO_NO_SAMPLE_WITHIN_BOUND`, detail `INPUT_SILENT`). The STANDBY: no refusal; the worker's existing silent-microphone warning says it (`WK/audio.c:218`). What the session does today after an active microphone that did not start was not read to its end by this row: the session row reads it first |
| DURING the session | the worker's existing silence raiser | unchanged for the STANDBY (warning). For the ACTIVE microphone of this path a run of exact zeros longer than the silence duration is raised as a fault of that microphone and its interval is in the session's record (review SM-14 (4)) |

On the user's set-up as it is (U25 (1)): channel 0 passes; channels 1 and 3 pass too, on their noise floor, with nothing connected; channels 4 and 5 are exactly zero and are `INPUT_SILENT` (MF21). The check tells a dead input from a live converter, not a microphone from an empty socket.

The first-open levels seen once (MF23) are not explained and no check is built for them: a check would need all six channels of the open, which the row does not carry. It stays on the user's list (section 9.3) and in the README.

### 4.7 UNRELIABLE OPENS: a pause and one bounded retry

Measured (MF17): about one open in thirty is refused (1 of 10, 3 of 38, 1 of 37) with one fixed line and exit 251, after 0.31 to 0.86 s; the same command opens when tried again. In MM2 every refusal came within 0.7 s of a previous close and none in 20 opens after 0.83 s or more; MM3 saw one 7.09 s after a close. The cause is not established. Two measures, both bounded:

| Measure | Rule | Rests on |
|---|---|---|
| A PAUSE after a close | The adapter keeps, per device, the instant its last helper ended. A new helper on that device is not started before 1,000 ms have passed since. A pause, not a retry: it costs nothing when the device was idle | 0 of 20 refused at 0.83 s or more, 3 of 18 below 0.7 s (MM2 s3) |
| ONE RETRY | Only when ALL hold: the helper ended by itself before its stream line was read, with exit status 251, and its diagnostics held the fixed line of row 6 above. Then: 1,000 ms, a FRESH full listing (a new index, a new row), one more launch. A second refusal is the end: every microphone of the launch fails `AUDIO_HELPER_ENDED_AT_START` (detail `FORMAT_NOT_SUPPORTED`). Any other early end is not retried | an immediate retry opened in 3 of 3 (MM2 s3); MM3's refusal at 7.09 s shows the pause alone is not enough |

What is reported: every retry is a notice of the adapter (`AUDIO_OPEN_RETRIED`, the microphones of the launch, through the adapter's existing notice observer), written to the log and the persistent error log; the final refusal is the named refusal above, and the operator reads the existing sentence of a microphone that could not be started.

How it keeps the rule of rows 191 / 191b ("a handle starts once"; a later worker is fed by close, open, start):

- `start` of a handle is still called once and settles once. The retry is INSIDE that one start and applies only to a helper that never stated a stream and never delivered a sample: no helper that fed a worker is ever started again.
- Time, from the measured figures: a launch is two listings and a settle time (about 0.55 + 1.5 + 0.55 s) plus the open; the pause adds at most 1.0 s; one retry adds at most about 0.86 + 1.0 + 0.55 s. Worst case about 6.9 s (computed from MF2, MF17 and the settle time of WF13, not measured as a whole) against the session's bound of 8,000 ms for a microphone start (`CS/capture-session/index.ts:187`). That is why the retry is ONE: a second would pass the bound. The pre-check has its own bound of 8,000 ms on macOS for the same reason (the Linux pre-check's is 5,000 ms, WF13).
- At a worker restart the pause and the retry lengthen the time without audio. That time is not hidden: row 191b measures it per restart and the signed manifest states both bounds (`audio.absentOnRestart`, `implementation/191c_signed_audio_gap.md` section 1). The gap is measured and stated, whatever its length.

## 5. Point 4 - PERMISSION

What is known: macOS asks the user, not the program; the first open of a microphone is where it asks (F12). Everything below about WHO is asked and what a refusal looks like is still a HYPOTHESIS after the measurements: no prompt was observable to an agent (there is no screen), no open was denied, and the first open simply delivered samples after 0.48 s (MF22). The repository marks the refusal texts unproven (H-18, `mic-helper.ts:27-28`).

Revision 2, what the measurements add:

- THE PERMISSION CANNOT BE CHECKED WITHOUT AN OPEN. The boot states it as not known (`microphonePermission: NOT_KNOWN` on `darwin`, review SM-15); it never reads the system's privacy database.
- WHAT THE FIRST START SHOWS. In the measurement the application at the top of the helper's parent chain was the one that hosts the agents (MF22); by the review's SM-15 the grant it holds is standing and covers the built-in microphone too, and the review recommends that the user switch it off again (an agent changes no privacy setting, U24 (3)(b)). For the user's own production Core the launching application will be asked at the first pre-check - not measured (section 9.3).
- A refusal with the text `audio format is not supported` is NO sign of a denial: it occurred with the grant in place (MF17, MM s6).
- The silence statement of the pre-check is no longer a proposal: it is the gate of section 4.6.

| Question | Answer |
|---|---|
| Which process is asked | Hypothesis: the "responsible" process at the top of the chain, not the helper. Core started from a terminal: the terminal application is named in the question and holds the grant; Core, guard and helper inherit it. Core started by a per-user launch agent: the program the agent starts is named. Core started as a system daemon (no user session): nobody can be asked and the open is refused. Core started from an agent's shell: the application hosting that shell would be asked - which must never happen (section 9.4) |
| With no access | Hypothesis, three possible forms: the open fails (the helper ends at start: `AUDIO_HELPER_ENDED_AT_START`); or no buffer ever arrives (the input waits for its first buffer, 1.3; stopped at the first-sample bound: `AUDIO_NO_SAMPLE_WITHIN_BOUND`, Linux adapter `:791-795`); or buffers of digital silence arrive. The first two fail closed with the existing bounds. The THIRD would record silence with no refusal |
| Against the third form | ADOPTED as a gate (review SM-14): the pre-check row writes one second of the SELECTED input to standard output, the Core counts in memory, and every sample exactly zero is `AUDIO_HELPER_ENDED_AT_START` with the detail `INPUT_SILENT` (wire cause `OPEN_FAILED`; the wire vocabulary has `PERMISSION_DENIED`, `CS/capture/adapters/types.ts:198-204`, but silence does not prove a denial). The row is named in SR-15 (5). At a session start and during a session: section 4.6 |
| What the boot or the adapter can check without opening | That the three listing programs and the helper pass the path rule; that the listing answers (and is not the empty list of M9). NOT the permission: the system's privacy database is not the Core's to read, and asking the system for the status needs native code (alternative E). So the boot STATES the permission as "not known: asked at the first open" - a fact, not a pass |
| What the user does once | (1) Decide how the production Core is started on this Mac and always start it that way; (2) run the microphone pre-check from the web console - the first open - and answer the system's question with Allow; (3) if it was denied once: System Settings, Privacy and Security, Microphone, switch the launching application on, restart the Core; (4) set the interface to 48,000 Hz |

## 6. Point 5 - TWO INPUTS

The Linux precedent (F1, F2): a registered microphone is ONE INPUT of a card; two inputs of one card are two helpers on one shared capture; `allocateCardInput` refuses the same input twice.

Revision 2: ONE PROCESS, TWO MICROPHONES. Decided by the user: PRIMARY and STANDBY are two channels of the ONE interface (U23 (1)), used as it is (U25 (1)). Measured: two helpers cannot hold the device (MF13); one helper with one output per input delivers both, sample-aligned (MF14); behind the dropping queue a stalled reader of one costs the other nothing (MF16). Registration is unchanged and is the Linux answer: one card, inputs i and j; the same input twice is refused (`INPUT_TAKEN`).

### 6.1 The contract of the adapter: two handles, one helper

The adapter contract is unchanged (`CS/capture/adapters/types.ts:225-237`, `:294-314`): `open` gives one handle per registered input; a handle has `start` and `close`; A HANDLE STARTS ONCE. What is new is INSIDE the macOS adapter: the handles of one device in one session form a GROUP, and the group owns the one helper.

| Call | What it does on macOS | Refusals |
|---|---|---|
| `open(MIC-a)` | Listing, identity, tie, rate and input checks of section 3 for this input; the pipe is made; the handle JOINS the group of (session, device). No helper is started (as on Linux) | as on Linux; and `AUDIO_INPUT_ALREADY_OPEN` (detail `DEVICE_HELPER_RUNNING`) when the group's helper is already launched: an output cannot be added to a running helper |
| `open(MIC-b)`, same device | the same; the handle joins the SAME group | the same |
| `start()` of any handle | THE FIRST `start` of a group LAUNCHES THE HELPER, ONCE: the second listing, the index, the row of section 4.2 with one output per handle that is open in the group at that instant (in the order of the input numbers), the guard, the door, the stream line, the settle time, the third listing (sections 3.3, 4.6, 4.7). Every later `start` of a handle of the group JOINS that one launch. Each handle's `start` settles with the launch's outcome. This fits the session as it is: it opens every microphone first and then starts every handle in the same turn (WF11) | `AUDIO_INPUT_ALREADY_OPEN` for a second `start` of the same handle; the launch's refusal for every handle of it |
| `close()` of one handle while the other is live | The handle leaves the group: it is told nothing more and its input is free. THE HELPER KEEPS RUNNING for the other handle; the closed handle's output keeps writing into its pipe, which is removed only when the group ends (so the helper never meets a path that changed under it) | - |
| `close()` of the last handle | the helper is stopped through the guard's input, then by signals at the existing bounds; an exit status of 255 after the adapter's own stop is the ORDERED end (MF18), not a failure; the pipes are removed; the instant is kept for the pause of section 4.7 | - |
| the helper ends by itself | EVERY live handle of the group is told once, `AUDIO_HELPER_EXITED`: both microphones are lost in the same instant | - |

A group is never launched twice. A later worker is fed the way rows 191 / 191b built it: the session closes EVERY microphone handle, then opens every one again (WF11) - which ends the group and its helper and makes a new group. Nothing of the session had to change for this.

What the other handle experiences when one is closed mid-session: nothing, as long as the closed output's READER (the worker) still reads or merely stops reading - that is the measured case (MF16). NOT measured: a reader that CLOSES its pipe while the helper runs (MM3 s10). The session does not do that to one microphone alone (the worker holds both pipes for its whole life, `WK/audio.c:555-556`, `:661`), and when the worker ends the session closes all handles; the build row still proves the case on the real helper with a generated source before the adapter relies on it.

### 6.2 What PRIMARY and STANDBY mean on this path

| | Two devices (not the user's case) | Two channels of one device (U23 (1)) |
|---|---|---|
| Registration | two cards, input 1 of each (names must differ, 3.3) | one card, inputs i and j |
| Helpers | one per device | ONE helper, two outputs |
| What the standby protects against | loss of one device, cable or socket | ONE MICROPHONE or its cable into the interface. NOT the interface, its USB cable, its socket, the helper process, the permission or the rate: one fault takes both microphones in the same instant |
| What a switch to the standby is | another source | another channel of the same open: sample-aligned with the primary (MF14), carrying the same shortfall in the same places (the two outputs are the same packets, MM2 s5) |

Nobody may take the standby for an independent microphone (review SM-19). How the product says so:

| Where | Statement | Change |
|---|---|---|
| SOURCE FACTS of the session | both microphone rows carry the same `usbPort` and `cardId` and differ in `inputNumber` only | none: the keys exist (`CS/capture/fence/sources.ts:148`) |
| A NAMED NOTICE | the advisory reason `STANDBY_ON_PRIMARY_DEVICE` on the STANDBY microphone: raised when the roles are assigned or pre-checked and both resolve to one device, and at a session start; not blocking; resolved when the assignment changes or the session ends. Sentence: "The standby microphone is on the same device as the primary. It guards a microphone, not the device." | one member of the closed list of advisory reasons (`SH/sim/capture-notices.ts:81-97`): the contract step |
| Documents and screens | the pair is never called "redundant" | document row |

REVISION 3 (SM-34; decision C110, ruling (4)): THE ROLE KEEPS ITS CONTRACT NAME, THE OPERATOR NEVER READS THE BARE WORD, AND THE SIGNED RECORD STATES THE SHARED CAPTURE GROUP. The table above stays; these words are added to it.

THE CAPTURE GROUP. A small whole number, 1 or 2 (a plan has at most two microphones, `WK/worker.h` `NMIC`). Microphones of one session with the SAME number were captured by ONE process from ONE device. The macOS adapter gives it: the group of section 6.1 that holds the PRIMARY's handle is 1; the STANDBY's handle is in group 1 when it is in the same group, else 2. It is stated in three places, each under its own protection: the source facts (key `captureGroup`, section 8.1: written once at the start, not updatable), the audit row (detail `captureGroup`, section 8.4) and the signed member (field 142, section 8.4). A reader of the package who sees a source interval with the role `STANDBY` sees, under the same signature, that it was not an independent source.

THE WORDS THE OPERATOR READS (English; the Indonesian texts are the document row's, in the same keys). They are shown when PRIMARY and STANDBY resolve to ONE device - the same `usbId` and the same `usbSerial`, or without a serial the same `usbPort` - and the plain texts of today stay for two devices:

| Where | Today (plain) | For a pair on one device |
|---|---|---|
| The role label, short (`SH/i18n/en/devices.ts:324`; found by a search for the word, the key's users were not read) | "Standby" | "Second channel" |
| The role label, long (`SH/i18n/en/common.ts:920`, `:1096`) | "Standby microphone" | "Second channel of the same device" |
| The assignment line (`SH/i18n/en/devices.ts:432`) | "Microphone for the standby line" | "Microphone for the standby line - second channel of the same device" |
| The session's source label (`SH/i18n/en/session-new.ts:91`) | "MIC (standby)" | "MIC (second channel of the same device)" |
| The notice `STANDBY_ON_PRIMARY_DEVICE` (replaces the sentence in the table above; SM-34 (2)) | - | "The standby microphone is another channel of the primary's device and is recorded by the same capture program. It guards a microphone and its cable, nothing else." |
| A handle opened after the launch is refused (section 6.1; SM-34 (6)) | - | "Both microphones of one device are started together. This microphone joins at the next start of the session's microphones." |
| A switch to the STANDBY asked for when the group's helper has ended (SM-34 (4)) | the switch's ordinary answer | REFUSED with what is true: "The capture program of this device has ended. Both of its channels are gone; the second channel cannot bring the audio back." The product does not OFFER the switch as the way out in that state |

Where the qualified label must stand: at the assignment, at the pre-check, during the session and in the session's summary (SM-34 (1)). The advisory notice is gone when the session ends, so the label cannot hang on it. HOW A CLIENT KNOWS, to be verified FIRST by the web row (not read by this revision: the web console and the device shapes): if a microphone's device shape already carries the card identity of its registered input, the label is a pure function of the two shapes in the shared package; if it does not, ONE optional boolean of the microphone's device shape, `sharesDeviceWithPrimary`, is the contract member and belongs to the one contract step (row N2).

Never "redundant", in any document or screen (review SM-19 (3); SM-34 (5)).

On the user's set-up as it is (U25 (1)): one audible microphone on channel 0; the standby is another channel as it is. If that channel is one of the two dead ones it is the existing silent-standby warning, not a refusal (section 4.6).

Alternative, not recommended: admit the built-in microphone as the standby. It is not a USB device, has no identity of the kind F5 needs, and is the device rule D163 protects.

## 7. Point 6 - LOSS and RESTART

### 7.1 Loss and restart

As on Linux in its rules: a handle starts once; `close` then `open` then `start` per attempt (F3, rows 184 / 191); the loss watch polls the listing and uses the same match (F15); a helper that ends is told through `onLost`. Not the same in its mechanics: the two microphones of the interface share one helper (section 6), so they start, are lost and are re-opened together.

What differs:

| | ALSA (Linux) | macOS | Consequence for the design |
|---|---|---|---|
| Shared capture | a generated configuration file and one environment key | none | the macOS adapter has no configuration writer and an empty environment; `AUDIO_SHARED_CAPTURE_REFUSED` cannot occur |
| A listing | one program and a few kernel files | three programs, about 0.4 to 0.55 s for all three (MF2) | a re-open costs three listings (open, launch, after the settle time), about 1.2 to 1.7 s, plus the pause and at most one retry of section 4.7; the later worker of a restart is delayed by that much, and the delay is inside the gap row 191b measures and the manifest states. The watch adds one listing every 5,000 ms; listings are single-flight per Core (review SM-10 (4)) |
| Device unplugged | the helper's read fails and it ends (unproven even there: `9A/H-07`) | NOT MEASURED (nothing was unplugged, MM s7). Hypothesis: the input may simply stop getting buffers and the helper may NOT end | Revision 1's stall bound read the helper's progress report; the measured row has none, and that report follows timestamps, not delivery (MF10). The stall is stated by what already exists: the worker raises its no-sample fault for each microphone after its debounce (`WK/micwatch.c`, `micwatch_chunk`; `WK/audio.c:219`), and the watch's listing pass loses the device and raises the fault independently. The helper is then stopped by the session's close. Revision 3 (SM-06 as restated, 08b s3): the stall is read from the worker's `receivedSamples` (section 8.2) by row N11. (a) NO microphone of a helper's group advances for 5,000 ms after its first sample: the session closes the handles of that group, which stops the helper (`AUDIO_HELPER_EXITED`, detail `STALLED`), and the interval is in the session's record - a helper that lives and delivers nothing holds the device and keeps the session from its own re-open. (b) ONE microphone does not advance while the other does: a fault of that microphone only; the helper stays. What a real unplug does stays the user's check (section 9.3) |
| A reader that falls behind | the helper blocks | the helper drops packets of THAT output and says `FIFO queue full` (MF16) | the line becomes a notice (section 4.6); the dropped samples are inside the measured shortfall (section 8) |
| The ordered end | exit after the guard's stop | the helper ends within 50 ms with exit status 255 (MF18) | 255 after the adapter's own stop is not `AUDIO_HELPER_EXITED` |
| Device returns | found at any index | found; the index is re-read at the next open | nothing new: nothing restarts by itself; the session re-opens per attempt |
| The first samples | open point of the hardware check | the first sample comes 0.24 to 0.31 s after the start (MF19) | the stream-line bound of 3,000 ms and the session's 8,000 ms cover it (section 4.6) |
| Samples actually delivered | unproven | 89.4 to 91.8% of the stated rate, whole packets of 512 samples missing about nine times a second, and the helper says nothing (MF7, MF8, MF10) | NOT a gate any more (U25 (2)): the path is built as it is, the worker handles the missing samples as section 7.2 says, and every session states its shortfall (section 8) |

### 7.2 What the worker does with a pipe that delivers fewer samples than real time

TODAY, by the code (not run with such a pipe by any row: the statements below are read from the lines cited, and where they predict behaviour they are marked):

1. THE TRACK DOES NOT GET SHORTER AND DOES NOT DRIFT CUMULATIVELY. The audio timeline is the host's clock: one quantum of 480 samples is produced every 10 ms whether or not the pipe delivered (`WK/audio.c:599`, `:612-630`). A quantum takes what the microphone's buffer holds and the rest of it is ZERO (`WK/audio.c:436-446`). So the audio track is as long as the wall time and sample n is at T0 + n / 48,000 whatever arrived.
2. THE ZEROS ARE COUNTED BUT NOT TOLD. `missing` counts them (`WK/audio.c:449`); it leaves the worker only in one log line when the audio thread ends (`WK/audio.c:651-655`). The Core never learns the number, and nothing in the evidence states it.
3. THE WORKER WOULD STRETCH THE AUDIO. A controller sees the buffer fall and asks the resampler for up to 5,000 parts per million more samples (`WK/audio.c:464-477`). That is 240 samples a second, against a shortfall of about 4,100 to 5,000 a second (48,000 less the 42,966 to 43,943 of MF7): it would sit at its limit for the whole session, make 0.5% of the missing audio out of the audio that is there, and raise `MIC_RATE_AT_LIMIT` (`WK/audio.c:480`), which the Core shows as a standing advice on the microphone (WF8). The resampler that stretches is exactly what decision C107 forbids in the helper's row.
4. THE ZEROS ARE NOT WHERE THE HOLES ARE. The pipe is raw samples without timestamps (the row writes `f32le`), so the worker cannot know which 10.67 ms are missing. It inserts zeros where ITS buffer runs empty. Predicted from the code, not measured: the buffer starts about 40 ms full (`WK/audio.c:88-89`) and is empty after roughly half a second at this shortfall; from then on a delivered sample is used as soon as it arrives, so it sits up to 40 ms EARLIER on the timeline than in a session with a whole pipe, minus the time the helper took to hand it on. A fixed displacement bounded by the 40 ms the worker waits, not a drift that grows.
5. Nothing stalls: the read never blocks (`WK/audio.c:359`, `:385`), and a microphone counts as stopped only after 200 ms without any sample (`WK/audio.c:92`, `:423`), which this pipe never shows (longest pause between two reads 23 to 32 ms, MM3 s8.1).

So today's result would be: an audio track of the right length whose timing against the picture stays true to within tens of milliseconds, with about a tenth of it silence in places that are not the real holes, a slight stretch, a misleading standing advice, and NO statement of any of it. The timing holds; the honesty does not.

WHAT MUST CHANGE (the worker row), and the choice between "silence where the product knows" and "timestamps carry the gaps":

| Choice | Can the worker and the writer express it | Decision |
|---|---|---|
| The track's timestamps carry the gaps | NO. One AAC encoder is fed fixed frames of 1,024 samples whose time is the sample counter, and its packets go byte for byte into every camera file (WF6); the interval records, the manifest's file times and the tap all count in that one continuous counter. A hole of 512 samples is half an encoder frame. And the worker does not know where the holes are (point 4) | not taken |
| Silence inserted by the HELPER | forbidden (section 4.2a): it invents the silence and does not put it where the holes are either (MF11) | not taken |
| SILENCE INSERTED BY THE WORKER, counted and stated | YES: it is what the code already does (point 1); what is missing is that it says so and that it does not stretch | TAKEN |

The changes, all in the worker's audio thread and its plan reader, switched by a NEW TRANSPORT KIND so that no Linux or development session changes:

- A second kind of microphone input beside `PCM_FIFO`, proposed name `PCM_FIFO_GAPPED` (`CP/index.ts:351-358`, `:567`; its statement in `CS/capture/adapters/mic-transport.ts:78-88`): the same bytes (32-bit float, 48,000 Hz, mono), but the source does NOT promise every sample. The macOS adapter's handles state it; the plan carries it to the worker (`WK/capture_worker.c:176` accepts one more word).
- For a microphone of that kind the controller asks for NOTHING and `MIC_RATE_AT_LIMIT` cannot arise for it. Revision 3: the whole controller block is not entered and the resampler is not in the path at all (section 7.2a). The microphone's own clock difference is not followed on this path: it cannot be told apart from a shortfall of about a tenth, and it is inside the number the product states.
- The zeros are inserted where the product KNOWS, on its own clock, that no sample has arrived for that instant - as today - and they are REPORTED: the worker states per microphone, continuously, the whole account (sections 7.2a, 8.2).
- The displacement of point 4 is measured by the build row on a stand-in that reproduces the measured pattern (512 samples every 11.9 ms, one packet in ten missing) with a marker signal, and stated against the product's bound for the offset between sound and picture. Revision 3 (SM-31 (4)): if the bound is not met the row STOPS and reports. "Holding the buffer by inserting the zeros earlier" (revision 2) is a change of what the evidence says and goes back to the review; it is not a refinement the row may decide.
- What the evidence must then say, and does (section 8). Revision 3 strikes revision 2's sentence that the silences stand "near" the missing sound: by the addendum's reading of the same lines (08b s4.1, HB-2; not run) the worker's zero runs fall where its 10 ms quantum beats against the helper's 11.9 ms read, and a lost packet leaves no trace in the arrival times the worker sees. The one sentence for every document, notice, screen and comment is the fixed sentence of section 8.3. Each lost packet is also a cut of 10.67 ms in the sound that is there (a step 4.6 to 10.8 times the normal at each, MM3 s1), and each inserted run cuts sound that arrived in one piece.

### 7.2a THE ACCOUNT IS COMPLETE (revision 3; decision C110, rulings (2) and (5); SM-29, SM-31, SM-33, SM-35)

The rule: every sample of the track is either RECEIVED or counted as INSERTED, and every received sample is either IN THE TRACK or counted as DISCARDED or still BUFFERED. The counts are the WORKER's, per microphone, and never the helper's lines.

What the addendum found (08b s4.1), read again by this revision in `WK/audio.c` (file:line of the tree of this branch; read, not run):

| # | Place | What the code does TODAY | Counted today | What the kind `PCM_FIFO_GAPPED` does INSTEAD |
|---|---|---|---|---|
| 1 | `:353-358` (`mic_open`) | makes a resampler from 48,000 Hz mono float to 48,000 Hz mono float and switches it on "from the first sample" by a compensation of nothing | - | makes NO resampler: the member stays null. The close already allows that (`:366`, `if (m->swr)`) |
| 2 | `:393` (`mic_read`) | a sample that is not a finite number becomes zero | NO | the same replacement, and each one is COUNTED in a number of its own, `nonFiniteSamples`. `nonZero` is decided BEFORE the replacement, on the sample as read: true once one sample was finite and not zero (SM-31 (5)) |
| 3 | `:395-396` (`mic_read`) | when the two-second buffer would overflow, the oldest samples are dropped; the room asked for is the chunk plus 64 (for what the resampler may add) | yes, in `dropped`, told only in the end line (`:653`) | the room is the chunk exactly (no resampler adds anything); the number the drop REMOVED (the function's own clamped count, `:371-376`) is added to `discardedSamples` |
| 4 | `:399` (`mic_read`) | every sample goes through the resampler into the buffer; what comes out may differ in count from what went in | - | the samples are COPIED into the buffer, value for value and in order; what enters the buffer is exactly what was read, so `receivedSamples` is also the count that entered the buffer |
| 5 | `:423-427` (`mic_take`) | a microphone with an empty buffer and nothing for 200 ms is "stopped"; its quanta are then all zero | the zeros are in `missing` (`:449`) | unchanged; the zeros are `insertedSamples`, and on the feeding microphone they are a run (section 8.4) |
| 6 | `:428-434` (`mic_take`) | when a stopped microphone delivers again it is placed anew: everything in the buffer but the newest 2,400 samples (40 ms plus one quantum) is dropped | NO | the same placement; the number removed is added to `discardedSamples` |
| 7 | `:436-449` (`mic_take`) | a quantum is: the silence still owed (`lead_silence`), then what the buffer holds, then zeros; `missing` grows by 480 less the samples taken | yes, from the first quantum of the timeline, for BOTH microphone slots, running or not | `missing` IS `insertedSamples`. Nothing is added here: revision 2 lost these zeros only by counting "since this microphone's first sample". The quantum's shape (zeros at the head, samples, zeros at the tail) is kept for the run tracker of section 8.2 |
| 8 | `:452-480` (`mic_take`) | the level is tracked and, ten times a second, the resampler is asked for up to 5,000 parts per million (`:477`); at the limit `micwatch_rate` raises `MIC_RATE_AT_LIMIT` (`:480`) | - | the function RETURNS before `:452`: no level, no compensation call, no `micwatch_rate` (SM-31 (1)). With no resampler a call at `:477` would have nothing to act on: the static rule below holds that it cannot be reached |
| 9 | `:494`, `:500-502` (`telemetry`) | `ratePpm` is the controller's request, or null while the microphone does not run | - | `ratePpm` is ALWAYS null (SM-31 (3)); the entry gains the members of section 8.2 |
| 10 | `:563-576` (`audio_main`) | the timeline starts 300 ms after the first sample of either microphone; when NEITHER delivers for 3,000 ms it starts on the host's clock with no master (`:570`, `:576`) | the zeros that follow are in `missing` (place 7): a microphone without data is not started (`:579`) and every quantum of it is zero | unchanged. Because the account counts from sample 0, the silence a session OPENS on is `insertedSamples` and, on the feeding microphone, a run from sample 0 with its length (SM-39 (4)). On this path a launch with its pause and one retry can take about 6.9 s (section 4.7), so this is the ordinary case to expect, not a rare one - HYPOTHESIS until row N9 times a launch |
| 11 | `:581-583` (`audio_main`) | a second microphone that began later owes its lead in silence (`:583`, then `:439`); one that began BEFORE sample 0 has its early samples dropped (`:582`) | the lead: yes, in `missing`. The trim: NO | the lead is `insertedSamples` (place 7); the number the trim removed is added to `discardedSamples` |
| 12 | `:639-661` (the end) | the buffers are freed with whatever they hold; `received`, `missing`, `dropped` go into one log line | log only | what a buffer still holds when the timeline ends is added to `discardedSamples` (received, never put on the timeline); then the CLOSING account of each gapped microphone is written, BEFORE `AUDIO_TIMELINE_END` (`:658`) |

THE RESAMPLER: OUT OF THE PATH for this kind. The addendum allows either "shown transparent" or "bypassed" and refuses "not shown" (SM-31 (2)). The code allows the bypass plainly, and this revision takes it: the resampler is used at exactly six lines of the file (`:353`, `:355`, `:358` make it and switch it on; `:366` frees it under a null test; `:399` converts; `:477` asks for compensation), both of its sides are the pipe's own form (`:353`: mono, 32-bit float, 48,000 Hz), and the buffer it fills holds that same form (`:103`). A copy is therefore exact by construction and the account's identity needs no term for "what the resampler holds". Not taken: proving the resampler transparent with a marker signal - a resampler that is switched on filters (08b HB-1, the reviewer's hypothesis; the library's source was not read by anyone here), and a proof that held today would have to be held again at every change of the pinned library. The comment at `:465-466` ("passed through sample for sample") stays a statement about `PCM_FIFO` and is not relied on.

THE IDENTITY, for each gapped microphone, at every account (SM-29 (3)):

```
timelineSamples = receivedSamples - discardedSamples - bufferedSamples + insertedSamples
```

Why it holds to the sample, from the lines above: every quantum adds 480 to the timeline and splits into samples taken from the buffer and zeros (place 7), so `timelineSamples` = taken + `insertedSamples`. Every sample read enters the buffer (place 4) and leaves it in exactly one of three ways - taken into a quantum (`:446`), removed by one of the three drops (places 3, 6, 11) or still there - so `receivedSamples` = taken + `discardedSamples` + `bufferedSamples`. Subtracting gives the line above. At the CLOSING account the buffer's rest is counted as discarded (place 12), `bufferedSamples` is 0, and the identity reads `timelineSamples` = `receivedSamples` + `insertedSamples` - `discardedSamples`, where `timelineSamples` is the number of samples the one encoder was fed, that is `AUDIO_TIMELINE_END.samples` (`:658`) and the length of the track. `nonFiniteSamples` is not a term: such a sample was received AND is in the track, as a zero the product made, and is stated beside the identity. The up to three bytes of an unfinished sample at the pipe's end (`:389-392`) are not a sample and are in no count.

The worker CHECKS the identity itself before it writes an account. If it does not hold, the worker writes NO account for that microphone and logs an error; the Core then states "not measured" (section 8.4), never a number that does not add up. A build in which the worker's own test finds the identity broken on the stand-in does not ship the record (SM-29 (3), (5)).

ONE PREDICATE, ONE PLACE THAT SETS IT (SM-33 (4), "the code"): a member `gapped` of the planned microphone (`WK/worker.h:291-295`), set ONLY by the plan reader from the kind word (`WK/capture_worker.c:176`, which today accepts the one word `PCM_FIFO` and answers `PLAN_INVALID` for any other; it accepts two words then, any other is still `PLAN_INVALID`). It is READ in this closed set of places and nowhere else: `mic_open` (place 1), `mic_read` (places 2, 3, 4), `mic_take` (places 6, 8), `telemetry` (place 9), `audio_main` (places 11, 12 and the account writer). The kind is per microphone: a plan may hold one microphone of each kind.

THE WORKER'S STATIC RULE gains (files `apps/capture-worker/test/static/pinned_calls.py`, `planted.tsv`, called by `check.sh`): the count and the functions of the reads of `gapped`; exactly one assignment to it, in `capture_worker.c`; both compensation calls and the convert call stand inside a branch that tests it. Planted lines that must fail: a second place that sets it; a compensation call reachable for a gapped microphone; a branch on the kind word anywhere but the plan reader. The table `pinned-calls.tsv` itself does NOT move: it pins calls that create, truncate, rename or remove a file, set a mux option or command the filter graph (its header, `pinned_calls.py:1-12`), and this change adds none of them.

HOW THE WORKER TELLS THE CORE, and WHICH PINS MOVE. Two ways, both of the existing protocol (words in section 8.2):

| What | Carried by | Lossless | Used for |
|---|---|---|---|
| the running counts of every microphone | FOUR NEW MEMBERS of each entry of `levels` in the existing `TELEMETRY` line (`WK/audio.c:500-502`, sent at `:533` as a level: it may be dropped) | no | the notices of section 8.3, the non-zero gate of section 4.6, the stall rule of 7.1, the amount of a queue drop (4.6). Cumulative numbers: a dropped line loses nothing but time |
| the account of a gapped microphone; each long run | TWO NEW RECORD KINDS through the existing `send_record` (`WK/worker.h:324`; a record is not droppable) | yes | the audit rows and the signed member (section 8.4) |

| Pin | Where | Moves |
|---|---|---|
| THE PROTOCOL NUMBER | `WK/worker.h:48` `#define CAPTURE_PROTOCOL_VERSION 4` and its twin `CP/index.ts:148`; held EQUAL by `CS/capture/__tests__/protocol-pins.test.ts:61`; a worker of another number is refused at the boot (`CS/capture/boot/checks.ts:401`) | 4 to 5, both in ONE change set |
| literals of the number | `protocol-pins.test.ts:89`; `CP/test/protocol.test.ts:101`, `:163`, `:195-207`; `CS/capture/__tests__/records.test.ts:561`, `:578`; `ipc.test.ts:312`; `tidy-fy.test.ts:162`; the worker's own harness `apps/capture-worker/test/m3worker.py:61` | one number each; every edit listed in the row's record (SM-33 (1), (3)) |
| the record kinds the worker writes | `protocol-pins.test.ts:76-78` (a sorted list of six) and `MIC_RECORD_KINDS` (`CP/index.ts:919`) | plus two |
| the plan's kind word | `WK/capture_worker.c:176`; `CP/index.ts:351-358`, `:567` | plus one word |
| the worker's version word | `WK/worker.h:52` (`capture-worker/0.6.0`), held equal at `CS/capture/boot/checks.ts:389` and restated at `SH/api/system.ts:97` | NOT moved by this design: the protocol number already makes an old worker and a new Core refuse each other. If a rule of the worker's own checks demands a new word for a changed source, row N3 says so before its first edit and the shared place is a request to the one writer of the shared package - it is not a second contract step |

No other expected value of an existing check is edited (SM-33 (3)). The telemetry text is built in a buffer of 768 bytes and is sent EMPTY when it does not fit (`:487`, `:528-529`); the device id may be 128 characters (`WK/worker.h` `ID_CHARS`). By this revision's count two entries with the longest id and the largest numbers are about 640 bytes - an estimate, not a test: row N3 proves the fit at the bounds or enlarges the buffer (SM-33 (5)), because an empty `levels` would switch off the non-zero gate and the notices without a word.

## 8. Point 7 - what STAYS LINUX-ONLY, and what the evidence states

Linux only, unchanged: `/usr/bin/arecord -l`; the kernel files of `card-listing-reader.ts`; the shared-capture configuration (`alsa-config*.ts`); the Linux helper table; the host profile and its checks (F16); the commissioning rows; the unit hardening.

What the evidence must state when the microphone path is the macOS one:

| Where | Statement | Change needed |
|---|---|---|
| Session source facts of each microphone | `model`, `usbId`, `usbSerial` (absent when none), `usbPort` (the location, eight hex digits), `cardId` (`usb_<location>`), `cardDevice` 0, `inputNumber`, `nativeChannels`, `sampleRate` 48000 - the values of the listing of the LAUNCH. `sampleBits` is LEFT OUT: no listing states it and the helper's float stream is not the device's width | none: the keys exist (F14) and the builder leaves out what it has no value for |
| Session source facts, the path | section 8.1 | two keys, on `darwin` only |
| Boot audit entry and sealed manifest, the host | ALREADY THERE since row P1 (decision C97): `SYSTEM_BOOT` states `hostPlatform: darwin` and `hostProfile: WILL_NOT_BE_ASKED`; the signed manifest of a session sealed on this Mac carries `hostProfileNotAsked: { platform: 'darwin' }`, absent on Linux (`implementation/p1_production_platforms.md` sections 3, 4) | none |
| Boot audit entry, the permission | `microphonePermission: NOT_KNOWN` on `darwin` (review SM-15): a fact, not a pass; and the path-rule result of the two system listing programs | one optional member beside row P1's two |
| Session, the shortfall | sections 8.2 to 8.4 | protocol, audit type, manifest member, notices |
| README, installer note | the Mac is a bench form: what it does not check (section 11) | document row |

### 8.1 WHERE THE CODE MARKS THE macOS PATH AS THE BENCH FORM (review SM-20; decision U25 (3))

| Place | Mark | State |
|---|---|---|
| The host, in the evidence | `hostPlatform` / `hostProfile` of `SYSTEM_BOOT`; `hostProfileNotAsked` of the signed manifest | EXISTS (row P1). So the review's extra word (`hostForm: BENCH_DARWIN`, SM-20 (1)) is NOT added: it would say a second time what the manifest already signs. For the review's addendum to confirm or reverse |
| The adapter, in code | the macOS adapter is a file of its own with the header statement "the bench form of this Mac: not the hardened Linux form; the audio of this path is not sample-continuous"; it exports the two constants below and nothing else builds them; the platform seam builds it on `darwin` only (`CS/capture/fence/production-parts.ts:273-289` is where the seam is today: `linux` the reader, anything else "not available") | build rows N7, N9 |
| The transport, in code | the kind `PCM_FIFO_GAPPED`, whose statement says "does not promise every sample" (section 7.2) | contract row N1 |
| The microphone, in the stored session | TWO NEW KEYS of the closed list of source facts (`CS/capture/fence/sources.ts:148`), stated by the macOS adapter ONLY and absent in every Linux and development session: `captureLayer` = `AVFOUNDATION` (closed set of one word; `ALSA` is not stated, so nothing a Linux session stores changes, U25 (5)) and `sampleContinuity` = `NOT_CONTINUOUS` (closed set of one word). They state THAT the path is not sample-continuous. They cannot state by how much: the row is written once at the start (WF10) | build row N11. The three CHECKs of the column are about form, secret-looking keys and size by their names (`CS/db/migrations/0015_capture_streams_audio_inputs.sql:54-56`); whether any sealed reader pins the key list was not verified: the build row verifies first (review SM-18 (2)) |
| The microphone, under the signature | `captureLayer` in every record of the manifest member of section 8.4 | contract row N2 |

REVISION 3 - THE SOURCE FACTS, VERBATIM (SM-34 (3), SM-36 (1), SM-40). THREE keys, not two, join the closed list `MIC_SOURCE_FACT_KEYS` (`CS/capture/fence/sources.ts:148`; ten keys today). The list is the Core's, not a member of the shared package. The macOS adapter states them and no other adapter does; the builder leaves out what it is not handed, so a Linux or development session stores what it stores today.

| Key | Type | Closed set / bounds | Says |
|---|---|---|---|
| `captureLayer` | text | `AVFOUNDATION` (one word) | which capture layer delivered this microphone |
| `sampleContinuity` | text | `NOT_CONTINUOUS` (one word) | THE PATH IS NOT SAMPLE-CONTINUOUS. This key is THE ANCHOR the seal reads (section 8.4a): it is written in the INSERT of the session's start and the runtime role cannot update it (`sources.ts:132-134`; `CS/db/migrations/0016_capture_streams_audio_inputs_privileges.sql:46`) |
| `captureGroup` | whole number | 1 to 2 | the shared capture group of section 6.2: PRIMARY and STANDBY with the same number were captured by one process from one device |

Form: the statement of an adapter for one input (`AudioCardStatement`, `sources.ts:161-178`) gains three optional members of the same names; `micSourceFactsOf` (`:204-226`) puts each only when it is exactly one of the words above, or an integer 1 to 2 - a value outside is LEFT OUT, never repaired, as the builder does for every key. The column's rules are met without a change: the map stays flat (text and numbers only), holds no secret-looking key, and grows by under 80 bytes against a bound of 2,048 (`CS/db/migrations/0015_capture_streams_audio_inputs.sql:54-56`; `sources.ts:155`). HOW MUCH did not arrive is NOT a source fact: the row is written at the start (section R.2, last paragraph; confirmed as SM-40).

### 8.2 THE SHORTFALL IS MEASURED BY THE PRODUCT, per microphone, continuously (decisions U25 (3), C107)

WHERE: in the WORKER. It is the only part of the product through which the samples pass: the pipe goes from the helper to the worker (WF1); the Core reads no sample, and what the Core could read of the helper (its progress, its totals) follows timestamps and reads whole (MF10). The worker already has both numbers on its own clock and tells neither (WF3, WF5).

Revision 2's table follows for the record of what the addendum reviewed. It is SUPERSEDED by "REVISION 3 - THE WORKER'S REPORT, VERBATIM" below it: its counts began at each microphone's first sample and it held no discard (R3.2 rows 1, 2).

| Member | Where | Meaning | Bounds |
|---|---|---|---|
| `receivedSamples` | each entry of `levels` in `TELEMETRY` | samples read from this microphone's pipe since its first sample (cumulative) | whole number, 0 to 4,147,200,000 (one day at 48,000 Hz) |
| `timelineSamples` | the same | samples of the session's audio timeline since this microphone's first sample (cumulative): what a whole pipe would have delivered, by the worker's clock | the same |
| `nonZero` | the same | true once one sample of this microphone differed from zero (section 4.6) | boolean |
| record `MIC_SAMPLE_ACCOUNT` | a `RECORD` (not a level: it is not dropped) per microphone: `deviceId`, `role`, `receivedSamples`, `timelineSamples`, `insertedSamples` (the zeros the worker put in), `sampleRateHz` | written when the audio timeline ends and, so that a worker that is killed leaves a statement, every 60 s; cumulative, the Core keeps the last of each attempt | as above; `insertedSamples` at most `timelineSamples` |

REVISION 3 - THE WORKER'S REPORT, VERBATIM (row N1, `CP/index.ts`; protocol version 5; SM-29, SM-30, SM-31 (3), (5), SM-33 (4), (5)). "Whole number" is the package's `wholeNumber`. `DAY` = 4,147,200,000 (one day at 48,000 Hz). All counts are cumulative from SAMPLE 0 of the session's audio timeline (the worker's T0, `WK/audio.c:586-589`) and are whole numbers; none is a percentage and none is rounded.

(a) Three constants of the package, restated by the worker and held equal by the existing pin test (`CS/capture/__tests__/protocol-pins.test.ts`):

| Constant | Value | Meaning |
|---|---|---|
| `CAPTURE_MIC_ACCOUNT_PERIOD_SAMPLES` | 2,880,000 | an account every 60 s of the timeline |
| `CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES` | 4,800 | 100 ms: a run of this length or more carries its position (SM-30 (2), (4)) |
| `CAPTURE_AUDIO_INSERTED_RUNS_MAX` | 1,024 | the most runs listed per worker, that is per capture attempt (SM-30 (2)) |

(b) The input kind: `CaptureMicInputKind.PCM_FIFO_GAPPED = 'PCM_FIFO_GAPPED'`; the plan's microphone input (`CP/index.ts:567`) is one of two strict forms, `{ kind: 'PCM_FIFO', path }` or `{ kind: 'PCM_FIFO_GAPPED', path }`. Its statement: "the same bytes as `PCM_FIFO` (32-bit float, little-endian, mono, 48,000 Hz); the writer does NOT promise every sample; the worker neither resamples nor follows the writer's clock, and accounts for every sample".

(c) Each entry of `levels` in `TELEMETRY` (`CP/index.ts:672-674`) gains FOUR required members, sent for every microphone of every kind (the schema stays one, SM-33 (4)); `ratePpm` is null for a gapped microphone:

| Member | Type and bounds | Meaning |
|---|---|---|
| `timelineSamples` | whole number, 0 to `DAY` | samples of the audio timeline so far: what a whole pipe would have delivered by the worker's clock. The same number in both entries |
| `receivedSamples` | whole number, 0 to `DAY` | samples read from this microphone's pipe |
| `insertedSamples` | whole number, 0 to `DAY`, at most `timelineSamples` | zeros the worker put on this microphone's timeline (`missing`, `WK/audio.c:449`) |
| `nonZero` | boolean | true once one sample of this microphone, as read, was finite and not zero; never false again |

Why four and not the "three" the addendum counts (08b s5 (5)): the amount of a queue drop must be the growth of `insertedSamples` (SM-35 (1)), and the notices must measure what was INSERTED, not `timelineSamples` less `receivedSamples`, which a discard would falsify. Put to the controller with R3.3.

(d) The record `MIC_SAMPLE_ACCOUNT`, a new kind of `MIC_RECORD_KINDS` (`CP/index.ts:919`), a strict object. Written for a GAPPED microphone ONLY (a session without one gets no new record kind, SM-33 (4)): once per `CAPTURE_MIC_ACCOUNT_PERIOD_SAMPLES` and once more, with `closing` true, when the timeline ends, before `AUDIO_TIMELINE_END`. The Core keeps the LAST account of each microphone and attempt.

| Member | Type and bounds | Meaning |
|---|---|---|
| `kind` | the literal `MIC_SAMPLE_ACCOUNT` | - |
| `deviceId` | the microphone's device id, as in `AUDIO_SOURCE_INTERVAL` | - |
| `role` | `PRIMARY` or `STANDBY` | - |
| `closing` | boolean | true: THE CLOSING ACCOUNT, written with the end of the timeline; false: a periodic one (SM-29 (4)) |
| `sampleRateHz` | whole number above 0 (48,000) | the unit of every count |
| `timelineSamples` | whole number, 0 to `DAY`, a multiple of 480 | THE SAMPLE THE ACCOUNT REACHES: samples expected by the session's own clock from sample 0 to this account |
| `receivedSamples` | whole number, 0 to `DAY` | samples read from the pipe |
| `insertedSamples` | whole number, 0 to `timelineSamples` | zeros put on this microphone's timeline |
| `discardedSamples` | whole number, 0 to `receivedSamples` | received and NOT put on the timeline: the full buffer, the re-placement, the trim before sample 0 and, in the closing account, the buffer's rest (section 7.2a, places 3, 6, 11, 12) |
| `bufferedSamples` | whole number, 0 to 96,000 | received and still waiting at this account (the buffer holds two seconds, `WK/audio.c:87`); 0 in the closing account |
| `nonFiniteSamples` | whole number, 0 to `receivedSamples` | received as not a finite number and put on the timeline as zero; NOT part of `insertedSamples` (section 7.2a, place 2) |
| `fedSamples` | whole number, 0 to `timelineSamples` | samples of the track for which THIS microphone fed the encoder |
| `fedInsertedSamples` | whole number, at most `fedSamples` and at most `insertedSamples` | of those, the inserted ones. The sum over the microphones of an attempt is THE TRACK'S INSERTED TOTAL (SM-30 (1)) |
| `fedRuns` | whole number, 0 to `DAY` | runs of inserted samples on the track, of ANY length, that BEGAN while this microphone fed (SM-30 (3)) |
| `fedLongestRunSamples` | whole number, 0 to `timelineSamples` | the longest of them |
| `listedRuns` | whole number, 0 to 1,024 | of them, those written as `AUDIO_INSERTED_RUN` |
| `runsNotListed` | whole number, 0 to `DAY` | runs of 4,800 samples or more that were NOT written because 1,024 were already listed |
| `runsNotListedSamples` | whole number, 0 to `DAY` | the sum of their lengths |
| `openRunFromSample` | whole number, 0 to `DAY`, or null | the first sample of a run that began on this microphone, is 4,800 samples or longer and is STILL RUNNING at this account; null: none. Always null in the closing account |

Rules of the record (the schema's cross rules; the worker tests them before it writes): `timelineSamples` = `receivedSamples` - `discardedSamples` - `bufferedSamples` + `insertedSamples`; `closing` implies `bufferedSamples` = 0 and `openRunFromSample` = null; `listedRuns` + `runsNotListed` is at most `fedRuns`.

(e) The record `AUDIO_INSERTED_RUN`, a new kind of `MIC_RECORD_KINDS`, a strict object. Written when a run of `CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES` or more ENDS, and before any account that follows it:

| Member | Type and bounds | Meaning |
|---|---|---|
| `kind` | the literal `AUDIO_INSERTED_RUN` | - |
| `deviceId`, `role` | as above | the microphone that fed the encoder at the run's FIRST sample |
| `index` | whole number, 1 to 1,024, without a gap per worker | - |
| `fromSample` | whole number, 0 to `DAY` | the run's first sample on the counter of `AUDIO_SOURCE_INTERVAL.fromSample` (`CP/index.ts:859-863`): sample 0 is T0 and also the index in the PCM tap. Its time in the FILE is (`fromSample` + 1,024) / 48,000 s (`CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES`, `SH/api/capture.ts:73-82`) |
| `samples` | whole number, 4,800 to `DAY` | the run's length |
| `sampleRateHz` | whole number above 0 | - |

WHAT A RUN IS (the worker's rule, row N3). The track is what the one encoder is fed: in each quantum the samples of the microphone the selector passes (`cur_map`, `WK/audio.c:127`; a switch is applied at a quantum's edge, `:611`). A quantum of a microphone is zeros at its head, then samples, then zeros at its tail (section 7.2a, place 7). A RUN is a maximal row of consecutive TRACK samples that are inserted zeros of a gapped feeding microphone. It may cross a quantum's edge and it may cross a switch from one gapped microphone to the other; it belongs to the microphone that fed at its first sample. A sample fed by a microphone of kind `PCM_FIFO` ends a run and is never part of one. A replaced non-finite sample (place 2) is not "inserted" and ends a run - its place is not known once it is in the buffer; that is why it has a count of its own. When the bound of 1,024 is reached the FIRST 1,024 runs in timeline order are the listed ones and the rest are counted, with their sum: the list is never cut silently (SM-30 (2)).

Three checks of row N3 on these words, each with its consequence: (1) on the stand-in of section 9.2 ordinary running lists NO run; if it lists any, the threshold is raised and stated, the list is not dropped (SM-30 (4)); (2) on the same stand-in `receivedSamples` equals what the stand-in wrote and `insertedSamples` equals the timeline less that, to one quantum at each end, and with a whole pipe `insertedSamples` and `discardedSamples` read zero after the start (SM-29 (5)); (3) the largest account record fits the record body of 4,096 characters (`WK/ipc.c:151`) - about 560 by this revision's count, an estimate.

WHAT THE CORE DOES WITH THEM. It USES the telemetry members for the notices, and the records for the evidence, only for a microphone whose handle states the kind `PCM_FIFO_GAPPED`. The closing account's `timelineSamples` must EQUAL `AUDIO_TIMELINE_END.samples` of the same worker; if it does not, the Core keeps the account as NOT closed and says so in the error log - it never corrects a number. On Linux and in development no record of these kinds arrives, nothing is raised and nothing is written: section 8.4.

### 8.3 THE BOUND, and what the operator sees

Measured: the path delivers 90.10 to 90.52% over a minute and 89.4 to 91.8% over 3 to 10 s (MF7): a shortfall of 8.2 to 10.6%. A notice at every session would be noise; none at all would be a lie. So two notices, both advisory reasons of the shared closed list (WF8) on the microphone:

| Notice | When | What the operator reads | Why this way |
|---|---|---|---|
| `MIC_PATH_NOT_SAMPLE_CONTINUOUS` | ALWAYS on this path: at the pre-check and once per session at its start, on each microphone of kind `PCM_FIFO_GAPPED`; resolved when the session ends. Information, not a warning; it blocks nothing and needs no acknowledgement | "This microphone path does not deliver every sample (bench form of this Mac). Missing audio is replaced by silence; the amount is measured and recorded with the session." | the standing fact is said once, calmly, where the operator starts |
| `MIC_SAMPLES_SHORT_ABOVE_BOUND` | the shortfall of a microphone over a window of 10 s is ABOVE 12.0% (received below 88.0% of the timeline) in TWO windows in a row; cleared after two windows at or below 11.0%. Recommended as a warning; whether the advisory list can carry a level above information (it has one level today, `CS/capture/forwarder.ts:81`) is the contract step's | "The microphone is losing more audio than this path normally does." with the measured percentage | 12.0% is 1.4 points above the worst of the 31 normal captures (89.39%, MM3 s5 capture 13) and is tripped at once by the faults that matter: a helper in a background class delivers 11 to 27% (MF12), a stalled reader drops whole seconds (MF16). Ten seconds is the window the measurements used; two in a row keep one bad window from raising it |

The bound is a constant of the Core beside the existing rate limit (`CS/capture/forwarder.ts:185`), not a setting. It is a bound for THIS path as measured on this interface: a statement of the README, not a promise for another device.

What the evidence states does NOT depend on the bound: every session of this path states its measured numbers, also when they are ordinary, also when they are zero (U25 (3): "if MM3 finds a lossless arrangement ... the statement then reads zero").

REVISION 3 - THE NOTICES, VERBATIM (SM-32, SM-34 (2), SM-30 (5); decision C110, ruling (2): "the 12.0% bound stays as a FLOOR and the notice also compares with the session's own running level"). FIVE members join the closed list `CaptureAdvisoryReason` (`SH/sim/capture-notices.ts:81-87`), each of device kind `MIC` (`:91-97`). The two rows of the table above stay; their tests and sentences are the ones below.

THE MEASURE. A WINDOW is 480,000 samples of the timeline (10 s), cut by the Core from the telemetry of section 8.2: it ends at the first telemetry whose `timelineSamples` is 480,000 or more past the window's start. Its SHORTFALL is the growth of `insertedSamples` over the growth of `timelineSamples`, kept as a whole number of parts per 100,000 (rounded down; 12.0% is 12,000). Cumulative counts make a dropped telemetry line harmless. Windows are per microphone and per capture attempt.

| Reason | Level the operator reads | Raised | Cleared | What the operator reads |
|---|---|---|---|---|
| `MIC_PATH_NOT_SAMPLE_CONTINUOUS` | information | AT THE START: at every pre-check and once per session at its start, on each microphone of kind `PCM_FIFO_GAPPED` (SM-37 (3)) | when the session ends | "This microphone path does not deliver every sample (bench form of this Mac). Sound that did not arrive is not in the recording. Silence of the same total length was inserted by the recorder; its places are not the places of the missing sound. The amount is measured and recorded with the session." |
| `MIC_SAMPLES_SHORT_ABOVE_BOUND` | WARNING | THE FLOOR: the shortfall is above 12,000 in TWO windows in a row | two windows in a row at or below 11,000 | "The microphone is losing more audio than this path may: <p>% of the last 10 seconds was inserted silence (bound 12.0%)." |
| `MIC_SAMPLES_SHORT_ABOVE_SESSION_LEVEL` | WARNING | THE SESSION'S OWN LEVEL: the shortfall is more than the MARGIN of 1,500 (1.5 points) above the attempt's REFERENCE in TWO windows in a row | two windows in a row at or below the reference plus 1,000 | "The microphone is losing more audio than at the start of this session: <p>% of the last 10 seconds was inserted silence (this session's level: <r>%)." |
| `MIC_SILENCE_RUN_INSERTED` | WARNING | A LONG RUN, at once: an `AUDIO_INSERTED_RUN` record arrives, or an account states an `openRunFromSample` (SM-32 (3)) | at the next window without a new run | "Silence of <ms> ms was inserted into the recording in one piece: no audio arrived from the microphone in that time." |
| `STANDBY_ON_PRIMARY_DEVICE` | information | section 6.2 | section 6.2 | the sentence of section 6.2 |

THE REFERENCE (SM-32 (2)): the median of the shortfalls of the FIRST SIX complete windows of the attempt (the middle of six is the mean of the third and the fourth, rounded down). It is FIXED for the attempt - a running median would follow a slow worsening and never trip. It is held to the floor: a reference above 12,000 is taken as 12,000, and the floor's notice is up anyway. Until six windows are complete only the floor and the long run are tested.

THE MARGIN: 1.5 POINTS, PROPOSED FROM THE MEASUREMENTS. The addendum names 2.0 "to be confirmed or changed" on row N15's report (SM-32 (4)); the controller asked this revision to propose the figure from the numbers.

| What was measured | Shortfall | Source |
|---|---|---|
| three captures of 60 s in the product's form, the scale of the REFERENCE | 9.476%, 9.902%, 9.671% (533, 557, 544 gaps of 512 samples a minute): a spread of 0.43 points | MM3 s8.1, captures 30 to 32 |
| twenty captures of 10 s that ran the helper without a background class, the scale of a WINDOW | 8.747% to 10.613% (82 to 100 gaps): a spread of 1.87 points; their median is 9.76% | MM3 s4, s5, s6: captures 1, 3 to 7, 9 to 16, 18, 20 to 22, 24, 25, this revision's selection from the three tables (left out: 8, 17, 19, whose counts MM3 marks as altered by the option tried; 23, 36, 37 in a background class; 2, refused). MM3 s6 itself speaks of 21 such captures without listing them |
| the largest 10 s shortfall above that median | 0.85 points (10.613 against 9.760) | computed from the same rows |
| the largest 10 s shortfall above the LOWEST 60 s level - the worst pairing a fixed reference could meet in these numbers | 1.14 points (10.613 against 9.476) | computed from the two rows above |

So: 1.5 points stands 0.36 above the worst pairing of ordinary numbers that was measured, and it needs two windows in a row; no two of the measured windows would have tripped it. In samples it is 7,200 of a window's 480,000, about 14 lost packets of 512 more than the session's own count for 10 s. What it buys over the floor alone: a session whose level is 9.5 to 9.9% is told of a further standing loss at 11.0 to 11.4% - the floor alone lets 2.1 to 2.5 points more pass for the whole session. Why not the addendum's 2.0: at 2.0 the same session trips at 11.5 to 11.9%, which is the floor itself to within half a point. Why not 1.0: it is inside the measured spread of ordinary windows (1.14) and would raise the notice in ordinary sessions - "a notice that fires in every ordinary session is as dishonest as none" (SM-32 (4)). LIMITS of the proposal: the measured windows are separate captures of one afternoon on one interface at a load of 3.77 to 7.72 (MM3 s6), counted at the helper's output, not six consecutive windows of one session counted by the worker; the worker's own window adds at most one quantum (480 samples, 0.1 point) at each edge; the watch's listing every 5,000 ms was not running in any of them (08b HB-5). Row N15 measures a session of at least 30 minutes WITH THE WATCH RUNNING, reports how often each of the three tests tripped, and the three figures (12.0, 1.5, six windows) are confirmed or changed on that report. They are constants of the Core beside the existing one (`CS/capture/forwarder.ts:185`), not settings.

THE FIXED SENTENCE (SM-30 (5)), the only wording for where the silence stands, in every document, notice, screen and comment: "Sound that did not arrive is not in the recording. Silence of the same total length was inserted by the recorder; its places are not the places of the missing sound." No text says the silence stands at or near the missing sound.

THE LEVEL: the advisory list has one level today (`CS/capture/forwarder.ts:81`). The three WARNING rows need a second one; whether the list can carry it, or the three are raised through the level the list has with the word in their sentence, is the contract row's to settle (SM-32 (5)). The signed numbers depend on none of this.

### 8.4 THE EVIDENCE: two audit types and one optional signed manifest member, in the form of rows 191b / 191c, R1b and P1

Revision 3 replaces the words of revision 2 in this section (one audit type of six details; a member of six fields 139 to 144): they held no discard, no closed mark, no capture group and no position (R3.2 row 5). `DAY` = 4,147,200,000. The names of the numbers are those of the worker's records (section 8.2), so that one name means one thing from the worker to the signature.

THE AUDIT TYPE `CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED` - THE ACCOUNT (category DEVICE, severity WARNING, actor null; the microphone in the row's device column, as row 191b put it, `implementation/191b_audio_gap_in_evidence.md` section 3; label "Audio samples not received from a microphone"). Written by the capture session ONCE per microphone whose source row carries `sampleContinuity` and per capture attempt, when that attempt's audio ends - with the worker's closing account, or, when the worker went down without one, with the last periodic account it left, or with none - in one engine unit with the closing of the audio interval (the pattern of `recordAudioGap`, row 191b). Its CLOSED detail list (the form of `CS/core/audit-details.ts:653-659`; every value a text or a number, because an audit detail list is flat, `CS/db/migrations/0001_tables.sql:198`):

| Detail | Required | Form |
|---|---|---|
| `sessionId` | yes | a session id |
| `attempt` | yes | the number of the capture attempt, 1 or more |
| `captureLayer` | yes | one of `AVFOUNDATION` |
| `captureGroup` | yes | 1 to 2 (section 6.2) |
| `account` | yes | THE CLOSED MARK (SM-29 (4)), one of: `CLOSED` - the worker's closing account, it reaches the end of the track; `NOT_CLOSED` - the last periodic account of a worker that did not end its timeline, it reaches `timelineSamples` and the track goes on after it; `NONE` - the worker left no account, nothing was measured |
| `openRetries` | yes | 0 to 1: the retries of the open of this microphone's helper in this attempt (section 4.7; SM-39 (1)) |
| `timelineSamples` | no | 0 to `DAY` |
| `receivedSamples` | no | 0 to `DAY` |
| `insertedSamples` | no | 0 to `DAY` |
| `discardedSamples` | no | 0 to `DAY` |
| `bufferedSamples` | no | 0 to 96,000 |
| `nonFiniteSamples` | no | 0 to `DAY` |
| `fedSamples` | no | 0 to `DAY` |
| `fedInsertedSamples` | no | 0 to `DAY` |
| `fedRuns` | no | 0 to `DAY` |
| `fedLongestRunSamples` | no | 0 to `DAY` |
| `listedRuns` | no | 0 to 1,024 |
| `runsNotListed` | no | 0 to `DAY` |
| `runsNotListedSamples` | no | 0 to `DAY` |
| `openRunFromSample` | no | 0 to `DAY`; present only when the account states one |

The thirteen numbers from `timelineSamples` to `runsNotListedSamples` are ALL present (`account` `CLOSED` or `NOT_CLOSED`) or ALL absent (`NONE`); the writer builds the row so and the seal's reader refuses any other form. A row with `NONE` says that the path is not sample-continuous and that the amount was not measured - the rule of row 191b for an unknown bound. No device text, no card text, no file name, no percentage (a reader computes it; whole numbers cannot be rounded wrongly).

THE AUDIT TYPE `CAPTURE_AUDIO_SILENCE_INSERTED` - ONE LISTED RUN (DEVICE, WARNING, actor null; the device column holds the microphone that fed at the run's first sample; label "Silence inserted into the audio track"). A second type, because a flat detail list cannot hold a list (R3.3 row 3), and a required key of one type cannot be relaxed for a second kind of row (the reason the connection-test type of row V3 gives for being "a type of its own", `CS/core/audit-details.ts:663-666`). Written by the capture session when the worker's `AUDIO_INSERTED_RUN` record ARRIVES, not at the end: the runs of a worker that is killed later are already in the chain. All five details are required:

| Detail | Form |
|---|---|
| `sessionId` | a session id |
| `attempt` | 1 or more |
| `index` | 1 to 1,024, the worker's number of the run |
| `fromSample` | 0 to `DAY`: the first sample of the run on the track's own timeline (sample 0 is T0) |
| `samples` | 4,800 to `DAY`: its length |

THE OPTIONAL SIGNED MANIFEST MEMBER `audio.samplesNotReceived` (fields 139 to 158, the fourth entry of `MANIFEST_V2_OPTIONAL_FIELDS`, `SH/evidence-package/manifest.ts:809-829`; the last field in use is 138). A list of at least one strict record (it has no bound of its own: at most two records per capture attempt; whether the manifest as a whole has a size bound that 1,024 runs of about 45 characters each could meet was NOT looked up - row N2 checks it before the bound of 1,024 is pinned): one for every microphone whose source row carries `sampleContinuity` and every capture attempt of the session, in the order attempt ascending, then `micDeviceId` ascending. THE SOUND OF THE PACKAGE IS THE AUDIO OF THE HIGHEST ATTEMPT (an earlier attempt is stated 0..0 in `audio.sourceIntervals`, row 191b); a record of an earlier attempt states what that worker measured before it was replaced.

| Field | Member | Type, closed set, bounds, unit |
|---|---|---|
| 139 | `micDeviceId` | the registry id of the microphone (the form of `audio.sourceIntervals[].micDeviceId`, field 56) |
| 140 | `attempt` | whole number, 1 or more |
| 141 | `captureLayer` | the closed list `['AVFOUNDATION']` |
| 142 | `captureGroup` | whole number, 1 to 2: THE SHARED CAPTURE GROUP. Records of one attempt with the same number were captured by one process from one device (SM-34 (3)) |
| 143 | `account` | the closed list `['CLOSED', 'NOT_CLOSED', 'NONE']`, as in the audit row |
| 144 | `timelineSamples` | samples, 0 to `DAY`, or null. SAMPLES EXPECTED BY THE SESSION'S OWN CLOCK from sample 0 to the account. With `CLOSED` it is the length of the track |
| 145 | `receivedSamples` | samples, 0 to `DAY`, or null: SAMPLES RECEIVED |
| 146 | `insertedSamples` | samples, 0 to field 144, or null: ZEROS INSERTED on this microphone's timeline |
| 147 | `discardedSamples` | samples, 0 to field 145, or null: SAMPLES DISCARDED (received, not in the track) |
| 148 | `bufferedSamples` | samples, 0 to 96,000, or null: received and still waiting at a `NOT_CLOSED` account; 0 with `CLOSED` |
| 149 | `nonFiniteSamples` | samples, 0 to field 145, or null: received as not a number and written as zero; not part of field 146 |
| 150 | `fedSamples` | samples, 0 to field 144, or null: the part of the track this microphone fed |
| 151 | `fedInsertedSamples` | samples, at most fields 150 and 146, or null: the inserted zeros IN THE TRACK from this microphone. Their sum over the records of an attempt is the track's inserted total (SM-30 (1)) |
| 152 | `fedRuns` | a count, 0 to `DAY`, or null: runs of inserted zeros in the track, of any length, that began on this microphone (SM-30 (3)) |
| 153 | `fedLongestRunSamples` | samples, 0 to field 144, or null: the longest of them |
| 154 | `runsNotListed` | a count, 0 to `DAY`, or null: runs of 4,800 samples or more that are NOT in the list below because the attempt's bound was reached. 0 says: every such run is listed |
| 155 | `runsNotListedSamples` | samples, 0 to `DAY`, or null: the sum of their lengths |
| 156 | `openRunFromSample` | a sample position, 0 to `DAY`, or null: a run of 4,800 samples or more that was still running at a `NOT_CLOSED` account; its end was not measured |
| 157 | `insertedRuns[].fromSample` | a sample position, 0 to `DAY`: THE START of a listed run on the track's own timeline, where sample 0 is the first sample of the track's sound; its time in the file is (`fromSample` + 1,024) / 48,000 s (`SH/api/capture.ts:73-82`) |
| 158 | `insertedRuns[].samples` | samples, 4,800 to `DAY`: THE LENGTH of the run |

`insertedRuns` is optional inside a record; when present it is a list of at least one and at most 1,024 strict records of the two members above, in ascending `fromSample`. THE STATED MAXIMUM is 1,024 runs per ATTEMPT, over the records of that attempt together. WHAT IS STATED WHEN A SESSION EXCEEDS IT: the first 1,024 runs in timeline order are listed, and fields 154 and 155 state how many more there were and how many samples they hold - a count of the runs not listed, never silence about them.

HOW THE ACCOUNT RECONCILES, TO THE SAMPLE (rules of the member, checked by its schema at the seal and again by every verifier, V-01):

1. `account` is `NONE` exactly when fields 144 to 155 are all null; then field 156 is null and there is no `insertedRuns`. Otherwise fields 144 to 155 are all numbers.
2. THE IDENTITY: field 144 = field 145 - field 147 - field 148 + field 146.
3. `CLOSED` implies field 148 = 0 and field 156 = null. So for a closed account: EXPECTED = RECEIVED + INSERTED - DISCARDED, and EXPECTED is the track's length in samples (section 7.2a).
4. Two `CLOSED` records of one attempt state the same field 144.
5. The runs of an attempt do not overlap, each ends at or before the largest field 144 of the attempt, and the sum of their lengths plus field 155 is at most the sum of fields 151 of the attempt.
6. As the precedents have it: an EMPTY list is refused, so "none" has one form and one digest; a pair (`micDeviceId`, `attempt`) stands once; never beside `demo` or an integrity other than `REAL`; when present the member is inside the digest and under the signature. And one rule more, because `AVFOUNDATION` is a capture layer of one platform: the member stands only in a manifest that also carries `hostProfileNotAsked` (field 133).

What ABSENCE of the member means is stated at the member and is no claim in the Core's favour: "this manifest states no measured shortfall" - never "the audio is complete" (SM-36 (5)).

What the member does NOT make checkable: a verifier cannot count the samples of the sealed, encrypted track against field 144; it checks that the statement is whole and consistent with itself. That field 144 of a closing account equals the samples the encoder was fed is held where it can be: by the worker (the identity, before it writes), and by the Core against `AUDIO_TIMELINE_END.samples` when the record arrives (section 8.2, last paragraph).

WHERE THE NUMBERS COME FROM: the seal's reader already reads the audit rows of the session once (`READ_SEAL_AUDIT_ROWS`, `CS/sealing-host/session-reader.ts:85-86`); a new function takes the rows of the two types out of the same read, exactly as `audioRestartGapsOf` (`:390`) and `videoAbsencesOf` (`:443`) do (`implementation/191c_signed_audio_gap.md` section 2; `r1b_video_absence_signed.md` section 1). No second statement on the audit log, no stored field, no schema, no grant. A malformed row stops the seal's read (row 191c, driver decision 2), and so does an account row whose `listedRuns` is not the number of run rows of its microphone and attempt. WHERE THE PRESENCE COMES FROM is another read: section 8.4a.

ABSENT ON LINUX AND IN DEVELOPMENT: no microphone there states the kind `PCM_FIFO_GAPPED`, so no row of the type is written and the member has no key. A package sealed there, before or after, has the same bytes, the same digest and the same verdict. The build row PROVES it with the instrument of row 191c (two fixture sessions sealed before and after: manifest and signature identical by `cmp`), as rows 191c and P1 did. A verifier that predates the member refuses a package that carries it (strict), which is the safe side; such a package can only come from this Mac.

PRESENT ON THIS MAC, ALWAYS: every production session whose microphones are of this path carries the member, with the numbers of each microphone and attempt - about one sample in ten missing by the measurements (MF7), zero if the path is ever whole. Revision 3: this is a RULE OF THE SEAL with a named refusal, not an expectation (section 8.4a).

### 8.4a THE SEAL'S REFUSAL, THE VERDICT LINES AND THE EXPORT (revision 3; decision C110, ruling (8); SM-36, SM-37)

THE ANCHOR (SM-36 (1)). The seal decides that a session is of this path from ONE stored fact: the key `sampleContinuity` = `NOT_CONTINUOUS` in the `source_facts` of a microphone row of `session_capture_sources`. That row is written in the INSERT of the session's start and the runtime role cannot update the column (`CS/db/migrations/0016_capture_streams_audio_inputs_privileges.sql:46`), so no later fault, restart or missing audit row can remove it. The seal's reader reads those rows already, but not that column: `READ_SEAL_SOURCE_ROWS` selects `slot, device_id, adapter_kind, recorded_at` (`CS/sealing-host/session-reader.ts:83`). Row N12 adds `source_facts` to that one statement's column list. The runtime role's SELECT on the table covers the column (`0009_capture_sources_privileges.sql:16`; `0016`, lines 43 to 44): no grant, no schema, no new statement.

WHAT THE READER BUILDS (SM-36 (2), (4)). Let M be the microphone rows that carry the key, and A the highest capture attempt the stored entries name (the account rows' `attempt` and the restart entries' `laterAttempt`, as `videoAbsencesOf` finds it, `session-reader.ts:464`; 1 when none names one).

| Case | The reader hands the pipeline |
|---|---|
| M is empty | NO member and no anchor. A package of a Linux or development session has the bytes it had (the byte-identity proof of section 8.4) |
| M is empty and an account or run row of the session exists | the read THROWS: a statement without its anchor is not signed |
| for a microphone of M and an attempt 1 to A an account row exists | the record with that row's values and its run rows as `insertedRuns` |
| for a microphone of M and an attempt 1 to A NO account row exists (the Core ended before it wrote one; the worker left no account and the row was never written) | the record WITH NULL NUMBERS: `account` `NONE`, `captureLayer` and `captureGroup` from the SOURCE FACTS - "not sample-continuous; the amount was not measured" - never left out |

Two members of the seal's facts (`SealSessionFacts`, `CS/sealing/pipeline/contract.ts:392`), each present only when M is not empty, both part of the frozen input of BUILD_MANIFEST as their precedents are (row 191c section 3): `audioSamplesNotReceived` (the records) and `micsNotSampleContinuous` (the device ids of M).

THE REFUSAL (SM-36 (3)). The pipeline holds the rule itself, in the place and the manner in which it refuses a development key for production sources (`CS/sealing/pipeline/pipeline.ts:814`; `contract.ts:102-107`): before the manifest is built, if `micsNotSampleContinuous` names a microphone for which `audioSamplesNotReceived` holds no record, or records are handed in without the anchor, the seal STOPS with the new member of `SealingFailure`

```
AUDIO_SHORTFALL_NOT_STATED: 'AUDIO_SHORTFALL_NOT_STATED'
```

"A microphone of this session is recorded as not sample-continuous and the package would not state its shortfall: nothing is sealed or signed." Not in the list of failures a later run may get past (`contract.ts:128`): no retry makes the statement appear. Its detail is the microphone's device id and nothing else. `SealingFailure` is the Core's list, not a member of the shared package (`contract.ts:75-125`); its sentence joins the switch at `contract.ts:278`. With the reader's rule above the refusal cannot be reached by a healthy Core; it is the second lock, and its test hands the pipeline facts with the anchor and without the record.

What this does NOT give, stated: a verifier cannot tell from a package alone that the member is MISSING. The signed manifest names a source's class, not its adapter or its capture layer (`SH/evidence-package/manifest.ts:214`, `:240`), so a package without the member reads like a Linux package (08b s13, "may not conclude" 8). The seal is the one place the rule can be held; that is why it is a gate. PUT TO THE CONTROLLER, NOT WRITTEN INTO A ROW: a rule of the manifest's schema, "`hostProfileNotAsked.platform` `darwin` together with a microphone interval of class PRODUCTION requires `audio.samplesNotReceived`", would let EVERY verifier refuse such a package. It holds as long as every production microphone on `darwin` is of this path (row N10 builds no other). It changes what row P1's fixtures must carry (`implementation/p1_production_platforms.md` section 6) and is therefore the controller's to take.

THE VERDICT LINES (SM-37 (1); row N17, words in the contract step N2). The pattern exists three times: a member of `VERIFY_NOTICE` and a report function that is "the wording source", raised from the manifest the verifier READ, failing nothing and changing no verdict (`SH/evidence-verify/types.ts:417-421`, `:498`, `:554`; `verify.ts:1115-1123`), carried by the receiver's result only from a sealed manifest it relied on and printed by its command before the verdict (`CS/evidence-export/receiver-verify.ts:94`, `:102`, `:247-249`; `receiver-cli.ts:121-126`). The audio twin for `audio.absentOnRestart` is in the working tree from pass I-9b (`types.ts:420-421`, `:554`); that pass has no record yet (`delegation_progress/file_claims.md:244`), so its form was read from the code only. This path adds TWO notices, because one line of 256 characters cannot hold both statements at their largest numbers (R3.3 row 4). Each cannot be switched off, as its precedents cannot. The host statement is NOT repeated: it is its own notice already (`HOST_PROFILE_NOT_ASKED`).

| Notice | Raised when | The line (numbers of the HIGHEST attempt; `<Y>` = field 144, `<Z>` = the sum of fields 151, `<X>` = `<Y>` - `<Z>`, `<N>` = listed runs, `<R>` = the sum of fields 154, `<L>` = the largest field 153) |
|---|---|---|
| `AUDIO_SAMPLES_NOT_RECEIVED` | the manifest carries `audio.samplesNotReceived` | "Audio: NOT SAMPLE-CONTINUOUS (bench capture path of a Mac). `<X>` of `<Y>` samples of the track arrived; `<Z>` are inserted silence, not sound (runs of 100 ms or more: `<N>` listed, `<R>` not listed, longest `<L>` samples)." |
| the same, an account `NOT_CLOSED` | - | the numbers as above, and in the place of the last sentence's end: "... Measured up to sample `<Y>` only; the rest of the track was NOT MEASURED." |
| the same, every account of the highest attempt `NONE` | - | "Audio: NOT SAMPLE-CONTINUOUS (bench capture path of a Mac). How much sound did not arrive was NOT MEASURED." |
| `AUDIO_ONE_CAPTURE_GROUP` | two records of the highest attempt state the same `captureGroup` | "Audio: PRIMARY and STANDBY were channels of ONE device recorded by ONE capture program. A switch between them was not a switch to an independent source." |

By this revision's count the first line is about 240 characters at the largest numbers - an estimate; the contract row tests it at the bounds and, if it does not fit, shortens WORDS, never drops a number. The verdict on integrity stays what it is: a package can be untouched and its audio incomplete, and the reader is told both. A verifier older than the member refuses the package (the schema is strict): the safe side, kept (SM-37 (4)).

THE EXPORT (SM-37 (2); row N17). The export's manifest repeats one signed mark of the sealed manifest under the export signature today, `sessionManifest.developmentSources` (`CS/evidence-export/export-manifest.ts:81-82`). It gains, in the same block and in the same way, the OPTIONAL member `audioNotSampleContinuous`, the literal `true`, present exactly when the sealed manifest carries `audio.samplesNotReceived` and absent otherwise - so an export of any other package has the bytes it had. The same two lines stand in every form in which a session leaves the Core: the package's human-readable summary, an audio-only export, a clip. Where those forms are made was NOT read by this revision: the row finds them first and lists each in its record.

THE WORDS OF THE PRODUCT (SM-37 (3)): no screen, document, log line or report calls a session of this path "complete audio", "fit to record", "hardened" or "production-grade". `REAL_PRODUCTION` remains the name of the mode (U21); it is not a statement about the audio.

What the evidence of a session of this path therefore says, in one place each: the HOST is this Mac and its host profile was not asked (`hostProfileNotAsked`, signed); the MICROPHONES are two inputs of one device (source facts); the AUDIO PATH is not sample-continuous (`sampleContinuity`, source facts; `captureLayer`, signed); HOW MUCH did not arrive and how much silence the worker inserted (`audio.samplesNotReceived`, signed; the audit row in the extract); and, when the worker was replaced, how long no audio was recorded at all (`audio.absentOnRestart`, signed, row 191c).

### 8.5 What the evidence does NOT state, and the documents must

Not stated by any member: WHERE in the track the missing sound is - revision 3: the member states where the INSERTED SILENCE of 100 ms or more stands, and the places of the inserted silence are not the places of the missing sound (the fixed sentence of section 8.3; revision 2's "near the holes" is struck); where the inserted runs SHORTER than 100 ms stand (they are counted, with the longest, fields 152 and 153); that no other program read or changed the microphone (review SM-17). What a reader of a sealed package may and may not conclude about its audio is the addendum's section 13 (08b s13), which the README and the installer note take over word for word once rows N3, N11, N12 and N17 are built. Revision 2 said here that the verdict lines do not show the optional members: that is overtaken (section 8.4a).

### 8.6 THE TRANSCRIPT (revision 3; decision C110, ruling (2): "a transcript made from such audio CARRIES the statement"; SM-38; row N18)

What a transcript is today, read in the code:

| Form | Where | Members that matter here |
|---|---|---|
| The SEALED machine document `dems.transcript/1` | `apps/transcriber/src/pipeline/document.ts:1-39`, `:88-131` | exactly five members: `header`, `segments[]`, `speaker_state`, `intervals[]`, `qa_flags[]`. A segment is a strict object of exactly five members (`index`, `start_ms`, `end_ms`, `text`, `speaker`, `:107-115`); its text is the engine's, "byte for byte". `qa_flags` is a list of texts, sorted and unique (`:118`, `:130`); three flags exist (`pipeline/constants.ts:43-50`) and one more text (`:75`). The document's SHA-256 is manifest field 81 (`:28-29`) |
| Its renderings, SRT and WebVTT | `document.ts:226-235` | pure functions of the document, each with its own hash (fields 82, 83); a labelled segment's cue already begins with a mark that is not engine text, `[A] ` |
| What a client is given, operation 84 | `SH/api/evidence.ts:387-415` | a strict object: `documentVersion`, `language`, `speakerState`, `segments`, `sha256`, `machineTranscriptHash`, `assembledAt`, `revision`. It carries NO flag of the document at all |
| A revision | `SH/api/evidence.ts:419-473`; `SH/evidence-verify/revisions.ts:29-53` | corrections of a segment's text by its index, signed; it never changes the sealed document |
| Where the document's session facts come from | `CS/transcription/index.ts:244`, `:262`, `:438-441` | the Core reads the session's interval rows and hands them in; row 191c made this read follow the seal's rule so that document and manifest agree (`implementation/191c_signed_audio_gap.md` sections 3, 8) |

WHAT A TRANSCRIPT OF A SESSION OF THIS PATH CARRIES:

(1) IN THE SEALED DOCUMENT - in the form it already has, NO new member and no new version. Three flag texts in `qa_flags`:

| Flag text | Present | Says |
|---|---|---|
| `audio_not_sample_continuous` | exactly when a microphone row of the session carries `sampleContinuity` | THE STATEMENT: the audio this text was made from is not sample-continuous |
| `inserted_silence:<from_ms>:<length_ms>` | once for each LISTED run of the highest attempt | a run of inserted silence: both numbers are whole milliseconds of the sealed file's media time - the clock of `start_ms` and `end_ms` - each written with nine digits and leading zeros, so that the list's own sort order is the order of time. `from_ms` is (`fromSample` + 1,024) x 1,000 / 48,000 rounded DOWN, the end is rounded UP |
| `inserted_silence_not_listed:<count>` | when a record of the highest attempt states `runsNotListed` above 0 | runs that have no position |

At most 1,026 flags more, each under 48 characters. THE MARK ON A SEGMENT is DERIVED and not stored: segment i is marked when a flag of the second form overlaps it, that is `from_ms` is below the segment's `end_ms` and `from_ms` + `length_ms` is above its `start_ms`; the marked length is the overlap in milliseconds. One pure function of the document, in the file of the document, gives it; the renderings and the Core's answer use that one function.

(2) IN THE RENDERINGS (SRT, WebVTT): the cue of a marked segment begins with `[inserted silence <n> ms] `, before the speaker mark - the same kind of mark as `[A] `, and never inside the engine's text. The WebVTT rendering carries the fixed sentence of section 8.3 as a `NOTE` block at its head; SRT has no place for a note, so the sentence is in what is shown beside it. A document without the flags renders to the bytes it renders to today (the row proves it on the committed fixtures).

(3) IN WHAT A CLIENT IS GIVEN (operation 84) - TWO MEMBERS ARE NEEDED, because that answer carries no flag today. Named, both optional and absent for every other transcript, both words of the one contract step (row N2):

| Member | On | Type | Meaning |
|---|---|---|---|
| `audioNotSampleContinuous` | `TranscriptDocumentSchema` (`SH/api/evidence.ts:402`) | a strict object: `arrivedSamples`, `trackSamples`, `insertedSamples` (each a whole number or null), `listedRuns`, `runsNotListed` (whole numbers) | THE STATEMENT AT THE HEAD, with the numbers of the verdict line of section 8.4a. A client shows the fixed sentence of section 8.3 with them, and never collapses it |
| `insertedSilenceMs` | `TranscriptSegmentSchema` (`SH/api/evidence.ts:387`) | a whole number above 0 | THE MARK ON THE SEGMENT: this many milliseconds of the segment are inserted silence listed in the package |

These two are read from the SIGNED manifest of the evidence item when the answer is made (SM-38 (3)): the item is sealed by then. The same holds for an audio-only export, a clip and every other product made from the audio later (SM-38 (1)).

WHERE THE SEALED DOCUMENT TAKES IT FROM, and why not "from the signed member" (R3.3 row 1). The document is finished BEFORE the manifest that holds its hash is signed. So it is given the statement the way it is given its intervals: the Core reads the session's source rows and audit rows and hands the transcriber the list of listed runs and the two facts, through the SAME function the seal's reader uses for the member (the precedent of row 191c: one rule, so that the two cannot differ). AND THE SEAL CHECKS IT: when the seal's facts hold `audioSamplesNotReceived` and the session has a transcript document, the flags the member implies must be exactly the flags of those three forms in the document; if not, the seal stops with the existing failure `TRANSCRIPT_STEP_FAILED` (`CS/sealing/pipeline/contract.ts:94-95`; it is one a later run may get past, `:128`, which fits: a document assembled again can agree) and the detail `AUDIO_STATEMENT_DIFFERS`. A package whose transcript says less about the audio than its manifest is never signed.

WHAT CANNOT BE BUILT AS THE ADDENDUM WORDS IT (R3.3 row 2): "text is never joined across" a run. Segments are the engine's; one segment whose text spans three seconds of inserted silence cannot be cut in two without inventing where the words fall. It is MARKED, with the length. What the product does guarantee: no rendering and no screen joins TWO segments into one line or paragraph across a listed run.

NOT VERIFIED by this revision, for row N18 before its first edit: (a) that the account and run rows of the last attempt are written before the document is assembled - the order of the capture's end, the transcript's last chunk and the seal's `FINALIZE_TRANSCRIPT` step was not read; if a document can be assembled first, the document is assembled again or the seal's check above refuses; (b) whether any reader holds `qa_flags` to a closed list: the two schemas read admit any text (`document.ts:118`; `CS/sealing/finalize-transcript/document.ts:61`), no other reader was looked at; (c) what `apps/transcriber` does with a stretch of exact zeros of three seconds - a mark is owed whatever it does.

UNTIL ROW N18 EXISTS (SM-38 (4)): the README says that a transcript of a session recorded on this Mac does not show what the audio lost.

## 9. Point 8 - TESTING without touching a real microphone

### 9.1 Listing-text fixtures (agents; no device)

Synthetic texts only - made-up names, serials and locations, in the three forms of 2.3. Cases: one device with two inputs; one with six; two devices of different names; two same-model devices (undecided, `NAME_SHARED`); a device with and without a serial; a device moved to another socket; a USB output-only device (audio interface in L1, no input in L2); a device present in L1 and absent from L2 or L3 (M9: `NO_SYSTEM_INPUT`, never "no card"); a product string with a line break, a quote, a tag mark, a non-ASCII letter, 65 characters; a repeated key in a node; a header location that differs from `locationID`; an L3 list with a repeated index; a cut last line in each text; each text one byte over its bound; a rate of 96,000 (`AUDIO_CARD_RATE_UNSUPPORTED`).

Revision 2: the fixtures of the USB tree are in the PROPERTY-LIST form (2.3), so the text-form cases above (a repeated key, a header location) become their typed twins: a key of another type, a location that differs from `IORegistryEntryLocation`, a location stated by two devices, a document type or an entity in the text, a child without interface keys, a product string that holds a quote, a line break and the text of a forged header (it must stay ONE string). Added from the review (SM-25): lists that disagree in either direction; a built-in, an aggregate, a virtual and a wireless item under the USB unit's name; a USB item with no device in the tree; a count or a rate as a float and as a string; an empty system list beside an audio device in the tree; a failed USB tree row; a name with a locator; a video section before the audio section in the helper's list (MF3).

### 9.2 Stand-in programs (agents; no device)

- Listing stand-ins: three small programs that print a fixture and end (the existing test seam `program?:` of the runner, `production-parts.ts:327-328`, widened to three).
- A capture stand-in in the place of the helper: it checks that its argument list IS the macOS row of section 4.2 with one or two output sections (exits non-zero otherwise), prints the stream line on standard error, and writes a generated signal as 32-bit float mono 48,000 Hz into each pipe argument IN THE MEASURED PATTERN: packets of 512 samples about every 11.9 ms, one packet in ten left out (MF7, MF8). Modes by fixture, never by an argument from data: ends at once; ends with status 251 and the refusal line, once and then opens (section 4.7), or twice; states 96,000 Hz; states another layout word; states no stream line; delivers exact zeros on one output or on both; delivers a whole pipe (the shortfall must then read zero); delivers a quarter (the bound of 8.3 must trip); prints `FIFO queue full` and `flushed`; ends by itself mid-session; ends with 255 after a stop.
- With these: open / start / close cycles of ONE group with two handles (one launch, never two); a handle opened after the launch (refused); one handle closed while the other lives; the last close; the helper's own end told to both; the pause after a close and the one retry, timed against the 8,000 ms; the third-listing refusal; the loss watch over a listing that loses the device; a full `REAL_PRODUCTION` session on doubles with two macOS inputs that seals with the source facts of 8.1 and the member of 8.4, verifies, exports and passes the receiver's verify; the re-open per attempt of row 191 with a new group; the byte-identity proof of 8.4 for a session without the path.
- The worker, on the same pattern: the track is as long as the wall time; the identity of section 7.2a holds at every account, to the sample; no stretch is asked for and no rate-limit warning arises on a gapped microphone; the displacement of a marker against the picture (section 7.2); every existing worker check unchanged for `PCM_FIFO`. Revision 3, further modes of the stand-in (SM-25 as widened, SM-29 (5), SM-33 (6), (7)): a whole pipe (inserted and discarded read zero after the start); a marker signal, compared value for value with what the tap holds (the copy of section 7.2a, place 4); a writer that starts 4 s late (the track opens on a listed run from sample 0); a writer that stops for 3 s (one listed run, and a re-placement whose discard is counted); 1,025 stops (the bound: 1,024 listed, 1 counted); a sample that is not a number; a second microphone that begins before sample 0 (the trim is counted); the worker killed before its first account, between two accounts and after the closing one; both kinds in one plan; a near-miss of the kind word (`PLAN_INVALID`).
- The static rule: the lists of the macOS table as a THIRD kind of list with SR-15's admissions (review SM-08); controls: a name in the place of the index, index 32, `none:01`, `none:-1`, `0:none`, three output sections, the same selection or the same pipe twice, each forbidden word of section 4.2a, a log level other than `info`, a fourth listing argument, a listing program handed in by a product file.
- The real helper WITHOUT a device (a generated source in the place of the input, as row 79b did for the Linux row): the pre-check row to standard output; a single queued output; a reader absent at the start; a reader that closes its pipe - the four forms section 4.2 lists as not measured.
- The real rows on the device: agents may list and may open and record from the user's USB interface (U23 (3), (4); U24 (1)); what is recorded is test material under the git-ignored `.cache/` or a throw-away store, never kept, sent or committed; the built-in microphone and camera stay under D163 (U24 (4)); names and serials never enter a file. The bounds 2, 3, 5, 6, 7 of the review's SM-26 stay for every such open.

### 9.3 What was NOT measured and stays for the user's own session

Measured by agents since revision 1 (rows MM, MM2, MM3): the list's text and order, the index, the stream line, the rate, the delivered samples and their cause, two helpers (refused), one helper with two outputs, the stalled reader, the refused opens, the stop, the channel selection, the levels per channel. NOT measured, and not measurable by an agent - each is the user's own act (decisions C96, U24 (3)(b)):

| # | Not measured | Why not an agent | What the design does until then |
|---|---|---|---|
| 1 | UNPLUG of the interface or its cable during a recording; re-plug into the same and into another socket | physical (MM s9) | the worker's no-sample fault and the watch state the loss (section 7.1); whether the helper ends by itself is a hypothesis |
| 2 | REBOOT: that the location value of the interface is the same afterwards | physical | a unit without a serial on another location is `AUDIO_CARD_CHANGED` until registered again (3.2); this interface states no serial (MF1) |
| 3 | THE RATE CHANGED MID-SESSION by another program or in the system's settings | a device setting; an agent changes none (U24 (3)(b)) | the watch reads the system list every 5,000 ms and the helper's microphones are stopped on another rate (review SM-16 (2)); what the helper itself does at that moment is a hypothesis (review HM-4) |
| 4 | THE SOCKET-TO-CHANNEL MAPPING: that channel k is the socket numbered k+1 | a sound at one input only; the user makes it (MM s4) | the selection hands on channel k sample for sample (MF20); which socket that is, the user confirms by speaking into one input and watching the level |
| 5 | A PERMISSION DENIAL: what the system asks, which application it names, and what a denied open looks like (a refusal, no buffer, or silence) | the system's dialog and the privacy setting are the user's (review SM-15; MF22) | the non-zero gate of section 4.6 holds whichever form a denial takes |

Also not measured, by anyone: a truly quiet machine (the load was 3.77 to 7.72 in every capture, MM3 s6); another device buffer length, another rate, another interface, the layout words of other channel counts; whether macOS itself delivers every sample to a reader that is not the pinned tool (MM3 s7; section 14); the cause of the refused open and of the first-open levels (MF17, MF23).

The list of revision 1, with its state (the user repeats the measured ones on the production Core at the first real session):

| # | Check | Proves |
|---|---|---|
| MH-01 | The search (operation 98) on the production Core lists the interface once, with the right channel count; `skipped` 0 | L1 + L2 + L3 and the name tie on the real device; the exact text of L3 |
| MH-02 | First pre-check: the system asks; which application it names; Allow; pre-check passes | section 5: who is asked |
| MH-03 | Pre-check with the permission switched off | which of the three forms a refusal takes; the text for H-18 |
| MH-04 | Speak into input i only: the level moves on the microphone registered on input i and not on j; then the other | `none:<n>` opens the indexed device; the channel selection selects the registered input; channel order equals input numbers |
| MH-05 | Both microphones of one interface start in one session | MEASURED for the helper: two helpers are refused, one helper with two outputs delivers both (MF13, MF14). On the product: build row N15 |
| MH-06 | A recorded minute against a clock: the track is as long as the wall time; the sealed manifest states the shortfall, about one sample in ten | No longer a gate (U25 (2)). MEASURED for the helper (MF7); on the product: build row N15 |
| MH-07 | Unplug the interface during a recording: fault within the watch's interval and the worker's no-sample fault on both microphones; whether the helper ends by itself; video stays durable | section 7.1; NOT measured (9.3 row 1) |
| MH-08 | Re-plug into the same socket, and into another socket | found again; `CARD_CHANGED` for a unit without a serial on another socket |
| MH-09 | Restart the Mac; search again | the location value survives a reboot |
| MH-10 | A second audio device plugged between open and start | the list order rule; `AUDIO_CARD_MOVED` |
| MH-11 | Interface left at 96,000 Hz | `AUDIO_CARD_RATE_UNSUPPORTED`, in words the operator understands |
| MH-12 | A sealed session: its source facts and manifest state section 8 | the evidence statements |

### 9.4 A rule for agents that follows from section 5

Revision 1 said here that no agent opens a real microphone. Decisions U23 (4) and U24 (1) changed that for the user's USB interface: agents may open and record from it. What stays from section 5: the system's question, if one appears, is answered by the user and never by an agent; the application that hosts the agents holds a standing grant once it was given, which covers the built-in microphone too (review SM-15 (3)); the built-in microphone and camera stay under D163 (U24 (4)); and a production Core an agent starts for a real open runs on a spare lane with its own database and media store, whose sealed sessions are test material and are removed with the lane (review SM-27).

## 10. Point 9 - WORK PACKAGES

### 10.1 Rows, re-cut to the addendum (revision 3; form of the blueprint's Execution Profile)

18 rows: the 16 of revision 2 and the two the addendum adds (08b s2 rank 5): N17, the verdict lines and the export (SM-37), and N18, the transcript (SM-38). Row numbers are placeholders; the task-architect cuts them. The table of revision 2 follows as 10.1a for the record; where the two differ, this one holds. `B` = a build dependency (the row needs the other's code in the tree), `C` = a contract dependency (it needs only the words of this design). "GATE ids" names the requirements among the addendum's eight gates (SM-02, SM-04, SM-14, SM-16, SM-29, SM-30, SM-33, SM-36) that the row must show green; "also" names its other requirements (08b s12, last table, and the review's rows as revision 2 mapped them). Every row is reviewed against its ids. Model: `opus` for every row but N15 - each leaves a design choice or a judgement to its driver, so none meets the three conditions of the deterministic tier; long runs go to a separate test-runner on `sonnet`. ONE row opens a device (N15); no other does.

| Row | Ownership area | Size | Deps (kind) | Model | Shared files and resources it touches | GATE ids; also |
|---|---|---|---|---|---|---|
| N1 | CONTRACT, the worker protocol: `packages/capture-protocol/src/index.ts` and its test - the words of section 8.2 (a) to (e) | S | this revision confirmed (08b rank 2): C. LANDS WITH N3, see the marks below | opus | `packages/capture-protocol` (one writer); the protocol number, shared with the worker and the Core | SM-29, SM-30, SM-33 (4), (5) |
| **N2** | **THE ONE CONTRACT STEP: the single writer of `packages/shared`** for this whole design. `evidence-package/manifest.ts`, `build.ts` (the member, fields 139-158, its rules, section 8.4); `sim/vocabulary.ts`, `i18n` (two audit types, their labels); `sim/capture-notices.ts` (five advisory reasons, section 8.3); `evidence-verify/types.ts`, `verify.ts` (two notices and their report functions, section 8.4a); `api/evidence.ts` (two members of operation 84, section 8.6); `i18n` (the operator's words, section 6.2, and `sharesDeviceWithPrimary` only if the web row's check asks for it); `api/security-audit.ts` (the `SYSTEM_BOOT` example with `microphonePermission`); and, outside the package, `CS/core/audit-details.ts` (the two closed detail lists; the boot member). `openapi.json` is regenerated ONCE by the repository's generator (operation 84 changes) | M | this revision confirmed: C. AFTER the writer of `packages/shared` now in flight (pass I-9b, items 9 to 11, `delegation_progress/file_claims.md:244`) has released it | opus | `packages/shared` (ONE writer); the count pins, each moved by its delta by its owner: audit types +2, optional manifest fields +20, advisory reasons +5, verify notices +2 | SM-29, SM-30, SM-36 (the words); also SM-32 (5), SM-34 (2), (3), SM-36 (5), SM-37 (1), SM-38 (the two members) |
| N3 | THE WORKER: `apps/capture-worker/src/audio.c`, `capture_worker.c`, `worker.h` (section 7.2a, places 1 to 12; the run tracker and the two records of section 8.2); `apps/capture-worker/test/`, `test-fixtures/`, `test/static/pinned_calls.py`, `planted.tsv`, `check.sh`, the worker's README | M | N1: B (one change set); THE WORKER BASELINE (decision C110) | opus | the worker build (one at a time); the heavy-host lock for its process tests; the protocol number | SM-29, SM-30 (1), (2), (4), SM-33; also SM-31 |
| N4 | THE TABLE AND ITS STATIC RULE: `CS/capture/adapters/local/mic-helper-args.ts` (the two templates, the device word, the two system listing rows and their program literals); `CS/capture/__tests__/static.test.ts` (the third kind of list: template equality and every planted control of section 4.3.2); the ONE run of section 4.3.3 | M | 08b rank 1 (adopted, C110): C. Does not CLOSE before the run of 4.3.3 | opus | the table file (one writer); `static.test.ts` (served by its owner); the real helper for the run - no device | SM-04 (2), SM-14, SM-16 (4); also SR-15, SM-07, SM-08, SM-09, SM-35 (5), (6) |
| N5 | THE DOOR: `CS/capture/adapters/production-door.ts` (ONE new observer: standard error as it arrives, bounded per line, per second and per life), its test and pins | S | rank 1: C | opus | the door (pinned by static rule G-R8: one writer) | none; SM-12 (3), SM-35 (7) |
| N6 | THE LISTING: NEW under `CS/capture/adapters/audio/` (the property-list reader, the JSON reader, the list reader, the one-to-one tie, the undecided states); `card-listing.ts` (one word of `CardFactsSource`) | M | rank 1: C | opus | `card-listing.ts` (one writer); the lockfile ONLY if a ready-made property-list parser is taken (the user's word first, Q9) | SM-02; also SM-01, SM-03, SM-05, SM-11, SM-13, SM-22, SM-25 |
| N7 | THE SEAM: `CS/capture/fence/production-parts.ts` (by platform; the runner of three rows), `CS/capture-composition.ts` | M | N4: B, N6: B. Lands BEFORE N10 (shared fence wiring) | opus | fence wiring; the static pins of the adapters | none; SM-08 (pins), SM-10, SM-21 |
| N8 | THE READER OF THE HELPER'S LINES: NEW under `CS/capture/adapters/audio/` (pure: the stream line, the layout table as a constant of ONE file, the two queue lines, the refusal line) | S | rank 1: C | opus | - | SM-04 (2), SM-16 (1) to (3); also SM-12, SM-35 (4) |
| N9 | THE ADAPTER: NEW under `CS/capture/adapters/audio/` (the group, the one launch, the three listings, the stream-line gate, the pause kept PER DEVICE and the one retry, the pre-check with its count, the statement of the three source facts and the capture group, the refusals of section 6.2) | M | N4 (closed): B, N5: B, N6: B, N8: B; N1: C | opus | - | SM-04, SM-14, SM-16; also SM-06, SM-18, SM-19, SM-21, SM-34 (4), (6), SM-35, SM-39 |
| N10 | THE REGISTRY: `CS/capture/adapters/real.ts` and the registry builder (by platform, never both); the loss watch's wiring | S | N9: B, N7: B | opus | fence wiring; the static pins of the adapters | none; SM-06, SM-21 |
| N11 | THE SHORTFALL IN THE CORE: `CS/capture/supervisor.ts`, `forwarder.ts` (the four telemetry members, the two records, the windows and the five notices of section 8.3, the stall rule of 7.1, the amount of a queue drop); `CS/capture-session/index.ts`, `statements.ts` (the non-zero gate of the feeding microphone; the two audit types; the closing account held against `AUDIO_TIMELINE_END`; the interval of a launch that failed after samples flowed, SM-04 (2)(c); the count of retries); `CS/capture/fence/sources.ts` (three keys). The largest row: if the task-architect rates it above M, the cut is between the forwarder and supervisor on one side and the session and the source facts on the other | M | N1: B, N2: B; N3: C, N9: C | opus | `capture-session/index.ts` (a hot file: ONE writer); the db-migrate lock for its database tests | SM-14, SM-29 (4), SM-30, SM-36 (1); also SM-04, SM-06, SM-18, SM-32, SM-34 (1), SM-35 (1), SM-39 (1), (4) |
| N12 | THE SEAL: `CS/sealing-host/session-reader.ts` (the column `source_facts` in `READ_SEAL_SOURCE_ROWS`; the function that builds the records), `CS/sealing/pipeline/contract.ts` (two facts; `AUDIO_SHORTFALL_NOT_STATED`), `pipeline.ts` (the member; the refusal) - section 8.4a | M | N2: B; N11: C (the words of the two audit rows) | opus | the seal (a closed unit: one writer) | SM-30 (2), SM-36; also SM-33 (4, the byte-identity proof on a session that went through the NEW worker) |
| N13 | THE BOOT: `CS/capture/boot/`, `CS/capture/fence/boot-key.ts` (the path rule of the two system listing programs on `darwin`; `microphonePermission`) | S | N2: B | opus | the boot files (baseline of row P1, decision C97) | none; SM-13, SM-15 |
| N14 | THE STAND-INS AND THE SESSION ON DOUBLES: NEW under `apps/core-server/test/` (section 9.2: one group with two handles through seal, verify, export and the receiver's verify; the row-191 re-open) | M | N3 with the run B+ green: B; N7, N9, N10, N11, N12: B | opus to write; the long runs by a test-runner on sonnet | heavy-host lock; db-migrate lock | SM-29 (5), SM-36; also SM-25, SM-33 (7) |
| N15 | THE PRODUCT ON THE DEVICE, test only, on a spare lane: pre-check; a session of a minute; a session of at least 30 minutes WITH THE WATCH RUNNING; seal, verify | M | N14: B; N17: B | sonnet (a scripted run with one right output; escalated once if it blocks) | the one device (ONE opener at a time); heavy-host lock; the user at the Mac for the system's question | SM-16 (as restated: the signed shortfall lies inside the measured range), SM-29; also SM-27, SM-32 (4), SM-39 (6), (7) |
| N16 | THE DOCUMENTS: `README.md`, the installer note, the hardware chapter (the weaker points of section 11; 08b s13 word for word; the five checks of 9.3) | S | N9: C, N11: C | opus | the README (one writer) | none; SM-15, SM-17, SM-20 (3), SM-23, SM-28, SM-30 (5), SM-34 (5), SM-38 (4) |
| **N17 (new)** | THE VERDICT LINES AND THE EXPORT: `CS/evidence-export/receiver-verify.ts`, `receiver-cli.ts` (the two lines), `export-manifest.ts` (`audioNotSampleContinuous`), and every other form in which a session leaves the Core, found first and listed - section 8.4a | M | N2: B; N12: B | opus | the export unit | none of the eight; SM-37. Before N15 and before the first real session |
| **N18 (new)** | THE TRANSCRIPT: `CS/transcription/index.ts` (the facts handed in), `apps/transcriber/src/pipeline/document.ts` and its assembly (the three flag forms, the derived mark, the renderings), `CS/sealing/finalize-transcript/document.ts`, the answer of operation 84, the seal's check - section 8.6 | M | N2: B; N12: B (it uses the seal's function, and its check stands in a file of N12: N12 first) | opus | the seal's pipeline file (after N12, one writer at a time); `apps/transcriber` | none of the eight; SM-38. Before any transcript of a session of this path is shown or exported |

COUNT: 18 rows - S 6 (N1, N5, N8, N10, N13, N16), M 12 (N2, N3, N4, N6, N7, N9, N11, N12, N14, N15, N17, N18). No row is L. Against revision 2: N4 and N12 go from S to M (the templates with their planted controls and the run on a generated source; the anchor, the refusal and the null records).

THE ROWS THAT EDIT `apps/capture-worker/src`: ONE, **N3**. By decision C110 no row of this design touches that tree before suite run c06 and its commit: c06 IS the worker's baseline (the hashes of the three binaries, the BR-11 series, the kill matrix; SM-33 (2)). N3's first step is to RECORD that baseline in its own record - the three hashes, the two results, and the outputs of the comparison run of SM-33 (4) made with the baseline binary, twice, to show the instrument agrees with itself - and only then to edit. AFTER its last edit N3 OWES AGAIN, on the binaries built from the changed source (SM-33 (1)): `make`, `make e2e`, `row58_gate` three times, rows 176, 175, 041, 042, 043, 186, 143b, 152, 153, the fuzz controls, the row-046 database test, and THE KILL MATRIX, all 35 cases, plus the three new kill cases of a gapped microphone (SM-33 (7)). That is the run B+ of the order below: one heavy runner, the database lock before the heavy-host lock (08b s5 (8), which cites decision C88; that decision row was not read by this revision), nothing else heavy beside it. No expected value of an existing check is edited but the protocol number and the presence of the four telemetry members; every edit is listed (SM-33 (3)).

N1 EDITS NO FILE OF THE WORKER, AND STILL WAITS WITH N3 TO LAND. It moves `CP/index.ts:148`, which a test holds equal to `WK/worker.h:48` (`CS/capture/__tests__/protocol-pins.test.ts:61`) and which the boot compares with what the worker says (`CS/capture/boot/checks.ts:401`). A package at 5 beside a worker at 4 fails every run that starts a worker - and would do so inside c06. So: N1 may be WRITTEN in a claim of its own beside wave A; it is put into the tree in ONE change set with N3's edit of `WK/worker.h:48`, after c06's commit. Rows N9 and N11 need only its words, which are section 8.2 (R3.3 row 5: a difference from 08b s14, for the controller).

THE ONE CONTRACT STEP: **N2**. Every word this design adds to `packages/shared` is in it, the words of N17 and N18 included; no other row of this design writes that package. The protocol package is another package with its own single writer (N1).

THE ORDER (08b s14, with the two points above):

| Wave | Rows | May run together | Waits for |
|---|---|---|---|
| A | N4, N5, N6, N8 | all four: four owners, no shared file | 08b rank 1 (adopted, C110). N4 does not close before the run of 4.3.3 |
| A' | N2; N1 (written, not landed) | with each other and with wave A | rank 1 AND rank 2 (this revision confirmed); N2 also the release of `packages/shared` by pass I-9b |
| B | N3 with N1's landing; N7; N9; N13 | N3 ALONE on the worker build and the heavy-host lock; N7, N9, N13 beside it and beside each other; N7 lands before N10 | N3: suite run c06 and its commit (rank 3), N1. N7: N4, N6. N9: N4 closed, N5, N6, N8. N13: N2 |
| B+ | the BR-11 series and the kill matrix on the changed worker | one heavy runner; nothing else heavy beside it | N3 |
| C | N10; N11; N12 | N10 beside N11; N12 after N11's words on the two audit rows | N10: N9, N7. N11: N1 landed, N2. N12: N2 |
| C' | N17; N18 | with each other and with wave C | N2; both also N12 |
| D | N14; N16 | beside each other | N14: N3 with B+ green, N7, N9, N10, N11, N12. N16: N9, N11 |
| E | N15 | alone: one opener of the one device; the user at the Mac | N14, N17 |

Single-writer resources: the protocol package, the shared package, the table file, the door, the worker build, `capture-session/index.ts`, the seal, the README. Three things bring the design back to the review and are a STOP of the row, never its decision (08b s1): a word of a template must change (N4); the account cannot be made exact on the stand-in, or the displacement misses the product's bound (N3); the user takes the option of section 14.

### 10.1a The rows of revision 2 (SUPERSEDED by 10.1; kept for the record of what the addendum reviewed)

`EXISTS:` = the file was read or found by a search in one of the two passes, or is named as edited by a record of this task (rows 191c, P1). Row numbers are placeholders; the task-architect cuts them. Every row: review = gate. ONE row opens a device (N15, under U24 (1)); no other does.

| Step | Ownership Area | Deps (kind) | Size | Model | Shared Resources | Checks |
|---|---|---|---|---|---|---|
| N0 | docs only: an ADDENDUM of the security review (row M2) on this revision; not a build row | M1b:B | S | opus (a verification agent: never downgraded) | - | SR-15 as restated (4.3) confirmed or reversed; the five points of R.2; sections 4.6, 4.7, 6.1, 7.2, 8 accepted or changed |
| N1 | CONTRACT, the worker protocol. EXISTS: `packages/capture-protocol/src/index.ts` (version 4 to 5; the kind `PCM_FIFO_GAPPED`; `receivedSamples`, `timelineSamples`, `nonZero` in `levels`; the record `MIC_SAMPLE_ACCOUNT`), its test | N0:C | S | opus | `packages/capture-protocol` (ONE writer); the version is shared by the worker and the Core | schema cases; every existing message of version 4 with the new members; a message without them refused |
| N2 | CONTRACT, the shared package. EXISTS: `packages/shared/src/evidence-package/manifest.ts` + `build.ts` (`audio.samplesNotReceived`, fields 139-144), `src/sim/vocabulary.ts` + `src/i18n` (the audit type `CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED`), `src/sim/capture-notices.ts` (three advisory reasons: `STANDBY_ON_PRIMARY_DEVICE`, `MIC_PATH_NOT_SAMPLE_CONTINUOUS`, `MIC_SAMPLES_SHORT_ABOVE_BOUND`), `src/api/security-audit.ts` (the `SYSTEM_BOOT` example with `microphonePermission`); EXISTS: `CS/core/audit-details.ts` (the closed detail list of the type; the boot member) | N0:C | M | opus | `packages/shared` (ONE writer of the package in the wave); the count pins of audit types and optional manifest fields (moved by delta, by their owner) | the example manifest parses to the same bytes; absent / empty / present cases; the detail rules accept and refuse |
| N3 | EXISTS: `apps/capture-worker/src/audio.c`, `capture_worker.c`, `worker.h` (the gapped kind: no rate request, zeros counted and reported, the account record, `nonZero`), the worker's tests and `README.md` | N1:C | M | opus | the worker build (one build at a time), heavy-host lock for its process tests | the pattern test of 9.2; every existing check for `PCM_FIFO` unchanged; the displacement measured and stated |
| N4 | EXISTS: `CS/capture/adapters/local/mic-helper-args.ts` (the macOS production table: the device argument, the push list of one or two outputs, the pre-check list, the two system listing rows and their program literals, the table constants) + EXISTS: `CS/capture/__tests__/static.test.ts` (the third kind of list, SR-15; served by the list's owner) | N0:C | S | opus | the table file (ONE writer); static-adapters | lists verbatim against 4.2; functions take whole numbers only; every control of 9.2 |
| N5 | EXISTS: `CS/capture/adapters/production-door.ts` (ONE new observer: standard error as it arrives), its test and its pins | N0:C | S | opus | the door is pinned (static rule G-R8): one writer | the bounded head and every existing behaviour unchanged; an observer that throws stops nothing; nothing of a chunk is logged |
| N6 | NEW under EXISTS: `CS/capture/adapters/audio/` (the macOS listing: the property-list reader, the JSON reader, the list reader, the one-to-one tie, the undecided states, the enumerator) + EXISTS: `card-listing.ts` (one word of `CardFactsSource`) | N0:C | M | opus | `card-listing.ts` (one writer); the lockfile, ONLY if a ready-made property-list parser is taken (a new dependency: the user's word first) | every fixture of 9.1 and of review SM-25; every string through `cardListingText`; the size and the interface class of the real L1 row settled (2.3) |
| N7 | EXISTS: `CS/capture/fence/production-parts.ts` (the platform seam: `linux` the reader, `darwin` the listing, any other "not available"; the runner of three rows with the per-row exit rules of review SM-10), EXISTS: `CS/capture-composition.ts` | N4:B, N6:B | M | opus | fence-wiring, static-adapters (pins requested from the list's owner) | off `darwin` nothing of it starts; one caller per row; a killed listing leaves no child |
| N8 | NEW under EXISTS: `CS/capture/adapters/audio/` (a PURE reader of the helper's diagnostics lines: the stream line, the layout table, the two queue lines, the refusal line; no process, no clock) | N0:C | S | opus | - | the lines of MM s2, MM2 s3, MM3 s8.2 as fixtures (synthetic tags); a name-bearing line leaves no text behind |
| N9 | NEW under EXISTS: `CS/capture/adapters/audio/` (the macOS adapter of kind `USB_AUDIO`: the group of section 6.1, the one launch, the three listings, the stream-line gate, the pause and the one retry, the queue notices, the pre-check with its count, the source facts with the two keys, late admission) | N4:B, N5:B, N6:B, N8:B, N1:C | M | opus | - | the cycles of 9.2; the refusal table; the launch timed against 8,000 ms; no import of a development file (review SM-21) |
| N10 | EXISTS: `CS/capture/adapters/real.ts` and the registry builder (which built adapter serves the kind: by platform, never both); the loss watch's wiring for the macOS match and its "undecided for two passes" fault (review SM-06) | N9:B | S | opus | fence-wiring, static-adapters | `linux` builds the Linux adapter, `darwin` the macOS one, any other none; no key or seam in `src/` chooses |
| N11 | EXISTS: `CS/capture/supervisor.ts` / `forwarder.ts` (the new telemetry members and the record; the two shortfall notices with the bound of 8.3; the standby notice), `CS/capture-session/index.ts` + `statements.ts` (the active microphone's non-zero gate; the audit row per microphone and attempt), `CS/capture/fence/sources.ts` (two keys) | N1:B, N2:B, N3:C, N9:C | M | opus | `capture-session/index.ts` (a hot file: one writer), db-migrate lock for its database tests | the row is written once per microphone and attempt, in one engine unit; nothing raised or written for `PCM_FIFO`; the key list verified against sealed readers FIRST |
| N12 | EXISTS: `CS/sealing-host/session-reader.ts`, `CS/sealing/pipeline/contract.ts`, `pipeline.ts` (the member from the audit rows the reader already reads) | N2:B, N11:C | S | opus | the seal is a closed unit: one writer | the byte-identity proof of 8.4 (before / before / after, `cmp`); verify, export and receiver's verify of a session that carries the member |
| N13 | EXISTS: `CS/capture/boot/` and `CS/capture/fence/boot-key.ts` (path-rule check of the two system listing programs on `darwin`; `microphonePermission`) | N2:B | S | opus | the boot files (baseline of row P1: `checks.ts` dfb1a117, `boot/index.ts` 5a264525, decision C97) | the boot never waits for a listing; the two members on `darwin` only |
| N14 | NEW under EXISTS: `apps/core-server/test/` (the stand-ins of 9.2; the production session on doubles with two macOS inputs through seal, verify and export; the row-191 re-open on the macOS adapter) | N7:B, N9:B, N10:B, N11:B, N12:B, N3:B | M | opus to write; the long runs by a separate test-runner on sonnet | heavy, db | the session starts, seals and states 8.1 and 8.4; 0 real devices |
| N15 | test only: the product on the user's USB interface, on a spare lane (U24 (1); review SM-27): pre-check, one session of a minute, seal, verify; the retry and the pause as counted | N14:B | M | sonnet (a scripted run with one correct output; escalated once if it blocks) | heavy; the one device (ONE opener at a time); the user at the Mac for the system's question | the manifest states a shortfall inside the measured range (MF7); the track is as long as the wall time; nothing kept, nothing left running |
| N16 | docs: `README.md` (the macOS production microphone: steps, limits, the weaker points of section 11), the installer note, the hardware chapter (the five checks of 9.3) | N9:C, N11:C | S | opus | README (one writer) | every limit of sections 8.5 and 11 stated; the pair never called redundant |

Count: 16 build rows - S 8 (N1, N4, N5, N8, N10, N12, N13, N16), M 8 (N2, N3, N6, N7, N9, N11, N14, N15) - plus the review addendum N0. No row is L: the adapter of revision 1 (M6) is split into the pure reader N8 and the adapter N9, and the contract into N1 and N2 by package.

Waves, by the dependencies above: N1, N2, N4, N5, N6, N8 together after N0 (six owners, no shared file: N2 is the one writer of `packages/shared`, N4 of the table file); then N3, N7, N9, N13; then N10, N11, N12; then N14; then N15; N16 beside N14. `B` = a build dependency (the row needs the other's code), `C` = a contract dependency (it needs only the words of this design or of the contract step).

Rows of revision 1 and what became of them:

| Revision 1 | Now | What falls away |
|---|---|---|
| M2 (the review) | done: decision C96. Its addendum is N0 | - |
| the measurement the review asked for (row MM) | done: MM, MM2, MM3 | the bounds of 2 s and 12 captures (lifted by U24 (1)) |
| M3 | N4 | the reuse of the shared output and quiet literals; one helper per input |
| M4 | N6 | the TEXT reader of the USB tree |
| M5 | N7 | - |
| M6 | N8 + N9 | "two inputs of one device = two helpers"; the stall bound on the progress report; the index taken at the open |
| M7 | N10 | - |
| M8 | N13, and the source-fact keys in N11 | `captureLayer` on both platforms; the word `hostForm: BENCH_DARWIN` (not added, 8.1) |
| M9 | N14 | two stand-in helpers for one device |
| M10 | N16 | MH-05 and MH-06 as checks only the user can make |
| - | NEW: N1, N2 (contract), N3 (worker), N5 (door), N11 (the shortfall in the Core), N12 (the seal), N15 (the product on the device) | - |

### 10.2 Contract members and schema

| Question | Answer | Verified by |
|---|---|---|
| A new adapter kind or operation | none: kind `USB_AUDIO`, operations 98 and 99 as they are | section 3.1: a macOS card is a `CaptureCard` of the same shape |
| A member of the card answer | none | `packages/shared/src/api/capture-audio-cards.ts:56-86`, `:121-147`: the patterns admit the macOS values; `sampleBits` may be an empty list |
| A stored column or CHECK | none: `card_id` `usb_<8 hex>`, `usb_port` 8 hex, `card_device` 0, `usb_serial` or null | the closed forms at Linux adapter `:262-276` |
| A wire refusal code | none: new words are DETAIL words of existing refusals | Linux adapter `:177-198` |
| The worker protocol | YES (row N1): version 5; the input kind `PCM_FIFO_GAPPED`; three members of a telemetry level; one record. The worker and the Core move together: they are one deliverable and the protocol refuses another version | `CP/index.ts:148`, `:351-358`, `:567`, `:672-674`; `WK/worker.h:48` |
| An audit type | YES (row N2): `CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED`, six closed details (8.4) | the form of `CS/core/audit-details.ts:653-659`; `SH/sim/vocabulary.ts:479` |
| A manifest member | YES (row N2): the OPTIONAL `audio.samplesNotReceived`, fields 139-144; absent = the same bytes as before | `SH/evidence-package/manifest.ts:809-829` |
| Advisory notice reasons | YES (row N2): three members of the closed list | `SH/sim/capture-notices.ts:81-97` |
| A member of the boot entry | YES (rows N2, N13): `microphonePermission`, optional, `darwin` only | the form of row P1 (`implementation/p1_production_platforms.md` section 3) |
| Source-fact keys | two keys of the Core's closed list (row N11), not a contract member of the shared package; verified against sealed readers first | `CS/capture/fence/sources.ts:148` |
| The API description | no operation and no schema of it changes; `openapi.json` is not regenerated (as in row P1) | `implementation/p1_production_platforms.md` section 4, last line |
| Still not proposed | a "not registrable" line on the search screen (3.3) | - |

REVISION 3 - the rows of the table above that change, and the schema question answered from the stored rows the seal reads:

| Question | Answer in revision 3 | Verified by |
|---|---|---|
| The worker protocol | row N1: version 5; one input kind; FOUR members of a telemetry level; TWO records; three constants (section 8.2) | `CP/index.ts:148`, `:351-358`, `:567`, `:672-674`, `:919`; `WK/worker.h:48` |
| An audit type | row N2: TWO - `CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED` (20 closed details) and `CAPTURE_AUDIO_SILENCE_INSERTED` (5) (section 8.4) | the form of `CS/core/audit-details.ts:653-659` |
| A manifest member | row N2: the OPTIONAL `audio.samplesNotReceived`, fields 139 to 158; absent = the same bytes as before | `SH/evidence-package/manifest.ts:809-829` (fields 129 to 138 are in use) |
| Advisory notice reasons | row N2: FIVE (section 8.3) | `SH/sim/capture-notices.ts:81-97` |
| Verifier notices | row N2: TWO, with their report functions (section 8.4a) | `SH/evidence-verify/types.ts:410-422` |
| The transcript given to a client | row N2: two optional members of operation 84 (section 8.6). So the API description DOES change in this revision and `openapi.json` is regenerated once, as row R1b did | `SH/api/evidence.ts:387-415`; `implementation/r1b_video_absence_signed.md` section 8 |
| The sealed transcript document | NO member and no new version: three flag texts in the list it has (section 8.6) | `apps/transcriber/src/pipeline/document.ts:118`, `:130` |
| The export's manifest | row N17: one optional member of its `sessionManifest` block; the Core's file, not the shared package | `CS/evidence-export/export-manifest.ts:74-83` |
| The seal's failures | row N12: one member of the Core's list, `AUDIO_SHORTFALL_NOT_STATED` | `CS/sealing/pipeline/contract.ts:75-125` |
| Source-fact keys | row N11: THREE keys of the Core's closed list | `CS/capture/fence/sources.ts:148` |

DOES ANYTHING NEED A COLUMN? NO - confirmed, with one change of a STATEMENT. The seal reads three stored things of a session (`CS/sealing-host/session-reader.ts:83-86`):

| Stored rows | What this design needs from them | Column or grant |
|---|---|---|
| `session_capture_sources` | the anchor: the key `sampleContinuity` and the `captureGroup` inside `source_facts` | the column EXISTS (`CS/db/migrations/0015_capture_streams_audio_inputs.sql:48`) and is a flat map with a bound of 2,048 bytes that three short keys fit (`:54-56`). The seal's statement does not SELECT it today (`session-reader.ts:83`): row N12 adds it to that statement's column list. The runtime role's table-level SELECT covers it (`0009_capture_sources_privileges.sql:16`; `0016_capture_streams_audio_inputs_privileges.sql:43-44`). No migration, no grant |
| `audit_log` | the account rows and the run rows | the statement already reads every audit row of the session with its `details` (`session-reader.ts:85-86`). Two new TYPES are values, not columns: row R1b added a type with "no schema change" (`implementation/r1b_video_absence_signed.md`, line 13). The details are flat by the table's CHECK (`0001_tables.sql:198`), which is why the runs are rows and not a list. No migration, no grant |
| `session_audio_intervals` | nothing new | unchanged |

Nothing is stored for the windows, the reference or the notices: they are the Core's memory of a running attempt. What was NOT verified and row N12 verifies first: whether a test pins the text of `READ_SEAL_SOURCE_ROWS` or counts the reader's statements (row 191c's reader test "counts the statements", its section 2) - the count does not change, a pinned text moves by its delta; and whether any sealed reader pins the list of source-fact keys (review SM-18 (2), still open, 08b s16).

## 11. Stated plainly: what in this design is weaker than on Linux

| # | Weaker point | Why it is accepted or how it is held |
|---|---|---|
| W1 | The tie between the listing's identity and the opened device is a NAME equality across three listings and an index of another process's list. On Linux the kernel's card index carries the identity itself | Three uniqueness rules, three listings per start, refusal on any doubt (3.3). Residual stated there |
| W2 | Two same-model devices cannot be used together (both refused). Linux tells them apart by serial or port | A functional limit, not a silent risk. Alternative E removes it |
| W3 | Whether the microphone may be opened is decided by the operating system's permission, outside the Core; a denial might deliver silence (hypothesis) | The non-zero gate of section 4.6, at the pre-check and at a session start; what a denial looks like stays the user's check (9.3) |
| W4 | The helper program and its libraries live in a user-owned tree on this Mac (`README.md:497`, `:577`: a private copy that loads the package manager's libraries). The path rule vouches for the file started, not for what it loads. On Linux the program is the host profile's package | Already true of the development helper; to be stated in the README as a property of a Mac production Core |
| W5 | No host profile, no unit hardening on `darwin` | Decision U21 (2); stated in the evidence by row P1 |
| W6 | `sampleBits` is not known and stated as null; formats are not listed | Stated, not guessed |
| W7 | THE AUDIO IS NOT SAMPLE-CONTINUOUS: about one sample in ten never arrives, in holes of 10.67 ms about nine times a second, and no arrangement of the pinned tool does better (MF7 to MF9) | Accepted by the user for this Mac's bench path (U25 (1), (2)). Held by: nothing pads, stretches or re-times (4.2a, 7.2); the worker fills with silence and counts; every session states its numbers under the signature (8.4); a notice above 12% (8.3) |
| W8 | Three listing programs and a JSON reader: more parsing surface than one text | Bounded texts, key whitelist, type checks, fixtures of 9.1 |
| W9 | G-R12 gains the places of SR-15, among them a fourth output format word (`fifo`) | Additive; no text argument; AD-07 (2) kept in its words; the forbidden options named (4.2a). If S2 (the name selector) were chosen instead, AD-07 (2) WOULD be weakened - not recommended |
| W11 | PRIMARY and STANDBY are one process on one device: one fault of the device, the cable, the helper, the permission or the rate takes both in the same instant | The user's choice (U23 (1)); the same port and card id in both source rows and the notice `STANDBY_ON_PRIMARY_DEVICE` (6.2) |
| W12 | The silences in the track are not at the places of the lost sound, and the sound that is there has a cut at each lost packet | Stated in the README and in 8.5; the worker cannot know the places (7.2) |
| W13 | The helper does not state its own loss, and a helper in a background scheduling class loses 73 to 89% without a line (MF10, MF12) | The product measures by itself (8.2); the bound of 8.3; nothing but the guard stands before the helper |
| W14 | About one open in thirty is refused for a cause nobody has established (MF17) | A pause and ONE retry, each reported (4.7); the time is inside the stated restart gap |
| W15 | The channel count the helper states is a word of the program's own table, read through a closed table with ONE measured entry (MF5) | Any other word is refused; another interface needs a measurement and a row |
| W16 | The port member is read from a program's property list, and the row that makes it fails in a confined process (MF1) | Typed reader, closed key list (2.3); a failed row is a listing failure, never "no card" |
| W17 | The stall bound of revision 1 is gone: a helper that lives and delivers nothing is stated by the worker and the watch, not stopped by the adapter (7.1) | REVISION 3: not accepted by the addendum for a whole group. A group none of whose microphones advances for 5,000 ms is STOPPED by the session, read from the worker's `receivedSamples`; one microphone alone is a fault of that microphone (7.1; 08b s3). What stays weaker than Linux: the stall is seen by the product's own count, never told by the helper |
| W18 (revision 3) | The account can end before the track does: a worker that is killed leaves its last periodic account, up to 60 s old, or none | Stated, never taken for whole: the closed mark `account` and the sample the account reaches, in the audit row and under the signature (8.4); the verdict line says "measured up to" or "not measured" (8.4a) |
| W19 (revision 3) | Inserted silence shorter than 100 ms has no position, and the places of ALL inserted silence say nothing about where sound is missing | Counted with its longest run (fields 152, 153); the fixed sentence (8.3); 08b s13, "may not conclude" 1 to 5 |
| W20 (revision 3) | A verifier cannot tell that the member is MISSING from a package: only the seal can refuse it | The seal's refusal (8.4a); the schema rule put to the controller there |
| W10 | A confined Core sees an empty audio list without an error (M9) | "Empty is not none" (2.3) |

Not weakened: the identity rule F5 (same function), the start rule, the refusal of development sources, "a handle starts once", the guard, the path rule, the evidence FORM (fMP4 with AAC mono 48 kHz, U25 (4)), and every rule of the Linux path (U25 (5)). What IS weaker than revision 1 claimed is the evidence's CONTENT on this Mac: W7, W11, W12 - each a stated fact of the session, not a silent property.

## 12. Questions only the user can answer

| # | Question | Recommendation |
|---|---|---|
| Q1 | PRIMARY and STANDBY: two inputs of the one interface, or a second device? | ANSWERED, U23 (1): two channels of the one interface; U25 (1): used as it is |
| Q2 | The interface at 96,000 Hz: set 48,000, or resample? | ANSWERED, U23 (2): the user set 48,000 Hz (measured, MM2 s1); the Core refuses any other rate |
| Q3 | May agents run the device list; may real names go into fixtures? | ANSWERED, U23 (3): agents may list; names and serials are never written; fixtures stay synthetic |
| Q4 | May an agent open the microphone? | ANSWERED, U23 (4), U24 (1): fully allowed for the USB interface; the built-in devices stay under D163 |
| Q5 | How will you start the production Core on this Mac (which terminal application, or a launcher)? | STILL OPEN. Decide once and keep it: the permission belongs to that application (section 5) |
| Q6 | Two microphones of the same model: is "both refused" acceptable? | STILL OPEN; not the user's case today (one interface). Accept the limit now |
| Q7 | Built now, fit to record only after the rate check passes? | OVERTAKEN, U25 (2), (3): the rate check cannot pass; the path is built as it is and states its shortfall |
| Q8 (new) | The option of decision C107, last sentence: a small own reader of this Mac's audio interface in the place of the pinned tool (section 14) | NOT TAKEN (U25: "use what is there"). It stays the user's to take |
| Q9 (new) | May a ready-made property-list parser be added as a dependency for the reader of the USB tree (row N6), or is a small strict reader of our own preferred? | The controller's question to put; the design works with either |

## 13. Assumptions, gaps, method

Assumptions: the lift (row 88) has landed before N10 (row P1 has: decision C97); the production Core on this Mac runs as the user, in the user's session, outside any sandbox (the USB tree row fails inside one, MF1); the audio helper key is set to the pinned program, which passes the path rule; the user's interface stays at 48,000 Hz and as it is (U25 (1)).

Of the eleven points revision 1 called "not determinable without opening a device": MEASURED - (1) the index (MF4, index 0 only), (2) the list order (MF2), (5) two helpers (refused, MF13), (8) the delivered samples (MF7), (9) the text of the list (MF3), (11) the time to the first sample (MF19). STILL the user's - (3) which process the system asks, (4) what a missing permission looks like, (6) that channel k is socket k+1, (7) whether the helper ends on unplug, (10) how fast an unplugged device leaves the lists. Section 9.3.

Statements of this revision that are read from code and predict behaviour no row has run, each marked where it stands: what the worker does with a pipe at 90% (7.2, points 1 to 5); the worst-case time of a launch with a pause and a retry (4.7); that a permission question delays the open (4.6). Each has its check in a build row (N3, N9, N15).

Not verified in either pass (no device needed; left to the rows): whether a sealed reader pins the source-fact key list (N11); the interface class in the property-list form, on which two runs disagree, and the size of that form with a hub of many devices (N6); the four forms of the helper row that the measurements did not run (4.2; N9 on a generated source); what the session does after an active microphone that did not start (4.6; N11); the product's bound for the offset between sound and picture, against which the displacement of 7.2 is judged (N3).

Alternatives considered in revision 2 and not taken: the gaps carried by the track's timestamps (7.2: the encoder, the writer and the records count in one continuous sample counter); silence inserted by the helper (4.2a: invented, and forbidden by C107); a per-packet timestamp list from the helper as a third output, read by the Core (MF10: about 0.9 MB of text a minute, and the worker still could not place the holes); the word `hostForm` (8.1: the manifest already signs the host); a shortfall statement on Linux too (U25 (5): the Linux path keeps its rules; the worker reports the counts everywhere, so a later row can use them).

Reading: read in full - the nine decision rows named in the header, `usb-audio-production.ts`, `card-listing.ts`, `card-listing-reader.ts`, `mic-helper-args.ts`, `mic-helper.ts`, `mic-adapter.ts`, `device-list.ts`, `helper-program.ts`, `production-parts.ts:1-420`, `capture-composition.ts:286-520`, `static.test.ts:994-1293`. Read by section or by search, NOT in full: `masterplan/01_specs.md`, `04_design_addendum.md` (4.2 and the headings), the records 064, 067, 068, 085c, 155, 190, 191, 199, 200, `test/079`, `verification/02_security.md`, `04_security_addendum.md` (6.2, AD-07), `boot/host-checks.ts`, `boot/program-checks.ts`, `alsa-config*.ts`, `mic-loss.ts`, the root README (D128, D163). A statement of this document that rests on one of those cites the line it rests on; anything else about them is not claimed.

Reading of revision 2 (row M1b): read in full - this design as it stood; `verification/08_security_macos_microphone.md`; the three measurement records; the decision rows U21 to U25, C92, C96, C97, C104, C106, C107; `implementation/191b`, `191c`, `p1`, `067`, `079b`, `085c`, `199`, `200`; `mic-helper-args.ts`; `production-parts.ts`; `WK/audio.c`, `micwatch.h`, `micwatch.c`. Read by section or by search, NOT in full: `usb-audio-production.ts` (header, refusals, limits, `:540-620`, `:740-860`), `production-door.ts` (`:1-80`, `:120-172`, `:245-275`), `capture-session/index.ts` (`:1640-1730`, `:1790-1812`, `:2070-2086` and search hits), `forwarder.ts` (`:60-125`, `:160-190`, `:325-430`), `sources.ts:120-236`, `manifest.ts` (`:1-20`, `:150-170`, `:214-290`, `:500-530`, `:800-835`), `audit-details.ts` (`:250-262`, `:640-690`), `CP/index.ts` (search hits and `:655-700`, `:890-900`), `capture-notices.ts` (`:81-120`, `:380-392`, `:455-500`), `mic-transport.ts:55-92`, `WK/capture_worker.c:160-182`, `WK/ingest.c:455-500`, `WK/guard/guard.c:1-40`, `types.ts` (the audio handle and adapter). NOT read: `WK/sink.c`, `ipc.c`, `anchor.c`, `announce.c`, the relay; the supervisor; the registrar; the web console. Nothing is claimed about them.

Reading of revision 3 (row M1c). Read in full: this design as revision 2 left it; `verification/08b_security_macos_microphone_addendum.md`; the decision rows U23, U24, U25, C104, C106, C107, C110; `implementation/191c_signed_audio_gap.md`, `r1b_video_absence_signed.md`; `WK/audio.c:60-669`. Read by section or by search, NOT in full: `verification/08_security_macos_microphone.md` (the outline, sections 5 and 10 - the addendum restates the rest); `test/mm3_macos_microphone_loss.md` (sections 0, 1, 4 to 6, 8, 9); `test/mm_macos_microphone_measurement.md` and `mm2_macos_microphone_48k.md` (their outlines only: their numbers are cited here as revision 2 cited them); `implementation/191b` (sections 1 to 4), `p1_production_platforms.md` (sections 4 to 6), `v4_fourth_contract_step.md` (item 6); `WK/capture_worker.c:160-182`, `worker.h:48-100` and search hits, `ipc.c` (search hits); `apps/capture-worker/test/static/` (the rule's header, the table's head, search hits); `CP/index.ts:345-358`, `:560-570`, `:660-680`, `:852-921`; `CS/capture/__tests__/protocol-pins.test.ts:40-125`; `CS/sealing-host/session-reader.ts` (the statements and function heads), `CS/sealing/pipeline/contract.ts:84-150` and search hits; `CS/capture/fence/sources.ts:120-236`; `CS/core/audit-details.ts:636-700`; the migrations by search; `SH/evidence-package/manifest.ts` (search hits, `:262-292`); `SH/evidence-verify/types.ts:405-422`, `:484-556`; `SH/evidence-verify/revisions.ts:1-60`; `SH/api/evidence.ts:375-475`; `SH/sim/capture-notices.ts:76-100`, `seal-blocked.ts:60-102`; `apps/transcriber/src/pipeline/document.ts:1-135` and search hits, `constants.ts:36-75`; `CS/transcription/index.ts` and `CS/evidence-export/` (search hits, `export-manifest.ts:1-40`, `:72-84`). The record of pass I-9b does NOT exist yet (its claim is `delegation_progress/file_claims.md:244`): what its item 11 built was read from the working tree (`SH/evidence-verify/types.ts:420-421`, `:540-556`). NOT read: the supervisor, the forwarder and the capture session beyond the lines revision 2 cites; the seal's pipeline file; the web console and the device shapes; the Core's verify operation; `WK/micwatch.c`, `ingest.c`, `sink.c`; decision C88. Statements about them are marked where they stand, or are revision 2's with its sources. No graph query was used: the repository has a context graph (`graft/`), and the places needed were named line by line by the addendum.

Statements of revision 3 that are this designer's reading or arithmetic and that no row has run, each marked where it stands: the identity of section 7.2a and that a copy in the place of the resampler is exact (read from the lines; row N3's marker stand-in shows it); that a session of this path will commonly open on a listed run (7.2a place 10); the sizes of the telemetry text, the account record and the verdict line (estimates); the margin of 1.5 points (8.3: computed from separate captures, not from one session); the order in which the account rows and the transcript document come to exist (8.6).

Alternatives considered in revision 3 and not taken: proving the resampler transparent in the place of leaving it out (7.2a: a proof that must be repeated with every library change); ONE audit type with a word that tells an account from a run (8.4: a required detail cannot depend on another detail in the closed-list form); a run that ends at every switch (8.2: two runs of 90 ms on either side of a switch would be 180 ms of silence with no position); a new version of the transcript document with a member on its segments (8.6: it changes a sealed form, its hash field and operation 84's literal for a mark that three flag texts carry); one verdict line (8.4a: over the bound of a line); the addendum's margin of 2.0 points (8.3).

## 14. The option the user has NOT taken (decision C107, last sentence)

A small reader of this Mac's own audio interface, a program of the repository in the place of the pinned tool for the macOS microphone only. Not designed here; stated so that the choice stays visible. What it would change in this design, in five lines:

1. THE SHORTFALL might end: a reader the system calls with every buffer does not poll every 11.9 ms. Whether macOS and the device deliver all 48,000 samples a second is NOT measured (MM3 s7); the program's first job would be to prove it by a count over 60 s.
2. THE HELPER ROW (4.2), the forbidden list (4.2a) and SR-15 would be replaced by that program's own fixed argument list and a new named amendment; the layout-word table, the queue lines and the refused-open retry (4.6, 4.7) would fall away or change.
3. IDENTITY could be the device's unique identifier in listing and capture alike: the name tie, the third listing and the "both refused" limit of two same-model devices (3.3, W1, W2) would go; the permission status could be asked without an open (section 5).
4. THE EVIDENCE keeps its members: `audio.samplesNotReceived` would then read zero, or state what that reader loses; the worker's gapped kind and its counts stay as the measurement of it (7.2, 8.2 to 8.4).
5. THE PRICE: a new native program in the evidence path - its build, its signing, its review and its tests - against the user's standing preference for ready-made parts and U25 ("use what is there"). It needs the user's word.

---
*Generated: 2026-10-13 16:14*
*Last Updated: 2026-10-13 18:15 (revision 2, row M1b)*
*Last Updated: revision 3, row M1c - amended to the security addendum 08b (decision C110); the host time is in the header*
