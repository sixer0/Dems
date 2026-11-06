# Integration pass I-9a - short record

Status: needs-review (8 of 11 items done; items 4, 8, 9 not done by their own condition). Record: `implementation/i09a_integration_pass.md`.

| # | Result |
|---|---|
| 1 | done - `src/index.ts`: `composeProductionCaptureOf(app, { platform: process.platform, network: captureNetworkFacts(app) })`; the reader is called at each judgement only (0 table reads at composition, 1 per judgement); inside allowed, outside refused, no configuration: all refused |
| 2 | done - `captureReaddressControl(app).provideNetworkFacts(input.network)` in `composeProductionCaptureOf`; route on a booted production Core: 200 inside, 422 outside |
| 3 | done - `typedProbeRuleOf` in `fence/production-parts.ts` (purpose `TYPED_PROBE`, no new rule kind), handed to `typedAddressControl(app).provideRule`; route: 202 inside with the rule's answer, 422 outside with 0 searches |
| 4 | not added - SR-7 names two other lists; request line with the import and what removes it |
| 5 | done - SR-6 in `test/static/network.test.ts`, green |
| 6 | 0 lines moved - both pins already `[11, 'dbc-12']`; the other old-version texts are migration-set files |
| 7 | done - one export name; `boot-key.ts` untouched, its duplicate held equal by its test |
| 8 | nothing changed - the writer enforces neither form; open finding, request line |
| 9 | not done - the ONVIF double's closed port list is in `test/support/onvif-odd-device.ts`; request line |
| 10 | done for the two real-worker cases - `underHeavyHostLock` in `camera-adapter-open.db.test.ts` |
| 11 | done - `RUN_BOUND_S` + watchdog thread (row 44), `RUN_BOUND_S = 240` (row 159), life bound 330 s (stand-in) |

Checks: typecheck 0; static set 763 passed / 3 failed (A2 `test/static/search-path.test.ts:94`; A1 `capture-config/__tests__/static.test.ts:175`; item 4 `credential-store/__tests__/static.test.ts:89`); touched units 539 passed; composition database file 10 passed; camera adapter database file 11 passed (both locks) and 2 passed (its own lock); one short case each of rows 44 and 159 PASS; both bounds seen to end a run with code 3.

Requests left (`file_requests.md`, four lines `pass I-9a`): items 9, 4, 8, and the information line of item 10.

Driver decisions: the entry-point pin of `capture/__tests__/static.test.ts` moved with item 1; the two new hand-overs are production-only, in the app-bound function; item 10 covers the two worker cases; the watchdog does not clean up; one `row159` run folder (number 901) made and removed by this pass.

Edit-only rule: kept - every existing file was changed with the Edit tool; the two records are new files.
