# coder-execution - integration pass E2

Status: **complete** (2026-10-10). Note: `implementation/108_integration_pass_e2.md`.

## Result
- Re-run `waveE_fix`, once: 31 checks, 31 as expected, 0 unexpected, no port left, AGGREGATE EXIT CODE 0 (542 s).
- A: the port holder was not the harness and not the supervisor. A `node` test worker of a parallel core-server unit run (fake ONVIF stub, which takes 8564 then 8563 from the top of the shared range) held both ports for about 3 s, 10 minutes after the refused start. Harness guard made tolerant (bounded wait) and informative (holder's command line).
- B: one control (two runs) used a proof build through the supervisor: `neg_sup_forbidden_mux_option`. Replaced by `sup_refuses_proof_build`, `neg_sup_release_worker_is_accepted`, `neg_sup_av_judged_as_no_offset`. No bypass; `supervisor.ts` untouched.
- C: all p4 and M5 checks as expected; no finding.

## Files changed
- `apps/capture-worker/test/m3worker.py`
- `apps/capture-worker/test/e2e.py`

## Files written
- `docs/2026-10-07_dems_real_capture_sealing/implementation/108_integration_pass_e2.md`
- `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder_execution_integration_e2.md`
- `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/file_claims.md` (two `pass E2` lines appended)
- scratch, git-ignored: `.cache/waveE_fix/e2e.log`, `.cache/m3worker/e2e/waveE_fix/`, `.cache/m3worker/runs/e2e_waveE_fix_*`

## Not touched
`supervisor.ts`, `src/capture/index.ts`, `test/support/capture*`, `capture-session-driver.ts`, `m5mic.py`, worker C sources, `test/static/**`, `check.sh`, `src/capture/boot/**`, any db file, `.locks/db-migrate.lock`, local devices.

## Checks for the test runner
- None required. Optional at the next gate: the whole series (117 checks) on a bottom port pair, `make -C apps/capture-worker e2e E2E_ARGS="--tag <tag>"`, heavy-host lock taken by the target, expected exit 0.

## Decisions for the controller
See note 108, "For the controller" (port pair, stub port rule, README line 79, D168 wording, series +4 checks).
