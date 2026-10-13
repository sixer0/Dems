---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 153
date: 2026-10-13
agent: coder-execution (batch 8, agent W2)
tier: T3
requirement: AD-05 (3) (never another host: at the first open and at every re-open); RC-6 (the relay's part: dials two targets, opens no file after its start, gives up the right to gain privileges before the first camera byte)
status: complete for the PORTABLE part, on this Mac's doubles. The Linux confinement is described (section 4) and proven by nothing here: row 141 / hardware
---

# Row 153: the relay's confinement - what is built, what was observed, what is left to Linux

Paths are under `apps/capture-worker/`. Runs: this Mac, loopback only, sandbox off, heavy-host lock per run, 2026-10-13.

## 1. What was built

| File | State | What |
|---|---|---|
| `src/relay/relay.c` | changed | `hygiene`: `RLIMIT_FSIZE` 0 beside the core-file limit (no regular file can grow by the relay's hand; `SIGXFSZ` ignored, such a write fails). The relay's own socket rule is asked after EVERY re-open (row 43's `camera_again`), as it is for the probe and the push; a leg that ended is closed at once, so during the waits the push is the only socket |
| `relay-check.sh` | changed | rules `RC-6` of the confinement (7 lines) with 2 planted lines and 5 mutations; the self-test is 51 controls |
| `test-fixtures/row153_confinement.py` | new | the run that observes: 6 runs, one the negative control of the observation |

Nothing of `relay_rtsp.c` was changed by this row.

## 2. The static half (`sh relay-check.sh src/relay`, part of `make`)

| Rule (tag RC-6) | Control that must be refused |
|---|---|
| the ONE connect is addressed with `start->host` and `start->port` (the locator's) | mutation: the address taken from a text of the camera |
| the three exchanges are DESCRIBE to the locator, SETUP to `track`, PLAY to `aggregate`; the two plain requests go to `aggregate`; both addresses come out of `relay_control_address`, which refuses another host or port | planted: an exchange to the camera's Content-Base as it came; mutation: SETUP to it |
| the socket rule is asked in exactly three places (probe, push, every re-open) | planted: a fourth caller; mutation: the re-open without it |
| `hygiene()` - core-file limit 0, file-size limit 0, on Linux not dumpable and "no new privileges" - stands before the library is prepared for the network, before the start message is read, before the camera object exists | mutation: moved behind the network preparation |
| `RLIMIT_FSIZE` 0 | mutation: removed |
| (existing, rows 41 / 186) no `open` / `fopen` / `opendir` / `avio_open`; no bind, listen, accept, datagram, resolver; one socket; the import net over the BINARY | their own controls |

Result: `static rules OK`; `--selftest` 51 lines `refused as required`, rc 0.

## 3. The observed half (`row153_confinement.py all`: `ROW153 CONFINEMENT: 6 run(s), 6 PASS, 0 FAIL`)

The relay's sockets (`lsof -nP -a -p <pid> -i`) and open files (`lsof -nP -p <pid>`) were read about four times a second for the whole run.

| Run | Observed |
|---|---|
| a session with a dropped and re-opened camera leg | 29 samples: only TCP, every socket connected, peers only `127.0.0.1:8565` (the locator's) and `127.0.0.1:8559` (the ingest port given); never more than 2; 0 regular files or folders held by a descriptor in any sample. The push was ONE connection from first to last (one local port), the camera side two (one per leg); a sample during the wait shows the push alone |
| after the loss: a redirect, given to the request that carried the right Digest answer | exit 25; requests at the camera `none` 401, `digest_ok` 302; connections, requests and authorised requests at the second port (8568): 0, 0, 0; no sample with a socket to another place |
| after the loss: control address on another port | exit 26; one description sent; second port: 0, 0, 0 |
| after the loss: control address on another host (127.0.0.2) | exit 26; no sample with a socket to another place |
| standard error on a regular FILE | exit 10 as through a pipe; the file holds 0 bytes (the pipe got the 204-byte exit line) |
| NEGATIVE CONTROL: a client with sockets to the camera AND its second port, and a listener, judged by the same rule | found: "a socket to another place", "a socket that listens or is not connected" (and its open files) |

The first-open forms of the same hostile answers are row 152's (`row152_hostile_relay.py`, unchanged).

## 4. The Linux confinement: described, NOT built, NOT proven

| Layer | What the host profile should hold | Why it is not here |
|---|---|---|
| "no new privileges", not dumpable | already in the code (`prctl`, Linux only), set in `hygiene` before the first byte; a failure ends with `HYGIENE_FAILED` | compiled on Linux only: read from the process table in row 141 (`NoNewPrivs: 1`, core limit 0) |
| System-call filter (seccomp) | an allow-list installed at the end of `hygiene`: read, write, poll / ppoll, recvfrom / sendto as the stream calls of the C library, socket (AF_INET stream only), connect, shutdown, close, fcntl, getsockopt / setsockopt / getsockname / getpeername, clock_gettime, mlock, mmap / munmap / brk for the allocator, getrandom, rt_sigaction / rt_sigreturn, exit_group; everything that opens a path, binds, listens, accepts, executes or forks: killed | the list must be MEASURED on the pinned Ubuntu library (what `avformat_write_header` and the RTSP writer really call); a guessed list either kills a good relay or allows too much. A filter cannot hold `connect` to an address: that is the next line |
| Destination | the Core's unit (the relay is its child): `IPAddressDeny=any` with `IPAddressAllow=` the capture network and loopback, or the nftables rule of the host profile per service user | host configuration (row 135 / WP-14), needs root |
| File system | the unit: `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp=yes`, `NoNewPrivileges=yes`, `RestrictAddressFamilies=AF_INET AF_UNIX`, `MemoryDenyWriteExecute=yes`, `CapabilityBoundingSet=` empty | the same |
| Descriptors | `close_range` instead of the loop (review L-6) | Linux only |

What the portable part does NOT give: nothing here stops a relay whose code was subverted from opening a path for READING or connecting elsewhere - the static rules and the import net hold the program as written, the socket rule is the program checking itself. That is exactly what the Linux layers are for.

## 5. Unproven, and where it goes

- Every Linux statement of section 4: row 141 (process state in the container), the host profile, `9A/H-01`, `H-24`.
- `RLIMIT_FSIZE` on Linux behaves the same by the standard; not run there.
- A real network: a camera that redirects to a REAL other host (here: loopback ports and 127.0.0.2).

## 6. Driver decisions (for the controller to confirm)

1. **`RLIMIT_FSIZE` 0 in the relay** (not asked by name; the portable piece of "opens no file after its start" that can be enforced rather than searched for). If a deployment ever points the relay's standard error at a file, it stays empty: the door uses pipes.
2. **No seccomp filter was written blind** (section 4).
3. **The observation is by `lsof` samples** (a socket that lived shorter than a quarter of a second between two samples is not seen); the relay's own check and the static rules are the other two legs.

## 7. Requests

One line in `delegation_progress/file_requests.md`: row 141 (what to read in the container), not blocking.

---
*Generated: 2026-10-13*
