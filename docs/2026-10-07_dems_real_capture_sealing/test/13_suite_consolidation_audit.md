---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: test-expert
step: test-suite consolidation, step 1 (measured audit, read-only)
decision: D233
tree: a5d75ed (wave M); counts and times from the run of test/12_precommit_wave_m.md
status: complete
---

# Test-suite consolidation, step 1: the measured audit

Read-only. No product file, no test file, no git write, no lane, no database test, no test executed.
Every number below comes from a command of this session; the scripts are in the session scratchpad
(`scratchpad/audit13/`: `collect.mjs`, `inv.mjs`, `dup.mjs`, `near.mjs`, `pins.mjs`, `gaps.mjs`) and
are named at each section. Counts of tests and times are those of the last whole run
(`test/12_precommit_wave_m.md`), read from its raw reports (`scratchpad/wm/*.json`: vitest
`--reporter=json`, jest `--json`), which hold every test's full name and duration.

## 0. What the measurement says, before the detail

1. **The suite is not large because of copy-paste.** Of 13,133 `it` bodies of 80+ characters, 71
   are textually identical to another one (25 clusters) and 89 are near-identical at Jaccard 0.8
   over 6-token shingles (33 clusters). That is under 1 % (section 3 b). Titles repeated in two or
   more files: 139 clusters inside a workspace, 71 across workspaces (section 3 a).
2. **Two thirds of it is older than this task.** 668 files and 11,443 of the 17,511 tests live in
   files that existed at `c2c983b`. This task added 523 files and 6,068 tests; the fix waves G/H to
   M added 169 files and 1,335 tests (7.6 % of the suite). No test file was deleted in any of the
   16 commits (section 2).
3. **A quarter of the tests are rows of a table.** 13,428 static `it` / `test` call sites produce
   17,511 tests: 4,083 tests come from `.each` and loops (section 3 a).
4. **The per-wave files are a readability and navigation cost, not a duplication cost.** 165 files
   (1,337 tests) carry a wave / pass / fix / row name; 149 of them import a product module that a
   feature-named file of the same workspace already tests, 141 in the same folder (section 3 c).
5. **The static pins are the measured source of stale reds.** Of the 7 reds of the last four
   pre-commit runs, 6 were stale pins and 1 a test race; none was a product defect (section 4).
   83 tests in 74 files pin the list of files a scan reads; 12 pin a digest or a state "as it was
   at" a commit; 216 test files are named on a line with "pin" in 91 of the 163 implementation
   notes.
6. **The run time sits in a few real waits.** One db file is 101 s of the 243 s db run; in each of
   server-unit, server-db, core-web and mobile, files that wait on real timers hold 38 to 54 % of
   the summed file time (section 5).
7. **What the gates found was outside what these tests can see** (section 6): a booted lane after
   an adoption, a real browser's media stack, Android hit-testing and Reanimated, a client reading
   a member the Core never sends, a store holding the snapshot of an earlier session.

Consequence for the plan (sections 7 and 8): the consolidation will reduce FILES by about 14 %
and the workspace wall time by an estimated 15 to 25 %, and remove the classes of red that were
only stale lists. It will reduce the TEST COUNT by about 1 % at most. A larger cut of the count
would need evidence this audit could not produce (per-test coverage and mutation runs; section 8).
That differs from the account recorded in D233 ("the same behaviour is tested in shared, server,
web and mobile"): the overlap between layers that can be measured from text is 71 title clusters
(69 of them core-web + mobile), 64 i18n sentences asserted as literals in two or more workspaces,
and 19 contract examples referenced in three or more layers, which the plan protects.

## 1. Inventory

Commands: `git ls-files '*.test.ts' '*.test.tsx'` (1,200 files; 9 `apps/transcriber/test/real/*.real.test.ts`
are outside every default run and excluded below, leaving 1,191 = the files of run 12);
`node collect.mjs` (TypeScript compiler API over every test file: call sites, titles, bodies,
imports, flags) and `node inv.mjs` (lines by `split('\n')`; product = tracked `.ts` / `.tsx` under
the workspace that is neither a test file nor test support; test support = non-test files under
`__tests__/`, `test/`, `src/test/`, `testing/`, and `jest.setup.ts`). Not in any workspace suite and
not counted: `scripts/pg/*.test.*` (7 files, `node --test`).

| workspace | test files | tests (run 12) | test LOC (.test files) | test support LOC | product LOC | test : product (files only) | incl. support |
|---|---|---|---|---|---|---|---|
| shared | 121 | 2612 | 39226 | 3373 (9 files) | 61615 (168 files) | 0.64 | 0.69 |
| capture-protocol | 1 | 31 | 539 | 0 (0 files) | 1028 (1 files) | 0.52 | 0.52 |
| server | 552 | 9134 | 155615 | 28039 (116 files) | 83935 (429 files) | 1.85 | 2.19 |
| core-web | 182 | 2224 | 47909 | 3273 (13 files) | 66579 (435 files) | 0.72 | 0.77 |
| mobile | 311 | 2924 | 56467 | 7978 (41 files) | 69353 (439 files) | 0.81 | 0.93 |
| transcriber | 20 | 567 | 5091 | 1469 (6 files) | 5023 (28 files) | 1.01 | 1.31 |
| mock-core | 4 | 19 | 492 | 0 (0 files) | 426 (6 files) | 1.15 | 1.15 |
| **total** | 1191 | 17511 | 305339 | 44132 | 287959 | 1.06 | 1.21 |

core-server split by vitest project:

| project | files | tests | test LOC |
|---|---|---|---|
| server-unit | 356 | 6691 | 88788 |
| server-db | 196 | 2443 | 66827 |

### Families

| workspace | family | files | tests (run 12) | LOC | sum of file wall ms |
|---|---|---|---|---|---|
| shared | feature-named | 50 | 1311 | 16663 | 6857 |
| shared | feature-named, `sim-` prefix | 29 | 443 | 7259 | 2075 |
| shared | feature-named, `live-` prefix | 23 | 704 | 12052 | 7580 |
| shared | wave-* | 13 | 93 | 1894 | 613 |
| shared | integration-* | 2 | 34 | 775 | 128 |
| shared | pass-* | 2 | 16 | 340 | 145 |
| shared | fxr-* | 1 | 3 | 33 | 5 |
| shared | review / gate / followups | 1 | 8 | 210 | 65 |
| capture-protocol | feature-named | 1 | 31 | 539 | 12 |
| server-unit | feature-named | 271 | 5647 | 73610 | 145608 |
| server-unit | static (name or folder) | 44 | 701 | 9349 | 3564 |
| server-unit | wave-* | 35 | 277 | 4827 | 6546 |
| server-unit | fix-* | 4 | 34 | 569 | 322 |
| server-unit | review / gate / followups | 1 | 28 | 327 | 13 |
| server-unit | pass-* | 1 | 4 | 106 | 145 |
| server-db | feature-named | 180 | 2399 | 64465 | 307972 |
| server-db | wave-* | 12 | 28 | 1653 | 33482 |
| server-db | integration-* | 3 | 14 | 592 | 1780 |
| server-db | pass-* | 1 | 2 | 117 | 483 |
| core-web | feature-named | 82 | 851 | 17863 | 162165 |
| core-web | feature-named, `live-` prefix | 69 | 1059 | 23601 | 223491 |
| core-web | wave-* | 20 | 253 | 4968 | 102763 |
| core-web | copy-round-* | 4 | 16 | 444 | 3122 |
| core-web | fxr-* | 3 | 9 | 223 | 1260 |
| core-web | review / gate / followups | 1 | 2 | 92 | 1451 |
| core-web | row* / live-row* | 1 | 2 | 159 | 1649 |
| core-web | pass-* | 1 | 17 | 353 | 2633 |
| core-web | feature-named, `sim-` prefix | 1 | 15 | 206 | 129 |
| mobile | feature-named | 182 | 1702 | 30908 | 177075 |
| mobile | feature-named, `live-` prefix | 59 | 635 | 15467 | 100798 |
| mobile | wave-* | 53 | 447 | 7449 | 89865 |
| mobile | static (name or folder) | 12 | 103 | 1715 | 910 |
| mobile | pass-* | 2 | 10 | 230 | 2597 |
| mobile | fix-* | 1 | 2 | 99 | 812 |
| mobile | review / gate / followups | 1 | 13 | 349 | 3473 |
| mobile | feature-named, `sim-` prefix | 1 | 12 | 250 | 611 |
| transcriber | feature-named | 17 | 431 | 4346 | 23174 |
| transcriber | row* / live-row* | 2 | 25 | 411 | 3642 |
| transcriber | static (name or folder) | 1 | 111 | 334 | 266 |
| mock-core | feature-named | 4 | 19 | 492 | 5713 |

Totals per family over all workspaces:

| family | files | tests | LOC | sum of file wall s |
|---|---|---|---|---|
| feature-named | 787 | 12391 | 208886 | 828.6 |
| feature-named, `live-` prefix | 151 | 2398 | 51120 | 331.9 |
| wave-* | 133 | 1098 | 20791 | 233.3 |
| static (name or folder) | 57 | 915 | 11398 | 4.7 |
| feature-named, `sim-` prefix | 31 | 470 | 7715 | 2.8 |
| pass-* | 7 | 49 | 1146 | 6.0 |
| integration-* | 5 | 48 | 1367 | 1.9 |
| fix-* | 5 | 36 | 668 | 1.1 |
| fxr-* | 4 | 12 | 256 | 1.3 |
| review / gate / followups | 4 | 51 | 978 | 5.0 |
| copy-round-* | 4 | 16 | 444 | 3.1 |
| row* / live-row* | 3 | 27 | 570 | 5.3 |

`wave-*` files by wave letter:

| wave | files | tests |
|---|---|---|
| H | 49 | 371 |
| I | 31 | 197 |
| K | 34 | 321 |
| L | 19 | 209 |

### The 30 largest test files (lines)

| # | file | LOC | tests | file wall s |
|---|---|---|---|---|
| 1 | `packages/shared/test/live-source-local-end.test.ts` | 2376 | 86 | 4.0 |
| 2 | `apps/core-server/test/acceptance/contract.test.ts` | 2150 | 38 | 12.4 |
| 3 | `packages/shared/test/realtime-live-socket.test.ts` | 1767 | 117 | 0.3 |
| 4 | `apps/core-server/test/acceptance/rbac-matrix.test.ts` | 1678 | 39 | 5.5 |
| 5 | `apps/core-server/test/acceptance/pairing-lifecycle.test.ts` | 1565 | 31 | 0.6 |
| 6 | `packages/shared/test/live-source-session.test.ts` | 1491 | 75 | 1.0 |
| 7 | `apps/core-server/src/capture-session/__tests__/session-capture.db.test.ts` | 1463 | 55 | 18.3 |
| 8 | `apps/core-server/test/acceptance/restart.test.ts` | 1372 | 16 | 3.2 |
| 9 | `apps/mobile/src/features/pairing/pairing-live.test.tsx` | 1312 | 28 | 8.2 |
| 10 | `apps/mobile/src/auth/live-auth.test.tsx` | 1307 | 41 | 1.8 |
| 11 | `apps/mobile/src/runtime/live-device.test.tsx` | 1307 | 34 | 2.2 |
| 12 | `packages/shared/test/api-registry.test.ts` | 1224 | 42 | 0.1 |
| 13 | `apps/core-server/src/modules/sessions/__tests__/routes.test.ts` | 1167 | 91 | 0.8 |
| 14 | `apps/core-server/src/modules/system/__tests__/routes.test.ts` | 1055 | 88 | 0.5 |
| 15 | `apps/core-server/src/sealing/__tests__/pipeline.test.ts` | 1002 | 61 | 5.8 |
| 16 | `apps/core-server/src/capture/__tests__/static.test.ts` | 973 | 49 | 0.1 |
| 17 | `apps/core-server/src/modules/stt-config/__tests__/routes.test.ts` | 933 | 68 | 0.5 |
| 18 | `apps/core-server/src/engine/__tests__/restart.db.test.ts` | 921 | 27 | 6.2 |
| 19 | `packages/shared/test/api-state-slices.test.ts` | 917 | 103 | 0.8 |
| 20 | `apps/core-server/src/evidence-verify/__tests__/verify-v2.test.ts` | 908 | 61 | 1.6 |
| 21 | `packages/shared/test/api-realtime.test.ts` | 895 | 74 | 0.8 |
| 22 | `apps/core-server/test/acceptance/shared-state.test.ts` | 886 | 6 | 4.5 |
| 23 | `apps/core-server/src/modules/evidence/__tests__/commands.db.test.ts` | 872 | 33 | 0.9 |
| 24 | `packages/shared/test/live-source-resilience.test.ts` | 859 | 27 | 0.3 |
| 25 | `packages/shared/test/live-source-bindings.test.ts` | 857 | 111 | 0.2 |
| 26 | `apps/core-server/src/modules/identity/biometric/__tests__/sign-in.db.test.ts` | 850 | 27 | 0.9 |
| 27 | `packages/shared/test/live-testing-fetch.test.ts` | 849 | 89 | 0.2 |
| 28 | `apps/core-server/src/realtime/__tests__/upgrade.db.test.ts` | 818 | 70 | 0.3 |
| 29 | `apps/core-server/src/modules/evidence/__tests__/routes.test.ts` | 815 | 80 | 0.4 |
| 30 | `apps/core-server/src/core/__tests__/pipeline.test.ts` | 811 | 40 | 0.4 |

### Tests per feature folder

**shared**

| folder | files | tests | of which per-wave family files / tests | wall s |
|---|---|---|---|---|
| `test/live-*` | 23 | 704 | 0 / 0 | 7.6 |
| `test/sim-*` | 43 | 549 | 14 / 106 | 2.9 |
| `test/api-*` | 18 | 440 | 2 / 11 | 4.0 |
| `test/evidence-*` | 6 | 233 | 0 / 0 | 0.4 |
| `test/realtime-*` | 2 | 130 | 0 / 0 | 0.3 |
| `test/client-*` | 4 | 114 | 0 / 0 | 0.4 |
| `test/redaction-*` | 3 | 74 | 0 / 0 | 0.0 |
| `test/contrast-*` | 1 | 66 | 0 / 0 | 0.0 |
| `test` | 2 | 50 | 0 / 0 | 0.0 |
| `test/session-*` | 3 | 42 | 0 / 0 | 0.2 |
| `test/integration-*` | 2 | 34 | 2 / 34 | 0.1 |
| `test/motion-*` | 1 | 21 | 0 / 0 | 0.0 |
| `test/openapi-*` | 1 | 21 | 0 / 0 | 0.5 |
| `test/demo-*` | 1 | 18 | 0 / 0 | 0.4 |
| `test/theme-*` | 1 | 17 | 0 / 0 | 0.0 |
| `test/auth-*` | 1 | 15 | 0 / 0 | 0.1 |
| `test/brand-*` | 1 | 15 | 0 / 0 | 0.1 |
| `test/audio-*` | 1 | 14 | 0 / 0 | 0.2 |
| `test/format-*` | 1 | 14 | 0 / 0 | 0.0 |
| `test/hash-*` | 1 | 14 | 0 / 0 | 0.1 |
| `test/storage-*` | 1 | 9 | 0 / 0 | 0.1 |
| `test/schemas-*` | 1 | 8 | 0 / 0 | 0.0 |
| `test/heartbeat-*` | 1 | 4 | 0 / 0 | 0.0 |
| `test/capture-*` | 1 | 3 | 0 / 0 | 0.0 |
| `test/fxr-*` | 1 | 3 | 1 / 3 | 0.0 |

**capture-protocol**

| folder | files | tests | of which per-wave family files / tests | wall s |
|---|---|---|---|---|
| `test` | 1 | 31 | 0 / 0 | 0.0 |

**server-unit**

| folder | files | tests | of which per-wave family files / tests | wall s |
|---|---|---|---|---|
| `src/plugins` | 29 | 815 | 0 / 0 | 2.0 |
| `src/capture` | 31 | 636 | 5 / 86 | 16.7 |
| `src/db` | 28 | 613 | 1 / 10 | 8.0 |
| `test/helpers` | 11 | 394 | 0 / 0 | 0.9 |
| `src/sealing` | 18 | 276 | 4 / 17 | 35.5 |
| `src/engine` | 20 | 252 | 4 / 17 | 1.9 |
| `src/core` | 8 | 221 | 0 / 0 | 0.7 |
| `src/realtime` | 10 | 211 | 0 / 0 | 3.0 |
| `src/modules/identity` | 12 | 206 | 0 / 0 | 0.7 |
| `src/capture/adapters/local` | 11 | 200 | 0 / 0 | 21.4 |
| `src/modules/security-audit` | 5 | 196 | 0 / 0 | 0.6 |
| `src/modules/sessions` | 4 | 176 | 0 / 0 | 1.0 |
| `test/static` | 15 | 171 | 0 / 0 | 2.6 |
| `src/modules/evidence` | 6 | 154 | 1 / 4 | 0.5 |
| `src/modules/demo` | 6 | 153 | 1 / 2 | 0.5 |
| `src/evidence-verify` | 13 | 149 | 4 / 23 | 2.9 |
| `src/sealing-host` | 15 | 136 | 9 / 85 | 9.3 |
| `test/db` | 4 | 126 | 0 / 0 | 0.1 |
| `src/modules/system` | 3 | 124 | 0 / 0 | 0.5 |
| `src/capture/adapters/camera` | 6 | 102 | 0 / 0 | 10.8 |
| `src/modules/devices` | 4 | 100 | 0 / 0 | 0.5 |
| `src/transcription` | 10 | 94 | 0 / 0 | 19.7 |
| `src/modules/stt-config` | 3 | 88 | 0 / 0 | 0.8 |
| `src/modules/admin` | 3 | 87 | 0 / 0 | 0.2 |
| `src/modules/storage` | 3 | 86 | 0 / 0 | 0.3 |
| `src/modules/capture-discovery` | 8 | 85 | 2 / 9 | 0.1 |
| `src/media-stream` | 5 | 71 | 1 / 30 | 0.3 |
| `src/modules/alerts` | 3 | 70 | 0 / 0 | 0.3 |
| `src/modules/media-stream` | 3 | 68 | 2 / 29 | 2.3 |
| `src/modules/pairing` | 4 | 64 | 0 / 0 | 0.2 |
| `test/support` | 4 | 64 | 0 / 0 | 7.0 |
| `src/evidence-export` | 8 | 62 | 1 / 5 | 2.4 |
| `src/credential-store` | 4 | 61 | 0 / 0 | 0.3 |
| `src/modules/capture-config` | 6 | 56 | 1 / 3 | 0.3 |
| `src/modules/transcripts` | 6 | 54 | 1 / 4 | 0.3 |
| `src/capture-notices` | 4 | 44 | 0 / 0 | 0.2 |
| `src/modules/network-time` | 2 | 44 | 0 / 0 | 0.3 |
| `src/capture/adapters/__tests__` | 5 | 41 | 0 / 0 | 0.3 |
| `src/modules/recording-fragments` | 1 | 31 | 0 / 0 | 0.0 |
| `src/modules/evidence-export` | 2 | 24 | 0 / 0 | 0.3 |
| `src/evidence-facts` | 3 | 14 | 3 / 14 | 0.4 |
| `src/modules/health` | 1 | 12 | 0 / 0 | 0.1 |
| `src/modules/rbac` | 1 | 12 | 0 / 0 | 0.1 |
| `src/modules/capture-inputs` | 1 | 11 | 0 / 0 | 0.1 |
| `src/capture-session` | 2 | 10 | 1 / 5 | 0.0 |
| `src/__tests__` | 1 | 8 | 0 / 0 | 0.1 |
| `src/modules/transcript-chunks` | 1 | 8 | 0 / 0 | 0.0 |
| `src/modules/__tests__` | 1 | 6 | 0 / 0 | 0.0 |
| `src/modules/sealing` | 1 | 4 | 0 / 0 | 0.1 |
| `src/version.test.ts` | 1 | 1 | 0 / 0 | 0.0 |

**server-db**

| folder | files | tests | of which per-wave family files / tests | wall s |
|---|---|---|---|---|
| `test/db` | 15 | 453 | 1 / 5 | 8.5 |
| `src/db` | 17 | 207 | 2 / 6 | 63.7 |
| `src/modules/identity` | 16 | 192 | 0 / 0 | 6.3 |
| `test/acceptance` | 7 | 140 | 0 / 0 | 29.8 |
| `src/modules/security-audit` | 6 | 126 | 0 / 0 | 2.5 |
| `src/plugins` | 7 | 126 | 0 / 0 | 1.8 |
| `src/engine` | 19 | 121 | 4 / 7 | 25.0 |
| `src/modules/evidence` | 9 | 106 | 2 / 8 | 3.4 |
| `src/realtime` | 7 | 99 | 0 / 0 | 1.6 |
| `test/helpers` | 15 | 90 | 0 / 0 | 18.7 |
| `src/modules/pairing` | 7 | 79 | 0 / 0 | 2.5 |
| `src/modules/admin` | 6 | 60 | 0 / 0 | 1.5 |
| `src/modules/transcripts` | 2 | 59 | 0 / 0 | 7.2 |
| `src/capture-session` | 1 | 55 | 0 / 0 | 18.3 |
| `src/core` | 7 | 52 | 0 / 0 | 3.1 |
| `src/modules/sessions` | 7 | 50 | 1 / 2 | 4.1 |
| `src/modules/devices` | 4 | 49 | 0 / 0 | 1.5 |
| `src/modules/demo` | 5 | 47 | 0 / 0 | 7.2 |
| `src/modules/capture-discovery` | 6 | 42 | 2 / 5 | 119.2 |
| `src/modules/system` | 2 | 35 | 0 / 0 | 0.7 |
| `src/capture` | 5 | 29 | 1 / 1 | 5.8 |
| `src/modules/rbac` | 1 | 29 | 0 / 0 | 0.6 |
| `src/modules/recording-fragments` | 1 | 25 | 0 / 0 | 0.1 |
| `src/sealing` | 4 | 25 | 0 / 0 | 2.7 |
| `src/modules/stt-config` | 3 | 24 | 0 / 0 | 0.3 |
| `src/modules/transcript-chunks` | 1 | 24 | 0 / 0 | 0.9 |
| `src/modules/alerts` | 2 | 21 | 1 / 1 | 0.8 |
| `src/modules/storage` | 2 | 21 | 0 / 0 | 0.9 |
| `src/modules/capture-config` | 3 | 19 | 2 / 9 | 1.5 |
| `src/modules/network-time` | 1 | 11 | 0 / 0 | 0.4 |
| `src/transcription` | 1 | 7 | 0 / 0 | 0.3 |
| `src/modules/media-stream` | 1 | 5 | 0 / 0 | 0.1 |
| `src/capture-notices` | 1 | 4 | 0 / 0 | 1.1 |
| `src/modules/capture-inputs` | 1 | 4 | 0 / 0 | 0.3 |
| `src/sealing-host` | 1 | 3 | 0 / 0 | 0.0 |
| `src/capture/adapters/__tests__` | 1 | 2 | 0 / 0 | 0.1 |
| `src/evidence-export` | 2 | 2 | 0 / 0 | 1.3 |

**core-web**

| folder | files | tests | of which per-wave family files / tests | wall s |
|---|---|---|---|---|
| `src/test` | 86 | 1274 | 10 / 143 | 260.6 |
| `src/features/evidence` | 21 | 248 | 8 / 90 | 103.3 |
| `src/features/devices` | 17 | 147 | 5 / 26 | 41.1 |
| `src/lib` | 8 | 116 | 0 / 0 | 1.9 |
| `src/features/session-monitor` | 13 | 101 | 2 / 22 | 26.1 |
| `src/components` | 8 | 81 | 0 / 0 | 3.5 |
| `src/features/system` | 4 | 55 | 0 / 0 | 6.6 |
| `src/features/dashboard` | 5 | 38 | 1 / 2 | 11.2 |
| `src/features/session-new` | 6 | 32 | 3 / 14 | 26.7 |
| `src/motion` | 4 | 32 | 0 / 0 | 0.9 |
| `src/features/login` | 2 | 31 | 0 / 0 | 6.3 |
| `src/features/storage` | 2 | 22 | 0 / 0 | 3.4 |
| `src/features/security-audit` | 2 | 20 | 1 / 2 | 5.0 |
| `src/features/paired-devices` | 2 | 19 | 0 / 0 | 0.0 |
| `src/features/network-time` | 2 | 8 | 0 / 0 | 2.0 |

**mobile**

| folder | files | tests | of which per-wave family files / tests | wall s |
|---|---|---|---|---|
| `src/runtime` | 36 | 427 | 0 / 0 | 20.1 |
| `src/features/evidence` | 34 | 333 | 12 / 150 | 65.3 |
| `src/features/capture-selector` | 32 | 270 | 12 / 118 | 38.4 |
| `src/features/session-live` | 29 | 211 | 5 / 21 | 39.9 |
| `src/auth` | 6 | 172 | 0 / 0 | 4.8 |
| `src/navigation` | 14 | 160 | 1 / 2 | 16.7 |
| `src/features/devices` | 12 | 132 | 3 / 49 | 21.6 |
| `src/features/session-new` | 15 | 121 | 6 / 26 | 39.5 |
| `src/components` | 14 | 120 | 1 / 4 | 6.4 |
| `src/features/dashboard` | 16 | 119 | 6 / 51 | 15.6 |
| `src/features/pairing` | 8 | 95 | 0 / 0 | 16.0 |
| `src/motion` | 5 | 94 | 0 / 0 | 1.6 |
| `src/features/settings` | 10 | 92 | 1 / 2 | 12.6 |
| `src/features/login` | 6 | 75 | 0 / 0 | 9.4 |
| `src/features/session-recovery` | 8 | 75 | 1 / 2 | 8.2 |
| `src/features/session-finalizing` | 9 | 61 | 2 / 15 | 7.3 |
| `src/features/session-summary` | 10 | 59 | 3 / 11 | 9.7 |
| `src/features/sessions` | 12 | 53 | 2 / 8 | 11.6 |
| `src/features/audit` | 7 | 42 | 0 / 0 | 7.0 |
| `src/features/storage` | 4 | 39 | 0 / 0 | 11.2 |
| `src/features/network-time` | 7 | 38 | 1 / 3 | 5.6 |
| `src/layout` | 3 | 33 | 1 / 10 | 0.3 |
| `src/features/more` | 3 | 25 | 0 / 0 | 2.9 |
| `src/features/transcription` | 3 | 20 | 0 / 0 | 0.9 |
| `src/features/rbac` | 2 | 19 | 0 / 0 | 1.7 |
| `src/providers` | 2 | 19 | 0 / 0 | 0.8 |
| `src/i18n` | 1 | 9 | 0 / 0 | 0.1 |
| `src/lib` | 1 | 6 | 0 / 0 | 0.3 |
| `src/features/home` | 2 | 5 | 0 / 0 | 0.8 |

**transcriber**

| folder | files | tests | of which per-wave family files / tests | wall s |
|---|---|---|---|---|
| `src/__tests__` | 20 | 567 | 2 / 25 | 27.1 |

**mock-core**

| folder | files | tests | of which per-wave family files / tests | wall s |
|---|---|---|---|---|
| `test` | 4 | 19 | 0 / 0 | 5.7 |


Reading of the table: core-server holds 52 % of the tests and its test code is 1.85 times its
product code (2.19 with support); the other workspaces are between 0.5 and 1.2.

## 2. Growth

Commands: `git log --reverse --format='%h%x09%ad%x09%s' --date=short c2c983b..HEAD` (16 commits);
per commit `git diff --name-status --no-renames <prev> <commit> -- '*.test.ts' '*.test.tsx'` and
`git diff -U0 ...` counting added minus removed lines that open an `it(` / `test(` call
(`node inv.mjs`). "+it lines" is a static count of call sites, not of run tests (a `.each` row is
one line). The second table groups the tests of run 12 by the commit that added their FILE.

| commit | date | subject (cut) | shared +files / -files / +it lines (net) | capture-protocol +files / -files / +it lines (net) | server-unit +files / -files / +it lines (net) | server-db +files / -files / +it lines (net) | core-web +files / -files / +it lines (net) | mobile +files / -files / +it lines (net) | transcriber +files / -files / +it lines (net) | mock-core +files / -files / +it lines (net) | total +files | family files added |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `85c0fb5` | 2026-10-07 | docs: next-phase drift check and decision D260 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 | 0 |
| `2a4f4ea` | 2026-10-07 | docs: task 3 blueprint (approved, all defaults)  | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 | 0 |
| `0024068` | 2026-10-08 | chore: task 3 checkpoint — Kilo rows 1-40, Claud | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 2 / 0 / +10 | 0 / 0 / +0 | 0 / 0 / +0 | 2 | 0 |
| `b24405e` | 2026-10-09 | feat: task 3 M2 checkpoint — schema v2, 89-opera | 1 / 0 / +18 | 0 / 0 / +0 | 4 / 0 / +55 | 2 / 0 / +15 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 7 | 0 |
| `9d3a1ef` | 2026-10-09 | docs: task 3 M2 device gate 56b — lanes 2 and 3  | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 | 0 |
| `101ce62` | 2026-10-09 | feat: task 3 M3 wave 1 — capture supervisor + IP | 2 / 0 / +28 | 1 / 0 / +10 | 8 / 0 / +137 | 2 / 0 / +12 | 0 / 0 / +6 | 0 / 0 / +5 | 8 / 0 / +121 | 0 / 0 / +0 | 21 | 0 |
| `4b62350` | 2026-10-09 | feat: task 3 M3 row 58 — capture worker, protoco | 1 / 0 / +31 | 0 / 0 / +2 | 4 / 0 / +68 | 2 / 0 / +22 | 0 / 0 / +0 | 0 / 0 / +0 | 7 / 0 / +89 | 0 / 0 / +0 | 14 | 0 |
| `23c8f0b` | 2026-10-09 | docs: task 3 spec gate for R-9..R-11 (rows 126-1 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 / 0 / +0 | 0 | 0 |
| `e296ce7` | 2026-10-09 | feat: task 3 wave C checkpoint (work in progress | 10 / 0 / +145 | 0 / 0 / +3 | 58 / 0 / +923 | 21 / 0 / +228 | 15 / 0 / +176 | 26 / 0 / +248 | 5 / 0 / +116 | 0 / 0 / +0 | 135 | 5 |
| `abf742f` | 2026-10-10 | feat: task 3 wave D/E checkpoint — real capture  | 7 / 0 / +90 | 0 / 0 / +6 | 43 / 0 / +465 | 21 / 0 / +136 | 16 / 0 / +114 | 20 / 0 / +114 | 0 / 0 / +2 | 0 / 0 / +0 | 107 | 3 |
| `f293221` | 2026-10-10 | fix: task 3 wave F — code reviews of M3-M8 (rows | 12 / 0 / +66 | 0 / 0 / +2 | 32 / 0 / +306 | 8 / 0 / +47 | 6 / 0 / +61 | 10 / 0 / +66 | 0 / 0 / +0 | 0 / 0 / +0 | 68 | 5 |
| `74fd1f1` | 2026-10-10 | fix: task 3 wave G/H — six milestone gates run,  | 9 / 0 / +47 | 0 / 0 / +0 | 20 / 0 / +147 | 6 / 0 / +26 | 16 / 0 / +94 | 25 / 0 / +124 | 0 / 0 / +0 | 0 / 0 / +0 | 76 | 51 |
| `57b80a9` | 2026-10-10 | fix: task 3 wave I — re-gates 70 and 75 run, the | 3 / 0 / +24 | 0 / 0 / +0 | 9 / 0 / +49 | 7 / 0 / +16 | 6 / 0 / +68 | 12 / 0 / +70 | 0 / 0 / +0 | 0 / 0 / +0 | 37 | 37 |
| `b05106b` | 2026-10-11 | fix: task 3 wave K — all five re-gates run, thei | 3 / 0 / +17 | 0 / 0 / +0 | 11 / 0 / +88 | 2 / 0 / +11 | 4 / 0 / +67 | 14 / 0 / +110 | 0 / 0 / +3 | 0 / 0 / +0 | 34 | 34 |
| `7b1aded` | 2026-10-11 | fix: task 3 wave L — four targeted re-checks run | 2 / 0 / +25 | 0 / 0 / +0 | 6 / 0 / +35 | 1 / 0 / +2 | 2 / 0 / +69 | 10 / 0 / +72 | 0 / 0 / +0 | 0 / 0 / +0 | 21 | 21 |
| `a5d75ed` | 2026-10-11 | fix: task 3 wave M — four final re-checks run (a | 0 / 0 / +0 | 0 / 0 / +0 | 1 / 0 / +25 | 0 / 0 / +1 | 0 / 0 / +19 | 0 / 0 / +14 | 0 / 0 / +0 | 0 / 0 / +0 | 1 | 0 |
| **sum** | | | 50 / 0 / +491 | 1 / 0 / +23 | 196 / 0 / +2298 | 72 / 0 / +516 | 65 / 0 / +674 | 119 / 0 / +833 | 20 / 0 / +331 | 0 / 0 / +0 | | |

Test files at `c2c983b` (the start of this task) and now:

| workspace | files at c2c983b | files now | tests now | tests in files born in this task |
|---|---|---|---|---|
| shared | 71 | 121 | 2612 | 737 |
| capture-protocol | 0 | 1 | 31 | 31 |
| server-unit | 160 | 356 | 6691 | 2588 |
| server-db | 124 | 196 | 2443 | 575 |
| core-web | 117 | 182 | 2224 | 692 |
| mobile | 192 | 311 | 2924 | 878 |
| transcriber | 0 | 20 | 567 | 567 |
| mock-core | 4 | 4 | 19 | 0 |

Tests of run 12 grouped by the commit that ADDED the file (tests later added to an older file count for the older commit):

| commit | shared | capture-protocol | server-unit | server-db | core-web | mobile | transcriber | mock-core | total files | total tests |
|---|---|---|---|---|---|---|---|---|---|---|
| `(before c2c983b)` | 71 / 1875 | 0 / 0 | 160 / 4103 | 124 / 1868 | 117 / 1532 | 192 / 2046 | 0 / 0 | 4 / 19 | 668 | 11443 |
| `85c0fb5` | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 | 0 |
| `2a4f4ea` | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 | 0 |
| `0024068` | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 2 / 7 | 0 / 0 | 0 / 0 | 2 | 7 |
| `b24405e` | 1 / 10 | 0 / 0 | 4 / 52 | 2 / 8 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 7 | 70 |
| `9d3a1ef` | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 | 0 |
| `101ce62` | 2 / 101 | 1 / 31 | 8 / 209 | 2 / 12 | 0 / 0 | 0 / 0 | 8 / 279 | 0 / 0 | 21 | 632 |
| `4b62350` | 1 / 21 | 0 / 0 | 4 / 102 | 2 / 32 | 0 / 0 | 0 / 0 | 7 / 124 | 0 / 0 | 14 | 279 |
| `23c8f0b` | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 | 0 |
| `e296ce7` | 10 / 299 | 0 / 0 | 58 / 1039 | 21 / 270 | 15 / 216 | 26 / 239 | 5 / 164 | 0 / 0 | 135 | 2227 |
| `abf742f` | 7 / 99 | 0 / 0 | 43 / 537 | 21 / 197 | 16 / 128 | 20 / 113 | 0 / 0 | 0 / 0 | 107 | 1074 |
| `f293221` | 12 / 72 | 0 / 0 | 32 / 268 | 8 / 12 | 6 / 42 | 10 / 50 | 0 / 0 | 0 / 0 | 68 | 444 |
| `74fd1f1` | 9 / 70 | 0 / 0 | 20 / 178 | 6 / 22 | 16 / 99 | 25 / 168 | 0 / 0 | 0 / 0 | 76 | 537 |
| `57b80a9` | 3 / 24 | 0 / 0 | 9 / 50 | 7 / 17 | 6 / 68 | 12 / 83 | 0 / 0 | 0 / 0 | 37 | 242 |
| `b05106b` | 3 / 16 | 0 / 0 | 11 / 108 | 2 / 4 | 4 / 71 | 14 / 122 | 0 / 0 | 0 / 0 | 34 | 321 |
| `7b1aded` | 2 / 25 | 0 / 0 | 6 / 35 | 1 / 1 | 2 / 68 | 10 / 96 | 0 / 0 | 0 / 0 | 21 | 225 |
| `a5d75ed` | 0 / 0 | 0 / 0 | 1 / 10 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 1 | 10 |


Reading: files added by the fix waves G/H, I, K, L, M (`74fd1f1` .. `a5d75ed`): 76 + 37 + 34 + 21 +
1 = 169 files, 537 + 242 + 321 + 225 + 10 = 1,335 tests; 143 of those 169 files carry a family
name. Wave M added 1 file (the new rig module) and put its other tests into existing files, as
D236 ruled. The feature-building checkpoints C, D/E and the review wave F (`e296ce7`, `abf742f`,
`f293221`) added 310 files and 3,745 tests. Deleted test files over the whole task: 0.

## 3. Duplication candidates

Commands: `node dup.mjs` (a to e), `node near.mjs` (near-identical bodies, tablet / phone).
Normalisation of titles: lower case, ids like `SES-20261011-0024` and hex strings replaced, digits
replaced by `N`, quotes and repeated white space removed. Bodies: comments removed, white space
collapsed ("identical"); string and number literals erased as well ("same shape").

#### (a) Titles

| key | min length | clusters within one workspace (2+ files) | tests in them | clusters across workspaces | tests in them |
|---|---|---|---|---|---|
| leaf title, normalised | any | 151 | 389 | 75 | 151 |
| leaf title, normalised | 30+ chars | 139 | 354 | 71 | 142 |
| full name (describe chain + title), normalised | any | 71 | 185 | 36 | 72 |

Tests whose normalised full name repeats inside ONE file (parametrised rows whose title differs only by a number or id): 441.

Clusters by workspace (leaf title, 30+ chars, 2+ files in the same workspace):

| workspace | clusters | tests |
|---|---|---|
| shared | 3 | 9 |
| server | 111 | 274 |
| core-web | 15 | 42 |
| mobile | 9 | 27 |
| transcriber | 1 | 2 |

Top 40 clusters of the same title in 2+ files (leaf, 30+ chars), ordered by number of files:

| # | title (first seen) | tests | files | workspaces | files (first 4) |
|---|---|---|---|---|---|
| 1 | finds each forbidden text when it is present (positive control) | 23 | 23 | server | `core-server/test/static/credentials.test.ts`<br>`core-server/test/static/logging.test.ts`<br>`core-server/test/static/network.test.ts`<br>`core-server/src/capture/__tests__/static.test.ts` |
| 2 | reads the production sources of the folder | 10 | 10 | server | `core-server/src/credential-store/__tests__/static.test.ts`<br>`core-server/src/realtime/__tests__/static.test.ts`<br>`core-server/src/modules/alerts/__tests__/static.test.ts`<br>`core-server/src/modules/admin/__tests__/static.test.ts` |
| 3 | no production file calls the simulator's action hook | 8 | 8 | mobile | `mobile/src/features/dashboard/home-more-live-static.test.ts`<br>`mobile/src/features/devices/devices-live-static.test.ts`<br>`mobile/src/features/session-recovery/recovery-live-static.test.ts`<br>`mobile/src/features/session-summary/summary-live-static.test.ts` |
| 4 | reads the files it means to read | 7 | 7 | core-web | `core-web/src/test/live-dashboard-page.test.tsx`<br>`core-web/src/test/live-evidence-archive.test.tsx`<br>`core-web/src/test/live-login-model.test.tsx`<br>`core-web/src/test/live-network-time-page.test.tsx` |
| 5 | MD-6, TS-15: no file loads the typed client or the Live source, builds a client, opens a socket or imports a t | 6 | 6 | core-web | `core-web/src/test/live-dashboard-page.test.tsx`<br>`core-web/src/test/live-evidence-archive.test.tsx`<br>`core-web/src/test/live-network-time-page.test.tsx`<br>`core-web/src/test/live-security-audit-page.test.tsx` |
| 6 | AC-C-02: no file names node:, react-native, expo, window or document (comments included) | 4 | 4 | shared | `shared/test/client-platform-neutral.test.ts`<br>`shared/test/live-light-platform-neutral.test.ts`<br>`shared/test/live-source-platform-neutral.test.ts`<br>`shared/test/live-testing-platform-neutral.test.ts` |
| 7 | no route carries a hook or a rule of its own: the route configuration is the operation ID and nothing else | 4 | 4 | server | `core-server/src/modules/alerts/__tests__/routes.test.ts`<br>`core-server/src/modules/network-time/__tests__/routes.test.ts`<br>`core-server/src/modules/storage/__tests__/routes.test.ts`<br>`core-server/src/modules/system/__tests__/routes.test.ts` |
| 8 | every pattern finds each of its planted texts (positive control) | 4 | 4 | server | `core-server/src/modules/alerts/__tests__/static.test.ts`<br>`core-server/src/modules/network-time/__tests__/static.test.ts`<br>`core-server/src/modules/storage/__tests__/static.test.ts`<br>`core-server/src/modules/system/__tests__/static.test.ts` |
| 9 | no slot of the scaffold is provided or replaced, and no test file is imported | 4 | 4 | server | `core-server/src/modules/alerts/__tests__/static.test.ts`<br>`core-server/src/modules/network-time/__tests__/static.test.ts`<br>`core-server/src/modules/storage/__tests__/static.test.ts`<br>`core-server/src/modules/system/__tests__/static.test.ts` |
| 10 | the plugin keeps the name the frozen app factory imports | 4 | 4 | server | `core-server/src/modules/alerts/__tests__/static.test.ts`<br>`core-server/src/modules/network-time/__tests__/static.test.ts`<br>`core-server/src/modules/storage/__tests__/static.test.ts`<br>`core-server/src/modules/system/__tests__/static.test.ts` |
| 11 | are constant texts: every exported statement of the store is listed here | 4 | 4 | server | `core-server/src/modules/admin/__tests__/static.test.ts`<br>`core-server/src/modules/identity/__tests__/static.test.ts`<br>`core-server/src/modules/pairing/__tests__/static.test.ts`<br>`core-server/src/modules/identity/biometric/__tests__/static.test.ts` |
| 12 | a second run applies nothing and changes nothing (MG-10) | 4 | 4 | server | `core-server/test/db/set4.db.test.ts`<br>`core-server/test/db/set5.db.test.ts`<br>`core-server/test/db/set6.db.test.ts`<br>`core-server/test/db/set7.db.test.ts` |
| 13 | schema version 6, contract dbc-7: no migration | 4 | 4 | server | `core-server/src/engine/__tests__/fact-doors.db.test.ts`<br>`core-server/src/plugins/permission-guard/__tests__/session-holder.db.test.ts`<br>`core-server/src/modules/sessions/__tests__/audio-intervals.db.test.ts`<br>`core-server/src/modules/transcripts/__tests__/transcript-routes.db.test.ts` |
| 14 | LB-10: a 429 shows the limit toast with the seconds of `retry-after`, never the outage sentence | 4 | 4 | core-web | `core-web/src/test/live-dashboard-devices.test.tsx`<br>`core-web/src/test/live-devices-commands.test.tsx`<br>`core-web/src/test/live-evidence-verify.test.tsx`<br>`core-web/src/test/live-security-audit-export.test.tsx` |
| 15 | reads the folder: every production file, sub-folders included | 4 | 4 | mobile | `mobile/src/features/evidence/live-evidence-static.test.ts`<br>`mobile/src/features/devices/devices-live-static.test.ts`<br>`mobile/src/features/session-recovery/recovery-live-static.test.ts`<br>`mobile/src/features/audit/audit-live-static.test.ts` |
| 16 | uses erasable syntax only: no enum, no namespace, no parameter property | 3 | 3 | shared | `shared/test/live-light-platform-neutral.test.ts`<br>`shared/test/live-source-platform-neutral.test.ts`<br>`shared/test/realtime-live-platform-neutral.test.ts` |
| 17 | no statement is written outside the store | 3 | 3 | server | `core-server/src/modules/admin/__tests__/static.test.ts`<br>`core-server/src/modules/identity/__tests__/static.test.ts`<br>`core-server/src/modules/identity/biometric/__tests__/static.test.ts` |
| 18 | the chain of this database verifies over all rows | 3 | 3 | server | `core-server/src/core/__tests__/connection-lost.db.test.ts`<br>`core-server/src/core/__tests__/search-path.db.test.ts`<br>`core-server/src/core/__tests__/unit-of-work.db.test.ts` |
| 19 | the engine is ready after the boot, with an epoch of at least 1, and runs on the timer this file gave it | 3 | 3 | server | `core-server/src/modules/identity/__tests__/engine.db.test.ts`<br>`core-server/src/modules/pairing/__tests__/engine.db.test.ts`<br>`core-server/src/modules/identity/biometric/__tests__/engine.db.test.ts` |
| 20 | no request line holds a query string: the route is the registry's pattern | 3 | 3 | server | `core-server/src/modules/identity/__tests__/secrets.db.test.ts`<br>`core-server/src/modules/pairing/__tests__/secrets.db.test.ts`<br>`core-server/src/modules/identity/biometric/__tests__/secrets.db.test.ts` |
| 21 | LB-10: a 429 shows the limit toast, never the outage sentence | 3 | 3 | core-web | `core-web/src/test/live-devices-clip.test.tsx`<br>`core-web/src/test/live-devices-drawer.test.tsx`<br>`core-web/src/test/live-evidence-archive.test.tsx` |
| 22 | the copy of Simulated mode is as it was at `acaff20`: 44 texts, one digest | 3 | 3 | mobile | `mobile/src/features/devices/devices-live-static.test.ts`<br>`mobile/src/features/storage/storage-live-static.test.ts`<br>`mobile/src/features/audit/audit-live-static.test.ts` |
| 23 | after 1 appended row(s) the call reads exactly that many audit rows | 6 | 2 | server | `core-server/src/modules/security-audit/__tests__/stored-chain.test.ts`<br>`core-server/src/modules/security-audit/__tests__/chain.db.test.ts` |
| 24 | the database name template0 is refused before any connection, and is not echoed | 3 | 2 | server | `core-server/src/db/reset/__tests__/cli.test.ts`<br>`core-server/src/db/seed/__tests__/cli.test.ts` |
| 25 | is a valid OpenAPI 3.1.0 document for @scalar/openapi-parser, with every $ref resolvable | 2 | 2 | shared | `shared/test/api-openapi-scope.test.ts`<br>`shared/test/openapi.test.ts` |
| 26 | CONTROL: the pattern finds the expression of the defect | 2 | 2 | shared, core-web | `shared/test/sim-wave-l-z-selector-in-force.test.ts`<br>`core-web/src/test/wave-l-z-selector-in-force.test.tsx` |
| 27 | fix 157 CONTROL: the pattern finds the expression of the defect | 2 | 2 | shared, core-web | `shared/test/sim-wave-l-z-selector-in-force.test.ts`<br>`core-web/src/test/wave-l-z-selector-in-force.test.tsx` |
| 28 | SIMULATED: not admitted, nothing is installed; and without a switch file path the rig is inert | 2 | 2 | server | `core-server/test/support/lane-source-rig.test.ts`<br>`core-server/src/sealing-host/__tests__/wave-k-s1-seal-rig.test.ts` |
| 29 | the path null is not the pinned one either | 2 | 2 | server | `core-server/src/engine/__tests__/boot-checks-runner.test.ts`<br>`core-server/src/modules/demo/__tests__/host.test.ts` |
| 30 | the path undefined is not the pinned one either | 2 | 2 | server | `core-server/src/engine/__tests__/boot-checks-runner.test.ts`<br>`core-server/src/modules/demo/__tests__/host.test.ts` |
| 31 | the path "" is not the pinned one either | 2 | 2 | server | `core-server/src/engine/__tests__/boot-checks-runner.test.ts`<br>`core-server/src/modules/demo/__tests__/host.test.ts` |
| 32 | the path "public" is not the pinned one either | 2 | 2 | server | `core-server/src/engine/__tests__/boot-checks-runner.test.ts`<br>`core-server/src/modules/demo/__tests__/host.test.ts` |
| 33 | the path "pg_catalog,public" is not the pinned one either | 2 | 2 | server | `core-server/src/engine/__tests__/boot-checks-runner.test.ts`<br>`core-server/src/modules/demo/__tests__/host.test.ts` |
| 34 | with B-2 passing the next one asked is B-3, then it stops there | 2 | 2 | server | `core-server/src/engine/__tests__/boot-checks-runner.test.ts`<br>`core-server/src/modules/demo/__tests__/host.test.ts` |
| 35 | a session in FINALIZING at the stop is in FAULT too | 2 | 2 | server | `core-server/src/engine/__tests__/rehydrate.test.ts`<br>`core-server/src/engine/__tests__/restart.db.test.ts` |
| 36 | sessions, evidence, tracks, custody and exports: the mix | 2 | 2 | server | `core-server/src/db/fixtures/__tests__/build.test.ts`<br>`core-server/src/db/fixtures/__tests__/bulk-fixture.db.test.ts` |
| 37 | --database without a name: usage | 2 | 2 | server | `core-server/src/db/reset/__tests__/cli.test.ts`<br>`core-server/src/db/seed/__tests__/cli.test.ts` |
| 38 | the database name postgres is refused before any connection, and is not echoed | 2 | 2 | server | `core-server/src/db/reset/__tests__/cli.test.ts`<br>`core-server/src/db/seed/__tests__/cli.test.ts` |
| 39 | the database name dems_demo_next is refused before any connection, and is not echoed | 2 | 2 | server | `core-server/src/db/reset/__tests__/cli.test.ts`<br>`core-server/src/db/seed/__tests__/cli.test.ts` |
| 40 | the database name dems_test_local_abc12345_f01_x is refused before any connection, and is not echoed | 2 | 2 | server | `core-server/src/db/reset/__tests__/cli.test.ts`<br>`core-server/src/db/seed/__tests__/cli.test.ts` |

Cross-workspace clusters by pair of workspaces (leaf, 30+ chars):

| workspaces | clusters | tests |
|---|---|---|
| core-web + mobile | 69 | 138 |
| core-web + shared | 2 | 4 |

#### (b) Bodies

Static `it` / `test` call sites: 13428; with a body of 80+ normalised characters: 13133.

| hash of | cluster size | clusters | blocks | clusters inside one file / blocks | clusters over 2+ files / blocks | characters that a merge would remove |
|---|---|---|---|---|---|---|
| body text, comments and whitespace normalised (identical) | 2+ | 25 | 71 | 1 / 2 | 24 / 69 | 9112 |
| body text, comments and whitespace normalised (identical) | 3+ | 6 | 33 | 0 / 0 | 6 / 33 | 5915 |
| body with string and number literals erased (same shape) | 2+ | 51 | 124 | 17 / 34 | 34 / 90 | 15276 |
| body with string and number literals erased (same shape) | 3+ | 7 | 36 | 0 / 0 | 7 / 36 | 6681 |

Same-shape clusters of 3+ by workspace:

| workspace | clusters inside one file | blocks | blocks removed if each cluster became one table-driven case | clusters over 2+ files | blocks |
|---|---|---|---|---|---|
| server | 0 | 0 | 0 | 4 | 21 |
| core-web | 0 | 0 | 0 | 1 | 5 |
| mobile | 0 | 0 | 0 | 2 | 10 |

Top 30 same-shape clusters over 2+ files (by blocks):

| # | blocks | files | body chars | first title | files (first 4, with line) |
|---|---|---|---|---|---|
| 1 | 11 | 11 | 264 | schema version 6, contract dbc-7 | `core-server/src/capture-session/__tests__/session-capture.db.test.ts:284`<br>`core-server/src/capture/fence/__tests__/development-session.db.test.ts:237`<br>`core-server/src/capture/fence/__tests__/fence.db.test.ts:101`<br>`core-server/src/db/mapping/__tests__/fault-key.db.test.ts:27` |
| 2 | 5 | 5 | 284 | MD-6, TS-15: no file loads the typed client or the Live source, builds a client, | `core-web/src/test/live-dashboard-page.test.tsx:221`<br>`core-web/src/test/live-evidence-archive.test.tsx:282`<br>`core-web/src/test/live-security-audit-page.test.tsx:350`<br>`core-web/src/test/live-storage-page.test.tsx:260` |
| 3 | 7 | 7 | 181 | no production file calls the simulator's action hook | `mobile/src/features/audit/audit-live-static.test.ts:75`<br>`mobile/src/features/dashboard/home-more-live-static.test.ts:85`<br>`mobile/src/features/devices/devices-live-static.test.ts:86`<br>`mobile/src/features/session-recovery/recovery-live-static.test.ts:68` |
| 4 | 3 | 2 | 383 | ?%s answers 422 INVALID_INPUT with details.in querystring, before any read | `core-server/src/modules/evidence/__tests__/routes.test.ts:313`<br>`core-server/src/modules/security-audit/__tests__/routes.test.ts:300` |
| 5 | 3 | 3 | 191 | (s) => ({
      session: { ...s.session!, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, s | `mobile/src/features/dashboard/wave-i-c-seal-blocked-home.test.tsx:57`<br>`mobile/src/features/sessions/wave-i-c-seal-blocked-hub.test.tsx:27`<br>`mobile/src/navigation/wave-i-c-new-session-blocked.test.tsx:35` |
| 6 | 4 | 4 | 123 | no slot of the scaffold is provided or replaced, and no test file is imported | `core-server/src/modules/alerts/__tests__/static.test.ts:123`<br>`core-server/src/modules/network-time/__tests__/static.test.ts:95`<br>`core-server/src/modules/storage/__tests__/static.test.ts:113`<br>`core-server/src/modules/system/__tests__/static.test.ts:144` |
| 7 | 3 | 3 | 151 | no console call, no raw URL, no header, no environment, no listener | `core-server/src/modules/evidence/__tests__/static.test.ts:240`<br>`core-server/src/modules/identity/__tests__/static.test.ts:155`<br>`core-server/src/modules/security-audit/__tests__/static.test.ts:282` |

Top 20 same-shape clusters inside ONE file (candidates for one table-driven case):

| # | blocks | body chars | file:first line | first title |
|---|---|---|---|---|

Identical bodies (not only same shape) found in 2+ different files: 24 clusters, 69 blocks. All of them:

| # | blocks | body chars | title | files |
|---|---|---|---|---|
| 1 | 11 | 264 | schema version 6, contract dbc-7 | `core-server/src/capture-session/__tests__/session-capture.db.test.ts:284`<br>`core-server/src/capture/fence/__tests__/development-session.db.test.ts:237`<br>`core-server/src/capture/fence/__tests__/fence.db.test.ts:101`<br>`core-server/src/db/mapping/__tests__/fault-key.db.test.ts:27`<br>`core-server/src/engine/__tests__/fact-doors.db.test.ts:27` |
| 2 | 5 | 284 | MD-6, TS-15: no file loads the typed client or the Live source, builds | `core-web/src/test/live-dashboard-page.test.tsx:221`<br>`core-web/src/test/live-evidence-archive.test.tsx:282`<br>`core-web/src/test/live-security-audit-page.test.tsx:350`<br>`core-web/src/test/live-storage-page.test.tsx:260`<br>`core-web/src/test/live-system-settings.test.tsx:289` |
| 3 | 7 | 181 | no production file calls the simulator's action hook | `mobile/src/features/audit/audit-live-static.test.ts:75`<br>`mobile/src/features/dashboard/home-more-live-static.test.ts:85`<br>`mobile/src/features/devices/devices-live-static.test.ts:86`<br>`mobile/src/features/session-recovery/recovery-live-static.test.ts:68`<br>`mobile/src/features/session-summary/summary-live-static.test.ts:104` |
| 4 | 2 | 351 | is the runtime role on schema version 6 / dbc-7, and this row brought  | `core-server/src/sealing/__tests__/last-resort.db.test.ts:132`<br>`core-server/src/sealing/__tests__/stt-states.db.test.ts:112` |
| 5 | 3 | 191 | (s) => ({
      session: { ...s.session!, id: SEAL_BLOCKED_EXAMPLE_SES | `mobile/src/features/dashboard/wave-i-c-seal-blocked-home.test.tsx:57`<br>`mobile/src/features/sessions/wave-i-c-seal-blocked-hub.test.tsx:27`<br>`mobile/src/navigation/wave-i-c-new-session-blocked.test.tsx:35` |
| 6 | 2 | 264 | is at the schema version of the code: [6, 'dbc-7'] | `core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts:167`<br>`core-server/src/modules/capture-discovery/__tests__/session-expiry.db.test.ts:99` |
| 7 | 2 | 257 | the chain of this database verifies over all rows | `core-server/src/core/__tests__/connection-lost.db.test.ts:207`<br>`core-server/src/core/__tests__/search-path.db.test.ts:139` |
| 8 | 2 | 255 | is at schema version 4 / dbc-5 (sets 4 and 5), and this row brought no | `core-server/src/modules/transcript-chunks/__tests__/transcript-chunks.db.test.ts:64`<br>`core-server/src/modules/transcripts/__tests__/transcripts.db.test.ts:164` |
| 9 | 4 | 123 | no slot of the scaffold is provided or replaced, and no test file is i | `core-server/src/modules/alerts/__tests__/static.test.ts:123`<br>`core-server/src/modules/network-time/__tests__/static.test.ts:95`<br>`core-server/src/modules/storage/__tests__/static.test.ts:113`<br>`core-server/src/modules/system/__tests__/static.test.ts:144` |
| 10 | 2 | 243 | uses erasable syntax only: no enum, no namespace, no parameter propert | `shared/test/live-light-platform-neutral.test.ts:141`<br>`shared/test/live-source-platform-neutral.test.ts:178` |
| 11 | 2 | 229 | no file imports a module of the runtime, names the process or the netw | `core-server/src/modules/alerts/__tests__/static.test.ts:44`<br>`core-server/src/modules/system/__tests__/static.test.ts:45` |
| 12 | 3 | 151 | no console call, no raw URL, no header, no environment, no listener | `core-server/src/modules/evidence/__tests__/static.test.ts:240`<br>`core-server/src/modules/identity/__tests__/static.test.ts:155`<br>`core-server/src/modules/security-audit/__tests__/static.test.ts:282` |
| 13 | 2 | 199 | the pools of this file are the runtime role and the owner, never the a | `core-server/src/modules/transcripts/__tests__/transcripts.db.test.ts:169`<br>`core-server/src/sealing/__tests__/finalize-transcript.db.test.ts:151` |
| 14 | 2 | 172 | no file reads the system time, sets a timer or reads a clock at all | `core-server/src/modules/alerts/__tests__/static.test.ts:38`<br>`core-server/src/modules/system/__tests__/static.test.ts:39` |
| 15 | 2 | 168 | no console, no random source, no log line of its own | `core-server/src/modules/network-time/__tests__/static.test.ts:56`<br>`core-server/src/modules/storage/__tests__/static.test.ts:62` |
| 16 | 2 | 155 | no simulator action, no hosted command, no engine state: the code of t | `core-server/src/modules/identity/biometric/__tests__/static.test.ts:179`<br>`core-server/src/modules/pairing/__tests__/static.test.ts:140` |
| 17 | 2 | 148 | no file reads the system time, sets a timer or draws a random number | `core-server/src/modules/evidence/__tests__/static.test.ts:234`<br>`core-server/src/modules/security-audit/__tests__/static.test.ts:276` |
| 18 | 2 | 115 | the folder does not read the system time and sets no timer | `core-server/src/modules/network-time/__tests__/static.test.ts:36`<br>`core-server/src/modules/storage/__tests__/static.test.ts:33` |
| 19 | 2 | 112 | it holds no statement text that changes a row and uses no insert, upda | `core-server/src/modules/evidence/__tests__/static.test.ts:205`<br>`core-server/src/modules/security-audit/__tests__/static.test.ts:214` |
| 20 | 2 | 102 | Live, link %s: unknown, whatever the store holds | `mobile/src/features/capture-selector/wave-h-sources-known-gate.test.tsx:45`<br>`mobile/src/features/capture-selector/wave-i-c-sources-stale.test.tsx:73` |
| 21 | 2 | 94 | AC-C-02: no file names node:, react-native, expo, window or document ( | `shared/test/live-light-platform-neutral.test.ts:112`<br>`shared/test/live-testing-platform-neutral.test.ts:84` |
| 22 | 2 | 87 | no stage and no seam is provided or replaced, and nothing is imported  | `core-server/src/modules/demo/__tests__/static.test.ts:313`<br>`core-server/src/modules/devices/__tests__/static.test.ts:214` |
| 23 | 2 | 85 | an error's own message is never read | `core-server/src/modules/evidence/__tests__/static.test.ts:299`<br>`core-server/src/modules/security-audit/__tests__/static.test.ts:345` |
| 24 | 2 | 81 | writes nothing to the console, reads no environment and never listens | `core-server/src/modules/sessions/__tests__/static.test.ts:184`<br>`core-server/src/plugins/permission-guard/__tests__/static.test.ts:108` |

#### (c) Per-wave file -> home file

Family files: 165. With a home found by a shared product import (same workspace): 149. Without one: 16 (of which 10 import no product module at all: they read sources as text or go through a package entry).

| workspace | family files | tests | home found | home in the same folder | no home |
|---|---|---|---|---|---|
| shared | 19 | 154 | 19 | 19 | 0 |
| server-unit | 41 | 343 | 36 | 34 | 5 |
| server-db | 16 | 44 | 14 | 11 | 2 |
| core-web | 30 | 299 | 27 | 25 | 3 |
| mobile | 57 | 472 | 51 | 50 | 6 |
| transcriber | 2 | 25 | 2 | 2 | 0 |

All pairs (the module named is the most specific product module both files import; "n" = test files in the workspace that import it):

**shared**

| family file | tests | -> home file | home tests | shared product module (n) |
|---|---|---|---|---|
| `shared/test/api-wave-h-z1-demo-fault-strict.test.ts` | 6 | `shared/test/api-capture-discovery.test.ts` | 18 | `api/index.ts` (57) |
| `shared/test/api-wave-k-z1-seek-index.test.ts` | 5 | `shared/test/api-capture-discovery.test.ts` | 18 | `api/index.ts` (57) |
| `shared/test/fxr-w-nits.test.ts` | 3 | `shared/test/session-schema.test.ts` | 7 | `i18n/index.ts` (8) |
| `shared/test/integration-c1.test.ts` | 9 | `shared/test/api-capture-discovery.test.ts` | 18 | `api/index.ts` (57) |
| `shared/test/integration-d1b.test.ts` | 25 | `shared/test/api-capture-discovery.test.ts` | 18 | `api/index.ts` (57) |
| `shared/test/sim-m5-review.test.ts` | 8 | `shared/test/api-capture-discovery.test.ts` | 18 | `sim/index.ts` (80) |
| `shared/test/sim-pass-hy-host-clock-derive.test.ts` | 4 | `shared/test/api-capture-discovery.test.ts` | 18 | `sim/index.ts` (80) |
| `shared/test/sim-pass-j.test.ts` | 12 | `shared/test/session-schema.test.ts` | 7 | `i18n/index.ts` (8) |
| `shared/test/sim-wave-h-a-generator.test.ts` | 5 | `shared/test/api-capture-discovery.test.ts` | 18 | `sim/index.ts` (80) |
| `shared/test/sim-wave-h-a-seal-steps.test.ts` | 2 | `shared/test/api-capture-discovery.test.ts` | 18 | `sim/index.ts` (80) |
| `shared/test/sim-wave-h-b-session.test.ts` | 15 | `shared/test/session-custody-actor.test.ts` | 8 | `i18n/index.ts` (8) |
| `shared/test/sim-wave-h-z1-connect-hold.test.ts` | 4 | `shared/test/api-capture-discovery.test.ts` | 18 | `sim/index.ts` (80) |
| `shared/test/sim-wave-h-z1-time.test.ts` | 8 | `shared/test/api-capture-discovery.test.ts` | 18 | `sim/index.ts` (80) |
| `shared/test/sim-wave-i-a1-seal-blocked.test.ts` | 5 | `shared/test/api-capture-discovery.test.ts` | 18 | `api/index.ts` (57) |
| `shared/test/sim-wave-i-a2-sending-device.test.ts` | 7 | `shared/test/api-capture-discovery.test.ts` | 18 | `api/index.ts` (57) |
| `shared/test/sim-wave-k-s1-timeline-fault.test.ts` | 4 | `shared/test/api-capture-discovery.test.ts` | 18 | `sim/index.ts` (80) |
| `shared/test/sim-wave-k-s2-sending-device.test.ts` | 7 | `shared/test/api-capture-discovery.test.ts` | 18 | `sim/index.ts` (80) |
| `shared/test/sim-wave-l-s-unsealable-notice.test.ts` | 9 | `shared/test/api-capture-discovery.test.ts` | 18 | `sim/index.ts` (80) |
| `shared/test/sim-wave-l-z-selector-in-force.test.ts` | 16 | `shared/test/audio.test.ts` | 14 | `domain/index.ts` (2) |

**server-unit**

| family file | tests | -> home file | home tests | shared product module (n) |
|---|---|---|---|---|
| `core-server/src/capture-session/__tests__/wave-h-a-facts-removal.test.ts` | 5 | `core-server/src/capture-session/__tests__/facts-fy.test.ts` | 5 | `capture-session/facts.ts` (3) |
| `core-server/src/capture/__tests__/review-m3.test.ts` | 28 | `core-server/src/capture/__tests__/fault-lifecycle.test.ts` | 16 | `capture/index.ts` (32) |
| `core-server/src/capture/__tests__/wave-h-f.test.ts` | 26 | `core-server/src/capture/__tests__/fault-lifecycle.test.ts` | 16 | `capture/index.ts` (32) |
| `core-server/src/capture/boot/__tests__/wave-h-f-boot.test.ts` | 10 | `core-server/src/capture/boot/__tests__/boot.test.ts` | 8 | `boot/index.ts` (4) |
| `core-server/src/capture/fence/__tests__/wave-h-z1-speech-fixture-format.test.ts` | 18 | `core-server/src/capture/fence/__tests__/fake-mic.test.ts` | 14 | `local/index.ts` (8) |
| `core-server/src/capture/fence/__tests__/wave-i-a2-admit.test.ts` | 4 | `core-server/src/capture/fence/__tests__/fence.test.ts` | 48 | `capture/types.ts` (7) |
| `core-server/src/db/reset/__tests__/wave-i-a1-unsealed-fake.test.ts` | 10 | `core-server/src/db/reset/__tests__/package-removal.test.ts` | 12 | `reset/package-removal.ts` (2) |
| `core-server/src/engine/__tests__/pass-j-core-not-running.test.ts` | 4 | `core-server/src/engine/__tests__/rehydrate.test.ts` | 27 | `engine/rehydrate.ts` (5) |
| `core-server/src/engine/__tests__/wave-h-z1-connect-hold.test.ts` | 2 | `core-server/src/engine/__tests__/clock-floor.test.ts` | 31 | `engine/headless-sim.ts` (6) |
| `core-server/src/engine/__tests__/wave-i-a2-graceful-restart.test.ts` | 4 | `core-server/src/engine/__tests__/rehydrate.test.ts` | 27 | `engine/rehydrate.ts` (5) |
| `core-server/src/engine/__tests__/wave-k-s1-restart-fault.test.ts` | 7 | `core-server/src/engine/__tests__/rehydrate.test.ts` | 27 | `engine/rehydrate.ts` (5) |
| `core-server/src/evidence-export/__tests__/wave-h-c1.test.ts` | 5 | `core-server/src/evidence-export/__tests__/jobs.test.ts` | 15 | `evidence-export/jobs.ts` (2) |
| `core-server/src/evidence-facts/__tests__/wave-h-r-interrupted-agreement.test.ts` | 3 | (none by import) | | |
| `core-server/src/evidence-facts/__tests__/wave-k-s2-transcript-model.test.ts` | 6 | `core-server/src/evidence-verify/__tests__/core-verification.test.ts` | 8 | `evidence-verify/index.ts` (37) |
| `core-server/src/evidence-facts/__tests__/wave-l-s-sealed-profile.test.ts` | 5 | `core-server/src/modules/evidence/__tests__/detail-facts.db.test.ts` | 9 | `evidence-facts/index.ts` (3) |
| `core-server/src/evidence-verify/__tests__/fix-m7-verify.test.ts` | 9 | `core-server/src/evidence-verify/__tests__/development-key.test.ts` | 4 | `evidence-verify/index.ts` (37) |
| `core-server/src/evidence-verify/__tests__/fix-m7b-export-notice.test.ts` | 4 | `core-server/src/evidence-verify/__tests__/core-verification.test.ts` | 8 | `evidence-verify/index.ts` (37) |
| `core-server/src/evidence-verify/__tests__/fix-m7c-revision-pending.test.ts` | 7 | `core-server/src/evidence-verify/__tests__/core-verification.test.ts` | 8 | `evidence-verify/index.ts` (37) |
| `core-server/src/evidence-verify/__tests__/wave-k-kr-plain-checked.test.ts` | 3 | `core-server/src/evidence-verify/__tests__/core-verification.test.ts` | 8 | `evidence-verify/index.ts` (37) |
| `core-server/src/media-stream/__tests__/wave-k-z1-seek-index.test.ts` | 30 | `core-server/src/media-stream/__tests__/one-camera.test.ts` | 1 | `media-stream/source.ts` (2) |
| `core-server/src/modules/capture-config/__tests__/wave-i-a2-refusal-reasons.test.ts` | 3 | `core-server/src/modules/capture-config/__tests__/routes.test.ts` | 13 | `capture-config/index.ts` (8) |
| `core-server/src/modules/capture-discovery/__tests__/wave-i-a2-search-ids.test.ts` | 5 | `core-server/src/modules/capture-discovery/__tests__/session-expiry.test.ts` | 5 | `capture-discovery/limits.ts` (2) |
| `core-server/src/modules/capture-discovery/__tests__/wave-l-s-open-session.test.ts` | 4 | (none by import) | | |
| `core-server/src/modules/demo/__tests__/wave-k-kr-reset-device.test.ts` | 2 | `core-server/src/modules/demo/__tests__/host.test.ts` | 12 | `demo/index.ts` (8) |
| `core-server/src/modules/evidence/__tests__/wave-k-s2-export-default.test.ts` | 4 | `core-server/src/modules/evidence/__tests__/export-request.test.ts` | 36 | `evidence/export-request.ts` (3) |
| `core-server/src/modules/media-stream/__tests__/wave-k-z1-indexed-view.test.ts` | 26 | (none by import) | | |
| `core-server/src/modules/media-stream/__tests__/wave-l-s-cut-socket.test.ts` | 3 | (none by import) | | |
| `core-server/src/modules/transcripts/__tests__/wave-k-s2-from-current.test.ts` | 4 | `core-server/src/modules/transcripts/__tests__/revision-reconcile.test.ts` | 8 | `transcripts/routes.ts` (2) |
| `core-server/src/sealing-host/__tests__/fix-151-declared-profile.test.ts` | 14 | `core-server/src/sealing-host/__tests__/sealing-host.test.ts` | 13 | `sealing-host/session-reader.ts` (10) |
| `core-server/src/sealing-host/__tests__/wave-h-a-camera-end.test.ts` | 4 | `core-server/src/sealing-host/__tests__/sealing-host.test.ts` | 13 | `sealing-host/session-reader.ts` (10) |
| `core-server/src/sealing-host/__tests__/wave-h-a-manifest-facts.test.ts` | 5 | `core-server/src/sealing-host/__tests__/sealing-host.test.ts` | 13 | `src/version.ts` (4) |
| `core-server/src/sealing-host/__tests__/wave-h-a-session-key-no-reuse.test.ts` | 5 | `core-server/src/sealing-host/__tests__/demo-seed-hook.test.ts` | 4 | `credential-store/key-material.ts` (5) |
| `core-server/src/sealing-host/__tests__/wave-h-z1-installation-identity.test.ts` | 19 | `core-server/src/sealing-host/__tests__/sealing-host.test.ts` | 13 | `sealing-host/session-reader.ts` (10) |
| `core-server/src/sealing-host/__tests__/wave-i-a1-progress.test.ts` | 4 | `core-server/src/sealing-host/__tests__/progress.test.ts` | 6 | `sealing-host/progress.ts` (2) |
| `core-server/src/sealing-host/__tests__/wave-i-a1-session-key.test.ts` | 9 | `core-server/src/sealing-host/__tests__/sealing-host.test.ts` | 13 | `sealing-host/session-key.ts` (5) |
| `core-server/src/sealing-host/__tests__/wave-k-s1-seal-rig.test.ts` | 13 | `core-server/src/sealing-host/__tests__/sealing-host.test.ts` | 13 | `sealing-host/index.ts` (7) |
| `core-server/src/sealing-host/__tests__/wave-k-s1-stream-profile.test.ts` | 12 | `core-server/src/sealing-host/__tests__/sealing-host.test.ts` | 13 | `sealing-host/session-reader.ts` (10) |
| `core-server/src/sealing/__tests__/wave-i-a1-way-out.test.ts` | 7 | `core-server/src/sealing/__tests__/finalize-transcript.test.ts` | 30 | `sealing/index.ts` (39) |
| `core-server/src/sealing/__tests__/wave-k-s1-transcript-eta.test.ts` | 1 | (none by import) | | |
| `core-server/src/sealing/__tests__/wave-l-s-retry-sentence.test.ts` | 3 | `core-server/src/sealing/__tests__/finalize-transcript.test.ts` | 30 | `sealing/index.ts` (39) |
| `core-server/src/sealing/__tests__/wave-l-z-blocked-sentence.test.ts` | 6 | `core-server/src/sealing/__tests__/finalize-transcript.test.ts` | 30 | `sealing/index.ts` (39) |

**server-db**

| family file | tests | -> home file | home tests | shared product module (n) |
|---|---|---|---|---|
| `core-server/src/capture/__tests__/wave-h-f-boot-clear.db.test.ts` | 1 | `core-server/src/capture/__tests__/boot.db.test.ts` | 3 | `src/app.ts` (77) |
| `core-server/src/db/reset/__tests__/wave-i-a1-reset-lane.db.test.ts` | 3 | `core-server/src/db/reset/__tests__/cli.db.test.ts` | 5 | `reset/cli.ts` (6) |
| `core-server/src/db/reset/__tests__/wave-i-a1-unsealed-fake.db.test.ts` | 3 | `core-server/src/db/reset/__tests__/m4-sec-reset.db.test.ts` | 16 | `reset/real-evidence.ts` (10) |
| `core-server/src/engine/__tests__/pass-j-restart-recording.db.test.ts` | 2 | `core-server/src/engine/__tests__/api-headers.outcome.db.test.ts` | 1 | `engine/index.ts` (45) |
| `core-server/src/engine/__tests__/wave-h-a-no-invented-rows.db.test.ts` | 2 | `core-server/src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | 3 | `sealing-host/session-reader.ts` (10) |
| `core-server/src/engine/__tests__/wave-i-a2-graceful-restart.db.test.ts` | 2 | `core-server/src/engine/__tests__/api-headers.outcome.db.test.ts` | 1 | `engine/index.ts` (45) |
| `core-server/src/engine/__tests__/wave-k-s1-restart-fault.db.test.ts` | 1 | `core-server/src/engine/__tests__/sealing-notice-doors.db.test.ts` | 1 | `engine/sealing-notice-doors.ts` (7) |
| `core-server/src/modules/alerts/__tests__/wave-l-s-unsealable-ack.db.test.ts` | 1 | `core-server/src/engine/__tests__/unsealable-doors.db.test.ts` | 1 | `engine/unsealable-doors.ts` (2) |
| `core-server/src/modules/capture-config/__tests__/integration-c1.db.test.ts` | 5 | `core-server/src/modules/capture-config/__tests__/capture-config.db.test.ts` | 10 | `capture-config/index.ts` (8) |
| `core-server/src/modules/capture-config/__tests__/integration-d1b.db.test.ts` | 4 | `core-server/src/capture/fence/__tests__/fence.db.test.ts` | 16 | `src/config.ts` (28) |
| `core-server/src/modules/capture-discovery/__tests__/wave-i-a2-adopt-assign.db.test.ts` | 4 | `core-server/src/modules/capture-discovery/__tests__/lane-camera-stub.db.test.ts` | 2 | `fence/index.ts` (31) |
| `core-server/src/modules/capture-discovery/__tests__/wave-i-a2-search-ids.db.test.ts` | 1 | `core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts` | 16 | `capture-discovery/index.ts` (10) |
| `core-server/src/modules/evidence/__tests__/wave-h-r-seed-sealed.db.test.ts` | 5 | `core-server/src/modules/evidence/__tests__/detail-facts.db.test.ts` | 9 | `evidence-facts/index.ts` (3) |
| `core-server/src/modules/evidence/__tests__/wave-k-s2-sending-device.db.test.ts` | 3 | (none by import) | | |
| `core-server/src/modules/sessions/__tests__/wave-i-a2-sending-device.db.test.ts` | 2 | (none by import) | | |
| `core-server/test/db/integration-d4.db.test.ts` | 5 | `core-server/test/db/device-upsert.db.test.ts` | 5 | `store/index.ts` (7) |

**core-web**

| family file | tests | -> home file | home tests | shared product module (n) |
|---|---|---|---|---|
| `core-web/src/features/dashboard/__tests__/wave-h-z2-failed-start-event.test.tsx` | 2 | `core-web/src/features/dashboard/__tests__/dashboard-model.test.tsx` | 15 | `dashboard/dashboard-model.ts` (2) |
| `core-web/src/features/devices/__tests__/copy-round-health-caption.test.tsx` | 3 | `core-web/src/features/devices/__tests__/selector-microphones.test.tsx` | 9 | `lib/core-errors.ts` (60) |
| `core-web/src/features/devices/__tests__/devices-gate70-minors.test.tsx` | 2 | `core-web/src/features/devices/__tests__/camera-no-preview.test.tsx` | 8 | `lib/core-errors.ts` (60) |
| `core-web/src/features/devices/__tests__/wave-h-z2-audio-card-lines.test.tsx` | 3 | `core-web/src/features/devices/__tests__/selector-microphones.test.tsx` | 9 | `lib/core-errors.ts` (60) |
| `core-web/src/features/devices/__tests__/wave-i-b-connect-wording.test.tsx` | 7 | `core-web/src/features/devices/__tests__/camera-connect.test.tsx` | 11 | `devices/camera-connect.ts` (3) |
| `core-web/src/features/devices/__tests__/wave-i-b-source-state.test.tsx` | 11 | `core-web/src/features/devices/__tests__/camera-connect.test.tsx` | 11 | `src/i18n-web.ts` (15) |
| `core-web/src/features/evidence/__tests__/copy-round-metadata-media.test.tsx` | 3 | `core-web/src/features/evidence/__tests__/efix-integrity-metadata.test.tsx` | 12 | `evidence/metadata-tab.tsx` (3) |
| `core-web/src/features/evidence/__tests__/wave-h-c2-export-playback.test.tsx` | 8 | (none by import) | | |
| `core-web/src/features/evidence/__tests__/wave-h-c2-integrity.test.tsx` | 6 | `core-web/src/features/evidence/__tests__/cf-web-custody-media.test.tsx` | 7 | `src/i18n.ts` (107) |
| `core-web/src/features/evidence/__tests__/wave-h-c2-media.test.tsx` | 21 | `core-web/src/features/evidence/__tests__/cf-web-custody-media.test.tsx` | 7 | `evidence/model.ts` (10) |
| `core-web/src/features/evidence/__tests__/wave-h-c2-transcript.test.tsx` | 7 | `core-web/src/features/evidence/__tests__/export-job.test.tsx` | 22 | `runtime/index.ts` (59) |
| `core-web/src/features/evidence/__tests__/wave-k-w-evidence.test.tsx` | 12 | `core-web/src/features/evidence/__tests__/verify-v2-signing-key.test.tsx` | 9 | `evidence/verify-v2-report.tsx` (2) |
| `core-web/src/features/evidence/__tests__/wave-k-w-player.test.tsx` | 29 | `core-web/src/features/evidence/__tests__/sealed-playback.test.tsx` | 10 | `evidence/sealed-playback.ts` (2) |
| `core-web/src/features/evidence/__tests__/wave-k-z2-export.test.tsx` | 4 | (none by import) | | |
| `core-web/src/features/security-audit/__tests__/copy-round-reason-note.test.ts` | 2 | `core-web/src/features/security-audit/__tests__/security-audit.test.tsx` | 18 | `security-audit/sim-adapter.ts` (3) |
| `core-web/src/features/session-monitor/__tests__/wave-h-z2-own-capture.test.tsx` | 10 | `core-web/src/features/session-monitor/__tests__/audio-source.test.tsx` | 21 | `src/router.tsx` (60) |
| `core-web/src/features/session-monitor/__tests__/wave-i-b-seal-blocked.test.tsx` | 12 | `core-web/src/features/session-monitor/__tests__/situation-c.test.tsx` | 12 | `src/i18n-web.ts` (15) |
| `core-web/src/features/session-new/__tests__/copy-round-live-words.test.tsx` | 8 | `core-web/src/features/session-new/__tests__/precheck-unreachable.test.tsx` | 2 | `session-new/devices-step.tsx` (4) |
| `core-web/src/features/session-new/__tests__/wave-h-z2-countdown-sources.test.tsx` | 3 | `core-web/src/features/session-new/__tests__/precheck-unreachable.test.tsx` | 2 | `session-new/model.ts` (9) |
| `core-web/src/features/session-new/__tests__/wave-h-z2-precheck-note.test.tsx` | 3 | `core-web/src/features/session-new/__tests__/precheck-unreachable.test.tsx` | 2 | `session-new/devices-step.tsx` (4) |
| `core-web/src/test/fxr-w-dev-console-logging.test.tsx` | 5 | `core-web/src/test/live-api-reference-page.test.tsx` | 7 | `runtime/index.ts` (59) |
| `core-web/src/test/fxr-w-nits.test.tsx` | 2 | (none by import) | | |
| `core-web/src/test/live-fxr-w-evidence-media-signout.test.tsx` | 2 | `core-web/src/test/live-cf-web-media.test.tsx` | 2 | `runtime/index.ts` (59) |
| `core-web/src/test/live-row87-verify-v2.test.tsx` | 2 | `core-web/src/test/live-cf-web-media.test.tsx` | 2 | `runtime/index.ts` (59) |
| `core-web/src/test/pass-j.test.tsx` | 17 | `core-web/src/test/live-storage-policy.test.tsx` | 12 | `motion/index.ts` (25) |
| `core-web/src/test/wave-i-b-header-critical.test.ts` | 7 | `core-web/src/test/integrity-checks.test.ts` | 7 | `shell/integrity-checks.ts` (4) |
| `core-web/src/test/wave-i-b-own-core-facts.test.tsx` | 14 | `core-web/src/test/live-storage-policy.test.tsx` | 12 | `motion/index.ts` (25) |
| `core-web/src/test/wave-k-w-real-core.test.tsx` | 26 | `core-web/src/features/security-audit/__tests__/security-audit.test.tsx` | 18 | `security-audit/sim-adapter.ts` (3) |
| `core-web/src/test/wave-l-w-real-core.test.tsx` | 44 | `core-web/src/test/live-dashboard-page.test.tsx` | 11 | `dashboard/sim-adapter.ts` (2) |
| `core-web/src/test/wave-l-z-selector-in-force.test.tsx` | 24 | `core-web/src/features/devices/__tests__/camera-no-preview.test.tsx` | 8 | `devices/source-class.ts` (3) |

**mobile**

| family file | tests | -> home file | home tests | shared product module (n) |
|---|---|---|---|---|
| `mobile/src/components/composed/wave-k-z1-stepper-badge.test.tsx` | 4 | `mobile/src/components/composed/stepper-rest-values.test.tsx` | 5 | `composed/stepper.math.ts` (3) |
| `mobile/src/features/capture-selector/wave-h-mic-lines.test.tsx` | 23 | `mobile/src/features/capture-selector/camera-clock-card.test.tsx` | 2 | `i18n/index.ts` (135) |
| `mobile/src/features/capture-selector/wave-h-no-preview-home.test.tsx` | 2 | `mobile/src/features/capture-selector/source-on-home.test.tsx` | 1 | `dashboard/dashboard-screen.tsx` (15) |
| `mobile/src/features/capture-selector/wave-h-no-preview-session-live.test.tsx` | 4 | (none by import) | | |
| `mobile/src/features/capture-selector/wave-h-no-preview-session-new.test.tsx` | 4 | (none by import) | | |
| `mobile/src/features/capture-selector/wave-h-sources-known-gate.test.tsx` | 18 | `mobile/src/features/capture-selector/local-source-notice-model.test.ts` | 7 | `capture-selector/local-source-notice-model.ts` (4) |
| `mobile/src/features/capture-selector/wave-h-sources-known.test.tsx` | 9 | (none by import) | | |
| `mobile/src/features/capture-selector/wave-i-c-row-labels.test.tsx` | 9 | `mobile/src/features/capture-selector/camera-clock-card.test.tsx` | 2 | `i18n/index.ts` (135) |
| `mobile/src/features/capture-selector/wave-i-c-source-state.test.ts` | 8 | (none by import) | | |
| `mobile/src/features/capture-selector/wave-i-c-sources-stale.test.tsx` | 17 | `mobile/src/features/capture-selector/local-source-notice-model.test.ts` | 7 | `capture-selector/local-source-notice-model.ts` (4) |
| `mobile/src/features/capture-selector/wave-k-m2-phone-discovery.test.tsx` | 3 | `mobile/src/features/capture-selector/camera-clock-card.test.tsx` | 2 | `i18n/index.ts` (135) |
| `mobile/src/features/capture-selector/wave-l-m-selector-in-force.test.ts` | 11 | `mobile/src/features/capture-selector/development-source-rule.test.tsx` | 6 | `capture-selector/development-source-badge.tsx` (4) |
| `mobile/src/features/capture-selector/wave-l-m-source-sheet.test.tsx` | 10 | `mobile/src/features/capture-selector/mic-limit-option.test.tsx` | 3 | `capture-selector/capture-source-sheet.tsx` (2) |
| `mobile/src/features/dashboard/pass-j-home.test.tsx` | 7 | `mobile/src/features/dashboard/home-live.test.tsx` | 9 | `dashboard/home-model.ts` (6) |
| `mobile/src/features/dashboard/wave-i-c-home-real-capture.test.tsx` | 11 | `mobile/src/features/dashboard/home-live.test.tsx` | 9 | `media/brand-assets.ts` (6) |
| `mobile/src/features/dashboard/wave-i-c-seal-blocked-home.test.tsx` | 4 | `mobile/src/features/dashboard/dashboard-screen.test.tsx` | 14 | `dashboard/dashboard-screen.tsx` (15) |
| `mobile/src/features/dashboard/wave-k-m2-connecting-home.test.tsx` | 5 | `mobile/src/features/dashboard/home-live.test.tsx` | 9 | `dashboard/home-model.ts` (6) |
| `mobile/src/features/dashboard/wave-k-z1-status-card-layout.test.tsx` | 8 | `mobile/src/features/dashboard/dashboard-screen.test.tsx` | 14 | `dashboard/dashboard-screen.tsx` (15) |
| `mobile/src/features/dashboard/wave-l-m-home-notice-tiles.test.tsx` | 16 | `mobile/src/features/dashboard/home-live.test.tsx` | 9 | `dashboard/home-model.ts` (6) |
| `mobile/src/features/devices/wave-h-busy-settled.test.tsx` | 4 | `mobile/src/features/devices/device-row-deselect-drawn.test.tsx` | 1 | `i18n/index.ts` (135) |
| `mobile/src/features/devices/wave-h-no-preview.test.tsx` | 16 | `mobile/src/features/devices/device-row-deselect-drawn.test.tsx` | 1 | `i18n/index.ts` (135) |
| `mobile/src/features/devices/wave-l-z-one-rule.test.tsx` | 29 | `mobile/src/features/devices/devices-model.test.ts` | 9 | `devices/devices-model.ts` (2) |
| `mobile/src/features/evidence/wave-h-c2-exports-playback.test.tsx` | 8 | `mobile/src/features/evidence/evidence-detail.test.tsx` | 9 | `evidence/export-sheet.tsx` (5) |
| `mobile/src/features/evidence/wave-h-c2-item-lines.test.tsx` | 18 | `mobile/src/features/evidence/evidence-detail.test.tsx` | 9 | `i18n/index.ts` (135) |
| `mobile/src/features/evidence/wave-h-c2-media.test.tsx` | 24 | `mobile/src/features/evidence/evidence-detail.test.tsx` | 9 | `i18n/index.ts` (135) |
| `mobile/src/features/evidence/wave-h-c2-transcript-access.test.tsx` | 7 | `mobile/src/features/evidence/transcript-states.test.tsx` | 6 | `evidence/transcript-pane.tsx` (3) |
| `mobile/src/features/evidence/wave-k-final-plain-checked.test.ts` | 6 | `mobile/src/features/evidence/verify-v2-signing-key.test.tsx` | 9 | `evidence/verify-v2.ts` (4) |
| `mobile/src/features/evidence/wave-k-m1-seek.test.tsx` | 17 | `mobile/src/features/evidence/media-session-canary.test.tsx` | 16 | `evidence/media-session.ts` (3) |
| `mobile/src/features/evidence/wave-k-m2-item-facts.test.tsx` | 14 | `mobile/src/features/evidence/transcript-states.test.tsx` | 6 | `evidence/transcript-pane.tsx` (3) |
| `mobile/src/features/evidence/wave-k-m2-operator-export.test.tsx` | 16 | `mobile/src/features/evidence/live-evidence-stored-verification.test.tsx` | 7 | `evidence/evidence-model.ts` (4) |
| `mobile/src/features/evidence/wave-k-m2-phone-layout.test.tsx` | 9 | `mobile/src/features/evidence/evidence-detail.test.tsx` | 9 | `i18n/index.ts` (135) |
| `mobile/src/features/evidence/wave-k-z1-player.test.tsx` | 15 | `mobile/src/features/evidence/media-session-canary.test.tsx` | 16 | `evidence/media-session.ts` (3) |
| `mobile/src/features/evidence/wave-l-m-player.test.tsx` | 10 | `mobile/src/features/evidence/sealed-playback.test.ts` | 6 | `evidence/sealed-playback.ts` (3) |
| `mobile/src/features/evidence/wave-l-m-sealed-format.test.tsx` | 6 | `mobile/src/features/evidence/evidence-detail.test.tsx` | 9 | `i18n/index.ts` (135) |
| `mobile/src/features/network-time/pass-j-host-clock.test.tsx` | 3 | `mobile/src/features/network-time/network-time-screen.test.tsx` | 6 | `network-time/network-time-model.ts` (4) |
| `mobile/src/features/session-finalizing/wave-i-c-seal-blocked.test.tsx` | 8 | `mobile/src/features/session-finalizing/session-finalizing-screen.test.tsx` | 8 | `motion/index.ts` (91) |
| `mobile/src/features/session-finalizing/wave-l-m-blocked-who-where.test.tsx` | 7 | `mobile/src/features/session-finalizing/session-finalizing-screen.test.tsx` | 8 | `motion/index.ts` (91) |
| `mobile/src/features/session-live/fix-157-audio-pair-in-force.test.tsx` | 2 | `mobile/src/features/session-live/mic-source.test.tsx` | 19 | `session-live/mic-source-model.ts` (4) |
| `mobile/src/features/session-live/wave-h-z2-mic-lines.test.tsx` | 2 | (none by import) | | |
| `mobile/src/features/session-live/wave-h-z2-own-capture.test.tsx` | 5 | `mobile/src/features/session-live/situation-c.test.tsx` | 11 | `session-live/session-live.math.ts` (7) |
| `mobile/src/features/session-live/wave-i-c-timeline-connecting.test.ts` | 3 | `mobile/src/features/session-live/live-session-live-link.test.tsx` | 14 | `session-live/session-live.math.ts` (7) |
| `mobile/src/features/session-live/wave-k-m2-clock-slot.test.tsx` | 9 | `mobile/src/features/session-live/connecting-meters.test.tsx` | 2 | `motion/index.ts` (91) |
| `mobile/src/features/session-new/live-session-new-followups.test.tsx` | 13 | `mobile/src/features/session-new/precheck.test.tsx` | 4 | `motion/index.ts` (91) |
| `mobile/src/features/session-new/wave-h-z2-countdown-sources.test.tsx` | 2 | (none by import) | | |
| `mobile/src/features/session-new/wave-h-z2-footer-labels.test.tsx` | 1 | `mobile/src/features/session-new/idle-control-state.test.tsx` | 1 | `motion/index.ts` (91) |
| `mobile/src/features/session-new/wave-h-z2-precheck-note.test.tsx` | 2 | `mobile/src/features/session-new/precheck-mic-roles.test.ts` | 6 | `session-new/session-new-model.ts` (5) |
| `mobile/src/features/session-new/wave-i-c-no-removed-spinner.test.tsx` | 5 | `mobile/src/features/session-new/precheck.test.tsx` | 4 | `motion/index.ts` (91) |
| `mobile/src/features/session-new/wave-l-m-live-checks.test.ts` | 3 | `mobile/src/features/session-new/precheck-mic-roles.test.ts` | 6 | `session-new/session-new-model.ts` (5) |
| `mobile/src/features/session-recovery/wave-l-m-core-sealing.test.ts` | 2 | `mobile/src/features/session-recovery/live-recovery-restart.test.tsx` | 5 | `session-recovery/recovery.model.ts` (5) |
| `mobile/src/features/session-summary/wave-h-c2-signature.test.tsx` | 4 | `mobile/src/features/session-summary/interrupted-seal.test.tsx` | 1 | `session-summary/stamp-once.ts` (8) |
| `mobile/src/features/session-summary/wave-h-z2-time-source.test.tsx` | 3 | `mobile/src/features/session-summary/session-summary-screen.test.tsx` | 9 | `session-summary/summary.model.ts` (4) |
| `mobile/src/features/session-summary/wave-k-m1-tablet-taps.test.tsx` | 4 | `mobile/src/features/session-summary/interrupted-seal.test.tsx` | 1 | `session-summary/stamp-once.ts` (8) |
| `mobile/src/features/sessions/wave-h-z2-row-no-preview.test.tsx` | 2 | `mobile/src/features/sessions/hub-pane-row-fit.test.tsx` | 4 | `i18n/index.ts` (135) |
| `mobile/src/features/sessions/wave-i-c-seal-blocked-hub.test.tsx` | 6 | `mobile/src/features/sessions/hub-pane-row-fit.test.tsx` | 4 | `i18n/index.ts` (135) |
| `mobile/src/features/settings/wave-k-m2-about-facts.test.tsx` | 2 | `mobile/src/features/settings/heartbeat-release-gate.test.tsx` | 5 | `motion/index.ts` (91) |
| `mobile/src/layout/wave-k-m1-pane-reduced.test.tsx` | 10 | `mobile/src/layout/layout.test.tsx` | 9 | `layout/index.ts` (7) |
| `mobile/src/navigation/wave-i-c-new-session-blocked.test.tsx` | 2 | `mobile/src/auth/live-auth-static.test.ts` | 11 | `i18n/index.ts` (135) |

**transcriber**

| family file | tests | -> home file | home tests | shared product module (n) |
|---|---|---|---|---|
| `transcriber/src/__tests__/row77-review-fixes.test.ts` | 20 | `transcriber/src/__tests__/checkpoint-runner.test.ts` | 50 | `pipeline/runner.ts` (3) |
| `transcriber/src/__tests__/row79-carried.test.ts` | 5 | `transcriber/src/__tests__/assembly.test.ts` | 26 | `pipeline/assembly.ts` (3) |

`live-` prefixed file next to a file of the same name without the prefix (same folder or same workspace):

| workspace | pairs | tests in the `live-` files | tests in the plain files |
|---|---|---|---|
| core-web | 6 | 91 | 70 |
| mobile | 6 | 65 | 101 |

#### (d) The same contract example / sentence asserted in several layers

Exported example constants of `packages/shared/src` (`export const *EXAMPLE*`): 61. Test files that reference each (by identifier), top 40:

| # | example | test files | shared | server | core-web | mobile | other |
|---|---|---|---|---|---|---|---|
| 1 | `CORE_API_EXAMPLES` | 46 | 19 | 7 | 8 | 12 | 0 |
| 2 | `SEAL_BLOCKED_EXAMPLE_ALERT` | 14 | 2 | 2 | 4 | 6 | 0 |
| 3 | `SEAL_BLOCKED_EXAMPLE_FINALIZATION` | 13 | 1 | 2 | 4 | 6 | 0 |
| 4 | `EXAMPLE_SOURCE_ROWS` | 11 | 5 | 6 | 0 | 0 | 0 |
| 5 | `SEAL_BLOCKED_EXAMPLE_SESSION_ID` | 11 | 1 | 1 | 3 | 6 | 0 |
| 6 | `SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE` | 9 | 1 | 1 | 6 | 1 | 0 |
| 7 | `REALTIME_SERVER_EXAMPLES` | 8 | 6 | 0 | 0 | 2 | 0 |
| 8 | `EXAMPLE_INSTANT_MS` | 6 | 6 | 0 | 0 | 0 | 0 |
| 9 | `EXAMPLE_EVIDENCE_ITEM` | 6 | 3 | 2 | 0 | 1 | 0 |
| 10 | `EXAMPLE_PLACEHOLDERS` | 5 | 5 | 0 | 0 | 0 | 0 |
| 11 | `CORE_NOT_RUNNING_FAULT_EXAMPLE` | 5 | 1 | 2 | 1 | 1 | 0 |
| 12 | `EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE` | 4 | 1 | 1 | 0 | 2 | 0 |
| 13 | `EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE` | 4 | 1 | 1 | 1 | 1 | 0 |
| 14 | `SEAL_RETRYING_EXAMPLE_FINALIZATION` | 4 | 1 | 1 | 1 | 1 | 0 |
| 15 | `SEAL_UNSEALABLE_EXAMPLE_SESSION_ID` | 4 | 1 | 0 | 1 | 2 | 0 |
| 16 | `SEAL_UNSEALABLE_EXAMPLE_ALERT` | 4 | 1 | 0 | 1 | 2 | 0 |
| 17 | `EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE` | 3 | 1 | 1 | 0 | 1 | 0 |
| 18 | `EVIDENCE_SEALED_PROFILE_EXAMPLE` | 3 | 0 | 1 | 1 | 1 | 0 |
| 19 | `EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE` | 3 | 0 | 1 | 1 | 1 | 0 |
| 20 | `EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE` | 3 | 0 | 1 | 1 | 1 | 0 |
| 21 | `EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE` | 3 | 0 | 1 | 1 | 1 | 0 |
| 22 | `VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE` | 3 | 0 | 1 | 1 | 1 | 0 |
| 23 | `EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE` | 3 | 0 | 1 | 1 | 1 | 0 |
| 24 | `OPENAPI_EXAMPLE_INSTANT` | 3 | 3 | 0 | 0 | 0 | 0 |
| 25 | `ADMINISTRATION_EXAMPLES` | 2 | 0 | 2 | 0 | 0 | 0 |
| 26 | `MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE` | 2 | 0 | 1 | 1 | 0 | 0 |
| 27 | `TRANSCRIPT_REVISION_REASON_EXAMPLE` | 2 | 0 | 1 | 1 | 0 | 0 |
| 28 | `EXAMPLE_IDS` | 2 | 2 | 0 | 0 | 0 | 0 |
| 29 | `REALTIME_CLIENT_EXAMPLES` | 2 | 2 | 0 | 0 | 0 | 0 |
| 30 | `START_REFUSED_SESSION_KEY_EXAMPLE` | 2 | 1 | 0 | 1 | 0 | 0 |
| 31 | `SEAL_UNSEALABLE_EXAMPLE_ALERT_RESOLVED` | 2 | 1 | 0 | 0 | 1 | 0 |
| 32 | `CAPTURE_CONNECTION_TESTED_SCHEME_REFUSAL_EXAMPLE` | 1 | 0 | 1 | 0 | 0 | 0 |
| 33 | `CAPTURE_DISCOVERY_EXAMPLES` | 1 | 0 | 0 | 1 | 0 | 0 |
| 34 | `EXAMPLE_REQUEST_ID` | 1 | 1 | 0 | 0 | 0 | 0 |
| 35 | `HEARTBEAT_EXAMPLE` | 1 | 1 | 0 | 0 | 0 | 0 |
| 36 | `NETWORK_TIME_EXAMPLES` | 1 | 0 | 1 | 0 | 0 | 0 |
| 37 | `REALTIME_EXAMPLE_EPOCH` | 1 | 1 | 0 | 0 | 0 | 0 |
| 38 | `STATE_EXAMPLE_SERIES_POINTS` | 1 | 1 | 0 | 0 | 0 | 0 |
| 39 | `STATE_EXAMPLE_IDS` | 1 | 1 | 0 | 0 | 0 | 0 |
| 40 | `EXAMPLE_SLICES` | 1 | 1 | 0 | 0 | 0 | 0 |

Examples referenced by no test file: `ALERT_EXAMPLES`, `DEMO_EXAMPLES`, `DEVICE_EXAMPLES`, `EVIDENCE_EXAMPLES`, `SERVER_EXAMPLE_IDS`, `ERROR_EXAMPLES`, `BASIC_403_EXAMPLES`, `EXAMPLE_SUPERVISOR`, `EXAMPLE_INVESTIGATOR`, `IDENTITY_EXAMPLES`, `PAIRING_EXAMPLES`, `SECURITY_AUDIT_EXAMPLES`, `SESSION_EXAMPLES`, `SYSTEM_EXAMPLES`, `STT_CONFIG_EXAMPLES`. Examples referenced in 3+ layers (shared, server, a client): 19.

i18n leaves parsed from `packages/shared/src/i18n/en/*.ts`: 2727 distinct sentences.

Sentences (24+ characters, no interpolation) that appear as a LITERAL in at least one test file: 211 of 753; in 2+ test files: 97; in test files of 2+ workspaces: 64; of 3+ workspaces: 14. Total literal occurrences by file: 440.

Top 40 sentences by number of test files that hold the literal:

| # | key | sentence (cut) | test files | shared | server | core-web | mobile |
|---|---|---|---|---|---|---|---|
| 1 | `common.coreErrors.offlineAfterAccepted` | Core server unreachable. | 16 | 0 | 0 | 7 | 9 |
| 2 | `common.coreErrors.offline` | Core server unreachable. Nothing was changed. | 14 | 0 | 0 | 6 | 8 |
| 3 | `devices.cameras.model` | Dual-lens IP camera DL-2 | 8 | 0 | 2 | 2 | 4 |
| 4 | `evidence.exportWizard.destinations.CASE_FILE` | Case file transfer (simulated) | 8 | 2 | 4 | 2 | 0 |
| 5 | `evidence.transcript.speakersUnavailable` | speaker labels unavailable | 8 | 0 | 2 | 1 | 2 |
| 6 | `evidence.itemFacts.interrupted.status` | Sealed — recording was interrupted | 8 | 1 | 0 | 3 | 4 |
| 7 | `session.audioSource.checking` | Checking your permissions… | 8 | 0 | 0 | 2 | 6 |
| 8 | `evidence.verifyV2Key.development` | Signed with a DEVELOPMENT key — not a production signature | 7 | 0 | 1 | 2 | 4 |
| 9 | `securityAudit.exportAudit.destinationValue` | Audit archive (simulated) | 7 | 2 | 2 | 3 | 0 |
| 10 | `login.errors.invalid` | Invalid username or password. | 6 | 1 | 0 | 3 | 2 |
| 11 | `common.coreMode.switchConfirm.SIMULATED` | Switch to Simulated mode | 5 | 0 | 0 | 4 | 1 |
| 12 | `common.coreLink.starting` | The Core server is starting | 5 | 0 | 0 | 5 | 0 |
| 13 | `common.sourceClass.microphoneOn.mobile` | Core Mac's microphone is on | 5 | 0 | 0 | 0 | 5 |
| 14 | `devices.sourcesCheck.checking` | Checking the capture sources… | 5 | 0 | 0 | 2 | 3 |
| 15 | `evidence.verifyV2.transcriptState.DISABLED_BY_CONFIGURATION` | Transcript disabled by configuration | 5 | 1 | 1 | 2 | 1 |
| 16 | `sessionNew.info.profile.standard` | Standard (1080p / 25 fps) | 5 | 0 | 0 | 3 | 2 |
| 17 | `apiReference.server.showSimulated` | Show simulated endpoints | 4 | 2 | 0 | 2 | 0 |
| 18 | `common.coreMode.switchTitle.SIMULATED` | Switch to Simulated mode? | 4 | 0 | 0 | 3 | 1 |
| 19 | `common.coreMode.switchBody` | You will be signed out and the console reloads. Simulated data and Liv | 4 | 0 | 0 | 3 | 1 |
| 20 | `common.captureInputs.againLabel` | Search again for microphones | 4 | 0 | 0 | 1 | 3 |
| 21 | `evidence.metadata.noPackage` | No DEMO package for this item | 4 | 0 | 0 | 3 | 1 |
| 22 | `evidence.verifyV2.transcriptState.UNAVAILABLE_AT_SEAL` | Transcript unavailable at seal | 4 | 1 | 2 | 1 | 0 |
| 23 | `evidence.live.mediaUnavailable` | Media reference unavailable | 4 | 0 | 0 | 3 | 1 |
| 24 | `evidence.transcript.notReady` | The transcript is not available yet. | 4 | 0 | 0 | 2 | 2 |
| 25 | `evidence.itemFacts.media.mayNotPlay` | You are not permitted to play this recording. | 4 | 0 | 0 | 1 | 3 |
| 26 | `login.errors.coreOfflineTitle` | Core service unreachable | 4 | 0 | 0 | 3 | 1 |
| 27 | `login.live.notices.absoluteExpired` | Your session reached its 8-hour limit. Sign in again. | 4 | 0 | 0 | 2 | 2 |
| 28 | `login.live.notices.userDisabled` | This account was disabled by an administrator. | 4 | 0 | 0 | 2 | 2 |
| 29 | `sessionNew.precheckNote.timeHostClock` | Time source: host system clock (no GNSS) | 4 | 1 | 1 | 1 | 1 |
| 30 | `session.feed.monitoringPaused` | Monitoring paused. Recording continues. | 4 | 0 | 0 | 3 | 1 |
| 31 | `common.captureNotice.unreachable.precheck.microphone` | It did not answer the pre-check. | 3 | 0 | 0 | 2 | 1 |
| 32 | `common.sourceClass.verify.development` | DEVELOPMENT SOURCES — this package was not recorded from production de | 3 | 0 | 1 | 1 | 1 |
| 33 | `common.sourceClass.verify.production` | Sources: declared as production devices by the Core that sealed this p | 3 | 0 | 1 | 1 | 1 |
| 34 | `common.sourceClass.verify.untrusted` | Sources: not trustworthy — the manifest was altered | 3 | 0 | 1 | 1 | 1 |
| 35 | `common.session.failedStart.next` | Check the cameras on Devices, then close this session and start a new  | 3 | 0 | 0 | 0 | 3 |
| 36 | `common.localSourceNotice.microphoneLimit` | Not fit for recording yet. Use it for development checks only. | 3 | 0 | 0 | 0 | 3 |
| 37 | `dashboard.systemRing.flags` | SECURE • HEALTHY • OPERATIONAL | 3 | 0 | 0 | 2 | 1 |
| 38 | `evidence.verifyV2.transcriptState.PARTIAL_BACKEND_UNREACHABLE` | Transcript partial — backend unreachable | 3 | 1 | 1 | 1 | 0 |
| 39 | `evidence.live.noPackage` | No DEMO package for this item: the Core server's record only. | 3 | 0 | 0 | 2 | 1 |
| 40 | `evidence.playback.notAvailable` | No playback media is available for this evidence item. | 3 | 0 | 0 | 1 | 2 |

i18n key paths referenced as `en.<path>` in test files: 354 distinct paths, 565 file references; in 2+ workspaces: 18. Top 40:

| # | key path | test files | shared | server | core-web | mobile |
|---|---|---|---|---|---|---|
| 1 | `en.common.coreErrors.offline` | 24 | 0 | 0 | 24 | 0 |
| 2 | `en.common.rbac.requiresRole.replace` | 21 | 0 | 0 | 21 | 0 |
| 3 | `en.common.rbac.deniedTitle` | 18 | 0 | 0 | 18 | 0 |
| 4 | `en.common.coreErrors.limited.replace` | 16 | 0 | 0 | 16 | 0 |
| 5 | `en.common.roles.SUPERVISOR` | 9 | 0 | 0 | 9 | 0 |
| 6 | `en.common.roles.INVESTIGATOR` | 8 | 0 | 0 | 8 | 0 |
| 7 | `en.common.roles.TECHNICIAN` | 6 | 0 | 0 | 6 | 0 |
| 8 | `en.common.sourceClass.badge` | 5 | 0 | 0 | 5 | 0 |
| 9 | `en.common.coreLink.lostTitle` | 5 | 0 | 0 | 5 | 0 |
| 10 | `en.common.captureConnect` | 4 | 0 | 0 | 4 | 0 |
| 11 | `en.common.tracks` | 4 | 1 | 0 | 3 | 0 |
| 12 | `en.devices.selector` | 4 | 0 | 0 | 4 | 0 |
| 13 | `en.evidence.itemFacts` | 4 | 0 | 0 | 4 | 0 |
| 14 | `en.common.interruptedSeal` | 4 | 1 | 0 | 1 | 2 |
| 15 | `en.common.deviceMenu.restart` | 4 | 0 | 0 | 4 | 0 |
| 16 | `en.common.captureNotice` | 3 | 0 | 0 | 3 | 0 |
| 17 | `en.common.localSourceNotice.microphoneLimit` | 3 | 0 | 0 | 3 | 0 |
| 18 | `en.common.developmentRoster` | 3 | 0 | 0 | 2 | 1 |
| 19 | `en.evidence.media.noMedia` | 3 | 0 | 0 | 3 | 0 |
| 20 | `en.evidence.verifyV2` | 3 | 0 | 0 | 2 | 1 |
| 21 | `en.common.captureFault.noReason.capture` | 3 | 1 | 0 | 1 | 1 |
| 22 | `en.session.finalization` | 3 | 0 | 0 | 2 | 1 |
| 23 | `en.common.faultKind.POWER_FAIL` | 3 | 0 | 0 | 3 | 0 |
| 24 | `en.evidence.live` | 3 | 0 | 0 | 3 | 0 |
| 25 | `en.common.deviceMenu.testSignal` | 3 | 0 | 0 | 3 | 0 |
| 26 | `en.common.actions.retry` | 3 | 0 | 0 | 3 | 0 |
| 27 | `en.common.errors.generic` | 3 | 0 | 0 | 3 | 0 |
| 28 | `en.common.coreLink.restored` | 3 | 0 | 0 | 3 | 0 |
| 29 | `en.common.coreErrors.originNotAllowed.split` | 3 | 0 | 0 | 3 | 0 |
| 30 | `en.sessionNew.errors.precheck` | 3 | 0 | 0 | 3 | 0 |
| 31 | `en.common.captureSearch.again` | 2 | 0 | 0 | 2 | 0 |
| 32 | `en.devices.live.samples_other` | 2 | 0 | 0 | 1 | 1 |
| 33 | `en.devices.live.samples_one` | 2 | 0 | 0 | 1 | 1 |
| 34 | `en.devices.sourcesCheck` | 2 | 0 | 0 | 2 | 0 |
| 35 | `en.common.localSourceNotice` | 2 | 0 | 0 | 2 | 0 |
| 36 | `en.common.sourceClass` | 2 | 0 | 0 | 2 | 0 |
| 37 | `en.common.sourceClass.kind.localMicrophone` | 2 | 0 | 0 | 2 | 0 |
| 38 | `en.evidence.media.noMediaBody` | 2 | 0 | 0 | 2 | 0 |
| 39 | `en.evidence.live.mediaUnavailable` | 2 | 0 | 0 | 2 | 0 |
| 40 | `en.evidence.verify.last.full` | 2 | 0 | 0 | 2 | 0 |

#### (e) Tablet / phone pairs (mobile)

Mobile `it` call sites: 2524; whose describe chain or title names tablet or phone: 215. Titles that become identical when "tablet" / "phone" (and portrait / landscape) are erased, with one of each: 0 pairs (0 blocks).

Bodies of the same shape (literals erased) where one block is named for the tablet and another for the phone: 0 clusters, 0 blocks.

Mobile test FILES named for one layout: 4 (17 tests): `wave-k-m2-phone-discovery`, `wave-k-m2-phone-layout`, `live-gap-s4-7-tablet-link`, `wave-k-m1-tablet-taps`.

The title pairs:

| # | tablet block | phone block | same body shape |
|---|---|---|---|

The same-shape clusters:

| # | blocks | first | second |
|---|---|---|---|


#### (b, continued) Near-identical bodies

Token-shingle comparison (6-token shingles over the body with comments removed; bodies of 40+ tokens: 12573 of 13417; shingles shared by more than 40 bodies ignored as boilerplate; clusters by single linkage).

| Jaccard at least | clusters (2+) | blocks | blocks beyond the first of each cluster | clusters inside one file / extra blocks | clusters over 2+ files / extra blocks | over 2+ workspaces |
|---|---|---|---|---|---|---|
| 0.9 | 18 | 51 | 33 | 0 / 0 | 18 / 33 | 0 |
| 0.8 | 33 | 89 | 56 | 2 / 2 | 31 / 54 | 0 |
| 0.7 | 55 | 139 | 84 | 9 / 9 | 46 / 75 | 5 |

At Jaccard 0.8, by workspace:

| workspace | clusters inside one file | extra blocks | clusters over 2+ files | extra blocks | of those: a per-wave family file is in the cluster |
|---|---|---|---|---|---|
| shared | 0 | 0 | 2 | 2 | 0 |
| server | 1 | 1 | 22 | 39 | 1 |
| core-web | 1 | 1 | 2 | 7 | 0 |
| mobile | 0 | 0 | 5 | 6 | 1 |
| transcriber | 0 | 0 | 0 | 0 | 0 |

The 40 largest near-identical clusters over 2+ files (Jaccard 0.8), by tokens that repeat:

| # | blocks | files | tokens per block | first title | where (first 4) |
|---|---|---|---|---|---|
| 1 | 11 | 11 | 59 | schema version 6, contract dbc-7 | `core-server/src/capture-session/__tests__/session-capture.db.test.ts:284`<br>`core-server/src/capture/fence/__tests__/development-session.db.test.ts:237`<br>`core-server/src/capture/fence/__tests__/fence.db.test.ts:101`<br>`core-server/src/db/mapping/__tests__/fault-key.db.test.ts:27` |
| 2 | 7 | 7 | 71 | MD-6, TS-15: no file loads the typed client or the Live source, builds a client, | `core-web/src/test/live-dashboard-page.test.tsx:221`<br>`core-web/src/test/live-evidence-archive.test.tsx:282`<br>`core-web/src/test/live-login-model.test.tsx:252`<br>`core-web/src/test/live-network-time-page.test.tsx:240` |
| 3 | 3 | 3 | 165 | the folder names no network API, no Core server address, no storage package, no  | `mobile/src/features/audit/audit-live-static.test.ts:107`<br>`mobile/src/features/devices/devices-live-static.test.ts:115`<br>`mobile/src/features/storage/storage-live-static.test.ts:114` |
| 4 | 4 | 4 | 77 | no route carries a hook or a rule of its own: the route configuration is the ope | `core-server/src/modules/alerts/__tests__/routes.test.ts:165`<br>`core-server/src/modules/network-time/__tests__/routes.test.ts:117`<br>`core-server/src/modules/storage/__tests__/routes.test.ts:118`<br>`core-server/src/modules/system/__tests__/routes.test.ts:208` |
| 5 | 2 | 2 | 211 | %s: Connect is drawn disabled with the web-console sentence; a press sends nothi | `mobile/src/features/capture-selector/camera-search.test.tsx:144`<br>`mobile/src/features/capture-selector/wave-k-m2-phone-discovery.test.tsx:97` |
| 6 | 4 | 4 | 62 | no file reads the system time, sets a timer or reads a clock at all | `core-server/src/modules/alerts/__tests__/static.test.ts:38`<br>`core-server/src/modules/network-time/__tests__/static.test.ts:36`<br>`core-server/src/modules/storage/__tests__/static.test.ts:33`<br>`core-server/src/modules/system/__tests__/static.test.ts:39` |
| 7 | 3 | 3 | 77 | the chain of this database verifies over all rows | `core-server/src/core/__tests__/connection-lost.db.test.ts:207`<br>`core-server/src/core/__tests__/search-path.db.test.ts:139`<br>`core-server/src/core/__tests__/unit-of-work.db.test.ts:562` |
| 8 | 2 | 2 | 151 | after all rounds: the chain verifies over every row, the tables hold the committ | `core-server/src/modules/sessions/__tests__/concurrency.db.test.ts:158`<br>`core-server/src/modules/sessions/__tests__/journey.db.test.ts:322` |
| 9 | 2 | 2 | 148 | %s: nobody, and a paired device without an operator, answer 401 NOT_SIGNED_IN; n | `core-server/src/modules/evidence/__tests__/routes.test.ts:271`<br>`core-server/src/modules/security-audit/__tests__/routes.test.ts:273` |
| 10 | 2 | 2 | 141 | a parse or validation failure of signIn is logged by its code only | `core-server/src/modules/identity/__tests__/secrets.db.test.ts:193`<br>`core-server/src/modules/pairing/__tests__/secrets.db.test.ts:355` |
| 11 | 2 | 2 | 138 | the read opens no unit of work, sends no statement, writes no row and publishes  | `core-server/src/modules/alerts/__tests__/alerts.db.test.ts:145`<br>`core-server/src/modules/system/__tests__/system.db.test.ts:155` |
| 12 | 2 | 2 | 130 | signs in through the Login form and then opens the pending href | `mobile/src/navigation/__tests__/guard.test.tsx:158`<br>`mobile/src/navigation/__tests__/pairing-gate.test.tsx:210` |
| 13 | 4 | 4 | 42 | no slot of the scaffold is provided or replaced, and no test file is imported | `core-server/src/modules/alerts/__tests__/static.test.ts:123`<br>`core-server/src/modules/network-time/__tests__/static.test.ts:95`<br>`core-server/src/modules/storage/__tests__/static.test.ts:113`<br>`core-server/src/modules/system/__tests__/static.test.ts:144` |
| 14 | 2 | 2 | 117 | AC-C-53: no file imports `useSimActions`, reads `.actions` of a `Sim`, or calls  | `core-web/src/test/live-network-time-page.test.tsx:231`<br>`core-web/src/test/live-security-audit-page.test.tsx:284` |
| 15 | 2 | 2 | 115 | uses erasable syntax only: no enum, no namespace, no parameter property | `shared/test/live-light-platform-neutral.test.ts:141`<br>`shared/test/live-source-platform-neutral.test.ts:178` |
| 16 | 3 | 3 | 50 | no console call, no raw URL, no header, no environment, no listener | `core-server/src/modules/evidence/__tests__/static.test.ts:240`<br>`core-server/src/modules/identity/__tests__/static.test.ts:155`<br>`core-server/src/modules/security-audit/__tests__/static.test.ts:282` |
| 17 | 2 | 2 | 99 | no file writes a denial row, builds a refusal, takes a place in the denial budge | `core-server/src/modules/alerts/__tests__/static.test.ts:65`<br>`core-server/src/modules/system/__tests__/static.test.ts:79` |
| 18 | 2 | 2 | 86 | the LIVE wording is picked from `useCoreLink().source` in one file, never from a | `mobile/src/features/devices/devices-live-static.test.ts:138`<br>`mobile/src/features/storage/storage-live-static.test.ts:137` |
| 19 | 2 | 2 | 85 | no production file reads `.actions` of a `Sim`: every `.actions` left is a style | `mobile/src/features/dashboard/home-more-live-static.test.ts:90`<br>`mobile/src/features/devices/devices-live-static.test.ts:91` |
| 20 | 2 | 2 | 82 | no file imports a module of the runtime, names the process or the network, uses  | `core-server/src/modules/alerts/__tests__/static.test.ts:44`<br>`core-server/src/modules/system/__tests__/static.test.ts:45` |
| 21 | 2 | 2 | 82 | the hosted actions it names are inject and clearFault | `core-server/src/modules/demo/__tests__/static.test.ts:236`<br>`core-server/src/modules/devices/__tests__/static.test.ts:176` |
| 22 | 2 | 2 | 82 | is the runtime role on schema version 6 / dbc-7, and this row brought no migrati | `core-server/src/sealing/__tests__/last-resort.db.test.ts:132`<br>`core-server/src/sealing/__tests__/stt-states.db.test.ts:112` |
| 23 | 2 | 2 | 76 | nothing of a body comes back in the outcome of a refused one | `core-server/src/modules/evidence/__tests__/export-request.test.ts:154`<br>`core-server/src/modules/security-audit/__tests__/export-request.test.ts:139` |
| 24 | 2 | 2 | 70 | every instant is app.clock: no system time and no timer | `core-server/src/modules/demo/__tests__/static.test.ts:290`<br>`core-server/src/modules/devices/__tests__/static.test.ts:183` |
| 25 | 2 | 2 | 66 | no simulator action, no hosted command, no engine state: the code of the folder  | `core-server/src/modules/identity/biometric/__tests__/static.test.ts:179`<br>`core-server/src/modules/pairing/__tests__/static.test.ts:140` |
| 26 | 2 | 2 | 63 | is at the schema version of the code: [6, 'dbc-7'] | `core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts:167`<br>`core-server/src/modules/capture-discovery/__tests__/session-expiry.db.test.ts:99` |
| 27 | 2 | 2 | 62 | no console, no random source, no log line of its own | `core-server/src/modules/network-time/__tests__/static.test.ts:56`<br>`core-server/src/modules/storage/__tests__/static.test.ts:62` |
| 28 | 2 | 2 | 56 | the pools of this file are the runtime role and the owner, never the administrat | `core-server/src/modules/transcripts/__tests__/transcripts.db.test.ts:169`<br>`core-server/src/sealing/__tests__/finalize-transcript.db.test.ts:151` |
| 29 | 2 | 2 | 55 | is at schema version 4 / dbc-5 (sets 4 and 5), and this row brought no migration | `core-server/src/modules/transcript-chunks/__tests__/transcript-chunks.db.test.ts:64`<br>`core-server/src/modules/transcripts/__tests__/transcripts.db.test.ts:164` |
| 30 | 2 | 2 | 50 | no file reads the system time, sets a timer or draws a random number | `core-server/src/modules/evidence/__tests__/static.test.ts:234`<br>`core-server/src/modules/security-audit/__tests__/static.test.ts:276` |
| 31 | 2 | 2 | 40 | AC-C-02: no file names node:, react-native, expo, window or document (comments i | `shared/test/live-light-platform-neutral.test.ts:112`<br>`shared/test/live-testing-platform-neutral.test.ts:84` |

The 25 largest near-identical clusters inside ONE file (candidates for one table-driven case):

| # | blocks | tokens per block | file:line of the first | first title |
|---|---|---|---|---|
| 1 | 2 | 276 | `core-web/src/test/live-runtime-boot-failure.test.tsx:59` | with %s: the page shows the one sentence, starts no simulator and records once without the |
| 2 | 2 | 74 | `core-server/src/modules/system/__tests__/routes.test.ts:576` | nobody without a session starts a run: 401, and the engine is not reached |

#### Tablet / phone, second measure: how mobile tests pick the layout

Mobile test files: 311. Naming a tablet window and a phone window in the same file: 49; tablet only: 32; phone only: 16; neither (the default window of the test set-up): 214. Files that already loop or use `.each` over a list holding "tablet" / "phone": 19.

Near-identical mobile clusters (Jaccard 0.8) where the blocks differ in naming the tablet or the phone in the title: 0 clusters, 0 blocks:

| # | blocks | where | titles |
|---|---|---|---|


Reading of section 3:

- (a) The largest title clusters are static-rule tests that apply one rule to one folder each
  (rows 1 to 3, 5 to 11, 15 to 17), set-up stamps (rows 12, 13, 18, 19) and two files that share a
  table of cases (`boot-checks-runner.test.ts` / `demo/host.test.ts`, `db/reset/cli.test.ts` /
  `db/seed/cli.test.ts`). The cross-workspace clusters are core-web + mobile: the same requirement
  id tested on the two clients, which have separate implementations.
- (b) Identical or near-identical bodies are the same rule on different folders; they differ in a
  constant declared above the test. They are candidates for ONE table-driven rule, not for
  deletion: each asserts on a different subject.
- (c) The home of 149 of the 165 family files is determined by an import; 16 need the owner's
  reading (they render through a route harness or read sources as text).
- (d) The contract examples are asserted in several layers by design (D233 protects them).
  `CORE_API_EXAMPLES` is referenced by 46 test files. 15 exported example constants are referenced
  by no test file BY NAME; whether they are asserted through an aggregate such as
  `CORE_API_EXAMPLES` was not traced. 64 sentences are held as literals by tests of two or more workspaces:
  a wording change has to be made in each (this is the measured part of "copy rounds").
- (e) No tablet / phone pair with the same expectations was found by title or by body: 0 clusters.
  49 mobile test files name both windows and 19 already loop over them. The layout duplication the
  controller expected is not there in a form text can show.

## 4. Static "pin" tests

Commands: `node pins.mjs`. A file is "source-reading" when it imports a scan helper
(`test/static/scan`, `static-rules`, `imports`, `log-calls`, `core-page-walk`), lists a directory
(`readdirSync`, `readdir(`, `globSync`, `import.meta.glob`), sits in `test/static/`, or has "static"
in its name. Inside those files each `it` is classified by title and body: file LIST (an expected
array of two or more paths, or a title of the form "reads the ... files / folder"), COUNT
(`toHaveLength(N)` on a listing, or "N texts / keys / files" in the title), DIGEST (a hex literal
with a hash call, or "as it was at <commit>"), ALLOW-LIST, positive control, rule ("no file does
X", an expected empty list), other. The last column applies the same patterns to ALL files; outside
the source-reading files the COUNT and ALLOW patterns also match behaviour tests ("ONE alert",
"allowed"), so that column is an upper bound, not a count of pins.

| workspace | source-reading test files | tests in them (run 12) | static sites: file LIST | COUNT | DIGEST | ALLOW-LIST | positive control | "no file does X" rule | other | pins (list+count+digest+allow) in ALL files of the workspace |
|---|---|---|---|---|---|---|---|---|---|---|
| shared | 13 | 295 | 6 | 5 | 3 | 4 | 4 | 47 | 104 | 108 |
| server | 87 | 1204 | 113 | 67 | 2 | 13 | 60 | 426 | 436 | 529 |
| core-web | 19 | 289 | 20 | 3 | 0 | 7 | 9 | 57 | 165 | 95 |
| mobile | 25 | 255 | 35 | 8 | 9 | 2 | 4 | 72 | 98 | 105 |
| transcriber | 8 | 371 | 5 | 3 | 0 | 1 | 7 | 35 | 125 | 17 |
| mock-core | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |

| family | files | tests | LIST | COUNT | DIGEST | ALLOW | control | rule | other | files named with "pin" in implementation notes | notes that name them (distinct) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| core-web `src/test/live-*.test.tsx` with a static block | 14 | 210 | 18 | 2 | 0 | 7 | 1 | 49 | 120 | 2 | 2 |
| core-web other source-reading files | 5 | 79 | 2 | 1 | 0 | 0 | 8 | 8 | 45 | 0 | 0 |
| mobile `*-live-static.test.ts` / `*-static.test.ts` | 13 | 120 | 29 | 3 | 8 | 1 | 0 | 48 | 29 | 6 | 8 |
| mobile other source-reading files | 12 | 135 | 6 | 5 | 1 | 1 | 4 | 24 | 69 | 3 | 4 |
| server `test/db` schema inventory | 1 | 12 | 0 | 1 | 0 | 1 | 1 | 3 | 6 | 1 | 2 |
| server `test/static/*.test.ts` (workspace-wide guards) | 15 | 171 | 19 | 4 | 0 | 5 | 5 | 40 | 29 | 7 | 15 |
| server other source-reading files | 43 | 510 | 13 | 26 | 0 | 2 | 35 | 114 | 302 | 14 | 15 |
| server per-folder `__tests__/static*.test.ts` | 28 | 511 | 81 | 36 | 2 | 5 | 19 | 269 | 99 | 7 | 26 |
| shared `*-platform-neutral.test.ts` | 5 | 67 | 0 | 0 | 0 | 4 | 1 | 38 | 20 | 1 | 1 |
| shared other source-reading files | 8 | 228 | 6 | 5 | 3 | 0 | 3 | 9 | 84 | 1 | 2 |
| transcriber source-reading files | 8 | 371 | 5 | 3 | 0 | 1 | 7 | 35 | 125 | 1 | 1 |

Test files most often named on a line with "pin" in `implementation/*.md` (distinct notes; a note counts once per file):

| # | test file | notes | source-reading | pins by pattern (L/C/D/A) | tests |
|---|---|---|---|---|---|
| 1 | `core-server/src/capture/__tests__/static.test.ts` | 19 (116, 117, 124, 128, 132, 139, 144, 19_, 20_, 23_, 25_, 37b, ...) | yes | 9/4/2/2 | 49 |
| 2 | `core-server/src/engine/__tests__/static.test.ts` | 8 (113, 114, 122, 139, 140, 144, 30b, 37b) | yes | 1/0/0/0 | 15 |
| 3 | `core-server/src/capture/__tests__/protocol-pins.test.ts` | 7 (116, 19_, 20_, 21_, 30_, 35_, 90_) | no | 0/0/0/1 | 10 |
| 4 | `core-server/test/acceptance/contract.test.ts` | 6 (117, 43_, 60_, 66_, 67_, 95_) | no | 0/8/0/1 | 38 |
| 5 | `core-server/test/static/imports.test.ts` | 6 (122, 126, 39_, 43_, 62_, 94_) | yes | 5/0/0/0 | 17 |
| 6 | `core-server/src/capture/adapters/__tests__/static.test.ts` | 5 (23_, 25_, 65_, 66_, 73_) | yes | 3/0/0/0 | 15 |
| 7 | `core-server/src/db/fixtures/__tests__/bulk-fixture.db.test.ts` | 5 (149, 50_, 60_, 60a, 67_) | no | 0/3/0/0 | 26 |
| 8 | `core-server/test/acceptance/rbac-matrix.test.ts` | 5 (43_, 52_, 63_, 66_, 95_) | no | 0/5/0/1 | 39 |
| 9 | `shared/test/sim-v2-parity.test.ts` | 5 (112, 17_, 68_, 69b, 70_) | no | 0/1/0/0 | 10 |
| 10 | `core-server/src/db/fixtures/__tests__/build.test.ts` | 4 (149, 50_, 64_, 67_) | no | 0/5/0/0 | 60 |
| 11 | `core-server/src/db/seed/__tests__/seed.db.test.ts` | 4 (53_, 60a, 68_, 69b) | no | 0/1/0/0 | 33 |
| 12 | `mobile/src/features/evidence/live-evidence-static.test.ts` | 4 (142, 143, 149, 45_) | yes | 4/0/1/0 | 12 |
| 13 | `shared/test/openapi.test.ts` | 4 (14_, 16_, 61_, 69b) | no | 0/2/0/0 | 21 |
| 14 | `core-server/src/capture/adapters/local/__tests__/camera-helper.test.ts` | 3 (106, 93_, 97_) | yes | 2/4/0/0 | 33 |
| 15 | `core-server/src/credential-store/__tests__/static.test.ts` | 3 (37b, 43_, 73_) | yes | 5/0/0/0 | 10 |
| 16 | `core-server/src/modules/evidence/__tests__/static.test.ts` | 3 (122, 144, 44_) | yes | 3/0/0/0 | 20 |
| 17 | `core-server/src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | 3 (139, 144, 151) | yes | 0/0/0/0 | 3 |
| 18 | `core-server/test/db/contract-inventory.test.ts` | 3 (107, 52_, 60a) | no | 0/5/0/1 | 40 |
| 19 | `core-server/test/static/lane-camera-stub.test.ts` | 3 (124, 139, 158) | yes | 0/0/0/3 | 17 |
| 20 | `core-server/test/static/network.test.ts` | 3 (62_, 65_, 73_) | yes | 1/2/0/0 | 14 |
| 21 | `core-server/test/static/scaffold.test.ts` | 3 (19_, 43_, 52_) | yes | 0/0/0/0 | 69 |
| 22 | `mobile/src/features/session-summary/summary-live-static.test.ts` | 3 (134, 156, 45_) | yes | 5/0/0/0 | 10 |
| 23 | `shared/test/api-state-slices.test.ts` | 3 (14_, 68_, 69b) | no | 0/5/0/0 | 103 |
| 24 | `shared/test/i18n-vocabulary-sync.test.ts` | 3 (17_, 68_, 70_) | no | 0/1/0/0 | 36 |
| 25 | `core-server/src/capture-session/__tests__/session-capture.db.test.ts` | 2 (128, 144) | no | 1/4/0/0 | 55 |
| 26 | `core-server/src/capture/__tests__/fault-lifecycle.test.ts` | 2 (112, 30b) | no | 0/0/0/0 | 16 |
| 27 | `core-server/src/capture/__tests__/ipc.test.ts` | 2 (112, 21_) | no | 0/0/0/2 | 16 |
| 28 | `core-server/src/capture/__tests__/liveness.test.ts` | 2 (19_, 20_) | no | 0/0/0/0 | 15 |
| 29 | `core-server/src/capture/__tests__/module.test.ts` | 2 (126, 19_) | no | 0/0/0/0 | 6 |
| 30 | `core-server/src/capture/__tests__/records.test.ts` | 2 (21_, 62_) | no | 0/0/0/0 | 62 |
| 31 | `core-server/src/capture/__tests__/supervisor.test.ts` | 2 (20_, 21_) | no | 0/0/0/0 | 33 |
| 32 | `core-server/src/capture/__tests__/tidy-fy.test.ts` | 2 (118, 126) | no | 1/0/0/0 | 13 |
| 33 | `core-server/src/capture/adapters/camera/__tests__/probe-answer.test.ts` | 2 (130, 62_) | no | 0/0/0/0 | 20 |
| 34 | `core-server/src/capture/fence/__tests__/fence.db.test.ts` | 2 (67_, 92_) | no | 0/1/0/0 | 16 |
| 35 | `core-server/src/db/mapping/__tests__/to-rows.test.ts` | 2 (68_, 69b) | no | 0/2/0/0 | 71 |
| 36 | `core-server/src/engine/__tests__/commands.db.test.ts` | 2 (140, 20_) | no | 0/0/0/1 | 20 |
| 37 | `core-server/src/engine/__tests__/restart.db.test.ts` | 2 (68_, 69b) | no | 0/0/0/0 | 27 |
| 38 | `core-server/src/engine/__tests__/ring.test.ts` | 2 (68_, 69b) | no | 0/0/0/0 | 6 |
| 39 | `core-server/src/modules/capture-config/__tests__/routes.test.ts` | 2 (132, 95_) | no | 1/0/0/1 | 13 |
| 40 | `core-server/src/modules/devices/__tests__/source-class.db.test.ts` | 2 (115, 71_) | no | 0/0/0/0 | 7 |
| 41 | `core-server/src/modules/evidence/__tests__/routes.test.ts` | 2 (44_, 95_) | no | 2/0/0/0 | 80 |
| 42 | `core-server/src/modules/media-stream/__tests__/routes.test.ts` | 2 (117, 122) | no | 0/0/0/0 | 39 |
| 43 | `core-server/src/sealing-host/__tests__/wave-k-s1-stream-profile.test.ts` | 2 (144, 151) | no | 0/1/0/0 | 12 |
| 44 | `core-server/src/sealing/__tests__/stt-states.db.test.ts` | 2 (55_, 58_) | no | 0/1/0/0 | 5 |
| 45 | `core-server/src/sealing/__tests__/wave-i-a1-way-out.test.ts` | 2 (131, 153) | yes | 0/1/0/0 | 7 |

Mentions whose file name is shared by several test files and could not be resolved to one path: static.test.ts (11), pipeline.test.ts (1), limits.test.ts (1), routes.test.ts (3), reads.db.test.ts (1), live-evidence-export.test.tsx (1), unsealable-notice.test.tsx (1), effects.db.test.ts (1), commands.db.test.ts (1), credentials.test.ts (3).

Distinct test files named with "pin": 216; distinct notes that do so: 91 of 163.

Examples of each pattern (first 12 per kind, `file:line title`), drawn from ALL files and therefore showing the classifier's false matches too: the DIGEST lines of `onvif-session.test.ts` are HTTP Digest authentication tests, and several COUNT / ALLOW lines are behaviour tests ("ONE alert", "allowed"). The counts used in sections 4.1 to 4.3 are the title families of 4.1, not these:

- **LIST**
  - `core-server/src/capture-session/__tests__/session-capture.db.test.ts:291` the start writes the four source rows with RECORDING, says "connecting", calls capture.sta
  - `core-server/src/capture/__tests__/forwarder-engine.test.ts:223` two reasons of CAPTURE_FAULT on CAM-02 are two faults, two alerts and two FAULT_RAISED row
  - `core-server/src/capture/__tests__/forwarder-engine.test.ts:244` one microphone: silent (its own kind), disconnected (a capture fault with its reason) and 
  - `core-server/src/capture/__tests__/fragments.test.ts:103` reads the file in pieces: a source that hands out at most 1,000 bytes a call gives the sam
  - `core-server/src/capture/__tests__/muxer-safety.test.ts:30` reads the sources it judges
  - `core-server/src/capture/__tests__/static.test.ts:79` reads the production sources of the capture folder
  - `core-server/src/capture/__tests__/static.test.ts:267` finds a second importer, a second parser, a product file that sets the test target, and a 
  - `core-server/src/capture/__tests__/static.test.ts:349` finds a call from a boot hook, a timer or a read operation (control)
  - `core-server/src/capture/__tests__/static.test.ts:389` finds a second importer, the package's main entry, a write call, a listener and a second p
  - `core-server/src/capture/__tests__/static.test.ts:451` app.ts: the header records the waived edits (spec §I allows that and nothing else there); 
  - `core-server/src/capture/__tests__/static.test.ts:776` the door is the one file under adapters/local that starts a process: one spawn, no shell, 
  - `core-server/src/capture/__tests__/static.test.ts:816` finds a default account, a maker table, a fake imported into the local folder, and a fake 
  - (256 in all)
- **COUNT**
  - `core-server/src/capture-notices/__tests__/notices.test.ts:410` THE SOURCE RIG on the generated sources of a development Core: OFF, the pre-check passes (
  - `core-server/src/capture-notices/__tests__/notices.test.ts:469` THE SOURCE RIG, the other cases of the start rule: BOTH generated cameras switched block t
  - `core-server/src/capture-notices/__tests__/session-start.db.test.ts:249` with no forwarder mounted the failed start still gets its ONE alert and ONE row; the alert
  - `core-server/src/capture-session/__tests__/session-capture.db.test.ts:429` no camera connected: the session FAULTS, nothing claims to have recorded, its recovery mak
  - `core-server/src/capture-session/__tests__/session-capture.db.test.ts:459` CONTROL: the same loss AFTER the first durable fragment is an interrupted recording - the 
  - `core-server/src/capture-session/__tests__/session-capture.db.test.ts:876` R74-08: a stop that commits while a microphone start is still waited for is sent to the wo
  - `core-server/src/capture-session/__tests__/session-capture.db.test.ts:1066` mid-start: a camera source that is still being opened (the settle window of its helper) is
  - `core-server/src/capture/__tests__/static.test.ts:179` the one spawn hands the worker no shell and never the server's environment
  - `core-server/src/capture/__tests__/static.test.ts:324` the parser options are pinned in the one file that imports it (SEC35-29 (2)): strict, arra
  - `core-server/src/capture/__tests__/static.test.ts:869` no production file but the one function reads it; the configuration declares and builds it
  - `core-server/src/capture/__tests__/static.test.ts:957` the boot checks take the decision of the one function and refuse what it refuses, before a
  - `core-server/src/capture/adapters/__tests__/fakes.test.ts:188` dual lens: one camera, two profiles, two locators
  - (374 in all)
- **DIGEST**
  - `core-server/src/capture/__tests__/static.test.ts:478` app.ts: every added line is a waived one (capture: spec §I edits 1 to 6; STT configuration
  - `core-server/src/capture/__tests__/static.test.ts:562` config.ts: every added line is one of the capture keys (spec §I edits 7 to 10 and 15 to 18
  - `core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts:232` a device that challenges GetSystemDateAndTime is not answered with the credential
  - `core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts:314` a Digest challenge with a hash outside the list is not answered
  - `core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts:325` what travelled, in both forms: a digest answer or a digest token, never the secret, its ba
  - `core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts:405` a one-element service list, a missing element and a 3,000-level body: no uncaught exceptio
  - `core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts:444` a stream address on another host, with a user part or of another scheme is WRONG_PROFILE; 
  - `core-server/src/modules/evidence/__tests__/immutability.db.test.ts:241` a dataset item (hashes of its demo package): six steps, one digest
  - `core-server/src/modules/evidence/__tests__/immutability.db.test.ts:270` an item the ENGINE sealed (a session recorded through hosted commands, simulated hashes): 
  - `core-server/test/db/pg-behaviours.db.test.ts:45` gen_random_uuid() and sha256(bytea) need no extension; an identifier is cut at 63 bytes
  - `core-server/test/db/set5.db.test.ts:296` 0008 and 0009 hash to what the ledgers of the four development databases store (row 130): 
  - `core-server/test/db/set6.db.test.ts:337` 0008, 0009 and 0010 hash to what the ledgers of the four development databases store: they
  - (30 in all)
- **ALLOW**
  - `core-server/src/capture/__tests__/ipc.test.ts:112` a KILLED worker that reported its first durable fragment is NOT started again: FAULTED, on
  - `core-server/src/capture/__tests__/ipc.test.ts:129` CONTROL: with no restart allowed, a killed worker is NOT started again: FAULTED, CAPTURE_F
  - `core-server/src/capture/__tests__/protocol-pins.test.ts:144` R63-04 / R63-06: the release worker names itself with a word of the allowlist, and a build
  - `core-server/src/capture/__tests__/static.test.ts:156` the process module and the file system are imported by files of the allowlist only
  - `core-server/src/capture/__tests__/static.test.ts:189` index.ts is the only file of the folder that logs or writes the error log
  - `core-server/src/capture/adapters/__tests__/registry.test.ts:55` SIMULATED registers no adapter; REAL_PRODUCTION no development kind; REAL_DEVELOPMENT no p
  - `core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts:305` the Basic-only stub mode receives no credential at all: outcome AUTHENTICATION_FAILED, rea
  - `core-server/src/core/__tests__/connection-lost.test.ts:118` the work caught the failure and returned, or threw a refusal of its own: the answer is sti
  - `core-server/src/core/__tests__/unit-of-work.db.test.ts:489` at level trace, a unit that appends, one that is refused and one that fails leave none of 
  - `core-server/src/core/__tests__/writers.test.ts:424` %s: a key the specification does not name is refused
  - `core-server/src/db/fixtures/__tests__/audit-details.test.ts:209` a server-written type holds exactly the keys of the audit writer’s list, each value in its
  - `core-server/src/db/fixtures/__tests__/audit-details.test.ts:259` prints the table: type, where it is written, keys expected, keys written
  - (197 in all)


### 4.1 The families, counted by run-12 titles

Command: a regular expression per family over the 17,511 full names of `scratchpad/audit13/rt.json`
(shown in the session; the patterns are quoted in the first column).

| family (pattern on the full name) | tests | files | by workspace |
|---|---|---|---|
| "the scan reads exactly these files" (`reads the/all/every ... sources/files/folder`, `files it means to read`, `every production file`, `are the ones this test reads`, `scans the production files`) | 83 | 74 | server 47 / 43, core-web 19 / 14, mobile 16 / 16, transcriber 1 / 1 |
| schema stamp per db file (`schema version N, contract dbc-N`, `brought no migration`, `at the schema version of the code`) | 24 | 24 | server-db |
| frozen at a commit (`as it was at <sha>`, `of <sha> ... adds/files`, `one digest`) | 12 | 10 | mobile 8 / 7, server 4 / 3 |
| "N texts / keys / files / exactly N" | 33 | 15 | shared 18 / 2, mobile 11 / 11, server 4 / 2 |
| positive control of a scan (`positive control`, `(control)`, `CONTROL:`) | 443 | 242 | server 295, mobile 78, shared 27, core-web 27, transcriber 16 (this pattern also matches the CONTROL cases of behaviour tests) |

### 4.2 Reds, as data

Read from `test/02`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `12` (the red sections). "Kind" is my
reading of the runner's own text; where I did not trace the resolution I say so.

| run | reds | what | kind |
|---|---|---|---|
| 12 (wave M) | 1 | `capture-config/__tests__/integration-d1b.db.test.ts:154`, stored slices against `engine.state()`, `health` one sample apart (test/12 R1) | test race (section 5.5) |
| 11 (wave L) | 0 | | |
| 10 (wave K) | 2 | `db/fixtures/__tests__/audit-details.test.ts:237` (key set of the fixture's verify rows against the simulator's, which gained `operationId`); `mobile navigation/__tests__/navigation-units.test.ts:199` (keys of `FEATURE_RESOURCES` against a list of folders) | stale pin x 2 (parity of a fixture; list of names) |
| 09 (wave I) | 4 | `test/acceptance/pairing-lifecycle.test.ts:989` and `:1371` (audit rows with `deviceId null`, now the sending device); `engine/__tests__/commands.db.test.ts:741` (allow-list of log keys, one new boolean key); `mobile runtime/pending-control.test.tsx:113` (list of files that use a helper) | stale pin x 4 (exact sequence x 2; allow-list; file list) |
| 08 (wave H) | 0 | | |
| 07 (wave H checkpoint) | 3 + 1 | speech-session e2e (a real failure of the e2e); `test/db/integration-d4.db.test.ts:99` x 2 (one extra key `sealedPackage` on a whole-object equality); `ws-discovery.test.ts:182` red once under 4 workers, green alone; `shell-motion.test.tsx` (the runner's own command) | 1 real, 2 stale equality, 1 race under load |
| 06 (wave F) | 6 | `modules/sessions/__tests__/static.test.ts:106`, `:115` (rule M3: the module read a member of the principal); `revision-reconcile.test.ts:134` and `transcript-routes.db.test.ts:722` (`V-14 UNEXPECTED_FILE` absent); `evidence/__tests__/bulk.db.test.ts:313` (extra key `jobId`); `mobile summary-live-static.test.ts:60` (file list, one new file) | **2 real catches of a static RULE** (the product was changed, "The static test is unchanged": `implementation/119_pass_fz.md:7`); 2 not traced by me; 1 stale equality; 1 stale file list |
| 05 (wave D/E) | 39 | core-web, 7 files; the legend's cause `SEQ`: a scripted answer of the fake transport no longer valid under the contract (`items.0.seq`) | stale fixture, caught by the contract check of the fake transport (I read the legend and the file list, not all 39 rows) |
| 02 (wave C, work in progress) | 8 unit + 16 db | among them `test/db/set4-rules.test.ts:117` (a production statement updates `adapter_kind`: a rule hit), `capture/adapters/__tests__/credential.test.ts:176` (a credential value in `endpointRef`: a canary hit), registry / router list pins marked "known", `contract.test.ts` x 10 | mixed; read in part |

Of the last four pre-commit runs (09 to 12): 7 reds = 6 stale pins + 1 race, 0 product defects.
Stale reds by pin kind over 06 to 12: list of files or names 3, allow-list 1, exact equality of a
whole object or sequence in a behaviour test 5, parity of a fixture 1. Rules of the form "no file
does X": 0 stale reds, 2 real catches (06) and 2 more in the work-in-progress run 02.

### 4.3 Classification

| family | tests / files | rule it protects | red in 09..12 | named with "pin" in notes | classification |
|---|---|---|---|---|---|
| server `test/static/*.test.ts` (credentials, logging, network, imports, search-path, audit-protection, api-headers, slot-replacement, log-calls, routes, scaffold, guard-family, scan-skips, lane-camera-stub, test-support-imports) | 171 / 15 | workspace-wide security and architecture rules: no credential or secret in a log, no outbound network module, no import cycle or deep import, pinned `search_path`, audit tables not writable | 0 | 7 files in 15 notes (`imports.test.ts` 6, `network.test.ts` 3, `scaffold.test.ts` 3, `lane-camera-stub.test.ts` 3) | **SECURITY / ARCHITECTURE: keep as is.** Only the 19 LIST sites: turn the "these are the files" lists into the rule of row 3 |
| server per-folder `__tests__/static*.test.ts` | 511 / 28 | per module: no clock, no console, no raw SQL outside the store, the principal is only handed on, imports are these units | 0 (2 real catches in 06) | 7 files resolved in 26 notes; `capture/__tests__/static.test.ts` alone in 19 notes | **keep the rules; turn the lists into rules.** 269 sites are rules; 81 LIST + 36 COUNT + 2 DIGEST sites are where the notes say "pin moved" |
| "the scan reads exactly these files" | 83 / 74 | that a scan is not empty and not narrowed by a filter bug | 1 (`pending-control.test.tsx`, a list of users) + `summary-live-static.test.ts` in 06 | yes (`summary-live-static` 3 notes, `live-evidence-static` 4) | **keep but turn the list into a rule:** `scan(folder)` equals an independent directory walk filtered by `isProductionSource`, and has at least one file; the positive-control test beside it already proves the patterns find what they look for |
| allow-lists of importers / callers ("X is imported by these files only", "the only file that spawns") | 13 server + 7 web + 2 mobile + 4 shared sites in source-reading files | architecture: one door for a process, a key store, a network module | 0 | `capture/__tests__/static.test.ts`, `credential-store/__tests__/static.test.ts` (3) | **SECURITY / ARCHITECTURE: keep as is** (the list IS the rule: a new member must be a decision) |
| allow-list of keys of a log line (`commands.db.test.ts:735`, SR-48) | 1 | no argument of a command in the engine log | 1 (09 RED 3) | 2 notes | **keep but turn the list into a rule:** every extra key must be a boolean, a number or a member of a declared id set; a new boolean flag then passes |
| exact sequence of audit rows in the acceptance journeys (`pairing-lifecycle.test.ts`, `rbac-matrix.test.ts`, `contract.test.ts`) | 140 / 7 in `test/acceptance` | the audit trail of a journey, actor and device per row; the RBAC matrix; the contract | 2 (09 RED 1, 2) | `contract.test.ts` 6, `rbac-matrix.test.ts` 5 | **SECURITY: keep as is (PROTECTED).** These reds are the price of the protection: the behaviour changed on purpose and the trail must be re-read by a person |
| totals of the contract (`api-registry.test.ts:492` 67 audit types, 97 operations, `openapi.test.ts`, `contract-inventory.test.ts`) | shared `api-*` + `openapi` 461 / 19; inventory 40 / 1 | the contract's size is a decision | 0 | `openapi.test.ts` 4, `contract-inventory.test.ts` 3, `api-state-slices.test.ts` 3 | **keep as is (PROTECTED)** |
| parity of a fixture with the simulator (`audit-details.test.ts`, `sim-v2-parity.test.ts`, `i18n-vocabulary-sync.test.ts`) | 10 + 10 + 36 | two producers write the same shape | 1 (10 RED 1) | 5 + 3 notes | **keep as is:** the red was correct in substance (the fixture lagged the simulator); it is a rule, not a list |
| schema stamp per db file | 24 / 24 | the file's clone is at the version the file was written for | 0 | `session-capture.db.test.ts` 2, `stt-states.db.test.ts` 2 | **pure change-detector, candidate to delete outside the protected folders (17):** every schema set makes all of them move; covered by `test/db/migrate.db.test.ts:105-106` |
| frozen at a commit / one digest (mobile `*-live-static.test.ts` "the copy of Simulated mode is as it was at `acaff20`: 44 texts, one digest"; `live-network-time.test.tsx:190` "the production files are the 14 of `acaff20`"; server `capture/__tests__/static.test.ts:478`, `:562` "every added line is a waived one") | 12 / 10 | the fence of ONE finished plan row ("this row adds tests only", "Simulated copy untouched") | 0 | `live-evidence-static` 4, `capture/static` 19 | **pure change-detector of a closed row: candidate to delete, on the controller's ruling.** No other test asserts "unchanged since `acaff20`", so I do not call them redundant: the question is whether the fence is still wanted |
| "N texts / keys / files" | 33 / 15 | the size of a copy tree or of a namespace list (`i18n.test.ts:93` "exactly 15 namespace files") | 0 | `i18n-vocabulary-sync` 3 | **keep but turn the count into a rule** where a rule exists ("one en key per file", "every key of the tree is used"); delete only with the frozen-commit family |
| list of feature folders / registry keys (`navigation-units.test.ts:199`) | 1 | every feature folder with a screen registers its i18n tree | 1 (10 RED 2) | 0 | **already a rule with three named extras; make the extras derive from the folder** (a folder that exports `*-i18n.ts` registers it) |
| positive controls | 443 by title | that a pattern finds a planted text | 0 | 0 | **keep as is:** they are what makes a "no file does X" rule trustworthy |

## 5. Run time

Source: `test/12_precommit_wave_m.md` (walls, slowest files) and its raw reports (per-test
durations); greps over the test files (`node collect.mjs` flags, then an aggregation shown in the
session).

### 5.1 Where the wall time goes

Sequential walls of run 12: shared 5 s, capture-protocol 1 s, core-server unit 70 s, db 243 s,
core-web 87 s, mobile 195 s, transcriber 15 s, mock-core 4 s = 620 s; the heavy checks: kill matrix
588 s, seal e2e 47 s, development e2e 17 s (test/12 rows 3 to 11).

| workspace | sum of test durations | concentration | tests of 1 s or more |
|---|---|---|---|
| shared | 17 s over 2,612 | the slowest 100 tests (3.8 %) hold half | 0 |
| server-unit | 192 s over 6,691 | the slowest 30 tests (0.4 %) hold half | 20 holding 88 s |
| server-db | 343 s over 2,443 | the slowest 26 tests (1.1 %) hold half | 35 holding 183 s |
| core-web | 499 s over 2,224 | the slowest 148 tests (6.7 %) hold half | 102 holding 209 s |
| mobile | 252 s over 2,924 (file wall 376 s: 125 s is per-file start-up, median 388 ms a file) | the slowest 236 tests (8.1 %) hold half | 16 holding 39 s |
| transcriber | 27 s over 567 | the slowest 21 tests hold half | 6 holding 8 s |

The slowest single tests (run 12):

| s | test |
|---|---|
| 32.1 x 2 | `core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts` "M4-DISC-REC-1 (c) and M4-SEC-DISC-3 ... run 1" and "run 2" |
| 12.2 | `core-server/src/transcription/__tests__/encrypted-credential.test.ts` "the engine guard of the pipeline is in the production composition" |
| 12.2 | `core-web/src/features/session-new/__tests__/wave-h-z2-countdown-sources.test.tsx` "the device list is being read again" |
| 11.5 | `mobile/src/features/session-new/wave-h-z2-countdown-sources.test.tsx` "lost: nothing is sent" |
| 10.9 x 2, 7.3 | `capture-discovery.db.test.ts` "M4-DISC-STUB-1 run 1 / run 2", "must FAIL when" |
| 10.6, 10.2 | `core-server/src/db/reset/__tests__/wave-i-a1-reset-lane.db.test.ts` (2 of its 3 tests) |
| 8.8 to 9.5 x 5 | `core-server/src/capture/adapters/local/__tests__/no-delivery.test.ts` "the real door: a generated helper that never delivers is stopped at 8 s (H-18)" |
| 6.5 | `core-web/src/features/evidence/__tests__/export-job.test.tsx` "Running with the percent of the Core" |
| 4.7 to 5.7 x 4 | `core-web/src/features/evidence/__tests__/wave-k-w-player.test.tsx` (the stall-watch cases) |

### 5.2 Real waits

`setTimeout(`, `sleep(` / `delay(` with a number, `useRealTimers`, `useFakeTimers`, `waitFor(` and
`timeout:` options, counted per file:

| workspace | files | with `setTimeout(` | `sleep/delay(N)` | `useRealTimers` | `useFakeTimers` | `waitFor(` | a `timeout:` of 2,000 ms or more | summed wall of files with a real wait and no fake timers | share of the workspace's file time |
|---|---|---|---|---|---|---|---|---|---|
| shared | 121 | 5 | 0 | 7 | 7 | 1 | 0 | 0.0 s | 0 % |
| server-unit | 356 | 24 | 5 | 5 | 5 | 6 | 4 | 58.7 s | 38 % |
| server-db | 196 | 16 | 18 | 1 | 1 | 2 | 2 | 184.2 s | 54 % |
| core-web | 182 | 41 | 0 | 12 | 11 | 116 | 72 | 237.0 s | 48 % |
| mobile | 311 | 78 | 1 | 47 | 45 | 8 | 0 | 158.9 s | 42 % |
| transcriber | 20 | 0 | 3 | 0 | 0 | 0 | 0 | 7.5 s | 28 % |
| mock-core | 4 | 2 | 0 | 0 | 0 | 0 | 0 | 5.7 s | 100 % |

The files where the wait is the test's own sleep, with the literal:

| file | tests | s | the wait |
|---|---|---|---|
| `core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts` | 16 | 101.3 | `await delay(3_400)` at `:445`, `:518`, `:544`, `delay(3_300)` at `:684`: "One whole search through the route with the REAL adapter and the system timers: about three seconds" (`:435`); six tests hold 97.5 s, two of them "run 1" / "run 2" of the same case |
| `core-web/src/features/evidence/__tests__/wave-k-w-player.test.tsx` | 29 | 38.5 | `past(STALL_CHECK_MS)` at `:568`, `past(STALL_CHECK_MS + 300)` at `:651`: the product's 4 s stall watch on the real clock |
| `core-web/src/features/evidence/__tests__/export-job.test.tsx` | 22 | 27.3 | `setTimeout` 600 ms x 3, `timeout: 15000` |
| `core-web/src/features/session-new/__tests__/wave-h-z2-countdown-sources.test.tsx` | 3 | 20.5 | `wait(COUNTDOWN_MS + 500)` at `:74`, `:86`, `:102`: the real 3-2-1 countdown |
| `mobile/src/features/session-new/wave-h-z2-countdown-sources.test.tsx` | 2 | 18.8 | the same countdown on the real clock |
| `core-web/src/test/live-session-new-local-notice.test.tsx` | 13 | 17.7 | 3,600 ms x 2 |
| `core-server/test/acceptance/contract.test.ts` | 38 | 12.4 | one 3,400 ms search window (PROTECTED file) |
| `core-server/src/capture/adapters/local/__tests__/no-delivery.test.ts` | 17 | 9.5 (file) | five tests of about 9 s each run in parallel inside the file: the real 8 s stop |
| `core-server/src/capture/__tests__/ipc.test.ts` | 16 | 9.0 | 500 / 500 / 1,500 / 2,600 / 700 ms |
| `core-server/src/modules/capture-discovery/__tests__/wave-i-a2-adopt-assign.db.test.ts`, `lane-camera-stub.db.test.ts` | 4, 2 | 7.4, 7.4 | 3,400 ms each |

### 5.3 Database files

`db` files: 196; 192 call `useTestDatabase(`; 86 call `.another(` (a further clone) at 184 sites;
30 build an application (`buildApp(`, 32 sites). Median time per test: 141 ms in the files with
`.another(`, 29 ms in the others; the 86 files hold 177 s of the 344 s summed file time. Files with
more clone sites than tests: 3. Most clones per file: `engine/__tests__/restart.db.test.ts` 16 for
27 tests (6.2 s), `db/reset/__tests__/reset-failures.db.test.ts` 9 for 54 tests (24.8 s),
`engine/__tests__/clock-floor.db.test.ts` 7 for 13 tests. (Counted as call SITES by grep; a site
inside a helper called per case clones once per case, which this count cannot see.)

### 5.4 The mobile open handles

test/12 (section "Mobile: worker failed to exit") found 6 open `Timeout` handles, all from
`apps/mobile/src/features/evidence/transcript-follows-revision.test.tsx`: the garbage-collection
timers of TanStack Query. By reading:

- That file mounts `RuntimeTestProviders` (`:17`) and seeds the client with `setQueryData` (`:25`,
  `:26`). `RuntimeTestProviders` (`apps/mobile/src/runtime/testing/test-sim.tsx:122`) renders
  `AppProviders` without a `queryClient`, so `app-providers.tsx:86` calls `createAppQueryClient()`
  (`:20-22`: `new QueryClient()`, default `gcTime` five minutes).
- Test files that reach that default client (`grep -rlE "AppProviders|RuntimeTestProviders|renderWithRuntime|createAppQueryClient"`
  over `apps/mobile/src` test files): **68**.
- Test files that construct a client themselves without `gcTime` (`grep -rn "new QueryClient(" ... | grep -v gcTime`):
  **4** (`features/home/home-screen.test.tsx:51`, `features/home/stack-proof-source.test.tsx:44`,
  `navigation/__tests__/back-guard-busy.test.tsx:50`, `navigation/__tests__/back-guard.test.tsx:35`).
  The 23 harness / bed files under `testing/` all set `gcTime: Infinity` (no timer).
- core-web: 76 constructions without `gcTime` in 69 test files; vitest reported no leak (not
  measured further).

Proven: one file leaks (test/12). Exposed by reading: 68 + 4. Whether any of the other 71 leaves a
timer depends on whether a query still holds data when the tree unmounts; not measured (it needs
`--detectOpenHandles` on the rest of `src`, which executes tests).

### 5.5 The flaky `integration-d1b.db.test.ts`

Cause as far as reading shows:

- `booted()` (`:109-121`) builds the application with `buildApp({ config: unitTestConfig({...}) })`
  and no timer: the word "timer" does not occur in the file (`grep -n timer`: no hit). The engine
  therefore runs on the real interval of `ENGINE_TICK_MS` = `ENGINE_INTERVAL_MS` = 50 ms
  (`packages/shared/src/sim/constants.ts:34`, `apps/core-server/src/engine/timer.ts:25`).
- Line 154: `expect(await storedSlices(owner)).toStrictEqual(withoutBootDerivedSourceFacts(server.app.engine.state()))`.
  JavaScript evaluates `await storedSlices(owner)` (a database transaction,
  `test/support/engine.ts:262`) first and `server.app.engine.state()` after it resolves. A tick
  between the two makes the engine's `health` slice (CPU, fan, the mic-level ring) one sample newer
  than the stored rows: exactly the diff of test/12 R1 ("Expected", the engine, is the newer).
  `pipeline.drain()` at `:149` comes before, so it does not close the window.
- 20 other db files inject a manual timer (`grep -rln "engineTimer\|manualTimer\|timer:"`).
  21 db files compare `storedSlices(` with `engine.state()`; four of them never name a timer:
  `capture-config/__tests__/integration-c1.db.test.ts`, `integration-d1b.db.test.ts`,
  `modules/demo/__tests__/reset-failures.db.test.ts`, `modules/evidence/__tests__/immutability.db.test.ts`.
  The other three are exposed to the same race by this reading; none was red in runs 09 to 12.

Not proven: I did not run the test. The fix belongs to the test (inject the manual timer as the 20
files do, or take the engine's state first and drain, or leave `health` out of the comparison).

## 6. What the suite did not catch

Sources: the gate and re-check reports `gateway_check/09_m4_gate.md`, `09b`, `09c`, `09d`,
`10_m5_gate.md`, `10b`, `10c`, `10d`, `10e`, `11b`, `12_m7_gate.md`, `12b`, `12c`, `12d`,
`13_m8_gate.md`, `13b`, `13c`, `13d` (the first-gate reports are included because the re-gates
carry their BLOCKER / MAJOR items). "Tests at the time" = test files that exist today and were
added before the commit that fixed the finding (`node gaps.mjs`: direct importers of the component;
and the count of test files of the feature folder). "Why it passed" quotes the report where it
says so; otherwise it is my reading and marked HYPOTHESIS.

| finding (report:line) | in one line | tests on the component at the time | why they passed anyway |
|---|---|---|---|
| G94-01 BLOCKER (`13_m8_gate.md:109`) | operation 40 never answered `LIVE_STREAM`, so the sealed player could not open through the product | yes: server `modules/evidence/__tests__/media.test.ts` (9), `routes.test.ts` (80); clients `core-web/src/features/evidence/__tests__/media-session-canary.test.tsx` and `mobile/src/features/evidence/media-session-canary.test.tsx` (the only client test files older than the fix that name `LIVE_STREAM`: `grep` over the files born before `74fd1f1`) | both sides were tested against their own half: "no non-test file of the Core writes `LIVE_STREAM`" (the report); the client tests wrote the `LIVE_STREAM` answer themselves. A scripted answer cannot show that no producer exists |
| G94-02 BLOCKER (`13_m8_gate.md:110`) | Play on a REAL item showed the app's demo picture with no "simulated" mark | no direct test of `play-sheet.tsx` (0 importers before the fix); 22 test files in `mobile/src/features/evidence` | HYPOTHESIS: the item fixtures of the folder were simulated items; no test rendered Play for an item of capture class REAL |
| G94-03 MAJOR (`:111`) | the download handed out the zip without manifest and signature | yes: `evidence-export/__tests__/export-e2e.db.test.ts` (1), `modules/evidence-export/__tests__/download.test.ts` (7), `routes.test.ts` (17) | the report: "The fix's own e2e reads the two files from the package folder (`export-e2e.db.test.ts:276-277`)": the test verified from where the Core wrote, not from what the receiver gets |
| G94-04 MAJOR (`:112`) | the audio-source band never drew for a product-sealed item | yes: web `sealed-playback.test.tsx` (10) | the report: the player read `item.audioSourceIntervals`, "the Core's item has no such member"; the test fixture carried the member (a HARNESS view) |
| G94-05 MAJOR (`:113`) | a finished export could be downloaded only from the dialog that requested it | 0 direct importers of `export-job-status.tsx` / `detail-page.tsx` before the fix; 14 test files in the folder | a missing surface, not a wrong one: no requirement test of "an EXPORTED item lists its exports" existed |
| G89-01 MAJOR (`12_m7_gate.md:247`) | the signed manifest of a REAL package carried simulator-dataset values as facts (GNSS, serial number, camera model) | yes: `sealing-host/__tests__/sealing-host.test.ts` (13), `transcript-step.test.ts` (14), `seal-e2e.db.test.ts` (3), `capture-session/__tests__/facts-fy.test.ts` (5) | HYPOTHESIS: the tests asserted the manifest's structure and signature, and the e2e verified hashes; none compared a fact of the manifest with what the host really is |
| G89-02 MAJOR (`:248`) | Reanimated "Unable to find SurfaceMountingManager" bursts from stop to Summary on tablet and phone | 6 test files in `session-summary`, 6 in `session-finalizing` | Jest runs no native mounting layer; the error exists only on a device |
| G89-03 MAJOR (`:249`) | a real Ed25519 signature labelled "simulated" / "DEMO key" on three surfaces | yes: web `verify-v2.test.tsx` (36), `efix-integrity-metadata.test.tsx` (12); mobile `evidence-detail.test.tsx` (9), `live-evidence-verify-v2.test.tsx` (4) | HYPOTHESIS: the label was asserted for simulated items (where it is right); no case rendered an item with `simulated: false` and asserted the absence of the word |
| G75-01 MAJOR (`10_m5_gate.md:151`) | in REAL capture the simulator's generator kept writing its "integrity stream" into the audit chain and the sealed package | 28 `sim-*` test files in shared (425 tests); server engine tests | the generator was correct as a simulator; nothing tested "in REAL capture the generator writes nothing" (a rule across the simulator / real-capture seam) |
| G75-02 MAJOR (`:152`) | `AUDIO_SOURCE_SWITCHED` without the sending device in SIMULATED capture | shared `sim-*` session tests | the report: "Review 74 left it 'not determined' (R74-05)": the real path was tested, the simulated one was not |
| G75-03 MAJOR (`:153`) | a recording ended by a worker crash was presented as an ordinary seal | 6 + 6 mobile test files of the two folders; 8 web `session-monitor` files | a sequence over time (fault for 100 ms, then SEALED): component tests render one state each |
| G70-02 MAJOR pending (`09_m4_gate.md:121`) | no client could assign a registered microphone outside the two selector lines | mobile `mic-limit-option.test.tsx` (3); 20 files in `capture-selector`; 10 in web `devices` | a missing way in; the tests covered what the sheet offers |
| G70b-01 MAJOR (`09b_m4_regate.md:173`) | a camera adopted through operation 96 was refused by the selector until the Core restarted | yes, and the report names it: "`capture-discovery.db.test.ts:593` assigns an adopted camera and gets 200 - in a test server, so the booted-lane path is not covered" | the adapter registry filled its device map at boot only; the test server was composed differently from a booted lane |
| G70c-01 MAJOR (`09c_m4_recheck.md:94`) | tablet Home and Session New kept naming the camera a track had before | 15 test files in `mobile/src/features/dashboard` | the report's hypothesis: the store still held the selector snapshot of the last SEALED session; a test store starts empty, so a state left by an earlier session is never there |
| G75b-01 MAJOR (`10b_m5_regate.md:173`) | a real-capture session could not be sealed on the lane and the lane could not be restored (session key) | yes: `sealing-host/__tests__/sealing-host.test.ts` (13), `wave-h-a-session-key-no-reuse.test.ts` (5), `db/reset/__tests__/session-artefacts.test.ts` (7) | a state across runs of a lane (a key left by an earlier reset); each test starts from a clean data directory |
| G75b-02 MAJOR (`:174`) | a blocked seal was not stated on the session surfaces | 7 test files in `session-finalizing` | the surfaces had no blocked state to render; and `10c:47`: afterwards "proven by component tests only: NOT PROVEN LIVE" until a rig existed |
| G75c-01 MAJOR (`10c_m5_regate.md:232`) | the restart fault of a Core in its own capture was never cleared | yes: `engine/__tests__/rehydrate.test.ts` (27), `pass-j-core-not-running.test.ts` (4), `wave-i-a2-graceful-restart.test.ts` (4) | the tests proved the fault is RAISED at a restart; the end of its life (the session it belongs to ends) was a later event no test drove |
| G81b-03 MAJOR (`11b_m6_regate.md:264`) | on the tablet Session Summary "Done", "View in Evidence" and the "Sealed files" rows did not answer a tap | 9 test files in `session-summary` (55 tests) | the report: the buttons lay outside the pane's own box "where Android delivers no touch"; the test renderer has no layout and delivers a press to any element |
| G89b-01 MAJOR (`12c_m7_recheck.md:93`) | the manifest's `tracks[].profile` stated a format the files did not have | yes: sealing-host tests; `wave-k-s1-stream-profile.test.ts` came with the fix | the test doubles feed no real stream (`implementation/144_fix_wave_k_kr.md:60`: "the in-memory test double, not what a lane records from"); only reading the init segment of a real file shows it |
| G94b-01 MAJOR (`13b_m8_regate.md:156`) | tablet sealed player: no seek reached its target | 26 test files in `mobile/src/features/evidence`; 0 direct importers of `sealed-player.tsx` | `expo-video` is replaced by a mock in `apps/mobile/jest.setup.ts:69`; a seek on a mock moves a number |
| G94b-02 / G94c-01 MAJOR (`13b:157`, `13c_m8_recheck.md:95-140`) | web tamper demonstration: the altered file was a black tile with no word | yes: `wave-k-w-player.test.tsx` (29 today) | `implementation/141_fix_wave_k_w.md:93`: "NOT PROVEN (jsdom has no media stack)"; the element never reported an error in a real browser (`readyState 0`, `networkState 2`), a state the test's fake element did not produce |
| G94d-01 must-fix (D236) | the stall watch was cancelled when playback ended inside its 4 s | yes: the same file | a real `timeupdate` with `readyState 0`; the fake element's events are the ones the test wrote |
| M-S2 (D237) | a camera adopted during a run read `UNREACHABLE` at the next pre-check | yes: `capture-notices/__tests__/notices.test.ts` (23), `probe-wiring.test.ts` (4), `session-start.test.ts` (15) | D237: "no gate had met it because every adoption at a gate was followed by a lane restart before a pre-check"; the unit kept the first probe it got, and each test builds the unit after its devices exist |

The pattern (what changes the protected set):

1. **Order and lifetime on a booted Core** (G70b-01, G75b-01, G75c-01, G70c-01, M-S2): a snapshot
   taken at boot, a state left by an earlier session or reset. Unit and db tests compose a fresh
   world per case. Tests worth having: scenario tests on ONE booted application that do things in
   the gate's order (adopt, then assign; seal, then restart, then read; session, then the next
   session). `seal-e2e`, `development-session-e2e`, `restart.db.test.ts`,
   `wave-i-a2-adopt-assign.db.test.ts` and `wave-k-s1-restart-fault.db.test.ts` are of this kind:
   they belong in the protected set.
2. **A producer that does not exist / a member the Core does not send** (G94-01, G94-04, G94-03):
   client tests scripted answers. Tests worth having: the contract-example tests and the fake
   transport's contract check (it produced the 39 correct reds of test/05). Protected.
3. **The platform** (G94b-02, G94c-01, G94d-01, G94b-01, G81b-03, G89-02): media stack, layout,
   touch, native mounting. No jsdom or Jest test sees these; more of them adds size, not safety.
   The proof was a browser or a device each time. What is worth keeping in the suite is the
   STATE MACHINE around the platform (the stall watch's decisions), written against recorded real
   event sequences.
4. **A true statement in the wrong mode** (G75-01, G89-01, G89-03, G94-02): simulator values or
   labels on REAL items. Tests worth having: the "REAL capture states only facts" rules
   (`wave-h-a-manifest-facts.test.ts`, `wave-h-a-no-invented-rows.db.test.ts`,
   `wave-h-a-facts-removal.test.ts`, `real-core-words`-type tests). Protected.

## 7. The consolidation plan

One owner per workspace; core-server may be given to two owners split by vitest project (the files
are disjoint: `*.db.test.ts` + `test/acceptance/**` against the rest), with ONE writer for
`apps/core-server/test/support/**`, `test/helpers/**` and `test/static/scan.ts`. No file appears
under two owners. Estimates of "tests before -> after" are counts of run 12; times are estimates
(section 8 says how uncertain).

### 7.0 PROTECTED

May be MERGED by file for readability; no assertion is dropped, no case is parametrised away, no
real wait is shortened without the owner showing the same assertion still fails on the mutation.
Measured by glob (`rt.json`, a regular expression of these paths): about 196 files, 2,983 tests
(a file can sit in two lines).

| what | globs | files | tests | per-wave family files inside |
|---|---|---|---|---|
| sealing | `apps/core-server/src/sealing/**`, `src/modules/sealing/**` | 23 | 305 | 4 |
| sealing-host, session keys | `apps/core-server/src/sealing-host/**`, `**/*session-key*` | 16 | 139 | 9 |
| evidence-verify | `apps/core-server/src/evidence-verify/**`, `packages/shared/test/evidence-verify*.test.ts`, `packages/shared/test/evidence-package*.test.ts`, `**/*verify-v2*`, `**/live-evidence-verify*` | 24 | 295 | 4 |
| evidence-export | `apps/core-server/src/evidence-export/**`, `src/modules/evidence-export/**`, `**/export-e2e*`, `**/export-restart*` | 15 | 120 | 1 |
| media-stream (tamper stop) | `apps/core-server/src/modules/media-stream/**`, `src/media-stream/**`; and the stall-watch cases of `apps/core-web/src/features/evidence/__tests__/wave-k-w-player.test.tsx` | 9 + 1 | 144 + 29 | 3 + 1 |
| audit chain | `apps/core-server/src/modules/security-audit/__tests__/{chain,stored-chain}*`, `test/db/audit-guards.db.test.ts`, `test/static/audit-protection.test.ts`, `packages/shared/test/hash.test.ts` | 8 | 177 | 0 |
| capture fence, REAL_PRODUCTION refusals | `apps/core-server/src/capture/fence/**` | 9 | 129 | 2 |
| RBAC matrix + acceptance | `apps/core-server/test/acceptance/**`, `src/plugins/permission-guard/**` | 7 + 12 | 140 + 262 | 0 |
| contract examples, registry and OpenAPI totals | `packages/shared/test/api-*.test.ts`, `packages/shared/test/openapi.test.ts`, `apps/core-server/test/db/contract-inventory.test.ts`; every test that names an `*EXAMPLE*` constant (section 3 d) | 19 + 1 | 461 + 40 | 2 |
| kill matrix | `apps/core-server/src/sealing/__tests__/kill-matrix/**` | 2 | 10 (+35 cells) | 0 |
| seal / development e2e and the booted-order scenarios (section 6, point 1) | `apps/core-server/src/**/__tests__/e2e/**`, `src/engine/__tests__/restart.db.test.ts`, `test/acceptance/restart.test.ts`, `**/wave-i-a2-adopt-assign.db.test.ts`, `**/wave-k-s1-restart-fault*.test.ts`, `**/wave-i-a2-graceful-restart*.test.ts` | 2 + 7 | 7 + 61 | 5 |
| security static rules | `apps/core-server/test/static/**`, `apps/core-server/src/credential-store/**`, `**/*credential*.test.ts`, `packages/shared/test/*platform-neutral*.test.ts`, `packages/shared/test/redaction*.test.ts` | 15 + 13 + 6 + 3 | 171 + 208 + 80 + 74 | 0 |
| privacy rules for local devices | `apps/core-server/src/capture/adapters/local/**`, `**/*local-source*`, `**/*local-notice*`, `**/open-local-sources*` | 18 | 260 | 0 |
| "REAL capture states only facts" (section 6, point 4) | `**/wave-h-a-manifest-facts*`, `**/wave-h-a-no-invented-rows*`, `**/wave-h-a-facts-removal*`, `**/wave-h-a-camera-end*`, `**/*real-core*` | 6 | 86 | 6 |

26 of the 165 family files (224 tests) are inside protected globs (23 of them server-unit): they
are merged by file, case for case, with their titles kept.

### 7.1 core-server (owner SV-U for the unit project, SV-D for the db project)

Ordered by value.

| # | action | files | tests before -> after | the covering test that remains | risk | proof |
|---|---|---|---|---|---|---|
| SV-D1 | FIX flake | `src/modules/capture-config/__tests__/integration-d1b.db.test.ts`; the same pattern in `integration-c1.db.test.ts`, `modules/demo/__tests__/reset-failures.db.test.ts`, `modules/evidence/__tests__/immutability.db.test.ts` | 4 + 5 + 15 + 8 -> the same | the same tests, on the manual timer the other 20 db files inject | low | 20 runs of the file alone under `--maxWorkers=2` with a busy host: 0 red; mutation: drop the `pipeline.drain()` before the comparison -> red |
| SV-D2 | FIX slow file (real 3 s search windows) | `src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts` (16 tests, 101 s); `wave-i-a2-adopt-assign.db.test.ts`, `lane-camera-stub.db.test.ts` (7.4 s each) | 16 -> 16 | every case stays; ONE case of M4-DISC-STUB-1 keeps the real adapter on the system timers, the others drive the window through the clock the file already has (`server.clock.advance`, `:426`) | medium: the hostile-answer cases (M4-SEC-DISC-2, -3) are security tests; only the clock changes | per case: the same mutation as before goes red (a hostile answer admitted; a search started while RECORDING touching the capture path); file under 20 s |
| SV-U1 | REPLACE list-pins by one rule | the 43 server files of the "scan reads exactly these files" family (47 tests): the per-folder `__tests__/static*.test.ts`, `mic-static.test.ts`, `muxer-safety.test.ts` and others (list: `pins.json`, kind `list`, titles of section 4.1 row 1) | 47 -> 47 (the test stays, its body becomes the rule) | rule R1 in `test/static/scan.ts`: `expectScanCovers(root, files)` = the scanned paths equal an independent `readdirSync` walk filtered by `isProductionSource`, and are not empty | low | mutation per file: narrow the scan's filter so that one file is skipped -> red; add a new production file -> green (today: red) |
| SV-U2 | MERGE per-wave files into their homes | 41 unit files (343 tests): pairs of section 3 c, table **server-unit**; 5 without a home by import are read by the owner | 343 -> 343; files 356 -> about 315 | the cases themselves, moved under a `describe` that keeps the finding id (for example `describe('G75c-01 ...')`) | low; 23 files are protected: case for case | counts before / after per home file; each home file run green; `git diff --stat` shows only moves (the body hash of every `it` is unchanged: `collect.mjs` `exact` hash before and after) |
| SV-D3 | MERGE per-wave db files into their homes | 16 db files (44 tests): section 3 c, table **server-db** | 44 -> 44; files 196 -> about 180 | as SV-U2 | low; a db home file must not gain a second `useTestDatabase` | as SV-U2; and the db file count of clones per file is unchanged |
| SV-D4 | DELETE schema stamps outside protected folders | 17 tests in 17 db files (list in the session: `fact-doors.db.test.ts:27`, `fault-key.db.test.ts:27`, `session-capture.db.test.ts:284`, `integration-c1`, `integration-d1b`, `capture-discovery.db.test.ts:167`, `session-expiry.db.test.ts:99`, `recording-fragments`, `volume-at-boot`, `audio-intervals`, `transcript-chunks`, `transcript-routes`, `transcripts.db.test.ts:164`, `snapshot-store`, `store-root`, `connect.db.test.ts`, `integration-d4`) | 17 -> 0 (the 6 in protected folders stay) | `test/db/migrate.db.test.ts:105-106` (`schema_meta` equals `{ schema_version: 6, contract_revision: 'dbc-7' }` after the migrations); the clones of every db file come from the templates that `test/global-setup.db.ts` builds through `test/helpers/db` (the owner confirms that the templates are built by the same migrations before deleting; I did not trace it) | low; `transcript-chunks.db.test.ts:64` names "schema version 4 / dbc-5": the owner reads what it asserts before deleting | mutation: set `DB_SCHEMA_VERSION` to 7 in `src/db/schema/meta.ts` without a migration -> `migrate.db.test.ts:106` red |
| SV-U3 | FIX slow unit file | `src/capture/adapters/local/__tests__/no-delivery.test.ts`: five tests of 8.8 to 9.5 s on the real 8 s stop | 17 -> 17 | "positive: the real program" and its "control" keep the real clock (PROTECTED: local devices); the camera / microphone outcome cases take the injected timer if the door accepts one (owner to read; unknown to me) | medium (protected glob): do it only if the timer is already injectable; otherwise KEEP | mutation: the 8 s stop removed -> the real-clock case red |
| SV-U4 | PARAMETRISE the identical per-folder rules | the 24 identical-body clusters of section 3 b in `src/modules/*/__tests__/static.test.ts` (for example "no file reads the system time", `alerts:38`, `network-time:36`, `storage:33`, `system:39`) | about 60 blocks -> the same number of cases, generated from one table `test/static/module-rules.ts` | the same assertions per folder, one source of the rule text | medium: the per-folder files are named in 26 notes; do this AFTER SV-U1 and only for the bodies that are identical today | per folder: plant the forbidden text in a copy of one file -> red for that folder only |
| SV-U5 | REPLACE the allow-list of log keys by a rule | `src/engine/__tests__/commands.db.test.ts:735-741` | 1 -> 1 | the same test: a key outside the list must hold a boolean, a number or an id of a declared set; a string or an object is refused | low | mutation: log `{ args }` of a command -> red; add a boolean flag -> green (today: red, 09 RED 3) |
| SV-K | KEEP | everything in 7.0; `test/acceptance/**` sequence pins; `db/fixtures/__tests__/audit-details.test.ts` parity; all positive controls | - | - | - | - |

### 7.2 core-web (owner W)

| # | action | files | tests before -> after | the covering test that remains | risk | proof |
|---|---|---|---|---|---|---|
| W1 | FIX slow real-timer files | `features/session-new/__tests__/wave-h-z2-countdown-sources.test.tsx` (3 tests, 20.5 s), `test/live-session-new-local-notice.test.tsx` (13, 17.7 s), `features/evidence/__tests__/export-job.test.tsx` (22, 27.3 s) | the same counts | the same cases on fake timers (`vi.useFakeTimers` is already used by 11 web files); the countdown keeps ONE real-clock case | low to medium (a fake clock under `waitFor` needs `advanceTimers`) | each case: remove the fix it was written for -> red (the countdown's "sources known" gate of wave H Z2; the local-source notice; the export poll never going backwards) |
| W2 | KEEP on the real clock, MERGE by file only | `features/evidence/__tests__/wave-k-w-player.test.tsx` (29 tests, 38.5 s; the stall watch, G94c-01, G94d-01) into a feature-named `sealed-player.test.tsx` | 29 -> 29 | itself (PROTECTED: section 6 shows this state machine is where the browser defect was) | low (rename by merge; no home file exists yet: the file becomes the home) | body hashes unchanged |
| W3 | MERGE per-wave files into their homes | 30 files (299 tests): section 3 c, table **core-web** (`wave-*` 20, `copy-round-*` 4, `fxr-*` 3, `pass-j` 1, `live-row87-verify-v2` 1, `devices-gate70-minors` 1); 3 without a home by import | 299 -> 299; files 182 -> about 153 | the cases, under a `describe` with the finding id | low | body hashes unchanged; counts per home file |
| W4 | REPLACE list-pins by one rule; collapse the identical static blocks | the 14 `src/test/live-*.test.tsx` files with a static block: 19 "reads the files it means to read" tests; the 7 copies of "MD-6, TS-15: no file loads the typed client or the Live source ..." (`live-dashboard-page.test.tsx:221`, `live-evidence-archive.test.tsx:282`, `live-login-model.test.tsx:252`, `live-network-time-page.test.tsx:240`, `live-security-audit-page.test.tsx:350`, `live-storage-page.test.tsx:260`, `live-system-settings.test.tsx:289`) | 26 -> about 9 (one rule file `src/test/live-static-rules.test.ts`: the rule once per feature folder from a table, the scan-coverage rule once) | the rule file: MD-6 / TS-15 over every feature folder, failure message naming file and line | medium: the per-page files lose their static block; the rule must cover at least the folders the 7 blocks cover today (compare the scanned path sets before and after) | mutation: import the typed client in one page file -> the rule red, naming the file |
| W5 | KEEP | the 6 `live-X` / `X` pairs (91 + 70 tests): no identical or near-identical body between them (section 3 b); the LB-10 "429 limit toast" cases repeated per page (titles 14 and 21 of section 3 a: one behaviour per page, each page has its own call site) | - | - | - | - |
| W6 | optional | one `testQueryClient()` helper for the 76 constructions without `gcTime` in 69 files | none | - | low | no symptom today; do only if a leak is shown |

### 7.3 mobile (owner M)

| # | action | files | tests before -> after | the covering test that remains | risk | proof |
|---|---|---|---|---|---|---|
| M1 | FIX leak | `src/runtime/testing/test-sim.tsx:122` (`RuntimeTestProviders` hands `AppProviders` a client with `gcTime: Infinity`, as the 23 harness files do) and the 4 direct constructions (section 5.4) | none | every test of the 68 + 4 files, unchanged | low (test support only; `app-providers.tsx` is product and is not touched) | `npx -w apps/mobile jest --detectOpenHandles src/features/evidence/transcript-follows-revision.test.tsx`: 0 open handles (6 today); the whole run no longer prints "A worker process has failed to exit gracefully" |
| M2 | FIX slow real-timer file | `src/features/session-new/wave-h-z2-countdown-sources.test.tsx` (2 tests, 18.8 s); then `features/evidence/evidence-detail.test.tsx` (9, 11.0 s), read by the owner | the same | the same cases on Jest fake timers (45 mobile files use them) | low | the countdown case: remove the "sources known" gate -> red |
| M3 | MERGE per-wave files into their homes | 57 files (472 tests): section 3 c, table **mobile**; 6 without a home by import | 472 -> 472; files 311 -> about 256 | the cases | low; keep a merged file readable (the largest mobile test file today is 1,312 lines, `features/pairing/pairing-live.test.tsx`) | body hashes unchanged; saves about 388 ms of start-up per removed file (section 5.1) |
| M4 | REPLACE list-pins by one rule | the 16 "reads the folder: every production file" tests of the `*-live-static.test.ts` / `*-static.test.ts` files; `src/runtime/pending-control.test.tsx:111` (list of callers); `src/navigation/__tests__/navigation-units.test.ts:199` (three named extras) | 18 -> 18 | rule R1 (scan equals an independent walk, not empty) in a mobile `testing/static-scan.ts`; `pending-control`: "every file that names `busyState` / `PendingSpinner` imports it from `@/runtime`" (the rule the title states) instead of the list; `navigation-units`: every folder that exports an i18n tree is registered | low | mutation: import `PendingSpinner` from its own file in one screen -> red; add a new production file to a folder -> green (today: red, 06 and 09) |
| M5 | PARAMETRISE the identical static rules | the 13 `*-static.test.ts` files: "no production file calls the simulator's action hook" (8 files), "the folder names no network API ..." (3), "the LIVE wording is picked from `useCoreLink().source`" (2) | about 20 -> about 20 cases from one table, or 3 tests over all folders (owner's choice; the second removes about 17) | the rule over every feature folder | medium | plant the hook call in one folder -> red naming it |
| M6 | DELETE on the controller's ruling only | the 8 "as it was at `acaff20`: N texts, one digest" tests in 7 files and `features/network-time/live-network-time.test.tsx:190` | 9 -> 0 | NONE asserts the same thing; the row whose fence they are is closed. I do not call them redundant | to rule | - |
| M7 | KEEP | tablet / phone: 0 pairs found (section 3 e); the 6 `live-X` / `X` pairs | - | - | - | - |

### 7.4 shared (owner S)

| # | action | files | tests before -> after | the covering test that remains | risk | proof |
|---|---|---|---|---|---|---|
| S1 | MERGE per-wave files into their homes | 19 files (154 tests): section 3 c, table **shared** (`sim-wave-*` 11, `api-wave-*` 2, `sim-pass-*` 2, `integration-c1`, `integration-d1b`, `fxr-w-nits`, `sim-m5-review`); the 2 `api-wave-*` files are protected (case for case) | 154 -> 154; files 121 -> about 102 | the cases | low | body hashes unchanged |
| S2 | PARAMETRISE | the four `*-platform-neutral.test.ts` files that repeat "AC-C-02: no file names node:, react-native, expo, window or document" and "uses erasable syntax only" | about 8 blocks -> the same cases from one table (PROTECTED: no case dropped) | the rule per unit | low | plant `window` in one unit -> red for that unit |
| S3 | KEEP | `api-*`, `openapi`, `evidence-*`, `hash`, `redaction-*`, `live-*`, `realtime-*`, `i18n-vocabulary-sync` | - | - | - | - |

### 7.5 transcriber, mock-core, capture-protocol (owner T)

| # | action | files | tests before -> after | covering test | risk | proof |
|---|---|---|---|---|---|---|
| T1 | MERGE | `src/__tests__/row77-review-fixes.test.ts` (20) -> `checkpoint-runner.test.ts` (shared module `pipeline/runner.ts`); `row79-carried.test.ts` (5) -> `assembly.test.ts` (`pipeline/assembly.ts`) | 25 -> 25; files 20 -> 18 | the cases | low | body hashes unchanged |
| T2 | REPLACE list-pin by rule | `src/__tests__/static.test.ts:60` "scans the production files of the workspace: the list is pinned, so an empty scan cannot pass" | 1 -> 1 | rule R1 | low | narrow the scan -> red |
| T3 | KEEP | the rest; `apps/mock-core/test/**` (4 files, 19 tests); `packages/capture-protocol/test/protocol.test.ts` (31) | - | - | - | - |

### 7.6 Order across workspaces, by value

1. M1 (the leak warning of every mobile run), SV-D1 (the one flaky test).
2. SV-D2 (the long pole of the db run), W1, M2, SV-U3 (real waits).
3. SV-U1, W4, M4, T2, SV-U5 (the list and allow-list pins: 4 of the 10 stale reds of runs 06 to
   10 - `summary-live-static`, `pending-control`, `navigation-units`, `commands.db`).
4. SV-U2, SV-D3, W3, M3, S1, T1 (165 files merged; readability; about 30 s of Jest start-up).
5. SV-D4, SV-U4, M5, S2 (stamps and identical rule bodies).
6. M6 (a ruling).

Rule for every MERGE: a move only. The owner records, per moved `it`, the normalised body hash
before and after (`collect.mjs` writes it); the set of hashes of the workspace is unchanged except
for the entries listed under DELETE / REPLACE. Rule for every DELETE: the row of the table names
the covering test and the mutation; the owner runs the mutation and pastes the red.

## 8. Numbers

Expected after the plan (files and tests are counts; times are estimates):

| workspace | files now -> after | tests now -> after | wall now -> after (estimate) | where the change comes from |
|---|---|---|---|---|
| shared | 121 -> about 100 | 2,612 -> 2,612 | 5 s -> 5 s | S1, S2 |
| capture-protocol | 1 -> 1 | 31 -> 31 | 1 s | - |
| core-server unit | 356 -> about 315 | 6,691 -> about 6,690 | 70 s -> 60 to 70 s | SV-U2; SV-U3 only if possible |
| core-server db | 196 -> about 180 | 2,443 -> about 2,426 | 243 s -> 150 to 200 s | SV-D2 (the 101 s file to under 20 s), SV-D3, SV-D4 (-17) |
| core-web | 182 -> about 150 | 2,224 -> about 2,207 | 87 s -> 70 to 80 s | W1 (about 45 s of file time on real waits), W3, W4 (-17) |
| mobile | 311 -> about 255 | 2,924 -> 2,898 to 2,924 | 195 s -> 160 to 180 s | M2 (about 17 s of file time), M3 (about 30 s of file start-up at 2 workers), M5 / M6 (-0 to -26) |
| transcriber | 20 -> 18 | 567 -> 567 | 15 s | T1 |
| mock-core | 4 -> 4 | 19 -> 19 | 4 s | - |
| **total** | **1,191 -> about 1,020 (-14 %)** | **17,511 -> about 17,450 (-0.3 %; at most about -1 % with the optional rows)** | **620 s -> 465 to 555 s (-10 to -25 %)** | |

The kill matrix (588 s), seal e2e (47 s) and development e2e (17 s) are protected and unchanged.

Honest uncertainty:

- The times are not measured. For vitest the report's per-file time is the sum of the tests
  (file wall minus test durations is 0 for every vitest workspace), so the import and set-up cost
  saved by a merge cannot be read from run 12; test/12 gives it only as a share of the whole
  (core-web: import 17 %, environment 10 %, set-up 4 %). The db estimate assumes the discovery
  window can be driven by the clock the file already advances; if the real adapter cannot take it,
  SV-D2 saves only the duplicate "run 2" cases or nothing.
- With 2 or 4 workers, removing file time from one file shortens the wall only as far as the other
  worker's load allows; I give ranges for that reason.
- Counts of pins by pattern (section 4, first table) are a classifier over titles and bodies, not a
  reading of 1,200 files. The families of section 4.1 are counted from run-12 titles and are exact
  for their patterns; whether each matched test is what the pattern means was checked by sample
  (the three tests quoted from `realtime/__tests__/static.test.ts:67`,
  `devices-live-static.test.ts:56` and `:162`, and the listing of 116 non-scan LIST titles).

What I could NOT measure:

1. **Whether two tests with different text check the same behaviour.** Text hashes and shingles see
   copies; they do not see a server route test and a client test that both depend on one rule. The
   measure for that is per-test coverage (which tests execute a line no other test executes) and
   mutation testing; both execute tests and are outside this step. Until then no test is called
   redundant here except the 17 schema stamps, which name their covering test.
2. **The mutation score of the fixes of waves H to L** (D233 point 4): not run.
3. **Per-file import cost in the vitest workspaces**, and the worker count core-web ran with.
4. **Which of the 68 + 4 exposed mobile files actually leave a timer** (one is proven).
5. **Tests added to EXISTING files per wave as run tests**: only as added `it(` lines (section 2);
   a `.each` table that grew is one line.
6. **The 15 example constants referenced by no test by name**: whether each is asserted through an
   aggregate was not traced.
7. **The resolution of every red of test/02, 05 and 06**: read in part (marked in section 4.2).
8. **Why the tests passed** for the findings marked HYPOTHESIS in section 6: the reports do not
   say, and proving it needs the test files as they were at the gate's commit.
9. **Tablet / phone duplication beyond text**: a test that renders at the default window and
   another that sets the phone window with different titles and bodies would not be found.

---
*Generated: 2026-10-11*
