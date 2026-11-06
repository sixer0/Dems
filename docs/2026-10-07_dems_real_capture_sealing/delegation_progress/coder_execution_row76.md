---
task_id: 2026-10-07_dems_real_capture_sealing
row: 76 (M6-W1) — Transcriber app + adapter + fixtures
agent: coder-execution (driver of the row-76 pair)
date: 2026-10-09
status: complete (navigator review pending; decisions D-76-1, -2, -5, -6 need the controller's confirmation)
artifact: implementation/33_m6_transcriber_adapter.md
---

# Row 76 — delegation progress (parallel run; the controller synthesises the shared files)

## Status

`complete`. Code, tests and `implementation/33_m6_transcriber_adapter.md` exist. Not committed.
Shared files NOT edited by this agent: `masterplan/02_plan.md`, `status_tasks.md`,
`delegation_progress_report.md`, `implementation/99_implementation_report.md`.

## Milestones

| # | Milestone | Evidence |
|---|---|---|
| 1 | Workspace `apps/transcriber` (`@dems/transcriber`) created; typecheck and lint exit 0 | report §1, §8 |
| 2 | M6-AD-1 PASS (10 tests) and M6-CP-1 PASS (16 tests); suite 6 files / 126 tests | report §3, §4 |
| 3 | Static rule: 33 tests PASS; shown red on a planted file on disk, green after removal | report §7 |
| 4 | `cpu-local` real run through the adapter: `whisper-cli … -ng -t 8 -l id -oj`, raw SHA-256 `6039a944…cab94439`, 3717 B, 14 segments = row 109 byte for byte | report §5.1 |
| 5 | `omlx-server` real run through the adapter and the single key-loader: raw SHA-256 `08900b7c…f3da6998`, 6801 B, 17 segments = row 12 byte for byte | report §5.2 |
| 6 | Both real results have one document shape | report §5.3 |
| 7 | oMLX: log backed up 10:54:13, started 10:54:17, stopped 10:54:42, down confirmed 10:54:45 (+07:00); `omlx 0.6.4` before and after; key never printed | report §6 |
| 8 | Baselines not worse: shared 1914 pass; core-server unit 3 failed (MODG) outside the sandbox; core-server static guards 137 pass; no pinned count changed | report §8 |

## Blockers

None.

## Decisions for the decision log (full table: report §9)

- D-76-1 `cpu-local` model = a file name inside a host-configured model directory (needs confirmation; rows 115, 117).
- D-76-2 an over-bound thread plan is refused, not clamped (differs from the word "clamps" in tx §C; needs confirmation).
- D-76-3 `CAPTURE_RESERVED_CORES = 2`, `STT_NICE = 10` are proposals.
- D-76-4 the workspace binds no port; the automated oMLX stand-in is in-process.
- D-76-5 the adapter does not clamp segments past the audio; the phantom tail of the oMLX whisper engine (65.54 – 95.52 on a 65.72 s file) is still there; row 77 owns the clamp (needs confirmation).
- D-76-6 the key-loader accepts only `omlx-settings:auth.api_key`; an `ENCRYPTED` credential needs the credential-store row (needs confirmation; relates to D-113-3).
- D-76-7 `THIRD_PARTY_NOTICES.md`: entries for the engines used by this row only.

## Handed to other rows (report §10)

- Row 115: mount the transcriber in the Core (`provideProbe(createConnectionProbe(...))`, `stt_config` snapshot at session start, `enabled = false`), add the CS-22 boot step, pass the log directory and `TranscriberRuntime`.
- Rows 77/78: VAD, checkpoints, retries, segment clamping, diarization, assembly; their DOC-05 entries.
- Controller: SH-09 (dataset service list in `packages/shared`) was not touched by this row.

## Observation

`~/.omlx/settings.json` got a new modification time at the server start (size and SHA-256 unchanged): the server rewrites its own file when it starts. This row wrote nothing there.

## Files

Created: `apps/transcriber/**` (30 files: 4 config, 14 source, 8 unit-test side, 4 real-test side);
`implementation/33_m6_transcriber_adapter.md`; this file.
Updated: `package-lock.json` (+18 lines, under `/usr/bin/lockf -k .locks/npm.lock`); `THIRD_PARTY_NOTICES.md` (one section appended).
Git-ignored: `node_modules/@dems/transcriber` (symlink), `.cache/stt/checks/row76/`.

---

# Fix round 1 (navigator findings) — 2026-10-09

Status: `complete` (one item needs a ruling: D-76-8). Detail and evidence: `implementation/33_m6_transcriber_adapter.md`, section "Fix round 1" (F1-F11). Not committed. Shared files not edited.

| Finding | Outcome |
|---|---|
| N-1 | fixed: static rule rebuilt on the TypeScript syntax tree; the navigator's 11 probes and the 3 first violations are in-memory red cases; red against the old engine first (46 failed), 82 passed now |
| N-2 | fixed per ruling: model IDENTIFIER, file `<modelDir>/<id>.bin`; ONE shared pattern imported from `@dems/shared/api` (it was exported; no local copy); real run with the seeded id reproduces `6039a944…cab94439` |
| N-4 | fixed: excerpt rewritten, 0 timing figures; excerpt step strips timestamps and timing fields and refuses to write a line that keeps one. Log BACKUPS not edited (byte copies of the shared service's log; not evidence) |
| N-5 | fixed: engine started through `nice` (no shell); host asked first; default `required` mode starts no engine when the host cannot lower; unit test strict on either branch; real test asserts niceness from `ps`. Linux per-thread niceness = class-C, not claimed |
| N-6 | fixed: three-variable environment, nothing inherited |
| N-7 | fixed: real path of the model file must be inside the model directory |
| N-8 | fixed for the connection (always `127.0.0.1`); the `Host` header CANNOT be kept as `localhost` through `fetch` (measured) — D-76-8, needs a ruling |
| N-9 | fixed locally; follow-up for row 113's shared endpoint pattern |
| N-10 | fixed: escaped/encoded forms blanked by value; by-position rules are now the shared rule set of row 113 |
| N-11 | fixed: `documentShape` removed; strict schema is the proof and is shown rejecting; `resultShape` can differ and states the QA difference |
| N-13 | fixed: PCM must be 16 kHz Int16, files mono 16-bit integer PCM; else `AUDIO_FORMAT_UNSUPPORTED` |
| N-14 | fixed: one new directory per run, exclusive writes |

Numbers: suite 8 files / 239 passed / 1 skipped (complementary niceness block); M6-AD-1 11; M6-CP-1 20; typecheck and lint exit 0; core-server static guards 137 passed.

oMLX (second and last sanctioned session): pre-check 11:32:52, log backed up 11:32:52, started 11:32:52 (PID 2825), one serialised file 11:32:55-11:33:08 (7 passed), stopped 11:33:10, down confirmed 11:33:14 (+07:00); `omlx 0.6.4` before and after; port 8000 free; never beside the CPU run.

Decisions to record: D-76-8 (Host header, ruling needed), D-76-9 (`nicePath`, `priority` host options), D-76-10 (accepted audio forms), D-76-11 (run-directory stamps are not figures). D-76-1 is superseded by the ruling.

Honest notes: (1) only N-1 was red-first in the strict sense; the other fixes were shown red by removing each fix in a scratch copy (13 mutations, all red in the condition they apply to). (2) The first real CPU run of this round wrote `ps` sample COUNTS into its evidence file; I removed them (a fixed-interval count is a duration in disguise) and the test now writes booleans. (3) `shared` and `core-server` unit suites were not re-run (other rows are editing them).

---

# Fix round 2 (navigator re-check) — 2026-10-09

Status: `complete`. Detail: `implementation/33_m6_transcriber_adapter.md`, section "Fix round 2" (G1-G9). Not committed; no lockfile write; no oMLX run; only `apps/transcriber/**` and the evidence folder touched.

| Finding | Outcome |
|---|---|
| R-1 (major) | fixed: the rule is `engine niceness >= min(parent niceness + 10, 19)` against this process's own `os.getPriority()`, in the host probe, the unit helper and the real test. Real run in the foreground (parent 0 → engine 10) and as a zsh background job (parent 5 → engine 15): both 5 passed, both `6039a944…cab94439`, 14 segments |
| R-2 (minor) | fixed: 14 in-memory fixtures for the four evasions; two new rules (`PROCESS_OBJECT_IS_NOT_PASSED_AROUND`, `NO_DIRECT_OUTPUT`), two extended (`NO_DYNAMIC_CODE`, `NO_NETWORK_MODULE`). Run-time-built names and a descriptor held in a variable stay documented residuals |
| Evidence hygiene | fixed: runner `Start at`/`Duration` lines and per-test millisecond suffixes removed from the stored outputs; capture steps strip them |

Numbers: 8 files / 259 passed / 1 skipped (the complementary niceness block); static 97; M6-AD-1 11; M6-CP-1 25; typecheck and lint exit 0.

Notes for the record: (1) "engine lower than the CAPTURE WORKER" is a rule between sibling processes for rows 77/115; not built, stated in the code comment. (2) Two of my tests broke when the parallel row-113 round changed `packages/shared` (the model-id pattern was tightened; the blanking rules read my `[credential]:` as a member name). Fixed on my side: the pattern text is no longer pinned, and the transcriber's placeholder is now the shared `CREDENTIAL_BLANK`. (3) The R-1 unit tests were red before the fix only because their functions did not exist; the behavioural red is the navigator's refused background run and a mutation back to the absolute rule (3 tests fail).
