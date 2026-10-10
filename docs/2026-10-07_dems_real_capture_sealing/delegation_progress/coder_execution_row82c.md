# Row 82c — coder-execution

Status: **needs-review** (2026-10-10). Note: `implementation/37c_m7_seal_fixes_demo_seed.md`.

- Done and proven at unit level: one fragment bound shared with the verifier + named refusal at CLOSE_TRACKS; SEALED-but-open journal finished at boot with guarded plaintext removal; seed-time v2 demo generator (clean PASS, EV 0005 names `(VIDEO-02, 3)`, 8.59 MB per package); coordinator's D160 rig line.
- Red: `M7-KM-P4-S6`, `C-S6`, `P2-S6`, `P3-S6`, once each, all by `FRAGMENT_TOO_LARGE` from the rig's unpaced generated source (97.8 to 107.9 MiB fragments). Blocking request filed for `capture/adapters/local/camera-helper-args.ts`.
- Not done: item 1(b) edit (foreign file), seed hook, op 41 admission (requests filed).

Files edited: `apps/core-server/src/sealing/pipeline/{contract.ts,pipeline.ts,controller.ts}`, `apps/core-server/src/sealing/index.ts`, `apps/core-server/src/sealing/__tests__/{pipeline.test.ts,pipeline-support.ts,support.ts,stt-states-verify.test.ts}`, `apps/core-server/src/sealing-host/index.ts` (two own blocks).
Files new: `apps/core-server/src/sealing-host/demo-seed/{index.ts,source-arguments.ts}`, `apps/core-server/src/sealing-host/__tests__/{demo-seed-support.ts,demo-seed.test.ts,demo-seed.generated.test.ts}`.
Not touched: `apps/capture-worker/**`, `capture/adapters/**`, `packages/shared/**`, kill-matrix harness, any migration.
Requests: four lines in `file_requests.md` (generated source pacing + rate, worker fragment cap, seed hook, op 41 admission).
