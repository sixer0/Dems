# RECON-C progress - coder-execution-local (core-web + mobile M2 consumer fixes)

Row: RECON-C (controller-added reconciliation for the DEMS task-3 M2 gate).
Scope: fix ONLY the M2-attributable shape/count adaptations in `apps/core-web/**` + `apps/mobile/**` so `M2-RG-WEB`/`M2-RG-MOB` go green. No M4/M7 feature; never fake/skip/weaken.

## Status: COMPLETE

Both target suites reach exit 0. 14 files changed (+78/-63), all under the two app trees. Two STOP items reported (PrecheckCheckId pair -> rows 67/68); one out-of-file-set shared error noted (RECON-A). Artifact: `implementation/62_recon_clients.md`.

## Steps

| # | Step | Status |
|---|---|---|
| 1 | Read row 47a §4.2, row 47 §9, row 48 §3, structured rows 67/68, D31/D38/D41 | done |
| 2 | Confirmed `packages/shared` typecheck exit 0 (row 47a's external blocker cleared by row 48) | done |
| 3 | Set up python3 `timeout` shim; proved invocation must be `npm run test -w @dems/<app>` (cwd=app) not `--root` | done |
| 4 | Enumerated core-web failures (bounded full run) | done |
| 5 | Enumerated mobile failures (bounded full run) | done |
| 6 | Classified every failure as shape/count-adaptation vs unbuilt-feature | done |
| 7 | Applied core-web fixes (9 files) | done |
| 8 | Applied mobile fixes (5 files) | done |
| 9 | Targeted per-file verification (both groups green) | done |
| 10 | Full `M2-RG-WEB` exit 0 (117 / 1496) | done |
| 11 | Full `M2-RG-MOB` exit 0 (194 / 1997) | done |
| 12 | Typecheck both apps: 0 errors in touched files; residuals attributed | done |
| 13 | Wrote `implementation/62_recon_clients.md` + this progress | done |

## Before -> after

- core-web: `10 failed / 107 passed` files, `16 failed / 1450 passed` tests (9 files / 15 tests real M2; shell-motion was a `--root` cwd false positive) -> **exit 0, 117 / 1496**.
- mobile: `6 failed / 188 passed` suites, `9 failed / 1988 passed` tests -> **exit 0, 194 / 1997**.

## Files changed (14)

core-web: `features/system/model.ts`; `test/sim-fetch.test.ts`; `test/live-users-roles-model.test.tsx`; `test/live-users-roles-commands.test.tsx`; `test/live-users-roles-page.test.tsx`; `test/live-security-audit-page.test.tsx`; `test/scalar-config.test.ts`; `test/live-api-reference-document.test.tsx`; `test/live-api-reference-page.test.tsx`.
mobile: `features/session-finalizing/finalizing.model.ts`; `features/session-finalizing/session-finalizing-screen.test.tsx`; `features/session-finalizing/live-finalizing.test.tsx`; `features/evidence/testing/live-evidence-bed.tsx`; `features/session-live/session-live.math.ts`.

## STOP items (gate decision, not suite failures)

- core-web `features/session-new/devices-step.tsx:27,267` - PrecheckCheckId MIC_PRIMARY/MIC_STANDBY exhaustive maps -> row 67 (D-c-3 assigns the pair to rows 67/68; correct mapping is selector design).
- mobile `features/session-new/check-icon.tsx:9` - same pair -> row 68.
- Noted out-of-set: `packages/shared/src/sim/api.ts:770` unused `state` -> RECON-A / shared lane.

## Constraints kept

Only apps/core-web + apps/mobile edited; packages/shared read-only; no git write/push; no sudo; no DB; CI/`--run`, `</dev/null`, bounded `timeout`; no assertion weakened/skipped/timeout-raised.
