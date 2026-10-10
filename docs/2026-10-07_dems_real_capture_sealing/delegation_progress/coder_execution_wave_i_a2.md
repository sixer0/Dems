# coder-execution - fix wave I, driver A2

Status: **needs-review** (2026-10-10). Full note: `implementation/132_fix_wave_i_a2.md`.
Contract notes for B and C: `delegation_progress/contract_wave_i_a2.md`.

| Finding | Result |
|---|---|
| G70b-01 (MAJOR) | fixed: an adopted camera is assignable at once; each registry refusal has its own reason. Booted-path test red (422) before, green after |
| G70b-02 | ruled: the server is right, the web sentences are wrong; wording handed to B. No server change |
| G70b-05 | guard already as the spec says; audit row of a scheme refusal gains `details.reason`; counter text is a client rule for B |
| G70b-06 | NOT DONE on the server (diagnosis + client rule only; proposal `checkedAt`) |
| G70b-07 | fixed: search ids go on from the highest number of the stored audit chain; no migration |
| G75b-04 | fixed: six session rows carry the sending device; optional `session.precheck.sendingDeviceId` |
| G75b-03 | fixed for a session that is FINALIZING and for the tablet row (real capture only); OPEN for PRECHECK / ARMED / RECORDING / STOPPING |

Contract totals unchanged: 97 operations (36 GET / 61 POST), 67 audit types. No migration, no
commit, no lane started, no local device, no network device.

Files: section 7 of note 132. Request lines filed: two (docs owner; owner of the shared i18n file).
Not written: `status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md`.
