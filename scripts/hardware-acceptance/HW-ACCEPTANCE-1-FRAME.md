# DEMS Core: hardware acceptance test package, chapter 1 - the frame

**Status of this document: UNVERIFIED on real hardware.** It was written on a development Mac with no Linux host, no camera and no audio interface. No step below has been performed anywhere. This package is the instrument that verifies the product on real devices; until it has been run, every expected result in it is a statement of intent. A line the author could not settle from the design documents carries "to confirm" and is listed in section 13.

This document installs nothing and tests nothing by itself. It is a procedure for people.

**Revision 2 (2026-10-13)**, the consistency pass (blueprint row 181). Still unverified on a host. Changed in this file:

- Order: the room network may be plugged during the installation window (`PREP-03` step 2) and is unplugged in `PREP-08` step 1, or an offline package set is used; chapter 4 steps `HI-01` to `HI-07` now come before `9A/H-16` (sequence 8a), because the Core's unit names the helper's group and a production start asks for the helper's socket, file and grant; `HI-08` is steps `.6` and `.7` of `9A/H-05`.
- Added: bound B-7 (the level of `9A/H-08`); section 9.5 (how the audit list and a readable track reach a collector as a file); the pusher for the worker's series (`PREP-06` step 1).
- X-1 and X-2 are no longer "no command of the repository": two commands are being built (rows 206 and 215). A first production boot is reachable for a bench test once they land; section 11 item 8 carries the two lists of the security review.
- Rulings U15 to U19 and P11 (section 1), decision C46 and the fail-closed host and program checks (section 3, `PREP-08`, `PREP-12`), new known limits in section 9.4 item 7.
- Open points 1, 5, 6 and 9 of section 13 settled or re-stated; points 10 to 12 added. Marks "to confirm" left in this file: 4 (`PREP-06` step 1, `PREP-09` step 5, `PREP-10` step 1, section 9.5), each naming the row or the check it waits for.

**Revision 3 (2026-10-13)**, the X-1 and X-2 passages only (blueprint row 219). Still unverified on a host: neither command has been run on one. The two commands that Revision 2 called "being built" are built: `evidence:production-key` and `operator:set-password` are script entries of `apps/core-server/package.json`, and the two command lines of `PREP-09` step 5 and `PREP-10` step 1 are copied from there. Where Revision 2 above says "being built" or "once they land", read "built". Changed: the X-1 and X-2 lines of section 4; `PREP-09` steps 1, 5 and 6; `PREP-10` steps 1 and 3; the first sentence of section 11 item 8; the line "A production boot and session" of section 12; open point 1 of section 13. The order of the day and the pass criterion of every check are unchanged. The two marks "to confirm" of `PREP-09` step 5 and `PREP-10` step 1 no longer wait for a row; each now names what only the host can show.

**Revision 4 (2026-10-14)**, the document row of wave 12. Still unverified on a host: nothing below was run on one. Where a line of Revision 2 or 3 above differs from this list, this list holds. Changed in this file:

- The order (section 6). The address helper is not mandatory for a production start any more (decision C94 (j), reversing C49 (1)). Sequence 8a keeps `PREP-12` and only `HI-04` part A, the group; chapter 4, `HI-01` to `HI-07`, returns to sequence 12, after `9A/H-16` and `PREP-11`, and is run as a whole or not at all. Sequence numbers are unchanged, so the recording sheet (section 9.2) and the record writer stay as they were.
- Section 1: a production Core is allowed on Linux and on the user's Mac (ruling U21); what a Mac does not check, and where the evidence says so.
- `PREP-10`: three installation ids no installation may carry. `PREP-12`: what a start with and without the helper shows.
- Section 9.1: the acceptance record's step list is the contract's closed list of the 27 checks; `PREP-nn` and `HI-nn` are the installer's own record (decision C105 (4)).
- Section 9.4 item 7: the limits that changed or were added (the loopback rule table, one factory-address camera at a time, the sound card's identity, the audio after a worker restart).
- Section 13: open points 6, 10 and 12 settled as stated there.

## Ringkasan (Bahasa Indonesia)

Paket ini adalah prosedur uji terima perangkat keras DEMS Core. Paket dijalankan oleh **pengguna** setelah perangkat terpasang: host Linux Ubuntu 24.04, switch PoE, kamera IP dan antarmuka audio USB. Bab 1 ini adalah kerangkanya: urutan 27 pemeriksaan (`9A/H-01` sampai `9A/H-27`), operasi perekaman yang dibutuhkan tiap pemeriksaan, langkah persiapan, hal-hal yang hanya boleh dilakukan pengguna, lembar hasil, dan aturan keputusan akhir. Isi tiap pemeriksaan ada di bab 2 dan 3; pemasangan helper alamat ada di bab 4.

Yang hanya dilakukan pengguna: memasang profil host dan helper dengan hak administrator, memigrasi basis data host, menyediakan kunci tanda tangan produksi dan kata sandi operator yang bukan kata sandi demo, mengetik kata sandi kamera, mengganti kata sandi setiap kamera sebelum diadopsi (wajib untuk kamera yang pernah terdaftar di input-av), dan memastikan input-av tidak terpasang di host uji. Tidak ada rahasia yang ditulis ke dokumen, lembar hasil, atau percakapan.

Revisi 2 (2026-10-13): urutan diperbaiki. Kabel jaringan ruangan boleh terpasang selama masa pemasangan dan dicabut pada `PREP-08`; helper alamat (`HI-01` sampai `HI-07`) dipasang sebelum boot produksi pertama (`9A/H-16`); ambang level suara B-7 ditetapkan pengguna; kunci tanda tangan produksi dan kata sandi operator disediakan dengan dua perintah yang sedang dibangun (X-1, X-2). Boot produksi pertama dapat dicapai untuk UJI BANGKU; pemeriksaan sungguhan membutuhkan lebih banyak (bagian 11 butir 8).

Revisi 3 (2026-10-13): kedua perintah itu sudah dibangun, `operator:set-password` (X-2, `PREP-09` langkah 5) dan `evidence:production-key` (X-1, `PREP-10` langkah 1). Keduanya dijalankan oleh pengguna di terminal host; setiap operator mengetik kata sandinya sendiri, Supervisor lebih dahulu. Keduanya belum pernah dijalankan pada host.

Revisi 4 (2026-10-14): helper alamat tidak lagi wajib untuk start produksi. Sebelum boot produksi pertama (`9A/H-16`) hanya grup `dems-netalias` yang dibuat (`HI-04` bagian A); pemasangan helper (`HI-01` sampai `HI-07`) dilakukan sebagai satu kesatuan setelah `9A/H-16`, atau tidak sama sekali. Core produksi diizinkan di Linux dan di Mac pengguna; di Mac profil host tidak diperiksa dan bukti menyatakannya. Daftar langkah dalam catatan penerimaan adalah 27 pemeriksaan `9A/H-nn`; langkah `PREP-nn` dan `HI-nn` adalah catatan pemasang sendiri. ID instalasi `DEMS-TEST-01`, `DEMS-IR-01`, dan `DEMS-JKT-07` tidak boleh dipakai oleh instalasi mana pun.

Semua isi paket ini **belum terverifikasi** pada perangkat nyata. Pengembangan hanya membuktikan logika pada perangkat tiruan. Tahap 2 ("layak merekam") diputuskan oleh pengguna hanya berdasarkan lembar hasil paket ini; "terekam tetapi tidak tersegel" bukan lulus, dan lulus sebagian dilaporkan sebagai sebagian.

## 1. What this package is

| | |
|---|---|
| What | The acceptance procedure for a DEMS Core that records from real IP cameras and a real USB audio interface on a Linux host. 27 checks, each with a pass criterion stated as a count, a value against a bound, or a named outcome |
| Who runs it | The user (the owner of the installation) with a person at the bench. Section 3 names who performs which kind of step. No step is performed by a development agent |
| When | After the user says the devices are installed, and after the development track has been reported complete "on doubles". It does not start by itself |
| Where | On the acceptance host (Ubuntu 24.04) with the devices connected |
| Why | The development ran without hardware. What it showed, it showed on generated sources and hand-written stand-ins (section 12). Whether the product records, seals and verifies from real devices is known only after this run |
| What it decides | Nothing by itself. It produces a result record (section 9). The user rules on that record whether the product is "fit to record" (section 11) |
| What it cannot show | It runs once, on one host, with the user's cameras and interface. It shows what the product did there, check by check. It says nothing about other camera models, other audio interfaces or another kernel |
| What is not part of it | Since 2026-10-13 a camera and a microphone are connected to the user's development Mac (rulings U15, U16). On them the development may run the camera SEARCH and the CONNECTION TEST only, with the user typing the password in the web console; no recording and no change of a camera's address (ruling U18). The production microphone path is ALSA on Linux and is not exercised on the Mac (P11). Whatever that work shows is a finding of the development; it is no line of this record and replaces no check of this package |
| Which hosts may run a production Core | Linux and the user's Mac (ruling U21): a Core in `REAL_PRODUCTION` starts on `linux` and on `darwin`; on any other platform the start is refused with `CAPTURE_HOST_PLATFORM_NOT_SUPPORTED`. **This package accepts the Linux host.** On Linux every item of the host profile that the Core can ask is asked at every start. **On a Mac none of these is asked**: `HOST-18` (the arping variant), `HOST-20` (forwarding), `HOST-25` and `HOST-41` (the loopback rule: any account of the Mac can connect to the worker's camera listeners), `HOST-26` and `HOST-40` (the audio group), `HOST-29` (sleep), `HOST-31` (clock synchronisation), `HOST-37` (the crash collector), `HOST-38` (no new privileges), `HOST-44` to `HOST-46` (the address helper's socket, file, grant and interface file). Still checked on a Mac: the core-file limit (`HOST-35`), the start switches (`HOST-36`), the relay and guard programs under the path rule (`HOST-05`, `HOST-15`) and the relay's stated media library. A Mac says so three times: the log line `CAPTURE_HOST_PROFILE_NOT_ASKED` at every start; the audit entry `SYSTEM_BOOT` with `hostPlatform: darwin` and `hostProfile: WILL_NOT_BE_ASKED`; and the signed manifest of every package that Core seals, with the member `hostProfileNotAsked: { platform: "darwin" }`, which the receiver's verification reports as the notice `HOST_PROFILE_NOT_ASKED` (decision C97). A package sealed on Linux carries no such member. A recording made by a production Core on the Mac is therefore evidence that states its own weaker host; it is no check of this package |

**Rules for the whole run.**

1. No secret is written into this package, the result record, a ticket, an e-mail or a chat: no password, no key, no token. A camera password is typed only into the camera's own page and into the password field of the web console.
2. No real address of the site's network and no personal name is written into the result record. Cameras are named by a label the user puts on the housing (`CAM-A`, `CAM-B`, ...). People are named by their role.
3. No program of input-av runs on the acceptance host or records the same cameras or microphones during the run.
4. From the Core, nothing on a camera is changed except its network address (check `9A/H-14`). The Core does not set a camera's clock or password.
5. The recordings of this run are acceptance material, not examinations. No real examination is recorded before the ruling of section 11. They show a real room: they stay on the host and are not copied into a repository, a ticket or a chat.
6. The scripts of the package only read. None types a password, runs with administrator rights, changes an address or changes a camera. Every such step is written as a step for a person.
7. A pass criterion is met or not met as written. "It seemed fine" is not a result.

## 2. The files of the package

One folder, `scripts/hardware-acceptance/`, one file per chapter. The scripts of the package lie in the same folder.

| Chapter | File | Content | Check identifiers |
|---|---|---|---|
| 1 | `HW-ACCEPTANCE-1-FRAME.md` | This document | preparation steps `PREP-01` to `PREP-14`; user actions; the order; the record |
| 2 | `HW-ACCEPTANCE-2-HOST-HELPER-AUDIO.md` | Host, helper and audio: 12 checks | `9A/H-27`, `9A/H-01` to `9A/H-08`, `9A/H-16`, `9A/H-24`, `9A/H-25` |
| 3 | `HW-ACCEPTANCE-3-NETWORK-CAMERAS-SESSION.md` | Network functions, cameras and sessions: 15 checks | `9A/H-09` (read inside `9A/H-17`), `9A/H-10` to `9A/H-15`, `9A/H-17` to `9A/H-23`, `9A/H-26` |
| 4 | `HW-ACCEPTANCE-4-HELPER-INSTALLATION.md` | Installation of the address helper, ten steps for the user. `HI-04` part A (the group) at sequence 8a, before `9A/H-16`; `HI-01` to `HI-07` as a whole at sequence 12, after `9A/H-16`; `HI-08` inside `9A/H-05`; `HI-09.1` and `HI-10` after it | steps `HI-01` to `HI-10` |
| - | `collect-hNN.sh`, `record-line.sh`, `hw-collect-lib.sh`, `e11b-announce-probe/` | The read-only collectors (26, one per check except `9A/H-20`), the record writer, and the announce-line probe with its own `README.md` | named in the `SCRIPT` steps of chapters 2 and 3 |
| - | `scripts/host/HOST-PROFILE-UBUNTU-24.04.md` | The host profile that `9A/H-01` applies; it exists already | items `HOST-01` to `HOST-49` |

A check is always written with its prefix, `9A/H-nn`. Inside a chapter, the steps of a check are numbered `9A/H-nn.1`, `9A/H-nn.2`, and so on. Chapters 2 and 3 write every check in the six-part form of section 8.

## 3. Words used in every chapter

**Capture operation.** A Core decides once, at its start, what it records. The boot log line `capture fence passed` prints the operation.

| Capture operation | Set by | What it records | Used in this package for |
|---|---|---|---|
| `SIMULATED` | `DEMS_CAPTURE_MODE` unset or `simulated` | Nothing. Sessions come from the simulator | The first boot only (`PREP-08`), on the loopback listener, with no session started |
| `REAL_DEVELOPMENT` | `DEMS_CAPTURE_MODE=real` and `DEMS_CAPTURE_DEV_SOURCES=1` | Generated test sources only | The host checks that need a recording before any production boot exists: `9A/H-02`, `9A/H-03`, `9A/H-04`, `9A/H-24`. Always on the throw-away database, never on the acceptance database |
| `REAL_PRODUCTION` | `DEMS_CAPTURE_MODE=real`, `DEMS_CAPTURE_DEV_SOURCES` unset | Production sources only: adopted cameras and registered microphone inputs. Only this operation asks the host checks and the program checks at its start (decision C46; the codes `CAPTURE_HOST_*` are listed in chapter 2, `9A/H-16`); the two other operations never ask them | Every check from `9A/H-16` on |
| none | no Core runs | - | `9A/H-27`, `9A/H-01`, the helper's own proofs in chapter 4 |

One session is never a mix of development and production sources, and a Core in `REAL_PRODUCTION` refuses to start while a generated source is assigned (`DEV_SOURCE_WITHOUT_FLAG`). That is why the two real operations use two databases here.

**A refused start** opens no listener. The log ends with `"the server stopped: boot"` and names a check and a code. A refusal is a result to record with its code; in `9A/H-04` and `9A/H-16` certain refusals are the expected result.

**Who performs a step.** Every step of every chapter names one of these. There is no sixth performer.

| Code | Who | Does |
|---|---|---|
| `USER` | The owner of the installation, with administrator rights on the host | Everything with `sudo`; everything with a key or an operator password; every confirmation and ruling |
| `TECH` | A person signed in to the web console with the technician role | The commissioning functions (temporary address, factory-address scan, set camera address) and the camera connect flow |
| `OPER` | A person signed in as an operator | Starts and ends sessions, verifies, plays back |
| `BENCH` | The person at the devices | Plugs, unplugs, speaks, claps, reads a label |
| `SCRIPT` | A read-only collector of the package, started by `USER` in a terminal | Reads counters, log lines, listings and file probes; writes a line of the result record |

`USER`, `TECH`, `OPER` and `BENCH` may be the same person. Camera passwords are typed by `USER`, or by `TECH` at the user's direction.

**Placeholders** are those of the host profile, section 2 (`<service-user>`, `<install-dir>`, `<data-dir>`, `<camera-interface>`, and so on). Their values are chosen on the host and are not written into the package.

**The two databases.** The product's database commands accept a closed list of database names.

| Name in this package | Database name | Purpose | Media store |
|---|---|---|---|
| The acceptance database | `dems_demo` (the product's main name; see open point 3 of section 13) | The database of the installation under acceptance. Every `REAL_PRODUCTION` check uses it | `<data-dir>/media/sessions` |
| The throw-away database | `dems_lane_2` (the product's name for a development-capture instance) | The `REAL_DEVELOPMENT` host checks. Removed with its media store before the ruling | its own folder on the **same disk** as the acceptance media store, mode 0700 |

Every database has its own media store root. The two are never pointed at the same folder.

## 4. What only the user can do

No development agent and no script performs any line of this table. A check that depends on a line that is not done is recorded "not run" with that line as its reason.

| Id | Action | Done before | Serves |
|---|---|---|---|
| UA-1 | Provide the Ubuntu 24.04 host and administrator access to it; apply the host profile line by line, with `sudo` | `PREP-03` | every check |
| UA-2 | Install the devices: the PoE switch on a network port of its own, two cameras, a USB audio interface with two microphone inputs and two microphones, one factory-new camera, and for `9A/H-15` a second camera on the same factory address | `PREP-03` | `9A/H-07` to `9A/H-15`, `9A/H-17` |
| UA-3 | Install the address helper as chapter 4 states, with `sudo`: a root service on a local socket, one group, two unit files, no sudoers file (decision C19); compare the printed hash with the file in hand. All of it or none: a helper installed in part refuses the next production start | `9A/H-16` for the group of `HI-04` part A (sequence 8a); `9A/H-05` for `HI-01` to `HI-07` (sequence 12) | `9A/H-05`, `9A/H-06`, `9A/H-25`, `9A/H-13` to `9A/H-15`; the group alone serves `9A/H-16` |
| UA-4 | Type every camera password: in the camera's own page when changing it, in the web console when connecting the camera or setting its address | `9A/H-10`, `9A/H-14`, `9A/H-23` | `9A/H-10`, `9A/H-14`, `9A/H-17`, `9A/H-23` |
| UA-5 | Provide a person at the bench for the physical steps | `9A/H-06` | `9A/H-06` to `9A/H-08`, `9A/H-11`, `9A/H-13`, `9A/H-15`, `9A/H-18`, `9A/H-19`, `9A/H-22` |
| UA-6 | The legacy data of input-av on the development machine has no writer: the folder is moved out of the repository, set read-only, or its staying is confirmed in writing. Independent of the acceptance host | any start of an input-av program, in any task | none of the 27 checks; a standing condition |
| X-1 | Provide the production signing key in the Core's data directory, with the command built for it (ruling U19): `evidence:production-key`, run by `USER` at the host's terminal as the Core's service user, never as root (`PREP-10` step 1). It asks for no secret. The development key command must not be used. The fingerprint it prints is handed over only after `9A/H-16` has passed | `9A/H-16` | `9A/H-16`, `9A/H-17` |
| X-2 | Give every operator a password that is not the published demonstration password, with the command built for it (ruling U19): `operator:set-password`, started by `USER` at the host's terminal with the Core stopped; each operator types their own password at its hidden prompt, the Supervisor first (`PREP-09` step 5). The web console has no password-change function | `9A/H-16` | `9A/H-16`, `9A/H-17` |
| UA-7 | Confirm that the acceptance host carries no input-av installation: no service, no helper, no sudoers line, no generated audio configuration. If one is found, remove it first. Checked by `9A/H-27` | `9A/H-01` | `9A/H-27`, then all |
| UA-8 | Migrate the acceptance host's database (`PREP-05`, `PREP-07`). No agent migrates a database on this host | `9A/H-02` | every check with a Core |
| UA-9 | Change the password of **every** camera of the acceptance in the camera's own page before the Core adopts it, and fill the per-camera sheet of section 9.3 (`PREP-13`). Mandatory without exception for a camera that was ever registered in input-av: its old password lies in that system's database in readable form | `9A/H-10` for that camera | `9A/H-10`, `9A/H-17`; condition of section 11 |
| UA-10 | Set every camera's clock to the host's time in the camera's own page (`PREP-13`). The product does not set a camera's clock | `9A/H-10` | `9A/H-17` (the clock offset read as `9A/H-09`) |
| UA-11 | Decide and write down the values of section 5 that have none today (B-1 to B-7) | `PREP-02` | `9A/H-18`, `9A/H-19`, `9A/H-11`, `9A/H-08`, `PREP-13` |
| UA-12 | Accept, or refuse, digest authentication over unencrypted HTTP and RTSP on the production camera network. The host's part is the dedicated port and switch with forwarding off (host profile, `HOST-19`, `HOST-20`) | the ruling of section 11 | section 11 |
| UA-13 | Rule what the bench installation of input-av may do after the ruling of section 11 | with the ruling | section 11 |

UA-1 to UA-6, X-1 and X-2 are the identifiers of the plan. UA-7 to UA-13 are numbered by this chapter for actions the plan and its reviews name without an identifier.

## 5. Values to set before the run

The first table holds bounds the product or its design fixes; they are not open. The second holds values that have **no source today**. A check that needs an unset value is recorded "not run: bound not set". Setting a value after the measurement has been seen is not allowed.

| Fixed bound | Value | Check |
|---|---|---|
| Camera connection test in the connect flow | inside 15,000 ms | `9A/H-10` |
| Session start: time until both camera ingests are connected | inside 30 s | `9A/H-21` |
| Camera answers at its new address with the same hardware address | inside 180 s | `9A/H-14` |
| Camera clock against the Core's | at most 2 s off is accepted and recorded; above 500 ms the operator sees an advisory | `9A/H-09` |

| To set (UA-11) | Unit | Proposed by | Value set, date, by whom (role) |
|---|---|---|---|
| B-1: tolerance of the picture-to-sound offset in the clap test | milliseconds | no source; the user sets it | |
| B-2: tolerance of the drift between the first and the last clap of the long session | milliseconds | no source; the user sets it | |
| B-3: length of the long session | minutes | the plan says one to two hours | |
| B-4: how long the camera cable stays unplugged in the reconnect check | seconds | no source; the user sets it | |
| B-5: the camera password rule (see below) | characters | this chapter's proposal | |
| B-6: whether a guard against a full evidence disk is a precondition of the run. The product does not stop a session when the disk fills, as far as the design could confirm | yes or no | the plan leaves it to be decided | |
| B-7: the level a microphone input must reach in `9A/H-08`: the peak while a person speaks at 30 cm, and how far it must lie above the same input's peak in a silent room | dBFS; dB | chapter 2's proposal: at or above -40 dBFS, and at least 20 dB above silence. No source in the design; the user sets it | |

**The camera password rule (B-5), proposed.** A camera account's name and a value derived from its password cross the camera network unencrypted. A captured value can be attacked off-line, so the password must be long and random.

1. At least 16 characters, produced by a random generator, not composed by a person.
2. One password per camera. Not used for any other camera, device or account, and never one that the camera had under input-av or from the factory.
3. If a camera model accepts fewer than 16 characters, the longest it accepts; that model and its limit are written into the per-camera sheet and into the summary, because they bear on UA-12.
4. For exactly one camera the password contains the characters that chapter 3 lists for `9A/H-23`.
5. The password is kept where the user keeps the installation's secrets. It is not written into the sheet: the sheet records that the change was made, never the value.

## 6. The order of the run

The order follows the dependencies. A check may be repeated; it may not be moved before a check it depends on. Sessions are named S1 to S4 so that readings can be assigned to the recording they come from.

| Seq | Step or check | What happens, in one line | Capture operation | Database | Recording | Needs first |
|---|---|---|---|---|---|---|
| 1 | `PREP-01` to `PREP-03` | Entry conditions, values set, devices in place; the installation window of the room network opens (or the offline package set is on the host) | none | - | - | - |
| 2 | `9A/H-27` | The host carries no input-av installation | none | - | - | UA-7 |
| 3 | `9A/H-01` | The host profile applied; the capture programs built and self-checked; the worker's listener refuses a push to a wrong path on this host's build | none | - | - | `9A/H-27` |
| 4 | `PREP-04` to `PREP-06` | Database server; the throw-away database; a development-capture Core starts | `REAL_DEVELOPMENT` | throw-away | - | `9A/H-01` |
| 5 | `9A/H-02` | No child process outlives a Core that is ended abruptly | `REAL_DEVELOPMENT` | throw-away | one recording from generated sources, killed | seq 4 |
| 6 | `9A/H-24` | No leftover after the kill; a planted leftover is named at the next start | `REAL_DEVELOPMENT` | throw-away | the same kill, then one start | `9A/H-02` |
| 7 | `9A/H-03` | The durability level the evidence disk gives | `REAL_DEVELOPMENT` | throw-away | one recording from generated sources on the evidence disk | seq 4 |
| 8 | `9A/H-04` | A missing prerequisite is named at start; restored, none is named | `REAL_DEVELOPMENT` | throw-away | none (starts only) | seq 4 |
| 8a | `PREP-12`, then chapter 4, `HI-04` part A only | The user reads the review's statement on the helper and creates the group `dems-netalias` with its one member, because the Core's unit names it. Nothing else of the helper is installed here (Revision 4) | none | - | - | `9A/H-01` |
| 9 | `PREP-07` to `PREP-10` | The acceptance database migrated and seeded; **the room network cable unplugged**; first boot on the loopback listener: the four slots unassigned; operator passwords replaced (X-2); the production signing key in place (X-1) | `SIMULATED`, once | acceptance | none; no session is started | `9A/H-01` |
| 10 | `9A/H-16` | A production Core starts on an unassigned selector and refuses a session start. It starts without the address helper and states that (`CAPTURE_HOST_ALIAS_HELPER_ABSENT`) | `REAL_PRODUCTION` | acceptance | none (the refusal is the result) | seq 8a (the group), seq 9, X-1, X-2 |
| 11 | `PREP-11` | The host joins the room network | - | - | - | `9A/H-16` passed |
| 12 | Chapter 4, `HI-01` to `HI-07`, as a whole | The user installs the address helper with the Core stopped: the three hashes, the helper file, the interface file, the group read again, the two unit files and the socket, the self-check, the refusals, the firewall readings. The default route exists, so `HI-03.6`, request (b10) and step (c3) of `HI-06` are measured at once. `HI-08` is not a step of its own: it is steps `.6` and `.7` of `9A/H-05`. `HI-09.1` and `HI-10` follow `9A/H-05`. A site that needs no commissioning function leaves this sequence out as a whole | none | - | - | seq 8a, `9A/H-16`, `PREP-11` |
| 13 | `9A/H-05` | The helper as installed: owner, mode, refusals, the Core's own boot check of it (its steps `.6` and `.7` are `HI-08`) | none, then `REAL_PRODUCTION` | acceptance | none | `HI-01` to `HI-07`, `9A/H-16` |
| 14 | `9A/H-25` | The conflict check refuses an address that another device holds | `REAL_PRODUCTION` | acceptance | none | `9A/H-05` |
| 15 | `9A/H-06` | A temporary address is added, refused on conflict, and removed after its lifetime with the Core killed | `REAL_PRODUCTION` | acceptance | none | `9A/H-05`, `9A/H-25` |
| 16 | `9A/H-07` | The real card listing; the same identity after a re-plug | `REAL_PRODUCTION` | acceptance | none | `9A/H-16` |
| 17 | `9A/H-08` | Shared capture opens on both inputs; rate; audible level on both | `REAL_PRODUCTION` | acceptance | none before S1; the first-second reading is taken from S1 | `9A/H-07` |
| 18 | `9A/H-12` | Camera search on the real network; a typed address yields a candidate | `REAL_PRODUCTION` | acceptance | none | `9A/H-16`, a camera on the camera subnet; for the typed address also the camera interface and subnet chosen (`9A/H-05.6`) |
| 19 | `9A/H-13` | The factory-address scan finds a factory-new camera plugged in alone | `REAL_PRODUCTION` | acceptance | none | `9A/H-05`, `9A/H-06` |
| 20 | `9A/H-15` | Two cameras on one factory address: reported, set-address refused, neither changed | `REAL_PRODUCTION` | acceptance | none | `9A/H-13`, before `9A/H-14` |
| 21 | `9A/H-14` | The camera's address set from the console; found again by its hardware address | `REAL_PRODUCTION` | acceptance | none | `9A/H-13`, `9A/H-15` |
| 22 | `PREP-13` | Per camera: password changed, clock set, sheet filled | - | - | - | the camera reachable |
| 23 | `9A/H-10` | The connect flow with real profile tokens; a profile assigned to a slot | `REAL_PRODUCTION` | acceptance | none | `PREP-13` for that camera |
| 24 | `9A/H-23` | A camera account whose password has special characters authenticates | `REAL_PRODUCTION` | acceptance | none here; its log search is repeated after S1 | `9A/H-10` |
| 25 | `PREP-14` | The four slots assigned: two cameras, two microphone inputs | `REAL_PRODUCTION` | acceptance | - | `9A/H-08`, `9A/H-10` |
| 26 | `9A/H-17` | **S1:** one session from two cameras and two microphone inputs, recorded, sealed and verified. `BENCH` claps at its start and at its end | `REAL_PRODUCTION` | acceptance | S1 | `9A/H-08`, `9A/H-16`, `PREP-14` |
| 27 | `9A/H-21` | Time from the start of S1 to both ingests connected | `REAL_PRODUCTION` | acceptance | read from S1 | `9A/H-17` started |
| 28 | `9A/H-09` | H.265 through the relay: codec as the stream's, counters, clock offset, decodable file | `REAL_PRODUCTION` | acceptance | read from S1; no recording of its own | `9A/H-17` |
| 29 | `9A/H-26` | The notice `STREAM_PROFILE_DIFFERS` is not raised for the H.265 cameras | `REAL_PRODUCTION` | acceptance | read from S1 | `9A/H-17` |
| 30 | `9A/H-18` | Picture and sound in step: the offset at the first and the last clap of S1 against B-1 | `REAL_PRODUCTION` | acceptance | read from sealed S1 | `9A/H-17` passed |
| 31 | `9A/H-20` | Playback of S1 in the web console, on the tablet and from an export | `REAL_PRODUCTION` | acceptance | sealed S1 | `9A/H-17` passed |
| 32 | `9A/H-22` | **S2:** a camera absent at the start: the session starts with the other, one warning, the absent one is not in the package | `REAL_PRODUCTION` | acceptance | S2 | `9A/H-17` passed |
| 33 | `9A/H-11` | **S3:** a camera's cable unplugged for B-4 seconds during a recording, then restored | `REAL_PRODUCTION` | acceptance | S3 | `9A/H-17` passed |
| 34 | `9A/H-19` | **S4:** the long session of B-3 minutes with a clap at its start and its end; drift against B-2 | `REAL_PRODUCTION` | acceptance | S4 | `9A/H-17` passed |
| 35 | Section 9, section 11 | The record completed; the summary; the user's ruling | - | - | - | all above |

All 27 checks are in the table: `9A/H-01` to `9A/H-27`, each once. Sequence 8a was inserted by Revision 2 without renumbering, so that the sequence numbers of the recording sheet (section 9.2) and of the record writer stay as they were; the order of the 27 checks is unchanged. Revision 4 moved the helper's installation from sequence 8a back to sequence 12 and changed no number.

**Why this order differs from the numbering.**

- `9A/H-27` comes first: an input-av installation beside the Core would falsify every later result.
- The room network is needed for the installation and is a risk for the first boot. `9A/H-01` needs packages and source archives (`HOST-09`, `HOST-10`, `HOST-12`, `HOST-18`, `HOST-25`, `HOST-26`), `PREP-04` needs the database server and `PREP-06` a pusher: the cable may be in from `PREP-03` to the end of sequence 8a. It is out from `PREP-08` step 1, before a Core runs on a database whose operators still have the published password, and returns in `PREP-11`, after `9A/H-16` has shown that password refused.
- The helper's group comes before `9A/H-16`; the helper's installation comes after it (Revision 4; decision C94 (j), which reverses the order Revision 2 wrote under C49 (1)). The group, because the Core's unit file names `dems-netalias` and the service manager does not start a unit that names a group the host does not have (`HI-04` part A). The installation after it, because the helper is used at commissioning only and is no longer asked for at a production start: a host with nothing of the helper starts and states it (`CAPTURE_HOST_ALIAS_HELPER_ABSENT`; `SYSTEM_BOOT` member `addressHelperSocket: NOT_PRESENT`), and a host with all of it starts and names no fault. Only a helper that is there in part, or is wrong, is refused (`CAPTURE_HOST_ALIAS_SOCKET` with `SOCKET_ABSENT`, `CAPTURE_HOST_ALIAS_HELPER_UNSAFE`, `CAPTURE_HOST_ALIAS_GRANT_UNSAFE`). So `HI-01` to `HI-07` are run in one sitting with the Core stopped: all of it or none. Installing at sequence 8a, as Revision 2 wrote, stays allowed; `9A/H-16` then shows `PRESENT` and no warning. Installing grants nothing that is used: no address is added before `9A/H-25`.
- `9A/H-16` comes before the checks of the helper, the microphones and the cameras. A production Core starts with no source assigned; the commissioning functions and the camera connect flow need that running production Core.
- `9A/H-24` follows `9A/H-02` directly: both read the same kill.
- `9A/H-25` comes before `9A/H-06`, whose conflict case depends on it.
- `9A/H-15` comes before `9A/H-14`: it needs two cameras that still hold the same factory address, and `9A/H-14` changes one of them.
- `9A/H-09` has no recording of its own. The product records a session only from four assigned sources, so one camera cannot be recorded alone; its readings are taken from S1.
- `9A/H-11` and `9A/H-22` come after `9A/H-17`: each needs a session, and the first session from production sources is kept free of an injected fault.
- `9A/H-19` comes last: it is the longest, and nothing waits for it.

**What may be left "not run" without voiding `9A/H-17`.** `9A/H-17` needs `9A/H-27`, `9A/H-01`, `9A/H-16`, `9A/H-07`, `9A/H-08`, `9A/H-10` for two cameras, and one of the two ways of `9A/H-12` to find a camera. If both cameras already sit on the camera subnet, `9A/H-05`, `9A/H-06`, `9A/H-25`, `9A/H-13`, `9A/H-14` and `9A/H-15` may wait; `9A/H-02`, `9A/H-03`, `9A/H-04` and `9A/H-24` may wait as well. The helper's installation may wait as well, or be left out for good on a site that never commissions a camera through the Core: the production Core of `9A/H-16` starts without it (open point 10 of section 13, settled). What may not happen is half an installation. A camera found by its typed address needs the camera interface and subnet chosen first (`9A/H-05.6`); until then every typed address is refused. A check left out is recorded "not run" with its reason and appears in the summary; it is not counted as passed, and the ruling of section 11 is made knowing it.

## 7. The preparation steps

Each step names its performer and its expected result. A step whose expected result does not appear is stopped there and recorded in the notes of the result record; the next step is not started.

### Part A. Before the day

**`PREP-01` Entry conditions.** Performer: `USER`.
1. Read the closing report of the development. Expected: it states "done on doubles" and lists what stays unproven; its hardware package gate is passed.
2. Confirm that the tree to be installed is the commit that report names. Expected: one commit identifier, written into the header of the result record.
3. Confirm UA-6 in writing. Expected: one dated line in the record's header ("legacy data: moved", "read-only" or "stays, confirmed").

**`PREP-02` Values.** Performer: `USER`.
1. Fill the right-hand column of the second table of section 5 for B-1 to B-7. Expected: seven values with date and role; none empty.
2. If B-6 is "yes": state the guard and who watches it. Expected: one line in the record's header.

**`PREP-03` Devices and host.** Performer: `USER`, `BENCH`.
1. Install the host and the devices (UA-1, UA-2). Label every camera housing `CAM-A`, `CAM-B`, and so on; label the two microphones. Expected: every device of UA-2 is present and labelled; the count of cameras is written into the record's header.
2. Connect the PoE switch to the host's camera port only. For the room network choose one of two ways and write the choice into the record's header.
   - **Way A, the installation window.** The room network cable is plugged from here to the end of sequence 8a, for the packages, the source archives, the database server and the product's dependencies. No Core of the acceptance database runs in that window. The cable is unplugged in `PREP-08` step 1. Expected here: `ip -4 route show default` names an interface that is **not** `<camera-interface>`.
   - **Way B, the offline package set.** The cable stays unplugged for the whole run until `PREP-11`. Then these are on the host from a medium before `9A/H-01`: the Ubuntu packages of the host profile with their dependencies (`HOST-09`, `HOST-10`, `HOST-18`, `HOST-25`, `HOST-26`); the FFmpeg 9.0.2 release archive with its signature file (`HOST-12`); the product tree with its installed dependencies (`node_modules`); the PostgreSQL packages of `PREP-04`; a pusher for `PREP-06` step 1. Expected here: `ip -4 route show default` prints nothing.
3. Confirm UA-7 by looking, before `9A/H-27` measures it. Expected: the user's statement "no input-av installation on this host" in the record's header. If the host is a machine that ran input-av, it is removed first; this package does not describe the removal.

### Part B. Database and the development checks

**`PREP-04` Database server.** Performer: `USER`.
1. Provide a PostgreSQL server on the host that listens on `127.0.0.1` only, with the two project roles (an owner role and a runtime role) whose secrets the user sets. The development used PostgreSQL 18.4. **How this server is installed on Ubuntu is not written in any design document** (open point 2 of section 13); the user installs it by the site's own practice. Expected: `sudo ss -H -ltn` shows the database port with local address `127.0.0.1` and no other.
2. Make the database settings known to the Core as the host profile states in `HOST-34`. This chapter adds no other place for a secret. Expected: the check of `HOST-34` prints what the profile states.

**`PREP-05` The throw-away database.** Performer: `USER`.
1. From `<install-dir>`: `npm run db:create -- --database dems_lane_2`, then `npm run db:migrate -- --database dems_lane_2`, then `npm run db:seed -- --database dems_lane_2` (the argument form is the one the three commands state in their own source). Expected: each command exits 0.
2. `npm run db:status -- --database dems_lane_2`. Expected: exit code 0, which the command gives only when every migration file is applied with its own hash and the schema version is the one the code expects.
3. Create the throw-away media store on the evidence disk, owner `<service-user>`, mode 0700, in a folder that is not inside `<data-dir>/media/sessions`. Expected: `stat -c '%U %a'` on it prints `<service-user> 700`; `findmnt -no SOURCE --target` prints the same source for it and for `<data-dir>/media/sessions`.

**`PREP-06` A development-capture Core starts.** Performer: `USER`.
1. Provide what the development operation needs on this host: a private copy of the pinned FFmpeg as its helper program and a development signing key **in a data directory of its own**, never in the acceptance data directory. The commands are those of the product's README, "Set-up of a development-capture Core"; they have run on macOS only (to confirm in `9A/H-02`: step 2 below is their first run on Linux; open point 7). Expected: the Core of step 2 names no missing program and no unusable key.
   **The pusher.** The generated sources of this operation and the worker's own capture series (`make e2e`, step `9A/H-01.9`) encode H.264 with `libx264` on Linux, and the H.265 cases of the series encode with `libx265`. The FFmpeg that `HOST-12` builds carries no H.264 and no H.265 encoder (the container build of the development showed it: configure line without an external codec library), and the Ubuntu 24.04 package `ffmpeg` is version 6.1.1, not the pinned 9.0.2. So this private copy must be **a second, self-built FFmpeg 9.0.2 that has an H.264 encoder (and an H.265 encoder for the H.265 cases)**, in a folder of its own outside `<ffmpeg-prefix>`; it serves as a pusher and as the helper program of the development operation only, and is removed in section 14. Which encoder library it is built with decides the licence of that build; that choice is the user's and nothing of it is installed into the product. The package's own probe (`9A/H-01.10`) does not need it: it pushes with the encoder `mpeg4`, which FFmpeg carries itself. Without such a pusher, `9A/H-01` steps `.9` and `.11` and the four development checks are "not run: no pusher on the host" (open point 11).
2. Start a Core with `DEMS_CAPTURE_MODE=real`, `DEMS_CAPTURE_DEV_SOURCES=1`, the throw-away database and the throw-away media store. Expected: the log holds `capture fence passed` with the operation `REAL_DEVELOPMENT`; `sudo ss -H -ltnp` shows its listener on `127.0.0.1`.
3. If the Core refuses to start: record the check and the code. `9A/H-02`, `9A/H-03`, `9A/H-04` and `9A/H-24` are then "not run: no development-capture Core on this host", and the run continues at `PREP-07`. Expected: either step 2's result or this record line; nothing else.

Then `9A/H-02`, `9A/H-24`, `9A/H-03`, `9A/H-04` (chapter 2). After them the development-capture Core is stopped and stays stopped for the rest of the run.

Then `PREP-12` and chapter 4, `HI-04` part A only (sequence 8a). `PREP-12` is written under part D, where it stood before Revision 2; it is performed here. The rest of chapter 4 follows `PREP-11` (sequence 12).

### Part C. The acceptance database and the first boot

**`PREP-07` The acceptance database (UA-8).** Performer: `USER`. No agent performs this step.
1. `npm run db:create -- --database dems_demo`, `npm run db:migrate -- --database dems_demo`, `npm run db:seed -- --database dems_demo`. Expected: each exits 0.
2. `npm run db:status -- --database dems_demo`. Expected: exit code 0. Write the printed schema version into the record's header.
3. Note what the seed wrote: the demonstration data set, the operators with the published demonstration password, and four generated sources in the four selector slots. Expected: none; this is a fact to know. A seeded database is not yet a production database; `PREP-08` to `PREP-10` make it one as far as the product allows.

**`PREP-08` First boot, on the loopback listener.** Performer: `USER`. This is the only time a `SIMULATED` Core runs on the acceptance database. While it runs, the operators still have a password that is published.
1. `BENCH` unplugs the room network cable now, if way A of `PREP-03` was chosen; before that, `USER` reads `timedatectl show -p NTPSynchronized --value` once more. Expected: `yes` before the cable is pulled; afterwards `ip -4 route show default` prints nothing and the cable is out (seen by `BENCH`). The host is **not restarted** between this step and `PREP-11`: after a restart without a time source the clock is not reported as synchronised, and the production start of `9A/H-16` then refuses with `CAPTURE_HOST_CLOCK_NOT_SYNCHRONISED` (open point 5 of section 13).
2. Start the Core with `DEMS_CAPTURE_MODE` unset and `DEMS_DEMO_CONTROLS` unset, on the acceptance database. Expected: the log holds `capture fence passed` with the operation `SIMULATED`; `sudo ss -H -ltnp` shows its listener with local address `127.0.0.1` and no other. If the service unit does not start because the host's clock is not synchronised (host profile, `HOST-32`), record that; open point 5 of section 13 applies.
3. Open the web console in a browser **on the host itself**. Expected: the sign-in page loads from `127.0.0.1`.
4. **Start no session** in this Core, at any time. Expected, checked at step 4 of `PREP-09`: the number of sessions in the database is the number the seed wrote.

**`PREP-09` The unassign step and the operator passwords (X-2).** Performer: `USER`. Revision 2 changed what step 1 does and when: the password command needs the Core stopped, so it runs after step 4. The step numbers are kept.
1. Have the operators ready to type one new password each at the keyboard of the host, the Supervisor first; each operator types their own. Where an operator cannot be present, `USER` decides now whether that operator is skipped (the production boot then waits) or `USER` types for them (step 6). Nothing is typed yet. Once on this host, before the first real password: `USER` makes the attended check of the hidden prompt with a throw-away value, as section 2.4 of `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md` states it. Expected of that check: nothing appears while typing, not even marks; the terminal shows what is typed again afterwards, and again after Ctrl-C at the prompt.
2. In the web console, signed in as an operator who may change the capture configuration, unassign the four selector slots: both video slots and both microphone slots. Expected: the device selector shows four slots as "not assigned".
3. Read the audit list in the web console (page Security & Audit). Expected: one entry of type `CAPTURE_CONFIG_CHANGED` per unassign action; the count is written into the notes of the record.
4. Stop the Core. `npm run db:status -- --database dems_demo`. Expected: exit code 0; the row count of the session table equals the count printed in `PREP-07` step 2.
5. With the Core stopped, give every operator a password that is not the demonstration password, with the command of X-2, started by `USER` as `<service-user>` from the repository root: `npm run operator:set-password -w @dems/core-server -- --database dems_demo --data-dir <data-dir> --all-demo` (the built form: script `operator:set-password` of `apps/core-server/package.json`; to confirm in this step: that the line starts as written for a person who acts as `<service-user>`, an account without a login shell, `HOST-04`). It shows the database, the data directory and the operators who still have the demonstration password, and says that it cannot see a Core process, only connections to the database; `USER` types the word `SET`. It then prompts for each operator, the Supervisor first, twice, with nothing shown; **each operator types their own password**. No password is an argument, a variable or a piped input. While a password is typed no terminal recorder runs, the terminal is not a remote session and the screen is not shared. If the command refuses with `DATABASE_IN_USE`, a connection to the database is open: stop the Core, close every other client and run it again; nothing was changed. Expected: one line `<username>: password set, <n> session(s) ended` per operator, then `operators that still have the demo password: 0`, exit status 0. `9A/H-16` measures the same: a production Core refuses to start with `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` while even one operator still has it.
6. An operator whose first entry is left empty is skipped: the command then ends with exit status 1 and a count above 0, and `9A/H-16` waits until that operator has typed. A password typed by the installer is known to two people. For the acceptance that is stated in the record's notes ("passwords typed by: each operator" or "the installer"); for a real examination it is item A7 of section 11.

**`PREP-10` The production signing key (X-1).** Performer: `USER`.
1. As `<service-user>`, at the host's terminal, provision the production signing key where the Core reads it (`<data-dir>/signer`) with the command of X-1, from the repository root: `npm run evidence:production-key -w @dems/core-server -- --data-dir <data-dir>` (the built form: script `evidence:production-key` of `apps/core-server/package.json`; `<data-dir>` is written as an absolute path without a trailing separator; to confirm in this step: that the line starts as written for a person who acts as `<service-user>`, and that the path of `HOST-06` passes the command's directory rule, which also asks that no directory above `<data-dir>` is writable by a group or by others). It asks for the organisation and the installation device id, which are not secrets; it prints the directory, the key id, the subject and the validity window in UTC, and asks for the word `PROVISION` before a key exists. It refuses to run as root. It refuses a directory that already holds any file of a key (`KEY_EXISTS`), names the files that are present and absent and says whether that store loads; it never completes or removes one, and removing an incomplete store is `USER`'s own act (the installer's note, section 2.6). Do **not** run the repository's development key command (`evidence:dev-key`) on the acceptance data directory. Expected: exit status 0 and, after the line that begins `evidence:production-key: OK`, the lines: directory, key id, subject, `certificate: sha256` with 64 hexadecimal characters, valid from (UTC), valid until (UTC), the path of the hand-over record. Keep that output with the installation papers; the certificate sha256 goes into the record's header, it is not a secret. It is handed to whoever will verify only after `9A/H-16` has passed, by another channel than the packages, and the list of receivers is kept. The directory `<data-dir>/signer` is not copied into a backup. `9A/H-16` measures the result: a production Core refuses to start with `CAPTURE_SIGNING_KEY_UNUSABLE` when no key loads and with `CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION` when the key is a development key.
2. Set the installation device id in `/etc/dems/core.env` (`DEMS_INSTALLATION_DEVICE_ID`) to the value typed in step 1, character for character (`9A/H-16.1`). Expected: none here. Two refusals of `9A/H-16` measure it: a production Core starts only with a key whose certificate names exactly this id (`CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH` otherwise), and **the id is none of `DEMS-TEST-01`, `DEMS-IR-01`, `DEMS-JKT-07`**. Those three are the ids of the product's tests, of its published demonstration data and of its documentation; a production Core refuses each of them with `CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS`, even when the key names it. The prompt of step 1 prints `DEMS-JKT-07` as an example of the form: it is an example and never the id of an installation. The key command refuses a reserved id as soon as it is typed (`INSTALLATION_ID_RESERVED`), before a key exists; the Core's start refuses it again.
3. If X-1 or X-2 cannot be provided on the day (a command does not start on the host, or one refuses): record the refusal's code, and record `9A/H-16` as "not run: X-1 missing" or "not run: X-2 missing". Every check after sequence 10 is then "not run" for the same reason. Expected: those record lines; no workaround is attempted, and no key or password is made by another means.

Then `9A/H-16` (chapter 2).

**`PREP-11` The host joins the room network.** Performer: `USER`, `BENCH`.
1. Only after `9A/H-16` has passed: plug the room network cable in. Expected: `ip -4 route show default` names an interface that is **not** `<camera-interface>`.
2. `sudo ss -H -ltnp`. Expected: the listeners of `<service-user>` are as the host profile states in `HOST-24`. How the tablet and a web console on another machine reach the Core is open point 4; it must be settled before `9A/H-20`.
3. Only on a site that installed the helper at sequence 8a without a default route: repeat the three lines of chapter 4 that need one, `HI-03.6`, and request (b10) and step (c3) of `HI-06`. Expected: as chapter 4 states for each. In the order of Revision 4 the helper is installed now, at sequence 12, and the three lines are measured in their own steps.

### Part D. Helper, microphones, network functions

**`PREP-12` Before the helper is installed.** Performer: `USER`. Performed at sequence 8a, before `PREP-07`.
1. Read the security review's statement on the helper as delivered, named in chapter 4, step `HI-01`. Expected: the statement is made for the hash chapter 4 prints (it begins `3621e79c`), with its four conditions. If not, chapter 4 beyond `HI-04` part A is not started and `9A/H-05`, `9A/H-06`, `9A/H-25`, `9A/H-13`, `9A/H-14`, `9A/H-15` are "not run: helper not released". `9A/H-16` and the checks of the microphones, the cameras and the sessions are not affected.
2. Know what a host with and without the helper shows (Revision 4; decision C94 (j)). **Without it** a production Core on Linux starts: the journal holds one warning with the code `CAPTURE_HOST_ALIAS_HELPER_ABSENT`, the audit entry `SYSTEM_BOOT` says `addressHelperSocket: NOT_PRESENT`, and the three commissioning functions (temporary address, factory-address scan, set camera address) answer `409 COMMISSIONING_NOT_AVAILABLE`; a camera that already sits on the camera subnet is searched, tested, adopted and recorded as on any host. **With it**, complete, the Core starts, names no fault, and the entry says `PRESENT`. **With a part of it**, or with a file of it that is not as delivered, the Core refuses to start. Expected: none; a fact to know before the day.
3. Create the group: chapter 4, `HI-04` steps `.1` to `.4`. Expected: as chapter 4 states for `HI-04.4`.

Then, after `9A/H-16` and `PREP-11`: `9A/H-05`, `9A/H-25`, `9A/H-06`, `9A/H-07`, `9A/H-08`, `9A/H-12`, `9A/H-13`, `9A/H-15`, `9A/H-14`.

### Part E. Cameras

**`PREP-13` Per camera, before the Core adopts it (UA-9, UA-10).** Performer: `USER`; `BENCH` reads labels. Repeat for every camera of the acceptance.
1. Open the camera's own page from a browser on the host or on a laptop plugged into the camera switch. The web console does not relay a camera's page. Expected: the camera's sign-in page.
2. Replace the account's password with one that meets B-5, typed from where the user keeps it. Expected: the camera accepts it; signing out and in again with the new password succeeds; the old password is refused: 1 refusal seen.
   Two limits of the product are met here, in the camera's own page, before the Core sees the camera. (a) **The account's user name holds no colon.** A name with a colon cannot authenticate on the stream: the media library splits the name at its first colon. The Core would show "authentication failed" for a correct password, and each such attempt counts toward the lock-out. If the account's name has a colon, create another account on the camera. A colon in the password is allowed. (b) **Digest authentication is on for the stream.** The product answers a Digest challenge only. A camera that offers only Basic authentication is refused, the connection test says "authentication failed" with the reason `SCHEME_NOT_ALLOWED`, and the password is not sent. If the camera's page has a setting for the stream's authentication, set it to Digest.
3. Set the camera's clock to the host's time. Expected: the time the camera's page shows differs from `date` on the host by less than 2 s, read by eye.
4. Fill one line of the sheet of section 9.3 for this camera. Expected: every column filled; no password in any column.
5. A camera whose line is not complete is not connected in `9A/H-10`.

Then `9A/H-10` for each camera and `9A/H-23` for the camera of rule 4 of B-5.

### Part F. Sessions

**`PREP-14` The four slots assigned.** Performer: `TECH` or `OPER` with the capture configuration permission.
1. Assign two cameras (the profiles chosen in `9A/H-10`) and the two registered microphone inputs (primary and standby, from `9A/H-07`) to the four slots. Expected: the selector shows four assigned slots, none marked "not assigned" and none a generated source.
2. Read the pre-check of a new session. Expected: no blocking item.

Then `9A/H-17` with `9A/H-21`, `9A/H-09`, `9A/H-26` read from it, and `9A/H-18`, `9A/H-20`, `9A/H-22`, `9A/H-11`, `9A/H-19`.

## 8. The form of a check in chapters 2 and 3

Every check is written with one header line and six parts, in this order and under these names. A check with a part missing is not ready to run.

```
### 9A/H-nn  <title>

Capture operation: <none | REAL_DEVELOPMENT | REAL_PRODUCTION>   Database: <- | throw-away | acceptance>
Recording: <none | S1 | S2 | S3 | S4 | generated sources>          User actions: <UA-n, X-n>

1. What it proves      One or two sentences: the claim, and the part of the product it belongs to.
                       Then one line: what the development on doubles already showed of it, and what it could not.
2. Precondition        The checks and steps that must have passed; the devices and their state; the values of section 5 it uses.
3. Steps               Numbered 9A/H-nn.1, .2, ... Each step: the performer (USER, TECH, OPER, BENCH or SCRIPT),
                       the action, and where it is done (terminal, web console page, camera page, bench).
4. Expected result     What is seen when the product behaves as designed, step by step where it differs.
5. Pass criterion      A count ("refusals: 3 of 3"), a value against a stated bound ("inside 15,000 ms"),
                       or a named outcome ("the boot names CAPTURE_..."). Never "works", "is fine" or "as expected".
                       If a criterion has two acceptable outcomes, both are named and the one that occurred is recorded.
6. What to record      The values and file names that go into the result line of section 9.1, and what must NOT be recorded.
```

Further rules for the two chapters:

- A step that needs `sudo`, a password, a key or a hand on a device has the performer `USER`, `TECH`, `OPER` or `BENCH`. A `SCRIPT` step reads only.
- A check that reads from a session names the session (S1 to S4) and does not start another one.
- A check whose result is an observation and not a verdict (`9A/H-03` is one) says so in part 5, names the outcomes, and states which of them needs a decision by the user.
- Part 6 lists what leaves the host. Nothing in it is a secret, a real address or a recording.

## 9. The result record

The record is one file, kept by the user. Its copy for the development has the same content: it holds no secret to remove.

### 9.1 Header and lines

**Header**, written once: date; the product commit (`PREP-01`); the host's release line and processor architecture; the count of cameras with their labels and model names; the audio interface's model name; the values B-1 to B-7; the confirmations of UA-6 and UA-7; the way chosen for the room network (`PREP-03` step 2); the schema version (`PREP-07`); the certificate sha256 of the production signing key (`PREP-10`); roles present.

**One line per check**, 27 lines, in the order of section 6. A repeated check gets a new line with the next run number; earlier lines are kept.

```
check | run | result | operation | recording | measured | bound | evidence | reason or note
```

| Field | Content |
|---|---|
| check | `9A/H-nn` |
| run | 1 for the first attempt, 2 for the first repeat, and so on |
| result | exactly one of `PASS`, `FAIL`, `NOT RUN` |
| operation | the capture operation printed by the Core's log during the check, or `none` |
| recording | `-`, `S1` to `S4`, or `generated` |
| measured | the value or count the pass criterion asks for, with its unit; a named outcome where the criterion is one |
| bound | the bound it was held against, with its source: "fixed" or "B-n" |
| evidence | the file name of the collector's output or of the note that holds the observation, and who observed it (role) |
| reason or note | mandatory for `FAIL` (what was seen instead) and `NOT RUN` (which precondition, action or value was missing); for a `FAIL`, the sorting of section 10 |

Never in the record: a password, a key, a token, the user or host part of a camera's stream address, a real network address, a personal name, a frame or a sound from a recording.

**The record and the product's installation acceptance (Revision 4; decision C105 (4)).** The product can store an installation acceptance: a technician states, in the web console, the result of each check, and the Core keeps that statement with its audit entry. Its step list is a closed list of the product's contract (`INSTALLATION_ACCEPTANCE_STEP_IDS`, list version 1): exactly the 27 checks `9A/H-01` to `9A/H-27`, in the order of the recording sheet of section 9.2, each exactly once, each with one of the results `PASS`, `FAIL`, `NOT_RUN`. The list is taken from this chapter, not from a screen; a test of the product reads the sheet of section 9.2 and fails when the two differ, so a change of the sheet moves the contract's list with it. **The preparation steps `PREP-nn` and the helper's installation steps `HI-nn` are not in that list.** They are the installer's own record: the notes of this result record, the per-camera sheet of section 9.3 and the paragraph of `HI-10`. An installation acceptance stored in the product therefore says what the 27 checks gave; it does not say that the host profile was applied or how the helper was installed, and every result in it is the technician's statement, not a judgement of the Core. Storing one does not gate recording, and it replaces neither this record nor the ruling of section 11.

### 9.2 Recording sheet

Tick or fill as the run proceeds; copy each result into a line of 9.1.

| Seq | Check | Result (PASS / FAIL / NOT RUN) | Measured | Run no. | Role | Time (host clock) |
|---|---|---|---|---|---|---|
| 2 | `9A/H-27` no input-av installation | | | | | |
| 3 | `9A/H-01` host profile, builds, wrong-path refusal | | | | | |
| 5 | `9A/H-02` no child outlives the Core | | | | | |
| 6 | `9A/H-24` leftovers after a kill | | | | | |
| 7 | `9A/H-03` durability level of the disk | | | | | |
| 8 | `9A/H-04` missing prerequisite named | | | | | |
| 10 | `9A/H-16` production boot, session start refused | | | | | |
| 13 | `9A/H-05` helper as installed | | | | | |
| 14 | `9A/H-25` conflict check | | | | | |
| 15 | `9A/H-06` temporary address lifetime | | | | | |
| 16 | `9A/H-07` card listing, re-plug | | | | | |
| 17 | `9A/H-08` shared capture, level | | | | | |
| 18 | `9A/H-12` camera search, typed address | | | | | |
| 19 | `9A/H-13` factory-address scan | | | | | |
| 20 | `9A/H-15` two cameras on one address | | | | | |
| 21 | `9A/H-14` set camera address | | | | | |
| 23 | `9A/H-10` connect flow, profiles | | | | | |
| 24 | `9A/H-23` special characters | | | | | |
| 26 | `9A/H-17` S1 recorded, sealed, verified | | | | | |
| 27 | `9A/H-21` time to both ingests | | ms | | | |
| 28 | `9A/H-09` H.265 readings from S1 | | | | | |
| 29 | `9A/H-26` profile notice not raised | | | | | |
| 30 | `9A/H-18` clap offset, start and end | | ms, ms | | | |
| 31 | `9A/H-20` playback, three clients | | | | | |
| 32 | `9A/H-22` S2 camera absent at start | | | | | |
| 33 | `9A/H-11` S3 link loss and return | | | | | |
| 34 | `9A/H-19` S4 drift | | ms | | | |

### 9.3 Per-camera sheet: password changed before adoption

One line per camera. A camera without a complete line is not adopted. The password itself is never written here.

| Camera label | Model | Was it ever registered in input-av? (yes / no / not known) | Factory or earlier password replaced in the camera's own page (date, role) | Meets B-5 (yes / shorter: limit n) | Old password refused afterwards (yes) | Clock set (date) | Adopted by the Core only after the change (date) |
|---|---|---|---|---|---|---|---|
| `CAM-A` | | | | | | | |
| `CAM-B` | | | | | | | |

"Not known" is treated as "yes". The same sheet applies to the bench cameras that stay with input-av for tests: their passwords lie in that system's database in readable form, and a camera moved from the bench to a production Core gets a new password first.

### 9.4 Summary for the ruling

Written by `USER` when the lines are complete. It contains, and only contains:

1. Counts: checks `PASS`, `FAIL`, `NOT RUN`, of 27; the list of the last two with their reasons.
2. The session line: "sessions from four production sources recorded, sealed and verified: n". n = 0 is stated as 0.
3. The four checks without which no session from production sources exists: `9A/H-08`, `9A/H-09`, `9A/H-16`, `9A/H-17`, each with its result.
4. The measured values against their bounds: the clap offsets against B-1; the drift against B-2; the time to both ingests against 30 s; the three ingest counters; the first-second reading of the audio; the clock offset per camera.
5. The observation of `9A/H-03`: the durability level the disk gave, and whether a critical notice was raised in every session.
6. The per-camera sheet: cameras complete, of cameras adopted.
7. The known limits of the product that the run does not remove, each with "met in this run: yes or no". And what the package cannot show (section 1).
   - A camera absent at the start of a session is not in that session (`9A/H-22`).
   - A camera whose relay ends is lost for the rest of the session: after six tries without a picture, or at once when the stream that comes back has other parameter sets or another codec (`9A/H-11`).
   - Two streams of one camera in the same format fill one slot only; two lenses that give the same profile code cannot both be adopted (`9A/H-10`).
   - A camera account whose user name holds a colon cannot authenticate; a camera that offers only Basic authentication is refused (`PREP-13`).
   - A profile whose camera-side token is a plain number is not usable (`9A/H-10`).
   - A stream address with a query outside the closed rule is refused (`9A/H-10`).
   - A sound card is found again by its USB id and serial number, else by its port path. Two cards of one model without serial numbers cannot be told apart when one is swapped for the other on the same socket; a card without 48 kHz is refused (`9A/H-07`).
   - After a restart of the capture worker inside a session the microphones are started again and the audio has a gap that the session states; shown on doubles only (`9A/H-08`, `9A/H-17`).
   - The Core cannot read the loopback rule table, only the state of the rule's unit: a table deleted while its unit stays active is not detected at a start (`9A/H-16`, criterion 6).
   - The factory-address scan does not count the devices that answer on one address: as built it states `deviceCount: NOT_KNOWN` for every device, never "one" and never "no conflict". One factory-address camera is connected at a time; that procedure suffices for the bench, and the count is to be built before a real installation (`9A/H-13`, `9A/H-15`).
   - In production a camera is tested and adopted only at an address inside the configured camera subnet: a camera still on its factory address is brought into the subnet first (`9A/H-10`, `9A/H-14`).
   - A camera whose ONVIF answer is larger than the Core's cap for that answer is refused (`9A/H-10`).
   - HEVC is stored with the sample entry `hev1`; a player that does not open `hev1` shows nothing or says so (`9A/H-20`).
   - No password change in the web console; one signing key without rotation (section 11 item 8).
8. The word **partial** if any of the 27 is `FAIL` or `NOT RUN`.

### 9.5 Files for the collectors: the audit list and a readable track

Several collectors do not read the product directly. They take a file the user hands over: `--audit-file`, `--journal-file`, `--core-log`, `--track`. This section says where each file comes from. Every file is written into `<evidence-folder>` and stays on the host.

| File | Option | How `USER` obtains it |
|---|---|---|
| The Core's journal | `--journal-file`, `--core-log`, `--boot-log` | `sudo journalctl -u dems-core.service -b --no-pager -o cat > <evidence-folder>/core-journal-<check>.txt`, started before the step that needs it and repeated after it. For a Core started from a terminal (`REAL_DEVELOPMENT`): its output redirected into a file at the start |
| The audit entries **of one session** | `--audit-file` of the session collectors (`9A/H-17`, `9A/H-22`, `9A/H-11`) | The sealed package of the session holds them: `<data-dir>/media/sessions/SESSION-<sessionId>/audit-session-extract.jsonl`, one entry per line, written at the seal. `sudo cp` it into `<evidence-folder>` and make the copy readable by the account that runs the collector. It holds the entries of that session up to its seal, not later ones (to confirm in `9A/H-17`: that the file is plain text as stored) |
| The audit list **outside a session** (searches, card registrations, temporary addresses, scans, set-address, capture configuration) | `--audit-file` of `collect-h06`, `-h07`, `-h10`, `-h12`, `-h13`, `-h14`, `-h15` | **The product has no export of the audit list as a file.** The operation "export audit" of the page Security & Audit records an export and answers with an export number; it writes nothing the user can copy. The manual reading: `OPER` opens Security & Audit, reads the entries from the noted start time of the check to now, and writes them into a text file, one line per entry: `<time> <type> <code shown in the entry's details>`, for example `10:42:07 CAPTURE_AUDIO_INPUT_CHANGED REGISTERED`. No address, no account name and no device text is copied. That note file is handed to the collector, or the counts are written into the record directly with `OPER` as the observer. A list read by a person is evidence of what the person read |
| A readable camera track or audio | `--track` (`9A/H-09.2`, `9A/H-18.1`, `9A/H-19.5`, `9A/H-11.5`, `9A/H-08.7`) | The files of a sealed package are encrypted on the disk and owner-only. The product's own way to a readable copy is the **export**: web console, signed in as a supervisor, Evidence, the item of the session, Export; when the job is finished, **Download export** (the link lives 60 seconds and is bound to the sign-in; the download is audited). The Core also keeps the archive on its disk under `SESSION-<sessionId>/export/EXP-<id>.zip`. Check the downloaded archive with `npm run evidence:verify-export -- <archive.zip>` (it needs `unzip`, no Core and no key), unpack it into `<evidence-folder>/<session>/` and hand the camera file of the track to the collector. The archive holds the camera files in plaintext: it and the unpacked files are acceptance recordings under rule 5 of section 1, they do not leave the host, and `USER` removes the unpacked copies when the readings are done. An export marks the item as exported and writes a custody entry; that is expected and is noted in the record |

The time in a track counts from the track's own first picture, not from the operator's start click. `collect-h18.sh` is given the clock time of the clap and of the start click and assumes that the track starts at the click. The track starts later by the time the camera took to connect, which `9A/H-21` measures. That difference moves the 5 s search window of the collector, not the offset between sound and picture, which are read from the same file. If a camera's figure of `9A/H-21` is above 5,000 ms, the clap lies outside the window: `OPER` then gives the collector the click time plus that figure as the start.

## 10. A failed check

1. Record the `FAIL` line first, with what was seen. Do not repeat the check before the line is written.
2. Sort it: **installation** (the host, a cable, a device, a setting of the profile or of a camera) or **product** (the Core, the worker, the relay, the helper, a client). When unsure, sort it as product.
3. Installation: correct it by the host profile or the device's own means; repeat the check and every later check that depends on it (section 6, "Needs first"); new lines with the next run number.
4. Product: stop the checks that depend on it. Hand the development the record line and the collector's output, nothing else. A corrected tree is a new commit: `9A/H-01` and every check that had passed on the affected part are repeated on it, and the header names both commits.
5. A check is never edited to fit what was seen. If a pass criterion is wrong, that is a finding for the development, and the check stays `FAIL` or `NOT RUN` until the corrected criterion is issued.
6. `9A/H-09` has one ruled fallback: if H.265 fails there, the installer sets that camera to H.264 in the camera's own page and S1 is repeated. The record then says which codec the passing session used.

## 11. The rule for stage 2: "fit to record"

The product reaches production recording in two stages. Stage 1 is in the code: the production camera and microphone kinds may open a source. It declares nothing. **Stage 2 is the statement that the product is fit to record examinations.**

1. Stage 2 is ruled **by the user**, on the result record of this package, and on nothing else. No report of the development, no result on doubles and no partial run stands in for it.
2. "Recorded, not sealed" is not a pass of `9A/H-17`. Neither is "sealed, not verified".
3. A partial result is reported as partial (section 9.4, item 8). The package does not fix which checks must pass; it reports all 27 and marks the four of item 3.
4. Three conditions stand beside the record, each the user's:
   - the acceptance or refusal of digest authentication over the unencrypted camera network (UA-12);
   - the per-camera sheet complete for every adopted camera (UA-9);
   - the ruling on what the bench installation of input-av may do afterwards (UA-13), put to the user together with the summary.
5. Until the ruling: no real examination is recorded; the limits stated in the product's documents stay as they are; no document says "fit to record".
6. If the record does not support stage 2, nothing is declared. The code stays at stage 1 or is reverted by the development; sessions already sealed stay valid as what they are, acceptance recordings. The host profile and the helper are undone by the user with their own removal steps.
7. After a ruling in favour, the development issues the errata that withdraw the stated limits. Not before, and not on a partial pass.
8. **What a first production boot is, now that X-1 and X-2 are built.** The first issue of this chapter said that a first production boot is not reachable because no command provisions a key or sets a password. Revised: with the two commands (`operator:set-password` in `PREP-09` step 5, `evidence:production-key` in `PREP-10` step 1) a first production boot is reachable **for a bench test** on the seeded database (ruling U20). It is not yet the boot of an installation that records real examinations. The security review of the two commands (`verification/07_security_x1_x2.md` of the development task) gives two lists; they are repeated here so that this chapter can be read alone.

   **A. Must be closed before a production recording of a real examination.**

   | # | What | Why it cannot wait |
   |---|---|---|
   | A1 | Real, named operator accounts | Every audit entry and every custody entry names its actor; with the seeded accounts they would name three persons of the demonstration data set |
   | A2 | A production seed without demonstration persons, cases and evidence; the seed and reset commands refuse a production environment | Demonstration items would stand in the same evidence register and audit chain as real evidence |
   | A3 | The sign-in cards show no demonstration disclosure in `REAL_PRODUCTION` | The cards still list user names and present the installation as a demonstration |
   | A4 | Rotation of the signing key, the compromise mark and the retained certificate set | Without them a suspected compromise has no clean response |
   | A5 | Read-path hardening of the signer store | It is the first time the store holds a key that matters |
   | A6 | The certificate's fingerprint handed to whoever will verify, by a channel other than the packages, and the list of receivers kept | Without it a package is consistent with itself only |
   | A7 | Each operator's password known to that operator alone: typed by the operator at the installation, or a password change after sign-in exists | A password the installer typed is known to two people |
   | A8 | The user's decision on the missing escrow of the session keys | Loss of the Core's credential store makes every sealed recording unreadable for ever |
   | A9 | One complete `REAL_PRODUCTION` start on the Linux production host, and this attended acceptance | On the development Mac the host questions are not asked; a production Core has never started |

   **B. Acceptable for a bench test, if stated in the product's README and in the gate report.**

   | # | What | Condition |
   |---|---|---|
   | B1 | The three demonstration persons as accounts | with passwords set by X-2; recordings are test recordings and are named so |
   | B2 | The demonstration data set in the database | no real examination is recorded into it |
   | B3 | The sign-in cards still print the demonstration password, which opens nothing | loopback listener only |
   | B4 | One key id, no rotation, no compromise command | the key protects test recordings only |
   | B5 | A self-signed certificate, no hand-over yet | nobody outside receives a package as evidence |
   | B6 | No password change in the console; every change needs the host | stated |
   | B7 | No escrow of session keys | bench recordings are disposable |
   | B8 | A macOS host, on which the Linux host profile is not checked | stated as the reason that gate is not a production gate; it does not apply to this acceptance host |

   Revision 4, on A9 and B8 (ruling U21; decision C97). A production Core is allowed on Linux and on the user's Mac. On the Mac the host questions are still not asked; since decision C97 that is no longer a silent difference: the start, the boot's audit entry and every sealed manifest state it (section 1, "Which hosts may run a production Core"). A9 stays as it is for the Linux host: one complete `REAL_PRODUCTION` start there, with every host and program check asked, has not happened before this acceptance.

   The recordings of this package are bench recordings in the sense of list B (rule 5 of section 1). A ruling "fit to record" under item 1 is therefore made knowing list A: the items of A that are still open on the day are written into the summary (section 9.4), and the ruling says for each whether it is closed.

## 12. What the development already supports, and what it cannot

The development closed every part "on doubles": generated video and audio sources, a hand-written test camera, stand-ins for the system tools, a Linux container where one was available. The closing report of the development says which of the lines below it reached; this chapter was written before that report and claims no result.

| Part | What a result on doubles supports | What only this package can show | Checks |
|---|---|---|---|
| The Linux host | The programs' own checks on macOS; in a container, that they build and that a wrong-path push is refused there. A container result is a container result | The real kernel and service manager; no child outliving the Core; leftover detection; the durability level of the evidence disk; the wrong-path refusal on this host's build | `9A/H-01` to `9A/H-04`, `9A/H-24` |
| Audio | That the Core passes the intended arguments to the capture program (text equality), and a silent null device | The real card listing; a stable identity after a re-plug; shared capture opening; the rate; the first second; an audible level. On the bench of the earlier system this scheme's recordings were practically silent: a silent input is a `FAIL` | `9A/H-07`, `9A/H-08` |
| A real camera | The connect flow, the profile list and the reconnect rule against a hand-written test camera, on fake clocks | Real authentication variants and profile tokens; special characters in an account; reconnect after a link loss; connecting inside 30 s; a camera absent at start; discovery through the real firewall | `9A/H-10` to `9A/H-12`, `9A/H-21` to `9A/H-23` |
| H.265 | That the worker carries a generated H.265 stream into a file, and that such a session seals and verifies | A real camera's stream: its packetisation, long groups, late parameter sets; the notice not raised; playback in the operator's browser | `9A/H-09`, `9A/H-26`, `9A/H-20` |
| The address helper | Its refusals and its audit entries with stand-ins for the system tools | The installed file's owner and mode; the bounds on a real interface; the conflict check with the real tool; expiry of an address with the Core killed; scan and set-address on a factory-new camera; two cameras on one address | `9A/H-05`, `9A/H-06`, `9A/H-25`, `9A/H-13` to `9A/H-15` |
| Picture and sound in step | Nothing. It needs a person, microphones and cameras | The offset and the drift | `9A/H-18`, `9A/H-19` |
| A production boot and session | One session from four production-kind doubles, sealed and verified, with a key made for the test and test operators. The two commands for the key and the passwords (X-1, X-2) are built and were shown by tests on the development Mac only: a production start of the Core's own start routine on a throw-away database with a key the key command made for the test, a stand-in for the capture worker and a stated test host in place of Linux; the password command on throw-away databases with a stand-in for the terminal. No person has typed at the hidden prompt on a real terminal | A boot with the user's key and operators on the Linux host, where all host and program checks are asked; the first session from four real sources | `9A/H-16`, `9A/H-17` |
| The user's bench devices on the Mac | The camera search and the connection test against the user's own camera, if the development's record of that session says so (rulings U16, U18). No recording, no address change; the microphone path is not exercised there | Everything else on a real device | `9A/H-10`, `9A/H-12` are not replaced by it |
| No second system | Nothing. There was no host | The acceptance host carries no input-av installation | `9A/H-27` |

## 13. Open points this chapter could not settle

Each is open until the named party settles it. None is hidden in a step: where a step depends on one, the step says so.

| # | Open point | Effect on the run | Settled by |
|---|---|---|---|
| 1 | Settled for the commands: X-1 and X-2 are built (ruling U19), `evidence:production-key` and `operator:set-password`, both script entries of `apps/core-server/package.json`. Open: neither has been run on a host, and no person has typed at the hidden prompt on a real terminal. The product still has no operator-provisioning and no password change in the console, so the boot they give is for a bench test (section 11 item 8) | If a command does not start on the host or refuses, `PREP-09` step 5 or `PREP-10` step 1 is not done; `9A/H-16` and everything after it is then "not run: X-1 missing" or "X-2 missing" | the attended check of the prompt (`PREP-09` step 1), then `PREP-09` step 5 and `PREP-10` step 1 on the host; `9A/H-16` measures the result |
| 2 | No design document states how PostgreSQL is installed on the Ubuntu host. The product's own provisioning command has run on macOS only and writes under the product tree, which the host profile makes root-owned | `PREP-04` step 1 is by the site's practice until a procedure exists | the development (the controller of the task), before the day |
| 3 | The database commands accept a closed list of names; the acceptance database is therefore named `dems_demo`, and a seeded database holds the demonstration data set beside the acceptance sessions. Whether the installation goes into service on this database or on a new one after the ruling is not ruled | None on the checks. It is a question for the ruling of section 11 | the user |
| 4 | How the tablet, the phone and a web console on another machine reach a Core whose listener is on `127.0.0.1`; and the start command of a production Core in the service unit | `9A/H-20` (tablet) cannot be run before it is settled; `PREP-08`, `PREP-11` | the development; chapter 2 (`9A/H-16`) and chapter 3 (`9A/H-20`) state the result |
| 5 | The Core's unit waits for a synchronised clock (`HOST-32`), and a production start asks the same of the host and refuses with `CAPTURE_HOST_CLOCK_NOT_SYNCHRONISED` (read from the built host checks). The first boot and `9A/H-16` are done off the room network | With way A the clock synchronises in the installation window and `PREP-08` step 1 reads `yes` before the cable is pulled. How long the host keeps reporting `yes` without a time source, and whether it does after a restart, is not known. With way B the site needs a time source on the host's side, or the cable is plugged for the synchronisation and pulled again | `9A/H-01.5` and `9A/H-16.2` on the host |
| 6 | Settled in Revision 4. The entry point hands the host facts to the boot, so the host and program checks are asked at every production start; a Core that is handed none is refused with `CAPTURE_HOST_FACTS_NOT_HANDED_IN`. For the address helper see open point 10: absent as a whole it is stated, in part or wrong it is refused with `CAPTURE_HOST_ALIAS_SOCKET` (reason `SOCKET_ABSENT`), `CAPTURE_HOST_ALIAS_HELPER_UNSAFE` (`FILE_ABSENT`) or `CAPTURE_HOST_ALIAS_GRANT_UNSAFE` | None of it has run on a host | `9A/H-16.2`, `9A/H-05.7` |
| 7 | Whether the development operation with generated sources starts on Linux at all (its set-up commands have run on macOS only) | `PREP-06` step 3: four host checks become "not run" with that reason | chapter 2; the first run |
| 8 | Whether shared capture, rate and level of `9A/H-08` can be read without a session, from the microphone registration or the pre-check | If not, they are read from S1 and `9A/H-08` gets its result after `9A/H-17` has started | chapter 2, in `9A/H-08` |
| 9 | Settled for the argument form: `db:create`, `db:migrate`, `db:seed` and `db:status` all take `-- --database <name>` (their own source). Open: the exact text the collectors print | `PREP-05`, `PREP-07` | the dry run of the package, blueprint row 130 |
| 10 | Settled in Revision 4 (decision C94 (j), reversing C49 (1)): the helper is not mandatory. A production Core on Linux starts with nothing of the helper and states it (`CAPTURE_HOST_ALIAS_HELPER_ABSENT`; `SYSTEM_BOOT` member `addressHelperSocket`); it refuses a helper that is there in part or is wrong. An installation that never uses the commissioning functions need not install it | The order of section 6 (the group at sequence 8a, the installation at sequence 12). A host on which chapter 4 stops half-way cannot start its production Core until the chapter is completed or the helper is taken away as a whole (chapter 4, section 5). `PREP-12` step 2 | - |
| 11 | No pusher with an H.264 encoder is delivered for the host. `HOST-12` builds none, the Ubuntu package is another FFmpeg version, and the encoder library decides the licence of the build | `PREP-06` step 1 names what is needed; without it `9A/H-01` steps `.9` and `.11` and `9A/H-02`, `9A/H-24`, `9A/H-03`, `9A/H-04` are "not run: no pusher on the host", and criterion 5 of `9A/H-01` is not met | the user (which encoder build is acceptable on the host); the development (a series that can push with a built-in encoder) |
| 12 | Settled in Revision 4 as a stated limit (decision C103, reversing C49 (2); measured in the development's `test/hc2_nft_listing_unprivileged.md`): the Core reads the state of the loopback rule's unit and CANNOT read the rule table, because its unit holds no capability and the kernel refuses the listing to such a process. A table deleted while its unit stays active is not seen by the Core | `9A/H-16` criterion 6 is rewritten: it counts what the unit's state shows, and step `.9` is an observation. The administrator's reading of the table (`9A/H-01.3`, `.4`) is the only check of the table itself. Open as a design question, not built: whether the table's state should reach the Core through a root-made fact of the host profile | the development: the security acceptance before the lift (row 86) |

## 14. When the run is over

1. `USER` removes the throw-away database by the database server's own means, then its media store, the development key and helper copy of `PREP-06` (the second FFmpeg build with its encoder included), and the unpacked export copies of section 9.5. The product has no command for this on the host. Expected: `npm run db:status -- --database dems_lane_2` exits 1; the throw-away folder is gone; `<data-dir>` is untouched.
2. `USER` keeps the result record with the three sheets. The acceptance recordings stay in the Core's data directory; no step of this package deletes evidence.
3. `USER` rules (section 11) or states that no ruling is made yet. Either is written as the last line of the record, with the date.
