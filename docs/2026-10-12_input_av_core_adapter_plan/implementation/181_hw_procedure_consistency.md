---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: document-writer
blueprint_row: 181
milestone: M7
work_package: WP-27
type: record of the consistency pass over the hardware acceptance test package (the frame and chapters 2 to 4)
narrative_tier: 1
source_plan: identification/03_implementation_blueprint.md (row 181, line 317; profile line 561)
source_analysis: implementation/124 to 129; delegation_progress/file_ownership.md (lines 145, 175, 230, 297 to 299, 316); decisions/decisions.md (U15 to U19, P11, C19, C24, C25, C34, C35, C37, C40, C45, C46); masterplan/05_design_x1_x2.md; verification/07_security_x1_x2.md; implementation/026, 040, 041, 043, 050, 051, 067, 078, 080, 081, 096, 156, 186, 192; test/184; the product code, read only
status: needs-review
last_updated: 2026-10-13 10:40 (host clock)
---

# Row 181: consistency pass over the hardware acceptance test package - record

**Nothing here is proven on a host.** Four documents were revised on the development Mac. No script and no source file was edited, no collector and no test was run, no device, service or database was touched. Every statement about the product below was read from the code as it stands in the working tree on 2026-10-13 (branch `task4/input-av-core-port`, with uncommitted work of other rows); the file and line are given.

## 1. Subject, scope, method

| | |
|---|---|
| What | The frame and the three chapters of the hardware acceptance test package, made consistent with each other, with the rulings made since they were written, and with the built code |
| Files changed | `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md` (50,859 to 75,491 bytes), `-2-HOST-HELPER-AUDIO.md` (66,044 to 81,095), `-3-NETWORK-CAMERAS-SESSION.md` (59,718 to 78,435), `-4-HELPER-INSTALLATION.md` (49,751 to 53,677). `git diff --stat`: 4 files, 347 insertions, 183 deletions |
| Files not changed | every `collect-h*.sh`, `hw-collect-lib.sh`, `record-line.sh`, the three test scripts, `e11b-announce-probe/`, the host profile, every source file |
| Who reads the result | the user and the person at the bench (the procedure); the owner of the scripts (section 7); the controller (section 6) |
| Method | Each item of the controller's list was traced to its record, then to the code; the chapter text was corrected where the code says otherwise. A mark "to confirm" was removed only when the code settles it; where the code does not exist yet, the mark names the blueprint row or the check of the run it waits for |
| How the files were changed | The frame with the Edit tool. Chapters 2, 3 and 4 by anchored replacements applied from a script (149 edits; each anchor had to match exactly one line or the script stopped before writing), followed by 13 single-phrase replacements, each asserted to occur exactly once. The four files are not shared hot files; this row is their exclusive owner |
| Form kept | Six parts per check: chapter 2, 12 checks with 12 of each part; chapter 3, 15 and 15; chapter 4, 10 steps. Indonesian summary on top of each file, English body. Non-ASCII characters: 0. Literal addresses: `127.0.0.1` and the documentation address `203.0.113.10` only. Each file opens with a note "Revision 2 (2026-10-13)" that lists its changes |

## 2. Group 1, order: 4 of 4 closed

| Item | What changed, where | Evidence |
|---|---|---|
| 1a. The room network is unplugged from `PREP-03` while `9A/H-01` needs packages and source archives | Frame `:232` (`PREP-03` step 2): two ways. Way A, the installation window: the cable is plugged to the end of sequence 8a and pulled in `PREP-08` step 1 (`:265`). Way B, an offline package set, listed item by item. Chapter 2 `:92` (`9A/H-01` precondition) follows it. Chapter 2 open point A closed | `file_ownership.md:145` (1); `implementation/125` |
| 1b. The Core's unit names the helper's group before chapter 4 creates it | Frame `:168`: new sequence 8a, `PREP-12` then `HI-01` to `HI-07`, before `PREP-07` and `9A/H-16`. Sequence numbers 1 to 35 are unchanged, so the recording sheet and `record-line.sh --list` stay valid. Chapter 4 `:111` to `:123` (section 2 rewritten). **Wider than the item asked**: not only `HI-04` part A. The built start checks also ask for the socket, the helper file and the unit files (below), so the whole of `HI-01` to `HI-07` must precede `9A/H-16.2` | `host-checks.ts` check 13 `CAPTURE_HOST_ALIAS_SOCKET` (`implementation/080:45`); `program-checks.ts` checks 2, 3 (`implementation/081:38-39`); decision C46 |
| 1c. The precondition of `9A/H-05` | Chapter 2 `:324`: "`HI-01` to `HI-07` passed"; `HI-08` is steps `.6` and `.7` of the check. Chapter 4 `:425` says the same from its side. Frame `:172` (sequence 12) and `:173` | `file_ownership.md:175` |
| 1d. `9A/H-05.3` uses chapter 4's client | Chapter 2 `:329`: the `ASK` client of chapter 4, section 1; `nc -N -U` named as the equivalent. Steps (e) and `.4` rewritten to the same client | chapter 4, section 1 |

Order check after the change: a check placed before a check or a step it depends on: 0. Three dependencies were added by the pass and placed: the typed address of `9A/H-12.3` needs the camera interface chosen in `9A/H-05.6` (sequence 13 before 18; frame `:178`); the file readings of `9A/H-09.2`, `9A/H-18.1` and `9A/H-08.7` need an export of S1, which is now made in `9A/H-09` (sequence 28) and reused by `9A/H-20.3` (sequence 31); the three chapter 4 lines that need a default route are repeated in `PREP-11` step 3 (frame `:288`).

## 3. Group 2, missing: 6 of 6 closed, one with a stated remainder

| Item | What changed, where | Evidence |
|---|---|---|
| 2a. No pusher on the host for the E-11 repeat and `make e2e` | Frame `:249` (`PREP-06` step 1, "The pusher"): the FFmpeg of `HOST-12` carries no H.264 or H.265 encoder; the Ubuntu package is 6.1.1; a second, self-built FFmpeg 9.0.2 with an encoder is needed for the worker's series and the development sources; the probe pushes with the built-in `mpeg4`. Chapter 2 `:108` (step `.9`), `:109` (step `.10`: port 18563, encoder `mpeg4`, the probe's README). **Remainder**: no pusher is delivered, and how the series is pointed at the second build on the host is written nowhere (frame open point 11, chapter 2 open point B) | `implementation/078:73-74`; `e11b-announce-probe/README.md:37-48`, `:89`; `camera-helper-args.ts:54`; `test-fixtures/rtsp_test_camera.py:218-221` |
| 2b. Bound B-7 | Frame `:144` (section 5, the table of bounds the user sets); `PREP-02` now asks seven values; the record header and UA-11 name B-7. Chapter 2, `9A/H-08` precondition and open point F point to it | `file_ownership.md:145` (6) |
| 2c. Refusal 41 has no step | Chapter 2 `:380`, `9A/H-25.5`: with one address in place, a second `add` in another `/24` answers `41 ALIAS_LIMIT_REACHED`. Chapter 4 `:518` | the helper asks `ALIAS_LIMIT_REACHED` before `CAMERA_INTERFACE_HOLDS_SUBNET` (`scripts/host/netalias/dems-core-netalias:534`, `:536`) |
| 2d. Refusal 37 has no step | Chapter 2 `:381`, `9A/H-25.6`: the user moves `/usr/bin/arping` aside, reads the self-check and one `del` request (both `37 CONFLICT_TOOL_MISSING`), restores the tool, reads the self-check again. No Core is started in between. Chapter 4 `:514` | the helper raises it before any verb's own bound (`dems-core-netalias:514`) |
| 2e. The audit list as a file | Frame `:443` (new section 9.5). Outside a session **the product has no export of the audit list as a file**: "export audit" records an export and answers with a number. The manual reading is given (one line per entry, written by `OPER`). For one session the sealed package holds `audit-session-extract.jsonl` | `modules/security-audit/index.ts:9-10`, `export-request.ts:21`; `sealing/pipeline/contract.ts:407`; root `README.md:377`, `:549` |
| 2f. A readable track as a file | Frame section 9.5: the stored file is encrypted; the product's way is the export (Evidence, the item, Export, Download export; the archive under `SESSION-<id>/export/EXP-<id>.zip`; `npm run evidence:verify-export`). Used by `9A/H-09.2`, `9A/H-18.1`, `9A/H-19.5`, `9A/H-11.5`, `9A/H-08.7`. The assumption of `collect-h18.sh` that the track starts at the start click is stated in frame `:454` and chapter 3 `:389`, with what to do when a camera takes more than 5 s to connect | root `README.md:219`, `:571-575`, `:671-677`; `implementation/129` section 4, points 3 and 4 |

## 4. Group 3, rulings: 9 of 9 written in

| Ruling | Where | What the text now says |
|---|---|---|
| U15, U16, U18, P11 | Frame `:36` (section 1), section 12 | A camera and a microphone are on the user's Mac; the development may run search and connection test there, the user types the password; no recording, no address change; the ALSA microphone path is not exercised on the Mac. None of it is a line of this record |
| U19, X-1 and X-2 | Frame UA table, `:275` (`PREP-09` step 5), `:279` (`PREP-10` step 1), `:479` (section 11 item 8), open point 1 | The two commands by name (`evidence:production-key`, `operator:set-password`) and what the installer does. The statement "not reachable" is revised to "reachable for a bench test once X-1 and X-2 land; a real examination needs more", with the review's list A (9 items) and list B (8 items). `PREP-09` was reordered inside: the password command needs the Core stopped, so it is step 5, after the stop of step 4 |
| C19 | Frame UA-3; chapter 4 unchanged in form | Root service on a local socket, one group, two unit files, no sudoers file |
| C24 and the built rule | Chapter 3 `:202` | Total 256, query 128, 8 parameters, names 32, values 64, no percent-encoding, credential-like names refused. A camera outside it shows `WRONG_PROFILE` with `STREAM_LOCATOR_FORM` and cannot be adopted |
| C25 | Chapter 2 `9A/H-16` step `.5` | Already present; the reason word `CAPTURE_SOURCE_NOT_ASSIGNED` and the item value `NOT_ASSIGNED` added (`capture-notices.ts:385-407`) |
| C34, C35, C40 | Chapter 3 `:296` (`9A/H-17`, "If not met"), `:430` (`9A/H-22`) | A missing camera is a degraded start with a warning; a refusal by the worker's gate is a critical fault of that camera and the capture goes on; an accepted arrival that does not pair ends the capture (`CAMERA_INGEST_NOT_PAIRED`); a production start without the relay's report source is refused (`RELAY_REPORTS_NOT_WIRED`) |
| C37 | Chapter 3 `:296` | A report for a superseded attempt is dropped and counted, not a fault (`CAPTURE_RELAY_REPORT_SUPERSEDED`) |
| C45 | Chapter 3 `:406` (`9A/H-20`), `9A/H-09` part 1 | HEVC seals and verifies on doubles; sample entry `hev1`; QuickLook on macOS did not open `hev1`; the tablet is unmeasured; rows 12 and 57 |
| C46 | Frame section 3; chapter 2 `:283` (`9A/H-16` step `.2`); chapter 4 `:111`, `:439` | The 13 host checks and 4 program checks by code with the profile item and the step of chapter 4 each sends back to |

## 5. Group 4, limits found while building: 10 of 10 stated where the technician meets them

| Limit | Where | Source |
|---|---|---|
| A colon in a camera user name cannot authenticate | Frame `:303` (`PREP-13` step 2); chapter 3 `:206`, `:239` (`9A/H-23`: the five characters are in the password) | `implementation/040:125` |
| A plain-number profile token is unusable | Chapter 3 `:206` | `implementation/026:69` |
| Parameter sets that change after a reconnect; a non-stale 401 on a keep-alive | Chapter 3 `:463` (`9A/H-11` precondition); frame section 9.4 item 7 | `implementation/043:41`; `implementation/186:45`; `relay.h:251-252` |
| A camera that offers only Basic authentication is refused | Frame `:303`; chapter 3 `:191` (the outcome table: `AUTHENTICATION_FAILED` with `SCHEME_NOT_ALLOWED`, the password not sent) | `implementation/041:76`, `:146`; `implementation/050:58` |
| Two lenses with one profile code cannot both be stored | Chapter 3 `:206` | `implementation/051:46`, `:102` |
| The typed-address probe is refused until the camera interface and subnet are configured | Chapter 3 `:58` (`9A/H-12`), `:89` (`9A/H-13`); frame `:178`, section 6 | `implementation/096:9`; `typed-address.ts:40`; `destination-rule.ts:68` |
| A sound card is matched by USB id; serial and port are stored and not yet used | Chapter 2 `:471` (`9A/H-07` step `.8`: the expected result corrected to the built behaviour), `:482` | `implementation/067:65`; `156:70`; `192:19-20`; blueprint rows 199, 200 |
| A card without 48 kHz is refused; two cards of one USB id are refused | Chapter 2 `:451` (`9A/H-07` precondition) | `implementation/067:34`, `:58` |
| The first samples after a card is opened (OP-1) | Chapter 2 `:514` (`9A/H-08` step `.7`), with the three facts to write down | `implementation/067:111` |
| Audio is lost for the rest of a session after a worker restart, until row 191 | Chapter 2 `:531`; chapter 3 `9A/H-17` and `9A/H-19` | `test/184:19-24` |

## 6. Group 5, names and codes: 15 confirmed and corrected; what could not be settled

### 6.1 Confirmed against the code and corrected in the chapters

| # | Mark or assumption | Result | Code |
|---|---|---|---|
| 1 | Argument form of `db:migrate`, `db:seed` | `-- --database <name>` for all four commands | `db/commands/migrate.ts:5`, `db/seed/cli.ts:5` |
| 2 | `9A/H-04.1`: which worker code | `CAPTURE_WORKER_PROGRAM_UNUSABLE` for a path that does not exist; `NOT_CONFIGURED` only when the key is unset | `capture/boot/checks.ts:432-433` |
| 3 | `9A/H-24.4`: refusal or warning, and what is named | A warning, code `DEV_HELPER_LEFTOVER`, with a count, not a process id. The pass criterion was reworded to the count | `capture/fence/index.ts:524-528` |
| 4 | Whether the host checks run in the development operation | No: `REAL_PRODUCTION` only | `implementation/080` section 2 |
| 5 | Whether a production Core without the helper refuses to start | It refuses, once the entry hands the host facts in: three codes | `host-checks.ts`, `program-checks.ts:49`, `:61` |
| 6 | The refusal of a session start on an unassigned selector | 409, `CAPTURE_SOURCE_NOT_ASSIGNED`, item value `NOT_ASSIGNED` | `packages/shared/src/sim/capture-notices.ts:385-407` |
| 7 | `9A/H-05.3` (c): the code | `14 REQUEST_MALFORMED` | `scripts/host/netalias/dems-core-netalias:101`, `:296-304` |
| 8 | `9A/H-05.8`: when the interface mismatch is named | At the start of the Core: `CAPTURE_HOST_INTERFACE_FILE_MISMATCH`, `INTERFACE_FILE_DIFFERS_FROM_ROW`. **The step was rewritten**: choosing another port in the console would leave a Core that does not start and no console to choose again; the mismatch is now produced on the file side and restored | `program-checks.ts:216-224`, `:245-255` |
| 9 | `9A/H-06.8`: the closing reasons | The closed set is `EXPIRED`, `MANUAL`, `JOB_DONE`, `BOOT_SWEEP` | `core/audit-details.ts:197` |
| 10 | `9A/H-07`: the card codes | `AUDIO_INPUT_BEYOND_CARD` (409), `AUDIO_CARD_RATE_UNSUPPORTED`, `AUDIO_CARD_AMBIGUOUS`, `AUDIO_CARD_MOVED`, `REGISTERED`, `REENABLED`, `CARD_CHANGED` | `audio-cards/service.ts:22`; `usb-audio-production.ts:25` |
| 11 | "The three ingest counters" | The worker's line `camera_summary` carries five; three are read as "the three", all five recorded | `capture_worker.c:288-293` |
| 12 | Whether a stored camera file can be read directly | No, encrypted; from an export | root `README.md:549`, `:573` |
| 13 | The relay's bound for giving a camera up | 6 tries after waits of 2, 2, 4, 8, 16, 30 s; ends at once for a changed stream, a vanished address, Basic only | `relay.h:56`, `:251`; `implementation/043:39-41` |
| 14 | The outcomes of a connection test | `REACHABLE`, `AUTHENTICATION_FAILED`, `WRONG_PROFILE`, `NOT_H264`, `UNREACHABLE`; the log line is `CAPTURE_CONNECTION_TESTED` with `outcome`, `authenticated`, `testReason`, `judgedStreams` | `capture/adapters/types.ts:90-96`; `connect/service.ts:376-378` |
| 15 | The camera-path log lines the collectors read (blueprint item 11) | Worker: `session_starting`, `ingest_connected`, `camera_summary`, `worker_stopping`, `worker_exit`, `audio_started`, `video_anchored`, `keyframe_interval_observed`. Core: `CAPTURE_CAMERA_INGEST_PAIRED`, `CAPTURE_CLOCK_OFFSET_MEASURED`, `CAPTURE_SYNC_LEVEL`, `CAPTURE_SYNC_LEVEL_NOT_FULL`, `CAPTURE_FENCE_PASSED`. The chapters now name these; the collectors that differ are in section 7 | `capture_worker.c:236`, `:288`, `:487`, `:500`; `ingest.c:323`, `:652`, `:720`; `capture-session/index.ts:1007`, `:1555` |

### 6.2 Marks "to confirm" left in the four files: 31, each naming what it waits for

| File | Marks | They wait for |
|---|--:|---|
| Frame | 4 | `9A/H-02` (the development set-up on Linux); rows 215 and 219 (X-2 command line); rows 206 and 219 (X-1 command line); `9A/H-17` (the audit extract readable as stored) |
| Chapter 2 | 4 | `9A/H-01.9` on the host (how the series reaches the second FFmpeg build); rows 100 to 117 (the commissioning settings); row 105; rows 105 to 107 |
| Chapter 3 | 5 | `9A/H-12` (the firewall rule of row 76, original text); rows 105 to 109; rows 110, 111, 194 to 198; row 198; row 44 |
| Chapter 4 | 18 | 13 name a check of the run (`9A/H-05`, `9A/H-16`, `9A/H-25`): commands and outputs that only a host can show; 4 name rows 104 and 106 (the removal timer); 1 names row 119 (the security review of the helper) |

Verification cell of row 181: "marks left: 0, or each naming the open row it waits for". 14 marks name a row. 17 name a check of the hardware run and no row: they cannot be settled on this Mac by any row; they are the reason the package exists. This is the reason the status is `needs-review` and not `complete`: the controller decides whether a mark that names a check of the run meets the cell.

### 6.3 What could not be settled, and why

| # | Open | Why it is not this row's to close | Where it is written |
|---|---|---|---|
| 1 | Must a production Core start on a host without the address helper? As built it does not (three fail-closed checks). Chapter 4 said "sessions do not depend on the helper"; corrected. Consequence: a helper that is "not released" (review row 119 missing) now blocks `9A/H-16` and everything after it | A ruling: either the three checks are asked only when a camera interface is stored, or every installation carries the helper | Frame open point 10, `PREP-12` step 2; chapter 4 `:533` |
| 2 | Requirement BR-12 and `9A/H-16` criterion 6. The built host check reads the state of the rule's unit, not the rule table (served request (a) of row 76, `implementation/080` section 4). Step `.9` deletes the table with the unit active: the Core is expected to start, so criterion 6 is expected NOT to be met. The criterion was not weakened; the expected result says so and the line is a `FAIL` with a named reason | A ruling: the criterion reads the unit, or row 80 reads the table | Frame open point 12; chapter 2 `:295` |
| 3 | No pusher with an H.264 encoder is delivered for the host; the encoder library decides the licence of that build | The user's choice of build; a development row for a series that can push with a built-in encoder | Frame open point 11 |
| 4 | The hand-over of the host facts at the Core's entry point is not built (`capture/boot/index.ts:163`: `host?` optional, no caller outside the boot folder). On today's tree no host or program check is asked at a production start | Row 85 | Frame open point 6; chapter 2 `9A/H-16` step `.2` |
| 5 | X-1 and X-2: neither command is in `package.json`. The command lines in `PREP-09` and `PREP-10` are those of the design and of rows 206 and 215. The design says the owner role, the review (SX-03) the runtime role | Rows 206, 215; row 219 then only has to compare the two lines with the built ones | Frame `:275`, `:279`, open point 1 |
| 6 | The commissioning functions through the Core are not in the tree: the temporary address, the scan, set-address, their screens and the setting of the camera interface. No route writes `capture_network_config`; `netalias` occurs only in the boot checks, the audit details, the schema and the fixtures | Rows 100 to 117, 194 to 198 | `9A/H-05.6`, `9A/H-06`, `9A/H-13`, `9A/H-15`, `9A/H-14` each say "not run: not built" until they land |
| 7 | The relay's `camera_lost` and `camera_reopened` lines are not read by the Core (`relay-start.ts:121` reads `push_established` only): the instants of the re-open tries are not in any log the collector gets | Row 44 | Chapter 3 `9A/H-11.5` |
| 8 | The three yes-or-no facts about a camera-side token (`9A/H-10.6`) cannot be derived from the product: it logs no token fact, and a script may not print a token | A product decision whether to log the three facts as booleans | Chapter 3 `:188`: read from the camera's page, else "not read" |
| 9 | How long the host reports a synchronised clock without a time source, and after a restart. A production start refuses on it (`CAPTURE_HOST_CLOCK_NOT_SYNCHRONISED`) while `9A/H-16` runs off the room network | Only a host can show it | Frame open point 5, `PREP-08` step 1 |
| 10 | Whether `audit-session-extract.jsonl` is plain text as stored in the sealed package | Not read in this pass | Frame section 9.5 |

Two overlaps for the controller. Row 219 (the frame's X-1 and X-2 passages) is largely done by this pass; what is left for it is the comparison with the built command lines. Row 130 (the dry run) will meet the collector lines of section 7 as "(absent)".

## 7. For the owner of the scripts: collectors that search for a code, a line or a field that does not exist as written

No script was edited. "Product" is what the code writes today.

| Collector | Searches for | Product | Code |
|---|---|---|---|
| `collect-h08.sh:89` | Core log: `MIC_OPEN_FAILED`, `AUDIO_DEVICE_BUSY`, `MIC_HELPER_EXITED`, `MIC_NOT_CONNECTED` | none exists. The adapter's words: `AUDIO_HELPER_EXITED`, `AUDIO_HELPER_NOT_STARTED`, `AUDIO_HELPER_ENDED_AT_START`, `AUDIO_SHARED_CAPTURE_REFUSED`, `AUDIO_NO_SAMPLE_WITHIN_BOUND`, `AUDIO_CARD_*` | `capture/adapters/audio/usb-audio-production.ts` |
| `collect-h08.sh:93` | worker `audio_started`: fields `sample_rate`, `rate` | the line has `t0_real_us`, `encoders`, `quantum_samples`, `master_mic`, `movflags`; no rate | `apps/capture-worker/src/audio.c:592` |
| `collect-h08.sh:94`, `collect-h19.sh:53` | worker log: `MIC_NOT_DELIVERING` | none. The worker's: `MIC_SILENT`, `MIC_DISCONNECTED`, `MIC_LEVEL_BELOW_THRESHOLD`, `MIC_INPUT_OPEN_FAILED`, `MIC_RATE_AT_LIMIT` | `audio.c` |
| `collect-h05.sh:94` | Core log: the word `ALIAS_HELPER` | the codes are `CAPTURE_HOST_ALIAS_SOCKET`, `CAPTURE_HOST_ALIAS_HELPER_UNSAFE`, `CAPTURE_HOST_ALIAS_GRANT_UNSAFE`, `CAPTURE_HOST_INTERFACE_FILE_MISMATCH` (the search for "netalias" does not match them) | `host-checks.ts`; `program-checks.ts:49` |
| `collect-h10.sh:27`, `collect-h23.sh:29` | Core log: `CAMERA_CONNECTION_TESTED` with `outcome reason durationMs profiles` / `codec` | `CAPTURE_CONNECTION_TESTED` with `outcome`, `authenticated`, `sourceClass`, `guardTripped`, `testReason`, `judgedStreams`. No duration, no profile list, no codec | `connect/service.ts:378` |
| `collect-h10.sh:28` | Core log: `CAMERA_PROFILE_LISTED` with `profileCode codec width height tokenOutsideCodeForm tokenDigitsOnly listed` | no such line and no token fact anywhere | - |
| `collect-h10.sh:29`, `collect-h23.sh:30` | `CAMERA_CREDENTIAL_REFUSED`, `STREAM_AUTHENTICATION_FAILED` | none. The outcome is `AUTHENTICATION_FAILED`; the reason for Basic only is `SCHEME_NOT_ALLOWED` | `capture/adapters/types.ts:92`; `implementation/050:58` |
| `collect-h12.sh:29` | Core log: `DISCOVERY_ADDRESS_NOT_PRIVATE`, `ADDRESS_NOT_PRIVATE` | the first does not exist; the second is the helper's word. The destination rule's word is `PUBLIC_ADDRESS` (and `NOT_CONFIGURED`), and it "never leaves the Core" | `capture/destination-rule.ts:58`, `:68`; `capture-discovery/search.ts:102` |
| `collect-h09.sh:32` | worker line `anchored` with `cam mode offset_us` | `video_anchored` with `mode`, `shift_us` (the match needs the exact quoted word, so `anchored` finds nothing) | `ingest.c:720`; `hw-collect-lib.sh:763` |
| `collect-h09.sh:33` | worker line `keyframe_interval` with `cam interval_ms frames` | `keyframe_interval_observed` with `cam`, `observed_ms`, `bound_ms`, `intervals`, `complete`, `above_bound` | `ingest.c:323` |
| `collect-h09.sh:39-40`, `collect-h17.sh:63`, `collect-h19.sh:57` | Core log: `CAMERA_CLOCK_OFFSET` with `offsetMs clockOffsetMs` | the measurement is `CAPTURE_CLOCK_OFFSET_MEASURED` with `deviceId`, `offsetMs`, `advisoryMs`, `above`. `CAMERA_CLOCK_OFFSET` is the notice, raised only above the advisory threshold | `capture-session/index.ts:1007` |
| `collect-h11.sh:29` | Core log: `CAPTURE_FAULT_CLEARED`, `RELAY_CONNECT_ATTEMPT`, `RELAY_GAVE_UP` | none. The relay's own lines are `camera_lost` and `camera_reopened` on its standard output; the Core does not read them yet | `relay.h:70-72`; `relay-start.ts:121` |
| `collect-h11.sh:28`, `collect-h19.sh:56` | Core log `CAPTURE_FAULT` with `time deviceId reason state` | the supervisor's fault line has `sessionId`, `correlationId`, `reason`; no `deviceId`, `state`, `time` | `capture/index.ts:144-146` |
| `collect-h11.sh:38`, `collect-h17.sh:71` | audit list, substring `CREDENTIAL_REVEAL` | the type is `CAPTURE_CREDENTIAL_REVEALED`; the substring also matches `CAPTURE_CREDENTIAL_REVEAL_FAILED` and would count a failed reveal | `packages/shared/src/sim/vocabulary.ts` |
| `collect-h26.sh:26-27` | Core log: `SESSION_SOURCE_OPENED` (`deviceId profileCode`), `SESSION_SEALED` (`streamStatement`) | neither exists; no log line states a slot's profile code or the seal's stream statement | - |
| `collect-h17.sh:63` | Core log: `SESSION_SEALED` | not a log code (it occurs in API examples only) | `packages/shared/src/api/examples.ts` |
| `collect-h21.sh`, `collect-h22.sh` | the time from the worker's `session_starting` | the chapter's figure runs to the Core's line `CAPTURE_CAMERA_INGEST_PAIRED` (`sessionId`, `deviceId`, `attempt`), which neither collector reads | `capture-session/index.ts:1555` |
| `collect-h24.sh`, `collect-h04.sh` | no code (the boot logs are the user's reading) | the leftover line is `DEV_HELPER_LEFTOVER` with `count`; the fatal boot line carries a code and a reason word | `capture/fence/index.ts:526`; `capture/boot/checks.ts:58` |
| `collect-h01.sh --profile` | prints four words (`met`, `not met`, `to judge`, `deferred`) | chapter 2 now names the four and who turns `to judge` into a word; nothing to change unless the owner prefers two | chapter 2, `9A/H-01.2` |

Codes the collectors search for that DO exist as written: `STREAM_PROFILE_DIFFERS`, `EVIDENCE_VOLUME_SYNC_NOT_FULL`, `CAPTURE_SYNC_LEVEL`, `CAPTURE_SYNC_LEVEL_NOT_FULL`, `CAPTURE_FENCE_PASSED`, `INGEST_NO_EXTRADATA`, `INGEST_OPEN_FAILED`, `INGEST_ENDED`, `INGEST_ANNOUNCE_NOT_MATCHED`, `CAMERA_NOT_CONNECTED`, `CAMERA_STREAM_ENDED`, `CAMERA_UNREACHABLE`, `STREAM_LOCATOR_FORM`, `WRONG_PROFILE`, `MIC_SILENT`, `MIC_DISCONNECTED`, the audit types `HOST_ALIAS_ADDED`, `HOST_ALIAS_REMOVED`, `HOST_ALIAS_REMOVE_FAILED`, `CAMERA_NETWORK_SET`, `CAMERA_FACTORY_SCANNED`, `CAPTURE_DISCOVERY_SEARCHED`, `CAPTURE_AUDIO_INPUT_CHANGED`, `CAPTURE_CONFIG_CHANGED`, the boot codes of `9A/H-16`, and the worker lines `session_starting`, `ingest_connected`, `camera_summary`, `worker_stopping`, `worker_exit`.

## 8. Ports (item 6)

The ports named for the host are the product's: the worker's listeners 8554 to 8564 (14 mentions), and the ports of the earlier system that `9A/H-27` searches (8000, 9997). One port was added: 18563, the default of the package's own announce probe, chosen by the scripts row outside 8554 to 8564 because the loopback rule keeps the administrator's account off those. The test ranges of the development Mac (8559 to 8574 of the worker's tests and the test camera) occur in no chapter.

## 9. The blueprint's twelve items

| # | Item | State | Section |
|---|---|---|---|
| 1 | Network order | closed | 2, 1a |
| 2 | Group before `9A/H-16.2` | closed, widened to `HI-01` to `HI-07` | 2, 1b |
| 3 | A pusher named | closed with a stated remainder | 3, 2a |
| 4 | Bound B-7 | closed | 3, 2b |
| 5 | Precondition of `9A/H-05` | closed | 2, 1c |
| 6 | Refusals 37 and 41 | closed | 3, 2c, 2d |
| 7 | The colon limit | closed | 5 |
| 8 | The audit list as a file | closed: the product has none outside a session; the manual reading is given | 3, 2e |
| 9 | A readable track as a file | closed | 3, 2f |
| 10 | The assumption of `collect-h18.sh` | closed | 3, 2f |
| 11 | The camera-path log codes | confirmed; 12 collectors differ (section 7); the re-open lines wait for row 44 | 6.1 (15), 7 |
| 12 | Every "to confirm" | 15 settled from the code; 31 left, each naming a row or a check | 6.1, 6.2 |

Items closed: 12 of 12 in the sense of the verification cell's second branch, with the reservation of section 6.2.

## 10. Assumptions and limits of this pass

- The code was read in a working tree that other rows are changing; a line number is that of 2026-10-13, about 10:30.
- The blueprint's status table was not used as evidence of what is built (it is behind the tree); the code was.
- Statements about the X-1 and X-2 commands rest on the design and on rows 206 and 215, not on code.
- No statement about a host, a camera or a sound card was verified. Every expected result stays a statement of intent.
- Alternatives considered for the order: keep `9A/H-16` before chapter 4 and move only `HI-04` part A (rejected: the built checks refuse a start without the socket and the files); renumber the sequence (rejected: the recording sheet and the record writer use the numbers).

---
*Generated: 2026-10-13 10:40 (host clock)*
