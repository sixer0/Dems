# Row checkpoint 2 - STOPPED before the commit (Tier 3)

Status: blocked (no commit made; HEAD still 1fbeada7a4599b344d067be5080db69cb1aa9956). 372 paths are STAGED in the index (explicit path list, nothing else touched).

## Staging
- `git status --porcelain -z -uall` filtered by script: 372 included (all ` M` or `??`, no deletes, no renames), 14 excluded.
- Excluded (4 classes): apps/capture-worker/** (11 modified/new: Makefile, README.md, check.sh, src/audio.c, src/capture_worker.c, src/worker.h, test/e2e.py, test/m3worker.py, test/static/planted.tsv, test/gapped_mic.c, test/n3gapped.py), packages/capture-protocol/** (src/index.ts, test/protocol.test.ts), ffprobe-export.txt. apps/input-av and ignored paths do not appear in status.
- `git diff --cached --name-only | grep -E '^\.data/|^\.cache/|\.pem$|\.key$'`: empty.
- `git diff --cached --check`: 7 trailing-whitespace reports, all in new ffmpeg-capture fixtures `apps/core-server/src/capture/adapters/audio/__tests__/fixtures/macos-helper-starts/*.txt` (the progress line ends in spaces as ffmpeg wrote it). Not fixed.

## Secret scan (`node scripts/secret-scan/count-only.mjs`)
- `--staged`: 372 files, 27 hits in 10 files, NAME hits 0. Per file against HEAD: new = credential.test.ts 6, production-door.test.ts 2 (both test files), n5c_linear_blanking.md 1 (NEW FILE, not a test file); the rest unchanged.
- `--tracked` (working tree): camera-credential 67 (baseline 58, +9 = 6 + 2 + 1 above); private-key-pem 3, database-password-line 1, ingest-secret 4, session-token 20, device-credential 8, biometric-token 8, database-locator 10 - all equal to the baselines.
- STOP CAUSE: the one hit outside a test file is `docs/2026-10-12_input_av_core_adapter_plan/implementation/n5c_linear_blanking.md:52` - the synthetic placeholder `rtsp://u:p@192.0.2.10/s` (TEST-NET-1 address, user `u`, password `p`) in a description of a test. Not a real value. Ruling needed: accept as synthetic (precedent 1fbeada7: hits in reference documents) and commit, or keep that file out.

## Light checks (to state in the message, not re-run)
Static sets green (I-9d, C140); typecheck 0 in shared, web, mobile; Core typecheck 9 errors caused by agent N13's uncommitted protocol change (cannot be checked against the committed protocol in this tree).
