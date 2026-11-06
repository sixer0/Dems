# DEMS Linux Docker + LCD

Bundle ini sudah membawa Core, web console, backend LCD, Python + pyserial, dan image PostgreSQL. Setelah file diekstrak, tidak perlu `pip install`, `npm install`, build image atau download image di mesin tujuan. Prasyarat host: Linux dengan Docker Engine lokal, Compose v2, bash, openssl, dan sekitar 5 GB ruang kosong. Paket untuk demo/bench; seluruh task 4 belum dinyatakan selesai dan boot rekaman produksi di container masih dibatasi profil host.

1. Pilih arsip yang cocok dengan CPU: `amd64` untuk Intel/AMD x86_64, `arm64` untuk aarch64.
2. Ekstrak arsip, lalu buka terminal di folder hasil ekstraksi. Panel ESP32 sudah dipasang firmware yang sesuai protokol JSON v2 dan dicolokkan ke host Linux. Firmware ESP32 tidak ada dalam ZIP sumber yang diberikan.
3. Jalankan `./install.sh verify` untuk memeriksa isi paket.
4. Jalankan `./install.sh install --lcd-device /dev/ttyACM0`. Ganti path dengan perangkat panel sebenarnya, misalnya `/dev/serial/by-id/...`. Installer membaca GID perangkat dan mengatur service LCD serta `DEMS_LCD_BACKEND_URL` otomatis.
5. Buka [konsol DEMS](http://127.0.0.1:5173) di browser host Linux. Akun sintetis demo: `budi.santoso`, `andi.pratama`, `rina.wijaya`; kata sandi `demo-2026`.
6. Lihat **Devices & Inputs → Front Panel → LCD connection**. HTTP “Reachable” belum berarti USB tersambung; tunggu “USB panel: Responding”. CH1/CH2 mengikuti VIDEO-01/VIDEO-02; CH3/CH4 STOP. Sesi demo akan mengubah status panel; ini bukan bukti rekaman perangkat produksi.

Jika belum memiliki panel, `./install.sh install --without-lcd` memasang stack demo dengan LCD tetap tersedia dalam image tetapi tidak dijalankan. Untuk menambah panel kemudian: pada `.env`, set `COMPOSE_PROFILES=console,lcd`, `DEMS_LCD_BACKEND_URL=http://127.0.0.1:8090`, serial path dan GID (`stat -c %g <device>`), lalu `./install.sh start`.

Sesudah instalasi, `./install.sh stop` menghentikan layanan tanpa menghapus volume. `./install.sh start` menyalakannya lagi. `./install.sh status` memperlihatkan kondisi container. Jangan menjalankan instalasi ulang atau `docker compose down --volumes` untuk memulai ulang. Installer menolak menimpa konfigurasi/password atau volume DEMS yang sudah ada; pembaruan dari deployment lama perlu prosedur upgrade tersendiri.

Simpan folder instalasi, `.env`, dan `secrets/` dengan aman. Database memakai password acak yang dibuat lokal, tidak ada password database di paket. Login operator di atas adalah akun demo sintetis. Installer membuat, memigrasi, dan seed **database baru**; tidak mereset database lama. Bila proses terhenti sebelum `db:status` selesai, simpan state dan log; jangan hapus secrets atau volume dan jangan langsung memakai start untuk melewati migrasi.

Layanan LCD memakai image yang sama dengan Core, user 10001 non-root, tambahan grup serial yang ditemukan, loopback HTTP 8090, dan mount media read-only. Core juga bind loopback, sehingga akses dari komputer lain melalui SSH tunnel yang diatur operator. Port 4420/4432/5173/8090 harus tersedia. Stop service `lcd` sebelum flashing firmware. Untuk layanan/volume di server ini, pastikan Docker Engine benar-benar berjalan pada host yang memegang USB (bukan Docker Desktop/remote daemon).

Lease 6 detik mencegah panel tersangkut REKAM saat Core mati (ditambah hingga 1 detik reaper). USB/rendering fisik tetap harus diuji pada panel. SHA256SUMS memeriksa integritas berkas; ini bukan tanda tangan penerbit. BUILD-INFO.txt mencatat sumber dan pengujian paket. Pengujian container memakai sumber simulasi, tidak pernah mengesahkan kamera produksi atau rekaman produksi.
