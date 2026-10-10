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
last_updated: 2026-10-10 (docs errata pass for fix wave H: PE-WH-10 (§A.7.1, the development speech microphone); `implementation/136_docs_errata_wave_h_i.md`; decisions D198, D201, D209); 2026-10-09 14:35 (row-128 spec-gate fix pass PE-128-46..66 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); blueprint row 123, capture architecture delta for R-9..R-11, marks PE-123-01..PE-123-15, decisions D72(k), D73-D78, D80 — sections 0, A.1, A.6, A.7, A.8, G, I, J and the self-gate; sections A.2, A.4 and B.2 unchanged; earlier the same day: pair-review errata PE-57-01..PE-57-10 and PE-111-01..PE-111-07 applied, decisions D65-D68, see masterplan/11_audit_errata.md §5; earlier: 2026-10-08 RV-SPEC AU-2 errata AU2-03..AU2-08; 2026-10-07 row-35 security remediation SEC35-04/08/09/10/23/25)
---

# Capture Architecture Spec (blueprint row 31, M0)

## Errata index (fix passes of 2026-10-10)

> Added on 2026-10-10 by blueprint row 96 (register DOC-02). An index only: no text of this spec was
> changed, and each erratum stays where it stands. It lists the errata paragraphs the review-fix
> passes of 2026-10-10 added to THIS file (commit `f293221`). Errata of earlier passes (`PE-12x-…`,
> `PE-R8-…` and others) are marked inline as before and are not repeated here. Decision numbers
> refer to `decisions/decisions.md`.

| Erratum | Where | What it changes, in one line | Decision |
|---|---|---|---|
| PE-R63-13 | §C.4 | A first keyframe that arrives after T0 without a timestamp is not recorded, nor is anything up to the next keyframe; `FIRST_VIDEO_SAMPLE.skipped` and `skippedSpanMs` report it, and the span now counts the untimestamped lead | D126, D130, D179 |
| CAP-M7-01 | after §D.4 (it corrects §D.1 to §D.3 and §H) | §D.1 to §D.3 describe the SEALED camera file: the worker writes the recording in plaintext, the Core encrypts at seal time, the session key is made at seal time, the IV is random, and the media store root and its `.quarantine` must be owner-only | D147, D148, D178 |
| PE-R63-14 | §I P25 edits list | The record of the frozen-file waiver brought up to the code: 30 edits, all landed; the single source of the waived lines is the pin test | D179 |
| PE-WH-10 | §A.7.1, after "Fake microphone of slot 2" | A development setting lets the FIRST generated microphone play a synthetic speech fixture in the place of its tone; the fixture is held to its format at set-up and at boot; three named refusals | D198, D201, D209 |

Read with CAP-M7-01: its last bullet names `<data directory>/transcriber` as the place of a session's audio tap. Since fix pass F-M7c the tap lies under `<media store root>/.transcriber/sessions/<sessionId>/`, and the session keys are kept per media store root; both are stated in `06_evidence_package_spec.md` §H.7, erratum PE-M7-04 (D180, D189).

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
| D72(k), D73-D78, D80 (row 123; **delta PE-123-01**, 2026-10-09) | NEW SCOPE R-9..R-11 (`01_specs.md` §B.2): `CameraAdapter.discover()` becomes a real, **probe-only** WS-Discovery search owned by the Core process (one UDP socket for the duration of a search; probe-answer data only, no follow-up TCP read — D80(1)); every connectivity action is a separate operator action with an operator-typed credential held in memory for the connection test only (D76, D80(7)); adapter kind `LOCAL_DEVICE` (development only) puts two loopback helper processes in front of the **unchanged** worker paths (D73, D74); one development flag joined to row 61's single capture-mode definition with boot refusals (D72(l)); no camera within the ingest-open window = the session FAULTS with an operator notification (D72(k), R-10) | Sections A.1, A.6, A.7, A.8, G, I, J (deltas dated 2026-10-09). **Sections A.2, A.4 and B.2 are not changed by this delta** |

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

#### A.1.1 Delta 2026-10-09 (row 123) — adapter kinds, source classes, where the adapters live (PE-123-02; D73, D74, D75, D76, D80)

**Why.** R-9 and R-11 (`01_specs.md` §B.2) need three things the registry did not say: which
process the adapters run in, which **kind** of adapter stands behind a device, and which kinds are
development-only. Decisions: D73 (requirement and constraints), D74 (which device fills which slot),
D75 (the real-network search is an operator action that goes through this registry's camera adapter and nothing else), D76 (a search registers nothing), D80(9) (the development mark is a per-source class), D80(11) (the
discovery socket is not the worker's; a local device is never silently replaced by a fake).

**Where the adapters live (correction of the "Target" cells of §A.1, §A.6 and §A.7).** The table
above names `apps/capture-worker/src/adapters/`. That was written before the worker's build form was
fixed. As built, the worker is a C program that speaks only `packages/capture-protocol`
(`implementation/20_m3_worker_engine.md` §0; §A.2 W-6), listens for an RTSP push on loopback and
reads microphones from named pipes; it has no device adapter and must own no datagram socket (§A.2
W-1). The adapters are therefore **Core-process TypeScript**:
`apps/core-server/src/capture/adapters/{registry.ts, camera/, audio/, poe/, local-device/}`. Nothing
of an adapter is compiled into or loaded by the worker.

| Alternative | Verdict | Why |
|---|---|---|
| Adapters inside the worker (the 2026-10-07 text) | rejected | the worker would own the discovery socket (against §A.2 W-1 and D80(11)) and would have to change for R-11 (against D73, R-11 AC-4) |
| Adapters in a third process | rejected | a second supervised process and a second IPC protocol for work that is a few requests per operator action |
| **Adapters in the Core process, OS doors pinned file by file (§G.1)** | **chosen** | the Core already owns the credential path (operation 89), the audit trail and the session machine; the doors it opens are enumerated in §G.1 |

**Adapter kind and source class.** Every adapter and every descriptor carries a kind; the kind
decides the source class. The five kinds are fixed by `dbc-4` §N.2 (D83). `CaptureSourceClass` is the API class (two values); the manifest class has three values (`ev` §B.12). **Erratum PE-128-65 (D83).**

```ts
type CaptureAdapterKind = 'ONVIF_RTSP' | 'USB_AUDIO' | 'SNMP_POE' | 'FAKE' | 'LOCAL_DEVICE';
type CaptureSourceClass = 'PRODUCTION' | 'DEVELOPMENT';
// PRODUCTION: ONVIF_RTSP, USB_AUDIO, SNMP_POE.   DEVELOPMENT: FAKE, LOCAL_DEVICE (D80(9)).
interface CaptureDeviceDescriptor {            // additions to the sketch above
  adapterKind: CaptureAdapterKind;
  sourceClass: CaptureSourceClass;             // derived from adapterKind by ONE function, never stored twice
}
```

Registry rules added (each is a refusal with a typed error, never a fallback):

| # | Rule | Authority |
|---|---|---|
| RG-1 | The registry is built once at boot from the capture operation of §A.1.2: in `REAL_PRODUCTION` only `PRODUCTION` kinds are registered; in `REAL_DEVELOPMENT` only `DEVELOPMENT` kinds plus the discovery / connection-test half of `ONVIF_RTSP` (so that the search and the connect flow can be exercised on fixtures and, by the user, on a real camera); in `SIMULATED` no adapter is registered. The registry states which kinds have an opener. The class of a candidate is decided by how it was found: one reached through the injected loopback target, or whose host is a loopback address, is `FAKE` (SEC35-41 (a)). **Erratum PE-128-48** | D73; R-11 AC-2; C-N14; D86 C-5; SEC35-40 |
| RG-2 | `list()` never returns a `DEVELOPMENT` descriptor outside `REAL_DEVELOPMENT` (operations 76/77 list 0 development sources with the flag off) | R-11 AC-2 |
| RG-3 | An assignment to `VIDEO-01` / `VIDEO-02` / a mic role is refused when the device's source class is not the class of the running operation (no mixed configuration: a production camera is never recorded beside a fake microphone) | R-11 AC-1; this row (alternative "mix freely, mark per track" rejected: the manifest mark is per track, D80(9), but one session with both classes cannot be called either production or development evidence) |
| RG-4 | A candidate of a search (§A.6.1) is **not** a descriptor and never enters the registry; only a successful connection test followed by the adoption of row 142 creates one | D76 (1); R-9 AC-4, AC-8 |
| RG-5 | `resolve()` of a `LOCAL_DEVICE` source that cannot be opened returns the named error of §A.6.4; no code path substitutes a `FAKE` adapter for it | D80(11); R-11 AC-5 |

**Development slots (D74 (2)).** In `REAL_DEVELOPMENT` the plan builder (row 66) names exactly these
four sources; Desk View and the two "Capture screen" entries that avfoundation also lists on this
Mac (probe P-1, `delegation_progress/data_analyst_row123.md` §3) are never selectable:

| Slot | Device ID | Adapter kind | Source | Process in front of the worker |
|---|---|---|---|---|
| Camera 1 | the local camera's own row — the next free `CAM-NN` (`CAM-03` on a fresh seed) -> `VIDEO-01` | `LOCAL_DEVICE` | avfoundation video device named exactly `MacBook Air Camera` | camera helper (§A.6.4) |
| Camera 2 | `CAM-02` -> `VIDEO-02` | `FAKE` | generated test picture | fake camera source (§A.6.4) |
| Mic 1 (primary) | the local microphone's own row — the next free `MIC-NN` (`MIC-03` on a fresh seed) | `LOCAL_DEVICE` | avfoundation audio device named exactly `MacBook Air Microphone` | mic helper (§A.7.1) |
| Mic 2 (standby) | `MIC-02` | `FAKE` | generated 880 Hz tone | fake mic source (§A.7.1) |

The seeded built-ins `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02` stay `FAKE`; the adapter kind of a row never changes; row 136 registers the two local rows and development mode assigns them in the selector (D83, D-DB-13). **Erratum PE-128-46 (D83 D-DB-13).**

Device IDs are the wire subjects (D72(g)); `VIDEO-0x` is the output name only.

#### A.1.2 Delta 2026-10-09 (row 123) — the development flag and what boot refuses (PE-123-03; D72(l), D73, D80(9))

**One definition.** Row 61 owns the single definition of capture mode (pair-58 finding A-3,
`delegation_progress/pair_58_navigator_a.md:40`: today `captureModeOf(config)` in
`apps/core-server/src/modules/capture-config/fencing.ts:55-57` reads the demo flag and
`config.captureMode` reads `DEMS_CAPTURE_MODE`, independently). This delta adds **no second
definition**: it adds one input and one output value to that same function. The function is the only
reader of the development flag (static rule G-R15).

| Key (environment) | Values | Default | Meaning | Owner |
|---|---|---|---|---|
| `DEMS_CAPTURE_MODE` (exists, `config.ts:43`) | `simulated` \| `real` | `simulated` | whether a capture worker may be started | row 58 (landed) / row 61 (relation) |
| `DEMS_DEMO_CONTROLS` (exists, `config.ts:41`) | `1` \| `0` | — | fault injection, scenario load, reset | task 2 / row 61 (relation) |
| **`DEMS_CAPTURE_DEV_SOURCES`** (new, proposed name) | `1` \| `0` | `0` | the development flag: development sources (`FAKE`, `LOCAL_DEVICE`) exist | row 136 (lands), row 61 (reads it in the one function) |
| **`DEMS_CAPTURE_HELPER_FFMPEG`** (new, proposed name) | absolute path | none | the FFmpeg program the development helpers run (§A.6.4); required when the flag is `1` | row 136 |

The one function returns a closed union (name proposed; row 61 fixes it):

```ts
type CaptureOperation = 'SIMULATED' | 'REAL_PRODUCTION' | 'REAL_DEVELOPMENT';
function captureOperationOf(config): CaptureOperation;  // the ONLY place that reads the three flags together
```

Allowed combinations and boot refusals. "Stored sources" = the adapter kinds of the devices
assigned in the selector (`capture_devices`, read by the CS-22 boot checks of row 61).

| # | `DEMS_CAPTURE_MODE` | `DEMS_DEMO_CONTROLS` | `DEMS_CAPTURE_DEV_SOURCES` | Stored sources | Boot | Operation / refusal code (codes proposed) |
|--:|---|---|---|---|---|---|
| 1 | `simulated` | `1` | `0` | any — every stored kind is inert in `SIMULATED` (after set 4 the four development databases hold four assigned `FAKE` devices and must keep booting; `dbc-4` §N.9; D83 O-2). **Erratum PE-128-47** | boots | `SIMULATED` — today's demo; no worker, no adapter, generated levels |
| 2 | `real` | `0` | `0` | production kinds only (or none) | boots | `REAL_PRODUCTION` — real devices only; a search and the connect flow are available; in this phase nothing is recordable in `REAL_PRODUCTION`: the search, the connection test, adoption and assignment are available, but no listener opens and no session starts for a source kind without an opener (`ONVIF_RTSP`, `USB_AUDIO` today) — the plan builder refuses with `SOURCE_KIND_NOT_RECORDABLE` before `app.capture.start`; no all-`PRODUCTION` package can be sealed (D82, D86 C-5; the pull path is class C-2). **Erratum PE-128-48** |
| 3 | `real` | `0` | `1` | development kinds only (or none) | boots | `REAL_DEVELOPMENT` — the four slots of §A.1.1; every list, session and package carries the development label and mark (R-11 AC-6, AC-7) |
| 4 | `real` | `1` | any | any | **refused** | row 61's refusal of capture mode `real` with demo controls on (blueprint row 61 verification text); unchanged in development: a capture-originated fault is the capture side's (D72(h)), so demo fault injection has no place beside a real worker in either class |
| 5 | `simulated` | `0` | `0` | any | row 61 decides (refused or labelled, A-3) | not this row's; this delta only requires that row 61 states it |
| 6 | `simulated` | any | `1` | any | **refused** | `DEV_SOURCES_NEED_REAL_CAPTURE` — the flag promises sources that no worker would ever record |
| 7 | `real` | `0` | `0` | **any development kind** | **refused** | `DEV_SOURCE_WITHOUT_FLAG` — R-11 AC-1 (a). The message names the device IDs and the remedy (boot once with the flag, unassign, boot without) |
| 8 | `real` | `0` | `1` | **any production kind** | **refused** | `DEV_FLAG_WITH_PRODUCTION_SOURCE` — R-11 AC-1 (b) |
| 9 | `real` | `0` | `1` | — , and `DEMS_CAPTURE_HELPER_FFMPEG` unset or failing the path check | **refused** | `DEV_HELPER_PROGRAM_UNUSABLE` — same check as the worker path of row 61 (absolute, resolves to a regular executable file, not writable by group or others; **erratum PE-128-63:** the helper program path is resolved; its owner must be root or the Core's user and no directory on the way may be group- or other-writable) |
| 10 | any | any | `1` | — , and a listener outside loopback configured | **refused** | `DEV_FLAG_WITH_LAN_LISTENER` — cannot occur today (OD-13: no LAN listener exists, C-5 is class C); stated so that the fence exists before the listener does |

**"Production configuration" defined (answers `01_specs.md` B.2.7 item 7).** A configuration is a
production configuration when at least one device assigned in the selector has source class
`PRODUCTION`, or when a listener outside loopback is configured. The development flag is refused
with either (rows 8 and 10).

| Alternative for the fence | Verdict | Why |
|---|---|---|
| A second mode value `DEMS_CAPTURE_MODE=development` | rejected | it would make "is the worker real?" a three-way question in every reader of `captureMode`; the worker, the supervisor and the fencing of M2 only need `real` / `simulated` |
| Decide per session, not at boot | rejected | R-11 AC-1 asks for a boot refusal; a per-session decision leaves a production Core that can be talked into a development session |
| Allow the flag with demo controls on | rejected | row 4: two owners of faults in one run |
| **One extra boolean read inside row 61's one function, with rows 6-10 refused at boot** | **chosen** | three operations, one reader, every unsafe pair refused before a listener opens |

Hand-over: rows 61 and 136 implement the table; the configuration keys are P25 edits 15-18 (§I
delta). **Assumption:** row 61 keeps the relation "capture mode `real` requires demo controls off"
that its verification text names; if row 61 decides row 5 differently, only row 5 of this table
changes.

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

#### A.6.0 Delta 2026-10-09 (row 123) — what changes in this section (D73, D74, D75, D76, D80)

The sketch above stays the seam; five things are added or narrowed. **Class boundary after this
delta:** unauthenticated discovery (§A.6.1) and the read-only connection test (§A.6.2) are scheduled
work (rows 131, 142); `ntpOffsetMs` as a *set*, GOP set, profile change, PoE cycle and the RTSP
session that records a real camera stay class C (C-1, C-2, C-3).

```ts
interface CameraAdapter {                                  // delta: members added or narrowed
  readonly kind: CaptureAdapterKind;                       // §A.1.1
  discover(search: DiscoverySearch): Promise<DiscoveryResult>;                 // §A.6.1 — probe only
  testConnection(candidate: CameraCandidate, credential: CameraCredential | null,
                 signal: AbortSignal): Promise<ConnectionTestResult>;           // §A.6.2 — reads only
  openSource(deviceId: string, target: { ingestUrl: string }, signal: AbortSignal): Promise<SourceHandle>; // §A.6.4 — FAKE / LOCAL_DEVICE; ONVIF_RTSP = class C-2
  profiles(deviceId: string): Promise<MediaProfile[]>;     // unchanged; for ONVIF_RTSP it returns what the last successful test read, it makes no request of its own
  pullUrl(deviceId: string, profile: string): string;      // unchanged: host/path form, never a credential (SEC35-04)
  ntpOffsetMs(deviceId: string): Promise<number>;          // unchanged; a read; setting the clock is class C
}
```

#### A.6.1 `discover()` — probe-only WS-Discovery (PE-123-04; D74 (1), D75, D76 (1), D80(1), D80(11); C-N13)

**Subject.** How the Core finds cameras on the network it is attached to, without connecting to any
of them. **Stakeholders:** the operator with `CAPTURE_CONFIG` who presses "Search for cameras"; the
owner of the network (a probe is multicast traffic on it); rows 131, 132, 126, 127.

**What the protocol gives (verified against the specification text; anything not verified is
labelled).**

| # | Fact | Source |
|--:|---|---|
| V-1 | Probe goes to UDP port 3702, IPv4 multicast `239.255.255.250`; IPv6 `FF02::C` (link-local scope) | OASIS WS-Discovery 1.1 §3.1.1 (fetched 2026-10-09) |
| V-2 | A `ProbeMatch` carries `EndpointReference` (required), `Types`, `Scopes`, `XAddrs` (each optional in WS-Discovery) and `MetadataVersion` (required) | WS-Discovery 1.1 §5.3 outline |
| V-3 | A `ProbeMatches` message carries `RelatesTo` equal to the message ID of the Probe, and is sent unicast to the source address and port of the Probe | WS-Discovery 1.1 §5.3, §5.3.1, §1.7 |
| V-4 | A target service waits a random time between 0 and `APP_MAX_DELAY` (default 500 ms) before it answers | WS-Discovery 1.1 §3.1.3, Table 5 |
| V-5 | A target service answers with one `ProbeMatch`; a discovery proxy may send zero or several in one message | WS-Discovery 1.1 §5.3 |
| V-6 | Discovery messages need not be secured ("does not require that endpoints participating in the discovery process be secure"): **an answer is an unauthenticated claim** | WS-Discovery 1.1 §8.1 |
| V-7 | An ONVIF device implements the target-service role, uses the 2005/04 discovery namespace and a `urn:uuid:` endpoint reference that is stable and "constant across network interfaces" | ONVIF Core Specification 26.06 §7.1, §7.3.1, namespace table (prefix `d`) |
| V-8 | An ONVIF device "shall include" `tds:Device` in `Types`; the text of version 26.06 does not contain the older `NetworkVideoTransmitter` type at all (0 matches in the extracted text) | ONVIF Core 26.06 §7.3.2.1 |
| V-9 | Scopes have the form `onvif://www.onvif.org/<path>`; categories: Profile, Location, Hardware, Name, MacAddress, SerialNumber; a device "shall include at least one fixed entry ... of the profile, hardware and name categories". **There is no vendor / manufacturer category** | ONVIF Core 26.06 §7.3.2.2.1, Table 8 |
| V-10 | A device "shall include the `<d:XAddrs>` element with the addresses for the device service in a matching probe match message" | ONVIF Core 26.06 §7.3.3 |
| V-11 | A device can be set non-discoverable; it then does not answer | ONVIF Core 26.06 §7.2 |
| V-12 | `GetDeviceInformation` (manufacturer, model, serial number) has access class `READ_SYSTEM` — not available to an anonymous user under the default policy; `GetSystemDateAndTime` and `GetServices` are `PRE_AUTH` | ONVIF Core 26.06 §8.3.1, §8.3.6, §8.1.2, §5.9.4.3 Table 7 |

Consequences for `01_specs.md` B.2.0: assumption A-2 holds for address, endpoint reference, name
and hardware (model) hint and is **wrong for "vendor"** (V-9: no such category — a vendor hint
exists only when a device adds a non-standard scope); assumption A-3 is confirmed by V-12 for the
default access policy. D80(1) costs nothing the specification promised: the manufacturer and the
serial number are behind authentication by default anyway.

**Message flow.**

```text
operator action (operation of row 121)            Core process                         network
  "Search for cameras"  ───────────────►  rate limit, single-flight check
                                          select interface(s)                (os.networkInterfaces, no process, no socket)
                                          open ONE udp4 socket, port 0       ──┐
                                          t = 0 ms     Probe A (Types tds:Device)               ──► 239.255.255.250:3702
                                                       Probe B (Types dn:NetworkVideoTransmitter) ─► 239.255.255.250:3702
                                          t = 250 ms   the same two datagrams once more (same MessageIDs)
                                          t <= 3000 ms ProbeMatches  ◄── unicast, from each responder's own address
                                          t = 3000 ms  close the socket      ──┘  (also on every error path and on abort)
  candidate list (session-scoped)  ◄────  DiscoveryResult { candidates, counts }      nothing registered, nothing connected
```

**Design decisions.**

| # | Topic | Decision | Alternatives and why not |
|--:|---|---|---|
| DS-1 | Who owns the socket | The **Core process**, in exactly one file, `apps/core-server/src/capture/adapters/camera/ws-discovery.ts` (the only importer of `node:dgram`, §G.1 G-R9). The capture worker owns no datagram socket (§A.2 W-1) and is not involved in a search | the worker (rejected: W-1, D80(11)); a helper process (rejected: a process to send four datagrams) |
| DS-2 | How many sockets | **One** `udp4` socket per search, created when the search starts, closed when the window ends, on every error and on abort; none before or after (C-N13 bounds 1-3). `reuseAddr` is **not** set | a socket kept open between searches (rejected: C-N13); a listener for `Hello` announcements (rejected: it would be a background receiver, D74 (1)) |
| DS-3 | IPv4 or also IPv6 | **IPv4 only.** | IPv6 link-local (`FF02::C`, V-1) rejected for this phase: the plan, the anti-steering rule and the fixtures are IPv4 literals; a link-local IPv6 service address needs a zone index inside a URL, which widens the address-parsing surface of the connection test. **Gap recorded:** a camera reachable over IPv6 only is not found (same class as D80(10)) |
| DS-4 | Which local interfaces | Eligible = every interface entry of `os.networkInterfaces()` that is IPv4, not internal, has a netmask other than `255.255.255.255` and a non-zero hardware address. Link-local `169.254.0.0/16` **is** eligible (ONVIF Core §6: devices should support link-local addressing — a camera on a switch with no DHCP server). **One eligible interface:** the socket is bound to that interface's address, port 0. **Several:** still one socket, bound to `0.0.0.0` port 0, and the two probes are sent once per interface with `setMulticastInterface`; at most 4 interfaces. **None:** the search does not run (`NO_ELIGIBLE_INTERFACE`) | bind `0.0.0.0` always (rejected: "never bind beyond what is needed"); one bound socket per interface (rejected: C-N13 says one socket per search); a configuration key naming the interface (rejected for now: one more frozen-file key; revisit if the Core device has a dedicated camera network and the rule above picks wrongly). On this Mac the interface list holds tunnel, bridge and peer-to-peer entries besides the Ethernet / Wi-Fi ones (probe P-6: name classes only) — hence the property test, not a name list |
| DS-5 | Multicast reach | `setMulticastTTL(1)`: the probe does not leave the local segment | a larger TTL (rejected: searching other people's segments) |
| DS-6 | Probe content | SOAP 1.2 envelope, WS-Addressing 2004/08, action `http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe`, `To` `urn:schemas-xmlsoap-org:ws:2005:04:discovery`, a fresh `urn:uuid:` message ID per probe from the platform's random UUID. **Two probes:** Types `tds:Device` (V-8) and Types `dn:NetworkVideoTransmitter` (the type older devices announce — **hypothesis** from the analyst's recall of earlier Core versions; it is what the `onvif` package probes for, `lib/discovery.js` of 0.8.3). No `Scopes` filter. Nothing about this product is in the message | one probe with empty Types (rejected: every WS-Discovery device on the segment answers — printers, PCs — more device data than needed); only `dn:NetworkVideoTransmitter` (rejected: V-8 — a device following 26.06 to the letter need not announce it) |
| DS-7 | Window and repeats | Window **3,000 ms** from the first datagram (contract constant `CAPTURE_DISCOVERY_WINDOW_MS` = 3,000 ms, C3 §7; accepted D82(c); **erratum PE-128-58**). Each probe is sent twice, 250 ms apart. Floor: 250 ms + `APP_MAX_DELAY` 500 ms + 100 ms = 850 ms (V-4; WS-Discovery Table 12 `MATCH_TIMEOUT`); the rest is margin for Wi-Fi and slow devices. No further retry: "Search again" is the operator's | 5,000 ms (the package default; rejected: no evidence it finds more, and the operator waits); adaptive extension while answers arrive (rejected: unbounded) |
| DS-8 | What is accepted | A datagram is used only if **all** hold: source is IPv4 and on-link for a probed interface (`(source & mask) == (interface & mask)`); size <= 16 KiB; it parses as a SOAP envelope; `Action` is the ProbeMatches action; **`RelatesTo` equals one of this search's two message IDs** (V-3); it holds >= 1 `ProbeMatch` with a non-empty endpoint reference of <= 120 characters (the cap of `endpointRef` in C3 §2.6; a valid ONVIF reference is `urn:uuid:` plus 36 characters; **erratum PE-128-50**). Everything else is dropped and **counted**, never logged with content. Caps: 256 datagrams processed and 64 distinct responders per search, then the result is marked `truncated`. **Erratum PE-128-49 (D86 SEC35-28, SEC35-30):** an answer whose source is an address of this host, the network or broadcast address of the probed interface, or a multicast or unspecified address is dropped and counted; one answer per source address per search (a second is counted, not listed); the 64-responder cap keeps already-registered matches first, then arrival order; when the 256-datagram cap is reached the socket is closed at once; a registered match whose address differs from the stored one is marked `addressChanged`; the result carries the number of interfaces probed | accept without `RelatesTo` (rejected: any host could push "cameras" into the list at any time during the window; the message ID is the only secret a responder must have seen) |
| DS-9 | **Anti-steering rule** (D80(11); R-9 AC-10) | The candidate's `sourceAddress` is the address the datagram came from (the kernel's, not the message's). From `XAddrs` (V-10; a space-separated list) the **service address** is the first `http:` or `https:` URI whose host is an IPv4 literal **equal to `sourceAddress`**, with no user-info part. If no entry qualifies the device is still listed (it did answer) with `connectable: false` and the reason `NO_SERVICE_ADDRESS` or `ADDRESS_MISMATCH`; no later step may contact a host that a message named and the kernel did not | take the first XAddr (what `lib/discovery.js` `matchXAddr` falls back to — rejected: a responder could aim the operator's credential at a third host); resolve host names (rejected: DNS on a claim) |
| DS-10 | What a candidate is | `{ candidateId (random, per search), endpointRef, sourceAddress, serviceAddress \| null, connectable, types[], nameHint, hardwareHint, vendorHint (null unless a non-standard scope states it), profileHints[], locationHints[], macHint, serialHint }` — every field is read from the answer; **no field needs a request to the device** (D80(1); R-9 AC-2). **Erratum PE-128-65 (D83; C3 §2.6):** API shape (`CaptureCandidate`): `sourceAddress` -> `host`; `connectable` -> `testable`; `nameHint` -> `name`; `hardwareHint` -> `model`; `vendorHint` -> `vendor` (null unless a non-standard scope states it). `serviceAddress`, `types`, `profileHints`, `locationHints`, `macHint` and `serialHint` are not returned by operation 94. The mark new / already registered and the matching key are rows 121 / 122 (the stable identifier the protocol offers is the endpoint reference, V-7) | reading `GetDeviceInformation` / `GetScopes` over TCP (rejected by D80(1); and V-12 says it would mostly be refused) |
| DS-11 | Rate limit | Single-flight: one search at a time per Core; a second request while one runs gets the running search's result or a typed refusal (row 121 chooses). Limits by name from C3 §7: single-flight per Core; 5 s between starts per Core and 10 s per operator session; 6 per minute per Core; 30 per hour per operator session; the pre-check search has its own allowance (**erratum PE-128-58**, D86 C-8). An attempt over the bound sends nothing | per operator only (rejected: two operators could double the traffic) |
| DS-12 | What is logged and stored | The Core log gets **counts only**: interfaces probed, datagrams sent, received, accepted, dropped per reason, candidates, duration, `truncated`. No address, endpoint reference, MAC, serial, name or scope in any log, audit detail or error text (R-9 AC-16; C-N15). Candidates live in the operator session's memory (row 132) and nowhere else: product code has **no file writer for candidates**. The real-LAN check of row 131 writes its raw result only from the test harness, to git-ignored `.data/discovery/` (`.gitignore:70`); committed files quote counts and model class | a debug log of answers (rejected: device-identifying data in a file that is not git-ignored by construction) |
| DS-13 | Zero responders | `{ candidates: [], counts }` is a **successful** result; the API layer (rows 132, 133) writes the one audit row with count 0 and raises the one R-10 alert (D80(8)). Distinct from it: `NO_ELIGIBLE_INTERFACE` and `SOCKET_ERROR` (bind or send refused) are "the search could not run" — reported as such, **never as "no camera found"** (R-9 AC-15 "not run") | fold both into an empty list (rejected: the operator would be told the network is empty when nothing was sent) |
| DS-14 | Time | Every timer goes through the capture timer seam (`apps/core-server/src/capture/timers.ts`); tests run on a fake clock (C-N5) | wall-clock waits in tests (forbidden) |
| DS-15 | Tests | The automated suite sends the two probes **unicast to the fake stub on `127.0.0.1`** (§A.8.1): the target `{ address, port }` is a constructor argument that only the fake registry may set — no configuration key, no environment variable. Production code has the multicast target as a constant (D74 (1); R-9 AC-14). **Erratum PE-128-66 (SEC35-27 (6); G-27):** a booted lane Core used by client checks is started by a test-support launcher (under `apps/core-server/test/support/`) that builds the app with the fake adapter registry and passes the loopback target; no file under `src/` passes it | multicast on the loopback interface in tests (rejected: it leaves the process boundary on some hosts and depends on the machine's multicast routing) |
| DS-16 | Parser and handler hardening (**erratum PE-128-51**; D86 SEC35-29, SEC35-48, SEC35-30) | The whole datagram handler is one `try` / `catch` that counts and drops; parser options pinned in the one file — `strict: true`, `explicitArray: true`, `async: false`, no value or attribute processor; the parsed answer is read by fixed paths only (no recursive walk, no serialisation, no clone, never handed to a logger); the 16 KiB cap applies to the byte length before any text is made; a datagram containing `<!DOCTYPE` or `<!ENTITY` is dropped before parsing; bound per search 256 datagrams x 16 KiB; a stored candidate is at most 2 KiB (hint lists capped at 8 entries of 120 characters); device text is sanitised before a candidate exists (control, direction-override and zero-width characters removed, 120 characters; SEC35-48); the socket type literal is `udp4` | — |

**Failure modes added:** no eligible interface; bind or send refused (also what a host firewall or
the operating system's local-network privacy control produces — H-13); an answer with a foreign
`RelatesTo`, an off-link source, several `ProbeMatch` children, an oversized or malformed body
(dropped and counted; the Core must survive each — check by row 131 on the stub); two interfaces on
the same segment (two answers with one endpoint reference from the **same** source address are one candidate; from **different** source addresses both are listed with `conflict: true` and neither is testable (the same when two endpoint references come from one address); **erratum PE-128-49**, D86 SEC35-28); a non-discoverable device (V-11: not found; gap).

#### A.6.1a The dependency decision (PE-123-05; Q-INSTALL item 6, DP-13; the user's ready-made-frameworks rule)

**Approval text.** `report/report.md:72`: "Q-INSTALL | Blanket approval for: ... (6) an ONVIF client
npm package after B2. Each install is logged with version, size and its uninstall command; no
sudo"; `identification/02_structured.md:606` (DP-13): "pre-approved; the package is named and
checked for licence and maintenance in row 123 before row 131 installs it". Candidates were
collected earlier (`research/02_collection.md` F-81..F-83, F-87).

**Package named: `onvif` 0.8.3** (repository `github.com/agsh/onvif`, licence MIT, one runtime
dependency `xml2js ^0.6.2`, `engines.node >= 14`, 20 files, 283,576 bytes unpacked, published with
registry provenance by the repository's CI; registry document fetched 2026-10-09; publish date
2026-09-07 per F-81; no conformance statement exists for any candidate, F-87).

What its discovery does, **read in the source** of 0.8.3 (`lib/discovery.js`, 6,840 bytes,
SHA-256 `9370a677...27f6a5`; by inspection, not executed):

| # | Observation | Effect here |
|--:|---|---|
| O-1 | `resolve` defaults to true: every answer becomes a `Cam` object, and `Cam` connects by itself unless `autoconnect: false` (`lib/cam.js:121-123`; its `connect()` calls `getSystemDateAndTime`, `getServices` / `getCapabilities`, `getProfiles`, `getVideoSources`) | the default breaks D76 (1) and D80(1); `resolve: false` avoids it |
| O-2 | "`// TODO check for matching RelatesTo field and messageId`" — answers are not matched to the probe | DS-8 cannot be met |
| O-3 | `matchXAddr` returns `ipMatch[0] \|\| xaddrs[0]` | in `resolve` mode the anti-steering rule DS-9 is not applied; with `resolve: false` the rule would be ours anyway |
| O-4 | Probes for `dn:NetworkVideoTransmitter` only | V-8: a device announcing only `tds:Device` is not found |
| O-5 | Without the `device` option the socket is bound to all interfaces; `reuseAddr: true` | DS-2 / DS-4 not met without extra care |
| O-6 | The window is a real `setTimeout`; the socket is closed only there. On a socket or bind error the callback fires and the socket stays open until the timer; no abort | C-N13 bound 2 ("closed on every error path") not met |
| O-7 | A malformed datagram makes the module `emit('error', ...)` on a shared singleton emitter; an emitter with no `error` listener throws | a listener must always be attached |
| O-8 | After a successful parse it reads `data.probeMatches.probeMatch.endpointReference.address`. With two `ProbeMatch` children (V-5 allows it) `probeMatch` is an array (`lib/utils.js` `linerase`) and the read throws a `TypeError` **inside a `setImmediate` callback** — an uncaught exception of the process | **one crafted datagram to the open port ends the Core process.** Searching is allowed while a session is open (D80(4)), so this is a way to stop a recording from the network. Not containable from outside the package |

| Option | Ready-made rule | Constraints C-N13, D80(1), DS-8, DS-9 | Static guards | Cost | Verdict |
|---|---|---|---|---|---|
| (a) `onvif` package for discovery **and** for the connection test | best fit | discovery fails O-2, O-4, O-6 and O-8; O-8 is a process crash on hostile input | no `node:dgram` import of ours, but a socket we do not control | lowest | **rejected for discovery** |
| (b) own WS-Discovery probe over `node:dgram`, **and** own SOAP / WS-Security client for the test | hand-built twice | meets all | two doors of ours | highest; hand-written digest authentication is the kind of code this project should not write | rejected |
| **(c) own probe over `node:dgram` (one file, about 200 lines, parsing with `xml2js`) + the `onvif` package for the authenticated connection test only (§A.6.2)** | the kit is used where it covers the need (ONVIF SOAP, WS-Security digest, HTTP digest, `GetProfiles`, `GetStreamUri`); the hand-written part is the piece the kit gets wrong, and is recorded here as the decision the rule asks for | meets all | one pinned `node:dgram` file, one pinned importer of `onvif` (§G.1) | medium | **recommended** |

WS-Discovery is not ONVIF-specific; the probe is two fixed SOAP strings, one socket and a filter.
The parser is `xml2js` (MIT; it arrives with `onvif` and is declared as a direct dependency so that
the probe does not rely on a transitive one), configured so that repeated elements are always
arrays (the cause of O-8) — **H-14, measured:** on `xml2js` 0.6.0 by row 126 (`sec` §11.1 (b)) entity expansion and prototype pollution are resisted; the risk is our own code in the parse callback. Row 131 repeats the measurement on the pinned version. **Erratum PE-128-51 (D86 SEC35-29).**

**Licence entries for row 96 (DOC-05):** `onvif` 0.8.3 — MIT, "Copyright (c) 2018 Andrew Laptev"
(the package's `LICENSE`); `xml2js` — MIT; its dependencies `sax` (the lockfile records
`BlueOak-1.0.0` for the 1.6.1 already present) and `xmlbuilder` (MIT). Exact versions are whatever
row 131 pins; core-server pins exact versions (`apps/core-server/package.json:25-34`), so `onvif`
is pinned `0.8.3` and `xml2js` exactly. Row 131 stays the sole lockfile writer and logs version,
size and the uninstall command (Q-INSTALL). **No install was made by this row.**

**Effect on blueprint row 131 (for the controller).** Its text says "plus reading the responders'
unauthenticated device information and scopes" — after D80(1) only the scopes **in the answer** are
read. Its dependency clause stands (it installs `onvif` and `xml2js`), but its own code uses the
package for nothing: the first user of `onvif` is row 142.

#### A.6.2 Candidate -> operator action -> credential -> connection test -> adopt -> assign (PE-123-06; D76, D80(1), D80(4), D80(7), D80(11); C-N15)

| Step | Who acts | Adapter method | Network traffic | What exists afterwards |
|--:|---|---|---|---|
| 1 Search | operator (or once inside an operator-started pre-check) | `discover()` | 4 datagrams out per interface; answers in | a candidate list in the operator session; 0 rows anywhere |
| 2 "Connect" on one candidate | operator | none | none | the web console shows the credential prompt (D80(3): web only) |
| 3 Credential typed | operator | none | none | the credential is in the request to the connection-test operation (row 121), nowhere else |
| 4 Connection test | the Core, for that operator | `testConnection(candidate, credential, signal)` | reads only, to the candidate's own address (below) | one outcome + one audit row with the outcome name; the credential is gone (§A.6.3) |
| 5 Adopt | operator, only after `REACHABLE` | none (row 142: `capture_devices` row with the adapter kind, endpoint reference, service address, the profile read by the test) | none | a registered device |
| 6 Persist the credential | part of step 5: operation 96 carries the credential in its body and stores it in the adoption transaction through the operation-89 write path (D81; **erratum PE-128-52**) | none | none | available once row 84's sealer exists; until then `503 CREDENTIAL_STORE_NOT_READY` (D80(7)), so an **authenticated** camera is adoptable after row 84, an unauthenticated / fixture / local-device source from M4 |
| 7 Assign | operator, operations 78 / 79 | none | none | the selector names the device; refused for a candidate that did not pass step 4 (R-9 AC-5) |

`testConnection` refuses **before any network request** (0 outbound requests, asserted on the stub
log) when: the candidate is not of the calling operator session or has expired; `connectable` is
false; `credential` is null and the target is not a loopback fixture (`CREDENTIAL_REQUIRED` — no
default, no stored-for-another-device, no guessed value, C-N15); a session is open
(`409 CAPTURE_CONFIG_LOCKED`, D80(4)); the rate limit is exceeded. The operator cannot type a host,
a port or a URL (D80(10)).

**The five outcomes, each defined by what is observed.** Order of evaluation is top to bottom; the
first that applies is the outcome.

| Outcome | Observed | Requests made |
|---|---|---|
| `UNREACHABLE` | the TCP connection to the candidate's service address is refused or times out; or no HTTP answer to `GetSystemDateAndTime` | <= 1 HTTP attempt (**erratum PE-128-53**, D82: no RTSP half) |
| `AUTHENTICATION_FAILED` | `GetProfiles` with the operator's credential is answered HTTP 401 / a SOAP `NotAuthorized` fault; or the device accepts only an authentication scheme that would send the password in clear (HTTP Basic, WS-Security `PasswordText`) — reason `SCHEME_NOT_ALLOWED`, **the password is not sent** | `GetSystemDateAndTime`, `GetServices`, `GetProfiles` |
| `WRONG_PROFILE` | authenticated, but: `GetProfiles` returns no profile, or none with a video source and a video encoder configuration; or `GetStreamUri` for RTSP returns no URI, a URI that is not `rtsp:`, a URI with a user-info part, or a URI whose host is not the candidate's `sourceAddress` (reason `STREAM_HOST_MISMATCH`: the foreign host is **not** contacted) | + `GetStreamUri` |
| `NOT_H264` | a usable profile exists but no profile's video encoder is H.264 (ONVIF answer) | (none further) |
| `REACHABLE` | authenticated; an H.264 profile; `GetStreamUri` names the candidate's own address. Result carries: profile token, resolution, frame rate and GOP length **as announced**, and warnings — `GOP_ABOVE_BOUND` when the announced GOP is longer than 2 s (Q-GOP; changing it is class C) | all of the above |

Rules of the test:

| # | Rule | Why |
|--:|---|---|
| CT-1 | **Reads only.** The complete list of device operations the test may call is: `GetSystemDateAndTime` (`PRE_AUTH`, V-12; the WS-Security digest needs the device's clock), `GetServices` (`PRE_AUTH`; `GetCapabilities` only if a device lacks it), `GetProfiles`, `GetStreamUri`. No `Set*`, `Create*`, `Add*`, `Remove*`, `Delete*`, no PTZ, no reboot, no NTP, GOP or profile change, no PoE action — **class C** (D75, D76; C-1). Enforced by a pinned call list (§G.1 G-R11) and by the stub's request log (R-9 AC-3, AC-6) | D75 bounds; `01_specs.md` R-9 AC-6 |
| CT-2 | **No RTSP.** The Core opens no RTSP connection in this phase; codec and profile are judged from the authenticated ONVIF answer; the stream address is compared, never stored, never contacted. An RTSP-level test belongs with the pull path (class C-2). **Erratum PE-128-53** | D82; SEC35-27 (4); SEC35-32 (4); W-1 spirit; D76 (2) "test with a clear result", not a preview (OD-12) |
| CT-3 | **Address pinning.** Every request goes to `sourceAddress`. The `onvif` client is created with `autoconnect: false` (O-1) and `preserveAddress: true` (`lib/cam.js:106`: "force using hostname and port from constructor for the services"), so a service address announced inside `GetServices` cannot move the next request; the RTSP URI is checked as in `WRONG_PROFILE` | DS-9; R-9 AC-10 (not an SSRF or port-scan primitive: the only reachable hosts are devices that answered this operator's search from their own address) |
| CT-4 | **Timeouts.** TCP connect 3 s; each request 5 s (the package default is 120 s, `lib/cam.js:94` — it must be set); the whole test 15 s, enforced by the `AbortSignal`; no retry inside a test except the single digest round of a 401. A second attempt is a new operator action with a newly typed credential (R-9 AC-7, AC-8). The 15 s whole-test bound is `CAPTURE_CONNECTION_TEST_TIMEOUT_MS`, enforced by destroying the per-test agent; received bytes are capped at 1 MiB per test (SEC35-33). **Erratum PE-128-54** | bounded operator wait; a camera's own lock-out counter |
| CT-5 | **Rate.** One test at a time per Core; lock-out guard `CAPTURE_CONNECTION_TEST_MAX_FAILURES` = 2 `AUTHENTICATION_FAILED` per host in `CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS` = 30 minutes, counted per Core by host (D86 C-2); at most 2 rejected credential-bearing requests per failed test: the pre-authentication calls run on a client object built without a credential (SEC35-38). **Erratum PE-128-54** | D80(11) |
| CT-6 | **TLS.** An `https:` service address is used as announced; a camera's self-signed certificate cannot be validated, so the certificate is not checked and **the test's result is not evidence of the device's identity**. The password still never travels in clear (CT-1 digest-only rule) | honesty about what the test proves; hardening (certificate pinning at adoption) is class C |
| CT-7 | **Errors are mapped, never passed on.** The package's error objects and the device's fault text are reduced to the outcome and a reason code from a closed list; the original object is not logged, not returned and not audited (it can contain the request envelope) | SEC35-04; E-31 |

**Ruled (D82):** no hand-written RTSP client; `rtsp-describe.ts` is not created. **Erratum PE-128-53.**

#### A.6.3 Credential handling in memory, and what the recording process later receives (PE-123-07; D76, D80(7); SEC35-04; C-N8, C-N15)

| # | Rule | Detail |
|--:|---|---|
| CR-1 | Lifetime | The credential exists from the arrival of the connection-test request to the return of `testConnection` — one call. It is a parameter, never a field of the candidate, of the operator session, of the adapter or of the registry; nothing caches it for a retry |
| CR-2 | Form | `CameraCredential { username: string; secret: string }` — the package needs a string. **Erratum PE-128-55** |
| CR-3 | Zeroing | No zeroing is claimed. The credential is request-scoped on the Core: one request, never serialised, never persisted, never logged, not reachable from any object that outlives the request. It cannot be erased from memory; it stays until the garbage collector frees it. The Core is not started with heap-snapshot or diagnostic-report options in any documented command. **Erratum PE-128-55 (D86 SEC35-34, SEC35-31)** |
| CR-4 | Never in | a log line, an audit detail, an error text, a thrown object that leaves the adapter, a URL, an argument list, an environment variable, a file, the candidate list, a WebSocket frame, a response body. The request body field is excluded from request logging by the route's schema (row 121) and is in both blanking lists (§G G-R4) |
| CR-5 | On the wire | Only as a digest toward the device service (WS-Security `PasswordDigest` or HTTP Digest): not readable in transit, but the receiving device can test guesses against it, and the account name travels in clear (accepted on the development network, D87(2)). **Erratum PE-128-55** |
| CR-6 | Persistence | Not by the test. A credential is stored by operation 96 at adoption (the operation-89 write path) and replaced later by operation 89; available after row 84. No second store, no interim file. **Erratum PE-128-52 (D81)** |
| CR-7 | Tests and agents | Fixture credentials exist only in the stub's test set-up; an agent never types, stores or receives a real camera credential (D76 (4)). A check that needs a real connection stops and hands over to the user |

**What the recording process receives (consistent with SEC35-04 and row 65).** The rule of the table
at the top of §A.6 stands: `pullUrl` returns `rtsp://host:port/path` without a credential, and the
credential joins it only at the point where the process that opens the RTSP session is started.
Stated precisely for the protocol as built:

- The credential travels as **separate fields beside the URL** in the start message on that
  process's standard input (the channel the plan already uses, §A.2 W-6 "the plan from `START`, not
  argv"); never in the argument list, never in the environment, never as `rtsp://user:pass@host`
  in any string that is stored or logged. The process builds the authentication in memory.
- **As built, no such process exists for a real camera**: the plan knows one camera input, a
  loopback **listen** address (`packages/capture-protocol/src/index.ts:264-265`,
  `LOOPBACK_RTSP_URL` `:245`), and the worker never dials out. Recording a real camera needs either
  a pull input kind in the plan (a protocol and worker change) or a pull relay in front of the
  unchanged worker that takes its credential on standard input — the FFmpeg command-line program
  cannot be that relay, because it takes the URL in its argument list. **This choice is class C-2
  and is not made here**; it is recorded as a blueprint gap (no row builds it; H-9 already says a
  real pull was never exercised). Nothing in R-9..R-11 needs it: the connect flow ends at
  "assignable", and the development path has no credential.

#### A.6.4 Adapter kind `LOCAL_DEVICE` — the camera helper, and the fake camera of slot 2 (PE-123-08; D73, D74, D80(11); R-11)

**The worker is the RTSP listener; a source is an RTSP client that pushes.** This is how row 58
built it and how every fixture feeds it (`apps/capture-worker/src/ingest.c:281`, listen ingest;
`implementation/20_m3_worker_engine.md` §0 "RTSP push over TCP"; the plan's `ingestUrl` is "where
the worker listens for this camera's RTSP push"). So a local-device source needs **no RTSP server**:
neither FFmpeg's listen mode nor MediaMTX. No MediaMTX binary exists on this machine (probe P-5:
0 files, not on the `PATH`; `research/06_spike_s1_fmp4_running_hash.md` does not mention it — the
S1 spike used FFmpeg listen/push). The helper **binds no port**: it makes one outbound TCP connection
to `127.0.0.1:<port of the plan>`.

| Alternative | Verdict | Why |
|---|---|---|
| Helper serves RTSP (`-rtsp_flags listen`) and the worker pulls | rejected | the worker would need a pull input: a worker change (against D73, R-11 AC-4) |
| MediaMTX between helper and worker | rejected | not installed, a second listener, and the worker would still have to pull |
| The worker opens avfoundation itself | rejected by D73 | "worker unchanged" |
| A small C program linking libavdevice / libavcodec / libavformat (sibling of the row-111 `fake_cam.c`) | **fallback** (see H-15, H-17) | exact control of the wall clock of the first frame (`fake_cam.c:65`, `start_time_realtime`) and an exact permission state; but it is hand-built where a ready program exists |
| **The FFmpeg 9.0.2 command-line program as the helper, with a fixed argument table** | **chosen first** | ready-made, already on this Mac with `h264_videotoolbox`, `libx264` and the avfoundation input (probes P-2, P-3); the same program serves all four development sources |

**Camera helper — exact pipeline shape** (one process; `<S>` is the Core's wall clock at the moment
it starts the helper, written twice; `<url>` is the camera's `ingestUrl` from the plan):

```text
<DEMS_CAPTURE_HELPER_FFMPEG> -hide_banner -nostdin -nostats -loglevel warning
  -f avfoundation -use_wallclock_as_timestamps 1 -framerate 30 -video_size 1280x720 -pixel_format nv12
  -i "MacBook Air Camera:none"
  -an -c:v h264_videotoolbox -realtime 1 -profile:v main -bf 0 -g 30 -b:v 4M -flags +global_header
  -copyts -output_ts_offset -<S in seconds, 3 decimals> -start_time_realtime <S in microseconds>
  -f rtsp -rtsp_transport tcp <url>
```

| Element | Value | Reason | Verified? |
|---|---|---|---|
| Device selection | by **exact name** `MacBook Air Camera`, audio `none`; never by index | the list also holds `MacBook Air Desk View Camera` and two `Capture screen` entries (P-1); Desk View is excluded by D74 (2), a screen grab would record the developer's screen | names measured (P-1); that the demuxer's name match cannot pick another entry is checked by row 134 on the list before every open |
| Frame size and rate | 1280x720 at 30 frames per second | a mode a built-in camera normally offers; keeps the development file near 2 GB per hour at 4 Mbit/s | **HYPOTHESIS H-16** — the supported modes are only shown by opening the device, which this row may not do |
| Encoder | `h264_videotoolbox`, `-realtime 1`, no B-frames (`-bf 0`), profile main | hardware encoder present (P-2); B-frames would reorder and delay; the worker stream-copies H.264 | options exist (P-4); behaviour is H-15 |
| Fallback encoder | `-c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -g 30 -bf 0` | the shape `apps/capture-worker/test/m3worker.py:777` already feeds the worker with | measured by row 58 for that shape |
| **GOP** | `-g 30` = one keyframe per second | the worker's observed-keyframe-interval rule is <= 2 s (Q-GOP default; a fragment is one camera GOP, §C.1); 1 s halves the crash-loss window and leaves margin | that VideoToolbox never exceeds the requested interval is **H-15** |
| Parameter sets in the SDP | `-flags +global_header` | the worker fails loudly without extradata (`ingest.c:304`, `INGEST_NO_EXTRADATA`; S1 SP-6) | to be confirmed by row 134 (first check of the row) |
| Transport | RTSP push, `-rtsp_transport tcp`, to the loopback listen address | the worker refuses anything but TCP (D58-16) and owns the listener | row 58 |
| **Wall clock / sender reports** | `-use_wallclock_as_timestamps 1` stamps each frame with the host wall clock when it is read; `-copyts` keeps those stamps; `-output_ts_offset -S` and `-start_time_realtime S` make "timestamp 0" mean the instant `S`, so the RTCP sender reports of FFmpeg's RTSP output (sent unless `skip_rtcp` is set, P-4) pair each frame's RTP time with the wall-clock time it was read. The worker anchors video on exactly that (`ingest.c:335-340`, PRFT side data from the sender report; no report = the packet is not placed, `no_camera_wall_clock`) | without the three options the report would pair timestamp 0 with the moment the output was opened, and every frame would be placed late by the device and encoder start-up time — a constant audio/video error of unknown size | the three options exist in FFmpeg 9.0.2 (P-4); **that they combine as described is HYPOTHESIS H-17**, measurable without the camera (a generated picture through the same options into the row-60 harness) before the camera is ever opened |
| Residual offset | each frame is stamped when the host reads it, not when the sensor exposed it | a constant delay of about one frame period plus delivery remains on the video side; the microphone path has its own delay; R-11 AC-10 bounds the sum at +-40 ms | **H-17**; development results close no class-C item (D80(11)) |

**Fake camera of slot 2 (`FAKE`, D74 (2)).** The same program, the same last three lines, input
`-re -f lavfi -use_wallclock_as_timestamps 1 -i testsrc2=size=1280x720:rate=30` and
`-c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -g 30 -bf 0`. One program and one
argument table for both camera slots; the row-60 fixture programs stay test fixtures and are not
shipped as product sources.

**Lifecycle and rules.**

| # | Rule | Detail |
|--:|---|---|
| HL-1 | Owner | The adapter (`adapters/local-device/`) owns its helper: `openSource()` starts it, the returned `SourceHandle.close()` stops it. The session wiring of row 71 calls `openSource` for each camera of the plan after `app.capture.start` and closes every handle when the session ends, faults or the Core shuts down |
| HL-2 | Process door | Helpers are started through the **existing** process door `apps/core-server/src/capture/ipc.ts` (`spawn` with `shell: false`, `detached: false`, an explicit environment — `ipc.ts:56-62`), which gains one variant with standard error captured. No second file imports `node:child_process`; the allowlist of G-R2 does not grow (§G.1 G-R12). The helper program path is resolved; its owner must be root or the Core's user and no directory on the way may be group- or other-writable (**erratum PE-128-63**, D86 SEC35-43) |
| HL-3 | Arguments | A fixed table per source kind in one file; the only variable values are the port inside the plan's `ingestUrl` (already validated loopback, 8554-8564), the number `S`, and for microphones the FIFO path under the data directory. No value typed by an operator, read from the database or taken from the network reaches an argument |
| HL-4 | Environment | Empty except what the program needs to start (`PATH` is not needed: the program is an absolute path). Nothing of the server's environment is inherited (same rule as the worker, `implementation/20_m3_worker_engine.md` §5.2) |
| HL-5 | Start order | A camera helper is started when the worker reports that camera's ingest `WAITING` (the listener is up). A connection refused before that is one bounded retry (2 attempts, 500 ms apart), then the named error |
| HL-6 | Ports | None bound by a helper. The worker's listen ports come from the plan (row 66), inside `127.0.0.1:8554-8564` next to the fixtures; in development mode the plan uses two of them and the test fixtures must not run at the same time on the same ports (port collision is an existing failure mode, §A.8) |
| HL-7 | Standard error | Captured by code into a bounded buffer (64 KiB), parsed for the failure class, **never logged raw** (the SEC35-04 rule for FFmpeg output); the log gets the error name only |
| HL-8 | Stop | Normal: close the helper's standard input is not available (`-nostdin`), so `SIGTERM` (FFmpeg ends the RTSP session with `TEARDOWN`, which the worker treats as the end of that camera — S1 G-1), then `SIGKILL` after 3 s. A helper never outlives its session: the handle is closed on every exit path and the Core's shutdown hook closes all handles; a leftover check (`pgrep` of the helper program started by this Core) joins the row-60 harness. **Erratum PE-128-63 (D86 SEC35-43):** at boot in development mode the Core looks for helper processes of an earlier run by the exact program path and refuses to start capture until none is left; it kills nothing it did not start |
| HL-9 | Health | The helper has no telemetry channel of its own. Health = the worker's ingest state and fragment counters for that camera (existing telemetry) + the helper's exit. A helper that exits during a session = that camera is lost: the existing capture warning / `CAMERA_LOSS` path, no automatic restart inside the session (one session per worker process, S1 G-1) |
| HL-10 | **Named errors** (R-11 AC-5) | `DEVICE_NOT_FOUND` — the exact name is not in the device list, decided **before** any open from `-list_devices` output (enumeration opens no device; P-1): the device list is read before every open and the helper is started only when exactly one listed entry equals the name (string equality); no argument table contains a screen-capture name or option (**erratum PE-128-63**, D86 SEC35-43). `PERMISSION_DENIED` and `DEVICE_BUSY` — the open failed and the captured output matches a pinned pattern for that cause. `OPEN_FAILED` — the open failed and no pattern matches (added by this row: an unknown failure is never guessed into one of the three). `HELPER_EXITED` — it started and ended early. The patterns are **H-18**: this row may not open or be refused by the device, so the exact text is recorded by row 134 if and when the user chooses to deny |
| HL-11 | **Never a silent fake** (D80(11)) | Each named error makes the adapter report the source unreachable; the pre-check shows R-10 situation B, a session start with only the fake camera connected is the degraded session of §A.6.5 with its warning naming the local device's id. No code path replaces `LOCAL_DEVICE` by `FAKE`; static rule G-R14 |
| HL-12 | Pre-check | The pre-check of a `LOCAL_DEVICE` camera is the same program with `-t 0.2 ... -f null -` (one short open, bounded at 5 s). It is the first open after boot, so **it is where macOS asks for permission**; the question is answered by the user (D74 (3); DP-12). The permission belongs to the application that started the Core (terminal or development environment), not to the helper — **H-19**. An agent that finds the permission missing stops and hands the user a one-click command; it never touches the permission database or system settings |
| HL-13 | Sandbox note for the implementation rows | Inside the agents' command sandbox the device list is **empty** (P-1: 0 video and 0 audio devices listed; outside it, 4 and 1). A helper started from a sandboxed command therefore reports `DEVICE_NOT_FOUND` although the device exists; rows 134, 135 and 140 must run their device checks outside the sandbox, through the permission gate |
| HL-14 | Privacy | Local-device recordings are the developer's face and voice: only under git-ignored `/.data/` (`.gitignore:70`), no still, no audio excerpt, no waveform or spectrogram, no transcript text and no playback screenshot from a local-device session in `docs/`; no agent opens such media with a viewing tool — checks are numeric and local (D86 C-7); test recordings of rows 134, 135 and 140 are at most 10 s; they are deleted only on the user's instruction (D87(5)); while a `LOCAL_DEVICE` source is open the Core reports it (`sourceOpen`) for the "is on" indicator of the clients (SEC35-44 (4)); D80(11); R-11 AC-8. **Erratum PE-128-64** |

#### A.6.5 Session start with no camera — D72(k) joined to R-10 (PE-123-09; D72(g), D72(h), D72(i), D72(k), D80(6), D80(8))

**The rule.** The ingest-open window is the worker's listen timeout (`--listen-timeout-s`, default
15 s, `apps/capture-worker/src/capture_worker.c:40`; a camera still opening 10 s after it is given
up individually, `:378`). Within it:

| Cameras connected when the window closes | Session | Evidence files | Operator sees |
|---|---|---|---|
| 0 of 2 (or 0 of 1) | **FAULTED** — nothing claims to record, no audio-only session | 0 | R-10 situation C: one CRITICAL alert "no camera connected, nothing was recorded" + "Search again" |
| 1 of 2 | valid **degraded** session, recording | 1 camera file with the audio track | one WARNING naming the missing camera's device ID |
| 2 of 2 | normal | 2 | nothing |

**Who raises what.** Wire subjects are device IDs (`CAM-01`, `CAM-02`; D72(g)).

| # | Component | What it does | Evidence that it exists / owner |
|--:|---|---|---|
| 1 | Capture worker (unchanged) | 0 cameras: fatal `NO_CAMERA_CONNECTED`, exit code 70, no file. 1 camera: reports the other camera's ingest as ended with a `CAPTURE_FAULT` warning whose subject is that device ID (`apps/capture-worker/src/ingest.c:88-94`), and records | built: `implementation/20_m3_worker_engine.md` FR-1 row "D72(k) no camera" |
| 2 | Supervisor (unchanged) | treats `NO_CAMERA_CONNECTED` as a final crash code: no restart, phase `FAULTED`, exactly one `CAPTURE_FAULT` event | built: `packages/capture-protocol/src/index.ts:142` (`FINAL_CRASH_CODES`) |
| 3 | Forwarder -> engine | turns the event into the INTERNAL action that faults the session; in mode `real` a missing feed reads NO SIGNAL and no generated meter replaces telemetry (D72(i)) | built for the fault path; row 71 wires session start/stop |
| 4 | **Session-start notifier (new, row 139)** | on the fault with reason `NO_CAMERA_CONNECTED`: raises exactly **one** CRITICAL alert and writes exactly **one** audit row stating that nothing was recorded; on a degraded start: exactly one WARNING naming the missing device ID and its audit row. Names, severities and detail keys are row 121's (proposal of row 120: `CAPTURE_FAULT` with reason `NO_CAMERA_CONNECTED`) | row 139; depends on rows 71, 133 |
| 5 | Adapters | do **not** raise alerts. An adapter returns results and named errors (§A.6.4 HL-10); the layer above decides | this delta |
| 6 | Search API (rows 132, 133) | situation A (a search found nothing: one audit row with count 0 + one alert, D80(8)) and situation B (a configured device unreachable at pre-check: one alert per device per occurrence) | rows 132, 133 |
| 7 | Clients | draw the alert from Core state; never raise a copy (R-10 AC-6) | rows 137, 138 |
| 8 | Clearing | by the capture side when a camera connects in a later session; never by demo operation 74; a later occurrence is a new alert with its own audit row (D72(h)) | row 139 |

**One thing the implementation rows must not get wrong.** Today `RECORDING` means "the worker
accepted the plan": with no camera that phase lasts until the window closes — 15 s by default —
before `FAULTED` (`20_m3_worker_engine.md`, "Limits stated"). R-10 AC-3 forbids a running timer or a
recording indicator for a session in which nothing is recorded. So between the accepted plan and the
first durable fragment of any camera (the `RECORD` frame that makes the session durable, D58-1) the
session machine must present **"connecting cameras"**, not "recording". Owner: row 71 (session
wiring) with the UX of row 125. This delta changes no worker frame and no protocol field for it. **Erratum PE-128-59 (D84; ruling R-1 option A, D91):** the ingest-open window is a named setting passed by the launcher (row 71; default 15 s). `FAULTED` with `durable: false` (`NO_CAMERA_CONNECTED` included) is a failed start with no evidence item; `FAULTED` with `durable: true` goes to the interrupted seal; a session presents 'recording' only from the first `FIRST_DURABLE_FRAGMENT` (D84). The stored session state stays `RECORDING`; the session payload carries the boolean `captureDurable`, `false` until that fragment.

**Local-device consequence.** In `REAL_DEVELOPMENT` the camera helper must be pushing before the
window closes. A first-ever open waits for the user's answer to the macOS prompt, which can take
longer than 15 s; hence HL-12: the permission is settled at pre-check, not at session start. If the
helper fails at session start, slot 2 (fake) still connects: the session is the degraded case above
with the warning naming the local device's id — visible, never silent (HL-11).

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

#### A.7.1 Delta 2026-10-09 (row 123) — the local microphone helper and the fake microphone of slot 2 (PE-123-10; D73, D74, D75, D76, D80(5), D80(11); R-11, R-10 AC-2)

**Where the audio adapter lives and what it hands over.** As for cameras (§A.1.1), the adapter is
Core-process code under `apps/core-server/src/capture/adapters/audio/`. `open(inputId)` returns an
`AudioStreamHandle` that names a **transport the worker already reads**. One transport exists: the
row-58 kind `PCM_FIFO` — a named pipe carrying raw PCM, 32-bit float, little-endian, at the plan's
sample rate and channel count (48,000 Hz, mono), written by another process
(`packages/capture-protocol/src/index.ts:165-172`; decision D58-6, accepted for the fixture
transport, D72(e)). Blueprint row 65 lets the adapter layer replace that transport for real
devices (class C-4); **for the development sources this delta keeps it**, because it is the only
transport the unchanged worker has. D75 and D76 speak of cameras: no microphone is searched for,
probed or connected over the network in this phase (D80(5)), and the agent rule of D76 (4) applies
to the local microphone as the permission rule of D74 (3).

```ts
interface AudioStreamHandle {                       // delta: made concrete for DEVELOPMENT kinds
  readonly deviceId: string;                        // the device id of the microphone row — the wire subject (D72(g))
  readonly input: { kind: 'PCM_FIFO'; path: string };   // goes into the plan unchanged
  close(): Promise<void>;                           // stops the helper, removes the pipe
}
```

**Mic helper — exact pipeline shape** (one process per microphone; `<fifo>` is created by the
adapter, see ML-2):

```text
<DEMS_CAPTURE_HELPER_FFMPEG> -hide_banner -nostdin -nostats -loglevel warning
  -f avfoundation -i "none:MacBook Air Microphone"
  -vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <fifo>
```

**Fake microphone of slot 2 (`FAKE`):** the same program with the input
`-re -f lavfi -i sine=frequency=880:sample_rate=48000` and the same output line (880 Hz, the
standby tone of the row-58 fixture, audibly different from a voice).

**Erratum PE-WH-10 (decisions D198 (ruling on gate 81 condition C1), D201, D209; wave H driver E, `implementation/125_fix_wave_h_e.md`; closing pass Z1, `implementation/128_fix_wave_h_z1.md` item 8; request lines 10:04:00Z and 10:58:00Z of `delegation_progress/file_requests.md`):** what a
generated microphone plays. The development setting `DEMS_CAPTURE_DEV_FAKE_MIC` = `tone` (the
default) or `speech` is read once at boot by the capture fence. With `speech` the FIRST generated
microphone (`MIC-01` of the seed) plays the speech fixture
`<data directory>/dev-fixtures/speech-mic/dialogue.wav` through the SAME helper program and the
same output line as the tone; every other generated microphone keeps its tone (so a switch to the
standby is audible in a transcript as an end of speech). The path is not a setting: it is built
from the data directory and two literals. The fixture is SYNTHETIC speech made on this machine by
`npm run capture:dev-setup` (git-ignored, with its reference text `dialogue.reference.json` beside
it; no network, no recording of a person, no device). It is held to its FORMAT at the set-up and
at boot: RIFF / WAVE, integer PCM, mono, 16 bit, 48 kHz, with audio in it. Refusals, each stops
the start: `DEV_FAKE_MIC_NEEDS_DEV_SOURCES` (`speech` outside `REAL_DEVELOPMENT`: a production or
a simulated configuration never carries a development setting); `DEV_SPEECH_FIXTURE_UNUSABLE`
with its reason - the path rule of the helper program (SEC35-43 (a)) or the format: `NOT_WAV`,
`WAV_NOT_PCM`, `WAV_NOT_MONO`, `WAV_NOT_48KHZ`, `WAV_NOT_16BIT`, `WAV_NO_AUDIO`, `UNREADABLE`;
`CAPTURE_DEV_FAKE_MIC_INVALID` (a value other than `tone` / `speech`). A refused answer plays the
tone, never the fixture. Sources: `apps/core-server/src/capture/fence/fake-mic.ts:9-33`, `:50-73`,
`:114-161`; `apps/core-server/src/config.ts:59`, `:287`; `scripts/capture/dev-setup.mjs:6-7`;
`scripts/capture/speech-fixture.mjs:17-19`, `:32-34`. `scripts/lane/lane.sh start 2 --speech-mic`
sets the key for the development-capture lane (`scripts/lane/lane.sh:11-13`, `:128`). Not changed
by this erratum: the row "Mic 1 (primary)" of §A.1.2 above (the attended configuration with the
local microphone).

| # | Rule | Detail |
|--:|---|---|
| ML-1 | Device selection | by exact name `MacBook Air Microphone`, video `none` (the only audio device listed on this Mac, probe P-1); never by index; the device list is read before every open and the helper is started only when exactly one listed entry equals the name (string equality); no argument table contains a screen-capture name or option (**erratum PE-128-63**, D86 SEC35-43) |
| ML-2 | The pipe | Node has no call that creates a named pipe. The adapter creates it with `/usr/bin/mkfifo -m 600 <path>` through the same process door as the helpers (HL-2), at `<dataDir>/run/capture/<sessionId>/<deviceId>.pcm` — under git-ignored `/.data/`, mode 0600, removed when the handle closes; both ids are checked against their strict patterns before the pipe path is built and the resolved path must stay under the run directory (**erratum PE-128-63**, D86 SEC35-43); a leftover path from a crashed run is removed only if it is a pipe owned by the server's user, otherwise the open fails with a named error. The worker refuses a path that is not a pipe (`MIC_INPUT_NOT_FIFO`, `packages/capture-protocol/src/index.ts:137`) |
| ML-3 | Format | 48 kHz mono float in the pipe; the worker resamples each microphone onto the host clock by itself (D58-14: +-5,000 ppm, D72(j) F-4), so the helper does no clock correction |
| ML-4 | Timing | The worker places a microphone by **arrival** (D58-6: T0 from the first 300 ms of chunks, 40 ms latency). The helper therefore must not buffer: `-flush_packets 1`, no filter that collects samples. The size of the chunks the device hands over is not known — **H-20** |
| ML-5 | Lifecycle, door, arguments, environment, standard error, stop, named errors, never a silent fake, sandbox note, privacy | exactly HL-1..HL-4, HL-7, HL-8, HL-10, HL-11, HL-13, HL-14 of §A.6.4, with "microphone" for "camera". Start order: the helper is started when the worker has accepted the plan; opening the pipe for writing waits until the worker has it open for reading |
| ML-6 | Health | the worker's telemetry for that device ID: a microphone that delivers nothing reads `dbfs: null` = NO SIGNAL (D72(i), D72(j)); the `MIC_SILENT` warning stays NM-10's and is never an automatic switch (OD-11) |
| ML-7 | A local microphone that cannot be opened | named error -> the source is unreachable -> pre-check: R-10 situation B naming the local device's id; D80(6): both microphones unreachable blocks the start, the standby alone unreachable warns. The fake microphone is **not** promoted to primary by the Core; the operator may switch by hand (the ordinary audited switch) |
| ML-8 | "Search again" for a microphone (D80(5)) | re-runs `enumerate()`. For `LOCAL_DEVICE`, `enumerate()` is the device-list call of HL-10 (it opens no device and asks for no permission); there is no network microphone discovery in this phase |

Alternatives for the microphone path: a new worker input kind for avfoundation (rejected: worker
change, D73); a loopback RTSP audio source (rejected: the worker takes audio from microphone inputs,
not from the camera ingests — it would be a worker change too); a small native capture program
(fallback, same reasoning as §A.6.4, if H-20 fails).

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

#### A.8.1 Delta 2026-10-09 (row 123) — what the fake ONVIF stub must be able to do (PE-123-11; D74 (1), D76, D80)

The stub is the only "network" the automated suite ever searches or connects to (R-9 AC-14). Rows
131 and 142 need these behaviours from it; all listeners on `127.0.0.1` (TCP ports inside
8554-8564; its UDP responder on a loopback port of the same range — UDP and TCP port numbers do not
collide):

| # | Behaviour | Used by |
|--:|---|---|
| ST-1 | Answers a **unicast** Probe on loopback with N configurable `ProbeMatches` (N = 0 for the empty case): endpoint reference, `Types`, the three mandatory scope categories, `XAddrs` | DS-13, DS-15; R-9 AC-2; R-10 AC-1 |
| ST-2 | Hostile and odd answers, one switch each: wrong `RelatesTo`; an answer nobody asked for; `XAddrs` naming another host; no `XAddrs`; two `ProbeMatch` children in one message; an empty `ProbeMatches`; a 60 KiB body; an entity-expansion body; bytes that are not XML; 300 answers | DS-8, DS-9, O-8, H-14 |
| ST-3 | A device service over HTTP with one fixture account: `GetSystemDateAndTime`, `GetServices`, `GetProfiles`, `GetStreamUri`; modes: wrong credential -> 401; no profile; H.265-only profile; a stream address on another host; Basic-only authentication; no answer (timeout) | §A.6.2 outcomes, CT-1..CT-4 |
| ST-4 | **removed (D82)** — the stub has no RTSP responder; any RTSP connection from the Core is recorded as a violation by ST-5 (**erratum PE-128-56**) | — |
| ST-5 | A **request log** (method, operation name, whether an authentication header was present — never its value) that tests read to assert "0 authenticated, 0 configuration requests" after a search and "only the CT-1 list" after a test; any operation outside the CT-1 list is answered with a fault **and** recorded as a violation | R-9 AC-3, AC-6, AC-7 |

The stub's fixture credential exists only in test set-up code; it is not a default of the product
(C-N15). Owner: row 60 builds the stub; rows 131 / 142 extend it where the list above goes beyond
what row 60 delivered.

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

**Erratum PE-R63-13 (2026-10-10; fix pass F-M3, code review row 63 finding R63-13; decisions D126, D130, D179).**
The paragraph above describes a keyframe from BEFORE T0. The case measured in D130 ("1 without
timestamp + 29 before start") is another cause and is stated here: the camera's first keyframe
arrived AFTER T0 but before the camera's first RTCP sender report, so the receiver handed it over
WITHOUT a timestamp; it cannot be placed, and every frame up to the next keyframe cannot start a
file. That is delivered post-T0 video that is not recorded, and it also grows with the camera's GOP
(up to 10 s with the AU2-08 camera). It is reported, not hidden: `FIRST_VIDEO_SAMPLE.skipped` counts
the packets by reason, and `skippedSpanMs` is the span from the FIRST skipped packet to the first
written sample - camera time from the first skipped packet that had a timestamp, PLUS the
untimestamped lead before it, taken from the host's clock (arrival of the first such packet to the
arrival of the first packet with a timestamp) and never less than the count of those packets times
the stream's nominal frame period. Until this fix only the first part was counted, so a camera
whose first sender report came late stated a short span for a long hole
(`apps/capture-worker/src/anchor.c` `skipped_span_ms`; unit check `anchor_test.c` (4)).

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

**Erratum CAP-M7-01 (rulings D147, D148, D178; review row 88, finding R88-04; fix pass F-M7) —
§D.1 to §D.3 describe the SEALED camera file, not the recording.** Where §D.1 says the camera file
at rest is GCM ciphertext "written by the writer", and §D.3 that `recording_fragments.sha256` is the
stored-bytes digest, read:

- **§D.1** The worker writes the recording in PLAINTEXT (`SESSION-<sessionId>/VIDEO-0n.mp4`, 0600,
  in a 0700 folder). The Core encrypts at SEAL time: `CLOSE_TRACKS` writes the sealed file
  `fragments/VIDEO-0n.mp4`, one AES-256-GCM message per fragment at the same offsets. The plaintext
  recording is removed after the item is committed. Until then - and for as long as a seal has not
  succeeded - the recording is plaintext on the media store root.
- **§D.2** The session key `KID-<sessionId>` is created at the first sealed fragment of the session
  (at seal time, not at session start). The IV is 96 random bits per message: uniqueness under a
  key is probabilistic ("provably never reused" does not hold); nothing counts the messages of a
  key across process restarts. Key destruction is not built (class C).
- **§D.3** The two recorded hashes: at RECORDING time the rows of `recording_fragments` hold the
  digest and the chain of the PLAINTEXT bytes (D148); the stored-bytes digest, chain and prefix of
  the manifest are made at seal time over the sealed bytes, and the row's digest becomes the
  fragment's `sha256Plain`.
- **§H (media root)** The media store root (and its `.quarantine` folder, where recordings the Core
  could not seal are moved, D178) must be owner-only: a real-mode boot refuses any permission bit
  for group or others (`CAPTURE_EVIDENCE_STORE_UNUSABLE` / `READABLE_BY_OTHERS`). The transcriber
  data directory (`<data directory>/transcriber`, the PCM tap of a session) is plaintext audio
  under the same rule (owner of that check: the transcription unit; request filed by F-M7).

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
| Video anchoring and drift (**erratum PE-111-01**, D66) | Row 58 anchors **each video packet on its PRFT wall clock** (`AV_PKT_DATA_PRFT`, which libavformat attaches per packet from the latest RTCP sender report) instead of `start_time_realtime + pts`, with a **slew limit** and a monotonic-dts guard. It is identical to today's anchoring on the present fixtures and follows later reports automatically. **NOT adopted:** "re-anchor on later sender reports" as a drift fix with the present drift case expected to show a slope near 0 — the fixture's sender reports carry **no rate information** (`rtpenc` derives the SR RTP timestamp linearly from the host NTP time; `PRFT − pts` stayed constant within 1 µs over 31 s at ±200 ppm), so that test could never pass. The **arrival-vs-camera trend** (`arrival − PRFT`; fitted +165 / −217 ppm against a true ±200 on a loaded host, residuals up to 7.5 ms) is emitted as **telemetry only**, with a warning before the product bound; nothing is corrected from it. The present ±200 ppm case keeps its present expectation (the injected slope within the 2 ms regression bound: 2.0 ms at 10 s, about 6 ms at 30 s); a fixture whose sender reports express drift is added at row 62 (§A.8). **Long-session drift stays class C (C-9).** ASSUMPTION recorded: PRFT anchoring bounds drift only for a camera whose wall clock is disciplined against the Core (H-7 becomes a correctness dependency). HYPOTHESIS (not measured): with real devices the microphone sample clock is a third oscillator; any correction moves video timestamps only and never resamples the evidentiary audio. **Superseded in part (D72(j), D85; erratum PE-128-60):** every microphone passes through libswresample continuously (rate compensation to the Core clock, within ±5,000 ppm; D58-14). The clause "never resamples the evidentiary audio" no longer holds; video corrections still move video timestamps only | pair-111 §5 (`delegation_progress/pair_111_navigator.md:241-277`); `implementation/59_m3_worker_proofs.md:233-239` |
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

### G.1 Delta 2026-10-09 (row 123) — rules for the adapters, the discovery socket and the helpers (PE-123-12; D73, D74, D75, D76, D80; SEC35-23, SEC35-25; C-N13..C-N15)

**The SEC35-23 exception, stated once.** SEC35-23 pins every capture listener to `127.0.0.1`
(§A.2, §A.4, §A.8). Decision D75 grants one exception — "one UDP socket for the duration of a
search" — which `01_specs.md` C-N13 bounds in seven points. It is **not** a listener: the socket
accepts no connection and serves no request. Everything else in this delta stays inside SEC35-23:
the helpers bind nothing, the worker's listeners are unchanged, and the connection test opens
outbound TCP connections only to a device that answered the operator's own search from its own
address (§A.6.1 DS-9, §A.6.2 CT-3).

Today's guard forbids sockets and processes in the host units and pins `node:child_process` inside
`src/capture/**` to one file (`apps/core-server/src/capture/__tests__/static.test.ts:38`, `:128`,
`:134`); it says nothing about sockets inside `src/capture/**`, because there were none. New rules
(row 131 writes G-R9, G-R13; row 142 writes G-R10, G-R11; row 136 writes G-R12, G-R14, G-R15; row
61 keeps the family count):

| # | Rule | Rationale |
|---|---|---|
| G-R9 | (**erratum PE-128-57**) `node:dgram` is imported by **exactly one** file, `apps/core-server/src/capture/adapters/camera/ws-discovery.ts`, pinned by name like the `node:child_process` entry; in that file: one `createSocket` call site, a `close` on every exit path, no `addMembership` (the Core never joins the group: it only sends to it and receives unicast answers), the destination is the constant `239.255.255.250:3702` or the injected loopback test target. No file under `apps/capture-worker/**` and no helper argument table mentions a datagram transport. The server-wide network guard exempts `dgram` in this file only, pinned by name, with a planted-violation control (SEC35-27) | C-N13; §A.2 W-1; D80(11) |
| G-R10 | no file under `src/capture/**` imports `node:net`; `node:http` / `node:https` are imported only in `adapters/camera/onvif-session.ts` and only for the name `Agent`; no `node:tls`, `node:http2` (D82; SEC35-27; **erratum PE-128-57**) | §A.6.2 CT-2; R-9 AC-3 |
| G-R11 | The package `onvif` is imported by **exactly one** file, `adapters/camera/onvif-session.ts`; the methods it calls on the client object are a **pinned list** — `getSystemDateAndTime`, `getServices`, `getCapabilities`, `getProfiles`, `getStreamUri` — and the test fails on any other member call; `connect` is not called and `autoconnect: false`, `preserveAddress: true` and an explicit `timeout` appear in the one constructor call; `Discovery` of the package is never referenced (§A.6.1a O-8); imported as `onvif/lib/cam` so that `lib/discovery.js` is never loaded; the client object never leaves the file — it exports a facade with the five reads (SEC35-33 (5)) | §A.6.2 CT-1, CT-3, CT-4; D75, D76; class C boundary |
| G-R12 | Helpers and `mkfifo` are started only through the process door `src/capture/ipc.ts`; the G-R2 allowlist and the pin "`node:child_process` is imported by `ipc.ts` only" stay as they are. The helper argument tables live in one file under `adapters/local-device/`; a test asserts that every argument is a literal of the table or one of the three computed values of §A.6.4 HL-3, that no argument contains `0.0.0.0`, `::`, `udp`, `listen`, a user-info `@` or a shell metacharacter, and that every `rtsp://` argument matches `LOOPBACK_RTSP_URL` | SEC35-23, SEC35-25; R-11 AC-4 |
| G-R13 | `CameraAdapter.discover` has exactly the call sites R-9 AC-1 allows (the search operation and the pre-check); no call from a boot path, a timer, a plugin `onReady` hook or a read operation | D74 (1); R-9 AC-1 |
| G-R14 | No credential literal and no vendor-default table anywhere under `src/capture/adapters/**` (no string pair that looks like an account, no map keyed by manufacturer); no file under `adapters/local-device/` imports the `FAKE` adapter and no `catch` path in `adapters/**` constructs one (a local device is never replaced by a fake) | C-N15; R-9 AC-7; D80(11); R-11 AC-5 |
| G-R15 | The development flag (`captureDevSources` / `DEMS_CAPTURE_DEV_SOURCES`) is read in exactly one function, the one that defines the capture operation (§A.1.2); every other file asks that function | D72(l); R-11 AC-1 |
| G-R4 (extended) | The key names `credential`, `secret`, `username`, `password` and the forms `rtsp://user:pass@host` and `http(s)://user:pass@host` are sensitive in every log / audit call of `src/capture/**` and `modules/capture-config/**`; in addition **device-identifying keys** — `address`, `sourceAddress`, `serviceAddress`, `xaddrs`, `endpointRef`, `mac`, `serial`, `scopes` — may not appear in a log call of `adapters/**` (counts only, §A.6.1 DS-12) | SEC35-04; C-N15; R-9 AC-16 |
| G-R6 (extended) | The only writers of files under `adapters/**` are the pipe creation of §A.7.1 ML-2 (through the door) — no candidate, probe answer or helper output is written to a file by product code | OD-25; R-9 AC-16; R-11 AC-8 |

Run-time checks that complete the static ones (named and placed by row 127): a socket snapshot of
the Core process before, during and after a search — 0 / 1 / 0 datagram sockets (C-N13; R-9 AC-15);
a snapshot of each helper — 0 listening sockets, one TCP connection to `127.0.0.1`; `git diff` of
`apps/capture-worker/src` over rows 134-136 and 140 = 0 changed lines (R-11 AC-4).

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
in `masterplan/11_audit_errata.md` §5). Edits 7-10 landed with row 58 (`config.ts:43-44`, `:177-181`, `:263-267`, `:294-312`; **erratum PE-128-61**). **Edits 13 and 14 are new:** the import and the
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
| 7 | `apps/core-server/src/config.ts:38` (planned) | capture config keys | add `ENV_CAPTURE_MODE = 'DEMS_CAPTURE_MODE'`, the worker command path key and the media-dir key next to the existing `ENV_*` (`config.ts:36-38`); E-05 path correction applies to `index.ts`, not here | landed by row 58 (`config.ts:43-44`; `implementation/20_m3_worker_engine.md` §5.1; **erratum PE-128-61**) |
| 8 | `apps/core-server/src/config.ts:162` (planned) | capture config keys | add `captureMode`, `captureWorkerPath`, `mediaStoreDir` to `CoreServerConfig` (`config.ts:147-163`) | landed by row 58 (`config.ts:177-181`; `implementation/20_m3_worker_engine.md` §5.1; **erratum PE-128-61**) |
| 9 | `apps/core-server/src/config.ts:227` (planned) | capture config keys | add the three capture fields to `ConfigInput` (`config.ts:216-228`) and validate/parse them | landed by row 58 (`config.ts:263-267`; `implementation/20_m3_worker_engine.md` §5.1; **erratum PE-128-61**) |
| 10 | `apps/core-server/src/config.ts:268` (planned) | capture config keys | set the three capture fields in the frozen object returned by `createConfig` (`config.ts:237-270`) | landed by row 58 (`config.ts:294-312`; `implementation/20_m3_worker_engine.md` §5.1; **erratum PE-128-61**) |
| 11 | `apps/core-server/src/index.ts:108` | supervisor start | `await app.capture.boot();` after `await app.readiness.boot()` (`index.ts:107`) and before `await app.listen(...)` (`index.ts:109`) | row 57 |
| 12 | `apps/core-server/src/index.ts:83` | supervisor stop | `if (app.seams.has('capture')) await app.capture.shutdown();` inside `shutdown()` before `await app.close()` (`index.ts:84`); the guard covers a signal that arrives before `app.ready()` finished | row 57 |
| 13 | `apps/core-server/src/app.ts:102` | module registration (OD-14 extended by **D68**) | `import { sttConfigModule } from './modules/stt-config';` | row 113 |
| 14 | `apps/core-server/src/app.ts:323` | module registration (OD-14 extended by **D68**) | `['modules/stt-config', sttConfigModule],` in `UNITS` (before `capture`; the plugin opens no connection) | row 113 |

**P25 edit count: 14, all landed** (8 in `app.ts`, 4 in `config.ts`, 2 in `index.ts`; edits 7-10 landed by row 58, **erratum PE-128-61**). Until 2026-10-09 this line read "12 (6 in `app.ts`, 4 in `config.ts`,
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

**Delta 2026-10-09 (row 123; PE-123-13; D73, D72(l)) — planned edits 15-18.** The two
configuration keys of §A.1.2 (`DEMS_CAPTURE_DEV_SOURCES`, `DEMS_CAPTURE_HELPER_FFMPEG`) are
**capture config keys**, the third of OD-14's four categories, and land in `config.ts` in the same
four places as edits 7-10: the `ENV_*` constants (edit 15), the fields of `CoreServerConfig`
(edit 16), `ConfigInput` with parsing and validation (edit 17) and the frozen object of
`createConfig` (edit 18). Owner: row 136, with row 61 reading the flag in the one function. They are
**planned, not landed** (the waiver is recorded when row 136 lands them, D82(e); **erratum PE-128-61**); the line numbers are fixed when they land, and the pin of `config.ts`
(`apps/core-server/src/capture/__tests__/static.test.ts:290`, a digest of the file without the
waived lines, `implementation/20_m3_worker_engine.md` §5.1) is re-computed by the row that lands
them. `app.ts` and `index.ts` get **no** edit from R-9..R-11: the adapters are registered inside the
existing `capture` unit, and the search, connect and notification operations live in the already
registered `modules/capture-config`. **Planned P25 edit count after this delta: 18** (8 `app.ts`,
8 `config.ts`, 2 `index.ts`).

**Erratum PE-R63-14 (2026-10-10; fix pass F-M3, code review row 63 finding R63-14; decision D179) -
the record of the waiver brought up to the code of commit `abf742f`.** The count lines above
("14, all landed", "planned 18") are the state of 2026-10-09 and are superseded by this paragraph.
`git diff 9d3a1ef..abf742f --numstat`: `app.ts` 29 added / 0 removed, `config.ts` 69 / 0,
`index.ts` 2 / 0. Every added line is inside one of OD-14's four categories (module registration,
the `capture` seam, capture config keys, supervisor start / stop); no stage, route, boot order or
existing seam changed (review 16 §2, "P25 edits against OD-14": PASS WITH FINDINGS).

| Edits | File | Category | What | Authority | State |
|---|---|---|---|---|---|
| 1-6 | `app.ts` | module registration, the `capture` seam | the unit `capture`, `modules/capture-config`, the seam in three places, the decorator | OD-14 | landed (row 57) |
| 7-10 | `config.ts` | capture config keys | `DEMS_CAPTURE_MODE`, `DEMS_CAPTURE_WORKER` | OD-14; PE-128-61 | landed (row 58) |
| 11-12 | `index.ts` | supervisor start / stop | `app.capture.boot()` / `shutdown()` | OD-14; PE-57-01 | landed (row 57) |
| 13-14 | `app.ts` | module registration | `modules/stt-config` (import + unit line) | D68; PE-57-08 | landed (row 113) |
| 15-18 | `config.ts` | capture config keys | `DEMS_CAPTURE_DEV_SOURCES`, `DEMS_CAPTURE_HELPER_FFMPEG` in the four places of edits 7-10 | D73, D72(l); PE-123-13 | **landed** (row 136; "planned" above is superseded) |
| 19-22 | `app.ts` | module registration | `modules/capture-discovery` (row 132), `modules/capture-inputs` (row 133): two imports, two unit lines, one header line | D114 | landed |
| 23-24 | `app.ts` | module registration | `modules/evidence-export` (operation 87): import + unit line | D143 (row 91) | landed |
| 25-26 | `app.ts` | module registration | `modules/media-stream` (operation 88, the evidence media route): import + unit line | D140 (row 90) | landed |
| 27-28 | `app.ts` | module registration | `modules/transcripts` (operations 84-86): import + unit line | D146 (integration pass D4) | landed |
| 29-30 | `app.ts` | module registration | `modules/sealing` (operation 83, the mount of the sealing composition): import + unit line | D147 (E) (row 82b) | landed |

**P25 edit count: 30, all landed.** Edits 23-30 are NUMBERED HERE FOR THE FIRST TIME: until this
erratum their authority stood only in comments of the pin test. They have no line in the header of
`app.ts` (a header line would itself be an edit of the frozen file; none is added by this pass).
**THE SINGLE SOURCE OF THE WAIVED LINES** is the list `WAIVED` of
`apps/core-server/src/capture/__tests__/static.test.ts` ("app.ts: every added line is a waived
one") and its counterpart for `config.ts`: with exactly those lines taken out, each frozen file is
byte-equal to the file of plan row W08 (digest pins, with positive controls). A line of any module
that is not in that list fails there; this table is the record of WHY each line is in it, and must
be extended in the same change that extends the list. Row 63's acceptance text "12/12" and the
"14/14" of the self-check table below are the counts of earlier revisions.

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
| H-7a | **(split of H-7 by row 123, PE-123-14; D75, D76, D80(1))** Unauthenticated WS-Discovery finds an ONVIF camera on the segment the Core is attached to and its answer carries enough to draw a candidate row (address, endpoint reference, name and hardware hint) | the protocol side is now cited (§A.6.1 V-1..V-12); what real devices on a real network do is not measured. **Scheduled, no longer class C:** row 131 (fake stub; real-LAN check 2 runs + 1 at row 70) | on the stub: a candidate lacks an announced field, or a hostile answer of §A.8.1 ST-2 is accepted or stops the Core. On the real network: a camera known to be present and discoverable is not listed. **Zero responders on a network with no camera is a valid result and falsifies nothing** (D75) |
| H-7b | **(split of H-7)** Authenticated ONVIF actions work against the target camera: profile listing and stream address with the operator's account, NTP offset read; and the configuration actions NTP set, GOP set, profile change | the read half is exercised on the stub by row 142 only; `GetProfiles` / `GetStreamUri` access classes are in the ONVIF Media specification, which this row did not fetch; no real camera, no account. **Class C-1 / C-2 unchanged** for every action on a real camera — the connection test on a real camera runs only when the user types the credential (D76 (4)) | the user's connection test on a real camera ends in an outcome that contradicts what the camera's own interface shows; a class-C set action is refused |
| H-8 | USB is the correct microphone transport | OD-06 "USB working assumption"; transport fixed when mics are known | C-4 with the real mic shows a different transport |
| H-9 | the four S1 command-shape traps are sufficient for a **pull** camera (S1 used listen/push) | RF-2: pull fixtures need MediaMTX (Q-INSTALL item 4); class C-2 | a real camera pull fails on a trap the synthetic push did not exercise |
| H-10 | camera **video clock** (camera encoder / RTP timestamps, copied) and **host audio clock** (mic captured, selected and encoded on the Core) stay aligned at session start and do not drift beyond the AV tolerance within a session, in **both** camera files (added by AU2-06, D18) | S4 used one pusher and one clock for audio and video, so the two-clock DEMS topology was never measured; H-4 covers only the two-file fan-out | M3 check `M3-AV-2` (fake camera in a separate process with its own clock, injected ±80 ms and a slow drift, host-fed audio through the selector; flash/beep analysed per camera file) fails the regression bound; long-session drift stays class C-9 (pre-handover, D233). **Erratum PE-111-01 / PE-111-05 (D66):** row 111 proved the timestamp path (sample-exact offsets, drift reported, negative controls fail) but two limits remain for `M3-AV-2`: the fake mics must be a **separate process** (§A.8), and the present fixture cannot express a second oscillator through its sender reports, so a slope near 0 may be expected only from the row-62 fixture (§F) |
| H-11 | Older ONVIF devices announce the type `dn:NetworkVideoTransmitter` and not `tds:Device`, so the second probe of §A.6.1 DS-6 finds devices the first does not; and a responder ignores the repeated datagram that carries the same message ID (added by row 123, PE-123-14) | analyst's recall of earlier Core versions and of SOAP-over-UDP; version 26.06 names only `tds:Device` (V-8); the repeat rule was not fetched | on the stub or the real network the second probe never adds a device (then it is dropped), or a device answers each repeat (harmless: de-duplicated by endpoint reference, but counted) |
| H-12 | macOS lets more than one process use the built-in camera at once, so `DEVICE_BUSY` is rare and the short pre-check open (§A.6.4 HL-12) does not disturb another application's use — "single-process camera exclusivity" does **not** hold | not measured: this row may not open the camera | row 134: the helper's open fails, or another application loses its picture, while the camera is in use elsewhere — then `DEVICE_BUSY` is a normal outcome and the pre-check must say so |
| H-13 | A multicast probe sent by the Core process actually leaves this Mac: neither the host firewall nor the operating system's local-network privacy control drops it without an error | not measured; a silent drop is indistinguishable from "no camera on the network" | row 131's real-LAN check sees the probe datagrams leave on the interface (a packet count on the interface, no content) — if none leaves while the send call succeeded, "0 responders" must be reported as **not run**, not as an empty network (§A.6.1 DS-13) |
| H-14 | `xml2js`, configured for §A.6.1, rejects entity-expansion and oversized input in bounded time and never throws outside the parse call | measured on `xml2js` 0.6.0 by row 126 (`sec` §11.1 (b)): entity expansion and prototype pollution are resisted; the risk is our own code in the parse callback. Row 131 repeats the measurement on the pinned version (**erratum PE-128-51**) | the hostile-datagram cases of §A.8.1 ST-2 make the Core slow, grow memory or raise an uncaught exception |
| H-15 | `h264_videotoolbox` honours `-g 30` as an upper bound on the keyframe interval, emits no B-frames with `-bf 0`, and with `-flags +global_header` puts the parameter sets where the worker's ingest finds them | the options exist (probe P-4); their effect on this encoder was not run | row 134: the worker's observed keyframe interval exceeds 2 s, or the ingest ends with `INGEST_NO_EXTRADATA` -> use the `libx264` line of §A.6.4 |
| H-16 | The camera named `MacBook Air Camera` offers 1280x720 at 30 frames per second in a pixel format the encoder takes (`nv12`) | the mode list is only shown by opening the device | row 134: the open is refused with a list of supported modes -> pick the nearest listed mode at or below 1280x720, 25-30 frames per second, and record it |
| H-17 | **avfoundation timestamps and the wall clock.** With `-use_wallclock_as_timestamps 1 -copyts -output_ts_offset -S -start_time_realtime S` the sender reports pair each frame with the host wall-clock time at which it was read, so the worker's PRFT anchoring places local video within the +-40 ms product bound against the local microphone (the remaining delay being about one frame period on the video side) | the three options exist in FFmpeg 9.0.2 (P-4) and `start_time_realtime` is the mechanism the row-111 fake camera uses from code (`fake_cam.c:65`); their combination on the command line, and how the program treats `start_time_realtime` together with `-copyts`, were not run | step 1 (no camera): the same options with a generated picture through the row-60 harness — the worker's `video_anchored` shift is not within a few milliseconds of 0, or `no_camera_wall_clock` appears -> the command-line helper is replaced by the small native helper of §A.6.4 (fallback). Step 2 (camera, user present): a hand clap recorded in a development session shows an audio/video offset outside +-40 ms |
| H-18 | The helper's failure output distinguishes "permission denied" from "device busy" by stable text | never observed: this row may not be refused by the device | row 134 records the real text if the user chooses to deny; if the two cannot be told apart both are reported as `OPEN_FAILED` with the advice to check the permission — never a guess |
| H-19 | The macOS camera / microphone permission is attributed to the application that started the Core (terminal or development environment), not to the helper program; granted once, it holds for later runs from the same application | operating-system behaviour as the analyst recalls it; no agent may read or touch the permission database (D74 (3)) | the prompt names another program, or reappears on every start -> hand-over text of DP-12 is corrected |
| H-20 | The microphone helper delivers PCM to the pipe in chunks of 20 ms or less with no added buffering, so the worker's arrival-based placement (D58-6) and its 40 ms latency hold | device buffer size unknown; `-flush_packets 1` on a raw output not measured | row 135: telemetry shows gaps (`dbfs: null`) or underrun fill for the local microphone, or the clap test of H-17 is outside the bound -> the small native helper |
| H-21 | The `onvif` package, used as §G.1 G-R11 pins it, authenticates with digests only (WS-Security `PasswordDigest`, HTTP Digest) and never sends the password in clear, also when a device asks for Basic | `lib/cam.js` 0.8.3 shows `PasswordDigest` (`:1248`) and a digest handler (`:437`); the absence of a Basic path was not proven by reading the whole file | row 142: the stub's Basic-only mode (§A.8.1 ST-3) receives a request that contains the fixture password or its base64 form |
| H-22 | With the client object built without a credential for the pre-authentication calls and the credential set before `GetProfiles`, a failed test delivers at most 2 rejected credential-bearing requests | read in the source (P-3, P-4), not run | `M4-SEC-CONN-2` counts more than 2 on the stub |
| H-23 | A per-test agent passed to the constructor is the socket source of every request the package makes, so destroying it ends the test at the deadline and its byte counter sees every received byte | P-8 read, not run; HTTPS path not read in full | `M4-SEC-CONN-3`: the drip or the large body outlives the deadline or the cap |
| H-24 | Exceptions raised in the package's own callbacks on a hostile answer are caught by its `try` around the parse call and reach our callback as an error, at most once after our called-once guard | P-12 and §11.1 (b) read and measured separately, not together | `M4-SEC-CONN-3`: an uncaught exception or a second callback |
| H-25 | Cameras lock an account after a small number of rejected logins within minutes, and count rejected requests, not operator actions | no source in this repository; device behaviour differs by maker | the manual of the target camera states another rule -> the constants of SEC35-38 are re-pinned |
| H-26 | The field attributes of SEC35-37 keep a browser from filling the console's saved login into the camera fields; they do not reliably stop an offer to save | reviewer's knowledge of browsers, not measured | `M4-SEC-UI-1` finds a filled field |
| H-27 | Enumerating local inputs (operation 97) while a session records does not disturb the capture | not measured (record 121 §5, the hand-over to row 123 was not answered) | `M4-MIC-RESCAN-1` run against a fake-worker `RECORDING` session (then operation 97 answers `409` during `RECORDING`) |

**Erratum PE-128-62 (D86 sec §11.11; record 121 §5):** H-22..H-26 are carried from `09_security_design_review.md` §11.11; H-27 is new.

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
| Row-123 delta applied (R-9..R-11; PE-123-01..PE-123-15; D72(k), D73-D78, D80) | §0, §A.1.1, §A.1.2, §A.6.0-§A.6.5, §A.7.1, §A.8.1, §G.1, §I (planned edits 15-18), §J — each of §A.1, §A.6, §A.7 and §G carries a delta dated 2026-10-09 citing D73-D76; **§A.2, §A.4 and §B.2 have no changed line** (hunk list in `delegation_progress/data_analyst_row123.md` §4). NM 9/9 unchanged; P25 landed set unchanged, **18 planned** (was 14); hypotheses **22** (H-7 split into H-7a / H-7b; H-11..H-21 added); every protocol statement of §A.6.1 cites the WS-Discovery 1.1 or ONVIF Core 26.06 section it was read in, the rest is labelled hypothesis; forbidden-muxer grep still empty; no install, no port bound, no camera or microphone opened by this row |
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

*Generated: 2026-10-07 · Last Updated: 2026-10-09 14:35 (row-128 spec-gate fix pass PE-128-46..66 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); blueprint row 123: capture architecture delta for R-9..R-11, PE-123-01..PE-123-15, D72(k), D73-D78, D80; earlier the same day: pair-review errata PE-57-01..10 and PE-111-01..07, D65-D68; earlier: 2026-10-08 RV-SPEC audit errata AU2-03..AU2-08, D18; row-35 security remediation SEC35-04/08/09/10/23/25)*
