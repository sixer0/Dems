# E2E-W1 (verifier): every web console page in Live mode as SUPERVISOR, lane 3

**Status: needs-review.** The walk is complete and every required artifact exists. The defects and incidents below need the controller's ruling.

| Item | Value |
|---|---|
| Row | E2E-W1 (D191, D194) |
| Target | Core server 127.0.0.1:4423 (`dems_lane_3`, demo controls on), web console 127.0.0.1:5178 (Live) |
| Window | 2026-10-06 09:44:01 to 10:42:31 WIB (attempt 0 at 09:41:54 to 09:43, discarded: IN-1) |
| Browser | HeadlessChrome/153.0.8010.12 (Playwright headless shell 1243), raw CDP, fresh `$TMPDIR` profile (removed), 1440x900, plus one 390x844 capture |
| Report | `test/07a_e2e_web_supervisor.md` |

## Result

- Pages 15 / 15 visited. Commands: 189 exercised: **177 PASS, 8 FAIL, 4 BLOCKED**; 4 items not offered by the page (N/A).
- Core log: 298 request lines in the walk window, 0 lines at warn or above. All 4xx lines are expected or driver-caused (signed-out session probes, the intended wrong password, a driver probe of a non-existent route, a driver audit read while locked).
- Every network request of the page went to `127.0.0.1:5178` (5,411 http, 28 ws).
- Console: 2 warnings in the whole walk (camera feed fallback during finalization; the Scalar Try it client's cookie notice). No error, no exception.

## Defects for the controller

| ID | Severity | One line | Evidence |
|---|---|---|---|
| E2E-W1-1 | High | Chain of custody names the session's creator (OPR-001) as the actor of RECORDING_STOPPED, although OPR-002 ended the recording (audit 236 says OPR-002) | `packages/shared/src/sim/session-machine.ts:840-841` (`actorId: session.createdBy`); screenshot 162 |
| E2E-W1-2 | Medium | Dashboard device menus disable "Test signal" for SUPERVISOR ("Requires the Technician role") while the contract (op 49, `DIAGNOSTICS_RUN`) and the role matrix allow it; the Devices page offers it and the Core accepts it (204, audit 108) | `apps/core-web/src/features/dashboard/devices-panel.tsx:44,158`; screenshots 08, 10, 90. The dashboard spec S20 disagrees with the contract: ruling needed |
| E2E-W1-3 | Medium | Evidence detail integrity card shows "NOT VERIFIED" on every fresh visit although the Core record holds `verification: PASS` and the list preview shows "Last verification PASS" | `apps/core-web/src/features/evidence/integrity-tab.tsx:53-54`; screenshots 71, 72 |
| E2E-W1-4 | Medium | Metadata tab shows the bundled DEMO package of another item (EV-20261001-0012, SES-20261001-0022, 1 Oct) on the page of EV-20261006-0012, with no notice | screenshots 66, 67; related F69-4 |
| E2E-W1-5 | Low | Dashboard hero ring: "ATTENTION" wider than the ring at 1440x900 | screenshot 05 |
| E2E-W1-6 | Low | Dashboard at 390x844: status strip labels overlap | screenshot 24 |

17 observations (O-1 to O-17, no FAIL) are listed in the report §20.

## Blocked / not offered

- BLOCKED: wizard Start Recording (no paired tablet connected on lane 3: README known limit; the recording commands were exercised through the demo Recording scenario instead); Paired Devices revoke (0 devices on lane 3); Security & Audit "Download again" (headless automatic-downloads limiter); Login "Demo operators" disclosure (would show the password: rule).
- N/A (the page offers no such command): evidence review/approve/reject; Security & Audit sessions list and per-session sign-out; Network & Time commands (read-only by spec); Users & Roles create user and password reset.

## Incidents and decisions

| ID | What | Handling |
|---|---|---|
| IN-1 | 09:42: E2E-W2's driver reached my browser through the shared fixed port 9431, navigated it to 5173 and signed `budi.santoso` in on lane 3 (audit 95). Confirmed by the controller's note | I signed that session out (audit 96), discarded attempt 0 (`test/assets/e2e/w1_supervisor/aborted_run0_port_collision/`) and restarted on 9473. From 10:27 I used an OS-assigned port read from `DevToolsActivePort`, with the listener PID checked and every connection refusing a foreign browser. No later step was affected; the walk window holds only OPR-002 and anonymous requests |
| IN-2 | Process slip: an expired pairing code (closed by the Core as EXPIRED, audit 93) shown as "ddd ddd" passed my 6-digit-only redaction into this agent's tool output and one line of `w1_observations.jsonl` | Scrubbed at once; redaction widened to 3+3 groups; not on any screenshot (blurred, checked visually); final scan finds 0. Value not repeated anywhere |
| D-1 | Session Monitor recording commands exercised via the demo "Recording" scenario (lane 3 only), because a Live recording needs a connected paired tablet | Recorded as O-17 / N12 BLOCKED; E2E-T covers a tablet-started session |
| D-2 | One date filter value set through the native value setter plus an `input` event (keystrokes into a native date input did not register in the headless shell) | Noted at E11 |
| D-3 | Demo actions on lane 3: two fault rounds, one scenario load (epoch 24 → 25), one demo reset (epoch 25 → 26) | All within the brief (lane 3 only) |

## State left

Lane 3: epoch 26 idle, no faults, users at seeded roles and enabled, storage 90 days with auto-archive on, no active pairing code, 0 paired devices, console signed out. 4423 and 5178 healthy at 10:42 WIB. Nothing started or stopped besides my own browser and recorder; profiles and downloads removed. No tracked file modified.

## Files created

- `test/07a_e2e_web_supervisor.md`
- `test/assets/e2e/w1_supervisor/` (207 PNG; `w1_core_requests.txt`, `w1_cdp_events.jsonl`, `w1_markers.jsonl`, `w1_observations.jsonl`, `w1_step_index.json`, `w1_page_console_network.json`, `w1_steps_driver.mjs.txt`, `w1_driver_lib.mjs.txt`, `w1_driver_recorder.mjs.txt`, `w1_driver_run.mjs.txt`, `w1_driver_summarize.mjs.txt`, `aborted_run0_port_collision/` with 5 files)
- `delegation_progress/e2e_w1_supervisor.md` (this file)

*Generated: 2026-10-06 10:58 WIB*
