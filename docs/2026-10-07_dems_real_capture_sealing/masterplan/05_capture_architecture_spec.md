---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: data-analyst-local
blueprint_row: 31
milestone: M0
class: B (GA:OD-03, OD-05, OD-06, OD-11, OD-14, OD-21, OD-25)
tier: 1
artifact_type: capture architecture spec
status: complete
confidence: >-
  HIGH for every mechanism grounded in the M1 spikes (rows 7/8/9) and the engine pick (row 15);
  MEDIUM for the placements the spikes did not measure (fsync survival, in-file GCM layout,
  Range-decrypt latency, real adapters) — each of those is labelled HYPOTHESIS in section J.
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md
inputs_read:
  - identification/02_structured.md row 31 (line 211), row 15 (line 195), §5, §6, §7
  - masterplan/01_specs.md §E.1/§E.2 and §D
  - research/12_spike_s3_media_engine_pick.md (row 15 — binding)
  - research/06_spike_s1_fmp4_running_hash.md (row 7)
  - research/07_spike_s2_mic_switch_timeline.md (row 8)
  - research/08_spike_s4_av_sync_fixture.md (row 9)
  - research/03_analysis.md (register + errata + W1 corrections)
  - research/02_collection.md (F-44/F-47/F-49..F-53/F-58..F-62/F-91/F-97..F-102), research/04_collection_stt.md (G-4)
  - initialization/01_env_check.md §3 (FFmpeg 9.0.2 option text)
  - decisions/decisions.md D4 (gate answers), D7, D10, D12
  - apps/core-server/src/engine/host.ts:897-902, engine/types.ts:205-209, engine/__tests__/static.test.ts (integration precedent)
  - research/01_explore.md §2.4 (the 21 src static guards)
last_updated: 2026-10-09 (pair-review errata PE-57-01..PE-57-10 and PE-111-01..PE-111-07 applied, decisions D65-D68, see masterplan/11_audit_errata.md §5; earlier: 2026-10-08 RV-SPEC AU-2 errata AU2-03..AU2-08; 2026-10-07 row-35 security remediation SEC35-04/08/09/10/23/25)
---

# Capture Architecture Spec (blueprint row 31, M0)

This is the design of the capture layer. It is a spec, not an implementation: M3 implements it.
Every design choice carries a citation to a spike report (row 7/8/9/15), the register
(`research/03_analysis.md`), a decision ID, a collection fact (F-xx) or an `initialization/` line.
A mechanism with no such citation is labelled **HYPOTHESIS** and collected in section J.

## 0. Decision inputs in force

| Decision | Answer | Effect on this spec |
|---|---|---|
| OD-03 (D4) | Per-fragment AES-256-GCM **in the camera file**; record **both** the stored-bytes and the plaintext hashes | Section D; NM-05 |
| OD-05 (D4) | Both camera topologies supported; fakes emulate two cameras | Section A (NM-01/NM-09) |
| OD-06 (D4) | AAC-LC 48 kHz mono; transport behind `AudioInputAdapter`; USB working assumption | Sections A (NM-10), F |
| OD-11 (D4) | `MIC_SILENT` below −50 dBFS for 10 s = WARNING, never an auto-switch; 2 s disconnect debounce; contract constants | Section E |
| OD-14 (D4) | P25 waiver limited to module registration, the `capture` seam, capture config keys, supervisor start/stop; each edit reviewed | Section I |
| OD-21 (D4) | Fragmented MP4 is treated as "one whole file"; the segments+lossless-concat fallback stays designed | Sections C, D |
| OD-25 (D4) | All media in git-ignored paths; `docs/` text evidence + small stills only | Section H |
| D10 (row 7 S1) | G-1 restart-per-session; G-2 `empty_moov` disables auto-BSF but copy works; G-3/SP-4 GOP = fragment quantum; SP-2 flush ≠ fsync | Sections B, C |
| D10 (row 8 S2) | Operator switch works only through the libavfilter API; realised boundary = the next worker input quantum (≤ 10 ms with 10 ms push chunks; ≤ 1 AAC frame = 21.333 ms only in a 1024-sample pull loop) — **erratum AU2-07** (D18) | Section E |
| D12 (row 9 S4) | Aligned AV relative offset **0.00 ms** (sample-exact: +0.021 ms = one sample); injected +80 ms measures 80.021 ms, −80 ms measures −80.052 ms — **erratum AU2-03** (D18): the earlier "−1.333 ms / 78.667 ms" were 10 ms analysis-window artefacts of row 9's analyser | Sections A (NM-14), F |
| D18 (AU-2 audit) | AU2-03..AU2-08 errata applied in sections C.1, C.5, E, F, J (H-10); `masterplan/11_audit_errata.md` | Sections C, E, F, J |
| D65 / D67 (row 57 pair) | Protocol has `HELLO` and `ACK`; `CaptureSupervisor` has `boot()`/`shutdown()`; the worker's output is never paused; the worker-event queue is hard-bounded and **lossy**; a lossless record frame class is required work for row 58; restart rule = option C per OD-08 (no respawn into an existing evidence file); row 57 closes NM-03, CS-01, CS-03 only — **errata PE-57-01..PE-57-10** (`masterplan/11_audit_errata.md` §5) | Sections A.3, B.1, B.2, G, I |
| D66 (row 111 pair) | Video anchored on the per-packet PRFT wall clock with a slew limit (not "re-anchor on later sender reports"); `delay_moov` evaluated by row 58 with a pinned-flags fallback; three mux options forbidden with `empty_moov`; worker required work for row 58 (no UDP sockets, `flush_packets`, audio keeps fragmenting, non-zero exit on a fatal error, mics from a separate process) — **errata PE-111-01..PE-111-07** | Sections A.2, A.4, A.8, C.2, C.4, F, J |
| D68 (row 113 pair) | OD-14's module-registration category is extended to `modules/stt-config`: P25 edits 13-14 — **erratum PE-57-08** | Section I |
| D12 (row 15) | Engine pick = FFmpeg 9.0.2 with an **embedded libavfilter** capture worker; GCM/manifest/signer engine-independent | Sections B, C, D |

**Register re-slicing note.** The register (`research/03_analysis.md` §B.6) defines NM-01 as the
adapter layer, NM-09 as the config store + API, NM-10 as the mic-switch API. The row-31 brief
re-slices these three by concern (NM-01 registry; NM-09 camera/PoE seams; NM-10 audio seam +
switch controller). This spec follows the brief and cites the same register rows; the config store
and the API operations remain owned by NM-09's register description (rows 29/CS-09) and are
referenced, not re-defined, here.

---

## A. Module interfaces (NM-01..NM-05, NM-09, NM-10, NM-14)

Nine interface units are specified: eight module IDs named by the brief, plus the `capture`
supervisor seam (section B), which is the ninth entity with its own interface, failure modes and
test hook. Sections A.1–A.8 give the eight module IDs; section B gives the ninth.

Each unit carries: **Purpose**, **Authority** (the citation for the mechanism), **Interface**
(sketch), **Failure modes**, **Test hook** (how a fake drives it without hardware).

### A.1 NM-01 — Capture device selector / adapter registry

| Field | Content |
|---|---|
| Purpose | Resolve configured capture devices (`VIDEO-01`, `VIDEO-02`, `MIC-01`, `MIC-02`, PoE port) to concrete adapters; hold the topology choice (OD-05: one dual-lens camera with two profiles **or** two PoE cameras); expose the device-contract commands whose map is derived from the contract, never restated (E-12) |
| Authority | Register NM-01 (`03_analysis.md` §B.6); OD-05/OD-06/OD-07/OD-22 (D4); E-12 (`03_analysis.md` §A); `DEVICE_COMMAND_OF_OPERATION` derived from the contract, not a second list |
| Target | `apps/capture-worker/src/adapters/` (register NM-01) |

Interface sketch:

```ts
type CaptureDeviceKind = 'CAMERA' | 'AUDIO' | 'POE';
interface CaptureDeviceDescriptor {
  id: string;                 // 'VIDEO-01' | 'VIDEO-02' | 'MIC-01' | 'MIC-02'
  kind: CaptureDeviceKind;
  label: string;
  capabilities: readonly ('VIDEO' | 'AUDIO' | 'PULL' | 'SNMP')[];
  profile?: string;           // dual-lens profile when OD-05 uses one camera
}
interface CaptureDeviceRegistry {
  list(): readonly CaptureDeviceDescriptor[];
  register(adapter: CaptureAdapter): void;   // duplicate id -> refusal
  resolve(kind: CaptureDeviceKind, id: string): CaptureAdapter;
}
type CaptureAdapter = CameraAdapter | AudioInputAdapter | PoeController; // NM-09/NM-10
```

Failure modes: unknown or unconfigured device id; duplicate adapter registration; `resolve` while
a session is open (config is locked, OD-10); a camera that exposes no audio stream while the
selector expects one; fake/real adapter mismatch (class-C adapters must never load in a test).

Test hook: `createFakeRegistry()` built from NM-14 descriptors with `FakeCameraAdapter`,
`FakeAudioInputAdapter`, `FakePoeController`. Real adapters are class C and are injected only from
the supervisor in `DEMS_CAPTURE_MODE=real`.

### A.2 NM-02 — Capture worker process

| Field | Content |
|---|---|
| Purpose | A supervised **separate process**: two RTSP/TCP ingests, two mic captures, one audio selector → one encoder → the single audio track muxed into both camera files with **no re-encode**; ~20 Hz meters; silence/disconnect detection; a PCM tap |
| Authority | Register NM-02; engine pick row 15 §1/§3.1 (FFmpeg + embedded libavfilter); S1 §3 (copy path, `-c copy`); S2 §6 finding 1 (two `abuffersrc` inputs → named `astreamselect` → `aformat` → native `aac`) |
| Target | `apps/capture-worker/` |

Interface sketch: the worker is process-level, driven only through the IPC protocol (section B.2);
its internal engine seam is NM-04. It publishes `TelemetryFrame` (levels, ingest state, fragment
counters), `SourceInterval[]`, `CaptureWarning[]`, and `FragmentCheckpoint[]`.

Failure modes: ingest exits on client `TEARDOWN` — the process is single-session by design
(S1 G-1); encoder init failure on a sprop-less SDP (S1 SP-6); output directory full (OD-25);
CPU starvation while STT runs (RK-1); a crashed worker leaves a truncated fMP4 (section C.5); **the
RTSP ingest listener binding to anything other than loopback (SEC35-23; §A.4/§A.8).**

**Required work for row 58, carried from the row-111 skeleton (errata PE-111-03, PE-111-04, PE-111-05, PE-111-07 and PE-57-10; D66, D67).**
Row 111 was accepted as a PROOF row (H-4, H-10); the skeleton `apps/capture-worker/src/capture_worker.c`
is not the worker. Row 58 must not start from it unchanged:

| # | Requirement (normative for row 58) | What the skeleton does today | Evidence |
|---|---|---|---|
| W-1 (PE-111-03) | **The worker owns no datagram socket.** A camera/client that asks for RTP over UDP must not make the worker open `*:5000` / `*:5001` (all interfaces). `rtsp_transport=tcp` on the listen ingest does **not** prevent it. Either refuse a non-interleaved session in the worker, or keep listen ingest for fixtures only and pull cameras with `rtsp_transport=tcp`. The bind check covers **UDP as well as TCP** (§A.4) | listen options are `rtsp_flags` and `listen_timeout` only (`capture_worker.c:330-335`); with a UDP client `lsof` shows `UDP *:5000`, `UDP *:5001` and the session records | pair-111 N-1 (`delegation_progress/pair_111_navigator.md:152-177`); SEC35-23 |
| W-2 (PE-111-04) | **Bytes reach the disk during a session:** the muxer option `flush_packets=1` is set on both outputs (§C.2) | no `flush_packets`, no `avio_flush` (`capture_worker.c:451-455`): both files stay at 28 bytes (the `ftyp`) until close | pair-111 N-2 (`pair_111_navigator.md:179-187`); S1 trap 4 (§A.4) |
| W-3 (PE-111-04) | **Audio keeps fragmenting after a camera stops:** a stalled or dead camera must not stop the audio of its own file from becoming durable. A bounded cut is made when no keyframe arrives (mechanism is row 58's; `frag_duration` as an upper bound above the GOP, or a timed `av_write_frame(ctx, NULL)`, are HYPOTHESES, not tested) | `frag_keyframe` cuts only on a video keyframe: with camera 2 killed at 4.18 s its file ended with one fragment holding **801 audio packets (17.1 s)** | pair-111 N-2 (`pair_111_navigator.md:188-199`); AU2-08 crash-loss window (§C.1) |
| W-4 (PE-111-07) | **A fatal error exits non-zero.** `fatal()` sets a sticky error flag that forces a non-zero exit code; a mux write failure, an encoder failure or a failed selector command mid-session must never look like a clean stop | `fatal()` sets only the stop flags (`capture_worker.c:128-133`) and `main` returns `rc = w->samples_in ? 0 : 1` (`:540`): exit 0 after the first quantum (by inspection, not reproduced) | pair-111 N-5 (`pair_111_navigator.md:205-213`) |
| W-5 (PE-111-05) | **In the AV check the mics are fed from a separate process** timed by its own wall-clock reads (§A.8), so that an error in T0 or a real capture latency cannot cancel on both sides | the beep is synthesised inside the worker from the same `t0_real` that shifts the video (`capture_worker.c:142`, `:269-272`, `:373`) | pair-111 N-8 and §3 item 2 (`pair_111_navigator.md:144-148`, `:221`) |
| W-6 (PE-57-10) | **The worker speaks `packages/capture-protocol`** (§B.2): NDJSON commands on stdin, frames on stdout and nothing else there, the plan from `START` (not argv), exit at end of stdin, one session per process, logs not on the closed stderr, empty environment, port range aligned with the protocol | plain-text `switch <n>` / `stop`, no frame written, session in argv, end of stdin does not stop it | pair-57 nine-point gap list (`delegation_progress/pair_57_navigator.md:172-189`) |

The minor findings N-6, N-7 and N-9..N-14 of the same review also ride with row 58 / row 62
(`pair_111_navigator.md:217-227`).

Test hook: NM-14 fake RTSP sources + fake mics; the worker is started by the supervisor under a
test configuration and driven by injected IPC messages; the engine can be replaced by a fake
engine implementing NM-04.

### A.3 NM-03 — Supervisor + IPC protocol

| Field | Content |
|---|---|
| Purpose | Spawn, stop, heart-beat and restart the worker with back-off; carry correlation IDs; bound the command window (the only back-pressure — **erratum PE-57-04:** there is **no** back-pressure toward the worker's output, which is never paused, §B.2); map worker events to the shared simulator's INTERNAL actions (the forwarder does not exist yet — §B.1, erratum PE-57-09) |
| Authority | Register NM-03; S1 G-1/SP-5 (restart the ingest **process** per session, not just the pusher); `setTabletLink` INTERNAL-action precedent (`engine/types.ts:205-209`, `host.ts:897-902`, `sim-actions.ts:93`) |
| Target | `apps/core-server/src/capture/*`; `packages/capture-protocol/NM-03` (register: `packages/capture-protocol`) |

Interface sketch:

```ts
interface CaptureSupervisor {
  boot(): Promise<void>;     // erratum PE-57-01 (D65): opens the supervisor for sessions; starts no worker (§I edit 11)
  shutdown(): Promise<void>; // erratum PE-57-01 (D65): stops the open session's worker (reason SHUTDOWN), waits for its exit; safe to call twice (§I edit 12)
  start(sessionId: string, plan: CapturePlan): Promise<void>; // one session = one worker + one file per camera
  stop(sessionId: string, reason: 'STOPPED' | 'CRASH' | 'SHUTDOWN'): Promise<void>;
  switchAudioSource(sessionId: string, to: MicRole): Promise<void>;
  status(): CaptureStatus;           // phase, heartbeat age, last crash
  on(event: CaptureEventName, listener: (event: CaptureEvent) => void): () => void;
}
```

**Erratum PE-57-01 (D65).** `boot()` and `shutdown()` are what the entry point calls (§I edits 11
and 12); the seam as built is `apps/core-server/src/capture/types.ts:118-129`
(`supervisor.ts:553-557`). `status()` also reports `queuedEvents`, `droppedEvents` and
`droppedTelemetry` (`types.ts:90-95`); the former `inputPaused` does not exist.

Failure modes: worker crash loop (back-off exhaustion → `CAPTURE_FAULT`); missing heartbeat beyond
the timeout; orphaned worker after a supervisor crash; broken IPC channel; a second start while a
session is open (refused, R-6); restart with stale listener on the same RTSP port (S1 G-1).

Test hook: a `FakeWorkerProcess` that the supervisor spawns instead of the real binary; the test
kills it and asserts restart, back-off and the emitted INTERNAL action.

### A.4 NM-04 — Engine / ingest (FFmpeg embedded, per row 15)

| Field | Content |
|---|---|
| Purpose | The engine seam and its FFmpeg implementation: RTSP listen/pull ingest, codec copy, fragmented-MP4 output. FFmpeg 9.0.2 behind an interface so a future engine swap does not rewrite the worker |
| Authority | Row 15 §1/§3.1 (binding pick); row 15 §5 item 1 (engine seam); S1 §2–§3 (four traps); S1 §4.6 (G-2) |
| Target | `apps/capture-worker/src/engine/` |
| Bind address (SEC35-23) | the **RTSP listen ingest** input URL host literal MUST be **`127.0.0.1`**; FFmpeg `-rtsp_flags listen -listen 1` defaults to `0.0.0.0`, so the command is built as `-rtsp_flags listen -listen 1 -listen_timeout <ms> -i rtsp://127.0.0.1:<port>/<name>` and **never** with a wildcard (`0.0.0.0`, `::`, a LAN address or a bare `rtsp://:<port>`). LAN binding is class C, opened only after OD-13's preconditions (demo-password replacement, B3, TLS/origin rules). **Erratum PE-111-03 (D66):** the rule covers **every socket of the worker process, UDP included** — pinning the listen URL to `127.0.0.1` is not enough, because a client that asks for RTP over UDP makes libavformat open `UDP *:5000` / `*:5001` on all interfaces, and `rtsp_transport=tcp` on the listen ingest does not prevent it (§A.2 W-1) | OD-13 (D4); S1 §2 (SP-1); SEC35-23; `specs C-N4`; pair-111 N-1 |

Interface sketch:

```ts
interface CaptureEngine {
  open(plan: CapturePlan): Promise<EngineHandle>;  // builds the graph, opens outputs
  on(event: EngineEventName, listener: (event: EngineEvent) => void): () => void;
  command(cmd: EngineCommand): Promise<void>;      // e.g. audio-map switch
  close(): Promise<void>;
}
```

Failure modes: the four S1 traps (explicit `-listen_timeout`, no trailing slash, per-source
`duration=`, `-flush_packets 1`); `empty_moov` disabling auto-BSF (handled by SDP extradata +
movenc AVCC conversion, S1 §4.6); extradata absent at ingest start (fail loudly, SP-6);
keyframe alignment loss under plain `frag_duration` (S1 §6.4).

Test hook: an `InMemoryEngine` implementing the same interface for unit tests; the real
`FfmpegEngine` is exercised only against NM-14 fixtures. **SEC35-23 verification:** a new check
`M3-RTSP-BIND-1` (proposed addition for row 36/37, sibling of `M3-WI-1`) starts the ingest and
asserts with `lsof -nP -iTCP:<port>` / `netstat -an` that the listening socket is bound to
`127.0.0.1` (loopback) only and **never** `0.0.0.0`/`*`; the static rule G-R4/SEC35-25 also forbids a
wildcard literal in the worker command. **Erratum PE-111-03 (D66):** as written the check cannot fail
on anything that is not a TCP listener on the two ports. Row 58 widens it to `lsof -nP -a -p <worker
pid> -i` = **every** socket the worker owns (TCP and UDP) is on `127.0.0.1`, with a client that
requests RTP over UDP as the negative control (`delegation_progress/pair_111_navigator.md:130`,
`:173-177`).

### A.5 NM-05 — fMP4 writer + fragment chain + encryption (OD-03)

| Field | Content |
|---|---|
| Purpose | Append-only fMP4; running SHA-256 chain over stored bytes **and** a plaintext chain; per-fragment AES-256-GCM; per-fragment checkpoint records |
| Authority | S1 §3.1 (SP-7 chain), S1 §5.4/§5.5 (durable prefix, drop-fragment); register NM-04/NM-05; OD-03 (D4); F-47/F-52/F-53 (GCM outside the muxer) |
| Target | `apps/capture-worker/` (writer) + `apps/core-server/src/capture/fragments.ts` (chain verification) |

Interface sketch:

```ts
interface FragmentCheckpoint {
  seq: number;                 // mfhd.sequence_number (-fragment_index counter)
  start: number; len: number;  // stored-byte range [start, start+len)
  fragSha256: string;          // SHA-256 over stored (ciphertext) bytes
  chainSha256: string;         // SHA-256(chain_{n-1} || fragSha256)
  prefixSha256: string;        // SHA-256(stored bytes [0, end of n))
  plaintextSha256: string;     // SHA-256 over this fragment's plaintext bytes
  gcmIv: string; gcmTag: string; keyId: string;
}
interface FragmentWriter {
  begin(header: EngineHeader, key: SessionKey): Promise<void>;
  appendFragment(bytes: Uint8Array): Promise<FragmentCheckpoint>;
  close(): Promise<FragmentsManifest>;
}
```

Failure modes: process kill mid-write (section C.5); `-flush_packets 1` is a userspace flush that
does **not** survive OS/power loss (S1 SP-2, AD-1); the muxer has no AEAD, so a naive
`-encryption_scheme` would be CTR-only and unauthenticated (F-47/F-52); the `mfra` trailer changes
the whole-file meaning (S1 SP-3).

Test hook: the S1 `monitor.py`/`verify.sh` pattern re-run against the worker output; re-derive the
chain with `dd|shasum`/`xxd` alone; a one-fragment tamper must fail exactly that fragment (M7).

### A.6 NM-09 — Camera / PoE adapter seams

| Field | Content |
|---|---|
| Purpose | `CameraAdapter` (ONVIF discovery, media-profile listing, RTSP/TCP pull URL, NTP offset) and `PoeController` (SNMP RFC 3621 adapter + fake; power-cycle a **lost** camera only) |
| Authority | Register NM-01/NM-09; OD-05/OD-07/OD-22 (D4); E-12 (command map derived from the contract) |
| Target | `apps/capture-worker/src/adapters/camera/`, `.../poe/` |
| Credential handling (SEC35-04) | the credential-bearing pull URL (`rtsp://user:pass@host`) is composed **outside** any log/audit call; `CameraAdapter.pullUrl` returns the host/path form and the credential is injected only at the worker spawn point; the FFmpeg worker **stderr is captured by code** (parsed for the failure, never logged raw); the camera-credential form `rtsp://user:pass@host` is added to G-R4 and to both log-blanking lists (`§G`; row 32 `06_evidence_package_spec.md §G.4`) | E-31; RK-12; SEC35-04; `specs C-N8` |

Interface sketch:

```ts
interface CameraAdapter {
  discover(): Promise<CameraDescriptor[]>;
  profiles(deviceId: string): Promise<MediaProfile[]>;
  pullUrl(deviceId: string, profile: string): string;   // rtsp://host/path (no trailing slash)
  ntpOffsetMs(deviceId: string): Promise<number>;
}
interface PoeController {
  status(port: number): Promise<'POWERED' | 'OFF' | 'UNKNOWN'>;
  cycle(port: number): Promise<void>;                    // only a lost-stream camera, audited
}
```

Failure modes: camera unreachable; ONVIF authentication refused (audit the refusal, E-30);
profile list changed since configuration; clock drift / NTP set refused; PoE cycle while healthy
(refused, OD-22) or during RECORDING (OD-22 gate); SNMP timeout.

Test hook: `FakeOnvifStub` (NM-14) for discovery/profiles/NTP; `FakePoeController` records cycles;
real adapters are class C (C-1/C-3).

### A.7 NM-10 — Audio input adapter + switch controller

| Field | Content |
|---|---|
| Purpose | `AudioInputAdapter` (USB working assumption, AAC-LC 48 kHz mono) and `MicSwitchController` (primary/standby hot standby, switch at the next worker input-quantum boundary on the filtering thread — AU2-07, interval records, silence warning) |
| Authority | OD-06/OD-09/OD-11 (D4); S2 §1 channel 6, §3 run3, §6 findings 1–4; F-44 (21.33 ms frame) |
| Target | `apps/capture-worker/src/adapters/audio/`, `apps/core-server/src/capture/mic-switch.ts` |

Interface sketch:

```ts
interface AudioInputAdapter {
  enumerate(): Promise<AudioInputDescriptor[]>;
  open(inputId: string): Promise<AudioStreamHandle>;
  level(inputId: string): Promise<number>;   // dBFS
}
interface MicSwitchController {
  switchTo(role: MicRole): Promise<void>;    // avfilter_graph_send_command(...,'map',...)
  intervals(): readonly AudioSourceInterval[]; // from_ms/to_ms in media-pts domain
}
```

Failure modes: no input device; disconnect (2 s debounce, OD-11); sustained silence
(< −50 dBFS for 10 s → `MIC_SILENT` warning, never auto-switch, OD-11); the switch command not
honoured (bound = one worker input quantum + IPC latency, section E — the "worst-case 1 AAC frame"
of S2 §6 finding 4 holds only for a 1024-sample pull loop, erratum AU2-07); a command issued from a
thread other than the filtering thread (forbidden, section E); both inputs down (capture fault).

Test hook: two fake mics with a level separation (S2 used `volume=0.3`, S2 §2); inject a switch
and assert `AudioSourceInterval` records and the warning — never an automatic switch.

### A.8 NM-14 — Fixture set

| Field | Content |
|---|---|
| Purpose | Fake RTSP sources, fake mics, a fake ONVIF stub, and the S4 flash+beep generator + offset analyser — the whole hardware-independent test bed |
| Authority | Register NM-14; S4 §2/§3/§7 (seed), S1 §3 (pipeline shape), S2 §2 (mics); RF-2 (`structured`: pull fixtures need MediaMTX, Q-INSTALL item 4) |
| Target | `apps/capture-worker/test-fixtures/` |

Fixture inventory: `fake-rtsp-source` (lavfi push, S1 §3 shape, one listener per session — S4-5);
`fake-mic-440`/`fake-mic-880` (S2 §2); `fake-onvif-stub`; the flash+beep generator
(≥ 50 fps, exactly one white frame on the grid, 1 kHz burst, truth JSON — S4 §7 items 1–2) with
**three** truth cases — aligned (0 ms), audio late (+80 ms) and audio early (−80 ms; AU2-04) — and the
`analyse.py` analyser (two FFmpeg passes, relative offset only — S4 §3), **corrected to detect the
audio onset at sample resolution** instead of 10 ms windows (AU2-03; AU-2 `s4/av_offset.py` method);
a **long-GOP fake camera** (`-g 250`, AU2-08) and a **separate-clock fake camera** process feeding
video while the audio comes host-side through the selector (H-10, AU2-06).

Failure modes: a reused RTSP listener silently records only the first session (S4-5); a port
collision on 8554–8564 (S1 guard rail); an off-by-one flash width (S4 §2 poka-yoke); **a fixture
listener bound outside loopback (SEC35-23).** The fake RTSP fixture readers **and** the worker ingest
listen only on `127.0.0.1:8554-8564`; the fixture's listen address is the same loopback literal as
§A.4, and the same check `M3-RTSP-BIND-1` asserts it (`nm-14`; SEC35-23) — for TCP **and UDP**
sockets (erratum PE-111-03).

**Fixture requirements added by the row-111 pair review (erratum PE-111-05; D66).** (1) In the AV
checks (`M3-AV-1`, `M3-AV-2`) the **fake mics are a separate process** timed by its own wall-clock
reads, not a generator inside the worker: with the beep synthesised in the worker from the same T0
that shifts the video, a T0 error or a capture latency cancels and cannot be seen (§A.2 W-5). (2) Row
62 adds a fake camera whose RTCP sender reports pair a true wall clock with a **drifting media
clock** (hand-written RTCP or another sender; libavformat's `rtpenc` derives the SR timestamp linearly
from the host NTP time and cannot express drift). Only that case may expect a drift slope near 0; the
present ±200 ppm case keeps its present expectation (the injected slope within the 2 ms regression
bound), see §F. (3) A "camera stops, audio keeps landing on disk" case (§A.2 W-3). (4) One of the
three forbidden mux options of §C.4 is kept as a **negative control** for `M3-AV-1/2`.

Test hook: the fixture is the hook; M3's worker integration drives it end to end.

---

## B. Seam and supervisor (the ninth interface)

### B.1 How the capture layer plugs in under the shared simulator

The capture layer never imports the simulator's internals. Worker events enter the durable state
only through the shared simulator's hosted/INTERNAL actions, exactly like the server-side
`setTabletLink` seam (`apps/core-server/src/engine/types.ts:205-209`; implementation
`apps/core-server/src/engine/host.ts:897-902`; declared INTERNAL with `operations: []` in
`packages/shared/src/api/sim-actions.ts:93`).

| Direction | Action | Kind | Register row |
|---|---|---|---|
| Client → Core | `switchAudioSource`, `setCaptureConfig` | hosted | SH-18 |
| Supervisor → engine | `applyCaptureTelemetry` | INTERNAL | SH-18 |
| Supervisor → engine | `applySealingProgress` | INTERNAL | SH-18 |
| Supervisor → engine | `completeSeal` | INTERNAL | SH-18 |
| Supervisor → engine | `raiseCaptureWarning` | INTERNAL | SH-18 |

The `capture` seam itself is provided by the capture module and read by the sessions/devices
modules; the interface is the `CaptureSupervisor` of section A.3. This is the seam OD-14's waiver
covers (section I).

**Closure status of the table above (erratum PE-57-09; D65(b), D67).** Row 57 (M3-W1) closes
**NM-03, CS-01 and CS-03 only**. **SH-18 and CS-04 remain open** — none of the six actions exists
yet: `packages/shared/src/api/sim-actions.ts` still lists `setTabletLink` as its only INTERNAL
action, and nothing forwards a supervisor event to the engine
(`delegation_progress/pair_57_navigator.md:35`, `:147-165`; `implementation/19_m3_supervisor_ipc.md:40-60`).
The claim of row 48 that SH-18 was closed was false. Owners:

| Open part | Owner row |
|---|---|
| `applyCaptureTelemetry`, `raiseCaptureWarning` + the forwarder that subscribes `app.capture.on('telemetry' \| 'progress' \| 'warning')` and calls the engine (it must never block the queue, §B.2) | **row 58** (M3-W2) |
| `applySealingProgress`, `completeSeal` (and the trigger for `completeSeal`: no message of §B.2 carries it; it must not be read from `PROGRESS` with progress 1 — it is a lossless record, §B.2) | **row 82** |
| the hosted pair `switchAudioSource`, `setCaptureConfig` | **row 66** (M4-W2, the row that makes operations 76-80 and 89 live) |

SH-18 and CS-04 close when row 82 is done. Each supervisor event already names the INTERNAL action
it is meant for (`CaptureEvent.action`, `apps/core-server/src/capture/types.ts`).

| Interface | Failure modes | Test hook |
|---|---|---|
| `CaptureSupervisor` (`boot`/`shutdown`/`start`/`stop`/`switchAudioSource`/`status`/`on` — erratum PE-57-01) | worker crash loop; heartbeat timeout; orphan; second start while open; broken IPC | `FakeWorkerProcess` + `app.seams.replace('capture', fake)` on a test configuration (`app.ts:54` "replace IS TEST-ONLY") |

### B.2 Worker topology and IPC protocol

One active session per Core (R-6). One recording session = **one worker process + one ingest
process + one output file per camera**. The supervisor restarts the ingest process per session
because the RTSP listen ingest exits 0 on client `TEARDOWN` and refuses a re-push (S1 §4.5 G-1,
SP-5; D10(b)).

| Message | Direction | Payload | Notes |
|---|---|---|---|
| `HELLO` | worker → supervisor | protocol version | **erratum PE-57-02 (D65):** the handshake the worker opens with, before anything else; a version mismatch ends the worker; the only place a version can be refused before a `START` with a plan is sent |
| `START` | supervisor → worker | `CapturePlan` (devices, profiles, outputs, constants) | one session |
| `STOP` | supervisor → worker | reason | flush + close |
| `SWITCH_AUDIO_SOURCE` | supervisor → worker | `MicRole`, correlation id | E (mic switch) |
| `ACK` | worker → supervisor | correlation id, `ok` | **erratum PE-57-02 (D65):** the worker's answer to a command, matched by the correlation ID the command carried |
| `TELEMETRY` | worker → supervisor | levels, ingest state, fragment counters | ~20 Hz |
| `PROGRESS` | worker → supervisor | step, `progress`, `etaMs` | sealing v2 |
| `HEARTBEAT` | worker → supervisor | monotonic counter | liveness |
| `WARNING` | worker → supervisor | `MIC_SILENT`, `CAPTURE_FAULT` | never an auto-switch |
| `CRASH` | worker → supervisor (or exit code) | signal / exit code | triggers back-off |

**Erratum PE-57-02 (D65).** The protocol as built (`packages/capture-protocol/src/index.ts:14-27`,
`:62-63`) has ten messages: the eight of the 2026-10-07 table plus `HELLO` and `ACK` (both now in the table above). Transport: NDJSON over the
worker's standard input and output — no socket, no port; a line longer than 65 536 characters, a
line that is not JSON and a JSON value that is no message are protocol violations that end the
worker. `HELLO`, `HEARTBEAT` and `ACK` carry no session; `TELEMETRY`, `PROGRESS` and `WARNING` carry
the `sessionId`. The message set is a strict union: an unknown `type` ends the worker, so a new
message lands in the package and the worker together.

Who starts/stops it: the supervisor is started at boot and stopped at shutdown (OD-14's
"supervisor start/stop"; CS-03 `apps/core-server/src/index.ts:16`) through `boot()` and `shutdown()`
(§A.3, erratum PE-57-01). Crash handling: restart with exponential back-off **within the scope of
the restart rule below (erratum PE-57-06)**; a worker that cannot start emits `CAPTURE_FAULT` and
fails the session start; an interrupted recording seals the durable prefix flagged `interrupted`
(OD-08).

**Delivery contract (errata PE-57-03 and PE-57-04; D67, supersedes the driver's D57-9).**

| Rule | Contract | Evidence |
|---|---|---|
| The worker's output is never paused | The supervisor reads the worker's output at all times; `HEARTBEAT` and `ACK` are handled the moment their line arrives, apart from any queue. There is **no back-pressure toward the worker**: a pause cannot be told from a dead worker, and holding a real-time recorder back can only make it block in a write. A worker that floods costs the Core CPU, not memory; the worker keeps its telemetry near 20 Hz | `apps/core-server/src/capture/supervisor.ts:30-34`; `packages/capture-protocol/src/index.ts:45-46`; pair-57 re-check RC-3 (3.0 M frames in 10 s: queue <= 256, RSS flat, heartbeat age < 78 ms) |
| Two delivery paths | The supervisor's **own** events (`workerDown`, `phase`, the `CAPTURE_FAULT` it raises itself) go to their listeners at once, in order, never queued, never lost. The **worker's** events (`telemetry`, `progress`, worker warnings) go through one queue. The two paths are not ordered against each other | `supervisor.ts:36-43`, `:230`, `:262` |
| The worker-event queue is **hard-bounded and LOSSY** | Never more than `eventQueueLimit` (default 256) events wait. `TELEMETRY` and `PROGRESS` are **levels, not records**: a waiting telemetry frame is replaced by a newer one; a waiting progress value is replaced by a newer value of the same step; at the bound the oldest telemetry, then the oldest progress, is evicted. A warning that still waits is not queued twice (same code and subject) and **is never evicted for a level**; only a queue full of distinct warnings drops a new event. Losses are counted (`droppedTelemetry`, `droppedEvents`) and the first loss of an episode is reported as `CAPTURE_EVENT_OVERFLOW` | `supervisor.ts:45-55`, `:225-244`; `capture/types.ts:90-95`; `packages/capture-protocol/src/index.ts:128-129`; pair-57 re-check RC-3, RC-5 |
| **Nothing that must never be lost may travel through this queue** | An intermediate or even a finished progress step can be evicted (`SEAL:1` was, in the navigator's run); a worker warning can be reordered after phase changes. A fragment checkpoint, "first durable fragment" and seal completion therefore do **not** belong in it, and completion of sealing must not be read from `PROGRESS` with progress 1 | `supervisor.ts:55-57`; `delegation_progress/pair_57_navigator.md:304-327`, `:344` |
| Commands | written at once; the bound is the window of commands awaiting their `ACK` (default 16). `STOP` is written outside that window, always | `supervisor.ts:59-61`; pair-57 F-3, F-11 |
| Defaults are HYPOTHESES | heartbeat 500 ms / timeout 2 500 ms, back-off 250 ms x 2 up to 8 s, 5 restarts, stable after 30 s, queues 256 / 16, frame 65 536 characters: row 57's choices, measured by no spike, until row 58 runs the real worker | `packages/capture-protocol/src/index.ts:101-133`; D57-4 |

**REQUIRED WORK for row 58 — a lossless record frame class (erratum PE-57-05; D67).** The protocol
has no lossless path today: every worker message that carries content goes through the lossy queue.
Row 58 adds, in the package and the worker together:

| # | Requirement | Source |
|---|---|---|
| R-1 | A new worker message class for **records**, handled inline in the supervisor beside `ACK` and never passed to the lossy queue. At least three records: **first durable fragment**, **fragment checkpoint** (index, bytes, chain values — row 59's `FragmentCheckpoint`, §A.5) and **seal completion** | `pair_57_navigator.md:329-332` |
| R-2 | A **sequence number per session** on every record; a gap is a `PROTOCOL_VIOLATION` | `pair_57_navigator.md:333` |
| R-3 | **"The file is the truth, the frame is a hint."** The record frame is not the authority: the box walk of §C.5 rebuilds the checkpoints from the camera file at RECOVERY. (Chosen over a supervisor-to-worker acknowledgement of the highest persisted sequence; cheaper, and it matches AU2-08) | D67; `pair_57_navigator.md:334-339` |
| R-4 | Raise `CAPTURE_PROTOCOL_VERSION` if a worker of version 1 exists by then (the message set is a strict union) | `pair_57_navigator.md:340-343`; `packages/capture-protocol/src/index.ts:51`, `:283` |
| R-5 | Row 58 also inherits: a listener that calls `stop()` from inside one of the supervisor's own events leaves a wrong phase (finish the transition first, then hand out the events); worker events of an ended session are dropped at session end, not delivered into the next one; a warning `subject` is restricted to the device IDs and mic roles of the plan (else `PROTOCOL_VIOLATION`) | pair-57 re-check N-1, N-2, N-3 (`pair_57_navigator.md:350-352`) |

**Restart rule (erratum PE-57-06; D67 = option C per OD-08).**

| Situation | Rule |
|---|---|
| Worker crash **before the first durable fragment** of a session | respawn with exponential back-off (the back-off budget above); after the budget `CAPTURE_FAULT` |
| Worker crash **once the session has a durable fragment** | **no respawn.** The session goes to `FAULTED` and to the OD-08 interrupted seal of the durable prefix. **No respawned worker ever writes into an existing evidence file** |
| Between sessions | a fresh worker per session, as before (S1 G-1, D10(b)) |
| Until the worker reports durability (the lossless "first durable fragment" record, R-1) | **"`START` acknowledged" counts as "may be durable"**: no respawn after `RECORDING` |
| Scope of the row-57 gate sentence "a killed worker respawns under the supervisor" | true before the first durable fragment and between sessions only |

Why: a restarted worker gets the same output paths (`attempt >= 2`), and nothing in this spec says
append or new segment; a truncating worker would destroy the durable prefix OD-08 wants sealed.
Option A (attempt-suffixed segments joined at sealing) is OD-21's fallback path, reserved for a
legal "no" to one whole file; option B (resume in the same file) needs a way to continue an fMP4 and
its hash chain after a dropped tail, which no spike measured
(`implementation/19_m3_supervisor_ipc.md:425-444`; `pair_57_navigator.md:380-404`). **State of the
code today:** the supervisor still restarts inside a session and re-sends the same paths
(`apps/core-server/src/capture/__tests__/liveness.test.ts:168`); the protocol header binds the worker
never to truncate or overwrite an existing output file (`packages/capture-protocol/src/index.ts:39-44`).
Row 58 implements the rule (one flag on the session set by the durable record, one more term in the
give-up branch at `supervisor.ts:384-391`), renames that pin to "before the first durable fragment",
adds its sibling test (after the durable record a crash goes to `FAULTED`, the launcher is not
called again, `CAPTURE_FAULT` is raised once) and decides what a respawned worker does with a file
that holds an init segment only (create the file at the first fragment, or allow replacing a file
that holds no fragment). `stableAfterMs` (30 s) becomes close to unreachable inside a session.

---

## C. fMP4 writer design

### C.1 Fragment quantum (SP-4) — recommended default, confirmed at the M0 spec gate

| Option | Behaviour | Verdict |
|---|---|---|
| Plain `frag_duration` | cuts on the duration boundary **mid-GOP**; fragments 2..N start on non-keyframes; fragments 5 and 8 of S1 run 3 contained **no keyframe** | rejected for the default (weakens per-fragment AEAD/tamper) |
| `frag_keyframe` + `min_frag_duration` | every fragment starts on a keyframe; cuts align to the encoder GOP grid (S1 run3b: every fragment `first_is_K=True`, exactly 50 video packets ≈ 2.0 s) | **recommended default** |

Evidence: S1 §6.4/§6.5 (G-3, SP-4); row 15 §3.1 ("GOP becomes the fragment quantum"). Recommendation:
pair the fragment target, the GOP (`-g`) and `min_frag_duration` as contract constants; the S1
anchor is `-g 50 @ 25 fps` = 2.0 s. **This pairing is a decision for the M0 spec gate** (row 15 §5
item 4) and is recorded as a contract constant (CS-25).

**Crash-loss window and who controls the GOP (erratum AU2-08, D18).**

| Aspect | Rule | Evidence |
|---|---|---|
| RPO | a worker crash loses the **whole open fragment** (the muxer holds it in RAM until the fragment is written; every SIGKILL in S1/AU-2 landed on a top-level box boundary). With keyframe fragments, **RPO = one fragment = one camera GOP** | AU-2 `verification/21_audit_spikes_stt.md` §1 (4/4 kills on a box boundary) |
| Who sets the GOP | on the copy path (`-c copy`) the GOP is the **camera's** encoder setting; DEMS **cannot enforce** `CAPTURE_GOP_FRAMES = 50` on a copied stream. The constant governs only streams DEMS encodes itself (fakes/fixtures) and is the **target** written to the camera | AU-2 §1 extra measurement; `03_api_contract.md §7` |
| Measured worst case | camera-like 10 s GOP (`-g 250 @ 25 fps`) killed at 7.0 s → file 1,248 B (`ftyp`+`moov` only), **0 s of durable media** | AU-2 §1 (`gop250_kill/`) |
| Camera configuration requirement | at session start the Core sets the camera GOP (ONVIF `GovLength`) to the target (≤ 2.0 s) through `CameraAdapter` (class C, H-7), and the worker **verifies the observed keyframe interval** from the first fragments | AU2-08 |
| When the observed GOP is too long | **OPEN (OP-GOP, routed to the M3 design row):** either (a) a `WARNING` on the existing capture-warning channel (a dedicated `CAPTURE_GOP_TOO_LONG` code would change the pinned error/audit counts and needs a contract row), or (b) a hard ceiling via `-frag_duration` (max fragment length) that accepts a mid-GOP cut (fragments without a keyframe, see the table above). Not decided here | AU2-08 |
| Fake-camera fixture | M3 adds a long-GOP fake camera (`-g 250`) and kills it mid-GOP (check `M3-KC-4`, `10_test_strategy.md` §A.3) | AU2-08 |

### C.2 Flush vs fsync (SP-2) — what each level guarantees

| Level | Guarantee | What the manifest may claim |
|---|---|---|
| Output buffering off, no flush | bytes appear only at writer close | nothing (S1 first smoke) |
| `-flush_packets 1` | bytes visible per box-write to **other processes on the same OS**; probe size always equaled a fragment end (S1 §4.3). **Erratum PE-111-04 (D66):** in the embedded worker this is the **muxer option `flush_packets=1`** set on each output context — it is REQUIRED WORK for row 58 (§A.2 W-2): the row-111 skeleton does not set it and both files stayed at 28 bytes (the `ftyp`, behind the 256 KB write buffer of the file protocol) from 1.2 s to 20.3 s, i.e. the crash-loss window was the whole session; with the option the files grow every second (`1231, 5131, 9725, 13104, ...`). Flushing alone is not enough when a camera stalls: see §A.2 W-3 (audio keeps fragmenting) | "playable while growing" (M3); **not** crash-durability |
| per-fragment `fcntl(F_FULLFSYNC)` after each fragment hash record | survives an OS/power loss at the fragment boundary | durable-prefix claims; class-C OS-crash test |

The default is: `-flush_packets 1` for the live-growth property, plus a per-fragment fsync policy
recorded as a row-31 decision (S1 §8 SP-2, §10 gap 2; `masterplan/01_specs.md:312`). The fsync
choice itself is HYPOTHESIS until an OS-level test runs (section J, H-1).

### C.3 Running SHA-256 chain (OD-03: stored bytes + plaintext)

Two chains run per fragment (S1 §3.1, extended by OD-03):

| Hash | Input | Verifies |
|---|---|---|
| `fragSha256` / `chainSha256` / `prefixSha256` | the fragment's **stored bytes** `[start, start+len)` (ciphertext after section D) | integrity and order **without the key** (RF-6) |
| `plaintextSha256` + plaintext chain | the fragment's plaintext bytes (pre-encryption) | the decrypted whole-file export (RF-6, F-62) |

Chain construction is exactly the S1-proven form: `chain_0 = SHA-256("")`; `chain_n =
SHA-256(chain_{n-1}raw32 || frag_sha_n_raw32)`; both re-derivable with `dd`/`head`/`shasum`/`xxd`
alone (S1 §3.1, SP-7). Per-fragment checkpoint records (`FragmentCheckpoint`, section A.5) go into
the manifest; `moof.sequence_number` maps to C2PA's `sequenceNumber` (F-60).

### C.4 Exact muxer options valid on FFmpeg 9.0.2

Quoted from `initialization/01_env_check.md` §3 (controller capture, real `-h` output):

| Option | Real text |
|---|---|
| `-frag_duration` | `-frag_duration <int> E…` |
| `-frag_size` | `-frag_size <int> E…` |
| `-fragment_index` | `-fragment_index <int> E… (from 1 to INT_MAX, default 1)` |
| `-min_frag_duration` | `-min_frag_duration <int> E…` |
| `movflags` | `default_base_moof` ("Set the default-base-is-moof flag in tfhd atoms") · `empty_moov` ("Make the initial moov atom empty") · `isml` ("Create a live smooth streaming feed") |

**Confirmed absences (must be treated as non-existent).** This build exposes no fragment
**type** selector, no **default-PRFT** signalling and no fragment **start-number** control. In this
document their names are written in the bracketed form used by the repo's own guard tests
(`frag_typ[e]`, `default_prf[t]`, `frag_start_numbe[r]`) so that this file contains no forbidden
literal — the idiom is taken from `apps/core-server/src/engine/__tests__/static.test.ts:15` ("Every
forbidden text is built from fragments, so that this file does not contain it"). They are recorded
by name as confirmed absences in `initialization/01_env_check.md:79` (and register W1-C1,
`03_analysis.md` §F) and must never appear in a worker command.

**`movflags` for the camera files — evaluation and forbidden options (erratum PE-111-02; D66).**
The S1-pinned flags are `frag_keyframe+empty_moov+default_base_moof` (§C.1; `+skip_trailer`
recommended, §C.6). With them the mov muxer deliberately moves each track's first sample to time 0
and stretches its duration: the first video frame is placed at 0 and **held until the first
keyframe after T0 — up to one GOP** (0.395 s and 0.555 s measured; up to 2 s at the S1 anchor, up
to 10 s with the AU2-08 long-GOP camera). Every later sample is exact, so the AV offsets of §F are
unaffected. Nothing in this spec pinned edit-list or negative-timestamp handling before this
erratum.

| Item | Rule for row 58 | Evidence |
|---|---|---|
| Evaluate `delay_moov` | Row 58 evaluates `+frag_keyframe+delay_moov+default_base_moof` — the only tested variant that times the first sample correctly (first video packet pts 31359, duration 1800; AAC priming trimmed by an edit list; offsets 80.0045 / −79.9955 ms; audio still byte-identical in both files; decode rc 0) — **against the S1 checks**: the file shape (the file is 0 bytes until the first fragment is cut, the `moov` depends on the first fragment, edit lists are present and readers must honour them, a camera that never sends a keyframe leaves no `moov` until close), the **running hash / fragment chain** (§C.3) and the **tail validation** (§C.5, AU2-08) | pair-111 §6 (`delegation_progress/pair_111_navigator.md:308-330`); D66 |
| Fallback if any of those three checks fails | keep the **pinned flags**; document the **held first frame (up to one GOP)** as known muxer behaviour; record the **true first video pts** per camera file in the manifest (the worker already logs it as `video_started.first_pts`); exclude the first sample from the AV checks | `pair_111_navigator.md:331-333`; D66 |
| **FORBIDDEN** with `empty_moov` | `use_editlist=1`, `negative_cts_offsets` and `avoid_negative_ts=disabled`. Each shifts the whole video track by about 450 ms (measured **446.58 / 454.35 / 452.52 ms** where +80 / −80 ms was injected) **while the file still decodes with rc 0**. A static rule in the worker (beside the AU2-07 rule) forbids the three; one of them is kept as a negative control for `M3-AV-1/2` | `pair_111_navigator.md:310-317`, `:334-337`; D66 |
| Not available | "start the file on a keyframe with an aligned first dts": the one audio track is shared and the two cameras have different keyframe phases, so at most one file could start aligned | `pair_111_navigator.md:319-321` |

### C.5 Truncation / crash handling (drop-fragment rule)

| Step | Rule | Evidence |
|---|---|---|
| Detect | compare the stored file length against the last declared fragment end; a shorter file is a truncated tail | S1 §5.2/§5.3 |
| Identify | parse the tail box; a box whose declared size exceeds the bytes present is the corrupt fragment | S1 §5.5 (`size_mismatch_declared_gt_present`, corrupt seq 7 @ 251,168) |
| Recover | drop the range `[tail_start, EOF)`; re-hash the durable prefix `[0, tail_start)` | S1 §5.4/§5.5 (prefix re-hash equality `4b41c9ca…a5f`; `verify.sh trunc.mp4 m.tsv` → `VERIFY OK`) |
| Seal | seal the durable part flagged `interrupted` (OD-08) | OD-08 (D4); S1 §5.4 |
| Tail validation at RECOVERY (mandatory; erratum AU2-08) | RECOVERY walks the top-level boxes of every camera file and checks: each declared box size ≤ bytes present; the last `moof` is followed by a complete `mdat`; file length == the last declared fragment end in the checkpoint records. **ffprobe and the decoder are not detectors**: a cut inside the 3rd `mdat` returned ffprobe rc 0, decoder rc 0, 0 error lines and an over-reported duration (6.037 s for ~5 s present) | AU-2 §1 (synthetic cut of `run2_kf/out.mp4`); S1 §5.5 |

### C.6 Whole-file semantics and the trailer (SP-3)

A graceful close appends an `mfra` trailer (S1: 376 B) that is not part of the append-only bytes.
Recommended default for the camera file: `movflags +skip_trailer` so the stored bytes are purely
append-only and the running prefix is the whole-file hash (S1 §3.1 SP-3, §10 gap 5; F-19). The
sealing step computes its own index, so the trailer is not needed. If the trailer is kept, it must
be hashed as a final end-of-stream record. This is a row-31 decision recorded at the M0 spec gate.

---

## D. Encryption (OD-03)

### D.1 Where the ciphertext lives

The mp4 muxer's CENC is AES-CTR only (F-47) and CTR carries no authentication tag (F-52), so
per-fragment **GCM lives outside the muxer** and wraps the stored fragment bytes (F-53; register
W1-C2). OD-03(a) says GCM is **in the camera file**, so the camera file at rest is the fMP4 with
each fragment's stored byte range sealed as one AES-256-GCM message; the clear container header is
retained. The manifest is separate and clear.

| Element | Location | Notes |
|---|---|---|
| Ciphertext | the camera file; one GCM message per fragment range `[start, len)` | keeps OD-21's "one whole file"; the file is still an fMP4 at rest |
| IV + tag + key id | the per-fragment record in `fragments.json` (manifest), **not** inside the sealed range | lets integrity be checked without the key |
| Session key (32 B) | the Core credential store, **never** beside the media, never in audit/log | E-31/CS-14 no-secret-keys rule |
| GCM AAD (SEC35-10) | **not stored**: the additional-authenticated-data of each fragment's GCM message is the canonical encoding `(trackId, seq, byteOffset, keyId)`, recomputed by verify; this binds a fragment's ciphertext to its position and key so it cannot be relocated within the file, not merely reordered | OD-03; SEC35-10; `06_evidence_package_spec.md §B.6` |
| Structural boxes | remain clear (moov/moof/trun), mirroring CENC's clear sample tables (F-50) | keeps the container parseable for Range serving |

The alternative shape (a sidecar of sealed fragment blobs, F-53 "in-band container or sidecar") is
kept designed but not the default. The chosen layout is HYPOTHESIS until the M7 tamper test
(section J, H-2).

### D.2 Key handling

| Rule | Detail |
|---|---|
| Generation | one AES-256 key per session, generated by the Core, id `KID-<sessionId>`; **one random 256-bit key per session** (no reuse, no derivation from a host secret) |
| Storage (SEC35-08) | the **Core credential store** — the same store as the camera-credential keys (`dbc-3 §B.3`), held separately from the media volume; never in the worker output dir, never beside the media, never in audit/log. Access is limited to the single sealing/Range module pair; the key is referenced by `keyId` only |
| Manifest | stores only `keyId` and per-fragment IV/tag; no key bytes |
| Audit/log | no key, no key-derived value (CS-14 exact detail-key lists; E-31 blanking) |
| Destruction | the key is destroyed when the evidence item is deleted/retention-expired, after any export; destruction is audited (fact only) |
| Key loss (SEC35-09) | **key lost = data unreadable**: without the session key the plaintext export (V-05) and Range playback are impossible, while the stored-bytes verification (V-04/V-06) still passes. **Decision recorded here: no key escrow/backup by default** — the export path (OD-16) is the operator's only decryption route, so a REAL item must be exported before any key-loss event. Flagged for the second blueprint gate if a custody/escrow policy is wanted |
| Export | OD-16 decrypted copy, so the receiver verifies the package without the Core's key |

### D.3 The two recorded hashes

| Hash | Recorded over | What it verifies | Use |
|---|---|---|---|
| `fragSha256` chain (`stored`) | ciphertext stored bytes | fragment integrity and order **without the key** | online verify, crash recovery |
| `plaintextSha256` (whole file) | the decrypted fMP4 | that a decrypted export matches the sealed original | OD-03 RF-6, F-62 |

### D.4 Interaction with streaming playback (Range, M8)

Evidence media streaming is NM-11 (register §B.6), M8. Range requests map to the fragment quantum
(≈ 2 s): the minimum decrypt unit is **one fragment**; a request landing mid-fragment decrypts the
whole fragment and serves the sub-range. This is cleaner than CTR subsampling because GCM needs no
16-byte block alignment (contrast F-51). Per-fragment tags are verified before the bytes are
served. Latency of this path is HYPOTHESIS until M8 (section J, H-3).

---

## E. Mic-switch mechanics (OD-09 / OD-11 + S2)

| Aspect | Design | Evidence |
|---|---|---|
| Selector | embedded libavfilter: two device-fed inputs → named `astreamselect` → `aformat` (48 kHz mono) → native `aac` → fMP4 | S2 §6 finding 1; row 15 §3.1 |
| Trigger | operator wall-clock instant → worker IPC → `avfilter_graph_send_command(g, "asel", "map", …)` | S2 §3 run3, §6 finding 1 |
| Thread rule (erratum AU2-07) | the command is applied **on the filtering thread only**: the IPC handler sets a flag/queues the request, and the filtering thread calls `avfilter_graph_send_command` before its next push. No other thread touches the graph | AU-2 `verification/21_audit_spikes_stt.md` §2 (signal → flag → filter thread) |
| CLI limitation | the bare `ffmpeg` CLI cannot do an operator trigger (`asendcmd` is init-parsed; no `zmq` in the build) | S2 §1 channels 3/4/5, §6 finding 2 |
| Guarantee (corrected, AU2-07) | command → realised content boundary ≤ **one worker input quantum + IPC latency** (AU-2 push-mode harness with 10 ms chunks: ≤ 10 ms; ≤ 21.333 ms only when the worker pulls 1024-sample frames, as in S2's pull loop); placement error ≤ 1.17 ms | AU-2 §2; S2 §0, §4, §5 |
| Gaplessness evidence (corrected, AU2-05) | **0 inserted / 0 dropped samples**, proven by (1) decoded sample count of `AUDIO-01` = media duration × 48,000 (± the 1,024-sample encoder priming); (2) per-input continuity across every switch boundary checked against the pre-encode capture manifest (fixtures: reference tones evaluated at the absolute sample index); (3) secondary: exactly 1 audio stream and strictly monotonic PTS. The former "file timeline never gaps (0.001 ms measured)" packet-grid metric is **not** gap evidence: it reads 0.0000 ms on a copy with 1,000 samples (20.8 ms) cut out at the switch | AU-2 §2 (`run1.m4a` vs `run1_drop1000.m4a`) |
| Audible click (AU2-07) | the switch is a hard cut: waveform step 0.42-0.71 at the switch vs a normal per-sample step of 0.022-0.029 (16-24x) — audible. **OPEN (OP-CLICK, UX decision):** either a short 5-10 ms crossfade (runtime `volume` commands on both selector inputs) or an explicit acceptance of the click. A crossfade briefly mixes both mics, which must be reconciled with "one active mic" (OD-09) in the decision | AU-2 §2 |
| Interval records | per-interval `from_ms`/`to_ms` per input, in the **media-pts domain**, derived capture-side (raw pre-encode manifest); never reconstructed from operator wall clock | S2 §6 finding 3; S2 §3 run3 |
| Who may trigger | session holder with `SESSION_START` + SUPERVISOR (OD-09); operation from row 29 (`switchAudioSource`, `POST /api/v1/session/{id}/audio-source` — singular per row 29 §1, which flags the plural `sessions` spelling as the erratum; SH-13) | OD-09 (D4); SH-13; RBAC `CAPTURE_CONFIG` for the selector (OD-10) is separate |
| Audit | `AUDIO_SOURCE_SWITCHED` carries the sending device ID (E-30) | E-30 (`03_analysis.md` §A) |

### E.1 Warning raiser (never an auto-switch)

| Warning | Threshold | Behaviour | Constant |
|---|---|---|---|
| `MIC_SILENT` | below **−50 dBFS for 10 s** | **WARNING only**; the Core warns, the **operator decides**; no automatic switch | `MIC_SILENCE_DBFS = -50`, `MIC_SILENCE_DURATION_MS = 10000` |
| disconnect | no samples for **2 s** (debounce) | warning / fault; never an auto-switch | `MIC_DISCONNECT_DEBOUNCE_MS = 2000` |

The constants live in `@dems/shared/api` (CS-25) and are tunable without a code change (OD-11).
The contract-value test (`contract-values.test.ts`, CS-25) pins them.

---

## F. Audio capture

| Aspect | Design | Evidence |
|---|---|---|
| Codec / rate | AAC-LC, 48 kHz, mono | OD-06 (D4); F-44 |
| Transport | behind `AudioInputAdapter`; USB is the **working assumption** | OD-06 (D4) |
| One session track | `AUDIO-01` is the one session audio track carrying the active mic; `MIC-01`/`MIC-02` are inputs (`MicRole` PRIMARY/STANDBY); `AUDIO-02` legacy v1 only | OD-01 (D4); register SH-01 |
| Topology | hot standby: both inputs fed to the selector, one active; the second is failover (D220/D221) | OD-09 (D4); S2 §2 |
| AV timeline | one timeline per file; assert the **relative** flash-to-beep offset, never absolute stream start times (the copy path shifts **both** streams by one AAC priming frame, 21.333 ms, which cancels); sample-exact measurement: aligned **0.00 ms** (+0.021 ms = one sample), +80 ms injection 80.021 ms, −80 ms injection −80.052 ms | AU-2 §3 (AU2-03); S4 §5 S4-1; S4 §0 |
| AV tolerances (split, erratum AU2-04) | **Regression bound** (deterministic synthetic fixture, sample-exact analyser): \|measured − truth\| ≤ **2 ms** (≤ 1 AAC frame only if an analyser stays window-based, and then its resolution is reported next to every anchor). **Product / class-C bound**: ±40 ms stays the tolerance in force (row 9); an asymmetric bound from a published standard (EBU R37 / ITU-R BT.1359, audio-early tighter than audio-late) is **OPEN** until the documentation row verifies the standard text — the figures quoted by AU-2 were not re-verified online | AU-2 §3 ("Is the ±40 ms target logic sound?") |
| Analyser resolution | the NM-14 analyser detects audio onset at **sample** resolution (first sample with \|x\| > threshold) and video onset on the frame pts; window-based onset detection is not allowed for anchors | AU2-03 |
| Video anchoring and drift (**erratum PE-111-01**, D66) | Row 58 anchors **each video packet on its PRFT wall clock** (`AV_PKT_DATA_PRFT`, which libavformat attaches per packet from the latest RTCP sender report) instead of `start_time_realtime + pts`, with a **slew limit** and a monotonic-dts guard. It is identical to today's anchoring on the present fixtures and follows later reports automatically. **NOT adopted:** "re-anchor on later sender reports" as a drift fix with the present drift case expected to show a slope near 0 — the fixture's sender reports carry **no rate information** (`rtpenc` derives the SR RTP timestamp linearly from the host NTP time; `PRFT − pts` stayed constant within 1 µs over 31 s at ±200 ppm), so that test could never pass. The **arrival-vs-camera trend** (`arrival − PRFT`; fitted +165 / −217 ppm against a true ±200 on a loaded host, residuals up to 7.5 ms) is emitted as **telemetry only**, with a warning before the product bound; nothing is corrected from it. The present ±200 ppm case keeps its present expectation (the injected slope within the 2 ms regression bound: 2.0 ms at 10 s, about 6 ms at 30 s); a fixture whose sender reports express drift is added at row 62 (§A.8). **Long-session drift stays class C (C-9).** ASSUMPTION recorded: PRFT anchoring bounds drift only for a camera whose wall clock is disciplined against the Core (H-7 becomes a correctness dependency). HYPOTHESIS (not measured): with real devices the microphone sample clock is a third oscillator; any correction moves video timestamps only and never resamples the evidentiary audio | pair-111 §5 (`delegation_progress/pair_111_navigator.md:241-277`); `implementation/59_m3_worker_proofs.md:233-239` |
| File time 0 (**erratum PE-111-06**, D66) | With the pinned flags, **file time 0 = T0 minus the AAC priming = T0 − 21.333 ms** (1,024 samples at 48 kHz): the priming samples are presented (no edit list) and the muxer shifts both tracks by the same amount. The AV offset is unaffected (the row above "AV timeline"). **Anything that maps file time to host time — the PCM tap, STT timestamps, R-8 — must add 1024/48000 s** (`07_transcript_spec.md` §A.2 "Timeline mapping"). Under `delay_moov` (§C.4) the priming is trimmed by an edit list and the term disappears, so the mapping constant must follow the flags row 58 adopts | pair-111 N-12 (`pair_111_navigator.md:225`): manifest onset sample 68,799 decodes at sample 69,823; decoded − input = 1,088 |

The former statement "the measured pipeline skew of −1.333 ms is a bias of the copy path" is
**withdrawn** (erratum AU2-03, D18): −1.333 ms was the 10 ms analysis-window quantisation of an
onset at 3.021354 s in row 9's analyser; the true relative offset of the copy path is 0.00 ms. The
analyser measures relative offsets only. Injections of any size are detectable on this fixture
(resolution ~0.05 ms); detectability is set by the chosen tolerance, not by the 50 fps grid. The
fixture uses one pusher and one clock, so it does **not** exercise the DEMS two-clock topology —
see H-10 (section J).

---

## G. Static rules for the new folders

The new `capture/` module needs its own static guard, mirroring the 21 src guards
(`research/01_explore.md` §2.4) and reusing the scanner helpers under
`apps/core-server/test/static/` (`scan.ts`, `imports.ts`, `log-calls.ts`). The rule list:

| # | Rule | Rationale |
|---|---|---|
| G-R1 | Host modules (`src/modules/**`, `src/engine/**`, `src/plugins/**`, `src/core/**`) must not import `node:fs`, `node:child_process`, `node:net` or `node:worker_threads`; the worker boundary is the only door. **Erratum PE-57-07 (D65(d)):** for `node:fs` the rule holds for every host file **except two that imported it before the capture layer existed** — `src/plugins/config/connection-file.ts` (the loader of the connection file; `:12`) and `src/plugins/logger/error-log.ts` (the persistent error log; `:26`). The guard pins **exactly those two** by name (`apps/core-server/src/capture/__tests__/static.test.ts:113`, `:120-122`); a third entry is a decision, not a habit. The two files are not refactored. No host file imports `node:child_process`, `node:net` or `node:worker_threads` (`static.test.ts:115-118`) | preserves the engine's existing `OUTSIDE_WORLD` rule (`engine/__tests__/static.test.ts:29`); pair-57 §8(c) |
| G-R2 | `src/capture/**` may import `node:fs`/`node:child_process` **only in the pinned allowlist** `apps/core-server/src/capture/supervisor.ts` and `apps/core-server/src/capture/ipc.ts` (the files that own the supervisor spawn/handshake); every other file under `src/capture/**` — and any path that reads a signer key, `~/.omlx/settings.json`, `.data/pg.*` or a credential/key/env file — is denied; a test asserts no other `src/capture/**` file imports them | confines the OS side-effects to one reviewed, enumerated boundary (SEC35-25) |
| G-R3 | `apps/capture-worker/**` may import `node:fs`/`node:child_process` freely; it must not import `@dems/shared/sim/**` beyond the public barrel | the worker is the one place that touches the OS |
| G-R4 | No file may name a capture **key**, a key id, a credential or a signed-URL prefix in a log/audit call; the blanked forms are the credential-shaped values of §A.6 (camera credential `rtsp://user:pass@host`), the media token prefix `mts_` (`03_api_contract.md §7`) and the oMLX API key at `~/.omlx/settings.json` (SEC35-04/SEC35-13/SEC35-14) | E-31; CS-14 exact detail-key lists (no secret keys) |
| G-R5 | The capture module must not reuse `AdminResource.DEVICES`; capture devices use their own slice/kind | E-04 (`realtime-messages.ts:156`) |
| G-R6 | No capture test or source may write media outside a git-ignored path (`.cache/` or `/.data/`); a media path under `docs/` is a failure | OD-25; `.gitignore:47`, `.gitignore:70` |
| G-R7 | `src/capture/**` must not import the simulator's deep paths (`@dems/shared/sim/...`); the public barrel only | mirrors `engine/__tests__/static.test.ts:32` (`SIM_DEEP_IMPORT`) |
| G-R8 | No new file may start the worker, read the clock or draw a random directly; those go through the supervisor/clock seam | keeps determinism testable (as the engine folder enforces) |

**Test files that will enforce the list (M3 creates them):**
`apps/core-server/src/capture/__tests__/static.test.ts` (G-R1, G-R2, G-R4, G-R5, G-R7, G-R8) and
`apps/capture-worker/src/__tests__/static.test.ts` (G-R3, G-R4, G-R6). Both reuse the
`test/static/scan` helpers so they join the existing guard suite. The rules are not written here
into code; M3 writes them (OD-26: minimal targeted edits, today's scanner form).

---

## H. Storage paths (OD-25)

| Aspect | Design | Evidence |
|---|---|---|
| Media root | `<dataDir>/media/sessions/<sessionId>/` (the existing `dataDir`, `config.ts:160`; CS-02 "evidence store under `dataDir`") | OD-25 (D4); register CS-02 |
| Git-ignored | `/dataDir` defaults to the repo-root `/.data/` (`.gitignore:70`) — media never enters git; scratch may use `.cache/` (`.gitignore:47`) | `.gitignore:47`, `.gitignore:70` |
| Growth | about **8 GB/h** per session for two cameras + audio | `structured` §3.1 constraint (c); register §4 RK-4 |
| Committed | text evidence (manifests, hashes, transcripts) + small stills only, under `docs/` | OD-25 (D4) |
| Demo reset | reset is blocked while real sealed packages exist; capture config/devices/credentials are **kept** tables | OD-19 (D4); register CS-21; row 30 `dbc-3` |

Cross-reference: row 30 (`masterplan/04_database_contract.md`) owns the kept-on-reset set and the
privileges; this spec only fixes where the bytes land.

---

## I. P25 edits list (every edit OD-14's waiver covers, by file:line)

The three frozen files are `apps/core-server/src/app.ts`, `apps/core-server/src/config.ts` and
`apps/core-server/src/index.ts` (P25; `app.ts:6`, `config.ts:8`, `index.ts:16`). OD-14 grants
edits **only** in four categories: module registration, the `capture` seam, capture config keys,
supervisor start/stop. Every covered edit:

**Erratum PE-57-08 (D65, D68(b)).** The table below is the waived edit set **as it stands on
2026-10-09**. Edits 1-6 and 11-12 are listed as landed by row 57, with the line numbers of the
working tree at write time (the anchors of the 2026-10-07 text were pre-edit positions and are kept
in `masterplan/11_audit_errata.md` §5). Edits 7-10 are not landed: `config.ts` has no diff, and
their anchors are still the planned ones. **Edits 13 and 14 are new:** the import and the
registration of `sttConfigModule`, written by row 113 and **waived by decision D68, which extends
OD-14's module-registration category to `modules/stt-config`** (R-8 confirmed by D24; reviewed by
the row-113 navigator: an import and one `UNITS` entry, no stage, seam, decorator or boot-order
change). The line numbers move when a later waived edit lands above them; the authority for the set
is the pin, not the number.

| # | File:line (as landed; planned for 7-10) | Category | Change | Landed by |
|---|---|---|---|---|
| 1 | `apps/core-server/src/app.ts:83` and `:90` | module registration | `import { captureModule, type CaptureSupervisor } from './capture';` (also names the type that edits 2 and 4 need) and `import { captureConfigModule } from './modules/capture-config';` | row 57 |
| 2 | `apps/core-server/src/app.ts:141` | the `capture` seam | `capture: CaptureSupervisor;` in `interface Seams` | row 57 |
| 3 | `apps/core-server/src/app.ts:156` | the `capture` seam | `capture: 'src/capture (capture module)',` in `SEAM_PROVIDERS` | row 57 |
| 4 | `apps/core-server/src/app.ts:258` | the `capture` seam | `readonly capture: CaptureSupervisor;` in the `declare module 'fastify'` block | row 57 |
| 5 | `apps/core-server/src/app.ts:324` and `:325` | module registration | `['capture', captureModule],` and `['modules/capture-config', captureConfigModule],` in `UNITS` | row 57 |
| 6 | `apps/core-server/src/app.ts:371` | the `capture` seam | `app.decorate('capture', { getter: () => seams.get('capture') });` in the decorator block | row 57 |
| 7 | `apps/core-server/src/config.ts:38` (planned) | capture config keys | add `ENV_CAPTURE_MODE = 'DEMS_CAPTURE_MODE'`, the worker command path key and the media-dir key next to the existing `ENV_*` (`config.ts:36-38`); E-05 path correction applies to `index.ts`, not here | row 58 (not landed) |
| 8 | `apps/core-server/src/config.ts:162` (planned) | capture config keys | add `captureMode`, `captureWorkerPath`, `mediaStoreDir` to `CoreServerConfig` (`config.ts:147-163`) | row 58 (not landed) |
| 9 | `apps/core-server/src/config.ts:227` (planned) | capture config keys | add the three capture fields to `ConfigInput` (`config.ts:216-228`) and validate/parse them | row 58 (not landed) |
| 10 | `apps/core-server/src/config.ts:268` (planned) | capture config keys | set the three capture fields in the frozen object returned by `createConfig` (`config.ts:237-270`) | row 58 (not landed) |
| 11 | `apps/core-server/src/index.ts:108` | supervisor start | `await app.capture.boot();` after `await app.readiness.boot()` (`index.ts:107`) and before `await app.listen(...)` (`index.ts:109`) | row 57 |
| 12 | `apps/core-server/src/index.ts:83` | supervisor stop | `if (app.seams.has('capture')) await app.capture.shutdown();` inside `shutdown()` before `await app.close()` (`index.ts:84`); the guard covers a signal that arrives before `app.ready()` finished | row 57 |
| 13 | `apps/core-server/src/app.ts:102` | module registration (OD-14 extended by **D68**) | `import { sttConfigModule } from './modules/stt-config';` | row 113 |
| 14 | `apps/core-server/src/app.ts:323` | module registration (OD-14 extended by **D68**) | `['modules/stt-config', sttConfigModule],` in `UNITS` (before `capture`; the plugin opens no connection) | row 113 |

**P25 edit count: 14 (8 in `app.ts`, 4 in `config.ts`, 2 in `index.ts`); 10 landed (1-6, 11-14), 4
pending with row 58 (7-10).** Until 2026-10-09 this line read "12 (6 in `app.ts`, 4 in `config.ts`,
2 in `index.ts`)".

**Nothing else in those files changes.** No request stage, no route, no existing seam, no listener
constant, no cookie name, no database field, no boot order, and no P25 header comment is touched
except to record the waived edit set. Any other change to these three files is a `needs-review`
against OD-14 and is out of scope for M3.

The header of `app.ts` records the waived set, as the paragraph above permits: `app.ts:17-21` (the
capture edits and, at `:20`, "Decision D68 extends OD-14 to the registration of
`modules/stt-config` (task 3 row 113): waived edits 13 and 14") and the seam-table line `app.ts:50`.
`git diff HEAD --numstat` on the three files: `app.ts` 16 added / 0 removed (10 code lines of edits
1-6, 13, 14 and 6 header lines), `index.ts` 2 / 0, `config.ts` no diff. The pin is
`apps/core-server/src/capture/__tests__/static.test.ts:208` (every line that mentions capture is one
of the waived ones) and `:233` (with **every** waived added line taken out, `app.ts` is byte-equal to
the file plan row W08 froze — a line nobody waived, of any module, fails there). Row 58 replaces the
assertion that `config.ts` mentions capture nowhere when it lands edits 7-10.

---

## J. Hypotheses register

Every mechanism in this spec is cited to a row 7/8/9/15 artifact, a decision ID, a register row or
a collection fact. The following could not be so cited and are **HYPOTHESIS**, each with what would
falsify it.

| # | HYPOTHESIS | Why not yet cited | What would falsify it |
|---|---|---|---|
| H-1 | per-fragment `fcntl(F_FULLFSYNC)` gives OS/power-loss durability at the fragment boundary | S1 proved only `kill -9` process death (S1 §10 gap 2); `-flush_packets 1` is userspace (S1 SP-2) | a class-C OS-crash/power test loses or corrupts a fragment that a prior fsync should have protected |
| H-2 | sealing each fragment's stored bytes in place keeps the file a usable fMP4 and the manifest verifiable without the key | F-53 supports the concept; the exact in-file layout was not spiked | M7 tamper test fails to isolate exactly one fragment, or the file is not parseable after sealing |
| H-3 | Range playback can decrypt fragment-granularly within the M8 latency budget | no playback instrumentation exists (NM-11 is M8) | M8 Range playback misses the stated latency or cannot serve a sub-fragment range |
| H-4 | the worker can run one audio encoder and mux the single `AUDIO-01` track into **both** camera files with no re-encode | register NM-02 states this; S1 muxed one video+audio into one file, S2 produced one audio track — the two-file sharing was not spiked. The worker's build form (a small C program linking libav* vs a Node native binding) is undecided — question Q-WORKER, routed to the blueprint by AU3-04 | M3 worker integration produces two files whose audio differs or re-encodes |
| H-5 | ~20 Hz meter telemetry is sufficient and affordable alongside capture | the rate is a register constant, not measured; S1 measured fragment cadence, not meter frames | M3/M5 shows meter starvation or capture jitter under telemetry load |
| H-6 | SNMP (RFC 3621) PoE control works against the target switch | OD-07 external evidence only; no spike (register NM-01, class C-3) | class-C PoE cycle on the real switch fails or needs a vendor API |
| H-7 | ONVIF discovery / profile listing / NTP set work against the target camera | Q-INSTALL item 6 permits an ONVIF npm after B2; no spike; class C-1 | class-C discovery lists no camera or NTP set is refused |
| H-8 | USB is the correct microphone transport | OD-06 "USB working assumption"; transport fixed when mics are known | C-4 with the real mic shows a different transport |
| H-9 | the four S1 command-shape traps are sufficient for a **pull** camera (S1 used listen/push) | RF-2: pull fixtures need MediaMTX (Q-INSTALL item 4); class C-2 | a real camera pull fails on a trap the synthetic push did not exercise |
| H-10 | camera **video clock** (camera encoder / RTP timestamps, copied) and **host audio clock** (mic captured, selected and encoded on the Core) stay aligned at session start and do not drift beyond the AV tolerance within a session, in **both** camera files (added by AU2-06, D18) | S4 used one pusher and one clock for audio and video, so the two-clock DEMS topology was never measured; H-4 covers only the two-file fan-out | M3 check `M3-AV-2` (fake camera in a separate process with its own clock, injected ±80 ms and a slow drift, host-fed audio through the selector; flash/beep analysed per camera file) fails the regression bound; long-session drift stays class C-9 (pre-handover, D233). **Erratum PE-111-01 / PE-111-05 (D66):** row 111 proved the timestamp path (sample-exact offsets, drift reported, negative controls fail) but two limits remain for `M3-AV-2`: the fake mics must be a **separate process** (§A.8), and the present fixture cannot express a second oscillator through its sender reports, so a slope near 0 may be expected only from the row-62 fixture (§F) |

The MVP recommendation of section C.1 (keyframe-aligned fragments) is **not** a hypothesis: it is
measured (S1 §6.5). The *choice* of which pairing becomes the contract constant is a decision
reserved for the M0 spec gate.

---

## Self-gate

| Gate item | Result |
|---|---|
| NM-01..NM-05, NM-09, NM-10, NM-14 each have **interface + failure modes + test hook** | **9/9** (A.1–A.8 = 8 module IDs; section B = the ninth interface, `CaptureSupervisor`, with its own interface/failure/test hook) |
| Every mechanism cites **row 7 / 8 / 9 / 15 or is labelled hypothesis** | **PASS** — no uncited mechanism; the ten items that could not be cited are in section J with falsifiers (H-10 added by the AU-2 errata, D18) |
| Every P25 edit listed by **file:line** | **14/14** (section I: 8 × `app.ts`, 4 × `config.ts`, 2 × `index.ts`), each in one of OD-14's four categories — **erratum PE-57-08:** 12/12 (6 × `app.ts`) until 2026-10-09; edits 13-14 are the `modules/stt-config` registration waived by D68 |
| No non-existent muxer option appears anywhere in the document | **PASS (empty)** — section C.4 writes the three absent names only in bracketed form (`frag_typ[e]`, `default_prf[t]`, `frag_start_numbe[r]`, the repo's own guard idiom at `engine/__tests__/static.test.ts:15`); `grep` of this file returns nothing (see below) |
| Every design choice cites a file:line / spike section / decision ID / register row | **PASS** — section 0, sections A–J |
| Row-35 security remediation applied (SEC35-04/08/09/10/23/25) | §A.2/§A.4/§A.8 (RTSP ingest + fixture bind pinned to `127.0.0.1`, check `M3-RTSP-BIND-1`), §A.6 (credential-URL handling), §D.1 (GCM AAD), §D.2 (key store + key-loss decision), §G (G-R2 pinned allowlist, G-R4 blanked forms) — **PASS**; NM 9/9, P25 12/12 and H-1..H-9 counts unchanged (H-10 added later by the AU-2 errata) |
| AU-2 errata applied (AU2-03/04/05/06/07/08; D18; `masterplan/11_audit_errata.md`) | §0, §A.7, §A.8, §C.1, §C.5, §E, §F, §J — **PASS**; NM 9/9 and P25 12/12 unchanged; hypotheses **H-1..H-10**; open points OP-GOP (§C.1) and OP-CLICK (§E) routed |
| Pair-review errata applied (rows 57, 111, 113; PE-57-01..10, PE-111-01..07; D65-D68; `masterplan/11_audit_errata.md` §5) | §0, §A.2, §A.3, §A.4, §A.8, §B.1, §B.2, §C.2, §C.4, §F, §G, §I, §J — **PASS**; NM 9/9 unchanged; P25 **14/14** (was 12/12); hypotheses H-1..H-10 unchanged in number; forbidden-muxer grep still empty |
| No emoji; English; tables over prose; no files edited outside the task folder | **PASS** |

Self-gate grep (run against this file, bracketed pattern so the pattern text is itself not a
match):

```text
$ grep -E 'frag_typ[e]|default_prf[t]|frag_start_numbe[r]' \
    docs/2026-10-07_dems_real_capture_sealing/masterplan/05_capture_architecture_spec.md
(no output)
```

Result: **empty**. The three non-existent options appear in this document only as bracketed,
non-matching text in section C.4; no command, option table or interface in this spec uses them.

---

*Generated: 2026-10-07 · Last Updated: 2026-10-09 (pair-review errata PE-57-01..10 and PE-111-01..07, D65-D68; earlier: 2026-10-08 RV-SPEC audit errata AU2-03..AU2-08, D18; row-35 security remediation SEC35-04/08/09/10/23/25)*
