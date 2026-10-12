---
task_slug: input_av_core_adapter_plan
row: 40
work_package: WP-03b (test camera, fault modes)
date: 2026-10-13
agent: coder-execution
status: complete
---

# Row 40: the test camera, fault modes

## 1. What was built

| File | State | What changed |
|---|---|---|
| `apps/capture-worker/test-fixtures/rtsp_test_camera.py` | modified, 671 -> 808 lines | seven opt-in switches (section 2), the second synthetic account constant (`:93-94`, beside the first at `:86-87`), five new counters, one optional `faults` member of the `ready` line |
| `apps/capture-worker/test-fixtures/rtsp_test_camera_check.py` | modified, 345 -> 721 lines | a second suite behind `--suite faults`; the base suite of row 39 stays the default and is untouched in what it checks |
| `.cache/rtsp-test-camera/check/row040/`, `row040_base/`, `row040_trial/` | git-ignored | results (`result.json`), event logs, the reference client's error text with every account removed |

No other file was touched, no dependency added, nothing built into `apps/capture-worker/build/`, no Makefile line.

**The double.** The same pull-side RTSP server of row 39 (Python standard library, the picture encoded once by the installed `ffmpeg`), standing for an IP camera on the camera leg of the relay. Row 40 adds the ways a camera or a device at a camera's address misbehaves. Redirects and hostile descriptions are row 152's and are not here.

**Additive by construction.** Every switch has a default that is the base camera. Proven, not assumed (section 4): the base check of row 39 ran unchanged, 12 of 12; the member names of every event of a default camera are equal to those of row 39's own run.

## 2. The switches (exact spelling, for the relay rows 41 to 44, 152 and the session rows)

| Switch | Values, default first | What the camera does |
|---|---|---|
| `--challenge` | `digest`, `basic`, `both` | `basic`: every request that needs an account gets 401 with ONE line, `WWW-Authenticate: Basic realm="DEMS test camera"`. **Nothing is ever granted**, not even a correct Digest answer (the camera gave no nonce). `both`: two lines, Basic first, then Digest; only Digest is granted. OPTIONS stays open as before |
| `--first-keyframe-delay-ms N` | `0`; 0 to 120000 | the first keyframe of EVERY PLAY comes N ms after the PLAY answer |
| `--first-keyframe-fill` | `inter`, `none` | what is sent during the delay. `inter`: pictures that are not keyframes at the picture rate, with no parameter set among them (a camera joined in mid group; the relay must drop and count them). `none`: nothing at all, not even a sender report (a camera slow to start: the session-start timing tests of addendum 3) |
| `--drop-after-frames N` | `0` | the camera ends the connection after exactly N pictures of a PLAY, with no TEARDOWN and no warning. The NEXT PLAY, on a new connection, goes on with the very next picture of the clip (picture N), so it does not begin on a keyframe. Refused (exit 2) when any `k x N`, k = 1 to the drop count, is a multiple of `--gop` |
| `--drop-count C` | `1`; 1 to 100 | the first C streams that reach N pictures are dropped; each resume goes on where the last drop ended (N, 2N, ...). Later streams begin at that same place and run to `--frames` |
| `--drop-style` | `fin`, `reset` | how the dropped connection ends: an orderly close, or a reset (within 0.5 s of the last picture) |
| `--account` | `plain`, `special` | `special`: the camera's account is `SPECIAL_ACCOUNT_USER` / `SPECIAL_ACCOUNT_PASSWORD` (`rtsp_test_camera.py:93-94`): both hold `@ / %` and a space; the password also a `:` and a literal `%40` (a client that decodes twice fails). The plain account is then refused. Tests import the constants; they are never written by the camera |

How the existing things behave with a switch on:

- `--frames N` counts from the first keyframe of a delayed stream: a delayed PLAY sends the lead pictures, then N. `frames_sent` counts all of them; `pre_keyframe_frames_sent` the lead alone.
- RTP time and sequence run on through the lead; a resumed PLAY has a new random sequence and time base (stated in `RTP-Info`), the same SSRC.
- In `--param-sets sdp` a resumed stream never carries a parameter set; in `inband` the first sets arrive with the first keyframe after the resume. Both are what F10 (a) needs the relay to survive.

**What the relay rows read.** Counters of the `exit` line (a counter that never counted is ABSENT, read it as 0):

| Counter | Meaning |
|---|---|
| `auth_basic` (row 39) | requests that carried `Authorization: Basic`. **This is the S13-01 (b) number: the relay must leave it at 0** |
| `auth_basic_account_match` | of those, how many held exactly this camera's account. A count; the value is compared in memory and dropped |
| `basic_challenges_sent` | 401 answers that offered Basic |
| `streams_dropped` | streams ended by `--drop-after-frames` |
| `pre_keyframe_frames_sent` | pictures sent before a delayed first keyframe |

Events: a camera with a stream fault adds to `stream_start` the members `first_index`, `first_index_is_keyframe`, `first_keyframe_delay_ms`; to `stream_end` those plus `pre_keyframe_frames_sent`, and for a drop `reason: "fault_drop"`, `next_index`, `drop_style`. The `ready` line gains ONE member, `faults` (the switches in force), only when a switch is on; its `authentication` reads `basic` or `basic+digest` in those two modes and `digest` otherwise.

Examples:

```
python3 -B apps/capture-worker/test-fixtures/rtsp_test_camera.py --port 8566 --challenge basic
python3 -B apps/capture-worker/test-fixtures/rtsp_test_camera.py --port 8566 --codec hevc --param-sets inband --first-keyframe-delay-ms 20000 --first-keyframe-fill none
python3 -B apps/capture-worker/test-fixtures/rtsp_test_camera.py --port 8566 --drop-after-frames 37 --drop-count 2 --drop-style reset
python3 -B apps/capture-worker/test-fixtures/rtsp_test_camera.py --port 8566 --account special
```

## 3. Verification

Commands, from the repository root, command sandbox off, 2026-10-12 19:13 to 19:22 UTC, FFmpeg 9.0.2, Python 3.14.7:

```
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
  python3 -B apps/capture-worker/test-fixtures/rtsp_test_camera_check.py --suite faults --port 8570 --runs 3 \
  --out .cache/rtsp-test-camera/check/row040
```

Seven modes, each on `h264` with the sets in the description and on `hevc` with the sets in band, 3 runs each, a fresh camera per run (two per drop run). Two clients: an own raw-socket RTSP client inside the check (it sees the wire: challenge lines, arrival times, every picture rebuilt from its RTP fragments and compared byte for byte with the clip), and the reference client

```
ffprobe -v error -rtsp_transport tcp -count_frames -select_streams v:0 \
  -show_entries stream=codec_name,width,height,r_frame_rate,nb_read_frames -of json <locator>
```

with the account percent-encoded in the user part (every character outside `A-Z a-z 0-9 - . _ ~`, as addendum 2.5 asks of the relay).

Result line: `RESULT PASS  suite faults  runs 42  passed 42  listener_left []  .cache/rtsp-test-camera/check/row040/result.json` (exit code 0; a one-run trial before it, 14 of 14, no repair was needed).

| Cell statement | Evidence, each in 3 of 3 runs on both codecs (`result.json`) |
|---|---|
| **Basic challenge** answers as stated | no account: 401, schemes offered `["basic"]`, 1 challenge line. A Digest answer made with the right password: 401, `["basic"]`. A Basic request of the own client (a value that is not the account): 401, counted. `ffprobe` with the right account: rc 1, 0 streams. Camera: `auth_basic` 2 (1 own, 1 `ffprobe`), `auth_basic_account_match` 1, `auth_digest_ok` 0, `streams_started` 0, `basic_challenges_sent` = `challenges_sent` = 5 |
| `both` (beside the cell) | 401 with `["basic","digest"]`, 2 lines; Digest granted (own client 30 pictures; `ffprobe` rc 0, 50 of 50, 0 Basic requests); a Basic request refused and counted |
| **Delay before the first keyframe** (2000 ms) | `inter`: 50 pictures before the first keyframe, 0 keyframes and 0 parameter sets among them; first keyframe 2.005 to 2.010 s after the PLAY answer; then 50 of 50 pictures equal to the clip, 2 keyframes. Those 50 lead pictures written as a file, with the description's sets in front: `ffprobe` decodes 0 pictures. `none`: 0 packets before 2.001 to 2.008 s, then the same full stream. `ffprobe` on the live stream: rc 0, 50 of 50 in every run |
| **Drop and resume in mid group** (N = 37, group 25) | first connection: exactly 37 pictures equal to clip pictures 0 to 36, ended by the camera (`fin`; `reset` seen as a reset), 12 pictures after the last keyframe. Second connection: served, 75 pictures equal to clip pictures 37 to 111, the first NOT a keyframe, 13 pictures and 0 parameter sets before the first keyframe. Events: `fault_drop`, `next_index` 37; `first_index` 37, `first_index_is_keyframe` false. `ffprobe`: 37 pictures from the first connection; 62 (= 75 - 13) from the second, rc 0 |
| **Account with `@ : / %` and a space** | challenge Digest only; the plain account: 401; the special account with Digest: DESCRIBE, SETUP, PLAY 200 and 30 pictures (own client); `ffprobe` with the percent-encoded locator: rc 0, 50 of 50, 0 error lines; with a wrong password: rc 1, 401, 0 streams. `auth_basic` 0 |
| Every mode | listens on `127.0.0.1:8570` only while running; cameras rc 0, `errors` 0; the event log holds 0 occurrences of an account value (plain, percent-encoded, or as a Basic value) |

**The default is unchanged** (same lock, 19:19 to 19:22 UTC):

```
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
  python3 -B apps/capture-worker/test-fixtures/rtsp_test_camera_check.py --port 8570 --runs 3 \
  --out .cache/rtsp-test-camera/check/row040_base
BIND RULE refused_ports=11 all_rc_2=True no_address_option=True bind_calls=1 datagram_sockets=0
PASS h264 sdp / h264 inband / hevc sdp / hevc inband, run 1..3: frames 125/125 errors 0, 401 ['digest']/['digest']
RESULT PASS  runs 12  passed 12  listener_left []  .cache/rtsp-test-camera/check/row040_base/result.json
```

and `EVENT_MEMBERS row039 == row040_base: True` (the member names of `ready`, `request`, `stream_start`, `stream_end`, `connection_closed`, `exit` of a default camera, compared with row 39's kept run).

After the runs (sandbox off for the two process commands):

```
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':85(6[5-9]|7[0-4]) '     -> no row
pgrep -fl "rtsp_test_camera|row040_colon"                      -> no row
node scripts/secret-scan/count-only.mjs .cache/rtsp-test-camera <the two fixture files>
  -> scanned 189 file(s); camera-credential: 0, ingest-secret: 0, TOTAL: 0 in 0 file(s)
own search for the four account values (plain, percent-encoded, Basic-encoded) in 177 kept files -> 0 files
```

The two synthetic accounts exist in one place, the constant block of the camera file; the scan counts no locator shape in either file.

## 4. Findings for the relay rows (facts of this Mac, FFmpeg 9.0.2)

1. **HS-1 is real on the pinned library family.** Challenged with Basic only, `ffprobe` sent one request with `Authorization: Basic` that held the camera's account (`auth_basic_account_match` 1, 6 of 6 runs). The library does answer Basic by itself. S13-01 (a) therefore needs an act of the relay; row 41 measures itself with `--challenge basic` and must read `auth_basic` 0.
2. **Offered both, the library chooses Digest** (`both`: 0 Basic requests of `ffprobe`, 6 of 6 runs). The exposure is the Basic-only responder, which is the forged-responder case of S13-01.
3. **HA-7 holds for the reference client:** a percent-encoded user part is decoded once before the digest (the literal `%40` in the password survives).
4. **A colon in the USER NAME cannot be expressed.** One probe (a scratch script, port 8571, same lock; not part of the suite): user name `test:cam`, percent-encoded as `%3A`: `ffprobe` rc 1, 401, camera `auth_digest_refused` 1, `auth_digest_ok` 0. The library splits the decoded user part at its first colon. This is why the special user name holds no colon; whether the Core must refuse such a name at entry is the controller's to route (row 41 or the credential rows).
5. **Decoders skip to the keyframe, loudly for HEVC.** Resumed or delayed in mid group, `ffprobe` counts only the pictures from the first keyframe on (62 of 75; 50 of 100). H.264: 0 error lines. HEVC: 28 (resume) and 102 (delay) error lines for the pictures it could not reference. The relay's own count of what it drops is the number to trust, not the library's text (S13-02 (a) forbids keeping that text anyway).

## 5. What stays unproven (hardware package)

- How a real camera behaves on a re-open (its phase in the group, whether it repeats the sets, how long it waits): `9A/H-11`, `H-21`. An account with special characters on a real camera: `9A/H-23`.
- The client that matters is the relay (rows 41 to 43); Linux is row 141. The facts of section 4 are of `ffprobe` on this Mac.
- A stall (the connection stays open and nothing comes), a wrong realm, a credential refused on a re-open (`AUTH_REFUSED`, addendum 2.4), a missing path on a re-open (`LOCATOR_STALE`): not in this row's cell, not built. A missing path can already be produced by starting a second camera with another `--path` on the same port.

## 6. Requests and driver decisions

Request (`delegation_progress/file_requests.md`, not blocking): the fixture table of `apps/capture-worker/README.md` names the fault switches.

DRIVER DECISIONS for the controller to confirm:

1. **Basic mode grants nothing.** A camera that accepts Basic would let a test pass with the password already on the wire. The relay's obligation is to send none; the count shows it.
2. **`both`, `--first-keyframe-fill none`, `--drop-style reset`, `--drop-count`** are beside the cell's four modes: each is one small branch, each ran 3 times on both codecs, and each answers a question a later row has (which scheme the library picks; a silent camera at session start; a reboot against a clean close; a second loss).
3. **The delay applies to every PLAY**, also a resumed one; `--frames` counts from the first keyframe.
4. **The resume is deterministic** (the next picture of the clip), not tied to wall time, so a test knows how many pictures the relay must drop: `gop - (N mod gop)`.
5. **The special user name holds `@ / %` and a space but no colon** (finding 4); the password holds all five.
6. **A second account constant in the same block of the same file.** S13-16 (2) says one synthetic account constant in one test file; the row asks for a second account. Both stay in one place and neither is ever written.
7. **Ports.** The runs bound `127.0.0.1:8570` (and `:8571` once), inside 8565 to 8574 (C33), leaving 8565 to the relay row that runs beside this one.

Requirement identifiers: the fixture side of S13-01 (b) (a fake camera that challenges Basic and counts), of F10 (a) and HA-1 (a resume in mid group), of F10 (c) and HA-7 (the special account), of HA-8 (the delay). The relay side of each closes in rows 41 to 44.

---
*Generated: 2026-10-13 02:30 (local)*
