# coder-execution - environment preparation, wave F (D174)

- Date: 2026-10-10. Status: **needs-review** (all seven tasks done and smoked; decisions F-1, F-2 to rule).
- Note: `initialization/04_gate_environment_wave_f.md`.

## Done

1. Nothing of the project was running (only PostgreSQL 4432); nothing stopped.
2. Four standing databases migrated 5 / `dbc-6` -> 6 / `dbc-7` (15 files, ledger matches, 43 tables), no refusal.
3. Helper copy present and accepted (not re-copied); development signing key provisioned in `.data/signer`; worker binary current.
4. Lane plan: lane 1 SIMULATED + demo controls; lane 2 REAL_DEVELOPMENT, FAKE selector, 2 v2 demo items; lane 3 SIMULATED; `dems_demo` SIMULATED. One media root per database.
5. Four resets, exit 0, no guard refusal; lane 2 `2 sealed with the development key`.
6. Smoke per Core: health 200 / ready, operation as planned, 13 items each; lane 2 op 41: clean item PASS 15 of 15, EV-20261009-0005 TAMPERED `(VIDEO-02, 3)`. All Cores stopped.
7. Start / stop table: note section 7.

## Files

| Path | Kind |
|---|---|
| `docs/2026-10-07_dems_real_capture_sealing/initialization/04_gate_environment_wave_f.md` | new |
| `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder_execution_env_prep_f.md` | new |
| `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/file_claims.md` | two lines appended |
| `.data/transcriber/host.json` | new, git-ignored (decision F-1) |
| `.data/signer/` (3 files), `.data/media/dems_lane_2/sessions/` (2 package folders) | created by the project's commands |
| `.locks/core-server.lane{1,2,3}.log`, `.locks/core-server.demo.log` | smoke logs |

No product source, no README, no lockfile, no commit. Not written: `status_tasks.md`, `masterplan/02_plan.md`, `delegation_progress_report.md` (controller's, rules D94).

## Blockers / decisions

- F-1: a real-mode boot needs `.data/transcriber/host.json`; written with engine paths only. `modelVersions` and `vad` are NOT stated - to state before the M6 gate.
- F-2: `dems_demo` stays SIMULATED (the demo start uses demo controls, which real capture refuses).
- Open from the M2 gate, unchanged: the two phone AVDs on swapped ports against `device-session.sh`.

## Follow-up D175 (2026-10-10) - status needs-review

- `scripts/lane/lane.sh` new (start / stop / status / reset of main, 1, 2, 3); proven on lane 2 (start -> ready -> refusals -> stop -> reset with the two v2 items); scripts static guard 6 of 6.
- `README.md`: Core server step points at the script, table of the per-database media roots (+21 / -2).
- `.data/transcriber/host.json` completed: `vad` (whisper-vad-speech-segments, `ggml-silero-v6.2.0`) and `modelVersions["ggml-large-v3-turbo"] = "large-v3-turbo"` (declared from the file name). Lane 2 boot: `RESOLVED cpu-local, vad READY`; provenance provider complete for the seeded model.
- Phone AVD ports: not a script error; emulators were booted without `-port`. Fix = boot through `device-session.sh` (or with `-port`). Script unchanged.
- Files: `scripts/lane/lane.sh` (new), `README.md`, `.data/transcriber/host.json`, the note (section 10), `file_claims.md` (third line). Lane 2 at the pristine seed; everything stopped.
- Decisions F-6..F-9 in the note, section 10.4.
