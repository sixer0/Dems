# Row 55 (HIL): operator passwords - done by the user (D44, D45, D46)

T4=1792720283857. Core inactive, 0 connections before. Run 1: a password was typed at the echoing SET prompt -> REFUSED (NOT_CONFIRMED), nothing changed (D45). Run 2: PASSWORD_TOO_SHORT, then a mismatch -> TRIES_EXHAUSTED, exit 1, nothing stored. Run 3: done.
VERIFY: operator_credentials OPR-001..003 re-hashed after T4 (`t` x3); OPERATOR_PASSWORD_SET after T4 = `3`. The three accounts keep their user names (andi.pratama SUPERVISOR, budi.santoso INVESTIGATOR, rina.wijaya TECHNICIAN) with one shared password chosen and typed by the user (D44); no value reached the controller from this run.
