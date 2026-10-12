---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 7
date: 2026-10-12
agent: data-analyst
type: mixed (requirements + gap analysis)
narrative_tier: 1
confidence: MEDIUM (HIGH for code facts re-opened in this pass; LOW where marked UNPROVEN or HYPOTHESIS)
source_translated_task: /docs/2026-10-12_input_av_core_adapter_plan/identification/01_translated.md
source_structured_task: /docs/2026-10-12_input_av_core_adapter_plan/identification/02_structured.md
last_updated: 2026-10-12 17:34
---

# Gap Analysis: input-av hardware logic against the Core capture target (row 7)

> **Ringkasan (Bahasa Indonesia).** Dokumen ini menilai 38 butir logika perangkat keras input-av (H-01..H-38) dan 63 baris parameter skema input yang "sudah tested" terhadap Core dan capture worker apa adanya. Hasil: 14 butir ADOPT, 6 ALREADY_IN_CORE, 5 NOT_NEEDED, 13 BLOCKED_BY_DECISION. Dari 63 baris parameter: 19 diterima Core hari ini, 42 perlu perubahan, 2 belum terbukti. Lima temuan yang mengubah desain: (1) worker Core hanya MENDENGAR di loopback dan tidak pernah menghubungi kamera, sedangkan input-av MENARIK stream dengan kata sandi di dalam URL; bagian penarik stream belum ada dan cara input-av (kata sandi di argumen FFmpeg) dilarang oleh aturan Core; (2) empat kamera uji melaporkan H264 lewat ONVIF padahal mengirim H.265, jadi uji koneksi Core tidak bisa dipakai sebagai penentu codec; (3) apakah worker membawa HEVC ke fMP4 BELUM TERBUKTI, dan worker menuntut parameter set tersedia saat stream dibuka, yaitu persis kelemahan kamera H.265 yang membuat input-av memilih MPEG-TS; (4) sisi tangkap audio (buka semua kanal, pilih satu input, 24-bit) MASUK ke transport mikrofon Core tanpa mengubah worker, tetapi yang DISIMPAN tetap AAC mono dan hanya mikrofon aktif (Q8); (5) satu sesi produksi butuh 2 kamera dan 2 mikrofon yang semuanya produksi, jadi kamera dan audio harus selesai bersama sebelum bisa diuji di perangkat nyata. Tidak ada kode yang diubah dan tidak ada percobaan yang dijalankan.

## Source Tasks

- Structured: `identification/02_structured.md` (row 7 at line 143, profile line 165, constraints C10-C13 at lines 49-52)
- Translated: `identification/01_translated.md` (goals G1, G4 at lines 26, 29)
- Original: `identification/01_original.md` (nine mismatches at lines 60-70)
- Decisions: `decisions/decisions.md` (U1 line 7, U2 line 8, P3 line 9, P4 line 10, U3 line 13)

## Exploration and Collection Summary

- Explore, input-av: `research/01_explore_input_av.md` (H-01..H-38, TS-1..TS-11, section 6 "Source against P3", section 4.12 "What tested covers")
- Explore, Core: `research/01_explore_core.md` (13 sections, seams S1-S6)
- Collection, rulings: `research/02_collection_rulings.md` (D76, D82, D86 C-5, OD-06, class C entry pack, SPEC05 A.1 / A.6.3 / A.7)
- Not read by this row: `research/02_collection_input_av_records.md`, `research/02_collection_core_records.md` (they belong to row 6).

## 0. Narrative frame (5W1H)

| Question | Answer |
|---|---|
| **What** | A verdict per hardware-logic item of input-av, the Core seam and contract member each adopted item lands on, an acceptance status per parameter of the tested input scheme, and a closure of the nine mismatches of `01_original.md`. |
| **Why** | U1 narrowed the task to porting; U2 made the input-av input scheme the default because it is the tested one. A port that is not checked parameter by parameter against what the Core accepts today would either differ silently from what was tested or collide with a Core guarantee. |
| **Who** | Consumers: row 8 (target design, work packages), row 9 (decision register), row 12 (soundness review), row 13 (security). Decision owner for every open entry: the user. |
| **When** | 2026-10-12, wave 2. The code state is the working tree of that day (uncommitted changes exist; line numbers are of the files as they stood). |
| **Where** | Source: `apps/input-av/nvr/` and `apps/input-av/docs/`. Target: `apps/core-server/src/capture/adapters/`, `apps/core-server/src/capture-session/`, `packages/capture-protocol/`, `packages/shared/`, `apps/capture-worker/src/`. |
| **How** | Method in section 1. No build, test, worker, FFmpeg or input-av run; no source file changed (U3); nothing under `apps/input-av/data/` and no `.env` opened. |

## 1. Method, evidence rule and limits

1. **Inputs.** The three row documents above are the base. P3 and `01_original.md` are not used as evidence for a code fact (blueprint line 54, line 62).
2. **Re-opened lines.** Because row 2 ran on the mechanical tier, the lines that carry a verdict were opened again in this pass (read-only). The list is in section 10. A citation not in that list is taken from row 1 or row 2 and is marked "(row 1)" or "(row 2)" where it carries weight.
3. **Vocabulary.**
   - Item verdicts: `ADOPT`, `ALREADY_IN_CORE`, `NOT_NEEDED`, `BLOCKED_BY_DECISION`.
   - `BLOCKED_BY_DECISION` is used only when the answer of a named open entry decides WHETHER the item is ported at all. An item that is ported under every answer, but whose work cannot be executed before an entry is answered, is `ADOPT` with that entry in the column "Provisional on". Reason: row 8 must give every `ADOPT` item a work package; marking the whole audio side blocked by Q7 would leave row 8 without it.
   - Parameter status (fact about today): `ACCEPTED_TODAY` (the task's "yes"), `NEEDS_CHANGE` (the task's "no", with the refusing or missing line), `UNPROVEN` (the task's "untested").
   - Parameter target (plan, changes if P3 is corrected): `PORT`, `NOT CARRIED`, `HELD (Qn)`.
4. **Hypotheses** are labelled HYPOTHESIS. Each names the experiment that would settle it. None was run.
5. **Paths.** `ADP` = `apps/core-server/src/capture/adapters`; `WRK` = `apps/capture-worker/src`; `PROTO` = `packages/capture-protocol/src/index.ts`; `SHARED` = `packages/shared/src/api/capture.ts`; `IAV` = `apps/input-av`; `T3` = `docs/2026-10-07_dems_real_capture_sealing`.
6. **Graft.** `graft/` exists in the repository. It was not queried: every doubt of this row was a named line in a named file, which a direct read settles at lower cost than a graph query. The blast radius of the opener rule is taken from row 2 section 3 (a complete grep of the identifier).

## 2. Overview

The Core and input-av solve the same problem with opposite plumbing. input-av starts one FFmpeg command per source that dials the device and writes an evidence file. The Core has one worker per session that listens on loopback for a pushed RTSP stream and reads microphones from named pipes; adapters in the Core process start whatever feeds those two doors. Porting therefore does not mean moving FFmpeg argument lists: it means building, behind `CameraAdapter.openSource` and `AudioInputAdapter.open`, the feeding parts that apply the tested input parameters, and proving that the worker accepts what they deliver.

On the camera side the feeding part does not exist and its design is an open class C-2 choice (`T3/masterplan/05_capture_architecture_spec.md:636-644`). On the audio side the tested capture logic fits the existing transport with a helper change only; the stored form does not follow. H.265 through the worker is unproven in both directions: nothing refuses it by name, nothing has run it.

## 3. Requirements this analysis rests on

- **FR-1 (C10, U1).** Hardware input logic is re-implemented inside the Core adapter layer and the capture worker. No bridge, no helper-driven input-av.
- **FR-2 (C11, U2 as read by P3).** Default camera input: ONVIF main stream, RTSP over TCP, stream copy, the codec delivered. Default audio input: USB Audio Class card, ALSA shared capture, all device channels opened then inputs selected, 24-bit / 48 kHz.
- **FR-3 (C12).** The stored form is not fixed by FR-2 (entry Q8).
- **FR-4 (C13).** input-av keeps no recording role.
- **NFR-1 (C6, as carried by the blueprint).** No Core guarantee is weakened: sealed write-only credentials, the opener rule, the single audit chain, sealing.
- **NFR-2 (C8).** Ready-made libraries; a hand-built part is justified.
- **NFR-3 (U3).** No Core code is touched by this task.

## 4. Key findings

### Finding 1: the tested camera scheme is a PULL with the credential in the URL; the Core has no pull part and forbids that credential form [Confidence: HIGH]

- input-av: `-rtsp_transport tcp -timeout 5000000 -i <rtsp url with credentials>` (`IAV/nvr/recorder.py:217`); credentials are percent-encoded into the URI (`IAV/nvr/onvif_client.py:277-285`) and stored in `cameras.rtsp_url` and `cameras.password` (`IAV/nvr/db.py:77,79`).
- Core: the worker opens every camera input with `rtsp_flags=listen` and `protocol_whitelist=tcp` (`WRK/ingest.c:482-484`); the plan accepts only `rtsp://127.0.0.1:<port>/<path>` (`PROTO:508-516`; `WRK/capture_worker.c:110-118`); an opened source "pushes" to that listener (`ADP/types.ts:120-123,139-140`); the production adapter refuses `openSource` (`ADP/camera/onvif-rtsp.ts:31-33`) and `pullUrl` (`:35`).
- Core rule: a stream locator never carries a user part; the credential joins it only in the start message on the standard input of the process that opens the stream, "never an argument list, never an environment variable" (`ADP/credential.ts:117-125`; `T3/masterplan/05_capture_architecture_spec.md:627-635`). `credentialAtInjection` has no caller in the product (row 2 section 8). The spec states that the FFmpeg command-line program cannot be the pull relay because it takes the URL in its argument list (`T3/.../05_capture_architecture_spec.md:636-644`).
- Implication: H-07 is adopted in its parameters (TCP, copy, first video stream, timeout, reconnect rule), not in its mechanism. The mechanism is design fork F-1 (section 8). The FFmpeg command line of input-av cannot be reused for the camera.

### Finding 2: the ONVIF answer is not a reliable codec source; the H.264-only test may pass the bench cameras for the wrong reason [Confidence: HIGH for the code and the bench statement; the combined outcome is a HYPOTHESIS]

- Core: a profile counts as H.264 only when `encoding === 'H264'` (`ADP/camera/onvif-session.ts:222`); with no such profile the outcome is `NOT_H264` (`:491`); `REACHABLE` returns the H.264 tokens only (`:492`); the result type says "usable H.264 profile codes" (`ADP/types.ts:94,104`).
- Bench: all four cameras deliver H.265 "walau ONVIF melaporkan H264" (`IAV/docs/SERAH-TERIMA.md:79-80`, row 1 TS-2). input-av reads the encoding and never branches on it (`IAV/nvr/onvif_client.py:176,248-249`).
- HYPOTHESIS H-A: on the bench cameras the Core's test would answer `REACHABLE` (not `NOT_H264`) if the `onvif` package reads the same ver10 media answer input-av read, and `NOT_H264` if it reads a ver20 answer that names H265. The Core accepts either service (`onvif-session.ts:466`). Experiment E-3 settles it.
- Implication: mismatch 3 of `01_original.md` is narrower and deeper than stated. Narrower: the line 491 refusal may not even fire on the bench. Deeper: D82's rule "codec is judged from the authenticated ONVIF answer" (`T3/decisions/decisions.md:95`) is contradicted by the bench; the codec has to be judged from the stream. The Core already does so for the stored file: "THE FILE SAYS IT, NOT THE PLAN" (`apps/core-server/src/capture/fragments.ts:446-451`).

### Finding 3: HEVC through the worker is UNPROVEN, and the worker's extradata rule meets exactly the weakness that made input-av choose MPEG-TS [Confidence: HIGH that it is unproven; the behaviour itself is a HYPOTHESIS]

- Not refused by name: the video stream is copied with `avcodec_parameters_copy` and `codec_tag = 0` into an `mp4` output context (`WRK/ingest.c:344,361-362`) under `+frag_keyframe+empty_moov+default_base_moof+skip_trailer` (`WRK/ingest.c:47`). No comparison of `codec_id` exists (row 2 section 11).
- Not tested: worker tests assert `("video","h264")` only; no HEVC fixture exists (row 2 section 11). The worker is pinned to one libavformat build whose behaviour "the anchoring below rests on" (`WRK/ingest.c:51-59`).
- A hard requirement that is codec-sensitive: `if (!is->codecpar->extradata_size)` ends the ingest with `INGEST_NO_EXTRADATA` (`WRK/ingest.c:512`). input-av chose MPEG-TS because that container keeps parameter sets in-stream, "so the file is valid for cameras that do not send them at RTSP session start (common with H.265)" (`IAV/nvr/recorder.py:3-6`; `IAV/README.md:200-201`).
- HYPOTHESIS H-B: with a push relay in front (fork F-1, variant A) the worker sees the relay's SDP, not the camera's; whether the parameter sets reach `extradata` then depends on the relay having extracted them from the stream before it announces. HYPOTHESIS H-C: the pinned mp4 muxer writes an `hvc1` or `hev1` sample entry for a copied HEVC stream under these flags. The Core reader maps both names to `HEVC` (`apps/core-server/src/capture/fragments.ts:459`) and reads no frame rate for HEVC ("open item of fix 151", `fragments.ts:541-546`). Experiments E-1, E-2 settle H-B and H-C.
- Implication: "the codec the camera delivers" is `UNPROVEN` at seam S6 and becomes a work package that needs a fixture first and the real cameras second. It must not be planned as "remove line 491".

### Finding 4: the Core requires the camera's wall clock; input-av has no counterpart [Confidence: HIGH]

- The worker places video by the reference time of the latest RTCP sender report (PRFT side data) or `start_time_realtime` (`WRK/ingest.c:557-561`); packets without it are dropped and counted (`:574-579`); a camera clock more than 2,000 ms from the Core clock ends the ingest with `camera_clock_out_of_bound` (`:583-589`; `WRK/anchor.h:21`).
- input-av sets no clock-related input flag (row 1 TS-1, Grep of `wallclock|fflags|...` empty) and estimates the media start from FFmpeg progress lines (H-09, `IAV/nvr/recorder.py:33-36,156-170`). Its documents only advise "Atur jam kamera ke NTP" (`IAV/docs/UJI-LAN-KANTOR.md:46`).
- Implication: a reverse gap. The tested scheme never exercised sender-report timing or a clock bound. Whatever pulls from the camera must hand the worker a wall clock inside the bound: the camera's own sender reports (then the cameras must be NTP-disciplined, and setting a camera clock is class C by `ADP/types.ts:144`), or the pulling part's arrival clock (as the local helper does with `-copyts -output_ts_offset -S -start_time_realtime S`, `ADP/local/camera-helper-args.ts:105-110`, row 2). Row 8 chooses; experiment E-4 measures the cameras.

### Finding 5: the tested audio CAPTURE fits the existing mic transport with a helper change only; the STORED form does not follow [Confidence: HIGH for the code; MEDIUM for the fit, see H-D]

- Transport as built: a named pipe of 32-bit float, 48,000 Hz, one channel (`PROTO:326-333`; `ADP/mic-transport.ts:48,62-72`); the worker reads 4-byte floats and resamples each microphone (`WRK/audio.c:233,353-358`).
- Tested capture: open all native channels, select by `pan`, 24-bit request, 48,000 Hz (`IAV/nvr/recorder.py:104-116,212-215`). A helper that ends in `pan=mono|c0=c<k>` and converts to `pcm_f32le` produces exactly what the pipe carries. The local mic helper already ends in `-ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1` (`ADP/local/mic-helper-args.ts:71`, row 2).
- Arithmetic note (reasoning, not a test): every 24-bit signed integer is exactly representable in a 32-bit float (24-bit significand), so the conversion at the pipe loses nothing. What changes the samples afterwards is the worker: continuous resampling within +-5,000 ppm (`WRK/audio.c:353-358`; D85, `T3/decisions/decisions.md:98`) and the AAC encoder at 96 kbit/s mono (`WRK/ingest.c:163-172`).
- What is NOT preserved under the Core's stored form: (a) lossless 24-bit; (b) the bit-exact input separation that input-av proved (`IAV/scripts/uji/uji_multi_ruangan.py:125-142`); (c) every selected input being recorded: the Core stores ONE of two microphones, chosen by `astreamselect` with a hard cut (`WRK/audio.c:231-237`; row 2 section 12), while input-av records every selected input unmixed (`IAV/nvr/routers/audio.py:22-24`). The plan is refused unless rate is 48,000 and channels is 1 (`WRK/capture_worker.c:148-149`).
- HYPOTHESIS H-D: ALSA `dsnoop` with `period_size 1024 buffer_size 8192` (`IAV/nvr/audio.py:478`) delivers evenly enough for the worker's placement by arrival ("the writer must not buffer", `ADP/mic-transport.ts:51`). Experiment E-5 settles it; it needs a Linux host and the USB interface.
- Implication: Q5 is answered on the capture side without a worker change. Everything about what is stored is Q8, and Q8 on the audio side is larger than "AAC or FLAC": it also decides whether the standby microphone is evidence.

### Finding 6: a production session needs four production sources at once [Confidence: HIGH]

- The selector must hold exactly two cameras and two microphones (`apps/core-server/src/modules/capture-config/plan.ts:124`), each recordable (`:135`), all of one source class (`:146-150`), and that class must be the class of the running operation (`:151-153`). Mixed sessions are refused by ruling (D82, `T3/decisions/decisions.md:95`; RG-3).
- Implication: the camera opener cannot be proven in a recorded session on real hardware without the microphone opener, and the reverse. Seams S1 and S3/S4 share one hardware milestone. Separately, a `REAL_PRODUCTION` Core cannot operate at this tree at all: its registry is empty, `loadProductionAdapters` has no caller (row 2 section 4), no command provisions a production signing key and it refuses the demo operator password (`README.md:441`, via `research/02_collection_rulings.md` 8.12). The port is necessary for a production session, not sufficient.

### Finding 7: "tested" covers less than the wording of U2 suggests [Confidence: HIGH, from row 1 section 4.12]

- Physically observed: ONVIF registration and one recording of 54-57 s on four H.265 cameras, four rooms at once, hashes matching (`IAV/docs/SERAH-TERIMA.md:122-124`).
- Not physically observed: stream-loss reconnect, camera audio, dual-lens, A/V sync, more than two inputs in one source, an 8-input interface (`IAV/README.md:206-209`; `IAV/docs/SERAH-TERIMA.md:165-173`). The audio files of the real run were practically silent (`SERAH-TERIMA.md:126,187-188`); the bit-exact proof used the onboard laptop card with virtual H.264 cameras (`SERAH-TERIMA.md:107,112`); the EVO 8 puts one full-scale sample at the start of the first recording after plug-in, with no handling (`SERAH-TERIMA.md:180-186`); the automatic USB source moved two microphones to another card without confirmation (`SERAH-TERIMA.md:189-193`).
- Implication: the camera input scheme is field-tested; the audio input scheme is logic-tested. Parameters without a physical observation are marked in section 6 so that row 10 does not class them "tested".

## 5. Verdict per hardware-logic item (38 items)

"Lands on" names the seam and the contract member or worker part. "Provisional on" names the open entry that must be answered before the item's work can be executed (not before it can be designed). Entry NEW-1 is proposed by this row (section 9); it is not in the register yet.

| Id | Item (row 1 section 3) | Verdict | Lands on (seam: member or part) | Provisional on / held part | Evidence and reason |
|---|---|---|---|---|---|
| H-01 | ONVIF call with WS-UsernameToken using the camera clock, HTTP Digest fallback | ALREADY_IN_CORE | S1: connection test facade | - | The Core reads the device clock first, without a credential (`ADP/camera/onvif-session.ts:450-451`), and sends the credential as Digest or `PasswordDigest`, Basic refused (row 2 section 6). Not shown by rows 1-2: that the token's `Created` follows the camera clock; the flow is proven on loopback fixtures only (`T3/identification/02_structured.md:562`). Clock-skew behaviour on a real camera: UNPROVEN, experiment E-3. |
| H-02 | Media address fallback `/onvif/media_service` | NOT_NEEDED | - | - | The Core asks `GetServices`, then `GetCapabilities` (`onvif-session.ts:456-457`) and answers `NO_MEDIA_SERVICE` without guessing an address (`:466`). No bench device is recorded as needing the guess. Revisit if a camera returns that reason. |
| H-03 | One channel per video source; largest pixel area is the record stream | ADOPT | S1: `testConnection` result (`usableProfiles`) and `profiles(deviceId)` (`ADP/types.ts:138,141`); S5: `CapturePlanCamera.profile` (`PROTO:526`) | Q9 | The Core reads token, encoding and GOP only: no width, height or source token (`onvif-session.ts:212-225`), and checks the FIRST profile (`:480`). The plan already carries a profile string. Dual-lens has no physical test (`IAV/README.md:207`). |
| H-04 | Single-profile path: named token, else first profile | NOT_NEEDED | - | - | Superseded by H-03. Its entry points (hand-typed host, hand-typed RTSP URL, `IAV/nvr/routers/admin.py:254-262`) contradict D80(10) "typed-address entry is NOT in scope" (`T3/decisions/decisions.md:93`). |
| H-05 | `GetStreamUri` RTP-Unicast/RTSP; credentials percent-encoded into the URI | ADOPT (credential-free form only) | S1: `pullUrl(deviceId, profile)` (`ADP/types.ts:143`) built with `streamLocator` (`ADP/credential.ts:105-108`), joined to the credential at `credentialAtInjection` (`:122-125`) | Q9 | The Core asks for the URI (`onvif-session.ts:482`), compares it and drops it (`:227-240,479`). The half "put user and password into the URI" is NOT carried: refused by `onvif-session.ts:238`, `PROTO:508`, CR-3. A camera that returns a URI with a user part is `WRONG_PROFILE` today. |
| H-06 | MAC as identity; second registration of one MAC refused; lens and device limits | ALREADY_IN_CORE | S1/S2: adoption | - | The Core refuses a second adoption: `CANDIDATE_ALREADY_REGISTERED` (`apps/core-server/src/modules/capture-discovery/connect/service.ts:260,493`); identity is the announced `endpointRef` (`:504`), not the MAC. `GetNetworkInterfaces` is not among the Core's five reads (row 2 section 6). Limit: two camera slots (`plan.ts:124`). |
| H-07 | Camera recording command: RTSP/TCP, video copy, camera audio to AAC, MPEG-TS | ADOPT (input half) | S1: `openSource(deviceId, { ingestUrl }, signal)` (`ADP/types.ts:140`) through a new pull part (fork F-1); S6: ingest, unchanged for H.264 | Q9; held: container and part files (Q8); camera audio NOT CARRIED | Finding 1. Video copy is what the worker does (`WRK/ingest.c:361`). Camera audio is dropped by the worker (`WRK/ingest.c:541`) and has no bench observation (`SERAH-TERIMA.md:79`; `IAV/README.md:207`). |
| H-08 | One spawner thread with parent-death signal; graceful stop | ADOPT (as a requirement: no feeding process outlives the Core) | S1, S3: helper start and stop through the process door (`ADP/local/process-door.ts`) | Q7 for the Linux-only `prctl` method | The door stops with `SIGTERM` then `SIGKILL` after a grace (`ADP/local/camera-helper.ts:163,342-343`); standard input is closed (`process-door.ts:96`), so `q` is not available. HYPOTHESIS H-E: in the push design an orphan ends by itself (broken pipe or reset listener); experiment E-7. An orphan microphone helper keeps the sound card open (`IAV/nvr/audio.py:238-239`). |
| H-09 | Estimated wall-clock time of the first media sample | BLOCKED_BY_DECISION | - | Q8 | Needed only when audio is a separate file to be aligned later. Under the Core's stored form the worker places video and audio on one timeline (Finding 4). |
| H-10 | Reconnect and part rule | ADOPT (retry rule) | S1: re-open by the adapter on source loss (`onSourceLost` exists for local adapters only, row 2 "Supporting units"); S6: ingest must accept a second connection | Q9; held: "new part = new file with its own hash" (Q8) | Today the listen ingest ends on the client's teardown, "one session by design" (`WRK/ingest.c:540`), and the local helper is never restarted (`ADP/local/camera-helper.ts:22`). No physical test of reconnect exists (row 1 TS-5). |
| H-11 | Record URL re-read at each part; camera followed by MAC on IP change | ADOPT (resolve the locator at each open) | S1: `pullUrl` called per `openSource`, not stored at adoption | Q9; follow-by-identity needs NEW-1 | No production `pullUrl` exists (`onvif-rtsp.ts:35`). Following an address change needs a re-discovery keyed by `endpointRef`; reading the neighbour table is part of H-25. |
| H-12 | Finalisation: SHA-256, duration, mode 0444, crash recovery | ALREADY_IN_CORE | S6 and sealing (outside the adapter seams) | - | The worker writes whole durable fragments, append-only, published by hard link (row 2 section 11, `WRK/sink.c:1-33`); the Core has `recoverSession` (`apps/core-server/src/modules/sessions/index.ts:5`) and seals. Record ownership is row 6. |
| H-13 | Sound card enumeration (`arecord -l`, `/proc/asound`) with caches | ADOPT | S3: `enumerate()` (`ADP/types.ts:210`), plus the device-list rule of the local pattern | Q7, Q9 | The production stub throws (`ADP/audio/usb-audio.ts:23`). No ALSA code exists in the Core or worker (row 2 section 7). |
| H-14 | Automatic USB source resolved at start and pinned; refusal when an input exceeds the card; card identity in the audit | ADOPT (refusal and identity) | S3: `open(inputId, { sessionId, signal })` (`ADP/types.ts:212`) and `AudioInputDescriptor.errorCode` (`:181-185`) | Q7, Q9 | Pinning per session exists: the registry is locked while a session is open (row 2 section 13, `registry.ts:107,129`). Recommendation: do NOT carry the "first USB card present" substitution; it moved two microphones to another card without confirmation on the bench (`SERAH-TERIMA.md:189-193`). This departs from the tested default and belongs in the P3 confirmation line. No error code for "input beyond the card" exists (`ADP/types.ts:171-177`). |
| H-15 | Shared-capture ALSA configuration (`dsnoop` plus `plug`) generated per card | ADOPT | S3: `open` (configuration generated before the helper starts); S4: feeds `PCM_FIFO` | Q7, Q9 | Needed in a one-room Core too: primary and standby microphone can be two inputs of one interface, each with its own pipe and helper, and one ALSA card admits one opener (`IAV/nvr/audio.py:390-392`). input-av passes the file by inherited `ALSA_CONFIG_PATH` (`IAV/nvr/audio.py:487`); the Core's door gives a child an empty environment unless the caller hands one over (`ADP/local/process-door.ts:11,34-35,92`). |
| H-16 | Open all device channels, select inputs with `pan` | ADOPT | S3: `open` (helper argument table, the pattern of `MIC_HELPER_TABLE`); S4: `MIC_TRANSPORTS.PCM_FIFO` unchanged | Q7, Q9 | Finding 5. One input per microphone role fits `channels: 1` (`ADP/mic-transport.ts:67`). |
| H-17 | Stored audio form: FLAC for 1-2 inputs, WAV RF64 above | BLOCKED_BY_DECISION | - | Q8 | Stored side. Refused today by `WRK/capture_worker.c:148-149` and the one AAC encoder (`WRK/ingest.c:163-172`). The WAV branch has no bench observation. |
| H-18 | Allocation rules: one input per source, one rate per card | ADOPT (one-room form) | S3: checked at assignment (`CaptureDeviceRegistry.assertAssignable`, `ADP/types.ts:222-244`) and at `open` | Q7; the cross-room part is Q6 | The plan already refuses a duplicate microphone, role or path (`PROTO:561-593`, row 2). The rate is fixed at 48,000 by the worker (`WRK/worker.h:75`), which satisfies "one rate per card" by construction. |
| H-19 | Capture gain through the card mixer | BLOCKED_BY_DECISION | - | Q10 | Gain calibration tool. No contract member sets a gain. |
| H-20 | Level meter per 100 ms with live monitor | BLOCKED_BY_DECISION | - | Q10 | The in-session level exists: `level(inputId)` answers the worker's telemetry (`ADP/types.ts:214`; row 2 section 7). The calibration meter outside a session and the listen-in monitor are the tool. |
| H-21 | Test record of 1-15 seconds | BLOCKED_BY_DECISION | - | Q10 | Calibration tool. The Core has a pre-check short open for local devices (row 2 section 7). |
| H-22 | Sound card hot-plug monitor | ADOPT (detection method) | S3: `enumerate()` behind operation 97 "rescan" | Q7 | The Core re-reads inputs on request (D80(5); row 2 "Supporting units") and the worker warns `MIC_DISCONNECTED` (`WRK/audio.c:36-40`, row 2). The 3 s background poll is not carried. |
| H-23 | Link monitor on physical Ethernet ports | NOT_NEEDED | - | reversible under Q6 | Its outcome for one room (camera unreachable) is covered by H-26. Kept as documented know-how: pulling the PoE uplink takes every camera at once (`IAV/nvr/discovery.py:5-6`). |
| H-24 | WS-Discovery: Probe plus passive Hello/Bye | ALREADY_IN_CORE (Probe) | S2: `discover(search)` | - | Built (`ADP/camera/ws-discovery.ts`, row 2 section 5). The Hello/Bye listener is not carried: the Core "joins no group, listens for no announcement" (`ws-discovery.ts:18-19`), by D80(1). |
| H-25 | ARP sweep or poke, neighbour table, ping, direct unauthenticated ONVIF check | BLOCKED_BY_DECISION | (S2: `discover`; `DiscoverySearch` has no address member, `ADP/types.ts:53-58`) | NEW-1 | Forbidden today by ruling: probe-answer data only, no follow-up read (D80(1)); "a camera that does not answer multicast cannot be found ... recorded as a gap" (D80(10)). On the bench `ufw` blocked incoming multicast and WS-Discovery was tested in-process only (`SERAH-TERIMA.md:266-267`), so the fallback is what found the cameras there. |
| H-26 | Camera heartbeat: ping, then TCP 554 and 80 | ADOPT (for adopted cameras) | S1: adapter extras `presence` / `precheck` as in the local adapter (`ADP/local/camera-adapter.ts:45-54`, row 2); the contract has no presence member (`ADP/types.ts:125-146`) | Q9 | Applies to a camera the operator has adopted, so it is not a search (D76). The 3 s background loop is a design choice for row 8. |
| H-27 | Device registry upsert keyed by MAC; vendor from OUI | ALREADY_IN_CORE (in the Core's form) | S2: candidate list | - | Candidates carry vendor, model and `endpointRef` (`ADP/types.ts:65-78`, row 2) and never enter the registry by themselves (RG-4). The persistent table of detected devices is a record: row 6. |
| H-28 | Passive cable monitor (`tcpdump` through a root helper) | BLOCKED_BY_DECISION | - | Q10 | Installation tooling with root privilege; finds factory-default cameras. |
| H-29 | Temporary IP alias on the camera port | BLOCKED_BY_DECISION | - | Q10 | Changes host network state; exists to serve H-30 and H-31. |
| H-30 | Factory-IP scan | BLOCKED_BY_DECISION | - | Q10 | Named tool. |
| H-31 | Set camera IP through ONVIF | BLOCKED_BY_DECISION | - | Q10 | Named tool. A configuration change on a device: class C by D75 (`T3/decisions/decisions.md:88`) and by the Core's test file, "no ... network set, no reboot" (`onvif-session.ts:10`). |
| H-32 | New-camera wizard job; next free IP | BLOCKED_BY_DECISION | - | Q10 | Goes with H-30 and H-31. |
| H-33 | Live preview through MediaMTX; non-H.264 transcoded | NOT_NEEDED | - | - | OD-12: "no live preview of real cameras in this phase"; class C-6 (`T3/masterplan/01_specs.md:438`). The know-how "browsers cannot play H.265" (`IAV/nvr/mediamtx.py:46-48`) matters for G-3 in section 8. |
| H-34 | Playback copy (remux or transcode, sound card audio muxed in) | BLOCKED_BY_DECISION | - | Q8 | Exists because the evidence is MPEG-TS with separate audio. Under the Core's stored form the audio half disappears. The HEVC half (a player cannot show it) does not disappear: gap G-3. |
| H-35 | Stream test by `ffprobe` over TCP | ADOPT | S1: `testConnection` (`ADP/types.ts:138`), performed by the pull part | Q9 | D82: "an RTSP-level test belongs with the real pull path (class C-2), where libavformat does it with the credential off the argument list" (`T3/decisions/decisions.md:95`). This is the only place the true codec can be read before a session (Finding 2). |
| H-36 | Sleep, idle and lid inhibitor; NTP state per session | NOT_NEEDED (as adapter logic) | - | Q7 | No seam S1-S6 owns it. It is a host configuration of the production Core (checklist item for row 10). No counterpart was found in the Core (Grep `caffeinate|systemd-inhibit|preventSleep|powerSaveBlocker` over `apps/core-server/src`, `apps/capture-worker/src`: no match). |
| H-37 | Disk protection: refuse below a limit, orderly stop below a critical limit | ALREADY_IN_CORE (low confidence) | boot checks and capture session (outside the adapter seams) | - | The Core probes the evidence volume and reads its free bytes before any session (`apps/core-server/src/capture/boot/evidence-volume.ts:1-18,87-91`). Not established here: a threshold stop in mid-session (`capture-session/index.ts` matches a Grep for volume terms and was not read). Row 8 confirms or turns this into ADOPT. |
| H-38 | System diagnostics (doctor) | BLOCKED_BY_DECISION | - | Q10 | Named tool. Its checks of programs, groups and helper hashes are host checks; the Core's boot checks are their natural home if ported. |

**Counts.** ADOPT 14 (H-03, 05, 07, 08, 10, 11, 13, 14, 15, 16, 18, 22, 26, 35); ALREADY_IN_CORE 6 (H-01, 06, 12, 24, 27, 37); NOT_NEEDED 5 (H-02, 04, 23, 33, 36); BLOCKED_BY_DECISION 13 (H-09, 17, 19, 20, 21, 25, 28, 29, 30, 31, 32, 34, 38). Total 38. Blocked by entry: Q8 = 3 (H-09, 17, 34); Q10 = 9 (H-19, 20, 21, 28, 29, 30, 31, 32, 38); NEW-1 = 1 (H-25).

**ADOPT items by seam.** S1: H-03, 05, 07, 08, 10, 11, 26, 35. S3 (feeding S4): H-08, 13, 14, 15, 16, 18, 22. S5: H-03 (profile carrier). S6: H-07 (HEVC proof), H-10 (second connection). S2 has no ADOPT item: its only candidate is H-25, which is blocked. S4 needs no change under the Core's stored form.

## 6. Acceptance table of the tested input scheme (63 parameter rows)

Status is a fact about the Core and worker as they stand. "Tested" says whether row 1 found a physical observation.

### 6.1 Camera recording command (TS-1, TS-3)

| # | Parameter (input-av source) | Status | Core line that accepts or refuses | Target | Physically tested |
|---|---|---|---|---|---|
| P-01 | The recorder dials the camera (`-i <url>`, `IAV/nvr/recorder.py:217`) | NEEDS_CHANGE | The worker only listens: `WRK/ingest.c:482`; loopback only: `PROTO:508-516`, `WRK/capture_worker.c:110-118`; `openSource` refuses: `ADP/camera/onvif-rtsp.ts:31-33` | PORT (fork F-1) | yes |
| P-02 | `-rtsp_transport tcp` | NEEDS_CHANGE (camera leg: no part) / ACCEPTED_TODAY (loopback leg: `WRK/ingest.c:484`) | as left | PORT | yes |
| P-03 | `-timeout 5000000` on the RTSP input | NEEDS_CHANGE | No camera-leg part. Nearest: `listen_timeout` (`WRK/ingest.c:483`), helper no-frame stop after 8 s (`ADP/local/camera-helper.ts`, row 2) | PORT | yes; the option's meaning per FFmpeg version is a row 1 HYPOTHESIS |
| P-04 | Credentials inside the URL, in the argument list | NEEDS_CHANGE (forbidden) | `ADP/camera/onvif-session.ts:238`; `PROTO:508`; `ADP/credential.ts:117-125` | NOT CARRIED: replaced by the start-message injection | yes |
| P-05 | `-map 0:v:0` (first video stream) | ACCEPTED_TODAY | `av_find_best_stream(..., AVMEDIA_TYPE_VIDEO ...)` (`WRK/ingest.c:509`): the best stream, not the first; equal for a single-video profile | PORT | yes |
| P-06 | `-c:v copy` | ACCEPTED_TODAY | `WRK/ingest.c:361` | PORT | yes |
| P-07a | Codec as delivered: H.264 | ACCEPTED_TODAY | `WRK/ingest.c:361-362`; worker tests assert `h264` (row 2 section 11) | PORT | virtual cameras only |
| P-07b | Codec as delivered: H.265 | UNPROVEN | Not refused: `WRK/ingest.c:361-362`. Conditional: `WRK/ingest.c:512` (extradata). Reader maps `hvc1`/`hev1`: `apps/core-server/src/capture/fragments.ts:459`; frame rate null: `:541-546` | PORT after E-1, E-2 | yes, in input-av (four cameras) |
| P-08 | `-map 0:a:0? -c:a aac -ar 48000 -b:a 128k` (camera audio) | NEEDS_CHANGE | Every non-video packet is dropped: `WRK/ingest.c:541` | NOT CARRIED (recommended): no observation | no |
| P-09 | `-f mpegts` | NEEDS_CHANGE | `WRK/ingest.c:344` (`mp4`), flags `:47` | HELD (Q8) | yes |
| P-10 | File per part `cam<id>-p<NN>.ts` (`IAV/nvr/service.py:153-154`) | NEEDS_CHANGE | One `outputPath` per camera: `PROTO:520-534`; one connection per ingest: `WRK/ingest.c:540` | HELD (Q8) | yes (part 01 only) |
| P-11 | `-n`, never overwrite | ACCEPTED_TODAY | Exclusive create and link that refuses an existing name: `apps/core-server/src/capture/boot/evidence-volume.ts:10-18` describing `WRK/sink.c` | PORT (already so) | yes |
| P-12 | `-progress pipe:1 -stats_period 0.5` as the liveness signal | ACCEPTED_TODAY (same pattern) | Delivery watch on `-progress pipe:1` (`ADP/local/camera-helper.ts:41-107`, row 2) | PORT (if the pull part is a program with progress output) | yes |
| P-13 | File played in a loop as a virtual camera | ACCEPTED_TODAY (equivalent) | Kind `FAKE` (`ADP/registry.ts:24,36`) | NOT CARRIED | n/a |

### 6.2 ONVIF profile choice and stream address (TS-2)

| # | Parameter | Status | Core line | Target | Tested |
|---|---|---|---|---|---|
| P-14 | `GetProfiles` on the media service | ACCEPTED_TODAY | `onvif-session.ts:469`; either `media` or `media2`: `:466` | PORT (already so) | yes |
| P-15 | Group by video source; record stream = largest pixel area | NEEDS_CHANGE | No width, height or source token read: `onvif-session.ts:212-225`; first profile checked: `:480` | PORT | yes (single-lens only) |
| P-16 | Preview stream = smallest area | NEEDS_CHANGE | No preview of real cameras: OD-12 | NOT CARRIED | yes |
| P-17 | `GetStreamUri`, `RTP-Unicast`, protocol `RTSP` | ACCEPTED_TODAY | `onvif-session.ts:482` passes `protocol: 'RTSP'`; the stream type is the package default (row 2 gap 2) | PORT | yes |
| P-18 | The returned address is kept and recorded from | NEEDS_CHANGE | Compared and dropped: `onvif-session.ts:227-240,479`; `pullUrl` refuses: `onvif-rtsp.ts:35` | PORT (credential-free locator) | yes |
| P-19 | The reported encoding neither selects nor refuses a profile | NEEDS_CHANGE | `onvif-session.ts:222,477,491-492`; `ADP/types.ts:94,104` | PORT (codec judged from the stream) | yes |
| P-20 | `record_stream` main or sub, set by an admin | ACCEPTED_TODAY (carrier only) | `CapturePlanCamera.profile` is a free string (`PROTO:526`); nothing consumes it for `ONVIF_RTSP` | PORT | no observation of `sub` |
| P-21 | Order: device time, capabilities, profiles, stream address; device service on port 80 | ACCEPTED_TODAY | `onvif-session.ts:449-482` (adds `GetServices` first) | PORT (already so) | yes |
| P-22 | WS-UsernameToken digest, HTTP Digest on 401 | ACCEPTED_TODAY | Digest or `PasswordDigest`, Basic refused (row 2 section 6); at most 2 rejected credential requests per failed test (D86 C-2) | PORT (already so); real-camera behaviour E-3 | yes, in input-av |
| P-23 | Camera registered by a hand-typed RTSP URL without ONVIF | NEEDS_CHANGE | No typed address: `apps/core-server/src/modules/capture-discovery/routes.ts:14-16`; D80(10) | NOT CARRIED | n/a |

### 6.3 Timeouts and stop (TS-4)

| # | Parameter | Status | Core line | Target | Tested |
|---|---|---|---|---|---|
| P-24 | ONVIF HTTP call 5.0 s | ACCEPTED_TODAY | `connectMs 3_000`, `requestMs 5_000` (`onvif-session.ts:64-66`) | PORT (already so) | yes |
| P-25 | Stream test process timeout 20 s | NEEDS_CHANGE | No RTSP-level test exists: `onvif-session.ts:11-13` | PORT with H-35 | yes |
| P-26 | Stop: `q` on stdin, 10 s, terminate, 5 s, kill | ACCEPTED_TODAY (equivalent) | `SIGTERM`, then `SIGKILL` after a grace (`ADP/local/camera-helper.ts:163,342-343`); stdin closed (`process-door.ts:96`). The file is closed by the worker, not by the feeder | PORT (Core form) | yes |
| P-27 | WS-Discovery wait 2.5 s | ACCEPTED_TODAY | Window 3,000 ms (`SHARED:140`, row 2) | PORT (already so) | in-process only |

### 6.4 Reconnect, parts, concurrency (TS-5)

| # | Parameter | Status | Core line | Target | Tested |
|---|---|---|---|---|---|
| P-28 | Reconnect after 2 s; 2, 4, 8, 16, 30 s when no data; no attempt limit | NEEDS_CHANGE | Ingest ends on teardown: `WRK/ingest.c:540`; helper never restarted: `ADP/local/camera-helper.ts:22` | PORT | no |
| P-29 | Each attempt is a new part with its own file and hash | NEEDS_CHANGE | `PROTO:520-534` (one file per camera) | HELD (Q8) | no |
| P-30 | Empty repeat attempts deleted; resume confirmed after 5 s | NEEDS_CHANGE | no part; the ingest takes one connection: `WRK/ingest.c:540` | PORT with P-28 | no |
| P-31 | Record address re-read before each part | NEEDS_CHANGE | no production `pullUrl` (`onvif-rtsp.ts:35`) | PORT | no |
| P-32 | One session per room, several rooms at once | NEEDS_CHANGE | `SESSION_OPEN` (`apps/core-server/src/capture/supervisor.ts:1076-1078`, row 2); `NCAM 2`, `NMIC 2` (`WRK/worker.h:78-79`); selector shape (`plan.ts:124`) | HELD (Q6) | 4 rooms real, 8 rooms virtual |

### 6.5 Keyframe (TS-6)

| # | Parameter | Status | Core line | Target | Tested |
|---|---|---|---|---|---|
| P-33 | Recording starts at the next keyframe; I-frame interval of 1 s advised (2 s on the UNIVIEW) | ACCEPTED_TODAY | First written packet must be a keyframe: `WRK/ingest.c:632`; GOP bound 2,000 ms with a warning above it: `onvif-session.ts:72`, `SHARED:59`; fragment target 2,000 ms: `SHARED:51-53` | PORT (already so). 2 s sits exactly on the bound | yes |

### 6.6 ALSA shared capture (TS-7)

| # | Parameter | Status | Core line | Target | Tested |
|---|---|---|---|---|---|
| P-34 | `dsnoop` plus `plug` pair per card, generated file | NEEDS_CHANGE | `enumerate`, `open`, `level` refuse: `ADP/audio/usb-audio.ts:23-27`; no ALSA anywhere (row 2 section 7) | PORT (Q7) | onboard card and EVO 8 |
| P-35 | Slave opened with the card's native channel count | NEEDS_CHANGE | no part; `open` refuses: `ADP/audio/usb-audio.ts:24-26` | PORT (Q7) | yes |
| P-36 | Slave format: first of S32_LE, S24_3LE, S24_LE, S16_LE the card lists | NEEDS_CHANGE | no part; `open` refuses: `ADP/audio/usb-audio.ts:24-26` | PORT (Q7) | native format of the EVO 8 not recorded |
| P-37 | One sample rate per card | ACCEPTED_TODAY (by construction) | The worker admits 48,000 only: `WRK/capture_worker.c:149` | PORT | yes |
| P-38 | `period_size 1024 buffer_size 8192`, `ipc_key`, `ipc_perm 0660` | UNPROVEN | Must suit placement by arrival: `ADP/mic-transport.ts:51` (H-D) | PORT after E-5 (Q7) | yes, for file recording |
| P-39 | `ALSA_CONFIG_PATH` inherited by every child | NEEDS_CHANGE | Child environment is empty unless handed over: `ADP/local/process-door.ts:11,34-35,92` | PORT (variable handed over explicitly) | yes |
| P-40 | Regenerated at start, on card change, at session start, at meter start | NEEDS_CHANGE | no part; `enumerate` and `open` refuse: `ADP/audio/usb-audio.ts:23-26` | PORT (Q7) | yes |
| P-41 | FFmpeg opens the `plug` name, never `hw:` | NEEDS_CHANGE | Helper input is pinned to `-f avfoundation` (`ADP/local/mic-helper-args.ts:58`, row 2) | PORT (Q7) | yes |
| P-42 | `pulse:` sources, exclusive | NEEDS_CHANGE | no part; one input kind only: `PROTO:326-333` | NOT CARRIED (not in P3) | n/a |

### 6.7 Channel-open then input-select, format and rate (TS-8, TS-9, TS-10)

| # | Parameter | Status | Core line | Target | Tested |
|---|---|---|---|---|---|
| P-43 | `-channels <native count>` | NEEDS_CHANGE (helper table only) | no production helper (`ADP/audio/usb-audio.ts:24-26`); pattern `MIC_HELPER_TABLE` (row 2 section 7) | PORT (Q7) | yes |
| P-44 | `-af pan=mono\|c0=c<k>`: one input selected, not mixed | NEEDS_CHANGE (helper table only); the transport accepts the result | One channel: `ADP/mic-transport.ts:67`; `WRK/audio.c:233` | PORT (Q7) | bit-exact on the onboard card; EVO 8 inputs 1-3 stated separate |
| P-45 | A source with 2 or more inputs (stereo or `<n>c`) | NEEDS_CHANGE | `channels != 1` is `PLAN_UNSUPPORTED`: `WRK/capture_worker.c:149`; mono graph: `WRK/audio.c:233-237` | HELD (Q8) | no (every bench source had one input) |
| P-46 | Session start refused when an input exceeds the card | NEEDS_CHANGE | No such error code: `ADP/types.ts:171-177` | PORT | yes (logic) |
| P-47 | `-sample_rate 48000` | ACCEPTED_TODAY | `WRK/worker.h:75`; `SHARED:41`; `ADP/mic-transport.ts:66` | PORT (already so) | yes |
| P-48 | `-c:a pcm_s24le` requested from the `plug` layer | NEEDS_CHANGE (helper table only) | The pipe carries `F32LE` only: `ADP/mic-transport.ts:48,65`; `WRK/audio.c:233` | PORT: 24-bit capture, converted to float at the pipe (exact by arithmetic, Finding 5) | yes |
| P-49 | Other rates (8,000-192,000) and depths (16, 32) | NEEDS_CHANGE | `WRK/capture_worker.c:149` | NOT CARRIED beyond the default | no |
| P-50 | `-thread_queue_size 1024 -f alsa` | NEEDS_CHANGE (helper table only) | as P-43: `ADP/audio/usb-audio.ts:24-26` | PORT (Q7) | yes |
| P-51 | Stored: FLAC 24-bit, 1-2 inputs | NEEDS_CHANGE | One AAC encoder, FLTP, 96 kbit/s, mono: `WRK/ingest.c:163-172`; `WRK/capture_worker.c:148-149` | HELD (Q8) | yes (silent content on the EVO 8) |
| P-52 | Stored: WAV RF64, more than 2 inputs | NEEDS_CHANGE | as P-51 | HELD (Q8) | no |
| P-53 | Audio is a separate file per source | NEEDS_CHANGE | Encoded packets are cloned into every camera file (row 2 section 12, `WRK/audio.c:255-258`) | HELD (Q8) | yes |
| P-54 | Every selected input is recorded | NEEDS_CHANGE | One of two microphones passes: `WRK/audio.c:236` (`astreamselect ... inputs=2`) | HELD (Q8) | yes |
| P-55 | Samples reach the file unaltered (bit-exact) | NEEDS_CHANGE | Continuous resampling: `WRK/audio.c:353-358`; lossy encoder: `WRK/ingest.c:163` | HELD (Q8) | yes (onboard card) |

### 6.8 Discovery and presence (TS-11)

| # | Parameter | Status | Core line | Target | Tested |
|---|---|---|---|---|---|
| P-56 | Active Probe for `dn:NetworkVideoTransmitter`, TTL 1 | ACCEPTED_TODAY | `ADP/camera/ws-discovery.ts` (row 2 section 5: two probe types, TTL 1) | PORT (already so) | in-process |
| P-57 | Passive Hello/Bye on a bound port 3702, group joined | NEEDS_CHANGE (forbidden) | `ws-discovery.ts:18-19`; D80(1) | NOT CARRIED | in-process |
| P-58 | Background Probe every 30 s | NEEDS_CHANGE | Search on request only, rate-limited; refused while recording (D86 C-4; row 2 section 5) | NOT CARRIED | yes |
| P-59 | ARP sweep or poke, neighbour table, ping, direct unauthenticated ONVIF check | NEEDS_CHANGE (forbidden) | `ADP/types.ts:53-58`; `modules/capture-discovery/routes.ts:14-16`; D80(1), D80(10) | HELD (NEW-1) | yes |
| P-60 | Camera heartbeat every 3 s, offline after 2 failures | NEEDS_CHANGE | No presence member: `ADP/types.ts:125-146` | PORT for adopted cameras (H-26) | yes |
| P-61 | Link monitor every 2 s | NEEDS_CHANGE | no part; no presence member: `ADP/types.ts:125-146` | NOT CARRIED (H-23) | yes |
| P-62 | Nothing is registered automatically | ACCEPTED_TODAY | RG-4 (`T3/masterplan/05_capture_architecture_spec.md:180`); D76 | PORT (already so) | yes |

Interface choice, follow-by-MAC, the passive cable monitor, the factory scan and the hot-plug poll of TS-11 are not repeated as parameters: they are items H-11, H-22, H-28, H-30 of section 5.

**Counts, taken by a line count of the tables above.** 63 rows (P-01 to P-62, with P-07 split by codec into P-07a and P-07b; P-02 is counted by its camera leg). ACCEPTED_TODAY 19 (P-05, 06, 07a, 11, 12, 13, 14, 17, 20, 21, 22, 24, 26, 27, 33, 37, 47, 56, 62); UNPROVEN 2 (P-07b, P-38); NEEDS_CHANGE 42 (all others). By target among the 42: forbidden by a Core rule or ruling and not carried or held: P-04, P-23, P-57, P-59; held by Q8: P-09, 10, 29, 45, 51, 52, 53, 54, 55; held by Q6: P-32.

### 6.9 Core requirements that the tested scheme never exercised (reverse gaps)

| # | Core requirement | Core line | What input-av did | Consequence |
|---|---|---|---|---|
| R-1 | A camera wall clock per packet, inside +-2,000 ms of the Core clock | `WRK/ingest.c:557-561,574-589`; `WRK/anchor.h:21` | none (Finding 4) | Design choice in fork F-1; experiment E-4 |
| R-2 | Non-empty codec extradata when the stream opens | `WRK/ingest.c:512` | avoided the question with MPEG-TS | Finding 3; experiment E-2 |
| R-3 | The source is pushed to a loopback listener with usable timing | `ADP/types.ts:120-123`; `ADP/local/camera-helper-args.ts:105-110` (row 2) | wrote a file | Fork F-1 |
| R-4 | The credential never in an argument list, environment or URL | `ADP/credential.ts:117-125` | URL in argv, plain text in the database | Finding 1 |
| R-5 | The microphone writer does not buffer (placement by arrival) | `ADP/mic-transport.ts:51` | file recording; latency irrelevant | H-D; experiment E-5 |
| R-6 | Two cameras and two microphones, one source class | `plan.ts:124,146-153` | any mix per room | Finding 6 |
| R-7 | The codec word in adapter-layer sources is `HEVC`; `H265` is forbidden by a static test | `ADP/types.ts:110-111`; `adapters/__tests__/static.test.ts:266-274` (row 2) | n/a | Naming rule for row 8 |

## 7. The nine mismatches of `01_original.md`, each closed or pointed at an open entry

Each line of the controller's table (`identification/01_original.md:62-70`) is re-proved from rows 1-2, not taken as given.

| # | Mismatch as stated | Re-proved? | Evidence | Resolution | State |
|---|---|---|---|---|---|
| 1 | Stack / host: Python, SQLite, Linux-only against Node/TypeScript, PostgreSQL, macOS development host | Yes | Linux-only hardware parts: `IAV/nvr/recorder.py:63-64,74`, `/proc/asound` and `/sys/class/net` use (row 1 section 1). Core helpers are `avfoundation` (`ADP/local/camera-helper-args.ts:40`, row 2); no ALSA in the Core (row 2 section 7) | Stack half: closed by U1 and C13: the logic is rewritten in the Core's languages, Python and SQLite are not carried. Host half: the camera side is host-neutral; the microphone side (H-13, 15, 16, 22; P-34 to P-50) exists on Linux only | **Closed** (stack). **Waits for Q7** (host) |
| 2 | Identity: own users and JWT against Core RBAC and pairing | Yes | `IAV/nvr/security.py:17-26,61-70` (row 1); Core capture operations sit behind `CAPTURE_CONFIG` access (row 2 section 5) | Closed by U1 as read in P4 and by C13: one identity base, the Core's. Nothing of the input-av identity is a hardware item, so no H verdict depends on it. Record outcome: row 6 | **Closed.** Residual: who may run the installation tools is Q10 (row 13 rates it) |
| 3 | Video codec: cameras deliver H.265, the connection test accepts H.264 only | Yes, with a correction | `onvif-session.ts:222,491-492`; `SERAH-TERIMA.md:79-80` | Finding 2 and Finding 3. Planned change items: (a) S1: the outcome `NOT_H264` and the H.264-only `usableProfiles` give way to a codec read from the stream by the pull part (H-35); (b) S6: prove HEVC through ingest and mux (E-1, E-2) before any default is declared; (c) Core reader: frame rate for HEVC (open item of fix 151). Pins to move with (a): `ADP/types.ts:94,104`, `camera/__tests__/onvif-session.test.ts:170,200`, `connect/__tests__/connect.db.test.ts:313`, the two test stubs (row 2 section 6), `T3/masterplan/01_specs.md:292`, `T3/.../05_capture_architecture_spec.md:598-599` | **Input side answered** by U2 / P3 (Q4), **P3 to be confirmed**. **Technically UNPROVEN** at S6 until E-1 and E-2. The correction: the test may not refuse the bench cameras at all (H-A) |
| 4 | Container: MPEG-TS stream copy against fragmented MP4 | Yes | `IAV/nvr/recorder.py:148-149`; `WRK/ingest.c:344,47` | Not closed here by design (C12). New fact for the decision: the reason input-av gives for MPEG-TS is an ingest reason (parameter sets), which the Core meets at `WRK/ingest.c:512` whatever is stored | **Waits for Q8** |
| 5 | Audio: lossless FLAC in a separate file against AAC mono inside the camera file | Yes, and wider | `IAV/nvr/recorder.py:119-127`; `WRK/ingest.c:163-172`; `WRK/capture_worker.c:148-149`; `WRK/audio.c:231-237` | Capture side closed: the tested capture feeds the existing transport (Finding 5; H-13 to H-16). Stored side open, and it has four parts, not one: lossy against lossless (P-51), inside against separate (P-53), one active microphone against every selected input (P-54), resampled against bit-exact (P-55). OD-06 is in force and fixes AAC-LC 48 kHz mono (`T3/masterplan/01_specs.md:432`); manifest field 53 states that form as a constant (`T3/masterplan/06_evidence_package_spec.md:445,460`) | **Capture side closed** (U2 / P3, Q5; P3 to be confirmed). **Stored side waits for Q8** |
| 6 | Concurrency: 8 rooms at once against one open session per Core | Yes | `IAV/nvr/service.py:74-76,119-120`; `supervisor.ts:1076-1078` and `db/schema/sessions.ts:87` (row 2); `WRK/worker.h:78-79`; `plan.ts:124` | Not closed here. Facts for the decision: "8 rooms" was run with virtual cameras, four rooms with real ones (`SERAH-TERIMA.md:107,122-123`); R-6 "one active session per Core" is a task 3 requirement (`T3/masterplan/01_specs.md:195-196`). The one-room port needs none of the cross-room logic (H-18 cross-room part, H-23) | **Waits for Q6** |
| 7 | Evidence: unsigned plain files with SHA-256 against a sealed, signed package | Yes | `IAV/nvr/service.py:220-247` (hash, mode 0444); Core sealing (row 2 section 11 for the writer; `01_original.md:56` is the controller's statement, re-proved by row 4, not by this row) | Closed by U1 / P4 and NFR-1: the Core's sealing is the one custody form; H-12 is `ALREADY_IN_CORE`. What goes INSIDE the seal is Q8; a stored-form change makes manifest field 53 false until it is changed with it (`06_evidence_package_spec.md:460`) | **Closed** for ownership. Stored content **waits for Q8**; existing input-av evidence **waits for Q3** |
| 8 | Camera credential: plaintext password against sealed, write-only | Yes | `IAV/nvr/db.py:77,79`; `IAV/nvr/registration.py:62-69`; `IAV/nvr/recorder.py:217`; `ADP/credential.ts:117-125` | Closed in direction: the Core's form governs and the input-av form is not carried (H-05, P-04). Open in construction: the process that receives the credential does not exist; `credentialAtInjection` has no caller. That is fork F-1, a design item of row 8, not a user decision | **Closed** (rule). Construction is a row 8 work package; landing it is **Q9** |
| 9 | Audit: two hash chains, not connected | Yes for input-av (`IAV/nvr/audit.py:26-40`, row 1); the Core chain is row 4's subject | Closed by U1 / P4 and C13: one chain, the Core's. Events of ported logic become Core audit types (row 6 names them). The existing input-av chain is evidence data | **Closed.** Existing chain **waits for Q3** |

Result: 9 of 9 have a resolution or an entry reference. Fully closed: 2, 9. Closed in part with a named entry for the rest: 1 (Q7), 3 (P3 confirmation, experiments), 5 (Q8), 7 (Q8, Q3), 8 (Q9). Waiting entirely: 4 (Q8), 6 (Q6).

## 8. Design fork and gaps handed to row 8

### F-1. How a production camera reaches the worker (class C-2, "not made here": `T3/.../05_capture_architecture_spec.md:641-644`)

| | Variant A: pull relay in front of the unchanged worker | Variant B: pull input kind in the plan |
|---|---|---|
| What | A small program started through the process door; takes locator and credential in a start message on standard input; pulls RTSP over TCP with stream copy; pushes RTSP over TCP to the plan's `ingestUrl` | The worker dials the camera itself; `CapturePlanCamera` gets an input union as microphones have; the credential travels in the start message to the worker |
| Contract effect | None on `CameraSourceTarget { ingestUrl }` (`ADP/types.ts:120-123`) or protocol version 4 (`PROTO:141`, row 2) | Protocol change; `openSource` changes meaning; `WRK/capture_worker.c:110-118` and `WRK/ingest.c:482-484` change |
| Worker guarantee | "Listens on loopback, never dials out" kept (D82) | Lost: the worker opens connections to the camera network and holds a credential |
| Timing (R-1) | The relay must forward or replace the sender-report clock; two RTSP hops | The camera's own sender reports reach the anchoring code as it was verified (`WRK/ingest.c:51-57`) |
| HEVC (R-2) | Parameter sets must survive the relay's announce (H-B) | Depends on the camera's SDP directly: the weakness input-av names (`IAV/nvr/recorder.py:3-6`) |
| Security | A loopback listener opens in `REAL_PRODUCTION`; finding SEC35-40 ("any local process could push into the unauthenticated loopback listener and be recorded and signed as PRODUCTION", `T3/decisions/decisions.md:99`) was answered by having no listener (D86 C-5) and returns | No listener; SEC35-40 does not arise |
| Ready-made (NFR-2) | The FFmpeg libraries the worker already links; the command-line program is excluded by the credential rule | Same libraries, inside the worker |

No recommendation is fixed here: the choice trades a contract change against a returning High security finding, which rows 8, 12 and 13 must weigh together. Leaning, stated as such: variant A matches the adapter contract as written and leaves the verified worker alone; it is only acceptable with an answer to SEC35-40.

### Gaps

- **G-1.** `loadProductionAdapters` has no caller and the `REAL_PRODUCTION` registry is empty (row 2 section 4). Wiring it is part of landing the opener (Q9).
- **G-2.** The opener rule has more enforcement points than the three pins of the blueprint: `ADP/registry.ts:36,82`, `apps/core-server/src/capture/fence/sources.ts:86,106`, the stub literals `hasOpener: false` (`onvif-rtsp.ts:28`, `usb-audio.ts:22`), and nine test files (row 2 section 3). `sources.ts:86` follows the list "without an edit" by its own comment (`sources.ts:80-81`). Row 8 needs a lift condition for each.
- **G-3.** HEVC playback. input-av transcodes for the browser because "browsers cannot play H.265" (`IAV/nvr/mediamtx.py:46-48`) and makes an H.264 playback copy (`IAV/nvr/playback.py:156-178`). Whether the Core's web console, tablet and export can show a sealed HEVC file was not examined by rows 1-2 or by this row. Not a finding: an unexamined area that C11 makes relevant.
- **G-4.** Known defects of the tested audio scheme that a faithful port inherits: the full-scale first sample on the EVO 8 (`SERAH-TERIMA.md:180-186`), loopback inputs 5-6 offered as microphones (`SERAH-TERIMA.md:177-179`), unmeasured A/V offset (`SERAH-TERIMA.md:165-168`).
- **G-5.** Header comments in `ADP/types.ts:9-20` and `onvif-rtsp.ts:2-8` predate the built search and connection test (row 2 gap 3). Reported only; U3 forbids touching them.

### Experiments that would settle the hypotheses (none was run)

| Id | Settles | Experiment | Needs |
|---|---|---|---|
| E-1 | H-C; P-07b | Push an HEVC RTSP/TCP stream with sender reports into the worker's listener (a fixture of the kind of `test-fixtures/fake_cam_sr.py` with an H.265 payload, or an FFmpeg HEVC encoder as helper). Pass when: `ingest_connected` logs the HEVC codec with `extradata > 0` (`WRK/ingest.c:525-526`); fragments are published; the Core reader reports `HEVC` (`fragments.ts:459`); keyframe flags and GOP observation hold; the session seals and verifies | development host, fake devices |
| E-2 | H-B; R-2 | The same with a source whose SDP carries no parameter sets (in-band only). Outcome is either a recorded file or `INGEST_NO_EXTRADATA` (`WRK/ingest.c:512`) | development host |
| E-3 | H-A; H-01; P-22 | The operator runs the product's connect flow against one bench camera, typing the credential in the web console (D76), and reads the outcome and the listed profiles | real camera; operator only, never an agent |
| E-4 | R-1 | Record one bench camera through the chosen pull part; read `video_anchored`, the dropped-before-anchor counters and any `camera_clock_out_of_bound` (`WRK/ingest.c:577,585,593`) | real camera, pull part built |
| E-5 | H-D; P-38; G-4 | On Linux, feed the microphone pipe from the `dsnoop` device with the ported helper; read the worker's per-microphone rate figure and warnings (`WRK/audio.c:215-229`), and check the first second for the full-scale sample | Linux host (Q7), USB interface |
| E-6 | Finding 5 arithmetic | A unit check that every 24-bit value survives the conversion to 32-bit float and back | development host |
| E-7 | H-E | End the Core abruptly during a session with helpers running; list surviving processes | development host |
| E-8 | G-3 | Open the sealed HEVC session of E-1 in the web console, the tablet and an export | development host, after E-1 |

## 9. Entry proposed by this row

- **NEW-1 (proposed, not in the register).** Discovery fallbacks of a production Core. Subject: whether a production Core on its camera network may use the ARP sweep, the neighbour table, ping and the direct unauthenticated ONVIF check (H-25, P-59), and with them follow-by-identity (H-11). Why a decision: D80(1) and D80(10) forbid them today and D75 / D76 are the user's rulings behind those bounds (`T3/decisions/decisions.md:88-89,93`). Why it matters: on the bench, multicast was blocked by the host firewall and the fallback is what worked (`SERAH-TERIMA.md:266-267`). What proceeds without it: everything on the recording path; S2 stays as built.
- **For the P3 confirmation line** (differences the user should see when confirming): the automatic USB source is recommended not to be carried (H-14); camera audio is not carried (P-08); "main stream" is the largest-area rule (P-15); "24-bit" is a capture request, exact at the pipe, not a stored property (P-48); "tested" for audio is logic-tested (Finding 7).

## 10. Files and modules involved; lines re-opened in this pass

| Path | Role | Lines opened by this row |
|---|---|---|
| `apps/core-server/src/capture/adapters/camera/onvif-session.ts` | connection test, H.264 rule, stream address check | 60-73, 200-242, 440-496 |
| `apps/core-server/src/capture/adapters/registry.ts` | opener rule | 20-40, 76-86 |
| `apps/core-server/src/capture/fence/sources.ts` | opener rule, second enforcement | 80-110 |
| `apps/core-server/src/capture/adapters/types.ts` | adapter contract | 50-60, 88-146, 168-216 |
| `apps/core-server/src/capture/adapters/mic-transport.ts` | transport statement | 40-74 |
| `apps/core-server/src/capture/adapters/credential.ts` | locator, injection point | 100-126 |
| `apps/core-server/src/capture/adapters/camera/onvif-rtsp.ts`, `audio/usb-audio.ts` | production stubs | 1-38, 1-29 |
| `apps/core-server/src/capture/adapters/local/process-door.ts`, `camera-helper.ts` | helper start and stop | Grep hits at 11, 34-35, 92, 96 and 22, 163, 342-343 |
| `apps/core-server/src/capture/adapters/camera/ws-discovery.ts` | search | 14-34 |
| `apps/core-server/src/modules/capture-config/plan.ts` | selector rule | 118-156 |
| `apps/core-server/src/modules/capture-discovery/routes.ts`, `connect/service.ts` | search operation, adoption | 10-18; Grep hits at 260, 493, 504 |
| `apps/core-server/src/capture/fragments.ts` | codec of the stored file | 444-460, 538-548 |
| `apps/core-server/src/capture/boot/evidence-volume.ts` | volume probe | 1-28, Grep hits at 87, 91 |
| `apps/core-server/src/modules/sessions/index.ts` | one open session | 1-8 |
| `packages/capture-protocol/src/index.ts` | plan schema, mic input kind | 324-334, 506-556 |
| `packages/shared/src/api/capture.ts` | capture constants | 36-60 |
| `apps/capture-worker/src/ingest.c` | ingest, mux, encoder | 44-60, 155-178, 340-372, 476-530, 536-595, 626-640 |
| `apps/capture-worker/src/capture_worker.c` | plan checks | 104-126, 140-152 |
| `apps/capture-worker/src/audio.c`, `worker.h`, `anchor.h` | audio path, constants, clock bound | 226-240, 348-362; 72-80; Grep hit at 21 |

All input-av citations are taken from row 1; no input-av file was opened by this row.

## 11. Implementation order suggested to rows 8 and 10 (rationale only; no work package is defined here)

1. Experiments E-1, E-2, E-6, E-7 on the development host with fake devices: they decide whether "the codec delivered" is a parameter or a project, at no hardware cost.
2. Fork F-1, decided with the security review, because every S1 item (H-03, 05, 07, 10, 11, 26, 35) hangs on it.
3. S1 behind the opener rule with a fake ONVIF and RTSP source; S3 enumeration and helper argument tables with a fake device list. Neither needs Q9 to be answered to be built, only to be registered.
4. Hardware milestone, one for both sides (Finding 6): E-3, E-4, E-5 on the Linux host with two cameras and two inputs.
5. Stored-form work only after Q8.

## 12. Assumptions

- A-1. P3 is the correct reading of U2. If corrected, the Target columns of section 6 change; the Status columns do not.
- A-2. Rows 1 and 2 are accurate where this row did not re-open a line. The re-opened lines (section 10) all matched what row 2 reported.
- A-3. Line numbers are of the working tree of 2026-10-12, which holds uncommitted changes.
- A-4. "Production Core" means the `REAL_PRODUCTION` capture operation.

## 13. Risks

| Risk | Trigger | Mitigation |
|---|---|---|
| HEVC is planned as a one-line change | Row 8 reads mismatch 3 as "remove `NOT_H264`" | Finding 3; P-07b stays UNPROVEN until E-1 and E-2 |
| The port silently reintroduces a credential in an argument list | The FFmpeg command line of input-av is reused for the camera | Finding 1; P-04 is NOT CARRIED; fork F-1 excludes the command-line program |
| SEC35-40 returns unnoticed | Variant A is chosen and the opener rule is lifted | F-1 security row; row 13 |
| Audio is called "tested" at the level of the camera scheme | U2's wording | Finding 7; the "Physically tested" column |
| The standby microphone is assumed to be recorded | The input-av habit that every selected input is evidence | P-54; Q8 must state it |
| A verdict rests on an unread file | H-37, H-01, G-3 | Each is marked low confidence or unexamined, with the place to open |
| NEW-1 is lost because the register has six fixed open entries | Row 9's check counts six | Reported to the controller in the progress file |

## 14. Acceptance criteria of this row, checked

1. Every HARDWARE_LOGIC item has one verdict: 38 of 38 (section 5 counts).
2. Every ADOPT names a seam and a member or worker part: 14 of 14 (column "Lands on").
3. Every tested-scheme parameter has a status with a Core `file:line`: section 6; rows marked "no part" cite the stub or contract line that shows the absence in their group (`usb-audio.ts:23-27`, `onvif-rtsp.ts:31-35`, `types.ts:125-146`).
4. Nine mismatches each have a resolution or an entry reference: 9 of 9 (section 7).
5. Hypotheses labelled, each with an experiment, none run: H-A to H-E, E-1 to E-8.

## 15. Recommendations

1. Treat "H.265 as delivered" as UNPROVEN and schedule E-1 and E-2 before any work package assumes it.
2. Decide fork F-1 with rows 12 and 13 at the table; do not let it be settled by default.
3. Plan one hardware milestone for camera and audio together.
4. Put the four parts of the stored-audio question into Q8 explicitly (lossy, separate, every input, bit-exact).
5. Add NEW-1 to the decision register, or record that the controller declines it.
6. Carry the five P3 differences of section 9 into the P3 confirmation request.

## External Research Synthesis

No external research dimension is in scope for this row; no `research/03_external_vocabulary.md` exists in the task folder and no web source was used. Dimensions 1 to 7: no findings. Statements about FFmpeg library behaviour are labelled HYPOTHESIS and point at an experiment instead of an external source.

## Plan artifact

No `masterplan/02_plan.md` is written by this row. It is the output of row 10.

---
*Generated: 2026-10-12 17:34*
*Last Updated: 2026-10-12 17:34*
