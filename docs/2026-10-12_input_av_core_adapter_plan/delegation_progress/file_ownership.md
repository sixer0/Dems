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

## Update 2026-10-13 05:31 - suite run c04 ALL GREEN; commit 3b388746 (140 code files, 63 docs); rows 10, 22 landed
- c04: typecheck 7 workspaces, lint 0 warnings; core-server 7239, mock-core 19, capture-protocol 31, shared 2783, core-web 2404, transcriber 563, mobile 3220 (281 suites); test:db 2594 passed / 7 skipped on throw-away databases, 0 left; host helper 58; host scripts 171; worker make rc 0 with the relay's 376 checks (34/34) plain and under sanitizers and a fuzz run of 1,249,344 inputs, 0 failures; secret-scan tests 5/5. Tracked camera-credential 54 in 34 files (unchanged). The one new ingest-secret hit (capture/__tests__/supervisor.test.ts) looked at by the controller: synthetic test literals (a 16-byte fill pattern; a planted "a-secret-the-receiver-put-in-its-error" for the error-wording test) - allowed by C23. Baseline for ingest-secret in tests is now 4 (announce_test.c 3 + this 1), 0 outside tests.
- Row 10 (E-10, 21 runs): pause and resume on ONE connection -> one file with a gap, 0 decode errors (9/9); a resume in the middle of a group is written as it comes and 30 of 30 pictures up to the next keyframe are wrong while the decoder stays silent (12/12) -> the relay's keyframe gate after every re-open is REQUIRED (F10); a second connection to the same address inside the window is refused at TCP, the first file is kept clean (6/6) -> a re-opened push needs a fresh attempt (row 179 provides it). Row 14 writes the verdict on WP-11.
- Row 22 (E-7 without a guard, 129 runs, macOS, system ffmpeg): the FFmpeg helper does NOT end when its standard input ends (0 of 24) and SURVIVES a SIGKILL of its parent while its consumer is alive (30/30; 12/12 with /dev/null) -> the guard program of the process door is REQUIRED (rows 23, 25); with the consumer gone too it ends in 0.05-0.11 s (24/24).
- Agent J noted its new files showed as staged without its doing: the commit agent's `git add` of the docs folder and test-fixtures ran at that moment - they are in 3b388746.

## Batch 7 (2026-10-13 05:32) launched - map and limits in delegation_progress/batch_7_brief.md
Held: 99 (schema set B: lands and is committed ALONE at the next quiet point - C32; it gates only the network functions of M10), 96 and 110 (static-capture after row 80), 72 and 98 (web screens, after the shared hot files are free), 12 (E-8 playback half: needs a booted Core and an emulator -> the device session at the M-gate; rows 14, 15, 16 follow it), 34 (conditional on row 14's verdict: E-10 shows a resumed push on ONE connection is written as one file with a gap and a re-opened push is refused at TCP - with the relay holding its push connection and fresh attempts from row 179, WP-11 may not be needed), 43, 44 (relay retry and report, after row 42), 135, 181.
A blueprint refresh by the task-architect runs alongside: rows 180, 181, 182, 186 recorded as done/added; new rows 184 (microphone helpers on a worker restart) and 185 (a registrar that adds a MIC device to the registry) cut; conditionals marked by their recorded outcomes.

## Update 2026-10-13 05:35 - rows 128, 129 (hardware acceptance scripts) landed
- scripts/hardware-acceptance/: hw-collect-lib.sh; 12 collectors of chapter 2 and 14 of chapter 3 (9A/H-20 has no script step); record-line.sh; e11b-announce-probe/ (probe.c, SHA-256 equal to the appendix of test/007, with the host build line, the BR-10 repeat and the E-11 near misses); three test scripts: host group 637 passed, camera group 535 passed, record writer 27 lines for 27 checks. shellcheck not installed on this Mac: not run. Nothing proven on a host.
- Driver decisions accepted: no sudo and no sign-in to the Core in any collector - privileged and console-only readings are handed over by the user as files (--journal-file, --audit-file); exit 5 = collected with a reading missing; HWA_TEST_DIR test seam marked in the output.
- For row 181 (procedure pass): `make e2e` still has no pusher on the host; no chapter says how the user gets the audit list or a readable track as a file; the camera-path log codes the collectors search for are ASSUMED until rows 43/44/46 land; collect-h18.sh assumes the track starts at the start click.
- These files are uncommitted (they were in flight at 3b388746): staged with the next commit.

## Update 2026-10-13 05:48 - row 80 (host boot checks) landed, NOT WIRED
- New capture/boot/host-checks.ts; checks.ts gained step 4d with an optional deps.host (additive; existing boot tests unchanged). 13 checks, all CAPTURE_HOST_*, REAL_PRODUCTION only; off Linux a warning CAPTURE_HOST_PROFILE_NOT_ASKED, not a refusal. 196 passed in its four files.
- SR-1 decision (C17's open point, for row 80): NOT extended - the command runner is injected and only the fake sits in the capture area. Accepted; the same answer is expected of row 105.
- NOT WIRED: capture/boot/index.ts is outside row 80's area, so no production start runs a host check until row 81 (the other row the blueprint allows in the fence's boot files) applies the request. Named for the M5 gate.
- Driver decisions accepted: the four own-process checks run on every platform (a wired production start on this Mac needs the core-file limit 0 and both program keys); HOST-29/36/38 added, HOST-39/42/32/24/34 not built (listed for row 81 / the profile).
- Reds attributed, both in flight: adapters/__tests__/static.test.ts:126 (A-2) -> agent Y (row 46); usb-audio-production.ts:600 TS2741 -> agent Z (row 67).

## Update 2026-10-13 05:57 - rows 71, 30, 158 (agent S) landed
- 71 (session source facts): built in capture/fence/sources.ts and fence/index.ts (the row's Ownership Area allows "the fence's" place; these are NOT the three restricted fence files boot.ts / operation.ts / checks.ts) plus capture-session statements and index. fence+static 158, session db 83. Driver decisions accepted: an over-long product name becomes UNKNOWN, not cut; eighth key sampleRate; the builder sits in the fence because rule A-5 bars cardListingText from the session folder; a fact never refuses a start. NAMED for the security review at the M4 gate: two fence files gained code. OPEN: the production microphone adapter (row 67, in flight) does not implement sourceFacts(inputId) yet, so USB_AUDIO rows store {} with one warning each - told to agent Z's follow-up; adapters/types.ts should declare the optional member (next pass).
- 30 (tests only): precheck-unassigned.db.test.ts, 8 passed; precheck.ts needs no change (empty diff) - C18 (1), C25, C21 (6) closed.
- 158 (tests only): +6 cases, 31 passed. The race: the first engine unit wins; a losing unassign gets 409 with 0 rows; a losing SESSION OPEN proceeds without the slot - to be read with C25 by the M2 code review: opening a session is not starting a capture, and the real-capture START is refused by the plan builder for an incomplete selector (row 29's 15 cases); the review confirms no path records with the slot missing.

## Update 2026-10-13 05:57 - row 67 (production microphone adapter) landed, on doubles
- New adapters/audio/usb-audio-production.ts (+ test, 33 passed; audio folder and static files 246 passed on the second run; tsc and oxlint clean). The stub stays the registered adapter; no existing source or static list edited. Row 71's sourceFacts request is served.
- DD-1..DD-10 accepted; product-affecting ones named for the hardware procedure (row 181): `start` refuses a card that moved since `open`; a card without 48 kHz is refused; two cards with one USB id are refused.
- For row 184: a handle starts once and the adapter never restarts a helper; a later worker is fed only by close() -> open() -> start(), which re-identifies the card, rewrites the configuration and remakes the pipe at the same path.
- FINDING -> new row 192 (database-specialist + coder, with schema set B's writer so that the schema is moved once): the stored row capture_audio_inputs has NO port path and NO serial, so a same-model card swapped in matches silently - exactly the silent soundcard swap input-av's handover recorded (SERAH-TERIMA item 15). The row adds the stored USB serial (where the device has one) and the bus/port path, registration stores them, the adapter matches by serial, else by port path, and a same-model card on another port is REFUSED with a named code until the technician registers it.
- Open point OP-1 (first samples after opening a card: the full-scale sample input-av saw twice) stays for hardware check 9A/H-08.7.
- Requests: a "built, not registered" static constant (agent Y's list) and one G-R12 assertion (agent B's list) -> next integration pass; the guard's invocation form is ASSUMED until agent W's row 23 lands - reconciled in that pass.

## Update 2026-10-13 06:12 - row 46 (production camera adapter) landed, proven at adapter level on doubles; registered nowhere
- New adapters/camera/onvif-relay.ts and relay-start.ts (+ tests), a database-backed adapter test camera-adapter-open.db.test.ts, a listener fixture row046_adapter_listener.py. Changed on the controller's routing: adapters/credential.ts (the query rule at the injection point - row 174's blocking note closed), camera/onvif-session.ts, adapters/types.ts (CameraSourceTarget.sessionId and .attempt, optional), the static-adapters list (new rule A-9 serving row 67's "built, not registered" request).
- T-2, the first END-TO-END CHAIN on doubles: test camera (pull, Digest) -> the real relay binary -> the real worker with the announce gate -> a file, with the credential from a throw-away database through the reader: 10 passed in three runs; H.264 105 pictures, HEVC 100, 0 decode errors; 20 open/close cycles, 0 relays left; 0 leaks in logs, errors, argv, env. Unit 185 in 7 files; tsc and lint clean.
- Identifiers done: P12-B2 (the credential read path), P12-F01, P12-F05 (a), F03, AD-02 (2), AD-03 (1)(6), AD-08, BR-07 (3)(4), S13-01, C36 (no profile -> refused). Left to named rows: AD-02 (1) -> 143; AD-05 (1), AD-09 (3), S13-02 (g) -> 44; C34/BR-08 wiring -> 85/88; C35, C37, C40 session half -> 43/44/188; testConnection and the codec read -> 50; presence -> 49.
- 16 driver decisions accepted as recorded (the T-2 file sits in the capture-config test folder by rule R-6; one own new file moved with mv). Its refusal of row 71's types.ts request (needs the fence files) stands: -> next integration pass with agent S's context.
- Red attributed: apps/core-server/test/static/guard-family.test.ts:65 -> agent W (rows 23/142, in flight).
- The relay client it drives is still CANDIDATE (C38).

## Update 2026-10-13 08:29 - network outage: agents W and R/T/X ended with "API unreachable"; both RESUMED (transient error, one retry)
- On disk at the cut: R/T/X had finished rows 172, 149, 97, 156 (records and notes exist); row 152 was mid-run. W had finished row 23; row 42 had its record but no note (in progress); row 142 not started.
- Both resumed from their transcripts with the instruction to make the tree consistent first (W: `make -C apps/capture-worker` rc 0 before continuing).
- No full run and no commit until both report.

## Update 2026-10-13 08:39 - agent R/T/X reported after its resume: rows 172, 149, 152 complete; 97, 156 needs-review
- 172: micInputOfChannel deleted from packages/shared (search: 0 lines), a static block keeps it out. 149: WP-13a CLOSED - the reader inventory as a test (5 / 31 / 24, unaccounted 0), the seam AudioSliceInState and both markers removed, channelOfMicLine narrowed, the 'MIC-01' literal gone; six typechecks exit 0; shared 1505, web 261, mobile 391. openapi.json unchanged (the wire type was already nullable). otherMicInput lives only in web and mobile -> requested for the next pass.
- 152: test camera hostile modes (--second-port, --redirect, --sdp-control, --sdp-codec); hostile suite 12/12; the EXISTING relay refuses all: redirect (exit 25), both foreign control addresses (26), a 300-character codec name (28) - 14 PASS, 0 FINDING; base 12/12, faults 42/42.
- 97 needs-review: the contract has NO re-address operation and nothing can change a registered device's address in the replicated registry; it built capture-discovery/readdress.ts behind seams with a static rule (never automatic), on doubles (31 passed). -> rows for the task-architect: the contract operation (shared, an operation pin move 99 -> 100), the engine door that changes a registered device's address, and the wiring. DD-1..DD-7 accepted as provisional with that.
- 156 needs-review: per-minute bound on the listing gate; matchStoredCard (USB id, then port). Gap = the same as row 67's finding: capture_audio_inputs has no port column, so a same-product card alone on another port is re-enabled silently -> row 192 (with schema set B). Ruling asked on per-session bounds -> left as the per-minute bound until a hardware observation says otherwise.

## Batch 8 (2026-10-13 08:40) - launched at full width on U15 (map: delegation_progress/batch_8_brief.md)
Rows 49, 110, 96, 68, 81, 188, 185, 190, 187, 33, 99, 100 (+192), 72, 98, 12, 25, 69, 184, 78, 135 in 12 agents; agent W (42, 142) still in flight from batch 7. Schema set B (row 99) runs in parallel now by the user's instruction for speed: C32's "committed alone" is kept by STAGING its paths alone at the commit if they separate cleanly; if its pin moves share files with other rows, that is recorded as a deviation again rather than hidden.
Uncommitted and landed since 3b388746: rows 23, 30, 46, 67, 71, 80, 97, 149, 152, 156, 158, 172, 128, 129.

## Update 2026-10-13 09:05 - rows 72, 98 (agent U), 78, 135 (agent C/I) landed
- 72: Devices page "Sound cards" block (audio-cards.ts, audio-cards-panel.tsx); 175 tests; common.captureAudioCards. 98 needs-review: the typed address on the search is built (181 tests); the re-address confirmation dialog is NOT built - it waits for the contract operation row 97 proposed (confirmCaptureDeviceAddress) -> rows to cut. i18n served: NOT_H264 strings ("Neither H.264 nor HEVC"), two refusal sentences. Unproven: no test runs the Live calls against a Core; screens not seen in a browser (M-gate device session).
- 78 needs-review - FIRST CONTACT WITH LINUX: the container runtime was already running (colima, another project's containers; nothing started or stopped); image dems/capture-linux-check:ubuntu-24.04-ffmpeg-9.0.2 built locally (FFmpeg 9.0.2 self-built with pinned archive checksum and release-key signature: libavformat 63.1.102 = the worker's pin; Ubuntu's packages are 6.1.1); build context 124 files, 0 under apps/input-av. Inside it the relay and the guard BUILD; the WORKER DOES NOT: L-1 Makefile:47 -std=c11 without a feature-test macro (22 compile errors); L-2 check.sh:259 a Mach-O label `_creat` fails to link (self-test fails); L-3 pinned_calls.py:326-330 keeps @GLIBC suffixes and calls all six pins stale; L-4 writer_test.c expects F_FULLFSYNC where Linux states FSYNC (5 checks); L-5 relay_unit_test.c:1053-1062 socket pair too small (abort 134; relay-unit and relay-asan fail). -> NEW ROW 193 (coder-execution, single writer of the worker source after agent W2): the worker, its static rules, its unit checks and the relay tests build and pass in the container with the macOS results unchanged. Rows 79 and 141 (and the branch-B gate BR-10 on the Linux library) wait for it.
- 135: scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md - written BEFORE U19; its two stated limits (no production signing key command; no password tool) are being closed in this task now -> the note is revised by the X-D documentation package.

## Update 2026-10-13 09:05 - rows 33 (agent V), 185, 190 (agent G) landed
- 33 (tests only): fence.test.ts +30, fence.db.test.ts +26; unit 99, database 41 of 42 - the one red is the schema pin [7,'dbc-8'] at fence.db.test.ts:114, now [8,'dbc-9'] since agent D's set B (in flight) -> I-7 by delta. Three database runs (its own restart case failed twice). C43 (1).
- 185: INTERNAL action registerCaptureMicrophone (next free MIC-NN, class MIC, adapter USB_AUDIO fixed by the action; an id re-enables); action count 49 -> 50; simulator answers unchanged; 179 + 1455 passed; six typechecks clean.
- 190 needs-review: audio-cards/registrar.ts and the engine wiring; the 503 "no registrar" is gone; operation 99 still answers 503 WITHOUT an enumerator until the composition (row 85). Routes on the real registrar 16 of 17 (the red = the same schema pin at routes.db.test.ts:159 -> I-7). C43 (2), (3). Serial/port path go into cardIdentityValuesOf (audio-cards/store.ts) plus two statements - the hook for row 192's columns.
- Reds seen in others' files, to attribute at the next targeted run: test/static/log-calls.test.ts:163, test/static/search-path.test.ts:94, adapters/__tests__/static.test.ts:313.

## Update 2026-10-13 09:10 - row 12 (E-8 playback half) landed as needs-review; row 14 (verdict) launched
- A sealed DEVELOPMENT session from a generated HEVC source: SEALS and VERIFIES (SES-20261013-0024, V-01..V-15 PASS, the receiver's command PASS); manifest codec HEVC, profile HEVC_720P, no rate, sample entry hev1; the web console PLAYS both files (Chrome 154 headless, macOS); the export decodes (ffprobe hevc Main hev1, 336 frames; ffmpeg exit 0). STREAM_PROFILE_DIFFERS was raised because the generated development source's configured code is rewritten to H264_720P30 at each development boot while the stream is HEVC - a property of the development source. One measurement: macOS QuickLook did not return for hev1 and opened an hvc1 copy at once. "H.264" never on screen; "H264" only as the configured profile inside the notice sentence.
- NOT RUN: the tablet (both running emulators hold the user's pairing and tcp:4420 rule for lanes 1-2; phone2 is down); the live monitor during recording; a browser without HEVC; lane 3 (its database is at schema 6 and the lane reset refuses it - it used a throw-away database with a listener on 4423 instead: accepted).
- Driver decisions accepted: the throw-away instance; ingest ports moved to 8559/8561 by a module replacement in its runner. Noted: one heavy-host hold of about five minutes by a hung qlmanage with three agents waiting.
- Left on disk: about 59 MB under .cache/task4-row012/ including three data directories with DEVELOPMENT keys (git-ignored; removed at the close).

## Update 2026-10-13 09:33 - rows 49, 110, 96 (agent SC) landed; 49 and 96 needs-review
- 49: camera/camera-watch.ts (loss callback: 1 fault raised, 1 cleared; presence; clock offset through an optional `clock` -> ntpOffsetMs on onvif-relay.ts); 44 passed. NOT BUILT: presence by TCP (no permitted place under the static rules - accepted as not built; presence is by the ONVIF time read); the ONVIF TIME-READ FACADE the watch needs lives in camera/onvif-session.ts (agent T2's file in this batch) -> a small follow-up row after T2 lands, BLOCKING for row 85's presence and clock. Driver decision accepted: presence raises no fault (C35/C40).
- 110: camera/onvif-network.ts (the four ONVIF calls with guards; http: only; five wire requests for four calls because of the package's own gateway read-back - recorded), static list per SR-3; 92 passed. No real camera contacted.
- 96: the typed-address unicast probe in the one datagram file (SR-2; the existing G-R9 send pin changed under SR-2 - noted for the M8 code review), search and route wired, the named deferral LANDED_UNANSWERED REMOVED (contract.test.ts 39 passed with a real request producing the 422). needs-review: a production Core REFUSES every typed address until the destination rule is handed host facts (the camera interface and subnet of capture_network_config - schema set B, row 108) -> a wiring row; until then the typed address works in tests only. Not run: the 403 for a paired session sending `address` (pinned statically) -> a test in the M8 gate.
- Static requests: row 67's G-R12 assertion served; rows 71 and 81 offers refused (not SR-1..SR-4) - stands.

## Update 2026-10-13 09:33 - rows 68, 187 complete; 81, 188 needs-review (agent K/P/N)
- 68: adapters/audio/mic-loss.ts (reuses CAPTURE_FAULT / MIC_DISCONNECTED; a card returning while a dead helper's handle is held does not clear the fault); 22 passed, 269 with the static and audio files. Request: an A-9 list entry -> I-7.
- 187 (C36 (1) closed): operation 78 refuses a production camera without its own profile - reasons CAMERA_PROFILE_NOT_STATED, CAMERA_PROFILE_NOT_OF_DEVICE; static rule R-7; unit 119, database 65. Requests: i18n sentences; clients send no profile yet (web/mobile selector rows follow-up).
- 81 needs-review: capture/boot/program-checks.ts, step 4e added to checks.ts additively, boot/index.ts wired; 249 + fence 197 + database 47. NOT BUILT: the entry point does not hand in host facts, so no real start runs the checks -> C46 (fail-closed at the real entry; explicit test hosts in the suites), with row 85.
- 188 needs-review: a superseded relay report is dropped (C37 closed); one ACTIVE critical notice for the operator (C40 (2)); NOT MET: "1 audit entry" - three fault rows are written when a gate refusal and a pairing end stem from one event; it needs a veto in the forwarder -> a small follow-up row (forwarder, single writer).

## Update 2026-10-13 09:41 - rows 25, 69, 184 (agent H) landed
- 25 (E-7 final, macOS): started through the production door and the parent SIGKILLed - guard + FFmpeg (the four forms of row 22): 0 survivors of 12, gone within 49.8 ms; the relay: 0 of 3, within 29.6 ms; control WITHOUT the guard: 6 of 6 survive (never gone in 8 s). Real: door, guard, relay, FFmpeg; stand-ins: the Core (a node process holding only the door), sources, consumers.
- 69 (T-2 audio on macOS): pipe, inputs 3, 6, 1: 386,048 of 386,048 samples equal per microphone; the release worker accepts the plan and records the selected tone 15 of 15 s, no rate-limit warning (largest 1,663 ppm). Real: the production adapter's selection and output line, door, guard, FFmpeg, pipe, worker; stand-ins: the 12 ALSA input arguments (built, not run), a lavfi source, the card listing. ALSA itself: 9A/H-07, H-08.
- 184 (microphones across a worker restart, development sources, measured): the helpers end by themselves in 20-56 ms and the pipes stay (16/16); a later worker exists only before the first durable fragment (6/6; none after, 4/4); the later worker gets 0 samples and 0 of 246 level frames per microphone (6/6): CAMERAS are fed again, MICROPHONES are not - 9.5 s of SILENCE (3/3); with the helpers started again there is sound from the first 100 ms (3/3). -> row 191 RUNS (its condition is met): helpers started again per attempt (close -> open -> start, earlier handles closed first), pipes re-made before the later worker gets its plan, loss reports of the superseded attempt dropped. Constraint found: the supervisor relaunches after 250 ms through a SYNCHRONOUS hook, so row 191 cannot await a close-and-open there - a design point for that row.
- FINDING beside the row -> a diagnosis row (to cut): the SEAL of the interrupted session failed with WRITE_FAILED in 3 of 4 runs, cause undetermined (its runs mocked the ingest ports to 8559/8561 and killed the worker mid-session). It may be an artefact of the instrument or a defect of the existing seal path after a worker kill (task-3 code): measured before anything is concluded.

## Update 2026-10-13 09:45 - rows 50, 51 complete, 53 needs-review (agent T2)
- 50 (AM-2: the codec is judged from the STREAM): camera/stream-probe.ts; the relay in probe mode through the production door after the ONVIF test. With the REAL relay and the test camera: ONVIF says H264 + the stream is HEVC -> REACHABLE with HEVC_1080P; an H.264 stream -> H264_1080P25; a Basic-only camera -> SCHEME_NOT_ALLOWED with auth_basic 0; a hostile codec name -> NOT_H264. Door double 29, real relay 10 of 10 (its first run 9 of 10: its own criterion). Closed AM-2, AD-06 (1)(2)(3)(5), S13-04 (d).
- 51: adoption stores the minted code and the stream rows; connect.db.test.ts:400 now expects ['H264_1080P25']; 24 + 16 passed (five runs of one file - over the rule, its own test). The CHECK on capture_devices.profiles is NOT generated: the statement and a data step for existing token lists are requested of the db writer (agent D, migration 0019) -> with set B's follow-up.
- 53 needs-review: operations 44, 46, 47 state HEVC with fps null in real capture; the replicated `cameras` slice is NOT filled - it needs an engine fact door (engine/host.ts) -> a follow-up row. Unit 357, database 50.
- Driver decisions: no stream half without a credential AND a configured relay program - such an adoption stores [] where the token stood before (NOTE for the real-device row 232: the instance must have DEMS_CAPTURE_RELAY set to the built relay, or the connection test will not read the stream); slice facts are read from the stored code; host faults answer UNREACHABLE. Accepted.
- Requests: capture_device_streams is not kept by a demo reset (the reset row); two lenses with ONE code cannot both be stored (dual-lens cameras: a schema/selector question -> finding for the task-architect); row 49's time read not built (the follow-up already noted).
- Rows 50 and 51 are the dependencies of the real-device observation (M12, row 233): next = I-7, a full run, the commit, then row 232.

## Update 2026-10-13 09:46 - rows 99, 192, 100 (agent D, schema set B) landed as needs-review; integration pass I-7 launched
- 99: capture_network_config (interface nullable, no default; input-av's defaults carried, untested on hardware) and host_network_aliases (one open alias); migrations 0017 (generated) and 0018 (hand-written); version 7 -> 8, dbc-9; 47 tables, 484 columns, 217 CHECKs, 19 migration files. Its new test caught a REAL defect in its own CHECK (the factory list stored a nested list) - fixed in 0017 and the snapshots before any commit. No step on the demo database (C29). A demo reset does not yet keep the two tables (the reset row).
- 192: usb_serial and usb_port exist on capture_audio_inputs, constrained and granted; NOTHING writes or reads them yet - the silent same-model match still stands until rows 199 and 200.
- 100: permission CAPTURE_COMMISSION, TECHNICIAN only; permissions 14 -> 15, grants 22 -> 23; no operation enforces it until row 102 (three named deferrals).
- Server unit 1229, test/db 390, row-100 database and acceptance 55, shared 45, web 130, mobile 124; five typechecks clean.
- COMMIT: the agent states the three rows must be ONE commit (migration 0018 writes the permission rows and the boot refuses a mismatch) and gives lists (a) files only it touched and (b) shared pin files. C32's "set B alone" is kept as: one commit for rows 99 + 192 + 100 with list (a), and list (b) pins go with it where they are set-B pins only; if (b) files also carry other rows' edits, the deviation is recorded.
- T2's CHECK on capture_devices.profiles takes migration 0019 with a data step for existing token lists - a db row to schedule (after this commit).

## Update 2026-10-13 10:04 - rows 43, 153, 178 (agent W2) landed; row 193 (worker on Linux) launched
- 43 (relay re-open): keeps its ONE push while it re-opens the camera (waits 2, 2, 4, 8, 16, 30 s; 6 tries per loss), gates on a keyframe after every re-open, reports camera_lost / camera_reopened (numbers and the attempt only). ROW43 REOPEN 11/11; the gate proven as the controller corrected: sync-sample-first plus picture-by-picture comparison - 76 of 76 equal after the gap; NEGATIVE CONTROL without the gate: 0 of 76 equal WITH 0 decode errors (the fault a decode-error check could not see). Unit checks 918.
- 153 (relay confinement, portable part): RLIMIT_FSIZE 0; the socket rule asked after every re-open; RC-6 static rules; ROW153 CONFINEMENT 6/6. Seccomp and unit hardening described only (host profile / container / hardware).
- 178 (BR-09 second half): the worker's own series gains 21 checks (160 now) with controls - 38 as expected, 0 unexpected; check.sh BR-04 rule with planted lines.
- Final: make rc 0; ROW41 28/28, ROW42 21/21, ROW186 23/23, ROW176 6/6, ROW175 14/14; row58_gate.py three times in a row 12/12, 12/12, 12/12 - INGEST_OPEN_STUCK did not recur (the one 10/12 after the outage stays an unexplained single event, recorded).
- 18 driver decisions accepted as recorded (no new exit code: tries used up ends with the last try's code; parameter sets must return byte-identical after a re-open - named for the hardware procedure: a real camera that changes its parameter sets on reconnect will be refused; no blind seccomp filter).
- OPEN -> a follow-up row: the Core's relay report reader DROPS the two new lines today, so a camera loss inside a session is invisible to the Core until the relay ends (with the pairing/forwarder follow-ups: row 188's audit count).
- Left to their rows: 44 (E-12 with the new lines; a killed parent during a retry wait), 59 (the whole series of 160 and the kill matrix), 141 (Linux).

## Update 2026-10-13 10:10 - integration pass I-7 landed; a database-suite hazard found and a fix launched
- I-7: all eight items closed; static 260 passed as found (the three named reds were already green); unit after edits 942 + 263 on loopback; shared 277; acceptance two files 78; five typechecks clean; openapi unchanged. The acceptance file is on the REAL registrar with AC-B-70 given its own rule; a registered microphone carries AUDIO.
- Driver decisions judged: DD-1 one line in db/mapping/rows.ts reads AUDIO back for a USB_AUDIO microphone (else the capability is lost at a restart) - ACCEPTED, outside the literal list but the direct consequence of C43 (3). The time read hands out an instant only from a UTCDateTime element, exact to one second; new i18n group common.captureSlotRefusal (no client reads it yet); the row-81 pin not moved because hostCommandRunnerOver has no caller yet (row 85) - ACCEPTED. otherMicInput deleted in mobile; its web twin has a caller (audio-source.ts:177) and stays.
- HAZARD for the full database run: test/helpers/db/names.ts:186 refuses the 100th LIVE clone when fence.db (row 33) and session-capture.db (rows 47, 48, 71, 179, 182, 188) run side by side - 29 failures when seven database files ran together; each passes alone. Fix pass I-7b launched: on the TEST side (clones dropped per case or reused), the guard of task 3 not raised.

## Update 2026-10-13 10:16 - fix pass I-7b landed; suite run c05, the M2 code review (row 35) and the procedure pass (row 181) launched
- I-7b: clones dropped per case in fence.db.test.ts (a file-level afterEach) and the rig's database dropped in session-capture.db.test.ts's afterEach; the seven colliding files together: 7 files, 191 passed, 0 clones left; peak live clones 7 together (was at least 99). names.ts untouched (its 99 is the two-digit counter of the name scheme, not a sizing). Seventh Edit-only breach: fence.db.test.ts was changed by a scripted exact replace of three strings - the agent said so; added to the list the M2 code review inspects.
- c05 runs WITHOUT the worker's make (row 193 is editing apps/capture-worker). The commit after it leaves apps/capture-worker out; it is committed when row 193 lands with its own make result.
- Code is otherwise quiet during the run: rows 35 and 181 write documents only.

## Update 2026-10-13 10:37 - suite run c05 green; commits b60a9fa3 (schema set B, 73 files) and 0f5d2a8e (batches 7-8, 268 files)
- c05: typecheck 7 workspaces, lint clean; core-server 7629 (345 files), shared 2795, core-web 2420, mobile 3219 (c04: 3220 - one fewer, the deleted otherMicInput test of pass I-7), transcriber 563, capture-protocol 31, mock-core 19; test:db 2799 passed / 7 skipped on throw-away databases, 0 left, fence.db and session-capture.db both pass and names.ts did not refuse; host helper 58; host scripts 171; hw collectors host 637, camera 535 (its first run failed one check because the procedure agent saved a chapter in the folder it hashes - rerun on a quiet folder passed). The worker's make was NOT part of this run (row 193 is editing it).
- Secret scan: camera-credential 55 in 34 files (baseline 54; +1 in camera/__tests__/onvif-session.test.ts, a test with stub values) and one in the untracked test_hw_collectors_camera.sh (a planted variable in a locator - synthetic, looked at by the controller); ingest-secret 4, in tests only. New baseline: 55.
- C32 kept for set B: commit b60a9fa3 holds rows 99 + 192 + 100. Deviation recorded: three test files that carry set-B pins AND other rows' hunks went into 0f5d2a8e (connect.db.test.ts, audio-cards routes.db.test.ts, fence.db.test.ts); the one added line in the task-3 contract document went into b60a9fa3.
- Unstaged on purpose: apps/capture-worker/ (row 193), the four HW-ACCEPTANCE chapters (row 181), scripts/host/container/ (README changed by row 193's work). A stray file ffprobe-export.txt at the repository root (an agent's scratch output, likely row 12) - left in place, listed for the clean-up at the close; not staged.

## Batch 9 (2026-10-13 10:37) - launched at full width (map: delegation_progress/batch_9_brief.md)
Rows 85, 191, 143, 146, 154, 199, 200, 201, 194, 195, 102, 202, 114 (+ profiles CHECK), 105, 44, 159, 206, 210, 213, 212, 207, 214, 205, 15, 36, 232 in 14 agents; rows 193 and 181 still in flight. Row 101 is satisfied by commit b60a9fa3. Row 57 waits for the tablet measurement (C45); rows 56, 34 skipped (C45).

## Update 2026-10-13 - row 181 landed (needs-review -> ruled, C49)
- 181: four HW-ACCEPTANCE chapters revised (order 4/4, missing 6/6, rulings 9/9, limits 10/10, codes 15); record implementation/181_hw_procedure_consistency.md and delegation_progress/row_181.md read, both exist. Nothing run, no script or source edited.
- Rulings (C49): the helper is mandatory for a production start (checks stay fail-closed; HI-01..HI-07 before 9A/H-16; row 119 before the hardware run); criterion 6 kept, follow-up row "host check reads the rule table"; one mechanical follow-up row for the collectors' names after rows 201 and 102.
- Still open from its list, with owners: host facts at the entry (row 85, in flight); X-1/X-2 commands (rows 206 in flight, 215); commissioning functions (M10); no H.264 pusher for `make e2e` on the host and no audit-list export outside a session - both listed for the next blueprint refinement.
- Eighth Edit-only breach (documents). The chapters are committed with apps/capture-worker when row 193 lands, after the hw collector suites pass on a quiet folder.

## Update 2026-10-13 - row 205 landed (SX-17 baseline)
- 205: complete; both artifacts exist. Head 0f5d2a8e; boot/checks.ts blob 1697e4b9, boot/index.ts blob 88c660be, working tree equals HEAD for both; no line of checks 4, 4b, 4c changed against cf2f8008. True lines in checks.ts: 4 = 440-442, 4b = 443-444, 4c = 446-452, 4d = 454-464, 4e = 466-472; index.ts SELECT_STORED_HASH_SETS at 222. The design's cited lines (checks.ts 423-435, index.ts 141-198) are stale - the record has the table.
- Path deviation, mine: the brief said gateway_check/205_boot_checks_baseline.md, the blueprint cell names verification/205_sx17_boot_baseline.md. The file stays where it is; this line is the pointer. Rows 206-231 compare against these blobs.

## Update 2026-10-13 - rows 15 and 36 landed (gates M1, M2) - C50
- Both PASSED WITH NAMED OPEN ITEMS; four artifacts exist (gateway_check/015_m1_gate.md, 036_m2_gate.md, delegation_progress/row_015.md, row_036.md). 27 identifiers sampled, 24 hold; the three that do not have owners (AD-06 (4): R6; F-09/C9: deviation C32; AD-08: rows 89, 157).
- Binding for the lift: F-07 is live (capture/index.ts:324-332 mounts boot checks without host facts) -> row 85 in flight, confirmed by row 86 before row 88. F-03 inside row 88. N-01 to row 86.
- To tell R1 (row 85) on its return or now: the exact mount lines the gate names.

## Update 2026-10-13 - row 193 landed (worker builds on Linux) - C51
- 193: complete; record and row file exist. macOS make rc 0, eight fixtures PASS; container image cdacf98a3f10: make rc 0, three binaries, ASan and UBSan run. Files: Makefile, check.sh, test/static/pinned_calls.py, test/writer_test.c, test/relay_unit_test.c, README.md, scripts/host/container/README.md.
- Decisions judged in C51 (two accepted; the Linux-only watched names become a follow-up row). Row 141 inherits three items.
- HAZARD seen by the agent: a `test:db` of another agent held port 8565 without the heavy-host lock (first run of four fixtures collided, second passed). 8565-8574 belong to the test camera under the lock (C33): attribute at the batch-9 returns (candidates: R3, R8) and remind in the next brief.
- apps/capture-worker stays unstaged until the batch-9 quiet point (c06 includes the worker's make).
- CORRECTION of the hazard line above (from row 193's own request line): the collision at about 10:25-10:28 was suite run c05's `npm run test:db`, whose database test starts test-fixtures/row046_adapter_listener.py (test camera on 8565, worker on 8559/8561) under the db-migrate lock only - not R3 or R8. So a database suite and a worker fixture run can collide by design. Follow-up for the next integration pass: the database test that starts row046's listener takes `.locks/heavy-host.lock` for that case (or the full-suite runner holds both locks for test:db). Until then the controller does not schedule a full run while a worker-fixture row is in flight.

## Update 2026-10-13 - row 232 landed (real-device Core running) - C52
- 232: needs-review -> ruled in C52; hand-over test/232_real_device_instance.md read (section UNTUK PENGGUNA), exists. Running: Core PID 57178 on 127.0.0.1:4423 (REAL_DEVELOPMENT, database dems_test_m12_row232), web console PID 57305 on 127.0.0.1:5178; stop: sh .cache/task4-row232/stop.sh (row 235). Probes en0 and en5. No search or test run by an agent.
- Row 233 waits for the user's word that they ran the search and the connection test.

## Update 2026-10-13 - row 214 landed (X-2 gate questions: SX-02, SX-03) - complete
- 214: four artifacts exist. SX-02 YES: with the Core stopped, a unit on its own pool appended an audit row through the EXISTING writer as dems_app; the Core's chain verification passed and a Core booted on that database; control - the same row by plain SQL is accepted by the database and verification reports the break (H2 holds). SX-03 YES: no grant missing for the runtime role (0003_privileges.sql), no request to row 202. Probe: 5 passed, 0 clones left (four runs, reasons in the record).
- Facts binding row 215 (carried into its brief): (a) the Core holds no lock, pid file or advisory lock - "Core stopped" can only be asked from pg_stat_activity, re-asked inside each unit after the chain lock (SX-01: row 215 states this limit plainly; a stronger guard is a design question, not assumed); (b) replacing a credential ends no session today - the command calls endSessionsOfOperator and revokeBiometricTokens on its unit, and the OPERATOR revocation scope admits only reason USER_DISABLED: the type is widened (shared vocabulary: R5 / row 201-202 names); (c) NEW: with a host clock behind the stored state the session end is refused by auth_sessions_times_check and the unit rolls back - the command raises the clock floor first in each unit (readNewestStoredInstant, raiseClockFloor).
- Unproven, stated by the agent: pg.env reading shown by source only (the probe took its connection from the test helper) - row 215 proves it.
- Red seen in passing: typecheck error at supervisor.test.ts:1069 - attributed to R2 (row 191, in flight, owner of supervisor); checked at its return.
- Row 215 is released when rows 212, 213 (R10), 201 (R5) and 202 (R6) land.

## Update 2026-10-13 - rows 213, 212, 207 (R10) and 105 (R7) landed - C53
- Artifacts of all four rows exist (records + row files). 213: 27 passed (2nd run). 212: 38 passed. 207: 13/13, earlier needles unchanged. 105: 89 passed (2nd run), on doubles only; unproven on Linux (9A/H-05, H-06).
- Routed: audit types HOST_ALIAS_REQUESTED / HOST_ALIAS_ADD_FAILED -> R5 (message sent); red at test/static/imports.test.ts:307 on host-command-unit.db.test.ts:51 -> R11 resumed to fix its own file.
- Reds seen in passing, attributed, checked at the owners' returns: capture/adapters/__tests__/static.test.ts:539, :550 (R3's list); audio-cards/__tests__/routes.db.test.ts typecheck (R4); host-key.ts typecheck (R9); supervisor.test.ts:1069 (R2).
- Integration pass I-9 list so far: move password-policy to packages/shared/src/api (after R5); SR-6 entry in test/static/network.test.ts; the db test that starts row046's listener takes the heavy-host lock; README key DEMS_CAPTURE_ALIAS_SOCKET and HOST-34 (close chain documents).
- Follow-up rows named so far (numbered at the next refinement): host checks read the rule table + refuse a non-constant socket path; collectors' names + the `check` 35 note; Linux-only watched calls (beside row 141); relay report reader; seal WRITE_FAILED diagnosis.
- Released: row 106 after the two audit types exist; row 215 after 201, 202.
- R11's red (imports.test.ts:304-308, no file of test/support imports a row's __tests__ folder): reported fixed in its own test file before the message arrived (the import of security-audit/__tests__/support dropped; boots through test/support/engine.ts); it states static 17 passed and probe 5 passed, 0 clones left. Not re-run by the controller; suite run c06 is the confirmation.

## Update 2026-10-13 - rows 206, 210 (R9) landed - C54
- Both complete; four artifacts exist. 206: production-key.test.ts 12 passed; neighbours and static 60 files / 1030 passed; command `npm run evidence:production-key -w @dems/core-server -- --data-dir <absolute directory>`, prints public facts only. 210: signer 23 passed (2nd run); host-key.ts, signer.test.ts (+158/-0), new signer-sync.test.ts.
- The typecheck red at host-key.ts reported earlier by R10 was R9 mid-edit: to be confirmed clean in c06.
- Left to their rows: SX-16 second half (211), boot audit members (208), runbook/README halves (X-D), R-X1 hand-over.
- I-9 list gains: row 206's needle request checked against row 207's needles.
- Released now (B deps met): rows 208, 209, 211 wait for 201/202 where they need vocabulary or schema - checked when R5 and R6 land.

## Update 2026-10-13 - rows 85 (R1), 199, 200 (R4) landed - C55, C56
- 85: needs-review -> adopted as built; unit 35 files / 663 passed; three swept db suites 84 passed; typecheck 0; four suites swept (boot.test.ts, fence.db.test.ts, capture-config.db.test.ts, source-class.db.test.ts). Red fence.db.test.ts:139 = R6's schema pin (in flight). Worker- and port-binding suites not run (c06).
- NEW ROW 85b (composition of the production dependency bundle; SR-7) - launched when R2 (capture-session), R3 (camera adapter, adapters static list) and R5 (shared) have landed, because it wires their files. Row 88 depends on 85b and 86.
- 199/200: unit 136 + 180 passed, db 22 passed, static 302; contract.test.ts 8 failed on the operation count = R5 mid-flight.
- Still in flight: R2 (191), R3 (143, 146, 154), R5 (201, 194, 195, 102), R6 (202, profiles CHECK, 114), R8 (44, 159).

## Update 2026-10-13 - row 191 (R2) landed - C57
- complete; artifacts exist. tsc clean (the earlier red at supervisor.test.ts:1069 was R2 mid-edit); capture unit 652 passed; session-capture.db 92 passed, 0 clones left; scenario 4 runs each 1 passed. capture-session/index.ts and capture/supervisor.ts are free again.
- NEW ROW 191b (gap in audit + interval by insert + loss watch) - needs a vocabulary step; before M6.
- Still in flight: R3 (143, 146, 154), R5 (201, 194, 195, 102), R6 (202, profiles CHECK, 114), R8 (44, 159).

## Update 2026-10-13 - row 233: the user's run on the real cameras, read by the controller from .cache/task4-row232/logs/core.log (coded lines only; no body, no credential read)
- User message: search and connection test done; "cannot assign/save to cam 1 / 2".
- Search: 4 manual searches, each COMPLETE in about 3.0 s; 25, 25, 25, 29 responders; 104/100/100/114 datagrams accepted, 0 dropped, 0 send errors; interfaces probed 2, 1, 1, 2.
- Connection test (operation testCaptureCandidateConnection): 2 runs, both REACHABLE, authenticated true, sourceClass PRODUCTION, guard not tripped, judgedStreams 1 -> the relay program was accepted and read a stream from a REAL camera (first proof on real hardware of rows 41/42/50/186, in probe mode).
- The user ADOPTED two cameras (their own decision, beyond what the hand-over advised): CAM-04 and CAM-05, each `CAPTURE_DEVICE_ADMITTED admission: NOT_SERVED`. One adopt answered 429 RATE_LIMITED and passed on the next try.
- Assignment: 3 x POST /capture/cameras/:id/source -> 422 INVALID_INPUT. This is the state test/033 predicted (step 4: details.reason CAPTURE_DEVICE_NOT_SERVED): the running registry serves no ONVIF_RTSP adapter before the lift (row 88); the response body's reason was not read (not logged) - stated as the expected cause, not observed.
- 2 x POST /capture/discovery -> 422 INVALID_INPUT (the typed address; expected, record 096).
- FINDING for the web console (row 234): the refusal reaches the user as "cannot save" without a sentence that says why - the slot dialog must state CAPTURE_DEVICE_NOT_SERVED in plain words.
- Consequence for the plan: assigning and recording from these cameras needs 85b -> 86 -> 88 (the lift), and a REAL_PRODUCTION Core, which needs a production key (row 206, built) and non-demo operator passwords (row 215, not built). Whether a PRODUCTION-class camera may be assigned under REAL_DEVELOPMENT is to be read from the code by row 85b's brief, not assumed.

## Update 2026-10-13 - rows 143, 146, 154 (R3) landed - C58
- Artifacts exist. Final 39-file static run 662 passed (the two reds at adapters static :539/:550 seen by R7 were R3 mid-edit). The camera adapter files and the adapters' static list are free.
- Third vocabulary step, list so far: HOST_ALIAS_REQUESTED / HOST_ALIAS_ADD_FAILED (unless R5 took them), the audio-gap type (191b), the outcome of a stored-credential test (146). Next contract step: operation for the adopted-camera test (146), members usbSerial / usbPort (199).
- Row 85b launched now (R1, R2, R3 landed; R5 touches apps/core-server for pins only, R6 the schema): composition + storedAddress member + the 146 reader + row 199's stored-row reader + the fence fact keys.
- Still in flight: R5 (201, 194, 195, 102), R6 (202, profiles CHECK, 114), R8 (44, 159), 85b.
- From R3's request line 265, NOT in 85b: the SOURCE half of the destination rule (the connection must be made FROM the camera-interface address) is not applied to a stored camera. New row 143b (owner: camera/onvif-session.ts and the relay's start message; before row 86) - launched when 85b lands, because both touch the camera adapter's dependencies.

## Update 2026-10-13 - rows 44, 159 (R8) landed - C59
- Artifacts exist; three new fixtures under apps/capture-worker/test-fixtures (row044_e12_search.py, row044_door_parent.mts, row159_relay_hygiene.py). No finding. Processes left: none.
- I-9 list gains: a run bound for the row 44/159 fixtures. Row 141 gains: the Linux descriptor list and limits.
- Still in flight: R5 (201, 194, 195, 102), R6 (202, profiles CHECK, 114), 85b.

## Update 2026-10-13 - row 85b landed - C60; rows 85c and 143b launched
- 85b: needs-review -> adopted as built; artifacts exist. Composing file apps/core-server/src/capture-composition.ts.
- 85c owns: src/capture-composition.ts, src/capture/fence/production-parts.ts, fence/index.ts, fence/sources.ts, src/index.ts, src/config.ts + plugins/config/load-config.ts (one key), adapters/audio/mic-loss.ts, camera/camera-watch.ts (fault sink only), the helper table, the capture static list.
- 143b owns: camera/onvif-session.ts, camera/relay-start.ts, camera/stored-address.ts (source half only), camera/stream-probe.ts if needed, apps/capture-worker/src/relay/* if the relay must bind its source address, the adapters static list. Overlap ruled: camera-watch.ts is 85c's; if 143b needs a line there it requests it.
- I-9 list gains: SR-8 entry in adapters static RULE_BINDERS (by 143b, its list owner in this wave); schema pins [10,'dbc-11'] -> R6's final values at fence.db.test.ts:139 and audio-cards routes.db.test.ts:159.
- In flight: R5, R6, 85c, 143b.

## Update 2026-10-13 - R6 landed (rows 202, 51b, 114) - C61. SCHEMA IS NOW [11,'dbc-12'], 48 tables, 26 migration files
- Artifacts exist (three records, three row files, three patches). db schema, migrations and value sets are free.
- BROADCAST to rows in flight: the tree's schema version is [11,'dbc-12']; a test that pins [8,'dbc-9'] or [10,'dbc-11'] is moved by integration pass I-9, not by its driver (known: fence.db.test.ts:139, audio-cards routes.db.test.ts:159).
- Released by 202: row 215 still waits for R5 (201). Released by 114: rows 116/117 (the acceptance operation) wait for their contract step.
- In flight: R5 (201, 194, 195, 102), 85c, 143b.

## Update 2026-10-13 - R5 landed (201, 194, 195, 102) - C62. Counts: 107 operations, 78 audit types, 51 actions. Batch 9 is fully landed.
- One typecheck error reported in src/__tests__/capture-composition.test.ts (row 85b's file) -> sent to 85c, its owner now.

## Wave 10 (2026-10-13) - launched; 85c and 143b still in flight
| Agent | Rows | Owns (single writer) |
|---|---|---|
| V3 | third contract + vocabulary step | packages/shared hot files, every operation/audit/action count pin, openapi.json, core/audit-details.ts entries for the new types, the password-policy move (identity/password-policy.ts -> shared) |
| N1 | 108 | modules/capture-config network-config store/service/routes + its tests; the reader it exports (mount = request to 85c) |
| N2 | 196, 197 | modules/capture-discovery/readdress.ts and its route, the engine door file |
| X1 | 211, then 215 | capture/boot/index.ts (211 only), apps/core-server/cli set-password files, identity session/biometric revocation call sites |
| X2 | 208 | tests only (sealing/boot proof) |
| T1 | 109 | the fake ONVIF stub test support |
- Held: 209 (writes fence/index.ts - 85c's) until 85c lands; 106 until V3; 107, 110+ until 109/108; 116/117 until their contract; 217 until 215; integration pass I-9 and suite c06 at the wave's quiet point.

## Update 2026-10-13 - row 208 (X2) landed - complete, adopted
- New test only: apps/core-server/src/sealing/__tests__/production-key-proof.db.test.ts, 3 passed on runs 2 and 3 (run 1 failed 2 of 3 on its own stated device ids). Proofs: (1) a WHOLE REAL_PRODUCTION start of buildApp on a clone with the command's data directory, no mount seam: CAPTURE_BOOT_CHECKS_PASSED; (2) development store refused at 4b, CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION; (3) SIGN_MANIFEST with that signer -> SEALED, verifyPackageV2 passes trusting only the printed fingerprint.
- Stated limits, accepted: the seal proof stops at the pipeline's session port (the four production source rows are stated by the test - no recording can supply them before row 88): the end-to-end seal of a production recording is row 90/M6's. The state of boot/index.ts BEFORE row 211 was hashed (ce296918...) but never run; all runs saw 47946c29... (after 211) - the "before" half of SX-17 rests on the existing boot tests passing unedited in row 211's own record.
- Reds seen in passing, attributed, checked at the owners' returns: capture static.test.ts SR-2 and :616 (85c owns that list; 143b suspected); typecheck in packages/shared/src/api (V3 mid-move) and capture-config/network/facts.ts (N1 mid-edit).
- In flight: 85c, 143b, V3, N1, N2, X1, T1.

## Update 2026-10-13 - row 109 (T1) landed - complete, as a SECOND PASS
- CONTROLLER'S ERROR, recorded: row 109 was already built and committed at b7ed4c60 (batch 3); I launched it as open. The agent noticed and added only what the brief asked beyond it: MARKUP_TEXT, onApply MOVE / NOT_APPLIED, the per-request record (method, path, soapAction, authorizationScheme, wsSecurity). Before the next launch the released rows are checked against the blueprint's row-status table AND git, not against my running list.
- The four calls per masterplan/01_specs.md:150, :403: GetNetworkInterfaces, SetNetworkInterfaces, SetNetworkDefaultGateway, SystemReboot (no DNS call in the design).
- Checks: unit 187 passed / 1 failed - onvif-session.test.ts:1082, attributed to row 143b (a third parameter on `read`, mid-edit); database 40 passed, 0 left. Limit: the "move" changes PORTS on 127.0.0.1 (no second loopback address binds here) - a real address move is a hardware check (9A/H-13..H-15).
- In flight: 85c, 143b, V3, N1, N2, X1.

## Update 2026-10-13 - row 85c landed - C63; row 209 released and launched
- 85c: unit 747 passed / 2 failed (both capture static pins tracing to 143b mid-edit); composition db 7 of 7; fence.db 44 passed. capture-composition.ts, fence/*, config.ts, mic-loss.ts, camera-watch.ts, the capture static list are free.
- Row 209 (SYSTEM_BOOT key members, fence/index.ts) launched: owns fence/index.ts for its one write.
- I-9 list gains: the row-108 reader mount in capture-composition.ts / src/index.ts; the capture static pins for 143b's facade; README/host profile: `arecord` path, DEMS_CAPTURE_AUDIO_HELPER.
- New row 85d (admitDevice on both built adapters) after 143b.
- In flight: 143b, V3, N1, N2, X1, 209.

## Update 2026-10-13 - rows 211, 215 (X1) and 108 (N1) landed - C64
- Acceptance pair currently 21 failed / 58 passed: traced by N1 to V3's operation 108 and N2's operation 100, both in flight - judged at their returns, then I-9.
- typecheck: src/capture/fence/index.ts:717 red - row 209 is editing that file now (in flight); if it survives 209's return it is 85c's and goes to I-9.
- Launched now: X3 = rows 216 then 220 (test-expert: command acceptance, then the bench boot session); D1 = rows 217 and 219 (installer note and hardware frame, documents); K1 = rows 225 then 226 (active key resolver; rotate / mark-compromised commands) - K1 owns capture/signer/*, capture/boot/index.ts, cli/ key files.
- In flight: 143b, V3, N2, 209, X3, D1, K1.

## Update 2026-10-13 - rows 196, 197 (N2) landed
- 196 complete: engine door `readdressCaptureDeviceIn` (engine/internal-actions.ts, host.ts, index.ts); db 5 passed (run 2), engine pins 55 passed; row and slice change together or not at all.
- 197 needs-review -> adopted as built: operation 100 routed (capture-discovery/readdress-route.ts), refused while a session is open (no running capture is re-addressed), db 4 passed, unit and static 51; deferrals LANDED_UNROUTED / DEFERRED_ROUTE ended; router count pin 104 -> 105 not yet seen green (V3 in flight). DD accepted: the audit entry carries operationId; an unknown device answers 404 at the route.
- NOT LIVE YET: until `captureReaddressControl(app).provideNetworkFacts(captureNetworkFacts(app))` is mounted every confirmation answers 422 (fail-closed) -> I-9, with row 108's composition mount and the typed-probe binder (`typedAddressControl` now exported; needs a fence binder).
- Acceptance: 18 failed / 61 passed, all 18 attributed to V3's in-flight operation 108.
- Tenth Edit-only departure (a first claims line by shell append; also X1) - the claims file is append-only by nature; noted, not counted against product files.
- I-9 list (complete so far): three network-facts mounts (composition, readdress, typed probe); schema pins fence.db.test.ts:139 and audio-cards routes.db.test.ts:159 -> [11,'dbc-12']; SR-6 entry in test/static/network.test.ts; SR-8 in adapters static (unless 143b did it); capture static pins for 143b's facade; port 8557 split; the db test starting row046's listener takes the heavy-host lock; run bounds for row 44/159 fixtures; row 206's needle request; router/operation pins after V3; fence/index.ts:717 typecheck if it survives 209; demo-reset kept-table entries T-44..T-48.
- In flight: 143b, V3, 209, X3, D1, K1.

## Update 2026-10-13 - row 143b landed - C65; rows 143c + 85d launched as ONE agent (camera and audio adapter files)
- 143b: the capture static reds (SR-2, G-R10/11) are green without editing that list; onvif-session.test.ts fixed. apps/capture-worker/src/relay and the camera adapter files are free -> owned now by the 143c/85d agent.
- 143c: bind the camera watch's time read; candidate test bound under REAL_PRODUCTION. 85d: `admitDevice` on the camera adapter and the microphone adapter (C63).
- In flight: V3, 209, X3, D1, K1, 143c/85d.
- For row 86 (security acceptance), from 143b's request lines 317 and 318, by name: (a) relay rule RC-6 "the relay binds nothing" was CHANGED by 143b into "exactly ONE bind, in relay_rtsp.c, its line pinned" (tag S13-11) - a security reviewer confirms the changed rule; (b) the capture static pin SR-2 is green only because 143b gave its code a particular form - the reviewer judges whether the plain form should be admitted by a named entry instead.

## Update 2026-10-13 - row 209 landed - complete, adopted
- SYSTEM_BOOT states the certificate that lay in the store when the fence passed (new fence/boot-key.ts; one boot append in fence/index.ts; boot.ts and operation.ts diff empty). ORDER: the entry is committed BEFORE checks 4, 4b, 4c - it does not say the key passed (proven: a compromised key is STATED, then the start is refused KEY_COMPROMISED; no key: both members null, then KEY_ABSENT). Unit+static 390, database 47, typecheck 0.
- Decisions accepted: helper file (G-R14 forbids an error path in index.ts); half a pair refused; no log line on an unreadable certificate; the two forms duplicated in the fence and held equal to row 201's by a test.
- I-9 list gains: export SYSTEM_BOOT_SIGNING_DETAIL_RULES at core/index.ts:65 (then boot-key.ts drops its own table - NOTE: first VALUE import of the core unit by the capture unit: the pass checks the closed-unit rule before doing it, else leaves the duplicate); audit-writer.ts admits NULL for the two members when it enforces them (a real boot without a certificate writes null - until then only the one boot writer enforces the forms; other SYSTEM_BOOT writers unchecked: row 86).
- For row 218 (README): the one sentence on what the two members mean (request line 323, verbatim).
- The three `private-key-pem` hits (C53 (3)) are literal opening lines of a PEM key used as REFUSED test values, no key - measured by row 209; the baseline of 3 stands with that statement.
- Red seen: core/__tests__/writers.test.ts 5 reds on HOST_ALIAS_ADD_FAILED - V3 in flight.
- The typecheck red at fence/index.ts:717 is gone (typecheck exit 0).
- In flight: V3, X3, D1, K1, 143c/85d.

## Update 2026-10-13 - rows 217, 219 (D1) landed - complete, adopted; nothing run on a host
- 217: installer note rewritten to the built commands (copied from package.json); count-only scan 0. 219: frame chapter, X-1/X-2 passages. Edit tool only.
- DOCUMENT FOLLOW-UP ROW (one agent, with the collectors' names of C49 (3) and README row 218, at the close chain): chapter 2 :263 (9A/H-16) names neither command; the installer note's steps 7a/9 still put the helper AFTER the first boot, against C49 (1); the note still calls the db:migrate argument form unconfirmed; the host profile lacks the parent-directory requirement of C54 (4), the `arecord` path and the two new keys (C63); the `check` 35 note (C53 (e)); row 209's sentence; row 143b's chapter-3 check.
- In flight: V3, X3, K1, 143c/85d.

## Update 2026-10-13 - rows 216, 220 (X3) landed - C66
- New rows: 215b (the command's connection file follows --data-dir), launched now (cli set-password files are free); "host profile not asked is a fact of the evidence" (after K1 and 143c/85d land - it touches fence/boot and the manifest).
- Held: 221 (security review of X-1/X-2 as built) and 222 (code review of M11) until K1, V3 and 215b land - reviewers read a quiet tree.
- In flight: V3, K1, 143c/85d, 215b.

## Update 2026-10-13 - V3 landed - C67. Counts: 108 operations, 82 audit types, 51 actions. packages/shared is free.

## Wave 11 (2026-10-13) - launched; K1, 143c/85d, 215b still in flight
| Agent | Rows | Owns (single writer) |
|---|---|---|
| A1 | 106 | capture/host-alias/* (lifecycle), its boot/shutdown hooks through request lines |
| A2 | 107 | the commissioning scan module (new files), its route |
| A3 | 191b | capture-session/index.ts, capture/supervisor.ts, the interval insert |
| A4 | 146b + cardAnswer | capture-discovery/adopted-test.ts and its route file; capture-inputs/audio-cards answer lines |
| A5 | 116 | packages/shared hot files and every count pin (acceptance contract package) |
| W1 | 112, 198, slot refusal sentence, Try-it deny for 108 | apps/core-web |
- Held: 111 (set-IP job) until 106 lands; 117 until 116; 113 until 111; 119 (security review of commissioning) until 106, 107, 111, 117; 221/222 until K1 + 215b; 86 until 143c/85d; I-9 + c06 + commits at the quiet point.

## Update 2026-10-13 - row 215b landed - C68 (corrects C66 (4)); wave 11 running
- In flight: K1 (225, 226), 143c/85d, A1 (106), A2 (107), A3 (191b), A4 (146b), A5 (116), W1 (web).
- 221/222 wait for K1 only now.

## Update 2026-10-13 - rows 225, 226 (K1) landed - C69; reviews 221 and 222 launched (read-only; signer, boot, cli and identity files are FROZEN until they return)
- In flight: 143c/85d, A1, A2, A3, A4, A5, W1, 221, 222.
- Held behind the reviews: 226b, 227, 228, 229.

## Update 2026-10-13 - rows 143c, 85d landed - C70; integration pass I-9a launched
- Reds seen in passing: test/static/search-path.test.ts:94 on capture/host-alias/* and typecheck in host-alias/journal.ts (A1 in flight); adopted-test.test.ts and adopted-camera-test.db.test.ts (A4 in flight).
- I-9a owns (exclusive, finished areas): src/capture-composition.ts, src/index.ts, fence/production-parts.ts, modules/capture-discovery/readdress*.ts and typed-address.ts (NOT adopted-test.ts / its route: A4; NOT connect/service.ts), test/static/network.test.ts, credential-store/__tests__/static.test.ts, core/index.ts:65 export, core/audit-writer.ts (null for the two SYSTEM_BOOT members), fence.db.test.ts:139 and audio-cards routes.db.test.ts:159 pins, the port split of the two R3 db tests, the row046 listener's heavy-host lock, run bounds of row 44/159 fixtures.
- In flight: A1, A2, A3, A4, A5, W1, 221, 222, I-9a.

## Update 2026-10-13 - row 221 landed - CAUTION, no FAIL - C71
- New rows: 215c (guard.remember failure not swallowed) - after row 222 returns (cli files frozen); test-hygiene (no fixture key under .data/); "Core-held lock" (before real examinations); I-9b (named entry + widened patterns for the policy's run key; pin of the command in credentials.test.ts).
- PUT TO THE USER: removal of .data/test-row61-* (320 folders, untracked); production off Linux.
- In flight: A1, A2, A3, A4, A5, W1, 222, I-9a.

## Update 2026-10-13 - row 222 landed - CHANGES REQUESTED (1 blocking) - C72. Signer, boot, cli, identity files UNFROZEN.
- Launched: 215c (B-01 test, C-2, F-01 pin) - owns cli/operator-set-password-command.ts, its tests, a new boot test file; K2 = rows 226b then 227 - owns capture/signer/*, sealing-host/index.ts, the Core's verify files; K3 = row 228 - owns capture/boot/checks.ts and boot/index.ts (added lines after 4b, deliberately against the row-205 baseline) and their tests.
- Held: 229 (rotation scenario) until K2 + K3; 230 after 229; test-hygiene row until I-9a returns (shares fence.db.test.ts); cli static rule set row after 215c.
- In flight: A1, A2, A3, A4, A5, W1, I-9a, 215c, K2, K3.

## Update 2026-10-13 - row 191b (A3) landed - C73
- capture-session/index.ts, statements.ts and sealing-host/session-reader.ts are free (K2 owns sealing-host/index.ts - a different file).
- Static reds seen, not A3's: capture static SR-2 and P25; credential-store static :89 (I-9a item 4); capture-config static :175. To attribute when I-9a returns its list of reds.
- Next vocabulary/contract step, list so far: SYSTEM_BOOT details rule admitting null + severity enforced (C-6, F-04); signed manifest member for the audio gap (191c); an own reason for CANDIDATE_NOT_TESTABLE (optional).
- In flight: A1, A2, A4, A5, W1, I-9a, 215c, K2, K3.

## Update 2026-10-13 - row 106 (A1) landed - C74
- Reds attributed by A1: A2's factory-scan/service.ts (static, twice) and factory-scan/__tests__/routes.db.test.ts(331) typecheck - A2 in flight; src/index.ts static once - I-9a in flight (it owns src/index.ts).
- Row 106b (routes 104/105, mount, adapter to A2's port) - after A2 and I-9a land.
- Step V4 (after A5 lands), list: SYSTEM_BOOT details rule admitting null + severity (C-6, F-04); signed manifest member for the audio gap (191c); aliasId optional on the two removal results; honest alias removal reasons (schema value set + vocabulary); optional own reason for CANDIDATE_NOT_TESTABLE.
- Row 111 (set-IP job) released by 106: launched when A2 lands (both use the alias port) - held.
- In flight: A2, A4, A5, W1, I-9a, 215c, K2, K3.

## Update 2026-10-13 - row 215c landed - complete, adopted (closes the code review's blocking B-01)
- B-01: five wrong sessions x two targets refused ROLE_NOT_RUNTIME, prompt 0 calls; with the check removed 5 failed / 54 passed, back in place 59 passed - the test is real. C-2: REPEAT_CHECK_LOST, result member repeatCheckLost, one error-log entry without the value; the walk stops. F-03: all six refusals reached (11 cases). F-02: tests only. F-01: one-load-mount.test.ts fails 3 of 5 against a two-load copy; passes on K3's current boot/index.ts.
- Decisions accepted: after the LAST password a lost check is said and logged but the exit code stays (nothing is left to stop; the operator is told); the guard doubled with vi.mock, no product seam; one existing production-key.test.ts case given `installationId` because K3's check 4b-2 turned it red (K3 in flight - consistent with K3's sweep).
- Launched: X4 = the static rule set for apps/core-server/cli/ (review F-06) + I-9b items (named entry and widened pattern for the policy's run key, C-1/F-07; the command pinned by name in credentials.test.ts, F-08).
- In flight: A2, A4, A5, W1, I-9a, K2, K3, X4.

## Update 2026-10-13 - row 146b (A4) landed - C75
- Acceptance pair now 21 failed / 70 passed: all on the two installation operations of A5 (row 116, in flight; named deferrals expected when it lands). One unit red in capture-config routes.test.ts = row 107's route (A2 in flight). Typecheck red in capture-composition.test.ts (`typedProbeRuleOf`) = I-9a item 3 in flight.
- Step V4 list gains: outcome UNREACHABLE for the stored-credential test (146c); simulator vs Core answer for operation 108.
- In flight: A2, A5, W1, I-9a, K2, K3, X4.

## Update 2026-10-13 - I-9a landed - C76; rows 141+79, 59, 157 launched
| Agent | Rows | Owns |
|---|---|---|
| C1 | 141, 79, the Linux-only watched calls (C51 (3)), Makefile fixture macro lines | scripts/host/container/*, apps/capture-worker Makefile + test/static/pinned_calls.py; the heavy-host lock per run |
| C2 | 59 | no product file; the worker's series and kill matrix on macOS; heavy-host lock per run |
| S1 | 157 + SR-10 entry | src/capture/__tests__/static.test.ts (one rule), src/credential-store/__tests__/static.test.ts (one entry) |
- HOST LOAD: C1 and C2 are both heavy and share .locks/heavy-host.lock; no full suite is scheduled while they run.
- Reds still open, with owners: test/static/search-path.test.ts:94 (A2 in flight); capture-config/__tests__/static.test.ts:175 (A1's lifecycle - landed: goes to row 106b).
- In flight: A2, A5, W1, K2, K3, X4, C1, C2, S1.

## Update 2026-10-13 - rows 226b, 227 (K2) landed - C77
- capture/signer/*, sealing/signing.ts, evidence-verify, sealing-host/index.ts are free.
- Launched: row 227b (the export's trust list carries the retained certificates) - owns evidence-export/host.ts and its tests.
- Step V4 list gains: VERIFY_NOTICE member SIGNED_BY_COMPROMISED_KEY + client wording + the receiver's verifier state.
- Held: 229 (rotation scenario) until 227b and K3 (228) land; 230 after 229.
- In flight: A2, A5, W1, K3, X4, C1, C2, S1, 227b.

## Update 2026-10-13 - row 107 (A2) landed - C78; row 106b launched
- 106b owns: capture/host-alias/* (adapter, routes glue), a new routes file for operations 104/105 in the module the contract names, modules/capture-config/factory-scan/* (alias in the answer, the adapter call), src/capture-composition.ts + src/index.ts (the hand-overs and the boot/shutdown hooks), capture-config/__tests__/static.test.ts:175 and test/static/search-path.test.ts:94 (the two reds of A1/A2's files).
- Held: row 111 until 106b lands.
- In flight: A5, W1, K3, X4, C1, C2, S1, 227b, 106b.

## Update 2026-10-13 - W1 landed (rows 234-finding, 198, 112, Try-it deny) - complete, adopted
- Slot refusal: every 422 reason worded at the slot (new slot-refusal.ts, capture-selector-panel.tsx). A production camera on a development Core reads: "This camera was not assigned: it is a production device, and this Core runs in development capture operation. This camera can be assigned only on a Core running in production capture operation. Nothing was changed."
- 198 re-address dialog (one request, only on the confirming press; Escape does not close it - kit default, accepted). 112 commissioning settings + scan screen (features/commissioning, route admin/commissioning; simulator-only answers named in the tests). Try-it deny 11 -> 14 (108, 109, 110).
- Targeted run 16 files / 409 passed; apps/core-web typecheck 0, lint 0. tsc -b red at packages/shared/src/api/installation-acceptance.ts(175,10) TS6133 = A5 in flight.
- RULED on the wording request A5 declined: the four slot sentences as the web words them ARE the wording; they move into `common.captureSlotRefusal` of packages/shared in step V4 and the web's own copies are removed then (one source).
- NOT DONE BY ANYONE: no browser check of the three new screens (no dev server was started). A scripted browser session in Simulated mode is part of the gate's device/browser session - named for it.
- The user's running instance on port 5178 serves the EXPORT of commit 0f5d2a8e: it does not show these changes.
- apps/core-web is free. Row 113 (set-IP screens) waits for row 111.
- In flight: A5, K3, X4, C1, C2, S1, 227b, 106b.

## Update 2026-10-13 - row 228 (K3) landed - C79. capture/boot/* is free.
- Held: 229 (rotation scenario) until 227b lands; then 230 (security review of rotation + binding), 231 commit.
- OPEN RISK before c06: 134 unit failures in 10 files seen by K3 in a sandboxed wide run, 7 files undiagnosed. c06 decides.
- In flight: A5, X4, C1, C2, S1, 227b, 106b.

## Update 2026-10-13 - row 157 + SR-10 (S1) landed - complete, adopted
- Rule AD-08 pinned in capture/__tests__/static.test.ts: mountCaptureFence (timers, sinks, reloadState), mountCaptureBootChecks (timers, sinks), composeProductionCaptureOf(app, { platform, network }), provideHost facts (platform, startArguments, nodeOptionsSet, userLimits); closed list of 22 DEMS_* keys, each with its row; controls: 10 mount mutations, a src/ importer of test/support, a planted DEMS_CAPTURE_TEST_SIGNING_KEY. Decisions accepted: only the CALLS are pinned, not the mount interface declarations; the test key maker is held by place (it is built by row 89).
- SR-10 entry in credential-store static, purpose `capture.open` pinned, 7 planted second uses seen; PROVISIONAL until row 86.
- Static set 787 passed / 1 failed: capture-config/__tests__/static.test.ts:175 = row 106's host-alias files -> row 106b item 5 (in flight). Typecheck 0.
- NOTE for 106b (already briefed): the entry statement is now pinned; a new member needs a request, not an edit.
- Row 86's dependencies: 157 done; 141 (C1) and 59 (C2) in flight.
- In flight: A5, X4, C1, C2, 227b, 106b.

## Update 2026-10-13 - X4 landed (cli static rules, policy run key entry, command pin) - complete, adopted
- New apps/core-server/test/static/cli.test.ts: 23 rules in six groups + 6 planted controls; coverage now includes cli/**; identity static 18 -> 22 cases (patterns see Web Crypto; ONE named entry: password-policy.ts createRunRepeatGuard, C72; three planted controls); credentials.test.ts pins `operator:set-password` to exactly `tsx cli/operator-set.ts`. No real violation found in product code. Facts pinned by name: cli/ holds TEN files; cli/verify-export.ts:20 imports the process module for the receiver's unzip (no secret).
- This closes review follow-ups F-06, F-07, F-08 and security cautions C-1 and (b).
- Static run: 46 files, 44 passed. Reds: adapters static :296 on evidence-export/host.ts:56 (row 227b in flight - told); capture-config static :175 (row 106b item 5, in flight).
- In flight: A5, C1, C2, 227b, 106b.

## Update 2026-10-13 - row 116 (A5) landed - C80. Counts: 110 operations, 82 audit types, 51 actions. Acceptance pair green at this point.
- Launched: V4 (single writer of packages/shared, every count pin, core/audit-details.ts, core/audit-writer.ts, the web's slot-refusal copies); row 117 (acceptance and revocation live) - owns a new module for the two routes.
- Typecheck red: src/evidence-export/__tests__/export.test.ts(521) = row 227b in flight.
- In flight: C1, C2, 227b, 106b, V4, 117.

## Update 2026-10-13 - row 227b landed - needs-review on one point, adopted
- The export trusts the retained certificate set (`exportTrustedCertificates` = sealingVerifyTrust(...).trusted); the adapter-layer import is gone, adapters static green unedited; export unit 26 (run 2), static+export 400, new database case 1, existing export db 2, tsc 0. No expectation changed.
- DRIVER DECISION, ACCEPTED as the conservative side: a package under a key marked COMPROMISED is NOT exported - the job fails SOURCE_VERIFY_FAILED and earlier archives stay; the existing types cannot state the mark. Whether such a package may be exported WITH the notice is a design point for row 230 (security review of rotation); the members it would need (receiver notice SIGNED_BY_COMPROMISED_KEY - in V4b; an input compromisedCertificateSha256; failure code SOURCE_SIGNED_BY_COMPROMISED_KEY) are sent to V4 as information, not as scope.
- Its request "a receiver needs every sealing key's fingerprint" (the out-of-band hand-over after a rotation) -> the installer note / README row and row 230.
- Launched: row 229 (rotation scenario on doubles).
- In flight: C1, C2, 106b, V4, 117, 229.

## Update 2026-10-13 - row 229 landed - C81; row 226c launched (sign-time guard: bound to the boot's key id; validity at signing; the export's refusal reason)
- 226c owns capture/signer/*, sealing-host/index.ts, evidence-export/host.ts (the reason only). After it: the affected steps of the row-229 session are re-run (its driver is kept at .cache/task4-row229/rotation-session.mts), then row 230.
- In flight: C1, C2, 106b, V4, 117, 226c.

## Update 2026-10-13 - row 117 landed - complete, adopted
- Operations 109 / 110 live in modules/capture-config/installation-acceptance/; unit 22, database 15 (0 left), other walkers 45, tsc 0. The database's constraint judges "one in force" (23505 caught, no pre-check); a denied key name is refused by the route (422) before the database, the table's CHECK is the tested backstop; nothing reads an acceptance to allow a recording.
- Decisions accepted: a folder of capture-config (no new app unit); the version stated is CORE_SERVER_VERSION; an unknown member of the diagnostics run refuses the acceptance. NOTED, not accepted silently: "a clock that went back is a 500" - a 500 is an unnamed failure; the named refusal for a clock behind the stored state (row 214's finding; the set-password command raises the clock floor first) is a small follow-up in the M10 review list (row 119/120).
- Acceptance pair: 6 failed / 75 passed, all on operations 104/105 = row 106b in flight. Static: 1 failed (106b's factory-scan test).
- I-9b list: kept-tables.ts - a demo reset still empties installation_acceptances and the set-B tables (requests of rows 51, 99, 114, 117): now due.
- Row 118 released (see its cell) - launched with the web's set-IP screens when row 111 lands, as one web agent.
- In flight: C1, C2, 106b, V4, 226c.

## Update 2026-10-13 - row 106b landed - C82; rows 106c and 111 launched
- 106c owns: src/index.ts (the entry statement's one new member), src/capture-composition.ts (the hand-over only), src/capture/__tests__/static.test.ts (the two pins, SR-11), capture/host-alias/facts.ts wiring test.
- 111 owns: the set-IP job module (new), the production inputs it needs (ping / arping / neighbour table through the production door: helper-table rows), its route; a mount in capture-composition.ts by ONE additive edit after re-reading (106c edits the same file).
- Foreign reds reported by 106b: two in capture static on signer/host-key.ts and boot/index.ts = row 226c in flight (told below when it lands).
- In flight: C1, C2, V4, 226c, 106c, 111.

## Update 2026-10-13 - V4 landed - C83. packages/shared is free.
| Agent | Rows | Owns |
|---|---|---|
| 191c | seal writer of audio.absentOnRestart; transcript read of superseded rows; README limit 7 text as a request | apps/core-server/src/sealing (manifest build), sealing-host/session-reader.ts, the transcript's interval read |
| 146c | UNREACHABLE outcome entry | modules/capture-discovery/adopted-test.ts, adopted-test-route.ts and tests |
| D2 | schema value set: alias removal reasons (version 11 -> 12) | db/schema, migrations, value sets, schema-version pins; host-alias lifecycle's two reason sites by ONE edit each |
- In flight: C1, C2, 226c, 106c, 111, 191c, 146c, D2.

## Update 2026-10-13 - row 226c landed - complete, adopted (closes the three defects of C81)
- (1) the boot hands the key id of its one loaded certificate through a control door `judgedSigningKey()` after the checks pass; `signerHeldToBoot` refuses ACTIVE_KEY_CHANGED when taken and before each signature; seal, export and transcript revisions take the ONE held signer. (2) CERTIFICATE_NOT_VALID_NOW on app.clock at each signature. (3) the signer's reason goes to the Core's log and error log; the job code is unchanged (no contract member for it - request, non-blocking).
- Decisions accepted: REAL_DEVELOPMENT is bound too (check 4 loads the store there); transcript revisions use the kept signer, so after a rotation they are refused until restart (consistent with C77; into the installer note); the lazy order ends SIGNER_UNAVAILABLE.
- Checks: unit 1655 passed; database 245 passed; typecheck 0; boot/checks.ts still 3dfea759. Row-229 driver re-run: 46 held, 0 differences from the design (4 of its expectations updated: 2c, 2d, 5c, 8a). Not run: the worker e2e.
- For row 230 by name: the seed hook's signer is UNHELD (its request); no audit entry of a rotation or a mark (C69 (2)); the receiver's knowledge of a compromise mark (C83); whether a compromised key's package may be exported with the notice (227b); the retained fingerprints' out-of-band hand-over.
- Launched: row 230 (security review of rotation and the installation binding as built). signer, sealing-host, boot, evidence-export, evidence-verify are FROZEN until it returns.
- In flight: C1, C2, 106c, 111, 191c (sealing manifest build + session-reader: not frozen files), 146c, D2, 230.

## Update 2026-10-13 - row 230 landed - CAUTION, no FAIL - C84. signer, boot, export, verify UNFROZEN.
| Agent | Rows | Owns |
|---|---|---|
| K4 | 228b (reserved test installation ids) + test hygiene (no fixture key under .data/) | capture/boot/index.ts + checks.ts (added lines only), the row-61 fixture in test support, capture/boot/__tests__/support.ts, the fence.db.test.ts fixture lines |
| K5 | 226d (R-5, R-6, R-7) | capture/signer/*, cli rotate/mark files, sealing-host/index.ts door |
- Step V5 (R-1, R-2, R-3) after D2 lands (packages/shared and the schema pins are moving now).
- PUT TO THE USER (non-blocking): destroy a retired key's private half or keep it (R-10); the 322 fixture folders.
- In flight: C1, C2, 106c, 111, 191c, 146c, D2, K4, K5.

## Update 2026-10-13 - row 106c landed - C85
- Static set at its end: 1153 passed / 3 failed, attributed: capture static SR-2 = row 111 (in flight); test/static/cli.test.ts = K5 (cli rotate/mark files, in flight) or 111; test/static/search-path.test.ts = row 111's new module (in flight). Judged at their returns.
- In flight: C1, C2, 111, 191c, 146c, D2, K4, K5.

## Update 2026-10-13 - row 191c landed - complete, adopted (closes C73's "not yet enough")
- The seal writes the OPTIONAL signed member `audio.absentOnRestart` (per restart: earlier and later attempt, both bounds in ms) from the session's stored CAPTURE_AUDIO_ABSENT_ON_RESTART audit rows through the reader's existing READ_SEAL_AUDIT_ROWS; no statement or schema change. A malformed gap entry STOPS the seal (accepted: a seal that cannot state the gap truthfully does not sign).
- BYTE IDENTITY for sessions without a restart: two fixtures sealed before (twice) and after - session-manifest.json and the signature files identical by cmp. Scenario with a restart: SEALED, the signed member equals the stored entry, Core verify 15/15, export COMPLETE, receiver verify 7/7.
- The transcript states superseded interval rows 0..0. Unit 118 (+1 skipped), database 94 (+3 skipped; seal-e2e.db.test.ts needs DEMS_SEAL_E2E=1 - part of c06's list), static and area 1068.
- STILL OPEN from 191b, stated: `timeline.recordingDurationMs` spans the session and is longer than the audio track - now explained by the signed member; README limit 7 gets the text (request line, document row). The INTERRUPTED seal path was not run: row 184's WRITE_FAILED keeps its diagnosis row.
- Reds seen: test/static/search-path.test.ts:94 on D2's migration 0027 (D2 in flight); two typecheck errors in capture/boot/__tests__ (K4 in flight).
- Gate M6's precondition "the audio gap is a fact of the signed evidence" is met on doubles.
- In flight: C1, C2, 111, 146c, D2, K4, K5.

## Update 2026-10-13 - row 146c landed - complete, adopted (closes C75 (1))
- Every stored-credential test that reached the reader now has a RESULT in the audit: passed / authentication refused = reveal + outcome with usableProfileCount; unreachable after the reveal or relay not startable = reveal + UNREACHABLE (count 0); nothing stored = the reader's entry + CREDENTIAL_NOT_READ; the reader's own destination gate = 1 entry CREDENTIAL_NOT_READ; adapter refused before a request = reveal + NOT_SENT. Refused BEFORE the reader (429 guard, 404, no network configuration) = 0 entries, by the contract's sentence "Refusals before the credential is read and before any request leaves the Core, with no audit row".
- Decisions accepted: a tester fault is recorded as plain UNREACHABLE; an entry that cannot be recorded replaces the 409/503 with a failure (no unrecorded use of a stored credential); the count is usableProfiles.length.
- Unit 25, database with the real relay 15, credentials.test.ts 14 unedited.
- Reds not its own: acceptance pair 6 failed / 76 passed on operations 106/107 and three typecheck errors in factory-scan/index.ts = row 111 in flight; static 2 failed in other rows' files.
- In flight: C1, C2, 111, D2, K4, K5.

## Update 2026-10-13 - row 226d (K5) landed - complete, adopted (R-5, R-6, R-7 of the rotation review)
- R-5: `keyIdSpent` refuses an id when any entry of the store names a series id at or after it. R-6: the mark looks at the directory first, the command shows `found:`, refuses STORE_NOT_TAKEN before the word and looks again after it (STORE_CHANGED). R-7: `signingNow` refuses a null door with the new signer code BOOT_KEY_NOT_JUDGED before any load; SIMULATED and the seed command stay, by comment.
- Left, one non-blocking request: the "before its prompts" refusal of a spent id in cli/production-key-command.ts (it already ends FAILED, KEY_EXISTS with nothing written) -> the next small pass over cli.
- Unit 2295 passed / 2 failed (rows 111 and 228b, in flight); database 240 passed / 7 failed, all fence.db.test.ts on RESERVED_INSTALLATION_ID = K4 (228b) in flight; typecheck 0; row-229 driver: 46 held, 0 differences.
- signer, sealing-host, cli key files are free. Step V5 (R-1, R-2, R-3) is launched when D2 and K4 land.
- In flight: C1, C2, 111, D2, K4.

## Update 2026-10-13 - D2 landed - complete, adopted. SCHEMA IS NOW [12,'dbc-13'], 28 migration files (0026, 0027); next free 0028
- Alias removal reasons gain SHUTDOWN and NOT_ADDED (words from decision C74; the design names none). 18 pin files moved. Drift probe "No schema changes"; test/db 898; apply/rollback/undo + alias db + nine pin files 175; typecheck 0, lint 0. packages/shared and openapi untouched (the reason is not mirrored there). Edits outside its area accepted: core/audit-details.ts:204 (the closed value list) and two lines of the composition test (NOT proven by a run: the boot was refused by K4's in-flight reserved-id check).
- BROADCAST: a test that pins [11,'dbc-12'] now reads toEqual([12, 'dbc-13']); in-flight rows 111 and K4 may still write the old value - the integration pass moves theirs.
- Commit: ONE more schema commit on top of the three steps of C61 (file list in its record, section 8) - four schema commits in order, or one named schema commit of all four if the patches cannot be re-cut honestly.
- Reds, attributed: fence/composition batch 11 failed on CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS = K4 (228b) in flight - the swept suites are not yet given non-reserved ids; acceptance pair 1 failed (getCameraNetworkJob 404) = row 111 in flight.
- In flight: C1, C2, 111, K4.
- D2's own note, NOT closed: `JOB_DONE` is still written for two more cases that are not "a job was done" - the removal at once after an add of UNKNOWN effect (lifecycle.ts:345) and the timer that fires before the stored expiry (lifecycle.ts:259). C74 named only shutdown and never-added. Put by name to the commissioning security review (row 119): whether the existing members cover them (an expiry member exists in the set of six?) or a further value is needed - no third schema step is cut on a guess.

## Update 2026-10-13 - row 228b + hygiene (K4) landed - C86. Baselines: boot/checks.ts 694846fa, boot/index.ts 2d9b9345.
- Earlier red not its own: boot-checks-runner.test.ts:81 - to attribute in c06.
- Launched: V5 (R-1, R-2, R-3 of the rotation review: audit of rotation and mark at the next boot; the receiver's knowledge of a mark; export with the notice) - single writer of packages/shared, every pin, evidence-verify, evidence-export/host.ts, cli/verify-export.ts, the fence's boot record; K6 (cli key commands: a reserved id and a spent id refused before the prompts) - owns cli/production-key-command.ts, cli/rotate-key-command.ts and their tests.
- In flight: C1, C2, 111, V5, K6.

## Update 2026-10-13 - K6 landed - complete, adopted
- Both key commands refuse a reserved installation id as soon as it is typed: `REFUSED, INSTALLATION_ID_RESERVED` ("This installation device id is reserved for tests and demonstration data: no installation may carry it, and a production start refuses it."); no key, nothing written. `evidence:production-key` refuses a spent id or a store not in its needed state BEFORE the first prompt (`REFUSED, KEY_EXISTS` / `STORE_REFUSED`); `evidence:rotate-key` needed no code, pinned with 0 prompts.
- Deviation accepted: two existing cases (226d R-5; 215c case (a)) pinned the OLD order "3 prompts, then FAILED" - their expectations moved to the new order; that is the purpose of the row. The cli static rule gained one allowed import (src/capture/boot/checks) for the reserved list.
- Own + static 81; static set 823 passed with NO red (the static set is fully green at this point); tsc 0. The two .db files of the commands were not run - c06.
- In flight: C1, C2, 111, V5.

## Update 2026-10-13 - row 111 landed - C87. All contract operations 1..110 are routed (no named deferral left).
| Agent | Rows | Owns |
|---|---|---|
| 111b | production inputs of the commissioning functions | the helper table, capture/__tests__/static.test.ts (its pins for new rows only), modules/capture-config/camera-network + factory-scan (the hand-over), fence/production-parts.ts, capture-composition.ts (one hand-over) |
| W2 | 113 (set-IP screens), 118 (acceptance form), the selector panel's slot-sentence cleanup | apps/core-web |
- Held: row 119 (security review of commissioning as built) until 111b lands; then 120+ (M10 code review, gate).
- In flight: C1, C2, V5, 111b, W2.

## Update 2026-10-13 - U21 recorded (fixture folders may go if unused; production on Linux + this Mac; retired private keys kept)
- New row P1 (platform): REAL_PRODUCTION on linux and darwin only, any other platform refused by name; "host profile not asked (platform)" stated in SYSTEM_BOOT and in the sealed manifest - touches capture/boot (baseline checks.ts 694846fa), fence/boot-key.ts (V5 in flight there) and the manifest (optional member, as V4b did): launched when V5 lands.
- New row H1 (removal of .data/test-row61-*): at the quiet point before c06, after C1 and C2 have ended.

## Update 2026-10-13 - row 59 (C2) landed - C88: series green, kill matrix deferred into c06
- The binaries in apps/capture-worker/build are now the relinked ones (the user's instance on 4423 uses the relay there for connection tests only on the user's click - same sources).
- In flight: C1 (container), V5, 111b, W2.

## Update 2026-10-13 - rows 141, 79 (C1) landed - C89. Branch B is FINAL.
- Row 86's dependencies: 141 done, 157 done, 59 done but for the kill matrix (inside c06).
- Launched (read-only / documents, the phase-3 and lift files are quiet): row 60 (code review of phase 3) and row 87 (the texts the lift cites).
- Queue behind the wave: 79b after 111b; P1 after V5; then H1 (fixture folders), integration pass I-9b, suite run c06 with the kill matrix, the commits; then 86 -> 88.
- In flight: V5, 111b, W2, 60, 87.

## Update 2026-10-13 - W2 landed (rows 113, 118, slot-sentence clean-up) - complete, adopted
- 113 set-IP screens (features/commissioning/set-ip.tsx, set-ip-model.ts): target address, MAC from the neighbour table, MAC after authentication; set-IP starts only from a row of the last scan; no show-password control. The typed credential: uncontrolled inputs never in React state; in no URL, router state, storage, log or cache; emptied on submit, Cancel, unmount, router navigation and pagehide; the error boundary quotes no error; operation 106 on the Try-it deny list - each asserted by a test.
- 118 acceptance form (acceptance.tsx, acceptance-model.ts). Clean-up: the selector panel reads `common.captureSlotRefusal` as its one source; the production-camera sentence pinned word for word.
- Checks: 9 files / 299 passed; nine tree-walking suites 270; tsc -b 0; oxlint 0 (run 1 had one failure in its own new negative control).
- NOT accepted silently: "the six acceptance step codes are the console's own" - the step list of an installation acceptance is part of what is RECORDED as accepted; it must come from the specification / the hardware acceptance chapters, not from a screen. Put by name to the commissioning security review (row 119) and to the contract's text pass; until ruled the form is a draft of the list.
- No browser check was made (stated): the scripted browser session of the gate covers commissioning settings, scan, set-IP, acceptance, the re-address dialog and the slot refusal.
- apps/core-web is free. In flight: V5, 111b, 60, 87.

## Update 2026-10-13 - row 111b landed - C90
- Launched: row 79b (the microphone helper's argument row accepted by the pinned FFmpeg on both platforms) - owns capture/adapters/local/mic-helper-args.ts line 208 and its tests + a container run; row 119 (security review of the commissioning functions as built; read-only) with SR-12, the conflict flag, the acceptance step list, the two remaining JOB_DONE cases, D-1..D-11 of row 105, the 500 on a clock that went back.
- In flight: V5, 60, 87, 79b, 119.

## Update 2026-10-13 - V5 landed - C91; row P1 launched (platform: production on linux and darwin only; "host profile not asked" as a fact of the evidence - U21 (2))
- P1 owns: capture/boot/checks.ts + index.ts (added lines; baseline checks.ts 694846fa), capture/fence/boot-key.ts + fence/index.ts (one optional SYSTEM_BOOT member), the manifest's optional member through packages/shared (single writer now) and the seal's writer for it.
- I-9b list: engine/__tests__/boot-checks-runner.test.ts:81; kept-tables of the demo reset; schema pins of rows written at [11,'dbc-12'] by in-flight rows; S1's planted control for aliasTransport / aliasInterfaceFile; README keys.
- In flight: 60, 87, 79b, 119, P1.

## Update 2026-10-13 - row 87 landed - needs-review, adopted as a DRAFT for row 88
- decisions/087_lift_texts.md rewritten (+214/-147 against the draft committed in 7969f0fa: an earlier pass of this same row; the earlier text is in git). CONTROLLER'S ERROR: I launched row 87 as open without seeing that a draft of it was committed in batch 1-2 - the second time (row 109); the check "blueprint status AND git" that I ordered after row 109 was not made for this row.
- The four texts: AM-1 (D86 C-5 amended for ONVIF_RTSP and USB_AUDIO, stage 1 in code, on U15); H.5 guard (4) ("declared" kept, not proof of fitness); E-A2 (credential.ts:12-14: one process, one caller); addendum 1.6 #3 (:143: the three runtime-role grants).
- Its reading was partial (13 records in part, 6 by status line - listed in its section 0): the texts are a draft that row 88's driver checks against the code it changes, and row 86 reads before the lift.
- Preconditions it lists as NOT met are the lift's tick list: row 86 not run; kill matrix 0 of 35 (c06); SR-10 / SR-11 (and now SR-12) unconfirmed; the items put to row 86; AM-1 not yet recorded in decisions.md (the controller records it when row 86 passes); the grants re-read at the lift; row 200's remainder; row 79b (in flight); row 88's own cell; U18 (agents: search and connection test only on real devices - the lift is proven on DOUBLES; a recording from the user's cameras is the user's own act or needs their word).
- CONTRADICTIONS it found between sources, each to be settled by the row named: the design addendum :240/:693 (the relay composes the user-part form) against relay_core.c:181-182 and record 041 -> row 60 (code review, in flight) / document row; the security addendum :149-150 cites migration 0005 lines 27-31, 38-39 where the file reads 24-28, 39-40 -> document erratum; verification/02_security.md:316 against the evidence specification :1136 -> row 86; a HYPOTHESIS: production on this Mac (U21) against production-parts.ts:273, 286 (the card listing is Linux only) - consistent with P11: on this Mac a production Core has NO production microphone path, cameras only -> stated to the user, README; the blueprint :1082 against "AM-1 in force from row 88's commit" -> row 88.
- In flight: 60, 79b, 119, P1.

## Update 2026-10-13 - a read-only code question answered (agent Explore) - C92: no production session can start on macOS (two production microphones required; USB_AUDIO lists cards on Linux only)
- Facts: packages/shared/src/sim/capture-notices.ts:385, :474-480; session-machine.ts:509-510, :841-843; apps/core-server/src/modules/capture-config/plan.ts:124-125, :148-152, :213-214; capture/adapters/registry.ts:36, :80, :82, :132; adapters/kinds.ts:73; adapters/real.ts:59-62; capture/fence/sources.ts:87, :107, :125-129, :246; fence/production-parts.ts:273, 286; capture-session/index.ts:815, :858, :866, :1830. Not checked by it: the body of usb-audio-production.ts; whether the boot wires relayReports (row 85b's record says the composition does).

## Update 2026-10-13 - U22: a macOS production microphone path is in scope. Design row M1 launched (data-analyst; reads code, writes masterplan/06_design_macos_microphone.md; no source change).
- In flight: 60, 79b, 119, P1, M1.

## Update 2026-10-13 - row 60 landed - C93; rows 60b (second pass, read-only), R1 (relay report reader), R2 (named entries, the refusal sentence, the selector refusal) launched
| Agent | Owns |
|---|---|
| R1 | capture/adapters/camera/onvif-relay.ts (the report reader), capture-session/ingest-pairing.ts + its call sites in capture-session/index.ts, camera-watch.ts if the reports feed it |
| R2 | src/capture/__tests__/static.test.ts (two named entries), apps/capture-worker/relay-check.sh comment/erratum, modules/capture-discovery/connect/service.ts (the refusal's reason), modules/capture-config assignment rule (same device on both video slots) + the one shared sentence it needs |
- In flight: 79b, 119, P1, M1, 60b, R1, R2.

## Update 2026-10-13 - row 119 landed - CAUTION, no FAIL - C94 (reverses C49 (1); SR-10/11/12 confirmed; helper NOT released)
| Agent | Owns |
|---|---|
| H2 | scripts/host/netalias/* (the helper, its unit files unchanged unless needed) and its test suite |
| D3 | db/schema value sets + migration 0028.., schema pins; capture/host-alias/lifecycle.ts two reason sites; core/audit-details.ts closed list line |
- Held: V6 and HC until P1 lands; W3 (web) after V6.
- In flight: 79b, P1, M1, 60b, R1, R2, H2, D3.

## Update 2026-10-13 - row 79b landed - complete, adopted (closes the defect of C89)
- The production microphone helper's row: `-channels` + word '1'..'64' -> `-ch_layout` + word '1C'..'64C' (closed set LINUX_CHANNEL_LAYOUTS, chosen by the live card's channel count). Container b914f7078f7b: the 18 cases of test/079 ACCEPTED 18 of 18; counts 1-64 accepted 64 of 64. macOS: 53 passed; generated capture PASS (mono, 48 kHz); development rows unchanged (they never carried an input-side channel option). Static/unit 163; tsc 0. SR-4 pin moved by exactly this row.
- Decision accepted: row lines of audio/__tests__/usb-audio-production.test.ts re-stated (they pinned the old words).
- NOT run: a whole Core-and-worker session with the new row (the scripted capture only) - the first full session on doubles (row 89) and 9A/H-07, H-08 cover it.
- For the collectors' follow-up row (C49 (3)): scripts/hardware-acceptance/collect-h08.sh does not know `-ch_layout` (blocks reading 9A/H-08.6).
- The lift's tick list: "row 79b" is ticked.
- In flight: P1, M1, 60b, R1, R2, H2, D3.

## Update 2026-10-13 - M1 landed (design of the macOS production microphone path) - needs-review; its security review M2 launched; no code before M2 (U22 (1))
- masterplan/06_design_macos_microphone.md: listing by three fixed rows (ioreg, system_profiler, the helper's device list); identity by USB id + serial where stated + location id, the capture index tied by name uniqueness across the three lists, any doubt refused; capture `-f avfoundation -i none:<n> -af pan=mono|c0=c<k>`; the device must run at 48,000 Hz; the microphone permission is not checkable without an open; proposed amendment SR-14; eight build rows (4 S, 4 M); no contract or schema change.
- Stated by the designer: it read the specifications by section, not in full; it ran `system_profiler SPAudioDataType -json` twice OUTSIDE the command sandbox (inside it the list came back empty), values redacted - within its brief (form of the output only), noted.
- What it saw of the user's set-up, as counts only: ONE interface with six inputs, running at 96 kHz.
- Not determinable without opening a device: index selection and list-order stability in the pinned build; who macOS asks and what a denial looks like; two helpers on one device and the channel order; the helper on unplug; the delivered rate.
- Questions put to the user now: one interface (two of its channels) or a second device; set the device to 48 kHz; may agents run the device list; may an agent open the microphone. Taken as defaults unless the user says otherwise: the production Core on this Mac is started by a launcher as row 232's instance was; two same-model devices are both refused; the path is "built, not fit to record" until the rate check passes.
- In flight: P1, 60b, R1, R2, H2, D3, M2.

## Update 2026-10-13 - U23 recorded (two channels of one interface; user sets 48 kHz; agents may list; agents may OPEN the USB interface - D163 lifted for it, not for the built-in devices; U18 unchanged for cameras). Sent to M2 (design review in flight).

## Update 2026-10-13 - row 60b landed - 1 BLOCKING (event-loop stall by one device reply) - C95
| Agent | Owns |
|---|---|
| B1 | capture/adapters/camera/onvif-session.ts, onvif-network.ts (the reply bound and pre-check), their tests |
| B2 | modules/devices/status.ts (S-01, with a request for the contract's nullable member), src/capture-composition.ts :484/:494 (S-02) |
| T2 | apps/capture-worker/test/relay_unit_test.c, test-fixtures/row143b_source_bind.py, relay-check.sh selftest controls; camera/__tests__/onvif-session.test.ts (two weak cases - B1 edits the same test file: T2 waits for B1's claim line and edits by small additive edits); capture-discovery/connect/__tests__/service.test.ts (the flake) |
| 60c | read-only third pass |
- In flight: P1, R1, R2, H2, D3, M2, B1, B2, T2, 60c.

## Update 2026-10-13 - R2 landed (review follow-ups F3-02, F3-03, RC-6 erratum, F3-06 at the Core, F3-11) - complete on doubles, adopted
- NAMED ENTRIES: SR-14 (capture static SR-2 (2): `stored-address.ts`, symbols `admitted`, `storedCameraSourceOf`, the member `sourceAddress` in three pinned lines) and SR-5 entry 2 (`OnvifTimeReader.read` admits a third parameter `fromAddress`), each with its planted control. The plain forms of the code were left (three places / about 12 test calls) - request line, a later tidy pass.
- NUMBERING, ruled: SR-14 is R2's entry (landed). The amendment the macOS microphone design proposed under the number 14 becomes SR-15 if the design review confirms it; SR-13 stays reserved for the scan's device count.
- RC-6 erratum: section 12 of verification/06_security_relay_client.md and one README bullet.
- F3-06: the Core's refusal now carries reason `COMMISSIONING_NOT_CONFIGURED` (existing member), 409 kept; the WEB still shows its generic sentence - NOT closed for the operator: the next web row.
- F3-11: `CAMERA_ON_BOTH_TRACKS` (existing word) on operations 78/79 in real capture only; the start rule refuses with PROTOCOL_SHAPE. Pinned tests re-stated: plan.test.ts's DUAL-LENS case and three service.test.ts expectations. NOTE FOR THE USER AND THE NEXT REFINEMENT: an existing test had pinned "one dual-lens device on both tracks" as ADMITTED by the plan builder; it was never recordable (the worker protocol refuses it), and it is now refused at assignment. input-av shows dual-lens cameras as two cameras: whether DEMS must record both lenses of one device is an open scope question, not built.
- Checks: capture static 72; static set 966; unit 66; relay-backed 33 (serial re-run); database 162 passed / 1 failed = D3's schema pin (in flight); typecheck 2 errors in P1's file (in flight).
- In flight: P1, R1, H2, D3, M2, B1, B2, T2, 60c.

## Update 2026-10-13 - M2 landed (design review of the macOS microphone path: CAUTION, 0 FAIL, provisional) - C96
- Row MM (bounded measurement on the user's USB interface) WAITS for the user: present at the Mac, interface set to 48 kHz, told about the per-application standing grant. After MM: the reviewer's addendum, then the eight build rows (design section on work packages), amendment SR-15.
- In flight: P1, R1, H2, D3, B1, B2, T2, 60c.

## Update 2026-10-13 - row P1 landed - C97. Baselines: boot/checks.ts dfb1a117, boot/index.ts 5a264525. packages/shared and capture/boot are free.
- Launched: V6 (contract + Core for R119-03, R119-04, R119-06, R119-07, R119-08, R119-09; the nullable track facts of S-01 if B2 requests it; the verdict line for hostProfileNotAsked) - single writer of packages/shared and all pins; HC (host checks: helper absent = stated fact / present-but-wrong = refusal (C94 j); the rule table (C49 (2)); a non-constant socket path refused (C53 (4c), R119-10); a code of its own for "no facts handed in" (C55 DD-2)) - owns capture/boot/host-checks.ts, program-checks.ts, checks.ts + index.ts (added lines against the new baseline), fence/boot-key.ts for one optional SYSTEM_BOOT member.
- In flight: R1, H2, D3, B1, B2, T2, 60c, V6, HC.

## Update 2026-10-13 - H2 landed (helper fixes R119-01, R119-02) - complete on doubles, adopted; the helper is STILL NOT RELEASED
- R119-01: an `add` needs (a) the program `/usr/bin/arping` of package `iputils-arping`, checked WITHOUT starting it against dpkg's file list and MD5 record; (b) the port's flag words from the existing `ip -json -4 addr show` say it can be asked; (c) the whole printed result agrees with the exit status; anything else refuses. R119-02: a mark stands only inside its recorded lifetime and while the kernel lists the address with a lifetime no longer than asked; stale marks dropped on every add and marked del (residual: the file sits until the next call; nothing acts on it).
- New codes 38 CONFLICT_TOOL_NOT_EXPECTED, 46 INTERFACE_NOT_ARPABLE, 47 INTERFACE_DOWN, 48 INTERFACE_STATE_UNKNOWN, 55 CONFLICT_RESULT_UNKNOWN. Decision accepted: a camera port without an IPv4 address is refused (48).
- Suite: 75 tests OK (second run; the first caught one defect of its own). New SHA-256 of the helper: 1e758a24...c7d015b1.
- STATED WEAKNESS: the text forms of `arping`, `ip -json` and the dpkg record it parses are from recollection, not captures - each fails closed, but a wrong form means the helper refuses every add on a real host. Row H3, launched now: capture the three real forms in the Ubuntu 24.04 container (read-only commands inside the container; no host network touched) and run the helper's parsers against them; then the security reviewer's statement on S13-08..S13-10 is asked again on the hash that survives.
- I-9b list gains: capture/host-alias/protocol.ts maps codes 38, 46, 47, 48, 55 (until then the Core answers HELPER_ANSWER_NOT_UNDERSTOOD - a refusal).
- In flight: R1, D3, B1, B2, T2, 60c, V6, HC, H3.

## Update 2026-10-13 - B2 landed (S-01 partial, S-02 done) - needs-review, adopted as built
- S-02 done on doubles: a camera or microphone loss that arrives before its watch is attached is KEPT (64 per watch), reported at once as an error and handed over at the attach; a superseded microphone loss is still dropped.
- S-01 PARTIAL: the contract can say "not stated" only for `fps`. A real Core now answers `1080p`, `H.264` and NO rate for a track without a stored stream statement (before: `1080p / 25 / H.264`) - picture size and codec are STILL not a stream's statement. The rest is V6's item (7) (message sent): `resolution` and `codec` nullable, the Core branch, the readers.
- The fact that bounds the harm today (5 existing tests): row 187 refuses assigning a production camera without a stored profile; the adapter refuses PROFILE_UNKNOWN - so no production recording can run on such a track; what is wrong is what an operator is SHOWN.
- Its unit run was not repeated after a final test-title edit - c06.
- capture-composition.ts and modules/devices/status.ts are free (status.ts handed to V6 for one branch).
- In flight: R1, D3, B1, T2, 60c, V6, HC, H3.

## Update 2026-10-13 - row 60c landed - C98: 18 tests would survive a mutation; earlier "proven" claims downgraded until T3
- Held rows: T3 (test strengthening + ports and locks of the camera database tests) until B1 and T2 land (same test files); W4 (readers: bitrate literal, tablet device detail, CameraPreview, the 409 sentence of F3-06) until V6 lands; 60d (fourth reading pass) after B1, T2, V6.
- In flight: R1, D3, B1, T2, V6, HC, H3.

## Update 2026-10-13 - D3 landed - complete, adopted. SCHEMA IS NOW [13,'dbc-14'], 30 migration files (0028, 0029); next free 0030
- One new value, the review's word: ADD_UNCONFIRMED (the removal at once after an add of unknown effect). The lifetime timer now writes the EXISTING member EXPIRED. JOB_DONE is left for the end of a job only (closes R119-05 and D2's own note).
- Decisions: (1) a retry keeps the reason and actor of the removal it repeats - ACCEPTED (else every retry would say EXPIRED); (2) NOT built: a row closed after the helper's NOT_MARKED answer as NOT_ADDED - it needs journal.ts and a ruling: RULED - a helper answer "not marked" on a removal means no mark of the Core's stands for that address; the row closes as NOT_ADDED only when the row's own add never got a result of "added"; when it did, the mark was lost by other means (reboot, hand) and the honest close is EXPIRED if past its time, else the removal's own reason with the helper's code in the audit detail. Small item for integration pass I-9b (capture/host-alias/journal.ts).
- 18 pin files moved; drift probe "No schema changes"; test/db 929 (1 own red fixed), re-run batch 179; other batches passed with 1, 1 and 6 reds in in-flight rows' files (V6, HC, the acceptance pair under V6); typecheck clean in its files; lint 0. packages/shared untouched.
- Schema commits now five steps in order (202, 51b, 114, D2, D3) or one named schema commit.
- BROADCAST: pins read toEqual([13, 'dbc-14']).
- In flight: R1, B1, T2, V6, HC, H3.

## Update 2026-10-13 - H3 landed (the helper's parsers against real captures in the Ubuntu 24.04 container) - complete, adopted
- Helper 1e758a24...c7d015b1 unchanged. dpkg records and the program check: 9 states, 0 mismatches (`/usr/bin/arping` is neither an alternative nor a diversion; the two arping packages conflict both ways, the other program lives at /usr/sbin/arping; a correct installation passes; the other program gets 37 or 38). `ip -json -4 addr show` flag words: 9 interface states, 0 mismatches. `arping -D` text and exit status: 14 cases, 0 mismatches. A correct installation is NOT refused, also under the unit's two capabilities with no-new-privileges.
- Worst fact (not a mismatch): on a port that is up WITHOUT CARRIER `arping -D` prints the complete FREE text and exits 0; only the flag check (no LOWER_UP -> code 47) stops it. So the flag check is load-bearing: named for the reviewer.
- 21 captured texts added under scripts/host/netalias/captured/ (read by no test yet): the helper's suite should read them - a small item for the helper's owner (I-9b).
- Capabilities used: NET_RAW for the arping container; NET_RAW + NET_ADMIN for one container; no container, network or image left.
- Launched: row 119b - the security reviewer re-states (or refuses again) "S13-08 to S13-10 are closed in the helper as delivered" on hash 1e758a24 with the evidence of H2 and H3.
- In flight: R1, B1, T2, V6, HC, 119b.

## Update 2026-10-13 - R1 landed - C99. New row R1b (video absence in the signed manifest) queued behind V6.
- In flight: B1, T2, V6, HC, 119b.

## Update 2026-10-13 - B1 landed - C100 (blocking B-01 closed in the tree)
- New file capture/adapters/camera/onvif-reply-guard.ts; one named entry in capture/__tests__/static.test.ts (this explains R1's static red at :646 - B1 mid-edit; to confirm green in the next static run).
- Reds not its own: fence/__tests__/fence.test.ts:294 and two typecheck errors in boot/__tests__/program-checks.test.ts = row HC in flight.
- T3's list gains: the WWW-Authenticate parse measured for the quadratic shape.
- In flight: T2, V6, HC, 119b. T3 starts when T2 lands; W4 and 60d when V6 lands.

## Update 2026-10-13 - row 119b landed - C101: the helper statement is MADE for hash 1e758a24 (conditions C-1..C-4; C-3 not met: the hardware chapter prints the old hash)
- Document row's list gains: HW-ACCEPTANCE-4 lines 151, 185, 489 and record 104 (the hash); HI-06 and 9A/H-25 (the five new refusals); two lines for 9A/H-06.
- In flight: T2, V6, HC.

## Update 2026-10-13 - HC landed - C102; row HC2 launched (container measurement: may an unprivileged, capability-less process list the nft table?)
- Baselines: boot/checks.ts 90b3a1e6, boot/index.ts 63fe763e.
- In flight: T2, V6, HC2.

## Update 2026-10-13 - U24 recorded (agents may record from the USB audio interface and from the real cameras - saving from the source only; passwords and OS dialogs/settings stay the user's). Row MM launched.
- In flight: T2, V6, HC2, MM.

## Update 2026-10-13 - HC2 landed - C103 (reverses C49 (2)): an unprivileged capability-less process CANNOT list the nft table; row HC3 launched to take the table check out again
- HC3 owns: capture/boot/host-checks.ts, checks.ts + index.ts (baseline 90b3a1e6 / 63fe763e), the helper table's nft row and its entry in capture/__tests__/static.test.ts, their tests.
- In flight: T2, V6, MM, HC3.

## Update 2026-10-13 - MM landed - C104: four results contradict the macOS microphone design
- Waiting for the USER: the interface set to 48,000 Hz (Audio MIDI Setup); a second microphone on another input if a STANDBY is wanted. Then row MM2 (re-measure at 48 kHz: the sample loss, the 1-in-10 refused open, one helper with two outputs) and the design revision M1b with the reviewer's addendum.
- In flight: T2, V6, HC3.

## Update 2026-10-13 - HC3 landed - complete, adopted (carries out C103)
- Removed from boot/host-checks.ts only: the `nft list table` row and parser, four constants, the three RULE_* reasons (no other user), the static entry and control, 7 test cases. Stayed: CAPTURE_HOST_LOOPBACK_RULE_MISSING / RULE_UNIT_NOT_ACTIVE (row 80's unit check), and row HC's items 1, 2, 4. A why-not comment stands at the check.
- Baselines UNCHANGED: boot/checks.ts 90b3a1e6, boot/index.ts 63fe763e (zero hunks); host-checks.ts fd7e637d -> 9d5d1341.
- Unit 799; typecheck 0; lint 0; database 68 passed / 1 failed = capture-composition.db.test.ts:924, attributed to V6 (in flight) by two agents now - judged at V6's return.
- Two stale words "C49 (2)" stay in comments at checks.ts:68 and index.ts:134 - a tidy item for the close chain (those two files are baselined; a comment edit moves the blob, so it is batched with the next real change).
- capture/boot is free. In flight: T2, V6.

## Update 2026-10-13 - T2 landed - complete, adopted
- Each strengthened test shown RED on a mutant and green on the tree: relay_unit_test.c (bind line removed: 7 of 989 checks failed; tree 989 passed); row143b probe_from_loopback (relay built without the bind: FAIL; tree 14 of 14) - decision accepted: a host with no second address FAILS that case; onvif-session.test.ts (localAddress/family dropped: 3 failed; the guard's depth bound removed: red; tree 62 passed).
- S-07 was WORSE than the review said: 35 of 82 rule statements of relay-check.sh (not 18) could be deleted with the selftest green; after 35 own-message controls: 0 of 82.
- The flake at service.test.ts: the random byte after the secret is `x` 1 time in 256; fixed form 0 failures in 2,000.
- row58_gate x20: INGEST_OPEN_STUCK 0 of 240 sessions (load 7.7-22.7). Two runs were 11/12 for causes of the session itself: port 8561 held by its own UNLOCKED run of onvif-session.test.ts, and a leftover check. FINDING for T3: a UNIT test (onvif-session.test.ts) binds 8561, a worker-listener port, without a lock.
- Worker make rc 0 (capture-relay re-linked, sources unchanged), check.sh rc 0, static set 778. tsc rc 2: three errors in installation-acceptance tests = V6 in flight.
- Launched: T3 (the remaining mutation survivors of 60c; ports and locks of the camera tests incl. 8561 / 8565 / 8557; the WWW-Authenticate parse measured).
- In flight: V6, MM2, T3.

## Update 2026-10-13 - V6 landed - C105. packages/shared, apps/core-web, apps/mobile and the commissioning modules are free.
| Agent | Rows | Owns |
|---|---|---|
| R1b | video absence as a signed fact (C99) | packages/shared (audit type, optional manifest member, verifier acceptance), the seal's manifest build + sealing-host/session-reader.ts, capture-session statements if a stored field is needed (no schema change) |
| W4 | readers (C98 R-01, R-02, CameraPreview; F3-06's sentence on the web; the state-stream slice of S-01 if it is a reader-side change) | apps/core-web, apps/mobile reader files; NOT packages/shared (R1b) - requests |
| V6b | operation 109's clock guard; R119-09 | modules/capture-config/installation-acceptance, capture/adapters/camera/onvif-network.ts (T3 edits its TEST file) |
- 60d (fourth reading pass) after W4 and T3.
- In flight: MM2, T3, R1b, W4, V6b.

## Update 2026-10-13 - MM2 landed - C106: at 48 kHz about 10% of the audio is STILL lost (whole 512-sample packets); row MM3 (cause and remedy of the loss) launched
- In flight: T3, R1b, W4, V6b, MM3.

## Update 2026-10-13 - U25 recorded (microphone used as it is; poor quality accepted; the loss is stated in the evidence, not hidden). MM3 keeps running; the design revision M1b is cut when it returns, whatever it finds.

## Update 2026-10-13 - V6b landed - complete, adopted
- R119-08 for operation 109: the guard is INSIDE the INSERT (`INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM installation_acceptances stored WHERE stored.accepted_at > $1 OR stored.revoked_at > $1) RETURNING ...`); no row = the clock is behind. The folder's "no SELECT" rule gained ONE named entry CLOCK_FLOOR_ENTRY = that clause word for word, with planted controls - ACCEPTED: the rule's purpose (no read of an acceptance that could gate a recording) is kept; the clause reads only instants to refuse a write.
- Decision, accepted as an interim: 109 answers 409 INVALID_STATE with reason INSTALLATION_ACCEPTANCE_IN_FORCE when the clock is behind, because the contract lists INSTALLATION_CLOCK_BEHIND_RECORD for 110 only - inexact when none is in force. Routed: R1b adds the member to 109 (message sent); the route's switch to it is an I-9b item.
- R119-09: `authorizedAsk` answers before arming when settled; `arm` does nothing once settled; one test, red before the fix.
- Checks: folder unit 27; folder database 16 (second run; the first had 1 failure of its own); camera unit 304; static 654; typecheck 0. Acceptance pair + folder db: 208 passed / 3 failed = the OpenAPI byte comparison (R1b's pending regeneration) and T3's in-flight lines.
- DEVIATION noted: its last run started camera-adapter-open.db.test.ts WITHOUT the heavy-host lock (T3 is giving that file its lock).
- In flight: MM3, T3, R1b, W4.

## Update 2026-10-13 - MM3 landed - C107: no lossless arrangement with the pinned FFmpeg (about 90.3% of samples; the cause is the input's read pacing). Design revision M1b launched (U25: built as it is, the shortfall measured and stated).
- In flight: T3, R1b, W4, M1b.

## Update 2026-10-13 - W4 landed (live readers on web and tablet) - needs-review, adopted with one ruling
- On a live Core: a track without stream facts reads "Format: Not stated"; a camera in fault reads "Stream lost" / "Not reachable" / "No signal" in the place of the facts (no stale values); the web never draws a bitrate on a live Core (by mode - the member is not nullable yet: requested of R1b); the tablet's device detail of a production camera shows status, id, stored format and recording state only (never the simulator's record); the web's readers (No-preview tile and the others of the review's list) and the F3-06 sentence done. Both apps decode the selector line's stored profile code and never read the slice.
- RULING it asked for (a format beside a recording: the web Session Monitor now shows the stored format, the tablet does not): the TABLET stays as task 3's decision D222 (2) pinned it - its feed chip is not changed by this task (connecting-meters.test.tsx keeps its pin); the WEB shows the stored, stream-stated format. The difference is deliberate and noted for the UI judging of the gate.
- Pins moved (2): the web's recording bitrate figure; the tablet's production-camera chip text. Simulated mode unchanged elsewhere.
- Checks: web 59 files / 772; tablet 409 and 436; typecheck and lint 0 in both apps. No browser or emulator check (stated) - the gate's scripted session.
- Tidy list: one shared stream-facts decoder (three copies now).
- apps/core-web and apps/mobile are free. 60d (fourth reading pass) starts when T3 lands.
- In flight: T3, R1b, M1b.

## Update 2026-10-13 - R1b landed - C108. Counts: 110 operations, 83 audit types, 51 actions. packages/shared is free.
- Row 90's list gains: a dropped camera leg with the BUILT relay, sealed - the signed member from real reports.
- Next shared step (small): bitrateMbps nullable; F3-06 sentences to shared i18n; a verifier line for audio.absentOnRestart; the macOS microphone shortfall member when M1b's design is reviewed.
- In flight: T3, M1b.

## Update 2026-10-13 - M1b landed (macOS microphone design, revision 2) - needs-review; the reviewer's addendum M2b launched; no build row before it
- Revision 2 in masterplan/06_design_macos_microphone.md: one helper per device, `none:<n>`, one or two outputs each `pan=mono|c0=c<k>` behind the dropping FIFO; a forbidden list (pad / stretch / re-time); handles form a GROUP (first start launches once, others join; the helper's end tells both); the standby guards a microphone only - notice STANDBY_ON_PRIMARY_DEVICE; the shortfall measured in the WORKER and stated in the audit (CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED) and the signed manifest (audio.samplesNotReceived, optional), silence inserted by the worker and COUNTED; the stream line must say 48,000 Hz (`-ar` a no-op guard); a layout-word table (`5.1` = 6); FIFO lines become notices; 1,000 ms pause after a close, one retry; the bound: above 12.0% in two consecutive 10 s windows (notices MIC_PATH_NOT_SAMPLE_CONTINUOUS at start, MIC_SAMPLES_SHORT_ABOVE_BOUND above the bound).
- THE WORKER TODAY (read, not run): a host-clock timeline that zero-fills (audio.c:436-449, :599) - so no cumulative drift against the picture - but it would STRETCH up to 5,000 ppm (:464-480) and reports the zeros only in an end log line (:651-655). The design's change: a pipe kind PCM_FIFO_GAPPED - no stretch, counts reported. THIS TOUCHES THE WORKER'S C SOURCE (apps/capture-worker/src): BR-11 re-verification (the whole series) is owed again after it.
- 16 build rows (8 S, 8 M) plus the addendum - twice revision 1's size.
- Requirements of the design review that CANNOT be met as written, by measurement (the addendum rules each): SM-04 (2) the channel count is a layout word; SM-19 (4) two helpers are refused; SM-16 (5) / SM-20 (2) the rate gate; SR-15 (3) needs the `fifo` format; SM-06 no stall bound; U25 (3): the session's SOURCE FACTS are written once at the start, so they cannot state the AMOUNT - the amount is in the audit and the manifest, the source facts state only that the path is not sample-continuous. The production door must also hand on the helper's standard error LIVE.
- In flight: T3, M2b.

## Update 2026-10-13 - T3 landed - C109. QUIET POINT APPROACHING: only the read-only addendum M2b is in flight.
- Launched: 60d (fourth reading pass of the phase-3 review, read-only); I-9b (integration pass, fixed list); H1 (removal of .data/test-row61-* under U21 (1)).
- After them: suite run c06 (with the kill matrix and DEMS_REQUIRE_RECORDED_FILES=1), the commits (five schema steps, then the rest), then row 86.
- In flight: M2b, 60d, I-9b, H1.

## Update 2026-10-13 - H1 landed - complete (U21 (1) carried out)
- 322 directories `.data/test-row61-*` removed (none a symbolic link), about 1,596 MiB freed; before: lsof 0 files held, ps 0 processes, the user's instance (4423/5178) not using them, nothing modified in the last 60 minutes; the only sources naming the prefix use it in an OS-temporary directory or `.cache/test-row61-programs` (boot/__tests__/support.ts, reserved-ids.test.ts). The other 22 entries of `.data/` are unchanged (empty diff of the name listings); no file content under `.data/` was read. Controller's own count after: 0.
- This closes C71 C-4 (ii) and R-4's "growing" count.
- In flight: M2b, I-9b, 60d.

## Update 2026-10-13 - M2b landed - C110: revision 2 of the macOS microphone design is CAUTION, FINAL. Row M1c (design amendment: contract words of SM-29, SM-30, SM-34 (3), SM-36; rows for SM-37 and SM-38) launched. No worker edit before c06.
- In flight: I-9b, 60d, M1c.

## Update 2026-10-13 - U26: the full suite (c06) is POSTPONED to the end of development. Next quiet point (I-9b, 60d, M1c landed): light checks (typecheck x workspaces, static sets) -> a labelled CHECKPOINT commit, no push -> the targeted worker verification with the kill matrix -> row 86 -> row 88.

## Update 2026-10-13 - row 60d landed - C111. Lanes after the checkpoint commit (U26, and the user's question on parallel work):
- A (critical, serial): worker verification + kill matrix -> 86 -> 88 -> 89, 90 -> 91 -> 92.
- B: macOS microphone, non-worker rows (after M1c): listing + identity; helper row + SR-15 rule; ONE contract step; seal refusal; verdict lines/export; transcript; web words. Worker-C rows wait for A's first step.
- C: documents (README, installer note, hardware chapters, collectors).
- D: row 184 diagnosis (seal WRITE_FAILED on an interrupted session).
- E: read-only - 60e (fifth pass: product code never read), M10 code review, gates M5 / M11.
- F: tablet HEVC measurement (controller's device session).
- G: W5 (clients: assign a production camera WITH a stored profile; a faulted track is not "Live") + T4 (four surviving tests) - preconditions of row 88.
- In flight now: I-9b, M1c.

## Update 2026-10-13 - I-9b landed - needs-review, adopted: 7 done, 2 already done / nothing to move, 2 skipped
- Done: (1) the pinned export list knows SYSTEM_BOOT_SIGNING_DETAIL_RULES (the red at boot-checks-runner.test.ts:81 is gone); (2) the Core's client maps helper codes 38, 46, 47, 48, 55 - 41 of 41, the table test passes; helper SHA-256 1e758a24 unchanged (closes R119b-03); (5) operation 109 answers INSTALLATION_CLOCK_BEHIND_RECORD (23505 = in force; empty RETURNING = clock behind); (8) the helper's suite reads the 21 real captures: 75 -> 80 tests, OK; (9) bitrateMbps nullable in four shared types - the web keeps its mode rule because THE CORE STILL SERVES THE SIMULATOR'S 9 IN REAL CAPTURE (finding: the Core's own writer - a small row beside W5); (10) the F3-06 sentences in common.captureConnect; (11) verifier notice AUDIO_ABSENT_ON_RESTART when the member is present (verify notices 6 -> 7).
- Nothing to do: (6) no stale schema pin; (7) already done by row 106c.
- SKIPPED, each a small row of its own: (3) the journal's NOT_MARKED close - no durable "add confirmed" fact exists and HOST_ALIAS_REMOVED's closed rule admits no code member: my ruling in the D3 update could not be built as worded; it goes back as a design point of the commissioning lane, not forced; (4) the demo reset's kept tables (capture_device_streams, capture_network_config, host_network_aliases, installation_acceptances, and capture_audio_inputs by rows 17 / 51b): reset code with a two-column key, a reader reload and eight pin files - a row of its own.
- Checks: typecheck clean in shared, core-server, core-web, mobile; static set 45 files / 778; touched units 781; acceptance pair + two db tests 107; composition 15; shared after the one openapi regeneration 2892; web 145. No red in what ran. Counts: 110 operations, 83 audit types, 15 permissions, 51 actions.
- QUIET POINT: only M1c (one design document) is in flight. The checkpoint commit (U26 (4)) is launched: light checks, then commits by named paths, no push; masterplan/06_design_macos_microphone.md is left out (mid-edit).

## Update 2026-10-13 - CHECKPOINT COMMITS made (U26 (4)); no push; the branch has no upstream
- f20c9b39: schema steps 9 to 13 in ONE commit, 59 files (the five steps share the journal, schema/meta.ts, schema/index.ts, the contract inventory; interactive staging is not available) - C32 kept as "schema apart from the rest", not as five. 1fbeada7: everything else, 679 files (pin files that mix schema pins with other rows' code are here).
- Light checks before them, all exit 0: `npm run typecheck` in all 7 workspaces; static rule sets 47 files / 806 passed; `npm run lint` no errors (3 warnings). NOT run: every unit, database, worker, web and mobile suite, the kill matrix.
- Secret scan, count only: ingest-secret 4, private-key-pem 3, database-password-line 1 - at baseline; camera-credential 58. CORRECTION OF MY BASELINES: I had recorded camera-credential 55 and "the other needles 0"; HEAD (0f5d2a8e) already held camera-credential 57 and private-key-pem 2, and the tree has session-token 20, device-credential 8, biometric-token 8, database-locator 10 - identical to HEAD. So my recorded baselines were incomplete (they covered the needles of rows 5 and 207 as I read them, not the script's whole list). New hits against HEAD: one camera-credential in src/__tests__/capture-composition.test.ts and one private-key-pem in src/core/__tests__/writers.test.ts - both test files. BASELINES FROM NOW, at 1fbeada7: camera-credential 58, private-key-pem 3, database-password-line 1, ingest-secret 4, session-token 20, device-credential 8, biometric-token 8, database-locator 10.
- Left unstaged on purpose: masterplan/06_design_macos_microphone.md (M1c), the stray root file ffprobe-export.txt, the commit's own record. Nothing under apps/input-av/.
- PAUSED (U27). In flight: M1c only (a document).

## Update 2026-10-13 - M1c landed (macOS microphone design, revision 3) - needs-review; RECORDED ONLY, the work is PAUSED (U27). Nothing is in flight.
- masterplan/06_design_macos_microphone.md is revision 3 (815 -> 1,330 lines), uncommitted. Stated by the designer: review 08 and records MM / MM2 were read by outline and section only.
- `audio.samplesNotReceived` (optional): one record per microphone with `sampleContinuity` and, per attempt, `micDeviceId`, `attempt`, `captureLayer`, `captureGroup` (1-2), `account` (CLOSED / NOT_CLOSED / NONE), twelve sample counts (all whole numbers or all null), `openRunFromSample`, and `insertedRuns[]` of `{fromSample, samples}` for runs of 4,800 samples (100 ms) or more, at most 1,024 per attempt, beyond that a count and sum of the runs not listed. Reconciliation: timelineSamples = received - discarded - buffered + inserted; the gapped pipe kind BYPASSES the resampler.
- Notice margin: 1.5 points above the session's own reference, twice in a row (the addendum's 2.0 nearly coincides with the 12.0% floor).
- Worker pin: protocol number 4 -> 5 (worker.h:48 with packages/capture-protocol/src/index.ts:148); the record-kind list gains two.
- 18 work packages (6 S, 12 M); ONE (N3) edits the worker's C source.
- NOT buildable as the addendum worded it - to rule at the resume, before any build row: a SEALED transcript cannot read the signed member (it is hashed first); an engine segment spanning an inserted run cannot be split - it is marked; audit details are flat, so the runs need a second audit type; one verdict line exceeds 256 characters - two notices; "N1 cannot land before c06" - by U26 the worker's baseline is the TARGETED worker verification of lane A's first step, not c06: N1 and N3 wait for that step.

## RESUME 2026-10-14 (U28, C112) - wave 12 launched; map: delegation_progress/wave_12_brief.md
- In flight: A1, N2, N4, N5, N6, N8, W5, CB, C1, C2, D1, 60e, 120.

## Update 2026-10-14 - N8 landed (pure reader of the macOS helper's lines) - complete, adopted
- New: capture/adapters/audio/macos-helper-lines.ts + its test. Typed facts: INPUT_HEADER, OUTPUT_HEADER, STREAM, QUEUE_FULL, QUEUE_FLUSHED (both `output: NOT_STATED` - the helper's queue lines do not say which output: the amount and place of a drop come from the worker, C110 (5)), OPEN_REFUSED, ENDED_ON_SIGNAL, UNRECOGNISED. Layout table: 40 entries from the pinned build's `-layouts`. 20 mutations each seen RED (M12 red by the reason word only). Row tests 33; audio suite + capture static 331; test/static 210.
- Decisions: D1 each layout entry is marked MEASURED (only `5.1`) or BUILD_TABLE, so the adapter (N9) chooses - ACCEPTED, and RULED for N9: a layout that is BUILD_TABLE and not MEASURED is admitted (the table is the pinned build's own), with the channel count ALSO required to agree with the listing's channel count for that device - two sources, not one. D2 a second stream line or header WITHDRAWS the statement - accepted (fail-closed). D6 the input shape `{ text, cut }` was ASSUMED because N5 had not landed: to check against N5's observer at its return.
- Typecheck red (3 errors) at packages/shared/src/sim/capture-notices.ts:367-368 = N2 in flight.
- In flight: A1, N2, N4, N5, N6, W5, CB, C1, C2, D1, 60e, 120.

## Update 2026-10-14 - C2 landed (README and installer note; row 218) - complete, adopted; documents only, nothing run
- README: "The signing key" paragraph; the installation identity table (reserved ids) and the receiver's command (`--compromised`, exit status 3); a new block "Task 4: production key, operator passwords, real cameras, commissioning" before Known limits; Known limits 7, 25, 30, 34 rewritten, 37 one sentence, 46 to 58 added. Command lines copied from package.json (operator:set-password, evidence:production-key, evidence:rotate-key, evidence:mark-compromised, evidence:verify-export, db:migrate, db:seed). No name from the decision rows was missing in the product.
- Confirmed: the README says a missing camera network answers COMMISSIONING_NOT_CONFIGURED, as the product does since row R2 (C70's older word CANDIDATE_NOT_TESTABLE is the status' umbrella, the reason is the README's word). The installer note's "switch transcription off in the SIMULATED first boot" is marked to confirm on the host - kept as a mark.
- Found wrong, outside its list - the close chain (rows 134 / 135): README line 441 and the check-4c refusal row still describe 713d83f; the totals under Tests and the top Ringkasan predate task 4; apps/core-server/src/config.ts:29 gives the now RESERVED id DEMS-IR-01 as an example (a comment in a file with pinned lines: one tidy edit with its static waiver, at the lift's change set or the close).
- README is free for row N16 (the macOS microphone) later.
- In flight: A1, N2, N4, N5, N6, W5, CB, C1, D1, 60e, 120.

## Update 2026-10-14 - row 60e landed - C113; rows E1 (slices.ts streamState) and E2 (camera adapter E-02..E-05) launched; E3 (capture-session E-06, E-07) waits for D1
- wave_12_brief.md row 9 amended by this line: capture/adapters/camera/* is E2's; modules/capture-config/slices.ts is E1's.
- In flight: A1, N2, N4, N5, N6, W5, CB, C1, D1, 120, E1, E2.

## Update 2026-10-14 - row 120 landed - C114 (1 blocking: the helper's suite is red after a restart and its stale-mark tests pass with the rule removed)
- Launched: H4 (helper TESTS only: scripts/host/netalias test files; the helper file's hash 1e758a24 must not move) and 120b (second reading pass, read-only).
- Queued: H5 (helper changes F-1 + R119b-01; new hash; reviewer's statement again; chapters' hash lines) after C1 lands; D4 (interface-name form widened in table + contract) after N2 lands.
- In flight: A1, N2, N4, N5, N6, W5, CB, C1, D1, E1, E2, H4, 120b.

## Update 2026-10-14 - E1 landed with NO change - C115 (the review's file was the wrong place; E-01 is a shared-engine change: row E1b after N2)
- modules/capture-config/slices.ts untouched and free.
- In flight: A1, N2, N4, N5, N6, W5, CB, C1, D1, E2, H4, 120b.

## Update 2026-10-14 - N5 landed (the production door's live standard-error observer) - complete, adopted
- `onDiagnostics?: (event) => void` with events `{ kind: 'line', text, cut }`, `{ kind: 'dropped', lines }`, `{ kind: 'quiet' }`; bounds 512 characters per line, 200 lines per second, 20,000 lines per life; text printable ASCII only, locators blanked; the door logs nothing. Standard error is never paused; the observer is told in a later turn, 8 events per turn, its return not awaited; at most 200 lines wait, overflow dropped and counted. Stated limit: a synchronous long call of the observer still holds the whole Core (the observer of row N9 must be short).
- Unchanged without it: the 10 existing door cases pass unedited (+363/-0 in the test file); 18 door tests; ten mutants each red; capture static 79 after N4's pin.
- N8's assumed input shape `{ text, cut }` MATCHES the line event (C: no change needed in N8).
- Open for the lift's change set (row 88 / N7): rule A-8's pin and the barrel export of the new option type.
- Typecheck red: macos-card-listing.test.ts(308,24) = N6 in flight.
- In flight: A1, N2, N4, N6, W5, CB, C1, D1, E2, H4, 120b.

## Update 2026-10-14 - N6 landed (macOS audio device listing and identity) - complete, adopted, with one gap
- New under capture/adapters/audio/: macos-plist.ts (own strict bounded parser, no dependency), macos-usb-tree-reader.ts, macos-system-audio-reader.ts, macos-helper-list-reader.ts, macos-card-tie.ts, macos-card-listing.ts; 21 synthetic fixtures; card-listing.ts gained the word SYSTEM_PROFILE. Port path = the location id as eight lower-case hex digits; the `usb_port` column's CHECK accepts it (tested against migration 0017). Undecided states: NAME_NOT_TIEABLE, NAME_SHARED, NO_SYSTEM_INPUT, NO_CAPTURE_ENTRY, LISTS_DISAGREE, TRANSPORT_NOT_USB, NO_USB_DEVICE; a whole listing that fails its bounds raises (USB_TREE_UNREADABLE, SYSTEM_LIST_UNREADABLE, CAPTURE_LIST_UNREADABLE). 43 tests; audio suite + static 584; six mutations red.
- GAP, stated: its readers were NOT run on this Mac's real texts (its one permitted run compared shapes only): row N7's first check.
- THREE FACTS FROM THE REAL LISTS, for N7 / N9: (1) the USB interface's HELPER INDEX CHANGED since row MM (0 -> 1, after the restart): an index is only valid from the list read for THIS start - the design's rule is confirmed by observation; (2) the USB tree list is already 42 KiB for 5 devices against the 64 KiB cap: one more hub and the whole listing is refused - fail-closed but a host with many USB devices could not list at all: N7 measures and sets the cap with a margin, or narrows the query; (3) the system list ends without a line end.
- For N9 (its request): for `AUDIO_CARD_AMBIGUOUS` the adapter must read `listTied().undecided`, because the unchanged match answers CARD_ABSENT.
- Decisions accepted: non-USB inputs are passed over, not offered; a line break in an input's name refuses the whole listing.
- In flight: A1, N2, N4, W5, CB, C1, D1, E2, H4, 120b.

## Update 2026-10-14 - N4 landed (macOS helper table and the SR-15 static rule) - needs-review: built and green; two sentences of SR-15 stay provisional until the run of design 4.3.3
- Templates as built (<D> device word, <S> selection, <P> pipe): push head `-hide_banner -nostdin -nostats -loglevel info -thread_queue_size 1024 -f avfoundation -i <D>`; a section, one or two, ascending: `-map 0:a -af <S> -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y <P>`; pre-check `... -f avfoundation -i <D> -t 1 -map 0:a -af <S> -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -`.
- SR-15 entered as a NAMED AMENDMENT of G-R12 (after SR-4, SR-12), additive. 130 mutations all red: 44 forbidden lines each with its own control; 17 template / listing-row / start-vector mutations; 23 table mutations. The pinned build's `fifo` muxer has the row's four options (quoted in its record). Capture static 79; static set 794 with no foreign red; table tests 157 with existing cases unedited; tsc 0. N5's two door pins served.
- Decisions accepted: the builder sorts sections ascending; the forbidden list wider than the brief; listing bounds in the table; "no caller yet" pinned (moves with N7 / N9).
- Launched: N4b - the run of design 4.3.3: the PRODUCT's own argument lists run with the pinned FFmpeg, on a generated source and (U24) on the user's USB interface: push with one output, with two outputs, the pre-check - settles SR-15's two provisional sentences before N9.
- In flight: A1, N2, W5, CB, C1, D1, E2, H4, 120b, N4b.

## Update 2026-10-14 - row 120b landed - C116; row NF launched (network-facts reader S2-01 + nine surviving tests of the M10 passes on the Core side)
- NF owns: modules/capture-config/network/* and its tests; the test files of the nine named survivors.
- D4 (after N2): ONE schema step - interface-name form widened (F-4) + the seventh setting, allowed ONVIF ports (S2-02) - with contract, Core and the settings screen.
- In flight: A1, N2, W5, CB, C1, D1, E2, H4, N4b, NF.

## Update 2026-10-14 - W5 landed - C117: assigning a production camera needs a contract member and the engine's device line (row V7 after N2) and a way to store profiles for an adopted camera that has none (row PR after E2); both are preconditions of row 88
- apps/core-web and apps/mobile are free.
- Queue after N2: D4 (schema: interface-name form + allowed ONVIF ports) and V7a (device entry `profiles` + engine line; E-01 streamState transitions) in parallel only if their files do not meet (D4: db + network module; V7a: shared + db/mapping/rows.ts) - then V7b (network configuration's contract after D4), W6 (settings screen for the ports; the profile words).
- In flight: A1, N2, CB, C1, D1, E2, H4, N4b, NF.

## Update 2026-10-14 - N4b landed - C118: SR-15 final, row N4 closed; N8's reader refuses a real start (row N8b launched); the USB interface is back at 96 kHz after the restart (put to the user)
- For N9: never close one pipe of a group while the other records; SIGKILL escalation for a helper whose pipe was never opened; the index from the list of this start.
- In flight: A1, N2, CB, C1, D1, E2, H4, NF, N8b.

## Update 2026-10-14 - N2 landed - C119. Counts: 110 operations, 85 audit types, 51 actions, 9 verify notices. packages/shared is free.
- Launched: V7 (single writer of packages/shared + db/mapping/rows.ts + core/audit-details.ts): the device entry's stored `profiles` and the engine's device line (C117); the fault transitions of `streamState` with the PoE consequence (C115); the account entry in two parts and rule 5 relaxed for NOT_CLOSED (C119). D4a (schema ONLY: version 13 -> 14 - interface-name form widened, C114 F-4; the seventh setting `allowed ONVIF ports`, C116) - db/schema, migrations 0030.., value sets, schema pins; the network MODULE is agent NF's now: D4a does not touch it.
- After D4a and NF: V7b (the network configuration's contract + Core for the two) and the settings screen.
- In flight: A1, CB, C1, D1, E2, H4, NF, N8b, V7, D4a.

## Update 2026-10-14 - C1 landed (hardware chapters, host profile, collectors) - complete, adopted; nothing run on a host
- Chapters: items 1-7 done, each with a "Revision 4" note; the helper hash 1e758a24...c7d015b1 verified (SHA256SUMS 3 of 3) and printed in all three places of chapter 4 - this meets condition C-3 of C101 for the chapters; implementation/104_alias_helper.md:34 still prints the old hash (a record: the controller adds a pointer line there at the close, the record itself is history). Host profile: 56 items, new section 3.11 (`ping`, `ip`). Collectors: 17 scripts and both test scripts changed; names the product never emits removed and stated in each script's comment.
- Tests: hw collectors host 637, camera 535 (twice); host-profile script test 171; the shared test that reads the frame 21. "To confirm" marks: 43 (39 name a host check or step, 4 name rows 104/106).
- Decisions accepted: `9A/H-15` ("conflict reported") re-issued as a STATED LIMIT - the scan always states NOT_KNOWN today (capture-commissioning.ts:222; SR-13 not built); only the group step (HI-04 part A) stays at sequence 8a, HI-01..HI-07 run whole at sequence 12; the two-network reading is a USER tcpdump step, headers only; `9A/H-25.6` now uses an `add` (a helper `del` needs no arping).
- Facts it found against my records, each correct: with DEMS_CAPTURE_ALIAS_SOCKET unset the helper is "not configured" (config.ts:36) - C102 said only "unset passes": both true, the chapter states the product's word; `deviceCount` sits on the audit entry CAMERA_NETWORK_SET, not on the scan's entry; the key command refuses reserved ids since row K6 (C86's last sentence is superseded by K6's landing).
- scripts/hardware-acceptance and the host profile are free. H5 (the helper's F-1 + R119b-01) follows H4; it will move the hash again and the three chapter places with it.
- In flight: A1, CB, D1, E2, H4, NF, N8b, V7, D4a.

## Update 2026-10-14 - E2 landed (camera adapter: review findings E-02..E-05) - complete on doubles, adopted; ITS DATABASE SUITES DID NOT RUN (the db-migrate lock was held past its 45 s and 120 s waits - agent A1's long run)
- E-04: the adapter hands on consistent loss numbers - a dropped RE-OPEN line: REOPENED { loss: <the number that was told>, through: <relay's number>, ... }; a dropped or swapped LOSS line: LOST { loss, cause: 'LOSS_NOT_TOLD' } then REOPENED in one turn; a late or repeated re-open is dropped and the fault kept. The session's number match needs no change (a wording request for row E3).
- E-02: REQUIRED now - `relayEnded`, `admitHwAddress`, `sourceAddress` of the session's test / locate / exchange; the first two refuse by name when absent. Waiting for row 88: `candidateSource` in connect/service.ts.
- E-03: `captureEnded()` on the watch + the same reset at the first established push of another session; the composition's call is a line of row 88.
- E-05: both lines added. Of 11 mutations 10 were seen red: the `authorizedAsk` line of E-05 has NO test that fails without it - a named gap for the next test row.
- Unit set 47 files / 1012 (second run; 3 reds of its own in the first); tsc 0. Four lines added to adapters/__tests__/real.test.ts to keep the tree compiling - accepted.
- OWED: the adapter's database suites (camera-adapter-open, adopted-camera-test, stream-test, minted-code, connect) on this tree - in the final suite, and earlier if the lock frees.
- LOCK CONTENTION noted: A1 (kill matrix), CB, D1, V7, D4a, NF all want .locks/db-migrate.lock; database tests queue. No new database-heavy row is launched until A1 lands.
- Launched: PR (the stored-credential connection test stores the stream-stated profiles when the camera has none - C117) - owns modules/capture-discovery/adopted-test.ts and the stream rows' writer.
- In flight: A1, CB, D1, H4, NF, N8b, V7, D4a, PR.

## Update 2026-10-14 - CB landed (needs-review) and C120: the project's PostgreSQL (port 4432) was NOT running since the restart - my resume check was wrong; an agent is starting it with `npm run pg:start`
- CB item 1 (bitrate): the ONLY writer of the number is packages/shared/src/sim/initial-state.ts:300, :316; modules/devices/status.ts was a pass-through; a real Core now states null in `withCameraStreamFacts` (operations 44/46/47) and through an additive start block in engine/host.ts:1086 with a new engine/camera-bitrate.ts - engine files outside its brief: ACCEPTED (the state stream serves the engine's slice; without it the fix would not reach the clients). Simulated keeps 9. Two cases of status.test.ts that pinned the 9 in real capture re-stated. Request to the web: the reader can go by null.
- CB item 2 (four survivors): each red on its mutant - onvif-session.test.ts:434 (destroy line deleted: 1 failed; NOT the equivalent mutant of row T3, which still survives), :177, discovery-recording.test.ts:118, ws-discovery.test.ts:267.
- Unit 1015, static 906, tsc 0 at 08:44; a rerun at 09:05 had 2 reds at onvif-session.test.ts:658, :836 from E2's then in-flight edits (E2 has landed: to re-check). ITS DATABASE CHECKS DID NOT RUN (restart.db.test.ts extensions).
- OWED database checks so far: E2 (camera adapter db suites), CB, and - until they report - NF, V7, D4a, PR, D1, A1's kill matrix.
- In flight: A1, D1, H4, NF, N8b, V7, D4a, PR, pg-start.

## Update 2026-10-14 - the project's PostgreSQL is running again: 127.0.0.1:4432, pid 65169 (`npm run pg:start`; the stale pid file was overwritten by the script; no init / create / migrate / seed / reset / stop; the system PostgreSQL untouched)
- Read-only `db:status` on dems_demo and dems_lane_1..3: all four exist, audit heads, lineage and triggers unchanged; each reports NOT OK only because migrations 0015-0029 are unapplied there (schema version 6 against the code's 13) - as it was before the restart and as decision C29 wants (this task never migrates them).
- Broadcast sent to A1, D1, D4a, NF, V7, PR. OWED database checks of landed rows: E2, CB - a small runner after A1 frees the locks.
- In flight: A1, D1, H4, NF, N8b, V7, D4a, PR.

## Update 2026-10-14 - H4 landed - C121: the helper's suite holds its rules (91 tests OK on the real helper, no defect found); B-1 closed; R119-02 closed on evidence. Row H5 launched (the helper's two batched changes; owns scripts/host/netalias/*, its suite, SHA256SUMS, and the three hash places of scripts/hardware-acceptance/HW-ACCEPTANCE-4-HELPER-INSTALLATION.md).
- In flight: A1, D1, NF, N8b, V7, D4a, PR, H5.

## Update 2026-10-14 - N8b landed - complete, adopted (closes the reader's fault of C118)
- The reader now reads COMPLETE starts: `Stream mapping:` ends the input's block; mapping lines are their own kind (any other stream-prefixed line there withdraws the input statement); each `Output #n` block states its own output. A complete two-output start yields: input f32le, 48000, 5.1 (6 channels); outputs 0 and 1 each f32le, 48000, mono; 2 mapping lines, 2 output headers, the queue lines counted.
- Eight fixtures of whole starts: four device-verbatim (two outputs with queue lines; one output at 96,000 Hz; signal 15; refused open), one device-abridged, two of the pinned build on a generated source, one composed (lines 1-12 device-verbatim, the two closing lines the build's standard form). No device name in any line; pointers and paths synthetic.
- Mutations N1-N11 each red; N1 (the original fault) turns 16 cases red. 55 tests; audio suite + static 366; tsc 0. Two existing cases that pinned the fault were re-stated.
- Edit-only departure: new test blocks appended to the existing test file with a shell here-document (an append to its own row's file; noted).
- For N9: the first device start is fed to the reader before the gate is trusted (its request line).
- Resumed to run OWED database checks now that PostgreSQL is up: CB, E2.
- In flight: A1, D1, NF, V7, D4a, PR, H5, CB (resumed), E2 (resumed).

## Update 2026-10-14 - NF landed - needs-review, adopted (S2-01 (a), (b) closed; (c) and four named tests left with owners)
- Operation 102 re-reads the stored row after EVERY unit it opened (commit confirmed, lost answer, no-change path); a failed re-load makes the reader NULL (everything refused), one log line and one persistent entry, code CAPTURE_NETWORK_FACTS_RELOAD_FAILED; the reader stays synchronous at judgement time.
- (c) the demo reset has NO hook for this module: the door `captureNetworkConfigControl(app).reload()` is built and tested; its CALL belongs to the queued demo-reset row (with the kept-tables item, F-6 / I-9b item 4).
- Tests red on a mutant: 5 of 9 - T-1 twice (`committed` called directly: 3 failed and 1 failed), T-3, T-6, T-7. Left: T-4 x3 (they test functions with no product caller: the tidy row S2-03 removes or uses them), T-5 (waits for D4a's column).
- Network unit 31, database 17 (run AFTER PostgreSQL came up), 0 clones left. One static red of its own found and fixed (that file re-run green; the set NOT re-run). Composition / siblings / acceptance 148 passed, 1 failed = the openapi byte comparison (V7 is the writer in flight). Typecheck: 3 lines in `AdoptedCameraTestHost.settle` = agent PR in flight.
- modules/capture-config/network is free: the follow-up of D4a (the seventh setting and the interface-name form in module + contract) can take it when D4a and V7 land.
- In flight: A1, D1, V7, D4a, PR, H5, CB, E2.

## Update 2026-10-14 - E2's OWED database suites ran (after PostgreSQL came up) - row E2 is complete
- Relay-backed files (camera-adapter-open, adopted-camera-test, stream-test, minted-code): 4 files / 50 passed. connect, capture-composition, camera-network routes: 46 passed / 1 failed = connect.db.test.ts's schema pin "[14,'dbc-15'] = [13,'dbc-14']" - the schema writer D4a is mid-step (its pins move with it).
- The missing test for E-05's `authorizedAsk` guard is a SOURCE PIN (no behaviour distinguishes the guard): red without the line, green on the tree (97 passed) - accepted as stated: a pin, not a behavioural proof.
- Typecheck: 2 errors in agent PR's in-flight files.
- SCHEMA BROADCAST (from this result): the tree is moving to [14,'dbc-15'] under D4a.
- In flight: A1, D1, V7, D4a, PR, H5, CB.

## Update 2026-10-14 - H5 landed (the helper's two batched changes) - complete; THE HELPER'S HASH MOVED: 1e758a24...c7d015b1 -> 3621e79ccebb05d052efa06b9c1c0dd4d5d4e30d08c2f55f39019857cc7e4914 - the reviewer's statement (C101) does not cover the new file until row 119c
- F-1: `del` answers "already absent" only when NO interface holds the address, else the existing NOT_MARKED. R119b-01: the host is read again after the conflict check and before the mark; refuses 46 / 47 / 48 (and 42 / 40 / 43 on the same read - driver decision, accepted: a second read that fails for any of the first read's reasons refuses for that reason). No new code; 41 codes. The gap that remains, stated: from the second read to the kernel's add (bounded only by the 5 s tool bound, unmeasured on a host), and a carrier that drops and returns inside the check.
- Tests written first: 75 failures on the old helper, then 96 tests OK; 14 mutants on scratch copies all red. Captures 5 OK; collectors 637 and 535; the Core's table test 22.
- Hash updated in SHA256SUMS and in the hardware chapters (chapter 4 lines 19, 36, 179, 213, 532; chapter 1 :309; chapter 2 :361). Nothing under apps/core-server pins the hash.
- Tidy: `on_camera_interface` has no caller now (a dead function in a root helper: removed with the NEXT helper change, not alone - it would move the hash again).
- Launched: 119c (the security reviewer's statement on hash 3621e79c: two hunks re-read; read-only).
- In flight: A1, D1, V7, D4a, PR, CB, 119c.

## Update 2026-10-14 - row 119c landed - C122: the helper statement is MADE for hash 3621e79c (conditions C-1..C-4). Row HA launched (the Core's journal must not write HOST_ALIAS_REMOVED on the helper's NOT_MARKED - R119c-01) - owns capture/host-alias/journal.ts, lifecycle.ts and tests.
- In flight: A1, D1, V7, D4a, PR, CB, HA.

## Update 2026-10-14 - PR landed (the stored-credential connection test stores profiles when a camera has none) - complete, adopted
- (a) no stored profile: the list and one stream row per stream are stored through the ADOPTION'S OWN write (extracted as `writeAdoptedCameraColumns`; no second minting), in one unit with the outcome entry; the audit message ends "; profiles stored: N". (b) stored and the stream differs: NOTHING stored; outcome stays REACHABLE; the message ends "; STREAM_PROFILE_DIFFERS: stored N, stated N, differing N; nothing stored" and the error log gets a code with the counts. (c) agree: nothing stored.
- LIMIT, routed to V7 (message sent): the fact sits in the audit MESSAGE text only - the closed answer and detail lists have no member for it - and the ENGINE LINE is not updated yet (the device's line still shows no profiles until a restart).
- tsc 0; unit and static 28 files / 499 (credentials.test.ts unedited); adopted-camera-test.db 18 (new cases on camera port 8571); adoption database tests 48 unedited; seven mutations red. One existing source pin re-stated.
- Seven driver decisions of its record: accepted as recorded for now; they are read by the security review of row 86 with the path (a stored statement is never replaced; counts only, no device text).
- In flight: A1, D1, V7, D4a, CB, HA.

## Update 2026-10-14 - CB's OWED database checks ran - row CB is complete
- restart.db.test.ts (case G75b): 4 passed; with the engine start block removed in memory: 1 failed, "expected [ 9, 9 ] to deeply equal [ null, null ]" - the block IS held; host.ts ends unmutated. Devices database suites 42 + 8 (source-class). onvif-session.test.ts 66 passed (the two earlier reds are gone since E2 landed).
- Lock decision ACCEPTED: the two boot-fixture suites ran under the db-migrate lock alone because the heavy-host lock stayed held through a 20-minute retry; the fixture starts only a stand-in script, no worker, no relay, no port of the worker's range.
- NOTE: the heavy-host lock has been held for long stretches all morning - agent A1's worker series and kill matrix (expected), and D1's scenarios. No new heavy row until A1 lands.
- In flight: A1, D1, V7, D4a, HA.

## Update 2026-10-14 - D4a landed - complete, adopted. SCHEMA IS NOW [14,'dbc-15'], 32 migration files (0030, 0031); 498 columns, 231 CHECKs
- Interface-name form: the table's CHECKs (capture_network_config, host_network_aliases) now equal the helper's `[A-Za-z0-9][A-Za-z0-9_.-]{0,14}`. New column `capture_network_config.onvif_ports`, jsonb NOT NULL default `[80]`, CHECKs: a list of 1-8 whole numbers 1-65535, no two equal.
- Decisions accepted: an EMPTY list is refused (a configuration with no allowed port would refuse every camera silently - the default states 80); `80.0` counts as 80 (jsonb number); the UNDO refuses while a stored name has a capital (it would not fit the old CHECK).
- Checks (PostgreSQL up): drift "No schema changes"; test/db 998; pins / seed / reset / network module db 234; fence / connect / audio cards 101; unit 964; tsc 0; lint clean; set15 (apply, rollback, undo, every planted bound) 66.
- 18 pin files moved. Schema commits are now SIX steps (202, 51b, 114 committed in f20c9b39 with D2, D3; D4a new) - D4a is one more schema commit at the next commit point.
- STILL OPEN until the follow-up row V7b (after V7 lands): F-4 and S2-02 in the MODULE and the CONTRACT - operations 101 / 102 state `onvifPorts` and the widened name form; the network module stores and reads the column; the destination rule's context takes `allowedPorts` from the stored list; the settings screen.
- Red not its own: capture/host-alias/__tests__/lifecycle.test.ts, 8 red = agent HA in flight.
- In flight: A1, D1, V7, HA.

## Update 2026-10-14 - HA landed - complete, adopted (closes R119c-01)
- On the helper's NOT_MARKED the Core writes `HOST_ALIAS_REMOVE_FAILED` with `failureReason: 'HELPER_NOT_MARKED'`, `removeReason` (the removal's own reason; ADD_UNCONFIRMED stays on the F-9 path) and `aliasId` when a row exists; severity WARNING, or INFO when the Core's own interface table does not show the address. The closed list admits it - the vocabulary is unedited. Rows close, no retry, the next add is not blocked - at release, timer, shutdown and the boot sweep with and without a row. 10 mutations red.
- Expectations re-stated: the NOT_MARKED case of lifecycle.test.ts; capture-composition.db.test.ts:715.
- Requests (non-blocking, next contract step): an `expiresAt` member on HOST_ALIAS_REMOVE_FAILED; a "not confirmed" state for operation 104.
- Checks: unit 1009 passed / 1 failed = rule R-5 of capture-config/__tests__/static.test.ts on a file of row PR (landed) - integration pass I-9c; host-alias db 11; composition 15; acceptance pair 83; typecheck 0.
- I-9c list (new): the R-5 red; the demo reset's kept tables + `captureNetworkConfigControl(app).reload()` call (F-6, NF (c)); the README sentences of OD-22 / PoE (V7), R119c-03 (chapter 4's "still to be made"), the stale README parts C2 found; config.ts:29's reserved example id.
- In flight: A1, D1, V7.

## Update 2026-10-14 - A1 landed - C123: kill matrix 35/35; row 59 closed; worker baseline recorded. Launches: 86 (read-only), N13 (N1+N3: packages/capture-protocol + apps/capture-worker/** - single writer of both), N7 (capture/fence/production-parts.ts + src/capture-composition.ts: the macOS seam; RELEASED to N7 now, back to row 88 after), N9 (new macOS adapter files under capture/adapters/audio/ + adapters' static list entry).
- In flight: D1, V7, 86, N13, N7, N9.

## Update 2026-10-14 - D1 landed - C124: seal clamp `durableEndOf` (sealing/pipeline/pipeline.ts); sealing area RELEASED by D1. Media-zero request routed to N13 (inside protocol v5). Launch: D1b (sonnet test runner, read-only on source: the sealing `*.db.test.ts` files).
- In flight: V7, 86, N13, N7, N9, D1b.

## Update 2026-10-14 - D1b landed - C125: sealing db tests 29/29; row 184 line closed.
- In flight: V7, 86, N13, N7, N9.

## Update 2026-10-14 - V7 landed - C126: profiles reach the clients (Q-02 delivery half built); LOST transitions; account in two parts. packages/shared + rows.ts + audit-details.ts RELEASED by V7.
- Launches: V7b (SINGLE WRITER of packages/shared/** + modules/capture-config/network/**: onvifPorts + widened name form on ops 101/102; allowedPorts from the stored list), I-9c (capture-config/__tests__/static.test.ts R-5; README.md; the demo reset; core config.ts:29).
- Queue: V7c (idle camera state 'not read' at rest; after V7b, contract writer), then W6 (web + tablet: settings screen ports/name form; the profile words of op 108; 'Test connection' as the remedy; render 'not read').
- Open item for the user's report: F-V7-1 (OD-22 PoE cycle not built; op 48 is a plain restart).
- In flight: 86, N13, N7, N9, V7b, I-9c.

## Update 2026-10-14 - row 86 landed - C127: CAUTION, no FAIL; AD-01(6) / AD-02 / AD-08 yes.
- V7b GAINS (S-04, C-3): capture/adapters/camera/stored-address.ts, modules/capture-config/credential-reader.ts, capture/destination-rule.ts.
- Launches: S86a (modules/capture-config/routes.ts + store.ts: C-1, refusal at assignment), 174b (capture/adapters/credential.ts: C-4), 87b (decisions/087_lift_texts.md re-issue: C-7, C-5).
- Queue: AM-1 record (controller, after 87b); checkpoint commit with B1 (quiet point, light checks, U26) before any production start; row 88 (preconditions C127); S86b (C-2, before M6 with E3 / row 90); I-9d (C-6 pin, after N9); V6b-family commissioning row (C-10); document row (C-11, F-2 rescope of M7-SEC-SRC-2); V7c; W6.
- In flight: N13, N7, N9, V7b, I-9c, S86a, 174b, 87b.

## Update 2026-10-14 - 87b landed - C128: texts re-issued; X-9 / X-10 ruled; AM-1 RECORDED (in force from the commit of row 88).
- Row 88 now waits only for: V7b (S-04) and N7 quiet on their files; the checkpoint commit holding B1 (quiet point).
- In flight: N13, N7, N9, V7b, I-9c, S86a, 174b.

## Update 2026-10-14 - 174b landed - C129: locator name rule by class; onvif-session.test.ts control updated; locator files 196/196.
- Attributed reds seen by 174b: static 3 = N9 (usb-audio-macos.ts, in flight); tsc 16 = N13 audio levels (7, message sent: keep v5 members optional or request lines), mic-transport.ts (N13/N9 - to attribute at landing), adopted-camera-test.db / camera-adapter-open.db (to attribute: V7b or S86a), onvifPorts (V7b in flight).
- In flight: N13, N7, N9, V7b, I-9c, S86a.

## Update 2026-10-14 - S86a landed - C130: C-1 closed (refusal at assignment, real path). capture-config/routes.ts + store.ts RELEASED. V7c gains: the new reason word (S86a request). W6 gains its rendering.
- In flight: N13, N7, N9, V7b, I-9c.

## Update 2026-10-14 - N7 landed - C131: darwin listing seam; 3 pins confirmed. Launch: N5b (production-door.ts optional per-call cap + group kill; macos-plist.ts bound; production-parts.ts limits + runner call only; composition.test.ts one case; static pins by delta). Row 88 waits for N5b on production-parts.ts.
- In flight: N13, N9, V7b, I-9c, N5b.

## Update 2026-10-14 - I-9c landed (needs-review) - C132: reset keeps 18 tables + optional reload; README tidied. Launch: I-9e (sonnet: rename cause SESSION_OPEN -> SESSION_ACTIVE in capture-discovery adopted-*; admit demo -> capture-config edge in test/static/imports.test.ts; bind reloadNetworkFacts in modules/demo/host.ts). Queue I-9d (after N9 + N5b): C-6 relay pin; config.ts:29/:313 + capture static.test.ts:930/:1020 paired to DEMS-SITE-21.
- In flight: N13, N9, V7b, N5b, I-9e.

## Update 2026-10-14 - I-9e landed - C133: R-5 green; reset reload bound. capture-discovery adopted-*, modules/demo/host.ts, test/static/imports.test.ts RELEASED.
- In flight: N13, N9, V7b, N5b.

## Update 2026-10-14 - N9 landed - C134: macOS USB_AUDIO adapter (unregistered). capture/adapters/audio/** new files + adapters static RELEASED. N5b gains request 550 (capture static SR-15 caller pin). I-9d list now: 551 (usb-audio-production.test.ts pin), 553 (mic-transport gapped entry + constant, after N13), C-6 relay pin, config.ts:29/:313 + static :930/:1020 -> DEMS-SITE-21. Starts after N5b and N13.
- In flight: N13, V7b, N5b.

## Update 2026-10-14 - C135: launches NB (design row N13 = THE BOOT: capture/boot/ + fence/boot-key.ts; back to row 88 after) and S06 (camera/onvif-network.ts: C-10). AM-1 (3)(h) erratum recorded. Order: 88 -> N10 (darwin opener unadmitted until M2b) -> N14.
- Row 88 waits for: V7b, N5b, NB, and the checkpoint commit (B1).
- In flight: N13 (=N1+N3), V7b, N5b, NB, S06.

## Update 2026-10-14 - S06 landed - C136: C-10 closed. camera/onvif-network.ts RELEASED. N5b gains request 556.
- In flight: N13 (=N1+N3), V7b, N5b, NB.

## Update 2026-10-14 - V7b landed - C137: onvifPorts + name form in contract/module; S-04 fixed. packages/shared + capture-config/network/** + stored-address.ts + credential-reader.ts + destination-rule.ts RELEASED. Launch V7c (single writer packages/shared + rows.ts + S86a seam constant in capture-config/routes.ts). I-9d list + request 558 (HA files caller.ts, facts.ts) + re-run of the reds V7b saw. Row 88 gains request 558 (boot/program-checks.ts, fence/production-parts.ts).
- Row 88 waits for: N5b, NB, checkpoint commit (B1).
- In flight: N13 (=N1+N3), N5b, NB, V7c.

## Update 2026-10-14 - N5b landed - C138: per-call cap, group kill; requests 550/556 applied. production-parts.ts + capture static RELEASED (static :1780 waits for NB). Launch N5c (BLOCKING: capture/adapters/credential.ts + production-door.ts: linear USER_PART + regex audit).
- Row 88 waits for: NB, N5c, checkpoint commit (B1).
- In flight: N13 (=N1+N3), NB, V7c, N5c.

## Update 2026-10-14 - NB landed - C139: darwin boot path rule + microphonePermission NOT_KNOWN. boot/ + fence/boot-key.ts RELEASED (to row 88). Launch I-9d (sonnet; capture static, config.ts, usb-audio-production.test.ts, core/audit-details.ts + writers.test.ts, adapters static, host-alias caller.ts + facts.ts). 553 -> N11 brief.
- Row 88 waits for: N5c, I-9d (capture static + audit-details), checkpoint commit (B1).
- In flight: N13 (=N1+N3), V7c, N5c, I-9d.

## Update 2026-10-14 - I-9d landed - C140: static sets green; C-6 closed. Released: capture static, config.ts, usb-audio-production.test.ts, core/audit-details.ts, writers.test.ts, adapters static.
- Row 88 waits for: N5c, then the checkpoint commit (after V7c and N5c land; N13 paths excluded).
- In flight: N13 (=N1+N3), V7c, N5c.

## Update 2026-10-14 - V7c landed - C141: streamState nullable on the selector line; CAMERA_PROFILE_WITHOUT_STREAM. Launch V7d (single writer packages/shared + modules/devices/status.ts + capture-config/slices.ts). W6 after V7d (requests 557, 564-566 + V7d lines + C117 remedy sentence + op 108 words).
- In flight: N13 (=N1+N3), N5c, V7d.

## Update 2026-10-14 - N5c landed - C142: linear blanking. credential.ts + production-door.ts RELEASED.
- Next: checkpoint commit when V7d lands (N13 paths excluded), then row 88.
- In flight: N13 (=N1+N3), V7d.

## Update 2026-10-14 - CHECKPOINT cb06d42c (C144): 372 files; worker + protocol (N13) and ffprobe-export.txt excluded.
- Launches: ROW 88 (the lift: registry.ts, camera/onvif-rtsp.ts, audio/usb-audio.ts, fence/index.ts, fence/production-parts.ts, capture/boot/**, src/capture-composition.ts, capture-session/index.ts (lift only), connect/index.ts (E-02), adapters + capture static) and W6 (apps/core-web/** + apps/mobile/**: op 108 wired, new words, null state, onvifPorts setting).
- Queue after 88: N10 (registry darwin branch unadmitted), commit of the lift with AM-1 status, 89, 148, 90 (+S86b C-2), C-5 hardening, N11 (after N13; + 553, 554), N12, N17, N14, gates M2b, N15 (user: 48 kHz), N16.
- In flight: N13 (=N1+N3), 88, W6.

## Update 2026-10-14 - N13 (N1+N3) landed - C145: protocol v5 + worker gapped kind. apps/capture-worker/** + packages/capture-protocol RELEASED. Launch N11a (sonnet: capture/__tests__ seven files, fence development-session.db, test/support/capture.ts, adapters/mic-transport.ts). Queue: run B+ (kill matrix on new worker) after 88; commit worker+protocol+N11a; N11 (545, 553 constant, 554), N12 (+546 media zero).
- In flight: 88, W6, N11a.

## Update 2026-10-14 - W6 landed - C146: op 108 wired; words; null state; ports setting. apps/core-web + apps/mobile RELEASED. Launch RD (design only: masterplan/07_design_retire_readopt.md).
- In flight: 88, N11a, RD.

## Update 2026-10-14 - RD design landed - C147: op 111 retireCaptureDevice; schema v15. Launches: RD1 (db/schema, migrations 0032/0033, set16 test, version pins by delta) and RD2 (single writer packages/shared + core/audit-details.ts). Queue: RD3 (after RD1+RD2+88), RD4a/RD4b, RD5 (after RD2), RD6 review.
- In flight: 88, N11a, RD1, RD2.

## Update 2026-10-14 - ROW 88 landed in the tree (uncommitted) - C148. Launch 88b (gate review, read-only). Row 88 files RELEASED except: they stay frozen until the lift commit (no edits to registry.ts, real.ts, fence/index.ts, production-parts.ts, capture/boot/**, capture-composition.ts, capture-session/index.ts until 88b + commit).
- Queue: MH1 (mic-helper leftover red), run B+ (after N11a), commit lift (+ worker/protocol + N11a), N10, N11, RD3.
- In flight: 88b, N11a, RD1, RD2.

## Update 2026-10-14 - N11a closed - C150: capture tests 627/627 on protocol 5. Launch run B+ (test runner; heavy + db locks).
- In flight: 88b, RD1, RD2, B+.

## Update 2026-10-14 - LIFT COMMITTED d9df31ac (C152); AM-1 in force. Row 88 files UNFROZEN.
- Launches: N10 (capture/adapters/real.ts, registry.ts (C-1), fence/index.ts (macOS loss watch only), local/pipe-files.ts, audio/usb-audio-macos.ts (2 lines), adapters + capture static), 89 (e2e test area it declares + test/support key maker; C-2 door refusals, C-8 entry file), MH1 (local/__tests__/mic-helper.generated.test.ts; product leftover check only if the cause is there).
- Queue: 148 (after 89, same area), 90 (+C-3, after 89), S86b (C-2 of 086), RD3 (after RD1+RD2; + C-4 via RD4a/b), N11 (545, 554), N12 (+546), N17, N14, M2b, N15, N16.
- In flight: RD1, RD2, B+, N10, 89, MH1.

## Update 2026-10-14 - N10 landed - C154. Launch I-9f (sonnet: capture-composition.ts loss-watch report sink; audio-cards routes.db.test.ts:564). RD2 gains credential.test.ts:471.
- In flight: RD1, RD2, B+, 89, I-9f.
