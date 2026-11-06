# Row T2 - cap the mobile jest worker count

Date: 2026-10-07. Status: needs-review (the mobile suite is green; root `npm test` still exits 1 because of one core-web test, unrelated to the mobile change).

## Change

File: `apps/mobile/jest.config.js`, one comment line and one option added directly after `testTimeout: 20000,`:

```js
  // Half the cores: with every core jest loaded the host past 20 and two wall-clock-wait tests flaked (D239, D246, D247; T2 run).
  maxWorkers: '50%',
```

Rollback copy: `.cache/rollback/T2/jest.config.js` (original, before the edit). Test files untouched. No commit.

## Preconditions

- `npm run pg:status`: `pg:status: stopped (file checks passed)` (PostgreSQL not started by this row).
- Load gate (1-minute load must be below 8, wait up to 10 min):

| Time | Reading (1 / 5 / 15 min) |
|---|---|
| 11:29 (first check) | 12.41 / 20.52 / 16.55 |
| 11:29 | 11.57 / 20.21 / 16.47 |
| 11:29:22 | 10.73 / 19.89 / 16.38 |
| 11:29 | 9.22 / 19.11 / 16.16 |
| 11:29 | 9.04 / 18.91 / 16.10 |
| 11:29 | 8.82 / 18.53 / 16.00 |
| 11:30:22 | 7.17 / 17.19 / 15.60 (gate passed) |
| 11:30 (run start) | 7.04 / 16.84 / 15.50 |
| 11:36 (run end) | 26.37 / 23.05 / 18.81 |

Note: the harness blocked a foreground `sleep 60`, so readings came from a one-minute-interval monitor loop and ad hoc `uptime` calls rather than strictly separate 60 s commands. The wall clock in this sandbox also reported minute-level values that look compressed. Treat the timestamps as approximate.

## Run: root `npm test` (sandbox off, once)

Exit code: `1` (full log: `.cache/rollback/T2/npm-test.log`).

Per-workspace count lines, verbatim:

```
@dems/shared
 Test Files  71 passed (71)
      Tests  1851 passed (1851)

@dems/core-server
 Test Files  160 passed (160)
      Tests  3954 passed (3954)

@dems/core-web
 Test Files  1 failed | 116 passed (117)
      Tests  1 failed | 1494 passed (1495)

@dems/mobile
Test Suites: 192 passed, 192 total
Tests:       1988 passed, 1988 total
Snapshots:   0 total
Time:        282.023 s, estimated 657 s

@dems/mock-core
 Test Files  4 passed (4)
      Tests  19 passed (19)
```

## Result

- Mobile: 192 suites, 1988 tests, all passed, including `live-gap-read-only-dialog.test.tsx` and `live-settings-boundary.test.tsx` (the two T2 targets). The `maxWorkers: '50%'` change achieved its goal in this run.
- The root exit code 1 comes from core-web, one failing test, not from mobile:

```
FAIL  src/test/live-paired-devices-issue.test.tsx > AC-C-92: issue shows six digits, the QR and the countdown > sends operation 15 once; the QR stub receives exactly the answer's `qrPayload`, which is the prefix plus the digits shown
AssertionError: expected [ '815', '581' ] to deeply equal [ '861', '204' ]
 ❯ src/test/live-paired-devices-issue.test.tsx:132:98
```

  The shown pairing digits (815 581) differ from the test's `MARKER_CODE` (861 204) at the digit-groups assertion. This looks like a content mismatch (marker code versus the code rendered), not a load timeout. Not investigated further and not re-run, per instruction (no looping). Observation only: `git status` shows `apps/core-web/src/test/live-paired-devices-issue.test.tsx` as modified in the working tree (uncommitted); this row did not touch it. The controller should decide whether it is a leftover edit, a real defect, or a load-sensitive flake; a single isolated re-run of that file would separate those.

## Mobile typecheck and lint (after the change)

| Command | Exit |
|---|---|
| `npm run typecheck` in `apps/mobile` (`tsc --noEmit`) | 0 |
| `npm run lint` in `apps/mobile` (`eslint .`) | 0 |

Logs: `.cache/rollback/T2/mobile-typecheck.log`, `.cache/rollback/T2/mobile-lint.log`.
