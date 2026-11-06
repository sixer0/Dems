---
row: PT
title: Pre-commit tidy-up of W100-1 and W100-5 (mobile)
date: 2026-10-07
agent: coder-execution
status: complete
source: verification/09_security_clients.md (W100-1, W100-5); decisions/decisions.md D251, D253
scope: apps/mobile only
---

# Row PT: pre-commit tidy-up (W100-1, W100-5)

## 1. Summary

| Finding | Severity | Fix | Test | Red before | Green after |
|---|---|---|---|---|---|
| W100-1 | Low | The mobile app log now blanks credential-shaped values (`ses_…`, `dvc_…`, `bio_…` become `ses_***`, `dvc_***`, `bio_***`) in every kept text: `source`, `message`, `stack`, string context values, and a caller-supplied `correlationId`. This covers both builders, `toRuntimeLogRecord` and `fromSibling` (motion and navigation records). It uses the same regex and replacement as the web sink (`apps/core-web/src/runtime/error-sink.ts:51-56`, `/\b(ses\|dvc\|bio)_[A-Za-z0-9_-]+/g` to `'$1_***'`). Redaction runs before truncation, so a cut cannot leave the head of a credential unmatched | 2 jest cases in `log.test.ts`, describe `credential prefixes (W100-1, row PT)` | Yes: 2 failed (`Received string: "refused ses_T3stSess10n-abc for dvc_T3stDev1ce_xyz and bio_T3stB10-q_9"`) | Yes |
| W100-5 | Info | The `[DEMS-LIVE]` console line guard changed from `if (!IN_JEST)` to `if (__DEV__ && !IN_JEST)`. Metro now folds the line out of a release bundle by construction | New static test `dems-live-console-static.test.ts` (comments stripped; exactly one emitter; its `if (…)` guard contains `__DEV__ &&`) | Yes: 1 failed (`Expected pattern: /(^\|[\s&(])__DEV__\s*&&/`, `Received string: "!IN_JEST"`) | Yes |

Why the W100-5 test is static: jest runs with `__DEV__` true, so a runtime test cannot tell the two guards apart. The repo already uses static source tests, for example `src/runtime/link-notice-static.test.ts`. The existing simulator-dependent test `sim-adapters.test.ts` (one of the 61 files in D253) was **not** edited. The new assertion lives in its own file.

No behaviour change for current callers: today they pass only codes (W100 §9, `secure-credentials.ts:151-160`). The two existing log suites still pass unchanged (`log.test.ts` 7 earlier cases and `log-console.test.ts`).

## 2. Changes

| File | Change | Description |
|---|---|---|
| `apps/mobile/src/runtime/log.ts` | modify | Adds `CREDENTIAL` regex, exported `redactCredentials(text)` and a private `keepText(text, max)` (redact, then truncate). Applies them to `sanitizeLogContext` (string values), `toRuntimeLogRecord` (`source`, `message`, `stack`, `correlationId`) and `fromSibling` (`source`, `message`, `stack`; context goes through `sanitizeLogContext`). Header comment updated |
| `apps/mobile/src/runtime/sim-adapters.ts` | modify | Line 479: `if (__DEV__ && !IN_JEST) console.info(\`[DEMS-LIVE] …\`)`, plus one comment line (row PT, W100-5) |
| `apps/mobile/src/runtime/log.test.ts` | modify (+43 lines) | New describe block with 2 cases: (a) `toRuntimeLogRecord` with an `Error` whose message and stack hold `ses_`, `dvc_`, `bio_` markers, plus a string context value; (b) the same error routed through `reportMotionIssue` and `reportNavigationIssue` into the app log (`fromSibling`). Both check that neither the full marker nor its suffix survives, and that the serialised records contain no un-blanked prefix |
| `apps/mobile/src/runtime/dems-live-console-static.test.ts` | create | Static guard test for W100-5 |

Rollback copies (taken before any edit) are in `/Users/gsp-budi/Documents/DEMS/.cache/rollback/PT/`: `log.ts`, `log.test.ts`, `sim-adapters.ts`, `sim-adapters.test.ts` (the last one is unchanged, kept as a precaution). To restore, copy them back over `apps/mobile/src/runtime/` and delete `dems-live-console-static.test.ts`.

## 3. Commands and results (run in `apps/mobile`)

| Step | Command | Result |
|---|---|---|
| Red, W100-1 | `npx jest src/runtime/log.test.ts -t "credential prefixes"` (before the fix) | `Tests:       2 failed, 7 skipped, 9 total` |
| Red, W100-5 | `npx jest src/runtime/dems-live-console-static.test.ts` (before the fix) | `Tests:       1 failed, 1 total` |
| Green, targeted | `npx jest src/runtime/log.test.ts src/runtime/log-console.test.ts` | `Tests:       13 passed, 13 total` |
| Green, targeted | `npx jest src/runtime/dems-live-console-static.test.ts src/runtime/log.test.ts src/runtime/sim-adapters.test.ts` | `Test Suites: 3 passed, 3 total` / `Tests:       20 passed, 20 total` |
| Typecheck | `npx tsc --noEmit` | exit 0. No diagnostics (the only output is the sandbox's `failed to copy trust settings of system certificate` noise) |
| Lint | `npx eslint .` | exit 0. No findings (same sandbox noise only) |
| Load check | `uptime` | `load averages: 4.01 4.02 4.38` (below 14, so the suite ran) |
| Full suite | `npx jest --maxWorkers=3` | exit 0 |

Full mobile suite, verbatim:

```
Test Suites: 192 passed, 192 total
Tests:       1988 passed, 1988 total
Snapshots:   0 total
Time:        132.834 s, estimated 169 s
```

## 4. Notes

- No commits were made. Metro is running and will Fast-Refresh the devices. No device work was done or needed.
- Outside this row's scope, left as is: the motion and navigation modules' own dev-console mirrors (`motion/log.ts:25-31`, `navigation/log.ts:25-31`) print the raw record when no runtime sink is installed. They are `__DEV__` only (W100 §5.2) and are never persisted. The persisted app log is redacted.
- `timestamp` and `level` are not redacted. Both are generated values (an ISO time and a level enum), not caller text.
