# coder-execution - pass H-Y (2026-10-10)

Status: complete. Note: `implementation/130_pass_hy.md`. No commit, no migration, no git write.

| Item | Side wrong | Result |
|---|---|---|
| 1 speech session (A6) | test: the survivor is the speech engine (`whisper-cli ... /<sessionId>/work/chunk-1.wav`), which the seal's transcript step waits for; assertion split into "no capture process after the stop" and "no process + no scratch after the seal" | passed to its end: item READY / document ASSEMBLED, 2 chunks, 7 segments, both chunks MIC-01, no `intervals_incomplete`, provenance complete, 56 heard words all in the reference |
| 1b item state word | test: asked the item for `ASSEMBLED`; the slice's word is `READY` | fixed in the test |
| 2 `sealedPackage` | test: the rig writes no package, `NOT_READABLE` is true | 5 passed |
| 3 NOT_XML / DECLARATION | test stub: random bytes hold `<!` about once in 130 | fixed body, reasons pinned; 74 passed three times under load |
| 4 seal e2e facts | gap | facts JSON per case + wave-H assertions; 3 passed |
| 5 (found by 4) | PRODUCT: `deriveTime` put GNSS back on a host-clock slice between health ticks; a start row sealed `GNSS` | one line in `packages/shared/src/sim/derive.ts`, red test first |

Files written:
- packages/shared/src/sim/derive.ts
- packages/shared/test/sim-pass-hy-host-clock-derive.test.ts (new)
- apps/core-server/src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts
- apps/core-server/src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts
- apps/core-server/test/db/integration-d4.db.test.ts
- apps/core-server/test/support/fake-onvif-stub.ts
- apps/core-server/test/support/fake-onvif-stub.test.ts
- apps/core-server/src/capture/adapters/camera/__tests__/probe-answer.test.ts
- docs/2026-10-07_dems_real_capture_sealing/implementation/130_pass_hy.md
- docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder_execution_pass_hy.md
- docs/2026-10-07_dems_real_capture_sealing/delegation_progress/file_claims.md (three appended lines)

Blockers: none. Decisions for the controller: section 9 of the note. Checks for the test runner: section 8.
