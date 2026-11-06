# Progress — CP-B1 fix round B2b continuation (coder-execution-local)

- Started 2026-10-05 ~10:05 WIB. Test step label `b2br2`. Single writer of the named `apps/core-server` structural paths for items 8a and 9–13.
- Pre-images: `.cache/rollback/CPB2b_r2/` (per-file copies of every edited path) + the prior round's full-tree `.cache/rollback/CPB2b/`. The P23 `git diff acaff20 -- <paths>` patch is empty (`apps/core-server/` is untracked); file copies are the pre-images (M12).
- Baseline 10:0x whole `unit`: 152 files / 3,845, exit 0. Baseline whole `db`: 121 files, 2 failed / 1,725 passed (the two = item 8a), exit 1; teardown 0 databases left with prefix `dems_test_step_b2br2_`.
- Scratch logs: `$TMPDIR/../scratchpad/cpb2br2/logs/` (key ones copied to `gateway_check/assets/04c_*`). Out-of-tree mutation scripts under `$TMPDIR/../scratchpad/cpb2br2/mut/`.
- Report: `gateway_check/04c_cp_backend_fix_round_b2b.md`.

## Items (this holder: 8a then 9–13; 0–8 by the previous holder)

| # | Item | Status | Proof | Notes |
|--:|---|---|---|---|
| 0–8 | (previous holder, 21:06–22:02) | done | see `coder_execution_fix_round_b2b.md` | not touched here |
| 8a | Two digest-verdict assertions (D131) | done | targeted db 2 files / 51, exit 0 | `seed.db.test.ts:160`, `bulk-fixture.db.test.ts:346`; assertion only |
| 9 | Shims + neutral test support (CPB1-12) | done | unit green-of-mine; db 121 / 1,727 exit 0 | 18 specifiers rewritten (12 files); 7 shims removed; seed-index store-names block dropped; 2 static tests updated |
| 10 | CPB1-18..26 + F-9 | done (safe subset) | typecheck 0, lint 0 | F-9 comments ×4; CPB1-23 confirmed already closed; rest reported (owner/forbidden/W91/close-out) |
| 11 | log-call static test sees spreads (D123a) | done | log-calls 7 passed; mutation old=[] new=[cause,reason] | `log-calls.ts` `inlineObjectStarts` + recurse in `membersOf`; positive control extended |
| 12 | `ACTIVITY_EXEMPT_OPERATIONS` (D126 G-1) | done | authenticate 42 passed; mutation reachable-inputs identical | `index.ts:176` list → `['signIn','signOut']`; test 440–451 rewritten to the D126 device-principal model (granted by-design) |
| 13 | npm script for `dropDeadRun` (FU-DN-3) | done | smoke REFUSED(GUARD_NOT_A_TEST_DATABASE), 0 remain | new `test/drop-dead-run.ts`; `package.json` script `test:db:drop-run` |

## End state of this round's files

- typecheck exit 0; lint exit 0 with zero warnings.
- whole `unit`: 3,911 passed / 1 failed; whole `db`: 1,737 passed / 3 failed; **0 databases left** with prefix `dems_test_step_b2br2_`.
- Every failure in both projects is in `test/helpers/db/**`, the exclusive write path of the parallel helper-owner row (D134), editing that folder live this round (its tests cite "decision D134"). No failure is in a file this round wrote. Named per M12/P11, not edited.

## Left for others / decisions

- F-B2b-1 realtime shim pinned by its own test; F-B2b-2 core/engine/admin support files keep private helpers; F-B2b-3 D134 must land `test/helpers/db/**` green before gate W58. Details and DN-1..DN-3 in the report §10.
