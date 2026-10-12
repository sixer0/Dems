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
