---
step: 75b
decision: D111
agent: coder-execution
tier: 3
status: complete
date: 2026-10-01
---

# 74: Mobile jest transform allowlist now covers d3-* and internmap (step 75b)

## Change

One edit, in `apps/mobile/jest.config.js` (the only file touched; ownership was handed over for this change only). In the `transformIgnorePatterns` allowlist, `|d3-.*|internmap` now comes right after `victory-native`, with a two-line D111 comment. All other entries are unchanged, `standard-navigation` included.

Why: `victory-native` 42.0.1 (`node_modules/victory-native/package.json`) depends on `d3-scale`, `d3-shape` and `d3-zoom`. Those pull in `d3-array`, `d3-color`, `d3-dispatch`, `d3-drag`, `d3-ease`, `d3-format`, `d3-interpolate`, `d3-path`, `d3-selection`, `d3-time`, `d3-time-format`, `d3-timer`, `d3-transition` and `internmap`. All 17 of these declare `"type": "module"`, and `exports.default` points to `./src/index.js` (for example d3-scale: `{umd: ./dist/d3-scale.min.js, default: ./src/index.js}`).

I checked victory-native's other dependencies and none needs transforming. `its-fine` has `main: ./dist/index.cjs` and no `exports`. `react-fast-compare` is CommonJS. `victory-vendor` belongs to `recharts` and is not in victory-native's tree, so I did not add `victory-.*`.

## Full mobile suite (`npx jest --maxWorkers=2`)

| Run | Suites failed / total | Tests failed / passed / total | d3/internmap `SyntaxError` |
|---|---|---|---|
| Before | 6 / 71 | 22 / 806 / 828 | 4 (`node_modules/d3-scale/src/index.js:1 Unexpected token 'export'`) |
| After | 6 / 71 | 21 / 807 / 828 | **0** |

Before the change, the 4 d3 parse errors were in:
- `chrome`: the phone master-detail test
- `guard`: "signs in through the Login form…"
- `routes`: `/devices`
- `routes`: `/devices/CAM-01`

After the change, the guard sign-in test passes. The other three now get past module load and fail on their placeholder assertions instead, listed below.

## Remaining failures after the change (21, none caused by d3; tests not changed)

**Step 70 stub assertions, owned by step 57 (18).** Each fails with `Unable to find an element with testID: stub-param-<name>`:
- `src/navigation/__tests__/routes.test.tsx` (11): `/sessions`, `/sessions/S-20261001-0003`, `/evidence`, `/evidence/EV-20261001-0007`, `/devices`, `/devices/CAM-01`, `/settings`, `/settings/about`, `/session/new?step=2`, `/session/summary/S-20261001-0003`, and "parses params with zod: an out-of-range step falls back to 1".
- `src/navigation/__tests__/guard.test.tsx` (5): "keeps the query of the pending href…", the three "resyncs a CREATE / PRECHECK / ARMED session…" tests, and "keeps the wizard open for its own states (ARMED on step 3)".
- `src/navigation/__tests__/chrome.test.tsx` (2): "a phone turns a selection into a pushed detail…" (`stub-param-deviceId`) and "a tablet opens a Settings section in the list pane" (`stub-param-selectedSection`).

**Other failures, not related to d3 (3).** All three were failing in the "before" run too, and they fail the same way in an isolated re-run of their three suites (3 failed, 58 passed, 61 total). This step did not determine who owns them:
- `src/features/evidence/evidence-detail.test.tsx`: "shows FAIL on AUDIO-02 for the tampered item…". `auditRowsFor(…, 'EVIDENCE_VERIFY_FAILED')` returns 1 row, but the test expects 0.
- `src/runtime/runtime.test.tsx`: the keep-awake MA-19 test. It gets `SimPermissionError: Simulator action "stopRecording" needs a signed-in operator.`
- `src/motion/haptics.test.ts`: the MA-20 scan finds `Haptics.*` references in `src/features/storage/storage-screen.test.tsx` (line 105 onward; the file was last modified 2026-10-01 10:16).

## Gates

| Check | Command (in `apps/mobile`) | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0. The only output is the sandbox's "failed to copy trust settings" certificate noise |
| Lint | `npx eslint .` | exit 0. The only output is the same certificate noise |

package.json and the lockfile were not touched, and nothing was installed or committed. The SHA-256 of `jest.config.js` after the edit starts with `442884cb39b2`.
