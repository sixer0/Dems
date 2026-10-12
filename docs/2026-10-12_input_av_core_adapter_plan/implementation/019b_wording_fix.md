# Row 19b - wording fix for the F53 static scan

Cause: `apps/core-server/test/static/search-path.test.ts` scans production sources for the word TEMP/TEMPORARY (pattern `\bTEMP(ORARY)?\b`, case-insensitive). Row 19 wrote "Temporary host address ..." into `apps/core-server/src/db/fixtures/operations.ts`, so that file appeared as an extra place. Test, allowed list and pattern are unchanged.

## Changed lines (`apps/core-server/src/db/fixtures/operations.ts`)

| Line | Before | After |
|------|--------|-------|
| 669 | `message: 'Temporary host address added',` | `message: 'Time-limited host address added',` |
| 696 | `message: 'Temporary host address could not be removed',` | `message: 'Time-limited host address could not be removed',` |
| 706 | `message: 'Temporary host address removed',` | `message: 'Time-limited host address removed',` |

## Places checked and left unchanged

`grep -rnI "Temporary host address" apps packages` (excluding node_modules, input-av, dist):

- `apps/core-server/src/core/__tests__/writers.test.ts:301,303,304,306` - sample messages for the writer test; not compared with the fixture; `__tests__` is outside the scan. Left.
- `packages/shared/src/i18n/en/common.ts:440-442` - display labels; no test pairs them with the fixture message (`packages/shared/test/i18n-vocabulary-sync.test.ts` and `sim/vocabulary.ts` compare type names and categories only; the label for REMOVE_FAILED already differs from the fixture text). Left; packages/shared not touched.

## Checks

| Check | Command | Result line |
|-------|---------|-------------|
| Failing test file | `npx vitest run test/static/search-path.test.ts` (core-server) | `Test Files  1 passed (1)` / `Tests  4 passed (4)` |
| Fixture tests | `npx vitest run src/db/fixtures` (core-server) | `Test Files  6 passed (6)` / `Tests  182 passed (182)` |
| Typecheck | `npm run typecheck -w @dems/core-server` | `tsc --noEmit` - no errors, exit 0 |
| Shared sync tests / typecheck | not run | packages/shared not touched |
