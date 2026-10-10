# coder-execution — integration pass D9

Status: **needs-review** (2026-10-10). Note: `implementation/103_integration_pass_d9.md`.

| Item | State |
|--|--|
| 1 model provenance by backend (D160) | done; 31 unit cases of row 82c's rig red until one requested line lands; verifier request filed for pass D10 (today's verifier PASSES the server-backend package) |
| 2 snapshot or refuse | done |
| 3 codec from the init segment | done |
| 4 microphones started together | done |
| 5 reachability probe wired | done |
| 6 MIC_RATE_AT_LIMIT advisory | done |
| D162 (a) `.fails` removed | done |

Files (repo root):
- `packages/shared/src/evidence-package/manifest.ts`, `packages/shared/test/evidence-transcript-states.test.ts`
- `apps/transcriber/src/pipeline/document.ts`, `apps/transcriber/src/__tests__/document.test.ts`
- `apps/core-server/src/sealing/finalize-transcript/{document.ts,contract.ts,handler.ts}` (provenance members only)
- `apps/core-server/src/transcription/{model-provenance.ts,session-run.ts}`, `__tests__/{model-provenance,session-run}.test.ts`
- `apps/core-server/src/sealing-host/{session-reader.ts,index.ts}` (index: one import member + one port line), `__tests__/{transcript-step,sealing-host}.test.ts`
- `apps/core-server/src/capture/fragments.ts`, `__tests__/fragments.test.ts`
- `apps/core-server/src/capture-session/{index.ts,facts.ts}`, `__tests__/session-capture.db.test.ts`
- `apps/core-server/src/capture-notices/index.ts`, NEW `__tests__/probe-wiring.test.ts`
- `apps/core-server/src/capture/forwarder.ts`, `__tests__/forwarder-engine.test.ts`
- `docs/2026-10-07_dems_real_capture_sealing/masterplan/{06_evidence_package_spec.md,07_transcript_spec.md}` (errata PE-D9-01..03)
- `delegation_progress/{file_claims.md,file_requests.md}` (two claim lines; two request lines: pass D10 verifier, row 82c test rig)

Blockers: none for this pass's own proof. Open for others: row 82c's rig line (blocking 31 cases), pass D10's report line.
Decisions: D-D9-1 .. D-D9-8 in the note, section 4.
