# Row I-9c (wave 12, integration pass, decision C126) - status: needs-review

Record: `implementation/i9c_integration_pass.md`.

- **Item 1 STOPPED** (brief's condition): `adopted-profiles.ts:56` writes `'SESSION_OPEN'` as a `ProfilesNotStoredCause`, not a reveal reason; R-5 not loosened. Red: `Tests 1 failed | 16 passed (17)`; planted control green. Request: rename the cause.
- **Item 2 DONE, binding requested**: the reset keeps 18 tables (+ T-44..T-48; T-44 on its two-column key); `ResetHost.reloadNetworkFacts?()` called after the engine, before the release. db `38 passed`, new db case `[i9c] kept rows ... capture_device_streams 2 ...`; unit `139 passed`; five mutants red. Binding needs a ruling on `modules/demo -> modules/capture-config` (rule 5).
- **Item 3 DONE**: README - Ringkasan, What this is, reset keeps, 4c row, "Not proven" row, V7 sentence verbatim, helper statement (119c / C122), Tests correction ("to be refreshed after the final full suite").
- **Item 4 STOPPED**: `config.ts:29` is pinned verbatim at `capture/__tests__/static.test.ts:930` (N4); paired change requested (`DEMS-SITE-21`).
- Checks: static + reset + demo unit set `1 failed | 622 passed` (R-5 only); tsc 32 lines in 9 files, none mine; oxlint exit 0, none mine.
- Files written: `db/reset/kept-tables.ts`, `modules/demo/reset.ts`, `test/support/reset.ts`; tests `kept-tables.test.ts`, `m2-guard-keepset.db.test.ts`, `m4-sec-reset.db.test.ts`, `m2-sttcfg-seed-kept.db.test.ts`, `reset.db.test.ts`, `cli.db.test.ts`, `demo/__tests__/reset-order.test.ts`, `reset.db.test.ts`, `static.test.ts`; `README.md`. Not written: `config.ts`, `capture-config/__tests__/static.test.ts`, `demo/host.ts`.
- Requests: three lines `row I-9c` in `file_requests.md`. Driver decisions DD-1..DD-3 in the record.
- Edit tool only for existing files; nothing committed or staged; nothing left running.
