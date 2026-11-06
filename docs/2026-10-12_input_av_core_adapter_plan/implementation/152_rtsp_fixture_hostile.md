---
task: 2026-10-12_input_av_core_adapter_plan
row: 152
milestone: M3 / AD-05, AD-06
agent: coder-execution (batch 7, agent R/T/X as agent X)
date: 2026-10-13
tier: T3
status: complete
---

# Row 152 - the test camera's redirect and hostile descriptions; the relay refuses each

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `TF` = `apps/capture-worker/test-fixtures`.

## 1. Change set

| File | Change |
|---|---|
| `TF/rtsp_test_camera.py` | four opt-in switches (one argument group "row 152"): `--second-port N`, `--redirect first\|authenticated`, `--sdp-control other-port\|other-host`, `--sdp-codec lower\|hostile`. Defaults `0 / none / track / real`: then nothing of it exists. The one `.bind(` of the program now serves the first port and, when asked, the second (still ONE call in the source). New counters, present only when they count: `second_port_connections`, `second_port_requests`, `second_port_authorized`, `redirects_sent`, `foreign_control_descriptions`, `hostile_codec_descriptions`. A camera with such a switch adds its members to `faults` of the `ready` line; the base `ready` line is unchanged |
| `TF/rtsp_test_camera_check.py` | a third suite, `--suite hostile` (`--hostile-modes`, `--second-port`); `base` stays the default, `faults` untouched |
| NEW `TF/row152_hostile_relay.py` | the EXISTING `build/capture-relay` against the camera's new switches; imports `row041_relay.py` unchanged; a case the relay does not refuse gets the verdict FINDING |

Not touched: `apps/capture-worker/src`, the Makefile, the build (the relay binary of 05:57 was driven as it is), `row041_relay.py`, `README.md`.

## 2. The three hostile modes

| Mode | What the camera does |
|---|---|
| redirect | DESCRIBE on the first port is answered `302` with `Location` on the camera's SECOND loopback port: `first` at once, before any challenge; `authenticated` after the right Digest answer (a wrong answer gets 401 again). The second port serves the same camera and counts who arrives |
| control address | the media control address of the description is an absolute locator of another place: `other-port` the second port; `other-host` the address `127.0.0.2` with the camera's port (the loopback net, an address the program never binds, never a name: no look-up or packet leaves this machine). `Content-Base` stays honest |
| codec name | `hostile`: the `a=rtpmap` name is exactly 300 characters - the real name in lower-case letters, markup (`<script>alert(1)</script>&"'<b>`), filler. `lower`: the real name in lower-case letters. The stream stays the real codec |

Rules held before any socket: the second port passes the same port rule as the first and is not the first; `--redirect` and `--sdp-control other-port` without `--second-port` are refused (exit 2). No event line carries a locator or the hostile text.

## 3. Checks (2026-10-13; command sandbox off; each run under `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock`, one hold per command; ports 8565, 8568, 8570, 8571)

| Check | Result |
|---|---|
| `rtsp_test_camera_check.py --suite hostile --port 8570 --second-port 8571 --runs 1 --size 640x360` (6 modes x 2 codecs) | `SWITCH RULE refused=8 all_rc_2=True nothing_listening=True bind_calls=1 datagram_sockets=0`; `RESULT PASS  suite hostile  runs 12  passed 12  listener_left []` |
| `row152_hostile_relay.py all` (the existing relay; 7 cases x 2 codecs) | `ROW152 HOSTILE RELAY: 14 run(s), 14 PASS, 0 FINDING, 0 FAIL` |
| `rtsp_test_camera_check.py --port 8570` (base, unchanged) | `BIND RULE refused_ports=11 all_rc_2=True no_address_option=True bind_calls=1 datagram_sockets=0`; `RESULT PASS  runs 12  passed 12  listener_left []` |
| `rtsp_test_camera_check.py --suite faults --port 8570` (unchanged) | `RESULT PASS  suite faults  runs 42  passed 42  listener_left []` |
| listeners on 8565-8574 afterwards | none |

Verification cell, "each of the 3 modes answers a reference client as stated": the suite's own client reads the 302 and its Location, the foreign control address, the 300-character name; it then FOLLOWS on purpose and is served and counted on the second port (1 connection, 4 requests, 3 with a Digest answer), which proves the trap is real.

## 4. The relay against each mode (the existing binary)

| Case (h264/sdp and hevc/inband) | Relay exit | Camera saw |
|---|---|---|
| redirect, at once | 25 `REDIRECT_REFUSED` | 1 DESCRIBE; second port 0 connections; 0 Digest answers |
| redirect, after the Digest answer | 25 `REDIRECT_REFUSED` | 2 DESCRIBE; second port 0; 1 Digest answer |
| control address on the second port | 26 `CONTROL_ADDRESS_REFUSED` | 2 DESCRIBE, no SETUP; second port 0 |
| control address on 127.0.0.2 | 26 `CONTROL_ADDRESS_REFUSED` | 2 DESCRIBE, no SETUP |
| codec name of 300 characters with markup | 28 `CODEC_NOT_SUPPORTED` | 2 DESCRIBE, no SETUP; 0 occurrences of the text in what the relay wrote; no line of 300 characters |
| CONTROL: no hostile switch | 40 `INGEST_REFUSED` (nothing listens at the ingest) | DESCRIBE, SETUP, PLAY, TEARDOWN |
| OBSERVATION: codec name in lower-case letters | 40 `INGEST_REFUSED`: the relay takes `h264` / `h265` as the codec | DESCRIBE, SETUP, PLAY, TEARDOWN |

In every run: 0 occurrences of the account, the locator, the ingest address, the second-port address, `127.0.0.2` and the markup in the relay's output; every line of fixed shape; no process left.

**Findings: none.** The relay refuses all three hostile modes. The observation is not one: codec names of a description are case-insensitive, the relay maps the name to its closed set of two, and no device text is passed on.

## 5. The double, and what stays unproven

Double: the test camera on loopback. Unproven: a real camera or network device that redirects or names another host (hardware package; the relay's 5 s connect bound is not reachable on loopback either, row 186). `ffprobe` given the 300-character name ends with rc 0 and no stream (kept as a fact in the suite's result; no criterion).

## 6. Identifiers

AD-05 (3) "a redirect and a foreign control address are never followed" and S13-01 "never another host": the fixture exists and the relay's refusal is measured against it. AD-06 "the codec from a closed set, no device text": measured for the description's codec name.

## 7. Requests

None. (A line for the fixture table of `apps/capture-worker/README.md` is agent W's file: the three switch groups and `row152_hostile_relay.py` may be added there.)

## 8. Driver decisions

- DD-1: "another host" is the literal `127.0.0.2`, not a name and not a documentation address: nothing may leave loopback.
- DD-2: the redirect has two variants (before and after the Digest answer); the second is the one in which a client holds an answer it could carry along.
- DD-3: the hostile suite ran with `--runs 1` at 640x360 (12 runs) to keep the hold short; base and faults ran at their defaults.
- DD-4: the relay cases live in a NEW file and run without a worker: every hostile case must end before there is anything to push.
- DD-5: `codec_lower` is an observation, not a refusal the relay owes.
