# coder-execution - wave H, reconcile pass R

- Status: **complete** (no commit, no migration, no git write; gate environment not used)
- Note: `implementation/127_fix_wave_h_r.md`
- Decisions applied: D205 (seed-sealed demo item plays through op 88), D207 (one interrupted fact)

## Files
NEW
- `packages/shared/test/sim-evidence-item-kind.test.ts`
- `apps/core-server/src/evidence-facts/__tests__/wave-h-r-interrupted-agreement.test.ts`
- `apps/core-server/src/modules/evidence/__tests__/wave-h-r-seed-sealed.db.test.ts`

EDITED
- `packages/shared/src/api/evidence.ts` (examples only, additive) ; `packages/shared/openapi/openapi.json` (generator)
- `packages/shared/src/sim/evidence.ts` (appended block) ; `packages/shared/src/sim/capture-session.ts` (`interruptedSealOfItem` + one import, D207)
- `apps/core-server/src/media-stream/{items.ts,service.ts}` ; `apps/core-server/src/evidence-facts/index.ts`
- `apps/core-web/src/features/evidence/{item-facts.ts,use-verification.ts}` ; `__tests__/{wave-h-c2-bed.ts,wave-h-c2-media.test.tsx,wave-h-c2-transcript.test.tsx,wave-h-c2-export-playback.test.tsx}`
- `apps/mobile/src/features/evidence/{item-facts.ts,export-sheet.tsx,live-integrity-tab.tsx}` ; `testing/{live-evidence-bed.tsx,wave-h-c2-kit.tsx}` ; `wave-h-c2-{media,item-lines,transcript-access,exports-playback}.test.tsx`
- `delegation_progress/{file_claims.md,file_requests.md}` (own lines)

## Blockers
None. Foreign red seen: core-server typecheck, `src/capture-session/__tests__/session-capture.db.test.ts:1409`.
