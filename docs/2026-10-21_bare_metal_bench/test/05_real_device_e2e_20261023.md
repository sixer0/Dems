# Uji dan penjurian alur penuh session record DEMS di .73 dengan perangkat nyata — 2026-10-23

Host: gsp-dems@192.168.0.73 (Ubuntu 24.04, Core REAL_PRODUCTION, /opt/dems/core). Konsol dioperasikan dari PC .72 lewat tunnel SSH 127.0.0.1:5173. Operator: andi.pratama (OPR-002, SUPERVISOR). Keputusan: D47-D50 di decisions/decisions.md.

Perangkat: kamera ONVIF TC-C320N CAM-03 (192.168.100.101) dan CAM-04 (192.168.100.103) di enp4s0; receiver USB HANMUS BOMGE (3347:2430, kartu 1, 4 input) dengan 2 mic nirkabel di input 1 dan 2.

## Ringkasan

Alur penuh LULUS dengan perangkat nyata setelah empat perbaikan kode (C1-C4): precheck, rekam 99 detik dari 2 kamera + mic PRIMARY, stop, segel bertanda tangan Ed25519, verifikasi, ekspor. Transkrip TIDAK teruji karena STT dimatikan di konfigurasi. Pratinjau kamera tidak tersedia di build ini (desain OD-12).

## Penjurian per langkah

| # | Langkah | Hasil | Bukti |
|---|---|---|---|
| 1 | Jangkauan kamera | LULUS | ping/554/80 OK ke .101/.102/.103/.117; uji koneksi adopsi REACHABLE (AUD-000128..136) |
| 2 | Kamera "unreachable" (laporan awal) | GAGAL -> DIPERBAIKI (C1) | AUD-000140/141 UNREACHABLE 6 ms setelah pencarian; sebab onvif-relay.ts:764 + probe.ts:86 |
| 3 | Pendaftaran 2 mic dari 1 kartu | GAGAL -> DIPERBAIKI (C2, C4) | 500 CAPTURE_MICROPHONE_ROW_MISSING; setelah C4: MIC-03..06 terdaftar input 1-4 (AUD-000204..207) |
| 4 | Penetapan slot | LULUS | capture_config: CAM-03, CAM-04, MIC-03 PRIMARY, MIC-04 STANDBY (AUD-000212/213) |
| 5 | Precheck SES-20261023-0025 | LULUS | Lens 1/2 PASS, MIC primary/standby PASS, Storage PASS, Core WARN (C3), Time NOTE, Security not reported; alert lama CAM-03/04 terselesaikan |
| 6 | Rekam | LULUS dengan catatan | 17:18:26-17:20:05; RTSP ESTAB ke .101:554 dan .103:554; 2 ffmpeg audio helper via dsnoop; 38 fragmen durable |
| 7 | Stop + segel | LULUS | EV-20261023-0014 SEALED 0,7 s setelah stop; signature_simulated=f, integrity_source=REAL |
| 8 | Integritas media | LULUS | sha256 file = evidence_tracks (9965185d..., d188c158...); ffprobe: HEVC 1920x1080 + AAC mono 48 kHz di tiap file |
| 9 | Verifikasi independen tanda tangan | LULUS | hash kanonik manifest dihitung ulang = 48bc0f77...dcd3c; `openssl pkeyutl -verify` Ed25519: "Signature Verified Successfully"; sertifikat DEMS-BENCH-01 fp 0C:86:21:74... |
| 10 | Transkrip | TIDAK TERUJI | stt_config.enabled=false; manifest transcript.state=DISABLED, disabledReason=DISABLED_BY_CONFIGURATION |
| 11 | Ekspor | LULUS | EXP-000032 / EXPJ-000032 Complete, AUD-000228; zip testzip OK; video di zip = sha256Plain manifest (76d4bac3..., 191b68c1...) |
| 12 | Rantai custody | LULUS | RECORDING_STARTED, RECORDING_STOPPED, SEALED, VERIFIED, EXPORTED |

## Perbaikan kode (di ~/Desktop/DEMS-source, ter-deploy ke /opt/dems/core, BELUM di-commit)

| ID | Masalah | Perubahan | Test |
|---|---|---|---|
| C1 | Kamera/mic yang ditambah setelah boot terbaca UNREACHABLE di precheck | probe.ts membaca `devices` + `admittedDevices()` | notices 26/26 + test D47 (uji mutasi: gagal pada kode lama) |
| C2 | Satu kartu hanya boleh 1 mic DEMS (D10(1)) | satu mic per INPUT kartu (D48); tombol pindah mic di web dihapus | audio-cards 36/36, web 14/14 (implementation/88_mic_per_input.md) |
| C3 | Precheck BLOCK bila tablet offline | WARN pada Core real-capture; Simulated tetap BLOCK | shared 2930/2930 |
| C4 | ID mic baru bentrok dengan baris seed FAKE MIC-01 | registrar meneruskan `takenIds` dari tabel; action/host mint di atasnya | capture-inputs+engine 309/309, registrar.test 1/1, static 210/210 |

Typecheck shared dan core-server exit 0 (core-server butuh NODE_OPTIONS=--max-old-space-size=6144). Test DB tidak dijalankan (port 4432 = DB produksi). Backup: /opt/dems-backup-D49-20261023-170341, /opt/dems-backup-D50-20261023-171404.

## Temuan terbuka

| # | Temuan | Dampak | Usulan |
|---|---|---|---|
| T1 | CAPTURE_VOLUME_SYNC_NOT_FULL: volume hanya fsync, bukan full sync (banner FAULT saat rekam) | Rekaman bisa hilang saat listrik mati | Periksa write cache NVMe / mount, atau UPS; putuskan apakah diterima di bench |
| T2 | Keyframe kamera tiap 4 s (batas 2 s); ~4 s awal video tidak masuk file; keyframeAligned=false | Detik awal sesi hilang | Set I-frame interval kamera <= 2 s |
| T3 | STT dimatikan | Transkrip tidak teruji | Aktifkan STT lalu ulang satu sesi |
| T4 | Pratinjau kamera "No preview / Stream not read" | Operator tidak melihat gambar | Desain OD-12; butuh fitur baru bila diperlukan |
| T5 | Meter mic di halaman Devices diam saat ada suara (laporan pengguna) | Operator tidak bisa cek mic sebelum sesi | HIPOTESIS: Core tidak membuka mic saat idle; meter Session Monitor bergerak saat rekam (-38/-41 dBFS). Perlu dibuktikan |
| T6 | Input 2 BOMGE clipping (puncak 0,0 dBFS, CLIP di Session Monitor) | Audio cadangan terdistorsi | Turunkan gain mic kedua |
| T7 | CAPTURE_SOURCE_FACTS_NOT_STATED untuk MIC-03/04 | Data kartu tidak tercatat di baris sumber sesi | Telusuri adapter USB untuk mic admitted-later |
| T8 | evidence_tracks.sha256_plain kosong di DB, padahal manifest mengisinya | Inkonsistensi kecil | Telusuri mapping rows.ts:578 |
| T9 | Uji sinyal mic di Core produksi tercatat "(simulated)"; kartu Recording Indicator "SEDANG MEREKAM" saat idle | Menyesatkan operator | Sembunyikan kontrol demo di REAL_PRODUCTION |
| T10 | Halaman login menampilkan "Demo operators" dengan password demo-2026 yang sudah tidak berlaku | Menyesatkan; penyebab gagal login berulang | Sembunyikan di REAL_PRODUCTION |
| T11 | MIC-05/06 (input 3-4, sunyi) ikut terdaftar | Pilihan salah di selector | Pensiunkan bila tidak dipakai |
| T12 | Kontrak API capture-audio-cards.ts masih menyebut 1 mic per kartu | Dokumentasi API tidak sesuai | Regenerasi openapi.json |
| T13 | Peringatan systemd "unit changed on disk" untuk dems-core/dems-console | Kosmetik | daemon-reload saat jendela perawatan |

## Lanjutan D51: STT terpasang dan uji transkrip (SES-20261023-0026 -> EV-20261023-0015)

| # | Langkah | Hasil | Bukti |
|---|---|---|---|
| 13 | Pasang STT cpu-local | LULUS | cmake (apt); whisper.cpp v1.9.5 commit d1be6fde, build statis whisper-cli + whisper-vad-speech-segments -> /opt/dems/stt/bin; ggml-large-v3-turbo.bin 1624555275 B sha256 1fc70f77... dan ggml-silero-v5.1.2.bin 885098 B sha256 29940d98..., keduanya = x-linked-etag Hugging Face; /opt/dems/core/.data/transcriber/host.json (dems-core 600) |
| 14 | Aktifkan STT di konsol | LULUS | Transcription on, speaker labelling off; "Transcription configuration saved"; Test connection "Reachable, model available"; boot TRANSCRIBER_RESOLVED |
| 15 | Rekam dengan STT | LULUS | STT_SNAPSHOT_TAKEN cpu-local rev 5, TRANSCRIBER_SESSION_OPENED, tap.pcm ditulis; 101,9 s dari MIC-03 |
| 16 | Segel dengan transkrip | LULUS (mekanik) | Finalize transcript berjalan; transcript ASSEMBLED, failedChunks 0; SEALING_COMPLETE EV-20261023-0015; scratch + tap dihapus |
| 17 | Integritas transkrip | LULUS | sha256 transcript.json/srt/vtt = manifest (b87c9c17..., 24fec12a..., 642290ad...); provenance model di manifest = file terpasang |
| 18 | Isi transkrip | GAGAL (data uji) | 1 segmen 15,0-27,6 s "Terima kasih telah menonton." = halusinasi Whisper pada derau; timeline "Microphone silent" 17:36:04 dan 17:36:53, MIC 1 ~-57 dBFS: tidak ada ucapan ke mic PRIMARY. Perlu diulang dengan orang berbicara |

Temuan baru:
| T14 | qa_flags tidak menandai segmen halusinasi pada audio sunyi | Transkrip bisa berisi teks palsu tanpa peringatan | Tambah penanda QA bila level audio di bawah ambang / pola halusinasi dikenal |
| T15 | Precheck sesi berikutnya WARN "clipping" kedua mic (latch CLIP dari sesi sebelumnya) | Peringatan basi | Reset latch CLIP setelah segel |
| T16 | Diarisasi butuh sherpa-onnx v1.13.8 + model speaker (belum diunduh) | Label pembicara tidak ada | Keputusan pengguna untuk unduhan tambahan |
