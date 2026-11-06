# Row I-9b - integration pass (track D)

Status: needs-review. Record: `implementation/i09b_integration_pass.md`.

| # | Item | Result |
|---|---|---|
| 1 | boot-checks-runner export pin | done |
| 2 | helper codes 36 -> 41 in the client | done; helper SHA-256 `1e758a24...c7d015b1` unchanged |
| 3 | journal, `NOT_MARKED` on a removal | SKIPPED: no durable "add confirmed" fact; the audit rule of `HOST_ALIAS_REMOVED` has no member for a code |
| 4 | kept tables of a demo reset | SKIPPED: the requests agree, but it is reset code (two-column key, a reader reload) and eight pin files |
| 5 | operation 109 answers `INSTALLATION_CLOCK_BEHIND_RECORD` | done (23505 = in force; empty RETURNING = clock behind) |
| 6 | stale schema pins | nothing to move, 0 lines |
| 7 | planted control for the alias seams | already done (`static.test.ts:1975`) |
| 8 | helper suite reads the 21 captures | done, 75 -> 80 tests |
| 9 | `bitrateMbps` nullable | done; the web keeps its mode rule beside the null rule (driver decision) |
| 10 | F3-06 sentences in the shared tree | done |
| 11 | notice `AUDIO_ABSENT_ON_RESTART` | done in the shared verifier |

Checks: typecheck of shared, core-server, core-web, mobile clean; static set 45 files / 778; touched unit tests 34 files / 781; database (acceptance pair + 2) 107 passed, composition 15 passed, 0 databases left; shared 105 files / 2892 after ONE openapi regeneration; web 145; helper suite 80 OK.

Counts: 110 operations, 83 audit types, 15 permissions - none moved.

Requests left: one line in `file_requests.md` (row I-9b, four points). Driver decisions: three (record section 4). Edit tool only for existing files: kept.
