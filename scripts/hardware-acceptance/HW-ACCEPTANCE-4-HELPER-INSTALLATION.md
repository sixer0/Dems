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


## Ringkasan (Bahasa Indonesia)

Bab 4 adalah prosedur pemasangan helper alamat (`dems-core-netalias`) pada host Ubuntu 24.04. Helper menambah dan menghapus SATU alamat privat sementara `/24` pada port kamera, supaya kamera baru dari pabrik dapat dijangkau saat komisioning. Semua langkah dilakukan dan diketik oleh **pengguna** dengan hak administrator; tidak ada langkah yang dilakukan agen atau skrip.

Bentuk yang dipasang (keputusan C19): layanan root pada soket lokal, satu grup (`dems-netalias`, anggotanya hanya akun layanan Core), dua berkas unit, **tanpa berkas sudoers**. Ada sepuluh langkah, `HI-01` sampai `HI-10`: membandingkan tiga hash, memasang berkas helper, menulis berkas antarmuka, membuat grup dan soket, memeriksa prasyarat, membuktikan bahwa helper MENOLAK (akun di luar grup, alamat di luar batas, antarmuka yang salah) dengan permintaan yang tidak mengubah apa pun, memeriksa firewall, pemeriksaan boot Core, penghapusan, dan pencatatan.

Hal yang paling menentukan:

- Hash yang berbeda dari yang tercetak di bab ini tidak pernah diterima: berkas itu bukan berkas yang ditinjau.
- **Seluruh `HI-01` sampai `HI-07` dilakukan sebelum unit Core dijalankan pertama kali (`9A/H-16`)** (Revisi 2, 2026-10-13): unit Core menyebut grup `dems-netalias`, dan start produksi memeriksa soket, berkas helper, dan dua berkas unit, lalu menolak bila salah satunya tidak ada.
- Pengatur waktu penghapusan (S13-10 (a)) BELUM dibangun. Hilangnya alamat sementara hanya bergantung pada masa berlaku di kernel, yang baru terbukti di `9A/H-06`. Sebelum `9A/H-05` dan `9A/H-06` lulus, fungsi alamat sementara tidak boleh dipakai di instalasi.
- Bila satu langkah gagal: berhenti, cabut hak dengan mematikan soket (`HI-09.3`), catat, dan jangan pernah mengubah berkas yang dikirim.

Tidak ada rahasia di bab ini. Semua isi **belum terverifikasi** pada host nyata.

## 1. How this chapter is used

| | |
|---|---|
| What | The ten steps of the security review (`verification/02_security.md`, section 5.4) as steps for the user, for the helper as it was delivered: a root service on a local socket, one group, two unit files, no sudoers file (decision C19). Each step has its exact command or file content, what it must print, and the check that shows it took effect |
| Who | Performer `USER` for every step: the owner of the installation, with administrator rights. User action UA-3 of chapter 1 |
| When | Once. `HI-01` to `HI-07` after `9A/H-01` and after the security review of the helper as delivered (`HI-01`), **before `9A/H-16`** (sequence 8a of chapter 1). `HI-08` inside `9A/H-05`. `HI-09.1` and `HI-10` after `9A/H-05`. Section 2 states why |
| Capture operation | none for `HI-01` to `HI-07` and `HI-09`: no Core is needed. `HI-08` needs a Core in `REAL_PRODUCTION` |
| What it changes on the host | One file under `/usr/local/sbin`, one file under `/etc/dems`, two files under `/etc/systemd/system`, one group, one membership, one enabled socket unit. No address of the host is changed by any step of this chapter |

**What the helper is, as delivered** (read from `scripts/host/netalias/dems-core-netalias`, not from a host):

- It serves one request per connection. The service manager starts one instance per connection, as root, without arguments.
- The request is one line of at most 64 bytes: `add <a.b.c.d>/24 <minutes>` (minutes 5 to 480, refused outside, never clamped) or `del <a.b.c.d>/24`. The answer is one line, `<code> <NAME>`; `0 OK` is the only acceptance.
- The interface is never in the request. It is read from the root-owned file `/etc/dems/netalias-interface`.
- One temporary address at a time.
- The only caller it serves is the ONE member of the group `dems-netalias`. Root itself is refused through the socket.
- It writes one journal line per call: `dems-core-netalias: caller_uid=<n> verb=<add|del|-> address=<a.b.c.d/24|-> result=<NAME> code=<n>`.
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

## 2. What must come before the Core's unit is first started

Two facts of the built product fix the order.

1. The Core's unit file (file G of the host profile, item `HOST-40`) holds `SupplementaryGroups=audio dems-netalias`. A unit that names a group the host does not have is not started by the service manager; the expected failure is `status=216/GROUP` (to confirm in 9A/H-16).
2. A Core in `REAL_PRODUCTION` on Linux asks, at every start, for the helper's socket (`CAPTURE_HOST_ALIAS_SOCKET`: a socket owned by root, group `dems-netalias`, mode 660), for the helper file (`CAPTURE_HOST_ALIAS_HELPER_UNSAFE`) and for the socket's directory and the two unit files (`CAPTURE_HOST_ALIAS_GRANT_UNSAFE`), and refuses to start when one is absent or unsafe (decision C46; read from the built host and program checks). Once a camera interface is stored in the Core, it also compares the interface file with it (`CAPTURE_HOST_INTERFACE_FILE_MISMATCH`). These checks are asked when the Core's entry point hands the host facts to the boot (blueprint row 85); a tree without that hand-over asks none of them.

| Part of this chapter | Relation to the first `sudo systemctl start dems-core.service` (`9A/H-16.2`) |
|---|---|
| **`HI-01` to `HI-07`** | **Must be done before it** (sequence 8a of chapter 1). `HI-04` part A for the group (fact 1); `HI-02` and `HI-04` part B for the helper file, the unit files and the socket (fact 2); `HI-03` so that the self-check of `HI-05` and the refusals of `HI-06` can be read. Installing grants nothing that is used: without a Core no request reaches the socket but the user's own of `HI-05` and `HI-06`, and none of those adds an address |
| `HI-01` | Always first: nothing is installed before the hashes are compared |
| `HI-08` | After it: needs a Core in `REAL_PRODUCTION` and the camera interface chosen in the web console. It is not performed as a step of its own: it is steps `.6` and `.7` of `9A/H-05`, and its result is copied here |
| `HI-09.1`, `HI-10` | Last, after `9A/H-05` |

Three lines need a default route on the host: `HI-03.6` (the default-route line), request (b10) and step (c3) of `HI-06`. With way A of chapter 1, `PREP-03` step 2 (the room network plugged for the installation window), the route exists at sequence 8a and the three lines are measured at once. With way B (the offline package set) the host has no default route yet: the three lines cannot be measured and are repeated after `PREP-11` (chapter 1, `PREP-11` step 3). The helper checks the default route itself on every call, so the bound holds in the meantime.

The membership reaches a running Core only through its unit, at the Core's start. Adding the service user to the group does not change a Core that already runs.

## 3. The steps

### HI-01  Before installing: the review's statement and the three hashes

Capture operation: none   Changes on the host: none

**1. What it achieves.** The files in hand are the files that were reviewed, and the user knows under which condition they are installed.

**2. Precondition.** `9A/H-27` and `9A/H-01` passed; `9A/H-16` has not been started yet. No input-av helper and no sudoers line on the host; the product tree is at `<install-dir>`, owned by root (`HOST-05`); Python 3 is installed (`HOST-10`). `PREP-12` of chapter 1.

**3. Steps.**
- `HI-01.1` Read the security review of the commissioning functions as built, handed over with the closing report of the development (`verification/119_commissioning_security.md` of the development task; it does not exist at the time of writing: to confirm when blueprint row 119 lands).
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
62c0b7260a743224de455892ddb12c7cee8ce0c1907c1e9f89291ff35c2ee5fb  dems-core-netalias
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
- `.6` `62c0b7260a743224de455892ddb12c7cee8ce0c1907c1e9f89291ff35c2ee5fb  /usr/local/sbin/dems-core-netalias`.

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

**2. Precondition.** Part A: the service user exists (`HOST-04`). Part B: `HI-01` to `HI-03` passed, and part A done. **Both parts come before the Core's unit is first started (section 2).**

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

**2. Precondition.** `HI-04` passed. `HOST-18` passed in `9A/H-01` (the conflict-check tool is the iputils one). The variable `ASK` of section 1 is set in this terminal.

**3. Steps.**
- `HI-05.1` `stat -L -c '%U %a %n' /usr/sbin/ip /usr/bin/arping /usr/bin/python3`; `/usr/bin/python3 --version`.
- `HI-05.2` As root, one connection: `sudo /usr/bin/python3 -I -c "$ASK" 'del 203.0.113.10/24'`.
- `HI-05.3` `stat -c '%U %G %a' /run/dems-core-netalias/marks`; `ls -A /run/dems-core-netalias/marks | wc -l`.
- `HI-05.4` `sudo /usr/bin/python3 -I -S -B /usr/local/sbin/dems-core-netalias check; echo "exit $?"`.
- `HI-05.5` `ip -br -4 addr show dev <camera-interface>`.

**4. Expected result.**
- `.1` three lines that begin `root 755` (to confirm in 9A/H-25: the two tool paths on Ubuntu 24.04); `Python 3.12.<n>` (to confirm in 9A/H-05: the helper has not been run on this Python version).
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
| `50 HOST_STATE_UNREADABLE` | the route listing could not be read in the form the helper expects | stop; section 5, product |
| `no answer line` in step `.2` | no instance answered | section 5 |

**5. Pass criterion.** Tools present and root-owned: 3 of 3. Root refused through the socket: 1 of 1. Self-check `0 OK` with exit status 0: 1 of 1. Addresses on the camera port: 1.
If not met: by the table. Any other answer: section 5.

**6. What to record.** The Python version; "root refused: 12"; "self-check: 0 OK"; "addresses: 1".

### HI-06  Proof of the bound: the helper refuses

Capture operation: none   Changes on the host: none that stays (the interface file is changed and restored in part C)

**1. What it achieves.** On the real host the helper refuses a caller outside the group, an address outside its bounds and a wrong interface, and writes one journal line for every call that reaches it. Only harmless requests are used: each is either refused before any tool is started, or is a `del` of an address that was never added, or is the read-only self-check. No request of this step may be answered `0 OK`.

The security review asks for nine refusals. Those that need an address to be added or a tool to be removed cannot be shown with harmless requests and are not in this chapter; section 4 states where each of the nine is proven.

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
- `HI-08.1` `sudo systemctl restart dems-core.service`
- `HI-08.2` `journalctl -u dems-core.service -b --no-pager | tail -n 80`
- `HI-08.3` `systemctl show dems-core.service -p NoNewPrivileges`; `sudo grep NoNewPrivs /proc/<core-pid>/status`; `sudo grep '^Groups:' /proc/<core-pid>/status`; `getent group audio dems-netalias`.

**4. Expected result.**
- `.2` the line `capture fence passed` with the operation `REAL_PRODUCTION`, and a line with the code `CAPTURE_PROGRAM_CHECKS_PASSED`; no line holds one of the four codes `CAPTURE_HOST_ALIAS_SOCKET`, `CAPTURE_HOST_ALIAS_HELPER_UNSAFE`, `CAPTURE_HOST_ALIAS_GRANT_UNSAFE`, `CAPTURE_HOST_INTERFACE_FILE_MISMATCH`. A journal without the "checks passed" line is a tree whose entry point does not hand the host facts to the boot (blueprint row 85): recorded as "start checks of the helper not asked", which is not a pass of this step.
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
Hashes: 62c0b7260a743224de455892ddb12c7cee8ce0c1907c1e9f89291ff35c2ee5fb (helper),
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
| 5 | The conflict-check tool missing | `9A/H-25.6` (added in Revision 2): the user moves the tool away, reads the self-check and one `del` request, and restores it. `HI-05.4` shows the opposite case, the tool present | 37 |
| 6 | `del` of an address the helper did not add | `HI-06` (b8); `9A/H-05.3` (d) | 45 |
| 7 | An overlap with a `/24` of another port | `HI-06` (b10), when another port holds a private address | 40 |
| 8 | The default-route port | `HI-06` (c3), when the host has a default route | 34 |
| 9 | One alias more than the limit (the delivered limit is one) | `9A/H-25.5` (added in Revision 2): with one address in place, a second `add` in another `/24` is refused. The helper asks this bound before the one of code 43 | 41 |

Beyond the nine, `HI-06` shows: an account outside the group refused by the socket; root refused by the helper (12); a lifetime out of range (27); a host part out of range (26); an unknown verb (15); a `/24` the camera port already has (43).

## 5. If a step fails

1. Stop at that step. Do not go on to the next one and do not start `9A/H-05`.
2. If `HI-04` part B was reached, put the host into the safe state: `HI-09.3`. With the socket stopped and disabled no account can cause the helper to run. The files may stay while the cause is sought.
3. Read what the service manager and the helper wrote: `systemctl status dems-core-netalias.socket --no-pager`, `sudo journalctl -u dems-core-netalias.socket -u 'dems-core-netalias@*' -b --no-pager | tail -n 40` (to confirm in 9A/H-05: that the pattern selects the instances).
4. Sort the cause:
   - **Installation**: a command was mistyped, a step was left out, a precondition of the host profile is not met. Correct it and repeat from that step.
   - **Product**: the step was done as written and the output differs: a unit the service manager does not accept, an instance that does not answer (`no answer line`), a request answered with another code or with `0 OK`, a self-check that answers `50` or `60`. Record the step, what was printed and what was expected; hand it to the development. `9A/H-05`, `9A/H-25`, `9A/H-06` and `9A/H-13` to `9A/H-15` are "not run: helper not installed".
5. Never repair on the host: no edit of a delivered file, no change of the socket's mode, group or owner, no second member in the group, no sudoers line, no capability on the Core. Each of these would pass a step and remove the bound the step exists for.
6. A correction by the development changes at least one hash. The helper is then removed (`HI-09.1` to `HI-09.6`) and this chapter is run again from `HI-01` with the new hashes.

A recording session never calls the helper. But a production Core does not **start** on a host where the helper's socket, file or unit files are absent or unsafe (section 2, fact 2). A host on which this chapter stopped, or on which the grant was taken away with `HI-09.3`, therefore cannot start its production Core until the chapter is completed, on a tree that asks those checks. Whether an installation that never uses the commissioning functions must carry the helper is not ruled (open point 10 of chapter 1).

## 6. Open points of this chapter

| # | Open point | Effect | Settled by |
|---|---|---|---|
| A | Settled in Revision 2: chapter 1 places `HI-01` to `HI-07` at sequence 8a, before `9A/H-16` | Section 2 | - |
| B | The removal timer of requirement S13-10 (a) is not built (blueprint rows 104 and 106) | Four lines are marked "to confirm when blueprint rows 104 and 106 deliver the removal timer": section 1, `HI-01.2`, `HI-09.1` and `HI-10`. If `9A/H-06` shows that the kernel does not remove the address, the helper changes and this chapter is run again | `9A/H-06`; the development |
| C | The security review of the helper as delivered does not exist yet | `HI-01.1` cannot be met until it does; with the order of Revision 2, `9A/H-16` then waits as well (chapter 1, `PREP-12` step 2) | the development: blueprint row 119 |
| D | Settled for the boot checks: built, with the four codes `HI-08` names; the hand-over at the entry point waits for blueprint row 85. Not built: the Core's caller of the helper | `HI-08`; whether the helper answers from inside the Core's unit is `9A/H-06` | blueprint rows 85 and 105 |
| E | The self-check answers `35` until the first connection has made the marks folder, and again after every restart of the host | `HI-05` orders the first connection before the self-check | `9A/H-05` |
| F | Settled in Revision 2: refusals 5 and 9 have the steps `9A/H-25.6` and `9A/H-25.5` | Section 4 | - |
| G | The client of section 1 was not run; `nc -N -U` is named as an equivalent where it is installed | The first request of `HI-05.2` shows whether it answers | `9A/H-05` |
