---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: document-writer
blueprint_row: 126
milestone: M7
work_package: WP-27
type: record of a product document (hardware acceptance test package, chapter 3: network functions, cameras and sessions)
narrative_tier: 1
source_plan: identification/03_implementation_blueprint.md (row 126, profile line 437, sections 6, 11.4, 12); masterplan/02_plan.md (section 9A, phases 10, 11)
source_analysis: scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md; implementation/124_hw_procedure_frame.md; masterplan/04_design_addendum.md (sections 3, 5.1, 7, 9.6); test/01_hevc_experiment.md; implementation/026_onvif_profiles_locator.md; research/01_explore_input_av.md (TS-5, TS-6, 4.12); verification/02_security.md (S13-03, S13-04, S13-11, S13-15, S13-16 (5)); decisions/decisions.md (U9, U10, C1, C7, C10, C23, C24, C25)
status: complete
confidence: MEDIUM for the content of each check against its sources; LOW for every screen text, code and expected output (none was run; the relay, the commissioning functions and their screens and the production camera adapter are not built yet)
closes_requirements: the chapter half of P12-F14; P12-F03 as procedure (`9A/H-21`, `9A/H-22`); C24 as procedure (`9A/H-10`); S13-15 and S13-03 (c) restated at the point of adoption. None is proven on hardware
last_updated: 2026-10-13 00:53 (host clock)
---

# Row 126: hardware acceptance test package, chapter 3 (network, cameras and session) - record

**The document is UNVERIFIED on real hardware, by definition.** It was written on the development Mac. No command of it was run, no source file was changed, no device, no credential. `apps/input-av/data/` and every `.env` were not opened.

## 0. Frame (5W1H)

| Question | Answer |
|---|---|
| What | One product document, `scripts/hardware-acceptance/HW-ACCEPTANCE-3-NETWORK-CAMERAS-SESSION.md` (504 lines): 15 checks in the six-part form of the frame chapter, a coverage table against blueprint section 12, eight open points, an Indonesian summary of about 270 words at the top |
| Who | Written by row 126 (document-writer). Run by the user with a person at the bench. Consumed by row 129 (the collectors it names, what each must collect, the record writer), rows 130, 131 |
| When | 2026-10-13, before the camera path (rows 39 to 59), the commissioning functions (rows 99 to 113) and the lift (rows 85 to 92) have landed |
| Where | The document is in the product tree beside the frame chapter; this record and `delegation_progress/row_126.md` are in the task folder |
| Why | Reconnection, picture-and-sound alignment, drift, a real H.265 camera through seal and playback, real profile tokens and the commissioning functions on a real camera have no result anywhere, not on the bench of the earlier system either |
| How | Each check was built from the plan's line in section 9A or addendum 9.6, the frame's order, session and operation, and the source that defines its expected result (section 2). Counts were taken by script over the written file (section 3) |

## 1. The checks

Order as the frame fixes it. `9A/H-09` is a check of its own with six parts and no recording of its own: its readings are taken from S1 of `9A/H-17`.

| Check | Session | Steps | Pass criterion, in short |
|---|---|---|---|
| `9A/H-12` | - | 5 | candidates at least 1 without a typed address; 1 from the typed address; a public address refused; "rule alone sufficed" recorded |
| `9A/H-13` | - | 6 | found 1 of 1, by list or by typed address (recorded); 1 scan entry per scan; temporary addresses left 0; other role 0 of 1; rows stored 0 |
| `9A/H-15` | - | 4 | conflict reported 1; set-address refused 1; cameras changed 0 of 2 |
| `9A/H-14` | - | 6 | same hardware address at the new address inside 180 s; credential-form occurrences 0; password field not pre-filled 2 of 2 |
| `9A/H-10` | - | 6 | per camera: reachable inside 15,000 ms; profiles per video source, largest first; codec listed equals codec set; profile assigned; scan 0; the query outcome named |
| `9A/H-23` | S1 (log search) | 4 | authenticated 1 of 1; recorded in S1; occurrences 0 at both searches; characters n of 5 |
| `9A/H-17` | S1 | 10 | recorded, sealed and verified: 1; 4 production sources; failed verification items 0; both scans 0 |
| `9A/H-21` | S1 | 1 | both cameras inside 30,000 ms |
| `9A/H-09` | S1 | 3 | per camera: codec equals the stream's; `INGEST_NO_EXTRADATA` 0; decode errors 0; frames equal packets; clock offset at most 2,000 ms |
| `9A/H-26` | S1 | 2 | notices `STREAM_PROFILE_DIFFERS` for H.265 cameras: 0 in 2 of 2 readings |
| `9A/H-18` | S1 | 3 | offset magnitude at most B-1, 4 of 4 |
| `9A/H-20` | S1 | 4 | 3 of 3 clients "plays" or "states that it cannot"; "silent" is a fail; the export verifies |
| `9A/H-22` | S2 | 5 | started with one camera; 1 warning, 1 audit entry; material of the absent camera 0; sealed and verified |
| `9A/H-11` | S3 | 5 | fault raised 1, cleared 1; 1 file, 1 gap, decode errors 0; the other camera 0 faults |
| `9A/H-19` | S4 | 6 | drift magnitude at most B-2, 2 of 2; sealed and verified |

## 2. Content against its sources

| Part of the row's cell | Where in the document | Source |
|---|---|---|
| `9A/H-09` folded into `9A/H-17` | `9A/H-09` header and part 1; `9A/H-17.5` | addendum 9.6; frame section 6 |
| HEVC from a real camera through record, seal, verify, playback; sample entry `hev1` | `9A/H-09`, `9A/H-26`, `9A/H-20` | `test/01_hevc_experiment.md` sections 1, 2 |
| C24: a stream address with a query is located and its profile assigned | `9A/H-10` step `.1`, expected `.4`, criterion 6 | decisions C24; blueprint row 174 |
| C24: a digits-only profile token is unusable | `9A/H-10`, "Known limit" paragraph and its failure line | `implementation/026` section 5; decisions C24 |
| Reconnection, never physically tested | `9A/H-11` | `research/01` TS-5 (bench: no observed result), 4.12; addendum 5.1 |
| The clap test; the camera clock inside 2,000 ms | `9A/H-18`, `9A/H-19`; `9A/H-09` criterion | `research/01` TS-10 item 2; plan 9A lines H-18, H-19; frame section 5 |
| Password changed before adoption (S13-15, S13-03) | `9A/H-10` precondition; `9A/H-23` | `verification/02_security.md` 7.3, 3.2; frame `PREP-13`, section 9.3 |
| Active scan only (U9); TECHNICIAN only (U10) | `9A/H-13` part 1, step `.1`, the last line of part 5 | decisions U9, U10; plan phase 10 "What active scan only means here" |
| All four slots assigned to start (C25) | `9A/H-17` precondition | decisions C25 |
| No script takes a password or captures packets; counts only | section 1 of the document; every `SCRIPT` step | `verification/02_security.md` S13-16 (5); decisions C23 |
| The lock-out guard | section 1 of the document; `9A/H-10` failure line | `verification/02_security.md` S13-04 |

## 3. Verification cell

| Criterion of the row | Result | How counted |
|---|---|---|
| Checks 15 of 15, each with all six parts | 15 headings `### 9A/H-nn`; each of the six part labels occurs 15 times; header lines 15 | `grep -c` per label over the file |
| Missing parts | 0 | the same counts |

Also counted: a failure paragraph "If not met" in every check (15 of 15); steps 70, each with a performer of `USER`, `TECH`, `OPER`, `BENCH`, `SCRIPT`; steps performed by an agent 0; the word "works" 0; non-ASCII characters 0; addresses in the text: `127.0.0.1` and the documentation address `203.0.113.10` only; no name, no credential, no token, no stream address. `git check-ignore` on the file exits 1 (not ignored).

**Blueprint section 12, lines that name a check of this chapter:** real camera (`9A/H-10`, `H-11`, `H-12`, `H-21`, `H-22`, `H-23`), H.265 (`H-09` in `H-17`, `H-26`, `H-20`), the scan, the set-address function and two cameras on one address (`H-13`, `H-14`, `H-15`), picture and sound (`H-18`, `H-19`), the first session (`H-17`), the query and the digits-only token (`H-10`, recorded through `H-17`). Each has its check; the table is section 3 of the document. With row 125's chapter, **lines of section 12 without a check: 0 of 10.**

## 4. Driver decisions (to confirm)

| # | Decision | Why the conservative one |
|---|---|---|
| D-1 | The failure meaning is the closing paragraph of part 5 (as in row 125) | Six parts stay six |
| D-2 | Collector names `collect-hNN.sh` and the record writer `record-line.sh` | The frame gives no file names |
| D-3 | No step types a wrong password on purpose | Two refusals block a camera's address for 30 minutes (S13-04) |
| D-4 | Whether a stream address carries a query is read by the user from the camera's own page; the collector prints yes-or-no facts about a token, never the token | The locator is stored nowhere and must not be printed |
| D-5 | A camera whose every profile has a digits-only token gets a `FAIL` line with the reason "known limit C24", and another camera takes its place | A known limit is still not a pass |
| D-6 | The special characters of `9A/H-23` are `@`, `:`, `/`, `%` and a space, as far as the camera's page accepts them; the count n of 5 is recorded | They are the characters of hypothesis HA-7 (addendum, F10 (c)) |
| D-7 | S1 is 5 minutes with 10 s of silence first, claps at about 15 s and 4 min 45 s; S2 3 minutes; S3 B-4 plus 4 minutes | The first second of audio is read from S1; lengths have no source |
| D-8 | A commissioning action is attempted during S1 and must be refused (`9A/H-17.6`) | The refusal while a session is open has no other place on hardware |
| D-9 | The clap offset is the collector's audio instant minus a frame instant a person reads; its resolution is one frame time, stated beside B-1 | No automatic picture detection is specified, and no frame may leave the host |
| D-10 | "The three ingest counters" are read as the three of the worker's summing line (dropped for a missing time stamp, dropped before the start, re-timed) | The plan names three and lists none |
| D-11 | `9A/H-20` counts "3 of 3 state that they cannot" as a pass and puts the number of clients that play into the summary | The plan's criterion is "plays or states that it cannot" |
| D-12 | `9A/H-11` names a second outcome, "lost for the rest of the session", when the outage exceeds the relay's bound | The frame lists it as a known limit of the product |
| D-13 | A gap tolerance of 5 s between the measured outage and the gap in the track (`9A/H-11`) | No source; a person reads the clock to the second |

## 5. Points for the controller

1. **Row 129** must deliver, per check, what the chapter lists under each `SCRIPT` step, and nothing that takes a password or captures packets. The two readings that need a decoded track (`9A/H-09.2`, `9A/H-18.1`) depend on whether a stored camera file can be read by the pinned tools directly or only from an export: not known to this row.
2. The relay's give-up bound and attempt intervals, the screen texts and refusal codes of the commissioning functions, and the number of audit entries per commissioning action are marked "to confirm"; rows 43, 105 to 113 and the dry run of row 130 fix them.
3. `9A/H-20` on the tablet depends on the frame's open point 4 (how a client reaches a Core on `127.0.0.1`).
4. The summary of the run may contain lines "not exercised: no such device" (no camera with a query, with a digits-only token, with two lenses). The frame's section 9.4 has no item for them.
5. PoE: unplugging a camera's cable also cuts its power; `9A/H-11` records both and cannot separate link loss from power loss without other equipment.

## 6. What stays unproven

Everything in the document. It is a procedure; it has no result.

## 7. Requests

None in `file_requests.md`.

---
*Generated: 2026-10-13 00:53 (host clock)*
