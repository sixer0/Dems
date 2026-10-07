# W99 security review (backend, database, secrets, host) - progress

- Agent: security-review (tier R), read-only
- Started: 2026-10-07 08:47 WIB (load 6.14 at start)
- Output: verification/02_security.md
- Status: in-progress

## Log
- 08:47 read plan row W99, DB contract 15.4 / 6.2 / 7.1 / 7.6, specs SR-01..82, decisions D113, D118, D122, D123, D146, D161, D177, D190, D195, D240-D246, F29, F43, F75, F76, F79
- 08:48 listener check (lsof): 4432 postgres, 4420 Core, 5173 Vite, 8081 Metro, plus 4400 mock-core, all 127.0.0.1; GET /api/v1/health 200
- 08:49-08:51 count-only secret value scan (3 credential values) over tracked, untracked, ignored docs evidence, .data logs, .locks, .cache, diff and history: 0 hits; pattern scan: placeholders/examples only
- 08:52 npm audit --omit=dev 124 (96 high, 0 critical); full 132 (99 high, 0 critical); 17 advisories; none in the core-server runtime chain
- 08:55 read-only catalog inspection as dems_owner (BEGIN READ ONLY) via repo helper; pg:status HA-1..HA-4 PASS; SU-1 5x OK
- 08:58 log hygiene: 10 recorded server logs 0 secret/URL/body hits; PG log terse, 0 DETAIL, STATEMENT lines with $n (F-4)
- 08:58 unit tests (security folders, 1 worker): 81 files / 1,757 tests pass; test:pg-scripts 57/57
- 09:00 O-3 in-process probe: refused POST (403) and invalid POST (422) do not touch the session; accepted POST touches once
- 09:01 error-log probe: mode 600, 0 marker occurrences; apps/core-server/logs/ still absent (F-7)
- 09:02-09:04 diff review of 63 non-test files in scope; SR-01..82 table; findings
- 09:05 final listener check unchanged; load 6.05
- 09:12 report written: verification/02_security.md

## Result
- Status: complete
- Verdict: CAUTION (0 Critical, 0 High, 1 Medium, 3 Low, 9 Info; 0 FAIL; 0 blocker)
- W99-1 Medium: npm audit 132 (99 high, 0 critical) full; 124 (96 high, 0 critical) --omit=dev; none in the Core runtime chain -> W102 final-report item + proposed reserved row W106 (controller decision)
- W99-2 Low (F76 generalised), W99-3 Low (F79 (2)(3)), W99-4 Low (D118 FU-4) -> final-report items for use beyond one loopback computer / next phase
- SD-29: 0 DEVICE_CREDENTIAL_ROTATED rows; HC-1..HC-5, 6.2, GD-13, GD-14, T-AO-4, T-CR-2 PASS
- O-3 answered: no
- Files written: verification/02_security.md; delegation_progress/w99_security_backend.md (nothing else changed; plan tracker left to the controller per the brief)
