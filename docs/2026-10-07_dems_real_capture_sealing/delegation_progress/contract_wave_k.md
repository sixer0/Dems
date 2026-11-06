# Contract of fix wave K — what producers give, by name (append-only; one section per driver)

## S2 (written 2026-10-11 00:35 WIB, BEFORE the code is finished — names are final, a status line below says when they are live)

All members are ADDITIVE and OPTIONAL; totals stay 97 / 36 / 61 / 67, schema 6. Examples are exported from `@dems/shared/api`; a consumer test imports the example and reads the member BY NAME.

### 1. Transcript model on the ITEM (G81b-06) — for W and M2
It was NOT on the item (only op 41 answered it). New member:

- `EvidenceItem.transcriptModel?: { name: string; version: string | null; quantisation: string | null; modelSha256: string | null; reportedByServer: boolean; report: string }`
  - the SAME name and shape as `transcriptModel` of op 41's result (one client type serves both).
  - on op 40 `evidence.transcriptModel` and on the items of slice `evidence` (op 39 list rows too), for an item whose sealed package lies in this Core's store and whose SIGNED manifest declares a transcript document.
  - ABSENT: v1 / demonstration items without a package here, an item sealed with STT disabled or without a document, a package that cannot be read (`sealedPackage: NOT_READABLE`), a manifest whose signature did not hold. Absent = "not stated": draw nothing, never a default.
  - server backend (D160): `reportedByServer: true`, `name` set, `version` / `quantisation` / `modelSha256` all `null`. The sentence to show is `report` (the Core's own line, e.g. "... reported by the STT server and not verified by the Core").
  - local backend: all four set, `version` is the version the installation DECLARED (PE-D9-01), `reportedByServer: false`.
- Examples: `EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE` (local backend) and `EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE` (server backend), both `@dems/shared/api`.
- NOT added (no client asked by name; say so in file_requests.md if wanted): chunk count and language on the item. The language is in op 84 `language`.

### 2. Default export destination (G94b-11 / -12) — for W and M2
- `EvidenceDetail.exportDestinationDefault?: string` (op 40, top level beside `access` / `exports`; Core server only).
  - It is THE text the Core records when an export request names no destination. Real-capture Core: `Case file transfer`. Simulated Core: `Case file transfer (simulated)`.
  - Client rule: pre-select the destination option whose RECORDED text equals this member (web and mobile then agree: the case-file option); absent (Simulated mode inside the app, an older Core) = the client's first option. Never pre-select another option when the member is present.
- Example: `EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE` (`@dems/shared/api`), also inside the `getEvidence.productSealed` example.
- Constants (`@dems/shared/sim`): `DEFAULT_EXPORT_DESTINATION` (simulated, unchanged) and NEW `DEFAULT_EXPORT_DESTINATION_REAL`.

### 3. "The export is stored on the Core" on a SIMULATED item (G94b-06) — for W and M2
- The sentence is CLIENT-DRAWN: `evidence.exportJob.onCore` of the shared i18n tree (`packages/shared/src/i18n/en/evidence.ts:588`); no server text holds it.
- Server fact added so that no client infers: `EvidenceExportAccepted.archiveOnCore?: boolean` (answer of op 42).
  - `true`: an export JOB of this Core writes an archive into the Core's store (follow op 87; `onCore` is true once the job is DONE).
  - `false`: the request was only recorded — a demonstration item, NO archive is written. Do not draw `onCore`; say "Demonstration: no archive is written." (client resource; the web already says "No archive exists for this item.").
  - absent (Simulated mode inside the app): treat as `false`.
- Example: `EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE` (`@dems/shared/api`).

### 4. For information (no client change needed)
- op 85 refuses a change whose `from` is not the segment's CURRENT text: `422 INVALID_INPUT`, `details.reason: REVISION_FROM_NOT_CURRENT_TEXT`, `details.segmentIndex`, `details.currentRevision`. Current text = the `to` of the newest revision that changed the segment, else the sealed text. A client that builds `from` from the sealed document for a segment that was already revised is refused: build it from the newest revision's `to` (op 86). A stale base stays `409 TRANSCRIPT_REVISION_CONFLICT`.
- `sttConfig.pendingForNextSession` is true only while a session that is NOT yet ended holds an older snapshot (G81b-05); the member name is unchanged.
- Audit rows of verify, export, export verify, summary acknowledge, recovery start carry `deviceId` when a paired device sent the action (web: `null`). The verify rows also carry `details.operationId: verifyEvidence`; the failed verify row of a sealed package names the fragment: `details.failedFragments` (`<trackId>:<seq>`, comma-joined, at most 8) and `details.failedFragmentCount`. The rule is general since wave K: EVERY audit row a hosted action writes for the acting operator names the paired device that sent it (row `deviceId`; no `details` key).

- The item's `transcriptModel` is put on an item when its sealed package is read (at a start of the Core, after a seal, and by op 40 for an item that carries no sealed facts yet). An item that was already read by a RUNNING Core gets it at that Core's next start - lane 2 shows it after M1's restart.

**S2 consistent at 2026-10-11 00:52 WIB** - server + shared work of S2 is at a consistent point: targeted unit and db tests green, typecheck clean in `packages/shared`; `apps/core-server` typecheck shows only S1's in-flight line (`src/transcription/index.ts:438`). OpenAPI regenerated (97 operations). Lane 2 may be restarted as far as S2 is concerned.

## S1 (written 2026-10-11 01:00 WIB; the code is in the tree, note `implementation/139_fix_wave_k_s1.md`)

No operation, no audit type, no schema change: totals stay 97 / 36 / 61 / 67, schema 6 / dbc-7. No member was added to `packages/shared/src/api/**` and the OpenAPI file was not generated. What changes is WHEN existing members are present and what two existing texts say. Read every member BY NAME.

### 1. The restart fault ends (G75c-01) - for W, M1, M2: nothing to build, the state now moves
- The fault `POWER_FAIL` with `coreNotRunning: true` (`faults.active[]`, `session.fault`, its alert, `FAULT_RAISED`) is active ONLY while the session it was raised for is still open as that faulted session (`session.fault.coreNotRunning === true` and `session.state` FAULT / RECOVERY / FINALIZING).
- When that session is SEALED (interrupted) or closed (ended UNSEALABLE, closed INCOMPLETE): ONE row `FAULT_CLEARED` (`details.kind: POWER_FAIL`, `details.coreNotRunning: true`, message `CORE_NOT_RUNNING_CLEARED_SENTENCE` of `@dems/shared/sim`), the entry leaves `faults.active`, the alert reads `active: false` with `resolvedAt`.
- `session.fault` of the SEALED session still says `{ kind: POWER_FAIL, fromState: RECORDING, coreNotRunning: true }` (the interrupted item reads it; G75c-03 / `CORE_STOPPED` is the next task).
- A database that already holds the stuck fault (lane 2: `ALR-000016`) heals at the NEXT START of its Core: one `FAULT_CLEARED` row at the start, the alert resolved. No reset. The engine's start line says `restartFaultEnded: true` once.
- A start with no session open raises nothing and clears nothing.

### 2. THE SEAL RIG (G75b-02 "not provable live") - for M1, W and the re-check
Development capture lane only (lane 2), a Core started WITH the lane launcher:

```
scripts/lane/lane.sh stop 2
scripts/lane/lane.sh start 2 --with-camera-stub --speech-mic     # the rig is installed and OFF; the start prints "seal rig available ... says: OFF"
scripts/lane/lane.sh seal-rig 2 status                            # what the switch says
```

BLOCKED seal (retriable cause `SESSION_KEY_STORE_UNAVAILABLE`):
```
scripts/lane/lane.sh seal-rig 2 blocked        # BEFORE the session is ended
# record a session on the FAKE sources (CAM-01, CAM-02, MIC-01, MIC-02) and END it
#   t+0 s    CLOSE_TRACKS fails, "Sealing is being retried (retry 1 of 3, in 5 s). ..."
#   t+5 s, t+35 s, t+155 s   retried, fails
#   t+155 s  the CRITICAL alert `params.reason: SEAL_BLOCKED`, `params.detail: SESSION_KEY_STORE_UNAVAILABLE`; `sealAttentionOf` / `sealBlockedNoticeOf` say blocked; the session stays FINALIZING
scripts/lane/lane.sh seal-rig 2 release        # the switch is OFF
# then the PRODUCT's own retry completes the seal: the recovery action of the session (web / tablet "recover" on a FAILED sealing step -> RECOVERY_STARTED details.reason SEAL_RETRY),
# or the next automatic retry if "release" came before t+155 s, or the next start of the lane. The item is SEALED, verify PASS; the blocked alert resolves.
```
UNSEALABLE / quarantine (not retriable cause `SESSION_KEY_NOT_OF_SESSION`):
```
scripts/lane/lane.sh seal-rig 2 unsealable     # BEFORE the session is ended
# record on the FAKE sources and END it:  attempts at t+0, t+5 s, t+35 s, then the terminal outcome:
#   recordings MOVED to <media root>/.quarantine/<sessionId>/, SESSION_INCOMPLETE (details.reason UNSEALABLE, cause SESSION_KEY_NOT_OF_SESSION),
#   one CRITICAL alert, no open session, a new session can be created at once
scripts/lane/lane.sh seal-rig 2 release        # always end with it
# the lane now holds a quarantine folder: its next reset is  lane.sh stop 2 ; lane.sh reset 2 --discard-unsealed-fake-recordings
```
Rules of the rig: it binds to ONE session (the first whose seal it meets; the switch file then reads `BLOCKED <sessionId>` / `UNSEALABLE <sessionId>`) and touches no later session until the switch is set again; a session that did not record from FAKE sources only is never touched (log line `LANE_SEAL_RIG_NOT_A_FAKE_SESSION`); no key file is written, read or planted; a production configuration is not started by the launcher (`check sealing.sealRig`, `code DEV_SEAL_RIG_IN_PRODUCTION`) and the sealing host refuses a development sealer outside REAL_DEVELOPMENT (`DEV_SEAL_RIG_NOT_DEVELOPMENT`). Log lines of the Core while it is on: `SEALING_DEVELOPMENT_SEAL_RIG` (warn, at the first seal), `LANE_SEAL_RIG_BOUND` (warn). The START-refusal sentence (`SESSION_KEY_NOT_OF_SESSION` at op "start") is NOT what this rig drives: it acts at the seal only.

### 3. Manifest field 36 `tracks[].profile` states the STREAM (G89b-01, ruling D222 (2)) - for W, M2 (labels) and the docs owner
- NO manifest member was added: the existing field 36 carries it. Its text is now built from the camera file itself - picture size from the init segment, frame rate MEASURED over the first whole fragments - in the vocabulary of the profiles: `H264_720P30`, `H264_1080P25`; a picture that is not 16:9 states its width (`H264_1280X960P30`); a rate the Core did not measure is absent (`H264_720P`). Rule and tests: `streamProfileOf` (`apps/core-server/src/sealing-host/session-reader.ts`).
- Packages already sealed are unchanged and stay valid (the field is free text in `dems.manifest/2`; no verify check reads it).
- When the selector's configured profile is not the stream: the manifest states the stream, and the session carries ONE notice: an alert `severity: WARNING`, `kind: SYSTEM`, `target: <sessionId>`, `params.reason: STREAM_PROFILE_DIFFERS`, `params.tracks: "VIDEO-01:<stream>:<configured>[,VIDEO-02:...]"`, written `active: false` (a notice: nothing is to be done, nothing ends it), raised when the seal reads the session. Message: "The recorded video is not the configured profile: VIDEO-01 is H264_720P30 (configured H264_1080P25). The evidence manifest states the recorded stream."
- CLIENT RULE (the manifest is the statement): a label of the RECORDING's picture ("1080p - 25 fps", "Recording Profile") on an item or a session whose alert list holds that notice must not state the configured profile as a fact of the recording. `session.input.profileId` / `captureConfig.cameras[].profile` are what was CONFIGURED.
- OPEN (decision 1 of note 139): on lane 2 every session will carry this notice, because the lane's selector says `H264_1080P25` and its generated sources make 1280 x 720 at 30 (their adapter declares `H264_720P30`). The generator was NOT changed in this wave.

### 4. Sealed transcript of an interrupted recording (G81b-04) - for W, M2 (no change needed)
- The document of a session whose recording ended at a fault keeps its open interval (`to_ms: null`) and now lists `intervals_incomplete` in `qa_flags` (transcript spec §D.2). A recording that was stopped is byte for byte as before. Items already sealed are unchanged.

### 5. THE SEAL'S ETA (G75c-05) - for W and M2: THE RULE OF THE MEMBER
- `etaMs` of op 83 (and `session.finalization.steps[].etaMs`) is the remaining time of the RUNNING step **as the Core measured it** - only the steps that process bytes the Core counts (CLOSE_TRACKS, the hashing step) state one, and only after a twentieth of the step is done.
- It is `null` whenever the Core has no measured basis: ALWAYS for `FINALIZE_TRANSCRIPT` (it used to carry the bound of the wait, about 1,680 s), before a step has done 5 %, for a FAILED step, while nothing runs. `0` only when every step is done.
- CLIENT RULE: `etaMs === null` -> draw NO "about N s left" line (not "0 s", not a dash with a unit). The transcript step's own progress sentence is `steps[].detail` ("1 of 3 chunks") where the client reads the session slice.

### 6. Timeline rows of a capture fault (G75c-06) - for W and M2
- The sentence "The capture stopped unexpectedly ... The recording was interrupted." is CLIENT-DRAWN: `captureFaultSentence(params.reason, null)` over a timeline row that carried NO `reason` (web `features/session-monitor/timeline-panel.tsx:80-82`).
- Server / shared half, done: the timeline row of a fault that does not end the session now carries `params.reason` (a key of `CAPTURE_FAULT_SENTENCES`: `DEMO_CAPTURE_FAULT`, `WORKER_KILLED`, ...). The web's existing call then draws the true sentence ("The demo control raised a capture fault. The recording is not affected." / "The capture worker process was killed."). M2: draw the tablet's row the same way - `params.reason` first, the no-reason sentence only when the row has none.
- One row, not two: an interrupted capture whose fault the capture side already told the timeline of adds no second row (`interruptedCaptureTransition`).

### 7. "decrypted bytes FAIL" beside V-05 "Not run" (G89b-06) - for W and M2: CLIENT-DRAWN
- Op 41 answers `files[].plainOk` as a strict boolean and writes `false` when V-05 did not run (`apps/core-server/src/evidence-verify/index.ts:220`, `plainOk = file.plainOk === true`; contract `packages/shared/src/api/evidence.ts:277`). Both files are S2's / the contract's: NOT changed by S1 (request filed).
- CLIENT RULE until the contract has a third state: the decrypted-bytes part of a file row is the state of check `V-05` of the SAME result (`checks[]`): PASS / FAIL when V-05 ran, "Not run" when V-05 is skipped - never FAIL from `plainOk: false` alone. The same for the stored bytes (V-04) and the chain.

**S1 consistent at 2026-10-11 01:00 WIB** - server, shared-sim and lane-script work of S1 is at a consistent point: targeted unit and db tests green (list in note 139), typecheck and lint clean in `apps/core-server` (apart from three type errors in S2's own in-flight test files), `packages/shared`, `apps/transcriber`. Lane 2 must be RESTARTED by M1 to run this code (`lane.sh stop 2`, `lane.sh start 2 --with-camera-stub --speech-mic`): at that start `ALR-000016` is cleared (one `FAULT_CLEARED` row) and the seal rig is installed, OFF.

## KR (reconcile pass of S1 + S2; written 2026-10-11 01:06 WIB - the member below is LIVE in the tree: producer, contract, example, OpenAPI)

Totals stay 97 / 36 / 61 / 67, schema 6 / dbc-7. ONE additive optional member.

### 1. Op 41 `files[].plainChecked` (G89b-06, S1's request of 18:00:00Z) - for W and M2
- `EvidenceVerifyResult.files[].plainChecked?: boolean` (contract `packages/shared/src/api/evidence.ts`, beside `plainOk`).
  - PRESENT AND `false`: the plaintext check (V-05) did NOT run for THIS file (its stored bytes already failed, the file could not be read, or the key was not available in a run that does not require it). `plainOk` is then `false` because it is not a pass - it is NOT a failed comparison. Draw the decrypted-bytes part of that row as "Not run", never "FAIL".
  - ABSENT: `plainOk` is the result of the check for this file - `true` PASS, `false` FAIL (a comparison that failed, or a REQUIRED key that is missing: V-05 then holds a finding naming the track).
  - The Core never writes `plainChecked: true`. Read it as `row.plainChecked === false`.
  - The member is per FILE, so it is finer than the status of check V-05: V-05 can be FAIL for `VIDEO-01` while `VIDEO-02` was not checked.
- Example: `VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE` (`@dems/shared/api`) - two file rows, the second with `plainOk: false, plainChecked: false`.
- An older Core (lane 2 until M1 restarts it) answers no such member: keep the rule of S1 section 7 (the state of check V-05 of the same result) as the fallback when the member is absent AND V-05 is SKIPPED.
- Stored bytes (V-04) and the chain have no such member: `storedOk` / `chainOk` are always checked when a file row exists.

### 2. Ops 85 / 86 `reason` on every transcript revision (G81b-09; requests of M2 17:37:07Z and W 18:20:10Z) - for W and M2
- `TranscriptRevision.reason?: string` (`TranscriptRevisionSchema`: the answer of op 85 and every entry of op 86's `items`). The name the web and the tablet already read.
  - It is the note the author gave (op 85 `note`), as the revision row stores it; the same text is inside the signed body and on the audit row `TRANSCRIPT_REVISED` (`details.reason`).
  - ABSENT only where a stored revision holds none (no such revision can be written by op 85: the note is required, 5..500). Absent = "not stated": draw nothing, never a default.
  - Access: the same as the revision itself (EVIDENCE_VIEW + the case scope of op 86, `access.readTranscript`); a refusal carries no entry, so no reason.
- Example: `TRANSCRIPT_REVISION_REASON_EXAMPLE` (`@dems/shared/api`); the registry examples `createTranscriptRevision` 201 and `listTranscriptRevisions` 200 carry the member.

### 3. `archiveOnCore` through the Live source (G94b-06; M2's report) - for W and M2
- The Live source dropped the member. Now `source.actions.exportEvidence(...)` resolves with `archiveOnCore: boolean` BY THAT NAME when the 202 of op 42 states a boolean (`LiveExportAccepted.archiveOnCore`, `packages/shared/src/live/source/bindings.ts`); absent when the Core did not say (treat as `false`, as in S2 section 3). Nothing is derived.

### 4. The selector line of a generated test source (G89b-01, second half; ruling of 2026-10-11) - for W, M1, M2: nothing to build
- A development-capture Core (lane 2) corrects, AT ITS START, every camera line of the selector whose device is of adapter kind `FAKE` to the profile its generated adapter declares and makes: `captureConfig.cameras[].profile` reads `H264_720P30` (was `H264_1080P25`); the selector's revision moves by one, once; log line `DEV_GENERATED_SOURCE_PROFILE_STATED` once. No migration; the seed and the in-app simulator are unchanged (a simulated Core still says `H264_1080P25`).
- After M1's restart of lane 2: a session on CAM-01 / CAM-02 seals `tracks[].profile: H264_720P30` = the configured profile and carries NO `STREAM_PROFILE_DIFFERS` notice. A selector an operator sets to another profile still gets the stream in the manifest and the notice. Sessions sealed before the restart keep their notice.
- `session.input.profileId` (`STANDARD_1080P25`) is a different member (the session's recording profile id, a closed set of one) and was NOT changed: a label drawn from it must not be stated as the picture of a recording (S1 section 3 client rule stands).

### 5. For information
- The `ACCESS_DENIED` row of a refused demo reset / scenario load (`RESET_BLOCKED_REAL_EVIDENCE`) carries `deviceId` when a paired device sent it (web: `null`).
- The engine's start line key `restartFaultEnded` is a boolean.

**KR consistent at 2026-10-11 01:19 WIB** - the server + shared tree of S1, S2 and KR is at a consistent point: `apps/core-server` and `packages/shared` typecheck and lint clean as a whole (0 errors, 0 warnings), the five cross-driver reds green, targeted unit and db tests green (list in `implementation/144_fix_wave_k_kr.md`), OpenAPI regenerated (97 operations). Lane 2 may be restarted by M1 (`lane.sh stop 2`, `lane.sh start 2 --with-camera-stub --speech-mic`): at that start the selector of lane 2 is corrected to `H264_720P30` (item 4) and `ALR-000016` is cleared (S1).

## Z1 (closing pass K-Z1; written 2026-10-11 18:48:21Z BEFORE the code is finished - the name is final; a status line below says when it is live)

### 1. The indexed view of a sealed camera file (G94b-01, ruling D224 (1)) - for the mobile player; the web keeps its path

ONE member name, `seekIndex`, additive and OPTIONAL, on operation 88 (`createEvidenceMediaSession`); totals stay 97 / 36 / 61 / 67, schema 6.

- REQUEST body `EvidenceMediaSessionRequest.seekIndex?: true` - "serve this session as the indexed view if the Core can". Absent = the stream exactly as before (the web player sends nothing new).
- ANSWER `EvidenceMediaSession.seekIndex?: true` - present (always `true`) exactly when the URL of THIS session serves the indexed view: the same decrypted bytes plus ONE `sidx` box between the init segment and the first fragment, built from the SIGNED manifest's fragment table (`files[].fragments[]`: `byteOffset`, `byteLength`, `mediaStartMs`, `mediaDurationMs`, `keyframe`). ABSENT = the plain stream: the client was not asked for it, or the table of this file cannot yield an exact index (then the client keeps its no-seek sentence). Never `false`.
- The view is a property of the media session (it is under the token's MAC): lengths, `content-range` and Range offsets of that URL are those of the VIEW (file size + the index's bytes). Nothing of the sealed package, the export or Verify changes.
- Example: `EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE` from `@dems/shared/api` (a consumer test imports it and reads `seekIndex` by name). Mobile constant: `SEEK_INDEX_MEMBER` (`apps/mobile/src/features/evidence/media-session.ts`) = the same name, no move needed.
- Status: NOT LIVE YET (line added below when producer, contract, example and OpenAPI are in the tree and lane 2 runs it).
- **Status: LIVE** (written 19:42:01Z): producer `apps/core-server/src/media-stream/{seek-index.ts,source.ts,token.ts,service.ts}`, contract `packages/shared/src/api/evidence.ts` (both schemas of op 88), examples `EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE` / `EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE`, OpenAPI regenerated under `.locks/npm.lock`; lane 2 runs it since its restart at 01:59:36 WIB (PID 29919); the tablet seeks on it (`implementation/145_fix_wave_k_z1.md`).

### 2. For information (no client change needed)
- A stop of the media route on a fragment that fails its integrity check writes its WARNING row ONCE per (operator, sign-in session, item as sealed, file, fragment, code) within 60 s; the same place asked again (a player's own retries, a probe, a renewed media session) gets the same refusal (the cut, or `409 MEDIA_NOT_AVAILABLE` / `FRAGMENT_NOT_AUTHENTIC`) and a log line, no row (G94b-10, PE-WH-04).
- On a session of the indexed view the row's `rangeStart` / `rangeEnd` are offsets of the SEALED FILE (not of the view); `bytesServed` is what was sent (it includes the index's bytes when the range covered them).
- A session of the indexed view whose file has no index any more answers `409 MEDIA_NOT_AVAILABLE`, `details.reason: SEEK_INDEX_NOT_AVAILABLE` (cannot happen while the manifest of record is the one the session was issued for; never the plain bytes at the view's offsets).
