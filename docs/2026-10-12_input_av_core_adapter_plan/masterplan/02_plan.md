---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 10
date: 2026-10-12
agent: pm-planner
narrative_tier: 1
source_specs: /Users/gsp-budi/Documents/DEMS/docs/2026-10-12_input_av_core_adapter_plan/masterplan/01_specs.md
source_analysis: /Users/gsp-budi/Documents/DEMS/docs/2026-10-12_input_av_core_adapter_plan/research/03_analysis.md
source_record_map: /Users/gsp-budi/Documents/DEMS/docs/2026-10-12_input_av_core_adapter_plan/research/03_analysis_record_map.md
source_decision_register: /Users/gsp-budi/Documents/DEMS/docs/2026-10-12_input_av_core_adapter_plan/decisions/01_decision_register.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-12_input_av_core_adapter_plan/identification/02_structured.md
source_schema_design: /Users/gsp-budi/Documents/DEMS/docs/2026-10-12_input_av_core_adapter_plan/masterplan/03_db_schema_extension.md
source_test: /Users/gsp-budi/Documents/DEMS/docs/2026-10-12_input_av_core_adapter_plan/test/01_hevc_experiment.md
status: pending - implementation is released by the user to start after this plan passes its three verification rows (U12 B1, P9); until then no source file is changed; nothing in this plan is started by this task
version: 1.1 (integration pass, 2026-10-12: rulings U4 to U13 and P9, Amendment 1 of the design, the schema design, time estimate P8)
---

> **Integration pass (version 1.1).** Changed against version 1.0:
>
> 1. **27 work packages instead of 21**: WP-22 and WP-23 of Amendment 1; WP-24, WP-25, WP-26 of the schema design; **WP-27, new in this plan**: the hardware acceptance test package (procedure document plus scripts).
> 2. **Two tracks** (U13: no hardware is installed during the autonomous development). **Track D**, development on this Mac without devices: every package is built and closed on fakes and doubles. **Track H**, the hardware acceptance test package, run after the user installs the devices: every real-device check that version 1.0 kept inside a package is moved there.
> 3. **Phases:** 0 to 8 and 10 are track D; 9 and the new phase 11 are track H. Phase 0 is no longer "decisions": the decisions are answered (U12). Phase 5 (Linux host profile) and phase 10 (network commissioning functions, required by U6 and placed in the Core by U7) are closed on doubles. Phase 7 is now the building of the test package (WP-27); the hardware milestone WP-15 is its run, in phase 11.
> 4. Need-classes, critical path, decisions-to-phase matrix, risk table, external dependencies and the system-of-record statements updated; a time estimate from row P8 added as section 21, track D and track H separately; a consistency check as section 22.
>
> **Reading rule.** Section 9 keeps the phase texts of version 1.0 where they still hold. Where an "Entry condition" names a decision, that decision is answered (matrix, section 11); where a completion check of version 1.0 named a Linux host or a device, the phase text below says where that check went (table of section 9A). Line references into `masterplan/01_specs.md` written by version 1.0 are of that file before Amendment 1 and were not re-numbered; references added by this pass name the section.

# Phased plan: port of the input-av hardware input logic into the Core adapters

## Ringkasan (Bahasa Indonesia)

Dokumen ini adalah **rencana**. Anda sudah melepas implementasi (U12 B1, P9): mulai **setelah rencana ini lulus tiga baris verifikasinya**; sampai saat itu tidak ada berkas sumber yang diubah. Anda juga memutuskan bahwa **perangkat keras tidak dipasang selama pengembangan otonom** (U13). Karena itu rencana dibagi menjadi dua jalur:

- **JALUR D, pengembangan otonom di Mac ini, tanpa perangkat.** Semua paket kerja dibangun dan ditutup dengan perangkat palsu, termasuk yang ditulis untuk Linux: opener audio ALSA, profil host Linux, helper alias ber-hak khusus, scan alamat pabrik, set IP kamera. Untuk setiap paket disebutkan apa perangkat palsunya dan apa yang karena itu **belum terbukti** (bagian 8). Kerja otonom berhenti sebelum uji perangkat nyata.
- **JALUR H, paket uji penerimaan perangkat keras, setelah perangkat Anda pasang.** Satu hasil kerja, berupa dokumen prosedur dan skrip, yang dibangun selama jalur D (WP-27) dan dijalankan kemudian (WP-15). Isinya semua pemeriksaan perangkat nyata yang dikeluarkan dari paket lain (bagian 9A, H-01 sampai H-20). **Tahap 2 pencabutan kelas C ("dinyatakan layak merekam") hanya diputuskan atas hasil paket ini.** Jalur H tidak mulai dengan sendirinya.

Isi rencana: 27 paket kerja dalam 12 fase (0 sampai 11), setiap paket tepat di satu fase. WP-01..WP-23 dari desain porting (WP-22 dan WP-23 dari Amandemen 1), WP-24..WP-26 dari desain perluasan database (U8, U11), WP-27 baru di rencana ini (paket uji perangkat keras).

| Fase | Jalur | Isi | Ditutup dengan |
|---|---|---|---|
| 0 | D | Rencana lulus verifikasi; tugas 3 di-commit sebagai baseline; branch sendiri | bukti verifikasi dan commit baseline |
| 1 | D | Percobaan H.265 dan pembuktian lain (WP-01, WP-09) | encoder FFmpeg sebagai kamera palsu |
| 2 | D | Skema set A lebih dulu (WP-24), lalu WP-02, WP-04, WP-11 bila perlu | database demo lokal; perangkat ONVIF palsu |
| 3 | D | Jalur kamera di belakang aturan kelas C (WP-03, WP-05, WP-06, WP-10 bila perlu) | kamera RTSP palsu dengan autentikasi |
| 4 | D | Jalur audio Linux/ALSA di belakang aturan kelas C (WP-07, WP-08) | daftar kartu suara tetap; kesamaan teks konfigurasi |
| 5 | D | Profil host Linux dan pemeriksaan host (WP-14, WP-20) | dokumen dan skrip; keluaran perintah tiruan; kontainer atau VM Linux bila tersedia |
| 6 | D | Aturan kelas C dicabut di kode, tahap 1 (WP-13) | registry uji; perilaku pengembangan tidak berubah |
| 7 | D | Paket uji perangkat keras dibangun (WP-27) | tinjauan dokumen; skrip dijalankan kering terhadap perangkat palsu |
| 8 | D | Probe ke alamat yang diketik (WP-12). Tidak direncanakan: WP-16, WP-17. Ditunda: WP-18 | perangkat ONVIF palsu |
| 10 | D | **Fungsi jaringan komisioning** (WP-25, WP-23, WP-19, WP-22, lalu WP-26) | helper tiruan; stub ONVIF dengan panggilan jaringan; database demo lokal |
| 9 | H | Tindakan Anda sebelum uji perangkat keras, di antaranya pengaman data lama (WP-21) | konfirmasi Anda |
| 11 | H | Paket uji perangkat keras dijalankan (WP-15) | hasil H-01 sampai H-20; lalu putusan Anda atas tahap 2 |

Nomor fase 0 sampai 9 tidak diubah dari versi pertama; nomor bukan urutan kerja. Fase 8 dan 10 berjalan di samping fase 3 sampai 6; fase 7 ditutup paling akhir di jalur D karena mengumpulkan pemeriksaan dari semua paket.

Hal yang berlaku di semua fase:

- **Tidak ada yang diubah di bawah `apps/input-av/data/`**, dan tidak ada program input-av yang dijalankan dari folder ini.
- **Tidak pernah ada dua sistem yang merekam sesi yang sama.** Sistem pencatat hanya Core. Selama jalur D, Core hanya membuat sesi uji dari perangkat palsu di Mac ini dan belum merekam sumber produksi sama sekali; input-av hanya dibaca sebagai acuan. input-av di bench hanya untuk uji, bukan pemeriksaan sungguhan, sampai Core bisa merekam (U12 B7).
- **Sistem pencatat untuk komisioning juga hanya Core:** setiap tindakan (scan, alias dipasang, alias dilepas, IP kamera diubah) menjadi satu entri di rantai audit Core; kredensial kamera diketik di konsol web dan tidak disimpan oleh fungsi ini; alat input-av tidak dijalankan untuk komisioning.
- Yang terbukti di perangkat nyata hanya skema kamera input-av selama 54-57 detik per kamera; jalur Core belum pernah berjalan dengan kamera atau kartu suara nyata, dan **tidak akan terbukti selama jalur D**. Cek H.265 yang Anda perintahkan (U4) **sudah berjalan dan lulus untuk bagian worker** (`test/01_hevc_experiment.md`, status "complete"): worker yang ada, tanpa diubah, membawa H.265 ke fMP4-nya, baik bila parameter set diumumkan di SDP maupun bila hanya ada di dalam stream (350 dari 350 frame, 1920x1080, 0 galat decode, 8 `moof`, sample entry `hev1`; kontrol H.264 lulus). Sumbernya encoder di Mac ini, bukan kamera. Cadangan "kamera diatur ke H.264" (A4) tidak terpicu. Masih belum terbukti: kamera nyata, parameter set yang datang terlambat, penyegelan dan verifikasi, pemutaran `hev1`, dan Linux.
- **Risiko terbesar yang baru:** kode khusus Linux (ALSA, helper alias, profil host) dikembangkan di macOS tanpa pernah berjalan di Linux. Rencana membatasinya dengan sambungan platform yang diisi perangkat palsu, dengan kesamaan teks terhadap nilai input-av yang teruji, dan, bila tersedia, dengan kontainer atau VM Linux untuk apa pun yang tidak butuh perangkat. Yang **tidak bisa dibuktikan sebelum jalur H** disebut satu per satu di bagian 8 dan 17 (R-22).
- Karena hanya scan aktif (U9): kamera yang alamat pabriknya tidak ada di daftar hanya ditemukan bila alamatnya diketik.
- Cara kerja (U12 B2 sampai B6): controller memutuskan hal kecil dan mencatatnya; berhenti hanya untuk perubahan lingkup, FAIL keamanan, atau tindakan yang sulit dibatalkan. Tugas 3 di-commit dulu sebagai baseline; branch sendiri; satu commit per fase; tanpa push. Migrasi hanya di database demo lokal, set demi set dengan rollback. Helper alias ditulis dan diuji dengan perangkat palsu; pemasangannya dengan sudo adalah tindakan Anda, setelah tinjauan keamanan. `apps/input-av` tetap tidak dilacak git dan hanya dibaca.
- Jalur kritis jalur D: fase 0, lalu WP-01 dan WP-02 (sejajar dengan WP-24 lalu WP-04), WP-03, WP-06, WP-13, WP-27. Yang masih bisa mengubah arah, bukan keputusan Anda: hasil tinjauan keamanan (relay ditolak berarti worker yang menarik, A3) dan sisa percobaan WP-01 (E-8 menentukan apakah WP-10 perlu, E-10 apakah WP-11 perlu).
- Perkiraan waktu (bagian 21, diturunkan dari baris P8): jalur D sekitar 11 sampai 16,5 hari kerja sebelum tambahan 40 sampai 50 % untuk gerbang dan gelombang perbaikan; jalur H 3 sampai 5 hari menurut P8, ditambah pemeriksaan komisioning, dihitung sejak perangkat terpasang. Ini **perkiraan dari laju terukur tugas 3, bukan janji**, tanpa tanggal. Kapan sesi tersegel pertama dari perangkat nyata terjadi kini bergantung pada kapan perangkat dipasang, bukan pada rencana.

Hampir semua keputusan sudah Anda jawab (U1 sampai U13). Yang tersisa ada di kepala `decisions/01_decision_register.md`: tiga hal kecil, dua hasil yang ditunggu, tindakan Anda untuk paket uji perangkat keras, dan satu putusan nanti (tahap 2).

---

## 1. Overview and frame (5W1H)

| Question | Answer |
|---|---|
| **What** | The order in which the 27 work packages are executed (23 of the port design with Amendment 1, 3 of the schema design, 1 of this plan), as 12 phases (0 to 11) in two tracks: track D, autonomous development on the development Mac without devices; track H, the hardware acceptance test package after the user installs the devices. Each phase has entry condition, tracking list, measurable completion check, rollback, host and prohibitions. |
| **Why** | U1 narrowed the task to porting and U2 made the input-av input scheme the default (`decisions/decisions.md:7-8`). The design of row 8 says what to build; this plan says in which order so that no decision is pre-empted, no hardware is needed early, and no session is ever recorded by two systems (C13, `identification/02_structured.md:52`). |
| **Who** | Decisions: the user, given in U1 to U13. Small matters during the run: the controller, each with a log entry; it stops only for a scope change, a security FAIL and a hard-to-reverse action (U12 B2). Execution: the implementation task with its own blueprint (`identification/02_structured.md:84`); agents named below are recommendations for it. Track H: the user installs, types and rules; the scripts and procedure are the plan's. |
| **When** | Track D starts after this plan has passed its three verification rows (U12 B1; P9, `decisions/decisions.md:26`, which supersedes U3 and U5 that far); until then no source file is changed. Track D ends when all work on the Mac is done and stops before the real-hardware test. Track H starts when the user has installed the devices (U13), not by itself. No phase has a date. Section 21 carries a duration estimate (row P8), not a schedule. |
| **Where** | Target code: `apps/core-server/src/capture/adapters/`, `apps/core-server/src/capture-session/`, `apps/core-server/src/modules/capture-discovery/`, `packages/capture-protocol/`, `packages/shared/`, `apps/capture-worker/` (`masterplan/01_specs.md:29`). Never: `apps/input-av/data/`. |
| **How** | Ordering rule: (1) work that needs no decision and no hardware first; (2) both openers built and proven on doubles behind the opener rule; (3) the host; (4) the lift in one change set; (5) one hardware milestone for camera and audio together; (6) decision-dependent additions on a side track; (7) added by the integration pass: a schema set lands before the first package that writes its tables and never in the same change set (`masterplan/03_db_schema_extension.md`, section 3.2); (8) the required commissioning functions as a phase of their own, behind the security review; (9) since U13: no package waits for a device. A check that needs a Linux host or a device is taken out of its package, given a number H-nn, and collected in the hardware acceptance test package (section 9A); the package is then closed on a double, and its row in section 8 says what the double is and what stays unproven. |

## 2. Source documents

- Structured task: `identification/02_structured.md` (row 10 at line 146, profile line 168, constraints C10-C13 at lines 49-52, gating at lines 200-240)
- Specification (port design): `masterplan/01_specs.md` (seams S1-S6, WP table at lines 374-396, lift conditions at lines 182-227, forks at lines 229-362)
- Analysis: `research/03_analysis.md`, `research/03_analysis_record_map.md`
- Decision register: `decisions/01_decision_register.md` (version 1.1)
- Decisions: `decisions/decisions.md` (U1 to U13, P1 to P9)
- Draft plan: none existed
- Added by the integration pass: Amendment 1 of the specification (fork F-4 with F-4.1 to F-4.4; section 9 with 23 packages); `delegation_progress/amendment_1_network_tools.md` (changed packages); schema design `masterplan/03_db_schema_extension.md` (sets A to E, WP-24 to WP-26, OQ-1 to OQ-5, finding F-DB-1); `test/01_hevc_experiment.md` (WP-01, E-1 and E-2, worker half, ordered by U4: status `complete`; E-1 PASS, E-2 PASS, H.264 control PASS; its section 2 lists what stays unproven)

## 3. Goals

- G6: the work is sorted by what it needs: development host with fakes, a user decision, real hardware on a Linux host. Since U12 and U13 the sorting is by track: what is closed on doubles during development, and what only the hardware acceptance test package can show.
- G7: every phase has a completion check, a rollback and its risks.
- C13: at every phase exactly one system of record; input-av keeps no recording role.
- C11: the tested input scheme becomes the default of the production adapters, and only what is proven is called proven.

## 4. Requirements summary

- **Functional:** fill the two production adapters that refuse today (`ONVIF_RTSP`, `USB_AUDIO`), prove HEVC through the worker or fall back, lift the opener rule for both kinds in one change set, pass one hardware milestone (`masterplan/01_specs.md:42-48`).
- **Non-functional:** no Core guarantee weakened (credential write-only, single audit chain, sealing); ready-made libraries for protocol work (`masterplan/01_specs.md:247`).
- **Functional, added by U6, U7, U8:** network commissioning of a factory-new camera as a Core function (temporary alias on the camera port, scan of factory addresses, set camera IP, wait for the camera by MAC); the Core's PostgreSQL schema extended in three sets for the data of the ported functions.
- **Functional, added by U13:** one hardware acceptance test package, a procedure document plus scripts, that holds every real-device check (WP-27 builds it, WP-15 is its run).
- **Constraints:** C10 porting only; C11 input-av scheme as default; C12 stored form: the Core's (U12 A1); C13 no second system of record; no source file changed before the plan's verification passes (P9); D76 an agent never types, stores or receives a real camera credential; U9 active scan only, no passive monitor; U10 commissioning by the TECHNICIAN role only; U11 no stored row for a device that is not adopted, no automatic choice of the camera interface, three schema sets; U12 A2 production host Linux, Ubuntu 24.04; U12 B3 own branch, a commit per phase, no push; U12 B4 migrations on the local demo database only; U12 B5 the privileged helper is installed by the user, not by an agent; U13 no device during development.

## 5. Standing rules, valid in every phase

| # | Rule | Authority |
|---|---|---|
| SR-1 | **Nothing under `apps/input-av/data/` is modified, at any phase, by any agent, tool, test or build.** No phase opens the folder. The one package that concerns it, WP-21, is performed by the user in person, changes no file content, and is a guard, not a migration | P2 (`decisions/decisions.md:6`); `masterplan/01_specs.md:362` |
| SR-2 | **No input-av program is started from this tree**, and none is installed or run on a host that runs a Core. Reason: the application, the doctor and the level meter write into `data/` when started from the source directory | `research/03_analysis_record_map.md:353,378` |
| SR-3 | **The go-ahead is given, with bounds.** Implementation starts only after this plan has passed its three verification rows; until then no source file is changed. It then runs autonomously through track D and **stops before the real-hardware test**. Track H does not start by itself: it starts when the user has installed the devices. Inside track D the controller stops for a scope change, a security FAIL and a hard-to-reverse action. (Version 1.0 read: "phase 0 is decisions only and no phase starts by itself", on U3 and U5; P9 supersedes both as far as B1 says) | U12 B1, B2 (`decisions/decisions.md:24`); U13 (`:25`); P9 (`:26`); earlier U3 (`:13`), U5 (`:15`) |
| SR-9 | **Git and database bounds.** Task 3 is committed first as the baseline; the work is on its own branch, one commit per phase, no push. `apps/input-av` stays untracked: no add-all, no clean of untracked files. Migrations run on the local demo database only, set by set, each with its rollback tried; never on another database | U12 B3, B4, B6 |
| SR-10 | **No privileged installation by an agent.** The alias helper is written and tested on doubles. Installing it, its sudoers line and its root-owned interface file is the user's act, after the security review. No agent runs `sudo`, changes a host address, or acts on a real camera | U12 B5; D76 (4) |
| SR-11 | **Closed on a double is not proven on a device.** A package closed in track D is reported as "done on doubles" with its unproven list (section 8). Stage 2 of the class-C lift is ruled only on the result of the hardware acceptance test package | U13; U12 A5; SR-7 |
| SR-4 | **One system of record.** A session is recorded by exactly one system, the Core. No comparison run in which input-av and the Core record the same cameras or microphones at the same time | C13; U1 |
| SR-5 | **No agent types, stores or receives a real camera credential.** On real hardware the operator types it in the web console | D76 via `masterplan/01_specs.md:390` |
| SR-6 | No file of `apps/input-av/` is deleted, renamed or edited. The tree is the reference the port is read from | `masterplan/01_specs.md:367` |
| SR-7 | A package is never reported as "tested" on the strength of the input-av bench. Its completion check says what proves it | `masterplan/01_specs.md:67` |
| SR-8 | A hypothesis of the design (H-A to H-R) is never a planning assumption. Where an experiment's outcome changes the plan, the change is written into the Issues and Decisions Log before the next package starts | `masterplan/01_specs.md:441` |

## 6. System of record, per phase

"May record" means: may write a session that anyone treats as a record.

| Phase | System of record | State of the Core's production recording | What input-av may still do |
|---|---|---|---|
| 0 (track D) | Core, as today | `REAL_PRODUCTION` records nothing: the opener rule refuses both production kinds | Be read as source. Nothing else from this tree (SR-2) |
| 1, 2 (track D) | Core, as today. Sessions made on fakes are test sessions of the development host | Unchanged: nothing recordable in `REAL_PRODUCTION` | As phase 0 |
| 3, 4 (track D) | Core. The new adapters exist only inside test registries | Unchanged: the opener list is not edited, the production registry is empty | As phase 0 |
| 5 (track D) | Core, on the development Mac. No Linux host exists in track D; where a Linux container or VM is used it runs builds and checks, never a session that is treated as a record | Unchanged | As phase 0 |
| 6 (track D) | Core | Recordable **in code**. No production Core boots without X-1 and X-2, and none is declared recordable (stage 1) | As phase 0 |
| 7 (track D) | Core. The test package is a document and scripts; building it records nothing | As phase 6 | As phase 0 |
| 8, 10 (track D) | Core, for every commissioning action as well. In track D the actions are performed against a helper double and an ONVIF stub: the audit entries they write are test entries of the development database | Not affected: commissioning is refused while a session is open (rule DR-1) | As phase 0. It is **not** run for commissioning, on any host: the design's option (c), input-av as built as an interim tool, is "not chosen" and no exception is recorded. No tool survives as an input-av tool: the network functions are Core functions (U7), the host checks move into the Core and gain setting is deferred (U12 A10) |
| 9, 11 (track H) | Core, the only recorder of the acceptance session and the only record of every commissioning action on the real cameras | First production sessions, on the acceptance host only. **Declared fit to record only by the user's ruling on the package's result (stage 2)** | It does not record the package's cameras or microphones during the run (SR-4), is not installed on the acceptance host (TC-1), and is guarded by WP-21 before any of its programs is started from this tree |

**Between track D and track H**, however long the devices take: the Core records no production source; what exists is code "done on doubles". The bench installation of input-av is for tests only, not real examinations, until the Core can record (U12 B7). "Can record" is stage 2, so that rule holds until the user has ruled on the result of track H.

**Who is the system of record for commissioning (phase 10 on doubles, phase 11 on real cameras).** The Core, and only the Core.

| Fact | Where it is recorded | What is not a record |
|---|---|---|
| A scan was run; a host address was added, removed, or its removal failed; a camera's network was set; a registered camera's address changed | One entry per action in the Core's single audit chain (rule DR-11; types defined in WP-23) | No private log, no input-av audit chain |
| Which temporary addresses are in place, and when each ends | `host_network_aliases` in the Core database (schema set B, WP-25) | The in-memory timer of input-av is not carried |
| Camera interface, camera subnet, factory address list, alias octet and lifetime, first camera address | `capture_network_config` in the Core database (WP-25) | The root-owned interface file the helper reads is an enforcement copy written at installation, not a system of record; a difference between the two is a named refusal (`masterplan/03_db_schema_extension.md`, section 2.4) |
| Devices found by a scan | Nowhere: the result is a list in memory for the screen (U11 on OQ-1) | No stored inventory of devices that are not adopted |
| The camera credential typed for a job | Nowhere by this function. Storage happens only through the existing adoption (operation 96) into the sealed, write-only store | No plain-text registration as in input-av's wizard |
| An adopted camera's address | `capture_devices.address`, the existing registry column | - |

The camera holds its own address; the Core records that it requested the change and what it then found by MAC. A camera already moved is not moved back by a rollback of the Core (section 9, phase 10).

**Transition point, ruled by U12 B7.** The existing input-av installation on its own bench machine (`identification/01_translated.md:152`) is outside this repository and outside this plan. Version 1.0 proposed a rule and asked for its confirmation; the user has ruled: the bench input-av is for tests only, not real examinations, until the Core can record. Whatever it records stays what the hand-over document calls it, test recordings (`research/03_analysis_record_map.md:346`), and falls under the answer to Q3 (a separate archive, not imported). What it does after the Core can record is not stated by B7; version 1.0's proposal, that it then records nothing treated as a record, is kept as a proposal.

## 7. High-level phases

**Track D: autonomous development on the development Mac, no device, no Linux host required.**

| Phase | Name | Work packages | Sizes | Closed on | What it still waits for, other than work |
|---|---|---|---|---|---|
| 0 | Plan verified, baseline, branch | none | - | Verification evidence; the baseline commit of task 3; the branch | The three plan-verification rows (P9) |
| 1 | Proofs on fakes | WP-01 (partly done: E-1, E-2), WP-09 | S, S | FFmpeg encoders as cameras; the worker's own fake microphone | - |
| 2 | Schema set A and building blocks | WP-24, WP-02, WP-04, WP-11 (conditional) | S, S, M, M | Local demo database; fake ONVIF device | WP-11: the outcome of E-10 |
| 3 | Camera opener behind the rule | WP-03, WP-05, WP-06, WP-10 (conditional) | M, M, M, S to M | Fake RTSP camera with authentication; fake ONVIF device | The security review's finding on the relay (fallback ruled, A3); WP-10: the outcome of E-8 |
| 4 | Audio opener for Linux/ALSA, behind the rule | WP-07, WP-08 | M, M | Fixed card listings; text equality with the quoted input-av values; a fake capture helper | - |
| 5 | Linux host profile and host checks | WP-14, WP-20 | M, S | Profile document and scripts; fixture command outputs; a Linux container or VM if available, for what needs no device | - |
| 6 | Class-C lift in code (stage 1) | WP-13 | S | Test registries; unchanged development behaviour | The security review's acceptance (condition L-2); the amending row AM-1, written by the controller under A6 |
| 7 | Hardware acceptance test package built | WP-27 (new) | M (this plan's sizing) | Review of the procedure; scripts dry-run against the doubles | Closes last in track D |
| 8 | Additions | WP-12 (in scope, A7); WP-16 (not planned, A1); WP-17 (not planned, A8); WP-18 (deferred, A10) | M, -, -, - | Fake ONVIF device (WP-12) | - |
| 10 | Network commissioning functions | WP-25, WP-23, WP-19, WP-22, WP-26 | S, S, M, M, S | Helper double; ONVIF stub with the network calls; local demo database | The security review on the helper and the credential path; the choice inside AM-7; for WP-26 the assignment of its writer (log item I-11) |

**Track H: hardware acceptance, after the user has installed the devices. Does not start by itself.**

| Phase | Name | Work packages | Sizes | Host | Needs from the user |
|---|---|---|---|---|---|
| 9 | User actions before the hardware test | WP-21 (legacy data guard) | S | none: user actions | UA-1 to UA-6, X-1, X-2 (section 13) |
| 11 | Run of the hardware acceptance test package; ruling on stage 2 | WP-15 | M | Linux host, Ubuntu 24.04, two cameras, two microphone inputs, a factory-new camera | Presence at the bench; typed passwords; the ruling |

Count: track D 2 + 4 + 4 + 2 + 2 + 1 + 1 + 4 + 5 = 25; track H 1 + 1 = 2; **27 work packages, each in exactly one phase.** Of the 25 in track D, 20 are built, 2 are conditional on an experiment (WP-10, WP-11) and 3 are placed but not built (WP-16, WP-17, WP-18).

**Order.** Phase 0, then phases 1 to 6 as the spine. Phase 5 has no dependency on phases 1 to 4 and runs beside them. Phase 10 runs beside phases 3 to 6 once WP-24 has landed (file order of the schema sets) and the security review has reported on the helper. Phase 8's WP-12 runs beside them; if WP-12 lands before WP-19 the unicast probe is built there and reused, otherwise WP-19 builds it. Phase 7 (WP-27) is opened with phase 1, because each package hands over its moved checks as it closes, and is closed last. Track D ends there; the autonomous run stops (U12 B1). Phases 9 and 11 follow only when the user has installed the devices (U13). Phase numbers 0 to 9 are those of version 1.0; numbers are not an execution order.

## 8. Need-class of every work package

Version 1.0 sorted the packages into "development host", "waits for a decision" and "real hardware". The decisions are answered (U12) and no hardware exists during development (U13), so the classes are re-drawn. Rule, so that each package has exactly one class:

- **H**: executed in track H (it needs the installed devices or the user in person).
- **N**: placed but not built, by a ruling (not planned, or deferred).
- **C**: built only if an experiment's outcome demands it.
- **D**: everything else: built and closed in track D on a double.

The last three columns are the point of the table: what stands in for the device, what therefore stays unproven until track H, and which checks of section 9A carry it.

| WP | Phase | Size | Class | Double in track D | Stays unproven until track H | Checks moved to track H |
|---|---|---|---|---|---|---|
| WP-01 | 1 | S | D, **partly done** | FFmpeg and libx265 encoders on the same host pushing RTSP into the release worker; the worker's fake microphone. E-1 and E-2 done and passing (`test/01_hevc_experiment.md`); E-8, E-10, E-11 and the written verdict remain | H.265 from a real camera: its packetisation, sender-report clock, long GOPs, B-frames, parameter sets later than the probe window, higher bit rates; Linux and another libavformat build | H-09, H-20 |
| WP-02 | 2 | S | D | Real child processes on macOS; the Linux parent-death method behind a platform seam, exercised in a Linux container or VM if available | The parent-death method on the production kernel and service manager | H-02 |
| WP-03 | 3 | M | D | Fake RTSP camera with authentication | A real camera's RTSP over TCP: authentication variants, keep-alive, timestamps, the camera's clock against the host | H-09 |
| WP-04 | 2 | M | D | Fake ONVIF device with two video sources | Profile answers and tokens of real cameras (finding F-DB-1, hypothesis H-DB-1) | H-10 |
| WP-05 | 3 | M | D | Fake device that reports H264 and delivers HEVC | The stream test against a real camera inside 15,000 ms | H-09, H-10 |
| WP-06 | 3 | M | D | Fake camera killed and restarted; a foreign push | Reconnect of a real camera after a link loss; the clock offset of a real camera | H-09, H-11 |
| WP-07 | 4 | M | D | Fixed card listings as text fixtures behind an injected enumerator | The listing of the real interface; stable card identity across a re-plug; hot-plug | H-07 |
| WP-08 | 4 | M | D | Text equality of the generated shared-capture configuration and helper arguments with the quoted input-av values; a fake helper that writes samples to the pipe | Everything ALSA does: whether shared capture opens on the real interface, the rate figure, the first-second full-scale sample, levels (E-5). On the bench the recordings of this scheme were practically silent | H-08 |
| WP-09 | 1 | S | D | None needed: a pure computation over all 16,777,216 values | Nothing device-related | - |
| WP-10 | 3 | S to M | C | As WP-01 | As WP-01 | H-20 |
| WP-11 | 2 | M | C | As WP-01 (a push that pauses and resumes) | A real camera's pause and resume | H-11 |
| WP-12 | 8 | M | D | Fake ONVIF device answering a unicast probe at a typed address; the firewall rule as text in the host profile | The probe against a real camera; whether the firewall rule alone would have sufficed | H-12 |
| WP-13 | 6 | S | D | Test registries; the 21 pins checked row by row | A production boot (X-1, X-2); anything recorded from a production source | H-16, H-17 |
| WP-14 | 5 | M | D | The profile as a document with scripts; fixture outputs; an Ubuntu 24.04 container or VM if available for the worker build, its check script and package presence | Firewall with real probe answers; audio group and device access; sleep inhibition; time sync; the sync level on the production disk (H-K: a container's file system is not it); the sudoers installation | H-01, H-03, H-05, H-12 |
| WP-15 | 11 | M | H | - (it is the run) | - | H-01 to H-20 |
| WP-16 | 8 | - | N, not planned (U12 A1) | - | - | - |
| WP-17 | 8 | - | N, not planned (U12 A8) | - | - | - |
| WP-18 | 8 | - | N, deferred (U12 A10) | - | - | - |
| WP-19 | 10 | M | D | A helper double with the helper's argument contract and exit codes; the real helper script run with stand-ins for `ip` and `arping`; the ONVIF stub | That the helper changes a real interface correctly; `arping` conflict detection; expiry of the address by the kernel with the Core killed (hypothesis H-S); the wrong-network guard on a host with two real interfaces | H-05, H-06, H-13 |
| WP-20 | 5 | S | D | Fixture outputs of the host probes behind an injected command runner | The checks on the real host | H-04 |
| WP-21 | 9 | S | H (the user in person) | - | - | - |
| WP-22 | 10 | M | D | The ONVIF stub extended with the network calls | How real cameras answer `SetNetworkInterfaces`, the gateway call and the reboot (hypothesis H-T); the wait by MAC in real time; two cameras on one address | H-14, H-15 |
| WP-23 | 10 | S | D | The development database and the audit writer's tests | Nothing device-related | - |
| WP-24 | 2 | S | D | The local demo database (U12 B4) | Nothing device-related | - |
| WP-25 | 10 | S | D | As WP-24 | Nothing device-related | - |
| WP-26 | 10 | S | D | As WP-24 | Nothing device-related; its writer is unassigned (I-11) | - |
| WP-27 | 7 | M | D | Review of the procedure against section 9A; every script run dry against the doubles of the package it checks | That the scripts work on the real host: their first real run is the test itself | all of H-01 to H-20 |

Totals: **D = 20** (WP-01 to WP-09, WP-12, WP-13, WP-14, WP-19, WP-20, WP-22 to WP-27); **C = 2** (WP-10, WP-11); **N = 3** (WP-16, WP-17, WP-18); **H = 2** (WP-15, WP-21). Sum 27.

"If available" for a Linux container or VM is meant literally: this row ran no command and does not know whether one can be run on the development Mac. Whether it is used is a controller's decision with a log entry (B2). Nothing in a completion check of track D depends on it.

## 9. Phases in detail

The phases below are grouped by track. Phases 0 to 8 and 10 are **track D**; phases 9 and 11 are **track H**. For phases 1 to 6 the text of version 1.0 is kept and a line "Track D (U12, U13)" says what changed; a version 1.0 entry condition that names a decision is met (section 11).

### Phase 0 (track D). Plan verified, baseline, branch

Version 1.0 called this phase "Decisions and go-ahead". The decisions are answered (U1 to U13) and the go-ahead is given with bounds (U12 B1, P9), so the phase is what remains before the first source file may change.

- **Goal:** the plan has passed its three verification rows; task 3's work is committed as the baseline; the implementation works on its own branch; the few remaining small items are decided or knowingly left.
- **Entry condition:** rows 11 to 13 of this task have reported. Row 13's findings on the relay (SA-1 to SA-3), on the privileged helper (DR-2), on the credential path (DR-8) and on hypothesis H-V are available.
- **Host:** the development Mac. No source file is changed in this phase except by the baseline commit of task 3's existing work.
- **System of record:** section 6.

Tracking list:

- [ ] The three plan-verification rows have passed; the evidence is quoted where the controller records it
- [ ] Row 13's finding on the relay recorded: accepted (phase 3 as designed) or rejected (the worker pulls, A3; phase 3 is re-planned before it starts). A security FAIL stops the run (B2)
- [ ] Row 13's finding on the helper, the credential path and H-V recorded; phase 10 does not start without it
- [ ] Task 3's uncommitted work committed as the baseline (B3); the commit named in the log
- [ ] The branch created; no push (B3)
- [ ] Cited lines of the design re-opened against the baseline and corrected; the schema pins of `masterplan/03_db_schema_extension.md` section 3.4 (tables, columns, migration files, schema version 6, `dbc-7`) re-measured against the baseline (section 12)
- [ ] The amending decision rows for AM-2 to AM-8 written by the controller under U12 A6, to the extent of the register's sections 5 and 5.1 (AM-1 is written at the lift)
- [ ] Small items decided with a log entry, or left: P3 confirmation; the choice (a) or (b) inside AM-7; the writer of the acceptance record (I-11)
- [ ] The implementation task's blueprint created with tracks D and H

- **Completion check:** verification rows passed: 3 of 3. A baseline commit exists and `git status` of the Core, worker and package folders is clean against it. The branch exists; pushes: 0. Cited lines that no longer match the baseline and were not corrected: 0. Amending rows written: 7 (AM-2 to AM-8).
- **Rollback:** the branch is deleted; the baseline commit of task 3 stays, because it is task 3's own work.
- **Must NOT:** change a source file of the Core, the worker or the packages before the three rows have passed; push; add or clean untracked files in a way that touches `apps/input-av` (B6, risk R-1); treat a passed verification as permission for track H; widen an amendment beyond the register's columns.

### Phase 1. Proofs on fakes (WP-01, WP-09)

- **Goal:** know whether "the codec the camera delivers" is a parameter or a project, and whether the three behaviours the relay design leans on hold, before any product code is written.
- **Entry condition:** phase 0 complete. No decision of the register.
- **Host:** development Mac with fakes. No camera, no audio interface.
- **System of record:** Core, as today; `REAL_PRODUCTION` records nothing.
- **Track D (U12, U13); state of WP-01: partly done.** By the user's order U4, E-1 and E-2 were run before this phase, on the unchanged release worker, with generated sources, and both pass (`test/01_hevc_experiment.md`, status `complete`). Done, exactly: the H.264 control (PASS); E-1 as variant `hevc_a`, parameter sets in the SDP (PASS: hevc / `hev1`, 1920x1080, 350 of 350 expected frames, 0 decode errors, 8 `moof`, extradata 85); E-2 as variant `hevc_b2`, in-band only, no `a=fmtp` line (PASS: the same figures, extradata 87 taken from the stream); a first attempt `hevc_b` was not the intended case and counts as nothing; `INGEST_NO_EXTRADATA` not logged in any run; the Core's tail validation on the files: CLEAN, which is not sealing. Of E-1's three criteria in the design, "HEVC logged with extradata above 0" is met and the sample-entry name is recorded (`hev1`); "the Core reader reports HEVC" and "the session seals and verifies" were **not** exercised and remain with E-8. **Not done:** E-8, E-10, E-11, the written verdict over all five, WP-09. The script and its results lie under `.cache/hevc-experiment/`, which is git-ignored: the fixtures that phase 1 keeps are made in this phase, on the branch. The H.264 fallback of A4 is not triggered by E-1 and E-2.

Tracking list:

- [x] WP-01 / E-1: HEVC stream with parameter sets in its description pushed into the worker's listener (worker half: PASS; reader, sealing and verification remain under E-8)
- [x] WP-01 / E-2: the same with in-band parameter sets only (PASS; a stream whose first parameter sets come later than the probe window was not exercised)
- [ ] WP-01 / E-8: the sealed session of E-1 opened in the web console, the tablet and an export
- [ ] WP-01 / E-10: a push that pauses and resumes
- [ ] WP-01 / E-11: a push to another path or from a second client
- [ ] WP-01: written verdict, one outcome per run
- [ ] WP-01: the moved check handed to WP-27: H.265 from a real camera (H-09), playback of real-camera material (H-20)
- [ ] WP-09 / E-6: every 24-bit value survives the conversion to 32-bit float
- [ ] WP-09: transport statement for production written
- [ ] Consequences written into the log: WP-10 needed or not (on E-8: do the clients play `hev1`, does the Core reader report HEVC and its frame rate); WP-11 needed or not (on E-10); where measure SA-2 must live (on E-11)

- **Completion check:** the WP-01 verdict holds five results, each one of "pass", "fail" or the named outcome of its run: E-1 against the three criteria of `masterplan/01_specs.md:278` (HEVC logged with extradata above 0, the Core reader reports HEVC, the session seals and verifies) with the sample-entry name recorded; E-2 as "recorded file" or `INGEST_NO_EXTRADATA`; E-8 per client as "plays" or "states that it cannot"; E-10 as "one file with a gap" or not; E-11 as "refused" or "accepted". E-6 passes for all 16,777,216 values. The change set contains fixtures, tests and the verdict only: 0 product source files changed.
- **Rollback:** remove the one change set of fixtures and tests. Nothing else depends on it.
- **Must NOT:** change worker or Core product code; edit `NOT_H264` or the opener list; declare H.265 a default; use a real camera or a real credential; take a hypothesis as a result without its run.

### Phase 2. Schema set A and building blocks (WP-24, WP-02, WP-04, WP-11 if triggered)

- **Goal:** the two parts every camera package stands on, built and proven on doubles: the process door that hands over a start message, and profiles with a credential-free locator. Added by the integration pass: before them, schema set A, which gives the recording path its tables.
- **Entry condition:** phase 0 complete. For WP-11: phase 1 reports that E-10 failed. No decision of the register. For WP-24: no ruling is waited for (U11 on OQ-5: three separate sets); the baseline is fixed and its schema pins re-measured (phase 0).
- **Host:** development Mac with fakes; for WP-24 the local demo database and the test PostgreSQL, never another database (B4).
- **System of record:** Core, as today.
- **Track D (U12, U13).** WP-24 lands **first** and in a change set of its own: the schema design's order rule is that a set lands before the first package that writes its tables (WP-04 writes `capture_device_streams`) and never in the same change set. One migration writer at a time. WP-02's Linux confirmation, which version 1.0 carried to phase 5, is check H-02 of track H.

Tracking list:

- [ ] WP-24: typed schema for `capture_device_streams`, `capture_audio_inputs` and the column `session_capture_sources.source_facts`
- [ ] WP-24: generated migration file and hand-written privileges file; schema version 6 to 7, contract revision `dbc-7` to `dbc-8`; file numbers taken at generation time
- [ ] WP-24: the pins that move (tables 43 to 45, migration files 15 to 17, and the others of the schema design's section 3.4), re-measured from the generated file, not copied from the design
- [ ] WP-24: contract delta, kept-table entries, a per-set test
- [ ] WP-24: applied to the local demo database and rolled back once, as B4 asks ("set by set with rollback")
- [ ] WP-04: finding F-DB-1 handled: the selector and the profile list carry a Core code; the ONVIF token, which may hold lower-case letters, dots, colons or hyphens, lives in `capture_device_streams`; hypothesis H-DB-1 settled by one test with such a token
- [ ] WP-02: production process door as a second pinned file; the local door is not edited
- [ ] WP-02 / E-7: no child survives an abrupt end of the Core
- [ ] WP-02: static test that every argument is a literal
- [ ] WP-04: one profile per video source, largest pixel area first
- [ ] WP-04: locator of a profile without a user part, resolved at each open
- [ ] WP-11 (only if E-10 failed): the ingest accepts a resumed push

- **Completion check:** E-7 lists 0 surviving child processes; against a fake ONVIF device with two video sources the adapter returns exactly 2 profiles with the larger area first, and a locator that contains no user part; a device that answers with a user part is refused. If WP-11 ran: E-10 passes and the worker's existing suite shows 0 changed results. The connection test of a `REAL_DEVELOPMENT` Core gives the same outcome as before on the existing H.264 fixtures. For WP-24 (the schema design's verification): `db:generate` reports no drift; the set applies to an empty and to a seeded version-6 database; existing rows are unchanged; the runtime role can neither delete from the new tables nor read more than the grants state; a `FAKE` session still starts; the schema version reads 7; every moved pin passes at its re-measured value. A profile token with a lower-case letter is adopted and assigned to a slot: 1 test, passing.
- **Rollback:** revert each package's change set. The production door has no caller until phase 3; the profile type change is reverted together with its static test. WP-24: while the set is only on development and demo databases, revert the commit and rebuild the database with the reset command; once applied to a database that matters, a new forward set drops the two tables and the column, and an applied file is never edited. An undo loses stream and sound-card rows, which are re-read, and the facts of sessions recorded meanwhile, which are not recoverable (`masterplan/03_db_schema_extension.md`, section 3.5).
- **Must NOT:** register a production adapter anywhere but a test registry; edit the opener list or the stubs' `hasOpener` literal; open an RTSP connection to a real camera; change the worker unless WP-11 was triggered; put WP-24 and WP-04 in one change set; run a migration on any database but the local demo and test databases; add the columns of set D or the tables of sets B and C to this set; edit an applied migration file; have two migration writers at once.

### Phase 3. Camera opener behind the rule (WP-03, WP-05, WP-06, WP-10 if triggered)

- **Goal:** a production camera can be opened, tested and recorded through the relay on doubles, with the credential never leaving the start message, while `REAL_PRODUCTION` still records nothing.
- **Entry condition:** phase 1 complete (outcomes of E-2 and E-11 known); WP-02 and WP-04 done. Decisions: **F-1** ruled, with row 13's acceptance of SA-1 to SA-3 if variant A; **AM-2** recorded (WP-05); **P3** confirmed; **F-2** ruled if any run of WP-01 did not pass (WP-10). *(Version 1.0 text. State now: phase 0 complete; WP-24 landed, for WP-05; F-1, AM-2 and F-2 answered by U12; P3 is a small remaining item that does not stop the phase, log item I-16.)*
- **Host:** development Mac with fakes (a fake ONVIF device and a fake RTSP camera with authentication).
- **System of record:** Core. The adapters exist only in test registries.
- **Track D (U12, U13).** The decisions named in the entry condition are answered: F-1 = the relay, with the worker pull as ruled fallback if row 13 rejects it (A3); AM-2 accepted (A6); F-2 ruled (A4), and its H.264 fallback is not triggered by E-1 and E-2, which pass. Still needed from phase 1: the outcome of E-11 (where SA-2 lives) and of E-8 (whether WP-10 runs). If row 13 rejected the relay, this phase is re-planned for variant B before it starts and the re-plan is logged. WP-05's codec result is written to `capture_device_streams.codec` (WP-24). Moved to track H: a real camera through the relay, its codec judged from the stream, clock offset and counters (H-09); the connect flow with real profile tokens (H-10); reconnect after a link loss (H-11).

Tracking list:

- [ ] WP-03: relay program, pull over RTSP/TCP, push to the ingest address, video only
- [ ] WP-03: probe mode
- [ ] WP-03 / E-12: credential absent from the argument list, the environment, both output streams and every log
- [ ] WP-05: stream-level half of the connection test; codec judged from the stream
- [ ] WP-05: outcome vocabulary extended additively; `NOT_H264` kept
- [ ] WP-06: `openSource` starts the relay at the injection point
- [ ] WP-06: retry rule 2 s, then 2, 4, 8, 16, 30 s; loss callback; presence
- [ ] WP-06: measures SA-2 and SA-3
- [ ] WP-06: clock offset reported; audit writers for the camera-loss types
- [ ] WP-10 (only if WP-01 demands it): HEVC sample-entry name; frame rate for HEVC in the Core reader

- **Completion check:** in a test registry a session on fakes records through the relay; E-12 finds 0 occurrences of the credential in the four places named; a fake device that reports H264 and delivers HEVC is reported as HEVC; the RTSP probe runs only after the ONVIF half authenticated; the whole connection test stays inside 15,000 ms; a killed fake camera is retried by the stated rule and resumes in the same track; a foreign push ends the track as a fault and is not sealed as that camera. If WP-10 ran: E-1 and E-8 repeated and passing. The suite of a `REAL_DEVELOPMENT` Core shows 0 changed results.
- **Rollback:** leave the production camera adapter unregistered: the relay is inert without a start message. WP-05 is additive, so reverting it restores the H.264-only filter; audit rows written meanwhile keep values that stay in the value set. The ingest-address change (SA-2) is reverted on its own (`masterplan/01_specs.md:411-417`).
- **Must NOT:** add a production kind to the opener list; wire the production loader into the boot; put the credential in a URL, argument, environment variable or file; use the FFmpeg command-line program or a ready-made media server for the camera leg; remove `NOT_H264` from the value set; contact a real camera; forward camera audio.

### Phase 4. Audio opener behind the rule (WP-07, WP-08)

- **Goal:** a named card and input can be enumerated, assigned and opened with the tested ALSA parameters, proven on fixed listings and on text equality with the quoted input-av values.
- **Entry condition:** WP-02 done. Decisions: **Q7** answered "Linux"; **P3** confirmed for the audio defaults. If Q7 is answered "macOS" this phase is re-planned: the tested audio scheme does not apply. *(Version 1.0 text. State now: phase 0 complete; WP-24 landed, for WP-07; Q7 answered Linux, Ubuntu 24.04, by U12 A2; P3 as in phase 3.)*
- **Host:** development Mac with fakes for the build and for this phase's completion check. The real card listing (H-07) and experiment E-5 on the interface (H-08) are checks of track H, phase 11.
- **System of record:** Core. The adapter exists only in test registries.
- **Track D (U12, U13).** Q7 is answered: Linux, Ubuntu 24.04 (A2). This phase writes Linux and ALSA code on macOS, where ALSA does not exist: nothing here opens an audio device. What limits the risk: the enumerator and the helper start are platform seams filled with doubles; the generated configuration and the argument list are compared as text with the values quoted from the tested input-av source; the Linux argument table sits beside the macOS one, so the macOS path keeps running in the existing suite. The card identity and input number get typed columns in `capture_audio_inputs` (WP-24, phase 2), which settles log item I-3; this phase writes no migration of its own. What version 1.0 carried forward is now in track H: the real card listing and hot-plug (H-07) and experiment E-5 on the interface (H-08). WP-08 closes here as "done on doubles"; it is **not** confirmed until H-08 has run.

Tracking list:

- [ ] WP-07: enumeration with native channel count, formats, stable card identity; no automatic choice
- [ ] WP-07: named error for an input beyond the card
- [ ] WP-07: allocation rules (one-room form) and hot-plug detection
- [ ] WP-07: card identity and input number written to `capture_audio_inputs` (schema set A; log item I-3 settled by the schema design), not packed into the address column; the device facts of a session written to `session_capture_sources.source_facts`
- [ ] WP-07: audit writers for the microphone fault types
- [ ] WP-08: `dsnoop` plus `plug` configuration generated per card into the Core's run directory
- [ ] WP-08: Linux helper argument table beside the macOS one
- [ ] WP-08: `level()` and the pre-check short open
- [ ] Handed to WP-27: the real card listing and hot-plug (H-07); experiment E-5 on the real interface (H-08)

- **Completion check:** on fixed card listings the enumerator returns the expected inputs; an input beyond the card is refused with the named error; a search of the adapter for an automatic card choice finds 0; the generated configuration and the helper argument list are text-equal to the values quoted from the input-av source (`masterplan/01_specs.md:177-179`). WP-08 is marked "done on doubles, confirmation pending" until E-5 has run.
- **Rollback:** revert the change sets; registry rows for microphone inputs are disabled, never deleted (`masterplan/01_specs.md:415`).
- **Must NOT:** add a production kind to the opener list; build gain setting (WP-18); run a second generator of the shared-capture configuration on one host; start input-av's meter or test record; choose a card automatically; add a database migration (the tables come from WP-24); report WP-08 as tested or confirmed.

### Phase 5 (track D). Linux host profile and host checks, on doubles (WP-14, WP-20)

Version 1.0 ran this phase on a Linux host with real hardware. Under U13 no such host exists during development, so the phase produces the profile and the checks and proves what can be proven without the host.

- **Goal:** the Linux host profile for Ubuntu 24.04 (A2) as a document with its scripts, complete enough that the user can apply it line by line when the host exists; and the host checks inside the Core's boot checks and diagnostics (A10), tested against fixture outputs.
- **Entry condition:** phase 0 complete. No dependency on phases 1 to 4 for the profile. The helper clause of WP-14 (sudoers line, root-owned interface file, `arping`, the camera activation step) is written after WP-19's helper contract exists (phase 10); see log item I-10.
- **Host:** the development Mac. A Linux container or VM of Ubuntu 24.04 **if one is available**, for what needs no device: building the worker against the pinned library, running its own check script, the presence of the packages the profile names, the parent-death method of WP-02.
- **System of record:** Core on the development Mac. A container or VM never holds a session that is treated as a record.

Tracking list:

- [ ] WP-14: the profile document: worker build on the pinned library, firewall rule for probe answers, audio group and device access, sleep inhibition, time sync, private run directory
- [ ] WP-14: the scripts of the profile, each with a mode that prints what it would do and changes nothing
- [ ] WP-14: the helper clause, written as steps for the user (SR-10): where the helper goes, its owner and mode, the sudoers line, the root-owned interface file, `arping` present, the camera activation step of rule DR-12
- [ ] WP-14: what the profile cannot settle without the host, listed: hypothesis H-K (sync level on Linux), the firewall rule against real probe answers, device access
- [ ] WP-20: host prerequisites named at boot and in diagnostics, behind an injected command runner; one test per prerequisite with the fixture output of "present" and of "missing"
- [ ] WP-20: the check that the helper file and the sudoers line are root-owned and not writable by the service user (note SN-1), on fixture outputs
- [ ] Handed to WP-27: H-01 (profile applied, worker check script), H-02 (parent-death), H-03 (H-K), H-04 (a removed prerequisite is named), H-05 (helper installed), H-12 (firewall and discovery)

- **Completion check:** the profile has one line per item of WP-14's content in the design, each with the command or file it means and the check that shows it took effect: items without a check line: 0. Every script passes its print-only mode on the development Mac. For each host prerequisite of WP-20: 2 tests (present, missing), all passing; with a "missing" fixture the boot names that prerequisite. The development suite shows 0 changed results. If a container or VM was used: the worker's check script result and the package list are recorded, and it is stated that they are container results. **Not part of the check, because no host exists:** a probe answer from a camera, a session on the host, the real card listing; these are H-01, H-03, H-07, H-12.
- **Rollback:** the profile is a document and scripts; nothing is applied to any host in track D. WP-20 is one change set.
- **Must NOT:** apply the profile to any machine; run `sudo` or install the helper (SR-10); report the profile as tested on a host; start a `REAL_PRODUCTION` Core; treat a container result as the production host's (in particular for the sync level, where the container's file system is not the production disk); change the sync-level rule without a decision row; install or run input-av anywhere (SR-2).

### Phase 6. Class-C lift in code, stage 1 (WP-13)

- **Goal:** one change set that makes both production kinds opener-capable together, with every pin of the rule in its stated end state.
- **Entry condition:** conditions L-1 to L-5 (`masterplan/01_specs.md:190-197`): **AM-1** recorded, which needs **Q9** answered; the answer to SEC35-40 built (phase 3) and accepted by the security review; the credential check E-12 passed; an outcome for HEVC (WP-01 passed, or the fallback of **F-2** chosen); WP-02 to WP-09 complete on doubles, that is phases 1 to 4.
- **Host:** development Mac with fakes.
- **System of record:** Core. Recordable in code; not declared recordable.
- **Track D (U12, U13).** Q9 is answered: one lift, two stages (A5); AM-1 is accepted (A6) and its amending row is written by the controller with this change set. Condition L-4 has its worker half from E-1 and E-2; whether E-8 belongs to it is the controller's call, logged. Condition L-5 reads "complete on doubles": that is how phases 1 to 4 close, with their unproven lists. **This phase is stage 1 only.** Stage 2 is not a step of track D: it is the user's ruling on the result of the hardware acceptance test package (phase 11). Moved to track H: a production boot with X-1 and X-2 (H-16) and the first session from production sources (H-17).

Tracking list:

- [ ] The list: both production kinds added
- [ ] The two stub literals replaced by the built adapters
- [ ] The production registry wired: the boot calls the loader
- [ ] Tests rewritten or kept as section 6.3 of the design states, row by row
- [ ] Errata for code comments (stage 1 only)
- [ ] Decision row AM-1 cited in the change set

- **Completion check:** each of the 21 rows of the pin table (`masterplan/01_specs.md:207-227`) is in its stated end state, checked row by row; the suite of a `REAL_DEVELOPMENT` Core shows 0 changed results; an adapter of kind `SNMP_POE` that states an opener is still refused.
- **Rollback:** revert the one change set. No stored data depends on it; sessions already sealed stay valid (`masterplan/01_specs.md:410`).
- **Must NOT:** lift one kind alone; withdraw the limits in the task 3 README or specification (that is stage 2); declare production recordable; touch `SNMP_POE`; start a production Core with the demonstration password; change what is stored.

### Phase 7 (track D). Hardware acceptance test package built (WP-27)

Version 1.0 had the hardware milestone WP-15 here. Under U13 the milestone cannot run during development. What track D can deliver is the package that the milestone will be: WP-27, a new work package of this plan. Its run is WP-15, in phase 11.

- **WP-27, definition.** Content: one procedure document and its scripts that hold every real-device check taken out of the other packages, H-01 to H-20 of section 9A; for each check its precondition, steps, expected result and pass criterion; the user actions the package needs; the order of the checks; the form of the result record; the rule for stage 2. Size: M (this plan's sizing: twenty checks, most of which wrap an operation that already exists). Depends on: every package of track D that hands over a check (build). Host: development Mac. Verification: below.
- **Goal:** when the user has installed the devices, the acceptance can be run from the document alone, by the user and a person at the bench, without anyone having to work out what to check or what counts as a pass.
- **Entry condition:** phase 0 complete. Opened with phase 1 and filled as packages close; closed after phases 1 to 6, 8 and 10.
- **Host:** development Mac.
- **System of record:** Core. Building the package records nothing.

Tracking list:

- [ ] The procedure document, one section per check H-01 to H-20, each with: what it proves and for which package; precondition; steps, numbered, with who performs each (user, person at the bench, script); expected result; pass criterion as a count, a value against a stated bound, or a named outcome; what to record
- [ ] The scripts: read-only collectors of evidence (counters, log lines, listings, file probes) and wrappers of existing operations. No script types a credential, runs `sudo`, changes a host address, or changes a camera: those steps are written as steps for the user
- [ ] The list of user actions with the check each serves: UA-1 to UA-6, X-1, X-2 (section 13)
- [ ] The order of the checks and their dependencies (section 9A), and which checks may be skipped without voiding the session check H-17
- [ ] The bounds that have no value today, each marked "to be set before the run": drift tolerance of E-9 (I-5), offset tolerance of the clap test (H-18)
- [ ] The result record: one line per check with pass, fail or not run, and the evidence; the summary the user rules stage 2 on
- [ ] The stage 2 rule, stated in the document: "declared fit to record" is ruled by the user only on this record; "recorded, not sealed" is not a pass; a partial pass is reported as partial
- [ ] Every "unproven" cell of section 8 is covered by at least one check, or is listed as not covered with the reason

- **Completion check:** checks in the document: 20 of 20, each with all six parts: missing parts 0. Every script runs to its end against the doubles of the package it checks and writes a result record in the stated form (a dry run: it proves the script, not the device). Unproven items of section 8 without a covering check and without a stated reason: 0. Steps that an agent would have to perform with a credential, with `sudo` or on a real camera: 0. Reviewed by the verification agents of the implementation task before track D is reported complete.
- **Rollback:** the package is a document and scripts in one change set.
- **Must NOT:** be reported as a test result: until phase 11 it is a procedure; contain a pass criterion that only says "works"; contain a real credential, key or address of the user's network; start an input-av program; let a script change anything on a host or a camera.

### Phase 8 (track D). Additions (WP-12 built; WP-16, WP-17 not planned; WP-18 deferred)

Version 1.0 called this phase "decision-dependent additions" and held WP-19 here as "not executed". The decisions are in (U12), and WP-19 is a required function in phase 10.

| WP | State by ruling | What is done in track D |
|---|---|---|
| WP-12 | **In scope** (U12 A7: a probe to an address typed by the technician is allowed; AM-3 accepted by A6) | Built on doubles |
| WP-16 | **Not planned** (U12 A1: the Core's stored form; a lossless track is decided separately later) | Its nine stored-form parameters are recorded as "not carried", with the decision row. Nothing is built |
| WP-17 | **Not planned** (U12 A8: one room per Core) | Recorded as not planned |
| WP-18 | **Deferred** (U12 A10), with the three columns of schema set D (U11 on OQ-3) | Recorded as deferred. No gain column, no gain audit type, no screen |

- **Goal:** the typed-address probe exists and is proven on doubles; the three packages that are not built are closed on paper so that nothing is left ambiguous.
- **Entry condition:** phase 0 complete. WP-12 has no dependency on other packages; it shares its unicast probe with WP-19 (phase 10), and whichever lands first builds it. Its audit type for a re-address (M/G-3) is defined once, in whichever of WP-12 and WP-23 lands first.
- **Host:** development Mac with fakes.
- **System of record:** Core. Every action a ported function performs is a Core audit type or is not performed.

Tracking list:

- [ ] WP-12: typed-address unicast probe; a body on the search operation; limits
- [ ] WP-12: operator-confirmed re-address with its audit type; never automatic
- [ ] WP-12: the firewall rule for probe answers, as a line of the host profile (WP-14)
- [ ] WP-12: handed to WP-27: the probe against a real camera and the firewall rule on the real host (H-12)
- [ ] WP-16: nine parameters recorded as not carried, citing U12 A1
- [ ] WP-17: recorded as not planned, citing U12 A8
- [ ] WP-18: recorded as deferred, citing U12 A10

- **Completion check:** against a fake ONVIF device a typed address yields 1 candidate from the probe answer alone; re-addresses that happen without an operator's confirmation: 0; a typed address outside the allowed form is refused; the search without a typed address behaves as before (0 changed results). Each of WP-16, WP-17, WP-18 has one log line with its decision row: 3 of 3.
- **Rollback:** WP-12 is its own change set and reverts alone; its audit type stays in the value set after a revert so that written rows remain valid.
- **Must NOT:** carry the ARP sweep, ping or the direct unauthenticated ONVIF check into the camera search (the commissioning scan of phase 10 is a different operation with its own amendment, AM-5); follow a changed camera address automatically; build any part of WP-16, WP-17 or WP-18; add the columns of schema set D.
- **If the user later wants the lossless track (A1) or gain setting (A10):** each is a new ruling and its own package; a lossless track decided after phase 11 means repeating the affected checks of track H.

### Phase 9 (track H). User actions before the hardware test, with the legacy data guard (WP-21)

Since U13 this phase is the user's preparation of track H. It holds the one work package that is a user action, WP-21, and lists the other user actions the acceptance run needs; those are not work packages (section 13: UA-1 to UA-5, X-1, X-2).

- **Goal:** the existing data of input-av has no writer.
- **Entry condition:** Q3 is answered (U12 A9: a separate archive, not imported). Independent of every phase of track D; it may be done at any time. It **must** be done before any step, in any task, that would start a program from the input-av tree. This plan contains no such step, in either track.
- **Host:** none. A user action; no agent performs it.
- **System of record:** not affected. A frozen archive adds no owner (`research/03_analysis_record_map.md:351`).

Tracking list:

- [ ] The user has chosen the guard form: folder moved out of the tree, or set read-only, or left in place under SR-2
- [ ] The user has confirmed that it is done

- **Completion check:** the user's confirmation is recorded as a decision row. No agent verifies it by opening the folder.
- **Rollback:** the user moves the folder back or restores its permissions.
- **Must NOT:** be performed, checked or prepared by an agent; change, import, convert, hash or delete any file in the folder; be skipped on the grounds that the folder is ignored by git.

### Phase 10 (track D). Network commissioning functions, on doubles (WP-25, WP-23, WP-19, WP-22, WP-26)

Added by the integration pass. The user made these functions required (U6), placed them in the Core (U7), limited them to an active scan (U9) and to the TECHNICIAN role (U10), and accepted the amendments they need (U12 A6). Under U13 the phase is built and closed without a Linux host and without a camera.

- **Goal:** a technician can, in the Core's web console: choose the camera interface once; scan the stored factory addresses and one typed address from a temporary alias; set a factory-new camera's address and have the Core find it again by its MAC; with every action recorded once in the Core's audit chain. In track D: all of it against a helper double and an ONVIF stub.
- **Entry conditions:**
  1. Phase 0 complete; the amending rows for AM-4 to AM-8 written (register, section 5.1).
  2. **Privileged helper reviewed by security:** row 13's finding on rule DR-2 and notes SN-1, SN-2 is recorded and is not a FAIL. Without it WP-19 does not start. Its finding on the credential path (DR-8, SN-4) and on hypothesis H-V is recorded before WP-22 starts.
  3. The choice inside AM-7 is made before WP-22 starts (typed again for adoption, or alive for one job); log item I-12.
  4. WP-24 has landed (file order of the schema sets: A before B before C).
  5. **Linux host: not an entry condition in track D.** Version 1.0 of this pass named it; under U13 the host is a precondition of checks H-05, H-06, H-13, H-14, H-15 instead. The function itself is Linux only (rule DR-1): on the development Mac the real operations answer "not available on this host", and the tests reach the logic through the platform seam.
- **Order inside the phase:** WP-25 (schema set B), then WP-23 (audit types, the commissioning permission), then WP-19 (helper, guard, scan), then WP-22 (set camera IP, the fourth credential-carrying operation, wait by MAC, screens); WP-26 (schema set C) last.
- **Host:** development Mac. Doubles: a helper double with the helper's argument contract and exit codes; the helper script itself run with stand-ins for `ip` and `arping`; the existing ONVIF stub extended with the network calls; the local demo database (B4).
- **System of record:** the Core, and only the Core (section 6, table "Who is the system of record for commissioning"). In track D the audit entries are test entries of the development database.

Tracking list:

- [ ] WP-25: `capture_network_config` (one row; interface nullable: no automatic choice, U11 on OQ-4) and `host_network_aliases` (one alias in place per address, enforced by the database); schema version 7 to 8; pins re-measured; applied and rolled back once on the local demo database
- [ ] WP-23: audit types for scan run, host address added, removed, removal failed, camera network set, registered camera address changed; their detail keys against the closed lists; no credential in any detail
- [ ] WP-23: the commissioning permission, held by TECHNICIAN only (U10); not by SUPERVISOR, not by INVESTIGATOR
- [ ] WP-19: the helper as a file for the user to install: `add` and `del` only; the interface read from a root-owned file, not from the caller; RFC 1918 with `/24` only; the conflict check mandatory; no packet capture (U9)
- [ ] WP-19: the Core's one caller of the helper through `sudo -n`; no `CAP_NET_ADMIN`; no direct `ip addr`
- [ ] WP-19: the wrong-network guard (rule DR-4); refusal while a session is open (DR-1); "not configured" while no interface is chosen
- [ ] WP-19: removal at the end of a job, at shutdown and at start, each audited; the start-up sweep against `expires_at`
- [ ] WP-19: the scan as an operation of its own: stored list plus one typed address; result in memory, not stored (U11 on OQ-1)
- [ ] WP-22: set camera IP in a pinned file of its own; the MAC read before and matched after; next free address; refusal on the conflict flag and on an address that answers
- [ ] WP-22: the fourth credential-carrying operation, web console only; the credential in memory for the job, never in a log, audit detail, file, argument or environment
- [ ] WP-22: the screens of the web console, showing the target address and the MAC read (note SN-4)
- [ ] WP-26: `installation_acceptances`; schema version 8 to 9; applied and rolled back once. Before it lands: its writer assigned (I-11)
- [ ] Handed to WP-27: H-05 (helper installed by the user), H-06 (E-13: alias, conflict, expiry by the kernel), H-13 (scan on a factory-new camera), H-14 (E-14: set IP, found by MAC), H-15 (E-15: two cameras on one address)

- **Completion check in track D, on doubles.** Schema: sets B and C apply to an empty and to a seeded database of the version before them; a second open alias on one address is refused by the database; a second acceptance in force is refused; each moved pin passes at its re-measured value. Helper script with stand-ins: it refuses another interface, a public address, a prefix other than `/24`, an address the stand-in for `arping` reports in use, and a missing `arping`: 5 refusals of 5. Core against the helper double and the stub: each action leaves exactly 1 audit entry; with a session open, every commissioning operation is refused and writes: 0; a target subnet held by another interface is refused; a scan result that reports two endpoints on one address blocks set-IP; a job against the stub ends with the same MAC found at the new address; occurrences of the credential in logs, audit details, arguments, environment and files: 0; adoption afterwards goes through operation 96 only; the permission is held by 1 role, TECHNICIAN. The development suite shows 0 changed results.
- **Completion check on real cameras (track H, phase 11; not part of closing this phase).** H-05: the helper installed by the user is root-owned and not writable by the service user, and refuses as above on the real interface. H-06 (E-13): the alias is added, refused on a real conflict, and gone after its lifetime with the Core killed, which settles hypothesis H-S. H-13: a factory-new camera on a listed or typed factory address is found by the scan. H-14 (E-14): the camera is moved to the camera subnet and found again by its MAC, the operator typing the credential. H-15 (E-15): two cameras on one factory address are flagged and neither is changed. Until these have run, the phase is "done on doubles" and the function is **not** to be used on an installation.
- **Rollback.** Functions: unregister the operations; the audit types and the permission stay in their value sets so that written rows remain valid (design, impact item I-14). Helper, once installed in track H: remove the sudoers line and the helper, after which the function answers "not permitted"; an address left behind expires if H-S holds, otherwise it is deleted by hand (I-13). Schema set B: revert the commit while only development and demo databases hold it; later, a forward set that drops the two tables, with the precondition that no alias row is open. Schema set C: a forward set that drops its table. **Not rolled back by the Core:** a camera that was already moved keeps its new address; the operator moves it again (I-15).
- **Must NOT:** let an agent run `sudo`, install the helper, change a host address, type a camera credential or act on a real camera (SR-10, D76 (4)); carry the passive monitor or any packet capture (U9); sweep a network by ARP; follow a camera by MAC automatically in the background; give the Core `CAP_NET_ADMIN`; pick the camera interface automatically (U11); store a device that is not adopted (U11); store the credential or hand it to anything but the ruled path; run while a session is open; run any input-av tool for commissioning; put a schema set and its first writer in one change set; report the phase as tested on cameras.
- **What active scan only means here (U9).** A camera on a factory address that is neither in the stored list nor typed by the technician is not found. On the bench the three Tiandy cameras sat on addresses that are not default entries of the list. The list is a setting the technician can extend, and the scan takes one typed address; the screen should say so (risk R-21).

### Phase 11 (track H). Run of the hardware acceptance test package; ruling on stage 2 (WP-15)

WP-15 is the hardware milestone of the design. In this plan it is the run of the package that WP-27 built, extended by the checks moved out of the other packages.

- **Goal:** every check H-01 to H-20 has a recorded result; one session from four production sources is recorded, sealed and verified on the Linux host; the commissioning functions have run on real cameras; the user has what is needed to rule on stage 2.
- **Entry condition:** track D complete and reported, with its "done on doubles" lists. The user has installed the devices (U13) and done the actions of phase 9 and section 13: the Ubuntu 24.04 host and access to it (UA-1); two cameras, an audio interface with two microphone inputs, a factory-new camera, and for H-15 a second camera on the same factory address (UA-2); the helper installed with `sudo` after the security review (UA-3); X-1 and X-2; a person at the bench (UA-5). The bounds marked "to be set before the run" are set (I-5). Whether disk protection in real capture is a precondition is decided (R-16).
- **Starts:** when the user says the devices are installed. Not by itself, and not as the last step of the autonomous run (U12 B1).
- **Host:** the Linux host with the devices.
- **System of record:** the Core, and only the Core, for the session's sources and for every commissioning action (SR-4; section 6).

Tracking list: the checks of section 9A in their stated order; then:

- [ ] The result record completed, one line per check
- [ ] Failures sorted: a fault of the host or the installation (corrected by the profile, the check repeated) or a fault of the code (a fix wave on the development Mac, then the affected checks repeated)
- [ ] The summary put to the user for the ruling on stage 2
- [ ] Only after that ruling: the stage 2 errata, withdrawing the limits in the task 3 README and specification

- **Completion check:** checks with a recorded result: 20 of 20, each "pass", "fail" or "not run" with its reason. For the session (H-17): 1 session from 4 production sources recorded, sealed, and verified; "recorded, not sealed" is **not** a pass. Measured values recorded against their bounds: E-9 drift in milliseconds; the clap-test offset in milliseconds; the three ingest counters; the result of the first-second check of the audio. **Stage 2 is ruled by the user on this record and on nothing else.** The plan does not fix which checks must pass for "fit to record"; it reports them all, and marks H-08, H-09, H-16, H-17 as those without which no session from production sources exists at all.
- **Rollback:** if the result does not support stage 2: nothing is declared; the stage 2 errata are not issued; the code stays at stage 1, or the WP-13 change set is reverted and `REAL_PRODUCTION` is unrecordable again; sessions already sealed stay valid. The host profile and the helper are undone on the host by the user.
- **Must NOT:** let an agent type, store or see a credential or the signing key; let an agent run `sudo` or install anything on the host; let input-av record the same cameras or microphones during the run; change a camera's clock or any setting other than its network address from the Core; issue the stage 2 errata before the ruling or on a partial pass; treat the acceptance recordings as real examinations before stage 2 is ruled (B7).

## 9A. The hardware acceptance test package: checks moved out of the packages

This is the content WP-27 turns into a procedure with scripts. "Pass criterion" is what the plan can state today; where a bound has no source it says so.

**Order.** H-01 to H-04 (the host) first; H-05, H-06 (the helper) need H-01; H-07, H-08 (audio) need H-01; H-12 to H-15 (network functions on cameras) need H-05; H-10, then H-09, H-11 (camera) need the cameras on the camera subnet, which H-13 and H-14 provide for a factory-new camera; H-16 needs X-1 and X-2; H-17 needs H-08, H-09 and H-16; H-18, H-19, H-20 need H-17.

| Check | Proves, for | Precondition | Steps (summary) | Expected result | Pass criterion | User actions |
|---|---|---|---|---|---|---|
| H-01 | The host profile on Ubuntu 24.04 (WP-14) | The host exists | Apply the profile line by line; build the worker against the pinned library; run the worker's own check script; run each "took effect" check of the profile | The worker builds; time sync, sleep inhibition, run directory, audio access are as the profile states | The check script passes; profile lines whose check fails: 0 | UA-1 |
| H-02 | No child process outlives the Core on Linux (WP-02, E-7) | H-01 | Start a session on fakes on the host; end the Core abruptly; list the processes | No relay, helper or worker remains | Surviving child processes: 0 | UA-1 |
| H-03 | The sync level on Linux, hypothesis H-K (WP-14) | H-01 | Start a session on fakes on the host's evidence disk; read the stated sync level and the notices | Either no critical notice, or H-K holds | The outcome is recorded. If a critical notice is raised in every session, that is a finding that needs a decision row on the sync-level rule; it is not waved through | UA-1 |
| H-04 | The host checks name a missing prerequisite (WP-20) | H-01 | Remove one prerequisite; boot; read boot output and diagnostics; restore it | The boot names that prerequisite | Named: 1 of 1; after restoring, no prerequisite is named | UA-1 |
| H-05 | The privileged helper as installed (WP-19; helper clause of WP-14) | H-01; the security review passed | The user installs the helper, the sudoers line and the interface file; the script reads owner and mode; the helper is called with another interface, a public address, a prefix other than `/24` | Root-owned, not writable by the service user; each bad call refused | Ownership and mode as stated; refusals: 3 of 3; the Core's boot check of the helper passes | UA-1, UA-3 |
| H-06 | Alias lifetime and conflict, experiment E-13, hypothesis H-S (WP-19) | H-05; the camera interface chosen in the console | Add an alias through the console; repeat with a device already holding that address; add again with a short lifetime and kill the Core; read the interface after the lifetime | Added; refused on conflict; removed by the kernel without the Core | The address is absent after its lifetime with the Core killed; the conflict case is refused; each action has 1 audit entry; after restart the open alias row is closed | UA-1, UA-5 |
| H-07 | The real card listing and hot-plug (WP-07) | H-01; the audio interface connected | List the inputs in the console; unplug and re-plug the interface; list again | The interface with its native channel count; the same card identity after re-plug; the unplug reported | Channel count equals the device's; identity unchanged; inputs chosen automatically: 0 | UA-2, UA-5 |
| H-08 | ALSA shared capture on the real interface, experiment E-5 (WP-08) | H-07; two microphones connected | Feed the microphone pipe from the shared-capture device; read the rate figure and warnings; inspect the first second; speak into each microphone and read the level | Capture opens; rate as requested; audible level on both inputs | Capture opens on both inputs; the first-second check for the full-scale sample has a recorded result; the level check passes on both. On the bench this scheme's recordings were practically silent, so a silent input is a fail, not a note | UA-2, UA-5 |
| H-09 | H.265 from a real camera through the relay; codec judged from the stream; clock offset; experiment E-4 (WP-01, WP-03, WP-05, WP-06) | H-10 | Record one camera through the relay; read the ingest line, the three counters, the anchoring mode and the clock offset; probe and decode the file | The ingest reports the codec the camera delivers; a decodable file | Codec in the ingest line equals the stream's; `INGEST_NO_EXTRADATA` not logged; decode errors: 0; frames in the file equal the worker's packet count; the camera's clock inside the worker's 2 s bound, or the offset recorded as a finding. If H.265 fails here, the ruled fallback applies: the camera is set to H.264 by the installer and the check is repeated (A4) | UA-2, UA-4 |
| H-10 | The connect flow with real profile tokens, experiment E-3; finding F-DB-1 (WP-04, WP-05) | A camera on the camera subnet | The operator runs the connect flow and types the password; read the outcome and the listed profiles; assign a profile to a slot | Authenticated; one profile per video source, largest first; assignable | The test stays inside 15,000 ms; a profile whose token has characters outside the code form can be assigned; a credential in any log: 0 | UA-2, UA-4 |
| H-11 | Reconnect of a real camera (WP-06; WP-11 if built) | H-09 | During a recording unplug the camera's cable for a stated time; restore it | The fault is raised and cleared; recording resumes in the same track | One file with a gap; retries follow the stated rule; fault raised: 1, cleared: 1 | UA-5 |
| H-12 | Discovery on the real network: firewall rule, multicast answer, typed-address probe (WP-14, WP-12) | H-01; a camera on the camera subnet | Run the search; then probe a typed address | Probe answers arrive; the typed address yields a candidate | Multicast answers: at least 1; candidate from the typed address: 1; whether the firewall rule alone sufficed is recorded | UA-2 |
| H-13 | The factory-address scan on a factory-new camera (WP-19) | H-05, H-06; a factory-new camera plugged in alone | Run the commissioning scan with the stored list; if not found, type the address from the camera's label | The camera is listed with its address | Found from the list or from the typed address; which of the two is recorded (U9: no passive monitor); scan audited: 1 entry | UA-2, UA-5 |
| H-14 | Set camera IP and wait by MAC, experiment E-14, hypothesis H-T (WP-22) | H-13 | The operator sets the camera's address in the console and types the factory or activation account; wait | The camera answers at the new address with the same MAC | Same MAC at the new address inside 180 s; 1 audit entry for the change; a credential in any log or audit detail: 0; adoption afterwards through the existing flow | UA-2, UA-4 |
| H-15 | Two cameras on one factory address, experiment E-15 (WP-22) | H-13; a second camera on the same factory address | Scan; attempt set-IP | The conflict is reported; set-IP is refused | Neither camera changed: 0 changes | UA-2, UA-5 |
| H-16 | A production boot (WP-13) | H-01; X-1; X-2 | Boot a `REAL_PRODUCTION` Core | It starts | Starts with the provisioned key; refuses the demonstration password | X-1, X-2 |
| H-17 | One session from two cameras and two microphone inputs, sealed and verified (WP-15, the milestone) | H-08, H-09, H-16 | Record, stop, seal, verify | A sealed session that verifies | Sessions from 4 production sources recorded, sealed and verified: 1. "Recorded, not sealed" is not a pass | UA-2, UA-4 |
| H-18 | Audio and video in step: the clap test (collected by U13; not an experiment of the design) | H-17 | A person claps in view of both cameras and in reach of the microphones at the start and at the end of a recording; the offset between the picture and the sound of the clap is read from the sealed file | A small, stable offset | Offset in milliseconds at start and at end, against a tolerance **that has no source today and must be set before the run** | UA-5 |
| H-19 | Drift over a long session, experiment E-9, hypothesis H-J | H-17 | A recording of one to two hours with a clap at the start and at the end | Drift within tolerance | Drift in milliseconds against the tolerance set before the run (I-5) | UA-5 |
| H-20 | Playback of real-camera material (E-8 on real material; WP-10 if built) | H-17 | Open the sealed session in the web console, the tablet and an export | It plays, or the client states that it cannot | Per client: "plays" or "states that it cannot"; a client that fails silently is a fail | UA-1 |

**What the package cannot do.** It runs once, on one host, with the user's cameras and interface: it shows that the port works there. It does not show other camera models, other audio interfaces or another kernel.

## 10. Task breakdown (tracking table)

One step per work package: 27 rows. Agents are recommendations for the implementation task's blueprint. Status is `pending` for every package but WP-01, of which two experiments ran before the plan by the user's order (U4); `skipped` marks a package that a ruling takes out of this run. "Depends On" marks a dependency as (b) build, the other package must be done, or (c) contract, only its interface or design is needed. Dependencies on WP-24 and WP-25 come from the schema design's order rule and are not in the design's own package table.

| Step | Phase | Track | Task Description | Agent_to_Invoke | Expected Output | Depends On | Verification | Status | Notes / Issues |
|------|-------|-------|------------------|-----------------|-----------------|------------|--------------|--------|----------------|
| WP-01 | 1 | D | HEVC and gap proof on fakes: E-1, E-2 (done), E-8, E-10, E-11 | coder-execution (fixtures); test-expert (runs) | Fixtures and a written verdict over five experiments | - | Phase 1 check | in-progress: partly done | E-1 PASS, E-2 PASS, H.264 control PASS (`test/01_hevc_experiment.md`); E-8, E-10, E-11 and the verdict remain. No product code |
| WP-09 | 1 | D | Transport statement; E-6 | coder-execution | One unit check | - | All 24-bit values survive | pending | |
| WP-24 | 2 | D | Schema set A: streams, audio inputs, session source facts; version 6 to 7 | database-specialist | Typed schema, two migration files, moved pins, per-set test | - | Phase 2 check, schema part | pending | First in the phase; own change set; local demo database only |
| WP-02 | 2 | D | Production process door; E-7 | coder-execution | Second pinned door file with static test | - | 0 surviving children on macOS | pending | Linux: H-02 |
| WP-04 | 2 | D | Profiles and locator; finding F-DB-1 | coder-execution | `profiles` and `pullUrl` on doubles; stream rows | WP-24 (b) | Phase 2 check | pending | Real tokens: H-10 |
| WP-11 | 2 | D | Conditional: resumed push accepted | coder-execution | Worker change set | WP-01 (b: E-10) | E-10 passing | pending | Only if E-10 fails |
| WP-03 | 3 | D | Pull relay with probe mode; E-12 | coder-execution | `capture-relay` program | WP-01 (b: E-11), WP-02 (b) | Phase 3 check | pending | Variant by row 13's finding (A3). Real camera: H-09 |
| WP-05 | 3 | D | Stream test; codec from the stream | coder-execution | Extended connection test | WP-03 (b), WP-24 (b) | Phase 3 check | pending | AM-2 accepted. Real camera: H-09, H-10 |
| WP-06 | 3 | D | `openSource`, retry, presence, SA-2, SA-3, audit writers | coder-execution | Camera adapter on doubles | WP-02, WP-03, WP-04 (b) | Phase 3 check | pending | Reconnect on a real camera: H-11 |
| WP-10 | 3 | D | Conditional: HEVC sample entry, reader frame rate | coder-execution | Worker and reader change set | WP-01 (b: E-8) | E-1 and E-8 passing | pending | Only if E-8 demands it; if more than WP-10 names, the follow-up package of A4 |
| WP-07 | 4 | D | Audio enumeration, identity, allocation, hot-plug | coder-execution | Audio adapter, enumerate half | WP-24 (b) | Phase 4 check | pending | Real listing: H-07 |
| WP-08 | 4 | D | Shared-capture configuration, Linux helper table, level | coder-execution | Audio adapter, open half | WP-02, WP-07 (b) | Text equality | pending | Closes "done on doubles"; E-5: H-08 |
| WP-14 | 5 | D | Linux host profile for Ubuntu 24.04, as document and scripts | docker-specialist or coder-execution | Profile document; scripts with a print-only mode | WP-19 (c: helper contract, for its helper clause) | Phase 5 check | pending | Applied by the user in track H: H-01, H-03, H-05, H-12 |
| WP-20 | 5 | D | Host checks in boot and diagnostics | coder-execution | Boot checks on fixture outputs | WP-14 (c) | Missing prerequisite named, on fixtures | pending | In scope (A10). Real host: H-04 |
| WP-13 | 6 | D | Class-C lift change set, stage 1 | coder-execution; security-review as gate | One change set | WP-01 to WP-09 (b) | 21 pin rows in end state | pending | AM-1 written with it. Stage 2 is not here |
| WP-27 | 7 | D | Hardware acceptance test package: procedure and scripts for H-01 to H-20 | pm-writer or document-writer (procedure); coder-execution (scripts); test-expert (review) | One procedure document; scripts; result-record form | Every package that hands over a check (b) | Phase 7 check | pending | New in this plan. Closes last in track D |
| WP-12 | 8 | D | Typed-address probe; confirmed re-address | coder-execution | Discovery change set | - | Phase 8 check | pending | In scope (A7). Shares the probe with WP-19. Real camera: H-12 |
| WP-16 | 8 | D | Stored-form addition | - | Nine closure lines | - | Log line with U12 A1 | skipped | Not planned |
| WP-17 | 8 | D | Several rooms per Core | - | - | - | Log line with U12 A8 | skipped | Not planned |
| WP-18 | 8 | D | Gain setting with audit type; schema set D | - | - | - | Log line with U12 A10 | skipped | Deferred |
| WP-25 | 10 | D | Schema set B: network configuration, host aliases; version 7 to 8 | database-specialist | Typed schema, two migration files, moved pins, per-set test | WP-24 (b: file order) | Phase 10 check, schema part | pending | Own change set |
| WP-23 | 10 | D | Audit types of the commissioning actions; the commissioning permission | coder-execution | Vocabulary and permission change set | Schema design (c) | Writer accepts the types, rejects a foreign detail key; TECHNICIAN only | pending | Its schema part is WP-25 (log item I-9) |
| WP-19 | 10 | D | Alias helper, its caller, wrong-network guard, commissioning scan | coder-execution; security-review as gate | Helper file; Core operations | WP-23 (c), WP-25 (b) | Phase 10 check on doubles | pending | Needs row 13 on the helper. Installed by the user. Real: H-05, H-06, H-13 |
| WP-22 | 10 | D | Set camera IP; fourth credential operation; wait by MAC; screens | coder-execution; security-review as gate | Core operation and web console screens | WP-19, WP-23 (b) | Phase 10 check on doubles | pending | Needs row 13 on the credential path and the AM-7 choice. Real: H-14, H-15 |
| WP-26 | 10 | D | Schema set C: installation acceptance; version 8 to 9 | database-specialist | Typed schema, two migration files, moved pins, per-set test | WP-25 (b: file order) | Phase 10 check, schema part | pending | Writer unassigned: I-11 |
| WP-21 | 9 | H | Legacy data guard | the user | Confirmation | - | Decision row | pending | No agent |
| WP-15 | 11 | H | Run of the hardware acceptance test package: H-01 to H-20; then the ruling on stage 2 | the user with a person at the bench; test-expert for the record | Result record; the user's ruling | WP-27 (b), all of track D (b) | Phase 11 check | pending | Starts only when the devices are installed |

## 11. Decisions against phases (all answered), and what still waits

Version 1.0 used this matrix to show which phase waits for which open decision. Every entry is answered now, so the matrix shows two things: **"A"**, the phase (or the named package in it) is governed by an answer that is given; **"W"**, the phase or package still waits for something, which is never a design decision of the user any more. "-" = no relation. Phases 1 to 8 and 10 are track D; 9 and 11 are track H.

**Decisions, all answered.**

| Entry | Answered by | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P10 | P9 (H) | P11 (H) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Go-ahead, with bounds (SR-3) | U12 B1, P9 | A | A | A | A | A | A | A | A | A | - | W: the devices installed (U13) |
| Q8 stored form | U12 A1 | - | - | - | - | - | - | - | A (WP-16 not planned) | - | - | - |
| Q7 production host | U12 A2 | - | - | - | A (WP-07, WP-08) | A (WP-14) | - | A (WP-27) | - | A (WP-19, WP-22) | - | A (WP-15) |
| F-1 camera pull | U12 A3 | - | - | A (WP-03) | - | - | A (through L-2) | - | - | - | - | - |
| F-2 HEVC | U12 A4 | A (WP-01) | - | A (WP-05, WP-10) | - | - | A (through L-4) | - | - | - | - | A (H-09) |
| Q9 class-C lift | U12 A5 | - | - | - | - | - | A (WP-13, stage 1) | - | - | - | - | A (WP-15, stage 2) |
| AM-1 (D86 C-5) | U12 A6 | - | - | - | - | - | A (WP-13) | - | - | - | - | - |
| AM-2 (D82) | U12 A6 | - | - | A (WP-05) | - | - | - | - | - | - | - | - |
| AM-3 (D80(10), search) | U12 A6, A7 | - | - | - | - | - | - | - | A (WP-12) | - | - | - |
| AM-4 (D75) | U12 A6 | - | - | - | - | - | - | - | - | A (WP-19, WP-22, WP-23, WP-25) | - | - |
| AM-5 (D80(1)) | U12 A6 | - | - | - | - | - | - | - | - | A (WP-19) | - | - |
| AM-6 (D80(10), commissioning) | U12 A6 | - | - | - | - | - | - | - | - | A (WP-19) | - | - |
| AM-7 (D81 with D80(7)) | U12 A6 | - | - | - | - | - | - | - | - | A (WP-22) | - | - |
| AM-8 (D76 (3)) | U12 A6 | - | - | - | - | - | - | - | - | A (WP-22) | - | - |
| NEW-1 typed-address probe | U12 A7 | - | - | - | - | - | - | - | A (WP-12) | - | - | - |
| Q6 rooms | U12 A8 | - | - | - | - | - | - | - | A (WP-17 not planned) | - | - | - |
| Q3 legacy data | U12 A9 | - | - | - | - | - | - | - | - | - | A (WP-21) | - |
| Q10-d gain | U12 A10 | - | - | - | - | - | - | - | A (WP-18 deferred) | - | - | - |
| Q10-e host checks | U12 A10 | - | - | - | - | A (WP-20) | - | - | - | - | - | - |
| Q10-a network functions, in the Core | U6, U7 | - | - | - | - | A (helper clause of WP-14) | - | - | - | A (all five packages) | - | A (H-05, H-06, H-13 to H-15) |
| Q10-b no passive monitor | U9 | - | - | - | - | - | - | - | - | A (WP-19) | - | A (H-13) |
| Q10-c TECHNICIAN only | U10 | - | - | - | - | - | - | - | - | A (WP-23) | - | - |
| OQ-1 unadopted devices not stored | U11 | - | - | - | - | - | - | - | - | A (WP-19, WP-23) | - | - |
| OQ-2 acceptance stored, set C | U11 | - | - | - | - | - | - | - | - | A (WP-26) | - | - |
| OQ-3 gain and offset with their function | U11 | - | A (nothing added to WP-24) | - | - | - | - | - | A (WP-18 deferred) | - | - | - |
| OQ-4 no automatic interface | U11 | - | - | - | - | - | - | - | - | A (WP-19, WP-25) | - | - |
| OQ-5 three schema sets | U11 | - | A (WP-24) | - | - | - | - | - | - | A (WP-25, WP-26) | - | - |
| No hardware during development | U13 | A | A | A | A | A | A | A | A | A | - | A |

**What still waits, and where.**

| Item | Kind | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P10 | P9 (H) | P11 (H) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Plan verification rows; baseline; branch (phase 0) | gate | W | W | W | W | W | W | W | W | W | - | - |
| Security review on the relay (SA-1 to SA-3) | outcome | - | - | W (WP-03) | - | - | W (L-2) | - | - | - | - | - |
| Security review on the helper, the credential path, H-V | outcome | - | - | - | - | - | - | - | - | W (WP-19, WP-22) | - | W (UA-3) |
| E-8 of WP-01 | outcome | - | - | W (WP-10) | - | - | - | - | - | - | - | - |
| E-10 of WP-01 | outcome | - | W (WP-11) | - | - | - | - | - | - | - | - | - |
| E-11 of WP-01 | outcome | - | - | W (SA-2 in WP-06) | - | - | - | - | - | - | - | - |
| P3 confirmation | small item | - | - | W (defaults) | W (defaults) | - | - | - | - | - | - | - |
| The choice inside AM-7 | small item | - | - | - | - | - | - | - | - | W (WP-22) | - | - |
| The writer of the acceptance record (I-11) | small item | - | - | - | - | - | - | - | - | W (WP-26) | - | - |
| Devices installed; UA-1 to UA-5 | user action | - | - | - | - | - | - | - | - | - | W | W |
| X-1, X-2 | user action | - | - | - | - | - | - | - | - | - | - | W (H-16, H-17) |
| Bounds for H-18 and H-19 | to be set | - | - | - | - | - | - | - | - | - | - | W |
| The ruling on stage 2 | user ruling | - | - | - | - | - | - | - | - | - | - | W: after the result |

"W" on a small item does not stop the phase: the controller decides it with a log entry (B2) or builds as the design recommends.

## 12. Dependencies

### Dependency on task 3's uncommitted state

- Every `file:line` in the design is of the working tree of 2026-10-12, which held uncommitted changes (`masterplan/01_specs.md:28`; `initialization/01_env_check.md:6`). Task 3 was on hold while the user tried the served applications, and a later implementation touches the same folders (`identification/01_translated.md:120`).
- What this row could see: the snapshot of the repository status given at the start of this session lists modified files under `apps/core-web/src/` and `README.md`, with last commit `b4b0c25` (task 3, wave J). The list was truncated, and this row runs no command, so whether files under `apps/core-server/` or `apps/capture-worker/` were modified was not established.
- Consequence, as an entry condition of phase 1: task 3's work is committed, or a commit is named as the baseline; the first step of the implementation task re-opens the cited lines against that baseline and corrects the numbers before any package starts. A pin of the opener rule that moved or changed in task 3's later waves is a change to phase 6, not a detail.
- The implementation task and task 3 are not run on the same folders at the same time.
- **Ruled since (U12 B3):** task 3 is committed first as the baseline; this work is on its own branch, one commit per phase, no push. That is the first half of phase 0.
- **Schema version steps against that tree (added by the integration pass).** The schema design counts from the working tree of 2026-10-12: 15 migration files `0000` to `0014`, schema version 6, contract revision `dbc-7`, 43 tables, and it proposes files `0015` to `0020` and version steps 6 to 7 (set A), 7 to 8 (set B), 8 to 9 (set C). It states that file numbers "assume this order and that no other set lands first; the number is taken at generation time" and that its line numbers are of a tree with uncommitted changes (`masterplan/03_db_schema_extension.md`, sections 0, 3.2, 3.4). This row could not see whether task 3's uncommitted work touches the schema or migration folders. Consequences: the pins are re-measured against the baseline in phase 0; each set takes its file number and version step at generation; if the baseline already holds a later migration, every number above shifts and the plan's "6 to 9" is read as "three steps from the baseline's version"; one migration writer at a time; a boot check refuses a database on either side of a step, so code and database move together (`db:migrate`, then start).

### Internal

Captured in the "Depends On" column of section 10. No circular dependency: WP-01, WP-02, WP-09, WP-12 and WP-24 have none; WP-04 and WP-07 need WP-24; WP-03 needs WP-01 and WP-02; WP-05 and WP-06 need WP-03; WP-08 needs WP-02 and WP-07; WP-13 needs WP-01 to WP-09; WP-25 needs WP-24; WP-19 needs WP-23 and WP-25; WP-22 needs WP-19 and WP-23; WP-26 needs WP-25; WP-20 needs WP-14's profile; WP-14's helper clause needs WP-19's helper contract, and WP-19 does not need WP-14 in track D (the design's "WP-14, build: helper installed" is an installation on the host, which is track H: log item I-10); WP-27 needs every package that hands over a check; WP-15 needs WP-27 and all of track D.

## 13. External Dependencies

No vendor service, API key or third-party onboarding is part of this port (Dim 3: none; the design used no external research, `masterplan/01_specs.md:464`). What the port needs from outside itself:

**Track D needs nothing from outside the development Mac** except what is already on it. Everything else is a user action of track H (U13); none blocks development.

| Id | Dependency | Needed by | Prerequisite and verification |
|---|---|---|---|
| LIB-1 | The FFmpeg libraries at the version the worker pins (Dim 2: no new technology; the relay links the same libraries). The experiment of WP-01 ran on FFmpeg 9.0.2, libavformat 63.1.102, on this Mac (`test/01_hevc_experiment.md`, section 2) | Track D, phases 1, 3; track H, H-01 | The worker's check script passes on each host. Another libavformat build on Linux is named unproven by the report |
| DB-1 | The local demo database and the test PostgreSQL | Track D, WP-24, WP-25, WP-26 | U12 B4: migrations on the local demo database only, set by set with rollback |
| LIB-2 | The `onvif` package already in the repository, which holds the four network calls (presence read by the design, nothing run; hypothesis H-T) | Track D, WP-22 on the stub; track H, H-14 | Behaviour on real cameras is H-14 |
| VM-1 | A Linux container or VM of Ubuntu 24.04, if available | Track D, phases 2 and 5, optional | Not required by any completion check; its use is logged |
| X-1 | A production signing key (a command that provisions it; not part of the port) | Track H, H-16, H-17 | A `REAL_PRODUCTION` Core starts |
| X-2 | Operators without the demonstration password (D241; not part of the port) | Track H, H-16, H-17 | The production boot check passes |
| UA-1 | A Linux host, Ubuntu 24.04, and access to it | Track H, every check | Provided by the user (U12 A2) |
| UA-2 | Two cameras; an audio interface with two microphone inputs (the choice of soundcard is the user's); a factory-new camera; for H-15 a second camera on the same factory address | Track H, H-07 to H-15, H-17 | Installed by the user (U13) |
| UA-3 | Installation of the alias helper, its sudoers line and its root-owned interface file, and of `arping`, with `sudo` | Track H, H-05, H-06, H-13 to H-15 | By the user, after the security review (U12 B5) |
| UA-4 | Typing the camera passwords in the web console | Track H, H-09, H-10, H-14, H-17 | By the user or an operator; never an agent (D76) |
| UA-5 | A person at the bench | Track H, H-06, H-07, H-08, H-11, H-13, H-15, H-18, H-19 | Physical steps |
| UA-6 | The legacy data guard (WP-21) | Before any input-av program is started from this tree | By the user in person (phase 9) |

Withdrawn against version 1.0: VT-1, the camera vendor's own tool for assigning addresses. It was listed for the case that the network tools were dropped; the user made them required (U6). A vendor tool remains what an installer uses for a camera the Core's commissioning cannot reach, which this plan does not cover.

## 14. Compliance Implementation

No external regulation was identified for this task (Dim 5: no findings; `masterplan/01_specs.md:464`). The controls that bind the port are the project's own rulings; each has a gate in the plan.

| Control | Source | Where it is gated |
|---|---|---|
| Credential write-only; never in an argument, environment, log or file | D76, credential rule | Phase 3 check E-12; lift condition L-3 |
| No listener for a source kind without an opener; answer to SEC35-40 | D86 C-5 | Phase 0 (F-1, row 13); phase 3 (SA-2, SA-3); lift condition L-2 |
| Single audit chain; no unrecorded network-changing action | C13; record map section 6 | Phase 10 check: exactly 1 audit entry per action; H-06, H-13, H-14 |
| A privileged, network-changing helper with a bounded reach: one interface fixed by a root-owned file, private `/24` only, add and delete only, mandatory conflict check, no packet capture | Design rule DR-2, notes SN-1, SN-2; U9 | Phase 10 entry condition 2 (security review); phase 10 check (5 refusals); H-05; installation by the user only (U12 B5, SR-10) |
| Commissioning by the TECHNICIAN role only, web console only, idle only | U10; rules DR-1, DR-9 | Phase 10 check (1 role; refused while a session is open) |
| The camera credential of a commissioning job is never stored by the job | Rule DR-8; D80(3); AM-7 | Phase 10 check (0 occurrences); H-14 |
| No stored row for a device that is not adopted | RG-4, D76 (1), kept by U11 | Phase 10 prohibitions |
| Migrations only on the local demo database | U12 B4 | SR-9; phases 2 and 10 |
| Copy-only video | R-4 of task 3 | F-2: transcoding rejected |
| Evidence data untouched | P2 | SR-1, SR-2, phase 9 |
| No production boot with the demonstration password | D241 | X-2; phase 6 prohibition |

## 15. Critical path

Sizes here; durations, as estimates, in section 21. The path has two parts with a wait of unknown length between them.

```
TRACK D (development Mac, doubles)

phase 0: plan verified + baseline + branch
   |
   +-- WP-01 rest (S) --+
   +-- WP-02 (S) -------+--> WP-03 (M) --> WP-06 (M) --+
   +-- WP-24 (S) --> WP-04 (M) ----------> (WP-06)     |
   |        |         WP-03 --> WP-05 (M) -------------+--> WP-13 (S) --+
   |        +------> WP-07 (M) --> WP-08 (M) ----------+                |
   |        +------> WP-25 (S) --> WP-19 (M) --> WP-22 (M) -------------+
   |                 WP-23 (S) ----^        WP-25 --> WP-26 (S) --------+--> WP-27 (M)
   +-- WP-14 (M) --> WP-20 (S) -----------------------------------------+     closes track D
   +-- WP-12 (M) -------------------------------------------------------+
   +-- WP-09 (S)

            ... wait: the user installs the devices (U13); length unknown ...

TRACK H (Linux host, devices)

user actions (phase 9, UA-1 to UA-6, X-1, X-2) --> WP-15: H-01 ... H-20 --> the user's ruling on stage 2
```

- **Critical chain of track D:** phase 0; WP-01's remaining experiments and WP-02 (S), level with WP-24 then WP-04 (S, M); then WP-03 (M); then WP-06 (or WP-05, same length); then WP-13 (S); then WP-27 (M), which closes last. In sizes: S, M, M, S, M.
- **Equally long, and so co-critical:** WP-24, WP-25, WP-19, WP-22 into WP-27: S, S, M, M, M. By size the commissioning chain is as long as the recording chain (two S and three M against two S and three M, counting WP-27 in both). Version 1.0 of this pass called it a side track; under U13 both chains end in the same package.
- **Near-critical:** WP-24 then WP-07 then WP-08 (S, M, M) into WP-13; WP-14 then WP-20 (M, S) into WP-27.
- **What holds track D that is not work:** the three verification rows (phase 0); the security review's findings, on the relay before phase 3 and on the helper before WP-19; the outcomes of E-8, E-10, E-11. No user decision.
- **What can start as soon as phase 0 has passed:** WP-01's remaining experiments, WP-02, WP-09, WP-12, WP-14, WP-24.
- **What holds track H:** the installation of the devices, which this plan cannot size; then the user actions UA-1 to UA-5, X-1 and X-2; the bounds for H-18 and H-19.
- **The first sealed session from real hardware** is check H-17 in track H. Its date is decided by when the devices are installed, not by the length of track D.

## 16. Verification strategy

- **Per package:** the verification cell of the design (`masterplan/01_specs.md:374-396`), repeated in the phase's completion check.
- **Per phase:** the completion check, every item of which is a count, a pass or fail, or a recorded value. A phase is closed by the controller of the implementation task reading the evidence, not by the executing agent's statement.
- **Two kinds of "done" (U13, SR-11).** A phase of track D closes as "done on doubles": its check needs no device, and its packages carry the unproven list of section 8. Nothing of track D is reported as tested on hardware. The proof on devices is track H, check by check.
- **Integration in track D:** phase 6 (every pin in its end state, development behaviour unchanged); phase 10 (each commissioning action leaves one audit entry, against the helper double and the stub); phase 7 (the test package is complete and its scripts run dry).
- **Integration in track H:** check H-17, one sealed and verified session from four production sources; checks H-13 to H-15, the commissioning functions on real cameras.
- **Acceptance.** Of track D: all its phases closed on doubles, WP-27 delivered, the verification agents of the implementation task passed. Of the port as a recording system: the user's ruling on stage 2, made on the result record of phase 11; then the stage 2 errata. Neither stands in for the other.
- **Tests the implementation task needs:** unit and static tests per package on the development host; the worker's existing suite as the regression line in phases 1, 2 and 3; the `REAL_DEVELOPMENT` suite as the regression line in phases 2, 3, 4, 6, 8 and 10; the database suite with its moved pins after each schema set; one long run in phase 11 (H-19).

## 17. Risks and mitigations

Likelihood and impact are judgments of this row, not measurements.

| # | Risk | Likelihood | Impact | Mitigation | Linked |
|---|---|---|---|---|---|
| R-1 | `apps/input-av/` is **untracked** in the DEMS repository and its `data/` folder is excluded only by input-av's own ignore file (`initialization/01_env_check.md:3`; `research/03_analysis_record_map.md:347`). A broad add would commit the source tree; a clean of untracked files would delete the tree **and the evidence data** | Medium | High | SR-1, SR-2, SR-9; the implementation task's git steps never use an add-all or a clean of untracked files, and this matters more now that there is a commit per phase (B3); the tree stays untracked by the user's ruling (B6); phase 9 guard | Phase 0; every commit; phase 9 |
| R-2 | The evidence folder is written by a program started from the tree | Low under SR-2 | High | SR-2; phase 9 | All phases |
| R-3 | HEVC is assumed and fails late | Lower than in version 1.0 for the worker: E-1 and E-2 pass. Unknown for a real camera, for sealing and for playback | High | E-8 in phase 1 before WP-10 is decided; H-09 and H-20 in track H; the ruled fallback (cameras set to H.264, A4) needs no code. A pass on generated sources is never reported as a pass on cameras | Phases 1, 3, 11 |
| R-4 | SEC35-40 returns unanswered: the relay lands without SA-2 and SA-3, or row 13 does not accept them | Medium | High | Row 13's finding recorded in phase 0; the fallback is ruled (the worker pulls, A3) and re-plans phase 3; lift condition L-2; a security FAIL stops the run (B2) | Phases 0, 3, 6 |
| R-5 | The credential reaches an argument list, the environment or a log | Low | High | E-12 in phase 3; static test; lift condition L-3; the same check for the commissioning job in phase 10 and in H-14 | Phases 3, 10, 11 |
| R-6 | Line numbers and pins have moved because task 3 was not baselined | High until phase 0 has run | Medium | Baseline commit ruled (B3) and first in phase 0; citations and schema pins re-measured there | Phase 0; phases 1 to 6, 10 |
| R-7 | The acceptance run cannot end in a sealed session | Medium | High | X-1 and X-2 are preconditions of H-16 and H-17 and are listed to the user as actions; "recorded, not sealed" is not a pass | Phase 11 |
| R-8 | The host, cameras or audio interface come late, or not at all | Unknown | Track D: none (U13). Track H and stage 2: total | Track D needs no device; the wait is stated in the critical path and the estimate; the code stays at stage 1 and nothing is declared fit to record | Phases 9, 11 |
| R-9 | On Linux every production session raises a critical notice (hypothesis H-K) | Unknown | Medium | Cannot be settled in track D (a container's file system is not the production disk); check H-03; a decision row if the sync-level rule must change | Phases 5, 11 |
| R-10 | Video and audio drift apart over a long session (hypothesis H-J) | Unknown | Medium to High | H-18 and H-19 in track H; the correction, if needed, belongs in the relay and is a fix wave after the run | Phase 11 |
| R-11 | The audio defects of the tested scheme are inherited: full-scale first sample, loopback inputs offered as microphones, near-silent recordings on the bench | Medium | Medium to High: found only in track H | No automatic card choice; level check before a session; H-08 treats a silent input as a fail | Phases 4, 11 |
| R-12 | The user reads "tested" as covering the Core path, or reads "track D complete" as "works on the devices" | Medium | High | SR-7, SR-11; every package of track D is reported with its unproven list; the Indonesian summary says so | All; phase 11 |
| R-13 | The standby microphone is assumed to be evidence | Low: accepted knowingly by U12 A1 | High | Stated in the register's list of what is decided | - |
| R-14 | Two systems record the same session during a comparison on the bench | Low | High | SR-4; phase 11 prohibition; B7 | Phase 11 |
| R-15 | Track H, or stage 2, is treated as started because track D ended | Medium | High | SR-3: the autonomous run stops before the hardware test; phase 11 starts on the user's word; stage 2 only by the user's ruling on the result | Phases 7, 11 |
| R-16 | A production session runs out of disk with no stop (hypothesis H-P; a Core gap outside this port, no work package) | Unknown | High | Reported to the controller; decided before phase 11 whether it is a precondition | Phase 11 |
| R-17 | A later ruling adds the lossless track or gain setting after the acceptance run | Low | Medium | Stated in phase 8: each is a new package and repeats the affected checks of track H | Phase 8, 11 |
| R-18 | The lift is done for one kind, or the README limits are withdrawn at stage 1 | Low | Medium | Phase 6 prohibitions | Phase 6 |
| R-19 | **A privileged helper that changes the host's network.** The Core's service user gains one `sudo` path; a wider helper, a writable helper file or sudoers line, or a wrong interface would let a compromised Core account or a technician account re-address the host, including onto the office network | Medium | High | The bound of rule DR-2 (one interface from a root-owned file, private `/24` only, add and delete only, mandatory conflict check, no packet capture); the wrong-network guard DR-4; security review before WP-19 starts; 5 refusals tested on doubles; installed by the user only, after the review (B5, SR-10); H-05 reads owner and mode on the host; TECHNICIAN only, idle only, each action audited | Phases 0, 10, 11 |
| R-20 | **Schema version steps 6 to 9 against task 3's uncommitted tree.** The schema design's file numbers `0015` to `0020`, its version steps and its pin counts are of a working tree with uncommitted changes; a migration in task 3's uncommitted or later work shifts all of them, and a boot check refuses a database one step off | Medium | Medium | Baseline first (B3); pins re-measured in phase 0; numbers taken at generation time; one migration writer; three separate sets, each applied and rolled back once on the local demo database only (B4); "6 to 9" read as three steps from the baseline's version | Phases 0, 2, 10 |
| R-21 | **Active scan only (U9).** A camera on a factory address that is neither in the stored list nor typed is not found. On the bench three cameras sat on addresses outside the default list | High that it occurs at an installation | Low to Medium: time lost, not a wrong record | The list is a setting the technician extends; the scan takes one typed address; the screen and the host profile say that the address is on the camera's label or in its manual; H-13 records which of the two found the camera | Phases 10, 11 |
| R-22 | **Linux-only code developed on macOS without ever running on Linux** (the largest new risk, from U13): the ALSA shared-capture opener, the Linux helper argument table, the alias helper with `ip` and `arping`, the parent-death method, the host checks, the host profile. Faults of this code surface only in track H, all at once, at an unknown later time | High that some fault is found in track H | High: a fix wave after the devices are installed, and stage 2 waits for it | (1) Platform seams: each Linux operation sits behind an injected interface, so the logic above it runs in the macOS suite. (2) Text equality with the values of the tested input-av source for everything that is configuration or an argument list. (3) The helper script run with stand-ins for `ip` and `arping`. (4) A Linux container or VM, if available, for what needs no device: the worker build, its check script, package presence, the parent-death method. (5) The test package (WP-27) orders its checks host first, so a host fault is found before a camera is involved. (6) The estimate carries a fix-wave share for track H. **What none of this proves, stated plainly:** that ALSA opens the real interface in shared capture and delivers audible, correctly timed samples; that the kernel expires an alias; that `arping` detects a conflict on the real port; the sync level on the production disk; device access and hot-plug; the firewall against real probe answers; any behaviour of a real camera | Phases 2, 4, 5, 10; all of phase 11 |
| R-23 | The commissioning scan or set-IP acts on the wrong network: a factory subnet equals the subnet of another interface of the host (the design links open bench finding 17 to this, as a hypothesis) | Medium | High | Rule DR-4 refuses such a target; tested on doubles in phase 10; on the host only by H-06 and H-13; one camera plugged in at a time | Phases 10, 11 |
| R-24 | The acceptance package has gaps or wrong pass criteria, found only when the user stands at the bench | Medium | Medium | Phase 7 check: every unproven item of section 8 has a covering check; scripts run dry; review before track D is reported complete; bounds without a source are marked, not invented | Phases 7, 11 |
| R-25 | Set C lands with no function that writes its table | Medium | Low | Log item I-11; WP-26 last in phase 10 | Phase 10 |

## 18. Assumptions and gaps

- AS-1. P3 is the correct reading of U2. If corrected: WP-03, WP-04, WP-06, WP-07, WP-08 are reworked on the changed parameters; the phase order stands.
- AS-2. The design of row 8 is accurate. Rows 11 to 13 may change it; a change to a work package's dependencies or host re-opens the phase it sits in.
- AS-3. Version 1.0 drew the plan as if every recommended default were chosen. U12 chose them; the assumption is now fact, except for the three small items of the register's head.
- AS-4 (integration pass). The schema design's split is adopted: WP-23 keeps the vocabulary and the permission, WP-25 is its schema part (log item I-9). `masterplan/01_specs.md` still words WP-23 as including the persistent data.
- AS-5 (integration pass). U8, U11 and U12 B4 together are read as the approval of the schema design that WP-23 and WP-24 name as a blocker; no row says so in so many words.
- AS-6 (integration pass). U12's "controller's list in the conversation" (groups A and B) is not a file of the task folder. This plan relies on its summary in `decisions/decisions.md:24`.
- AS-7 (integration pass). WP-27 and its size M are this plan's; the checks H-01 to H-20 are collected from the design's experiments and verification cells, except H-18 (the clap test), which comes from the controller's reading of U13 and has no experiment number in the design.
- Gap 1. No tolerance is set for the drift measured in E-9, nor for the clap test H-18 (log item I-5). To be set before phase 11.
- Gap 2. Where measure SA-2 lives if the worker's listener does not refuse a foreign path is not assigned to a work package (log item I-2). Settled by E-11, which has not run.
- Gap 3, closed. The registry placement of a microphone's card identity: typed columns in `capture_audio_inputs` (schema design, item D-22; WP-24), not the address column.
- Gap 4, changed. Version 1.0 had no effort figure beyond S, M, L. Row P8 now gives one; section 21 carries it as an estimate.
- Gap 5. No package builds the function that writes the installation acceptance record (I-11).
- Gap 6. Whether a Linux container or VM can be run on the development Mac is not known to this row.
- Gap 7. Row 13's findings were not available to this row. Phases 3 and 10 are drawn for the case that the relay and the helper are accepted.

## 19. Issues and Decisions Log

| Date | Step | Type | Description | Resolution | Decision Maker |
|------|------|------|-------------|------------|----------------|
| 2026-10-12 | Row 9 | Delta | The blueprint counts six open entries; the design adds NEW-1 as a seventh | Carried as seven in the register and in section 11 | Controller to accept or decline |
| 2026-10-12 | WP-08 | Delta (I-1) | The design gives WP-08 a Linux host with real hardware, yet WP-13 depends on WP-08 and lift condition L-5 asks for completion "on doubles", and experiment E-5 is listed under WP-15 | WP-08 sits in phase 4 and closes there on text equality as "done on doubles, confirmation pending"; E-5 closes it in phase 7. Its need-class stays H | Row 12 to confirm |
| 2026-10-12 | WP-06 | Open (I-2) | If E-11 shows that the worker's listener accepts a push to another path, measure SA-2 becomes a worker change; the design assigns SA-2 to WP-06, which is a Core package | Recorded in phase 1's tracking list; a package is named after E-11 | Row 12, then the user if a new package is needed |
| 2026-10-12 | WP-07 | Open (I-3) | Card identity and input number in the existing `address` column (no migration) or two new columns (migration): "to be judged by row 12" in the design | Phase 4 forbids a migration unless that review demands it | Row 12 |
| 2026-10-12 | Section 6 | Open (I-4) | No ruling covers what the existing bench installation of input-av may record until the Core can record production sources | Rule proposed in section 6; on the phase 0 list | User |
| 2026-10-12 | WP-15 | Open (I-5) | No tolerance for the drift of E-9 | To be set before the run | User, on the design's proposal |
| 2026-10-12 | WP-21 | Note (I-6) | "Nothing under `data/` is modified" and "the folder is moved or made read-only" meet in WP-21 | SR-1: the guard is the user's own act, changes no file content, and has a third form that touches nothing (SR-2 alone) | User, with Q3 |
| 2026-10-12 | Phase 11 (phase 7 in version 1.0) | Note (I-7) | Disk protection in real capture is not confirmed (hypothesis H-P); outside U1, no work package | Risk R-16; reported; to be decided before phase 11 | Controller |
| 2026-10-12 | Row 9 | Note (I-8) | Rows 7 and 8 each name five P3 differences and the lists overlap on two | Both given in the register, section 2.3 | Controller chooses the wording |
| 2026-10-12 | Plan | Decision | U6, U7: the network functions are required and live in the Core. U9: active scan only. U10: TECHNICIAN only | Phase 10 added; WP-19 moved from phase 8; WP-22, WP-23 placed | User |
| 2026-10-12 | Plan | Decision | U8, U11: schema extension in three sets; unadopted devices not stored; acceptance stored; gain and offset with their function; no automatic interface | WP-24 first in phase 2; WP-25, WP-26 in phase 10; set D with the deferred WP-18; set E not built | User |
| 2026-10-12 | Plan | Decision | U12: every open entry, fork and amendment answered (A1 to A10); process rulings B1 to B7 | Phase 0 re-defined; WP-12 in scope; WP-16, WP-17 not planned; WP-18 deferred; SR-3 re-worded, SR-9, SR-10 added; I-4 closed by B7 | User |
| 2026-10-12 | Plan | Decision | U13: no hardware during the autonomous development; the hardware testing is a separate test package | Two tracks; WP-27 added (phase 7); WP-15 moved to phase 11 as its run; phases 5 and 10 closed on doubles; section 9A; SR-11 | User; the two-track form is the controller's reading |
| 2026-10-12 | WP-01 | Result | E-1 and E-2 ran by order U4: both PASS on the unchanged release worker with generated sources; H.264 control PASS (`test/01_hevc_experiment.md`) | WP-01 partly done; the H.264 fallback of A4 not triggered; E-8, E-10, E-11 remain in phase 1; real-camera H.265 is H-09 | - |
| 2026-10-12 | WP-08 | Delta (I-1, updated) | Version 1.0 closed WP-08 in phase 7 by E-5 | Under U13, WP-08 closes in phase 4 as "done on doubles"; E-5 is check H-08. Its class is D, with the longest unproven list of the plan | Controller |
| 2026-10-12 | WP-07 | Closed (I-3) | Card identity placement | Typed columns of `capture_audio_inputs` (schema design; WP-24) | Schema design, accepted by U11 |
| 2026-10-12 | Section 6 | Closed (I-4) | Bench installation of input-av | U12 B7: tests only, not real examinations, until the Core can record | User |
| 2026-10-12 | WP-23, WP-25 | Delta (I-9) | The design's WP-23 includes "the persistent data"; the schema design proposes WP-25 for the same tables | Adopted as the schema design proposes: WP-23 keeps vocabulary and permission, WP-25 is the schema set, landing before WP-19 | Controller to accept; the design's text is not edited by this row |
| 2026-10-12 | WP-14, WP-19 | Delta (I-10) | The design makes WP-19 depend on WP-14 "(build: helper installed)", while WP-14's helper clause installs the helper that WP-19 writes | In track D nothing is installed: WP-19 is built on a helper double; WP-14's helper clause is written from WP-19's helper contract; the installation is the user's (UA-3) and is checked by H-05 | Controller |
| 2026-10-12 | WP-26 | Open (I-11) | Set C has a table and no package that writes it; the schema design names WP-20 as "consumer", which is host checks | WP-26 placed last in phase 10. To be assigned before it lands: extend WP-20, or a new package. If the function adds a gate that refuses recording without an acceptance, that is a scope question for the user | Controller; the user if a gate is added |
| 2026-10-12 | WP-22 | Open (I-12) | The choice inside AM-7: credential typed again for adoption, or alive for one commissioning job. No recommendation in the design, so U12 does not answer it | The register reads A6's "as far as needed" as favouring "typed again"; to be decided after row 13 on the credential path, before WP-22 starts | Controller with a log entry, or the user |
| 2026-10-12 | WP-04 | Finding (I-13) | F-DB-1 of the schema design: an ONVIF profile token may hold characters the Core's profile selector refuses (hypothesis H-DB-1) | On WP-04's tracking list in phase 2 with one test; real tokens in H-10 | - |
| 2026-10-12 | Section 21 | Open (I-14) | Row P8 does not say which packages its "6-9 working days" count, and predates U12 and U13 | Section 21 states its reading and re-derives track D with the same rate | Controller to confirm or replace |
| 2026-10-12 | WP-12, WP-19 | Note (I-15) | The unicast probe and the audit type for a re-address are shared by WP-12 and WP-19 / WP-23 | Built and defined once, by whichever lands first | Controller schedules |
| 2026-10-12 | Plan | Note (I-16) | P3 is not named in U12's A1 to A10 | Listed as a small remaining item; the defaults are built as P3 reads them | Controller, or the user |

## 20. Verification cells of row 10, checked

| Criterion (`identification/02_structured.md:146`) | Result | Where |
|---|---|---|
| Every WP of step 8 in exactly one phase | 21 of 21; the phase sums add to 21 | section 7 |
| Every WP in exactly one of the three need-classes | D 6, W 9, H 6, sum 21, by a stated rule | section 8 |
| Every phase has a completion check and a rollback line | phases 0 to 9, 10 of 10 | section 9 |
| The blocking list of each phase matches step 9 | the matrix repeats the register's direct-block column | section 11 |
| Risks with mitigations, among them whether `apps/input-av/` is tracked by git | 18 risks; R-1 states untracked, with its two sources | section 17 |
| Indonesian summary at the top, at most one page | present | head |
| Asked by the delegation: `data/` rule; new task and U3; task 3 state; critical path; risk table; decisions-to-phase matrix; system of record per phase; host and prohibitions per phase | present | sections 5, 6, 9, 11, 12, 15, 17 |

Not verified by this row: any behaviour of code, library, host or device. This row opened no source file and ran nothing; every technical statement is the design's, cited to its line.

The table above is the check of version 1.0 and is left as written. Its numbers are superseded by section 22.

## 21. Perkiraan waktu / Time estimate

**Ini perkiraan, bukan janji dan bukan jadwal.** Angkanya diturunkan dari laju terukur tugas 3 (baris P8), tanpa tanggal kalender. **This is an estimate, not a commitment and not a schedule**, derived from the measured pace of task 3; it carries no calendar date.

### 21.1 The source

Row P8 of `decisions/decisions.md` (line 22), by the controller, status "estimate, not a commitment": basis task 3's measured pace (7 to 12 October, 37 commits, more than 100 blueprint rows); "about 2-3 calendar weeks to the first sealed session from real hardware; development-host part 6-9 working days, Linux and hardware part 3-5 days, gates and fix waves +40-50 %; optional packages excluded".

### 21.2 How the per-phase figures are derived, and what is this plan's own

P8 gives totals, not phases, and it was written before U12 and U13. Three steps of this plan turn it into per-phase figures; each is a reading, to be confirmed or replaced by the controller (log item I-14).

1. **Which packages P8's "6-9 working days" count** is not stated in P8. Reading used here: the development-host packages on the way to the first sealed session as the plan stood when P8 was written: WP-01, WP-02, WP-09, WP-13, WP-24 (size S) and WP-03, WP-04, WP-05, WP-06, WP-07, WP-08 (size M).
2. **A unit rate.** With S = 1 unit and M = 2 units those are 5 + 12 = 17 units for 6 to 9 working days: about 0.35 to 0.53 working days per unit. So S is about 0.4 to 0.5 day and M about 0.7 to 1.1 days. The design's sizes are estimates from scope, so this rate is an estimate of an estimate.
3. **The same rate applied to what U6 to U13 added to the development track**: the commissioning functions, the host profile and host checks on doubles, the typed-address probe, the test package.

### 21.3 Track D: autonomous development on the Mac, on doubles

| Phase | Packages counted | Units | Working days, before gates and fix waves | Inside P8's 6-9 days by the reading of 21.2? |
|---|---|---|---|---|
| 0 | Baseline commit, branch, re-measuring citations and pins | - | not sized: no package | - |
| 1 | WP-01 (S), WP-09 (S) | 2 | 0.7 to 1.1 (E-1 and E-2 of WP-01 are already done, so the low end is the likelier) | yes |
| 2 | WP-24 (S), WP-02 (S), WP-04 (M) | 4 | 1.4 to 2.1 | yes |
| 3 | WP-03, WP-05, WP-06 (M each) | 6 | 2.1 to 3.2 | yes |
| 4 | WP-07, WP-08 (M each) | 4 | 1.4 to 2.1 | yes |
| 6 | WP-13 (S) | 1 | 0.4 to 0.5 | yes |
| | **Sub-total: P8's development-host part** | **17** | **6 to 9** | |
| 5 | WP-14 (M), WP-20 (S), on doubles | 3 | 1.1 to 1.6 | no: P8 counted them under "Linux and hardware" |
| 8 | WP-12 (M) | 2 | 0.7 to 1.1 | no: optional when P8 was written |
| 10 | WP-25 (S), WP-23 (S), WP-19 (M), WP-22 (M), WP-26 (S) | 7 | 2.5 to 3.7 | not stated in P8; counted here as added |
| 7 | WP-27 (M, this plan's sizing) | 2 | 0.7 to 1.1 | no: created by U13 |
| | **Sub-total: added to track D by U6 to U13** | **14** | **4.9 to 7.4** | |
| | **Track D, all phases** | **31** | **about 11 to 16.5** | |
| | **With gates and fix waves, +40 to 50 % (P8)** | | **about 15 to 25** | |

Phases run side by side where their dependencies allow (section 15), as the rows of task 3 did; the rate already contains that, because it comes from a pace measured with parallel work. The figures are therefore not divided again for parallelism.

### 21.4 Track H: the hardware acceptance test package, counted from the day the devices are installed

| Part | Working days, before fix waves | Source |
|---|---|---|
| The host and the recording path on devices: H-01 to H-04, H-07 to H-12, H-16 to H-20 | 3 to 5 | P8's "Linux and hardware part". Under U13 this is no longer building on Linux but applying a prepared profile and running prepared checks; the figure is kept as P8 gives it, because the fixes that Linux-only code will need now fall into this part (risk R-22) |
| The commissioning functions on real cameras: H-05, H-06, H-13 to H-15 | 1.5 to 2.5 | This plan's extension, not in P8: the size of one M package at P8's hardware rate (3 to 5 days for the two M packages WP-14 and WP-15) |
| **Track H** | **4.5 to 7.5** | |
| **With fix waves, +40 to 50 % (P8)** | **about 6 to 11** | |

Two things are not in these figures: the wait until the devices are installed, and the user's own time for the actions UA-1 to UA-6, X-1 and X-2.

**P8's "about 2-3 calendar weeks to the first sealed session from real hardware"** was given for a plan in which development and hardware work followed each other without a gap. Under U13 the first sealed session from real hardware is check H-17 of track H; when it happens depends on when the devices are installed. The 2-3 weeks no longer describe a continuous stretch and are not restated here as a total.

### 21.5 Optional, conditional and not-built packages, each on its own line

None of these is in the figures above.

| Package | State | Estimate at the same rate |
|---|---|---|
| WP-10, HEVC sample entry and reader frame rate | Conditional on E-8 | S to M: 0.4 to 1.1 days; if the change is larger it is the follow-up package of A4 and has no estimate |
| WP-11, resumed push accepted | Conditional on E-10 | M: 0.7 to 1.1 days |
| WP-16, lossless track per microphone | Not planned (A1); decided separately later | M on the development host, 0.7 to 1.1 days, plus repeating the affected checks of track H |
| WP-17, several rooms per Core | Not planned (A8) | L, to be split before planning: no estimate |
| WP-18, gain setting with schema set D | Deferred (A10) | M with a hardware part: 0.7 to 1.1 days on doubles plus about 1.5 to 2.5 days on the interface |
| WP-21, legacy data guard | The user's own action | Not sized |
| The function that writes the installation acceptance record | Unassigned (I-11) | Not sized: no design |

### 21.6 Assumptions

- The pace of task 3 carries over: the same controller, the same way of working (autonomy with a decision log, U12 B2), comparable parallel width.
- Sizes S and M of the design are right in proportion; WP-27 is M.
- The security review accepts the relay and the helper. A rejection of the relay re-plans phase 3 (variant B: M in the worker plus M in the protocol and the plan builder, by the design) and is not in the figures.
- E-8, E-10 and E-11 do not trigger WP-10 or WP-11.
- The doubles are good enough that track H finds faults of the kind a fix wave of 40 to 50 % covers, and no fault that needs a redesign.

### 21.7 Four things that can move it

1. **The Core on Linux has never been tried.** No part of the Core path has run on a Linux host or with a real device, and under U13 none will before track H. This is the largest uncertainty of the whole estimate and it sits entirely in track H (risk R-22). The fix-wave share of track H may be too small.
2. **Availability of the Linux host and the hardware.** It no longer moves track D at all; it decides when track H can start and, with it, when stage 2 can be ruled.
3. **Fix waves.** P8 allows 40 to 50 %. Task 3's own history is the basis; a finding of the security review or of a verification row during track D, or a failed check in track H, adds a wave.
4. **Waiting for decisions.** Much smaller than when P8 was written: U12 answered every entry. What can still wait: the three plan-verification rows (phase 0), the security review's findings, the three small items, a stop for a scope change or a security FAIL (B2), and at the end the user's ruling on stage 2.

## 22. Integration pass, checked (version 1.1)

### 22.1 Work-package sets

| Set | Source | Numbers | Count |
|---|---|---|---|
| Design | `masterplan/01_specs.md`, section 9, table of work packages (after Amendment 1) | WP-01 to WP-23 | 23 |
| Schema design | `masterplan/03_db_schema_extension.md`, section 3.2 | WP-24, WP-25, WP-26 | 3 |
| This plan | section 9, phase 7 | WP-27 | 1 |
| **Union** | | WP-01 to WP-27 | **27** |
| **Placed in this plan** | section 7 (phases), section 8 (classes), section 10 (tracking rows) | WP-01 to WP-27 | **27** |

Difference between the union and the placed set: **0 missing, 0 extra**. Each package is in exactly one phase: phase 1: 2; phase 2: 4; phase 3: 4; phase 4: 2; phase 5: 2; phase 6: 1; phase 7: 1; phase 8: 4; phase 9: 1; phase 10: 5; phase 11: 1; sum 27. Each package is in exactly one class: D 20, C 2, N 3, H 2; sum 27.

Named in the schema design and not a work package: set D (three columns, inside WP-18, deferred) and set E (not built, U11).

### 22.2 Required changes, checked

| Required | Result | Where |
|---|---|---|
| WP-22, WP-23, WP-24, WP-25, WP-26 placed; WP-19 re-placed | WP-24 first in phase 2; WP-25, WP-23, WP-19, WP-22, WP-26 in phase 10; WP-19 no longer in phase 8 | sections 7, 9 |
| A phase for the commissioning network functions with entry conditions, completion check on real cameras, rollback, system-of-record statement | phase 10: 5 entry conditions (amendments, security review of the helper, the AM-7 choice, WP-24 landed, the Linux host moved to track H by U13); completion check on doubles and, separately, on real cameras (H-05, H-06, H-13 to H-15); rollback; system-of-record table | section 9, phase 10; section 6 |
| Need-classes, critical path, decisions-to-phase matrix, risk table | re-drawn; 25 risks, among them R-19 (privileged helper), R-20 (schema steps against the uncommitted tree), R-21 (active scan only), R-22 (Linux-only code developed on macOS) | sections 8, 11, 15, 17 |
| "Perkiraan waktu / Time estimate" from P8, per phase, labelled, with assumptions and the four movers, optional packages on their own lines, no calendar date | present; track D and track H separately | section 21 |
| The statement on what starts by itself | re-worded by P9 and U12 B1: nothing before the plan's verification passes; the autonomous run stops before the hardware test; track H and stage 2 do not start by themselves | SR-3; head |
| Two tracks; per package the double and what stays unproven | 27 rows | section 8 |
| The hardware acceptance test package: checks with precondition, steps, expected result, pass criterion, user actions; stage 2 only on its result | 20 checks, H-01 to H-20; WP-27 builds it, WP-15 runs it | sections 9 (phases 7, 11), 9A |
| The HEVC result | E-1 PASS, E-2 PASS, H.264 control PASS, on generated sources; WP-01 partly done; fallback of A4 not triggered; unproven list carried | phase 1; section 8; R-3; register F-2 |
| Indonesian summary at the top updated | present | head |

### 22.3 Not verified by this pass

No source file was opened and nothing was run. Every technical statement is the design's, the schema design's or the experiment report's, cited to its section. Row 13's findings were not read. Task 3's decision file was not opened. Nothing under `apps/input-av/data/` and no `.env` was opened.

---
*Generated: 2026-10-12 (clock time not available to this agent)*
*Last Updated: 2026-10-12, integration pass (U4 to U13, P9, Amendment 1, schema design, HEVC experiment result)*
*Version: 1.1*
