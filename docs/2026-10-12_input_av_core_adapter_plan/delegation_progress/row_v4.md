# Row V4 (agent V4, track D) - the fourth contract-and-vocabulary step

Status: **complete**; two points returned for a ruling (below). Record:
`implementation/v4_fourth_contract_step.md`.

Counts after: 110 operations (39 GET / 71 POST), 82 audit types, 51 actions - unchanged. Schema
`[11, 'dbc-12']` - no change made or needed. `openapi.json` regenerated once, at the end.

## Per item
1. `SYSTEM_BOOT` details rule admitting null; the writer enforces forms and fixed severity for
   every writer (native and prepared) - done.
2. `aliasId` optional on the two alias removal results - done.
3. Outcome entry can say "no camera was asked" (`unreachableReason`, `usableProfileCount`);
   simulator answers operation 108 with the Core's `503 DISCOVERY_NOT_READY` - done.
4. Four slot sentences in `common.captureSlotRefusal`; web copies removed (two members kept by
   reference for the panel) - done.
5. Descriptions of operations 108 and 103 - done.
6. Signed manifest member `audio.absentOnRestart` - done, OPTIONAL (the manifest had no optional
   member before; the only form that leaves sealed packages verifying as before).
7. `VERIFY_NOTICE.SIGNED_BY_COMPROMISED_KEY`, report lines, wording, result type - done. The
   receiver's INPUT of marked fingerprints and its verdict rule: NOT built.

## Files changed
- `apps/core-server/src/core/audit-details.ts`, `audit-writer.ts`, `__tests__/writers.test.ts`
- `packages/shared/src/api/capture-discovery.ts`, `capture-commissioning.ts`, `evidence.ts`
- `packages/shared/src/sim/api.ts`
- `packages/shared/src/i18n/en/common.ts`, `evidence.ts`
- `packages/shared/src/evidence-package/manifest.ts`, `build.ts`
- `packages/shared/src/evidence-verify/types.ts`
- `packages/shared/openapi/openapi.json` (the generator)
- `packages/shared/test/`: `api-capture-discovery`, `api-openapi-scope`, `api-registry`, `openapi`,
  `sim-capture-discovery`, `i18n`, `evidence-package`, `evidence-verify` (`.test.ts`)
- `apps/core-web/src/i18n-web.ts`, `features/devices/slot-refusal.ts`,
  `features/devices/__tests__/selector-microphones.test.tsx`
- docs: this file, `implementation/v4_fourth_contract_step.md`; `file_claims.md` (one line),
  `file_requests.md` (seven lines)

CLAIMED AND NOT TOUCHED: `core-api.ts`, `examples.ts`, `api/index.ts`, `state-slices.ts`,
`sim/vocabulary.ts`, `sim/types.ts`, `sim/actions`, the two acceptance files (no pin of mine lives
there).

## Pins
Operation / audit / action count pins: 0 moved. Value pins by delta: 8 files (6 shared, 1 Core,
1 web) - listed in the record, section 8.

## Closing checks
- Shared: `Test Files 105 passed (105)`, `Tests 2879 passed (2879)`
- Core unit: `Test Files 76 passed (76)`, `Tests 1556 passed (1556)`
- Core database, acceptance pair included: `Test Files 12 passed (12)`, `Tests 259 passed (259)`, `0 remain`
- Web: `Tests 647 passed (647)`; mobile: `Tests: 654 passed`
- Typecheck: exit 0 in six workspaces

## For a ruling
- Row 230: how a receiver's verifier is told the marked fingerprints, and its verdict then.
- Row 230: `SOURCE_SIGNED_BY_COMPROMISED_KEY` and the export input - not added.
- A later description step: 106b's points on operation 105 and `audit.also`; row 117's three points.

## Driver decisions
D-1 to D-8 in the record, section 10. The one to look at first: D-5 (the manifest's first optional
member).

EDIT-ONLY RULE KEPT.
