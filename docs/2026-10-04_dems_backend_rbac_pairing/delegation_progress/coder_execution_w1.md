# coder-execution — row W1 (web closing round) — progress

Started 2026-10-06 02:28 WIB. Status: **complete** (03:08); follow-up W1b (D182, DC-3 granted) **complete** (03:21). Report: `gateway_check/08b_w1_web_closing.md`. Decisions for the controller: DC-1 (item 2 write-set reading: the export dialogs edited at their call sites), DC-2 (W75 gains the D176 check and the endless guard), DC-3 (grant `lib/__tests__/core-page-walk.test.ts` + the W75 D176 test).

| Item | Status | Notes |
|---|---|---|
| 1 Unused `ALLOWED` entry (D178 DC-1) | done 02:31 | entry removed (`test/live-strict-mode-starts.test.tsx`, was :228-232); guard 11/11 green; in-memory proof P01–P03 detected (pre-W76 shape, settle in set-up, helper not returned), control P04 (entry restored hides the pre-W76 regression) green; typecheck 0 |
| 2 One walker for operations 59 and 63 (D178 DC-4, FW76-5) | done 02:51 | new `lib/core-page-walk.ts` (`walkAuditChain`, `walkAllEvents`, the D176 check before every page, `SIGNED_OUT_PAGE`, ENDLESS, chain check); `security-audit/export-file.ts` and `system/live-log-export.ts` keep their error classes, targets and files as thin adapters; dialogs: call sites pass `signedIn` (W75 gains the D176 check; W76's own reader check moved into the walk) — interpretation of 'export files' recorded as DC; 12 files / 166 tests green; typecheck 0, lint 0; mutations 29 tree runs: 22 detected + 1 control green + 6 survivors (S03, F05, F06, F08, F09, F11), all 6 killed by the out-of-tree proof `.cache/w1/proof/core-page-walk.proof.test.ts` (10 tests) |
| 3 W54's shell test (D179 DC-1, DC-2) | done 02:55 | (a) `afterEach` clears `bed` before `dispose()`; (b) the table looks for `users-roles-page` / `paired-devices-page` (column `stubId` → `bodyId`); IDs renamed at `users-roles/index.tsx:120`, `paired-devices/index.tsx:82` (+ their docblocks); 9 files / 162 tests green; typecheck 0; in-memory proofs: Q01 one throwing dispose → 1 failed, Q02 same with the old clean-up → 4 failed (cascade into the 3 static tests); Q03/Q04 an ID reverted → W54's row red |
| 4 Queries after sign-out (D176, F75-2) | done 02:56 (no code) | both reads (`queries.ts:69-87` listUsers, `:89-107` getRoleMatrix) are `enabled: useReadAllowed()` = Live && `useCorePermission(USER_ADMIN)` (= `live.session?.permissions.includes(…) ?? false`, `packages/shared/src/live/mode.ts:90-92`) && link up → off the moment the session is null; commands only invalidate. In-memory proof: two injected D176 tests (sign-out here; the Core ends the session) green on the tree (U00 control), red for the F75-2 shape (U01: 1→2 reads; also 3 existing W77 tests red). Observation: the Retry buttons call `refetch()` (bypasses `enabled`), reachable only by a press on a mounted page |
| 5 Read-only list for W92 | done 03:00 (no code) | pending guards outside the hook: session-new create (`index.tsx:184,265-293`), security-audit chain verify (`chain-panel.tsx:84,107-128`, spinner first like A9), evidence verification run (`use-verification.ts:205,236`), login submit (`use-login-controller.ts:156-161,324,357`); sanctioned: devices keyed set, A9 integrity-panel; reveal timers: none; page reporters not on `createPageReporter`: evidence, session-new, storage, network-time, session-monitor, login logs; console loggers: `devices/motion.ts:82` (panel boundary, message+stack) and `api-reference/log.ts:9`; effect-started commands: none new (effects scanned by script) |

Baseline 02:28:59: six protected test files hashed into `.cache/w1/protected.sha256`; `git diff --stat HEAD` over them empty.

## Final gate (02:59–03:02, `gateway_check/assets/08b_w1_final_gate.log`)

- `npm run test -w @dems/core-web -- --maxWorkers=2`: 93 files / 1,244 tests, exit 0 (load 1.20 at start).
- typecheck and lint of `@dems/core-web`: exit 0, exit 0.
- Six protected test files: sha256 OK against `.cache/w1/protected.sha256` (02:28:59).
- Files written since 02:28:59 under `apps/core-web/src`, `packages/shared/src`, `apps/core-server/src`: the 9 of the report's §10 only.
- Mutations (in memory, M15; `assets/08b_w1_mutations.log`): item 1 3/3 + control; walker 19 by tree tests, 3 by the injected W75 proof, 6 survivors all killed by the out-of-tree proof; item 3 Q01–Q04 as expected (cascade 4 failed with the old clean-up, 1 with the new); item 4 U01 detected + control green. Tree files identical before/after every batch.
- Deviation: one read-only subshell `(cd <repo> && shasum …)` in the first baseline command.

## Follow-up W1b (decision D182: PASS; DC-1, DC-2 accepted; DC-3 granted), 03:08–03:21 — complete

- Created `apps/core-web/src/lib/__tests__/core-page-walk.test.ts` (10 tests; `PageError` field instead of a parameter property for `erasableSyntaxOnly`) and `apps/core-web/src/test/live-security-audit-signout.test.tsx` (1 test, W75's D176 case on W75's bed; no existing test file edited).
- Walker mutation set against the tree only (28 `T…` mutants, production edit only, no injection): 13/13 (03:10–03:14) + 15/15 (03:14–03:18) detected; tree files identical before/after.
- Whole web suite 95 files / 1,255 tests exit 0 (03:18, load 2.00); typecheck 0; lint 0; six protected files sha256 OK; only the two new files written since 03:05.
- Report: `gateway_check/08b_w1_web_closing.md` §11; gate log `assets/08b_w1b_gate.log`. Ledger 93 / 1,244 → 95 / 1,255.
