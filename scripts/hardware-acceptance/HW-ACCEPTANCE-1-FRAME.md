# DEMS Core: hardware acceptance test package, chapter 1 - the frame

**Status of this document: UNVERIFIED on real hardware.** It was written on a development Mac with no Linux host, no camera and no audio interface. No step below has been performed anywhere. This package is the instrument that verifies the product on real devices; until it has been run, every expected result in it is a statement of intent. A line the author could not settle from the design documents carries "to confirm" and is listed in section 13.

This document installs nothing and tests nothing by itself. It is a procedure for people.

## Ringkasan (Bahasa Indonesia)

Paket ini adalah prosedur uji terima perangkat keras DEMS Core. Paket dijalankan oleh **pengguna** setelah perangkat terpasang: host Linux Ubuntu 24.04, switch PoE, kamera IP dan antarmuka audio USB. Bab 1 ini adalah kerangkanya: urutan 27 pemeriksaan (`9A/H-01` sampai `9A/H-27`), operasi perekaman yang dibutuhkan tiap pemeriksaan, langkah persiapan, hal-hal yang hanya boleh dilakukan pengguna, lembar hasil, dan aturan keputusan akhir. Isi tiap pemeriksaan ada di bab 2 dan 3; pemasangan helper alamat ada di bab 4.

Yang hanya dilakukan pengguna: memasang profil host dan helper dengan hak administrator, memigrasi basis data host, menyediakan kunci tanda tangan produksi dan kata sandi operator yang bukan kata sandi demo, mengetik kata sandi kamera, mengganti kata sandi setiap kamera sebelum diadopsi (wajib untuk kamera yang pernah terdaftar di input-av), dan memastikan input-av tidak terpasang di host uji. Tidak ada rahasia yang ditulis ke dokumen, lembar hasil, atau percakapan.

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
| 4 | `HW-ACCEPTANCE-4-HELPER-INSTALLATION.md` | Installation of the address helper, ten steps for the user | steps `HI-01` to `HI-10` |
| - | `scripts/host/HOST-PROFILE-UBUNTU-24.04.md` | The host profile that `9A/H-01` applies; it exists already | items `HOST-01` to `HOST-49` |

A check is always written with its prefix, `9A/H-nn`. Inside a chapter, the steps of a check are numbered `9A/H-nn.1`, `9A/H-nn.2`, and so on. Chapters 2 and 3 write every check in the six-part form of section 8.

## 3. Words used in every chapter

**Capture operation.** A Core decides once, at its start, what it records. The boot log line `capture fence passed` prints the operation.

| Capture operation | Set by | What it records | Used in this package for |
|---|---|---|---|
| `SIMULATED` | `DEMS_CAPTURE_MODE` unset or `simulated` | Nothing. Sessions come from the simulator | The first boot only (`PREP-08`), on the loopback listener, with no session started |
| `REAL_DEVELOPMENT` | `DEMS_CAPTURE_MODE=real` and `DEMS_CAPTURE_DEV_SOURCES=1` | Generated test sources only | The host checks that need a recording before any production boot exists: `9A/H-02`, `9A/H-03`, `9A/H-04`, `9A/H-24`. Always on the throw-away database, never on the acceptance database |
| `REAL_PRODUCTION` | `DEMS_CAPTURE_MODE=real`, `DEMS_CAPTURE_DEV_SOURCES` unset | Production sources only: adopted cameras and registered microphone inputs | Every check from `9A/H-16` on |
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
| UA-3 | Install the address helper as chapter 4 states, with `sudo`: a root service on a local socket, one group, two unit files, no sudoers file; compare the printed hash with the file in hand | `9A/H-05` | `9A/H-05`, `9A/H-06`, `9A/H-25`, `9A/H-13` to `9A/H-15` |
| UA-4 | Type every camera password: in the camera's own page when changing it, in the web console when connecting the camera or setting its address | `9A/H-10`, `9A/H-14`, `9A/H-23` | `9A/H-10`, `9A/H-14`, `9A/H-17`, `9A/H-23` |
| UA-5 | Provide a person at the bench for the physical steps | `9A/H-06` | `9A/H-06` to `9A/H-08`, `9A/H-11`, `9A/H-13`, `9A/H-15`, `9A/H-18`, `9A/H-19`, `9A/H-22` |
| UA-6 | The legacy data of input-av on the development machine has no writer: the folder is moved out of the repository, set read-only, or its staying is confirmed in writing. Independent of the acceptance host | any start of an input-av program, in any task | none of the 27 checks; a standing condition |
| X-1 | Provide the production signing key in the Core's data directory. **No command of the repository provisions one**; the development key command must not be used (`PREP-10`) | `9A/H-16` | `9A/H-16`, `9A/H-17` |
| X-2 | Give every operator a password that is not the published demonstration password (`PREP-09`). **The product has no password-change function at the time of writing**; the means is the user's (open point 1 of section 13) | `9A/H-16` | `9A/H-16`, `9A/H-17` |
| UA-7 | Confirm that the acceptance host carries no input-av installation: no service, no helper, no sudoers line, no generated audio configuration. If one is found, remove it first. Checked by `9A/H-27` | `9A/H-01` | `9A/H-27`, then all |
| UA-8 | Migrate the acceptance host's database (`PREP-05`, `PREP-07`). No agent migrates a database on this host | `9A/H-02` | every check with a Core |
| UA-9 | Change the password of **every** camera of the acceptance in the camera's own page before the Core adopts it, and fill the per-camera sheet of section 9.3 (`PREP-13`). Mandatory without exception for a camera that was ever registered in input-av: its old password lies in that system's database in readable form | `9A/H-10` for that camera | `9A/H-10`, `9A/H-17`; condition of section 11 |
| UA-10 | Set every camera's clock to the host's time in the camera's own page (`PREP-13`). The product does not set a camera's clock | `9A/H-10` | `9A/H-17` (the clock offset read as `9A/H-09`) |
| UA-11 | Decide and write down the values of section 5 that have none today | `PREP-02` | `9A/H-18`, `9A/H-19`, `9A/H-11`, `PREP-13` |
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
| 1 | `PREP-01` to `PREP-03` | Entry conditions, values set, devices in place | none | - | - | - |
| 2 | `9A/H-27` | The host carries no input-av installation | none | - | - | UA-7 |
| 3 | `9A/H-01` | The host profile applied; the capture programs built and self-checked; the worker's listener refuses a push to a wrong path on this host's build | none | - | - | `9A/H-27` |
| 4 | `PREP-04` to `PREP-06` | Database server; the throw-away database; a development-capture Core starts | `REAL_DEVELOPMENT` | throw-away | - | `9A/H-01` |
| 5 | `9A/H-02` | No child process outlives a Core that is ended abruptly | `REAL_DEVELOPMENT` | throw-away | one recording from generated sources, killed | seq 4 |
| 6 | `9A/H-24` | No leftover after the kill; a planted leftover is named at the next start | `REAL_DEVELOPMENT` | throw-away | the same kill, then one start | `9A/H-02` |
| 7 | `9A/H-03` | The durability level the evidence disk gives | `REAL_DEVELOPMENT` | throw-away | one recording from generated sources on the evidence disk | seq 4 |
| 8 | `9A/H-04` | A missing prerequisite is named at start; restored, none is named | `REAL_DEVELOPMENT` | throw-away | none (starts only) | seq 4 |
| 9 | `PREP-07` to `PREP-10` | The acceptance database migrated and seeded; first boot on the loopback listener: operator passwords replaced, the four slots unassigned; the production signing key in place | `SIMULATED`, once | acceptance | none; no session is started | `9A/H-01` |
| 10 | `9A/H-16` | A production Core starts on an unassigned selector and refuses a session start | `REAL_PRODUCTION` | acceptance | none (the refusal is the result) | seq 9, X-1, X-2 |
| 11 | `PREP-11` | The host joins the room network | - | - | - | `9A/H-16` passed |
| 12 | Chapter 4, `HI-01` to `HI-10` | The user installs the address helper | none | - | - | `9A/H-01` |
| 13 | `9A/H-05` | The helper as installed: owner, mode, refusals, the Core's own boot check of it | none, then `REAL_PRODUCTION` | acceptance | none | seq 12, `9A/H-16` |
| 14 | `9A/H-25` | The conflict check refuses an address that another device holds | `REAL_PRODUCTION` | acceptance | none | `9A/H-05` |
| 15 | `9A/H-06` | A temporary address is added, refused on conflict, and removed after its lifetime with the Core killed | `REAL_PRODUCTION` | acceptance | none | `9A/H-05`, `9A/H-25` |
| 16 | `9A/H-07` | The real card listing; the same identity after a re-plug | `REAL_PRODUCTION` | acceptance | none | `9A/H-16` |
| 17 | `9A/H-08` | Shared capture opens on both inputs; rate; audible level on both | `REAL_PRODUCTION` | acceptance | none before S1; the first-second reading is taken from S1 | `9A/H-07` |
| 18 | `9A/H-12` | Camera search on the real network; a typed address yields a candidate | `REAL_PRODUCTION` | acceptance | none | `9A/H-16`, a camera on the camera subnet |
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

All 27 checks are in the table: `9A/H-01` to `9A/H-27`, each once.

**Why this order differs from the numbering.**

- `9A/H-27` comes first: an input-av installation beside the Core would falsify every later result.
- `9A/H-16` comes before the helper, the microphones and the cameras. A production Core starts with no source assigned; the commissioning functions and the camera connect flow need that running production Core.
- `9A/H-24` follows `9A/H-02` directly: both read the same kill.
- `9A/H-25` comes before `9A/H-06`, whose conflict case depends on it.
- `9A/H-15` comes before `9A/H-14`: it needs two cameras that still hold the same factory address, and `9A/H-14` changes one of them.
- `9A/H-09` has no recording of its own. The product records a session only from four assigned sources, so one camera cannot be recorded alone; its readings are taken from S1.
- `9A/H-11` and `9A/H-22` come after `9A/H-17`: each needs a session, and the first session from production sources is kept free of an injected fault.
- `9A/H-19` comes last: it is the longest, and nothing waits for it.

**What may be left "not run" without voiding `9A/H-17`.** `9A/H-17` needs `9A/H-27`, `9A/H-01`, `9A/H-16`, `9A/H-07`, `9A/H-08`, `9A/H-10` for two cameras, and one of the two ways of `9A/H-12` to find a camera. If both cameras already sit on the camera subnet, `9A/H-05`, `9A/H-06`, `9A/H-25`, `9A/H-13`, `9A/H-14` and `9A/H-15` may wait; `9A/H-02`, `9A/H-03`, `9A/H-04` and `9A/H-24` may wait as well. A check left out is recorded "not run" with its reason and appears in the summary; it is not counted as passed, and the ruling of section 11 is made knowing it.

## 7. The preparation steps

Each step names its performer and its expected result. A step whose expected result does not appear is stopped there and recorded in the notes of the result record; the next step is not started.

### Part A. Before the day

**`PREP-01` Entry conditions.** Performer: `USER`.
1. Read the closing report of the development. Expected: it states "done on doubles" and lists what stays unproven; its hardware package gate is passed.
2. Confirm that the tree to be installed is the commit that report names. Expected: one commit identifier, written into the header of the result record.
3. Confirm UA-6 in writing. Expected: one dated line in the record's header ("legacy data: moved", "read-only" or "stays, confirmed").

**`PREP-02` Values.** Performer: `USER`.
1. Fill the right-hand column of the second table of section 5 for B-1 to B-6. Expected: six values with date and role; none empty.
2. If B-6 is "yes": state the guard and who watches it. Expected: one line in the record's header.

**`PREP-03` Devices and host.** Performer: `USER`, `BENCH`.
1. Install the host and the devices (UA-1, UA-2). Label every camera housing `CAM-A`, `CAM-B`, and so on; label the two microphones. Expected: every device of UA-2 is present and labelled; the count of cameras is written into the record's header.
2. Connect the PoE switch to the host's camera port only. Leave the room network cable **unplugged**. Expected: the host has no default route: `ip -4 route show default` prints nothing.
3. Confirm UA-7 by looking, before `9A/H-27` measures it. Expected: the user's statement "no input-av installation on this host" in the record's header. If the host is a machine that ran input-av, it is removed first; this package does not describe the removal.

### Part B. Database and the development checks

**`PREP-04` Database server.** Performer: `USER`.
1. Provide a PostgreSQL server on the host that listens on `127.0.0.1` only, with the two project roles (an owner role and a runtime role) whose secrets the user sets. The development used PostgreSQL 18.4. **How this server is installed on Ubuntu is not written in any design document** (open point 2 of section 13); the user installs it by the site's own practice. Expected: `sudo ss -H -ltn` shows the database port with local address `127.0.0.1` and no other.
2. Make the database settings known to the Core as the host profile states in `HOST-34`. This chapter adds no other place for a secret. Expected: the check of `HOST-34` prints what the profile states.

**`PREP-05` The throw-away database.** Performer: `USER`.
1. From `<install-dir>`: `npm run db:create -- --database dems_lane_2`, then `npm run db:migrate -- --database dems_lane_2`, then `npm run db:seed -- --database dems_lane_2` (to confirm: the argument form of the last two). Expected: each command exits 0.
2. `npm run db:status -- --database dems_lane_2`. Expected: exit code 0, which the command gives only when every migration file is applied with its own hash and the schema version is the one the code expects.
3. Create the throw-away media store on the evidence disk, owner `<service-user>`, mode 0700, in a folder that is not inside `<data-dir>/media/sessions`. Expected: `stat -c '%U %a'` on it prints `<service-user> 700`; `findmnt -no SOURCE --target` prints the same source for it and for `<data-dir>/media/sessions`.

**`PREP-06` A development-capture Core starts.** Performer: `USER`.
1. Provide what the development operation needs on this host: a private copy of the pinned FFmpeg as its helper program and a development signing key **in a data directory of its own**, never in the acceptance data directory. The commands are those of the product's README, "Set-up of a development-capture Core"; they have run on macOS only (to confirm on this host in chapter 2). Expected: the Core of step 2 names no missing program and no unusable key.
2. Start a Core with `DEMS_CAPTURE_MODE=real`, `DEMS_CAPTURE_DEV_SOURCES=1`, the throw-away database and the throw-away media store. Expected: the log holds `capture fence passed` with the operation `REAL_DEVELOPMENT`; `sudo ss -H -ltnp` shows its listener on `127.0.0.1`.
3. If the Core refuses to start: record the check and the code. `9A/H-02`, `9A/H-03`, `9A/H-04` and `9A/H-24` are then "not run: no development-capture Core on this host", and the run continues at `PREP-07`. Expected: either step 2's result or this record line; nothing else.

Then `9A/H-02`, `9A/H-24`, `9A/H-03`, `9A/H-04` (chapter 2). After them the development-capture Core is stopped and stays stopped for the rest of the run.

### Part C. The acceptance database and the first boot

**`PREP-07` The acceptance database (UA-8).** Performer: `USER`. No agent performs this step.
1. `npm run db:create -- --database dems_demo`, `npm run db:migrate -- --database dems_demo`, `npm run db:seed -- --database dems_demo`. Expected: each exits 0.
2. `npm run db:status -- --database dems_demo`. Expected: exit code 0. Write the printed schema version into the record's header.
3. Note what the seed wrote: the demonstration data set, the operators with the published demonstration password, and four generated sources in the four selector slots. Expected: none; this is a fact to know. A seeded database is not yet a production database; `PREP-08` to `PREP-10` make it one as far as the product allows.

**`PREP-08` First boot, on the loopback listener.** Performer: `USER`. This is the only time a `SIMULATED` Core runs on the acceptance database. While it runs, the operators still have a password that is published.
1. Confirm the host is not on the room network. Expected: `ip -4 route show default` prints nothing; the room network cable is unplugged (seen by `BENCH`).
2. Start the Core with `DEMS_CAPTURE_MODE` unset and `DEMS_DEMO_CONTROLS` unset, on the acceptance database. Expected: the log holds `capture fence passed` with the operation `SIMULATED`; `sudo ss -H -ltnp` shows its listener with local address `127.0.0.1` and no other. If the host's clock cannot synchronise without the room network and the service unit therefore does not start (host profile, `HOST-32`), record that; open point 5 of section 13 applies.
3. Open the web console in a browser **on the host itself**. Expected: the sign-in page loads from `127.0.0.1`.
4. **Start no session** in this Core, at any time. Expected, checked at step 4 of `PREP-09`: the number of sessions in the database is the number the seed wrote.

**`PREP-09` Operator passwords and the unassign step (X-2).** Performer: `USER`.
1. Give every operator a password of their own that is not the demonstration password, by the user's means (open point 1). Expected: none measurable here; `9A/H-16` measures it, because a production Core refuses to start with `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` while even one operator still has it.
2. In the web console, signed in as an operator who may change the capture configuration, unassign the four selector slots: both video slots and both microphone slots. Expected: the device selector shows four slots as "not assigned".
3. Read the audit list. Expected: one entry of type `CAPTURE_CONFIG_CHANGED` per unassign action; the count is written into the notes of the record.
4. Stop the Core. `npm run db:status -- --database dems_demo`. Expected: exit code 0; the row count of the session table equals the count printed in `PREP-07` step 2.

**`PREP-10` The production signing key (X-1).** Performer: `USER`.
1. Place the production signing key where the Core reads it (`<data directory>/signer`), by the user's means. Do **not** run the repository's development key command on the acceptance data directory. Expected: none measurable here; `9A/H-16` measures it. A production Core refuses to start with `CAPTURE_SIGNING_KEY_UNUSABLE` when no key loads and with `CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION` when the key is a development key.
2. If X-1 or X-2 cannot be provided on the day: record `9A/H-16` as "not run: X-1 missing" or "not run: X-2 missing". Every check after sequence 10 is then "not run" for the same reason. Expected: those record lines; no workaround is attempted.

Then `9A/H-16` (chapter 2).

**`PREP-11` The host joins the room network.** Performer: `USER`, `BENCH`.
1. Only after `9A/H-16` has passed: plug the room network cable in. Expected: `ip -4 route show default` names an interface that is **not** `<camera-interface>`.
2. `sudo ss -H -ltnp`. Expected: the listeners of `<service-user>` are as the host profile states in `HOST-24`. How the tablet and a web console on another machine reach the Core is open point 4; it must be settled before `9A/H-20`.

### Part D. Helper, microphones, network functions

**`PREP-12` Before the helper is installed.** Performer: `USER`.
1. Read the security review's statement on the helper as delivered, named in chapter 4, step `HI-01`. Expected: its findings on the helper are stated as closed. If not, chapter 4 is not started and `9A/H-05`, `9A/H-06`, `9A/H-25`, `9A/H-13`, `9A/H-14`, `9A/H-15` are "not run: helper not released".

Then chapter 4, and `9A/H-05`, `9A/H-25`, `9A/H-06`, `9A/H-07`, `9A/H-08`, `9A/H-12`, `9A/H-13`, `9A/H-15`, `9A/H-14`.

### Part E. Cameras

**`PREP-13` Per camera, before the Core adopts it (UA-9, UA-10).** Performer: `USER`; `BENCH` reads labels. Repeat for every camera of the acceptance.
1. Open the camera's own page from a browser on the host or on a laptop plugged into the camera switch. The web console does not relay a camera's page. Expected: the camera's sign-in page.
2. Replace the account's password with one that meets B-5, typed from where the user keeps it. Expected: the camera accepts it; signing out and in again with the new password succeeds; the old password is refused: 1 refusal seen.
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

**Header**, written once: date; the product commit (`PREP-01`); the host's release line and processor architecture; the count of cameras with their labels and model names; the audio interface's model name; the values B-1 to B-6; the confirmations of UA-6 and UA-7; the schema version (`PREP-07`); roles present.

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
7. The known limits of the product that the run does not remove: a camera absent at the start of a session is not in that session; a camera whose relay ends is lost for the rest of the session; two streams of one camera in the same format fill one slot only. And what the package cannot show (section 1).
8. The word **partial** if any of the 27 is `FAIL` or `NOT RUN`.

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
| A production boot and session | One session from four production-kind doubles, sealed and verified, with a key made for the test and test operators | A boot with the user's key and operators; the first session from four real sources | `9A/H-16`, `9A/H-17` |
| No second system | Nothing. There was no host | The acceptance host carries no input-av installation | `9A/H-27` |

## 13. Open points this chapter could not settle

Each is open until the named party settles it. None is hidden in a step: where a step depends on one, the step says so.

| # | Open point | Effect on the run | Settled by |
|---|---|---|---|
| 1 | The product has no operator-provisioning and no password-change function. X-2 has no tool | Without a means, `PREP-09` step 1 cannot be done; `9A/H-16` and everything after it is "not run: X-2 missing" | the user, before the day; or a tool delivered by the development |
| 2 | No design document states how PostgreSQL is installed on the Ubuntu host. The product's own provisioning command has run on macOS only and writes under the product tree, which the host profile makes root-owned | `PREP-04` step 1 is by the site's practice until a procedure exists | the development (the controller of the task), before the day |
| 3 | The database commands accept a closed list of names; the acceptance database is therefore named `dems_demo`, and a seeded database holds the demonstration data set beside the acceptance sessions. Whether the installation goes into service on this database or on a new one after the ruling is not ruled | None on the checks. It is a question for the ruling of section 11 | the user |
| 4 | How the tablet, the phone and a web console on another machine reach a Core whose listener is on `127.0.0.1`; and the start command of a production Core in the service unit | `9A/H-20` (tablet) cannot be run before it is settled; `PREP-08`, `PREP-11` | the development; chapter 2 (`9A/H-16`) and chapter 3 (`9A/H-20`) state the result |
| 5 | The Core's unit waits for a synchronised clock (`HOST-32`); the first boot is done off the room network | If no time source is reachable off the room network, the first boot may need the clock synchronised first and the cable removed again | chapter 2, in `9A/H-01` |
| 6 | Whether a production Core that finds no helper installed refuses to start, or starts with the commissioning functions unavailable | If `9A/H-16` is refused for the missing helper, record the code, do chapter 4, repeat `9A/H-16` as run 2. That is a finding, not a pass of run 1 | chapter 2, in `9A/H-16` |
| 7 | Whether the development operation with generated sources starts on Linux at all (its set-up commands have run on macOS only) | `PREP-06` step 3: four host checks become "not run" with that reason | chapter 2; the first run |
| 8 | Whether shared capture, rate and level of `9A/H-08` can be read without a session, from the microphone registration or the pre-check | If not, they are read from S1 and `9A/H-08` gets its result after `9A/H-17` has started | chapter 2, in `9A/H-08` |
| 9 | The argument form of `db:migrate` and `db:seed` on this host, and the exact text the collectors print | `PREP-05`, `PREP-07` | the package's scripts and their dry run |

## 14. When the run is over

1. `USER` removes the throw-away database by the database server's own means, then its media store, and the development key and helper copy of `PREP-06`. The product has no command for this on the host. Expected: `npm run db:status -- --database dems_lane_2` exits 1; the throw-away folder is gone; `<data-dir>` is untouched.
2. `USER` keeps the result record with the three sheets. The acceptance recordings stay in the Core's data directory; no step of this package deletes evidence.
3. `USER` rules (section 11) or states that no ruling is made yet. Either is written as the last line of the record, with the date.
