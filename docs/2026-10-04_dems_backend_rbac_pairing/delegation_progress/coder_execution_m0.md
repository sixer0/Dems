# coder-execution — row M0 (CPM1-3, decision D148): one link rule in the mobile runtime

**Status**: complete (2026-10-05 20:19-20:40 and 22:23-22:40 WIB; report `gateway_check/09a_m0_link_rule.md`)

- 20:19 Read the CP-M1 report (finding CPM1-3, answers 3 and 4, section 5), both copies, their
  callers and tests, the runtime barrel, `core-link.ts`, `connection-banner.ts`, report 51 section 4,
  the client spec section 3.5 / LB-6 / LB-10 / CL-17.
- 20:27 Pre-images of the three files to edit saved under `.cache/rollback/M0/` with their SHA-256
  (`pre.sha256`). `apps/mobile` equals commit `b90a3c6` at this time (`git diff --stat b90a3c6 -- apps/mobile` empty).
- 20:29 Written `apps/mobile/src/runtime/link-notice.ts` (the view `coreLinkViewOf`, the rule `offlineNoticeAfter`);
  barrel `runtime/index.ts`: one export block + one row in each of the two header tables.
- 20:30 The two copies replaced by re-exports of the runtime rule (`pairing-live-model.ts`: `export { offlineNoticeAfter } from '@/runtime'`,
  `liveLinkViewFor` now reads `coreLinkViewOf(link) === 'up'`; `login-live-model.ts`: `export { offlineNoticeAfter as liveOfflineNoticeAfter } from '@/runtime'`).
  Callers (`use-pairing-flow.ts`, `use-login-controller.ts`) not edited at all, not even their import lines.
- 20:31 typecheck exit 0. 20:33 tests `runtime/link-notice.test.ts`, `runtime/link-notice-static.test.ts` written.
- 20:34 4 targeted suites / 49 tests pass; typecheck 0; lint 0 errors 0 warnings over 464 files (`.cache/m0/eslint.json`).
- 20:35 `src/features/pairing src/features/login src/runtime`: 28 suites / 381 tests pass (load 4.8).
- 20:40 First whole-suite run started; the agent stream stalled at ~20:40 and the run died by 21:01 under heavy host load
  (5 suites finished in 20 min; `session-live-screen.test.tsx` 957 s; two timing failures, evidence-detail 20 s timeout and
  pairing-live 423 timeout / "Retry in 40s" vs 41s). Log `.cache/m0/full_suite_1.log`. Treated as void; re-run below.
- 22:23 RESUMED on the controller's message. State check: the three edited files complete (diff 19+/39-), typecheck re-run next.
- 22:24 State verified: the three edited files are complete (no half edit); typecheck exit 0. The suites that failed
  under load in the void run pass at load 3.3: pairing-live, evidence-detail, live-login = 3 suites / 43 tests.
- 22:25 Whole suite (checkpoint, before the purity test was added): 96 suites / 1,256 tests, exit 0, 48.7 s
  (`.cache/m0/full_suite_2.log`).
- 22:27 Added a behavioural purity test (spies on Date.now, performance.now, setTimeout, setInterval) to
  `link-notice.test.ts`, so an in-memory clock mutant is caught (the text scan reads the tree, not the mutant).
  The two new files: 27 tests pass.
- 22:30 Mutation tooling in `.cache/m0/mut/` (in-memory transformer, config, driver; 29 mutants). Running in two batches.
- 22:30 Mutation batch 1 (control + W1-W4, D1-D5, L1-L2, C1-C3): control 86/86 green; 14 of 14 detected; tree identical (`.cache/m0/mut/run1_batch1.log`).
- 22:33 Mutation batch 2 (T1-T5, N1-N5, U1, V1-V2, P1-P2): 15 of 15 detected; tree identical. Total 29 of 29. Assets copied to `gateway_check/assets/09a_m0_*`.
- 22:34 FINAL GATE on the finished tree: mobile 96 suites / 1,257 tests exit 0 (57.6 s, load 4.1); typecheck exit 0;
  lint exit 0, eslint JSON 464 files 0 errors 0 warnings; the 72 baseline test files byte-equal to `acaff20`; every
  W57/W59 test file and both callers unchanged against `b90a3c6` (`gateway_check/assets/09a_m0_final_gate.log`).
- 22:40 Report written: `gateway_check/09a_m0_link_rule.md` (copies side by side, differences B-1..B-5, semantics,
  call sites, tests, static check, 29/29 mutation results, DN-1..DN-5, the paragraph for W66-W82, rollback).

## Files

Created: `apps/mobile/src/runtime/link-notice.ts`, `apps/mobile/src/runtime/link-notice.test.ts`,
`apps/mobile/src/runtime/link-notice-static.test.ts`, `gateway_check/09a_m0_link_rule.md`,
`gateway_check/assets/09a_m0_{final_gate.log,mutations.log,mutate.py.txt,mutating_transformer.cjs.txt,jest_mut_config.cjs.txt}`, this file.
Updated: `apps/mobile/src/features/pairing/pairing-live-model.ts` (9+/21-), `apps/mobile/src/features/login/login-live-model.ts` (7+/18-),
`apps/mobile/src/runtime/index.ts` (3+: one export block, two header table rows).
Not touched: the callers, every test of `features/pairing` and `features/login`, the 72 baseline tests, `auth/**`, `navigation/**`,
`src/app/**`, `jest.setup.ts`, `package.json`, `packages/shared/**`, `apps/core-web/**`, `apps/core-server/**`.

## Decisions for the controller (detail in report section 9)

DN-1 absent heartbeat hides (Login copy kept `shown`; no visible change, proven) - ratify. DN-2 no hold window (0 ms) - keep.
DN-3 two comment rows in the barrel header beyond the export block - ratify or remove. DN-4 Pair reads the Live link, Login the
heartbeat (kept); page rows hand `useCoreLink()`. DN-5 the banner's `nextBannerKind` stays separate, pinned by an agreement test.
