# Row N5c - complete (2026-10-14)

Record: implementation/n5c_linear_blanking.md. Decision C138; answers request line 559 (row N5b).

- credential.ts `USER_PART`: the request's linear form applied verbatim. Old 16/32/64 KiB letters 399 / 1,750 / 4,382 ms (loaded host); new 1 MiB letters 7.1 ms, 1 MiB `x1` 8.5 ms.
- Differential fuzz old vs new: 500,000 texts (250,000 request alphabet + 250,000 wider), 0 differences, for both patterns.
- Audit: 5 other patterns in credential.ts + production-door.ts; 4 linear (<= 0.02 ms on 64 KiB); `LOCATOR_OPEN_AT_CUT` quadratic (64 KiB 2,736 ms; reachable only at 512 chars, 0.2 ms) -> same linear form, 0.30 ms, via new exported `takeOffLocatorOpenAtCut` (DRIVER DECISION 1).
- Tests: one appended block in credential.test.ts (3 cases), one in production-door.test.ts (1 case). Mutations M1-M4 RED (old forms: time bound; linear-without-leading-digits trap: output cases + fuzz).
- Checks: six locator files 205/205; audio listing 216/216; static sets 115/115 + 14/14; tsc 9 errors none mine (N13); oxlint 0 on the 4 files.
- No request left. Edit tool only on existing files; nothing left running.
