---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 71 (worker half, "71a"; the Core half appends 30b)
date: 2026-10-09
agent: coder-execution
status: complete (worker + protocol); supervisor-path e2e waits for 71b
tier: 3
---

# Row 71a — microphone switch mechanics and warnings in the capture worker (protocol version 4)

Paths are relative to the repository root. W = `apps/capture-worker`.

## 1. What was built

| # | Item | Where | Real / stand-in |
|--:|---|---|---|
| 1 | Protocol version 4: warning `reason` + device-ID-only subject, `AUDIO_SOURCE_INTERVAL`, `AUDIO_TIMELINE_END`, `FIRST_VIDEO_SAMPLE.skipped`, level `deviceId` / `ratePpm`, named worker settings | `packages/capture-protocol/src/index.ts`; field list in `delegation_progress/contract_71a_protocol_landed.md` | real |
| 2 | Switch: `astreamselect` + the ONE `avfilter_graph_send_command`, on the filtering thread, at the next 10 ms input chunk; record first, ACK second; refused before T0 | `W/src/audio.c:174` (apply), `:195` (the call), `:160` (record), `:611` (per chunk), `:589` (interval of the start), `:658` (timeline end) | real |
| 3 | Warning raiser: `MIC_SILENT`, mic disconnect, rate controller at its limit; pure, on a sample-count clock; cannot switch | `W/src/micwatch.c`, `micwatch.h`; wired at `W/src/audio.c:216`, `:628` | real |
| 4 | Warning frame: reason, `ACTIVE` / `CLEARED`, a null subject cannot be written | `W/src/capture_worker.c:93`; camera reasons `W/src/ingest.c:113`, long GOP `:238` | real |
| 5 | Named settings as arguments (`--ingest-open-window-ms`, `--mic-silence-dbfs`, `--mic-silence-ms`, `--mic-disconnect-ms`), defaults pinned to the contract | `W/src/capture_worker.c:338`, `:373`; `W/src/worker.h` `DEFAULT_*` | real |
| 6 | Carried (a): what arrived before the first written sample, reported | `W/src/ingest.c:542` | real |
| 7 | Carried (b): the clock floor (rule over all packets since the ingest opened) | `W/src/anchor.h:84`, `anchor.c`; judged at `W/src/ingest.c:502` | real; end-to-end fixture NOT built (section 5) |
| 8 | Carried (c): long GOP = `CAPTURE_FAULT` with reason `KEYFRAME_INTERVAL_ABOVE_BOUND` (advisory); `KEYFRAME_INTERVAL` record kept unchanged | `W/src/ingest.c:238` | real |
| 9 | Row 61's request (D138): compile-time assert of the verified libavformat | `W/src/ingest.c:61` | real; proven by a compile with another number (build stops) |

## 2. Decisions and stated behaviour

| ID | Decision |
|---|---|
| D71a-1 | **Hard cut (Q-CLICK default).** No crossfade: both inputs run on one sample counter and the selector passes one. 0 samples inserted or dropped. Audible click when the two signals differ (AU2-07). A crossfade would mix two microphones and needs a decision against OD-09 |
| D71a-2 | **Switch bound.** Command read -> selector switched: measured 2,607 us and 8,679 us (bound 21,333 us; one chunk is 10,000). The first sample of the new source is exactly the chunk boundary (tap: error 4 and 0 samples, inside the 6 a zero crossing hides) |
| D71a-3 | **Capture-time position of the boundary — for the controller.** A chunk is consumed 40 ms after it was captured (row 58's latency). The boundary therefore lies **41.9 to 49.1 ms BEFORE the instant the command was sent**, in capture time: audio captured in the last ~45 ms before the operator's command already comes from the new microphone. The spec bound (one chunk + IPC) holds for command -> switch; it does not describe this offset. The record carries both (`appliedDelayUs`, `capturedAtMs`) |
| D71a-4 | The switch command keeps `to: role`; identities on every frame are device IDs. A role word as a device ID is refused in the plan (package and worker) |
| D71a-5 | Mic disconnect and rate limit use the pinned code `CAPTURE_FAULT` with a reason; no new code. One microphone can hold three ACTIVE warnings: the Core's fault key must include the reason |
| D71a-6 | Mic thresholds and the ingest-open window are process arguments with pinned defaults, not plan members: the plan and its six constants are unchanged (no edit in row 66's builder or its pins) |
| D71a-7 | A switch before T0 is refused `NOT_RECORDING`; a switch to the active source is `ok` with no record |
| D71a-8 | Silence = RMS of DELIVERED samples per 100 ms block at or below the threshold; one block above it clears. Time without samples is not silence. Rate limit = controller at +-5,000 ppm for 3 s; cleared after 3 s below 4,500 |

### Carried finding (a) — the start of a camera file is the specified behaviour

Spec §C.4: with the pinned flags the file starts at the first keyframe that can be placed at or
after T0 and that frame is held from file time 0 — "up to one GOP". Measured on the fake cameras
(GOP 50 frames at 50 fps): `skipped { noTimestamp: 1, beforeAudioStart: 0, noCameraClock: 0,
beforeKeyframe: 49 }`, `skippedSpanMs: 980`, on both cameras. Cause: the camera's FIRST keyframe
arrives before its first sender report and has no timestamp, so the whole first GOP is skipped
(D130's 1 + 29 on the local camera is the same case). Inside the specified bound; now reported in
`FIRST_VIDEO_SAMPLE` for the manifest. Not changed: keeping that keyframe would mean placing a
packet without a camera time — a design decision, not a fix (see section 6).

### Carried finding (b) — the clock floor

The smallest arrival lag of every packet since the ingest opened (also packets before T0) is held
to +-2,000 ms without allowance on the first packet that did not wait. `p4_stall_pinned` keeps both
cameras (floor -57.2 ms / +102.7 ms over 30 / 29 packets); the +10 s camera is still refused at
anchoring. Blind spot, stated in `anchor.h`: a camera whose EVERY packet since the open was more
than 2 s late reads as a clock behind and is given up.

## 3. Commands and results (each once; a second run only after a fail)

| Check | Command | Result |
|---|---|---|
| Protocol package | `npm run test / typecheck / lint -w @dems/capture-protocol` | 29 / 29; 0; 0 |
| Core pin of the worker | `npx vitest run --root apps/core-server --project unit src/capture/__tests__/protocol-pins.test.ts` | 7 / 7 |
| Worker static rules + unit | `make -C apps/capture-worker` (check, selftest, unit, build) | static rules OK incl. row 61's pinned calls (no table row needed); `anchor_test` + 4 negative controls; `micwatch_test` (M5-WARN-1) + its negative control |
| M5 checks | `make -C apps/capture-worker e2e E2E_ARGS="--only m5_ --runs 1 --ports 8563,8564 --tag row71a"` | 7 of 8 as expected; `m5_warn...` FAIL on a harness criterion (it counted the fake cameras' end-of-stream warnings) -> criterion fixed -> re-run `--only m5_warn` PASS |
| Touched existing checks | `python3 apps/capture-worker/test/e2e.py --only '^(proto_r1\|wi1_camstop_r1\|bind_udp_r1\|p4_stall_pinned\|want_f6_camera_clock_sanity_bound_r1\|av1_zero_switch_tap_r1\|continuity_r1\|mic_stop_and_return_r1)$' --runs 1 --ports 8563,8564 --tag row71a_reg --no-build` | 8 / 8 PASS, aggregate 0 |

| M5 check | Verdict | Numbers |
|---|---|---|
| `m5_switch_bound_intervals` | PASS (10 criteria) | 3 interval records, 444 lines all decode as v4, delays 2,607 / 8,679 us, tap boundary error 4 / 0 samples |
| `m5_gap_analyser` (M5-GAP-1) | PASS | decoded - input 1,408; spacing, position, tone PASS; tone window error 0 / 0; packet grid {1024} (not judged) |
| `neg_m5_gap_1000_removed_at_the_switch` | FAIL as required | on count, position, spacing, tone window |
| `neg_m5_interval_record_skewed` (mutation, proof build) | FAIL as required | on `interval_record_is_the_tap_boundary` only: error -480 / -482 |
| `neg_m5_switch_bound_judged_at_1us` | FAIL as required | |
| `m5_warn_silent_disconnect_never_switch` | PASS (second run) | raises 0.04 s after their duration, clears 0.06 to 0.14 s; tap peak 0 while the active mic is silent and the standby sounds; 1 interval record |
| `m5_rate_limit_reported` (8,000 ppm slow) | PASS | both mics warned by ID; telemetry 5,000.0 ppm; 1,618 samples missing each |
| `neg_m5_rate_inside_the_range` (2,000 ppm) | FAIL as required | no warning |

Core typecheck after the version step: 2 errors caused by this row in
`modules/recording-fragments/__tests__/recording-fragments.db.test.ts:212-213` (fixture without the
new members; request filed) and 26 in `engine/__tests__/seal-actions.db.test.ts` (row 82, not this row).

## 4. To wire when 71b lands

- `supervisor.ts`: accept a microphone ID on `MIC_RECORD_KINDS`, no ID on `SESSION_RECORD_KINDS`;
  device IDs only in `subjects`; fault key `(code, reason, subject)`; advisory reasons.
- Launcher: append `captureWorkerSettingArguments(...)`.
- `session_audio_intervals` from `AUDIO_SOURCE_INTERVAL` (`from_media_ms = floor((fromSample + 1024) * 1000 / 48000)`), closed by the next record or `AUDIO_TIMELINE_END`.
- Until then every `sup_*` check of the e2e series fails at the first record of a session.

## 5. Not proven

- Clock floor end to end: no fixture puts a camera 2 to 3 s behind with a wait at anchoring that hides it. Proven on the pure rule with two negative controls, and by no regression of the stall and offset cases.
- The 10 s silence default on a real session (the e2e uses 3 s through the setting; 10 s is proven on the raiser's sample clock).
- Real microphones: every check uses generated inputs.

## 6. Open for the controller

1. D71a-3: is "the boundary is about 45 ms before the command in capture time" acceptable as stated, or should the worker delay the switch by the latency so the boundary matches the command instant?
2. Finding (a): accept one skipped GOP at every camera start (specified, now reported), or open a row to place the first keyframe that has no sender report yet.
3. A static rule "`cur_map` is assigned in two places of `audio.c` only" would pin "never an automatic switch" structurally: row 61's file (`check.sh`), not edited here.

## 7. Device / browser checks left for the gate

None on the worker side. `M5-SW-W`, `M5-SW-T` (clients) read the interval rows and the audit that 71b writes.
