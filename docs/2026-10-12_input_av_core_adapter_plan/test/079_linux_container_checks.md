---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 79
package: WP-14 (milestone M5); hypotheses HA-11, HA-12, HA-13; the Linux helper argument list of row 66
date: 2026-10-13
agent: test-expert (agent C1)
tier: T2
status: needs-review - HA-11, HA-12, HA-13 observed and as expected; ONE verification cell is NOT met: the product's Linux helper argument list is REFUSED by the pinned FFmpeg (section 5). No product file was changed
---

# Row 79 - the Linux container checks: survivors, the short process name, the packages, the helper's argument list

EVERY RESULT BELOW IS A CONTAINER RESULT, NOT THE HOST'S: Ubuntu 24.04.5 user space, arm64, glibc 2.39, on the kernel of this Mac's virtual machine; no sound card, no service manager, no network (`--network none`). The programs are the pinned `/opt/dems/ffmpeg-9.0.2/bin/ffmpeg` (9.0.2, ALSA input) and the guard and relay built in the container from the tree (`capture-guard` sha256 `2eba60d1...bb26ca`, `capture-relay` `335c0217...fb2047`). Container, image, lock and labels are those of `test/141_container_e11_relay_state.md` section 2 (one container for both rows, removed at the end, 0 left).

## 1. Result per check

| Check | Expected by the row | Observed | Met |
|---|---|---|---|
| HA-11, without the guard | a count | **survivors 6 of 6**: the FFmpeg helper outlives a killed parent, re-parented to process 1, still writing 8 s later | hypothesis HA-11 holds on Linux |
| HA-11, with the delivered liveness rule | survivors 0 | **survivors 0 of 6** behind the guard (gone 0.023 to 0.528 s after the parent's death); **0 of 6** when the guard itself is killed (gone within 0.002 s: the Linux parent-death signal); the relay **0 of 3** (gone 0.011 to 0.012 s) | **yes** |
| HA-12 | the leftover check names a planted process | the Linux table prints `ffmpeg`, `capture-relay`, `capture-relay-p` (cut at 15 characters), never a path; the product's check, fed with that table, **names the 3 planted programs and not the foreign `ffmpeg`**; its macOS reading names 0 on the same table | **yes** |
| HA-13 | the packages, stated | Ubuntu 24.04 packages FFmpeg **6.1.1** (`7:6.1.1-3ubuntu5`) and two `arping`: `arping` 2.24 and `iputils-arping` `3:20240117`; the image has the second and none of the first two | as the hypothesis says |
| The Linux helper argument list | accepted by the option parser | **REFUSED: `Option channels not found.`, exit 8, 18 of 18 runs** (both lists, three cards). With one change (`-ch_layout <n>C` in the place of `-channels <n>`) accepted 18 of 18 | **NO** - section 5 |

## 2. HA-11: survivors after a killed parent

Driver: `.cache/task4-row079/c1/row079.py` (untracked test code, run as `dems-check`). The parent is its sub-command `wrapper`: it starts ONE child with pipes as its three standard streams, as the production door does, holds the write end of the child's standard input and writes nothing. The driver waits 2.5 s, checks that the child is alive, kills the parent (or the guard) with SIGKILL and watches the process table (`/proc/<pid>/stat`) for 8 s. The helper writes into a named pipe a reader drains.

Two helper forms, both stated because the product's own list does not run (section 5): `sine` - the product's quiet, progress and output words around a generated tone (`-re -f lavfi -i sine=frequency=440:sample_rate=48000`), the `mic` form of row 22, so that the count stands beside the macOS one; `whatif` - the product's Linux push list with `-channels 8` replaced by `-ch_layout 8C`, on the ALSA `null` device.

| Case | What is killed | Helper form | Survivors after 8 s (3 runs) | Gone after (s) | Note |
|---|---|---|---|---|---|
| control | nothing | sine | 3 of 3 alive | - | still delivering, 3 of 3 |
| control | nothing | whatif | 3 of 3 alive | - | alive; its bytes did not grow in the last second of 3 of 3 runs, while they did in the 3 runs without the guard below: on the `null` device delivery is irregular (section 5), so "delivering" is judged on the `sine` form only |
| without the guard | the parent | sine | **3 of 3 survive**, parent now process 1 | never | still delivering, 3 of 3 |
| without the guard | the parent | whatif | **3 of 3 survive**, parent now process 1 | never | - |
| with the guard (`capture-guard <ffmpeg> ...`) | the parent | sine | **0 of 3** (guard and helper) | 0.528, 0.023, 0.047 | the guard sees its input end and ends its child |
| with the guard | the parent | whatif | **0 of 3** | 0.023, 0.514, 0.023 | - |
| with the guard | THE GUARD (its parent lives) | sine | **0 of 3** | 0.001, 0.001, 0.000 | the Linux seam of `guard.c` (`PR_SET_PDEATHSIG`), unproven until now (`implementation/023`) |
| with the guard | THE GUARD | whatif | **0 of 3** | 0.002, 0.001, 0.000 | - |
| the relay, waiting for its start message | the parent | - | **0 of 3** | 0.011, 0.012, 0.012 | the relay ends by itself when its input ends; no guard |

Beside macOS (`test/022`): there the helper survived a killed parent in 30 of 30 runs with a pipe as standard input; here 6 of 6. In two guard-killed runs the reader still took bytes for a second after the helper was gone: what was left in the pipe, not a live helper (the helper's process row was gone).

A first attempt of these cases (12 runs) used the product's list as built: the helper was dead before any parent was killed (`alive_before: false`). Those runs count for nothing and are kept under `.cache/task4-row079/first_attempt/`.

## 3. HA-12: the short process name, and the leftover check on a real Linux table

Planted in the container (`row079.py ha12`): (1) a helper left by a killed parent, program `/opt/dems/ffmpeg-9.0.2/bin/ffmpeg`; (2) a relay waiting for its start message; (3) a program whose file name is longer than 15 characters, `/tmp/dems-row079/plant/capture-relay-planted-long-name`; (4) a FOREIGN program that carries the helper's short name, `/tmp/dems-row079/plant/ffmpeg`. Then the Core's own two commands, by their paths in `leftover.ts`: `/bin/ps -axo pid=,comm=` and `/usr/bin/readlink /proc/<pid>/exe` for every row (both paths exist in the image).

The table the container printed (`04_ha12.log`):

```
      1 docker-init
      7 sleep
  30194 ffmpeg                 <- (1); its parent is process 1
  30208 capture-relay          <- (2)
  30209 capture-relay-p        <- (3), cut at 15 characters
  30210 ffmpeg                 <- (4)
  30211 ps                     (and four python3 rows of the driver)
```

Link readings: 30194 -> `/opt/dems/ffmpeg-9.0.2/bin/ffmpeg`; 30209 and 30210 -> their plant paths; **30208 (the relay): exit 1, nothing printed** - the relay makes itself not dumpable, and Linux shows its program link to nobody without a capability, not even to its own account.

The product's check on that table. The image has no Node, so the function ran on this Mac: `.cache/task4-row079/replay_leftover.mts` calls `leftoverPrograms` with `programPathReaderFor('linux', ...)` of `apps/core-server/src/capture/adapters/local/leftover.ts` through a door that answers the two commands with the container's own output and refuses any other (`04_ha12_replay.log`, `HA-12 REPLAY: PASS`):

| Planted | Named by the Linux reading | How |
|---|---|---|
| (1) the helper left by a killed parent | yes, as `/opt/dems/ffmpeg-9.0.2/bin/ffmpeg` | short name, then an equal link |
| (2) the relay | yes, as `.../build/capture-relay` | short name; its link CANNOT be read, and the check counts what it cannot see (the rule of row 24) |
| (3) the long file name | yes | short name `capture-relay-p`, then an equal link |
| (4) the foreign `ffmpeg` | **no** | short name equal, link another path |
| the macOS reading on the same table | names **0** | the finding HA-12 itself: without the reader a Linux table shows no leftover |

Consequence to know, not a defect: because the relay's link is never readable for the Core's account, EVERY process named `capture-relay` counts as a leftover on Linux, whoever started it. That is the fail-closed side.

## 4. HA-13: the packages

`01_setup_ha13.log` (the package index as read when the image was built; nothing of it installed):

| Package | Ubuntu 24.04 offers | In the image |
|---|---|---|
| `ffmpeg`, `libavformat-dev` | `7:6.1.1-3ubuntu5` (universe) - FFmpeg 6.1.1, not the pinned 9.0.2 | NOT installed (also `libavcodec-dev`, `libavformat60`) |
| `arping` (the other program of that name) | `2.24-1build2` (universe) | NOT installed |
| `iputils-arping` (the one HOST-18 names) | `3:20240117-1ubuntu0.1` (main) | installed; `/usr/bin/arping` belongs to it; `arping from iputils 20240117` |
| the pinned FFmpeg | - | `ffmpeg version 9.0.2`, `--enable-shared --disable-static --disable-doc --enable-indev=alsa`; ALSA device listed; 0 `libx264` / `libx265` encoders |
| for the fixtures only (row 141) | - | `lsof 4.95.0`, `libx264-dev`, `libx265-dev`, and the second FFmpeg under `/opt/dems/fixtures-ffmpeg-9.0.2/bin` (`/usr/local/bin/ffmpeg` points there: on the search path `ffmpeg` is the FIXTURES' program, the helper is named by its full path) |
| `alsa-utils` 1.2.9, `libasound2t64` 1.2.11 | - | installed |

`arping`, parsed only (there is no network to ask): `arping -D -c 1 -w 1 -I lo 192.0.2.1` prints `Interface "lo" is not ARPable` and **ends 0**; on an interface that does not exist it ends 2 (`Device eth0 not available.`); an unknown option ends 2. **Observation for the owner of the conflict check:** exit 0 is also this program's answer for "nobody replied, the address is free", so the exit code alone does not tell "free" from "this interface cannot be asked". Request line filed. That a taken address is refused is `9A/H-25`.

## 5. The Linux helper argument list against ALSA `null` and `file` devices

The lists are the PRODUCT's: printed on this Mac by `.cache/task4-row079/gen_args.mts`, which calls `linuxMicPushArguments` and `linuxMicPrecheckArguments` of `apps/core-server/src/capture/adapters/local/mic-helper-args.ts` for three cards (8 inputs / input 3; 2 inputs / input 1; 1 input / input 1), and handed to the container as JSON. The devices: `/etc/asound.conf` in the container gives the product's own names (`dems_<card>_<device>`) to ALSA's plug-ins - `dems_2_0` and `dems_1_0` are `type null`, `dems_0_0` is `type file` over `null` with a 60 s input file of zeros - in the place of the shared capture the product writes for a real card. `arecord -L` lists the three names.

The push list of the first card, as built:

```
-hide_banner -nostdin -nostats -loglevel warning -progress pipe:1
-thread_queue_size 1024 -f alsa -c:a pcm_s24le -channels 8 -sample_rate 48000 -i dems_2_0
-af pan=mono|c0=c2 -vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <pipe>
```

| Pass | Lists x runs | Result |
|---|---|---|
| THE PRODUCT'S LISTS AS BUILT (`02_alsa_args_product.log`) | pre-check and push, 3 cards, 3 runs each | **0 of 18 accepted.** Every run: exit 8, `Option channels not found.` / `Error opening input file dems_2_0.`; 0 bytes in the pipe, 0 progress blocks |
| WHAT-IF, one change per list: `-channels <n>` -> `-ch_layout <n>C` (`02_alsa_args_whatif.log`) | the same 18 | **18 of 18 accepted**: pre-check exit 0; push with 4 progress blocks and 9,576 to 21,980 bytes in the pipe in 2 s, a whole number of 4-byte samples, then ended by the driver's SIGTERM (exit 255) |
| Negative controls, in both passes | a misspelled option; a device ALSA does not know; a codec name that is none | refused 3 of 3: exit 8 `Unrecognized option`; exit 251 `Unknown PCM dems_9_9`; exit 8 `Unknown decoder` |

Why (`05_whatif.log`): the ALSA input of the pinned build has exactly two options of its own,

```
ALSA indev AVOptions:
  -sample_rate       <int>        .D.........  (from 1 to INT_MAX) (default 48000)
  -ch_layout         <channel_layout> .D.........  (default "2C")
```

and `channels` is an option of nothing in this FFmpeg. The word comes from the tested scheme of the reference (`implementation/066` section 2), which ran an older FFmpeg. `mic-helper-args.ts:208`: `LINUX_INPUT_HEAD = [..., '-c:a', 'pcm_s24le', '-channels']`. As it stands, every Linux microphone helper ends at its pre-check. Row 66's tests compare lists and start no program, and the FFmpeg of this Mac has no ALSA input: nothing before this container could have seen it.

Further what-if facts for the owner, each one run: `-ac 8` in that place is accepted too (`Guessed Channel Layout: 7.1`); `-ch_layout 8c` (small c) is accepted with the message `ALSA channel layout unknown or unimplemented for 7.1 capture`; `-ch_layout 64c` is NOT (`Unable to parse "ch_layout" option value "64c"`); no channel option at all opens the card as stereo - the fault the product's comment warns of (the sound library mixes the inputs). With `-ch_layout 8c` the input reads `pcm_s24le, 48000 Hz, 7.1, s32 (24 bit)` and the selection `pan=mono|c0=c2` gives `pcm_f32le, 48000 Hz, mono`.

What the doubles do not show: every accepted run also prints `Application provided invalid, non monotonically increasing dts to muxer`. The `null` device hands back samples without a clock, so the amount written in 2 s is 0.05 to 0.11 s of sound. That is the double, not the list; the list's behaviour on a real card (its channel layout, the shared capture, the real rate) is hardware.

**No product file was changed.** The request line names the file, the line, the measured spellings and what the owner must decide (one spelling valid for 1 to 64 channels, tested against this program).

## 6. What a container cannot show, by check name

| Left to hardware | Why not here |
|---|---|
| `9A/H-02` | the guard and the parent-death signal on the production host, under the Core as the real parent |
| `9A/H-24` | leftover processes after a killed Core on Linux under the real service manager and account; here the parent is a test wrapper and process 1 is the container's init |
| `9A/H-25` | the conflict check refusing a taken address: no network and no second machine in the container |
| `9A/H-01` | the host's own FFmpeg build (amd64): its ALSA options were read here on arm64 |
| the microphone checks of chapter 9A (I found no number for them in the documents I read) | a real sound card: `arecord -l` (the product's card listing) finds none here and `/proc/asound` does not exist; the shared capture, the card's real channel layout, the selected input carrying the right microphone |

## 7. Commands

```sh
# on this Mac (reads the product's functions, starts no container): from apps/core-server
npx tsx ../../.cache/task4-row079/gen_args.mts /tmp/dems-row079/session-1/MIC-01.pcm > ../../.cache/task4-row079/c1/linux_args.json
npx tsx ../../.cache/task4-row079/replay_leftover.mts ../../.cache/task4-row079/04_ha12.log

# in the container of test/141 section 10, one lock hold per line (dx.sh <log> <account> <command...>)
dx.sh .cache/task4-row079/01_setup_ha13.log root bash /c79/setup_and_ha13.sh
dx.sh .cache/task4-row079/02_alsa_args_product.log dems-check python3 -B /c79/row079.py alsa
dx.sh .cache/task4-row079/02_alsa_args_whatif.log dems-check env ROW079_ARGS=whatif python3 -B /c79/row079.py alsa
dx.sh .cache/task4-row079/05_whatif.log dems-check bash /c79/whatif.sh
dx.sh .cache/task4-row079/03_ha11_<form>_<case>.log dems-check env ROW079_HELPER=<sine|whatif> python3 -B /c79/row079.py ha11 <control|noguard|guard|guardkilled> 3
dx.sh .cache/task4-row079/03_ha11_relay.log dems-check python3 -B /c79/row079.py ha11 relay 3
dx.sh .cache/task4-row079/04_ha12.log dems-check env ROW079_HELPER=sine python3 -B /c79/row079.py ha12
```

## 8. Driver decisions, for the controller to confirm

1. **The row is returned `needs-review`, not `complete`**: one of its three verification cells is not met, and the cause is a product file of another row.
2. **HA-11 was run with two helper forms that are not the product's list as built** (section 2), because that list does not start. Both are stated in every result line.
3. **The leftover check ran on this Mac against the container's recorded table** (no Node in the image). What is the container's is the table and the link readings; what is the product's is the function.
4. **The what-if spelling is evidence, not a proposal for the fix**: `-ch_layout <n>C` is the one I measured for 1, 2 and 8 channels.

## 9. Rules kept

No repository file was written for this row except this record, `delegation_progress/row_079.md` and lines in `file_claims.md` and `file_requests.md` (Edit tool). The test code is under `.cache/task4-row079/` (untracked); it was corrected twice by a scripted replace, which touched no repository file. Every container command held `.locks/heavy-host.lock`; the two `tsx` reads on this Mac did not (they start no worker, relay, guard, media process or container). No real device, no credential, no network. Every process the checks planted was killed by the driver; the container was removed (`docker ps -a --filter label=dems.agent=c1`: 0 rows).

---
*Generated: 2026-10-13 16:00 WIB*
