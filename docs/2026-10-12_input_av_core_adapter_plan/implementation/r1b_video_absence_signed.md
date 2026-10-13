---
task_id: 2026-10-12_input_av_core_adapter_plan
row: R1b (decision C99; the request of row R1, finding F3-01 of verification/060_m3_review.md)
date: 2026-10-13
agent: coder-execution (agent R1b, track D)
tier: T3
builds_on: implementation/r1_relay_report_reader.md; 191b_audio_gap_in_evidence.md; 191c_signed_audio_gap.md; v4_fourth_contract_step.md (item 6); 043_relay_reconnect_gating.md; decisions C73, C83 (D-5), C97, C99
status: needs-review - the contract, the writer, the seal's member, the verifier's line and the byte identity are built and green; the sealed scenario passed, but its relay words came from the test file, not from the built relay (section 6, the one remainder); six driver decisions to confirm (section 9)
---

# Row R1b: a camera's absence inside a session, under the signature

Paths are relative to `/Users/gsp-budi/Documents/DEMS`; `SH` = `packages/shared`, `CS` = `apps/core-server/src`. No real camera, no microphone, no credential; loopback only; no schema change (pins stay `[13,'dbc-14']`); nothing under `apps/capture-worker` built or edited.

## 1. Result

| Point of the row | Before | After |
|---|---|---|
| (1) contract | no audit type and no manifest member for a video absence | audit type **`CAPTURE_VIDEO_ABSENT_IN_SESSION`** (DEVICE, 82 -> 83) and the OPTIONAL signed member **`tracks[].absentInSession[]`** (fields 134-138); the verifier accepts it (V-01 is the schema) and SAYS it: notice **`VIDEO_ABSENT_IN_SESSION`**, one line |
| (2) the writer | error-log entries only (row R1) | ONE audit entry per absence, written WHEN IT ENDS: `RE_OPENED` at the relay's re-open, `NOT_RE_OPENED` at the end of the capture; an absence of a superseded attempt writes nothing |
| (3) the seal | nothing | the member, from the audit rows the seal's reader already reads (`READ_SEAL_AUDIT_ROWS`: no new statement); a malformed entry stops the seal |
| (4) the timeline | `tracks[].durationMs` spanned a step nobody accounted for | stated below, section 5 |
| a session WITHOUT a loss | - | manifest and signature BYTE-IDENTICAL to the tree's output of before (section 4) |

## 2. The contract (verbatim names)

**Audit type `CAPTURE_VIDEO_ABSENT_IN_SESSION`**, category `DEVICE` (as `CAPTURE_AUDIO_ABSENT_ON_RESTART`, `MIC_SILENT`, `CAPTURE_DEVICE_UNREACHABLE`), severity WARNING, actor null, the row's device = the camera. Label `common.auditType`: "Video not recorded while a camera was absent". Closed details (`CS/core/audit-details.ts`):

| Key | Required | Form |
|---|---|---|
| `sessionId` | yes | a session ID |
| `deviceId` | yes | a registered camera id (`CAM-NN`) |
| `trackId` | yes | `VIDEO-01` / `VIDEO-02` |
| `attempt` | yes | the capture attempt the relay fed (1 or more) |
| `loss` | yes | the relay's own number of the loss (1 to 999,999,999) |
| `tries` | no | the relay's tries of the re-open; only for `RE_OPENED` |
| `videoAbsentAtLeastMs` | no | 0 to 86,400,000 |
| `videoAbsentAtMostMs` | no | 0 to 86,400,000 |
| `ended` | yes | `RE_OPENED` / `NOT_RE_OPENED` |

No address, no stream profile, no cause text, no file name, no `operationId` / `permission`.

**Manifest member `tracks[].absentInSession`** (`SH/src/evidence-package/manifest.ts`): optional; when present an array of at least one strict record `{ attempt >= 1, loss >= 1, absentAtLeastMs: 0..86400000 | null, absentAtMostMs: 0..86400000 | null, ended: 'RE_OPENED' | 'NOT_RE_OPENED' }`. Rules: the least not above the most; records in order (a later attempt, or a higher loss of the same attempt); only the LAST record of a track may be `NOT_RE_OPENED`; an empty list is refused ("none" has one form and one digest); the builder drops `undefined`. Fields 134-138 in `MANIFEST_V2_OPTIONAL_FIELDS`; `MANIFEST_V2_FIELDS` stays 128 / 119.

**Verifier.** `VERIFY_NOTICE.VIDEO_ABSENT_IN_SESSION` with `videoAbsentInSessionReport` (`SH/src/evidence-verify/types.ts`): ONE line per package, per track the count and the sums of both bounds ("not measured" when one record leaves a bound out), "not re-opened" when the last absence did not end; at most 256 characters. It fails nothing. The receiver's result carries `videoAbsentInSession` (only from a sealed manifest it relied on, X-05) and `receiver-cli.ts` prints the same line before the verdict.

## 3. How the two bounds are taken (`CS/capture-session/index.ts`)

Neither clock sees the last picture: the relay's word of a loss comes AFTER the last forwarded picture (at once for a closed connection, up to 5 s later for a stall: `RELAY_IO_BOUND_US`), and the Core's clock starts only when that word arrives.

| | `RE_OPENED` (`cameraLegSaid`) | `NOT_RE_OPENED` (`release`) |
|---|---|---|
| at least | the RELAY's own `gap_ms`: its monotonic clock from the instant it called the camera lost to the first keyframe of the new leg. The last picture came before that instant, so the absence cannot be shorter. The Core's own span is NOT used as a least: both of its instants are arrivals | the CORE's clock from the relay's word of the loss to the FIRST instant the end of the capture was asked (`Live.leftAt`, set in `leave`); left out when no end was asked first (a shutdown) |
| at most | the CORE's span (word of the loss to word of the re-open), never below the relay's measure, PLUS `RELAY_PLAYING_SILENCE_BOUND_MS` = 5,000 | the CORE's span to the instant the capture had ended (the worker is stopped before `release` in every caller), never below the least, PLUS 5,000 |

`RELAY_PLAYING_SILENCE_BOUND_MS` is held equal to the relay's header by a source pin (`ingest-pairing.test.ts`). A bound outside 0 to one day is left out; the most is never stated below the least. Checked against row 43's measurement on the built relay: step in the file 3.05 to 3.28 s for `gap_ms` 3,001 to 3,040 - inside `[gap, gap + 5,000]`.

**Written how.** `recordVideoAbsence`: one engine unit `captureSession.videoAbsentInSession` with `scope.unit.audit.append` (the pattern of `recordAudioGap`); the audit writer holds the entry to the closed list. Entries are chained (`Live.absenceWrites`) and `release` AWAITS the chain before any caller tells STOPPED / INTERRUPTED, so the seal reads every entry. A failed unit is run once more, then `CAPTURE_VIDEO_ABSENCE_NOT_AUDITED` (error, persistent log): the manifest then states one absence fewer, and the log says so.

**A superseded attempt writes nothing.** `cameraOpenAgain` (an absence of an earlier attempt ended by the later worker's pairing) writes no entry; `release` writes only for `open.attempt === attemptInForceAtEnd(of)`. One case remains by design: an absence that ENDED inside attempt 1 has its entry (true when written); if the worker is replaced afterwards, the SEAL leaves it out (`videoAbsencesOf` states only the highest attempt the stored entries name - these and the restart entries' `laterAttempt`), and it stays in the unsigned extract.

## 4. THE BYTE-IDENTITY PROOF (a session without a camera loss)

Instrument `.cache/task4-rowr1b/identity.test.ts` (row P1's, relabelled; in no commit): the PRODUCT pipeline seals the fixture session of `sealing/__tests__/pipeline-support.ts`; `randomBytes` and the Ed25519 pair are a function of their call order. Twice BEFORE any edit, once AFTER the last:

```
fixture "switch"        session-manifest.json 10582 bytes
  before / before2 / after  94f26937c667bbf87942f83125196430ff38c621d62986a8b31e94619b823333
  signature file            e720f9b6aaebf8fab7316f76d4496c2efef408b7dec231d6600839f1da83b017  (all three)
fixture "one-interval"  session-manifest.json 10444 bytes
  before / before2 / after  e4de4742c9a796c5db68d1297b665151e1cc79080aa2c6f1227699e115b3e7bc
  signature file            16bbc8ee4803f7fde67e8fdebc44c4901aa44963478a32489789de6bc1a91d78  (all three)
cmp before.*.manifest.json after.*.manifest.json : identical, both fixtures
cmp before.*.signature     after.*.signature     : identical, both fixtures
```

SEAL of each of the six fixture seals: `SEALED`. In the committed suites beside it: the shared builder (absent = `undefined` = the example's bytes and digest), and `pipeline.test.ts` (absent = `undefined` = empty lists on both tracks give equal bytes that do not name the member; one absence changes them by exactly its own text).

## 5. Point (4): what the durations state

- **`tracks[].durationMs`** is the end of the track's media in FILE time. The relay places the first picture after a loss as far after the last one as its clock counted (`relay.c`, `placed_by_clock`; row 43: "one step inside the track"). So for an absence that ENDED the track's duration SPANS the absence: it counts time in which no picture exists. For an absence that did NOT end, the pictures stop at the loss and the track is shorter than the session by about the stated time.
- **`timeline.recordingDurationMs`** is the session's (start to stop on the Core clock). An absence changes neither number.
- **Before this row** the two could agree while a track held seconds without a picture, and nothing signed said so. **Now** each such track carries `absentInSession`: the reader of the signed manifest sees how often, the least and the most in ms, and whether the camera came back; the verifier says it. The contradiction is no longer silent.
- **Not stated: WHERE.** The member holds no position on the timeline; the step is in the file's own sample times and the instants of the unsigned audit rows (driver decision 4).
- Seen in the scenario and NOT this row's: on generated cameras `durationMs` (10,680 / 10,677) is above `recordingDurationMs` (10,192) without any loss in the file - the camera helpers deliver before the session's start instant.

## 6. THE SCRIPTED SCENARIO, sealed - and its one remainder

`.cache/task4-rowr1b/absence.db.test.ts` (rows 184 / 191's instrument; `sh .cache/task4-rowr1b/run.sh <name>`, the database lock FIRST, then the heavy-host lock, one hold). REAL: one Core on a throw-away database, the BUILT worker (listeners 127.0.0.1:8559 / 8561), the generated sources, the capture session (the writer), the engine, the audit writer, the sealing host and its reader, the seal, operation 41, the export route, the receiver's verify.

**THE STAND-IN THAT MATTERS.** Row R1's scenario runs NO session, and no composition puts the production camera adapter (and the built relay) into a session before row 88. So the relay's words reached the session from the test file through the product's source interface (`relayReports`; the session unit's port `operationOf` answering REAL_PRODUCTION, the session suite's own seam), with ROW R1's MEASURED NUMBERS (loss 1, `CAMERA_LOST`, tries 1, held back 25, a gap of about 3,048 ms let pass in real time). The generated cameras kept delivering: the files of this run hold no step. The built relay with the test camera's `--drop` is proven in row R1's own scenario; the two halves are not joined in one run. Request line 1.

| Run | Result | Seal |
|---|---|---|
| `s1` | failed before any session: MY case-number literal was refused (422) | none started |
| **`s2`** | `Tests 1 passed (1)`, `0 remain` | **SEALED 1 of 1**: six steps `DONE` at attempt 1, `SEALING_COMPLETE`, no `WRITE_FAILED`, no retry |

| Fact (run `s2`) | Value |
|---|---|
| stored entry 1 | CAM-01, `VIDEO-01`, attempt 1, loss 1, tries 1, `videoAbsentAtLeastMs` 3050, `videoAbsentAtMostMs` 8050, `RE_OPENED` |
| stored entry 2 | CAM-02, `VIDEO-02`, attempt 1, loss 1, `videoAbsentAtLeastMs` 1513, `videoAbsentAtMostMs` 6574, `NOT_RE_OPENED` (stop asked 1,502 ms after the loss) |
| SIGNED `tracks[0].absentInSession` | `[{ attempt 1, loss 1, absentAtLeastMs 3050, absentAtMostMs 8050, ended RE_OPENED }]` |
| SIGNED `tracks[1].absentInSession` | `[{ attempt 1, loss 1, absentAtLeastMs 1513, absentAtMostMs 6574, ended NOT_RE_OPENED }]` |
| extract rows of the type | equal to the stored details |
| the Core's verify (operation 41) | `ok` true, `PASS`, 15 checks, none not passing; notice: "Video: CAMERA ABSENT INSIDE THE SESSION. VIDEO-01 1 time, at least 3050 ms, at most 8050 ms; VIDEO-02 1 time, at least 1513 ms, at most 6574 ms, not re-opened. No picture was recorded in that time." |
| export (PACKAGE, by the route) | `COMPLETE` |
| receiver's verify of the unpacked archive | `ok` true, 7 checks, none failing; received manifest = sealed, byte for byte; `videoAbsentInSession` for both tracks |

An operator-stopped session; the INTERRUPTED path of row 184 was not run and no `WRITE_FAILED` was seen. The session stayed RECORDING through both absences (no fault raised by this unit; the camera watch is not attached in this instrument).

## 7. Checks

`--maxWorkers=2`; loopback, database and process runs with the command sandbox off.

| Check | Result line |
|---|---|
| shared, whole workspace (after the one `openapi:gen`) | `Test Files 105 passed (105)`, `Tests 2891 passed (2891)` - the OpenAPI byte comparison is GREEN. Run 1 of seven files: `3 failed, 354 passed` - three position / list pins, moved by their delta |
| Core unit: sealing, sealing-host, evidence-verify, evidence-export, core, capture-session, db/fixtures, `test/static`, `capture/__tests__/static` (after the last edit) | `Test Files 79 passed (79)`, `Tests 1478 passed (1478)` |
| the same with engine, transcription, installation-acceptance | `1 failed, 1855 passed (1856)`: `engine/__tests__/boot-checks-runner.test.ts:81`, NOT mine (request line 6) |
| Core database: session suite, sealing, sealing-host, evidence-export, evidence-verify, db/fixtures | `Test Files 9 passed, 2 skipped (11)`, `Tests 155 passed, 3 skipped (158)`, `0 remain` |
| byte identity (section 4) | 3 runs, `Tests 1 passed (1)` each; `cmp` identical |
| scenario `s2` (section 6) | `Tests 1 passed (1)`, `0 remain` |
| `npx tsc --noEmit`: shared, core-server, core-web, mobile, mock-core, transcriber | 0 errors in each |
| `oxlint` of the touched folders | 0 in my files (one warning in `receiver-cli.test.ts:167`, not mine) |

Runs repeated after a failure: the first writer / fixture run showed the count pins (expected), one of MY new assertions (`password` is a forbidden key, not a foreign one) and one static pin my own log sentence met (`ingest-address.test.ts:226`, the word "plan": sentence reworded).

New cases, each in the file of its subject: `SH/test/evidence-package.test.ts` +4; `CS/core/__tests__/writers.test.ts` +1; `capture-session/__tests__/ingest-pairing.test.ts` +1 (source pin); `session-capture.db.test.ts`: row R1's two cases EXTENDED (the entry at the re-open; the entry at the end; a superseded attempt writes nothing); `sealing/__tests__/pipeline.test.ts` +3; `sealing-host/__tests__/sealing-host.test.ts` +4; `evidence-export/__tests__/export-one-camera.test.ts` +1.

## 8. Counts and pins

Counts after: **110 operations (unchanged), 83 audit types (+1), 51 actions (unchanged); 39 server-listed types (+1); 6 verify notices (+1); 10 optional manifest fields (+5).**

| File | Pin | Delta |
|---|---|---|
| `SH/test/i18n-vocabulary-sync.test.ts` | type count; five positions | 82 -> 83; each -1 |
| `SH/test/api-registry.test.ts`, `api-domain-operations.test.ts`, `api-capture-discovery.test.ts` | type count | 82 -> 83 |
| `SH/test/evidence-verify.test.ts` | notice list | +1 name |
| `SH/test/evidence-package.test.ts` | optional field list | +5 rows |
| `CS/core/__tests__/writers.test.ts` | type count; listed types; three positions; key lists | 82 -> 83; 38 -> 39; each -1; +1 entry each |
| `CS/db/fixtures/__tests__/audit-details.test.ts` | table lengths (2); allow-list count; one list | 82 -> 83; 38 -> 39; +1 name |

`openapi.json` regenerated ONCE by `npm run openapi:gen` (the repository's generator; the one generated file).

## 9. DRIVER DECISIONS for the controller

1. **The verifier's line follows `HOST_PROFILE_NOT_ASKED`, because the audio gap has NONE** - the brief's "the way it states the audio gap" names something that does not exist. A notice code and a report function were added for video only; the audio twin is request line 3.
2. **The least of a re-opened absence is the relay's number alone; the most adds the relay's 5 s silence bound.** A second constant of the relay now lives in the session (pinned to `relay.h` by a test).
3. **The member lives on the track facts** (`SealTrackFacts.absentInSession`, which the shared type already allows) - no new member of `SealSessionFacts`; the pipeline copies each record to its five keys.
4. **No position on the timeline is signed** - the closed detail list of the brief holds none, and the Core has no sound mapping from its clock to the track's time.
5. **An absence of a track the package does not seal is stated nowhere in the manifest; an entry of an EARLIER attempt than the last is left out by the seal** (not "malformed": it stays in the extract). An entry that names another device than the track's start record STOPS the seal.
6. **Outside the first claims line:** `CS/db/fixtures/operations.ts` (one fixture row; the bulk fixture must write every type) and `CS/evidence-export/receiver-verify.ts` / `receiver-cli.ts` (the receiver's line).

Also done on the controller's word during the row: operation 109 lists `INSTALLATION_CLOCK_BEHIND_RECORD` (same member, sentence, status; description, 409 text, example `clockBehind`; one test). W4's three shared requests were NOT taken: the change set was closed when they arrived.

## 10. Not built, not proven

| What | Where it goes |
|---|---|
| The built relay inside a SEALED session; the step on a sealed track against the two bounds | request line 1 (row 88) |
| The warning reason for an absence that can end; the facts-file member (row R1's request) | request line 6; not in this row's four points |
| A stall (detection up to 5 s after the last picture), a real camera | `9A/H-10` to `H-12`, `H-21` to `H-23` |
| An INTERRUPTED session with an open absence; the audit unit failing twice | unit path built as `recordAudioGap`'s; not driven |
| A receiver's verifier older than this member | refuses a package that carries it (the rule of V4); README text, request line 2 |
| Linux | everything |

## 11. Rules kept

Edit tool only for every existing file; new files with Write (this record, `row_r1b.md`, `.cache/task4-rowr1b/absence.db.test.ts`) or created as new scratch files from row P1's / row 191's instruments (`identity.test.ts`, the two configs, `run.sh`). Nothing committed, staged or reverted; no full suite across workspaces (the shared workspace's own suite once, as the openapi check asks). `db-migrate.lock` before `heavy-host.lock`; the heavy-host lock held for the two scenario runs only. Worker listeners 127.0.0.1:8559 / 8561; NO test camera was started (no port of 8565-8574 used); ports 4423 / 5178 not touched; throw-away databases only (`0 remain`); no `.env` read. Sandbox off for: the generator (`tsx` binds a local pipe), the database and scenario runs.

---
*Generated: 2026-10-13*
