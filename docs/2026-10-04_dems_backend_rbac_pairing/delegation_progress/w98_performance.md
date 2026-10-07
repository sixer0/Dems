# W98 performance of the realtime path, reduced (verifier): progress

- **Status:** needs-review.
  - 5 of the 7 measures have run 1 and a verification run.
  - Measure 5 (bulk list pass) ran on a test clone made by the repository helper, because no fixture database exists.
  - The Simulated-mode web comparison did not run. mock-core is in fact running on 4400, but the browser is limited to the 5173 origin.
  - RF2-2 reproduced on the tablet at +12.2 s.
- **Window:** 2026-10-07, 09:48 to 10:20 WIB, main instance. Core pid 53551, Vite 53544 and Metro 53574 were not touched.
- **Scope:** D250. This is the reduced form on the debug build, with 1 run + 1 verification run per measure (D232/D233).

## Files created

- `verification/08_performance_realtime.md` (the report)
- `verification/assets/08_performance_realtime/`: 144 files, about 53 MB:
  - CPU JSON;
  - DB snapshots and diffs;
  - web perf JSON;
  - gfxinfo dumps;
  - tablet and phone diagnostics JSON;
  - stop and revoke recordings (MP4) and frame sheets;
  - server and audit JSON;
  - screenshots;
  - the bulk test output;
  - 22 drivers saved as `drv_*.txt`.
- `delegation_progress/w98_performance.md` (this file)

Nothing else was written. `delegation_progress_report.md`, `status_tasks.md` and the tracked `02_plan.md` were not edited, because this is a parallel run and those files are tracked.

## Results

| # | Measure | Run 1 | Verification run |
|---|---|---|---|
| 1 | Core CPU / RSS | idle 1.01 % / 170 MB; recording 1.22 % / 158 MB | idle 0.69 % / 158 MB; recording 0.69 % / 146 MB (signed out: 1.35 % / 138 MB) |
| 2 | DB writes in a 60 s recording | 6 inserts + 135 updates = 2.32/s; 0 meter-frame rows | 4 + 131 = 2.21/s; 0 meter-frame rows (idle reference 1.08/s) |
| 3 | Web Session Monitor | 0 long tasks; 60 fps; 11.6 % busy (idle 7.6 %) | 0 long tasks; 37 fps (headless compositor at 30 Hz, idle too); 6.5 % busy (idle 5.1 %). Simulated: NOT RUN |
| 4 | Phone gfxinfo (monitor) | 26 fps; janky 69.9 %; p50/p90/p95/p99 38/73/89/129 ms | 32 fps; janky 53.7 %; 34/61/69/89 ms |
| 5 | Bulk list pass (test clone) | 15/15 in 5.05 s | 15/15 in 4.94 s; ascending 5,047 rows 204 ms, descending 99 ms, events 43 ms |
| 6 | RF2-2: tablet after a web stop | Finalizing +11.33 s (store +12.19 s) at load 9.2; phone +4.45 s; web +0.07 s | +2.28 s (store +2.50 s) at load 7.6; phone +1.12 s; web +0.09 s |
| 7 | Revoke → Pair (phone2) | 1.23 s, signed-out state, load 5.3 | Re-paired as DEV-0005; the code was counted 0 times in 105 places |

**RF2-2 verdict.** The data supports (a), a starved JS thread or backlog on the device, and refutes (b), dropped or late deltas:

- for (b): `deltasDropped 0`, stale 0, resyncs 0, reconnects 0, link ONLINE, a contiguous revision sequence, and the web saw the stop in 0.07 s;
- for (a): the delay tracked the tablet's JS lag and the host load.

The 250 ms sampler under-reports a backlog. The exact mechanism is not established.

## Decisions and deviations

| ID | What happened |
|---|---|
| D-1 | The sessions were started through the API from the SUPERVISOR page. The stops used the UI |
| D-2 | Stop B, first attempt: the End dialog did not open, so nothing was stopped. The retry worked. The attempt's files are kept as `08_b_attempt1_*` |
| D-3 | phone2's operator idle-expired at 10:13:46. S1 r2 therefore had 2 operators signed in, and the revoke ran in the signed-out state |
| D-4 | mock-core was found running (pid 43299, 127.0.0.1:4400). It was not used |
| D-5 | This row's headless browser used about 1.07 cores, which is part of the host load |
| D-6 | The bulk list pass ran on test clones (3 databases created and dropped per run). `dems_demo` was untouched |
| D-7 | The diagnostics were read from AsyncStorage, because the module keeps them out of logcat by design |

## Secret scan (final)

`drv_secret_scan.mjs.txt` scanned 146 files: the assets, the report and this file, 54 of them PNG/MP4 counted as bytes.

| Check | Result |
|---|---|
| Demo password | **0** occurrences |
| Six digits written with separators | 0 |
| Bare six-digit numbers | 177, each classified by its context: `AUD-` and `PCD-` IDs, image and byte sizes, UUID fragments, RSS, `durationMs`, `lagMaxAtMs`, `elapsedMs`, Hermes stack positions |
| Token-shaped lines (`dvc_`, `ses_`, `bio_`) | 0. The one match is the label text in `08_rp_issue_and_redeem.log` |
| Pairing code | 0 hits in 105 places, counted when it was issued |

## End state

- phone DEV-0003, tablet DEV-0004 and phone2 DEV-0005 are paired, LIVE, signed out and on Login.
- The registry shows `signedInOperatorId: null` for all three. DEV-0002 is revoked by W98.
- Nothing is recording (SES-20261007-0031 SEALED).
- The web SUPERVISOR is signed out (204). The browser is stopped and its profile removed, and no process of this row is left.

*Generated: 2026-10-07 10:25*
