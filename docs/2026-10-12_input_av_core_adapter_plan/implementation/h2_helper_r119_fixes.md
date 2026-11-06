---
task: 2026-10-12_input_av_core_adapter_plan
row: H2 (decision C94; follow-up of row 104)
agent: coder-execution (agent H2)
date: 2026-10-13
tier: T3
status: complete on doubles; UNPROVEN ON LINUX
closes: cautions R119-01 and R119-02 of verification/119_commissioning_security.md, as built and on doubles; S13-08 bound 4 (as built) - the statement of row 119 section 2 is the security review's to make, on the new hash
---

# Row H2 - the alias helper: R119-01 (a conflict tool that did not ask) and R119-02 (a mark that outlives its address)

**Plain statement.** Two changes in `scripts/host/netalias/dems-core-netalias`, each with tests in its own suite. The helper was not installed, not run with privilege; no `sudo`, no real `ip`, no real `arping`, no network command was started. Every helper run of the suite is a TEST COPY in a temporary folder whose two tools are the suite's recording double. **Nothing here is proven on Linux**, and three TEXT FORMS the helper now reads are my recollection, not a capture (section 5). Each of them fails closed: where a host prints another form, the helper refuses the `add` and adds nothing.

## 1. R119-01 - exit status 0 of `arping -D` is no longer read as "the address is free"

Before: `add` started `arping -D -q ...` and read only the exit status (0 = free). Measured in the Ubuntu 24.04 container (`test/079_linux_container_checks.md:91`): on an interface that cannot ARP the packaged tool prints `Interface "lo" is not ARPable` and ends 0.

Now `add` decides from what the check can know, in this order (all after the four existing refusals 42, 40, 41, 43, which keep their order and words):

| Step | What | Where | Refusal |
|---|---|---|---|
| a | THE PROGRAM IS THE EXPECTED ONE, before anything is started (also for root's `check`) | `_expected_conflict_tool`, called by `installation` | `38 CONFLICT_TOOL_NOT_EXPECTED` |
| b | THE CAMERA PORT CAN BE ASKED: its kernel flag words, read from the SAME `ip -json -4 addr show` the helper already made (no new invocation) | `host_state`, `refuse_unless_askable` | `46 INTERFACE_NOT_ARPABLE` (flag `LOOPBACK` or `NOARP`, or no `BROADCAST`) ; `47 INTERFACE_DOWN` (no `UP` or no `LOWER_UP`: down, or no carrier) ; `48 INTERFACE_STATE_UNKNOWN` (the port is not in the listing - it holds no IPv4 address -, is listed twice, or its flags are not a list of flag words) |
| c | THE TOOL'S PRINTED RESULT, read together with its exit status | `conflict_verdict` | `44 ADDRESS_IN_USE` (unchanged name) ; `51 CONFLICT_CHECK_FAILED` (unchanged: status not 0 or 1, or no answer in time) ; `55 CONFLICT_RESULT_UNKNOWN` (status 0 or 1 without the statement that goes with it) |

**The one program (step a).** `/usr/bin/arping` of the Ubuntu package **`iputils-arping`** - the one HOST-18 installs and the container had (`3:20240117-1ubuntu0.1`). The other package, `arping` (2.24), ships a different program with other options and exit codes. The option set is the iputils one: `arping -D -c 2 -w 3 -I <interface> <address>` (`-q` removed: a quiet tool states no result).

**The check of "is it the expected one", without running an unknown binary as root.** Two root-owned text files of the package manager are read (owner root, no group or other write, folder likewise): `/var/lib/dpkg/info/iputils-arping.list` must hold the line `/usr/bin/arping`, and `/var/lib/dpkg/info/iputils-arping.md5sums` must hold exactly one line `<32 hex>  usr/bin/arping` whose checksum equals the MD5 of the file that is at the path now (read up to 4 MiB). So: a file of the other package, a file replaced or changed after installation, a missing or unsafe record = refusal 38, nothing started. What it is NOT: a defence against root (root owns both sides) or a version pin (a package update moves file and record together). MD5 is the package manager's record format, used with `usedforsecurity=False`.

**The strict reading (step c).** The whole standard output, at most 4096 bytes of ASCII, ended by a line feed. FREE only when status is 0 AND the text is exactly three lines: `ARPING <the address asked> from <a.b.c.d> <the interface>`, `Sent <n> probes (<m> broadcast(s))` with n at least 2 and m at least 1, `Received 0 response(s)`. IN USE only when status is 1 AND the same first line, the same last two forms and a response count of at least 1. Anything else - an empty text, the measured `is not ARPable` line (alone or in front of a "free" text), another address or interface in the first line, fewer probes than asked, a count that contradicts the status, a further line, the other program's text - is `55` and nothing is added.

## 2. R119-02 - a mark never stands for an address that is not the helper's

Before: a mark was a file name; its two numbers were never read; it stayed until the next `add`, a `del` or a reboot, and `del` honoured it for whatever address was there.

Now (`read_mark`, `mark_stands`, `standing_marks`): a mark STANDS only when all hold - it is what `write_mark` writes, for the configured interface; it is not older than its recorded minutes plus 60 s of grace and not from before this boot's clock; and the kernel lists the address on the camera port as `/24` with a remaining lifetime (`valid_life_time`) no longer than the one asked. The review's smallest fix (a mark past its recorded lifetime is no mark) is the second condition; the third closes the path the review's fix leaves open (the address removed by hand and set again by another hand INSIDE the lifetime: that one has no lifetime, or a longer one).

- `add`, and every `del` of a marked address, first DROPS every mark that does not stand, whichever way its address went.
- `del` of a marked address whose mark does not stand: address absent = `0 OK` with `note=already-absent` (as before); address present = `45 NOT_MARKED`, nothing removed (it is somebody else's).
- A mark's clock is now the host's MONOTONIC clock (third field): it starts at boot as `/run` does, and a step of the wall clock cannot age or rejuvenate a mark.
- An address that is there while the listing does not state its lifetime cannot be judged: `50 HOST_STATE_UNREADABLE`, the mark kept, nothing removed, nothing added.

| Removal path | What happens to the mark |
|---|---|
| the helper's own `del` | dropped in the same call (as before) |
| the lifetime bound (the kernel) | dropped by the next `add` or by the `del` the Core's timer sends (`already-absent`) |
| a reboot | `/run` is empty; a `del` answers `NOT_MARKED` (as before). A mark that survived with a clock value from another boot is no mark |
| removed by hand | dropped by the next `add` / `del`; if the address was set again by hand, `del` does not remove it |

**RESIDUAL, stated.** (1) The helper runs only when called: between a removal it did not make and the next `add` or `del`, the FILE is still in the folder. Nothing acts on it - every act judges it first - but a person listing the folder (procedure step 9) may see a mark without an address. (2) An address somebody sets by hand with a finite lifetime no longer than the mark's, inside the mark's own time, is taken for the helper's. (3) `del` of an address that has no mark still returns before reading the host, so it drops no other stale mark (kept: the vector list of that refusal is unchanged). (4) A mark written for another interface (the root-owned interface file was changed while an alias was up) is dropped; that address ends by its kernel lifetime (the residual C74 already accepts).

## 3. Unchanged

The request forms, 5 to 480 minutes, one alias at a time, the interface from its own file, the 36 existing codes and words, the journal line, the two unit files and their hashes, `del` needing no conflict tool. New codes took the next free number of their group. The build step replaces 12 constants (one added: `DPKG_INFO_DIR`).

## 4. Checks run

| Check | Command (repository root) | Result |
|---|---|---|
| Suite, first run | `python3 -I -B scripts/host/netalias/test_dems_core_netalias.py` | `Ran 75 tests in 40.146s` `FAILED (failures=1)`: a "free" text with the `is not ARPable` line in front was accepted - a real defect of my first reading (it looked for the three lines anywhere); the reading now takes the whole text |
| Suite, second run (after the failure) | same | `Ran 75 tests in 51.246s` `OK` |
| Compile | `python3 -m py_compile scripts/host/netalias/dems-core-netalias` (byte-code under the temporary folder) | exit 0 |
| Hashes | `shasum -a 256` of the three delivered files against `SHA256SUMS` | equal, 3 of 3 |
| Leftovers | `ls -a scripts/host/netalias` ; `netalias-*` in the temporary folder | 6 files, no byte-code folder ; 0 |
| Static rules over `scripts/` | `node --test scripts/pg/static.test.mjs` | FAILS, on four entries that name `scripts/hardware-acceptance/test_hw_collectors_camera.sh` and `test_hw_collectors_host.sh` only; no entry names a file of this row. Not investigated further, not mine |

**SHA-256 of the helper: `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1`** (was `62c0b726...2ee5fb`). Unit files unchanged: `8623c1cd...ffdbcb`, `7e40f25e...38dd60a`.

Tests: 58 kept (fixtures extended: flag words, lifetimes, the package records; `-q` out of the expected vector), 17 added - 8 in `Bound4ConflictCheck` (one case per flag state, 12 states; the port not listed or listed twice; the interface file naming `lo`; 21 texts with status 0; 4 with status 1; the accepted forms; 12 damages of the program's record, each also through `check`; the delivered text) and 9 in `Bound6DelOnlyWhatWasMarked`.

## 5. Unproven - to the hardware package

| # | Hypothesis (my recollection; not read on a host or in the container) | If wrong | Check |
|---|---|---|---|
| 1 | The three result lines of iputils `arping -D` in the C locale, on standard output | every `add` answers 55; nothing is ever added | `9A/H-25` (capture asked in the request line) |
| 2 | `ip -json -4 addr show` gives `flags` (with `LOWER_UP`) per interface and `valid_life_time` per address | `add` answers 48 or 47; `del` answers 50 and keeps the mark, the kernel lifetime ends the address | `9A/H-05`, `H-06` |
| 3 | The record files are `iputils-arping.list` / `.md5sums` without an architecture suffix; the checksum line is `<md5>  usr/bin/arping` | `add` and root's `check` answer 38 | installation step 5 (`check`) |
| 4 | The unit's `ProtectSystem=strict` leaves `/var/lib/dpkg/info` readable | 38 through the socket while `check` passes | `9A/H-05` |

Measured, not recollected: the `is not ARPable` text with status 0, the package name and the path `/usr/bin/arping` (test/079).

## 6. Requests filed (`file_requests.md`, three lines)

1. `protocol.ts` owner: the five pairs. Until then, read from source: an unknown name is `HELPER_ANSWER_NOT_UNDERSTOOD` with effect UNKNOWN (`protocol.ts:170-171`, `caller.ts:393-394`) - a refusal, never a done add.
2. Host profile document row (HOST-18): the package, the two record files with their check lines, the camera port holding its IPv4 address and a carrier, Python 3.9 or later.
3. The new hash for the review's statement, records 104 and 127, the two hardware chapters and the collector suite; what `9A/H-25`, `H-05`, `H-06` must capture.

## 7. Driver decisions (for the controller to confirm)

| # | Decision | Reason / alternative |
|---|---|---|
| D-1 | Flags from the existing address read, so a camera port WITHOUT an IPv4 address is refused (48) | The brief names "the fixed `ip` invocation the helper already uses"; a second read (`ip -json link show dev <port>`) would lift this and add one vector to every `add` |
| D-2 | Three interface codes (46, 47, 48), not one | A missing cable, a wrong interface file and an unreadable listing need different hands |
| D-3 | No `BROADCAST` flag counts as not ARPable; no `LOWER_UP` counts as down | A probe that cannot be broadcast, or goes nowhere, asked nobody; stricter than the review's three flags |
| D-4 | The program's identity by the package manager's records with a checksum | Reading marker words inside the binary is weaker; a version pin breaks on every security update |
| D-5 | FREE needs at least 2 probes stated and no line besides the three | "Asked twice" is what the review credits the helper with |
| D-6 | The kernel's stated lifetime is part of "the mark stands"; unknown lifetime refuses | The review's fix alone leaves the re-set-by-hand path open |
| D-7 | The mark's clock is monotonic; 60 s of grace | No wall-clock residual; the kernel removes an expired address a moment late |
| D-8 | A past-lifetime mark with NO address still answers `0 OK already-absent` | The Core's timer sends `del` at the lifetime's end; its row closes as before |

## 8. Rules kept

Existing files changed with the Edit tool only (helper, suite, build step, `SHA256SUMS`, `file_claims.md`, `file_requests.md`); two new documents written. Nothing staged or committed. No `sudo`, no network command, nothing installed, no port, no database, no container.

---
*Generated: 2026-10-13 16:40 WIB*
