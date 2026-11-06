# coder-execution — wave H, driver C2 (evidence clients)

Status: **needs-review** (2026-10-10). Note: `implementation/123_fix_wave_h_c2.md`.

- 13 of 14 findings fixed with tests (G94-02 blocker, G94-01 client half, G89-03 / G81-02, the interrupted item, G89-04 / -05 / -09, G81-01, no-speech, G81-07, G94-05, G94-07, G94-08 with limits, G94-09).
- NOT FIXED: G94-13 (not reproduced; outside the area; request line filed).
- Open until C1 adds a `LIVE_STREAM` example of `getEvidence`: one expected-failing case per app.
- Four web cases were written after their fix (named in the note).
- Built by two sub-drivers (web, mobile; both tier R) under one brief; the lead wrote the i18n block and re-ran the checks.

Files: see the second "wave H C2" line of `file_claims.md`.

Checks (once): shared i18n pins 53 passed, shared typecheck + lint clean; core-web evidence tests 186 passed + 1 expected fail (one case red from the lead's own edit, corrected, file re-run green), typecheck + lint clean; mobile evidence + session-summary 34 suites / 281 passed, typecheck 0 errors, lint 1 warning in a file of another owner.

Request lines: `file_requests.md` 09:47:11Z and the two "wave H C2" lines after it.
