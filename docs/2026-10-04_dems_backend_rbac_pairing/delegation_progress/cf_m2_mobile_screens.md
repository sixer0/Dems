---
row: CF-M2 (closing fix round CF, decision D214)
agent: coder-execution
date: 2026-10-06
status: complete (code and jest); device re-test of the tablet and phone screens pending after CF
report: gateway_check/12b_cf_mobile_screens.md
---

# CF-M2 — mobile screens: delegation progress

## Status

**complete.** All five Low defects are fixed in CF-M2's paths, with tests. Typecheck exit 0, lint exit 0, and 23 of 23 in-memory mutants were detected.

- Full mobile suite run 1: 2 failures, both in the evidence static guard, which needed the new file and keys. Fixed.
- Full mobile suite run 2: 1,856 of 1,857 tests passed. The 1 failure was a 5 s timeout in CF-M1's `pairing-handoff-routes.test.tsx`. That test passed in run 1 and passed alone 2 of 2 times.

## Milestones

| Time | Milestone |
|---|---|
| 13:44 | Rollback copies: 10 files in `.cache/rollback/CF-M2/` with `SHA256SUMS.pre.txt`; 2 more test files added before their first edit (12 in all) |
| 13:46 | R-P-3 test written first on the real route tree; red against the old code (2 failed, `/devices/CAM-01` after one Back) |
| 13:50 | R-P-3 fixed (`navigation/tab-root.ts`, Settings route rows); 16 tests green |
| 13:54 | R-T-2 fixed (stored verification, heading per state, last line, paced pin); 7 tests green |
| 13:57 | R-T-1 fixed (`MenuItemText`, detail and row menus); 3 tests green |
| 13:59 | R-T-3 fixed (Bandwidth row measures itself, stacks under 314 dp); 19 tests green with neighbours |
| 14:00 | R-T-4 fixed (expanded list min 360 dp, pane row variant); 34 sessions tests green |
| 14:01-14:03 | typecheck exit 0, lint exit 0 |
| 14:03-14:07 | Mutations: control 34/34 pass; 23 of 23 detected; tree files unchanged |
| 14:07 | Full suite run 1: static guard 2 failures; guard lists updated |
| 14:11 | Full suite run 2: 1 failure outside CF-M2's paths (pairing timeout); passes alone 2 of 2 |
| 14:20 | Final typecheck and lint exit 0; count-only secret scan 0 hits; report written |

## Files created

- `apps/mobile/src/navigation/tab-root.ts`
- `apps/mobile/src/navigation/__tests__/settings-tab-root.test.tsx`
- `apps/mobile/src/features/evidence/menu-item-text.tsx`
- `apps/mobile/src/features/evidence/evidence-more-menu-title.test.tsx`
- `apps/mobile/src/features/evidence/live-evidence-stored-verification.test.tsx`
- `apps/mobile/src/features/network-time/bandwidth-row-fit.test.tsx`
- `apps/mobile/src/features/sessions/hub-pane-row-fit.test.tsx`
- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/12b_cf_mobile_screens.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/assets/12b_cf_m2_*` (7 files: mutations log, driver, transformer, config, typecheck/lint log, two trimmed suite summaries)
- this file

## Files updated

- `apps/mobile/src/navigation/index.ts`
- `apps/mobile/src/features/settings/settings-screen.tsx`
- `apps/mobile/src/features/settings/settings-screen.test.tsx`
- `apps/mobile/src/features/evidence/evidence-detail.tsx`
- `apps/mobile/src/features/evidence/evidence-row.tsx`
- `apps/mobile/src/features/evidence/evidence-model.ts`
- `apps/mobile/src/features/evidence/live-integrity-tab.tsx`
- `apps/mobile/src/features/evidence/i18n.ts`
- `apps/mobile/src/features/evidence/live-evidence-static.test.ts`
- `apps/mobile/src/features/network-time/network-status-card.tsx`
- `apps/mobile/src/features/sessions/sessions-screen.tsx`
- `apps/mobile/src/features/sessions/session-row.tsx`

## Decisions (for `decisions/decisions.md`)

1. **R-P-3, mechanism.** Settings opens Devices, Storage and Network & Time with a `JUMP_TO` + `resetOnFocus` on the tab navigator. That is the kit's tab-trigger option. It replaces `router.push`, which stacked a second list over an open detail.
   - The navigator is found through the screen's own navigation object, not `useTabTrigger`, which throws outside a `<Navigator>` and so would break the live settings bed.
   - If no tab navigator is found, the hook logs `warn` and falls back to `router.navigate`.
   - Effect: the opened tab starts at its list, and a tablet selection in Devices is cleared.
2. **R-T-1, scope.** The list row menu's Export and Archive items had the same title-squeezing pair, so they were fixed with the same `MenuItemText` (same folder, same defect class).
3. **R-T-2, scope and pacing.**
   - Only the Live tab changed, on phone and tablet. The Simulated tab keeps the DEMO package's precomputed heading (D51).
   - During a paced run the card pins the record as it was at the start, so the replica's early delta (CL-16) cannot reveal the verdict before "Asking the Core…" and the scramble end.
   - The new copy lives in three Live-only keys.
4. **R-T-3, rule.** The Bandwidth row measures itself. Below `bandwidthInlineMinWidth`, 314 dp at font scale 1 and capped at scale 1.2, the sparkline moves under the label. Multi-pane windows start stacked before the first layout.
5. **R-T-4, layout.** The expanded Sessions list is 40% but at least 360 dp (the medium width). Pane rows get a 64 × 50 poster, a chip line that wraps between values and a one-line duration. The phone row is unchanged. The detail pane is about 348 dp at 1280 dp with the extended rail.
6. **Static guard.** `live-evidence-static.test.ts` gains `menu-item-text.tsx` in its file list and the 3 new keys in `LIVE_KEYS`. The Simulated copy is unchanged: 185 texts, same digest.

## Blockers

None in CF-M2's paths.

## Notes for the controller

- **Device re-test checklist (tablet):**
  - the More menu Archive title;
  - the Hash & Integrity heading and line on a NOT_RUN item, then after a Verify;
  - the Network & Time Bandwidth row;
  - the Sessions hub row and the 348 dp detail pane.
- **Device re-test checklist (phone):**
  - with a device detail open: Settings > Device Settings, then one Back.
- **O-CF-M2-1.** `features/evidence/export-sheet.tsx:529`: under a Core FAIL, the export source Alert still says "Verified by the Core · Core record". Not changed: it is not a re-test defect.
- **O-CF-M2-2.** `features/pairing/pairing-handoff-routes.test.tsx` (CF-M1, untracked) uses the default 5 s timeout and timed out once under load in full-suite run 2.
- Full-suite logs (21 MB each) are kept outside `/docs` at `.cache/cf_m2_mut/full_suite_run{1,2}.log`. Trimmed summaries are in `gateway_check/assets/`.
