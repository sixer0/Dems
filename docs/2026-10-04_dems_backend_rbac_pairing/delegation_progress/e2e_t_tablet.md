---
row: E2E-T
agent: verifier
date: 2026-10-06
status: needs-review
report: test/07d_e2e_tablet_lane2.md
assets: test/assets/e2e/t_tablet/
---

# E2E-T — tablet (dems2_tablet, emulator-5556) + lane 2 (4422 / web 5177)

## Status

needs-review — every step ran; Part A 36 / 38 screens (2 not reachable under the rules: Session Recovery needs fault or scenario injection, Developer gallery is debug-only); Part B 10 / 10 steps executed, back-guard checked; 7 defects (3 Medium, 4 Low) for the controller to triage.

## Timeline

| Time | Milestone |
|---|---|
| 09:38 | environment read-only checks: health ok, reverse rules `8081→8081`, `4420→4422`, app focused, no keyguard |
| 09:43–10:29 | Part A: Login, offer, Summary, Home, Sessions, session detail, Evidence (3 tabs + menu), Devices (+ actions), More, Storage, Network & Time, Audit (+ Verify), Settings (9 sections), Stack Check, sign-out, TECHNICIAN (Home, refused create, More, Restart enabled), back to INVESTIGATOR |
| 09:52, 09:59 | load guard: 22.02 and 23.56 → paused 70 s and 120 s |
| 10:30–10:58 | Part B: tablet create/start, web Dashboard and Session Monitor, supervisor note, back-guard, web stop, Finalizing → Summary, evidence on both clients, web Verify and Archive, audit rows; short R2 run for precise latencies |
| 10:58–11:04 | web signed out, browser stopped, profile removed; tablet signed out on Login in LIVE; pairing details opened read-only |

## Defects (detail and repro in the report §5)

- E2E-T-1 Medium — a keep-alive `touch` the Core answered (200 in 28 ms) surfaced as a red error "Core server is unreachable (CORE_OFFLINE)" while the link was ONLINE (client 8 s timeout under JS-thread load).
- E2E-T-2 Medium — Devices pane blank > 4 min after rail navigation from Evidence (once; not reproduced).
- E2E-T-3 Medium — evidence custody `RECORDING_STOPPED` names OPR-001 (starter) while audit #170 names OPR-002 (the supervisor who stopped from the web).
- E2E-T-4 Low — tablet shows "Evidence sealed" 4.2–4.7 s after the Core sealed (web 0.11–0.15 s); ~2 s blank frame before Finalizing.
- E2E-T-5 Low — supervisor note labelled "Investigator note" on the tablet timeline.
- E2E-T-6 Low — tablet Metadata tab empty for Core-only items (web shows the Core record).
- E2E-T-7 Low (hypothesis) — app PSS 1.41 → 1.71 GB over the sitting.

## Decisions taken during the row

- R2: a second short recording (SES-20261006-0026, 40 s) was run to measure the web Dashboard REC latency precisely, because run 1's Dashboard watcher used a wrong text pattern (mine, not the app's). Both sessions were stopped from the web; nothing left recording.
- "Review on the web" was done as Verify (EVIDENCE_VIEW) and Archive (EVIDENCE_REVIEW, SUPERVISOR) of this row's own new item EV-20261006-0015 only.
- The unacknowledged Summary of SES-20261005-0024 (left by W65) was acknowledged with Done; the two new summaries too, so the user's next sign-in opens Home.

## Files created

- `test/07d_e2e_tablet_lane2.md`
- `delegation_progress/e2e_t_tablet.md`
- `test/assets/e2e/t_tablet/` — 191 top-level files (captures `00_`–`28b_`, `99_`, `B00_`–`B40_`, `R2_01_`–`R2_11_`, `W01_`–`W03_`; `core_log_lane2_window.txt`, `jslog_tablet_full.txt`, `jserr_tablet_full.txt`, `11_logbox_touch_core_offline_logcat.txt`) and folders `q/`, `q2/`, `wq/`, `wq1/`, `wq2/`, `misc/`, `drivers/` (`t_drive_q.mts.txt`, `t_drive_q2.mts.txt`, `t_web_q.mjs.txt`, `corelog.mjs.txt`, `qsend.mjs.txt`, `peek.mjs.txt`, `loadwait.mjs.txt`, `stop_probe.cmd.txt`, `stop_probe2.cmd.txt`, `load_pauses.txt`), `web/`

## Secret scan

Count-only scan with the password read from the dataset constant (11:10, over the asset folder, the report and this file): `scanned 362 text files; password hits 0; token-shaped strings 0`. No tracked file modified (`git status --porcelain` shows these files as untracked additions only).
