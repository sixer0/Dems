# coder-execution - integration pass C2 (D120)

Status: complete (two findings need a ruling: microphone rate hypothesis contradicted; first-GOP / held-first-frame at camera start).
Note: `implementation/93_integration_pass_c2.md`.

Files changed (all inside the pass's ownership):
- apps/core-server/src/capture/adapters/local/camera-helper.ts, mic-helper.ts, errors.ts, process-door.ts, camera-helper-args.ts, mic-helper-args.ts
- apps/core-server/src/capture/adapters/local/__tests__/mic-stream-check.ts, camera-helper.test.ts, mic-helper-args.test.ts (pinned argument lists only)
- NEW apps/core-server/src/capture/adapters/local/__tests__/no-delivery.test.ts, mic-rate-judge.test.ts, camera-run-numbers.test.ts
- apps/core-server/src/capture/adapters/local/__tests__/e2e/local-mic-capture.ts, local_camera_e2e.py; NEW e2e/camera_run_numbers.py
- apps/core-server/test/support/fake-onvif-stub.ts, fake-onvif-stub.test.ts
- apps/core-server/src/capture/adapters/camera/__tests__/support.ts; NEW loopback-guard.test.ts
- apps/core-server/src/capture/fence/__tests__/fence.db.test.ts (item 7: the control case and one comment)
- docs: delegation_progress/file_claims.md (3 lines), file_requests.md (2 lines)
A file `adapters/local/delivery-watch.ts` was created and folded into `camera-helper.ts` within this pass (it would have needed a pin in the closed `adapters/__tests__/static.test.ts`); it does not exist.

Not touched: apps/capture-worker/**, packages/capture-protocol, shared contract, web, mobile, db/**, capture/fence production files.
Generated run folders left under `.cache/m3worker/runs/c2_cam_gen1`, `c2_cam_gen_over` (generated picture only).
Results: adapters + stub + static 481 passed / 2 failed (A-5 by design; credential.test audit rule of rows 132/142); fence db file 14 passed; typecheck and lint clean.
