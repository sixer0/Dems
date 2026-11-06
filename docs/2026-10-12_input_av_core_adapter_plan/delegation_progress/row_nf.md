# Row NF (wave 12, agent NF) - status: needs-review

Record: `implementation/nf_network_facts_reload.md`.

- **S2-01 (a)** commit with a lost answer: CLOSED. **(b)** no-change path (E-09): CLOSED. **(c)** demo reset: LEFT - the reset has no hook; the door `captureNetworkConfigControl(app).reload()` is built and tested, its call is a request line to the reset's owner.
- After every unit of operation 102 the reader is read again from the stored row (`network/service.ts` `unitThenReload`, `network/index.ts` `reload`). A failed read: reader null, one line and one persistent entry, code `CAPTURE_NETWORK_FACTS_RELOAD_FAILED`. The reader stays synchronous at judgement time.
- Named tests of review 120b: 5 of 9 red on their mutant, then green (T-1 x2, T-3, T-6, T-7). Left: T-4 x3 (tidy row of S2-03), T-5 x1 (row D4). Mutations in memory only (`.cache/task4-nf/mutant.vitest.config.ts`); the tree is unmutated.
- Checks: network unit `31 passed`; network database `17 passed`, 0 remain; three other test files `168 passed`; unit and static set `1 failed, 640 passed` - the red was mine (trigger rule), fixed, that file `9 passed`, the set not run again; composition / siblings / acceptance `1 failed, 148 passed` - the red is N2's `openapi.json`; typecheck 3 lines, none mine (`AdoptedCameraTestHost.settle`).
- Files written: `network/index.ts`, `network/service.ts`, `network/__tests__/service.test.ts`, `network/__tests__/routes.db.test.ts`; tests only: `src/__tests__/host-alias-socket.test.ts`, `camera-network/__tests__/service.test.ts`, `capture/host-alias/__tests__/lifecycle.test.ts`.
- Requests: four lines `row NF` in `file_requests.md`. Driver decisions DD-1 to DD-8 in the record.
- Edit tool only for existing files; nothing committed or staged.
