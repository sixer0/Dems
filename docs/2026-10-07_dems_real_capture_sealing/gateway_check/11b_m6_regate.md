---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 81 - M6 milestone gate (transcription), RE-GATE after fix waves H and I
date: 2026-10-10
agent: verifier (independent +1; brief `delegation_progress/gate_brief_wave_g.md`; environment `initialization/07_gate_environment_wave_i.md` with note 06 and section 10 of `gateway_check/10c_m5_regate.md`)
tree: 57b80a9 (`git diff --stat 57b80a9 -- apps packages scripts`: empty)
first_gate: gateway_check/11_m6_gate.md (PASS WITH CONDITIONS, tree f293221)
narrative_tier: 2
status: needs-review
verdict: PASS WITH CONDITIONS
---

# 11b - M6 milestone gate, re-gate (row 81)

No speech-to-text speed, throughput or real-time figure is in this report (D230). The speech
fixture and every recording stayed silent: nothing was played aloud (the browser ran with its
audio muted and the sealed player was opened paused, never started). No local device (`CAM-03` /
`MIC-03`) was selected, pre-checked or started. No fixture account, password or token is written
here. The service on port 8000 was never called. No product or test file was changed.

## 0. What changed since the first gate, in one table

| First gate said | Now |
|---|---|
| "The decoder of the real engine has still not transcribed a product session" | **It has.** Session `SES-20261010-0031`, started and ended on the TABLET, `MIC-01` = the synthetic speech fixture, backend `cpu-local`: 4 chunks, 0 failed, 19 segments, each segment word for word the scripted sentence at its place in the looped script (19 of 19; segments 0-8 = the 9 scripted sentences, 78 of 78 words), language `id`, sealed `ASSEMBLED` inside the package, verify `PASS` 15 of 15 |
| `-ng` never issued by the product | Seen in the process table while the session was `RECORDING`: `/…/whisper-cli -m …/ggml-large-v3-turbo.bin -ng -t 8 -l id -oj -of …/stt-<uuid> -f …/.transcriber/sessions/SES-20261010-0031/work/chunk-1.wav`, niceness 10 |
| No chunk, so no per-chunk audio source | Checkpoint read while it existed: chunk index 0 `audioSource: MIC-01`, `status: DONE`, 6 segments, written while the cameras recorded |
| Revisions could not be created (no segment) | Five revisions made live: four on `EV-20261010-0020` (web dialog, API, two authors), one on the interrupted `EV-20261010-0017`; shown on web and tablet without a reload; verify `PASS` with V-11 after each append; heads kept across a Core restart |
| G75-01 reproduced (invented integrity rows) | Gone: 0 `FRAME_HASH` / `WRITE_VERIFIED` / `TIMESTAMP_CONFIRMED` rows on lane 2's chain (210 rows); the sealed extract of `SES-…-0031` holds 4 rows, all real |

## 1. Verdict

**PASS WITH CONDITIONS** for M6. Entry condition met. No BLOCKER and no MAJOR was found in the
M6 subject (transcription, transcript in the package, reading, revisions, STT settings). First-gate
conditions C1, C2 (one clause left), C4 and C5 are closed. What keeps this from a plain PASS:

| # | Condition | Owner |
|---|---|---|
| R1 | The SERVER backend is still not proven live (`M6-TF-1` on `omlx-server`, `M6-STTCFG-UNREACH`, op 92 against a server, endpoint / credential save). Not run: user's rule. Tests only | user |
| R2 | `M6-KR-1` in its product form (a) - the Core killed while the engine decodes, then the resumed run - was NOT driven: I would not SIGKILL the Core of a lane I hand on. Driven instead: the engine child killed mid-chunk (retry, committed chunk untouched, sealed `ASSEMBLED`), section 6. Form (a) rests on `kill-resume.test.ts` and on `EV-20261010-0018` (a graceful stop, one chunk) | controller: accept, or schedule one attended kill |
| R3 | `PARTIAL` (both forms) and speaker state `LABELLED` were not produced live; nor was a no-speech session after the wording fix (first-gate G81-05). Tests only | controller |
| R4 | Findings G81b-01, -02, -04, -05, -06, -07 (all MINOR, M6 subject) | fix wave owners named in section 8 |
| R5 | **G81b-03 (MAJOR, NOT in the M6 subject): on the tablet Session Summary the buttons "Done" and "View in Evidence" and the "Sealed files" rows do not answer a tap.** Met at the end of the M6 flow; the surface is M5 / M7's. I do not count it against M6. If the controller rules that it does, M6 is FAIL on that one item | controller (ruling); owner of the mobile session summary |

## 2. Entry condition (0 Blocker / Major open for M6)

The four MAJORs of review 80 and R93-02 were confirmed fixed in code at the first gate (its
section 2). The files that hold those fixes are byte-identical since: `git diff --stat f293221
57b80a9 -- apps/transcriber/src apps/core-server/src/transcription
apps/core-server/src/modules/transcripts apps/core-server/src/sealing/finalize-transcript
apps/core-server/src/modules/stt-config` prints nothing. Wave H / I touched the clients
(`apps/core-web/src/features/evidence`, `apps/mobile/src/features/evidence`, the STT section's
hint) and the capture fence (the speech microphone), not the transcript server. Each of the five
is now also seen live with a real transcript:

| Finding | Live at this re-gate |
|---|---|
| R80-01 summary on the item | op 40 `evidence.transcript {state READY, sha256, revision, labelsStatus, failedChunks}` for all eight speech items; same after the restart (`transcripts.heads items 10`) |
| R80-02 intervals to the runner | chunk `audioSource: MIC-01` in the checkpoint; sealed documents carry `intervals`, no `intervals_incomplete` |
| R80-03 runner stops at close-out | no `whisper` / `capture-worker` / `ffmpeg` process after either seal (`pgrep` exit 1) |
| R80-04 tap removed | log `TRANSCRIBER_SCRATCH_REMOVED why SEALED`; `.transcriber/sessions/` empty; `find … -name tap.pcm` no hit |
| R93-02 case scope on 84 / 85 / 86 | section 5.3 |

## 3. Checks

Surfaces: W2 = web console lane 2 (headless Chromium over CDP, audio muted), T = tablet
`emulator-5556` (lane 2), P = phone `emulator-5554` (lane 1), W1 = web lane 1, API = the lane's
Core through the web origin, FILE = sealed package read as text, PS = process table.

| ID | Surface | Result | Evidence |
|---|---|---|---|
| Entry (0 Blocker / Major) | code + live | PASS | section 2 |
| `M6-RG-*`, `M6-QA-1` | suites | PASS (mapped, not re-run by me) | section 7 |
| **`M6-TF-1` on `cpu-local`** | T + FILE + API + PS | **PASS** | section 4 |
| `M6-TF-1` on `omlx-server` | - | not run live (user's rule) | R1 |
| `-ng` quoted (AU3-03) | PS | PASS | section 0; the same form for `chunk-2.wav` in session `-0032`. The engine's own "no GPU" line is not kept by the product (D201 (6), accepted limit) |
| **`M6-DF-1` on `cpu-local`** | FILE + API + PS | **PASS on the sealed package**; `recording_fragments` itself not read | engine processes for `chunk-1.wav` and `chunk-2.wav` seen while `session/current` said `RECORDING`; manifest `files[].fragments[].seq` 1..37 and 1..38, contiguous, 0 repeats; V-07 PASS; no capture fault alert. Same in `-0032` (1..38, 1..36). I have no reader for the table (no database credential): the judgement is on the manifest the table was sealed into. Host load about 3 |
| `M6-KR-1` | PS + FILE + log | **PARTLY**: engine kill PASS; Core kill NOT PROVEN live | section 6; R2 |
| `M6-LB-1` | FILE, W2, T | PASS for UNAVAILABLE; LABELLED tests only | `speaker_state UNAVAILABLE`, `speaker_reason ENGINE_NOT_CONFIGURED`, flag and chip "speaker labels unavailable" on every item |
| `M6-AD-1`, `M6-CP-1` | suites | PASS (mapped) | transcriber 561 passed; niceness 10 on the engine seen live |
| `M6-STTCFG-API` | API | PASS | op 90: 200 for the three roles, `credentialSet false`, no credential member; ops 91 / 92 as INVESTIGATOR: 403 `NOT_PERMITTED` (`permission CAPTURE_CONFIG`), rows seq 156, 157; stale `revision`: 409 `INVALID_STATE` / `REVISION_CONFLICT` / `currentRevision 8`, no row; **non-loopback endpoint: 422 `INVALID_INPUT` / `ENDPOINT_NOT_LOOPBACK`, nothing stored** (not driven at the first gate); a Save that changes nothing: revision stays 7, no row |
| `M6-STTCFG-NEXT` | API + FILE | **PASS, now with a change DURING a recording** | op 91 `enabled false` while `-0031` recorded: 200 `appliesFrom NEXT_SESSION`, `revision 10`; `-0031` sealed with `configSnapshot {enabled true, revision 9}` and a full transcript; back on (`revision 11`) before the next session; `-0032`'s snapshot `revision 11` |
| `M6-STTCFG-OFF` | - | not re-driven | passed at the first gate; server files unchanged |
| `M6-STTCFG-UNREACH` | - | not run live (user's rule) | R1 |
| `M6-STTCFG-WEB` | W2 | PASS; G81-03 closed; one finding (G81b-05) | Supervisor: switch, backend select, model, language fixed, labelling, credential "Not set", Save, Test connection (`w2_01`). **Technician saved a change** (seq 158, `updatedBy OPR-003`; not driven before) and ran the test: "Reachable, model available". Investigator: every control disabled, hint "Read-only: Requires the Supervisor / Technician role." (`w2_04`). One `STT_CONFIG_CHANGED` row per save: `{changedFields "enabled", credentialChanged false, revision N}` (seq 155, 158, 163, 167). Not seen: the "Checking your permissions…" moment; the server address field |
| `M6-STTCFG-TAB` | T | PASS (G81b-05) | read-only sentence, Enabled, Local CPU, model, labelling On, credential Not set, last test + time; no edit control; the pending note appears |
| `M6-STTCFG-PHONE` | P | PASS | the same card, "Not tested yet", no edit control |
| Snapshot at start | log + FILE | PASS | `STT_SNAPSHOT_TAKEN enabled true backend cpu-local revision 9` at the start of `-0031`; the manifest carries it |
| "Start refused when STT cannot start" | - | **not a behaviour of the product; not driven** | by design the start is never refused for the transcriber: `transcription/index.ts:243` "the STT snapshot of the session could not be taken; no transcription will run for it; capture is not affected" (tx spec line 278: capture is never blocked). No supported switch exists |
| Transcript step on the surfaces | T, W2 | PASS | T Finalizing: steps 1-2 done, "Finalize transcript" running, then all six done (`t2_07_finalizing_3`, `_8_last_step`); W2 dialog "3/6: Active" then "Done", banner "Sealing evidence • step 3 of 6". The time-left line is G75c-05 again ("about 1680 s left") |
| Summary on the item | W2, T, API | PASS for state / in-package / labels / hash / revision; **chunks, language and model are on no client** (G81b-06) | section 4 |
| Model provenance `cpu-local` | FILE + API | PASS | manifest and document: `ggml-large-v3-turbo`, version `large-v3-turbo` (= `modelVersions` of `.data/transcriber/host.json`), quantisation `f16`, SHA-256 `1fc70f77…e2bc69` = my own `shasum` of the model file; op 41 `transcriptModel.report` "… version large-v3-turbo (declared by the installation), quantisation f16, file SHA-256 …", `reportedByServer false` |
| Transcript reading | W2, T | PASS | section 5.1 |
| Microphone-switch intervals | W2 + FILE | PASS | section 5.2 |
| `access.readTranscript` / G81-07 | W2, T, API | **PASS on the web; NOT closed on the tablet** (G81b-02, G81b-07) | section 5.3 |
| Revisions live (C2) | W2, T, API, FILE | PASS; one clause NOT PROVEN (the web's 409 keeping the text) | section 5.4 |
| Revision on an interrupted item | W2 + API | PASS | section 5.5 |
| Transcript of the interrupted / resumed items | FILE + W2 | PASS, one finding (G81b-04) | section 5.5 |
| Verify (op 41) | API, W2, T | PASS | `EV-…-0020` 15 of 15 on API, web ("Checks of this run · 15 of 15", `w2_08` DOM) and tablet (`t2_16`); V-10, V-11 PASS before and after four appends; `EV-…-0015`, `-0017`, `-0018`, `-0021` PASS; **demo `EV-20261009-0005` still `TAMPERED`**: V-04 `FRAGMENT_HASH_MISMATCH` + `FILE_HASH_MISMATCH`, V-06 `CHAIN_BROKEN`, V-08 `FRAGMENT_TAMPERED`, V-05 SKIPPED, transcript state `DISABLED_BY_CONFIGURATION` |
| Heads after a Core restart | API, W2, log | PASS | section 5.6 |
| Scratch and tap removed | files + PS | PASS | section 2 |
| Simulated mode | W1, P, API | PASS; G81-01 closed | API 409 `TRANSCRIPT_NOT_READY` / `SIMULATED_ITEM`; W1 and P: "Transcript state not reported" + "This is a simulated item: the Core server keeps no transcript for it." (`p1_01`); no revise control |

## 4. The speech session from the tablet (`SES-20261010-0031` -> `EV-20261010-0020`)

Signed in on the tablet as the seed investigator (biometric offer answered "Not now"). Home ->
Start Session -> form -> Devices Check (8 of 8, `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`, all
"Development source / Test source") -> Start Recording. Recording 96 s (22:35:15 - 22:36:51),
ended on the tablet with a reason. Rows `SESSION_CREATED`, `PRECHECK_PASSED`,
`RECORDING_STARTED`, `RECORDING_STOPPED` carry `DEV-0001` (seq 160-162, 165).

- FILE manifest `transcript`: `state ASSEMBLED`, `failedChunks 0`, `file transcript/transcript.json`,
  `sha256 ad5dbf17…af3197af`, `revisionHead 0`, `speakerState UNAVAILABLE`,
  `configSnapshot {backend cpu-local, diarization true, enabled true, model ggml-large-v3-turbo,
  revision 9}`, model as in the table above. My hashes of `transcript.json`, `.srt`, `.vtt` equal
  the three manifest values.
- FILE `transcript.json`: `header {backend cpu-local, chunks 4, failed_chunks 0, language id,
  state ASSEMBLED, partial_reason null, audio PCM_TAP 48000}`, `intervals [{from_ms 21, source
  MIC-01, to_ms 96531}]`, `qa_flags ["speaker labels unavailable"]` - no `no_speech`, no
  `intervals_incomplete`. 19 segments, each `{index, start_ms, end_ms, text, speaker null}`,
  ordered, no overlap.
- **`M6-TF-1` fidelity, text only** (the fixture's `dialogue.reference.json`, lower case,
  punctuation removed): the fixture is 9 sentences, looped. Segment i equals reference sentence
  `i mod 9` for all 19 segments; segments 0-8 hold 78 words, the reference 78. So: non-empty
  segments with timestamps, at least one segment per scripted sentence, language `id`, sealed and
  verified inside the package, speaker state UNAVAILABLE with its flag.
- API op 84: 200, 19 segments, `speakerState UNAVAILABLE`, the same hash, `revision 0` then.
  Op 40: `evidence.transcript {state READY, sha256 = machineTranscriptHash, labelsStatus
  UNAVAILABLE, revision, failedChunks 0, backendUnreachable false}`; `audioSourceIntervals`
  1 entry; `media {LIVE_STREAM, [VIDEO-01, VIDEO-02]}`; `access {play, readTranscript}` true for
  the holder. Op 41: section 3.
- W2 item page: "Transcript assembled", "Inside the sealed package", "speaker labels
  unavailable", "Sealed original — immutable", 19 rows `m:ss–m:ss` + text + "Revise", "Revisions:
  No revisions" (`w2_06`). T: the same chips and rows (`t2_11`). T Session Summary: "Transcript
  hash ad5dbf17…af3197af", "Speaker labels: speaker labels unavailable", signature "Ed25519, Core
  key CORE-KEY-EVSIGN-01" + "Signed with a DEVELOPMENT key — not a production signature" - no
  "SIMULATED" chip (`t2_09`; first-gate G81-02 closed).
- Not on any client: the number of chunks, the language, the model (G81b-06).
- Core log of the session: 17 error-level `ASSEMBLY_REFUSED / TRANSCRIPT_NOT_COMPLETE` lines
  while the seal waited (G75c-08, known), then `TRANSCRIBER_SESSION_CLOSED phase COMPLETE`,
  `SEALING_COMPLETE`, `TRANSCRIBER_SCRATCH_REMOVED why SEALED`.

## 5. Reading and revisions

### 5.1 Reader

Web and tablet show the same thing for every speech item: state chip, in-package chip, speaker
chip, the immutable note, one row per segment with start-end and text, a derived block under a
revised segment, the revision list. Speaker labels: none is drawn and none is invented; the spec
promises a label only when LABELLED (ux 7.2). Search inside a transcript: not specified (ux 7),
none exists - not a finding.

### 5.2 The microphone switch (`EV-20261010-0015`, `-0016`)

Sealed documents: `intervals [(MIC-01, 21, 26321), (MIC-02, 26321, 60741)]` and `[(MIC-01, 21,
28401), (MIC-02, 28401, 69801)]`, equal to the manifests' `audio.sourceIntervals` (`START`,
`MANUAL`). Speech ends where the tone microphone takes over: 6 segments each, the last one cut
at the switch. W2 sealed player of `-0015` (opened, paused): two "sealed file" test patterns and
the band "AUDIO SOURCE · MIC 1 0:00–0:26 · MIC 2 0:26–1:00" (`w2_16`). The transcript pane
itself does not mark the switch; the spec does not ask it to.

### 5.3 Who may read (`access.readTranscript`, G81-07)

| Who, where | What happened | Audit |
|---|---|---|
| Holder (investigator), supervisor: W2, T, API | transcript and revisions shown; `access.readTranscript true` | no denial row |
| TECHNICIAN (outside the case), API ops 84 / 86 | 403 `NOT_PERMITTED`, `details.reason EVIDENCE_CASE_SCOPE` | one `ACCESS_DENIED` each (seq 177, 178) - as specified for a direct call |
| TECHNICIAN, API op 85 | 403, `permission TRANSCRIPT_REVISE` (the role matrix refuses first) | seq 176 |
| TECHNICIAN, op 40 | 200, `access {play false, readTranscript false, export false}` | - |
| **TECHNICIAN opens the item on W2, twice** | "You are not permitted to play this recording." / "You are not permitted to read this transcript.", Play disabled (`w2_13`) | **no new row: head stayed seq 178. G81-07 closed on the web** |
| **TECHNICIAN opens the item on T, first view after the investigator had it open on that tablet** | the same two sentences plus "Your role cannot read this transcript." (`t2_14`) | **two `ACCESS_DENIED` rows, `DEV-0001` (seq 181 `getTranscript`, 182 `listTranscriptRevisions`)** - G81b-02 |
| TECHNICIAN on T: another item; the same item again; again after technician -> sign-out -> technician | op 40 only | no row |

### 5.4 Revisions on `EV-20261010-0020` (ops 84-86)

| Step | Result |
|---|---|
| W2, holder, "Revise" on segment 1 | dialog "Revise segment 1 … The sealed transcript is not changed.", SEALED ORIGINAL shown, text and reason fields, "based on the sealed original" |
| Reason of 4 characters | "Sign and append" disabled; with a longer reason enabled |
| Save | toast "Revision 1 appended"; under segment 1: "Revision 1 · derived, not part of the sealed transcript · by AKP Budi Santoso" + the new text; list "Revision 1 by … · based on the sealed original · Signed by the Core key CORE-KEY-EVSIGN-01" (`w2_10`) |
| Tablet, untouched, 3 s later | the same derived block under segment 1 (`t2_12`): the head moved without a reload |
| Audit | one `TRANSCRIPT_REVISED` (seq 171): `{number 1, revisionId TRV-000001, authorId OPR-001, baseRevision 0, changeCount 1, machineTranscriptHash ad5dbf17…, reason}` - no transcript text |
| Original preserved | `transcript.json` SHA-256 unchanged (`ad5dbf17…`), op 84 still the 19 sealed segments with `revision 1`; `transcript-revisions.json` holds the signed record (`body`, `parentSha256`, `sha256`, `signature {Ed25519, CORE-KEY-EVSIGN-01, certificateSha256}`); no `.next` file left |
| Verify after the append | `overall PASS`, V-10, V-11, V-14 PASS; notices: `AUDIT_EXTRACT_NOT_SIGNED` only - **no `REVISION_APPEND_PENDING`** (the settled state; the pending notice itself was not observed) |
| Second author: supervisor, API, segment 3, `baseRevision 1` | 201 `TRV-000002` (seq 173); web and tablet show "Revision 2 … by AKP Andi Pratama" at once |
| Web dialog open on segment 2 while that happened | its line changed from "based on revision 1" to "based on revision 2" by itself; Save -> "Revision 3 appended" (seq 174, `baseRevision 2`). So the web's 409 with the typed text kept was NOT reached: NOT PROVEN live (G81b-09) |
| API, stale `baseRevision 1` | 409 `TRANSCRIPT_REVISION_CONFLICT`, `currentRevision 3`, the specified sentence; no row |
| API, reason of 3 characters | 422 `INVALID_INPUT` |
| **API, `from` text that is not the segment's text** | **201 `TRV-000004`, signed and appended (seq 175)** - G81b-01 |
| Op 86 | 4 items, newest first, each with number, author, base, signature, changes; `nextCursor null` |

### 5.5 Interrupted and resumed items (`EV-20261010-0017`, `-0018`)

- Both hold a transcript of the recorded prefix: `-0017` (worker killed, 31 s) 2 chunks, 7
  segments, the first 6 equal to the script and the 7th cut at the end of the recording; `-0018`
  (Core stopped while recording, sealed by the boot resume, 26 s) 1 chunk, 6 segments, 5 equal
  and the last cut. `state ASSEMBLED`, `partial_reason null`, `failed_chunks 0`.
- Stated as interrupted where the spec puts it - on the package, not on the transcript: manifest
  `CLOSE_TRACKS.checkpoint.interrupted true`, op 41 `interrupted true` with V-12 PASS, web header
  "Sealed — recording was interrupted / Cause: CAPTURE_FAULT" (`w2_14`; the code as cause is
  G75c-03, known), tablet list row "Sealed — recording was interrupted". The pane says
  "Transcript assembled". tx spec line 170: "the durable part is sealed flagged `interrupted`
  with the transcript state recorded" - met.
- The sealed DOCUMENT of both has an open interval: `intervals [{source MIC-01, from_ms 21,
  to_ms null}]`, and no `intervals_incomplete`; the manifest states the end (31122 / 26537).
  G81b-04.
- Revision on the interrupted item, from the web: "Revision 1 appended" on segment 6 (seq 190,
  `SES-…-0027`); verify after it `PASS`, `interrupted true`, no pending notice.

### 5.6 Core restart (needed for "the head after a restart", first-gate C2)

`scripts/lane/lane.sh stop 2` then `start 2 --with-camera-stub --speech-mic` (output to a 0600
file), no reset. Boot: `TRANSCRIBER_RESOLVED cpu-local vad READY`, `DEV_FAKE_MIC_SPEECH`,
`transcripts.heads items 10`. After it, with no action on the items: op 40 `EV-…-0020 revision
4`, `EV-…-0017 revision 1`, `-0021` and `-0015` `revision 0`; op 86 the same four records;
verify `EV-…-0020` `PASS`, no pending notice; W2 shows the four derived blocks and the list
(`w2_17`, DOM). The tablet had moved by itself to the Session Summary of `-0032`; its reader was
not read again after the restart.

## 6. Engine kill (`SES-20261010-0032` -> `EV-20261010-0021`, API session, 92 s)

One more short session, started through the API as the investigator. A scratch helper waited
until the checkpoint showed chunk index 0 `DONE`, copied the checkpoint, and sent SIGKILL once to
the next `whisper-cli` of that session (its file: `chunk-2.wav`), while the session recorded.

- Core log: `ENGINE_FAILED reason ENGINE_EXIT_NON_ZERO signal SIGKILL` (error), then `a chunk
  attempt failed chunkIndex 1 attempt 0 retriesLeft 2` (warn). No fault on the session, no alert.
- The chunk was decoded again and finished; the recording went on; stop -> `SEALED`.
- Sealed document: `ASSEMBLED`, 4 chunks, 0 failed, 19 segments (18 word-equal to the script, the
  last cut at the stop). **The 6 segments of chunk 0 in the checkpoint copied BEFORE the kill are
  text-identical to segments 0-5 of the sealed document**: the committed chunk survived and was
  not replaced. Fragments 1..38 / 1..36 contiguous; verify `PASS` 15 of 15; scratch gone, no
  process left.
- What this is not: a kill of the transcriber's own process (it lives inside the Core). R2.
- Observation: after the retry the checkpoint read `seq 2, failedSeqs []` for that chunk - the
  failed attempt is in the log, not in the checkpoint (note 125 expected a new row number).
  Not judged (G81b-09).

## 7. Regression and quality checks (`M6-RG-*`, `M6-QA-1`) - mapped, nothing re-run by me

| Check | Run that proves it | Result |
|---|---|---|
| typecheck x 7, lint x 7 | `test/09_precommit_wave_i.md` rows 1, 2 (tree = wave I before the commit) | exit 0 x 14 |
| shared, capture-protocol | rows 3, 3b | 2570 / 31 passed |
| core-server unit | row 4 | 6517 passed, 0 failed |
| core-web | row 6 | 2069 passed |
| transcriber | row 8a | 561 passed, 3 host-conditional skips |
| core-server db | row 5: RED, 3 tests in 2 files; `implementation/138_pin_moves_wave_i.md`: pins moved, the 2 files re-run, 51 passed | green for those files; **the whole db project was not run again after the pin moves** |
| mobile | row 7: RED, 1 test; note 138: `pending-control.test.tsx` 10 passed | same limit |
| seal e2e, kill matrix, development e2e | rows 9, 10, 11 | 3 / 35 / 2 passed |
| speech session e2e (`DEMS_DEV_SPEECH_SESSION_E2E`) | NOT in the wave I run (skipped by its guard); last green at pass H-Y on the wave H tree (`implementation/130`) | superseded here by two live speech sessions |
| transcriber `test:real:*` | not run (first gate: same) | - |

The transcript server's source is unchanged since `f293221` (section 2), so the first gate's
targeted runs (111 core unit tests of the transcript units) still describe the code.

## 8. Findings

| ID | Sev. | What | Steps / evidence | Spec / ruling |
|---|---|---|---|---|
| **G81b-01** | MINOR (ruling asked: it is a Core-signed record) | Operation 85 signs and appends a revision whose `changes[].from` is not the text of the segment. Sent `{segmentIndex 4, from "not the sealed text", to "Berapa lama?"}` -> 201 `TRV-000004`, in `transcript-revisions.json` and in op 86 as sent. The route checks only that the segment exists (`modules/transcripts/routes.ts:429`). The clients draw the original from the sealed document, so no screen shows the false `from`; a reader of the package's revision list does | section 5.4; audit seq 175 | contract op 85 names `from` and states no rule; tx spec A.6 "the original is never mutated" holds. Either the Core holds `from` to the segment's current text or the member is documented as the author's claim |
| **G81b-02** | MINOR (first-gate G81-07 not closed on the tablet for this path) | After a change of operator on a tablet, the next operator's first view of the item the previous one had open asks ops 84 / 86 with the PREVIOUS operator's access and writes two `ACCESS_DENIED` rows against the new operator. Logcat order: `GET …/transcript 403` before `GET /evidence/{id} 200`. Cause read in code: the item answer is cached under `['core-server', 'evidence-media', evidenceId]` with no operator in the key (`apps/mobile/src/features/evidence/use-evidence-media-ref.ts:50-52`) and is used while it refetches (`:71`). Two controls without the operator change wrote no row. The web was tested only with a full page load per role; a sign-out / sign-in inside one page was not driven | section 5.3; seq 181, 182 | D208: "a non-holder's page view … wrote the audited `ACCESS_DENIED` row (G81-07 was not actually fixed)" |
| **G81b-03** | **MAJOR - outside the M6 subject (tablet Session Summary; M5 / M7 surface)** | On the tablet Session Summary, scrolled to its end, "Done", "View in Evidence" and the rows of "Sealed files" (tried: Transcript hash) do not answer a tap; "Manifest hash" higher up opens its sheet; the header Back works and acknowledges the summary. Seen on two sessions (`-0031` four taps, `-0032` three). The view tree gives the reason: scrolled, the right pane reports `bounds [1085,176][2400,580]` while its content is drawn down to y ≈ 1490 - the buttons lie outside the pane's own box, where Android delivers no touch. The two buttons are below the fold at the top position, so they are reached only in the dead state. The phone's "View in Evidence" (one column) works | section 4; `t2_19`, `t2_20`, `t2_09` | ux flow 4: the summary's closing actions |
| **G81b-04** | MINOR | The sealed transcript document of an interrupted recording has an interval without an end (`to_ms null`) and no `intervals_incomplete` (`EV-…-0017`, `-0018`); the manifest has the end | section 5.5 | tx spec line 317: "the transcript covers the durable timeline and records `intervals_incomplete` if the interval map is truncated" |
| **G81b-05** | MINOR (first-gate G81-09, now on the screens) | "A saved change is waiting: it applies to the next session." (web) and "Changed — applies to the next session / The session that is open keeps the settings it started with." (tablet) are shown when NO session is open: `pendingForNextSession true` for a change saved after the last session was sealed and its summary acknowledged (seq 142 before, seq 155 the save). It turns false only when the next session has started. By code the test is "a row in `active_session`", which the last sealed session keeps | section 3; `w2_04`, tablet view tree | ux 8a: the note is for a change "saved while a session is open" |
| **G81b-06** | MINOR | Which model made a transcript is shown on no client. Op 41 answers `transcriptModel {name, version, quantisation, modelSha256, reportedByServer, report}`; neither app reads it (`grep transcriptModel apps/core-web/src apps/mobile/src`: no hit) - both verify panels say only "Transcript sealed". Chunk count and language are not shown either | section 4 | D160: "The verify report must print that the model was reported by the STT server and not verified by the Core" - with a server backend that sentence would reach no operator |
| **G81b-07** | MINOR | Tablet, reader outside the case: under "You are not permitted to read this transcript." a second, red line says "Your role cannot read this transcript." The cause is the case, not the role (the wording half of first-gate G81-07; the web no longer has it) | `t2_14` | - |
| G81b-08 | MINOR (not M6; tablet Session Live) | The recording clock is half covered by the "AUDIO MONITOR" card: only the upper half of the digits is visible, in all three pictures of a 96 s recording | `t2_04`, `t2_05`, `t2_06` | ux flow 3 |
| G81b-09 | NOTE | (a) An open web revise dialog adopts a new head silently ("based on revision 1" -> "2"); a second author's change to the SAME segment would not be shown in it either. (b) The reason of a revision is signed and audited but shown in neither revision list. (c) `revisionId` is numbered per item (`TRV-000001` exists on two items). (d) A killed engine attempt leaves no trace in the checkpoint (section 6) | section 5.4, 6 | ux 7.5 "Conflict: reload revisions, then re-edit" |
| G81b-10 | NOTE (for gate 94) | The sealed player says "Audio at the playhead: no interval" at 0:00 (the first interval starts at 21 ms). Opening the player wrote two `EVIDENCE_MEDIA_SERVED` rows though nothing was played | `w2_16` | - |

Known findings met again, not re-reported: **G75c-01** got in my way on every surface (header
"CRITICAL / Core was not running", tablet Home "SYSTEM CRITICAL / Recording Blocked" with Start
Session working, web System "Recording Engine: Stopped / 1 SERVICE NEEDS ATTENTION"); it changed
no check. Also G75c-05 (time-left line), G75c-08 (error-level lines per seal), G75c-09 (tablet
`SUMMARY_ACKNOWLEDGED` without a device, seq 170), G75c-11 ("No DEMO package exists for this
item." in the web seal dialog, `w2_05`), G75c-03.

## 9. First-gate conditions and findings: state

| Item | State |
|---|---|
| C1 speech session on `cpu-local` | **closed** (section 4) |
| C2 revisions live | **closed**, except "the 409 keeping the typed text" on the web (not reachable through the dialog; API 409 proven) |
| C3 server backend live | open - user (R1) |
| C4 R80-16 limits | closed by ruling D201 (3); both sessions here sealed `ASSEMBLED` well inside the step |
| C5 / G81-04 (G75-01) | **closed** |
| G81-01 simulated wording | closed (W1, P) |
| G81-02 "SIMULATED" beside a real signature | closed (T Summary) |
| G81-03 role hint | closed (W2) |
| G81-05 no-speech shown as success | NOT re-driven live (no tone-only session); client tests of wave H C2 |
| G81-06 op 40 without a transcript member | closed (`evidence.transcript`) |
| G81-07 `ACCESS_DENIED` on a view | closed on the web; open on the tablet (G81b-02, G81b-07) |
| G81-08 step completes before it starts | not re-driven (gate 89's; fix has a shared test, note 120) |
| G81-09 `pendingForNextSession` | open, restated as G81b-05 |
| G81-10 "No DEMO media" on a REAL item | closed on the item page (sealed player); the seal dialog's line is G75c-11 |
| G81-11 step durations on the Summary | unchanged, the controller's D230 ruling is still asked; no figure repeated here |
| G81-12 "busy" / stock picture | not seen ("No preview" tiles; Next and Start Recording announce their names) |
| G81-13 first tap on Settings | explained by note 129 and confirmed: with the offer answered and the toast closed, the first tap navigated |

## 10. Skipped / user-attended / not run live

| Item | Reason |
|---|---|
| Everything on the SERVER backend | user's rule; port 8000 never called; no server value put into the form or a request except the one refused non-loopback endpoint |
| Biometric sign-in | skipped by the user's instruction (D151); the offer answered "Not now" four times on the tablet, once on the phone; never passed |
| Local devices, attendance variables, the local-device notice | never selected or set; not part of a flow here |
| Boot refusals of the speech microphone (`DEV_SPEECH_FIXTURE_UNUSABLE`, `DEV_FAKE_MIC_NEEDS_DEV_SOURCES`) | not driven: they need the fixture moved aside and a lane started with other settings; tests of notes 125, 128 |
| Core SIGKILL while decoding (`M6-KR-1` a) | R2 |
| Transcriber `test:real:*`, whole suites | not run |
| Camera search, stub, `CAM-04` | not touched |

## 11. Not covered, and why

1. `PARTIAL` in both forms, `LABELLED`, a no-speech session, a backlog at the step limit.
2. The pending notice `REVISION_APPEND_PENDING` itself (only its absence after each append).
3. "Checking your permissions…" on the STT section; the server address field.
4. A change of operator inside one web page (G81b-02's web counterpart).
5. The tablet reader after the Core restart; the phone on a real-capture lane (paired to lane 1).
6. `recording_fragments` read as a table for `M6-DF-1` (no database credential by rule).
7. `masterplan/02_plan.md` and `implementation/99_implementation_report.md`: the task asked for
   this one file.

Lapses of mine, for the record: (a) the first End Session tap on the tablet missed the button
(the keyboard had moved the dialog), so the recording is 96 s, not 60-90, and the stop reason on
seq 165 reads "Gate81binterview completeu"; (b) my first click on the web switch hit its label
row and a Save with no change followed (no row - which is the specified result); (c) revision 4
of `EV-…-0020` is a deliberate wrong-`from` probe and stays in that package for good; (d) I
opened the sealed player once to read the band (two media rows, nothing played).

## 12. Screenshots (`.cache/gates/81b/`)

Read by me:

| File | Shows |
|---|---|
| `t2_00_login.png` | tablet Login, "Core online", "paired as DEV-0001", the dev toast across the bottom |
| `t2_02_home.png` | tablet Home: "SYSTEM CRITICAL / Recording Blocked / • Core was not running" (G75c-01), four development-source tiles, Start Session |
| `t2_03_recording.png` | tablet Active Session `SES-20261010-0031`: "Connecting cameras...", cards CONNECTING, End Session dimmed with its sentence |
| `t2_04_recording_live.png` | the same recording: REC, both meters, "14 fragments saved"; the big clock half hidden by the Audio Monitor card |
| `t2_05_recording_70s.png` | later in the recording: "48 fragments saved", the clock still half hidden |
| `t2_06_end_dialog.png` | "End Session?" with the required reason, button dimmed |
| `t2_07_finalizing_3.png` | tablet Finalizing: steps 1-2 done, "Finalize transcript" running, "This step: about 1680 s left" |
| `t2_07_finalizing_8_last_step.png` | Finalizing with five steps done, the sixth running |
| `t2_09_summary_lower.png` | tablet Summary scrolled: development-key line, "Sealed files" with Transcript hash and "speaker labels unavailable", Done / View in Evidence |
| `t2_11_transcript_reader.png` | tablet Evidence, `EV-20261010-0020`: chips, five segment cards with times and "Revise" |
| `t2_12_revision_live.png` | the same reader 3 s after the web save: "Revision 1 · derived, not part of the sealed transcript · by AKP Budi Santoso" under segment 1 |
| `t2_14_item0020_technician.png` | tablet as the technician: "You are not permitted to play this recording.", "You are not permitted to read this transcript." and, in red, "Your role cannot read this transcript."; Play dimmed |
| `t2_19_summary_after_taps.png` / `t2_20_summary_top.png` | Summary of `-0032` after the dead taps (unchanged) / the same screen at its top (SEALED, six steps, Details) |
| `p1_01_sim_item_transcript.png` | phone, simulated item: "This recording has no playable media on this Core.", Transcript "Transcript state not reported" |
| `w2_01_stt_supervisor.png` | web System & Maintenance, "Transcription (STT)" open: switch on, "On this Core (CPU)", model; header CRITICAL (G75c-01) |
| `w2_04_stt_investigator.png` | the same as the investigator: "Read-only: Requires the Supervisor / Technician role.", the waiting-change banner, controls dimmed |
| `w2_05_seal_dialog.png` | web "Evidence sealed" dialog of `-0031`: six steps done, SEALED, manifest hash, "No DEMO package exists for this item." |
| `w2_06_item0020_transcript.png` | web Evidence Details `EV-20261010-0020`: Sealed / Core record / Development source, "Open playback", transcript chips and the first segments |
| `w2_10_revision_saved.png` | the derived block of revision 1 under segment 1 and the toast "Revision 1 appended" |
| `w2_13_item0020_technician.png` | web as the technician: the two "not permitted" sentences, Play and Open playback dimmed |
| `w2_14_item0017_interrupted.png` | web `EV-20261010-0017`: "Sealed — recording was interrupted / Cause: CAPTURE_FAULT", transcript chips and segments |
| `w2_16_item0015_player.png` | web sealed player of `EV-20261010-0015`, paused at 0:00: two colour-bar test patterns, band "MIC 1 0:00–0:26 / MIC 2 0:26–1:00", "Audio at the playhead: no interval" |

Taken, NOT read as pictures (their text was read from the DOM or the view tree):
`t2_01_stt_status`, `t2_08_summary`, `t2_15_item0015_reader`, `t2_16_item0020_verify`,
`p1_02_stt_status`, `w2_03_stt_technician_saved`, `w2_08_item0020_verify`,
`w2_12_revisions_list`, `w2_17_item0020_after_restart`, `w1_01_sim_item_transcript`.

Other files there: `verify_EV-0020.json`, `op40_EV-0020.json`, `checkpoint_SES-20261010-0031.json`,
`checkpoint_before_kill_SES-20261010-0032.json`, `ps_session.log`, `ps_sessionK.log`,
`killer.log`, `seal_poll.log`, `web_session.log`, `audit_lane2_end.json`,
`core_lane2_run_before_restart.log`, `start_2.log` / `stop_2.log` (0600), my scratch scripts.

## 13. Environment as left - what gates 89 and 94 inherit

| Item | State |
|---|---|
| Lanes | 1 RUNNING PID 49865 (untouched). **2 RUNNING PID 82871 - restarted once by me at 22:57** (stop / start, no reset). Web 5176 / 5177, Metro, PostgreSQL untouched |
| Lane 2 stub | new at that start: discovery UDP 60732, device TCP 57740, RTSP TCP 57741; **new fixture account** in `.locks/camera-stub.lane2.fixture` (the earlier ones are dead); preset `NORMAL`, not touched |
| Lane 2 selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` - never changed |
| Lane 2 STT configuration | as found in content: enabled, `cpu-local`, `ggml-large-v3-turbo`, `id`, labelling on, no credential. **`revision` 11 (found 7)**: off / on from the web, off / on through the API. `pendingForNextSession false`. `lastTest` empty again (kept in memory only; my one test was before the restart) |
| Lane 2 session | none open; `session/current` = `SES-20261010-0032` SEALED, summary acknowledged. Next session `-0033`, next item `EV-20261010-0022` |
| Lane 2 alerts | `ALR-000016` CRITICAL `coreNotRunning` still ACTIVE (G75c-01; it survived my restart too). Mine: `ALR-000021`, `ALR-000023` (INFO, `MIC_RATE_AT_LIMIT`, resolved at each stop, not acknowledged). No other active alert |
| Lane 2 audit | chain `ok`, 210 rows at 23:01, head `69b52a4d…78ab81d2`, then my last sign-out (211). Rows of this gate: seq 152-211 (4 `STT_CONFIG_CHANGED`, 5 `TRANSCRIPT_REVISED`, 7 `ACCESS_DENIED`, 10 `EVIDENCE_VERIFIED`, 1 `EVIDENCE_VERIFY_FAILED`, 2 `EVIDENCE_MEDIA_SERVED`, 1 `SYSTEM_BOOT`, the two sessions' rows, sign-ins). 0 invented integrity rows |
| Lane 1 | untouched data: two supervisor sign-ins / one sign-out and three reads; the phone's supervisor sign-in and sign-out; the phone opened on the Summary of lane 1's last session and left it by "View in Evidence" (whether that acknowledged the summary was not read) |
| Devices | tablet and phone signed out, on Login, "Core online", "paired as DEV-0001", reverse rules intact (4422 / 4421); no re-pairing, no lock change, no reboot, biometric not enabled; the dev toast was closed on both |
| Helpers | every helper session signed out and its jar removed; my headless browser stopped and its profile removed; no `whisper` / `capture-worker` / `ffmpeg` process |

New sealed items on lane 2 (real capture, FAKE sources, development key, `MIC-01` = the
synthetic speech fixture, no microphone switch, verify `PASS` 15 of 15):

| Item | Session | Kind | Length | Size | Made by | Transcript |
|---|---|---|---|---|---|---|
| `EV-20261010-0020` | `SES-20261010-0031` | clean | 96.1 s | 96.8 MB | TABLET (rows carry `DEV-0001`) | 4 chunks, 19 segments; **revision head 4** |
| `EV-20261010-0021` | `SES-20261010-0032` | clean (one engine process killed and retried) | 92.3 s | 93.0 MB | API | 4 chunks, 19 segments; head 0 |

Revisions made (all signed with `CORE-KEY-EVSIGN-01`, append-only, they cannot be removed):

| Item | No. | Segment | Author | State |
|---|---|---|---|---|
| `EV-20261010-0020` | 1 | 1 | OPR-001 (web) | appended; base 0 |
| `EV-20261010-0020` | 2 | 3 | OPR-002 (API) | appended; base 1 |
| `EV-20261010-0020` | 3 | 2 | OPR-001 (web) | appended; base 2 |
| `EV-20261010-0020` | 4 | 4 | OPR-001 (API) | appended; base 3; **its `from` is deliberately false** (G81b-01) and its text is a probe |
| `EV-20261010-0017` (interrupted) | 1 | 6 | OPR-001 (web) | appended; base 0 |

For gates 89 / 94: (1) lane 2 now has eight items with a transcript that has segments, two of
them with revisions - verify and export can be judged on a package with a non-empty
`transcript-revisions.json`; (2) G81b-03 will stop a tablet flow that ends with "Done" or "View
in Evidence": leave the Summary with the header Back, or open the item from Evidence; (3)
G81b-10 and G75c-11 are yours to judge; (4) a helper session expires after 15 idle minutes (my
technician jar did); (5) `uiautomator` reports the tablet Summary's lower controls with clipped
bounds - take their place from a screenshot.

---
*Generated: 2026-10-10 23:10 WIB*
