---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-14
agent: coder-execution (wave 12, agent C1)
row: C1 (document-and-collector row, track D)
type: record of the document pass over the four hardware acceptance chapters, the host profile and the collectors
narrative_tier: 1
source_plan: delegation_progress/wave_12_brief.md; delegation_progress/file_ownership.md (from "Update 2026-10-13 - row 181 landed" to the end)
source_decisions: C49, C53, C54 (4), C56, C59, C63, C65, C66 (3), C70, C79, C84, C85, C86, C89, C90, C94, C97, C100, C101, C102, C103, C105, U21
source_records: implementation/181_hw_procedure_consistency.md; implementation/079b_mic_helper_argument_row.md; delegation_progress/file_requests.md lines 319, 338, 405, 420, 429, 436, 439, 441, 442, 450, 453, 456
status: complete
head: 1fbeada7 (working tree; nothing committed, staged or pushed by this row)
last_updated: 2026-10-14 09:20 (host clock)
---

# Row C1: hardware chapters, host profile and collectors - record

**Nothing here is proven on a host.** Twenty-four files were changed on the development Mac. No command of a chapter or of the host profile was run on Ubuntu, on a camera or on a sound card; no device, service or database was touched. What WAS run is stated in section 6: the collectors' two test scripts, the host profile's script test and one test of `packages/shared`, all against doubles.

## 1. Subject, scope, method

| | |
|---|---|
| What | The four chapters `scripts/hardware-acceptance/HW-ACCEPTANCE-1..4-*.md`, the host profile `scripts/host/HOST-PROFILE-UBUNTU-24.04.md`, 17 collectors `collect-hNN.sh` and their two test scripts, brought into line with the decisions taken since row 181 and with the product source as it stands |
| Who reads the result | The user and the person at the bench (the procedure); the installer (the host profile); the controller (sections 5, 7, 8) |
| Not touched | `README.md` and `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md` (agent C2); every product source; `hw-collect-lib.sh`, `record-line.sh`, `test_hw_common.sh`, the scripts under `scripts/host/*.sh`; `scripts/host/netalias/*` |
| Method | Every code, field, command and file name written into a chapter or a collector was first found in the source in the tree (grep over `apps/core-server/src`, `apps/core-server/cli`, `packages/shared/src`, `apps/capture-worker/src`, and the helper `scripts/host/netalias/dems-core-netalias`); command names from `apps/core-server/package.json`. Where the source says something else than a decision or an earlier record, the source was followed and the difference is in section 7 |
| How the files were changed | The Edit tool only, small edits after reading each file in full; no scripted or anchored replacement, no shell append. The two records are new files (Write) |
| Form kept | Six parts per check; Indonesian summary on top of each chapter; non-ASCII characters in the five documents: 0 (counted); no emoji. Each chapter gained a note "Revision 4 (2026-10-14)" that lists its changes; the frame's recording sheet (section 9.2) and its two pinned sentences of section 9.1 are byte for byte as before. The host profile keeps its 56 items (no row added or removed) |
| Size | `git diff --stat`: 24 files, 437 insertions, 208 deletions |

## 2. Chapters: the seven items of the brief

| # | Item | Where it was written | Source checked |
|---|---|---|---|
| 1a | The helper's hash | Chapter 4 `HI-01.4`, `HI-02.6`, `HI-10.1` (the three lines that printed `62c0b726...`); chapter 2 `9A/H-05.1` ("begins `1e758a24`"); frame `PREP-12` step 1 | `shasum -a 256 scripts/host/netalias/dems-core-netalias` = `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1`; `shasum -a 256 -c SHA256SUMS`: three `OK`. This meets condition C-3 of decision C101 for the chapter. `implementation/104_alias_helper.md:34` still prints the old hash: not this row's file |
| 1b | The five new refusals 38, 46, 47, 48, 55 with their fixed words | Chapter 4 `HI-06` (a table: when each is given, where it is shown), `HI-05` (`.1a` and the answer table for 38), section 4, open point H; chapter 2 `9A/H-25` new step `.7` (46 with `ip link set ... arp off`, 47 with the cable out, the tool's own printed text for a free and a taken address), criterion and record | The table `CODES` and `refuse_unless_askable`, `conflict_verdict`, `_expected_conflict_tool`, `add` of the helper (lines 126-160, 544-595, 257-280, 714-750) |
| 1c | `9A/H-06`, two lines of R119b-02 | Chapter 2 `9A/H-06` new step `.7a` (inside the 60 s of the mark's grace: `del` answers `0 OK` with `note=already-absent`, mark files 0), expected result, criterion 4 | Helper `MARK_GRACE_S`, `mark_stands`, `delete`; `verification/119b_helper_statement.md:169` |
| 1d | `check` answers 35 until a first connection and after every restart | Chapter 2 `9A/H-05` expected `.5` (it was already in chapter 4, `HI-05` and open point E) | C53 (e); helper `marked_addresses` |
| 1e | Package `iputils-arping`, path `/usr/bin/arping` | Chapter 4 `HI-05` precondition and `.1a` (the two records of the package manager), section 1; chapter 2 `9A/H-25.1`; host profile `HOST-18` | Helper constants `ARPING_TOOL`, `CONFLICT_PACKAGE`, `DPKG_INFO_DIR`; request line 441 |
| 2 | The order: the helper is not mandatory (C94 (j) reverses C49 (1)) | Frame section 6 (sequence 8a = `PREP-12` + `HI-04` part A only; sequence 12 = `HI-01` to `HI-07` as a whole; numbers unchanged), section 2, UA-3, `PREP-11` step 3, `PREP-12` steps 1 to 3, open points 6 and 10; chapter 4 section 2 (the table of what a start finds and does; "all of it or none"; the other order stays allowed), section 5, open point A; chapter 2 `9A/H-16` precondition and step `.2`, `9A/H-05` precondition and `.7`, open point E | `capture/boot/checks.ts` (4e amended, `ALIAS_HELPER_ABSENT`), `program-checks.ts:33-49` (ABSENT / PARTIAL / WRONG), `fence/boot-key.ts` (`addressHelperSocket`), `camera-network/index.ts:23` (`409 COMMISSIONING_NOT_AVAILABLE`) |
| 3 | Criterion 6 of `9A/H-16` as a stated limit | Chapter 2 `9A/H-16` step `.9` (the Core starts), criterion 6 with the text of request line 453 verbatim, its "if not met" line; `9A/H-04` last paragraph; open point J; frame open point 12 and section 9.4 item 7; host profile open point 9 | `host-checks.ts:216-224` (one question, `RULE_UNIT_NOT_ACTIVE`); `test/hc2_nft_listing_unprivileged.md` named; `RULE_TABLE_*` words are not in the source (grep: 0) |
| 4 | `9A/H-16`: the two commands and the new refusals | Chapter 2 `9A/H-16` precondition (both commands by name; the three reserved ids) and expected `.2`: `CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH`, `CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS`, `CAPTURE_HOST_FACTS_NOT_HANDED_IN`, `CAPTURE_HOST_PLATFORM_NOT_SUPPORTED`, `CAPTURE_HOST_ALIAS_SOCKET_PATH`, `TRANSCRIBER_CONFIG_UNRESOLVABLE` with its four neighbours; the three members of `SYSTEM_BOOT`; frame `PREP-10` step 2 | `checks.ts:129-212, 423-430, 452-453, 641-666`; `transcription/boot.ts:36-44`; `apps/core-server/package.json:24, 27`; `cli/production-key-command.ts:48-49, 124` |
| 5 | Chapter 3 | `9A/H-10`: precondition (C70, `409 CANDIDATE_NOT_TESTABLE`), the reply caps as a known limit (16 / 64 / 128 KiB, 1 MiB total; a refusal by size is a finding), new step `.7` and criterion 7 (two networks: source address, 0 packets on the office interface); `9A/H-17.5a`; `9A/H-11` observation of three cases; `9A/H-13` (`deviceCount`, one factory-address camera at a time); `9A/H-15` rewritten (section 8, decision 1); `9A/H-14` (`scannedMac`, `CAMERA_SCAN_TOO_OLD`, `CAMERA_HARDWARE_ADDRESS_NOT_BOUND`, `MAC_MISMATCH`, two audit entries per job). Chapter 2 `9A/H-07`, `9A/H-08`: `-ch_layout`, serial else port, the limit of C56, `/usr/bin/arecord`, the attended-session folder (C86), the worker restart (row 191 built) | `onvif-reply-guard.ts:100-110`; `onvif-network.ts:76`; `packages/shared/src/api/capture-commissioning.ts:154, 215-234, 296-312`; `camera-network/service.ts:636-662, 892-896`; `adopted-test-route.ts:32`; `mic-helper-args.ts:210-222, 342, 388, 390`; `usb-audio-production.ts:14-40, 284-360`; `audio-cards/service.ts:40-50`; `core/audit-details.ts` (`CAMERA_NETWORK_SET`) |
| 6 | The acceptance record's step list | Frame section 9.1, a new paragraph: the contract's closed list of the 27 checks, list version 1; `PREP-nn` and `HI-nn` are the installer's own record | `packages/shared/src/api/installation-acceptance.ts:105-135`; the shared test that reads the frame passes (section 6) |
| 7 | Production on Linux and on the Mac | Frame section 1, a new row "Which hosts may run a production Core" (the items a Mac does not ask; the three places that say so; `hostProfileNotAsked`; notice `HOST_PROFILE_NOT_ASKED`), section 11 item 8 (A9, B8); chapter 3 `9A/H-17.10` (no member on Linux); host profile header | `checks.ts:652-661`; `core/audit-details.ts` (`SYSTEM_BOOT_HOST_PROFILE_STATES`); `packages/shared/src/evidence-package/manifest.ts:416-434`; `evidence-verify/types.ts:417` |

Statements of row 181 that had gone stale and were corrected while the items above were written, each read from the source: "the commissioning functions are not in the tree" (chapter 2 `9A/H-05.6`, `9A/H-06`; chapter 3 `9A/H-13`, `9A/H-14`, `9A/H-15`, open point A); "the hand-over of the host facts is not built" (`src/index.ts:120-123`); "the Core reads the relay's line `push_established` only" (`relay-start.ts:174-186` reads `camera_lost` and `camera_reopened` too); the security review "does not exist" (`verification/119b_helper_statement.md`); the closing reasons of an alias row (seven values now, `core/audit-details.ts`).

## 3. Host profile

| Item of the brief | Where | Source |
|---|---|---|
| Parents of the data directory not writable by others (C54 (4)) | `HOST-06` item, command and check | decision C54 (4); frame `PREP-10` step 1 |
| Path of `arecord`, key `DEMS_CAPTURE_AUDIO_HELPER` (C63) | `HOST-26`, `HOST-16`, `HOST-34` | `mic-helper-args.ts:342`; `config.ts:39-41, 75` |
| Key `DEMS_CAPTURE_ALIAS_SOCKET` (C63, C53 (4c)) | `HOST-34` | `config.ts:36-38, 74`; `checks.ts:662-666` |
| `ping` with its path and its right to send from inside the unit; the path of `ip` (C90) | new section 3.11 (bullets, no new item) and `HOST-18` | `mic-helper-args.ts:362-392`; request line 420 |
| The mode of `/etc/dems` (C85) | `HOST-34`, `HOST-46` | request line 405; chapter 4 `HI-03.3` |
| `HOST-18`: the package for arping | `HOST-18` (package, path, the package manager's two records, Python 3.9) | request line 441; helper lines 96-103, 257-280 |
| Also: what a Mac does not check; the helper optional, all or none; open point 9 settled | header; section 3.8; section 5 | request lines 436, 450, 453 |

No `HOST-nn` row was added: the profile's script test pins 49 + 7 items and the form of each row's last cell.

## 4. Collectors

Seventeen collectors and the two test scripts were changed. Every name now searched for was found in the source; every name removed was searched for and not found. Each changed collector carries a comment block "NAMES (wave 12, row C1 ...)" that says what was removed and why.

| Collector | Removed (the product never emitted it) | Searched for now |
|---|---|---|
| `collect-h05.sh` | the word `ALIAS_HELPER` | codes beginning `CAPTURE_HOST_ALIAS_` and `CAPTURE_HOST_INTERFACE_FILE_`, with `code` and `reason` |
| `collect-h06.sh` | members `reasonCode`, `code`, `phase` | `HOST_ALIAS_REQUESTED`, `HOST_ALIAS_ADDED`, `HOST_ALIAS_ADD_FAILED`, `HOST_ALIAS_REMOVED`, `HOST_ALIAS_REMOVE_FAILED`; `removeReason`, `failureReason`, `reason`, `action` |
| `collect-h08.sh` | `-channels`, `-ac`, `-ar`, `-filter:a`, `-map_channel`; `MIC_OPEN_FAILED`, `AUDIO_DEVICE_BUSY`, `MIC_HELPER_EXITED`, `MIC_NOT_CONNECTED`, `MIC_NOT_DELIVERING`; fields `sample_rate`, `rate` | `-ch_layout`; seven `AUDIO_*` codes of the adapter; `MIC_INPUT_OPEN_FAILED`; `master_mic` |
| `collect-h09.sh` | lines `anchored`, `keyframe_interval`; fields `offset_us`, `interval_ms`, `frames`, `clockOffsetMs` | `video_anchored`, `keyframe_interval_observed`, five counters, `CAPTURE_CLOCK_OFFSET_MEASURED`, `CAPTURE_CAMERA_CLOCK_OFFSET` |
| `collect-h10.sh`, `collect-h23.sh` | `CAMERA_CONNECTION_TESTED`, `CAMERA_PROFILE_LISTED` and its members, `CAMERA_CREDENTIAL_REFUSED`, `STREAM_AUTHENTICATION_FAILED`; fields `reason`, `durationMs`, `profiles`, `codec` | `CAPTURE_CONNECTION_TESTED` with `outcome`, `authenticated`, `testReason`, `judgedStreams`; the five outcome words; `SCHEME_NOT_ALLOWED`; the four audit types |
| `collect-h11.sh`, `collect-h19.sh` | `CAPTURE_FAULT_CLEARED`, `RELAY_CONNECT_ATTEMPT`, `RELAY_GAVE_UP`, `MIC_NOT_DELIVERING`; fields `time`, `deviceId`, `state` of the fault line | the fault line with `sessionId`, `reason`; `CAPTURE_SUPERVISOR_FAULT_OVER`, `CAPTURE_WORKER_DOWN`, `MIC_RATE_AT_LIMIT`; the exact type `CAPTURE_CREDENTIAL_REVEALED` |
| `collect-h12.sh` | `DISCOVERY_ADDRESS_NOT_PRIVATE`, `ADDRESS_NOT_PRIVATE`; fields `scope`, `candidates`, `reason` | `trigger`, `outcome`, `responderCount`, `newCount`, `registeredCount`, `interfaceCount`, `failureReason`; `PUBLIC_ADDRESS` |
| `collect-h16.sh` | - | six new refusals, the two "checks passed" codes, `CAPTURE_HOST_ALIAS_HELPER_ABSENT`, `CAPTURE_HOST_LOOPBACK_RULE_MISSING`; criterion 6 quoted as rewritten |
| `collect-h17.sh`, `collect-h26.sh` | `SESSION_SEALED`, `SESSION_SOURCE_OPENED`, the bare word `UNSEALABLE`; fields `configured`, `recorded`, `profileCode`, `streamStatement` | `SEALING_COMPLETE`, `SEALING_SESSION_UNSEALABLE`, `CAPTURE_CAMERA_INGEST_PAIRED` |
| `collect-h21.sh`, `collect-h22.sh` | - | `CAPTURE_CAMERA_INGEST_PAIRED` (`time`, `deviceId`, `attempt`); `CAMERA_NO_PICTURE`, `CAMERA_INGEST_NOT_PAIRED` |
| `collect-h14.sh`, `collect-h15.sh`, `collect-h25.sh` | - | the quoted criterion follows the chapter; a note on what the USER reads |

Test scripts: the planted log and audit lines were given the product's shapes (the helper row with `-ch_layout 2C`, the alias entries with intent and result, the search and test lines, the fault and offset lines, the canned hash `1e758a24aaaa`), and the expectations that read them were reworded. The number of checks is unchanged in both scripts. One expectation changed its sense: `c10` no longer expects a profile line to be printed; it now expects that a planted profile line with a token is NOT read (red on the collector of before this row, which printed `profileCode=`).

Not changed, and why: `collect-h01`, `-h02`, `-h03`, `-h04`, `-h07`, `-h13`, `-h18`, `-h24`, `-h27` search for names that exist as written (record 181, last paragraph of its section 7, re-read against the source for `-h03`, `-h07`, `-h13`); `collect-h04` and `-h24` read no code.

## 5. What stays unproven, and where it is marked

Marks "to confirm" in the four chapters after this row: 43. Of them 39 name a check or a step of the run on the host (frame 4, chapter 2: 12, chapter 3: 11, chapter 4: 12); 4 name blueprint rows 104 and 106 (the removal timer of the helper, chapter 4), which no host can settle. Before this row: 31, of which 17 named a check and 14 a row. Ten of the 14 row-marks were closed or turned into host marks because their rows have landed; the new marks are for what was built since on doubles only (the commissioning screens, the helper's reading of the real `arping` and `ip`, the package manager's records, the two-network readings, the reply caps on a real camera, the transcriber configuration at a first boot, the serial path of a real card). The host profile keeps its 43 marked items and gains 2 marks in section 3.11 (`9A/H-13`, `9A/H-14`).

## 6. Checks run (on this Mac, against doubles; one run each unless said)

| Check | Command | Result |
|---|---|---|
| Helper hash | `shasum -a 256 scripts/host/netalias/dems-core-netalias`; `shasum -a 256 -c SHA256SUMS` | `1e758a24...c7d015b1`; 3 of 3 `OK` |
| Collectors, host group | `bash scripts/hardware-acceptance/test_hw_collectors_host.sh` | `RESULT: 637 passed, 0 failed` |
| Collectors, camera group | `bash scripts/hardware-acceptance/test_hw_collectors_camera.sh` | `RESULT: 535 passed, 0 failed`; run a second time after one last chapter sentence was added (`9A/H-17.10`), because the group hashes the chapter folder: `RESULT: 535 passed, 0 failed` |
| Host profile scripts | `bash scripts/host/test_host_profile_scripts.sh` | `RESULT: 171 passed, 0 failed` |
| The shared test that reads the frame | `npx vitest run --root packages/shared test/api-installation-acceptance.test.ts --maxWorkers=2` | 1 file, 21 tests passed |
| Syntax | `bash -n` on every `collect-h*.sh` and `test_hw_*.sh` | 0 errors |
| Non-ASCII characters in the five documents | `LC_ALL=C grep -c` | 0 in each |

`shellcheck` is not installed on this Mac: not run (both test scripts say so). No full suite was run. No typecheck applies: no workspace source was touched.

## 7. Where a source contradicts a decision or an earlier record

| # | Source | Against | What this row did |
|---|---|---|---|
| 1 | The helper: a `del` does not need the conflict tool (`delete` calls `installation(need_conflict_tool=False)`; its own test `test_del_needs_no_conflict_tool`) | Chapter 2 `9A/H-25.6` and chapter 4 section 4 (row 181): "the `del` request is answered `37`" | Corrected: the request of step `.6` is an `add`, which is refused 37 before any tool starts |
| 2 | `packages/shared/src/api/capture-commissioning.ts:222-224`: the scan answers `NOT_KNOWN` "today always"; `MORE_THAN_ONE` is never made by the scan's own probe | Check `9A/H-15` as titled and its first criterion "conflict reported: 1 of 1"; decision C105 (1) lists three states without saying one is the only one reached | `9A/H-15` rewritten as a stated limit (section 8, decision 1) |
| 3 | `config.ts:36-38`: with `DEMS_CAPTURE_ALIAS_SOCKET` unset the helper is "not configured" for the commissioning functions | Request line 450 (row HC) and decision C102 (2) say only "unset passes" the boot; no chapter told the installer to set the key | `9A/H-16.1`, `9A/H-05.7`, `HI-08.1`, `HOST-34`: unset at the first boot, set to the installed path once the helper is installed |
| 4 | `core/audit-details.ts`: `deviceCount` is a member of `CAMERA_NETWORK_SET`, not of `CAMERA_FACTORY_SCANNED` (which holds counts only) | Decision C94 (a) R119-03 "the scan states ... truthfully" reads as if the scan's audit entry said it | Chapter 3 and `collect-h15.sh` say where the word is: on the screen, and in the job's entry |
| 5 | `cli/production-key-command.ts:48-49, 124`: the key command refuses a reserved id at the prompt (`INSTALLATION_ID_RESERVED`) | Decision C86, last sentence: "the key commands still ACCEPT a reserved id at the prompt" (it was true on its date; pass K6 has landed since) | Frame `PREP-10` step 2 states the built behaviour |
| 6 | `packages/shared/src/sim/vocabulary.ts`: no type `CAPTURE_CREDENTIAL_REVEAL_FAILED` (grep: 0) | Record 181, section 7: "the substring also matches `CAPTURE_CREDENTIAL_REVEAL_FAILED`" | The collectors search the exact type `CAPTURE_CREDENTIAL_REVEALED`; the other type is named nowhere |
| 7 | `host-checks.ts`: 13 codes | Request line 450 (3): "the questions of the profile are 10 (the loopback rule is asked twice)" could not be confirmed from the source | Not written into a chapter; the chapters say "the codes are 13, as before" |
| 8 | `implementation/104_alias_helper.md:34` prints the old hash | Decision C101, condition C-3 names "record 104" beside the chapter | Not this row's file; left; reported |

## 8. Driver decisions, for the controller to confirm

1. **`9A/H-15` rewritten.** Its first pass criterion could not be met by the product as built (section 7, row 2). Chapter 1, section 10, item 5 forbids editing a check to fit what was seen; here nothing was seen, the product was changed by ruling (C94 (a), C105 (1)), so the criterion was re-issued: the scan row must not state `ONE`, no job is started, no camera changes, and "conflict reported: yes or no" is recorded with `NOT_KNOWN` as a stated limit. The title is kept because the recording sheet and the contract's list name it. The conservative alternative, leaving the check as an expected `FAIL`, was rejected because it would fail every run for a ruled behaviour.
2. **The order: the group early, the installation at sequence 12.** C94 (j) asked for the natural order; unit file G names the group `dems-netalias`, and a unit that names a missing group does not start. So `HI-04` part A stays at sequence 8a and `HI-01` to `HI-07` run as a whole at sequence 12. The source judges "partial" on five things (socket node, helper file, socket directory, two unit files); the group and the interface file are not among them (`program-checks.ts:33-49`). Installing everything at 8a stays allowed.
3. **Two-network readings by `tcpdump`, headers only, by the USER.** The chapter's rule is that no collector captures packets. Request line 319 asks for a capture. It is written as a USER step that prints a count and writes no file; `tcpdump` is no item of the host profile (marked "to confirm").
4. **A `systemd-run` line in host profile section 3.11** to try `ping` under the unit's two settings. It was written from the request's words and run nowhere; it is marked.
5. **Revision numbering.** The note is "Revision 4" in all four chapters (Revision 3 exists in the frame only), and "Revision of 2026-10-14" in the host profile, which had no revision notes.
6. **A second run of the camera group** after a last chapter sentence (section 6).

## 9. Requests left

None written into `delegation_progress/file_requests.md`. For agent C2 and the controller, by name: the installer's note should say that `DEMS_CAPTURE_ALIAS_SOCKET` is set once the helper is installed (section 7, row 3), and record 104 still prints the old hash (row 8).

---
*Generated: 2026-10-14 09:20 (host clock)*
