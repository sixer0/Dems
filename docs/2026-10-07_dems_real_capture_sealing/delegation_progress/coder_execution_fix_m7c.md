# coder-execution - fix pass F-M7c (review row 88, last items)

Status: **needs-review (partial)**. Note: `implementation/113c_fix_m7_review_last.md`.

DONE: item 1 (R88-05 i-iii, R88-15), item 2, item 3 (i)-(iii), item 5 (1) + (8), R88-13 second half, D187, D188 (a).
NOT DONE: R88-19 (nine verify codes), R88-12 for non-demo packages, R88-10, -13 first half, -14, -16, -17, -18 (two headers), D188 (b).
Request lines filed (3): the route's actor argument + HTTP test (modules/sessions), op 41 notice description + OpenAPI, the worker's sync-level probe.

Files: see the second line of `fix F-M7c` in `file_claims.md`.
Runs: core-server unit 112 files / 1816 passed; db 11 files / 115 passed; shared 2468 passed, 5 red (1 = request line, 4 = another pass's untracked test); typecheck + lint clean. Heavy runs not started: list in the note, section 5.
