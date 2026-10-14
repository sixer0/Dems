# row I-9e - complete (details: implementation/i9e_integration_pass.md)
- C132 (1): `ProfilesNotStoredCause.SESSION_OPEN` -> `SESSION_ACTIVE`, 4 lines (2 source, 2 test); R-5 green, its control green.
- C132 (2): edge `demo -> capture-config` in imports.test.ts rule 5; `reloadNetworkFacts` bound in `createResetHost`; one test in demo host.test.ts, red on the member removed.
- Consequence edit: demo `__tests__/static.test.ts` import-source list gained `'../capture-config'`.
- Checks: unit 16 files / 373 tests passed; demo db 5 files / 47 passed; tsc 11 errors, none mine; oxlint exit 0.
- Requests left: none. Driver decisions: none beyond the static-list entry above.
