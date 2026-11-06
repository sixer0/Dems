# Row N2 (wave 12, track D) - the one contract step of the macOS microphone design

- Agent: coder-execution (agent N2). Date: 2026-10-14 09:20 (host `date`).
- Status: **needs-review** - the contract is built and green; two findings need a ruling before rows N11 and N12 use it.
- Record: `implementation/n2_mic_contract.md`.

## Added (verbatim names)

- Manifest: optional signed `audio.samplesNotReceived` (fields 139-158), `ManifestAudioSamplesNotReceivedSchema`, `ManifestAudioInsertedRunSchema`, `MANIFEST_AUDIO_*` constants. Reconciled by the schema (six rules, the identity to the sample); a member that does not reconcile fails V-01 with the existing `MANIFEST_FIELD_INVALID`.
- Verify notices: `AUDIO_SAMPLES_NOT_RECEIVED` (`audioSamplesNotReceivedReport`, `audioSamplesNotReceivedNumbers`), `AUDIO_ONE_CAPTURE_GROUP` (`audioOneCaptureGroup`, `AUDIO_ONE_CAPTURE_GROUP_REPORT`).
- Audit types: `CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED` (20 details), `CAPTURE_AUDIO_SILENCE_INSERTED` (5); rules in `apps/core-server/src/core/audit-details.ts`.
- Advisory reasons: `MIC_PATH_NOT_SAMPLE_CONTINUOUS`, `MIC_SAMPLES_SHORT_ABOVE_BOUND`, `MIC_SAMPLES_SHORT_ABOVE_SESSION_LEVEL`, `MIC_SILENCE_RUN_INSERTED`, `STANDBY_ON_PRIMARY_DEVICE`; `CAPTURE_ADVISORY_SEVERITY` (three are WARNING).
- Words: `AUDIO_INSERTED_SILENCE_SENTENCE`, `common.micSameDevice`, `common.audioNotSampleContinuous`.
- Operation 84: `audioNotSampleContinuous`, `segments[].insertedSilenceMs` (both optional).

## Counts

110 operations (unchanged), 85 audit types (83 -> 85), 51 actions (unchanged), 9 verify notices (7 -> 9); 41 server-listed types (39 -> 41); 30 optional manifest fields (10 -> 30); 10 advisory reasons (5 -> 10). `openapi.json` regenerated once.

## Proof that existing packages verify unchanged

- Product pipeline, two fixture sessions, before / before / after: manifest and signature identical by `cmp` (94f26937...823333, e4de4742...b3e7bc).
- Committed shared package against the working tree, five manifests: bytes, digest, V-01 and the whole verify result identical by `cmp`.

## Checks

- shared: `Test Files 105 passed (105)`, `Tests 2900 passed (2900)`.
- Core, targeted unit: `1 failed, 81 passed (82)`; `1 failed, 1520 passed (1521)` - the failure is `sealing/__tests__/pipeline.test.ts:515`, agent D1's file in flight.
- `tsc --noEmit`: shared, core-web, mobile, mock-core, transcriber 0 errors; core-server 1 error in a file of another agent.
- Nine mutations seen red and taken back.

## For the controller

1. **F-1, blocking for N11:** the designed account row holds 19 to 20 keys; the audit writer refuses a native row above 16 (`core/limits.ts:51`). The list is built as designed; a CLOSED row cannot be written until the bound is ruled on.
2. **F-2, before N12 closes:** rule 5 of the member refuses an honest session whose worker was killed after a run that its last periodic account does not reach.
3. Nine driver decisions (record section 7); seven lines in `file_requests.md`.

## Left

N11 (writers, source facts, the notices' raising), N12 (`AUDIO_SHORTFALL_NOT_STATED`, the member's writer), N13 (`microphonePermission`), N16 (documents), N17 (receiver's lines, export), N18 (transcript document and answer). No file of `apps/core-web` or `apps/mobile` was needed or written.
