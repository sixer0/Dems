# Row N13 (N1 + N3) - protocol version 5 and the worker's gapped microphone kind

Record: `implementation/n13_worker_gapped_kind.md`. Agent N13, wave 12, 2026-10-14.

- C123 first: `m5_gap_analyser`'s 17 samples = a REAL insertion of 17 zeros by the worker (one late fixture chunk under load), counted exactly (`missing` 17) and measured exactly by the check; reproduced on purpose (freeze of the fixture writer: missing = tap zero run = analyser error = 1,457 with the `nocomp` build). Not a miscount; nothing fixed. Distribution on the baseline: 6 of 6 pass, missing 0.
- N1: protocol 4 -> 5; `PCM_FIFO_GAPPED`; four required level members; records `MIC_SAMPLE_ACCOUNT` (identity + cross rules) and `AUDIO_INSERTED_RUN`; 36 of 36 tests; 12 mutants: 11 red, 1 equivalent.
- N3: audio.c places 1-12 of 7.2a; capture_worker.c one assignment; worker.h version 5 + three constants; check.sh rule N3-GAP with 8 planted lines + 6 mutations (selftest 109 refused); stand-in `test/gapped_mic.c` + `test/n3gapped.py`: ten modes, every count reconciled to the sample against the tap and the writer; 11 checks added to the series (171).
- Displacement on the measured pattern: -26.9 to -38.9 ms (whole pipe +0.45): inside +-40 ms by 1.1 ms - stated for the review.
- Core: 8 tsc errors from this change (request lines, one per file; members kept required: D2); guard-family pin moved by delta; C124: the media zero is already on the wire (`AUDIO_SOURCE_INTERVAL` index 1 `capturedAtMs`), Core-side request line.
- Series and fixtures on the new tree: see section 9 of the record.
