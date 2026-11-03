# Verifikasi integrasi LCD — 19 Oktober 2026

Branch: task4/input-av-core-port. Basis: e05a1567. Perubahan masih lokal, tanpa commit/push. Self-review oleh agen utama, tanpa agen/reviewer independen.

## Perubahan
- Source backend Python, Dockerfile dan compose dari ZIP pengguna masuk apps/lcd-backend; pycache dan deploy.sh yang mengganti container tidak dibawa.
- Service src/lcd mengirim state committed ke backend loopback, tiap 2 detik, timeout 1 detik/request, lease 6 detik, kanal ekstra STOP. Tidak menulis state/DB atau mengendalikan recorder. HTTP dan USB dibedakan. Kegagalan/hasil parsial menghapus klaim kanal; snapshot console kedaluwarsa setelah 6 detik. Shutdown mencoba STOP.
- Konfigurasi host DEMS_LCD_BACKEND_URL opsional, default nonaktif; query/path/auth/remote URL ditolak. Loader dan createConfig memakai validasi yang sama, termasuk port 80 eksplisit.
- Field lcd opsional di getDeviceHealth menggunakan izin/autentikasi yang sudah ada; OpenAPI diregenerasi. Tidak ada endpoint baru, perubahan DB, atau perubahan izin.
- Devices & Inputs / Front Panel memperoleh LCD connection. Mode simulator hanya preview. Query memakai client existing dan cache root core, berhenti saat sesi/link tidak aktif; cached success disembunyikan saat gagal/offline.
- Guard modul devices tetap mempertahankan larangan timer/HTTP/exception di modul route. Lifecycle ada di unit LCD terpisah; guard impor menutup unit baru melalui index; guard jaringan mematok referensi globalThis.fetch hanya ke src/lcd/bridge.ts.
- Dua import mati baseline capture-retire.ts dihapus agar typecheck web kembali lulus; tidak mengubah perilaku retirement.
- Native backend default bind loopback, START heartbeat tidak mengulang set_at. Compose bench mematok publish loopback, media mount read-only, serta UID/GID/device yang dapat diatur.

## PASS
| Pemeriksaan | Hasil |
|---|---|
| npm run typecheck (semua 7 workspace), run final | exit 0 |
| Core: src/lcd + src/modules/devices + config loader + seluruh test/static | 25 file, 396 tes lulus; exit 0 |
| Web: lcd-connection + devices-page | 2 file, 24 tes lulus; exit 0 |
| Shared: api-registry + openapi | 2 file, 63 tes lulus; exit 0 |
| Python backend unittest | 4 tes lulus |
| Integrasi HTTP Python nyata | Termasuk suite Core: 2 kanal REKAM, 2 kanal STOP, USB tidak diklaim, shutdown STOP dan expiry lease dibuktikan; import serial diganti stub, tidak membuka perangkat |
| Web production build | vite build + tsc -b exit 0; peringatan chunk besar existing |
| Lint tiga workspace | exit 0; 14 warning hanya pada file baseline di luar implementasi LCD |
| Lint terfokus file LCD/config/guard | 0 error / 0 warning |
| Docker compose config --quiet | exit 0 dengan media-root placeholder /tmp; hanya validasi konfigurasi |
| git diff --check | exit 0 |
| Graft structural rebuild | exit 0; 33.496 node, 96.491 edge; tanpa deep/model build |

## Recovery / self-review
- Pemeriksaan awal menemukan dua import mati baseline; dibuang tanpa mengubah API.
- Test fixture dibetulkan untuk track VIDEO-01/02, seed wajib, role TECHNICIAN, dan waktu panel yang tidak berada di masa depan.
- Guard arsitektur menolak timer/HTTP di folder route devices. Implementasi dipindah ke unit src/lcd; impor ke engine hanya melalui index. Guard tetap aktif dan seluruh suite static kemudian lulus.
- UI review menambahkan penolakan cached success saat link offline; pemeriksaan URL memperbaiki normalisasi port 80; status lama dibuang setelah lease.

## NOT RUN / batas
- ESP32, USB serial nyata, dan rendering panel belum diuji. Firmware panel tidak ada dalam ZIP. Jangan mengklaim lulus hardware.
- Backend fisik tidak dipasang/dijalankan; pyserial tidak dipasang pada host. Konfigurasi opt-in belum diaktifkan pada proses Core pengguna.
- Docker image tidak dibangun/deploy dan tidak ada daemon/container pengguna diubah. Hanya compose config divalidasi.
- Tidak menjalankan seluruh regresi task4, DB/kill matrix, kamera/mikrofon produksi, emulator atau perubahan sesi/data pengguna. Kriteria pekerjaan task4 sebelumnya tetap mengikuti checkpoint lamanya.
- Tidak ada pemeriksaan browser visual manual untuk tambahan panel ini; render/interaction suite devices dan build digunakan.
- ffprobe-export.txt tetap utuh dan tidak dimasukkan ke perubahan.

## Aktivasi dan rollback
Ikuti apps/lcd-backend/README.md: jalankan backend dengan serial device/media-root yang tepat; atur DEMS_LCD_BACKEND_URL pada satu Core, restart, lalu baca LCD connection pada konsol Live. Cabut variabel dan restart Core untuk menonaktifkan; backend mengakhiri status REKAM melalui lease jika heartbeat berhenti. Mode simulated capture pada Live Core mengirim status demo, bukan bukti rekaman fisik.

Status: integrasi software selesai dan terverifikasi pada lingkup di atas; penerimaan hardware menunggu perangkat.

## Subsequent packaging request
The Docker packaging NOT RUN items above describe the integration-only checkpoint. The user then requested a Linux Docker installer including LCD; images and offline bundles were built and tested in `../2026-10-19_lcd_installer/verification.md`. Physical ESP32 acceptance remains NOT RUN.
