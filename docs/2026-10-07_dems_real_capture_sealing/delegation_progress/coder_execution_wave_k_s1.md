# coder-execution - fix wave K, driver S1

Status: **needs-review** (2026-10-11 01:05 WIB). Note: `implementation/139_fix_wave_k_s1.md`. Contract: `delegation_progress/contract_wave_k.md`, section S1 ("S1 consistent at 2026-10-11 01:00 WIB").

Done: G75c-01 (restart fault ends with its session; heals at the next start), the seal rig (`lane.sh seal-rig 2 ...`), G89b-01 manifest half (field 36 states the stream + WARNING notice), G81b-04, G75c-05, G75c-08 (both halves), G75c-06 server / shared half.
Not done, decisions asked: G89b-01 generator half (note 139 decision 1), G89b-07 (decision 2). Written for W / M2 only: G89b-06.

Files created: `apps/core-server/src/engine/restart-fault.ts`; `apps/core-server/src/engine/__tests__/wave-k-s1-restart-fault.test.ts`, `.db.test.ts`; `apps/core-server/src/sealing-host/__tests__/wave-k-s1-seal-rig.test.ts`, `wave-k-s1-stream-profile.test.ts`; `apps/core-server/src/sealing/__tests__/wave-k-s1-transcript-eta.test.ts`; `apps/core-server/test/support/lane-seal-rig.ts`; `packages/shared/test/sim-wave-k-s1-timeline-fault.test.ts`; `docs/.../implementation/139_fix_wave_k_s1.md`; this file.
Files changed: see note 139 section 3.
Requests filed: `file_requests.md` 18:00:00Z (S2: op 41 `plainChecked`), 18:00:10Z (docs owner: three errata), 18:00:20Z (W / M2 notice).
Lane 2: not called. It must be restarted by M1 to run this code.
