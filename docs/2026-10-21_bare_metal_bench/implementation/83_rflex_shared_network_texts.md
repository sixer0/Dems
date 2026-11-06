# Row 137 - shared network contract texts (R2.1)
Status: complete. Descriptions only; schemas unchanged. Spec: masterplan/01_specs_rflex_api_ui.md 2.3, 2.4 (bound variant, D16 Q96-04 a).

## Changes
- packages/shared/src/api/capture-commissioning.ts: `configured` description (:393), op 101 description (:583), op 102 description (:606). `DESTINATION` constant (:559) unchanged per spec.
- packages/shared/src/api/capture-discovery.ts: op 93 typed-address text (:637), op 100 destination text (:1261). Ops 95/108 no text change.

## Evidence
`git diff --stat`: capture-commissioning.ts 3 lines, capture-discovery.ts 2 lines changed (no pre-existing diff in these files).
grep: `grep -c "on the subnet of an up interface of the host" capture-discovery.ts` -> both lines; "factory address scan (103) and the camera address change (106)" present in op 101; "decision D10 (2)" present.

## Tests
- `npx vitest run test/api-capture-commissioning.test.ts test/api-text-rule.test.ts --maxWorkers=2` (packages/shared): Test Files 2 passed (2), Tests 37 passed (37). Test files not edited.
- `npm run typecheck` (packages/shared): exit 0, no output.
