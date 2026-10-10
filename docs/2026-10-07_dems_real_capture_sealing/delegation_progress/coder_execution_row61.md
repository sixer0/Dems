# coder-execution — row 61 (M3-W5: static rules, boot checks, storage)

Status: **needs-review** (2026-10-09). Note: `implementation/23_m3_static_boot.md`.

Why not complete: the boot step is built and proven unmounted; mounting it is one import and one
statement in `apps/core-server/src/capture/index.ts` (row 71b's file) — request filed 15:15:28Z,
with two that go with it (signing-key provisioning command; real-mode test fixture).

## Files

New
- `apps/core-server/src/capture/boot/{checks.ts,evidence-volume.ts,worker-probe.ts,index.ts}`
- `apps/core-server/src/capture/boot/__tests__/{checks.test.ts,evidence-volume.test.ts,worker-probe.test.ts,boot.test.ts,support.ts,worker-probe.real.ts}`
- `apps/core-server/test/static/guard-family.test.ts`
- `apps/capture-worker/test/static/{pinned_calls.py,pinned-calls.tsv,libavformat.pin}`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/23_m3_static_boot.md`

Edited
- `apps/core-server/src/capture/__tests__/static.test.ts` (file pin, G-R2 entry, block G-R16 appended; P25 lists untouched)
- `apps/core-server/src/capture/adapters/__tests__/static.test.ts` (block A-5 and its header line)
- `apps/capture-worker/check.sh` (static part), `apps/capture-worker/test/static/planted.tsv` (25 lines appended)
- `delegation_progress/file_claims.md` (2 lines), `delegation_progress/file_requests.md` (8 lines, 15:15:28Z)

Not edited: `src/capture/index.ts`, `supervisor.ts`, `fence/**`, `src/config.ts`, `app.ts`,
`test/static/imports.test.ts`, the worker's C sources, the Makefile.

## Results

- boot folder 58 / 58; with the capture, adapters and workspace static guards 266 of 269 — the 3
  red are other rows' in-flight edits (P25 `app.ts` digest: rows 90 / 91; G-R16 and the closed-unit
  list: `src/capture-session/`, row 71b).
- `check.sh src` OK; `check.sh --selftest` exit 0 on the second run (first: my own delimiter bug).
- typecheck: 0 errors in this row's files (27 in files of rows 71a / 71b / 82); lint: 0 findings in this row's files.
- A-5: closed by this row.

## Requests filed (15:15:28Z)

mount (blocking) · `capture-session/index.ts:225` asks the one function (blocking for G-R16) ·
proof-mark refusal in `supervisor.ts` · `_Static_assert` in `worker.h` · fence comments (rows 4, 5)
· legacy capture-mode readers become callers · INTERNAL action for volume figures (CS-09) ·
signing-key provisioning command (blocking with the mount).
