---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 9
date: 2026-10-12
agent: pm-planner
type: decision register
narrative_tier: 1
status: answered by the user for every entry, fork and amendment (U1 to U13); three small items and two pending outcomes remain, listed at the head; a recommendation is a decision only where a U-row is named beside it
source_specs: masterplan/01_specs.md (row 8, with Amendment 1); masterplan/03_db_schema_extension.md (row 8b)
source_analysis: research/03_analysis.md (row 7); research/03_analysis_record_map.md (row 6)
source_structured_task: identification/02_structured.md (row 9 at line 145; profile line 167; entries at lines 202-215)
source_decisions: decisions/decisions.md (U1 line 7, U2 line 8, P3 line 9, P4 line 10, P5 line 11, P6 line 12, U3 line 13; integration pass: U4 line 14, U5 line 15, U6 line 16, P7 line 17, U7 line 18, U8 line 19, U9 line 20, U10 line 21, P8 line 22, U11 line 23, U12 line 24, U13 line 25, P9 line 26)
source_test: test/01_hevc_experiment.md (WP-01, E-1 and E-2, worker half, ordered by U4; status as that file states it: complete; E-1 PASS, E-2 PASS, H.264 control PASS)
version: 1.1 (integration pass, 2026-10-12: rulings U4 to U11, Amendment 1 of the design, the schema design)
---

> **Integration pass (version 1.1).** Changed against version 1.0: Q10 is answered in all five parts (U6, U7, U9, U10, U12 A10); five rulings of task 3 that the network functions need amended are entries AM-4 to AM-8; the five questions of the schema design, OQ-1 to OQ-5, are entries and are answered (U11); **every remaining entry, fork and amendment is answered by U12** (groups A and B), and U13 moves all real-device checks into a separate hardware acceptance test package; the head of the document is a list of what is decided plus the few items that remain; every "what waits" cell uses the work-package numbers of the amended design (WP-01 to WP-23), of the schema design (WP-24 to WP-26) and of the plan (WP-27, the test package). **Where a section below still words an entry as open or as a recommendation, the state table of section 1 and the "ANSWERED" line at the head of the entry govern**; the option tables are kept as the record of what was chosen between. Line references into `masterplan/01_specs.md` written by version 1.0 are of that file before Amendment 1 (469 lines; it has 619 now) and were not re-numbered: where this pass adds a reference it names the section, not the line.

# Decision register: port of the input-av hardware input logic into the Core adapters

## Ringkasan untuk dijawab (Bahasa Indonesia)

Hampir semua pertanyaan dokumen ini sudah Anda jawab (U1 sampai U13). Implementasi sudah Anda lepas untuk mulai **setelah rencana lulus tiga baris verifikasinya** (U12 B1, P9); sampai saat itu tidak ada berkas sumber yang diubah. Perangkat keras tidak dipasang selama pengembangan (U13), jadi semua pemeriksaan perangkat nyata dikumpulkan dalam satu paket uji terpisah.

### Sudah diputuskan

| Hal | Jawaban Anda | Baris putusan | Akibatnya pada paket kerja |
|---|---|---|---|
| Q1. Arti "pencatatan ganda" | Tidak ada sistem pencatat kedua | U1 (dibaca P4) | - |
| Q2. Nasib input-av | Tidak punya peran perekaman | U1 (dibaca P4) | - |
| Q4, Q5. Skema input kamera dan audio | Skema input-av, karena itu yang teruji | U2 (tafsiran P3: lihat "Yang masih tersisa", a.1) | - |
| Q10, bagian jaringan: scan IP pabrik, alias IP sementara, set IP kamera | **Wajib ada**, dan tempatnya **di dalam Core** | U6, U7 | WP-19, WP-22, WP-23, WP-25. Amandemen yang mereka butuhkan sudah Anda setujui (U12 A6); yang masih mereka tunggu hanya hasil tinjauan keamanan (row 13) |
| Q10, monitor pasif | **Tidak diperlukan**, cukup scan aktif | U9 | Tidak ada paket. Akibat yang perlu diketahui: kamera yang alamat pabriknya tidak ada di daftar hanya ditemukan dengan mengetik alamatnya |
| Q10, siapa yang boleh menjalankan fungsi komisioning | Peran **TECHNICIAN saja** | U10 | WP-23 (izin), WP-19, WP-22 |
| Data tambahan input-av | Disimpan di database Core | U8 | WP-24, WP-25, WP-26 |
| OQ-1. Perangkat yang terlihat tetapi belum diadopsi | **Tidak disimpan** (hasil scan di memori; set E tidak dibangun) | U11 | Bagian opsional WP-23 tidak dibangun; RG-4 dan D76 (1) tidak perlu diamandemen |
| OQ-2. Berita acara "setup awal selesai" | **Disimpan di Core**, sebagai set C tersendiri | U11 | WP-26 tidak lagi menunggu keputusan |
| OQ-3. Gain dan offset A/V | Disimpan **bersama fungsinya** (set D), bukan sekarang | U11 | Kolomnya ikut WP-18 |
| OQ-4. Interface kamera dipilih otomatis? | **Tidak**: teknisi memilihnya satu kali | U11 | WP-19 menolak bekerja selama interface belum dipilih |
| OQ-5. Satu set migrasi atau tiga | **Tiga** set terpisah (A, B, C), tiga kenaikan versi skema | U11 | WP-24, WP-25, WP-26 tetap terpisah; WP-24 tidak menunggu putusan apa pun |
| Cek H.265 di mesin ini | Diperintahkan sekarang | U4 | **Sudah dijalankan, lulus untuk bagian worker** (`test/01_hevc_experiment.md`, status "complete"): worker yang ada, tanpa diubah, membawa H.265 ke dalam fMP4-nya, baik bila parameter set diumumkan di SDP maupun bila hanya ada di dalam stream. Per berkas: 350 dari 350 frame, 1920x1080, 0 galat decode, 8 `moof`, sample entry `hev1`; kontrol H.264 lulus. Sumbernya encoder di Mac ini, **bukan kamera nyata**. Cadangan "kamera diatur ke H.264" (A4) **tidak terpicu** oleh percobaan ini |
| Q8. Bentuk bukti yang disimpan | **Bentuk Core** (fMP4 + AAC mono). Diterima dengan sadar: audio tidak lossless, mikrofon cadangan tidak tersimpan; trek lossless diputuskan terpisah nanti | U12 (A1) | WP-16 tidak direncanakan; sembilan parameternya dicatat "tidak dibawa" |
| Q7. Host produksi | **Linux, Ubuntu 24.04** | U12 (A2) | WP-07, WP-08, WP-14, WP-19, WP-22 dibangun untuk Linux, di Mac ini dengan perangkat palsu (U13) |
| F-1. Cara kamera sampai ke worker | **Relay** di depan worker yang tidak diubah; jika tinjauan keamanan menolaknya, worker yang menarik | U12 (A3) | WP-03, lalu WP-05, WP-06, WP-13 |
| F-2. H.265 | Codec **apa adanya dari kamera**, dinilai dari stream; jika percobaan gagal, kamera diatur ke H.264 dulu dan dukungan H.265 menjadi paket lanjutan | U12 (A4) | WP-05; WP-10 bergantung pada hasil percobaan |
| Q9. Pencabutan kelas C | **Satu kali** untuk kamera dan mikrofon, **dua tahap**: di kode, lalu dinyatakan layak merekam setelah uji perangkat nyata | U12 (A5) | WP-13 (tahap 1); tahap 2 hanya atas hasil paket uji perangkat keras (WP-15) |
| AM-1 sampai AM-8. Putusan tugas 3: D86 C-5, D82, D75, D80, D81, D76 (3) | **Diamandemen sejauh dibutuhkan** oleh opener kamera/mikrofon dan fungsi jaringan | U12 (A6) | WP-05, WP-12, WP-13, WP-19, WP-22, WP-23, WP-25 |
| NEW-1. Probe ke alamat yang diketik teknisi | **Boleh** | U12 (A7) | WP-12 masuk lingkup |
| Q6. Ruangan per Core | **Satu** | U12 (A8) | WP-17 tidak direncanakan |
| Q3. Data lama di `apps/input-av/data/` | **Arsip terpisah**, tidak diimpor | U12 (A9) | WP-21 (tindakan Anda sendiri, sebelum uji perangkat keras) |
| Q10, sisa: doctor dan gain | Pemeriksaan host **masuk Core sekarang**; pengaturan gain **ditunda** | U12 (A10) | WP-20 dibangun; WP-18 ditunda (bersama kolom set D) |
| Kapan implementasi mulai | Setelah rencana lulus tiga baris verifikasinya; **otonom** sampai semua pekerjaan di Mac selesai; berhenti sebelum uji perangkat nyata | U12 (B1), P9 | Menggantikan U3 dan U5 sejauh itu. Sampai verifikasi lulus, tidak ada berkas sumber yang diubah |
| Cara kerja otonom | Controller memutuskan hal kecil dan mencatatnya; berhenti hanya untuk perubahan lingkup, FAIL keamanan, atau tindakan yang sulit dibatalkan | U12 (B2) | Semua paket |
| Git | Tugas 3 di-commit dulu sebagai baseline; branch sendiri; satu commit per fase; tanpa push | U12 (B3) | Fase 0 |
| Migrasi database | Hanya di database demo lokal, set demi set dengan rollback | U12 (B4) | WP-24, WP-25, WP-26 |
| Helper alias ber-hak khusus | Ditulis dan diuji dengan perangkat palsu; **pemasangan (sudo) oleh Anda**, setelah tinjauan keamanan | U12 (B5) | WP-19; pemasangan ada di paket uji perangkat keras |
| `apps/input-av` | Tetap tidak dilacak git, acuan hanya-baca | U12 (B6) | Semua fase |
| input-av di bench | Hanya untuk uji, bukan pemeriksaan sungguhan, sampai Core bisa merekam | U12 (B7) | Aturan peralihan (celah I-4 rencana) terjawab |
| Perangkat keras | **Tidak dipasang selama pengembangan otonom.** Pengembangan tetap jalan; uji perangkat menjadi **paket uji terpisah** setelah perangkat Anda pasang | U13 | Semua paket ditutup dengan perangkat palsu; pemeriksaan perangkat nyata dikumpulkan dalam satu paket (dibangun oleh WP-27, dijalankan sebagai WP-15) |

### Yang masih tersisa

Tidak ada lagi keputusan desain yang menahan pengembangan. Yang tersisa hanya ini:

**a. Hal kecil yang masih terbuka (tidak menahan mulai; diputuskan controller dengan catatan, kecuali Anda ingin memutuskan sendiri)**

| No | Hal | Keadaan | Yang menunggu |
|---|---|---|---|
| 1 | **Konfirmasi P3** (tafsiran "skema input dari input-av", dengan lima pengecualian di bagian 2.3) | Tidak disebut satu per satu dalam U12; isinya sudah tercakup A1, A3, A4 kecuali nilai default audio dan lima pengecualian | Nilai default di WP-03, WP-04, WP-06, WP-07, WP-08 |
| 2 | **Pilihan di dalam AM-7:** kredensial kamera diketik lagi saat adopsi (a), atau boleh hidup selama satu pekerjaan komisioning (b) | Desain tidak memberi saran, jadi U12 tidak menjawabnya. "Diamandemen sejauh dibutuhkan" (A6) paling sempit dipenuhi oleh (a); itu tafsiran, bukan putusan | WP-22 |
| 3 | **Siapa yang menulis berita acara setup awal** | Tabelnya ada (set C, WP-26); belum ada paket kerja yang membangun fungsi terima / cabut | WP-26, WP-20 |

**b. Bukan keputusan Anda, tetapi hasilnya menentukan arah (dua hasil yang ditunggu, dan satu pemeriksaan yang baru bisa dilakukan di perangkat nyata)**

| Hal | Keadaan | Akibat |
|---|---|---|
| Tinjauan keamanan (row 13) | Belum ada hasil di tangan penulis dokumen ini | Menerima relay: WP-03 seperti dirancang. Menolak: worker yang menarik (A3), fase 3 direncanakan ulang. FAIL keamanan menghentikan kerja otonom (B2). Juga menilai helper, jalur kredensial, pengaman lock-out |
| Sisa percobaan WP-01: E-8 (sesi H.265 disegel, diverifikasi, dan diputar di konsol web, tablet, ekspor), E-10 (push berhenti lalu lanjut), E-11 (push ke jalur lain) | Belum dijalankan; bagian jalur D. E-1 dan E-2 sudah lulus | E-8 menentukan apakah WP-10 perlu (pemutar menerima `hev1` atau tidak; laju frame di pembaca Core). E-10 menentukan apakah WP-11 perlu |
| H.265 dari **kamera nyata** | Tidak bisa dibuktikan sebelum perangkat dipasang | Masuk paket uji perangkat keras (H-09). Yang belum terbukti: paketisasi dan jam kamera, GOP panjang, parameter set yang datang terlambat, Linux |

**c. Tindakan Anda, terikat pada paket uji perangkat keras (bukan penahan pengembangan)**

| Tindakan | Untuk apa |
|---|---|
| Menyediakan host Linux Ubuntu 24.04 dan aksesnya | Semua pemeriksaan perangkat nyata |
| Memasang perangkat: dua kamera, interface audio dengan dua input mikrofon (pilihan soundcard), satu kamera baru dari pabrik, dan untuk satu pemeriksaan dua kamera pada alamat pabrik yang sama | Sesi dari empat sumber; fungsi komisioning |
| Memasang helper alias dengan sudo, setelah tinjauan keamanan | Fungsi alias, scan, set IP |
| Mengetik kata sandi kamera di konsol web (tidak pernah oleh agen) | Uji koneksi, set IP |
| X-1: kunci tanda tangan produksi; X-2: operator tanpa kata sandi demo | Tanpa keduanya Core produksi tidak menyala, dan uji tidak bisa berakhir dengan sesi tersegel |
| Orang di bench | Menjalankan langkah fisik: cabut kabel, tepuk tangan untuk uji sinkron, pasang kamera |
| Mengamankan `apps/input-av/data/` (WP-21) | Sebelum ada program input-av yang dijalankan di mana pun dari folder ini |

**d. Satu putusan yang memang baru bisa dibuat nanti**

Tahap 2 pencabutan kelas C ("dinyatakan layak merekam") diputuskan **hanya atas hasil paket uji perangkat keras**. Diputuskan terpisah nanti, bila diinginkan: trek audio lossless (A1), pengaturan gain (A10, setelah percobaan E-5), dukungan H.265 bila percobaan gagal (A4).

## 0. Frame (5W1H)

| Question | Answer |
|---|---|
| **What** | The register of every decision the port design needs. As of version 1.1: **16 answered entries** (Q1, Q2, Q4, Q5; Q3, Q6, Q7, Q8, Q9, Q10, NEW-1; OQ-1 to OQ-5), **0 open entries**, **2 design forks, both ruled** (F-1 with a ruled fallback that the security review can trigger; F-2 with a ruled fallback that the experiment can trigger), **8 amendments of task-3 rulings, all accepted** "as far as needed" (AM-1 to AM-8, U12 A6), **2 external dependencies** that are user actions of the hardware test package. **Remaining: 3 small items** (P3 confirmation, the choice inside AM-7, the writer of the acceptance record), **2 pending outcomes** (the security review; the remaining experiments of WP-01, which are E-8, E-10 and E-11, after E-1 and E-2 passed), **1 ruling that can only be made later** (stage 2 of the class-C lift). Version 1.0 counted 4 answered, 7 open, 2 forks, 3 amendments, 2 external. |
| **Why** | The design of row 8 is "proposed" on its Q8, Q9 and Q10 sections until the user answers (`masterplan/01_specs.md:10`). The phased plan of row 10 uses this register as the entry condition of each phase. |
| **Who** | Decision maker for every entry: the user. Input to F-1: the security review (row 13). Recorder: the controller, in `decisions/decisions.md` (this row does not write that file). |
| **When** | Written 2026-10-12, after row 8. No answer is needed for rows 11-13 of this task to run. |
| **Where** | Entries bind the later implementation task, not this plan-only task. |
| **How** | Each entry is taken from the forks of `masterplan/01_specs.md` section 7 and the work-package table of its section 9 (lines 374-396). No source file was opened by this row; no recommendation here is new, each repeats the design's with its location. |

**Count against the blueprint.** The blueprint's check for this row expects six open entries (`identification/02_structured.md:145`). The design treats NEW-1 (discovery fallbacks) as a seventh (`masterplan/01_specs.md:331`; first proposed at `research/03_analysis.md:352`). This register holds **seven** open entries. Whether NEW-1 is accepted as an entry is the controller's call; it is included so that it is not lost. After the integration pass none of the seven is open: U6, U7, U9 and U10 answered three parts of Q10, and U12 answered Q8, Q7, Q9, NEW-1, Q6, Q3 and the last two parts of Q10. The five schema questions were added and answered on the same day (U11).

**Lines at the head.** The Indonesian list "Sudah diputuskan" has 31 lines. "Yang masih tersisa" has 3 small items (a), 2 pending outcomes and the real-camera H.265 check that belongs to the hardware test package (b, 3 lines), 7 user actions tied to the hardware test package (c) and 1 later ruling (d).

**Identifier rule.** A work package named under "Blocks" is blocked **directly**: the entry is named in that package's "Blocked by" cell (`masterplan/01_specs.md:374-396`). Packages that only depend on a blocked package are listed under "Blocks through dependency".

## 1. Overview of entries

The last two columns no longer mean "blocked": every entry is answered. They name the packages each answer governs.

| Entry | Subject | State | Answer | Work packages it governs | Through dependency |
|---|---|---|---|---|---|
| Q1 | Meaning of "pencatatan ganda" | Answered (U1, P4) | No second system of record | - | - |
| Q2 | Fate of input-av | Answered (U1, P4; U12 B6, B7) | No recording role; the tree is an untracked read-only reference; the bench installation is for tests only until the Core can record | - | - |
| Q4 | Codec, input side | Answered (U2; U12 A4). P3 not confirmed by name | As the camera delivers, judged from the stream | - | - |
| Q5 | Audio, input side | Answered (U2). P3 not confirmed by name | USB Audio Class card through ALSA shared capture | - | - |
| Q8 | Stored evidence form | **Answered (U12 A1)** | The Core's form (variant C); a lossless track is decided separately later | WP-16: not planned; nine parameters recorded as not carried | - |
| Q3 | Legacy data | **Answered (U12 A9)** | Separate archive, not imported | WP-21, a user action before the hardware test package | - |
| Q6 | Rooms per Core | **Answered (U12 A8)** | One room per Core | WP-17: not planned | - |
| Q7 | Production host | **Answered (U12 A2)** | Linux, Ubuntu 24.04 | WP-07, WP-08, WP-14, WP-15, WP-19, WP-22 | WP-13, WP-20 |
| Q9 | Lifting class C | **Answered (U12 A5)** | Once, both kinds, two stages; stage 2 only on the result of the hardware test package (U13) | WP-13 (stage 1), WP-15 (stage 2) | WP-27 |
| Q10-a | Network functions: factory-IP scan, temporary alias, set camera IP | **Answered (U6, U7)** | Required, in the Core | WP-19, WP-22, WP-23, WP-25 | WP-14 (helper clause) |
| Q10-b | Passive monitor (H-28) | **Answered (U9)** | Not required; active scan only | - | - |
| Q10-c | Role for the commissioning functions | **Answered (U10)** | TECHNICIAN only | WP-23 | WP-19, WP-22 |
| Q10-d | Gain setting | **Answered (U12 A10)** | Deferred | WP-18: deferred, with the columns of schema set D | - |
| Q10-e | Doctor / host checks | **Answered (U12 A10)** | Moved into the Core now | WP-20 | - |
| NEW-1 | Discovery fallbacks of the camera search | **Answered (U12 A7)** | A probe to an address typed by the technician is allowed; no sweep, no automatic follow | WP-12: in scope | - |
| OQ-1 | Store devices seen but not adopted | **Answered: no** (U11) | - | - | - |
| OQ-2 | Installation acceptance as a stored Core record | **Answered: yes, as set C** (U11) | - | - (WP-26 is no longer gated) | - |
| OQ-3 | Gain and A/V offset stored now or with their function | **Answered: with their function, set D** (U11) | - | - | - |
| OQ-4 | Automatic choice of the camera interface | **Answered: no, the technician chooses once** (U11) | - | - | - |
| OQ-5 | One schema set or three | **Answered: three** (U11) | - | - | - |
| F-1 | Camera pull | **Ruled (U12 A3)**; the trigger of its fallback is pending | Relay (variant A); if the security review rejects it, the worker pulls (variant B) | WP-03 | WP-05, WP-06, WP-13, WP-15 |
| F-2 | HEVC | **Ruled (U12 A4)**; E-1 and E-2 of the experiment ordered by U4 PASS on this Mac with generated sources; the H.264 fallback is not triggered | Codec as delivered, judged from the stream; if the experiment fails, cameras are set to H.264 first and H.265 support becomes a follow-up package | WP-05, WP-10 | WP-13 (condition L-4) |
| AM-1 | D86 C-5 | **Accepted (U12 A6)**; the amending row is written at the lift | Amended for `ONVIF_RTSP` and `USB_AUDIO` | WP-13 | WP-15 |
| AM-2 | D82 | **Accepted (U12 A6)** | Codec judged from the stream | WP-05 | WP-13 |
| AM-3 | D80(10), for the search | **Accepted (U12 A6, A7)** | Typed-address unicast probe allowed | WP-12 | - |
| AM-4 | D75, no configuration change on a discovered device | **Accepted (U12 A6)** | Amended for the network configuration of a camera and a temporary host address only | WP-19, WP-22 | WP-23, WP-25 |
| AM-5 | D80(1), probe-answer data only | **Accepted (U12 A6)** | Kept for the search; the commissioning scan is a separate operation | WP-19 | WP-22 |
| AM-6 | D80(10), for commissioning | **Accepted (U12 A6)** | Lifted for commissioning: stored list plus one typed address | WP-19 | WP-22 |
| AM-7 | D81 with D80(7), credential-carrying operations | **Accepted (U12 A6)**; **one choice inside it remains** | A fourth operation, web console only. Typed again for adoption (a), or alive for one job (b): not answered, no recommendation existed | WP-22 | - |
| AM-8 | D76 (3), order before adoption | **Accepted (U12 A6)** | A set-network step before adoption | WP-22 | - |

**What "accepted as far as needed" leaves to the controller.** U12 A6 is the user's ruling that the six task-3 rulings are amended as far as the openers and the network functions need. The exact amended wording per ruling is the "what exactly changes" column of sections 5 and 5.1; writing each as a decision row is the controller's act (B2), at the time each section names. An amendment wider than those columns is a scope change and goes back to the user.

Work packages governed by no entry: WP-01, WP-02, WP-04, WP-06, WP-09, WP-11, WP-24, WP-26 and WP-27. Since U12 and U13 no work package waits for a user decision. What packages still wait for, other than work: the outcome of the security review (WP-03, WP-13, WP-19, WP-22), the outcome of the remaining experiments of WP-01 (WP-10 on E-8, WP-11 on E-10), the hardware (WP-15), the user in person (WP-21).

**Change against version 1.0 in this table.** WP-19 is no longer blocked by Q10 and no longer depends on WP-12 (`delegation_progress/amendment_1_network_tools.md`, table of changed packages), so NEW-1 and AM-3 block nothing through dependency.

## 2. Answered entries

### Q1. Meaning of "pencatatan ganda"

- **Answer:** no second system of record: one database, one audit chain, one user base, one evidence format, one device registry.
- **Source:** U1 (`decisions/decisions.md:7`) as read by P4 (`decisions/decisions.md:10`).
- **Effect on the design:** constraint C13 (`identification/02_structured.md:52`); the record map closes at 0 record kinds with two owners under conditions TC-1 to TC-5 (`research/03_analysis_record_map.md:372-382`).
- **Note for the controller:** row P1 of `decisions/decisions.md:5` still carries the status "UNCONFIRMED" for the same assumption that P4 closes. The two rows should agree.

### Q2. Fate of input-av

- **Answer:** input-av keeps no recording role. What remains as a tool, if anything, is entry Q10.
- **Source:** U1 (`decisions/decisions.md:7`) as read by P4 (`decisions/decisions.md:10`).
- **Effect on the design:** the application does not run as a service on a Core installation; the source tree stays as the reference the port is read from; nothing in it is deleted or renamed (`masterplan/01_specs.md:366-368`).
- **Boundary the rulings do not cover:** the existing input-av installation on its own bench machine (`identification/01_translated.md:152`). No ruling found says what it may do until the Core can record real sources. The plan proposes a rule (`masterplan/02_plan.md`, "System of record"); it needs the user's confirmation and is listed there, not here, because it is a transition rule and not a design fork. **Answered since by U12 B7 (`decisions/decisions.md:24`): the bench input-av is for tests only, not real examinations, until the Core can record; and B6: `apps/input-av` stays untracked, a read-only reference.**

### Q4. Codec, input side

- **Answer:** the codec the camera delivers, H.265 included.
- **Source:** U2 (`decisions/decisions.md:8`) as read by P3 (`decisions/decisions.md:9`). **P3 is the controller's reading and is to be confirmed** (section 2.3).
- **Effect on the design:** the stored side is Q8; whether the Core's worker carries H.265 at all is unproven and is fork F-2.

### Q5. Audio, input side

- **Answer:** a USB Audio Class card through ALSA shared capture, all device channels opened then inputs selected, 24-bit / 48 kHz.
- **Source:** U2 (`decisions/decisions.md:8`) as read by P3 (`decisions/decisions.md:9`). **P3 to be confirmed** (section 2.3).
- **Effect on the design:** the capture side fits the existing microphone pipe with a helper change only (`research/03_analysis.md:103`); the stored side is Q8; the host is Q7.

### 2.3 Confirmation request for P3

One line for the user: **"Is P3 the correct reading of U2, with the five departures below?"** If the user corrects P3, the default-parameter table of the design (`masterplan/01_specs.md:161-180`) changes on the affected parameters only, and with it WP-03, WP-04, WP-06, WP-07, WP-08.

**The five places where the port departs from the tested scheme** (`masterplan/01_specs.md:50`). P3 says the defaults "follow input-av as tested"; in these five the design does not follow it, each for a stated reason.

| # | The tested scheme in input-av | What the port does | Reason | Source |
|---|---|---|---|---|
| D-1 | The camera credential sits inside the URL and the argument list | Credential in a start message on standard input; never in a URL, argument, environment or file | The Core forbids that form | `apps/core-server/src/capture/adapters/credential.ts:117-125` via `masterplan/01_specs.md:50,173` |
| D-2 | Camera audio is mapped into the recording command | Camera audio is not carried | The worker drops it; it was never observed on the bench | `apps/capture-worker/src/ingest.c:541` via `masterplan/01_specs.md:50,176` |
| D-3 | The audio source defaults to the "first USB card" | No automatic choice: a microphone is a named card and input | On the bench it moved two microphones to another card unnoticed | `apps/input-av/docs/SERAH-TERIMA.md:189-193` via `masterplan/01_specs.md:50,180` |
| D-4 | Discovery falls back to ARP sweep, neighbour table and ping | Not carried | Forbidden by D80(1) and D80(10); see NEW-1 | `masterplan/01_specs.md:50,331-343` |
| D-5 | A reconnect closes the file and starts a new, separately hashed part | A gap in the same track, recorded as a fault raised and cleared | The Core's track key has no place for parts | `research/03_analysis_record_map.md:306` via `masterplan/01_specs.md:50,312` |

**Three points where P3's wording is looser than the source** (`research/03_analysis.md:353`). They change no design item; the user should see them when confirming.

| # | P3 wording | What the source shows |
|---|---|---|
| N-1 | "ONVIF main stream" | The rule in the source is "largest pixel area per video source" (`apps/input-av/nvr/onvif_client.py:248-249` via `masterplan/01_specs.md:167`) |
| N-2 | "24-bit / 48 kHz" | A 24-bit capture **request**, exact at the pipe after conversion to 32-bit float; it is not a property of what is stored (`masterplan/01_specs.md:179`) |
| N-3 | "the tested one" | The camera scheme is field-tested for 54-57 s per camera inside input-av's own plumbing; the audio scheme is logic-tested and its recordings on the USB interface were practically silent; no part of the Core path has run on real hardware (`masterplan/01_specs.md:56-67`) |

Row 8 and row 7 each named "five differences" and the two lists overlap on D-2 and D-3 only. Both are given in full above so that the controller can choose the wording of the confirmation line.

## 3. Entries that were open in version 1.0 (all answered by U12)

Each entry keeps its option table as the record of what was chosen between. The line "ANSWERED" at its head is the state; the bullets "Recommended default", "Blocks" and "Proceeds without an answer" below it are version 1.0 text.

### Q8. Stored evidence form

**ANSWERED (U12 A1, `decisions/decisions.md:24`): the Core's form, variant C.** fMP4 + AAC mono; audio not lossless; the standby microphone is not stored; a lossless track is decided separately later. Effect: WP-16 is not planned; its nine parameters are recorded as "not carried".

**Pertanyaan (Bahasa Indonesia):** Bukti disimpan dalam bentuk apa: bentuk Core (satu fMP4 per kamera, video disalin, satu trek AAC mono dari mikrofon aktif), bentuk input-av (MPEG-TS dan audio lossless terpisah untuk setiap input), atau bentuk Core ditambah satu trek lossless per mikrofon?

| Option | Consequence on the design | Size |
|---|---|---|
| **C: as the Core stores (recommended)** | No change in S1-S5; S6 needs only the HEVC proof. Sealing, playback, export and verify rules stand. Given up: lossless 24-bit audio; **the standby microphone is not stored**; bit-exact samples; audio as a separate file; a reconnect as a separate hashed file (`masterplan/01_specs.md:304-312`) | S, nothing to build; WP-16 closes nine parameters as "not carried" |
| I: as input-av stores | Changes the muxer, the fragment writer, the audio path, the plan and protocol version, the fragment table and reader, the sealing layout, manifest fields 43 and 53, the track key, the media route, both clients' players, export and the verify rule. Re-decides OD-06, OD-21 and R-4 of task 3 (`masterplan/01_specs.md:290-300`) | L several times over; must be split before it can be planned |
| M: Core form plus a lossless side track per microphone | A second writer per microphone before the resampler; audio output paths in the plan and a protocol version change; manifest and track rows added; players unchanged. Buys back lossless, every input, bit-exact. OD-06 is added to, not replaced (`masterplan/01_specs.md:290-314`) | M (WP-16) |

- **Recommended default:** C. Reasons (`masterplan/01_specs.md:302`): the one system of record's sealing, playback, verification and export are built and tested on this form; input-av's stated reason for MPEG-TS is an ingest reason the Core already meets; the audio side of the input-av form is its weakly tested side.
- **What the user must accept knowingly under C:** one of two microphones is evidence; audio is AAC at 96 kbit/s.
- **Blocks:** WP-16. **Phase:** 8 (additions).
- **Proceeds without an answer:** everything else. Under no answer, the plan builds as if C.
- **Timing note:** if M is wanted, answering before the lift (phase 6) lets the hardware milestone cover the side track; answering after it means repeating the affected part of WP-15.
- **Who decides:** the user.

### Q3. Legacy data in `apps/input-av/data/`

**ANSWERED (U12 A9): a separate archive, not imported.** With B6: `apps/input-av` stays untracked and is a read-only reference. Effect: WP-21 (the guard) is the user's own action, tied to the hardware test package: done before any input-av program is started anywhere from this tree. Which of the three guard forms is used is the user's choice at that time.

**Pertanyaan:** Data yang sudah ada di `apps/input-av/data/` diapakan: dibiarkan sebagai arsip terpisah, atau diimpor ke Core?

| Option | Consequence on the design |
|---|---|
| **Leave as a separate archive that nothing writes (recommended)** | No line of the record map changes. The folder needs a guard, WP-21, because the doctor, the level meter and the application write into it when started from the source directory (`research/03_analysis_record_map.md:353`). Guard forms, the user's choice: the folder moved out of the tree; or set read-only; or left where it is under the standing rule that no input-av program is ever started from this tree |
| Import into the Core | No lossless target exists: numbered parts, separate audio files, another audit hash form with non-Core actors, plain-text camera credentials, no evidence class for an item not sealed by the Core (`research/03_analysis_record_map.md:348`). A separate project with its own rulings |

- **Recommended default:** leave as an archive. Reason: an import has no lossless target (`masterplan/01_specs.md:362`).
- **Blocks:** WP-21. **Phase:** 9 (a user action; no agent performs it).
- **Proceeds without an answer:** every phase, because no phase of the plan opens the folder or starts an input-av program.
- **Who decides:** the user. Deleting the data is not offered as an option.

### Q6. Rooms per Core

**ANSWERED (U12 A8): one room per Core.** Effect: WP-17 is not planned.

**Pertanyaan:** Satu Core melayani satu ruangan, atau beberapa ruangan sekaligus?

| Option | Consequence on the design |
|---|---|
| **One room per Core (recommended)** | As built: R-6 of task 3 is held by a database check, the supervisor, the worker's limits and the selector shape. Each room needs its own Core and its own audio interface; the bench arrangement of four rooms on one host sharing one interface is not reproduced (`masterplan/01_specs.md:358`) |
| Several rooms per Core | An L-sized change across all four holders; changes the plan and the worker limits (S5, S6). WP-17, not planned; it would be split and planned as its own task |

- **Recommended default:** one room. Reason: the rule is in force and built; "eight rooms" was run with virtual cameras only (`masterplan/01_specs.md:358`).
- **Blocks:** WP-17. **Phase:** 8, not executed under the default.
- **Proceeds without an answer:** the whole single-room port.
- **Who decides:** the user.

### Q7. Linux production host

**ANSWERED (U12 A2): Linux, Ubuntu 24.04.** With U13: no host and no device is installed during the autonomous development. Effect: WP-07, WP-08, WP-14, WP-19, WP-20 and WP-22 are written for Linux and closed on doubles on the development Mac; what only a Linux host with devices can show is collected in the hardware acceptance test package (built by WP-27, run as WP-15). Hypothesis H-K (sync level on Linux) stays unsettled until that package runs.

**Pertanyaan:** Apakah host produksi Core (yang menangkap kamera dan mikrofon) memakai Linux?

| Option | Consequence on the design |
|---|---|
| **Linux (recommended)** | The audio path as tested. Cost: the host profile WP-14 (worker built on the pinned library on Linux, parent-death method, firewall rule, audio access, sleep and time sync). Hypothesis H-K: on Linux the worker would state sync level `FSYNC`, which the capture session treats as critical in `REAL_PRODUCTION` (D189), so that rule may need revisiting; if H-K holds, that is a further ruling to amend, not yet an entry (`masterplan/01_specs.md:351`) |
| macOS | No ALSA. The USB interface would go through the development helper's input, a path never tested on that interface; U2's "tested" no longer applies to audio (`masterplan/01_specs.md:352`) |

- **Recommended default:** Linux. Reason: the tested audio scheme exists on Linux only; no ruling of task 3 names the capture host's system (`masterplan/01_specs.md:347`).
- **Blocks:** WP-07, WP-08, WP-14, WP-15, and since Amendment 1 WP-19 and WP-22 (the commissioning function is Linux only, rule DR-1 of the design). Through dependency: WP-13 (needs WP-07 and WP-08), WP-18, WP-20. **Phases:** 4, 5, 7, 10.
- **Proceeds without an answer:** the camera side (WP-01 to WP-06, WP-09), which is host-neutral, and schema set A (WP-24).
- **Needs besides the answer:** someone to provide the host and the hardware. The plan carries that as an external dependency.
- **Who decides:** the user.

### Q9. Lifting class C

**ANSWERED (U12 A5): once for camera and microphone, in two stages.** Stage 1, in code (WP-13), inside the autonomous development. Stage 2, "declared fit to record", is ruled by the user **only on the result of the hardware acceptance test package** (U13); nothing in the development track declares it. Condition L-6 (a Linux host, X-1, X-2) belongs to stage 2.

**Pertanyaan:** Dalam kondisi apa, dan atas putusan siapa, aturan kelas C (adapter produksi tidak boleh punya opener) dicabut?

| Option | Consequence on the design |
|---|---|
| **Once, for `ONVIF_RTSP` and `USB_AUDIO` together, in one change set, after conditions L-1 to L-6, in two stages (recommended)** | Stage 1, lift in code: L-1 to L-5 hold, WP-13 lands. Stage 2, declared recordable: the hardware milestone WP-15 has passed; the limits in the task 3 README and specification are withdrawn by erratum (`masterplan/01_specs.md:184-199`) |
| One kind at a time | Nothing becomes recordable, because a production session needs two production cameras and two production microphones of one source class; the rule is merely weaker (`masterplan/01_specs.md:186`) |
| No lift for now | Both openers can still be built and tested behind the rule on doubles (WP-02 to WP-09). The port then exists but records nothing in `REAL_PRODUCTION`; WP-13 and WP-15 do not run |

The six conditions (`masterplan/01_specs.md:190-197`): L-1 a decision row amending D86 C-5 (entry AM-1); L-2 the answer to SEC35-40 built and accepted by the security review; L-3 the credential shown never to reach an argument list, the environment, a log or a file; L-4 an outcome for HEVC (WP-01 passed, or the H.264 fallback chosen); L-5 both openers complete on doubles (WP-02 to WP-09); L-6 a Linux host plus X-1 and X-2.

- **Recommended default:** the first option. Reason: one kind alone makes nothing recordable.
- **Blocks:** WP-13, WP-15. **Phases:** 6, 7.
- **Proceeds without an answer:** all design work and every package built behind the rule with fake devices (phases 1 to 5).
- **What the answer is:** acceptance of the conditions and of the two stages now. The amending decision row itself (AM-1) is written when the conditions hold, not now.
- **Who decides:** the user.

### Q10. The four non-recording tools (answered in all five parts)

**State after U6, U7, U9, U10 and U12 A10.**

| Part | Subject | State | Answer or recommendation | Source | Work packages |
|---|---|---|---|---|---|
| Q10-a | Factory-IP scan, temporary IP alias, set camera IP | **ANSWERED** | Required; adapted into the Core as a commissioning function (home (a) of fork F-4) | U6 (`decisions/decisions.md:16`), P7 confirmed and the home ruled by U7 (`:18`) | WP-19 (alias helper, scan), WP-22 (set camera IP), WP-23 (audit types, permission), WP-25 (schema set B); a clause of WP-14 |
| Q10-b | Passive monitor (H-28) | **ANSWERED** | Not required; active scan only | U9 (`:20`) | None. Not part of WP-19 |
| Q10-c | Who may run the commissioning functions | **ANSWERED** | The TECHNICIAN role only | U10 (`:21`) | WP-23 (the permission), WP-19, WP-22 |
| Q10-d | Gain setting | **ANSWERED** | Deferred. The pre-session level check is built inside WP-08 | U12 A10 (`:24`) | WP-18 deferred, with the three columns of schema set D (U11 on OQ-3) |
| Q10-e | Doctor / host checks | **ANSWERED** | Moved into the Core now: boot checks and diagnostics | U12 A10 (`:24`) | WP-20 |

**What U7 did not settle, and what settled it.** U7 fixed the home and lifted no ruling of task 3. The five amendments AM-4 to AM-8 (section 5.1) were accepted afterwards by U12 A6. Still pending: row 13's rating of the privileged helper, the credential path and the lock-out guard (`masterplan/01_specs.md`, F-4.3 and F-4.4), and the choice inside AM-7. By U12 B5 the helper is written and tested on doubles; its installation with `sudo` is the user's, after the security review.

**Consequence of Q10-b the user should know.** With the passive monitor not carried, a camera on a factory address that is not in the stored list is found only when the operator types its address from the label or the manual. On the bench the three Tiandy cameras sat on 192.168.1.10, .11 and .12, none of which is a default entry of the list (`masterplan/01_specs.md`, F-4.1 row 2 and F-4.3 point 7). The list is a setting and can be extended (schema set B, `capture_network_config.factory_addresses`).

**Consequence of Q10-c.** Today the camera search needs a permission that SUPERVISOR and TECHNICIAN both hold; commissioning gets a narrower permission of its own (rule DR-9). SUPERVISOR and INVESTIGATOR do not hold it.

*The text below is the entry as written in version 1.0, kept for the record. For the two network tools it is overruled by U6 and U7; for the doctor and gain calibration its recommendation was accepted by U12 A10.*

**Pertanyaan:** Empat alat input-av yang bukan perekaman (scan IP pabrik, set IP kamera, kalibrasi gain, doctor): dipindah ke Core, dipertahankan sebagai alat instalasi, atau dibuang?

Fact that frames every option: none of the four meets C13 as built, all four sit behind input-av's own users, and the doctor creates the whole input-av database when it runs (`research/03_analysis_record_map.md:316-323`). "Keep" therefore always means changing input-av code, and an action that changes a network is never left unrecorded and never given a private log (`research/03_analysis_record_map.md:290`).

| Tool | Port into the Core | Keep after cutting its record writes | Drop | Recommended |
|---|---|---|---|---|
| Doctor | Host checks become Core boot checks and feed the diagnostics operation. WP-20, S | Possible by removal alone, the only one of the four; still a Python tool beside the Core | The Linux host has no check of its audio prerequisites | **Port, thin** |
| Gain calibration | Meter and pre-session level check: in WP-08. Gain setting: a new audit type and a screen. WP-18, M | Meter and test record only; a gain change stays unrecorded | Levels are set with the operating system's mixer; nothing records it; on the bench the setting was lost on re-plug | **Port the level check; drop gain setting for now**, decide again after experiment E-5 |
| Factory-IP scan | A root helper in the Core, new audit types, a ruling against D75 and D80(1). WP-19, M | Its actions then leave no record anywhere | No longer available: overruled by U6 | ~~Drop from the product~~ **DECIDED (U6, U7): ported into the Core.** WP-19, WP-23, WP-25 |
| Set camera IP and wizard | As above, and the credential must go through the Core's write-only path; the wizard's plain-text registration is never carried. WP-22 since Amendment 1 | The set-IP call still receives a camera credential outside the Core's path | No longer available: overruled by U6 | ~~Drop from the product~~ **DECIDED (U6, U7): ported into the Core**, without the wizard's registration step. WP-22 |

Source of the table: `masterplan/01_specs.md`, fork F-4 (first issue at lines 316-329 of the file before Amendment 1).

- **Answer for the last two parts (U12 A10):** neither is kept as an input-av tool; the host checks are ported (WP-20) with the level check (inside WP-08); gain setting is deferred (WP-18).
- **Governs:** WP-20 in phase 5; WP-18 deferred in phase 8. WP-19, WP-22, WP-23 and WP-25 are in phase 10 of the development track.
- **Who decided:** the user.

### NEW-1. Discovery fallbacks (the seventh entry)

**ANSWERED (U12 A7): a probe to an address typed by the technician is allowed.** With A6 this accepts AM-3. Effect: WP-12 is in scope and is built in the development track; the ARP sweep, ping and the direct unauthenticated check stay out of the camera search, and a changed camera address is never followed automatically. The design's order "host firewall rule first, typed-address probe only if cameras are still not found" cannot be tried without a host (U13), so the probe is built without waiting for that observation; whether the firewall rule alone would have sufficed is recorded by the hardware test package.

**Pertanyaan:** Jika kamera tidak menjawab pencarian multicast, apa yang boleh dilakukan Core produksi: tidak ada, probe ke alamat yang diketik operator, atau seluruh cadangan input-av (ARP sweep, tabel tetangga, ping, pemeriksaan ONVIF langsung)? Dan bolehkah alamat kamera terdaftar yang berubah diikuti secara otomatis?

| Option | Rulings touched | Consequence on the design |
|---|---|---|
| As built: multicast probe only | none | A camera that does not answer multicast cannot be found |
| **Host firewall rule first, then a typed-address unicast probe if still needed (recommended)** | D80(10) only, and only for the second step | The firewall rule is a line of the host profile (WP-14). The probe adds an address member to the search and a body to the search operation; an operator-confirmed re-address with a new audit type. WP-12, S to M |
| Full input-av set | D75, D76, D80(1), D80(10); needs a stored camera-network setting | An active scanner inside the Core; M plus a security review |

Source: `masterplan/01_specs.md:331-343`.

- **Recommended default:** the second option, and address-follow **never automatic**. Reasons: on the bench the fallback was needed because the host firewall blocked multicast answers, a host fault and not a protocol gap; a probe answer is forgeable, so silently re-pointing a registered camera would send a credentialed connection to whoever answered (`masterplan/01_specs.md:335,343`).
- **Blocks:** WP-12. **Phase:** 8. (Version 1.0 named WP-19 through dependency; Amendment 1 removed that dependency: the unicast probe is shared with WP-12 and is built in WP-19 if WP-12 does not run.)
- **Proceeds without an answer:** everything on the recording path and the commissioning functions; discovery stays as built.
- **Boundary to commissioning:** this entry is about the camera search only. The commissioning scan is a separate operation with its own amendments (AM-5, AM-6); answering NEW-1 either way does not lift or restrict it (`masterplan/01_specs.md`, fork F-5, last paragraph).
- **Who decides:** the user. The amendment it implies is AM-3.

## 4. Design forks that needed a user ruling (both ruled by U12)

The design owns its forks, but these two reach a ruling of task 3 or a wording of the user, so the design cannot close them alone.

### F-1. How a production camera reaches the worker

**RULED (U12 A3): the relay in front of the unchanged worker (variant A); if the security review rejects it, the worker pulls (variant B).** The fallback is ruled in advance, so a rejection by row 13 changes the plan of phase 3 without a new question to the user. Whether row 13 accepts measures SA-1 to SA-3 is not known to this register. Variant B amends D82's "never dials out"; that is inside A6 ("as far as the openers need") only if the fallback is taken. A security FAIL stops the autonomous work (B2).

**Pertanyaan:** Kamera produksi ditarik oleh program relay kecil di depan worker yang tidak diubah (temuan keamanan SEC35-40 terbuka kembali dan harus dijawab), atau worker sendiri yang menghubungi kamera (jaminan "worker tidak pernah menghubungi keluar" hilang)?

| Option | Consequence on the design |
|---|---|
| **A: pull relay in front of the unchanged worker (recommended, conditional)** | No contract or protocol change; the worker keeps "listens on loopback, never dials out"; a malformed camera stream ends one relay, not the session. Price: a loopback listener exists in `REAL_PRODUCTION`, so finding SEC35-40 returns and must be answered by measures SA-1 to SA-3; a residual remains for a process running as the Core's own user. WP-02 (S) plus WP-03 (M) |
| B: the worker dials the camera | No listener, so SEC35-40 does not arise. The plan and protocol version change; the process that writes both camera files and the audio also parses the camera network and holds a credential; reconnect moves into the ingest loop. Amends D82's worker guarantee. M in the worker plus M in the protocol and plan builder |
| C: a ready-made relay or the FFmpeg program | Not available: the credential would sit in an argument list, a configuration file or an API call |

Source: `masterplan/01_specs.md:233-261`.

- **Why it needs the user:** variant A re-opens a security finding that task 3 closed by having no listener (D86 C-5); accepting the proposed answer and its residual is not a design call. Variant B gives up a guarantee stated in D82.
- **Recommended default:** A, **on condition that row 13 accepts SA-1 to SA-3**. If not accepted, B is the fallback, never C.
- **Sub-choice inside A, also for the user to note:** the relay stamps arrival time on the Core host, so recording does not depend on a camera clock the Core may not set. Stated cost: stored video time is arrival time; drift between video and audio over a long session is hypothesis H-J, measured by experiment E-9 (`masterplan/01_specs.md:261`).
- **Blocks:** WP-03. Through dependency: WP-05, WP-06, WP-13, WP-15. **Phases:** 3, then 6 and 7.
- **Proceeds without an answer:** WP-01, WP-02, WP-04, WP-09, and the audio side once Q7 is answered.
- **Who decides:** the user, after row 13's finding.

### F-2. HEVC handling

**RULED (U12 A4): the codec as the camera delivers it, judged from the stream; if the experiment fails, cameras are set to H.264 first and H.265 support becomes a follow-up package.** Effect: target H1 with AM-2; fallback H2 accepted as the interim state; H3 and H4 are not chosen. **The fallback is not triggered by the experiment as far as it has run:** E-1 and E-2 pass (last bullet of this entry). WP-10 (sample-entry name; frame rate for HEVC in the Core reader) now depends on E-8, which has not run: if the clients play `hev1` and the reader handles the stream, WP-10 is not needed; if not, WP-10 runs in the development track when the change is the one WP-10 names, and becomes the follow-up package of A4 when it is more. Where that line lies is a controller's decision with a log entry (B2), made on E-8's result.

**Pertanyaan:** Target tetap "codec apa adanya dari kamera" (H.265)? Jika percobaan menunjukkan worker belum bisa, bolehkah kamera diatur ke H.264 secara manual sebagai jalan sementara? Dan codec dinilai dari stream, bukan dari jawaban ONVIF?

| Option | Consequence on the design |
|---|---|
| **H1: copy HEVC into the Core's fMP4 (recommended target)** | WP-01 first (S, development host, fakes). Then possibly WP-10 (S to M) for the sample-entry name and the reader's frame rate |
| **H2: the installer sets each camera's main stream to H.264 by hand (recommended fallback and interim state)** | No code. Departs from U2's "as delivered" |
| H3: transcode to H.264 at ingest | Breaks the copy-only rule R-4. Rejected by the design |
| H4: store HEVC, derive an H.264 viewing copy marked "not evidence" | A new Core artifact with its own route, storage and audit. Only if playback (E-8) fails and H2 is refused |

Source: `masterplan/01_specs.md:263-284`.

- **Why it needs the user:** H2 departs from the user's own wording in U2, so only the user can accept it as interim or fallback; H4 adds an artifact kind; judging the codec from the stream amends D82 (entry AM-2).
- **Recommended default:** H1 as target, H2 as fallback, WP-01 run before any other package assumes H.265. Reason: HEVC through the worker is unproven; all four bench cameras report H264 over ONVIF while delivering H.265 (`masterplan/01_specs.md:284`).
- **Blocks:** WP-10. Condition L-4 of the lift (WP-13) needs the outcome. **Phases:** 3 (WP-10), 6.
- **Proceeds without an answer:** WP-01 itself and everything that does not assume a codec.
- **Who decides:** the user. The experiment decides whether a ruling is needed at all: if WP-01 passes on all runs, only AM-2 remains.
- **Status of the experiment (U4).** The user ordered the H.265 check on this machine now (`decisions/decisions.md:14`). `test/01_hevc_experiment.md` as it stands at the end of this pass has status `complete` (an earlier state of the same file, read at the start of this pass, was `blocked` / "NOT RUN"). What it reports, in its own figures:

  | Variant | SDP carries `sprop-*` | Ingest | File | Verdict of the report |
  |---|---|---|---|---|
  | `h264_control` | yes | h264, extradata 37 | h264 / `avc1`, 350 frames, 0 decode errors, 8 `moof` | PASS |
  | `hevc_a` (E-1, parameter sets announced) | yes | hevc, extradata 85 | hevc / `hev1`, 1920x1080, 350 frames, 0 decode errors, 8 `moof` | PASS |
  | `hevc_b` | yes: the flag did not remove them | as `hevc_a` | as `hevc_a` | Not the intended case; counted as nothing for E-2 |
  | `hevc_b2` (E-2, in-band only; no `a=fmtp` line) | no | hevc, extradata 87, taken from the stream | hevc / `hev1`, 1920x1080, 350 frames, 0 decode errors, 8 `moof` | PASS |

  350 is the expected count: 375 frames pushed less the 25 the worker leaves out by its documented start rule. `INGEST_NO_EXTRADATA` was not logged in any run; no error line in any worker log. The worker was the existing release build, not rebuilt, no tracked file modified. The Core's tail validation accepted the HEVC files as CLEAN; the report says that this is not sealing. The report states that hypotheses H-C, H-G and, "on this host for this stream", H-F hold. The controller told this row that it re-probed and re-decoded both files independently with the same numbers; that statement is not in the report file.

  **Unproven, by the report's own section 2:** a real camera (packetisation, sender-report clock, long GOPs, B-frames, late parameter sets, higher bit rates); a camera whose first parameter sets come later than the probe window, where `INGEST_NO_EXTRADATA` remains reachable; the Core's sealing and verification of an HEVC session and playback in the web console, tablet and export (E-8); acceptance of `hev1` by players; Linux and another libavformat build; E-10 and E-11, which were not part of that run.

  **Consequences.** (1) The "cameras set to H.264" fallback of A4 is not triggered by this experiment. (2) WP-01 is partly done: E-1 and E-2, worker half, done; E-8, E-10, E-11 and the written verdict over all five remain, in the development track. (3) WP-10 depends on E-8; WP-11 on E-10. (4) H.265 from a real camera is a check of the hardware acceptance test package (plan, H-09). (5) Condition L-4 of the lift ("an outcome for HEVC") has its worker half; whether E-8 belongs to L-4 is for the controller to say at the lift.

## 5. Rulings of task 3 that are amended (all accepted by U12 A6)

**ACCEPTED (U12 A6, `decisions/decisions.md:24`): "the task-3 rulings D86 C-5, D82, D75, D80, D81, D76(3) are amended as far as the camera/microphone openers and the network functions need."** That covers AM-1 to AM-8. The columns "Amendment proposed" and "What exactly changes" below are the extent that is needed; the column "Who decides" is version 1.0 text and is answered. Remaining inside the acceptance: the choice (a) or (b) of AM-7, and the amending decision rows themselves, which the controller writes at the time each line names (AM-1 at the lift).

None is implied by the design; each needs its own decision row at the time stated (`masterplan/01_specs.md:421`). The texts are quoted from row 5's collection; this row did not open the task 3 decision file.

| Entry | Ruling today | Amendment proposed | When | Blocks | Who decides |
|---|---|---|---|---|---|
| AM-1 | D86 C-5: "no listener and no session start for a source kind without an opener; no all-PRODUCTION package can be produced in this phase" (`research/02_collection_rulings.md:76`) | For `ONVIF_RTSP` and `USB_AUDIO`: an opener may be stated and a listener may exist for a session whose four slots resolved to adapters with an opener. The rule stays for every other kind | When L-2 to L-5 hold; it is condition L-1. Not now | WP-13 | The user |
| AM-2 | D82: "codec/profile is judged from the authenticated ONVIF answer" (quoted at `masterplan/01_specs.md:284`) | The codec is judged from the stream by the relay in probe mode; the outcome vocabulary grows additively and `NOT_H264` stays for a stream that is neither H.264 nor HEVC. If F-1 is answered B, D82's "never dials out" is amended as well | Before WP-05 starts | WP-05 | The user |
| AM-3 | D80(10): "a camera that does not answer multicast cannot be found and typed-address entry is NOT in scope - recorded as a gap" (`research/02_collection_rulings.md:210`) | Typed-address unicast probe allowed; probe-answer data only, so D80(1) stands | Only if NEW-1 is answered with the typed-address step | WP-12 | The user |

### 5.1 Amendments the network commissioning functions need (added by the integration pass)

U6 and U7 make the functions required and place them in the Core. These five rulings of task 3 stand against that as written; each needs its own decision row, and none is implied by U6, U7 or the design (`masterplan/01_specs.md`, F-4.3 points 1 to 5; the texts are quoted there from task 3's decision file, which this row did not open).

| Entry | Ruling today | What exactly changes | What does not change | When | Blocks | Who rules |
|---|---|---|---|---|---|---|
| AM-4 | D75: "probes and unauthenticated device information only; no authentication attempt, no credential guessing, **no configuration change on any discovered device** (NTP, GOP, profiles, PoE stay class C until the user names a camera and its account)" | The product may change a camera's **network** configuration (`SetNetworkInterfaces`, `SetNetworkDefaultGateway`, `SystemReboot`) as an operator action with an operator-typed credential, and may add a temporary address to its own camera interface | No clock, GOP, profile or PoE setting. No credential guessing. The agent rule of D76 (4): agents never type a real credential and never run this against a real camera | Before WP-19 starts | WP-19, WP-22; with them WP-23, WP-25 | The user |
| AM-5 | D80(1): "a search uses PROBE-ANSWER data only - no follow-up TCP read of device information" | The commissioning scan is ruled a different operation from the search: at the configured factory addresses it may ping, read the neighbour table and make the unauthenticated ONVIF time read over TCP | The camera search (operation 93) stays probe-answer only | Before WP-19 starts | WP-19 | The user |
| AM-6 | D80(10): "typed-address entry is NOT in scope" | Lifted **for commissioning**: the stored factory address list plus one address the operator types | For the search it stays as it is unless NEW-1 and AM-3 say otherwise | Before WP-19 starts | WP-19 | The user |
| AM-7 | D81 with D80(7): "three credential-carrying operations (89, 95, 96)"; the connect flow "holds the operator's credential in memory for the connection test only" | A fourth credential-carrying operation, web console only. **And one choice:** (a) the credential is typed again for adoption (the strict reading of "lifetime = one call"), or (b) it may live for one commissioning job and be handed to the adoption that ends it | The credential is never stored by this operation, never in a log, audit detail, file, argument or environment, never tried from a default list. Storage stays with adoption (operation 96) into the sealed, write-only store | Before WP-22 starts | WP-22 | The user, after row 13 on the credential path (rule DR-8, note SN-4). The design gives no recommendation between (a) and (b) |
| AM-8 | D76 (3): "candidate -> operator action -> credential prompt -> existing write-only credential path (op 89) -> connection test -> only then assignable" | The order gains one step before adoption: set network. To be confirmed as inside "every connectivity action is a separate operator action" | Everything after it: a camera is assignable only after adoption and its connection test | Before WP-22 starts | WP-22 | The user |

**Not arising, by the user's answers.** F-4.3 point 6 (RG-4 with D76 (1): a stored row of a device that is not adopted): not amended, because OQ-1 is answered "not stored" (U11). F-4.3 point 7 (is the passive monitor required): answered "no" by U9. F-4.3 point 8, first half (which role): answered by U10.

**Still open beside the amendments, not a user decision.** F-4.3 point 8, second half: hypothesis H-V, that a lock-out guard keyed by address would count different factory-new cameras on one factory address as one host. The design assigns it to row 13. It blocks no package by name; it is an input to WP-22.

**All five are accepted by U12 A6**, to the extent of the column "What exactly changes". For the choice inside AM-7 the design gives no recommendation, so U12, which accepts recommendations, does not answer it. This register's reading, not a decision: "amended as far as needed" is met most narrowly by (a), the credential typed again for adoption, because (a) adds a fourth operation and changes nothing in "lifetime = one call", while (b) also lengthens the credential's life. The controller may decide it with a log entry after row 13 has rated the credential path (B2), or put it to the user.

Not proposed for amendment: D80(1) and D80(10) for the camera search beyond AM-3; RG-4 and D76 (1) (see above); OD-06, OD-21 and R-4 (touched only by stored-form variant I; OD-06 is added to by variant M); D189 (touched only if hypothesis H-K holds on Linux). Version 1.0 listed D75 and D80(1) here; U6 and U7 moved them to AM-4 and AM-5.

## 5A. Questions of the schema design (added by the integration pass; all answered by U11)

U8 ordered the Core database to be extended for the additional data (`decisions/decisions.md:19`). The schema design put five questions to the user (`masterplan/03_db_schema_extension.md`, section 4.1). The user accepted all five recommendations: "setuju semua saran 1 sampai 5" (U11, `decisions/decisions.md:23`).

| Entry | Question | Recommendation of the schema design | Answer (U11) | What waited, and its state now |
|---|---|---|---|---|
| OQ-1 | Are devices seen on the camera network but not adopted stored (input-av's `devices` table, set E)? | No: scan result in memory; only alias state and audit entries persist | **ANSWERED: not stored.** Set E is not built | The optional part of WP-23 and an amendment of RG-4 with D76 (1): neither is needed. WP-19 keeps the scan result in memory (rule DR-5) |
| OQ-2 | Is the installation acceptance kept as a stored Core record? | Yes, as set C, decided separately from sets A and B | **ANSWERED: yes, as its own set C** | WP-26: no longer gated by a decision. It follows WP-25 in file order |
| OQ-3 | Are gain and A/V offset stored now, or with their function? | With their function (set D, inside WP-18) | **ANSWERED: with their function** | Three columns of set D: they travel with WP-18, which is deferred (U12 A10). Nothing is added to WP-24 |
| OQ-4 | May the Core pick the camera interface automatically when none is set? | No: the technician chooses it once | **ANSWERED: no automatic choice** | WP-19: the commissioning operations answer "not configured" until an interface is chosen. `capture_network_config.interface_name` stays nullable (WP-25) |
| OQ-5 | Three separate schema sets, or one? | Three | **ANSWERED: three sets, three version steps** | WP-24, WP-25, WP-26 stay separate; schema version 6 to 7 to 8 to 9. WP-24 waits for no ruling |

**Two points U11 does not settle, for the controller.**

1. *Which package writes the acceptance record.* Set C gives the record a table (WP-26). No work package of the design builds the function that writes it (accept, revoke, and whether recording is refused without an acceptance): the schema design names WP-20 as "consumer", and WP-20 as specified is "host checks moved into the Core's boot checks and diagnostics" (in scope since U12 A10). The schema design's own order rule is that a set lands before the first package that writes its tables. Until the function is assigned, WP-26 creates a table nothing writes. Extending WP-20 by it, or adding a package, is more than a small matter if it adds a gate that refuses recording; the plan places WP-26 last in phase 10 and leaves the assignment to the controller (plan log item I-11).
2. *Acceptance of the schema design as a document.* WP-24 names "this document accepted" and WP-23 "approval of the schema extension" as blockers. U8 ordered the extension, U11 accepted its five recommendations, and U12 B4 allows the migrations to run on the local demo database set by set with rollback. No row says in so many words that the design is approved; the three together are read here as that approval, for the controller to record.

A finding of the schema design that is not a question for the user, carried to the plan: F-DB-1, for WP-04 (an ONVIF profile token may hold lower-case letters, dots, colons or hyphens, while the Core's profile selector admits the upper-case CODE form only; the schema design resolves it by keeping a Core code in the selector and the ONVIF token in `capture_device_streams`; hypothesis H-DB-1, not verified).

## 6. User actions tied to the hardware acceptance test package

Not design decisions, and not part of the port (`masterplan/01_specs.md:402`). Since U13 none of them blocks the development track: each is a precondition of the hardware acceptance test package (plan, track H), which runs after the user installs the devices.

| Id | What | Why it matters | Precondition of |
|---|---|---|---|
| X-1 | A production signing key (a command that provisions it) | A `REAL_PRODUCTION` Core does not start without it | WP-15 ending in a sealed session |
| X-2 | Operators without the demonstration password (D241) | The same boot refuses the demo password | WP-15 ending in a sealed session |
| UA-1 | A Linux host, Ubuntu 24.04, and access to it | Every real-device check | WP-15 |
| UA-2 | The devices installed: two cameras; an audio interface with two microphone inputs (the choice of soundcard is the user's); a factory-new camera; for one check, two cameras on one factory address | The session from four sources; the commissioning checks | WP-15 |
| UA-3 | Installation of the privileged alias helper with `sudo`, after the security review (U12 B5) | The alias, scan and set-IP checks | WP-15 |
| UA-4 | Typing the camera passwords in the web console; never an agent (D76) | Connection test, set camera IP | WP-15 |
| UA-5 | A person at the bench | Physical steps: unplugging a cable, the clap for the sync check, plugging in a camera | WP-15 |
| UA-6 | Guarding `apps/input-av/data/` (WP-21) | No writer for the legacy data | Any start of an input-av program from this tree, in any task |

## 7. Assumptions, gaps, and what was not verified

- Every recommendation is the design's (row 8). This row re-states and orders them; it adds none.
- Texts of D82, D86 and D80 are taken from rows 5 and 8. Who originally decided D82 and D80 was not established by this row; the proposed decision maker for each amendment is the user because D75 and D76, which they implement, are the user's rulings (`research/02_collection_rulings.md:62`).
- The full text of SEC35-40 was not read by row 8 (`masterplan/01_specs.md:445`); whether SA-1 to SA-3 answer it is row 13's finding, not a statement of this register.
- Sizes (S, M, L) are the design's estimates from scope. A time estimate now exists as the controller's row P8 (`decisions/decisions.md:22`), "estimate, not a commitment"; it is carried per phase in `masterplan/02_plan.md`, section 21, and is not repeated here.
- Gap of version 1.0, closed: the transition rule for the existing bench installation of input-av (note under Q2) is answered by U12 B7: for tests only, not real examinations, until the Core can record.
- Integration pass: U12 accepts "all recommendations of groups A and B (controller's list in the conversation)". That list is not a file of the task folder; this register relies on its summary in `decisions/decisions.md:24`. P3 is not among A1 to A10 by name, which is why its confirmation is listed as remaining.
- Integration pass: the texts of D75, D80(1), D80(10), D81, D80(7) and D76 (3) in section 5.1 are taken from `masterplan/01_specs.md`, F-4.3; task 3's decision file was not opened. Who originally decided D81 was not established; the user is proposed as decision maker for the same reason as for D80.
- Integration pass: for the choice inside AM-7 no recommendation exists; the preference for (a) in section 5.1 is this register's reading of A6.
- Integration pass: the two points under section 5A (the writer of the acceptance record; approval of the schema design as a document) are gaps, not decisions of this register.
- Line references into `masterplan/01_specs.md` in sections 2 to 6 that were written by version 1.0 point into the file before Amendment 1 and may be off by the lines the amendment inserted. They were not re-numbered in this pass.

## 8. Verification cells of row 9, checked

| Criterion (`identification/02_structured.md:145`) | Result | Where |
|---|---|---|
| Four answered entries, each citing its row in `decisions/decisions.md` | 4 of 4: Q1, Q2 (U1 line 7, P4 line 10); Q4, Q5 (U2 line 8, P3 line 9) | section 2 |
| Six open entries, each with at least two options and one recommendation | 7, not 6: Q8, Q3, Q6, Q7, Q9, Q10 and NEW-1; each has two or more options and one recommendation. The deviation from six is stated at the top | section 3 |
| Every blocked WP exists in step 8 | WP-03, 05, 07, 08, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21 all appear in `masterplan/01_specs.md:374-396` | section 1 |
| Indonesian wording of each open question | present per entry; summary table at the top | sections 3, 4 |
| P3 confirmation request | one line plus five departures and three wording notes | section 2.3 |

The table above is the check of version 1.0 and is left as written. Its third line named WP-19 among the blocked packages of Q10; that is superseded by section 9.

## 9. Integration pass, checked (version 1.1)

| Required change | Result | Where |
|---|---|---|
| Q10 answered in parts: scan, alias, set camera IP required and in the Core (U6, U7); passive monitor not required (U9); TECHNICIAN only (U10); then host checks into the Core and gain deferred (U12 A10) | 5 of 5 parts answered | section 3, Q10; section 1 |
| Task-3 rulings the network functions need amended, each its own entry with what changes and who rules | 5 entries, AM-4 to AM-8: D75, D80(1), D80(10), D81 with D80(7), D76 (3); all accepted by U12 A6; 1 choice inside AM-7 remains | section 5.1 |
| OQ-1 to OQ-5 as entries with question, recommendation, what waits | 5 entries, all answered by U11 | section 5A |
| Every entry answered by U12 marked ANSWERED with its U-row | Q8 (A1), Q7 (A2), F-1 (A3), F-2 (A4), Q9 (A5), AM-1 to AM-8 (A6), NEW-1 (A7), Q6 (A8), Q3 (A9), Q10-d and Q10-e (A10): 10 groups, 18 items | sections 1, 3, 4, 5, 5.1 |
| Indonesian head: a short list of what is decided plus the few remaining items | 31 decided lines; remaining: 3 small items, 2 pending outcomes, 7 user actions tied to the hardware test package, 1 later ruling | head |
| Counts in the text | 16 answered entries, 0 open, 2 forks ruled, 8 amendments accepted, 2 external items now user actions (with 6 further user actions UA-1 to UA-6) | sections 0, 6 |
| Every remaining item names work packages that exist | 3 small items and 2 pending outcomes; packages named: WP-03, 04, 06, 07, 08 (P3); WP-22 (AM-7 choice); WP-20, WP-26 (acceptance writer); WP-03, 13, 19, 22 (security review); WP-10 (E-8), WP-11 (E-10): 11 distinct numbers. Every package number named anywhere in the register lies inside the set of 27 (WP-01 to WP-23 of `masterplan/01_specs.md` section 9; WP-24 to WP-26 of `masterplan/03_db_schema_extension.md` section 3.2; WP-27 of `masterplan/02_plan.md`). 0 names outside the set | section 1; head |

---
*Generated: 2026-10-12 (clock time not available to this agent)*
*Last updated: 2026-10-12, integration pass (U4 to U11, Amendment 1, schema design)*
*Version: 1.1*
