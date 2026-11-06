# DEMS Core: hardware acceptance test package, chapter 4 - installation of the address helper

**Status of this document: UNVERIFIED on a host.** It was written on a development Mac with no Linux host. No command below has been run on Ubuntu 24.04 and nothing here has been installed anywhere. The helper itself was tested only with stand-ins for its two system tools, on macOS. Every command and every expected output is a statement of intent, taken from the delivered files and the design documents, until this chapter and checks `9A/H-05`, `9A/H-25` and `9A/H-06` have been run on the real host. A line the author is unsure of carries "to confirm in 9A/H-nn"; a line without that mark is still unverified, it is only not doubted.

This document installs nothing by itself. **Every step is performed by the user, typed by the user, on the host.** No agent, no script of the repository and no part of the Core performs any of them.

This chapter is read with chapter 1 (`HW-ACCEPTANCE-1-FRAME.md`) for the order of the run, the performers and the result record, with chapter 2 (`HW-ACCEPTANCE-2-HOST-HELPER-AUDIO.md`) for checks `9A/H-05`, `9A/H-25` and `9A/H-06`, and with the host profile (`scripts/host/HOST-PROFILE-UBUNTU-24.04.md`), whose items `HOST-43` to `HOST-47` describe the state this chapter must leave.

**Revision 2 (2026-10-13)**, the consistency pass (blueprint row 181). Still unverified on a host. Changed in this file:

- Order (section 2): the whole of `HI-01` to `HI-07` comes before the Core's unit is first started (`9A/H-16.2`), at sequence 8a of chapter 1, not only `HI-04` part A. `HI-08` is steps `.6` and `.7` of `9A/H-05`; `HI-09.1` and `HI-10` follow that check.
- `HI-08`: the codes of the Core's start checks, confirmed against the code (decision C46).
- Section 4: refusals 5 (code 37) and 9 (code 41) now have a step each, `9A/H-25.6` and `9A/H-25.5`.
- Section 5: "sessions do not depend on the helper" is corrected: a production Core does not start without the installed helper.
- Section 6: points A, D and F settled; B and C name their rows. The marks "to confirm in 9A/H-nn" stay: each waits for that check on the host.

**Revision 4 (2026-10-14)**, the document row of wave 12 (Revision 3 touched chapter 1 only). Still unverified on a host: nothing below was run on one. Where a line of Revision 2 above differs from this list, this list holds. Changed in this file:

- The helper's hash. The delivered helper is now SHA-256 `3621e79c...7e4914` (row H5 of wave 12, 2026-10-14: finding F-1 of review 120 and caution R119b-01 changed the helper's code; it was `1e758a24...c7d015b1` earlier in Revision 4 and `62c0b726...2ee5fb` before); `HI-01.4`, `HI-02.6` and `HI-10.1` print the new value, as the file `SHA256SUMS` of the delivery does. The two unit files are unchanged. **The security review's statement of `HI-01.1` was made for `1e758a24...c7d015b1`; for `3621e79c...7e4914` it is still to be made (condition C-4). Until it is, `HI-01.1` is not met and nothing of this chapter beyond `HI-04` part A is done.**
- The order (section 2). The helper is **not** part of every production installation any more (decision C94 (j), which reverses C49 (1)): a production Core on Linux starts with nothing of the helper installed and says so. Only `HI-04` part A (the group) still comes before the Core's unit is first started; `HI-01` to `HI-07` are run as a whole after `9A/H-16`, at sequence 12 of chapter 1. The rule that stays is "all of it or none".
- `HI-01.1`: the security review's statement exists and is made for the new hash, under four conditions.
- `HI-05`, `HI-06`, section 4: the five refusals the helper gained (codes 38, 46, 47, 48, 55) by their fixed words, and where each is shown; the journal line may end with a `note=` field; the two records of the package manager the helper reads for `/usr/bin/arping`.
- Section 5: what a production Core does on a host where this chapter stopped half-way.


## Ringkasan (Bahasa Indonesia)

Bab 4 adalah prosedur pemasangan helper alamat (`dems-core-netalias`) pada host Ubuntu 24.04. Helper menambah dan menghapus SATU alamat privat sementara `/24` pada port kamera, supaya kamera baru dari pabrik dapat dijangkau saat komisioning. Semua langkah dilakukan dan diketik oleh **pengguna** dengan hak administrator; tidak ada langkah yang dilakukan agen atau skrip.

Bentuk yang dipasang (keputusan C19): layanan root pada soket lokal, satu grup (`dems-netalias`, anggotanya hanya akun layanan Core), dua berkas unit, **tanpa berkas sudoers**. Ada sepuluh langkah, `HI-01` sampai `HI-10`: membandingkan tiga hash, memasang berkas helper, menulis berkas antarmuka, membuat grup dan soket, memeriksa prasyarat, membuktikan bahwa helper MENOLAK (akun di luar grup, alamat di luar batas, antarmuka yang salah) dengan permintaan yang tidak mengubah apa pun, memeriksa firewall, pemeriksaan boot Core, penghapusan, dan pencatatan.

Hal yang paling menentukan:

- Hash yang berbeda dari yang tercetak di bab ini tidak pernah diterima: berkas itu bukan berkas yang ditinjau.
- **Revisi 4 (2026-10-14): helper tidak lagi wajib untuk start produksi** (keputusan C94 (j)). Host tanpa helper sama sekali: Core tetap start dan menyatakannya (`CAPTURE_HOST_ALIAS_HELPER_ABSENT`). Helper yang terpasang sebagian atau salah: start ditolak. Jadi bab ini dijalankan seluruhnya atau tidak sama sekali. Hanya grup `dems-netalias` (`HI-04` bagian A) yang tetap dibuat sebelum unit Core dijalankan pertama kali, karena unit Core menyebut grup itu; `HI-01` sampai `HI-07` dilakukan sebagai satu kesatuan setelah `9A/H-16`.
- Hash helper berubah menjadi `3621e79c...7e4914` (Revisi 4, baris H5: kode helper berubah; sebelumnya `1e758a24...c7d015b1`). Pernyataan tinjauan keamanan untuk hash baru ini BELUM dibuat: sebelum ada, `HI-01.1` tidak terpenuhi.
- Pengatur waktu penghapusan (S13-10 (a)) BELUM dibangun. Hilangnya alamat sementara hanya bergantung pada masa berlaku di kernel, yang baru terbukti di `9A/H-06`. Sebelum `9A/H-05` dan `9A/H-06` lulus, fungsi alamat sementara tidak boleh dipakai di instalasi.
- Bila satu langkah gagal: berhenti, cabut hak dengan mematikan soket (`HI-09.3`), catat, dan jangan pernah mengubah berkas yang dikirim.

Tidak ada rahasia di bab ini. Semua isi **belum terverifikasi** pada host nyata.

## 1. How this chapter is used

| | |
|---|---|
| What | The ten steps of the security review (`verification/02_security.md`, section 5.4) as steps for the user, for the helper as it was delivered: a root service on a local socket, one group, two unit files, no sudoers file (decision C19). Each step has its exact command or file content, what it must print, and the check that shows it took effect |
| Who | Performer `USER` for every step: the owner of the installation, with administrator rights. User action UA-3 of chapter 1 |
| When | Once. `HI-04` part A (the group alone) before `9A/H-16`, at sequence 8a of chapter 1. `HI-01` to `HI-07` as a whole after `9A/H-16` and `PREP-11`, at sequence 12, with no start of the Core in between. `HI-08` inside `9A/H-05`. `HI-09.1` and `HI-10` after `9A/H-05`. Section 2 states why |
| Capture operation | none for `HI-01` to `HI-07` and `HI-09`: no Core is needed. `HI-08` needs a Core in `REAL_PRODUCTION` |
| What it changes on the host | One file under `/usr/local/sbin`, one file under `/etc/dems`, two files under `/etc/systemd/system`, one group, one membership, one enabled socket unit. No address of the host is changed by any step of this chapter |

**What the helper is, as delivered** (read from `scripts/host/netalias/dems-core-netalias`, not from a host):

- It serves one request per connection. The service manager starts one instance per connection, as root, without arguments.
- The request is one line of at most 64 bytes: `add <a.b.c.d>/24 <minutes>` (minutes 5 to 480, refused outside, never clamped) or `del <a.b.c.d>/24`. The answer is one line, `<code> <NAME>`; `0 OK` is the only acceptance.
- The interface is never in the request. It is read from the root-owned file `/etc/dems/netalias-interface`.
- One temporary address at a time.
- The only caller it serves is the ONE member of the group `dems-netalias`. Root itself is refused through the socket.
- It writes one journal line per call: `dems-core-netalias: caller_uid=<n> verb=<add|del|-> address=<a.b.c.d/24|-> result=<NAME> code=<n>`. A `del` of a marked address that is already gone from the port ends the line with ` note=already-absent`; no other call adds a field.
- Its answers are a closed set of 41 names with their codes. Before any `add` it asks the conflict question with `/usr/bin/arping -D -c 2 -w 3 -I <interface> <address>`, the program of the Ubuntu package `iputils-arping`, and reads the program's printed result together with its exit status.
- A mark is honoured for the lifetime it records plus 60 s. After that the helper no longer treats the address as its own (`9A/H-06` reads what that means when the kernel did not remove the address).
- The address is removed after its lifetime by the kernel (`valid_lft`). **A removal timer of the service manager (requirement S13-10 (a)) is not built.** Where this chapter tells the user what to check because of that, the line carries "to confirm when blueprint rows 104 and 106 deliver the removal timer".

**Names fixed by the delivery.** They are constants of the delivered files and are not chosen on the host.

| Thing | Name |
|---|---|
| The delivery folder | `<install-dir>/scripts/host/netalias/` (called `<delivery>` below) |
| The helper as installed | `/usr/local/sbin/dems-core-netalias` |
| The socket unit | `/etc/systemd/system/dems-core-netalias.socket` |
| The template service unit | `/etc/systemd/system/dems-core-netalias@.service` |
| The socket | `/run/dems-core-netalias/socket` |
| The marks of what the helper added | `/run/dems-core-netalias/marks/<address>` |
| The group | `dems-netalias` |
| The interface file | `/etc/dems/netalias-interface` |

**Placeholders** are those of the host profile (`<service-user>`, `<install-dir>`, `<camera-interface>`, `<camera-address>`) and of chapter 2 (`<alias-address>`: a private address in a `/24` that no port of the host holds), plus:

| Placeholder | Meaning |
|---|---|
| `<alias-broadcast>` | `<alias-address>` with its last number replaced by `255` |
| `<camera-neighbour>` | The first three numbers of `<camera-address>` with a last number between 1 and 254 that no device holds |
| `<other-neighbour>` | Only if another port of the host holds a private address: its first three numbers with a last number that is not the host's own |

The one literal address in this chapter is `203.0.113.10`. It belongs to a range reserved for documentation, is no device's address, and is used only in requests the helper must refuse. No placeholder value, no account name and no interface name is written into the result record.

**Rules for every step.**

1. A step whose expected output does not appear is stopped there. The next step is not started. Section 5 says what to do.
2. A delivered file is never edited on the host, not even its comments: any change makes its hash differ, and a file with another hash is not the reviewed file.
3. The administrator's own account is never added to the group `dems-netalias`, not even for a test. With two members the helper refuses every call (`30 SERVICE_USER_UNRESOLVED`).
4. Every request this chapter sends is one the helper must refuse or one that changes nothing. This chapter adds no address. The first address is added in `9A/H-25`.

**The form of a step.** The same six parts as a check of chapter 1, section 8: what it achieves, precondition, steps, expected result, pass criterion (ending with "If not met"), what to record.

**The client command.** A request is sent with the Python 3 that the helper itself needs, so no further program is installed. `USER` types this once in the terminal used for `HI-05` and `HI-06`; it sets a shell variable and changes nothing on the host:

```
ASK='import socket, sys
s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
s.settimeout(40)
try:
    s.connect("/run/dems-core-netalias/socket")
    s.sendall((sys.argv[1] + "\n").encode("ascii"))
    print(s.makefile("r", encoding="ascii").readline().rstrip("\n") or "no answer line")
except OSError as error:
    print("connection failed:", error.strerror or error)'
```

It is then used in three forms. Each sends one request on one connection and prints the one answer line.

| Caller | Command |
|---|---|
| the service user | `sudo runuser -u <service-user> -- /usr/bin/python3 -I -c "$ASK" '<request>'` |
| root | `sudo /usr/bin/python3 -I -c "$ASK" '<request>'` |
| the administrator's account | `/usr/bin/python3 -I -c "$ASK" '<request>'` |

The client was written for this chapter and has not been run (to confirm in 9A/H-05). Where `nc` of the package `netcat-openbsd` is present, `printf '%s\n' '<request>' | sudo runuser -u <service-user> -- nc -N -U /run/dems-core-netalias/socket` is the same request; the helper does not require the sending side to be closed.

## 2. What must come before the Core's unit is first started, and what need not

Revision 4 (decision C94 (j), reversing C49 (1)). Revision 2 put the whole of `HI-01` to `HI-07` before `9A/H-16` because the built start checks then refused a production start without the helper. They no longer do: the helper is used at commissioning only, and a recording host that never commissions a camera need not carry a root service. Two facts of the built product fix the order now.

1. The Core's unit file (file G of the host profile, item `HOST-40`) holds `SupplementaryGroups=audio dems-netalias`. A unit that names a group the host does not have is not started by the service manager; the expected failure is `status=216/GROUP` (to confirm in 9A/H-16).
2. A Core in `REAL_PRODUCTION` on Linux looks, at every start, at five things of the helper: the socket node, the helper file, the socket's directory and the two unit files. It judges them as ONE installation (read from the built host and program checks, `capture/boot/host-checks.ts` and `program-checks.ts`):

   | What the start finds | What the Core does | What is seen |
   |---|---|---|
   | **None of the five** (the helper is absent as a whole) | It starts. The fact is stated, not refused | One warning in the journal with the code `CAPTURE_HOST_ALIAS_HELPER_ABSENT`, and a row in the error log. The audit entry `SYSTEM_BOOT` of that start carries `addressHelperSocket: NOT_PRESENT`. The commissioning functions answer their own refusal, `409 COMMISSIONING_NOT_AVAILABLE`; searching, adopting, assigning and recording are not touched |
   | **All five, as delivered** | It starts | No line names the helper; `SYSTEM_BOOT` carries `addressHelperSocket: PRESENT`. Once a camera interface is stored, the interface file is compared with it as well (`CAPTURE_HOST_INTERFACE_FILE_MISMATCH`) |
   | **Some of the five** (the socket node missing beside a helper file, the socket's directory or a unit file) | It refuses to start | `CAPTURE_HOST_ALIAS_SOCKET` with the reason `SOCKET_ABSENT` |
   | The socket node there and a file missing | It refuses to start | `CAPTURE_HOST_ALIAS_HELPER_UNSAFE` or `CAPTURE_HOST_ALIAS_GRANT_UNSAFE`, each with the reason `FILE_ABSENT` |
   | Something there and not as delivered (kind, owner, mode), or not readable | It refuses to start | the code of that thing with its reason word, as `HI-08` lists them |

   The member `addressHelperSocket` is written before the checks run, from one look at the socket's path; it says what lay there, not that the helper passed. The group and the interface file are not among the five: a host that has the group and nothing else counts as "none".

| Part of this chapter | Relation to the first `sudo systemctl start dems-core.service` (`9A/H-16.2`) |
|---|---|
| **`HI-04` part A** (steps `.1` to `.4`: the group and its one member) | **Before it** (sequence 8a of chapter 1), because of fact 1. A group with one member grants nothing: no socket exists that the group could open, and no delivered file is installed by these four steps |
| **`HI-01` to `HI-07`** | **After it, as a whole** (sequence 12 of chapter 1, after `9A/H-16` and `PREP-11`). The Core is stopped before `HI-02.3` and is not started again before `HI-04.10` has shown the socket active: a start in between meets "some of the five" and is refused (fact 2). `HI-04` part A is then read again, not repeated (`HI-04.1` prints the group's line) |
| `HI-01` | Always the first step of the installation proper: no delivered file is installed before the hashes are compared |
| `HI-08` | After it: needs a Core in `REAL_PRODUCTION` and the camera interface chosen in the web console. It is not performed as a step of its own: it is steps `.6` and `.7` of `9A/H-05`, and its result is copied here |
| `HI-09.1`, `HI-10` | Last, after `9A/H-05` |

**What the first production start shows, in the order of this revision.** At `9A/H-16` nothing of the helper is on the host but the group: the journal holds the warning `CAPTURE_HOST_ALIAS_HELPER_ABSENT` and the boot's audit entry `addressHelperSocket: NOT_PRESENT`. After this chapter, at the restart of `9A/H-05.7`, the warning is gone and the entry says `PRESENT`. Both readings are recorded; neither is a fault.

**The other order stays allowed.** A site that wants the helper in place before the first production start may still run the whole of `HI-01` to `HI-07` at sequence 8a, as Revision 2 wrote. `9A/H-16` then shows `PRESENT` and no warning. What is not allowed, in either order, is a start of the Core between `HI-02.3` and `HI-04.10`.

**All of it or none.** A helper that is taken away after commissioning is taken away as a whole: `HI-09.3` to `HI-09.5` and the socket's directory (`HI-09.8`), in one sitting, with the Core stopped. `HI-09.3` alone (the socket unit stopped and disabled, the files left) is the safe state while a fault is sought, and it **refuses the next production start** (`CAPTURE_HOST_ALIAS_SOCKET` / `SOCKET_ABSENT`); section 5 says so again.

Three lines need a default route on the host: `HI-03.6` (the default-route line), request (b10) and step (c3) of `HI-06`. At sequence 12 the room network is joined (`PREP-11`), the route exists and the three lines are measured at once. Only a site that installs at sequence 8a with way B of chapter 1 (the offline package set) has no default route yet: it repeats the three lines after `PREP-11` (chapter 1, `PREP-11` step 3). The helper checks the default route itself on every call, so the bound holds in the meantime.

The membership reaches a running Core only through its unit, at the Core's start. Adding the service user to the group does not change a Core that already runs.

## 3. The steps

### HI-01  Before installing: the review's statement and the three hashes

Capture operation: none   Changes on the host: none

**1. What it achieves.** The files in hand are the files that were reviewed, and the user knows under which condition they are installed.

**2. Precondition.** `9A/H-27` and `9A/H-01` passed. In the order of Revision 4: `9A/H-16` passed, the Core is stopped and stays stopped until `HI-04.10`; the group of `HI-04` part A exists since sequence 8a. No input-av helper and no sudoers line on the host; the product tree is at `<install-dir>`, owned by root (`HOST-05`); Python 3 is installed (`HOST-10`), version 3.9 or later (the helper needs it; Ubuntu 24.04 carries 3.12). `PREP-12` of chapter 1.

**3. Steps.**
- `HI-01.1` Read the security review's statement on the helper, handed over with the closing report of the development (`verification/119b_helper_statement.md` of the development task, which re-examines `verification/119_commissioning_security.md`). It is made for ONE hash, the one of step `.4`, and under four conditions: (C-1) requirement S13-10 (a) remains for the host, so the function is not used on an installation before `9A/H-06` has passed; (C-2) `HI-01` to `HI-08`, `9A/H-05` and `9A/H-25` remain for the host; (C-3) this chapter prints the hash the statement names; (C-4) any change of the helper needs a new reading and a new statement.
- `HI-01.2` Read in that statement how requirement S13-10 (a) is treated. In this delivery no removal timer exists; the address is removed by its kernel lifetime only, which is proven or disproven in `9A/H-06` (to confirm when blueprint rows 104 and 106 deliver the removal timer).
- `HI-01.3` `cd <install-dir>/scripts/host/netalias && sha256sum -c SHA256SUMS`
- `HI-01.4` In the same folder: `sha256sum dems-core-netalias dems-core-netalias.socket 'dems-core-netalias@.service'`
- `HI-01.5` In the same folder: `stat -c '%U %G %a %n' dems-core-netalias dems-core-netalias.socket 'dems-core-netalias@.service'`

**4. Expected result.**
- `.1` the statement "S13-08 to S13-10 are closed in the helper as delivered" is made, for files with the three hashes below.
- `.2` the statement names the condition: the temporary-address function is not used on an installation until `9A/H-05` and `9A/H-06` have passed.
- `.3` three lines: `dems-core-netalias: OK`, `dems-core-netalias.socket: OK`, `dems-core-netalias@.service: OK`.
- `.4` exactly these three lines:

```
3621e79ccebb05d052efa06b9c1c0dd4d5d4e30d08c2f55f39019857cc7e4914  dems-core-netalias
8623c1cdc530308762c154ad5ad17c73ce50ee6a6e5854952710028d45ffdbcb  dems-core-netalias.socket
7e40f25e21a187e5f05942cb87926131f182718f466d40704784540ec38dd60a  dems-core-netalias@.service
```

- `.5` three lines that begin `root root 644`.

**5. Pass criterion.** Statement made: 1 of 1. Hashes equal to the lines printed above: 3 of 3. Files owned by root and not writable by group or others: 3 of 3.
If not met: nothing is installed. A statement that is refused or missing: `9A/H-05`, `9A/H-06`, `9A/H-25`, `9A/H-13`, `9A/H-14`, `9A/H-15` are "not run: helper not released". A hash that differs: the tree and this chapter are out of step, or the file was changed; the development is asked which, and the file is not installed whatever the answer until the chapter and the file agree. Step `.3` alone proves only that the folder agrees with itself; step `.4` against this page and against the statement is the comparison that counts.

**6. What to record.** "statement made: yes", "hashes equal: 3 of 3", the product commit of `PREP-01`. Not recorded: nothing here is sensitive.

### HI-02  The helper file

Capture operation: none   Changes on the host: one file

**1. What it achieves.** The helper is at its fixed path, owned by root, group root, mode 0755, not a symbolic link, in a directory whose every parent is owned by root and not writable by group or others (`HOST-45`). Installing the file grants nothing: until `HI-04` no account but root can cause it to run.

**2. Precondition.** `HI-01` passed.

**3. Steps.**
- `HI-02.1` `namei -l /usr/local/sbin`
- `HI-02.2` `ls -l /usr/local/sbin/dems-core-netalias`
- `HI-02.3` `sudo install -o root -g root -m 0755 <install-dir>/scripts/host/netalias/dems-core-netalias /usr/local/sbin/dems-core-netalias`
- `HI-02.4` `stat -c '%U %G %a %F' /usr/local/sbin/dems-core-netalias`
- `HI-02.5` `namei -l /usr/local/sbin/dems-core-netalias`
- `HI-02.6` `sha256sum /usr/local/sbin/dems-core-netalias`

**4. Expected result.**
- `.1` every component (`/`, `usr`, `local`, `sbin`) reads `drwxr-xr-x root root`.
- `.2` `No such file or directory`. If a file is there, it is an earlier installation: do `HI-09.1` to `HI-09.6` first.
- `.3` prints nothing.
- `.4` `root root 755 regular file`.
- `.5` the same four directory lines, then `-rwxr-xr-x root root dems-core-netalias`; no line begins with `l`.
- `.6` `3621e79ccebb05d052efa06b9c1c0dd4d5d4e30d08c2f55f39019857cc7e4914  /usr/local/sbin/dems-core-netalias`.

**5. Pass criterion.** Owner, group, mode and type as stated: 1 of 1. Components writable by group or others, or symbolic links: 0. Hash equal to `HI-01`: 1 of 1.
If not met: remove the file (`sudo rm /usr/local/sbin/dems-core-netalias`), find the cause (a parent directory with another owner or mode is a fault of the host, not of the helper) and repeat the step. A different hash after the copy is never accepted.

**6. What to record.** "helper: root root 755, hash equal". That the service user cannot write the file is measured in `9A/H-05.2`.

### HI-03  The interface file

Capture operation: none   Changes on the host: one file (and the directory `/etc/dems` if the host profile has not made it)

**1. What it achieves.** One root-owned file names the camera port, chosen by a person who looked at the host's ports and their addresses (`HOST-46`). It is the helper's only source of the interface. It is written once; changing it is a repeat of this step by the user, never an action of the Core.

**2. Precondition.** `HI-02` passed. The camera port is configured as `HOST-19` states.

**3. Steps.**
- `HI-03.1` `ip -br -4 addr show`, then `ip -4 route show default`.
- `HI-03.2` Choose `<camera-interface>`: the port that holds `<camera-address>`. Confirm, by reading the two outputs, that it is **not** the port named in the default route and **not** the port that holds the room or office address.
- `HI-03.3` `stat -c '%U %G %a' /etc/dems`. Only if it prints `No such file or directory`: `sudo install -d -o root -g root -m 0755 /etc/dems` (the same command the host profile uses for `HOST-25`), then the `stat` again.
- `HI-03.4` `printf '%s\n' '<camera-interface>' | sudo tee /etc/dems/netalias-interface`, then `sudo chown root:root /etc/dems/netalias-interface`, then `sudo chmod 0644 /etc/dems/netalias-interface`.
- `HI-03.5` `stat -c '%U %G %a %F' /etc/dems/netalias-interface`; `wc -l < /etc/dems/netalias-interface`; `cat /etc/dems/netalias-interface`; `test -e "/sys/class/net/$(cat /etc/dems/netalias-interface)" && echo present`.
- `HI-03.6` `ip -4 route show default | grep -c -w "dev $(cat /etc/dems/netalias-interface)"`.

**4. Expected result.**
- `.1` one line per port with its addresses; the default route names one port, or nothing is printed when the room network is not joined yet.
- `.2` the user's confirmation in words.
- `.3` `root root 755`.
- `.4` `tee` prints the name once; the other two print nothing.
- `.5` `root root 644 regular file`; `1`; the name of the camera port and nothing else; `present`.
- `.6` `0`.

The name must begin with a letter or a digit, be at most 15 characters long and hold only letters, digits, `_`, `.` and `-`; the file holds that name and one line end, nothing else. A file with a second line, a space or a Windows line end is refused by the helper (`32 INTERFACE_NAME_INVALID`).

**5. Pass criterion.** File as stated: 1 of 1 (owner, group, mode, type, one line). The named port exists: 1 of 1. The named port is the default-route port: 0.
If not met: write the file again with step `.4`. If `/etc/dems` has another owner or is writable by group or others, the helper refuses every call (`31 INTERFACE_FILE_UNSAFE`); that directory belongs to the host profile and is corrected there.

**6. What to record.** "interface file: root root 644, one line; confirmed not the default-route port, not the room network port". Not recorded: the port's name, any address.

### HI-04  The privilege grant: one group, two unit files, the socket; no sudoers file

Capture operation: none   Changes on the host: one group, one membership, two files, one enabled socket unit

**1. What it achieves.** The only way to reach the helper is a local socket that root and the members of the group `dems-netalias` may open, and that group has exactly one member, the Core's service user (`HOST-43`, `HOST-44`). No sudoers line exists for the helper (`HOST-47`). This replaces the sudoers file of the earlier system; `sudo -n` would be used only under an exception row that the user confirms before the installation, and none exists.

**2. Precondition.** Part A: the service user exists (`HOST-04`). Part B: `HI-01` to `HI-03` passed, and part A done. **Part A comes before the Core's unit is first started; part B belongs to the installation as a whole and is done with the Core stopped (section 2).**

**3. Steps.**

Part A, the group:
- `HI-04.1` `getent group dems-netalias`
- `HI-04.2` `sudo groupadd --system dems-netalias`
- `HI-04.3` `sudo usermod -aG dems-netalias <service-user>`
- `HI-04.4` `getent group dems-netalias`; `grep -c '^dems-netalias:' /etc/group`; `id -nG <service-user>`; `id -u <service-user>`; `grep -c '^<service-user>:' /etc/passwd`; `stat -c '%U %a' /etc/group /etc/passwd`.

Part B, the units and the socket:
- `HI-04.5` `sudo install -o root -g root -m 0644 <install-dir>/scripts/host/netalias/dems-core-netalias.socket /etc/systemd/system/dems-core-netalias.socket`, then `sudo install -o root -g root -m 0644 '<install-dir>/scripts/host/netalias/dems-core-netalias@.service' '/etc/systemd/system/dems-core-netalias@.service'`.
- `HI-04.6` `stat -c '%U %G %a %n' /etc/systemd/system/dems-core-netalias.socket '/etc/systemd/system/dems-core-netalias@.service'`; `sha256sum /etc/systemd/system/dems-core-netalias.socket '/etc/systemd/system/dems-core-netalias@.service'`.
- `HI-04.7` `sudo systemd-analyze verify /etc/systemd/system/dems-core-netalias.socket`, then `sudo systemd-analyze verify '/etc/systemd/system/dems-core-netalias@.service'`. This stands where the syntax check of a sudoers file stood: it comes before the units are loaded.
- `HI-04.8` `sudo systemctl daemon-reload`
- `HI-04.9` `sudo systemctl enable --now dems-core-netalias.socket`
- `HI-04.10` `systemctl is-enabled dems-core-netalias.socket`; `systemctl is-active dems-core-netalias.socket`; `stat -c '%U %G %a %F' /run/dems-core-netalias/socket`; `stat -c '%U %G %a' /run/dems-core-netalias`; `systemctl list-units 'dems-core-netalias@*' --no-legend`.
- `HI-04.11` `sudo grep -r -c netalias /etc/sudoers /etc/sudoers.d`

**4. Expected result.**
- `.1` prints nothing. If it prints a line, the group exists: skip step `.2` and read its member list in step `.4`.
- `.2`, `.3` print nothing.
- `.4` one line `dems-netalias:x:<number>:<service-user>`, the member list being exactly the service user; `1`; a list that holds `dems-netalias`; a number that is not `0`; `1`; `root 644` twice. The helper reads the group and the account from these two local files only: a service user that comes from a network directory is refused.
- `.5` prints nothing.
- `.6` two lines that begin `root root 644`; the two hashes `8623c1cd...` and `7e40f25e...` of `HI-01.4`, in full.
- `.7` no line that names `dems-core-netalias` (to confirm in 9A/H-05: how the verify command treats a template unit, and whether it prints lines about other units of the host).
- `.8` prints nothing.
- `.9` one line `Created symlink /etc/systemd/system/sockets.target.wants/dems-core-netalias.socket ...` (to confirm in 9A/H-05: the exact wording).
- `.10` `enabled`; `active`; `root dems-netalias 660 socket`; `root root 755`; the last command prints nothing, because nothing has connected yet (to confirm in 9A/H-05: the socket as the service manager creates it; open point 13 of the host profile).
- `.11` `0` after every file name.

**5. Pass criterion.** Group with exactly one member, the service user: 1 of 1. Unit files `root root 644` with the hashes of `HI-01`: 2 of 2. Socket unit enabled and active: 1 of 1. Socket `root dems-netalias 660`: 1 of 1. Sudoers lines that name the helper: 0.
If not met: take the grant away at once with `sudo systemctl disable --now dems-core-netalias.socket` and then find the cause. A socket with mode `666`, another group or another owner is never left active. A group with a second member: remove that member (`sudo gpasswd -d <account> dems-netalias`), never the service user. A unit file with another hash is removed and copied again from the delivery; it is not edited.

**6. What to record.** "group: 1 member"; "units: root root 644, hashes equal"; "socket: active, root dems-netalias 660"; "sudoers lines: 0". Not recorded: the service user's name or number.

### HI-05  Prerequisites: the tools, the first connection, the helper's own check

Capture operation: none   Changes on the host: the marks folder under `/run` appears

**1. What it achieves.** The two tools the helper calls are at the paths it calls them by, and the helper's read-only self-check, run once by root, answers `0 OK` for the installation as it stands. The self-check is the one command-line form of the helper; it changes nothing and cannot be reached through the socket.

**2. Precondition.** `HI-04` passed. `HOST-18` passed in `9A/H-01`: the conflict-check tool is `/usr/bin/arping` of the package `iputils-arping`, the path the helper calls it by; the other package named `arping` is absent. The variable `ASK` of section 1 is set in this terminal.

**3. Steps.**
- `HI-05.1` `stat -L -c '%U %a %n' /usr/sbin/ip /usr/bin/arping /usr/bin/python3`; `/usr/bin/python3 --version`.
- `HI-05.1a` The two records of the package manager that the helper reads before it ever starts the tool: `grep -x /usr/bin/arping /var/lib/dpkg/info/iputils-arping.list`; `grep '  usr/bin/arping$' /var/lib/dpkg/info/iputils-arping.md5sums`; `md5sum /usr/bin/arping`; `stat -c '%U %a' /var/lib/dpkg/info /var/lib/dpkg/info/iputils-arping.list /var/lib/dpkg/info/iputils-arping.md5sums`; `dpkg --verify iputils-arping`.
- `HI-05.2` As root, one connection: `sudo /usr/bin/python3 -I -c "$ASK" 'del 203.0.113.10/24'`.
- `HI-05.3` `stat -c '%U %G %a' /run/dems-core-netalias/marks`; `ls -A /run/dems-core-netalias/marks | wc -l`.
- `HI-05.4` `sudo /usr/bin/python3 -I -S -B /usr/local/sbin/dems-core-netalias check; echo "exit $?"`.
- `HI-05.5` `ip -br -4 addr show dev <camera-interface>`.

**4. Expected result.**
- `.1` three lines that begin `root 755` (to confirm in 9A/H-25: the two tool paths on Ubuntu 24.04); `Python 3.12.<n>` (to confirm in 9A/H-05: the helper has not been run on this Python version).
- `.1a` the first command prints `/usr/bin/arping`; the second prints exactly one line, 32 hexadecimal characters, two spaces, `usr/bin/arping`; the third prints the same 32 characters; the fourth prints three lines that begin `root` with no write right for group or others; the last prints nothing (to confirm in 9A/H-25: the two file names without an architecture suffix and the form of the checksum line were not read on a host). If one of them differs, the helper answers `38 CONFLICT_TOOL_NOT_EXPECTED` to the self-check and to every `add`: the file at that path is not the one the package manager recorded.
- `.2` `12 PEER_NOT_SERVICE_USER`: the helper refuses root as a caller, before it reads the request. This first connection also makes the service manager create the marks folder (to confirm in 9A/H-05: that the folder appears with the first instance and stays).
- `.3` `root root 755`; `0`.
- `.4` three lines: `dems-core-netalias: caller_uid=0 verb=check address=- result=OK code=0`, then `0 OK`, then `exit 0`.
- `.5` exactly one address: the self-check changed nothing.

If step `.4` is run before step `.2`, or after a restart of the host and before any connection, it is expected to answer `35 STATE_DIR_UNSAFE`, because the marks folder is created by the first instance and `/run` is emptied at every start of the host. That answer alone is not a fault: do step `.2` and repeat.

Other answers of step `.4` and the step each one sends back to:

| Answer | Meaning | Go to |
|---|---|---|
| `30 SERVICE_USER_UNRESOLVED` | the group has no member, two members, a member that is root, or an account not in the local files | `HI-04` part A |
| `31 INTERFACE_FILE_UNSAFE` | the interface file or `/etc/dems` is missing, a link, not root-owned, or writable by group or others | `HI-03.3`, `HI-03.4` |
| `32 INTERFACE_NAME_INVALID` | the file's content is not one valid name | `HI-03.4` |
| `33 INTERFACE_ABSENT` | the host has no port of that name | `HI-03.1`, `HI-03.2` |
| `34 INTERFACE_HAS_DEFAULT_ROUTE` | the named port carries the default route: the wrong port was chosen | `HI-03.2` |
| `36 TOOL_MISSING` | `/usr/sbin/ip` is absent or not root-owned | host profile, `HOST-18` |
| `37 CONFLICT_TOOL_MISSING` | `/usr/bin/arping` is absent or not root-owned | host profile, `HOST-18` |
| `38 CONFLICT_TOOL_NOT_EXPECTED` | the file at `/usr/bin/arping` is not the one the package manager recorded for `iputils-arping` (another package's program, a changed file, a missing or unsafe record) | step `.1a`; host profile, `HOST-18` |
| `50 HOST_STATE_UNREADABLE` | the route listing could not be read in the form the helper expects | stop; section 5, product |
| `no answer line` in step `.2` | no instance answered | section 5 |

**5. Pass criterion.** Tools present and root-owned: 3 of 3. Root refused through the socket: 1 of 1. Self-check `0 OK` with exit status 0: 1 of 1. Addresses on the camera port: 1.
If not met: by the table. Any other answer: section 5.

**6. What to record.** The Python version; "root refused: 12"; "self-check: 0 OK"; "addresses: 1".

### HI-06  Proof of the bound: the helper refuses

Capture operation: none   Changes on the host: none that stays (the interface file is changed and restored in part C)

**1. What it achieves.** On the real host the helper refuses a caller outside the group, an address outside its bounds and a wrong interface, and writes one journal line for every call that reaches it. Only harmless requests are used: each is either refused before any tool is started, or is a `del` of an address that was never added, or is the read-only self-check. No request of this step may be answered `0 OK`.

The security review asks for nine refusals. Those that need an address to be added or a tool to be removed cannot be shown with harmless requests and are not in this chapter; section 4 states where each of the nine is proven.

**Five refusals the helper gained with the hash of Revision 4**, by their fixed words (read from the table `CODES` of the delivered file). None of them is provoked in this step: each needs a state of the host that this step must not produce. They are named here so that an answer with one of these codes is read correctly if it appears.

| Answer | When the helper gives it | Shown in |
|---|---|---|
| `38 CONFLICT_TOOL_NOT_EXPECTED` | the self-check and every `add`: the file at `/usr/bin/arping` is not the one the package manager recorded for `iputils-arping` | `HI-05.1a` shows the opposite case; not provoked on the host (it would need a changed package record) |
| `46 INTERFACE_NOT_ARPABLE` | an `add`, before the conflict tool is started: the camera port is a loopback port, has the no-ARP flag, or has no broadcast address, so the conflict question cannot be asked on it | `9A/H-25.7` |
| `47 INTERFACE_DOWN` | an `add`, before the conflict tool is started: the camera port is not up or has no carrier (no cable, the switch off) | `9A/H-25.7` |
| `48 INTERFACE_STATE_UNKNOWN` | an `add`: the address listing of the host does not show the camera port at all, which is the case when the port holds no IPv4 address of its own | not provoked (it would need `<camera-address>` taken off the port); stated |
| `55 CONFLICT_RESULT_UNKNOWN` | an `add`, after the conflict tool ran: the tool ended with status 0 or 1 and its printed text is not the three lines the helper expects for this address on this port. The address is NOT added: an answer the helper cannot read is never "free" | `9A/H-25.2` and `.4` show the readable cases; a 55 there is a finding against the helper's reading of the real tool |

In an `add` the bounds are asked in this order: the address's form (20 to 27), the installation (30 to 38), then 42, 40, 41, 43, then 46, 47 or 48, then the conflict tool with 44, 51 or 55. So request (b9) of this step still answers 43 and (b10) still answers 40, whatever the state of the port.

**2. Precondition.** `HI-05` passed; `ASK` is set. No temporary address is in place, and no Core runs. For (b10) and (c3) only: the host has a default route (way A of chapter 1, or after `PREP-11`).

**3. Steps.**
- `HI-06.1` Note the start: `SINCE=$(date '+%Y-%m-%d %H:%M:%S')`; then `ip -br -4 addr show dev <camera-interface>`.
- `HI-06.2` Part A, who may call.
  - (a1) from the administrator's account, without `sudo`: `/usr/bin/python3 -I -c "$ASK" 'del 203.0.113.10/24'`
  - (a2) as root: `sudo /usr/bin/python3 -I -c "$ASK" 'del 203.0.113.10/24'`
- `HI-06.3` Part B, as the service user: `sudo runuser -u <service-user> -- /usr/bin/python3 -I -c "$ASK" '<request>'`, once for each request:
  - (b1) `add 203.0.113.10/24 5`: an address that is not private
  - (b2) `add <alias-address>/16 5`: a prefix other than `/24`
  - (b3) `add <alias-broadcast>/24 5`: a host part outside 1 to 254
  - (b4) `add <alias-address>/24 4`: a lifetime below 5 minutes
  - (b5) `add <alias-address>/24 481`: a lifetime above 480 minutes
  - (b6) `add <alias-address>/24 5 <camera-interface>`: an interface named by the caller
  - (b7) `listen <camera-interface>`: the third verb of the earlier system
  - (b8) `del <alias-address>/24`: an address the helper did not add
  - (b9) `add <camera-neighbour>/24 5`: a `/24` the camera port already has
  - (b10) only if another port holds a private address: `add <other-neighbour>/24 5`: a `/24` that another port of the host holds
- `HI-06.4` Part C, a wrong interface in the file. Only `del` and the self-check are sent while the file is wrong.
  - (c1) `test -e /sys/class/net/nosuchport0; echo $?`, then `printf '%s\n' 'nosuchport0' | sudo tee /etc/dems/netalias-interface`
  - (c2) the self-check of `HI-05.4`, then as the service user the request `del <alias-address>/24`
  - (c3) only if `ip -4 route show default` names a port: write that port's name into the file with the `tee` command of (c1), then the self-check, then as the service user the request `del <alias-address>/24`
  - (c4) restore: `HI-03.4` with `<camera-interface>`, then `HI-03.5`, `HI-03.6` and the self-check of `HI-05.4`
- `HI-06.5` Part D, the journal: `sudo journalctl -t dems-core-netalias --since "$SINCE" --no-pager -o cat`, and the same command followed by `| grep -c 'result='`.
- `HI-06.6` Part E, nothing changed: `ip -br -4 addr show dev <camera-interface>`; `ls -A /run/dems-core-netalias/marks | wc -l`; `systemctl is-active dems-core-netalias.socket`.

**4. Expected result.**
- `.1` one address on the camera port.
- `.2` (a1) `connection failed: Permission denied`: the socket's mode refuses the account, the helper is not started. (a2) `12 PEER_NOT_SERVICE_USER`.
- `.3` the answers:

| Request | Answer | Refused |
|---|---|---|
| (b1) | `25 ADDRESS_NOT_PRIVATE` | before any tool is started |
| (b2) | `21 PREFIX_NOT_24` | before any tool is started |
| (b3) | `26 HOST_PART_OUT_OF_RANGE` | before any tool is started |
| (b4), (b5) | `27 LIFETIME_OUT_OF_RANGE` | before any tool is started |
| (b6) | `14 REQUEST_MALFORMED` | before any tool is started; the caller cannot name an interface |
| (b7) | `15 VERB_UNKNOWN` | before any tool is started |
| (b8) | `45 NOT_MARKED` | after the read of the route table |
| (b9) | `43 CAMERA_INTERFACE_HOLDS_SUBNET` | after the reads of the route table and the address list, before the conflict probe (to confirm in 9A/H-05: it is the first request that reads the real tool's output) |
| (b10) | `40 OTHER_INTERFACE_HOLDS_SUBNET` | as (b9) |

- `.4` (c1) `1`, then the name printed once. (c2) the self-check prints `33 INTERFACE_ABSENT` and `exit 33`; the request is answered `33 INTERFACE_ABSENT`. (c3) the self-check prints `34 INTERFACE_HAS_DEFAULT_ROUTE` and `exit 34`; the request is answered `34 INTERFACE_HAS_DEFAULT_ROUTE`. (c4) the outputs of `HI-03.5` and `HI-03.6` as stated there, and `0 OK`.
- `.5` one line per call that reached the helper, in the order sent, and nothing for (a1) and for the self-checks (their line went to the terminal). The count is 11 when (b10) and (c3) were not sent, 12 with one of them, 13 with both. The lines read, with `<n>` the number of `id -u <service-user>`:

```
dems-core-netalias: caller_uid=0 verb=- address=- result=PEER_NOT_SERVICE_USER code=12
dems-core-netalias: caller_uid=<n> verb=add address=- result=ADDRESS_NOT_PRIVATE code=25
dems-core-netalias: caller_uid=<n> verb=add address=- result=PREFIX_NOT_24 code=21
dems-core-netalias: caller_uid=<n> verb=add address=- result=HOST_PART_OUT_OF_RANGE code=26
dems-core-netalias: caller_uid=<n> verb=add address=- result=LIFETIME_OUT_OF_RANGE code=27
dems-core-netalias: caller_uid=<n> verb=add address=- result=LIFETIME_OUT_OF_RANGE code=27
dems-core-netalias: caller_uid=<n> verb=add address=- result=REQUEST_MALFORMED code=14
dems-core-netalias: caller_uid=<n> verb=- address=- result=VERB_UNKNOWN code=15
dems-core-netalias: caller_uid=<n> verb=del address=<alias-address>/24 result=NOT_MARKED code=45
dems-core-netalias: caller_uid=<n> verb=add address=<camera-neighbour>/24 result=CAMERA_INTERFACE_HOLDS_SUBNET code=43
dems-core-netalias: caller_uid=<n> verb=del address=<alias-address>/24 result=INTERFACE_ABSENT code=33
```

  An address appears in a line only after it passed every check of its form; no other text of the caller appears. Beside these lines the service manager writes its own lines for each instance that ended with a code other than 0 (`status=25` and so on); that is the refusal code as exit status and is expected (to confirm in 9A/H-05: that such instances are collected and do not accumulate as failed units).
- `.6` one address, the same as in step `.1`; `0`; `active`.

**5. Pass criterion.** All of:
1. the account outside the group is refused by the socket: 1 of 1; root is refused by the helper: 1 of 1;
2. requests refused with the stated code: 9 of 9 in part B (10 of 10 with (b10));
3. the wrong interface refused: 2 of 2 for the absent name (self-check and request); 2 of 2 for the default-route port when (c3) was run, else "not run: no default route" and repeated after `PREP-11`;
4. requests answered `0 OK`: 0;
5. journal lines equal to the calls that reached the helper: 11, 12 or 13 as sent;
6. addresses on the camera port before and after: 1 and 1; mark files: 0; the interface file restored and the self-check `0 OK`: 1 of 1.

If not met:
- an answer `0 OK` to any request of this step: the helper accepted what it must refuse. If the request was an `add`, send `del` for the same address at once as the service user and read `ip -br -4 addr show dev <camera-interface>`; then do `HI-09.3` (the grant away). This is a product fault: it reopens the helper and its nine bounds, and the helper is not used.
- (a1) answered by the helper instead of refused by the socket: the socket's mode or group is wrong, or the administrator is in the group; `HI-04.4`, `HI-04.10`.
- another refusal code than stated: record both codes. A refusal is still a refusal, and criterion 4 stays met; the difference goes to the development.
- a journal count that differs: record it; product (bound 8 of the helper: one line per call).
- the file not restored in (c4): the helper refuses every call until it is; repeat `HI-03.4`.

**6. What to record.** The answer line of every request by its letter; the journal count; the address counts 1 and 1; "marks: 0". Not recorded: `<alias-address>` and the other placeholder values, the port's name, the service user's number. If the journal output is kept as evidence, the address fields of its lines are struck out first.

### HI-07  Firewall

Capture operation: none (one reading needs a running Core)   Changes on the host: none

**1. What it achieves.** A temporary address on the camera port opens no way to the Core's own services, and the loopback rule is in place. The items are the host profile's (`HOST-20`, `HOST-22`, `HOST-24`, `HOST-25`) and were applied and measured in `9A/H-01`; this step reads four lines of them again and changes nothing.

**2. Precondition.** `9A/H-01` passed.

**3. Steps.**
- `HI-07.1` `sudo ufw status verbose`
- `HI-07.2` `sudo ufw status | grep -c -E '44(20|21|22|23)'`
- `HI-07.3` `systemctl is-active dems-loopback-rule.service`; `sysctl -n net.ipv4.ip_forward`
- `HI-07.4` With a Core running (else in `HI-08`): `sudo ss -H -ltnp`

**4. Expected result.**
- `.1` `Status: active` and `Default: deny (incoming), allow (outgoing), deny (routed)`.
- `.2` `0`: no rule opens the Core's ports.
- `.3` `active`; `0`.
- `.4` every listener owned by `<service-user>` has the local address `127.0.0.1`. A listener bound to that address is not reachable on the camera port or on any address added to it.

**5. Pass criterion.** The four readings as stated: 4 of 4 (step `.4` may be read in `HI-08`).
If not met: an installation fault of the host profile; correct the item there and repeat `9A/H-01` for it. The helper is not used while a listener of the Core is reachable on the camera port.

**6. What to record.** "firewall readings: 4 of 4".

### HI-08  The Core's boot check passes

Capture operation: `REAL_PRODUCTION`   Changes on the host: the Core is restarted

**1. What it achieves.** A production Core, started under its unit, finds the helper and its grant owned by root and not writable by the service user, and finds the interface file in agreement with the camera interface chosen in the web console. This step is the same act as steps `9A/H-05.6` and `9A/H-05.7` of chapter 2: it is performed once, there, and its result is copied here. It is not a precondition of `9A/H-05`; the precondition of that check is `HI-01` to `HI-07`.

**2. Precondition.** `HI-01` to `HI-07` passed. `9A/H-16` passed. No session is open. The camera interface is chosen in the commissioning settings of the web console (`9A/H-05.6`), the same port the interface file names.

**3. Steps.**
- `HI-08.1` With the line `DEMS_CAPTURE_ALIAS_SOCKET=/run/dems-core-netalias/socket` in `/etc/dems/core.env` (`9A/H-05.7`): `sudo systemctl restart dems-core.service`
- `HI-08.2` `journalctl -u dems-core.service -b --no-pager | tail -n 80`
- `HI-08.3` `systemctl show dems-core.service -p NoNewPrivileges`; `sudo grep NoNewPrivs /proc/<core-pid>/status`; `sudo grep '^Groups:' /proc/<core-pid>/status`; `getent group audio dems-netalias`.

**4. Expected result.**
- `.2` the line `capture fence passed` with the operation `REAL_PRODUCTION`, and a line with the code `CAPTURE_PROGRAM_CHECKS_PASSED`; no line holds one of the four codes `CAPTURE_HOST_ALIAS_SOCKET`, `CAPTURE_HOST_ALIAS_HELPER_UNSAFE`, `CAPTURE_HOST_ALIAS_GRANT_UNSAFE`, `CAPTURE_HOST_INTERFACE_FILE_MISMATCH`, and none holds `CAPTURE_HOST_ALIAS_HELPER_ABSENT`: with the chapter done the helper is there as a whole. The audit entry `SYSTEM_BOOT` of this start carries `addressHelperSocket: PRESENT` (read by `OPER` in the audit list). A start refused with `CAPTURE_HOST_FACTS_NOT_HANDED_IN` (reason `NO_HOST_FACTS`) is a Core whose entry point handed no host facts to the boot: a product fault, not a pass of this step.
- `.3` `NoNewPrivileges=yes`; `NoNewPrivs:` followed by `1`; exactly the two group numbers that the last command prints (`HOST-38`, `HOST-40`).

**5. Pass criterion.** The start names no fault of the helper: 0 lines. The Core runs without the right to gain privileges and with the two groups: 2 of 2.
If not met, by the code and its reason word: `CAPTURE_HOST_ALIAS_HELPER_UNSAFE` (`FILE_ABSENT`, `NOT_THE_DELIVERED_KIND`, `NOT_OWNED_BY_ROOT`, `WRITABLE_BY_GROUP_OR_OTHERS`) sends back to `HI-02`; `CAPTURE_HOST_ALIAS_SOCKET` (`SOCKET_ABSENT`, `SOCKET_OWNER_GROUP_OR_MODE`) and `CAPTURE_HOST_ALIAS_GRANT_UNSAFE` send back to `HI-04`; `CAPTURE_HOST_INTERFACE_FILE_MISMATCH` (`INTERFACE_FILE_DIFFERS_FROM_ROW`, `INTERFACE_FILE_ABSENT`, `INTERFACE_FILE_NOT_ONE_NAME`) sends back to `HI-03`. If the file is right and the choice in the web console is wrong, the Core does not start and its console cannot be reached: the file is then written to agree with the stored choice only if that port is the camera port; otherwise the development is asked, and the stored choice is not changed by hand in the database. A Core that does not start with `status=216/GROUP`: `HI-04` part A was not done. Anything else: product, the boot checks and the helper's caller.

**6. What to record.** The result of `9A/H-05` criterion 5, by its run number. Whether the helper answers from inside this unit is measured in `9A/H-06`, not here.

### HI-09  Removal, and the list of what the helper left behind

Capture operation: none   Changes on the host: step `.1` none; steps `.2` to `.8` take the installation away

**1. What it achieves.** Step `.1` lists every address the helper marked and is performed in every run, as the last reading before `HI-10`. Steps `.2` to `.8` are the rollback: they are performed only when a step of this chapter fails, when a changed helper (another hash) is to be installed, or when the helper leaves the host. Step `.3` alone takes the privilege away; it is the safe state named in section 5.

**2. Precondition.** For steps `.2` to `.8`: no session is open and no commissioning job runs.

**3. Steps.**
- `HI-09.1` `ls -A /run/dems-core-netalias/marks`; `ip -4 addr show dev <camera-interface>`; `systemctl list-timers --all --no-pager | grep -c netalias`.
- `HI-09.2` For each address that step `.1` lists as marked and that is still on the port: as the service user, the request `del <that-address>/24`. Only if the helper is already gone or refuses: `sudo ip addr del <that-address>/24 dev <camera-interface>`, for an address named by a mark file and never for `<camera-address>`. Then step `.1` again.
- `HI-09.3` The grant: `sudo systemctl disable --now dems-core-netalias.socket`; then `systemctl is-active dems-core-netalias.socket`; `ls /run/dems-core-netalias/socket`; `systemctl list-units 'dems-core-netalias@*' --no-legend`.
- `HI-09.4` The unit files: `sudo rm /etc/systemd/system/dems-core-netalias.socket '/etc/systemd/system/dems-core-netalias@.service'`; `sudo systemctl daemon-reload`; `systemctl list-unit-files 'dems-core-netalias*'`.
- `HI-09.5` The helper: `sudo rm /usr/local/sbin/dems-core-netalias`; `ls /usr/local/sbin/dems-core-netalias`.
- `HI-09.6` The interface file: `sudo rm /etc/dems/netalias-interface`; `ls /etc/dems/netalias-interface`. The directory `/etc/dems` stays: it belongs to the host profile.
- `HI-09.7` Only when the helper leaves the host for good. First the user takes the group's name out of the Core's unit (file G: `SupplementaryGroups=audio`), then `sudo systemctl daemon-reload`; then `sudo gpasswd -d <service-user> dems-netalias`; `sudo groupdel dems-netalias`; `getent group dems-netalias`.
- `HI-09.8` `sudo rm -r /run/dems-core-netalias` (only after step `.1` showed no marked address on the port); `sudo grep -r -c netalias /etc/sudoers /etc/sudoers.d`; `ip -br -4 addr show dev <camera-interface>`.

**4. Expected result.**
- `.1` in a run without a fault: the first command prints nothing; the second shows one address, `<camera-address>`, with `valid_lft forever`; the third prints `0`. A temporary address is recognised by a `valid_lft` with a number of seconds. With this delivery no timer exists, so `0` is the expected count and says nothing about cleanup: the cleanup is the kernel lifetime, measured in `9A/H-06` (to confirm when blueprint rows 104 and 106 deliver the removal timer: the count expected here, and whether steps `.3` and `.4` must then stop a timer as well).
- `.2` `0 OK`; the address is gone from the port.
- `.3` one line `Removed ...`; `inactive`; `No such file or directory`; nothing.
- `.4` `0 unit files listed.`
- `.5`, `.6` `No such file or directory`.
- `.7` the last command prints nothing.
- `.8` `0` after every file name; one address.

**5. Pass criterion.** In a normal run: marked addresses 0, addresses on the camera port 1. After a rollback: socket unit inactive and its file absent; unit files 0; helper absent; interface file absent; sudoers lines 0; addresses on the camera port 1.
If not met: a marked address that cannot be removed by either command of step `.2` disappears at the next restart of the host; until then no camera work is done on that port. A group that is deleted while the Core's unit still names it stops the Core from starting (`status=216/GROUP`): step `.7` is done in its order or not at all. For a re-installation the group is kept: steps `.1` to `.6`, then this chapter again from `HI-01`.

**6. What to record.** In a normal run: "marks: 0; addresses: 1". After a rollback: which steps were done, and why. Not recorded: any address.

### HI-10  Record

Capture operation: none   Changes on the host: none

**1. What it achieves.** The installation is on record with its date, its host and the hashes of what was installed, as a confirmation of the user that the development enters into its decision register (user action UA-3).

**2. Precondition.** `HI-01` to `HI-07` passed; `HI-08` read from `9A/H-05`; `HI-09.1` read.

**3. Steps.**
- `HI-10.1` Write the confirmation, one paragraph, into the notes of the result record:

```
Address helper installed. Date: <date>. Host: <the host's label in this record>. Product commit: <identifier of PREP-01>.
Form: root service on a local socket, group dems-netalias with one member, two unit files, no sudoers file (decision C19).
Hashes: 3621e79ccebb05d052efa06b9c1c0dd4d5d4e30d08c2f55f39019857cc7e4914 (helper),
8623c1cdc530308762c154ad5ad17c73ce50ee6a6e5854952710028d45ffdbcb (socket unit),
7e40f25e21a187e5f05942cb87926131f182718f466d40704784540ec38dd60a (service unit).
Steps HI-01 to HI-07: met. HI-08: 9A/H-05 run <k>, <result>. HI-09.1: marks 0, addresses 1.
Condition: the temporary-address function is not used on an installation until 9A/H-05 and 9A/H-06 have passed.
No removal timer in this delivery (S13-10 (a)). Confirmed by: <role>.
```

- `HI-10.2` Hand the paragraph to the development with the result record.

**4. Expected result.** One paragraph with every field filled. The hashes are those the user computed on the host in `HI-02.6` and `HI-04.6`, not copied from this page.

**5. Pass criterion.** Fields empty: 0. Hashes equal to `HI-01`: 3 of 3.
If not met: the installation is not on record; `9A/H-05` is not started.

**6. What to record.** The paragraph itself. Never in it: a password, a key, a real address, a personal name, the port's name, an account name. When the helper changes (a removal timer, a correction), its hash changes: this chapter, the hash list of the delivery and this record move together, and the user installs again from `HI-01` (to confirm when blueprint rows 104 and 106 deliver the removal timer: the new hashes).

## 4. The nine refusals of the security review, and where each is proven on the host

| # | Refusal (requirement S13-08) | Proven in | Code |
|---|---|---|---|
| 1 | Another interface than the one of the root-owned file | `HI-06` (b6): the caller cannot name one; `HI-06` (c2): a file that names an absent port; also `9A/H-05.3` (c) | 14; 33 |
| 2 | An address that is not private | `HI-06` (b1); `9A/H-05.3` (a) | 25 |
| 3 | A prefix other than `/24` | `HI-06` (b2); `9A/H-05.3` (b) | 21 |
| 4 | An address another device holds | `9A/H-25.2`: needs a second device, and the helper sends a probe on the camera port | 44 |
| 5 | The conflict-check tool missing | `9A/H-25.6` (added in Revision 2; corrected in Revision 4): the user moves the tool away, reads the self-check and one `add` request, and restores it. A `del` does not need the tool and is not refused for its absence. `HI-05.4` shows the opposite case, the tool present | 37 |
| 6 | `del` of an address the helper did not add | `HI-06` (b8); `9A/H-05.3` (d) | 45 |
| 7 | An overlap with a `/24` of another port | `HI-06` (b10), when another port holds a private address | 40 |
| 8 | The default-route port | `HI-06` (c3), when the host has a default route | 34 |
| 9 | One alias more than the limit (the delivered limit is one) | `9A/H-25.5` (added in Revision 2): with one address in place, a second `add` in another `/24` is refused. The helper asks this bound before the one of code 43 | 41 |

Beyond the nine, `HI-06` shows: an account outside the group refused by the socket; root refused by the helper (12); a lifetime out of range (27); a host part out of range (26); an unknown verb (15); a `/24` the camera port already has (43).

The five refusals of Revision 4 belong to bound 4 (the conflict check always runs, and only a readable "free" adds an address): 38 `CONFLICT_TOOL_NOT_EXPECTED`, 46 `INTERFACE_NOT_ARPABLE`, 47 `INTERFACE_DOWN`, 48 `INTERFACE_STATE_UNKNOWN`, 55 `CONFLICT_RESULT_UNKNOWN`. The table in `HI-06` says when each is given; 46 and 47 are shown in `9A/H-25.7`.

## 5. If a step fails

1. Stop at that step. Do not go on to the next one and do not start `9A/H-05`.
2. If `HI-04` part B was reached, put the host into the safe state: `HI-09.3`. With the socket stopped and disabled no account can cause the helper to run. The files may stay while the cause is sought.
3. Read what the service manager and the helper wrote: `systemctl status dems-core-netalias.socket --no-pager`, `sudo journalctl -u dems-core-netalias.socket -u 'dems-core-netalias@*' -b --no-pager | tail -n 40` (to confirm in 9A/H-05: that the pattern selects the instances).
4. Sort the cause:
   - **Installation**: a command was mistyped, a step was left out, a precondition of the host profile is not met. Correct it and repeat from that step.
   - **Product**: the step was done as written and the output differs: a unit the service manager does not accept, an instance that does not answer (`no answer line`), a request answered with another code or with `0 OK`, a self-check that answers `50` or `60`. Record the step, what was printed and what was expected; hand it to the development. `9A/H-05`, `9A/H-25`, `9A/H-06` and `9A/H-13` to `9A/H-15` are "not run: helper not installed".
5. Never repair on the host: no edit of a delivered file, no change of the socket's mode, group or owner, no second member in the group, no sudoers line, no capability on the Core. Each of these would pass a step and remove the bound the step exists for.
6. A correction by the development changes at least one hash. The helper is then removed (`HI-09.1` to `HI-09.6`) and this chapter is run again from `HI-01` with the new hashes.

A recording session never calls the helper, and a production Core starts on a host that has nothing of the helper (decision C94 (j); section 2, fact 2). What it does not start on is a helper that is there in part or is wrong. A host on which this chapter stopped after `HI-02.3`, or on which the grant was taken away with `HI-09.3` while the files stayed, therefore cannot start its production Core. There are two ways out and no third: complete the chapter, or take the helper away as a whole (`HI-09.3` to `HI-09.5`, then `HI-09.8` for the socket's directory); after the second the Core starts and states `CAPTURE_HOST_ALIAS_HELPER_ABSENT`. The group may stay in both cases.

## 6. Open points of this chapter

| # | Open point | Effect | Settled by |
|---|---|---|---|
| A | Settled again in Revision 4 (decision C94 (j)): only `HI-04` part A stays at sequence 8a; `HI-01` to `HI-07` run as a whole at sequence 12, after `9A/H-16`. The order of Revision 2 stays allowed | Section 2 | - |
| B | The removal timer of requirement S13-10 (a) is not built (blueprint rows 104 and 106) | Four lines are marked "to confirm when blueprint rows 104 and 106 deliver the removal timer": section 1, `HI-01.2`, `HI-09.1` and `HI-10`. If `9A/H-06` shows that the kernel does not remove the address, the helper changes and this chapter is run again | `9A/H-06`; the development |
| C | Settled in Revision 4: the security review's statement on the helper is made for the hash of `HI-01.4` (decision C101), under conditions C-1 to C-4 of `HI-01.1`. Open by its nature: C-1 and C-2 are the host's (`9A/H-05`, `9A/H-06`, `9A/H-25`) | The function is not used on an installation before `9A/H-06` has passed. `9A/H-16` no longer waits for the helper | the run itself |
| D | Settled in Revision 4: the boot checks are built with the codes `HI-08` names, the entry point hands the host facts in, and the Core's caller of the helper is built (one stream-socket client; key `DEMS_CAPTURE_ALIAS_SOCKET`, which must be unset or the installed path `/run/dems-core-netalias/socket`, else the start is refused with `CAPTURE_HOST_ALIAS_SOCKET_PATH`). None of it has run on a host | `HI-08`; whether the helper answers from inside the Core's unit is `9A/H-06` | `9A/H-05`, `9A/H-06` |
| H | The five refusals of Revision 4 (38, 46, 47, 48, 55) were shown with stand-ins for the two system tools only. Whether the real `arping` prints the three lines the helper expects, and whether `ip -json -4 addr show` prints `flags` with `LOWER_UP` and `valid_life_time` as the helper reads them, is unread on a host | A helper that cannot read the real tool answers 55 to every `add`, and one that cannot read the lifetime answers `50 HOST_STATE_UNREADABLE` to a `del`: both fail closed | `9A/H-25` (steps `.2`, `.4`, `.7`), `9A/H-06` |
| E | The self-check answers `35` until the first connection has made the marks folder, and again after every restart of the host | `HI-05` orders the first connection before the self-check | `9A/H-05` |
| F | Settled in Revision 2: refusals 5 and 9 have the steps `9A/H-25.6` and `9A/H-25.5` | Section 4 | - |
| G | The client of section 1 was not run; `nc -N -U` is named as an equivalent where it is installed | The first request of `HI-05.2` shows whether it answers | `9A/H-05` |
