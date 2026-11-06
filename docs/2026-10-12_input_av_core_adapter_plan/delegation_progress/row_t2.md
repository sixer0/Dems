# Row T2 - tests strengthened (review 060b section 7.4, S-07, S-08, S-09; decision C95)

Status: **complete** (items 1 to 5 done, item 6 measured and not fixed, as briefed). Agent: test-expert (T2, track D).
Date: 2026-10-13. Full record: `test/t2_test_strengthening.md`.

## Result per item

1. `relay_unit_test.c` - DONE. The test program sees the dial's `bind` and `connect` calls (982 -> 989 checks). Scratch
   mutant "bind removed": `7 of 989 checks FAILED`, the named check among them. Tree: `989 checks passed` (release, sanitizer).
2. `row143b_source_bind.py` `probe_from_loopback` - DONE. A second probe from another address of this host; the double
   must see that address. Relay built without the bind: `FAIL`, the double saw 127.0.0.1. Tree: `14 of 14 runs PASS`.
3. `onvif-session.test.ts` - DONE (after B1 was complete). The control case holds every connection to
   `localAddress` = the source, family 4; the 3,000-level case holds ONE outcome, reason, read and request. In-memory
   mutants: source dropped `3 failed`; family dropped: that case alone; wrong reason name and no depth bound: the deep case red. Tree: `62 passed`.
4. `relay-check.sh --selftest` - DONE. Measured before: 35 of 82 rule statements could be deleted with the selftest
   green (the review named 18). 35 controls added, each matched by its rule's own message. After: 0 of 82.
5. Flake `service.test.ts:382` - DONE. Cause: the random byte after the secret is `x` 1 time in 256. That byte is now
   stated; the chance case is asserted on purpose. Old form red in the loop; fixed form 0 failures in 2,000.
6. `row58_gate.py` x20 - MEASURED. `INGEST_OPEN_STUCK`: 0 of 240 sessions at 1-minute loads 7.7 to 22.7. Two runs
   11 of 12, neither by that code: port 8561 held by a vitest worker (this agent's own unlocked run of
   `onvif-session.test.ts`: its odd device takes 8561 / 8560 / 8559); 2 own processes still alive at a leftover check.

## Files

Changed (Edit tool only): `apps/capture-worker/test/relay_unit_test.c`, `test-fixtures/row143b_source_bind.py`,
`relay-check.sh` (selftest only); `apps/core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts`,
`src/modules/capture-discovery/connect/__tests__/service.test.ts`; one line each in `file_claims.md`, `file_requests.md`.
New: `test/t2_test_strengthening.md`, this file. No product source written (mutants in scratch copies and in memory).

## Checks

- `make -C apps/capture-worker` (heavy-host lock): rc 0; `check.sh src` rc 0, `check.sh --selftest` rc 0, `relay-check.sh src/relay` rc 0.
- Static set of core-server: `Test Files 45 passed (45)`, `Tests 778 passed (778)`.
- `tsc --noEmit`: rc 2, 3 errors in `installation-acceptance/__tests__/` (another row), none in this row's files.
- `build/capture-relay` was re-linked by `make` (the script is its prerequisite); sources unchanged; hashes in the record.

## Requests and decisions

- `file_requests.md`: the odd ONVIF device's ports (8561, 8560, 8559) are the worker's ingest listeners and a unit test
  takes them without the lock; the Linux build of the unit test (`dlsym`, `-ldl` on an old glibc) for row 193.
- DRIVER DECISION: a host with no second IPv4 address FAILS `probe_from_loopback` (not skipped).
- Owned: this agent ran `onvif-session.test.ts` outside the heavy-host lock; it cost run 12 of item 6.
