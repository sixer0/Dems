# DEMS Core: hardware acceptance test package, chapter 2 - host, helper and audio

**Status of this document: UNVERIFIED on real hardware.** It was written on a development Mac with no Linux host, no camera and no audio interface. No step below has been performed anywhere. Every expected result is a statement of intent taken from the design documents and from results on doubles. A line the author could not settle carries "to confirm" and is listed in section 4.

This chapter is read with chapter 1 (`HW-ACCEPTANCE-1-FRAME.md`): the order of the run, the performers, the two databases, the user actions, the values B-1 to B-7, the result record, the files for the collectors (section 9.5) and the failure rule are there and are not repeated here.

**Revision 2 (2026-10-13)**, the consistency pass (blueprint row 181). Still unverified on a host. Changed in this file:

- `9A/H-01`: the precondition follows the frame's two ways for the room network; the pusher of step `.9` is named; the probe's own port and encoder are stated.
- `9A/H-24`, `9A/H-04`: the leftover finding and the two worker codes confirmed against the code; the host checks are not asked in the development operation (open point D settled).
- `9A/H-16`: the precondition now holds `HI-01` to `HI-07`; the environment keys of the relay and the guard; the 13 host checks and 4 program checks with their codes (decision C46); what steps `.8` to `.10` show as built.
- `9A/H-05`: precondition `HI-01` to `HI-07`; step `.3` uses the client of chapter 4; step `.8` produces the mismatch on the file side, so that the Core can be started again.
- `9A/H-25`: steps `.5` and `.6` added for the helper's refusals 41 and 37.
- `9A/H-07`, `9A/H-08`: the codes of the card functions; the limits of the card match; bound B-7 is in the frame; open point OP-1 and the worker-restart limit.
- Section 4: points A, D, E, F and G settled; B and H re-stated; I added. Marks "to confirm" left in this file: each names the row or the check it waits for.


## Ringkasan (Bahasa Indonesia)

Bab 2 berisi 12 pemeriksaan untuk host Linux, helper alamat, dan audio: `9A/H-27`, `9A/H-01`, `9A/H-02`, `9A/H-24`, `9A/H-03`, `9A/H-04`, `9A/H-16`, `9A/H-05`, `9A/H-25`, `9A/H-06`, `9A/H-07`, `9A/H-08`, dalam urutan pelaksanaan yang ditetapkan bab 1. Setiap pemeriksaan ditulis dalam enam bagian: apa yang dibuktikan, prasyarat, langkah bernomor dengan pelakunya, hasil yang diharapkan per langkah, kriteria lulus yang terukur, dan apa yang dicatat. Arti sebuah kegagalan dan baris pengembangan yang dibuka kembali ditulis di akhir bagian 5 tiap pemeriksaan.

Hal yang paling menentukan di bab ini:

- `9A/H-01` memuat pengulangan pengamatan E-11 pada pustaka media hasil build host ini. Worker hanya menerima kamera bila pustaka memancarkan baris `Parsing[<n>]: ANNOUNCE <alamat> RTSP/1.0` dengan teks, level, dan saat yang sama seperti di mesin pengembangan. Bila baris itu tidak ada atau berbeda, perekaman kamera tidak mungkin dan cabang C berlaku tanpa tinjauan ulang.
- `9A/H-03` adalah pengamatan, bukan vonis: tingkat sinkronisasi disk bukti dicatat; bila tidak penuh, pengguna harus memutuskan sebelum putusan tahap 2.
- `9A/H-06` menguji bahwa alamat sementara hilang sendiri setelah masa berlakunya walau Core dimatikan paksa. Bila gagal, fungsi alamat sementara tidak boleh dipakai di instalasi.
- `9A/H-08`: masukan mikrofon yang senyap adalah GAGAL, bukan catatan. Pada bangku uji sistem lama rekaman audio praktis senyap.

Tidak ada langkah yang dilakukan agen. Semua langkah dengan `sudo`, kunci, atau kata sandi dilakukan pengguna. Tidak ada rahasia, alamat jaringan nyata, atau nama orang yang ditulis ke lembar hasil. Dua nilai belum punya sumber dan harus ditetapkan pengguna sebelum uji: ambang level suara (B-7, kini tercantum di bab 1 bagian 5) dan saat pembacaan setelah Core dimatikan (usulan di `9A/H-02`). Revisi 2 (2026-10-13): helper alamat dipasang (`HI-01` sampai `HI-07`) sebelum `9A/H-16`; start produksi menanyakan 13 pemeriksaan host dan 4 pemeriksaan program dan menolak bila satu tidak terpenuhi; kartu suara model sama pada port lain masih dicocokkan tanpa pemberitahuan.

## 1. How this chapter is used

**Form.** Every check has the header line and the six parts of chapter 1, section 8. Part 5 ends with a paragraph "If not met": what the failure means, how it is sorted by chapter 1, section 10, and which development row or decision it reopens. Row numbers are those of the implementation blueprint of the development task; the user hands the record line to the development and need not know the rows.

**Collectors.** A `SCRIPT` step names a collector, `collect-hNN.sh` in `scripts/hardware-acceptance/` (one per check, NN the check number). They exist since the scripts rows of the package (blueprint rows 128, 129) and have run only on the development Mac against doubles. Each has a dry mode (`--dry`) that prints what it would read and reads nothing. A collector writes one text file, `hNN-run<k>[-mode].txt`, into the evidence folder the user names on its command line; that file name goes into the "evidence" field of the result line. A collector calls no `sudo` and reads no file of another account: a reading that needs either is printed as a line for `USER`, and its output is handed over as a file (`--sudo-reads`, `--core-log`, `--journal-file`, `--audit-file`, `--boot-log`, `--alsa-config`). Chapter 1, section 9.5, says where each such file comes from. Where a collector prints "(absent)" for a code or a field, the product does not write that code or field as the collector expects it; the reading is then `USER`'s, from the log, and the line is recorded as read by a person.

**If a collector cannot run,** its step is done by `USER` with the commands the step lists, and the output is copied into a note file of the same name.

**Placeholders** are those of the host profile, plus:

| Placeholder | Meaning |
|---|---|
| `<alias-address>` | A private address in a `/24` that no port of the host holds, chosen by the user for the helper proofs. Not written into the record |
| `<factory-address>` | The address a factory-new camera answers on, read from its label |
| `<evidence-folder>` | Where the collectors write, outside the repository and outside `<data-dir>` |

The one literal address in this chapter is `203.0.113.10`. It belongs to a range reserved for documentation, is no device's address, and is used only in a request the helper must refuse.

**Never typed into a collector, a note or the record:** a password, a key, a token, a real address of the site, a personal name.

## 2. The checks

### 9A/H-27  The host carries no input-av installation

Capture operation: none   Database: -
Recording: none   User actions: UA-7

**1. What it proves.** No program, service, helper, privilege line or generated audio configuration of input-av is on the acceptance host. A second recorder beside the Core would open the same sound card, hold port 8554 on the loopback interface (the earlier system's preview relay listens there, and so does the Core's first camera listener) and falsify every later result.
On doubles: nothing. There was no host.

**2. Precondition.** `PREP-03` done; the user's statement of UA-7 is in the header of the record.

**3. Steps.**
- `9A/H-27.1` `USER`, terminal: `systemctl list-unit-files 'dems-nvr*' 'dems-mediamtx*'`.
- `9A/H-27.2` `USER`, terminal: `sudo ls /usr/local/sbin/dems-netalias /etc/sudoers.d/dems-netalias`.
- `9A/H-27.3` `USER`, terminal: `sudo grep -r -c netalias /etc/sudoers /etc/sudoers.d`.
- `9A/H-27.4` `USER`, terminal: `sudo ls /etc/dems-nvr /etc/dems-nvr.env`.
- `9A/H-27.5` `USER`, terminal: `sudo find / -xdev -name 'dems-alsa.conf' -print` and `sudo grep -r -l ALSA_CONFIG_PATH /etc/environment /etc/systemd/system`.
- `9A/H-27.6` `SCRIPT` `collect-h27.sh`: the process list filtered for `mediamtx`, `uvicorn` and `nvr`; the listening sockets on ports 8000, 8554 and 9997; `getent passwd dems`.

**4. Expected result.**
- `.1` the last line is `0 unit files listed.`
- `.2` `No such file or directory` twice.
- `.3` `0` after every file name.
- `.4` `No such file or directory` twice.
- `.5` both commands print nothing.
- `.6` 0 processes, 0 listeners on the three ports. `getent` prints nothing; if it prints an account, that account is not `<service-user>`.

**5. Pass criterion.** Findings: 0 in 6 of 6 steps.
If not met: an installation fault. The user removes what was found (this package does not describe the removal) and repeats the check as run 2. Nothing of the development is reopened. No later check is started while a finding stands (finding F-06 of the plan verification).

**6. What to record.** Per step "0" or what was found, by kind only ("1 unit", "1 file"), and the collector's file name. Not recorded: a path under a home directory, an account name other than `dems`.

### 9A/H-01  The host profile applied; the capture programs built and checked; the listener's path gate on this host's build

Capture operation: none   Database: -
Recording: none   User actions: UA-1

**1. What it proves.** Three things about the Linux host. (a) The machine is in the state the host profile describes. (b) The capture worker, the camera relay and the guard build against the pinned media library on this host and pass their own checks. (c) The media library of this host's build behaves toward a push as the development machine's did, and emits the announce line the worker's gate depends on, so that the worker accepts the right push and refuses every other.
On doubles: the programs' checks on macOS; in a container, if the development's closing report says so, the build, the repeat of the path observations and the announce line against the pinned library. A container result is a container result. Not shown anywhere: the real kernel, the firewall beside the loopback rule, this host's own build of the library.

**2. Precondition.** `9A/H-27` passed. UA-1. The camera port is connected to the PoE switch. The packages and source archives the profile needs (items `HOST-09`, `HOST-10`, `HOST-12`, `HOST-18`, `HOST-25`, `HOST-26`) are on the host, by one of the two ways of chapter 1, `PREP-03` step 2: fetched while the room network cable is plugged for the installation window (way A), or from the offline package set (way B). This check is run and recorded inside that window; the cable is pulled later, in `PREP-08` step 1. The helper items `HOST-43` to `HOST-47` are not part of this check (chapter 4, then `9A/H-05`).

**3. Steps.**
Part a, the profile.
- `9A/H-01.1` `USER`, terminal: apply items `HOST-01` to `HOST-42` of `scripts/host/HOST-PROFILE-UBUNTU-24.04.md` in their order, each with its command or file. Unit file G is written with the `ExecStart` line still open; it is settled in `9A/H-16`.
- `9A/H-01.2` `SCRIPT` `collect-h01.sh --profile`: for every item `HOST-01` to `HOST-42` the item's check command and its output, and one word per item: `met`, `not met`, `to judge` or `deferred`. Checks that need `sudo` are run by `USER` and their output is given to the collector as a file; for those the collector prints `to judge` with the expected output beside what was read, and `USER` turns each `to judge` into `met` or `not met` in a note beside the collector's file before criterion 1 is counted. Items whose check needs a running Core are printed as `deferred` with the check that reads them: `HOST-08` (in `9A/H-17`), the process-bound halves of `HOST-35`, `HOST-36`, `HOST-38`, `HOST-39`, `HOST-40`, `HOST-42` (in `9A/H-16`), `HOST-41` and `HOST-49` (in `9A/H-04` and `9A/H-16`), the second half of `HOST-23` (in `9A/H-12`).
- `9A/H-01.3` `USER`, terminal, loopback rule in effect (`HOST-25`): read `sudo nft list table inet dems_loopback`; then from the administrator account `nc -z -w 2 127.0.0.1 8554`; read the table again. Then `sudo runuser -u <service-user> -- nc -z -w 2 127.0.0.1 8554` and read the table a third time.
- `9A/H-01.4` `USER`, terminal: restart the host; after it is up, `systemctl is-active dems-loopback-rule.service`, `sudo nft list table inet dems_loopback`, `sudo ufw status verbose`.
- `9A/H-01.5` `USER`, terminal, time (`HOST-31`, `HOST-32`; open point 5 of chapter 1): `timedatectl show -p NTPSynchronized --value` and `systemctl is-active time-sync.target`, read once here (way A: with the room network plugged) and once more in `PREP-08` step 1 before the cable is pulled.

Part b, the programs.
- `9A/H-01.6` `USER`, terminal, from `<install-dir>` as root: `PKG_CONFIG_PATH=<ffmpeg-prefix>/lib/pkgconfig make -C apps/capture-worker`, then `make -C apps/capture-worker versions`, then `ldd apps/capture-worker/build/capture-worker`.
- `9A/H-01.7` `USER`, terminal: build the camera relay and the guard program by the commands the product tree names beside each (`HOST-15`); read the library version each states.
- `9A/H-01.8` `USER`, terminal: `namei -l` on the three built programs and on `<ffmpeg-prefix>/bin/ffmpeg` (`HOST-05`, `HOST-16`).

Part c, the listener on this host's build.
- `9A/H-01.9` `USER`, terminal: run the worker's own capture series, `make -C apps/capture-worker e2e`, with its output saved to a file and `echo "exit $?"` appended, for step `.11`. The series pushes with `libx264` (and `libx265` for its H.265 cases); the FFmpeg of `HOST-12` has neither, so the series needs the second FFmpeg build that chapter 1 names in `PREP-06` step 1, reachable by the name the series calls (to confirm in this step, on the host: how the series is pointed at that build; open point B). Without it this step and step `.11` are "not run: no pusher on the host". Since the gate was built, the series contains the permanent cases: the seven near-miss paths, each with a right-path control in the same run; "no announce line: refused"; a second `ANNOUNCE`; two cameras pushed at the same instant, one right and one wrong, in both assignments.
- `9A/H-01.10` `SCRIPT` `collect-h01.sh --announce`: it builds the announce-line probe of the package against `<ffmpeg-prefix>` (the probe is the program printed in the development's record of experiment E-11b; the scripts row carries its source into the package, because the development kept it outside the tracked tree) and runs it in observe mode on `127.0.0.1`, on the probe's own port 18563 (never 8554 to 8564: the loopback rule of `HOST-25` keeps this account off the worker's ports), against a pusher of its own: `<ffmpeg-prefix>/bin/ffmpeg` with the built-in encoder `mpeg4` and a generated picture. The announce line is written while the `ANNOUNCE` request is read, before any media, so the codec does not bear on it. 3 runs to the listener's own path, 3 runs to the last-character near miss. The probe's `README.md` in `e11b-announce-probe/` gives the build line and one run by hand. It collects, per run: the library version line; every line of the form `Parsing[<n>]: ANNOUNCE <address> RTSP/1.0` with its level and its instant relative to the return of the open; every line that starts `Updating control URI to`; the statuses the pusher read; the packets the probe read. Paths are printed as `<right>` and `<wrong>`, never as text.
- `9A/H-01.11` `SCRIPT` `collect-h01.sh --series`: from the output of step `.9`, the result line of each permanent case by its name, and a search of the worker's log and output of that series for the path texts the series used.

**4. Expected result.**
- `.1`, `.2` every item that is not `deferred` reads `met`.
- `.3` first reading: one rule with `tcp dport 8554-8564` and `skuid != <service-user>`. After the administrator's attempt: `nc` fails at once and the rule's `counter packets` figure is at least 1 higher. After the service user's attempt: the figure is unchanged (the attempt fails only because nothing listens).
- `.4` `active`; the table with its one rule; `Status: active` with `Default: deny (incoming), allow (outgoing), deny (routed)`.
- `.5` `yes` and `active`. The two values are recorded as read; a `no` does not fail this check, but a production start refuses on it (`CAPTURE_HOST_CLOCK_NOT_SYNCHRONISED`, read in `9A/H-16`), and it decides how `PREP-08` is done (open point 5 of chapter 1).
- `.6` `make` exits 0; `versions` prints `63.1.102` for libavformat; `ldd` resolves `libavformat.so.63` under `<ffmpeg-prefix>/lib`.
- `.7` both build commands exit 0; each program states libavformat 63.1.102.
- `.8` owner `root` on every component, no `w` for group or others.
- `.9` the target exits 0.
- `.10` in 6 of 6 runs exactly one line `Parsing[<n>]: ANNOUNCE <address> RTSP/1.0`, at level 56, inside the open and before the answer to `ANNOUNCE` is sent, with `<address>` equal to what the pusher sent and `<n>` equal to the length of that request line. In the 3 wrong-path runs also one line `Updating control URI to <address>`; in the 3 right-path runs none. In all 6 runs the pusher read status 200 four times and the probe read 25 packets: the library by itself accepts a push to another path, as on the development machine.
- `.11` near misses refused 7 of 7 (no connect report, 0 bytes in any file) while every control records; the no-line case and the second-`ANNOUNCE` case refused, each with its own code; in both assignments of the two-camera case the right camera records and the wrong one does not; occurrences of a path text in the worker's log and output: 0.

**5. Pass criterion.** All of:
1. profile items `not met`: 0, and items left `to judge`: 0 (deferred items are not counted here);
2. the loopback rule: counter rise of at least 1 for the foreign account, 0 for the service user; rule present after the restart: 1 of 1;
3. the three programs built: 3 of 3, each stating libavformat 63.1.102; the worker's `make` exits 0;
4. the announce line: present with the stated text, level 56 and instant in 6 of 6 runs;
5. the permanent cases: near misses refused 7 of 7 with controls recording 7 of 7; the no-line case refused 1 of 1; path texts in the worker's log and output: 0.

If not met:
- criterion 1 or 2: an installation fault unless the item's own command fails as written. A command of the profile that does not work on Ubuntu 24.04 is a product finding against the host profile (row 76) and its scripts (row 77). A missing loopback rule also reopens the host check of row 80 (requirement BR-12): the rule is the only control against a local process taking a camera's one connection.
- criterion 3: product. Reopens the container build (rows 78, 79) and the pins of the worker. The run stops here: no later check has a recorder.
- criterion 4: product, and the heaviest finding of the package. Without the line, or with other wording, level or instant, the worker refuses every push, the right one too: no camera can be recorded on this host. It fails closed; nothing foreign is recorded. It reopens the selection of branch B (decisions C26 and C27, gate BR-10, row 141): **branch C applies without a further security review** (the worker pulls; rows 58, 142 and 175 to 179 are replaced, row 9 runs). If the library on this host refuses a wrong-path push by itself with an RTSP error status, record that as seen; it is stricter than the development machine and is a finding for row 8's table, not a FAIL of this criterion.
- criterion 5: product. Reopens rows 58, 142, 178 (the gate and its tests) and the re-verification of row 59.

**6. What to record.** The host's release line and `uname -m` (into the header); counts of `met`, `not met`, `deferred`; the two counter figures; the three version lines; "announce line 6 of 6" or the count seen, with level; the series' result per case name; the two time values of step `.5`; the collector's three file names. Not recorded: an address of the site, the path texts of the series, the value of any setting of `/etc/dems/core.env`.

### 9A/H-02  No child process outlives a Core that is ended abruptly

Capture operation: `REAL_DEVELOPMENT`   Database: throw-away
Recording: generated sources (one, killed)   User actions: UA-1

**1. What it proves.** When the Core dies without a shutdown, the capture worker and every helper it started end by themselves on Linux. An orphan would keep writing an evidence file and keep the sound card open. It belongs to the process door and the liveness rule of the capture layer.
On doubles: 0 survivors on macOS, and in a container if the closing report says so. Not shown: the real kernel.

**2. Precondition.** `9A/H-01` passed. `PREP-04` to `PREP-06` done: a development-capture Core runs on the throw-away database, started by `USER` **from a terminal** as `<service-user>`, not as the service unit. Reason: under the unit the service manager ends every process of the unit when the Core dies, which would hide whether the product's own rule did it. The reading instant below is 10 s after the kill; no design document states one (open point C).

**3. Steps.**
- `9A/H-02.1` `OPER`, web console on the host (`127.0.0.1`): start a session from the four generated sources; wait until the monitor shows it recording.
- `9A/H-02.2` `SCRIPT` `collect-h02.sh --before`: the Core's process id; every descendant of it with process id, short name and program path; the listeners on `127.0.0.1` ports 8554 to 8564.
- `9A/H-02.3` `USER`, terminal: `sudo kill -KILL <core-pid>`; note the host clock.
- `9A/H-02.4` `SCRIPT` `collect-h02.sh --after`, started 10 s after step `.3` and again 60 s after it: which of the process ids of step `.2` still exist; the listeners on ports 8554 to 8564.

**4. Expected result.**
- `.1` the session is recording.
- `.2` at least 2 descendants (the worker and at least one helper); 2 listeners.
- `.3` the Core's process is gone.
- `.4` at 10 s: 0 of the listed process ids exist, 0 listeners. At 60 s: the same.

**5. Pass criterion.** Surviving child processes at 10 s: 0. Listeners on ports 8554 to 8564 at 10 s: 0. Ended by: the product's own rule (the Core did not run under the service unit).
If not met: product. Reopens the guard and liveness rule of the capture layer (rows 21, 22, 23 and 25; hypothesis HA-11) and the container check of row 79. `9A/H-24` is still run, on the same kill: it then shows whether the next start names the survivor.

**6. What to record.** Descendants before (count, short names), survivors at 10 s and at 60 s (count, short names), the collector's two file names. The media of this recording is throw-away material; nothing of it is recorded or kept.

### 9A/H-24  No leftover after the kill; a planted leftover is named at the next start

Capture operation: `REAL_DEVELOPMENT`   Database: throw-away
Recording: generated sources (the kill of `9A/H-02`, then starts only)   User actions: UA-1

**1. What it proves.** At its start the Core looks for processes of its own capture programs that an earlier Core left behind, and names them instead of recording beside them. On Linux the process table gives only a short name of at most 15 characters, so the check reads the program's path through `/proc`. It belongs to the leftover detection of the capture layer.
On doubles: fixture process listings in the macOS form and in the Linux short-name form; a planted leftover was named in both. Not shown: the real process table, the tools at their Ubuntu paths.

**2. Precondition.** `9A/H-02` run (passed or failed); no Core runs.

**3. Steps.**
- `9A/H-24.1` `SCRIPT` `collect-h24.sh --tools`: whether `/bin/ps` and `/usr/bin/readlink` exist; the output form of `ps -axo pid=,comm=` and `ps -axo pid=,args=` for the collector's own process (`HOST-17`).
- `9A/H-24.2` `USER`, terminal: start the development-capture Core as in `PREP-06` step 2; read its boot log.
- `9A/H-24.3` `USER`, terminal: stop that Core in the normal way. Then, as `<service-user>`, start one process of the product's helper program that does nothing and stays alive (the private FFmpeg copy of `PREP-06`, reading a generated silent source into nothing); note its process id.
- `9A/H-24.4` `USER`, terminal: start the development-capture Core again; read its boot log.
- `9A/H-24.5` `USER`, terminal: end the planted process with `kill`; start the Core once more; read its boot log.

**4. Expected result.**
- `.1` both tools exist; `comm=` prints a name of at most 15 characters, `args=` the full path.
- `.2` the Core starts; the log names no leftover process.
- `.3` the planted process is alive.
- `.4` the Core starts and its boot log holds one warning with the code `DEV_HELPER_LEFTOVER` and `count` 1, with the text "helper processes of an earlier run are left: capture must not start until none is". It is a warning, not a refusal, and it states a count, not the process id (read from the built fence). `USER` confirms with `ps -p <pid>` that the planted process is the one that is left.
- `.5` the Core starts; no leftover is named.

**5. Pass criterion.** Warnings `DEV_HELPER_LEFTOVER` after the kill of `9A/H-02` (step `.2`): 0. With the planted process: 1 warning with `count` 1. After its removal: 0.
If not met: product. A leftover that is not named reopens the leftover detection (row 24, hypothesis HA-12) and the fence call that uses it. A leftover named at step `.2` although `9A/H-02` showed 0 survivors is a false alarm of the same rows. If a tool is missing at step `.1`: installation, `HOST-17`.

**6. What to record.** The two tool lines; the count at step `.2`, `.4`, `.5` (0, 1, 0 or what was seen); the code of step `.4`; the collector's file name. The collector reads the tools only (step `.1`); the three boot logs are read by `USER`.

### 9A/H-03  The durability level the evidence disk gives

Capture operation: `REAL_DEVELOPMENT`   Database: throw-away
Recording: generated sources (one, on the evidence disk)   User actions: UA-1

**1. What it proves.** Which sync level the worker states for the first durable fragment of a camera file on this host's evidence disk. On macOS the worker uses a full-sync call that Linux does not have. The design's hypothesis H-K: on Linux the worker states the weaker level, and a production Core then raises one critical notice in every session.
On doubles: nothing for this disk. A container's file system is not the evidence disk.

**2. Precondition.** `9A/H-01` passed; the development-capture Core runs; the throw-away media store lies on the same disk as `<data-dir>/media/sessions` (`PREP-05` step 3).

**3. Steps.**
- `9A/H-03.1` `SCRIPT` `collect-h03.sh --disk`: `findmnt -no FSTYPE,SOURCE,OPTIONS --target` for the throw-away media store and for `<data-dir>/media/sessions`.
- `9A/H-03.2` `OPER`, web console on the host: start a session from the generated sources; let it record for 60 s; end it in the normal way.
- `9A/H-03.3` `SCRIPT` `collect-h03.sh --level`: from the Core's log of that session, per camera file, the line with code `CAPTURE_SYNC_LEVEL` or `CAPTURE_SYNC_LEVEL_NOT_FULL` and its stated level; from the session's notices, any notice `EVIDENCE_VOLUME_SYNC_NOT_FULL` with its level and whether it is marked critical.

**4. Expected result.**
- `.1` the same source for both folders; a local Linux file system.
- `.2` the session records and ends.
- `.3` one level line per camera file, 2 lines. Either both state the full level and no notice exists, or both state a weaker level (`FSYNC`, or `NOT_STATED`) and the notice exists once per camera file. In this development operation the notice is advice and is not marked critical; in `REAL_PRODUCTION` the same level marks it critical.

**5. Pass criterion.** This check is an **observation, not a verdict**. It is `PASS` when one of the three outcomes is recorded with the file system type and the level; it is `FAIL` only when no level line exists for a recorded camera file.
- Outcome 1, full level, no notice: nothing follows.
- Outcome 2, level `FSYNC`: hypothesis H-K holds. **The user must decide** before the ruling of chapter 1, section 11, because every production session on this host will carry a critical notice: the decision is a row on the sync-level rule (accept the level on this disk with its reason, change the disk or its settings, or ask the development for a Linux full-sync path). It is not waved through.
- Outcome 3, level `NOT_STATED`: as outcome 2, and a product finding: the worker did not say what it did.
If `FAIL`: product. Reopens the worker's first-durable-fragment record and the host profile's open point 1 (row 76).

**6. What to record.** File system type; the level per camera file; notices: count, and "critical" yes or no; the outcome number. The same reading is taken again from S1 in `9A/H-17`, where the operation is `REAL_PRODUCTION`; the summary of chapter 1, section 9.4, item 5 uses both.

### 9A/H-04  A missing prerequisite is named at start; restored, none is named

Capture operation: `REAL_DEVELOPMENT`   Database: throw-away
Recording: none (starts only)   User actions: UA-1

**1. What it proves.** A Core that lacks something the host must provide says which thing, in its boot output, instead of starting and failing later inside a session. It belongs to the boot checks and the host checks of the capture layer.
On doubles: per prerequisite two tests on recorded command outputs (present, missing). Not shown: any of them against the real host's commands. The host checks of the profile are asked in `REAL_PRODUCTION` only; the development operation never asks them (read from the built checks and their test: 0 questions on a host on which everything is wrong). Case 2 below therefore shows outcome (ii) here, and its production reading is in `9A/H-16`.

**2. Precondition.** `9A/H-01` passed; `PREP-05`, `PREP-06` done; no Core runs.

**3. Steps.**
Case 1, a capture program.
- `9A/H-04.1` `USER`, terminal: start the development-capture Core as in `PREP-06` step 2 with the worker's path setting pointed at a path that does not exist; read the end of the boot log.
- `9A/H-04.2` `USER`, terminal: start it again with the correct setting; read the boot log; stop the Core.

Case 2, a prerequisite of the profile.
- `9A/H-04.3` `USER`, terminal: `sudo nft delete table inet dems_loopback` (the unit of the rule stays `active`: this is the case in which only the Core's own check can see the loss). Start the development-capture Core; read the end of the boot log; stop the Core if it started.
- `9A/H-04.4` `USER`, terminal: `sudo systemctl restart dems-loopback-rule.service`; `sudo nft list table inet dems_loopback`; start the Core; read the boot log; stop the Core.

- `9A/H-04.5` `SCRIPT` `collect-h04.sh`: from the four boot logs, the last line of each with its check name and code, and whether a listener of the Core existed 5 s after each start.

**4. Expected result.**
- `.1` the start is refused: the log ends with `"the server stopped: boot"` and names the worker program with the code `CAPTURE_WORKER_PROGRAM_UNUSABLE` and a reason word of the path rule. (`CAPTURE_WORKER_NOT_CONFIGURED` is the other code: it is given when the setting is not set at all, which is not this step.) No listener.
- `.2` the log holds `capture fence passed`; no prerequisite is named.
- `.3` outcome (ii), as built: the Core starts, because the host checks are not asked in the development operation. Outcome (i), a refusal that names the loopback rule, would be a change of the product and is recorded as seen.
- `.4` the table is back with its one rule; `capture fence passed`; no prerequisite is named.

**5. Pass criterion.** Case 1: named 1 of 1, with exactly that prerequisite and no other; after restoring, named 0. Case 2: outcome (i) with named 1 of 1 and, after restoring, named 0; or outcome (ii), recorded, in which case the result of case 2 is taken from `9A/H-16` steps `.8` to `.10` and this check passes on case 1 alone.
If not met: product. A missing prerequisite that is not named, or a wrong one named, reopens the boot checks and the host checks (rows 80, 81). The built host check reads the state of the rule's unit (`systemctl is-active dems-loopback-rule.service`), not the rule table, so it cannot see a table that was deleted while the unit stays active. That is a known gap against requirement BR-12 (open point 12 of chapter 1), read in `9A/H-16.9`.

**6. What to record.** Per step the code named or "none"; the outcome letter of case 2; the collector's file name.

### 9A/H-16  A production Core starts on an unassigned selector and refuses a session start

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: none (the refusal is the result)   User actions: X-1, X-2, UA-8

**1. What it proves.** A Core in the production operation starts with the user's signing key and with operators who do not have the published demonstration password, on a selector with four unassigned slots, and refuses to start a session in that state. It is the first production boot of the installation and the base of every later check.
On doubles: one session from four production-kind doubles, with a key made for the test and test operators; the 21 states of the unassigned selector. Not shown: the user's key, the user's operators, the service unit.

**2. Precondition.** `9A/H-01` passed. Chapter 4, steps `HI-01` to `HI-07`, done (sequence 8a of chapter 1): the group `dems-netalias` exists with its one member, the socket is active, the helper file and the interface file are in place. `PREP-07` to `PREP-10` done: the acceptance database migrated and seeded, the four slots unassigned in the one `SIMULATED` boot, X-2 and X-1 provided with their two commands. The room network cable is unplugged and the host was not restarted since (`PREP-08` step 1). No other Core runs; the development-capture Core is stopped for the rest of the run.

**3. Steps.**
- `9A/H-16.1` `USER`, terminal: complete `/etc/dems/core.env` as `HOST-34` states (`DEMS_CAPTURE_MODE=real`; the worker's absolute path in `DEMS_CAPTURE_WORKER`; the relay's in `DEMS_CAPTURE_RELAY` and the guard's in `DEMS_CAPTURE_GUARD`, each root-owned as `HOST-05` states; the media directory; the database settings; the installation device id typed in `PREP-10`; no development switch) and the `ExecStart` line of unit file G. The start command of a production Core is not settled in the design (open point 4 of chapter 1): write down the form used, without any value of the environment file. `sudo systemctl daemon-reload`.
- `9A/H-16.2` `USER`, terminal: `sudo systemctl start dems-core.service`; then `journalctl -u dems-core.service -b --no-pager`.
- `9A/H-16.3` `SCRIPT` `collect-h16.sh --process`: the capture operation printed in the line `capture fence passed`; the listeners of `<service-user>` with their local address; for the Core's process the halves of the profile deferred from `9A/H-01`: the core-file limit (`HOST-35`), the command line and environment searched for the switches of `HOST-36` (it prints counts, never the environment), `NoNewPrivs` (`HOST-38`), the four capability lines (`HOST-39`), the supplementary groups (`HOST-40`), the umask (`HOST-42`). The `/proc` reads that need `sudo` are run by `USER` and handed to the collector.
- `9A/H-16.4` `OPER`, web console on the host: sign in; open the device selector; open the pre-check of a new session.
- `9A/H-16.5` `OPER`, web console: attempt to start a session.
- `9A/H-16.6` `SCRIPT` `collect-h16.sh --after-refusal`: `npm run db:status -- --database dems_demo`; the row count of the session table; the number of entries under `<data-dir>/media/sessions`.
- `9A/H-16.7` `OPER`, web console sign-in page: for each seeded operator, attempt one sign-in with the published demonstration password.
- `9A/H-16.8` `USER`, terminal (`HOST-41`): `sudo systemctl stop dems-loopback-rule.service`; `systemctl is-active dems-core.service`; then start both again.
- `9A/H-16.9` `USER`, terminal (requirement BR-12 in the production operation): stop the Core; `sudo nft delete table inet dems_loopback`; `sudo systemctl start dems-core.service`; read the end of the journal.
- `9A/H-16.10` `USER`, terminal: `sudo systemctl restart dems-loopback-rule.service`; `sudo systemctl start dems-core.service`; read the journal.

**4. Expected result.**
- `.2` the journal holds `capture fence passed` with the operation `REAL_PRODUCTION`, and the two lines with the codes `CAPTURE_HOST_CHECKS_PASSED` and `CAPTURE_PROGRAM_CHECKS_PASSED`. A refused start is a result to record with its code and reason word, not to work around. The codes a first boot can meet, grouped by what they concern (within the host checks and within the program checks the order is the one asked, and the first that is missing is the one named):
  - `DEV_SOURCE_WITHOUT_FLAG`: a slot still holds a generated source (`PREP-09` step 2 is not complete).
  - `CAPTURE_WORKER_NOT_CONFIGURED`, `CAPTURE_WORKER_PROGRAM_UNUSABLE`, `CAPTURE_EVIDENCE_STORE_UNUSABLE`: the environment file or the media directory (`HOST-34`).
  - `CAPTURE_SIGNING_KEY_UNUSABLE`, `CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION`: X-1 (`PREP-10`).
  - `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION`: X-2 is not complete (`PREP-09` step 5).
  - The 13 host checks, the first that is missing: `CAPTURE_HOST_CORE_FILE_LIMIT` (`HOST-35`), `CAPTURE_HOST_DIAGNOSTIC_SWITCH` (`HOST-36`), `CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE` and `CAPTURE_HOST_GUARD_PROGRAM_UNUSABLE` (`HOST-05`, `HOST-15`; the two keys of step `.1`), `CAPTURE_HOST_LOOPBACK_RULE_MISSING` (`HOST-25`, `HOST-41`), `CAPTURE_HOST_CAN_GAIN_PRIVILEGES` (`HOST-38`), `CAPTURE_HOST_CRASH_COLLECTOR` (`HOST-37`), `CAPTURE_HOST_FORWARDING_ON` (`HOST-20`), `CAPTURE_HOST_ARPING_VARIANT` (`HOST-18`), `CAPTURE_HOST_AUDIO_GROUP` (`HOST-26`, `HOST-40`), `CAPTURE_HOST_CLOCK_NOT_SYNCHRONISED` (`HOST-31`; open point 5 of chapter 1), `CAPTURE_HOST_MAY_SLEEP` (`HOST-29`), `CAPTURE_HOST_ALIAS_SOCKET` (`HOST-44`; chapter 4, `HI-04` part B).
  - The 4 program checks: `CAPTURE_HOST_RELAY_LIBRARY_UNVERIFIED` (the relay does not state the pinned media library), `CAPTURE_HOST_ALIAS_HELPER_UNSAFE` (`HOST-45`; `HI-02`), `CAPTURE_HOST_ALIAS_GRANT_UNSAFE` (`HOST-44`; `HI-04`), `CAPTURE_HOST_INTERFACE_FILE_MISMATCH` (`HOST-46`; asked only once a camera interface is stored, so not at this first boot).
  - A check that cannot read its answer refuses too, with the reason `HOST_COMMAND_NOT_STARTED`, `HOST_COMMAND_TIMED_OUT` or `HOST_ANSWER_NOT_UNDERSTOOD`.
  - `CAPTURE_WORKER_NO_HANDSHAKE` and the worker's version codes: the worker built in `9A/H-01` is not the one this tree expects.
  - The service manager's own failure `status=216/GROUP`: the group of `SupplementaryGroups` does not exist, `HI-04` part A was not done.
  If the journal holds neither of the two "checks passed" lines although the Core started, the tree is one in which the Core's entry point does not yet hand the host facts to the boot (blueprint row 85; open point 6 of chapter 1). That is recorded as "host checks not asked", and criterion 6 and step `.9` are then readings of the service manager only.
- `.3` operation `REAL_PRODUCTION`; every listener on `127.0.0.1`; core-file limit 0 in both columns; switches found 0; `NoNewPrivs: 1`; four capability lines ending in sixteen zeros; the groups are exactly those of `audio` and `dems-netalias`; umask `0077`.
- `.4` the selector shows 4 slots "not assigned". The pre-check shows 4 blocking items, one per unassigned slot.
- `.5` the start is refused: the console shows a refusal that names the unassigned sources (the operation answers 409; the reason word is `CAPTURE_SOURCE_NOT_ASSIGNED`, and each blocking pre-check item carries the value `NOT_ASSIGNED`). No session appears in the session list.
- `.6` exit code 0; the session row count equals the count of `PREP-09` step 4; 0 entries under the media store.
- `.7` every attempt is refused.
- `.8` after the stop of the rule's unit, `is-active` for the Core prints `inactive` or `failed`.
- `.9` one of two outcomes, recorded as seen. (i) The start is refused with `CAPTURE_HOST_LOOPBACK_RULE_MISSING`. (ii) The Core starts. **As built, (ii) is expected**: the host check asks whether the rule's unit is active (reason word `RULE_UNIT_NOT_ACTIVE` when it is not), and here the unit is active while its table is gone. A stopped unit is covered by step `.8`, through the service manager.
- `.10` `capture fence passed` with `REAL_PRODUCTION`; no prerequisite is named.

**5. Pass criterion.** All of:
1. the boot log prints the operation `REAL_PRODUCTION` in run k (k is recorded; a refused run before it stays in the record);
2. listeners of the Core with a local address other than `127.0.0.1`: 0; the six process readings as stated: 6 of 6;
3. slots "not assigned": 4 of 4; blocking pre-check items: 4;
4. session start refused: 1 of 1; new session rows: 0; new entries in the media store: 0;
5. sign-ins with the demonstration password refused: n of n seeded operators;
6. missing loopback rule named by the production boot: 1 of 1 (outcome (i) of step `.9`); after restoring, named 0. With outcome (ii) this criterion is **not met**, and the line is a `FAIL` with the reason "the Core does not see a deleted rule table: open point 12 of chapter 1"; it is not waved through and not repeated.

If not met:
- criterion 1: sort by the code. X-1, X-2 or `PREP-09`: installation (the user's actions). A `CAPTURE_HOST_*` code or `status=216/GROUP`: installation, the item of the host profile or the step of chapter 4 named beside the code above; correct it and repeat as the next run. A `CAPTURE_HOST_*` code on a host whose item is met as the profile states: product, the host checks (rows 80, 81). Any other code: product.
- criterion 2: installation if the unit or the environment file differs from the profile; product if the Core opens a listener the profile does not state.
- criterion 3 or 4: product. Reopens the unassigned-selector rows (28 to 36, 161 to 172; decisions C18, C21, C25: all four slots must be assigned to start). A session that starts here is the gravest outcome: it would record from nothing, or from a source that is not a production source.
- criterion 5: product, the boot check of the demonstration password.
- criterion 6: product, and known before the run: it reopens row 80 (requirement BR-12), or the criterion is re-issued by the development to read the unit's state. Until one of the two is done the line stays `FAIL`.
Every check after sequence 10 of chapter 1 waits for this one.

**6. What to record.** The start-command form (words only); the run number in which it started; codes of refused runs; the six process readings; the two counts of `.4`; "refused, 0 rows, 0 entries"; n of n; the outcome of `.9`; the collector's file names. Not recorded: any value of the environment file, an operator's name, the key's location beyond "data directory".

### 9A/H-05  The address helper as installed

Capture operation: none, then `REAL_PRODUCTION`   Database: acceptance
Recording: none   User actions: UA-1, UA-3

**1. What it proves.** The helper that the user installed in chapter 4 is the delivered file, owned by root and not writable by the service user; it is reachable only by the service user through its socket; it refuses requests outside its bounds on the real interface, and writes one journal line per call; and the Core's own start check of it passes.
On doubles: 58 tests of the helper with its two system tools replaced by a recording stand-in, on macOS, with macOS numbers for the peer-credential option. Not shown: the delivered file executed with its real constants; the Linux peer credential; the two unit files under the service manager; owner checks against a real foreign owner.

**2. Precondition.** Chapter 4, steps `HI-01` to `HI-07`, passed (UA-3), with the three lines that need a default route repeated after `PREP-11`. `HI-08` is not a precondition: it is steps `.6` and `.7` below, performed once, here. `HI-09.1` and `HI-10` follow this check. `9A/H-16` passed. The helper's delivery fixes these names: helper `/usr/local/sbin/dems-core-netalias`; units `dems-core-netalias.socket` and `dems-core-netalias@.service`; socket `/run/dems-core-netalias/socket`; group `dems-netalias`; interface file `/etc/dems/netalias-interface`. No temporary address is in place: `ip -br -4 addr show dev <camera-interface>` prints one address.

**3. Steps.**
- `9A/H-05.1` `SCRIPT` `collect-h05.sh --installed` (the `sudo` reads by `USER`): the checks of `HOST-43` to `HOST-47`: the group's member list; `systemctl is-active dems-core-netalias.socket`; `stat -c '%U %G %a'` on the socket, the two unit files, the helper and the interface file; `namei -l` on the helper; `sha256sum` on the helper and the two unit files; the line count of the interface file; `ip -4 route show default`; the sudoers search.
- `9A/H-05.2` `USER`, terminal: `sudo runuser -u <service-user> -- test -w /usr/local/sbin/dems-core-netalias; echo $?` and the same for the interface file.
- `9A/H-05.3` `USER`, terminal: send five requests to the socket, one per connection, and read the one answer line of each. The client is the one of chapter 4, section 1: the shell variable `ASK` is set as written there, then `sudo runuser -u <service-user> -- /usr/bin/python3 -I -c "$ASK" '<request>'`. (`nc -N -U` is the same request where `netcat-openbsd` is installed; the helper does not need the sending side closed.)
  - (a) `add 203.0.113.10/24 30`, an address that is not private;
  - (b) `add <alias-address>/16 30`, a prefix other than `/24`;
  - (c) `add <alias-address>/24 30 <camera-interface>`, an interface named by the caller;
  - (d) `del <alias-address>/24`, an address the helper did not add;
  - (e) request (b) again, sent as root instead of the service user (`sudo /usr/bin/python3 -I -c "$ASK" '<request>'`).
- `9A/H-05.4` `USER`, terminal: from the administrator account without `sudo`, `/usr/bin/python3 -I -c "$ASK" 'del <alias-address>/24'`.
- `9A/H-05.5` `SCRIPT` `collect-h05.sh --journal` (`sudo journalctl` by `USER`): the lines of the helper since step `.3` began, each reduced to its fields `verb`, `result`, `code`; the count; then `ip -br -4 addr show dev <camera-interface>`.
- `9A/H-05.6` `TECH`, web console, commissioning settings: choose the camera port as the camera interface and the camera subnet. Then open the commissioning screen. (This is `HI-08`'s precondition. To confirm when the commissioning rows of milestone M10 land, blueprint rows 100 to 117: the setting and its screen are not in the tree at Revision 2; the stored row and its audit type are.)
- `9A/H-05.7` `USER`, terminal: `sudo systemctl restart dems-core.service`; read the journal; `SCRIPT` `collect-h05.sh --core`: boot lines that name the helper, its grant or the interface file; the supplementary groups of the Core's process.
- `9A/H-05.8` `USER`, terminal, the mismatch produced on the file side, so that the Core can be started again without its console. Stop the Core. `test -e /sys/class/net/nosuchport0; echo $?`, then `printf '%s\n' 'nosuchport0' | sudo tee /etc/dems/netalias-interface` (as `HI-06` (c1)). `sudo systemctl start dems-core.service`; read the end of the journal. Then restore the file with `HI-03.4` and read it with `HI-03.5`; run the self-check of `HI-05.4`; `sudo systemctl start dems-core.service`; read the journal. No request is sent to the helper while the file is wrong. **Do not produce the mismatch by choosing another port in the console**: the Core would refuse its next start and the console, the only place to choose again, would be gone.

**4. Expected result.**
- `.1` one group line whose member list is exactly `<service-user>`; `active`; socket `root dems-netalias 660`; unit files `root root 644`; helper `root root 755`, no symbolic link, every parent directory root-owned; the three hashes equal those chapter 4 prints (the helper's begins `62c0b726` at the time of writing; any later change of the delivered file changes it, and chapter 4 governs); interface file one line, `root 644`; the default route names another interface; the sudoers search prints `0` after every file name.
- `.2` `1` twice: not writable by the service user.
- `.3` answers: (a) `25 ADDRESS_NOT_PRIVATE`; (b) `21 PREFIX_NOT_24`; (c) `14 REQUEST_MALFORMED`; (d) `45 NOT_MARKED`; (e) `12 PEER_NOT_SERVICE_USER`: the helper refuses root as well.
- `.4` the connection itself is refused with a permission error; no answer line.
- `.5` exactly 5 lines, one per request of step `.3`, each with the result of that request; none for step `.4`; the interface holds exactly one address.
- `.6` the audit list shows 1 entry `CAPTURE_NETWORK_CONFIG_CHANGED`; the commissioning screen no longer says "not configured".
- `.7` `capture fence passed`, and a line with the code `CAPTURE_PROGRAM_CHECKS_PASSED`; no line holds `CAPTURE_HOST_ALIAS_SOCKET`, `CAPTURE_HOST_ALIAS_HELPER_UNSAFE`, `CAPTURE_HOST_ALIAS_GRANT_UNSAFE` or `CAPTURE_HOST_INTERFACE_FILE_MISMATCH`; the groups are exactly those of `audio` and `dems-netalias`. From this start on the interface file is compared with the stored camera interface at every production start.
- `.8` `1` (no such port), then the name printed once. The start is refused: the journal ends with `"the server stopped: boot"` and names `CAPTURE_HOST_INTERFACE_FILE_MISMATCH` with the reason `INTERFACE_FILE_DIFFERS_FROM_ROW`. After the restore: the outputs of `HI-03.5` as stated there, the self-check `0 OK`, and `capture fence passed`. The mismatch is named at the start of the Core; whether a commissioning call of a running Core names it as well is to confirm when blueprint row 105 lands (the Core's caller of the helper).

**5. Pass criterion.** All of:
1. installed state as stated: 6 of 6 objects (group, socket, two unit files, helper, interface file), the three hashes equal, sudoers lines 0;
2. writable by the service user: 0 of 2 files;
3. refusals: 5 of 5, and the socket refuses the foreign account 1 of 1;
4. journal lines: 5 for 5 calls; addresses on the camera port changed by these calls: 0;
5. the Core's start names no fault of the helper: 0 lines; the mismatch of step `.8` is named with its code: 1 of 1; after the restore the Core starts: 1 of 1.

If not met:
- criterion 1 or 2: an installation fault if a step of chapter 4 was not done as written; repeat chapter 4 from that step. A hash that differs from chapter 4's is never accepted: the file is not the reviewed one.
- criterion 3 or 4: product. Reopens the helper (row 104; requirement S13-08, its nine bounds) and decision C19 with the privilege form of row 103. Every change of the helper changes its hash: chapter 4 and the hash list move with it, and the user installs again. **Until this check and `9A/H-06` have passed, the temporary-address function is not used on an installation.**
- criterion 5: product. Reopens the boot checks of the delivered programs (row 81) and the helper's caller (row 105).

**6. What to record.** The six state lines as `met` or `not met`; "hashes equal: yes"; the five answer lines; the journal count; the address count; the result of `.7` and `.8` with the code and reason of `.8`. The same result is copied into `HI-08` and `HI-10` of chapter 4. Not recorded: `<alias-address>`, the interface's name, any account name.

### 9A/H-25  The conflict check refuses an address that another device holds

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: none   User actions: UA-2, UA-3, UA-5

**1. What it proves.** The tool the helper uses for its conflict check is the one it was written for, at the path it calls, and with it the helper refuses to add an address that a device on the camera switch already answers for. Ubuntu carries two packages with a program of this name, and they give the option the helper uses different meanings.
On doubles: the stand-in for the tool reported "in use" and "free" as scripted. Not shown: the real tool, its path, its exit codes.

**2. Precondition.** `9A/H-05` passed. One device is on the camera switch at a known private address in a `/24` that no port of the host holds: the factory-new camera at `<factory-address>` serves. No temporary address is in place and no commissioning job runs.

**3. Steps.**
- `9A/H-25.1` `SCRIPT` `collect-h25.sh --tool`: `command -v arping`; `dpkg -S` on that path; `dpkg -s arping`; `stat -c '%U %a'` on `/usr/bin/arping` and `/usr/sbin/ip`.
- `9A/H-25.2` `USER`, terminal, as in `9A/H-05.3`: the request `add <factory-address>/24 5`.
- `9A/H-25.3` `SCRIPT` `collect-h25.sh --state`: `ip -br -4 addr show dev <camera-interface>`.
- `9A/H-25.4` `USER`, terminal: the control. The request `add <free-address>/24 5`, where `<free-address>` is in the same `/24` and no device holds it; then step `.3`'s reading; then the request `del <free-address>/24`; then the reading again.
- `9A/H-25.5` `USER`, terminal: the limit of one temporary address (the helper's refusal 41). Send `add <free-address>/24 5` and read the state as in step `.3`; then, with that address in place, send `add <alias-address>/24 5`, where `<alias-address>` is the address of chapter 2's placeholder table, in another `/24` that no port holds; read the state; then `del <free-address>/24` and read the state.
- `9A/H-25.6` `USER`, terminal: the conflict tool missing (the helper's refusal 37). No Core is started between the first and the last command of this step, and no session is open. `sudo mv /usr/bin/arping /usr/bin/arping.held`. Then the self-check of chapter 4, `HI-05.4`; then, as the service user, the request `del <alias-address>/24`. Then restore: `sudo mv /usr/bin/arping.held /usr/bin/arping`; `stat -c '%U %a' /usr/bin/arping`; `dpkg -S /usr/bin/arping`; the self-check again; step `.3`'s reading.

**4. Expected result.**
- `.1` `/usr/bin/arping`; `iputils-arping: /usr/bin/arping`; `is not installed` for the package named `arping`; both tools owned by root, not writable by group or others.
- `.2` the answer `44 ADDRESS_IN_USE`.
- `.3` one address on the camera port.
- `.4` `0 OK`; two addresses, the second with a lifetime of at most 300 s; `0 OK`; one address.
- `.5` `0 OK` and two addresses; then `41 ALIAS_LIMIT_REACHED` and still two addresses; then `0 OK` and one address.
- `.6` the self-check prints `37 CONFLICT_TOOL_MISSING` and `exit 37`; the request is answered `37 CONFLICT_TOOL_MISSING`. After the restore: `root 755`; `iputils-arping: /usr/bin/arping`; `0 OK` and `exit 0`; one address. While the tool is away a production Core would refuse to start (`CAPTURE_HOST_ARPING_VARIANT`); that is why none is started in this step.

**5. Pass criterion.** The tool is the iputils one at the stated path: 1 of 1. An address in use refused: 1 of 1, address not added. The free control added and removed: 1 of 1 each. A second address refused with code 41 while one is in place: 1 of 1, addresses unchanged. With the tool moved away, refused with code 37: 2 of 2 (self-check and request); the tool restored and the self-check `0 OK`: 1 of 1.
If not met: a wrong or missing package is an installation fault (`HOST-18`). A refusal that does not come, or a free address refused, is product: it reopens the helper's conflict bound (row 104, bound 4; hypothesis HA-13) and the host check of the tool's variant (row 80). `9A/H-06`, `9A/H-13`, `9A/H-14` and `9A/H-15` wait.

**6. What to record.** The three tool lines; the answer of `.2`; the address counts 1, 2, 1; the answers and counts of `.5`; the two answers of `.6` and "tool restored: yes". Not recorded: any address. If step `.6` is stopped half-way, the tool is restored first; a host without `/usr/bin/arping` fails `9A/H-16` at its next start.

### 9A/H-06  A temporary address is added, refused on conflict, and removed after its lifetime with the Core killed

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: none   User actions: UA-1, UA-3, UA-5

**1. What it proves.** Through the Core, a technician adds a temporary address on the camera port and removes it; a conflict is refused; and an address whose Core died is removed by the kernel when its lifetime ends (the design's hypothesis H-S, experiment E-13). Each action is in the Core's audit chain, and after a restart no temporary-address row stays open. It also shows that the helper answers from inside the Core's unit, which has no right to gain privileges and no capability.
On doubles: the Core against a helper stand-in: an entry of intent and one of result around each call, removal at the end of a job, at shutdown and at start. Not shown: the kernel's lifetime, the real helper called from the real unit.

**2. Precondition.** `9A/H-05` and `9A/H-25` passed; the camera interface is chosen in the console; no session is open; the room network is joined (`PREP-11`). The console steps of this check use the Core's own caller of the helper, its screen and its audit entries. They are not in the tree at Revision 2 (to confirm when blueprint rows 105 to 107 land); the audit types, the reason words and the stored table are. Until they land, this check is "not run: the temporary-address function of the Core is not built", and the kernel's expiry alone can be read with the helper's own requests as in `9A/H-25.4`, which is not this check. The lifetime setting of a temporary address is 5 to 480 minutes; this check uses 30 and then 5.

**3. Steps.**
- `9A/H-06.1` `TECH`, web console, commissioning screen: add a temporary address for the `/24` of `<factory-address>`, lifetime 30 minutes.
- `9A/H-06.2` `SCRIPT` `collect-h06.sh --state`: `ip -4 addr show dev <camera-interface>` reduced to the count of addresses and the `valid_lft` figure of each; the count of files under `/run/dems-core-netalias/marks`; `grep NoNewPrivs` for the Core's process (by `USER`).
- `9A/H-06.3` `TECH`, web console: remove the temporary address. Then step `.2`'s reading.
- `9A/H-06.4` `BENCH`: give a second device on the camera switch the address the Core used in step `.1` (a laptop set to it by hand). `TECH`, web console: add the temporary address again. Then step `.2`'s reading. `BENCH`: take the device off the switch.
- `9A/H-06.5` `TECH`, web console: set the lifetime to 5 minutes and add the temporary address; note the host clock. Step `.2`'s reading.
- `9A/H-06.6` `USER`, terminal: `sudo systemctl kill -s KILL dems-core.service`; `systemctl is-active dems-core.service`. Do not start the Core.
- `9A/H-06.7` `SCRIPT` `collect-h06.sh --state`, 330 s after the add of step `.5` (the lifetime of 300 s plus 30 s; the 30 s are this chapter's margin, open point C).
- `9A/H-06.8` `USER`, terminal: `sudo systemctl start dems-core.service`; read the journal. `TECH`, web console: open the commissioning screen and the audit list.
- `9A/H-06.9` `SCRIPT` `collect-h06.sh --audit` with the note file of chapter 1, section 9.5 (the audit list outside a session is read by `OPER`; the product exports no file): from the audit list, the count of entries of the types `HOST_ALIAS_ADDED`, `HOST_ALIAS_REMOVED` and `HOST_ALIAS_REMOVE_FAILED` since step `.1`, in order, each with its reason code; no address is printed.

**4. Expected result.**
- `.1` the screen shows the temporary address as in place with its end time.
- `.2` 2 addresses; the second with `valid_lft` at most 1800; 1 mark file; `NoNewPrivs: 1`.
- `.3` the screen shows none; 1 address; 0 mark files.
- `.4` the add is refused and the screen states that the address is in use; 1 address; 0 mark files.
- `.5` 2 addresses, the second with `valid_lft` at most 300.
- `.6` `inactive` or `failed`; no Core process.
- `.7` 1 address: the temporary one is gone with no Core running.
- `.8` the Core starts; the commissioning screen shows no temporary address in place. The row of step `.5` is closed with a reason from the closed set, which is `EXPIRED`, `MANUAL`, `JOB_DONE`, `BOOT_SWEEP`; here `EXPIRED` or `BOOT_SWEEP` is expected, and which of the two is recorded.
- `.9` entries in this order: added (step `.1`), removed (step `.3`), the conflict of step `.4` as the development's record of the helper's caller states it, added (step `.5`), removed at the start of step `.8`. `HOST_ALIAS_REMOVE_FAILED`: 0. The number of entries per action is the one the development's closing report states for the caller (the design asks an entry of intent before the call and an entry of result after it); it is the same for every action of the same kind.

**5. Pass criterion.** All of:
1. added: 2 of 2 (steps `.1`, `.5`), each with a `valid_lft` not above its lifetime in seconds;
2. removed on request: 1 of 1;
3. conflict refused: 1 of 1, address not added;
4. with the Core killed, the address is absent at 330 s: 1 of 1 (hypothesis H-S holds);
5. after the restart, temporary-address rows still open: 0; entries `HOST_ALIAS_REMOVE_FAILED`: 0; actions without an audit entry: 0.

If not met:
- criterion 4: product, and a ruled consequence. Hypothesis H-S is false on this kernel: the removal must then be scheduled by root at the moment of adding (a timer of the service manager, requirement S13-10 (a)), which the delivered helper does not have. Reopens row 104 ("not built" item 1) and row 106; the helper's hash changes and chapter 4 is repeated. `USER` removes the address by hand with the removal step of chapter 4. **The function is not used on the installation**, and `9A/H-13` to `9A/H-15` are `NOT RUN`.
- criterion 1 with the helper refusing from inside the unit: product, the privilege form (decision C19, row 103, item `HOST-38`).
- criterion 3: product, row 104 bound 4 and the caller of row 105.
- criterion 5: product, the lifecycle of row 106 and the audit entries of row 105.

**6. What to record.** The address counts of every reading; the two `valid_lft` figures; the time of the add and of the reading of `.7`; the closing reason of `.8`; the entry counts per type. Not recorded: any address, the interface's name.

### 9A/H-07  The real card listing; the same identity after a re-plug

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: none   User actions: UA-2, UA-5

**1. What it proves.** The Core lists the USB audio interface with its native channel count, registers a microphone input only when a person asks for it, refuses an input the card does not have, and recognises the same card after it was unplugged and plugged again. It belongs to the card listing and the microphone registration.
On doubles: fixed card listings behind an injected enumerator; ALSA does not exist on the development machine. On the bench of the earlier system an interface was swapped and its inputs moved to another card without confirmation; an interface with eight inputs was never tested.

**2. Precondition.** `9A/H-16` passed. The audio interface offers 48,000 Hz: a card that does not is refused when it is opened (`AUDIO_CARD_RATE_UNSUPPORTED`) and cannot be used by this product version. It is the only interface of its model on the host: two connected cards with one USB id are refused as ambiguous (`AUDIO_CARD_AMBIGUOUS`), so a room with two identical interfaces cannot record. The audio interface is connected to a USB port that `BENCH` marks; two microphones are connected to its inputs 1 and 2. The signed-in person holds the capture-configuration permission (a supervisor or a technician). No session is open.

**3. Steps.**
- `9A/H-07.1` `SCRIPT` `collect-h07.sh --host` (the `runuser` line by `USER`): `lsusb` reduced to the vendor and product id of the audio interface; `cat /proc/asound/cards`; the capture channel count from `/proc/asound/card<N>/stream0`; `sudo runuser -u <service-user> -- arecord -l`; `id -nG <service-user>`.
- `9A/H-07.2` `TECH`, web console, sound cards: search for sound cards. Read the listing.
- `9A/H-07.3` `TECH`, web console: register input 1; register input 2; register input 1 once more.
- `9A/H-07.4` `TECH`, web console: attempt to register the input whose number is the card's channel count plus 1.
- `9A/H-07.5` `BENCH`: unplug the interface. `TECH`: search again; open the device list.
- `9A/H-07.6` `BENCH`: plug the interface into the same port. `TECH`: search again; read the listing and the device list.
- `9A/H-07.7` `SCRIPT` `collect-h07.sh --audit` with the note file of chapter 1, section 9.5: the count of audit entries of the types `CAPTURE_DISCOVERY_SEARCHED` (scope `AUDIO_CARDS`) and `CAPTURE_AUDIO_INPUT_CHANGED` since step `.2`, each with its change code.
- `9A/H-07.8` Observation, only if a second USB port is free: `BENCH` plugs the interface into the other port; `TECH` searches. Then `BENCH` returns it to the marked port and `TECH` searches again.

**4. Expected result.**
- `.1` the interface is listed with the driver `USB-Audio`; `arecord -l` as the service user lists it as a card; the service user's groups hold `audio`.
- `.2` one card with its product name, its USB id and its native capture channel count, equal to the figure of step `.1`; no input is marked as registered.
- `.3` two microphone devices exist after the first two actions and still two after the third: the third re-enables, it does not duplicate.
- `.4` the registration is refused and the refusal names the input as beyond the card (code `AUDIO_INPUT_BEYOND_CARD`).
- `.5` the search lists no card; the two microphone devices are shown as not present. Nothing is re-assigned.
- `.6` the listing equals that of step `.2` in card id, USB id and channel count; the two registered inputs are matched to it.
- `.7` searches: 4 entries (5 or 6 with step `.8`); `CAPTURE_AUDIO_INPUT_CHANGED`: 2 entries with the code `REGISTERED`, and for the third registration either 0 entries or 1 with `REENABLED` (recorded as seen); entries with the code `CARD_CHANGED` after step `.6`: 0.
- `.8` **As built, the inputs ARE matched without a word on the other port**: 0 entries with the code `CARD_CHANGED`, the two inputs shown as present. The card is recognised by its USB id; the serial number and the port are stored with a registration but are not yet compared (blueprint rows 199 and 200). The designed outcome, a change reported with `CARD_CHANGED` and 1 audit entry, is expected only on a tree that holds those two rows. Back on the marked port the listing equals step `.2` again. Record which of the two was seen.

**5. Pass criterion.** All of:
1. the channel count the Core lists equals the count of `/proc/asound` and the count the interface's own documentation states: 3 equal figures;
2. inputs registered without a person's action: 0;
3. devices after three registrations of two inputs: 2;
4. an input beyond the card refused by name: 1 of 1;
5. identity after the re-plug on the same port: card id, USB id and channel count equal, 3 of 3; `CARD_CHANGED` entries: 0.

If the interface lists more capture channels than it has microphone sockets (loopback channels, as on the bench interface of the earlier system), write down which input numbers are sockets. The product does not know the difference; registering a loopback channel is not refused.
If not met: criterion 1 with the interface missing from `/proc/asound/cards` is installation (`HOST-26`, `HOST-27`; an interface that needs a vendor driver is not supported). Otherwise product: the card listing (row 64), the registration (rows 63, 70), the match of a stored input to a live card (row 156). A silent match to another card is the bench's finding repeated and blocks `9A/H-08` and `9A/H-17`.
**Known limit until rows 199 and 200 land, stated here because this is where a technician meets it.** One interface swapped for another unit of the same model, or the same unit moved to another port, is matched without a word, and the two registered inputs then belong to whatever card carries that USB id. On an installation, a card is not swapped or moved without a new search and a look at the listing; the observation of step `.8` records the behaviour of the tree under acceptance. Inside a session the adapter is stricter: a card whose card index, device index, channel count, rate or format changed between the open and the start is refused (`AUDIO_CARD_MOVED`).

**6. What to record.** The interface's model name (into the header); the three channel figures; the counts of criterion 2 to 5; the observation of step `.8`; which input numbers are sockets. Not recorded: the card's serial number.

### 9A/H-08  Shared capture opens on both inputs; rate; audible level on both

Capture operation: `REAL_PRODUCTION`   Database: acceptance
Recording: none before S1; the opens, the rate and the first second are read from S1   User actions: UA-2, UA-5

**1. What it proves.** The capture scheme taken over from the earlier system, on the real interface: the card is opened once through ALSA shared capture with all its native channels, each registered input is picked out of them, two readers hold the card at the same time, the sample rate is the one asked for, and a voice at the microphone arrives as a level well above silence on that input and on no other. It belongs to the shared-capture configuration, the helper's argument table and the microphone adapter.
On doubles: the arguments equal the earlier system's as text; a generated multi-channel source in place of the device; in a container an ALSA null device. None of them is a sound card. **On the bench of the earlier system this scheme's recordings were practically silent (peak near -101 dBFS, cause not found), and the first recording after a re-plug began with one full-scale sample.** A silent input is a `FAIL` here, not a note.

**2. Precondition.** `9A/H-07` passed; two microphones on inputs 1 and 2; gain and phantom power set at the interface by `BENCH` as the microphones need (the Core sets no gain). Bound B-7, the level threshold, is set by the user before the run in chapter 1, section 5 (`PREP-02`). The proposal: while a person speaks at 30 cm, the input's peak is at or above -40 dBFS and at least 20 dB above the same input's peak during 5 s of room silence. Without a value set, criterion 3 is "not run: bound not set" and the check is `NOT RUN`.
Whether level and opening can be read without a session is open (open point 8 of chapter 1). Steps `.1` to `.5` use the console's level meter of a registered input and are done now; steps `.6` to `.8` are read from S1 and give the check its result after `9A/H-17` has started.

**3. Steps.**
- `9A/H-08.1` `USER`, terminal: `sudo fuser -v /dev/snd/pcmC*D*c` with no session running (`HOST-28`).
- `9A/H-08.2` `USER`, terminal: copy the shared-capture configuration out of the Core's run directory with `sudo cp` into `<evidence-folder>` (the run directory is owner-only), then `SCRIPT` `collect-h08.sh --config --alsa-config <copy>`: the shared-capture configuration the Core generated under its run directory, reduced to: the number of `dsnoop` blocks, and per block the channel count, the rate, the sample format, the period and buffer sizes.
- `9A/H-08.3` `TECH`, web console, device screen of microphone 1 and of microphone 2, both meters open at the same time. `BENCH`: 5 s of silence in the room. Read both peaks.
- `9A/H-08.4` `BENCH`: unplug the cable of microphone 2 at the interface; speak into microphone 1 at 30 cm for 5 s. `TECH`: read both peaks.
- `9A/H-08.5` `BENCH`: plug microphone 2 in, unplug microphone 1; speak into microphone 2 for 5 s. `TECH`: read both peaks. `BENCH`: plug microphone 1 in again.
- `9A/H-08.6` `SCRIPT` `collect-h08.sh --session S1`, during S1: the two microphone helper processes with their argument lists reduced to the format, the channel count, the rate and the channel selection; from the Core's and the worker's log of S1, any line that reports a failed or busy audio open, and the rate the worker states for the microphone.
- `9A/H-08.7` `SCRIPT` `collect-h08.sh --first-second S1 --track <file>`, after S1 is sealed, with a camera file of the export of S1 (chapter 1, section 9.5): from the audio of S1, read-only, the peak of the first 1,000 ms and the peak of the following 4,000 ms, in dBFS. Chapter 3 keeps the room silent for the first 10 s of S1 for this reading. It prints two numbers and no sound.
- `9A/H-08.8` `OPER`, web console, playback of S1 on the host: listen to the first clap and to ten seconds of speech.

**4. Expected result.**
- `.1` no process holds a capture device.
- `.2` one `dsnoop` block for the card: channels equal to the native count of `9A/H-07`; rate 48000; the first format of `S32_LE`, `S24_3LE`, `S24_LE`, `S16_LE` that the card lists; period 1024, buffer 8192.
- `.3` both meters run at once, with no error that the device is busy; both peaks are low and are written down as the silence figures.
- `.4` input 1 meets B-7; input 2 stays at its silence figure, within 6 dB.
- `.5` input 2 meets B-7; input 1 stays at its silence figure, within 6 dB.
- `.6` two helper processes, both alive, each opened with the card's native channel count, format `alsa`, rate 48000 and a selection of one channel; failed or busy opens: 0; the stated rate is 48,000 Hz.
- `.7` two figures. A first-second peak more than 20 dB above the peak of the next four seconds, in a silent room, is the full-scale sample of the bench: it is a finding to record, it does not fail this check. This is the development's named open point OP-1 (the first samples after a card is opened). Three things are written down for it: (a) whether it occurs on this interface; (b) whether S1 was the first opening after the interface was plugged in, or a later one; (c) whether the pre-check of the session, which opens the card shortly and writes nothing, ran before S1. If (a) is yes, the remedy is a decision of the development (an open-and-discard before the session, or a trim), not a setting on the host.
- `.8` the clap and the speech are heard.

**5. Pass criterion.** All of:
1. shared capture opens on both inputs at the same time: meters 2 of 2 at step `.3`, helper processes 2 of 2 at step `.6`, busy or failed opens 0;
2. the rate stated for the microphone equals 48,000 Hz, the rate asked for;
3. the level meets B-7 on both inputs: 2 of 2; with the other microphone unplugged, the unplugged input does not rise more than 6 dB above its silence figure: 2 of 2;
4. the first-second reading has a recorded result (two figures);
5. speech in the played-back S1 is heard: 1 of 1.

If not met:
- criterion 3 with a low level on an input: first an installation question, once: gain, phantom power, cable, microphone. If a change at the interface brings the level up, repeat as run 2 and record what was changed. If not, it is the bench's silent recording repeated: product. It reopens the shared-capture configuration (row 65), the argument table (row 66), the adapter (row 67) and its real-code check (row 69), and with them the reading of the user's ruling U2 that this scheme is "the tested one": on the bench it produced files, not sound.
- criterion 3 with a voice on the unplugged input: product, the channel selection (row 66).
- criterion 1: a process holding the card is installation (`HOST-28`, a sound server); otherwise product, row 65.
- criterion 2: product, rows 65 and 66.
- criterion 5 while criterion 3 is met: product on the session side (the microphone start of the session through the adapter of row 67, and the worker's audio path), sorted in `9A/H-17`.
`9A/H-17` is not a pass with a silent audio track, whatever its seal says.
**Known limit until blueprint row 191 lands.** If the capture worker is restarted inside a session (the Core's log holds `CAPTURE_WORKER_DOWN` and the session goes on), the microphone helpers have ended with the first worker and nothing starts them again: the audio of the rest of that session is digital silence, in a file that plays. A session of this package in whose log `CAPTURE_WORKER_DOWN` occurs is therefore read for its audio after the restart, and criterion 5 is judged on the speech after it as well.

**6. What to record.** B-7 as set; the six peak figures of steps `.3` to `.5` in dBFS; the configuration values of `.2`; helper processes and busy opens; the stated rate; the two first-second figures and whether the finding of `.7` applies; "heard" yes or no. Not recorded: any sound, any word that was spoken.

## 3. Where the unproven items of the development are covered by this chapter

Each line of the development's list "what stays unproven at the end of track D" that names a check of this chapter:

| Unproven item | Check, and the step that reads it |
|---|---|
| The worker, the relay and the guard on the real kernel and service manager | `9A/H-01` steps `.6` to `.8`; the unit in `9A/H-16` |
| No child outlives the Core | `9A/H-02` |
| Leftover detection | `9A/H-24` |
| The sync level on the evidence disk | `9A/H-03`; read again from S1 in chapter 3 |
| The path observations of experiment E-11 on the host's build | `9A/H-01` steps `.9` to `.11` |
| Branch B on Linux: the announce line with the same wording, level and instant | `9A/H-01` step `.10`, criterion 4 |
| The real card listing; a stable identity across a re-plug | `9A/H-07` |
| Shared capture opening, rate, the first-second sample, audible levels | `9A/H-08` |
| The helper installed: ownership and mode | `9A/H-05` |
| The bounds on a real interface | `9A/H-05` step `.3` |
| The conflict check with the real tool | `9A/H-25` |
| Expiry of a temporary address with the Core killed | `9A/H-06` steps `.5` to `.7` |
| A production boot with the user's key and operators | `9A/H-16` |
| The acceptance host carries no input-av installation | `9A/H-27` |

The items on real cameras, the scan, the set-address function, sessions, picture and sound in step, and playback are covered by chapter 3.

## 4. Open points of this chapter

Each is open until the named party settles it. Where a step depends on one, the step says so.

| # | Open point | Effect | Settled by |
|---|---|---|---|
| A | Settled in Revision 2: chapter 1, `PREP-03` step 2, gives two ways (the installation window, or an offline package set) and pulls the cable in `PREP-08` step 1 | `9A/H-01` precondition follows it | - |
| B | The pinned library as the profile configures it carries no H.264 or H.265 encoder. Settled for the announce-line probe: it pushes with the built-in encoder `mpeg4` (that this pusher completes the handshake on the host's build is itself unproven). Not settled for the worker's series `make e2e`: it pushes with `libx264` and `libx265` and needs a second, self-built FFmpeg 9.0.2 with those encoders (chapter 1, `PREP-06` step 1); how the series is pointed at that build on the host is not written anywhere | If the series cannot run, steps `.9` and `.11` of `9A/H-01` are "not run: no pusher on the host", and criterion 5 is not met | the user (the encoder build and its licence); the development (open point 11 of chapter 1) |
| C | No design document states the reading instants: 10 s after the kill in `9A/H-02`, 30 s after the lifetime in `9A/H-06` | The instants are this chapter's and are fixed before the run | the user, with the values of chapter 1, section 5 |
| D | Settled from the built code: the host checks and the program checks are asked in `REAL_PRODUCTION` only | `9A/H-04` case 2 shows outcome (ii); the production reading is in `9A/H-16` | - |
| E | Settled in Revision 2: chapter 4, steps `HI-01` to `HI-07`, comes before `9A/H-16` (sequence 8a of chapter 1). The group exists, and so do the socket, the helper file and the unit files that a production start asks for | `9A/H-16` precondition | - |
| F | Settled in Revision 2: the level threshold of `9A/H-08` is bound B-7 of chapter 1, section 5, set by the user in `PREP-02` | Without a value, `9A/H-08` is `NOT RUN` | the user, before the run |
| G | Settled: the collectors and the probe exist under the names this chapter uses; the request form of `9A/H-05.3` is the client of chapter 4, section 1. Open: the collectors have run on the development Mac only | Their first run on the host is the run itself | the dry run of the package, blueprint row 130 |
| H | Confirmed against the code in Revision 2: the refusal of a session start on an unassigned selector, the leftover finding, the two worker codes, the 13 host and 4 program codes, the mismatch of the interface file, the card codes. Not in the tree yet, each named where it is used: the Core's caller of the helper with its screen and audit entries (`9A/H-06`; rows 105 to 107), the commissioning settings (`9A/H-05.6`; rows 100 to 117), the hand-over of the host facts at the entry point (`9A/H-16.2`; row 85) | The criteria count outcomes, not texts | the named rows |
| I | Two collectors of this chapter search the Core's or the worker's log for a code or a field the product does not write under that name (`collect-h08.sh`: `MIC_OPEN_FAILED`, `AUDIO_DEVICE_BUSY`, `MIC_HELPER_EXITED`, `MIC_NOT_CONNECTED`, `MIC_NOT_DELIVERING`, the fields `sample_rate` and `rate`; `collect-h05.sh`: the word `ALIAS_HELPER`; `collect-h04.sh` and `collect-h24.sh` read no code). The product's words are `AUDIO_HELPER_EXITED`, `AUDIO_HELPER_NOT_STARTED`, `AUDIO_SHARED_CAPTURE_REFUSED`, `AUDIO_NO_SAMPLE_WITHIN_BOUND`, `MIC_INPUT_OPEN_FAILED`, `MIC_LEVEL_BELOW_THRESHOLD`, `MIC_SILENT`, `MIC_DISCONNECTED`, and the `CAPTURE_HOST_ALIAS_*` codes | Those lines print "(absent)" or 0 whatever happened; `USER` reads the log for the product's words until the scripts are corrected | the owner of the scripts (the list is in the record of row 181) |
