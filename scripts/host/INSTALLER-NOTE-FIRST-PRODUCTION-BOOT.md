# DEMS Core: installer note - from a seeded database to a first production boot

**Status of this document: a map, UNVERIFIED on a host.** It was written on a development Mac. No step below has been performed on Ubuntu 24.04. It adds no procedure of its own: every step points to the document that holds the commands, and that document is the authority. Where this note and one of those documents differ, the other document is right and this note is the defect.

**Stated first, because it decides everything after it: a first production boot is NOT reachable from this repository alone today.** Two things are missing and no command, script or screen of the repository provides them (section 2).

## Ringkasan (Bahasa Indonesia)

Catatan ini adalah peta bagi pemasang: urutan dari basis data yang baru di-seed sampai Core pertama kali dijalankan dalam operasi produksi (`REAL_PRODUCTION`), dan di dokumen mana tiap langkah ditulis. Catatan ini tidak memuat perintah baru, tidak memasang apa pun, dan belum diverifikasi pada host Ubuntu 24.04. Semua langkah dilakukan oleh **pengguna** di host; tidak ada langkah yang dilakukan agen.

**Hal terpenting: boot produksi pertama BELUM dapat dicapai hanya dari repositori ini.** Dua hal belum disediakan oleh repositori:

1. **Kunci penandatanganan produksi.** Tidak ada perintah di repositori yang membuatnya. Core produksi menolak berjalan tanpa kunci, dan menolak kunci pengembangan.
2. **Kata sandi operator yang bukan kata sandi demo.** Seed menulis kata sandi demo yang dipublikasikan untuk semua operator, dan produk belum punya fungsi pembuatan operator atau penggantian kata sandi. Core produksi menolak berjalan selama masih ada satu operator dengan kata sandi demo.

Urutan singkatnya: (a) terapkan profil host (`scripts/host/`); (b) siapkan server basis data, lalu `db:create`, `db:migrate`, `db:seed`; (c) boot pertama dalam operasi simulasi, hanya pada `127.0.0.1` dan tanpa jaringan ruangan, untuk **mengosongkan keempat slot pemilih perangkat**, karena seed mengisinya dengan sumber buatan yang ditolak Core produksi; (d) sediakan dua hal di atas dengan cara pengguna sendiri; (e) boot produksi pertama (pemeriksaan `9A/H-16`); (f) pasang helper alamat (bab 4 paket uji perangkat keras), ganti kata sandi tiap kamera di halaman kamera itu sendiri **sebelum** kamera diadopsi, lalu isi keempat slot dengan perangkat produksi.

Core produksi dengan slot kosong tetap dapat berjalan, tetapi menolak memulai sesi sampai keempat slot diisi perangkat produksi. Core yang dijalankan dari cabang ini memerlukan `db:migrate` lebih dulu pada basis data yang dibuat sebelum cabang ini. Pencarian kamera hanya pemindaian aktif. Dokumen ini tidak memuat alamat jaringan, kata sandi, atau kunci apa pun.

## 1. Reader, scope, performers

| | |
|---|---|
| Reader | The installer who brings a DEMS Core into production operation on the Ubuntu 24.04 host, and whoever plans that day |
| Scope | The order of the steps between "the database is seeded" and "a `REAL_PRODUCTION` Core has started once", and what follows until a session can start. Where each step is written |
| Not in scope | The commands themselves (they are in the documents of section 3), the hardware checks, the acceptance ruling |
| Performers | **Every step is performed by the user**, on the host, with administrator rights where the step says `sudo`. Steps performed by a development agent, by a script on its own, or by the Core: **0** |
| Secrets | This note holds no credential, no key and no address of any network. Passwords and keys are typed or placed by the user and are never written into a document, a script argument or a record sheet |

## 2. The two things this repository cannot provide

| # | Missing | What the Core does without it | What exists today | Who provides it |
|---|---|---|---|---|
| X-1 | **A production signing key** in `<data directory>/signer` | A `REAL_PRODUCTION` Core refuses to start: `CAPTURE_SIGNING_KEY_UNUSABLE` when no key loads, `CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION` when the key is a development key | One command that provisions a DEVELOPMENT key (its certificate says so). **No command of this repository provisions a production signing key.** The development key command must never be run on the production data directory | The user, by the user's own means |
| X-2 | **Operator passwords that are not the published demonstration password** | A `REAL_PRODUCTION` Core refuses to start while even one operator's stored credential still verifies against the demonstration password: `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` (it also refuses when the operators cannot be read) | `db:seed` writes the demonstration password for every operator. The product has **no operator-provisioning and no password-change function** | The user, by the user's own means; or a tool the development delivers later |

Sources: the product `README.md`, section "Real capture" ("What refuses to start", "The signing key", Known limits 25 and 34); `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md`, section 4 (X-1, X-2) and section 13 (open point 1).

Consequence, stated plainly: until both exist, step 8 below cannot succeed, and the steps after it are not started. No workaround is attempted: a development key or a kept demonstration password is not a "temporary" production set-up.

## 3. Where things are

| What | Where | What it gives the installer |
|---|---|---|
| Host profile | `scripts/host/HOST-PROFILE-UBUNTU-24.04.md` | The state the host must be in, item by item (`HOST-01` to `HOST-56`), each with its command and its took-effect check |
| Profile scripts | `scripts/host/10-preflight.sh` to `95-database.sh` | The same items, printed. Print-only by default; they fetch and build nothing |
| Hardware procedure, the frame | `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md` | The order of the day, the performers, the preparation steps `PREP-01` to `PREP-14`, the result record |
| Hardware procedure, checks | `HW-ACCEPTANCE-2-HOST-HELPER-AUDIO.md`, `HW-ACCEPTANCE-3-NETWORK-CAMERAS-SESSION.md` (same folder) | Checks `9A/H-01` to `9A/H-27` |
| Helper installation | `scripts/hardware-acceptance/HW-ACCEPTANCE-4-HELPER-INSTALLATION.md` | The ten steps `HI-01` to `HI-10` for the address helper |
| Product README | `README.md`, sections "Real capture" and "Known limits" | The three capture operations, what refuses to start and with which code |
| Linux build check | `scripts/host/container/README.md` | What a container build of the capture programs showed. A container result settles nothing for the host |

## 4. The path

Each step names its performer and its authority. A step whose expected result does not appear is stopped there; the next one is not started.

| # | Step | Performer | Authority | Result that lets the next step start |
|---|---|---|---|---|
| 1 | Apply the host profile line by line: account and directories, build tools, the pinned FFmpeg 9.0.2 built from source, the capture worker, the relay and the guard built against it, the camera port, the firewall, the loopback rule, audio access, sleep and time, the service unit | USER | Host profile `HOST-01` to `HOST-49`; check `9A/H-01` | Every took-effect check prints what the profile states |
| 2 | Provide the PostgreSQL server (loopback only) and the two roles, with secrets the user sets | USER | Host profile `HOST-50` to `HOST-54` (a proposal with open choices); `PREP-04` | The database port listens on `127.0.0.1` only |
| 3 | Create, migrate and seed the database: `db:create`, `db:migrate`, `db:seed`, then `db:status` | USER | Host profile `HOST-55`; `PREP-07` | `db:status` exits 0; the schema version it prints is written down |
| 3a | **A database that already exists from before this branch: run `db:migrate` first.** This branch raises the schema version. A Core started from it against a database on the earlier version stops at boot (check `B-3`, schema version) until `db:migrate` has run. The development did not migrate any existing database on its own: migrating under a running Core is the owner's action | USER | Decision C29 of the development; README, troubleshooting line `B-3` | `db:status` exits 0 on that database |
| 4 | Know what the seed wrote: the demonstration data set, operators with the published demonstration password, and **four generated sources in the four selector slots**. A seeded database is not a production database | USER | `PREP-07` step 3; README, Known limit 34 | none; a fact to know |
| 5 | First boot in the `SIMULATED` operation, on the loopback listener, with the host **off the room network**. Start no session in it | USER | `PREP-08` | The log names the operation `SIMULATED`; the listener is on `127.0.0.1` only |
| 6 | **The unassigned-slot remedy.** In the web console of that Core, unassign all four selector slots (both video slots, both microphone slots), then stop the Core. See section 5 | USER | `PREP-09` steps 2 to 4 | The selector shows four slots "not assigned"; one audit entry `CAPTURE_CONFIG_CHANGED` per action |
| 7 | Provide X-2 and X-1 of section 2: operator passwords, then the production signing key. Set the installation identity (`DEMS_INSTALLATION_DEVICE_ID`, `DEMS_INSTALLATION_NAME`) and the environment file without any development switch | USER | `PREP-09` step 1, `PREP-10`; host profile `HOST-34`; README, "the installation identity" | none measurable here; step 8 measures it |
| 7a | Create the address helper's group and put the service user in it. Only this part of the helper installation comes before the Core's unit is first started; it grants nothing by itself | USER | Helper installation, `HI-04` part A; host profile `HOST-43` | The group exists; its only member is the service user |
| 8 | **First production boot**: `DEMS_CAPTURE_MODE=real`, no development-sources switch, no demonstration controls | USER | Check `9A/H-16` | The Core starts and names the operation `REAL_PRODUCTION`. A refusal names its code; the code says which of steps 1, 6 or 7 is not done |
| 9 | Install the address helper, after its security review is read as closed | USER | Helper installation `HI-01` to `HI-10`; `PREP-12` | Checks `9A/H-05`, `9A/H-25`, `9A/H-06` |
| 10 | Per camera, **before the Core adopts it**: replace the camera's password in the camera's own page, set its clock, fill the per-camera sheet. Then search and connect the camera in the web console; its user name and password are typed there by the user only | USER | `PREP-13`; frame section 4 (UA-9, UA-10) and section 5 (rule B-5); check `9A/H-10` | The sheet line is complete; the camera is connected |
| 11 | Register the two microphone inputs; assign two cameras and the two inputs to the four slots | USER (technician or operator with the capture configuration permission) | `PREP-14`; check `9A/H-07` | Four assigned slots, none "not assigned", none a generated source; the pre-check of a new session has no blocking item |
| 12 | The session checks | USER | Checks `9A/H-17` onward | The acceptance ruling, frame section 11 |

Notes on the order:

- **The helper's group comes before the Core's unit is first started** (step 7a): the unit of the host profile names that group. The rest of the helper installation is step 9. Whether a production Core without an installed helper refuses to start or starts with the commissioning functions unavailable is open (frame, section 13, point 6); if step 8 is refused for the missing helper, the code is recorded, step 9 is done, and step 8 is repeated as a second run.
- **The camera search is an active scan only.** It asks the addresses of a stored list and one address a technician types. There is no passive monitor and no packet capture (ruling U9).
- The room network cable is plugged in only after step 8 has passed (`PREP-11`).

## 5. The unassigned-slot remedy, in full

Why it is needed: the seed fills the four selector slots with generated development sources. A `REAL_PRODUCTION` Core that finds a development source in the selector refuses to start (`DEV_SOURCE_WITHOUT_FLAG`). No production camera or microphone can be assigned yet at that point, because none is adopted.

What the product does with empty slots:

| State of the four slots | A `REAL_PRODUCTION` Core |
|---|---|
| Any slot holds a generated (development) source | refuses to start |
| All four unassigned | **starts**. A session start is refused; the pre-check names each unassigned slot as a blocking item ("source not assigned") |
| Some assigned with production devices, some unassigned | starts. A session start is still refused: all four slots are required, the standby microphone included |
| All four assigned with production devices | starts. A session can start when the pre-check has no other blocking item |

So the remedy has two halves, in this order: unassign the four slots in the `SIMULATED` first boot (step 6), and assign production devices once the production Core runs and the cameras and microphone inputs are adopted (step 11). Between the two, the production Core is up and records nothing: that is the intended state, not a fault.

Development record of this behaviour: `docs/2026-10-12_input_av_core_adapter_plan/implementation/029_selector_server.md` (the store, the slices and operation 78 `unassign`; an unassigned slot is an absent line, never an invented device) and `implementation/030_precheck_unassigned.md` (the pre-check item). Both were shown by tests on the development machine, on a development-capture Core; a started `REAL_PRODUCTION` Core has not been seen, for the reason of section 2.

## 6. What stays unproven

- Everything in the host profile and in the four chapters of the hardware procedure is unverified on Ubuntu 24.04 until the checks `9A/H-01` to `9A/H-27` have run on the real host.
- A `REAL_PRODUCTION` Core has never been started from this repository: X-1 and X-2 do not exist. Its refusals are shown by tests of the boot checks, not by a started Core.
- How PostgreSQL is installed on the host, how the tablet, the phone and a web console on another machine reach a Core that listens on `127.0.0.1`, and the start command of a production Core in the service unit are open points of the host profile (section 5 and "Outside this profile") and of the frame (section 13).
- The argument form of `db:migrate` and `db:seed` on the host is to be confirmed there (frame, section 13, point 9).
