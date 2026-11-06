# N11a - the Core test side and the microphone transport on protocol 5 (mechanical pass, wave 12, track D)

Decision C145. Requests: lines 537-544 of delegation_progress/file_requests.md (row N13 -> owners). Method: Edit tool only on existing files, each after a re-read; no scripted replace, no whole-file write. No device, no hardware, no worker started; the unit run used the stub worker (a real child process of the Core test suite, loopback pipes only).

## Lines applied (8 of 8, none stopped)

| Request line | File | Change |
|---|---|---|
| 537 | src/capture/__tests__/fault-lifecycle.test.ts :205 | level gains `timelineSamples: 480_000, receivedSamples: 480_000, insertedSamples: 0, nonZero: true` |
| 538 | src/capture/__tests__/forwarder-advisories.test.ts :47 | same four members |
| 539 | src/capture/__tests__/forwarder-engine.test.ts :77, :78 | same four members, both levels |
| 540 | src/capture/fence/__tests__/development-session.db.test.ts :396, :397 | same four members, both levels |
| 541 | test/support/capture.ts :262 | the fake worker's level gains the four members |
| 542 | src/capture/adapters/mic-transport.ts | `MIC_TRANSPORTS.PCM_FIFO_GAPPED` added (F32LE, 48 kHz mono, ARRIVAL, clockCompensationPpm 0, latenessBeyondRangeMs MIC_WORKER_BUFFER_CAP_MS, reportsOutOfRange false) with the statement as a comment; `MicTransportStatement` NOT changed (no member for "not every sample" - that is design s7.2 bullet 1 and N9's word). No test pins the entries of the record (greps: only `.PCM_FIFO` is read elsewhere) |
| 543 | src/capture/__tests__/protocol-pins.test.ts | (1) `toBe(4)` -> `toBe(5)`, titles "version 4" -> "version 5" (both worker-restatement titles); (2) record kinds the worker writes gain `AUDIO_INSERTED_RUN`, `MIC_SAMPLE_ACCOUNT` (the list is sorted by `.sort()`); (3) NEW pin in the first `it`: the three defines of worker.h equal `CAPTURE_MIC_ACCOUNT_PERIOD_SAMPLES`, `CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES`, `CAPTURE_AUDIO_INSERTED_RUNS_MAX` (three imports added) |
| 544 | records.test.ts :559-578, ipc.test.ts :312, tidy-fy.test.ts :14, :162 | records: `toBe(5)`, `{ v: 5, ... }`, titles 4 -> 5 (the refused older worker is left as it is: it says version 2 in code, "says 3" in the title); ipc: `protocolVersion: 5`; tidy-fy: imports `CAPTURE_PROTOCOL_VERSION` and uses it for `v` (the "better" choice) |

No line's text had drifted from the code. Lines 545 and 546 not applied (as ordered).

## Checks

- Core typecheck (`tsc --noEmit`, apps/core-server): 8 errors before; now 1 error, `src/capture/adapters/__tests__/real.test.ts(67,23): TS2315 Type 'ProductionAdapterDependencies' is not generic` - row 88's in-flight work (adapters tests); not attributable to the protocol change; not touched.
- Unit run of `src/capture/__tests__` (17 files, one run): 13 files passed, 4 failed; 605 passed, 22 failed. Passed, among them: fault-lifecycle, forwarder-advisories, forwarder-engine, protocol-pins, records. The 22 reds are all outside the request lines and are NOT caused by the edits; all are version-5 fallout in files this row does not own:
  - `test/support/capture-stub-worker.mjs:40` `const PROTOCOL_VERSION = 4;` - the real-process stub still frames `v: 4`, the supervisor answers FRAME_NOT_A_MESSAGE / PROTOCOL_MISMATCH. 20 tests: ipc.test.ts (15 real-process tests), tidy-fy.test.ts (3: item 1 --durable --size-bound and --lavf-mismatch, item 2), forwarder.test.ts :422 and :445 (5 s timeouts, "mode real with a worker program").
  - `supervisor.test.ts:53` `toMatchObject({ v: 4, ... })` - START carries 5 now (1 test).
  - `forwarder.test.ts:62` expected level lacks the four members, which the forwarder passes through whole (1 test).
  Filed as two request lines at the end of file_requests.md (blocking: yes for the real-process suites).
- Process note: after the summary the vitest main process did not exit ("Timeout terminating forks worker ... ipc.test.ts" - the orphan-test stub processes `--ignore-eof` stay alive when the stub test fails); I ended the vitest process I started and the stub workers that belonged to it. Nothing left running.
- development-session.db.test.ts, once, on a throw-away database (template clone `dems_test_local_*`, dropped at teardown; db-migrate lock taken through lockf): 4 passed, 1 failed. The failing test is the schema pin `schema version 14, contract dbc-15` (:239-241): the migrated schema is 15 / dbc-16. NOT a protocol matter and not in lines 537-544; the schema pin is a shared hot file of the schema writer; reported, not changed. The telemetry test of :396-:397 (the edited lines) passes.
- Lint (oxlint, the ten touched files): exit 0, no output.

## Unproven / stays

- The real-process suites (ipc, tidy-fy item 1/2, forwarder "mode real") are unproven on version 5 until the stub's number moves.
- `PCM_FIFO_GAPPED` has no consumer in the Core yet (adapter that opens a gapped writer = row N9/N11; behaviour of the supervisor's record subject = line 545, row N11).

DRIVER DECISIONS: none beyond the two "better" choices the lines offered (tidy-fy uses the constant; records/ipc keep literals as written).
