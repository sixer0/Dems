---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W98
date: 2026-10-07
agent: verifier
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row W98, line 777; section 18 DF-1/DF-2)
scope: D250. This is the REDUCED form on the DEBUG build. Each measure has 1 run + 1 verification run (D232/D233). The release-build items (D218/D236) are out of scope.
status: needs-review (5 of the 7 measures have both runs; the Simulated-mode web comparison did not run; the RF2-2 delay reproduced at +12.2 s)
narrative_tier: 2
evidence_folder: verification/assets/08_performance_realtime/ (144 files: JSON, logs, PNG, MP4, 22 drivers as drv_*.txt)
---

# W98: performance of the realtime path, reduced, on the debug build

Window: 2026-10-07, 09:48 to 10:20 WIB, on the main instance:

- Core `127.0.0.1:4420`, pid 53551, database `dems_demo`, log `.cache/manual/main-server-w94.log`;
- web `127.0.0.1:5173`, Live;
- Metro 8081;
- phone emulator-5554 (DEV-0003), tablet emulator-5556 (DEV-0004) and phone2 emulator-5558 (DEV-0002, which is DEV-0005 after the re-pair).

This row did not start, stop or restart any of these. Host: Apple M5, 10 cores, 24 GiB, macOS 27.0.1.

The web side ran in this row's own Playwright-cache headless shell (`chromium_headless_shell-1243`). It used raw CDP on an OS-assigned port (62007), ownership-checked on every connection (pid + profile + `lsof` listener). Its origin was `http://127.0.0.1:5173` only: the end-state network record lists that one origin. The profile was removed at the end.

## 0. Summary

| # | Measure (brief) | Run 1 | Verification run | Result |
|---|---|---|---|---|
| 1 | Core CPU / RSS, three clients signed in, idle and during a recording | idle 1.01 % mean (p95 1 %), 170 MB; recording A 1.22 % (p95 1.9 %), 158 MB | idle 0.69 % (p95 1 %), 158 MB; recording B 0.69 % (p95 1 %), 146 MB | Observed: the Core is near idle in every state. Recording adds no CPU above the 1 % sampling step |
| 2 | Database write rate during a ~60 s recording; zero meter-frame rows | 60.9 s: 6 inserts (audit 4, events 1, health 1), 135 updates, 0 deletes = 2.32 row writes/s | 61.0 s: 4 inserts (audit 3, health 1), 131 updates = 2.21 row writes/s | **Zero meter-frame rows**: no table of the 30 can hold one, and every insert is an audit, event or health row. The web received ~19.3 meter frames/s and none were stored |
| 3 | Web Session Monitor: long tasks and frame rate, compared with Simulated | recording A: 0 long tasks, 60 fps, main thread 11.6 % busy (idle: 0 long tasks, 60 fps, 7.6 %) | recording B: 0 long tasks, 37 fps, 6.5 % busy (idle: 0, 37 fps, 5.1 %) | 0 long tasks in 4 windows. **Simulated comparison not run** (§3.3) |
| 4 | Phone frame statistics during a recording (gfxinfo) | 1,084 frames / 41.8 s (26 fps), janky 69.9 %, p50/p90/p95/p99 38/73/89/129 ms | 1,312 frames / 41.5 s (32 fps), janky 53.7 %, 34/61/69/89 ms | Observed (debug build, load 6-8). The idle Home drew 0 frames, so there is no idle reference |
| 5 | One list pass on the bulk fixture | No fixture-loaded database exists (only `dems_demo`). The repository's test helper cloned `tpl_bulk` into a test database: 15/15 pass in 5.05 s | 15/15 in 4.94 s; ascending walk of 5,047 rows in 26 pages of 200: 204 ms; descending 99 ms; 3,653 events in 19 pages: 43 ms | Ran on a throw-away test clone, in process (not over HTTP). `dems_demo` untouched |
| 6 | RF2-2 / FXR-DEV-1: two web stops while the tablet shows the monitor | stop A (load 9.2): the tablet showed Finalizing **+11.33 s** late (store STOPPING +12.19 s); phone +4.45 s; web +0.07 s | stop B (load 7.6): tablet Finalizing **+2.28 s** (STOPPING +2.50 s); phone +1.12 s; web +0.09 s | The delay reproduced. The data **supports hypothesis (a)**, a starved JS thread on the device, and **refutes (b)**, dropped or late deltas (§6.3) |
| 7 | Revoke-to-Pair on phone2, recorded only | **1.23 s** (server 200 at 10:15:38.280 → Pair "Pairing revoked" fully drawn at 10:15:39.512). Signed-out state: the operator session had idle-expired | Re-paired as **DEV-0005** (code blurred, typed by the script, counted 0 times in 105 places) | Recorded (debug build, load 5.3). The 1 s criterion is measured on the release build (D218, D250) |

End state (10:18-10:19):

- all three apps are paired (DEV-0003, DEV-0004, DEV-0005), LIVE, signed out and on Login;
- the registry shows `signedInOperatorId: null` for all three;
- nothing is recording (current session SES-20261007-0031 SEALED);
- the web SUPERVISOR is signed out (204), the browser is stopped and its profile removed.

## 1. Method and host load

- **Load.** `uptime` is recorded at the start and end of every window (in each JSON, `uptimeStart`/`uptimeEnd`, or `uptimeAtStart`/`uptimeAtEnd`), and `ps -axo %cpu,rss,comm -r` at the start of each block (`08_*_host_top.txt`). The 1-minute load ran from 3.4 to 9.2 (limit 14).
- **Contributors to the load:**
  - the three emulators (qemu, 8-32 % each);
  - WindowServer;
  - an unrelated `node` at 58 %;
  - this row's own headless browser, which drew Session Monitor in software and used **~1.07 cores** (GPU process 97 %, measured 10:07). This holds for every window from 09:57 on, including the device measures.
- **Clock.** The Core, web and server log run on the host clock. Each device clock runs 49.84 to 49.90 s behind the host. Every device time below is converted with a bracketed `date` read taken in the same block (bracket 18-74 ms; one read had a 204 ms bracket and was replaced by the 41 ms read of the diagnostics step).
- **Recordings.** SES-20261007-0030 (run A, 123 s) and SES-20261007-0031 (run B, 231 s) were started from the signed-in SUPERVISOR page through the API, and stopped through Session Monitor's own End Session control (hold, reason, confirm). The API sequence was case-number, create, precheck, wait for PASS, start, which are the server operations the wizard sends. See D-1.
- **Signed-in clients during A and B:**
  - phone: budi.santoso (INVESTIGATOR);
  - tablet: budi.santoso;
  - phone2: rina.wijaya (TECHNICIAN);
  - web: andi.pratama (SUPERVISOR).

  The biometric offer was answered "Not now" on all three devices.
- **During each recording,** the phone and the tablet showed the monitor (`08_a_phone_monitor.png`, `08_a_tablet_monitor.png`, `08_b_*_monitor.png`) and the web showed Session Monitor (`/session`).

## 2. Measure 1: Core CPU and RSS

Method: `drv_cpu_sample.mjs.txt`.

- It samples once per second for 60 s.
- CPU % for an interval is the change in cumulative CPU time (`ps -o time`, 10 ms resolution) divided by wall time, so 100 % is one core and one sample step is about 1 %.
- RSS comes from `ps`.
- The same numbers are taken for the DEMS PostgreSQL cluster as a group: postmaster 32434 and its children, on 127.0.0.1:4432.

| Window | State | Load (1-min) | Core CPU % mean / p50 / p95 / max | Core RSS MB mean (min-max) | PG cluster CPU % mean | PG RSS MB | File |
|---|---|---|---|---|---|---|---|
| S0 09:53:58-09:54:59 | 3 apps paired, **signed out**, no web | 3.37-4.39 | 1.35 / 1 / 5.8 / 7.6 | 137.5 (128.0-148.6) | 0.28 | 65.9-67.6 | `08_cpu_s0_signed_out_idle.json` |
| S1 r1 09:59:35-10:00:36 | **3 devices signed in** + web on Session Monitor, idle | 3.62-5.20 | 1.01 / 1 / 1 / 5.8 | 170.3 (143.4-178.6) | 0.17 | 54.2-57.3 | `08_cpu_s1_three_signed_in_idle.json` |
| A 10:02:23-10:03:23 | **recording**, 3 devices + web on the monitor | 5.51-8.81 | 1.22 / 1 / 1.9 / 8.7 | 158.2 (116.1-173.6) | 0.19 | 51.2-56.4 | `08_cpu_a_recording.json` |
| B 10:09:06-10:10:07 | **recording** (verification) | 5.16-8.64 | 0.69 / 1 / 1 / 4.9 | 145.9 (111.1-160.0) | 0.14 | 50.2-56.0 | `08_cpu_b_recording.json` |
| S1 r2 10:13:54-10:14:55 | idle (verification). Phone2's operator had idle-expired at 10:13:46, so only 2 operators were signed in | 4.58-5.30 | 0.69 / 1 / 1 / 4.9 | 158.0 (144.1-173.5) | 0.10 | 57.5-61.0 | `08_cpu_s1_three_signed_in_idle_r2.json` |

Reading:

- The Core process is at about 1 % of one core in every state, and a recording with four realtime clients does not move it above the sampling step.
- RSS moves between 111 and 179 MB in a sawtooth, which looks like garbage collection (a hypothesis; no heap profile was taken).
- The database cluster is below 0.3 %.
- On the server side, the realtime path costs almost nothing on this host. The load comes from the clients.

## 3. Measure 2: database write rate (zero meter-frame rows)

Method: `drv_db_probe.mjs.txt`.

- It uses the repository's own access path (`scripts/pg/lib.mjs` + `scripts/pg/db.mjs`: 127.0.0.1:4432 only, PG* variables scrubbed) as `dems_owner`.
- Every statement runs inside `BEGIN READ ONLY`, and each snapshot records `transaction_read_only=on`.
- Each snapshot holds the per-table `count(*)` and `pg_stat_user_tables` `n_tup_ins/upd/del`. Differences come from `drv_db_diff.mjs.txt`.
- The credential file is opened inside the process. No value of it is printed, written or passed on.
- `db:status --database dems_demo` (read-only) was also run at 09:51: OK, 30 tables, audit head seq 203.

| Window | Seconds | Inserts per table | Updates per table | Deletes | Row writes/s | Commits | File |
|---|---|---|---|---|---|---|---|
| Recording A (a1 → a2, the monitor up, between `start` and the stop) | 60.9 | audit_log 4, events 1, health_snapshots 1 (**6**) | active_session 63, hardware_snapshot 63, engine_counters 5, audit_chain_head 4 (**135**) | 0 | **2.32** | 103 | `08_db_diff_recording_a.txt` |
| Recording B (b1 → b2) | 61.0 | audit_log 3, health_snapshots 1 (**4**) | active_session 62, hardware_snapshot 62, audit_chain_head 3, auth_sessions 2, paired_devices 2 (**131**) | 0 | **2.21** | 107 | `08_db_diff_recording_b.txt` |
| Idle between the sessions (a3 → b0), for comparison | 198.1 | events 4, health_snapshots 4 (8) | hardware_snapshot 197, engine_counters 8 (205) | 0 | 1.08 | 318 | `08_db_diff_idle_a3_b0.txt` |
| Whole session A (before create → after seal) | 174.3 | 35, incl. evidence_items 1, evidence_tracks 4, evidence_custody 3, session_history 1 | 367 | 1 (active_session) | 2.31 | 333 | `08_db_diff_session_a.txt` |
| Whole session B (incl. the failed stop attempt) | 270.6 | 56 | 608 | 1 | 2.46 | 520 | `08_db_diff_session_b.txt` |

**Zero meter-frame rows.**

- No table of the 30 has a name that could hold meter frames (`/meter|frame|level|vu/i`: none).
- In each 60 s window, all 4 to 6 inserts are audit, event or health rows.
- Over the same 30 s of web measurement, the page received 580 `meters` frames, about 19.3 per second (`08_web_live_recording_a.json`, `socketFramesByType`). None of them became a row.

During a recording the Core rewrites `active_session` and `hardware_snapshot` about once per second each. When idle, only `hardware_snapshot` is rewritten about once per second. One health snapshot is inserted about once a minute.

## 4. Measure 3: web Session Monitor (long tasks, frame rate)

Method: `drv_web_perf.mjs.txt`. Each window is 30 s on the open `/session` page of the signed-in SUPERVISOR, and collects:

- a `PerformanceObserver` of type `longtask`;
- a `requestAnimationFrame` loop (frame count, interval percentiles, intervals over 50 ms);
- CDP `Performance.getMetrics` deltas (TaskDuration as main-thread busy time, script, layout, style);
- the socket frames received, by type.

The viewport is 1920x1080.

| Window | Page state | Load | Long tasks (count / total / max) | rAF fps | Interval p50 / p95 / p99 / max ms | Intervals > 50 ms | Main thread busy | Script / layout / style ms | Socket frames/s | File |
|---|---|---|---|---|---|---|---|---|---|---|
| Live idle r1 09:59:41 | SEALED | 4.43 | 0 / 0 / 0 | 60.0 | 16.7 / 16.7 / 16.8 / 16.8 | 0 | 7.6 % | 765 / 47 / 247 | 21.3 (meters 579, heartbeat 30, delta 31) | `08_web_live_idle_r1.json` |
| **Live recording A** 10:02:26 | RECORDING | 5.55 | **0** / 0 / 0 | 60.0 | 16.7 / 16.8 / 16.8 / 16.8 | 0 | 11.6 % | 1,310 / 90 / 414 | 21.4 | `08_web_live_recording_a.json` |
| **Live recording B** 10:09:09 | RECORDING | 5.16 | **0** / 0 / 0 | 37.3 | 33.3 / 33.4 / 50.0 / 50.1 | 2 | 6.5 % | 751 / 66 / 190 | 21.3 | `08_web_live_recording_b.json` |
| Live idle r2 10:13:57 | SEALED | 5.12 | 0 / 0 / 0 | 36.7 | 33.3 / 33.4 / 33.4 / 50.0 | 0 | 5.1 % | 479 / 32 / 130 | 21.7 | `08_web_live_idle_r2.json` |

### 4.1 Reading

- There were no long tasks (> 50 ms) in any window, recording or idle.
- A recording raised main-thread busy time from 7.6 % to 11.6 % in run 1. In run 2 it did not: 6.5 % against 5.1 % idle.
- Between 10:03 and 10:09 the headless shell's rAF cadence dropped from 60 to about 30 Hz (p50 33.3 ms) in **both** the idle and the recording state, while the page was **less** busy. This is a property of the headless compositor and host scheduling, not of the page (a hypothesis: the drop follows host load and the browser's own software GPU process at ~1 core). So fps in this shell is not a reliable measure of the page.

### 4.2 Interpretation limit

This is a headless shell with software rendering. It shows the page's main-thread cost, not the frame rate of a real browser with a GPU.

### 4.3 Simulated-mode comparison: NOT RUN

- In Simulated mode the console's Sign In is disabled while the mock-core heartbeat is offline (`apps/core-web/src/features/login/login-model.ts:61-63` `isCoreBlocked`). The heartbeat client connects to mock-core at 127.0.0.1:4400 (`apps/core-web/src/routes/__root.tsx:115` `HeartbeatProvider url={coreWsUrl()}`; `src/env.d.ts:11`).
- Contrary to the brief, a process **is** listening on 127.0.0.1:4400:
  - pid 43299, `tsx` with cwd `apps/mock-core`;
  - started 2026-10-07 08:22:03;
  - its parent is `tsx watch` pid 66412, running since 2026-10-06 12:50.
- Using it would have taken the browser to a second origin, and the brief restricts it to `127.0.0.1:5173`. So the comparison was not run, and mock-core was neither used, started nor stopped.
- To run the comparison, the controller would need to allow the 4400 heartbeat origin (or decide on another route).

A mobile Simulated comparison was not run either: switching the app's Core link source changes an app preference, which is outside this brief.

## 5. Measure 4: phone frame statistics during a recording

Method:

- `adb shell dumpsys gfxinfo com.dems.demo.tablet reset` with the phone on the monitor;
- about 41 s later, the full `dumpsys gfxinfo` (summary and the framestats table);
- in the same window, the CPU sampler and the web window ran.

| Run | Window (host) | Load at start → end | Frames | fps (frames / window) | Janky (new / legacy) | p50 / p90 / p95 / p99 | Missed Vsync | Slow UI thread | High input latency | Slow issue draw | File |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 10:02:23.0-10:03:04.8 | 5.95 → 7.52 | 1,084 | 26.0 | **69.93 %** / 85.61 % | **38 / 73 / 89 / 129 ms** | 183 | 489 | 644 | 675 | `08_a_phone_gfxinfo_full.txt`, `08_a_phone_gfxinfo_window.txt` |
| B | 10:09:06.3-10:09:47.8 | 5.16 → 7.87 | 1,312 | 31.6 | **53.73 %** / 78.43 % | **34 / 61 / 69 / 89 ms** | 157 | 417 | 1,172 | 613 | `08_b_phone_gfxinfo_full.txt`, `08_b_phone_gfxinfo_window.txt` |
| reference | 10:13:53.9-10:14:35.2, Home, no recording | 5.30 → 4.77 | 0 | - | - | - | - | - | - | - | `08_ref_phone_gfxinfo_full.txt` |

Reading:

- On the debug build at load 6-8, the monitor draws 26-32 fps with 54-70 % janky frames and a median frame of 34-38 ms.
- The idle Home screen rendered no frame in 41 s (static), so it is not a usable "no recording" reference.
- These figures belong to the debug build: dev-mode React, Hermes without release optimisation, an emulator on a loaded host. They are not a product figure.

## 6. Measure 6: RF2-2 / FXR-DEV-1, two web stops while the tablet shows the monitor

Method: `drv_stop_wrap.sh.txt`. Each stop combined:

- a 864x540 `screenrecord --bugreport` on the tablet (device-time overlay on every frame);
- a streamed `logcat -s ReactNativeJS:V`;
- the web stop (`drv_web_stop.mjs.txt`: hold End Session, reason, confirm; the stop call's sent and answered times from CDP).

**The session-window records.** FXR-M's `runtime.diag.sessionWindow` records are written **only to the app's log store** (AsyncStorage `dems.mobile.log.v1`). They are not written to logcat, by design (`apps/mobile/src/runtime/session-diagnostics.ts:14-17`). So they were read with `run-as` + `sqlite3`, and only that source was kept (`drv_diag.mjs.txt`). That reader takes nothing else of the store. Server times come from the server log and the audit rows (`08_a/08_b_server_and_audit.json`).

### 6.1 Timeline

All times are host time. `+` is the delay after the Core's `stop 202`.

| Item | Stop A (SES-0030, ~123 s in) | Stop B (SES-0031, ~231 s in) |
|---|---|---|
| Load at the stop | 9.17 / 6.16 / 5.63 | 7.58 / 6.72 / 5.97 |
| Web confirm released / `POST …/stop 202` answered | 10:03:50.371 / **10:03:50.389** (server log 50.387; AUD-000220 `RECORDING_STOPPED` 50.383) | 10:11:49.740 / **10:11:49.763** (server 49.762; AUD-000253 49.756) |
| Web page `data-session-state` STOPPING | 50.456 (+0.07 s) | 49.851 (+0.09 s) |
| Phone store STOPPING (diag) | 10:03:54.838 (**+4.45 s**) | 10:11:50.883 (**+1.12 s**) |
| Tablet: last "Recording" frame / first "Finalizing evidence" frame (video) | 10:04:01.219 / **10:04:01.723 (+11.33 s)** | 10:11:51.693 / **10:11:52.043 (+2.28 s)** |
| Tablet store STOPPING (diag record) | 10:04:02.578 (**+12.19 s**) | 10:11:52.261 (**+2.50 s**) |
| Core sealed (`EVIDENCE_SEALED`) | 10:03:57.388 (AUD-000221) | 10:11:57.090 (AUD-000254) |
| Tablet SEALED (diag) / phone SEALED | 10:04:07.153 (+9.77 s after the seal) / 10:04:02.865 (+5.48 s) | 10:11:58.313 (+1.22 s) / 10:11:58.209 (+1.12 s) |

The tablet's video frames are in `08_a_tablet_web_stop_frames_1fps.png` and `08_b_tablet_web_stop_frames_2fps.png`; the full recordings are `08_a_tablet_web_stop.mp4` and `08_b_tablet_web_stop.mp4`.

### 6.2 What the tablet's records and frames show

All values come from `08_a_tablet_session_window_diag.json` and `08_b_tablet_session_window_diag.json`.

| Window of the record | Stop A | Stop B |
|---|---|---|
| RECORDING window: samples / expected at 250 ms | 449 / ~537 (134.4 s) | 845 / ~933 (233.3 s) |
| RECORDING window: lag max, and when | 1,766 ms at window +121.3 s = 10:03:49.5 (0.9 s **before** the stop) | 2,310 ms at +156.9 s = 10:10:35.8 |
| RECORDING window: samples > 500 ms / > 1 s | 16 / 9 | 16 / 5 |
| STOPPING → FINALIZING window | lag max **5,155 ms** at +323 ms (a timer tick about 5.4 s late, at ~10:04:02.90) | 1,110 ms at +100 ms |
| Socket counters at every transition | `deltasDropped 0`, `deltasStale 0`, `resyncs 0`, `reconnects 0`, `resyncPending null`, `link ONLINE`, `synced true` | the same |
| Deltas over the RECORDING window | 133 deltas against 133 revisions (1656 → 1789; rev 4843 → 4976): contiguous | 258 against 258 (2057 → 2315; rev 5244 → 5502) |

The video of stop A:

- The monitor timer read 00:01:56 at 10:03:45.60, when the true elapsed time was 1:58.7. So the display lagged about 2-3 s before the stop.
- From 10:03:52.60 it **froze at 00:02:03** until the hand-over.
- The audio-meter readouts still changed until about 10:03:57.5. After that the whole screen stood still until Finalizing at 10:04:01.7.
- In stop B the timer kept stepping (3:45 → 3:52), and Finalizing followed 2.28 s after the stop.
- The camera feed's burned-in clock keeps moving during the freeze. It is native video, so it says nothing about the JS thread.

For comparison, FXR-DEV-1 (D249) was a +21.2 s delay at load ~14 with a lag max of 4,463 ms.

### 6.3 Which hypothesis the data supports

**(b) dropped or late deltas: not supported (refuted for these two stops).**

- No delta was dropped or stale.
- No resync or reconnect happened, and the link stayed ONLINE.
- The revision sequence over the window is contiguous.
- The Core sent the stop on time: the web saw it within 0.07-0.09 s and the phone within 1.1-4.5 s on the same Core.

**(a) a blocked or starved JS thread on the tablet: supported.**

- The delay is on the device, between the socket and the commit.
- It grows with the tablet's JS lag and the host load: +12.2 s with nine samples over 1 s and a 5.2 s stall ending 0.3 s after the late commit, against +2.5 s with a 1.1 s stall.
- The phone, with less lag, followed sooner.

**Precision limit.** The 250 ms sampler did not record one stall as long as the 12 s delay. Its largest samples sum to about 7 s around the stop. In the frames, the meters still changed during the first ~5 s of the delay while the timer stood still. So the data fits a backlog of queued JS work (messages and renders processed slowly between timer ticks) better than one single block. The plain-interval sampler under-reports such a backlog.

The exact on-device mechanism, which queue holds the delta, is not established. These are debug-build figures under load. The release-build measurement stays with the pre-handover session (D250).

## 7. Measure 7: revoke-to-Pair on phone2, recorded only, and the re-pair

Method: `drv_revoke_wrapper.sh.txt` and `drv_revoke.mjs.txt`. It combined:

- a 540 px `--bugreport` recording on phone2;
- a streamed device JS log;
- the web Paired Devices page, which revoked only DEV-0002, with the reason "W98 revoke-to-Pair timing".

Device-host offset: -49,894 ms (bracket 29 ms) before and -49,898 ms (bracket 19 ms) after; -49,896 ms was used.

| Step | Time (host) | Evidence |
|---|---|---|
| State before | phone2 on Login with the "Session expired" dialog: rina.wijaya's session had idle-expired at 10:13:46 (server: `socket closed code=4401 closedBy=server`, 15 min after the last touch at 09:58:46). So this is the **signed-out** state | `08_r_phone2_before_revoke.png`, server log |
| Confirm / `POST /pairing/devices/DEV-0002/revoke 200` | 10:15:38.266 / answered **10:15:38.280** (server 38.277) | `08_r_revoke.json`, `08_r_revoke.log` |
| Server closes the device socket | 10:15:38.283 `code=4403 closedBy=server` | server log |
| App `auth.sessionEnd {kind: DEVICE_REVOKED}` | device epoch 1791342888.380 → host ≈10:15:38.28 | `08_r_device_js_stream.log` |
| Dialog gone (Login) / last Login frame | 10:15:39.223 / 10:15:39.380 | frames f_0012, f_0014 |
| **Pair "Pairing revoked" fully drawn** | **10:15:39.512 = 1.23 s after the server's answer** (load 5.32) | `08_r_revoke_frames.png`, `08_r_phone_revoke_screenrecord.mp4` |
| Link "Connected" on Pair | 10:15:39.711 | frame f_0024 |
| Audit | AUD-000257 10:15:38.275 `DEVICE_REVOKED` actor OPR-002 device DEV-0002 `{"reason":"W98 revoke-to-Pair timing","sessionsEnded":0}` | `08_r_revoke.json` |

Context for the 1.23 s:

- W94 measured 436 ms at load 3.9 from a signed-in Home.
- D218 measured 1.3-2.4 s at load 8-13.
- Here the debug build left a signed-out Login with a modal open.
- The plan's 1 s criterion is measured on the release build (D218, D250), not here.

**The re-pair** (`drv_prep_pair.sh.txt`, `drv_issue_redeem.mjs.txt`):

- The code slot was focused from a UI dump of Pair, which is allowed.
- The web issued PCD-000005 (AUD-000258) behind the blur mask. The mask was verified (transparent digits, blur, QR hidden), and the screenshot is `08_rp_web_code_issued_blurred.png`.
- One process read the code into one variable and gave it to one `adb input text` call. It was never printed.
- Redeem 201 at server 10:17:00.602. AUD-000259 `PAIRING_SUCCESS` names **DEV-0005**.
- The app landed on Login, "paired as DEV-0005" (`08_rp_phone_after_redeem_login.png`).
- The code was counted in 105 places (every file of the assets folder, the server log, the device JS log, the whole device log, AsyncStorage, the result): **0** digit-bounded or spaced hits, and 0 raw substring hits.

## 8. Measure 5: one list pass on the bulk fixture

- Only `dems_demo` exists in the cluster (`drv_db_probe.mjs.txt databases`). No fixture-loaded database is available, and `dems_demo` must not be reset.
- The repository's own helper builds the fixture on request in a throw-away clone: `useTestDatabase({ template: 'bulk' })`, D73. Its name guard refuses `dems_demo`.
- The existing list test was run twice: `npm run test:db -w @dems/core-server -- src/modules/security-audit/__tests__/bulk.db.test.ts --reporter=verbose`.
- This runs in process, without HTTP.

| Run | Load | Result | Ascending walk (5,012 → 5,047 rows, 26 pages of 200, rows appended during the walk) | Descending walk (5,047 → 5,087) | Event walk (3,653 stored, 19 pages) | Teardown |
|---|---|---|---|---|---|---|
| 1 (10:17:31) | 6.90 | 15/15 pass, 5.05 s | per-test time not captured (terminal output cut) | - | - | 3 test databases dropped, 0 left |
| 2 (10:17:44) | 6.69 | 15/15 pass, 4.94 s | **204 ms**, every sequence once | **99 ms** | **43 ms** | 3 dropped in 59 ms, 0 left |

The full output of run 2 is in `08_bulk_list_pass_run2.txt`. There is no Simulated comparison for this, because the simulator holds a ring of 1,000 audit rows.

## 9. Rules and secrets

- **Devices.** Only 5554, 5556 and 5558 were used; the driver library refuses any other serial.
- **No device-security or settings changes.** No PIN was typed. No lock, fingerprint or setting was changed. No `locksettings`, no `adb emu finger`, no reverse-rule change, no `device-session.sh`, no Hermes inspector. No keyguard appeared at any check.
- **Biometric offer.** It was answered "Not now" three times.
- **UI dumps.** These were taken only on Pair (`08_rp_ui_pair.xml`) and More (`08_end_*_ui_more.xml`), never on Login, Summary or Home.
- **Captures after typing a password.** The sign-in driver waits 2.6 s before its capture (`prefillDelayMs` 3.1-3.4 s in `08_*_sign_in.json`), so no capture fell within 2 s of a password.
- **Launch links.** No `/` link with `motion=` was launched.
- **Services and data.** The Core, Vite, Metro, mock-core and the emulators were not started or stopped. There was no demo reset, scenario, fault or role change, and nothing touched *:5432; the DEMS cluster is on 4432.
- **Credential files.** The `.data/pg.*` files were never printed, staged or passed.
- **Parallel row.** W100's reads were not touched. No tracked file was modified: `02_plan.md` is tracked, so its W98 status is left to the controller.
- **Secret scan of all 146 files** (assets + this report + the progress file, 54 of them PNG/MP4; `drv_secret_scan.mjs.txt` from W94, PNG and MP4 counted as bytes) gives these results:
  - the demo password: **0** occurrences;
  - token shapes (`dvc_`, `ses_`, `bio_`): 0 lines in the device JS logs and the server log;
  - pairing codes: 0 (see §7);
  - six digits written with separators: 0;
  - 177 bare six-digit numbers, each classified by its context: 34 `AUD-` IDs, 13 `PCD-` IDs, 52 image sizes, 9 byte sizes, 6 UUID fragments, and 63 RSS, `durationMs`, `lagMaxAtMs`, `elapsedMs` and Hermes stack-position values.

  The full figures are in the progress file.
- **Sandbox.** adb, loopback HTTP, CDP, `ps`/`lsof` of other processes, and the 4432 connection needed the per-command sandbox bypass.

## 10. Deviations and decisions (for the controller)

| ID | Deviation / observation | Effect |
|---|---|---|
| D-1 | The recordings were **started through the API** from the signed-in SUPERVISOR page instead of driving the wizard UI. The operations are the same (case-number, create, precheck, start). The stops used the UI | No effect on the measures, which all fall inside RECORDING and at the stop |
| D-2 | Stop B, first attempt (10:10:22): the End dialog did not open after a 1.8 s hold, and no stop was sent. The session kept recording, so SES-0031 lasted 231 s. The driver gained a hold retry and the second attempt worked on its first hold. The attempt's files are kept as `08_b_attempt1_*` | Whole-session B row counts include the extra ~90 s. The 60 s window (b1 → b2) is unaffected |
| D-3 | phone2's operator (rina.wijaya) idle-expired at 10:13:46 | S1 r2 had 2 operators signed in (3 device sockets). The revoke ran in the signed-out state |
| D-4 | **mock-core is running** on 127.0.0.1:4400 (pid 43299), contrary to the brief | It was not used. The Simulated web comparison did not run (§4.3): the controller decides whether to allow that origin |
| D-5 | This row's headless browser used ~1.07 cores while on Session Monitor (software GPU) | It is part of the host load in every window from 09:57. The headless fps dropped from 60 to 30 Hz (§4.1) |
| D-6 | The bulk list pass ran on test clones from the repository helper (3 databases created and dropped per run) | `dems_demo` untouched. This is not an HTTP list pass |
| D-7 | The diagnostics are read from AsyncStorage, not logcat (the module keeps them out of the console by design). A ReactNativeJS logcat stream was also kept (`08_*_tablet_js_stream.log`; its route-sync lines agree with the records) | - |

## 11. Open items (to the final report)

- RF2-2 / FXR-DEV-1 stays open. It reproduced at +12.2 s at load 9.2. The data points at on-device JS starvation (a backlog), not the Core or the socket, so the next step is a release-build measurement under the same conditions (D250). A diagnostic that time-stamps socket receipt against store application would separate "late handling" from "late application" (a suggestion, not done).
- The Simulated-mode web comparison (§4.3) and any mobile Simulated comparison have not been run.
- These release-build items move to the pre-handover session (D218/D236/D250):
  - revoke-to-Pair under 1 s;
  - timer lag and the stale monitor under load;
  - mobile frame statistics on release.

---
*Generated: 2026-10-07 10:24*
*Last Updated: 2026-10-07 10:24*
