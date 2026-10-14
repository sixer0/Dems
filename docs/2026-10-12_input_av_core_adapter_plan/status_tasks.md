# Status

| Waktu | Fase | Status |
|---|---|---|
| 2026-10-12 | A.2 folder dibuat | selesai |
| 2026-10-12 | A.3 request-translator | berjalan |
| 2026-10-12 | A.3 request-translator | selesai: REQUEST_TRANSLATED, 7 pertanyaan terbuka (Q1-Q7) |
| 2026-10-12 | A.4 task-architect | selesai: 13 baris, 6 gelombang |
| 2026-10-12 | A.4a PRE-HIL V1-V12 | PASS (gateway_check/01_gate_report.md) |
| 2026-10-12 | A.5 BLUEPRINT_APPROVAL | MENUNGGU PENGGUNA |
| 2026-10-12 | A.5 | DISETUJUI dengan perubahan (U1, U2): dipersempit ke porting; task-architect merevisi blueprint |
| 2026-10-12 | A.4a PRE-HIL (revisi 2) | PASS: 13 baris, 7 kolom; profil 13 baris, 8 kolom; jalur keluaran berbeda semua |
| 2026-10-12 | B.7 env check | selesai (initialization/01_env_check.md) |
| 2026-10-12 | B.8 gelombang 1 (baris 1-5) | BERJALAN paralel: 1 explore/opus, 2 explore/sonnet, 3 data-collector/sonnet, 4 database-specialist/sonnet, 5 data-collector/sonnet |
| 2026-10-12 | B.8 gelombang 1 | SELESAI (5/5), gate lolos |
| 2026-10-12 | B.8 gelombang 2 (baris 6, 7) | BERJALAN |
| 2026-10-12 | B.8 gelombang 2 | SELESAI (2/2), gate lolos |
| 2026-10-12 | gelombang 3 (baris 8, desain port) | BERJALAN |
| 2026-10-12 | gelombang 3 (baris 8) | SELESAI: masterplan/01_specs.md, 21 WP, 8 fork |
| 2026-10-12 | gelombang 4-5 (baris 9, 10) | BERJALAN (pm-planner, berurutan) |
| 2026-10-12 | U4: eksperimen H.265 (WP-01) di Mac ini | BERJALAN (coder-execution), hasil ke test/01_hevc_experiment.md |
| 2026-10-12 | gelombang 4-5 (baris 9, 10) | SELESAI: register keputusan + rencana 10 fase |
| 2026-10-12 | gelombang 6 (verifikasi) | MENUNGGU hasil eksperimen H.265 |
| 2026-10-12 | U6: alat jaringan (alias sementara, scan IP pabrik, set IP) WAJIB ada | amandemen desain F-4/Q10 BERJALAN |
| 2026-10-12 | U7 (fungsi jaringan masuk Core), U8 (skema DB Core diperluas) | amandemen desain diarahkan; baris baru 8b: desain perluasan skema (database-specialist) BERJALAN |
| 2026-10-12 | U9 (scan aktif saja), U10 (hanya Technician) | dicatat; masuk ke penyesuaian register + rencana |
| 2026-10-12 | amandemen 1 + desain skema (8b) | SELESAI |
| 2026-10-12 | penyesuaian register + rencana (pm-planner) | BERJALAN |
| 2026-10-12 | U11: OQ-1..OQ-5 dijawab sesuai saran | dicatat; diteruskan ke penyesuaian register + rencana |
| 2026-10-12 | U12 (semua saran A, B disetujui), U13 (tanpa hardware; paket uji hardware terpisah) | dicatat; rencana disesuaikan; implementasi dilepas setelah verifikasi rencana lolos (P9) |
| 2026-10-12 21:20 | U14: otonom penuh dari verifikasi sampai implementasi | dicatat; menunggu penyesuaian register+rencana selesai, lalu gelombang verifikasi |
| 2026-10-12 21:30 | penyesuaian register + rencana | SELESAI (v1.1, 27 WP, 0 entri terbuka) |
| 2026-10-12 21:30 | gelombang 6: verifikasi (baris 11, 12, 13) | BERJALAN paralel |
| 2026-10-12 | baris 11 verifier | SELESAI: PASS WITH FINDINGS (F-01..F-12, tidak ada yang memblokir); C7-C10 dicatat |
| 2026-10-12 | baris 13 security-review | SELESAI: CAUTION (0 FAIL, 17 CAUTION); relay DITERIMA bersyarat RC-1..6; C11, C12 dicatat |
| 2026-10-12 | baris 12 senior-code-reviewer | SELESAI: SOUND WITH CHANGE; 2 celah desain memblokir (P12-B1, P12-B2) -> adendum desain |
| 2026-10-12 | D: verifikasi rencana | SELESAI (PASS WITH FINDINGS / SOUND WITH CHANGE / CAUTION) |
| 2026-10-12 | adendum desain + persiapan git | BERJALAN |
| 2026-10-12 | adendum desain (P12-B1/B2, F03, F05, F10/11, pemecahan paket) | SELESAI; cek keamanan adendum + blueprint implementasi BERJALAN paralel |
| 2026-10-12 | git: branch task4/input-av-core-port, pengecualian lokal apps/input-av/ | SELESAI (belum ada commit) |
| 2026-10-12 | cek keamanan adendum | SELESAI: CAUTION, 0 FAIL; AD-01..AD-14 dilampirkan ke blueprint implementasi (sedang ditulis) |
| 2026-10-12 22:30 | B.9 blueprint implementasi | DIVALIDASI: 160 baris, 19 gelombang; C16 |
| 2026-10-12 22:30 | C: batch 1 (baris 2, 3, 4, 13, 20, 27, 87, 95, 103, 147, 160) | BERJALAN |
| 2026-10-12 22:32 | batch 1 | selesai sejauh ini: 2, 4, 13, 20, 160; berjalan: 3, 27, 87+103, 95, 147 |
| 2026-10-12 22:32 | batch 2 (baris 19, 38, 52) | BERJALAN |
| 2026-10-12 22:55 | batch 1+2 | selesai: 2, 3, 4, 13, 20, 27, 38, 95, 147, 160; berjalan: 19, 52, 87+103; penyesuaian baris WP-13a oleh task-architect BERJALAN |
| 2026-10-12 23:15 | batch 1+2 | 14 baris selesai/landed; operan integrasi I-1 BERJALAN; baris kode lain ditahan sampai I-1 selesai |
| 2026-10-12 22:49 | blueprint dipotong ulang untuk WP-13a | 173 baris; C21. Uji penuh sebelum commit BERJALAN; baris 76 (dokumen) BERJALAN |
| 2026-10-12 23:10 | commit 7969f0fa (fase kontrak + kosakata) | SELESAI; batch 3 (5, 6, 17, 24, 26, 63, 104, 109, 124, 161) BERJALAN |
| 2026-10-12 23:21 | batch 3 | selesai: 5, 24, 109, 124; berjalan: 6, 17, 26, 63, 104, 161 |
| 2026-10-12 23:24 | baris 161 (daftar nama WP-13a), 26 | SELESAI; C24, C25. Berjalan: 6, 17, 63, 104 |
| 2026-10-12 23:26 | baris 6 (E-11) | SELESAI: jalur salah DITERIMA 18/18 -> cabang A tidak tersedia; baris 7 (probe) BERJALAN |
| 2026-10-12 23:43 | baris 7 (E-11b) | SELESAI: jalur terbaca hanya lewat teks log pustaka; C26 (bacaan fail-closed -> cabang B) menunggu cek keamanan; baris 8 (gerbang RC-1) BERJALAN |
| 2026-10-12 23:44 | koreksi baris di atas | baris 8 BELUM diluncurkan; yang berjalan adalah cek keamanan atas bacaan C26 (verification/05_security_branch_b.md). Baris 8 menyusul setelah putusannya |
| 2026-10-12 23:47 | baris 63 | landed (99 operasi); sisa -> I-2 setelah baris 17. Berjalan: 17, cek keamanan cabang B |
| 2026-10-12 23:50 | cek keamanan cabang B | ACCEPT bersyarat (BR-01..BR-12); C27: cabang B dipilih, sementara sampai baris 141. Baris 8 (gerbang) + pelampiran BR ke blueprint BERJALAN |
| 2026-10-12 23:54 | baris 8 (gerbang RC-1) | LULUS: cabang B, sementara sampai baris 141; C28 |
| 2026-10-12 23:55 | baris 17 (skema set A) | landed: skema versi 7, 45 tabel; C29. I-2 BERJALAN |
| 2026-10-13 00:09 | blueprint: cabang B dilampirkan | 179 baris, 87 persyaratan terlacak; C30. I-2 masih berjalan |
| 2026-10-13 00:16 | I-2 | landed, semua pemeriksaan hijau; C31. Uji penuh c02 BERJALAN, lalu commit kedua |
| 2026-10-13 00:35 | commit b7ed4c60; uji penuh c02 hijau | batch 4 (11, 21, 28, 45, 58, 77, 94, 125, 126, 166, 174) BERJALAN; C32 (penyimpangan commit set A dicatat) |
| 2026-10-13 00:49 | batch 4 | selesai: 11, 77, 166, 174; berjalan: 21, 28, 45, 58, 94, 125+126 |
| 2026-10-13 00:53 | baris 21 | SELESAI; temuan kill(0) -> baris 180 baru. Berjalan: 28, 45, 58, 94, 125+126 |
| 2026-10-13 00:53 | baris 58 (gerbang worker), 94 | SELESAI; batch 4b (176, 180, 64) BERJALAN; masih berjalan: 28, 45, 125+126 |
| 2026-10-13 00:54 | baris 45 | SELESAI. Berjalan: 28, 64, 125+126, 176, 180 |
| 2026-10-13 00:55 | baris 125, 126 | SELESAI; cacat prosedur -> baris 181. Berjalan: 28, 64, 176, 180 |
| 2026-10-13 00:56 | baris 28 | SELESAI (satu seam, 9 pembaca berpemilik); batch 5 (47, 54, 55, 127, 128, 129, 144, 164) BERJALAN bersama 64, 176, 180 |
| 2026-10-13 01:03 | baris 180, 54, 55 | landed (55: sisa -> I-3). Berjalan: 47, 64, 127, 128+129, 164+144, 176 |
| 2026-10-13 01:04 | baris 176 (BR-05) | SELESAI; 175+177 dan 39 BERJALAN. Juga berjalan: 47, 64, 127, 128+129, 164+144 |
| 2026-10-13 01:15 | baris 47, 64, 127 | landed (47: sisa -> I-3). Berjalan: 39, 128+129, 164+144, 175+177 |
| 2026-10-13 01:15 | baris 164, 144 | SELESAI; I-3 BERJALAN bersama 39, 128+129, 175+177 |
| 2026-10-13 01:19 | baris 39 (kamera uji) | SELESAI; C33. Berjalan: I-3, 128+129, 175+177 |
| 2026-10-13 01:27 | baris 175, 177 | landed; sisa -> I-4 dan baris 182 baru. Berjalan: I-3, 128+129 |
| 2026-10-13 01:34 | I-3 | landed; I-4 BERJALAN; juga berjalan: 128+129 |
| 2026-10-13 01:37 | I-4 | SELESAI; uji penuh c03 BERJALAN; juga berjalan: 128+129 |
| 2026-10-13 01:53 | uji penuh c03 | 3 gagal (masing-masing diatribusikan); I-5 (perbaikan) BERJALAN; 128+129 masih berjalan |
| 2026-10-13 01:58 | commit 6e6707dd | batch 6 (10 agen, 20 baris) BERJALAN; 128+129 masih berjalan |
| 2026-10-13 02:18 | baris 65, 66 | SELESAI. Batch 6 berjalan: A, B, C, D, E, F, G, I, J; juga 128+129 |
| 2026-10-13 02:24 | baris 40 | SELESAI; temuan Basic disiarkan ke agen relay. Berjalan: A, B, C, D, E, G, I, J; 128+129 |
| 2026-10-13 02:27 | baris 179 | SELESAI; baris 48 dikembalikan untuk C34/C35. Berjalan: A, B, C, D, E, G(48), I, J; 128+129 |
| 2026-10-13 02:28 | baris 150, 145, 155 | SELESAI. Berjalan: A, B, C, E, G(48), I, J; 128+129 |
| 2026-10-13 02:32 | baris 31, 167, 168, 70 | landed (70: perlu baris 185 - registrar MIC). Berjalan: A, C, E, G(48), J; 128+129 |
| 2026-10-13 02:34 | baris 162, 163, 165 | SELESAI; C36. Baris 29 BERJALAN. Juga berjalan: C, E, G(48), J; 128+129 |
| 2026-10-13 02:35 | baris 48 | SELESAI (antarmuka); C37. Berjalan: 29, C, E, J; 128+129 |
| 2026-10-13 02:50 | baris 41 (relay) | landed sebagai KANDIDAT; C38: keputusan pengguna diperlukan (klien RTSP buatan sendiri vs pustaka). Tinjauan keamanan+kode atas klien itu BERJALAN |
| 2026-10-13 02:51 | baris 29, 32, 169, 170, 171 | SELESAI. Berjalan: J (eksperimen), 128+129, tinjauan keamanan klien relay |
| 2026-10-13 02:58 | tinjauan keamanan klien relay | (a) DAPAT DITERIMA DENGAN PERBAIKAN (2 High); C39: baris 186 (pengerasan + fuzz) diluncurkan sambil menunggu keputusan pengguna |
| 2026-10-13 04:47 | baris 186 | SELESAI (fuzz menemukan 1 crash, diperbaiki). I-6 dan baris 182 BERJALAN; 128+129 dan J masih hidup (menunggu kunci tadi) |
| 2026-10-13 05:06 | I-6 | SELESAI, tanpa merah tersisa. Berjalan: 182, 128+129, J |
| 2026-10-13 05:13 | baris 182 | SELESAI; C40. Uji penuh c04 BERJALAN. Masih berjalan: 128+129, J |
| 2026-10-13 05:31 | uji penuh c04 HIJAU; commit 3b388746 | baris 10, 22 SELESAI. Berjalan: 128+129. Berikutnya: penyegaran blueprint + batch 7 |
| 2026-10-13 05:32 | batch 7 (8 agen, 15 baris) + penyegaran blueprint | BERJALAN; 128+129 masih berjalan |
| 2026-10-13 05:35 | baris 128, 129 | SELESAI. Batch 7 berjalan (W, Y, Z, S, B, R/T/X) + penyegaran blueprint |
| 2026-10-13 05:48 | baris 80 | SELESAI (belum disambungkan; baris 81). Batch 7 berjalan: W, Y, Z, S, R/T/X, penyegaran blueprint |
| 2026-10-13 05:50 | penyegaran blueprint | 189 baris: selesai 79, berjalan 14, terbuka 94; C41. Koreksi: batch 7 = 14 baris |
| 2026-10-13 05:57 | baris 71, 30, 158 | SELESAI. Batch 7 berjalan: W, Y, Z, R/T/X |
| 2026-10-13 05:57 | baris 67 | SELESAI (tiruan); temuan -> baris 192 (serial/port kartu belum tersimpan). Batch 7 berjalan: W, Y, R/T/X |
| 2026-10-13 06:12 | baris 46 (adapter kamera produksi) | SELESAI pada tiruan: rantai kamera uji -> relay -> worker terbukti. Batch 7 berjalan: W, R/T/X |
| 2026-10-13 08:29 | gangguan jaringan | agen W dan R/T/X terputus (API tak terjangkau); keduanya DILANJUTKAN. Selesai di disk: 23, 97, 149, 156, 172; sisa: 42, 142, 152 |
| 2026-10-13 08:39 | baris 172, 149, 152 | SELESAI (paket slot kosong DITUTUP); 97, 156 perlu baris lanjutan. Menunggu agen W (42, 142) |
| 2026-10-13 08:39 | U15: cabut aturan izin merekam; perangkat terpasang; paralel penuh | P10 dicatat; batch 8 lebar disiapkan; pertanyaan ke pengguna |
| 2026-10-13 08:40 | batch 8 (12 agen, 20 baris) | BERJALAN dengan lebar penuh (U15); agen W masih berjalan |
| 2026-10-13 08:48 | U16-U19 (jawaban pengguna) | perangkat di Mac ini; klien relay (a); agen boleh cari + tes koneksi; X-1/X-2 dibangun di task ini. Desain X-1/X-2 BERJALAN |
| 2026-10-13 08:59 | desain X-1/X-2 | SELESAI (perlu tinjauan); tinjauan keamanan desain BERJALAN; C42 |
| 2026-10-13 09:05 | baris 72, 98, 78, 135 | landed. KONTAK PERTAMA LINUX: worker tidak terkompilasi di Ubuntu (L-1..L-5) -> baris 193 |
| 2026-10-13 09:05 | baris 33, 185, 190 | landed; C43. Batch 8 berjalan: W2, SC, T2, K/P/N, D, E, H; tinjauan keamanan X-1/X-2 |
| 2026-10-13 09:08 | tinjauan keamanan desain X-1/X-2 | CAUTION, 0 FAIL (SX-01..SX-20); C44. Perancang memotong baris M11 (X-1/X-2), 193, pengalamatan ulang, M12 (perangkat asli) |
| 2026-10-13 09:10 | baris 12 (E-8 pemutaran) | sesi HEVC tersegel dan terverifikasi; web memutar; tablet BELUM dijalankan. Baris 14 (putusan) BERJALAN |
| 2026-10-13 09:15 | baris 14 (putusan WP-01) | SELESAI; C45: 56 dilewati, 57 menunggu tablet, 34 dilewati bersyarat. Agen relay diberi tahu soal bukti gerbang keyframe |
| 2026-10-13 09:33 | baris 49, 110, 96 | landed (49, 96 perlu baris lanjutan kecil). Berjalan: W2, T2, K/P/N, D, H, perancang |
| 2026-10-13 09:33 | baris 68, 187 | SELESAI; 81, 188 perlu lanjutan; C46. Berjalan: W2, T2, D, H, perancang |
| 2026-10-13 09:34 | blueprint diperluas | 233 baris: selesai 98, berjalan 16, terbuka 117; C47 |
| 2026-10-13 09:41 | baris 25, 69, 184 | SELESAI. Temuan: audio hilang 9,5 dtk setelah worker dinyalakan ulang (baris 191 jalan); segel sesi terinterupsi gagal 3 dari 4 (perlu diagnosis). Berjalan: W2, T2, D |
| 2026-10-13 09:45 | baris 50, 51 | SELESAI (codec dibaca dari stream: ONVIF H264 + stream HEVC -> REACHABLE HEVC); 53 perlu lanjutan. Berjalan: W2, D |
| 2026-10-13 09:46 | baris 99, 192, 100 (skema set B, versi 8) | landed. I-7 BERJALAN. Masih berjalan: W2 (relay) |
| 2026-10-13 10:04 | baris 43, 153, 178 | SELESAI (gerbang keyframe terbukti dengan kontrol negatif). Baris 193 (worker di Linux) BERJALAN; I-7 berjalan |
| 2026-10-13 10:10 | I-7 | landed; bahaya batas klon database -> I-7b BERJALAN. Baris 193 berjalan |
| 2026-10-13 10:16 | I-7b | SELESAI (puncak klon 7, tadinya >= 99). Uji penuh c05 BERJALAN; baris 35 (tinjauan kode fase 2) dan 181 (perapian prosedur) berjalan; baris 193 berjalan |
| 2026-10-13 10:24 | baris 35 (tinjauan kode fase 2) | LULUS dengan 8 tindak lanjut, 0 memblokir; ketujuh tempat suntingan skrip bersih; C48 |
| 2026-10-13 10:37 | uji penuh c05 HIJAU; commit b60a9fa3 (skema set B) + 0f5d2a8e (batch 7-8) | 7 commit di branch. Berikutnya: Core untuk kamera asli (baris 232) + batch 9 |
| 2026-10-13 10:37 | batch 9 (14 agen, 26 baris) | BERJALAN, termasuk baris 232 (Core untuk kamera asli pengguna) |

## STATE AT THE PAUSE OF 2026-10-13 (decision U27) - resume from here

**Paused by the user after the checkpoint commit. Nothing is launched until the user says continue.**

### Where the code is
- Branch `task4/input-av-core-port`, no push. Last verified commit: 0f5d2a8e (suite run c05 green). After it: the CHECKPOINT commits of this pause (light checks only - typecheck, static sets, lint; hashes in implementation/checkpoint_commit_c06_pending.md when that agent lands). The full suite c06 is POSTPONED to the end of development (U26).
- Schema [13,'dbc-14'], 30 migration files; never migrated on the demo or lane databases (C29). Contract: 110 operations, 83 audit types, 51 actions.
- Baselines: boot/checks.ts 90b3a1e6, boot/index.ts 63fe763e; helper `dems-core-netalias` SHA-256 1e758a24...c7d015b1.
- Left uncommitted on purpose: masterplan/06_design_macos_microphone.md (M1c mid-edit at the pause) and the commit's own record.

### Decisions to re-read first
decisions/decisions.md U15-U27 and C88-C111; delegation_progress/file_ownership.md from "Batch 9" to the end (every landing, ruling and open item).

### What is next, in lanes (none started)
- A (critical, serial): ONE targeted worker verification (`make`, `make e2e`, fixtures) WITH the kill matrix (ports 8554/8556 - check the user's lanes and instance first) -> row 86 (security review before the lift; items put to it by name: SR-10/11/12 confirmed by 119 - re-state; N-01; the profile-CHECK limit of C61; `/dev/urandom`; `ps eww` blind spot; the firewall-table design question of C103; row 87's contradictions) -> record AM-1 -> row 88 (the lift; tick lists: decisions/087_lift_texts.md section 1.3 and 060d's seven lift items) -> 89, 90 (incl. a dropped camera leg with the BUILT relay, sealed) -> 91 -> 92.
- G (preconditions of row 88): W5 (web + tablet: assign a production camera WITH a stored profile - Q-02; a faulted track is not "Live" - Q-01), the Core's bitrate writer (the simulator's literal 9 in real capture), T4 (four tests that still survive a mutation, worst onvif-session.test.ts:395).
- B: macOS production microphone path (U22-U25): design revision 3 (M1c) -> build rows per its work-package table; gates SM-02, SM-04, SM-14, SM-16, SM-29, SM-30, SM-33, SM-36; SR-15; no worker C edit before lane A's first step; BR-11 again after it. Measured facts: test/mm*, mm2*, mm3* (about 90.3% of samples; one helper, two outputs behind dropping FIFOs).
- C: documents - README row 218 (+ keys DEMS_CAPTURE_ALIAS_SOCKET, DEMS_CAPTURE_AUDIO_HELPER; reserved ids; production on Linux + this Mac; what a Mac does not check; limit 7; rotation; the receiver's marks list), installer note (helper all-or-none; restart after rotation; retired keys kept; transcriber config; the 4b-2/4b-3 refusals), hardware chapters (helper hash 1e758a24 at HW-ACCEPTANCE-4:151,185,489; HI order no longer forced; criterion 6 of 9A/H-16 as a stated limit; new refusals; ONVIF reply caps; the acceptance step list), collectors' names (incl. -ch_layout).
- D: row 184 diagnosis (seal WRITE_FAILED on an INTERRUPTED session - never reproduced since).
- E (read-only): 60e (fifth pass: product diffs of R1, R2, B2, V6, V6b; discovery product files; live source; tablet selector), M10 code review, gates M5 / M10 / M11 / M3 (M3 closes with the final suite).
- F: tablet HEVC measurement (controller's own device session, U20 (2)); decides `hvc1` (row 57).
- Small rows queued: demo reset kept tables; the alias journal's NOT_MARKED close (design point); SR-13 the scan's device count (before a real installation); a Core-held lock for "Core stopped" (before real examinations); stale "C49 (2)" comments; one shared stream-facts decoder.
- LAST: the one full suite (kill matrix, DEMS_REQUIRE_RECORDED_FILES=1, DEMS_SEAL_E2E=1), closing gates, final commits, report, memory.

### Waiting for the user (non-blocking)
- A small own reader for ONE counting-only 60 s measurement of the audio interface (reviewer's recommendation, C110) - yes / no.
- Dual-lens cameras as one device on both tracks - in scope or not.
- Who runs the first real recording on this Mac (U24 allows agents; the camera password is typed by the user).

### Left running
- The user's instance for real cameras: Core 127.0.0.1:4423 (REAL_DEVELOPMENT, database dems_test_m12_row232, export of 0f5d2a8e - it does NOT have the fix of the event-loop stall B-01), web console 127.0.0.1:5178. Stop: `sh .cache/task4-row232/stop.sh`. Do not run `scripts/lane/lane.sh stop 3` by accident.

### Added after the pause was written (same day)
- Checkpoint commits exist: f20c9b39 (schema steps 9-13, 59 files), 1fbeada7 (everything else, 679 files). Scan baselines at 1fbeada7 are in delegation_progress/file_ownership.md.
- M1c landed: the macOS microphone design is revision 3 (uncommitted); 18 work packages; five points of the addendum not buildable as worded must be ruled before lane B starts (file_ownership.md, last update).
- NOTHING IS IN FLIGHT.

---

## STATE AT THE PAUSE OF 2026-10-14 (user's word: "tutup dulu ... usage limit hampir habis ... catat temuan yang belum terselesaikan")

Commits today (branch task4/input-av-core-port, NO push): cb06d42c (checkpoint, C144), d9df31ac (THE CLASS-C LIFT, AM-1 in force, C152), and the WIP commit made at this pause (C155 - read it before resuming). Decisions C120-C155 in `decisions/decisions.md`; landings in `delegation_progress/file_ownership.md`.

### Landed and complete (in the WIP commit, not yet in a clean commit)
- N10 (C154): registry by platform; `MACOS_MICROPHONE_OPENER_ADMITTED = false`; C-1 of 088b; pipe keeper; macOS loss watch (said, not sealed).
- MH1 (C153): REAL DEFECT fixed - the leftover check read only 64 KiB of the process list. OWED: one run of `mic-helper.generated.test.ts` under the heavy lock; a sweep for the same 64 KiB cut in other process checks.

### STOPPED MID-WORK at the pause (half-done edits are IN the WIP commit; resume each by re-launching its row with its brief)
- RD1 (schema v15 / dbc-16 for device retirement: migrations 0032/0033, set16 test, version pins 14 -> 15 across Core tests). State: files written; checks NOT finished (it was waiting on the heavy lock). Re-run its checks first.
- RD2 (operation 111 `retireCaptureDevice` contract: packages/shared, `core/audit-details.ts`, new `api/capture-retire.ts`, OpenAPI). State: was fixing two lint warnings; checks NOT finished; owed: `credential.test.ts:471` pin for `CAPTURE_DEVICE_RETIRED.credentialDestroyed` (request 585).
- Row 89 (first full session on doubles, AD-08; + C-2 door refusals, C-8 entry file): test files under `modules/capture-config/__tests__/e2e/` and `test/support/{entry-start/,production-key.ts}` partly written; NOT run.
- I-9f (C154): loss-watch report sink in `capture-composition.ts` (request 584) + stale control `audio-cards/__tests__/routes.db.test.ts:564` (request 582): partly applied; NOT verified.
- Run B+ (worker series + kill matrix on the v5 binaries): stopped at step 1 (hashes matched N13's). NOT PROVEN: BR-11 on the new worker.

The WIP commit may NOT typecheck or pass tests (rows above are mid-edit). The first act on resume: Core / shared / web / mobile typecheck and the static sets, attributed to the rows above.

### Open findings, not yet resolved (each with its routing)
1. Device retirement (C146, C147): the refusal sentences tell the operator to "adopt the camera again", which has NO path until op 111 (RD1-RD6) lands. RD3 (Core op), RD4a/RD4b (cameras / microphones skip retired - ALSO caution C-4 of 088b: a HARD precondition before op 111 can retire anything), RD5 (web + tablet), RD6 (security review) not started.
2. Gate cautions 088b (C151): C-2 -> row 89; C-3 (no end event when the engine returns IGNORED with nothing durable - hypothesis) -> row 90; C-5 stale comments / fence imports the production mic module directly -> tidy 134-135; C-6 RULE: no agent boots REAL_PRODUCTION on the user's data or cameras without the user's word.
3. Review 086 (C127): C-2 (tokens / lens not compared; the open does not compare the stream with its stored row) -> row S86b before gate M6 with row 90; C-5 (no camera identity check at open) -> hardening row before M6 + hardware chapter; C-11 (firewall table state) -> document row + a build row before the first Linux installation; F-2 rescope of task-3 check `M7-SEC-SRC-2` -> gate 92 / document row.
4. macOS microphone path: N11 (Core reads the v5 records; supervisor record subject - request 545; the four loss-watch codes; the not-confirmed interval sealed - 583; 554), N12 (seal; + C124 remainder: the media zero is `session_audio_intervals.from_at` of the START row - state `mediaZeroAt + media end`, keep the clamp - request 546), N17 (verdict lines / export), N14 (session on doubles), M2b gates + security acceptance (then flip `MACOS_MICROPHONE_OPENER_ADMITTED`), N15 (the user's USB interface - MUST be set to 48 kHz by the user; it read 96 kHz on 2026-10-14), N16 (docs). Finding to carry: gapped samples displaced 26.9-38.9 ms EARLY vs a +/-40 ms bound (1.1 ms margin, C145) - a finding for M2b, not a pass.
5. Rows after the lift: 148 (loopback production row, AD-02 (3)), 90 (session scenarios + C-3), row 57 tablet HEVC measurement, M3 / M5 / M10 / M11 gates.
6. F-V7-1 (C126): OD-22 (PoE cycle only for a LOST camera) is enforced nowhere; operation 48 is a plain restart; input-av has no PoE control - OPEN ITEM FOR THE USER in the final report.
7. Tidy (134-135): four Core copies of the interface-name pattern stay equal text (pins refuse the import: host-alias tests, `boot/program-checks.ts`); text 4 of 087 into addendum 1.6 #3 (E-A12) - N16; `onvif-rtsp.ts` retired and unimported, NOT deleted (deletion only on the user's word); README test totals "to be refreshed after the final full suite".
8. Not re-run since their files' neighbours changed: camera-network and factory-scan loopback test files (sandbox EPERM; C141) -> final full suite.
9. Final: full suite (kill matrix, `DEMS_REQUIRE_RECORDED_FILES=1`, `DEMS_SEAL_E2E=1`), closing gates, clean final commits (the WIP commit's rows re-verified), report, memory.

### Waiting on the user
- Set the USB audio interface to 48 kHz before N15.
- `ffprobe-export.txt` at the repo root (2026-10-13, origin unknown): yours? Left untouched, not committed.
- Push: nothing has been pushed; push only on the user's word.
- The user's own first real run (assign / save cam 1 / 2): a Core started from a commit holding d9df31ac + W6, re-adopt the cameras, type the camera password in the console, "Test connection", then assign. No agent does this (C151 C-6).
