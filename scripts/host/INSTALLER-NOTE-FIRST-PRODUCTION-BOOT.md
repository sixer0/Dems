# DEMS Core: installer note - from a seeded database to a first production boot

**Status of this document: a map, UNVERIFIED on a host.** It was written on a development Mac. No step below has been performed on Ubuntu 24.04. Every step points to the document that holds the commands, and that document is the authority. Where this note and one of those documents differ, the other document is right and this note is the defect. One exception since Revision 2: the two command lines of section 2 are written here, copied from the script entries of `apps/core-server/package.json`; where this note and that file differ, the file is right.

**Revision 2 (2026-10-13)**, after ruling U19 of the development task. The first issue of this note said that a first production boot is not reachable from this repository, because no command provisions a production signing key and no tool replaces the operators' passwords. Both commands are built now. Section 2 is rewritten to the sequence that uses them; step 7 of section 4 and sections 5 and 6 follow it. Nothing else of the path is changed by this revision. Neither command has been run on a host, by anyone.

**Revision 3 (2026-10-14)**, after the rotation, installation-binding, platform and host-check rows of the development task (decisions C66, C69, C77, C79, C81, C84, C86, C91, C94 (j), C97, C101, C102, C103 and the user's ruling U21). What changed: the address helper is optional and all-or-none, so steps 7a and 9 of section 4 are no longer steps every installation takes (section 4 and its notes); the argument form of the database commands is written (section 4, step 3); the transcriber configuration a production boot needs (section 2.11); the rules of the installation id (section 2.12); rotation and the compromise mark (section 2.13); section 2.3 and the last line of section 2.9 follow. Like Revision 2 it was written on the development Mac: every command line was copied from `apps/core-server/package.json` and from the header of its command file, and none was run on a host, by anyone.

**Stated first, because it decides everything after it: the first production boot that this sequence gives is a boot for a BENCH TEST on the seeded database.** It is not the boot of an installation that records real examinations. No operation of the product creates operators, the database carries the demonstration data set, and there is no key escrow and no hardware key store (section 2.9).

## Ringkasan (Bahasa Indonesia)

Catatan ini adalah peta bagi pemasang: urutan dari basis data yang baru di-seed sampai Core pertama kali dijalankan dalam operasi produksi (`REAL_PRODUCTION`), dan di dokumen mana tiap langkah ditulis. Catatan ini tidak memasang apa pun dan belum diverifikasi pada host Ubuntu 24.04. Semua langkah dilakukan oleh **pengguna** di host; tidak ada langkah yang dilakukan agen.

**Revisi 2 (2026-10-13). Hal terpenting: boot produksi pertama yang dihasilkan urutan ini adalah boot untuk UJI BANGKU pada basis data hasil seed, bukan untuk merekam pemeriksaan sungguhan.** Dua hal yang dahulu belum tersedia kini mempunyai perintah di repositori (bagian 2); keduanya belum pernah dijalankan pada host:

1. **Kata sandi operator yang bukan kata sandi demo**: perintah `operator:set-password`, dijalankan di terminal host dengan Core dihentikan. Setiap operator mengetik kata sandinya sendiri, Supervisor lebih dahulu. Kata sandi tidak tampil saat diketik dan tidak pernah menjadi argumen, variabel, atau masukan dari berkas.
2. **Kunci penandatanganan produksi**: perintah `evidence:production-key`, dijalankan sebagai akun layanan Core, bukan root. Perintah ini tidak meminta rahasia. Sidik jari sertifikat diserahkan kepada pihak yang akan memverifikasi **hanya setelah boot produksi pertama berhasil**, melalui saluran lain selain paket bukti, dan daftar penerimanya disimpan.

Batasnya: produk belum punya fungsi pembuatan operator, basis data masih memuat data demo, tidak ada escrow kunci dan tidak ada penyimpan kunci perangkat keras. Folder `signer` tidak boleh ikut dicadangkan; yang dicadangkan hanya sertifikat.

Urutan singkatnya: (a) terapkan profil host (`scripts/host/`); (b) siapkan server basis data, lalu `db:create`, `db:migrate`, `db:seed`; (c) boot pertama dalam operasi simulasi, hanya pada `127.0.0.1` dan tanpa jaringan ruangan, untuk **mengosongkan keempat slot pemilih perangkat**, karena seed mengisinya dengan sumber buatan yang ditolak Core produksi; (d) dengan Core dihentikan, jalankan kedua perintah di atas, kata sandi lebih dahulu lalu kunci; (e) boot produksi pertama (pemeriksaan `9A/H-16`); (f) bila fungsi komisioning diperlukan, pasang helper alamat (bab 4 paket uji perangkat keras) - sejak Revisi 3 helper ini opsional: dipasang seluruhnya atau tidak sama sekali, hanya di Linux, dan belum dilepas untuk instalasi sebelum pemeriksaan host-nya lulus; ganti kata sandi tiap kamera di halaman kamera itu sendiri **sebelum** kamera diadopsi, lalu isi keempat slot dengan perangkat produksi.

**Revisi 3 (2026-10-14).** ID instalasi yang diketik pada perintah kunci harus sama persis dengan `DEMS_INSTALLATION_DEVICE_ID`, dan tidak boleh `DEMS-TEST-01`, `DEMS-IR-01`, atau `DEMS-JKT-07` (ID milik pengujian dan data demo; boot produksi menolaknya). Setelah rotasi kunci (`evidence:rotate-key`) Core harus dijalankan ulang sebelum dapat menyegel lagi; kunci lama tidak dihapus dan tetap dijaga seperti kunci aktif. Boot produksi juga memerlukan konfigurasi transkripsi yang dapat dipenuhi host (bagian 2.11).

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
| 3 | **X-1.** The production signing key is made in `<data-dir>/signer`. The command asks for two values that are not secrets, the organisation and the installation device id; it prints the directory, the key id, the subject and the validity window in UTC, and asks for the word `PROVISION` before anything is written. The installation device id typed here must follow section 2.12; a reserved id is refused as soon as it is typed (`REFUSED, INSTALLATION_ID_RESERVED`) | USER (installer), as `<service-user>`, never as root | `npm run evidence:production-key -w @dems/core-server -- --data-dir <data-dir>` | the line that begins `evidence:production-key: OK`, with the directory, key id, subject, `certificate: sha256` and 64 hexadecimal characters, the validity window and the path of the hand-over record; exit status 0 |
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

The three key commands (`evidence:production-key`, `evidence:rotate-key`, `evidence:mark-compromised`) see even less: they open no database connection and read no connection file, so they cannot see a running Core at all. Their summaries say to stop the Core first; that, too, is the installer's act. A lock that the Core itself holds, which the commands could ask, is not built; the development task names it as a row to build before any real examination (decision C71, caution C-8).

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
- The sign-in cards still print the demonstration password, which opens nothing after step 2. (Revision 3: this line also said "one key id, no rotation and no command that marks a key as compromised". Both commands are built now, section 2.13; neither has been run on a host.)

Two statements the security review asks every reader of this note to know:

- **The host account of `<service-user>` is full control.** Whoever can act as that account can set any operator's password, can read the signing key with its wrap secret, and can reach the audit log. The two commands add no power to that account; they add a correct procedure and an audit entry that an honest installer leaves behind.
- **The boot checks are necessary conditions, not proof.** A production Core that starts has a key that loads, is not marked as a development key and names the configured installation device id (section 2.12), and no operator with the demonstration password. That it was provisioned correctly, by the right person, is not shown by the start.

The security review gives two lists: what must be closed before a production recording of a real examination (A1 to A9) and what is acceptable for a bench test if stated (B1 to B8). They are printed in full in `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md`, section 11 item 8, and are not repeated here. Until list A is closed, no real examination is recorded on an installation brought up by this note.

### 2.10 The directories above the data directory

`evidence:production-key` refuses to make a key when a directory above `<data-dir>` is a link, belongs to someone other than root or the caller, or is writable by its group or by others (refusals `ANCESTOR_...`); it asks the same of `<data-dir>` itself and of `signer` and `handover` where they exist. **This is checked once, at provisioning. It is not asked again each time the Core loads the key**: at a load the Core checks the signer directory and the three files, not the directories above them (decision C54 (4) of the development task, a stated residual).

So it is a standing requirement of the installation, kept by the installer and by whoever administers the host afterwards: every directory from the root of the file system down to `<data-dir>` stays owned by root or by `<service-user>` and is never made writable by a group or by others. A parent that others may write lets the signer directory be exchanged for another one. To confirm on the host in `PREP-10` step 1: that the command does not refuse the path the host profile gives (`HOST-06`).

### 2.11 The transcriber configuration a production boot needs

The two commands and nothing else do not start a production Core on a seeded database. The development's bench session measured it: the start was refused at boot step `transcriber.config` with `TRANSCRIBER_CONFIG_UNRESOLVABLE`, reason `CPU_LOCAL_RUNTIME_MISSING`, before the checks of the key and the operators were reached (development record `test/220_m11_bench_boot_session.md`, finding F-1). The cause: the seed switches speech-to-text on, and the data directory held no transcriber host file. The refusal is correct; the installer has to meet it, in one of two ways:

- **Provide the engine.** Write the transcriber host file `<data-dir>/transcriber/host.json` with the absolute paths of the speech engine and its models on this host (README, "Transcription (STT)", gives its form; it holds paths and statements, no credential). A host file that cannot be read in that form also stops the start.
- **Or switch transcription off**, in the web console of the `SIMULATED` first boot (step 6 of section 4): System & Maintenance, Settings, Transcription (STT). Sessions are then sealed without a transcript.

To confirm on the host, at step 6: that the setting changed in the `SIMULATED` first boot is the one the production boot reads. The development's bench session did not use the console for it; it changed the stored configuration directly, as the database's owner role, which is not an installer's procedure. If step 8 is refused with this code, the code and its reason are recorded and the step is repeated after one of the two remedies.

### 2.12 The installation device id: one value, typed twice, never a reserved one

The installation device id appears in two places and a production boot holds them to each other (boot check 4b-2):

- at the prompt of `evidence:production-key` (and of `evidence:rotate-key`), together with the organisation. Both are typed at the prompt; neither is an argument of the command. They are not secrets;
- in the environment file, as `DEMS_INSTALLATION_DEVICE_ID`.

The command writes the id into the certificate as its organisational unit, `Evidence signing <installation device id>`. A `REAL_PRODUCTION` Core starts only when the whole organisational unit of the active certificate is exactly that text with the configured id; otherwise it refuses with `CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH`. A key copied from another installation, a key of a test and a key made before the installation was named are refused this way. A Core with no configured id is refused by the same code, reason `INSTALLATION_ID_NOT_KNOWN`.

- **Type the id identically, character for character**, in both places. Its form: a capital letter, then capitals, digits or hyphens, at most 32 characters.
- **Three ids are reserved and no installation may carry them: `DEMS-TEST-01`, `DEMS-IR-01`, `DEMS-JKT-07`.** They are ids of the software's tests, of its published demonstration data and of its documentation. The key commands refuse one as soon as it is typed (`INSTALLATION_ID_RESERVED`), and a production boot refuses a Core configured with one even when its key names it (`CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS`, check 4b-3).
- **A renamed installation needs a new key.** The id in a certificate cannot be changed. Change `DEMS_INSTALLATION_DEVICE_ID`, then rotate to a key that carries the new id (section 2.13).
- The organisation and the installation in the certificate are names the installer typed. Nobody proves them (section 2.7).

### 2.13 Rotation and the compromise mark

Two more commands exist since Revision 3. Each line is the script entry of `apps/core-server/package.json` with the arguments its command file states. Neither has been run on a host.

| What | Command line, from the repository root | What it asks |
|---|---|---|
| A new key becomes the active one | `npm run evidence:rotate-key -w @dems/core-server -- --data-dir <data-dir>` | the organisation and the installation device id of the NEW key (section 2.12), then the word `ROTATE` |
| One named key is marked as compromised | `npm run evidence:mark-compromised -w @dems/core-server -- --data-dir <data-dir> --key-id <key id>` | the word `COMPROMISED`, after it has shown what the store holds of that key. `--key-id` is required: there is no default to the active key |

Both are run by the USER (installer), as `<service-user>`, never as root, with the Core stopped. Exit status of both: 0 done, 1 refused or failed, 2 usage. Neither reads or writes the database, and neither writes an audit entry.

- **Restart after a rotation.** A running Core stays bound to the key its start judged. Once the active key has changed, it refuses every seal, export and transcript revision with `ACTIVE_KEY_CHANGED` until it is started again. So: stop the Core, rotate, start the Core. The new key gets the next key id of the series; a key id is never used for a second key.
- **A retired key is KEPT, all of it.** A rotation changes, removes and renames nothing of the earlier key: its key file, its wrap secret, its certificate and a mark stay in `<data-dir>/signer`. This is the user's ruling U21 (3) of the development task: the private half of a retired key is not destroyed for now. Until the user rules otherwise it is protected exactly like the active key (section 2.8: never in a backup). The certificate of every earlier key is needed to verify what that key signed. The one new name a rotation adds besides the new key's files is the pointer `ACTIVE`.
- **The audit trail knows of it at the next start.** The `SYSTEM_BOOT` entry of the next start states what changed in the store (`signingStoreChange`: `KEY_ROTATED`, `KEY_MARKED_COMPROMISED` and others) against the entry of the start before. So after `evidence:mark-compromised`, start the Core once: when the marked key is the active one that start is refused (check 4, `KEY_COMPROMISED`), and the entry is written all the same. The entry states what lay in the store before the checks judged it; it does not say that the key loaded.
- **The mark cannot be taken back** by any command. A marked key signs nothing from then on; packages it sealed still verify on the Core against the digest the Core recorded, with a notice that says the key is marked.
- **After a suspected compromise, in this order:** mark the key; rotate; start the Core; hand the fingerprint of the NEW certificate to every receiver (section 2.7, the same channel and the same kept list); and tell every receiver the fingerprint of the MARKED certificate, by that same channel, never inside or beside a package. A receiver's verifying command learns of a mark in no other way: the receiver gives it the marked fingerprint (`--compromised`, README, block "Task 4", "Rotation and the compromise mark"). An export delivered before the mark states nothing; it is exported again after the mark and sent again.
- An interrupted rotation is not resumed. The installer starts a new one; it takes the id after the one that was left.

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
| 3 | Create, migrate and seed the database: `db:create`, `db:migrate`, `db:seed`, then `db:status`. Each takes one argument, the database name: `npm run db:migrate -w @dems/core-server -- --database <name>`, and the same form for the other three (Revision 3: the form is the script entry of `apps/core-server/package.json` and the header of each command file; it was not run on the host) | USER | Host profile `HOST-55`; `PREP-07` | `db:status` exits 0; the schema version it prints is written down |
| 3a | **A database that already exists from before this branch: run `db:migrate` first.** This branch raises the schema version. A Core started from it against a database on the earlier version stops at boot (check `B-3`, schema version) until `db:migrate` has run. The development did not migrate any existing database on its own: migrating under a running Core is the owner's action | USER | Decision C29 of the development; README, troubleshooting line `B-3` | `db:status` exits 0 on that database |
| 4 | Know what the seed wrote: the demonstration data set, operators with the published demonstration password, and **four generated sources in the four selector slots**. A seeded database is not a production database | USER | `PREP-07` step 3; README, Known limit 34 | none; a fact to know |
| 5 | First boot in the `SIMULATED` operation, on the loopback listener, with the host **off the room network**. Start no session in it | USER | `PREP-08` | The log names the operation `SIMULATED`; the listener is on `127.0.0.1` only |
| 6 | **The unassigned-slot remedy.** In the web console of that Core, unassign all four selector slots (both video slots, both microphone slots), then stop the Core. See section 5. In the same boot, unless the transcriber host file is provided: switch transcription off (section 2.11) | USER | `PREP-09` steps 2 to 4 | The selector shows four slots "not assigned"; one audit entry `CAPTURE_CONFIG_CHANGED` per action |
| 7 | With the Core stopped: X-2 and then X-1, with the two commands of section 2.1 (its steps 2 and 3). Before the first password, the attended check of the prompt (section 2.4). Each operator types their own password, the Supervisor first; the installer runs the key command as `<service-user>`. Then set the installation identity (`DEMS_INSTALLATION_DEVICE_ID`, `DEMS_INSTALLATION_NAME`) and the environment file without any development switch | USER: the installer, and each operator for their own password | Section 2 of this note; `PREP-09` step 5, `PREP-10`; host profile `HOST-34`; README, "the installation identity" | `operators that still have the demo password: 0` and exit status 0; the line `evidence:production-key: OK` and exit status 0. Step 8 measures both again |
| 7a | **Only on an installation that will have the address helper** (Revision 3: the helper is optional, see the notes below). Create the address helper's group and put the service user in it. It grants nothing by itself | USER | Helper installation, `HI-04` part A; host profile `HOST-43` | The group exists; its only member is the service user |
| 8 | **First production boot**: `DEMS_CAPTURE_MODE=real`, no development-sources switch, no demonstration controls | USER | Check `9A/H-16` | The Core starts and names the operation `REAL_PRODUCTION`. A refusal names its code; the code says which of steps 1, 6 or 7 is not done (`TRANSCRIBER_CONFIG_UNRESOLVABLE`: section 2.11; `CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH`, `CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS`: section 2.12). Only after this step has passed is the fingerprint handed over (section 2.7) |
| 9 | **Optional, Linux only, and all or none:** install the address helper, whole, when the commissioning functions (factory-address scan, camera address change) are needed. Not before its host check `9A/H-06` may be run: the helper is NOT RELEASED for an installation until that check has passed on a real host (notes below). After the installation the Core is started again | USER | Helper installation `HI-01` to `HI-10`; `PREP-12` | Checks `9A/H-05`, `9A/H-25`, `9A/H-06` |
| 10 | Per camera, **before the Core adopts it**: replace the camera's password in the camera's own page, set its clock, fill the per-camera sheet. Then search and connect the camera in the web console; its user name and password are typed there by the user only | USER | `PREP-13`; frame section 4 (UA-9, UA-10) and section 5 (rule B-5); check `9A/H-10` | The sheet line is complete; the camera is connected |
| 11 | Register the two microphone inputs; assign two cameras and the two inputs to the four slots | USER (technician or operator with the capture configuration permission) | `PREP-14`; check `9A/H-07` | Four assigned slots, none "not assigned", none a generated source; the pre-check of a new session has no blocking item |
| 12 | The session checks | USER | Checks `9A/H-17` onward | The acceptance ruling, frame section 11 |

Notes on the order:

- **The address helper is optional, and all or none** (Revision 3; decisions C94 (j) and C102 of the development task, which reverse the earlier ruling that every production installation carries it). The first issue of this note left open whether a production Core without the helper starts. It is settled in the code:
  - **Nothing of the helper on the host: the Core starts.** It states the fact - one warning line `CAPTURE_HOST_ALIAS_HELPER_ABSENT`, and `addressHelperSocket: NOT_PRESENT` in the `SYSTEM_BOOT` audit entry - and the commissioning functions that need the helper answer their own refusal (`COMMISSIONING_HELPER_NOT_CONFIGURED`). Recording does not need the helper.
  - **A helper that is there and wrong, or only in part: the start is REFUSED.** "Nothing" means, as the start checks ask it: no socket, no helper file, no directory of the socket and no unit file. A socket of another owner or mode, a `DEMS_CAPTURE_ALIAS_SOCKET` that is not the path the delivered socket unit installs (`CAPTURE_HOST_ALIAS_SOCKET_PATH`), or a socket unit that was stopped while the helper's files remain, each refuse the next start. So: install all of it (`HI-01` to `HI-10`) or none of it, and to take it away again, remove all of it.
  - Steps 7a and 9 are therefore steps of an installation that commissions cameras from their factory addresses, not of every installation. Where they are taken, the group of step 7a still comes before the Core's unit is first started with it, because the unit of the host profile names that group; the group alone is not one of the four things the start checks look for.
  - **Not released for an installation yet** (decision C101). The security review's statement on the helper holds for the delivered helper file in code only. Its check on a real host (`9A/H-06`) and the installation steps `HI-01` to `HI-08` with `9A/H-05`, `9A/H-25` have never run. The helper is installed on a host first for those checks, on the bench; it is not used on an installation before `9A/H-06` has passed. The hash an installer verifies the helper file against is the one the hardware procedure prints (chapter 4), and that chapter is the authority for it.
  - The helper exists for Linux only.
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
- The argument form of `db:migrate` and `db:seed` is no longer unknown (Revision 3): `npm run db:migrate -w @dems/core-server -- --database <name>` and `npm run db:seed -w @dems/core-server -- --database <name>`, as the script entries of `apps/core-server/package.json` and the headers of the two command files state it. What stays to confirm on the host is that the lines run there as written (frame, section 13, point 9).
- Added by Revision 3, each "to confirm" on a host:
  - a production start without anything of the address helper, and the refusal of a start with a part of it: `9A/H-16` and the helper chapter;
  - the refusals of section 2.12 on the host's own environment file, and the order in which a start names them: `9A/H-16`;
  - `evidence:rotate-key` and `evidence:mark-compromised` at the host's terminal, the restart after a rotation, and the `SYSTEM_BOOT` entry of the next start: no check of the hardware procedure is named for them in this note; the development showed them by a scripted session on the development Mac with keys made for the test (development record `implementation/226c_sign_time_guard.md` and decision C81);
  - that the transcription setting changed in the `SIMULATED` first boot is the one the production boot reads (section 2.11).
