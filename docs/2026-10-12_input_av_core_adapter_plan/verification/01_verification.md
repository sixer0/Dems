---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 11
date: 2026-10-12
agent: verifier
narrative_tier: 2
subject: the plan set (documents), not code
verdict: PASS WITH FINDINGS
blocking_for_implementation_start: 0
to_fix_in_the_implementation_blueprint: 12
notes: 11
---

# Row 11: verification of the plan set against its goals

> **Ringkasan (Bahasa Indonesia).** Yang diperiksa adalah dokumen rencana, bukan kode. Hasil: **LULUS DENGAN TEMUAN**. Tidak ada temuan yang menahan mulainya implementasi. Tujuh tujuan G1-G7: enam terpenuhi, satu (G2, pernyataan satu pencatat) terpenuhi sebagian karena peta catatan tidak diterbitkan ulang setelah putusan U6-U12 dan syaratnya hanya dijaga oleh aturan, bukan oleh pemeriksaan. Keempat belas putusan pengguna (U1-U14) tercermin; tidak ada yang dilanggar, tetapi tiga hal perlu tafsiran tertulis (B3, B4, C1). Dua belas temuan harus dibetulkan di blueprint implementasi, sebelas adalah catatan. Dari 48 kutipan `file:baris` yang dibuka, 46 tepat, 2 kurang tepat barisnya (isinya benar), 0 salah. Tidak ada berkas sumber atau dokumen rencana yang diubah.

## 1. What was checked, and how

| Item | Statement |
|---|---|
| Subject | `masterplan/01_specs.md` (Amendment 1), `masterplan/03_db_schema_extension.md`, `masterplan/02_plan.md` (v1.1), `decisions/01_decision_register.md` (v1.1), `research/03_analysis_record_map.md`, `research/03_analysis.md`, `test/01_hevc_experiment.md` |
| Measured against | `identification/01_translated.md` (G1-G7), `identification/02_structured.md` (row 11, C10-C13), `decisions/decisions.md` (all 33 rows: U1-U14, P1-P9, C1-C5). Where a later row differs from the blueprint or the plan, the later row is taken as governing |
| Method | Each document read in the sections named below; cited source lines opened read-only from `/Users/gsp-budi/Documents/DEMS`; counts recomputed by hand. No build, test, server or database. Nothing under `apps/input-av/data/` and no `.env` opened |
| Read in full | `02_plan.md`, `decisions.md`, `01_translated.md`, `01_hevc_experiment.md`; `01_specs.md` lines 18-619 |
| Read in part | `03_db_schema_extension.md` (1.8, 2.0, 2.4-2.8, 3, 4, 5); register (head, 0-2.3, F-2, 5, 5.1, 5A, 6-9); record map (1-4.1, 6-14); `03_analysis.md` (5, 7); `01_explore_input_av.md` (4 to TS-6, 4.12); `02_structured.md` (by search: constraints, traceability, row 11) |
| Not read | Register sections 3 and F-1 in detail; schema design 1.1-1.7 and 2.1-2.3; record map 4.2-5; `01_explore_core.md`, the three collection files. A defect that exists only there is not in this report |
| Not available | Rows 12 and 13 (`verification/` held no file when this row ran) |
| Write check | `git status --short` at the end of this row: `?? apps/input-av/` and `?? docs/2026-10-12_input_av_core_adapter_plan/` only. HEAD `cf2f8008`. No tracked file is modified |

## 2. Goals G1 to G7

| Goal | Result | Evidence | Remark |
|---|---|---|---|
| G1 logic inventory with a verdict per item | **Met** | `research/03_analysis.md:127-168`: 38 items H-01 to H-38, one verdict each, counts 14 + 6 + 5 + 13 = 38. Every area the goal names has an item (discovery H-24, H-25, H-28, H-30; network setup H-29, H-31; ONVIF H-01 to H-05; record and reconnect H-07, H-10; audio H-15, H-16, H-19, H-20; storage H-37; preview H-33) | The 13 "blocked by decision" items are closed by rulings, but in three places (`01_specs.md:112-121`, register section 1, plan phase 8) and `01_specs.md:120` still calls H-28 "not ruled" although U9 ruled it. A/V offset has no H item; it is record-map line FG-05. Note N-11 |
| G2 single-record statement | **Partly met** | `research/03_analysis_record_map.md:359-372`: ten kind rows, "two owners after the port: 0", conditions TC-1 to TC-5 at `:376-382`. Carried forward for the new tables at `03_db_schema_extension.md:336-348` and per phase at `02_plan.md:124-154` | The map itself was never re-issued: status "provisional ... waiting for Q3, Q6, Q8, Q10" (front matter line 16; `:336`; `:342`). The conditions are standing rules; TC-1 has no check. One setting has two stores. Section 4 below; N-01, F-06, F-07 |
| G3 mapping onto the adapter contract | **Met** | `01_specs.md:91-106` (14 adopted items to contract members with today's line), `:127-183` (change items per seam), `:218-233` (defaults). Contract lines opened and found as cited (section 6: rows 13 to 22, 32) | - |
| G4 nine mismatches resolved or put to the user | **Met** | `research/03_analysis.md:299-311`: 9 of 9 with a resolution or an entry. Every entry they point to is answered: register `:119-150` (16 entries, 0 open) | - |
| G5 fate of input-av | **Met** | `01_specs.md:498-502`; register Q2 `:167-172`, Q3 (U12 A9); plan SR-1, SR-2, SR-6 (`:112-120`), phase 9 / WP-21 (`:459-475`), transition rule `:154` | What the bench installation does after stage 2 is a proposal, not a ruling. Note N-02 |
| G6 work sorted by what it needs | **Met** | Plan section 8 (`:195-225`): 27 packages, one class each, D 20 + C 2 + N 3 + H 2 = 27 (recounted); per package the double, the unproven list and the moved checks | - |
| G7 risks, and a check per milestone | **Met** | Plan section 17: R-1 to R-25. Phases 0 to 11 each carry a "Completion check" and a "Rollback" line (12 of 12 found). Section 9A: 20 checks with pass criteria | Two bounds have no value (H-18, H-19); the plan says so (`:560-561`, Gap 1) |

Constraints of the blueprint: **C10** met (`01_specs.md:565-567`). **C11** met (`01_specs.md:218-233`; P3 confirmed by C3). **C12** closed by U12 A1 (WP-16 not planned). **C13** met as a rule set, with F-06 and N-02.

## 3. User rulings U1 to U14

"Reflected" = the plan set carries it. "Contradicted" = a statement of the plan set that, read with the plan's own reading rule (`02_plan.md:26`), still stands against it.

| Ruling | Reflected at | Contradicted? |
|---|---|---|
| U1 porting only | `01_specs.md:565-567`; plan `:106` | No |
| U2 input-av input scheme as default (P3, C3) | `01_specs.md:218-233`; register 2.3 | No. Plan `:251,647` and register `:70` still list the P3 confirmation as open; C3 closed it (N-03) |
| U3, U5 no source change; superseded by P9 | Plan SR-3 `:114`; phase 0 check `:254` | No |
| U4 H.265 check now | `test/01_hevc_experiment.md` | No. See section 7 for the wording of its result |
| U6, U7 network functions required, in the Core | Plan phase 10 `:477-512`; `01_specs.md:410-433` | No |
| U8 schema extended | `03_db_schema_extension.md` 2, 3; WP-24 to WP-26 | No |
| U9 active scan only | Plan `:497` ("`add` and `del` only ... no packet capture"), `:511`, R-21 | No in the plan. `01_specs.md:120,447` still read "not ruled" (F-01) |
| U10 TECHNICIAN only | Plan `:496`, check `:508` ("held by 1 role") | No for the commissioning functions. `01_specs.md:424` still offers SUPERVISOR (F-01). The role for the typed-address probe is not stated (F-11) |
| U11 OQ-1 to OQ-5 | Register `:455-461`; plan `:494,501,505,630-634` | No. Three sets, three steps 6-7-8-9, set E not built, set D with WP-18, interface nullable |
| U12 A1 stored form = the Core's | Plan `:435`; register `:125` | No |
| U12 A2 Linux, Ubuntu 24.04 | Plan `:178,363,543` | No |
| U12 A3, A4, A5 | Plan `:316,388`; register F-1, F-2, Q9 | No |
| U12 A6 amendments (C4) | Register 5, 5.1; plan `:250` | No |
| U12 A7 typed-address probe | Plan phase 8 `:434-456` | No (F-11) |
| U12 A8 one room | Plan `:436`; WP-17 not planned | No |
| U12 A9 legacy data untouched | Plan SR-1, SR-2, phase 9 | No |
| U12 A10 host checks now, gain deferred | WP-20 phase 5; WP-18 deferred | No |
| U12 B1, B2 | Plan SR-3 | No |
| U12 B3 baseline, own branch, a commit per phase, no push | Plan SR-9 `:115` | **Needs a written reading.** "One commit per phase" stands beside "a schema set never in the same change set as its first writer" (`:289,308,511`): phase 2 needs two change sets, phase 10 three (F-09) |
| U12 B4 migrations on the local demo database only | Plan SR-9 | **Needs a written reading.** Plan `:287,308` add "the test PostgreSQL"; the acceptance host of track H needs a migrated database, which no step provides (F-08) |
| U12 B5, B6, B7 | Plan SR-10, SR-9, `:139,154` | No |
| U13 no hardware during development | Plan section 8: each of the 20 class-D packages names its double (WP-09: none needed); completion checks of phases 1 to 8 and 10 name no device; the container or VM is "not required by any completion check" (`:227`). WP-27 exists as a package (`:407-426`) with 20 checks (`:541-562`); WP-15 is its run | No in the plan. `01_specs.md:34,517,523,527-531,536` still class WP-08, WP-14, WP-18, WP-19, WP-20, WP-22 as needing a Linux host with hardware (F-01) |
| U14 autonomous from verification through implementation | Not named: plan and register cite "U1 to U13" | No; SR-3 agrees with it (N-03) |
| P9 release only after the three rows pass | Plan `:15,79,114,244,254` | No |
| C1 credential retyped, used for one call | **Not reflected:** plan `:485,648` and register `:71` hold the AM-7 choice open | Possible conflict with "in memory for the job" (F-03) |
| C2 WP-26 = table + operation + audit entry | **Not reflected:** plan `:596` is the table only, writer unassigned | F-02 |
| C5 estimate | Plan section 21 | No |

## 4. "No double records"

**The count.** 0 in the target state (`03_analysis_record_map.md:372`), under five conditions. Where each is enforced:

| Condition | Enforced in the plan by | Kind of enforcement |
|---|---|---|
| TC-1 input-av does not run on the target installation | SR-2 (`:113`), phase 5 "must not" (`:380`), table row `:137` | Rule only. No check of section 9A looks for it |
| TC-2, TC-3 no surviving tool opens input-av's database or users | No tool survives: U7 and U12 A10; no package edits or runs input-av (SR-2, SR-6) | By absence of any such package |
| TC-4 no tool stores or receives a camera credential outside the Core | Phase 10 check `:508` (0 occurrences; adoption through operation 96 only) | Test on doubles; H-14 |
| TC-5 the existing data has no writer | SR-1, SR-2; WP-21 (the user, phase 9) | Rule; a user action |

**Record kinds that can still have two writers, by phase.**

| # | Kind | When | What happens | Covered? |
|---|---|---|---|---|
| 1 | All eight kinds (session, recording, audit entry, user, device registry entry, camera credential in plain text, setting, marker) | Track D and the wait before track H | The bench input-av keeps writing its own database. U12 B7 allows it "for tests only" | Ruled. Not a double record of a session: the Core records no production source (`:139`) |
| 2 | The same eight | Phase 11, **if the acceptance host is the bench laptop** | The only Ubuntu 24.04 machine the documents know is the bench laptop that runs input-av (`apps/input-av/docs/SERAH-TERIMA.md:78`). Its service, its sudoers helper and its ALSA configuration generator would sit beside the Core | Rule only (`:137`). No precondition, user action or check. F-06 |
| 3 | The same eight | After stage 2 | B7 ends "when the Core can record". What the bench installation may do then is "kept as a proposal" (`:154`) | Not ruled. N-02 |
| 4 | Device registry entry, camera credential | From phase 11 | The cameras of the acceptance run are registered in the bench input-av with plain-text passwords (`SERAH-TERIMA.md:80`) and are adopted by the Core | Not a writer once the bench is idle; goes with rows 2 and 3 |
| 5 | Setting: the camera interface | Phase 10 on, target state included | Stored in `capture_network_config.interface_name` (the technician, console) and in the root-owned file the helper reads (the user, at installation). The design calls the file an enforcement copy and a difference "a named refusal" (`03_db_schema_extension.md:273`; plan `:147`) | The refusal is in no tracking list, completion check or H-check. F-07 |
| 6 | Installation acceptance | Phase 11 | A row in `installation_acceptances` (set C) and the result record of the acceptance run (a document). Different facts with one name | Relation not stated. N-10 |

A different defect, which the record map names at `:394`: an action no system records. Two audit types of the schema design have no package (F-04).

## 5. Internal consistency

Sizes agree for all 27 packages between `01_specs.md:510-532`, `03_db_schema_extension.md:381-383` and plan sections 7, 8, 10. Counts recomputed and found right: phases 25 + 2 = 27; classes 20 + 2 + 3 + 2 = 27; estimate units 17 + 14 = 31; pin table 21 rows (`01_specs.md:260-280`). Mismatches:

| # | Subject | Document A | Document B | Acknowledged by the plan? |
|---|---|---|---|---|
| M1 | **WP-23 / WP-25 split (confirmed)** | `01_specs.md:530`: WP-23 holds "the persistent data ... implemented from" the schema design and is verified by "the migration applies and reverts"; also `:151`, `:429`, `:561` | Plan `:592-593`: WP-25 is the schema set, WP-23 vocabulary and permission only; `03_db_schema_extension.md:385` proposes it | Yes: AS-4 `:795`, log I-9 `:828` |
| M2 | WP-19 and WP-14 | `01_specs.md:528`: WP-19 depends on "WP-14 (build: helper installed)" | Plan `:584,594,670`: reversed; WP-14's helper clause needs WP-19's contract | Yes: I-10 |
| M3 | Host of WP-08, WP-14, WP-18, WP-19, WP-20, WP-22 | `01_specs.md:517,523,527-531,536`: Linux host with hardware | Plan section 8: class D, closed on doubles | Yes, by the reading rule `:26` |
| M4 | WP-04, WP-05, WP-07 depend on WP-24 | `01_specs.md:513,514,516`: none, WP-03, none | Plan `:576,579,582` | Yes: `:568` |
| M5 | WP-03's dependency on WP-01 | `01_specs.md:512`: "E-2 outcome" | Plan `:578`: "E-11"; plan `:313`: both | No |
| M6 | Trigger of WP-10 | `01_specs.md:182`: "only if E-1 demands it" | Plan `:581`, register `:386`: "only if E-8 demands it" | No |
| M7 | Pass criteria of E-1 | `01_specs.md:331`: three, among them "the session seals and verifies"; E-8 (`:333`) is playback only | Plan `:268`: E-1 ticked, sealing and verification "remain under E-8" | Stated, not as a change of the design (F-05) |
| M8 | WP-15 | `01_specs.md:524`: depends on WP-13, WP-14; E-3, E-4, E-5, E-9 | Plan `:598`: WP-27 and all of track D; H-01 to H-20 | Yes: phase 7 text |
| M9 | WP-26 | `03_db_schema_extension.md:373`: "Consumer: WP-20"; `:430`: "the acceptance gate must be switched off" | Plan `:596,830`: writer unassigned, a gate is "a scope question for the user". `decisions.md` C2: the operation belongs to WP-26 | Partly: I-11; C2 is later than the plan (F-02) |
| M10 | Audit types of the commissioning function | `03_db_schema_extension.md:274,305,420`: up to 7, with `CAPTURE_NETWORK_CONFIG_CHANGED`; `:231`: `CAPTURE_AUDIO_INPUT_CHANGED` | Plan `:495`: six; plan `:349`: WP-07 writes fault types only | No (F-04) |
| M11 | Lift conditions | `01_specs.md:239`: "the six conditions"; `:252`: stage 1 on L-1 to L-5 | Plan `:385`: L-1 to L-5 | No; the specification disagrees with itself |
| M12 | Line references into `01_specs.md` | Plan cites `:374-396` (work packages), `:207-227` (pins), `:190-197` (lift), `:278` (E-1) | Today: `:508-532`, `:260-280`, `:245-250`, `:331` | Yes: plan `:26`, register `:496` (N-04) |
| M13 | Identifiers used twice | `H-nn`: logic items H-01 to H-38 (`03_analysis.md`), hardware checks H-01 to H-20 (plan 9A), hypotheses H-A to H-W. `I-n`: impact items of `01_specs.md:546-561`, log items of plan section 19 | Plan `:510` writes "(I-13)" and "(I-15)" and means the design's impact items; the plan's own I-13 and I-15 are other things | No (F-10) |
| M14 | User actions | Plan `:177,417,737,899`: UA-1 to UA-6 | Plan `:461,650,745`: UA-1 to UA-5 | No |
| M15 | Order of the checks | Plan `:539`: "H-12 to H-15 need H-05" | Plan `:554`: H-12 needs H-01 only | No |
| M16 | Open small items | Plan `:251,485,647-649`; register `:68-72`: P3, AM-7 choice, acceptance writer open | `decisions.md` C3, C1, C2: settled | Later rows (N-03) |
| M17 | State of the record map and the specification | Record map status "provisional"; `01_specs.md:10` "proposed", `:435` "what the user must still rule" | Register `:102`: 0 open entries | No (F-01, N-01) |
| M18 | Register version text | Register `:17,524`: "rulings U4 to U11" | Register `:9,24`: U1 to U13. Register `:165` says row P1 is "UNCONFIRMED"; `decisions.md:5` says confirmed | No |

## 6. Citations opened (48)

Result: **46 hold exactly, 2 hold in substance on a neighbouring line, 0 do not hold.** Rows 1 to 12 are from the "Tested input scheme" (`research/01_explore_input_av.md` section 4, and the defaults table that quotes it). The lines were read at HEAD `cf2f8008`, in which task 3 is committed; the documents were written against the uncommitted tree of the same day.

| # | Cited in | Citation | Claim | Result |
|---|---|---|---|---|
| 1 | R1 `:187-188` | `apps/input-av/nvr/recorder.py:148-152` | record command, `-c:v copy`, `-f mpegts` | holds |
| 2 | R1 `:189` | `recorder.py:217` | `-rtsp_transport tcp -timeout 5000000` | holds |
| 3 | R1 `:215-216` | `nvr/onvif_client.py:243-245,248-249` | grouped by video source; largest area | holds |
| 4 | R1 `:277` | `nvr/config.py:49-50` | `RECONNECT_DELAY` default 2 | holds |
| 5 | R1 `:277` | `nvr/service.py:20-21` | `MAX_RETRY_DELAY = 30.0`, `RESUME_CONFIRM_S = 5.0` | holds |
| 6 | R1 `:287` | `nvr/service.py:205-206` | delay formula 2, 4, 8, 16, 30 | holds |
| 7 | R1 `:195` | `nvr/config.py:47` | FFmpeg binary from `NVR_FFMPEG` | holds |
| 8 | R1 `:204` | `docs/SERAH-TERIMA.md:79-80` | four cameras, H.265 although ONVIF reports H264 | holds |
| 9 | R1 `:204` | `SERAH-TERIMA.md:122-124` | four rooms, 54-57 s, hashes match | holds |
| 10 | `01_specs.md:230` | `nvr/audio.py:463-488` | `dsnoop` plus `plug`, `period_size 1024 buffer_size 8192` | holds |
| 11 | `01_specs.md:231` | `recorder.py:104-116` | all native channels opened, `pan` selection | holds |
| 12 | `01_specs.md:232,233` | `nvr/routers/audio.py:25-26`; `nvr/audio.py:103-106` | 24-bit, 48,000 Hz; first USB card | holds (2) |
| 13 | `01_specs.md:260,261` | `adapters/registry.ts:36`, `:82` | list `[FAKE, LOCAL_DEVICE]`; refusal | holds (2) |
| 14 | `01_specs.md:57,265` | `adapters/camera/onvif-rtsp.ts:23-38`, `:28`, `:31-33`, `:35` | stub, `hasOpener: false` | holds |
| 15 | `01_specs.md:57,266` | `adapters/audio/usb-audio.ts:17-29`, `:22`, `:23`, `:27` | stub | holds |
| 16 | `02_structured.md:76` | `adapters/camera/onvif-session.ts:491` | `NOT_H264` | holds |
| 17 | `01_specs.md:182,223` | `capture-worker/src/ingest.c:361-362` | stream copy; `codec_tag = 0` | holds |
| 18 | `01_specs.md:332` | `ingest.c:512` | `INGEST_NO_EXTRADATA` | holds |
| 19 | `01_specs.md:65,183` | `ingest.c:540-541` | one session by design; non-video dropped | holds |
| 20 | `01_specs.md:228` | `ingest.c:583-589` | `camera_clock_out_of_bound` | holds |
| 21 | `01_specs.md:132` | `adapters/local/process-door.ts:96` | `stdio: ['ignore', 'pipe', 'pipe']` | holds |
| 22 | `01_specs.md:65,137` | `adapters/credential.ts:117-125` | the injection point | holds |
| 23 | `01_specs.md:310` | `capture-session/index.ts:1056` | predictable ingest path | holds |
| 24 | `03_db...:358` | `db/schema/meta.ts:38,40` | version 6, `dbc-7` | holds |
| 25 | `03_db...:356` | migrations folder | 15 files, `0000` to `0014` | holds |
| 26 | `01_specs.md:263,264` | `capture/fence/sources.ts:86`, `:105-106` | recordable rule; no opener, no row | holds (2) |
| 27 | `02_structured.md:77` | `capture-worker/src/audio.c:233-237` | mono, 48,000 | holds |
| 28 | `01_specs.md:331` | `capture/fragments.ts:453-459` | `hvc1`, `hev1` to `HEVC` | holds |
| 29 | `01_specs.md:269,270` | `adapters/__tests__/registry.test.ts:89`, `:90` | the two test pins | holds (2) |
| 30 | `01_specs.md:514` | `packages/shared/src/api/capture.ts:168` | 15,000 ms | holds |
| 31 | `01_specs.md:106` | `adapters/local/mic-helper-args.ts:58` | `-f avfoundation` | holds |
| 32 | `01_specs.md:293` | `adapters/types.ts:120-123` | `CameraSourceTarget { ingestUrl }` | holds |
| 33 | `03_db...:260-263` | `nvr/settings.py:55-62` | factory list, 253, 30, 101 with their ranges | holds |
| 34 | `01_specs.md:398` | `scripts/dems-netalias:38-43` | `arping -D -q -c 2 -w 3`; skipped when absent | holds |
| 35 | record map `:321` | `nvr/doctor.py:44-45` | `init_db()` first | holds |
| 36 | `01_specs.md:397` | `nvr/netalias.py:73-81` | any interface counts | holds |
| 37 | record map `:318,319` | `nvr/factory.py:68-69`; `nvr/registration.py:62-64` | `_seen`; plain-text password | holds (2) |
| 38 | `01_specs.md:361`; `03_analysis.md:145` | `ingest.c:163-172`; `capture_worker.c:148-149` | AAC 96 kbit/s; mono 48 kHz only | holds (2) |
| 39 | `01_specs.md:416,424` | `packages/shared/src/sim/vocabulary.ts:40`; `api/capture-discovery.ts:559` | idle only; SUPERVISOR and TECHNICIAN | holds (2) |
| 40 | `01_specs.md:150` | `node_modules/onvif/lib/device.js:230,263,373`, `cam.js:1165`; version 0.8.3 | the four calls are present | holds |
| 41 | record map `:113` | `vocabulary.ts:346-435` | 67 audit types | holds (counted 67) |
| 42 | `01_specs.md:159` | `db/schema/capture.ts:46` | `address` text column | holds |
| 43 | `01_specs.md:65` | `SERAH-TERIMA.md:189-193` | automatic source moved two microphones | holds |
| 44 | `01_specs.md:79` | `SERAH-TERIMA.md:107` | "8 rooms with virtual H.264 cameras" | **imprecise**: line 107 gives the 8 rooms; "virtual" is line 112; the codec is on neither line (R1 `:478` cites the script for it) |
| 45 | `01_specs.md:80` | `SERAH-TERIMA.md:126,187-188` | EVO 8 recognised, four parallel processes, recordings silent | **imprecise**: silence is at 126 and 187; "recognised, four processes" is line 110, not cited |
| 46 | plan `:77,114` | `02_structured.md:52`; `decisions.md:26` | C13; P9 | holds (2) |
| 47 | plan `:113,154,466` | record map `:353,378`, `:346`, `:351` | writers into `data/`; TC-1; test recordings; frozen archive | holds |
| 48 | plan `:764` | `initialization/01_env_check.md:3` | `apps/input-av/` untracked | holds |

Side result: at HEAD the Core, worker and package folders are clean, the schema is at version 6 with 15 migration files, and every line sampled sits where the documents put it. The re-measurement that phase 0 plans should therefore find little (N-09).

## 7. Stated as proven beyond what the HEVC report or the "tested" scope supports

| # | Statement | Where | What the evidence supports |
|---|---|---|---|
| O-1 | The defaults of `capture_network_config` are "the values input-av was tested with (U2)" | `03_db_schema_extension.md:270` | Not supported. No camera of the four listed vendors was tested at its listed address; the three bench cameras sat on addresses outside the list; by which path they were moved is not recorded (`01_specs.md:82,395,408`, hypothesis H-W). They are input-av's defaults, untested. F-12 |
| O-2 | "E-1 PASS" | Plan `:264,268,572,824,959`; register `:42,142,409` | One of the design's three criteria (`01_specs.md:331`). "The Core reader reports HEVC" and "the session seals and verifies" were not exercised (report section 2). The plan says so beside each use; the label is still the stronger one, and lift condition L-4 ("WP-01 passed") leaves E-8's part to a later call (`:388`). F-05 |
| O-3 | "H-C holds", "H-G holds" | Report section 1 (`:22`); register `:413` | H-C ("a usable sample entry") rests on FFmpeg's own probe and decoder and on the tail validation; no Core reader, no player. H-G: the name `hev1` is shown; that players refuse it is untested (report `:31`). N-07 |
| O-4 | "For a real H.265 camera the worker itself is not the obstacle" | Report `:24` | An inference from two encoders on the same host: GOP 1 s, no B-frames, parameter sets on every keyframe, 15 s, one FFmpeg build on macOS. The report limits it with "provided"; it is not a result. N-07 |
| O-5 | "the tested ALSA parameters", "the tested input-av source" | Plan `:337,785` | For audio the scheme is logic-tested; on the USB interface the recordings were practically silent and the cause is unknown (`SERAH-TERIMA.md:126,187`). The plan says this at `:204` and makes a silent input a fail in H-08. Text equality proves the copy, not the function |
| O-6 | "350 dari 350 frame" | Plan `:61`; register `:42` | 350 of 350 **expected**; 375 were pushed and the worker leaves out 25 by its start rule (report `:76`). The English text says "expected"; the Indonesian summary does not |
| O-7 | The controller re-probed both files independently | Register `:413` | Not in the report; the register itself says so |

Supported as written: the scope of "tested" in `01_specs.md:73-85` and register N-3 (`:206`); the four runs of the report with their figures; "not sealing" for the tail validation; the list of what stays unproven (report section 2), which the plan repeats at `:61,197`.

## 8. Findings, ranked

### Blocking for implementation start

None.

### To fix in the implementation blueprint

| Id | Finding | Evidence | Rework by |
|---|---|---|---|
| F-01 | The specification was not re-issued after U9 to U13. Its package table still gives hosts, dependencies and the scope of WP-23 that the plan replaced, and three passages read as open what is ruled. The blueprint must carry one governing package table (plan section 10) and list the superseded passages | M1, M2, M3, M17; `01_specs.md:34,120,424,435-450,528,530,536` | task-architect (blueprint); row 8 if the document is re-issued |
| F-02 | WP-26 has no designed writer. C2 puts the acceptance operation into WP-26; no document says who may accept or revoke, with which permission, or whether recording is refused without an acceptance. The schema design's rollback assumes a gate; the plan calls a gate a scope question. Size S no longer holds | M9; `decisions.md` C2; plan `:596,830,915` | task-architect; the user if a gate is wanted |
| F-03 | C1 ("used for that one call; never kept for a later job") against the design of WP-22 ("held in memory for the job", up to the 180 s wait, with the MAC read again after the change). "One call" must be defined as the one operation with its wait, or the wait cannot authenticate | `decisions.md` C1; `01_specs.md:423`; plan `:503` | controller (log entry); blueprint row of WP-22 |
| F-04 | Two audit types of the schema design belong to no package: a change of the network configuration, and the registration or change of an audio input. Without them a change of the camera interface or of a microphone is recorded nowhere | M10 | blueprint rows of WP-23 and WP-07 |
| F-05 | E-1 is to be recorded as passed in its worker part only, and lift condition L-4 must name what it needs from E-8 (a sealed and verified HEVC session) before WP-13 | O-2, M7 | blueprint rows of WP-01 and WP-13 |
| F-06 | TC-1 has no check. WP-27 needs a precondition before H-01: no input-av service, helper, sudoers line or ALSA generator on the acceptance host, with the user action that goes with it | Section 4, rows 1 and 2 | blueprint row of WP-27 |
| F-07 | The camera interface is stored twice. The refusal on a difference between the root-owned file and the database row needs a test in WP-19 and a line in H-05 | Section 4, row 5 | blueprint rows of WP-19 and WP-27 |
| F-08 | U12 B4 needs a written reading for two cases the plan already relies on: the local test PostgreSQL, and the database of the acceptance host in track H, for which no step exists | Plan `:287,308,543`; `decisions.md:24` | controller (log entry); blueprint row of WP-27 |
| F-09 | U12 B3 "a commit per phase" against "a schema set never in the same change set as its first writer": state that a phase may hold several commits | Plan `:115,289,511` | controller (log entry) |
| F-10 | Rename the hardware checks (they share H-nn with the 38 logic items and the hypotheses) and qualify the impact items the plan cites as "(I-13)", "(I-15)" | M13 | task-architect |
| F-11 | The role for the typed-address probe and the confirmed re-address (WP-12) is not stated. The search operation is open to SUPERVISOR and TECHNICIAN, on console, tablet and phone; A7 speaks of the technician | `capture-discovery.ts:559`; plan `:434-456` | controller (log entry); blueprint row of WP-12 |
| F-12 | Reword the "tested" claim for the commissioning defaults | O-1 | blueprint row of WP-25 |

### Notes

| Id | Note |
|---|---|
| N-01 | The record map is still "provisional" with counts 45 / 63 / 13 and lines T10a-5, T10c as dropped; under U7 they are Core records (set B). The final statement of G2 lies in three documents |
| N-02 | What the bench input-av may do after stage 2 is not ruled. Put it to the user with the stage 2 ruling |
| N-03 | Plan and register predate U14 and C1 to C5 |
| N-04 | Line references into `01_specs.md` are of the file before Amendment 1 (M12). Cite by section |
| N-05 | Small inconsistencies: M11, M14, M15, M18; SR-8 names hypotheses "H-A to H-R" while the set runs to H-W and H-DB-4 |
| N-06 | M5, M6: which experiment triggers WP-03's start and WP-10 |
| N-07 | Wording of the HEVC report: O-3, O-4, O-6, O-7 |
| N-08 | Two imprecise citations (section 6, rows 44 and 45) |
| N-09 | The baseline exists: HEAD `cf2f8008` holds task 3; phase 0's first item is done in substance |
| N-10 | "Installation acceptance" (set C) and the result record of the hardware acceptance run are two things with one name |
| N-11 | G1 has no single table of final verdicts after the rulings |

## 9. Verdict

**PASS WITH FINDINGS.** The plan set meets G1 and G3 to G7 and meets G2 in part; it reflects every user ruling and contradicts none once the plan's reading rule is applied; every track-D package closes without a device and names its double; the hardware acceptance test package exists with 20 checks. Nothing found prevents the start of implementation. The twelve F findings are for the implementation blueprint; three of them (F-03, F-08, F-09) need a logged reading of a ruling before the package they touch starts.

Not covered by this row: technical soundness against the code (row 12) and security (row 13).

---
*Generated: 2026-10-12 (clock time not available to this agent)*
