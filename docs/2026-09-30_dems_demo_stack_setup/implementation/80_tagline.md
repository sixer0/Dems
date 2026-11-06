---
step: T1
decision: D128
agent: coder-execution
tier: 3
status: complete
date: 2026-10-01
---

# 80: Hero tagline replaced (step T1, D128)

Source change is done and tests are green as of 2026-10-01 11:33 WIB. Rebuild agents can proceed.

## Change

| | Old | New |
|---|---|---|
| Line 1 (`common.brand.heroLine1`) | `TRUSTED RECORDING` | `SECURE BY DESIGN.` |
| Line 2 (`common.brand.heroLine2`) | `FOR A SAFER TOMORROW` | `TRUSTED BY LAW.` |

Files edited (3, nothing else touched):

| File | Lines | What |
|---|---|---|
| `packages/shared/src/i18n/en/common.ts` | 16-17 | the two strings (single source) |
| `apps/core-web/src/features/login/__tests__/login-page.test.tsx` | 182-183 | the two assertions |
| `apps/core-web/src/features/login/index.tsx` | 9 | header comment only |

The strings render in two places, both from the shared keys, so no component changed: the web Login brand panel (`apps/core-web/src/features/login/brand-panel.tsx:240-241`; at 768-1023 px it joins them as `SECURE BY DESIGN. TRUSTED BY LAW.`) and the web Dashboard hero (`apps/core-web/src/features/dashboard/hero-panel.tsx:137`).

Unchanged: the supporting sentence, RECORD / PRESERVE / PROTECT, `common.brand.tagline`, `common.brand.overline`, `common.brand.triplet`.

## Findings

- The mobile app does not render the hero lines. `heroLine1/2` have no reference under `apps/mobile/src`; the mobile Login shows `common.brand.tagline` (`login-brand.tsx:124`) and `common.brand.triplet` (`login-screen.tsx:118`). The APK therefore shows no visible tagline change from this step.
- `common.brand.triplet` still reads `SECURE RECORDING / TRUSTED EVIDENCE / SAFER COMMUNITIES` (`common.ts:23`). It is a different string and was out of scope; left as is.
- `README.md` did not contain the old tagline; not edited. `release/**` not touched.
- No aria-label, alt text or document title carried the old words (the Dashboard hero's `ariaLabel` uses `common.brand.tagline`).

## Evidence

Grep after the change (`/usr/bin/grep -rIn -i -E "trusted recording|safer tomorrow" apps packages README.md`, minus `node_modules`, `/dist/`, `/android/`, `/.cache/`): 0 hits.

| Check | Command (in the workspace dir) | Result |
|---|---|---|
| shared i18n tests | `npx vitest run test/i18n.test.ts test/i18n-vocabulary-sync.test.ts test/brand-sync.test.ts` | 3 files, 63 passed |
| shared typecheck | `npx tsc --noEmit` | exit 0 |
| core-web typecheck | `npx tsc -b` | exit 0 |
| core-web lint | `npx oxlint` | exit 0 |
| core-web tests | `npx vitest run src/features/login src/features/dashboard src/test/routes.test.tsx` | 5 files, 93 passed |
| mobile typecheck | `npx tsc --noEmit` | exit 0 |
| mobile tests | `npx jest --maxWorkers=2 src/features/login src/i18n` | 3 suites, 46 passed |

Not done here, by instruction: browser and device checks (the rebuild agents smoke the packages), any server start or stop, any commit, any `package.json` edit.
