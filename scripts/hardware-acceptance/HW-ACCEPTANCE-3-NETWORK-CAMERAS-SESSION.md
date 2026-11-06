# DEMS Core: hardware acceptance test package, chapter 3 - network functions, cameras and sessions

**Status of this document: UNVERIFIED on real hardware.** It was written on a development Mac with no Linux host, no camera and no audio interface. No step below has been performed anywhere. Every expected result is a statement of intent taken from the design documents and from results on doubles. When it was first written, the camera relay, the commissioning functions and their screens and the production camera adapter were not built. At Revision 2 the relay, the connection test with its stream half, the adoption and the pairing of relay and worker are built; the commissioning functions (temporary address through the Core, scan, set-address) and their screens are not. A line that could not be settled carries "to confirm" with the row or the check it waits for.

This chapter is read with chapter 1 (`HW-ACCEPTANCE-1-FRAME.md`) for the order, the performers, the sessions S1 to S4, the user actions, the values B-1 to B-7, the result record, the files for the collectors (section 9.5) and the failure rule, and with chapter 2 for the host, the helper and the microphones.

**Revision 2 (2026-10-13)**, the consistency pass (blueprint row 181). Still unverified on a host. Changed in this file:

- `9A/H-10`, `9A/H-23`: the five outcomes of the connection test by their code words; the bounds of the stream-address query (decision C24) and what the technician sees when a camera is outside them; the limits found while building (a colon in the user name, a camera with Basic authentication only, two lenses with one profile code, the plain-number token); what the product's log does and does not state about a test.
- `9A/H-12`, `9A/H-13`: a typed address is refused until the camera interface and subnet are chosen.
- `9A/H-13`, `9A/H-15`, `9A/H-14`: the commissioning functions are not in the tree; each names the rows it waits for.
- `9A/H-17`, `9A/H-22`: the pairing rule as ruled (decisions C34, C35, C37, C40): a missing camera, a refusal by the worker's gate, an arrival that does not pair; the audit list of a session as a file.
- `9A/H-21`, `9A/H-09`, `9A/H-26`: the names of the worker's and the Core's lines confirmed; the five counters of the worker's summing line; a readable file comes from an export; the assumption of the clap collector.
- `9A/H-20`: what is known about HEVC playback (decision C45).
- `9A/H-11`: the relay's re-open rule in numbers; when a camera is given up at once.
- Section 4: points B, C, D and G settled; A re-stated; I added.

**Revision 4 (2026-10-14)**, the document row of wave 12 (Revision 3 touched chapter 1 only). Still unverified on a host: nothing below was run on one, on a camera or on a sound card. Where the status line or a line of Revision 2 above says that the commissioning functions "are not built", read: they are built since, and were shown on doubles only. Changed in this file:

- `9A/H-13`, `9A/H-15`, `9A/H-14`: the commissioning functions as built. The scan states for every device `deviceCount`: `ONE`, `MORE_THAN_ONE` or `NOT_KNOWN`, and as built it is always `NOT_KNOWN`, because the scan cannot count the devices on one address. The procedure is therefore ONE factory-address camera connected at a time (decisions C90, C94 (a), C105). A set-address request carries the hardware address of the scan row (`scannedMac`) and the job refuses another device. `9A/H-15` is rewritten to what the product can show.
- `9A/H-10`: in production a camera is tested and adopted only at an address inside the configured camera subnet (decision C70); the size caps of a camera's ONVIF answers, 16, 64 and 128 KiB, and what to record when a real camera exceeds one (decision C100 (1)); step `.7`, the source address of the Core's requests on a host with two networks (decision C65).
- `9A/H-17`, `9A/H-11`: the same two-network reading during a recording, and with the camera-interface address taken away.
- Section 4: points A and F re-stated; J and K added.


## Ringkasan (Bahasa Indonesia)

Bab 3 berisi 15 pemeriksaan untuk fungsi jaringan, kamera, dan sesi: `9A/H-12`, `9A/H-13`, `9A/H-15`, `9A/H-14`, `9A/H-10`, `9A/H-23`, `9A/H-17`, `9A/H-21`, `9A/H-09`, `9A/H-26`, `9A/H-18`, `9A/H-20`, `9A/H-22`, `9A/H-11`, `9A/H-19`, dalam urutan pelaksanaan bab 1. `9A/H-09` tidak punya rekaman sendiri: pembacaannya diambil dari sesi S1 milik `9A/H-17`, karena produk hanya merekam dari empat sumber yang sudah ditetapkan. Setiap pemeriksaan ditulis dalam enam bagian; arti kegagalan dan baris pengembangan yang dibuka kembali ada di akhir bagian 5.

Hal yang paling menentukan:

- `9A/H-17` (sesi S1) lulus hanya bila sesi dari dua kamera dan dua masukan mikrofon terekam, tersegel, DAN terverifikasi. "Terekam tetapi tidak tersegel" bukan lulus.
- Belum pernah diuji pada perangkat nyata mana pun, termasuk di bangku sistem lama: sambung ulang setelah kabel kamera dicabut (`9A/H-11`), selarasnya gambar dan suara (`9A/H-18`, uji tepuk), dan pergeseran pada sesi panjang (`9A/H-19`). H.265 dari kamera nyata sampai segel, verifikasi, dan pemutaran juga belum terbukti (`9A/H-09`, `9A/H-26`, `9A/H-20`).
- Pemindaian hanya aktif: kamera pabrik pada alamat yang tidak ada di daftar hanya ditemukan bila teknisi mengetik alamatnya dari label kamera (`9A/H-13`). Fungsi pemasangan jaringan hanya untuk peran TEKNISI.
- Kata sandi setiap kamera diganti di halaman kamera sebelum kamera diadopsi (`PREP-13`); wajib bagi kamera yang pernah terdaftar di input-av. Kata sandi hanya diketik di halaman kamera dan di kolom kata sandi konsol web, tidak pernah ke skrip, lembar hasil, atau tangkapan layar.
- Batas yang diketahui: profil kamera dengan token berupa angka saja tidak dapat dipakai; kamera yang tidak hadir saat sesi dimulai tidak masuk ke sesi itu; nama akun kamera yang memuat titik dua tidak dapat diautentikasi; kamera yang hanya menawarkan autentikasi Basic ditolak; kamera yang set parameternya berubah setelah sambung ulang dilepas untuk sisa sesi.
- Revisi 2 (2026-10-13): fungsi komisioning (alamat sementara lewat Core, pemindaian, atur alamat) belum ada di kode; `9A/H-13`, `9A/H-14`, `9A/H-15` menunggu baris pengembangan yang disebut di tiap pemeriksaan. Daftar audit di luar sesi tidak dapat diekspor sebagai berkas; dibaca oleh operator.
- Revisi 4 (2026-10-14): fungsi komisioning kini sudah ada di kode, tetapi baru terbukti pada perangkat tiruan. Pemindaian tidak dapat menghitung jumlah perangkat pada satu alamat (`deviceCount` selalu `NOT_KNOWN`), jadi hanya SATU kamera beralamat pabrik yang boleh tersambung pada satu waktu. Pada operasi produksi, kamera hanya dapat diuji dan diadopsi bila alamatnya berada di dalam subnet kamera; kamera yang masih di alamat pabrik dipindahkan dulu dengan fungsi atur alamat. Permintaan dan sambungan RTSP ke kamera harus keluar dari alamat antarmuka kamera, tidak pernah dari antarmuka kantor (`9A/H-10.7`).

Tidak ada langkah yang dilakukan agen. Tidak ada alamat jaringan nyata, nama orang, gambar, atau suara rekaman yang ditulis ke lembar hasil.

## 1. How this chapter is used

**Form.** Every check has the header line and the six parts of chapter 1, section 8. Part 5 ends with a paragraph "If not met": what the failure means, how it is sorted by chapter 1, section 10, and which development row or decision it reopens.

**Collectors.** As in chapter 2: a `SCRIPT` step names `collect-hNN.sh` in `scripts/hardware-acceptance/`, a read-only collector with a dry mode (`--dry`), writing `hNN-run<k>[-mode].txt` into `<evidence-folder>`. They exist (blueprint rows 128, 129) and have run on the development Mac only. The result line of a check is written by `record-line.sh`: one line per check in the form of chapter 1, section 9.1; it refuses a field that holds an address or a credential form. A collector reads the Core's log, the worker's log, the audit list and a track **from files the user hands over**; chapter 1, section 9.5, says how each file is obtained, and that the audit list outside a session is read by a person because the product exports no file of it. `9A/H-20` has no collector. Where a collector prints "(absent)" for a code or a field, the product does not write it under that name; section 4, point I, lists those places, and the reading is then a person's.

**What a collector of this chapter never does.** It takes no password as an argument, an environment variable or a file. It captures no packets: a capture of the camera network holds the digests of the camera accounts. It prints codes, counts and figures; it prints no stream address, no account name, no frame and no sound. A search for a secret is always the count-only scan of the product (`scripts/secret-scan/count-only.mjs`), which looks for the form of a camera credential and of an ingest secret and prints a number.

**Screenshots** are not part of the record. If the user takes one for a finding, it is taken with every password field empty and the reveal control off.

**Placeholders** are those of the host profile and of chapter 2. Cameras are named by the labels of `PREP-03` (`CAM-A`, `CAM-B`, and `CAM-N` for the factory-new camera). The one literal address is `203.0.113.10`, from a range reserved for documentation.

**The lock-out guard.** The Core counts refused camera credentials per camera address; after two refusals it blocks further attempts on that address for 30 minutes. No step of this chapter types a wrong password on purpose. A password that is refused is recorded and the cause is found before a second attempt.

## 2. The checks

### 9A/H-12  Camera search on the real network; a typed address yields a candidate

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: none   User actions: UA-2

**1. What it proves.** The Core's camera search gets answers through the host's firewall on the dedicated camera port, and a camera whose address the technician types is found from its probe answer alone. It belongs to the camera search and its typed-address probe.
On doubles: a hand-written test camera on the loopback interface; no firewall was in the path. On the bench of the earlier system the firewall blocked incoming multicast and the search was only tested inside the program. The rule of the host profile (`HOST-23`) differs from the earlier system's rule and has never met a camera.

**2. Precondition.** `9A/H-16` passed. At least one camera (`CAM-A`) is on the camera subnet and powered. For steps `.3` and `.4` the camera interface and the camera subnet are chosen in the commissioning settings (`9A/H-05.6`): until the Core knows them, every typed address is refused (the destination rule answers `NOT_CONFIGURED`), and steps `.3` and `.4` are then "not run: camera interface not configured". The signed-in person holds the permission of the camera search; the function is in the web console only.

**3. Steps.**
- `9A/H-12.1` `USER`, terminal: `sudo ufw status numbered`.
- `9A/H-12.2` `TECH`, web console, camera search: run the search with no typed address. Read the candidates.
- `9A/H-12.3` `TECH`, web console: run the search with the address of `CAM-B` (or of `CAM-A` if there is one camera) typed into the address field. Read the candidates.
- `9A/H-12.4` `TECH`, web console: type `203.0.113.10` into the address field and run the search.
- `9A/H-12.5` `SCRIPT` `collect-h12.sh` with the note file of chapter 1, section 9.5: from the audit list, the count of entries `CAPTURE_DISCOVERY_SEARCHED` with the scope `CAMERA_NETWORK` since step `.2`; from the Core's log, the count of candidates each search returned and any refusal code. No address is printed.

**4. Expected result.**
- `.1` one rule admits UDP from source port 3702 on `<camera-interface>`; no rule opens the Core's own ports.
- `.2` at least 1 candidate, each a camera on the camera subnet.
- `.3` exactly 1 candidate for the typed address.
- `.4` the address is refused, in the form or by the operation, with a message that names the address rule (private ranges only); no candidate. Inside the Core the rule's word for this address is `PUBLIC_ADDRESS`; that word is not shown to the client and is not expected in the log.
- `.5` 2 or 3 search entries (whether a refused address writes one is recorded as seen); candidate counts as read on the screen.

**5. Pass criterion.** Candidates from the search without a typed address: at least 1. Candidate from the typed address: 1. The address outside the private ranges refused: 1 of 1. Whether the rule of `HOST-23` alone sufficed is recorded as yes or no: "yes" when step `.2` meets its criterion with only that rule in the firewall.
If the search of step `.2` finds nothing while step `.3` finds the camera, the check is `FAIL` and `9A/H-17` can still be reached through the typed address; chapter 1 allows either way of finding a camera.
If not met: no candidate at step `.2` is first a product finding against the host profile's firewall rule (row 76, `HOST-23`; its own text marks the rule as to confirm here), not a reason to open the firewall by hand. No candidate at step `.3` with the camera powered and reachable by `ping` from the host: product, the typed-address probe (row 96) and the destination rule (row 95). A candidate for `203.0.113.10`, or a packet sent to it: product, row 95 (requirement S13-11).

**6. What to record.** The three candidate counts; "rule alone sufficed: yes or no"; the refusal of `.4`; the entry count. Not recorded: an address, a camera's serial number.

### 9A/H-13  The factory-address scan finds a factory-new camera plugged in alone

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: none   User actions: UA-2, UA-3, UA-5

**1. What it proves.** A technician reaches a factory-new camera on its factory subnet through a temporary address of the host and finds it with the commissioning scan. It belongs to the commissioning scan and the lifecycle of the temporary address.
On doubles: the scan against a scripted device and a helper stand-in. Not shown: a real camera on a factory address; probe answers from a factory subnet through the firewall.
**The scan is active only** (the user's ruling U9: no passive monitor, no packet capture). It asks the addresses of a stored list and one address a technician types. A camera whose factory address is not in the list is found only when its address is typed. On the bench of the earlier system three cameras sat on factory addresses that were not in the default list.

**2. Precondition.** The commissioning scan, the Core's temporary address and their screen are built since Revision 2 and were shown against a scripted device and a stand-in for the helper only (to confirm in 9A/H-13.2: the words of the commissioning screen on the host). On a host without the address helper the scan answers `409 COMMISSIONING_NOT_AVAILABLE` and this check is "not run: helper not installed". `9A/H-05`, `9A/H-25` and `9A/H-06` passed. A typed address is accepted only when the camera interface and subnet are chosen (`9A/H-05.6`). `CAM-N`, a factory-new or factory-reset camera, is the only device on the camera switch that sits on a factory address. **This is a rule of the procedure, not only of this check (decisions C90, C94 (a)): ONE factory-address camera is connected at a time.** Factory-new cameras of one model share one default address, and the scan cannot count how many devices answer on it; with two connected, the Core could not tell them apart. If its model must be activated before it answers (item `HOST-48`), `USER` activates it in the camera's own page from a laptop on the camera switch or from a browser on the host while a temporary address is in place; the web console does not relay a camera's page. The signed-in person is a technician: the commissioning functions belong to that role alone (ruling U10). No session is open.

**3. Steps.**
- `9A/H-13.1` `OPER`, web console, signed in as a supervisor who is not a technician: look for the commissioning screen.
- `9A/H-13.2` `TECH`, web console, commissioning screen: run the scan with the stored list.
- `9A/H-13.3` Only if step `.2` does not list `CAM-N`: `BENCH` reads the factory address from the camera's label; `TECH` types it into the scan's address field and runs the scan again.
- `9A/H-13.4` `SCRIPT` `collect-h13.sh --state`, after the scan has ended: the count of addresses on `<camera-interface>`; the count of mark files of the helper.
- `9A/H-13.5` `TECH`, web console: open the device list.
- `9A/H-13.6` `SCRIPT` `collect-h13.sh --audit`: the count of entries `CAMERA_FACTORY_SCANNED`, `HOST_ALIAS_ADDED` and `HOST_ALIAS_REMOVED` since step `.2`; the count-only scan over the Core's log since step `.2`.

**4. Expected result.**
- `.1` the screen is absent for that role; the functions cannot be reached.
- `.2` the scan runs; while it runs the screen shows the temporary address in place, one at a time (the helper allows one). `CAM-N` is listed with its factory address and its hardware address, and with what the scan knows of the number of devices at that address, the member `deviceCount` of the scan row: one of `ONE`, `MORE_THAN_ONE`, `NOT_KNOWN`. **As built it is `NOT_KNOWN` for every device**: the scan asks one address and is answered by the one hardware address the host's neighbour table holds, so it cannot count. `NOT_KNOWN` is never shown as "one device" or as "no conflict" (to confirm in 9A/H-13.2: the words the screen uses for `NOT_KNOWN`). The hardware address shown here is the one a set-address request must carry (`9A/H-14`).
- `.3` `CAM-N` is listed.
- `.4` 1 address on the camera port and 0 mark files: the scan removed what it added.
- `.5` `CAM-N` is not in the device list: a device that is not adopted is stored nowhere.
- `.6` 1 scan entry per scan run; added and removed entries in equal number; count-only scan: 0.

**5. Pass criterion.** `CAM-N` found: 1 of 1, and by which way is recorded ("stored list" or "typed address"). Scan entries: 1 per scan. Temporary addresses left after the scan: 0. The role without the permission reaches the function: 0 of 1. Rows stored for the camera that is not adopted: 0.
If not met: not found by either way with the camera powered: first check the label's address and the activation (installation). Then product: the scan (row 107), the temporary address (rows 105, 106), the firewall rule for answers from a factory subnet (`HOST-23`, row 76). A temporary address left behind: product, row 106; `USER` removes it with the removal step of chapter 4. The function reachable by another role: product, the commissioning permission (row 100) and ruling U10.
"Found only by the typed address" is a pass, and the model's factory address is a candidate for the stored list, which the technician extends in the commissioning settings.

**6. What to record.** The way it was found; the model name of `CAM-N` (the per-camera sheet); the counts of criterion 2 to 5; the word of `deviceCount` the scan row showed. Not recorded: the factory address, the hardware address.

### 9A/H-15  Two cameras on one factory address: reported, set-address refused, neither changed

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: none   User actions: UA-2, UA-5

**1. What it proves.** When two devices answer on one factory address, no camera is changed by a request meant for another. It belongs to the scan's statement of the device count and to the set-address job (experiment E-15).
**Revision 4: what the product can and cannot show here (decisions C90, C94 (a), C105 (1)).** The check was written for a scan that reports the conflict. The built scan cannot count the devices on one address: it states `deviceCount: NOT_KNOWN` and never "more than one" from its own probe. The protection is therefore of another kind: (a) the scan never states `ONE` for an address it did not count; (b) a set-address request must carry the hardware address of the scan row (`scannedMac`), and the job refuses when the device that answers is another one (`MAC_MISMATCH`), before the typed account is used; (c) the procedure connects ONE factory-address camera at a time. The review ruled that (a) to (c) suffice for the bench only and that the count is built before a real installation. The title of this check is kept because the recording sheet and the contract's step list name it; its first criterion of Revision 2, "conflict reported", cannot be met by the product as built and is replaced below by what can be read. This is stated, not hidden: in the summary of chapter 1 the line of this check carries the note "the scan does not count".
On doubles: a scan result with two endpoints on one address blocked the job (`CAMERA_ADDRESS_CONFLICT`), and a job whose device reported another hardware address was refused. Not shown: two real cameras.

**2. Precondition.** The set-address job and its screens are built since Revision 2 and were shown against a scripted device only (to confirm in 9A/H-15.2: the words of the set-address dialog). `9A/H-13` passed. `BENCH` plugs a second camera that holds the same factory address as `CAM-N` into the camera switch (UA-2). This check comes before `9A/H-14`, which moves `CAM-N` away. If no second camera with that address exists, the check is `NOT RUN: UA-2, second camera`.

**3. Steps.**
- `9A/H-15.1` `TECH`, web console, commissioning screen: run the scan (with the typed address if `9A/H-13` needed it).
- `9A/H-15.2` `TECH`, web console: attempt to set the address of the listed device. **Type no password**, whatever the screen offers.
- `9A/H-15.3` `BENCH`: unplug the second camera. `TECH`: run the scan. Then `BENCH` swaps the two cameras (plugs the second, unplugs `CAM-N`); `TECH` runs the scan again. `BENCH` restores `CAM-N` alone.
- `9A/H-15.4` `SCRIPT` `collect-h15.sh`: the count of entries `CAMERA_NETWORK_SET` since step `.1`; the count of addresses on `<camera-interface>` after the last scan.

**4. Expected result.**
- `.1` one scan row for that address, with ONE hardware address (the one the host's neighbour table holds at that instant) and `deviceCount: NOT_KNOWN`. A row that says `ONE` with two cameras connected is the fault this check looks for. A row that says `MORE_THAN_ONE` would mean the count was built; it is recorded as seen.
- `.2` **no password is typed, so no job runs.** What is read is the dialog before any typing: it shows the hardware address of the scan row and the target address, and it does not present the address as holding one device. With `MORE_THAN_ONE` the job is refused with the reason `CAMERA_ADDRESS_CONFLICT` before a password field is offered. With `NOT_KNOWN` the dialog may offer the password field: nothing is typed and that is recorded (to confirm in 9A/H-15.2: what the dialog shows for `NOT_KNOWN`). Had a job been started, it would have gone on only bound to the scanned hardware address and would have ended `MAC_MISMATCH` if the other camera answered; that path is not provoked on two real cameras.
- `.3` each camera, alone, is found on the unchanged factory address with its own hardware address: 2 of 2.
- `.4` entries `CAMERA_NETWORK_SET`: 0; 1 address on the camera port.

**5. Pass criterion.** The scan row does not state `ONE` while two cameras answer on the address: 1 of 1 (the word seen, `NOT_KNOWN` or `MORE_THAN_ONE`, is recorded). No set-address job started: 0 jobs, 0 entries `CAMERA_NETWORK_SET`. Cameras changed: 0 of 2. "Conflict reported" is recorded as yes or no; "no" with `NOT_KNOWN` is the stated limit of Revision 4 and does not fail the check.
If not met: product. A scan row that states `ONE` here, or a job that proceeds without the hardware address of the scan row, reopens the scan's statement (row 107; caution R119-03) and the binding of the job (row 111; caution R119-04). A camera that changed is not undone by the Core: `USER` resets it by the camera's own means. `9A/H-14` is not started until this check is a `PASS` or its failure is understood.

**6. What to record.** The word of `deviceCount`; "conflict reported: yes or no"; the counts of jobs, entries and cameras changed; whether a password field was offered at step `.2`. Not recorded: any address.

### 9A/H-14  The camera's address set from the console; found again by its hardware address

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: none   User actions: UA-2, UA-4, UA-5

**1. What it proves.** A technician moves a factory-new camera from its factory address to an address of the camera subnet, typing the camera's account for that one action, and the Core finds the same device at the new address by its hardware address (experiment E-14). The network address is the only setting of a camera the Core ever changes.
On doubles: the job against a scripted device on a fake clock. Not shown: a real camera, its restart, the wait.

**2. Precondition.** As for `9A/H-15`: the job is built and was shown against a scripted device only. `9A/H-13` and `9A/H-15` done; `CAM-N` is **alone** on its factory address (one factory-address camera at a time: with the scan stating `NOT_KNOWN`, this and the hardware address are all that keep the request on the right camera); no session is open. The scan of step `.1` is made in this check and is not older than 10 minutes when the job is started: an older scan is refused (`CAMERA_SCAN_TOO_OLD`), and so is a host clock that went back since the scan. `USER`, or `TECH` at the user's direction, knows the camera's factory or activation account. The fixed bound: the camera answers at its new address with the same hardware address inside 180 s.

**3. Steps.**
- `9A/H-14.1` `TECH`, web console, commissioning screen: run the scan; choose `CAM-N`; open the set-address dialog. Read what it shows before any password is typed.
- `9A/H-14.2` `USER` (or `TECH` at the user's direction), web console: type the camera's account name and password into the dialog's fields; start the job; note the host clock.
- `9A/H-14.3` `TECH`, web console: watch the job until it ends; read its result and the elapsed time it states.
- `9A/H-14.4` `SCRIPT` `collect-h14.sh --state`, given the camera's hardware address in a file that `USER` writes into `<evidence-folder>` from the dialog of step `.1` and deletes after the step (the collector prints "yes" or "no", never the address): the count of addresses on `<camera-interface>`; the count of mark files; whether the host's neighbour table holds the camera's hardware address at an address of the camera subnet (it prints "yes" or "no").
- `9A/H-14.5` `SCRIPT` `collect-h14.sh --audit`: the count of entries `CAMERA_NETWORK_SET` since step `.1`; the count-only scan over the Core's log, the error log and the audit details since step `.1`.
- `9A/H-14.6` `TECH`, web console: open the device list; then open the set-address dialog again and read the password field.

**4. Expected result.**
- `.1` the dialog shows the target address (the next free address of the camera subnet) and the hardware address of the scan row. The password field is empty. **That hardware address is part of the request** (the member `scannedMac`, required since decision C105 (2)): the technician confirms the device that was SEEN, and the job is bound to it. A scan row without a hardware address cannot be used to start a job (`CAMERA_HARDWARE_ADDRESS_NOT_BOUND`); the same refusal comes when the address of the request is not the one the last scan showed. `BENCH` compares the hardware address in the dialog with the label of `CAM-N` by eye: equal, 1 of 1.
- `.2` before the typed account is used, the job reads the host's neighbour table for the factory address: another hardware address than the scanned one, or none, ends the job with `MAC_MISMATCH` and the password is not sent. After the authentication the device reports its own hardware address; it equals the one of step `.1`, and a difference ends the job with the same word. A new address at which something already answers is refused (`CAMERA_NEW_ADDRESS_IN_USE`): the Core asks with one echo and the neighbour table, and an answer it cannot read counts as "in use".
- `.3` the job ends "found": the same hardware address answers at the new address, inside 180 s. If the camera restarts, the wait includes its restart.
- `.4` 1 address on the camera port, 0 mark files, "yes".
- `.5` 2 entries `CAMERA_NETWORK_SET` for the change, one when the change is requested and one when the job ends (read from the product's audit rules: the entry has a member `phase`), so that a Core that dies during the wait leaves a trace; the entry also states the `deviceCount` the scan knew, here `NOT_KNOWN`. Count-only scan: 0.
- `.6` `CAM-N` is not yet in the device list: adoption is a separate step (`9A/H-10`). The password field is empty.

**5. Pass criterion.** Same hardware address at the new address inside 180 s: the measured seconds are recorded. Audit entries for the change: 2, one per phase (at least 1; the count seen is recorded). Occurrences of a credential form in the log, the error log and the audit details: 0. Temporary addresses left: 0. The password field is not pre-filled: 2 of 2 readings.
If not met: not found inside 180 s: read the camera's own page from a laptop on the switch to see which address it holds. If it holds the new address and answers there, product: the wait by hardware address (row 111, hypothesis H-T). If it holds the old one, the camera refused the request: product for the four network calls (row 110) or a property of the model, recorded with the model name. A credential occurrence above 0 is a security finding: product, rows 110, 111, 113; the run of the commissioning functions stops and the camera's password is changed. A camera that was moved is not moved back by the Core.
After a pass: `PREP-13` for `CAM-N` (password replaced in the camera's own page, clock set, sheet line filled), then `9A/H-10` if it is to be one of the two cameras of the sessions.

**6. What to record.** Seconds to "found"; whether the camera restarted; the counts of criterion 2 to 5; the model name. Not recorded: the old or the new address, the hardware address, the account name.

### 9A/H-10  The connect flow with real profile tokens; a profile assigned to a slot

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: none   User actions: UA-2, UA-4, UA-9, UA-10

**1. What it proves.** A real camera authenticates in the Core's connect flow, its profiles are listed one per video source with the largest picture first, its codec is judged from the stream and not from what the camera says about itself, and a profile is adopted and assigned to a slot although the camera's own profile token does not have the form of the Core's profile codes (finding F-DB-1; experiment E-3). It carries two points of decision C24: a camera whose stream address has a query is located, and the known limit of a token made of digits only.
On doubles: a hand-written test camera and a scripted device, with tokens of every form. Not shown: any real token, any real stream address, a camera with two lenses.

**2. Precondition.** `9A/H-16` passed; the camera is on the camera subnet and was found by one of the two ways of `9A/H-12`. **In production the camera network must be configured first, and the camera must sit inside it (Revision 4; decision C70):** the camera interface and the camera subnet are chosen (`9A/H-05.6`), and the camera's address lies in that subnet. A production Core tests and adopts a camera only there: the test and its stream half are bound to the camera-interface address. A camera that is still on its FACTORY address outside the camera subnet is refused with `409 CANDIDATE_NOT_TESTABLE`, whatever its password, and so is every camera while no camera network is configured. It is brought into the subnet first, with the set-address function (`9A/H-13`, `9A/H-14`) or in its own page; nothing is wrong with the camera. For step `.7` the host has joined the room network (`PREP-11`), so that it holds two networks. **`PREP-13` is complete for this camera:** its password was replaced in the camera's own page before this check, its clock is set, its line of the per-camera sheet is filled. This holds for every camera, and without exception for one that was ever registered in input-av, whose old password lies in that system's database in readable form; "not known" counts as "yes". A camera without a complete line is not connected. The check is done once per camera of the sessions (`CAM-A`, `CAM-B`), each with its own result line. The fixed bound: the connection test stays inside 15,000 ms. The account's user name holds no colon and the camera answers the stream with Digest authentication (`PREP-13` step 2).

**3. Steps.**
- `9A/H-10.1` `USER`, camera's own page: read how the camera states its stream address (its documentation or its page shows the form). Note only: "the stream address carries a query: yes or no", and the codec the main stream is set to.
- `9A/H-10.2` `TECH`, web console, camera search: choose the camera's candidate; open the connect flow.
- `9A/H-10.3` `USER` (or `TECH` at the user's direction), web console: type the account name and the new password into the fields of the connect flow; start the test; note the host clock.
- `9A/H-10.4` `TECH`, web console: read the outcome, the time it took and the listed profiles.
- `9A/H-10.5` `TECH`, web console: adopt the camera; assign its first listed profile to a video slot of the selector (`CAM-A` to the first, `CAM-B` to the second).
- `9A/H-10.6` `SCRIPT` `collect-h10.sh --camera <label>`, with the Core's journal as a file and the note file of the audit list (chapter 1, section 9.5). What the product states about a test, as built: one log line with the code `CAPTURE_CONNECTION_TESTED` and the members `outcome`, `authenticated`, `testReason` (a code word or nothing) and `judgedStreams` (a count); the audit entries `CAPTURE_CONNECTION_TESTED`, `CAPTURE_CANDIDATE_ADOPTED`, `CAPTURE_CREDENTIAL_SET` and `CAPTURE_CONFIG_CHANGED`. It states no duration and nothing about a camera-side token. So: the duration is the difference of the two clock readings of steps `.3` and `.4`, by `USER`; the profile codes, codecs and picture sizes are read from the screen by `TECH`; the three yes-or-no facts about the token ("has a character outside the code form", "is digits only", "is listed") are read by `USER` from the camera's own page or documentation where it shows the profile token, and are otherwise recorded "not read". The count-only scan over the Core's log and error log since step `.2`. Nothing prints a token, an address or an account name.
- `9A/H-10.7` `USER`, terminal, with `TECH` at the web console: **the source address of the Core's traffic to the camera, on a host with two networks** (decision C65; requirement of the destination rule, its source half). The camera is adopted (step `.5`). `<office-interface>` is the port of the default route (`ip -4 route show default`). No collector does this step: a capture is the user's act, it prints packet headers only and writes no file (no `-w`, no `-A`, no `-X`: a stored capture of the camera network would hold the digests of the camera account).
  - (a) in a second terminal: `sudo timeout 60 tcpdump -n -q -i <office-interface> host <address of the camera> 2>/dev/null | wc -l`; while it runs, `TECH` runs the connection test of the adopted camera, which uses the stored account (to confirm in 9A/H-10.7: where the web console offers the test of an adopted camera; if it offers none, this reading is taken during the test of step `.3`, before the adoption, which a production Core binds in the same way).
  - (b) during the same test, in a third terminal: `sudo ss -H -tn dst <address of the camera>` repeated a few times; read the local address of each line.
  - (c) repeat (a) for 30 s without a test, with the adopted camera assigned to its slot: the Core reads the clock of a camera it watches about every 3 s, and that read is a request to the camera too.

**4. Expected result.**
- `.4` the outcome is `REACHABLE`, inside 15,000 ms. One profile per video source, the largest picture first. For a camera set to H.265 the listed codec is HEVC, also when the camera reports H264 about itself (the four bench cameras of the earlier system did). The five outcomes of a test and what each means here:

  | Outcome | Reason word | What the technician sees, and what it means |
  |---|---|---|
  | `REACHABLE` | - | the profile list; the camera can be adopted |
  | `AUTHENTICATION_FAILED` | none | the camera refused the account. Counted by the lock-out guard |
  | `AUTHENTICATION_FAILED` | `SCHEME_NOT_ALLOWED` | the camera offers only Basic authentication for its stream. The password was **not** sent, and the lock-out guard does not count it. Set the camera to Digest in its own page; a camera that cannot is not usable |
  | `WRONG_PROFILE` | `STREAM_LOCATOR_FORM` | the camera's stream address is outside the closed rule below; the camera is refused |
  | `NOT_H264` | `NO_H264_PROFILE`, `STREAM_CODEC_NOT_USABLE` | the stream is neither H.264 nor HEVC (the screen says "Neither H.264 nor HEVC") |
  | `UNREACHABLE` | - | no answer inside the bound |

  **The closed rule for a stream address with a query (decision C24, as built).** The address is at most 256 characters in all. A query is allowed with at most 128 characters and at most 8 parameters, each name at most 32 and each value at most 64 characters, from a closed character set, **without percent-encoding**, and with no parameter whose name looks like a credential (`user`, `username`, `pass`, `password`, `pwd`, `auth`, `token`, `key`, `secret`, `session`, in any case). A user part in the address is always refused. A camera whose address passes is "reachable" as any other. A camera outside the rule shows `WRONG_PROFILE` with `STREAM_LOCATOR_FORM`: it cannot be adopted by this product version, whatever its password, and a second attempt changes nothing.
- `.5` the camera appears in the device list as a capture device; the selector shows the slot as assigned to its profile code, for example `HEVC_1080P`.
- `.6` at least 1 profile; for a real camera the token usually has a character outside the code form ("yes"), and the profile was assigned all the same. Count-only scan: 0.
- `.7` (a) `0`: no packet to the camera's address left by the office interface during the test. (b) every line has `<camera-address>`, the host's own address on the camera port, as its local address: the ONVIF requests and the RTSP connection of the test leave from the camera interface. (c) `0` again: the watch's clock read is bound the same way (to confirm in 9A/H-10.7: that `tcpdump` is on the host, it is no item of the host profile; and the form of its summary lines, of which only the count is used). This was shown on the loopback interface only: an address the host does not hold gave 0 connections and 0 requests at the test camera. A real second interface was never in the path.

**Known limits, stated here because this is where cameras are adopted.**
- **The size of a camera's ONVIF answers (Revision 4; decision C100 (1)).** The Core reads each answer of a camera up to a cap fitted to what that answer needs, and refuses a longer one: 16 KiB for the clock, the stream address and the three answers of the set-address job; 64 KiB for the services, the capabilities and the network interfaces; 128 KiB for the profile list (read to 16 profiles). The total of one exchange stays at 1 MiB. **The caps were fitted to the answers of the development's stand-in (360 to 3,635 bytes); the size of a real camera's answers is not known.** A real camera with long answers, most likely a long profile list, would be refused by size although nothing is wrong with it. That is a FINDING TO RECORD, not an installation fault and not a reason to try again: the model name, which answer (the step of the flow at which the test ended) and the fact "refused by size" go to the development, which re-fits the cap. How such a refusal reaches the technician is to confirm in 9A/H-10.4: the outcome word of the test and the line of the Core's log were not read for this case (the reply guard's own word is `OVERSIZED`).
- **A plain-number profile token (decision C24).** The ONVIF library the Core uses reads a profile token that consists of digits only (for example `1`) as a number, and such a profile is not usable: it is not listed. A token with a leading zero stays text. If every profile of a camera has a digits-only token, that camera cannot be adopted by this product version. The fix (reading the token from the raw answer) is not built.
- **A colon in the account's user name.** Such an account cannot authenticate on the stream; the outcome is `AUTHENTICATION_FAILED` for a correct password, and it is counted by the lock-out guard. Use an account whose name has no colon (`PREP-13`).
- **A camera that offers only Basic authentication** is refused, as the table says.
- **Two lenses with one profile code.** A camera with several video sources is adopted with one main stream per lens. If two lenses give the same profile code (same codec and picture size), the adoption is refused (`CAPTURE_ADOPTION_PROFILE_INVALID`): both cannot be stored. A camera with several lenses was never tried, on doubles or on a device.

**5. Pass criterion.** Per camera, all of:
1. outcome "reachable" inside 15,000 ms (the measured milliseconds are recorded);
2. profiles listed: at least 1 per video source of the camera, largest picture first;
3. the codec listed equals the codec the camera's main stream is set to (step `.1`);
4. a profile adopted and assigned to its slot: 1 of 1; if its token has a character outside the code form, that is recorded as "exercised", otherwise "not exercised on this camera";
5. occurrences of a credential form in any log: 0;
6. the stream-address query (C24): "located with a query", "no query on this camera", or "refused `STREAM_LOCATOR_FORM`"; the first two meet the criterion. For a refused camera `USER` notes which bound its address breaks (total length, query length, number of parameters, a name, a value, percent-encoding, a credential-like name), by kind only.
7. on a host with two networks (step `.7`): packets to the camera's address on the office interface: 0 during the test and 0 during the watch; connections to the camera with another local address than `<camera-address>`: 0.

If not met:
- a refusal `409 CANDIDATE_NOT_TESTABLE`: installation, not product. The camera network is not configured (`9A/H-05.6`) or the camera's address lies outside the camera subnet; bring it in and repeat. On a production Core this is the rule, decision C70.
- a camera refused by the size of an answer: the finding of the known limit above; the camera is recorded with its model, another camera takes its place in the sessions, and the caps go back to the development (decision C100 (1)).
- criterion 7 with a packet on the office interface or another local address: product, and a security finding (the camera account's digest would cross the office network): the source half of the destination rule (rows 143b, 143c; decision C65). The camera is not recorded from until it is understood.
- criterion 1 with `AUTHENTICATION_FAILED`: installation first (the password typed is not the one set in `PREP-13`; the user name holds a colon; with `SCHEME_NOT_ALLOWED`, the camera is set to Basic); mind the lock-out guard. With `UNREACHABLE` or a time above the bound on a camera that answers `ping`: product, the ONVIF session and the stream test (rows 26, 50).
- criterion 2 or 3: product, the profile selection (row 26) and the code minted from the stream (rows 50, 51; decision on the notice, design addendum section 7). It leads to `9A/H-26`.
- criterion 4: product, finding F-DB-1: the mapping of code to token at the open (rows 28, 46, 51).
- criterion 6, refused: product, the query rule of row 174 is too narrow for this model. The model name, the fact "refused" and the kind of bound go to the development, never the address.
- an adoption refused with `CAPTURE_ADOPTION_PROFILE_INVALID` on a camera with several lenses: the known limit of two equal profile codes; product, the stored stream rows (row 51).
- a digits-only token: the known limit. The result for that camera is `FAIL` with the reason "known limit C24"; it reopens the fix named in row 26's record (reading the token from the raw answer), which is not built. Another camera takes its place in the sessions.
- criterion 5: a security finding; product; the camera's password is changed again.

**6. What to record.** Per camera: label, model; milliseconds; number of video sources and profiles; codec set against codec listed; the profile code assigned; the three token facts; the query outcome; scan count; "token facts: read from the camera's page" or "not read"; of step `.7` the two packet counts and "local address is the camera port's: yes or no"; a refusal by size with the answer it concerned. The per-camera sheet gets its date of adoption. Not recorded: token, stream address, account name, password.

### 9A/H-23  A camera account whose password has special characters authenticates

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: none here; its log search is repeated after S1   User actions: UA-4, UA-9

**1. What it proves.** The relay writes the account into the request to the camera in an encoded form, and the media library decodes it before it computes the digest (the design's hypothesis HA-7). If that fails, a camera with such a password authenticates in the ONVIF half and is refused on the stream.
On doubles: an account with these characters against the test camera, if the development's closing report says so. Not shown: a real camera's digest.

**2. Precondition.** One camera of the sessions is the camera of rule 4 of B-5: in `PREP-13` its password was set to one that contains each of these five characters, as far as the camera's page accepts them: `@`, `:`, `/`, `%` and one space. The five characters are in the **password**. The account's user name may hold `@`, `/`, `%` and a space, but **no colon** (the known limit of `9A/H-10`). `USER` notes which of the five the camera's page refused, by character, never the password. `9A/H-10` is about to be done, or was done, for that camera with that password.

**3. Steps.**
- `9A/H-23.1` `USER`, note: characters of the five that the password holds: n of 5; which were refused by the camera's page.
- `9A/H-23.2` `TECH` and `USER`, web console: the connect flow of `9A/H-10` for this camera (steps `.2` to `.4` there), with this password.
- `9A/H-23.3` `SCRIPT` `collect-h23.sh --after-test`, with the Core's journal as a file: of the log line `CAPTURE_CONNECTION_TESTED` of this test, the members `outcome`, `authenticated` and `testReason`; the count-only scan over the Core's log and error log. The stream half authenticated when the outcome is `REACHABLE`: the codec of a listed profile is read from the stream.
- `9A/H-23.4` `SCRIPT` `collect-h23.sh --after-session S1`, after S1 is sealed: whether this camera's track of S1 holds video; the count-only scan over the Core's log, the error log, the worker's log of S1, the session's persisted lines and the journal of the Core's unit.

**4. Expected result.**
- `.2`, `.3` "reachable"; the stream half authenticated (the codec was read from the stream); scan: 0.
- `.4` the track holds video; scan: 0 in every place.

**5. Pass criterion.** Authenticated in the connection test: 1 of 1. Recorded in S1: 1 of 1. Occurrences of a credential form: 0 at both searches. Characters exercised: n of 5, recorded; with n = 0 the check is `NOT RUN: the camera accepts none of the characters`.
If not met: authenticated in the ONVIF half and refused on the stream: product, the relay's encoding of the account (rows 41 and 44, hypothesis HA-7; requirement S13-01 stays: the relay answers a digest challenge only). An occurrence above 0: a security finding; product (the relay's log rule, requirement S13-02); the camera's password is changed. If the camera can only be used with a plain password, that is recorded against its model: it bears on the user's acceptance UA-12.

**6. What to record.** n of 5 and the refused characters; the outcome; "recorded in S1" yes or no; the two scan counts. Not recorded: the password or any part of it beyond the list of characters.

### 9A/H-17  S1: one session from two cameras and two microphone inputs, recorded, sealed and verified

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: S1   User actions: UA-2, UA-4, UA-5

**1. What it proves.** The product does the whole of its work on real devices once: a session from four production sources is recorded, sealed and verified on the Linux host. It is the milestone of the package and one of the four checks without which no session from production sources exists.
On doubles: one session from four production-kind doubles on a copy of the database, one of them a generated HEVC stream, sealed and verified with a key made for the test. Not shown: any real source.

**2. Precondition.** `9A/H-27`, `9A/H-01`, `9A/H-16`, `9A/H-07`, `9A/H-08` steps `.1` to `.5`, and `9A/H-10` for two cameras have passed. Before the start `USER` has ready what the collectors of step `.5` need while S1 records: the Core's process id, and a terminal that saves the Core's journal to a file. `PREP-14` is done: four slots assigned, none a generated source; all four must be assigned for a session to start (decision C25). `BENCH` stands where both cameras see the hands and within 1 m of the primary microphone. Planned length: 5 minutes. No real examination is recorded: the content is the bench.

**3. Steps.**
- `9A/H-17.1` `OPER`, web console: open the pre-check of a new session; read it.
- `9A/H-17.2` `OPER`, web console: start the session; note the host clock at the click. This is S1.
- `9A/H-17.3` `BENCH`: keep the room silent for the first 10 s (the first-second reading of `9A/H-08`).
- `9A/H-17.4` `BENCH`: at about 15 s, one clap, hands in view of both cameras; then speak for ten seconds (numbers, not names). Note the host clock at the clap to the second.
- `9A/H-17.5` `SCRIPT`, while S1 records: `collect-h21.sh` and `collect-h09.sh --live` (their checks below); `collect-h08.sh --session S1` (chapter 2); `collect-h17.sh --live`: the processes of the session (the worker, two relays, two microphone helpers; the guard program may appear as the parent of each helper) with owner; the listeners (all on `127.0.0.1`); by `USER` with `sudo`, the modes of the run directory and of the microphone pipes (item `HOST-08`) and the four capability lines of the Core (item `HOST-39`).
- `9A/H-17.5a` `USER`, terminal, while S1 records (the two-network reading of `9A/H-10.7`, now for a recording): for each of the two cameras, `sudo timeout 30 tcpdump -n -q -i <office-interface> host <address of the camera> 2>/dev/null | wc -l`, and once `sudo ss -H -tn dst <address of the camera>`. Headers only, no file written.
- `9A/H-17.6` `TECH`, web console, during S1: open the commissioning screen and attempt a scan.
- `9A/H-17.7` `BENCH`: at about 4 minutes 45 s, a second clap as the first; note the host clock.
- `9A/H-17.8` `OPER`, web console: end the session; wait until its state is shown as sealed; note the host clock.
- `9A/H-17.9` `OPER`, web console: run the verification of the sealed session; read its report.
- `9A/H-17.10` `USER` copies the session's audit extract and saves the Core's journal as chapter 1, section 9.5, states; then `SCRIPT` `collect-h17.sh --sealed S1`: the session's state; the capture operation the session states; its sources (count, kind, and how each is declared); the tracks of the package with their sizes; every notice of the session by its code, with "critical" yes or no; the sync level per camera file (the reading of `9A/H-03`, now in the production operation); the verification result per item; the count of credential reveals the audit list holds for this session; the count-only scan over the Core's log, the error log, the worker's log, the session tables and the journal, for both forms.

**4. Expected result.**
- `.1` no blocking item; both cameras shown as present.
- `.2` the monitor shows the session recording, both pictures live, the level of the primary microphone moving.
- `.5` at least five processes of `<service-user>` (seven when each helper runs under its guard; the count is recorded as seen); no listener on another address than `127.0.0.1`; run directory 0700, pipes 0600, at least 1 pipe; four capability lines ending in sixteen zeros.
- `.5a` per camera `0` packets on the office interface, and one RTSP connection whose local address is `<camera-address>`: the relay binds its connection to the camera-interface address before it connects, and at every re-open. The two counts are recorded with the check; a count above 0 is the security finding of `9A/H-10`, criterion 7, and S1 is not a pass.
- `.6` the scan is refused because a session is open; nothing is added to the camera port.
- `.8` the state goes from recording through sealing to sealed.
- `.9` the verification passes on every item.
- `.10` state sealed; operation `REAL_PRODUCTION`; 4 sources, 2 cameras and 2 microphone inputs, each declared a production device; 2 camera tracks with video and the audio of the primary microphone (the stored form keeps one microphone; the standby input is opened and not stored); notices as they are (the sync-level notice of `9A/H-03`, marked critical here if the level is not full; `STREAM_PROFILE_DIFFERS` is read in `9A/H-26`); reveals: 2 audit entries of the type `CAPTURE_CREDENTIAL_REVEALED`, one per camera; both scans: 0. The Core's log holds one line `CAPTURE_CAMERA_INGEST_PAIRED` per camera and no line `CAPTURE_WORKER_DOWN`. On this Linux host the whole host profile was asked at the start, so the sealed manifest of S1 carries NO member `hostProfileNotAsked` and the verification shows no notice `HOST_PROFILE_NOT_ASKED`; that member exists only in a package sealed by a production Core on a Mac (chapter 1, section 1). `OPER` reads the notices of the verification report for it: 0 (to confirm in 9A/H-17.9: that a start on real Linux asks the whole profile and seals without the member; on the development Mac "linux" was only the platform word handed to a test host).

**5. Pass criterion.** Sessions from 4 production sources recorded, sealed **and** verified: 1. In detail, all of:
1. the session reached the state sealed: 1 of 1;
2. the verification passed on every item: failed items 0;
3. sources of the session: 4, of the production kinds, none generated;
4. both camera tracks hold video for the session (frames above 0 in each; `9A/H-09` gives the figures) and the audio is audible (`9A/H-08` step `.8`);
5. occurrences of a credential form and of an ingest-secret form in every searched place: 0;
6. a commissioning action during the session refused: 1 of 1.
"Recorded, not sealed" is not a pass. "Sealed, not verified" is not a pass. A session with one camera is not a pass of this check.

If not met: product, unless a device was unplugged or misassigned (installation; repeat as run 2). By stage, with the words the Core uses (the sentences the operator sees are those of the product's fault wording; the reason word is in the Core's log and in the audit entry):
- The session does not start. With a slot unassigned: the selector rule (decision C25; `CAPTURE_SOURCE_NOT_ASSIGNED`). With all four assigned and the reason `RELAY_REPORTS_NOT_WIRED`: a production start without the relay's report source is refused by design (decision C34), and the tree under acceptance does not wire it; product, the composition of the camera path (rows 43, 44, 46). With `NO_CAMERA_CONNECTED`: no camera at all arrived inside the window; read `9A/H-21`. Otherwise the opens (the production adapters and the session start, rows 46, 47, 67).
- One camera is missing at the start (`CAMERA_NOT_CONNECTED`, `CAMERA_NO_PICTURE`): the session records with the other camera and one warning names the missing one (decision C35 (a)). For this check that is not a pass; read `9A/H-21`.
- A refusal by the worker's gate (`CAMERA_ANNOUNCE_NOT_MATCHED`, `CAMERA_ANNOUNCE_NOT_SEEN`): a **critical fault of that camera**; the capture goes on with the other one (decision C40), and nothing foreign was recorded. On a host with the loopback rule this means the product's own relay announced a wrong address, or the announce line was not seen: product, the worker's gate (`9A/H-01`, criterion 4).
- An arrival that was accepted and does not pair (`CAMERA_INGEST_NOT_PAIRED`): a worker connect report without the relay's report, a second connect report on a port, or a contradiction. **The capture is ended**, one critical notice and one audit entry state the cause, and nothing of that attempt counts as a recording of that camera (decision C35 (b)). It is an integrity fault: record it, do not repeat the session before the cause is known; product, the pairing rule (row 48).
- A relay report for an attempt the Core itself replaced after a worker restart is not a fault: it is dropped with the log line `CAPTURE_RELAY_REPORT_SUPERSEDED` and counted in `CAPTURE_RELAY_REPORTS_SUPERSEDED_TOTAL` (decision C37). Its count is recorded.
- The worker was restarted inside the session (`CAPTURE_WORKER_DOWN`): the audio after the restart is silence (the known limit of chapter 2, `9A/H-08`, until row 191); the session is not a pass of criterion 4.
- Not sealed or not verified: the sealing host on a production session, first exercised on doubles by row 89.
In every case the lift of the production kinds (row 88) stays what it is, a state of the code: nothing is declared, and the ruling of chapter 1, section 11, is made knowing this line.

**6. What to record.** The clock at start, at both claps and at the end; the state; failed verification items (count); sources (count and kinds); notices by code with "critical"; reveals; the two scan counts; the session's identifier in the product. Not recorded: a frame, a sound, a word spoken, the content of the room.

### 9A/H-21  Time from the start of S1 to both camera ingests connected

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: read from S1   User actions: -

**1. What it proves.** Real cameras reach "connected" inside the window the production operation gives them, 30 s, when both are opened in the same turn (the design's hypothesis HA-8, which only hardware can settle).
On doubles: a test camera with a configurable delay, on fake clocks.

**2. Precondition.** S1 was started (`9A/H-17.2`). The fixed bound: 30 s.

**3. Steps.**
- `9A/H-21.1` `SCRIPT` `collect-h21.sh --session S1`, with the worker's log and the Core's journal as files: from the worker's log, the time of `session_starting` and of each `ingest_connected` (its port and codec), and the two differences in milliseconds; the count of camera faults at the start. The collector's figure runs from the worker's start of the session, not from the operator's click, so it leaves out the Core's part. The whole figure is read by `USER` from the Core's journal: from the clock of the click (`9A/H-17.2`) to the line `CAPTURE_CAMERA_INGEST_PAIRED` of each camera, which the Core writes when the relay's report and the worker's connect report are both present. Both figures are recorded; the bound is held against the larger.

**4. Expected result.** Two figures, each below 30,000 ms; 0 camera faults at the start.

**5. Pass criterion.** Both cameras connected inside 30,000 ms, counted from the operator's click to the Core's line `CAPTURE_CAMERA_INGEST_PAIRED`; the larger figure is the measured value.
If not met: a camera that did not connect inside the window is not in S1, and `9A/H-17` is then not a pass. Sort: a camera that needs longer than the window because of a long distance between its keyframes is first an installation question (set the camera's keyframe interval to one second in its own page, repeat S1). If it still fails: product, the window constant and the bounded open (row 47, hypothesis HA-8).

**6. What to record.** The two figures in milliseconds; the keyframe interval each camera is set to.

### 9A/H-09  H.265 through the relay: codec as the stream's, counters, clock offset, decodable file

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: read from S1; no recording of its own   User actions: UA-2, UA-4, UA-10

**1. What it proves.** A real H.265 camera's stream comes through the relay and the worker into a file that decodes: its packetisation, its groups of pictures, its parameter sets as the camera sends them (experiment E-4). The product records only from four assigned sources, so one camera cannot be recorded alone; the readings are taken from S1.
On doubles: generated H.265 streams from an encoder on the same machine, with parameter sets announced and with parameter sets in the stream only: 350 of 350 frames, 0 decode errors, sample entry `hev1`; such a session seals and verifies, and its export verifies (decision C45). Not shown: any real camera; long groups, B-frames, parameter sets that arrive late; sealing, verification and playback of real HEVC material.

**2. Precondition.** `9A/H-17` produced S1. For step `.2` the export of S1 is made first, as chapter 1, section 9.5, states; `9A/H-18`, `9A/H-20.3` and chapter 2, `9A/H-08.7`, use the same export. `USER` noted in `9A/H-10.1` the codec each camera is set to, and set each camera's clock in `PREP-13`. The fixed bound: a camera's clock at most 2,000 ms off the Core's; above 500 ms the operator sees an advisory.

**3. Steps.**
- `9A/H-09.1` `SCRIPT` `collect-h09.sh --live`, during S1, and `--session S1` after it, per camera, with the worker's log and the Core's journal as files. From the worker's log: the line `ingest_connected` (port, codec, width, height, the length of the parameter sets as `extradata`); the count of lines `INGEST_NO_EXTRADATA`; the line `video_anchored` (its `mode` and `shift_us`); the line `keyframe_interval_observed` (`observed_ms`, `bound_ms`, `above_bound`); and the line `camera_summary`, which exists after the session ended: `video_packets`, `fragments`, and its five counters `dropped_no_pts` (no time stamp), `dropped_prestart` (before the start), `retimed` (moved by the monotonic guard), `dropped_prearm` and `dropped_unanchored`. The first three are "the three ingest counters" of the plan; all five are recorded. From the Core's journal: the line `CAPTURE_CLOCK_OFFSET_MEASURED` of each camera (`offsetMs`, `advisoryMs`, `above`). The notice `CAMERA_CLOCK_OFFSET` exists only for a camera above the advisory threshold; the offset of a camera below it is in the measurement line alone.
- `9A/H-09.2` `SCRIPT` `collect-h09.sh --file S1 --track <file>`, after S1 is sealed, per camera file, read-only with the pinned tools, **from the export of S1** (chapter 1, section 9.5; the stored camera file is encrypted and cannot be read directly): the codec and sample entry of the video track; the frame count; the number of error lines of a full decode into nothing.
- `9A/H-09.3` `OPER`, web console monitor during S1: read whether an advisory about a camera's clock is shown.

**4. Expected result.**
- `.1` per camera: codec `hevc` for a camera set to H.265; `INGEST_NO_EXTRADATA`: 0 lines; one `camera_summary` line with `video_packets` above 0; one `CAPTURE_CLOCK_OFFSET_MEASURED` line with an offset of at most 2,000 ms.
- `.2` codec `hevc`, sample entry `hev1`; the frame count equals the worker's count of video packets; decode error lines: 0.
- `.3` an advisory exactly for a camera whose offset is above 500 ms.

**5. Pass criterion.** Per camera, all of: the codec in the connect line equals the codec the camera is set to; `INGEST_NO_EXTRADATA` lines 0; decode errors 0; frames in the file equal the worker's packet count; clock offset at most 2,000 ms (the figure is recorded; an advisory above 500 ms is recorded and is not a fail).
If not met:
- a clock offset above 2,000 ms: installation (UA-10: set the camera's clock, repeat S1). The product does not set a camera's clock. A camera whose clock lies outside the worker's own bound is ended by the worker with the reason `CAMERA_CLOCK_OUT_OF_BOUND` and is then not in S1 at all.
- `INGEST_NO_EXTRADATA`, decode errors, or a frame count that differs: product: the relay's hold-back until parameter sets and a keyframe, and the worker's ingest for HEVC (rows 42 and 43, and the HEVC outcome of the lift, entry condition L-4). **The ruled fallback applies** (chapter 1, section 10, item 6): the installer sets that camera to H.264 in the camera's own page, `9A/H-10` is repeated for it, S1 is repeated, and the record says which codec the passing session used. H.265 support for that model is then a finding for the development, and the summary states it.

**6. What to record.** Per camera: codec set, codec in the connect line, sample entry; packets and frames; the five counters, the first three marked as "the three"; anchoring mode; keyframe interval observed; clock offset in milliseconds and "advisory" yes or no; decode error lines. For the summary: the three counters and the clock offset per camera.

### 9A/H-26  The notice STREAM_PROFILE_DIFFERS is not raised for the H.265 cameras

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: read from S1   User actions: -

**1. What it proves.** The profile code the Core gave a camera at adoption is the stream's own statement, so that the seal's comparison of "configured profile" against "stream as recorded" finds no difference for a camera that delivers H.265 while reporting H264 about itself (the design's hypotheses HA-2 and HA-3). Without this, every production session would carry a notice.
On doubles: two generated streams. Not shown: a real camera's parameter sets.

**2. Precondition.** S1 is sealed. At least one camera of S1 recorded H.265 (`9A/H-09`). If both ran on H.264 by the fallback, the check is `NOT RUN: no H.265 camera in S1`.

**3. Steps.**
- `9A/H-26.1` `OPER`, web console, before S1 is started (or from the capture configuration afterwards): the profile code each video slot of the selector shows. Then `SCRIPT` `collect-h26.sh --session S1` with the worker's log, the Core's journal and the session's audit extract as files: the codec and picture size of each `ingest_connected` line, and the count of notices `STREAM_PROFILE_DIFFERS` of the sealed session. The Core writes no log line that states a slot's profile code or the seal's stream statement, so those two are `OPER`'s readings: the code from the selector, the statement from the verification report of step `.2`.
- `9A/H-26.2` `OPER`, web console: open the verification report of S1 and read its notices.

**4. Expected result.**
- `.1` per H.265 camera the code begins `HEVC_` and the seal's statement equals it or is the code without its rate (for HEVC the Core reads no rate); notices of this type: 0.
- `.2` the report shows no notice of this type.

**5. Pass criterion.** Notices `STREAM_PROFILE_DIFFERS` in S1 for H.265 cameras: 0, in the collector's reading and in the report: 2 of 2 readings.
If not met: product. Reopens the minting of the profile code from the stream (rows 50, 51; design addendum section 7). The sealed rule itself is not edited to fit: the session stays valid with its notice, and the summary states the count.

**6. What to record.** Per camera the code and the seal's statement (they are codes, not secrets); the notice count.

### 9A/H-18  Picture and sound in step: the offset at the first and the last clap of S1

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: read from sealed S1   User actions: UA-5, UA-11

**1. What it proves.** In the stored session the sound of an event lies at the same time as its picture, within the tolerance the user set. Sound comes from a USB interface on the host's clock, pictures from cameras over the network; nothing in the design proves that the two meet.
On doubles: nothing. On the bench of the earlier system the alignment of picture and sound was never measured correctly.

**2. Precondition.** `9A/H-17` passed. The export of S1 exists (made for `9A/H-09.2`). B-1 is set (milliseconds). The measurement reads the picture frame by frame: at 25 frames per second its resolution is 40 ms, so a B-1 below one frame time cannot be decided by this method; the frame time of each camera is recorded. The clap was made within 1 m of the microphone, so the sound's travel adds at most 3 ms.

**3. Steps.**
- `9A/H-18.1` `SCRIPT` `collect-h18.sh --session S1 --clap <host clock of the clap> --start <host clock of the start click> --track <file>`, per camera track and per clap, on the camera files of the export of S1 (chapter 1, section 9.5): the time in the track, in milliseconds, of the sharpest rise of the audio level within 5 s around the given clock time. It prints numbers only. **The collector assumes that the track starts at the start click.** The track starts later, by the time that camera took to connect (`9A/H-21`). That shifts the search window, not the result: sound and picture are read from the same file. If a camera's figure of `9A/H-21` is above 5,000 ms, give `--start` the click time plus that figure, or the clap falls outside the window.
- `9A/H-18.2` `OPER`, web console playback of S1 on the host, per camera and per clap: step the picture frame by frame to the first frame in which the hands touch; read the frame's time in the track.
- `9A/H-18.3` `OPER`, note: offset = time of the sound minus time of the picture, per camera and per clap: 4 values. A positive value means the sound is late.

**4. Expected result.** Four offsets of small magnitude; per camera the two are close to each other.

**5. Pass criterion.** The magnitude of the offset is at most B-1 at the first clap and at the last clap, for both cameras: 4 of 4. All four values are recorded with their sign and the frame time.
If not met: product. It reopens the timing choice of the camera path (the relay stamps arrival time and the worker anchors the track; fork F-1 of the design) against the microphone's clock. No row of the development proved it; the finding names the four values and the frame time. A constant offset that is equal at both claps points to a fixed delay; a different one at the two claps is drift and is read again in `9A/H-19`.

**6. What to record.** B-1; four offsets in milliseconds with sign; frame time per camera. Not recorded: a frame or a sound.

### 9A/H-20  Playback of S1 in the web console, on the tablet and from an export

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: sealed S1   User actions: UA-1

**1. What it proves.** Material from real cameras can be played at an operator's desk, or the client says plainly that it cannot. The stored video of an H.265 camera is HEVC with the sample entry `hev1`, which not every browser and player plays (experiment E-8 on real material).
What the development knows (decision C45): on generated HEVC material the reader, the seal, the verification, the web console and the export passed; **the tablet was not measured**; QuickLook on macOS, which is not a client of the product, did not open a `hev1` file, once. No client of the product is known to refuse `hev1`. Whether the worker should write another sample entry (`hvc1`) waits for the tablet measurement (blueprint rows 12 and 57). A receiver who opens an export in an Apple player may therefore see nothing; that is a risk to state when an export is handed over.
On doubles: playback of generated HEVC in the web console; nothing on the tablet; nothing from a real camera.

**2. Precondition.** `9A/H-17` passed. How the tablet and a web console on another machine reach a Core that listens on `127.0.0.1` is settled (open point 4 of chapter 1); if it is not, the tablet line is "not run: no route to the Core" and the check is `NOT RUN`. The clients: the web console in the operator's browser on the operator's machine; the tablet application; an export of S1 opened in the player the site uses.

**3. Steps.**
- `9A/H-20.1` `OPER`, web console in the operator's browser: open S1; play from the first clap for 30 s, each camera.
- `9A/H-20.2` `OPER`, tablet: open S1; play from the first clap for 30 s, each camera.
- `9A/H-20.3` `OPER`, web console: export S1, or take the export already made for `9A/H-09.2` and download it again. Then verify the export with the product's verification and open its video in the site's player; play from the first clap for 30 s.
- `9A/H-20.4` `OPER`, note, per client and camera: one of three words.

**4. Expected result.** Per client and camera one of two outcomes: "plays" (the picture moves and the clap is heard) or "states that it cannot" (the client shows a message that says the material cannot be played here). The export verifies.

**5. Pass criterion.** Clients that give one of the two named outcomes: 3 of 3. A client that fails silently (a black or frozen picture, a spinner without a message for 30 s, or sound without picture and no message) is the third word, "silent", and a `FAIL`. The export verifies: 1 of 1.
For the summary the count of clients that play is stated beside the result; "3 of 3 state that they cannot" is a pass of this check and a plain statement that nobody can watch the recording there.
If not met: product: the client's handling of an unplayable stream (the camera slice and its two clients, rows 53 to 55; the playback package of the design if it is built). The stored form is not changed by this check.

**6. What to record.** Per client: browser or application with version, operating system, and the word per camera; the codec and the sample entry of each camera (from `9A/H-09.2`); "export verifies" yes or no; for the site's player, its name and version, because a player that does not open `hev1` is a finding for row 57.

### 9A/H-22  S2: a camera absent at the start

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: S2   User actions: UA-5

**1. What it proves.** With one camera missing at the start, the session starts with the other after one bound, says so once, and the missing camera is not in the sealed package. It also shows the known limit: a camera absent at the start of a session is not in that session, even when it returns. This is the "missing camera" case of the pairing rule (decision C35 (a)): a degraded start with a warning, not a fault that ends the capture.
On doubles: the three timing cases with a test camera.

**2. Precondition.** `9A/H-17` passed. `BENCH` unplugs the network cable of `CAM-B` at the switch at least 60 s before the start. Planned length: 3 minutes.

**3. Steps.**
- `9A/H-22.1` `OPER`, web console: open the pre-check of a new session; read the item of `CAM-B`.
- `9A/H-22.2` `OPER`, web console: start the session (S2), confirming the warning if one is asked; note the host clock; read the monitor.
- `9A/H-22.3` `BENCH`: 90 s after the start, plug `CAM-B` in again. `OPER`: watch the monitor until the end.
- `9A/H-22.4` `OPER`, web console: end the session; wait for sealed; run the verification.
- `9A/H-22.5` `SCRIPT` `collect-h22.sh --session S2`, with the worker's log, the Core's journal and the audit extract of S2 as files (the collector counts from the worker's `session_starting`, as in `9A/H-21`): the time from the start request to the state recording, in milliseconds; warnings and audit entries that name the absent camera (counts, codes); the tracks of the package with their sizes; the state; failed verification items.

**4. Expected result.**
- `.1` the item of `CAM-B` says the camera does not answer.
- `.2` the session reaches recording with `CAM-A` and the microphones after the open of `CAM-B` has run into its bound; one warning names `CAM-B` as not connected (reason word `CAMERA_NOT_CONNECTED`, or `CAMERA_NO_PICTURE` when a connection came and no picture; neither raises a critical fault, decision C40). No notice with `CAMERA_INGEST_NOT_PAIRED` and none with `CAMERA_ANNOUNCE_NOT_MATCHED` or `CAMERA_ANNOUNCE_NOT_SEEN` appears: those belong to the two other cases of the rule.
- `.3` `CAM-B` does not join S2 after it returns.
- `.4` sealed; the verification passes.
- `.5` 1 warning and 1 audit entry for the absent camera; the package holds the track of `CAM-A` and nothing of `CAM-B`: 0 fragments, no entry for its file.

**5. Pass criterion.** The session started with one camera: 1 of 1. Warnings for the absent camera: 1. Audit entries for it: 1. Material of the absent camera in the package: 0. S2 sealed and verified: 1 of 1. The time to recording is recorded.
If not met: a session that does not start with one camera, or that waits two bounds: product, the parallel bounded open (row 47) and the session scenarios (row 90). Material of `CAM-B` in the package, or `CAM-B` joining silently: product, the pairing rule (row 48). If both cameras are absent the session must not start at all (a failed start with `NO_CAMERA_CONNECTED`); that case is not provoked here. A session that is **ended** here with `CAMERA_INGEST_NOT_PAIRED` means the missing camera was treated as an arrival that does not pair: product, the pairing rule (row 48, decision C35).

**6. What to record.** Milliseconds to recording; the three counts; "joined after return: no"; state; failed items.

### 9A/H-11  S3: a camera's cable unplugged during a recording, then restored

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: S3   User actions: UA-5, UA-11

**1. What it proves.** When a camera's link is lost in the middle of a recording, the fault is raised once, the relay connects again by its rule, the recording continues in the same track after the gap, and the fault is cleared; the other camera and the microphones are not disturbed. **Reconnection after a lost stream was never tested on a physical camera, not on the bench of the earlier system either.**
On doubles: a test camera that drops the connection and resumes in the middle of a group of pictures, on fake clocks.

**2. Precondition.** `9A/H-17` passed. B-4 is set (seconds). On a PoE switch, unplugging the cable also takes the camera's power: the outage is then B-4 plus the camera's start time, and both instants are noted. If the site can cut the link without the power, it says which was done. The relay's rule, read from the built relay: after a loss it tries the camera again 6 times, waiting 2, 2, 4, 8, 16 and 30 s before the tries, so the sixth and last try begins no earlier than 62 s after the loss (later by what the failed tries took, each at most 15 s); the count starts again when a picture is forwarded. A camera that answers none of the six is given up, and a camera whose relay ends is lost for the rest of the session. So B-4 plus the camera's start time must lie below 60 s, or the expected result is that known limit. A camera that restarts after a power cut often needs longer than that: if the site can cut the link without the power, do so, or choose B-4 from the camera's measured start time.
**A camera is given up at once, without a further try,** when the stream that comes back is not the one it announced: another codec, or a parameter set that differs by one byte (for example after the camera's settings were changed, or a firmware that sends other sets after a restart); when its stream address no longer exists; and when it offers only Basic authentication. A 401 answer to a keep-alive that is not marked stale ends that connection to the camera; the relay then opens again by the rule above, and the second refused Digest answer ends the relay. Nobody changes a camera's settings during S3. Planned length: B-4 plus 4 minutes.

**3. Steps.**
- `9A/H-11.1` `OPER`, web console: start the session (S3); wait 60 s.
- `9A/H-11.2` `BENCH`: unplug the cable of `CAM-A` at the switch; note the host clock. After B-4 seconds plug it in; note the host clock.
- `9A/H-11.3` `OPER`, web console monitor: read what it shows for `CAM-A` and for `CAM-B` from the unplugging until `CAM-A`'s picture is back; note the host clock of the return.
- `9A/H-11.4` `OPER`: let the session record 120 s more; end it; wait for sealed; run the verification.
- `9A/H-11.5` `SCRIPT` `collect-h11.sh --session S3 --track <file>`, with the worker's log, the Core's journal, the audit extract of S3 and the camera file of `CAM-A` from the export of S3 (chapter 1, section 9.5). For `CAM-A`: the faults of the camera raised and cleared, with their instants, from the audit extract and the journal; the number of files of its track; the length of the gap in the track in milliseconds (a distance above 1 s between two video packets); decode error lines of a full decode; the count of audit entries `CAPTURE_CREDENTIAL_REVEALED` of the session. For `CAM-B`: faults (count) and gaps (count). The state and the failed verification items. The relay states each loss and each re-open on its own output, as the lines `camera_lost` (with the code of the loss) and `camera_reopened` (with `tries`, `held_back` and `gap_ms`); since Revision 2 the Core reads both lines beside `push_established` and raises and clears the camera's fault from them, but it writes no log line of its own per try, so the instants of the attempts are not in the Core's log (to confirm in 9A/H-11.5: whether the audit extract of S3 states the loss and the re-open with their instants). Where they cannot be read, "attempts" is recorded as "not readable".

**4. Expected result.**
- `.3` `CAM-A` is shown as lost within seconds of the unplugging; `CAM-B` keeps its live picture; after the cable is back and the camera has started, `CAM-A`'s picture returns without any action of the operator.
- `.4` sealed; the verification passes.
- `.5` for `CAM-A`: 1 fault raised, 1 cleared; attempts at the intervals of the relay's rule where they can be read; 1 file for the track with 1 gap whose length equals the outage read in step `.3` within 5 s; decode error lines 0; reveals of the session: 2 (the reconnection reads no credential again). For `CAM-B`: 0 faults, 0 gaps.

**5. Pass criterion.** For the unplugged camera: fault raised 1, cleared 1; files of the track 1; gaps 1; decode errors 0, and by eye the first picture after the gap is a whole picture (a relay that resumed in the middle of a group would show a broken picture that a decode does not always report). For the other camera: faults 0, gaps 0. S3 sealed and verified: 1 of 1. The gap in milliseconds and the outage are recorded.
If the outage exceeded the relay's bound and the camera stayed lost, that is the named second outcome "lost for the rest of the session": the check is `FAIL` for reconnection, with the reason "outage above the relay's bound", and is repeated with a smaller B-4 as run 2.
If not met: product: the relay's reconnection and its hold-back until a keyframe (row 43; design addendum section 5.1; hypothesis HA-1), the fault interval (row 49), and, if the worker does not accept the jump in time, the conditional package for a resumed push. Decode errors after the gap mean the first forwarded picture was not a keyframe. A disturbed second camera is the gravest outcome and reopens the fault isolation of the worker (row 176).

**6. What to record.** B-4; "power cut with the link" yes or no; the camera's start time; the three clock readings; the counts; the gap in milliseconds; the attempts' intervals or "not readable".

**Observation after S3, not a criterion of this check: the camera-interface address taken away (Revision 4; decision C65, the request of row 143b).** Three cases were never met on a real second interface. `USER` performs them only if the site agrees to change the host's camera port for a few minutes; each is recorded as seen, and the port is restored after each (`sudo netplan apply`, then `ip -br -4 addr show dev <camera-interface>` prints `<camera-address>` again). In every case the office-interface count of `9A/H-10.7` (a) runs beside it and is expected to stay `0`.
- (i) The address removed before a start: `sudo ip addr del <camera-address>/24 dev <camera-interface>`; `OPER` attempts a session start. Expected: the cameras are not reached (reason word `CAPTURE_CAMERA_UNREACHABLE` for each; with both cameras absent the start fails with `NO_CAMERA_CONNECTED`), and nothing leaves by the office interface.
- (ii) The address removed WHILE a relay records, in a short session of its own: the relay's re-opens end after its six tries with its exit code 20 (`CAMERA_UNREACHABLE`), the camera is lost for the rest of that session, and nothing leaves by the office interface.
- (iii) THE ONE CASE THAT BINDING AN ADDRESS DOES NOT COVER ON LINUX, to be measured and then ruled: the camera port administratively down with its address still configured (`sudo ip link set <camera-interface> down`) while the default route is on the office interface. A bound socket may then leave by the office interface with the camera-interface address as its source. If the office-interface count is above 0 here, that is a finding for the development with its remedy still open (a reject route for the camera subnet, reverse-path filtering, or the interface by name in the relay's start message); it is recorded and not repaired on the host (to confirm in 9A/H-11: which of the three is seen; none was measured).

### 9A/H-19  S4: the long session, with a clap at its start and its end

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: S4   User actions: UA-5, UA-11

**1. What it proves.** Over a session of the length the site records, sound and picture do not move apart by more than the tolerance (experiment E-9, hypothesis H-J: the clocks of the sound card, the cameras and the host run at slightly different rates), and the host records for that long without a fault.
On doubles: nothing.

**2. Precondition.** `9A/H-17` passed; `9A/H-18` has shown the method. B-2 (milliseconds) and B-3 (minutes) are set. If B-6 is "yes", the guard against a full evidence disk is in place and watched as the header of the record says: the product does not stop a session when the disk fills. The free space of the evidence disk is read before the start. The host does not sleep (item `HOST-29`).

**3. Steps.**
- `9A/H-19.1` `SCRIPT` `collect-h19.sh --before`: free space of the evidence disk; `timedatectl show -p NTPSynchronized --value`.
- `9A/H-19.2` `OPER`: start the session (S4). `BENCH`: silence for 10 s, then one clap as in `9A/H-17.4`; note the host clock.
- `9A/H-19.3` `OPER`: leave the session recording for B-3 minutes. Nobody needs to stay; nothing is changed on the host meanwhile.
- `9A/H-19.4` `BENCH`: 15 s before the end, one clap; note the host clock. `OPER`: end the session; wait for sealed; run the verification.
- `9A/H-19.5` `SCRIPT` `collect-h18.sh --session S4 --clap <clock> --start <clock of the start click> --track <file>` for both claps, on the camera files of the export of S4 (an export of a session of B-3 minutes is as large as the recording: the free space is read first), and `OPER` reads the picture frame of each clap, as in `9A/H-18`. Drift per camera = offset at the last clap minus offset at the first.
- `9A/H-19.6` `SCRIPT` `collect-h19.sh --session S4`: the session's length; faults by code and count; the notices; per camera the count of re-timed packets; the size of the package; free space after; the state and the failed verification items.

**4. Expected result.** The session records for B-3 minutes without a fault, seals and verifies. Two drift values of small magnitude.

**5. Pass criterion.** The magnitude of the drift is at most B-2 for both cameras: 2 of 2. S4 sealed and verified: 1 of 1. Camera and microphone faults during S4: the count is recorded; a fault that ends a track fails the check.
If not met: drift above B-2 with clean recordings: product: the mapping between the clocks (hypothesis H-J); the finding names the two drift values, B-3 and the offsets. A session that does not last: by its fault code, as in `9A/H-17` and `9A/H-11`. A session in whose log `CAPTURE_WORKER_DOWN` occurs has silence for audio after that instant (the known limit until row 191): the last clap is then not heard, the drift cannot be read, and the check is `FAIL` with that reason. A disk that filled: an installation matter and the reason B-6 exists; the session's state is recorded as found.

**6. What to record.** B-2, B-3; four offsets and two drift values in milliseconds; length; faults; re-timed packets; sizes and free space; state; failed items.

## 3. Where the unproven items of the development are covered by this chapter

Each line of the development's list "what stays unproven at the end of track D" that names a check of this chapter:

| Unproven item | Check, and the step that reads it |
|---|---|
| RTSP authentication of a real camera; real profile tokens | `9A/H-10`; recorded through S1 in `9A/H-17` |
| An account with special characters | `9A/H-23` |
| Reconnect after a link loss | `9A/H-11` |
| The time to connect inside the 30 s window | `9A/H-21` |
| A camera absent at start | `9A/H-22` |
| Discovery on the real network | `9A/H-12` |
| H.265 from a real camera: packetisation, long groups, B-frames, late parameter sets, through seal | `9A/H-09`, read inside `9A/H-17` |
| The notice not raised | `9A/H-26` |
| Playback in the operator's browser | `9A/H-20` |
| The scan and the set-address function on a factory-new camera | `9A/H-13`, `9A/H-14` |
| Two cameras on one address | `9A/H-15` |
| Picture and sound in step | `9A/H-18` |
| Drift over a long session | `9A/H-19` |
| The first session from four production sources | `9A/H-17` |
| A real camera whose stream address carries a query; a camera whose profile token is digits only | `9A/H-10` criterion 6 and the known limit; recorded through `9A/H-17` |

What this run may leave unexercised, to be written into the summary when it applies: no camera of the acceptance has a stream address with a query; none has a digits-only token; none has two lenses; none offers Basic authentication only; no account name holds a colon; no camera changed its parameter sets after a reconnect; the interface has no more than two inputs. A line "not exercised: no such device" is not a pass and not a fail.

## 4. Open points of this chapter

| # | Open point | Effect | Settled by |
|---|---|---|---|
| A | Built and confirmed against the code in Revision 2: the relay with its exit codes and report lines, the connection test and its outcomes, the adoption, the pairing rule, the query rule. Built since Revision 2, shown on doubles only (Revision 4): the commissioning functions and their screens (`9A/H-13`, `9A/H-15`, `9A/H-14`). Still open: where the relay's loss and re-open lines reach a log the collector gets (`9A/H-11.5`) | Each place names the check that first meets it on a host | the run itself; the dry run of the package, row 130 |
| B | Settled: the worker's summing line `camera_summary` carries five counters; `dropped_no_pts`, `dropped_prestart` and `retimed` are read as "the three", and `dropped_prearm` and `dropped_unanchored` are recorded beside them | `9A/H-09.1` | - |
| C | Settled: a stored camera file is encrypted; a readable file comes from an export of the session (chapter 1, section 9.5) | `9A/H-09.2`, `9A/H-18.1`, `9A/H-19.5`, `9A/H-11.5`; chapter 2, `9A/H-08.7` | - |
| D | Settled from the built relay: 6 tries per loss after waits of 2, 2, 4, 8, 16 and 30 s; given up at once for a changed stream, a vanished address or Basic authentication | `9A/H-11` precondition | - |
| E | How the tablet reaches a Core on `127.0.0.1` (open point 4 of chapter 1) | `9A/H-20` tablet line | the development |
| F | Re-stated in Revision 4: the scan cannot see a conflict (it states `NOT_KNOWN`), so the question is what the set-address dialog shows for `NOT_KNOWN` and whether it offers a password field | `9A/H-15.2`; nothing is typed there | `9A/H-15` on the host |
| G | Settled: the 14 collectors of this chapter and the record writer exist under these names; they have run on the development Mac only | Their first run on the host is the run itself | the dry run of the package, row 130 |
| H | The clap method has a resolution of one picture frame, and reading the frame is a person's judgement | `9A/H-18`, `9A/H-19`: a B-1 or B-2 below one frame time cannot be decided | the user, when setting B-1 and B-2 |
| I | Settled in Revision 4 for the names: the collectors of this chapter search for the product's own words, each checked against the source. `collect-h10.sh`, `collect-h23.sh`: the line `CAPTURE_CONNECTION_TESTED` with `outcome`, `authenticated`, `testReason`, `judgedStreams`. `collect-h12.sh`: the search line with `trigger`, `outcome`, `responderCount`, `newCount`, `registeredCount`. `collect-h09.sh`: `video_anchored`, `keyframe_interval_observed`, the five counters of `camera_summary`, `CAPTURE_CLOCK_OFFSET_MEASURED`. `collect-h11.sh`, `collect-h19.sh`: the fault line with `sessionId` and `reason`; `CAPTURE_WORKER_DOWN`. `collect-h17.sh`, `collect-h26.sh`: `SEALING_COMPLETE`. `collect-h21.sh`, `collect-h22.sh`: `CAPTURE_CAMERA_INGEST_PAIRED`. Removed, because the product never wrote them: `CAMERA_CONNECTION_TESTED`, `CAMERA_PROFILE_LISTED` and its token members, `CAMERA_CREDENTIAL_REFUSED`, `STREAM_AUTHENTICATION_FAILED`, `DISCOVERY_ADDRESS_NOT_PRIVATE`, `ADDRESS_NOT_PRIVATE`, the lines `anchored` and `keyframe_interval`, `CAPTURE_FAULT_CLEARED`, `RELAY_CONNECT_ATTEMPT`, `RELAY_GAVE_UP`, `SESSION_SOURCE_OPENED`, `SESSION_SEALED`, `MIC_NOT_DELIVERING`. What no log line states stays a person's reading and the steps say so: the duration of a test, the profile codes, the three token facts, a slot's profile code, the seal's stream statement, the instants of the relay's re-open tries. Open: that the lines have this form in the journal of a real unit | A line that prints "(absent)" or 0 on the host is then a statement about the host's log | the dry run of the package, row 130; the run itself |
| J | The scan does not count the devices on one address: `deviceCount` is `NOT_KNOWN` as built (decisions C90, C94 (a), C105 (1)). The count is to be built before a real installation | `9A/H-13`, `9A/H-15`, `9A/H-14`: one factory-address camera connected at a time; `9A/H-15` cannot show "conflict reported" | the development (the named amendment for the count); the review ruled the procedure sufficient for the bench only |
| K | The source address of the Core's traffic to a camera on a host with two networks, and the three cases of a camera-interface address that is taken away or a port that is down (decision C65) | `9A/H-10.7`, `9A/H-17.5a`, the observation after S3 in `9A/H-11`. If a packet leaves by the office interface with the port down, a remedy on the host or in the relay's start message is to be ruled | the run itself; then the development |
