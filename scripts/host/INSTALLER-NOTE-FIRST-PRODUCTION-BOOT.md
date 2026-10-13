# DEMS Core: installer note - from a seeded database to a first production boot

**Status of this document: a map, UNVERIFIED on a host.** It was written on a development Mac. No step below has been performed on Ubuntu 24.04. Every step points to the document that holds the commands, and that document is the authority. Where this note and one of those documents differ, the other document is right and this note is the defect. One exception since Revision 2: the two command lines of section 2 are written here, copied from the script entries of `apps/core-server/package.json`; where this note and that file differ, the file is right.

**Revision 2 (2026-10-13)**, after ruling U19 of the development task. The first issue of this note said that a first production boot is not reachable from this repository, because no command provisions a production signing key and no tool replaces the operators' passwords. Both commands are built now. Section 2 is rewritten to the sequence that uses them; step 7 of section 4 and sections 5 and 6 follow it. Nothing else of the path is changed by this revision. Neither command has been run on a host, by anyone.

**Stated first, because it decides everything after it: the first production boot that this sequence gives is a boot for a BENCH TEST on the seeded database.** It is not the boot of an installation that records real examinations. No operation of the product creates operators, the database carries the demonstration data set, and there is no key escrow and no hardware key store (section 2.9).

## Ringkasan (Bahasa Indonesia)

Catatan ini adalah peta bagi pemasang: urutan dari basis data yang baru di-seed sampai Core pertama kali dijalankan dalam operasi produksi (`REAL_PRODUCTION`), dan di dokumen mana tiap langkah ditulis. Catatan ini tidak memasang apa pun dan belum diverifikasi pada host Ubuntu 24.04. Semua langkah dilakukan oleh **pengguna** di host; tidak ada langkah yang dilakukan agen.

**Revisi 2 (2026-10-13). Hal terpenting: boot produksi pertama yang dihasilkan urutan ini adalah boot untuk UJI BANGKU pada basis data hasil seed, bukan untuk merekam pemeriksaan sungguhan.** Dua hal yang dahulu belum tersedia kini mempunyai perintah di repositori (bagian 2); keduanya belum pernah dijalankan pada host:

1. **Kata sandi operator yang bukan kata sandi demo**: perintah `operator:set-password`, dijalankan di terminal host dengan Core dihentikan. Setiap operator mengetik kata sandinya sendiri, Supervisor lebih dahulu. Kata sandi tidak tampil saat diketik dan tidak pernah menjadi argumen, variabel, atau masukan dari berkas.
2. **Kunci penandatanganan produksi**: perintah `evidence:production-key`, dijalankan sebagai akun layanan Core, bukan root. Perintah ini tidak meminta rahasia. Sidik jari sertifikat diserahkan kepada pihak yang akan memverifikasi **hanya setelah boot produksi pertama berhasil**, melalui saluran lain selain paket bukti, dan daftar penerimanya disimpan.

Batasnya: produk belum punya fungsi pembuatan operator, basis data masih memuat data demo, tidak ada escrow kunci dan tidak ada penyimpan kunci perangkat keras. Folder `signer` tidak boleh ikut dicadangkan; yang dicadangkan hanya sertifikat.

Urutan singkatnya: (a) terapkan profil host (`scripts/host/`); (b) siapkan server basis data, lalu `db:create`, `db:migrate`, `db:seed`; (c) boot pertama dalam operasi simulasi, hanya pada `127.0.0.1` dan tanpa jaringan ruangan, untuk **mengosongkan keempat slot pemilih perangkat**, karena seed mengisinya dengan sumber buatan yang ditolak Core produksi; (d) dengan Core dihentikan, jalankan kedua perintah di atas, kata sandi lebih dahulu lalu kunci; (e) boot produksi pertama (pemeriksaan `9A/H-16`); (f) pasang helper alamat (bab 4 paket uji perangkat keras), ganti kata sandi tiap kamera di halaman kamera itu sendiri **sebelum** kamera diadopsi, lalu isi keempat slot dengan perangkat produksi.

Core produksi dengan slot kosong tetap dapat berjalan, tetapi menolak memulai sesi sampai keempat slot diisi perangkat produksi. Core yang dijalankan dari cabang ini memerlukan `db:migrate` lebih dulu pada basis data yang dibuat sebelum cabang ini. Pencarian kamera hanya pemindaian aktif. Dokumen ini tidak memuat alamat jaringan, kata sandi, atau kunci apa pun.

## 1. Reader, scope, performers

| | |
|---|---|
| Reader | The installer who brings a DEMS Core into production operation on the Ubuntu 24.04 host, and whoever plans that day |
| Scope | The order of the steps between "the database is seeded" and "a `REAL_PRODUCTION` Core has started once", and what follows until a session can start. Where each step is written |
| Not in scope | The commands of the other steps (they are in the documents of section 3), the hardware checks, the acceptance ruling |
| Performers | **Every step is performed by the user**, on the host, with administrator rights where the step says `sudo`. In section 2 "the user" is the installer and, for a password, the operator it belongs to. Steps performed by a development agent, by a script on its own, or by the Core: **0** |
| Secrets | This note holds no credential, no key and no address of any network, and no example of a password, not even an invented one. Passwords are typed by their owners at the prompt of the command and are never written into a document, a script argument, a variable or a record sheet |

## 2. The signing key and the operator passwords: the two commands

The first issue of this note listed these two as things the repository cannot provide. Each has a command now.

| # | What | What the Core does without it | The command | Who runs it |
|---|---|---|---|---|
| X-2 | **Operator passwords that are not the published demonstration password** | A `REAL_PRODUCTION` Core refuses to start while even one operator's stored credential still verifies against the demonstration password: `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` (it also refuses when the operators cannot be read) | script `operator:set-password` of `apps/core-server/package.json`. `db:seed` writes the demonstration password for every operator; the web console has no password-change function | USER (the installer) starts it; each operator types their own password |
| X-1 | **A production signing key** in `<data-dir>/signer` | A `REAL_PRODUCTION` Core refuses to start: `CAPTURE_SIGNING_KEY_UNUSABLE` when no key loads, `CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION` when the key is a development key | script `evidence:production-key` of the same file. The development key command (`evidence:dev-key`) must never be run on the production data directory | USER (the installer), as `<service-user>`, never as root |

`<data-dir>` and `<service-user>` are the placeholders of the host profile: the Core's data directory, as an absolute path, and the account the Core runs as.

Sources: `apps/core-server/package.json` (the two script entries); the development records `implementation/206_x1_production_key_command.md`, `implementation/215_x2_set_password_command.md` and `implementation/213_x2_secret_prompt.md` under `docs/2026-10-12_input_av_core_adapter_plan/`, and the security review `verification/07_security_x1_x2.md` of the same folder; `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md`, section 4 (X-1, X-2), `PREP-09`, `PREP-10` and section 11 item 8.

No workaround is attempted when one of the two commands refuses: a development key, a kept demonstration password, or a key or password made by another means is not a "temporary" production set-up. The refusal is recorded with its code and the sequence stops there.

### 2.1 The four-step sequence

| # | Step | Performer | Command line, from the repository root | Result that lets the next step start |
|---|---|---|---|---|
| 1 | The database exists, is on the current schema and is seeded (steps 2 to 3a of section 4). The slots are unassigned and the Core is **stopped** (steps 5 and 6 of section 4) | USER | scripts `db:create`, `db:migrate`, `db:seed`, `db:status`; their lines are in `PREP-07` | `db:status` exits 0; no Core runs on this database |
| 2 | **X-2.** Every operator who still has the demonstration password gets a new one. The command reads the Core's own connection file in `<data-dir>`, shows the database, the data directory and the list of operators, and asks for the word `SET` before the first prompt | USER (installer) starts it as `<service-user>`; **each operator types their own password, the Supervisor first** (section 2.2) | `npm run operator:set-password -w @dems/core-server -- --database <name> --data-dir <data-dir> --all-demo` | one line `<username>: password set, <n> session(s) ended` per operator, then `operators that still have the demo password: 0`; exit status 0 |
| 3 | **X-1.** The production signing key is made in `<data-dir>/signer`. The command asks for two values that are not secrets, the organisation and the installation device id; it prints the directory, the key id, the subject and the validity window in UTC, and asks for the word `PROVISION` before anything is written | USER (installer), as `<service-user>`, never as root | `npm run evidence:production-key -w @dems/core-server -- --data-dir <data-dir>` | the line that begins `evidence:production-key: OK`, with the directory, key id, subject, `certificate: sha256` and 64 hexadecimal characters, the validity window and the path of the hand-over record; exit status 0 |
| 4 | Set the installation identity in the environment file: `DEMS_INSTALLATION_DEVICE_ID` equal to the value typed in step 3, character for character, and `DEMS_INSTALLATION_NAME`; no development switch. Then the first production boot (step 8 of section 4) | USER | host profile `HOST-34`; check `9A/H-16` | the Core names the operation `REAL_PRODUCTION` |

The arguments, as the two commands take them:

| Command | Argument | Meaning |
|---|---|---|
| `operator:set-password` | `--database <name>` | the name of the database. Required |
| | `--data-dir <data-dir>` | the Core's data directory, absolute. Required; there is no default |
| | `--all-demo` | the walk over every operator who still has the demonstration password |
| | `--username <username>` | in place of `--all-demo`: one operator, also one whose password is no longer the demonstration one (a forgotten password) |
| `evidence:production-key` | `--data-dir <data-dir>` | the Core's data directory, absolute, written without `..` and without a trailing separator. Required; there is no default and no other option |

For one operator the line is `npm run operator:set-password -w @dems/core-server -- --database <name> --data-dir <data-dir> --username <username>`. Neither command has an option that takes a password; an option of that kind is a usage error (exit status 2) and nothing is opened. Exit status of both: 0 done, 1 refused or not complete, 2 usage.

To confirm on the host, in `PREP-09` step 5 and `PREP-10` step 1 of the hardware procedure: that the two lines start as written when the person at the terminal acts as `<service-user>`. The host profile gives that account no login shell (`HOST-04`), and on the development Mac the script form of neither command was started by a person at a terminal.

### 2.2 Who types each password

- **Each operator types their own password**, at the keyboard of the host, when the command names their user name. The Supervisor is asked first; the command orders the walk that way.
- Each password is typed twice. Nothing is shown while it is typed, not even marks.
- The installer starts the command and types the word `SET`. The installer types no password of an operator. Where an operator cannot be present, the installer leaves that operator's first entry empty: the command skips that operator, ends with exit status 1 and says how many still have the demonstration password. The production boot then refuses until that operator has come and the command has been run again.
- A password that the installer typed for an operator is known to two people. For a bench test this is written into the notes of the result record ("passwords typed by: each operator" or "the installer"); for a real examination it is item A7 of the list in section 2.9.
- The command refuses a new password that is shorter than 12 characters or longer than 128, that holds a character outside printable ASCII (letters with accents and other scripts are not accepted), that is or contains the demonstration password, that is or contains the operator's user name, that is one character repeated, or that was already given to another operator in the same run. A refusal names its reason, never the value, and counts as one of three tries.
- When a password is set, every open session of that operator ends and that operator's biometric sign-in on a tablet or phone is revoked. One audit entry `OPERATOR_PASSWORD_SET` is written per operator. It says that and when a password was set from the host, and for which operator; it does not say who sat at the keyboard.
- A `db:seed` or `db:reset` after this step writes the demonstration password again; the next production boot then refuses, and step 2 is repeated.

### 2.3 The "Core stopped" test sees connections, not a process

`operator:set-password` must run with the Core of that database stopped. What the command can test of this is limited, and the installer must know the limit:

- The command cannot see a Core process. The Core holds no lock and writes no process file. The command sees **connections to the database**, of every role, and nothing else.
- It asks once before the first prompt and again inside the transaction of every operator, before that password is stored. When it sees another connection it refuses with `DATABASE_IN_USE` and changes nothing for that operator.
- A Core that is started while the command runs is not stopped by it. That Core answers 503 for a moment and reloads. If it was recording, the recording is disturbed.
- Whether an idle Core holds a connection at every moment was reasoned from the code and not measured (development record `test/214_x2_h2_h3_grants_probe.md`, section 7). A test that sees no connection is therefore not proof that no Core runs.

So the rule is the installer's own act and not the command's test: stop the Core by the service manager (`PREP-09` step 4), close every other client of the database (a console of the database, a second terminal), and start no Core until the command has ended.

### 2.4 The attended check of the prompt, before the first real password

The hidden prompt was tested by the development through a stand-in for the terminal only. No person has typed at it on a real terminal, on macOS or on Ubuntu 24.04. Before the first real password is typed on a host, one person makes the attended check once on that host (check H5 of the development's design):

1. Start the attended check of the file `apps/core-server/cli/secret-prompt.ts`. It has no script entry in `apps/core-server/package.json`; its start line is written in the header of that file and in the development record `implementation/213_x2_secret_prompt.md`, section "Not proven here". Performer: USER.
2. Type a **throw-away value**, never a real password, then Enter. Expected: nothing appears while typing, not even marks; the check prints its outcome only, never the value or its length.
3. Type something at the shell afterwards. Expected: the terminal shows what is typed again.
4. Start the check again and press Ctrl-C at the prompt. Expected: the check ends, and the terminal shows what is typed again.

If any character of the throw-away value appears on the screen, or the terminal stays silent afterwards, the check has failed: no password is typed on that host, and the finding goes to the development. To confirm in the same sitting, and so far unproven: that in `operator:set-password` the echoed line for the word `SET` and the hidden prompt after it behave on one terminal as each does alone (first prompt of `PREP-09` step 5).

### 2.5 While a password is typed

The command can refuse a pipe, a file and an input that is not a terminal. It cannot see who else watches the terminal. While a password is typed:

- no terminal recorder runs (a session recording, a logging terminal multiplexer, a terminal program that keeps a transcript of the input);
- the terminal is not a remote session: the password is typed at the keyboard of the host itself;
- the screen is not shared and not recorded, and no camera looks at the keyboard.

The shell history keeps the command line. It holds the database name, the data directory and `--all-demo` or a user name, and no secret.

### 2.6 An incomplete key store

The key store is the directory `<data-dir>/signer`. A complete store of the first key holds three files of the key id `CORE-KEY-EVSIGN-01`: the key (`.p8`), its wrap secret (`.wrap`) and the certificate (`.crt`). A fourth name, `.compromised`, exists only after a key was marked as compromised.

Provisioning writes the three files one after another. A stop between two writes (a power loss, a full disk) leaves a store that holds some of the names and does not load: **an incomplete store**. The same holds for a store of which a file was lost or damaged later.

- `evidence:production-key` never replaces, completes, removes or renames anything. On a directory that holds any of the four names it refuses with `KEY_EXISTS` and prints three lines: the names that are present, the names that are absent, and `store loads:` with `yes`, with `yes - it is a DEVELOPMENT key`, or with `no` and a code.
- `store loads: no` is the incomplete or damaged store. A production Core refuses to start on it with `CAPTURE_SIGNING_KEY_UNUSABLE`.
- **Removing an incomplete store is the installer's own act.** No command of the repository does it. Only the installer knows whether the fingerprint of that key was already handed to anyone. Because the fingerprint is handed over only after the first successful production boot (section 2.7), an installation that has not yet booted has handed over nothing, and nothing was sealed with that key.
- Before removing anything the installer writes down the three lines the command printed. A store with `store loads: yes` is not an incomplete store and is not removed to "start clean": packages sealed with its key verify against its certificate only.
- The refusal `RECORD_EXISTS` means that a record of an earlier run is there and no key is. It is handled the same way: by the installer, knowingly.

### 2.7 The fingerprint: when, how and to whom

The fingerprint is the line `certificate: sha256` with 64 hexadecimal characters that `evidence:production-key` prints. It is not a secret. The command also writes the hand-over record `<data-dir>/handover/CORE-KEY-EVSIGN-01.handover.txt`: the certificate, its sha256, the limits of the certificate and the line the receiver gives to the verifying command.

1. **Not before the first successful production boot.** The fingerprint is handed over only after step 8 of section 4 has passed with this key. Until then the store may still turn out to be incomplete or be removed (section 2.6), and a fingerprint already given out would name a key that signs nothing. Performer: USER.
2. **By another channel than the packages.** The fingerprint goes from a person to a person, on a way that does not carry evidence packages: read out, on paper, or in a message of a channel the receiver already trusts. A hand-over file on the same medium as an export proves nothing: whoever exchanged the package could exchange the file. Performer: USER.
3. **The list of receivers is kept**, with the installation papers: who received the fingerprint, when, by which channel. There is no revocation channel. If the key is ever compromised, the persons on that list are told by a person; the list is the only way to know whom. Performer: USER.

What the certificate says and does not say, as the command prints it: it is self-signed, with no certificate authority and no chain behind it; the organisation and the installation in it were typed by the installer and are proven by nobody; the signing instant of a sealed package is the signer's own clock. Keep the terminal output of the command with the installation papers.

### 2.8 What not to back up

| What | Back up? | Why |
|---|---|---|
| `<data-dir>/signer/`: the key file (`.p8`) and its wrap secret (`.wrap`) | **No.** The signer directory is not copied into a backup, an image of the host, a support bundle or another machine | A copy of a signing key is a second ability to sign evidence, outside the host. The loss of a key is recoverable; a copy that leaked is not |
| The certificate (`.crt`) and the hand-over record in `<data-dir>/handover/` | Yes. They are public | They verify what was sealed |
| The terminal output of `evidence:production-key`, the list of receivers | Yes, with the installation papers | They hold no secret |
| A new operator password | It is not written down by the installer, in any document, backup note or record sheet | It belongs to its operator alone |
| `<data-dir>/credential-store` (the keys that open sealed recordings) | **Not decided by this note.** A different key with the opposite risk: without it every sealed recording is unreadable for ever, and the product has no escrow for it (README, Known limit 37) | The user's decision, to be taken before a real installation (section 2.9) |

A backup of the whole data directory that the site already makes must exclude the signer directory before the first key is provisioned, not afterwards.

### 2.9 The limits: a bench test on the seeded database

Fixed by the user's ruling U20 of the development task. X-1 and X-2 give a production boot **for a bench test**. What they do not give:

- **No operation creates operators.** The accounts are the three demonstration persons the seed wrote, with new passwords. Every audit entry and custody entry of a recording would name one of them, not the officer who acted.
- **The database carries the demonstration data set**: demonstration cases and evidence stand in the same register and the same audit chain as anything recorded.
- **No key escrow** for the credential store, and **no hardware key store**: the signing key is a software key in a file of the host, readable by its owner.
- One key id, no rotation and no command that marks a key as compromised; the sign-in cards still print the demonstration password, which opens nothing after step 2.

Two statements the security review asks every reader of this note to know:

- **The host account of `<service-user>` is full control.** Whoever can act as that account can set any operator's password, can read the signing key with its wrap secret, and can reach the audit log. The two commands add no power to that account; they add a correct procedure and an audit entry that an honest installer leaves behind.
- **The boot checks are necessary conditions, not proof.** A production Core that starts has a key that loads and is not marked as a development key, and no operator with the demonstration password. That it was provisioned correctly, by the right person, is not shown by the start.

The security review gives two lists: what must be closed before a production recording of a real examination (A1 to A9) and what is acceptable for a bench test if stated (B1 to B8). They are printed in full in `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md`, section 11 item 8, and are not repeated here. Until list A is closed, no real examination is recorded on an installation brought up by this note.

### 2.10 The directories above the data directory

`evidence:production-key` refuses to make a key when a directory above `<data-dir>` is a link, belongs to someone other than root or the caller, or is writable by its group or by others (refusals `ANCESTOR_...`); it asks the same of `<data-dir>` itself and of `signer` and `handover` where they exist. **This is checked once, at provisioning. It is not asked again each time the Core loads the key**: at a load the Core checks the signer directory and the three files, not the directories above them (decision C54 (4) of the development task, a stated residual).

So it is a standing requirement of the installation, kept by the installer and by whoever administers the host afterwards: every directory from the root of the file system down to `<data-dir>` stays owned by root or by `<service-user>` and is never made writable by a group or by others. A parent that others may write lets the signer directory be exchanged for another one. To confirm on the host in `PREP-10` step 1: that the command does not refuse the path the host profile gives (`HOST-06`).

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
| 7 | With the Core stopped: X-2 and then X-1, with the two commands of section 2.1 (its steps 2 and 3). Before the first password, the attended check of the prompt (section 2.4). Each operator types their own password, the Supervisor first; the installer runs the key command as `<service-user>`. Then set the installation identity (`DEMS_INSTALLATION_DEVICE_ID`, `DEMS_INSTALLATION_NAME`) and the environment file without any development switch | USER: the installer, and each operator for their own password | Section 2 of this note; `PREP-09` step 5, `PREP-10`; host profile `HOST-34`; README, "the installation identity" | `operators that still have the demo password: 0` and exit status 0; the line `evidence:production-key: OK` and exit status 0. Step 8 measures both again |
| 7a | Create the address helper's group and put the service user in it. Only this part of the helper installation comes before the Core's unit is first started; it grants nothing by itself | USER | Helper installation, `HI-04` part A; host profile `HOST-43` | The group exists; its only member is the service user |
| 8 | **First production boot**: `DEMS_CAPTURE_MODE=real`, no development-sources switch, no demonstration controls | USER | Check `9A/H-16` | The Core starts and names the operation `REAL_PRODUCTION`. A refusal names its code; the code says which of steps 1, 6 or 7 is not done. Only after this step has passed is the fingerprint handed over (section 2.7) |
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

Development record of this behaviour: `docs/2026-10-12_input_av_core_adapter_plan/implementation/029_selector_server.md` (the store, the slices and operation 78 `unassign`; an unassigned slot is an absent line, never an invented device) and `implementation/030_precheck_unassigned.md` (the pre-check item). Both were shown by tests on the development machine, on a development-capture Core. A `REAL_PRODUCTION` Core has not been started on a host. What the development has is one test on the development Mac (`test/208_x1_boot_and_seal_proof.md` of the same folder): a production start of the Core's own start routine on a throw-away database, with a key made by `evidence:production-key` for the test, a stand-in for the capture worker and a stated test host in place of Linux.

## 6. What stays unproven

- Everything in the host profile and in the four chapters of the hardware procedure is unverified on Ubuntu 24.04 until the checks `9A/H-01` to `9A/H-27` have run on the real host.
- A `REAL_PRODUCTION` Core has never been started on a host, and neither command of section 2 has been run on one. The development showed them by tests on the development Mac, with keys and operators made for the tests. Each line below is "to confirm" and names the check that settles it:
  - the two command lines start as written, at the host's terminal, by a person acting as `<service-user>`: `PREP-09` step 5 and `PREP-10` step 1;
  - the hidden prompt on a real terminal, on Ubuntu 24.04, and the word `SET` followed by the hidden prompt on one terminal: the attended check of section 2.4 (H5), then the first prompt of `PREP-09` step 5;
  - the key store as written on the host's file system (modes, no link followed, the sync of the files and of the directory were exercised on macOS only), and the path of `HOST-06` passing the directory rule of section 2.10: `PREP-10` step 1, where the command itself loads the store before it prints `OK`;
  - a production start with the user's key and the operators' new passwords, where all host and program checks are asked: `9A/H-16`;
  - a session sealed with that key and verified against the fingerprint that was printed: `9A/H-17`;
  - that an idle Core holds a database connection at every moment: no check of the procedure measures it. It stays a hypothesis; the installer's rule of section 2.3 does not depend on it.
- How PostgreSQL is installed on the host, how the tablet, the phone and a web console on another machine reach a Core that listens on `127.0.0.1`, and the start command of a production Core in the service unit are open points of the host profile (section 5 and "Outside this profile") and of the frame (section 13).
- The argument form of `db:migrate` and `db:seed` on the host is to be confirmed there (frame, section 13, point 9).
