# coder-execution — fix pass F-M7 (review row 88, decision D178)

**Status: needs-review (partial).** BLOCKER R88-01 closed. MAJOR closed: R88-03, R88-04 (media root +
errata; transcriber dir requested from F-M6), R88-06, R88-07, R88-08, R88-09. MAJOR OPEN: **R88-02**
(only part (b) built), **R88-05** (not started). MINOR: R88-11 and the demo codec fixed, R88-13 and
R88-18 partly, the rest not fixed (reasons in the note). No commit, no migration.

Note: `implementation/113_fix_m7_review.md` (table, runs, decisions, operator sentences).

## Files

NEW (tests): `packages/shared/test/evidence-m7-one-camera.test.ts`;
`apps/core-server/src/sealing/__tests__/{pipeline-one-camera,pipeline-frozen-facts,pipeline-development-key}.test.ts`;
`apps/core-server/src/db/reset/__tests__/{real-evidence-m7.test.ts,real-evidence-m7.db.test.ts}`;
`apps/core-server/src/evidence-verify/__tests__/fix-m7-verify.test.ts`;
`apps/core-web/src/features/evidence/__tests__/verify-v2-signing-key.test.tsx`;
`apps/mobile/src/features/evidence/verify-v2-signing-key.test.tsx`.

EDITED (product): `packages/shared/src/evidence-package/{layout,fragments,manifest}.ts`;
`packages/shared/src/evidence-verify/{types,verify,report}.ts`; `packages/shared/src/api/evidence.ts`
(op 41 response only); `packages/shared/openapi/openapi.json` (generator, npm lock);
`packages/shared/src/sim/session-machine.ts` (one statement + one comment line);
`packages/shared/src/i18n/en/evidence.ts` (one appended block);
`apps/core-server/src/sealing/pipeline/{contract,pipeline,camera-files}.ts`;
`apps/core-server/src/sealing-host/{index.ts (2 lines),demo-seed/index.ts}`;
`apps/core-server/src/evidence-verify/index.ts`; `apps/core-server/src/db/commands/evidence-store.ts`;
`apps/core-server/src/db/reset/real-evidence.ts`; `apps/core-server/src/capture/boot/{checks,index}.ts`;
`apps/core-server/src/credential-store/fragment-cipher.ts` (comments);
`apps/core-web/src/features/evidence/{verify-v2.ts,verify-v2-report.tsx,integrity-tab.tsx}`;
`apps/mobile/src/features/evidence/{verify-v2.ts,verify-v2-report.tsx,live-integrity-tab.tsx}`.

EDITED (tests / pins by ruling): `packages/shared/test/{evidence-package,sim-core-driven-seal,evidence-verify-development-key}.test.ts`;
`apps/core-server/src/sealing/__tests__/{pipeline.test.ts,pipeline-support.ts}`;
`apps/core-server/src/sealing-host/__tests__/{demo-seed.test.ts,e2e/seal-e2e.db.test.ts}`;
`apps/core-server/src/evidence-verify/__tests__/{core-verification,verify-v2,development-key}.test.ts`;
`apps/core-server/src/db/reset/__tests__/{real-evidence,package-removal}.test.ts`;
`apps/core-server/src/capture/boot/__tests__/checks.test.ts`;
`apps/core-web/src/features/evidence/__tests__/verify-v2.test.tsx`;
`apps/mobile/src/features/evidence/live-evidence-verify-v2.test.tsx`.

DOCS: `masterplan/05_capture_architecture_spec.md` (erratum CAP-M7-01, §D);
`masterplan/06_evidence_package_spec.md` (PE-M7-01 §B.4, PE-M7-02 §A.3, PE-M7-03 §H.6);
`delegation_progress/{file_claims.md (3 lines),file_requests.md (4 lines)}`.

## Blockers / what the controller must know

- R88-02 (a) retry bounds, (c) terminal UNSEALABLE, and R88-05 are NOT built: a session with no
  sealable camera file still stays FINALIZING and blocks the Core.
- `.data/media/sessions` is mode 0755: a real-mode Core on the main lane is now refused at boot
  until `chmod 700` (not changed by this pass).
- Typecheck of core-server and mobile is red in F-M5's files (capture-notices, capture-session,
  `capture/__tests__/records.test.ts`, `session-recovery/failed-start.test.tsx`); two static pins
  are red from other passes' files (`guard-family.test.ts:65`, `capture/__tests__/static.test.ts:431`).

## Checks for the test runner (each once; db / heavy commands with the sandbox off)

1. `npm -w apps/core-server run test` — whole unit project. Expected: green except reds owned by other passes' in-flight files.
2. `/usr/bin/lockf -k .locks/db-migrate.lock npm -w apps/core-server run test:db` — whole db project (guard files `m4-sec-reset`, `guard`, `m2-guard-keepset`, `store-root`, `modules/demo/__tests__/reset-store-root`, `engine/__tests__/seal-actions`, `test/db/integration-d4`, `sealing/__tests__/*.db.test.ts`). Watch: any real-mode boot fixture whose media root is not 0700 now fails `READABLE_BY_OTHERS`.
3. `sh apps/core-server/src/sealing/__tests__/kill-matrix/run.sh --only <id>` for the remaining 33 cells, one at a time (heavy-host + db locks inside the script). `M7-REF-1` and `M7-KM-C-S6` passed in this pass.
4. `npm -w apps/core-web run test`, `npm -w apps/core-web run typecheck`.
5. `npx -w apps/mobile jest --maxWorkers=2`, `npx -w apps/mobile tsc --noEmit`.
6. `npm -w packages/shared run test` (passed once in this pass: 2454).
7. `test/acceptance/contract.test.ts` (db project): op 41 answers now carry `signature` (nullable member) and `notices`.
