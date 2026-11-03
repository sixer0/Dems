---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: data-analyst
row: 96
type: decision sheet (HIL, docs only)
narrative_tier: 1
source_of_truth: masterplan/01_specs_rflex.md section 8 (row 95)
cross_checked: masterplan/01_specs_rflex_*.md, 01_specs_register.md, 01_specs_service.md, 01_specs_database.md, 01_specs_security.md, research/03_analysis_applicability.md, research/03_analysis_impact.md, research/03_analysis_rflex_impact.md, decisions/decisions.md D8-D15
last_updated: 2026-10-22
---

# Lembar keputusan R-FLEX + instalasi (baris 96)

Sumber setiap butir: `masterplan/01_specs_rflex.md` §8 (disingkat SPEC), kecuali disebut lain. Tidak ada nilai rahasia di lembar ini.

## 1. Ringkasan

- Lembar ini meminta keputusan Anda untuk 19 butir R-FLEX (Q96-01..Q96-19) dan 20 butir instalasi (I-01..I-20).
- R-FLEX adalah perubahan kode dari keputusan D10: audio USB tanpa kunci port, satu kartu hanya untuk satu binding, binding lama dilepas saat di-pair ulang. Kamera ONVIF dibuat "Global penuh".
- Ketiga perubahan itu sudah dirancang (baris 88-95). Beberapa pilihan masih bergantung pada cara Anda membaca aturan sendiri, misalnya apa arti "line" dan apa satuan "device".
- Baris 97 memecah rancangan menjadi baris kode 98-114. Baris 97 tidak bisa mulai sebelum jawaban ini dicatat di `decisions.md`. Jika Anda nanti memilih opsi lain, misalnya bundle C pada Q96-02-M, perubahan itu MAJOR dan butuh gerbang persetujuan baru.
- Butir instalasi menentukan bentuk layanan, firewall, database dan rollback. Itu dipakai oleh baris 17 (rekonsiliasi), baris 18 (runbook) dan baris 20 dan seterusnya.
- 4 butir R-FLEX dan 2 butir instalasi hanya pemberitahuan (bagian 4). Semuanya sudah diputuskan oleh baris spesifikasi atau D12, tetapi boleh Anda batalkan.
- Cara menjawab ada di bagian 5. Satu baris cukup untuk menyetujui semua rekomendasi.

## 2. Keputusan R-FLEX

### Q96-01 Satuan eksklusivitas audio
- Pertanyaan: Saat sebuah perangkat audio sudah di-pair, apakah yang dikunci seluruh kartu fisiknya, atau hanya satu input dari kartu itu?
- Opsi: (a) seluruh kartu fisik: satu MIC per kartu; (b) per input kartu: input lain dari kartu yang sama tetap bisa di-bind.
- Rekomendasi: **(a)**. Ini bacaan harfiah dari "device sudah pairing ke 1 input". Baris 91 merekomendasikan (b).
- Konsekuensi (a): interface 2-input hanya bisa melayani satu line. DB lama yang punya dua MIC pada satu kartu baru terlihat bermasalah di op 99 berikutnya.
- Konsekuensi (b): `boundTo` pindah ke `registered[]` (perlu tambahan spesifikasi di baris 97). Rilis lewat op 99 hanya berlaku untuk unit identik atau kunci yang berganti nama.
- Di bench (mic BOMGE 1-input), (a) dan (b) berperilaku sama.
- Baris terdampak: 99, 107, 108, 111, 125, AC9.

### Q96-02 Arti "line" saat pair ulang
- Pertanyaan: Kata "line" pada "pair ulang dengan line tertentu maka line yang lama harus dilepas" berarti apa?
- Opsi:
  - (a) keduanya:
    - pair ulang ke input lain lewat op 99 (`release: true`) melepas binding lama;
    - memindahkan MIC antara PRIMARY dan STANDBY di selector mengosongkan line lama.
  - (b) hanya op 99, input lain;
  - (c) hanya pemindahan di selector.
- Rekomendasi: **(a)**.
- Konsekuensi (a): semua bacaan tercakup. Ada perubahan web dan uji T-13 pada op 78. Hanya jalur selector yang bisa dibuktikan di bench (baris 126); jalur op 99 dibuktikan dengan DB test T-10.
- Konsekuensi (b): line PRIMARY/STANDBY tidak terlepas otomatis, dan baris 126 tidak punya bukti bench.
- Konsekuensi (c): pair ulang ke input lain tetap ditolak dengan `AUDIO_CARD_ALREADY_BOUND`, tanpa jalan rilis.
- Baris terdampak: 108, 111, 126, AC9. Mekanisme rilisnya diatur di Q96-02-M (bagian 4).

### Q96-03 Dua kartu identik tanpa serial
- Pertanyaan: Jika dua kartu dari model yang sama tanpa nomor serial dicolok bersamaan, bagaimana DEMS bersikap?
- Opsi: (a) unit kedua tidak bisa di-bind, dan selama keduanya tercolok MIC-a tidak dibuka (`CARD_AMBIGUOUS`/`MODEL_SHARED`), tanpa fault; (b) port USB dipakai sebagai pembeda; (c) hanya penolakan ambigu tanpa larangan bind.
- Rekomendasi: **(a)**. Ini gabungan opsi (i)+(iii) di SPEC.
- Konsekuensi (a): tidak pernah merekam dari unit yang salah tanpa pemberitahuan. Unit kedua tampil "Bound to MIC-a".
- Konsekuensi (b): kunci port sebagian kembali, bertentangan dengan D10(1).
- Konsekuensi (c): dua MIC bisa menunjuk kartu yang tidak bisa dibedakan.
- Tidak diuji di bench (U-RF5).
- Baris terdampak: 107, 108, 111.

### Q96-04 Scan commissioning dan set-IP
- Pertanyaan: Apakah `COMMISSIONING_SCAN` dan `SET_IP` tetap terikat ke interface kamera yang dikonfigurasi?
- Opsi: (a) tetap terikat; (b) global.
- Rekomendasi: **(a)**.
- Konsekuensi (a): helper alias dan HOST-46 tidak berubah. Konfigurasi jaringan hanya wajib untuk dua fungsi ini.
- Konsekuensi (b): perlu file helper per interface, HOST-46 membandingkan himpunan, dan admission membawa nama interface (nama baru belum terdaftar). S13-08 perlu ditinjau ulang. Ini juga membuka set-IP (perubahan alamat perangkat) ke jaringan kantor.
- Baris terdampak: 102, 105, 106, 113, 124, CF-2/3.

### Q96-05 Penjaga sisa (residual guards) RG-1..RG-14
- Pertanyaan: Apakah semua penjaga sisa dipertahankan setelah "Global penuh"?
- Opsi: (a) pertahankan semua; (b) buang penjaga tertentu. Setiap penjaga yang dibuang menjadi D-id baru dan perubahan MAJOR.
- Rekomendasi: **(a)**.
- Konsekuensi (a): yang tetap ditolak adalah alamat publik, alamat khusus, alamat host sendiri, tepi subnet, port di luar daftar, alias sebagai sumber, dan target off-link.
- Konsekuensi (b): ancaman yang dijaga penjaga itu terbuka lagi (`01_specs_rflex_security.md` §3).
- Baris terdampak: 102, 117, 119.

### Q96-06 Hanya on-link, atau juga target yang di-route
- Pertanyaan: Apakah Core hanya boleh dial kamera yang berada langsung di subnet salah satu interface host?
- Opsi: (a) hanya on-link; target lain ditolak `NO_SOURCE_INTERFACE` (NW-R1, RG-12); (b) target privat apa pun, mengikuti route kernel.
- Rekomendasi: **(a)**.
- Konsekuensi (a): jika `enp4s0` mati, kamera tersimpan di 192.168.100.x tidak lagi on-link dan ditolak. Digest kredensial kamera tidak terkirim ke router kantor. RG-12 yang mencegah ini.
- Konsekuensi (b): dalam kejadian yang sama, kernel me-route dial lewat gateway Wi-Fi. Digest kredensial kamera sampai ke router kantor. Aturan DR-4 "tanpa route fallback diam-diam" hilang sepenuhnya, dan aturan berhenti R4 (`03_analysis_impact.md:82`) menjadi satu-satunya penjaga.
- Baris terdampak: 102, 117, 93 (E-P1/E-P3/N4), baris kamera 66-69.

### Q96-08 Kamera di luar port kamera (DHCP)
- Pertanyaan: Bagaimana menangani risiko RR-2? Jika alamat DHCP sebuah kamera dipakai ulang oleh perangkat lain, digest kredensial kamera tersimpan bisa terkirim ke perangkat itu tanpa enkripsi.
- Opsi:
  - (a) terima, dengan aturan operasi: kamera tetap di port kamera statis, Wi-Fi hanya untuk uji, batasannya ditulis (E-P13);
  - (b) wajibkan alamat statis atau reservasi untuk kamera semacam itu (didokumentasikan);
  - (c) kode baru: cek identitas perangkat sebelum mengirim kredensial;
  - (d) tolak kamera tersimpan di luar port kamera.
- Rekomendasi: **(a)+(b)**, ditulis di dokumen host; (c) sebagai tindak lanjut di luar blueprint ini.
- Konsekuensi (a)+(b): risiko tetap ada, ditekan dengan aturan tertulis, tanpa kode baru.
- Konsekuensi (c): menambah baris kode (MAJOR).
- Konsekuensi (d): membalik D10(2).
- Baris terdampak: 113, 117, 119.

### Q96-09 `usb_port` tersimpan, dan baris tanpa serial maupun port
- Pertanyaan: Apakah kolom `usb_port` tetap disimpan, dan bagaimana memperlakukan baris lama tanpa serial dan tanpa port (RM-A3/A4)?
- Opsi: (a) simpan port (hanya informasi); baris tanpa keduanya diperlakukan seperti "tanpa serial"; (b) simpan port; baris tanpa keduanya tetap ditolak ("never opened"); (c) buang `usb_port`.
- Rekomendasi: **(a)**.
- Konsekuensi (a): tidak ada migrasi. Opsi ini hanya sah bersama bundle M (Q96-02-M).
- Konsekuensi (b): wajib jika Anda memilih bundle C.
- Konsekuensi (c): perlu migrasi (opsi B Q96-07: set 17, 25 file version-pin) dan ubahan pada file uji baris 94 §4.1.
- Kombinasi bundle C + (a) tidak sah.
- Baris terdampak: 98, 107, 108.

### Q96-11 HOST-19 dan network-manager
- Pertanyaan: Apakah HOST-19 menerima padanan network-manager untuk "file B" sebagai teks produk?
- Opsi: (a) ya, teks produk; (b) tidak, A8 tetap deviasi bench.
- Rekomendasi: **(a)**.
- Konsekuensi (a): bench lolos HOST-19 tanpa deviasi.
- Konsekuensi (b): deviasi A8 tetap tercatat di register deviasi.
- Baris terdampak: 113, 34, 78.

### Q96-12 Dokumen penerimaan hardware (UA-12, HW-3, `collect-h01.sh`)
- Pertanyaan: Kapan dokumen penerimaan hardware disesuaikan dengan R-FLEX?
- Opsi: (a) tugas berikutnya; (b) baris baru di samping 113 (MINOR).
- Rekomendasi: **(a)**.
- Konsekuensi (a): dokumen itu sementara masih memuat aturan lama.
- Konsekuensi (b): tugas ini bertambah satu baris dokumen.
- Baris terdampak: 113.

### Q96-15 Nama interface per hasil pencarian kamera
- Pertanyaan: Apakah jawaban pencarian menyebut interface per kamera, atau hanya jumlahnya?
- Opsi: (a) hanya `interfaceCount`; (b) tambah nama interface per hasil.
- Rekomendasi: **(a)**.
- Konsekuensi (a): kontrak API tetap. Cek baris 66-69/128 diganti dengan pembandingan jumlah (SPEC §2.8).
- Konsekuensi (b): perubahan kontrak yang membalik F9/NW-S1 dan membuka nama interface host di jawaban API.
- Baris terdampak: 99, 104, 19.

### Q96-16 HIL baris 124 (konfigurasi jaringan port kamera) di bench
- Pertanyaan: Apakah baris 124 dijalankan di bench?
- Opsi: (a) N/A, kecuali scan atau set-IP akan dipakai; (b) selalu dijalankan.
- Rekomendasi: **(a)**, dengan syarat Q96-04 = terikat dan tidak ada kamera factory-default yang perlu diberi alamat ulang.
- Konsekuensi (a): langkah 9A/H-12 .3-.4 tidak berjalan.
- Konsekuensi (b): menambah satu sesi HIL.
- Baris terdampak: 124.

### Q96-17 Teks kriteria penerimaan AC6/AC7/AC9
- Pertanyaan: Apakah teks AC di SPEC §7 diterima?
- Opsi: (a) apa adanya; (b) diubah, dengan teks dari Anda.
- Rekomendasi: **(a)**.
  - AC6 dan AC7 tidak berubah.
  - AC9 di bench dibuktikan lewat empat hal: `boundTo` (baris 125), pindah port tanpa `AUDIO_CARD_CHANGED` (127), pindah PRIMARY ke STANDBY (126), dan `interfaceCount` = interface eligible (diperkirakan 2) dengan 4 kamera.
  - Rilis op 99 ke input lain dibuktikan dengan DB test T-10.
- Konsekuensi (a): AC9 bisa dijalankan di bench dengan mic 1-input.
- Konsekuensi (b): baris 17 dan 125-128 menunggu teks baru.
- Baris terdampak: 17, 74, 125-128.

### Q96-18 Bentuk rollback kode R-FLEX sebelum commit
- Pertanyaan: Jika R-FLEX harus dibatalkan sebelum commit, rollback mana yang dipakai?
- Opsi: (a) R-FLEX-R-B: reverse patch khusus R-FLEX (`rflex-only.diff`, RB-1); (b) R-FLEX-R-A: restore penuh ke keadaan baris 80, dengan `docs/*` dikecualikan.
- Rekomendasi: **(a) R-FLEX-R-B**.
- Konsekuensi (a): hanya file R-FLEX yang disentuh; dokumen dan pekerjaan lain tetap ada.
- Konsekuensi (b): semua ubahan non-R-FLEX sejak baris 80 ikut hilang. Tanpa pengecualian `docs/*`, dokumen tugas tertimpa.
- Tidak ada langkah DB di jalur rekomendasi.
- Baris terdampak: 77, 120.

### Q96-19 Cakupan uji baris 115
- Pertanyaan: Uji apa yang dijalankan di baris 115?
- Opsi: (a) set R-FLEX 9 suite, satu runner berat, `--maxWorkers=2`; (b) `test:regression` penuh (sekitar 75 menit, maxWorkers 4).
- Rekomendasi: **(a)**. Uji penuh hanya jika gerbang G-RF memintanya.
- Konsekuensi (a): lebih cepat, sesuai aturan uji 2+1.
- Konsekuensi (b): beban host tinggi dan waktu tunggu lebih lama.
- Baris terdampak: 115.

## 3. Keputusan instalasi

Id I-xx dibuat untuk lembar ini. Id sumbernya ditulis dalam kurung.

### I-01 Home akun layanan (F-S1, R96-11-01)
- Pertanyaan: Apa direktori home akun `dems-core`?
- Opsi: (a) `/nonexistent`, tanpa home; (b) `/opt/dems/core/.data`, sesuai HOST-04.
- Rekomendasi: **(a)**.
- Konsekuensi (a): cache tool tidak masuk ke penyimpanan bukti. Ini deviasi HOST-04, dan register instalasi :63 dikoreksi di baris 17.
- Konsekuensi (b): npm dan tool lain bisa menulis cache ke direktori bukti.
- Baris terdampak: 21, 17.

### I-02 Bentuk ExecStart (F-S2)
- Pertanyaan: Bagaimana unit systemd menjalankan Core?
- Opsi: (a) `node .../tsx/dist/cli.mjs src/index.ts` + `KillMode=mixed`; (b) `node --import tsx src/index.ts`.
- Rekomendasi: **(a)** dulu. Ganti ke (b) jika uji stop di baris 58 gagal.
- Konsekuensi (a): bentuk ini sudah ditelusuri dan sudah berjalan di Docker.
- Konsekuensi (b): satu proses, tetapi belum pernah dijalankan.
- Baris terdampak: 33, 58.

### I-03 Cara memanggil CLI (F-S3)
- Pertanyaan: Bagaimana perintah CLI (`db:*`, operator) dipanggil?
- Opsi: (a) langsung lewat tsx; (b) lewat npm.
- Rekomendasi: **(a)**.
- Konsekuensi (a): U3/U4 gugur, dan `cli_cache_dir` tidak dibuat.
- Konsekuensi (b): perlu `cli_cache_dir` dan menambah hal yang belum diketahui.
- Baris terdampak: 57, 17.

### I-04 Start konsol (F-S4, R14-5)
- Pertanyaan: Bagaimana layanan konsol web dinyalakan?
- Opsi: (a) unit enabled, menyala saat boot; (b) unit on demand; (c) manual.
- Rekomendasi: **(a)**: hanya di loopback, dengan akun terpisah.
- Konsekuensi (a): konsol selalu siap lewat SSH forward dan tidak terbuka ke jaringan.
- Konsekuensi (b)/(c): perlu langkah tambahan setiap kali konsol dipakai.
- Baris terdampak: 122.

### I-06 Cek 9A/H-07 (R96-11-02)
- Pertanyaan: Apakah 9A/H-07 (listing kartu, identitas setelah dicolok ulang) dijalankan sebagai cek bernama?
- Opsi: (a) tidak; baris 125-127 yang mengamatinya; (b) ya, pada satu mic.
- Rekomendasi: **(a)**.
- Konsekuensi (a): cek tidak berulang. 9A/H-07 ditulis untuk aturan kunci port lama.
- Konsekuensi (b): menguji aturan yang sudah dihapus.
- Baris terdampak: 37, 125-127.

### I-07 Sebut 9A/H-12 di baris 66-69 (R96-11-03)
- Pertanyaan: Apakah 9A/H-12 disebut namanya di baris 66-69?
- Opsi: (a) ya: langkah .1-.2, dan .3-.4 setelah baris 124; (b) dibiarkan implisit.
- Rekomendasi: **(a)**.
- Konsekuensi (a): HOST-23 diuji terhadap kamera nyata.
- Konsekuensi (b): tidak ada cek bernama untuk HOST-23.
- Baris terdampak: 66-69, 124.

### I-08 Cakupan cek HOST-28 (R96-11-04)
- Pertanyaan: Kartu suara mana yang dicek HOST-28?
- Opsi: (a) hanya kartu USB, berdasarkan id; (b) semua kartu, sesuai teks.
- Rekomendasi: **(a)**.
- Konsekuensi (a): cek fokus pada mic DEMS.
- Konsekuensi (b): cek bisa gagal karena ALC897 bawaan.
- Baris terdampak: 37.

### I-09 Sumber aturan SSH di Wi-Fi (R14-1)
- Pertanyaan: Dari mana SSH diizinkan di `wlp3s0`?
- Opsi: (a) sumber mana pun di `wlp3s0`; (b) hanya Mac 192.168.0.14.
- Rekomendasi: **(a)**.
- Konsekuensi (a): SSH terbuka untuk perangkat lain di Wi-Fi kantor (login tetap butuh kredensial).
- Konsekuensi (b): alamat Mac berasal dari DHCP. Jika berubah, satu-satunya jalur manajemen terkunci dan host harus di-reset lewat tombol power.
- Baris terdampak: 36.

### I-10 Aturan bawaan ufw di Wi-Fi (R14-2)
- Pertanyaan: Apakah aturan bawaan ufw (ICMP echo, mDNS, UPnP) dibiarkan di Wi-Fi?
- Opsi: (a) biarkan dan catat; (b) edit `/etc/ufw/before.rules` untuk membuangnya di `wlp3s0`.
- Rekomendasi: **(a)**.
- Konsekuensi (a): tidak ada port DEMS yang terbuka, jadi AC7 tetap terpenuhi. Ping yang dibalas tidak dihitung sebagai pelanggaran.
- Konsekuensi (b): aturan paket berubah dan bisa melenceng saat ufw di-upgrade.
- Baris terdampak: 36, 72.

### I-11 File berisi password plaintext (R14-3, O2)
- Pertanyaan: Apa yang dilakukan dengan file HANDOFF di Desktop .73 dan folder temuan di Mac (mode 0755) yang memuat password plaintext?
- Opsi: (a) dibiarkan, karena semua password itu dianggap sudah bocor; (b) Anda menghapus file itu atau membatasinya ke 0600; (c) (b), ditambah password login `gsp-dems` yang baru jika ada di file itu.
- Rekomendasi: **(b)**, ditambah (c) bila berlaku. File hanya dihapus atas kata Anda.
- Konsekuensi (a): siapa pun yang punya akses baca ke file itu melihat password-nya.
- Konsekuensi (b)/(c): paparan berhenti. Operator mengetik password baru sendiri (D6, OI-1).
- Baris terdampak: tidak ada baris install. Ini tindakan Anda.

### I-12 Setelan sshd (R14-4)
- Pertanyaan: Apa yang dilakukan dengan setelan sshd yang ditemukan di R0, misalnya login dengan password masih aktif?
- Opsi: (a) hanya dicatat; (b) diubah ke login key-only sebagai perubahan host tersendiri.
- Rekomendasi: **(a)** di tugas ini; (b) sebagai tindak lanjut dengan revert-nya sendiri.
- Konsekuensi (a): login dengan password tetap mungkin dari Wi-Fi.
- Konsekuensi (b): ada risiko terkunci di jalur manajemen satu-satunya.
- Baris terdampak: 36.

### I-13 Nama tampilan instalasi (96-R12-1)
- Pertanyaan: Siapa yang mengisi `DEMS_INSTALLATION_NAME`?
- Opsi: (a) Anda mengetiknya di baris 57 (1-120 karakter); (b) agen memakai nama yang Anda berikan sekarang.
- Rekomendasi: **(a)**, sama seperti nama organisasi (OI-3).
- Konsekuensi (a): baris 57 menunggu Anda.
- Konsekuensi (b): nama tertulis di dokumen tugas.
- Baris terdampak: 57.

### I-14 Port lokal forward halaman kamera (96-R12-2)
- Pertanyaan: Port lokal di Mac mana yang dipakai untuk forward halaman kamera?
- Opsi: (a) 18101/18102/18103/18117; (b) port pilihan Anda.
- Rekomendasi: **(a)**, kecuali port itu sudah terpakai di Mac.
- Konsekuensi: hanya memengaruhi perintah SSH forward.
- Baris terdampak: 66-69.

### I-15 Database untuk pemakaian bench (96-R13-1)
- Pertanyaan: Setelah penerimaan, bench dipakai dengan database apa?
- Opsi: (a) tetap `dems_demo` hasil seed; (b) database baru setelah penerimaan.
- Rekomendasi: **(a)**: .73 tetap bench (D1).
- Konsekuensi (a): data demo tetap ada.
- Konsekuensi (b): satu kali jalan Block O dengan aturan `db:reset`, di luar spesifikasi ini. Data demo dan rekaman uji hilang.
- Baris terdampak: 44, 79.

### I-17 Kapan flag no-reboot watchdog dipasang (96-R16-1)
- Pertanyaan: Kapan flag no-reboot watchdog Wi-Fi dipasang?
- Opsi: (a) di baris 123, sebelum Core pertama kali start; (b) segera setelah baris 21.
- Rekomendasi: **(b)**. Ini satu-satunya perubahan urutan baris yang diusulkan.
- Konsekuensi (a): reboot watchdog bisa terjadi saat apt/dpkg, build FFmpeg atau migrasi, dan merusak paket atau DB.
- Konsekuensi (b): jika Wi-Fi macet selama instalasi, host menunggu tombol power Anda.
- Baris terdampak: 21, 123.

### I-18 Rekaman hanya saat Anda di bench (96-R16-2)
- Pertanyaan: Apakah rekaman di bench hanya berjalan saat Anda hadir?
- Opsi: (a) ya, selama Wi-Fi satu-satunya jalur kontrol; (b) rekaman tanpa pengawasan diizinkan.
- Rekomendasi: **(a)**, sampai ada link admin kabel (F4).
- Konsekuensi (a): baris 125-128 dijadwalkan saat Anda hadir.
- Konsekuensi (b): jika Wi-Fi putus, rekaman tidak bisa dikendalikan dari konsol.
- Baris terdampak: 125-128.

### I-19 Rollback instalasi bawaan (96-R16-3)
- Pertanyaan: Jika instalasi harus dibatalkan, rollback mana yang menjadi bawaan?
- Opsi: (a) INSTALL-R-A: profil dan PostgreSQL dicopot, data (`.data`, cluster) disimpan; (b) INSTALL-R-B: purge penuh ke keadaan sebelum instalasi.
- Rekomendasi: **(a)**. INSTALL-R-B hanya atas kata Anda yang terpisah, setelah Anda diberi tahu bahwa `signer/` tidak ada di backup mana pun.
- Konsekuensi (a): bukti dan kunci tetap ada.
- Konsekuensi (b): kunci privat signer musnah, dan bukti yang sudah disegel tidak bisa diverifikasi ulang dengan kunci itu.
- Baris terdampak: 77.

### I-20 Restore Docker (96-R16-4)
- Pertanyaan: Setelah rollback, apakah Docker dipulihkan?
- Opsi: (a) tidak direncanakan; data lama tetap tersimpan, tidak aktif; (b) restore sesuai `03_analysis_impact.md` §7.3.
- Rekomendasi: **(a)**, kecuali Anda memintanya.
- Konsekuensi (a): tidak ada pekerjaan tambahan.
- Konsekuensi (b): INSTALL-R-A harus jalan dulu karena port 4420/4432/5173 sama. Forwarding Docker aktif lagi, sehingga HOST-20/21 tidak lagi terpenuhi.
- Baris terdampak: 77.

## 4. Pemberitahuan (boleh dibatalkan)

Sudah diputuskan, dan dijalankan seperti tertulis kecuali Anda membatalkannya. Cara membatalkan: tulis id-nya dengan opsi lain, misalnya "Q96-07: b".

| Id | Yang sudah diputuskan (oleh) | Alternatif bila dibatalkan, dan konsekuensinya |
|---|---|---|
| Q96-02-M | Mekanisme rilis = bentuk baris 88 (bundle M): op 99 memindahkan MIC pemegang ke input baru; satu MIC per kartu; audit `RELEASED` lalu `REENABLED` (SPEC §2.1) | (b) bundle C: MIC baru mengambil kartu dan MIC lama tetap tercantum sebagai "live" di menu mic. Perlu nama slice baru dan wajib Q96-09 = (b). MAJOR di baris 97 |
| Q96-07 | Eksklusivitas dijaga di service saja, tanpa index DB, tanpa migrasi (baris 88, 91, 94; SPEC X-1) | (b) index DB-A1: set 17 (3 file), 25 file version-pin, down hanya manual, dan cek duplikat sebelum migrasi |
| Q96-10 | Subnet yang tumpang tindih di dua interface selalu ditolak (`SOURCE_INTERFACE_AMBIGUOUS`, O-4) | (b) utamakan interface kamera. Ada risiko egress weak-host. Tidak berdampak di .73 (tidak ada tumpang tindih) |
| Q96-13 | `DISCOVERY_MAX_INTERFACES` tetap 4, interface sumber typed-probe diprobe lebih dulu | (b) dinaikkan / (c) tanpa batas: waktu dan lalu lintas pencarian bertambah |
| Q96-14 | U-RF3 (D12): jawaban multicast hanya diterima di port kamera; di interface lain kamera ditemukan lewat alamat yang diketik | (b) buka ulang U-RF3: HOST-23 dan AC7 berubah, dan port DEMS terbuka di Wi-Fi |
| I-05 (F-S5) | Teks HOST-34 menyebut setelan DB ada di `core.env`; faktanya ada di `<data_dir>/pg.env`. Dicatat sebagai deviasi (baris 11) | (b) tidak dicatat: register deviasi tidak lengkap |
| I-16 (96-R13-2) | PostgreSQL 18.6-1.pgdg24.04+2 dengan `apt-mark hold` (U-RF10, baris 13); `pg.owner.env` hanya ada selama `db:*` berjalan, dan role owner PASSWORD NULL di antara run | (b) 18.4 / (c) file owner disimpan permanen: kredensial owner tinggal di disk. Hanya baris 39 dan 41/44 yang berubah |
| SEC-NPM | `npm ci` dijalankan sebagai root dengan `--ignore-scripts`, lima workspace, cache sekali pakai (`01_specs_security.md:170`) | (b) script install diizinkan: kode pihak ketiga (esbuild dan lainnya) berjalan sebagai root saat install. Bila ada binary yang hilang, baris 27 yang mendeteksi (H5) |

## 5. Baris jawaban siap salin

Setuju semua:

```
Setuju semua rekomendasi Q96-01..Q96-19 dan I-01..I-20, termasuk semua pemberitahuan (Q96-02-M, Q96-07, Q96-10, Q96-13, Q96-14, I-05, I-16, SEC-NPM).
```

Untuk mengganti satu atau beberapa butir, tambahkan di belakangnya. Contoh:

```
Setuju semua rekomendasi Q96-01..Q96-19 dan I-01..I-20, kecuali Q96-02: b; I-09: b.
```

Catatan:
- Kombinasi Q96-02-M: b dengan Q96-09: a tidak sah (SPEC §2.3).
- Q96-16 (a) hanya berlaku jika Q96-04 = (a).
- Q96-06: b atau Q96-05: b membuat baris kamera berhenti setiap kali `enp4s0` link-down (`03_analysis_impact.md:238`).

## 6. Catatan untuk controller

- Jumlah butir instalasi: SPEC §8.4 menyatakan 20 butir, tetapi tabelnya berisi 19 baris. Butir ke-20 di lembar ini adalah F-S5 (`01_specs_service.md` §10), yang tidak ada di §8.4 dan dimasukkan sebagai I-05 (pemberitahuan). SEC-NPM ditambahkan atas brief controller dan tidak memakai id I-xx.
- R14-5 digabung ke I-04 dan R96-11-01 ke I-01, sesuai kolom "Merges" di SPEC.
- Q96-02 dipecah: arti "line" (keputusan, bagian 2) dan mekanisme bundle M (pemberitahuan Q96-02-M, bagian 4), sesuai brief.

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22*
