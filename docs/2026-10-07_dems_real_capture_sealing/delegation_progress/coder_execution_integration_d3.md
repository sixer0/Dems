# coder-execution - integration pass D3 (D133)

Status: complete (two rulings: microphone after the user's diagnostic; camera fixed-grid candidate is built, proven and OFF because it turns M4-LOCAL-AV-1 red).
Note: `implementation/97_integration_pass_d3.md`.

Files changed (all inside the pass's ownership):
- apps/core-server/src/capture/adapters/local/camera-helper-args.ts (`fixedGrid` candidate, default off; production list unchanged)
- apps/core-server/src/capture/adapters/local/__tests__/mic-support.ts (scripted door reports progress)
- apps/core-server/src/capture/adapters/local/__tests__/e2e/local-mic-capture.ts (`--diagnose`, `--proof`), local_camera_e2e.py (session-first stop, `--jitter-ms`, `--grid`, `--helper-first`, criterion `clean_stop_raises_no_warning`), print-camera-args.ts (`--grid`)
- NEW apps/core-server/src/capture/adapters/local/__tests__/mic-diagnose.ts, mic-diagnose.test.ts, camera-fixed-grid.test.ts
- apps/core-server/src/capture/fence/__tests__/fence.test.ts (living door, opposite case, control)
- docs: implementation/97_integration_pass_d3.md, delegation_progress/file_claims.md (2 lines), file_requests.md (1 line, row 71b)

Not touched: mic-helper-args.ts and every other production file; apps/capture-worker/**; packages/**; `.data/**` (read: text files of `l134_cam_t2` only).
Devices: none opened. Worker: built binary used under `.locks/heavy-host.lock`, ports 8559 / 8561, 5 runs.
Results: unit (adapters/local + fence) 235 / 0 with the sandbox off; typecheck 29 errors, none in the two folders; lint clean in the two folders.
Blockers: none. Waiting on: the user's `--diagnose` run.

Follow-up D144 (real-boot fixture): EDITED apps/core-server/src/capture/fence/__tests__/fence.db.test.ts, apps/core-server/src/engine/__tests__/capture-actions.db.test.ts, apps/core-server/test/support/engine.ts (one additive option `config`). integration-c1.db.test.ts already had the fixture - unchanged. db run of the three files: 26 passed, 1 failed (A-4, `CPU_LOCAL_RUNTIME_MISSING`, left as ruled). file_claims.md: 2 more lines.
