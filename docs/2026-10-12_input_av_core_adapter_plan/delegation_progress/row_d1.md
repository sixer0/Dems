# Row D1 (wave 12, agent D1) - diagnosis of row 184's seal `WRITE_FAILED`

Status: complete. Record: `test/d1_seal_write_failed_diagnosis.md` (Tier 2).

- Reproduced 4 of 7 valid runs on today's tree (development sources, worker SIGKILL after the first durable fragment;
  session INTERRUPTED by `endCapture(durable)`, cause `EXITED`; no stop, no abort). Predicted before each kill: 7 of 7 right.
- Cause: database refusal SQLSTATE 23514 `evidence_items_values_check` (`sealed_at >= ended_at`); the seal stated the end
  as `startedAt + media end` while the worker's media zero lay 372-443 ms before `startedAt`. Not a file-system fault:
  the disk was clean and the package complete in every failing run.
- Fix: `apps/core-server/src/sealing/pipeline/pipeline.ts` (`durableEndOf`, Math.min with sealedAt, both call sites);
  test `apps/core-server/src/sealing/__tests__/pipeline.test.ts` ("D1: an interrupted recording never ends AFTER ...") -
  RED before (durableEndMs +400), GREEN after. Sealing unit 146/146, sealing-host 150/150, tsc exit 0, oxlint exit 0;
  end to end 3/3 SEALED in the mode that failed 2/2.
- Request: one line in `file_requests.md` (the worker's media zero to the Core; manifest field 16 still overstated by
  128-159 ms on development sources).
- DRIVER DECISIONS: (1) a guard (clamp to sealedAt) rather than a new anchor - the anchor needs protocol/worker files
  nobody edits in this wave; (2) my first two lock chains held db-migrate while waiting for heavy-host (~19 min in all)
  before I replaced them with a turnstile script that holds db-migrate idle at most 240 s.
- Left: no process, no listener, no database (`0 remain` in every run); `.cache/task4-d1/` 103 MB, secret scan 0.
