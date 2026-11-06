# Integrasi backend LCD — 19 Oktober 2026

## Intent dan keputusan
Pengguna meminta backend-lcd.zip dari Downloads diintegrasikan ke konfigurasi LCD DEMS, lalu memilih melanjutkan branch task4/input-av-core-port. Tidak melanjutkan pekerjaan task 4 lain atau menyalakan kamera produksi.

## Sumber dan baseline
- ZIP SHA-256: 86e9bf939a159a548957c4ee1c0d90d427b7eb0b9ebf337424c3c7f4ef4f60a2
- Sumber Python dan Docker diimpor tanpa pycache. deploy.sh asli tidak dijalankan (menghapus/membuat container dan mengakses daemon host).
- HEAD awal e05a1567. ffprobe-export.txt milik pengguna dibiarkan.
- Typecheck awal gagal pada dua import tidak terpakai di capture-retire.ts.
- Graft check: OK, structural graph segar; tanpa deep build.

## Kontrak dan urutan
1. Opsional, konfigurasi host DEMS_LCD_BACKEND_URL: hanya http://127.0.0.1:<port>, tanpa path/credential/query; default nonaktif. Konfigurasi dibaca saat startup melalui loader Core yang sudah ada.
2. Core membaca state committed. Bridge terpisah setiap 2 detik; permintaan timeout; tidak menghalangi rekam/segel. GET /api/dems/status membaca jumlah kanal, POST /api/dems/ch/N/status mengirim rec, cam, lease=6, clear_file=true. CH1/CH2 mengikuti VIDEO-01/VIDEO-02 (track DEMS), kanal ekstra STOP. Tidak mengirim nama kasus, token, credential, atau path evidence.
3. REKAM hanya saat sesi RECORDING, durable, kamera online dan track REC/DEGRADED. Track LOST berhenti. Lease mencegah REKAM tersangkut saat proses mati.
4. GET /api/v1/device/health memperoleh field lcd opsional (schema bersama). Autentikasi/izin existing tetap berlaku. Tidak membuat endpoint proxy umum atau operasi kontrol rekaman LCD.
5. Front Panel menampilkan konfigurasi startup, status HTTP dan USB secara terpisah; mode simulator hanya preview dan tidak menyentuh USB/HTTP LCD.
6. Backend Python tetap penerjemah HTTP -> USB JSON v2. Simpan source dalam repo, konfigurasi native/Linux Docker terdokumentasi. Tidak deploy otomatis.

## Kriteria penerimaan
- LCD nonaktif tidak melakukan request jaringan.
- Start durable, stop, kehilangan kamera, kegagalan HTTP, lease kedaluwarsa dan shutdown dibuktikan dengan tes relevan.
- UI loading/error/nonaktif/koneksi USB tidak diketahui tidak mengklaim tersambung.
- Kontrak schema/OpenAPI konsisten. Typecheck/lint area terdampak; suite terfokus dan integrasi HTTP terhadap sumber Python; kegagalan baseline dipisahkan.
- Hardware ESP32 belum dapat dianggap diuji tanpa perangkat.

## Status
Research, implementasi dan verifikasi software selesai; penerimaan hardware belum dijalankan. Hasil lengkap di verification.md. Lifecycle/HTTP terisolasi di src/lcd (unit tertutup lewat index); module devices tetap hanya membangun route dan membaca state. Guard impor ditambah untuk unit baru, tanpa mengecualikan pemeriksaan internal. Verifikasi oleh agen utama (self-review), tanpa delegasi.
