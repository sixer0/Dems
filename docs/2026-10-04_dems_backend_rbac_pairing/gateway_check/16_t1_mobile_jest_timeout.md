# T1 - mobile jest load-flake fix (default testTimeout)

Status: complete

## Change
File: `apps/mobile/jest.config.js` (config only; no test files touched). Added after `setupFilesAfterEnv`:

```js
  // Load flakes: 20 s per test, not jest's 5 s default, when the full suite runs loaded (D239, D246).
  testTimeout: 20000,
```

Rollback copy of the original: `.cache/rollback/T1/jest.config.js`.

## Commands and results (cwd apps/mobile)

1. Baseline on the two named files, one worker (before the change):
   `npx jest --maxWorkers=1 src/features/session-live/live-gap-s4-7-tablet-link.test.tsx src/features/session-live/live-gap-read-only-dialog.test.tsx`
   ```
   Test Suites: 2 passed, 2 total
   Tests:       2 passed, 2 total
   ```
   Both passed alone (console warnings only from react-test-renderer stack output, no failure). Failure reason in the full run is therefore load-only, consistent with the 5 s default timeout.

2. `uptime` before the full run: load averages 6.37 8.86 7.87 (threshold 14, no pause).

3. Full suite after the change: `npx jest --maxWorkers=3` (exit 0)
   ```
   Test Suites: 191 passed, 191 total
   Tests:       1985 passed, 1985 total
   Snapshots:   0 total
   Time:        199.28 s
   ```

4. `npm run typecheck` (tsc --noEmit): exit 0. `npm run lint` (eslint .): exit 0.

No commits, no servers, no emulators.
