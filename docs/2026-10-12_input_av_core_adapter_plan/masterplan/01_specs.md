---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 8
date: 2026-10-12
agent: data-analyst
type: target design (port specification)
narrative_tier: 1
confidence: MEDIUM (HIGH for code facts re-opened in this pass; LOW wherever a statement is marked HYPOTHESIS)
status: proposed - the sections on the stored form (Q8), the class-C lift (Q9) and the tools (Q10) stay "proposed" until the user answers
based_on: research/03_analysis.md (row 7); research/03_analysis_record_map.md (row 6)
source_structured_task: identification/02_structured.md (row 8 at line 144, profile line 166, C10-C13 at lines 49-52, seams at lines 118-129)
source_decisions: decisions/decisions.md (U1 line 7, U2 line 8, P3 line 9, P4 line 10, U3 line 13; Amendment 1: U5 line 15, U6 line 16, P7 line 17)
amended: Amendment 1, 2026-10-12, ruling U6 (network commissioning tools are required); see the note below the title
last_updated: 2026-10-12 (Amendment 1)
---

# Target design of the port: input-av hardware input logic into the Core adapters (row 8)

> **Amendment 1 (2026-10-12, U6).** The user ruled (`decisions/decisions.md:16`, verbatim): "alat pengubah jaringan ini digunakan untuk temporer alias network karena kamera bawaan pabrik di set dengan konfigurasi berbeda2 sehingga ini dibutuhkan". The factory-address scan with its temporary IP alias on the camera port, and the set-camera-IP step that follows it, are therefore **required functions**. The earlier recommendation of fork F-4 to drop them is **overruled**. While this amendment was being written the user also ruled the home and the data: **U7** (`decisions/decisions.md:18`): "tafsiran kamu terkait fungsi itu benar, tempat fungsinya diadaptasikan ke core (poin 1)", so the functions are adapted **into the Core**; **U8** (`decisions/decisions.md:19`): "database kita perlu diadaptasi untuk menyimpan kebutuhan data tambahan sesuai input-av", so the data these and the other ported functions need gets a place in the Core's schema. The schema itself is designed in `masterplan/03_db_schema_extension.md` by another row (not present when this amendment was written); this document only lists the data items. Design only: no source file was modified and nothing was run (U3, U5). What changed in this document, exactly:
>
> 1. **Fork F-4**: the home of the network commissioning group (alias H-29, scan H-30, set IP H-31, wizard order H-32) is stated as the user's **decision** (Core), not as a recommendation; the two table rows for these tools re-worded; the closing "Consequence" paragraph replaced; four new subsections: F-4.1 installation knowledge with `file:line` and what ran on real hardware, F-4.2 the design of the Core commissioning function (rules DR-1 to DR-12) with one "not chosen" note each for (b) a record-free standalone tool and (c) input-av as built as an interim, F-4.3 the task-3 rulings that must be amended, F-4.4 security notes for row 13. The recommendation for the doctor and for gain calibration is unchanged.
> 1a. **Section 4**: a new last table, "Data that needs a persistent home in the Core schema (U8)", per seam and function with the input-av source line, pointing to `masterplan/03_db_schema_extension.md`. Change item S3-3 and the gain line of fork F-4 re-worded from "no place" to "gets a place in the Core schema (U8)".
> 2. **Section 2**: one row added (what of the commissioning path ran on real hardware).
> 3. **Section 3.2**: the Q10 row split; H-29 to H-32 are now "required by U6, home decided by U7: the Core"; H-28 (passive cable monitor) is marked "not ruled".
> 4. **Section 4, S2**: change items S2-3 to S2-6 added.
> 5. **Fork F-5**: one paragraph that separates the commissioning scan from the camera search.
> 6. **Section 8**: fate of `apps/input-av` re-worded for the three homes.
> 7. **Section 9**: **WP-19 re-scoped** (alias helper and factory-address scan); **WP-14 extended** by one clause (helper installation, `arping`); **WP-22 added** (set camera IP with the credential path and the wait by MAC); **WP-23 added** (audit types, stored commissioning settings, permission). No package renumbered. Coverage check, hardware list and experiment list updated (E-13 to E-15 added).
> 8. **Section 10**: impact items I-13 to I-16 added; I-12 extended.
> 9. **Section 12**: four risks, hypotheses H-S to H-W and two "not examined" items added. **Section 13**: lines re-opened for this amendment. **Section 14**: counts updated (23 work packages; 4 of 4 U6 items placed).
> 10. Indonesian summary, frame table and section 1: counts and item (4) aligned.

> **Ringkasan (Bahasa Indonesia).** Dokumen ini adalah desain target porting, bukan implementasi: tidak ada kode yang diubah (U3). Isinya: logika input-av mana yang mendarat di seam mana (S1-S6), perubahan kontrak / skema / protokol / worker yang dibutuhkan beserta berkas dan baris kode hari ini, semua "pin" aturan kelas C beserta syarat dan urutan pencabutannya, delapan persimpangan desain dengan rekomendasi, dan 23 paket kerja (WP-01..WP-23; WP-22 dan WP-23 ditambahkan oleh Amandemen 1). Rekomendasi utama: (1) kamera ditarik oleh **program relay kecil** di depan worker yang tidak diubah, kredensial lewat pesan awal di standard input, bukan lewat argumen; pilihan ini membuka kembali temuan keamanan SEC35-40 dan hanya boleh dipakai dengan jawaban yang diterima row 13; (2) **H.265 belum terbukti** lewat worker: satu percobaan di host pengembangan dengan perangkat palsu (WP-01) menentukan apakah H.265 itu parameter atau proyek; cadangannya tanpa kode adalah mengatur kamera ke H.264; (3) bentuk bukti yang DISIMPAN tetap milik Core (fMP4 + AAC mono), dengan harga yang harus diterima secara sadar: audio tidak lossless dan **mikrofon cadangan tidak terekam**; tambahan trek lossless per mikrofon bisa diputuskan terpisah; (4) keempat alat instalasi input-av tidak memenuhi C13 apa adanya. **Diubah oleh Amandemen 1 (U6):** scan IP pabrik dengan alias IP sementara dan langkah ubah IP kamera adalah fungsi yang WAJIB ada, dan pengguna memutuskan (U7) tempatnya: diadaptasikan ke Core sebagai fungsi komisioning (helper ber-hak khusus yang sempit, tercatat di rantai audit Core, kredensial kamera diketik di konsol web dan tidak disimpan oleh fungsi ini, hanya Linux). Sebelum dibangun, putusan D75, D80(1), D80(10) dan D81 tugas 3 harus diubah oleh pengguna dan row 13 menilai helper tersebut. Alat mandiri tanpa catatan dan pemakaian input-av apa adanya tidak dipilih. Data tambahan yang dibutuhkan mendapat tempat di skema Core (U8; desainnya di `masterplan/03_db_schema_extension.md`). Pemeriksaan host dan uji level pra-sesi tetap dipindah ke Core; pengaturan gain tetap ditunda; (5) satu ruangan per Core, host produksi Linux, data lama dibiarkan sebagai arsip terpisah yang tidak ditulis. Yang terbukti di perangkat nyata hanya skema kamera input-av pada empat kamera H.265 selama 54-57 detik; tidak ada satu pun bagian jalur Core yang pernah berjalan dengan kamera atau kartu suara nyata. WP-08, WP-14, WP-15, dan sejak Amandemen 1 juga WP-19 dan WP-22, membutuhkan host Linux dengan perangkat nyata. Pemindahan tiga kamera Tiandy dari 192.168.1.x ke 192.168.100.x pada 2026-10-12 tercatat hasilnya, tetapi dokumen tidak mencatat dengan alat apa pemindahan itu dilakukan.

## 0. Frame (5W1H) and reading rules

| Question | Answer |
|---|---|
| **What** | The target design of the port: mapping of the 14 adopted logic items and the 44 parameters that are not accepted today onto seams S1-S6; the change items per seam; the default parameters of the production adapters (C11); eight design forks, each led by its recommendation; every pin of the class-C opener rule with a lift condition; 23 work packages (21 of the first issue, WP-22 and WP-23 of Amendment 1); an impact section with a rollback per change item. |
| **Why** | U1 narrowed the task to porting, U2 made the input-av input scheme the default because it is the tested one (`decisions/decisions.md:7-8`). Row 7 showed that the two systems have opposite plumbing: input-av dials the device and writes a file, the Core's worker listens on loopback and reads named pipes (`research/03_analysis.md:59`). A port therefore builds feeding parts behind two contract members, and this document says which parts, where, and what must be proven first. |
| **Who** | Decision owner for every fork and open entry: the user. Consumers: row 9 (decision register), row 10 (phased plan), rows 11-13 (verification, soundness, security). |
| **When** | Written 2026-10-12, wave 3. Line numbers are of the working tree of that day, which holds uncommitted changes. |
| **Where** | Target: `apps/core-server/src/capture/adapters/`, `apps/core-server/src/capture-session/`, `apps/core-server/src/modules/capture-discovery/`, `packages/capture-protocol/`, `packages/shared/`, `apps/capture-worker/`. Source: `apps/input-av/nvr/`. |
| **How** | Synthesis of rows 1, 2, 5, 6, 7. Lines that carry a design statement were re-opened read-only (list in section 13). No build, test, worker, FFmpeg or input-av run. No source file modified. Nothing under `apps/input-av/data/` and no `.env` opened. Every change named below is a **statement of future work**. |

**Abbreviations.** `ADP` = `apps/core-server/src/capture/adapters`; `WRK` = `apps/capture-worker/src`; `PROTO` = `packages/capture-protocol/src/index.ts`; `SHARED` = `packages/shared/src/api/capture.ts`; `IAV` = `apps/input-av`; `T3` = `docs/2026-10-07_dems_real_capture_sealing`; `R1`, `R2`, `R5`, `R6`, `R7` = the row documents `research/01_explore_input_av.md`, `01_explore_core.md`, `02_collection_rulings.md`, `03_analysis_record_map.md`, `03_analysis.md`.

**Two identifier clashes, resolved here.** Row 7 names gaps G-1 to G-5 and row 6 names gaps G-1 to G-6. In this document `A/G-n` is a gap of row 7 (`R7` section 8) and `M/G-n` is a gap of row 6 (`R6` section 6). Row 7 uses "Variant A / B" for the camera fork; this document calls that fork F-1 and keeps the letters.

**Hypotheses.** A statement that no source line or run supports is marked HYPOTHESIS, numbered H-F onward (H-A to H-E are row 7's), and names the experiment that settles it. Statements about how the FFmpeg libraries behave are hypotheses throughout: none was run and no external source was consulted.

**Graft.** A `graft/` graph exists. It was not queried: the graph refreshes itself before each query, which writes outside the task folder, and this row may not. Blast radius is taken from row 2's complete search of the opener identifier and from read-only searches listed in section 13.

## 1. The design in one page

The Core keeps its shape. One worker per session listens on loopback for pushed RTSP and reads microphones from named pipes; adapters in the Core process start whatever feeds those two doors (`ADP/types.ts:120-123,139-140`). The port fills the two production adapters that refuse today (`ADP/camera/onvif-rtsp.ts:23-38`, `ADP/audio/usb-audio.ts:17-29`):

1. **Camera (S1).** `openSource` starts a new small program, the **pull relay**, through a process door. The relay receives the stream locator and the credential in a start message on its standard input, pulls the camera over RTSP/TCP with stream copy, and pushes to the plan's loopback `ingestUrl`. The worker, the plan and the protocol are unchanged for H.264.
2. **Audio (S3, S4).** `enumerate` reads the ALSA cards; `open` generates the shared-capture configuration and prepares the existing named pipe; the helper is the FFmpeg command-line program with a Linux argument table (no credential is involved): all native channels opened, one input selected, 24-bit request, converted to 32-bit float at the pipe.
3. **What is stored** stays the Core's: one fMP4 per camera with the video copied and one AAC-LC mono track of the active microphone (recommendation of fork F-3; the user decides, entry Q8).
4. **Before anything is called a default,** one experiment on the development host settles whether the worker carries HEVC at all (WP-01).
5. **Nothing records in `REAL_PRODUCTION` until one change set lifts the opener rule for both kinds together** (WP-13), after the conditions of section 6.

What the port does **not** carry from the tested scheme, each with its reason: the credential inside the URL and the argument list (forbidden, `ADP/credential.ts:117-125`); camera audio (dropped by the worker at `WRK/ingest.c:541`, never observed on the bench); the automatic "first USB card" source (it moved two microphones to another card unnoticed, `IAV/docs/SERAH-TERIMA.md:189-193`); the ARP and ping fallbacks of discovery (forbidden by D80(1) and D80(10), fork F-5); a new file per reconnect (no place in the Core's track key, `R6` FG-07). These five departures belong in the P3 confirmation request of row 9.

**Added by Amendment 1 (U6).** One function that is not a recording path is carried as well: **network commissioning** of a factory-new camera (temporary alias on the camera port, scan of factory addresses, set camera IP, wait for the camera by MAC). It is an operator action outside any session, it is not part of the camera search of fork F-5, and its home is fork F-4.

## 2. What is proven on real hardware, and what is not

Scope of "tested" as row 1 found it (`R1` section 4.12) set against the target path.

| Part | Proven on real hardware | Proven on doubles or by logic only | Not proven anywhere |
|---|---|---|---|
| ONVIF registration, profile read, stream address | input-av: 1 UNIVIEW IPC312LP and 3 Tiandy TC-C320N (`SERAH-TERIMA.md:79-80,122-124`) | Core connect flow: loopback fixtures only (`T3/identification/02_structured.md:562`) | Core connect flow against a real camera (E-3) |
| Camera record, RTSP/TCP, stream copy, H.265 | input-av: four rooms at once, one recording of 54-57 s each, hashes matching (`SERAH-TERIMA.md:122-124`) | H.264 through the Core worker: generated sources and fixtures (`R2` section 11) | **HEVC through the Core worker** (`R7` Finding 3); any real camera through the Core worker (`T3` README:396,775 via `R5` 8.14) |
| Camera wall clock within 2,000 ms | nothing: input-av never used it (`R7` Finding 4) | worker anchoring on a fixture with sender reports (`WRK/ingest.c:51-57`) | the bench cameras' clocks (E-4) |
| Reconnect after stream loss | nothing (`IAV/README.md:206-209`) | input-av logic | on both systems |
| Camera audio, dual-lens, 8 cameras, A/V sync | nothing (`SERAH-TERIMA.md:165-173`) | 8 rooms with virtual H.264 cameras (`SERAH-TERIMA.md:107`) | all four |
| ALSA shared capture, all channels opened, input selected | Audient EVO 8: recognised, four parallel record processes, **recordings practically silent** (`SERAH-TERIMA.md:126,187-188`) | bit-exact input separation on the onboard laptop card (`SERAH-TERIMA.md:107,112`) | audible, level-checked content from the USB interface; more than two inputs in one source; an 8-input interface |
| ALSA capture into the Core's microphone pipe | nothing | nothing | placement by arrival from `dsnoop` (H-D, E-5) |
| Network commissioning: alias, factory-address scan, set camera IP (Amendment 1) | input-av bench, **outcome only**: three Tiandy TC-C320N moved from 192.168.1.10, .12, .11 to 192.168.100.101 to .103 and registered on 2026-10-12, 15:12 to 15:16 WIB (`SERAH-TERIMA.md:80,157-158`). The documents do not say by which path (HYPOTHESIS H-W, fork F-4.1) | the input-av code path as read (fork F-4.1) | the same function in the Core; two cameras on one factory address; alias expiry and cleanup after a crash; the `arping` conflict check; DHCP mode; any camera of the four vendors in the default list at its listed address |
| Known defects of the tested audio scheme | full-scale first sample on the EVO 8; loopback inputs 5-6 offered as microphones; automatic source moved two microphones (`SERAH-TERIMA.md:177-193`) | - | whether the Core's pre-check short open absorbs the first-sample defect (H-O) |

Reading for the decision maker: the **camera input scheme is field-tested, for under a minute per camera, inside input-av's plumbing**. The **audio input scheme is logic-tested**. **No part of the target path has run on real hardware.** A work package below is therefore never classed "tested"; its verification column says what proves it.

## 3. Mapping: which logic lands where

### 3.1 The 14 adopted items

| Item (`R7` section 5) | Seam | Contract member or part it fills | Today (file:line) | WP |
|---|---|---|---|---|
| H-03 one channel per video source; largest pixel area is the record stream | S1 (carrier in S5) | `profiles(deviceId)`, `testConnection` result; plan `profile` | no width, height or source token read: `ADP/camera/onvif-session.ts:212-225`; first profile only: `:480`; plan carrier exists: `PROTO:526` | WP-04 |
| H-05 `GetStreamUri`, credential-free locator | S1 | `pullUrl(deviceId, profile)` with `streamLocator` | stub refuses: `ADP/camera/onvif-rtsp.ts:35`; locator rule: `ADP/credential.ts:105-108` | WP-04 |
| H-11 locator resolved at each open | S1 | `pullUrl` called inside `openSource`, never stored at adoption | address compared and dropped: `onvif-session.ts:227-240,479` | WP-04 |
| H-07 camera record, input half (TCP, copy, first video stream, timeout) | S1 | the pull relay started by `openSource` | `openSource` refuses: `onvif-rtsp.ts:31-33`; worker only listens: `WRK/ingest.c:482-484` | WP-03 |
| H-08 no feeding process outlives the Core | S1 (used by S3) | production helper door | door closes standard input: `ADP/local/process-door.ts:96`; kill on exit: `:15` | WP-02 |
| H-35 stream test over TCP | S1 | `testConnection`, second half: relay in probe mode | "No RTSP connection is opened": `onvif-session.ts:11-13` | WP-05 |
| H-10 reconnect rule | S1 | relay re-opens the camera and keeps its push session | helper never restarted: `ADP/local/camera-helper.ts:22`; ingest ends on teardown: `WRK/ingest.c:540` | WP-06 |
| H-26 heartbeat for adopted cameras | S1 | adapter extras `presence`, `precheck` (pattern: `ADP/local/camera-adapter.ts:45-54`) | no presence member in the contract: `ADP/types.ts:125-146` | WP-06 |
| H-13 sound card enumeration | S3 | `enumerate()` | stub throws: `ADP/audio/usb-audio.ts:23` | WP-07 |
| H-14 refusal when an input exceeds the card; card identity | S3 | `AudioInputDescriptor.errorCode`; session facts | no such code: `ADP/types.ts:171-186` | WP-07 |
| H-18 allocation rules, one-room form | S3 | `assertAssignable` and `open` | duplicate checks exist in the plan: `PROTO:561-593` | WP-07 |
| H-22 hot-plug detection | S3 | `enumerate()` behind operation 97 | module not in the app's unit list (`R2` supporting units) | WP-07 |
| H-15 shared-capture ALSA configuration | S3 | `open`, before the helper starts | no ALSA code anywhere (`R2` section 7) | WP-08 |
| H-16 open all channels, select by `pan` | S3 (feeds S4) | helper argument table | input pinned to `-f avfoundation`: `ADP/local/mic-helper-args.ts:58` | WP-08 |

Seam S2 receives no adopted item: its one candidate, H-25, is held by entry NEW-1 (fork F-5). Seam S4 needs no change under the recommended stored form. Seam S5 needs no change under the recommended forks: the plan and protocol version 4 stand (`PROTO:141`). Seam S6 receives proof work first (WP-01) and code only if the proof demands it (WP-10, WP-11).

### 3.2 Items not adopted, and where each goes

| Verdict | Items | Treatment here |
|---|---|---|
| ALREADY_IN_CORE | H-01, H-06, H-12, H-24, H-27 | No work package. H-01's behaviour on a real camera is part of E-3 (WP-15). |
| ALREADY_IN_CORE, low confidence | H-37 disk protection | **Not confirmed.** A read-only search of `apps/core-server/src` and `apps/capture-worker/src` for `STORAGE_LOW`, `STORAGE_FULL`, `ENOSPC` found the two fault names only in the value set (`db/schema/value-sets.ts:67-68`) and in the simulator (`packages/shared/src/sim/faults.ts:38-39`); in real capture the worker truncates a failed write back (`WRK/sink.c:29,384`). HYPOTHESIS H-P: no free-space threshold stops a real session in mid-recording. It is not hardware input logic, so it is outside U1; it is reported as a Core gap for the controller, not given a work package. |
| NOT_NEEDED | H-02, H-04, H-23, H-33, H-36 | H-36 (sleep inhibitor, time sync) becomes a line of the host profile, WP-14. |
| BLOCKED_BY_DECISION, Q8 | H-09, H-17, H-34 | WP-16, built only if Q8 is not answered "as the Core stores". |
| BLOCKED_BY_DECISION, Q10 | H-19, H-20, H-21, H-38 | WP-18, WP-20; fork F-4 (unchanged by Amendment 1). |
| **REQUIRED by ruling U6; home DECIDED by U7: the Core** (was BLOCKED_BY_DECISION, Q10) | H-29 temporary alias, H-30 factory-address scan, H-31 set camera IP, H-32 wizard order and next free address | The function is no longer a candidate for "drop" and is no longer blocked by Q10. It is a commissioning function of the Core: H-29 and H-30 in WP-19, H-31 and H-32 in WP-22, their audit types, settings and permission in WP-23; fork F-4. Not carried from H-32 under any home: the wizard's registration step with its plain-text credential (`IAV/nvr/registration.py:62-64`); registration is the Core's adoption. Blocked by the rulings of fork F-4.3, not by Q10. |
| NOT RULED (was BLOCKED_BY_DECISION, Q10) | H-28 passive cable monitor (`tcpdump` as root) | U6 names the alias; it does not name the passive monitor. Not carried and no work package, unless the user extends U6 (fork F-4.3, point 7). Its relevance is stated in fork F-4.1, row 2. |
| BLOCKED_BY_DECISION, NEW-1 | H-25 | WP-12; fork F-5. |

## 4. Change items per seam

Every row is future work. "Today" is the code as it stands.

### S1. ONVIF_RTSP camera adapter

| # | Change | File it would touch, with today's line | WP |
|---|---|---|---|
| S1-1 | New program `capture-relay`: libavformat RTSP client in, RTSP/TCP push out, start message on standard input, probe mode | new source beside the worker; build target in `apps/capture-worker/Makefile` (targets today at `:54-155`); same library pin as the worker (`WRK/ingest.c:58-59`) | WP-03 |
| S1-2 | A process door that writes one start message to the child's standard input, then closes it; environment handed over explicitly; children killed when the Core exits | today `stdio: ['ignore', 'pipe', 'pipe']` at `ADP/local/process-door.ts:96`; 13 files import the local door, so the production door is a second pinned file by the precedent of D95 (`process-door.ts:5-8`), not an edit of this one | WP-02 |
| S1-3 | `profiles(deviceId)` returns one entry per video source, the largest pixel area first; reads width, height and the source token | `ADP/camera/onvif-session.ts:207-225`; `MediaProfile` has `code` and `codec` only: `ADP/types.ts:108-112` (pinned by `ADP/__tests__/static.test.ts:266-274`) | WP-04 |
| S1-4 | `pullUrl` returns the credential-free locator of a profile, resolved at each open | `ADP/camera/onvif-rtsp.ts:35`; `ADP/credential.ts:82-108` | WP-04 |
| S1-5 | `testConnection` gains a stream-level half: codec, size, parameter sets present, first keyframe, clock offset, read from the stream by the relay in probe mode | `ADP/camera/onvif-session.ts:11-13,477-493`; result type `ADP/types.ts:100-106` | WP-05 |
| S1-6 | Connection-test vocabulary: the codec verdict moves from the ONVIF answer to the stream; `usableProfiles` is no longer filtered to H.264. **Additive**: `NOT_H264` stays in the value set for a camera whose stream is neither H.264 nor HEVC, because 17 files across the server, the web console and the shared package name it (search in section 13) | `ADP/types.ts:90-97`; `onvif-session.ts:222,491-492`; `packages/shared/src/api/capture-discovery.ts`; `apps/core-web/src/features/devices/camera-connect.ts`; tests `ADP/camera/__tests__/onvif-session.test.ts:170,200`, `modules/capture-discovery/connect/__tests__/connect.db.test.ts:313` | WP-05 |
| S1-7 | `openSource` builds the start message at `credentialAtInjection` and starts the relay; the first caller of that function | `ADP/credential.ts:122-125`; static test "no caller in the product yet": `ADP/__tests__/static.test.ts:121-125` | WP-06 |
| S1-8 | Loss, retry and presence: retry after 2 s, then 2, 4, 8, 16, 30 s while no data; `onSourceLost`; presence by TCP reachability of an adopted camera | pattern `ADP/local/camera-adapter.ts:42,45-54,86-89`; nothing for production | WP-06 |
| S1-9 | `ntpOffsetMs` answers the camera clock minus the Core clock from the device time the test already reads | `ADP/types.ts:145`; read at `onvif-session.ts:450-451`; consumed at `capture-session/index.ts:1143-1153` (`R2`) | WP-06 |
| S1-10 | Audit writers for the class-C types on this path: `FAULT_RAISED` / `FAULT_CLEARED` for `CAMERA_LOSS`, `CAPTURE_DEVICE_UNREACHABLE` | types exist (`R6` A05, A06, A14); detail keys are a closed list at `apps/core-server/src/core/audit-details.ts:334,362-366`, **not read in full** | WP-06 |

### S2. Camera discovery

| # | Change | File, today's line | WP |
|---|---|---|---|
| S2-1 | None for the recording path. In `REAL_PRODUCTION` the full adapter's `discover` delegates to the built probe | `ADP/camera/ws-discovery.ts`; `ADP/camera/onvif-discovery.ts:32-53` | WP-13 (registration only) |
| S2-2 | Held by NEW-1: a unicast probe to an operator-typed address; an operator-confirmed change of a registered camera's address with an audit type | `DiscoverySearch` has no address member: `ADP/types.ts:53-58`; operation 93 takes no body: `modules/capture-discovery/routes.ts:14-16`; missing audit type: `R6` M/G-3 | WP-12 |
| S2-3 (Amendment 1) | A root-owned alias helper on the Linux host and its one caller in the Core: add and remove one private `/24` address on the configured camera interface, with a conflict check and an expiry that does not depend on the Core staying alive | no code in the Core changes a host address today (`R6` A41: "No audit type for a change of the host's own network addresses"); source `IAV/scripts/dems-netalias:16-46`, `IAV/nvr/netalias.py:36-134` | WP-19 |
| S2-4 (Amendment 1) | A commissioning scan operation, separate from operation 93: for each configured factory address, a unicast probe from the alias address, a reachability check and the unauthenticated ONVIF time read; the result is a list shown to the operator and is not stored (RG-4) | operation 93 takes no body and uses probe answers only: `modules/capture-discovery/routes.ts:14-16`; D80(1), D80(10) (`R5` 7.1); source `IAV/nvr/factory.py:40-79` | WP-19 |
| S2-5 (Amendment 1) | A set-camera-network operation in a pinned file of its own: `GetNetworkInterfaces`, `SetNetworkInterfaces`, `SetNetworkDefaultGateway`, `SystemReboot`, then a wait for the same MAC at the new address. The credential arrives in the request body, lives for the job and is never stored by this operation | the connection file states "No configuration call exists here: no clock, GOP, profile or network set, no reboot" (`ADP/camera/onvif-session.ts:11-13`, quoted in `R5` 8.11), and that file is left as it is; the `onvif` package the Core already uses (0.8.3) contains the four calls (`node_modules/onvif/lib/device.js:230,263,373`, `lib/cam.js:1165`: presence read, behaviour not run); source `IAV/nvr/onvif_client.py:200-230`, `IAV/nvr/factory.py:146-186` | WP-22 |
| S2-6 (Amendment 1) | Audit types for the five network-changing actions (`R6` M/G-4) and for a changed address of a registered camera (M/G-3); a persistent home for the camera interface and subnet (M/G-2), the commissioning parameters (`R6` T10a-5) and the alias state (`R6` T10c), designed in `masterplan/03_db_schema_extension.md` (U8), not here; a permission for the function | the audit writer rejects an unknown type (`apps/core-server/src/core/audit-writer.ts:198-199` via `R6` section 6); 67 types, none for these actions (`VOC:346-435` via `R6`); permissions today: `packages/shared/src/sim/vocabulary.ts:30,40-42` | WP-23 |

### S3. USB_AUDIO adapter

| # | Change | File, today's line | WP |
|---|---|---|---|
| S3-1 | `enumerate()`: cards, native channel count, native formats, stable card identity; no automatic choice | `ADP/audio/usb-audio.ts:23` | WP-07 |
| S3-2 | New named error for "input beyond the card" | five codes today: `ADP/types.ts:171-186` | WP-07 |
| S3-3 | Where a microphone's card identity and input number are stored. `capture_devices` has no such column (`apps/core-server/src/db/schema/capture.ts:38-57`; `R6` FG-04). **Amendment 1 (U8): this gets a place in the Core schema**, designed in `masterplan/03_db_schema_extension.md`. The first issue's proposal (card identity and input number carried in the existing `address` text column, to avoid a migration) is withdrawn as the default and remains only a fallback | `db/schema/capture.ts:46` | WP-07 |
| S3-4 | `open()`: generate the `dsnoop` plus `plug` configuration per card into the Core's run directory, one generator per host (`R6` risk R-5); prepare the named pipe; hand `ALSA_CONFIG_PATH` to the helper explicitly | door environment is empty unless handed over: `ADP/local/process-door.ts:11,34-35` | WP-08 |
| S3-5 | A Linux helper argument table beside the macOS one: `-f alsa`, `-channels <native>`, `-sample_rate 48000`, the 24-bit request, `-thread_queue_size 1024`, `pan=mono\|c0=c<k>`, then the pipe's output line unchanged | macOS table `ADP/local/mic-helper-args.ts:58,71,165-172` | WP-08 |
| S3-6 | `level()` answers the worker's telemetry value, as the local adapter does; pre-check short open for a registered input | `ADP/local/mic-adapter.ts:114-117`; `ADP/audio/usb-audio.ts:27` | WP-08 |
| S3-7 | Audit writers for `MIC_NO_SIGNAL` faults and unreachable inputs; card identity in the session's source facts (`R6` FG-09, A26, A27) | closed detail lists, as S1-10 | WP-07 |

### S4. Mic transport

| # | Change | File, today's line | WP |
|---|---|---|---|
| S4-1 | None in code under the recommended stored form: `PCM_FIFO`, 32-bit float, 48,000 Hz, one channel stays the one transport | `PROTO:326-333`; `ADP/mic-transport.ts:45-73` | WP-09 |
| S4-2 | The statement's header says a real USB transport "is class C-4 and is not built" (`ADP/mic-transport.ts:7-10`): an erratum at the lift, not a behaviour change | as left | WP-13 |
| S4-3 | A unit check that every 24-bit value survives the conversion to 32-bit float (E-6) | new test | WP-09 |

### S5. Capture plan

No change under F-1 variant A with F-3 variant C. The plan's `profile` string (`PROTO:526`) starts to carry the chosen ONVIF profile token; nothing else moves. Changes arise only under another fork answer: F-1 variant B (a camera input union, protocol version above 4), F-3 variant I or M (audio output paths, track list), Q6 several rooms (session and worker limits). They are named in the fork sections.

### S6. Capture worker

| # | Change | File, today's line | WP |
|---|---|---|---|
| S6-1 | Proof first, no product code: an HEVC fixture and three runs (E-1, E-2, E-10) | fixtures are H.264 only: `apps/capture-worker/test-fixtures/fake_cam_sr.py:48-54,165` (`R2`) | WP-01 |
| S6-2 | Only if E-1 demands it: the sample-entry name of an HEVC track (H-G); the Core reader's frame rate for HEVC | `codec_tag = 0`: `WRK/ingest.c:362`; reader `apps/core-server/src/capture/fragments.ts:541-546` ("open item of fix 151") | WP-10 |
| S6-3 | Only if E-10 fails: the ingest accepts a resumed push after a gap | `WRK/ingest.c:540` ("one session by design") | WP-11 |

### Data that needs a persistent home in the Core schema (Amendment 1, U8)

U8 (`decisions/decisions.md:19`) rules that the Core database is adapted to hold the additional data the input-av functions need. **The schema is not designed here**: tables, columns, keys and migrations are the subject of `masterplan/03_db_schema_extension.md`. This table only lists the data items, per seam and ported function, with their input-av source. "Record map" names the line of `R6`; where that line reads DROPPED or "no home" only because the Core has no place for the item, it now reads **"gets a place in the Core schema (U8)"**. Where it was dropped for another reason (a ruling, or a function that is not ported), the reason is named and the item is listed for the schema design to judge, not assumed.

| Seam / function | Data item | input-av source | Record map; state in the Core today | Note |
|---|---|---|---|---|
| S1 camera | Camera MAC | `nvr/db.py:85`; `nvr/registration.py:47-49` | `capture_devices.mac` exists (`R6` X05) | Needed by DR-10; confirm, nothing new expected |
| S1 camera | ONVIF port; device information | `nvr/db.py:75,80`; `nvr/registration.py:43-46,66` | T04a | - |
| S1 camera | Device group, lens number, video source token (one physical camera, several channels) | `nvr/db.py:82-87`; `nvr/registration.py:59-69` | FG-01: gets a place (U8) | Used by WP-04 (H-03) |
| S1 camera | Record-stream choice (main or sub), chosen profile token | `nvr/db.py:78,93-102` | FG-02; `capture_config.video_0n_profile` holds the profile | Used by WP-04 |
| S1 camera | PoE port number, typed by the installer | `nvr/db.py:95-96` | not in the record map as a field; gets a place (U8) | Empty for all four bench cameras (`docs/SERAH-TERIMA.md:154`) |
| S1 camera | Result of the last stream test | `nvr/routers/admin.py:416-424` | FG-03: the Core audits each test and stores no last result | Schema design decides |
| S2 discovery, commissioning | Camera interface and camera subnet | `nvr/settings.py:40-42` | T10a-3, M/G-2: gets a place (U8) | Read by DR-2 (through the root-owned file), DR-4, WP-19 |
| S2 commissioning | Factory default address list; alias octet; alias lifetime in minutes; first address for new cameras | `nvr/settings.py:55-62,69-78` | T10a-5: gets a place (U8) | WP-19, WP-22 |
| S2 commissioning | Temporary aliases in place (interface, address, added at) | `nvr/netalias.py:21,57-70,96-99` | T10c: gets a place (U8) | Smaller if H-S holds (DR-3) |
| S2 commissioning | Commissioning job: steps and result | `nvr/factory.py:134,139-140,150-151` (memory only in input-av) | none | Schema design decides whether a job is stored beyond its audit entries |
| S2 discovery | Discovered-device rows: key, MAC, address, vendor, interface, ONVIF facts, status, first and last seen | `nvr/db.py:182-198`; writer `nvr/discovery.py:603-624` | T09: dropped **by ruling** (RG-4, D76 (1)), not for lack of a place | A place under U8 needs the ruling of F-4.3 point 6 |
| S2 discovery | Search scope, interval, offline-after, follow-by-MAC flag | `nvr/settings.py:45-49` | T10a-4: contract constants fixed by D91 | Listed for completeness; the follow flag is not carried (DR-10) |
| S3 audio | Audio source: device, selected inputs, device channels, sample rate, bit depth | `nvr/routers/audio.py:20-26,192-195` | FG-04: gets a place (U8); change item S3-3 | WP-07 |
| S3 audio | A/V offset per audio source | `nvr/routers/audio.py:32-33,195` | FG-05: gets a place (U8) | Applied by input-av only in the playback copy, which is not ported |
| S3 audio | Capture gain | not stored by input-av; set at `nvr/audio.py:178-185`, traced only by the audit at `nvr/routers/audio.py:77` | A50, M/G-5 | Function still Q10 (WP-18); the bench lost the setting on re-plug (`docs/SERAH-TERIMA.md:94-98`) |
| S3 audio, session | Audio device identity per session: card, product, USB identifier, channels, inputs | `nvr/service.py:42-61,141-147` | FG-09: gets a place (U8) | WP-07 (S3-7) |
| Site | Site code, name, address, deployment mode; site snapshot on the session | `nvr/settings.py:21-27`; `nvr/db.py:120-141` via `R6` | T10a-1, FG-06: `site_address`, `deployment_mode` and the snapshot get a place (U8) | - |
| Site | Capacity limits: camera devices, lenses per device, audio inputs offered | `nvr/settings.py:31-37` | T10a-2: fixed by the Core's four slots, not by a missing place | Tied to Q6 |
| Site | Installation acceptance: who, when, diagnostics | `nvr/commissioning.py:79-96` via `R6` | T10b, M/G-1: gets a place (U8) | The acceptance gate itself is still Q10 |
| S6, stored form | Part number per reconnect; estimated media start | `nvr/db.py:144-169` via `R6` | FG-07, FG-08 | Follows fork F-3, not U8 alone: under variant C a reconnect is a gap in one track |

Not listed because they do not move: users, tokens, the input-av audit chain, plain-text camera credentials (`R6` T01, T02, T11, T04c). The count of record kinds with two owners stays 0.

## 5. Default parameters of the production adapters (C11)

Values are row 1's quotations from the source, not P3's wording. "Makes the Core accept it" names the change item.

| Parameter (input-av source) | Default in the port | Accepted today? | Makes the Core accept it |
|---|---|---|---|
| Profile choice: largest pixel area per video source (`IAV/nvr/onvif_client.py:248-249`) | same | no | S1-3 |
| RTSP over TCP toward the camera (`IAV/nvr/recorder.py:217`) | same, set by the relay | no part | S1-1 |
| Read timeout 5 s on the camera leg (`recorder.py:217`) | same, as the relay's input option | no part | S1-1 |
| First video stream, stream copy (`recorder.py:148-149`) | same; the relay forwards video only | yes on the loopback leg (`WRK/ingest.c:361,509`) | S1-1 |
| Codec as delivered: H.264 | accepted | yes | - |
| Codec as delivered: HEVC | **default only after WP-01 passes** | unproven | S6-1, then S6-2 if needed |
| Credential | start message on standard input; never URL, argument, environment or file | forbidden form in input-av | S1-2, S1-7 |
| Reconnect 2 s, then 2, 4, 8, 16, 30 s, no attempt limit (`IAV/nvr/service.py`, `R1` TS-5) | same rule; the result is a gap in the same track, not a new file | no | S1-8 |
| Timing | wall clock stamped by the relay at arrival on the Core host (fork F-1, sub-choice) | the worker requires a clock within 2,000 ms (`WRK/ingest.c:583-589`) | S1-1 |
| Camera audio (`recorder.py:148-149`) | not carried | dropped at `WRK/ingest.c:541` | - |
| ALSA `dsnoop` plus `plug` per card, `period_size 1024 buffer_size 8192` (`IAV/nvr/audio.py:463-488`) | same | no part; latency fit unproven (H-D) | S3-4; E-5 |
| All native channels opened, one input selected by `pan` (`recorder.py:104-116`) | same, one input per microphone role | transport accepts the result (`ADP/mic-transport.ts:67`) | S3-5 |
| 24-bit request, 48,000 Hz (`IAV/nvr/routers/audio.py:25-26`) | 24-bit capture, converted to 32-bit float at the pipe; 48,000 Hz | pipe carries float only (`ADP/mic-transport.ts:48`) | S3-5; E-6 |
| Automatic "first USB card" source (`IAV/nvr/audio.py:103-106`) | **not carried**: a microphone is a named card and input | - | S3-1 |

## 6. The class-C opener rule: every pin, its lift condition, and the order

### 6.1 Recommendation

Lift once, for `ONVIF_RTSP` and `USB_AUDIO` together, in one change set (WP-13), and only after the six conditions below. Reason for "together": a production session needs two production cameras and two production microphones of one source class (`apps/core-server/src/modules/capture-config/plan.ts:124,146-153`); with one kind listed, nothing becomes recordable and the rule is merely weaker. The conditions and the ruling are the user's (entry Q9); this section is a proposal.

### 6.2 Lift conditions (proposed)

| # | Condition | Evidence that closes it |
|---|---|---|
| L-1 | A decision row that amends D86 C-5 ("no listener and no session start for a source kind without an opener", `T3/decisions/decisions.md:99`) for the two kinds | the user's ruling, recorded |
| L-2 | The answer to SEC35-40 is built and accepted by the security review (fork F-1, measures SA-1 to SA-3) | row 13 of this task for the design; the test of WP-03 for the build |
| L-3 | The credential is shown never to reach an argument list, the environment, a log or a file | static test of the adapter layer plus the runtime check of WP-03 (E-12) |
| L-4 | The HEVC question has an outcome: WP-01 passed, or the H.264 fallback of fork F-2 is chosen | WP-01 report |
| L-5 | Both openers are complete on doubles: WP-02 to WP-09 | their verification columns |
| L-6 | A place to run it: a Linux host (Q7), and the two preconditions of any `REAL_PRODUCTION` Core that are **not** part of this port: a provisioned signing key and operators without the demonstration password (`T3` README:441 via `R5` 8.12; D241) | named as external dependencies X-1, X-2 in section 9 |

Two stages follow from L-6. **Stage 1, lift in code:** L-1 to L-5 hold; WP-13 lands; the hardware milestone (WP-15) can run. **Stage 2, declared recordable:** WP-15 has passed; the limits in the task 3 README and specification are withdrawn by erratum.

### 6.3 Pins

From row 2's complete search (`R2` section 3) and row 7's gap `A/G-2`. "Follows" means the behaviour changes with the list and the line is not edited.

| Pin | File:line | What it holds today | At the lift |
|---|---|---|---|
| The list | `ADP/registry.ts:36` | `[FAKE, LOCAL_DEVICE]` | **Edited:** both production kinds added. Condition: L-1 to L-5. |
| The refusal at registration | `ADP/registry.ts:82` | an adapter that states an opener for an unlisted kind is `CAPTURE_ADAPTER_INVALID` | Follows. Stays as the guard for `SNMP_POE` and any later kind. |
| Re-export | `ADP/index.ts:71` | - | No change. |
| Operation recordable | `apps/core-server/src/capture/fence/sources.ts:86` | `REAL_PRODUCTION` refused while no production kind is listed | Follows "without an edit" by its own comment (`sources.ts:80-81`). |
| No opener, no source row | `fence/sources.ts:106` | a slot needs `hasOpener === true` and a listed kind | Follows. Remains the answer to SEC35-40 (1) for an adapter without an opener. |
| Stub literal, camera | `ADP/camera/onvif-rtsp.ts:28` | `hasOpener: false` | **Replaced** by the built adapter. Condition: L-5. |
| Stub literal, microphone | `ADP/audio/usb-audio.ts:22` | `hasOpener: false` | **Replaced.** Condition: L-5. |
| Search-only adapter | `ADP/camera/onvif-discovery.ts:41` | `hasOpener: false` | **Kept.** It is what `REAL_DEVELOPMENT` registers for search and test; a production camera stays unassignable there by RG-3. |
| Production registry is empty | `fence/index.ts:319-329`; loader `ADP/real.ts:29-37` has no caller | no adapter in `REAL_PRODUCTION` | **Wired** (`A/G-1`): the boot calls the loader. Condition: L-5. |
| Test: the list | `ADP/__tests__/registry.test.ts:89` | `toEqual(['FAKE', 'LOCAL_DEVICE'])` | **Rewritten** to the four kinds. |
| Test: every listed kind is DEVELOPMENT | `registry.test.ts:90` | - | **Removed**, replaced by "the listed production kinds are exactly the two". |
| Test: production cannot state an opener | `registry.test.ts:91-99` | `CAPTURE_ADAPTER_INVALID`; `openerKinds()` is `[]`; not recordable | **Rewritten**: a production adapter with an opener registers; one without stays unrecordable. |
| Test: class-C files have no opener and import only three files | `ADP/__tests__/static.test.ts:95-101` | pattern `hasOpener: false,` | **Rewritten**: the two files leave the class-C list; `poe/snmp-poe.ts` stays. |
| Test: loader fences | `static.test.ts:63-93`; `ADP/__tests__/real.test.ts:15` | loader refused outside `REAL_PRODUCTION`; one file names the class-C files | **Kept**; the boot becomes the second permitted importer. |
| Test: the injection point has no caller | `static.test.ts:121-125` (`credentialAtInjection`) | callers equal `credential.ts` alone | **Rewritten**: exactly one caller, the file that starts the relay. Condition: L-3. |
| Test: fence | `capture/fence/__tests__/fence.test.ts:508-529` | production sets refused in both operations | **Rewritten** for `REAL_PRODUCTION`; kept for `REAL_DEVELOPMENT`. `:386` unchanged. |
| Test: plan builder | `modules/capture-config/__tests__/plan.test.ts:171-173,214` | nothing recordable in `REAL_PRODUCTION` | **Rewritten.** |
| Test: no listener without an opener | `capture-session/__tests__/session-capture.db.test.ts:432-445` | 409, no worker started | **Kept** (its registry states `hasOpener: false`); a twin with openers is added. |
| Tests unchanged | `ADP/local/__tests__/camera-helper.test.ts:532`; `ADP/__tests__/fakes.test.ts:206`; `ADP/camera/__tests__/ws-discovery.test.ts:402-410` | development and search-only behaviour | No change. |
| Database pairing check | `apps/core-server/src/db/schema/recording.ts:205-208`; `fence/sources.ts:66-71` | already admits `ONVIF_RTSP` and `USB_AUDIO` in their slots | No change. No migration. |
| Comments and documents | `ADP/registry.ts:29-35`; `ADP/types.ts:9-20`; `ADP/errors.ts:18,24,34`; `ADP/kinds.ts:67-70`; `T3/masterplan/05_capture_architecture_spec.md:227,636-644`; `T3/implementation/25_m4_adapters.md:21,55`; `T3` README:396,438,441-442,775 | "class C", "nothing is recordable in `REAL_PRODUCTION`" | **Errata** at stage 1 for code comments, at stage 2 for the README limits. |

## 7. Design forks

Each fork leads with the recommendation. Cost is S, M or L by the size rule of the blueprint (an L item must be split before it is planned).

### F-1. How a production camera reaches the worker (class C-2; `T3/.../05_capture_architecture_spec.md:636-644`)

**Recommendation: variant A, a pull relay in front of the unchanged worker, on condition that the answer to SEC35-40 below is accepted by row 13.** If it is not accepted, variant B is the fallback, not a hand-over to the FFmpeg command line.

| | A: pull relay (recommended) | B: pull input kind in the plan | C: a ready-made relay (MediaMTX) or the FFmpeg program |
|---|---|---|---|
| What | A small C program on the FFmpeg libraries the worker already links; started by `openSource`; pulls RTSP/TCP, pushes RTSP/TCP to `ingestUrl` | The worker dials the camera; `CapturePlanCamera` gets an input union; the credential travels in the worker's start message | A third-party process pulls and re-serves, or `ffmpeg -i <url>` pushes |
| Contract | none on `CameraSourceTarget { ingestUrl }` (`ADP/types.ts:120-123`); protocol version 4 stands | `PROTO:508-535` and the version change; `WRK/capture_worker.c:110-124`, `WRK/ingest.c:481-490,507` change; `openSource` changes meaning | none |
| Worker guarantee "listens on loopback, never dials out" (D82) | kept | lost: the process that writes both camera files and the audio also parses the camera network and holds a credential | kept |
| Fault isolation | a malformed camera stream ends one relay; the other camera and the audio continue | it ends the session's one worker | as A |
| Reconnect (H-10) | inside the relay, which keeps its push session open; the worker sees a gap (H-M, E-10) | the worker's ingest loop must reconnect: change at `WRK/ingest.c:540` | as A |
| HEVC parameter sets (R-2) | the relay announces only after it holds the parameter sets (H-F) | depends on the camera's own description and the worker's probe (H-F) | - |
| Timing (R-1) | the relay decides the clock; see the sub-choice | each camera sender report reaches the anchoring code as verified (`WRK/ingest.c:51-57`); needs camera clocks inside 2,000 ms | - |
| Security | **SEC35-40 returns**: a loopback listener exists in `REAL_PRODUCTION` | no listener; a new outbound surface in the worker | credential in a configuration file, an API call or an argument list: forbidden (`ADP/credential.ts:117-125`; spec A.6.3) |
| Ready-made (C8) | libavformat's RTSP client and RTSP muxer do the protocol work, in line with D82's "no hand-written RTSP client ... libavformat does it with the credential off the argument list" (`T3/decisions/decisions.md:95`). The hand-built part is glue of the worker's own kind ("a small C program against libavformat", `WRK/capture_worker.c:5`) | same libraries | ready-made, and excluded by the credential rule |
| Cost | M (WP-03) plus S (WP-02) | M in the worker plus M in the protocol and plan builder; re-verification of the anchoring | not available |

Why A over B: it leaves the one verified component alone, keeps reconnect and camera faults out of the process that holds the evidence, and matches the contract as written. Its price is the security finding, which is why the recommendation is conditional.

**Answer to SEC35-40 proposed for variant A** ("any local process could push into the unauthenticated loopback listener and be recorded and signed as PRODUCTION", `T3/decisions/decisions.md:99`):

| Measure | What it does | Status |
|---|---|---|
| SA-1 | A listener exists only for a session whose four slots resolved to adapters with an opener | built: `fence/sources.ts:105-106` |
| SA-2 | The ingest address carries a per-session random path element in place of today's predictable `/<sessionId>/<track>` (`capture-session/index.ts:1056`); the relay is the only other holder | future work in WP-06. HYPOTHESIS H-I: the worker's listener refuses a push addressed to another path; if it does not, SA-2 is a worker change. Experiment E-11 |
| SA-3 | The session counts a camera as open only when **its own relay** reports the push established. A connection the worker reports that no relay of the session owns ends that track as a capture fault; it is never sealed as that camera | future work in WP-06. Turns a successful race into a detected fault, because the listener takes one connection (`WRK/ingest.c:540`) |
| Residual | A process running as the Core's own user can read the plan and defeat SA-2; the microphone pipes have the same exposure (HYPOTHESIS H-Q: SEC35-40's text, not read here, covers the camera listener only) | for row 13; mitigated by host rules in WP-14 (single-purpose host, private run directory) |

**Sub-choice, the clock the worker sees.** Recommendation: the relay stamps arrival on the Core host, as the local helper does (`ADP/local/camera-helper-args.ts:105-110`), and the camera's own offset is reported through `ntpOffsetMs` as advice. Reason: recording then does not depend on a clock the Core may not set ("setting a camera clock is class C", `ADP/types.ts:144`); a camera with a wrong clock would otherwise end its ingest with `camera_clock_out_of_bound` (`WRK/ingest.c:583-589`). Cost, stated: the stored video time is arrival time, later than capture by the camera's encoding and network delay (unmeasured, as it was in input-av, `SERAH-TERIMA.md:165-168`). HYPOTHESIS H-J: with a fixed mapping, video runs on the camera's oscillator while audio is resampled onto the Core clock, so the two drift apart over a long session; experiment E-9 (a run of one to two hours, already class C-9 of task 3) measures it. If the drift is beyond tolerance the relay, not the worker, is the place to correct it.

### F-2. HEVC handling

**Recommendation: keep "the codec the camera delivers" as the target, and treat it as unproven until WP-01 has run. Run WP-01 before any other work package assumes H.265. The fallback that needs no code is to set the cameras to H.264 by hand.** Do not plan this as "remove the `NOT_H264` line".

| Option | What | Cost | Verdict |
|---|---|---|---|
| H1 | Copy HEVC into the Core's fMP4 | WP-01 (S, development host). Then possibly WP-10 (S to M) | **Recommended target** |
| H2 | The installer sets each camera's main stream to H.264 in the camera's own interface | no code; departs from U2's "as delivered"; higher bit rate for the same picture (HYPOTHESIS, not measured) | **Fallback**, also the interim state until WP-01 passes |
| H3 | Transcode to H.264 at ingest | breaks "copy-only (no re-encode)" (R-4, `T3/masterplan/01_specs.md:171-173`); processor load | Rejected |
| H4 | Store HEVC, derive an H.264 viewing copy marked "not evidence" | a new Core artifact with its own route, storage and audit (`R6` risk R-3) | Only if E-8 fails and H2 is refused |

**The experiment that settles it (WP-01, development host, fake devices, no hardware):**

| Run | Source pushed into the worker's listener | Pass when |
|---|---|---|
| E-1 | an HEVC RTSP/TCP stream with sender reports and parameter sets in its description | `ingest_connected` logs the HEVC codec with `extradata` above 0 (`WRK/ingest.c:525-526`); fragments are published; the Core reader reports `HEVC` (`apps/core-server/src/capture/fragments.ts:453-459`); the session seals and verifies. The sample-entry name (`hvc1` or `hev1`) is recorded |
| E-2 | the same without parameter sets in the description (in-band only) | a recorded file, or `INGEST_NO_EXTRADATA` (`WRK/ingest.c:512`). Either outcome is a result: the second one moves the duty to the relay (H-F) |
| E-8 | the sealed session of E-1 opened in the web console, the tablet and an export | each plays or states plainly that it cannot |

Hypotheses this settles: H-C (the pinned muxer writes a usable HEVC sample entry); H-F (the library's stream probe fills the parameter sets from in-band data, so E-2 passes); H-G (with `codec_tag = 0` at `WRK/ingest.c:362` the muxer names the track `hev1`, which some players refuse while accepting `hvc1`); H-L (the web console plays the sealed file in a plain video element, `apps/core-web/src/features/evidence/sealed-player.tsx:727`, so HEVC playback depends on the browser; a read-only search for `hevc`, `hvc1`, `hev1` in `apps/core-web/src`, `apps/mobile/src` and the media and export modules found no match, so no client code handles the codec by name).

Independent of the outcome, the codec is judged from the stream (S1-5, S1-6), because all four bench cameras report H264 over ONVIF while delivering H.265 (`SERAH-TERIMA.md:79-80`). This amends D82's working rule ("codec/profile is judged from the authenticated ONVIF answer", `T3/decisions/decisions.md:95`) and needs a decision row.

### F-3. Stored evidence form (entry Q8, constraint C12)

**Recommendation: variant C, the Core's stored form (fMP4, video copied, one AAC-LC mono 48 kHz track of the active microphone). Offer variant M (the same, plus a lossless track per microphone) as a separately decidable addition. Reject variant I for this port.** The user decides; the price of C must be accepted knowingly.

| Seam | C: as the Core stores (recommended) | I: as input-av stores (MPEG-TS plus separate FLAC or WAV, every input, a file per part) | M: Core form plus a lossless side track per microphone |
|---|---|---|---|
| S1 | none beyond the port | none beyond the port | none |
| S2 | none | none | none |
| S3 | helper table only (S3-5) | sources with two or more inputs (`R7` P-45); selection of several inputs | none beyond the port |
| S4 | none | a second transport or a multi-channel pipe; placement by arrival and continuous resampling (`WRK/audio.c:353-358`) contradict bit-exact storage, so the media-start estimate H-09 returns | none: the pipe already carries the 24-bit values exactly (E-6) |
| S5 | none; protocol version 4 | camera output per part, audio output paths, channel count: `PROTO:520-555`; version change | audio output paths in the plan; version change |
| S6 | none for H.264; HEVC proof (WP-01) | the muxer (`WRK/ingest.c:344,47`), the fragment writer that reads `moov` and `moof` (`WRK/sink.c:188-300`), the one-encoder audio path (`WRK/ingest.c:162-175`, `WRK/capture_worker.c:148-149`) | a second writer per microphone, taking samples before the resampler; the FLAC encoder of the linked library (HYPOTHESIS H-R: present in the pinned build) |
| Outside the seams | none; manifest field 53 stays true (`T3/masterplan/06_evidence_package_spec.md:445,460`) | fragment table and reader (`fragments.ts`), sealing layout `fragments/VIDEO-0n.mp4`, manifest fields 43 and 53, the track key of `evidence_tracks` (`R6` FG-07), the media route and both clients' players (a browser does not play MPEG-TS, so the playback copy `R6` F07, F08 returns), export, the verify rule of both clients | manifest and `evidence_tracks` gain rows; export carries the extra files; players unchanged |
| Rulings to re-decide | none | OD-06 (AAC-LC mono), OD-21 (fMP4), R-4 (two files, one audio track) of task 3 (`R5` 4.1, 4.2, 10.1) | OD-06 is added to, not replaced |
| Size | S (nothing to build) | L, several times over; it re-opens task 3's worker, sealing and playback milestones | M (WP-16) |

Why C: (1) U1 asks for one system of record, and that system's sealing, playback, verification and export are built and tested on this form; (2) input-av's stated reason for MPEG-TS is an **ingest** reason, parameter sets missing at session start (`IAV/nvr/recorder.py:3-6`), which the Core meets at `WRK/ingest.c:512` whatever it stores and which the relay answers (H-F); (3) the audio side of the input-av form is the weakly tested side (section 2).

What the user gives up under C, each a part of Q8 (`R7` Finding 5):

| Property of the input-av form | Under C |
|---|---|
| Lossless 24-bit audio | lost: AAC at 96 kbit/s (`WRK/ingest.c:163-172`) |
| Every selected input recorded | lost: **one of two microphones is stored**, by a hard switch (`WRK/audio.c:231-237`); the standby microphone is not evidence |
| Samples unaltered (bit-exact) | lost: continuous resampling within 5,000 ppm (`WRK/audio.c:353-358`) |
| Audio as a separate file | lost: the track sits inside each camera file |
| A reconnect is a new, separately hashed file | replaced: a gap in the same track, recorded as a fault raised and cleared and in the fragment table (`R6` FG-07, A05, A06) |

Variant M buys back the first three for one M-sized package and leaves video, playback and OD-06's playable track untouched.

### F-4. The four non-recording tools (entry Q10)

**Decided by the user for the network commissioning group (Amendment 1; U6 and U7, `decisions/decisions.md:16,18`): the temporary IP alias (H-29), the factory-address scan (H-30) and the set-camera-IP step with its wizard order (H-31, H-32) are required and are adapted INTO THE CORE (home (a) of F-4.2).** This is a decision, not a recommendation; the design of it is F-4.2, the installation knowledge behind it F-4.1, the task-3 rulings that must be amended before it can be built F-4.3, the security notes F-4.4. The data it needs gets a place in the Core schema (U8, `decisions/decisions.md:19`; section 4, last table; design in `masterplan/03_db_schema_extension.md`).

**Recommendation, unchanged, for the other two tools (still entry Q10):** keep neither as an input-av tool; move into the Core the host checks and the pre-session level check; hold gain setting until E-5.

*Overruled text of the first issue, kept for the record:* "Drop the two network-changing tools from the product; reconsider them as a separate task with their own rulings if installers need them."

Row 6 established that none of the four meets C13 as built, that all four sit behind input-av's own users, and that the doctor creates the whole input-av database when it runs (`R6` section 8.1; `IAV/nvr/doctor.py:44-45`). "Keep as a tool" therefore always means changing input-av code, and conditions TC-1 to TC-5 of row 6 apply to whatever survives (`R6` section 10.2).

| Tool | Port | Keep after cutting its record writes | Drop | Recommended |
|---|---|---|---|---|
| Doctor (H-38) | Its host checks (programs present, audio group, time sync, helper path) become Core boot checks and feed operation 65, audit `DIAGNOSTICS_RUN` (`R6` 8.1). S. WP-20 | Possible by removal alone (the `init_db()` call and the read of `cameras`), the only one of the four; still a Python tool beside the Core | The Linux host has no check of its audio prerequisites | **Port, thin** |
| Gain calibration (H-19, H-20, H-21) | Level meter: the contract member `level()` and a pre-check short open exist as a pattern (S3-6). Gain set: needs a new audit type (`M/G-5`) and a screen. S for the meter, M with gain | Meter and test record only; a gain change stays unrecorded | Levels are set with the operating system's mixer during installation; nothing in the product records it. The bench shows why that is weak: the setting was lost on re-plug (`SERAH-TERIMA.md:94-98`) | **Port the pre-session level check (in WP-08); hold gain setting** and decide again after E-5. WP-18 holds the gain part. Amendment 1 (U8): a gain value, where one is kept, gets a place in the Core schema (section 4, last table); the function itself is still entry Q10 |
| Factory-IP scan with its alias (H-29, H-30; the passive monitor H-28 is not ruled, F-4.3 point 7) | Needs a root helper in the Core, new audit types (`M/G-4`), and a ruling against D75 and D80(1) (`R5` 3.1, 7.1). M | Its `devices` rows and audit writes cut; its actions then leave no record anywhere | No longer available: overruled by U6 | **DECIDED (U7): ported into the Core.** WP-19 (alias helper and scan), WP-23 (audit types, data, permission). F-4.2 |
| Set camera IP and wizard (H-31, H-32) | As above, plus the credential must go through the Core's write-only path; the wizard's plain-text registration (`IAV/nvr/registration.py:62-64`) is never carried | The set-IP call alone; it still receives a camera credential outside the Core's path, against TC-4 and D80(3) | No longer available: overruled by U6 | **DECIDED (U7): ported into the Core**, without the wizard's registration step. WP-22. F-4.2 |

An action that changes a camera's or the host's network is never left unrecorded and never given a private log (`R6` section 6). Under U7 each such action is a Core audit type (WP-23).

#### F-4.1 Installation knowledge that makes the function needed (Amendment 1)

Source: `R1` sections 5.1, 5.2 and 5.5, with the lines below re-opened read-only on 2026-10-12. Paths are under `apps/input-av/`.

| # | Rule or fact | Value as built | Source |
|---|---|---|---|
| 1 | Why it exists | A camera network has no DHCP; a new camera comes up on its factory address in another subnet, and a host in the camera subnet cannot reach it. A camera outside the subnet is still heard through its `Hello` and flagged "outside the subnet" | `README.md:120-128`; `nvr/netalias.py:3-6` |
| 2 | Factory addresses by vendor | Hikvision 192.168.1.64, Dahua 192.168.1.108, Axis 192.168.0.90, Uniview 192.168.1.13, marked in the code as "common; adjust to the manual of the camera used". **The list is a setting**: at most 32 entries, private IPv4 only, duplicates removed. The bench shows the list is not sufficient by itself: the three Tiandy cameras sat on 192.168.1.10, .12 and .11 (`docs/SERAH-TERIMA.md:80`), none of which is a default entry, and each camera had a different address, which is the user's "konfigurasi berbeda2". The wizard also takes a typed factory address. The one part of input-av that finds a camera on an **unknown** factory address is the passive cable monitor H-28 (`nvr/passive.py:3-6` via `R1`), which U6 does not name | `nvr/settings.py:53-57,69-78`; `README.md:126-127`; `nvr/routers/devices.py:114` |
| 3 | Alias address rule | The target's `/24` is taken (always `/24`, whatever the camera's real mask); the host address is that network plus the **alias octet**, default 253, range 2 to 254; it is put on the camera interface. No interface configured: refusal | `nvr/factory.py:17-21,29-37`; `nvr/netalias.py:93`; `nvr/settings.py:58` |
| 4 | No alias when the host is already there | If **any** interface of the host has an address in the target `/24`, no alias is added and that address is used as the source, even when the interface is not the camera port. HYPOTHESIS H-U: this is the cause of open bench finding 17, a device `192.168.0.90` listed on the camera port without a MAC while the laptop's Wi-Fi was 192.168.0.133 (`docs/SERAH-TERIMA.md:78,199-202`, "Belum dipastikan"). The scan, and a set-IP after it, would then act on the office network | `nvr/netalias.py:73-81,87-92` |
| 5 | Conflict check for the alias | `arping -D -q -c 2 -w 3` on the interface; an answer ends the helper with exit 3. Two holes: the check is skipped silently when `arping` is not installed, and it does not run at all when the service holds `CAP_NET_ADMIN`, because `ip addr add` is tried directly first and the helper is the fallback | `scripts/dems-netalias:38-43`; `nvr/netalias.py:36-54` |
| 6 | Automatic removal | After N minutes (default 30, range 5 to 480) by an in-memory timer, renewed when the alias is used again; at server shutdown; at the next start, from a stored list of aliases (the list is what makes removal after a crash possible); by hand. "Already gone" is tolerated; another failure is audited | `nvr/netalias.py:57-70,87-92,107-134`; `nvr/settings.py:59`; `nvr/main.py:51,60`; `nvr/routers/devices.py:142-146`; `README.md:136-137` |
| 7 | What the root helper accepts | Exactly three arguments; `add`, `del` or `listen`; an interface name of 1 to 15 characters that exists under `/sys/class/net`; for `add` and `del` an RFC 1918 address with the literal suffix `/24`; for `listen` 1 to 120 seconds of `tcpdump`, headers only, ARP, DHCP and WS-Discovery. It is **not bound to the camera interface**: any existing interface is accepted. Installed root-owned, mode 0755, with a sudoers line that lets the service user run the whole helper without a password. The unit file therefore sets no `NoNewPrivileges` | `scripts/dems-netalias:16-35`; `scripts/install.sh:85-90`; `README.md:139-145`; `deploy/dems-nvr.service:19-20` |
| 8 | Scan steps | Targets grouped by `/24`; per group: reach (rows 3, 4); WS-Discovery probe from the alias address, multicast with TTL 1 plus unicast to each target, 2.5 s; ping and the unauthenticated ONVIF time read (2 s), 8 in parallel; the neighbour table for the MAC. The result carries a link to the camera's own web page, used from a browser **on the server** to activate the camera and switch ONVIF on | `nvr/factory.py:24-26,40-79`; `nvr/discovery.py:185-216`; `README.md:132-133`; `docs/UJI-LAN-KANTOR.md:55` |
| 9 | Several cameras on the same factory address | More than one distinct ONVIF endpoint reference answering from one address is reported as `conflict`; the screen says to unplug all but one; the documented procedure is one camera at a time and only one wizard job may run. The flag is a warning only: neither the set-IP call nor the wizard refuses on it. The wizard protects identity by reading the MAC before the change and requiring the same MAC after it | `nvr/discovery.py:210-214`; `nvr/factory.py:70-72,82-104,160,179`; `nvr/web/index.html:1014`; `nvr/routers/devices.py:129-130`; `README.md:32` |
| 10 | Set camera IP | `GetNetworkInterfaces` for the interface token; `SetNetworkInterfaces` with a manual address and prefix (8 to 30, default 24) or DHCP; `SetNetworkDefaultGateway` when given, a failure being a warning; `SystemReboot` when the camera answers `RebootNeeded`, its error ignored | `nvr/onvif_client.py:200-230`; `nvr/routers/devices.py:81-88` |
| 11 | Wizard order | Reach the factory address; unauthenticated ONVIF check (failure: "activate ONVIF in the camera's web page first"); authenticated MAC read; new address as typed, or the next free one from `<subnet>.<start>` (default 101: not a known device, not a registered camera, not a live neighbour, no ping answer); refuse when the new address answers ping; set the network; reach the new address; poll every 4 s for at most 180 s until ONVIF answers there with the same MAC; optionally register to a room; next camera | `nvr/factory.py:108-131,146-203`; `nvr/settings.py:62`; `README.md:32` |
| 12 | Following by MAC afterwards | A known MAC seen at a new address re-points every registered camera with that MAC, automatically, setting `follow_camera_ip` default true | `nvr/discovery.py:616-619,643-656`; `nvr/settings.py:48-49` |
| 13 | The credential in input-av | In the request body; toward the camera as a WS-UsernameToken `PasswordDigest`, with HTTP Digest as the fallback, over plain HTTP, so the password itself is not sent; not in the audit details; removed from the stored job parameters. Stored in plain text only by the registration step | `nvr/routers/devices.py:86-87,115-116`; `nvr/onvif_client.py:89-104,116-120`; `nvr/factory.py:99-101,139-140`; `nvr/registration.py:62-64` |

**Exercised on real hardware, and not.** Recorded: the **outcome** that three Tiandy TC-C320N were moved from 192.168.1.10, .12, .11 to 192.168.100.101, .102, .103 and registered on 2026-10-12 between 15:12 and 15:16 WIB (`docs/SERAH-TERIMA.md:80,157-158`). **Not recorded** in the documents read: by which path (wizard, single set-IP call, or the camera's own web page reached through an alias), whether the address list was edited, and whether the passive monitor found them. HYPOTHESIS H-W: it was done with input-av's scan and set-IP. The evidence would be input-av's audit entries `network.alias_add` and `device.set_ip`, which lie under `apps/input-av/data/` and were not opened; the user can simply say. No record of a real-hardware run exists for: two cameras on one address (row 9), alias expiry and removal after a crash (row 6), the `arping` check (row 5), DHCP mode and the gateway call (row 10), or a camera of the four listed vendors at its listed address. None of it has run in the Core.

#### F-4.2 The home: a commissioning function of the Core (decided, U7)

**Design.** Rules DR-1 to DR-12 are proposals of this document inside the user's decision; the ones marked (row 13) are for the security review.

| # | Part | Design | Departs from input-av because |
|---|---|---|---|
| DR-1 | Scope and platform | A commissioning function of the production capture operation, **Linux only** (`ip`, `arping`, `/sys/class/net`; entry Q7). On another host the operations answer "not available on this host". Available only while no session is open, as capture configuration is (`packages/shared/src/sim/vocabulary.ts:40`) | changing the camera port's addresses during a recording puts the recording at risk; input-av has no such bar |
| DR-2 | Privileged alias helper (row 13) | A small root-owned program derived from `scripts/dems-netalias`, reached through `sudo -n` by the Core's service user, with a sudoers line for that one path. It accepts `add` and `del` only; the interface is **read from a root-owned configuration file**, not taken from the caller; the address must be RFC 1918 with `/24`; the conflict check is mandatory (no `arping`: refusal). The Core never runs `ip addr` directly and holds no `CAP_NET_ADMIN` | F-4.1 rows 5 and 7: the direct path skips the conflict check; the helper as built accepts any interface and carries `tcpdump` |
| DR-3 | Expiry that survives the Core | The helper adds the address with a kernel lifetime equal to the configured minutes, so the kernel removes it even if the Core has died. HYPOTHESIS H-S: `ip addr add ... valid_lft <s> preferred_lft <s>` expires an IPv4 address on the production kernel (experiment E-13). The Core still removes it at the end of the job, at shutdown and at start, and audits each removal | the in-memory timer of F-4.1 row 6 dies with the process |
| DR-4 | Wrong-network guard | The function refuses a target `/24` in which any interface other than the camera interface already holds an address; there is no silent use of another interface as the source | F-4.1 row 4 |
| DR-5 | Scan | A separate operation from the camera search (operation 93 stays probe-only): targets are the stored factory address list plus one address the operator may type; per target the steps of F-4.1 row 8; the result is a list for the screen. Whether a found device is also stored is decided by the schema design under U8 and by a ruling on RG-4 (F-4.3, point 6) | D80(1), RG-4 |
| DR-6 | Same address on several cameras | The conflict flag is enforced by the Core: set-IP is refused while the last scan of that address reported more than one endpoint; one commissioning job at a time | F-4.1 row 9: warning only |
| DR-7 | Set camera IP | A pinned file of its own (change item S2-5), using the calls of the `onvif` package the Core already has; the connection-test file keeps its statement that it makes no configuration call. Order as F-4.1 rows 10 and 11, the MAC read before and matched after | ready-made rule C8; D95 precedent of one pinned file per door |
| DR-8 | Credential path (row 13) | Typed in the **web console only** (D80(3)), in the body of one new credential-carrying operation, the fourth beside 89, 95, 96 (D81). Held in memory for the job (at most the 180 s wait plus the calls), never written to a log, an audit detail, a file, an argument or the environment (CR-3 of `R5` 14.6), never tried from a default list (D76 (2)): the operator types the factory or activation account. Toward the camera only as a digest (CR-4). **This operation stores nothing.** Storage happens afterwards, through the existing adoption (operation 96) into the sealed, write-only store (`R6` T04c). Whether the operator must type the credential again for adoption is point 4 of F-4.3 | input-av receives it behind its own users and the wizard stores it in plain text |
| DR-9 | Role (row 13) | A permission of its own for commissioning, proposed for **TECHNICIAN only**; not INVESTIGATOR; SUPERVISOR by the user's choice. Today the search needs `CAPTURE_CONFIG`, held by SUPERVISOR and TECHNICIAN (`packages/shared/src/api/capture-discovery.ts:559`); a network-changing action deserves a narrower grant than a search | input-av: its own `admin` role (`nvr/routers/devices.py:14,70-99`) |
| DR-10 | Follow-up by MAC | Inside the job: the Core waits for the same MAC at the new address and reports it. For a camera **already registered**, the registry address is updated by the same operator action, with the audit type of M/G-3; that is the "operator-confirmed re-address" of fork F-5, because the operator started the change and the Core checked the MAC. **No automatic background follow** (F-4.1 row 12 is not carried): a probe answer is forgeable (SEC35-28) | fork F-5 |
| DR-11 | Audit | One Core audit entry per action, in the one chain: scan run; host address added; host address removed; removal failed; camera network set (M/G-4); registered camera address changed (M/G-3). Detail keys are fixed in WP-23 against the closed lists of `apps/core-server/src/core/audit-details.ts`, which were not read; "audited without values" (D76 (3)) applies to the credential | input-av's own chain |
| DR-12 | Camera activation | A factory camera often needs activation in its own web page first (F-4.1 rows 8, 11). The alias exists on the Core host only, so that page is reachable from a browser on the Core host or from a laptop on the camera switch, not through the web console from elsewhere. Stated as an installation step in the host profile (WP-14); the Core does not proxy a camera's web page | - |

**What it needs, and cost.** WP-19 (M): helper, guard, scan. WP-22 (M): set IP, credential operation, wait by MAC, screens of the web console. WP-23 (S): audit types, permission, and the data of section 4's last table through the schema extension of U8. A clause in WP-14 (helper installation, `arping`). Verification needs a Linux host with a real factory-new camera (E-13 to E-15); the Core-side logic is testable on the development host against a fake helper and the existing ONVIF stub.

**Not chosen (b): a reduced, record-free standalone installer tool derived from input-av.** It keeps network-changing code and `sudo` out of the Core, which is its merit. It fails on accounting: without a database it either leaves the address change unrecorded (against `R6` section 6 and D76 (3)) or reports to the Core, which needs the same audit types plus a signed-in call from a command line, and the Core would then record what the tool claims rather than what the Core did. The credential would be typed at a terminal outside the Core's path (against D80(3) and TC-4), and who may run it would be an operating-system account, not a Core role. Not cheaper than (a) once it is accounted for.

**Not chosen (c): input-av as built, used only for commissioning before the Core records.** By the record map's line per tool (`R6` section 8.1) it would still write: `devices` rows; audit entries `device.factory_scan`, `device.discovered`, `device.online`, `device.ip_changed`, `network.alias_add`, `network.alias_remove`, `device.set_ip`; the `settings` row `net_aliases`; with a room chosen in the wizard, `cameras` rows holding the camera password in plain text and `camera_device.register`; and, because it runs behind its own sign-in, `users`, `refresh_tokens`, the token secret and the sign-in and start entries, with the whole schema created at start. That is up to five record kinds with a second writer (`R6` section 10.3) and a private log of network-changing actions, so it **breaks** "no double records" on any machine where it runs. It could be tolerated only under a written, time-limited exception from the user to conditions TC-1 to TC-3: a separate installer laptop, never the Core host; the wizard without a room, so that no camera credential is stored; a data directory outside `apps/input-av/data/` (WP-21); ending when WP-19, WP-22 and WP-23 land. No such exception is recorded, and none is proposed here.

#### F-4.3 What the user must still rule before WP-19, WP-22 and WP-23 can be built

U7 fixes the home. These rulings of task 3 (`R5` sections 3.1, 7.1, 6.1) stand against it as written, and each needs a decision row; none is implied by this document.

| # | Ruling | Text in force | Amendment needed |
|---|---|---|---|
| 1 | D75 (`T3/decisions/decisions.md:88`) | "probes and unauthenticated device information only; no authentication attempt, no credential guessing, **no configuration change on any discovered device** (NTP, GOP, profiles, PoE stay class C until the user names a camera and its account)" | The product may change a camera's network configuration (`SetNetworkInterfaces`, `SetNetworkDefaultGateway`, `SystemReboot`) as an operator action with an operator-typed credential, and may add a temporary address to its own camera interface. Nothing else in the clause is lifted (no clock, GOP, profile or PoE set). The agent rule of D76 (4) stays: agents never type a real credential and never run this against a real camera |
| 2 | D80(1) (`:93`) | "a search uses PROBE-ANSWER data only - no follow-up TCP read of device information" | Kept for the search. The commissioning scan is ruled a different operation that may ping, read the neighbour table and make the unauthenticated ONVIF time read over TCP at the configured factory addresses |
| 3 | D80(10) (`:93`) | "typed-address entry is NOT in scope" | Lifted for commissioning: the stored factory address list and one typed address. Whether it is also lifted for the search stays entry NEW-1 (fork F-5) |
| 4 | D81 (`:94`) and D80(7) | "three credential-carrying operations (89, 95, 96)"; the connect flow "holds the operator's credential in memory for the connection test only" | A fourth credential-carrying operation, web console only. And one choice: the credential is typed again for adoption (strict reading of "lifetime = one call"), or it may live for one commissioning job and be handed to the adoption that ends it |
| 5 | D76 (3) (`:89`) | "candidate -> operator action -> credential prompt -> existing write-only credential path (op 89) -> connection test -> only then assignable" | The order gains a step before adoption: set network. To confirm that this is inside "every connectivity action is a separate operator action" |
| 6 | RG-4 and D76 (1) | a search result "never enters the registry"; "a candidate LIST only" | Only if the schema design under U8 stores discovered or commissioned devices: say whether a stored row of a not-yet-adopted device is allowed, and that it is never assignable |
| 7 | Scope of U6 | U6 names the alias | Whether the passive cable monitor H-28 (`tcpdump` as root) is also required. Without it a camera on an unknown factory address is found only by typing the address from its label or manual (F-4.1 row 2) |
| 8 | Role and lock-out | D86 C-2: "lock-out guard 2 failures per host in 30 minutes" | Which role may commission (DR-9). HYPOTHESIS H-V: a guard keyed by address would count failures of different factory-new cameras that share one factory address as one host; to be judged by row 13 |

Also open, not a task-3 ruling: entry Q7 (Linux), on which all three packages depend.

#### F-4.4 Security notes for row 13 (Amendment 1)

| # | Subject | Note |
|---|---|---|
| SN-1 | Privileged helper | The Core's service user gains one `sudo` path. Its reach is bounded by DR-2: one interface fixed by a root-owned file, private `/24` only, add and delete only. As built in input-av the bound is wider (any interface, plus packet capture). The helper file and the sudoers line must be root-owned and not writable by the service user; a host check verifies both (WP-14) |
| SN-2 | `CAP_NET_ADMIN` against sudoers | The capability on the Core process would let the process that holds evidence and keys change any interface, route or firewall rule, and it bypasses the conflict check (F-4.1 row 5). Not used. Cost of the `sudo` path: the unit cannot set `NoNewPrivileges` (as `deploy/dems-nvr.service:19-20` notes). Alternative for row 13 to weigh: a root service activated over a local socket, which lets the Core keep `NoNewPrivileges` (HYPOTHESIS, not designed) |
| SN-3 | A network-changing action and its role | Reachable by TECHNICIAN only (proposal DR-9), web console only, idle only, one job at a time, each action audited before the result is shown. A compromised technician account can move a camera off its address or put the host on another private subnet; it cannot reach a public address |
| SN-4 | The credential on the wire | ONVIF on a factory camera is plain HTTP: the account name travels in clear and the digest can be attacked offline (accepted for the development network only, D87 (2), `R5` 7.1). The new address and gateway travel in clear. A factory account is often a published default, so the digest protects little until the password is changed in the camera. The digest is sent to whatever answers at the factory address (SEC35-28, SEC35-31): the dialog must show the target address and the MAC read, and commissioning belongs on the dedicated camera port with one camera plugged in |
| SN-5 | The alias widens the host | For its lifetime the Core host answers on a second private subnet on the camera port. Bounded by DR-3 and DR-4; the firewall rule of WP-14 must not open the Core's own services on that address |
| SN-6 | Reboot | The function can reboot a camera. Refused while a session is open (DR-1) |

### F-5. Discovery fallbacks (proposed entry NEW-1)

**Recommendation: first fix the host, then allow one narrow fallback. (1) Put a firewall rule for probe answers into the Linux host profile (WP-14): no ruling changes. (2) If cameras still go unfound, allow a unicast probe to an operator-typed address, which lifts D80(10) and nothing else. (3) Do not carry the ARP sweep, ping and direct unauthenticated ONVIF check.**

Reasoning: on the bench the fallback was needed because the host firewall blocked incoming multicast answers (`SERAH-TERIMA.md:266-267`), which is a host fault, not a protocol gap. A typed-address probe stays "probe-answer data only" (D80(1)); an address sweep is an active scan of a network and sits outside D75's bounds (`R5` 3.1).

| Option | Rulings touched | Cost |
|---|---|---|
| As built: multicast probe only | none | none; a camera that does not answer multicast cannot be found (D80(10)) |
| Typed-address unicast probe (recommended, step 2) | D80(10) | S to M: an address member on `DiscoverySearch` (`ADP/types.ts:53-58`), a body on operation 93 (`routes.ts:14-16`), limits and audit detail |
| Full input-av set (ARP, neighbour table, ping, direct ONVIF check) | D75, D76, D80(1), D80(10); needs a stored camera-network setting (`M/G-2`) | M, plus a security review of an active scanner inside the Core |

**Following a camera whose address changed (H-11).** Recommendation: never automatic. A probe answer is forgeable (finding SEC35-28, `R5` 3.2); silently re-pointing a registered camera at a new address would send a credentialed connection to whoever answered. The design is an operator-confirmed re-address that shows the target, as the connect dialog does, with a new audit type (`M/G-3`). Static camera addresses at installation remove most of the need. Part of WP-12.

**Boundary to commissioning (Amendment 1).** The factory-address scan of fork F-4 is not this search and does not lift step (3) above for it: the search stays probe-only on the camera subnet. The commissioning scan is a separate, operator-started, idle-only operation on a list of configured addresses, and it does ping and read the neighbour table there (F-4.2, DR-5), which is why D80(1) and D80(10) need the amendments of F-4.3. A re-address made by the set-IP step is the operator-confirmed case of this paragraph (DR-10); automatic following stays excluded.

### F-6. Production host (entry Q7)

**Recommendation: confirm Linux as the production capture host.** The tested audio scheme exists on Linux only (`R7` mismatch 1); no task 3 ruling names the capture host's system, and the one that names a "x86 Linux Core" concerns the transcriber (`R5` 13.2).

| Option | Consequence |
|---|---|
| Linux (recommended) | The audio path as tested. Cost: the host profile WP-14, which is not small: the worker built against the pinned library on Linux (`WRK/ingest.c:58-59`); the parent-death method of H-08; the firewall rule of F-5; audio group and device access; sleep inhibition and time sync (H-36). HYPOTHESIS H-K: on a build without `F_FULLFSYNC` the worker states sync level `FSYNC` (`WRK/sink.c:320-323`), which the capture session treats as critical in `REAL_PRODUCTION` (`capture-session/index.ts:262`, D189), so every production session on Linux would raise a critical notice until that rule is revisited |
| macOS | No ALSA: the USB interface would go through the development helper's input (`-f avfoundation`), a path with no test on the USB interface. U2's "tested" no longer applies to audio |

The design keeps everything above the helper argument table and the enumerator host-neutral, so the camera side (S1, S2) runs on either.

### F-7. Rooms per Core (entry Q6)

**Recommendation: one room per Core, as built.** R-6 of task 3 is in force (`T3/masterplan/01_specs.md:195-196`) and is held by a database check, the supervisor, the worker's limits and the selector shape (`R2` section 13). Several rooms in one Core is an L-sized change across all of them (WP-17, not planned). Consequence to state: each room needs its own Core and its own audio interface; the bench arrangement of four rooms on one host sharing one interface is not reproduced. "Eight rooms" was run with virtual cameras only (`SERAH-TERIMA.md:107`).

### F-8. Legacy data (entry Q3)

**Recommendation: leave `apps/input-av/data/` as a separate archive that nothing writes, and do not import it.** An import has no lossless target (`R6` section 9). Before any later work runs a tool from the input-av tree, the folder is moved out of that tree or made read-only by the user, because the doctor, the level meter and the application itself write into it when started from the source directory (`IAV/nvr/config.py:11`; `IAV/nvr/db.py:254-264`). WP-21 is that guard; it is a user action, not an agent action.

## 8. Fate of `apps/input-av` under C13 (proposed)

- The application does not run as a service on a Core installation (TC-1). No table, audit entry, token or file of row 6's 121 records is written after the port; the count of record kinds with two owners stays 0 under TC-1 to TC-5.
- The source tree stays in place as the reference the port is read from. Nothing in it is deleted or renamed by this plan.
- No tool survives as an input-av tool (fork F-4). **Amendment 1 (U6, U7):** this now holds for the network commissioning tools by the user's decision, not by dropping the function: alias, factory-address scan and set camera IP are rebuilt in the Core (WP-19, WP-22, WP-23), and `nvr/factory.py`, `nvr/netalias.py`, `scripts/dems-netalias` and `nvr/onvif_client.py:200-230` are the reference they are read from. A reduced standalone tool and input-av as built as an interim were considered and not chosen (F-4.2); using input-av for commissioning until the Core function exists would need a written exception that is not recorded. Data of input-av that the Core had no place for gets a place in the Core schema (U8; `masterplan/03_db_schema_extension.md`); that moves data definitions, not the existing data, whose fate stays entry Q3 (fork F-8). The folder's status in git (untracked, with `data/` ignored, `R6` section 9) is a risk for row 10, not a design item.

## 9. Work packages

Size is an estimate from scope. "Host" says where the package can be built and verified: **DEV** = development host with fake devices; **LINUX-HW** = a Linux host with the real cameras or audio interface. "Blocked by" names the decision without which the package cannot be executed; all packages can be designed now.

| WP | Seam | Content (items, parameters) | Size | Depends on | Blocked by | Host | Verification |
|---|---|---|---|---|---|---|---|
| WP-01 | S6 | HEVC and gap proof on fakes: E-1, E-2, E-8, E-10, E-11. P-07b. No product code; fixtures and a written verdict | S | - | - | DEV | The three pass criteria of fork F-2; E-10: a push that pauses and resumes yields one file with a gap; E-11: a push to another path is refused or recorded as accepted |
| WP-02 | S1 (used by S3) | Production helper door: start message on standard input, explicit environment, kill on Core exit. H-08. E-7 | S | - | - | DEV (parent-death method: LINUX-HW) | No child survives an abrupt end of the Core; a static test that every argument is a literal |
| WP-03 | S1 | Pull relay program with probe mode. H-07. P-01, P-02, P-03, P-04, P-08. E-12 | M | WP-01 (E-2 outcome), WP-02 | F-1 | DEV | Against a fake RTSP camera with authentication: the worker records; the credential is absent from the argument list, the environment, both output streams and every log (E-12); video only is forwarded |
| WP-04 | S1 (carrier S5) | Profiles and locator. H-03, H-05, H-11. P-15, P-16, P-18, P-23 | M | - | - | DEV | Fake ONVIF device with two video sources: one profile per source, largest area chosen; locator without a user part; a device answering a user part is refused |
| WP-05 | S1 | Stream test and codec from the stream; additive outcome vocabulary. H-35. P-19, P-25 | M | WP-03 | decision row amending D82 | DEV | A fake device that reports H264 and delivers HEVC is reported as HEVC; the RTSP probe runs only after the ONVIF half authenticated, so the lock-out bound of D86 C-2 holds; the whole test stays inside 15,000 ms (`SHARED:168`) |
| WP-06 | S1 | `openSource`, retry, presence, clock offset, SA-2 and SA-3, audit writers. H-10, H-26. P-28, P-30, P-31, P-60, P-61 | M | WP-02, WP-03, WP-04 | - | DEV | A session on fakes records through the relay; a killed camera is retried by the stated rule and resumes in the same track; a foreign push ends the track as a fault |
| WP-07 | S3 | Enumeration, identity, allocation, hot-plug, error code, registry placement, audit writers. H-13, H-14, H-18, H-22. P-46 | M | - | Q7 | DEV with a fake card list; LINUX-HW to confirm the real listing | Fixed card listings give the expected inputs; an input beyond the card is refused by name; no automatic card choice exists |
| WP-08 | S3 (feeds S4) | Shared-capture configuration, Linux helper table, level and pre-check. H-15, H-16. P-34, P-35, P-36, P-39, P-40, P-41, P-42, P-43, P-44, P-48, P-49, P-50; P-38 | M | WP-02, WP-07 | Q7 | **LINUX-HW** (argument table and generator text: DEV) | Generated configuration and argument list equal the quoted input-av values; on the interface: E-5 |
| WP-09 | S4 | Transport statement for production; E-6 | S | - | - | DEV | Every 24-bit value survives the float conversion |
| WP-10 | S6 | Conditional on WP-01: HEVC sample-entry name; frame rate for HEVC in the Core reader | S to M | WP-01 | F-2 | DEV | E-1 and E-8 repeated and passing |
| WP-11 | S6 | Conditional on E-10 failing: the ingest accepts a resumed push | M | WP-01 | - | DEV | E-10 passing; the worker's existing suite unchanged |
| WP-12 | S2 | Typed-address unicast probe; operator-confirmed re-address with its audit type. H-25 (if lifted). P-57, P-58, P-59 | M | - | NEW-1 | DEV; the firewall half LINUX-HW | A typed address yields a candidate from the probe answer alone; no re-address without confirmation |
| WP-13 | S1, S3 | Class-C lift change set: the list, the stubs, the loader wiring, the rewritten tests, errata (section 6.3) | S | WP-01 to WP-09 | Q9 | DEV | Every row of section 6.3 in its stated end state; a `REAL_DEVELOPMENT` Core behaves as before |
| WP-14 | host (S3, S6) | Linux host profile: worker build on the pinned library, sync-level rule (H-K), firewall, audio access, sleep and time sync, private run directory. Amendment 1: installation of the alias helper with its sudoers line and root-owned interface file, `arping` present, the activation step of DR-12 | M | - | Q7 | **LINUX-HW** | The worker's own check script passes on the host; a probe answer arrives; a session raises no notice that the host causes |
| WP-15 | S1, S3, S4, S6 | Hardware milestone, camera and audio together: E-3 (the operator types the credential, never an agent, D76), E-4, E-5, E-9 | M | WP-13, WP-14 | Q7, Q9; external X-1, X-2 | **LINUX-HW**, two cameras and two microphone inputs | A recorded session from four production sources; counters of `WRK/ingest.c:577,585,593` read; the first second of audio checked for the full-scale sample; drift measured over one to two hours |
| WP-16 | S6, S5 | Stored-form addition, only if Q8 is answered M: lossless track per microphone. P-09, P-10, P-29, P-45, P-51, P-52, P-53, P-54, P-55 (each either built here or closed as "not carried" by the answer). H-09, H-17, H-34 | M (variant I: L, to be split) | WP-08 | Q8 | DEV, then LINUX-HW | Under C: the nine parameters are recorded as not carried. Under M: the side track is bit-identical to the pipe input |
| WP-17 | S5, S6 | Several rooms per Core. P-32 | L, not planned | - | Q6 | - | - |
| WP-18 | S3 | Gain setting with its audit type (`M/G-5`). H-19, H-20, H-21 | M | WP-08 | Q10 | LINUX-HW | A gain change is an audited Core action |
| WP-19 | S2 | **Re-scoped by Amendment 1 (was: scan and address set together, H-28 to H-32, blocked by Q10).** Alias helper and factory-address scan as a Core commissioning function: change items S2-3, S2-4; rules DR-1 to DR-6. H-29, H-30. H-28 is not included | M | WP-23 (contract); WP-14 (build: helper installed); the unicast probe is shared with WP-12 but built here if WP-12 does not run | **No longer Q10** (U6, U7). Amendments to D75, D80(1), D80(10) (F-4.3 points 1 to 3); Q7; row 13 on DR-2 | DEV against a fake helper and the ONVIF stub; **LINUX-HW** for the helper | The helper refuses another interface, a public address, a prefix other than `/24`, an address in use; E-13: the address is gone after its lifetime with the Core killed; DR-4 refuses a subnet held by another interface; each action leaves one Core audit entry; nothing is written while a session is open |
| WP-22 | S2 | **Added by Amendment 1 (split from WP-19).** Set camera IP: change item S2-5; rules DR-6 to DR-10, DR-12; the fourth credential-carrying operation; wait for the same MAC; next free address; the screens of the web console. H-31, H-32 without the registration step | M | WP-19, WP-23 | Amendments to D75, D81 and D80(7), D76 (3) (F-4.3 points 1, 4, 5); Q7; row 13 on DR-8, DR-9 | DEV against the ONVIF stub extended with the network calls; **LINUX-HW** with a factory-new camera | The credential is absent from logs, audit details, arguments, environment and files; set-IP is refused on a conflict flag and on an address that answers; E-14: a real camera is moved and found by its MAC (the operator types the credential, never an agent, D76); E-15: two cameras on one address are flagged and not changed; adoption afterwards goes through operation 96 only |
| WP-23 | S2 (shared vocabulary, schema) | **Added by Amendment 1 (split from WP-19).** Change item S2-6: the audit types of `M/G-4` and `M/G-3` with their detail keys; the commissioning permission (DR-9); the persistent data of section 4's last table for S2, implemented from `masterplan/03_db_schema_extension.md` | S | the schema design of U8 (contract) | Amendments of F-4.3 (points 6 and 8 for its optional parts); approval of the schema extension | DEV | The audit writer accepts the new types and rejects a detail key outside their lists; the permission is held by the ruled role only; the migration applies and reverts on an empty and on a seeded database |
| WP-20 | none (host) | Host checks moved into the Core's boot checks and diagnostics. H-38 | S | WP-14 | Q10 | LINUX-HW | A missing prerequisite is named at boot |
| WP-21 | none (data) | Guard for the existing data: moved or made read-only by the user before any input-av tool is run | S | - | Q3 | user action | The folder has no writer |

**Coverage check.** Adopted items: 14 of 14, each in one package (H-03, 05, 11 in WP-04; H-07 in WP-03; H-08 in WP-02; H-35 in WP-05; H-10, 26 in WP-06; H-13, 14, 18, 22 in WP-07; H-15, 16 in WP-08). Parameters with status NEEDS_CHANGE: 42 of 42 (WP-03: 5; WP-04: 4; WP-05: 2; WP-06: 5; WP-07: 1; WP-08: 12; WP-12: 3; WP-16: 9; WP-17: 1; sum 42). The two UNPROVEN parameters: P-07b in WP-01, P-38 in WP-08. **Amendment 1:** the items required by U6 are placed 4 of 4, each in one package on seam S2 (H-29, H-30 in WP-19; H-31, H-32 in WP-22); they are not among row 7's 14 adopted items and carry no row-7 parameter (`R7` section 5 lists them as items only), so the two counts above are unchanged. WP-23 carries no H item; it carries change item S2-6. Packages: 23 (WP-01 to WP-23); numbers WP-01 to WP-21 are unchanged.

**Packages that need real hardware on a Linux host:** WP-08 (its run), WP-14, WP-15; **since Amendment 1, unconditionally, WP-19 (the helper) and WP-22 (a factory-new camera)**; and, if their entries are answered "port", WP-18, WP-20. WP-02 and WP-07 need that host for one confirmation each. WP-23 is development-host work. Everything else is development-host work with fake devices.

**External dependencies, not part of the port.** X-1: a command that provisions a production signing key. X-2: operators without the demonstration password (`M/G-6`, D241). Without both, a `REAL_PRODUCTION` Core does not start (`R5` 8.12), so WP-15 cannot end in a sealed session.

**Experiments added by this row** (E-1 to E-8 are row 7's): E-9 long-run drift between video and audio (LINUX-HW); E-10 a push that pauses and resumes (DEV); E-11 a push to a wrong path or from a second client (DEV); E-12 credential absence in arguments, environment, output and logs of the relay (DEV). **Added by Amendment 1:** E-13 the alias is added, refused on a conflict, and removed by the kernel after its lifetime with the Core killed (LINUX-HW; settles H-S); E-14 a factory-new camera is moved to the camera subnet and found again by its MAC, credential typed by the operator (LINUX-HW); E-15 two cameras on one factory address are reported as a conflict and neither is changed (LINUX-HW).

## 10. Impact, with a rollback per change item

| # | Change item | What it affects | Rollback |
|---|---|---|---|
| I-1 | Opener list and its pins (WP-13) | `REAL_PRODUCTION` becomes recordable; an all-production package can be sealed, which D86 C-5 excluded "in this phase" | Revert the one change set. No stored data depends on it; sessions already sealed stay valid |
| I-2 | Connection-test vocabulary (WP-05) | 17 files in three workspaces name `NOT_H264`, including the generated API description and the web console's texts | The change is additive, so reverting restores the H.264-only filter; audit rows written meanwhile keep values that remain in the value set |
| I-3 | New program `capture-relay` (WP-03) | the worker's build and its library pin; the program-path rule for helpers; packaging | Do not register the production camera adapter; the program is inert without a start message |
| I-4 | Production process door (WP-02) | a second pinned door file and its static tests; the local door is untouched | Remove the file; no caller remains once the adapters are unregistered |
| I-5 | Static tests of the adapter layer (WP-13) | the rules "class-C files import three files" and "the injection point has no caller" change meaning | Restored with I-1 |
| I-6 | Registry rows for microphone inputs (WP-07) | `capture_devices` content; no migration under the proposed placement | Rows are disabled, never deleted (the Core deletes no registry row, `R6` A37) |
| I-7 | Audit writers for class-C types (WP-06, WP-07) | first real writers of camera-loss and microphone faults; detail keys are a closed list not read in full here | Revert with the adapters; written rows stay in the chain |
| I-8 | Ingest address with a random element (SA-2) | `capture-session/index.ts:1056` and every test that states the address | Revert; development sessions are unaffected either way |
| I-9 | Worker (WP-10, WP-11), only if the experiments demand | the verified ingest and muxing code; the Core reader | Each is its own change set behind WP-01's verdict; H2 of fork F-2 is the state without them |
| I-10 | Linux host (WP-14) | first build of the worker and helpers off macOS; the sync-level notice (H-K) | The development host remains the reference; no data format changes |
| I-11 | Task 3 documents and code comments | errata in specification, README and four adapter files | Text only |
| I-12 | Rulings amended | D86 C-5 (lift), D82 (codec judged from the stream), D80(10) if NEW-1 is granted. Amendment 1: D75, D80(1), D80(10) for commissioning, D81 with D80(7), D76 (3), and RG-4 if devices are stored (F-4.3) | Each is a decision row; none is implied by this document |
| I-13 (Amendment 1) | Privileged alias helper on the host (WP-19, WP-14) | the first root-reaching path of the Core's service user; a sudoers file; the unit's hardening options; the host's addresses on the camera port for minutes at a time | Remove the sudoers line and the helper: the function then answers "not permitted" and nothing else changes. An address left behind expires (DR-3) or is deleted by hand |
| I-14 (Amendment 1) | Audit vocabulary and permission set (WP-23) | the shared vocabulary and its category map, the detail-key lists, the generated API description, both clients' audit screens and role tables | Additive: types and permission stay in the value sets after a revert so that written rows remain valid; the operations are unregistered |
| I-15 (Amendment 1) | A configuration call toward a camera and a fourth credential-carrying operation (WP-22) | the statement "no configuration call" holds for the connection-test file only, no longer for the Core; the credential rules gain one holder for the length of a job | Unregister the operation. A camera already moved keeps its new address: that is not rolled back by the Core, the operator moves it again |
| I-16 (Amendment 1) | Schema extension (U8; WP-23 and the packages that use the data) | the Core's PostgreSQL schema and migrations, designed in `masterplan/03_db_schema_extension.md` | As that document states per migration; this design assumes additive changes only (HYPOTHESIS until that document exists) |

What does not change: the worker for H.264; the plan and protocol version; the mixed-class refusal (RG-3); the `REAL_DEVELOPMENT` and `SIMULATED` operations; sealing, manifest and both clients under variant C; the single audit chain; the write-only credential store. Amendment 1 changes none of these: the commissioning function writes into the one chain, stores no credential, and is unavailable while a session is open.

## 11. Rejected alternatives

A REST bridge from the Core to the input-av API and a Core-driven input-av process were both removed by the user's ruling U1 (`decisions/decisions.md:7`): each would keep a second database, audit chain and user base alive, which is the double recording the task exists to prevent. Within the port, three further options are rejected: the FFmpeg command-line program or a ready-made media server as the camera relay (the credential would sit in an argument list, a configuration file or an API call, `ADP/credential.ts:117-125`); feeding the FFmpeg program a script on standard input that names the camera address (HYPOTHESIS that it would work at all; its own diagnostics would print the address with the credential); and transcoding H.265 to H.264 at ingest (it breaks the copy-only rule R-4).

## 12. Assumptions, risks, gaps

**Assumptions.** AS-1: P3 is the correct reading of U2; if corrected, sections 5 and 7 change on the affected parameters only. AS-2: rows 1, 2, 5, 6, 7 are accurate where this row did not re-open a line. AS-3: "production Core" means the `REAL_PRODUCTION` capture operation.

| Risk | Trigger | Mitigation |
|---|---|---|
| The relay is treated as trivial glue | WP-03 planned without E-12 and the timing sub-choice | Its verification column; row 12 reviews it |
| SEC35-40 returns unanswered | Variant A lands without SA-2 and SA-3 | Condition L-2; row 13 |
| HEVC is assumed and fails late | Work starts before WP-01 | WP-01 has no dependency and no blocking decision: it can run first |
| The user reads "tested" as covering the Core path | U2's wording | Section 2 |
| The standby microphone is assumed to be evidence | input-av's habit | Fork F-3, table of what is given up |
| Hardware work starts without a way to boot production | X-1, X-2 open | Named in section 9; row 10 schedules them or the milestone states "recorded, not sealed" |
| Library behaviour differs from every hypothesis here | Nothing was run | Each hypothesis has an experiment; none is a planning assumption |
| (Amendment 1) The helper is ported as built | WP-19 copies `scripts/dems-netalias` unchanged | DR-2: fixed interface, no packet capture, mandatory conflict check; F-4.4 SN-1 |
| (Amendment 1) Commissioning acts on the wrong network | A factory subnet equals the subnet of another interface of the host (F-4.1 row 4; bench finding 17) | DR-4; E-13 |
| (Amendment 1) Commissioning is built before its rulings | U7 is read as lifting D75, D80 and D81 by itself | F-4.3: each is its own decision row; the three packages name them as blockers |
| (Amendment 1) "Tested" is read as covering this function | The Tiandy move of 2026-10-12 is taken as a test of the tool | F-4.1, last paragraph: outcome recorded, path not recorded; E-14, E-15 |

**Hypotheses introduced by this row:** H-F (in-band parameter sets fill the stream's extradata during the probe; E-2), H-G (`hev1` under `codec_tag = 0`; E-1, E-8), H-I (listener refuses another path; E-11), H-J (drift under a fixed clock mapping; E-9), H-K (sync level on Linux; WP-14), H-L (HEVC playback depends on the browser; E-8), H-M (the ingest survives a pause in the push; the stall cut at `WRK/ingest.c:425-431` suggests so; E-10), H-N (the `pan` filter does not collect samples, as the helper rule at `ADP/local/mic-helper-args.ts:24-27` requires; E-5), H-O (the pre-check short open absorbs the first-sample defect; E-5), H-P (no mid-session free-space stop in real capture), H-Q (scope of SEC35-40's text), H-R (FLAC encoder present in the pinned build). **Added by Amendment 1:** H-S (an IPv4 address added with a kernel lifetime is removed by the kernel without the Core; E-13), H-T (the network calls present in the `onvif` 0.8.3 package behave on real cameras as input-av's own SOAP bodies did; presence was read, nothing was run; E-14), H-U (bench finding 17 is caused by the "any interface" rule of `nvr/netalias.py:73-81`; unconfirmed in the hand-over document), H-V (a lock-out guard keyed by address counts different factory-new cameras on one address as one host; row 13), H-W (the three Tiandy cameras were moved with input-av's own scan and set-IP; the user can confirm).

**Not examined:** `T3/masterplan/09_security_design_review.md` (the full text of SEC35-40); `apps/core-server/src/core/audit-details.ts` beyond three lines; whether `capture_devices.profiles` can carry a video-source grouping (`R6` FG-01); the worker's message channel, which matters only under F-1 variant B; the mobile client's player. Amendment 1: which roles hold `DEVICE_MANAGE` and whether it could serve as the commissioning permission; how the Core's lock-out guard is keyed; `masterplan/03_db_schema_extension.md` (not present when this amendment was written); `nvr/passive.py` beyond row 1's quotation; the input-av audit log, which would settle H-W.

## 13. Lines re-opened in this pass (read-only)

`ADP/registry.ts:28-40,78-86`; `ADP/__tests__/registry.test.ts:86-100`; `ADP/__tests__/static.test.ts:93-102,119-126`; `ADP/types.ts:136-146`; `ADP/credential.ts:110-126`; `ADP/local/process-door.ts:1-36,88-98`; `apps/core-server/src/capture/fence/sources.ts:60-110`; `fence/index.ts:316-330`; `apps/core-server/src/capture-session/index.ts:150-155,258-264,1054-1058`; `apps/core-server/src/capture/fragments.ts:444-460,538-548`; `apps/core-server/src/db/schema/capture.ts:38-60`; `apps/core-server/src/modules/media-stream/index.ts:1-40`; `PROTO:322-336,536-546`; `WRK/ingest.c:505-530,534-542`.

Searches (read-only, 2026-10-12): `NOT_H264` over `apps` and `packages` without `apps/input-av`: 17 files. Imports of the local process door under `apps/core-server/src`: 13 files. `loadProductionAdapters|buildProductionRegistry` outside tests: `ADP/real.ts:29`, `fence/index.ts:326,510`. `STORAGE_LOW|STORAGE_FULL|ENOSPC` outside migrations, fixtures and tests: no writer in `capture-session/` or `capture/supervisor.ts`. `hevc|hvc1|hev1` in `apps/core-web/src`, `apps/mobile/src`, `modules/media-stream`, `modules/evidence-export`: no match. `F_FULLFSYNC|FSYNC` in `WRK`: `sink.c:320-347`. `stall|last_video_mono_us` in `WRK`: `ingest.c:425-431,519,602-603`.

**Amendment 1, re-opened read-only on 2026-10-12** (paths under `apps/input-av/` unless another root is given): `nvr/factory.py:1-203`; `nvr/netalias.py:1-143`; `scripts/dems-netalias:1-46`; `nvr/routers/devices.py:1-183`; `nvr/registration.py:1-78`; `README.md:118-146`; `docs/SERAH-TERIMA.md:78-80,150-158,194-202`; `nvr/settings.py:19-80`; `nvr/onvif_client.py:86-121,198-230`; `nvr/discovery.py:184-216,612-620,643-656`; `nvr/db.py:69-104,182-198`; `nvr/routers/audio.py:20-46,188-198`; `nvr/service.py:141-148`; `scripts/install.sh:84-91`; `deploy/dems-nvr.service:8-21`; `packages/shared/src/sim/vocabulary.ts:24-46`; `decisions/decisions.md:16-19`. Searches: `pabrik|factory|alias|wizard|CAP_NET` over the input-av documents and the files above; `pabrik|alias|wizard|ubah ip` over `docs/UJI-LAN-KANTOR.md` and `docs/SETUP-AWAL.md` (lines 52-56 and 37); `scan-factory|provision|conflict` over `nvr/web/index.html` (lines 793, 1010, 1014, 1027); `setNetworkInterfaces|getNetworkInterfaces|systemReboot|setNetworkDefaultGateway` over `node_modules/onvif/lib` (version 0.8.3: `device.js:230,263,373`, `cam.js:1165`); `TECHNICIAN|CAPTURE_CONFIG` over the shared package (`api/capture-discovery.ts:559`). Nothing under `apps/input-av/data/` and no `.env` was opened; no program was started; the Graft graph was not queried, for the reason given in section 0.

## 14. Verification cells of row 8, checked

| Criterion (`identification/02_structured.md:144`) | Result | Where |
|---|---|---|
| Each ADOPT item and each NEEDS_CHANGE parameter belongs to exactly one WP that names a seam | 14 of 14 and 42 of 42 | section 9, coverage check |
| Every pin of the opener rule reported by step 2 has a lift condition | every row of `R2` section 3, plus the loader and the comments | section 6.3 |
| Both stored-form variants carry a cost line per affected seam, with one recommendation | variants C and I across S1 to S6 and outside; a third variant M; recommendation C | fork F-3 |
| Indonesian summary at the top | present | head of the document |
| Amendment 1: every item made required by U6 belongs to exactly one WP that names a seam | 4 of 4 (H-29, H-30 in WP-19; H-31, H-32 in WP-22; seam S2). The counts of the first row are unchanged: 14 of 14 and 42 of 42 | section 9, coverage check |
| Amendment 1: work packages | 23 (WP-01 to WP-23): 1 re-scoped (WP-19), 1 extended (WP-14), 2 added (WP-22, WP-23), 0 renumbered | section 9 |
| Amendment 1: the home of the network functions is stated as the user's decision, with (b) and (c) as "not chosen" | U7 quoted; 12 design rules DR-1 to DR-12; 8 points for the user in F-4.3; 6 security notes SN-1 to SN-6 | fork F-4, F-4.2 to F-4.4 |
| Amendment 1: data items needing a place in the Core schema are listed with their source and point to the schema design | 20 rows across S1, S2, S3, site and S6; no table designed here | section 4, last table |
| Amendment 1: new change items, impact items, experiments, hypotheses | S2-3 to S2-6 (4); I-13 to I-16 (4); E-13 to E-15 (3); H-S to H-W (5) | sections 4, 10, 9, 12 |

## External research synthesis

No external research dimension is in scope for this task (`identification/01_translated.md:100-102`) and no web source was used. Dimensions 1 to 7: no findings. Every statement about library or browser behaviour is a labelled hypothesis with an experiment.

---
*Generated: 2026-10-12 17:52*
*Last Updated: 2026-10-12, Amendment 1 (U6, U7, U8)*
