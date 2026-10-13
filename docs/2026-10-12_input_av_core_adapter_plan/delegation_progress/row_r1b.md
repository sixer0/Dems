# Row R1b (agent R1b, track D) - a camera's absence inside a session, under the signature

Status: **needs-review**. Contract, writer, seal member, verifier line and byte identity are built and green; the sealed scenario passed with the relay's words handed in by the test file (row R1's measured numbers), not by the built relay. Record: `implementation/r1b_video_absence_signed.md`.

## Names
- Audit type `CAPTURE_VIDEO_ABSENT_IN_SESSION` (DEVICE; details `sessionId`, `deviceId`, `trackId`, `attempt`, `loss`, `tries`?, `videoAbsentAtLeastMs`?, `videoAbsentAtMostMs`?, `ended`: `RE_OPENED` / `NOT_RE_OPENED`).
- Signed optional member `tracks[].absentInSession[]` = `{ attempt, loss, absentAtLeastMs, absentAtMostMs, ended }` (fields 134-138).
- Verify notice `VIDEO_ABSENT_IN_SESSION`; receiver result member `videoAbsentInSession`.

## Files
- packages/shared: `src/sim/vocabulary.ts`, `src/i18n/en/common.ts`, `src/evidence-package/manifest.ts`, `build.ts`, `src/evidence-verify/types.ts`, `verify.ts`, `src/api/evidence.ts`, `src/api/installation-acceptance.ts` (controller's added item), `openapi/openapi.json` (generator, once); seven test files.
- apps/core-server/src: `core/audit-details.ts`, `capture-session/index.ts`, `sealing/pipeline/pipeline.ts`, `contract.ts` (comment), `sealing-host/session-reader.ts`, `evidence-export/receiver-verify.ts`, `receiver-cli.ts`, `db/fixtures/operations.ts` (one row); eight test files.
- Scratch (no commit): `.cache/task4-rowr1b/`.

## Checks
- Shared workspace: `Tests 2891 passed (2891)` (OpenAPI comparison green).
- Core unit, touched areas and static set: `Tests 1478 passed (1478)`.
- Core database (session, sealing, verify, export, fixtures): `Tests 155 passed, 3 skipped`, `0 remain`.
- Byte identity: manifest and signature identical before / after, two fixtures; SEALED each.
- Scenario `s2`: `Tests 1 passed`; SEALED 1 of 1; stored entry = signed member; verify 15 of 15; export COMPLETE; receiver 7 of 7. Run `s1` failed on my own literal before any session.
- Typecheck 0 in shared, core-server, core-web, mobile, mock-core, transcriber.

## Counts
110 operations, 83 audit types (+1), 51 actions; pins moved by delta in 8 files.

## Requests left (six lines in `file_requests.md`)
1. Row 88: one run of the scenario with the built relay inside the session.
2. README text (three sentences).
3. The audio gap has no verifier line: the twin.
4. Operation 109 may now answer `INSTALLATION_CLOCK_BEHIND_RECORD` (V6b / integration).
5. W4: none of its three shared requests taken (change set closed); no web / mobile line needed.
6. Red not mine: `engine/__tests__/boot-checks-runner.test.ts:81`; not built: the interruptible warning reason.

## Driver decisions
See the record, section 9 (six).
