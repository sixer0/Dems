# W97 — regression SC8 (verifier) — progress

Status: complete. All six criteria PASS; two Low traceability findings (F-1, F-2). Report: `verification/07_regression_simulated_release.md`.

| Time (WIB) | Action | Result |
|---|---|---|
| 10:26–10:28 | Read plan row W97, L-5/L-6, §17 KI-07, D25/D42/D165, D53/D56/D80/DR-07, D201–D205, D210, D216, D247 | Scope fixed |
| 10:28 | Built the 61-file list from `acaff20` (imports of `@dems/shared/sim`): web 28, mobile 33 | `07_61_files_list.txt` |
| 10:28–10:29 | Ran the web (26 runnable) and mobile (33) files | 322/322 and 387/387, exit 0 |
| 10:29 | `git diff --stat acaff20` over the 61 files; hash-object on the 4 protected web files | 10 files changed: 4 at their recorded hashes, 6 by-design fix edits (F-1) |
| 10:30 | `shasum -a 256 -c` over both SHA256SUMS lists and the 7 `*.sha256`; cross-check against task 1 report | all OK; 7/7 hashes anchored |
| 10:30–10:31 | Launcher self-test under `/tmp/claude-501` (sandbox EPERM first, then bypass) | `"ok": true`, manifest = BUILD-INFO; unpacked copy removed |
| 10:31 | mock-core suite; mock-core/scripts/release diff | 19/19; diff empty |
| 10:31–10:34 | Simulator diff mapped to decisions | 7 files, all covered (F-2) |
| 10:32 | KI-07 | 13 IDs / 62 markers (acaff20 13/62) |
| 10:35 | Started mock-core (pid tree 17512→17554) | health 200 |
| 10:36–10:37 | Web Simulated walk on 5173 | Core log 0 lines in the Simulated phase |
| 10:37–10:39 | phone2 Simulated walk | 0 request lines |
| 10:39–10:40 | phone2 HEARTBEAT (+ reverse 4400) | 0 Core lines; mock-core client connected |
| 10:40–10:41 | Removed the reverse rule; stopped the mock-core tree (retry under sh); phone2 back to LIVE Login | clean; positive control 3 request lines from DEV-0005 |
| 10:42 | Secret scan (count only); report written | 0 / 0 |

Decisions taken by this row: the HEARTBEAT option was set with the MD-7 deep link instead of Settings taps (N-2). mock-core also ran during the web walk, because README:111 and D210 require it (N-3).
