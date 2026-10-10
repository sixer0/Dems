---
task_id: 2026-10-07_dems_real_capture_sealing
row: 61
date: 2026-10-09
agent: coder-execution
status: needs-review
---

# Row 61 — static rules, boot checks, storage (M3-W5)

Paths are below `apps/core-server/` unless they start with another folder. Baseline `e296ce7`.
No commit. No worker, camera or microphone was started by this row's runs; no database was used.

## 1. What was built

| # | What | Where |
|--|--|--|
| 1 | CS-22 boot checks of real capture, pure decision: missing worker key, path rule, evidence store, signing key, worker `HELLO`; `SIMULATED` inert | `src/capture/boot/checks.ts:261` (`runCaptureBootChecks`), `:102`, `:156`, `:207` |
| 2 | Probe of the evidence store on its real volume: exclusive create, sync, **hard link**, "link onto an existing name is refused", real volume figures (statfs) | `src/capture/boot/evidence-volume.ts:49` |
| 3 | Worker handshake at boot: started once through the process channel, first frame read, ended; no `START` | `src/capture/boot/worker-probe.ts:30` |
| 4 | Mount + control (`capture.boot` step, `captureBootControl(app)`); asks THE one function, reads no flag | `src/capture/boot/index.ts:102` |
| 5 | Capture guard: file pin and G-R2 allowlist entry for the probe; new rule **G-R16** (capture mode / demo flag decided in one function; legacy readers pinned, list only shrinks) | `src/capture/__tests__/static.test.ts:74`, `:89`, `:154`, `:837` |
| 6 | Block **A-5 closed** as a pinned rule (who may reach the adapter layer, and only through its index from outside the capture unit) | `src/capture/adapters/__tests__/static.test.ts:188` |
| 7 | Guard-family count: 21 baseline guards + 5 of task 3 by name; rule ids G-R1..G-R16 of the capture guard; the worker guard's 19 rule tags incl. row 58's D58-1 / D58-2; pinned-call table invariants | `test/static/guard-family.test.ts` |
| 8 | Worker rule **R-6 / F-10**: every creating, truncating, renaming, linking, removing call and every mux-option call counted and placed, read as tokens | `apps/capture-worker/test/static/pinned_calls.py`, `pinned-calls.tsv` (30 rows) |
| 9 | libavformat pin 63.1.102 (FFmpeg 9.0.2), refused at build; proof-build rule (every proof build marks its `HELLO`) | `apps/capture-worker/test/static/libavformat.pin`; `apps/capture-worker/check.sh` (`version_rule`, `proof_rule`) |
| 10 | 25 planted evasions + 5 in-place mutations + comment control | `apps/capture-worker/test/static/planted.tsv`; `check.sh --selftest` |

Refusal codes: `CAPTURE_OPERATION_REFUSED` (reason = the fence's code, e.g.
`REAL_CAPTURE_WITH_DEMO_CONTROLS`), `CAPTURE_WORKER_NOT_CONFIGURED`,
`CAPTURE_WORKER_PROGRAM_UNUSABLE`, `CAPTURE_EVIDENCE_STORE_UNUSABLE`, `CAPTURE_SIGNING_KEY_UNUSABLE`,
`CAPTURE_WORKER_NO_HANDSHAKE`, `CAPTURE_WORKER_PROTOCOL_MISMATCH`, `CAPTURE_WORKER_PROOF_BUILD`,
`CAPTURE_WORKER_VERSION_UNKNOWN`. Each is logged and written to the persistent error log; no
message holds a path.

Adopted, not rebuilt: `captureOperationDecisionOf` (row 136), `helperProgramRefusal` /
`inspectProgram` (row 134: the worker path uses the SAME rule as the helper program),
`loadSoftwareSigner` (row 83), `createProcessLauncher` (row 57). The `SYSTEM_BOOT` ruling is
untouched (real operations only).

## 2. Real vs stand-in

- Real: the path inspector, the volume probe, the key store and the process channel, run on files
  below `.data/` (`boot.test.ts`, `evidence-volume.test.ts`).
- Stand-in: the worker of those tests is a shell script that says one `HELLO`. The real worker
  builds are a check for the test runner (§6).
- **The boot step is NOT mounted.** `src/capture/index.ts` is row 71b's; the two statements are a
  request. Until it is applied nothing of this row runs at a boot.

## 3. Commands and results (each once; a second run only after a fail)

| Command | Result |
|--|--|
| `npx vitest run --project unit --root apps/core-server src/capture/boot` | 4 files, 58 / 58 |
| same, with `src/capture/__tests__/static.test.ts`, `src/capture/adapters/__tests__/static.test.ts`, `test/static` | 269 tests: 266 pass, 3 red, all three from other rows' in-flight edits (§4) |
| `sh check.sh src` (from `apps/capture-worker`) | static rules OK, incl. R-6, F-10, D85 `libavformat 63.1.102` |
| `sh check.sh --selftest` | first run exit 1 (my mutation list split on `\|`, fixed); second run exit 0, 64 "refused as required" + the comment control accepted |
| `npm run typecheck -w @dems/core-server` | 0 errors in this row's files; 27 errors in 11 files of rows 71a / 71b / 82 in flight (`capture/__tests__/{forwarder,records,forwarder-engine,supervisor}.test.ts`, `test/support/capture.ts`, `capture/index.ts`, `capture-session/index.ts`, `engine/index.ts`, `sealing/**`, `modules/recording-fragments/__tests__`) |
| `npm run lint -w @dems/core-server` | 0 findings in this row's files |

Controls: every refusal test stands beside the configuration that passes; A-5, G-R16 and the
family count each have a planted control; the 15 evasions of D84 R-6 / D85 R-8 and the two of F-10
are each refused by rule R-6 / F-10 (list in `planted.tsv`).

## 4. Not proven / open

1. **Red at hand-over, not this row's:** (a) `capture/__tests__/static.test.ts` P25 `app.ts`
   digest — a mount line was added to `app.ts` in flight (rows 90 / 91) and the waived list is
   theirs to move by delta; (b) G-R16 — `src/capture-session/index.ts:225` (row 71b, new file)
   compares the capture mode itself; requested, not added to the legacy list; (c)
   `test/static/imports.test.ts` — `src/capture-session` is not in the closed-unit list (row 71b).
2. A volume **without hard links** was not available (it needs a device call). The rule is proven
   on facts (`hardLink: false` -> `NO_HARD_LINKS`); the probe is proven on APFS only.
3. **CS-09 is half closed.** The real figures are measured at boot and offered by the control;
   they do not reach the `storage` slice: the shared simulator has no action that takes them.
4. No whole boot on PostgreSQL ran with the step (it is not mounted).
5. The supervisor does not refuse a proof build at a session's `HELLO` (a program replaced after
   boot): requested from row 71b.
6. The version pin is refused by `check.sh`; `make build/capture-worker` alone skips it. The
   compile-time half (`_Static_assert`) is a request to row 71a.
7. R-6 / F-10 are tripwires. Limits (in the script's header): strings built at run time, macros
   of system headers, what libavformat opens itself.
8. No low-space threshold: the spec names none; the figures are reported, not judged.

## 5. To wire when a row lands

- Row 71b: the mount in `src/capture/index.ts`; `captureOperationOf` in `capture-session/index.ts`;
  the proof-mark refusal in `supervisor.ts`.
- Row 82 (or a small row): a provisioning command for the signing key at `<dataDir>/signer`
  (`SIGNING_STORE_SUBPATH`); a real boot is refused `KEY_ABSENT` without it.
- Whoever applies the mount: real-mode db tests take `realBootFixture()`
  (`src/capture/boot/__tests__/support.ts`).
- Pass D1b / row 71b: the INTERNAL action for the real volume figures.
- Rows 71a: a changed pinned call moves its row of `pinned-calls.tsv` by decision.

## 6. Checks for the test runner

| ID | Command (repo root) | Lock | Expected |
|--|--|--|--|
| M3-BC-1 real builds, F-10 | `make -C apps/capture-worker all proof`, then `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock npx tsx apps/core-server/src/capture/boot/__tests__/worker-probe.real.ts` | heavy-host | exit 0; `capture-worker: ACCEPTED (capture-worker/0.3.0)`; every `capture-worker-*` proof build `CAPTURE_WORKER_PROOF_BUILD` (7 with row 71a's `intervalskew`) |
| M3-SR-2 | `make -C apps/capture-worker check selftest` | none | exit 0; `static rules OK (... R-6 ..., F-10 ..., D85 libavformat 63.1.102 ...)`; at least 64 "refused as required" |
| M3-SR-1, M4-SR-1 | `npm test -w @dems/core-server` (whole unit project, once per commit) | none | green once §4 item 1 (a)-(c) are closed by their rows; baseline 3 MODG failures otherwise |
| M3-MG-1 | `git status --porcelain \| grep -Eci '\.(mp4\|m4s\|mov\|mkv\|wav\|pcm\|aac\|h264\|flac)$'` after any capture run | none | `0` |
| M3-BC-1 whole boot (after the mount) | a real-mode boot per refusal on the db project, `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- src/capture` | db-migrate | each refusal stops at step `capture.boot` with its code; `SIMULATED` unchanged |

Device / browser checks: none of this row's own. Gate flow B of row 136 (refusals at start) gains
the codes of §1 once the step is mounted.

## 7. Decisions taken

1. Table row 4 keeps the code `REAL_CAPTURE_WITH_DEMO_CONTROLS`. **Row 5 (`simulated` without demo
   controls) boots and is labelled** `SIMULATED_WITHOUT_DEMO_CONTROLS` (info line): it is the
   configuration of every test app (`test/support/config.ts:30`); refusing it stops them all.
2. The checks live in `src/capture/boot/` (the capture unit is the only one allowed a file-system
   door, G-R1 / G-R2); one new pinned importer, `evidence-volume.ts`.
3. Worker path rule = the helper program's rule (root or the server's user as owner, no group /
   other write on the file or any directory on the way). Stricter than the row text in the
   directory part, wider in accepting root.
4. Worker versions are an allowlist (`capture-worker/<n>.<n>.<n>`), not only "no `-PROOF`".
5. Signing key store = `<dataDir>/signer` (suggestion of D-83-7), checked strictly at a real boot.
6. The pinned-call rule is Python (`python3`, already used by the worker's e2e harness), called by
   `check.sh`; the older spelling rules stay beside it.
7. A-5 closed here: the wiring list names `src/modules/sessions/` and `src/capture-session/` for row 71.
8. The G-R16 legacy list was not extended for row 71b's new reader.
