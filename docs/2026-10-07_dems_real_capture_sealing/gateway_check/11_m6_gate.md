---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 81 - M6 milestone gate (transcription)
date: 2026-10-10
agent: verifier (independent +1; brief `delegation_progress/gate_brief_wave_g.md`, decision D193)
tree: f293221 (`git diff --stat f293221 -- apps packages scripts`: three README files only)
narrative_tier: 2
status: needs-review
verdict: PASS WITH CONDITIONS
---

# 11 - M6 milestone gate (row 81)

## 0. Read this first: what is proven with a real engine, and what is not

**The decoder of the real engine has still not transcribed a product session.** Lane 2's STT-enabled
session (`SES-20261010-0025`, backend `cpu-local`) ran the transcriber session of the product on the
generated microphone. The voice-activity stage found no speech in the generated audio, so NO chunk was
planned and the speech engine (`whisper-cli`) was never started: I polled the process table every
3 s during the recording and saw no `whisper` / `vad` process, the checkpoint read `"chunks":[]`,
and the sealed document has `"chunks":0`, `"segments":[]`, `qa_flags: ["no_speech", "speaker labels
unavailable"]`. The session sealed `ASSEMBLED` with an empty transcript.

| Proven NOW, live, in a product session on lane 2 | Still proven on doubles / earlier rows only |
|---|---|
| The STT snapshot of a real start (enabled and disabled), write-once, in the signed manifest | A real decode: words, timestamps, language, one segment per sentence (`M6-TF-1`) |
| The transcriber session opens after the start, reads the tap, closes at the stop (`TRANSCRIBER_SESSION_OPENED` / `_CLOSED phase COMPLETE`) | The `cpu-local` command with `-ng` issued by the product (the flag exists in code, `apps/transcriber/src/backends/cpu-local.ts:61`; no command was issued) |
| The seal waits for the transcript step and seals: DISABLED and ASSEMBLED (empty document) | PARTIAL in both forms (lost chunks; no document) |
| Model provenance for `cpu-local` in manifest, document and verify report; the hash equals the model file's (my own SHA-256 of the file) | The SERVER backend in every respect (not run live: user's rule) |
| The summary on the item, on web and tablet, and again after a Core restart | Speaker labels LABELLED (native embedder); UNAVAILABLE was seen live |
| The scratch folder and `tap.pcm` are removed at the seal; no engine process is left | A chunk's audio source (no chunk existed); chunk resume after a kill (`M6-KR-1`) |
| Case scope on ops 84 / 85 / 86 with one audited denial each | Priority under load, `M6-CP-1`; no dropped fragment while the engine decodes (`M6-DF-1`) |
| STT settings: web menu, role rules, tablet and phone read-only status | A REVISION on a real item (ops 85 / 86 with a signed record, V-11 after an append) |

Why revisions are not proven live: a revision corrects a SEGMENT (`changes` has `minItems: 1`, the web
control is per segment). The only sealed machine transcript on the lane has no segment, and the two
seeded v2 items are sealed DISABLED. So no revision can be created on lane 2 today.

The cause is the test source, not a defect found in the product: the FAKE microphone carries no
speech. Until a product session with speech is run (condition C1), M6's central function is proven
by the suites on doubles and by the real-engine runs of rows 76-78 on earlier trees only.

## 1. Verdict

**PASS WITH CONDITIONS.** Entry condition met (0 Blocker / Major open). Every check I could drive
passed. No BLOCKER or MAJOR was found in the M6 subject. But four clauses of the row's acceptance
are NOT PROVEN by this gate, and I do not call them passed:

| # | Condition | Owner |
|---|---|---|
| C1 | One product session WITH SPEECH on `cpu-local`, then: non-empty segments, the `-ng` command quoted, each chunk's audio source, no false `intervals_incomplete`, fragment `seq` contiguous while the engine decodes (`M6-TF-1` +1 on `cpu-local`, `M6-DF-1` +1). Needs a speech-bearing source: a generated microphone that plays the fixture, or the user's attended local-microphone run | controller (source) + user (if the local microphone is used) |
| C2 | On the item of C1, revisions live: Save disabled below 5 characters, a revision shown as derived, `transcript.revision` moving on web and tablet without a reload, verify PASS with V-11 after the append, no `REVISION_APPEND_PENDING` left, the 409 keeping the typed text, the head after a restart | the gate that runs C1 (or gate 89 / 94) |
| C3 | The server backend live (`M6-TF-1` on `omlx-server`, `M6-STTCFG-UNREACH`) | user (the agent may not call the server) |
| C4 | R80-16: the three limits of the transcript step were to be ruled here. NOT RULED: no backlog ever existed (no chunk), and D230 forbids the measured figure a ruling would rest on | controller |
| C5 | G75-01 (MAJOR, open from gate 75) is reproduced in both packages sealed here; see G81-04 | owner of G75-01 |

M6 should not be recorded as fully signed off before C1 and C2 are done.

## 2. Entry condition: review 80's four MAJORs and R93-02

Code read at `f293221`; last commit of every file below is `f293221`. Test runs: gate 64 ran the
whole core-server unit project (`309 files, 6247 passed`) and db project (`2381 passed | 6 skipped`)
on `f293221` (`gateway_check/08_m3_gate.md` lines 48-49). I ran the targeted files once more
(logs `.cache/gates/81/entry_*.log`): shared `sim-transcript-summary.test.ts` 8 passed; core unit
`src/transcription` + `seal-summary` + `summary-at-boot` + `transcript-step` 13 files, 111 passed;
web `src/features/evidence` 14 files, 153 passed; mobile `src/features/evidence` 22 suites, 180
passed. All exit 0.

| Finding | Fixed? | Evidence in code | Live at this gate |
|---|---|---|---|
| R80-01 summary on the item, no ASSEMBLED fall-back | CLOSED | `sealing/finalize-transcript/commit.ts:103-104` (`sealInputWithTranscriptSummary`), wired at `sealing-host/index.ts:311`; boot: `modules/transcripts/heads.ts:119-121`; client `transcript-model.ts:153` (`if (summary === null) return 'UNKNOWN'`), `:156` ASSEMBLED only for `READY` + document | DISABLED and ASSEMBLED shown on web and tablet, before and after a restart (`transcripts.heads items 4`) |
| R80-02 intervals to the runner | CLOSED | `transcription/session.ts:140` (required member), `:309-315`, `:333` | the sealed document carries `intervals: [{from_ms 21, source MIC-01, to_ms 56111}]` and no `intervals_incomplete`. Per-chunk source NOT seen: no chunk |
| R80-03 runner stops at close-out | CLOSED | `apps/transcriber/src/pipeline/runner.ts:108`, `:222` (`shouldStop`); `session-run.ts:210`; `transcript-chunks/statements.ts:43` (`NOT EXISTS ... FINALIZE_TRANSCRIPT ... DONE`) | no engine or transcriber process after the seal; not otherwise exercisable without a chunk |
| R80-04 raw PCM tap removed | CLOSED | `transcription/scratch.ts:71`; callers `sealing-host/index.ts:221` (boot sweep), `:317` (SEALED) | log `TRANSCRIBER_SCRATCH_REMOVED why SEALED`; folder gone (section 5) |
| R93-02 case scope on 84 / 85 / 86 | CLOSED | `modules/transcripts/routes.ts:322` (`holdScope`), called at `:394`, `:423`, `:602`; predicate imported from `media-stream` (`:91`) | section 6 |

## 3. Checks

Surfaces: W2 = web console lane 2 (headless Chromium over CDP), T = tablet `emulator-5556`,
P = phone `emulator-5554` (lane 1), W1 = web lane 1, API = the lane's Core through the web origin,
FILE = sealed package read as text.

| ID | Surface | Result | Evidence |
|---|---|---|---|
| Entry (0 Blocker / Major) | code + tests | PASS | section 2 |
| `M6-RG-*`, `M6-QA-1` | suites | PASS (mapped, D122) | gate 64 on `f293221`: core unit 6247, db 2381; `test/06` B1 / B2 typecheck + lint 0 for 7 workspaces, B3 shared 2476, B7 web 1900, B9a transcriber 561 passed 3 skipped, B8 mobile 249 of 250 (the one file re-run green at gate 64). Tree since: documentation only |
| `M6-TF-1` on `cpu-local` | lane 2 session | **NOT PROVEN** | section 0: no speech, no chunk, no decode |
| `M6-TF-1` on `omlx-server` | - | not run live (user's rule) | doubles: transcriber suite |
| `-ng` + Metal-off build evidence (AU3-03) | - | **NOT PROVEN live** | no engine command was issued. Partial: op 92 on `cpu-local` answered "Reachable, model available" (W2), and that probe refuses `ENGINE_NOT_CPU_ONLY` (`transcription/probe.ts:219`) |
| `M6-DF-1` on `cpu-local` | - | **NOT PROVEN** | no decode ran beside the capture; `test:real:row77:df1` not run (instruction) |
| `M6-KR-1` | - | NOT PROVEN live; doubles only | `kill-resume.test.ts` in the 561-test run; no chunk to kill at this gate |
| `M6-LB-1` | FILE + suites | PASS for UNAVAILABLE live; LABELLED doubles only | document `speaker_state UNAVAILABLE`, `speaker_reason ENGINE_NOT_CONFIGURED`, flag `speaker labels unavailable`; chip on W2 and T |
| `M6-AD-1`, `M6-CP-1` | suites | PASS (mapped) | transcriber suite, as above |
| `M6-STTCFG-API` | API | PASS for what was driven | op 90: 200 for all three roles, body carries `credentialSet: false` and no credential member; op 91 / 92 as INVESTIGATOR: 403 `NOT_PERMITTED` (`permission: CAPTURE_CONFIG`), audited (seq 139, 140); stale `revision`: 409 `INVALID_STATE`, `details.reason: REVISION_CONFLICT`, `currentRevision: 3`, nothing stored; audit `STT_CONFIG_CHANGED {changedFields: "enabled", credentialChanged: false, revision: 2}`. NOT driven: the non-loopback 422 and every server-backend field (I did not put server values into the form or a request) |
| `M6-STTCFG-NEXT` | API + FILE | PASS in part | session A's manifest snapshot `revision 2, enabled false`; session B's `revision 3, enabled true`. A change DURING a recording was not driven (unit test only) |
| `M6-STTCFG-OFF` | lane 2 session A | PASS | section 4 (a) |
| `M6-STTCFG-UNREACH` | - | not run live (user's rule) | doubles |
| `M6-STTCFG-WEB` | W2 | PASS, one finding (G81-03) | Supervisor: switch, backend select (`On this Core (CPU)` / `Local server (oMLX)`), model, language fixed, speaker labelling, credential "Not set" + "Change credential", Save, Test connection. The credential field opens EMPTY (`value` length 0), `autocomplete off`, text "A pointer to where the key is kept ... Never the key itself. It is not shown again after saving." Technician: all controls enabled. Investigator: all controls disabled, "Read-only". One audit row per save (seq 93 and the re-enable). Not seen: the "Checking your permissions..." moment; the server address field (form not switched to the server backend) |
| `M6-STTCFG-TAB` | T | PASS | "Read-only on this device. Change the transcription settings from the web console."; Transcription Disabled, Backend Local CPU, Model, Speaker labelling On, Credential Not set, Last connection test + time; no edit control (`t2_03`) |
| `M6-STTCFG-PHONE` | P | PASS | the same card on the phone, "Enabled", "Not tested yet", no edit control (`p1_02`) |
| States at the seal: DISABLED | W2, T, FILE, API | PASS | section 4 (a) |
| States at the seal: ASSEMBLED | W2, T, FILE, API | PASS (empty transcript) | section 4 (b) |
| States at the seal: PARTIAL (both forms) | - | NOT PROVEN live | cannot be produced with these sources; `seal-summary.test.ts`, client tests |
| Model provenance, `cpu-local` | FILE + API | PASS | section 4 (b) |
| Scratch and tap removed | files + processes | PASS | section 5 |
| Case scope ops 84 / 85 / 86 | API + W2 | PASS | section 6 |
| Revisions live (create, derived, head moves, V-11 after append, 409, restart head) | - | **NOT PROVEN** | section 0 |
| Summary after a Core restart | W2, T | PASS (head 0 only) | section 7 |
| Simulated mode | W1, P, API | PASS, one finding (G81-01) | section 8 |
| Docs "Gate 81" sentences (`47_m9_docs.md` row 12; README "Transcription (STT)") | W2, T, P | PASS, G81-03 | the menu is where the README says and holds what it lists; status read-only on tablet and phone |

## 4. The two real sessions (lane 2, FAKE sources)

Two sessions with capture were run; ONE of them with STT enabled (limit: three).

**(a) STT disabled - `SES-20261010-0024` -> `EV-20261010-0014`** (started and ended on the web as
OPR-001; recording well under a minute). Transcription set to off on W2 by the Supervisor first.

- During the recording: no folder under `.transcriber/sessions/`, no engine process.
- Sealed; the transcript step completed.
- FILE `session-manifest.json`: `transcript.state: "DISABLED"`, `disabledReason:
  "DISABLED_BY_CONFIGURATION"`, `configSnapshot: {backend cpu-local, diarization true, enabled false,
  model ggml-large-v3-turbo, revision 2}` (revision 2 is my change: a real snapshot), every document
  and model member null. No `transcript/` folder in the package.
- API op 84 and op 86 (holder): `409 TRANSCRIPT_NOT_READY`, `details.reason: NO_SEALED_TRANSCRIPT`.
- W2 pane: `data-state="DISABLED"`, "Transcript disabled by configuration" (`w2_06`). T pane:
  `evidence-transcript-DISABLED`, the same words (`t2_06`). Neither says "not available yet" nor
  "assembled".

**(b) STT enabled, `cpu-local` - `SES-20261010-0025` -> `EV-20261010-0015`** (started and ended on
the TABLET as OPR-001). Transcription set back to on on W2 first (revision 3).

- Log: `STT_SNAPSHOT_TAKEN enabled true backend cpu-local revision 3`, `TRANSCRIBER_SESSION_OPENED`.
  While recording the scratch held `tap.pcm`, `transcript-checkpoint.json`, later `work/engine.json`.
- The seal waited for the transcript step: completed within the spec's bound. Sealed.
- **State: ASSEMBLED.** Why: the pipeline closed `phase COMPLETE` with zero chunks and zero failed
  chunks; `partial_reason: null`. QA flags `no_speech`, `speaker labels unavailable`; speaker reason
  `ENGINE_NOT_CONFIGURED`.
- FILE manifest: `state ASSEMBLED`, `failedChunks 0`, `file transcript/transcript.json`, `sha256
  e1a9fad7...689206d2`, `model {name ggml-large-v3-turbo, version large-v3-turbo, quantisation f16,
  modelSha256 1fc70f77...e2bc69}`, `speakerState UNAVAILABLE`, `revisionHead 0`. The version equals
  the DECLARED value of `.data/transcriber/host.json` (`modelVersions`); the SHA-256 equals my own
  hash of the model file under `.cache/stt/`. My hashes of `transcript.json` / `.srt` / `.vtt` equal
  the three manifest values.
- FILE `transcript.json`: `header.backend cpu-local`, `chunks 0`, `failed_chunks 0`, `language id`,
  `state ASSEMBLED`, `intervals [{from_ms 21, source MIC-01, to_ms 56111}]`, `segments []`. No
  `intervals_incomplete`. No chunk exists, so "each chunk carries an audio source" is not shown.
- API op 84 (holder): 200, `segments: []`, `speakerState UNAVAILABLE`, `revision 0`, the same hash.
- API op 41: `overall PASS`, V-01 .. V-15 all PASS (V-10, V-11 PASS), `transcriptState {code READY,
  sealedState ASSEMBLED, documentSealed true, failedChunks 0}`, model line "version large-v3-turbo
  (declared by the installation) ... file SHA-256 ...", `reportedByServer false`. One notice:
  `AUDIT_EXTRACT_NOT_SIGNED`. No `REVISION_APPEND_PENDING`.
- W2 pane: `data-state="ASSEMBLED"`, "Transcript assembled", "Inside the sealed package", "speaker
  labels unavailable", "Sealed original - immutable", "This transcript has no segments.",
  "Revisions: No revisions" (`w2_07`). T pane: `evidence-transcript-ASSEMBLED`, the same lines
  (`t2_11`). Same state on both.

## 5. After (b): scratch, tap, processes

- `.data/media/dems_lane_2/sessions/.transcriber/sessions/`: empty (the folder of `-0025` is gone).
- `find .data/media/dems_lane_2 .data/transcriber -name tap.pcm`: no hit.
- Old root `.data/transcriber/sessions/`: three folders dated 9 Oct, `SES-20310101-0601`, `-0602`,
  `-0611` (test ids of an earlier row, each empty by its size line); nothing for `-0024` / `-0025`.
- `pgrep -fl 'whisper|transcrib'`: no process (exit 1). No `capture-worker` after the stop.

## 6. Case scope and the revision operations (item `EV-20261010-0015`, holder OPR-001)

| Call | Answer | Audit |
|---|---|---|
| op 84 as TECHNICIAN (OPR-003) | 403 `NOT_PERMITTED`, `details.reason: EVIDENCE_CASE_SCOPE` | seq 121, one `ACCESS_DENIED` |
| op 86 as TECHNICIAN | 403, the same reason | seq 122, one row |
| op 85 as TECHNICIAN | 403 `NOT_PERMITTED`, `permission: TRANSCRIPT_REVISE`, **no** scope reason: the seed TECHNICIAN lacks the permission, so the role matrix refuses first | seq 123, one row |
| op 85 as OPR-003 holding INVESTIGATOR for one call (role changed by the Supervisor and put back: `ROLE_CHANGED` seq 124, 126; the method of gate 75 and of `contract.test.ts`) | 403, `role: INVESTIGATOR`, `details.reason: EVIDENCE_CASE_SCOPE` | seq 125, one row; revisions list still empty, package list unchanged |
| op 84 as SUPERVISOR | 200 | - |
| op 85 as the holder, segment 0 | 422 `INVALID_INPUT`, `reason: REVISION_SEGMENT_UNKNOWN`, `segments: 0` | - |
| op 86 as the holder | 200 `{items: [], nextCursor: null}` | - |

W2 as the TECHNICIAN on that item: "Transcript unavailable - Your role cannot read this transcript."
(`w2_08`); one `ACCESS_DENIED` row per opening of the page (G81-07).

## 7. Restart of lane 2's Core (`lane.sh stop 2` / `start 2`, no reset)

Boot log: `transcripts.heads items 4 - the transcript summaries of the sealed items were published
on them`. After it, without any action of mine on the item: W2 `EV-...-0015` ASSEMBLED with the same
lines (`w2_09`), `EV-...-0014` DISABLED; T the same two states (`t2_12`). STT selection unchanged
(revision 3). A revision head other than 0 could not be tested (section 0).

## 8. Simulated mode (lane 1, reset to the seed first)

- API ops 84 / 85 / 86 on the seeded `EV-20261010-0013` and on the item of a simulated session I ran
  (`SES-20261010-0024` -> `EV-20261010-0014` of lane 1): `409 TRANSCRIPT_NOT_READY`,
  `details.reason: SIMULATED_ITEM`, "the Core server keeps no transcript and no revisions for it".
  A TECHNICIAN gets the same 409 (no case scope on a non-REAL item).
- No snapshot claimed: lane 1's log has 0 lines `STT_SNAPSHOT_TAKEN` / `TRANSCRIBER_SESSION_OPENED`
  for that session; the reset table count `session_stt_config 0` before it.
- W1 and P pane: `UNKNOWN`, "Transcript state not reported", "The transcript is not available yet.",
  no alert role, no revise control (`w1_01`, `p1_01`). A state, not an operator error. Wording:
  G81-01.

## 9. Findings

| ID | Sev. | What | Where seen | What the spec / fix says |
|---|---|---|---|---|
| G81-01 | MINOR | A simulated item's pane says "The transcript is not available yet." The Core's reason is `SIMULATED_ITEM` (it keeps no transcript for the item): it never will be | W1, P on lane 1 | the wording class R80-01 removed for DISABLED / PARTIAL ("never 'not available yet'" where nothing will come) |
| G81-02 | MINOR (for gate 89) | The tablet Session Summary shows the chip "SIMULATED" beside the Signature of a REAL sealed item; op 40 says `signature {algorithm Ed25519, keyId CORE-KEY-EVSIGN-01, simulated: false}` | T, `t2_05_summaryA.png`, item `EV-20261010-0014` of lane 2 | one fact, two statements; not this gate's subject |
| G81-03 | MINOR | The Investigator's hint on the web STT section reads "Read-only: Requires the Supervisor role." The Technician may change it too (README; op 91 asks `CAPTURE_CONFIG`; the Technician's controls are enabled) | W2 | ux 8a: SUPERVISOR / TECHNICIAN edit |
| G81-04 | reproduction of G75-01 (MAJOR, open) | The simulator's generator writes invented integrity rows in real capture. Lane 2's chain since the seed: `FRAME_HASH` 5, `WRITE_VERIFIED` 4, `TIMESTAMP_CONFIRMED` 1. Sealed `audit-session-extract.jsonl` of `SES-20261010-0025`: `FRAME_HASH` 2, `WRITE_VERIFIED` 4, `TIMESTAMP_CONFIRMED` 1. Tablet Session Live timeline: "Evidence Auto-Save - Autosave segment 1", "System Check - Integrity check passed" (`t2_08`) | lane 2 | as G75-01 |
| G81-05 | NOTE | A recording in which no speech was found seals ASSEMBLED and is shown in the success colour as "Transcript assembled". The panes do not show the `no_speech` flag; they say "This transcript has no segments." Such an item can never be revised (per-segment control, `changes minItems 1`) | W2, T | by design as far as I can read; a reader may take "assembled" for "there is a transcript" |
| G81-06 | NOTE | Operation 40's body has no `transcript` member; the summary exists only on the state slice the clients subscribe to. A caller of the API alone reads the state from op 41 (`transcriptState`) | API | not checked against the contract text |
| G81-07 | NOTE | For a reader refused by the case scope the web chip says "Transcript unavailable" and "Your role cannot read this transcript": the cause is the case, not the role, and the item's state is assembled. Each opening of the page, and each reconnect of an open page after a Core restart, writes one `ACCESS_DENIED` row (seq 128 and one more after the restart) | W2 | - |
| G81-08 | NOTE (for gate 89) | Sealing progress of `SES-20261010-0024`: step `STORE_SEALED_PACKAGE` has `startedAt 1791615338493` later than `completedAt 1791615338438`, `durationMs 0` | API sealing progress | - |
| G81-09 | NOTE | Op 90 answered `pendingForNextSession: true` for a change saved while the last session was SEALED with its summary not yet acknowledged (nothing recording); later it read false | API | whether a sealed, unacknowledged session counts as "open" is not stated where I read |
| G81-10 | NOTE (for gates 89 / 94) | A REAL sealed item on the web says "No DEMO media - No DEMO package for this item: the Core server's record only." and Play was reported disabled for the holder in my DOM read; on the tablet "No DEMO media for this item on this device." | W2, T | not judged here |
| G81-11 | NOTE | The tablet Session Summary prints a duration per sealing step, the transcript step included. Whether that falls under D230 is the controller's ruling; no figure is repeated here | T | D230 |
| G81-12 | NOTE | Reproduced from earlier gates: G70-04 (tablet "Next" / "Start Recording" announce "busy" while idle), G70-03 (stock room picture captioned "LIVE / DEMO" in a real recording, `t2_07`) | T | - |
| G81-13 | NOTE (not determined) | Twice a first tap on the tablet's "Settings" rail item from Home did not navigate; a second tap did. Tooling or product: not determined | T | - |

## 10. Skipped and not run live

| Item | Reason |
|---|---|
| Everything on the SERVER backend (`M6-TF-1` on `omlx-server`, `M6-STTCFG-UNREACH`, op 92 against a server, the endpoint and credential save) | not run live (user's rule): the server on 127.0.0.1:8000 was never called, started, stopped or reconfigured; no key read or printed; the configuration was never pointed at it. Proven by tests only |
| The transcriber's `test:real:*` scripts (eight in `apps/transcriber/package.json`) | NOT run: they drive real engines at length or the server |
| Biometric sign-in | skipped by the user's instruction (D151); password path used on both devices; "Use biometric login" not touched |
| Local devices (`CAM-03` / `MIC-03`), attendance variables | never selected or set; no local-device notice was part of a flow here |
| No STT speed, throughput or real-time-factor figure is stated anywhere in this report (D230); no model was downloaded |

## 11. Not covered, and why

1. A real decode in a product session, and everything that needs a chunk or a segment (section 0;
   conditions C1, C2).
2. PARTIAL in both forms, tap lost (R80-06), a backlog at the bound (R80-05, R80-16): not producible
   with these sources.
3. A change of the STT configuration during a RECORDING session; a save by the Technician; the
   "Checking your permissions..." moment; the live update of the tablet status without leaving the
   screen; the server address field of the web form.
4. The db test files of the entry findings were not re-run by me (`transcript-routes.db.test.ts`,
   `transcript-chunks.db.test.ts`): they are in gate 64's db run on `f293221`.
5. `masterplan/02_plan.md` and `implementation/99_implementation_report.md` were not written: the
   task asked for this one file.

## 12. Screenshots (`.cache/gates/81/`)

Read by me:

| File | Shows |
|---|---|
| `w2_01_stt_settings_supervisor.png` | web System & Maintenance, Settings list with "Transcription (STT)" open: switch on, Backend "On this Core (CPU)", Model `ggml-large-v3-turbo` |
| `w2_02_stt_credential_field.png` | the same section with "Credential reference" open and EMPTY, its "Never the key itself" text, "Not tested yet", Test connection dimmed with "Save your changes first" |
| `w2_07_itemB_transcript_assembled.png` | web Evidence Details `EV-20261010-0015`: "Transcript assembled", "Inside the sealed package", "speaker labels unavailable", "This transcript has no segments.", "No revisions"; "No DEMO media" above |
| `t2_02_small.png` | tablet Home after sign-in: READY, four development-source cards, stock room pictures |
| `t2_03_stt_status_disabled.png` | tablet Settings, "Transcription status": read-only sentence, Disabled, Local CPU, model, labelling On, credential Not set, last test "Reachable, model available" |
| `t2_05_summaryA.png` | tablet Session Summary of session A: six steps done, hashes, Signature with the chip "SIMULATED" |
| `t2_07_sessionB_live.png` | tablet Active Session `SES-20261010-0025`: Recording, MIC 1 Active, MIC 2 Standby, development-source chips |
| `t2_08_end_dialog.png` | tablet "End Session?" with the required reason; timeline "Evidence Auto-Save", "System Check" behind it |
| `t2_11_itemB_transcript_assembled.png` | tablet Evidence, `EV-20261010-0015` selected, details; the transcript line begins at the fold ("Transcript assembled", "Inside the sealed package") |
| `t2_13_end.png` | tablet Home at the end of the flows: READY, 11 items sealed today |
| `p1_01_sim_item_transcript.png` | phone Evidence Details of the simulated item: "Transcript state not reported", "The transcript is not available yet." |

Taken but NOT read as pictures (the text beside them was read from the DOM or the view tree):
`w2_03_stt_settings_inv`, `w2_03_stt_settings_tech`, `w2_04_stt_disabled_saved`,
`w2_05_sessionA_recording`, `w2_06_itemA_transcript_disabled`, `w2_08_itemB_technician_refused`,
`w2_09_itemB_after_restart`, `w1_01_sim_item_transcript`, `t2_00_start`, `t2_01_home`,
`t2_02_after_settings_tap`, `t2_04_sessionA_recording_settings`, `t2_06_itemA_transcript_disabled`,
`t2_09_end_dialog_filled`, `t2_10_after_stop`, `t2_12_itemA_after_restart`, `p1_02_stt_status`.

## 13. Environment as left - what later gates must know

| Item | State |
|---|---|
| Lanes | 1 and 2 RUNNING (PIDs 65873 / 65709), web 5176 / 5177 up. Both were reset to the seed at the start of this gate (lane 2 13:49, lane 1 14:04) and then used as below. Lane 2's Core was restarted once more (section 7) |
| Lane 2 sealed items (real capture, FAKE sources, development key), holder OPR-001 | **`EV-20261010-0014`** = `SES-20261010-0024`, transcript **DISABLED**, no `transcript/` folder. **`EV-20261010-0015`** = `SES-20261010-0025`, transcript **ASSEMBLED with zero segments** (`no_speech`), `transcript/` holds `transcript.json` / `.srt` (0 bytes) / `.vtt` / `transcript-revisions.json` (empty list), revision head 0, verified PASS once. Both hold the invented rows of G75-01 in their audit extract. Plus the seed's `EV-20261009-0005` (altered) and `EV-20261008-0001`, both DISABLED |
| Lane 2 STT selection | the seed's: enabled, `cpu-local`, `ggml-large-v3-turbo`, language `id`, speaker labelling on, no credential. `revision` is 3 (off, then on); `lastTest` holds my one op 92 on `cpu-local` |
| Lane 2 other | no recording open (`-0025` SEALED, summary acknowledged), no active alert, OPR-003 is TECHNICIAN again, audit head about seq 142 (2 `STT_CONFIG_CHANGED`, 2 `ROLE_CHANGED`, 8 `ACCESS_DENIED`) |
| Lane 1 | one simulated session `SES-20261010-0024` -> `EV-20261010-0014` (SIMULATED), no active alert, STT configuration untouched (revision 1) |
| Devices | tablet relaunched to Login ("Core online", paired); phone signed out, on Login. Reverse rules intact (4422 / 4421). No re-pairing, no lock change, biometric not enabled |
| Processes | no `whisper` / `capture-worker` / `ffmpeg`; my three headless browsers stopped; every cookie jar signed out and removed |
| For gates 89 / 94 | (1) no item on lane 2 has a transcript with segments: a revise flow cannot be driven there until C1 is run; (2) G81-02, G81-08, G81-10 are theirs to judge; (3) a FAKE-source session never yields speech; (4) the tooling notes of gate 75 hold (do not pipe `lane.sh start`; `uiautomator dump` fails on animated screens; API sessions expire after a few idle minutes), and zsh does not split a command kept in a variable |

---
*Generated: 2026-10-10 14:15 WIB*
