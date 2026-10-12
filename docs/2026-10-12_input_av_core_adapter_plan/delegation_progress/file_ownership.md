# File ownership - track D

Source of truth: the Ownership Area column of `identification/03_implementation_blueprint.md` (Execution Profile) and its section 7 (single-writer resources). This file records rulings and the batches.

## Batch 1 (2026-10-12 22:30) - rows 2, 3, 4, 27, 87, 103, 160 (docs only), 13, 20, 95, 147 (code)
| Row | Owner area |
|---|---|
| 13 | one unit test in the capture area of apps/core-server (executor declares) |
| 20 | apps/core-server/src/capture/adapters/types.ts |
| 95 | NEW under apps/core-server/src/capture/: destination rule (+ its test) |
| 147 | apps/core-server/src/capture/adapters/credential.ts (+ its test) |
No overlap. Held back for load (1-minute load about 10 at launch, another session active): heavy rows 6, 10, 12, 39; database row 17; single-writer rows 19, 63.

## Update 22:30 - rows landed: 2, 4, 13, 20, 160
- Row 20 driver decisions DD-1..DD-4 ACCEPTED (profile optional until row 47 passes it; the named error is its own constant, not a sixth wire code; it lives in types.ts; start takes an optional signal).
- Row 13: no mic-transport.test.ts exists; its test went into adapters/__tests__/static.test.ts (A-3 block). ACCEPTED. static.test.ts is a shared file: later rows that add a static rule there make one small additive Edit after re-reading.
- Requests routed: (a) adapters/index.ts barrel exports of AUDIO_INPUT_BEYOND_CARD / AudioInputBeyondCardError -> held for the first integration pass (non-blocking; rows 64, 67 import ../types directly); (b) capture-session/index.ts:1131 pass `profile`, :950 drop the cast -> row 47 (its writer), told in its brief.
- Row 2 finding: the operation-count pin is core-api.ts:1079 plus seven test lines; sim/api.ts:767 is a comment (the simulator marks operation 97 at sim/api.ts:1479). Told to rows 63 and 94.

## Batch 2 (22:32) - rows 19 (audit vocabulary, single writer), 38 (packages/shared/src/api/capture-discovery.ts), 52 (packages/shared/src/api/state-slices.ts, sim/types.ts). Row 94 waits for row 38 (same file).

## Update 22:36 - row 147 landed
- Driver decisions 1-6 ACCEPTED (one JSON line, access nested, trailing line feed; zero or one access per message; malformed message refused with CAPTURE_LOCATOR_INVALID until a dedicated code exists; one-reader check in credential.test.ts; the injection result exposes no member; unpaired surrogate refused). Row 21 (the door) and row 40 (the relay) read this line format - told in their briefs.
- Requests held for the first integration pass: adapters/index.ts exports (startMessageBytes and types, plus row 20's two values); a dedicated refusal code in adapters/errors.ts; optional move of the one-reader check into rule A-2 of static.test.ts.

## Update 22:42 - rows 3, 38 landed
- Row 38 DD-1..DD-3 ACCEPTED (no sixth outcome member; no codec member on the answer; the contract text leads the server until row 50). Deviation noted: its five edits were applied by a uniqueness-asserted script, not the Edit tool - inside its own file, result reviewed by diff at the commit; the rule stands for shared files.
- core-web / mobile typecheck red at state-slices.ts:531-539 and sim/api.ts:344 = row 52 in flight (attributed to row 52; re-run when it lands).
- Requests routed: i18n NOT_H264 strings (common.ts:790,797) and onvif-session.ts:222,491-492 -> row 50; three Core comment lines -> first integration pass; regenerate openapi.json -> after row 52, by row 52 or the integration pass (single writer of openapi.json per batch: row 52 now).
- Row 94 (same file as row 38) may start after rows 52 and 19 land.

## Update 23:05 - rows 27, 87, 103, 52 landed (52 = needs-review)
- Row 52: driver decisions 1-4 judged. (1) its out-of-area edit of packages/shared/src/api/core-api.ts (three members of VideoTrackStatusSchema) is ACCEPTED - core-server did not compile without it; told to row 63 (operation pins live in the same file: re-read before editing). Scripted replace noted again; rule restated in every later brief. (2) codec in screen form `H.264` | `HEVC` ACCEPTED. (3) bounds 100-9999 / 1-240 ACCEPTED. (4) `fps` left non-null = the row's "not built" part.
- Row 52's remainder becomes integration pass I-1 (one small agent, after row 19 lands, exclusive owner of the listed lines): regenerate packages/shared/openapi/openapi.json ONCE (rows 19, 38, 52); nullable `fps` with its three core-web readers (devices-panel.tsx:323, device-drawer.tsx:237, session-monitor/model.ts:386); adapters/index.ts barrel exports (rows 20, 147); a dedicated refusal code in adapters/errors.ts (row 147); three Core comment lines (row 38).
- Test reds attributed: 2 x openapi drift -> I-1; the 67->77 audit pin -> row 19 (in flight).

## Update 23:15 - row 19 landed (needs-review -> remainder to I-1)
- Row 19: 77 audit types (33 with a key list). Driver decisions ACCEPTED: alias types are SECURITY; detail keys DD-1..DD-8 as recorded (reviewed by the security row at the close); fixture reveal reason CONNECTION_TEST. Three shared test files were not in the baseline pin list - added to research knowledge: i18n-vocabulary-sync.test.ts, api-registry.test.ts, api-domain-operations.test.ts. Scripted insertion into vocabulary.ts noted (third time): later briefs state "Edit tool only" as a hard limit.
- Integration pass I-1 LAUNCHED (sole code writer now): i18n labels of the ten types, the 67->77 pin in api-capture-discovery.test.ts, AUDIO_CARDS scope, nullable fps + three core-web readers, adapters/index.ts exports, errors.ts dedicated code, three comment lines, openapi.json regenerated once. No other code row starts until I-1 reports.

## Update 23:30 - I-1 landed, all checks green
- Confirmed: labels English only (the repository has no Indonesian resource: packages/shared/src/i18n/ holds en/ only); a null fps hides the whole format line in the three web readers until row 54 adds a rate-less string.
- Carried to their rows: row 54 (camera-tile.tsx:53, session-monitor/model.ts:455 use `fps ?? 25`), row 55 (mobile live-feed.tsx:216, device-detail.tsx:550), row 63 (stale comment core/audit-details.ts:187).
- Quiet point: no code row in flight. Full-suite run (sonnet runner) then commit of phase M0/M2-part.

## Update 2026-10-12 23:10 - commit 7969f0fa (33 code files, 41 docs), tree clean
- Suite run c01: typecheck, lint clean; unit suites green after the wording fix 019b (search-path.test.ts 4/4, fixtures 182/182); database suite 2429 passed, 7 skipped. Known: core-server and mock-core unit tests that bind loopback need the sandbox off.
- Trailer of 7969f0fa names Sonnet 5.5 (the committing agent's own attribution); not amended (no history rewrite).

## Batch 3 (2026-10-12 23:10) - one row per single-writer resource
| Row | Area | Single-writer resource |
|---|---|---|
| 5 | secret-scan needles (executor declares) | - |
| 6 | NEW under apps/capture-worker/test-fixtures/: E-11 pushers and run script | heavy-host lock |
| 17 | apps/core-server/src/db/schema (capture.ts, meta.ts, value sets), migration set A | db, migrations, value sets, schema version |
| 24 | apps/core-server/src/capture/adapters/local/leftover.ts or beside it | - |
| 26 | apps/core-server/src/capture/adapters/camera/onvif-session.ts | static-capture (the only writer of the capture static lists in this batch) |
| 63 | operation pins file set (mic operations) | op-pins (row 94 waits) |
| 104 | alias helper file (executor declares) | - |
| 109 | apps/core-server/test/support/fake-onvif-stub.ts | - |
| 124 | hardware procedure, frame chapter (docs) | - |
| 161 | names register for WP-13a (docs) | - |
Held: 65, 66, 80 (static-capture, next batch), 94 (op-pins after 63), 10, 12, 39 (heavy, after 6), WP-13a rows (after 161).

## Update 2026-10-12 23:19 - rows 24, 5 landed
- Row 24 (leftover detection): 5 driver decisions ACCEPTED (reads /proc/<pid>/exe through /usr/bin/readlink; an unreadable candidate is counted; 64-candidate limit; no new file; optional fifth parameter). Not wired yet: requests -> fence/index.ts:457,515 pass the reader (row 21/25, the door rows), local/index.ts:28 export (integration pass I-2), HOST-17 / H-24 notes (rows 76 follow-up, 125).
- Reds seen by row 24, attributed: static rule A-6 on camera/onvif-session.ts -> row 26 (in flight); 2 type errors in test/support/fake-onvif-stub.ts -> row 109 (in flight).
- Row 5 (secret-scan needles): needs-review resolved by C23. Its 6 driver decisions accepted with C23's reading. Request: row 47 keeps the RC-2 element form of the ingest secret.

## Update 2026-10-12 23:21 - rows 109, 124 landed
- Row 109: 5 driver decisions ACCEPTED (network calls opt-in; gateway read-back a violation unless set; two extra options; a DHCP request is obeyed and recorded; launcher test in the targeted run). Reds it saw: onvif-session.test.ts (profiles member) -> row 26; 9 type errors in db/fixtures/pipeline.ts and db/mapping/rows.ts -> row 17. Both in flight.
- Row 124: hardware procedure frame at scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md, 27 checks placed. 12 driver decisions accepted. Open points routed: (a) no PostgreSQL procedure for Ubuntu exists -> follow-up of the host profile (row 76's document; given to row 77's brief as a documented, print-only step); (b) the acceptance database must be named dems_demo -> noted in the procedure, confirm at row 125; (c) X-2 has no tool, so the hardware run stops at H-16 -> FOR THE USER (external dependencies X-1, X-2 are outside the port by the plan; building an operator-password tool or a signing-key provisioning command would be a scope change).

## Update 2026-10-12 23:22 - row 26 landed
- Row 26: 8 driver decisions ACCEPTED (second facade createOnvifStreamLocator; profiles filled for REACHABLE only; the new reason code; others as recorded). Its static-list edit (capture/__tests__/static.test.ts:427-428, four names) is the batch's one edit there.
- Requests: stub mode with two video sources and odd tokens -> row 109 has landed, so it goes to integration pass I-2 as an additive stub mode; the query ruling -> C24, new row 174.
- Red it saw: src/db/store/store.ts(306,7) -> row 17 (in flight).
- Row 109's red (onvif-session.test.ts on the profiles member) is closed by row 26's amended case: to be confirmed in the next targeted run.

## Update 2026-10-12 23:26 - row 6 (E-11) landed; row 7 launched (its condition is met)
- E-11 on the unchanged release worker: O-1 ACCEPTED 18 of 18 on six near-miss paths (wrong path is accepted, ingest_connected, 175 frames); trailing slash INCONCLUSIVE 3; O-2 INCONCLUSIVE 3 (TCP refused, first stream complete); O-3 precondition never met. Controls 21 of 21. Side observation: a completed handshake without media ended the whole worker (exit 70, 2 of 2).
- Reading for the controller (the verdict is row 8's): the listener does NOT enforce the path, so branch A (enforcement in the Core only) is not available on this evidence; the choice is B (the worker compares the path - a worker change) or C (the worker pulls). Row 7 establishes whether the announced path is readable before media (what B needs) and characterises the worker-ending behaviour.
- New fixture apps/capture-worker/test-fixtures/e11_listener_path.py (untracked, row 6's).

## Update 2026-10-12 23:29 - row 104 (alias helper) landed
- scripts/host/netalias/: dems-core-netalias (Python 3 standard library), .socket and @.service unit files, SHA256SUMS, make_test_copy.py, test (58 tests OK on doubles; no real tool started). Unproven on Linux: 9A/H-05, H-06, H-25.
- Driver decisions judged: D-2 unit files delivered here - ACCEPTED (follows decisions/103, C19). D-3 request line `add <address>/24 <minutes>` - ACCEPTED; it is the contract for row 105 (the Core's client). D-4 limit of ONE alias at a time (S13-08 allowed two) - ACCEPTED as the stricter bound: the scan visits factory subnets one after the other (told to the scan rows). D-5 the caller is the sole member of group dems-netalias - ACCEPTED. The other eight as recorded.
- Not built: S13-10 (a) the timer -> stays with the row the blueprint names for S13-10 (see grep above); told in its brief.
- Requests: npm script (integration pass I-2, non-blocking); the `add` line format -> row 105 (resolved by D-3); delivery names -> rows 125/127.

## Update 2026-10-12 23:47 - rows 7, 63 landed
- Row 63: 99 operations (98 searchCaptureAudioCards, 99 registerCaptureAudioInput), new packages/shared/src/api/capture-audio-cards.ts; pins moved in 19 test files (fourteen beyond the baseline list - noted for row 94 and later operation rows: the pin list in the record section 3 is now the reference). Driver decisions D-1..D-8 ACCEPTED (both operations simulated and web-console-only; the simulator lists two test cards and answers registration 409 AUDIO_INPUT_NOT_REGISTRABLE).
- Remainder -> integration pass I-2 (after row 17 lands, sole writer of these lines): apps/core-server/test/acceptance/contract.test.ts and rbac-matrix.test.ts (97 -> 99; the identity rows of operations 98-99 go into the SAME table and form the capture-discovery operations 93-97 use, under the permission the contract states - no new table); the stale comment at core/audit-details.ts:187; adapters/local/index.ts:28 export (row 24); the npm script for the helper test (row 104); the fake ONVIF stub mode with two video sources and odd tokens (row 26).
- Row 94 (typed address on the camera search body; op-pins "body only") may start after I-2.

## Update 2026-10-12 23:55 - row 17 (schema set A) landed; integration pass I-2 launched (sole code writer)
I-2 list: acceptance pins 97 -> 99 in apps/core-server/test/acceptance/contract.test.ts and rbac-matrix.test.ts with the identity rows of operations 98-99 in the table the capture-discovery operations use; the two 43-table lists row 17 names (-> 45); stale comment core/audit-details.ts:187; adapters/local/index.ts:28 export (row 24); npm script for the helper test (row 104); fake ONVIF stub mode: two video sources, several profiles per source, odd tokens (row 26); then typecheck in five workspaces and the targeted tests. After I-2: full-suite run c02, commit.

## Update 2026-10-13 00:35 - commit b7ed4c60 (104 code files, 37 docs); suite run c02 all green; tree clean
- c02: typecheck 7 workspaces, lint, npm test (core-server 6942, shared 2697, core-web 2367, mobile 3166, transcriber 563, capture-protocol 31, mock-core 19), test:db 2522 passed / 7 skipped on throw-away databases, host helper 58, secret scan at baseline (camera-credential 54 in 34 files, no new file; ingest-secret 0).

## Batch 4 (2026-10-13 00:35)
| Row | Area | Single-writer resource |
|---|---|---|
| 11 | docs only (reader on a .cache file) | - |
| 21 | NEW under apps/core-server/src/capture/adapters/: production door | static-capture (only writer this batch), config |
| 28 | packages/shared selector contract (+ the widening for an absent value, C25; the four activeInputId follow-ups, C30) | i18n, shared hot files, sel-map (only writer) |
| 45 | NEW under apps/core-server/src/modules/capture-config/: reveal module, credential reader | db (tests only), static-adapters |
| 58 | apps/capture-worker/src: the gate, its match and attribution | worker-build, heavy-host lock (only heavy row) |
| 77 | NEW under scripts/: host profile scripts | - |
| 94 | packages/shared/src/api/capture-discovery.ts, sim/api.ts (typed address) | op-pins body only (only writer) |
| 125, 126 | hardware procedure chapters 2 and 3 (docs) | - |
| 166 | apps/core-server/src/db/mapping/rows.ts (selector row mapping) | - |
| 174 | apps/core-server/src/capture/adapters/camera/onvif-session.ts (query rule) | - |
Held: 64, 65, 66, 80, 110 (static-capture, next), 164 (sel-map after 28), 99 (schema set B, lands and commits alone - C32), 47 (after 21 and 45), 39, 10, 12 (heavy, after 58), 54, 55 (after 28 settles the shared types).

## Update 2026-10-13 00:49 - rows 11, 77, 174, 166 landed
- Row 11 (E-8 reader half): the Core's reader accepts both HEVC files (codec HEVC, 8/8 fragments, statement HEVC_1080P, rate null: the rate is read from avcC only - fragments.ts:457,459,571-572,702-705 -> the HEVC reader row of WP-10; contract already allows a null rate).
- Row 77: ten host profile scripts + test (167 passed); 10 driver decisions accepted (bash; 14 steps never run by a script; the Ubuntu guard has no override; root and dems refused as service user). Request: PostgreSQL items HOST-50..56 into row 76's document -> integration pass I-3 (docs).
- Row 174: query rule built in onvif-session.ts (bounds 256 / 128 / 8 parameters / name 32 / value 64; no percent-encoding; repeated names refused). 8 driver decisions accepted - stricter than C24 asked, relaxable on hardware evidence (9A/H-10). One of row 26's test lines changed (?channel=someone -> ?token=someone): accepted, it was the refusal C24 lifts. BLOCKING for row 46: the injection point in adapters/credential.ts still refuses a query, so such a camera is located but cannot be opened -> carried as a requirement of row 46 (owner of the opener's injection), stated in its brief.
- Row 166: selector row mapping handles an unassigned line (181/181, pure tests). 4 driver decisions accepted. Requests: the one-line type swap when the seam is removed (integration pass after row 28); a NULL write against PostgreSQL is proven by rows 29/33.
- Reds seen and attributed: G-R2/G-R8 naming production-door.ts -> row 21 (in flight; it is the writer of those lists); 6 type errors in packages/shared/src/sim/ -> row 28 (in flight).

## Update 2026-10-13 00:53 - row 21 (production door) landed
- New adapters/production-door.ts (+ test, + double test/support/production-door-double.mjs); config keys DEMS_CAPTURE_RELAY, DEMS_CAPTURE_GUARD; static lists moved per SR-1 entry 1; new adapters rule A-8. Door tests 10/10.
- 9 driver decisions judged: its edit of test/static/credentials.test.ts (a fourth exact process-importer list, outside the two static files named in the brief) ACCEPTED - it is a static list of the same kind and row 21 was the batch's only writer of such lists. The door refuses to start unless the Core's core-file limit is 0 (AD-09), closed environment list with one key (ALSA_CONFIG_PATH), the door serialises the message itself: ACCEPTED.
- FINDING -> new row (not appended to an open one): calling kill on a child whose spawn failed, in the same turn, signals process ID 0 and ends the caller's process group (measured by row 21, exit 137). The new door guards it; the EXISTING doors adapters/local/process-door.ts and capture/ipc.ts (task 3 code) do not. Row 180 (coder-execution, S): the same guard in those two files, each with a test that a failed spawn does not signal the group; launched in the next batch as the single writer of those two files.
- Requests: load-config.ts does not read the two keys yet -> row 47/48 (session start reads the relay program); barrel export -> I-3; the fence leftover call (fence/index.ts:457,515, also row 24's) -> the row that owns the fence file per the blueprint.
- Reds attributed: credential-reader.db.test.ts (2 failures, 3 type errors) -> row 45 (in flight).

## Update 2026-10-13 00:53 - rows 94, 58 landed; batch 4b launched (176, 180, 64)
- Row 94 (typed address contract): 7 driver decisions judged - schema holds form only; new 422 reason DISCOVERY_ADDRESS_NOT_ALLOWED; web-console-only applies to the member; no port member; no probe while the caller's own search runs; simulator stand-in rule: ACCEPTED. Its seventh ("changes the no-address path's code: the fixture candidate's REGISTERED match is by address, not CAM-03") is ACCEPTED ON CONDITION that Simulated behaviour is unchanged - checked by the simulator suites at the next full run and named for the verifier at the M-gate. openapi.json regenerated by row 94 at 00:48:57 while row 28's selector schemas were mid-flight: row 28 regenerates last when it lands (single final state).
- Row 58 (worker gate): announce.c/.h, gate at ingest.c:557, proof build capture-worker-noannounce; announce_test 151 checks; row58_gate.py 12/12 (right path both cameras recorded; seven near misses and the other camera's line refused with no ingest_connected and 0 bytes; line unseen refused). BR-01..BR-03 done; BR-04 -> row 175, BR-05 -> row 176, BR-06 version -> row 177. 8 driver decisions accepted (new pure unit beside ingest.c; one proof build). Requests: a static rule for the gate in check.sh -> row 178 (it owns the worker's permanent checks); rows 47/179 make the relay announce the ingestUrl byte-identical, once.
- Batch 4b: 176 (worker: handshake-then-close ends one camera, not the worker - BR-05; single writer of ingest.c, heavy lock), 180 (kill guard in adapters/local/process-door.ts and capture/ipc.ts), 64 (audio card listing parser; the static-capture writer of this batch).

## Update 2026-10-13 00:54 - row 45 (reveal module + credential reader) landed
- New modules/capture-config/credential-reveal.ts (the one file naming the reveal function) and credential-reader.ts; unit+static 19/19, database 11/11 on throw-away clones, tree static rules 43/43.
- Driver decisions ACCEPTED: `take(holder)` handout with bound methods in place of credentialFor(deviceId, reason, actorId) - each holder takes its reader once (closed holders, AD-03 (1)); every completed reveal call is audited, including "not stored"; the reader returns the opaque SealedCredential (the locator is joined later by the opener, row 46).
- AD-03 map: (1) done in the reader, wiring -> row 144; (2) done; (3) -> row 145; (4) -> row 144; (5) -> rows 50, 146; (6) rows 147, 21 done.
- BLOCKING rule for rows 46 and 50, stated in their briefs: a credential read must never run inside a unit of work (untested here).
- Requests: export the reason list from core/index.ts -> integration pass I-3.

## Update 2026-10-13 00:55 - rows 125, 126 (hardware procedure chapters 2 and 3) landed
- 27 checks written with six parts (12 + 15); blueprint section 12: 0 of 10 lines without a check. 25 driver decisions accepted as recorded (script names collect-hNN.sh, record-line.sh; failure meaning inside part 5).
- Procedure defects found -> ONE follow-up row 181 (document-writer, after row 127 and the scripts rows 128/129; exclusive owner of the three chapter files and the frame): (1) the frame keeps the room network unplugged from PREP-03 but 9A/H-01 needs packages and source archives - fix the order or state an offline package set; (2) unit file G names the helper's group before chapter 4 creates it while 9A/H-16 precedes chapter 4 - the Core's unit may not start: reorder; (3) HOST-12 builds no H.264/H.265 encoder, so the E-11 repeat has no stated pusher on the host - name one; (6) 9A/H-08 has no level bound - add bound B-7 to the frame; (8) codes and screen texts marked "to confirm" are confirmed against the code once the rows that build them land.
- (4) -> row 128's brief: carry the E-11b probe source into the package (today only under .cache and in the appendix of test/007). (9) -> row 127's brief: confirm the helper request form (`add <address>/24 <minutes>`, row 104 D-3).

## Update 2026-10-13 00:56 - row 28 (shared selector contract) landed; batch 5 launched
- Row 28: shared 868 passed, typecheck 6 workspaces clean; openapi.json final state = row 94's run (generator answered "unchanged ... 99 operations"). Driver decisions DD-1..DD-5 ACCEPTED (health answer's audio members widened too; seam name AudioSliceInState; body rules as refinements; no unassign example; silentAudio's constant MIC-01 reported, not changed).
- SEAM LEFT, with owners: AudioSliceInState in sim/types.ts keeps SimState['audio'].activeInputId a string; nine readers rely on it: sim/audio.ts x2 -> row 164; sim/session-machine.ts x2 -> row 163; sim/api.ts x2 -> row 165; web audio-source.ts:144 -> row 168; mobile mic-source-model.ts:151 -> row 170; mobile use-home-data.ts:341 -> row 171. The seam is removed by the row that closes WP-13a (149) after those land.
- INTERIM STATE, not to be released: the schema accepts `unassign` but the Core answers 200 with nothing changed until rows 162 and 29 land. Rows 29, 162, 163 are prioritised as soon as their B dependencies (164 and the mapping) are in; the M2 gate does not close while this holds.
- 16 request lines of row 28 -> owners as listed in its record; pure wording/exports -> integration pass I-3.

## Batch 5 (2026-10-13 00:56) - in flight with 64 (static-capture), 176 (worker, heavy), 180 (existing doors)
| Row | Area | Resource |
|---|---|---|
| 47 | capture-session/index.ts, capture/worker-arguments.ts (session start) | session-file (only writer) |
| 54 | core-web features/devices camera tile, session-monitor | - |
| 55 | mobile features/devices | - |
| 127 | hardware procedure chapter 4 (docs) | - |
| 128, 129 | scripts/hardware-acceptance: collectors | - |
| 144 | modules/capture-config credential reader holders | db tests, static-adapters |
| 164 | packages/shared sim/audio.ts, selector-in-force (role lookup) | sel-map (only writer) |

## Update 2026-10-13 01:03 - rows 180, 54, 55 landed
- Row 180: guard `signalChild` in adapters/local/process-door.ts and capture/ipc.ts, red-before / green-after (145/145). Same unguarded call at db/seed/demo-helper.ts:74,78 -> integration pass I-3 (same three-line guard, with a spy test).
- Row 54 (web camera facts): 34/34; new strings cameraFormatNoRate, cameraFormatCodecNoRate. Its edit of session-monitor/live-feed-panel.tsx (the model's only reader) ACCEPTED. Remainder -> I-3: devices-panel.tsx, inputs-panel.tsx, device-drawer.tsx still hide the whole format on a null rate (use the new rate-less string); session-new/devices-step.tsx:433 states literal 1080p / 25 (a simulator label, known limit 43 of the root README: leave, note).
- Row 55 (mobile camera facts): needs-review. Remainder -> I-3: session-live/live-feed.tsx:216 prints an empty rate on null fps (BLOCKING before the M-gate). Red attributed: mobile sim-adapter.ts(241,27) TS2345 (RoleMicLine.role missing) -> row 164 in flight (shared role lookup) - to be confirmed when it lands.

## Update 2026-10-13 01:04 - row 176 (BR-05) landed; rows 175+177 and 39 launched
- Row 176: ingest.c:571-592 - a video stream with parameter sets but no picture size ends THAT camera (worker log code INGEST_NO_PICTURE_SIZE) before open_output; the fatal OUTPUT_SETUP_FAILED path is unedited. Fixture row176_camera_end.py 6/6: handshake-then-close on camera 1's right path -> worker exit 0, camera 2 has 175 frames with audio, one CAPTURE_FAULT for CAM-01; forced set-up failure with media and forced writer failure still exit 70 (the protection for other causes is intact); red run on a copy without the block: exit 70. row58_gate.py 12/12 again. 5 driver decisions ACCEPTED (condition tested on the input stream; frame reason stays CAMERA_NOT_CONNECTED; forced-failure build under .cache).
- Now: 175 then 177 (one agent, single writer of the worker source: log hygiene + two refusal codes; version 0.6.0) and 39 (pull-side test camera, new fixture files; shares the heavy-host lock).

## Update 2026-10-13 01:08 - rows 127, 64 landed
- Row 127 (helper installation chapter): 10 steps HI-01..HI-10; request form confirmed from source: `add <a.b.c.d>/24 <minutes>` (5 to 480), `del <a.b.c.d>/24`. 10 driver decisions accepted. For row 181: HI-04 part A before 9A/H-16.2; 9A/H-05's precondition HI-01..HI-07; refusals 37 and 41 need a step. For the helper rows (105/106, S13-10): the hypothesis that the `check` self-test answers 35 STATE_DIR_UNSAFE until a first connection creates the marks folder and after every reboot -> a requirement of row 105 to settle on doubles.
- Row 64 (card listing parser): card-listing.ts + card-listing-reader.ts (the one file-system importer, reading only); static list moved per SR-1 entry 3. 128 of 129 in its targeted run. DD-1..DD-7 ACCEPTED (parser and reader separate; fixed word UNKNOWN and USB id 0000:0000 when absent; names with < or > replaced; a card with a non-kernel id or more than 64 channels not listed; a guessed channel count is marked ASSUMED).
- Red attributed: rule A-5 "src/capture/worker-arguments.ts:31 imports the adapter layer and is not a unit that wires it" -> row 47 (in flight, the session file's writer). SR-1/SR-4 do not admit it: row 47 must remove the import or justify an amendment - sent to row 47.
- static-capture is free again: rows 65, 66, 80, 110 may take it one at a time.

## Update 2026-10-13 01:15 - row 47 (session start) landed as needs-review
- Built: per-track, per-attempt 128-bit element in the ingest address (kept after `<session>/<track>`), handed on standard input; cameras opened in the same turn, bounded; production ingest window constant; A-5 import removed (both capture static files green). Its own tests: ingest-address 11/11, session-capture.db 59/59; typecheck 0.
- Nine driver decisions judged: the secret applies in development too - ACCEPTED (one behaviour for both source classes); the 25 s session bound in production only; `profile` stays optional - ACCEPTED; "begin no longer waits for camera opens once a stop is asked" - ACCEPTED ON CONDITION that REAL_DEVELOPMENT behaviour is otherwise unchanged: named for the verifier at the M3 gate and covered by the scenario suites at the next heavy run.
- Remainder -> integration pass I-3 (after rows 164+144 and 128+129 report; sole code writer then): (a) fence/__tests__/development-session.db.test.ts: its three address pins move from the old literal to the new form (assert the stated prefix and the length/alphabet of the random element, not a literal); (b) capture/index.ts:167 and :64 pass the production-window flag so that a worker really gets the 30 s window (AD-11); (c) the ingest-address function moves out of the session file into a neutral unit of the capture area that both the session file and supervisor.ts may import under the static rules (BLOCKING row 179); (d) load-config.ts reads DEMS_CAPTURE_RELAY / DEMS_CAPTURE_GUARD (row 21's request); (e) the items already listed for I-3: mobile session-live/live-feed.tsx:216, three web panels with the rate-less string, db/seed/demo-helper.ts:74,78 kill guard, exports (adapters/index.ts for rows 21, 64; core/index.ts reason list), HOST-50..56 into the host profile document.
- Left by row 47 to its named rows: BR-07 (2) -> 179; BR-08 -> 48; relay half of BR-07 -> 46, 41; reveal count -> 151.

## Update 2026-10-13 01:15 - rows 164, 144 landed; integration pass I-3 launched
- Row 164 (role lookup, shared): 340/340 shared, typecheck clean in all workspaces (row 55's mobile red at sim-adapter.ts is gone). Driver decisions ACCEPTED: without a PRIMARY line the state keeps its held active input until the seam is removed (marked PENDING-ROW-28-SEAM for row 149); channelOfMicLine still accepts role-less lines and answers null (rows 171 then 172 narrow it); audioPairOfSelector spells the rule itself (no import cycle).
- Row 144 (credential reader holders): new credential-holders.ts, device gate in the reader; unit+static 31/31, database 15/15. Driver decisions: the destination rule as an injected DEPENDENCY of the module (the module cannot import the closed capture unit) - CONFIRMED; a gate refusal (stored address fails the rule, AD-02) writes an error-log entry and no audit entry - ACCEPTED: no reveal was attempted, so there is nothing for the reveal audit to state; the gate covers the connection test too - ACCEPTED. Requests: rows 85 and 50 need two list entries each to call the wiring; rows 46, 47, 50 get the two new refusal codes (told in their briefs).
- I-3 in flight with rows 175+177 (worker), 39 (test camera), 128+129 (hardware scripts) in disjoint areas.

## Update 2026-10-13 01:19 - row 39 (test camera, base) landed
- apps/capture-worker/test-fixtures/rtsp_test_camera.py (+ rtsp_test_camera_check.py): a stand-alone Python pull-side RTSP camera on loopback, Digest (MD5, no qop), RTP over TCP only, h264|hevc x sdp|inband; check 12/12 (ffprobe reads the stated codec at 1920x1080 25/1, 125/125 frames, 0 error lines; no account and wrong account -> 401 Digest-only). Port ruling C33. Five other driver decisions accepted.
- Still to add: row 40 (Basic-only challenge, first-keyframe delay, mid-group drop and resume, special-character account), row 152 (redirect, hostile descriptions). Request: a README fixture-table line -> the documentation rows at the close.

## Update 2026-10-13 01:27 - rows 175, 177 landed (needs-review -> remainder routed)
- Row 175 (BR-04): no av_log_set_level (a call is now a compile error by a poison line in worker.h); two worker log codes INGEST_ANNOUNCE_NOT_MATCHED (differing or repeated line) and INGEST_ANNOUNCE_NOT_SEEN (no line); log-hygiene fixture row175_log_hygiene.py 14/14 with 0 path text in any worker log; announce_test 187 checks; row58 12/12, row176 6/6 again. 6 driver decisions accepted (8-character element minimum; its 3-line edit of row58_gate.py).
- Row 177 (BR-06): worker 0.6.0 (worker.h:52, boot/checks.ts:285, worker README:138); the handshake prints capture-worker/0.6.0; library pins unchanged. Core pin tests 17 failed / 305 passed - EXPECTED red, owned as below.
- Integration pass I-4 (after I-3 reports; mechanical, sonnet): apps/core-server/test/support/capture-stub-worker.mjs:77 -> 0.6.0; fault-lifecycle.test.ts:415 and boot.test.ts:309 -> 0.7.0 (their "unknown newer version" literal); packages/shared/src/api/system.ts:97 -> 0.6.0, then openapi.json by the generator; add the missing test that the boot refuses exactly 0.5.0 (BR-06's open point).
- NEW ROW 182 (finding -> row; coder-execution, opus, S; single writer of packages/capture-protocol in its batch): protocol frame members CAMERA_ANNOUNCE_NOT_MATCHED, CAMERA_ANNOUNCE_NOT_SEEN and CAMERA_NO_PICTURE with the protocol version/pins they move, the worker sending them (then also the worker source: sequenced after any worker row in flight), the Core's forwarder mapping each to its capture fault and notice wording, tests on both sides. Launched with the relay batch, before row 142/178 (the permanent tests assert the frames).
- Requests: two check.sh static rules for the gate -> row 178.

## Update 2026-10-13 01:34 - I-3 landed; I-4 (version pins, sonnet) launched
- I-3: all eight items built; typecheck five workspaces exit 0; capture-session/adapters/core 425 passed; session-capture.db 59/59; fence test 5/5; core-web 56, mobile 12; host scripts 171 passed. One red left = row 177's stub version (tidy-fy.test.ts, 3 cases) -> I-4.
- Driver decisions judged: DD-1 captureIngestAddress(sessionId, trackId, chance) takes its random source as a PARAMETER because no crypto import is admitted under src/capture/ (G-R8, SR-1..4) - ACCEPTED, no static list edited; row 179 is handed a source (in its brief). DD-2 the fence test names helpers by listener port, not start order - ACCEPTED (a test statement, the fence source is untouched). DD-3 address composed from a scheme constant; DD-4 a draw that is not 16 bytes is refused - ACCEPTED. DD-5 95-database.sh not edited, the test counts 49 + 7 - ACCEPTED. DD-6 inline `operation === REAL_PRODUCTION` at the launcher line (capture/index.ts) - ACCEPTED, named for the code review at the close (one more reader of the operation outside the fence's single function: the review judges whether rule G-R15 wants it routed through the fence's function).

## Update 2026-10-13 01:37 - I-4 landed; suite run c03 launched
- I-4: stub worker 0.6.0; "unknown newer version" literals 0.7.0; system.ts example 0.6.0 and openapi.json regenerated; tidy-fy 13 passed, fault-lifecycle + boot 65 passed, protocol-pins/muxer-safety/system/ipc 122 passed, shared openapi 45 passed; typecheck clean.
- Deviation CONFIRMED: a worker stating exactly capture-worker/0.5.0 is refused with CAPTURE_WORKER_VERSION_MISMATCH (not _UNKNOWN); the new test asserts the code the Core really gives. BR-06's open point ("no test refuses exactly 0.5.0") is closed by it.
- Remaining 0.5.0 texts are not current-version pins (a history comment, a "-PROOF" control word, HELLO form examples in the protocol test): left.

## Update 2026-10-13 01:53 - suite run c03: 3 failures, each attributed; fix pass I-5 launched
- Green: typecheck 7 workspaces; lint (one warning); mock-core 19, capture-protocol 31, core-web 2373, transcriber 563, mobile exit 0; host helper 58; host scripts 171; make -C apps/capture-worker rc 0 (static rules, self-test, announce_test 187, build); secret-scan tests 5/5; tracked-tree scan at the baseline (camera-credential 54 in 34 files; ingest-secret 0).
- F1 core-server unit forwarder.test.ts:433 expects the 15000 ms window, gets 30000 -> attributed to I-3 item 2 (AD-11: production operation gets the production window). Ruling: the value is the designed one IF the test's configuration is the production operation; the test refers to the exported constant and gains a development case that still gets today's window.
- F2 shared api-stt-config.test.ts:308 schemas 171 -> 172 -> attributed to row 94 (a pin it missed). By delta.
- F3 database acceptance contract.test.ts:2074 SC6 coverage: startCaptureDiscovery 422 documented, no request produces it -> attributed to row 94 (contract leads the Core until row 96). Ruling: a NAMED deferral for row 96, in the form I-2 used (LANDED_UNROUTED), that fails if it outlives its row; the 422 stays in the contract; nothing is faked.
- Lint warning credential-reader.ts:204 (row 45/144) -> fixed in I-5.
- Untracked files hitting the scan: apps/capture-worker/test/announce_test.c (ingest-secret 3), scripts/hardware-acceptance/test_hw_collectors_host.sh (database-locator 2, camera-credential 1) -> judged by I-5 against C23 (synthetic placeholders in tests are allowed).

## Update 2026-10-13 01:58 - commit 6e6707dd (113 code files, 59 docs); batch 6 launched
- I-5 fixed the three reds of c03 (forwarder test now on the exported production constant with a development case; schema pin 172; named deferral LANDED_UNANSWERED for startCaptureDiscovery 422 until row 96, pinned by literal; lint clean). S1: both untracked scan hits are synthetic test placeholders (allowed by C23). Targeted re-runs green; no second full run (test depth rule).
- Batch 6 map and limits: delegation_progress/batch_6_brief.md. Held: 99 (schema set B: lands and is committed alone - C32), 182 (protocol members: after row 41, same worker build), 142/178 (after 182), 72/98 (web screens after the selector rows), 80/96/110 (static-capture after 65+66), 12 (E-8 playback: needs a booted Core and an emulator - at the M-gate's device session), 135.

## Update 2026-10-13 02:18 - rows 65, 66 (agent H) landed
- 65: adapters/audio/alsa-config.ts (pure generator) + alsa-config-writer.ts (the one file-system importer); static list per SR-1 entry 2. 66: Linux table added to adapters/local/mic-helper-args.ts, 34 new cases; G-R12 per SR-4 (1)-(3). All their cases pass; typecheck and lint clean.
- Driver decisions judged: "configuration key" read as ALSA_CONFIG_PATH, no new config.ts key - ACCEPTED (it is the one key the production door's closed environment admits). Card INDEX replaces the card id in the PCM name, the hw: line and the key (52000 + card x 32 + device) - ACCEPTED for AD-07 (no device text in the configuration); CONSEQUENCE recorded for the opener row (67/68) and the hardware check 9A/H-07: a card index is not stable across a re-plug, so the configuration is generated from a fresh listing at every session start and a card is re-identified by its stored identity (USB id, serial where present), never by the index. ipc_perm 0660 kept as tested; channel count from a closed table of 64; a pan selection in every list; pcm_s24le and 48000 fixed - ACCEPTED.
- Reds attributed: P25 (static.test.ts:508, :595), SEC35-41 (c) (:1040), A-5 (adapters static :278) -> row 70 / agent I in flight (new modules/capture-audio-cards and app.ts). Agent H refused to amend (SR-1/SR-4 do not admit them): correct. Agent I told to restructure, not to touch the rules.

## Update 2026-10-13 02:24 - row 40 (test camera fault modes) landed
- Switches (all opt-in): --challenge digest|basic|both, --first-keyframe-delay-ms, --first-keyframe-fill inter|none, --drop-after-frames, --drop-count, --drop-style fin|reset, --account plain|special. Fault suite 42/42, base check 12/12 unchanged. 7 driver decisions accepted.
- MEASURED, broadcast to agent E (relay, row 41): FFmpeg 9.0.2's client answers a Basic-only challenge with the account -> "Digest only" (S13-01) must be enforced by the relay itself before the library holds a credential; offered both, the library picks Digest; a colon in the user name cannot authenticate through a locator (a limit for the hardware procedure, row 181).

## Update 2026-10-13 02:27 - rows 179, 48 (agent G) landed; 48 sent back for C34/C35
- 179 (BR-07 (2)): the supervisor's restart sends fresh per-attempt elements; the session hands randomBytes in with `start`; a failed renewal is final (SPAWN_FAILED); cameras re-opened in REAL_PRODUCTION only - ACCEPTED. supervisor 67, session db 63. Deviation noted: its first capture/types.ts edit was an exact-text script, not the Edit tool (fourth occurrence across agents; diff reviewed at the commit).
- FINDING -> row 184 (to be cut by the task-architect at the next refinement): microphone helpers are never restarted for a later worker inside a session. Whether that is today's intended behaviour for development sources (the audio tap and the named pipes outlive a worker restart?) is unverified; for a production audio opener it must be decided before row 68/69.
- 48 (SA-3 pairing): ingest-pairing.ts + tests (unit 10, session db 70). Sent back to agent G for C34 (fail-closed in production) and C35 (missing camera = degraded start kept; unpaired/contradictory = integrity fault, capture ended).
- Requests: CameraSourceTarget.attempt (adapters/types.ts) and the production wiring of relayReports -> row 46; reds in row 70's module (static.test.ts:508, :595, :1040) -> agent I, told.

## Update 2026-10-13 02:28 - rows 150, 145, 155 (agent D) landed
- 150 (AD-04 (2)): modules/devices/status.ts handles an unassigned line; 54/54; positional names left 0. Driver decisions accepted (streamState unchanged for a track without a line; activeInputOf lost its hardware-slice parameter).
- 145 (AD-03 (2), (3)): the reader returns a credential only after the COMMIT of its audit entry is acknowledged; signature change sessionOpen(deviceId, sessionId) / relayRestart(deviceId, sessionId) - the session is required and written to the audit row's session_id (ACCEPTED: callers pass the plan's session - row 46, 179's re-open path; told). Unit+static 33, database 21. Three database runs instead of the allowed two (its test helper failed twice) - noted. FINDING recorded for the closing security review (row 119/86), not a new row: a unit the watchdog abandons mid-COMMIT can still commit for a few milliseconds - safe for the reader (no value is returned), and an existing property of the pipeline.
- 155 (AD-07 (1)): one function cardListingText(kind, raw) + a field table that does not compile if a string member lacks a kind; it CLOSED a real gap: parseCaptureDeviceList was returning the card name raw. 51/51; capture static 199 with the lists untouched.
- Reds attributed: packages/shared/src/sim/api.ts:717,727,732 -> agent A in flight; capture-config/__tests__/routes.test.ts:59 -> row 70 / agent I in flight.

## Update 2026-10-13 02:32 - rows 31, 167, 168 (agent B) and row 70 (agent I) landed
- B: web selector (47), pre-check (72), meter readers (584 in 45 files); tsc clean; micInputOfChannel left in apps/core-web/src: 0; no PENDING-SHARED constant. Driver decisions accepted (unassign = the option "Not assigned" plus Save; no toggle without a standby; the meter drops its level when its input leaves; one pin 'MIC-01' -> null). One scripted replace admitted (fifth occurrence).
- I (row 70): restructured after the static-rule message with NO rule amended: modules/capture-inputs/audio-cards/ mounted from capture-inputs/index.ts; enumerator and registrar injected. routes.db 17, acceptance contract + rbac-matrix 78 with the deferral LANDED_UNROUTED REMOVED (C31's condition met). DD-1..DD-9 accepted.
- OPEN, product-blocking -> row 185 (to be cut by the task-architect): no registrar for a microphone's registry row exists in the product (no engine action adds a MIC device), so operation 99 answers 503 on every Core today; the registration unit is proven with a stand-in registrar only. Also row 85 hands in the enumerator (composition).
- Red attributed: test/static/search-path.test.ts:94 names adapters/audio/alsa-config-writer.ts -> row 65 (agent H, landed): the same "exact list of places" rule that row 19 met - fixed in the next fix pass by rewording or, if the file legitimately is a new place, by the amendment the rule's own text allows (decided there, not by editing the list blindly).

## Update 2026-10-13 02:34 - rows 162, 163, 165 (agent A, packages/shared) landed; row 29 launched
- 162: hosted action setCaptureConfig rewritten (sites C9-C12; C13 index-free), 80 + 598 passed. 163: session machine and start rule (C1, C2, C4, C5, C7), four required slots, 1900 passed in 67 shared simulator suites, the 15 existing suites unchanged. 165: simulator answers (C17, C23, C24, C25), 1912 passed; openapi "unchanged ... 99 operations"; core-web 274, mobile 57; typecheck clean in all five apps. micInputOfChannel left in the five shared files: 0.
- Seam still in place for row 149: PENDING-ROW-28-SEAM (without a PRIMARY the state's activeInputId keeps its held input). 8 request lines -> rows 29, 30/33, 149, 150 as listed.
- Row 29 (Core capture-config: boot on a NULL slot, unassign really performed) launched - it ends the interim state.

## Update 2026-10-13 02:35 - row 48 complete against the interface (C34, C35 applied)
- ingest-pairing.ts: an absent camera is no fault (D72(k) degraded start kept, its tests unedited); an unpaired / contradictory arrival is one CRITICAL CAPTURE_FAULT alert + one FAULT_RAISED audit row (existing types); a REAL_PRODUCTION start without a relay report source is refused 409 SOURCE_KIND_NOT_RECORDABLE, cause RELAY_REPORTS_NOT_WIRED, read through the existing operationOf port. Session+supervisor unit 101, session db 75.
- Four existing production-port test cases now pass a never-reporting source (otherwise C34 refuses them): accepted - they test other things and say so.
- NOT RE-RUN after its last move: the fence and notices database files (they passed in the run before the C34 check was moved behind the class rule) -> covered by the next full run; named there.
- C37 recorded (a report for a superseded attempt is dropped, not a fault) -> rows 43/44/46.
- Requests: operator sentences for RELAY_REPORTS_NOT_WIRED and CAMERA_INGEST_NOT_PAIRED (shared i18n) -> next shared pass; CameraSourceTarget.attempt and the production wiring of relayReports -> row 46.

## Update 2026-10-13 02:51 - rows 32, 169, 170, 171 (agent C), 41 (agent E), 29 landed
- C (mobile): selector (450), pre-check (427, three local names behind PENDING-SHARED -> swap to shared N7/N8/N12 in the next integration pass), live-session readers (245), meter readers (768 + 677); tsc and eslint clean; micInputOfChannel left in apps/mobile/src: 0. 21 driver decisions accepted as recorded (standby lost its "other line"; no toggle with an incomplete pair; existing empty states for absent inputs).
- E (row 41, relay record mode): CANDIDATE only - decision C38 (own RTSP client is the user's to rule). ROW41 RELAY 28/28; relay_unit_test 79; worker rules and unit checks unchanged; row58 12/12, row176 6/6. Its other driver decisions (start-message member names - row 46 writes this form; locator host IPv4 only; time mapped from the first forwarded picture) provisional with it. Security review of the client ordered: verification/06_security_relay_client.md.
- 29 (Core capture-config): the interim state is ENDED - operation 78 stores NULL, answers without the line, writes one audit row; six NULLs boot in SIMULATED, REAL_DEVELOPMENT and REAL_PRODUCTION; fence files and plan.ts unedited (empty diff); database 25, fence+boot database 20. AD-10 (1)-(5) done; plan.ts refuses all 15 incomplete selectors (C25). Driver decisions: one line removed from the existing D133 database case (a single mic line by role is valid since C21 (8)) - ACCEPTED; "an empty-slot camera keeps the action's default profile" - NOT accepted as final: it contradicts C36 (1) for the Core (no default profile may stand in for the stream's statement) -> requirement for row 46/50 and named for the M2 code review; until then no production camera can be opened anyway (class C).
- Requests of row 29 (slotColumn seam removal, the unassign request example) -> integration pass I-6.
- Known reds carried to the next fix pass: capture-config/__tests__/routes.test.ts:62 (two new routes of row 70 not in its expected list), test/static/search-path.test.ts:94 (alsa-config-writer.ts, row 65).

## Update 2026-10-13 04:47 - row 186 (relay client hardening) landed; I-6 and row 182 launched
- 186: High 2/2, Medium 6/6, Low 5/8 closed (left: L-4 fails closed / parser extension, L-6 Linux-only, L-8 text search by nature). relay_unit_test 376 checks, 34 of 34 malformed-input cases, plain and ASan+UBSan; relay_fuzz in every build: 1,311,680 inputs in 14 s, 0 failures; one-off 28,113,728 inputs in 370 s: ONE CRASH FOUND (signed overflow on a Transport channel number, present since row 41) - fixed, regression case added; 16 of 16 planted flaws found. ROW186 BOUNDS 23/23: one answer 5.0 s, DESCRIBE..PLAY 15.0 s, first keyframe 60.0 s, playing without a complete picture 5.0 s, stdin close or SIGTERM during flood/trickle 0.003-0.045 s, reassembly ends at 8 MiB. Rows 41/58/176/175 fixtures all PASS; camera double base 12/12, faults 42/42 (new opt-in --adversary).
- Its 12 driver decisions are PROVISIONAL with candidate (a) (C38/C39); three named for the user's/hardware attention: a non-stale 401 on a keep-alive ends the leg (interoperability risk with real cameras), the idle bound counts complete pictures, a time step over 10 s ahead ends with STREAM_INVALID.
- The agent took 109 minutes and held the heavy-host lock for long stretches: rows 128+129 and the experiment agent J were waiting behind it (both still alive; status messages queued).
- Now: row 182 (protocol members for the gate's refusal codes; single writer of packages/capture-protocol and the worker source) and integration pass I-6 (apps/core-server non-capture, apps/mobile, packages/shared wording).

## Update 2026-10-13 05:06 - integration pass I-6 landed, no red left in its area
- Reds closed: search-path.test.ts:94 (the local name in alsa-config-writer.ts is now `staging`; the test's list untouched); capture-config routes.test.ts (operations 98, 99 listed under OTHER_UNITS, where the test's own structure puts another module's routes).
- Mobile PENDING-SHARED names swapped for the shared members; the server seams removed where they were pure type changes (db/schema/capture.ts slotColumn, rows.ts StoredSelectorSlots); the unassign request example added, openapi.json regenerated once by the generator; operator sentences for RELAY_REPORTS_NOT_WIRED, CAMERA_INGEST_NOT_PAIRED and (ahead of a request) row 182's three members in packages/shared/src/sim/capture-fault-wording.ts.
- Fence (2 files) and capture-notices (1) database files that row 48 had not re-run: in the 6-file database run, 73 passed, 0 databases left (no per-file line printed by the runner).
- Driver decisions: (1) three TEXT pins of rule G-R2 in capture/__tests__/static.test.ts follow the rename to `staging`, no list entry changed - CONFIRMED (a pin of the quoted source text, not an allowlist entry). (2) unassignedPrecheckSlotOf deleted; mobile requires BLOCK or WARN like the shared recogniser - accepted. (3), (4) accepted. One server run over the two-run rule (third run of one file) - noted. No scripted edit (stated).
- Left for row 182: oxlint warning capture-session/index.ts:145 (unused CaptureWarningReason). No caller of the credential reader exists yet (rows 46, 50, 85).

## Update 2026-10-13 05:13 - row 182 (protocol members) landed; suite run c04 launched
- packages/capture-protocol: CAMERA_ANNOUNCE_NOT_MATCHED, CAMERA_ANNOUNCE_NOT_SEEN, CAMERA_NO_PICTURE (no version move: protocol 4, worker 0.6.0 - a reason is additive by the package's rule; counts: end reasons 3 -> 6). Worker sends them; forwarder maps them (C40). Fixtures: row58 12/12, row176 6/6, row175 14/14 with 0 path text in logs AND frames, row041 28/28; protocol tests 31; Core unit 330 in 14 files; session db 80.
- Requests: one check.sh rule -> row 178; frame assertions -> rows 142 / 178 / 59.
