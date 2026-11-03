# HANDOFF — DEMS Edge Client: mesin bench .73 — STATUS KOMPREHENSIF 2026-11-03 18:20 WIB
Supersedes: HANDOFF-DEMS-BENCH.md (21-10), HANDOFF-RFLEX-20261022.md, HANDOFF-INSTALL-20261022-NIGHT.md,
handoff_install_20261022_night.md, handoff_rflex_20261022.md — semuanya era Docker/simulasi dan TIDAK LAGU AKURAT.
Semua fakta di bawah terverifikasi dari perintah nyata pada sesi ini kecuali diberi tanda (?).

## 1. Proyek & posisi hari ini
- DEMS Edge Client = produk GSP (PT Gemilang Satria Perkasa): perangkat rekam jejak-bukti (kamera + mic + panel LCD ESP32), Core Node.js/Fastify + PostgreSQL + web console React, bukti di-seal Ed25519. Klien akhir: instansi (satker/client diisi saat pre-deliver).
- Stack Docker 2026-10-19 SUDAH DIHAPUS dari host (keputusan D-bench; lihat 01_backup_and_docker_removal.md). Produksi sekarang **bare-metal systemd** dari source tree `/opt/dems/core` (layanan tsx/vite langsung, TANPA build step).
- Repo kerja: `~/Desktop/DEMS-source`, branch **`task4/input-av-core-port`**. Tree BERSIH. HEAD = `3f7d7192` (docs bench D57f).

## 2. Layanan produksi (semua aktif, terverifikasi 18:08+)
| Service | Endpoint | Isi |
|---|---|---|
| `dems-core.service` | 127.0.0.1:4420 | Fastify via `node --import tsx src/start/index.ts`; env `/etc/dems/core.env`; boot 37 langkah + CAPTURE_BOOT_CHECKS_PASSED |
| `dems-console.service` | 127.0.0.1:5173 | `vite --host 127.0.0.1 apps/core-web` |
| `dems-lcd.service` | 127.0.0.1:8090 | `python3 /opt/dems/core/apps/lcd-backend/app/dems_backend.py`; panel ESP32 di CH340 `/dev/serial/by-id/usb-1a86_USB_Single_Serial_5C79083222-if00` |
| `postgresql@18-main` | 127.0.0.1:4432 | DB produksi `dems_demo`; ledger `drizzle.__drizzle_migrations` = 39 = 39 file migrasi (0037, 0038 sudah applied) |
Akses jarak jauh resmi = SSH tunnel (loopback permanen by design). PC produksi GSPTaskManagement .72: JANGAN disentuh (aturan user).

## 3. Deploy prosedur (pola yang terbukti 3×: D53, D56, D57c, D57e)
1. Backup: `tar czf $BK/core-src.tar.gz -C /opt/dems/core .` + `pg_dump -p 4432 -d dems_demo` + salin `/etc/dems/core.env` → `/opt/dems-backup-<label>-<ts>/`.
2. `git archive HEAD | sudo tar x -C /opt/dems/core` (TANPA --delete; node_modules tidak ikut arsip dan tetap di tempat; pkg/lock identik → tanpa npm ci).
3. **WAJIB setelah tar**: `sudo find /opt/dems/core/apps -type d -perm -g+w -exec chmod g-w {} +` — tar dari git memulihkan mode group-writable yang ditolak path-rule boot (kelas kegagalan yang sama 2×: worker chain & fixture boot).
4. `sudo systemctl restart dems-core.service dems-console.service` (+ `dems-lcd.service` bila `dems_backend.py` ikut berubah — file itu SATU-SATUNYA yang di-install terpisah ke /opt/dems via `sudo install -m 644`).
5. Verifikasi: `journalctl -u dems-core` (37 steps + PASSED), `curl :4420/api/v1/health`, probe route baru.
Backup hari ini tersedia: `/opt/dems-backup-D57c-20261103-163807/`.

## 4. Riwayat commit sesi ini (branch task4/input-av-core-port, semua hijau ter-verifikasi)
- `af6fac75` D57 — gerbang `/setup` lcd-backend = IDENTITAS vendor (root/gsp.teknisi), bukan peran TECHNICIAN (root berperan SUPERVISOR).
- `9004fb84` — sapu 16 pin basi warisan D54/D56b yang sudah merah di HEAD: search-path 0036/0038, contract-inventory 37→39 (tail LATER-tags pensiun), commands `inventory+2` (tabel purge T-49/T-50; JSON kontrak sengaja pre-amendment), credentials seed pakai `OWNER_FILE_NAME`, imports: admin ambil `CoreError` lewat index core; `capture/boot/checks` masuk EXPOSED (alasan password-hash).
- `756ef424` **D57c** — modul panel-setup pra-kirim pindah ke KONSOL: operasi §7 **118/119 `getPanelSetup`/`setPanelSetup`** (kontrak `api/lcd-setup.ts`, audit type **`PANEL_SETUP_CHANGED`** ke-91, allow-list server-written 47, proxy+gate `src/lcd/setup.ts` (`vendorGateOf`; 403 TANPA audit row sebelum byte diteruskan; cookie sesi dititipkan utuh dibuktikan balik ke Core; backend mati → 503 `LCD_BACKEND_UNREACHABLE`; 403→401; 422 bawa reason), pintu JSON backend `POST /api/dems/setup`, halaman `panel-setup-panel.tsx` (Live-only, vendor-only, cosmetic). Counts final: **119 operasi, 41 GET/78 POST, 110 paths, live 75, offline 45, 91 audit types, 200 schemas**; openapi.json regenerated.
- `57a25f9c` — test live panel 8 kasus + **2 bug nyata**: StrictMode bertanya 2× (→ guard `askedRef`); wording 422 membaca `details` top-level padahal amplop klien menaruhnya di bawah `error` (→ ikut pola stt-config-model).
- `d31555ca` **D57d** — `PANEL_LOGO_BASE64_MAX_LENGTH` 8.388.608 → **60.000** (PNG ≤ 45.000 B): kontrak patuh pada pipeline-nya sendiri (API-4 `BODY_LIMIT_BYTES` 65.536 menjawab 413 SEBELUM handler — upload asli prinsipal membuktinya); pin aritmetika worst-case-body di `api-registry.test.ts`; panel menolak file >45 KB SAAT DIPILIH dengan kalimat sendiri. Backend `/setup` page tetap 6 MiB.
- `b474f561` **D57e** — form menyatakan ukuran slot (client 85×48, splash 227×128, PNG ≤45 KB, scaled+flattened); dropdown `both` DIHAPUS dari konsol (tetap capability kontrak untuk halaman panel).
- `3f7d7192` **D57f** — bench row firmware (bagian 6).

## 5. Firmware panel ESP32 — DITEMUKAN di mesin ini (BUKAN repo git!)
- Lokasi: `~/Desktop/DEMS-LCD-IO-LAIN` (PlatformIO `esp32dev`, src/main.cpp ±1050 baris, ILI9488 480×320). Folder TIDAK ber-version-control — pertimbangkan `git init` + baseline commit (menunggu kata user).
- Bug yang ditemukan & diperbaiki (edit langsung di file, v3.9.2 → **v3.9.3**):
  1. `renderStatic()` menggambar konstanta `SUBTITLE="BARESKRIM - POLRI"` padahal font f2 sudah di-fit ke `clientShown` (kata `client` dari payload status yang SELALU dikirim & sudah di-parse + di-echo) → kini `place(f2, clientShown, C_SUB)`; fallback desain lama utuh (fresh → "READY TO SETUP").
  2. Garis emas `fillRect(0,0,W,4,C_ACCENT)` di atas halaman operasi → DIHAPUS (splash boot tidak diminta, masih punya garisnya).
- Toolchain: `platformio` tidak ada di PATH; PEP 668 menolak pip sistem → **PlatformIO 6.2.0 di venv scratch `~/.hermes/cache/scratch/pio-venv`** (prune 24 jam! buat ulang bila hilang: `/usr/bin/python3 -m venv ... && bin/pip install platformio`; packages/toolchain sudah ada di `~/.platformio`).
- Prosedur flash (terbukti 18:08): `sudo systemctl stop dems-lcd.service` → `pio run -e esp32dev -t upload --upload-port /dev/serial/by-id/usb-1a86_USB_Single_Serial_5C79083222-if00` (hash verified, hard reset) → `start` service. Partisi LittleFS TIDAK tersentuh: kedua logo selamat (bukti boot: client crc=0x4F86, splash crc=0xE579 di-load ulang).
- Bukti serial layar baru: `[fwlab] 'FIRMWARE v3.9.3'`, `panel: [client] KEJAKSAAN AGUNG RI`, `[layout] sub` tergambar, `[logo] 85x48 1:1 DARI BERKAS crc=0x4F86`. **Konfirmasi mata ke LCD fisik = tugas prinsipal.**
- Upload logo via konsol TERBUKTI end-to-end 17:43: client + splash (splash slot: berkas PERTAMA) `TERSIMPAN → ACK SIAP → tampilan disegarkan`.

## 6. Status verifikasi test (bukti nyata, bukan klaim)
- `packages/shared`: **2949/2949** + tsc bersih (suite penuh terakhir 17:4x).
- `apps/core-server` unit penuh: **0 kegagalan BARU vs baseline HEAD**; 90 sisa = artefak lingkungan bench (fixture memalsukan `darwin` → pertanyaan `/usr/sbin/system_profiler` di Linux; identik di HEAD). Targeted hijau: src/lcd 27/27, devices static+routes 208, admin 127, db/static 320, core writers 304.
- `apps/core-web`: suite live-system 73/73 + panel 9/9 + tsc bersih.
- `apps/lcd-backend`: unittest Python 7/7 (termasuk 3 kasus gerbang D57: root-as-SUPERVISOR diterima, klien-as-TECHNICIAN ditolak, reverifikasi ikut akun).
- `tsc` core-server butuh `NODE_OPTIONS=--max-old-space-size=6144` (OOM di heap default).

## 7. Lingkungan & jebakan yang sudah terbukti menipu
- Node: **WAJIB** `export PATH=/home/gsp-dems/.hermes/tools/node-26.12.1-linux-x64/bin:$PATH` (node 26.12.1; node sistem tidak ada).
- `/usr/bin/lockf`: Ubuntu noble TIDAK punya paket ini (util-linux-extra pun kosong dari lockf) → **shim Python** saya pasang (flock+exec, semantik `-k -t`; sumber di scratch `lockf-shim.py`). `scripts/pg/*` bergantung padanya.
- **Port 4432 dipakai cluster produksi** (`postgresql@18-main`), sementara cluster dev proyek (`scripts/pg`, `.data/pg.env`) DI-DESAIN di port yang sama → `pg:start` menolak dengan benar. Menjalankan `test:db` (db-suite PERDANA) butuh jendela db-sweep: stop produksi → start dev → run → pulihkan. **Belum pernah dijalankan; butuh keputusan+kata prinsipal.**
- Aturan path boot menolak direktori group-writable di rantai mana pun: sudah `chmod g-w` pada `~/.hermes/cache`, rantai repo, dan `/opt/dems/core/apps/**` — JANGAN kembalikan 775.
- Terminal shell di sesi ini kadang memakai venv Hermes tanpa pip — pakai `/usr/bin/python3` eksplisit.
- Screen-lock laptop: `loginctl unlock-session c2` (sebelumnya; kalau layar terkunci lagi).
- Jam bench: WIB (UTC+7); timestamp journal & DB konsisten lokal.

## 8. Item TERBUKA (urut prioritas)
1. **Konfirmasi visual LCD** oleh prinsipal: baris-2 "KEJAKSAAN AGUNG RI", tanpa garis kuning, logo & splash baru (crc 0x4F86 / 0xE579).
2. **db-sweep perdana** (`npm run test:db`) — jendela mati produksi singkat, lihat §7.
3. Logo > 45 KB lewat KONSOL → butuh amandemen API-4 (per-route bodyLimit + kalimat envelope table) — ratifikasi prinsipal; jalur `/setup` panel tetap longgar 6 MiB.
4. `git init` folder firmware + commit baseline/patch — tawaran terbuka.
5. Deploy `dems_backend.py` berikutnya: ingat ia bagian dari tree /opt/dems/core (ikut git archive) — tidak perlu `install` terpisah lagi sejak D57c.
6. (?) Serahkan fingerprint kunci tanda-tangan produksi bila belum — aturan lama: hanya setelah boot produksi pertama sukses (sudah lama lewat; cek apakah serah-terima pernah dilakukan).

## 9. Aturan main user (tetap berlaku)
- Bahasa Indonesia; hard actions (commit/delete/stop/reboot) butuh kata user — kata diberikan per-pekerjaan, bukan blanket.
- Prinsipal mengetik sendiri kredensial HIL; jangan pernah minta/kirim password, card, kode lewat chat/tool.
- Commit hanya dengan perintah; laporan selalu dengan bukti segar (perintah nyata, bukan ingatan).
- "tuntaskan jangan menunggu" = selesaikan seluruh langkah dalam batas safety, jangan berhenti di tengah bertanya ulang.

## 10. Peta dokumen
- Log pekerjaan per-tanggal (satu baris per peristiwa, gaya bench): `docs/2026-10-21_bare_metal_bench/status_tasks.md` (baris terakhir 18:12 D57f).
- Keputusan D51–D57f: `docs/2026-10-21_bare_metal_bench/decisions/decisions.md`.
- Kontrak API: `packages/shared/src/api/` + `openapi.json` (regenerate: `npx tsx scripts/gen-openapi.ts`).
- Handoff lama: ditandai SUPERSEDED di baris pertama masing-masing.
